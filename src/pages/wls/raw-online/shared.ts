// 原料管理域 /wls/online 列表页共用控制器。
// 各页面只提供列定义、筛选字段、页签与操作回调，渲染仍由页面自身调用标准列表骨架，
// 避免同构页面复制大段事件模板。
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import {
  loadListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'

export interface OnlineFilterOption {
  value: string
  label: string
}

export interface OnlineFilterField {
  key: string
  label: string
  kind?: 'text' | 'select'
  placeholder?: string
  options?: readonly OnlineFilterOption[]
  span?: number
  default?: string
}

export interface OnlineStatusTab<T> {
  key: string
  label: string
  match: (row: T) => boolean
}

export interface OnlineListState {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  dialogKey: string | null
  dialogRowIdx: number
  filters: Record<string, string>
  selected: Set<string>
  tab: string
}

export interface OnlineListView<T> {
  rows: T[]
  all: readonly T[]
  filtered: T[]
  dialogRow: T | null
  filtersHtml: string
  statusTabsHtml: string
}

export interface OnlineActionContext<T> {
  action: string
  node: HTMLElement
  controller: OnlineListController<T>
}

export interface OnlineListConfig<T> {
  prefix: string
  preferenceKey: string
  columns: readonly StandardListColumn<T>[]
  seed: T[]
  filters?: readonly OnlineFilterField[]
  statusTabs?: readonly OnlineStatusTab<T>[]
  defaultTab?: string
  rowMatches?: (row: T, filters: Record<string, string>) => boolean
  pageSizeOptions?: readonly number[]
  frozenKeys?: readonly string[]
  exportFileName?: string
  queryLabel?: string
  resetLabel?: string
  exportLabel?: string
  showExport?: boolean
  onAction?: (context: OnlineActionContext<T>) => boolean
}

export interface OnlineListController<T> {
  readonly config: OnlineListConfig<T>
  readonly state: OnlineListState
  setRenderer(renderer: () => string): void
  view(): OnlineListView<T>
  handle(target: HTMLElement, event?: Event): boolean
  refresh(): void
  openDialog(key: string, rowIdx?: number): void
  closeDialog(): void
  feedback(message: string, variant?: 'success' | 'info' | 'warning' | 'danger'): void
  entry(): void
}

const DEFAULT_PAGE_SIZES: readonly number[] = [10, 20, 50]

function dataPrefixOf(prefix: string): string {
  return prefix.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function spanClass(span: number | undefined): string {
  if (!span || span <= 1) return ''
  if (span === 2) return 'sm:col-span-2'
  if (span === 3) return 'sm:col-span-3'
  return 'sm:col-span-2 lg:col-span-4'
}

export function createOnlineListController<T>(config: OnlineListConfig<T>): OnlineListController<T> {
  const prefix = config.prefix
  const dataPrefix = dataPrefixOf(prefix)
  const pageSizes = config.pageSizeOptions ?? DEFAULT_PAGE_SIZES
  const defaultFrozen = config.frozenKeys ?? [config.columns.find((column) => column.freezeable)?.key].filter((key): key is string => Boolean(key))

  const state: OnlineListState = {
    currentPage: 1,
    sort: null,
    preferences: { order: [], visibleKeys: [], frozenKeys: [...defaultFrozen], pageSize: pageSizes[0] ?? 10 },
    preferencesLoaded: false,
    showColumnSettings: false,
    dialogKey: null,
    dialogRowIdx: -1,
    filters: Object.fromEntries((config.filters ?? []).map((field) => [field.key, field.default ?? ''])),
    selected: new Set<string>(),
    tab: config.defaultTab ?? config.statusTabs?.[0]?.key ?? '',
  }

  const columnRules = config.columns.map((column) => ({
    key: column.key,
    required: column.required,
    freezeable: column.freezeable,
    actionColumn: column.actionColumn,
  }))

  const defaultPreferences = (): StandardListColumnPreferences => ({
    order: config.columns.map((column) => column.key),
    visibleKeys: config.columns.map((column) => column.key),
    frozenKeys: [...defaultFrozen],
    pageSize: pageSizes[0] ?? 10,
  })

  function ensurePreferencesLoaded(): void {
    if (state.preferencesLoaded || typeof window === 'undefined') {
      state.preferencesLoaded = true
      return
    }
    state.preferences = loadListColumnPreferences(window.localStorage, config.preferenceKey, columnRules, defaultPreferences(), [...pageSizes])
    state.preferencesLoaded = true
  }

  function savePreferences(): void {
    if (typeof window === 'undefined') return
    saveListColumnPreferences(window.localStorage, config.preferenceKey, state.preferences)
  }

  function rootElement(): HTMLElement | null {
    return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${prefix}-root]`)
  }

  let renderer: () => string = () => ''

  function setRenderer(next: () => string): void {
    renderer = next
  }

  function refresh(): void {
    const host = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${prefix}-workspace]`)
    if (!host) return
    host.innerHTML = renderer()
    hydrateIcons(host)
  }

  function feedback(message: string, variant: 'success' | 'info' | 'warning' | 'danger' = 'success'): void {
    showListFeedback(message, variant)
  }

  function filteredRows(): T[] {
    return config.seed.filter((row) => {
      if (config.statusTabs?.length) {
        const tab = config.statusTabs.find((item) => item.key === state.tab)
        if (tab && !tab.match(row)) return false
      }
      if (config.rowMatches && !config.rowMatches(row, state.filters)) return false
      return true
    })
  }

  function filtersHtml(): string {
    const fields = config.filters ?? []
    const fieldsHtml = fields.map((field) => {
      const value = state.filters[field.key] ?? ''
      const label = `<span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(field.label)}</span>`
      if (field.kind === 'select') {
        const options = [{ value: '', label: '全部' }, ...(field.options ?? [])]
        return `<label class="${spanClass(field.span)}">${label}<select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${prefix}-field="${escapeHtml(field.key)}">${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}</select></label>`
      }
      return `<label class="${spanClass(field.span)}">${label}<input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder ?? '')}" data-${prefix}-field="${escapeHtml(field.key)}"></label>`
    }).join('')
    return `<div class="rounded-lg border bg-card p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">${fieldsHtml}</div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton(config.queryLabel ?? '查询', { prefix, action: 'apply-filter' }, 'search')}${renderSecondaryButton(config.resetLabel ?? '重置', { prefix, action: 'reset-filter' }, 'rotate-ccw')}${config.showExport === false ? '' : renderSecondaryButton(config.exportLabel ?? '导出', { prefix, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
  }

  function statusTabsHtml(): string {
    if (!config.statusTabs?.length) return ''
    return renderTabs({
      tabs: config.statusTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        count: config.seed.filter((row) => tab.match(row)).length,
      })),
      activeKey: state.tab,
      variant: 'pills',
      prefix,
      action: 'switch-tab',
      fullWidth: false,
    })
  }

  function view(): OnlineListView<T> {
    ensurePreferencesLoaded()
    const filtered = filteredRows()
    const sorted = sortStandardListRows(filtered, state.sort, (row, key) => config.columns.find((column) => column.key === key)?.sortValue?.(row))
    const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
    state.currentPage = paging.currentPage
    return {
      rows: paging.rows,
      all: config.seed,
      filtered,
      dialogRow: state.dialogRowIdx >= 0 ? config.seed[state.dialogRowIdx] : null,
      filtersHtml: filtersHtml(),
      statusTabsHtml: statusTabsHtml(),
    }
  }

  function collectFilterFields(): void {
    const root = rootElement()
    if (!root) return
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`).forEach((field) => {
      const key = field.dataset[`${dataPrefix}Field`]
      if (!key || key === 'pageSize') return
      state.filters[key] = field.value
    })
  }

  function resetFilters(): void {
    state.filters = Object.fromEntries((config.filters ?? []).map((field) => [field.key, field.default ?? '']))
  }

  function handle(target: HTMLElement, event?: Event): boolean {
    if (!rootElement()) return false
    const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${prefix}-field]`)
    if (field) {
      const name = field.dataset[`${dataPrefix}Field`]
      if (!name) return true
      if (name === 'pageSize') {
        if (event?.type === 'change') {
          const next = Number(field.value)
          if (Number.isFinite(next) && next > 0) state.preferences.pageSize = next
          state.currentPage = 1
          savePreferences()
          refresh()
        }
        return true
      }
      if (name === 'row-select') {
        const id = field.dataset[`${dataPrefix}Id`] || ''
        if ((field as HTMLInputElement).checked) state.selected.add(id)
        else state.selected.delete(id)
        return true
      }
      state.filters[name] = field.value
      return true
    }
    const node = target.closest<HTMLElement>(`[data-${prefix}-action]`)
    const action = node?.dataset[`${dataPrefix}Action`]
    if (!node || !action) return false
    if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true

    if (action === 'prev-page') { state.currentPage = Math.max(1, state.currentPage - 1); refresh(); return true }
    if (action === 'next-page') { state.currentPage += 1; refresh(); return true }
    if (action === 'sort-column') {
      const key = node.dataset.columnKey || ''
      state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
      state.currentPage = 1
      refresh()
      return true
    }
    if (action === 'apply-filter') { collectFilterFields(); state.currentPage = 1; refresh(); return true }
    if (action === 'reset-filter') { resetFilters(); state.currentPage = 1; refresh(); return true }
    if (action === 'open-column-settings') { state.showColumnSettings = true; refresh(); return true }
    if (action === 'close-column-settings') { state.showColumnSettings = false; refresh(); return true }
    if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); savePreferences(); refresh(); return true }
    if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = node.dataset[`${dataPrefix}ColumnKey`] || node.closest<HTMLElement>(`[data-${prefix}-column-key]`)?.dataset[`${dataPrefix}ColumnKey`] || ''
      const column = config.columns.find((item) => item.key === key)
      if (!column || column.actionColumn) return true
      if (action === 'toggle-column-visibility' && column.required) return true
      const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
      state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter((item) => item !== key) : [...state.preferences[prop], key]
      savePreferences()
      refresh()
      return true
    }
    if (action === 'close-dialog') { state.dialogKey = null; state.dialogRowIdx = -1; refresh(); return true }
    if (action === 'export') {
      exportStandardListRows({ fileName: config.exportFileName ?? '列表数据', columns: config.columns, rows: filteredRows() })
      return true
    }
    if (action.startsWith('switch-tab:')) {
      state.tab = action.slice('switch-tab:'.length)
      state.currentPage = 1
      refresh()
      return true
    }
    if (config.onAction) return config.onAction({ action, node, controller: api })
    return false
  }

  function openDialog(key: string, rowIdx = -1): void {
    state.dialogKey = key
    state.dialogRowIdx = rowIdx
    refresh()
  }

  function closeDialog(): void {
    state.dialogKey = null
    state.dialogRowIdx = -1
    refresh()
  }

  function entry(): void {
    if (!rootElement()) {
      state.currentPage = 1
      state.sort = null
    }
    ensurePreferencesLoaded()
  }

  const api: OnlineListController<T> = { config, state, setRenderer, view, handle, refresh, openDialog, closeDialog, feedback, entry }
  return api
}
