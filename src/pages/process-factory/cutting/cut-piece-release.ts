// @page-pattern: list

import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { systems } from '../../../data/app-shell-config.ts'
import { replacementFabricMaterialDisplayCode } from '../../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import {
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import {
  calculateCutPieceReleaseHistoryDifference,
  saveCutPieceReleaseAvailableQtyAction,
  saveCutPieceReleaseTargetAction,
  saveCutPieceReleaseTicketValidityAction,
  getCutPieceDispatchReadinessForTask,
  getCutPieceReleaseFactSourceSummary,
  getCutPieceReleaseRecord,
  getCutPieceReleaseMigrationStatus,
  migrateLegacyCutPieceReleaseRecords,
  withCutPieceReleaseReadSnapshot,
  listLateCutPieceReleaseEvents,
  listCutPieceReleaseAvailableQtyVersions,
  listCutPieceReleaseMatrixVersions,
  listCutPieceReleaseRecords,
  listCutPieceReleaseTargetSnapshots,
  type CutPieceReleaseAvailableStatus,
  type CutPieceReleaseAvailableQtyVersion,
  type CutPieceReleaseRecord,
  type CutPieceReleaseHistoryDifference,
  type CutPieceReleaseHistoryQuantityValue,
  type CutPieceReleaseMatrixVersion,
} from '../../../data/fcs/cut-piece-release.ts'
import type {
  MatrixCalculationStatus,
  MatrixTargetStatus,
  ReleaseColorGroup,
  ReleaseMatrixCell,
  ReleaseTargetDifference,
  ReleaseTicketDetail,
} from '../../../data/fcs/cut-piece-release-domain.ts'
import { buildSupplementPartShortages, buildTargetPreview } from '../../../data/fcs/cut-piece-release-domain.ts'
import { getCutPieceTicketValidity } from '../../../data/fcs/cutting/cut-piece-ticket-validity.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime, localDateTimeText } from '../../../utils.ts'

type MatrixStatusFilter = '全部' | MatrixCalculationStatus
type TargetStatusFilter = '全部' | MatrixTargetStatus
type TargetMode = '查看' | '编辑' | '确认'

interface CutPieceReleaseFeedback {
  tone: 'success' | 'warning' | 'error'
  message: string
}

interface CutPieceReleaseActiveCell {
  garmentColor: string
  size: string
  materialId: string
}

interface SavedTargetSnapshotMetadata {
  snapshotId: string
  matrixVersion: number
  colorSizeTargets: Record<string, number>
  hasShortage: boolean
}

interface CutPieceReleasePageState {
  keywordDraft: string
  keyword: string
  matrixStatus: MatrixStatusFilter
  targetStatus: TargetStatusFilter
  releaseStatusFilter: string
  factChangeFilter: string
  page: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  activeRecordId: string | null
  activeColor: string | null
  targetMode: TargetMode
  targetDraft: Record<string, number>
  currentMatrixVersion: number | null
  targetBasisVersion: number | null
  savedTargetSnapshot: SavedTargetSnapshotMetadata | null
  activeCell: CutPieceReleaseActiveCell | null
  historyOpen: boolean
  historyPage: number
  expandedHistoryVersion: number | null
  overlayReturnTestId: string | null
  feedback: CutPieceReleaseFeedback | null
  releaseVersionLogOpen: boolean
  releaseVersionLogPage: number
  targetCandidateKey: string | null
  releaseDraft: Record<string, string>
  releaseEditing: boolean
  riskReasonDraft: string
  saving: boolean
  imagePreview: { src: string; alt: string; returnTestId: string | null } | null
  drawerMaterialFilter: string
  drawerPartFilter: string
  drawerTicketFilter: string
  validityReasons: Record<string, string>
  migrationOtherPagesClosed: boolean
  migrationMessage: string
}

const listPageSizes = [10, 20, 50]
const listStorageKey = 'higood:list-page:/fcs/craft/cutting/cut-piece-release'
const listMaxFrozenWidth = 520
const listColumnRules: StandardListColumnRule[] = [
  { key: 'productionOrder', required: true, freezeable: true },
  { key: 'spu', freezeable: true },
  { key: 'colorSize' },
  { key: 'matrixStatus', required: true, freezeable: true },
  { key: 'targetStatus', freezeable: true },
  { key: 'releaseStatus', required: true, freezeable: true },
  { key: 'targetQty' },
  { key: 'kitQty' },
  { key: 'releaseQty' },
  { key: 'allocatedQty' },
  { key: 'availableQty' },
  { key: 'factChange', freezeable: true },
  { key: 'riskQty' },
  { key: 'shortage' },
  { key: 'frozenCutOrders' },
  { key: 'latestUpdate', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]
const defaultListColumnPreferences: StandardListColumnPreferences = {
  order: ['productionOrder', 'spu', 'colorSize', 'matrixStatus', 'targetStatus', 'releaseStatus', 'targetQty', 'kitQty', 'releaseQty', 'allocatedQty', 'availableQty', 'riskQty', 'factChange', 'shortage', 'frozenCutOrders', 'latestUpdate', 'actions'],
  visibleKeys: ['productionOrder', 'spu', 'colorSize', 'matrixStatus', 'targetStatus', 'releaseStatus', 'targetQty', 'kitQty', 'releaseQty', 'allocatedQty', 'availableQty', 'riskQty', 'factChange', 'shortage', 'frozenCutOrders', 'latestUpdate', 'actions'],
  frozenKeys: [],
  pageSize: 10,
}

const state: CutPieceReleasePageState = {
  keywordDraft: '',
  keyword: '',
  matrixStatus: '全部',
  targetStatus: '全部',
  releaseStatusFilter: '全部',
  factChangeFilter: '全部',
  page: 1,
  sort: null,
  columnPreferences: normalizeListColumnPreferences(
    listColumnRules,
    defaultListColumnPreferences,
    listPageSizes,
  ),
  columnSettingsOpen: false,
  draggedColumnKey: '',
  activeRecordId: null,
  activeColor: null,
  targetMode: '查看',
  targetDraft: {},
  currentMatrixVersion: null,
  targetBasisVersion: null,
  savedTargetSnapshot: null,
  activeCell: null,
  historyOpen: false,
  historyPage: 1,
  expandedHistoryVersion: null,
  overlayReturnTestId: null,
  feedback: null,
  releaseVersionLogOpen: false,
  releaseVersionLogPage: 1,
  targetCandidateKey: null,
  releaseDraft: {},
  releaseEditing: false,
  riskReasonDraft: '',
  saving: false,
  imagePreview: null,
  drawerMaterialFilter: '',
  drawerPartFilter: '',
  drawerTicketFilter: '全部',
  validityReasons: {},
  migrationOtherPagesClosed: false,
  migrationMessage: '',
}

let listPreferencesLoaded = false
let scopedEscapeListenerInstalled = false
let scopedHistoryListenerInstalled = false

function resetTransientPageState(): void {
  state.keywordDraft = ''
  state.keyword = ''
  state.matrixStatus = '全部'
  state.targetStatus = '全部'
  state.releaseStatusFilter = '全部'
  state.factChangeFilter = '全部'
  state.page = 1
  state.sort = null
  state.columnSettingsOpen = false
  state.draggedColumnKey = ''
  state.activeRecordId = null
  state.activeColor = null
  state.targetMode = '查看'
  state.targetDraft = {}
  state.currentMatrixVersion = null
  state.targetBasisVersion = null
  state.savedTargetSnapshot = null
  state.activeCell = null
  state.historyOpen = false
  state.historyPage = 1
  state.expandedHistoryVersion = null
  state.overlayReturnTestId = null
  state.feedback = null
  state.releaseVersionLogOpen = false
  state.releaseVersionLogPage = 1
  state.targetCandidateKey = null
  state.releaseDraft = {}
  state.releaseEditing = false
  state.riskReasonDraft = ''
  state.saving = false
  state.imagePreview = null
  state.drawerMaterialFilter = ''
  state.drawerPartFilter = ''
  state.drawerTicketFilter = '全部'
  state.validityReasons = {}
  state.migrationOtherPagesClosed = false
  state.migrationMessage = ''
}

function getMatrixDetailQuery(): { productionOrderId: string; productionOrderNo: string } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const productionOrderId = params.get('productionOrderId')?.trim() ?? ''
  const productionOrderNo = params.get('productionOrderNo')?.trim() ?? ''
  return productionOrderId || productionOrderNo ? { productionOrderId, productionOrderNo } : null
}

function isMatrixDetailWindow(): boolean {
  return Boolean(getMatrixDetailQuery())
}

function initializeMatrixDetailFromQuery(): void {
  const query = getMatrixDetailQuery()
  if (!query) return
  const record = listCutPieceReleaseRecords().find((candidate) => (
    (query.productionOrderId && candidate.productionOrderId === query.productionOrderId)
    || (query.productionOrderNo && candidate.productionOrderNo === query.productionOrderNo)
  ))
  if (!record) return
  state.activeRecordId = record.recordId
  state.activeColor = record.matrix.colorGroups[0]?.garmentColor ?? null
  const versions = listCutPieceReleaseMatrixVersions(record.productionOrderId)
  const latestVersion = versions.at(-1)?.version ?? null
  const savedSnapshot = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1) ?? null
  const hasSavedSnapshot = Boolean(savedSnapshot && record.targetStatus === '已确认')
  state.currentMatrixVersion = latestVersion
  if (savedSnapshot && hasSavedSnapshot) {
    const colorSizeTargets = { ...savedSnapshot.targetPreview.colorSizeTargets }
    state.targetMode = '确认'
    state.targetDraft = colorSizeTargets
    state.targetBasisVersion = savedSnapshot.matrixVersion
    state.savedTargetSnapshot = {
      snapshotId: savedSnapshot.snapshotId,
      matrixVersion: savedSnapshot.matrixVersion,
      colorSizeTargets: { ...colorSizeTargets },
      hasShortage: buildSupplementPartShortages(
        savedSnapshot.matrixSnapshot,
        savedSnapshot.targetPreview,
      ).length > 0,
    }
  } else {
    state.targetMode = '查看'
    state.targetDraft = {}
    state.targetBasisVersion = latestVersion
    state.savedTargetSnapshot = null
  }
  state.feedback = null
}

export function hasCutPieceReleaseUnsavedChanges(input: {
  targetMode: TargetMode
  targetDraft: Record<string, number>
  savedTargets: Record<string, number> | null
  releaseEditing: boolean
  releaseDraft: Record<string, string>
  riskReasonDraft?: string
  validityReasons: Record<string, string>
  saving: boolean
}): boolean {
  return input.saving || input.targetMode === '编辑'
    || input.targetMode === '确认' && !areTargetSelectionsEqual(input.targetDraft, input.savedTargets ?? {})
    || Object.keys(input.releaseDraft).length > 0
    || Boolean(input.riskReasonDraft?.trim())
    || Object.values(input.validityReasons).some(reason => reason.trim().length > 0)
}

function hasCurrentUnsavedChanges(): boolean {
  return hasCutPieceReleaseUnsavedChanges({ ...state, savedTargets: state.savedTargetSnapshot?.colorSizeTargets ?? null })
}

export function isCutPieceReleaseLeavingAction(
  node: Pick<HTMLElement, 'dataset'>,
  current: Pick<ReturnType<typeof appStore.getState>, 'pathname' | 'allTabs'> = appStore.getState(),
): boolean {
  const destination = node.dataset.nav || (node.dataset.action === 'open-tab' ? node.dataset.tabHref : '')
  if (destination) return destination !== current.pathname
  if (node.dataset.cutPieceReleaseAction === 'go-supplement') return true
  if (node.dataset.action === 'switch-system') return systems.some(system => system.id === node.dataset.systemId && system.defaultPage !== current.pathname)
  if (node.dataset.action === 'activate-tab') {
    return Object.values(current.allTabs).some(tabs => tabs.tabs.some(tab => tab.key === node.dataset.tabKey && tab.href !== current.pathname))
  }
  if (node.dataset.action === 'close-tab') return Object.values(current.allTabs).some(tabs => tabs.activeKey === node.dataset.tabKey)
  return node.dataset.action === 'close-all-tabs'
}

function ensureScopedEscapeListener(): void {
  if (scopedEscapeListenerInstalled || typeof document === 'undefined') return
  scopedEscapeListenerInstalled = true
  document.addEventListener('keydown', (event) => {
    if (!document.querySelector('[data-cut-piece-release-page]')) return
    const dialog = document.querySelector<HTMLElement>('[data-cut-piece-release-image-dialog]')
      ?? document.querySelector<HTMLElement>('[data-cut-piece-release-region="overlay"] aside[role="dialog"]')
    if (event.key === 'Tab' && dialog) {
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')]
      const first = controls[0]
      const last = controls.at(-1)
      if (first && last && (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    if (
      event.key !== 'Escape'
      || !document.querySelector('[data-cut-piece-release-page]')
      || !isCraftCuttingCutPieceReleaseDialogOpen()
    ) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cutPieceReleaseAction = state.imagePreview ? 'close-image' : 'close-overlay'
    handleCraftCuttingCutPieceReleaseEvent(fakeButton)
  }, { capture: true })
  document.addEventListener('input', event => {
    const node = event.target instanceof HTMLInputElement ? event.target : null
    if (!node || !document.querySelector('[data-cut-piece-release-page]')) return
    if (['releaseQtyInput', 'riskReason', 'ticketValidityReason'].includes(node.dataset.cutPieceReleaseField || '')) {
      event.stopImmediatePropagation()
      handleFieldChange(node)
    }
  }, { capture: true })
  document.addEventListener('click', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-nav],[data-action],[data-cut-piece-release-action="go-supplement"]') : null
    if (!node || !document.querySelector('[data-cut-piece-release-page]')) return
    if (isCutPieceReleaseLeavingAction(node) && hasCurrentUnsavedChanges()) {
      if (!window.confirm('修改未保存。离开并放弃修改？')) { event.preventDefault(); event.stopImmediatePropagation() }
    }
  }, { capture: true })
  window.addEventListener('higood:before-history-navigation', event => {
    if (!document.querySelector('[data-cut-piece-release-page]') || !hasCurrentUnsavedChanges()) return
    if (!window.confirm('修改未保存。离开并放弃修改？')) {
      event.preventDefault()
      window.history.pushState(null, '', appStore.getState().pathname)
    }
  })
  window.addEventListener('beforeunload', event => {
    if (!document.querySelector('[data-cut-piece-release-page]')) return
    if (hasCurrentUnsavedChanges()) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}

function ensureScopedHistoryListener(): void {
  if (scopedHistoryListenerInstalled || typeof document === 'undefined') return
  scopedHistoryListenerInstalled = true
  const historyActions = new Set([
    'open-cell',
    'close-cell',
    'open-history',
    'close-history',
    'history-prev',
    'history-next',
    'toggle-history-version',
    'start-target',
    'select-target',
    'confirm-target',
    'back-target-edit',
    'save-target',
    'go-supplement',
    'open-target-candidates',
    'cancel-target',
    'open-image',
    'close-image',
  ])
  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    const actionNode = target?.closest<HTMLElement>('[data-cut-piece-release-action]')
    const action = actionNode?.dataset.cutPieceReleaseAction || ''
    if (!actionNode || !historyActions.has(action) || !document.querySelector('[data-cut-piece-release-page]')) return
    event.preventDefault()
    event.stopImmediatePropagation()
    handleCraftCuttingCutPieceReleaseEvent(actionNode, event)
  }, { capture: true })
}

function getListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function normalizeListPreferences(
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(listColumnRules, raw, listPageSizes)
  const columnsByKey = new Map(listColumns.map((column) => [column.key, column]))
  const visibleKeys = new Set(normalized.visibleKeys)
  const requestedFrozenKeys = new Set(normalized.frozenKeys)
  const frozenColumns = normalized.order
    .map((key) => columnsByKey.get(key))
    .filter((column): column is StandardListColumn<CutPieceReleaseRecord> => Boolean(
      column
      && !column.actionColumn
      && column.freezeable
      && visibleKeys.has(column.key)
      && requestedFrozenKeys.has(column.key),
    ))
  let frozenWidth = frozenColumns.reduce(
    (sum, column) => sum + Math.max(column.width, column.minWidth ?? 0),
    0,
  )
  while (frozenWidth > listMaxFrozenWidth && frozenColumns.length > 0) {
    const removed = frozenColumns.pop()
    if (removed) frozenWidth -= Math.max(removed.width, removed.minWidth ?? 0)
  }
  return { ...normalized, frozenKeys: frozenColumns.map((column) => column.key) }
}

function ensureListPreferences(): void {
  if (listPreferencesLoaded) return
  listPreferencesLoaded = true
  const storage = getListStorage()
  const loaded = storage
    ? loadListColumnPreferences(
        storage,
        listStorageKey,
        listColumnRules,
        defaultListColumnPreferences,
        listPageSizes,
      )
    : defaultListColumnPreferences
  state.columnPreferences = normalizeListPreferences(loaded)
  if (storage) saveListColumnPreferences(storage, listStorageKey, state.columnPreferences)
}

function saveListPreferences(): void {
  const storage = getListStorage()
  if (storage) saveListColumnPreferences(storage, listStorageKey, state.columnPreferences)
}

function formatQuantity(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('zh-CN')
}

function getReleaseSizeRank(size: string): number | null {
  const letterRanks: Record<string, number> = { XXXS: -3, XXS: -2, XS: -1, S: 0, M: 1, L: 2, XL: 3, XXL: 4, XXXL: 5, XXXXL: 6 }
  const normalized = size.trim().toUpperCase()
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized)
  if (normalized in letterRanks) return letterRanks[normalized]
  const multiple = normalized.match(/^(\d+)XL$/)
  return multiple ? Number(multiple[1]) + 2 : null
}

