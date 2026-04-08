import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  type ProductionPieceTruthCompletionKey,
} from '../../../domain/fcs-cutting-piece-truth'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import type { ProductionProgressStageKey } from './production-progress-model'
import {
  buildCuttingSummaryIssues,
  cuttingSummaryIssueMetaMap,
  cuttingSummaryRiskMetaMap,
  filterSummaryByIssueType,
  type CuttingSummaryBuildOptions,
  type CuttingSummaryDetailPanelData,
  type CuttingSummaryIssue,
  type CuttingSummaryIssueType,
  type CuttingSummaryNavigationPayload,
  type CuttingSummaryRiskLevel,
  type CuttingSummaryRow,
  type CuttingSummarySourceObjectItem,
  type CuttingSummaryTraceNode,
  type CuttingSummaryViewModel,
} from './summary-model'
import { getWarehouseSearchParams } from './warehouse-shared'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  getCuttingNavigationActionLabel,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context'
import {
  cuttingCheckSectionLabelMap,
  type CuttingCheckBlockerItem,
  type CuttingCheckNextAction,
  type CuttingCheckSectionKey,
  type CuttingCheckSectionState,
  type CuttingCheckSourceObjectType,
} from './cutting-summary-checks'
import {
  buildFcsCuttingSummaryDetailProjection,
  buildFcsCuttingSummaryProjection,
  type FcsCuttingSummaryProjection,
} from './runtime-projections'

type SummaryFilterField =
  | 'keyword'
  | 'riskLevel'
  | 'issueType'
  | 'currentStage'
  | 'completionState'
  | 'blockerSection'
  | 'sourceObjectType'
  | 'materialSku'
  | 'sourceNoKeyword'
type SummaryNavigationTarget = keyof CuttingSummaryNavigationPayload

interface SummaryFilters {
  keyword: string
  riskLevel: 'ALL' | CuttingSummaryRiskLevel
  issueType: 'ALL' | CuttingSummaryIssueType
  currentStage: 'ALL' | ProductionProgressStageKey
  completionState: 'ALL' | ProductionPieceTruthCompletionKey
  blockerSection: 'ALL' | CuttingCheckSectionKey
  sourceObjectType: 'ALL' | CuttingCheckSourceObjectType
  materialSku: string
  sourceNoKeyword: string
  pendingReplenishmentOnly: boolean
  pendingTicketsOnly: boolean
  pendingBagOnly: boolean
  specialProcessOnly: boolean
}

interface SummaryPageState {
  filters: SummaryFilters
  prefilter: CuttingDrillContext | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  activeIssueId: string | null
  activeRowId: string | null
}

const initialFilters: SummaryFilters = {
  keyword: '',
  riskLevel: 'ALL',
  issueType: 'ALL',
  currentStage: 'ALL',
  completionState: 'ALL',
  blockerSection: 'ALL',
  sourceObjectType: 'ALL',
  materialSku: '',
  sourceNoKeyword: '',
  pendingReplenishmentOnly: false,
  pendingTicketsOnly: false,
  pendingBagOnly: false,
  specialProcessOnly: false,
}

const state: SummaryPageState = {
  filters: { ...initialFilters },
  prefilter: null,
  drillContext: null,
  querySignature: '',
  activeIssueId: null,
  activeRowId: null,
}

const completionSortWeight: Record<ProductionPieceTruthCompletionKey, number> = {
  HAS_EXCEPTION: 0,
  DATA_PENDING: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
}

