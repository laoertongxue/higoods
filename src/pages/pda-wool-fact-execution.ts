import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  completeWoolWorkOrder,
  getWoolAllowedActions,
  type WoolAllowedAction,
  type WoolWorkOrder,
} from '../data/fcs/wool-task-domain.ts'
import {
  buildWoolMobileTaskProjection,
  type WoolMobileCompletionFacts,
  type WoolMobileFactRecord,
  type WoolMobileTaskProjection,
} from '../data/fcs/wool-domain/mobile.ts'
import {
  validateWoolPdaTaskAccess,
  type WoolPdaTaskAccessResult,
} from '../data/fcs/wool-pda-task-access.ts'
import { getPdaSession } from '../data/fcs/store-domain-pda.ts'
import { escapeHtml } from '../utils.ts'

type WoolFactAction = Extract<
  WoolAllowedAction,
  'RECEIVE_YARN' | 'REPORT_PROCESS' | 'HANDOVER' | 'COMPLETE'
>
type CompletionSection = keyof WoolMobileCompletionFacts

interface WoolActionDraft {
  selectedYarnSkus: string[]
  quantities: Record<string, string>
  differenceNotes: Record<string, string>
  outputSkuCode: string
  qty: string
  deliveryNo: string
  batchNo: string
  proofText: string
  remark: string
  completionPages: Partial<Record<CompletionSection, number>>
}

const ACTION_LABELS: Record<WoolFactAction, string> = {
  RECEIVE_YARN: '确认接收',
  REPORT_PROCESS: '加工填报',
  HANDOVER: '发起交出',
  COMPLETE: '完成加工单',
}

const FACT_LABELS: Record<WoolMobileFactRecord['recordType'], string> = {
  YARN_RECEIPT: '确认接收',
  PROCESS_REPORT: '加工填报',
  HANDOVER: '发起交出',
  QTY_CHANGE: '数量修改',
  WAREHOUSE_FLOW: '库存流水',
}

const state: {
  taskId: string
  userId: string
  overlay: null | { action: WoolFactAction; woolOrderId: string; commandId: string }
  draftsByAction: Partial<Record<WoolFactAction, WoolActionDraft>>
  factPage: number
  error: string
  feedback: string
} = {
  taskId: '',
  userId: '',
  overlay: null,
  draftsByAction: {},
  factPage: 1,
  error: '',
  feedback: '',
}

let commandSequence = 0

export function resetPdaWoolExecutionState(): void {
  state.taskId = ''
  state.userId = ''
  state.overlay = null
  state.draftsByAction = {}
  state.factPage = 1
  state.error = ''
  state.feedback = ''
}

export function capturePdaWoolExecutionStateForDiagnostics(): {
  taskId: string
  userId: string
  overlayAction: WoolFactAction | null
  commandId: string
  draftActions: WoolFactAction[]
} {
  return {
    taskId: state.taskId,
    userId: state.userId,
    overlayAction: state.overlay?.action || null,
    commandId: state.overlay?.commandId || '',
    draftActions: Object.keys(state.draftsByAction) as WoolFactAction[],
  }
}

function syncTask(taskId: string, userId: string): void {
  if (state.taskId === taskId && state.userId === userId) return
  state.taskId = taskId
  state.userId = userId
  state.overlay = null
  state.draftsByAction = {}
  state.factPage = 1
  state.error = ''
  state.feedback = ''
}

