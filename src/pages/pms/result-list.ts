// @page-pattern: list
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage, type StandardListStatItem } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsFeedback } from './shared.ts'

export interface PmsResultListConfig<Row> {
  title: string
  emptyText: string
  exportName: string
  exportHeaders: string[]
  exportRow: (row: Row) => Array<string | number>
  keywordPlaceholder: string
  note: string
  columns: StandardListColumn<Row>[]
  getRows: () => Row[]
  searchValues: (row: Row) => string[]
  stats: (rows: Row[]) => StandardListStatItem[]
  preferenceKey: string
  eventPrefix: string
  rootSelector: string
}

interface PmsResultListState extends ProcessOrderListControllerState {
  keyword: string
  feedback: string
  feedbackOk: boolean
}

export function createPmsResultListPage<Row>(config: PmsResultListConfig<Row>) {
  const camelKey = (value: string): string => value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  const actionDatasetKey = camelKey(`${config.eventPrefix}-action`)
  const columnKeyDatasetKey = camelKey(`${config.eventPrefix}-column-key`)
  const fieldDatasetKey = camelKey(`${config.eventPrefix}-field`)
  const state: PmsResultListState = {
    currentPage: 1,
    sort: null,
    preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
    preferencesLoaded: false,
    showColumnSettings: false,
    keyword: '',
    feedback: '',
    feedbackOk: true,
  }

  function filteredRows(): Row[] {
    const keyword = state.keyword.trim().toLowerCase()
    if (!keyword) return config.getRows()
    return config.getRows().filter((row) => config.searchValues(row).some((value) => value.toLowerCase().includes(keyword)))
  }

  const controller = createProcessOrderListController({
    state,
    columns: config.columns,
    preferenceKey: config.preferenceKey,
    pageSizeOptions: [10, 20, 50],
    eventPrefix: config.eventPrefix,
    rootSelector: config.rootSelector,
    tableSurfaceSelector: `[data-${config.eventPrefix}-table-surface]`,
    paginationSurfaceSelector: `[data-${config.eventPrefix}-pagination-surface]`,
    overlaysSurfaceSelector: `[data-${config.eventPrefix}-overlays]`,
    defaultFrozenKeys: [config.columns[0]?.key].filter((key): key is string => Boolean(key)),
    columnSettingsTitle: `${config.title}列设置`,
    emptyText: config.emptyText,
    getRows: filteredRows,
    locallyManagedEvents: true,
  })

  function rootElement(): HTMLElement | null {
    if (typeof window === 'undefined') return null
    return document.querySelector<HTMLElement>(config.rootSelector)
  }

  function renderInner(): string {
    controller.ensurePreferencesLoaded()
    const view = controller.getView()
    return renderStandardListPage({
      showHeader: false,
      title: config.title,
      feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
      filtersHtml: `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="${escapeHtml(config.keywordPlaceholder)}" value="${escapeHtml(state.keyword)}" data-${config.eventPrefix}-field="keyword" data-skip-page-rerender="true" /></label>
        </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
        ${renderPrimaryButton('查询', { prefix: config.eventPrefix, action: 'query' }, 'search')}
        ${renderSecondaryButton('重置', { prefix: config.eventPrefix, action: 'reset' }, 'rotate-ccw')}
        ${renderSecondaryButton('导出', { prefix: config.eventPrefix, action: 'export' }, 'download')}
        </div></div>`,
      statsHtml: renderProcessOrderStats(config.stats(filteredRows())),
      listTitle: `共 ${filteredRows().length} 条`,
      listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">${escapeHtml(config.note)}</span>${renderSecondaryButton('列设置', { prefix: config.eventPrefix, action: 'open-column-settings' }, 'settings-2')}</div>`,
      tableHtml: `<div data-${config.eventPrefix}-table-surface>${view.tableHtml}</div>`,
      paginationHtml: `<div data-${config.eventPrefix}-pagination-surface>${view.paginationHtml}</div>`,
      overlaysHtml: `<div data-${config.eventPrefix}-overlays>${controller.renderColumnSettings()}</div>`,
    })
  }

  function refreshAll(): void {
    const root = rootElement()
    if (!root) return
    root.innerHTML = renderInner()
    hydratePmsSurface(root)
  }

  function refreshOverlays(): void {
    const surface = rootElement()?.querySelector<HTMLElement>(`[data-${config.eventPrefix}-overlays]`)
    if (!surface) return
    surface.innerHTML = controller.renderColumnSettings()
    hydratePmsSurface(surface)
  }

  function exportRows(): void {
    const rows = filteredRows()
    if (rows.length === 0) {
      state.feedback = '当前查询条件下没有可导出的记录。'
      state.feedbackOk = false
      refreshAll()
      return
    }
    downloadPmsCsv(config.exportName, config.exportHeaders, rows.map(config.exportRow))
    state.feedback = `已导出 ${rows.length} 条记录（当前查询条件全量）。`
    state.feedbackOk = true
    refreshAll()
  }

  function render(): string {
    resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
    controller.installColumnDragEvents()
    return `<div data-${config.eventPrefix}-root data-skip-page-rerender="true"><style>[data-${config.eventPrefix}-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
  }

  function close(): boolean {
    if (state.showColumnSettings) {
      state.showColumnSettings = false
      refreshOverlays()
      return true
    }
    return false
  }

  function handle(target: HTMLElement): boolean {
    if (!rootElement() && typeof window !== 'undefined') return false
    const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${config.eventPrefix}-field]`)
    if (field) {
      if (field.dataset[fieldDatasetKey as keyof DOMStringMap] === 'pageSize' && field instanceof HTMLSelectElement) {
        controller.setPageSize(Number.parseInt(field.value, 10))
        controller.refresh({ overlays: false })
        return true
      }
      state.keyword = field.value
      return true
    }
    const actionNode = target.closest<HTMLElement>(`[data-${config.eventPrefix}-action]`)
    const action = actionNode?.dataset[actionDatasetKey as keyof DOMStringMap]
    if (!action) return false
    if (action === 'query') {
      state.currentPage = 1
      state.feedback = ''
      refreshAll()
      return true
    }
    if (action === 'reset') {
      state.keyword = ''
      state.currentPage = 1
      state.feedback = ''
      refreshAll()
      return true
    }
    if (action === 'export') {
      exportRows()
      return true
    }
    if (action === 'open-column-settings') {
      state.showColumnSettings = true
      refreshOverlays()
      return true
    }
    if (action === 'close-column-settings') {
      state.showColumnSettings = false
      refreshOverlays()
      return true
    }
    if (action === 'restore-column-settings') {
      controller.restorePreferences()
      refreshOverlays()
      controller.refresh()
      return true
    }
    if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = actionNode?.closest<HTMLElement>(`[data-${config.eventPrefix}-column-key]`)?.dataset[columnKeyDatasetKey as keyof DOMStringMap] || ''
      controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
      refreshOverlays()
      controller.refresh()
      return true
    }
    if (action === 'prev-page' || action === 'next-page') {
      controller.stepPage(action === 'next-page' ? 1 : -1)
      controller.refresh({ overlays: false })
      return true
    }
    if (action === 'sort-column') {
      controller.cycleSort(actionNode?.dataset.columnKey || '')
      controller.refresh()
      return true
    }
    return false
  }

  return { render, handle, close }
}