const blockerLevelMetaMap: Record<CuttingCheckBlockerItem['severity'], { label: string; className: string }> = {
  HIGH: {
    label: '高阻塞',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  MEDIUM: {
    label: '中阻塞',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  LOW: {
    label: '低阻塞',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
}

const sourceObjectTypeLabelMap: Record<CuttingCheckSourceObjectType, string> = {
  ORIGINAL_CUT_ORDER: '原始裁片单',
  MERGE_BATCH: '合并裁剪批次',
  REPLENISHMENT: '补料建议',
  FEI_OWNER: '打票主体',
  FEI_PRINT_JOB: '打印作业',
  BAG_USAGE: '中转袋使用周期',
  SPECIAL_PROCESS: '特殊工艺单',
}

const actionTargetLabelMap: Record<SummaryNavigationTarget, string> = {
  productionProgress: '生产单进度',
  cuttablePool: '可裁排产',
  mergeBatches: '合并裁剪批次',
  originalOrders: '原始裁片单',
  materialPrep: '仓库配料领料',
  markerSpreading: '唛架铺布',
  feiTickets: '打印菲票',
  fabricWarehouse: '裁床仓',
  cutPieceWarehouse: '裁片仓',
  sampleWarehouse: '样衣仓',
  transferBags: '中转袋流转',
  replenishment: '补料管理',
  specialProcesses: '特殊工艺',
  summary: '裁剪总表',
}

const sourceObjectGroupOrder: CuttingCheckSourceObjectType[] = [
  'ORIGINAL_CUT_ORDER',
  'MERGE_BATCH',
  'REPLENISHMENT',
  'FEI_OWNER',
  'FEI_PRINT_JOB',
  'BAG_USAGE',
  'SPECIAL_PROCESS',
]

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function mergeByKey<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const merged = new Map<string, T>()
  seed.forEach((item) => merged.set(String(item[key]), item))
  stored.forEach((item) => merged.set(String(item[key]), item))
  return Array.from(merged.values())
}

function buildSources(): CuttingSummaryBuildOptions {
  return buildProjection().sources
}

function buildPageData(): {
  sources: CuttingSummaryBuildOptions
  viewModel: CuttingSummaryViewModel
} {
  const projection = buildProjection()
  return {
    sources: projection.sources,
    viewModel: projection.viewModel,
  }
}

function buildProjection(): FcsCuttingSummaryProjection {
  return buildFcsCuttingSummaryProjection()
}

function getPrefilterFromQuery(): CuttingDrillContext | null {
  const params = getWarehouseSearchParams()
  const context = readCuttingDrillContextFromLocation(params)
  const issueType = (params.get('issueType') as CuttingSummaryIssueType | null) || undefined
  const blockerSection = params.get('blockerSection') || undefined
  return context || issueType || blockerSection
    ? {
        ...context,
        issueType,
        blockerSection: blockerSection || context?.blockerSection,
      }
    : null
}

function rowMatchesPrefilter(row: CuttingSummaryRow, prefilter: CuttingDrillContext | null): boolean {
  if (!prefilter) return true
  if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo) return false
  if (prefilter.originalCutOrderNo && !row.relatedOriginalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
  if (prefilter.mergeBatchNo && !row.relatedMergeBatchNos.includes(prefilter.mergeBatchNo)) return false
  if (prefilter.ticketNo && !row.relatedTicketNos.includes(prefilter.ticketNo)) return false
  if (prefilter.bagCode && !row.relatedBagCodes.includes(prefilter.bagCode)) return false
  if (prefilter.usageNo && !row.relatedUsageNos.includes(prefilter.usageNo)) return false
  if (prefilter.suggestionId && !row.relatedSuggestionIds.includes(prefilter.suggestionId)) return false
  if (prefilter.processOrderNo && !row.relatedProcessOrderNos.includes(prefilter.processOrderNo)) return false
  if (prefilter.materialSku && !row.relatedMaterialSkus.includes(prefilter.materialSku)) return false
  if (prefilter.issueType && !row.issueTypes.includes(prefilter.issueType as CuttingSummaryIssueType)) return false
  if (prefilter.blockerSection && !row.blockerItems.some((item) => item.sectionKey === prefilter.blockerSection)) return false
  return true
}

function getBlockerSourceFallback(row: CuttingSummaryRow, sourceType: CuttingCheckSourceObjectType): boolean {
  if (sourceType === 'ORIGINAL_CUT_ORDER') return row.relatedOriginalCutOrderNos.length > 0
  if (sourceType === 'MERGE_BATCH') return row.relatedMergeBatchNos.length > 0
  if (sourceType === 'REPLENISHMENT') return row.relatedSuggestionIds.length > 0
  if (sourceType === 'FEI_OWNER') return row.relatedOriginalCutOrderNos.length > 0 && row.relatedTicketNos.length > 0
  if (sourceType === 'FEI_PRINT_JOB') return Boolean(row.latestPrintJobNo)
  if (sourceType === 'BAG_USAGE') return row.relatedUsageNos.length > 0
  return row.relatedProcessOrderNos.length > 0
}

function getSourceNumberTokens(row: CuttingSummaryRow): string[] {
  return [
    ...row.relatedOriginalCutOrderNos,
    ...row.relatedMergeBatchNos,
    ...row.relatedSuggestionIds,
    ...row.relatedProcessOrderNos,
    ...row.relatedBagCodes,
    ...row.relatedUsageNos,
    ...row.relatedTicketNos,
    row.latestPrintJobNo,
    ...row.blockerItems.map((item) => item.sourceNo),
  ]
    .filter(Boolean)
    .map((item) => item.toLowerCase())
}

function getHighestBlockerWeight(row: CuttingSummaryRow): number {
  if (row.blockerItems.some((item) => item.severity === 'HIGH')) return 3
  if (row.blockerItems.some((item) => item.severity === 'MEDIUM')) return 2
  if (row.blockerItems.some((item) => item.severity === 'LOW')) return 1
  return 0
}

function getFilteredRows(
  viewModel: CuttingSummaryViewModel,
  options: { ignoreIssueType?: boolean } = {},
): CuttingSummaryRow[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  const materialSkuKeyword = state.filters.materialSku.trim().toLowerCase()
  const sourceNoKeyword = state.filters.sourceNoKeyword.trim().toLowerCase()

  return filterSummaryByIssueType(viewModel.rows, options.ignoreIssueType ? 'ALL' : state.filters.issueType)
    .filter((row) => {
      if (!rowMatchesPrefilter(row, state.prefilter)) return false
      if (state.filters.riskLevel !== 'ALL' && row.overallRiskLevel !== state.filters.riskLevel) return false
      if (state.filters.currentStage !== 'ALL' && row.currentStageKey !== state.filters.currentStage) return false
      if (state.filters.completionState !== 'ALL' && row.completionState !== state.filters.completionState) return false
      if (state.filters.pendingReplenishmentOnly && row.pendingReplenishmentCount === 0) return false
      if (state.filters.pendingTicketsOnly && row.unprintedOwnerCount === 0) return false
      if (state.filters.pendingBagOnly && row.openBagUsageCount === 0) return false
      if (state.filters.specialProcessOnly && row.openSpecialProcessCount === 0) return false

      if (state.filters.blockerSection !== 'ALL') {
        const hasBlockingSection = row.blockerItems.some((item) => item.sectionKey === state.filters.blockerSection)
        const hasRelevantSection = row.checkSections.some(
          (section) => section.sectionKey === state.filters.blockerSection && section.stateKey !== 'NOT_APPLICABLE',
        )
        if (row.blockerItems.length) {
          if (!hasBlockingSection) return false
        } else if (!hasRelevantSection) {
          return false
        }
      }

      if (state.filters.sourceObjectType !== 'ALL') {
        const hasBlockedSourceType = row.blockerItems.some((item) => item.sourceType === state.filters.sourceObjectType)
        if (row.blockerItems.length) {
          if (!hasBlockedSourceType) return false
        } else if (!getBlockerSourceFallback(row, state.filters.sourceObjectType)) {
          return false
        }
      }

      if (keyword && !row.keywordIndex.some((token) => token.includes(keyword))) return false

      if (
        materialSkuKeyword &&
        ![
          ...row.relatedMaterialSkus.map((item) => item.toLowerCase()),
          ...row.blockerItems.map((item) => item.materialSku.toLowerCase()),
        ].some((token) => token.includes(materialSkuKeyword))
      ) {
        return false
      }

      if (sourceNoKeyword && !getSourceNumberTokens(row).some((token) => token.includes(sourceNoKeyword))) return false

      return true
    })
    .sort((left, right) => {
      const completionDiff = completionSortWeight[left.completionState] - completionSortWeight[right.completionState]
      if (completionDiff !== 0) return completionDiff
      const blockerDiff = right.blockingCount - left.blockingCount
      if (blockerDiff !== 0) return blockerDiff
      const severityDiff = getHighestBlockerWeight(right) - getHighestBlockerWeight(left)
      if (severityDiff !== 0) return severityDiff
      const pendingDiff = right.pendingActionCount - left.pendingActionCount
      if (pendingDiff !== 0) return pendingDiff
      return left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    })
}

function getActiveRowId(rows: CuttingSummaryRow[], issues: CuttingSummaryIssue[]): string | null {
  if (state.activeRowId && rows.some((row) => row.rowId === state.activeRowId)) return state.activeRowId
  if (state.activeIssueId) {
    const issue = issues.find((item) => item.issueId === state.activeIssueId)
    const matched = rows.find((row) => issue?.relatedRowIds.includes(row.rowId))
    if (matched) return matched.rowId
  }
  return rows[0]?.rowId || null
}

function syncStateWithQuery(viewModel: CuttingSummaryViewModel): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return

  state.querySignature = pathname
  state.prefilter = getPrefilterFromQuery()
  state.drillContext = state.prefilter

  if (state.prefilter?.issueType) state.filters.issueType = state.prefilter.issueType as CuttingSummaryIssueType
  if (state.prefilter?.blockerSection) state.filters.blockerSection = state.prefilter.blockerSection as CuttingCheckSectionKey

  if (state.prefilter?.issueType) {
    const issue = viewModel.issues.find((item) => item.issueType === state.prefilter?.issueType) || null
    state.activeIssueId = issue?.issueId || null
    state.activeRowId = issue?.relatedRowIds[0] || null
  } else {
    const matched = viewModel.rows.find((row) => rowMatchesPrefilter(row, state.prefilter))
    state.activeRowId = matched?.rowId || viewModel.rows[0]?.rowId || null
    state.activeIssueId = null
  }

  if (state.prefilter?.autoOpenDetail && state.activeRowId) {
    state.activeRowId = state.activeRowId
  }
}

function clearLocateState(): void {
  state.prefilter = null
  state.drillContext = null
  state.querySignature = getCanonicalCuttingPath('summary')
  appStore.navigate(getCanonicalCuttingPath('summary'))
}

function buildSummaryDrillContext(
  payload: Record<string, string | undefined>,
  extra?: Partial<CuttingDrillContext>,
): CuttingDrillContext {
  return normalizeLegacyCuttingPayload(payload, 'cutting-summary', {
    productionOrderNo: extra?.productionOrderNo,
    productionOrderId: extra?.productionOrderId,
    issueType: state.filters.issueType !== 'ALL' ? state.filters.issueType : undefined,
    blockerSection: state.filters.blockerSection !== 'ALL' ? state.filters.blockerSection : undefined,
    autoOpenDetail: true,
    ...extra,
  })
}

function navigateWithPayload(
  target: SummaryNavigationTarget,
  payload: Record<string, string | undefined>,
  extra?: Partial<CuttingDrillContext>,
): boolean {
  appStore.navigate(buildCuttingRouteWithContext(target as CuttingNavigationTarget, buildSummaryDrillContext(payload, extra)))
  return true
}

function renderHeaderActions(): string {
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-production-progress">去生产单进度</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-original-orders">去原始裁片单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-merge-batches">去合并裁剪批次</button>
    </div>
  `
}

function renderStats(viewModel: CuttingSummaryViewModel): string {
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${viewModel.dashboardCards
        .map((card) => {
          const attrs =
            card.filterType && card.filterValue
              ? ` data-cutting-summary-action="apply-card-filter" data-filter-type="${card.filterType}" data-filter-value="${card.filterValue}"`
              : ''
          return `<button type="button" class="text-left" ${attrs}>${renderCompactKpiCard(card.label, card.value, card.hint, card.accentClass)}</button>`
        })
        .join('')}
    </section>
  `
}

function renderPrefilterBar(): string {
  if (!state.drillContext) return ''
  const chips = buildCuttingDrillChipLabels(state.drillContext)

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext),
    chips: chips.map((label) => renderWorkbenchFilterChip(label, '', 'blue')),
    clearAttrs: 'data-cutting-summary-action="clear-prefilter"',
  })
}

