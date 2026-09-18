// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { stockRealtimeSeed } from '../../../data/wls/seed/stock-seed'
import { materialCategoryLabelMap } from '../../../data/wls/shared/warehouse-config'
import type { StockRealtimeItem, MaterialInventorySummary, MaterialCategory } from '../../../data/wls/types'

type Variant = 'finished' | 'raw' | 'transit'

function formatDualQty(pkgQty: number, pkgUnit: string, baseQty: number, baseUnit: string): string {
  return `${pkgQty} ${pkgUnit} / ${baseQty} ${baseUnit}`
}

const RAW_MATERIAL_INVENTORY: MaterialInventorySummary[] = (() => {
  const warehouses = ['中央总仓-面料仓', '中央总仓-辅料仓', '中央总仓-纱线仓', '中央总仓-耗材仓', '中央总仓-包材仓']
  const items: MaterialInventorySummary[] = []
  const sampleData = [
    { cat: 'FABRIC' as MaterialCategory, name: '全棉平纹布 32S', spu: 'SPU-MF-10001', sku: 'SKU-MF-10001', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 120, base: 9600, availPkg: 98, availBase: 7840, reqPkg: 12, reqBase: 960, pendPkg: 10, pendBase: 800 },
    { cat: 'FABRIC' as MaterialCategory, name: '涤纶针织面料 40D', spu: 'SPU-MF-10002', sku: 'SKU-MF-10002', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 85, base: 6800, availPkg: 70, availBase: 5600, reqPkg: 8, reqBase: 640, pendPkg: 7, pendBase: 560 },
    { cat: 'FABRIC' as MaterialCategory, name: '氨纶弹力布 20D', spu: 'SPU-MF-10003', sku: 'SKU-MF-10003', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 3, base: 240, availPkg: 0, availBase: 0, reqPkg: 3, reqBase: 240, pendPkg: 0, pendBase: 0 },
    { cat: 'ACCESSORY' as MaterialCategory, name: '树脂纽扣 11.5mm 白色', spu: 'SPU-MA-20001', sku: 'SKU-MA-20001', wh: '中央总仓-辅料仓', pkgU: '包', baseU: '颗', pkg: 200, base: 40000, availPkg: 180, availBase: 36000, reqPkg: 15, reqBase: 3000, pendPkg: 5, pendBase: 1000 },
    { cat: 'ACCESSORY' as MaterialCategory, name: '金属拉链 5# 黑色 60cm', spu: 'SPU-MA-20002', sku: 'SKU-MA-20002', wh: '中央总仓-辅料仓', pkgU: '包', baseU: '颗', pkg: 150, base: 30000, availPkg: 120, availBase: 24000, reqPkg: 20, reqBase: 4000, pendPkg: 10, pendBase: 2000 },
    { cat: 'YARN' as MaterialCategory, name: '缝纫线 40S/2 本白', spu: 'SPU-MY-30001', sku: 'SKU-MY-30001', wh: '中央总仓-纱线仓', pkgU: '包', baseU: 'kg', pkg: 96, base: 2400, availPkg: 80, availBase: 2000, reqPkg: 6, reqBase: 150, pendPkg: 10, pendBase: 250 },
    { cat: 'YARN' as MaterialCategory, name: '绣花线 120D 藏青', spu: 'SPU-MY-30002', sku: 'SKU-MY-30002', wh: '中央总仓-纱线仓', pkgU: '包', baseU: 'kg', pkg: 6, base: 150, availPkg: 4, availBase: 100, reqPkg: 2, reqBase: 50, pendPkg: 0, pendBase: 0 },
    { cat: 'CONSUMABLE' as MaterialCategory, name: '工业缝纫针 DB×1 14#', spu: 'SPU-MC-40001', sku: 'SKU-MC-40001', wh: '中央总仓-耗材仓', pkgU: '包', baseU: '个', pkg: 50, base: 3000, availPkg: 45, availBase: 2700, reqPkg: 3, reqBase: 180, pendPkg: 2, pendBase: 120 },
    { cat: 'PACKAGING' as MaterialCategory, name: 'OPP透明包装袋 30×40cm', spu: 'SPU-MP-50001', sku: 'SKU-MP-50001', wh: '中央总仓-包材仓', pkgU: '箱', baseU: '个', pkg: 80, base: 9600, availPkg: 72, availBase: 8640, reqPkg: 5, reqBase: 600, pendPkg: 3, pendBase: 360 },
    { cat: 'PACKAGING' as MaterialCategory, name: '瓦楞纸箱 5层 60×40×30cm', spu: 'SPU-MP-50002', sku: 'SKU-MP-50002', wh: '中央总仓-包材仓', pkgU: '箱', baseU: '个', pkg: 45, base: 5400, availPkg: 38, availBase: 4560, reqPkg: 4, reqBase: 480, pendPkg: 3, pendBase: 360 },
    { cat: 'FABRIC' as MaterialCategory, name: '亚麻棉混纺 20×16', spu: 'SPU-MF-10004', sku: 'SKU-MF-10004', wh: '中央总仓-面料仓', pkgU: '卷', baseU: '米', pkg: 0, base: 0, availPkg: 0, availBase: 0, reqPkg: 0, reqBase: 0, pendPkg: 0, pendBase: 0 },
    { cat: 'ACCESSORY' as MaterialCategory, name: '热转印标码 S码', spu: 'SPU-MA-20003', sku: 'SKU-MA-20003', wh: '中央总仓-辅料仓', pkgU: '包', baseU: '颗', pkg: 300, base: 60000, availPkg: 280, availBase: 56000, reqPkg: 10, reqBase: 2000, pendPkg: 10, pendBase: 2000 },
  ]
  for (const d of sampleData) {
    items.push({
      id: `MI-${d.sku}`,
      material_category: d.cat,
      material_name: d.name,
      spu_code: d.spu,
      sku_code: d.sku,
      warehouse_name: d.wh,
      area_name: 'A区',
      location_code: `A-01-${String(items.length + 1).padStart(2, '0')}`,
      package_qty: d.pkg,
      package_unit: d.pkgU,
      base_qty: d.base,
      base_unit: d.baseU,
      available_package_qty: d.availPkg,
      available_base_qty: d.availBase,
      requisition_occupied_package_qty: d.reqPkg,
      requisition_occupied_base_qty: d.reqBase,
      pending_putaway_package_qty: d.pendPkg,
      pending_putaway_base_qty: d.pendBase,
      package_unit_count: d.pkg,
      supplier_name: '默认供应商',
      batch_no: `B2026${String(items.length + 1).padStart(4, '0')}`,
      stock_status: d.pkg > 0 ? '正常' : '待上架',
    })
  }
  return items;
})()

