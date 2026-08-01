// @page-pattern: list

import { renderSecondaryButton } from '../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../components/ui/list-table.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import type { EngineeringMasterStatus } from '../data/pcs-engineering-master-types.ts'
import {
  buildEngineeringMasterListRows,
  ensureEngineeringMasterDemoData,
  type EngineeringMasterListRow,
} from '../data/pcs-engineering-master-view-model.ts'
import { escapeHtml } from '../utils.ts'

const MASTER_LIST_STORAGE_KEY = 'higood-pcs-engineering-master-list-preferences-v1'
const MASTER_LIST_PAGE_SIZES = [10, 20, 50]
const MASTER_LIST_MAX_FROZEN_WIDTH = 320
const MASTER_EVENT_PREFIX = 'pcs-engineering-master'

const MASTER_STATUS_TONES: Record<EngineeringMasterStatus, string> = {
  草稿: 'bg-slate-100 text-slate-700',
  已发布: 'bg-blue-100 text-blue-700',
  进行中: 'bg-amber-100 text-amber-700',
  技术包审核中: 'bg-purple-100 text-purple-700',
  待关闭: 'bg-orange-100 text-orange-700',
  已关闭: 'bg-emerald-100 text-emerald-700',
  已终止: 'bg-red-100 text-red-700',
}

const MASTER_STATUS_OPTIONS: EngineeringMasterStatus[] = [
  '草稿',
  '已发布',
  '进行中',
  '技术包审核中',
  '待关闭',
  '已关闭',
  '已终止',
]

interface MasterListUiState {
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  sort: StandardListSortState | null
  columnSettingsOpen: boolean
  draggedColumnKey: string
  search: string
  statusFilter: string
  currentPage: number
}

const masterListUiState: MasterListUiState = {
  preferences: {
    order: ['masterOrderCode', 'style', 'merchandiser', 'status', 'currentStage', 'progress', 'updatedAt', 'actions'],
    visibleKeys: ['masterOrderCode', 'style', 'merchandiser', 'status', 'currentStage', 'progress', 'updatedAt', 'actions'],
    frozenKeys: [],
    pageSize: MASTER_LIST_PAGE_SIZES[0],
  },
  preferencesLoaded: false,
  sort: null,
  columnSettingsOpen: false,
  draggedColumnKey: '',
  search: '',
  statusFilter: '',
  currentPage: 1,
}

const MASTER_LIST_COLUMN_RULES = [
  { key: 'masterOrderCode', required: true, freezeable: true },
  { key: 'style', required: true, freezeable: true },
  { key: 'merchandiser' },
  { key: 'status', required: true },
  { key: 'currentStage' },
  { key: 'progress' },
  { key: 'updatedAt', freezeable: true },
  { key: 'actions', actionColumn: true },
]