function renderFilterSelect(
  label: string,
  field: SummaryFilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-summary-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderFilterInput(label: string, field: SummaryFilterField, value: string, placeholder: string): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-summary-field="${field}"
      />
    </label>
  `
}

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="grid gap-3 xl:grid-cols-6">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">跨对象搜索</span>
          <input
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="生产单 / 原始裁片单 / 批次 / 菲票 / 中转袋 / 补料 / 工艺单"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-summary-field="keyword"
          />
        </label>
        ${renderFilterSelect('闭环状态', 'completionState', state.filters.completionState, [
          { value: 'ALL', label: '全部' },
          { value: 'HAS_EXCEPTION', label: '有异常' },
          { value: 'IN_PROGRESS', label: '处理中' },
          { value: 'COMPLETED', label: '已闭环' },
          { value: 'DATA_PENDING', label: '待补数据' },
        ])}
        ${renderFilterSelect('阻塞链路', 'blockerSection', state.filters.blockerSection, [
          { value: 'ALL', label: '全部链路' },
          ...Object.entries(cuttingCheckSectionLabelMap).map(([value, label]) => ({ value, label })),
        ])}
        ${renderFilterSelect('来源对象类型', 'sourceObjectType', state.filters.sourceObjectType, [
          { value: 'ALL', label: '全部对象' },
          ...Object.entries(sourceObjectTypeLabelMap).map(([value, label]) => ({ value, label })),
        ])}
        ${renderFilterSelect('当前阶段', 'currentStage', state.filters.currentStage, [
          { value: 'ALL', label: '全部阶段' },
          { value: 'WAITING_PREP', label: '待配料' },
          { value: 'PREPPING', label: '配料中' },
          { value: 'WAITING_CLAIM', label: '待领料' },
          { value: 'CUTTING', label: '裁剪中' },
          { value: 'WAITING_INBOUND', label: '待入仓' },
          { value: 'DONE', label: '已完成' },
        ])}
      </div>
      <div class="grid gap-3 xl:grid-cols-6">
        ${renderFilterInput('面料 SKU', 'materialSku', state.filters.materialSku, '输入面料 SKU 精确定位阻塞来源')}
        ${renderFilterInput('来源对象号', 'sourceNoKeyword', state.filters.sourceNoKeyword, '原始裁片单 / 批次 / 补料 / 工艺单 / 使用周期')}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部风险' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
        ${renderFilterSelect('问题分类', 'issueType', state.filters.issueType, [
          { value: 'ALL', label: '全部问题' },
          ...Object.values(cuttingSummaryIssueMetaMap).map((meta) => ({ value: meta.key, label: meta.label })),
        ])}
        <div class="flex flex-wrap items-end gap-2 xl:col-span-2">
          ${renderWorkbenchFilterChip(
            state.filters.pendingReplenishmentOnly ? '已选：只看待补料' : '只看待补料',
            'data-cutting-summary-action="toggle-replenishment"',
            'amber',
          )}
          ${renderWorkbenchFilterChip(
            state.filters.pendingTicketsOnly ? '已选：只看待打印菲票' : '只看待打印菲票',
            'data-cutting-summary-action="toggle-tickets"',
            'blue',
          )}
          ${renderWorkbenchFilterChip(
            state.filters.pendingBagOnly ? '已选：只看待交接 / 待回仓' : '只看待交接 / 待回仓',
            'data-cutting-summary-action="toggle-bags"',
            'rose',
          )}
          ${renderWorkbenchFilterChip(
            state.filters.specialProcessOnly ? '已选：只看特殊工艺' : '只看特殊工艺',
            'data-cutting-summary-action="toggle-special"',
            'emerald',
          )}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="clear-filters">清除筛选条件</button>
        </div>
      </div>
    </div>
  `)
}

