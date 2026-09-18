// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type PutawayStatus = '待上架' | '上架中' | '部分上架' | '上架完成'

type PutawayItemLine = {
  spuCode: string; skuCode: string; inboundQuantity: number
  putawayQuantity?: number; sourceLocation?: string; targetLocation?: string
}

type PutawayOrder = {
  id: string; orderNo: string; inboundOrderNo: string; paNo: string; relatedOrderNo: string; batchNo: string
  inboundWarehouse: string; status: PutawayStatus; itemLines: PutawayItemLine[]
  receivedTime: string; putawayTime: string; operatorName: string
}

/** Flattened row: one per item line, with order-level data repeated */
type PutawayRow = {
  order: PutawayOrder
  line: PutawayItemLine
  lineIndex: number
  lineCount: number
}

function statusBadgeClass(status: PutawayStatus): string {
  switch (status) {
    case '待上架': return 'bg-orange-50 text-orange-700'
    case '部分上架': return 'bg-amber-50 text-amber-700'
    case '上架中': return 'bg-blue-50 text-blue-700'
    case '上架完成': return 'bg-emerald-50 text-emerald-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

const PUTAWAY_SEED: PutawayOrder[] = (() => {
  const statuses: PutawayStatus[] = ['待上架', '上架中', '部分上架', '上架完成']
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01']
  const operators = ['张伟', '李娜', '王强', '刘洋', '陈静']
  const zones = ['A区', 'B区', 'C区', 'D区']
  const items: PutawayOrder[] = []

  for (let i = 0; i < 38; i++) {
    const status = statuses[i % 4]
    const lineCount = 1 + (i % 3)
    const lines: PutawayItemLine[] = []
    for (let j = 0; j < lineCount; j++) {
      const inboundQty = 50 + ((i + j) * 7) % 200
      const putawayQty = status === '上架完成' ? inboundQty : status === '部分上架' ? Math.floor(inboundQty * 0.6) : status === '上架中' ? Math.floor(inboundQty * 0.3) : 0
      lines.push({
        spuCode: `SPU-GC-${String(10001 + ((i + j) % 20)).padStart(5, '0')}`,
        skuCode: `SKU-GC-${String(40001 + i * 3 + j).padStart(5, '0')}`,
        inboundQuantity: inboundQty,
        putawayQuantity: putawayQty > 0 ? putawayQty : undefined,
        sourceLocation: status !== '待上架' ? `${zones[(i + j) % zones.length]}-${String((i % 12) + 1).padStart(2, '0')}-${String((j % 4) + 1).padStart(2, '0')}` : undefined,
        targetLocation: status !== '待上架' ? `${zones[(i + j + 1) % zones.length]}-${String(((i + 1) % 12) + 1).padStart(2, '0')}-${String(((j + 1) % 4) + 1).padStart(2, '0')}` : undefined,
      })
    }

    const dayOffset = Math.floor(i / 8)
    const baseDate = new Date(2026, 8, 18 - dayOffset, 7 + (i % 10), (i * 13) % 60)
    const receivedTime = baseDate.toISOString().slice(0, 16).replace('T', ' ')
    const putawayTime = status !== '待上架' ? new Date(baseDate.getTime() + 3600000 * (1 + (i % 3))).toISOString().slice(0, 16).replace('T', ' ') : '-'

    items.push({
      id: `PA-${String(i + 1).padStart(5, '0')}`,
      orderNo: `RK2026${String(3000 + i).padStart(6, '0')}`,
      inboundOrderNo: `IR2026${String(2000 + i).padStart(6, '0')}`,
      paNo: `SJ2026${String(1000 + i).padStart(6, '0')}`,
      relatedOrderNo: `ASN2026${String(500 + i).padStart(6, '0')}`,
      batchNo: `B2026${String(900 + i).padStart(5, '0')}`,
      inboundWarehouse: warehouses[i % warehouses.length],
      status,
      itemLines: lines,
      receivedTime,
      putawayTime,
      operatorName: operators[i % operators.length],
    })
  }
  return items
})()

function flattenOrders(orders: PutawayOrder[]): PutawayRow[] {
  const rows: PutawayRow[] = []
  for (const order of orders) {
    const lines = order.itemLines.length > 0 ? order.itemLines : [{ spuCode: 'SPU-GC-10001', skuCode: 'SKU-GC-40001', inboundQuantity: 0 }]
    lines.forEach((line, lineIndex) => {
      rows.push({ order, line, lineIndex, lineCount: lines.length })
    })
  }
  return rows
}

const EVENT_PREFIX = 'wls-putaway'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/putaway:list-columns'
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

const columns: StandardListColumn<PutawayRow>[] = [
  { key: 'orderNos', title: '单号', width: 220, required: true, freezeable: true,
    render: r => `<div class="space-y-0.5 text-xs">
      <div><span class="text-slate-400">入库单号：</span><span class="text-slate-700">${escapeHtml(r.order.inboundOrderNo || r.order.orderNo)}</span></div>
      <div><span class="text-slate-400">上架单号：</span><span class="text-slate-700">${escapeHtml(r.order.paNo)}</span></div>
      <div><span class="text-slate-400">关联单号（ASN）：</span><span class="text-slate-700">${escapeHtml(r.order.relatedOrderNo || r.order.orderNo)}</span></div>
      <div><span class="text-slate-400">批次号：</span><span class="text-slate-700">${escapeHtml(r.order.batchNo)}</span></div>
    </div>` },
  { key: 'inboundWarehouse', title: '入库仓库', width: 160, sortable: true, sortValue: r => r.order.inboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.order.inboundWarehouse || '暂无')}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.order.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(r.order.status)}">${escapeHtml(r.order.status)}</span>` },
  { key: 'putawayMethod', title: '上架方式', width: 100,
    render: () => `<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">手动上架</span>` },
  { key: 'inboundQuantity', title: '入库数量', width: 90, align: 'right', sortable: true, sortValue: r => r.line.inboundQuantity,
    render: r => `<span class="text-slate-600">${r.line.inboundQuantity > 0 ? r.line.inboundQuantity : '-'}</span>` },
  { key: 'spuCode', title: 'SPU编码', width: 150, sortable: true, sortValue: r => r.line.spuCode,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.line.spuCode)}</span>` },
  { key: 'skuCode', title: 'SKU 编码', width: 150, sortable: true, sortValue: r => r.line.skuCode,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.line.skuCode)}</span>` },
  { key: 'sourceLocation', title: '库区', width: 100,
    render: r => `<span class="text-slate-600">${r.order.status !== '待上架' ? escapeHtml(r.line.sourceLocation || '暂无') : '暂无'}</span>` },
  { key: 'targetLocation', title: '目标库位', width: 100,
    render: r => `<span class="text-slate-600">${r.order.status !== '待上架' ? escapeHtml(r.line.targetLocation || '暂无') : '暂无'}</span>` },
  { key: 'putawayQuantity', title: '上架数量', width: 90, align: 'right', sortable: true, sortValue: r => r.line.putawayQuantity || 0,
    render: r => `<span class="text-slate-600">${r.line.putawayQuantity && r.line.putawayQuantity > 0 ? r.line.putawayQuantity : '暂无'}</span>` },
  { key: 'time', title: '时间', width: 180,
    render: r => `<div class="space-y-0.5 text-xs text-slate-500">
      <div><span class="text-slate-400">收货：</span><span>${escapeHtml(r.order.receivedTime)}</span></div>
      <div><span class="text-slate-400">上架：</span><span>${escapeHtml(r.order.putawayTime)}</span></div>
    </div>` },
  { key: 'operatorName', title: '操作人员', width: 100, sortable: true, sortValue: r => r.order.operatorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.order.operatorName || '-')}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => {
      const done = r.order.status === '上架完成'
      return `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 ${done ? 'cursor-not-allowed text-slate-400' : ''}" data-${EVENT_PREFIX}-action="putaway" data-order-id="${escapeHtml(r.order.id)}" ${done ? 'disabled' : ''}>上架</button>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['orderNos'] as string[],
  pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): PutawayRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const filtered = PUTAWAY_SEED.filter(o => {
    if (state.statusFilter && state.statusFilter !== '全部' && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.orderNo} ${o.inboundOrderNo} ${o.paNo} ${o.relatedOrderNo} ${o.batchNo} ${o.itemLines.map(l => `${l.spuCode} ${l.skuCode}`).join(' ')}`.toLowerCase().includes(kw)
  })
  return flattenOrders(filtered)
}

function renderFilters(): string {
  const statusOptions = ['全部', '待上架', '上架中', '部分上架', '上架完成']
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="单号 / 关联单号（ASN） / SPU / SKU / 批次号 / 库位" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option>${statusOptions.map(s => `<option value="${escapeHtml(s)}" ${state.statusFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '入库单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总入库单', value: `${PUTAWAY_SEED.length} 条` },
      { label: '待上架', value: `${PUTAWAY_SEED.filter(o => o.status === '待上架').length} 条` },
      { label: '上架中', value: `${PUTAWAY_SEED.filter(o => o.status === '上架中').length} 条` },
      { label: '上架完成', value: `${PUTAWAY_SEED.filter(o => o.status === '上架完成').length} 条` },
    ]),
    listTitle: '入库单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无入库单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '入库单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderFinishedPutaway(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleFinishedPutawayEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
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
  if (action === 'putaway') {
    const id = actionNode.dataset[`${DATASET_PREFIX}OrderId`] || ''
    console.log('putaway order:', id)
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '入库单列表', columns, rows: filteredRows() }); return true }
  return false
}
