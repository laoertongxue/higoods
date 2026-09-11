import {getDyeingQuantityFacts} from '../../../data/fcs/dyeing-quantity-facts.ts'
import { getDyeMaterialReceiptOptions, receiveDyeMaterial } from '../../../data/fcs/dyeing-material-receipts.ts'
// @page-pattern: detail

import { escapeHtml } from '../../../utils'
import { hydrateIcons } from '../../../components/shell.ts'
import {
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
  getUnifiedOperationRecordsForProcessWorkOrder,
  type ProcessWebAction,
  type ProcessWebOperationRecord,
} from '../../../data/fcs/process-web-status-actions.ts'
import { getPlatformStatusForProcessWorkOrder } from '../../../data/fcs/process-platform-status-adapter.ts'
import { getStartPrerequisiteByTaskId } from '../../../data/fcs/pda-start-link.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { validateWaterSolublePdaActor, type WaterSolublePdaRoleAction } from '../../../data/fcs/water-soluble-pda-actor.ts'
import {
  getProcessWorkOrderById,
  getProcessWorkOrderByNo,
  type ProcessWorkOrder,
} from '../../../data/fcs/process-work-order-domain.ts'
import { getQuantityLabel, type QtyPurpose } from '../../../data/fcs/process-quantity-labels.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  handleProcessHandoverDifference,
  type ProcessHandoverDifferenceRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import { getDyeingExecutionStatistics } from '../../../data/fcs/process-statistics-domain.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { appStore } from '../../../state/store.ts'
import { formatDyeQty, formatDyeTime, renderBadge, renderPageHeader, renderSection } from './shared'
import {
  canContinueDyeWaterSoluble,
  getDyeWorkOrderById,
  getDyeExecutionNodeRecord,
  startDyeing,
  getDyeCurrentStepLabel,
  listDyeExecutionNodeRecords,
  type DyeWorkOrder,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { getProcessWorkOrderSourceDetailRows } from '../../process-work-orders/process-work-order-source-view.ts'
import { renderProcessOrderTaskRelations } from '../../process-order-task-relations.ts'

function renderSourceFields(order: ProcessWorkOrder): string {
  return getProcessWorkOrderSourceDetailRows(order).map((row) => renderField(row.label, row.value)).join('')
}

function dyeQuantityLabel(
  order: ProcessWorkOrder,
  qtyPurpose: QtyPurpose,
  operationCode?: string,
): string {
  return getQuantityLabel({
    processType: 'DYE',
    sourceType: 'DYE_WORK_ORDER',
    sourceId: order.workOrderId,
    objectType: order.objectType,
    qtyUnit: order.plannedUnit,
    qtyPurpose,
    operationCode,
  })
}

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
  { key: 'sample', label: '打样与接收' },
  { key: 'execution', label: '染缸执行' },
  { key: 'formula', label: '染色配方' },
  { key: 'handover', label: '交出记录' },
  { key: 'review', label: '收货确认' },
  { key: 'statistics', label: '染色统计' },
  { key: 'exception', label: '异常与结算' },
]

const consumedWebActionKeys = new Set<string>()
function renderDyeProductionChangeHistory(order: DyeWorkOrder): string {
  const impacts = order.changeImpact ?? []
  const syncs = order.autoSyncHistory ?? []
  if (!impacts.length && !syncs.length) return ''
  const records = [
    ...impacts.map(record => ({ ...record, time: record.recordedAt, label: '已执行，保留原事实', note: record.suggestedAction })),
    ...syncs.map(record => ({ ...record, time: record.syncedAt, label: '未执行，已同步', note: '已按最新生产单更新加工要求' })),
  ].sort((a, b) => b.time.localeCompare(a.time))
  return renderSection('生产单变更记录', records.map(record =>
    '<details class="border-b py-3 last:border-0"><summary class="cursor-pointer text-sm font-medium">' +
    escapeHtml(record.changeRecordId + ' · ' + record.label + ' · ' + record.time) +
    '</summary><div class="grid gap-2 pt-3 text-sm sm:grid-cols-2">' +
    renderField('数量（前 → 后）', formatDyeQty(record.before.plannedQty, record.before.qtyUnit) + ' → ' + formatDyeQty(record.after.plannedQty, record.after.qtyUnit)) +
    renderField('物料（前 → 后）', record.before.materialName + ' → ' + record.after.materialName) +
    renderField('技术包版本（前 → 后）', record.before.techPackVersionLabel + ' → ' + record.after.techPackVersionLabel) +
    renderField('处理说明', record.note) + '</div></details>'
  ).join(''))
}