function renderIssueBoard(issues: CuttingSummaryIssue[]): string {
  if (!issues.length) {
    return `
      <section class="rounded-lg border border-dashed bg-card px-4 py-6 text-sm text-muted-foreground">
        当前筛选范围内暂无阻塞项分类。
      </section>
    `
  }

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">阻塞项分类</h2>
        </div>
        <p class="text-xs text-muted-foreground">当前共 ${formatCount(issues.length)} 类阻塞</p>
      </div>
      <div class="grid gap-3 xl:grid-cols-5">
        ${issues
          .map((issue) => {
            const issueMeta = cuttingSummaryIssueMetaMap[issue.issueType]
            const riskMeta = cuttingSummaryRiskMetaMap[issue.highestRiskLevel]
            const activeClass = state.activeIssueId === issue.issueId ? 'border-blue-500 bg-blue-50' : 'hover:border-slate-300'
            return `
              <button
                type="button"
                class="rounded-lg border p-3 text-left transition ${activeClass}"
                data-cutting-summary-action="focus-issue"
                data-issue-id="${issue.issueId}"
                data-row-id="${issue.relatedRowIds[0] || ''}"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${issueMeta.className}">${escapeHtml(issueMeta.label)}</span>
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskMeta.className}">${escapeHtml(riskMeta.label)}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div class="rounded-md bg-muted/30 px-2 py-2">
                    <p class="text-[11px] text-muted-foreground">阻塞生产单</p>
                    <p class="mt-1 font-semibold text-foreground">${formatCount(issue.blockingProductionOrderCount)}</p>
                  </div>
                  <div class="rounded-md bg-muted/30 px-2 py-2">
                    <p class="text-[11px] text-muted-foreground">阻塞对象</p>
                    <p class="mt-1 font-semibold text-foreground">${formatCount(issue.blockingObjectCount)}</p>
                  </div>
                </div>
                <p class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(issue.summary)}</p>
                <p class="mt-2 text-xs font-medium text-blue-700">首要处理动作：${escapeHtml(issue.primaryActionLabel)}</p>
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderCheckStateBar(rows: CuttingSummaryRow[]): string {
  const blockerCount = rows.reduce((sum, row) => sum + row.blockingCount, 0)
  const pendingActionCount = rows.reduce((sum, row) => sum + row.pendingActionCount, 0)
  const blockedCount = rows.filter((row) => row.completionState === 'HAS_EXCEPTION').length
  const dataPendingCount = rows.filter((row) => row.completionState === 'DATA_PENDING').length

  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      当前筛选命中 ${formatCount(rows.length)} 个生产单，阻塞对象 ${formatCount(blockerCount)} 个，待处理动作 ${formatCount(pendingActionCount)} 个。
      ${blockedCount ? `阻塞中 ${formatCount(blockedCount)} 个。` : ''} ${dataPendingCount ? `待补数据 ${formatCount(dataPendingCount)} 个。` : ''}
    </section>
  `
}

function renderPills(items: string[], emptyText: string): string {
  if (!items.length) return `<span class="text-xs text-muted-foreground">${escapeHtml(emptyText)}</span>`
  return items
    .map((item) => `<span class="inline-flex max-w-[12rem] truncate rounded-full border bg-muted/30 px-2 py-0.5 text-xs text-foreground" title="${escapeHtml(item)}">${escapeHtml(item)}</span>`)
    .join('')
}

function renderMainTable(rows: CuttingSummaryRow[]): string {
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">生产单核查总表</h2>
        </div>
        <p class="text-xs text-muted-foreground">当前共 ${formatCount(rows.length)} 行</p>
      </div>
      ${renderStickyTableScroller(
        rows.length
          ? `
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-card">
                <tr class="border-b text-left text-xs text-muted-foreground">
                  <th class="px-3 py-2">生产单号</th>
                  <th class="px-3 py-2">款号 / SPU</th>
                  <th class="px-3 py-2">当前完成状态</th>
                  <th class="px-3 py-2">SKU 完成情况</th>
                  <th class="px-3 py-2">未完成部位数</th>
                  <th class="px-3 py-2">最主要卡点</th>
                  <th class="px-3 py-2">关键来源对象</th>
                  <th class="px-3 py-2">下一步动作</th>
                  <th class="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const riskMeta = cuttingSummaryRiskMetaMap[row.overallRiskLevel]
                    const activeClass = state.activeRowId === row.rowId ? 'bg-blue-50/70' : ''
                    const primaryAction = row.nextActions[0] || null
                    return `
                      <tr class="border-b align-top ${activeClass}">
                        <td class="px-3 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-cutting-summary-action="focus-row" data-row-id="${row.rowId}">
                            ${escapeHtml(row.productionOrderNo)}
                          </button>
                          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName)}</p>
                        </td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">
                          <div>${escapeHtml(row.styleCode)}</div>
                          <div class="mt-1">${escapeHtml(row.spuCode)}</div>
                        </td>
                        <td class="px-3 py-3">
                          <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.completionClassName}">${escapeHtml(row.completionLabel)}</span>
                          <p class="mt-1 max-w-[12rem] text-xs leading-5 text-muted-foreground">${escapeHtml(row.completionDetailText)}</p>
                        </td>
                        <td class="px-3 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(row.skuProgressSummary)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">未完成 SKU ${formatCount(row.incompleteSkuCount)} 个</div>
                        </td>
                        <td class="px-3 py-3">
                          <div class="font-medium ${row.incompletePartCount > 0 ? 'text-amber-700' : 'text-emerald-700'}">${formatCount(row.incompletePartCount)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.dataStateLabel)}</div>
                        </td>
                        <td class="px-3 py-3">
                          ${
                            row.primaryBlockerSectionLabel
                              ? `<div>
                                  <span class="inline-flex rounded-full border bg-rose-50 px-2 py-0.5 text-xs text-rose-700">${escapeHtml(row.primaryBlockerSectionLabel)}</span>
                                  <p class="mt-1 max-w-[14rem] text-xs leading-5 text-muted-foreground">${escapeHtml(row.primaryBlockerReason)}</p>
                                </div>`
                              : `<div>
                                  <span class="inline-flex rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-foreground">${escapeHtml(row.currentStageLabel)}</span>
                                  <p class="mt-1 max-w-[14rem] text-xs leading-5 text-muted-foreground">${escapeHtml(`${row.primaryGapObjectLabel} / ${row.primaryGapMaterialSku || '待补面料'}`)}</p>
                                </div>`
                          }
                        </td>
                        <td class="px-3 py-3">
                          <div class="flex max-w-[16rem] flex-wrap gap-1">
                            ${renderPills(row.keySourceObjects.slice(0, 3), '暂无关键对象')}
                          </div>
                        </td>
                        <td class="px-3 py-3">
                          <div class="text-xs text-blue-700">${escapeHtml(row.mainNextActionLabel)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(riskMeta.label)}</div>
                        </td>
                        <td class="px-3 py-3 text-right">
                          <div class="flex flex-col items-end gap-2">
                            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="focus-row" data-row-id="${row.rowId}">查看核查</button>
                            ${
                              primaryAction
                                ? `<button type="button" class="rounded-md border px-2 py-1 text-xs text-blue-700 hover:bg-muted" data-cutting-summary-action="navigate-next-action" data-row-id="${row.rowId}" data-action-id="${primaryAction.actionId}" title="${escapeHtml(primaryAction.label)}">${escapeHtml(primaryAction.label)}</button>`
                                : ''
                            }
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : `
            <div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              当前筛选条件下没有命中的核查记录。
            </div>
          `,
      )}
    </section>
  `
}

function renderCheckConclusion(detail: CuttingSummaryDetailPanelData): string {
  const whyBlocked =
    detail.primaryBlocker?.blockerReason || detail.completionMeta.detailText || detail.row.primaryBlockerReason || '当前暂无阻塞说明。'

  return `
    <article class="rounded-lg border p-3">
      <h3 class="text-sm font-semibold text-foreground">核查结论</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">当前闭环状态</p>
          <span class="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${detail.completionMeta.className}">${escapeHtml(detail.completionMeta.label)}</span>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">当前最主要卡点</p>
          <p class="mt-2 text-sm font-semibold text-foreground">${escapeHtml(detail.row.primaryBlockerSectionLabel || detail.row.currentStageLabel || '当前无明确阻塞')}</p>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">未完成 SKU 数</p>
          <p class="mt-2 text-sm font-semibold text-foreground">${formatCount(detail.row.incompleteSkuCount)}</p>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">未完成部位数</p>
          <p class="mt-2 text-sm font-semibold text-foreground">${formatCount(detail.row.incompletePartCount)}</p>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">当前下一步动作</p>
          <p class="mt-2 text-sm font-semibold text-blue-700">${escapeHtml(detail.row.mainNextActionLabel)}</p>
        </div>
      </div>
      <div class="mt-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        ${escapeHtml(whyBlocked)}
      </div>
    </article>
  `
}

function renderPieceTruthSkuSection(detail: CuttingSummaryDetailPanelData): string {
  const rows = detail.pieceTruth.skuRows
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">SKU 情况</h3>
        <span class="text-xs text-muted-foreground">共 ${formatCount(rows.length)} 个 SKU</span>
      </div>
      ${
        rows.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">SKU</th>
                      <th class="px-3 py-2">颜色</th>
                      <th class="px-3 py-2">尺码</th>
                      <th class="px-3 py-2">理论成衣件数（件）</th>
                      <th class="px-3 py-2">已裁片片数（片）</th>
                      <th class="px-3 py-2">已入仓裁片片数（片）</th>
                      <th class="px-3 py-2">当前状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(
                        (row) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3 font-medium text-foreground">${escapeHtml(row.skuCode || `${row.color}/${row.size}`)}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.color || '-')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.size || '-')}</td>
                            <td class="px-3 py-3">${formatCount(row.requiredGarmentQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.actualCutQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.inboundQty)}</td>
                            <td class="px-3 py-3">
                              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.mappingStatus === 'MATCHED' ? row.gapCutQty > 0 ? 'bg-rose-100 text-rose-700' : row.gapInboundQty > 0 ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(row.currentStateLabel)}</span>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `,
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前尚未形成 SKU 情况。</p>'
      }
    </article>
  `
}

function renderPieceTruthGapSection(detail: CuttingSummaryDetailPanelData): string {
  const rows = detail.pieceTruth.gapRows.filter(
    (row) => row.mappingStatus !== 'MATCHED' || row.gapCutQty > 0 || row.gapInboundQty > 0,
  )
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">部位差异区</h3>
        <span class="text-xs text-muted-foreground">${rows.length ? `未完成部位 ${formatCount(rows.length)} 个` : '当前无差异部位'}</span>
      </div>
      ${
        rows.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">原始裁片单</th>
                      <th class="px-3 py-2">面料 SKU</th>
                      <th class="px-3 py-2">SKU</th>
                      <th class="px-3 py-2">部位</th>
                      <th class="px-3 py-2">理论裁片片数（片）</th>
                      <th class="px-3 py-2">已裁片片数（片）</th>
                      <th class="px-3 py-2">已入仓裁片片数（片）</th>
                      <th class="px-3 py-2">差异裁片片数（片）</th>
                      <th class="px-3 py-2">当前状态</th>
                      <th class="px-3 py-2">下一步动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(
                        (row) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3 font-medium text-foreground">${escapeHtml(row.originalCutOrderNo || '待补裁片单')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.materialSku || '待补面料 SKU')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.skuCode || `${row.color}/${row.size}`)}</td>
                            <td class="px-3 py-3">
                              <div class="font-medium text-foreground">${escapeHtml(row.partName)}</div>
                              ${row.patternName ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.patternName)}</div>` : ''}
                            </td>
                            <td class="px-3 py-3">${formatCount(row.requiredPieceQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.actualCutQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.inboundQty)}</td>
                            <td class="px-3 py-3">
                              <span class="font-medium ${row.gapCutQty > 0 ? 'text-rose-700' : 'text-amber-700'}">${formatCount(row.gapCutQty > 0 ? row.gapCutQty : row.gapInboundQty)}</span>
                            </td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.currentStateLabel)}</td>
                            <td class="px-3 py-3 text-xs text-blue-700">${escapeHtml(row.nextActionLabel)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `,
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前没有未完成部位差异。</p>'
      }
    </article>
  `
}

