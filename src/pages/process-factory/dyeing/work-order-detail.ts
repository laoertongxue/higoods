import { escapeHtml } from '../../../utils'
import {
  buildDyeingWorkOrderDetailLink,
  buildHandoverDifferenceRequestPrintLink,
  buildHandoverOrderLink,
  buildTaskDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  buildMobileExecutionListLocatePathForTask,
  getMobileExecutionTaskById,
} from '../../../data/fcs/mobile-execution-task-index.ts'
import { validateDyeWorkOrderMobileTaskBinding } from '../../../data/fcs/process-mobile-task-binding.ts'
import {
  executeProcessWebAction,
  getAvailableDyeWebActions,
  getProcessWebOperationRecordsBySource,
  type ProcessWebAction,
  type ProcessWebOperationRecord,
} from '../../../data/fcs/process-web-status-actions.ts'
import { getPlatformStatusForProcessWorkOrder } from '../../../data/fcs/process-platform-status-adapter.ts'
import { getProcessWorkOrderById } from '../../../data/fcs/process-work-order-domain.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getReviewRecordsByWorkOrderId,
  handleProcessHandoverDifference,
  type ProcessHandoverDifferenceRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { getDyeingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import { getDyeReviewStatusLabel, type DyeReviewStatus } from '../../../data/fcs/dyeing-task-domain.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { appStore } from '../../../state/store.ts'
import { formatDyeQty, formatDyeTime, renderBadge, renderPageHeader, renderSection } from './shared'

type DyeDetailTab =
  | 'base'
  | 'sample'
  | 'execution'
  | 'formula'
  | 'handover'
  | 'review'
  | 'statistics'
  | 'exception'

const dyeDetailTabs: Array<{ key: DyeDetailTab; label: string }> = [
  { key: 'base', label: '基本信息' },
  { key: 'sample', label: '打样备料' },
  { key: 'execution', label: '染缸执行' },
  { key: 'formula', label: '染色配方' },
  { key: 'handover', label: '送货交出' },
  { key: 'review', label: '审核记录' },
  { key: 'statistics', label: '染色统计' },
  { key: 'exception', label: '异常与结算' },
]

const consumedWebActionKeys = new Set<string>()

function getCurrentDyeDetailTab(): DyeDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return dyeDetailTabs.some((item) => item.key === tab) ? (tab as DyeDetailTab) : 'base'
}

