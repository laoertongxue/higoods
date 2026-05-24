import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  buildReplenishmentFollowupActionForResult,
  buildReplenishmentAuditTrail,
  buildReplenishmentReviewItem,
  deserializeReplenishmentActionsStorage,
  deserializeReplenishmentAuditTrailStorage,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
  filterReplenishmentRows,
  findReplenishmentByPrefilter,
  formatReplenishmentReviewResultLabel,
  normalizeReplenishmentReviewResult,
  replenishmentFollowupActionStatusMetaMap,
  replenishmentFollowupActionTypeMetaMap,
  replenishmentRiskMetaMap,
  replenishmentSourceMeta,
  replenishmentStatusMetaMap,
  resolveNextActionFromReviewResult,
  resolveReviewStatusFromResult,
  serializeReplenishmentActionsStorage,
  serializeReplenishmentAuditTrailStorage,
  serializeReplenishmentImpactPlansStorage,
  serializeReplenishmentReviewsStorage,
  validateReplenishmentReviewAction,
  type ReplenishmentAuditTrail,
  type ReplenishmentFilters,
  type ReplenishmentFollowupAction,
  type ReplenishmentFollowupActionStatus,
  type ReplenishmentImpactPlan,
  type ReplenishmentPrefilter,
  type ReplenishmentReview,
  type ReplenishmentReviewResult,
  type ReplenishmentReviewStatus,
  type ReplenishmentSuggestionRow,
} from './replenishment-model.ts'
import { buildReplenishmentProjection } from './replenishment-projection.ts'
import {
  CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  deserializeReplenishmentPendingPrepStorage,
  serializeReplenishmentPendingPrepStorage,
  type ReplenishmentPendingPrepFollowupRecord,
} from '../../../data/fcs/cutting/storage/replenishment-storage.ts'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
  serializeMarkerSpreadingStorage,
  updateSpreadingReplenishmentHandled,
} from './marker-spreading-model.ts'
import { readMarkerSpreadingPrototypeData } from './marker-spreading-utils.ts'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import { getWarehouseSearchParams } from './warehouse-shared.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingNavigationActionLabel,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import {
  ACTION_PERMISSION_DENIED_TEXT,
  canReviewReplenishment,
  resolveFcsDemoRole,
} from '../../../data/fcs/action-permissions.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { buildBindingProcessOrders } from './special-processes.ts'

type FilterField = 'keyword' | 'sourceType' | 'status' | 'riskLevel'
type ReviewField = 'result' | 'status' | 'reason' | 'note' | 'closeReasonCode' | 'closeReason'
type FeedbackTone = 'success' | 'warning'
type WorkbenchTabKey = 'pending' | 'handled' | 'closing' | 'record-only' | 'all'

const closeReasonOptions: Array<{ value: NonNullable<ReplenishmentReview['closeReasonCode']>; label: string }> = [
  { value: 'MATERIAL_NO_MORE_ARRIVAL', label: '面料不再到货' },
  { value: 'BUSINESS_STOP_RECUT', label: '业务决定不再补裁' },
  { value: 'FORCED_CLOSE', label: '强行完结' },
  { value: 'STYLE_CANCELLED', label: '款式取消' },
  { value: 'DEMAND_CANCELLED', label: '需求取消' },
  { value: 'MATERIAL_REPLACED_UNUSED', label: '面料替代后不再使用本裁片单' },
  { value: 'OTHER', label: '其他原因' },
]

interface ReplenishmentPageState {
  filters: ReplenishmentFilters
  activeTab: WorkbenchTabKey
  prefilter: ReplenishmentPrefilter | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  activeSuggestionId: string | null
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
  actions: ReplenishmentFollowupAction[]
  audits: ReplenishmentAuditTrail[]
  reviewDraft: {
    result: ReplenishmentReviewResult
    status: ReplenishmentReviewStatus
    reason: string
    note: string
    closeReasonCode: NonNullable<ReplenishmentReview['closeReasonCode']>
    closeReason: string
  }
  feedback: {
    tone: FeedbackTone
    message: string
  } | null
}

const initialFilters: ReplenishmentFilters = {
  keyword: '',
  sourceType: 'ALL',
  status: 'ALL',
  riskLevel: 'ALL',
  pendingReviewOnly: false,
  pendingActionOnly: false,
}

const state: ReplenishmentPageState = {
  filters: { ...initialFilters },
  activeTab: 'pending',
  prefilter: null,
  drillContext: null,
  querySignature: '',
  activeSuggestionId: null,
  reviews: deserializeReplenishmentReviewsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY)),
  impactPlans: deserializeReplenishmentImpactPlansStorage(localStorage.getItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY)),
  actions: deserializeReplenishmentActionsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY)),
  audits: deserializeReplenishmentAuditTrailStorage(localStorage.getItem(CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY)),
  reviewDraft: {
    result: '需要补料',
    status: 'APPROVED',
    reason: '',
    note: '',
    closeReasonCode: 'BUSINESS_STOP_RECUT',
    closeReason: '',
  },
  feedback: null,
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function formatLength(value: number): string {
  return `${Number(value || 0).toFixed(2)} 米`
}

function renderFormulaLine(formula?: string): string {
  return formula ? `<div class="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">${escapeHtml(formula)}</div>` : ''
}