function renderDyeReceiptPanel(orderId: string): string {
  const order = getDyeWorkOrderById(orderId)
  if (!order || order.status === 'COMPLETED' || order.status === 'REJECTED') return ''
  const source = getDyeMaterialReceiptOptions(orderId)
  const canNextBatch = Boolean(getDyeExecutionNodeRecord(orderId, 'PACK')?.finishedAt)
  return `<section class="rounded-lg border bg-background p-4" data-skip-page-rerender="true" data-dye-receipt-region data-order-id="${escapeHtml(orderId)}" data-receipt-id="DYE-${Date.now()}-${Math.random().toString(36).slice(2)}"><h3 class="font-medium">接收原料</h3><p class="mt-1 text-sm">累计已收 ${(order.materialReceipts ?? []).reduce((sum, item) => sum + item.qty, 0)} ${escapeHtml(order.qtyUnit)}</p>
    <a href="/fcs/craft/dyeing/pending-receipts?orderId=${encodeURIComponent(orderId)}" class="inline-block mt-3 rounded bg-primary px-3 py-2 text-primary-foreground">进入本厂待接收</a>${canNextBatch ? `<details class="mt-3"><summary>开始下一批染色</summary><label class="mt-2 block text-sm">本批投入（${escapeHtml(order.qtyUnit)}）<input data-dye-next-qty type="number" min="0" step="any" class="ml-2 h-9 rounded border px-2"></label><label class="mt-2 block text-sm">投入物料 SKU（有多个投入规格时必填）<input data-dye-next-sku class="ml-2 h-9 rounded border px-2"></label><label class="mt-2 block text-sm">染缸编号<input data-dye-next-vat class="ml-2 h-9 rounded border px-2"></label><button data-dye-next-confirm class="mt-2 rounded border px-3 py-2">开始本批染色</button></details>` : ''}<p data-dye-receipt-feedback class="mt-2 text-sm" role="status"></p></section>`
}

export function handleDyeWorkOrderReceiptDetailEvent(target: HTMLElement): boolean {
  if (target.closest('[data-dye-receipt-confirm], [data-dye-next-confirm]')) {
    const panel = target.closest<HTMLElement>('[data-dye-receipt-region]')
    const orderId = panel?.dataset.orderId || ''
    const order = getDyeWorkOrderById(orderId)
    const session = getPdaSession()
    const feedback = panel?.querySelector<HTMLElement>('[data-dye-receipt-feedback]')
    try {
      if (!order || !session) throw new Error('请先登录当前工厂操作账号。')
      const actorError = validateWaterSolublePdaActor(session, order.dyeFactoryId, 'OPERATE')
      if (actorError) throw new Error(actorError)
      if (target.closest('[data-dye-next-confirm]')) startDyeing(orderId, { inputQty: Number(panel?.querySelector<HTMLInputElement>('[data-dye-next-qty]')?.value), dyeVatNo: panel?.querySelector<HTMLInputElement>('[data-dye-next-vat]')?.value || '', materialSku: panel?.querySelector<HTMLInputElement>('[data-dye-next-sku]')?.value.trim() || undefined, operatorName: session.userName })
      else receiveDyeMaterial(orderId, { qty: Number(panel?.querySelector<HTMLInputElement>('[data-dye-receipt-qty]')?.value), receiptId: panel?.dataset.receiptId || '', upstreamRecordId: panel?.querySelector<HTMLSelectElement>('[data-dye-receipt-source]')?.value, operatorName: session.userName })
      if (panel) { panel.outerHTML = renderDyeReceiptPanel(orderId); const next = document.querySelector<HTMLElement>('[data-dye-receipt-feedback]'); if(next) next.textContent = target.closest('[data-dye-next-confirm]') ? '本批染色已开始。' : '本次接收已保存，原料已入待加工仓。' }
    } catch (error) { if (feedback) feedback.textContent = error instanceof Error ? error.message : '接收失败，请重试。' }
    return true
  }

  return false
}

