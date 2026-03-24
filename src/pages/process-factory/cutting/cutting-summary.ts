import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import { buildCutPieceWarehouseViewModel, formatCutPieceQuantity } from './cut-piece-warehouse-model'
import { buildFabricWarehouseViewModel, formatFabricWarehouseLength } from './fabric-warehouse-model'
import {
  buildFeiTicketsViewModel,
  buildSystemSeedFeiTicketLedger,
  CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  deserializeFeiTicketDraftsStorage,
  deserializeFeiTicketPrintJobsStorage,
  deserializeFeiTicketRecordsStorage,
  type FeiTicketLabelRecord,
  type FeiTicketPrintJob,
} from './fei-tickets-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
} from './marker-spreading-model'
import { buildMaterialPrepViewModel } from './material-prep-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import { buildProductionProgressRows, type ProductionProgressStageKey } from './production-progress-model'
import {
  buildReplenishmentViewModel,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
} from './replenishment-model'
import { buildSampleWarehouseViewModel } from './sample-warehouse-model'
import {
  buildSpecialProcessViewModel,
  CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY,
  deserializeBindingStripPayloadsStorage,
  deserializeSpecialProcessOrdersStorage,
} from './special-processes-model'
import {
  buildCuttingSummaryViewModel,
  buildSummaryDetailPanelData,
  buildSummarySearchIndex,
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
  type CuttingSummaryTraceNode,
  type CuttingSummaryViewModel,
} from './summary-model'
import {
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  deserializeTransferBagStorage,
  mergeTransferBagStores,
} from './transfer-bags-model'
import {
  buildTransferBagReturnViewModel,
} from './transfer-bag-return-model'
import {
  buildWarehouseOriginalRows,
  buildWarehouseRouteWithQuery,
  getWarehouseSearchParams,
  readWarehouseMergeBatchLedger,
} from './warehouse-shared'

type SummaryFilterField = 'keyword' | 'riskLevel' | 'issueType' | 'currentStage'
type SummaryNavigationTarget = keyof CuttingSummaryNavigationPayload

interface SummaryFilters {
  keyword: string
  riskLevel: 'ALL' | CuttingSummaryRiskLevel
  issueType: 'ALL' | CuttingSummaryIssueType
  currentStage: 'ALL' | ProductionProgressStageKey
  pendingReplenishmentOnly: boolean
  pendingTicketsOnly: boolean
  pendingBagOnly: boolean
  specialProcessOnly: boolean
}

interface SummaryPrefilter {
  productionOrderNo?: string
  originalCutOrderNo?: string
  mergeBatchNo?: string
  ticketNo?: string
  bagCode?: string
  usageNo?: string
  suggestionId?: string
  processOrderNo?: string
  issueType?: CuttingSummaryIssueType
  riskLevel?: CuttingSummaryRiskLevel
}

interface SummaryPageState {
  filters: SummaryFilters
  prefilter: SummaryPrefilter | null
  querySignature: string
  activeIssueId: string | null
  activeRowId: string | null
}

const initialFilters: SummaryFilters = {
  keyword: '',
  riskLevel: 'ALL',
  issueType: 'ALL',
  currentStage: 'ALL',
  pendingReplenishmentOnly: false,
  pendingTicketsOnly: false,
  pendingBagOnly: false,
  specialProcessOnly: false,
}

