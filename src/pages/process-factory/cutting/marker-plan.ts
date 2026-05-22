import { renderDrawer as uiDrawer } from '../../../components/ui/index.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildMarkerPlanProjection,
} from './marker-plan-projection.ts'
import { buildMarkerSchemeFromPlan, validateMarkerSchemeSourceCandidates } from './marker-scheme-adapter.ts'
import {
  buildMarkerPlanBalanceRows,
  buildMarkerDemandMatchSummary,
  buildCombinedMarkerPlanContextCandidate,
  buildMarkerPlanContextTypeOptions,
  buildMarkerPlanGoSpreadingPath,
  buildMarkerPlanModeOptions,
  cloneMarkerPlanAsNewDraft,
  createMarkerPlanFromContext,
  deserializeMarkerPlanStorage,
  findMarkerPlanContextById,
  findMarkerPlanContextForPlan,
  getMarkerPlanInitialEditTab,
  getMarkerPlanReferencedWarning,
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
  type MarkerPlanStatusKey,
  type MarkerPlanTabKey,
  type MarkerSchemeBed,
  type MarkerSchemeDemandRow,
} from './marker-plan-domain.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'

type MarkerPlanRouteKind = 'LIST' | 'CREATE' | 'EDIT' | 'DETAIL' | 'OTHER'
type MarkerPlanListTab = 'ALL' | 'WAITING_LAYOUT' | 'DEMAND_DIFF' | 'WAITING_CONFIRM' | 'READY_FOR_SPREADING' | 'EXCEPTIONS'
type MarkerPlanListFilterField = 'keyword' | 'contextNo' | 'markerNo' | 'contextType' | 'mode' | 'status' | 'ready'
type MarkerPlanCreateStepKey = 'source' | 'layout' | 'match'
type MarkerPlanContextField = 'contextKeyword'
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
  draftPlan: MarkerPlan | null
  contextDrawerOpen: boolean
  contextKeyword: string
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
  draftPlan: null,
  contextDrawerOpen: false,
  contextKeyword: '',
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

function validateSchemeSourceCandidates(contexts: MarkerPlanContextCandidate[]): { ok: boolean; message: string } {
  const result = validateMarkerSchemeSourceCandidates(
    contexts.map((context) => ({
      contextNo: context.contextNo,
      markerPlanGroupKey: context.markerPlanGroupKey,
      spuCode: context.spuCode,
      productionOrderIds: context.productionOrderIds,
      productionOrderNos: context.productionOrderNos,
      techPackStatusLabel: context.techPackStatusLabel,
      materialSkuSummary: context.materialSkuSummary,
    })),
  )
  return {
    ok: result.passed,
    message: result.messages.join('；'),
  }
}

const LIST_PATH = '/fcs/craft/cutting/marker-list'
const CREATE_PATH = '/fcs/craft/cutting/marker-create'
const EDIT_BASE_PATH = '/fcs/craft/cutting/marker-edit'
const DETAIL_BASE_PATH = '/fcs/craft/cutting/marker-detail'
const MARKER_PLAN_TOP_INFO_OFFSET_VAR = '--marker-plan-top-info-offset'

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
    return { label: '待排唛架', countLabel: '待排唛架方案数' }
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

function getContextMap(viewModel = getViewModel()): Record<string, MarkerPlanContextCandidate> {
  return Object.fromEntries(viewModel.contexts.map((context) => [context.contextKey, context]))
}

function getSelectedDrawerContexts(viewModel = getViewModel()): MarkerPlanContextCandidate[] {
  const contextMap = getContextMap(viewModel)
  const selectableContextKeys = new Set(getSelectableMarkerSourceContexts(viewModel).map((context) => context.contextKey))
  return state.selectedContextKeys
    .map((contextKey) => contextMap[contextKey] || null)
    .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
    .filter((context) => selectableContextKeys.has(context.contextKey))
}

function getContextSpuCodes(contexts: MarkerPlanContextCandidate[]): string[] {
  return Array.from(new Set(contexts.map((context) => String(context.spuCode || '').trim()).filter(Boolean)))
}

function isSelectableMarkerSourceContext(context: MarkerPlanContextCandidate): boolean {
  return (
    context.contextType === 'cut-order' &&
    context.sourceCutOrderRows.length > 0 &&
    context.sourceCutOrderRows.every((row) => row.cuttableState.key === 'CUTTABLE')
  )
}

function getSelectableMarkerSourceContexts(viewModel = getViewModel()): MarkerPlanContextCandidate[] {
  return viewModel.pendingContexts.filter(isSelectableMarkerSourceContext)
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
  if (!contexts.length) return { ok: false, message: '请先选择可排唛架裁片单。' }
  if (contexts.some((context) => !isSelectableMarkerSourceContext(context))) {
    return { ok: false, message: '只能选择可排唛架裁片单进入唛架方案。' }
  }
  const spuCodes = getContextSpuCodes(contexts)
  if (spuCodes.length > 1) {
    return { ok: false, message: `所选可排唛架裁片单属于多个 SPU：${spuCodes.join(' / ')}，不能进入下一步。` }
  }
  const schemeValidation = validateSchemeSourceCandidates(contexts)
  if (!schemeValidation.ok) return schemeValidation
  return { ok: true, message: '' }
}

