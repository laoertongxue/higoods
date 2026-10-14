// @page-pattern: list
// 中转仓在线页共享标准列表工厂：同构页通过配置对象复用骨架、分页、列设置与事件分发，
// 避免在 14 个页面间复制大段模板。render() 直接落在 renderStandardListPage 上，
// 满足列表页治理契约。
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import {
  renderStandardListTable,
  renderStandardListColumnSettings,
  renderStandardRowDetailDialog,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  loadListColumnPreferences,
  saveListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

export interface TransitOnlineSearchField {
  name: string
  label: string
  placeholder: string
  wide?: boolean
  type?: 'text' | 'date'
}

export interface TransitOnlineSelectField {
  name: string
  label: string
  /** 第一项为默认“全部”类选项。 */
  options: string[]
}

export interface TransitOnlineTab {
  key: string
  label: string
}

export interface TransitOnlineStat {
  label: string
  value: string | number
}

export interface TransitOnlineListState {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  detailIdx: number
  searches: Record<string, string>
  selects: Record<string, string>
  tab: string
}

export interface TransitOnlineQuery {
  searches: Record<string, string>
  selects: Record<string, string>
  tab: string
}

export interface TransitOnlineListContext<T> {
  state: TransitOnlineListState
  rows: readonly T[]
  filtered: () => T[]
  refresh: () => void
  root: () => HTMLElement | null
}

export interface TransitOnlineListDefinition<T> {
  eventPrefix: string
  preferenceKey: string
  title: string
  listTitle: string
  columns: StandardListColumn<T>[]
  rows: T[]
  emptyText: string
  searches: TransitOnlineSearchField[]
  selects?: TransitOnlineSelectField[]
  tabs?: TransitOnlineTab[]
  stats?: (rows: T[]) => TransitOnlineStat[]
  defaultFrozenKeys?: string[]
  pageSizeOptions?: number[]
  /** 判断行是否命中当前查询（关键字 / 下拉 / 页签）。 */
  matches: (row: T, query: TransitOnlineQuery) => boolean
  primaryActionsHtml?: (ctx: TransitOnlineListContext<T>) => string
  listActionsHtml?: (ctx: TransitOnlineListContext<T>) => string
  /** 追加到标准表格之后的行内展开等自定义内容。 */
  extraTableHtml?: (ctx: TransitOnlineListContext<T>) => string
  overlaysHtml?: (ctx: TransitOnlineListContext<T>) => string
  onAction?: (action: string, node: HTMLElement, ctx: TransitOnlineListContext<T>) => boolean
  onField?: (
    name: string,
    element: HTMLInputElement | HTMLSelectElement,
    ctx: TransitOnlineListContext<T>,
  ) => boolean
  detailTitle?: string
  exportFileName?: string
  showExport?: boolean
  /** 页头说明，渲染在筛选卡片顶部的小段落。 */
  headerNote?: string
  /** 页头说明（渲染在页面标题下方，用于独立于筛选的场景）。 */
  description?: string
}

function datasetPrefix(prefix: string): string {
  return prefix.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

function buildFilterCard<T>(def: TransitOnlineListDefinition<T>, state: TransitOnlineListState): string {
  const searchFields = def.searches
    .map(
      (field) =>
        `<label class="${field.wide ? 'sm:col-span-2' : ''}"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(field.label)}</span><input type="${field.type ?? 'text'}" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.searches[field.name] ?? '')}" placeholder="${escapeHtml(field.placeholder)}" data-${def.eventPrefix}-search="${escapeHtml(field.name)}"></label>`,
    )
    .join('')
  const selectFields = (def.selects ?? [])
    .map(
      (field) =>
        `<label><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(field.label)}</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${def.eventPrefix}-select="${escapeHtml(field.name)}">${field.options
          .map(
            (option, index) =>
              `<option value="${index === 0 ? '' : escapeHtml(option)}" ${(state.selects[field.name] ?? '') === (index === 0 ? '' : option) ? 'selected' : ''}>${escapeHtml(option)}</option>`,
          )
          .join('')}</select></label>`,
    )
    .join('')
  const exportButton = def.showExport === false ? '' : renderSecondaryButton('导出', { prefix: def.eventPrefix, action: 'export' }, 'download')
  return `<div class="rounded-lg border bg-white p-3">${def.headerNote ? `<p class="mb-2 text-xs text-muted-foreground">${escapeHtml(def.headerNote)}</p>` : ''}<div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">${searchFields}${selectFields}</div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: def.eventPrefix, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: def.eventPrefix, action: 'reset-filter' }, 'rotate-ccw')}${exportButton}</div></div>`.replace(
    /<(input|select)\b/g,
    '<$1 data-skip-page-rerender="true"',
  )
}

function renderStatusTabs<T>(
  def: TransitOnlineListDefinition<T>,
  counts: Record<string, number>,
  active: string,
): string {
  if (!def.tabs?.length) return ''
  return `<div class="flex flex-wrap gap-2">${def.tabs
    .map(
      (tab) =>
        `<button type="button" class="rounded-md border px-3 py-1.5 text-sm ${tab.key === active ? 'border-blue-600 bg-blue-600 text-white' : 'bg-background hover:bg-muted'}" data-${def.eventPrefix}-action="switch-tab" data-${def.eventPrefix}-tab="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}<span class="ml-1 text-xs opacity-80">${counts[tab.key] ?? 0}</span></button>`,
    )
    .join('')}</div>`
}

export function createStandardListPage<T>(def: TransitOnlineListDefinition<T>) {
  const EVENT = def.eventPrefix
  const DATA = datasetPrefix(EVENT)
  const PAGE_SIZES = def.pageSizeOptions ?? [10, 20, 50]
  const state: TransitOnlineListState = {
    currentPage: 1,
    sort: null,
    preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: PAGE_SIZES[0] },
    preferencesLoaded: false,
    showColumnSettings: false,
    detailIdx: -1,
    searches: {},
    selects: {},
    tab: def.tabs?.[0]?.key ?? '',
  }
  const columnRules = def.columns.map((column) => ({
    key: column.key,
    required: column.required,
    freezeable: column.freezeable,
    actionColumn: column.actionColumn,
  }))
  const defaultPreferences = (): StandardListColumnPreferences => ({
    order: def.columns.map((column) => column.key),
    visibleKeys: def.columns.map((column) => column.key),
    frozenKeys: (def.defaultFrozenKeys ?? []).filter((key) => def.columns.some((column) => column.key === key)),
    pageSize: PAGE_SIZES[0],
  })

  const ensurePreferencesLoaded = (): void => {
    if (state.preferencesLoaded || typeof window === 'undefined') {
      state.preferencesLoaded = true
      return
    }
    state.preferences = loadListColumnPreferences(
      window.localStorage,
      def.preferenceKey,
      columnRules,
      defaultPreferences(),
      [...PAGE_SIZES],
    )
    state.preferencesLoaded = true
  }

  const filtered = (): T[] =>
    def.rows.filter((row) => def.matches(row, { searches: state.searches, selects: state.selects, tab: state.tab }))

  const rootElement = (): HTMLElement | null =>
    typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT}-root]`)

  const context = (): TransitOnlineListContext<T> => ({
    state,
    rows: def.rows,
    filtered,
    refresh: refreshWorkspace,
    root: rootElement,
  })

  const tabCounts = (): Record<string, number> => {
    const counts: Record<string, number> = {}
    for (const tab of def.tabs ?? []) {
      counts[tab.key] = def.rows.filter((row) =>
        def.matches(row, { searches: {}, selects: {}, tab: tab.key }),
      ).length
    }
    return counts
  }

  const renderWorkspace = (): string => {
    ensurePreferencesLoaded()
    const all = filtered()
    const sorted = sortStandardListRows(all, state.sort, (row, key) =>
      def.columns.find((column) => column.key === key)?.sortValue?.(row),
    )
    const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
    state.currentPage = paging.currentPage
    const ctx = context()
    const baseTableHtml = renderStandardListTable({
      columns: def.columns,
      rows: paging.rows,
      preferences: state.preferences,
      sort: state.sort,
      eventPrefix: EVENT,
      emptyText: def.emptyText,
    })
    const extraTable = def.extraTableHtml ? def.extraTableHtml(ctx) : ''
    const overlays = [
      state.showColumnSettings
        ? renderStandardListColumnSettings({
            title: `${def.listTitle}列设置`,
            columns: def.columns,
            preferences: state.preferences,
            eventPrefix: EVENT,
            maxFrozenWidth: 400,
          })
        : '',
      def.detailTitle && state.detailIdx >= 0 && def.rows[state.detailIdx]
        ? renderStandardRowDetailDialog({
            title: def.detailTitle,
            columns: def.columns,
            row: def.rows[state.detailIdx],
            eventPrefix: EVENT,
          })
        : '',
      def.overlaysHtml ? def.overlaysHtml(ctx) : '',
    ].join('')
    return renderStandardListPage({
      title: def.title,
      description: def.description,
      primaryActionsHtml: def.primaryActionsHtml ? def.primaryActionsHtml(ctx) : '',
      statusTabsHtml: renderStatusTabs(def, tabCounts(), state.tab),
      filtersHtml: buildFilterCard(def, state),
      statsHtml: def.stats ? renderStandardListStats(def.stats(all)) : '',
      listTitle: def.listTitle,
      listActionsHtml:
        def.listActionsHtml?.(ctx) ??
        `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT, action: 'open-column-settings' }, 'settings-2')}</div>`,
      tableHtml: baseTableHtml + extraTable,
      paginationHtml: renderTablePagination({
        total: paging.total,
        from: paging.from,
        to: paging.to,
        currentPage: paging.currentPage,
        totalPages: paging.totalPages,
        pageSize: paging.pageSize,
        actionPrefix: EVENT,
        fieldPrefix: EVENT,
        pageSizeOptions: [...PAGE_SIZES],
      }),
      overlaysHtml: overlays,
    })
  }

  const refreshWorkspace = (): void => {
    const host = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT}-workspace]`)
    if (!host) return
    host.innerHTML = renderWorkspace()
    hydrateIcons(host)
  }

  const render = (): string => {
    resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
    ensurePreferencesLoaded()
    return `<div data-${EVENT}-root data-skip-page-rerender="true"><div data-${EVENT}-workspace>${renderWorkspace()}</div></div>`
  }

  const handle = (target: HTMLElement, event?: Event): boolean => {
    if (!rootElement()) return false
    const field = target.closest<HTMLElement>(`[data-${EVENT}-search],[data-${EVENT}-select],[data-${EVENT}-field]`)
    if (field) {
      const searchName = field.dataset[`${DATA}Search`]
      if (searchName !== undefined) {
        state.searches[searchName] = (field as HTMLInputElement).value
        if (def.onField?.(`search:${searchName}`, field as HTMLInputElement, context())) return true
        return true
      }
      const selectName = field.dataset[`${DATA}Select`]
      if (selectName !== undefined) {
        state.selects[selectName] = (field as HTMLSelectElement).value
        if (def.onField?.(`select:${selectName}`, field as HTMLSelectElement, context())) return true
        return true
      }
      const fieldName = field.dataset[`${DATA}Field`]
      if (fieldName === 'pageSize' && event?.type === 'change') {
        state.preferences.pageSize = Number((field as HTMLSelectElement).value)
        state.currentPage = 1
        saveListColumnPreferences(window.localStorage, def.preferenceKey, state.preferences)
        refreshWorkspace()
        return true
      }
      if (fieldName && def.onField?.(fieldName, field as HTMLInputElement, context())) return true
      return true
    }

    const actionNode = target.closest<HTMLElement>(`[data-${EVENT}-action]`)
    const action = actionNode?.dataset[`${DATA}Action`]
    if (!actionNode || !action) return false
    if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze', 'toggle-select'].includes(action)) return true

    if (action === 'prev-page' || action === 'next-page') {
      state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
      refreshWorkspace()
      return true
    }
    if (action === 'sort-column') {
      const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
      state.sort =
        state.sort?.key === key
          ? state.sort.direction === 'asc'
            ? { key, direction: 'desc' }
            : null
          : { key, direction: 'asc' }
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    if (action === 'apply-filter') {
      rootElement()?.querySelectorAll<HTMLInputElement>(`[data-${EVENT}-search]`).forEach((input) => {
        const name = input.dataset[`${DATA}Search`]
        if (name) state.searches[name] = input.value
      })
      rootElement()?.querySelectorAll<HTMLSelectElement>(`[data-${EVENT}-select]`).forEach((select) => {
        const name = select.dataset[`${DATA}Select`]
        if (name) state.selects[name] = select.value
      })
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    if (action === 'reset-filter') {
      state.searches = {}
      state.selects = {}
      state.tab = def.tabs?.[0]?.key ?? ''
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    if (action === 'switch-tab') {
      state.tab = actionNode.dataset[`${DATA}Tab`] ?? ''
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    if (action === 'open-column-settings') {
      state.showColumnSettings = true
      refreshWorkspace()
      return true
    }
    if (action === 'close-column-settings') {
      state.showColumnSettings = false
      refreshWorkspace()
      return true
    }
    if (action === 'restore-column-settings') {
      state.preferences = defaultPreferences()
      saveListColumnPreferences(window.localStorage, def.preferenceKey, state.preferences)
      refreshWorkspace()
      return true
    }
    if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key =
        actionNode.dataset[`${DATA}ColumnKey`] ||
        actionNode.closest<HTMLElement>(`[data-${EVENT}-column-key]`)?.dataset[`${DATA}ColumnKey`] ||
        ''
      const column = def.columns.find((item) => item.key === key)
      if (!column || column.actionColumn) return true
      if (action === 'toggle-column-visibility' && column.required) return true
      const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
      state.preferences[prop] = state.preferences[prop].includes(key)
        ? state.preferences[prop].filter((item) => item !== key)
        : [...state.preferences[prop], key]
      saveListColumnPreferences(window.localStorage, def.preferenceKey, state.preferences)
      refreshWorkspace()
      return true
    }
    if (action === 'view-detail') {
      state.detailIdx = Number(actionNode.dataset[`${DATA}Idx`])
      refreshWorkspace()
      return true
    }
    if (action === 'close-detail') {
      state.detailIdx = -1
      refreshWorkspace()
      return true
    }
    if (action === 'export') {
      exportStandardListRows({
        fileName: def.exportFileName ?? def.listTitle,
        columns: def.columns,
        rows: filtered(),
      })
      return true
    }
    if (def.onAction?.(action, actionNode, context())) {
      refreshWorkspace()
      return true
    }
    return false
  }

  return { render, handle, state }
}
