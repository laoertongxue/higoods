// @page-pattern: detail
import { escapeHtml } from '../../../utils.ts'
import {
  createCutOrderReleaseWriteSnapshot,
  getCutOrderReleaseImpactSummary,
  getCutPieceReleaseRecord,
  recordCutOrderReleaseStatusChange,
  restoreCutOrderReleaseWriteSnapshot,
  type CutOrderReleaseWriteResult,
} from '../../../data/fcs/cut-piece-release.ts'
import {
  createCuttingOrderProgressSnapshot,
  cuttingOrderProgressRecords,
  restoreCuttingOrderProgressSnapshot,
  updateCuttingOrderProgressWebStage,
} from '../../../data/fcs/cutting/order-progress.ts'
import {
  buildCutOrderCloseImpactItems,
  buildCutOrderLedgerSnapshotBeforeClose,
  createCutOrderLifecycleOperationKey,
  createNextCutOrderCloseRecordIdentity,
  createNextCutOrderReopenRecordIdentity,
  cutOrderCloseReasonOptions,
  listStoredCutOrderCloseRecords,
  listStoredCutOrderReopenRecords,
  removeStoredCutOrderCloseRecord,
  removeStoredCutOrderReopenRecord,
  resolveActiveCutOrderCloseRecords,
  resolveCutOrderCloseReasonText,
  upsertStoredCutOrderCloseRecord,
  upsertStoredCutOrderReopenRecord,
  type CutOrderCloseReasonCode,
  type CutOrderCloseRecord,
  type CutOrderReopenRecord,
} from '../../../data/fcs/cutting/cut-order-close-records.ts'
import {
  renderCraftCuttingCutOrderClosePage as renderBaselineClosePage,
  renderCraftCuttingCutOrdersPage as renderBaselineCutOrdersPage,
} from './cut-orders.ts'

type ReleaseWriter = typeof recordCutOrderReleaseStatusChange
let releaseWriter: ReleaseWriter = recordCutOrderReleaseStatusChange

export function setCutOrderReleaseStatusWriterForTesting(writer: ReleaseWriter | null): void {
  releaseWriter = writer ?? recordCutOrderReleaseStatusChange
}

interface IntegrationDraft {
  closeReasonCode: CutOrderCloseReasonCode
  closeDescription: string
  closedBy: string
  feedback: { tone: 'success' | 'warning'; message: string } | null
}

const draft: IntegrationDraft = {
  closeReasonCode: 'BUSINESS_STOP_RECUT',
  closeDescription: '',
  closedBy: '裁床主管 何倩',
  feedback: null,
}

interface LifecycleContext {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  spuName: string
  isClosed: boolean
  activeClose: CutOrderCloseRecord | null
  latestLifecycleRecordId: string
  releaseStatus: string
  releaseChangedAt: string
  releaseOperator: string
  releaseReason: string
}

let lastDisplayContext: LifecycleContext | null = null
const inFlightTokens = new Set<string>()
const inFlightOperations = new Set<string>()

function currentParams(): URLSearchParams {
  const search = typeof window !== 'undefined' ? window.location.search : ''
  return new URLSearchParams(search)
}

function lifecycleEvents(cutOrderId: string, cutOrderNo: string): Array<{ id: string; occurredAt: string; kind: 'close' | 'reopen' }> {
  const closes = listStoredCutOrderCloseRecords()
    .filter((record) => record.cutOrderId === cutOrderId || record.cutOrderNo === cutOrderNo)
    .map((record) => ({ id: record.closeRecordId, occurredAt: record.closedAt || record.createdAt, kind: 'close' as const }))
  const reopens = listStoredCutOrderReopenRecords()
    .filter((record) => record.cutOrderId === cutOrderId || record.cutOrderNo === cutOrderNo)
    .map((record) => ({ id: record.reopenRecordId, occurredAt: record.reopenedAt || record.createdAt, kind: 'reopen' as const }))
  return [...closes, ...reopens].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt, 'zh-CN') || left.id.localeCompare(right.id, 'zh-CN'))
}

