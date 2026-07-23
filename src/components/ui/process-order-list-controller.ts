import { renderStandardListColumnSettings, renderStandardListTable, type StandardListColumn } from './list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from './list-table-model.ts'
import { renderTablePagination } from './pagination.ts'

export interface ProcessOrderListControllerState {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
}

interface ProcessOrderListControllerOptions<Row> {
  state: ProcessOrderListControllerState
  columns: StandardListColumn<Row>[]
  preferenceKey: string
  pageSizeOptions: number[]
  eventPrefix: string
  rootSelector: string
  tableSurfaceSelector: string
  paginationSurfaceSelector: string
  overlaysSurfaceSelector: string
  defaultFrozenKeys: string[]
  columnSettingsTitle: string
  emptyText: string
  getRows: () => Row[]
  maxFrozenWidth?: number
}

export function createProcessOrderListController<Row>(options: ProcessOrderListControllerOptions<Row>) {
  const { state, columns } = options
  const rules = columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))
  let dragEventsInstalled = false
  let draggedColumnKey = ''

  function defaultPreferences(): StandardListColumnPreferences {
    return normalizeListColumnPreferences(rules, {
      order: columns.map((column) => column.key),
      visibleKeys: columns.map((column) => column.key),
      frozenKeys: options.defaultFrozenKeys,
      pageSize: options.pageSizeOptions[0] || 10,
    }, options.pageSizeOptions)
  }

  function ensurePreferencesLoaded(): void {
    if (state.preferencesLoaded) return
    state.preferencesLoaded = true
    const defaults = defaultPreferences()
    state.preferences = typeof window === 'undefined'
      ? defaults
      : loadListColumnPreferences(window.localStorage, options.preferenceKey, rules, defaults, options.pageSizeOptions)
  }

  function persistPreferences(): void {
    if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, options.preferenceKey, state.preferences)
  }

  function getView(rows = options.getRows()) {
    ensurePreferencesLoaded()
    const sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find((column) => column.key === key)?.sortValue?.(row))
    const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
    state.currentPage = paging.currentPage
    return {
      tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: options.eventPrefix, emptyText: options.emptyText }),
      paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: options.eventPrefix, fieldPrefix: options.eventPrefix, pageSizeOptions: options.pageSizeOptions })
        .replace('<select ', '<select data-skip-page-rerender="true" '),
    }
  }

  function renderColumnSettings(): string {
    return state.showColumnSettings
      ? renderStandardListColumnSettings({ title: options.columnSettingsTitle, columns, preferences: state.preferences, eventPrefix: options.eventPrefix, maxFrozenWidth: options.maxFrozenWidth ?? 520 })
      : ''
  }

  function hydrate(root: ParentNode): void {
    void import('../shell.ts').then(({ hydrateIcons }) => hydrateIcons(root)).catch(() => undefined)
  }

  function refresh(refreshOptions: { table?: boolean; pagination?: boolean; overlays?: boolean } = {}): boolean {
    if (typeof document === 'undefined') return false
    const root = document.querySelector<HTMLElement>(options.rootSelector)
    if (!root) return false
    const refreshTable = refreshOptions.table !== false
    const refreshPagination = refreshOptions.pagination !== false
    const view = refreshTable || refreshPagination ? getView() : null
    const table = root.querySelector<HTMLElement>(options.tableSurfaceSelector)
    const pagination = root.querySelector<HTMLElement>(options.paginationSurfaceSelector)
    const overlays = root.querySelector<HTMLElement>(options.overlaysSurfaceSelector)
    const scrollLeft = table?.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft ?? 0
    if (refreshTable && table && view) {
      table.innerHTML = view.tableHtml
      const nextScroll = table.querySelector<HTMLElement>('[data-standard-list-scroll]')
      if (nextScroll) nextScroll.scrollLeft = Math.min(scrollLeft, Math.max(0, nextScroll.scrollWidth - nextScroll.clientWidth))
      hydrate(table)
    }
    if (refreshPagination && pagination && view) {
      pagination.innerHTML = view.paginationHtml
      hydrate(pagination)
    }
    if (refreshOptions.overlays && overlays) {
      overlays.innerHTML = renderColumnSettings()
      hydrate(overlays)
    }
    return true
  }

  function setPageSize(value: number): void {
    state.preferences = { ...state.preferences, pageSize: options.pageSizeOptions.includes(value) ? value : (options.pageSizeOptions[0] || 10) }
    state.currentPage = 1
    persistPreferences()
  }

  function stepPage(delta: number): void {
    state.currentPage = Math.max(1, state.currentPage + delta)
  }

  function cycleSort(key: string): void {
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
  }

  function updateColumnPreference(action: string, key: string, desiredChecked?: boolean): void {
    const column = columns.find((item) => item.key === key)
    if (!column || column.actionColumn) return
    const visibleKeys = action === 'toggle-column-visibility' && !column.required
      ? ((desiredChecked ?? !state.preferences.visibleKeys.includes(key)) ? [...new Set([...state.preferences.visibleKeys, key])] : state.preferences.visibleKeys.filter((item) => item !== key))
      : state.preferences.visibleKeys
    const frozenKeys = action === 'toggle-column-freeze' && column.freezeable
      ? ((desiredChecked ?? !state.preferences.frozenKeys.includes(key)) ? [...new Set([...state.preferences.frozenKeys, key])] : state.preferences.frozenKeys.filter((item) => item !== key))
      : state.preferences.frozenKeys
    state.preferences = normalizeListColumnPreferences(rules, { ...state.preferences, visibleKeys, frozenKeys }, options.pageSizeOptions)
    persistPreferences()
  }

  function restorePreferences(): void {
    if (typeof window !== 'undefined') clearListColumnPreferences(window.localStorage, options.preferenceKey)
    state.preferences = defaultPreferences()
    state.sort = null
    state.currentPage = 1
  }

  function reorderColumn(sourceKey: string, targetKey: string): boolean {
    const order = state.preferences.order.filter((key) => key !== 'actions' && key !== sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(rules, { ...state.preferences, order: [...order, 'actions'] }, options.pageSizeOptions)
    persistPreferences()
    return true
  }

  function installColumnDragEvents(): void {
    if (dragEventsInstalled || typeof document === 'undefined') return
    dragEventsInstalled = true
    document.addEventListener('dragstart', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(`${options.rootSelector} [data-standard-list-column-drag]`) : null
      if (!target) return
      draggedColumnKey = target.dataset.dragSource || ''
      event.dataTransfer?.setData('text/plain', draggedColumnKey)
    })
    document.addEventListener('dragover', (event) => {
      if (event.target instanceof Element && event.target.closest(`${options.rootSelector} [data-drop-target]`)) event.preventDefault()
    })
    document.addEventListener('drop', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(`${options.rootSelector} [data-drop-target]`) : null
      const sourceKey = draggedColumnKey || event.dataTransfer?.getData('text/plain') || ''
      const targetKey = target?.dataset.dropTarget || ''
      draggedColumnKey = ''
      if (!sourceKey || !targetKey || sourceKey === targetKey || !reorderColumn(sourceKey, targetKey)) return
      event.preventDefault()
      refresh({ pagination: false, overlays: true })
    })
  }

  return {
    ensurePreferencesLoaded,
    getView,
    renderColumnSettings,
    refresh,
    setPageSize,
    stepPage,
    cycleSort,
    updateColumnPreference,
    restorePreferences,
    installColumnDragEvents,
  }
}
