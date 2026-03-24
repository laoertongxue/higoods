import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import { buildMaterialPrepViewModel } from './material-prep-model'
import {
  buildReplenishmentAuditTrail,
  buildReplenishmentViewModel,
  CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  deserializeReplenishmentAuditTrailStorage,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
  filterReplenishmentRows,
  findReplenishmentByPrefilter,
  replenishmentRiskMetaMap,
  replenishmentSourceMeta,
  replenishmentStatusMetaMap,
  serializeReplenishmentAuditTrailStorage,
  serializeReplenishmentImpactPlansStorage,
  serializeReplenishmentReviewsStorage,
  validateReplenishmentReviewAction,
  type ReplenishmentAuditTrail,
  type ReplenishmentFilters,
  type ReplenishmentImpactPlan,
  type ReplenishmentPrefilter,
  type ReplenishmentReview,
  type ReplenishmentReviewStatus,
  type ReplenishmentSuggestionRow,
} from './replenishment-model'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
} from './marker-spreading-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import {
  buildWarehouseOriginalRows,
  buildWarehouseRouteWithQuery,
  getWarehouseSearchParams,
  readWarehouseMergeBatchLedger,
} from './warehouse-shared'

type FilterField = 'keyword' | 'sourceType' | 'status' | 'riskLevel' | 'craftImpact'
type ReviewField = 'status' | 'reason' | 'note'
type FeedbackTone = 'success' | 'warning'

interface ReplenishmentPageState {
  filters: ReplenishmentFilters
  prefilter: ReplenishmentPrefilter | null
  querySignature: string
  activeSuggestionId: string | null
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
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
  pendingApplyOnly: false,
}

const state: ReplenishmentPageState = {
  filters: { ...initialFilters },
  prefilter: null,
  querySignature: '',
  activeSuggestionId: null,
  reviews: deserializeReplenishmentReviewsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY)),
  impactPlans: deserializeReplenishmentImpactPlansStorage(localStorage.getItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY)),
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

function buildViewModel() {
  const mergeBatches = readWarehouseMergeBatchLedger()
  const originalRows = buildWarehouseOriginalRows()
  const markerStore = deserializeMarkerSpreadingStorage(localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  const materialPrepRows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, mergeBatches).rows

  return buildReplenishmentViewModel({
    materialPrepRows,
    originalRows,
    mergeBatches,
    markerStore,
    reviews: state.reviews,
    impactPlans: state.impactPlans,
  })
}

function persistStore(): void {
  localStorage.setItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY, serializeReplenishmentReviewsStorage(state.reviews))
  localStorage.setItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY, serializeReplenishmentImpactPlansStorage(state.impactPlans))
  localStorage.setItem(CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY, serializeReplenishmentAuditTrailStorage(state.audits))
}