function categoryBadgeClass(cat: MaterialCategory): string {
  switch (cat) {
    case 'FABRIC': return 'bg-blue-100 text-blue-800'
    case 'ACCESSORY': return 'bg-emerald-100 text-emerald-800'
    case 'CONSUMABLE': return 'bg-orange-100 text-orange-800'
    case 'PACKAGING': return 'bg-purple-100 text-purple-800'
    default: return 'bg-cyan-100 text-cyan-800'
  }
}

const EVENT_PREFIX = 'wls-stock-realtime'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY_BASE = '/wls/finished/stock-realtime:list-columns:'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  activeVariant: 'finished' as Variant,
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 20 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  categoryFilter: '' as string,
  warehouseFilter: '' as string,
}

function preferenceKey(): string {
  return PREFERENCE_KEY_BASE + state.activeVariant
}

/* ---------- Finished / Transit columns ---------- */

const finishedColumns: StandardListColumn<StockRealtimeItem>[] = [
  { key: 'image', title: '商品图片', width: 100, required: true,
    render: r => `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.productName)}" class="h-12 w-12 rounded-md border border-slate-200 object-cover" onerror="this.style.display='none'">` },
  { key: 'productName', title: '商品名称', width: 180, sortable: true, sortValue: r => r.productName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productName)}</span>` },
  { key: 'spu', title: '商品SPU', width: 160, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'warehouseName', title: '仓库名称', width: 160, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'totalStock', title: '总库存', width: 90, align: 'right', sortable: true, sortValue: r => r.spotStock + r.transitStock,
    render: r => `<span class="font-medium text-slate-700">${r.spotStock + r.transitStock}</span>` },
  { key: 'spotStock', title: '现货库存', width: 100, align: 'right', sortable: true, sortValue: r => r.spotStock,
    render: r => `<span class="text-slate-600">${r.spotStock}</span>` },
  { key: 'transitStock', title: '在途库存', width: 100, align: 'right', sortable: true, sortValue: r => r.transitStock,
    render: r => `<span class="text-slate-600">${r.transitStock}</span>` },
  { key: 'pendingReturnQualityQuantity', title: '退货待检库存', width: 120, align: 'right', sortable: true, sortValue: r => r.pendingReturnQualityQuantity,
    render: r => `<span class="font-semibold text-orange-700">${r.pendingReturnQualityQuantity}</span>` },
  { key: 'defectiveStock', title: '瑕疵品库存', width: 100, align: 'right', sortable: true, sortValue: r => r.defectiveStock,
    render: r => `<span class="font-semibold text-red-700">${r.defectiveStock}</span>` },
  { key: 'damagedStock', title: '破损库存', width: 100, align: 'right', sortable: true, sortValue: r => r.damagedStock,
    render: r => `<span class="font-semibold text-red-800">${r.damagedStock}</span>` },
  { key: 'preSaleOrderOccupiedQuantity', title: '预售订单占用', width: 120, align: 'right', sortable: true, sortValue: r => r.preSaleOrderOccupiedQuantity,
    render: r => `<span class="font-semibold text-red-700">${r.preSaleOrderOccupiedQuantity}</span>` },
  { key: 'spotOrderOccupiedQuantity', title: '现货订单占用', width: 120, align: 'right', sortable: true, sortValue: r => r.spotOrderOccupiedQuantity,
    render: r => `<span class="font-semibold text-red-700">${r.spotOrderOccupiedQuantity}</span>` },
  { key: 'availableStock', title: '可售库存', width: 100, align: 'right', sortable: true,
    sortValue: r => r.spotStock <= 0 ? 0 : Math.max(0, r.spotStock - r.preSaleOrderOccupiedQuantity - r.spotOrderOccupiedQuantity),
    render: r => {
      const avail = r.spotStock <= 0 ? 0 : Math.max(0, r.spotStock - r.preSaleOrderOccupiedQuantity - r.spotOrderOccupiedQuantity)
      return `<span class="font-semibold text-emerald-700">${avail}</span>`
    } },
]

/* ---------- Transit columns (adds unit) ---------- */

const transitColumns: StandardListColumn<StockRealtimeItem>[] = [
  ...finishedColumns.slice(0, 4),
  { key: 'unit', title: '单位', width: 70, sortable: true, sortValue: r => r.unit || '',
    render: r => `<span class="text-slate-600">${escapeHtml(r.unit || '-')}</span>` },
  ...finishedColumns.slice(4),
]

/* ---------- Raw material columns ---------- */

const rawColumns: StandardListColumn<MaterialInventorySummary>[] = [
  { key: 'category', title: '物料分类', width: 110, sortable: true, sortValue: r => r.material_category,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${categoryBadgeClass(r.material_category)}">${escapeHtml(materialCategoryLabelMap[r.material_category] || r.material_category)}</span>` },
  { key: 'materialName', title: '物料名称', width: 200, sortable: true, sortValue: r => r.material_name,
    render: r => `<span class="text-slate-700">${escapeHtml(r.material_name)}</span>` },
  { key: 'spuCode', title: '物料SPU', width: 160, sortable: true, sortValue: r => r.spu_code,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.spu_code)}</span>` },
  { key: 'skuCode', title: '物料SKU', width: 160, sortable: true, sortValue: r => r.sku_code,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku_code)}</span>` },
  { key: 'warehouseName', title: '仓库', width: 160, sortable: true, sortValue: r => r.warehouse_name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse_name)}</span>` },
  { key: 'totalStock', title: '总库存', width: 140, align: 'right', sortable: true, sortValue: r => r.package_qty,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(formatDualQty(r.package_qty, r.package_unit, r.base_qty, r.base_unit))}</span>` },
  { key: 'spotStock', title: '现货库存', width: 140, align: 'right', sortable: true,
    sortValue: r => Math.max(0, r.package_qty - r.pending_putaway_package_qty),
    render: r => `<span class="text-slate-600">${escapeHtml(formatDualQty(Math.max(0, r.package_qty - r.pending_putaway_package_qty), r.package_unit, Math.max(0, r.base_qty - r.pending_putaway_base_qty), r.base_unit))}</span>` },
  { key: 'transitStock', title: '在途库存', width: 140, align: 'right', sortable: true, sortValue: r => r.pending_putaway_package_qty,
    render: r => `<span class="text-slate-600">${escapeHtml(formatDualQty(r.pending_putaway_package_qty, r.package_unit, r.pending_putaway_base_qty, r.base_unit))}</span>` },
  { key: 'requisitionOccupied', title: '领料单占用', width: 140, align: 'right', sortable: true, sortValue: r => r.requisition_occupied_base_qty,
    render: r => `<span class="text-red-700">${r.requisition_occupied_base_qty > 0 ? escapeHtml(formatDualQty(r.requisition_occupied_package_qty, r.package_unit, r.requisition_occupied_base_qty, r.base_unit)) : '0'}</span>` },
  { key: 'availableStock', title: '可用库存', width: 140, align: 'right', sortable: true, sortValue: r => r.available_package_qty,
    render: r => `<span class="font-semibold text-emerald-700">${escapeHtml(formatDualQty(r.available_package_qty, r.package_unit, r.available_base_qty, r.base_unit))}</span>` },
  { key: 'pendingPutaway', title: '待上架库存', width: 140, align: 'right', sortable: true, sortValue: r => r.pending_putaway_package_qty,
    render: r => `<span class="text-orange-700">${escapeHtml(formatDualQty(r.pending_putaway_package_qty, r.package_unit, r.pending_putaway_base_qty, r.base_unit))}</span>` },
]