function renderMetricCard(
  label: string,
  value: string,
  options?: {
    formula?: string
    valueClassName?: string
  },
): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 ${options?.valueClassName || 'font-medium text-foreground'}">${escapeHtml(value)}</div>
      ${renderFormulaLine(options?.formula)}
    </article>
  `
}

function buildLengthSumFormula(result: number, values: number[]): string {
  const left = Number(result || 0).toFixed(2)
  const right = values.length ? values.map((value) => Number(value || 0).toFixed(2)).join(' + ') : '0'
  return `${left} = ${right}`
}

function buildQtySumFormula(result: number, values: number[]): string {
  const left = formatQty(result || 0)
  const right = values.length ? values.map((value) => formatQty(value || 0)).join(' + ') : '0'
  return `${left} = ${right}`
}

function buildLengthDifferenceFormula(result: number, minuend: number, subtrahend: number): string {
  return `${Number(result || 0).toFixed(2)} = ${Number(minuend || 0).toFixed(2)} - ${Number(subtrahend || 0).toFixed(2)}`
}

function buildViewModel() {
  return buildReplenishmentProjection({
    reviews: state.reviews,
    impactPlans: state.impactPlans,
    actions: state.actions,
  }).viewModel
}

function refreshDerivedImpactPlans(): void {
  state.impactPlans = buildViewModel().rows.map((row) => row.impactPlan)
}

function persistStore(): void {
  refreshDerivedImpactPlans()
  localStorage.setItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY, serializeReplenishmentReviewsStorage(state.reviews))
  localStorage.setItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY, serializeReplenishmentImpactPlansStorage(state.impactPlans))
  localStorage.setItem(CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY, serializeReplenishmentActionsStorage(state.actions))
  localStorage.setItem(CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY, serializeReplenishmentAuditTrailStorage(state.audits))
}

function readPendingPrepFollowups(): ReplenishmentPendingPrepFollowupRecord[] {
  return deserializeReplenishmentPendingPrepStorage(
    localStorage.getItem(CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY),
  )
}

function persistPendingPrepFollowups(records: ReplenishmentPendingPrepFollowupRecord[]): void {
  localStorage.setItem(
    CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
    serializeReplenishmentPendingPrepStorage(records),
  )
}

function buildPendingPrepFollowupRecords(row: ReplenishmentSuggestionRow, review: ReplenishmentReview): ReplenishmentPendingPrepFollowupRecord[] {
  const sourceSpreadingSessionId = row.context.session?.spreadingSessionId || ''
  const sourceMarkerId = row.context.marker?.markerId || ''
  const sourceMarkerNo = row.context.marker?.markerNo || ''
  return row.lines.map((line) => ({
    followupId: `pending-prep-${row.suggestionId}-${line.lineId}`,
    suggestionId: row.suggestionId,
    sourceReplenishmentRequestId: row.suggestionId,
    sourceSpreadingSessionId,
    sourceMarkerId,
    sourceMarkerNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo || line.cutOrderId,
    materialSku: line.materialSku,
    color: line.color,
    shortageGarmentQty: line.shortageGarmentQty,
    status: 'PENDING_PREP',
    createdAt: review.reviewedAt,
    createdBy: review.reviewedBy,
    note: `处理结果为发起布料，WMS 中转仓创建新的配料；差异成衣件数 ${formatQty(line.shortageGarmentQty)} 件。`,
  }))
}

function replacePendingPrepFollowups(suggestionId: string, records: ReplenishmentPendingPrepFollowupRecord[]): void {
  const retained = readPendingPrepFollowups().filter((item) => item.suggestionId !== suggestionId)
  persistPendingPrepFollowups([...retained, ...records])
}

function syncSpreadingReplenishmentHandledState(row: ReplenishmentSuggestionRow, handled: boolean): void {
  const spreadingSessionId = row.context.session?.spreadingSessionId
  if (!spreadingSessionId) return
  const rawStore = localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY)
  const prototypeStore = readMarkerSpreadingPrototypeData().store
  const baseStore = rawStore ? deserializeMarkerSpreadingStorage(rawStore) : prototypeStore
  const nextStore = updateSpreadingReplenishmentHandled(baseStore, spreadingSessionId, handled)
  localStorage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(nextStore))
}

function getPrefilterFromQuery(): ReplenishmentPrefilter | null {
  const params = getWarehouseSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: ReplenishmentPrefilter = {
    cutOrderNo: drillContext?.cutOrderNo || params.get('cutOrderNo') || undefined,
    cutOrderId: drillContext?.cutOrderId || params.get('cutOrderId') || undefined,
    markerPlanNo: drillContext?.markerPlanNo || params.get('markerPlanNo') || undefined,
    markerPlanId: drillContext?.markerPlanId || params.get('markerPlanId') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
    color: drillContext?.color || params.get('color') || undefined,
    suggestionId: drillContext?.suggestionId || params.get('suggestionId') || undefined,
    suggestionNo: drillContext?.suggestionNo || params.get('suggestionNo') || undefined,
    spreadingSessionId: params.get('spreadingSessionId') || params.get('spreadingOrderId') || undefined,
    spreadingOrderId: params.get('spreadingOrderId') || params.get('spreadingSessionId') || undefined,
    riskLevel: (params.get('riskLevel') as ReplenishmentPrefilter['riskLevel']) || undefined,
    replenishmentStatus: (params.get('replenishmentStatus') as ReplenishmentPrefilter['replenishmentStatus']) || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function getPrefilterStatusLabel(value: ReplenishmentPrefilter['replenishmentStatus']): string {
  if (!value) return ''
  if (value === 'APPROVED') return '已处理 / 处理中'
  if (value === 'APPLIED') return '已完成'
  return replenishmentStatusMetaMap[value]?.label || value
}

function syncReviewDraft(row: ReplenishmentSuggestionRow | null): void {
  const result = normalizeReplenishmentReviewResult(row?.review?.reviewResult || '需要补料')
  state.reviewDraft = {
    result,
    status: row?.review?.reviewStatus || resolveReviewStatusFromResult(result),
    reason: row?.review?.decisionReason || '',
    note: row?.review?.note || '',
    closeReasonCode: row?.review?.closeReasonCode || 'BUSINESS_STOP_RECUT',
    closeReason: row?.review?.closeReason || '',
  }
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams())
  state.prefilter = getPrefilterFromQuery()
  const matched = findReplenishmentByPrefilter(buildViewModel().rows, state.prefilter)
  if (matched) {
    state.activeSuggestionId = matched.suggestionId
    syncReviewDraft(matched)
  }
}

function getFilteredRows(): ReplenishmentSuggestionRow[] {
  const rows = filterReplenishmentRows(buildViewModel().rows, state.filters, state.prefilter)
  if (state.activeTab === 'all') return rows
  if (state.activeTab === 'pending') {
    return rows.filter((row) => ['PENDING_REVIEW', 'PENDING_SUPPLEMENT'].includes(row.statusMeta.key))
  }
  if (state.activeTab === 'handled') {
    return rows.filter((row) =>
      ['APPROVED_PENDING_ACTION', 'IN_ACTION', 'COMPLETED'].includes(row.statusMeta.key) &&
      Boolean(row.review?.reviewResult),
    )
  }
  if (state.activeTab === 'closing') return rows.filter((row) => normalizeReplenishmentReviewResult(row.review?.reviewResult) === '需要补料')
  return rows.filter((row) => row.review?.reviewResult && normalizeReplenishmentReviewResult(row.review.reviewResult) === '仅记录差异')
}

function getActiveRow(): ReplenishmentSuggestionRow | null {
  if (!state.activeSuggestionId) return null
  return buildViewModel().rowsById[state.activeSuggestionId] || null
}

function getFollowupActionById(actionId: string | undefined): { row: ReplenishmentSuggestionRow; action: ReplenishmentFollowupAction } | null {
  if (!actionId) return null
  const rows = buildViewModel().rows
  for (const row of rows) {
    const matched = row.followupActions.find((item) => item.actionId === actionId)
    if (matched) return { row, action: matched }
  }
  return null
}

function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function upsertReview(review: ReplenishmentReview): void {
  state.reviews = [...state.reviews.filter((item) => item.suggestionId !== review.suggestionId), review]
}

function upsertImpactPlan(impactPlan: ReplenishmentImpactPlan): void {
  state.impactPlans = [...state.impactPlans.filter((item) => item.suggestionId !== impactPlan.suggestionId), impactPlan]
}

function upsertFollowupAction(action: ReplenishmentFollowupAction): void {
  state.actions = [...state.actions.filter((item) => item.actionId !== action.actionId), action]
}

function replaceFollowupActions(suggestionId: string, actions: ReplenishmentFollowupAction[]): void {
  state.actions = [...state.actions.filter((item) => item.suggestionId !== suggestionId), ...actions]
}

function prependAudit(audit: ReplenishmentAuditTrail): void {
  state.audits = [audit, ...state.audits]
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}">${escapeHtml(label)}</span>`
}

