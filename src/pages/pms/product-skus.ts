// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { getPmsProductSkuRow, listPmsProductSkus, type PmsProductSkuRow, type PmsSkuKind } from '../../data/pms/product-skus.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsStatusBadge,
} from './shared.ts'

interface SkuPageState extends ProcessOrderListControllerState {
  kind: PmsSkuKind
  keyword: string
  status: '' | PmsProductSkuRow['status']
  overlay: null | { rowSpu: string }
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-sku'
const ROOT_SELECTOR = '[data-pms-sku-root]'

const state: SkuPageState = {
  kind: 'garment',
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  overlay: null,
  feedback: '',
  feedbackOk: true,
}

const PAGE_META: Record<PmsSkuKind, { title: string; exportName: string }> = {
  garment: { title: '成衣列表', exportName: '成衣列表.csv' },
  sample: { title: '样衣列表', exportName: '样衣列表.csv' },
}

function filteredRows(): PmsProductSkuRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsProductSkus(state.kind).filter((row) => {
    if (state.status && row.status !== state.status) return false
    if (!keyword) return true
    return [row.spu, row.styleCode, row.productName, row.category, ...row.skuItems.map((item) => item.sku)].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsProductSkuRow>[] = [
  {
    key: 'product',
    title: '款式与 SPU',
    width: 280,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.productName,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.imageUrl, `${row.productName}（${row.spu}）款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.spu)} · ${escapeHtml(row.styleCode)}</div><div class="text-xs text-slate-500">${escapeHtml(row.category)} · ${escapeHtml(row.season)}</div></div></div>`,
  },
  {
    key: 'skus',
    title: 'SKU 明细',
    width: 360,
    render: (row) => `<div class="space-y-1 text-xs">${row.skuItems.slice(0, 4).map((item) => `<div class="flex items-center justify-between gap-2"><span>${escapeHtml(item.sku)}</span><span class="tabular-nums text-slate-500">${escapeHtml(item.color)} / ${escapeHtml(item.size)} · ${formatPmsMoney(item.standardPrice)}</span></div>`).join('')}${row.skuItems.length > 4 ? `<div class="text-slate-500">…共 ${row.skuItems.length} 个 SKU</div>` : ''}</div>`,
  },
  {
    key: 'stock',
    title: '库存 / 状态',
    width: 160,
    sortable: true,
    sortValue: (row) => row.skuItems.reduce((sum, item) => sum + item.stockQty, 0),
    render: (row) => `<div class="text-sm tabular-nums">${formatPmsQty(row.skuItems.reduce((sum, item) => sum + item.stockQty, 0), '件')}</div><div class="mt-1">${renderPmsStatusBadge(row.status, row.status === '在售' ? 'green' : row.status === '开发中' ? 'yellow' : 'slate')}</div>`,
  },
  {
    key: 'source',
    title: '来源 / 更新',
    width: 180,
    render: (row) => `<div class="text-sm">${escapeHtml(row.source)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.updatedAt)}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 110,
    actionColumn: true,
    render: (row) => `<div class="flex items-center"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-spu="${escapeHtml(row.spu)}" data-skip-page-rerender="true">详情</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/product-skus',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-sku-table-surface]',
  paginationSurfaceSelector: '[data-pms-sku-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-sku-overlays]',
  defaultFrozenKeys: ['product'],
  columnSettingsTitle: 'SKU 列表列设置',
  emptyText: '当前条件下暂无 SKU',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '在售', '已下架', '开发中'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="SPU / 款号 / 款式 / SKU" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">${state.kind === 'garment' ? '成衣 SKU 由 PCS 同步，采购侧只读' : '样衣用于开发与首单确认，采购侧只读'}</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '款式总数', value: rows.length },
    { label: 'SKU 总数', value: rows.reduce((sum, row) => sum + row.skuItems.length, 0) },
    { label: '在售', value: rows.filter((row) => row.status === '在售').length },
    { label: '库存合计', value: formatPmsQty(rows.reduce((sum, row) => sum + row.skuItems.reduce((itemSum, item) => itemSum + item.stockQty, 0), 0), '件') },
  ])
}

function renderDetailOverlay(spu: string): string {
  const row = getPmsProductSkuRow(state.kind, spu)
  if (!row) return ''
  const skuRows = row.skuItems.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(item.sku)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.color)} / ${escapeHtml(item.size)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(item.standardPrice)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(item.stockQty, '件')}</td><td class="px-3 py-2">${renderPmsStatusBadge(item.status, item.status === '在售' ? 'green' : 'yellow')}</td></tr>`).join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="SKU 详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[680px] max-w-[95vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(row.productName)} · ${escapeHtml(row.spu)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.styleCode)} · ${escapeHtml(row.category)} · ${escapeHtml(row.season)} · ${escapeHtml(row.source)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(row.imageUrl, `${row.productName}（${row.spu}）款式图`, 'h-24 w-24')}<dl class="grid flex-1 grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(row.status, row.status === '在售' ? 'green' : 'yellow')}</dd></div><div><dt class="text-xs text-muted-foreground">SKU 数</dt><dd class="mt-1">${row.skuItems.length}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">最近更新</dt><dd class="mt-1 text-slate-600">${escapeHtml(row.updatedAt)}</dd></div></dl></div>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">颜色 / 尺码</th><th class="px-3 py-2">标准价</th><th class="px-3 py-2">库存</th><th class="px-3 py-2">状态</th></tr></thead><tbody>${skuRows}</tbody></table></div>
  </div></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-sku-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  return `${columnSettings}${renderDetailOverlay(state.overlay.rowSpu)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const meta = PAGE_META[state.kind]
  return renderStandardListPage({
      showHeader: false,
    title: meta.title,
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-sku-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-sku-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-sku-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-sku-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的 SKU。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    PAGE_META[state.kind].exportName,
    ['SPU', '款号', '款式', '类别', '季节', 'SKU', '颜色', '尺码', '标准价', '库存', 'SKU状态', '来源'],
    rows.flatMap((row) => row.skuItems.map((item) => [row.spu, row.styleCode, row.productName, row.category, row.season, item.sku, item.color, item.size, item.standardPrice, item.stockQty, item.status, row.source])),
  )
  state.feedback = `已导出 ${rows.length} 个款式的 SKU（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function renderPage(kind: PmsSkuKind): string {
  state.kind = kind
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-sku-root data-skip-page-rerender="true"><style>[data-pms-sku-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function renderPmsGarmentSkusPage(): string {
  return renderPage('garment')
}

export function renderPmsSampleSkusPage(): string {
  return renderPage('sample')
}

export function closePmsProductSkuOverlays(): boolean {
  if (state.overlay) {
    state.overlay = null
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsProductSkusEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsSkuField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as SkuPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsSkuAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-sku-column-key]')?.dataset.pmsSkuColumnKey || ''
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
  if (action === 'open-detail') {
    state.overlay = { rowSpu: actionNode?.dataset.spu || '' }
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    refreshOverlays()
    return true
  }
  return false
}