function syncContextDrawerSelectionDom(viewModel = getViewModel()): void {
  if (typeof document === 'undefined') return
  const selectedContexts = getSelectedDrawerContexts(viewModel)
  const selectedSpuCodes = getContextSpuCodes(selectedContexts)
  const selectionValidation = validateMarkerPlanSourceSelection(selectedContexts)
  const selectedSummary = selectedContexts.length
    ? `已选 ${selectedContexts.length} 个可排唛架裁片单${selectedSpuCodes.length === 1 ? `，SPU：${selectedSpuCodes[0]}` : ''}`
    : '请先选择可排唛架裁片单'
  const summaryNode = document.querySelector<HTMLElement>('[data-marker-plan-selection-summary]')
  const messageNode = document.querySelector<HTMLElement>('[data-marker-plan-selection-message]')
  const confirmButton = document.querySelector<HTMLButtonElement>('[data-marker-plan-action="confirm-context-create"]')
  summaryNode && (summaryNode.textContent = selectedSummary)
  messageNode && (messageNode.textContent = selectionValidation.ok ? '可继续编辑唛架。' : selectionValidation.message)
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

function mountContextDrawerDom(viewModel = getViewModel()): void {
  const root = getMarkerPlanPageRoot()
  if (!root) return
  removeContextDrawerDom()
  root.insertAdjacentHTML('beforeend', renderContextDrawer(viewModel))
  const drawerShell = root.querySelector<HTMLElement>('[data-marker-plan-context-drawer-shell]')
  if (drawerShell) hydrateIcons(drawerShell)
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

function navigateToCreateWithContext(context: MarkerPlanContextCandidate): void {
  const params = new URLSearchParams({
    contextKey: context.contextKey,
    tab: 'layout',
  })
  appStore.navigate(`${CREATE_PATH}?${params.toString()}`)
}

function navigateToCreateWithContexts(contexts: MarkerPlanContextCandidate[]): void {
  if (contexts.length === 1) {
    navigateToCreateWithContext(contexts[0])
    return
  }
  const params = new URLSearchParams()
  contexts.forEach((context) => params.append('contextKey', context.contextKey))
  params.set('tab', 'layout')
  appStore.navigate(`${CREATE_PATH}?${params.toString()}`)
}

function navigateToCreateByCopy(planId: string): void {
  const params = new URLSearchParams({ copyFrom: planId })
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

  if (route.kind === 'LIST') {
    state.draftPlan = null
    state.activeTab = 'basic'
    state.contextDrawerOpen = false
    state.selectedContextKeys = []
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
    return
  }

  if (route.kind === 'CREATE') {
    const copyFrom = params.get('copyFrom') || ''
    const contextKeys = params.getAll('contextKey').filter(Boolean)
    if (copyFrom) {
      if (!state.draftPlan) {
        const sourcePlan = viewModel.plansById[copyFrom]
        state.draftPlan = sourcePlan ? cloneMarkerPlanAsNewDraft(sourcePlan, viewModel.plans.map((plan) => plan)) : null
        state.activeTab = 'basic'
      }
      state.contextDrawerOpen = !Boolean(state.draftPlan)
      state.mappingDrawerOpen = false
      state.mappingTargetRowId = ''
      state.referencedStructureEditConfirmed = false
      return
    }
    if (contextKeys.length) {
      const contextMap = Object.fromEntries(
        getSelectableMarkerSourceContexts(viewModel).map((context) => [context.contextKey, context]),
      )
      const contexts = contextKeys
        .map((contextKey) => contextMap[contextKey] || null)
        .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
      const baseValidation = validateMarkerPlanSourceSelection(contexts)
      const schemeValidation = baseValidation.ok ? validateSchemeSourceCandidates(contexts) : baseValidation
      const combinedContext = schemeValidation.ok ? buildCombinedMarkerPlanContextCandidate(contexts) : null
      state.draftPlan = combinedContext ? createMarkerPlanFromContext({ context: combinedContext, existingPlans: viewModel.plans }) : null
      state.activeTab = resolvedTab || 'basic'
      state.contextDrawerOpen = !Boolean(state.draftPlan)
      state.selectedContextKeys = contexts.map((context) => context.contextKey)
      state.mappingDrawerOpen = false
      state.mappingTargetRowId = ''
      state.referencedStructureEditConfirmed = false
      if (!schemeValidation.ok) setFeedback('warning', schemeValidation.message)
      return
    }
    state.draftPlan = null
    state.activeTab = 'basic'
    state.contextDrawerOpen = true
    state.selectedContextKeys = []
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
    return
  }

  if (route.kind === 'EDIT') {
    const sourcePlan = viewModel.plansById[route.id] ?? null
    state.draftPlan = sourcePlan ? hydrateMarkerPlan(sourcePlan, getDraftContext(viewModel) || findMarkerPlanContextForPlan(viewModel.contexts, sourcePlan)!) : null
    state.activeTab = sourcePlan ? resolvedTab || getMarkerPlanInitialEditTab(sourcePlan) : 'basic'
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
  if (route === 'LIST') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('新建排唛架方案', 'data-marker-plan-action="go-create"', 'primary')}
        ${renderActionButton('导出', 'data-marker-plan-action="export-list"')}
        ${renderActionButton('重置筛选', 'data-marker-plan-action="reset-filters"')}
      </div>
    `
  }

  if (route === 'CREATE') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('返回列表', 'data-marker-plan-action="go-list"')}
        ${renderActionButton('保存草稿', 'data-marker-plan-action="save-draft"', 'secondary', !plan)}
        ${renderActionButton('完成计划', 'data-marker-plan-action="complete-plan"', 'primary', !plan)}
        ${renderActionButton('保存并查看详情', 'data-marker-plan-action="save-and-view-detail"', 'secondary', !plan)}
      </div>
    `
  }

  if (route === 'EDIT') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('返回详情', `data-marker-plan-action="go-detail"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
        ${renderActionButton('保存草稿', 'data-marker-plan-action="save-draft"', 'secondary', !plan)}
        ${renderActionButton('完成计划', 'data-marker-plan-action="complete-plan"', 'primary', !plan)}
        ${renderActionButton('保存并留在当前页', 'data-marker-plan-action="save-plan"', 'secondary', !plan)}
        ${renderActionButton('复制为新方案', `data-marker-plan-action="copy-plan"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
        ${renderActionButton('作废', 'data-marker-plan-action="cancel-plan"', 'secondary', !plan)}
        ${renderActionButton('交给铺布', `data-marker-plan-action="go-spreading"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'primary', !plan || !plan.readyForSpreading || plan.status === 'CANCELED')}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      ${renderActionButton('返回列表', 'data-marker-plan-action="go-list"')}
      ${renderActionButton('交给铺布', `data-marker-plan-action="go-spreading"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'primary', !plan || !plan.readyForSpreading)}
      ${renderActionButton('去裁片单', `data-marker-plan-action="go-cut-orders"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan || !plan.cutOrderIds.length)}
      ${plan?.markerPlanId ? renderActionButton('去唛架方案', `data-marker-plan-action="go-marker-plan-ref" data-plan-id="${escapeHtml(plan.id)}"`, 'secondary') : ''}
      ${renderActionButton('去生产单进度', `data-marker-plan-action="go-production-progress"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
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

function buildGoMarkerPlanRefPath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('marker-list'), {
    focusBatchId: plan.markerPlanId || undefined,
  })
}

function buildGoMarkerPlanRefPathFromContext(context: MarkerPlanContextCandidate): string {
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
    return { ok: false, tab: 'basic', message: '请先选择可排唛架裁片单，再完成计划。' }
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
        `data-marker-plan-action="go-marker-plan-ref" data-marker-plan-ref-id="${escapeHtml(plan.markerPlanId)}" data-marker-plan-ref-no="${escapeHtml(plan.markerPlanNo)}"`,
        'amber',
      )
    : '<span class="text-xs text-muted-foreground">—</span>'
  const productionChips = plan.productionOrderNos.length
    ? plan.productionOrderNos
        .map((productionOrderNo, index) =>
          renderTopInfoChip(
            productionOrderNo,
            `data-marker-plan-action="go-production-progress" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || '')}" data-production-order-no="${escapeHtml(productionOrderNo)}" data-style-code="${escapeHtml(plan.styleCode || '')}" data-spu-code="${escapeHtml(plan.spuCode || '')}" data-material-sku="${escapeHtml(plan.sourceMaterialSku || '')}" data-cut-order-id="${escapeHtml(plan.cutOrderIds[index] || '')}" data-cut-order-no="${escapeHtml(plan.cutOrderNos[index] || '')}" data-marker-plan-ref-id="${escapeHtml(plan.markerPlanId || '')}" data-marker-plan-ref-no="${escapeHtml(plan.markerPlanNo || '')}"`,
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
                ${plan.markerPlanId ? renderActionButton('去唛架方案', `data-marker-plan-action="go-marker-plan-ref"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`) : ''}
                ${renderActionButton('去生产单进度', `data-marker-plan-action="go-production-progress"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`)}
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
    { key: 'basic', label: '排唛架来源' },
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
    basic: '排唛架来源',
      explosion: '需求匹配与确认',
    layout: '编辑唛架',
  }
  return labels[tab] || '排唛架来源'
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

function getCreateStepStatus(plan: MarkerPlan | null, step: MarkerPlanCreateStepKey): string {
  if (step === 'source') return plan ? '已选择' : '当前'
  if (!plan) return '未开始'
  if (step === 'layout') return markerLayoutStatusMeta[plan.layoutStatus]?.label || '待编辑'
  if (step === 'match') return getPlanDemandMatchSummary(plan).status
  return '未开始'
}

function renderCreateStepNav(plan: MarkerPlan | null): string {
  const activeStep = state.contextDrawerOpen ? 'source' : plan ? getCreateStepFromActiveTab(state.activeTab) : 'source'
  const steps: Array<{ key: MarkerPlanCreateStepKey; title: string; hint: string }> = [
    { key: 'source', title: '排唛架来源', hint: '可排唛架裁片单' },
    { key: 'layout', title: '编辑唛架', hint: '唛架模式、层数、长度' },
    { key: 'match', title: '需求匹配与确认', hint: '来源需求 / 唛架产出 / 业务确认' },
  ]

  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-create-step-nav">
      <div class="flex gap-3 overflow-x-auto pb-1">
        ${steps
          .map((step, index) => {
            const active = activeStep === step.key
            const disabled = step.key !== 'source' && !plan
            const status = getCreateStepStatus(plan, step.key)
            return `
              <button
                type="button"
                class="min-w-[190px] rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : disabled
                      ? 'cursor-not-allowed bg-muted/40 text-muted-foreground'
                      : 'bg-background hover:border-blue-300 hover:bg-blue-50/40'
                }"
                data-marker-plan-action="switch-create-step"
                data-create-step="${step.key}"
                ${disabled ? 'disabled' : ''}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold">${index + 1}. ${escapeHtml(step.title)}</span>
                  <span class="rounded-full border bg-white px-1.5 py-0.5 text-[10px]">${escapeHtml(status)}</span>
                </div>
                <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(step.hint)}</div>
              </button>
            `
          })
          .join('')}
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
        ${renderReadonlyField('系统单件成衣用量（m/件）', `${formatNumber(plan.systemUnitUsage, 3)} m/件`, buildMarkerPlanSystemUnitUsageFormula(plan))}
        ${renderInputField('人工修正单件成衣用量（m/件）', plan.manualUnitUsage ? String(plan.manualUnitUsage) : '', 'manualUnitUsage', 'number')}
        ${renderReadonlyField('最终单件成衣用量（m/件）', `${formatNumber(plan.finalUnitUsage, 3)} m/件`, buildMarkerFinalUnitUsageFormula(plan.systemUnitUsage, plan.manualUnitUsage))}
      </div>
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
            <th class="w-28 px-3 py-3 text-left font-medium">颜色</th>
            <th class="w-44 px-3 py-3 text-left font-medium">物料信息</th>
            ${sizeColumns.map((size) => `<th class="px-3 py-3 font-medium"><div>${escapeHtml(size)}</div><div class="mt-1 text-[10px] text-muted-foreground">每层件数 ${formatCount(sizePiecePerLayer[size] || 0)}</div><div class="mt-1 text-[10px] text-muted-foreground">需求 ${formatCount(sizeDemandMap[size] || 0)}</div></th>`).join('')}
            ${highLowMode ? '<th class="px-3 py-3 font-medium">唛架净长度</th>' : ''}
            <th class="px-3 py-3 font-medium">行合计</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${rows.map((row) => {
            const rowTotal = sizeColumns.reduce((total, size) => total + getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer), 0)
            const materialText = getMarkerMatrixMaterialForColor(plan, row.colorName || row.colorCode)
            return `
              <tr>
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
              <div class="grid gap-2 md:grid-cols-4">
                ${renderReadonlyField('唛架净长度', isHighLowMatrixMode(bed.bedMode) ? '按颜色行填写' : `${formatNumber(bed.markerLength, 2)} m`)}
                ${renderReadonlyField('实际铺布层数', `${formatNumber(bed.plannedLayerCount, 0)} 层`)}
                ${renderReadonlyField('成衣数量', `${formatCount(bed.plannedGarmentQty)} 件`)}
                ${renderReadonlyField('铺布总长度', `${formatNumber(bed.spreadTotalLength, 2)} m`)}
              </div>
              ${renderMarkerMatrixReadonlyTable(plan, bed)}
            </article>
          `).join('')
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-xs text-muted-foreground">当前还没有唛架编号。</div>'}
      </div>
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
            ${rows.map((row) => {
              const rowTotal = sizeColumns.reduce((total, size) => total + getMarkerMatrixCellPlannedQty(row, size, sizePiecePerLayer), 0)
              const materialText = getMarkerMatrixMaterialForColor(plan, row.colorName || row.colorCode)
              return `
                <tr>
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
              <div class="grid gap-2 md:grid-cols-4">
                ${renderReadonlyField('实际铺布层数', `${formatNumber(bed.plannedLayerCount, 0)} 层`)}
                ${renderReadonlyField('成衣数量', `${formatCount(bed.plannedGarmentQty)} 件`)}
                ${renderReadonlyField('铺布总长度', `${formatNumber(bed.spreadTotalLength, 2)} m`)}
                ${renderReadonlyField('单件成衣用量', `${formatNumber(bed.unitFabricUsage, 3)} m/件`)}
              </div>
              ${renderMarkerMatrixEditor(plan, bed)}
            </article>
          `).join('')
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-xs text-muted-foreground">当前还没有唛架编号。</div>'}
      </div>
    </section>
  `
}

function renderDetailPreviewAndFlow(plan: MarkerPlanViewRow, context: MarkerPlanContextCandidate | null): string {
  return `
    ${renderDetailStepNav(plan)}
    ${renderPlanTopInfo(plan, context, { showActionRow: false })}
    ${renderSchemeDemandMatrix(plan)}
    ${renderExplosionTab(plan, context, true)}
    ${renderLayoutReadonlyTab(plan)}
  `
}

function renderDetailStepNav(plan: MarkerPlanViewRow): string {
  const matchSummary = getPlanDemandMatchSummary(plan)
  const steps = [
    { title: '1. 排唛架来源', status: '已确认' },
    { title: '2. 编辑唛架', status: plan.layoutStatusMeta.label },
    { title: '3. 需求匹配与确认', status: matchSummary.status },
  ]
  return `
    <section class="rounded-lg border bg-card p-1.5" data-testid="marker-plan-detail-step-nav">
      <div class="grid gap-1.5 md:grid-cols-3">
        ${steps
          .map(
            (step) => `
              <article class="rounded-lg border bg-background px-3 py-3">
                <div class="text-sm font-semibold text-foreground">${escapeHtml(step.title)}</div>
                <div class="mt-1">${renderStatusBadge(step.status, 'border-slate-200 bg-slate-50 text-slate-700')}</div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
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
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
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
        <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-marker-plan-action="reset-filters">重置筛选</button>
      </div>
      <details class="rounded-md border bg-background" data-testid="marker-plan-more-filters">
        <summary class="cursor-pointer list-none px-3 py-3 text-sm font-medium text-foreground">更多筛选</summary>
        <div class="border-t p-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">裁片单范围</span>
              <select data-marker-plan-filter-field="contextType" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">全部</option>
                ${buildMarkerPlanContextTypeOptions().map((option) => `<option value="${option.value}" ${option.value === state.filters.contextType ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
              </select>
            </label>
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
  `, '', 'data-testid="marker-plan-list-filters"')
}

function renderStats(viewModel = getViewModel()): string {
  const plans = viewModel.plans
  const readyCount = plans.filter((plan) => plan.readyForSpreading).length
  const diffCount = getPlanListTabCount('DEMAND_DIFF', plans)
  const waitingConfirmCount = getPlanListTabCount('WAITING_CONFIRM', plans)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="marker-plan-list-stats">
      ${renderCompactKpiCard('方案总数', plans.length, `可交接 ${readyCount}`, 'text-slate-900', `全部 ${plans.length} 个方案`)}
      ${renderCompactKpiCard('待排唛架', getPlanListTabCount('WAITING_LAYOUT', plans), '唛架未完成', 'text-blue-600', `${getPlanListTabCount('WAITING_LAYOUT', plans)} 个方案`)}
      ${renderCompactKpiCard('需求差异', diffCount, `待确认 ${waitingConfirmCount}`, 'text-amber-600', `${diffCount} 个方案`)}
      ${renderCompactKpiCard('可交接铺布', readyCount, '已确认方案', 'text-emerald-600', `${readyCount} 个方案`)}
    </section>
  `
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
        <table class="min-w-[1960px] text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-2 py-1 font-medium">方案编号</th>
              <th class="px-2 py-1 font-medium">裁片单范围</th>
              <th class="px-2 py-1 font-medium">裁片单号</th>
              <th class="px-2 py-1 font-medium">生产单号</th>
              <th class="px-2 py-1 font-medium">款号 / SPU</th>
              <th class="px-2 py-1 font-medium">面料 / 颜色</th>
              <th class="px-2 py-1 font-medium">技术包</th>
              <th class="px-2 py-1 font-medium">唛架数量</th>
              <th class="px-2 py-1 font-medium">唛架模式</th>
              <th class="px-2 py-1 font-medium">计划裁片数</th>
              <th class="px-2 py-1 font-medium">需求匹配</th>
              <th class="px-2 py-1 font-medium">差异</th>
              <th class="px-2 py-1 font-medium">业务确认</th>
              <th class="px-2 py-1 font-medium">铺布状态</th>
              <th class="px-2 py-1 font-medium">主状态</th>
              <th class="px-2 py-1 font-medium">最近更新</th>
              <th class="px-2 py-1 font-medium">操作</th>
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
                      return `
                      <tr class="border-t align-top ${exceptionOnly ? 'cursor-pointer hover:bg-muted/10' : ''}" ${
                        exceptionOnly
                          ? `data-marker-plan-action="open-problem-detail" data-plan-id="${escapeHtml(row.id)}" data-tab-key="${problemTab}"`
                          : ''
                      }>
                        <td class="px-2 py-1">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span class="font-medium">${escapeHtml(row.markerNo)}</span>
                          </div>
                        </td>
                        <td class="px-2 py-1">${escapeHtml(getPlanSourceTypeText(row))}</td>
                        <td class="px-2 py-1">${escapeHtml(getPlanSourceNoText(row))}</td>
                        <td class="px-2 py-1">${escapeHtml(row.productionOrderSummary || '—')}</td>
                        <td class="px-2 py-1 font-medium">${escapeHtml(`${row.styleCode || '-'} / ${row.spuCode || '-'}`)}</td>
                        <td class="px-2 py-1">
                          ${renderMaterialIdentityBlock({
                            materialSku: row.materialSkuSummary || '—',
                            materialLabel: row.materialSkuSummary || '—',
                            materialAlias: row.materialAliasSummary,
                            materialImageUrl: row.materialImageUrl,
                          }, { compact: true })}
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.colorSummary || '—')}</div>
                        </td>
                        <td class="px-2 py-1">${escapeHtml(getPlanTechPackText(row))}</td>
                        <td class="px-2 py-1">${escapeHtml(getPlanBedCountText(row))}</td>
                        <td class="px-2 py-1">${escapeHtml(getPlanBedModeText(row))}</td>
                        <td class="px-2 py-1">${renderCompactListValueWithFormula(`${formatCount(row.totalPieces)} 件`, row.totalPiecesFormula)}</td>
                        <td class="px-2 py-1">${renderStatusBadge(matchMeta.label, matchMeta.className)}</td>
                        <td class="px-2 py-1">
                          <div class="text-xs text-muted-foreground">不足 ${formatCount(row.demandMatchSummary.shortageQty)} / 超出 ${formatCount(row.demandMatchSummary.surplusQty)}</div>
                        </td>
                        <td class="px-2 py-1">${renderStatusBadge(confirmationMeta.label, confirmationMeta.className)}</td>
                        <td class="px-2 py-1">${escapeHtml(getPlanSpreadingStatusText(row))}</td>
                        <td class="px-2 py-1">${renderStatusBadge(row.statusMeta.label, row.statusMeta.className)}</td>
                        <td class="px-2 py-1">${escapeHtml(row.updatedAt || '—')}</td>
                        <td class="px-2 py-1">
                          <div class="flex flex-nowrap gap-1.5 overflow-x-auto whitespace-nowrap">
                            ${renderActionButton('查看详情', `data-marker-plan-action="go-detail" data-plan-id="${escapeHtml(row.id)}"${exceptionOnly ? ` data-tab-key="${problemTab}"` : ''}`)}
                            ${row.status === 'READY_FOR_SPREADING' ? '' : renderActionButton('继续编辑', `data-marker-plan-action="go-edit" data-plan-id="${escapeHtml(row.id)}"${exceptionOnly ? ` data-tab-key="${problemTab}"` : ''}`)}
                            ${row.readyForSpreading ? renderActionButton('交给铺布', `data-marker-plan-action="go-spreading" data-plan-id="${escapeHtml(row.id)}"`, 'primary') : ''}
                          </div>
                        </td>
                      </tr>
                    `})
                    .join('')
                : `<tr><td colspan="17" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有排唛架方案。</td></tr>`
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

function renderContextDrawer(viewModel = getViewModel()): string {
  if (!state.contextDrawerOpen) return ''
  const candidates = filterMarkerSourceContextsByKeyword(getSelectableMarkerSourceContexts(viewModel))
  const selectedContexts = getSelectedDrawerContexts(viewModel)
  const selectedSpuCodes = getContextSpuCodes(selectedContexts)
  const selectionValidation = validateMarkerPlanSourceSelection(selectedContexts)
  const selectedSummary = selectedContexts.length
    ? `已选 ${selectedContexts.length} 个可排唛架裁片单${selectedSpuCodes.length === 1 ? `，SPU：${selectedSpuCodes[0]}` : ''}`
    : '请先选择可排唛架裁片单'

  const content = `
    <div class="space-y-4" data-testid="marker-plan-context-drawer">
      <div class="grid gap-3">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">搜索</span>
          <input type="text" value="${escapeHtml(state.contextKeyword)}" data-marker-plan-context-field="contextKeyword" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>
      <div class="rounded-lg border ${selectionValidation.ok ? 'border-blue-100 bg-blue-50 text-blue-700' : selectedContexts.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'} px-3 py-3 text-xs">
        <div class="font-medium" data-marker-plan-selection-summary>${escapeHtml(selectedSummary)}</div>
        <div class="mt-1" data-marker-plan-selection-message>${escapeHtml(selectionValidation.ok ? '可继续编辑唛架。' : selectionValidation.message)}</div>
      </div>
      <div class="overflow-hidden rounded-lg border bg-background">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-3 font-medium">选择</th>
              <th class="px-3 py-3 font-medium">可排唛架裁片单号</th>
              <th class="px-3 py-3 font-medium">生产单号</th>
              <th class="px-3 py-3 font-medium">款号 / SPU</th>
              <th class="px-3 py-3 font-medium">面料</th>
              <th class="px-3 py-3 font-medium">颜色</th>
              <th class="px-3 py-3 font-medium">技术包状态</th>
              <th class="px-3 py-3 font-medium">待加工仓状态</th>
            </tr>
          </thead>
          <tbody>
            ${
              candidates.length
                ? candidates
                    .map((context) => `
                      <tr class="border-t ${state.selectedContextKeys.includes(context.contextKey) ? 'bg-blue-50/40' : ''}" data-marker-plan-context-row data-context-key="${escapeHtml(context.contextKey)}">
                        <td class="px-3 py-3">
                          <input type="checkbox" value="${escapeHtml(context.contextKey)}" data-marker-plan-action="select-context" data-context-key="${escapeHtml(context.contextKey)}" ${state.selectedContextKeys.includes(context.contextKey) ? 'checked' : ''} />
                        </td>
                        <td class="px-3 py-3 font-medium">${escapeHtml(context.contextNo)}</td>
                        <td class="px-3 py-3">${escapeHtml(context.productionOrderNos.join(' / '))}</td>
                        <td class="px-3 py-3">
                          <div class="font-medium">${escapeHtml(context.styleCode || context.spuCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.styleName || '—')}</div>
                        </td>
                        <td class="px-3 py-3">${renderMaterialIdentityBlock({
                          materialSku: context.materialSkuSummary || '—',
                          materialLabel: context.materialSkuSummary || '—',
                          materialAlias: context.materialAliasSummary,
                          materialImageUrl: context.materialImageUrl,
                        }, { compact: true })}</td>
                        <td class="px-3 py-3">${escapeHtml(context.colorSummary || '—')}</td>
                        <td class="px-3 py-3">${escapeHtml(context.techPackStatusLabel)}</td>
                        <td class="px-3 py-3">${escapeHtml(context.prepStatusLabel)}</td>
                      </tr>
                    `)
                    .join('')
                : `<tr><td colspan="8" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有可排唛架裁片单。</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `

  const drawerHtml = uiDrawer(
    {
      title: '新建排唛架方案：选择可排唛架裁片单',
      subtitle: '',
      closeAction: { prefix: 'marker-plan', action: 'close-context-drawer' },
      width: 'xl',
    },
    content,
    {
      cancel: { prefix: 'marker-plan', action: 'close-context-drawer', label: '取消' },
      confirm: {
        prefix: 'marker-plan',
        action: 'confirm-context-create',
        label: '下一步：编辑唛架',
        variant: 'primary',
        disabled: !selectionValidation.ok,
      },
    },
  )
  return `<div data-marker-plan-context-drawer-shell>${drawerHtml}</div>`
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
      ${renderStats(viewModel)}
      ${renderListTabs(state.listTab, viewModel)}
      ${renderListFilters()}
      ${renderListStateBar()}
      ${mainContent}
    </div>
  `
}

function renderEditorWarning(plan: MarkerPlanViewRow | null): string {
  if (!plan) return ''
  const warningText = getMarkerPlanReferencedWarning(plan)
  if (!warningText) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3.5 text-sm text-amber-700">
      ${escapeHtml(warningText)}
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
  const title = options.title || '当前来源'
  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-create-source-summary">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderReadonlyField('可排唛架裁片单', sourceNo)}
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
      </div>
    </section>
  `
}

function renderSelectedSourcePanel(
  selectedContexts: MarkerPlanContextCandidate[],
  selectionValidation: { ok: boolean; message: string },
): string {
  return `
    <section class="rounded-xl border bg-background p-4" data-testid="marker-plan-selected-source-panel">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold">已选可排唛架裁片单</h4>
          <div class="mt-0.5 text-xs text-muted-foreground">已选 ${selectedContexts.length} 个</div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${renderActionButton('清空已选', 'data-marker-plan-action="clear-selected-contexts"', 'secondary', !selectedContexts.length)}
          ${renderActionButton('确认来源并进入下一步', 'data-marker-plan-action="confirm-context-create"', 'primary', !selectionValidation.ok)}
        </div>
      </div>
      ${
        selectedContexts.length
          ? `
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              ${selectedContexts
                .map(
                  (context) => `
                    <article class="rounded-lg border bg-card p-3">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="text-xs text-muted-foreground">可排唛架裁片单</div>
                          <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(context.contextNo)}</div>
                        </div>
                        <button
                          type="button"
                          class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          data-marker-plan-action="remove-selected-context"
                          data-context-key="${escapeHtml(context.contextKey)}"
                        >
                          移除
                        </button>
                      </div>
                      <div class="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <div>生产单：${escapeHtml(context.productionOrderNos.join(' / ') || '—')}</div>
                        <div>款号 / SPU：${escapeHtml(`${context.styleCode || '-'} / ${context.spuCode || '-'}`)}</div>
                        <div class="rounded-md border bg-muted/10 p-2">
                          ${renderMaterialIdentityBlock({
                            materialSku: context.materialSkuSummary || '—',
                            materialLabel: context.materialSkuSummary || '—',
                            materialAlias: context.materialAliasSummary,
                            materialImageUrl: context.materialImageUrl,
                          }, { compact: true })}
                          <div class="mt-1 text-xs text-muted-foreground">颜色：${escapeHtml(context.colorSummary || '—')}</div>
                        </div>
                        <div>技术包：${escapeHtml(context.techPackStatusLabel)}</div>
                      </div>
                    </article>
                  `,
                )
                .join('')}
            </div>
            ${
              selectionValidation.ok
                ? ''
                : `<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">${escapeHtml(selectionValidation.message)}</div>`
            }
          `
          : '<div class="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">暂无已选可排唛架裁片单</div>'
      }
    </section>
  `
}

function renderCreateSourceStep(viewModel = getViewModel()): string {
  const candidates = filterMarkerSourceContextsByKeyword(getSelectableMarkerSourceContexts(viewModel))
  const selectedContexts = getSelectedDrawerContexts(viewModel)
  const selectionValidation = validateMarkerPlanSourceSelection(selectedContexts)

  return `
    <section class="rounded-xl border bg-card p-4" data-testid="marker-plan-create-source-step">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">选择可排唛架裁片单</h3>
      </div>
      <div class="grid gap-3">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">搜索</span>
          <input type="text" value="${escapeHtml(state.contextKeyword)}" data-marker-plan-context-field="contextKeyword" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>
      <div class="mt-4">${renderSelectedSourcePanel(selectedContexts, selectionValidation)}</div>
      <div class="mt-4 overflow-hidden rounded-lg border bg-background">
        <div class="border-b px-4 py-3 text-sm font-semibold">可排唛架裁片单</div>
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-3 font-medium">选择</th>
              <th class="px-3 py-3 font-medium">可排唛架裁片单号</th>
              <th class="px-3 py-3 font-medium">生产单号</th>
              <th class="px-3 py-3 font-medium">款号 / SPU</th>
              <th class="px-3 py-3 font-medium">面料</th>
              <th class="px-3 py-3 font-medium">颜色</th>
              <th class="px-3 py-3 font-medium">技术包状态</th>
              <th class="px-3 py-3 font-medium">待加工仓状态</th>
            </tr>
          </thead>
          <tbody>
            ${
              candidates.length
                ? candidates
                    .map((context) => `
                      <tr class="border-t ${state.selectedContextKeys.includes(context.contextKey) ? 'bg-blue-50/40' : ''}" data-marker-plan-context-row data-context-key="${escapeHtml(context.contextKey)}">
                        <td class="px-3 py-3">
                          <input type="checkbox" value="${escapeHtml(context.contextKey)}" data-marker-plan-action="select-context" data-context-key="${escapeHtml(context.contextKey)}" ${state.selectedContextKeys.includes(context.contextKey) ? 'checked' : ''} />
                        </td>
                        <td class="px-3 py-3 font-medium">${escapeHtml(context.contextNo)}</td>
                        <td class="px-3 py-3">${escapeHtml(context.productionOrderNos.join(' / '))}</td>
                        <td class="px-3 py-3">
                          <div class="font-medium">${escapeHtml(context.styleCode || context.spuCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.styleName || '—')}</div>
                        </td>
                        <td class="px-3 py-3">${renderMaterialIdentityBlock({
                          materialSku: context.materialSkuSummary || '—',
                          materialLabel: context.materialSkuSummary || '—',
                          materialAlias: context.materialAliasSummary,
                          materialImageUrl: context.materialImageUrl,
                        }, { compact: true })}</td>
                        <td class="px-3 py-3">${escapeHtml(context.colorSummary || '—')}</td>
                        <td class="px-3 py-3">${escapeHtml(context.techPackStatusLabel)}</td>
                        <td class="px-3 py-3">${escapeHtml(context.prepStatusLabel)}</td>
                      </tr>
                    `)
                    .join('')
                : `<tr><td colspan="8" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有可排唛架裁片单。</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderCreateDemandStep(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  return `
    <section class="rounded-lg border bg-card p-3" data-testid="marker-plan-create-demand-step">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">排唛架来源</h3>
        </div>
        ${renderStatusBadge(context?.techPackStatusLabel || '技术包待确认', 'border-blue-200 bg-blue-50 text-blue-700')}
      </div>
      <div class="grid gap-3 lg:grid-cols-3">
        ${renderInputField('方案编号', plan.markerNo, 'markerNo')}
        ${renderReadonlyField('可排唛架裁片单', plan.cutOrderNos.join(' / ') || context?.contextNo || '待选择')}
        ${renderReadonlyField('来源生产单', plan.productionOrderNos.join(' / ') || '—')}
        ${renderReadonlyField('正式技术包', context?.techPackStatusLabel || plan.techPackVersion || '正式版')}
      </div>
      <div class="mt-3">
        ${renderTextareaField('备注', plan.remark || '', 'remark')}
      </div>
    </section>
  `
}

function renderDemandMatchStep(plan: MarkerPlan | MarkerPlanViewRow, context: MarkerPlanContextCandidate | null, readOnly = false): string {
  const summary = getPlanDemandMatchSummary(plan)
  const statusMeta = getDemandMatchStatusMeta(summary.status)
  const confirmationMeta = getConfirmationStatusMeta(plan.confirmationStatus)
  const rows = summary.rows
  return `
    <section class="space-y-3" data-testid="marker-plan-demand-match-step">
      ${renderSchemeDemandMatrix(plan)}
      <section class="rounded-lg border bg-card p-3">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">需求匹配与确认</h3>
          <div class="flex flex-wrap gap-2">
            ${renderStatusBadge(statusMeta.label, statusMeta.className)}
            ${renderStatusBadge(confirmationMeta.label, confirmationMeta.className)}
          </div>
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
      <section class="rounded-lg border bg-card p-3">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">业务确认</h3>
          ${renderStatusBadge(confirmationMeta.label, confirmationMeta.className)}
        </div>
        ${
          readOnly
            ? `
              <div class="grid gap-3 md:grid-cols-3">
                ${renderReadonlyField('确认人', plan.confirmedBy || '—')}
                ${renderReadonlyField('确认时间', plan.confirmedAt || '—')}
                ${renderReadonlyField('确认备注', plan.confirmationRemark || '—')}
              </div>
            `
            : `
              ${renderTextareaField('确认备注', plan.confirmationRemark || '', 'confirmationRemark')}
              <div class="mt-3 flex flex-wrap justify-end gap-2">
                ${renderActionButton('标记需调整', 'data-marker-plan-action="mark-plan-adjust"', 'secondary', !plan)}
                ${renderActionButton('确认当前唛架方案', 'data-marker-plan-action="confirm-plan"', 'primary', !plan)}
              </div>
            `
        }
      </section>
    </section>
  `
}

function renderCreateEditorBody(plan: MarkerPlan | null, context: MarkerPlanContextCandidate | null): string {
  if (!plan) {
    return `
      ${renderCreateStepNav(null)}
      ${renderCreateSourceStep(getViewModel())}
    `
  }

  if (state.contextDrawerOpen) {
    return `
      ${renderCreateStepNav(plan)}
      ${renderCreateDemandStep(plan, context)}
      ${renderCreateSourceStep(getViewModel())}
    `
  }

  const activeTab = state.activeTab
  const tabContent =
    activeTab === 'basic'
      ? renderCreateDemandStep(plan, context)
      : activeTab === 'explosion'
        ? renderDemandMatchStep(plan, context)
        : renderLayoutTab(plan, context)

  return `
    ${renderCreateStepNav(plan)}
    ${renderCreateSourceSummary(plan, context)}
    ${tabContent}
    ${renderMappingRepairDrawer(plan, context)}
  `
}

function renderEditorBody(route: MarkerPlanRouteKind, plan: MarkerPlan | MarkerPlanViewRow | null, context: MarkerPlanContextCandidate | null): string {
  if (!plan) {
    return `
      <section class="rounded-lg border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
        当前还没选定可排唛架裁片单，请先选择后再编辑唛架方案。
      </section>
    `
  }

  const activeTab = state.activeTab
  const isDetail = route === 'DETAIL'
  const tabContent =
    activeTab === 'basic'
      ? (isDetail ? renderBasicTab(plan as MarkerPlan) : renderCreateDemandStep(plan as MarkerPlan, context))
      : activeTab === 'explosion'
        ? renderDemandMatchStep(plan as MarkerPlanViewRow | MarkerPlan, context, isDetail)
        : isDetail
          ? renderSchemeBedsOverview(plan as MarkerPlanViewRow | MarkerPlan)
          : renderLayoutTab(plan as MarkerPlan, context)

  return `
    ${route === 'DETAIL' ? renderDetailStepNav(plan as MarkerPlanViewRow) : renderCreateStepNav(plan as MarkerPlan)}
    ${renderPlanTopInfo(plan, context)}
    ${renderTabNav(activeTab)}
    ${tabContent}
    ${route === 'CREATE' ? renderContextDrawer(getViewModel()) : ''}
    ${!('modeMeta' in plan) ? renderMappingRepairDrawer(plan as MarkerPlan, context) : ''}
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
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('DETAIL', plan),
      })}
      ${renderFeedbackBar()}
      ${
        plan
          ? `
            ${renderDetailPreviewAndFlow(plan, context)}
          `
          : `
            <section class="rounded-lg border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
              当前未找到对应排唛架方案，请返回列表重新选择。
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
    setFeedback('warning', '请先选择可排唛架裁片单，再保存排唛架方案。')
    return null
  }
  const nextPlan = hydrateDraft(state.draftPlan, context)
  upsertStoredPlan(nextPlan)
  state.draftPlan = nextPlan
  return nextPlan
}

function saveDraftPlan(stayOnPage = true, successMessage?: string): boolean {
  const nextPlan = persistDraftPlan()
  if (!nextPlan) return true
  if (!stayOnPage) {
    appStore.navigate(buildDetailPath(nextPlan.id))
    return true
  }
  setFeedback('success', successMessage || `已保存草稿 ${nextPlan.markerNo}。`)
  return true
}

function completeDraftPlan(): boolean {
  const validation = validateDraftForCompletion()
  if (!validation.ok) {
    state.activeTab = validation.tab
    setFeedback('warning', validation.message)
    return true
  }
  const nextPlan = persistDraftPlan()
  if (!nextPlan) return true
  setFeedback('success', `已完成排唛架方案 ${nextPlan.markerNo}。`)
  return true
}

function cancelDraftPlan(): boolean {
  const route = parseRoute()
  if (route.kind !== 'EDIT' || !state.draftPlan) return false
  const context = getDraftContext(getViewModel())
  if (!context) {
    setFeedback('warning', '当前方案唛架来源已丢失，无法作废。')
    return true
  }
  const confirmed = window.confirm('确认作废当前方案唛架吗？')
  if (!confirmed) return true
  const nextPlan = hydrateMarkerPlan(
    {
      ...state.draftPlan,
      status: 'CANCELED',
      readyForSpreading: false,
      updatedAt: nowText(),
      updatedBy: '计划员-陈静',
    },
    context,
  )
  upsertStoredPlan(nextPlan)
  state.draftPlan = nextPlan
  setFeedback('success', `已作废唛架 ${nextPlan.markerNo}。`)
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
  navigateToCreateWithContexts(contexts)
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
    state.contextDrawerOpen = true
    state.contextKeyword = ''
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
      setFeedback('warning', '请先选择一个排唛架方案。')
      return true
    }
    appStore.navigate(buildMarkerPlanGoSpreadingPath(plan))
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

  if (action === 'go-marker-plan-ref') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan || !plan.markerPlanId) return false
    appStore.navigate(buildGoMarkerPlanRefPath(plan))
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
    appStore.navigate(buildGoMarkerPlanRefPathFromContext(context))
    return true
  }

  if (action === 'copy-plan') {
    const planId = node.dataset.planId || route.id
    if (!planId) return false
    navigateToCreateByCopy(planId)
    return true
  }

  if (action === 'open-context-drawer') {
    state.contextDrawerOpen = true
    state.selectedContextKeys = []
    state.contextKeyword = ''
    mountContextDrawerDom(viewModel)
    return false
  }

  if (action === 'close-context-drawer') {
    state.contextDrawerOpen = false
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
    const createStep = (node.dataset.createStep as MarkerPlanCreateStepKey | undefined) || 'source'
    if (createStep === 'source') {
      state.contextDrawerOpen = true
      return true
    }
    state.contextDrawerOpen = false
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

  if (action === 'save-and-view-detail') {
    return saveDraftPlan(false)
  }

  if (action === 'complete-plan') {
    return completeDraftPlan()
  }

  if (action === 'cancel-plan') {
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
    const input = contextFieldNode as HTMLInputElement
    if (field === 'contextKeyword') {
      state.contextKeyword = input.value
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
