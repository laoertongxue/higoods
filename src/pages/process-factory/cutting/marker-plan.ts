import { renderDrawer as uiDrawer } from '../../../components/ui'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  buildMarkerPlanProjection,
} from './marker-plan-projection'
import {
  buildMarkerPlanBalanceRows,
  buildMarkerPlanContextTypeOptions,
  buildMarkerPlanGoSpreadingPath,
  buildMarkerPlanListTabOptions,
  buildMarkerPlanModeOptions,
  cloneMarkerPlanAsNewDraft,
  cloneMarkerPlanLayoutLine,
  cloneMarkerPlanModeDetailLine,
  createEmptyMarkerPlanAllocationRow,
  createEmptyMarkerPlanLayoutLine,
  createEmptyMarkerPlanModeDetailLine,
  createMarkerPlanFromContext,
  createMarkerPlanImage,
  deleteMarkerPlanImage,
  deserializeMarkerPlanStorage,
  findMarkerPlanContextById,
  findMarkerPlanContextForPlan,
  getMarkerPlanInitialEditTab,
  getMarkerPlanReferencedWarning,
  getMarkerPlanStorageKey,
  hydrateMarkerPlan,
  replaceMarkerPlanImage,
  regenerateMarkerPlanAllocationRows,
  serializeMarkerPlanStorage,
  setMarkerPlanPrimaryImage,
  type MarkerPlanBalanceSummaryRow,
  type MarkerPlanContextCandidate,
  type MarkerPlanExplosionSummary,
  type MarkerPlanListStats,
  type MarkerPlanViewRow,
} from './marker-plan-model'
import {
  MARKER_SIZE_CODES,
  buildMarkerExplodedPieceQtyFormula,
  buildMarkerFinalUnitUsageFormula,
  buildMarkerFoldedEffectiveWidthFormula,
  buildMarkerHighLowMatrixTotalFormula,
  buildMarkerLayoutLineSpreadLengthFormula,
  buildMarkerLayoutLineSystemUnitUsageFormula,
  buildMarkerModeDetailSpreadLengthFormula,
  buildMarkerModeDetailSystemUnitUsageFormula,
  buildMarkerPlannedSpreadLengthFormula,
  buildMarkerSkuExplodedPieceQtyFormula,
  buildMarkerSystemUnitUsageFormula,
  buildMarkerTotalPiecesFormula,
  markerAllocationStatusMeta,
  markerImageStatusMeta,
  markerLayoutStatusMeta,
  markerMappingStatusMeta,
  markerPlanModeMeta,
  markerPlanStatusMeta,
  type MarkerAllocationRow,
  type MarkerFoldConfig,
  type MarkerHighLowMatrixCell,
  type MarkerImageRecord,
  type MarkerLayoutLine,
  type MarkerModeDetailLine,
  type MarkerPlan,
  type MarkerPlanContextType,
  type MarkerPlanModeKey,
  type MarkerPieceExplosionRow,
  type MarkerPlanStatusKey,
  type MarkerPlanTabKey,
  type MarkerSizeCode,
} from './marker-plan-domain'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'

type MarkerPlanRouteKind = 'LIST' | 'CREATE' | 'EDIT' | 'DETAIL' | 'OTHER'
type MarkerPlanListTab = 'PENDING' | 'PLANS' | 'EXCEPTIONS'
type MarkerPlanListFilterField = 'keyword' | 'contextNo' | 'markerNo' | 'contextType' | 'mode' | 'status' | 'ready'
type MarkerPlanContextField = 'contextKeyword'
type MarkerPlanBasicField =
  | 'markerNo'
  | 'markerMode'
  | 'plannedLayerCount'
  | 'netLength'
  | 'manualUnitUsage'
  | 'remark'
  | 'singleSpreadFixedLoss'
type MarkerPlanAllocationField = 'sourceCutOrderId' | 'sizeCode' | 'garmentQty' | 'note' | 'specialFlags'
type MarkerPlanLayoutField = 'layoutCode' | 'ratioNote' | 'colorCode' | 'repeatCount' | 'markerLength' | 'markerPieceQty' | 'widthCode' | 'note'
type MarkerPlanModeDetailField = 'modeName' | 'colorCode' | 'repeatCount' | 'markerLength' | 'markerPieceQty' | 'note'
type MarkerPlanFoldField = 'originalEffectiveWidth' | 'foldAllowance' | 'foldDirection' | 'maxLayoutWidth'
type MarkerPlanImageField = 'hasAdjustment' | 'adjustmentNote' | 'primaryImageNote'

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
  contextDrawerType: 'ALL' | MarkerPlanContextType
  contextKeyword: string
  selectedContextId: string
  mappingDrawerOpen: boolean
  mappingTargetRowId: string
  mappingDraft: MarkerPlanMappingDraft
  feedback: MarkerPlanFeedback | null
  referencedStructureEditConfirmed: boolean
}

const state: MarkerPlanPageState = {
  querySignature: '',
  listTab: 'PENDING',
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
  contextDrawerType: 'ALL',
  contextKeyword: '',
  selectedContextId: '',
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

let markerPlanTopInfoResizeObserver: ResizeObserver | null = null
let markerPlanStickyResizeBound = false
let markerPlanStickySyncToken = 0

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

function getListTabMeta(listTab: MarkerPlanListTab): { label: string; countLabel: string } {
  if (listTab === 'PENDING') {
    return { label: '待建上下文', countLabel: '待建上下文数' }
  }
  if (listTab === 'EXCEPTIONS') {
    return { label: '异常待处理', countLabel: '异常唛架数' }
  }
  return { label: '已建唛架', countLabel: '已建唛架数' }
}

function buildExportFilename(tabLabel: string): string {
  return `唛架列表-${tabLabel}-${buildExportTimestamp()}.csv`
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
}

function upsertStoredPlan(plan: MarkerPlan): void {
  const stored = readStoredPlans()
  const next = stored.filter((item) => item.id !== plan.id)
  next.push(plan)
  next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
  writeStoredPlans(next)
}

function getProjection() {
  return buildMarkerPlanProjection()
}

function getViewModel() {
  return getProjection().viewModel
}

function getContextMap(viewModel = getViewModel()): Record<string, MarkerPlanContextCandidate> {
  return Object.fromEntries(viewModel.contexts.map((context) => [context.contextKey, context]))
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
  const confirmed = window.confirm('当前唛架已被铺布引用，修改配比、分配、排版结构或模式可能影响后续铺布，是否继续？')
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

function getPlanColorOptions(plan: Pick<MarkerPlan, 'colorSummary' | 'layoutLines' | 'modeDetailLines' | 'pieceExplosionRows'>, context: MarkerPlanContextCandidate | null): string[] {
  const contextColors = context?.colorSummary.split(' / ') || []
  const rowColors = [
    ...plan.layoutLines.map((line) => line.colorCode),
    ...plan.modeDetailLines.map((line) => line.colorCode),
    ...plan.pieceExplosionRows.map((row) => row.colorCode),
  ]
  return Array.from(new Set([...contextColors, ...rowColors].map((item) => String(item || '').trim()).filter(Boolean)))
}

function getWidthOptions(plan: Pick<MarkerPlan, 'layoutLines'>): string[] {
  const defaults = ['150cm', '160cm', '170cm', '180cm']
  const current = plan.layoutLines.map((line) => line.widthCode)
  return Array.from(new Set([...defaults, ...current].map((item) => String(item || '').trim()).filter(Boolean)))
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
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  styleCode?: string
  spuCode?: string
  materialSku?: string
}): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('production-progress'), {
    productionOrderId: options.productionOrderId,
    productionOrderNo: options.productionOrderNo,
    originalCutOrderId: options.originalCutOrderId,
    originalCutOrderNo: options.originalCutOrderNo,
    mergeBatchId: options.mergeBatchId,
    mergeBatchNo: options.mergeBatchNo,
    styleCode: options.styleCode,
    spuCode: options.spuCode,
    materialSku: options.materialSku,
    autoOpenDetail: options.productionOrderNo ? '1' : undefined,
  })
}

function getCurrentPrimaryImage(plan: MarkerPlan): MarkerImageRecord | null {
  return plan.imageRecords.find((image) => image.isPrimary) || plan.imageRecords[0] || null
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

function shouldConfirmMarkerModeSwitch(plan: MarkerPlan, nextMode: MarkerPlanModeKey): boolean {
  if (plan.markerMode === nextMode) return false
  const currentUsesLayout = plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
  const nextUsesLayout = nextMode === 'normal' || nextMode === 'fold_normal'
  const currentUsesHighLow = plan.markerMode === 'high_low' || plan.markerMode === 'fold_high_low'
  const nextUsesHighLow = nextMode === 'high_low' || nextMode === 'fold_high_low'
  const currentUsesFold = plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low'
  const nextUsesFold = nextMode === 'fold_normal' || nextMode === 'fold_high_low'

  return (
    (currentUsesLayout && !nextUsesLayout && plan.layoutLines.length > 0) ||
    (currentUsesHighLow && !nextUsesHighLow && (plan.highLowMatrixCells.length > 0 || plan.modeDetailLines.length > 0)) ||
    (currentUsesFold && !nextUsesFold && Boolean(plan.foldConfig))
  )
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
  if (state.listTab === 'PENDING') {
    const contexts = filterContexts(viewModel.pendingContexts)
    return {
      filename: buildExportFilename(tabMeta.label),
      rows: [
        ['来源类型', '原始裁片单号 / 合并裁剪批次号', '来源生产单号', '款号 / SPU', '面料 SKU', '颜色', '技术包状态', '当前配料/领料摘要'],
        ...contexts.map((context) => [
          context.contextLabel,
          context.contextNo,
          context.productionOrderNos.join(' / '),
          `${context.styleCode || '-'} / ${context.spuCode || '-'}`,
          context.materialSkuSummary,
          context.colorSummary,
          context.techPackStatusLabel,
          context.prepClaimSummaryText,
        ]),
      ],
    }
  }

  const rows = filterPlans(viewModel.plans, state.listTab)
  return {
    filename: buildExportFilename(tabMeta.label),
    rows: [
      [
        '唛架编号',
        '上下文',
        '来源原始裁片单数（张）',
        '来源生产单数（单）',
        '款号 / SPU',
        '面料 / 颜色',
        '唛架模式',
        '唛架成衣件数（件）',
        '最终单件成衣用量（m/件）',
        '计划铺布总长度（m）',
        '分配状态',
        '映射状态',
        '排版状态',
        '图片状态',
        '最近更新',
      ],
      ...rows.map((row) => [
        row.markerNo,
        `${row.contextLabel} · ${row.contextNo}`,
        row.sourceOriginalOrderCountText,
        row.sourceProductionOrderCountText,
        `${row.styleCode || '-'} / ${row.spuCode || '-'}`,
        `${row.materialSkuSummary} / ${row.colorSummary || '—'}`,
        row.modeMeta.label,
        formatCount(row.totalPieces),
        row.finalUnitUsageText,
        row.plannedSpreadLengthText,
        row.allocationStatusMeta.label,
        row.mappingStatusMeta.label,
        row.layoutStatusMeta.label,
        row.imageStatusMeta.label,
        row.updatedAt,
      ]),
    ],
  }
}

function navigateToCreateWithContext(context: MarkerPlanContextCandidate): void {
  const params = new URLSearchParams({
    contextType: context.contextType,
    contextId: context.id,
  })
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
    layoutLines:
      markerMode === 'normal' || markerMode === 'fold_normal'
        ? (plan.layoutLines.length ? plan.layoutLines : [createEmptyMarkerPlanLayoutLine(plan, context)])
        : [],
    highLowMatrixCells:
      markerMode === 'high_low' || markerMode === 'fold_high_low'
        ? (plan.highLowMatrixCells.length
            ? plan.highLowMatrixCells
            : ['高层', '低层'].flatMap((sectionName, index) =>
                MARKER_SIZE_CODES.map((sizeCode) => ({
                  sectionType: index === 0 ? 'HIGH' : 'LOW',
                  sectionName,
                  sizeCode,
                  qty: 0,
                })),
              ))
        : [],
    modeDetailLines:
      markerMode === 'high_low' || markerMode === 'fold_high_low'
        ? (plan.modeDetailLines.length ? plan.modeDetailLines : [createEmptyMarkerPlanModeDetailLine(plan, context)])
        : [],
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
  const resolvedTab = ['basic', 'allocation', 'explosion', 'layout', 'images'].includes(requestedTab)
    ? (requestedTab as MarkerPlanTabKey)
    : null

  if (route.kind === 'LIST') {
    state.draftPlan = null
    state.activeTab = 'basic'
    state.contextDrawerOpen = false
    state.mappingDrawerOpen = false
    state.mappingTargetRowId = ''
    state.referencedStructureEditConfirmed = false
    return
  }

  if (route.kind === 'CREATE') {
    const copyFrom = params.get('copyFrom') || ''
    const contextType = params.get('contextType') as MarkerPlanContextType | null
    const contextId = params.get('contextId') || ''
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
    if (contextType && contextId) {
      const currentContext = state.draftPlan ? findMarkerPlanContextForPlan(viewModel.contexts, state.draftPlan) : null
      const sameContext =
        Boolean(currentContext) && currentContext?.contextType === contextType && currentContext?.id === contextId
      if (!sameContext) {
        const context = findMarkerPlanContextById(viewModel.contexts, contextType, contextId)
        state.draftPlan = context ? createMarkerPlanFromContext({ context, existingPlans: viewModel.plans }) : null
        state.activeTab = 'basic'
      }
      state.contextDrawerOpen = !Boolean(state.draftPlan)
      state.contextDrawerType = contextType
      state.mappingDrawerOpen = false
      state.mappingTargetRowId = ''
      state.referencedStructureEditConfirmed = false
      return
    }
    state.draftPlan = null
    state.activeTab = 'basic'
    state.contextDrawerOpen = true
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
      ? 'rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium leading-4 text-white hover:bg-blue-700'
      : variant === 'ghost'
        ? 'rounded-md px-2 py-1 text-[11px] leading-4 text-muted-foreground hover:bg-muted'
        : 'rounded-md border px-2 py-1 text-[11px] leading-4 hover:bg-muted'

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
  return `<div class="mt-0.5 font-mono text-[10px] leading-3.5 text-muted-foreground">${escapeHtml(formula)}</div>`
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
    <div class="rounded-lg border bg-background px-3 py-2" data-marker-plan-control-type="readonly">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1">${renderValueWithFormula(value, formula)}</div>
    </div>
  `
}

function renderInputField(label: string, value: string, field: MarkerPlanBasicField, type: 'text' | 'number' = 'text'): string {
  return `
    <label class="space-y-2" data-marker-plan-control-type="${type === 'number' ? 'number-input' : 'text-input'}">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="${type}"
        value="${escapeHtml(value)}"
        data-marker-plan-basic-field="${field}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  `
}

function renderTextareaField(label: string, value: string, field: MarkerPlanBasicField | MarkerPlanImageField): string {
  return `
    <label class="space-y-2" data-marker-plan-control-type="textarea">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <textarea
        rows="3"
        data-marker-plan-textarea-field="${field}"
        class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
    <label class="space-y-2" data-marker-plan-control-type="select">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        ${dataAttr}="${field}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
        ${renderActionButton('从原始裁片单新建', 'data-marker-plan-action="open-context-drawer" data-context-type="original-cut-order"')}
        ${renderActionButton('从合并裁剪批次新建', 'data-marker-plan-action="open-context-drawer" data-context-type="merge-batch"')}
        ${renderActionButton('导出', 'data-marker-plan-action="export-list"')}
        ${renderActionButton('重置筛选', 'data-marker-plan-action="reset-filters"')}
      </div>
    `
  }

  if (route === 'CREATE') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('返回列表', 'data-marker-plan-action="go-list"')}
        ${renderActionButton('切换上下文', 'data-marker-plan-action="open-context-drawer" data-context-type="ALL"')}
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
        ${renderActionButton('复制为新唛架', `data-marker-plan-action="copy-plan"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
        ${renderActionButton('作废', 'data-marker-plan-action="cancel-plan"', 'secondary', !plan)}
        ${renderActionButton('交给铺布', `data-marker-plan-action="go-spreading"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'primary', !plan || !plan.readyForSpreading || plan.status === 'CANCELED')}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      ${renderActionButton('返回列表', 'data-marker-plan-action="go-list"')}
      ${renderActionButton('去编辑', `data-marker-plan-action="go-edit"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
      ${renderActionButton('复制为新唛架', `data-marker-plan-action="copy-plan"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan)}
      ${renderActionButton('交给铺布', `data-marker-plan-action="go-spreading"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'primary', !plan || !plan.readyForSpreading)}
      ${renderActionButton('去原始裁片单', `data-marker-plan-action="go-original-orders"${plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`, 'secondary', !plan || !plan.originalCutOrderIds.length)}
      ${plan?.mergeBatchId ? renderActionButton('去合并裁剪批次', `data-marker-plan-action="go-merge-batch" data-plan-id="${escapeHtml(plan.id)}"`, 'secondary') : ''}
    </div>
  `
}

function buildGoOriginalOrdersPath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
    originalCutOrderId: plan.originalCutOrderIds[0],
    originalCutOrderNo: plan.originalCutOrderNos[0],
    productionOrderId: plan.productionOrderIds[0],
    productionOrderNo: plan.productionOrderNos[0],
    mergeBatchId: plan.mergeBatchId || undefined,
    mergeBatchNo: plan.mergeBatchNo || undefined,
    styleCode: plan.styleCode || undefined,
    spuCode: plan.spuCode || undefined,
    materialSku: plan.sourceMaterialSku || undefined,
  })
}

