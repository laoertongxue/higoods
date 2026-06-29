import { renderDrawer as uiDrawer } from '../../../components/ui/index.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import {
  buildMarkerPlanProjection,
} from './marker-plan-projection.ts'
import { buildMarkerSpreadingProjection } from './marker-spreading-projection.ts'
import { spreadingOrderStatusMeta, type SpreadingOrder } from './marker-spreading-model.ts'
import { resolveSpreadingOrderMaterialReadiness } from '../../../data/fcs/cutting/spreading-material-readiness.ts'
import { buildMarkerSchemeFromPlan } from './marker-scheme-adapter.ts'
import {
  buildMarkerPlanBalanceRows,
  buildMarkerDemandMatchSummary,
  buildCombinedMarkerPlanContextCandidate,
  buildMarkerPlanGoSpreadingPath,
  buildMarkerPlanModeOptions,
  createMarkerPlanFromContext,
  deserializeMarkerPlanStorage,
  findMarkerPlanContextById,
  findMarkerPlanContextForPlan,
  getMarkerPlanInitialEditTab,
  getMarkerPlanSourceerencedWarning,
  getMarkerPlanStorageKey,
  hydrateMarkerPlan,
  serializeMarkerPlanStorage,
  type MarkerPlanBalanceSummaryRow,
  type MarkerPlanContextCandidate,
  type MarkerPlanExplosionSummary,
  type MarkerPlanViewRow,
} from './marker-plan-model.ts'
import {
  MARKER_SIZE_CODES,
  buildMarkerExplodedPieceQtyFormula,
  buildMarkerFinalUnitUsageFormula,
  buildMarkerFoldedEffectiveWidthFormula,
  buildMarkerPlanSystemUnitUsageFormula,
  buildMarkerPlannedSpreadLengthFormula,
  buildMarkerSkuExplodedPieceQtyFormula,
  buildMarkerTotalPiecesFormula,
  markerLayoutStatusMeta,
  markerMappingStatusMeta,
  markerPlanModeMeta,
  markerPlanStatusMeta,
  type MarkerBedModeKey,
  type MarkerDemandMatchSummary,
  type MarkerFoldConfig,
  type MarkerHighLowMatrixRow,
  type MarkerPlan,
  type MarkerPlanContextType,
  type MarkerPlanModeKey,
  type MarkerPieceExplosionRow,
  type MarkerPlanConfirmationStatusKey,
  type MarkerPlanSourceCutOrderRow,
  type MarkerPlanStatusKey,
  type MarkerPlanTabKey,
  type MarkerSchemeBed,
  type MarkerSchemeDemandRow,
} from './marker-plan-domain.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  renderCompactKpiCard,
  renderCompactKpiGroup,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'

type MarkerPlanRouteKind = 'LIST' | 'CREATE' | 'EDIT' | 'DETAIL' | 'OTHER'
type MarkerPlanListTab = 'ALL' | 'WAITING_LAYOUT' | 'DEMAND_DIFF' | 'WAITING_CONFIRM' | 'READY_FOR_SPREADING' | 'EXCEPTIONS'
type MarkerPlanDetailTabKey = 'overview' | 'source-cut-orders' | 'beds' | 'material' | 'spreading' | 'demand' | 'system-log'
type MarkerPlanListFilterField = 'keyword' | 'contextNo' | 'markerNo' | 'contextType' | 'mode' | 'status' | 'ready'
type MarkerPlanCreateStepKey = 'source' | 'combination' | 'layout' | 'match'
type MarkerPlanContextField = 'contextKeyword' | 'contextPageSize'
type MarkerPlanBasicField =
  | 'markerNo'
  | 'markerMode'
  | 'plannedLayerCount'
  | 'netLength'
  | 'manualUnitUsage'
  | 'remark'
  | 'confirmationRemark'
  | 'singleSpreadFixedLoss'
type MarkerPlanBedField =
  | 'bedNo'
  | 'bedMode'
  | 'colorCode'
  | 'plannedLayerCount'
  | 'markerLength'
  | 'markerPieceQtyPerLayer'
  | 'remark'
type MarkerPlanFoldField = 'originalEffectiveWidth' | 'foldAllowance' | 'foldDirection' | 'maxLayoutWidth'

interface MarkerPlanMappingDraft {
  targetSku: string
  colorMode: 'follow-source' | 'specified'
  specifiedColor: string
  partCode: string
  patternCode: string
  piecePerGarment: number
  note: string
}

interface MarkerPlanListFilters {
  keyword: string
  contextNo: string
  markerNo: string
  contextType: 'ALL' | MarkerPlanContextType
  mode: 'ALL' | MarkerPlanModeKey
  status: 'ALL' | MarkerPlanStatusKey
  ready: 'ALL' | 'YES' | 'NO'
}

interface MarkerPlanFeedback {
  tone: 'success' | 'warning'
  message: string
}

interface MarkerPlanPageState {
  querySignature: string
  listTab: MarkerPlanListTab
  filters: MarkerPlanListFilters
  activeTab: MarkerPlanTabKey
  activeCreateStep: MarkerPlanCreateStepKey
  draftPlan: MarkerPlan | null
  contextDrawerOpen: boolean
  contextKeyword: string
  contextPage: number
  contextPageSize: number
  selectedContextKeys: string[]
  mappingDrawerOpen: boolean
  mappingTargetRowId: string
  mappingDraft: MarkerPlanMappingDraft
  feedback: MarkerPlanFeedback | null
  referencedStructureEditConfirmed: boolean
}

const state: MarkerPlanPageState = {
  querySignature: '',
  listTab: 'ALL',
  filters: {
    keyword: '',
    contextNo: '',
    markerNo: '',
    contextType: 'ALL',
    mode: 'ALL',
    status: 'ALL',
    ready: 'ALL',
  },
  activeTab: 'basic',
  activeCreateStep: 'source',
  draftPlan: null,
  contextDrawerOpen: false,
  contextKeyword: '',
  contextPage: 1,
  contextPageSize: 5,
  selectedContextKeys: [],
  mappingDrawerOpen: false,
  mappingTargetRowId: '',
  mappingDraft: {
    targetSku: '',
    colorMode: 'follow-source',
    specifiedColor: '',
    partCode: '',
    patternCode: '',
    piecePerGarment: 0,
    note: '',
  },
  feedback: null,
  referencedStructureEditConfirmed: false,
}

const LIST_PATH = '/fcs/craft/cutting/marker-list'
const CREATE_PATH = '/fcs/craft/cutting/marker-create'
const EDIT_BASE_PATH = '/fcs/craft/cutting/marker-edit'
const DETAIL_BASE_PATH = '/fcs/craft/cutting/marker-detail'
const MARKER_PLAN_TOP_INFO_OFFSET_VAR = '--marker-plan-top-info-offset'
const CREATE_CONTEXT_PAGE_SIZE_OPTIONS = [5, 10, 20] as const

let markerPlanTopInfoResizeObserver: ResizeObserver | null = null
let markerPlanStickyResizeBound = false
let markerPlanStickySyncToken = 0
let markerPlanProjectionCache: { key: string; projection: ReturnType<typeof buildMarkerPlanProjection> } | null = null

function getCurrentPathname(): string {
  return appStore.getState().pathname
}

function getCurrentBasePath(): string {
  return getCurrentPathname().split('?')[0] || LIST_PATH
}

function getCurrentSearchParams(): URLSearchParams {
  const [, query] = getCurrentPathname().split('?')
  return new URLSearchParams(query || '')
}

function parseRoute(): { kind: MarkerPlanRouteKind; id: string } {
  const basePath = getCurrentBasePath()
  if (basePath === LIST_PATH) return { kind: 'LIST', id: '' }
  if (basePath === CREATE_PATH) return { kind: 'CREATE', id: '' }
  const editMatch = basePath.match(/^\/fcs\/craft\/cutting\/marker-edit\/([^/]+)$/)
  if (editMatch) return { kind: 'EDIT', id: decodeURIComponent(editMatch[1]) }
  const detailMatch = basePath.match(/^\/fcs\/craft\/cutting\/marker-detail\/([^/]+)$/)
  if (detailMatch) return { kind: 'DETAIL', id: decodeURIComponent(detailMatch[1]) }
  return { kind: 'OTHER', id: '' }
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildExportTimestamp(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

function updateMarkerPlanStickyOffsetFromDom(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const shell = document.querySelector<HTMLElement>('[data-marker-plan-top-shell]')

  if (!shell) {
    root.style.removeProperty(MARKER_PLAN_TOP_INFO_OFFSET_VAR)
    markerPlanTopInfoResizeObserver?.disconnect()
    markerPlanTopInfoResizeObserver = null
    return
  }

  const topOffset = 8
  const gapOffset = 8
  const shellHeight = Math.ceil(shell.getBoundingClientRect().height)
  root.style.setProperty(MARKER_PLAN_TOP_INFO_OFFSET_VAR, `${shellHeight + topOffset + gapOffset}px`)
}

function syncMarkerPlanStickyOffset(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const syncToken = markerPlanStickySyncToken + 1
  markerPlanStickySyncToken = syncToken

  const bindStickyOffset = (remainingRetries = 8) => {
    if (markerPlanStickySyncToken !== syncToken) return

    const shell = document.querySelector<HTMLElement>('[data-marker-plan-top-shell]')
    if (!shell) {
      if (remainingRetries > 0) {
        window.requestAnimationFrame(() => bindStickyOffset(remainingRetries - 1))
      } else {
        clearMarkerPlanStickyOffset()
      }
      return
    }

    updateMarkerPlanStickyOffsetFromDom()

    markerPlanTopInfoResizeObserver?.disconnect()
    markerPlanTopInfoResizeObserver = null

    if (typeof ResizeObserver !== 'undefined') {
      markerPlanTopInfoResizeObserver = new ResizeObserver(() => updateMarkerPlanStickyOffsetFromDom())
      markerPlanTopInfoResizeObserver.observe(shell)
    }

    if (!markerPlanStickyResizeBound) {
      window.addEventListener('resize', () => window.requestAnimationFrame(updateMarkerPlanStickyOffsetFromDom), {
        passive: true,
      })
      markerPlanStickyResizeBound = true
    }
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => bindStickyOffset())
  })
}

function clearMarkerPlanStickyOffset(): void {
  if (typeof document === 'undefined') return
  markerPlanStickySyncToken += 1
  document.documentElement.style.removeProperty(MARKER_PLAN_TOP_INFO_OFFSET_VAR)
  markerPlanTopInfoResizeObserver?.disconnect()
  markerPlanTopInfoResizeObserver = null
}

function formatNumber(value: number, digits = 2): string {
  return Number(value || 0).toFixed(digits)
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Number(value || 0), 0))
}

function formatSignedCount(value: number): string {
  const normalized = Math.round(Number(value || 0))
  const formatted = new Intl.NumberFormat('zh-CN').format(Math.abs(normalized))
  if (normalized > 0) return `+${formatted}`
  if (normalized < 0) return `-${formatted}`
  return '0'
}

function getPlanSourceTypeText(row: MarkerPlan | MarkerPlanViewRow): string {
  return row.cutOrderNos.length > 1 ? '组合裁片单' : '裁片单'
}

function getPlanSourceNoText(row: MarkerPlan | MarkerPlanViewRow): string {
  const sourceNos = row.cutOrderNos.filter(Boolean)
  if (!sourceNos.length) return '—'
  if (sourceNos.length > 2) return `${sourceNos.slice(0, 2).join(' / ')} 等 ${sourceNos.length} 个`
  return sourceNos.join(' / ')
}

function getPlanTechPackText(row: MarkerPlan | MarkerPlanViewRow): string {
  return [row.techPackStatus || '正式版', row.techPackVersion].filter(Boolean).join(' ') || '正式版'
}

function getPlanBedCountText(row: MarkerPlan | MarkerPlanViewRow): string {
  const beds = row.beds || []
  if (!beds.length) return '0 / 0'
  const readyCount = beds.filter((bed) => bed.readyForSpreading).length
  return `${readyCount} / ${beds.length}`
}

function getPlanBedModeText(row: MarkerPlan | MarkerPlanViewRow): string {
  const modeLabels = Array.from(
    new Set(
      (row.beds || [])
        .map((bed) => markerPlanModeMeta[bed.bedMode]?.label)
        .filter(Boolean),
    ),
  )
  return modeLabels.length ? modeLabels.join(' / ') : markerPlanModeMeta[row.markerMode].label
}

function getPlanSpreadingStatusText(row: MarkerPlan | MarkerPlanViewRow): string {
  return row.readyForSpreading ? '可交接铺布' : '未交接铺布'
}

function getPlanDemandMatchSummary(plan: MarkerPlan | MarkerPlanViewRow): MarkerDemandMatchSummary {
  if ('demandMatchSummary' in plan) return plan.demandMatchSummary
  return buildMarkerDemandMatchSummary(plan)
}

function getDemandMatchStatusMeta(status: MarkerDemandMatchSummary['status']): { label: string; className: string } {
  if (status === '已匹配') return { label: status, className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' }
  if (status === '有不足') return { label: status, className: 'bg-amber-100 text-amber-700 border border-amber-200' }
  if (status === '有超出') return { label: status, className: 'bg-blue-100 text-blue-700 border border-blue-200' }
  if (status === '有差异') return { label: status, className: 'bg-rose-100 text-rose-700 border border-rose-200' }
  return { label: status, className: 'bg-slate-100 text-slate-700 border border-slate-200' }
}

function getConfirmationStatusMeta(status: MarkerPlanConfirmationStatusKey | undefined): { label: string; className: string } {
  if (status === '已确认') return { label: '已确认', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' }
  if (status === '需调整') return { label: '需调整', className: 'bg-rose-100 text-rose-700 border border-rose-200' }
  return { label: '待确认', className: 'bg-amber-100 text-amber-700 border border-amber-200' }
}

function getListTabMeta(listTab: MarkerPlanListTab): { label: string; countLabel: string } {
  if (listTab === 'EXCEPTIONS') {
    return { label: '异常待处理', countLabel: '异常方案数' }
  }
  if (listTab === 'WAITING_LAYOUT') {
    return { label: '待补唛架', countLabel: '待补唛架方案数' }
  }
  if (listTab === 'DEMAND_DIFF') {
    return { label: '有需求差异', countLabel: '差异方案数' }
  }
  if (listTab === 'WAITING_CONFIRM') {
    return { label: '待业务确认', countLabel: '待确认方案数' }
  }
  if (listTab === 'READY_FOR_SPREADING') {
    return { label: '可交接铺布', countLabel: '可交接铺布方案数' }
  }
  return { label: '全部方案', countLabel: '方案总数' }
}

function getPlanListTabCount(listTab: MarkerPlanListTab, rows: MarkerPlanViewRow[]): number {
  if (listTab === 'EXCEPTIONS') return rows.filter(hasPlanExceptionIssue).length
  if (listTab === 'ALL') return rows.length
  if (listTab === 'WAITING_LAYOUT') return rows.filter((row) => row.layoutStatus !== 'done').length
  if (listTab === 'DEMAND_DIFF') return rows.filter((row) => row.demandMatchSummary.status !== '已匹配' && row.demandMatchSummary.status !== '待编辑唛架').length
  if (listTab === 'WAITING_CONFIRM') return rows.filter((row) => row.layoutStatus === 'done' && row.confirmationStatus !== '已确认').length
  return rows.filter((row) => row.status === listTab).length
}

function buildMarkerPlanListTabOptions(viewModel = getViewModel()): Array<{ value: MarkerPlanListTab; label: string; count: number }> {
  const rows = viewModel.plans
  return ([
    'ALL',
    'WAITING_LAYOUT',
    'DEMAND_DIFF',
    'WAITING_CONFIRM',
    'READY_FOR_SPREADING',
    'EXCEPTIONS',
  ] as MarkerPlanListTab[]).map((value) => ({
    value,
    label: getListTabMeta(value).label,
    count: getPlanListTabCount(value, rows),
  }))
}

function buildExportFilename(tabLabel: string): string {
  return `唛架方案-${tabLabel}-${buildExportTimestamp()}.csv`
}

function safeNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function readStoredPlans(): MarkerPlan[] {
  try {
    return deserializeMarkerPlanStorage(localStorage.getItem(getMarkerPlanStorageKey()))
  } catch {
    return []
  }
}

function writeStoredPlans(records: MarkerPlan[]): void {
  localStorage.setItem(getMarkerPlanStorageKey(), serializeMarkerPlanStorage(records))
  markerPlanProjectionCache = null
}

function upsertStoredPlan(plan: MarkerPlan): void {
  const stored = readStoredPlans()
  const next = stored.filter((item) => item.id !== plan.id)
  next.push(plan)
  next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
  writeStoredPlans(next)
}

function removeStoredPlan(planId: string): void {
  if (!planId) return
  writeStoredPlans(readStoredPlans().filter((item) => item.id !== planId))
}

function getProjection() {
  const markerPlanStorage = localStorage.getItem(getMarkerPlanStorageKey()) || ''
  const spreadingStorage = localStorage.getItem('cuttingMarkerSpreadingLedger') || ''
  const key = `${markerPlanStorage.length}:${markerPlanStorage}|${spreadingStorage.length}:${spreadingStorage}`
  if (markerPlanProjectionCache?.key === key) return markerPlanProjectionCache.projection
  const projection = buildMarkerPlanProjection()
  markerPlanProjectionCache = { key, projection }
  return projection
}

function getViewModel() {
  return getProjection().viewModel
}

function normalizeCutOrderSelectionKey(cutOrderIds: string[]): string {
  return Array.from(new Set(cutOrderIds.map((id) => String(id || '').trim()).filter(Boolean))).sort().join('|')
}

function parseCutOrderIdFromContextKey(contextKey: string): string {
  const normalized = String(contextKey || '').trim()
  return normalized.startsWith('cut-order:') ? normalized.slice('cut-order:'.length) : normalized
}

function readCreateCutOrderIdsFromParams(params = getCurrentSearchParams()): string[] {
  const fromSelectedIds = params.getAll('selectedCutOrderIds').flatMap((value) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  const fromContextKeys = params.getAll('contextKey').map(parseCutOrderIdFromContextKey)
  return Array.from(new Set([...fromSelectedIds, ...fromContextKeys].filter(Boolean)))
}

function buildContextKeysFromCutOrderIds(cutOrderIds: string[]): string[] {
  return cutOrderIds.map((cutOrderId) => `cut-order:${cutOrderId}`)
}

function buildSelectedSourceRowsFromSelectedCutOrders(cutOrderIds: string[]): {
  ok: boolean
  message: string
  rows: MarkerPlanSourceCutOrderRow[]
} {
  const contextMap = getContextMap(getViewModel())
  const contexts = buildContextKeysFromCutOrderIds(cutOrderIds)
    .map((contextKey) => contextMap[contextKey] || null)
    .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
  const contextCutOrderIds = new Set(contexts.flatMap((context) => context.cutOrderIds))
  const missingIds = cutOrderIds.filter((cutOrderId) => !contextCutOrderIds.has(cutOrderId))
  if (missingIds.length) {
    return {
      ok: false,
      message: '部分裁片单在当前裁片单列表中无法恢复，请重新选择裁片单。',
      rows: [],
    }
  }
  const sourceRows = new Map<string, { context: MarkerPlanContextCandidate; row: MarkerPlanContextCandidate['sourceCutOrderRows'][number] }>()
  contexts.forEach((context) => {
    context.sourceCutOrderRows.forEach((row) => {
      if (!sourceRows.has(row.cutOrderId)) sourceRows.set(row.cutOrderId, { context, row })
    })
  })
  const rows = Array.from(sourceRows.values()).map(({ context, row }) => ({
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    spuCode: row.spuCode,
    styleCode: row.styleCode,
    materialSku: row.materialSku,
    materialName: row.materialName || row.materialLabel,
    materialColor: row.materialColor || row.color,
    materialAlias: row.materialAlias,
    materialImageUrl: row.materialImageUrl,
    patternFileId: row.patternFileId,
    patternFileName: row.patternFileName,
    patternVersion: row.patternVersion,
    effectiveWidthText: row.effectiveWidthText,
    piecePartNames: [...row.piecePartNames],
    availableQty: safeNumber(row.materialQuantityLedger.availableQty),
    unit: row.materialQuantityLedger.unit || row.availableUnit || row.materialUnit || '米',
    historyCombinationGroup: context.markerPlanGroupKey || row.latestMarkerPlanNo || '新组合',
  }))
  return { ok: true, message: '', rows }
}

function validateSourceCutOrderCombination(rows: MarkerPlanSourceCutOrderRow[]): { ok: boolean; message: string } {
  if (!rows.length) return { ok: false, message: '请先选择裁片单。' }
  const unique = (values: string[]) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
  if (unique(rows.map((row) => row.spuCode)).length > 1) {
    return { ok: false, message: 'SPU 不一致，不能进入同一个唛架方案。' }
  }
  if (unique(rows.map((row) => row.patternFileId)).length > 1) {
    return { ok: false, message: '纸样文件不一致，不能进入同一个唛架方案。' }
  }
  if (unique(rows.map((row) => row.patternVersion)).length > 1) {
    return { ok: false, message: '纸样版本不一致，不能进入同一个唛架方案。' }
  }
  if (unique(rows.map((row) => row.effectiveWidthText)).length > 1) {
    return { ok: false, message: '有效幅宽不一致，不能进入同一个唛架方案。' }
  }
  const historyGroups = unique(rows.map((row) => row.historyCombinationGroup || '新组合'))
  if (historyGroups.length > 1) {
    return { ok: false, message: '历史组合组不一致，重新排唛架时必须沿用原组合。' }
  }
  return { ok: true, message: '' }
}

function findExistingUnconfirmedDraftForSelection(cutOrderIds: string[]): MarkerPlan | null {
  const selectionKey = normalizeCutOrderSelectionKey(cutOrderIds)
  if (!selectionKey) return null
  return readStoredPlans().find((plan) => {
    if (plan.status === 'CANCELED' || plan.confirmationStatus === '已确认') return false
    return normalizeCutOrderSelectionKey(plan.cutOrderIds) === selectionKey
  }) || null
}

function validateSelectedSourceRows(plan: MarkerPlan): { ok: boolean; message: string } {
  const rows = plan.selectedSourceCutOrderRows || []
  if (!rows.length) {
    return parseRoute().kind === 'CREATE'
      ? { ok: false, message: '缺少来源裁片单清单，请先选择裁片单。' }
      : { ok: true, message: '' }
  }
  return { ok: true, message: '' }
}

function getContextMap(viewModel = getViewModel()): Record<string, MarkerPlanContextCandidate> {
  return Object.fromEntries(viewModel.contexts.map((context) => [context.contextKey, context]))
}

function getSelectedDrawerContexts(viewModel = getViewModel()): MarkerPlanContextCandidate[] {
  const contextMap = getContextMap(viewModel)
  const cutOrderContextKeys = new Set(getMarkerPlanCutOrderContexts(viewModel).map((context) => context.contextKey))
  return state.selectedContextKeys
    .map((contextKey) => contextMap[contextKey] || null)
    .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
    .filter((context) => cutOrderContextKeys.has(context.contextKey))
}

function getContextSpuCodes(contexts: MarkerPlanContextCandidate[]): string[] {
  return Array.from(new Set(contexts.map((context) => String(context.spuCode || '').trim()).filter(Boolean)))
}

function isMarkerPlanCutOrderContext(context: MarkerPlanContextCandidate): boolean {
  return context.contextType === 'cut-order' && context.sourceCutOrderRows.length > 0
}

function getMarkerPlanCutOrderContexts(viewModel = getViewModel()): MarkerPlanContextCandidate[] {
  return viewModel.contexts.filter(isMarkerPlanCutOrderContext)
}

function filterMarkerSourceContextsByKeyword(contexts: MarkerPlanContextCandidate[]): MarkerPlanContextCandidate[] {
  const keyword = state.contextKeyword.trim().toLowerCase()
  if (!keyword) return contexts
  return contexts.filter((context) => {
    const keywords = [
      context.contextNo,
      context.styleCode,
      context.spuCode,
      context.styleName,
      context.materialSkuSummary,
      context.colorSummary,
      ...context.productionOrderNos,
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase())
    return keywords.some((item) => item.includes(keyword))
  })
}

function validateMarkerPlanSourceSelection(contexts: MarkerPlanContextCandidate[]): { ok: boolean; message: string } {
  if (!contexts.length) return { ok: false, message: '请先选择裁片单。' }
  if (contexts.some((context) => !isMarkerPlanCutOrderContext(context))) {
    return { ok: false, message: '只能选择裁片单进入唛架方案。' }
  }
  const spuCodes = getContextSpuCodes(contexts)
  if (spuCodes.length > 1) {
    return { ok: false, message: `所选裁片单属于多个 SPU：${spuCodes.join(' / ')}，不能进入下一步。` }
  }
  const markerPlanGroupKeys = Array.from(new Set(contexts.map((context) => String(context.markerPlanGroupKey || '').trim()).filter(Boolean)))
  if (markerPlanGroupKeys.length > 1) {
    return { ok: false, message: '所选裁片单的 SPU、纸样、版本、幅宽或历史组合组不一致，不能进入同一个唛架方案。' }
  }
  const assigneeFactoryIds = Array.from(
    new Set(contexts.flatMap((context) => context.cuttingTaskAssigneeFactoryIds || []).filter(Boolean)),
  )
  if (assigneeFactoryIds.length > 1) {
    return { ok: false, message: '所选裁片单来源裁片任务已分配给不同承接工厂，不能进入同一个唛架方案。' }
  }
  if (contexts.some((context) => context.executionRoute === 'CONFLICT')) {
    return { ok: false, message: '所选裁片单存在承接方冲突，请先处理任务分配后再创建唛架方案。' }
  }
  return { ok: true, message: '' }
}

function syncContextDrawerSelectionDom(viewModel = getViewModel()): void {
  if (typeof document === 'undefined') return
  const selectedContexts = getSelectedDrawerContexts(viewModel)
  const selectedSpuCodes = getContextSpuCodes(selectedContexts)
  const selectionValidation = validateMarkerPlanSourceSelection(selectedContexts)
  const selectedSummary = selectedContexts.length
    ? `已选 ${selectedContexts.length} 个裁片单${selectedSpuCodes.length === 1 ? `，SPU：${selectedSpuCodes[0]}` : ''}`
    : '请先选择裁片单'
  const summaryNode = document.querySelector<HTMLElement>('[data-marker-plan-selection-summary]')
  const messageNode = document.querySelector<HTMLElement>('[data-marker-plan-selection-message]')
  const confirmButton = document.querySelector<HTMLButtonElement>('[data-marker-plan-action="confirm-context-create"]')
  summaryNode && (summaryNode.textContent = selectedSummary)
  const crossTaskSelected = selectedContexts.length > 1 && new Set(selectedContexts.flatMap((context) => context.cuttingTaskIds || [])).size > 1
  messageNode && (messageNode.textContent = selectionValidation.ok
    ? crossTaskSelected
      ? '可继续编辑唛架。当前为跨裁片任务方案，确认后这些裁片任务必须分配给同一个裁剪承接工厂。'
      : '可继续编辑唛架。'
    : selectionValidation.message)
  if (confirmButton) confirmButton.disabled = !selectionValidation.ok
  document.querySelectorAll<HTMLElement>('[data-marker-plan-context-row]').forEach((row) => {
    const contextKey = row.dataset.contextKey || ''
    row.classList.toggle('bg-blue-50/40', state.selectedContextKeys.includes(contextKey))
  })
}

function getMarkerPlanPageRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>([
    '[data-testid="cutting-marker-plan-list-page"]',
    '[data-testid="cutting-marker-plan-create-page"]',
    '[data-testid="cutting-marker-plan-edit-page"]',
    '[data-testid="cutting-marker-plan-detail-page"]',
  ].join(','))
}

function removeContextDrawerDom(): void {
  if (typeof document === 'undefined') return
  document.querySelector('[data-marker-plan-context-drawer-shell]')?.remove()
}

function getDraftContext(viewModel = getViewModel()): MarkerPlanContextCandidate | null {
  if (!state.draftPlan) return null
  return findMarkerPlanContextForPlan(viewModel.contexts, state.draftPlan) ?? null
}

function getDetailPlan(viewModel = getViewModel(), id = parseRoute().id): MarkerPlanViewRow | null {
  return viewModel.plansById[id] ?? null
}

function isEditingReferencedPlan(viewModel = getViewModel()): boolean {
  const route = parseRoute()
  if (route.kind !== 'EDIT') return false
  return Boolean(viewModel.plansById[route.id]?.isReferencedBySpreading)
}

function confirmReferencedStructuralEdit(viewModel = getViewModel()): boolean {
  if (!isEditingReferencedPlan(viewModel)) return true
  if (state.referencedStructureEditConfirmed) return true
  const confirmed = window.confirm('当前方案唛架已被铺布引用，修改配比、分配、唛架结构或模式可能影响后续铺布，是否继续？')
  if (confirmed) state.referencedStructureEditConfirmed = true
  return confirmed
}

function setFeedback(tone: MarkerPlanFeedback['tone'], message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function buildEditPath(id: string): string {
  return `${EDIT_BASE_PATH}/${encodeURIComponent(id)}`
}

function buildDetailPath(id: string): string {
  return `${DETAIL_BASE_PATH}/${encodeURIComponent(id)}`
}

function buildRouteWithQuery(pathname: string, payload?: Record<string, string | undefined>): string {
  if (!payload) return pathname
  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function getPlanColorOptions(plan: Pick<MarkerPlan, 'colorSummary' | 'pieceExplosionRows'>, context: MarkerPlanContextCandidate | null): string[] {
  const contextColors = context?.colorSummary.split(' / ') || []
  const rowColors = [
    ...String(plan.colorSummary || '').split(' / '),
    ...plan.pieceExplosionRows.map((row) => row.colorCode),
  ]
  return Array.from(new Set([...contextColors, ...rowColors].map((item) => String(item || '').trim()).filter(Boolean)))
}

function isHighLowBedMode(mode: MarkerBedModeKey): boolean {
  return mode === 'high_low' || mode === 'fold_high_low'
}

function isFoldBedMode(mode: MarkerBedModeKey): boolean {
  return mode === 'fold_normal' || mode === 'fold_high_low'
}

function buildHighLowStepLabel(stepNo: number): string {
  return `第${Math.max(Math.round(safeNumber(stepNo)), 1)}阶`
}

function getMarkerBedModeOptions(): MarkerBedModeKey[] {
  return ['normal', 'high_low', 'fold_normal', 'fold_high_low']
}

function getMarkerBedModePrefix(mode: MarkerBedModeKey): 'A' | 'B' {
  return isHighLowBedMode(mode) ? 'B' : 'A'
}

function getPlanDemandRows(plan: MarkerPlan | MarkerPlanViewRow): MarkerSchemeDemandRow[] {
  return buildMarkerSchemeFromPlan(plan as MarkerPlan).demandRows
}

function getPlanSizeOptions(plan: MarkerPlan | MarkerPlanViewRow): Array<{ code: string; name: string }> {
  const demandRows = getPlanDemandRows(plan)
  const fromDemand = demandRows.map((row) => ({
    code: row.sizeCode || row.sizeName,
    name: row.sizeName || row.sizeCode,
  }))
  const map = new Map<string, { code: string; name: string }>()
  fromDemand.forEach((item) => {
    const key = String(item.name || item.code || '').trim()
    if (key && !map.has(key)) map.set(key, { code: String(item.code || key), name: key })
  })
  return Array.from(map.values())
}

function getPlanColorOptionsFromDemand(plan: MarkerPlan | MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string[] {
  void context
  const demandColors = getPlanDemandRows(plan).map((row) => row.colorName || row.colorCode)
  return Array.from(new Set(demandColors.map((item) => String(item || '').trim()).filter(Boolean)))
}

function buildBedCoverageRows(
  plan: MarkerPlan,
  colorCode: string,
  selectedSizeNames: string[],
): MarkerSchemeBed['coverageRows'] {
  const sizeNameSet = new Set(selectedSizeNames.map((item) => String(item || '').trim()).filter(Boolean))
  return getPlanDemandRows(plan)
    .filter((row) => {
      const rowColor = row.colorName || row.colorCode
      const rowSize = row.sizeName || row.sizeCode
      return rowColor === colorCode && sizeNameSet.has(rowSize)
    })
    .map((row, index) => ({
      rowId: `${row.rowId}-coverage-${index + 1}`,
      colorCode: row.colorCode,
      colorName: row.colorName || row.colorCode,
      sizeCode: row.sizeCode,
      sizeName: row.sizeName || row.sizeCode,
      demandQty: row.demandQty,
      plannedQty: 0,
      remainingQty: row.demandQty,
    }))
}

function buildBedSizeSummary(coverageRows: MarkerSchemeBed['coverageRows']): string {
  return coverageRows
    .map((row) => row.sizeName || row.sizeCode)
    .filter(Boolean)
    .join(' / ')
}

function getMarkerMatrixSizeColumns(plan: MarkerPlan | MarkerPlanViewRow): string[] {
  const demandSizes = getPlanDemandRows(plan).map((row) => row.sizeName || row.sizeCode)
  return Array.from(new Set(demandSizes.map((item) => String(item || '').trim()).filter(Boolean)))
}

function getMarkerMatrixSizeDemandMap(plan: MarkerPlan | MarkerPlanViewRow): Record<string, number> {
  const map: Record<string, number> = {}
  getPlanDemandRows(plan).forEach((row) => {
    const size = String(row.sizeName || row.sizeCode || '').trim()
    if (!size) return
    map[size] = (map[size] || 0) + Math.max(Math.round(safeNumber(row.demandQty)), 0)
  })
  return map
}

function getMarkerMatrixColorRows(plan: MarkerPlan | MarkerPlanViewRow): string[] {
  return Array.from(
    new Set(getPlanDemandRows(plan).map((row) => row.colorName || row.colorCode).map((item) => String(item || '').trim()).filter(Boolean)),
  )
}

function getMarkerMatrixMaterialForColor(plan: MarkerPlan | MarkerPlanViewRow, colorName: string): string {
  const matchedMaterials = getPlanDemandRows(plan)
    .filter((row) => String(row.colorName || row.colorCode || '').trim() === String(colorName || '').trim())
    .map((row) => row.materialSku)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return Array.from(new Set(matchedMaterials)).join(' / ') || '—'
}

function createMarkerMatrixRows(plan: MarkerPlan | MarkerPlanViewRow, bed: MarkerSchemeBed): MarkerHighLowMatrixRow[] {
  const sizeColumns = getMarkerMatrixSizeColumns(plan)
  const colors = getMarkerMatrixColorRows(plan)
  const existingRows = Array.isArray(bed.highLowMatrixRows) ? bed.highLowMatrixRows : []
  const baseRows = existingRows.length
    ? existingRows
    : colors.map((color, index) => ({
        rowId: `${bed.bedId}-matrix-${index + 1}`,
        stepNo: index + 1,
        stepLabel: buildHighLowStepLabel(index + 1),
        colorCode: color,
        colorName: color,
        markerLength: 0,
        sizeValues: {},
        patternValues: {},
        totalQty: 0,
      }))
  return baseRows.map((existing, index) => {
    const color = existing.colorName || existing.colorCode || colors[0] || '主色'
    const sizeValues = Object.fromEntries(
      sizeColumns.map((size) => [size, Math.max(Math.round(safeNumber(existing?.sizeValues?.[size])), 0)]),
    ) as Record<string, number>
    const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeColumns)
    const totalQty = sizeColumns.reduce(
      (total, size) => total + Math.max(safeNumber(sizeValues[size]), 0) * Math.max(safeNumber(sizePiecePerLayer[size]), 0),
      0,
    )
    return {
      rowId: existing?.rowId || `${bed.bedId}-matrix-${index + 1}`,
      stepNo: index + 1,
      stepLabel: buildHighLowStepLabel(index + 1),
      colorCode: existing?.colorCode || color,
      colorName: color,
      markerLength: Math.max(safeNumber(existing?.markerLength), 0),
      sizeValues,
      patternValues: existing?.patternValues || {},
      totalQty,
    }
  })
}

function isHighLowMatrixMode(mode: MarkerBedModeKey): boolean {
  return mode === 'high_low' || mode === 'fold_high_low'
}

function normalizeMarkerSizePiecePerLayer(bed: MarkerSchemeBed, sizeColumns: string[]): Record<string, number> {
  return Object.fromEntries(
    sizeColumns.map((size) => [size, Math.max(Math.round(safeNumber(bed.sizePiecePerLayer?.[size])), 0)]),
  ) as Record<string, number>
}

function getMarkerMatrixCellLayer(row: MarkerHighLowMatrixRow, size: string): number {
  return Math.max(Math.round(safeNumber(row.sizeValues?.[size])), 0)
}

function getMarkerMatrixCellActualLayer(mode: MarkerBedModeKey, layerCount: number): number {
  const normalized = Math.max(Math.round(safeNumber(layerCount)), 0)
  return isFoldBedMode(mode) ? normalized / 2 : normalized
}

function getMarkerMatrixRowActiveLayer(mode: MarkerBedModeKey, row: MarkerHighLowMatrixRow, sizeColumns: string[]): number {
  return Math.max(...sizeColumns.map((size) => getMarkerMatrixCellActualLayer(mode, getMarkerMatrixCellLayer(row, size))), 0)
}

function getMarkerMatrixRowLength(bed: MarkerSchemeBed, row: MarkerHighLowMatrixRow): number {
  return isHighLowMatrixMode(bed.bedMode) ? Math.max(safeNumber(row.markerLength), 0) : Math.max(safeNumber(bed.markerLength), 0)
}

function getMarkerMatrixBedLengthSummary(bed: MarkerSchemeBed): number {
  if (!isHighLowMatrixMode(bed.bedMode)) return Math.max(safeNumber(bed.markerLength), 0)
  return (Array.isArray(bed.highLowMatrixRows) ? bed.highLowMatrixRows : []).reduce((total, row) => total + Math.max(safeNumber(row.markerLength), 0), 0)
}

function getMatrixActualLayer(mode: MarkerBedModeKey, demandLayer: number): number {
  const normalized = Math.max(Math.round(safeNumber(demandLayer)), 0)
  return isFoldBedMode(mode) ? normalized / 2 : normalized
}

function getMarkerMatrixColumnLayerTotals(rows: MarkerHighLowMatrixRow[], sizeColumns: string[]): Record<string, number> {
  return Object.fromEntries(
    sizeColumns.map((size) => [
      size,
      rows.reduce((total, row) => total + getMarkerMatrixCellLayer(row, size), 0),
    ]),
  )
}

function getMarkerMatrixColumnPieceTotals(
  rows: MarkerHighLowMatrixRow[],
  sizeColumns: string[],
  sizePiecePerLayer: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    sizeColumns.map((size) => [
      size,
      rows.reduce((total, row) => total + getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer), 0),
    ]),
  )
}

function getMarkerMatrixCellPlannedQty(row: MarkerHighLowMatrixRow, size: string, sizePiecePerLayer: Record<string, number>): number {
  return getMarkerMatrixCellLayer(row, size) * Math.max(Math.round(safeNumber(sizePiecePerLayer[size])), 0)
}

function getMarkerMatrixActualLayerTotal(mode: MarkerBedModeKey, rows: MarkerHighLowMatrixRow[], sizeColumns: string[]): number {
  const columnTotals = sizeColumns.map((size) =>
    rows.reduce((total, row) => {
      const layerCount = getMarkerMatrixCellLayer(row, size)
      return total + (layerCount > 0 ? getMatrixActualLayer(mode, layerCount) : 0)
    }, 0),
  )
  return Math.max(...columnTotals, 0)
}

function validateMarkerMatrixRows(
  mode: MarkerBedModeKey,
  rows: MarkerHighLowMatrixRow[],
  sizeColumns: string[],
  sizePiecePerLayer: Record<string, number>,
): string[] {
  const errors: string[] = []
  const foldMode = isFoldBedMode(mode)
  const highLowMode = isHighLowMatrixMode(mode)
  rows.forEach((row) => {
    const values = sizeColumns.map((size) => getMarkerMatrixCellLayer(row, size))
    const filledIndexes = values.map((value, index) => (value > 0 ? index : -1)).filter((index) => index >= 0)
    if (!filledIndexes.length) return
    if (mode === 'normal' || mode === 'fold_normal') {
      const firstValue = values[filledIndexes[0]]
      if (filledIndexes.some((index) => values[index] !== firstValue)) {
        errors.push(`${row.colorName} 普通模式同一行各尺码层数必须一致`)
      }
    }
    filledIndexes.forEach((index) => {
      const size = sizeColumns[index]
      if (Math.max(Math.round(safeNumber(sizePiecePerLayer[size])), 0) <= 0) {
        errors.push(`${size} 尺码必须先填写每层件数`)
      }
      if (foldMode && values[index] % 2 !== 0) {
        errors.push(`${row.colorName} ${size} 对折唛架的需求层数必须为偶数`)
      }
    })
    if (highLowMode && Math.max(safeNumber(row.markerLength), 0) <= 0) {
      errors.push(`${row.colorName} 高低层模式必须填写唛架净长度`)
    }
    if (!highLowMode) {
      return
    }
    const minIndex = Math.min(...filledIndexes)
    const maxIndex = Math.max(...filledIndexes)
    for (let index = minIndex; index <= maxIndex; index += 1) {
      if (values[index] <= 0) {
        errors.push(`${row.colorName} 高低层模式同一行不能中间断尺码`)
        break
      }
    }
  })

  sizeColumns.forEach((size) => {
    const columnValues = rows.map((row) => Math.max(Math.round(safeNumber(row.sizeValues?.[size])), 0))
    let started = false
    let ended = false
    columnValues.forEach((value) => {
      if (value > 0 && ended) errors.push(`${size} 列不能出现有层数的行之间夹空行`)
      if (value > 0) started = true
      if (started && value <= 0) ended = true
    })
  })

  if (mode === 'high_low' || mode === 'fold_high_low') {
    const totals = getMarkerMatrixColumnLayerTotals(rows, sizeColumns)
    sizeColumns.forEach((size, index) => {
      if (index === 0) return
      const previousSize = sizeColumns[index - 1]
      if ((totals[size] || 0) < (totals[previousSize] || 0)) {
        errors.push(`${size} 列累计层数不能低于左侧 ${previousSize} 列`)
      }
    })
  }
  return Array.from(new Set(errors))
}

function buildCoverageRowsFromMarkerMatrix(
  plan: MarkerPlan,
  rows: MarkerHighLowMatrixRow[],
  sizePiecePerLayer: Record<string, number>,
): MarkerSchemeBed['coverageRows'] {
  const plannedByColorSize = new Map<string, number>()
  rows.forEach((row) => {
    const color = String(row.colorName || row.colorCode || '').trim()
    Object.entries(row.sizeValues || {}).forEach(([size, value]) => {
      const key = `${color}::${String(size || '').trim()}`
      plannedByColorSize.set(
        key,
        (plannedByColorSize.get(key) || 0) + Math.max(Math.round(safeNumber(value)), 0) * Math.max(Math.round(safeNumber(sizePiecePerLayer[size])), 0),
      )
    })
  })
  const allocatedByColorSize = new Map<string, number>()
  return getPlanDemandRows(plan).map((demandRow, index) => {
    const color = demandRow.colorName || demandRow.colorCode
    const size = demandRow.sizeName || demandRow.sizeCode
    const key = `${String(color || '').trim()}::${String(size || '').trim()}`
    const plannedTotal = plannedByColorSize.get(key) || 0
    const allocatedQty = allocatedByColorSize.get(key) || 0
    const demandQty = Math.max(Math.round(safeNumber(demandRow.demandQty)), 0)
    const plannedQty = Math.min(Math.max(plannedTotal - allocatedQty, 0), demandQty)
    allocatedByColorSize.set(key, allocatedQty + plannedQty)
    return {
      rowId: `${demandRow.rowId}-coverage-${index + 1}`,
      colorCode: demandRow.colorCode,
      colorName: color,
      sizeCode: demandRow.sizeCode,
      sizeName: size,
      demandQty,
      plannedQty,
      remainingQty: Math.max(demandQty - plannedQty, 0),
    }
  })
}

function recalculateSchemeBed(bed: MarkerSchemeBed, plan: MarkerPlan): MarkerSchemeBed {
  const markerLength = Math.max(safeNumber(bed.markerLength), 0)
  const sizeColumns = getMarkerMatrixSizeColumns(plan)
  const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeColumns)
  const matrixRows = createMarkerMatrixRows(plan, bed)
  const matrixErrors = validateMarkerMatrixRows(bed.bedMode, matrixRows, sizeColumns, sizePiecePerLayer)
  const plannedLayerCount = getMarkerMatrixActualLayerTotal(bed.bedMode, matrixRows, sizeColumns)
  const plannedGarmentQty = matrixRows.reduce(
    (total, row) => total + sizeColumns.reduce((rowTotal, size) => rowTotal + getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer), 0),
    0,
  )
  const markerPieceQtyPerLayer = plannedLayerCount > 0 ? Math.max(Math.ceil(plannedGarmentQty / plannedLayerCount), 1) : 0
  const spreadTotalLength = isHighLowMatrixMode(bed.bedMode)
    ? matrixRows.reduce((total, row) => total + (getMarkerMatrixRowLength(bed, row) + Math.max(plan.singleSpreadFixedLoss || 0, 0)) * getMarkerMatrixRowActiveLayer(bed.bedMode, row, sizeColumns), 0)
    : (markerLength + Math.max(plan.singleSpreadFixedLoss || 0, 0)) * plannedLayerCount
  const unitFabricUsage = plannedGarmentQty > 0 ? spreadTotalLength / plannedGarmentQty : 0
  const coverageRows = buildCoverageRowsFromMarkerMatrix(plan, matrixRows, sizePiecePerLayer)
  const readyForSpreading = (isHighLowMatrixMode(bed.bedMode) || markerLength > 0) && plannedGarmentQty > 0 && matrixErrors.length === 0
  return {
    ...bed,
    bedName: bed.bedNo,
    sizePiecePerLayer,
    plannedLayerCount,
    markerLength: isHighLowMatrixMode(bed.bedMode) ? 0 : markerLength,
    markerPieceQtyPerLayer,
    plannedGarmentQty,
    spreadTotalLength,
    unitFabricUsage,
    highLowMatrixRows: matrixRows,
    coverageRows,
    sizeSummaryText: buildBedSizeSummary(coverageRows),
    readyForSpreading,
    status: readyForSpreading ? '可铺布' : '草稿',
  }
}