function renderPieceTruthIssueSection(detail: CuttingSummaryDetailPanelData): string {
  const issues = [...detail.pieceTruth.mappingIssues, ...detail.pieceTruth.dataIssues]
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">映射与数据问题区</h3>
        <span class="text-xs text-muted-foreground">${issues.length ? `共 ${formatCount(issues.length)} 项` : '当前无问题'}</span>
      </div>
      ${
        issues.length
          ? `<div class="mt-3 space-y-2">
              ${issues
                .map(
                  (issue) => `
                    <div class="rounded-lg border ${issue.level === 'mapping' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} px-3 py-2">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-medium ${issue.level === 'mapping' ? 'text-amber-700' : 'text-slate-700'}">${escapeHtml(issue.level === 'mapping' ? '映射缺失' : '数据待补')}</p>
                          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(issue.message)}</p>
                        </div>
                        <div class="text-right text-[11px] text-muted-foreground">${escapeHtml(issue.originalCutOrderNo || issue.productionOrderNo)}</div>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>`
          : '<p class="mt-3 text-sm text-muted-foreground">当前没有映射缺失或数据待补项。</p>'
      }
    </article>
  `
}

function renderBlockerSeverity(level: CuttingCheckBlockerItem['severity']): string {
  const meta = blockerLevelMetaMap[level]
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}">${escapeHtml(meta.label)}</span>`
}