if (typeof window !== 'undefined') {
  window.addEventListener('higood:pda-wool-exec-leave', resetPdaWoolExecutionState)
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function nextCommandId(action: WoolFactAction, woolOrderId: string): string {
  commandSequence += 1
  return `PDA-${action}-${woolOrderId}-${Date.now()}-${commandSequence}`
}

function getCurrentAccess(taskId: string, woolOrderId?: string): WoolPdaTaskAccessResult {
  const session = getPdaSession()
  return validateWoolPdaTaskAccess({
    taskId,
    woolOrderId,
    currentFactoryId: session?.factoryId,
  })
}

function renderAccessBlocked(access: WoolPdaTaskAccessResult): string {
  return `
    <div class="space-y-3 p-4" data-pda-wool-access-blocked>
      <button type="button" class="text-sm text-muted-foreground" data-pda-execd-action="back">← 返回</button>
      <section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <h2 class="font-semibold">当前任务不可操作</h2>
        <p class="mt-2">${escapeHtml(access.reasonLabel)}</p>
        <p class="mt-2 text-xs">页面已进入只读阻断状态，不会执行确认接收、加工填报、发起交出或完成加工单。</p>
      </section>
    </div>
  `
}

function outputLabel(order: WoolWorkOrder, outputSkuCode: string): string {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  return line
    ? [outputSkuCode, line.colorName, line.sizeCode, line.woolPartName].filter(Boolean).join(' / ')
    : outputSkuCode
}

function safeStyleImageUrl(value?: string): string {
  const url = value?.trim() || ''
  return /^(?:https?:\/\/|\/|data:image\/)/i.test(url) ? url : ''
}

function emptyDraft(outputSkuCode = ''): WoolActionDraft {
  return {
    selectedYarnSkus: [],
    quantities: {},
    differenceNotes: {},
    outputSkuCode,
    qty: '',
    deliveryNo: '',
    batchNo: '',
    proofText: '',
    remark: '',
    completionPages: {},
  }
}

function draftFor(action: WoolFactAction, projection: WoolMobileTaskProjection): WoolActionDraft {
  const existing = state.draftsByAction[action]
  if (existing) return existing
  const outputSkuCode = action === 'REPORT_PROCESS'
    ? projection.readyOutputSkuCodes[0] || ''
    : action === 'HANDOVER'
      ? projection.completionFacts.waitHandoverStocks.find((item) => item.availableHandoverQty > 0)?.outputSkuCode || ''
      : ''
  const draft = emptyDraft(outputSkuCode)
  state.draftsByAction[action] = draft
  return draft
}

function parseProofFiles(value: string): string[] {
  return [...new Set(value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean))]
}

function primaryAction(actions: WoolAllowedAction[]): WoolFactAction | null {
  for (const action of ['COMPLETE', 'HANDOVER', 'REPORT_PROCESS', 'RECEIVE_YARN'] as const) {
    if (actions.includes(action)) return action
  }
  return null
}

