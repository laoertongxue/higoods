// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'

type KitLine = {
  productionNo: string; sku: string; name: string; fabricType: string
  requiredQty: number; workQty: number; shelfQty: number; availableQty: number
  missingQty: number; putawayLocation: string; updateTime: string
}

const seedLines: KitLine[] = [
  { productionNo: 'PO14954', sku: 'FAB-PO14954-A', name: '主身面料', fabricType: '针织', requiredQty: 6, workQty: 6, shelfQty: 0, availableQty: 6, missingQty: 0, putawayLocation: 'TR-A-03', updateTime: '2026-07-16 10:20' },
  { productionNo: 'PO14954', sku: 'ACC-PO14954-B', name: '辅料包', fabricType: '辅料', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, putawayLocation: 'TR-A-03', updateTime: '2026-07-16 10:20' },
  { productionNo: 'PO14957', sku: 'FAB-PO14957-A', name: '主身面料', fabricType: '梭织', requiredQty: 5, workQty: 5, shelfQty: 0, availableQty: 5, missingQty: 0, putawayLocation: 'TR-A-04', updateTime: '2026-07-16 15:06' },
  { productionNo: 'PO14958', sku: 'FAB-PO14958-A', name: '主身面料', fabricType: '针织', requiredQty: 7, workQty: 6, shelfQty: 1, availableQty: 7, missingQty: 0, putawayLocation: 'TR-W-01', updateTime: '2026-07-16 09:43' },
  { productionNo: 'PO14955', sku: 'FAB-PO14955-A', name: '主身面料', fabricType: '针织', requiredQty: 8, workQty: 5, shelfQty: 0, availableQty: 5, missingQty: 3, putawayLocation: 'TR-A-01', updateTime: '2026-07-16 11:30' },
  { productionNo: 'PO14955', sku: 'ACC-PO14955-B', name: '辅料包', fabricType: '辅料', requiredQty: 3, workQty: 3, shelfQty: 0, availableQty: 3, missingQty: 0, putawayLocation: 'TR-A-01', updateTime: '2026-07-16 11:30' },
  { productionNo: 'PO14956', sku: 'FAB-PO14956-A', name: '主身面料', fabricType: '梭织', requiredQty: 10, workQty: 4, shelfQty: 0, availableQty: 4, missingQty: 6, putawayLocation: 'TR-A-02', updateTime: '2026-07-16 13:10' },
  { productionNo: 'PO14956', sku: 'ACC-PO14956-B', name: '辅料包', fabricType: '辅料', requiredQty: 3, workQty: 1, shelfQty: 0, availableQty: 1, missingQty: 2, putawayLocation: 'TR-A-02', updateTime: '2026-07-16 13:10' },
  { productionNo: 'PO14962', sku: 'FAB-PO14962-A', name: '主身面料', fabricType: '针织', requiredQty: 6, workQty: 6, shelfQty: 0, availableQty: 6, missingQty: 0, putawayLocation: 'TR-A-06', updateTime: '2026-07-16 15:40' },
  { productionNo: 'PO14963', sku: 'FAB-PO14963-A', name: '主身面料', fabricType: '针织', requiredQty: 9, workQty: 8, shelfQty: 0, availableQty: 8, missingQty: 1, putawayLocation: 'TR-A-07', updateTime: '2026-07-16 16:01' },
]

const isSatisfied = (r: KitLine): boolean => r.missingQty === 0
const shortageRatio = (r: KitLine): number => r.requiredQty > 0 ? Math.round((r.missingQty / r.requiredQty) * 100) : 0

const EVENT_PREFIX = 'wls-transit-kit'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/kit-center:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  tab: 'ALL' as 'ALL' | '满足' | '不满足',
}