function renderFilterSelect(
  label: string,
  field: FilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderHeaderActions(): string {
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="return-summary">返回裁剪结果核查</button>`
    : ''
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-marker-index">返回铺布单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-cut-order-index">查看裁片单</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-summary-index">查看裁剪结果核查</button>
    </div>
  `
}

function renderStats(): string {
  const { stats } = buildViewModel()
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('差异处理项', stats.totalCount, '按差异来源汇总', 'text-slate-900')}
      ${renderCompactKpiCard('待处理差异', stats.pendingReviewCount, '只判断发起布料或忽略', 'text-amber-600')}
      ${renderCompactKpiCard('发起布料', stats.waitNextPickupCount, '对接 WMS 中转仓创建配料', 'text-blue-600')}
      ${renderCompactKpiCard('已忽略', stats.completedCount, '不创建配料，不改数量账', 'text-zinc-700')}
      ${renderCompactKpiCard('处理中', stats.inActionCount, '等待后续动作完成', 'text-orange-600')}
      ${renderCompactKpiCard('高风险', stats.highRiskCount, '需优先处理', 'text-rose-600')}
    </section>
  `
}

function renderBindingReplenishmentBridge(): string {
  const rows = buildBindingProcessOrders().filter((row) =>
    row.abnormalItems.some((item) => item.targetModule === '补料管理') || row.linkedReplenishmentIds.length > 0,
  )
  if (!rows.length) return ''

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">捆条加工异常</h2>
          <p class="mt-1 text-xs text-muted-foreground">捆条实际长度、损耗和产出不足作为实际差异进入补料管理，不直接修改数量账。</p>
        </div>
        <a href="/fcs/craft/cutting/special-processes" data-nav="/fcs/craft/cutting/special-processes" class="rounded-md border px-3 py-2 text-sm hover:bg-muted">查看捆条加工单</a>
      </div>
      <div class="mt-3 grid gap-3 xl:grid-cols-2">
        ${rows
          .map((row) => {
            const abnormal = row.abnormalItems.find((item) => item.targetModule === '补料管理') || row.abnormalItems[0]
            const detailHref = `/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}`
            return `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="font-medium text-foreground">${escapeHtml(row.bindingOrderNo)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">来源裁片单：${escapeHtml(row.sourceCutOrderNo)} / 来源铺布单：${escapeHtml(row.sourceSpreadingOrderNo)}</p>
                  </div>
                  <span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">捆条加工异常</span>
                </div>
                <div class="mt-3 grid gap-3 md:grid-cols-2">
                  <div class="text-xs text-muted-foreground">
                    <p>计划长度：${escapeHtml(formatLength(row.plannedLength))}</p>
                    <p class="mt-1">实际长度：${escapeHtml(formatLength(row.actualLength))}</p>
                    <p class="mt-1">差异长度：${escapeHtml(formatLength(Math.max(row.plannedLength - row.actualLength, 0)))}</p>
                    <p class="mt-1">损耗率：${escapeHtml(`${row.lossRate.toFixed(1)}%`)}</p>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <p>差异类型：${escapeHtml(abnormal?.abnormalType || '实际长度小于计划长度')}</p>
                    <p class="mt-1">处理结果：发起布料 / 忽略</p>
                    <p class="mt-1">数量账事件：${escapeHtml(row.linkedLedgerEventIds.length ? row.linkedLedgerEventIds.join(' / ') : '无直接变更')}</p>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <a href="${escapeHtml(detailHref)}" data-nav="${escapeHtml(detailHref)}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-background">查看来源</a>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-background" data-cutting-replenish-action="open-review" data-suggestion-id="${escapeHtml(rows[0]?.linkedReplenishmentIds[0] || '')}">审核处理</button>
                </div>
              </article>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function countRowsByTab(rows: ReplenishmentSuggestionRow[], tab: WorkbenchTabKey): number {
  if (tab === 'all') return rows.length
  if (tab === 'pending') return rows.filter((row) => ['PENDING_REVIEW', 'PENDING_SUPPLEMENT'].includes(row.statusMeta.key)).length
  if (tab === 'handled') {
    return rows.filter((row) =>
      ['APPROVED_PENDING_ACTION', 'IN_ACTION', 'COMPLETED'].includes(row.statusMeta.key) &&
      Boolean(row.review?.reviewResult),
    ).length
  }
  if (tab === 'closing') return rows.filter((row) => normalizeReplenishmentReviewResult(row.review?.reviewResult) === '需要补料').length
  return rows.filter((row) => row.review?.reviewResult && normalizeReplenishmentReviewResult(row.review.reviewResult) === '仅记录差异').length
}

function renderWorkbenchTabs(): string {
  const rows = filterReplenishmentRows(buildViewModel().rows, state.filters, state.prefilter)
  const tabs: Array<{ key: WorkbenchTabKey; label: string; hint: string }> = [
    { key: 'pending', label: '待处理差异', hint: '实际差异进入处理' },
    { key: 'handled', label: '已处理', hint: '已有处理结果' },
    { key: 'closing', label: '发起布料', hint: '对接 WMS 中转仓' },
    { key: 'record-only', label: '忽略', hint: '不创建配料' },
    { key: 'all', label: '全部记录', hint: '查看完整处理项' },
  ]

  return `
    <section class="rounded-lg border bg-card p-2">
      <div class="grid gap-2 md:grid-cols-5">
        ${tabs
          .map((tab) => {
            const active = state.activeTab === tab.key
            return `
              <button type="button" class="rounded-md border px-3 py-2 text-left text-sm ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-cutting-replenish-action="set-tab" data-tab-key="${tab.key}">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">${escapeHtml(tab.label)}</span>
                  <span class="tabular-nums">${escapeHtml(String(countRowsByTab(rows, tab.key)))}</span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(tab.hint)}</div>
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const toneClass =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return `<section class="rounded-lg border px-3 py-2 text-sm ${toneClass}">${escapeHtml(state.feedback.message)}</section>`
}

