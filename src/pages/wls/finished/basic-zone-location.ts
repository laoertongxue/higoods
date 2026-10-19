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
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import {
  listAccessoryWarehouseLocations,
  listAccessoryWarehouseZones,
} from '../../../data/wls/accessory-warehouse-master.ts'

type ZoneRow = { id: string; zoneName: string; warehouseName: string; warehouseCode?: string; locationCount: number; zoneType: string; enabled: boolean }

const seedData: ZoneRow[] = [
  { id: 'ZONE-A', zoneName: 'A区', warehouseName: '成衣仓', locationCount: 24, zoneType: '存储', enabled: true },
  { id: 'ZONE-B', zoneName: 'B区', warehouseName: '成衣仓', locationCount: 18, zoneType: '拣货', enabled: true },
  { id: 'ZONE-C', zoneName: 'C区-大件', warehouseName: '成衣仓', locationCount: 12, zoneType: '打包', enabled: true },
  { id: 'ZONE-D', zoneName: 'D区-瑕疵', warehouseName: '成衣仓', locationCount: 8, zoneType: '退货', enabled: true },
  { id: 'ZONE-E', zoneName: 'E区-报损', warehouseName: '成衣仓', locationCount: 6, zoneType: '暂存', enabled: false },
  { id: 'ZONE-T1', zoneName: '存储区', warehouseName: '中转仓', locationCount: 16, zoneType: '存储', enabled: true },
  { id: 'ZONE-T2', zoneName: '拣货区', warehouseName: '中转仓', locationCount: 10, zoneType: '拣货', enabled: true },
  { id: 'ZONE-K1', zoneName: 'KOL区', warehouseName: '成衣仓', locationCount: 4, zoneType: 'kol', enabled: true },
  ...listAccessoryWarehouseZones(),
]

const ZONE_TYPES = ['拣货', '存储', '打包', '退货', 'kol', '暂存']
const ZONE_TYPE_LABELS: Record<string, string> = { 拣货: '拣货区', 存储: '存储区', 打包: '打包区', 退货: '退货区', kol: 'KOL区', 暂存: '暂存区' }

const EVENT_PREFIX = 'wls-basic-zone-location'
const PREFERENCE_KEY = '/wls/finished/basic/zone-location:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  keyword: string
  warehouseFilter: string
  typeFilter: string
} = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  warehouseFilter: '',
  typeFilter: '',
}