function resolveLifecycleContext(requireProgress = false): LifecycleContext | null {
  const params = currentParams()
  const requestedId = params.get('cutOrderId') || ''
  const requestedNo = params.get('cutOrderNo') || ''
  const releaseRecord = getCutPieceReleaseRecord('cpr-po-14671')
  const source = releaseRecord?.sourceStates.find((item) => item.cutOrderId === requestedId || item.cutOrderNo === requestedNo)
  if (!releaseRecord || !source) return null
  const progress = cuttingOrderProgressRecords.find((record) => record.materialLines.some((line) => line.cutOrderId === source.cutOrderId && line.cutOrderNo === source.cutOrderNo))
  if (requireProgress && !progress) throw new Error('阶段投影不存在，操作失败')
  const closes = listStoredCutOrderCloseRecords().filter((record) => record.cutOrderId === source.cutOrderId || record.cutOrderNo === source.cutOrderNo)
  const reopens = listStoredCutOrderReopenRecords().filter((record) => record.cutOrderId === source.cutOrderId || record.cutOrderNo === source.cutOrderNo)
  const activeClose = resolveActiveCutOrderCloseRecords(closes, reopens).at(-1) ?? null
  const events = lifecycleEvents(source.cutOrderId, source.cutOrderNo)
  const latestEvent = events.at(-1)
  const isClosed = latestEvent
    ? latestEvent.kind === 'close'
    : progress
      ? progress.cuttingStage === '已关闭'
      : source.status === '已冻结'
  return {
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    productionOrderId: releaseRecord.productionOrderId,
    productionOrderNo: releaseRecord.productionOrderNo,
    spuCode: releaseRecord.spuCode,
    spuName: releaseRecord.spuName,
    isClosed,
    activeClose,
    latestLifecycleRecordId: latestEvent?.id || `release:${source.changedAt}:${source.status}`,
    releaseStatus: source.status,
    releaseChangedAt: source.changedAt,
    releaseOperator: source.operator,
    releaseReason: source.reason,
  }
}

function actionToken(action: 'close' | 'reopen', context: LifecycleContext): string {
  const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
  return `${action}:${context.cutOrderId}:${nonce}`
}

function renderFeedback(): string {
  if (!draft.feedback) return ''
  const tone = draft.feedback.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<section class="rounded-lg border px-4 py-3 text-sm ${tone}">${escapeHtml(draft.feedback.message)}</section>`
}

function renderStage(context: LifecycleContext): string {
  const card = (label: string, value: string) => `<div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 text-sm font-semibold">${escapeHtml(value)}</div></div>`
  return [
    card('裁片单', context.cutOrderNo),
    card('来源生产单', context.productionOrderNo),
    card('当前主状态', context.isClosed ? '已关闭' : '持续更新'),
    card('放行状态', context.releaseStatus),
  ].join('')
}