// PAGE-003: preserve configured custom sizes; only known letter/numeric sizes can be ordered automatically.
export function sortReleaseSizeColumns(sizes: readonly string[]): string[] {
  const unique = [...new Set(sizes)]
  if (unique.some(size => getReleaseSizeRank(size) === null)) return unique
  return unique.sort((a, b) => getReleaseSizeRank(a)! - getReleaseSizeRank(b)!)
}

function renderReleaseSizeOrderNotice(sizes: readonly string[]): string {
  return sizes.some(size => getReleaseSizeRank(size) === null)
    ? '<p class="mt-2 text-xs text-amber-700" data-release-size-order-warning>尺码顺序待核对，暂按配置展示</p>'
    : ''
}

function getMatrixSizeColumns(record: CutPieceReleaseRecord): string[] {
  return sortReleaseSizeColumns(record.matrix.colorGroups.flatMap(group => group.sizes))
}

export function parseReleaseQuantityInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const quantity = Number(value.trim())
  return Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : null
}

function renderNullableQuantity(quantity: number | null, className = ''): string {
  return quantity === null ? '<span class="text-amber-700">待核对</span>' : `<span class="tabular-nums ${className}">${formatQuantity(quantity)} 件</span>`
}

// PAGE-009: an explicitly confirmed zero is never replaced with the target quantity.
export function renderCutPieceReleaseAvailableQuantity(record: CutPieceReleaseRecord): string {
  return record.latestReleaseVersion > 0
    ? `<span class="font-semibold tabular-nums text-blue-700">${formatQuantity(record.releaseConfirmQty)} 件</span>`
    : '<span class="text-muted-foreground">未确认</span>'
}

function getAllocationReadiness(record: CutPieceReleaseRecord) {
  return getCutPieceDispatchReadinessForTask({
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    // This is a read-only availability query. A positive sentinel satisfies the
    // shared SKU identity contract; it neither submits nor reserves one garment.
    skuLines: record.skuLines.map(line => ({ skuCode: line.skuCode, color: line.colorName, size: line.sizeCode, qty: 1 })),
  })
}

const quantitySummaryCache = new WeakMap<CutPieceReleaseRecord, { kit: number | null; risk: number | null; allocated: number; available: number }>()
function getRecordQuantitySummary(record: CutPieceReleaseRecord) {
  const cached = quantitySummaryCache.get(record)
  if (cached) return cached
  const kits = record.matrix.colorGroups.flatMap(group => group.sizes.map(size => group.completeKitBySize[size]))
  const readiness = getAllocationReadiness(record)
  const summary = {
    kit: kits.some(qty => qty === null) ? null : kits.reduce<number>((sum, qty) => sum + (qty ?? 0), 0),
    risk: readiness.lines.some(line => line.riskReleaseQty === null) ? null : readiness.lines.reduce((sum, line) => sum + (line.riskReleaseQty ?? 0), 0),
    allocated: readiness.lines.reduce((sum, line) => sum + line.allocatedQty, 0),
    available: readiness.lines.reduce((sum, line) => sum + (line.availableQty ?? 0), 0),
  }
  quantitySummaryCache.set(record, summary)
  return summary
}

function renderBusinessImage(src: string | undefined, alt: string, testId: string, className = 'h-12 w-12'): string {
  if (!src || src.includes('placeholder') || src.startsWith('data:image/svg')) return `<span class="${className} flex shrink-0 items-center justify-center rounded border bg-muted text-center text-[10px] text-muted-foreground">图片未提供</span>`
  return `<button type="button" class="relative ${className} shrink-0 overflow-hidden rounded border bg-muted focus-visible:ring-2 focus-visible:ring-blue-500" data-skip-page-rerender="true" data-cut-piece-release-action="open-image" data-image-src="${escapeHtml(src)}" data-image-alt="${escapeHtml(alt)}" data-testid="${escapeHtml(testId)}" aria-label="${escapeHtml(`查看${alt}大图`)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" data-business-image onload="this.nextElementSibling.classList.add('hidden')" onerror="this.classList.add('hidden');this.nextElementSibling.textContent='图片加载失败'"><span class="absolute inset-0 flex items-center justify-center bg-muted text-[10px] text-muted-foreground">图片加载中</span></button>`
}

function renderCraftSummary(cells: readonly ReleaseMatrixCell[]): string {
  const sum = (field: 'specialCraftRequiredPieceQty' | 'specialCraftCompletedPieceQty' | 'specialCraftPendingPieceQty' | 'specialCraftAwaitingReturnPieceQty' | 'specialCraftDifferencePieceQty') => cells.reduce((total, cell) => total + (cell[field] ?? 0), 0)
  const required = sum('specialCraftRequiredPieceQty')
  const completionUnverified = cells.some(cell => cell.partCalculations.some(part => (part.ticketDetails ?? []).some(ticket => ticket.completionEvidenceKnown === false)))
  if (!required) return cells.some(cell => cell.partCalculations.some(part => (part.ticketDetails ?? []).some(ticket => !ticket.craftRequirementKnown)))
    ? '<span class="mt-1 block text-[11px] text-amber-700">工艺要求待核对</span>'
    : completionUnverified ? '<span class="mt-1 block text-[11px] text-amber-700">已实收，加工完成依据待核对</span>'
    : '<span class="mt-1 block text-[11px] text-muted-foreground">无需特殊工艺</span>'
  const waiting = sum('specialCraftAwaitingReturnPieceQty')
  const difference = sum('specialCraftDifferencePieceQty')
  return `<span class="mt-1 block text-[11px] font-normal text-slate-600">特殊工艺：需 ${formatQuantity(required)} 片</span><span class="block text-[11px] font-normal text-emerald-700">已完成并回仓 ${formatQuantity(sum('specialCraftCompletedPieceQty'))} 片</span><span class="block text-[11px] font-normal text-amber-700">未完成 ${formatQuantity(sum('specialCraftPendingPieceQty'))} 片${waiting ? ` · 加工完成待回仓 ${formatQuantity(waiting)} 片` : ''}</span>${completionUnverified ? '<span class="block text-[11px] text-amber-700">已实收，加工完成依据待核对，暂不计齐套</span>' : ''}${difference ? `<span class="block text-[11px] font-normal text-rose-700">工艺实收差异 ${formatQuantity(difference)} 片</span>` : ''}`
}

function getColorSizeCells(group: ReleaseColorGroup, size: string): ReleaseMatrixCell[] {
  return group.materialRows.flatMap(row => row.cells.filter(cell => cell.size === size))
}

function renderColorSizeDetailButton(record: CutPieceReleaseRecord, group: ReleaseColorGroup, size: string, source: string): string {
  return `<button type="button" class="mt-2 text-xs text-blue-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500" data-skip-page-rerender="true" data-cut-piece-release-action="open-cell" data-record-id="${escapeHtml(record.recordId)}" data-cell-color="${escapeHtml(group.garmentColor)}" data-cell-size="${escapeHtml(size)}" data-testid="${source}-detail-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}" aria-label="${escapeHtml(`查看${group.garmentColor} ${size}裁片详情`)}">查看裁片详情</button>`
}

function renderStatusBadge(status: MatrixCalculationStatus): string {
  const className = status === '可计算'
    ? 'bg-emerald-50 text-emerald-700'
    : status === '数据不完整'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-slate-100 text-slate-600'
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}">${escapeHtml(status)}</span>`
}

function renderTargetStatusBadge(status: MatrixTargetStatus): string {
  const className = status === '已确认'
    ? 'bg-emerald-50 text-emerald-700'
    : status === '目标后数据已变化'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-blue-50 text-blue-700'
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}">${escapeHtml(status)}</span>`
}

function renderReleaseStatusBadge(status: CutPieceReleaseAvailableStatus): string {
  const mapping: Record<CutPieceReleaseAvailableStatus, string> = {
    '待维护目标': 'bg-slate-100 text-slate-600',
    '待裁床确认': 'bg-blue-50 text-blue-700',
    '按齐套放行': 'bg-emerald-50 text-emerald-700',
    '风险放行': 'bg-amber-50 text-amber-700',
    '暂不放行': 'bg-rose-50 text-rose-700',
    '确认后需复核': 'bg-purple-50 text-purple-700',
  }
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${mapping[status]}">${escapeHtml(status)}</span>`
}

function renderColorSizeSummary(record: CutPieceReleaseRecord): string {
  const versions = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId)
  const latestVersion = versions.find((v) => v.isLatestEffective) ?? null
  return record.matrix.colorGroups.map((group) => {
    const sizes = group.sizes.map((size) => {
      const completeKitQty = group.completeKitBySize[size]
      const quantity = completeKitQty === null ? '待核对' : `${formatQuantity(completeKitQty)} 件`
      const releaseQty = latestVersion?.releaseQtyByColorSize[`${group.garmentColor}::${size}`]
      const releaseQtyText = releaseQty !== undefined ? ` · 可做 ${formatQuantity(releaseQty)} 件` : ''
      return `${size} ${quantity}${releaseQtyText}`
    }).join(' / ')
    return `<div><span class="font-medium">${escapeHtml(group.garmentColor)}</span><div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(sizes)}</div></div>`
  }).join('') || '<span class="text-muted-foreground">暂无颜色尺码</span>'
}

const listColumns: readonly StandardListColumn<CutPieceReleaseRecord>[] = [
  {
    key: 'productionOrder',
    title: '生产单',
    width: 190,
    required: true,
    freezeable: true,
    sortable: true,
    render: (record) => `
      <div class="font-semibold">${renderProductionOrderIdentityCell(record.productionOrderNo)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.recordNo)}</div>
    `,
    sortValue: (record) => record.productionOrderNo,
  },
  {
    key: 'spu',
    title: 'SPU/款式',
    width: 220,
    freezeable: true,
    sortable: true,
    render: (record) => `
      <div class="flex items-center gap-2">${renderBusinessImage(record.styleImageUrl, `${record.spuName}（${record.spuCode}）款式图`, `list-style-image-${record.recordId}`)}<div class="min-w-0"><div class="font-medium">${escapeHtml(record.spuCode)}</div>
      <div class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div></div></div>
    `,
    sortValue: (record) => record.spuCode,
  },
  {
    key: 'colorSize',
    title: '颜色/尺码',
    width: 270,
    render: renderColorSizeSummary,
  },
  {
    key: 'matrixStatus',
    title: '矩阵状态',
    width: 120,
    required: true,
    freezeable: true,
    sortable: true,
    render: (record) => renderStatusBadge(record.matrixStatus),
    sortValue: (record) => record.matrixStatus,
  },
  {
    key: 'targetStatus',
    title: '目标状态',
    width: 150,
    freezeable: true,
    sortable: true,
    render: (record) => renderTargetStatusBadge(record.targetStatus),
    sortValue: (record) => record.targetStatus,
  },
  {
    key: 'releaseStatus',
    title: '放行状态',
    width: 120,
    required: true,
    freezeable: true,
    sortable: true,
    render: (record) => renderReleaseStatusBadge(record.releaseAvailableStatus),
    sortValue: (record) => record.releaseAvailableStatus,
  },
  {
    key: 'targetQty', title: '已确认目标', width: 130, align: 'right', sortable: true,
    render: (record) => record.targetStatus === '已确认' ? `${formatQuantity(record.totalTargetQty)} 件` : '未确认',
    sortValue: (record) => record.targetStatus === '已确认' ? record.totalTargetQty : -1,
  },
  {
    key: 'kitQty', title: '当前齐套', width: 130, align: 'right', sortable: true,
    render: (record) => renderNullableQuantity(getRecordQuantitySummary(record).kit),
    sortValue: (record) => getRecordQuantitySummary(record).kit ?? -1,
  },
  {
    key: 'allocatedQty', title: '有效已分配', width: 130, align: 'right', sortable: true,
    render: (record) => `${formatQuantity(getRecordQuantitySummary(record).allocated)} 件`,
    sortValue: (record) => getRecordQuantitySummary(record).allocated,
  },
  {
    key: 'availableQty', title: '可新增分配', width: 130, align: 'right', sortable: true,
    render: (record) => record.latestReleaseVersion > 0 ? `${formatQuantity(getRecordQuantitySummary(record).available)} 件` : '未确认',
    sortValue: (record) => record.latestReleaseVersion > 0 ? getRecordQuantitySummary(record).available : -1,
  },
  {
    key: 'factChange', title: '数量变化', width: 200, freezeable: true,
    render: (record) => record.requiresReview ? `<span class="text-amber-700">${escapeHtml(record.factChangeMessage || '数量已变化，请核对放行')}</span>` : '<span class="text-muted-foreground">与确认时一致</span>',
  },
  {
    key: 'releaseQty',
    title: '有效放行',
    width: 130,
    align: 'right' as const,
    sortable: true,
    render: renderCutPieceReleaseAvailableQuantity,
    sortValue: (record) => record.latestReleaseVersion > 0 ? record.releaseConfirmQty : -1,
  },
  {
    key: 'riskQty',
    title: '当前风险',
    width: 130,
    align: 'right' as const,
    sortable: true,
    render: (record) => record.latestReleaseVersion > 0 ? renderNullableQuantity(getRecordQuantitySummary(record).risk, 'text-amber-700') : '未确认',
    sortValue: (record) => getRecordQuantitySummary(record).risk ?? -1,
  },
  {
    key: 'shortage',
    title: '补料缺口',
    width: 130,
    align: 'right',
    sortable: true,
    render: (record) => record.shortageCellCount > 0
      ? `<span class="font-semibold tabular-nums text-rose-700">${formatQuantity(record.shortageCellCount)} 个点</span>`
      : '<span class="tabular-nums text-muted-foreground">0 个点</span>',
    sortValue: (record) => record.shortageCellCount,
  },
  {
    key: 'frozenCutOrders',
    title: '冻结裁片单',
    width: 130,
    align: 'right',
    sortable: true,
    render: (record) => `<span class="font-medium tabular-nums ${record.frozenCutOrderCount > 0 ? 'text-slate-700' : ''}">${formatQuantity(record.frozenCutOrderCount)} 张</span>`,
    sortValue: (record) => record.frozenCutOrderCount,
  },
  {
    key: 'latestUpdate',
    title: '最近更新',
    width: 180,
    freezeable: true,
    sortable: true,
    render: (record) => `<span class="text-xs">${escapeHtml(formatDateTime(record.latestUpdateAt))}</span>`,
    sortValue: (record) => record.latestUpdateAt,
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    required: true,
    actionColumn: true,
    align: 'right',
    render: (record) => `
      <a
        href="${escapeHtml(`/fcs/craft/cutting/cut-piece-release?productionOrderId=${encodeURIComponent(record.productionOrderId)}&productionOrderNo=${encodeURIComponent(record.productionOrderNo)}`)}"
        target="_blank"
        rel="noopener noreferrer"
        role="button"
        class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        aria-label="打开矩阵，查看矩阵"
      >查看矩阵</a>
    `,
  },
]

interface CutPieceReleaseListView {
  filtered: CutPieceReleaseRecord[]
  paging: StandardListPageSlice<CutPieceReleaseRecord>
}

function getFilteredRecords(): CutPieceReleaseRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listCutPieceReleaseRecords().filter((record) => {
    if (state.matrixStatus !== '全部' && record.matrixStatus !== state.matrixStatus) return false
    if (state.targetStatus !== '全部' && record.targetStatus !== state.targetStatus) return false
    if (state.releaseStatusFilter !== '全部' && record.releaseAvailableStatus !== state.releaseStatusFilter) return false
    if (state.factChangeFilter === '待核对' && !record.requiresReview) return false
    if (state.factChangeFilter === '与确认时一致' && record.requiresReview) return false
    if (!keyword) return true
    const searchable = [
      record.productionOrderNo,
      record.recordNo,
      record.spuCode,
      record.spuName,
      record.sourceCutOrderNos.join(' '),
      record.matrix.colorGroups.map((group) => `${group.garmentColor} ${group.sizes.join(' ')}`).join(' '),
    ].join(' ').toLowerCase()
    return searchable.includes(keyword)
  })
}

function getListView(): CutPieceReleaseListView {
  const filtered = getFilteredRecords()
  const sorted = sortStandardListRows(filtered, state.sort, (record, key) =>
    listColumns.find((column) => column.key === key)?.sortValue?.(record),
  )
  const paging = paginateStandardListRows(sorted, state.page, state.columnPreferences.pageSize)
  state.page = paging.currentPage
  return { filtered, paging }
}

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('data-cut-piece-release-action=', 'data-skip-page-rerender="true" data-cut-piece-release-action=')
    .replaceAll('data-cut-piece-release-field=', 'data-skip-page-rerender="true" data-cut-piece-release-field=')
}