function buildDefaultSchemeBed(plan: MarkerPlan, context: MarkerPlanContextCandidate | null, mode: MarkerBedModeKey = 'normal'): MarkerSchemeBed {
  const existingBeds = buildMarkerSchemeFromPlan(plan).beds
  const prefix = getMarkerBedModePrefix(mode)
  const nextSort = existingBeds.length + 1
  const samePrefixCount = existingBeds.filter((bed) => bed.bedNo.startsWith(`${prefix}-`)).length + 1
  const colors = getPlanColorOptionsFromDemand(plan, context)
  const sizeColumns = getMarkerMatrixSizeColumns(plan)
  const sizePiecePerLayer = Object.fromEntries(sizeColumns.map((size) => [size, 0])) as Record<string, number>
  const matrixRows: MarkerHighLowMatrixRow[] = (colors.length ? colors : ['主色']).map((color, index) => ({
    rowId: `${plan.id}-new-marker-row-${Date.now()}-${index + 1}`,
    colorCode: color,
    colorName: color,
    markerLength: 0,
    sizeValues: Object.fromEntries(sizeColumns.map((size) => [size, 0])) as Record<string, number>,
    patternValues: {},
    totalQty: 0,
  }))
  return recalculateSchemeBed(
    {
      bedId: `${plan.id}-bed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schemeId: plan.schemeId || plan.id,
      schemeNo: plan.schemeNo || plan.markerNo,
      bedNo: `${prefix}-${samePrefixCount}`,
      bedName: `${prefix}-${samePrefixCount}`,
      bedSortOrder: nextSort,
      bedMode: mode,
      colorCode: colors.join(' / '),
      colorName: colors.join(' / '),
      materialSku: plan.sourceMaterialSku || plan.materialSkuSummary,
      sizeSummaryText: '',
      sizePiecePerLayer,
      plannedLayerCount: Math.max(plan.plannedLayerCount || 0, 1),
      markerLength: 0,
      markerPieceQtyPerLayer: 0,
      plannedGarmentQty: 0,
      spreadTotalLength: 0,
      unitFabricUsage: 0,
      normalLayoutRows: [],
      highLowMatrixRows: matrixRows,
      foldConfig: isFoldBedMode(mode) ? plan.foldConfig : null,
      coverageRows: [],
      bedImage: null,
      spreadingSessionIds: [],
      assignedCuttingTableIds: [],
      status: '草稿',
      readyForSpreading: false,
      lockedBySpreading: false,
      remark: '',
    },
    plan,
  )
}

function normalizeSchemeBeds(plan: MarkerPlan, beds: MarkerSchemeBed[]): MarkerSchemeBed[] {
  return beds.map((bed, index) => recalculateSchemeBed({
    ...bed,
    schemeId: plan.schemeId || plan.id,
    schemeNo: plan.schemeNo || plan.markerNo,
    bedSortOrder: index + 1,
    colorName: bed.colorName || bed.colorCode,
    materialSku: bed.materialSku || plan.sourceMaterialSku || plan.materialSkuSummary,
    foldConfig: isFoldBedMode(bed.bedMode) ? plan.foldConfig : null,
  }, plan))
}

function applySchemeBedsToPlan(plan: MarkerPlan, beds: MarkerSchemeBed[]): MarkerPlan {
  const nextBeds = normalizeSchemeBeds(plan, beds)
  const hasFoldBed = nextBeds.some((bed) => isFoldBedMode(bed.bedMode))
  return {
    ...plan,
    markerMode: nextBeds[0]?.bedMode || plan.markerMode,
    beds: nextBeds,
    foldConfig: hasFoldBed
      ? plan.foldConfig || {
          originalEffectiveWidth: 168,
          foldAllowance: 2,
          foldDirection: '对边折入',
          foldedEffectiveWidth: 83,
          maxLayoutWidth: 80,
          widthCheckPassed: true,
        }
      : null,
    plannedLayerCount: nextBeds[0]?.plannedLayerCount || plan.plannedLayerCount,
    netLength: nextBeds.length ? nextBeds.reduce((sum, bed) => sum + getMarkerMatrixBedLengthSummary(bed), 0) : plan.netLength,
    schemeImageStatus: '已过期',
    schemeImage: null,
    detailImage: null,
    confirmationStatus: '待确认',
    confirmedBy: '',
    confirmedAt: '',
    updatedAt: nowText(),
    updatedBy: '计划员-陈静',
  }
}

function getCurrentPlanById(planId: string | undefined, viewModel = getViewModel()): MarkerPlan | MarkerPlanViewRow | null {
  if (planId && viewModel.plansById[planId]) return viewModel.plansById[planId]
  const route = parseRoute()
  if ((route.kind === 'CREATE' || route.kind === 'EDIT') && state.draftPlan) return state.draftPlan
  if (route.kind === 'DETAIL' && viewModel.plansById[route.id]) return viewModel.plansById[route.id]
  return null
}

function getContextForPlan(plan: MarkerPlan | MarkerPlanViewRow | null, viewModel = getViewModel()): MarkerPlanContextCandidate | null {
  if (!plan) return null
  return findMarkerPlanContextForPlan(viewModel.contexts, plan) ?? null
}

function buildGoProductionProgressPath(options: {
  productionOrderId?: string
  productionOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  styleCode?: string
  spuCode?: string
  materialSku?: string
}): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('production-progress'), {
    productionOrderId: options.productionOrderId,
    productionOrderNo: options.productionOrderNo,
    cutOrderId: options.cutOrderId,
    cutOrderNo: options.cutOrderNo,
    markerPlanId: options.markerPlanId,
    markerPlanNo: options.markerPlanNo,
    styleCode: options.styleCode,
    spuCode: options.spuCode,
    materialSku: options.materialSku,
    autoOpenDetail: options.productionOrderNo ? '1' : undefined,
  })
}

function buildMappingDraftForRow(row: MarkerPieceExplosionRow): MarkerPlanMappingDraft {
  return {
    targetSku: row.skuCode || '',
    colorMode: row.overrideColorMode || 'follow-source',
    specifiedColor: row.overrideColors?.[0] || row.colorCode || '',
    partCode: row.partCode || row.partNameCn || '',
    patternCode: row.patternCode || '',
    piecePerGarment: Math.max(safeNumber(row.piecePerGarment), 0),
    note: row.note || '',
  }
}

function getMappingTargetRow(plan: MarkerPlan | null): MarkerPieceExplosionRow | null {
  if (!plan || !state.mappingTargetRowId) return null
  return plan.pieceExplosionRows.find((row) => row.id === state.mappingTargetRowId) || null
}

function downloadCsvFile(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildCurrentListExportRows(viewModel = getViewModel()): { filename: string; rows: string[][] } {
  const tabMeta = getListTabMeta(state.listTab)
  const rows = filterPlans(viewModel.plans, state.listTab)
  return {
    filename: buildExportFilename(tabMeta.label),
    rows: [
      [
        '方案编号',
        '裁片单范围',
        '裁片单号',
        '生产单号',
        '款号 / SPU',
        '面料 / 颜色',
        '技术包',
        '唛架数量',
        '唛架模式',
        '计划裁片数',
        '铺布状态',
        '主状态',
        '最近更新',
      ],
      ...rows.map((row) => [
        row.markerNo,
        getPlanSourceTypeText(row),
        getPlanSourceNoText(row),
        row.productionOrderSummary,
        `${row.styleCode || '-'} / ${row.spuCode || '-'}`,
        `${row.materialSkuSummary} / ${row.colorSummary || '—'}`,
        getPlanTechPackText(row),
        getPlanBedCountText(row),
        getPlanBedModeText(row),
        `${formatCount(row.totalPieces)} 件`,
        getPlanSpreadingStatusText(row),
        row.statusMeta.label,
        row.updatedAt,
      ]),
    ],
  }
}

function navigateToCreateWithContext(context: MarkerPlanContextCandidate, step: MarkerPlanCreateStepKey = 'source'): void {
  const params = new URLSearchParams({
    contextKey: context.contextKey,
    step,
  })
  appStore.navigate(`${CREATE_PATH}?${params.toString()}`)
}

function navigateToCreateWithContexts(contexts: MarkerPlanContextCandidate[], step: MarkerPlanCreateStepKey = 'source'): void {
  if (contexts.length === 1) {
    navigateToCreateWithContext(contexts[0], step)
    return
  }
  const params = new URLSearchParams()
  contexts.forEach((context) => params.append('contextKey', context.contextKey))
  params.set('step', step)
  appStore.navigate(`${CREATE_PATH}?${params.toString()}`)
}

function buildDetailPathWithTab(id: string, tab?: MarkerPlanTabKey): string {
  return buildRouteWithQuery(buildDetailPath(id), {
    tab,
  })
}

function buildEditPathWithTab(id: string, tab?: MarkerPlanTabKey): string {
  return buildRouteWithQuery(buildEditPath(id), {
    tab,
  })
}

function hydrateDraft(nextPlan: MarkerPlan, context: MarkerPlanContextCandidate | null): MarkerPlan {
  if (!context) return nextPlan
  return hydrateMarkerPlan(
    {
      ...nextPlan,
      lastVisitedTab: state.activeTab,
      updatedAt: nowText(),
      updatedBy: '计划员-陈静',
    },
    context,
  )
}

function applyMarkerMode(plan: MarkerPlan, context: MarkerPlanContextCandidate, markerMode: MarkerPlanModeKey): MarkerPlan {
  void context
  const nextPlan: MarkerPlan = {
    ...plan,
    markerMode,
    foldConfig:
      markerMode === 'fold_normal' || markerMode === 'fold_high_low'
        ? plan.foldConfig || {
            originalEffectiveWidth: 168,
            foldAllowance: 2,
            foldDirection: '对边折入',
            foldedEffectiveWidth: 83,
            maxLayoutWidth: 80,
            widthCheckPassed: true,
          }
        : null,
  }
  return hydrateDraft(nextPlan, context)
}

function syncStateFromRoute(viewModel = getViewModel()): void {
  const pathname = getCurrentPathname()
  if (state.querySignature === pathname) return
  state.querySignature = pathname
  clearFeedback()

  const route = parseRoute()
  const params = getCurrentSearchParams()
  const requestedTab = (params.get('tab') as MarkerPlanTabKey | null) || ''
  const resolvedTab = ['basic', 'explosion', 'layout'].includes(requestedTab)
    ? (requestedTab as MarkerPlanTabKey)
    : null
  const requestedCreateStep = parseCreateStepParam(params.get('step'))

  if (route.kind === 'LIST') {
    state.draftPlan = null
    state.activeTab = 'basic'
    state.activeCreateStep = 'source'
    state.contextDrawerOpen = false
    state.contextPage = 1
    state.selectedContextKeys = []
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
    return
  }

  if (route.kind === 'CREATE') {
    const selectedCutOrderIds = readCreateCutOrderIdsFromParams(params)
    const existingDraft = findExistingUnconfirmedDraftForSelection(selectedCutOrderIds)
    if (existingDraft) {
      const context = findMarkerPlanContextForPlan(viewModel.contexts, existingDraft)
      state.draftPlan = context ? hydrateMarkerPlan(existingDraft, context) : existingDraft
      state.activeTab = resolvedTab || existingDraft.lastVisitedTab || 'basic'
      state.activeCreateStep = requestedCreateStep || getCreateStepFromActiveTab(state.activeTab)
      state.contextDrawerOpen = false
      state.contextPage = 1
      state.selectedContextKeys = buildContextKeysFromCutOrderIds(existingDraft.cutOrderIds)
      state.mappingDrawerOpen = false
      state.mappingTargetRowId = ''
      state.referencedStructureEditConfirmed = false
      setFeedback('warning', '同一组裁片单已有未确认草稿，请继续编辑已有草稿或取消后重新创建。')
      return
    }
    if (selectedCutOrderIds.length) {
      const sourceRowsResult = buildSelectedSourceRowsFromSelectedCutOrders(selectedCutOrderIds)
      const contextMap = getContextMap(viewModel)
      const contexts = buildContextKeysFromCutOrderIds(selectedCutOrderIds)
        .map((contextKey) => contextMap[contextKey] || null)
        .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
      const combinationValidation = sourceRowsResult.ok
        ? validateSourceCutOrderCombination(sourceRowsResult.rows)
        : { ok: false, message: sourceRowsResult.message }
      const baseValidation = sourceRowsResult.ok
        ? validateMarkerPlanSourceSelection(contexts)
        : { ok: false, message: sourceRowsResult.message }
      const schemeValidation = baseValidation.ok && combinationValidation.ok ? combinationValidation : (baseValidation.ok ? combinationValidation : baseValidation)
      const combinedContext = schemeValidation.ok ? buildCombinedMarkerPlanContextCandidate(contexts) : null
      const draftPlan = combinedContext ? createMarkerPlanFromContext({ context: combinedContext, existingPlans: viewModel.plans }) : null
      state.draftPlan = draftPlan
        ? {
            ...draftPlan,
            selectedSourceCutOrderRows: sourceRowsResult.rows,
          }
        : null
      state.activeTab = resolvedTab || 'basic'
      state.activeCreateStep = requestedCreateStep || getCreateStepFromActiveTab(state.activeTab)
      state.contextDrawerOpen = false
      state.contextPage = 1
      state.selectedContextKeys = contexts.map((context) => context.contextKey)
      state.mappingDrawerOpen = false
      state.mappingTargetRowId = ''
      state.referencedStructureEditConfirmed = false
      if (!schemeValidation.ok) setFeedback('warning', schemeValidation.message)
      return
    }
    state.draftPlan = null
    state.activeTab = 'basic'
    state.activeCreateStep = requestedCreateStep || 'source'
    state.contextDrawerOpen = false
    state.contextPage = 1
    state.selectedContextKeys = []
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
    setFeedback('warning', '请先选择裁片单。')
    return
  }

  if (route.kind === 'EDIT') {
    const sourcePlan = viewModel.plansById[route.id] ?? null
    state.draftPlan = sourcePlan ? hydrateMarkerPlan(sourcePlan, getDraftContext(viewModel) || findMarkerPlanContextForPlan(viewModel.contexts, sourcePlan)!) : null
    state.activeTab = sourcePlan ? resolvedTab || getMarkerPlanInitialEditTab(sourcePlan) : 'basic'
    state.activeCreateStep = requestedCreateStep || getCreateStepFromActiveTab(state.activeTab)
    state.contextDrawerOpen = false
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
    return
  }

  if (route.kind === 'DETAIL') {
    const sourcePlan = viewModel.plansById[route.id] ?? null
    state.draftPlan = null
    state.activeTab = resolvedTab || sourcePlan?.lastVisitedTab || 'basic'
    state.activeCreateStep = getCreateStepFromActiveTab(state.activeTab)
    state.contextDrawerOpen = false
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
  }
}

function updateDraft(mutator: (plan: MarkerPlan, context: MarkerPlanContextCandidate) => MarkerPlan): boolean {
  const viewModel = getViewModel()
  const context = getDraftContext(viewModel)
  if (!state.draftPlan || !context) return false
  state.draftPlan = hydrateDraft(mutator(state.draftPlan, context), context)
  return true
}

function renderActionButton(
  label: string,
  attrs: string,
  variant: 'primary' | 'secondary' | 'ghost' = 'secondary',
  disabled = false,
): string {
  const className =
    variant === 'primary'
      ? 'rounded-md bg-blue-600 px-3 py-3 text-sm font-medium leading-5 text-white hover:bg-blue-700'
      : variant === 'ghost'
        ? 'rounded-md px-3 py-3 text-sm leading-5 text-muted-foreground hover:bg-muted'
        : 'rounded-md border px-3 py-3 text-sm leading-5 hover:bg-muted'

  return `
    <button
      type="button"
      ${attrs}
      ${disabled ? 'disabled' : ''}
      class="${className} ${disabled ? 'cursor-not-allowed opacity-50' : ''}"
    >
      ${escapeHtml(label)}
    </button>
  `
}

function renderStatusBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function getSpreadingOrdersForMarkerPlan(markerPlanId: string): SpreadingOrder[] {
  if (!markerPlanId) return []
  return buildMarkerSpreadingProjection().spreadingOrdersByMarkerPlanId[markerPlanId] || []
}

function renderFormulaText(formula: string): string {
  if (!formula) return ''
  return `<div class="mt-px font-mono text-[9px] leading-3 text-muted-foreground">${escapeHtml(formula)}</div>`
}

function renderValueWithFormula(value: string, formula = '', valueClass = 'text-sm font-medium'): string {
  return `
    <div class="${valueClass}">${escapeHtml(value || '—')}</div>
    ${renderFormulaText(formula)}
  `
}

function renderCompactListValueWithFormula(value: string, formula = ''): string {
  return `
    <div class="text-[11px] font-medium leading-3 text-foreground">${escapeHtml(value || '—')}</div>
    ${formula ? `<div class="mt-0.5 font-mono text-[8px] leading-2.5 text-muted-foreground">${escapeHtml(formula)}</div>` : ''}
  `
}

function renderReadonlyField(label: string, value: string, formula = ''): string {
  return `
    <div class="rounded-lg border bg-background px-2.5 py-1.5" data-marker-plan-control-type="readonly">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-0.5">${renderValueWithFormula(value, formula)}</div>
    </div>
  `
}

function renderInputField(label: string, value: string, field: MarkerPlanBasicField, type: 'text' | 'number' = 'text'): string {
  return `
    <label class="space-y-1" data-marker-plan-control-type="${type === 'number' ? 'number-input' : 'text-input'}">
      <span class="text-xs font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="${type}"
        value="${escapeHtml(value)}"
        data-marker-plan-basic-field="${field}"
        class="h-8 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  `
}

function renderTextareaField(label: string, value: string, field: MarkerPlanBasicField): string {
  return `
    <label class="space-y-1" data-marker-plan-control-type="textarea">
      <span class="text-xs font-medium text-foreground">${escapeHtml(label)}</span>
      <textarea
        rows="2"
        data-marker-plan-textarea-field="${field}"
        class="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      >${escapeHtml(value)}</textarea>
    </label>
  `
}

function renderSelectField(
  label: string,
  field: string,
  options: Array<{ value: string; label: string }>,
  value: string,
  dataAttr = 'data-marker-plan-basic-field',
): string {
  return `
    <label class="space-y-1" data-marker-plan-control-type="select">
      <span class="text-xs font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        ${dataAttr}="${field}"
        class="h-8 w-full rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderPlanHeaderActions(route: MarkerPlanRouteKind, plan: MarkerPlan | MarkerPlanViewRow | null): string {
  const canGoSpreading = Boolean(plan && plan.readyForSpreading && plan.status !== 'CANCELED' && plan.executionRoute === 'OWN_CUTTING')
  if (route === 'LIST') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('新建唛架方案', 'data-marker-plan-action="go-create"', 'primary')}
      </div>
    `
  }

  if (route === 'CREATE') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('返回唛架方案', 'data-marker-plan-action="go-list"')}
        ${renderActionButton('删除草稿', 'data-marker-plan-action="delete-draft"', 'secondary', !plan)}
      </div>
    `
  }

  if (route === 'EDIT') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('返回详情', `data-marker-plan-action="go-detail"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
        ${renderActionButton('保存草稿', 'data-marker-plan-action="save-draft"', 'secondary', !plan)}
        ${renderActionButton('确认唛架方案', 'data-marker-plan-action="complete-plan"', 'primary', !plan)}
        ${renderActionButton('保存并留在当前页', 'data-marker-plan-action="save-plan"', 'secondary', !plan)}
        ${renderActionButton(plan?.confirmationStatus === '已确认' ? '作废方案' : '删除草稿', `data-marker-plan-action="${plan?.confirmationStatus === '已确认' ? 'cancel-plan' : 'delete-draft'}"`, 'secondary', !plan)}
        ${renderActionButton('交给铺布', `data-marker-plan-action="go-spreading"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'primary', !canGoSpreading)}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      ${renderActionButton('返回列表', 'data-marker-plan-action="go-list"')}
      ${renderActionButton('交给铺布', `data-marker-plan-action="go-spreading"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'primary', !canGoSpreading)}
      ${renderActionButton('去裁片单', `data-marker-plan-action="go-cut-orders"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan || !plan.cutOrderIds.length)}
      ${plan?.markerPlanId ? renderActionButton('去唛架方案', `data-marker-plan-action="go-marker-plan" data-plan-id="${escapeHtml(plan.id)}"`, 'secondary') : ''}
      ${renderActionButton('去生产单总览', `data-marker-plan-action="go-production-progress"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
    </div>
  `
}

function buildGoCutOrdersPath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), {
    cutOrderId: plan.cutOrderIds[0],
    cutOrderNo: plan.cutOrderNos[0],
    productionOrderId: plan.productionOrderIds[0],
    productionOrderNo: plan.productionOrderNos[0],
    markerPlanId: plan.markerPlanId || undefined,
    markerPlanNo: plan.markerPlanNo || undefined,
    styleCode: plan.styleCode || undefined,
    spuCode: plan.spuCode || undefined,
    materialSku: plan.sourceMaterialSku || undefined,
  })
}

function buildGoCutOrdersPathFromContext(context: MarkerPlanContextCandidate): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), {
    cutOrderId: context.cutOrderIds[0],
    cutOrderNo: context.cutOrderNos[0],
    productionOrderId: context.productionOrderIds[0],
    productionOrderNo: context.productionOrderNos[0],
    markerPlanId: context.markerPlanId || undefined,
    markerPlanNo: context.markerPlanNo || undefined,
    styleCode: context.styleCode || undefined,
    spuCode: context.spuCode || undefined,
    materialSku: context.materialSkuSummary.split(' / ')[0] || undefined,
  })
}

function buildGoMaterialPrepPath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('warehouse-management-wait-process'), {
    cutOrderId: plan.cutOrderIds[0],
    cutOrderNo: plan.cutOrderNos[0],
    productionOrderId: plan.productionOrderIds[0],
    productionOrderNo: plan.productionOrderNos[0],
    styleCode: plan.styleCode || undefined,
    spuCode: plan.spuCode || undefined,
    materialSku: plan.sourceMaterialSku || undefined,
  })
}

function buildGoMarkerPlanSourcePath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('marker-list'), {
    focusBatchId: plan.markerPlanId || undefined,
  })
}

function buildGoMarkerPlanSourcePathFromContext(context: MarkerPlanContextCandidate): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('marker-list'), {
    focusBatchId: context.markerPlanId || undefined,
  })
}

function resolveCurrentPlan(viewModel = getViewModel(), planId = ''): MarkerPlan | MarkerPlanViewRow | null {
  if (planId && viewModel.plansById[planId]) return viewModel.plansById[planId]
  if ((parseRoute().kind === 'CREATE' || parseRoute().kind === 'EDIT') && state.draftPlan) return state.draftPlan
  if (parseRoute().kind === 'DETAIL' && viewModel.plansById[parseRoute().id]) return viewModel.plansById[parseRoute().id]
  return null
}

function validateDraftForCompletion(): { ok: true } | { ok: false; tab: MarkerPlanTabKey; message: string } {
  const plan = state.draftPlan
  if (!plan) {
    return { ok: false, tab: 'basic', message: '请先选择裁片单，再确认唛架方案。' }
  }
  if (plan.totalPieces <= 0) {
    return { ok: false, tab: 'basic', message: '请先补齐尺码成衣件数（件），确保方案成衣件数（件）大于 0。' }
  }
  if (plan.mappingStatus !== 'passed') {
    return { ok: false, tab: 'explosion', message: '裁片拆解仍有映射异常，请先修正映射。' }
  }
  const beds = buildMarkerSchemeFromPlan(plan).beds
  if (!beds.length) {
    return { ok: false, tab: 'layout', message: '请至少新增 1 个唛架编号。' }
  }
  if (beds.some((bed) => (isHighLowMatrixMode(bed.bedMode) ? createMarkerMatrixRows(plan, bed).some((row) => getMarkerMatrixRowActiveLayer(bed.bedMode, row, getMarkerMatrixSizeColumns(plan)) > 0 && row.markerLength <= 0) : bed.markerLength <= 0))) {
    return { ok: false, tab: 'layout', message: '请补齐每个唛架编号的唛架净长度。' }
  }
  const matrixError = beds
    .map((bed) => validateMarkerMatrixRows(bed.bedMode, createMarkerMatrixRows(plan, bed), getMarkerMatrixSizeColumns(plan), normalizeMarkerSizePiecePerLayer(bed, getMarkerMatrixSizeColumns(plan)))[0])
    .find(Boolean)
  if (matrixError) {
    return { ok: false, tab: 'layout', message: matrixError }
  }
  if (beds.some((bed) => bed.plannedGarmentQty <= 0 || bed.plannedLayerCount <= 0)) {
    return { ok: false, tab: 'layout', message: '请补齐每个唛架编号的层数矩阵。' }
  }
  if (plan.layoutStatus !== 'done') {
    return { ok: false, tab: 'layout', message: '唛架编辑器尚未完成，请先补齐唛架矩阵。' }
  }
  if (plan.confirmationStatus !== '已确认') {
    return { ok: false, tab: 'explosion', message: '请先在需求匹配与确认中确认当前唛架方案。' }
  }
  return { ok: true }
}

function getProblemTabForPlan(row: MarkerPlanViewRow): MarkerPlanTabKey {
  if (row.mappingStatus === 'issue') return 'explosion'
  if (row.layoutStatus !== 'done') return 'layout'
  if (row.confirmationStatus !== '已确认') return 'explosion'
  return 'basic'
}

function hasPlanExceptionIssue(row: MarkerPlanViewRow): boolean {
  return (
    row.mappingStatus === 'issue' ||
    row.layoutStatus !== 'done' ||
    row.confirmationStatus === '需调整'
  )
}

function renderTopInfoChip(label: string, attrs: string, tone: 'blue' | 'amber' | 'emerald' = 'blue'): string {
  return renderWorkbenchFilterChip(label, attrs, tone)
}

function renderTopInfoValue(label: string, value: string, formula = ''): string {
  return `
    <article class="rounded-lg border bg-background px-3 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1">${renderValueWithFormula(value, formula)}</div>
    </article>
  `
}

function renderTopInfoStatus(label: string, badgeHtml: string): string {
  return `
    <article class="rounded-lg border bg-background px-3 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2">${badgeHtml}</div>
    </article>
  `
}

function renderPlanTopInfo(
  plan: MarkerPlan | MarkerPlanViewRow,
  context: MarkerPlanContextCandidate | null,
  options: { showActionRow?: boolean } = {},
): string {
  const { showActionRow = true } = options
  const totalPiecesFormula = 'totalPiecesFormula' in plan ? plan.totalPiecesFormula : buildMarkerTotalPiecesFormula(plan.sizeRatioRows)
  const systemUnitUsageFormula =
    'systemUnitUsageFormula' in plan
      ? plan.systemUnitUsageFormula
      : buildMarkerPlanSystemUnitUsageFormula(plan)
  const finalUnitUsageFormula =
    'finalUnitUsageFormula' in plan
      ? plan.finalUnitUsageFormula
      : buildMarkerFinalUnitUsageFormula(plan.systemUnitUsage, plan.manualUnitUsage)
  const plannedSpreadLengthFormula =
    'plannedSpreadLengthFormula' in plan
      ? plan.plannedSpreadLengthFormula
      : buildMarkerPlannedSpreadLengthFormula(plan)
  const bindingStripReservedLength = Number(plan.bindingStripReservedLength || 0)
  const bindingStripReservedLengthFormula = plan.bindingStripReservedLengthFormula || `${formatNumber(bindingStripReservedLength, 2)} m`
  const materialTotalUsageLength = Number(plan.materialTotalUsageLength || (plan.plannedSpreadLength + bindingStripReservedLength))
  const materialTotalUsageLengthFormula =
    plan.materialTotalUsageLengthFormula ||
    `${formatNumber(materialTotalUsageLength, 2)} m = 普通铺布 ${formatNumber(plan.plannedSpreadLength, 2)} m + 捆条加工 ${formatNumber(bindingStripReservedLength, 2)} m`
  const demandMatchSummary = getPlanDemandMatchSummary(plan)
  const demandMatchMeta = getDemandMatchStatusMeta(demandMatchSummary.status)
  const confirmationMeta = getConfirmationStatusMeta(plan.confirmationStatus)
  const productionSummary = plan.productionOrderNos.join(' / ') || '—'
  const cutOrderChips = plan.cutOrderNos.length
    ? plan.cutOrderNos
        .map((cutOrderNo, index) =>
          renderTopInfoChip(
            cutOrderNo,
            `data-marker-plan-action="go-cut-orders" data-cut-order-id="${escapeHtml(plan.cutOrderIds[index] || '')}" data-cut-order-no="${escapeHtml(cutOrderNo)}" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || plan.productionOrderIds[0] || '')}" data-production-order-no="${escapeHtml(plan.productionOrderNos[index] || plan.productionOrderNos[0] || '')}"`,
          ),
        )
        .join('')
    : '<span class="text-xs text-muted-foreground">—</span>'
  const mergeChip = plan.markerPlanNo
    ? renderTopInfoChip(
        plan.markerPlanNo,
        `data-marker-plan-action="go-marker-plan" data-marker-plan-id="${escapeHtml(plan.markerPlanId)}" data-marker-plan-no="${escapeHtml(plan.markerPlanNo)}"`,
        'amber',
      )
    : '<span class="text-xs text-muted-foreground">—</span>'
  const productionChips = plan.productionOrderNos.length
    ? plan.productionOrderNos
        .map((productionOrderNo, index) =>
          renderTopInfoChip(
            productionOrderNo,
            `data-marker-plan-action="go-production-progress" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || '')}" data-production-order-no="${escapeHtml(productionOrderNo)}" data-style-code="${escapeHtml(plan.styleCode || '')}" data-spu-code="${escapeHtml(plan.spuCode || '')}" data-material-sku="${escapeHtml(plan.sourceMaterialSku || '')}" data-cut-order-id="${escapeHtml(plan.cutOrderIds[index] || '')}" data-cut-order-no="${escapeHtml(plan.cutOrderNos[index] || '')}" data-marker-plan-id="${escapeHtml(plan.markerPlanId || '')}" data-marker-plan-no="${escapeHtml(plan.markerPlanNo || '')}"`,
            'emerald',
          ),
        )
        .join('')
    : '<span class="text-xs text-muted-foreground">—</span>'
  const summaryItems = [
    { label: '唛架数量', value: `${buildMarkerSchemeFromPlan(plan).bedCount} 个` },
    { label: '唛架模式组成', value: buildMarkerSchemeFromPlan(plan).modeSummaryText },
    { label: '唛架净长度（m）', value: `${formatNumber(plan.netLength, 2)} m` },
    { label: '方案成衣件数（件）', value: `${formatCount(plan.totalPieces)} 件`, formula: totalPiecesFormula },
    { label: '系统单件成衣用量（m/件）', value: `${formatNumber(plan.systemUnitUsage, 3)} m/件`, formula: systemUnitUsageFormula },
    { label: '最终单件成衣用量（m/件）', value: `${formatNumber(plan.finalUnitUsage, 3)} m/件`, formula: finalUnitUsageFormula },
    { label: '计划铺布总长度（m）', value: `${formatNumber(plan.plannedSpreadLength, 2)} m`, formula: plannedSpreadLengthFormula },
    { label: '捆条加工长度（m）', value: `${formatNumber(bindingStripReservedLength, 2)} m`, formula: bindingStripReservedLengthFormula },
    { label: '物料总用量（m）', value: `${formatNumber(materialTotalUsageLength, 2)} m`, formula: materialTotalUsageLengthFormula },
  ]
  const statusItems = [
    ['需求匹配', renderStatusBadge(demandMatchMeta.label, demandMatchMeta.className)],
    ['业务确认', renderStatusBadge(confirmationMeta.label, confirmationMeta.className)],
    ['主状态', renderStatusBadge(markerPlanStatusMeta[plan.status].label, markerPlanStatusMeta[plan.status].className)],
    ['映射状态', renderStatusBadge(markerMappingStatusMeta[plan.mappingStatus].label, markerMappingStatusMeta[plan.mappingStatus].className)],
    ['唛架状态', renderStatusBadge(markerLayoutStatusMeta[plan.layoutStatus].label, markerLayoutStatusMeta[plan.layoutStatus].className)],
    ['可交接铺布', plan.readyForSpreading ? renderStatusBadge('是', 'bg-emerald-100 text-emerald-700 border-emerald-200') : renderStatusBadge('否', 'bg-slate-100 text-slate-700 border-slate-200')],
  ] as const

  return `
    <section data-marker-plan-top-shell class="rounded-xl border bg-card p-4 shadow-sm">
      <div class="pointer-events-none space-y-4" data-testid="marker-plan-top-info">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <div class="text-[11px] text-muted-foreground">方案编号</div>
              <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(plan.markerNo)}</div>
            </div>
            <div>
              <div class="text-[11px] text-muted-foreground">裁片单范围</div>
              <div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(plan.cutOrderNos.length > 1 ? '组合裁片单' : '裁片单')}</div>
            </div>
            <div>
              <div class="text-[11px] text-muted-foreground">款号 / SPU</div>
              <div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(`${plan.styleCode || '-'} / ${plan.spuCode || '-'}`)}</div>
            </div>
            <div>
              <div class="text-[11px] text-muted-foreground">面料 / 颜色</div>
              <div class="mt-1">${renderMaterialIdentityBlock({
                materialSku: plan.materialSkuSummary || '—',
                materialLabel: plan.materialSkuSummary || '—',
                materialAlias: plan.materialAliasSummary || context?.materialAliasSummary || '',
                materialImageUrl: plan.materialImageUrl || context?.materialImageUrl || '',
              }, { compact: true })}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(plan.colorSummary || '—')}</div>
            </div>
          </div>
          <div class="pointer-events-auto flex flex-wrap gap-2">
            ${statusItems.map(([label, badgeHtml]) => `<div class="flex items-center gap-2 rounded-md border bg-background px-3 py-3"><span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>${badgeHtml}</div>`).join('')}
          </div>
        </div>
          <div class="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <div class="space-y-3">
            <div class="rounded-md border bg-background px-3 py-3">
              <div class="text-[11px] text-muted-foreground">裁片单号</div>
              <div class="pointer-events-auto mt-0.5 flex flex-wrap gap-1.5">${cutOrderChips}</div>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-md border bg-background px-3 py-3">
                <div class="text-[11px] text-muted-foreground">唛架方案号</div>
                <div class="pointer-events-auto mt-0.5 flex flex-wrap gap-1.5">${mergeChip}</div>
              </div>
              <div class="rounded-md border bg-background px-3 py-3">
                <div class="text-[11px] text-muted-foreground">来源生产单号</div>
                <div class="pointer-events-auto mt-0.5 flex flex-wrap gap-1.5">${productionChips}</div>
              </div>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            ${summaryItems
              .map(
                (item) => `
                  <div class="rounded-md border bg-background px-3 py-3">
                    <div class="text-[11px] text-muted-foreground">${escapeHtml(item.label)}</div>
                    <div class="mt-0.5">${renderValueWithFormula(item.value, item.formula || '', 'text-sm font-medium text-foreground')}</div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
        ${
          showActionRow
            ? `
              <div class="pointer-events-auto flex flex-wrap items-center gap-2 border-t pt-3">
                ${renderActionButton('去裁片单', `data-marker-plan-action="go-cut-orders"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`)}
                ${renderActionButton('去待加工仓', `data-marker-plan-action="go-material-prep"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`)}
                ${plan.markerPlanId ? renderActionButton('去唛架方案', `data-marker-plan-action="go-marker-plan"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`) : ''}
                ${renderActionButton('去生产单总览', `data-marker-plan-action="go-production-progress"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`)}
              </div>
            `
            : ''
        }
        <div class="text-[11px] text-muted-foreground">最近更新：${escapeHtml(plan.updatedAt || plan.createdAt || '—')}</div>
      </div>
    </section>
  `
}

function renderTabNav(activeTab: MarkerPlanTabKey): string {
  const normalizedActiveTab = activeTab
  const tabs: Array<{ key: MarkerPlanTabKey; label: string }> = [
    { key: 'basic', label: '来源裁片单' },
    { key: 'layout', label: '编辑唛架' },
    { key: 'explosion', label: '需求匹配与确认' },
  ]

  return `
    <section data-marker-plan-tab-shell class="rounded-lg border bg-card/95 p-2 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) =>
            `
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-md px-3 py-3 text-sm font-medium ${
                  normalizedActiveTab === tab.key
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border hover:bg-muted'
                }"
                data-marker-plan-tab-trigger="${tab.key}"
                data-marker-plan-action="switch-tab"
                data-tab-key="${tab.key}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderMarkerPlanTabLabel(tab: MarkerPlanTabKey): string {
  const labels: Record<MarkerPlanTabKey, string> = {
    basic: '来源裁片单',
      explosion: '需求匹配与确认',
    layout: '编辑唛架',
  }
  return labels[tab] || '来源裁片单'
}

function parseCreateStepParam(value: string | null): MarkerPlanCreateStepKey | null {
  if (!value) return null
  return ['source', 'combination', 'layout', 'match'].includes(value)
    ? (value as MarkerPlanCreateStepKey)
    : null
}

function getCreateStepFromActiveTab(activeTab: MarkerPlanTabKey): MarkerPlanCreateStepKey {
  if (activeTab === 'layout') return 'layout'
  if (activeTab === 'explosion') return 'match'
  return 'source'
}

function getCreateStepTargetTab(step: MarkerPlanCreateStepKey): MarkerPlanTabKey {
  if (step === 'layout') return 'layout'
  if (step === 'match') return 'explosion'
  return 'basic'
}

function renderCreateStepNav(plan: MarkerPlan | null): string {
  const activeStep = state.contextDrawerOpen ? 'source' : state.activeCreateStep
  const steps: Array<{
    key: MarkerPlanCreateStepKey
    title: string
    hint: string
  }> = [
    { key: 'source', title: '选择裁片单', hint: '裁片单 / 可用库存' },
    { key: 'combination', title: '确认组合规则', hint: 'SPU / 纸样 / 幅宽' },
    { key: 'layout', title: '维护唛架编号', hint: '库存 / 床次 / 数量' },
    { key: 'match', title: '确认并保存', hint: '需求匹配 / 保存 / 确认' },
  ]
  const activeIndex = Math.max(steps.findIndex((step) => step.key === activeStep), 0)

  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-create-step-nav">
      <div class="grid gap-2 md:grid-cols-4">
        ${steps
          .map((step, index) => {
            const active = activeStep === step.key
            const completed = Boolean(plan) && index < activeIndex
            const disabled = step.key !== 'source' && !plan
            return `
              <button
                type="button"
                class="rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : completed
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:border-emerald-300'
                      : disabled
                        ? 'cursor-not-allowed bg-muted/40 text-muted-foreground'
                        : 'bg-background hover:border-blue-300 hover:bg-blue-50/40'
                }"
                data-marker-plan-action="switch-create-step"
                data-create-step="${step.key}"
                aria-current="${active ? 'step' : 'false'}"
                ${disabled ? 'disabled' : ''}
              >
                <div class="flex items-start gap-2">
                  <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${active ? 'border-blue-500 bg-blue-600 text-white' : completed ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'bg-white'}">${index + 1}</span>
                  <span class="min-w-0">
                    <span class="block text-xs font-semibold">${escapeHtml(step.title)}</span>
                    <span class="mt-1 block text-[11px] text-muted-foreground">${escapeHtml(step.hint)}</span>
                  </span>
                </div>
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function getContextDisplayColors(context: MarkerPlanContextCandidate): string {
  const sourceValues = [
    context.colorSummary,
    ...context.sourceCutOrderRows.flatMap((row) => [row.materialColor, row.color]),
  ]
  const normalized = splitDisplayText(sourceValues.join(' / '))
    .filter((value) => !isMissingPrototypeText(value))
  if (normalized.length) return Array.from(new Set(normalized)).join(' / ')

  const skuText = `${context.materialSkuSummary} ${context.styleName}`.toLowerCase()
  if (skuText.includes('black')) return 'Black'
  if (skuText.includes('charcoal') || skuText.includes('grey') || skuText.includes('gray')) return 'Grey'
  if (skuText.includes('navy')) return 'Navy'
  if (skuText.includes('khaki')) return 'Khaki'
  if (skuText.includes('beige')) return 'Beige'
  if (skuText.includes('cream')) return 'Cream'
  if (skuText.includes('white')) return 'White'
  if (skuText.includes('green')) return 'Green'
  return '主色'
}