function buildGoOriginalOrdersPathFromContext(context: MarkerPlanContextCandidate): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
    originalCutOrderId: context.originalCutOrderIds[0],
    originalCutOrderNo: context.originalCutOrderNos[0],
    productionOrderId: context.productionOrderIds[0],
    productionOrderNo: context.productionOrderNos[0],
    mergeBatchId: context.mergeBatchId || undefined,
    mergeBatchNo: context.mergeBatchNo || undefined,
    styleCode: context.styleCode || undefined,
    spuCode: context.spuCode || undefined,
    materialSku: context.materialSkuSummary.split(' / ')[0] || undefined,
  })
}

function buildGoMaterialPrepPath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('material-prep'), {
    originalCutOrderId: plan.originalCutOrderIds[0],
    originalCutOrderNo: plan.originalCutOrderNos[0],
    productionOrderId: plan.productionOrderIds[0],
    productionOrderNo: plan.productionOrderNos[0],
    styleCode: plan.styleCode || undefined,
    spuCode: plan.spuCode || undefined,
    materialSku: plan.sourceMaterialSku || undefined,
  })
}

function buildGoMergeBatchPath(plan: MarkerPlan | MarkerPlanViewRow): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('merge-batches'), {
    focusBatchId: plan.mergeBatchId || undefined,
  })
}

function buildGoMergeBatchPathFromContext(context: MarkerPlanContextCandidate): string {
  return buildRouteWithQuery(getCanonicalCuttingPath('merge-batches'), {
    focusBatchId: context.mergeBatchId || undefined,
  })
}

function resolveCurrentPlan(viewModel = getViewModel(), planId = ''): MarkerPlan | MarkerPlanViewRow | null {
  if (planId && viewModel.plansById[planId]) return viewModel.plansById[planId]
  if ((parseRoute().kind === 'CREATE' || parseRoute().kind === 'EDIT') && state.draftPlan) return state.draftPlan
  if (parseRoute().kind === 'DETAIL' && viewModel.plansById[parseRoute().id]) return viewModel.plansById[parseRoute().id]
  return null
}

function updatePrimaryImageNote(plan: MarkerPlan, note: string): MarkerPlan {
  const primaryId = getCurrentPrimaryImage(plan)?.id
  if (!primaryId) return plan
  return {
    ...plan,
    imageRecords: plan.imageRecords.map((image) =>
      image.id === primaryId
        ? {
            ...image,
            note,
          }
        : image,
    ),
  }
}

function validateDraftForCompletion(): { ok: true } | { ok: false; tab: MarkerPlanTabKey; message: string } {
  const plan = state.draftPlan
  if (!plan) {
    return { ok: false, tab: 'basic', message: '请先选择上下文，再完成计划。' }
  }
  if (plan.totalPieces <= 0) {
    return { ok: false, tab: 'basic', message: '请先补齐尺码成衣件数（件），确保唛架成衣件数（件）大于 0。' }
  }
  if (plan.netLength <= 0) {
    return { ok: false, tab: 'basic', message: '请先填写唛架净长度（m），确保大于 0。' }
  }
  if (plan.allocationStatus !== 'balanced') {
    return { ok: false, tab: 'allocation', message: '来源分配尚未配平，请先完成来源分配。' }
  }
  if (plan.mappingStatus !== 'passed') {
    return { ok: false, tab: 'explosion', message: '裁片拆解仍有映射异常，请先修正映射。' }
  }
  if (plan.layoutStatus !== 'done') {
    return { ok: false, tab: 'layout', message: '排版计划尚未完成，请先补齐排版数据。' }
  }
  return { ok: true }
}

function getProblemTabForPlan(row: MarkerPlanViewRow): MarkerPlanTabKey {
  if (row.allocationStatus !== 'balanced') return 'allocation'
  if (row.mappingStatus === 'issue') return 'explosion'
  if (row.layoutStatus !== 'done') return 'layout'
  if (row.imageStatus !== 'done') return 'images'
  return 'basic'
}

function hasPlanExceptionIssue(row: MarkerPlanViewRow): boolean {
  return (
    row.allocationStatus !== 'balanced' ||
    row.mappingStatus === 'issue' ||
    row.layoutStatus !== 'done' ||
    row.imageStatus !== 'done'
  )
}

function renderTopInfoChip(label: string, attrs: string, tone: 'blue' | 'amber' | 'emerald' = 'blue'): string {
  return renderWorkbenchFilterChip(label, attrs, tone)
}

function renderTopInfoValue(label: string, value: string, formula = ''): string {
  return `
    <article class="rounded-lg border bg-background px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1">${renderValueWithFormula(value, formula)}</div>
    </article>
  `
}

function renderTopInfoStatus(label: string, badgeHtml: string): string {
  return `
    <article class="rounded-lg border bg-background px-3 py-2">
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
      : buildMarkerSystemUnitUsageFormula(plan.netLength, plan.totalPieces)
  const finalUnitUsageFormula =
    'finalUnitUsageFormula' in plan
      ? plan.finalUnitUsageFormula
      : buildMarkerFinalUnitUsageFormula(plan.systemUnitUsage, plan.manualUnitUsage)
  const plannedSpreadLengthFormula =
    'plannedSpreadLengthFormula' in plan
      ? plan.plannedSpreadLengthFormula
      : buildMarkerPlannedSpreadLengthFormula(plan)
  const productionSummary = plan.productionOrderNos.join(' / ') || '—'
  const originalChips = plan.originalCutOrderNos.length
    ? plan.originalCutOrderNos
        .map((originalCutOrderNo, index) =>
          renderTopInfoChip(
            originalCutOrderNo,
            `data-marker-plan-action="go-original-orders" data-original-cut-order-id="${escapeHtml(plan.originalCutOrderIds[index] || '')}" data-original-cut-order-no="${escapeHtml(originalCutOrderNo)}" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || plan.productionOrderIds[0] || '')}" data-production-order-no="${escapeHtml(plan.productionOrderNos[index] || plan.productionOrderNos[0] || '')}"`,
          ),
        )
        .join('')
    : '<span class="text-xs text-muted-foreground">—</span>'
  const mergeChip = plan.mergeBatchNo
    ? renderTopInfoChip(
        plan.mergeBatchNo,
        `data-marker-plan-action="go-merge-batch" data-merge-batch-id="${escapeHtml(plan.mergeBatchId)}" data-merge-batch-no="${escapeHtml(plan.mergeBatchNo)}"`,
        'amber',
      )
    : '<span class="text-xs text-muted-foreground">—</span>'
  const productionChips = plan.productionOrderNos.length
    ? plan.productionOrderNos
        .map((productionOrderNo, index) =>
          renderTopInfoChip(
            productionOrderNo,
            `data-marker-plan-action="go-production-progress" data-production-order-id="${escapeHtml(plan.productionOrderIds[index] || '')}" data-production-order-no="${escapeHtml(productionOrderNo)}" data-style-code="${escapeHtml(plan.styleCode || '')}" data-spu-code="${escapeHtml(plan.spuCode || '')}" data-material-sku="${escapeHtml(plan.sourceMaterialSku || '')}" data-original-cut-order-id="${escapeHtml(plan.originalCutOrderIds[index] || '')}" data-original-cut-order-no="${escapeHtml(plan.originalCutOrderNos[index] || '')}" data-merge-batch-id="${escapeHtml(plan.mergeBatchId || '')}" data-merge-batch-no="${escapeHtml(plan.mergeBatchNo || '')}"`,
            'emerald',
          ),
        )
        .join('')
    : '<span class="text-xs text-muted-foreground">—</span>'
  const summaryItems = [
    { label: '唛架模式', value: markerPlanModeMeta[plan.markerMode].label },
    { label: '唛架净长度（m）', value: `${formatNumber(plan.netLength, 2)} m` },
    { label: '唛架成衣件数（件）', value: `${formatCount(plan.totalPieces)} 件`, formula: totalPiecesFormula },
    { label: '系统单件成衣用量（m/件）', value: `${formatNumber(plan.systemUnitUsage, 3)} m/件`, formula: systemUnitUsageFormula },
    { label: '最终单件成衣用量（m/件）', value: `${formatNumber(plan.finalUnitUsage, 3)} m/件`, formula: finalUnitUsageFormula },
    { label: '计划铺布总长度（m）', value: `${formatNumber(plan.plannedSpreadLength, 2)} m`, formula: plannedSpreadLengthFormula },
  ]
  const statusItems = [
    ['分配状态', renderStatusBadge(markerAllocationStatusMeta[plan.allocationStatus].label, markerAllocationStatusMeta[plan.allocationStatus].className)],
    ['主状态', renderStatusBadge(markerPlanStatusMeta[plan.status].label, markerPlanStatusMeta[plan.status].className)],
    ['映射状态', renderStatusBadge(markerMappingStatusMeta[plan.mappingStatus].label, markerMappingStatusMeta[plan.mappingStatus].className)],
    ['排版状态', renderStatusBadge(markerLayoutStatusMeta[plan.layoutStatus].label, markerLayoutStatusMeta[plan.layoutStatus].className)],
    ['图片状态', renderStatusBadge(markerImageStatusMeta[plan.imageStatus].label, markerImageStatusMeta[plan.imageStatus].className)],
    ['可交接铺布', plan.readyForSpreading ? renderStatusBadge('是', 'bg-emerald-100 text-emerald-700 border-emerald-200') : renderStatusBadge('否', 'bg-slate-100 text-slate-700 border-slate-200')],
  ] as const

  return `
    <section data-marker-plan-top-shell class="rounded-lg border bg-card px-2.5 py-2 shadow-sm">
      <div class="pointer-events-none space-y-2" data-testid="marker-plan-top-info">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <div class="text-[11px] text-muted-foreground">唛架编号</div>
              <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(plan.markerNo)}</div>
            </div>
            <div>
              <div class="text-[11px] text-muted-foreground">上下文类型</div>
              <div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(context ? context.contextLabel : '待选择')}</div>
            </div>
            <div>
              <div class="text-[11px] text-muted-foreground">款号 / SPU</div>
              <div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(`${plan.styleCode || '-'} / ${plan.spuCode || '-'}`)}</div>
            </div>
            <div>
              <div class="text-[11px] text-muted-foreground">面料 / 颜色</div>
              <div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(`${plan.materialSkuSummary || '—'} / ${plan.colorSummary || '—'}`)}</div>
            </div>
          </div>
          <div class="pointer-events-auto flex flex-wrap gap-1">
            ${statusItems.map(([label, badgeHtml]) => `<div class="flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5"><span class="text-[11px] text-muted-foreground">${escapeHtml(label)}</span>${badgeHtml}</div>`).join('')}
          </div>
        </div>
        <div class="grid gap-2 xl:grid-cols-[1.5fr_1fr]">
          <div class="space-y-1">
            <div class="rounded-md border bg-background px-2.5 py-1.5">
              <div class="text-[11px] text-muted-foreground">原始裁片单号</div>
              <div class="pointer-events-auto mt-0.5 flex flex-wrap gap-1.5">${originalChips}</div>
            </div>
            <div class="grid gap-1 md:grid-cols-2">
              <div class="rounded-md border bg-background px-2.5 py-1.5">
                <div class="text-[11px] text-muted-foreground">合并裁剪批次号</div>
                <div class="pointer-events-auto mt-0.5 flex flex-wrap gap-1.5">${mergeChip}</div>
              </div>
              <div class="rounded-md border bg-background px-2.5 py-1.5">
                <div class="text-[11px] text-muted-foreground">来源生产单号</div>
                <div class="pointer-events-auto mt-0.5 flex flex-wrap gap-1.5">${productionChips}</div>
              </div>
            </div>
          </div>
          <div class="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            ${summaryItems
              .map(
                (item) => `
                  <div class="rounded-md border bg-background px-2.5 py-1.5">
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
              <div class="pointer-events-auto flex flex-wrap items-center gap-1 border-t pt-1.5">
                ${renderActionButton('去原始裁片单', `data-marker-plan-action="go-original-orders"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`)}
                ${renderActionButton('去配料领料', `data-marker-plan-action="go-material-prep"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`)}
                ${plan.mergeBatchId ? renderActionButton('去合并裁剪批次', `data-marker-plan-action="go-merge-batch"${'id' in plan ? ` data-plan-id="${escapeHtml(plan.id)}"` : ''}`) : ''}
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
  const tabs: Array<{ key: MarkerPlanTabKey; label: string }> = [
    { key: 'basic', label: '基础与配比' },
    { key: 'allocation', label: '来源分配' },
    { key: 'explosion', label: '裁片拆解' },
    { key: 'layout', label: '排版计划' },
    { key: 'images', label: '图片与变更' },
  ]

  return `
    <section data-marker-plan-tab-shell class="rounded-lg border bg-card/95 p-1.5 shadow-sm">
      <div class="flex flex-wrap gap-1">
        ${tabs
          .map((tab) =>
            `
              <button
                type="button"
                class="inline-flex cursor-pointer items-center rounded-md px-2 py-1 text-xs font-medium ${
                  activeTab === tab.key
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