function renderFilters(): string {
  const matrixStatuses: MatrixStatusFilter[] = ['全部', '可计算', '数据不完整', '暂无有效裁片']
  const targetStatuses: TargetStatusFilter[] = ['全部', '待确认', '已确认']
  return `
    <section class="rounded-lg border bg-card p-3">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_150px_160px_160px_auto] md:items-end">
        <label class="space-y-1">
          <span class="text-xs font-medium">生产单 / SPU / 颜色尺码 / 裁片单</span>
          <input
            type="search"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value="${escapeHtml(state.keywordDraft)}"
            placeholder="输入关键词"
            data-skip-page-rerender="true"
            data-cut-piece-release-field="keywordDraft"
            data-cut-piece-release-action="field-change"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.closest('[data-standard-list-filters]').querySelector('[data-cut-piece-release-action=query]').click()}"
          >
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium">矩阵状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cut-piece-release-field="matrixStatus" data-cut-piece-release-action="field-change">
            ${matrixStatuses.map((item) => `<option value="${escapeHtml(item)}" ${state.matrixStatus === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium">目标状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cut-piece-release-field="targetStatus" data-cut-piece-release-action="field-change">
            ${targetStatuses.map((item) => `<option value="${escapeHtml(item)}" ${state.targetStatus === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs font-medium">放行状态</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cut-piece-release-field="releaseStatusFilter" data-cut-piece-release-action="field-change">
            <option value="全部" ${state.releaseStatusFilter === '全部' ? 'selected' : ''}>全部放行状态</option>
            <option value="待维护目标" ${state.releaseStatusFilter === '待维护目标' ? 'selected' : ''}>待维护目标</option>
            <option value="待裁床确认" ${state.releaseStatusFilter === '待裁床确认' ? 'selected' : ''}>待裁床确认</option>
            <option value="按齐套放行" ${state.releaseStatusFilter === '按齐套放行' ? 'selected' : ''}>按齐套放行</option>
            <option value="风险放行" ${state.releaseStatusFilter === '风险放行' ? 'selected' : ''}>风险放行</option>
            <option value="暂不放行" ${state.releaseStatusFilter === '暂不放行' ? 'selected' : ''}>暂不放行</option>
          </select>
        </label>
        <label class="space-y-1"><span class="text-xs font-medium">数量变化</span>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cut-piece-release-field="factChangeFilter">
            ${['全部', '待核对', '与确认时一致'].map(item => `<option value="${item}" ${state.factChangeFilter === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
        </label>
        <div class="flex items-center gap-2">
          <button type="button" class="h-9 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cut-piece-release-action="query">查询</button>
          <button type="button" class="h-9 whitespace-nowrap rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-release-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderFeedback(): string {
  if (!state.feedback) return ''
  const className = state.feedback.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : state.feedback.tone === 'error'
      ? 'border-red-300 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<div class="rounded-md border px-3 py-2 text-sm ${className}">${escapeHtml(state.feedback.message)}</div>`
}

function renderMigrationPanel(): string {
  const status = getCutPieceReleaseMigrationStatus()
  if (!status.required) return ''
  if (status.message.includes('无法读取')) return `<section class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>${escapeHtml(status.message)}</p><button type="button" class="mt-2 rounded border bg-white px-3 py-1.5" data-skip-page-rerender="true" data-cut-piece-release-action="reread-migration">重新读取</button></section>`
  return `<section class="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm" data-testid="release-legacy-migration"><h2 class="font-semibold">原放行资料需要转换</h2><p>${escapeHtml(status.message)}</p><p class="text-xs text-slate-600">核验通过后清理原资料。原目标和放行量保留。</p><label class="flex items-center gap-2"><input type="checkbox" data-skip-page-rerender="true" data-cut-piece-release-field="migrationOtherPagesClosed" ${state.migrationOtherPagesClosed ? 'checked' : ''} ${state.saving ? 'disabled' : ''}>已关闭其他旧版 HiGood 页面</label><button type="button" class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" data-skip-page-rerender="true" data-cut-piece-release-action="migrate-release" ${!state.migrationOtherPagesClosed || state.saving ? 'disabled' : ''}>${state.saving ? '正在转换…' : '转换并核验'}</button>${state.migrationMessage && state.migrationMessage !== state.feedback?.message ? `<p class="text-xs text-slate-700" role="status">${escapeHtml(state.migrationMessage)}</p>` : ''}</section>`
}

function renderListStats(records: CutPieceReleaseRecord[]): string {
  return renderStandardListStats([
    { label: '生产单', value: `${records.length} 张` },
    { label: '矩阵可计算', value: `${records.filter((record) => record.matrixStatus === '可计算').length} 张` },
    { label: '目标待确认', value: `${records.filter((record) => record.targetStatus !== '已确认').length} 张` },
    { label: '存在补料缺口', value: `${records.filter((record) => record.shortageCellCount > 0).length} 张` },
    { label: '可放行', value: `${records.filter((r) => r.releaseAvailableStatus === '按齐套放行' || r.releaseAvailableStatus === '风险放行').length} 张` },
    { label: '风险放行', value: `${records.filter((r) => r.releaseAvailableStatus === '风险放行').length} 张` },
  ])
}

export function renderListTable(paging: StandardListPageSlice<CutPieceReleaseRecord>): string {
  return withSkipPageRerender(renderStandardListTable({
    columns: listColumns,
    rows: paging.rows,
    preferences: state.columnPreferences,
    sort: state.sort,
    eventPrefix: 'cut-piece-release',
    emptyText: '当前筛选范围暂无裁片放行生产单。',
  }))
}

function renderListPagination(paging: StandardListPageSlice<CutPieceReleaseRecord>): string {
  return withSkipPageRerender(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'cut-piece-release',
    fieldPrefix: 'cut-piece-release',
    pageSizeOptions: listPageSizes,
  }))
}

function releaseTargetKey(garmentColor: string, size: string): string {
  return `${garmentColor}::${size}`
}

function getActiveRecord(): CutPieceReleaseRecord | null {
  return state.activeRecordId ? getCutPieceReleaseRecord(state.activeRecordId) : null
}

function getTargetDifferences(record: CutPieceReleaseRecord): ReleaseTargetDifference[] {
  return record.matrix.colorGroups.flatMap(group => group.materialRows.flatMap(row => row.cells.flatMap(cell => {
    const targetQty = state.targetDraft[releaseTargetKey(group.garmentColor, cell.size)]
    if (targetQty === undefined || cell.physicalGarmentQty === null) return []
    const differenceQty = cell.physicalGarmentQty - targetQty
    return [{ garmentColor: group.garmentColor, size: cell.size, materialId: row.materialId, materialName: row.materialName,
      targetQty, availableGarmentQty: cell.physicalGarmentQty, differenceQty, status: differenceQty < 0 ? '需补' as const : differenceQty > 0 ? '多余' as const : '刚好' as const }]
  })))
}

function displayMaterialName(materialId: string, materialName: string): string {
  const seededNames: Record<string, string> = {
    A: '面料 A · 净色',
    B: '面料 B · 白色条',
    C: '面料 C · 兰色条',
    D: '面料 D · 灰色条',
  }
  return seededNames[materialId] ?? materialName
}

function renderDifference(difference: ReleaseTargetDifference | undefined): { className: string; text: string } {
  if (!difference) return { className: '', text: '' }
  if (difference.status === '需补') {
    return { className: 'text-rose-600', text: `需补 ${formatQuantity(Math.abs(difference.differenceQty))} 件` }
  }
  if (difference.status === '刚好') {
    return { className: 'border-2 border-yellow-400 bg-yellow-100 text-yellow-900', text: '刚好' }
  }
  return { className: 'text-emerald-600', text: `多 ${formatQuantity(difference.differenceQty)} 件` }
}

function renderTargetCandidates(group: ReleaseColorGroup, size: string): string {
  if (state.targetMode !== '编辑' || state.targetCandidateKey !== releaseTargetKey(group.garmentColor, size)) return ''
  const selected = state.targetDraft[releaseTargetKey(group.garmentColor, size)]
  return `<div class="mt-2 space-y-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-left" aria-label="${escapeHtml(`${group.garmentColor} ${size} 目标候选`)}">
    <p class="text-[11px] text-slate-600">选择实物支持量</p>
    ${group.materialRows.map(row => {
      const cell = row.cells.find(item => item.size === size)
      if (!cell || cell.physicalGarmentQty === null) return `<p class="text-xs text-amber-700">${escapeHtml(row.materialName)}：实物支持待核对</p>`
      const quantity = cell.physicalGarmentQty
      return `<div class="flex items-start gap-2 rounded border bg-white p-2">
        ${renderBusinessImage(row.materialImageUrl, row.materialName, `candidate-image-${group.garmentColor}-${size}-${row.materialId}`, 'h-9 w-9')}
        <button type="button" class="min-w-0 flex-1 text-left text-xs focus-visible:ring-2 focus-visible:ring-blue-500 ${selected === quantity ? 'font-semibold text-blue-700' : ''}"
          data-skip-page-rerender="true" data-cut-piece-release-action="select-target" data-target-candidate-color="${escapeHtml(group.garmentColor)}" data-target-candidate-size="${escapeHtml(size)}" data-target-candidate-quantity="${quantity}"
          data-testid="candidate-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}-${escapeHtml(row.materialId)}" aria-pressed="${selected === quantity}">
          <span class="block">${escapeHtml(displayMaterialName(row.materialId, row.materialName))}</span>${replacementFabricMaterialDisplayCode(row.materialId) ? `<span class="block text-[10px] text-muted-foreground">${escapeHtml(replacementFabricMaterialDisplayCode(row.materialId))}</span>` : ''}
          <span class="mt-1 block">实物支持 ${formatQuantity(quantity)} 件${selected === quantity ? ' · 已选' : ''}</span><span class="block font-normal text-slate-600">最终齐套 ${cell.availableGarmentQty === null ? '待核对' : `${formatQuantity(cell.availableGarmentQty)} 件`}</span>
        </button>
      </div>`
    }).join('')}
  </div>`
}

function renderMatrixCell(
  record: CutPieceReleaseRecord,
  group: ReleaseColorGroup,
  materialId: string,
  size: string,
  cell: ReleaseMatrixCell,
  difference: ReleaseTargetDifference | undefined,
): string {
  const visual = renderDifference(difference)
  const quantity = cell.availableGarmentQty === null ? '待核对' : `${formatQuantity(cell.availableGarmentQty)} 件`
  return `
    <td class="border-b border-r p-2 text-center align-middle">
      <button
        type="button"
        class="mx-auto min-h-[108px] w-full min-w-[140px] rounded-md px-2 py-1.5 text-sm tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${visual.className}"
        data-skip-page-rerender="true"
        data-cut-piece-release-action="open-cell"
        data-record-id="${escapeHtml(record.recordId)}"
        data-cell-color="${escapeHtml(group.garmentColor)}"
        data-cell-size="${escapeHtml(size)}"
        data-cell-material-id="${escapeHtml(materialId)}"
        data-testid="cell-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}-${escapeHtml(materialId)}"
        aria-label="${escapeHtml(`${group.garmentColor} ${size} ${group.materialRows.find(row => row.materialId === materialId)?.materialName || replacementFabricMaterialDisplayCode(materialId) || '材料'}，${quantity}，查看部位计算`)}"
      >
        <span class="block font-semibold">最终可齐套 ${escapeHtml(quantity)}</span><span class="mt-1 block text-xs font-normal text-slate-600">实物支持 ${cell.physicalGarmentQty === null ? '待核对' : `${formatQuantity(cell.physicalGarmentQty)} 件`}</span>${renderCraftSummary([cell])}
        ${visual.text ? `<span class="mt-0.5 block text-xs font-semibold">${escapeHtml(visual.text)}</span>` : ''}
      </button>
    </td>
  `
}

function renderColorMatrix(record: CutPieceReleaseRecord, group: ReleaseColorGroup): string {
  const differences = getTargetDifferences(record)
  const differenceByCell = new Map(differences.map((item) => [
    `${item.garmentColor}::${item.size}::${item.materialId}`,
    item,
  ]))
  return `
    <section class="space-y-3" data-testid="cut-piece-release-color-matrix">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-base font-semibold">${escapeHtml(group.garmentColor)}</h3>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">${group.materialRows.length} 种必需物料</span>
      </div>
      <div class="max-w-full overflow-x-auto rounded-lg border" data-cut-piece-release-matrix-scroll>
        <table class="min-w-[1120px] w-full border-collapse text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="w-[260px] border-b border-r px-3 py-2 text-left">物料</th>
              ${group.sizes.map((size) => `<th class="border-b border-r px-3 py-2 text-center">${escapeHtml(size)}</th>`).join('')}
              <th class="w-[190px] border-b px-3 py-2 text-left">来源状态</th>
            </tr>
          </thead>
          <tbody>
            <tr class="bg-sky-50">
              <th class="border-b border-r px-3 py-2 text-left font-medium">计划数量</th>
              ${group.sizes.map((size) => `<td class="border-b border-r px-3 py-2 text-center font-semibold tabular-nums">${formatQuantity(group.planQtyBySize[size] ?? 0)} 件</td>`).join('')}
              <td class="border-b px-3 py-2 text-xs text-slate-600">生产单计划</td>
            </tr>
            ${group.materialRows.map((row) => {
              const frozen = row.cells.length > 0 && row.cells.every((cell) => cell.sourceStatus === '已冻结')
              const sourceState = frozen ? record.sourceStates.find((item) => item.status === '已冻结' && item.materialIds.includes(row.materialId)) : null
              return `
                <tr>
                  <th class="border-b border-r px-3 py-3 text-left font-medium"><div class="flex items-center gap-2">${renderBusinessImage(row.materialImageUrl, row.materialName, `material-image-${group.garmentColor}-${row.materialId}`)}<div>${escapeHtml(displayMaterialName(row.materialId, row.materialName))}${replacementFabricMaterialDisplayCode(row.materialId) ? `<small class="mt-1 block font-normal text-muted-foreground">${escapeHtml(replacementFabricMaterialDisplayCode(row.materialId))}</small>` : ''}</div></div></th>
                  ${group.sizes.map((size) => {
                    const cell = row.cells.find((item) => item.size === size)!
                    return renderMatrixCell(record, group, row.materialId, size, cell, differenceByCell.get(`${group.garmentColor}::${size}::${row.materialId}`))
                  }).join('')}
                  <td class="border-b px-3 py-2 text-xs ${frozen ? 'bg-slate-100 font-medium text-slate-700' : 'text-emerald-700'}">
                    <span class="block">${frozen ? '裁剪数量已冻结，仓库数量继续更新' : '持续更新'}</span>
                    ${sourceState?.reason ? `<span class="mt-1 block font-normal text-slate-600">${escapeHtml(sourceState.reason)}</span>` : ''}
                    ${sourceState ? `<span class="mt-1 block font-normal text-slate-500">${escapeHtml(sourceState.cutOrderNo)} · ${escapeHtml(formatDateTime(sourceState.changedAt))}</span>` : ''}
                  </td>
                </tr>
              `
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 font-bold">
              <th class="border-r px-3 py-3 text-left">当前齐套数量</th>
              ${group.sizes.map((size) => `<td class="border-r px-3 py-3 text-center text-base tabular-nums" data-testid="complete-kit-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}">${group.completeKitBySize[size] === null ? '待核对' : `${formatQuantity(group.completeKitBySize[size]!)} 件`}</td>`).join('')}
              <td class="px-3 py-3 text-xs font-medium">按有效裁片齐套</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  `
}

function initializeTargetDraft(record: CutPieceReleaseRecord): void {
  state.targetDraft = Object.fromEntries(record.matrix.colorGroups.flatMap(group => group.sizes.flatMap(size => {
    const quantities = group.materialRows.map(row => row.cells.find(cell => cell.size === size)?.physicalGarmentQty).filter((qty): qty is number => typeof qty === 'number')
    const quantity = state.savedTargetSnapshot?.colorSizeTargets[releaseTargetKey(group.garmentColor, size)] ?? (quantities.length ? Math.min(...quantities) : undefined)
    return quantity === undefined ? [] : [[releaseTargetKey(group.garmentColor, size), quantity]]
  })))
}

function areTargetSelectionsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left)
  return leftEntries.length === Object.keys(right).length
    && leftEntries.every(([key, value]) => right[key] === value)
}

function canUseSavedTargetSnapshot(record: CutPieceReleaseRecord): boolean {
  const saved = state.savedTargetSnapshot
  if (!saved || !getTargetDifferences(record).some(item => item.status === '需补') || state.targetMode !== '确认') return false
  if (state.targetBasisVersion !== saved.matrixVersion) return false
  if (!areTargetSelectionsEqual(state.targetDraft, saved.colorSizeTargets)) return false
  return record.targetStatus === '已确认'
}

