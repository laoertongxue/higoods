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
import {
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import {
  confirmCutPieceReleaseTarget,
  getCutPieceReleaseRecord,
  listCutPieceReleaseMatrixVersions,
  listCutPieceReleaseRecords,
  type CutPieceReleaseRecord,
  type CutPieceReleaseMatrixVersion,
} from '../../../data/fcs/cut-piece-release.ts'
import type {
  MatrixCalculationStatus,
  MatrixTargetStatus,
  ReleaseColorGroup,
  ReleaseMatrixCell,
  ReleaseTargetDifference,
} from '../../../data/fcs/cut-piece-release-domain.ts'
import { buildSupplementPartShortages, buildTargetPreview } from '../../../data/fcs/cut-piece-release-domain.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'

type MatrixStatusFilter = '全部' | MatrixCalculationStatus
type TargetStatusFilter = '全部' | MatrixTargetStatus
type TargetMode = '查看' | '编辑' | '确认'

interface CutPieceReleaseFeedback {
  tone: 'success' | 'warning'
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
  overlayReturnTestId: string | null
  feedback: CutPieceReleaseFeedback | null
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
  { key: 'shortage' },
  { key: 'frozenCutOrders' },
  { key: 'latestUpdate', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]
const defaultListColumnPreferences: StandardListColumnPreferences = {
  order: listColumnRules.map((column) => column.key),
  visibleKeys: listColumnRules.map((column) => column.key),
  frozenKeys: [],
  pageSize: 10,
}

const state: CutPieceReleasePageState = {
  keywordDraft: '',
  keyword: '',
  matrixStatus: '全部',
  targetStatus: '全部',
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
  overlayReturnTestId: null,
  feedback: null,
}

let listPreferencesLoaded = false
let scopedEscapeListenerInstalled = false

function resetTransientPageState(): void {
  state.keywordDraft = ''
  state.keyword = ''
  state.matrixStatus = '全部'
  state.targetStatus = '全部'
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
  state.overlayReturnTestId = null
  state.feedback = null
}

function ensureScopedEscapeListener(): void {
  if (scopedEscapeListenerInstalled || typeof document === 'undefined') return
  scopedEscapeListenerInstalled = true
  document.addEventListener('keydown', (event) => {
    if (
      event.key !== 'Escape'
      || !document.querySelector('[data-cut-piece-release-page]')
      || !isCraftCuttingCutPieceReleaseDialogOpen()
    ) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cutPieceReleaseAction = 'close-overlay'
    handleCraftCuttingCutPieceReleaseEvent(fakeButton)
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

function renderColorSizeSummary(record: CutPieceReleaseRecord): string {
  return record.matrix.colorGroups.map((group) => {
    const sizes = group.sizes.map((size) => {
      const completeKitQty = group.completeKitBySize[size]
      const quantity = completeKitQty === null ? '待计算' : `${formatQuantity(completeKitQty)} 件`
      return `${size} ${quantity}`
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
      <div class="font-medium">${escapeHtml(record.spuCode)}</div>
      <div class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div>
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
      <button
        type="button"
        class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        data-cut-piece-release-action="open-matrix"
        data-record-id="${escapeHtml(record.recordId)}"
        data-production-order-id="${escapeHtml(record.productionOrderId)}"
        aria-label="打开矩阵，查看矩阵"
      >查看矩阵</button>
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
  const targetStatuses: TargetStatusFilter[] = ['全部', '待确认', '已确认', '目标后数据已变化']
  return `
    <section class="rounded-lg border bg-card p-3">
      <div class="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px_190px_auto_auto] md:items-end">
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
        <button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cut-piece-release-action="query">查询</button>
        <button type="button" class="h-9 rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-release-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderFeedback(): string {
  if (!state.feedback) return ''
  const className = state.feedback.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<div class="rounded-md border px-3 py-2 text-sm ${className}">${escapeHtml(state.feedback.message)}</div>`
}

function renderListStats(records: CutPieceReleaseRecord[]): string {
  return renderStandardListStats([
    { label: '生产单', value: `${records.length} 张` },
    { label: '矩阵可计算', value: `${records.filter((record) => record.matrixStatus === '可计算').length} 张` },
    { label: '目标待确认', value: `${records.filter((record) => record.targetStatus !== '已确认').length} 张` },
    { label: '存在补料缺口', value: `${records.filter((record) => record.shortageCellCount > 0).length} 张` },
  ])
}

function renderListTable(paging: StandardListPageSlice<CutPieceReleaseRecord>): string {
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
  if (Object.keys(state.targetDraft).length === 0) return []
  try {
    return buildTargetPreview(record.matrix, state.targetDraft).differences
  } catch {
    return []
  }
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
  if (state.targetMode !== '编辑') return ''
  const candidates = new Map<number, string>()
  group.materialRows.forEach((row) => {
    const quantity = row.cells.find((cell) => cell.size === size)?.availableGarmentQty
    if (quantity !== null && quantity !== undefined && !candidates.has(quantity)) candidates.set(quantity, row.materialId)
  })
  const selected = state.targetDraft[releaseTargetKey(group.garmentColor, size)]
  return `
    <div class="mt-2 flex min-w-[140px] flex-wrap justify-center gap-1" aria-label="${escapeHtml(`${group.garmentColor} ${size} 目标候选`)}">
      ${[...candidates.entries()].map(([quantity, materialId]) => `
        <button
          type="button"
          class="rounded border px-2 py-1 text-xs font-medium ${selected === quantity ? 'border-yellow-500 bg-yellow-100 text-yellow-900 ring-1 ring-yellow-400' : 'bg-background hover:bg-muted'}"
          data-skip-page-rerender="true"
          data-cut-piece-release-action="select-target"
          data-target-candidate-color="${escapeHtml(group.garmentColor)}"
          data-target-candidate-size="${escapeHtml(size)}"
          data-target-candidate-quantity="${quantity}"
          data-testid="candidate-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}-${escapeHtml(materialId)}"
          aria-pressed="${selected === quantity ? 'true' : 'false'}"
        >${formatQuantity(quantity)} 件${selected === quantity ? ' · 已选' : ''}</button>
      `).join('')}
    </div>
  `
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
  const quantity = cell.availableGarmentQty === null ? '待计算' : `${formatQuantity(cell.availableGarmentQty)} 件`
  return `
    <td class="border-b border-r p-2 text-center align-middle">
      <button
        type="button"
        class="mx-auto min-h-[58px] w-full min-w-[140px] rounded-md px-2 py-1.5 text-sm tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${visual.className}"
        data-skip-page-rerender="true"
        data-cut-piece-release-action="open-cell"
        data-record-id="${escapeHtml(record.recordId)}"
        data-cell-color="${escapeHtml(group.garmentColor)}"
        data-cell-size="${escapeHtml(size)}"
        data-cell-material-id="${escapeHtml(materialId)}"
        data-testid="cell-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}-${escapeHtml(materialId)}"
        aria-label="${escapeHtml(`${group.garmentColor} ${size} ${materialId}，${quantity}，查看部位计算`)}"
      >
        <span class="block font-semibold">${escapeHtml(quantity)}</span>
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
          <p class="text-xs text-muted-foreground">当前齐套是现在可保证的最低成衣数；目标仅作为补料计算基准。</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">${group.materialRows.length} 种必需物料</span>
      </div>
      <div class="max-w-full overflow-x-auto rounded-lg border" data-cut-piece-release-matrix-scroll>
        <table class="min-w-[1120px] w-full border-collapse text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="w-[260px] border-b border-r px-3 py-2 text-left">物料</th>
              ${group.sizes.map((size) => `<th class="border-b border-r px-3 py-2 text-center">${escapeHtml(size)}${renderTargetCandidates(group, size)}</th>`).join('')}
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
              return `
                <tr>
                  <th class="border-b border-r px-3 py-3 text-left font-medium">${escapeHtml(displayMaterialName(row.materialId, row.materialName))}</th>
                  ${group.sizes.map((size) => {
                    const cell = row.cells.find((item) => item.size === size)!
                    return renderMatrixCell(record, group, row.materialId, size, cell, differenceByCell.get(`${group.garmentColor}::${size}::${row.materialId}`))
                  }).join('')}
                  <td class="border-b px-3 py-2 text-xs ${frozen ? 'bg-slate-100 font-medium text-slate-700' : 'text-emerald-700'}">${frozen ? '已冻结，不再更新' : '持续更新'}</td>
                </tr>
              `
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 font-bold">
              <th class="border-r px-3 py-3 text-left">当前齐套数量</th>
              ${group.sizes.map((size) => `<td class="border-r px-3 py-3 text-center text-base tabular-nums" data-testid="complete-kit-${escapeHtml(group.garmentColor)}-${escapeHtml(size)}">${group.completeKitBySize[size] === null ? '待计算' : `${formatQuantity(group.completeKitBySize[size]!)} 件`}</td>`).join('')}
              <td class="px-3 py-3 text-xs font-medium">车缝最低回货依据</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  `
}

function initializeTargetDraft(record: CutPieceReleaseRecord): void {
  state.targetDraft = Object.fromEntries(record.matrix.colorGroups.flatMap((group) => group.sizes.map((size) => [
    releaseTargetKey(group.garmentColor, size),
    group.completeKitBySize[size] ?? 0,
  ])))
}

function areTargetSelectionsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left)
  return leftEntries.length === Object.keys(right).length
    && leftEntries.every(([key, value]) => right[key] === value)
}

function canUseSavedTargetSnapshot(record: CutPieceReleaseRecord): boolean {
  const saved = state.savedTargetSnapshot
  if (!saved || !saved.hasShortage || state.targetMode !== '确认') return false
  if (state.targetBasisVersion !== saved.matrixVersion) return false
  if (!areTargetSelectionsEqual(state.targetDraft, saved.colorSizeTargets)) return false
  return !listCutPieceReleaseMatrixVersions(record.productionOrderId).some((version) => (
    version.version > saved.matrixVersion && version.eventType !== '目标确认'
  ))
}

function renderTargetSummary(record: CutPieceReleaseRecord): string {
  if (state.targetMode !== '确认') return ''
  const differences = getTargetDifferences(record)
  const counts = {
    shortage: differences.filter((item) => item.status === '需补').length,
    exact: differences.filter((item) => item.status === '刚好').length,
    surplus: differences.filter((item) => item.status === '多余').length,
  }
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4" data-testid="cut-piece-release-target-summary">
      <h3 class="font-semibold">确认目标</h3>
      <div class="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        ${record.matrix.colorGroups.flatMap((group) => group.sizes.map((size) => `<div class="rounded bg-white px-3 py-2">${escapeHtml(group.garmentColor)} / ${escapeHtml(size)}：<strong>${formatQuantity(state.targetDraft[releaseTargetKey(group.garmentColor, size)] ?? 0)} 件</strong></div>`)).join('')}
      </div>
      <div class="mt-3 flex flex-wrap gap-3 text-sm">
        <span class="font-medium text-rose-600">需补 ${counts.shortage} 个物料点</span>
        <span class="font-medium text-yellow-800">刚好 ${counts.exact} 个物料点</span>
        <span class="font-medium text-emerald-600">多余 ${counts.surplus} 个物料点</span>
        <span class="font-medium text-slate-700">目标依据版本 V${state.targetBasisVersion ?? 0}</span>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="rounded-md border bg-white px-4 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="back-target-edit">返回修改</button>
        ${canUseSavedTargetSnapshot(record)
          ? '<button type="button" class="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700" data-skip-page-rerender="true" data-cut-piece-release-action="go-supplement">去补料管理</button>'
          : ''}
        <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-cut-piece-release-action="save-target">保存目标</button>
      </div>
    </section>
  `
}

function renderMatrixPanel(): string {
  const record = getActiveRecord()
  if (!record) return ''
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4" data-cut-piece-release-matrix-panel>
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">${escapeHtml(record.productionOrderNo)} 裁片放行矩阵</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.spuCode)} · ${escapeHtml(record.spuName)} · 当前版本 V${state.currentMatrixVersion ?? 0}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-release-action="open-history" data-testid="cut-piece-release-open-history">查看更新历史</button>
          ${state.targetMode === '查看'
            ? '<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-cut-piece-release-action="start-target">选择目标</button>'
            : state.targetMode === '编辑'
              ? '<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-skip-page-rerender="true" data-cut-piece-release-action="confirm-target">确认目标</button>'
              : ''}
        </div>
      </header>
      ${record.matrix.colorGroups.map((group) => renderColorMatrix(record, group)).join('')}
      ${renderTargetSummary(record)}
    </section>
  `
}

function renderCellDrawer(record: CutPieceReleaseRecord): string {
  if (!state.activeCell) return ''
  const group = record.matrix.colorGroups.find((item) => item.garmentColor === state.activeCell!.garmentColor)
  const row = group?.materialRows.find((item) => item.materialId === state.activeCell!.materialId)
  const cell = row?.cells.find((item) => item.size === state.activeCell!.size)
  if (!group || !row || !cell) return ''
  const sourceCutOrderNo = cell.sourceStatus === '已冻结'
    ? record.sourceCutOrderNos.find((item) => item.endsWith('-B')) ?? record.sourceCutOrderNos[0]
    : record.sourceCutOrderNos[0]
  return `
    <div class="fixed inset-0 z-50" data-testid="cut-piece-release-cell-drawer">
      <button type="button" class="absolute inset-0 w-full bg-black/45" aria-label="点击空白处返回" data-skip-page-rerender="true" data-cut-piece-release-action="close-cell"></button>
      <aside class="absolute inset-y-0 right-0 w-full max-w-[560px] overflow-y-auto border-l bg-background shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cut-piece-release-cell-drawer-title">
        <header class="sticky top-0 flex items-center justify-between border-b bg-background px-5 py-4">
          <div><h2 class="text-lg font-semibold" id="cut-piece-release-cell-drawer-title">裁片部位计算</h2><p class="text-sm text-muted-foreground">${escapeHtml(`${group.garmentColor} / ${state.activeCell.size} / ${displayMaterialName(row.materialId, row.materialName)}`)}</p></div>
          <button type="button" class="rounded-md border px-3 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="close-cell" data-cut-piece-release-overlay-initial-focus>关闭部位详情</button>
        </header>
        <div class="space-y-3 p-5">
          ${cell.partCalculations.map((part) => `
            <article class="rounded-lg border p-4">
              <div class="font-medium">${escapeHtml(part.partName)}</div>
              <div class="mt-2 text-base font-semibold tabular-nums">${formatQuantity(part.actualPieceQty)} 片 ÷ ${formatQuantity(part.piecesPerGarment)} 片/件 = ${part.availableGarmentQty === null ? '待计算' : `${formatQuantity(part.availableGarmentQty)} 件`}</div>
              <div class="mt-2 text-xs text-muted-foreground">来源裁片单：${escapeHtml(sourceCutOrderNo ?? '未关联')} · 事实 ${escapeHtml(part.sourceFactIds.join('、'))}</div>
            </article>
          `).join('')}
        </div>
      </aside>
    </div>
  `
}

function renderHistoryDrawer(record: CutPieceReleaseRecord): string {
  if (!state.historyOpen) return ''
  const versions = listCutPieceReleaseMatrixVersions(record.productionOrderId).slice().reverse()
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(versions.length / pageSize))
  state.historyPage = Math.min(Math.max(1, state.historyPage), totalPages)
  const rows = versions.slice((state.historyPage - 1) * pageSize, state.historyPage * pageSize)
  const sourceText = (version: CutPieceReleaseMatrixVersion) => [version.cutOrderNo, version.spreadingOrderNo].filter(Boolean).join(' / ')
  return `
    <div class="fixed inset-0 z-50" data-testid="cut-piece-release-history-drawer">
      <button type="button" class="absolute inset-0 w-full bg-black/45" aria-label="点击空白处返回" data-skip-page-rerender="true" data-cut-piece-release-action="close-history"></button>
      <aside class="absolute inset-y-0 right-0 w-full max-w-[720px] overflow-y-auto border-l bg-background shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cut-piece-release-history-drawer-title">
        <header class="sticky top-0 flex items-center justify-between border-b bg-background px-5 py-4">
          <div><h2 class="text-lg font-semibold" id="cut-piece-release-history-drawer-title">矩阵更新历史</h2><p class="text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 所有事件均保留版本快照</p></div>
          <button type="button" class="rounded-md border px-3 py-2 text-sm" data-skip-page-rerender="true" data-cut-piece-release-action="close-history" data-cut-piece-release-overlay-initial-focus>关闭更新历史</button>
        </header>
        <div class="space-y-3 p-5">
          ${rows.map((version) => `
            <article class="rounded-lg border p-4">
              <div class="flex items-center justify-between gap-3"><strong>V${version.version} · ${escapeHtml(version.eventType)}</strong><span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(version.occurredAt))}</span></div>
              <div class="mt-2 text-sm">操作人：${escapeHtml(version.operator)}</div>
              ${version.reason ? `<div class="mt-1 text-sm text-muted-foreground">原因：${escapeHtml(version.reason)}</div>` : ''}
              ${sourceText(version) ? `<div class="mt-1 text-sm text-muted-foreground">来源：${escapeHtml(sourceText(version))}</div>` : ''}
            </article>
          `).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无更新历史</div>'}
          <footer class="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
            <span>第 ${state.historyPage} / ${totalPages} 页 · 每页 ${pageSize} 条 · 共 ${versions.length} 条</span>
            <div class="flex gap-2">
              <button type="button" class="rounded border px-3 py-1.5 disabled:opacity-40" ${state.historyPage <= 1 ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="history-prev">上一页</button>
              <button type="button" class="rounded border px-3 py-1.5 disabled:opacity-40" ${state.historyPage >= totalPages ? 'disabled' : ''} data-skip-page-rerender="true" data-cut-piece-release-action="history-next">下一页</button>
            </div>
          </footer>
        </div>
      </aside>
    </div>
  `
}

function renderBusinessOverlays(): string {
  const record = getActiveRecord()
  return record ? `${renderCellDrawer(record)}${renderHistoryDrawer(record)}` : ''
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
  setReleaseRegion('overlay', renderListOverlay())
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
  ensureScopedEscapeListener()
  ensureListPreferences()
  const hasMountedPageRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector('[data-cut-piece-release-page]'))
  if (!hasMountedPageRoot) {
    resetTransientPageState()
  }
  const view = getListView()
  const columnSettingsButton = withSkipPageRerender(renderSecondaryButton(
    '列设置',
    { prefix: 'cut-piece-release', action: 'open-column-settings' },
    'columns-3',
  ))
  return renderStandardListPage({
    title: '裁片放行管理',
    feedbackHtml: `<div data-cut-piece-release-region="feedback">${renderFeedback()}</div>`,
    filtersHtml: `<div data-cut-piece-release-region="filters">${renderFilters()}</div>`,
    statsHtml: `<div data-cut-piece-release-region="stats">${renderListStats(view.filtered)}</div>`,
    listTitle: '生产单裁片矩阵',
    listActionsHtml: columnSettingsButton,
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
    state.activeRecordId = actionNode.dataset.recordId || null
    state.activeColor = null
    state.targetMode = '查看'
    state.targetDraft = {}
    state.currentMatrixVersion = null
    state.targetBasisVersion = null
    state.savedTargetSnapshot = null
    state.activeCell = null
    state.historyOpen = false
    state.historyPage = 1
    const record = getActiveRecord()
    state.activeColor = record?.matrix.colorGroups[0]?.garmentColor ?? null
    const latestVersion = record
      ? listCutPieceReleaseMatrixVersions(record.productionOrderId).at(-1)?.version ?? null
      : null
    state.currentMatrixVersion = latestVersion
    state.targetBasisVersion = latestVersion
    const productionOrderNo = listCutPieceReleaseRecords()
      .find((record) => record.recordId === state.activeRecordId)?.productionOrderNo
    state.feedback = {
      tone: 'success',
      message: productionOrderNo ? `已选中生产单 ${productionOrderNo} 的裁片矩阵。` : '已选中裁片矩阵。',
    }
    refreshFeedback()
    refreshMatrix()
    return true
  }
  if (action === 'start-target') {
    const record = getActiveRecord()
    if (!record) return true
    initializeTargetDraft(record)
    state.targetMode = '编辑'
    state.savedTargetSnapshot = null
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
    state.savedTargetSnapshot = null
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
    state.savedTargetSnapshot = null
    refreshMatrix()
    return true
  }
  if (action === 'save-target') {
    const record = getActiveRecord()
    if (!record || state.targetBasisVersion === null) return true
    const versionsBeforeSave = listCutPieceReleaseMatrixVersions(record.productionOrderId)
    state.currentMatrixVersion = versionsBeforeSave.at(-1)?.version ?? state.currentMatrixVersion
    const hasNewBusinessFact = versionsBeforeSave.some((version) => (
      version.version > state.targetBasisVersion!
      && version.eventType !== '目标确认'
    ))
    if (hasNewBusinessFact) {
      state.savedTargetSnapshot = null
      state.feedback = { tone: 'warning', message: '当前裁片矩阵版本已变化，请刷新后重新确认目标。' }
      refreshFeedback()
      refreshList()
      refreshMatrix()
      return true
    }
    const result = confirmCutPieceReleaseTarget({
      productionOrderId: record.productionOrderId,
      matrixVersion: state.targetBasisVersion,
      colorSizeTargets: { ...state.targetDraft },
      confirmedBy: '裁床文员 Siti',
    })
    if (result.snapshot) {
      state.targetBasisVersion = result.snapshot.matrixVersion
      state.savedTargetSnapshot = {
        snapshotId: result.snapshot.snapshotId,
        matrixVersion: result.snapshot.matrixVersion,
        colorSizeTargets: { ...result.snapshot.targetPreview.colorSizeTargets },
        hasShortage: buildSupplementPartShortages(
          result.snapshot.matrixSnapshot,
          result.snapshot.targetPreview,
        ).length > 0,
      }
    } else {
      state.savedTargetSnapshot = null
    }
    state.currentMatrixVersion = listCutPieceReleaseMatrixVersions(record.productionOrderId).at(-1)?.version
      ?? state.currentMatrixVersion
    state.feedback = result.ok
      ? {
          tone: 'success',
          message: result.message.includes('返回原目标快照')
            ? '目标已按当前矩阵版本保存，可安全重复提交'
            : '目标已按当前矩阵版本保存',
        }
      : { tone: 'warning', message: result.message }
    refreshFeedback()
    refreshList()
    refreshMatrix()
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
    state.activeCell = {
      garmentColor: actionNode.dataset.cellColor || '',
      size: actionNode.dataset.cellSize || '',
      materialId: actionNode.dataset.cellMaterialId || '',
    }
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
    refreshOverlay()
    focusOverlayInitialControl()
    return true
  }
  if (action === 'close-history') {
    const returnTestId = state.overlayReturnTestId
    state.historyOpen = false
    state.overlayReturnTestId = null
    refreshOverlay()
    restoreOverlayTriggerFocus(returnTestId)
    return true
  }
  if (action === 'history-prev' || action === 'history-next') {
    state.historyPage += action === 'history-prev' ? -1 : 1
    refreshOverlay()
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
      ? { tone: 'warning', message: `冻结列总宽度不能超过 ${listMaxFrozenWidth}px，请先取消其他冻结列。` }
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
  return false
}

export function isCraftCuttingCutPieceReleaseDialogOpen(): boolean {
  return state.columnSettingsOpen || Boolean(state.activeCell) || state.historyOpen
}