function renderBalanceStatusBadge(status: MarkerPlanBalanceSummaryRow['status']): string {
  const meta =
    status === 'matched'
      ? { label: '已配平', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      : status === 'over'
        ? { label: '超配', className: 'bg-amber-100 text-amber-700 border-amber-200' }
        : { label: '少配', className: 'bg-rose-100 text-rose-700 border-rose-200' }
  return renderStatusBadge(meta.label, meta.className)
}

function renderSizeRatioGrid(plan: MarkerPlan): string {
  return `
    <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${MARKER_SIZE_CODES.map((sizeCode) => {
        const row = plan.sizeRatioRows.find((item) => item.sizeCode === sizeCode)
        return `
          <label class="space-y-2 rounded-lg border bg-background px-3 py-3" data-marker-plan-control-type="number-input">
            <span class="text-sm font-medium text-foreground">${escapeHtml(`${sizeCode} 尺码成衣件数（件）`)}</span>
            <input
              type="number"
              min="0"
              step="1"
              value="${row?.qty ?? 0}"
              data-marker-plan-action="change-size-ratio"
              data-size-code="${sizeCode}"
              class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        `
      }).join('')}
    </div>
  `
}

function renderSizeRatioReadonlyGrid(plan: MarkerPlan | MarkerPlanViewRow): string {
  return `
    <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${MARKER_SIZE_CODES.map((sizeCode) => {
        const row = plan.sizeRatioRows.find((item) => item.sizeCode === sizeCode)
        return `
          <article class="rounded-lg border bg-background px-3 py-3">
            <div class="text-sm font-medium text-foreground">${escapeHtml(`${sizeCode} 尺码成衣件数（件）`)}</div>
            <div class="mt-2 text-lg font-semibold">${formatCount(row?.qty || 0)}</div>
          </article>
        `
      }).join('')}
    </div>
  `
}

function renderBasicTab(plan: MarkerPlan): string {
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3" data-testid="marker-plan-basic-tab">
      <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        ${renderInputField('唛架编号', plan.markerNo, 'markerNo')}
        ${renderSelectField('唛架模式', 'markerMode', buildMarkerPlanModeOptions(), plan.markerMode)}
        ${renderInputField('计划铺布层数（层）', String(plan.plannedLayerCount || 0), 'plannedLayerCount', 'number')}
        ${renderInputField('唛架净长度（m）', String(plan.netLength || 0), 'netLength', 'number')}
      </div>
      <div class="space-y-3">
        <h3 class="text-sm font-semibold">尺码配比</h3>
        ${renderSizeRatioGrid(plan)}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderReadonlyField('唛架成衣件数（件）', formatCount(plan.totalPieces), buildMarkerTotalPiecesFormula(plan.sizeRatioRows))}
        ${renderReadonlyField('系统单件成衣用量（m/件）', formatNumber(plan.systemUnitUsage, 3), buildMarkerSystemUnitUsageFormula(plan.netLength, plan.totalPieces))}
        <div class="space-y-2 rounded-lg border bg-background px-3 py-3" data-marker-plan-control-type="number-input">
          <div class="text-sm font-medium text-foreground">人工修正单件成衣用量（m/件）</div>
          <input
            type="number"
            step="0.001"
            value="${plan.manualUnitUsage == null ? '' : escapeHtml(String(plan.manualUnitUsage))}"
            data-marker-plan-basic-field="manualUnitUsage"
            class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="flex justify-end">
            ${renderActionButton('恢复系统值', 'data-marker-plan-action="restore-system-unit-usage"', 'ghost', plan.manualUnitUsage == null)}
          </div>
        </div>
        ${renderReadonlyField('最终单件成衣用量（m/件）', formatNumber(plan.finalUnitUsage, 3), buildMarkerFinalUnitUsageFormula(plan.systemUnitUsage, plan.manualUnitUsage))}
        ${renderReadonlyField('计划铺布总长度（m）', `${formatNumber(plan.plannedSpreadLength, 2)} m`, buildMarkerPlannedSpreadLengthFormula(plan))}
      </div>
      <div class="grid gap-3 lg:grid-cols-1">
        ${renderTextareaField('备注', plan.remark, 'remark')}
      </div>
    </section>
  `
}

function buildSourceMetaMap(context: MarkerPlanContextCandidate | null): Record<string, OriginalSourceMeta> {
  if (!context) return {}
  return Object.fromEntries(
    context.sourceOriginalRows.map((row) => [
      row.originalCutOrderId,
      {
        sourceCutOrderId: row.originalCutOrderId,
        sourceCutOrderNo: row.originalCutOrderNo,
        sourceProductionOrderId: row.productionOrderId,
        sourceProductionOrderNo: row.productionOrderNo,
        colorCode:
          context.sourceGeneratedRows.find((item) => item.originalCutOrderId === row.originalCutOrderId)?.colorScope?.[0] || row.color || '',
        materialSku: row.materialSku,
        styleCode: row.styleCode,
        spuCode: row.spuCode,
        techPackSpu:
          context.sourceMaterialPrepRows.find((item) => item.originalCutOrderId === row.originalCutOrderId)?.techPackSpuCode || context.techPackSpu,
      },
    ]),
  )
}

interface OriginalSourceMeta {
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  colorCode: string
  materialSku: string
  styleCode: string
  spuCode: string
  techPackSpu: string
}

function renderAllocationTable(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const sourceMap = buildSourceMetaMap(context)
  const specialFlagOptions = ['人工确认', '撞色', 'AB料', '多来源']
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      ${renderStickyTableScroller(`
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">来源裁片单</th>
            <th class="px-3 py-2 font-medium">来源生产单</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">面料 SKU</th>
            <th class="px-3 py-2 font-medium">款号 / SPU</th>
            <th class="px-3 py-2 font-medium">技术包 SPU</th>
            <th class="px-3 py-2 font-medium">尺码</th>
            <th class="px-3 py-2 font-medium">来源分配成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">特殊标记</th>
            <th class="px-3 py-2 font-medium">备注</th>
            <th class="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            plan.allocationRows.length
              ? plan.allocationRows
                  .map((row) => {
                    const sourceMeta = sourceMap[row.sourceCutOrderId] || null
                    return `
                      <tr class="border-t align-top">
                        <td class="px-3 py-2">
                          <select
                            data-marker-plan-allocation-field="sourceCutOrderId"
                            data-allocation-id="${escapeHtml(row.id)}"
                            data-marker-plan-control-type="select"
                            class="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            ${Object.values(sourceMap)
                              .map((option) => `<option value="${escapeHtml(option.sourceCutOrderId)}" ${option.sourceCutOrderId === row.sourceCutOrderId ? 'selected' : ''}>${escapeHtml(option.sourceCutOrderNo)}</option>`)
                              .join('')}
                          </select>
                        </td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.sourceProductionOrderNo || row.sourceProductionOrderId || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.colorCode || row.colorCode || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.materialSku || row.materialSku || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(`${sourceMeta?.styleCode || row.styleCode || '-'} / ${sourceMeta?.spuCode || row.spuCode || '-'}`)}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.techPackSpu || row.techPackSpu || '—')}</td>
                        <td class="px-3 py-2">
                          <select
                            data-marker-plan-allocation-field="sizeCode"
                            data-allocation-id="${escapeHtml(row.id)}"
                            data-marker-plan-control-type="select"
                            class="h-9 w-full rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            ${MARKER_SIZE_CODES.map((sizeCode) => `<option value="${sizeCode}" ${sizeCode === row.sizeCode ? 'selected' : ''}>${escapeHtml(sizeCode)}</option>`).join('')}
                          </select>
                        </td>
                        <td class="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value="${row.garmentQty}"
                            data-marker-plan-allocation-field="garmentQty"
                            data-allocation-id="${escapeHtml(row.id)}"
                            data-marker-plan-control-type="number-input"
                            class="h-9 w-24 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td class="px-3 py-2">
                          <select
                            multiple
                            data-marker-plan-allocation-field="specialFlags"
                            data-allocation-id="${escapeHtml(row.id)}"
                            data-marker-plan-control-type="select"
                            class="min-h-[5rem] w-32 rounded-md border bg-card px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            ${specialFlagOptions
                              .map(
                                (option) =>
                                  `<option value="${escapeHtml(option)}" ${row.specialFlags.includes(option) ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                              )
                              .join('')}
                          </select>
                        </td>
                        <td class="px-3 py-2">
                          <input
                            type="text"
                            value="${escapeHtml(row.note)}"
                            data-marker-plan-allocation-field="note"
                            data-allocation-id="${escapeHtml(row.id)}"
                            data-marker-plan-control-type="text-input"
                            class="h-9 w-32 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td class="px-3 py-2">
                          ${renderActionButton('删除', `data-marker-plan-action="remove-allocation-row" data-allocation-id="${escapeHtml(row.id)}"`, 'ghost')}
                        </td>
                      </tr>
                    `
                  })
                  .join('')
              : `
                <tr>
                  <td colspan="11" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有来源分配，请先一键生成或新增分配行。</td>
                </tr>
              `
          }
        </tbody>
      </table>
      `, 'max-h-[48vh]')}
    </div>
  `
}

function renderAllocationReadonlyTable(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const sourceMap = buildSourceMetaMap(context)
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">来源裁片单</th>
            <th class="px-3 py-2 font-medium">来源生产单</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">面料 SKU</th>
            <th class="px-3 py-2 font-medium">款号 / SPU</th>
            <th class="px-3 py-2 font-medium">技术包 SPU</th>
            <th class="px-3 py-2 font-medium">尺码</th>
            <th class="px-3 py-2 font-medium">来源分配成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">特殊标记</th>
            <th class="px-3 py-2 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>
          ${
            plan.allocationRows.length
              ? plan.allocationRows
                  .map((row) => {
                    const sourceMeta = sourceMap[row.sourceCutOrderId] || null
                    return `
                      <tr class="border-t align-top">
                        <td class="px-3 py-2 text-xs font-medium">${escapeHtml(sourceMeta?.sourceCutOrderNo || row.sourceCutOrderId || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.sourceProductionOrderNo || row.sourceProductionOrderId || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.colorCode || row.colorCode || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.materialSku || row.materialSku || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(`${sourceMeta?.styleCode || row.styleCode || '-'} / ${sourceMeta?.spuCode || row.spuCode || '-'}`)}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(sourceMeta?.techPackSpu || row.techPackSpu || '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(row.sizeCode || '—')}</td>
                        <td class="px-3 py-2 text-xs">${renderValueWithFormula(formatCount(row.garmentQty), `${formatCount(row.garmentQty)} 件`)}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(row.specialFlags.length ? row.specialFlags.join(' / ') : '—')}</td>
                        <td class="px-3 py-2 text-xs">${escapeHtml(row.note || '—')}</td>
                      </tr>
                    `
                  })
                  .join('')
              : `
                <tr>
                  <td colspan="10" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有来源分配记录。</td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `
}

function renderBalanceTable(balanceRows: MarkerPlanBalanceSummaryRow[]): string {
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">尺码</th>
            <th class="px-3 py-2 font-medium">尺码成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">来源分配成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">分配差值（件）</th>
            <th class="px-3 py-2 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          ${balanceRows
            .map((row) => `
              <tr class="border-t">
                <td class="px-3 py-2 font-medium">${escapeHtml(row.sizeCode)}</td>
                <td class="px-3 py-2">${formatCount(row.ratioQty)}</td>
                <td class="px-3 py-2">${renderValueWithFormula(formatCount(row.allocationQty), row.allocationFormula)}</td>
                <td class="px-3 py-2">${renderValueWithFormula(String(row.diffQty), row.diffFormula)}</td>
                <td class="px-3 py-2">${renderBalanceStatusBadge(row.status)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderAllocationTab(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const balanceRows = buildMarkerPlanBalanceRows(hydrateDraft(plan, context))
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3" data-testid="marker-plan-allocation-tab">
      <div class="flex flex-wrap items-center gap-2">
        ${renderActionButton('一键按尺码配比生成', 'data-marker-plan-action="auto-allocation"', 'primary')}
        ${renderActionButton('新增分配行', 'data-marker-plan-action="add-allocation-row"')}
        ${renderActionButton('清空重配', 'data-marker-plan-action="clear-allocations"')}
      </div>
      ${renderAllocationTable(plan, context)}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">配平表</h3>
          ${renderStatusBadge(markerAllocationStatusMeta[plan.allocationStatus].label, markerAllocationStatusMeta[plan.allocationStatus].className)}
        </div>
        ${renderBalanceTable(balanceRows)}
      </div>
    </section>
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
            <th class="px-3 py-2 font-medium">来源裁片单号</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">尺码</th>
            <th class="px-3 py-2 font-medium">SKU</th>
            <th class="px-3 py-2 font-medium">部位</th>
            <th class="px-3 py-2 font-medium">异常原因</th>
            <th class="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${issueRows
            .map(
              (row) => `
                <tr class="border-t">
                  <td class="px-3 py-2 text-xs font-medium">${escapeHtml(row.sourceCutOrderNo || row.sourceCutOrderId || '—')}</td>
                  <td class="px-3 py-2 text-xs">${escapeHtml(row.colorCode || '—')}</td>
                  <td class="px-3 py-2 text-xs">${escapeHtml(row.sizeCode || '—')}</td>
                  <td class="px-3 py-2 text-xs">${escapeHtml(row.skuCode || '待补 SKU')}</td>
                  <td class="px-3 py-2 text-xs">${escapeHtml(row.partNameCn || row.partCode || '—')}</td>
                  <td class="px-3 py-2 text-xs text-rose-600">${escapeHtml(row.issueReason || '需人工确认')}</td>
                  <td class="px-3 py-2">
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
    <section class="space-y-3 rounded-lg border bg-card p-3" data-testid="marker-plan-explosion-tab">
      ${renderExplosionStatusCards(summary)}
      <div class="space-y-2">
        <h3 class="text-sm font-semibold">SKU 汇总表</h3>
        <div class="overflow-hidden rounded-lg border bg-background">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">来源裁片单号</th>
                <th class="px-3 py-2 font-medium">颜色</th>
                <th class="px-3 py-2 font-medium">尺码</th>
                <th class="px-3 py-2 font-medium">SKU</th>
                <th class="px-3 py-2 font-medium">SKU 成衣件数（件）</th>
                <th class="px-3 py-2 font-medium">SKU裁片片数（片）</th>
                <th class="px-3 py-2 font-medium">匹配状态</th>
              </tr>
            </thead>
            <tbody>
              ${
                summary.skuSummaryRows.length
                  ? summary.skuSummaryRows
                      .map((row) => `
                        <tr class="border-t">
                          <td class="px-3 py-2">${escapeHtml(row.sourceCutOrderNo || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.colorCode || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.sizeCode || '—')}</td>
                          <td class="px-3 py-2 font-medium">${escapeHtml(row.skuCode || '待补 SKU')}</td>
                          <td class="px-3 py-2">${formatCount(row.garmentQty)}</td>
                          <td class="px-3 py-2">${renderValueWithFormula(formatCount(row.explodedPieceQty), row.explodedPieceFormula)}</td>
                          <td class="px-3 py-2">${escapeHtml(row.mappingStatusLabel)}</td>
                        </tr>
                      `)
                      .join('')
                  : `<tr><td colspan="7" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有可展示的 SKU 拆解结果。</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="space-y-2">
        <h3 class="text-sm font-semibold">部位明细表</h3>
        <div class="overflow-hidden rounded-lg border bg-background">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">来源裁片单</th>
                <th class="px-3 py-2 font-medium">颜色</th>
                <th class="px-3 py-2 font-medium">尺码</th>
                <th class="px-3 py-2 font-medium">SKU</th>
                <th class="px-3 py-2 font-medium">面料 SKU</th>
                <th class="px-3 py-2 font-medium">纸样</th>
                <th class="px-3 py-2 font-medium">部位</th>
                <th class="px-3 py-2 font-medium">部位（印尼语）</th>
                <th class="px-3 py-2 font-medium">部位成衣件数（件）</th>
                <th class="px-3 py-2 font-medium">单件裁片数（片/件）</th>
                <th class="px-3 py-2 font-medium">裁片片数（片）</th>
                <th class="px-3 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              ${
                plan.pieceExplosionRows.length
                  ? plan.pieceExplosionRows
                      .map((row) => `
                        <tr class="border-t">
                          <td class="px-3 py-2">${escapeHtml(row.sourceCutOrderNo || row.sourceCutOrderId)}</td>
                          <td class="px-3 py-2">${escapeHtml(row.colorCode || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.sizeCode || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.skuCode || '待补 SKU')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.materialSku || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.patternCode || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.partNameCn || row.partCode || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(row.partNameId || '—')}</td>
                          <td class="px-3 py-2">${formatCount(row.garmentQty)}</td>
                          <td class="px-3 py-2">${formatCount(row.piecePerGarment)}</td>
                          <td class="px-3 py-2">${renderValueWithFormula(formatCount(row.explodedPieceQty), buildMarkerExplodedPieceQtyFormula(row.piecePerGarment, row.garmentQty))}</td>
                          <td class="px-3 py-2">${escapeHtml(row.mappingStatus === 'MATCHED' ? '已匹配' : row.issueReason || '映射异常')}</td>
                        </tr>
                      `)
                      .join('')
                  : `<tr><td colspan="12" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有裁片拆解明细。</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
      ${
        summary.issueCount || !readOnly
          ? `
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">异常列表</h3>
                <span class="text-xs text-muted-foreground">SKU种类数（个SKU）：${summary.skuTypeCount}</span>
              </div>
              ${renderExplosionIssueRows(plan, readOnly)}
            </div>
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
          class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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

function renderLayoutLinesTable(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const lines = plan.layoutLines
  const colorOptions = getPlanColorOptions(plan, context)
  const widthOptions = getWidthOptions(plan)
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">行号</th>
            <th class="px-3 py-2 font-medium">排版编码</th>
            <th class="px-3 py-2 font-medium">配比说明</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">重复次数</th>
            <th class="px-3 py-2 font-medium">唛架净长度（m）</th>
            <th class="px-3 py-2 font-medium">行成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">行单件成衣用量（m/件）</th>
            <th class="px-3 py-2 font-medium">行铺布总长度（m）</th>
            <th class="px-3 py-2 font-medium">门幅</th>
            <th class="px-3 py-2 font-medium">说明</th>
            <th class="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            lines.length
              ? lines
                  .map((line) => `
                    <tr class="border-t align-top">
                      <td class="px-3 py-2">${line.lineNo}</td>
                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(line.layoutCode)}" data-marker-plan-layout-field="layoutCode" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="text-input" class="h-9 w-24 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(line.ratioNote)}" data-marker-plan-layout-field="ratioNote" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="text-input" class="h-9 w-32 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2">
                        <select data-marker-plan-layout-field="colorCode" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="select" class="h-9 w-28 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                          ${colorOptions.map((colorCode) => `<option value="${escapeHtml(colorCode)}" ${colorCode === line.colorCode ? 'selected' : ''}>${escapeHtml(colorCode)}</option>`).join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2"><input type="number" min="0" step="1" value="${line.repeatCount}" data-marker-plan-layout-field="repeatCount" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="number-input" class="h-9 w-20 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2"><input type="number" min="0" step="0.01" value="${line.markerLength}" data-marker-plan-layout-field="markerLength" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="number-input" class="h-9 w-24 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2"><input type="number" min="0" step="1" value="${line.markerPieceQty}" data-marker-plan-layout-field="markerPieceQty" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="number-input" class="h-9 w-20 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(formatNumber(line.systemUnitUsage, 3), buildMarkerLayoutLineSystemUnitUsageFormula(line))}</td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(`${formatNumber(line.spreadLength, 2)} m`, buildMarkerLayoutLineSpreadLengthFormula(line, state.draftPlan?.singleSpreadFixedLoss || 0.06))}</td>
                      <td class="px-3 py-2">
                        <select data-marker-plan-layout-field="widthCode" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="select" class="h-9 w-24 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                          ${widthOptions.map((widthCode) => `<option value="${escapeHtml(widthCode)}" ${widthCode === line.widthCode ? 'selected' : ''}>${escapeHtml(widthCode)}</option>`).join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(line.note)}" data-marker-plan-layout-field="note" data-layout-id="${escapeHtml(line.id)}" data-marker-plan-control-type="text-input" class="h-9 w-28 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2">
                        <div class="flex flex-wrap gap-2">
                          ${renderActionButton('复制', `data-marker-plan-action="copy-layout-line" data-layout-id="${escapeHtml(line.id)}"`, 'ghost')}
                          ${renderActionButton('删除', `data-marker-plan-action="remove-layout-line" data-layout-id="${escapeHtml(line.id)}"`, 'ghost')}
                        </div>
                      </td>
                    </tr>
                  `)
                  .join('')
              : `<tr><td colspan="12" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有排版线，请先新增排版线。</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `
}

function renderLayoutLinesReadonlyTable(lines: MarkerLayoutLine[]): string {
  return `
    <div class="overflow-hidden rounded-lg border bg-background">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">行号</th>
            <th class="px-3 py-2 font-medium">排版编码</th>
            <th class="px-3 py-2 font-medium">配比说明</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">重复次数</th>
            <th class="px-3 py-2 font-medium">唛架净长度（m）</th>
            <th class="px-3 py-2 font-medium">行成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">行单件成衣用量（m/件）</th>
            <th class="px-3 py-2 font-medium">行铺布总长度（m）</th>
            <th class="px-3 py-2 font-medium">门幅</th>
            <th class="px-3 py-2 font-medium">说明</th>
          </tr>
        </thead>
        <tbody>
          ${
            lines.length
              ? lines
                  .map((line) => `
                    <tr class="border-t align-top">
                      <td class="px-3 py-2">${line.lineNo}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.layoutCode || '—')}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.ratioNote || '—')}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.colorCode || '—')}</td>
                      <td class="px-3 py-2 text-xs">${formatCount(line.repeatCount)}</td>
                      <td class="px-3 py-2 text-xs">${formatNumber(line.markerLength, 2)} m</td>
                      <td class="px-3 py-2 text-xs">${formatCount(line.markerPieceQty)}</td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(formatNumber(line.systemUnitUsage, 3), buildMarkerLayoutLineSystemUnitUsageFormula(line))}</td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(`${formatNumber(line.spreadLength, 2)} m`, buildMarkerLayoutLineSpreadLengthFormula(line))}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.widthCode || '—')}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.note || '—')}</td>
                    </tr>
                  `)
                  .join('')
              : `<tr><td colspan="11" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有排版线。</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `
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
          <span class="text-sm font-medium text-foreground">排版最大门幅（cm）</span>
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
        ${renderReadonlyField('排版最大门幅（cm）', `${formatNumber(foldConfig.maxLayoutWidth, 2)} cm`)}
      </div>
      <div>${foldConfig.widthCheckPassed ? renderStatusBadge('门幅校验通过', 'bg-emerald-100 text-emerald-700 border-emerald-200') : renderStatusBadge('门幅校验未通过', 'bg-rose-100 text-rose-700 border-rose-200')}</div>
    </section>
  `
}

