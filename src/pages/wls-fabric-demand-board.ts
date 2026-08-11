// @page-pattern: list

import {
  defaultFabricDemandBoardFilters,
  fabricDemandBoardNextActions,
  filterFabricDemandBoardRows,
  formatFabricDemandQty,
  getFabricDemandBoardAlertRules,
  getFabricDemandBoardRows,
  getWarehouseQty,
  summarizeFabricDemandBoardRows,
  type FabricDemandBoardFilters,
  type FabricDemandBoardRow,
  type FabricDemandBoardWarehouseName,
} from '../data/wls/fabric-demand-board.ts'
import { renderSecondaryButton } from '../components/ui/button.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import { createProcessOrderListController } from '../components/ui/process-order-list-controller.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import {
  resetStandardListEntryTransientStateOnRouteEntry,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import { escapeHtml } from '../utils.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

const LIST_EVENT_PREFIX = 'fabric-demand-list'
const LIST_PREFERENCE_KEY = '/wls/fabric-demand-board:list-columns'
const PAGE_SIZE_OPTIONS = [5, 10, 20]

const materialTypes: Array<FabricDemandBoardFilters['materialType']> = ['全部', '直裁面料', '印花面料', '染色面料']
const printRequirements: Array<FabricDemandBoardFilters['printRequirement']> = ['全部', '需印花', '不需印花']
const dyeRequirements: Array<FabricDemandBoardFilters['dyeRequirement']> = ['全部', '需染色', '不需染色']
const alertTypes: Array<FabricDemandBoardFilters['alertType']> = [
  '全部',
  '缺直裁面料',
  '缺印花原料',
  '缺染色原料',
  '直裁待调拨',
  '印花待调拨',
  '染色待调拨',
]
const warehouseNames: Array<FabricDemandBoardFilters['warehouseName']> = [
  '全部',
  '中央仓面料仓',
  '中转仓',
  '印花厂待加工仓',
  '染色厂待加工仓',
]

const state = {
  filters: { ...defaultFabricDemandBoardFilters } as FabricDemandBoardFilters,
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['material'], pageSize: 5 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  imagePreview: null as { url: string; title: string } | null,
}

function renderSelect<T extends string>(label: string, key: keyof FabricDemandBoardFilters, value: T, options: T[]): string {
  return `
    <label class="space-y-1 text-xs text-slate-500">
      <span>${label}</span>
      <select data-fabric-demand-filter="${key}" data-skip-page-rerender="true" class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderMetric(label: string, value: string, tone = 'slate'): string {
  const toneClass = tone === 'red'
    ? 'border-red-100 bg-red-50 text-red-700'
    : tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-700'
      : 'border-slate-200 bg-white text-slate-800'
  return `<div class="flex h-12 min-w-0 items-center justify-between gap-2 rounded-lg border px-3 ${toneClass}"><span class="truncate text-xs text-slate-500">${label}</span><strong class="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">${value}</strong></div>`
}

function renderRequirement(value: boolean, yesText: string, noText: string): string {
  return value
    ? `<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">${yesText}</span>`
    : `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${noText}</span>`
}

function toLargeImageUrl(url: string): string {
  return url.replace(/([?&])w=\d+/i, '$1w=1200').replace(/([?&])q=\d+/i, '$1q=90')
}

function renderMaterial(row: FabricDemandBoardRow): string {
  const title = `${row.materialName}（${row.materialSku}）`
  return `
    <div class="flex gap-3">
      <button type="button" class="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-fabric-demand-action="preview-image" data-image-url="${escapeHtml(toLargeImageUrl(row.materialImageUrl))}" data-image-title="${escapeHtml(title)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(title)}大图">
        <img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(title)}面料图" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
        <span hidden class="px-1 text-[10px] text-rose-700">图片失败</span>
      </button>
      <div class="min-w-0 space-y-1 text-xs">
        <div class="text-sm font-medium text-slate-900">${escapeHtml(row.materialName)}</div>
        <div class="text-slate-500">面料 SPU：${escapeHtml(row.materialSpu)}</div>
        <div class="break-all text-slate-500">面料 SKU：${escapeHtml(row.materialSku)}</div>
        <div class="text-slate-500">类型：${escapeHtml(row.materialType)}</div>
        <div class="flex flex-wrap gap-1">${renderRequirement(row.requiresPrint, '需印花', '不需印花')}${renderRequirement(row.requiresDye, '需染色', '不需染色')}</div>
      </div>
    </div>
  `
}

function renderWarehouseStocks(row: FabricDemandBoardRow): string {
  const total = row.warehouseStocks.reduce((sum, stock) => sum + stock.qty, 0)
  return `
    <div class="space-y-1">
      <div class="mb-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-900">总库存 ${formatFabricDemandQty(total)}</div>
      ${row.warehouseStocks.map((stock) => `<div class="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2 py-1"><span class="text-xs text-slate-600">${escapeHtml(stock.warehouseName)}</span><span class="whitespace-nowrap text-xs font-medium text-slate-900">${formatFabricDemandQty(stock.qty)}</span></div>`).join('')}
    </div>
  `
}

function renderRawMaterial(row: FabricDemandBoardRow): string {
  if (!row.requiresPrint && !row.requiresDye) {
    return `<div class="space-y-1 text-xs"><div class="font-medium text-slate-900">不涉及印花/染色原料转换</div><div class="text-slate-500">直裁按目标面料备料，库存见多仓库存列。</div></div>`
  }

  const destination: FabricDemandBoardWarehouseName = row.requiresPrint ? '印花厂待加工仓' : '染色厂待加工仓'
  const centralQty = getWarehouseQty(row, '中央仓面料仓')
  const destinationQty = getWarehouseQty(row, destination)
  const total = centralQty + destinationQty
  const coverage = total >= row.rawMaterialDemandQty
    ? `合计 ${formatFabricDemandQty(total)}，已覆盖需求；目的仓仍缺 ${formatFabricDemandQty(Math.max(row.rawMaterialDemandQty - destinationQty, 0))} 待调拨`
    : `合计 ${formatFabricDemandQty(total)}，缺口 ${formatFabricDemandQty(row.rawMaterialDemandQty - total)}`

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium text-slate-900">${escapeHtml(row.rawMaterialName)}</div>
      <div class="break-all text-slate-500">原料 SKU：${escapeHtml(row.rawMaterialSku)}</div>
      <div class="text-slate-500">原料需求：${formatFabricDemandQty(row.rawMaterialDemandQty)}</div>
      <div class="text-slate-500">中央仓面料仓：${formatFabricDemandQty(centralQty)}</div>
      <div class="text-slate-500">${destination}：${formatFabricDemandQty(destinationQty)}</div>
      <div class="font-medium text-slate-700">${coverage}</div>
    </div>
  `
}

function renderProcessQty(waitPickup: number, processingLabel: string, processingQty: number, waitInbound: number): string {
  return `<div class="space-y-1 text-xs"><div class="flex justify-between gap-3"><span class="text-slate-500">待接收</span><span>${formatFabricDemandQty(waitPickup)}</span></div><div class="flex justify-between gap-3"><span class="text-slate-500">${processingLabel}</span><span>${formatFabricDemandQty(processingQty)}</span></div><div class="flex justify-between gap-3"><span class="text-slate-500">待入库</span><span>${formatFabricDemandQty(waitInbound)}</span></div></div>`
}

function renderPurchaseQty(row: FabricDemandBoardRow): string {
  return `<div class="space-y-1 text-xs"><div class="flex justify-between gap-3"><span class="text-slate-500">采购中</span><span>${formatFabricDemandQty(row.purchaseQty.purchasingQty)}</span></div><div class="flex justify-between gap-3"><span class="text-slate-500">转运中</span><span>${formatFabricDemandQty(row.purchaseQty.transitQty)}</span></div><div class="flex justify-between gap-3"><span class="text-slate-500">待入库</span><span>${formatFabricDemandQty(row.purchaseQty.waitInboundQty)}</span></div></div>`
}

function renderAlerts(row: FabricDemandBoardRow): string {
  return `<div class="space-y-2">${row.alerts.map((alert) => `<div class="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><div class="flex items-center justify-between gap-3"><span class="font-medium">${escapeHtml(alert.type)}</span><span class="whitespace-nowrap">差额 ${formatFabricDemandQty(alert.gapQty)}</span></div><div class="mt-1 text-amber-800">${escapeHtml(alert.reasonText)}</div><div class="mt-1 text-amber-800">责任人：${escapeHtml(alert.ownerText)}；${escapeHtml(alert.resolveText)}</div></div>`).join('')}</div>`
}

function processTotal(row: FabricDemandBoardRow, type: 'print' | 'dye'): number {
  const qty = type === 'print' ? row.printQty : row.dyeQty
  return qty.waitPickupQty + qty.processingQty + qty.waitInboundQty
}

const listColumns: StandardListColumn<FabricDemandBoardRow>[] = [
  { key: 'material', title: '面料信息', width: 300, required: true, freezeable: true, sortable: true, sortValue: (row) => row.materialName, render: renderMaterial },
  { key: 'warehouse', title: '多仓库存', width: 230, sortable: true, sortValue: (row) => row.warehouseStocks.reduce((sum, stock) => sum + stock.qty, 0), render: renderWarehouseStocks },
  { key: 'rawMaterial', title: '原料库存', width: 250, sortable: true, sortValue: (row) => row.rawMaterialName, render: renderRawMaterial },
  { key: 'printing', title: '印花数据', width: 160, sortable: true, sortValue: (row) => processTotal(row, 'print'), render: (row) => renderProcessQty(row.printQty.waitPickupQty, '印花中', row.printQty.processingQty, row.printQty.waitInboundQty) },
  { key: 'dyeing', title: '染色数据', width: 160, sortable: true, sortValue: (row) => processTotal(row, 'dye'), render: (row) => renderProcessQty(row.dyeQty.waitPickupQty, '染色中', row.dyeQty.processingQty, row.dyeQty.waitInboundQty) },
  { key: 'purchase', title: '采购数据', width: 160, sortable: true, sortValue: (row) => row.purchaseQty.purchasingQty + row.purchaseQty.transitQty + row.purchaseQty.waitInboundQty, render: renderPurchaseQty },
  { key: 'alerts', title: '异常预警', width: 320, required: true, sortable: true, sortValue: (row) => row.alerts.reduce((sum, alert) => sum + alert.gapQty, 0), render: renderAlerts },
]

function getFilteredRows(): FabricDemandBoardRow[] {
  return filterFabricDemandBoardRows(getFabricDemandBoardRows(), state.filters)
}

const listController = createProcessOrderListController({
  state,
  columns: listColumns,
  preferenceKey: LIST_PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: LIST_EVENT_PREFIX,
  rootSelector: '[data-wls-fabric-demand-board-root]',
  tableSurfaceSelector: '[data-wls-fabric-demand-board-table-surface]',
  paginationSurfaceSelector: '[data-wls-fabric-demand-board-pagination-surface]',
  overlaysSurfaceSelector: '[data-wls-fabric-demand-board-column-overlays]',
  defaultFrozenKeys: ['material'],
  columnSettingsTitle: '面料需求看板列设置',
  emptyText: '当前筛选下暂无面料需求',
  getRows: getFilteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  const filters = state.filters
  return `
    <section class="rounded-lg border border-slate-200 bg-white p-4">
      <div class="mb-3"><div class="text-sm font-semibold text-slate-900">数据搜索区</div><p class="mt-1 text-xs text-slate-500">按目标面料 SKU 查看多仓库存、原料库存、加工在途和异常预警。</p></div>
      <div class="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_0.95fr_0.95fr_1fr_1.35fr_1fr_auto]">
        <label class="space-y-1 text-xs text-slate-500"><span>关键词</span><input data-fabric-demand-filter="keyword" data-skip-page-rerender="true" value="${escapeHtml(filters.keyword)}" placeholder="面料名称 / 面料 SKU / 面料 SPU" class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-700" /></label>
        ${renderSelect<FabricDemandBoardFilters['materialType']>('面料类型', 'materialType', filters.materialType, materialTypes)}
        ${renderSelect<FabricDemandBoardFilters['printRequirement']>('是否需印花', 'printRequirement', filters.printRequirement, printRequirements)}
        ${renderSelect<FabricDemandBoardFilters['dyeRequirement']>('是否需染色', 'dyeRequirement', filters.dyeRequirement, dyeRequirements)}
        ${renderSelect<FabricDemandBoardFilters['alertType']>('异常类型', 'alertType', filters.alertType, alertTypes)}
        ${renderSelect<FabricDemandBoardFilters['nextAction']>('后续建议工作', 'nextAction', filters.nextAction, fabricDemandBoardNextActions)}
        ${renderSelect<FabricDemandBoardFilters['warehouseName']>('仓库/目的仓', 'warehouseName', filters.warehouseName, warehouseNames)}
        <div class="flex h-9 items-center justify-end gap-2 md:col-span-3 xl:col-span-1"><button type="button" class="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50" data-fabric-demand-action="reset" data-skip-page-rerender="true">重置</button><button type="button" class="h-9 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800" data-fabric-demand-action="filter" data-skip-page-rerender="true">筛选</button></div>
      </div>
    </section>
  `
}

function renderStats(rows: FabricDemandBoardRow[]): string {
  const summary = summarizeFabricDemandBoardRows(rows)
  return `
    <section class="space-y-2">
      <div class="text-sm font-semibold text-slate-900">数据统计区</div>
      <div class="grid gap-2 md:grid-cols-4 xl:grid-cols-8" data-standard-list-stats>
        ${renderMetric('总数', `${summary.totalSkuCount} 个`)}
        ${renderMetric('印染数量', `${summary.printOrDyeSkuCount} 个`, 'blue')}
        ${renderMetric('直裁数量', `${summary.directCutSkuCount} 个`)}
        ${renderMetric('印花中 Yard', formatFabricDemandQty(summary.printingQty), 'blue')}
        ${renderMetric('染色中 Yard', formatFabricDemandQty(summary.dyeingQty), 'blue')}
        ${renderMetric('裁剪中 Yard', formatFabricDemandQty(summary.cuttingQty))}
        ${renderMetric('采购中 Yard', formatFabricDemandQty(summary.purchasingQty), 'red')}
        ${renderMetric('库存数量', formatFabricDemandQty(summary.stockQty))}
      </div>
    </section>
  `
}

function renderImagePreview(): string {
  if (!state.imagePreview) return ''
  const preview = state.imagePreview
  return `
    <div class="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="${escapeHtml(preview.title)}大图预览" data-wls-fabric-demand-image-preview>
      <button type="button" class="absolute inset-0 bg-slate-950/70" data-fabric-demand-action="close-image-preview" data-skip-page-rerender="true" aria-label="关闭大图预览"></button>
      <section class="relative z-10 flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b px-5 py-3"><h2 class="truncate font-semibold text-slate-900">${escapeHtml(preview.title)}</h2><button type="button" class="h-8 w-8 shrink-0 rounded-md border" data-fabric-demand-action="close-image-preview" data-skip-page-rerender="true" aria-label="关闭大图预览">×</button></header>
        <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-5"><img src="${escapeHtml(preview.url)}" alt="${escapeHtml(preview.title)}高清大图" class="max-h-[calc(100vh-9rem)] max-w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><p hidden class="p-12 text-sm text-rose-700">图片加载失败，请稍后重试。</p></div>
      </section>
    </div>
  `
}

function refreshStatsLocally(): void {
  if (typeof document === 'undefined') return
  const surface = document.querySelector<HTMLElement>('[data-wls-fabric-demand-board-stats-surface]')
  if (surface) surface.innerHTML = renderStats(getFilteredRows())
}

function refreshFiltersLocally(): void {
  if (typeof document === 'undefined') return
  const surface = document.querySelector<HTMLElement>('[data-wls-fabric-demand-board-filters-surface]')
  if (surface) surface.innerHTML = renderFilters()
}

function refreshImagePreviewLocally(): void {
  if (typeof document === 'undefined') return
  const surface = document.querySelector<HTMLElement>('[data-wls-fabric-demand-board-image-overlay]')
  if (surface) surface.innerHTML = renderImagePreview()
}

function refreshListLocally(options: { filters?: boolean } = {}): void {
  if (options.filters) refreshFiltersLocally()
  refreshStatsLocally()
  listController.refresh()
}

let imagePreviewEscapeInstalled = false

function installImagePreviewEscape(): void {
  if (imagePreviewEscapeInstalled || typeof document === 'undefined') return
  imagePreviewEscapeInstalled = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !state.imagePreview || !document.querySelector('[data-wls-fabric-demand-board-root]')) return
    event.preventDefault()
    event.stopPropagation()
    state.imagePreview = null
    refreshImagePreviewLocally()
  }, true)
}

export function renderWlsFabricDemandBoardPage(): string {
  const hasMountedRoot = typeof document !== 'undefined' && Boolean(document.querySelector('[data-wls-fabric-demand-board-root]'))
  resetStandardListEntryTransientStateOnRouteEntry(state, hasMountedRoot)
  if (!hasMountedRoot) {
    state.showColumnSettings = false
    state.imagePreview = null
  }
  listController.installColumnDragEvents()
  listController.ensurePreferencesLoaded()
  installImagePreviewEscape()
  const rows = getFilteredRows()
  const view = listController.getView(rows)
  const ruleCount = getFabricDemandBoardAlertRules().length

  return `<div data-wls-fabric-demand-board-root data-testid="wls-fabric-demand-board-page" data-skip-page-rerender="true">${renderStandardListPage({
    title: '面料需求看板',
    primaryActionsHtml: `<div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">异常规则 ${ruleCount} 类</div>`,
    filtersHtml: `<div data-wls-fabric-demand-board-filters-surface>${renderFilters()}</div>`,
    statsHtml: `<div data-wls-fabric-demand-board-stats-surface>${renderStats(rows)}</div>`,
    listTitle: '数据展示区',
    listActionsHtml: `<div class="flex items-center gap-3"><span class="text-xs text-slate-500">多仓库存 / 原料库存 / 异常预警</span>${renderSecondaryButton('列设置', { prefix: LIST_EVENT_PREFIX, action: 'open-column-settings', skipPageRerender: true }, 'settings-2')}</div>`,
    tableHtml: `<div data-wls-fabric-demand-board-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wls-fabric-demand-board-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wls-fabric-demand-board-column-overlays>${listController.renderColumnSettings()}</div><div data-wls-fabric-demand-board-image-overlay>${renderImagePreview()}</div>`,
    className: 'pt-3',
  })}</div>`
}

export function handleWlsFabricDemandBoardEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-fabric-demand-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const key = filterNode.dataset.fabricDemandFilter as keyof FabricDemandBoardFilters | undefined
    if (!key) return true
    state.filters = { ...state.filters, [key]: filterNode.value } as FabricDemandBoardFilters
    state.currentPage = 1
    refreshListLocally()
    return true
  }

  const listField = target.closest<HTMLSelectElement>('[data-fabric-demand-list-field]')
  if (listField?.dataset.fabricDemandListField === 'pageSize') {
    listController.setPageSize(Number(listField.value))
    listController.refresh()
    return true
  }

  const listAction = target.closest<HTMLElement>('[data-fabric-demand-list-action]')
  if (listAction) {
    const action = listAction.dataset.fabricDemandListAction || ''
    if (action === 'prev-page' || action === 'next-page') listController.stepPage(action === 'next-page' ? 1 : -1)
    if (action === 'sort-column') listController.cycleSort(listAction.dataset.columnKey || '')
    if (action === 'open-column-settings') {
      state.showColumnSettings = true
      listController.refresh({ table: false, pagination: false, overlays: true })
      return true
    }
    if (action === 'close-column-settings') {
      state.showColumnSettings = false
      listController.refresh({ table: false, pagination: false, overlays: true })
      return true
    }
    if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = listAction.dataset.fabricDemandListColumnKey
        || listAction.closest<HTMLElement>('[data-fabric-demand-list-column-key]')?.dataset.fabricDemandListColumnKey
        || ''
      listController.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined)
      listController.refresh({ overlays: true })
      return true
    }
    if (action === 'restore-column-settings') listController.restorePreferences()
    listController.refresh({ overlays: state.showColumnSettings })
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-fabric-demand-action]')
  if (!actionNode) return Boolean(listField)
  const action = actionNode.dataset.fabricDemandAction

  if (action === 'reset') {
    state.filters = { ...defaultFabricDemandBoardFilters }
    state.currentPage = 1
    refreshListLocally({ filters: true })
  } else if (action === 'filter') {
    state.currentPage = 1
    refreshListLocally()
  } else if (action === 'preview-image') {
    state.imagePreview = { url: actionNode.dataset.imageUrl || '', title: actionNode.dataset.imageTitle || '面料' }
    refreshImagePreviewLocally()
  } else if (action === 'close-image-preview') {
    state.imagePreview = null
    refreshImagePreviewLocally()
  }

  return true
}