// TARGET-001, PAGE-001: garment color rows and the same ascending size columns as release.
export function renderCutPieceReleaseTargetMatrix(record: CutPieceReleaseRecord): string {
  const sizes = getMatrixSizeColumns(record)
  const differences = getTargetDifferences(record)
  const savedTargetUnchanged = Boolean(state.savedTargetSnapshot
    && state.targetBasisVersion === state.savedTargetSnapshot.matrixVersion
    && areTargetSelectionsEqual(state.targetDraft, state.savedTargetSnapshot.colorSizeTargets))
  const counts = { shortage: differences.filter(item => item.status === '需补').length, exact: differences.filter(item => item.status === '刚好').length, surplus: differences.filter(item => item.status === '多余').length }
  const snapshots = listCutPieceReleaseTargetSnapshots(record.productionOrderId)
  const saved = snapshots.at(-1)
  return `<section class="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="cut-piece-release-target-summary">
    <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">${state.targetMode === '编辑' ? '选择目标' : savedTargetUnchanged ? '已确认目标' : '确认目标'}</h3><span class="text-xs text-slate-600">成衣颜色 × 尺码 · 单位：件</span></div>
    ${renderReleaseSizeOrderNotice(sizes)}
    ${state.targetMode === '查看' ? '<p class="mt-2 text-sm text-muted-foreground">请先选择目标。</p>' : ''}
    <div class="relative mt-3 overflow-x-auto rounded-lg border" data-cut-piece-release-target-matrix-scroll><table class="w-full min-w-[650px] table-fixed border-collapse text-sm" data-testid="cut-piece-release-target-matrix">
      <thead class="bg-blue-100/60"><tr><th scope="col" class="sticky left-0 z-10 w-[130px] border-b border-r bg-blue-50 px-3 py-3 text-left">成衣颜色 / 尺码</th>${sizes.map(size => `<th scope="col" class="w-[210px] border-b border-r px-3 py-3">${escapeHtml(size)}</th>`).join('')}</tr></thead>
      <tbody>${record.matrix.colorGroups.map(group => `<tr><th scope="row" class="sticky left-0 z-10 border-b border-r bg-blue-50 px-3 py-3 text-left">${escapeHtml(group.garmentColor)}</th>${sizes.map(size => {
        if (!group.sizes.includes(size)) return '<td class="border-b border-r p-3 text-center text-muted-foreground">—<small class="block">无此色码</small></td>'
        const key = releaseTargetKey(group.garmentColor, size)
        const target = state.targetDraft[key]
        const kit = group.completeKitBySize[size]
        return `<td class="border-b border-r bg-white p-3 text-center align-top" data-target-color="${escapeHtml(group.garmentColor)}" data-target-size="${escapeHtml(size)}">
          ${state.targetMode === '编辑' ? `<button type="button" class="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500" data-skip-page-rerender="true" data-cut-piece-release-action="open-target-candidates" data-cell-color="${escapeHtml(group.garmentColor)}" data-cell-size="${escapeHtml(size)}" aria-expanded="${state.targetCandidateKey === key}" data-testid="target-choose-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}">${target === undefined ? '选择依据' : `${formatQuantity(target)} 件 · 选择依据`}</button>` : `<strong class="block tabular-nums">${target === undefined ? '未确认' : `${formatQuantity(target)} 件`}</strong>`}
          <small class="mt-1 block text-slate-600">当前齐套 ${kit === null ? '待核对' : `${formatQuantity(kit)} 件`}${target !== undefined && kit !== null && target > kit ? ` · 距目标缺 ${formatQuantity(target - kit)} 件` : ''}</small>
          ${renderCraftSummary(getColorSizeCells(group, size))}${renderColorSizeDetailButton(record, group, size, 'target')}${renderTargetCandidates(group, size)}
        </td>`
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="mt-3 flex flex-wrap gap-3 text-sm"><span class="text-rose-600">实物需补 ${counts.shortage} 个物料点</span><span class="text-yellow-800">刚好 ${counts.exact} 个物料点</span><span class="text-emerald-600">多余 ${counts.surplus} 个物料点</span><span class="text-slate-700">目标依据 V${state.targetBasisVersion ?? 0}</span>${savedTargetUnchanged && saved ? `<span class="text-xs text-slate-600">${escapeHtml(saved.confirmedBy)} · ${escapeHtml(formatDateTime(saved.confirmedAt))}</span>` : ''}</div>
    <div class="mt-4 flex flex-wrap justify-end gap-2">
      ${state.targetMode === '查看' ? '<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-skip-page-rerender="true" data-cut-piece-release-action="start-target">选择目标</button>' : state.targetMode === '编辑' ? `<button type="button" class="rounded-md border bg-white px-4 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="cancel-target">取消修改</button><button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-skip-page-rerender="true" data-cut-piece-release-action="confirm-target">核对目标</button>` : savedTargetUnchanged ? '<button type="button" class="rounded-md border bg-white px-4 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="start-target">重新选择目标</button><span class="rounded-md bg-emerald-100 px-4 py-2 text-sm text-emerald-800">目标已保存</span>' : `<button type="button" class="rounded-md border bg-white px-4 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="back-target-edit">返回修改</button><button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50" ${state.saving ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="save-target">${state.saving ? '正在保存…' : '保存目标'}</button>`}
      ${canUseSavedTargetSnapshot(record) ? '<button type="button" class="rounded-md bg-amber-600 px-4 py-2 text-sm text-white" data-skip-page-rerender="true" data-cut-piece-release-action="go-supplement">去补料管理</button>' : ''}
    </div>
  </section>`
}

// PAGE-002, RELEASE-005: confirmation values and live facts remain independent.
export function renderCutPieceReleaseConfirmMatrix(recordOverride?: CutPieceReleaseRecord): string {
  const record = recordOverride ?? getActiveRecord()
  if (!record) return ''
  const versions = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId)
  const latestVersion = versions.find(version => version.isLatestEffective) ?? null
  const targetValues = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1)?.targetPreview.colorSizeTargets ?? null
  const readiness = getAllocationReadiness(record)
  const sizes = getMatrixSizeColumns(record)
  const editing = state.releaseEditing || !latestVersion
  const hasTarget = record.targetStatus === '已确认' && targetValues !== null
  let totalKit: number | null = 0
  let totalRisk: number | null = 0
  let totalTargetGap: number | null = 0
  record.matrix.colorGroups.forEach(group => group.sizes.forEach(size => {
    const key = releaseTargetKey(group.garmentColor, size)
    const kit = group.completeKitBySize[size]
    const release = latestVersion?.releaseQtyByColorSize[key]
    if (kit === null) { totalKit = null; totalRisk = null; totalTargetGap = null; return }
    if (totalKit !== null) totalKit += kit
    if (totalRisk !== null) totalRisk += release === undefined ? 0 : Math.max(release - kit, 0)
    if (totalTargetGap !== null) totalTargetGap += Math.max((targetValues?.[key] ?? 0) - kit, 0)
  }))
  return `<section class="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4" data-cut-piece-release-release-confirm-panel>
    <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">裁片放行确认</h3><span class="text-xs text-slate-600">成衣颜色 × 尺码 · 单位：件</span></div>
    ${renderReleaseSizeOrderNotice(sizes)}
    <p class="mt-1 text-xs text-muted-foreground">放行量不得低于已分配量或高于目标。</p>
    ${latestVersion ? `<div class="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm"><strong>当前生效版本 V${latestVersion.releaseVersionNo}</strong><span class="ml-2 text-emerald-700">${escapeHtml(latestVersion.releaseStatus)}</span><span class="ml-2 text-xs text-slate-600">${escapeHtml(latestVersion.confirmedBy)} · ${escapeHtml(formatDateTime(latestVersion.confirmedAt))}</span><div class="mt-1 text-xs">确认时风险 ${formatQuantity(latestVersion.totalRiskReleaseQty)} 件 · 当前风险 ${totalRisk === null ? '待核对' : `${formatQuantity(totalRisk)} 件`}</div>${latestVersion.riskReason ? `<div class="mt-1 text-xs text-slate-600">当时原因：${escapeHtml(latestVersion.riskReason)}</div>` : ''}</div>` : '<p class="mt-3 text-sm text-blue-700">尚未确认放行。</p>'}
    ${record.requiresReview ? `<div class="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="release-fact-review">${escapeHtml(record.factChangeMessage || '数量已变化，请核对放行')}。原目标、放行量和已分配量不变。</div>` : ''}
    ${!hasTarget ? '<p class="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">先保存目标，再确认放行。</p>' : ''}
    <div class="relative mt-3 overflow-x-auto rounded-lg border"><table class="w-full min-w-[650px] table-fixed border-collapse text-sm" data-testid="cut-piece-release-confirm-matrix">
      <thead class="bg-emerald-100/50"><tr><th scope="col" class="sticky left-0 z-10 w-[130px] border-b border-r bg-emerald-50 px-3 py-3 text-left">成衣颜色 / 尺码</th>${sizes.map(size => `<th scope="col" class="w-[210px] border-b border-r px-3 py-3">${escapeHtml(size)}</th>`).join('')}</tr></thead>
      <tbody>${record.matrix.colorGroups.map(group => `<tr><th scope="row" class="sticky left-0 z-10 border-b border-r bg-emerald-50 px-3 py-3 text-left">${escapeHtml(group.garmentColor)}</th>${sizes.map(size => {
        if (!group.sizes.includes(size)) return '<td class="border-b border-r p-3 text-center text-muted-foreground">—<small class="block">无此色码</small></td>'
        const key = releaseTargetKey(group.garmentColor, size)
        const target = targetValues?.[key]
        const kit = group.completeKitBySize[size]
        const savedRelease = latestVersion?.releaseQtyByColorSize[key]
        const inputValue = state.releaseDraft[key] ?? (savedRelease !== undefined ? String(savedRelease) : target !== undefined && kit !== null ? String(Math.min(target, kit)) : '')
        const allocated = readiness.lines.find(line => line.color === group.garmentColor && line.size === size)?.allocatedQty ?? 0
        const remaining = savedRelease === undefined ? null : Math.max(savedRelease - allocated, 0)
        const currentRisk = kit === null || savedRelease === undefined ? null : Math.max(savedRelease - kit, 0)
        const invalid = inputValue !== '' && parseReleaseQuantityInput(inputValue) === null
        return `<td class="border-b border-r bg-white p-3 text-center align-top" data-release-cell-color="${escapeHtml(group.garmentColor)}" data-release-cell-size="${escapeHtml(size)}">
          <label class="flex items-center justify-center gap-1"><span class="sr-only">${escapeHtml(group.garmentColor)} ${escapeHtml(size)}放行数量，已分配下限${allocated}件，目标上限${target ?? '未确认'}件</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" class="h-9 w-24 rounded border px-2 text-right font-semibold tabular-nums disabled:bg-slate-50 ${invalid ? 'border-red-500' : ''}" value="${escapeHtml(inputValue)}" ${!editing || !hasTarget || state.saving ? 'disabled' : ''}
              data-min="${allocated}" data-max="${target ?? 0}" data-skip-page-rerender="true" data-cut-piece-release-field="releaseQtyInput" data-release-color="${escapeHtml(group.garmentColor)}" data-release-size="${escapeHtml(size)}" aria-label="${escapeHtml(`${group.garmentColor} ${size} 放行数量`)}" aria-invalid="${invalid}" data-testid="release-input-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}"><span class="text-xs">件</span>
          </label>
          <div class="mt-2 space-y-0.5 text-[11px] text-slate-600"><div>目标 ${target === undefined ? '未确认' : `${formatQuantity(target)} 件`} · 齐套 ${kit === null ? '待核对' : `${formatQuantity(kit)} 件`}</div><div>已分配 ${formatQuantity(allocated)} 件 · 可新增分配 ${remaining === null ? '未确认' : `${formatQuantity(remaining)} 件`}</div><div class="${currentRisk && currentRisk > 0 ? 'text-amber-700' : ''}">当前风险 ${currentRisk === null ? savedRelease === undefined ? '未确认' : '待核对' : `${formatQuantity(currentRisk)} 件`} · 确认时风险 ${savedRelease === undefined ? '未确认' : `${formatQuantity(latestVersion?.riskReleaseQtyByColorSize[key] ?? 0)} 件`}</div></div>
          <span class="mt-1 block text-xs text-red-600" data-release-input-error="${escapeHtml(key)}">${invalid ? '数量无效，请输入非负整数' : ''}</span>
          ${renderCraftSummary(getColorSizeCells(group, size))}${renderColorSizeDetailButton(record, group, size, 'release')}
        </td>`
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div data-cut-piece-release-confirm-summary-region>${renderReleaseConfirmSummary(totalKit, totalRisk, totalTargetGap)}</div>
    <div data-cut-piece-release-risk-reason-region>${editing || record.requiresReview ? renderReleaseRiskReasonInput(totalRisk ?? 0) : ''}</div>
    <div class="mt-4 flex flex-wrap gap-2">
      ${editing ? `<button type="button" class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" ${!hasTarget || state.saving ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="confirm-release">${state.saving ? '正在保存…' : '确认放行'}</button>${latestVersion ? '<button type="button" class="rounded-md border px-4 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="cancel-release-edit">取消调整</button>' : ''}` : `<button type="button" class="rounded-md border px-4 py-2 text-sm disabled:opacity-50" ${state.saving ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="adjust-release">调整放行</button>${record.requiresReview ? `<button type="button" class="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50" ${state.saving ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="maintain-release">${state.saving ? '正在保存…' : '核对后维持放行'}</button>` : ''}`}
      <button type="button" class="rounded-md border px-4 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="open-release-version-log">${state.releaseVersionLogOpen ? '收起版本日志' : '查看版本日志'}（${versions.length}）</button>
      <a href="/fcs/craft/cutting/supplement-management?productionOrderId=${encodeURIComponent(record.productionOrderId)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-md border px-4 py-2 text-sm">查看补料依据</a>
    </div>
  </section>`
}

function renderReleaseRiskReasonInput(riskReleaseQty: number): string {
  if (riskReleaseQty <= 0 && !state.riskReasonDraft) return ''
  return `<label class="mt-3 block space-y-1"><span class="text-sm font-medium">本次风险原因${riskReleaseQty > 0 ? '（必填）' : ''}</span><input type="text" class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="填写未齐套原因" value="${escapeHtml(state.riskReasonDraft)}" data-skip-page-rerender="true" data-cut-piece-release-field="riskReason" ${state.saving ? 'disabled' : ''}></label>`
}

function renderReleaseConfirmSummary(totalCompleteKitQty: number | null, riskReleaseQty: number | null, targetKitGap: number | null, draft = false): string {
  return `<div class="mt-3 flex flex-wrap gap-4 text-sm"><span class="font-medium">当前齐套：${renderNullableQuantity(totalCompleteKitQty)}</span><span class="font-medium">${draft ? '本次输入风险' : '当前风险'}：${renderNullableQuantity(riskReleaseQty, riskReleaseQty ? 'text-amber-700' : '')}</span><span class="font-medium">距目标齐套缺口：${renderNullableQuantity(targetKitGap, targetKitGap ? 'text-rose-700' : '')}</span></div>`
}

function calculateReleaseConfirmDraftTotals(): { totalCompleteKitQty: number | null; totalTargetQty: number; totalReleaseQty: number; totalRiskReleaseQty: number | null; releaseGapToTarget: number | null } | null {
  const record = getActiveRecord()
  if (!record) return null
  let totalCompleteKitQty: number | null = 0
  let totalTargetQty = 0
  let totalReleaseQty = 0
  let totalRiskReleaseQty: number | null = 0
  let releaseGapToTarget: number | null = 0
  document.querySelectorAll<HTMLInputElement>('[data-cut-piece-release-field="releaseQtyInput"]').forEach(node => {
    const color = node.dataset.releaseColor || ''
    const size = node.dataset.releaseSize || ''
    const targetQty = Number(node.dataset.max || 0)
    const kit = record.matrix.colorGroups.find(group => group.garmentColor === color)?.completeKitBySize[size] ?? null
    const releaseQty = parseReleaseQuantityInput(node.value)
    totalTargetQty += targetQty
    if (kit === null) { totalCompleteKitQty = null; totalRiskReleaseQty = null; releaseGapToTarget = null }
    else {
      if (totalCompleteKitQty !== null) totalCompleteKitQty += kit
      if (releaseGapToTarget !== null) releaseGapToTarget += Math.max(targetQty - kit, 0)
      if (totalRiskReleaseQty !== null && releaseQty !== null) totalRiskReleaseQty += Math.max(releaseQty - kit, 0)
    }
    if (releaseQty === null) totalRiskReleaseQty = null
    else totalReleaseQty += releaseQty
  })
  return { totalCompleteKitQty, totalTargetQty, totalReleaseQty, totalRiskReleaseQty, releaseGapToTarget }
}

function refreshReleaseRiskReasonInput(): void {
  if (typeof document === 'undefined') return
  const totals = calculateReleaseConfirmDraftTotals()
  if (!totals) return
  const summaryRegion = document.querySelector<HTMLElement>('[data-cut-piece-release-confirm-summary-region]')
  if (summaryRegion) summaryRegion.innerHTML = renderReleaseConfirmSummary(totals.totalCompleteKitQty, totals.totalRiskReleaseQty, totals.releaseGapToTarget, true)
  const riskRegion = document.querySelector<HTMLElement>('[data-cut-piece-release-risk-reason-region]')
  if (!riskRegion) return
  const existingInput = riskRegion.querySelector<HTMLInputElement>('[data-cut-piece-release-field="riskReason"]')
  if (existingInput) state.riskReasonDraft = existingInput.value
  const riskQty = totals.totalRiskReleaseQty ?? 0
  const nextHtml = renderReleaseRiskReasonInput(riskQty)
  // Quantity blur can happen as the user focuses the reason. Keep that input node
  // so a change event cannot discard its focus, selection or freshly typed text.
  if (existingInput && nextHtml) {
    const caption = riskRegion.querySelector('label > span')
    if (caption) caption.textContent = `本次风险原因${riskQty > 0 ? '（必填）' : ''}`
    existingInput.disabled = state.saving
  } else riskRegion.innerHTML = nextHtml
}

function renderReleaseVersionLogPanel(): string {
  if (!state.releaseVersionLogOpen) return ''
  const record = getActiveRecord()
  if (!record) return ''
  const versions = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId)
  if (versions.length === 0) {
    return `
      <section class="rounded-lg border bg-card p-4" data-cut-piece-release-version-log-panel>
        <h3 class="font-semibold">放行确认版本日志</h3>
        <p class="mt-2 text-sm text-muted-foreground">暂无放行确认版本。</p>
      </section>
    `
  }
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(versions.length / pageSize))
  state.releaseVersionLogPage = Math.min(Math.max(1, state.releaseVersionLogPage), totalPages)
  const rows = versions.slice().reverse().slice(
    (state.releaseVersionLogPage - 1) * pageSize,
    state.releaseVersionLogPage * pageSize,
  )

  return `
    <section class="rounded-lg border bg-card p-4" data-cut-piece-release-version-log-panel>
      <h3 class="font-semibold">放行确认版本日志</h3>
      <div class="mt-3 space-y-3">
        ${rows.map((v) => {
          const changedLinesHtml = v.changedColorSizeLines.length > 0
            ? `<div class="mt-1 text-xs text-muted-foreground">变化颜色尺码：${escapeHtml(v.changedColorSizeLines.join('、'))}</div>`
            : ''
          return `
            <article class="rounded-lg border p-3 ${v.isLatestEffective ? 'border-emerald-300 bg-emerald-50/50' : ''}">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-semibold">V${v.releaseVersionNo} · ${escapeHtml(v.releaseStatus)}</span>
                <span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(v.confirmedAt))}</span>
                ${v.isLatestEffective ? '<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">当前生效</span>' : ''}
              </div>
              <div class="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                <span>确认时齐套：<strong>${formatQuantity(v.totalCompleteKitQty)} 件</strong></span>
                <span>确认放行：<strong>${formatQuantity(v.totalReleaseConfirmQty)} 件</strong>（前 ${v.beforeTotalReleaseConfirmQty} → 后 ${v.afterTotalReleaseConfirmQty}）</span>
                <span>确认时风险：<strong class="${v.totalRiskReleaseQty > 0 ? 'text-amber-700' : ''}">${formatQuantity(v.totalRiskReleaseQty)} 件</strong>（前 ${v.beforeTotalRiskReleaseQty} → 后 ${v.afterTotalRiskReleaseQty}）</span>
                <span>放行距目标缺口：<strong class="${v.totalReleaseGapToTargetQty > 0 ? 'text-rose-700' : ''}">${formatQuantity(v.totalReleaseGapToTargetQty)} 件</strong></span>
                <span>目标总数：<strong>${formatQuantity(v.totalTargetQty)} 件</strong></span>
                <span>数量依据版本：V${v.basisMatrixVersion}</span>
              </div>
              <details class="mt-3 border-t pt-2 text-xs"><summary class="cursor-pointer text-blue-700">查看确认时数量与依据</summary><div class="mt-2 overflow-x-auto"><table class="w-full text-xs"><thead><tr><th class="p-1 text-left">颜色 / 尺码</th><th>目标</th><th>齐套</th><th>放行</th><th>已分配</th><th>风险</th></tr></thead><tbody>${Object.entries(v.releaseQtyByColorSize).map(([key, qty]) => `<tr class="border-t"><th class="p-1 text-left font-normal">${escapeHtml(key.replace('::', ' / '))}</th><td class="text-center">${v.targetQtyByColorSize?.[key] === undefined ? '历史未记录' : `${formatQuantity(v.targetQtyByColorSize[key])} 件`}</td><td class="text-center">${v.completeKitQtyByColorSize?.[key] === undefined ? '历史未记录' : v.completeKitQtyByColorSize[key] === null ? '当时待核对' : `${formatQuantity(v.completeKitQtyByColorSize[key])} 件`}</td><td class="text-center">${formatQuantity(qty)} 件</td><td class="text-center">${v.allocatedQtyByColorSize?.[key] === undefined ? '历史未记录' : `${formatQuantity(v.allocatedQtyByColorSize[key])} 件`}</td><td class="text-center">${formatQuantity(v.riskReleaseQtyByColorSize[key] ?? 0)} 件</td></tr>`).join('')}</tbody></table></div><p class="mt-2 break-all text-muted-foreground">来源记录：${escapeHtml(v.sourceFactIds?.join('、') || '历史未记录')}</p></details>
              ${v.riskReason ? `<div class="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">风险原因：${escapeHtml(v.riskReason)}</div>` : ''}
              <div class="mt-1 text-xs text-muted-foreground">确认人：${escapeHtml(v.confirmedBy)}</div>
              ${changedLinesHtml}
            </article>
          `
        }).join('')}
      </div>
      <footer class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span>第 ${state.releaseVersionLogPage} / ${totalPages} 页 · 共 ${versions.length} 条</span>
        <div class="flex gap-2">
          <button type="button" class="rounded border px-3 py-1.5 disabled:opacity-40" ${state.releaseVersionLogPage <= 1 ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="release-version-log-prev">上一页</button>
          <button type="button" class="rounded border px-3 py-1.5 disabled:opacity-40" ${state.releaseVersionLogPage >= totalPages ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="release-version-log-next">下一页</button>
        </div>
      </footer>
    </section>
  `
}

function renderMatrixPanel(): string {
  const record = getActiveRecord()
  if (!record) return ''
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4" data-cut-piece-release-matrix-panel>
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-center gap-3">${renderBusinessImage(record.styleImageUrl, `${record.spuName}（${record.spuCode}）款式图`, 'release-style-image', 'h-16 w-16')}<div>
          <h2 class="text-lg font-semibold">${escapeHtml(record.productionOrderNo)} 裁片放行矩阵</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuCode)} · ${escapeHtml(record.spuName)} · 当前版本 V${state.currentMatrixVersion ?? 0}</p>
        </div></div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-release-action="open-history" data-testid="cut-piece-release-open-history">查看更新历史</button>
          ${state.targetMode === '查看'
            ? `<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-cut-piece-release-action="start-target">${record.targetStatus === '目标后数据已变化' ? '重新确认目标' : '选择目标'}</button>`
            : state.targetMode === '编辑'
              ? '<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-cut-piece-release-action="confirm-target">确认目标</button>'
              : ''}
        </div>
      </header>
      ${record.lateEventCount > 0 ? `<button type="button" class="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-800 hover:bg-amber-100" data-skip-page-rerender="true" data-cut-piece-release-action="open-history" data-testid="cut-piece-release-late-events-alert">关闭后收到 ${record.lateEventCount} 条待处理铺布数据</button>` : ''}
      <p class="text-xs text-muted-foreground">齐套按有效装袋量计算。特殊工艺需全部完成，并以最终回仓实收为准。</p>
      ${record.matrix.colorGroups.map((group) => renderColorMatrix(record, { ...group, sizes: sortReleaseSizeColumns(group.sizes) })).join('')}
      ${renderCutPieceReleaseTargetMatrix(record)}
      ${renderCutPieceReleaseConfirmMatrix(record)}
      ${renderReleaseVersionLogPanel()}
    </section>
  `
}

function renderMatrixDetailHeader(record: CutPieceReleaseRecord): string {
  const backHref = '/fcs/craft/cutting/cut-piece-release'
  return `
    <header data-cut-piece-release-detail-header>
      <a href="${backHref}" data-nav="${backHref}" class="text-sm text-blue-700 hover:underline">返回裁片放行管理</a>
      <h1 class="mt-2 text-xl font-semibold text-foreground">裁片放行矩阵详情</h1>
      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.spuCode)} · ${escapeHtml(record.spuName)}</p>
    </header>
  `
}

function getTicketDisplayStatus(ticket: ReleaseTicketDetail): string {
  if (ticket.validity === '不可用') return '不可用'
  if (!ticket.craftRequirementKnown) return '待核对'
  if (ticket.completionEvidenceKnown === false) return '待核对'
  if (!ticket.requiresSpecialCraft) return '无需特殊工艺'
  const finalStep = ticket.craftSteps.at(-1)
  const isComplete = (step: ReleaseTicketDetail['craftSteps'][number]) => (
    typeof step.returnedQty === 'number' && Number.isSafeInteger(step.returnedQty) && step.returnedQty >= 0
    || ['已回仓', '已实际回仓', '加工完成待回仓', '完成待转工艺', '已交下一工艺', '已完成'].includes(step.status)
  )
  const finalReceived = finalStep && typeof finalStep.returnedQty === 'number' && Number.isSafeInteger(finalStep.returnedQty) && finalStep.returnedQty >= 0
  if (finalReceived && ticket.craftSteps.every(isComplete) && (ticket.receiptId || finalStep.receiptId)
    && (ticket.eligiblePieceQty > 0 || finalStep.returnedQty === 0)) return '已最终回仓'
  if (ticket.eligiblePieceQty > 0) return '待核对'
  if (finalStep && finalStep.returnedQty === null && (isComplete(finalStep) || finalStep.processedQty > 0 || finalStep.status === '待回仓')) return '待回仓'
  return '待加工'
}

/** 只缩短明确的静态示例显示号，保留真实现场号及全部原身份。 */
function getCutPieceReleaseTicketDisplayIdentity(ticket: ReleaseTicketDetail): { ticketNo: string; bagCode: string; bagUseId: string; demo: boolean } {
  const sourceSequence = (ticket.spreadingOrderNo || ticket.sourceNo || '').match(/(?:^|-)(\d+)$/)?.[1]
  const suffix = sourceSequence ? ` ${sourceSequence.padStart(3, '0')}` : ''
  return {
    ticketNo: ticket.ticketNo.startsWith('FT-DEMO:') ? `示例菲票${suffix}` : ticket.ticketNo,
    bagCode: ticket.bagCode?.startsWith('BAG-DEMO:') ? `示例中转袋${suffix}` : ticket.bagCode || '未记录',
    bagUseId: ticket.bagUseId?.startsWith('USE-DEMO:') ? '示例装袋周期' : ticket.bagUseId || '未记录',
    demo: ticket.ticketNo.startsWith('FT-DEMO:') || Boolean(ticket.bagCode?.startsWith('BAG-DEMO:')) || Boolean(ticket.bagUseId?.startsWith('USE-DEMO:')),
  }
}

function isInternalCutPieceCraftRecordNo(value: string): boolean {
  return /(?:special-craft-handover:|SPECIAL-HR-)[\s\S]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)
}

function renderCutPieceCraftRecordLinks(step: ReleaseTicketDetail['craftSteps'][number]): string {
  const internalHandover = Boolean(step.sourceHandoverNo && isInternalCutPieceCraftRecordNo(step.sourceHandoverNo))
  const internalReceipt = Boolean(step.receiptNo && isInternalCutPieceCraftRecordNo(step.receiptNo))
  return `${step.sourceHandoverNo && !internalHandover ? `<div class="mt-1 text-slate-500">交出单 ${escapeHtml(step.sourceHandoverNo)}</div>` : ''}${step.receiptId ? `<div class="mt-1 text-slate-500">回仓记录 ${escapeHtml(internalReceipt ? '已登记' : step.receiptNo || '单号未记录')} · 回仓位置 ${escapeHtml(step.returnLocationLabel || '未记录')}</div>` : ''}${step.receiptId || internalHandover || internalReceipt ? `<details class="mt-1 text-slate-500"><summary class="cursor-pointer">查看记录编号</summary>${step.receiptId ? `<p class="mt-1 break-all">${escapeHtml(step.receiptId)}</p>` : ''}${internalReceipt ? `<p class="mt-1 break-all">原回仓记录 ${escapeHtml(step.receiptNo!)}</p>` : ''}${internalHandover ? `<p class="mt-1 break-all">原交出记录 ${escapeHtml(step.sourceHandoverNo!)}</p>` : ''}</details>` : ''}`
}

export function buildCutPieceTicketValidityConfirmation(ticket: ReleaseTicketDetail, record: CutPieceReleaseRecord, valid: boolean): string {
  const identity = getCutPieceReleaseTicketDisplayIdentity(ticket)
  const key = releaseTargetKey(ticket.garmentColor, ticket.size)
  const target = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1)?.targetPreview.colorSizeTargets[key]
  const release = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId).find(version => version.isLatestEffective)
  const allocated = getAllocationReadiness(record).lines.find(line => line.color === ticket.garmentColor && line.size === ticket.size)?.allocatedQty ?? 0
  const quantity = (value: number | undefined) => value === undefined ? '未确认' : `${formatQuantity(value)} 件`
  const craftLines = ticket.craftSteps.map(step => `第 ${step.sequence} 道 ${step.craftName} / ${step.factoryName || '承接厂未记录'}：已交出 ${formatQuantity(step.handedOverQty)} 片，${step.returnedQty === null ? '尚未回仓' : `实际实收 ${formatQuantity(step.returnedQty)} 片`}${step.receiptNo && !isInternalCutPieceCraftRecordNo(step.receiptNo) ? `，回仓记录 ${step.receiptNo}` : ''}`)
  return [
    `确认将 ${identity.ticketNo} 整票${valid ? '恢复为可用' : '登记为不可用'}？`,
    `${record.productionOrderNo} · ${ticket.garmentColor} / ${ticket.size} · ${ticket.partName}；原票 ${formatQuantity(ticket.printedPieceQty)} 片，当前可计入 ${formatQuantity(ticket.eligiblePieceQty)} 片。`,
    `受影响袋：${identity.bagCode}${ticket.bagUseId && !/^(?:cycle:|usage:|temp-bag:|USE-DEMO:)/.test(ticket.bagUseId) ? `；使用周期 ${identity.bagUseId}` : ''}；当前位置：${ticket.locationLabel || '未记录'}。`,
    ticket.requiresSpecialCraft ? `关联工艺交出 / 回仓：\n${craftLines.join('\n') || '工艺明细待核对'}` : '本票无需特殊工艺。',
    `本色码：目标 ${quantity(target)}；有效放行 ${quantity(release?.releaseQtyByColorSize[key])}；已分配 ${formatQuantity(allocated)} 件。`,
    valid ? '恢复前请核对已有工艺、回仓和分配记录，避免重复交接。' : '保存后更新齐套和当前风险。已交出的裁片如有差异，请联系 PPIC 跟进。',
    '原目标、放行量和已分配量不变。已有工艺任务不会自动取消，历史实交、实收记录保留。',
  ].join('\n\n')
}

export function renderCutPieceReleaseTicketDetail(ticket: ReleaseTicketDetail): string {
  const identity = getCutPieceReleaseTicketDisplayIdentity(ticket)
  const status = getTicketDisplayStatus(ticket)
  const validityVersion = getCutPieceTicketValidity(ticket.ticketId)?.version ?? 0
  return `<article class="mt-3 rounded-md border bg-white p-3" data-release-ticket-id="${escapeHtml(ticket.ticketId)}">
    <div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm">${escapeHtml(identity.ticketNo)}</strong><span class="rounded bg-slate-100 px-2 py-0.5 text-xs ${ticket.validity === '不可用' ? 'text-rose-700' : status === '已最终回仓' ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(status)}</span></div>
    <div class="mt-2 grid gap-1 text-xs text-slate-600"><span>成衣 ${escapeHtml(ticket.garmentColor)} / ${escapeHtml(ticket.size)} · 面料色 ${escapeHtml(ticket.fabricColor || '未记录')}</span><span>原票 ${formatQuantity(ticket.printedPieceQty)} 片 · 当前有效实物 ${formatQuantity(ticket.physicalPieceQty)} 片 · 整票${escapeHtml(ticket.validity)}</span><span>来源 ${escapeHtml(ticket.sourceType)}：${escapeHtml(ticket.sourceNo || '未记录')}</span><span>裁片单 ${escapeHtml(ticket.cutOrderNo || '未关联')}${ticket.spreadingOrderNo ? ` · 铺布单 ${escapeHtml(ticket.spreadingOrderNo)}` : ''}</span><span>袋号 ${escapeHtml(identity.bagCode)}</span><details data-testid="cut-piece-release-original-identity"><summary class="cursor-pointer text-blue-700">${identity.demo ? '查看原始编号' : '查看装袋依据'}</summary>${identity.demo ? `<p class="mt-1 break-all">原菲票号 ${escapeHtml(ticket.ticketNo)}</p><p class="mt-1 break-all">原袋号 ${escapeHtml(ticket.bagCode || '未记录')}</p>` : ''}<p class="mt-1 break-all">使用周期 ${escapeHtml(ticket.bagUseId || '未记录')}</p></details><span>当前位置 ${escapeHtml(ticket.locationLabel || '未记录')}</span></div>
    ${!ticket.craftRequirementKnown ? '<p class="mt-2 text-xs text-amber-700">部位工艺要求待核对，暂不计齐套。</p>' : ticket.requiresSpecialCraft ? `<ol class="mt-3 space-y-2 border-l-2 border-blue-100 pl-3">${ticket.craftSteps.map((step, index) => `<li class="rounded border p-2 text-xs ${index === ticket.craftSteps.length - 1 ? 'border-blue-200 bg-blue-50/40' : ''}"><div class="font-medium">第 ${step.sequence} / ${ticket.craftSteps.length} 道 · ${escapeHtml(step.craftName)} · ${escapeHtml(step.craftType)}${index === ticket.craftSteps.length - 1 ? ' · 最终工艺' : ''}</div><div class="mt-1 text-slate-600">承接厂 ${escapeHtml(step.factoryName || '未记录')} · ${escapeHtml(step.status)}</div><div class="mt-1 tabular-nums">应回 ${formatQuantity(step.expectedQty)} 片 · 加工 ${formatQuantity(step.processedQty)} 片 · 交出 ${formatQuantity(step.handedOverQty)} 片</div><div class="mt-1 ${step.returnedQty === null ? 'text-amber-700' : 'text-emerald-700'}">实际实收 ${step.returnedQty === null ? '尚未回仓' : `${formatQuantity(step.returnedQty)} 片`}</div>${renderCutPieceCraftRecordLinks(step)}${step.returnedAt ? `<div class="mt-1 text-slate-500">${escapeHtml(step.returnedBy || '未记录')} · ${escapeHtml(formatDateTime(step.returnedAt))}</div>` : ''}</li>`).join('') || '<li class="text-amber-700">请核对部位工艺。</li>'}</ol>` : '<p class="mt-2 text-xs text-slate-600">无需特殊工艺，按有效装袋量计算。</p>'}
    <div class="mt-3 rounded bg-slate-50 px-2 py-2 text-xs"><strong>当前可计入 ${formatQuantity(ticket.eligiblePieceQty)} 片</strong><span class="ml-1">${ticket.validity === '不可用' ? '原因：整票不可用' : !ticket.craftRequirementKnown ? '原因：工艺要求待核对' : ticket.completionEvidenceKnown === false ? '已实收，加工完成依据待核对，暂不计齐套' : ticket.requiresSpecialCraft && status !== '已最终回仓' ? '原因：尚未完成全部工艺及最终回仓' : ticket.requiresSpecialCraft ? '依据：最终工艺实际实收' : '依据：有效已装袋菲票'}</span></div>
    ${ticket.differenceReason ? `<p class="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">差异原因：${escapeHtml(ticket.differenceReason)}</p>` : ''}
    <div class="mt-3 border-t pt-2"><label class="block text-xs text-slate-600">整票${ticket.validity === '可用' ? '不可用' : '恢复可用'}原因<input type="text" class="mt-1 h-8 w-full rounded border px-2 text-xs" value="${escapeHtml(state.validityReasons[ticket.ticketId] ?? '')}" data-skip-page-rerender="true" data-cut-piece-release-field="ticketValidityReason" data-ticket-id="${escapeHtml(ticket.ticketId)}" ${state.saving ? 'disabled' : ''}></label><button type="button" class="mt-2 rounded border px-3 py-1.5 text-xs disabled:opacity-50 ${ticket.validity === '可用' ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}" data-skip-page-rerender="true" data-cut-piece-release-action="set-ticket-validity" data-ticket-id="${escapeHtml(ticket.ticketId)}" data-ticket-valid="${ticket.validity !== '可用'}" data-ticket-no="${escapeHtml(ticket.ticketNo)}" data-ticket-validity-version="${validityVersion}" ${state.saving ? 'disabled' : ''}>${ticket.validity === '可用' ? '登记整票不可用' : '恢复整票可用'}</button></div>
  </article>`
}

// PAGE-006..008: a color-size cell shows every required material rather than an arbitrary first material.
function renderCellDrawer(record: CutPieceReleaseRecord): string {
  const active = state.activeCell
  if (!active) return ''
  const group = record.matrix.colorGroups.find(item => item.garmentColor === active.garmentColor)
  if (!group || !group.sizes.includes(active.size)) return ''
  const key = releaseTargetKey(group.garmentColor, active.size)
  const savedTarget = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1)
  const release = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId).find(version => version.isLatestEffective)
  const allocation = getAllocationReadiness(record).lines.find(line => line.color === group.garmentColor && line.size === active.size)
  const kit = group.completeKitBySize[active.size]
  const amount = release?.releaseQtyByColorSize[key]
  const materialRows = group.materialRows.filter(row => !state.drawerMaterialFilter || row.materialId === state.drawerMaterialFilter)
  const parts = group.materialRows.flatMap(row => row.cells.find(cell => cell.size === active.size)?.partCalculations ?? [])
  const partOptions = [...new Map(parts.map(part => [part.partId, part.partName])).entries()]
  return `<div class="fixed inset-0 z-50" data-testid="cut-piece-release-cell-drawer">
    <button type="button" class="absolute inset-0 w-full bg-black/45" aria-label="点击空白处返回" data-skip-page-rerender="true" data-cut-piece-release-action="close-cell"></button>
    <aside class="absolute inset-y-0 right-0 w-full max-w-[640px] overflow-y-auto border-l bg-background shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cut-piece-release-cell-drawer-title">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-4"><div><h2 class="text-lg font-semibold" id="cut-piece-release-cell-drawer-title">裁片详情</h2><p class="text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(group.garmentColor)} / ${escapeHtml(active.size)}</p></div><button type="button" class="rounded-md border px-3 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="close-cell" data-cut-piece-release-overlay-initial-focus>关闭详情</button></header>
      <div class="space-y-4 p-5">
        ${state.feedback?.tone === 'error' ? `<div role="alert" data-release-drawer-error>${renderFeedback()}</div>` : ''}
        <section class="grid grid-cols-2 gap-2 rounded-lg border bg-slate-50 p-3 text-sm"><span>目标 ${savedTarget?.targetPreview.colorSizeTargets[key] === undefined ? '未确认' : `${formatQuantity(savedTarget.targetPreview.colorSizeTargets[key])} 件`}</span><span>当前齐套 ${kit === null ? '待核对' : `${formatQuantity(kit)} 件`}</span><span>有效放行 ${amount === undefined ? '未确认' : `${formatQuantity(amount)} 件`}</span><span>已分配 ${formatQuantity(allocation?.allocatedQty ?? 0)} 件</span><span>可新增分配 ${amount === undefined ? '未确认' : `${formatQuantity(Math.max(amount - (allocation?.allocatedQty ?? 0), 0))} 件`}</span><span>当前风险 ${amount === undefined ? '未确认' : kit === null ? '待核对' : `${formatQuantity(Math.max(amount - kit, 0))} 件`}</span></section>
        ${record.requiresReview ? `<section class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>与确认时差异</strong><p class="mt-1">${escapeHtml(record.factChangeMessage || '数量已变化，请核对放行')}</p><p class="mt-1 text-xs">${release ? `本色码确认时齐套 ${release.completeKitQtyByColorSize?.[key] === undefined ? '历史未记录' : release.completeKitQtyByColorSize[key] === null ? '当时待核对' : `${formatQuantity(release.completeKitQtyByColorSize[key])} 件`} → 当前 ${kit === null ? '待核对' : `${formatQuantity(kit)} 件`}；确认时风险 ${formatQuantity(release.riskReleaseQtyByColorSize[key] ?? 0)} 件。` : '目标和原放行不自动变化。'}</p><button type="button" class="mt-2 text-xs text-blue-700" data-skip-page-rerender="true" data-cut-piece-release-action="open-history">查看数量记录</button></section>` : ''}
        <div class="grid grid-cols-3 gap-2 text-xs"><label>材料<select class="mt-1 w-full rounded border bg-white p-2" data-skip-page-rerender="true" data-cut-piece-release-field="drawerMaterialFilter"><option value="">全部材料</option>${group.materialRows.map(row => `<option value="${escapeHtml(row.materialId)}" ${state.drawerMaterialFilter === row.materialId ? 'selected' : ''}>${escapeHtml(row.materialName)}</option>`).join('')}</select></label><label>部位<select class="mt-1 w-full rounded border bg-white p-2" data-skip-page-rerender="true" data-cut-piece-release-field="drawerPartFilter"><option value="">全部部位</option>${partOptions.map(([id, name]) => `<option value="${escapeHtml(id)}" ${state.drawerPartFilter === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label><label>菲票状态<select class="mt-1 w-full rounded border bg-white p-2" data-skip-page-rerender="true" data-cut-piece-release-field="drawerTicketFilter">${['全部', '待加工', '待回仓', '已最终回仓', '无需特殊工艺', '不可用', '待核对'].map(status => `<option value="${status}" ${state.drawerTicketFilter === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label></div>
        ${materialRows.map(row => {
          const cell = row.cells.find(item => item.size === active.size)
          if (!cell) return ''
          return `<section class="rounded-lg border p-4"><div class="flex items-center gap-3">${renderBusinessImage(row.materialImageUrl, row.materialName, `drawer-image-${row.materialId}`)}<div><h3 class="font-semibold">${escapeHtml(displayMaterialName(row.materialId, row.materialName))}</h3>${replacementFabricMaterialDisplayCode(row.materialId) ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(replacementFabricMaterialDisplayCode(row.materialId))}</p>` : ''}</div></div>${renderCraftSummary([cell])}${cell.partCalculations.filter(part => !state.drawerPartFilter || part.partId === state.drawerPartFilter).map(part => {
            const tickets = (part.ticketDetails ?? []).filter(ticket => state.drawerTicketFilter === '全部' || getTicketDisplayStatus(ticket) === state.drawerTicketFilter)
            const sources = getCutPieceReleaseFactSourceSummary(record.productionOrderId, part.sourceFactIds)
            return `<article class="mt-4 border-t pt-3"><h4 class="font-medium">${escapeHtml(part.partName)}</h4><div class="mt-2 text-sm">有效实物 ${formatQuantity(part.physicalPieceQty)} 片 · 单耗 ${part.piecesPerGarment > 0 ? `${formatQuantity(part.piecesPerGarment)} 片 / 件` : '待核对'}</div><div class="mt-1 text-sm font-semibold">可计入 ${formatQuantity(part.actualPieceQty)} 片 ÷ 单耗 = ${part.availableGarmentQty === null ? '待核对' : `${formatQuantity(part.availableGarmentQty)} 件`}</div><div class="mt-1 text-xs text-slate-600">实物支持 ${part.physicalGarmentQty === null ? '待核对' : `${formatQuantity(part.physicalGarmentQty)} 件`}${part.availableGarmentQty === cell.availableGarmentQty ? ' · 本材料齐套短板' : ''}</div>${tickets.map(renderCutPieceReleaseTicketDetail).join('') || `<p class="mt-3 text-xs text-muted-foreground">${(part.ticketDetails ?? []).length ? '无符合筛选的菲票。' : '菲票明细缺失，请核对来源。'}</p>`}<details class="mt-3 text-xs text-muted-foreground"><summary class="cursor-pointer">查看原始数量依据</summary><p class="mt-1">裁片单 ${escapeHtml(sources.cutOrderNos.join('、') || '未关联')}</p><p class="mt-1">铺布单 ${escapeHtml(sources.spreadingOrderNos.join('、') || '未关联')}</p><p class="mt-1 break-all">来源记录 ${escapeHtml(part.sourceFactIds.join('、') || '未关联')}</p></details></article>`
          }).join('')}</section>`
        }).join('') || '<p class="text-sm text-muted-foreground">无符合筛选的材料。</p>'}
      </div>
    </aside>
  </div>`
}

function renderImagePreview(): string {
  const image = state.imagePreview
  if (!image) return ''
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-5" role="dialog" aria-modal="true" aria-label="${escapeHtml(image.alt)}大图" data-cut-piece-release-image-dialog><button type="button" class="absolute inset-0" aria-label="关闭图片" data-skip-page-rerender="true" data-cut-piece-release-action="close-image"></button><figure class="relative z-10 flex max-h-full max-w-[90vw] flex-col overflow-hidden rounded-lg bg-white p-3"><button type="button" class="mb-2 self-end rounded border px-3 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="close-image" data-cut-piece-release-image-initial-focus>关闭大图</button><div class="relative min-h-[160px] overflow-auto"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" class="max-h-[75vh] max-w-full object-contain" onload="this.nextElementSibling.classList.add('hidden')" onerror="this.classList.add('hidden');this.nextElementSibling.textContent='图片加载失败，请关闭后重试'"><span class="absolute inset-0 flex items-center justify-center bg-muted text-sm text-slate-600">图片加载中</span></div><figcaption class="mt-2 text-sm">${escapeHtml(image.alt)}</figcaption></figure></div>`
}

function formatHistoryDelta(delta: number): string {
  return `${delta >= 0 ? '+' : '-'}${formatQuantity(Math.abs(delta))} 件`
}

function formatHistoryQuantityValue(value: CutPieceReleaseHistoryQuantityValue, after: boolean): string {
  if (!value.exists) return after ? '已移除' : '0 件'
  return value.quantity === null ? '待核对' : `${formatQuantity(value.quantity)} 件`
}

function formatHistoryChange(
  before: CutPieceReleaseHistoryQuantityValue,
  after: CutPieceReleaseHistoryQuantityValue,
  delta: number | null,
): string {
  const suffix = delta === null ? '状态变化' : formatHistoryDelta(delta)
  return `${formatHistoryQuantityValue(before, false)} → ${formatHistoryQuantityValue(after, true)}（${suffix}）`
}

function renderHistoryExpandedDetails(
  record: CutPieceReleaseRecord,
  version: CutPieceReleaseMatrixVersion,
  difference: CutPieceReleaseHistoryDifference,
): string {
  const targetSnapshot = version.eventType === '目标确认'
    ? listCutPieceReleaseTargetSnapshots(record.productionOrderId).find((snapshot) => (
        snapshot.matrixVersion === version.version - 1
      )) ?? null
    : null
  const targetLines = targetSnapshot ? targetSnapshot.matrixSnapshot.colorGroups.flatMap((group) => group.sizes.map((size) => ({
    garmentColor: group.garmentColor,
    size,
    quantity: targetSnapshot.targetPreview.colorSizeTargets[releaseTargetKey(group.garmentColor, size)],
  }))) : []
  const targetCounts = targetSnapshot ? {
    shortage: targetSnapshot.targetPreview.differences.filter((item) => item.status === '需补').length,
    exact: targetSnapshot.targetPreview.differences.filter((item) => item.status === '刚好').length,
    surplus: targetSnapshot.targetPreview.differences.filter((item) => item.status === '多余').length,
  } : null
  return `
    <div class="mt-3 space-y-3 border-t pt-3" id="cut-piece-release-history-details-${version.version}" data-cut-piece-release-history-details>
      ${difference.completeKitChanges.length ? `
        <section>
          <h4 class="text-sm font-semibold">颜色尺码齐套变化</h4>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            ${difference.completeKitChanges.map((change) => `<div class="rounded-md bg-slate-50 px-3 py-2 text-sm">${escapeHtml(change.garmentColor)} / ${escapeHtml(change.size)}：${formatHistoryChange(change.before, change.after, change.delta)}</div>`).join('')}
          </div>
        </section>
      ` : '<p class="text-sm text-muted-foreground">齐套数量未变化。</p>'}
      ${difference.materialChanges.length ? `
        <section>
          <h4 class="text-sm font-semibold">变化物料点</h4>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            ${difference.materialChanges.map((change) => `<div class="rounded-md border px-3 py-2 text-sm">${escapeHtml(change.garmentColor)} / ${escapeHtml(change.size)} / ${escapeHtml(displayMaterialName(change.materialId, record.matrix.colorGroups.flatMap(group => group.materialRows).find(row => row.materialId === change.materialId)?.materialName || replacementFabricMaterialDisplayCode(change.materialId) || '材料'))}：${formatHistoryChange(change.before, change.after, change.delta)}</div>`).join('')}
          </div>
        </section>
      ` : ''}
      ${version.eventType === '裁片单冻结' ? '<div class="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">裁剪数量已冻结，仓库数量继续更新</div>' : ''}
      ${targetCounts ? `
        <section class="rounded-md border border-blue-200 bg-blue-50 p-3">
          <h4 class="text-sm font-semibold">已确认目标（${targetLines.length} 个颜色尺码）</h4>
          <div class="mt-2 grid gap-2 sm:grid-cols-3">${targetLines.map((line) => `<div class="rounded bg-white px-2.5 py-2 text-sm">${escapeHtml(line.garmentColor)} / ${escapeHtml(line.size)}：${formatQuantity(line.quantity)} 件</div>`).join('')}</div>
          <div class="mt-3 flex flex-wrap gap-3 text-sm"><span class="font-medium text-rose-700">需补 ${targetCounts.shortage} 个物料点</span><span class="font-medium text-amber-700">刚好 ${targetCounts.exact} 个物料点</span><span class="font-medium text-emerald-700">多余 ${targetCounts.surplus} 个物料点</span></div>
        </section>
      ` : ''}
    </div>
  `
}

function renderHistoryContent(record: CutPieceReleaseRecord): string {
  const chronologicalVersions = listCutPieceReleaseMatrixVersions(record.productionOrderId)
  const versions = chronologicalVersions.slice().reverse()
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(versions.length / pageSize))
  state.historyPage = Math.min(Math.max(1, state.historyPage), totalPages)
  const rows = versions.slice((state.historyPage - 1) * pageSize, state.historyPage * pageSize)
  const lateEvents = listLateCutPieceReleaseEvents(record.productionOrderId)
  return `
    <div class="space-y-3 p-5">
          ${lateEvents.length ? `
            <section class="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4" data-testid="cut-piece-release-late-events-list">
              <h3 class="font-semibold text-amber-900">关闭后待处理铺布数据</h3>
              ${lateEvents.map((event) => `
                <article class="rounded-md border border-amber-200 bg-white p-3 text-sm">
                  <div class="font-medium">${escapeHtml(event.spreadingOrderNo)} · ${escapeHtml(event.cutOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">收到时间：${escapeHtml(formatDateTime(event.arrivedAt))}</div>
                  <div class="mt-1 text-amber-800">未计入原因：${escapeHtml(event.reason)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${event.facts.map((fact) => `${escapeHtml(fact.garmentColor)} / ${escapeHtml(fact.size)} / ${escapeHtml(displayMaterialName(fact.materialId, record.matrix.colorGroups.flatMap(group => group.materialRows).find(row => row.materialId === fact.materialId)?.materialName || replacementFabricMaterialDisplayCode(fact.materialId) || '材料'))}：${formatQuantity(fact.actualPieceQty)} 片`).join('；')}</div>
                </article>
              `).join('')}
            </section>
          ` : ''}
          ${rows.map((version) => {
            const previous = chronologicalVersions.find((item) => item.version === version.version - 1)
            const difference = calculateCutPieceReleaseHistoryDifference(version, previous)
            const expanded = state.expandedHistoryVersion === version.version
            const cutOrderNos = version.sourceCutOrderNos.length
              ? version.sourceCutOrderNos
              : version.cutOrderNo ? [version.cutOrderNo] : []
            const completeKitSummary = difference.completeKitChanges.map((change) => `${change.size} ${formatHistoryQuantityValue(change.before, false)} → ${formatHistoryQuantityValue(change.after, true)}`).join('；')
            return `
              <article class="rounded-lg border p-4" data-cut-piece-release-history-version="${version.version}">
                <div class="flex flex-wrap items-center justify-between gap-3"><strong>V${version.version} · ${escapeHtml(version.eventType)}</strong><span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(version.occurredAt))}</span></div>
                <div class="mt-2 text-sm">操作人：${escapeHtml(version.operator)}</div>
                ${cutOrderNos.length ? `<div class="mt-1 text-sm text-muted-foreground">来源裁片单：${escapeHtml(cutOrderNos.join('、'))}</div>` : ''}
                ${version.spreadingOrderNo ? `<div class="mt-1 text-sm text-muted-foreground">铺布单：${escapeHtml(version.spreadingOrderNo)}</div>` : ''}
                ${version.reason ? `<div class="mt-1 text-sm text-muted-foreground">原因：${escapeHtml(version.reason)}</div>` : ''}
                <div class="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <div>受影响颜色：${difference.affectedColors.length ? escapeHtml(difference.affectedColors.join('、')) : '无数量变化'}</div>
                  <div class="mt-1">受影响尺码：${difference.completeKitChanges.length} 个</div>
                  <div class="mt-1">齐套变化：${completeKitSummary || '无数量变化'}</div>
                  <div class="mt-1">变化物料点：${difference.materialChanges.length} 个</div>
                </div>
                <div class="mt-3 flex justify-end">
                  <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" aria-expanded="${expanded}" aria-controls="cut-piece-release-history-details-${version.version}" data-skip-page-rerender="true" data-cut-piece-release-action="toggle-history-version" data-history-version="${version.version}">${expanded ? '收起详情' : '展开详情'}</button>
                </div>
                ${expanded ? renderHistoryExpandedDetails(record, version, difference) : ''}
              </article>
            `
          }).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无更新历史</div>'}
          <footer class="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
            <span>第 ${state.historyPage} / ${totalPages} 页 · 每页 ${pageSize} 条 · 共 ${versions.length} 条</span>
            <div class="flex gap-2">
              <button type="button" class="rounded border px-3 py-1.5 disabled:opacity-40" ${state.historyPage <= 1 ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="history-prev">上一页</button>
              <button type="button" class="rounded border px-3 py-1.5 disabled:opacity-40" ${state.historyPage >= totalPages ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="history-next">下一页</button>
            </div>
          </footer>
    </div>
  `
}

