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
  listCutPieceReleaseRecords,
  type CutPieceReleaseRecord,
} from '../../../data/fcs/cut-piece-release.ts'
import type {
  MatrixCalculationStatus,
  MatrixTargetStatus,
} from '../../../data/fcs/cut-piece-release-domain.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'

type MatrixStatusFilter = '全部' | MatrixCalculationStatus
type TargetStatusFilter = '全部' | MatrixTargetStatus
type TargetMode = '查看' | '编辑'

interface CutPieceReleaseFeedback {
  tone: 'success' | 'warning'
  message: string
}

interface CutPieceReleaseActiveCell {
  garmentColor: string
  size: string
  materialId: string
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
  activeCell: CutPieceReleaseActiveCell | null
  historyOpen: boolean
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
  activeCell: null,
  historyOpen: false,
  feedback: null,
}

let listPreferencesLoaded = false

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
      >打开矩阵</button>
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

function renderListOverlay(): string {
  if (!state.columnSettingsOpen) return ''
  return withSkipPageRerender(renderStandardListColumnSettings({
    title: '列设置',
    columns: listColumns,
    preferences: state.columnPreferences,
    eventPrefix: 'cut-piece-release',
    maxFrozenWidth: listMaxFrozenWidth,
  }))
}

function setListRegion(region: string, html: string): void {
  if (typeof document === 'undefined') return
  const element = document.querySelector<HTMLElement>(`[data-cut-piece-release-region="${region}"]`)
  if (element) {
    element.innerHTML = html
    hydrateIcons(element)
  }
}

function refreshFeedback(): void {
  setListRegion('feedback', renderFeedback())
}

function refreshFilters(): void {
  setListRegion('filters', renderFilters())
}

function refreshList(): void {
  const view = getListView()
  setListRegion('stats', renderListStats(view.filtered))
  setListRegion('table', renderListTable(view.paging))
  setListRegion('pagination', renderListPagination(view.paging))
}

function refreshTableAndPagination(): void {
  const view = getListView()
  setListRegion('table', renderListTable(view.paging))
  setListRegion('pagination', renderListPagination(view.paging))
}

function refreshTable(): void {
  setListRegion('table', renderListTable(getListView().paging))
}

function refreshOverlay(): void {
  setListRegion('overlay', renderListOverlay())
}

export function renderCraftCuttingCutPieceReleasePage(): string {
  ensureListPreferences()
  const hasMountedPageRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector('[data-cut-piece-release-page]'))
  if (!hasMountedPageRoot) {
    state.page = 1
    state.sort = null
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
    overlaysHtml: `<div data-cut-piece-release-region="overlay">${renderListOverlay()}</div>`,
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
    state.activeCell = null
    state.historyOpen = false
    const productionOrderNo = listCutPieceReleaseRecords()
      .find((record) => record.recordId === state.activeRecordId)?.productionOrderNo
    state.feedback = {
      tone: 'success',
      message: productionOrderNo ? `已选中生产单 ${productionOrderNo} 的裁片矩阵。` : '已选中裁片矩阵。',
    }
    refreshFeedback()
    return true
  }
  if (action === 'open-column-settings') {
    state.columnSettingsOpen = true
    refreshOverlay()
    return true
  }
  if (action === 'close-column-settings' || action === 'close-overlay') {
    state.columnSettingsOpen = false
    refreshOverlay()
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
  return state.columnSettingsOpen
}