function renderContinuousWaterSolubleActions(order: DyeWorkOrder): string {
  const role: WaterSolublePdaRoleAction | null = order.status === 'PRODUCTION_PAUSED'
    ? 'SUPERVISE'
    : canContinueDyeWaterSoluble(order) || order.status === 'WAIT_WATER_SOLUBLE' || order.status === 'WATER_SOLUBLE_IN_PROGRESS'
      ? 'OPERATE'
      : null
  const session = getPdaSession()
  if (!role) return ''
  if (!session || validateWaterSolublePdaActor(session, order.dyeFactoryId, role)) {
    return '<p class="mt-3 text-sm text-muted-foreground">当前账号不能执行此动作，请切换对应岗位账号。</p>'
  }
  const attrs = `data-dye-order-id="${escapeHtml(order.dyeOrderId)}" data-task-id="${escapeHtml(order.taskId)}" data-expected-status="${escapeHtml(order.status)}" data-expected-node="WATER_SOLUBLE"`
  if (order.status === 'WAIT_WATER_SOLUBLE' || canContinueDyeWaterSoluble(order)) {
    return `<button class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700" data-dyeing-action="start-water-soluble" ${attrs}>${canContinueDyeWaterSoluble(order) ? '开始下一批水溶' : '开始水溶'}</button>`
  }
  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') {
    return `<button class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700" data-dyeing-action="complete-water-soluble" ${attrs}>完成水溶</button>`
  }
  const decisions: Array<[string, string]> = [['CONTINUE_PROCESSING', '继续补做'], ['CONTINUE_WITH_ACTUAL_QTY', '按实际数量继续'], ['RETURN_FOR_REWORK', '退回返工']]
  return `<div class="mt-3 flex flex-wrap gap-2">${decisions.map(([decision, label]) => `<button class="rounded-md border px-3 py-2 text-sm" data-dyeing-action="resolve-water-soluble-pause" data-decision="${decision}" ${attrs}>${label}</button>`).join('')}</div>`
}

function getCurrentDyeDetailTab(): DyeDetailTab {
  const [, queryString = ''] = (appStore.getState().pathname || '').split('?')
  const tab = new URLSearchParams(queryString).get('tab')
  return dyeDetailTabs.some((item) => item.key === tab) ? (tab as DyeDetailTab) : 'base'
}

function renderDetailTabs(orderId: string, activeTab: DyeDetailTab): string {
  const baseHref = `/fcs/craft/dyeing/work-orders/${encodeURIComponent(orderId)}`
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
  const order = getProcessWorkOrderById(orderId)
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
                        data-dyeing-action="open-web-status-action-dialog"
                        data-source-id="${escapeHtml(orderId)}"
                        data-action-code="${escapeHtml(action.actionCode)}"
                        data-action-label="${escapeHtml(action.actionLabel)}"
                        data-from-status="${escapeHtml(action.fromStatus)}"
                        data-to-status="${escapeHtml(action.toStatus)}"
                        data-required-fields="${escapeHtml(action.requiredFields.join('|'))}"
                        data-optional-fields="${escapeHtml(action.optionalFields.join('|'))}"
                        data-confirm-text="${escapeHtml(action.confirmText)}"
                        data-object-type="${escapeHtml(order?.objectType || '面料')}"
                        data-object-qty="${escapeHtml(String(order?.plannedQty ?? ''))}"
                        data-qty-unit="${escapeHtml(order?.plannedUnit || '米')}"
                      >
                        ${escapeHtml(action.actionLabel)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
              `
            : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`
        }
      </div>
    `,
  )
}

function renderWebOperationRecords(records: ProcessWebOperationRecord[]): string {
  return renderSection(
    '操作记录',
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
                : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无操作记录</td></tr>'
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
            <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '已完成', 'DYE_FINISH_DYEING'))}</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无执行记录</td></tr>'}</tbody>
      </table>
    </div>
  `
}