function getContextDisplayMaterialAlias(context: MarkerPlanContextCandidate): string {
  const cleaned = normalizeMaterialAliasText(context.materialAliasSummary)
  if (cleaned) return cleaned
  const skuText = `${context.materialSkuSummary} ${context.styleName}`.toLowerCase()
  if (skuText.includes('毛织') || skuText.includes('wool') || skuText.includes('rajut') || skuText.includes('sweater')) return '毛织用纱线'
  if (skuText.includes('lining') || skuText.includes('里布')) return '里布'
  if (skuText.includes('twill')) return '弹力斜纹主面料'
  if (skuText.includes('canvas')) return '帆布主面料'
  return '主面料'
}

function getContextMaterialImageUrl(context: MarkerPlanContextCandidate, colorText: string): string {
  const imageUrl = String(context.materialImageUrl || '').trim()
  if (imageUrl && !imageUrl.includes('placeholder') && !imageUrl.startsWith('data:image/svg')) return imageUrl
  return buildFabricSwatchDataUrl(colorText || context.materialSkuSummary)
}

function renderCreateContextPagination(total: number, currentPage: number, pageSize: number, from: number, to: number): string {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const prevDisabled = currentPage <= 1
  const nextDisabled = currentPage >= totalPages
  const rangeText = total > 0 ? `，当前 ${from}-${to}` : ''
  return `
    <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
      <p class="text-xs text-muted-foreground">共 ${total} 个裁片单${rangeText}</p>
      <div class="flex flex-wrap items-center gap-2">
        <select class="h-8 rounded-md border bg-background px-2 text-xs" data-marker-plan-context-field="contextPageSize">
          ${CREATE_CONTEXT_PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
        </select>
        <button
          type="button"
          class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${prevDisabled ? 'cursor-not-allowed opacity-60' : ''}"
          data-marker-plan-action="prev-context-page"
          ${prevDisabled ? 'disabled' : ''}
        >
          上一页
        </button>
        <span class="text-xs text-muted-foreground">${currentPage} / ${totalPages}</span>
        <button
          type="button"
          class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${nextDisabled ? 'cursor-not-allowed opacity-60' : ''}"
          data-marker-plan-action="next-context-page"
          ${nextDisabled ? 'disabled' : ''}
        >
          下一页
        </button>
      </div>
    </footer>
  `
}

