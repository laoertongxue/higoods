import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildReplenishmentAuditTrail,
  CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  deserializeReplenishmentActionsStorage,
  deserializeReplenishmentAuditTrailStorage,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
  filterReplenishmentRows,
  findReplenishmentByPrefilter,
  replenishmentFollowupActionStatusMetaMap,
  replenishmentFollowupActionTypeMetaMap,
  replenishmentRiskMetaMap,
  replenishmentSourceMeta,
  replenishmentStatusMetaMap,
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
  type ReplenishmentReviewStatus,
  type ReplenishmentSuggestionRow,
} from './replenishment-model'
import { buildReplenishmentProjection } from './replenishment-projection'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import { getWarehouseSearchParams } from './warehouse-shared'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingNavigationActionLabel,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context'

type FilterField = 'keyword' | 'sourceType' | 'status' | 'riskLevel' | 'craftImpact'
type ReviewField = 'status' | 'reason' | 'note'
type FeedbackTone = 'success' | 'warning'

interface ReplenishmentPageState {
  filters: ReplenishmentFilters
  prefilter: ReplenishmentPrefilter | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  activeSuggestionId: string | null
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
  actions: ReplenishmentFollowupAction[]
  audits: ReplenishmentAuditTrail[]
  reviewDraft: {
    status: ReplenishmentReviewStatus
    reason: string
    note: string
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
  craftImpact: 'ALL',
  pendingReviewOnly: false,
  pendingActionOnly: false,
}

const state: ReplenishmentPageState = {
  filters: { ...initialFilters },
  prefilter: null,
  drillContext: null,
  querySignature: '',
  activeSuggestionId: null,
  reviews: deserializeReplenishmentReviewsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY)),
  impactPlans: deserializeReplenishmentImpactPlansStorage(localStorage.getItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY)),
  actions: deserializeReplenishmentActionsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY)),
  audits: deserializeReplenishmentAuditTrailStorage(localStorage.getItem(CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY)),
  reviewDraft: {
    status: 'APPROVED',
    reason: '',
    note: '',
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

function getPrefilterFromQuery(): ReplenishmentPrefilter | null {
  const params = getWarehouseSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: ReplenishmentPrefilter = {
    originalCutOrderNo: drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || undefined,
    originalCutOrderId: drillContext?.originalCutOrderId || params.get('originalCutOrderId') || undefined,
    mergeBatchNo: drillContext?.mergeBatchNo || params.get('mergeBatchNo') || undefined,
    mergeBatchId: drillContext?.mergeBatchId || params.get('mergeBatchId') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
    suggestionId: drillContext?.suggestionId || params.get('suggestionId') || undefined,
    suggestionNo: drillContext?.suggestionNo || params.get('suggestionNo') || undefined,
    riskLevel: (params.get('riskLevel') as ReplenishmentPrefilter['riskLevel']) || undefined,
    replenishmentStatus: (params.get('replenishmentStatus') as ReplenishmentPrefilter['replenishmentStatus']) || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function getPrefilterStatusLabel(value: ReplenishmentPrefilter['replenishmentStatus']): string {
  if (!value) return ''
  if (value === 'APPROVED') return '已通过待动作 / 处理中'
  if (value === 'APPLIED') return '已完成'
  return replenishmentStatusMetaMap[value]?.label || value
}

function syncReviewDraft(row: ReplenishmentSuggestionRow | null): void {
  state.reviewDraft = {
    status: row?.review?.reviewStatus || 'APPROVED',
    reason: row?.review?.decisionReason || '',
    note: row?.review?.note || '',
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
  return filterReplenishmentRows(buildViewModel().rows, state.filters, state.prefilter)
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
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-marker-index">返回铺布列表</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-original-index">查看原始裁片单</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-summary-index">查看裁剪总表</button>
    </div>
  `
}

function renderStats(): string {
  const { stats } = buildViewModel()
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      ${renderCompactKpiCard('补料上下文数', stats.totalCount, '按原始单 / 合批汇总', 'text-slate-900')}
      ${renderCompactKpiCard('待审核', stats.pendingReviewCount, '尚未给出审核结论', 'text-amber-600')}
      ${renderCompactKpiCard('待补录', stats.pendingSupplementCount, '差异依据仍需补齐', 'text-orange-600')}
      ${renderCompactKpiCard('待动作', stats.approvedPendingActionCount, '审核已通过但未开始', 'text-blue-600')}
      ${renderCompactKpiCard('处理中', stats.inActionCount, '后续动作未全部闭环', 'text-violet-600')}
      ${renderCompactKpiCard('已完成', stats.completedCount, '审核与动作均已完成', 'text-fuchsia-600')}
      ${renderCompactKpiCard('高风险', stats.highRiskCount, '需优先纠偏', 'text-rose-600')}
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
          state.filters.pendingActionOnly ? '仅看待处理动作：已开启' : '仅看待处理动作',
          'data-cutting-replenish-action="toggle-pending-action"',
          state.filters.pendingActionOnly ? 'amber' : 'blue',
        )}
        <button type="button" class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-cutting-replenish-action="clear-filters">重置筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input type="text" value="${escapeHtml(state.filters.keyword)}" placeholder="支持裁片单号 / 合批号 / 生产单号 / 面料 SKU" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="keyword" />
        </label>
        ${renderFilterSelect('来源类型', 'sourceType', state.filters.sourceType, [
          { value: 'ALL', label: '全部' },
          { value: 'original-order', label: '原始裁片单' },
          { value: 'merge-batch', label: '合并裁剪批次' },
          { value: 'spreading-session', label: '铺布记录' },
        ])}
        ${renderFilterSelect('状态筛选', 'status', state.filters.status, [
          { value: 'ALL', label: '全部' },
          { value: 'NO_ACTION', label: '无需补料' },
          { value: 'PENDING_REVIEW', label: '待审核' },
          { value: 'PENDING_SUPPLEMENT', label: '待补录' },
          { value: 'APPROVED_PENDING_ACTION', label: '已通过待动作' },
          { value: 'IN_ACTION', label: '处理中' },
          { value: 'REJECTED', label: '审核驳回' },
          { value: 'COMPLETED', label: '已完成' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        ${renderFilterSelect('工艺影响', 'craftImpact', state.filters.craftImpact, [
          { value: 'ALL', label: '全部' },
          { value: 'PRINTING', label: '影响印花' },
          { value: 'DYEING', label: '影响染色' },
          { value: 'SPECIAL_PROCESS', label: '影响特殊工艺' },
        ])}
      </div>
    </div>
  `)
}

function renderActionButton(label: string, action: string, suggestionId: string, extraAttrs = ''): string {
  return `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="${action}" data-suggestion-id="${escapeHtml(suggestionId)}" ${extraAttrs}>${escapeHtml(label)}</button>`
}

function resolvePrimaryFollowupTarget(row: ReplenishmentSuggestionRow): keyof ReplenishmentSuggestionRow['navigationPayload'] {
  const firstAction = row.followupActions.find((item) => item.status !== 'SKIPPED') || row.followupActions[0]
  if (firstAction) return firstAction.targetPageKey
  if (row.statusMeta.key === 'PENDING_SUPPLEMENT') {
    return row.sourceType === 'spreading-session' ? 'markerSpreading' : 'materialPrep'
  }
  return 'materialPrep'
}

function renderRowActions(row: ReplenishmentSuggestionRow): string {
  if (row.statusMeta.key === 'PENDING_REVIEW') {
    return `
      <div class="flex flex-wrap gap-2">
        ${renderActionButton('查看详情', 'open-detail', row.suggestionId)}
        ${renderActionButton('去审核', 'open-review', row.suggestionId)}
      </div>
    `
  }

  if (row.statusMeta.key === 'PENDING_SUPPLEMENT') {
    const action = row.sourceType === 'spreading-session' ? 'go-marker' : 'go-material-prep'
    const label = row.sourceType === 'spreading-session' ? '去铺布' : '去配料领料'
    return `
      <div class="flex flex-wrap gap-2">
        ${renderActionButton('查看详情', 'open-detail', row.suggestionId)}
        ${renderActionButton(label, action, row.suggestionId)}
      </div>
    `
  }

  if (['APPROVED_PENDING_ACTION', 'IN_ACTION'].includes(row.statusMeta.key)) {
    return `
      <div class="flex flex-wrap gap-2">
        ${renderActionButton('查看详情', 'open-detail', row.suggestionId)}
        ${renderActionButton('处理动作', 'open-actions', row.suggestionId)}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap gap-2">
      ${renderActionButton('查看详情', 'open-detail', row.suggestionId)}
      ${renderActionButton(getCuttingNavigationActionLabel(resolvePrimaryFollowupTarget(row) as CuttingNavigationTarget), 'go-related', row.suggestionId, `data-target-key="${escapeHtml(resolvePrimaryFollowupTarget(row))}"`)}
    </div>
  `
}

function renderTable(rows: ReplenishmentSuggestionRow[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无补料纠偏项。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">建议编号</th>
          <th class="px-4 py-3 text-left">来源上下文</th>
          <th class="px-4 py-3 text-left">来源生产单</th>
          <th class="px-4 py-3 text-left">当前主要缺口</th>
          <th class="px-4 py-3 text-left">审核结果</th>
          <th class="px-4 py-3 text-left">后续动作</th>
          <th class="px-4 py-3 text-left">状态</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `
            <tr class="border-b align-top ${state.activeSuggestionId === row.suggestionId ? 'bg-blue-50/60' : 'bg-card'}">
              <td class="px-4 py-3">
                <button type="button" class="font-medium text-blue-700 hover:underline" data-cutting-replenish-action="open-detail" data-suggestion-id="${escapeHtml(row.suggestionId)}">${escapeHtml(row.suggestionNo)}</button>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.createdAt))}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${renderTag(row.sourceLabel, replenishmentSourceMeta[row.sourceType].className)}
                  ${renderTag(row.riskMeta.label, row.riskMeta.className)}
                </div>
                <div class="mt-1 text-xs text-foreground">${escapeHtml(row.sourceSummary)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${row.materialSku} · ${row.materialCategory}`)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`颜色：${Array.from(new Set(row.lines.map((line) => line.color).filter(Boolean))).join(' / ') || '待补'}`)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="text-xs text-foreground">${escapeHtml(row.sourceProductionSummary)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sourceOrderSummary)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="font-medium ${row.shortageQty > 0 || row.varianceLength < 0 ? 'text-rose-600' : 'text-foreground'}">${escapeHtml(row.majorGapSummary)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.differenceSummary)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${row.review ? renderTag(row.reviewSummary, row.review?.reviewStatus === 'APPROVED' ? 'bg-blue-100 text-blue-700' : row.review?.reviewStatus === 'REJECTED' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700') : '<span class="text-xs text-muted-foreground">未审核</span>'}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.review?.decisionReason || row.suggestedAction)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="text-xs font-medium text-foreground">${escapeHtml(row.followupProgressText)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.impactPlan.impactSummary)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${renderTag(row.statusMeta.label, row.statusMeta.className)}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.blockingSummary)}</div>
              </td>
              <td class="px-4 py-3">
                ${renderRowActions(row)}
              </td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `)
}

function renderEvidenceSection(row: ReplenishmentSuggestionRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">补料依据</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源类型</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.sourceLabel)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源原始裁片单</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.originalCutOrderNos.join(' / ') || '待补')}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">来源合批</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.mergeBatchNo || '无')}</div>
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
          <div class="text-xs text-muted-foreground">面料 SKU</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.materialSku)}</div>
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
      <h3 class="text-sm font-semibold text-foreground">差异计算</h3>
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
        ${renderMetricCard('缺口成衣件数（件）', `${formatQty(row.shortageGarmentQty)} 件`, {
          formula: `max(${formatQty(row.requiredGarmentQty)} - ${formatQty(row.actualCutGarmentQty)}, 0) = ${formatQty(row.shortageGarmentQty)}`,
          valueClassName: row.shortageGarmentQty > 0 ? 'font-medium text-rose-600' : 'font-medium text-foreground',
        })}
        ${renderMetricCard('已配置总长度（m）', formatLength(row.configuredLengthTotal))}
        ${renderMetricCard('已领取总长度（m）', formatLength(row.claimedLengthTotal), {
          formula: buildLengthSumFormula(row.claimedLengthTotal, lineClaimedValues),
        })}
        ${renderMetricCard('总实际铺布长度（m）', formatLength(row.actualLengthTotal), {
          formula: buildLengthSumFormula(row.actualLengthTotal, lineActualLengthValues),
        })}
        ${renderMetricCard('差异长度（m）', formatLength(row.varianceLength), {
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
        <h3 class="text-sm font-semibold text-foreground">补料明细建议</h3>
        <div class="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">当前上下文尚未拆到原始裁片单 × 面料 SKU × 颜色维度。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">补料明细建议</h3>
        <span class="text-xs text-muted-foreground">${escapeHtml(`${formatQty(row.lines.length)} 条建议 = 原始裁片单 × 面料 SKU × 颜色`)}</span>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="min-w-[1280px] text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">原始裁片单</th>
              <th class="px-3 py-2 text-left">面料 SKU</th>
              <th class="px-3 py-2 text-left">颜色</th>
              <th class="px-3 py-2 text-left">计划裁剪成衣件数（件）</th>
              <th class="px-3 py-2 text-left">实际裁剪成衣件数（件）</th>
              <th class="px-3 py-2 text-left">已领取长度（m）</th>
              <th class="px-3 py-2 text-left">总实际铺布长度（m）</th>
              <th class="px-3 py-2 text-left">缺口成衣件数（件）</th>
              <th class="px-3 py-2 text-left">建议动作</th>
            </tr>
          </thead>
          <tbody>
            ${row.lines
              .map(
                (line) => `
                  <tr class="border-b align-top">
                    <td class="px-3 py-3">
                      <div class="font-medium text-foreground">${escapeHtml(line.originalCutOrderNo || line.originalCutOrderId)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.originalCutOrderId)}</div>
                    </td>
                    <td class="px-3 py-3">${escapeHtml(line.materialSku)}</td>
                    <td class="px-3 py-3">${escapeHtml(line.color || '待补')}</td>
                    <td class="px-3 py-3">
                      <div class="font-medium text-foreground">${escapeHtml(`${formatQty(line.requiredGarmentQty)} 件`)}</div>
                      ${renderFormulaLine(`${formatQty(line.requiredGarmentQty)} = 当前补料明细需求成衣件数`)}
                    </td>
                    <td class="px-3 py-3">
                      <div class="font-medium text-foreground">${escapeHtml(`${formatQty(line.actualCutGarmentQty)} 件`)}</div>
                      ${renderFormulaLine(line.actualCutGarmentQtyFormula)}
                    </td>
                    <td class="px-3 py-3">
                      <div class="font-medium text-foreground">${escapeHtml(formatLength(line.claimedLengthTotal))}</div>
                      ${renderFormulaLine(`${Number(line.claimedLengthTotal || 0).toFixed(2)} = 当前补料明细已领取长度`)}
                    </td>
                    <td class="px-3 py-3">
                      <div class="font-medium text-foreground">${escapeHtml(formatLength(line.actualLengthTotal))}</div>
                      ${renderFormulaLine(`${Number(line.actualLengthTotal || 0).toFixed(2)} = 当前补料明细总实际铺布长度`)}
                    </td>
                    <td class="px-3 py-3">
                      <div class="${line.shortageGarmentQty > 0 ? 'font-medium text-rose-600' : 'font-medium text-foreground'}">${escapeHtml(`${formatQty(line.shortageGarmentQty)} 件`)}</div>
                      ${renderFormulaLine(line.shortageGarmentQtyFormula)}
                    </td>
                    <td class="px-3 py-3">
                      <div class="font-medium text-foreground">${escapeHtml(line.suggestedAction)}</div>
                      ${renderFormulaLine(line.suggestedActionRuleText)}
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderReviewSection(row: ReplenishmentSuggestionRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">审核判断</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">当前审核结果</div>
          <div class="mt-1 flex flex-wrap gap-2">
            ${row.review ? renderTag(row.reviewSummary, row.review.reviewStatus === 'APPROVED' ? 'bg-blue-100 text-blue-700' : row.review.reviewStatus === 'REJECTED' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700') : '<span class="text-xs text-muted-foreground">未审核</span>'}
            ${renderTag(row.statusMeta.label, row.statusMeta.className)}
          </div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.review?.decisionReason || row.suggestedAction)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">当前阻塞判断</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.blockingSummary)}</div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.followupProgressText)}</div>
        </article>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">审核动作</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-review-field="status">
            <option value="APPROVED" ${state.reviewDraft.status === 'APPROVED' ? 'selected' : ''}>审核通过</option>
            <option value="REJECTED" ${state.reviewDraft.status === 'REJECTED' ? 'selected' : ''}>审核驳回</option>
            <option value="PENDING_SUPPLEMENT" ${state.reviewDraft.status === 'PENDING_SUPPLEMENT' ? 'selected' : ''}>标记待补录</option>
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">决策原因</span>
          <input type="text" value="${escapeHtml(state.reviewDraft.reason)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="驳回或待补录时必须填写原因" data-cutting-replenish-review-field="reason" />
        </label>
      </div>
      <label class="mt-3 block space-y-2">
        <span class="text-xs text-muted-foreground">补充备注</span>
        <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="补充审核依据或纠偏说明" data-cutting-replenish-review-field="note">${escapeHtml(state.reviewDraft.note)}</textarea>
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
            <th class="px-3 py-2 text-left">处理动作</th>
            <th class="px-3 py-2 text-left">处理</th>
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
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.followupProgressText)} · ${escapeHtml(row.impactPlan.impactSummary)}</p>
        </div>
      </div>
      <div class="mt-3">
        ${renderActionRows(row)}
      </div>
    </section>
  `
}

function renderAuditSection(row: ReplenishmentSuggestionRow): string {
  const audits = state.audits
    .filter((item) => item.suggestionId === row.suggestionId)
    .sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
  const auditActionMeta: Record<ReplenishmentAuditTrail['action'], { label: string; className: string }> = {
    SUGGESTED: { label: '生成建议', className: 'bg-slate-100 text-slate-700' },
    APPROVED: { label: '审核通过', className: 'bg-blue-100 text-blue-700' },
    REJECTED: { label: '审核驳回', className: 'bg-slate-200 text-slate-700' },
    MARKED_SUPPLEMENT: { label: '标记待补录', className: 'bg-orange-100 text-orange-700' },
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

function renderDetailDrawer(): string {
  const row = getActiveRow()
  if (!row) return ''

  return uiDetailDrawer(
    {
      title: `补料详情 · ${row.suggestionNo}`,
      subtitle: '',
      closeAction: { prefix: 'cuttingReplenish', action: 'close-overlay' },
      width: 'xl',
    },
    `
      <div class="space-y-6 text-sm">
        ${renderEvidenceSection(row)}
        ${renderDifferenceSection(row)}
        ${renderSuggestionLineSection(row)}
        ${renderReviewSection(row)}
        ${renderActionsSection(row)}
        ${renderAuditSection(row)}
      </div>
    `,
    `
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="submit-review">提交审核</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-material-prep" data-suggestion-id="${escapeHtml(row.suggestionId)}">去仓库配料领料</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-marker" data-suggestion-id="${escapeHtml(row.suggestionId)}">去铺布</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-summary" data-suggestion-id="${escapeHtml(row.suggestionId)}">去裁剪总表</button>
      </div>
    `,
  )
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'replenishment')

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStats()}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderTable(getFilteredRows())}
      ${renderDetailDrawer()}
    </div>
  `
}

function navigateBySuggestion(
  suggestionId: string | undefined,
  target: keyof ReplenishmentSuggestionRow['navigationPayload'],
): boolean {
  if (!suggestionId) return false
  const row = buildViewModel().rowsById[suggestionId]
  if (!row) return false
  const context = normalizeLegacyCuttingPayload(row.navigationPayload[target], 'replenishment', {
    productionOrderNo: row.productionOrderNos[0] || undefined,
    originalCutOrderNo: row.originalCutOrderNos[0] || undefined,
    mergeBatchNo: row.mergeBatchNo || undefined,
    materialSku: row.materialSku,
    suggestionId: row.suggestionId,
    suggestionNo: row.suggestionNo,
    autoOpenDetail: true,
  })
  appStore.navigate(buildCuttingRouteWithContext(target as CuttingNavigationTarget, context))
  return true
}

function navigateByAction(actionId: string | undefined): boolean {
  const matched = getFollowupActionById(actionId)
  if (!matched) return false
  const context = normalizeLegacyCuttingPayload(matched.action.targetQuery, 'replenishment', {
    productionOrderNo: matched.row.productionOrderNos[0] || undefined,
    originalCutOrderNo: matched.row.originalCutOrderNos[0] || undefined,
    mergeBatchNo: matched.row.mergeBatchNo || undefined,
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
    if (field === 'status') state.reviewDraft.status = (reviewFieldNode as HTMLSelectElement).value as ReplenishmentReviewStatus
    if (field === 'reason') state.reviewDraft.reason = (reviewFieldNode as HTMLInputElement).value
    if (field === 'note') state.reviewDraft.note = (reviewFieldNode as HTMLTextAreaElement).value
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
    return true
  }

  if (action === 'close-overlay') {
    state.activeSuggestionId = null
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
    const row = getActiveRow()
    if (!row) return false
    const validation = validateReplenishmentReviewAction({
      suggestion: row,
      reviewStatus: state.reviewDraft.status,
      decisionReason: state.reviewDraft.reason,
    })
    if (!validation.ok) {
      setFeedback('warning', validation.message)
      return true
    }

    const review: ReplenishmentReview = {
      reviewId: `review-${row.suggestionId}`,
      suggestionId: row.suggestionId,
      reviewStatus: state.reviewDraft.status,
      reviewedBy: '补料审核员 徐海宁',
      reviewedAt: nowText(),
      decisionReason: state.reviewDraft.reason.trim(),
      note: state.reviewDraft.note.trim(),
    }
    upsertReview(review)
    prependAudit(
      buildReplenishmentAuditTrail({
        suggestion: row,
        action:
          state.reviewDraft.status === 'APPROVED'
            ? 'APPROVED'
            : state.reviewDraft.status === 'REJECTED'
              ? 'REJECTED'
              : 'MARKED_SUPPLEMENT',
        actionBy: review.reviewedBy,
        payloadSummary: `${row.suggestionNo} 已更新为 ${state.reviewDraft.status === 'APPROVED' ? '审核通过' : state.reviewDraft.status === 'REJECTED' ? '审核驳回' : '待补录'}`,
        note: review.decisionReason || review.note,
      }),
    )
    persistStore()
    setFeedback('success', `已更新 ${row.suggestionNo} 的审核结果。`)
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

  if (action === 'go-marker') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'markerSpreading')
  if (action === 'go-material-prep') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'materialPrep')
  if (action === 'go-original-orders') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'originalOrders')
  if (action === 'go-merge-batches') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'mergeBatches')
  if (action === 'go-summary') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'summary')
  if (action === 'go-printing') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'printing')
  if (action === 'go-dyeing') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'dyeing')
  if (action === 'go-special-processes') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'specialProcesses')

  if (action === 'go-marker-index') {
    appStore.navigate(getCanonicalCuttingPath('marker-spreading'))
    return true
  }

  if (action === 'go-original-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
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