function renderReviewStatusLabel(status: unknown): string {
  if (status === 'FULL_HANDOVER') return '全部交出'
  if (status === 'PARTIAL_HANDOVER') return '部分交出'
  if (status === 'HANDOVER_DIFFERENCE') return '收货差异'
  if (status === 'WAIT_RECEIVE' || status === 'HANDOVER_WAIT_RECEIVE') return '交出待收货'
  return '—'
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
  const baseHref = `/fcs/craft/dyeing/work-orders/${encodeURIComponent(orderId)}?tab=exception`
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
  const order = getProcessWorkOrderById(dyeOrderId) || getProcessWorkOrderByNo(dyeOrderId)
  if (!order || order.processType !== 'DYE' || !order.dyePayload) {
    const domainOrder = getDyeWorkOrderById(dyeOrderId)
    if (domainOrder) {
      const waterNode = listDyeExecutionNodeRecords(domainOrder.dyeOrderId).find((node) => node.nodeCode === 'WATER_SOLUBLE')
      const planned = domainOrder.waterSolublePlannedQty ?? domainOrder.plannedQty
      const completed = domainOrder.waterSolubleCompletedQty ?? Number(waterNode?.outputQty || 0)
      const unit = domainOrder.waterSolubleQtyUnit || domainOrder.qtyUnit
      const diff = completed - planned
      return `
        <div class="space-y-4 p-4">
          ${renderPageHeader('染色加工单详情', domainOrder.requiresWaterSoluble ? '同一染厂连续完成水溶与染色' : '普通染色加工单')}
          ${renderProcessOrderTaskRelations(domainOrder.dyeOrderId)}
          ${renderDyeReceiptPanel(domainOrder.dyeOrderId)}
          ${renderSection('基本信息', `<div class="grid gap-3 text-sm md:grid-cols-2">
            ${renderField('加工单号', domainOrder.dyeOrderNo)}
            ${renderField('工厂', formatFactoryDisplayName(domainOrder.dyeFactoryName, domainOrder.dyeFactoryId))}
            ${renderField('当前步骤', getDyeCurrentStepLabel(domainOrder))}
            ${renderField('工艺路线', domainOrder.requiresWaterSoluble ? '水溶 → 染色 → 既有后处理' : '染色 → 既有后处理')}
            ${renderField('计划染色数量', `${domainOrder.plannedQty} ${domainOrder.qtyUnit}`)}
            ${renderField('交接口径', domainOrder.requiresWaterSoluble ? '水溶完成后不交出，染色及后处理完成后统一交出' : '后处理完成后统一交出')}
          </div>`)}
          ${domainOrder.requiresWaterSoluble ? renderSection('水溶前置', `<div class="grid gap-3 text-sm md:grid-cols-2">
            ${renderField('水溶计划数量', `${planned} ${unit}`)}
            ${renderField('水溶完成数量', `${completed} ${unit}`)}
            ${renderField('水溶差异', `${diff > 0 ? '多' : diff < 0 ? '少' : '一致'}${diff === 0 ? '' : ` ${Math.abs(diff)} ${unit}`}`)}
            ${renderField('连续加工', '同一家染厂完成，水溶完成数量为染色投入上限')}
          </div>${renderContinuousWaterSolubleActions(domainOrder)}`) : ''}
          ${renderDyeProductionChangeHistory(domainOrder)}
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
        </div>
      `
    }
    return `
      <div class="space-y-4 p-4">
        ${renderPageHeader('染色加工单详情', '未找到对应的染色加工单')}
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/dyeing/work-orders">返回染色加工单</button>
      </div>
    `
  }

  const dye = order.dyePayload
  const domainOrder = getDyeWorkOrderById(dye.dyeOrderId)
  const sampleNode = order.executionNodes.find((node) => node.nodeName === '打样')
  const materialNode = order.executionNodes.find((node) => node.nodeName === '投入接收')
  const vatNode = order.executionNodes.find((node) => node.nodeName.includes('排'))
  const dyeNode = order.executionNodes.find((node) => node.nodeName === '染色')
  const waterNode = order.executionNodes.find((node) => node.nodeName === '水溶')
  const afterNodes = order.executionNodes.filter((node) => ['脱水', '烘干', '定型', '打卷', '包装'].includes(node.nodeName))
  const quantityFact=getDyeingQuantityFacts().find(f=>f.order.dyeOrderId===order.workOrderId)
  const processHandoverRecords=(quantityFact?.records??[]).map(r=>({handoverRecordId:r.recordId,handoverRecordNo:r.handoverRecordNo,handoverAt:r.factorySubmittedAt,handoverObjectQty:r.submittedQty??0,receiveObjectQty:r.receiverWrittenQty,qtyUnit:order.plannedUnit,receiveAt:r.receiverWrittenAt,remark:r.receiverWrittenAt?'下游已登记实际接收':'等待下游登记实收',status:r.status}))
  const processReviewRecords=(quantityFact?.actual??[]).map(r=>({reviewStatus:Math.abs((r.receiverWrittenQty??0)-(r.submittedQty??0))>.000001?'HANDOVER_DIFFERENCE':'FULL_HANDOVER',expectedObjectQty:r.submittedQty??0,actualObjectQty:r.receiverWrittenQty??0,diffObjectQty:(r.receiverWrittenQty??0)-(r.submittedQty??0),qtyUnit:order.plannedUnit,reviewerName:r.receiverWrittenBy,reviewedAt:r.receiverWrittenAt,reason:r.receiverRemark,nextAction:'按实际接收记录核对'}))
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
        <td class="px-3 py-3 text-sm">${record.receiveObjectQty===undefined?'待登记实收':formatDyeQty(record.receiveObjectQty, record.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.receiveAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || record.status || '—')}</td>
      </tr>
    `)
    .join('')
  const reviewRows = processReviewRecords
    .map((review) => `
      <tr class="border-b last:border-b-0">
        <td class="px-3 py-3 text-sm">${escapeHtml(renderReviewStatusLabel(review.reviewStatus))}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.expectedObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.actualObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatDyeQty(review.diffObjectQty, review.qtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewerName || '待收货确认')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reviewedAt || '—')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(review.reason || review.nextAction || '—')}</td>
      </tr>
    `)
    .join('')

  const activeTab = getCurrentDyeDetailTab()
  const afterNodeText = afterNodes
    .map((node) => `${node.nodeName}：${formatDyeTime(node.startedAt)} 至 ${formatDyeTime(node.finishedAt)}，${node.operatorName || '—'}，${formatDyeQty('outputQty' in node ? node.outputQty : undefined, order.plannedUnit)}`)
    .join('；') || '—'
  const mobileBinding = validateDyeWorkOrderMobileTaskBinding(dye.dyeOrderId || order.workOrderId)
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
            keyword: order.workOrderNo || dye.dyeOrderNo,
          }),
          sourceType: 'DYE_WORK_ORDER',
          sourceId: dye.dyeOrderId || order.workOrderId,
          currentFactoryId: order.factoryId || 'F090',
          keyword: order.workOrderNo || dye.dyeOrderNo,
        })
      : ''
  const webActions = getAvailableDyeWebActions(order.workOrderId)
  const webOperationRecords = getUnifiedOperationRecordsForProcessWorkOrder('DYE_WORK_ORDER', order.workOrderId, order.taskId)
  const platformStatus = getPlatformStatusForProcessWorkOrder(order)
  const startPrerequisite = getStartPrerequisiteByTaskId(order.taskId)
  const sections: Record<DyeDetailTab, string> = {
    base: renderSection(
      '基本信息',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          ${renderField('加工单号', order.workOrderNo)}
          ${renderSourceFields(order)}
          ${renderField('工厂', formatFactoryDisplayName(order.factoryName, order.factoryId))}
          ${renderField('分配方式', order.assignmentMode || '派单')}
          ${renderField('派单价格', order.dispatchPriceDisplay || '1500 IDR/Yard')}
          ${renderField('染色原料 SKU', dye.rawMaterialSku)}
          ${renderField('成分', dye.composition || '—')}
          ${renderField('幅宽', dye.width || '—')}
          ${renderField('克重', dye.weightGsm ? `${dye.weightGsm} 克/平方米` : '—')}
          ${renderField('目标颜色', dye.targetColor)}
          ${renderField(order.qtyLabel || dyeQuantityLabel(order, '计划'), `${order.plannedQty} ${order.plannedUnit}`)}
          <div><span class="text-muted-foreground">当前状态：</span>${renderBadge(order.statusLabel, 'info')}</div>
          ${renderField('首单/翻单', dye.isFirstOrder ? '首单' : '翻单')}
          ${renderField('移动端执行任务引用', `${order.taskNo} / ${order.taskId}`)}
          ${renderField('移动端执行任务号', mobileBindingTaskNo)}
          ${renderField('绑定状态', mobileBindingStatus)}
          ${renderField('校验结果', mobileBinding.canOpenMobileExecution ? '允许打开移动端执行页' : '当前不可执行')}
          ${renderField('不可执行原因', mobileBindingReasonLabel)}
          ${renderField('开工准备状态', startPrerequisite?.statusLabel || '按加工单状态判断')}
          ${renderField('开工前置口径', startPrerequisite?.conditionLabel || '染色加工单已接单')}
          ${renderField('实际染色前要求', '必须确认染色原料和染化料到位')}
          ${domainOrder?.requiresWaterSoluble ? renderField('工艺路线', '水溶 → 染色 → 既有后处理（同厂连续加工）') : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('中间交出', '无；完成染色及后处理后统一交出') : ''}
          ${renderField('移动端交出记录引用', order.handoverOrderNo || order.handoverOrderId || '未生成')}
        </div>
      `,
    ),
    sample: renderSection(
      '打样与接收',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('是否等待样衣', dye.sampleWaitType === 'NONE' ? '否' : '是')}
          ${renderField('是否等待原料', order.status === 'WAIT_MATERIAL' ? '是' : '否')}
          ${renderField('打样开始时间', formatDyeTime(sampleNode?.startedAt))}
          ${renderField('打样完成时间', formatDyeTime(sampleNode?.finishedAt))}
          ${renderField('色号', dye.colorNo || '待确认')}
          ${renderField('投入接收时间', formatDyeTime(materialNode?.finishedAt))}
          ${renderField('接收记录', materialNode?.remark || '—')}
        </div>
      `,
    ),
    execution: renderSection(
      '染缸执行',
      `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          ${renderField('染缸号', vatNode && 'dyeVatNo' in vatNode ? String(vatNode.dyeVatNo || '—') : '—')}
          ${renderField('排缸时间', formatDyeTime(vatNode?.finishedAt))}
          ${renderField('染色开始时间', formatDyeTime(dyeNode?.startedAt))}
          ${renderField('染色完成时间', formatDyeTime(dyeNode?.finishedAt))}
          ${renderField('脱水/烘干/定型/打卷/包装', afterNodeText)}
          ${renderField(dyeQuantityLabel(order, '已完成', 'DYE_FINISH_DYEING'), formatDyeQty('outputQty' in (dyeNode || {}) ? dyeNode?.outputQty : undefined, order.plannedUnit))}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶计划数量', formatDyeQty(domainOrder.waterSolublePlannedQty, domainOrder.waterSolubleQtyUnit || order.plannedUnit)) : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶完成数量', formatDyeQty(domainOrder.waterSolubleCompletedQty, domainOrder.waterSolubleQtyUnit || order.plannedUnit)) : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶差异', `${(domainOrder.waterSolubleCompletedQty || 0) - (domainOrder.waterSolublePlannedQty || domainOrder.plannedQty)} ${domainOrder.waterSolubleQtyUnit || order.plannedUnit}`) : ''}
          ${domainOrder?.requiresWaterSoluble ? renderField('水溶执行记录', waterNode ? `${formatDyeTime(waterNode.startedAt)} 至 ${formatDyeTime(waterNode.finishedAt)}` : '待执行') : ''}
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
      '交出记录',
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
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '已交出', 'DYE_SUBMIT_HANDOVER'))}</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '实收'))}</th>
                <th class="px-3 py-2 font-medium">收货时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${handoverRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="6">暂无交出记录</td></tr>'}</tbody>
          </table>
        </div>
      `,
    ),
    review: renderSection(
      '收货确认',
      `
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">收货状态</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '已交出', 'DYE_SUBMIT_HANDOVER'))}</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '实收'))}</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '差异'))}</th>
                <th class="px-3 py-2 font-medium">收货确认人</th>
                <th class="px-3 py-2 font-medium">收货确认时间</th>
                <th class="px-3 py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>${reviewRows || '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="7">暂无收货确认记录</td></tr>'}</tbody>
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
            <div class="text-xs text-muted-foreground">${escapeHtml(dyeQuantityLabel(order, '已交出', 'DYE_SUBMIT_HANDOVER'))}</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(quantityFact?.handed??0, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(dyeQuantityLabel(order, '实收'))}</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(quantityFact?.downstreamReceived??0, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(dyeQuantityLabel(order, '已完成', 'DYE_FINISH_DYEING'))}</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(quantityFact?.dyed??0, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(dyeQuantityLabel(order, '已完成', 'DYE_FINISH_PACKING'))}</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(quantityFact?.packed??0, order.plannedUnit)}</div>
          </div>
          <div class="rounded-xl border bg-slate-50/60 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(dyeQuantityLabel(order, '差异'))}</div>
            <div class="mt-1 text-lg font-semibold">${formatDyeQty(quantityFact?.difference??0, order.plannedUnit)}</div>
          </div>
        </div>
        ${renderNodeTable(order.workOrderId)}
      `,
    ),
    exception: renderSection(
      '染色交出差异处理',
      `
        <p class="mb-3 text-sm text-muted-foreground">染色交出差异只写入统一差异记录；本次不直接生成返工扣款流水、对账流水或结算流水。</p>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">差异记录</th>
                <th class="px-3 py-2 font-medium">差异类型</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '已交出', 'DYE_SUBMIT_HANDOVER'))}</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '实收'))}</th>
                <th class="px-3 py-2 font-medium">${escapeHtml(dyeQuantityLabel(order, '差异'))}</th>
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

      ${renderProcessOrderTaskRelations(order.workOrderId)}
      ${renderDyeReceiptPanel(order.workOrderId)}
      ${renderDetailTabs(order.workOrderId, activeTab)}
      ${renderWebActionPanel(order.workOrderId, order.statusLabel, webActions, platformStatus.platformStatusLabel)}
      ${sections[activeTab]}
      ${domainOrder ? renderDyeProductionChangeHistory(domainOrder) : ''}
      ${renderWebOperationRecords(webOperationRecords)}
    </div>
  `
}