function renderCreateCutOrderSelectionStep(viewModel = getViewModel()): string {
  const contexts = filterMarkerSourceContextsByKeyword(getMarkerPlanCutOrderContexts(viewModel))
  const selectedContexts = getSelectedDrawerContexts(viewModel)
  const selectedKeys = new Set(state.selectedContextKeys)
  const selectedSpuCodes = getContextSpuCodes(selectedContexts)
  const validation = validateMarkerPlanSourceSelection(selectedContexts)
  const pageSize = CREATE_CONTEXT_PAGE_SIZE_OPTIONS.includes(state.contextPageSize as (typeof CREATE_CONTEXT_PAGE_SIZE_OPTIONS)[number])
    ? state.contextPageSize
    : 5
  const totalPages = Math.max(1, Math.ceil(contexts.length / pageSize))
  const currentPage = Math.min(Math.max(state.contextPage, 1), totalPages)
  state.contextPage = currentPage
  state.contextPageSize = pageSize
  const startIndex = (currentPage - 1) * pageSize
  const pageContexts = contexts.slice(startIndex, startIndex + pageSize)
  const pageFrom = contexts.length ? startIndex + 1 : 0
  const pageTo = contexts.length ? Math.min(startIndex + pageContexts.length, contexts.length) : 0
  const selectedSummary = selectedContexts.length
    ? `已选 ${selectedContexts.length} 个裁片单${selectedSpuCodes.length === 1 ? `，SPU：${selectedSpuCodes[0]}` : ''}`
    : '未选择'
  const message = selectedContexts.length
    ? validation.ok
      ? new Set(selectedContexts.flatMap((context) => context.cuttingTaskIds || [])).size > 1
        ? '选择有效。当前为跨裁片任务方案，确认后这些裁片任务必须分配给同一个裁剪承接工厂。'
        : '选择有效，可进入下一步确认组合规则。'
      : validation.message
    : '第一步先选择要进入唛架方案的裁片单。'

  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-create-cut-order-selection">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">选择裁片单</h3>
          <p class="mt-1 text-xs text-muted-foreground">展示当前所有裁片单，后续步骤会继续校验 SPU、纸样、版本、幅宽和历史组合组。</p>
        </div>
        ${renderStatusBadge(selectedSummary, validation.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label class="block rounded-lg border bg-background px-3 py-2 text-sm">
          <span class="text-xs text-muted-foreground">搜索裁片单 / 生产单 / SPU / 面料</span>
          <input
            class="mt-1 w-full bg-transparent text-sm outline-none"
            type="search"
            value="${escapeHtml(state.contextKeyword)}"
            placeholder="输入关键词筛选"
            data-marker-plan-context-field="contextKeyword"
          />
        </label>
        <div class="flex flex-wrap items-center justify-end gap-2">
          ${renderActionButton('清空选择', 'data-marker-plan-action="clear-selected-contexts"', 'secondary', !selectedContexts.length)}
          ${renderActionButton('下一步', 'data-marker-plan-action="confirm-context-create"', 'primary', !validation.ok)}
        </div>
      </div>

      <div class="mt-3 rounded-lg border ${validation.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'} px-3 py-2 text-xs">
        ${escapeHtml(message)}
      </div>

      <div class="mt-4 overflow-hidden rounded-lg border">
        ${renderStickyTableScroller(`
          <table class="w-full table-fixed text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="w-[11rem] px-3 py-2 font-medium">裁片单</th>
                <th class="w-[12rem] px-3 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / SPU</th>
                <th class="w-[17rem] px-3 py-2 font-medium">物料 / 纸样</th>
                <th class="w-[7rem] px-3 py-2 font-medium">可用余额</th>
                <th class="w-[9rem] px-3 py-2 font-medium">执行去向</th>
                <th class="w-[10rem] px-3 py-2 font-medium">承接方</th>
                <th class="w-[8rem] px-3 py-2 font-medium">备料 / 优先级</th>
              </tr>
            </thead>
            <tbody>
              ${pageContexts.length
                ? pageContexts.map((context) => {
            const selected = selectedKeys.has(context.contextKey)
            const firstRow = context.sourceCutOrderRows[0]
            const displayColors = getContextDisplayColors(context)
            const displayAlias = getContextDisplayMaterialAlias(context)
            const materialImageUrl = getContextMaterialImageUrl(context, displayColors)
            const availableText = firstRow
              ? `${formatNumber(firstRow.availableQty, 2)} ${firstRow.availableUnit || firstRow.materialUnit || '米'}`
              : '—'
            return `
              <tr
                class="cursor-pointer border-t align-top transition ${selected ? 'bg-blue-50/70' : 'bg-background hover:bg-blue-50/30'}"
                data-marker-plan-context-row
                data-marker-plan-action="toggle-context-row"
                data-context-key="${escapeHtml(context.contextKey)}"
              >
                <td class="px-3 py-2">
                  <div class="flex items-start gap-2">
                    <input
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border"
                      data-marker-plan-action="select-context"
                      data-context-key="${escapeHtml(context.contextKey)}"
                      ${selected ? 'checked' : ''}
                    />
                    <div class="min-w-0">
                      <div class="font-semibold text-blue-700">${escapeHtml(context.contextNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">任务：${escapeHtml(context.cuttingTaskNos.join(' / ') || '待分配任务')}</div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2">
                  ${renderProductionOrderIdentityCell(context.productionOrderNos.join(' / ') || '—')}
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.spuCode || '—')} / ${escapeHtml(context.styleName || '—')}</div>
                </td>
                <td class="px-3 py-2">
                  ${renderMaterialIdentityBlock({
                    materialSku: context.materialSkuSummary || '—',
                    materialLabel: context.materialSkuSummary || '—',
                    materialColor: displayColors,
                    materialAlias: displayAlias,
                    materialImageUrl,
                  }, { compact: true })}
                  <div class="mt-1 text-xs text-muted-foreground">
                    纸样：${escapeHtml(firstRow?.patternFileName || firstRow?.patternFileId || '—')} / ${escapeHtml(firstRow?.patternVersion || '—')} / ${escapeHtml(firstRow?.effectiveWidthText || '—')}
                  </div>
                </td>
                <td class="px-3 py-2 font-medium">${escapeHtml(availableText)}</td>
                <td class="px-3 py-2">
                  <div class="font-medium">${escapeHtml(context.executionRouteLabel || '待分配承接方')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.cuttingTaskAssignmentStatusLabels.join(' / ') || '待确认')}</div>
                </td>
                <td class="px-3 py-2">${escapeHtml(context.cuttingTaskAssigneeFactoryNames.join(' / ') || '待分配')}</td>
                <td class="px-3 py-2">
                  <div>${escapeHtml(context.prepStatusLabel || '待备料')}</div>
                  <div class="mt-1 inline-flex rounded-full border bg-background px-2 py-0.5 text-[11px]">${escapeHtml(context.sourceUrgencyLabel || '普通')}</div>
                </td>
              </tr>
            `
          }).join('')
          : '<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-muted-foreground">当前暂无裁片单。</td></tr>'}
            </tbody>
          </table>
        `)}
        ${renderCreateContextPagination(contexts.length, currentPage, pageSize, pageFrom, pageTo)}
      </div>
    </section>
  `
}

function renderBalanceStatusBadge(status: MarkerPlanBalanceSummaryRow['status']): string {
  const meta =
    status === 'matched'
      ? { label: '已匹配', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      : status === 'over'
        ? { label: '超配', className: 'bg-amber-100 text-amber-700 border-amber-200' }
        : { label: '少配', className: 'bg-rose-100 text-rose-700 border-rose-200' }
  return renderStatusBadge(meta.label, meta.className)
}

function renderSizeRatioReadonlyGrid(plan: MarkerPlan | MarkerPlanViewRow): string {
  return `
    <div class="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
      ${MARKER_SIZE_CODES.map((sizeCode) => {
        const row = plan.sizeRatioRows.find((item) => item.sizeCode === sizeCode)
        return `
          <article class="rounded-lg border bg-background px-3 py-3">
            <div class="text-xs font-medium text-foreground">${escapeHtml(`${sizeCode} 尺码成衣件数（件）`)}</div>
            <div class="mt-1 text-base font-semibold">${formatCount(row?.qty || 0)}</div>
          </article>
        `
      }).join('')}
    </div>
  `
}

function renderBasicTab(plan: MarkerPlan): string {
  return `
    <section class="space-y-4 rounded-xl border bg-card p-4" data-testid="marker-plan-basic-tab">
      <div class="grid gap-3 lg:grid-cols-3">
        ${renderInputField('方案编号', plan.markerNo, 'markerNo')}
        ${renderReadonlyField('方案成衣件数（件）', formatCount(plan.totalPieces), buildMarkerTotalPiecesFormula(plan.sizeRatioRows))}
        ${renderReadonlyField('正式技术包', plan.techPackVersion || plan.techPackStatus || '正式版')}
      </div>
      <div class="space-y-3">
        <h3 class="text-sm font-semibold">需求尺码汇总</h3>
        ${renderSizeRatioReadonlyGrid(plan)}
      </div>
      ${renderTextareaField('备注', plan.remark, 'remark')}
    </section>
  `
}

function renderBalanceTable(balanceRows: MarkerPlanBalanceSummaryRow[]): string {
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3 font-medium">尺码</th>
            <th class="px-3 py-3 font-medium">尺码成衣件数（件）</th>
            <th class="px-3 py-3 font-medium">来源分配成衣件数（件）</th>
            <th class="px-3 py-3 font-medium">分配差值（件）</th>
            <th class="px-3 py-3 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          ${balanceRows
            .map((row) => `
              <tr class="border-t">
                <td class="px-3 py-3 font-medium">${escapeHtml(row.sizeCode)}</td>
                <td class="px-3 py-3">${formatCount(row.ratioQty)}</td>
                <td class="px-3 py-3">${renderValueWithFormula(formatCount(row.allocationQty), row.allocationFormula)}</td>
                <td class="px-3 py-3">${renderValueWithFormula(String(row.diffQty), row.diffFormula)}</td>
                <td class="px-3 py-3">${renderBalanceStatusBadge(row.status)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderExplosionStatusCards(summary: MarkerPlanExplosionSummary): string {
  const cards = [
    { label: '技术包状态', meta: summary.techPackStatus },
    { label: 'SKU 匹配状态', meta: summary.skuStatus },
    { label: '颜色映射状态', meta: summary.colorStatus },
    { label: '裁片映射状态', meta: summary.pieceStatus },
    {
      label: '异常数（项）',
      meta: {
        label: `${summary.issueCount} 项`,
        className: summary.issueCount ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
      },
    },
  ]
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${cards
        .map((card) => `
          <article class="rounded-lg border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(card.label)}</div>
            <div class="mt-2">${renderStatusBadge(card.meta.label, card.meta.className)}</div>
          </article>
        `)
        .join('')}
    </div>
  `
}

function renderExplosionIssueRows(
  plan: MarkerPlan | MarkerPlanViewRow,
  readOnly = false,
): string {
  const issueRows = plan.pieceExplosionRows.filter((row) => row.mappingStatus !== 'MATCHED')
  if (!issueRows.length) {
    return '<div class="rounded-lg border bg-background px-4 py-6 text-center text-xs text-muted-foreground">当前没有待处理映射异常。</div>'
  }
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3 font-medium">来源裁片单号</th>
            <th class="px-3 py-3 font-medium">颜色</th>
            <th class="px-3 py-3 font-medium">尺码</th>
            <th class="px-3 py-3 font-medium">SKU</th>
            <th class="px-3 py-3 font-medium">部位</th>
            <th class="px-3 py-3 font-medium">异常原因</th>
            <th class="px-3 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${issueRows
            .map(
              (row) => `
                <tr class="border-t">
                  <td class="px-3 py-3 text-xs font-medium">${escapeHtml(row.sourceCutOrderNo || row.sourceCutOrderId || '—')}</td>
                  <td class="px-3 py-3 text-xs">${escapeHtml(row.colorCode || '—')}</td>
                  <td class="px-3 py-3 text-xs">${escapeHtml(row.sizeCode || '—')}</td>
                  <td class="px-3 py-3 text-xs">${escapeHtml(row.skuCode || '待补 SKU')}</td>
                  <td class="px-3 py-3 text-xs">${escapeHtml(row.partNameCn || row.partCode || '—')}</td>
                  <td class="px-3 py-3 text-xs text-rose-600">${escapeHtml(row.issueReason || '需人工确认')}</td>
                  <td class="px-3 py-3">
                    ${
                      readOnly
                        ? '<span class="text-xs text-muted-foreground">仅查看</span>'
                        : renderActionButton('修正映射', `data-marker-plan-action="open-mapping-drawer" data-piece-id="${escapeHtml(row.id)}"`, 'ghost')
                    }
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderExplosionTab(plan: MarkerPlan | MarkerPlanViewRow, context: MarkerPlanContextCandidate | null = null, readOnly = false): string {
  const summary = (plan as MarkerPlanViewRow).explosionSummary || {
    techPackStatus: { label: '待确认', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    skuStatus: { label: '待确认', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    colorStatus: { label: '待确认', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    pieceStatus: { label: '待确认', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    issueCount: 0,
    skuTypeCount: 0,
    skuSummaryRows: [],
    issueRows: [],
  }

  return `
    <section class="space-y-4 rounded-xl border bg-card p-4" data-testid="marker-plan-explosion-tab">
      ${renderExplosionStatusCards(summary)}
      <div class="space-y-2">
        <h3 class="text-sm font-semibold">SKU 汇总表</h3>
        <div class="overflow-hidden rounded-lg border bg-background">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3 font-medium">来源裁片单号</th>
                <th class="px-3 py-3 font-medium">颜色</th>
                <th class="px-3 py-3 font-medium">尺码</th>
                <th class="px-3 py-3 font-medium">SKU</th>
                <th class="px-3 py-3 font-medium">SKU 成衣件数（件）</th>
                <th class="px-3 py-3 font-medium">SKU裁片片数（片）</th>
                <th class="px-3 py-3 font-medium">匹配状态</th>
              </tr>
            </thead>
            <tbody>
              ${
                summary.skuSummaryRows.length
                  ? summary.skuSummaryRows
                      .map((row) => `
                        <tr class="border-t">
                          <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo || '—')}</td>
                          <td class="px-3 py-3">${escapeHtml(row.colorCode || '—')}</td>
                          <td class="px-3 py-3">${escapeHtml(row.sizeCode || '—')}</td>
                          <td class="px-3 py-3 font-medium">${escapeHtml(row.skuCode || '待补 SKU')}</td>
                          <td class="px-3 py-3">${formatCount(row.garmentQty)}</td>
                          <td class="px-3 py-3">${renderValueWithFormula(formatCount(row.explodedPieceQty), row.explodedPieceFormula)}</td>
                          <td class="px-3 py-3">${escapeHtml(row.mappingStatusLabel)}</td>
                        </tr>
                      `)
                      .join('')
                  : `<tr><td colspan="7" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有可展示的 SKU 拆解结果。</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
      <details class="rounded-lg border bg-background" data-testid="marker-plan-piece-detail-fold" data-default-open="collapsed">
        <summary class="cursor-pointer px-2.5 py-1.5 text-sm font-semibold">部位明细表</summary>
        <div class="overflow-hidden rounded-b-lg border-t">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3 font-medium">来源裁片单</th>
                <th class="px-3 py-3 font-medium">颜色</th>
                <th class="px-3 py-3 font-medium">尺码</th>
                <th class="px-3 py-3 font-medium">SKU</th>
                <th class="px-3 py-3 font-medium">面料</th>
                <th class="px-3 py-3 font-medium">纸样</th>
                <th class="px-3 py-3 font-medium">部位</th>
                <th class="px-3 py-3 font-medium">部位（印尼语）</th>
                <th class="px-3 py-3 font-medium">部位成衣件数（件）</th>
                <th class="px-3 py-3 font-medium">单件裁片数（片/件）</th>
                <th class="px-3 py-3 font-medium">裁片片数（片）</th>
                <th class="px-3 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              ${
                plan.pieceExplosionRows.length
                  ? plan.pieceExplosionRows
                      .map((row) => `
                        <tr class="border-t">
                          <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo || row.sourceCutOrderId)}</td>
                          <td class="px-3 py-3">${escapeHtml(row.colorCode || '—')}</td>
                          <td class="px-3 py-3">${escapeHtml(row.sizeCode || '—')}</td>
                          <td class="px-3 py-3">${escapeHtml(row.skuCode || '待补 SKU')}</td>
                          <td class="px-3 py-3">${renderMaterialIdentityBlock({
                            materialSku: row.materialSku || '—',
                            materialLabel: row.materialSku || '—',
                            materialAlias: row.materialAlias || '',
                            materialImageUrl: row.materialImageUrl || '',
                          }, { compact: true })}</td>
                          <td class="px-3 py-3">${escapeHtml(row.patternCode || '—')}</td>
                          <td class="px-3 py-3">${escapeHtml(row.partNameCn || row.partCode || '—')}</td>
                          <td class="px-3 py-3">${escapeHtml(row.partNameId || '—')}</td>
                          <td class="px-3 py-3">${formatCount(row.garmentQty)}</td>
                          <td class="px-3 py-3">${formatCount(row.piecePerGarment)}</td>
                          <td class="px-3 py-3">${renderValueWithFormula(formatCount(row.explodedPieceQty), buildMarkerExplodedPieceQtyFormula(row.piecePerGarment, row.garmentQty))}</td>
                          <td class="px-3 py-3">${escapeHtml(row.mappingStatus === 'MATCHED' ? '已匹配' : row.issueReason || '映射异常')}</td>
                        </tr>
                      `)
                      .join('')
                  : `<tr><td colspan="12" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有裁片拆解明细。</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </details>
      ${
        summary.issueCount || !readOnly
          ? `
            <details class="rounded-lg border bg-background" data-testid="marker-plan-issue-detail-fold" data-default-open="collapsed">
              <summary class="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-sm font-semibold">
                <span>异常列表</span>
                <span class="text-xs text-muted-foreground">SKU种类数（个SKU）：${summary.skuTypeCount}</span>
              </summary>
              <div class="border-t p-1.5">${renderExplosionIssueRows(plan, readOnly)}</div>
            </details>
          `
          : ''
      }
    </section>
  `
}

function renderMappingRepairDrawer(plan: MarkerPlan | null, context: MarkerPlanContextCandidate | null): string {
  if (!state.mappingDrawerOpen || !plan) return ''
  const targetRow = getMappingTargetRow(plan)
  if (!targetRow) return ''
  const colorOptions = getPlanColorOptions(plan, context)
  const skuOptions = Array.from(new Set(plan.pieceExplosionRows.map((row) => row.skuCode).filter(Boolean)))
  const partOptions = Array.from(
    new Map(
      plan.pieceExplosionRows
        .map((row) => ({
          value: row.partCode || row.partNameCn,
          label: row.partNameCn || row.partCode,
        }))
        .filter((item) => item.value)
        .map((item) => [item.value, item]),
    ).values(),
  )
  const patternOptions = Array.from(new Set(plan.pieceExplosionRows.map((row) => row.patternCode).filter(Boolean)))

  const drawerContent = `
    <div class="space-y-4" data-testid="marker-plan-mapping-drawer">
      <div class="grid gap-3 md:grid-cols-2">
        ${renderReadonlyField('来源裁片单号', targetRow.sourceCutOrderNo || targetRow.sourceCutOrderId || '—')}
        ${renderReadonlyField('当前异常', targetRow.issueReason || '需人工确认')}
        ${renderSelectField(
          '目标 SKU',
          'targetSku',
          skuOptions.map((skuCode) => ({ value: skuCode, label: skuCode })),
          state.mappingDraft.targetSku,
          'data-marker-plan-mapping-field',
        )}
        ${renderSelectField(
          '颜色归属方式',
          'colorMode',
          [
            { value: 'follow-source', label: '沿用来源颜色' },
            { value: 'specified', label: '指定颜色' },
          ],
          state.mappingDraft.colorMode,
          'data-marker-plan-mapping-field',
        )}
        ${renderSelectField(
          '指定颜色',
          'specifiedColor',
          colorOptions.map((color) => ({ value: color, label: color })),
          state.mappingDraft.specifiedColor,
          'data-marker-plan-mapping-field',
        )}
        ${renderSelectField(
          '部位',
          'partCode',
          partOptions.map((item) => ({ value: item.value, label: item.label })),
          state.mappingDraft.partCode,
          'data-marker-plan-mapping-field',
        )}
        ${renderSelectField(
          '纸样',
          'patternCode',
          patternOptions.map((patternCode) => ({ value: patternCode, label: patternCode })),
          state.mappingDraft.patternCode,
          'data-marker-plan-mapping-field',
        )}
        <label class="space-y-2" data-marker-plan-control-type="number-input">
          <span class="text-sm font-medium text-foreground">单件裁片数（片/件）</span>
          <input
            type="number"
            min="0"
            step="1"
            value="${escapeHtml(String(state.mappingDraft.piecePerGarment || 0))}"
            data-marker-plan-mapping-field="piecePerGarment"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <label class="space-y-2" data-marker-plan-control-type="textarea">
        <span class="text-sm font-medium text-foreground">备注</span>
        <textarea
          rows="3"
          data-marker-plan-mapping-field="note"
          class="w-full rounded-md border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >${escapeHtml(state.mappingDraft.note)}</textarea>
      </label>
    </div>
  `

  return uiDrawer(
    {
      title: '修正映射',
      subtitle: targetRow.sourceCutOrderNo || targetRow.sourceCutOrderId || '',
      closeAction: { prefix: 'marker-plan', action: 'close-mapping-drawer' },
      width: 'lg',
    },
    drawerContent,
    {
      cancel: { prefix: 'marker-plan', action: 'close-mapping-drawer', label: '取消' },
      extra: renderActionButton('恢复自动映射', 'data-marker-plan-action="restore-auto-mapping"', 'ghost'),
      confirm: {
        prefix: 'marker-plan',
        action: 'save-mapping',
        label: '保存映射',
        variant: 'primary',
      },
    },
  )
}

function renderFoldConfigEditor(foldConfig: MarkerFoldConfig | null): string {
  if (!foldConfig) return ''
  const directionOptions = ['对边折入', '中线对折', '单边对折']
  return `
    <section class="space-y-3 rounded-lg border bg-background p-3" data-testid="marker-plan-fold-config">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">原始有效门幅（cm）</span>
          <input type="number" min="0" step="0.01" value="${foldConfig.originalEffectiveWidth}" data-marker-plan-fold-field="originalEffectiveWidth" data-marker-plan-control-type="number-input" class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">对折损耗（cm）</span>
          <input type="number" min="0" step="0.01" value="${foldConfig.foldAllowance}" data-marker-plan-fold-field="foldAllowance" data-marker-plan-control-type="number-input" class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">对折方向</span>
          <select data-marker-plan-fold-field="foldDirection" data-marker-plan-control-type="select" class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            ${directionOptions.map((direction) => `<option value="${escapeHtml(direction)}" ${direction === foldConfig.foldDirection ? 'selected' : ''}>${escapeHtml(direction)}</option>`).join('')}
          </select>
        </label>
        ${renderReadonlyField('对折有效门幅（cm）', `${formatNumber(foldConfig.foldedEffectiveWidth, 2)} cm`, buildMarkerFoldedEffectiveWidthFormula(foldConfig))}
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">唛架最大门幅（cm）</span>
          <input type="number" min="0" step="0.01" value="${foldConfig.maxLayoutWidth}" data-marker-plan-fold-field="maxLayoutWidth" data-marker-plan-control-type="number-input" class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>
      <div>${foldConfig.widthCheckPassed ? renderStatusBadge('门幅校验通过', 'bg-emerald-100 text-emerald-700 border-emerald-200') : renderStatusBadge('门幅校验未通过', 'bg-rose-100 text-rose-700 border-rose-200')}</div>
    </section>
  `
}

function renderFoldConfigReadonly(foldConfig: MarkerFoldConfig | null): string {
  if (!foldConfig) return ''
  return `
    <section class="space-y-3 rounded-lg border bg-background p-3" data-testid="marker-plan-fold-config">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderReadonlyField('原始有效门幅（cm）', `${formatNumber(foldConfig.originalEffectiveWidth, 2)} cm`)}
        ${renderReadonlyField('对折损耗（cm）', `${formatNumber(foldConfig.foldAllowance, 2)} cm`)}
        ${renderReadonlyField('对折方向', foldConfig.foldDirection || '—')}
        ${renderReadonlyField('对折有效门幅（cm）', `${formatNumber(foldConfig.foldedEffectiveWidth, 2)} cm`, buildMarkerFoldedEffectiveWidthFormula(foldConfig))}
        ${renderReadonlyField('唛架最大门幅（cm）', `${formatNumber(foldConfig.maxLayoutWidth, 2)} cm`)}
      </div>
      <div>${foldConfig.widthCheckPassed ? renderStatusBadge('门幅校验通过', 'bg-emerald-100 text-emerald-700 border-emerald-200') : renderStatusBadge('门幅校验未通过', 'bg-rose-100 text-rose-700 border-rose-200')}</div>
    </section>
  `
}

function renderLayoutDecisionReference(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const demandSummary = getPlanDemandMatchSummary(plan)
  const sourceRows = context?.sourceCutOrderRows || []
  const selectedRows = plan.selectedSourceCutOrderRows || []
  const fallbackUnit = sourceRows[0]?.materialQuantityLedger.unit || sourceRows[0]?.availableUnit || selectedRows[0]?.unit || '米'
  const requiredQty = sourceRows.reduce((total, row) => total + safeNumber(row.materialQuantityLedger.requiredMaterialQty), 0)
  const allocatedQty = sourceRows.reduce((total, row) => total + safeNumber(row.materialQuantityLedger.transferWarehouseAllocatedQty), 0)
  const claimedQty = sourceRows.reduce((total, row) => total + safeNumber(row.materialQuantityLedger.cuttingClaimedQty), 0)
  const consumedQty = sourceRows.reduce((total, row) => total + safeNumber(row.materialQuantityLedger.spreadingConsumedQty), 0)
  const availableQty = sourceRows.length
    ? sourceRows.reduce((total, row) => total + safeNumber(row.materialQuantityLedger.availableQty), 0)
    : selectedRows.reduce((total, row) => total + safeNumber(row.availableQty), 0)
  const plannedUsageQty = safeNumber(plan.materialTotalUsageLength || plan.plannedSpreadLength)
  const afterUsageQty = availableQty - plannedUsageQty
  const afterUsageTone = afterUsageQty >= 0
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
  const materialRows = selectedRows.length
    ? selectedRows
    : sourceRows.map((row) => ({
        cutOrderId: row.cutOrderId,
        cutOrderNo: row.cutOrderNo,
        productionOrderNo: row.productionOrderNo,
        materialSku: row.materialSku,
        materialName: row.materialName,
        materialColor: row.materialColor,
        materialAlias: row.materialAlias,
        materialImageUrl: row.materialImageUrl,
        availableQty: row.materialQuantityLedger.availableQty,
        unit: row.materialQuantityLedger.unit || row.availableUnit || row.materialUnit || fallbackUnit,
      }))

  return `
    <section class="space-y-3 rounded-xl border bg-card p-4" data-testid="marker-plan-layout-decision-reference">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">唛架编号决策参考</h3>
          <div class="mt-1 text-xs text-muted-foreground">维护唛架编号时同时参考需求数量和待加工仓对应面料库存，不只看需求件数。</div>
        </div>
        ${renderStatusBadge(afterUsageQty >= 0 ? '库存参考充足' : '库存参考不足', afterUsageTone)}
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <article class="rounded-lg border bg-background p-3">
          <div class="text-xs font-medium text-muted-foreground">需求数量参考</div>
          <div class="mt-2 grid gap-2 text-xs">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">来源需求件数</span><span class="font-semibold">${formatCount(demandSummary.demandTotalQty)} 件</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">当前唛架计划数量</span><span class="font-semibold">${formatCount(demandSummary.markerTotalQty)} 件</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">需求差异</span><span class="font-semibold">${formatSignedCount(demandSummary.diffTotalQty)} 件</span></div>
          </div>
        </article>
        <article class="rounded-lg border bg-background p-3">
          <div class="text-xs font-medium text-muted-foreground">待加工仓对应面料库存</div>
          <div class="mt-2 grid gap-2 text-xs">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">需求用量</span><span class="font-semibold">${formatNumber(requiredQty, 2)} ${escapeHtml(fallbackUnit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">中转仓已配数量</span><span class="font-semibold">${formatNumber(allocatedQty, 2)} ${escapeHtml(fallbackUnit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">裁床已领数量</span><span class="font-semibold">${formatNumber(claimedQty, 2)} ${escapeHtml(fallbackUnit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">当前可用库存</span><span class="font-semibold">${formatNumber(availableQty, 2)} ${escapeHtml(fallbackUnit)}</span></div>
          </div>
        </article>
        <article class="rounded-lg border bg-background p-3">
          <div class="text-xs font-medium text-muted-foreground">本次唛架用量校验</div>
          <div class="mt-2 grid gap-2 text-xs">
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">物料总用量</span><span class="font-semibold">${formatNumber(plannedUsageQty, 2)} m</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">其中捆条加工</span><span class="font-semibold">${formatNumber(plan.bindingStripReservedLength || 0, 2)} m</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">已消耗数量</span><span class="font-semibold">${formatNumber(consumedQty, 2)} ${escapeHtml(fallbackUnit)}</span></div>
            <div class="flex justify-between gap-3"><span class="text-muted-foreground">计划后参考余额</span><span class="font-semibold">${formatNumber(afterUsageQty, 2)} ${escapeHtml(fallbackUnit)}</span></div>
          </div>
        </article>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        ${
          materialRows.length
            ? materialRows.map((row) => `
              <article class="rounded-lg border bg-background p-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="text-xs text-muted-foreground">来源裁片单</div>
                    <div class="mt-0.5 text-sm font-semibold text-blue-600">${escapeHtml(row.cutOrderNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(row.productionOrderNo || '—')}</div>
                  </div>
                  <div class="text-right text-xs">
                    <div class="text-muted-foreground">当前可用库存</div>
                    <div class="mt-0.5 text-sm font-semibold">${formatNumber(row.availableQty, 2)} ${escapeHtml(row.unit || fallbackUnit)}</div>
                  </div>
                </div>
                <div class="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                  <div class="rounded-md border bg-muted/10 p-2">
                    ${renderMaterialIdentityBlock({
                      materialSku: row.materialSku,
                      materialLabel: row.materialName || row.materialSku,
                      materialAlias: row.materialAlias,
                      materialImageUrl: row.materialImageUrl,
                    }, { compact: true })}
                    <div class="mt-1 text-xs text-muted-foreground">颜色：${escapeHtml(row.materialColor || '—')}</div>
                  </div>
	                  <div class="grid gap-2 text-xs">
	                    <div class="rounded-md bg-muted/20 px-2 py-1.5">本次参考：<span class="font-medium">${formatNumber(Math.min(safeNumber(row.availableQty), plannedUsageQty || safeNumber(row.availableQty)), 2)} ${escapeHtml(row.unit || fallbackUnit)}</span></div>
	                  </div>
                </div>
              </article>
            `).join('')
            : '<div class="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无待加工仓面料库存数据，请先选择裁片单。</div>'
        }
      </div>
    </section>
  `
}

function renderLayoutTab(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const hasFoldBed = buildMarkerSchemeFromPlan(plan).beds.some((bed) => isFoldBedMode(bed.bedMode))

  return `
    <section class="space-y-4 rounded-xl border bg-card p-4" data-testid="marker-plan-layout-tab-${plan.markerMode}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">唛架编辑器</h3>
        <div class="text-xs text-muted-foreground">${escapeHtml(buildMarkerSchemeFromPlan(plan).modeSummaryText || '待编辑')}</div>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderInputField('单次铺布固定损耗（m）', String(plan.singleSpreadFixedLoss || 0.06), 'singleSpreadFixedLoss', 'number')}
        ${renderReadonlyField('计划铺布总长度（m）', `${formatNumber(plan.plannedSpreadLength, 2)} m`, buildMarkerPlannedSpreadLengthFormula(plan))}
        ${renderReadonlyField('捆条加工长度（m）', `${formatNumber(plan.bindingStripReservedLength || 0, 2)} m`, plan.bindingStripReservedLengthFormula || '')}
        ${renderReadonlyField('物料总用量（m）', `${formatNumber(plan.materialTotalUsageLength || plan.plannedSpreadLength, 2)} m`, plan.materialTotalUsageLengthFormula || '')}
        ${renderReadonlyField('系统单件成衣用量（m/件）', `${formatNumber(plan.systemUnitUsage, 3)} m/件`, buildMarkerPlanSystemUnitUsageFormula(plan))}
        ${renderInputField('人工修正单件成衣用量（m/件）', plan.manualUnitUsage ? String(plan.manualUnitUsage) : '', 'manualUnitUsage', 'number')}
        ${renderReadonlyField('最终单件成衣用量（m/件）', `${formatNumber(plan.finalUnitUsage, 3)} m/件`, buildMarkerFinalUnitUsageFormula(plan.systemUnitUsage, plan.manualUnitUsage))}
      </div>
      ${renderLayoutDecisionReference(plan, context)}
      ${hasFoldBed ? renderFoldConfigEditor(plan.foldConfig) : ''}
      ${renderSchemeBedEditor(plan, context)}
    </section>
  `
}

function renderLayoutReadonlyTab(plan: MarkerPlan | MarkerPlanViewRow): string {
  const hasFoldBed = buildMarkerSchemeFromPlan(plan as MarkerPlan).beds.some((bed) => isFoldBedMode(bed.bedMode))

  return `
    <div class="space-y-3" data-testid="marker-plan-layout-tab-${plan.markerMode}">
      ${hasFoldBed ? renderFoldConfigReadonly(plan.foldConfig) : ''}
      ${renderSchemeBedsOverview(plan)}
    </div>
  `
}

function renderSchemeDemandMatrix(plan: MarkerPlan | MarkerPlanViewRow): string {
  const scheme = buildMarkerSchemeFromPlan(plan as MarkerPlan)
  const sizeNames = Array.from(new Set(scheme.demandRows.map((row) => row.sizeName || row.sizeCode).filter(Boolean)))
  const colorNames = Array.from(new Set(scheme.demandRows.map((row) => row.colorName || row.colorCode).filter(Boolean)))
  const getQty = (color: string, size: string): number =>
    scheme.demandRows
      .filter((row) => (row.colorName || row.colorCode) === color && (row.sizeName || row.sizeCode) === size)
      .reduce((sum, row) => sum + Math.max(Number(row.demandQty || 0), 0), 0)

  return `
    <section class="space-y-4 rounded-xl border bg-card p-4" data-testid="marker-scheme-demand-matrix">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">需求矩阵</h3>
        <div class="text-xs text-muted-foreground">${escapeHtml(scheme.techPackStatus)} ${escapeHtml(scheme.techPackVersion)}</div>
      </div>
      <div class="overflow-hidden rounded-lg border bg-background">
        <table class="min-w-full text-left text-xs">
          <thead class="bg-muted/40 text-muted-foreground">
            <tr>
              <th class="px-3 py-3 font-medium">颜色</th>
              ${sizeNames.map((size) => `<th class="px-3 py-3 font-medium">${escapeHtml(size)}</th>`).join('')}
              <th class="px-3 py-3 font-medium">合计</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${
              colorNames.length
                ? colorNames
                    .map((color) => {
                      const total = sizeNames.reduce((sum, size) => sum + getQty(color, size), 0)
                      return `
                        <tr>
                          <td class="px-3 py-3 font-medium text-foreground">${escapeHtml(color)}</td>
                          ${sizeNames.map((size) => `<td class="px-3 py-3">${formatCount(getQty(color, size))}</td>`).join('')}
                          <td class="px-3 py-3 font-medium">${formatCount(total)}</td>
                        </tr>
                      `
                    })
                    .join('')
                : '<tr><td colspan="3" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有需求矩阵。</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderMarkerMatrixReadonlyTable(plan: MarkerPlan | MarkerPlanViewRow, bed: MarkerSchemeBed): string {
  const sizeColumns = getMarkerMatrixSizeColumns(plan)
  const sizeDemandMap = getMarkerMatrixSizeDemandMap(plan)
  const rows = createMarkerMatrixRows(plan, bed)
  const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeColumns)
  const layerTotals = getMarkerMatrixColumnLayerTotals(rows, sizeColumns)
  const pieceTotals = getMarkerMatrixColumnPieceTotals(rows, sizeColumns, sizePiecePerLayer)
  const highLowMode = isHighLowMatrixMode(bed.bedMode)
  return `
    <div class="overflow-x-auto rounded-lg border bg-background">
      <table class="min-w-[960px] w-full text-center text-xs">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            ${highLowMode ? '<th class="w-24 px-3 py-3 text-left font-medium">阶梯编号</th>' : ''}
            <th class="w-28 px-3 py-3 text-left font-medium">颜色</th>
            <th class="w-44 px-3 py-3 text-left font-medium">物料信息</th>
            ${sizeColumns.map((size) => `<th class="px-3 py-3 font-medium"><div>${escapeHtml(size)}</div><div class="mt-1 text-[10px] text-muted-foreground">每层件数 ${formatCount(sizePiecePerLayer[size] || 0)}</div><div class="mt-1 text-[10px] text-muted-foreground">需求 ${formatCount(sizeDemandMap[size] || 0)}</div></th>`).join('')}
            ${highLowMode ? '<th class="px-3 py-3 font-medium">唛架净长度</th>' : ''}
            <th class="px-3 py-3 font-medium">行合计</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows.map((row, index) => {
            const rowTotal = sizeColumns.reduce((total, size) => total + getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer), 0)
            const materialText = getMarkerMatrixMaterialForColor(plan, row.colorName || row.colorCode)
            return `
              <tr>
                ${highLowMode ? `<td class="px-3 py-3 text-left font-medium text-blue-600">${escapeHtml(row.stepLabel || buildHighLowStepLabel(index + 1))}</td>` : ''}
                <td class="px-3 py-3 text-left font-medium text-foreground">
                  ${escapeHtml(row.colorName || row.colorCode)}
                </td>
                <td class="px-3 py-3 text-left text-muted-foreground">${escapeHtml(materialText)}</td>
                ${sizeColumns.map((size) => {
                  const layerCount = getMarkerMatrixCellLayer(row, size)
                  const pieceCount = getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer)
                  return `<td class="px-2 py-2 ${layerCount > 0 ? 'bg-slate-200 text-slate-900' : 'bg-background text-muted-foreground'}">${layerCount > 0 ? `<div>${formatCount(layerCount)} 层</div><div class="mt-1 text-[10px] text-muted-foreground">${formatCount(pieceCount)} 件</div>` : '—'}</td>`
                }).join('')}
                ${highLowMode ? `<td class="px-3 py-3">${row.markerLength > 0 ? `${formatNumber(row.markerLength, 2)} m` : '—'}</td>` : ''}
                <td class="px-3 py-3 font-medium">${formatCount(rowTotal)}</td>
              </tr>
            `
          }).join('')}
        </tbody>
        <tfoot class="border-t bg-muted/20 text-xs font-medium">
          <tr>
            ${highLowMode ? '<td class="px-3 py-3 text-left">—</td>' : ''}
            <td class="px-3 py-3 text-left">累计层数&累计件数</td>
            <td class="px-3 py-3 text-left text-muted-foreground">按尺码列累计</td>
            ${sizeColumns.map((size) => `<td class="px-3 py-3"><div>${formatCount(layerTotals[size] || 0)} 层</div><div class="mt-1 text-[10px] text-muted-foreground">${formatCount(pieceTotals[size] || 0)} 件</div></td>`).join('')}
            ${highLowMode ? '<td class="px-3 py-3">—</td>' : ''}
            <td class="px-3 py-3">${formatCount(Object.values(pieceTotals).reduce((total, value) => total + value, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `
}

function renderSchemeBedsOverview(plan: MarkerPlan | MarkerPlanViewRow): string {
  const scheme = buildMarkerSchemeFromPlan(plan as MarkerPlan)
  const spreadingOrdersByBedNo = new Map(getSpreadingOrdersForMarkerPlan(plan.id).map((order) => [order.bedNo, order]))
  return `
    <section class="space-y-4 rounded-xl border bg-card p-4" data-testid="marker-scheme-beds-overview">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">唛架编号</h3>
        <div class="text-xs text-muted-foreground">${escapeHtml(scheme.modeSummaryText || '待编辑')}</div>
      </div>
      <div class="grid gap-2 md:grid-cols-4">
        ${renderReadonlyField('方案号', scheme.schemeNo)}
        ${renderReadonlyField('技术包', `${scheme.techPackStatus} ${scheme.techPackVersion}`)}
        ${renderReadonlyField('唛架数量', `${scheme.bedCount} 个`)}
        ${renderReadonlyField('铺布状态', scheme.spreadingStatus)}
      </div>
      <div class="space-y-4">
        ${scheme.beds.length
          ? scheme.beds.map((bed) => `
            <article class="space-y-3 rounded-lg border bg-background p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="text-sm font-semibold">${escapeHtml(bed.bedNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(markerPlanModeMeta[bed.bedMode]?.label || bed.bedMode)}</div>
                </div>
                ${renderStatusBadge(bed.status, bed.readyForSpreading ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}
              </div>
              <div class="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                ${renderReadonlyField('床次', `${formatCount(bed.bedSortOrder || 1)}`)}
                ${renderReadonlyField('唛架净长度', isHighLowMatrixMode(bed.bedMode) ? '按颜色行填写' : `${formatNumber(bed.markerLength, 2)} m`)}
                ${renderReadonlyField('计划层数', `${formatNumber(bed.plannedLayerCount, 0)} 层`)}
                ${renderReadonlyField('计划数量', `${formatCount(bed.plannedGarmentQty)} 件`)}
                ${renderReadonlyField('计划用量', `${formatNumber(bed.spreadTotalLength, 2)} m`)}
                ${renderReadonlyField('后续铺布单', spreadingOrdersByBedNo.get(bed.bedNo)?.spreadingOrderNo || '待生成铺布单')}
              </div>
              ${renderMarkerMatrixReadonlyTable(plan, bed)}
            </article>
          `).join('')
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-xs text-muted-foreground">当前还没有唛架编号。</div>'}
      </div>
    </section>
  `
}

function renderMarkerPlanSpreadingOrders(plan: MarkerPlan | MarkerPlanViewRow): string {
  const orders = getSpreadingOrdersForMarkerPlan(plan.id)
  const totalPlannedQty = orders.reduce((sum, order) => sum + order.plannedGarmentQty, 0)
  const totalUsage = orders.reduce((sum, order) => sum + order.plannedMaterialUsage, 0)

  return `
    <section class="space-y-3 rounded-xl border bg-card p-4" data-testid="marker-plan-spreading-orders">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">铺布单</h3>
          <div class="mt-1 text-xs text-muted-foreground">
            ${orders.length ? `已按唛架编号生成 ${formatCount(orders.length)} 张铺布单` : '唛架方案确认后按唛架编号生成铺布单'}
          </div>
        </div>
        ${renderStatusBadge(orders.length ? `${formatCount(orders.length)} 张` : '待生成铺布单', orders.length ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700')}
      </div>
      <div class="grid gap-2 md:grid-cols-3">
        ${renderReadonlyField('铺布单数量', `${formatCount(orders.length)} 张`)}
        ${renderReadonlyField('计划数量合计', `${formatCount(totalPlannedQty)} 件`)}
        ${renderReadonlyField('计划用量合计', `${formatNumber(totalUsage, 2)} m`)}
      </div>
      ${
        orders.length
          ? `<div class="grid gap-3 xl:grid-cols-3">
              ${orders.map((order) => {
                const status = spreadingOrderStatusMeta[order.status]
                const materialReadiness = resolveSpreadingOrderMaterialReadiness(order)
                return `
                  <article class="space-y-3 rounded-lg border bg-background p-3" data-spreading-order-id="${escapeHtml(order.spreadingOrderId)}">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div class="text-sm font-semibold text-blue-600">${escapeHtml(order.spreadingOrderNo)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">唛架编号 ${escapeHtml(order.markerNumber)} / 床次 ${escapeHtml(order.bedNo)}</div>
                      </div>
                      <div class="flex flex-wrap gap-1">
                        ${renderStatusBadge(status.label, status.className)}
                        ${renderStatusBadge(materialReadiness.statusLabel, materialReadiness.statusClassName)}
                      </div>
                    </div>
                    <div class="grid gap-2 text-xs md:grid-cols-2">
                      <div class="rounded-md bg-muted/20 px-2 py-1.5">计划层数：<span class="font-medium">${formatNumber(order.plannedLayerCount, 0)} 层</span></div>
                      <div class="rounded-md bg-muted/20 px-2 py-1.5">计划数量：<span class="font-medium">${formatCount(order.plannedGarmentQty)} 件</span></div>
                      <div class="rounded-md bg-muted/20 px-2 py-1.5">计划用量：<span class="font-medium">${formatNumber(order.plannedMaterialUsage, 2)} ${escapeHtml(order.plannedMaterialUsageUnit)}</span></div>
                      <div class="rounded-md bg-muted/20 px-2 py-1.5">来源裁片单：<span class="font-medium">${formatCount(order.sourceCutOrderIds.length)} 张</span></div>
                    </div>
                    <div class="rounded-md border bg-muted/10 px-2 py-2 text-xs leading-5">
                      <div class="font-medium text-foreground">铺布物料状态：${escapeHtml(materialReadiness.statusLabel)}</div>
                      <div class="mt-1 text-muted-foreground">
                        计划 ${escapeHtml(`${formatNumber(materialReadiness.plannedUsageQty, 2)} ${materialReadiness.unit}`)}；
                        可用 ${escapeHtml(`${formatNumber(materialReadiness.availableQty, 2)} ${materialReadiness.unit}`)}
                        ${materialReadiness.shortageQty > 0 ? `；缺口 ${escapeHtml(`${formatNumber(materialReadiness.shortageQty, 2)} ${materialReadiness.unit}`)}` : ''}
                      </div>
                    </div>
                    <div class="text-xs text-muted-foreground">
                      ${escapeHtml(order.markerModeLabel)} / ${escapeHtml(order.patternIdentity.patternFileName || '纸样待补')} / ${escapeHtml(order.effectiveWidth || '幅宽待补')}
                    </div>
                    <div class="flex justify-end">
                      ${renderActionButton('查看铺布单', `data-marker-plan-action="go-spreading-order" data-spreading-session-id="${escapeHtml(order.spreadingOrderId)}" data-plan-id="${escapeHtml(plan.id)}"`)}
                    </div>
                  </article>
                `
              }).join('')}
            </div>`
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-xs text-muted-foreground">当前方案尚未生成铺布单。</div>'
      }
    </section>
  `
}

function renderMarkerMatrixEditor(plan: MarkerPlan, bed: MarkerSchemeBed): string {
  const sizeColumns = getMarkerMatrixSizeColumns(plan)
  const sizeDemandMap = getMarkerMatrixSizeDemandMap(plan)
  const colorOptions = getMarkerMatrixColorRows(plan)
  const rows = createMarkerMatrixRows(plan, bed)
  const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeColumns)
  const errors = validateMarkerMatrixRows(bed.bedMode, rows, sizeColumns, sizePiecePerLayer)
  const layerTotals = getMarkerMatrixColumnLayerTotals(rows, sizeColumns)
  const pieceTotals = getMarkerMatrixColumnPieceTotals(rows, sizeColumns, sizePiecePerLayer)
  const highLowMode = isHighLowMatrixMode(bed.bedMode)
  return `
    <div class="space-y-2">
      <div class="overflow-x-auto rounded-lg border bg-background">
        <table class="min-w-[980px] w-full text-center text-xs">
          <thead class="bg-muted/40 text-muted-foreground">
            <tr>
              ${highLowMode ? '<th class="w-24 px-3 py-3 text-left font-medium">阶梯编号</th>' : ''}
              <th class="w-36 px-3 py-3 text-left font-medium">颜色</th>
              <th class="w-44 px-3 py-3 text-left font-medium">物料信息</th>
              ${sizeColumns.map((size) => `
                <th class="px-3 py-3 font-medium">
                  <div>${escapeHtml(size)}</div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value="${sizePiecePerLayer[size] || ''}"
                    data-marker-plan-size-piece-per-layer="true"
                    data-bed-id="${escapeHtml(bed.bedId)}"
                    data-size-name="${escapeHtml(size)}"
                    class="mt-2 h-8 w-20 rounded-md border bg-card px-2 text-center text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="每层件数"
                  />
                  <div class="mt-1 text-[10px] text-muted-foreground">需求 ${formatCount(sizeDemandMap[size] || 0)}</div>
                </th>
              `).join('')}
              ${highLowMode ? '<th class="px-3 py-3 font-medium">唛架净长度</th>' : ''}
              <th class="px-3 py-3 font-medium">行合计</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${rows.map((row, index) => {
              const rowTotal = sizeColumns.reduce((total, size) => total + getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer), 0)
              const materialText = getMarkerMatrixMaterialForColor(plan, row.colorName || row.colorCode)
              return `
                <tr>
                  ${highLowMode ? `<td class="px-3 py-3 text-left font-medium text-blue-600">${escapeHtml(row.stepLabel || buildHighLowStepLabel(index + 1))}</td>` : ''}
                  <td class="px-3 py-3 text-left">
                    <select data-marker-plan-matrix-row-color="true" data-bed-id="${escapeHtml(bed.bedId)}" data-row-id="${escapeHtml(row.rowId)}" class="h-8 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                      ${colorOptions.map((color) => `<option value="${escapeHtml(color)}" ${color === (row.colorName || row.colorCode) ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}
                    </select>
                    <div class="mt-2 flex items-center gap-2">
                      <button type="button" class="text-xs text-muted-foreground hover:text-rose-600" data-marker-plan-action="remove-matrix-row" data-bed-id="${escapeHtml(bed.bedId)}" data-row-id="${escapeHtml(row.rowId)}">删除</button>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-left text-xs text-muted-foreground">${escapeHtml(materialText)}</td>
                  ${sizeColumns.map((size) => {
                    const value = getMarkerMatrixCellLayer(row, size)
                    const pieceCount = getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer)
                    return `
                      <td class="px-2 py-2 ${value > 0 ? 'bg-slate-100' : ''}">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value="${value || ''}"
                          data-marker-plan-matrix-cell="true"
                          data-bed-id="${escapeHtml(bed.bedId)}"
                          data-row-id="${escapeHtml(row.rowId)}"
                          data-color-name="${escapeHtml(row.colorName || row.colorCode)}"
                          data-size-name="${escapeHtml(size)}"
                          placeholder="层数"
                          class="h-8 w-20 rounded-md border bg-card px-2 text-center text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        ${value > 0 ? `<div class="mt-1 text-[10px] text-muted-foreground">${formatCount(pieceCount)} 件</div>` : ''}
                      </td>
                    `
                  }).join('')}
                  ${highLowMode ? `
                    <td class="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value="${row.markerLength || ''}"
                        data-marker-plan-matrix-row-length="true"
                        data-bed-id="${escapeHtml(bed.bedId)}"
                        data-row-id="${escapeHtml(row.rowId)}"
                        class="h-8 w-24 rounded-md border bg-card px-2 text-center text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="m"
                      />
                    </td>
                  ` : ''}
                  <td class="px-3 py-3 font-medium">${formatCount(rowTotal)}</td>
                </tr>
              `
            }).join('')}
          </tbody>
          <tfoot class="border-t bg-muted/20 text-xs font-medium">
            <tr>
              ${highLowMode ? '<td class="px-3 py-3 text-left">—</td>' : ''}
              <td class="px-3 py-3 text-left">累计层数&累计件数</td>
              <td class="px-3 py-3 text-left text-muted-foreground">按尺码列累计</td>
              ${sizeColumns.map((size) => `<td class="px-3 py-3"><div>${formatCount(layerTotals[size] || 0)} 层</div><div class="mt-1 text-[10px] text-muted-foreground">${formatCount(pieceTotals[size] || 0)} 件</div></td>`).join('')}
              ${highLowMode ? '<td class="px-3 py-3">—</td>' : ''}
              <td class="px-3 py-3">${formatCount(Object.values(pieceTotals).reduce((total, value) => total + value, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      ${errors.length ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">${errors.map((error) => escapeHtml(error)).join('；')}</div>` : ''}
      <div>
        ${renderActionButton('添加颜色层行', `data-marker-plan-action="add-matrix-row" data-bed-id="${escapeHtml(bed.bedId)}"`)}
      </div>
    </div>
  `
}

function renderSchemeBedEditor(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  void context
  const scheme = buildMarkerSchemeFromPlan(plan)
  const beds = scheme.beds
  return `
    <section class="space-y-4 rounded-xl border bg-card p-4" data-testid="marker-scheme-bed-editor">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">唛架编号</h3>
        <div class="flex flex-wrap gap-2">
          ${renderActionButton('新增普通模式', 'data-marker-plan-action="add-scheme-bed" data-bed-mode="normal"')}
          ${renderActionButton('新增高低层模式', 'data-marker-plan-action="add-scheme-bed" data-bed-mode="high_low"')}
          ${renderActionButton('新增对折普通模式', 'data-marker-plan-action="add-scheme-bed" data-bed-mode="fold_normal"')}
          ${renderActionButton('新增对折高低层模式', 'data-marker-plan-action="add-scheme-bed" data-bed-mode="fold_high_low"')}
        </div>
      </div>
      <div class="space-y-4">
        ${beds.length
          ? beds.map((bed) => `
            <article class="space-y-3 rounded-lg border bg-background p-3">
              <div class="grid gap-3 ${isHighLowMatrixMode(bed.bedMode) ? 'lg:grid-cols-[160px_180px_minmax(0,1fr)_120px]' : 'lg:grid-cols-[160px_180px_minmax(0,1fr)_120px_120px]'}">
                <label class="space-y-2">
                  <span class="text-xs font-medium text-muted-foreground">唛架编号</span>
                  <input type="text" value="${escapeHtml(bed.bedNo)}" data-marker-plan-bed-field="bedNo" data-bed-id="${escapeHtml(bed.bedId)}" class="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label class="space-y-2">
                  <span class="text-xs font-medium text-muted-foreground">唛架模式</span>
                  <select data-marker-plan-bed-field="bedMode" data-bed-id="${escapeHtml(bed.bedId)}" class="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                    ${getMarkerBedModeOptions().map((mode) => `<option value="${mode}" ${bed.bedMode === mode ? 'selected' : ''}>${escapeHtml(markerPlanModeMeta[mode].label)}</option>`).join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-xs font-medium text-muted-foreground">备注</span>
                  <input type="text" value="${escapeHtml(bed.remark || '')}" data-marker-plan-bed-field="remark" data-bed-id="${escapeHtml(bed.bedId)}" class="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                ${isHighLowMatrixMode(bed.bedMode) ? '' : `
                  <label class="space-y-2">
                    <span class="text-xs font-medium text-muted-foreground">唛架净长度</span>
                    <input type="number" min="0" step="0.01" value="${bed.markerLength || ''}" data-marker-plan-bed-field="markerLength" data-bed-id="${escapeHtml(bed.bedId)}" class="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                  </label>
                `}
                <div class="flex items-end gap-2">
                  ${renderActionButton('复制', `data-marker-plan-action="copy-scheme-bed" data-bed-id="${escapeHtml(bed.bedId)}"`)}
                  ${renderActionButton('删除', `data-marker-plan-action="remove-scheme-bed" data-bed-id="${escapeHtml(bed.bedId)}"`, 'ghost')}
                </div>
              </div>
              <div class="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                ${renderReadonlyField('床次', `${formatCount(bed.bedSortOrder || 1)}`)}
                ${renderReadonlyField('计划层数', `${formatNumber(bed.plannedLayerCount, 0)} 层`)}
                ${renderReadonlyField('计划数量', `${formatCount(bed.plannedGarmentQty)} 件`)}
                ${renderReadonlyField('计划用量', `${formatNumber(bed.spreadTotalLength, 2)} m`)}
                ${renderReadonlyField('单件成衣用量', `${formatNumber(bed.unitFabricUsage, 3)} m/件`)}
                ${renderReadonlyField('是否生成铺布单', '否，待生成铺布单')}
              </div>
              ${renderMarkerMatrixEditor(plan, bed)}
            </article>
          `).join('')
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-xs text-muted-foreground">当前还没有唛架编号。</div>'}
      </div>
    </section>
  `
}

const markerPlanDetailTabs: Array<{ key: MarkerPlanDetailTabKey; label: string; description: string }> = [
  { key: 'overview', label: '概览', description: '当前事实' },
  { key: 'source-cut-orders', label: '来源裁片单', description: '裁片单 / 可用库存' },
  { key: 'beds', label: '唛架配置', description: '床次 / 阶梯 / 矩阵' },
  { key: 'material', label: '物料明细', description: '面料 / 纸样 / 用量' },
  { key: 'spreading', label: '铺布流转', description: '后续铺布单' },
  { key: 'demand', label: '需求匹配', description: '差异 / 确认记录' },
  { key: 'system-log', label: '系统日志', description: '流转记录' },
]

function getMarkerPlanDetailActiveTab(): MarkerPlanDetailTabKey {
  const params = getCurrentSearchParams()
  const requestedTab = params.get('detailTab') as MarkerPlanDetailTabKey | null
  if (markerPlanDetailTabs.some((tab) => tab.key === requestedTab)) return requestedTab as MarkerPlanDetailTabKey

  const legacyTab = params.get('tab')
  if (legacyTab === 'layout') return 'beds'
  if (legacyTab === 'explosion') return 'demand'
  if (legacyTab === 'basic') return 'source-cut-orders'
  return 'overview'
}

function buildMarkerPlanDetailTabPath(plan: MarkerPlanViewRow, tab: MarkerPlanDetailTabKey): string {
  return buildRouteWithQuery(buildDetailPath(plan.id), { detailTab: tab })
}

function renderMarkerPlanDetailMetric(label: string, value: string, tone: 'default' | 'blue' | 'emerald' | 'amber' = 'default'): string {
  const valueClass =
    tone === 'blue'
      ? 'text-blue-600'
      : tone === 'emerald'
        ? 'text-emerald-700'
        : tone === 'amber'
          ? 'text-amber-700'
          : 'text-foreground'
  return `
    <div class="rounded-lg border px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold ${valueClass}">${escapeHtml(value || '—')}</div>
    </div>
  `
}

function renderMarkerPlanDetailInfoGrid(items: Array<{ label: string; value: string; formula?: string; tone?: 'default' | 'strong' }>): string {
  return `
    <dl class="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
      ${items.map((item) => `
        <div class="border-l border-slate-200 pl-3">
          <dt class="text-xs text-muted-foreground">${escapeHtml(item.label)}</dt>
          <dd class="mt-1 ${item.tone === 'strong' ? 'text-sm font-semibold text-foreground' : 'text-sm text-foreground'}">
            ${escapeHtml(item.value || '—')}
          </dd>
          ${item.formula ? renderFormulaText(item.formula) : ''}
        </div>
      `).join('')}
    </dl>
  `
}

function renderMarkerPlanDetailSection(title: string, body: string, description = ''): string {
  return `
    <section class="rounded-xl border bg-card" data-marker-plan-detail-section="${escapeHtml(title)}">
      <div class="border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
          ${description ? `<span class="text-xs text-muted-foreground">${escapeHtml(description)}</span>` : ''}
        </div>
      </div>
      <div class="p-4">
        ${body}
      </div>
    </section>
  `
}

function getMarkerPlanSourceSummaryRows(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null) {
  const selectedRows = getSourceCutOrdersRows(plan)
  if (selectedRows.length) {
    return selectedRows.map((row) => ({
      sourceNo: row.cutOrderNo,
      productionOrderNo: row.productionOrderNo,
      materialText: [row.materialSku, row.materialColor].filter(Boolean).join(' / ') || plan.materialSkuSummary || '—',
      patternText: [row.patternFileName || row.patternFileId, row.patternVersion, row.effectiveWidthText].filter(Boolean).join(' / ') || '—',
      qtyText: `${formatNumber(row.availableQty, 2)} ${row.unit || '米'}`,
      statusText: '已纳入',
    }))
  }

  return plan.cutOrderNos.map((cutOrderNo, index) => {
    const sourceRow = context?.sourceCutOrderRows.find((row) => row.cutOrderNo === cutOrderNo) || context?.sourceCutOrderRows[index]
    return {
      sourceNo: cutOrderNo,
      productionOrderNo: plan.productionOrderNos[index] || plan.productionOrderNos[0] || sourceRow?.productionOrderNo || '—',
      materialText: [sourceRow?.materialSku || plan.materialSkuSummary, sourceRow?.materialColor || plan.colorSummary].filter(Boolean).join(' / ') || '—',
      patternText: [sourceRow?.patternFileName || sourceRow?.patternFileId, sourceRow?.patternVersion, sourceRow?.effectiveWidthText].filter(Boolean).join(' / ') || '—',
      qtyText: '—',
      statusText: '已纳入',
    }
  })
}

function renderMarkerPlanSourceSummaryTable(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  const rows = getMarkerPlanSourceSummaryRows(plan, context)
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">来源裁片单</th>
            <th class="px-3 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
            <th class="px-3 py-2 font-medium">可用库存</th>
            <th class="px-3 py-2 font-medium">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows.length
            ? rows.map((row) => `
              <tr>
                <td class="px-3 py-3 font-semibold text-blue-600">
                  ${escapeHtml(row.sourceNo || '—')}
                  <div class="mt-1 text-xs font-normal text-muted-foreground">${escapeHtml(row.materialText)}</div>
                </td>
                <td class="px-3 py-3">
                  ${renderProductionOrderIdentityCell(row.productionOrderNo || '—')}
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.patternText)}</div>
                </td>
                <td class="px-3 py-3 font-medium">${escapeHtml(row.qtyText)}</td>
                <td class="px-3 py-3">${renderStatusBadge(row.statusText, 'border-emerald-200 bg-emerald-50 text-emerald-700')}</td>
              </tr>
            `).join('')
            : '<tr><td colspan="4" class="px-3 py-8 text-center text-xs text-muted-foreground">暂无来源裁片单。</td></tr>'}
        </tbody>
      </table>
    </div>
  `
}

function renderMarkerPlanModeSummaryTable(plan: MarkerPlanViewRow): string {
  const beds = plan.beds || []
  const grouped = new Map<string, { label: string; count: number; plannedQty: number; length: number; readyCount: number }>()
  beds.forEach((bed) => {
    const key = bed.bedMode || plan.markerMode
    const modeKey = key as MarkerPlanModeKey
    const current = grouped.get(key) || {
      label: markerPlanModeMeta[modeKey]?.label || key,
      count: 0,
      plannedQty: 0,
      length: 0,
      readyCount: 0,
    }
    current.count += 1
    current.plannedQty += safeNumber(bed.plannedGarmentQty)
    current.length += getMarkerMatrixBedLengthSummary(bed)
    if (bed.readyForSpreading) current.readyCount += 1
    grouped.set(key, current)
  })
  const rows = Array.from(grouped.values())
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">模式</th>
            <th class="px-3 py-2 text-right font-medium">数量</th>
            <th class="px-3 py-2 text-right font-medium">计划件数</th>
            <th class="px-3 py-2 font-medium">状态</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows.length
            ? rows.map((row) => `
              <tr>
                <td class="px-3 py-3 font-medium">${escapeHtml(row.label)}</td>
                <td class="px-3 py-3 text-right">x${formatCount(row.count)}</td>
                <td class="px-3 py-3 text-right">${formatCount(row.plannedQty)} 件</td>
                <td class="px-3 py-3">${renderStatusBadge(row.readyCount === row.count ? '可交接' : '待确认', row.readyCount === row.count ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}</td>
              </tr>
            `).join('')
            : '<tr><td colspan="4" class="px-3 py-8 text-center text-xs text-muted-foreground">暂无唛架编号。</td></tr>'}
        </tbody>
      </table>
    </div>
  `
}

function renderMarkerPlanMetricCards(items: Array<{ label: string; value: string; formula?: string; tone?: 'default' | 'blue' | 'emerald' | 'amber' | 'rose' }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items.map((item) => {
        const valueClass =
          item.tone === 'blue'
            ? 'text-blue-600'
            : item.tone === 'emerald'
              ? 'text-emerald-700'
              : item.tone === 'amber'
                ? 'text-amber-700'
                : item.tone === 'rose'
                  ? 'text-rose-600'
                  : 'text-foreground'
        return `
          <article class="min-h-[5.25rem] rounded-lg border bg-background px-3 py-3">
            <div class="text-xs font-medium text-muted-foreground">${escapeHtml(item.label)}</div>
            <div class="mt-2 text-lg font-semibold leading-tight ${valueClass}">${escapeHtml(item.value || '—')}</div>
            ${item.formula ? `<div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(item.formula)}">${escapeHtml(item.formula)}</div>` : ''}
          </article>
        `
      }).join('')}
    </div>
  `
}

function renderMarkerPlanSystemLogTab(plan: MarkerPlanViewRow): string {
  return `
    <div class="space-y-4">
      ${renderMarkerPlanDetailSection('系统日志', `
        <div class="space-y-2 text-sm">
          ${plan.status === 'CANCELED'
            ? `<div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">作废原因：${escapeHtml(plan.voidReason || '未填写')}；作废人：${escapeHtml(plan.voidedBy || '—')}；作废时间：${escapeHtml(plan.voidedAt || '—')}</div>`
            : ''}
          ${(plan.operationLogs || []).length
            ? `<div class="rounded-lg border bg-background">
                ${(plan.operationLogs || []).map((log) => `
                  <div class="grid gap-2 border-b px-3 py-2 last:border-b-0 md:grid-cols-[8rem_minmax(0,1fr)_8rem_9rem]">
                    <div class="font-medium">${escapeHtml(log.action)}</div>
                    <div class="text-muted-foreground">${escapeHtml(log.detail)}</div>
                    <div class="text-muted-foreground">${escapeHtml(log.by)}</div>
                    <div class="text-muted-foreground">${escapeHtml(log.at)}</div>
                  </div>
                `).join('')}
              </div>`
            : '<div class="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无方案操作日志。</div>'}
        </div>
      `, '方案流转记录已移入系统日志，不再占用概览区域')}
    </div>
  `
}

function renderMarkerPlanMaterialTab(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  const rows = getMarkerPlanSourceSummaryRows(plan, context)
  return `
    <div class="space-y-4">
      ${renderMarkerPlanDetailSection('物料与纸样', `
        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div class="rounded-lg border bg-background px-3 py-3">
            ${renderMaterialIdentityBlock({
              materialSku: plan.materialSkuSummary || '—',
              materialLabel: plan.materialSkuSummary || '—',
              materialAlias: plan.materialAliasSummary || context?.materialAliasSummary || '',
              materialImageUrl: plan.materialImageUrl || context?.materialImageUrl || '',
            }, { compact: true })}
            <div class="mt-2 text-xs text-muted-foreground">颜色：${escapeHtml(plan.colorSummary || '—')}</div>
          </div>
          ${renderMarkerPlanDetailInfoGrid([
            { label: '技术包', value: getPlanTechPackText(plan), tone: 'strong' },
            { label: '来源裁片单', value: getPlanSourceNoText(plan) },
            { label: '唛架模式', value: buildMarkerSchemeFromPlan(plan as MarkerPlan).modeSummaryText || getPlanBedModeText(plan) },
            { label: '唛架净长度', value: `${formatNumber(plan.netLength, 2)} m` },
            { label: '捆条加工长度', value: `${formatNumber(plan.bindingStripReservedLength || 0, 2)} m` },
            { label: '物料总用量', value: `${formatNumber(plan.materialTotalUsageLength || plan.plannedSpreadLength, 2)} m`, tone: 'strong' },
          ])}
        </div>
      `)}
      ${renderMarkerPlanDetailSection('来源物料明细', `
        <div class="overflow-x-auto">
          <table class="min-w-[900px] w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">裁片单</th>
                <th class="px-3 py-2 font-medium">物料 / 颜色</th>
                <th class="px-3 py-2 font-medium">纸样 / 版本 / 幅宽</th>
                <th class="px-3 py-2 font-medium">数量状态</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${rows.length
                ? rows.map((row) => `
                  <tr>
                    <td class="px-3 py-3 font-semibold text-blue-600">${escapeHtml(row.sourceNo || '—')}</td>
                    <td class="px-3 py-3">${escapeHtml(row.materialText)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.patternText)}</td>
                    <td class="px-3 py-3">${escapeHtml(row.qtyText)}</td>
                  </tr>
                `).join('')
                : '<tr><td colspan="4" class="px-3 py-8 text-center text-xs text-muted-foreground">暂无来源物料明细。</td></tr>'}
            </tbody>
          </table>
        </div>
      `)}
    </div>
  `
}

function isMissingPrototypeText(value: string | undefined): boolean {
  return !value || /待补|暂无|未维护/.test(value)
}

function splitDisplayText(value: string | undefined): string[] {
  return String(value || '')
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeMaterialAliasText(value: string | undefined): string {
  return String(value || '')
    .replace(/技术包别名：/g, '')
    .replace(/待补\s*·\s*/g, '')
    .trim()
}

function getPlanModeSummaryText(plan: MarkerPlanViewRow): string {
  const bedModes = (plan.beds || [])
    .map((bed) => bed.bedMode)
    .filter(Boolean)
  const modeKeys = bedModes.length ? bedModes : [plan.markerMode]
  const counts = new Map<MarkerPlanModeKey, number>()
  modeKeys.forEach((mode) => counts.set(mode, (counts.get(mode) || 0) + 1))
  return Array.from(counts.entries())
    .map(([mode, count]) => `${markerPlanModeMeta[mode]?.label || mode}${count > 1 ? ` x${count}` : ''}`)
    .join(' / ')
}

function getPlanDisplayColors(plan: MarkerPlanViewRow, sourceRows: MarkerPlanSourceCutOrderRow[]): string {
  const candidates = [
    ...splitDisplayText(plan.colorSummary),
    ...sourceRows.flatMap((row) => [row.materialColor, row.colorCode]),
  ]
    .map((item) => String(item || '').trim())
    .filter((item) => item && !isMissingPrototypeText(item))
  if (candidates.length) return Array.from(new Set(candidates)).join(' / ')

  const sku = `${plan.materialSkuSummary} ${plan.sourceMaterialSku}`.toLowerCase()
  if (sku.includes('black')) return 'Black'
  if (sku.includes('charcoal')) return 'Charcoal'
  if (sku.includes('navy')) return 'Navy'
  if (sku.includes('khaki')) return 'Khaki'
  if (sku.includes('beige')) return 'Beige'
  if (sku.includes('cream')) return 'Cream'
  if (sku.includes('white')) return 'White'
  if (sku.includes('green')) return 'Green'
  return '主色'
}

function getPlanDisplayMaterialAlias(plan: MarkerPlanViewRow, sourceRows: MarkerPlanSourceCutOrderRow[]): string {
  const candidates = [
    ...splitDisplayText(plan.materialAliasSummary).map(normalizeMaterialAliasText),
    ...sourceRows.map((row) => normalizeMaterialAliasText(row.materialAlias)),
  ].filter((item) => item && !isMissingPrototypeText(item))
  if (candidates.length) return Array.from(new Set(candidates)).join(' / ')

  const sku = `${plan.materialSkuSummary} ${plan.sourceMaterialSku}`.toLowerCase()
  if (sku.includes('lining')) return '里布'
  if (sku.includes('black-stretch-twill')) return '弹力斜纹主面料'
  if (sku.includes('charcoal-stretch-twill')) return '炭灰弹力斜纹'
  if (sku.includes('navy-twill')) return '海军蓝斜纹'
  if (sku.includes('khaki-canvas')) return '卡其帆布'
  if (sku.includes('wool') || sku.includes('毛织')) return '毛织用纱线'
  return '主面料'
}

function getColorSwatchHex(colorText: string): string {
  const normalized = colorText.toLowerCase()
  if (normalized.includes('black')) return '#1f2937'
  if (normalized.includes('charcoal')) return '#374151'
  if (normalized.includes('navy')) return '#1e3a8a'
  if (normalized.includes('khaki')) return '#b79b63'
  if (normalized.includes('beige')) return '#d8c7a3'
  if (normalized.includes('cream')) return '#f3e6c8'
  if (normalized.includes('white')) return '#f8fafc'
  if (normalized.includes('green')) return '#2f855a'
  return '#64748b'
}

function buildFabricSwatchDataUrl(colorText: string): string {
  const base = getColorSwatchHex(colorText)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" fill="${base}"/>
      <path d="M0 18H96M0 38H96M0 58H96M0 78H96" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
      <path d="M18 0V96M38 0V96M58 0V96M78 0V96" stroke="rgba(0,0,0,.16)" stroke-width="2"/>
      <path d="M-16 96L96 -16M16 112L112 16" stroke="rgba(255,255,255,.18)" stroke-width="3"/>
    </svg>
  `.trim()
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function getPlanMaterialImageUrl(plan: MarkerPlanViewRow, colorText: string): string {
  const imageUrl = plan.materialImageUrl || ''
  if (imageUrl && !imageUrl.includes('/placeholder.svg') && !imageUrl.startsWith('data:image/svg')) return imageUrl
  return buildFabricSwatchDataUrl(colorText)
}

function getPlanStyleImageUrl(plan: MarkerPlanViewRow): string {
  const text = `${plan.spuCode} ${plan.styleName}`.toLowerCase()
  if (text.includes('cardigan') || text.includes('rajut') || text.includes('sweater')) return '/cardigan-sample.jpg'
  if (text.includes('jogger') || text.includes('celana') || text.includes('pants')) return '/pants-sample.jpg'
  if (text.includes('hoodie') || text.includes('jacket') || text.includes('jas') || text.includes('vest') || text.includes('rompi')) return '/jacket-sample.jpg'
  if (text.includes('dress') || text.includes('blus')) return '/dress-sample-1.jpg'
  if (text.includes('shirt') || text.includes('kemeja')) return '/shirt-sample.jpg'
  return '/tshirt-sample.jpg'
}

function renderPlanStyleIdentity(plan: MarkerPlanViewRow): string {
  const imageUrl = getPlanStyleImageUrl(plan)
  return `
    <div class="flex min-w-0 items-start gap-2">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(plan.spuCode || plan.styleName || 'SPU图片')}" class="h-12 w-12 shrink-0 rounded-md border bg-slate-50 object-cover" loading="lazy" />
      <div class="min-w-0">
        ${renderProductionOrderIdentityCell(plan.productionOrderSummary || '—')}
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${plan.styleCode || '-'} / ${plan.spuCode || '-'}`)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(plan.styleName || '—')}</div>
      </div>
    </div>
  `
}

function getPlanLockShortLabel(plan: MarkerPlanViewRow): string {
  return plan.isCrossTask ? '跨任务' : '单任务'
}

function getPlanLockShortDetail(plan: MarkerPlanViewRow): string {
  const taskCount = plan.cuttingTaskNos?.length || 1
  return plan.isCrossTask ? `${formatCount(taskCount)} 个任务` : '无需锁定'
}

function getPlanAssigneeShortText(plan: MarkerPlanViewRow): string {
  const factories = Array.from(new Set((plan.cuttingTaskAssigneeFactoryNames || []).filter(Boolean)))
  if (!factories.length || plan.executionRoute === 'UNASSIGNED') return '待分配'
  return plan.isCrossTask ? `同厂：${factories.join(' / ')}` : factories.join(' / ')
}

function renderMarkerPlanDetailHeader(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  const scheme = buildMarkerSchemeFromPlan(plan as MarkerPlan)
  const matchSummary = getPlanDemandMatchSummary(plan)
  const matchMeta = getDemandMatchStatusMeta(matchSummary.status)
  const confirmationMeta = getConfirmationStatusMeta(plan.confirmationStatus)
  const spreadingOrders = getSpreadingOrdersForMarkerPlan(plan.id)
  const sourceSummary = getSourceCutOrdersSummary(plan)
  const sourceRows = getMarkerPlanSourceSummaryRows(plan, context)
  const sourceCount = sourceRows.length || plan.cutOrderNos.length
  const taskCount = plan.cuttingTaskNos?.length || 0
  return `
    <section class="rounded-xl border bg-card p-5" data-testid="marker-plan-detail-header">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm text-muted-foreground">唛架方案详情</p>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold text-foreground">唛架方案 / ${escapeHtml(plan.markerNo)}</h1>
            ${renderStatusBadge(markerPlanStatusMeta[plan.status].label, markerPlanStatusMeta[plan.status].className)}
            ${renderStatusBadge(confirmationMeta.label, confirmationMeta.className)}
            ${renderStatusBadge(matchMeta.label, matchMeta.className)}
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            ${escapeHtml(plan.spuCode || plan.styleCode || '—')} · ${escapeHtml(plan.productionOrderNos.join(' / ') || '—')} · ${escapeHtml(getPlanTechPackText(plan))}
          </p>
        </div>
        <div class="shrink-0">
          ${renderPlanHeaderActions('DETAIL', plan)}
        </div>
      </div>
      <div class="mt-5 grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
        ${renderMarkerPlanDetailMetric('唛架数量', `${formatCount(scheme.bedCount)} 个`, scheme.bedCount ? 'blue' : 'default')}
        ${renderMarkerPlanDetailMetric('来源裁片单', `${formatCount(sourceCount)} 个`, sourceCount ? 'blue' : 'amber')}
        ${renderMarkerPlanDetailMetric('唛架模式', scheme.modeSummaryText || getPlanBedModeText(plan), 'default')}
        ${renderMarkerPlanDetailMetric('方案衣片件数', `${formatCount(plan.totalPieces)} 件`, 'default')}
        ${renderMarkerPlanDetailMetric('物料总用量', `${formatNumber(plan.materialTotalUsageLength || plan.plannedSpreadLength, 2)} m`, 'default')}
        ${renderMarkerPlanDetailMetric('铺布单', spreadingOrders.length ? `${formatCount(spreadingOrders.length)} 张` : '待生成', spreadingOrders.length ? 'emerald' : 'amber')}
      </div>
      <div class="mt-5 grid gap-4 border-t pt-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div class="rounded-lg border bg-muted/20 px-3 py-3">
          <div class="mb-2 text-xs font-medium text-muted-foreground">面料 / 纸样</div>
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              ${renderMaterialIdentityBlock({
                materialSku: plan.materialSkuSummary || '—',
                materialLabel: plan.materialSkuSummary || '—',
                materialAlias: plan.materialAliasSummary || context?.materialAliasSummary || '',
                materialImageUrl: plan.materialImageUrl || context?.materialImageUrl || '',
              }, { compact: true })}
              <div class="mt-1 text-xs text-muted-foreground">颜色：${escapeHtml(plan.colorSummary || '—')}</div>
            </div>
            <div class="rounded-md bg-background px-3 py-2 text-sm">
              <div class="text-xs text-muted-foreground">纸样 / 技术包</div>
              <div class="mt-1 font-medium">${escapeHtml(getPlanTechPackText(plan))}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(scheme.modeSummaryText || getPlanBedModeText(plan))}</div>
            </div>
          </div>
        </div>
        ${renderMarkerPlanDetailInfoGrid([
          { label: '来源裁片任务', value: plan.cuttingTaskNos?.join(' / ') || '—', tone: taskCount > 1 ? 'strong' : undefined },
          { label: '来源裁片单', value: getPlanSourceNoText(plan), tone: 'strong' },
          { label: '承接方锁定', value: plan.taskLockSummary || '—', tone: plan.isCrossTask ? 'strong' : undefined },
          { label: '来源可用库存', value: sourceSummary.availableQtyText },
          { label: '执行去向', value: plan.executionRouteLabel || '待分配承接方' },
          { label: '最近更新', value: plan.updatedAt || plan.createdAt || '—' },
          { label: '创建人', value: plan.createdBy || '—' },
          { label: '更新人', value: plan.updatedBy || '—' },
        ])}
      </div>
    </section>
  `
}

function renderMarkerPlanDetailTabs(plan: MarkerPlanViewRow, activeTab: MarkerPlanDetailTabKey): string {
  return `
    <nav class="flex flex-wrap gap-2 rounded-xl border bg-card p-2" aria-label="唛架方案详情页签" data-testid="marker-plan-detail-tabs">
      ${markerPlanDetailTabs.map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            type="button"
            class="rounded-md px-3 py-2 text-left text-sm font-medium transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            data-nav="${escapeHtml(buildMarkerPlanDetailTabPath(plan, tab.key))}"
            aria-current="${active ? 'page' : 'false'}"
          >
            <span class="block">${escapeHtml(tab.label)}</span>
            <span class="mt-0.5 block text-[11px] font-normal opacity-80">${escapeHtml(tab.description)}</span>
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderMarkerPlanOverviewTab(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  const scheme = buildMarkerSchemeFromPlan(plan as MarkerPlan)
  const matchSummary = getPlanDemandMatchSummary(plan)
  return `
    <div class="space-y-4">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.85fr)]">
        ${renderMarkerPlanDetailSection('核心信息', renderMarkerPlanDetailInfoGrid([
          { label: '方案编号', value: plan.markerNo, tone: 'strong' },
          { label: '来源类型', value: getPlanSourceTypeText(plan) },
          { label: '来源裁片任务', value: plan.cuttingTaskNos?.join(' / ') || '—', tone: plan.isCrossTask ? 'strong' : undefined },
          { label: '来源裁片单', value: getPlanSourceNoText(plan) },
          { label: '来源生产单', value: plan.productionOrderNos.join(' / ') || '—' },
          { label: '承接方锁定', value: plan.taskLockSummary || '—', tone: plan.isCrossTask ? 'strong' : undefined },
          { label: '执行去向', value: plan.executionRouteLabel || '待分配承接方', tone: plan.executionRoute === 'OWN_CUTTING' ? 'strong' : undefined },
          { label: '款号 / SPU', value: `${plan.styleCode || '-'} / ${plan.spuCode || '-'}` },
          { label: '技术包', value: getPlanTechPackText(plan) },
          { label: '面料 / 颜色', value: `${plan.materialSkuSummary || '—'} / ${plan.colorSummary || '—'}` },
          { label: '唛架模式', value: scheme.modeSummaryText || getPlanBedModeText(plan), tone: 'strong' },
          { label: '业务确认', value: plan.confirmationStatus || '待确认' },
        ]))}
        <div class="space-y-4">
          ${renderMarkerPlanDetailSection('来源裁片单明细', renderMarkerPlanSourceSummaryTable(plan, context), '按来源裁片单汇总')}
          ${renderMarkerPlanDetailSection('唛架模式明细', renderMarkerPlanModeSummaryTable(plan), '按唛架模式汇总')}
        </div>
      </div>
      ${renderMarkerPlanDetailSection('计划数量与用量', renderMarkerPlanMetricCards([
        { label: '唛架数量', value: `${formatCount(scheme.bedCount)} 个` },
        { label: '已完成唛架', value: getPlanBedCountText(plan) },
        { label: '唛架净长度', value: `${formatNumber(plan.netLength, 2)} m` },
        { label: '方案成衣件数', value: `${formatCount(plan.totalPieces)} 件`, formula: plan.totalPiecesFormula },
        { label: '系统单件成衣用量', value: `${formatNumber(plan.systemUnitUsage, 3)} m/件`, formula: plan.systemUnitUsageFormula },
        { label: '最终单件成衣用量', value: `${formatNumber(plan.finalUnitUsage, 3)} m/件`, formula: plan.finalUnitUsageFormula },
        { label: '计划铺布总长度', value: `${formatNumber(plan.plannedSpreadLength, 2)} m`, formula: plan.plannedSpreadLengthFormula },
        { label: '捆条加工长度', value: `${formatNumber(plan.bindingStripReservedLength || 0, 2)} m`, formula: plan.bindingStripReservedLengthFormula },
        { label: '物料总用量', value: `${formatNumber(plan.materialTotalUsageLength || plan.plannedSpreadLength, 2)} m`, formula: plan.materialTotalUsageLengthFormula, tone: 'blue' },
        { label: '需求匹配结果', value: matchSummary.status, tone: matchSummary.status === '有差异' ? 'amber' : 'emerald' },
        { label: '差异合计', value: `${formatSignedCount(matchSummary.diffTotalQty)} 件`, tone: matchSummary.diffTotalQty ? 'amber' : 'default' },
      ]))}
      ${renderMarkerPlanDetailSection('关联入口', `
        <div class="flex flex-wrap gap-2">
          ${(plan.cuttingTaskNos || []).map((taskNo, index) =>
            renderTopInfoChip(
              `裁片任务 ${taskNo}`,
              `data-marker-plan-action="go-production-progress" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || plan.productionOrderIds[0] || '')}" data-production-order-no="${escapeHtml(plan.productionOrderNos[index] || plan.productionOrderNos[0] || '')}" data-style-code="${escapeHtml(plan.styleCode || '')}" data-spu-code="${escapeHtml(plan.spuCode || '')}" data-marker-plan-id="${escapeHtml(plan.markerPlanId || '')}" data-marker-plan-no="${escapeHtml(plan.markerPlanNo || '')}"`,
              'blue',
            ),
          ).join('')}
          ${plan.cutOrderNos.map((cutOrderNo, index) =>
            renderTopInfoChip(
              `裁片单 ${cutOrderNo}`,
              `data-marker-plan-action="go-cut-orders" data-cut-order-id="${escapeHtml(plan.cutOrderIds[index] || '')}" data-cut-order-no="${escapeHtml(cutOrderNo)}" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || plan.productionOrderIds[0] || '')}" data-production-order-no="${escapeHtml(plan.productionOrderNos[index] || plan.productionOrderNos[0] || '')}"`,
            ),
          ).join('')}
          ${plan.productionOrderNos.map((productionOrderNo, index) =>
            renderTopInfoChip(
              `生产单 ${productionOrderNo}`,
              `data-marker-plan-action="go-production-progress" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || '')}" data-production-order-no="${escapeHtml(productionOrderNo)}" data-style-code="${escapeHtml(plan.styleCode || '')}" data-spu-code="${escapeHtml(plan.spuCode || '')}" data-material-sku="${escapeHtml(plan.sourceMaterialSku || '')}" data-cut-order-id="${escapeHtml(plan.cutOrderIds[index] || '')}" data-cut-order-no="${escapeHtml(plan.cutOrderNos[index] || '')}" data-marker-plan-id="${escapeHtml(plan.markerPlanId || '')}" data-marker-plan-no="${escapeHtml(plan.markerPlanNo || '')}"`,
              'emerald',
            ),
          ).join('')}
        </div>
        <div class="mt-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          方案流转记录已移入「系统日志」页签，概览仅保留业务摘要和关联入口。
        </div>
      `)}
    </div>
  `
}

function renderMarkerPlanSourceCutOrdersTab(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  const selectedRows = getSourceCutOrdersRows(plan)
  const sourceRows = selectedRows.length
    ? selectedRows.map((row) => ({
        cutOrderNo: row.cutOrderNo,
        productionOrderNo: row.productionOrderNo,
        spuCode: row.spuCode || plan.spuCode || '—',
        materialSku: row.materialSku || plan.materialSkuSummary || '—',
        materialColor: row.materialColor || plan.colorSummary || '—',
        patternFileName: row.patternFileName || row.patternFileId || '—',
        patternVersion: row.patternVersion || '—',
        effectiveWidthText: row.effectiveWidthText || '—',
        availableQty: row.availableQty,
        unit: row.unit || '米',
        historyCombinationGroup: row.historyCombinationGroup || '新组合',
      }))
    : plan.cutOrderNos.map((cutOrderNo, index) => {
        const sourceRow = context?.sourceCutOrderRows.find((row) => row.cutOrderNo === cutOrderNo) || context?.sourceCutOrderRows[index]
        return {
          cutOrderNo,
          productionOrderNo: plan.productionOrderNos[index] || plan.productionOrderNos[0] || sourceRow?.productionOrderNo || '—',
          spuCode: plan.spuCode || sourceRow?.spuCode || '—',
          materialSku: plan.materialSkuSummary || sourceRow?.materialSku || '—',
          materialColor: plan.colorSummary || sourceRow?.materialColor || '—',
          patternFileName: sourceRow?.patternFileName || sourceRow?.patternFileId || '—',
          patternVersion: sourceRow?.patternVersion || context?.techPackStatusLabel || getPlanTechPackText(plan),
          effectiveWidthText: sourceRow?.effectiveWidthText || '—',
          availableQty: null as number | null,
          unit: sourceRow?.materialUnit || '米',
          historyCombinationGroup: plan.markerPlanGroupKey || '新组合',
        }
      })
  const productionOrderCount = new Set(sourceRows.map((row) => row.productionOrderNo).filter(Boolean)).size || plan.productionOrderNos.length
  return `
    <div class="space-y-4">
      ${renderMarkerPlanDetailSection('来源裁片单', `
        ${renderMarkerPlanDetailInfoGrid([
          { label: '裁片单范围', value: getPlanSourceTypeText(plan), tone: 'strong' },
          { label: '来源裁片单', value: getPlanSourceNoText(plan) },
          { label: '来源生产单', value: plan.productionOrderNos.join(' / ') || '—' },
          { label: 'SPU / 款式', value: `${plan.spuCode || '-'} / ${plan.styleName || '-'}` },
          { label: '技术包', value: context?.techPackStatusLabel || getPlanTechPackText(plan) },
          { label: '是否跨生产单', value: productionOrderCount > 1 ? `是，${productionOrderCount} 个生产单` : '否' },
        ])}
        <div class="mt-4 overflow-x-auto rounded-lg border bg-background">
          <table class="min-w-[1040px] w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">裁片单</th>
                <th class="px-3 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / SPU</th>
                <th class="px-3 py-2 font-medium">面料 / 颜色</th>
                <th class="px-3 py-2 font-medium">纸样 / 幅宽</th>
                <th class="px-3 py-2 text-right font-medium">可用余额</th>
                <th class="px-3 py-2 font-medium">组合组</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${sourceRows.length
                ? sourceRows.map((row) => `
                  <tr>
                    <td class="px-3 py-3 font-semibold text-blue-600">${escapeHtml(row.cutOrderNo)}</td>
                    <td class="px-3 py-3">
                      ${renderProductionOrderIdentityCell(row.productionOrderNo)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.spuCode || plan.spuCode || '—')}</div>
                    </td>
                    <td class="px-3 py-3">
                      <div>${escapeHtml(row.materialSku)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialColor || plan.colorSummary || '—')}</div>
                    </td>
                    <td class="px-3 py-3">
                      <div>${escapeHtml(row.patternFileName || '—')}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.patternVersion || '—')} / ${escapeHtml(row.effectiveWidthText || '—')}</div>
                    </td>
                    <td class="px-3 py-3 text-right">${row.availableQty === null ? '—' : `${formatNumber(row.availableQty, 2)} ${escapeHtml(row.unit)}`}</td>
                    <td class="px-3 py-3">${escapeHtml(row.historyCombinationGroup || '新组合')}</td>
                  </tr>
                `).join('')
                : '<tr><td colspan="6" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无来源裁片单清单。</td></tr>'}
            </tbody>
          </table>
        </div>
      `)}
    </div>
  `
}

function renderMarkerPlanDetailTabContent(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate | null,
  activeTab: MarkerPlanDetailTabKey,
): string {
  if (activeTab === 'source-cut-orders') return renderMarkerPlanSourceCutOrdersTab(plan, context)
  if (activeTab === 'beds') return renderLayoutReadonlyTab(plan)
  if (activeTab === 'material') return renderMarkerPlanMaterialTab(plan, context)
  if (activeTab === 'spreading') return renderMarkerPlanSpreadingOrders(plan)
  if (activeTab === 'demand') return renderDemandMatchStep(plan, context, true)
  if (activeTab === 'system-log') return renderMarkerPlanSystemLogTab(plan)
  return renderMarkerPlanOverviewTab(plan, context)
}

function renderMarkerPlanDetailPanel(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  const activeTab = getMarkerPlanDetailActiveTab()
  return `
    <article class="space-y-4" data-testid="marker-plan-detail-panel">
      ${renderMarkerPlanDetailHeader(plan, context)}
      ${renderMarkerPlanDetailTabs(plan, activeTab)}
      ${renderMarkerPlanDetailTabContent(plan, context, activeTab)}
    </article>
  `
}

function renderListTabs(listTab: MarkerPlanListTab, viewModel = getViewModel()): string {
  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-3" data-testid="marker-plan-list-tabs">
      <div class="flex flex-wrap gap-2">
        ${buildMarkerPlanListTabOptions(viewModel)
          .map(
            (tab) => `
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm leading-5 ${listTab === tab.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                data-marker-plan-action="switch-list-tab"
                data-list-tab="${tab.value}"
              >
                ${escapeHtml(tab.label)} <span class="ml-1 font-semibold">${tab.count}</span>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function getListFilterLabels(): string[] {
  const labels: string[] = [`视图：${getListTabMeta(state.listTab).label}`]
  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.contextNo) labels.push(`裁片单号：${state.filters.contextNo}`)
  if (state.filters.markerNo) labels.push(`方案编号：${state.filters.markerNo}`)
  if (state.filters.contextType !== 'ALL') {
    const option = buildMarkerPlanContextTypeOptions().find((item) => item.value === state.filters.contextType)
    if (option) labels.push(`裁片单范围：${option.label}`)
  }
  if (state.filters.mode !== 'ALL') labels.push(`唛架模式：${markerPlanModeMeta[state.filters.mode].label}`)
  if (state.filters.status !== 'ALL') labels.push(`主状态：${markerPlanStatusMeta[state.filters.status].label}`)
  if (state.filters.ready === 'YES') labels.push('可交接铺布：是')
  if (state.filters.ready === 'NO') labels.push('可交接铺布：否')
  return labels
}

function renderListStateBar(): string {
  const labels = getListFilterLabels()
  if (labels.length <= 1) return ''

  return `
    <div data-testid="marker-plan-list-state-bar">
      ${renderWorkbenchStateBar({
        summary: '当前视图条件',
        chips: labels.map((label, index) =>
          renderWorkbenchFilterChip(
            label,
            index === 0
              ? `data-marker-plan-action="switch-list-tab" data-list-tab="${state.listTab}"`
              : 'data-marker-plan-action="reset-filters"',
            index === 0 ? 'amber' : 'blue',
          ),
        ),
        clearAttrs: 'data-marker-plan-action="reset-list-view"',
      })}
    </div>
  `
}

function filterPlans(rows: MarkerPlanViewRow[], tab: MarkerPlanListTab): MarkerPlanViewRow[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  const contextNo = state.filters.contextNo.trim().toLowerCase()
  const markerNo = state.filters.markerNo.trim().toLowerCase()
  return rows.filter((row) => {
    if (tab === 'WAITING_LAYOUT' && row.layoutStatus === 'done') return false
    if (tab === 'DEMAND_DIFF' && (row.demandMatchSummary.status === '已匹配' || row.demandMatchSummary.status === '待编辑唛架')) return false
    if (tab === 'WAITING_CONFIRM' && !(row.layoutStatus === 'done' && row.confirmationStatus !== '已确认')) return false
    if (tab === 'READY_FOR_SPREADING' && !row.readyForSpreading) return false
    if (tab === 'EXCEPTIONS' && !hasPlanExceptionIssue(row)) return false
    if (contextNo) {
      const contextKeywords = [row.contextNo, row.markerPlanNo, ...row.cutOrderNos]
        .filter(Boolean)
        .map((item) => item.toLowerCase())
      if (!contextKeywords.some((item) => item.includes(contextNo))) return false
    }
    if (markerNo && !row.markerNo.toLowerCase().includes(markerNo)) return false
    if (state.filters.contextType !== 'ALL' && row.contextType !== state.filters.contextType) return false
    if (state.filters.mode !== 'ALL' && row.markerMode !== state.filters.mode) return false
    if (state.filters.status !== 'ALL' && row.status !== state.filters.status) return false
    if (state.filters.ready === 'YES' && !row.readyForSpreading) return false
    if (state.filters.ready === 'NO' && row.readyForSpreading) return false
    if (!keyword) return true
    const keywords = [
      row.markerNo,
      row.contextNo,
      row.productionOrderSummary,
      row.styleCode,
      row.spuCode,
      row.styleName,
      row.materialSkuSummary,
      row.colorSummary,
      row.markerPlanNo,
      ...row.cutOrderNos,
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase())
    return keywords.some((item) => item.includes(keyword))
  })
}

function renderListFilters(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(16rem,auto)] xl:items-end">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">搜索</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            data-marker-plan-filter-field="keyword"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">主状态</span>
          <select data-marker-plan-filter-field="status" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">全部</option>
            ${(Object.keys(markerPlanStatusMeta) as MarkerPlanStatusKey[])
              .map((key) => `<option value="${key}" ${key === state.filters.status ? 'selected' : ''}>${escapeHtml(markerPlanStatusMeta[key].label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">裁片单号</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.contextNo)}"
            data-marker-plan-filter-field="contextNo"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">方案编号</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.markerNo)}"
            data-marker-plan-filter-field="markerNo"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div class="flex flex-wrap items-end gap-2 xl:justify-end">
          <button type="button" class="h-10 min-w-[8rem] rounded-md border px-3 text-sm hover:bg-muted" data-marker-plan-action="reset-filters">重置筛选</button>
          <details class="relative" data-testid="marker-plan-more-filters">
            <summary class="flex h-10 min-w-[8rem] cursor-pointer list-none items-center justify-center rounded-md border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted">更多筛选</summary>
            <div class="absolute right-0 z-20 mt-2 w-[min(42rem,calc(100vw-3rem))] rounded-md border bg-background p-3 shadow-lg">
              <div class="grid gap-3 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">唛架模式</span>
                  <select data-marker-plan-filter-field="mode" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ALL">全部</option>
                    ${buildMarkerPlanModeOptions().map((option) => `<option value="${option.value}" ${option.value === state.filters.mode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">可交接铺布</span>
                  <select data-marker-plan-filter-field="ready" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ALL">全部</option>
                    <option value="YES" ${state.filters.ready === 'YES' ? 'selected' : ''}>是</option>
                    <option value="NO" ${state.filters.ready === 'NO' ? 'selected' : ''}>否</option>
                  </select>
                </label>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  `, '', 'data-testid="marker-plan-list-filters"')
}

function renderStats(viewModel = getViewModel(), plans = viewModel.plans): string {
  const coveredContextCount = new Set(plans.map((plan) => plan.contextNo).filter(Boolean)).size
  const readyCount = plans.filter((plan) => plan.readyForSpreading).length
  const diffCount = getPlanListTabCount('DEMAND_DIFF', plans)
  const crossTaskCount = plans.filter((plan) => plan.isCrossTask).length
  const ownRouteCount = plans.filter((plan) => plan.executionRoute === 'OWN_CUTTING').length
  const pdaRouteCount = plans.filter((plan) => plan.executionRoute === 'FACTORY_PDA').length
  return renderCompactKpiGroup(`
      ${renderCompactKpiCard('裁片任务覆盖', coveredContextCount, `当前方案 ${plans.length}`, 'text-slate-900', `全量待排 ${viewModel.pendingContexts.length} 个裁片单上下文`)}
      ${renderCompactKpiCard('跨任务方案', crossTaskCount, '锁定同一承接方', 'text-blue-600', `${crossTaskCount} 个方案`)}
      ${renderCompactKpiCard('我方执行', ownRouteCount, `可交接 ${readyCount}`, 'text-emerald-600', `${ownRouteCount} 个方案进入 PFOS 链路`)}
      ${renderCompactKpiCard('三方 PDA', pdaRouteCount, `差异 ${diffCount}`, 'text-amber-600', `${pdaRouteCount} 个方案不生成我方铺布单`)}
    `, '', 'data-testid="marker-plan-list-stats"')
}

function renderPlanRowsTable(rows: MarkerPlanViewRow[], exceptionOnly = false): string {
  const tableTitle = exceptionOnly ? '异常待处理方案' : '唛架方案'
  const countText = `共 ${rows.length} 个方案`
  return `
    <section class="rounded-lg border bg-card [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2" data-testid="${exceptionOnly ? 'marker-plan-exception-list' : 'marker-plan-list-table'}" data-marker-plan-main-card="true">
      <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">${tableTitle}</h2>
        </div>
        <div class="text-xs text-muted-foreground">${countText}</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="w-full table-fixed text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="w-[10rem] px-2 py-1 font-medium">唛架方案</th>
              <th class="w-[10rem] px-2 py-1 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / SPU</th>
              <th class="w-[15rem] px-2 py-1 font-medium">面料 / 纸样</th>
              <th class="w-[10rem] px-2 py-1 font-medium">来源任务 / 裁片单</th>
              <th class="w-[9rem] px-2 py-1 font-medium">承接方锁定</th>
              <th class="w-[8rem] px-2 py-1 font-medium">执行去向</th>
              <th class="w-[8rem] px-2 py-1 font-medium">计划数量 / 用量</th>
              <th class="w-[8rem] px-2 py-1 font-medium">风险提示</th>
              <th class="w-[6rem] px-2 py-1 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((row) => {
                      const problemTab = getProblemTabForPlan(row)
                      const matchMeta = getDemandMatchStatusMeta(row.demandMatchSummary.status)
                      const confirmationMeta = getConfirmationStatusMeta(row.confirmationStatus)
                      const sourceRows = getSourceCutOrdersRows(row)
                      const firstSource = sourceRows[0]
                      const displayColors = getPlanDisplayColors(row, sourceRows)
                      const displayAlias = getPlanDisplayMaterialAlias(row, sourceRows)
                      const materialImageUrl = getPlanMaterialImageUrl(row, displayColors)
                      const modeSummaryText = getPlanModeSummaryText(row)
                      const routeBadgeClass =
                        row.executionRoute === 'OWN_CUTTING'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : row.executionRoute === 'FACTORY_PDA'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : row.executionRoute === 'CONFLICT'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                      const lockBadgeClass = row.isCrossTask
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                      const riskText =
                        row.executionRoute === 'CONFLICT'
                          ? '承接方冲突，需先处理任务分配。'
                          : row.executionRoute === 'FACTORY_PDA'
                            ? '三方工厂执行，不生成我方铺布单。'
                            : row.executionRoute === 'UNASSIGNED'
                              ? '等待裁片任务分配承接方。'
                              : row.isCrossTask
                                ? '跨任务锁定，后续必须同厂承接。'
                                : '无'
                      return `
                      <tr class="border-t align-top ${exceptionOnly ? 'cursor-pointer hover:bg-muted/10' : ''}" ${
                        exceptionOnly
                          ? `data-marker-plan-action="open-problem-detail" data-plan-id="${escapeHtml(row.id)}" data-tab-key="${problemTab}"`
                          : ''
                        }>
                        <td class="px-2 py-1">
                          <div class="font-semibold text-blue-600">${escapeHtml(row.markerNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(modeSummaryText)}</div>
                          <div class="mt-1 flex flex-wrap gap-1">${renderStatusBadge(row.statusMeta.label, row.statusMeta.className)}${renderStatusBadge(confirmationMeta.label, confirmationMeta.className)}</div>
                        </td>
                        <td class="px-2 py-1">
                          ${renderPlanStyleIdentity(row)}
                        </td>
                        <td class="w-[15rem] px-2 py-1">
                          <div class="w-full max-w-[15rem]">
                            ${renderMaterialIdentityBlock({
                              materialSku: row.materialSkuSummary || '—',
                              materialLabel: row.materialSkuSummary || '—',
                              materialColor: displayColors,
                              materialAlias: displayAlias,
                              materialImageUrl,
                            }, { compact: true })}
                          </div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(firstSource?.patternFileName || firstSource?.patternFileId || '—')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(firstSource ? `${firstSource.patternVersion || '—'} / ${firstSource.effectiveWidthText || '—'}` : getPlanTechPackText(row))}</div>
                        </td>
                        <td class="px-2 py-1">
                          <div class="font-medium">${escapeHtml(row.cuttingTaskNos?.slice(0, 2).join(' / ') || '待关联裁片任务')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">裁片单：${formatCount(row.cutOrderNos.length || sourceRows.length)} 个</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.cutOrderNos.slice(0, 3).join(' / ') || getPlanSourceNoText(row))}${row.cutOrderNos.length > 3 ? ' ...' : ''}</div>
                        </td>
                        <td class="px-2 py-1">
                          <div class="flex flex-wrap gap-1">${renderStatusBadge(getPlanLockShortLabel(row), lockBadgeClass)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getPlanLockShortDetail(row))}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getPlanAssigneeShortText(row))}</div>
                        </td>
                        <td class="px-2 py-1">
                          <div>${renderStatusBadge(row.executionRouteLabel || '待分配承接方', routeBadgeClass)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getPlanBedCountText(row))}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getPlanSpreadingStatusText(row))}</div>
                        </td>
                        <td class="px-2 py-1">
                          <div>${renderCompactListValueWithFormula(`${formatCount(row.totalPieces)} 件`, row.totalPiecesFormula)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">计划用量 ${formatNumber(row.plannedSpreadLength, 2)} m</div>
                          <div class="mt-1">${renderStatusBadge(matchMeta.label, matchMeta.className)}</div>
                        </td>
                        <td class="px-2 py-1">
                          <div class="text-xs">${escapeHtml(riskText)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.updatedAt || '—')}</div>
                        </td>
                        <td class="px-2 py-1">
                          <div class="flex flex-wrap gap-1.5">
                            ${renderActionButton('查看', `data-marker-plan-action="go-detail" data-plan-id="${escapeHtml(row.id)}"${exceptionOnly ? ` data-tab-key="${problemTab}"` : ''}`)}
                            ${row.status === 'READY_FOR_SPREADING' ? '' : renderActionButton('编辑', `data-marker-plan-action="go-edit" data-plan-id="${escapeHtml(row.id)}"${exceptionOnly ? ` data-tab-key="${problemTab}"` : ''}`)}
                            ${row.confirmationStatus === '已确认' ? '' : renderActionButton('确认唛架方案', `data-marker-plan-action="complete-plan" data-plan-id="${escapeHtml(row.id)}"`, 'primary')}
                            ${row.status === 'CANCELED' ? '' : row.confirmationStatus === '已确认'
                              ? renderActionButton('作废方案', `data-marker-plan-action="cancel-plan" data-plan-id="${escapeHtml(row.id)}"`, 'secondary')
                              : renderActionButton('删除草稿', `data-marker-plan-action="delete-draft" data-plan-id="${escapeHtml(row.id)}"`, 'secondary')}
                          </div>
                        </td>
                      </tr>
                    `})
                    .join('')
                : `<tr><td colspan="9" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有唛架方案。</td></tr>`
            }
          </tbody>
        </table>
      `, 'max-h-[62vh]')}
    </section>
  `
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const className =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `
    <section class="rounded-lg border px-4 py-3 ${className}">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm">${escapeHtml(state.feedback.message)}</p>
        <button type="button" class="text-xs hover:underline" data-marker-plan-action="clear-feedback">知道了</button>
      </div>
    </section>
  `
}

function renderListPage(viewModel = getViewModel()): string {
  clearMarkerPlanStickyOffset()
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-list')
  const filteredPlans = filterPlans(viewModel.plans, state.listTab)
  const mainContent = renderPlanRowsTable(filteredPlans, state.listTab === 'EXCEPTIONS')

  return `
    <div class="space-y-4 p-4" data-testid="cutting-marker-plan-list-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('LIST', null),
        showAliasBadge: isCuttingAliasPath(getCurrentBasePath()),
      })}
      ${renderFeedbackBar()}
      ${renderListFilters()}
      ${renderStats(viewModel, filteredPlans)}
      ${renderListStateBar()}
      ${mainContent}
    </div>
  `
}

function renderEditorWarning(plan: MarkerPlanViewRow | null): string {
  if (!plan) return ''
  const warningText = getMarkerPlanSourceerencedWarning(plan)
  if (!warningText) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3.5 text-sm text-amber-700">
      ${escapeHtml(warningText)}
    </section>
  `
}