const state: SummaryPageState = {
  filters: { ...initialFilters },
  prefilter: null,
  querySignature: '',
  activeIssueId: null,
  activeRowId: null,
}

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
  const mergeBatches = readWarehouseMergeBatchLedger()
  const productionRows = buildProductionProgressRows(cuttingOrderProgressRecords)
  const originalRows = buildWarehouseOriginalRows()
  const materialPrepRows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, mergeBatches).rows
  const markerStore = deserializeMarkerSpreadingStorage(localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))

  const feiDrafts = deserializeFeiTicketDraftsStorage(sessionStorage.getItem(CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY))
  const systemFeiLedger = buildSystemSeedFeiTicketLedger({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })
  const ticketRecords = mergeByKey<FeiTicketLabelRecord>(
    systemFeiLedger.ticketRecords,
    deserializeFeiTicketRecordsStorage(localStorage.getItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY)),
    'ticketRecordId',
  )
  const printJobs = mergeByKey<FeiTicketPrintJob>(
    systemFeiLedger.printJobs,
    deserializeFeiTicketPrintJobsStorage(localStorage.getItem(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY)),
    'printJobId',
  )
  const feiViewModel = buildFeiTicketsViewModel({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    ticketRecords,
    printJobs,
    drafts: feiDrafts,
    prefilter: null,
  })

  const fabricWarehouseView = buildFabricWarehouseViewModel(originalRows)
  const cutPieceWarehouseView = buildCutPieceWarehouseViewModel(originalRows)
  const sampleWarehouseView = buildSampleWarehouseViewModel(originalRows)

  const transferSeed = buildSystemSeedTransferBagStore({
    originalRows,
    ticketRecords,
    mergeBatches,
  })
  const transferStore = mergeTransferBagStores(
    transferSeed,
    deserializeTransferBagStorage(localStorage.getItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY)),
  )
  const transferBagView = buildTransferBagViewModel({
    originalRows,
    ticketRecords,
    mergeBatches,
    store: transferStore,
  })
  const transferBagReturnView = buildTransferBagReturnViewModel({
    store: transferStore,
    baseViewModel: transferBagView,
  })

  const replenishmentView = buildReplenishmentViewModel({
    materialPrepRows,
    originalRows,
    mergeBatches,
    markerStore,
    reviews: deserializeReplenishmentReviewsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY)),
    impactPlans: deserializeReplenishmentImpactPlansStorage(localStorage.getItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY)),
  })

  const specialProcessView = buildSpecialProcessViewModel({
    originalRows,
    mergeBatches,
    orders: deserializeSpecialProcessOrdersStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY)),
    bindingPayloads: deserializeBindingStripPayloadsStorage(
      localStorage.getItem(CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY),
    ),
  })

  return {
    productionRows,
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    feiViewModel,
    fabricWarehouseView,
    cutPieceWarehouseView,
    sampleWarehouseView,
    transferBagView,
    transferBagReturnView,
    replenishmentView,
    specialProcessView,
  }
}

function buildPageData(): {
  sources: CuttingSummaryBuildOptions
  viewModel: CuttingSummaryViewModel
} {
  const sources = buildSources()
  return {
    sources,
    viewModel: buildCuttingSummaryViewModel(sources),
  }
}

