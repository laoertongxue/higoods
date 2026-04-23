import {
  buildSpecialCraftTaskDetailPath,
  getSpecialCraftOperationBySlug,
} from '../../../data/fcs/special-craft-operations.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrderById,
  getSpecialCraftTaskWorkOrderLinesByWorkOrderId,
} from '../../../data/fcs/special-craft-task-orders.ts'
import {
  getSpecialCraftFeiTicketFlowEventsByWorkOrderId,
  listCuttingSpecialCraftFeiTicketBindings,
  listSpecialCraftQtyDifferenceReports,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatQty,
  renderEmptyState,
  renderSpecialCraftFactoryContextBlockedLayout,
  renderSpecialCraftPageLayout,
  resolveSpecialCraftFactoryContextGuard,
  renderStatusBadge,
  renderTable,
} from './shared.ts'

function renderInfoGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${items
        .map(
          (item) => `
            <div class="rounded-2xl border bg-slate-50/60 p-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-medium text-foreground">${item.value}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSection(title: string, body: string): string {
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div class="mt-4">${body}</div>
    </section>
  `
}

export function renderSpecialCraftWorkOrderDetailPage(operationSlug: string, workOrderId: string): string {
  const operation = getSpecialCraftOperationBySlug(operationSlug)
  const workOrder = getSpecialCraftTaskWorkOrderById(decodeURIComponent(workOrderId))
  if (!operation || !workOrder || workOrder.operationId !== operation.operationId) {
    return renderEmptyState('未找到对应工艺单。')
  }
  const factoryGuard = resolveSpecialCraftFactoryContextGuard(operation)
  if (factoryGuard.blocked) {
    return renderSpecialCraftFactoryContextBlockedLayout({
      operation,
      title: '工艺单详情',
      description: '查看工艺单明细、绑定菲票、差异上报和流转事件。',
      activeSubNav: 'tasks',
      factoryName: factoryGuard.factoryName,
    })
  }
  const taskOrder = getSpecialCraftTaskOrderById(workOrder.taskOrderId)
  const bindings = listCuttingSpecialCraftFeiTicketBindings().filter((binding) => binding.workOrderId === workOrder.workOrderId)
  const lines = getSpecialCraftTaskWorkOrderLinesByWorkOrderId(workOrder.workOrderId)
  const reports = listSpecialCraftQtyDifferenceReports().filter((report) => report.workOrderId === workOrder.workOrderId)
  const events = getSpecialCraftFeiTicketFlowEventsByWorkOrderId(workOrder.workOrderId)

  const basicInfo = renderInfoGrid([
    { label: '工艺单号', value: escapeHtml(workOrder.workOrderNo) },
    { label: '生产单', value: escapeHtml(workOrder.productionOrderNo) },
    { label: '特殊工艺', value: escapeHtml(workOrder.operationName) },
    { label: '工厂', value: escapeHtml(workOrder.factoryName) },
    { label: '裁片部位', value: escapeHtml(workOrder.partName) },
    { label: '原数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.originalQty, 0))}片` },
    { label: '当前数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.currentQty, 0) || workOrder.currentQty)}片` },
    { label: '累计报废', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.cumulativeScrapQty, 0) || workOrder.scrapQty)}片` },
    { label: '累计货损', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.cumulativeDamageQty, 0) || workOrder.damageQty)}片` },
    { label: '已回仓数量', value: `${formatQty(bindings.reduce((sum, binding) => sum + binding.returnedQty, 0) || workOrder.returnedQty)}片` },
    { label: '当前状态', value: renderStatusBadge(workOrder.status) },
    { label: '绑定菲票', value: escapeHtml(bindings.map((binding) => binding.feiTicketNo).join('、') || '待绑定') },
  ])

  const lineRows = lines
    .map(
      (line) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(line.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(line.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(line.planPieceQty)}</td>
          <td class="px-3 py-3">${formatQty(bindings.filter((binding) => binding.workOrderLineId === line.lineId).reduce((sum, binding) => sum + binding.currentQty, 0))}</td>
          <td class="px-3 py-3">${escapeHtml(line.feiTicketNos.join('、') || '待绑定')}</td>
        </tr>
      `,
    )
    .join('')

  const bindingRows = bindings
    .map(
      (binding) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(binding.feiTicketNo)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.colorName)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.sizeCode)}</td>
          <td class="px-3 py-3">${formatQty(binding.originalQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.currentQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeScrapQty)}</td>
          <td class="px-3 py-3">${formatQty(binding.cumulativeDamageQty)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.completedOperationNames.join('、') || '—')}</td>
          <td class="px-3 py-3">${renderStatusBadge(binding.specialCraftFlowStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(binding.receiveDifferenceStatus || binding.returnDifferenceStatus || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const reportRows = reports
    .map(
      (report) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(report.reportPhase)}</td>
          <td class="px-3 py-3">${escapeHtml(report.feiTicketNo)}</td>
          <td class="px-3 py-3">${formatQty(report.expectedQty)}</td>
          <td class="px-3 py-3">${formatQty(report.actualQty)}</td>
          <td class="px-3 py-3">${formatQty(report.differenceQty)}</td>
          <td class="px-3 py-3">${renderStatusBadge(report.platformStatus)}</td>
          <td class="px-3 py-3">${escapeHtml(report.reason)}</td>
        </tr>
      `,
    )
    .join('')

  const eventRows = events
    .map(
      (event) => `
        <tr class="align-top">
          <td class="px-3 py-3">${escapeHtml(event.eventType)}</td>
          <td class="px-3 py-3">${escapeHtml(event.feiTicketNo)}</td>
          <td class="px-3 py-3">${event.beforeQty ?? '—'}</td>
          <td class="px-3 py-3">${event.changedQty ?? '—'}</td>
          <td class="px-3 py-3">${event.afterQty ?? '—'}</td>
          <td class="px-3 py-3">${escapeHtml(event.operatorName)}</td>
          <td class="px-3 py-3">${escapeHtml(event.occurredAt)}</td>
          <td class="px-3 py-3">${escapeHtml(event.relatedRecordNo || '—')}</td>
        </tr>
      `,
    )
    .join('')

  const content = [
    renderSection('基本信息', basicInfo),
    renderSection('明细行', lineRows ? renderTable(['颜色', '尺码', '计划数量', '当前数量', '绑定菲票'], lineRows, 'min-w-[820px]') : renderEmptyState('暂无明细行')),
    renderSection('绑定菲票', bindingRows ? renderTable(['菲票号', '颜色', '尺码', '原数量', '当前数量', '累计报废', '累计货损', '已完成特殊工艺', '状态', '差异状态'], bindingRows, 'min-w-[1180px]') : renderEmptyState('暂无绑定菲票')),
    renderSection('差异上报', reportRows ? renderTable(['差异类型', '菲票号', '应收数量', '实收数量', '差异数量', '平台状态', '原因'], reportRows, 'min-w-[980px]') : renderEmptyState('暂无差异上报')),
    renderSection('流转事件', eventRows ? renderTable(['事件', '菲票号', '前数量', '变化数量', '后数量', '操作人', '时间', '关联记录'], eventRows, 'min-w-[1080px]') : renderEmptyState('暂无流转事件')),
    `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${buildSpecialCraftTaskDetailPath(operation, taskOrder?.taskOrderId || workOrder.taskOrderId)}">返回任务详情</button>`,
  ].join('')

  return renderSpecialCraftPageLayout({
    operation,
    title: '工艺单详情',
    description: '按裁片部位展示特殊工艺执行、数量变化、差异上报和流转事件。',
    activeSubNav: 'tasks',
    content,
  })
}