function renderMasterStatusBadge(status: EngineeringMasterStatus): string {
  const tone = MASTER_STATUS_TONES[status] ?? 'bg-slate-100 text-slate-700'
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

const MASTER_LIST_COLUMNS: StandardListColumn<EngineeringMasterListRow>[] = [
  {
    key: 'masterOrderCode',
    title: '主单号',
    width: 110,
    required: true,
    freezeable: true,
    sortable: true,
    render: (row) => `
      <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/engineering/masters/${escapeHtml(row.masterOrderId)}">${escapeHtml(row.masterOrderCode)}</button>
    `,
    sortValue: (row) => row.masterOrderCode,
  },
  {
    key: 'style',
    title: '款式',
    width: 240,
    required: true,
    freezeable: true,
    render: (row) => `
      <p class="font-medium">${escapeHtml(row.styleName)}</p>
      <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(row.styleCode)}</p>
    `,
    sortValue: (row) => `${row.styleName} ${row.styleCode}`,
  },
  {
    key: 'merchandiser',
    title: '负责人',
    width: 100,
    render: (row) => `<span>${escapeHtml(row.merchandiserName)}</span>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    required: true,
    render: (row) => renderMasterStatusBadge(row.status),
  },
  {
    key: 'currentStage',
    title: '当前阶段',
    width: 150,
    render: (row) => `<span class="text-sm">${escapeHtml(row.currentStage)}</span>`,
  },
  {
    key: 'progress',
    title: '进度',
    width: 90,
    align: 'center',
    render: (row) => `<span class="text-sm tabular-nums">${escapeHtml(row.progressText)}</span>`,
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 160,
    freezeable: true,
    sortable: true,
    render: (row) => `<span class="text-xs text-slate-500">${escapeHtml(row.updatedAt)}</span>`,
    sortValue: (row) => row.updatedAt,
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    align: 'right',
    render: (row) => `
      <div class="flex justify-end">
        <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/engineering/masters/${escapeHtml(row.masterOrderId)}">查看详情</button>
      </div>
    `,
  },
]

function getMasterListStorage(): Storage | null {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null
  return localStorage
}

function normalizeMasterListPreferences(
  preferences: StandardListColumnPreferences,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(
    MASTER_LIST_COLUMN_RULES,
    preferences,
    MASTER_LIST_PAGE_SIZES,
  )
  let frozenWidth = 0
  const frozen: StandardListColumn<EngineeringMasterListRow>[] = []
  for (const key of normalized.frozenKeys) {
    const column = MASTER_LIST_COLUMNS.find((item) => item.key === key)
    if (!column) continue
    frozenWidth += Math.max(column.width, column.minWidth ?? 0)
    if (frozenWidth > MASTER_LIST_MAX_FROZEN_WIDTH) break
    frozen.push(column)
  }
  return {
    ...normalized,
    frozenKeys: frozen.map((column) => column.key),
  }
}

function ensureMasterListPreferences(): void {
  if (masterListUiState.preferencesLoaded) return
  masterListUiState.preferencesLoaded = true
  const storage = getMasterListStorage()
  masterListUiState.preferences = storage
    ? normalizeMasterListPreferences(
        loadListColumnPreferences(
          storage,
          MASTER_LIST_STORAGE_KEY,
          MASTER_LIST_COLUMN_RULES,
          masterListUiState.preferences,
          MASTER_LIST_PAGE_SIZES,
        ),
      )
    : masterListUiState.preferences
}

function saveMasterListPreferences(): void {
  const storage = getMasterListStorage()
  if (storage) {
    saveListColumnPreferences(storage, MASTER_LIST_STORAGE_KEY, masterListUiState.preferences)
  }
}

function withMasterListLocalInteractions(html: string): string {
  const actionPattern = new RegExp(`data-${MASTER_EVENT_PREFIX}-action="([^"]+)"`, 'g')
  const fieldPattern = new RegExp(`data-${MASTER_EVENT_PREFIX}-field="([^"]+)"`, 'g')
  return html
    .replace(actionPattern, (attribute) =>
      `data-skip-page-rerender="true" ${attribute}`)
    .replace(fieldPattern, (attribute) =>
      `data-skip-page-rerender="true" ${attribute}`)
}