function renderEditBoundaryNotice(plan: MarkerPlanViewRow | null): string {
  if (!plan) return ''
  const confirmed = plan.confirmationStatus === '已确认'
  return `
    <section class="rounded-lg border ${confirmed ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-100 bg-blue-50 text-blue-700'} px-3 py-3 text-sm" data-testid="marker-plan-edit-boundary">
      ${confirmed
        ? '已确认方案不允许直接修改来源裁片单；如需变更，请按后续版本化规则处理。'
        : '编辑页只能维护唛架模式、唛架编号、计划层数、计划数量、计划用量、尺码配比和备注；来源裁片单需删除草稿后重新选择。'}
    </section>
  `
}

function renderCreateSourceSummary(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate | null,
  options: { title?: string; showCurrentStep?: boolean } = {},
): string {
  const sourceNo = context?.contextNo || plan.cutOrderNos.join(' / ') || plan.markerPlanNo || '待选择'
  const productionNo = plan.productionOrderNos.join(' / ') || '—'
  const title = options.title || '来源裁片单'
  const sourceRows = plan.selectedSourceCutOrderRows || []
  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-create-source-summary">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderReadonlyField('来源裁片任务', plan.cuttingTaskNos?.join(' / ') || context?.cuttingTaskNos.join(' / ') || '待补')}
        ${renderReadonlyField('裁片单', sourceNo)}
        ${renderReadonlyField('款号 / SPU', `${plan.styleCode || '-'} / ${plan.spuCode || '-'}`)}
        ${renderReadonlyField('来源生产单号', productionNo)}
        <article class="rounded-lg border bg-muted/10 px-3 py-3">
          <p class="text-xs text-muted-foreground">面料 / 颜色</p>
          <div class="mt-2">${renderMaterialIdentityBlock({
            materialSku: plan.materialSkuSummary || '—',
            materialLabel: plan.materialSkuSummary || '—',
            materialAlias: plan.materialAliasSummary || context?.materialAliasSummary || '',
            materialImageUrl: plan.materialImageUrl || context?.materialImageUrl || '',
          }, { compact: true })}</div>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(plan.colorSummary || '—')}</p>
        </article>
        ${renderReadonlyField('技术包', context?.techPackStatusLabel || '待选择')}
        ${renderReadonlyField('需求总件数', `${formatCount(plan.totalPieces)} 件`)}
        ${renderReadonlyField('承接方锁定', plan.taskLockSummary || context?.taskLockSummary || '单任务')}
        ${renderReadonlyField('执行去向', plan.executionRouteLabel || context?.executionRouteLabel || '待分配承接方')}
      </div>
      <div class="mt-4 rounded-lg border" data-testid="marker-plan-source-cut-order-list">
        <div class="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">来源裁片单清单</div>
        <div class="grid gap-3 p-3 md:grid-cols-2">
          ${
            sourceRows.length
              ? sourceRows.map((row) => `
                <article class="rounded-lg border bg-background p-3 text-sm">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="text-xs text-muted-foreground">裁片单号</div>
                      <div class="mt-0.5 font-semibold text-blue-600">${escapeHtml(row.cutOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">生产单：${escapeHtml(row.productionOrderNo)} / SPU：${escapeHtml(row.spuCode || plan.spuCode || '—')}</div>
                    </div>
                    <div class="text-right text-xs">
                      <div class="text-muted-foreground">当前可用库存</div>
                      <div class="mt-0.5 text-sm font-semibold text-foreground">${formatNumber(row.availableQty, 2)} ${escapeHtml(row.unit)}</div>
                    </div>
                  </div>
                  <div class="mt-3 grid gap-3 lg:grid-cols-2">
                    <div class="rounded-md border bg-muted/10 p-2">
                      ${renderMaterialIdentityBlock({
                        materialSku: row.materialSku,
                        materialLabel: row.materialName || row.materialSku,
                        materialAlias: row.materialAlias,
                        materialImageUrl: row.materialImageUrl,
                      }, { compact: true })}
                      <div class="mt-1 text-xs text-muted-foreground">颜色：${escapeHtml(row.materialColor || '—')}</div>
                    </div>
                    <div class="rounded-md border bg-muted/10 p-2 text-xs">
                      <div class="font-medium text-foreground">${escapeHtml(row.patternFileName || row.patternFileId || '—')}</div>
                      <div class="mt-1 text-muted-foreground">版本：${escapeHtml(row.patternVersion || '—')}</div>
                      <div class="mt-1 text-muted-foreground">有效幅宽：${escapeHtml(row.effectiveWidthText || '—')}</div>
                      <div class="mt-1 text-muted-foreground">部位：${escapeHtml(row.piecePartNames.join(' / ') || '—')}</div>
                    </div>
                  </div>
                  <div class="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div class="rounded-md border bg-muted/10 px-2 py-2">可用余额：<span class="font-semibold">${formatNumber(row.availableQty, 2)} ${escapeHtml(row.unit)}</span></div>
                    <div class="rounded-md border bg-muted/10 px-2 py-2">历史组合组：<span class="font-semibold">${escapeHtml(row.historyCombinationGroup || '新组合')}</span></div>
                    <div class="rounded-md border bg-muted/10 px-2 py-2">后续铺布单：<span class="font-semibold">待生成铺布单</span></div>
                  </div>
                </article>
              `).join('')
              : '<div class="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无来源裁片单清单，请先选择裁片单。</div>'
          }
        </div>
      </div>
    </section>
  `
}

function getSourceCutOrdersRows(plan: MarkerPlan | MarkerPlanViewRow): MarkerPlanSourceCutOrderRow[] {
  return plan.selectedSourceCutOrderRows || []
}

function getSourceCutOrdersSummary(plan: MarkerPlan | MarkerPlanViewRow): {
  sourceCountText: string
  availableQtyText: string
} {
  const rows = getSourceCutOrdersRows(plan)
  const fallbackUnit = rows[0]?.unit || '米'
  const availableQty = rows.reduce((total, row) => total + safeNumber(row.availableQty), 0)
  return {
    sourceCountText: `${formatCount(rows.length)} 个`,
    availableQtyText: rows.length ? `${formatNumber(availableQty, 2)} ${fallbackUnit}` : '—',
  }
}

function renderCreateCombinationRuleStep(plan: MarkerPlan): string {
  const rows = getSourceCutOrdersRows(plan)
  const validation = validateSourceCutOrderCombination(rows)
  const productionOrderCount = new Set(rows.map((row) => row.productionOrderNo).filter(Boolean)).size
  const firstRow = rows[0]
  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-combination-rule-step">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">确认组合规则</h3>
        ${renderStatusBadge(validation.ok ? '校验通过' : '待处理', validation.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        ${renderReadonlyField('SPU', firstRow?.spuCode || plan.spuCode || '—')}
        ${renderReadonlyField('纸样文件', firstRow?.patternFileName || firstRow?.patternFileId || '—')}
        ${renderReadonlyField('纸样版本', firstRow?.patternVersion || '—')}
        ${renderReadonlyField('有效幅宽', firstRow?.effectiveWidthText || '—')}
        ${renderReadonlyField('历史组合组', firstRow?.historyCombinationGroup || '新组合')}
        ${renderReadonlyField('是否跨生产单', productionOrderCount > 1 ? `是，${productionOrderCount} 个生产单` : '否')}
      </div>
      ${validation.ok ? '' : `<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">${escapeHtml(validation.message)}</div>`}
    </section>
  `
}

function renderMarkerPlanSourceSummary(plan: MarkerPlan | MarkerPlanViewRow): string {
  const sourceSummary = getSourceCutOrdersSummary(plan)
  const rows = getSourceCutOrdersRows(plan)
  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-source-summary">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">来源裁片单</h3>
        <span class="text-xs text-muted-foreground">按来源裁片单查看当前可用库存</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${renderReadonlyField('来源裁片单', sourceSummary.sourceCountText)}
        ${renderReadonlyField('当前可用库存', sourceSummary.availableQtyText)}
      </div>
      <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        ${rows.length
          ? rows.map((row) => `
            <article class="rounded-lg border bg-background px-3 py-3 text-xs">
              <div class="font-semibold text-foreground">${escapeHtml(row.cutOrderNo)}</div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(row.productionOrderNo)} / ${escapeHtml(row.materialSku)} / ${escapeHtml(row.patternFileName || row.patternFileId)}</div>
              <div class="mt-2 font-medium">当前可用库存：${formatNumber(row.availableQty, 2)} ${escapeHtml(row.unit)}</div>
            </article>
          `).join('')
          : '<div class="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">暂无来源裁片单。</div>'}
      </div>
    </section>
  `
}