function renderPrefilterBar(): string {
  if (!state.prefilter) return ''
  const labels = [
    ...buildCuttingDrillChipLabels(state.drillContext),
    state.prefilter.color ? `颜色：${state.prefilter.color}` : '',
    state.prefilter.riskLevel ? `风险：${replenishmentRiskMetaMap[state.prefilter.riskLevel].label}` : '',
    state.prefilter.replenishmentStatus ? `状态：${getPrefilterStatusLabel(state.prefilter.replenishmentStatus)}` : '',
  ].filter(Boolean)

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按外部上下文预筛补料纠偏项',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-replenish-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-replenish-action="clear-prefilter"',
  })
}

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${renderWorkbenchFilterChip(
          state.filters.pendingReviewOnly ? '仅看待审核：已开启' : '仅看待审核',
          'data-cutting-replenish-action="toggle-pending-review"',
          state.filters.pendingReviewOnly ? 'amber' : 'blue',
        )}
        ${renderWorkbenchFilterChip(
          state.filters.pendingActionOnly ? '仅看需后续处理：已开启' : '仅看需后续处理',
          'data-cutting-replenish-action="toggle-pending-action"',
          state.filters.pendingActionOnly ? 'amber' : 'blue',
        )}
        <button type="button" class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-cutting-replenish-action="clear-filters">重置筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input type="text" value="${escapeHtml(state.filters.keyword)}" placeholder="支持裁片单号 / 唛架方案号 / 生产单号 / 面料 SKU" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="keyword" />
        </label>
        ${renderFilterSelect('业务对象', 'sourceType', state.filters.sourceType, [
          { value: 'ALL', label: '全部' },
          { value: 'cut-order', label: '裁片单' },
          { value: 'marker-plan', label: '唛架方案' },
          { value: 'spreading-session', label: '铺布记录' },
          { value: 'pda-feedback', label: '现场反馈' },
        ])}
        ${renderFilterSelect('处理状态', 'status', state.filters.status, [
          { value: 'ALL', label: '全部' },
          { value: 'NO_ACTION', label: '无需发起布料' },
          { value: 'PENDING_REVIEW', label: '待处理' },
          { value: 'PENDING_SUPPLEMENT', label: '待处理' },
          { value: 'APPROVED_PENDING_ACTION', label: '待发起布料' },
          { value: 'IN_ACTION', label: '处理中' },
          { value: 'REJECTED', label: '已忽略' },
          { value: 'COMPLETED', label: '已完成' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
      </div>
    </div>
  `)
}

function renderActionButton(label: string, action: string, suggestionId: string, extraAttrs = ''): string {
  return `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="${action}" data-suggestion-id="${escapeHtml(suggestionId)}" ${extraAttrs}>${escapeHtml(label)}</button>`
}

function renderNextOptionTags(row: ReplenishmentSuggestionRow): string {
  return row.nextOptions
    .map((option) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${option.className}">${escapeHtml(option.label)}</span>`)
    .join('')
}

function getNextOptionButtonLabel(option: ReplenishmentSuggestionRow['nextOptions'][number]): string {
  if (option.key === 'WAIT_NEXT_PICKUP') return '发起布料到中转仓'
  if (option.key === 'REPLAN_MARKER') return '忽略'
  if (option.key === 'CLOSE_CUT_ORDER') return '忽略'
  return option.label
}

function renderNextOptionButtons(row: ReplenishmentSuggestionRow): string {
  return row.nextOptions
    .map((option) => {
      const label = getNextOptionButtonLabel(option)
      return renderActionButton(label, 'go-related', row.suggestionId, `data-target-key="${escapeHtml(option.target)}"`)
    })
    .join('')
}

function renderRowActions(row: ReplenishmentSuggestionRow): string {
  return `
    <div class="flex flex-wrap gap-2">
      ${renderActionButton('查看详情', 'open-detail', row.suggestionId)}
      ${renderNextOptionButtons(row)}
    </div>
  `
}

function renderTable(rows: ReplenishmentSuggestionRow[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无差异处理项。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">来源</th>
          <th class="px-4 py-3 text-left">面料与纸样</th>
          <th class="px-4 py-3 text-left">差异</th>
          <th class="px-4 py-3 text-left">证据</th>
          <th class="px-4 py-3 text-left">审核与后续动作</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const item = buildReplenishmentReviewItem(row)
            return `
            <tr class="border-b align-top bg-card">
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${renderTag(item.sourceType, replenishmentSourceMeta[row.sourceType].className)}
                  ${renderTag(row.riskMeta.label, row.riskMeta.className)}
                </div>
                <button type="button" class="mt-2 block font-medium text-blue-700 hover:underline" data-cutting-replenish-action="open-detail" data-suggestion-id="${escapeHtml(row.suggestionId)}">${escapeHtml(item.replenishmentNo)}</button>
                <div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(row.productionOrderNos.join(' / ') || '待补')}</div>
                <div class="mt-1 text-xs text-muted-foreground">裁片单：${escapeHtml(row.cutOrderNos.join(' / ') || '待补')}</div>
                <div class="mt-1 text-xs text-muted-foreground">铺布单：${escapeHtml(item.spreadingOrderNo || '未关联')}</div>
                <div class="mt-1 text-xs text-muted-foreground">唛架方案：${escapeHtml(item.markerPlanNo || '未关联')}</div>
              </td>
              <td class="px-4 py-3">
                ${renderMaterialIdentityBlock(
                  {
                    materialSku: item.materialIdentity.materialSku,
                    materialLabel: item.materialIdentity.materialName,
                    materialCategory: row.materialCategory,
                    materialAlias: item.materialIdentity.materialAlias,
                    materialImageUrl: item.materialIdentity.materialImageUrl,
                  },
                  { compact: true, imageSizeClass: 'h-9 w-9' },
                )}
                <div class="mt-2 text-xs text-muted-foreground">颜色：${escapeHtml(item.materialIdentity.materialColor)}</div>
                <div class="mt-1 text-xs text-muted-foreground">纸样：${escapeHtml(item.patternIdentity.patternFileName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">有效幅宽：${escapeHtml(item.patternIdentity.effectiveWidthText)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  ${renderTag(item.differenceType, item.differenceLevel === '需处理' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}
                  ${row.sourceDifferenceCount > 1 ? `<span class="text-xs text-muted-foreground">+${row.sourceDifferenceCount - 1}</span>` : ''}
                </div>
                <div class="mt-2 text-xs text-muted-foreground">计划值：${escapeHtml(`${formatQty(item.plannedValue)} ${item.unit}`)}</div>
                <div class="mt-1 text-xs text-muted-foreground">实际值：${escapeHtml(`${formatQty(item.actualValue)} ${item.unit}`)}</div>
                <div class="mt-1 text-xs font-medium ${Math.abs(item.differenceValue) > 0 ? 'text-rose-600' : 'text-foreground'}">差异值：${escapeHtml(`${formatQty(Math.abs(item.differenceValue))} ${item.unit}`)}</div>
                <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.differenceSummary)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="text-xs text-muted-foreground">${escapeHtml(item.evidenceItems[0]?.summary || row.note)}</div>
                <div class="mt-1 text-xs text-muted-foreground">PDA 反馈：${escapeHtml(row.latestPdaFeedbackSummary || '无')}</div>
                <div class="mt-1 text-xs text-muted-foreground">凭证：${escapeHtml(String(item.evidenceItems.filter((evidence) => evidence.evidenceType === '照片').length || row.latestPdaFeedback?.photoProofCount || 0))} 项</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${renderTag(row.statusMeta.label, row.statusMeta.className)}
                  ${row.review?.reviewResult ? renderTag(formatReplenishmentReviewResultLabel(row.review.reviewResult), normalizeReplenishmentReviewResult(row.review.reviewResult) === '仅记录差异' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700') : ''}
                </div>
                <div class="mt-2 flex flex-wrap gap-2">${renderNextOptionTags(row)}</div>
                <div class="mt-1 text-xs text-muted-foreground">后续动作：${escapeHtml(item.nextAction || row.nextActionLabel)}</div>
                <div class="mt-1 text-xs text-muted-foreground">数量账事件：${escapeHtml(item.linkedLedgerEventIds.length ? item.linkedLedgerEventIds.join(' / ') : '无直接变更')}</div>
              </td>
              <td class="px-4 py-3">
                ${renderRowActions(row)}
              </td>
            </tr>
          `
          })
          .join('')}
      </tbody>
    </table>
  `)
}

function renderEvidenceSection(row: ReplenishmentSuggestionRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">差异依据</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">业务对象</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.sourceLabel)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源裁片单</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.cutOrderNos.join(' / ') || '待补')}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源唛架方案</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.markerPlanNo || '无')}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源生产单</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.productionOrderNos.join(' / ') || '待补')}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源唛架</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.context.marker?.markerNo || '未关联')}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源铺布记录</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.context.session?.sessionNo || '未关联')}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">面料</div>
          <div class="mt-2">${renderMaterialIdentityBlock({
            materialSku: row.materialSku,
            materialLabel: row.materialSku,
            materialCategory: row.materialCategory,
            materialAlias: row.materialAlias,
            materialImageUrl: row.materialImageUrl,
          })}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">面料类别</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.materialCategory)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">面料属性</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.materialAttr)}</div>
        </article>
      </div>
    </section>
  `
}