function renderHistoryDrawer(record: CutPieceReleaseRecord): string {
  if (!state.historyOpen) return ''
  return `
    <div class="fixed inset-0 z-50" data-testid="cut-piece-release-history-drawer">
      <button type="button" class="absolute inset-0 w-full bg-black/45" aria-label="点击空白处返回" data-skip-page-rerender="true" data-cut-piece-release-action="close-history"></button>
      <aside class="absolute inset-y-0 right-0 w-full max-w-[720px] overflow-y-auto border-l bg-background shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cut-piece-release-history-drawer-title">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-4">
          <div><h2 class="text-lg font-semibold" id="cut-piece-release-history-drawer-title">矩阵更新历史</h2><p class="text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)}</p></div>
          <button type="button" class="rounded-md border px-3 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="close-history" data-cut-piece-release-overlay-initial-focus>关闭更新历史</button>
        </header>
        <div tabindex="-1" data-cut-piece-release-history-content>${renderHistoryContent(record)}</div>
      </aside>
    </div>
  `
}

function renderBusinessOverlays(): string {
  const record = getActiveRecord()
  return `${record ? `${renderCellDrawer(record)}${renderHistoryDrawer(record)}` : ''}${renderImagePreview()}`
}

function renderListOverlay(): string {
  const settings = !state.columnSettingsOpen ? '' : withSkipPageRerender(renderStandardListColumnSettings({
    title: '列设置',
    columns: listColumns,
    preferences: state.columnPreferences,
    eventPrefix: 'cut-piece-release',
    maxFrozenWidth: listMaxFrozenWidth,
  }))
  return `${settings}${renderBusinessOverlays()}`
}