function renderDemandMatchStep(plan: MarkerPlan | MarkerPlanViewRow, context: MarkerPlanContextCandidate | null, readOnly = false): string {
  const summary = getPlanDemandMatchSummary(plan)
  const confirmationMeta = getConfirmationStatusMeta(plan.confirmationStatus)
  const rows = summary.rows
  return `
    <section class="space-y-3" data-testid="marker-plan-demand-match-step">
      ${renderSchemeDemandMatrix(plan)}
      <section class="rounded-lg border bg-card p-3">
        <div class="mb-3">
          <h3 class="text-sm font-semibold">需求匹配</h3>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          ${renderReadonlyField('需求成衣件数', `${formatCount(summary.demandTotalQty)} 件`)}
          ${renderReadonlyField('唛架产出件数', `${formatCount(summary.markerTotalQty)} 件`)}
          ${renderReadonlyField('差异合计', `${formatSignedCount(summary.diffTotalQty)} 件`)}
          ${renderReadonlyField('不足数量', `${formatCount(summary.shortageQty)} 件`)}
          ${renderReadonlyField('超出数量', `${formatCount(summary.surplusQty)} 件`)}
        </div>
      </section>
      <section class="rounded-lg border bg-card">
        <div class="border-b px-3 py-3">
          <h3 class="text-sm font-semibold">颜色尺码差异</h3>
        </div>
        ${renderStickyTableScroller(`
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2">颜色</th>
                <th class="px-3 py-2">尺码</th>
                <th class="px-3 py-2 text-right">需求件数</th>
                <th class="px-3 py-2 text-right">唛架件数</th>
                <th class="px-3 py-2 text-right">差异</th>
                <th class="px-3 py-2">结果</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${
                rows.length
                  ? rows.map((row) => {
                      const rowMeta = row.status === '已匹配'
                        ? { className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' }
                        : row.status === '不足'
                          ? { className: 'bg-amber-100 text-amber-700 border border-amber-200' }
                          : { className: 'bg-blue-100 text-blue-700 border border-blue-200' }
                      return `
                        <tr>
                          <td class="px-3 py-3 font-medium">${escapeHtml(row.colorName)}</td>
                          <td class="px-3 py-3">${escapeHtml(row.sizeName)}</td>
                          <td class="px-3 py-3 text-right">${formatCount(row.demandQty)}</td>
                          <td class="px-3 py-3 text-right">${formatCount(row.markerQty)}</td>
                          <td class="px-3 py-3 text-right">${formatSignedCount(row.diffQty)}</td>
                          <td class="px-3 py-3">${renderStatusBadge(row.status, rowMeta.className)}</td>
                        </tr>
                      `
                    }).join('')
                  : `<tr><td colspan="6" class="px-3 py-8 text-center text-xs text-muted-foreground">请先在唛架编辑器中维护唛架矩阵。</td></tr>`
              }
            </tbody>
          </table>
        `, 'max-h-[46vh]')}
      </section>
      ${readOnly ? `
        <section class="rounded-lg border bg-card p-3">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">确认记录</h3>
            ${renderStatusBadge(confirmationMeta.label, confirmationMeta.className)}
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            ${renderReadonlyField('确认人', plan.confirmedBy || '—')}
            ${renderReadonlyField('确认时间', plan.confirmedAt || '—')}
            ${renderReadonlyField('确认备注', plan.confirmationRemark || '—')}
          </div>
        </section>
      ` : ''}
    </section>
  `
}

function renderCreateStepPanel(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  if (state.activeCreateStep === 'combination') return renderCreateCombinationRuleStep(plan)
  if (state.activeCreateStep === 'layout') return renderLayoutTab(plan, context)
  if (state.activeCreateStep === 'match') return renderDemandMatchStep(plan, context)
  return renderCreateSourceSummary(plan, context)
}

function renderCreateStepFooter(plan: MarkerPlan | null): string {
  const stepOrder: MarkerPlanCreateStepKey[] = ['source', 'combination', 'layout', 'match']
  const activeIndex = Math.max(stepOrder.indexOf(state.activeCreateStep), 0)
  const previousStep = stepOrder[Math.max(activeIndex - 1, 0)]
  const nextStep = stepOrder[Math.min(activeIndex + 1, stepOrder.length - 1)]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === stepOrder.length - 1

  return `
    <section class="rounded-xl border bg-card px-4 py-3" data-testid="marker-plan-create-step-actions">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-xs text-muted-foreground">新建流程</div>
        <div class="flex flex-wrap justify-end gap-2">
          ${renderActionButton('上一步', `data-marker-plan-action="switch-create-step" data-create-step="${previousStep}"`, 'secondary', isFirst)}
          ${
            isLast
              ? `
                ${renderActionButton('创建草稿', 'data-marker-plan-action="save-draft"', 'secondary', !plan)}
                ${renderActionButton('确认唛架方案', 'data-marker-plan-action="complete-plan"', 'primary', !plan)}
              `
              : renderActionButton('下一步', `data-marker-plan-action="switch-create-step" data-create-step="${nextStep}"`, 'primary', !plan)
          }
        </div>
      </div>
    </section>
  `
}

function renderCreateEditorBody(plan: MarkerPlan | null, context: MarkerPlanContextCandidate | null): string {
  if (!plan) {
    return `
      ${renderCreateStepNav(null)}
      ${renderCreateCutOrderSelectionStep()}
    `
  }

  return `
    ${renderCreateStepNav(plan)}
    ${renderCreateStepPanel(plan, context)}
    ${renderCreateStepFooter(plan)}
    ${renderMappingRepairDrawer(plan, context)}
  `
}

function renderCreatePage(viewModel = getViewModel()): string {
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-create')
  return `
    <div class="space-y-4 p-4" data-testid="cutting-marker-plan-create-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('CREATE', state.draftPlan),
      })}
      ${renderFeedbackBar()}
      ${renderCreateEditorBody(state.draftPlan, getDraftContext(viewModel))}
    </div>
  `
}

function renderEditPage(viewModel = getViewModel(), id = parseRoute().id): string {
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-edit')
  const sourcePlan = viewModel.plansById[id] ?? null
  return `
    <div class="space-y-4 p-4" data-testid="cutting-marker-plan-edit-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('EDIT', state.draftPlan),
      })}
      ${renderFeedbackBar()}
      ${renderEditorWarning(sourcePlan)}
      ${renderEditBoundaryNotice(sourcePlan)}
      ${renderCreateEditorBody(state.draftPlan, getDraftContext(viewModel))}
    </div>
  `
}

function renderDetailPage(viewModel = getViewModel(), id = parseRoute().id): string {
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-detail')
  const plan = viewModel.plansById[id] ?? null
  const context = plan ? findMarkerPlanContextForPlan(viewModel.contexts, plan) : null
  return `
    <div class="space-y-4 p-4" data-testid="cutting-marker-plan-detail-page">
      ${renderFeedbackBar()}
      ${
        plan
          ? `
            ${renderMarkerPlanDetailPanel(plan, context)}
          `
          : `
            ${renderCuttingPageHeader(meta, {
              actionsHtml: renderPlanHeaderActions('DETAIL', plan),
            })}
            <section class="rounded-lg border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
              当前未找到对应唛架方案，请返回列表重新选择。
            </section>
          `
      }
    </div>
  `
}

export function renderCraftCuttingMarkerListPage(): string {
  const viewModel = getViewModel()
  syncStateFromRoute(viewModel)
  return renderListPage(viewModel)
}

export function renderCraftCuttingMarkerCreatePage(): string {
  const viewModel = getViewModel()
  syncStateFromRoute(viewModel)
  return renderCreatePage(viewModel)
}

export function renderCraftCuttingMarkerPlanEditPage(id?: string): string {
  const viewModel = getViewModel()
  syncStateFromRoute(viewModel)
  return renderEditPage(viewModel, id || parseRoute().id)
}

export function renderCraftCuttingMarkerPlanDetailPage(id?: string): string {
  const viewModel = getViewModel()
  syncStateFromRoute(viewModel)
  return renderDetailPage(viewModel, id || parseRoute().id)
}

function persistDraftPlan(): MarkerPlan | null {
  const context = getDraftContext(getViewModel())
  if (!state.draftPlan || !context) {
    setFeedback('warning', '请先选择裁片单，再保存唛架方案。')
    return null
  }
  const sourceRowsValidation = validateSelectedSourceRows(state.draftPlan)
  if (!sourceRowsValidation.ok) {
    setFeedback('warning', sourceRowsValidation.message)
    return null
  }
  const nextPlan = hydrateDraft(state.draftPlan, context)
  upsertStoredPlan(nextPlan)
  state.draftPlan = nextPlan
  return nextPlan
}

function loadPlanAsDraftForAction(viewModel: ReturnType<typeof getViewModel>, planId: string): boolean {
  if (!planId || state.draftPlan?.id === planId) return Boolean(state.draftPlan)
  const plan = resolveCurrentPlan(viewModel, planId)
  if (!plan) {
    setFeedback('warning', '当前未找到唛架方案。')
    return false
  }
  const context = findMarkerPlanContextForPlan(viewModel.contexts, plan)
  state.draftPlan = context ? hydrateMarkerPlan(plan as MarkerPlan, context) : (plan as MarkerPlan)
  return true
}

function saveDraftPlan(stayOnPage = true, successMessage?: string): boolean {
  const nextPlan = persistDraftPlan()
  if (!nextPlan) return true
  if (!stayOnPage) {
    appStore.navigate(buildDetailPath(nextPlan.id))
    return true
  }
  setFeedback('success', successMessage || `已创建草稿 ${nextPlan.markerNo}，已记录来源裁片单。`)
  return true
}

function completeDraftPlan(): boolean {
  if (state.draftPlan?.executionRoute === 'CONFLICT') {
    setFeedback('warning', '当前方案来源裁片任务存在承接方冲突，不能确认唛架方案。')
    return true
  }
  if (state.draftPlan?.isCrossTask) {
    const confirmed = window.confirm('当前方案包含多个裁片任务。确认后，这些裁片任务后续必须分配给同一个裁剪承接工厂。是否继续确认？')
    if (!confirmed) return true
  }
  const confirmedAt = nowText()
  if (state.draftPlan) {
    state.draftPlan = {
      ...state.draftPlan,
      confirmationStatus: '已确认',
      confirmedBy: '计划员-陈静',
      confirmedAt,
      operationLogs: [
        ...(state.draftPlan.operationLogs || []),
        {
          id: `log-${state.draftPlan.id}-confirmed-${Date.now()}`,
          action: '确认唛架方案',
          detail: state.draftPlan.isCrossTask
            ? '跨任务唛架方案已确认，来源裁片任务锁定同一裁剪承接工厂。'
            : '唛架方案已确认。',
          at: confirmedAt,
          by: '计划员-陈静',
        },
      ],
      lastVisitedTab: state.activeTab,
    }
  }
  const nextPlan = persistDraftPlan()
  if (!nextPlan) return true
  const confirmedPlan = {
    ...nextPlan,
    confirmationStatus: '已确认' as MarkerPlanConfirmationStatusKey,
    confirmedBy: '计划员-陈静',
    confirmedAt,
    updatedAt: confirmedAt,
    updatedBy: '计划员-陈静',
  }
  upsertStoredPlan(confirmedPlan)
  state.draftPlan = confirmedPlan
  setFeedback('success', `已确认唛架方案 ${nextPlan.markerNo}，来源裁片单记录已确认。`)
  return true
}

function cancelDraftPlan(): boolean {
  if (!state.draftPlan) return false
  const isConfirmedPlan = state.draftPlan.confirmationStatus === '已确认'
  const spreadingOrders = getSpreadingOrdersForMarkerPlan(state.draftPlan.id)
  const activeSpreadingOrders = spreadingOrders.filter((order) => order.status !== 'CANCELED')
  if (isConfirmedPlan && activeSpreadingOrders.length) {
    setFeedback('warning', `当前方案已生成 ${activeSpreadingOrders.length} 张铺布单，需先作废或删除未开始铺布单；已进入执行中的铺布单不允许作废方案。`)
    return true
  }
  const voidReason = isConfirmedPlan
    ? window.prompt('请输入作废原因。已确认方案作废后不能再生成铺布单。', '计划调整，重新排唛架')
    : '删除草稿'
  if (isConfirmedPlan && !String(voidReason || '').trim()) {
    setFeedback('warning', '作废已确认方案必须填写作废原因。')
    return true
  }
  const context = getDraftContext(getViewModel())
  const now = nowText()
  const canceledPlan = {
    ...state.draftPlan,
    status: 'CANCELED' as MarkerPlanStatusKey,
    readyForSpreading: false,
    voidReason: String(voidReason || '删除草稿').trim(),
    voidedAt: now,
    voidedBy: '计划员-陈静',
    operationLogs: [
      ...(state.draftPlan.operationLogs || []),
      {
        id: `log-${state.draftPlan.id}-void-${Date.now()}`,
        action: isConfirmedPlan ? '作废方案' : '删除草稿',
        detail: isConfirmedPlan
          ? `作废原因：${String(voidReason || '').trim()}`
          : '取消未确认草稿。',
        at: now,
        by: '计划员-陈静',
      },
    ],
    updatedAt: now,
    updatedBy: '计划员-陈静',
  }
  const nextPlan = context ? hydrateMarkerPlan(canceledPlan, context) : canceledPlan
  upsertStoredPlan(nextPlan)
  state.draftPlan = nextPlan
  setFeedback('success', isConfirmedPlan ? `已作废唛架方案 ${nextPlan.markerNo}。` : `已删除草稿 ${nextPlan.markerNo}。`)
  return true
}

function deleteDraftPlan(): boolean {
  if (!state.draftPlan) return false
  if (state.draftPlan.confirmationStatus === '已确认') {
    setFeedback('warning', '已确认方案不能删除，只能按规则作废。')
    return true
  }
  const spreadingOrders = getSpreadingOrdersForMarkerPlan(state.draftPlan.id)
  if (spreadingOrders.some((order) => order.status !== 'CANCELED')) {
    setFeedback('warning', '当前草稿已有铺布引用，不能删除。')
    return true
  }
  removeStoredPlan(state.draftPlan.id)
  const markerNo = state.draftPlan.markerNo
  state.draftPlan = null
  setFeedback('success', `已删除草稿 ${markerNo}。`)
  return true
}

function createFromSelectedContext(viewModel = getViewModel()): boolean {
  const contexts = getSelectedDrawerContexts(viewModel)
  const validation = validateMarkerPlanSourceSelection(contexts)
  if (!validation.ok) {
    setFeedback('warning', validation.message)
    return true
  }
  state.contextDrawerOpen = false
  state.selectedContextKeys = contexts.map((context) => context.contextKey)
  navigateToCreateWithContexts(contexts, 'combination')
  return true
}

function handleAction(action: string, node: HTMLElement): boolean {
  const route = parseRoute()
  const viewModel = getViewModel()

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'go-list') {
    appStore.navigate(LIST_PATH)
    return true
  }

  if (action === 'go-create') {
    state.draftPlan = null
    state.contextDrawerOpen = false
    state.contextKeyword = ''
    state.contextPage = 1
    state.selectedContextKeys = []
    appStore.navigate(CREATE_PATH)
    return true
  }

  if (action === 'go-edit') {
    const planId = node.dataset.planId || route.id
    if (!planId) return false
    appStore.navigate(buildEditPathWithTab(planId, node.dataset.tabKey as MarkerPlanTabKey | undefined))
    return true
  }

  if (action === 'go-detail') {
    const planId = node.dataset.planId || route.id
    if (!planId) return false
    appStore.navigate(buildDetailPathWithTab(planId, node.dataset.tabKey as MarkerPlanTabKey | undefined))
    return true
  }

  if (action === 'open-problem-detail') {
    const planId = node.dataset.planId || ''
    if (!planId) return false
    appStore.navigate(buildDetailPathWithTab(planId, node.dataset.tabKey as MarkerPlanTabKey | undefined))
    return true
  }

  if (action === 'go-spreading') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan) {
      setFeedback('warning', '请先选择一个唛架方案。')
      return true
    }
    if (plan.executionRoute !== 'OWN_CUTTING') {
      setFeedback('warning', `当前方案执行去向为「${plan.executionRouteLabel || '待分配承接方'}」，不能生成我方裁床厂铺布单。`)
      return true
    }
    appStore.navigate(buildMarkerPlanGoSpreadingPath(plan))
    return true
  }

  if (action === 'go-spreading-order') {
    const spreadingSessionId = node.dataset.spreadingSessionId || ''
    const planId = node.dataset.planId || route.id
    appStore.navigate(buildRouteWithQuery(getCanonicalCuttingPath('marker-spreading'), {
      spreadingSessionId,
      markerPlanId: planId,
    }))
    return true
  }

  if (action === 'go-cut-orders') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan) return false
    appStore.navigate(buildGoCutOrdersPath(plan))
    return true
  }

  if (action === 'go-cut-order-context') {
    const contextType = node.dataset.contextType as MarkerPlanContextType | undefined
    const contextId = node.dataset.contextId || ''
    if (!contextType || !contextId) return false
    const context = findMarkerPlanContextById(viewModel.contexts, contextType, contextId)
    if (!context) return false
    appStore.navigate(buildGoCutOrdersPathFromContext(context))
    return true
  }

  if (action === 'go-material-prep') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan) return false
    appStore.navigate(buildGoMaterialPrepPath(plan))
    return true
  }

  if (action === 'go-marker-plan') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan || !plan.markerPlanId) return false
    appStore.navigate(buildGoMarkerPlanSourcePath(plan))
    return true
  }

  if (action === 'go-production-progress') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan) return false
    appStore.navigate(
      buildGoProductionProgressPath({
        productionOrderId: node.dataset.productionOrderId || plan.productionOrderIds[0],
        productionOrderNo: node.dataset.productionOrderNo || plan.productionOrderNos[0],
        cutOrderId: node.dataset.cutOrderId || plan.cutOrderIds[0],
        cutOrderNo: node.dataset.cutOrderNo || plan.cutOrderNos[0],
        markerPlanId: node.dataset.markerPlanId || plan.markerPlanId || undefined,
        markerPlanNo: node.dataset.markerPlanNo || plan.markerPlanNo || undefined,
        styleCode: node.dataset.styleCode || plan.styleCode,
        spuCode: node.dataset.spuCode || plan.spuCode,
        materialSku: node.dataset.materialSku || plan.sourceMaterialSku,
      }),
    )
    return true
  }

  if (action === 'go-merge-context') {
    const contextType = node.dataset.contextType as MarkerPlanContextType | undefined
    const contextId = node.dataset.contextId || ''
    if (!contextType || !contextId) return false
    const context = findMarkerPlanContextById(viewModel.contexts, contextType, contextId)
    if (!context || !context.markerPlanId) return false
    appStore.navigate(buildGoMarkerPlanSourcePathFromContext(context))
    return true
  }

  if (action === 'open-context-drawer') {
    setFeedback('warning', '请先选择裁片单。')
    return true
  }

  if (action === 'close-context-drawer') {
    state.contextDrawerOpen = false
    state.contextPage = 1
    state.selectedContextKeys = []
    removeContextDrawerDom()
    return false
  }

  if (action === 'select-context') {
    const contextKey = node.dataset.contextKey || ''
    if (!contextKey) return false
    const input = node as HTMLInputElement
    state.selectedContextKeys = input.checked
      ? Array.from(new Set([...state.selectedContextKeys, contextKey]))
      : state.selectedContextKeys.filter((item) => item !== contextKey)
    return true
  }

  if (action === 'toggle-context-row') {
    const contextKey = node.dataset.contextKey || ''
    if (!contextKey) return false
    state.selectedContextKeys = state.selectedContextKeys.includes(contextKey)
      ? state.selectedContextKeys.filter((item) => item !== contextKey)
      : Array.from(new Set([...state.selectedContextKeys, contextKey]))
    return true
  }

  if (action === 'remove-selected-context') {
    const contextKey = node.dataset.contextKey || ''
    if (!contextKey) return false
    state.selectedContextKeys = state.selectedContextKeys.filter((item) => item !== contextKey)
    return true
  }

  if (action === 'clear-selected-contexts') {
    state.selectedContextKeys = []
    return true
  }

  if (action === 'prev-context-page') {
    state.contextPage = Math.max(1, state.contextPage - 1)
    return true
  }

  if (action === 'next-context-page') {
    const contexts = filterMarkerSourceContextsByKeyword(getMarkerPlanCutOrderContexts(viewModel))
    const totalPages = Math.max(1, Math.ceil(contexts.length / state.contextPageSize))
    state.contextPage = Math.min(totalPages, state.contextPage + 1)
    return true
  }

  if (action === 'confirm-context-create') {
    return createFromSelectedContext(viewModel)
  }

  if (action === 'reset-filters') {
    state.filters = { keyword: '', contextNo: '', markerNo: '', contextType: 'ALL', mode: 'ALL', status: 'ALL', ready: 'ALL' }
    return true
  }

  if (action === 'reset-list-view') {
    state.filters = { keyword: '', contextNo: '', markerNo: '', contextType: 'ALL', mode: 'ALL', status: 'ALL', ready: 'ALL' }
    state.listTab = 'ALL'
    return true
  }

  if (action === 'switch-list-tab') {
    state.listTab = (node.dataset.listTab as MarkerPlanListTab | undefined) || 'ALL'
    return true
  }

  if (action === 'switch-create-step') {
    const createStep = parseCreateStepParam(node.dataset.createStep || '') || 'source'
    state.contextDrawerOpen = false
    state.activeCreateStep = createStep
    state.activeTab = getCreateStepTargetTab(createStep)
    if (state.draftPlan) {
      state.draftPlan = {
        ...state.draftPlan,
        lastVisitedTab: state.activeTab,
      }
    }
    return true
  }

  if (action === 'export-list') {
    const exported = buildCurrentListExportRows(viewModel)
    downloadCsvFile(exported.filename, exported.rows)
    setFeedback('success', `已导出${exported.filename.replace('.csv', '')}。`)
    return true
  }

  if (action === 'switch-tab') {
    state.activeTab = (node.dataset.tabKey as MarkerPlanTabKey | undefined) || 'basic'
    state.activeCreateStep = getCreateStepFromActiveTab(state.activeTab)
    if (state.draftPlan) {
      state.draftPlan = {
        ...state.draftPlan,
        lastVisitedTab: state.activeTab,
      }
    }
    return true
  }

  if (action === 'save-plan') {
    return saveDraftPlan(true, 'EDIT' === route.kind ? `已保存修改 ${state.draftPlan?.markerNo || ''}。` : undefined)
  }

  if (action === 'save-draft') {
    return saveDraftPlan(true)
  }

  if (action === 'delete-draft') {
    if (node.dataset.planId && !loadPlanAsDraftForAction(viewModel, node.dataset.planId)) return true
    return deleteDraftPlan()
  }

  if (action === 'save-and-view-detail') {
    return saveDraftPlan(false)
  }

  if (action === 'complete-plan') {
    if (node.dataset.planId && !loadPlanAsDraftForAction(viewModel, node.dataset.planId)) return true
    return completeDraftPlan()
  }

  if (action === 'cancel-plan') {
    if (node.dataset.planId && !loadPlanAsDraftForAction(viewModel, node.dataset.planId)) return true
    return cancelDraftPlan()
  }

  if (action === 'confirm-plan') {
    const handled = updateDraft((plan) => ({
      ...plan,
      confirmationStatus: '已确认',
      confirmedBy: '业务同事-廖晓飞',
      confirmedAt: nowText(),
      lastVisitedTab: 'explosion',
    }))
    if (handled) setFeedback('success', '已确认当前唛架方案，可交接铺布。')
    return handled
  }

  if (action === 'mark-plan-adjust') {
    const handled = updateDraft((plan) => ({
      ...plan,
      confirmationStatus: '需调整',
      confirmedBy: '',
      confirmedAt: '',
      readyForSpreading: false,
      lastVisitedTab: 'explosion',
    }))
    if (handled) setFeedback('warning', '已标记为需调整，请回到唛架编辑器修改。')
    return handled
  }

  if (action === 'restore-system-unit-usage') {
    return updateDraft((plan) => ({ ...plan, manualUnitUsage: null }))
  }