function renderBlockerList(detail: CuttingSummaryDetailPanelData): string {
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">阻塞项清单</h3>
        <span class="text-xs text-muted-foreground">${formatCount(detail.blockerItems.length)} 项</span>
      </div>
      ${
        detail.blockerItems.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">链路</th>
                      <th class="px-3 py-2">来源对象</th>
                      <th class="px-3 py-2">面料 SKU</th>
                      <th class="px-3 py-2">当前状态</th>
                      <th class="px-3 py-2">阻塞原因</th>
                      <th class="px-3 py-2">下一步动作</th>
                      <th class="px-3 py-2 text-right">处理动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detail.blockerItems
                      .map(
                        (item) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">
                              <div class="space-y-1">
                                <span class="inline-flex rounded-full border bg-muted/30 px-2 py-0.5 text-xs text-foreground">${escapeHtml(cuttingCheckSectionLabelMap[item.sectionKey])}</span>
                                <div>${renderBlockerSeverity(item.severity)}</div>
                              </div>
                            </td>
                            <td class="px-3 py-3 text-sm">
                              <p class="font-medium text-foreground">${escapeHtml(item.sourceNo)}</p>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sourceLabel)}</p>
                            </td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.materialSku || '—')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentStateLabel)}</td>
                            <td class="px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(item.blockerReason)}</td>
                            <td class="px-3 py-3 text-xs text-blue-700">${escapeHtml(item.nextActionLabel)}</td>
                            <td class="px-3 py-3 text-right">
                              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="navigate-blocker" data-row-id="${detail.row.rowId}" data-blocker-id="${item.blockerId}">
                                ${escapeHtml(getCuttingNavigationActionLabel(item.navigationTarget as CuttingNavigationTarget))}
                              </button>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `,
              'max-h-[26rem]',
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前没有明确阻塞项。</p>'
      }
    </article>
  `
}