function setReleaseRegion(region: string, html: string): void {
  if (typeof document === 'undefined') return
  const element = document.querySelector<HTMLElement>(`[data-cut-piece-release-region="${region}"]`)
  if (element) {
    element.innerHTML = html
    hydrateIcons(element)
  }
}

function refreshFeedback(): void {
  setReleaseRegion('feedback', renderFeedback())
}

function refreshMigrationPanel(): void {
  setReleaseRegion('migration', renderMigrationPanel())
}

function refreshFilters(): void {
  setReleaseRegion('filters', renderFilters())
}

function refreshList(): void {
  const view = getListView()
  setReleaseRegion('stats', renderListStats(view.filtered))
  setReleaseRegion('table', renderListTable(view.paging))
  setReleaseRegion('pagination', renderListPagination(view.paging))
}

function refreshTableAndPagination(): void {
  const view = getListView()
  setReleaseRegion('table', renderListTable(view.paging))
  setReleaseRegion('pagination', renderListPagination(view.paging))
}

function refreshTable(): void {
  setReleaseRegion('table', renderListTable(getListView().paging))
}

function refreshOverlay(): void {
  const oldDrawer = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-cut-piece-release-cell-drawer] aside')
  const scrollTop = oldDrawer?.scrollTop ?? 0
  setReleaseRegion('overlay', renderListOverlay())
  const newDrawer = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-cut-piece-release-cell-drawer] aside')
  if (newDrawer) newDrawer.scrollTop = newDrawer.querySelector('[data-release-drawer-error]') ? 0 : scrollTop
}

