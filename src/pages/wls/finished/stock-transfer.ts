// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type StockTransferRecord = {
  id: string;
  transferNo: string;
  sourceWarehouse: string;
  sourceZone: string;
  sourceLocation: string;
  targetWarehouse: string;
  targetZone: string;
  targetLocation: string;
  spu: string;
  sku: string;
  quantity: number;
  createdTime: string;
  status: '待执行' | '移货中' | '已完成';
};

const TRANSFER_SEED: StockTransferRecord[] = (() => {
  const statuses: Array<'待执行' | '移货中' | '已完成'> = ['待执行', '移货中', '已完成'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01'];
  const zones = ['A区', 'B区', 'C区'];
  const locations = ['A01-01', 'A01-02', 'A02-03', 'B01-02', 'B03-01', 'C01-01'];
  const records: StockTransferRecord[] = [];

  for (let i = 0; i < 24; i++) {
    const status = statuses[i % 3];
    const dayOffset = Math.floor(i / 8);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 9 + (i % 8), (i * 11) % 60);

    records.push({
      id: `ST-${String(i + 1).padStart(4, '0')}`,
      transferNo: `YH2026${String(3000 + i).padStart(6, '0')}`,
      sourceWarehouse: warehouses[i % 2],
      sourceZone: zones[i % 3],
      sourceLocation: locations[i % 6],
      targetWarehouse: warehouses[i % 2],
      targetZone: zones[(i + 1) % 3],
      targetLocation: locations[(i + 2) % 6],
      spu: `SPU-GC-${String(10001 + (i % 15)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      quantity: 5 + (i * 3) % 40,
      createdTime: baseDate.toISOString().slice(0, 16).replace('T', ' '),
      status,
    });
  }
  return records;
})();

function statusBadgeClass(status: string): string {
  switch (status) {
    case '已完成': return 'bg-emerald-50 text-emerald-700';
    case '移货中': return 'bg-blue-50 text-blue-700';
    default: return 'bg-orange-50 text-orange-700';
  }
}

const EVENT_PREFIX = 'wls-stock-transfer'
const PREFERENCE_KEY = '/wls/finished/stock-transfer:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<StockTransferRecord>[] = [
  { key: 'transferNo', title: '移货单号', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.transferNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.transferNo)}">${escapeHtml(r.transferNo)}</span>` },
  { key: 'source', title: '调出仓位', width: 200, sortable: true, sortValue: r => `${r.sourceWarehouse}/${r.sourceZone}/${r.sourceLocation}`,
    render: r => `<span class="text-slate-600">${escapeHtml(r.sourceWarehouse)} / ${escapeHtml(r.sourceZone)} / ${escapeHtml(r.sourceLocation)}</span>` },
  { key: 'target', title: '调入仓位', width: 200, sortable: true, sortValue: r => `${r.targetWarehouse}/${r.targetZone}/${r.targetLocation}`,
    render: r => `<span class="text-slate-600">${escapeHtml(r.targetWarehouse)} / ${escapeHtml(r.targetZone)} / ${escapeHtml(r.targetLocation)}</span>` },
  { key: 'spu', title: '商品SPU', width: 160, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="text-slate-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'quantity', title: '移货数量', width: 100, align: 'right', sortable: true, sortValue: r => r.quantity,
    render: r => `<span class="font-medium text-slate-700">${r.quantity}</span>` },
  { key: 'createdTime', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createdTime,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.createdTime)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => {
      const disabled = r.status === '已完成' || r.status === '移货中'
      const label = r.status === '已完成' ? '已执行' : r.status === '移货中' ? '移货中' : '执行移货'
      const cls = disabled
        ? 'rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-400'
        : 'rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700'
      return `<div class="flex items-center gap-1"><button class="${cls}" ${disabled ? 'disabled' : `data-${EVENT_PREFIX}-action="execute"`} data-record-id="${escapeHtml(r.id)}">${label}</button></div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['transferNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): StockTransferRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  return TRANSFER_SEED.filter(r => {
    if (state.statusFilter && r.status !== state.statusFilter) return false
    if (!kw) return true
    return `${r.transferNo} ${r.spu} ${r.sku}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="移货单号 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option><option value="待执行" ${state.statusFilter === '待执行' ? 'selected' : ''}>待执行</option><option value="移货中" ${state.statusFilter === '移货中' ? 'selected' : ''}>移货中</option><option value="已完成" ${state.statusFilter === '已完成' ? 'selected' : ''}>已完成</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '移货操作',
    primaryActionsHtml: renderPrimaryButton('新增移货任务', { prefix: EVENT_PREFIX, action: 'create' }),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总任务数', value: `${TRANSFER_SEED.length} 条` },
      { label: '待执行', value: `${TRANSFER_SEED.filter(r => r.status === '待执行').length} 条` },
      { label: '移货中', value: `${TRANSFER_SEED.filter(r => r.status === '移货中').length} 条` },
      { label: '已完成', value: `${TRANSFER_SEED.filter(r => r.status === '已完成').length} 条` },
    ]),
    listTitle: '移货任务列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无移货任务' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '移货操作列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderFinishedStockTransfer(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleStockTransferEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'status') { state.statusFilter = (field as HTMLSelectElement).value; return true }
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
  const action = actionNode?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Action`]
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
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (select) state.statusFilter = select.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { return true }
  return false
}