/* ---------- Column rules & preferences ---------- */

function activeColumns(): StandardListColumn<unknown>[] {
  if (state.activeVariant === 'raw') return rawColumns as StandardListColumn<unknown>[]
  if (state.activeVariant === 'transit') return transitColumns as StandardListColumn<unknown>[]
  return finishedColumns as StandardListColumn<unknown>[]
}

function columnRules() {
  return activeColumns().map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
}

function defaultPreferences(): StandardListColumnPreferences {
  const cols = activeColumns()
  return {
    order: cols.map(c => c.key),
    visibleKeys: cols.map(c => c.key),
    frozenKeys: cols.filter(c => c.freezeable && c.required).map(c => c.key).slice(0, 2),
    pageSize: PAGE_SIZE_OPTIONS[1],
  }
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, preferenceKey(), columnRules(), defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

/* ---------- Data accessors ---------- */

function getFinishedItems(): StockRealtimeItem[] {
  return stockRealtimeSeed.filter(item => {
    if (state.activeVariant === 'transit') return item.warehouse_type === 'TRANSIT'
    return item.warehouse_type !== 'TRANSIT' && item.warehouse_type !== 'FABRIC' && item.warehouse_type !== 'ACCESSORY' && item.warehouse_type !== 'YARN' && item.warehouse_type !== 'CONSUMABLE' && item.warehouse_type !== 'PACKAGING'
  })
}

function getRawItems(): MaterialInventorySummary[] {
  return RAW_MATERIAL_INVENTORY
}

function filteredRowCount(): number {
  const kw = state.keyword.trim().toLowerCase()
  if (state.activeVariant === 'raw') {
    return getRawItems().filter(item => {
      if (state.categoryFilter && item.material_category !== state.categoryFilter) return false
      if (state.warehouseFilter && item.warehouse_name !== state.warehouseFilter) return false
      if (!kw) return true
      return `${item.material_name} ${item.spu_code} ${item.sku_code} ${item.warehouse_name}`.toLowerCase().includes(kw)
    }).length
  }
  return getFinishedItems().filter(item => {
    if (state.warehouseFilter && item.warehouseName !== state.warehouseFilter) return false
    if (!kw) return true
    return `${item.productName} ${item.spu} ${item.sku} ${item.warehouseName}`.toLowerCase().includes(kw)
  }).length
}

/* ---------- Filters ---------- */

function renderFilters(): string {
  if (state.activeVariant === 'raw') {
    const rawWarehouseOptions = [...new Set(RAW_MATERIAL_INVENTORY.map(i => i.warehouse_name))]
    const categories: Array<{ value: MaterialCategory; label: string }> = [
      { value: 'FABRIC', label: '面料' }, { value: 'ACCESSORY', label: '辅料' },
      { value: 'CONSUMABLE', label: '耗材' }, { value: 'PACKAGING', label: '包材' }, { value: 'YARN', label: '纱线' },
    ]
    return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="物料名称 / SPU / SKU / 库位" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">物料分类</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="category"><option value="">全部</option>${categories.map(c => `<option value="${c.value}" ${state.categoryFilter === c.value ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部</option>${rawWarehouseOptions.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
  }

  const warehouses = [...new Set(getFinishedItems().map(i => i.warehouseName))]
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-3"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="商品名称 / SPU / SKU / 仓库名称" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部</option>${warehouses.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

/* ---------- Workspace ---------- */

function titleForVariant(v: Variant): string {
  return v === 'raw' ? '即时库存查询 — 原料' : v === 'transit' ? '即时库存查询 — 在途' : '即时库存查询 — 成衣'
}

function filteredRows(): unknown[] {
  const kw = state.keyword.trim().toLowerCase()
  if (state.activeVariant === 'raw') {
    return getRawItems().filter(item => {
      if (state.categoryFilter && item.material_category !== state.categoryFilter) return false
      if (state.warehouseFilter && item.warehouse_name !== state.warehouseFilter) return false
      if (!kw) return true
      return `${item.material_name} ${item.spu_code} ${item.sku_code} ${item.warehouse_name}`.toLowerCase().includes(kw)
    })
  }
  return getFinishedItems().filter(item => {
    if (state.warehouseFilter && item.warehouseName !== state.warehouseFilter) return false
    if (!kw) return true
    return `${item.productName} ${item.spu} ${item.sku} ${item.warehouseName}`.toLowerCase().includes(kw)
  })
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const variant = state.activeVariant
  const cols = activeColumns()
  const total = filteredRowCount()
  const rows = filteredRows()

  const sorted = sortStandardListRows(rows, state.sort, (row, key) => {
    const col = cols.find(c => c.key === key)
    return col?.sortValue?.(row as never)
  })
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const statsItems = variant === 'raw'
    ? [
        { label: '物料总数', value: `${RAW_MATERIAL_INVENTORY.length} 条` },
        { label: '面料', value: `${RAW_MATERIAL_INVENTORY.filter(i => i.material_category === 'FABRIC').length} 条` },
        { label: '辅料', value: `${RAW_MATERIAL_INVENTORY.filter(i => i.material_category === 'ACCESSORY').length} 条` },
      ]
    : [
        { label: '商品总数', value: `${getFinishedItems().length} 条` },
        { label: '现货充足', value: `${getFinishedItems().filter(i => i.spotStock > 10).length} 条` },
        { label: '低库存', value: `${getFinishedItems().filter(i => i.spotStock <= 10 && i.spotStock > 0).length} 条` },
      ]

  return renderStandardListPage({
    title: titleForVariant(variant),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats(statsItems),
    listTitle: variant === 'raw' ? '原料库存列表' : '商品库存列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns: cols, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无库存数据' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: `${titleForVariant(variant)} 列设置`, columns: cols, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

function renderVariant(variant: Variant): string {
  state.activeVariant = variant
  state.preferencesLoaded = false
  state.currentPage = 1
  state.keyword = ''
  state.categoryFilter = ''
  state.warehouseFilter = ''
  state.sort = null
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function renderFinishedStockRealtime(): string {
  return renderVariant('finished')
}

export function renderRawStockRealtime(): string {
  return renderVariant('raw')
}

export function renderTransitStockRealtime(): string {
  return renderVariant('transit')
}

export function handleStockRealtimeEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'category') { state.categoryFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.preferences.pageSize = Number((field as HTMLSelectElement).value)
      state.currentPage = 1
      saveListColumnPreferences(window.localStorage, preferenceKey(), state.preferences)
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const category = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="category"]`)
    if (category) state.categoryFilter = category.value
    const warehouse = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="warehouse"]`)
    if (warehouse) state.warehouseFilter = warehouse.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.categoryFilter = ''
    state.warehouseFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, preferenceKey(), state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${DATASET_PREFIX}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${DATASET_PREFIX}ColumnKey`] || ''
    const cols = activeColumns()
    const col = cols.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, preferenceKey(), state.preferences)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: titleForVariant(state.activeVariant), columns: activeColumns(), rows: filteredRows() }); return true }
  return false
}