function renderAction(context: LifecycleContext): string {
  const impact = getCutOrderReleaseImpactSummary(context.cutOrderNo)
  if (context.isClosed) {
    return `<section class="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm font-semibold text-zinc-800">该裁片单已经关闭，不能重复关闭。</div>
        <button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" data-skip-page-rerender="true" data-cut-order-release-integration-action="reopen" data-action-token="${escapeHtml(actionToken('reopen', context))}">重新打开裁片单</button>
      </div>
      <div class="mt-3 text-xs text-muted-foreground">${escapeHtml(context.activeClose?.closeDescription || context.releaseReason)}</div>
    </section>`
  }
  return `<section class="rounded-lg border bg-card p-4">
    <h3 class="text-sm font-semibold">关闭信息</h3>
    <div class="mt-3 grid gap-3 md:grid-cols-2">
      <label class="space-y-2"><span class="text-sm font-medium">关闭原因</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cutting-piece-close-field="closeReasonCode" data-cut-order-release-integration-field="closeReasonCode">${cutOrderCloseReasonOptions.map((option) => `<option value="${option.value}" ${option.value === draft.closeReasonCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>
      <label class="space-y-2"><span class="text-sm font-medium">关闭人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(draft.closedBy)}" data-skip-page-rerender="true" data-cutting-piece-close-field="closedBy" data-cut-order-release-integration-field="closedBy" /></label>
      <label class="space-y-2 md:col-span-2"><span class="text-sm font-medium">关闭说明</span><textarea class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" data-skip-page-rerender="true" data-cutting-piece-close-field="closeDescription" data-cut-order-release-integration-field="closeDescription">${escapeHtml(draft.closeDescription)}</textarea></label>
    </div>
    <button type="button" class="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50" ${impact?.activeSpreadingOrderNos.length ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-order-release-integration-action="close" data-action-token="${escapeHtml(actionToken('close', context))}">确认关闭裁片单</button>
  </section>`
}

function renderImpact(context: LifecycleContext): string {
  const impact = getCutOrderReleaseImpactSummary(context.cutOrderNo)
  if (!impact) return ''
  return `<section class="rounded-lg border ${impact.activeSpreadingOrderNos.length ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'} p-4" data-testid="cut-order-release-impact">
    <h3 class="text-sm font-semibold">放行矩阵影响</h3>
    <div class="mt-3 flex flex-wrap gap-2">${impact.affectedCells.map((cell) => `<span class="rounded-md border bg-white px-2.5 py-1.5 text-xs">${escapeHtml(cell.garmentColor)} / ${escapeHtml(cell.size)} / ${escapeHtml(cell.materialName)}：${cell.availableGarmentQty ?? '待计算'} 件</span>`).join('')}</div>
    ${impact.activeSpreadingOrderNos.length ? `<div class="mt-3 text-sm font-medium text-rose-700" data-testid="cut-order-active-spreading-block">请先处理进行中的铺布单：${escapeHtml(impact.activeSpreadingOrderNos.join('、'))}</div>` : ''}
  </section>`
}

function renderIntegratedClosePage(context: LifecycleContext): string {
  lastDisplayContext = context
  return `<div class="space-y-4 p-4" data-testid="cut-order-close-page">
    <div data-cut-order-close-region="feedback"><h1 class="text-xl font-semibold">关闭裁片单</h1><div data-testid="cut-order-close-feedback" data-cut-order-close-feedback-slot>${renderFeedback()}</div></div>
    <section class="rounded-lg border bg-card p-4"><h2 class="text-lg font-semibold">关闭裁片单：${escapeHtml(context.cutOrderNo)}</h2><div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-cut-order-close-region="stage">${renderStage(context)}</div></section>
    ${renderImpact(context)}
    <div data-cut-order-close-region="action">${renderAction(context)}</div>
  </div>`
}

function refreshRegions(context: LifecycleContext): void {
  lastDisplayContext = context
  const feedback = document.querySelector<HTMLElement>('[data-cut-order-close-feedback-slot]')
  const stage = document.querySelector<HTMLElement>('[data-cut-order-close-region="stage"]')
  const action = document.querySelector<HTMLElement>('[data-cut-order-close-region="action"]')
  if (feedback) feedback.innerHTML = renderFeedback()
  if (stage) stage.innerHTML = renderStage(context)
  if (action) action.innerHTML = renderAction(context)
}

function showFailure(message: string): void {
  draft.feedback = { tone: 'warning', message }
  const feedback = document.querySelector<HTMLElement>('[data-cut-order-close-feedback-slot]')
  if (feedback) feedback.innerHTML = renderFeedback()
}

function acceptRelease(result: CutOrderReleaseWriteResult): void {
  if (result.status === 'applied' || result.status === 'idempotent') return
  throw new Error(result.reason || '裁片放行状态写入失败。')
}

function claim(token: string, operationKey: string): boolean {
  if (!token || inFlightTokens.has(token) || inFlightOperations.has(operationKey)) return false
  inFlightTokens.add(token)
  inFlightOperations.add(operationKey)
  return true
}

function releaseClaim(token: string, operationKey: string): void {
  inFlightTokens.delete(token)
  inFlightOperations.delete(operationKey)
  if (inFlightTokens.size > 100) inFlightTokens.clear()
  if (inFlightOperations.size > 100) inFlightOperations.clear()
}

async function reopen(actionNode: HTMLElement): Promise<boolean> {
  let context: LifecycleContext
  try {
    context = resolveLifecycleContext(true)!
  } catch (error) {
    showFailure(error instanceof Error ? error.message.replace('操作失败', '重新打开失败') : '重新打开失败')
    return true
  }
  if (!context?.isClosed) {
    showFailure('当前裁片单不是已关闭状态，不需要重新打开。')
    return true
  }
  const operationKey = createCutOrderLifecycleOperationKey('reopen', context.cutOrderId, context.latestLifecycleRecordId)
  const token = actionNode.dataset.actionToken || ''
  if (!claim(token, operationKey)) {
    showFailure('操作正在处理，请勿重复点击。')
    return true
  }
  await Promise.resolve()
  const occurredAt = new Date().toISOString()
  const identity = createNextCutOrderReopenRecordIdentity(context.cutOrderId, context.cutOrderNo, undefined, operationKey)
  const record: CutOrderReopenRecord = {
    ...identity, operationKey, cutOrderId: context.cutOrderId, cutOrderNo: context.cutOrderNo,
    productionOrderId: context.productionOrderId, productionOrderNo: context.productionOrderNo,
    reopenedAt: occurredAt, reopenedBy: draft.closedBy, reopenReason: '业务需要继续针对裁片单补料或铺布执行。',
    previousCloseRecordNo: context.activeClose?.closeRecordNo || '', createdAt: occurredAt, createdBy: draft.closedBy,
  }
  const progressSnapshot = createCuttingOrderProgressSnapshot(context.cutOrderId)
  const releaseSnapshot = createCutOrderReleaseWriteSnapshot(context.cutOrderId, context.cutOrderNo)
  let insertedId = ''
  try {
    const write = upsertStoredCutOrderReopenRecord(record)
    if (!write.ok) throw new Error('重开记录写入冲突，请重试。')
    if (!write.idempotent) insertedId = write.record.reopenRecordId
    if (!updateCuttingOrderProgressWebStage(context.cutOrderId, { cuttingStage: '已开工', operatorName: record.reopenedBy, operatedAt: occurredAt })) throw new Error('阶段投影不存在，重新打开失败')
    acceptRelease(releaseWriter({ eventId: write.record.reopenRecordId, cutOrderId: context.cutOrderId, cutOrderNo: context.cutOrderNo, status: '持续更新', occurredAt, operator: record.reopenedBy, reason: '重新打开裁片单，恢复持续更新' }))
    draft.feedback = { tone: 'success', message: '已重新打开裁片单，可继续针对该裁片单补料、唛架和铺布。' }
  } catch (error) {
    if (insertedId) removeStoredCutOrderReopenRecord(insertedId)
    restoreCuttingOrderProgressSnapshot(progressSnapshot)
    restoreCutOrderReleaseWriteSnapshot(releaseSnapshot)
    draft.feedback = { tone: 'warning', message: error instanceof Error ? error.message : '重新打开失败。' }
  } finally {
    releaseClaim(token, operationKey)
  }
  const next = resolveLifecycleContext() || lastDisplayContext || context
  refreshRegions(next)
  return true
}

async function close(actionNode: HTMLElement): Promise<boolean> {
  let context: LifecycleContext
  try {
    context = resolveLifecycleContext(true)!
  } catch (error) {
    showFailure(error instanceof Error ? error.message.replace('操作失败', '关闭失败') : '关闭失败')
    return true
  }
  if (!context || context.isClosed) {
    showFailure('该裁片单已经关闭，不能重复关闭。')
    return true
  }
  const impact = getCutOrderReleaseImpactSummary(context.cutOrderNo)
  if (impact?.activeSpreadingOrderNos.length) {
    showFailure(`请先处理进行中的铺布单：${impact.activeSpreadingOrderNos.join('、')}`)
    return true
  }
  if (!draft.closeDescription.trim()) {
    showFailure('关闭裁片单必须填写关闭说明。')
    return true
  }
  const operationKey = createCutOrderLifecycleOperationKey('close', context.cutOrderId, context.latestLifecycleRecordId)
  const token = actionNode.dataset.actionToken || ''
  if (!claim(token, operationKey)) {
    showFailure('操作正在处理，请勿重复点击。')
    return true
  }
  await Promise.resolve()
  const occurredAt = new Date().toISOString()
  const identity = createNextCutOrderCloseRecordIdentity(context.cutOrderId, context.cutOrderNo, undefined, operationKey)
  const ledgerSnapshot = buildCutOrderLedgerSnapshotBeforeClose(null)
  const record: CutOrderCloseRecord = {
    ...identity, operationKey, cutOrderId: context.cutOrderId, cutOrderNo: context.cutOrderNo,
    productionOrderId: context.productionOrderId, productionOrderNo: context.productionOrderNo,
    closeReasonCode: draft.closeReasonCode, closeReasonText: resolveCutOrderCloseReasonText(draft.closeReasonCode),
    closeDescription: draft.closeDescription.trim(), closedAt: occurredAt, closedBy: draft.closedBy.trim(), closeSourceType: '人工关闭',
    linkedLedgerEventIds: [`ledger:${context.cutOrderId}:close:${identity.closeRecordId}`], ledgerSnapshotBeforeClose: ledgerSnapshot,
    openImpactItems: buildCutOrderCloseImpactItems({ ledgerSnapshot }), remainingInventorySummary: '0 片', pendingSpecialCraftSummary: '0 片', pendingHandoverSummary: '0 条',
    createdAt: occurredAt, createdBy: draft.closedBy.trim(),
  }
  const progressSnapshot = createCuttingOrderProgressSnapshot(context.cutOrderId)
  const releaseSnapshot = createCutOrderReleaseWriteSnapshot(context.cutOrderId, context.cutOrderNo)
  let insertedId = ''
  try {
    const write = upsertStoredCutOrderCloseRecord(record)
    if (!write.ok) throw new Error('关闭记录写入冲突，请重试。')
    if (!write.idempotent) insertedId = write.record.closeRecordId
    if (!updateCuttingOrderProgressWebStage(context.cutOrderId, { cuttingStage: '已关闭', operatorName: record.closedBy, operatedAt: occurredAt, closeReasonCode: record.closeReasonCode, closeReasonText: record.closeReasonText, closeReason: record.closeDescription, ledgerSnapshotBeforeClose: ledgerSnapshot })) throw new Error('阶段投影不存在，关闭失败')
    acceptRelease(releaseWriter({ eventId: write.record.closeRecordId, cutOrderId: context.cutOrderId, cutOrderNo: context.cutOrderNo, status: '已冻结', occurredAt, operator: record.closedBy, reason: `${record.closeReasonText}，数据已冻结` }))
    draft.feedback = { tone: 'success', message: '已关闭裁片单并保留历史记录；关闭原因、历史菲票、库存和交出记录仍可追溯。' }
  } catch (error) {
    if (insertedId) removeStoredCutOrderCloseRecord(insertedId)
    restoreCuttingOrderProgressSnapshot(progressSnapshot)
    restoreCutOrderReleaseWriteSnapshot(releaseSnapshot)
    draft.feedback = { tone: 'warning', message: error instanceof Error ? error.message : '关闭失败。' }
  } finally {
    releaseClaim(token, operationKey)
  }
  const next = resolveLifecycleContext() || lastDisplayContext || context
  refreshRegions(next)
  return true
}

export async function handleCutOrderReleaseIntegrationEvent(target: Element): Promise<boolean> {
  const field = target.closest<HTMLElement>('[data-cut-order-release-integration-field]')
  if (field) {
    const key = field.dataset.cutOrderReleaseIntegrationField as 'closeReasonCode' | 'closeDescription' | 'closedBy'
    const value = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement ? field.value : ''
    if (key === 'closeReasonCode') draft.closeReasonCode = value as CutOrderCloseReasonCode
    else if (key === 'closeDescription') draft.closeDescription = value
    else if (key === 'closedBy') draft.closedBy = value
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-cut-order-release-integration-action]')
  if (!actionNode) return false
  return actionNode.dataset.cutOrderReleaseIntegrationAction === 'reopen' ? reopen(actionNode) : close(actionNode)
}

function decorateCutOrdersPageHtml(baseHtml: string): string {
  const record = getCutPieceReleaseRecord('cpr-po-14671')
  if (!record) return baseHtml
  const cards = record.sourceStates.map((source) => `<article class="rounded-lg border bg-card p-3"><div class="font-mono text-sm font-semibold">${escapeHtml(source.cutOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} / ${escapeHtml(record.spuCode)} / ${escapeHtml(source.status)}</div><button type="button" class="mt-2 text-xs text-blue-600 hover:underline" data-nav="/fcs/craft/cutting/cut-order-close?cutOrderNo=${encodeURIComponent(source.cutOrderNo)}">${source.status === '已冻结' ? '查看关闭记录' : '关闭裁片单'}</button></article>`).join('')
  const section = `<section class="rounded-lg border bg-card p-4" data-testid="cut-order-release-linked-orders"><h2 class="text-sm font-semibold">裁片放行联动裁片单</h2><div class="mt-3 grid gap-3 md:grid-cols-2">${cards}</div></section>`
  const index = baseHtml.lastIndexOf('</div>')
  return index < 0 ? `${baseHtml}${section}` : `${baseHtml.slice(0, index)}${section}${baseHtml.slice(index)}`
}

export function renderCraftCuttingCutOrdersPage(): string {
  return decorateCutOrdersPageHtml(renderBaselineCutOrdersPage())
}

export function renderCraftCuttingCutOrderClosePage(): string {
  const context = resolveLifecycleContext()
  return context ? renderIntegratedClosePage(context) : renderBaselineClosePage()
}