function renderHighLowMatrix(cells: MarkerHighLowMatrixCell[]): string {
  const grouped = ['高层', '低层'].map((sectionName) => ({
    sectionName,
    sectionType: sectionName === '高层' ? 'HIGH' : 'LOW',
    cells: MARKER_SIZE_CODES.map((sizeCode) => cells.find((cell) => cell.sectionName === sectionName && cell.sizeCode === sizeCode) || {
      sectionType: sectionName === '高层' ? 'HIGH' : 'LOW',
      sectionName,
      sizeCode,
      qty: 0,
    }),
  }))

  return `
    <div class="overflow-hidden rounded-lg border bg-background" data-testid="marker-plan-high-low-matrix">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">层区</th>
            ${MARKER_SIZE_CODES.map((sizeCode) => `<th class="px-3 py-2 font-medium">${escapeHtml(sizeCode)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${grouped
            .map((row) => `
              <tr class="border-t">
                <td class="px-3 py-2 font-medium">${escapeHtml(row.sectionName)}</td>
                ${row.cells
                  .map(
                    (cell) => `
                      <td class="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value="${cell.qty}"
                          data-marker-plan-action="change-matrix-cell"
                          data-section-name="${escapeHtml(cell.sectionName)}"
                          data-section-type="${escapeHtml(cell.sectionType)}"
                          data-size-code="${escapeHtml(cell.sizeCode)}"
                          data-marker-plan-control-type="number-input"
                          class="h-9 w-20 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    `,
                  )
                  .join('')}
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderHighLowMatrixReadonly(cells: MarkerHighLowMatrixCell[]): string {
  const grouped = ['高层', '低层'].map((sectionName) => ({
    sectionName,
    cells: MARKER_SIZE_CODES.map(
      (sizeCode) =>
        cells.find((cell) => cell.sectionName === sectionName && cell.sizeCode === sizeCode) || {
          sectionType: sectionName === '高层' ? 'HIGH' : 'LOW',
          sectionName,
          sizeCode,
          qty: 0,
        },
    ),
  }))

  return `
    <div class="overflow-hidden rounded-lg border bg-background" data-testid="marker-plan-high-low-matrix">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">层区</th>
            ${MARKER_SIZE_CODES.map((sizeCode) => `<th class="px-3 py-2 font-medium">${escapeHtml(sizeCode)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${grouped
            .map((row) => `
              <tr class="border-t">
                <td class="px-3 py-2 font-medium">${escapeHtml(row.sectionName)}</td>
                ${row.cells.map((cell) => `<td class="px-3 py-2 text-xs">${formatCount(cell.qty)}</td>`).join('')}
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderModeDetailTable(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const lines = plan.modeDetailLines
  const colorOptions = getPlanColorOptions(plan, context)
  return `
    <div class="overflow-hidden rounded-lg border bg-background" data-testid="marker-plan-mode-detail-lines">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">模式名称</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">重复次数</th>
            <th class="px-3 py-2 font-medium">唛架净长度（m）</th>
            <th class="px-3 py-2 font-medium">模式成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">系统单件成衣用量（m/件）</th>
            <th class="px-3 py-2 font-medium">行铺布总长度（m）</th>
            <th class="px-3 py-2 font-medium">说明</th>
            <th class="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            lines.length
              ? lines
                  .map((line) => `
                    <tr class="border-t align-top">
                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(line.modeName)}" data-marker-plan-mode-detail-field="modeName" data-mode-detail-id="${escapeHtml(line.id)}" data-marker-plan-control-type="text-input" class="h-9 w-28 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2">
                        <select data-marker-plan-mode-detail-field="colorCode" data-mode-detail-id="${escapeHtml(line.id)}" data-marker-plan-control-type="select" class="h-9 w-28 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                          ${colorOptions.map((colorCode) => `<option value="${escapeHtml(colorCode)}" ${colorCode === line.colorCode ? 'selected' : ''}>${escapeHtml(colorCode)}</option>`).join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2"><input type="number" min="0" step="1" value="${line.repeatCount}" data-marker-plan-mode-detail-field="repeatCount" data-mode-detail-id="${escapeHtml(line.id)}" data-marker-plan-control-type="number-input" class="h-9 w-20 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2"><input type="number" min="0" step="0.01" value="${line.markerLength}" data-marker-plan-mode-detail-field="markerLength" data-mode-detail-id="${escapeHtml(line.id)}" data-marker-plan-control-type="number-input" class="h-9 w-24 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2"><input type="number" min="0" step="1" value="${line.markerPieceQty}" data-marker-plan-mode-detail-field="markerPieceQty" data-mode-detail-id="${escapeHtml(line.id)}" data-marker-plan-control-type="number-input" class="h-9 w-20 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(formatNumber(line.systemUnitUsage, 3), buildMarkerModeDetailSystemUnitUsageFormula(line))}</td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(`${formatNumber(line.spreadLength, 2)} m`, buildMarkerModeDetailSpreadLengthFormula(line, state.draftPlan?.singleSpreadFixedLoss || 0.06))}</td>
                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(line.note)}" data-marker-plan-mode-detail-field="note" data-mode-detail-id="${escapeHtml(line.id)}" data-marker-plan-control-type="text-input" class="h-9 w-28 rounded-md border bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td class="px-3 py-2">
                        <div class="flex flex-wrap gap-2">
                          ${renderActionButton('复制', `data-marker-plan-action="copy-mode-detail-line" data-mode-detail-id="${escapeHtml(line.id)}"`, 'ghost')}
                          ${renderActionButton('删除', `data-marker-plan-action="remove-mode-detail-line" data-mode-detail-id="${escapeHtml(line.id)}"`, 'ghost')}
                        </div>
                      </td>
                    </tr>
                  `)
                  .join('')
              : `<tr><td colspan="9" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有模式明细，请先新增模式明细。</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `
}

function renderModeDetailReadonlyTable(lines: MarkerModeDetailLine[]): string {
  return `
    <div class="overflow-hidden rounded-lg border bg-background" data-testid="marker-plan-mode-detail-lines">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">模式名称</th>
            <th class="px-3 py-2 font-medium">颜色</th>
            <th class="px-3 py-2 font-medium">重复次数</th>
            <th class="px-3 py-2 font-medium">唛架净长度（m）</th>
            <th class="px-3 py-2 font-medium">模式成衣件数（件）</th>
            <th class="px-3 py-2 font-medium">系统单件成衣用量（m/件）</th>
            <th class="px-3 py-2 font-medium">行铺布总长度（m）</th>
            <th class="px-3 py-2 font-medium">说明</th>
          </tr>
        </thead>
        <tbody>
          ${
            lines.length
              ? lines
                  .map((line) => `
                    <tr class="border-t align-top">
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.modeName || '—')}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.colorCode || '—')}</td>
                      <td class="px-3 py-2 text-xs">${formatCount(line.repeatCount)}</td>
                      <td class="px-3 py-2 text-xs">${formatNumber(line.markerLength, 2)} m</td>
                      <td class="px-3 py-2 text-xs">${formatCount(line.markerPieceQty)}</td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(formatNumber(line.systemUnitUsage, 3), buildMarkerModeDetailSystemUnitUsageFormula(line))}</td>
                      <td class="px-3 py-2 text-xs">${renderValueWithFormula(`${formatNumber(line.spreadLength, 2)} m`, buildMarkerModeDetailSpreadLengthFormula(line))}</td>
                      <td class="px-3 py-2 text-xs">${escapeHtml(line.note || '—')}</td>
                    </tr>
                  `)
                  .join('')
              : `<tr><td colspan="8" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有模式明细。</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `
}

function renderLayoutTab(plan: MarkerPlan, context: MarkerPlanContextCandidate | null): string {
  const normalMode = plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
  const foldMode = plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low'
  const highLowMode = plan.markerMode === 'high_low' || plan.markerMode === 'fold_high_low'

  return `
    <section class="space-y-3 rounded-lg border bg-card p-3" data-testid="marker-plan-layout-tab-${plan.markerMode}">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderInputField('单次铺布固定损耗（m）', String(plan.singleSpreadFixedLoss || 0.06), 'singleSpreadFixedLoss', 'number')}
        ${renderReadonlyField('计划铺布总长度（m）', `${formatNumber(plan.plannedSpreadLength, 2)} m`, buildMarkerPlannedSpreadLengthFormula(plan))}
      </div>
      ${foldMode ? renderFoldConfigEditor(plan.foldConfig) : ''}
      ${
        normalMode
          ? `
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">排版线</h3>
              ${renderActionButton('新增排版线', 'data-marker-plan-action="add-layout-line"')}
            </div>
            ${renderLayoutLinesTable(plan, context)}
          `
          : ''
      }
      ${
        highLowMode
          ? `
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">高低层矩阵</h3>
                <span class="text-xs text-muted-foreground">矩阵总数：${formatCount(plan.highLowMatrixCells.reduce((sum, cell) => sum + cell.qty, 0))}</span>
              </div>
              <div class="font-mono text-[11px] text-muted-foreground">${escapeHtml(buildMarkerHighLowMatrixTotalFormula(plan.highLowMatrixCells))}</div>
              ${renderHighLowMatrix(plan.highLowMatrixCells)}
            </div>
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">模式明细</h3>
                ${renderActionButton('新增模式明细', 'data-marker-plan-action="add-mode-detail-line"')}
              </div>
              ${renderModeDetailTable(plan, context)}
            </div>
          `
          : ''
      }
      ${
        !normalMode && !highLowMode
          ? `<div class="rounded-lg border bg-background px-3 py-6 text-center text-xs text-muted-foreground">当前模式还没有可展示的排版计划结构。</div>`
          : ''
      }
    </section>
  `
}

function renderLayoutReadonlyTab(plan: MarkerPlan | MarkerPlanViewRow): string {
  const normalMode = plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
  const foldMode = plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low'
  const highLowMode = plan.markerMode === 'high_low' || plan.markerMode === 'fold_high_low'

  return `
    <section class="space-y-3 rounded-lg border bg-card p-3" data-testid="marker-plan-layout-tab-${plan.markerMode}">
      ${foldMode ? renderFoldConfigReadonly(plan.foldConfig) : ''}
      ${
        normalMode
          ? `
            <div class="space-y-3">
              <h3 class="text-sm font-semibold">排版线</h3>
              ${renderLayoutLinesReadonlyTable(plan.layoutLines)}
            </div>
          `
          : ''
      }
      ${
        highLowMode
          ? `
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">高低层矩阵</h3>
                <span class="text-xs text-muted-foreground">矩阵总数：${formatCount(plan.highLowMatrixCells.reduce((sum, cell) => sum + cell.qty, 0))}</span>
              </div>
              <div class="font-mono text-[11px] text-muted-foreground">${escapeHtml(buildMarkerHighLowMatrixTotalFormula(plan.highLowMatrixCells))}</div>
              ${renderHighLowMatrixReadonly(plan.highLowMatrixCells)}
            </div>
            <div class="space-y-3">
              <h3 class="text-sm font-semibold">模式明细</h3>
              ${renderModeDetailReadonlyTable(plan.modeDetailLines)}
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderImageCards(images: MarkerImageRecord[], readOnly = false): string {
  if (!images.length) {
    return '<div class="rounded-lg border border-dashed bg-background px-4 py-8 text-center text-xs text-muted-foreground">当前还没有唛架图，可先上传图片或替换主图。</div>'
  }
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${images
        .map((image) => `
          <article class="overflow-hidden rounded-lg border bg-background">
            <div class="aspect-[16/9] bg-slate-100">
              <img src="${escapeHtml(image.previewUrl)}" alt="${escapeHtml(image.fileName)}" class="h-full w-full object-cover" />
            </div>
            <div class="space-y-2 px-3 py-3">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium">${escapeHtml(image.fileName)}</p>
                ${image.isPrimary ? renderStatusBadge('主图', 'bg-blue-100 text-blue-700 border-blue-200') : ''}
              </div>
              <p class="text-xs text-muted-foreground">${escapeHtml(image.uploadedAt)} · ${escapeHtml(image.uploadedBy)}</p>
              ${image.note ? `<p class="text-xs text-muted-foreground">备注：${escapeHtml(image.note)}</p>` : ''}
              ${
                !readOnly
                  ? `
                    <div class="flex flex-wrap gap-2">
                      ${renderActionButton('预览', `data-marker-plan-action="preview-image" data-image-id="${escapeHtml(image.id)}"`, 'ghost')}
                      ${image.isPrimary ? '' : renderActionButton('设为主图', `data-marker-plan-action="set-primary-image" data-image-id="${escapeHtml(image.id)}"`)}
                      ${renderActionButton('替换', `data-marker-plan-action="replace-image" data-image-id="${escapeHtml(image.id)}"`)}
                      ${renderActionButton('删除', `data-marker-plan-action="delete-image" data-image-id="${escapeHtml(image.id)}"`, 'ghost')}
                    </div>
                  `
                  : `<div class="flex flex-wrap gap-2">${renderActionButton('预览', `data-marker-plan-action="preview-image" data-image-id="${escapeHtml(image.id)}"`, 'ghost')}</div>`
              }
            </div>
          </article>
        `)
        .join('')}
    </div>
  `
}