if (action === 'add-scheme-bed') {
    const mode = (node.dataset.bedMode as MarkerBedModeKey | undefined) || 'normal'
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan, context) => {
      const beds = [...buildMarkerSchemeFromPlan(plan).beds, buildDefaultSchemeBed(plan, context, mode)]
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  if (action === 'remove-scheme-bed') {
    const bedId = node.dataset.bedId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds.filter((bed) => bed.bedId !== bedId)
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  if (action === 'copy-scheme-bed') {
    const bedId = node.dataset.bedId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds
      const source = beds.find((bed) => bed.bedId === bedId)
      if (!source) return plan
      const copied: MarkerSchemeBed = {
        ...source,
        bedId: `${plan.id}-bed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        bedNo: `${getMarkerBedModePrefix(source.bedMode)}-${beds.filter((bed) => bed.bedMode === source.bedMode).length + 1}`,
        bedName: `${getMarkerBedModePrefix(source.bedMode)}-${beds.filter((bed) => bed.bedMode === source.bedMode).length + 1}`,
        bedSortOrder: beds.length + 1,
        status: '草稿',
        readyForSpreading: false,
        spreadingSessionIds: [],
        assignedCuttingTableIds: [],
      }
      return applySchemeBedsToPlan(plan, [...beds, copied])
    })
  }

  if (action === 'add-matrix-row') {
    const bedId = node.dataset.bedId || ''
    if (!bedId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const sizeColumns = getMarkerMatrixSizeColumns(plan)
      const defaultColor = getMarkerMatrixColorRows(plan)[0] || '主色'
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        const rows = createMarkerMatrixRows(plan, bed)
        return {
          ...bed,
          highLowMatrixRows: [
            ...rows,
            {
              rowId: `${bed.bedId}-matrix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              stepNo: rows.length + 1,
              stepLabel: buildHighLowStepLabel(rows.length + 1),
              colorCode: defaultColor,
              colorName: defaultColor,
              markerLength: 0,
              sizeValues: Object.fromEntries(sizeColumns.map((size) => [size, 0])) as Record<string, number>,
              patternValues: {},
              totalQty: 0,
            },
          ],
        }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  if (action === 'remove-matrix-row') {
    const bedId = node.dataset.bedId || ''
    const rowId = node.dataset.rowId || ''
    if (!bedId || !rowId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        const rows = createMarkerMatrixRows(plan, bed).filter((row) => row.rowId !== rowId)
        return {
          ...bed,
          highLowMatrixRows: rows,
        }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  if (action === 'toggle-bed-size') {
    const bedId = node.dataset.bedId || ''
    const sizeName = node.dataset.sizeName || ''
    if (!bedId || !sizeName) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        const selectedSizes = new Set(bed.coverageRows.map((row) => row.sizeName || row.sizeCode))
        if (selectedSizes.has(sizeName)) selectedSizes.delete(sizeName)
        else selectedSizes.add(sizeName)
        return {
          ...bed,
          coverageRows: buildBedCoverageRows(plan, bed.colorName || bed.colorCode, Array.from(selectedSizes)),
        }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  if (action === 'open-mapping-drawer') {
    if (!state.draftPlan) return false
    const pieceId = node.dataset.pieceId || ''
    const row = state.draftPlan.pieceExplosionRows.find((item) => item.id === pieceId)
    if (!row) return false
    state.mappingDrawerOpen = true
    state.mappingTargetRowId = pieceId
    state.mappingDraft = buildMappingDraftForRow(row)
    return true
  }

  if (action === 'close-mapping-drawer') {
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    return true
  }

  if (action === 'save-mapping') {
    const targetRowId = state.mappingTargetRowId
    if (!targetRowId) return false
    const draft = { ...state.mappingDraft }
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    return updateDraft((plan) => ({
      ...plan,
      pieceExplosionRows: plan.pieceExplosionRows.map((row) =>
        row.id === targetRowId
          ? {
              ...row,
              skuCode: draft.targetSku || row.skuCode,
              colorCode: draft.colorMode === 'specified' ? draft.specifiedColor || row.colorCode : row.colorCode,
              overrideColorMode: draft.colorMode,
              overrideColors: draft.colorMode === 'specified' && draft.specifiedColor ? [draft.specifiedColor] : [],
              partCode: draft.partCode || row.partCode,
              partNameCn: draft.partCode || row.partNameCn,
              patternCode: draft.patternCode || row.patternCode,
              piecePerGarment: Math.max(Math.round(draft.piecePerGarment || 0), 0),
              explodedPieceQty: Math.max(Math.round(draft.piecePerGarment || 0), 0) * row.garmentQty,
              mappingStatus: 'MATCHED',
              issueReason: '',
              manualOverride: true,
              note: draft.note,
            }
          : row,
      ),
    }))
  }

  if (action === 'restore-auto-mapping') {
    const targetRowId = state.mappingTargetRowId
    if (!targetRowId) return false
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    return updateDraft((plan, context) => hydrateDraft({
      ...plan,
      pieceExplosionRows: plan.pieceExplosionRows.filter((row) => row.id !== targetRowId || !row.manualOverride),
    }, context))
  }

  return false
}

export function handleCraftCuttingMarkerPlanEvent(target: Element): boolean {
  const route = parseRoute()
  if (route.kind === 'OTHER') return false
  const viewModel = getViewModel()

  const filterFieldNode = target.closest<HTMLElement>('[data-marker-plan-filter-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.markerPlanFilterField as MarkerPlanListFilterField | undefined
    const input = filterFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.filters.keyword = input.value
    if (field === 'contextNo') state.filters.contextNo = input.value
    if (field === 'markerNo') state.filters.markerNo = input.value
    if (field === 'contextType') state.filters.contextType = input.value as MarkerPlanListFilters['contextType']
    if (field === 'mode') state.filters.mode = input.value as MarkerPlanListFilters['mode']
    if (field === 'status') state.filters.status = input.value as MarkerPlanListFilters['status']
    if (field === 'ready') state.filters.ready = input.value as MarkerPlanListFilters['ready']
    return true
  }

  const contextFieldNode = target.closest<HTMLElement>('[data-marker-plan-context-field]')
  if (contextFieldNode) {
    const field = contextFieldNode.dataset.markerPlanContextField as MarkerPlanContextField | undefined
    const input = contextFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'contextKeyword') {
      state.contextKeyword = input.value
      state.contextPage = 1
      return true
    }
    if (field === 'contextPageSize') {
      const nextPageSize = Number(input.value)
      state.contextPageSize = CREATE_CONTEXT_PAGE_SIZE_OPTIONS.includes(nextPageSize as (typeof CREATE_CONTEXT_PAGE_SIZE_OPTIONS)[number])
        ? nextPageSize
        : 5
      state.contextPage = 1
      return true
    }
  }

  const basicFieldNode = target.closest<HTMLElement>('[data-marker-plan-basic-field]')
  if (basicFieldNode) {
    const field = basicFieldNode.dataset.markerPlanBasicField as MarkerPlanBasicField | undefined
    const input = basicFieldNode as HTMLInputElement | HTMLSelectElement
    if (!field) return false
    if (field === 'markerMode') {
      const nextMode = input.value as MarkerPlanModeKey
      if (!confirmReferencedStructuralEdit(viewModel)) {
        if (state.draftPlan) input.value = state.draftPlan.markerMode
        return true
      }
      return updateDraft((plan, context) => applyMarkerMode(plan, context, nextMode))
    }
    if (field === 'plannedLayerCount') {
      return updateDraft((plan) => ({ ...plan, plannedLayerCount: Math.max(Math.round(safeNumber(input.value)), 0) }))
    }
    if (field === 'markerNo') {
      return updateDraft((plan) => ({ ...plan, markerNo: input.value }))
    }
    if (field === 'netLength') {
      return updateDraft((plan) => ({ ...plan, netLength: Math.max(safeNumber(input.value), 0) }))
    }
    if (field === 'manualUnitUsage') {
      const value = String(input.value || '').trim()
      return updateDraft((plan) => ({ ...plan, manualUnitUsage: value ? safeNumber(value) : null }))
    }
    if (field === 'singleSpreadFixedLoss') {
      if (!confirmReferencedStructuralEdit(viewModel)) return true
      return updateDraft((plan) => ({ ...plan, singleSpreadFixedLoss: Math.max(safeNumber(input.value), 0) }))
    }
    if (field === 'remark') {
      return updateDraft((plan) => ({ ...plan, remark: input.value }))
    }
  }

  const textareaFieldNode = target.closest<HTMLElement>('[data-marker-plan-textarea-field]')
  if (textareaFieldNode) {
    const field = textareaFieldNode.dataset.markerPlanTextareaField as MarkerPlanBasicField | undefined
    const input = textareaFieldNode as HTMLTextAreaElement
    if (!field) return false
    if (field === 'remark') return updateDraft((plan) => ({ ...plan, remark: input.value }))
    if (field === 'confirmationRemark') return updateDraft((plan) => ({ ...plan, confirmationRemark: input.value }))
  }

  const matrixCellNode = target.closest<HTMLElement>('[data-marker-plan-matrix-cell]')
  if (matrixCellNode) {
    const bedId = matrixCellNode.dataset.bedId || ''
    const rowId = matrixCellNode.dataset.rowId || ''
    const sizeName = matrixCellNode.dataset.sizeName || ''
    const input = matrixCellNode as HTMLInputElement
    if (!bedId || !rowId || !sizeName) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const sizeColumns = getMarkerMatrixSizeColumns(plan)
      const nextValue = Math.max(Math.round(safeNumber(input.value)), 0)
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeColumns)
        const rows = createMarkerMatrixRows(plan, bed).map((row) => {
          if (row.rowId !== rowId) return row
          let sizeValues = { ...row.sizeValues, [sizeName]: nextValue }
          if (bed.bedMode === 'normal' || bed.bedMode === 'fold_normal') {
            sizeValues = Object.fromEntries(sizeColumns.map((size) => [size, nextValue])) as Record<string, number>
          }
          return {
            ...row,
            sizeValues,
            totalQty: sizeColumns.reduce((total, size) => total + Math.max(Math.round(safeNumber(sizeValues[size])), 0) * Math.max(Math.round(safeNumber(sizePiecePerLayer[size])), 0), 0),
          }
        })
        return {
          ...bed,
          highLowMatrixRows: rows,
        }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  const matrixRowLengthNode = target.closest<HTMLElement>('[data-marker-plan-matrix-row-length]')
  if (matrixRowLengthNode) {
    const bedId = matrixRowLengthNode.dataset.bedId || ''
    const rowId = matrixRowLengthNode.dataset.rowId || ''
    const input = matrixRowLengthNode as HTMLInputElement
    if (!bedId || !rowId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        const rows = createMarkerMatrixRows(plan, bed).map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                markerLength: Math.max(safeNumber(input.value), 0),
              }
            : row,
        )
        return {
          ...bed,
          highLowMatrixRows: rows,
        }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  const matrixRowColorNode = target.closest<HTMLElement>('[data-marker-plan-matrix-row-color]')
  if (matrixRowColorNode) {
    const bedId = matrixRowColorNode.dataset.bedId || ''
    const rowId = matrixRowColorNode.dataset.rowId || ''
    const input = matrixRowColorNode as HTMLSelectElement
    if (!bedId || !rowId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        const rows = createMarkerMatrixRows(plan, bed).map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                colorCode: input.value,
                colorName: input.value,
              }
            : row,
        )
        return {
          ...bed,
          highLowMatrixRows: rows,
        }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  const bedFieldNode = target.closest<HTMLElement>('[data-marker-plan-bed-field]')
  if (bedFieldNode) {
    const field = bedFieldNode.dataset.markerPlanBedField as MarkerPlanBedField | undefined
    const bedId = bedFieldNode.dataset.bedId || ''
    const input = bedFieldNode as HTMLInputElement | HTMLSelectElement
    if (!field || !bedId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const beds = buildMarkerSchemeFromPlan(plan).beds.map((bed) => {
        if (bed.bedId !== bedId) return bed
        if (field === 'bedMode') {
          const nextMode = input.value as MarkerBedModeKey
          const nextBedNo =
            bed.bedNo === '' || /^[AB]-\d+$/.test(bed.bedNo)
              ? `${getMarkerBedModePrefix(nextMode)}-${bed.bedSortOrder}`
              : bed.bedNo
          return {
            ...bed,
            bedMode: nextMode,
            bedNo: nextBedNo,
            foldConfig: isFoldBedMode(nextMode) ? plan.foldConfig : null,
          }
        }
        if (field === 'plannedLayerCount' || field === 'markerPieceQtyPerLayer') {
          return { ...bed, [field]: Math.max(Math.round(safeNumber(input.value)), 0) } as MarkerSchemeBed
        }
        if (field === 'markerLength') {
          return { ...bed, markerLength: Math.max(safeNumber(input.value), 0) }
        }
        if (field === 'bedNo') return { ...bed, bedNo: input.value, bedName: input.value }
        return { ...bed, remark: input.value }
      })
      return applySchemeBedsToPlan(plan, beds)
    })
  }

  const foldFieldNode = target.closest<HTMLElement>('[data-marker-plan-fold-field]')
  if (foldFieldNode) {
    const field = foldFieldNode.dataset.markerPlanFoldField as MarkerPlanFoldField | undefined
    const input = foldFieldNode as HTMLInputElement | HTMLSelectElement
    if (!field) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      foldConfig: {
        ...(plan.foldConfig || {
          originalEffectiveWidth: 168,
          foldAllowance: 2,
          foldDirection: '对边折入',
          foldedEffectiveWidth: 83,
          maxLayoutWidth: 80,
          widthCheckPassed: true,
        }),
        [field]:
          field === 'foldDirection'
            ? input.value
            : Math.max(safeNumber(input.value), 0),
      } as MarkerFoldConfig,
    }))
  }

  const mappingFieldNode = target.closest<HTMLElement>('[data-marker-plan-mapping-field]')
  if (mappingFieldNode) {
    const field = mappingFieldNode.dataset.markerPlanMappingField || ''
    const input = mappingFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (field === 'targetSku') state.mappingDraft.targetSku = input.value
    if (field === 'colorMode') state.mappingDraft.colorMode = input.value as MarkerPlanMappingDraft['colorMode']
    if (field === 'specifiedColor') state.mappingDraft.specifiedColor = input.value
    if (field === 'partCode') state.mappingDraft.partCode = input.value
    if (field === 'patternCode') state.mappingDraft.patternCode = input.value
    if (field === 'piecePerGarment') state.mappingDraft.piecePerGarment = Math.max(Math.round(safeNumber(input.value)), 0)
    if (field === 'note') state.mappingDraft.note = input.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-marker-plan-action]')
  const action = actionNode?.dataset.markerPlanAction
  if (!action || !actionNode) return false
  return handleAction(action, actionNode)
}

export function isCraftCuttingMarkerPlanDialogOpen(): boolean {
  return state.contextDrawerOpen || state.mappingDrawerOpen
}