function renderSpreadingDifferenceSection(row: ReplenishmentSuggestionRow): string {
  if (!row.sourceDifferences.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">铺布与裁剪差异</h3>
        <div class="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">当前没有关联铺布或裁剪差异事项。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">铺布与裁剪差异</h3>
        <span class="text-xs text-muted-foreground">${escapeHtml(`${row.sourceDifferenceCount} 项 · ${row.differenceTypeSummary}`)}</span>
      </div>
      <div class="mt-3 grid gap-3">
        ${row.sourceDifferences
          .map(
            (difference) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    ${renderTag(difference.differenceType, difference.differenceLevel === '需处理' ? 'bg-rose-100 text-rose-700' : difference.differenceLevel === '待处理' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700')}
                    ${renderTag(difference.handlingStatus, difference.handlingStatus === '待处理' ? 'bg-amber-100 text-amber-700' : difference.handlingStatus === '已处理' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}
                    <span class="text-xs text-muted-foreground">${escapeHtml(difference.sourceType)}</span>
                  </div>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="go-related" data-target-key="markerSpreading" data-suggestion-id="${escapeHtml(row.suggestionId)}">查看铺布单</button>
                </div>
                <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                  <div>铺布单：<span class="font-medium text-foreground">${escapeHtml(difference.spreadingOrderNo)}</span></div>
                  <div>计划值：<span class="font-medium text-foreground">${escapeHtml(`${formatQty(difference.plannedValue)} ${difference.unit}`)}</span></div>
                  <div>实际值：<span class="font-medium text-foreground">${escapeHtml(`${formatQty(difference.actualValue)} ${difference.unit}`)}</span></div>
                  <div>差异值：<span class="font-medium text-foreground">${escapeHtml(`${formatQty(Math.abs(difference.differenceValue))} ${difference.unit}`)}</span></div>
                </div>
                <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(difference.evidence.summary)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${difference.detectedBy} · ${formatDateTime(difference.detectedAt)}${difference.evidence.note ? ` · ${difference.evidence.note}` : ''}`)}</div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderDifferenceSection(row: ReplenishmentSuggestionRow): string {
  const latestUpdatedAt = row.context.session?.updatedAt || row.context.marker?.updatedAt || row.createdAt
  const latestOperatorName =
    row.context.session?.completionLinkage?.completedBy || row.context.marker?.updatedBy || '待补'
  const lineRequiredValues = row.lines.map((line) => line.requiredGarmentQty)
  const lineActualValues = row.lines.map((line) => line.actualCutGarmentQty)
  const lineClaimedValues = row.lines.map((line) => line.claimedLengthTotal)
  const lineActualLengthValues = row.lines.map((line) => line.actualLengthTotal)
  const lineColorSummary = Array.from(new Set(row.lines.map((line) => line.color).filter(Boolean))).join(' / ') || '待补'

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">差异与数量账</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderMetricCard('计划裁剪成衣件数（件）', `${formatQty(row.requiredGarmentQty)} 件`, {
          formula: buildQtySumFormula(row.requiredGarmentQty, lineRequiredValues),
        })}
        ${renderMetricCard('理论裁剪成衣件数（件）', `${formatQty(row.theoreticalCutGarmentQty)} 件`, {
          formula: row.summaryRuleText || `${formatQty(row.theoreticalCutGarmentQty)} = 铺布理论裁剪成衣件数`,
        })}
        ${renderMetricCard('实际裁剪成衣件数（件）', `${formatQty(row.actualCutGarmentQty)} 件`, {
          formula: buildQtySumFormula(row.actualCutGarmentQty, lineActualValues),
        })}
        ${renderMetricCard('差异成衣件数（件）', `${formatQty(row.shortageGarmentQty)} 件`, {
          formula: `max(${formatQty(row.requiredGarmentQty)} - ${formatQty(row.actualCutGarmentQty)}, 0) = ${formatQty(row.shortageGarmentQty)}`,
          valueClassName: row.shortageGarmentQty > 0 ? 'font-medium text-rose-600' : 'font-medium text-foreground',
        })}
        ${renderMetricCard('中转仓已配数量（m）', formatLength(row.configuredLengthTotal))}
        ${renderMetricCard('裁床已领数量（m）', formatLength(row.claimedLengthTotal), {
          formula: buildLengthSumFormula(row.claimedLengthTotal, lineClaimedValues),
        })}
        ${renderMetricCard('实际消耗数量（m）', formatLength(row.actualLengthTotal), {
          formula: buildLengthSumFormula(row.actualLengthTotal, lineActualLengthValues),
        })}
        ${renderMetricCard('已领余额（m）', formatLength(row.claimedBalanceLength), {
          formula: `max(${Number(row.claimedLengthTotal || 0).toFixed(2)} - ${Number(row.actualLengthTotal || 0).toFixed(2)}, 0) = ${Number(row.claimedBalanceLength || 0).toFixed(2)}`,
          valueClassName: row.claimedBalanceLength > 0 ? 'font-medium text-blue-700' : 'font-medium text-foreground',
        })}
        ${renderMetricCard('面料缺口长度（m）', formatLength(row.materialGapLength), {
          formula: `max(${Number(row.shortageLengthTotal || 0).toFixed(2)}, ${Number(row.actualLengthTotal || 0).toFixed(2)} - ${Number(row.claimedLengthTotal || 0).toFixed(2)}, 0) = ${Number(row.materialGapLength || 0).toFixed(2)}`,
          valueClassName: row.materialGapLength > 0 ? 'font-medium text-rose-600' : 'font-medium text-foreground',
        })}
        ${renderMetricCard('账面差异长度（m）', formatLength(row.varianceLength), {
          formula: buildLengthDifferenceFormula(row.varianceLength, row.claimedLengthTotal, row.actualLengthTotal),
          valueClassName: row.varianceLength < 0 ? 'font-medium text-rose-600' : 'font-medium text-foreground',
        })}
        ${renderMetricCard('来源颜色', lineColorSummary)}
        ${renderMetricCard('最近更新时间', formatDateTime(latestUpdatedAt))}
        ${renderMetricCard('最近操作人', latestOperatorName)}
        ${renderMetricCard('判定依据', row.summaryRuleText || row.note)}
      </div>
      <div class="mt-3 rounded-lg border border-dashed bg-amber-50/70 p-3 text-xs text-muted-foreground">${escapeHtml(row.note)}</div>
    </section>
  `
}

function renderSuggestionLineSection(row: ReplenishmentSuggestionRow): string {
  if (!row.lines.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">差异明细</h3>
        <div class="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">当前差异尚未拆到裁片单 × 面料 × 颜色维度。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">差异明细</h3>
        <span class="text-xs text-muted-foreground">${escapeHtml(`${formatQty(row.lines.length)} 条 = 裁片单 × 面料 × 颜色`)}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        ${row.lines
          .map(
            (line) => `
              <article class="rounded-lg border bg-muted/20 p-3 text-xs">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-foreground">${escapeHtml(line.cutOrderNo || line.cutOrderId)}</div>
                    <div class="mt-1 text-muted-foreground">颜色：${escapeHtml(line.color || '待补')}</div>
                  </div>
                  <div>${renderMaterialIdentityBlock({
                    materialSku: line.materialSku,
                    materialLabel: line.materialSku,
                    materialAlias: line.materialAlias,
                    materialImageUrl: line.materialImageUrl,
                  }, { compact: true })}</div>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>计划裁剪：<span class="font-medium text-foreground">${escapeHtml(`${formatQty(line.requiredGarmentQty)} 件`)}</span></div>
                  <div>实际裁剪：<span class="font-medium text-foreground">${escapeHtml(`${formatQty(line.actualCutGarmentQty)} 件`)}</span></div>
                  <div>裁床已领：<span class="font-medium text-foreground">${escapeHtml(formatLength(line.claimedLengthTotal))}</span></div>
                  <div>实际消耗：<span class="font-medium text-foreground">${escapeHtml(formatLength(line.actualLengthTotal))}</span></div>
                  <div>差异件数：<span class="${line.shortageGarmentQty > 0 ? 'font-medium text-rose-600' : 'font-medium text-foreground'}">${escapeHtml(`${formatQty(line.shortageGarmentQty)} 件`)}</span></div>
                  <div>建议动作：<span class="font-medium text-foreground">${escapeHtml(line.suggestedAction)}</span></div>
                </div>
                <div class="mt-2 text-muted-foreground">${escapeHtml(line.suggestedActionRuleText)}</div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderReviewSection(row: ReplenishmentSuggestionRow): string {
  const currentResult = row.review?.reviewResult ? normalizeReplenishmentReviewResult(row.review.reviewResult) : ''
  const currentDecisionText = currentResult
    ? currentResult === '需要补料'
      ? '发起布料，由 WMS 中转仓创建新的配料。'
      : '忽略本次差异，不创建配料。'
    : '待处理差异，处理结果只能选择发起布料或忽略。'

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">处理判断</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">当前处理结果</div>
          <div class="mt-1 flex flex-wrap gap-2">
            ${row.review ? renderTag(row.reviewResultLabel, normalizeReplenishmentReviewResult(row.review.reviewResult) === '仅记录差异' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700') : '<span class="text-xs text-muted-foreground">未处理</span>'}
            ${renderTag(row.statusMeta.label, row.statusMeta.className)}
          </div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(currentDecisionText)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">当前后续方向</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.nextActionLabel)}</div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.blockingSummary)}</div>
        </article>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">处理结论</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-review-field="result">
            <option value="需要补料" ${state.reviewDraft.result === '需要补料' ? 'selected' : ''}>发起布料</option>
            <option value="仅记录差异" ${state.reviewDraft.result === '仅记录差异' ? 'selected' : ''}>忽略</option>
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">决策原因</span>
          <input type="text" value="${escapeHtml(state.reviewDraft.reason)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="填写本次处理判断依据" data-cutting-replenish-review-field="reason" />
        </label>
      </div>
      <label class="mt-3 block space-y-2">
        <span class="text-xs text-muted-foreground">补充备注</span>
        <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="补充处理依据或纠偏说明" data-cutting-replenish-review-field="note">${escapeHtml(state.reviewDraft.note)}</textarea>
      </label>
    </section>
  `
}

function renderActionRows(row: ReplenishmentSuggestionRow): string {
  if (!row.followupActions.length) {
    return '<div class="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">当前无需后续动作。</div>'
  }

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left">动作类型</th>
            <th class="px-3 py-2 text-left">状态</th>
            <th class="px-3 py-2 text-left">说明</th>
            <th class="px-3 py-2 text-left">跳转方向</th>
            <th class="px-3 py-2 text-left">状态维护</th>
          </tr>
        </thead>
        <tbody>
          ${row.followupActions
            .map((action) => {
              const typeMeta = replenishmentFollowupActionTypeMetaMap[action.actionType]
              const statusMeta = replenishmentFollowupActionStatusMetaMap[action.status]
              return `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      ${renderTag(typeMeta.label, typeMeta.className)}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(action.title)}</div>
                  </td>
                  <td class="px-3 py-3">
                    ${renderTag(statusMeta.label, statusMeta.className)}
                    <div class="mt-1 text-xs text-muted-foreground">
                      ${escapeHtml(
                        action.status === 'DONE'
                          ? `${action.completedBy || '待补'} · ${action.completedAt || '待补'}`
                          : action.status === 'SKIPPED'
                            ? `${action.decidedBy || '待补'} · ${action.decidedAt || '待补'}`
                            : action.status === 'CONFIRMED'
                              ? `${action.decidedBy || '待补'} · ${action.decidedAt || '待补'}`
                              : '待处理',
                      )}
                    </div>
                  </td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(action.note || '无补充说明')}</td>
                  <td class="px-3 py-3">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="go-followup-target" data-action-id="${escapeHtml(action.actionId)}">${escapeHtml(getCuttingNavigationActionLabel(action.targetPageKey as CuttingNavigationTarget))}</button>
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      ${action.status === 'PENDING' ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="confirm-followup" data-action-id="${escapeHtml(action.actionId)}">确认动作</button>` : ''}
                      ${['PENDING', 'CONFIRMED'].includes(action.status) ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="complete-followup" data-action-id="${escapeHtml(action.actionId)}">标记完成</button>` : ''}
                      ${['PENDING', 'CONFIRMED'].includes(action.status) ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="skip-followup" data-action-id="${escapeHtml(action.actionId)}">跳过</button>` : ''}
                    </div>
                  </td>
                </tr>
              `
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderActionsSection(row: ReplenishmentSuggestionRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">后续动作</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.nextActionSummary)}</p>
        </div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${row.nextOptions
          .map(
            (option) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${option.className}">${escapeHtml(option.label)}</span>
                </div>
                <p class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(option.detailText)}</p>
                <div class="mt-3">
                  ${renderActionButton(getNextOptionButtonLabel(option), 'go-related', row.suggestionId, `data-target-key="${escapeHtml(option.target)}"`)}
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderLedgerImpactSection(row: ReplenishmentSuggestionRow): string {
  const item = buildReplenishmentReviewItem(row)
  const result = row.review?.reviewResult ? normalizeReplenishmentReviewResult(row.review.reviewResult) : ''
  const eventText =
    result === '需要补料'
      ? '处理结果为发起布料，后续由 WMS 中转仓创建新的配料，数量账等待配料和领料事件更新。'
      : result === '仅记录差异'
        ? '处理结果为忽略，不产生数量账变更事件，仅保留差异记录。'
        : '待处理，当前无数量账变更事件。'

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">数量账影响</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">处理结论</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(formatReplenishmentReviewResultLabel(result))}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">后续动作</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(item.nextAction || row.nextActionSummary)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">数量账事件</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(item.linkedLedgerEventIds.join(' / ') || '无直接变更')}</div>
        </article>
      </div>
      <div class="mt-3 rounded-lg border border-dashed bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">${escapeHtml(eventText)}</div>
    </section>
  `
}

function renderAuditSection(row: ReplenishmentSuggestionRow): string {
  const audits = state.audits
    .filter((item) => item.suggestionId === row.suggestionId)
    .sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
  const auditActionMeta: Record<ReplenishmentAuditTrail['action'], { label: string; className: string }> = {
    SUGGESTED: { label: '生成建议', className: 'bg-slate-100 text-slate-700' },
    APPROVED: { label: '已处理', className: 'bg-blue-100 text-blue-700' },
    REJECTED: { label: '已忽略', className: 'bg-slate-200 text-slate-700' },
    MARKED_SUPPLEMENT: { label: '标记待处理', className: 'bg-orange-100 text-orange-700' },
    IMPACT_UPDATED: { label: '更新影响', className: 'bg-violet-100 text-violet-700' },
    ACTION_CONFIRMED: { label: '确认动作', className: 'bg-blue-100 text-blue-700' },
    ACTION_SKIPPED: { label: '跳过动作', className: 'bg-slate-100 text-slate-700' },
    ACTION_DONE: { label: '动作完成', className: 'bg-emerald-100 text-emerald-700' },
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">审计记录</h3>
      <div class="mt-3 space-y-2 text-xs text-muted-foreground">
        ${
          audits
            .map(
              (audit) => `
                <article class="rounded-lg border bg-muted/20 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      ${renderTag(auditActionMeta[audit.action].label, auditActionMeta[audit.action].className)}
                      <span class="font-medium text-foreground">${escapeHtml(audit.payloadSummary)}</span>
                    </div>
                    <span>${escapeHtml(formatDateTime(audit.actionAt))}</span>
                  </div>
                  <div class="mt-1">${escapeHtml(`${audit.actionBy} · ${audit.note || '无补充说明'}`)}</div>
                </article>
              `,
            )
            .join('') || '<div class="rounded-lg border border-dashed px-3 py-4 text-center">当前暂无审计记录。</div>'
        }
      </div>
    </section>
  `
}

function renderInlineDetail(): string {
  const row = getActiveRow()
  if (!row) return ''

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4 text-sm" data-testid="cutting-replenishment-detail-page">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h2 class="text-lg font-semibold text-foreground">差异处理详情 · ${escapeHtml(row.suggestionNo)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${row.sourceSummary} · ${row.differenceTypeSummary}`)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-cutting-replenish-action="submit-review" ${canReviewReplenishment(resolveFcsDemoRole('CUTTING_LEAD')) ? '' : `title="${ACTION_PERMISSION_DENIED_TEXT}" disabled`}>保存处理结果</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-material-prep" data-suggestion-id="${escapeHtml(row.suggestionId)}">发起布料到中转仓</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="close-overlay">返回补料管理</button>
        </div>
      </div>
      ${renderEvidenceSection(row)}
      ${renderSpreadingDifferenceSection(row)}
      ${renderDifferenceSection(row)}
      ${renderSuggestionLineSection(row)}
      ${renderReviewSection(row)}
      ${renderActionsSection(row)}
      ${renderLedgerImpactSection(row)}
      ${renderAuditSection(row)}
    </section>
  `
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'replenishment')

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStats()}
      ${renderWorkbenchTabs()}
      ${renderBindingReplenishmentBridge()}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderTable(getFilteredRows())}
    </div>
  `
}

function renderDetailPage(): string {
  syncPrefilterFromQuery()
  const params = getWarehouseSearchParams()
  const suggestionId = params.get('suggestionId') || params.get('replenishmentId') || state.activeSuggestionId
  const rows = buildViewModel().rows
  const row = rows.find((item) => item.suggestionId === suggestionId) || rows[0] || null
  state.activeSuggestionId = row?.suggestionId || null
  if (row) syncReviewDraft(row)
  const meta = {
    ...getCanonicalCuttingMeta('/fcs/craft/cutting/replenishment', 'replenishment'),
    pageTitle: '差异处理详情',
  }

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="close-overlay">返回补料管理</button>',
      })}
      ${renderFeedbackBar()}
      ${row ? renderInlineDetail() : '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">未找到差异处理详情。</section>'}
    </div>
  `
}

function navigateBySuggestion(
  suggestionId: string | undefined,
  target: keyof ReplenishmentSuggestionRow['navigationPayload'] | 'spreadingList',
): boolean {
  if (!suggestionId) return false
  const row = buildViewModel().rowsById[suggestionId]
  if (!row) return false
  const payload = target === 'spreadingList' ? row.navigationPayload.markerSpreading : row.navigationPayload[target]
  const context = buildCuttingDrillContext(payload, 'replenishment', {
    productionOrderNo: row.productionOrderNos[0] || undefined,
    cutOrderNo: row.cutOrderNos[0] || undefined,
    markerPlanNo: row.markerPlanNo || undefined,
    materialSku: row.materialSku,
    suggestionId: row.suggestionId,
    suggestionNo: row.suggestionNo,
    autoOpenDetail: true,
  })
  appStore.navigate(
    buildCuttingRouteWithContext(target === 'spreadingList' ? 'spreadingList' : (target as CuttingNavigationTarget), context),
  )
  return true
}

function navigateByAction(actionId: string | undefined): boolean {
  const matched = getFollowupActionById(actionId)
  if (!matched) return false
  const context = buildCuttingDrillContext(matched.action.targetQuery, 'replenishment', {
    productionOrderNo: matched.row.productionOrderNos[0] || undefined,
    cutOrderNo: matched.row.cutOrderNos[0] || undefined,
    markerPlanNo: matched.row.markerPlanNo || undefined,
    materialSku: matched.row.materialSku,
    suggestionId: matched.row.suggestionId,
    suggestionNo: matched.row.suggestionNo,
    autoOpenDetail: true,
  })
  appStore.navigate(buildCuttingRouteWithContext(matched.action.targetPageKey as CuttingNavigationTarget, context))
  return true
}

function updateFollowupActionStatus(options: {
  actionId: string | undefined
  nextStatus: ReplenishmentFollowupActionStatus
  auditAction: 'ACTION_CONFIRMED' | 'ACTION_SKIPPED' | 'ACTION_DONE'
  actor: string
  successMessage: string
}): boolean {
  const matched = getFollowupActionById(options.actionId)
  if (!matched) return false
  if (matched.row.review?.reviewStatus !== 'APPROVED') {
    setFeedback('warning', '请先审核通过，再处理后续动作。')
    return true
  }

  const now = nowText()
  const nextAction: ReplenishmentFollowupAction = {
    ...matched.action,
    status: options.nextStatus,
    note: matched.action.note,
    decidedAt: ['CONFIRMED', 'SKIPPED', 'DONE'].includes(options.nextStatus)
      ? matched.action.decidedAt || now
      : matched.action.decidedAt,
    decidedBy: ['CONFIRMED', 'SKIPPED', 'DONE'].includes(options.nextStatus)
      ? matched.action.decidedBy || options.actor
      : matched.action.decidedBy,
    completedAt: options.nextStatus === 'DONE' ? now : '',
    completedBy: options.nextStatus === 'DONE' ? options.actor : '',
  }

  upsertFollowupAction(nextAction)
  prependAudit(
    buildReplenishmentAuditTrail({
      suggestion: matched.row,
      action: options.auditAction,
      actionBy: options.actor,
      payloadSummary: `${matched.row.suggestionNo} · ${matched.action.title} 已更新为 ${replenishmentFollowupActionStatusMetaMap[options.nextStatus].label}`,
      note: nextAction.note,
      actionAt: now,
    }),
  )
  persistStore()
  setFeedback('success', options.successMessage)
  return true
}

export function renderCraftCuttingReplenishmentPage(): string {
  return renderPage()
}

export function renderCraftCuttingReplenishmentDetailPage(): string {
  return renderDetailPage()
}

export function handleCraftCuttingReplenishmentEvent(target: Element): boolean {
  const filterFieldNode = target.closest<HTMLElement>('[data-cutting-replenish-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.cuttingReplenishField as FilterField | undefined
    if (!field) return false
    state.filters = {
      ...state.filters,
      [field]: (filterFieldNode as HTMLInputElement | HTMLSelectElement).value,
    }
    return true
  }

  const reviewFieldNode = target.closest<HTMLElement>('[data-cutting-replenish-review-field]')
  if (reviewFieldNode) {
    const field = reviewFieldNode.dataset.cuttingReplenishReviewField as ReviewField | undefined
    if (!field) return false
    if (field === 'result') {
      const result = normalizeReplenishmentReviewResult((reviewFieldNode as HTMLSelectElement).value as ReplenishmentReviewResult)
      state.reviewDraft.result = result
      state.reviewDraft.status = resolveReviewStatusFromResult(result)
      if (result === '需要补料' && !state.reviewDraft.reason) state.reviewDraft.reason = '发起布料，由 WMS 中转仓创建新的配料。'
      if (result === '仅记录差异' && !state.reviewDraft.reason) state.reviewDraft.reason = '本次差异忽略，不创建配料。'
      return true
    }
    if (field === 'status') state.reviewDraft.status = (reviewFieldNode as HTMLSelectElement).value as ReplenishmentReviewStatus
    if (field === 'reason') state.reviewDraft.reason = (reviewFieldNode as HTMLInputElement).value
    if (field === 'note') state.reviewDraft.note = (reviewFieldNode as HTMLTextAreaElement).value
    if (field === 'closeReasonCode') state.reviewDraft.closeReasonCode = (reviewFieldNode as HTMLSelectElement).value as NonNullable<ReplenishmentReview['closeReasonCode']>
    if (field === 'closeReason') state.reviewDraft.closeReason = (reviewFieldNode as HTMLInputElement).value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-replenish-action]')
  const action = actionNode?.dataset.cuttingReplenishAction
  if (!action) return false

  clearFeedback()

  if (action === 'open-detail' || action === 'open-review' || action === 'open-actions') {
    const suggestionId = actionNode.dataset.suggestionId
    if (!suggestionId) return false
    state.activeSuggestionId = suggestionId
    syncReviewDraft(buildViewModel().rowsById[suggestionId] || null)
    appStore.navigate(`${getCanonicalCuttingPath('replenishment')}-detail?suggestionId=${encodeURIComponent(suggestionId)}`)
    return true
  }

  if (action === 'close-overlay') {
    state.activeSuggestionId = null
    appStore.navigate(getCanonicalCuttingPath('replenishment'))
    return true
  }

  if (action === 'set-tab') {
    const tabKey = actionNode.dataset.tabKey as WorkbenchTabKey | undefined
    if (!tabKey) return false
    state.activeTab = tabKey
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.activeSuggestionId = null
    state.querySignature = getCanonicalCuttingPath('replenishment')
    appStore.navigate(getCanonicalCuttingPath('replenishment'))
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    return true
  }

  if (action === 'toggle-pending-review') {
    state.filters.pendingReviewOnly = !state.filters.pendingReviewOnly
    return true
  }

  if (action === 'toggle-pending-action') {
    state.filters.pendingActionOnly = !state.filters.pendingActionOnly
    return true
  }

  if (action === 'submit-review') {
    if (!canReviewReplenishment(resolveFcsDemoRole('CUTTING_LEAD'))) {
      setFeedback('warning', ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
    const row = getActiveRow()
    if (!row) return false
    const validation = validateReplenishmentReviewAction({
      suggestion: row,
      reviewStatus: resolveReviewStatusFromResult(state.reviewDraft.result),
      reviewResult: state.reviewDraft.result,
      decisionReason: state.reviewDraft.reason,
      closeReason: state.reviewDraft.closeReason,
    })
    if (!validation.ok) {
      setFeedback('warning', validation.message)
      return true
    }

    const reviewedAt = nowText()
    const normalizedResult = normalizeReplenishmentReviewResult(state.reviewDraft.result)
    const reviewStatus = resolveReviewStatusFromResult(normalizedResult)
    const review: ReplenishmentReview = {
      reviewId: `review-${row.suggestionId}`,
      suggestionId: row.suggestionId,
      reviewStatus,
      reviewResult: normalizedResult,
      nextAction: resolveNextActionFromReviewResult(normalizedResult),
      closeReasonCode: undefined,
      closeReason: '',
      linkedLedgerEventIds: row.linkedLedgerEventIds,
      reviewedBy: '补料审核员 徐海宁',
      reviewedAt,
      decisionReason: state.reviewDraft.reason.trim(),
      note: state.reviewDraft.note.trim(),
    }
    const followupAction = buildReplenishmentFollowupActionForResult({
      suggestion: row,
      navigationPayload: row.navigationPayload,
      result: review.reviewResult || '仅记录差异',
      decidedAt: review.reviewedAt,
      decidedBy: review.reviewedBy,
    })
    upsertReview(review)
    replaceFollowupActions(row.suggestionId, followupAction ? [followupAction] : [])
    replacePendingPrepFollowups(row.suggestionId, review.reviewResult === '需要补料' ? buildPendingPrepFollowupRecords(row, review) : [])
    syncSpreadingReplenishmentHandledState(row, Boolean(review.reviewResult))
    prependAudit(
      buildReplenishmentAuditTrail({
        suggestion: row,
        action:
          'APPROVED',
        actionBy: review.reviewedBy,
        payloadSummary: `${row.suggestionNo} 已更新为 ${formatReplenishmentReviewResultLabel(review.reviewResult)}，后续动作：${review.nextAction || '无后续动作'}`,
        note: review.decisionReason || review.note,
      }),
    )
    persistStore()
    setFeedback('success', `已更新 ${row.suggestionNo} 的处理结果：${formatReplenishmentReviewResultLabel(review.reviewResult)}。`)
    return true
  }

  if (action === 'confirm-followup') {
    return updateFollowupActionStatus({
      actionId: actionNode.dataset.actionId,
      nextStatus: 'CONFIRMED',
      auditAction: 'ACTION_CONFIRMED',
      actor: '补料专员 宋安琪',
      successMessage: '已确认后续动作。',
    })
  }

  if (action === 'skip-followup') {
    return updateFollowupActionStatus({
      actionId: actionNode.dataset.actionId,
      nextStatus: 'SKIPPED',
      auditAction: 'ACTION_SKIPPED',
      actor: '补料专员 宋安琪',
      successMessage: '已跳过该后续动作。',
    })
  }

  if (action === 'complete-followup') {
    return updateFollowupActionStatus({
      actionId: actionNode.dataset.actionId,
      nextStatus: 'DONE',
      auditAction: 'ACTION_DONE',
      actor: '补料专员 宋安琪',
      successMessage: '已标记后续动作完成。',
    })
  }

  if (action === 'go-followup-target') {
    return navigateByAction(actionNode.dataset.actionId)
  }

  if (action === 'go-related') {
    const targetKey = (actionNode.dataset.targetKey || 'materialPrep') as keyof ReplenishmentSuggestionRow['navigationPayload']
    return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, targetKey)
  }

  if (action === 'go-marker') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'spreadingList')
  if (action === 'go-material-prep') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'materialPrep')
  if (action === 'go-cut-orders') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'cutOrders')
  if (action === 'go-marker-plan') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'markerPlanSources')
  if (action === 'go-summary') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'summary')

  if (action === 'go-marker-index') {
    appStore.navigate(getCanonicalCuttingPath('spreading-list'))
    return true
  }

  if (action === 'go-cut-order-index') {
    appStore.navigate(getCanonicalCuttingPath('cut-orders'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  return false
}

export function isCraftCuttingReplenishmentDialogOpen(): boolean {
  return state.activeSuggestionId !== null
}