function renderImagesTab(plan: MarkerPlan, readOnly = false): string {
  const primaryImage = getCurrentPrimaryImage(plan)
  const historyEntries = [
    ...(plan.updatedAt
      ? [
          {
            id: 'plan-updated',
            title: '计划最近更新',
            time: plan.updatedAt,
            actor: plan.updatedBy || '系统',
            detail: `主状态：${markerPlanStatusMeta[plan.status].label}`,
          },
        ]
      : []),
    ...plan.imageRecords.map((image) => ({
      id: image.id,
      title: image.isPrimary ? '主图更新' : '图片上传',
      time: image.uploadedAt,
      actor: image.uploadedBy,
      detail: image.fileName,
    })),
  ].sort((left, right) => String(right.time || '').localeCompare(String(left.time || ''), 'zh-CN'))

  return `
    <section class="space-y-3 rounded-lg border bg-card p-3" data-testid="marker-plan-images-tab">
      ${
        !readOnly
          ? `
            <div class="flex flex-wrap items-center gap-2">
              ${renderActionButton('上传图片', 'data-marker-plan-action="upload-image"', 'primary')}
              ${renderActionButton('替换主图', 'data-marker-plan-action="replace-primary-image"', 'secondary', !primaryImage)}
            </div>
          `
          : ''
      }
      ${renderImageCards(plan.imageRecords, readOnly)}
      ${
        readOnly
          ? `
            ${
              primaryImage
                ? `
                  <section class="space-y-2 rounded-lg border bg-background p-3">
                    <h3 class="text-sm font-semibold">主图预览</h3>
                    <div class="overflow-hidden rounded-lg border bg-slate-50">
                      <img src="${escapeHtml(primaryImage.previewUrl)}" alt="${escapeHtml(primaryImage.fileName)}" class="h-full max-h-72 w-full object-contain" />
                    </div>
                  </section>
                `
                : ''
            }
            <div class="grid gap-3 lg:grid-cols-2">
              ${renderReadonlyField('是否有调整', plan.hasAdjustment ? '是' : '否')}
              ${renderReadonlyField('调整说明', plan.adjustmentNote || '—')}
              ${renderReadonlyField('备注', primaryImage?.note || '—')}
            </div>
            <section class="space-y-3 rounded-lg border bg-background p-3">
              <h3 class="text-sm font-semibold">变更历史</h3>
              ${
                historyEntries.length
                  ? `
                    <div class="space-y-3">
                      ${historyEntries
                        .map(
                          (entry) => `
                            <article class="rounded-lg border bg-card px-3 py-3">
                              <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="text-sm font-medium text-foreground">${escapeHtml(entry.title)}</div>
                                <div class="text-xs text-muted-foreground">${escapeHtml(entry.time)}</div>
                              </div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(entry.actor)}${entry.detail ? ` · ${escapeHtml(entry.detail)}` : ''}</div>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  `
                  : '<div class="text-xs text-muted-foreground">当前还没有变更记录。</div>'
              }
            </section>
          `
          : `
            <div class="grid gap-3 lg:grid-cols-2">
              <label class="space-y-2 rounded-lg border bg-background px-3 py-3">
                <span class="text-sm font-medium text-foreground">是否有调整</span>
                <select data-marker-plan-image-field="hasAdjustment" data-marker-plan-control-type="select" class="h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="NO" ${plan.hasAdjustment ? '' : 'selected'}>否</option>
                  <option value="YES" ${plan.hasAdjustment ? 'selected' : ''}>是</option>
                </select>
              </label>
              ${renderTextareaField('调整说明', plan.adjustmentNote, 'adjustmentNote')}
            </div>
            ${renderTextareaField('备注', primaryImage?.note || '', 'primaryImageNote')}
          `
      }
    </section>
  `
}

function renderDetailReadOnlyTable(title: string, tableHtml: string): string {
  return `
    <details class="rounded-lg border bg-card" open>
      <summary class="cursor-pointer px-4 py-3 text-sm font-semibold">${escapeHtml(title)}</summary>
      <div class="border-t p-4">${tableHtml}</div>
    </details>
  `
}

function renderDetailTab(plan: MarkerPlanViewRow, activeTab: MarkerPlanTabKey): string {
  if (activeTab === 'basic') {
    return `
      <div class="space-y-3" data-testid="marker-plan-basic-detail-tab">
        <section class="space-y-3 rounded-lg border bg-card p-3">
          <div class="space-y-3">
            <h3 class="text-sm font-semibold">尺码配比</h3>
            ${renderSizeRatioReadonlyGrid(plan)}
          </div>
          <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            ${renderReadonlyField('唛架成衣件数（件）', formatCount(plan.totalPieces), plan.totalPiecesFormula)}
            ${renderReadonlyField('系统单件成衣用量（m/件）', `${formatNumber(plan.systemUnitUsage, 3)} m/件`, plan.systemUnitUsageFormula)}
            ${renderReadonlyField('人工修正单件成衣用量（m/件）', plan.manualUnitUsage == null ? '—' : `${formatNumber(plan.manualUnitUsage, 3)} m/件`)}
            ${renderReadonlyField('最终单件成衣用量（m/件）', `${formatNumber(plan.finalUnitUsage, 3)} m/件`, plan.finalUnitUsageFormula)}
            ${renderReadonlyField('计划铺布层数（层）', formatCount(plan.plannedLayerCount))}
            ${renderReadonlyField('计划铺布总长度（m）', `${formatNumber(plan.plannedSpreadLength, 2)} m`, plan.plannedSpreadLengthFormula)}
          </div>
        </section>
      </div>
    `
  }

  if (activeTab === 'allocation') {
    return `
      <div class="space-y-3" data-testid="marker-plan-allocation-detail-tab">
        ${
          plan.allocationStatus !== 'balanced'
            ? `
              <section class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                当前来源分配尚未配平，请优先处理配平差值。
              </section>
            `
            : ''
        }
        ${renderDetailReadOnlyTable(
          '来源分配',
          renderAllocationReadonlyTable(plan, findMarkerPlanContextForPlan(getViewModel().contexts, plan)),
        )}
        ${renderDetailReadOnlyTable('配平表', renderBalanceTable(plan.balanceRows))}
      </div>
    `
  }

  if (activeTab === 'explosion') {
    return renderDetailReadOnlyTable('裁片拆解', renderExplosionTab(plan, null, true))
  }

  if (activeTab === 'layout') {
    return renderDetailReadOnlyTable('排版计划', renderLayoutReadonlyTab(plan))
  }

  return renderDetailReadOnlyTable('图片与变更', renderImagesTab(plan, true))
}

function renderListTabs(listTab: MarkerPlanListTab): string {
  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-2 py-1" data-testid="marker-plan-list-tabs">
      <div class="flex flex-wrap gap-1">
        ${buildMarkerPlanListTabOptions()
          .map(
            (tab) => `
              <button
                type="button"
                class="rounded-md border px-1.5 py-0.5 text-[11px] leading-4 ${listTab === tab.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                data-marker-plan-action="switch-list-tab"
                data-list-tab="${tab.value}"
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