function renderDetailTabs(orderId: string, activeTab: DyeDetailTab): string {
  const baseHref = buildDyeingWorkOrderDetailLink(orderId)
  return `
    <nav class="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      ${dyeDetailTabs
        .map((item) => {
          const active = item.key === activeTab
          return `
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm ${active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
              data-nav="${escapeHtml(`${baseHref}?tab=${item.key}`)}"
            >
              ${escapeHtml(item.label)}
            </button>
          `
        })
        .join('')}
    </nav>
  `
}

function renderField(label: string, value: string): string {
  return `<div><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="font-medium">${escapeHtml(value || '—')}</span></div>`
}

function renderWebActionPanel(orderId: string, currentStatus: string, actions: ProcessWebAction[], platformStatus: string): string {
  const actionable = actions.filter((action) => !action.disabledReason)
  const disabledReason = actions.find((action) => action.disabledReason)?.disabledReason
  const actionHref = (actionCode: string) => `${buildDyeingWorkOrderDetailLink(orderId)}?webAction=${encodeURIComponent(actionCode)}`
  return renderSection(
    '可执行动作',
    `
      <div class="space-y-3">
        <div class="grid gap-3 text-sm md:grid-cols-3">
          ${renderField('当前状态', currentStatus)}
          ${renderField('平台聚合状态', platformStatus)}
          ${renderField('操作方式', '仅展示当前状态允许的下一步动作')}
        </div>
        ${
          actionable.length
            ? `<div class="flex flex-wrap gap-2">
                ${actionable
                  .map(
                    (action) => `
                      <button
                        type="button"
                        class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        data-nav="${escapeHtml(actionHref(action.actionCode))}"
                      >
                        ${escapeHtml(action.actionLabel)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
              <div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                操作弹窗字段：${escapeHtml(actionable[0].requiredFields.join('、'))}；确认后写回统一事实源并生成 Web 端操作记录。
              </div>`
            : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`
        }
      </div>
    `,
  )
}

function renderWebOperationRecords(records: ProcessWebOperationRecord[]): string {
  return renderSection(
    'Web 端操作记录',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">操作动作</th>
              <th class="px-3 py-2 font-medium">前状态</th>
              <th class="px-3 py-2 font-medium">后状态</th>
              <th class="px-3 py-2 font-medium">操作人</th>
              <th class="px-3 py-2 font-medium">操作时间</th>
              <th class="px-3 py-2 font-medium">操作对象数量和单位</th>
              <th class="px-3 py-2 font-medium">来源</th>
              <th class="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            ${
              records.length
                ? records
                    .map(
                      (record) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.actionLabel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.previousStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.nextStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatedAt)}</td>
                          <td class="px-3 py-3 text-sm">
                            <div class="text-xs text-muted-foreground">${escapeHtml(record.qtyLabel)}</div>
                            <div>${formatDyeQty(record.objectQty, record.qtyUnit)}</div>
                          </td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceChannel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无 Web 端状态操作记录</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )
}

function renderNodeTable(orderId: string): string {
  const order = getProcessWorkOrderById(orderId)
  if (!order) return ''
  const rows = order.executionNodes
    .map((node) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(node.nodeName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(formatDyeTime(node.startedAt))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(formatDyeTime(node.finishedAt))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(node.operatorName || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml('dyeVatNo' in node ? node.dyeVatNo || '—' : '—')}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty('outputQty' in node ? node.outputQty : undefined, order.plannedUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(node.remark || '—')}</td>
      </tr>
    `)
    .join('')

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">节点</th>
            <th class="px-3 py-2 font-medium">开始时间</th>
            <th class="px-3 py-2 font-medium">结束时间</th>
            <th class="px-3 py-2 font-medium">操作人</th>
            <th class="px-3 py-2 font-medium">染缸</th>
            <th class="px-3 py-2 font-medium">完成面料米数</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无执行记录</td></tr>'}</tbody>
      </table>
    </div>
  `
}

function renderReviewStatusLabel(status: unknown): string {
  return typeof status === 'string' && ['WAIT_REVIEW', 'PASS', 'REJECTED', 'PARTIAL_PASS'].includes(status)
    ? getDyeReviewStatusLabel(status as DyeReviewStatus)
    : '—'
}

function resolveDifferenceAction(): { differenceId: string; action: string } | undefined {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const differenceId = params.get('differenceId') || ''
  const action = params.get('differenceAction') || ''
  return differenceId && action ? { differenceId, action } : undefined
}

function applyDifferenceActionFromUrl(): void {
  const input = resolveDifferenceAction()
  if (!input) return
  const actionMap: Record<string, Parameters<typeof handleProcessHandoverDifference>[1]['nextAction']> = {
    confirm: '确认差异继续流转',
    rework: '要求重新交出',
    close: '关闭记录',
    processing: '平台处理',
  }
  const nextAction = actionMap[input.action]
  if (!nextAction) return
  handleProcessHandoverDifference(input.differenceId, {
    handlingResult: nextAction,
    responsibilitySide: nextAction === '确认差异继续流转' ? '非工厂责任' : '待判定',
    nextAction,
    handledBy: '平台处理员',
    remark: '染色交出差异处理',
  })
}

function applyWebActionFromUrl(orderId: string): void {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const params = new URLSearchParams(queryString)
  const actionCode = params.get('webAction') || ''
  if (!actionCode) return
  const actionKey = `${orderId}:${actionCode}`
  if (consumedWebActionKeys.has(actionKey)) return
  consumedWebActionKeys.add(actionKey)
  try {
    executeProcessWebAction({
      sourceType: 'DYE_WORK_ORDER',
      sourceId: orderId,
      actionCode,
      operatorName: 'Web 端操作员',
      operatedAt: '2026-04-28 10:00',
      remark: '工艺工厂 Web 端状态操作',
    })
  } catch {
    // 页面仍展示当前可操作原因；失败不写入事实源。
  }
}

function renderDifferenceRows(records: ProcessHandoverDifferenceRecord[], orderId: string): string {
  const baseHref = `${buildDyeingWorkOrderDetailLink(orderId)}?tab=exception`
  return records
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.differenceRecordNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.differenceType)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.expectedObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.actualObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.diffObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handlingResult || record.nextAction || '待平台处理')}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=confirm`)}">确认差异继续流转</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=rework`)}">要求重新交出</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=processing`)}">标记平台处理中</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(`${baseHref}&differenceId=${record.differenceRecordId}&differenceAction=close`)}">关闭记录</button>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHandoverDifferenceRequestPrintLink(record.differenceRecordId))}">打印差异处理申请单</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