function renderSourceObjects(detail: CuttingSummaryDetailPanelData): string {
  const groups = sourceObjectGroupOrder
    .map((sourceType) => ({
      sourceType,
      label: sourceObjectTypeLabelMap[sourceType],
      items: detail.sourceObjects.filter((item) => item.sourceType === sourceType),
    }))
    .filter((group) => group.items.length)

  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">来源对象</h3>
        <span class="text-xs text-muted-foreground">${formatCount(detail.sourceObjects.length)} 个</span>
      </div>
      ${
        groups.length
          ? `<div class="mt-3 space-y-3">
              ${groups
                .map(
                  (group) => `
                    <section class="space-y-2">
                      <div class="flex items-center justify-between gap-3">
                        <h4 class="text-xs font-semibold text-muted-foreground">${escapeHtml(group.label)}</h4>
                        <span class="text-[11px] text-muted-foreground">${formatCount(group.items.length)} 个</span>
                      </div>
                      <div class="space-y-2">
                        ${group.items
                          .map(
                            (item) => `
                              <div class="rounded-md border px-3 py-2">
                                <div class="flex items-start justify-between gap-3">
                                  <div class="min-w-0">
                                    <p class="truncate text-sm font-medium text-foreground">${escapeHtml(item.sourceNo)}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.statusLabel)}</p>
                                    ${item.materialSku ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialSku)}</p>` : ''}
                                  </div>
                                  <div class="shrink-0 text-right">
                                    ${
                                      item.blockerCount
                                        ? `<span class="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">阻塞 ${formatCount(item.blockerCount)}</span>`
                                        : '<span class="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">无阻塞</span>'
                                    }
                                    <div class="mt-2">
                                      <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="navigate-source-object" data-row-id="${detail.row.rowId}" data-source-type="${item.sourceType}" data-source-id="${item.sourceId}">
                                        ${escapeHtml(getCuttingNavigationActionLabel(item.navigationTarget as CuttingNavigationTarget))}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    </section>
                  `,
                )
                .join('')}
            </div>`
          : '<p class="mt-3 text-sm text-muted-foreground">当前未挂出可核查来源对象。</p>'
      }
    </article>
  `
}

function renderSectionStates(detail: CuttingSummaryDetailPanelData): string {
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">链路完成度</h3>
        <span class="text-xs text-muted-foreground">${formatCount(detail.sectionStates.length)} 条链路</span>
      </div>
      <div class="mt-3 space-y-2">
        ${detail.sectionStates
          .map(
            (section) => `
              <div class="rounded-md border px-3 py-2">
                <div class="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-medium text-foreground">${escapeHtml(section.label)}</p>
                      <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${section.className}">${escapeHtml(section.currentStateLabel)}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(section.detailText)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">阻塞对象 ${formatCount(section.blockerCount)} / 完成 ${formatCount(section.doneCount)} / 总数 ${formatCount(section.totalCount)}</p>
                  </div>
                  <div class="shrink-0">
                    <button
                      type="button"
                      class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      data-cutting-summary-action="navigate-section-action"
                      data-row-id="${detail.row.rowId}"
                      data-section-key="${section.sectionKey}"
                    >
                      ${escapeHtml(section.defaultAction.label)}
                    </button>
                  </div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `
}

function renderDetailPanel(detail: CuttingSummaryDetailPanelData | null): string {
  if (!detail) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold text-foreground">核查详情</h2>
        <p class="mt-2 text-sm text-muted-foreground">请选择一条生产单核查记录。</p>
      </section>
    `
  }

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">核查详情</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="close-overlay">清空当前选中</button>
      </div>
      ${renderCheckConclusion(detail)}
      ${renderPieceTruthSkuSection(detail)}
      ${renderPieceTruthGapSection(detail)}
      ${renderPieceTruthIssueSection(detail)}
      ${renderBlockerList(detail)}
      ${renderSourceObjects(detail)}
      ${renderSectionStates(detail)}
    </section>
  `
}

function renderTraceNode(node: CuttingSummaryTraceNode, rowId: string): string {
  const targetMap: Record<CuttingSummaryTraceNode['nodeType'], SummaryNavigationTarget> = {
    'production-order': 'productionProgress',
    'original-cut-order': 'originalOrders',
    'merge-batch': 'mergeBatches',
    ticket: 'feiTickets',
    'bag-usage': 'transferBags',
    replenishment: 'replenishment',
    'special-process': 'specialProcesses',
  }

  return `
    <li class="space-y-2">
      <div class="rounded-md border px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-foreground">${escapeHtml(node.nodeLabel)}</p>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(node.status)}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            data-cutting-summary-action="navigate-row"
            data-row-id="${rowId}"
            data-nav-target="${targetMap[node.nodeType]}"
          >
            跳转
          </button>
        </div>
      </div>
      ${
        node.children.length
          ? `<ul class="ml-4 space-y-2 border-l pl-3">${node.children.map((child) => renderTraceNode(child, rowId)).join('')}</ul>`
          : ''
      }
    </li>
  `
}

function renderTracePanel(detail: CuttingSummaryDetailPanelData | null): string {
  return renderWorkbenchSecondaryPanel({
    title: '追溯关系区',
    hint: '',
    defaultOpen: true,
    countText: detail ? `${detail.traceTree.length} 条根节点` : '待选择对象',
    body: detail
      ? `<ul class="space-y-3">${detail.traceTree.map((node) => renderTraceNode(node, detail.row.rowId)).join('')}</ul>`
      : '<p class="text-sm text-muted-foreground">请选择一条记录。</p>',
  })
}

function renderActionQueue(detail: CuttingSummaryDetailPanelData | null): string {
  const actionCount = detail?.nextActions.length || 0

  return renderWorkbenchSecondaryPanel({
    title: '待处理动作',
    hint: '',
    defaultOpen: true,
    countText: detail ? `${formatCount(actionCount)} 项` : '待选择对象',
    body: detail
      ? detail.nextActions.length
        ? `
            <div class="space-y-2">
              ${detail.nextActions
                .map(
                  (action) => `
                    <div class="rounded-md border px-3 py-2">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="inline-flex rounded-full border bg-muted/30 px-2 py-0.5 text-xs text-foreground">${escapeHtml(cuttingCheckSectionLabelMap[action.sectionKey])}</span>
                            ${action.blocking ? '<span class="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">阻塞动作</span>' : ''}
                          </div>
                          <p class="mt-2 text-sm font-medium text-foreground">${escapeHtml(action.label)}</p>
                          <p class="mt-1 text-xs text-muted-foreground">来源对象：${escapeHtml(action.sourceNo || '当前生产单')} / 目标页面：${escapeHtml(actionTargetLabelMap[action.target])}</p>
                        </div>
                        <button
                          type="button"
                          class="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          data-cutting-summary-action="navigate-next-action"
                          data-row-id="${detail.row.rowId}"
                          data-action-id="${action.actionId}"
                        >
                          ${escapeHtml(action.label)}
                        </button>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>
          `
        : '<p class="text-sm text-muted-foreground">当前没有待处理动作。</p>'
      : '<p class="text-sm text-muted-foreground">请选择一条记录。</p>',
  })
}

function renderPage(): string {
  const projection = buildProjection()
  const { sources, viewModel } = projection
  syncStateWithQuery(viewModel)
  const issueRows = getFilteredRows(viewModel, { ignoreIssueType: true })
  const issues = buildCuttingSummaryIssues(issueRows)
  const filteredRows = getFilteredRows(viewModel)
  const activeRowId = getActiveRowId(filteredRows, issues)
  const detail = activeRowId ? buildFcsCuttingSummaryDetailProjection(activeRowId, projection) : null
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'summary')

  return `
    <div class="space-y-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStats(viewModel)}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderIssueBoard(issues)}
      ${renderCheckStateBar(filteredRows)}
      ${renderMainTable(filteredRows)}
      <section class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div class="space-y-4">
          ${renderDetailPanel(detail)}
        </div>
        <div class="space-y-4">
          ${renderActionQueue(detail)}
          ${renderTracePanel(detail)}
        </div>
      </section>
    </div>
  `
}

function getRowById(rowId: string | undefined): CuttingSummaryRow | null {
  if (!rowId) return null
  return buildPageData().viewModel.rowsById[rowId] || null
}

function getDetailByRowId(rowId: string | undefined): CuttingSummaryDetailPanelData | null {
  if (!rowId) return null
  return buildFcsCuttingSummaryDetailProjection(rowId, buildProjection())
}

function getRowAction(rowId: string | undefined, actionId: string | undefined): CuttingCheckNextAction | null {
  const row = getRowById(rowId)
  if (!row || !actionId) return null
  return row.nextActions.find((item) => item.actionId === actionId) || null
}

function getRowBlocker(rowId: string | undefined, blockerId: string | undefined): CuttingCheckBlockerItem | null {
  const row = getRowById(rowId)
  if (!row || !blockerId) return null
  return row.blockerItems.find((item) => item.blockerId === blockerId) || null
}

function getRowSection(rowId: string | undefined, sectionKey: string | undefined): CuttingCheckSectionState | null {
  const row = getRowById(rowId)
  if (!row || !sectionKey) return null
  return row.checkSections.find((item) => item.sectionKey === sectionKey) || null
}

function getSourceObject(
  rowId: string | undefined,
  sourceType: string | undefined,
  sourceId: string | undefined,
): CuttingSummarySourceObjectItem | null {
  const detail = getDetailByRowId(rowId)
  if (!detail || !sourceType || !sourceId) return null
  return detail.sourceObjects.find((item) => item.sourceType === sourceType && item.sourceId === sourceId) || null
}

export function renderCraftCuttingSummaryPage(): string {
  return renderPage()
}