function getPrefilterFromQuery(): SummaryPrefilter | null {
  const params = getWarehouseSearchParams()
  const prefilter: SummaryPrefilter = {
    productionOrderNo: params.get('productionOrderNo') || undefined,
    originalCutOrderNo: params.get('originalCutOrderNo') || undefined,
    mergeBatchNo: params.get('mergeBatchNo') || undefined,
    ticketNo: params.get('ticketNo') || undefined,
    bagCode: params.get('bagCode') || undefined,
    usageNo: params.get('usageNo') || undefined,
    suggestionId: params.get('suggestionId') || undefined,
    processOrderNo: params.get('processOrderNo') || undefined,
    issueType: (params.get('issueType') as CuttingSummaryIssueType | null) || undefined,
    riskLevel: (params.get('riskLevel') as CuttingSummaryRiskLevel | null) || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function rowMatchesPrefilter(row: CuttingSummaryRow, prefilter: SummaryPrefilter | null): boolean {
  if (!prefilter) return true
  if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo) return false
  if (prefilter.originalCutOrderNo && !row.relatedOriginalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
  if (prefilter.mergeBatchNo && !row.relatedMergeBatchNos.includes(prefilter.mergeBatchNo)) return false
  if (prefilter.ticketNo && !row.relatedTicketNos.includes(prefilter.ticketNo)) return false
  if (prefilter.bagCode && !row.relatedBagCodes.includes(prefilter.bagCode)) return false
  if (prefilter.usageNo && !row.relatedUsageNos.includes(prefilter.usageNo)) return false
  if (prefilter.suggestionId && !row.relatedSuggestionIds.includes(prefilter.suggestionId)) return false
  if (prefilter.processOrderNo && !row.relatedProcessOrderNos.includes(prefilter.processOrderNo)) return false
  if (prefilter.issueType && !row.issueTypes.includes(prefilter.issueType)) return false
  if (prefilter.riskLevel && row.overallRiskLevel !== prefilter.riskLevel) return false
  return true
}

function getFilteredRows(viewModel: CuttingSummaryViewModel): CuttingSummaryRow[] {
  const keyword = state.filters.keyword.trim().toLowerCase()

  return filterSummaryByIssueType(viewModel.rows, state.filters.issueType).filter((row) => {
    if (!rowMatchesPrefilter(row, state.prefilter)) return false
    if (state.filters.riskLevel !== 'ALL' && row.overallRiskLevel !== state.filters.riskLevel) return false
    if (state.filters.currentStage !== 'ALL' && row.currentStageKey !== state.filters.currentStage) return false
    if (state.filters.pendingReplenishmentOnly && row.pendingReplenishmentCount === 0) return false
    if (state.filters.pendingTicketsOnly && row.unprintedOwnerCount === 0) return false
    if (state.filters.pendingBagOnly && row.openBagUsageCount === 0) return false
    if (state.filters.specialProcessOnly && row.openSpecialProcessCount === 0) return false
    if (keyword && !row.keywordIndex.some((token) => token.includes(keyword))) return false
    return true
  })
}

function getActiveRowId(viewModel: CuttingSummaryViewModel, filteredRows: CuttingSummaryRow[]): string | null {
  if (state.activeRowId && filteredRows.some((row) => row.rowId === state.activeRowId)) return state.activeRowId
  if (state.activeIssueId) {
    const issue = viewModel.issuesById[state.activeIssueId]
    const matched = filteredRows.find((row) => issue?.relatedRowIds.includes(row.rowId))
    if (matched) return matched.rowId
  }
  return filteredRows[0]?.rowId || null
}

function syncStateWithQuery(viewModel: CuttingSummaryViewModel): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return

  state.querySignature = pathname
  state.prefilter = getPrefilterFromQuery()

  if (state.prefilter?.issueType) state.filters.issueType = state.prefilter.issueType
  if (state.prefilter?.riskLevel) state.filters.riskLevel = state.prefilter.riskLevel

  if (state.prefilter?.issueType) {
    const issue = viewModel.issues.find((item) => item.issueType === state.prefilter?.issueType) || null
    state.activeIssueId = issue?.issueId || null
    state.activeRowId = issue?.relatedRowIds[0] || null
    return
  }

  const matched = viewModel.rows.find((row) => rowMatchesPrefilter(row, state.prefilter))
  state.activeRowId = matched?.rowId || viewModel.rows[0]?.rowId || null
  state.activeIssueId = null
}

function clearLocateState(): void {
  state.prefilter = null
  state.querySignature = getCanonicalCuttingPath('summary')
  appStore.navigate(getCanonicalCuttingPath('summary'))
}

function navigateWithPayload(target: SummaryNavigationTarget, payload: Record<string, string | undefined>): boolean {
  const pathMap: Record<SummaryNavigationTarget, string> = {
    productionProgress: getCanonicalCuttingPath('production-progress'),
    cuttablePool: getCanonicalCuttingPath('cuttable-pool'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
    originalOrders: getCanonicalCuttingPath('original-orders'),
    materialPrep: getCanonicalCuttingPath('material-prep'),
    markerSpreading: getCanonicalCuttingPath('marker-spreading'),
    feiTickets: getCanonicalCuttingPath('fei-tickets'),
    fabricWarehouse: getCanonicalCuttingPath('fabric-warehouse'),
    cutPieceWarehouse: getCanonicalCuttingPath('cut-piece-warehouse'),
    sampleWarehouse: getCanonicalCuttingPath('sample-warehouse'),
    transferBags: getCanonicalCuttingPath('transfer-bags'),
    replenishment: getCanonicalCuttingPath('replenishment'),
    specialProcesses: getCanonicalCuttingPath('special-processes'),
    summary: getCanonicalCuttingPath('summary'),
  }

  appStore.navigate(buildWarehouseRouteWithQuery(pathMap[target], payload))
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
  if (!state.prefilter) return ''

  const chips = [
    state.prefilter.productionOrderNo ? `生产单：${state.prefilter.productionOrderNo}` : '',
    state.prefilter.originalCutOrderNo ? `原始裁片单：${state.prefilter.originalCutOrderNo}` : '',
    state.prefilter.mergeBatchNo ? `批次：${state.prefilter.mergeBatchNo}` : '',
    state.prefilter.ticketNo ? `菲票：${state.prefilter.ticketNo}` : '',
    state.prefilter.bagCode ? `口袋：${state.prefilter.bagCode}` : '',
    state.prefilter.usageNo ? `usage：${state.prefilter.usageNo}` : '',
    state.prefilter.processOrderNo ? `工艺单：${state.prefilter.processOrderNo}` : '',
    state.prefilter.suggestionId ? `补料建议：${state.prefilter.suggestionId}` : '',
    state.prefilter.issueType ? `问题：${cuttingSummaryIssueMetaMap[state.prefilter.issueType].label}` : '',
    state.prefilter.riskLevel ? `风险：${cuttingSummaryRiskMetaMap[state.prefilter.riskLevel].label}` : '',
  ].filter(Boolean)

  return renderWorkbenchStateBar({
    summary: '当前已根据外部入口定位相关链路：',
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

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="grid gap-3 xl:grid-cols-7">
      <label class="space-y-2 xl:col-span-2">
        <span class="text-sm font-medium text-foreground">跨对象搜索</span>
        <input
          value="${escapeHtml(state.filters.keyword)}"
          placeholder="生产单 / 原始裁片单 / 批次 / 菲票 / bagCode / usage / 工艺单"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-cutting-summary-field="keyword"
        />
      </label>
      ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
        { value: 'ALL', label: '全部风险' },
        { value: 'HIGH', label: '高风险' },
        { value: 'MEDIUM', label: '中风险' },
        { value: 'LOW', label: '低风险' },
      ])}
      ${renderFilterSelect('问题类别', 'issueType', state.filters.issueType, [
        { value: 'ALL', label: '全部问题' },
        ...Object.values(cuttingSummaryIssueMetaMap).map((meta) => ({ value: meta.key, label: meta.label })),
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
      <div class="flex flex-wrap items-end gap-2 xl:col-span-2">
        ${renderWorkbenchFilterChip(
          state.filters.pendingReplenishmentOnly ? '已选：待补料' : '只看待补料',
          'data-cutting-summary-action="toggle-replenishment"',
          'amber',
        )}
        ${renderWorkbenchFilterChip(
          state.filters.pendingTicketsOnly ? '已选：待打票' : '只看待打票',
          'data-cutting-summary-action="toggle-tickets"',
          'blue',
        )}
        ${renderWorkbenchFilterChip(
          state.filters.pendingBagOnly ? '已选：待交接 / 待回仓' : '只看待交接 / 待回仓',
          'data-cutting-summary-action="toggle-bags"',
          'rose',
        )}
        ${renderWorkbenchFilterChip(
          state.filters.specialProcessOnly ? '已选：特殊工艺' : '只看特殊工艺',
          'data-cutting-summary-action="toggle-special"',
          'emerald',
        )}
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="clear-filters">清除筛选条件</button>
      </div>
    </div>
  `)
}

function renderIssueBoard(viewModel: CuttingSummaryViewModel): string {
  if (!viewModel.issues.length) {
    return `
      <section class="rounded-lg border border-dashed bg-card px-4 py-6 text-sm text-muted-foreground">
        当前没有待处理问题，裁片域链路已基本收口。
      </section>
    `
  }

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 class="text-base font-semibold text-foreground">异常与待处理总览</h2>
        <p class="mt-1 text-sm text-muted-foreground">先看问题类别，再联动下方主表和详情区定位断点。</p>
      </div>
      <div class="grid gap-3 xl:grid-cols-5">
        ${viewModel.issues
          .map((issue) => {
            const issueMeta = cuttingSummaryIssueMetaMap[issue.issueType]
            const riskMeta = cuttingSummaryRiskMetaMap[issue.severity]
            const activeClass = state.activeIssueId === issue.issueId ? 'border-blue-500 bg-blue-50' : 'hover:border-slate-300'
            return `
              <button
                type="button"
                class="rounded-lg border p-3 text-left transition ${activeClass}"
                data-cutting-summary-action="focus-issue"
                data-issue-id="${issue.issueId}"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${issueMeta.className}">${escapeHtml(issueMeta.label)}</span>
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskMeta.className}">${escapeHtml(riskMeta.label)}</span>
                </div>
                <p class="mt-2 text-sm font-semibold text-foreground">${formatCount(issue.relatedProductionOrderNos.length)} 个关联生产单</p>
                <p class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(issue.summary)}</p>
                <p class="mt-2 text-xs text-blue-600">${escapeHtml(issue.actionHint)}</p>
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderMainTable(rows: CuttingSummaryRow[]): string {
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">链路汇总主表</h2>
          <p class="mt-1 text-sm text-muted-foreground">默认按生产单视角汇总，继续串起原始裁片单、批次、打票、仓储、交接、补料与特殊工艺。</p>
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
                  <th class="px-3 py-2">原始裁片单数</th>
                  <th class="px-3 py-2">合并批次数</th>
                  <th class="px-3 py-2">当前阶段总览</th>
                  <th class="px-3 py-2">配料 / 领料摘要</th>
                  <th class="px-3 py-2">铺布 / 补料摘要</th>
                  <th class="px-3 py-2">打票摘要</th>
                  <th class="px-3 py-2">仓储 / 交接摘要</th>
                  <th class="px-3 py-2">特殊工艺摘要</th>
                  <th class="px-3 py-2">总体风险</th>
                  <th class="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const riskMeta = cuttingSummaryRiskMetaMap[row.overallRiskLevel]
                    const activeClass = state.activeRowId === row.rowId ? 'bg-blue-50/70' : ''
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
                        <td class="px-3 py-3">${formatCount(row.originalCutOrderCount)}</td>
                        <td class="px-3 py-3">${formatCount(row.mergeBatchCount)}</td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.progressSummary)}</td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.materialPrepSummary)}</td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(`${row.spreadingSummary} / ${row.replenishmentSummary}`)}</td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.ticketSummary)}</td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(`${row.warehouseSummary} / ${row.bagUsageSummary}`)}</td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.specialProcessSummary)}</td>
                        <td class="px-3 py-3">
                          <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskMeta.className}">${escapeHtml(riskMeta.label)}</span>
                          ${row.riskTags.length ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.riskTags.slice(0, 3).join(' / '))}</p>` : ''}
                        </td>
                        <td class="px-3 py-3 text-right">
                          <div class="flex justify-end gap-2">
                            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="focus-row" data-row-id="${row.rowId}">查看收口</button>
                            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="navigate-row" data-row-id="${row.rowId}" data-nav-target="productionProgress">去处理</button>
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
              当前筛选条件下没有命中的裁片收口行，请调整搜索、问题类型或风险筛选。
            </div>
          `,
      )}
    </section>
  `
}

function renderListPills(items: string[], emptyText: string): string {
  if (!items.length) return `<p class="text-sm text-muted-foreground">${escapeHtml(emptyText)}</p>`
  return `
    <div class="flex flex-wrap gap-2">
      ${items
        .map((item) => `<span class="inline-flex rounded-full border bg-muted/30 px-2 py-0.5 text-xs text-foreground">${escapeHtml(item)}</span>`)
        .join('')}
    </div>
  `
}

function renderDetailPanel(detail: CuttingSummaryDetailPanelData | null): string {
  if (!detail) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold text-foreground">对象详情联动区</h2>
        <p class="mt-2 text-sm text-muted-foreground">点击问题项或主表行后，这里会展示生产单、原始裁片单、批次、打票、仓储、交接、补料与特殊工艺的联动摘要。</p>
      </section>
    `
  }

  const latestPrintJob = detail.printJobs[0]
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">对象详情联动区</h2>
          <p class="mt-1 text-sm text-muted-foreground">当前聚焦 ${escapeHtml(detail.row.productionOrderNo)}，用于收口核查和问题回跳。</p>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="close-overlay">清空当前选中</button>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <article class="rounded-lg border bg-muted/20 p-3">
          <h3 class="text-sm font-semibold text-foreground">基础对象摘要</h3>
          <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt class="text-muted-foreground">生产单号</dt><dd class="font-medium text-foreground">${escapeHtml(detail.row.productionOrderNo)}</dd></div>
            <div><dt class="text-muted-foreground">款号 / SPU</dt><dd class="font-medium text-foreground">${escapeHtml(`${detail.row.styleCode} / ${detail.row.spuCode}`)}</dd></div>
            <div><dt class="text-muted-foreground">原始裁片单数</dt><dd class="font-medium text-foreground">${formatCount(detail.row.originalCutOrderCount)}</dd></div>
            <div><dt class="text-muted-foreground">合并批次数</dt><dd class="font-medium text-foreground">${formatCount(detail.row.mergeBatchCount)}</dd></div>
            <div><dt class="text-muted-foreground">当前阶段</dt><dd class="font-medium text-foreground">${escapeHtml(detail.row.currentStageLabel)}</dd></div>
            <div><dt class="text-muted-foreground">总体风险</dt><dd><span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cuttingSummaryRiskMetaMap[detail.row.overallRiskLevel].className}">${escapeHtml(cuttingSummaryRiskMetaMap[detail.row.overallRiskLevel].label)}</span></dd></div>
          </dl>
        </article>

        <article class="rounded-lg border bg-muted/20 p-3">
          <h3 class="text-sm font-semibold text-foreground">打票 / 二维码摘要</h3>
          <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt class="text-muted-foreground">最新打印作业号</dt><dd class="font-medium text-foreground">${escapeHtml(latestPrintJob?.printJobNo || detail.row.latestPrintJobNo || '待补')}</dd></div>
            <div><dt class="text-muted-foreground">已打票数 / 待打票主体</dt><dd class="font-medium text-foreground">${formatCount(detail.ticketRecords.length)} / ${formatCount(detail.row.unprintedOwnerCount)}</dd></div>
            <div><dt class="text-muted-foreground">二维码 schema version</dt><dd class="font-medium text-foreground">${escapeHtml(detail.row.qrSchemaVersions.join(' / ') || '1.0.0')}</dd></div>
            <div><dt class="text-muted-foreground">最近打印时间</dt><dd class="font-medium text-foreground">${escapeHtml(latestPrintJob ? formatDateTime(latestPrintJob.printedAt) : '待打印')}</dd></div>
          </dl>
        </article>
      </div>

      <div class="grid gap-3 xl:grid-cols-2">
        <article class="rounded-lg border p-3">
          <h3 class="text-sm font-semibold text-foreground">原始裁片单摘要</h3>
          <div class="mt-3 space-y-2">
            ${detail.originalRows
              .slice(0, 6)
              .map(
                (row) => `
                  <div class="rounded-md border px-3 py-2 text-sm">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-medium text-foreground">${escapeHtml(row.originalCutOrderNo)}</span>
                      <span class="text-xs text-muted-foreground">${escapeHtml(`${row.currentStage.label} / ${row.cuttableState.label}`)}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">关联批次：${escapeHtml(row.mergeBatchNos.join(' / ') || '未入批次')}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </article>

        <article class="rounded-lg border p-3">
          <h3 class="text-sm font-semibold text-foreground">批次 / 仓储 / 交接摘要</h3>
          <div class="mt-3 space-y-2 text-sm">
            <p class="text-muted-foreground">批次：${escapeHtml(detail.mergeBatches.map((batch) => batch.mergeBatchNo).join(' / ') || '未生成')}</p>
            <p class="text-muted-foreground">裁片仓：${escapeHtml(detail.cutPieceItems.length ? detail.cutPieceItems.map((item) => `${item.originalCutOrderNo}(${item.warehouseStatus.label}/${item.handoffStatus.label})`).slice(0, 4).join(' / ') : '暂无裁片仓记录')}</p>
            <p class="text-muted-foreground">周转口袋：${escapeHtml(detail.bagUsages.length ? detail.bagUsages.map((item) => `${item.usageNo}/${item.statusMeta.label}`).join(' / ') : '未进入周转交接')}</p>
            <p class="text-muted-foreground">回货状态：${escapeHtml(detail.returnUsages.length ? detail.returnUsages.map((item) => `${item.usageNo}/${item.bagStatusMeta?.label || '待补'}`).join(' / ') : '暂无回货记录')}</p>
            <p class="text-muted-foreground">袋况异常：${escapeHtml(detail.conditionItems.filter((item) => item.decisionMeta.reusableDecision !== 'REUSABLE').map((item) => `${item.bagCode}/${item.decisionMeta.label}`).join(' / ') || '无异常')}</p>
          </div>
        </article>
      </div>

      <div class="grid gap-3 xl:grid-cols-2">
        <article class="rounded-lg border p-3">
          <h3 class="text-sm font-semibold text-foreground">补料 / 特殊工艺摘要</h3>
          <div class="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>补料建议：${escapeHtml(detail.replenishments.length ? detail.replenishments.map((item) => `${item.suggestionNo}/${item.statusMeta.label}`).join(' / ') : '暂无')}</p>
            <p>特殊工艺：${escapeHtml(detail.specialProcesses.length ? detail.specialProcesses.map((item) => `${item.processOrderNo}/${item.statusMeta.label}`).join(' / ') : '暂无')}</p>
          </div>
        </article>

        <article class="rounded-lg border p-3">
          <h3 class="text-sm font-semibold text-foreground">样衣 / 面料仓摘要</h3>
          <div class="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>裁床仓：${escapeHtml(detail.fabricStocks.length ? detail.fabricStocks.map((item) => `${item.materialSku}/${formatFabricWarehouseLength(item.remainingLengthTotal)}`).slice(0, 4).join(' / ') : '暂无')}</p>
            <p>样衣仓：${escapeHtml(detail.sampleItems.length ? detail.sampleItems.map((item) => `${item.sampleNo}/${item.status.label}`).slice(0, 4).join(' / ') : '暂无')}</p>
          </div>
        </article>
      </div>
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
    hint: '按生产单 -> 原始裁片单 -> 批次 / 打票 / 周转口袋 / 补料 / 特殊工艺的结构查看链路。',
    defaultOpen: true,
    countText: detail ? `${detail.traceTree.length} 条根节点` : '待选择对象',
    body: detail
      ? `<ul class="space-y-3">${detail.traceTree.map((node) => renderTraceNode(node, detail.row.rowId)).join('')}</ul>`
      : '<p class="text-sm text-muted-foreground">选中主表行后，这里会联动展示完整链路关系。</p>',
  })
}

function renderQuickActions(detail: CuttingSummaryDetailPanelData | null): string {
  const renderAction = (label: string, target: SummaryNavigationTarget) =>
    `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="navigate-row" data-row-id="${detail?.row.rowId || ''}" data-nav-target="${target}">${escapeHtml(label)}</button>`

  return renderWorkbenchSecondaryPanel({
    title: '快速跳转处理区',
    hint: '发现问题后，直接跳回对应专业页面处理。',
    defaultOpen: true,
    body: detail
      ? `
          <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            ${renderAction('去生产单进度', 'productionProgress')}
            ${renderAction('去可裁排产', 'cuttablePool')}
            ${renderAction('去合并裁剪批次', 'mergeBatches')}
            ${renderAction('去原始裁片单', 'originalOrders')}
            ${renderAction('去仓库配料 / 领料', 'materialPrep')}
            ${renderAction('去唛架 / 铺布', 'markerSpreading')}
            ${renderAction('去菲票 / 打编号', 'feiTickets')}
            ${renderAction('去裁床仓', 'fabricWarehouse')}
            ${renderAction('去裁片仓', 'cutPieceWarehouse')}
            ${renderAction('去样衣仓', 'sampleWarehouse')}
            ${renderAction('去周转口袋 / 车缝交接', 'transferBags')}
            ${renderAction('去补料管理', 'replenishment')}
            ${renderAction('去特殊工艺', 'specialProcesses')}
          </div>
        `
      : '<p class="text-sm text-muted-foreground">选中主表行后可快速跳到对应专业页面。</p>',
  })
}

function renderCrossObjectSearchHint(viewModel: CuttingSummaryViewModel, rows: CuttingSummaryRow[]): string {
  const searchIndex = buildSummarySearchIndex(rows)
  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      当前跨对象搜索索引已覆盖 ${formatCount(searchIndex.length)} 条收口行，可直接搜 productionOrderNo / originalCutOrderNo / mergeBatchNo / ticketNo / bagCode / usageNo / processOrderNo。
      ${state.activeIssueId ? `当前问题联动：${escapeHtml(viewModel.issuesById[state.activeIssueId]?.summary || '')}` : ''}
    </section>
  `
}

function renderPage(): string {
  const { sources, viewModel } = buildPageData()
  syncStateWithQuery(viewModel)
  const filteredRows = getFilteredRows(viewModel)
  const activeRowId = getActiveRowId(viewModel, filteredRows)
  const detail = activeRowId ? buildSummaryDetailPanelData(activeRowId, { ...sources, rows: viewModel.rows }) : null
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'summary')

  return `
    <div class="space-y-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStats(viewModel)}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderIssueBoard(viewModel)}
      ${renderCrossObjectSearchHint(viewModel, filteredRows)}
      ${renderMainTable(filteredRows)}
      <section class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div class="space-y-4">
          ${renderDetailPanel(detail)}
        </div>
        <div class="space-y-4">
          ${renderTracePanel(detail)}
          ${renderQuickActions(detail)}
        </div>
      </section>
    </div>
  `
}

function getRowById(rowId: string | undefined): CuttingSummaryRow | null {
  if (!rowId) return null
  return buildPageData().viewModel.rowsById[rowId] || null
}

function getIssueById(issueId: string | undefined): CuttingSummaryIssue | null {
  if (!issueId) return null
  return buildPageData().viewModel.issuesById[issueId] || null
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
    const issue = getIssueById(actionNode.dataset.issueId)
    if (!issue) return false
    state.activeIssueId = issue.issueId
    state.filters.issueType = issue.issueType
    state.activeRowId = issue.relatedRowIds[0] || null
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
    return navigateWithPayload(navTarget, row.navigationPayload[navTarget])
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
