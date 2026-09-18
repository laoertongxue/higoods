// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type WaveStatus = '待拣货' | '部分拣货' | '拣货完成';
type WaveType = 'MULTI_ITEM_BASKET' | 'SINGLE_SKU';

type WaveRecord = {
  id: string;
  waveNo: string;
  warehouseName: string;
  waveType: WaveType;
  orderCount: number;
  skuCount: number;
  outboundQuantity: number;
  pickedQuantity: number;
  operatorName: string;
  status: WaveStatus;
  createdAt: string;
};

const WAVE_SEED: WaveRecord[] = (() => {
  const statuses: WaveStatus[] = ['待拣货', '部分拣货', '拣货完成'];
  const types: WaveType[] = ['MULTI_ITEM_BASKET', 'SINGLE_SKU'];
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01'];
  const operators = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵敏'];
  const items: WaveRecord[] = [];

  for (let i = 0; i < 36; i++) {
    const status = statuses[i % 3];
    const waveType = types[i % 2];
    const orderCount = 5 + (i * 3) % 25;
    const skuCount = orderCount + (i % 8);
    const outboundQty = orderCount * (10 + (i % 5) * 3);
    const pickedQty = status === '拣货完成' ? outboundQty : status === '部分拣货' ? Math.floor(outboundQty * 0.5) : 0;
    const dayOffset = Math.floor(i / 6);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 8 + (i % 10), (i * 7) % 60);
    const createdAt = baseDate.toISOString().slice(0, 16).replace('T', ' ');

    items.push({
      id: `WV-${String(i + 1).padStart(5, '0')}`,
      waveNo: `W2026091${String(i + 1).padStart(2, '0')}-${String((i % 5) + 1).padStart(2, '0')}`,
      warehouseName: warehouses[i % warehouses.length],
      waveType,
      orderCount,
      skuCount,
      outboundQuantity: outboundQty,
      pickedQuantity: pickedQty,
      operatorName: operators[i % operators.length],
      status,
      createdAt,
    });
  }
  return items;
})();

function statusBadgeClass(status: WaveStatus): string {
  switch (status) {
    case '拣货完成': return 'bg-emerald-50 text-emerald-700';
    case '部分拣货': return 'bg-amber-50 text-amber-700';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function waveTypeLabel(type: WaveType): string {
  return type === 'MULTI_ITEM_BASKET' ? '一单多件篮分播' : '单 SKU 波次';
}

const EVENT_PREFIX = 'wls-wave-manage'
const PREFERENCE_KEY = '/wls/finished/wave-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 20 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<WaveRecord>[] = [
  { key: 'selection', title: '', width: 44, leadingControlColumn: true,
    render: r => `<input type="checkbox" class="h-4 w-4 cursor-pointer accent-blue-600" data-${EVENT_PREFIX}-field="row-select" data-wave-id="${escapeHtml(r.id)}">` },
  { key: 'waveNo', title: '波次号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.waveNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.waveNo)}">${escapeHtml(r.waveNo)}</span>` },
  { key: 'warehouseName', title: '出库仓库', width: 170, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'waveType', title: '波次类型', width: 140, sortable: true, sortValue: r => r.waveType,
    render: r => `<span class="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">${escapeHtml(waveTypeLabel(r.waveType))}</span>` },
  { key: 'orderCount', title: '订单数', width: 90, align: 'right', sortable: true, sortValue: r => r.orderCount,
    render: r => `<span class="text-slate-600">${r.orderCount}</span>` },
  { key: 'skuCount', title: 'SKU数', width: 90, align: 'right', sortable: true, sortValue: r => r.skuCount,
    render: r => `<span class="text-slate-600">${r.skuCount}</span>` },
  { key: 'outboundQuantity', title: '计划出库数量', width: 120, align: 'right', sortable: true, sortValue: r => r.outboundQuantity,
    render: r => `<span class="text-slate-700 font-medium">${r.outboundQuantity}</span>` },
  { key: 'pickedQuantity', title: '已拣货数量', width: 110, align: 'right', sortable: true, sortValue: r => r.pickedQuantity,
    render: r => `<span class="text-slate-600">${r.pickedQuantity}</span>` },
  { key: 'operatorName', title: '操作人员', width: 100, sortable: true, sortValue: r => r.operatorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operatorName || '-')}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>` },
  { key: 'createdAt', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createdAt,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.createdAt)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn, leadingControlColumn: c.leadingControlColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn || c.leadingControlColumn).map(c => c.key),
  frozenKeys: ['waveNo'],
  pageSize: PAGE_SIZE_OPTIONS[1],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): WaveRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return WAVE_SEED
  return WAVE_SEED.filter(w => `${w.waveNo} ${w.warehouseName} ${w.status} ${w.operatorName}`.toLowerCase().includes(kw))
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-3"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="波次号 / 仓库 / 状态 / 操作人员" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('删除波次', { prefix: EVENT_PREFIX, action: 'delete-wave' }, 'trash-2')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '波次管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总波次数', value: `${WAVE_SEED.length} 条` },
      { label: '待拣货', value: `${WAVE_SEED.filter(w => w.status === '待拣货').length} 条` },
      { label: '部分拣货', value: `${WAVE_SEED.filter(w => w.status === '部分拣货').length} 条` },
      { label: '拣货完成', value: `${WAVE_SEED.filter(w => w.status === '拣货完成').length} 条` },
    ]),
    listTitle: '波次列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无波次' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '波次管理列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderFinishedWaveManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWaveManageEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
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
  return false
}
