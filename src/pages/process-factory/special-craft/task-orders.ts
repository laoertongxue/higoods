import {
  buildSpecialCraftTaskDetailPath,
  buildSpecialCraftPreferredWarehousePath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import { buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { getSpecialCraftTaskOrders } from '../../../data/fcs/special-craft-task-orders.ts'
import { getSpecialCraftBindingSummaryByTaskOrderId } from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderFilterGrid,
  renderMetricCards,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

function renderMissingOperation(): string {
  return renderSpecialCraftPageLayout({
    operation: {
      operationId: 'UNKNOWN',
      craftCode: '',
      craftName: '特殊工艺',
      processCode: 'SPECIAL_CRAFT',
      processName: '特殊工艺',
      operationName: '特殊工艺',
      supportedTargetObjects: [],
      supportedTargetObjectLabels: [],
      defaultTargetObject: '已裁部位',
      targetObject: '已裁部位',
      visibleFactoryTypes: [],
      visibleFactoryIds: [],
      requiresTaskOrder: true,
      requiresFactoryWarehouse: true,
      requiresStatistics: true,
      requiresFeiTicketScan: false,
      mustReturnToCuttingFactory: false,
      isEnabled: false,
      remark: '',
    },
    title: '特殊工艺任务单',
    description: '未找到对应特殊工艺，请从左侧菜单重新进入。',
    activeSubNav: 'tasks',
    content: renderEmptyState('未找到对应特殊工艺。'),
  })
}

export function renderSpecialCraftTaskOrdersPage(operationSlug: string): string {
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  if (!operation) return renderMissingOperation()
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: `${operation.operationName}任务单`,
      description: '按任务单查看当前特殊工艺的接单、执行、菲票流转和差异状态。',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }

  const taskOrders = getSpecialCraftTaskOrders(operation.operationId)
  const taskCount = taskOrders.length
  const waitPickupCount = taskOrders.filter((item) => item.status === '待领料').length
  const processingCount = taskOrders.filter((item) => item.status === '加工中').length
  const completedCount = taskOrders.filter((item) => item.status === '已完成').length
  const waitHandoverCount = taskOrders.filter((item) => item.status === '待交出').length
  const differenceCount = taskOrders.filter((item) => item.status === '差异' || item.abnormalStatus === '数量差异').length
  const abnormalCount = taskOrders.filter((item) => item.abnormalStatus !== '无异常' || item.status === '异常').length

  const metrics = renderMetricCards([
    { label: '任务总数', value: String(taskCount), tone: 'blue' },
    { label: '待领料', value: String(waitPickupCount), tone: 'amber' },
    { label: '加工中', value: String(processingCount), tone: 'blue' },
    { label: '已完成', value: String(completedCount), tone: 'green' },
    { label: '待交出', value: String(waitHandoverCount), tone: 'amber' },
    { label: '差异', value: String(differenceCount), tone: 'red' },
    { label: '异常', value: String(abnormalCount), tone: 'red' },
  ])

  const filters = renderFilterGrid([
    { label: '任务号', value: '全部任务号' },
    { label: '生产单', value: '全部生产单' },
    { label: '工厂', value: '全部工厂' },
    { label: '状态', value: '全部状态' },
    { label: '异常', value: '全部异常' },
    { label: '时间范围', value: '近 30 天' },
    { label: '关键字', value: '支持任务号 / 生产单 / 菲票号 / 中转袋号' },
  ])

  const rows = taskOrders
    .map((taskOrder) => {
      const detailHref = buildSpecialCraftTaskDetailPath(operation, taskOrder.taskOrderId)
      const warehouseHref = buildSpecialCraftPreferredWarehousePath(taskOrder)
      const demandLineCount = taskOrder.demandLines?.length || 0
      const bindingSummary = getSpecialCraftBindingSummaryByTaskOrderId(taskOrder.taskOrderId)
      return `
        <tr class="align-top">
          <td class="px-3 py-3 font-medium text-blue-700">
            <button type="button" class="text-left hover:underline" data-nav="${detailHref}">${escapeHtml(taskOrder.taskOrderNo)}</button>
          </td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.productionOrderNo)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.generationSourceLabel || '生产单生成')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.operationName)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.factoryName)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.targetObject)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.partName || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.fabricColor || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.sizeCode || '—')}</td>
          <td class="px-3 py-3">${String(demandLineCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.linkedFeiTicketCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.childWorkOrderCount)}</td>
          <td class="px-3 py-3">${formatQty(bindingSummary.currentQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${formatQty(bindingSummary.cumulativeScrapQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${formatQty(bindingSummary.cumulativeDamageQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${String(bindingSummary.dispatchedFeiTicketCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.receivedFeiTicketCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.completedFeiTicketCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.returnedFeiTicketCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.receiveDifferenceTicketCount)}</td>
          <td class="px-3 py-3">${String(bindingSummary.returnDifferenceTicketCount)}</td>
          <td class="px-3 py-3">${renderStatusBadge(bindingSummary.returnStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.feiTicketNos.join('、') || '—')}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.transferBagNos.join('、') || '—')}</td>
          <td class="px-3 py-3">${formatQty(taskOrder.planQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${formatQty(taskOrder.receivedQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${formatQty(taskOrder.completedQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${formatQty(taskOrder.waitHandoverQty)}${escapeHtml(taskOrder.unit)}</td>
          <td class="px-3 py-3">${renderStatusBadge(taskOrder.assignmentStatusLabel || '待分配')}</td>
          <td class="px-3 py-3">${renderStatusBadge(taskOrder.executionStatusLabel || taskOrder.status)}</td>
          <td class="px-3 py-3">${renderStatusBadge(taskOrder.status)}</td>
          <td class="px-3 py-3">${renderStatusBadge(taskOrder.abnormalStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(taskOrder.dueAt.slice(0, 10))}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${detailHref}">查看详情</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)}">打印任务流转卡</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${warehouseHref}">查看仓库记录</button>
              <button type="button" class="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/pda/handover">查看交出记录</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')

  const content = `
    ${filters}
    ${metrics}
    ${
      taskOrders.length > 0
        ? renderTable(
            [
              '任务号',
              '生产单',
              '来源',
              '特殊工艺',
              '工厂',
              '作用对象',
              '裁片部位',
              '颜色',
              '尺码',
              '明细数',
              '关联菲票数',
              '子工艺单数',
              '当前数量',
              '累计报废',
              '累计货损',
              '已发料菲票数',
              '已接收菲票数',
              '已完成菲票数',
              '已回仓菲票数',
              '接收差异菲票数',
              '回仓差异菲票数',
              '回仓状态',
              '菲票号',
              '中转袋号',
              '计划数量',
              '已接收数量',
              '已完成数量',
              '待交出数量',
              '分配状态',
              '执行状态',
              '当前状态',
              '异常状态',
              '交期',
              '操作',
            ],
            rows,
            'min-w-[2100px]',
          )
        : renderEmptyState()
    }
  `

  return renderSpecialCraftPageLayout({
    operation,
    title: `${operation.operationName}任务单`,
    description: '展示当前特殊工艺已由生产单沉淀后的任务结果，本页仅承接任务查看与结果追踪。',
    activeSubNav: 'tasks',
    content,
  })
}