function getListFilterLabels(): string[] {
  const labels: string[] = [`视图：${getListTabMeta(state.listTab).label}`]
  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.contextNo) labels.push(`原始裁片单 / 合并裁剪批次：${state.filters.contextNo}`)
  if (state.filters.markerNo) labels.push(`唛架编号：${state.filters.markerNo}`)
  if (state.filters.contextType !== 'ALL') {
    const option = buildMarkerPlanContextTypeOptions().find((item) => item.value === state.filters.contextType)
    if (option) labels.push(`上下文类型：${option.label}`)
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
    if (tab === 'EXCEPTIONS' && !hasPlanExceptionIssue(row)) return false
    if (contextNo) {
      const contextKeywords = [row.contextNo, row.mergeBatchNo, ...row.originalCutOrderNos]
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
      row.mergeBatchNo,
      ...row.originalCutOrderNos,
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase())
    return keywords.some((item) => item.includes(keyword))
  })
}

function filterContexts(contexts: MarkerPlanContextCandidate[]): MarkerPlanContextCandidate[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  const contextNo = state.filters.contextNo.trim().toLowerCase()
  return contexts.filter((context) => {
    if (contextNo) {
      const contextKeywords = [context.contextNo, ...context.originalCutOrderNos]
        .filter(Boolean)
        .map((item) => item.toLowerCase())
      if (!contextKeywords.some((item) => item.includes(contextNo))) return false
    }
    if (state.filters.contextType !== 'ALL' && context.contextType !== state.filters.contextType) return false
    if (!keyword) return true
    const keywords = [
      context.contextNo,
      context.styleCode,
      context.spuCode,
      context.styleName,
      context.materialSkuSummary,
      context.colorSummary,
      ...context.originalCutOrderNos,
      ...context.productionOrderNos,
    ]
      .filter(Boolean)
      .map((item) => item.toLowerCase())
    return keywords.some((item) => item.includes(keyword))
  })
}