const columns: StandardListColumn<ZoneRow>[] = [
  { key: 'select', title: '勾选', width: 50, required: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'id', title: 'ID', width: 100, required: true, freezeable: true, sortable: true, sortValue: r => r.id,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.id)}</span>` },
  { key: 'zoneName', title: '库区名称', width: 130, sortable: true, sortValue: r => r.zoneName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.zoneName)}</span>` },
  { key: 'warehouseName', title: '所属仓库', width: 120, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'locationCount', title: '库位总数', width: 100, align: 'right', sortable: true, sortValue: r => r.locationCount,
    render: r => `<span class="text-slate-600">${r.locationCount}</span>` },
  { key: 'zoneType', title: '库区类型', width: 100, sortable: true, sortValue: r => r.zoneType,
    render: r => `<span class="text-slate-600">${escapeHtml(ZONE_TYPE_LABELS[r.zoneType] || r.zoneType)}</span>` },
  { key: 'enabled', title: '是否启用', width: 90, sortable: true, sortValue: r => r.enabled,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${r.enabled ? '启用' : '停用'}</span>` },
  { key: 'actions', title: '操作', width: 240, required: true, actionColumn: true,
    render: r => `<button class="text-[var(--link)] hover:underline text-xs" data-${EVENT_PREFIX}-action="view-locations" data-zone-id="${escapeHtml(r.id)}" aria-label="查看${escapeHtml(r.warehouseName)}${escapeHtml(r.zoneName)}库位">查看库位</button>${r.warehouseCode ? '' : '<button class="text-[var(--link)] hover:underline text-xs ml-2">编辑类型</button><button class="text-[var(--link)] hover:underline text-xs ml-2">编辑</button><button class="text-red-500 hover:underline text-xs ml-2">删除</button>'}` },
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

function filteredRows(): ZoneRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedData.filter(d => {
    if (state.warehouseFilter && d.warehouseName !== state.warehouseFilter) return false
    if (state.typeFilter && d.zoneType !== state.typeFilter) return false
    if (!kw) return true
    return d.warehouseName.toLowerCase().includes(kw)
      || d.id.toLowerCase().includes(kw)
      || d.zoneName.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const warehouses = [...new Set(seedData.map(d => d.warehouseName))]
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索仓库 / 库区" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">全部仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${warehouses.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">全部类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="type"><option value="">全部类型</option>${ZONE_TYPES.map(t => `<option value="${escapeHtml(t)}" ${state.typeFilter === t ? 'selected' : ''}>${escapeHtml(ZONE_TYPE_LABELS[t] || t)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('清除', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
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

  const warehouseCount = new Set(rows.map(d => d.warehouseName)).size
  const locationCount = rows.reduce((sum, d) => sum + d.locationCount, 0)

  return renderStandardListPage({
    title: '库区库位管理',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('添加库区', { prefix: EVENT_PREFIX, action: 'add-zone' }, 'plus')}${renderPrimaryButton('添加库位', { prefix: EVENT_PREFIX, action: 'add-location' }, 'plus')}${renderSecondaryButton('库位导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('打印库位标签', { prefix: EVENT_PREFIX, action: 'print-labels' }, 'printer')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '仓库数', value: warehouseCount },
      { label: '库区数', value: rows.length },
      { label: '库位总数', value: locationCount },
    ]),
    listTitle: `共 ${rows.length} 条`,
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

let locationDetailTrigger: HTMLElement | null = null

function closeLocationDetails(restoreFocus = true): void {
  const region = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-location-overlay]`)
  if (region) region.innerHTML = ''
  if (typeof document !== 'undefined') document.removeEventListener('keydown', handleLocationDetailsKeydown)
  if (restoreFocus && locationDetailTrigger?.isConnected) locationDetailTrigger.focus()
  locationDetailTrigger = null
}

function handleLocationDetailsKeydown(event: KeyboardEvent): void {
  const dialog = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-location-overlay] [role="dialog"]`)
  if (!dialog) { closeLocationDetails(false); return }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeLocationDetails(); return }
  if (event.key !== 'Tab') return
  const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

function openLocationDetails(zoneId: string, trigger: HTMLElement): void {
  const zone = seedData.find((row) => row.id === zoneId)
  const region = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-location-overlay]`)
  if (!zone || !region) return
  const locations = zone.warehouseCode
    ? listAccessoryWarehouseLocations(zone.warehouseCode).filter((location) => location.zoneId === zone.id)
    : []
  const title = `${zone.warehouseName} · ${zone.zoneName}`
  const content = locations.length
    ? `<div class="max-h-[50vh] space-y-2 overflow-y-auto">${locations.map((location) => `<div class="flex items-center justify-between gap-4 rounded-md border p-3"><div class="min-w-0"><span class="block text-xs text-muted-foreground">库位编码</span><span class="break-all font-medium">${escapeHtml(location.locationCode)}</span></div><span class="shrink-0 rounded-full px-2 py-0.5 text-xs ${location.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${location.enabled ? '启用' : '停用'}</span></div>`).join('')}</div><p class="mt-3 text-xs text-muted-foreground">共 ${locations.length} 个库位，均为演示配置。</p>`
    : '<p class="text-sm text-muted-foreground">该历史演示库区未提供库位明细。</p>'
  closeLocationDetails(false)
  locationDetailTrigger = trigger
  region.innerHTML = renderDialog(
    { title, width: 'lg', closeAction: { prefix: EVENT_PREFIX, action: 'close-locations', skipPageRerender: true } },
    content,
    renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-locations', skipPageRerender: true }),
  )
  const panel = region.querySelector<HTMLElement>('.relative.bg-background')
  panel?.setAttribute('role', 'dialog')
  panel?.setAttribute('aria-modal', 'true')
  panel?.setAttribute('aria-label', `${title}库位`)
  const closeButtons = region.querySelectorAll<HTMLButtonElement>('button')
  closeButtons[0]?.setAttribute('aria-label', '关闭库位明细')
  hydrateIcons(region)
  document.addEventListener('keydown', handleLocationDetailsKeydown)
  closeButtons[closeButtons.length - 1]?.focus()
}

export function renderBasicZoneLocation(): string {
  if (!rootElement()) closeLocationDetails(false)
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div><div data-${EVENT_PREFIX}-location-overlay data-skip-page-rerender="true"></div></div>`
}

export function handleBasicZoneLocationEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsBasicZoneLocationField
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'type') { state.typeFilter = (field as HTMLSelectElement).value; return true }
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
  const action = actionNode?.dataset.wlsBasicZoneLocationAction
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'view-locations') { openLocationDetails(actionNode.dataset.zoneId || '', actionNode); return true }
  if (action === 'close-locations') { closeLocationDetails(); return true }
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
    updateColumnPreference(action, actionNode.dataset.wlsBasicZoneLocationColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsBasicZoneLocationColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.warehouseFilter = ''; state.typeFilter = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'add-zone') { showListFeedback('添加库区为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'add-location') { showListFeedback('添加库位为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'print-labels') { showListFeedback('已生成库位标签打印任务', 'success'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '库区库位管理', columns, rows: filteredRows() }); return true }
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