const columns: StandardListColumn<KitLine>[] = [
  { key: 'select', title: '勾选', width: 50, required: true, leadingControlColumn: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'productionNo', title: '生产单号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'satisfied', title: '是否满足', width: 100, sortable: true, sortValue: r => isSatisfied(r) ? 1 : 0,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${isSatisfied(r) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${isSatisfied(r) ? '满足' : '不满足'}</span>` },
  { key: 'sku', title: 'SKU', width: 170, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'name', title: '物料信息', width: 100, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'fabricType', title: '面料类型', width: 90, sortable: true, sortValue: r => r.fabricType,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.fabricType)}</span>` },
  { key: 'requiredQty', title: '原始需求', width: 90, align: 'right', sortable: true, sortValue: r => r.requiredQty,
    render: r => `<span class="text-slate-600">${r.requiredQty}</span>` },
  { key: 'workQty', title: '作业区', width: 80, align: 'right', sortable: true, sortValue: r => r.workQty,
    render: r => `<span class="text-slate-600">${r.workQty}</span>` },
  { key: 'shelfQty', title: '货架可用', width: 90, align: 'right', sortable: true, sortValue: r => r.shelfQty,
    render: r => `<span class="text-slate-600">${r.shelfQty}</span>` },
  { key: 'availableQty', title: '合计可用', width: 90, align: 'right', sortable: true, sortValue: r => r.availableQty,
    render: r => `<span class="font-medium text-slate-700">${r.availableQty}</span>` },
  { key: 'shortageRatio', title: '短缺比例', width: 90, align: 'right', sortable: true, sortValue: r => shortageRatio(r),
    render: r => `<span class="${shortageRatio(r) > 0 ? 'font-medium text-red-600' : 'text-slate-400'}">${shortageRatio(r) > 0 ? `${shortageRatio(r)}%` : '—'}</span>` },
  { key: 'putawayLocation', title: '上架库位', width: 110, sortable: true, sortValue: r => r.putawayLocation,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.putawayLocation)}</span>` },
  { key: 'updateTime', title: '更新时间', width: 140, sortable: true, sortValue: r => r.updateTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.updateTime)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['productionNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function tabMatches(r: KitLine): boolean {
  if (state.tab === 'ALL') return true
  return isSatisfied(r) === (state.tab === '满足')
}

function renderTabsHtml(): string {
  return renderTabs({
    tabs: [
      { key: 'ALL', label: '全部', count: seedLines.length },
      { key: '满足', label: '满足', count: seedLines.filter(isSatisfied).length },
      { key: '不满足', label: '不满足', count: seedLines.filter(r => !isSatisfied(r)).length },
    ],
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function filteredRows(): KitLine[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedLines.filter(l => {
    if (!tabMatches(l)) return false
    if (!kw) return true
    return `${l.productionNo} ${l.sku} ${l.name}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="生产单号 / SKU / 物料信息" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '生产单校验',
    description: '读取已落库的生产单校验数据；收货完成/上架完成后自动同步更新',
    statusTabsHtml: renderTabsHtml(),
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('生成配料单', { prefix: EVENT_PREFIX, action: 'generate-allocation' }, 'file-plus')}${renderSecondaryButton('更新校验', { prefix: EVENT_PREFIX, action: 'refresh-check' }, 'refresh-cw')}${renderSecondaryButton('批量确认满足', { prefix: EVENT_PREFIX, action: 'batch-confirm' }, 'check-check')}${renderSecondaryButton('生产单合并处理', { prefix: EVENT_PREFIX, action: 'merge-production' }, 'combine')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '满足', value: `${seedLines.filter(isSatisfied).length} 条` },
      { label: '不满足', value: `${seedLines.filter(r => !isSatisfied(r)).length} 条` },
    ]),
    listTitle: '生产单校验列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的生产单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '生产单校验列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitKitCenter(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitKitCenterEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.preferences.pageSize = Number((field as HTMLSelectElement).value)
      state.currentPage = 1
      saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action.startsWith('switch-tab:')) {
    state.tab = action.slice('switch-tab:'.length) as 'ALL' | '满足' | '不满足'
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
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
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${DATASET_PREFIX}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${DATASET_PREFIX}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  if (action === 'generate-allocation') { showListFeedback('生成配料单为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'refresh-check') { showListFeedback('生产单校验已更新为最新数据'); return true }
  if (action === 'batch-confirm') { showListFeedback(`已批量确认满足 ${seedLines.filter(isSatisfied).length} 条校验记录`); return true }
  if (action === 'merge-production') { showListFeedback('生产单合并处理为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '生产单校验', columns, rows: filteredRows() }); return true }
  return false
}