function renderListFilters(): string {
  return renderStickyFilterShell(`
    <div class="space-y-1">
      <div class="grid gap-1 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
        <label class="space-y-1">
          <span class="text-[11px] font-medium text-foreground">搜索</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            data-marker-plan-filter-field="keyword"
            class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label class="space-y-1">
          <span class="text-[11px] font-medium text-foreground">主状态</span>
          <select data-marker-plan-filter-field="status" class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL">全部</option>
            ${(Object.keys(markerPlanStatusMeta) as MarkerPlanStatusKey[]).map((key) => `<option value="${key}" ${key === state.filters.status ? 'selected' : ''}>${escapeHtml(markerPlanStatusMeta[key].label)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-[11px] font-medium text-foreground">原始裁片单 / 合并裁剪批次</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.contextNo)}"
            data-marker-plan-filter-field="contextNo"
            class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label class="space-y-1">
          <span class="text-[11px] font-medium text-foreground">唛架编号</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.markerNo)}"
            data-marker-plan-filter-field="markerNo"
            class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button type="button" class="h-7 rounded-md border px-2.5 text-xs hover:bg-muted" data-marker-plan-action="reset-filters">重置筛选</button>
      </div>
      <details class="rounded-md border bg-background" data-testid="marker-plan-more-filters">
        <summary class="cursor-pointer list-none px-2 py-1 text-[11px] font-medium text-foreground">更多筛选</summary>
        <div class="border-t px-2 py-1">
          <div class="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
            <label class="space-y-1">
              <span class="text-[11px] font-medium text-foreground">上下文类型</span>
              <select data-marker-plan-filter-field="contextType" class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">全部</option>
                ${buildMarkerPlanContextTypeOptions().map((option) => `<option value="${option.value}" ${option.value === state.filters.contextType ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-[11px] font-medium text-foreground">唛架模式</span>
              <select data-marker-plan-filter-field="mode" class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">全部</option>
                ${buildMarkerPlanModeOptions().map((option) => `<option value="${option.value}" ${option.value === state.filters.mode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-[11px] font-medium text-foreground">可交接铺布</span>
              <select data-marker-plan-filter-field="ready" class="h-7 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">全部</option>
                <option value="YES" ${state.filters.ready === 'YES' ? 'selected' : ''}>是</option>
                <option value="NO" ${state.filters.ready === 'NO' ? 'selected' : ''}>否</option>
              </select>
            </label>
          </div>
        </div>
      </details>
    </div>
  `, '!top-1 !p-1.5', 'data-testid="marker-plan-list-filters"')
}

function renderStats(stats: MarkerPlanListStats): string {
  return `
    <section class="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4" data-testid="marker-plan-list-stats">
      <article class="rounded-lg border bg-card px-2 py-0.5">
        <p class="text-[11px] text-muted-foreground">待建上下文数</p>
        <p class="mt-0.5 text-base font-semibold leading-none text-slate-900">${stats.pendingContextCount}</p>
        <p class="mt-0 font-mono text-[9px] leading-3 text-muted-foreground">${stats.pendingContextCount} = ${stats.totalContextCount} - ${stats.builtContextCount}</p>
      </article>
      <article class="rounded-lg border bg-card px-2 py-0.5">
        <p class="text-[11px] text-muted-foreground">待配平唛架数</p>
        <p class="mt-0.5 text-base font-semibold leading-none text-amber-600">${stats.pendingBalanceCount}</p>
        <p class="mt-0 font-mono text-[9px] leading-3 text-muted-foreground">${stats.pendingBalanceCount} = 未配平唛架数</p>
      </article>
      <article class="rounded-lg border bg-card px-2 py-0.5">
        <p class="text-[11px] text-muted-foreground">待排版唛架数</p>
        <p class="mt-0.5 text-base font-semibold leading-none text-blue-600">${stats.waitingLayoutCount}</p>
        <p class="mt-0 font-mono text-[9px] leading-3 text-muted-foreground">${stats.waitingLayoutCount} = 待排版唛架数</p>
      </article>
      <article class="rounded-lg border bg-card px-2 py-0.5">
        <p class="text-[11px] text-muted-foreground">可交接铺布唛架数</p>
        <p class="mt-0.5 text-base font-semibold leading-none text-emerald-600">${stats.readyForSpreadingCount}</p>
        <p class="mt-0 font-mono text-[9px] leading-3 text-muted-foreground">${stats.readyForSpreadingCount} = 可交接铺布唛架数</p>
      </article>
    </section>
  `
}

function renderPendingContexts(contexts: MarkerPlanContextCandidate[]): string {
  return `
    <section class="rounded-lg border bg-card" data-testid="marker-plan-pending-contexts" data-marker-plan-main-card="true">
      <div class="flex items-center justify-between gap-2 border-b px-2.5 py-1">
        <div>
          <h2 class="text-sm font-semibold">待建上下文</h2>
        </div>
        <div class="text-xs text-muted-foreground">共 ${contexts.length} 条上下文</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">来源类型</th>
              <th class="px-3 py-2 font-medium">原始裁片单号 / 合并裁剪批次号</th>
              <th class="px-3 py-2 font-medium">来源生产单号</th>
              <th class="px-3 py-2 font-medium">款号 / SPU</th>
              <th class="px-3 py-2 font-medium">面料 SKU</th>
              <th class="px-3 py-2 font-medium">颜色</th>
              <th class="px-3 py-2 font-medium">技术包状态</th>
              <th class="px-3 py-2 font-medium">当前配料 / 领料摘要</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              contexts.length
                ? contexts
                    .map((context) => `
                      <tr class="border-t">
                        <td class="px-3 py-2">${escapeHtml(context.contextLabel)}</td>
                        <td class="px-3 py-2 font-medium">${escapeHtml(context.contextNo)}</td>
                        <td class="px-3 py-2">${escapeHtml(context.productionOrderNos.join(' / '))}</td>
                        <td class="px-3 py-2">
                          <div class="font-medium">${escapeHtml(`${context.styleCode || '-'} / ${context.spuCode || '-'}`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.styleName || '—')}</div>
                        </td>
                        <td class="px-3 py-2">${escapeHtml(context.materialSkuSummary || '—')}</td>
                        <td class="px-3 py-2">${escapeHtml(context.colorSummary || '—')}</td>
                        <td class="px-3 py-2">${escapeHtml(context.techPackStatusLabel)}</td>
                        <td class="px-3 py-2">${escapeHtml(context.prepClaimSummaryText)}</td>
                        <td class="px-3 py-2">
                          <div class="flex flex-wrap gap-2">
                            ${renderActionButton('新建唛架', `data-marker-plan-action="create-from-context" data-context-type="${escapeHtml(context.contextType)}" data-context-id="${escapeHtml(context.id)}"`, 'primary')}
                            ${
                              context.contextType === 'original-cut-order'
                                ? renderActionButton('去原始裁片单', `data-marker-plan-action="go-original-context" data-context-type="${escapeHtml(context.contextType)}" data-context-id="${escapeHtml(context.id)}"`)
                                : renderActionButton('去合并裁剪批次', `data-marker-plan-action="go-merge-context" data-context-type="${escapeHtml(context.contextType)}" data-context-id="${escapeHtml(context.id)}"`)
                            }
                          </div>
                        </td>
                      </tr>
                    `)
                    .join('')
                : `<tr><td colspan="9" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有待建上下文。</td></tr>`
            }
          </tbody>
        </table>
      `, 'max-h-[58vh]')}
    </section>
  `
}

function renderPlanRowsTable(rows: MarkerPlanViewRow[], exceptionOnly = false): string {
  const tableTitle = exceptionOnly ? '异常待处理唛架' : '已建唛架主表'
  const countText = `共 ${rows.length} 条唛架`
  return `
    <section class="rounded-lg border bg-card" data-testid="${exceptionOnly ? 'marker-plan-exception-list' : 'marker-plan-list-table'}" data-marker-plan-main-card="true">
      <div class="flex items-center justify-between gap-2 border-b px-2.5 py-1">
        <div>
          <h2 class="text-sm font-semibold">${tableTitle}</h2>
        </div>
        <div class="text-xs text-muted-foreground">${countText}</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[2140px] text-left text-xs">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-2 py-1 font-medium">唛架编号</th>
              <th class="px-2 py-1 font-medium">上下文</th>
              <th class="px-2 py-1 font-medium">来源原始裁片单数（张）</th>
              <th class="px-2 py-1 font-medium">来源生产单数（单）</th>
              <th class="px-2 py-1 font-medium">款号 / SPU</th>
              <th class="px-2 py-1 font-medium">面料 / 颜色</th>
              <th class="px-2 py-1 font-medium">唛架模式</th>
              <th class="px-2 py-1 font-medium">唛架成衣件数（件）</th>
              <th class="px-2 py-1 font-medium">最终单件成衣用量（m/件）</th>
              <th class="px-2 py-1 font-medium">计划铺布总长度（m）</th>
              <th class="px-2 py-1 font-medium">分配状态</th>
              <th class="px-2 py-1 font-medium">映射状态</th>
              <th class="px-2 py-1 font-medium">排版状态</th>
              <th class="px-2 py-1 font-medium">图片状态</th>
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
                      return `
                      <tr class="border-t align-top ${exceptionOnly ? 'cursor-pointer hover:bg-muted/10' : ''}" ${
                        exceptionOnly
                          ? `data-marker-plan-action="open-problem-detail" data-plan-id="${escapeHtml(row.id)}" data-tab-key="${problemTab}"`
                          : ''
                      }>
                        <td class="px-2 py-1">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span class="font-medium">${escapeHtml(row.markerNo)}</span>
                            ${renderStatusBadge(row.statusMeta.label, row.statusMeta.className)}
                          </div>
                        </td>
                        <td class="px-2 py-1">${escapeHtml(`${row.contextLabel} · ${row.contextNo}`)}</td>
                        <td class="px-2 py-1">${escapeHtml(row.sourceOriginalOrderCountText)}</td>
                        <td class="px-2 py-1">${escapeHtml(row.sourceProductionOrderCountText)}</td>
                        <td class="px-2 py-1 font-medium">${escapeHtml(`${row.styleCode || '-'} / ${row.spuCode || '-'}`)}</td>
                        <td class="px-2 py-1">${escapeHtml(`${row.materialSkuSummary || '—'} / ${row.colorSummary || '—'}`)}</td>
                        <td class="px-2 py-1">${renderStatusBadge(row.modeMeta.label, row.modeMeta.className)}</td>
                        <td class="px-2 py-1">${renderCompactListValueWithFormula(formatCount(row.totalPieces), row.totalPiecesFormula)}</td>
                        <td class="px-2 py-1">${renderCompactListValueWithFormula(row.finalUnitUsageText, row.finalUnitUsageFormula)}</td>
                        <td class="px-2 py-1">${renderCompactListValueWithFormula(row.plannedSpreadLengthText, row.plannedSpreadLengthFormula)}</td>
                        <td class="px-2 py-1">${renderStatusBadge(row.allocationStatusMeta.label, row.allocationStatusMeta.className)}</td>
                        <td class="px-2 py-1">${renderStatusBadge(row.mappingStatusMeta.label, row.mappingStatusMeta.className)}</td>
                        <td class="px-2 py-1">${renderStatusBadge(row.layoutStatusMeta.label, row.layoutStatusMeta.className)}</td>
                        <td class="px-2 py-1">${renderStatusBadge(row.imageStatusMeta.label, row.imageStatusMeta.className)}</td>
                        <td class="px-2 py-1">${escapeHtml(row.updatedAt || '—')}</td>
                        <td class="px-2 py-1">
                          <div class="flex flex-nowrap gap-1.5 overflow-x-auto whitespace-nowrap">
                            ${renderActionButton('查看', `data-marker-plan-action="go-detail" data-plan-id="${escapeHtml(row.id)}"${exceptionOnly ? ` data-tab-key="${problemTab}"` : ''}`)}
                            ${renderActionButton('编辑', `data-marker-plan-action="go-edit" data-plan-id="${escapeHtml(row.id)}"${exceptionOnly ? ` data-tab-key="${problemTab}"` : ''}`)}
                            ${renderActionButton('复制为新唛架', `data-marker-plan-action="copy-plan" data-plan-id="${escapeHtml(row.id)}"`)}
                            ${renderActionButton('去原始裁片单', `data-marker-plan-action="go-original-orders" data-plan-id="${escapeHtml(row.id)}"`)}
                            ${row.mergeBatchId ? renderActionButton('去合并裁剪批次', `data-marker-plan-action="go-merge-batch" data-plan-id="${escapeHtml(row.id)}"`) : ''}
                            ${row.readyForSpreading ? renderActionButton('交给铺布', `data-marker-plan-action="go-spreading" data-plan-id="${escapeHtml(row.id)}"`, 'primary') : ''}
                          </div>
                        </td>
                      </tr>
                    `})
                    .join('')
                : `<tr><td colspan="16" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有唛架计划。</td></tr>`
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
  const baseContexts =
    state.contextDrawerType === 'ALL'
      ? (viewModel.pendingContexts.length ? viewModel.pendingContexts : viewModel.contexts)
      : (() => {
          const typedPending = viewModel.pendingContexts.filter((context) => context.contextType === state.contextDrawerType)
          return typedPending.length ? typedPending : viewModel.contexts.filter((context) => context.contextType === state.contextDrawerType)
        })()
  const candidates = baseContexts.filter((context) => {
    if (state.contextDrawerType !== 'ALL' && context.contextType !== state.contextDrawerType) return false
    const keyword = state.contextKeyword.trim().toLowerCase()
    if (!keyword) return true
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

  const content = `
    <div class="space-y-4" data-testid="marker-plan-context-drawer">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">上下文类型</span>
          <select data-marker-plan-action="change-context-drawer-type" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ALL" ${state.contextDrawerType === 'ALL' ? 'selected' : ''}>全部</option>
            ${buildMarkerPlanContextTypeOptions()
              .map(
                (option) =>
                  `<option value="${option.value}" ${state.contextDrawerType === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">搜索</span>
          <input type="text" value="${escapeHtml(state.contextKeyword)}" data-marker-plan-context-field="contextKeyword" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>
      <div class="overflow-hidden rounded-lg border bg-background">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">选择</th>
              <th class="px-3 py-2 font-medium">来源类型</th>
              <th class="px-3 py-2 font-medium">原始裁片单号 / 合并裁剪批次号</th>
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">款号 / SPU</th>
              <th class="px-3 py-2 font-medium">面料 SKU</th>
              <th class="px-3 py-2 font-medium">颜色</th>
              <th class="px-3 py-2 font-medium">技术包状态</th>
              <th class="px-3 py-2 font-medium">当前配料状态</th>
            </tr>
          </thead>
          <tbody>
            ${
              candidates.length
                ? candidates
                    .map((context) => `
                      <tr class="border-t ${state.selectedContextId === context.id ? 'bg-blue-50/40' : ''}">
                        <td class="px-3 py-2">
                          <input type="radio" name="marker-plan-context" value="${escapeHtml(context.id)}" data-marker-plan-action="select-context" data-context-type="${escapeHtml(context.contextType)}" data-context-id="${escapeHtml(context.id)}" ${state.selectedContextId === context.id ? 'checked' : ''} />
                        </td>
                        <td class="px-3 py-2">${escapeHtml(context.contextLabel)}</td>
                        <td class="px-3 py-2 font-medium">${escapeHtml(context.contextNo)}</td>
                        <td class="px-3 py-2">${escapeHtml(context.productionOrderNos.join(' / '))}</td>
                        <td class="px-3 py-2">
                          <div class="font-medium">${escapeHtml(context.styleCode || context.spuCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(context.styleName || '—')}</div>
                        </td>
                        <td class="px-3 py-2">${escapeHtml(context.materialSkuSummary || '—')}</td>
                        <td class="px-3 py-2">${escapeHtml(context.colorSummary || '—')}</td>
                        <td class="px-3 py-2">${escapeHtml(context.techPackStatusLabel)}</td>
                        <td class="px-3 py-2">${escapeHtml(context.prepStatusLabel)}</td>
                      </tr>
                    `)
                    .join('')
                : `<tr><td colspan="9" class="px-3 py-8 text-center text-xs text-muted-foreground">当前筛选范围内没有可选上下文。</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '选择唛架上下文',
      subtitle: '先选原始裁片单或合并裁剪批次，再进入新增唛架页。',
      closeAction: { prefix: 'marker-plan', action: 'close-context-drawer' },
      width: 'xl',
    },
    content,
    {
      cancel: { prefix: 'marker-plan', action: 'close-context-drawer', label: '取消' },
      confirm: {
        prefix: 'marker-plan',
        action: 'confirm-context-create',
        label: '进入新增',
        variant: 'primary',
        disabled: !state.selectedContextId,
      },
    },
  )
}

function renderListPage(viewModel = getViewModel()): string {
  clearMarkerPlanStickyOffset()
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-list')
  const filteredPlans = filterPlans(viewModel.plans, state.listTab)
  const filteredPending = filterContexts(viewModel.pendingContexts)
  const mainContent =
    state.listTab === 'PENDING'
      ? renderPendingContexts(filteredPending)
      : renderPlanRowsTable(filteredPlans, state.listTab === 'EXCEPTIONS')

  return `
    <div class="space-y-1 p-1.5" data-testid="cutting-marker-plan-list-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('LIST', null),
        showCompatibilityBadge: isCuttingAliasPath(getCurrentBasePath()),
      })}
      ${renderFeedbackBar()}
      ${renderStats(viewModel.stats)}
      ${renderListTabs(state.listTab)}
      ${renderListFilters()}
      ${renderListStateBar()}
      ${mainContent}
      ${renderContextDrawer(viewModel)}
    </div>
  `
}

function renderEditorWarning(plan: MarkerPlanViewRow | null): string {
  if (!plan) return ''
  const warningText = getMarkerPlanReferencedWarning(plan)
  if (!warningText) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      ${escapeHtml(warningText)}
    </section>
  `
}

function renderEditorBody(route: MarkerPlanRouteKind, plan: MarkerPlan | MarkerPlanViewRow | null, context: MarkerPlanContextCandidate | null): string {
  if (!plan) {
    return `
      <section class="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        当前还没选定上下文，请先从列表页选择原始裁片单或合并裁剪批次。
      </section>
    `
  }

  const activeTab = state.activeTab
  const tabContent =
    activeTab === 'basic'
      ? renderBasicTab(plan as MarkerPlan)
      : activeTab === 'allocation'
        ? renderAllocationTab(plan as MarkerPlan, context)
        : activeTab === 'explosion'
          ? renderExplosionTab(plan as MarkerPlanViewRow | MarkerPlan)
          : activeTab === 'layout'
            ? renderLayoutTab(plan as MarkerPlan, context)
            : renderImagesTab(plan as MarkerPlan)

  return `
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
    <div class="space-y-2.5 p-2.5" data-testid="cutting-marker-plan-create-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('CREATE', state.draftPlan),
      })}
      ${renderFeedbackBar()}
      ${renderEditorBody('CREATE', state.draftPlan, getDraftContext(viewModel))}
    </div>
  `
}

function renderEditPage(viewModel = getViewModel(), id = parseRoute().id): string {
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-edit')
  const sourcePlan = viewModel.plansById[id] ?? null
  return `
    <div class="space-y-2.5 p-2.5" data-testid="cutting-marker-plan-edit-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('EDIT', state.draftPlan),
      })}
      ${renderFeedbackBar()}
      ${renderEditorWarning(sourcePlan)}
      ${renderEditorBody('EDIT', state.draftPlan, getDraftContext(viewModel))}
    </div>
  `
}

function renderDetailPage(viewModel = getViewModel(), id = parseRoute().id): string {
  const meta = getCanonicalCuttingMeta(getCurrentBasePath(), 'marker-detail')
  const plan = viewModel.plansById[id] ?? null
  const context = plan ? findMarkerPlanContextForPlan(viewModel.contexts, plan) : null
  return `
    <div class="space-y-2.5 p-2.5" data-testid="cutting-marker-plan-detail-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderPlanHeaderActions('DETAIL', plan),
      })}
      ${renderFeedbackBar()}
      ${
        plan
          ? `
            ${renderPlanTopInfo(plan, context, { showActionRow: false })}
            ${renderTabNav(state.activeTab)}
            ${renderDetailTab(plan, state.activeTab)}
          `
          : `
            <section class="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              当前未找到对应唛架，请返回列表重新选择。
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
    setFeedback('warning', '请先选择上下文，再保存唛架。')
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
  setFeedback('success', `已完成唛架计划 ${nextPlan.markerNo}。`)
  return true
}

function cancelDraftPlan(): boolean {
  const route = parseRoute()
  if (route.kind !== 'EDIT' || !state.draftPlan) return false
  const context = getDraftContext(getViewModel())
  if (!context) {
    setFeedback('warning', '当前唛架上下文已丢失，无法作废。')
    return true
  }
  const confirmed = window.confirm('确认作废当前唛架吗？')
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
  if (!state.selectedContextId) {
    setFeedback('warning', '请先选择一个上下文。')
    return true
  }
  const contextType = state.contextDrawerType === 'ALL'
    ? (viewModel.pendingContexts.find((item) => item.id === state.selectedContextId)?.contextType ||
      viewModel.contexts.find((item) => item.id === state.selectedContextId)?.contextType)
    : state.contextDrawerType
  if (!contextType) return false
  const context = findMarkerPlanContextById(viewModel.contexts, contextType, state.selectedContextId)
  if (!context) {
    setFeedback('warning', '当前上下文已不可用，请重新选择。')
    return true
  }
  state.contextDrawerOpen = false
  state.selectedContextId = ''
  navigateToCreateWithContext(context)
  return true
}

function updateAllocationRowSource(row: MarkerAllocationRow, context: MarkerPlanContextCandidate, sourceCutOrderId: string): MarkerAllocationRow {
  const sourceRow = context.sourceOriginalRows.find((item) => item.originalCutOrderId === sourceCutOrderId) || context.sourceOriginalRows[0] || null
  const generatedRow = context.sourceGeneratedRows.find((item) => item.originalCutOrderId === sourceCutOrderId) || context.sourceGeneratedRows[0] || null
  return {
    ...row,
    sourceCutOrderId: sourceRow?.originalCutOrderId || sourceCutOrderId,
    sourceProductionOrderId: sourceRow?.productionOrderId || '',
    colorCode: generatedRow?.colorScope[0] || sourceRow?.color || '',
    materialSku: generatedRow?.materialSku || sourceRow?.materialSku || row.materialSku,
    styleCode: sourceRow?.styleCode || context.styleCode,
    spuCode: sourceRow?.spuCode || context.spuCode,
    techPackSpu:
      context.sourceMaterialPrepRows.find((item) => item.originalCutOrderId === sourceCutOrderId)?.techPackSpuCode ||
      context.techPackSpu,
  }
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
      setFeedback('warning', '请先选择一个唛架。')
      return true
    }
    appStore.navigate(buildMarkerPlanGoSpreadingPath(plan))
    return true
  }

  if (action === 'go-original-orders') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan) return false
    appStore.navigate(buildGoOriginalOrdersPath(plan))
    return true
  }

  if (action === 'go-original-context') {
    const contextType = node.dataset.contextType as MarkerPlanContextType | undefined
    const contextId = node.dataset.contextId || ''
    if (!contextType || !contextId) return false
    const context = findMarkerPlanContextById(viewModel.contexts, contextType, contextId)
    if (!context) return false
    appStore.navigate(buildGoOriginalOrdersPathFromContext(context))
    return true
  }

  if (action === 'go-material-prep') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan) return false
    appStore.navigate(buildGoMaterialPrepPath(plan))
    return true
  }

  if (action === 'go-merge-batch') {
    const planId = node.dataset.planId || route.id
    const plan = resolveCurrentPlan(viewModel, planId)
    if (!plan || !plan.mergeBatchId) return false
    appStore.navigate(buildGoMergeBatchPath(plan))
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
        originalCutOrderId: node.dataset.originalCutOrderId || plan.originalCutOrderIds[0],
        originalCutOrderNo: node.dataset.originalCutOrderNo || plan.originalCutOrderNos[0],
        mergeBatchId: node.dataset.mergeBatchId || plan.mergeBatchId || undefined,
        mergeBatchNo: node.dataset.mergeBatchNo || plan.mergeBatchNo || undefined,
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
    if (!context || !context.mergeBatchId) return false
    appStore.navigate(buildGoMergeBatchPathFromContext(context))
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
    state.contextDrawerType = (node.dataset.contextType as 'ALL' | MarkerPlanContextType | undefined) || 'ALL'
    state.selectedContextId = ''
    state.contextKeyword = ''
    return true
  }

  if (action === 'close-context-drawer') {
    state.contextDrawerOpen = false
    state.selectedContextId = ''
    return true
  }

  if (action === 'change-context-drawer-type') {
    const select = node as HTMLSelectElement
    state.contextDrawerType = (select.value as 'ALL' | MarkerPlanContextType) || 'ALL'
    state.selectedContextId = ''
    return true
  }

  if (action === 'select-context') {
    state.selectedContextId = node.dataset.contextId || ''
    state.contextDrawerType = (node.dataset.contextType as MarkerPlanContextType | undefined) || state.contextDrawerType
    return true
  }

  if (action === 'confirm-context-create') {
    return createFromSelectedContext(viewModel)
  }

  if (action === 'create-from-context') {
    const contextType = node.dataset.contextType as MarkerPlanContextType | undefined
    const contextId = node.dataset.contextId || ''
    if (!contextType || !contextId) return false
    const context = findMarkerPlanContextById(viewModel.contexts, contextType, contextId)
    if (!context) return false
    navigateToCreateWithContext(context)
    return true
  }

  if (action === 'reset-filters') {
    state.filters = { keyword: '', contextNo: '', markerNo: '', contextType: 'ALL', mode: 'ALL', status: 'ALL', ready: 'ALL' }
    return true
  }

  if (action === 'reset-list-view') {
    state.filters = { keyword: '', contextNo: '', markerNo: '', contextType: 'ALL', mode: 'ALL', status: 'ALL', ready: 'ALL' }
    state.listTab = 'PENDING'
    return true
  }

  if (action === 'switch-list-tab') {
    state.listTab = (node.dataset.listTab as MarkerPlanListTab | undefined) || 'PENDING'
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

  if (action === 'restore-system-unit-usage') {
    return updateDraft((plan) => ({ ...plan, manualUnitUsage: null }))
  }

  if (action === 'change-size-ratio') {
    const sizeCode = node.dataset.sizeCode
    const input = node as HTMLInputElement
    if (!sizeCode) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      sizeRatioRows: plan.sizeRatioRows.map((row) =>
        row.sizeCode === sizeCode ? { ...row, qty: Math.max(Math.round(safeNumber(input.value)), 0) } : row,
      ),
    }))
  }

  if (action === 'auto-allocation') {
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan, context) => regenerateMarkerPlanAllocationRows(plan, context))
  }

  if (action === 'add-allocation-row') {
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan, context) => ({
      ...plan,
      allocationRows: [...plan.allocationRows, createEmptyMarkerPlanAllocationRow(plan, context)],
    }))
  }

  if (action === 'remove-allocation-row') {
    const allocationId = node.dataset.allocationId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      allocationRows: plan.allocationRows.filter((row) => row.id !== allocationId),
    }))
  }

  if (action === 'clear-allocations') {
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      allocationRows: [],
    }))
  }

  if (action === 'add-layout-line') {
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan, context) => ({
      ...plan,
      layoutLines: [...plan.layoutLines, createEmptyMarkerPlanLayoutLine(plan, context)],
    }))
  }

  if (action === 'remove-layout-line') {
    const layoutId = node.dataset.layoutId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      layoutLines: plan.layoutLines.filter((line) => line.id !== layoutId),
    }))
  }

  if (action === 'copy-layout-line') {
    const layoutId = node.dataset.layoutId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const nextLine = cloneMarkerPlanLayoutLine(plan, layoutId)
      if (!nextLine) return plan
      return {
        ...plan,
        layoutLines: [...plan.layoutLines, nextLine],
      }
    })
  }

  if (action === 'add-mode-detail-line') {
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan, context) => ({
      ...plan,
      modeDetailLines: [...plan.modeDetailLines, createEmptyMarkerPlanModeDetailLine(plan, context)],
    }))
  }

  if (action === 'remove-mode-detail-line') {
    const modeDetailId = node.dataset.modeDetailId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      modeDetailLines: plan.modeDetailLines.filter((line) => line.id !== modeDetailId),
    }))
  }

  if (action === 'copy-mode-detail-line') {
    const modeDetailId = node.dataset.modeDetailId || ''
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => {
      const nextLine = cloneMarkerPlanModeDetailLine(plan, modeDetailId)
      if (!nextLine) return plan
      return {
        ...plan,
        modeDetailLines: [...plan.modeDetailLines, nextLine],
      }
    })
  }

  if (action === 'upload-image') {
    return updateDraft((plan) => createMarkerPlanImage(plan, 'upload'))
  }

  if (action === 'replace-primary-image') {
    return updateDraft((plan) => createMarkerPlanImage(plan, 'replace-primary'))
  }

  if (action === 'preview-image') {
    const planId = route.kind === 'DETAIL' ? route.id : state.draftPlan?.id || ''
    const sourcePlan =
      route.kind === 'DETAIL'
        ? viewModel.plansById[planId]
        : state.draftPlan
    const imageId = node.dataset.imageId || ''
    const image = sourcePlan?.imageRecords.find((record) => record.id === imageId)
    if (!image) return false
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      window.alert('浏览器阻止了预览窗口，请允许弹窗后重试。')
      return false
    }
    const safeTitle = escapeHtml(image.fileName)
    const safePreviewUrl = escapeHtml(image.previewUrl)
    previewWindow.document.write(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="UTF-8" />
          <title>${safeTitle}</title>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              background: #f8fafc;
              color: #0f172a;
            }
            .preview-shell {
              display: flex;
              flex-direction: column;
              gap: 16px;
              min-height: calc(100vh - 48px);
            }
            .preview-card {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              background: #ffffff;
              box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
              padding: 20px;
            }
            img {
              display: block;
              width: 100%;
              max-width: 100%;
              height: auto;
              background: #ffffff;
            }
            .preview-meta {
              font-size: 14px;
              color: #475569;
            }
          </style>
        </head>
        <body>
          <div class="preview-shell">
            <div class="preview-card">
              <div class="preview-meta">图片文件：${safeTitle}</div>
            </div>
            <div class="preview-card">
              <img src="${safePreviewUrl}" alt="${safeTitle}" />
            </div>
          </div>
        </body>
      </html>
    `)
    previewWindow.document.close()
    return true
  }

  if (action === 'set-primary-image') {
    const imageId = node.dataset.imageId || ''
    return updateDraft((plan) => setMarkerPlanPrimaryImage(plan, imageId))
  }

  if (action === 'replace-image') {
    const imageId = node.dataset.imageId || ''
    return updateDraft((plan) => replaceMarkerPlanImage(plan, imageId))
  }

  if (action === 'delete-image') {
    const imageId = node.dataset.imageId || ''
    return updateDraft((plan) => deleteMarkerPlanImage(plan, imageId))
  }

  if (action === 'change-matrix-cell') {
    const sizeCode = node.dataset.sizeCode || ''
    const sectionName = node.dataset.sectionName || ''
    const sectionType = node.dataset.sectionType || ''
    const input = node as HTMLInputElement
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      highLowMatrixCells: plan.highLowMatrixCells.map((cell) =>
        cell.sectionName === sectionName && cell.sizeCode === sizeCode && cell.sectionType === sectionType
          ? { ...cell, qty: Math.max(Math.round(safeNumber(input.value)), 0) }
          : cell,
      ),
    }))
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
      if (state.draftPlan && shouldConfirmMarkerModeSwitch(state.draftPlan, nextMode)) {
        const confirmed = window.confirm('切换唛架模式会重置当前不兼容的排版数据，是否继续？')
        if (!confirmed) {
          input.value = state.draftPlan.markerMode
          return true
        }
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
    const field = textareaFieldNode.dataset.markerPlanTextareaField as MarkerPlanBasicField | MarkerPlanImageField | undefined
    const input = textareaFieldNode as HTMLTextAreaElement
    if (!field) return false
    if (field === 'remark') return updateDraft((plan) => ({ ...plan, remark: input.value }))
    if (field === 'adjustmentNote') return updateDraft((plan) => ({ ...plan, adjustmentNote: input.value }))
    if (field === 'primaryImageNote') return updateDraft((plan) => updatePrimaryImageNote(plan, input.value))
  }

  const imageFieldNode = target.closest<HTMLElement>('[data-marker-plan-image-field]')
  if (imageFieldNode) {
    const field = imageFieldNode.dataset.markerPlanImageField as MarkerPlanImageField | undefined
    const input = imageFieldNode as HTMLSelectElement
    if (field === 'hasAdjustment') {
      return updateDraft((plan) => ({ ...plan, hasAdjustment: input.value === 'YES' }))
    }
  }

  const allocationFieldNode = target.closest<HTMLElement>('[data-marker-plan-allocation-field]')
  if (allocationFieldNode) {
    const field = allocationFieldNode.dataset.markerPlanAllocationField as MarkerPlanAllocationField | undefined
    const allocationId = allocationFieldNode.dataset.allocationId || ''
    const input = allocationFieldNode as HTMLInputElement | HTMLSelectElement
    if (!field || !allocationId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan, context) => ({
      ...plan,
      allocationRows: plan.allocationRows.map((row) => {
        if (row.id !== allocationId) return row
        if (field === 'sourceCutOrderId') return updateAllocationRowSource(row, context, input.value)
        if (field === 'sizeCode') return { ...row, sizeCode: input.value as MarkerAllocationRow['sizeCode'] }
        if (field === 'garmentQty') return { ...row, garmentQty: Math.max(Math.round(safeNumber(input.value)), 0) }
        if (field === 'specialFlags') {
          const select = input as HTMLSelectElement
          return { ...row, specialFlags: Array.from(select.selectedOptions).map((option) => option.value) }
        }
        return { ...row, note: input.value }
      }),
    }))
  }

  const layoutFieldNode = target.closest<HTMLElement>('[data-marker-plan-layout-field]')
  if (layoutFieldNode) {
    const field = layoutFieldNode.dataset.markerPlanLayoutField as MarkerPlanLayoutField | undefined
    const layoutId = layoutFieldNode.dataset.layoutId || ''
    const input = layoutFieldNode as HTMLInputElement
    if (!field || !layoutId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      layoutLines: plan.layoutLines.map((line) => {
        if (line.id !== layoutId) return line
        if (field === 'repeatCount' || field === 'markerPieceQty') {
          return { ...line, [field]: Math.max(Math.round(safeNumber(input.value)), 0) } as MarkerLayoutLine
        }
        if (field === 'markerLength') {
          return { ...line, markerLength: Math.max(safeNumber(input.value), 0) }
        }
        return { ...line, [field]: input.value } as MarkerLayoutLine
      }),
    }))
  }

  const modeDetailFieldNode = target.closest<HTMLElement>('[data-marker-plan-mode-detail-field]')
  if (modeDetailFieldNode) {
    const field = modeDetailFieldNode.dataset.markerPlanModeDetailField as MarkerPlanModeDetailField | undefined
    const modeDetailId = modeDetailFieldNode.dataset.modeDetailId || ''
    const input = modeDetailFieldNode as HTMLInputElement | HTMLSelectElement
    if (!field || !modeDetailId) return false
    if (!confirmReferencedStructuralEdit(viewModel)) return true
    return updateDraft((plan) => ({
      ...plan,
      modeDetailLines: plan.modeDetailLines.map((line) => {
        if (line.id !== modeDetailId) return line
        if (field === 'repeatCount' || field === 'markerPieceQty') {
          return { ...line, [field]: Math.max(Math.round(safeNumber(input.value)), 0) } as MarkerModeDetailLine
        }
        if (field === 'markerLength') {
          return { ...line, markerLength: Math.max(safeNumber(input.value), 0) }
        }
        return { ...line, [field]: input.value } as MarkerModeDetailLine
      }),
    }))
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