function renderStyleIdentity(order: WoolWorkOrder): string {
  const imageUrl = safeStyleImageUrl(order.styleImageUrl)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex gap-3">
        ${imageUrl
          ? `<img class="h-24 w-24 shrink-0 rounded-lg border object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${order.styleName}款式图片`)}">`
          : '<div class="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">暂无款式图片</div>'}
        <div class="min-w-0 flex-1 space-y-1 text-sm">
          <div class="font-semibold">${escapeHtml(order.woolOrderNo)}</div>
          <div>款号：${escapeHtml(order.styleNo)}</div>
          <div>款名：${escapeHtml(order.styleName)}</div>
          <div>内部货号：${escapeHtml(order.internalStyleCode || '—')}</div>
          <div class="text-xs text-muted-foreground">生产单：${escapeHtml(order.productionOrderNo)}</div>
        </div>
      </div>
    </section>
  `
}

function renderOutputReadiness(order: WoolWorkOrder, projection: WoolMobileTaskProjection): string {
  const summaries = new Map(projection.completionFacts.processReports.map((item) => [item.outputSkuCode, item]))
  return order.outputPlanLines.map((line) => {
    const ready = projection.readyOutputSkuCodes.includes(line.outputSkuCode)
    const confirmed = line.requiredYarnSkus.filter((sku) => projection.confirmedYarnSkus.includes(sku))
    const missing = line.requiredYarnSkus.filter((sku) => !projection.confirmedYarnSkus.includes(sku))
    const summary = summaries.get(line.outputSkuCode)
    return `
      <article class="rounded-lg border p-3 text-sm">
        <div class="font-medium">${escapeHtml(outputLabel(order, line.outputSkuCode))}</div>
        <div class="mt-2 text-xs ${ready ? 'text-emerald-700' : 'text-amber-700'}">
          ${projection.processingStatus === 'COMPLETED'
            ? '加工单已完成，仅可查看'
            : ready
              ? `可填报；累计有效填报 ${summary?.effectiveReportedQty || 0}${line.qtyUnit} / 上限 ${summary?.reportLimitQty || 0}${line.qtyUnit}`
              : missing.length
                ? `缺少任一必需纱线时不可填报：${escapeHtml(missing.join('、'))}`
                : '已达到计划数量的 150%'}
        </div>
        <div class="mt-1 text-xs text-muted-foreground">
          必需纱线：${escapeHtml(line.requiredYarnSkus.join('、') || '未配置')}；
          已确认接收：${escapeHtml(confirmed.join('、') || '无')}
        </div>
      </article>
    `
  }).join('')
}

function renderQtyChanges(record: WoolMobileFactRecord): string {
  if (!record.qtyChanges.length) return ''
  return `<details class="mt-2"><summary class="cursor-pointer text-muted-foreground">数量修改历史（${record.qtyChanges.length}）</summary><div class="mt-1 space-y-1">${record.qtyChanges.map((change) => `
    <div>${change.beforeQty} → ${change.afterQty}${escapeHtml(change.qtyUnit)}；${escapeHtml(change.reason)}；${escapeHtml(change.changedBy)}；${escapeHtml(change.changedAt)}</div>
  `).join('')}</div></details>`
}

function renderFactList(projection: WoolMobileTaskProjection, expanded = false): string {
  const pageSize = 5
  const total = projection.factRecords.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  state.factPage = Math.min(Math.max(state.factPage, 1), totalPages)
  const records = projection.factRecords.slice((state.factPage - 1) * pageSize, state.factPage * pageSize)
  return `
    <div data-pda-wool-fact-list-root>
    <details class="rounded-lg border bg-card" ${expanded ? 'open' : ''}>
      <summary class="cursor-pointer px-4 py-3 text-sm font-medium">查看完整事实记录（${total}）</summary>
      <div class="border-t p-3">
        <div class="space-y-2">${records.map((record) => `
          <article class="rounded border px-3 py-2 text-xs">
            <div class="font-medium">${FACT_LABELS[record.recordType]}｜${escapeHtml(record.objectSkuCode)}</div>
            <div class="mt-1">原始数量：${record.originalQty ?? '—'}${escapeHtml(record.qtyUnit)}；有效数量：${record.effectiveQty ?? '—'}${escapeHtml(record.qtyUnit)}</div>
            <div class="mt-1">记录：${escapeHtml(record.recordId)}${record.recordLineId ? ` / ${escapeHtml(record.recordLineId)}` : ''}</div>
            ${record.batchNo || record.deliveryNo ? `<div class="mt-1">批次：${escapeHtml(record.batchNo || '—')}；送货单：${escapeHtml(record.deliveryNo || '—')}</div>` : ''}
            ${record.receiverName ? `<div class="mt-1">接收方：${escapeHtml(record.receiverName)}；下游实收：${record.downstreamActualReceivedQty ?? '待确认'}；差异：${record.downstreamDifferenceQty ?? '—'}；时间：${escapeHtml(record.downstreamReceivedAt || '待确认')}</div>` : ''}
            ${record.differenceNote ? `<div class="mt-1">差异说明：${escapeHtml(record.differenceNote)}</div>` : ''}
            ${record.proofFiles.length ? `<div class="mt-1">凭证：${record.proofFiles.map(escapeHtml).join('、')}</div>` : ''}
            ${record.remark ? `<div class="mt-1">备注：${escapeHtml(record.remark)}</div>` : ''}
            ${record.warehouseFlowIds.length ? `<div class="mt-1">库存流水：${record.warehouseFlowIds.map(escapeHtml).join('、')}</div>` : ''}
            ${renderQtyChanges(record)}
            <div class="mt-1 text-muted-foreground">${escapeHtml(record.operatedBy)}｜${escapeHtml(record.occurredAt)}</div>
          </article>
        `).join('') || '<div class="text-xs text-muted-foreground">暂无记录</div>'}</div>
        <div class="mt-3 flex items-center justify-between text-xs">
          <button type="button" class="rounded border px-3 py-1 disabled:opacity-50" data-pda-wool-action="fact-page" data-skip-page-rerender="true" data-page="${state.factPage - 1}" ${state.factPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span>第 ${state.factPage} / ${totalPages} 页，每页 ${pageSize} 条，共 ${total} 条</span>
          <button type="button" class="rounded border px-3 py-1 disabled:opacity-50" data-pda-wool-action="fact-page" data-skip-page-rerender="true" data-page="${state.factPage + 1}" ${state.factPage >= totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </div>
    </details></div>
  `
}

function draftAttrs(field: string, objectSkuCode?: string): string {
  return `data-pda-wool-draft="sync-draft" data-skip-page-rerender="true" data-draft-field="${field}"${objectSkuCode ? ` data-object-sku="${escapeHtml(objectSkuCode)}"` : ''}`
}

function renderReceiptDialog(order: WoolWorkOrder, projection: WoolMobileTaskProjection, draft: WoolActionDraft): string {
  const yarns = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))]
  const totals = new Map(projection.completionFacts.yarnReceipts.map((item) => [item.yarnSkuCode, item.effectiveReceivedQty]))
  return `<div class="space-y-3 p-4">
    <div class="text-sm font-medium">本次实际收到哪些纱线？</div>
    ${yarns.map((sku) => `<div class="rounded border p-3 text-sm">
      <label class="flex items-center gap-2"><input type="checkbox" ${draftAttrs('selectedYarnSkus', sku)} ${draft.selectedYarnSkus.includes(sku) ? 'checked' : ''}><span>${escapeHtml(sku)}｜累计有效接收 ${totals.get(sku) || 0}kg</span></label>
      <input type="number" min="0.01" step="0.01" class="mt-2 h-9 w-full rounded border px-2" placeholder="本次 kg" ${draftAttrs('quantities', sku)} value="${escapeHtml(draft.quantities[sku] || '')}">
      <input class="mt-2 h-9 w-full rounded border px-2" placeholder="差异说明（可选）" ${draftAttrs('differenceNotes', sku)} value="${escapeHtml(draft.differenceNotes[sku] || '')}">
    </div>`).join('')}
    <input class="h-9 w-full rounded border px-3 text-sm" placeholder="送货单号（可选）" ${draftAttrs('deliveryNo')} value="${escapeHtml(draft.deliveryNo)}">
    <input class="h-9 w-full rounded border px-3 text-sm" placeholder="批次号（可选）" ${draftAttrs('batchNo')} value="${escapeHtml(draft.batchNo)}">
    <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="凭证文件名或地址，逗号/换行分隔" ${draftAttrs('proofText')}>${escapeHtml(draft.proofText)}</textarea>
    <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="备注（可选）" ${draftAttrs('remark')}>${escapeHtml(draft.remark)}</textarea>
  </div>`
}

function renderQtyDialog(
  order: WoolWorkOrder,
  projection: WoolMobileTaskProjection,
  draft: WoolActionDraft,
  action: 'REPORT_PROCESS' | 'HANDOVER',
): string {
  const candidates = action === 'REPORT_PROCESS'
    ? order.outputPlanLines.filter((line) => projection.readyOutputSkuCodes.includes(line.outputSkuCode))
    : order.outputPlanLines.filter((line) =>
      (projection.completionFacts.waitHandoverStocks.find((item) =>
        item.outputSkuCode === line.outputSkuCode)?.availableHandoverQty || 0) > 0)
  if (!candidates.some((line) => line.outputSkuCode === draft.outputSkuCode)) {
    draft.outputSkuCode = candidates[0]?.outputSkuCode || ''
  }
  const summary = (sku: string): string => {
    if (action === 'REPORT_PROCESS') {
      const item = projection.completionFacts.processReports.find((entry) => entry.outputSkuCode === sku)
      return `累计 ${item?.effectiveReportedQty || 0} / 上限 ${item?.reportLimitQty || 0}`
    }
    const item = projection.completionFacts.waitHandoverStocks.find((entry) => entry.outputSkuCode === sku)
    return `可交余额 ${item?.availableHandoverQty || 0}${item?.qtyUnit || ''}（默认库位库存 ${item?.effectiveStockQty || 0}${item?.qtyUnit || ''}）`
  }
  const selectedAvailability = projection.completionFacts.waitHandoverStocks.find((item) =>
    item.outputSkuCode === draft.outputSkuCode)
  return `<div class="space-y-3 p-4">
    <label class="block text-sm">${action === 'REPORT_PROCESS' ? '加工后 SKU' : '交出 SKU'}
      <select class="mt-1 h-10 w-full rounded border px-3" ${draftAttrs('outputSkuCode')} ${candidates.length ? '' : 'disabled'}>${candidates.map((line) => `<option value="${escapeHtml(line.outputSkuCode)}" ${line.outputSkuCode === draft.outputSkuCode ? 'selected' : ''}>${escapeHtml(outputLabel(order, line.outputSkuCode))}｜${escapeHtml(summary(line.outputSkuCode))}</option>`).join('')}</select>
    </label>
    ${candidates.length ? '' : '<div class="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">当前没有可交出的 SKU。请返回核对有效加工填报、累计有效交出和默认库位库存。</div>'}
    <label class="block text-sm">本次数量<input type="number" min="1" ${action === 'HANDOVER' ? `max="${selectedAvailability?.availableHandoverQty || 0}"` : ''} step="1" class="mt-1 h-10 w-full rounded border px-3" ${draftAttrs('qty')} value="${escapeHtml(draft.qty)}" ${candidates.length ? '' : 'disabled'}></label>
    ${action === 'HANDOVER' ? `<div class="rounded border bg-muted/30 p-3 text-sm">接收方：${escapeHtml(order.downstreamTarget.receiverName || '交出去向未配置')}</div>` : ''}
    <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="凭证文件名或地址，逗号/换行分隔" ${draftAttrs('proofText')}>${escapeHtml(draft.proofText)}</textarea>
    <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="备注（可选）" ${draftAttrs('remark')}>${escapeHtml(draft.remark)}</textarea>
  </div>`
}

function pagedSection(
  key: CompletionSection,
  title: string,
  rows: string[],
  draft: WoolActionDraft,
): string {
  const pageSize = 2
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(Math.max(draft.completionPages[key] || 1, 1), totalPages)
  const visible = rows.slice((page - 1) * pageSize, page * pageSize)
  return `<section class="rounded border p-3" data-completion-section="${key}">
    <div class="font-medium">${title}</div>
    <div class="mt-2 space-y-1 text-xs">${visible.join('') || '<div>暂无有效记录</div>'}</div>
    ${rows.length > pageSize ? `<div class="mt-2 flex items-center justify-between text-xs"><button type="button" class="rounded border px-2 py-1 disabled:opacity-50" data-pda-wool-action="completion-page" data-skip-page-rerender="true" data-section="${key}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button><span>${page}/${totalPages}，共 ${rows.length} 条</span><button type="button" class="rounded border px-2 py-1 disabled:opacity-50" data-pda-wool-action="completion-page" data-skip-page-rerender="true" data-section="${key}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>下一页</button></div>` : ''}
  </section>`
}

const COMPLETION_SECTION_KEYS: CompletionSection[] = [
  'yarnReceipts',
  'processReports',
  'handovers',
  'waitHandoverStocks',
  'currentMachines',
]

function renderCompletionFactSection(
  facts: WoolMobileTaskProjection['completionFacts'],
  key: CompletionSection,
  draft: WoolActionDraft,
): string {
  if (key === 'yarnReceipts') {
    return pagedSection(key, '1. 确认接收的纱线', facts.yarnReceipts.map((item) => `<div>${escapeHtml(item.yarnSkuCode)}：有效 ${item.effectiveReceivedQty}${item.qtyUnit}；批次 ${escapeHtml(item.batchNos.join('、') || '无')}；最近接收 ${escapeHtml(item.latestReceivedAt || '无')}</div>`), draft)
  }
  if (key === 'processReports') {
    return pagedSection(key, '2. 加工填报', facts.processReports.map((item) => `<div>${escapeHtml(item.outputSkuCode)}：计划 ${item.plannedQty}；150% 上限 ${item.reportLimitQty}；有效填报 ${item.effectiveReportedQty}；与计划差异 ${item.differenceFromPlanQty}${item.qtyUnit}</div>`), draft)
  }
  if (key === 'handovers') {
    return pagedSection(key, '3. 发起交出', facts.handovers.map((item) => `<div>${escapeHtml(item.handoverId)} / ${escapeHtml(item.outputSkuCode)}：有效 ${item.effectiveQty}${item.qtyUnit}；接收方 ${escapeHtml(item.receiverName)}；下游实收 ${item.downstreamActualReceivedQty ?? '待确认'}；差异 ${item.downstreamDifferenceQty ?? '—'}；时间 ${escapeHtml(item.downstreamReceivedAt || '待确认')}</div>`), draft)
  }
  if (key === 'waitHandoverStocks') {
    return pagedSection(key, '4. 待交出仓库存', facts.waitHandoverStocks.map((item) => `<div>${escapeHtml(item.outputSkuCode)}：${item.outputObjectType === 'GARMENT' ? '成衣' : '裁片'}；固定库位 ${escapeHtml(item.defaultLocationId)}；有效余额 ${item.effectiveStockQty}${item.qtyUnit}</div>`), draft)
  }
  return pagedSection(key, '5. 当前横机关联', facts.currentMachines.map((item) => `<div>${escapeHtml(item.machineNo)} / ${escapeHtml(item.machineName)}；关联时间 ${escapeHtml(item.associatedAt)}</div>`), draft)
}

function renderCompleteDialog(projection: WoolMobileTaskProjection, draft: WoolActionDraft): string {
  const facts = projection.completionFacts
  return `<div class="space-y-3 p-4 text-sm">
    <div class="rounded border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">系统只展示当前事实，不判断是否应该完成。请业务人员自行核对并确认。</div>
    ${COMPLETION_SECTION_KEYS.map((key) => renderCompletionFactSection(facts, key, draft)).join('')}
    <div class="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">确认完成后，系统会自动解除该加工单当前关联的全部横机。</div>
    <textarea class="min-h-16 w-full rounded border p-3 text-sm" placeholder="完成备注（可选）" ${draftAttrs('remark')}>${escapeHtml(draft.remark)}</textarea>
  </div>`
}

function renderOverlay(order: WoolWorkOrder, projection: WoolMobileTaskProjection): string {
  if (!state.overlay || state.overlay.woolOrderId !== order.woolOrderId) return ''
  const action = state.overlay.action
  const draft = draftFor(action, projection)
  const canSubmit = action !== 'HANDOVER'
    || projection.completionFacts.waitHandoverStocks.some((item) => item.availableHandoverQty > 0)
  const body = action === 'RECEIVE_YARN'
    ? renderReceiptDialog(order, projection, draft)
    : action === 'REPORT_PROCESS' || action === 'HANDOVER'
      ? renderQtyDialog(order, projection, draft, action)
      : renderCompleteDialog(projection, draft)
  return `<div class="fixed inset-0 z-[140] flex items-end bg-black/40 sm:items-center sm:p-4">
    <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background sm:mx-auto sm:max-w-lg sm:rounded-lg">
      <header class="sticky top-0 flex items-center justify-between border-b bg-background px-4 py-3"><h2 class="font-semibold">${ACTION_LABELS[action]}${action === 'COMPLETE' ? '二次确认' : ''}</h2><button type="button" class="rounded border px-3 py-1 text-sm" data-pda-wool-action="close-overlay" data-skip-page-rerender="true">关闭</button></header>
      ${state.error ? `<div class="mx-4 mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-pda-wool-error>${escapeHtml(state.error)}</div>` : ''}
      ${body}
      <footer class="sticky bottom-0 flex gap-2 border-t bg-background p-4"><button type="button" class="h-10 flex-1 rounded border" data-pda-wool-action="close-overlay" data-skip-page-rerender="true">取消</button><button type="button" class="h-10 flex-1 rounded bg-primary font-medium text-primary-foreground disabled:opacity-50" data-pda-wool-action="save-fact" data-skip-page-rerender="true" ${canSubmit ? '' : 'disabled'}>${action === 'COMPLETE' ? '确认完成加工单' : `保存${ACTION_LABELS[action]}`}</button></footer>
    </section>
  </div>`
}

export function renderPdaWoolExecutionContent(
  taskId: string,
  initialAccess?: WoolPdaTaskAccessResult,
): string {
  const session = getPdaSession()
  syncTask(taskId, session?.userId || '')
  const access = initialAccess ?? getCurrentAccess(taskId)
  if (!access.canAccess || !access.order) return renderAccessBlocked(access)
  const order = access.order
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)
  const primary = primaryAction(projection.allowedActions)
  const secondary = projection.allowedActions.filter((action): action is WoolFactAction =>
    action !== 'DETAIL' && action !== 'ASSOCIATE_MACHINE' && action !== primary)
  return `<div class="space-y-3 p-4" data-pda-wool-root data-task-id="${escapeHtml(taskId)}" data-wool-order-id="${escapeHtml(order.woolOrderId)}">
    <button type="button" class="text-sm text-muted-foreground" data-pda-execd-action="back" data-skip-page-rerender="true">← 返回</button>
    ${state.error && !state.overlay ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-pda-wool-error>${escapeHtml(state.error)}</div>` : ''}
    ${state.feedback ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">${escapeHtml(state.feedback)}</div>` : ''}
    ${renderStyleIdentity(order)}
    <section class="rounded-lg border bg-card p-4"><div class="flex items-center justify-between"><h2 class="font-semibold">可填报 SKU 与纱线</h2><span class="rounded border px-2 py-1 text-xs">${projection.processingStatusLabel}</span></div><div class="mt-3 space-y-2">${renderOutputReadiness(order, projection)}</div></section>
    ${renderFactList(projection)}
    <section class="rounded-lg border bg-card p-4"><h2 class="text-sm font-semibold">当前操作</h2>
      ${primary ? `<button type="button" class="mt-3 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground" data-pda-wool-action="open-fact" data-skip-page-rerender="true" data-wool-fact-action="${primary}" data-wool-order-id="${escapeHtml(order.woolOrderId)}">${ACTION_LABELS[primary]}</button>` : '<div class="mt-3 rounded border bg-muted/30 p-3 text-sm text-muted-foreground">加工单已完成，只能查看事实记录。</div>'}
      ${secondary.length ? `<details class="mt-3"><summary class="cursor-pointer text-sm text-muted-foreground">其他可操作</summary><div class="mt-2 grid grid-cols-2 gap-2">${secondary.map((action) => `<button type="button" class="h-9 rounded border text-sm" data-pda-wool-action="open-fact" data-skip-page-rerender="true" data-wool-fact-action="${action}" data-wool-order-id="${escapeHtml(order.woolOrderId)}">${ACTION_LABELS[action]}</button>`).join('')}</div></details>` : ''}
    </section>
    <div data-pda-wool-overlay-root>${renderOverlay(order, projection)}</div>
  </div>`
}

function refreshRoot(root: HTMLElement, taskId: string): void {
  root.outerHTML = renderPdaWoolExecutionContent(taskId)
}

function refreshOverlay(root: HTMLElement, order: WoolWorkOrder): void {
  const target = root.querySelector<HTMLElement>('[data-pda-wool-overlay-root]')
  if (target) target.innerHTML = renderOverlay(order, buildWoolMobileTaskProjection(order.woolOrderId))
}

function refreshCompletionSection(
  root: HTMLElement,
  order: WoolWorkOrder,
  section: CompletionSection,
): void {
  const target = root.querySelector<HTMLElement>(`[data-completion-section="${section}"]`)
  if (!target) return
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)
  const draft = draftFor('COMPLETE', projection)
  target.outerHTML = renderCompletionFactSection(projection.completionFacts, section, draft)
}

function refreshFactList(root: HTMLElement, order: WoolWorkOrder): void {
  const target = root.querySelector<HTMLElement>('[data-pda-wool-fact-list-root]')
  if (target) {
    target.outerHTML = renderFactList(buildWoolMobileTaskProjection(order.woolOrderId), true)
  }
}

function syncDraft(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (!state.overlay) return
  const draft = state.draftsByAction[state.overlay.action]
  const field = target.dataset.draftField
  if (!draft || !field) return
  const sku = target.dataset.objectSku || ''
  if (field === 'selectedYarnSkus' && target instanceof HTMLInputElement) {
    draft.selectedYarnSkus = target.checked
      ? [...new Set([...draft.selectedYarnSkus, sku])]
      : draft.selectedYarnSkus.filter((item) => item !== sku)
  } else if (field === 'quantities' || field === 'differenceNotes') {
    draft[field][sku] = target.value
  } else if (
    field === 'outputSkuCode'
    || field === 'qty'
    || field === 'deliveryNo'
    || field === 'batchNo'
    || field === 'proofText'
    || field === 'remark'
  ) {
    draft[field] = target.value
  }
}

export function handlePdaWoolExecutionEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-pda-wool-root]')
  if (!root) return false
  const draftNode = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-pda-wool-draft="sync-draft"]')
  if (draftNode) {
    syncDraft(draftNode)
    if (state.overlay?.action === 'HANDOVER' && draftNode.dataset.draftField === 'outputSkuCode') {
      const access = getCurrentAccess(
        root.dataset.taskId || '',
        root.dataset.woolOrderId || '',
      )
      if (access.canAccess && access.order) refreshOverlay(root, access.order)
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-pda-wool-action]')
  const action = actionNode?.dataset.pdaWoolAction
  if (!actionNode || !action) return false
  const taskId = root.dataset.taskId || ''
  const woolOrderId = root.dataset.woolOrderId || ''
  const access = getCurrentAccess(taskId, woolOrderId)
  if (!access.canAccess || !access.order) {
    root.outerHTML = renderAccessBlocked(access)
    return true
  }
  const order = access.order
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)

  if (action === 'open-fact') {
    const factAction = actionNode.dataset.woolFactAction as WoolFactAction
    if (
      !projection.allowedActions.includes(factAction)
      || !getWoolAllowedActions(order.woolOrderId).includes(factAction)
    ) {
      state.error = '当前业务事实已变化，请按最新页面操作。'
      refreshRoot(root, taskId)
      return true
    }
    if (state.overlay?.action !== factAction) state.draftsByAction = {}
    state.overlay = {
      action: factAction,
      woolOrderId: order.woolOrderId,
      commandId: nextCommandId(factAction, order.woolOrderId),
    }
    draftFor(factAction, projection)
    state.error = ''
    refreshOverlay(root, order)
    return true
  }
  if (action === 'close-overlay') {
    if (state.overlay) delete state.draftsByAction[state.overlay.action]
    state.overlay = null
    state.error = ''
    refreshOverlay(root, order)
    return true
  }
  if (action === 'fact-page') {
    state.factPage = Math.max(1, Number(actionNode.dataset.page || 1))
    refreshFactList(root, order)
    return true
  }
  if (action === 'completion-page' && state.overlay?.action === 'COMPLETE') {
    const section = actionNode.dataset.section as CompletionSection
    if (!COMPLETION_SECTION_KEYS.includes(section)) return true
    const draft = draftFor('COMPLETE', projection)
    draft.completionPages[section] = Math.max(1, Number(actionNode.dataset.page || 1))
    refreshCompletionSection(root, order, section)
    return true
  }
  if (action !== 'save-fact' || !state.overlay) return true

  const saveAccess = getCurrentAccess(taskId, state.overlay.woolOrderId)
  if (!saveAccess.canAccess || !saveAccess.order) {
    state.error = `${saveAccess.reasonLabel} 本次保存未产生任何业务记录。`
    refreshOverlay(root, order)
    return true
  }
  const operatedAt = nowText()
  const operatedBy = getPdaSession()?.userName || 'PDA 毛织操作员'
  const currentAction = state.overlay.action
  const draft = draftFor(currentAction, projection)
  try {
    if (currentAction === 'RECEIVE_YARN') {
      addWoolYarnReceipt(order.woolOrderId, {
        commandId: state.overlay.commandId,
        deliveryNo: draft.deliveryNo,
        batchNo: draft.batchNo,
        receivedAt: operatedAt,
        receivedBy: operatedBy,
        proofFiles: parseProofFiles(draft.proofText),
        remark: draft.remark,
        lines: draft.selectedYarnSkus.map((yarnSkuCode) => ({
          yarnSkuCode,
          receivedQty: Number(draft.quantities[yarnSkuCode] || 0),
          differenceNote: draft.differenceNotes[yarnSkuCode],
        })),
      })
    } else if (currentAction === 'REPORT_PROCESS') {
      addWoolProcessReport(order.woolOrderId, {
        commandId: state.overlay.commandId,
        outputSkuCode: draft.outputSkuCode,
        reportedQty: Number(draft.qty),
        reportedAt: operatedAt,
        reportedBy: operatedBy,
        proofFiles: parseProofFiles(draft.proofText),
        remark: draft.remark,
      })
    } else if (currentAction === 'HANDOVER') {
      addWoolHandover(order.woolOrderId, {
        commandId: state.overlay.commandId,
        outputSkuCode: draft.outputSkuCode,
        handoverQty: Number(draft.qty),
        handedOverAt: operatedAt,
        handedOverBy: operatedBy,
        proofFiles: parseProofFiles(draft.proofText),
        remark: draft.remark,
      })
    } else {
      completeWoolWorkOrder(order.woolOrderId, {
        commandId: state.overlay.commandId,
        completedAt: operatedAt,
        completedBy: operatedBy,
        remark: draft.remark,
      })
    }
    state.feedback = `${ACTION_LABELS[currentAction]}已保存，Web 端同步更新。`
    delete state.draftsByAction[currentAction]
    state.overlay = null
    state.error = ''
    refreshRoot(root, taskId)
  } catch (error) {
    state.error = error instanceof Error ? error.message : '保存失败，请检查后重试。'
    refreshOverlay(root, order)
  }
  return true
}