function hydrateMasterListRegion(region: ParentNode): void {
  void import('../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(region))
    .catch(() => undefined)
}

function getFilteredMasterRows(): EngineeringMasterListRow[] {
  const keyword = masterListUiState.search.trim().toLowerCase()
  return buildEngineeringMasterListRows().filter((row) => {
    if (masterListUiState.statusFilter && row.status !== masterListUiState.statusFilter) return false
    if (keyword.length === 0) return true
    return [
      row.masterOrderCode,
      row.styleCode,
      row.styleName,
      row.merchandiserName,
      row.currentStage,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}

function getPagedMasterRows(): StandardListPageSlice<EngineeringMasterListRow> {
  ensureMasterListPreferences()
  const sorted = sortStandardListRows(
    getFilteredMasterRows(),
    masterListUiState.sort,
    (row, key) => MASTER_LIST_COLUMNS.find((column) => column.key === key)?.sortValue?.(row),
  )
  const paging = paginateStandardListRows(
    sorted,
    masterListUiState.currentPage,
    masterListUiState.preferences.pageSize,
  )
  masterListUiState.currentPage = paging.currentPage
  return paging
}

function renderMasterListStats(): string {
  const rows = buildEngineeringMasterListRows()
  const executing = rows.filter((row) =>
    ['已发布', '进行中', '技术包审核中', '待关闭'].includes(row.status),
  ).length
  const closed = rows.filter((row) => row.status === '已关闭').length
  const draft = rows.filter((row) => row.status === '草稿').length
  return renderStandardListStats([
    { label: '工程主单', value: rows.length },
    { label: '草稿', value: draft },
    { label: '执行中', value: executing },
    { label: '已关闭', value: closed },
  ])
}

function renderMasterListFilters(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative">
        <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
        <input
          type="search"
          class="h-9 w-64 rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:border-blue-500"
          placeholder="搜索主单号 / 款式 / 负责人"
          value="${escapeHtml(masterListUiState.search)}"
          data-${MASTER_EVENT_PREFIX}-field="list-search"
        />
      </div>
      <select
        class="h-9 rounded-md border bg-background px-2 text-sm"
        data-${MASTER_EVENT_PREFIX}-field="status-filter"
        aria-label="按状态筛选"
      >
        <option value="">全部状态</option>
        ${MASTER_STATUS_OPTIONS.map((status) => `
          <option value="${escapeHtml(status)}" ${masterListUiState.statusFilter === status ? 'selected' : ''}>${escapeHtml(status)}</option>
        `).join('')}
      </select>
      <button
        type="button"
        class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
        data-${MASTER_EVENT_PREFIX}-action="reset-filters"
      >重置</button>
    </div>
  `
}

function renderMasterListTable(paging: StandardListPageSlice<EngineeringMasterListRow>): string {
  return withMasterListLocalInteractions(renderStandardListTable({
    columns: MASTER_LIST_COLUMNS,
    rows: paging.rows,
    preferences: masterListUiState.preferences,
    sort: masterListUiState.sort,
    eventPrefix: MASTER_EVENT_PREFIX,
    emptyText: '暂无匹配的工程主单，请调整筛选条件后重试。',
  }))
}

function renderMasterListPagination(paging: StandardListPageSlice<EngineeringMasterListRow>): string {
  return withMasterListLocalInteractions(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: MASTER_EVENT_PREFIX,
    fieldPrefix: MASTER_EVENT_PREFIX,
    pageSizeOptions: MASTER_LIST_PAGE_SIZES,
  }))
}

function renderMasterListColumnSettings(): string {
  if (!masterListUiState.columnSettingsOpen) return ''
  return withMasterListLocalInteractions(renderStandardListColumnSettings({
    title: '列设置',
    columns: MASTER_LIST_COLUMNS,
    preferences: masterListUiState.preferences,
    eventPrefix: MASTER_EVENT_PREFIX,
    maxFrozenWidth: MASTER_LIST_MAX_FROZEN_WIDTH,
  }))
}

function refreshMasterListRegions(options: { settings?: boolean } = {}): void {
  if (typeof document === 'undefined') return
  const paging = getPagedMasterRows()
  const tableHost = document.querySelector<HTMLElement>('[data-pcs-engineering-master-region="table"]')
  const paginationHost = document.querySelector<HTMLElement>('[data-pcs-engineering-master-region="pagination"]')
  const statsHost = document.querySelector<HTMLElement>('[data-pcs-engineering-master-region="stats"]')
  const filtersHost = document.querySelector<HTMLElement>('[data-pcs-engineering-master-region="filters"]')
  if (tableHost) {
    tableHost.innerHTML = renderMasterListTable(paging)
    hydrateMasterListRegion(tableHost)
  }
  if (paginationHost) {
    paginationHost.innerHTML = renderMasterListPagination(paging)
    hydrateMasterListRegion(paginationHost)
  }
  if (statsHost) {
    statsHost.innerHTML = renderMasterListStats()
    hydrateMasterListRegion(statsHost)
  }
  if (options.settings) {
    const settingsHost = document.querySelector<HTMLElement>('[data-pcs-engineering-master-region="column-settings"]')
    if (settingsHost) {
      settingsHost.innerHTML = renderMasterListColumnSettings()
      hydrateMasterListRegion(settingsHost)
    }
  }
  if (options.filters && filtersHost) {
    filtersHost.innerHTML = renderMasterListFilters()
    hydrateMasterListRegion(filtersHost)
  }
}

export function renderPcsEngineeringMasterListPage(): string {
  ensureEngineeringMasterDemoData()
  ensureMasterListPreferences()
  const transient = {
    currentPage: masterListUiState.currentPage,
    sort: masterListUiState.sort,
  }
  const hasMountedRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector('[data-pcs-engineering-master-list-page]'))
  resetStandardListEntryTransientStateOnRouteEntry(transient, hasMountedRoot)
  masterListUiState.currentPage = transient.currentPage
  masterListUiState.sort = transient.sort
  const paging = getPagedMasterRows()
  const page = renderStandardListPage({
    title: '工程主单',
    feedbackHtml: '',
    filtersHtml: `<div data-pcs-engineering-master-region="filters">${withMasterListLocalInteractions(renderMasterListFilters())}</div>`,
    statsHtml: `<div data-pcs-engineering-master-region="stats">${withMasterListLocalInteractions(renderMasterListStats())}</div>`,
    listTitle: '工程主单列表',
    listActionsHtml: withMasterListLocalInteractions(
      renderSecondaryButton(
        '列设置',
        { prefix: MASTER_EVENT_PREFIX, action: 'open-column-settings' },
        'settings-2',
      ),
    ),
    tableHtml: `<div data-pcs-engineering-master-region="table">${renderMasterListTable(paging)}</div>`,
    paginationHtml: `<div data-table-pagination data-pcs-engineering-master-region="pagination">${renderMasterListPagination(paging)}</div>`,
    overlaysHtml: `<div data-pcs-engineering-master-region="column-settings">${renderMasterListColumnSettings()}</div>`,
    className: 'min-w-0 max-w-full',
  })
  return `<div class="min-w-0 max-w-full" data-pcs-engineering-master-list-page>${page}</div>`
}

export function handlePcsEngineeringMasterListEvent(target: HTMLElement, event?: Event): boolean {
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop', 'dragend'].includes(event.type)) {
    const columnKey = dragNode.dataset.pcsEngineeringMasterColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    if (event.type === 'dragstart') {
      masterListUiState.draggedColumnKey = columnKey
      ;(event as DragEvent).dataTransfer?.setData('application/x-higood-list-column-key', columnKey)
      return Boolean(columnKey)
    }
    if (event.type === 'dragend') {
      masterListUiState.draggedColumnKey = ''
      return true
    }
    const sourceKey = masterListUiState.draggedColumnKey
    if (!sourceKey || !columnKey || sourceKey === columnKey) return false
    if (event.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event.preventDefault()
    const order = masterListUiState.preferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(columnKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    masterListUiState.preferences = normalizeMasterListPreferences({
      ...masterListUiState.preferences,
      order,
    })
    masterListUiState.draggedColumnKey = ''
    saveMasterListPreferences()
    refreshMasterListRegions({ settings: true })
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${MASTER_EVENT_PREFIX}-action]`)
  if (!actionNode) return false
  const action = actionNode.dataset.pcsEngineeringMasterAction
  if (!action) return false

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = MASTER_LIST_COLUMNS.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    const currentSort = masterListUiState.sort
    masterListUiState.sort = currentSort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : currentSort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    masterListUiState.currentPage = 1
    refreshMasterListRegions()
    return true
  }
  if (action.startsWith('goto-page-')) {
    const page = Number(action.slice('goto-page-'.length))
    if (Number.isInteger(page) && page > 0) {
      masterListUiState.currentPage = page
      refreshMasterListRegions()
    }
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredMasterRows().length / masterListUiState.preferences.pageSize),
    )
    masterListUiState.currentPage = action === 'prev-page'
      ? Math.max(1, masterListUiState.currentPage - 1)
      : Math.min(totalPages, masterListUiState.currentPage + 1)
    refreshMasterListRegions()
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    masterListUiState.columnSettingsOpen = action === 'open-column-settings'
    refreshMasterListRegions({ settings: true })
    return true
  }
  if (action === 'restore-column-settings') {
    masterListUiState.preferences = normalizeMasterListPreferences({
      order: MASTER_LIST_COLUMNS.map((column) => column.key),
      visibleKeys: MASTER_LIST_COLUMNS.map((column) => column.key),
      frozenKeys: [],
      pageSize: MASTER_LIST_PAGE_SIZES[0],
    })
    masterListUiState.sort = null
    masterListUiState.currentPage = 1
    const storage = getMasterListStorage()
    if (storage) clearListColumnPreferences(storage, MASTER_LIST_STORAGE_KEY)
    refreshMasterListRegions({ settings: true })
    return true
  }
  if (
    (action === 'toggle-column-visibility' || action === 'toggle-column-freeze')
    && (!event || event.type === 'change')
  ) {
    const columnKey = actionNode.dataset.pcsEngineeringMasterColumnKey
      || actionNode.dataset.columnKey
      || ''
    const column = MASTER_LIST_COLUMNS.find((item) => item.key === columnKey)
    if (!column || column.actionColumn) return true
    const visibleKeys = new Set(masterListUiState.preferences.visibleKeys)
    const frozenKeys = new Set(masterListUiState.preferences.frozenKeys)
    if (action === 'toggle-column-visibility' && !column.required) {
      if (visibleKeys.has(columnKey)) {
        visibleKeys.delete(columnKey)
        frozenKeys.delete(columnKey)
      } else {
        visibleKeys.add(columnKey)
      }
      if (!visibleKeys.has(columnKey) && masterListUiState.sort?.key === columnKey) {
        masterListUiState.sort = null
      }
    }
    if (action === 'toggle-column-freeze' && column.freezeable) {
      if (frozenKeys.has(columnKey)) frozenKeys.delete(columnKey)
      else frozenKeys.add(columnKey)
    }
    masterListUiState.preferences = normalizeMasterListPreferences({
      ...masterListUiState.preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    })
    saveMasterListPreferences()
    refreshMasterListRegions({ settings: true })
    return true
  }
  if (action === 'reset-filters') {
    masterListUiState.search = ''
    masterListUiState.statusFilter = ''
    masterListUiState.currentPage = 1
    refreshMasterListRegions({ filters: true })
    return true
  }
  return false
}

export function handlePcsEngineeringMasterListInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>(`[data-${MASTER_EVENT_PREFIX}-field]`)
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsEngineeringMasterField
  if (!field) return false

  if (field === 'pageSize' && fieldNode instanceof HTMLSelectElement) {
    masterListUiState.preferences = normalizeMasterListPreferences({
      ...masterListUiState.preferences,
      pageSize: Number(fieldNode.value),
    })
    masterListUiState.currentPage = 1
    saveMasterListPreferences()
    refreshMasterListRegions()
    return true
  }
  if (field === 'list-search' && fieldNode instanceof HTMLInputElement) {
    masterListUiState.search = fieldNode.value
    masterListUiState.currentPage = 1
    refreshMasterListRegions()
    return true
  }
  if (field === 'status-filter' && fieldNode instanceof HTMLSelectElement) {
    masterListUiState.statusFilter = fieldNode.value
    masterListUiState.currentPage = 1
    refreshMasterListRegions()
    return true
  }
  return false
}

export function isPcsEngineeringMasterListDialogOpen(): boolean {
  return masterListUiState.columnSettingsOpen
}