function refreshHistoryContent(focusAction: string, historyVersion?: number): void {
  if (typeof document === 'undefined') return
  const record = getActiveRecord()
  const content = document.querySelector<HTMLElement>('[data-cut-piece-release-history-content]')
  const aside = content?.closest<HTMLElement>('aside')
  if (!record || !content || !aside) return
  const scrollTop = aside.scrollTop
  content.innerHTML = renderHistoryContent(record)
  hydrateIcons(content)
  aside.scrollTop = scrollTop
  queueMicrotask(() => {
    const versionSelector = historyVersion === undefined ? '' : `[data-history-version="${historyVersion}"]`
    const preferred = content.querySelector<HTMLElement>(`[data-cut-piece-release-action="${focusAction}"]${versionSelector}`)
    const focusTarget = preferred && !preferred.hasAttribute('disabled') ? preferred : content
    focusTarget.focus({ preventScroll: true })
    aside.scrollTop = scrollTop
  })
}

function focusOverlayInitialControl(): void {
  queueMicrotask(() => {
    document.querySelector<HTMLElement>('[data-cut-piece-release-overlay-initial-focus]')?.focus()
  })
}

function restoreOverlayTriggerFocus(testId: string | null): void {
  if (!testId) return
  queueMicrotask(() => {
    const trigger = [...document.querySelectorAll<HTMLElement>('[data-testid]')]
      .find((element) => element.dataset.testid === testId)
    const fallback = document.querySelector<HTMLElement>('[data-cut-piece-release-action="open-matrix"]')
    const focusTarget = trigger ?? fallback
    focusTarget?.focus()
  })
}

function refreshMatrix(): void {
  setReleaseRegion('matrix', renderMatrixPanel())
}

export function renderCraftCuttingCutPieceReleasePage(): string {
  return withCutPieceReleaseReadSnapshot(renderCutPieceReleasePageContent)
}