function getPrefilterFromQuery(): ReplenishmentPrefilter | null {
  const params = getWarehouseSearchParams()
  const prefilter: ReplenishmentPrefilter = {
    originalCutOrderNo: params.get('originalCutOrderNo') || undefined,
    originalCutOrderId: params.get('originalCutOrderId') || undefined,
    mergeBatchNo: params.get('mergeBatchNo') || undefined,
    mergeBatchId: params.get('mergeBatchId') || undefined,
    productionOrderNo: params.get('productionOrderNo') || undefined,
    materialSku: params.get('materialSku') || undefined,
    riskLevel: (params.get('riskLevel') as ReplenishmentPrefilter['riskLevel']) || undefined,
    replenishmentStatus: (params.get('replenishmentStatus') as ReplenishmentPrefilter['replenishmentStatus']) || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
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

function prependAudit(audit: ReplenishmentAuditTrail): void {
  state.audits = [audit, ...state.audits]
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
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
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-marker-index">返回唛架 / 铺布</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-original-index">查看裁片单（原始单）</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

function renderStats(): string {
  const { stats } = buildViewModel()
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('补料建议总数', stats.totalCount, '来源于铺布与裁剪差异', 'text-slate-900')}
      ${renderCompactKpiCard('待审核数', stats.pendingReviewCount, '含待补录', 'text-amber-600')}
      ${renderCompactKpiCard('审核通过数', stats.approvedCount, '待回写动作', 'text-blue-600')}
      ${renderCompactKpiCard('审核驳回数', stats.rejectedCount, '当前不进入回写', 'text-slate-700')}
      ${renderCompactKpiCard('待回写数', stats.pendingApplyCount, '已通过待后续影响确认', 'text-violet-600')}
      ${renderCompactKpiCard('高风险数', stats.highRiskCount, '需优先处理', 'text-rose-600')}
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
    state.prefilter.originalCutOrderNo ? `原始裁片单：${state.prefilter.originalCutOrderNo}` : '',
    state.prefilter.mergeBatchNo ? `合并批次：${state.prefilter.mergeBatchNo}` : '',
    state.prefilter.productionOrderNo ? `生产单：${state.prefilter.productionOrderNo}` : '',
    state.prefilter.materialSku ? `面料 SKU：${state.prefilter.materialSku}` : '',
    state.prefilter.riskLevel ? `风险：${replenishmentRiskMetaMap[state.prefilter.riskLevel].label}` : '',
    state.prefilter.replenishmentStatus ? `状态：${replenishmentStatusMetaMap[state.prefilter.replenishmentStatus].label}` : '',
  ].filter(Boolean)

  return renderWorkbenchStateBar({
    summary: '当前按外部上下文预筛补料建议',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-replenish-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-replenish-action="clear-prefilter"',
  })
}

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${renderWorkbenchFilterChip(state.filters.pendingReviewOnly ? '仅看待审核：已开启' : '仅看待审核', 'data-cutting-replenish-action="toggle-pending-review"', state.filters.pendingReviewOnly ? 'amber' : 'blue')}
        ${renderWorkbenchFilterChip(state.filters.pendingApplyOnly ? '仅看待回写：已开启' : '仅看待回写', 'data-cutting-replenish-action="toggle-pending-apply"', state.filters.pendingApplyOnly ? 'amber' : 'blue')}
        <button type="button" class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-cutting-replenish-action="clear-filters">重置筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input type="text" value="${escapeHtml(state.filters.keyword)}" placeholder="支持原始裁片单号 / 批次号 / 生产单号 / materialSku" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="keyword" />
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
          { value: 'APPROVED', label: '审核通过' },
          { value: 'REJECTED', label: '审核驳回' },
          { value: 'APPLIED', label: '已回写' },
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
        ])}
      </div>
    </div>
  `)
}

function renderTable(rows: ReplenishmentSuggestionRow[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无补料建议。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">建议编号</th>
          <th class="px-4 py-3 text-left">来源</th>
          <th class="px-4 py-3 text-left">materialSku</th>
          <th class="px-4 py-3 text-right">需求数量</th>
          <th class="px-4 py-3 text-right">预计可裁</th>
          <th class="px-4 py-3 text-right">缺口</th>
          <th class="px-4 py-3 text-left">风险</th>
          <th class="px-4 py-3 text-left">状态</th>
          <th class="px-4 py-3 text-left">影响摘要</th>
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
                ${renderTag(row.sourceLabel, replenishmentSourceMeta[row.sourceType].className)}
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sourceSummary)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="font-medium text-foreground">${escapeHtml(row.materialSku)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${row.materialCategory} / ${row.materialAttr}`)}</div>
              </td>
              <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(formatQty(row.requiredQty))}</td>
              <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(formatQty(row.estimatedCapacityQty))}</td>
              <td class="px-4 py-3 text-right tabular-nums ${row.shortageQty > 0 ? 'font-semibold text-rose-600' : 'text-slate-700'}">${escapeHtml(formatQty(row.shortageQty))}</td>
              <td class="px-4 py-3">${renderTag(row.riskMeta.label, row.riskMeta.className)}</td>
              <td class="px-4 py-3">${renderTag(row.statusMeta.label, row.statusMeta.className)}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(row.impactSummary)}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="open-detail" data-suggestion-id="${escapeHtml(row.suggestionId)}">查看详情</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="go-material-prep" data-suggestion-id="${escapeHtml(row.suggestionId)}">去配料</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="go-marker" data-suggestion-id="${escapeHtml(row.suggestionId)}">回铺布</button>
                </div>
              </td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `)
}

function renderDetailDrawer(): string {
  const row = getActiveRow()
  if (!row) return ''

  const audits = state.audits
    .filter((item) => item.suggestionId === row.suggestionId)
    .sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))

  return uiDetailDrawer(
    {
      title: `补料详情 · ${row.suggestionNo}`,
      subtitle: '自动建议只提供依据；审核通过后才能进入后续回写。',
      closeAction: { prefix: 'cuttingReplenish', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">来源摘要</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(row.sourceSummary)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前状态</div>
            <div class="mt-1 flex flex-wrap gap-2">
              ${renderTag(row.statusMeta.label, row.statusMeta.className)}
              ${renderTag(row.riskMeta.label, row.riskMeta.className)}
            </div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">差异依据</h3>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="rounded-lg border bg-muted/20 p-3">
              <div class="text-xs text-muted-foreground">数量差异</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(row.differenceSummary)}</div>
            </div>
            <div class="rounded-lg border bg-muted/20 p-3">
              <div class="text-xs text-muted-foreground">长度差异</div>
              <div class="mt-1 font-medium text-foreground">已配置 ${escapeHtml(String(row.configuredLengthTotal))} 米 / 可用 ${escapeHtml(String(row.usableLengthTotal))} 米 / 差异 ${escapeHtml(String(row.varianceLength))} 米</div>
            </div>
          </div>
          <div class="mt-3 rounded-lg border border-dashed bg-amber-50/70 p-3 text-xs text-muted-foreground">${escapeHtml(row.note)}</div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">审核区</h3>
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
            <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="补充审核依据或影响说明" data-cutting-replenish-review-field="note">${escapeHtml(state.reviewDraft.note)}</textarea>
          </label>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">回写影响区</h3>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <div class="font-medium text-foreground">影响摘要</div>
              <div class="mt-1">${escapeHtml(row.impactPlan.impactSummary)}</div>
            </div>
            <div class="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <div class="font-medium text-foreground">影响标签</div>
              <div class="mt-1 flex flex-wrap gap-2">
                ${row.impactPlan.needReconfigureMaterial ? renderTag('需重新配料', 'bg-blue-100 text-blue-700') : ''}
                ${row.impactPlan.needReclaimMaterial ? renderTag('需重新领料', 'bg-violet-100 text-violet-700') : ''}
                ${row.impactPlan.affectPrintingOrder ? renderTag('影响印花', 'bg-amber-100 text-amber-700') : ''}
                ${row.impactPlan.affectDyeingOrder ? renderTag('影响染色', 'bg-emerald-100 text-emerald-700') : ''}
                ${row.impactPlan.affectSpecialProcess ? renderTag('影响特殊工艺', 'bg-rose-100 text-rose-700') : ''}
                ${!row.impactPlan.needReconfigureMaterial && !row.impactPlan.needReclaimMaterial && !row.impactPlan.affectPrintingOrder && !row.impactPlan.affectDyeingOrder && !row.impactPlan.affectSpecialProcess ? '<span class="text-xs text-muted-foreground">当前无额外影响</span>' : ''}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">审计记录</h3>
          <div class="mt-3 space-y-2 text-xs text-muted-foreground">
            ${audits
              .map(
                (audit) => `
                  <article class="rounded-lg border bg-muted/20 p-3">
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-medium text-foreground">${escapeHtml(audit.payloadSummary)}</span>
                      <span>${escapeHtml(formatDateTime(audit.actionAt))}</span>
                    </div>
                    <div class="mt-1">${escapeHtml(`${audit.actionBy} · ${audit.note || '无补充说明'}`)}</div>
                  </article>
                `,
              )
              .join('') || '<div class="rounded-lg border border-dashed px-3 py-4 text-center">当前暂无审计记录。</div>'}
          </div>
        </section>
      </div>
    `,
    `
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="submit-review">提交审核</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="mark-applied">标记已回写</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-material-prep" data-suggestion-id="${escapeHtml(row.suggestionId)}">去仓库配料 / 领料</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-marker" data-suggestion-id="${escapeHtml(row.suggestionId)}">返回唛架 / 铺布</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-printing" data-suggestion-id="${escapeHtml(row.suggestionId)}">去印花入口</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-dyeing" data-suggestion-id="${escapeHtml(row.suggestionId)}">去染色入口</button>
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

  const pathMap: Record<keyof ReplenishmentSuggestionRow['navigationPayload'], string> = {
    markerSpreading: getCanonicalCuttingPath('marker-spreading'),
    materialPrep: getCanonicalCuttingPath('material-prep'),
    originalOrders: getCanonicalCuttingPath('original-orders'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
    summary: getCanonicalCuttingPath('summary'),
    printing: '/fcs/craft/printing/work-orders',
    dyeing: '/fcs/craft/dyeing/work-orders',
  }

  appStore.navigate(buildWarehouseRouteWithQuery(pathMap[target], row.navigationPayload[target]))
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

  if (action === 'open-detail') {
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

  if (action === 'toggle-pending-apply') {
    state.filters.pendingApplyOnly = !state.filters.pendingApplyOnly
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
        payloadSummary: `${row.suggestionNo} 已更新为 ${replenishmentStatusMetaMap[state.reviewDraft.status === 'APPROVED' ? 'APPROVED' : state.reviewDraft.status === 'REJECTED' ? 'REJECTED' : 'PENDING_SUPPLEMENT'].label}`,
        note: review.decisionReason || review.note,
      }),
    )
    persistStore()
    setFeedback('success', `已更新 ${row.suggestionNo} 的审核结果。`)
    return true
  }

  if (action === 'mark-applied') {
    const row = getActiveRow()
    if (!row) return false
    if (row.statusMeta.key !== 'APPROVED') {
      setFeedback('warning', '只有审核通过的补料建议才能标记已回写。')
      return true
    }

    const impactPlan: ReplenishmentImpactPlan = {
      ...row.impactPlan,
      applied: true,
      appliedAt: nowText(),
      appliedBy: '补料专员 宋安琪',
    }
    upsertImpactPlan(impactPlan)
    prependAudit(
      buildReplenishmentAuditTrail({
        suggestion: row,
        action: 'MARKED_APPLIED',
        actionBy: impactPlan.appliedBy,
        payloadSummary: `${row.suggestionNo} 已标记回写`,
        note: impactPlan.impactSummary,
      }),
    )
    persistStore()
    setFeedback('success', `已将 ${row.suggestionNo} 标记为已回写。`)
    return true
  }

  if (action === 'go-marker') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'markerSpreading')
  if (action === 'go-material-prep') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'materialPrep')
  if (action === 'go-original-orders') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'originalOrders')
  if (action === 'go-merge-batches') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'mergeBatches')
  if (action === 'go-summary') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'summary')
  if (action === 'go-printing') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'printing')
  if (action === 'go-dyeing') return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'dyeing')

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

  return false
}

export function isCraftCuttingReplenishmentDialogOpen(): boolean {
  return state.activeSuggestionId !== null
}