export function renderCraftDyeingWorkOrderDetailPage(dyeOrderId: string): string {
  applyDifferenceActionFromUrl()
  applyWebActionFromUrl(dyeOrderId)
  const order = getProcessWorkOrderById(dyeOrderId)
  if (!order || order.processType !== 'DYE' || !order.dyePayload) {
    return `
      <div class="space-y-4 p-4">
        ${renderPageHeader('染色加工单详情', '未找到对应的染色加工单')}
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
      </div>
    `
  }

  const dye = order.dyePayload
  const sampleNode = order.executionNodes.find((node) => node.nodeName === '打样')
  const materialNode = order.executionNodes.find((node) => node.nodeName === '备料')
  const vatNode = order.executionNodes.find((node) => node.nodeName.includes('排'))
  const dyeNode = order.executionNodes.find((node) => node.nodeName === '染色')
  const afterNodes = order.executionNodes.filter((node) => ['脱水', '烘干', '定型', '打卷', '包装'].includes(node.nodeName))
  const processHandoverRecords = getHandoverRecordsByWorkOrderId(order.workOrderId)
  const processReviewRecords = getReviewRecordsByWorkOrderId(order.workOrderId)
  const processDifferenceRecords = getDifferenceRecordsByWorkOrderId(order.workOrderId)
  const dyeStatistics = getDyeingExecutionStatistics({ workOrderId: order.workOrderId })
  const formulaRows = dye.formulaRecords
    .flatMap((formula) =>
      formula.lines.map((line) => `
        <tr class="border-b last:border-b-0">
          <td class="px-3 py-3 text-sm">${escapeHtml(formula.formulaNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(formula.formulaName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(line.materialName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(line.materialCode)}</td>
          <td class="px-3 py-3 text-sm">${line.feedQty} ${escapeHtml(line.feedUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(line.note || formula.remark || '—')}</td>
        </tr>
      `),
    )
    .join('')
  const handoverRows = processHandoverRecords
    .map((record) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.handoverRecordNo || record.handoverRecordId)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.handoverAt)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.handoverObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(record.receiveObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.receiveAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || record.status || '—')}</td>
      </tr>
    `)
    .join('')
  const reviewRows = processReviewRecords
    .map((review) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewStatus)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.expectedObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.actualObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.diffObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewerName || '待审核')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewedAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reason || review.nextAction || '—')}</td>
      </tr>
    `)
    .join('')

  const activeTab = getCurrentDyeDetailTab()
  const afterNodeText = afterNodes
    .map((node) => `${node.nodeName}：${formatDyeTime(node.startedAt)} 至 ${formatDyeTime(node.finishedAt)}，${node.operatorName || '—'}，${formatDyeQty('outputQty' in node ? node.outputQty : undefined, order.plannedUnit)}`)
    .join('；') || '—'
  const mobileBinding = validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId || order.workOrderId)
  const mobileBindingTaskNo = mobileBinding.actualTaskNo || mobileBinding.expectedTaskNo || '未绑定'
  const mobileBindingStatus = mobileBinding.canOpenMobileExecution ? '有效' : '不可执行'
  const mobileBindingReasonLabel =
    mobileBinding.reasonCode === 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
      ? '移动端执行列表不可见，请检查工厂或任务状态'
      : mobileBinding.reasonLabel
  const mobileExecutionTask = mobileBinding.actualTaskId ? getMobileExecutionTaskById(mobileBinding.actualTaskId) : null
  const mobileExecutionLink =
    mobileBinding.canOpenMobileExecution && mobileExecutionTask
      ? buildTaskDetailLink(mobileBinding.actualTaskId || order.taskId, {
          returnTo: buildMobileExecutionListLocatePathForTask(mobileExecutionTask, {
            currentFactoryId: order.factoryId || 'F090',
            keyword: order.workOrderNo || order.dyeOrderNo,
          }),
          sourceType: 'DYE_WORK_ORDER',
          sourceId: order.dyeOrderId || order.workOrderId,
          currentFactoryId: order.factoryId || 'F090',
          keyword: order.workOrderNo || order.dyeOrderNo,
        })
      : ''
  const webActions = getAvailableDyeWebActions(order.workOrderId)
  const webOperationRecords = getProcessWebOperationRecordsBySource('DYE_WORK_ORDER', order.workOrderId)
  const platformStatus = getPlatformStatusForProcessWorkOrder(order)
  const sections: Record<DyeDetailTab, string> = {
    base: renderSection(
      '基本信息',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          ${renderField('加工单号', order.workOrderNo)}
          ${renderField('来源需求单', order.sourceDemandIds.join('、'))}
          ${renderField('关联生产单', order.productionOrderIds.join('、'))}
          ${renderField('工厂', formatFactoryDisplayName(order.factoryName, order.factoryId))}
          ${renderField('原料面料 SKU', dye.rawMaterialSku)}
          ${renderField('成分', dye.composition || '—')}
          ${renderField('幅宽', dye.width || '—')}
          ${renderField('克重', dye.weightGsm ? `${dye.weightGsm} 克/平方米` : '—')}
          ${renderField('目标颜色', dye.targetColor)}
          ${renderField('计划染色面料米数', `${order.plannedQty} ${order.plannedUnit}`)}
          <div><span class="text-muted-foreground">当前状态：</span>${renderBadge(order.statusLabel, 'info')}</div>
          ${renderField('首单/翻单', dye.isFirstOrder ? '首单' : '翻单')}
          ${renderField('移动端执行任务引用', `${order.taskNo} / ${order.taskId}`)}
          ${renderField('移动端执行任务号', mobileBindingTaskNo)}
          ${renderField('绑定状态', mobileBindingStatus)}
          ${renderField('校验结果', mobileBinding.canOpenMobileExecution ? '允许打开移动端执行页' : '当前不可执行')}
          ${renderField('不可执行原因', mobileBindingReasonLabel)}
          ${renderField('移动端交出记录引用', order.handoverOrderNo || order.handoverOrderId || '未生成')}
        </div>
      `,
    ),
    sample: renderSection(
      '打样备料',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('是否等待样衣', dye.sampleWaitType === 'NONE' ? '否' : '是')}
          ${renderField('是否等待原料', order.status === 'WAIT_MATERIAL' ? '是' : '否')}
          ${renderField('打样开始时间', formatDyeTime(sampleNode?.startedAt))}
          ${renderField('打样完成时间', formatDyeTime(sampleNode?.finishedAt))}
          ${renderField('色号', dye.colorNo || '待确认')}
          ${renderField('备料完成时间', formatDyeTime(materialNode?.finishedAt))}
          ${renderField('备料备注', materialNode?.remark || '—')}
        </div>
      `,
    ),
    execution: renderSection(
      '染缸执行',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('染缸号', 'dyeVatNo' in (vatNode || {}) ? String(vatNode?.dyeVatNo || '—') : '—')}
          ${renderField('排缸时间', formatDyeTime(vatNode?.finishedAt))}
          ${renderField('染色开始时间', formatDyeTime(dyeNode?.startedAt))}
          ${renderField('染色完成时间', formatDyeTime(dyeNode?.finishedAt))}
          ${renderField('脱水/烘干/定型/打卷/包装', afterNodeText)}
          ${renderField('染色完成面料米数', formatDyeQty('outputQty' in (dyeNode || {}) ? dyeNode?.outputQty : undefined, order.plannedUnit))}
        </div>
      `,
    ),
    formula: renderSection(
      '染色配方',
      `
        <p class="mb-3 text-sm text-muted-foreground">染色配方是染色加工单下的子信息，不是独立主单。</p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">配方号</th>
                <th class="px-3 py-2 font-medium">配方名称</th>
                <th class="px-3 py-2 font-medium">染料/助剂</th>
                <th class="px-3 py-2 font-medium">编码</th>
                <th class="px-3 py-2 font-medium">投料</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${formulaRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="6">暂无染色配方</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    handover: renderSection(
      '送货交出',
      `
        <div class="mb-3 grid gap-3 text-sm md:grid-cols-3">
          ${renderField('接收方', dye.targetTransferWarehouseName)}
          ${renderField('交出单', order.handoverOrderNo || order.handoverOrderId || '未生成')}
          ${renderField('交出记录数', `${processHandoverRecords.length} 条`)}
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">交出记录</th>
                <th class="px-3 py-2 font-medium">提交时间</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">回写时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${handoverRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="6">暂无交出记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    review: renderSection(
      '审核记录',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">审核状态</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">差异面料米数</th>
                <th class="px-3 py-2 font-medium">审核人</th>
                <th class="px-3 py-2 font-medium">审核时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${reviewRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无审核记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    statistics: renderSection(
      '染色统计',
      `
        <div class="mb-4 grid gap-3 md:grid-cols-3">
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">有差异交出记录数</div>
            <div class="mt-1 text-lg font-semibold">${dyeStatistics.differenceHandoverCount}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">交出面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.handedOverFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">实收面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.receivedFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">染色完成面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.dyeCompletedFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">包装完成面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.finalPackedFabricMeters, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">差异面料米数</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(dyeStatistics.diffFabricMeters, order.plannedUnit)}</div>
          </div>
        </div>
        ${renderNodeTable(order.workOrderId)}
      `,
    ),
    exception: renderSection(
      '染色交出差异处理',
      `
        <p class="mb-3 text-sm text-muted-foreground">染色交出差异只写入统一差异记录；本次不直接生成质量扣款流水、对账流水或结算流水。</p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">差异记录</th>
                <th class="px-3 py-2 font-medium">差异类型</th>
                <th class="px-3 py-2 font-medium">交出面料米数</th>
                <th class="px-3 py-2 font-medium">实收面料米数</th>
                <th class="px-3 py-2 font-medium">差异面料米数</th>
                <th class="px-3 py-2 font-medium">差异状态</th>
                <th class="px-3 py-2 font-medium">处理结果</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>${renderDifferenceRows(processDifferenceRecords, order.workOrderId) || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无数量差异记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
  }

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader(
        '染色加工单详情',
        'Web 端查看加工单主详情；染色配方和染色统计都是加工单下的信息视图。',
        `
          <div class="flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
            ${
              mobileBinding.canOpenMobileExecution
                ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(mobileExecutionLink)}">打开移动端执行页</button>`
                : '<button class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端执行页</button>'
            }
            ${
              order.handoverOrderId
                ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildHandoverOrderLink(order.handoverOrderId))}">打开移动端交出页</button>`
                : '<button class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端交出页</button>'
            }
            ${
              mobileBinding.canOpenMobileExecution
                ? `<span class="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">绑定状态：${escapeHtml(mobileBindingStatus)}</span>`
                : `<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">不可执行：${escapeHtml(mobileBindingReasonLabel)}</span>`
            }
          </div>
        `,
      )}

      ${renderDetailTabs(order.workOrderId, activeTab)}
      ${renderWebActionPanel(order.workOrderId, order.statusLabel, webActions, platformStatus.platformStatusLabel)}
      ${sections[activeTab]}
      ${renderWebOperationRecords(webOperationRecords)}
    </div>
  `
}