export function handleCraftCuttingSummaryEvent(target: Element): boolean {
  const filterFieldNode = target.closest<HTMLElement>('[data-cutting-summary-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.cuttingSummaryField as SummaryFilterField | undefined
    if (!field) return false
    state.filters = {
      ...state.filters,
      [field]: (filterFieldNode as HTMLInputElement | HTMLSelectElement).value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-summary-action]')
  const action = actionNode?.dataset.cuttingSummaryAction
  if (!action) return false

  if (action === 'focus-row') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return false
    state.activeRowId = rowId
    state.activeIssueId = null
    return true
  }

  if (action === 'focus-issue') {
    const issueId = actionNode.dataset.issueId
    if (!issueId) return false
    state.activeIssueId = issueId
    state.activeRowId = actionNode.dataset.rowId || null
    return true
  }

  if (action === 'close-overlay') {
    state.activeRowId = null
    state.activeIssueId = null
    return true
  }

  if (action === 'clear-prefilter') {
    clearLocateState()
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    state.activeIssueId = null
    return true
  }

  if (action === 'toggle-replenishment') {
    state.filters.pendingReplenishmentOnly = !state.filters.pendingReplenishmentOnly
    return true
  }

  if (action === 'toggle-tickets') {
    state.filters.pendingTicketsOnly = !state.filters.pendingTicketsOnly
    return true
  }

  if (action === 'toggle-bags') {
    state.filters.pendingBagOnly = !state.filters.pendingBagOnly
    return true
  }

  if (action === 'toggle-special') {
    state.filters.specialProcessOnly = !state.filters.specialProcessOnly
    return true
  }

  if (action === 'apply-card-filter') {
    const filterType = actionNode.dataset.filterType
    const filterValue = actionNode.dataset.filterValue
    if (filterType === 'risk' && filterValue) {
      state.filters.riskLevel = filterValue as CuttingSummaryRiskLevel
      return true
    }
    if (filterType === 'issue' && filterValue) {
      state.filters.issueType = filterValue as CuttingSummaryIssueType
      return true
    }
    if (filterType === 'pending-replenishment') {
      state.filters.pendingReplenishmentOnly = true
      return true
    }
    if (filterType === 'pending-ticket') {
      state.filters.pendingTicketsOnly = true
      return true
    }
    if (filterType === 'pending-bag') {
      state.filters.pendingBagOnly = true
      return true
    }
    if (filterType === 'special-process') {
      state.filters.specialProcessOnly = true
      return true
    }
  }

  if (action === 'navigate-row') {
    const row = getRowById(actionNode.dataset.rowId || state.activeRowId || undefined)
    const navTarget = actionNode.dataset.navTarget as SummaryNavigationTarget | undefined
    if (!row || !navTarget) return false
    return navigateWithPayload(navTarget, row.navigationPayload[navTarget], {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    })
  }

  if (action === 'navigate-next-action') {
    const nextAction = getRowAction(actionNode.dataset.rowId || state.activeRowId || undefined, actionNode.dataset.actionId)
    if (!nextAction) return false
    return navigateWithPayload(nextAction.target as SummaryNavigationTarget, nextAction.payload, {
      blockerSection: nextAction.sectionKey,
      sourceSection: 'action-queue',
    })
  }

  if (action === 'navigate-blocker') {
    const blocker = getRowBlocker(actionNode.dataset.rowId || state.activeRowId || undefined, actionNode.dataset.blockerId)
    if (!blocker) return false
    return navigateWithPayload(blocker.navigationTarget as SummaryNavigationTarget, blocker.navigationPayload, {
      productionOrderId: blocker.productionOrderId,
      productionOrderNo: blocker.productionOrderNo,
      blockerSection: blocker.sectionKey,
      sourceSection: 'blocker-list',
      originalCutOrderNo: blocker.sourceType === 'ORIGINAL_CUT_ORDER' ? blocker.sourceNo : undefined,
      mergeBatchNo: blocker.sourceType === 'MERGE_BATCH' ? blocker.sourceNo : undefined,
      suggestionId: blocker.sourceType === 'REPLENISHMENT' ? blocker.sourceId : undefined,
      suggestionNo: blocker.sourceType === 'REPLENISHMENT' ? blocker.sourceNo : undefined,
      processOrderId: blocker.sourceType === 'SPECIAL_PROCESS' ? blocker.sourceId : undefined,
      processOrderNo: blocker.sourceType === 'SPECIAL_PROCESS' ? blocker.sourceNo : undefined,
      bagCode: blocker.sourceType === 'BAG_USAGE' ? blocker.sourceNo : undefined,
      materialSku: blocker.materialSku || undefined,
    })
  }

  if (action === 'navigate-section-action') {
    const section = getRowSection(actionNode.dataset.rowId || state.activeRowId || undefined, actionNode.dataset.sectionKey)
    if (!section) return false
    return navigateWithPayload(section.defaultAction.target as SummaryNavigationTarget, section.defaultAction.payload, {
      blockerSection: section.sectionKey,
      sourceSection: 'section-state',
    })
  }

  if (action === 'navigate-source-object') {
    const sourceObject = getSourceObject(
      actionNode.dataset.rowId || state.activeRowId || undefined,
      actionNode.dataset.sourceType,
      actionNode.dataset.sourceId,
    )
    if (!sourceObject) return false
    return navigateWithPayload(sourceObject.navigationTarget as SummaryNavigationTarget, sourceObject.navigationPayload, {
      sourceSection: 'source-object',
      originalCutOrderNo: sourceObject.sourceType === 'ORIGINAL_CUT_ORDER' ? sourceObject.sourceNo : undefined,
      mergeBatchNo: sourceObject.sourceType === 'MERGE_BATCH' ? sourceObject.sourceNo : undefined,
      suggestionId: sourceObject.sourceType === 'REPLENISHMENT' ? sourceObject.sourceId : undefined,
      suggestionNo: sourceObject.sourceType === 'REPLENISHMENT' ? sourceObject.sourceNo : undefined,
      processOrderId: sourceObject.sourceType === 'SPECIAL_PROCESS' ? sourceObject.sourceId : undefined,
      processOrderNo: sourceObject.sourceType === 'SPECIAL_PROCESS' ? sourceObject.sourceNo : undefined,
      bagCode: sourceObject.sourceType === 'BAG_USAGE' ? sourceObject.sourceNo : undefined,
      materialSku: sourceObject.materialSku || undefined,
    })
  }

  if (action === 'go-production-progress') {
    appStore.navigate(getCanonicalCuttingPath('production-progress'))
    return true
  }

  if (action === 'go-original-orders') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-merge-batches') {
    appStore.navigate(getCanonicalCuttingPath('merge-batches'))
    return true
  }

  return false
}

export function isCraftCuttingSummaryDialogOpen(): boolean {
  return false
}
