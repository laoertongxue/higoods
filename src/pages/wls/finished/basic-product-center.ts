// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  sortStandardListRows,
  loadListColumnPreferences,
  saveListColumnPreferences,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type Product = { spu: string; sku: string; name: string; productType: 'FINISHED_GOODS' | 'MATERIAL'; materialCategory: string; baseUnit: string; packagingUnit: string; sourceSystem: string; syncTime: string; syncStatus: '同步成功' | '同步中' | '同步失败' }

const syncStatusClass = (s: string) => {
  if (s === '同步成功') return 'bg-emerald-50 text-emerald-700'
  if (s === '同步中') return 'bg-blue-50 text-blue-700'
  return 'bg-red-50 text-red-700'
}

const seedProducts: Product[] = [
  { spu: 'SPU-DRESS-BLK', sku: 'SKU-DRESS-BLK-S', name: '黑色连衣裙 S', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'SPU-DRESS-BLK', sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'SPU-TEE-WHT', sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'SPU-JEAN-BLU', sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', productType: 'FINISHED_GOODS', materialCategory: '-', baseUnit: '件', packagingUnit: '件', sourceSystem: '商品中心', syncTime: '2026-08-28 08:00', syncStatus: '同步成功' },
  { spu: 'MAT-COTTON', sku: 'MAT-COTTON-001', name: '纯棉面料 A', productType: 'MATERIAL', materialCategory: '面料', baseUnit: '米', packagingUnit: '卷', sourceSystem: '物料中心', syncTime: '2026-08-28 09:00', syncStatus: '同步成功' },
  { spu: 'MAT-BUTTON', sku: 'MAT-BUTTON-001', name: '金属纽扣 银色', productType: 'MATERIAL', materialCategory: '辅料', baseUnit: '个', packagingUnit: '包', sourceSystem: '物料中心', syncTime: '2026-08-28 09:00', syncStatus: '同步中' },
  { spu: 'MAT-ZIPPER', sku: 'MAT-ZIPPER-001', name: '隐形拉链 40cm', productType: 'MATERIAL', materialCategory: '辅料', baseUnit: '条', packagingUnit: '包', sourceSystem: '物料中心', syncTime: '2026-08-28 09:00', syncStatus: '同步失败' },
]

const EVENT_PREFIX = 'wls-basic-product-center'
const PREFERENCE_KEY = '/wls/finished/basic-product-center:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  keyword: string
} = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<Product>[] = [
  { key: 'spu', title: 'SPU编码', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-slate-700">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: 'SKU编码', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-700">${escapeHtml(r.sku)}</span>` },
  { key: 'name', title: '商品 / 物料名称', width: 160, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'productType', title: '产品类型', width: 120, sortable: true, sortValue: r => r.productType,
    render: r => `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">${r.productType === 'FINISHED_GOODS' ? '成衣商品' : '面辅料物料'}</span>` },
  { key: 'materialCategory', title: '物料分类', width: 100, sortable: true, sortValue: r => r.materialCategory,
    render: r => `<span class="text-slate-600">${escapeHtml(r.materialCategory)}</span>` },
  { key: 'baseUnit', title: '基础单位', width: 80, sortable: true, sortValue: r => r.baseUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.baseUnit)}</span>` },
  { key: 'packagingUnit', title: '包装单位', width: 80, sortable: true, sortValue: r => r.packagingUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.packagingUnit)}</span>` },
  { key: 'sourceSystem', title: '来源系统', width: 100, sortable: true, sortValue: r => r.sourceSystem,
    render: r => `<span class="text-slate-600">${escapeHtml(r.sourceSystem)}</span>` },
  { key: 'syncTime', title: '同步时间', width: 150, sortable: true, sortValue: r => r.syncTime,
    render: r => `<span class="text-slate-500">${escapeHtml(r.syncTime)}</span>` },
  { key: 'syncStatus', title: '状态', width: 100, sortable: true, sortValue: r => r.syncStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${syncStatusClass(r.syncStatus)}">${escapeHtml(r.syncStatus)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: () => `<button class="text-[var(--link)] hover:underline text-xs">查看详情</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: [],
    pageSize: 20,
  }, [...PAGE_SIZE_OPTIONS])
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = defaultPreferences()
  state.preferences = typeof window === 'undefined' || typeof document === 'undefined'
    ? defaults
    : loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaults, [...PAGE_SIZE_OPTIONS])
}

function filteredRows(): Product[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return [...seedProducts]
  return seedProducts.filter(p =>
    p.spu.toLowerCase().includes(kw)
    || p.sku.toLowerCase().includes(kw)
    || p.name.toLowerCase().includes(kw)
    || p.materialCategory.toLowerCase().includes(kw)
  )
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索SPU / SKU / 名称 / 物料分类" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const rows = filteredRows()
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => {
    const col = columns.find(c => c.key === key)
    return col?.sortValue ? col.sortValue(row) : (row as Record<string, unknown>)[key]
  })
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  return renderStandardListPage({
    title: '商品中心',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '成衣商品', value: `${seedProducts.filter(p => p.productType === 'FINISHED_GOODS').length} 条` },
      { label: '面辅料物料', value: `${seedProducts.filter(p => p.productType === 'MATERIAL').length} 条` },
      { label: '同步失败', value: `${seedProducts.filter(p => p.syncStatus === '同步失败').length} 条` },
    ]),
    listTitle: `共 ${rows.length} 条 · 数据来源于外部商品中心，仅支持查询`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无数据' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 }) : '',
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateIcons(region)
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
}

export function renderBasicProductCenter(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleBasicProductCenterEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsBasicProductCenterField
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      const pageSize = Number((field as HTMLSelectElement).value)
      state.preferences.pageSize = ([...PAGE_SIZE_OPTIONS] as number[]).includes(pageSize) ? pageSize as (typeof PAGE_SIZE_OPTIONS)[number] : 10
      state.currentPage = 1
      persistPreferences()
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.wlsBasicProductCenterAction
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') { state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1)); refreshWorkspace(); return true }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.wlsBasicProductCenterColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsBasicProductCenterColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '商品中心', columns, rows: filteredRows() }); return true }
  return false
}

function updateColumnPreference(action: string, columnKey: string): void {
  const column = columns.find(item => item.key === columnKey)
  if (!column || column.actionColumn) return
  let visibleKeys = [...state.preferences.visibleKeys]
  let frozenKeys = [...state.preferences.frozenKeys]
  if (action === 'toggle-column-visibility' && !column.required) visibleKeys = visibleKeys.includes(columnKey) ? visibleKeys.filter(key => key !== columnKey) : [...visibleKeys, columnKey]
  if (action === 'toggle-column-freeze' && column.freezeable) frozenKeys = frozenKeys.includes(columnKey) ? frozenKeys.filter(key => key !== columnKey) : [...frozenKeys, columnKey]
  state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, visibleKeys, frozenKeys }, [...PAGE_SIZE_OPTIONS])
  persistPreferences()
  refreshWorkspace()
}