function renderCutPieceReleasePageContent(): string {
  ensureScopedEscapeListener()
  ensureScopedHistoryListener()
  ensureListPreferences()
  const hasMountedPageRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector('[data-cut-piece-release-page]'))
  if (!hasMountedPageRoot) {
    resetTransientPageState()
    initializeMatrixDetailFromQuery()
  }
  const detailRecord = isMatrixDetailWindow() ? getActiveRecord() : null
  if (detailRecord) {
    return `
      <section class="min-w-0 w-full space-y-4 p-4" data-cut-piece-release-page data-cut-piece-release-detail-page>
        ${renderMatrixDetailHeader(detailRecord)}
        <div data-cut-piece-release-region="feedback">${renderFeedback()}</div>
        <div data-cut-piece-release-region="migration">${renderMigrationPanel()}</div>
        <div data-cut-piece-release-region="matrix">${renderMatrixPanel()}</div>
        <div data-cut-piece-release-region="overlay">${renderBusinessOverlays()}</div>
      </section>
    `
  }
  const view = getListView()
  const columnSettingsButton = withSkipPageRerender(renderSecondaryButton(
    '列设置',
    { prefix: 'cut-piece-release', action: 'open-column-settings' },
    'columns-3',
  ))
  return renderStandardListPage({
    title: '裁片放行管理',
    feedbackHtml: `<div data-cut-piece-release-region="feedback">${renderFeedback()}</div><div data-cut-piece-release-region="migration">${renderMigrationPanel()}</div>`,
    filtersHtml: `<div data-cut-piece-release-region="filters">${renderFilters()}</div>`,
    statsHtml: `<div data-cut-piece-release-region="stats">${renderListStats(view.filtered)}</div>`,
    listTitle: '生产单裁片矩阵',
    listActionsHtml: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-release-action="export">导出当前筛选</button>${columnSettingsButton}`,
    tableHtml: `<div data-cut-piece-release-region="table">${renderListTable(view.paging)}</div>`,
    paginationHtml: `<div data-cut-piece-release-region="pagination">${renderListPagination(view.paging)}</div>`,
    overlaysHtml: `
      <div data-cut-piece-release-region="matrix">${renderMatrixPanel()}</div>
      <div data-cut-piece-release-region="overlay">${renderListOverlay()}</div>
    `,
    className: 'max-w-full overflow-x-hidden',
  }).replace('data-standard-list-page', 'data-standard-list-page data-cut-piece-release-page')
}

function handleFieldChange(node: HTMLInputElement | HTMLSelectElement): boolean {
  const field = node.dataset.cutPieceReleaseField
  if (field === 'migrationOtherPagesClosed') {
    state.migrationOtherPagesClosed = node instanceof HTMLInputElement && node.checked
    refreshMigrationPanel()
    return true
  }
  if (field === 'keywordDraft') {
    state.keywordDraft = node.value
    return true
  }
  if (field === 'matrixStatus') {
    state.matrixStatus = node.value as MatrixStatusFilter
    state.page = 1
    refreshList()
    return true
  }
  if (field === 'targetStatus') {
    state.targetStatus = node.value as TargetStatusFilter
    state.page = 1
    refreshList()
    return true
  }
  if (field === 'releaseStatusFilter') {
    state.releaseStatusFilter = node.value
    state.page = 1
    refreshList()
    return true
  }
  if (field === 'factChangeFilter') {
    state.factChangeFilter = node.value
    state.page = 1
    refreshList()
    return true
  }
  if (field === 'releaseQtyInput') {
    const key = releaseTargetKey(node.dataset.releaseColor || '', node.dataset.releaseSize || '')
    state.releaseDraft[key] = node.value
    const quantity = parseReleaseQuantityInput(node.value)
    const minimum = Number(node.dataset.min || 0)
    const maximum = Number(node.dataset.max || 0)
    const error = quantity === null ? '数量无效，请输入非负整数' : quantity < minimum ? `低于已分配 ${formatQuantity(minimum)} 件，请增加数量` : quantity > maximum ? `超过目标 ${formatQuantity(maximum)} 件，请减少数量` : ''
    node.setAttribute('aria-invalid', String(Boolean(error)))
    const message = [...document.querySelectorAll<HTMLElement>('[data-release-input-error]')].find(element => element.dataset.releaseInputError === key)
    if (message) message.textContent = error
    refreshReleaseRiskReasonInput()
    return true
  }
  if (field === 'riskReason') {
    state.riskReasonDraft = node.value
    return true
  }
  if (field === 'ticketValidityReason') {
    state.validityReasons[node.dataset.ticketId || ''] = node.value
    return true
  }
  if (field === 'drawerMaterialFilter' || field === 'drawerPartFilter' || field === 'drawerTicketFilter') {
    state[field] = node.value
    refreshOverlay()
    queueMicrotask(() => document.querySelector<HTMLElement>(`[data-cut-piece-release-field="${field}"]`)?.focus({ preventScroll: true }))
    return true
  }
  if (field === 'pageSize') {
    const pageSize = Number(node.value)
    if (listPageSizes.includes(pageSize)) {
      state.columnPreferences = normalizeListPreferences({ ...state.columnPreferences, pageSize })
      state.page = 1
      saveListPreferences()
      refreshTableAndPagination()
    }
    return true
  }
  return false
}

async function saveTargetDraft(record: CutPieceReleaseRecord): Promise<void> {
  if (state.targetBasisVersion === null || state.saving) return
  state.saving = true
  refreshMatrix()
  try {
    const result = await saveCutPieceReleaseTargetAction({ productionOrderId: record.productionOrderId, matrixVersion: state.targetBasisVersion,
      colorSizeTargets: { ...state.targetDraft }, confirmedBy: '裁床文员 Siti' })
    if (result.ok && result.snapshot) {
      state.targetBasisVersion = result.snapshot.matrixVersion
      state.savedTargetSnapshot = { snapshotId: result.snapshot.snapshotId, matrixVersion: result.snapshot.matrixVersion,
        colorSizeTargets: { ...result.snapshot.targetPreview.colorSizeTargets }, hasShortage: buildSupplementPartShortages(result.snapshot.matrixSnapshot, result.snapshot.targetPreview).length > 0 }
      state.targetMode = '确认'
    }
    state.currentMatrixVersion = listCutPieceReleaseMatrixVersions(record.productionOrderId).at(-1)?.version ?? state.currentMatrixVersion
    state.feedback = { tone: result.ok ? 'success' : 'error', message: result.message }
  } catch (error) {
    state.feedback = { tone: 'error', message: `目标未保存：${error instanceof Error ? error.message : '保存失败'}；选择已保留，可重试。` }
  } finally {
    state.saving = false
    withCutPieceReleaseReadSnapshot(() => {
      refreshFeedback()
      refreshList()
      refreshMatrix()
    })
  }
}

async function migrateReleaseData(): Promise<void> {
  if (state.saving || !state.migrationOtherPagesClosed) return
  state.saving = true
  state.migrationMessage = '正在转换，原资料保留。'
  refreshMigrationPanel()
  try {
    const result = await migrateLegacyCutPieceReleaseRecords({ otherPagesClosed: state.migrationOtherPagesClosed, progress: message => {
      state.migrationMessage = message
      refreshMigrationPanel()
    } })
    state.migrationMessage = result.message
    state.feedback = { tone: result.ok ? 'success' : 'error', message: result.message }
    if (result.ok) {
      state.migrationOtherPagesClosed = false
      initializeMatrixDetailFromQuery()
    }
  } catch (error) {
    state.migrationMessage = `转换未完成：${error instanceof Error ? error.message : '读取或保存失败'}；原资料保留，可重试。`
    state.feedback = { tone: 'error', message: state.migrationMessage }
  } finally {
    state.saving = false
    withCutPieceReleaseReadSnapshot(() => {
      refreshFeedback()
      refreshMigrationPanel()
      refreshList()
      refreshMatrix()
      refreshOverlay()
    })
  }
}

async function saveReleaseDraft(record: CutPieceReleaseRecord, maintain: boolean): Promise<void> {
  const versions = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId)
  const latestVersion = versions.find(version => version.isLatestEffective)
  const releaseQtyByColorSize: Record<string, number> = {}
  const nodes = [...document.querySelectorAll<HTMLInputElement>('[data-cut-piece-release-field="releaseQtyInput"]')]
  const target = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1)
  let risk = 0
  for (const node of nodes) {
    const color = node.dataset.releaseColor || ''
    const size = node.dataset.releaseSize || ''
    const key = releaseTargetKey(color, size)
    const raw = maintain ? String(latestVersion?.releaseQtyByColorSize[key] ?? '') : node.value
    state.releaseDraft[key] = raw
    const qty = parseReleaseQuantityInput(raw)
    const kit = record.matrix.colorGroups.find(group => group.garmentColor === color)?.completeKitBySize[size] ?? null
    const allocated = Number(node.dataset.min || 0)
    const maximum = target?.targetPreview.colorSizeTargets[key]
    const error = qty === null ? '数量无效，请输入非负整数' : kit === null ? '齐套待核对，请核对来源' : maximum === undefined ? '目标未确认，请先保存目标' : qty < allocated ? `低于已分配 ${formatQuantity(allocated)} 件，请增加数量` : qty > maximum ? `超过目标 ${formatQuantity(maximum)} 件，请减少数量` : ''
    if (error) {
      state.feedback = { tone: 'error', message: `${color} / ${size}：${error}；未保存，原放行量不变。` }
      node.setAttribute('aria-invalid', 'true')
      refreshFeedback()
      if (node.disabled) { state.releaseEditing = true; refreshMatrix() }
      queueMicrotask(() => [...document.querySelectorAll<HTMLInputElement>('[data-cut-piece-release-field="releaseQtyInput"]')].find(input => input.dataset.releaseColor === color && input.dataset.releaseSize === size)?.focus())
      return
    }
    releaseQtyByColorSize[key] = qty!
    risk += Math.max(qty! - kit!, 0)
  }
  const riskReasonNode = document.querySelector<HTMLInputElement>('[data-cut-piece-release-field="riskReason"]')
  state.riskReasonDraft = riskReasonNode?.value ?? state.riskReasonDraft
  if (risk > 0 && !state.riskReasonDraft.trim()) {
    state.feedback = { tone: 'error', message: '风险原因未填写，请补充。未保存，原放行量不变。' }
    refreshFeedback()
    refreshReleaseRiskReasonInput()
    document.querySelector<HTMLInputElement>('[data-cut-piece-release-field="riskReason"]')?.focus()
    return
  }
  state.saving = true
  refreshMatrix()
  try {
    const currentMatrixVersion = listCutPieceReleaseMatrixVersions(record.productionOrderId).at(-1)?.version ?? 0
    const result = await saveCutPieceReleaseAvailableQtyAction({ productionOrderId: record.productionOrderId, basisMatrixVersion: currentMatrixVersion,
      basisTargetVersion: target?.matrixVersion ?? 0, releaseQtyByColorSize, riskReason: state.riskReasonDraft.trim(), confirmedBy: '裁床主管 王敏', confirmedAt: localDateTimeText() })
    state.feedback = { tone: result.ok ? 'success' : 'error', message: result.message }
    if (result.ok) { state.releaseDraft = {}; state.riskReasonDraft = ''; state.releaseEditing = false }
  } catch (error) {
    state.feedback = { tone: 'error', message: `放行未保存：${error instanceof Error ? error.message : '保存失败'}；输入已保留，可重试。` }
  } finally {
    state.saving = false
    withCutPieceReleaseReadSnapshot(() => {
      refreshFeedback()
      refreshMatrix()
      refreshList()
    })
  }
}

export function buildCutPieceTicketValiditySaveInput(actionNode: Pick<HTMLElement, 'dataset'>, reason: string): Parameters<typeof saveCutPieceReleaseTicketValidityAction>[0] | null {
  // 使用打开详情时的版本；保存前重新读版本会掩盖其他标签页的更正。
  const versionText = actionNode.dataset.ticketValidityVersion
  if (!versionText || !/^\d+$/.test(versionText)) return null
  const expectedVersion = Number(versionText)
  if (!Number.isSafeInteger(expectedVersion)) return null
  return { ticketId: actionNode.dataset.ticketId || '', valid: actionNode.dataset.ticketValid === 'true', reason, operator: '裁床仓管 Siti', expectedVersion }
}

async function saveTicketValidity(actionNode: HTMLElement): Promise<void> {
  const ticketId = actionNode.dataset.ticketId || ''
  const ticketNo = actionNode.dataset.ticketNo || ticketId
  const valid = actionNode.dataset.ticketValid === 'true'
  const input = [...document.querySelectorAll<HTMLInputElement>('[data-cut-piece-release-field="ticketValidityReason"]')].find(node => node.dataset.ticketId === ticketId)
  const reason = (input?.value ?? state.validityReasons[ticketId] ?? '').trim()
  state.validityReasons[ticketId] = reason
  if (!reason) { state.feedback = { tone: 'error', message: `${ticketNo}：请填写整票${valid ? '恢复可用' : '不可用'}原因。` }; refreshFeedback(); input?.focus(); return }
  const saveInput = buildCutPieceTicketValiditySaveInput(actionNode, reason)
  if (!saveInput) { state.feedback = { tone: 'error', message: `${ticketNo}：登记版本无法读取，请重新打开详情。原因已保留。` }; refreshFeedback(); return }
  const record = getActiveRecord()
  const ticket = record?.matrix.colorGroups.flatMap(group => group.materialRows.flatMap(row => row.cells.flatMap(cell => cell.partCalculations.flatMap(part => part.ticketDetails)))).find(detail => detail.ticketId === ticketId)
  if (!record || !ticket) { state.feedback = { tone: 'error', message: `${ticketNo}：票据影响资料无法读取，请重新打开详情核对；原因已保留。` }; refreshFeedback(); return }
  if (!window.confirm(buildCutPieceTicketValidityConfirmation(ticket, record, valid))) return
  state.saving = true
  refreshOverlay()
  try {
    const result = await saveCutPieceReleaseTicketValidityAction(saveInput)
    state.feedback = { tone: result.ok ? 'success' : 'error', message: result.message }
    if (result.ok) delete state.validityReasons[ticketId]
  } catch (error) {
    state.feedback = { tone: 'error', message: `整票状态未保存：${error instanceof Error ? error.message : '保存失败'}；原因已保留，可重试。` }
  } finally {
    state.saving = false
    withCutPieceReleaseReadSnapshot(() => {
      refreshFeedback()
      refreshMatrix()
      refreshList()
      refreshOverlay()
    })
  }
}

function exportCurrentFilteredRecords(): void {
  const records = getFilteredRecords()
  const rows: Array<Array<string | number>> = [['生产单', '款式编号', '成衣颜色', '尺码', '目标（件）', '当前齐套（件）', '有效放行（件）', '已分配（件）', '可新增分配（件）', '当前风险（件）', '确认时风险（件）', '需特殊工艺（片）', '最终已回仓（片）', '未完成（片）', '加工完成待回仓（片）', '实收差异（片）', '有效放行版本', '放行类型', '数量变化']]
  records.forEach(record => {
    const target = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1)
    const release = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId).find(version => version.isLatestEffective)
    const readiness = getAllocationReadiness(record)
    record.matrix.colorGroups.forEach(group => sortReleaseSizeColumns(group.sizes).forEach(size => {
      const key = releaseTargetKey(group.garmentColor, size)
      const cells = getColorSizeCells(group, size)
      const sum = (field: 'specialCraftRequiredPieceQty' | 'specialCraftCompletedPieceQty' | 'specialCraftPendingPieceQty' | 'specialCraftAwaitingReturnPieceQty' | 'specialCraftDifferencePieceQty') => cells.reduce((total, cell) => total + (cell[field] ?? 0), 0)
      const allocation = readiness.lines.find(line => line.color === group.garmentColor && line.size === size)
      const qty = release?.releaseQtyByColorSize[key]
      const kit = group.completeKitBySize[size]
      rows.push([record.productionOrderNo, record.spuCode, group.garmentColor, size, target?.targetPreview.colorSizeTargets[key] ?? '未确认', kit ?? '待核对', qty ?? '未确认', allocation?.allocatedQty ?? 0,
        qty === undefined ? '未确认' : allocation?.availableQty ?? 0, qty === undefined ? '未确认' : kit === null ? '待核对' : Math.max(qty - kit, 0), release?.riskReleaseQtyByColorSize[key] ?? '未确认', sum('specialCraftRequiredPieceQty'), sum('specialCraftCompletedPieceQty'), sum('specialCraftPendingPieceQty'), sum('specialCraftAwaitingReturnPieceQty'), sum('specialCraftDifferencePieceQty'), release?.releaseVersionNo ?? '未确认', release?.releaseStatus ?? '未确认', record.requiresReview ? record.factChangeMessage || '数量已变化，请核对放行' : '与确认时一致'])
    }))
  })
  const csv = rows.map(row => row.map(value => {
    const text = String(value)
    const safe = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `裁片放行当前筛选-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  state.feedback = { tone: 'success', message: `已导出 ${records.length} 张生产单的已保存数量。` }
  refreshFeedback()
}

export function handleCraftCuttingCutPieceReleaseEvent(target: HTMLElement, event?: Event): boolean {
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  const dragEvent = event as (DragEvent & { higoodStandardListColumnKey?: string }) | undefined
  if (dragNode && dragEvent && ['dragstart', 'dragover', 'drop', 'dragend'].includes(dragEvent.type)) {
    const columnKey = dragNode.dataset.cutPieceReleaseColumnKey || dragNode.dataset.dragSource || dragNode.dataset.dropTarget || ''
    if (dragEvent.type === 'dragstart') {
      state.draggedColumnKey = columnKey
      return Boolean(columnKey)
    }
    if (dragEvent.type === 'dragend') {
      state.draggedColumnKey = ''
      return true
    }
    const sourceKey = dragEvent.higoodStandardListColumnKey || state.draggedColumnKey
    if (!sourceKey || !columnKey || sourceKey === columnKey) return false
    if (dragEvent.type === 'dragover') {
      dragEvent.preventDefault()
      return true
    }
    dragEvent.preventDefault()
    state.draggedColumnKey = ''
    const order = state.columnPreferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(columnKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    state.columnPreferences = normalizeListPreferences({ ...state.columnPreferences, order })
    saveListPreferences()
    refreshTable()
    refreshOverlay()
    return true
  }

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-cut-piece-release-field]')
  if (fieldNode && handleFieldChange(fieldNode)) return true

  const actionNode = target.closest<HTMLElement>('[data-cut-piece-release-action]')
  const action = actionNode?.dataset.cutPieceReleaseAction
  if (!actionNode || !action) return false
  if (action === 'field-change') return true

  if (state.saving && !['close-image', 'close-cell', 'close-history', 'close-overlay'].includes(action)) return true
  if (action === 'reread-migration') { refreshMigrationPanel(); return true }
  if (action === 'migrate-release') { void migrateReleaseData(); return true }
  if (action === 'open-target-candidates') {
    state.targetCandidateKey = releaseTargetKey(actionNode.dataset.cellColor || '', actionNode.dataset.cellSize || '')
    refreshMatrix()
    return true
  }
  if (action === 'cancel-target') {
    const record = getActiveRecord()
    if (record) {
      const snapshot = listCutPieceReleaseTargetSnapshots(record.productionOrderId).at(-1)
      state.targetMode = snapshot ? '确认' : '查看'
      state.targetDraft = snapshot ? { ...snapshot.targetPreview.colorSizeTargets } : {}
      state.targetBasisVersion = snapshot?.matrixVersion ?? state.currentMatrixVersion
      state.targetCandidateKey = null
      state.savedTargetSnapshot = snapshot ? { snapshotId: snapshot.snapshotId, matrixVersion: snapshot.matrixVersion,
        colorSizeTargets: { ...snapshot.targetPreview.colorSizeTargets }, hasShortage: buildSupplementPartShortages(snapshot.matrixSnapshot, snapshot.targetPreview).length > 0 } : null
      refreshMatrix()
    }
    return true
  }
  if (action === 'open-image') {
    const src = actionNode.dataset.imageSrc
    if (!src) return true
    state.imagePreview = { src, alt: actionNode.dataset.imageAlt || '业务图片', returnTestId: actionNode.dataset.testid || null }
    refreshOverlay()
    queueMicrotask(() => document.querySelector<HTMLElement>('[data-cut-piece-release-image-initial-focus]')?.focus())
    return true
  }
  if (action === 'close-image') {
    const returnTestId = state.imagePreview?.returnTestId ?? null
    state.imagePreview = null
    refreshOverlay()
    restoreOverlayTriggerFocus(returnTestId)
    return true
  }
  if (action === 'set-ticket-validity') {
    if (!state.saving) void saveTicketValidity(actionNode)
    return true
  }
  if (action === 'export') { exportCurrentFilteredRecords(); return true }
  if (action === 'query') {
    state.keyword = state.keywordDraft
    state.page = 1
    state.feedback = null
    refreshFeedback()
    refreshList()
    return true
  }
  if (action === 'reset') {
    state.keywordDraft = ''
    state.keyword = ''
    state.matrixStatus = '全部'
    state.targetStatus = '全部'
    state.releaseStatusFilter = '全部'
    state.factChangeFilter = '全部'
    state.page = 1
    state.feedback = null
    refreshFeedback()
    refreshFilters()
    refreshList()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    state.page += action === 'prev-page' ? -1 : 1
    refreshTableAndPagination()
    return true
  }
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = listColumns.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    state.sort = state.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.page = 1
    refreshTableAndPagination()
    return true
  }
  if (action === 'open-matrix') {
    const record = listCutPieceReleaseRecords().find((candidate) => candidate.recordId === actionNode.dataset.recordId)
    if (!record || typeof window === 'undefined') return true
    const params = new URLSearchParams({
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
    })
    const detailUrl = `${window.location.pathname}?${params.toString()}`
    const popup = window.open(detailUrl, '_blank', 'noopener,noreferrer')
    if (!popup) {
      state.feedback = { tone: 'warning', message: '浏览器阻止了新窗口，请允许弹出窗口后重试。' }
      refreshFeedback()
    }
    return true
  }
  if (action === 'start-target') {
    const record = getActiveRecord()
    if (!record) return true
    const latestVersion = listCutPieceReleaseMatrixVersions(record.productionOrderId).at(-1)?.version ?? null
    initializeTargetDraft(record)
    state.targetMode = '编辑'
    state.currentMatrixVersion = latestVersion
    state.targetBasisVersion = latestVersion
    state.targetCandidateKey = null
    state.feedback = null
    refreshFeedback()
    refreshMatrix()
    return true
  }
  if (action === 'select-target') {
    const garmentColor = actionNode.dataset.targetCandidateColor || ''
    const size = actionNode.dataset.targetCandidateSize || ''
    const quantity = Number(actionNode.dataset.targetCandidateQuantity)
    if (!garmentColor || !size || !Number.isFinite(quantity)) return true
    state.targetDraft[releaseTargetKey(garmentColor, size)] = quantity
    state.targetCandidateKey = null
    refreshMatrix()
    return true
  }
  if (action === 'confirm-target') {
    const record = getActiveRecord()
    if (!record) return true
    try {
      buildTargetPreview(record.matrix, state.targetDraft)
      state.targetMode = '确认'
      state.feedback = null
    } catch (error) {
      state.feedback = { tone: 'warning', message: error instanceof Error ? error.message : '请完成所有颜色尺码的目标选择。' }
    }
    refreshFeedback()
    refreshMatrix()
    return true
  }
  if (action === 'back-target-edit') {
    state.targetMode = '编辑'
    refreshMatrix()
    return true
  }
  if (action === 'save-target') {
    const record = getActiveRecord()
    if (record && !state.saving) void saveTargetDraft(record)
    return true
  }
  if (action === 'go-supplement') {
    const record = getActiveRecord()
    if (!record || !canUseSavedTargetSnapshot(record) || !state.savedTargetSnapshot) return true
    appStore.navigate(`/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=${encodeURIComponent(state.savedTargetSnapshot.snapshotId)}`)
    return true
  }
  if (action === 'open-cell') {
    state.overlayReturnTestId = actionNode.dataset.testid || null
    state.historyOpen = false
    state.expandedHistoryVersion = null
    state.activeCell = {
      garmentColor: actionNode.dataset.cellColor || '',
      size: actionNode.dataset.cellSize || '',
      materialId: actionNode.dataset.cellMaterialId || '',
    }
    state.drawerMaterialFilter = state.activeCell.materialId
    state.drawerPartFilter = ''
    state.drawerTicketFilter = '全部'
    refreshOverlay()
    focusOverlayInitialControl()
    return true
  }
  if (action === 'close-cell') {
    const returnTestId = state.overlayReturnTestId
    state.activeCell = null
    state.overlayReturnTestId = null
    refreshOverlay()
    restoreOverlayTriggerFocus(returnTestId)
    return true
  }
  if (action === 'open-history') {
    state.overlayReturnTestId = actionNode.dataset.testid || null
    state.activeCell = null
    state.historyOpen = true
    state.historyPage = 1
    state.expandedHistoryVersion = null
    refreshOverlay()
    focusOverlayInitialControl()
    return true
  }
  if (action === 'close-history') {
    const returnTestId = state.overlayReturnTestId
    state.historyOpen = false
    state.expandedHistoryVersion = null
    state.overlayReturnTestId = null
    refreshOverlay()
    restoreOverlayTriggerFocus(returnTestId)
    return true
  }
  if (action === 'history-prev' || action === 'history-next') {
    state.historyPage += action === 'history-prev' ? -1 : 1
    state.expandedHistoryVersion = null
    refreshHistoryContent(action)
    return true
  }
  if (action === 'toggle-history-version') {
    const version = Number(actionNode.dataset.historyVersion)
    if (!Number.isInteger(version)) return true
    state.expandedHistoryVersion = state.expandedHistoryVersion === version ? null : version
    refreshHistoryContent(action, version)
    return true
  }
  if (action === 'open-column-settings') {
    state.columnSettingsOpen = true
    refreshOverlay()
    return true
  }
  if (action === 'close-column-settings' || action === 'close-overlay') {
    const returnTestId = state.overlayReturnTestId
    state.columnSettingsOpen = false
    state.activeCell = null
    state.historyOpen = false
    state.expandedHistoryVersion = null
    state.overlayReturnTestId = null
    refreshOverlay()
    restoreOverlayTriggerFocus(returnTestId)
    return true
  }
  if (action === 'toggle-column-visibility') {
    const columnKey = actionNode.dataset.cutPieceReleaseColumnKey || actionNode.dataset.columnKey || ''
    const rule = listColumnRules.find((item) => item.key === columnKey)
    if (!rule || rule.required || rule.actionColumn || !(actionNode instanceof HTMLInputElement)) return true
    const visibleKeys = new Set(state.columnPreferences.visibleKeys)
    const frozenKeys = new Set(state.columnPreferences.frozenKeys)
    if (actionNode.checked) visibleKeys.add(columnKey)
    else {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    }
    state.columnPreferences = normalizeListPreferences({
      ...state.columnPreferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    })
    if (!visibleKeys.has(columnKey) && state.sort?.key === columnKey) state.sort = null
    saveListPreferences()
    refreshTable()
    refreshOverlay()
    return true
  }
  if (action === 'toggle-column-freeze') {
    const columnKey = actionNode.dataset.cutPieceReleaseColumnKey || actionNode.dataset.columnKey || ''
    const column = listColumns.find((item) => item.key === columnKey)
    if (!column?.freezeable || column.actionColumn || !(actionNode instanceof HTMLInputElement)) return true
    const frozenKeys = new Set(state.columnPreferences.frozenKeys)
    if (actionNode.checked) frozenKeys.add(columnKey)
    else frozenKeys.delete(columnKey)
    const nextPreferences = normalizeListPreferences({ ...state.columnPreferences, frozenKeys: [...frozenKeys] })
    state.feedback = actionNode.checked && !nextPreferences.frozenKeys.includes(columnKey)
      ? { tone: 'warning', message: '冻结列过宽，请取消其他冻结列。' }
      : null
    state.columnPreferences = nextPreferences
    saveListPreferences()
    refreshFeedback()
    refreshTable()
    refreshOverlay()
    return true
  }
  if (action === 'restore-column-settings') {
    state.columnPreferences = normalizeListPreferences(defaultListColumnPreferences)
    state.page = 1
    state.sort = null
    state.feedback = null
    const storage = getListStorage()
    if (storage) clearListColumnPreferences(storage, listStorageKey)
    refreshFeedback()
    refreshTableAndPagination()
    refreshOverlay()
    return true
  }
  if (action === 'confirm-release' || action === 'maintain-release') {
    const record = getActiveRecord()
    if (record && !state.saving) void saveReleaseDraft(record, action === 'maintain-release')
    return true
  }
  if (action === 'adjust-release' || action === 'cancel-release-edit') {
    state.releaseEditing = action === 'adjust-release'
    state.releaseDraft = {}
    state.riskReasonDraft = ''
    refreshMatrix()
    if (state.releaseEditing) queueMicrotask(() => document.querySelector<HTMLInputElement>('[data-cut-piece-release-field="releaseQtyInput"]:not([disabled])')?.focus())
    return true
  }
  if (action === 'open-release-version-log') {
    state.releaseVersionLogOpen = !state.releaseVersionLogOpen
    state.releaseVersionLogPage = 1
    refreshMatrix()
    return true
  }
  if (action === 'release-version-log-prev' || action === 'release-version-log-next') {
    state.releaseVersionLogPage += action === 'release-version-log-prev' ? -1 : 1
    refreshMatrix()
    return true
  }
  return false
}

export function isCraftCuttingCutPieceReleaseDialogOpen(): boolean {
  return state.columnSettingsOpen || Boolean(state.activeCell) || state.historyOpen || Boolean(state.imagePreview)
}
