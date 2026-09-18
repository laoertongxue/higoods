// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type PreOutboundStatus = '待处理' | '待拣货' | '拣货中' | '待出库' | '部分出库' | '已出库' | '已取消'

type PreOutboundItem = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string; trackingNo: string
  spu: string; sku: string; skuCount: number
  outboundWarehouse: string; outboundType: string; receivingUnit: string
  outboundQuantity: number; pickedQuantity: number
  stockStatus: '库存充足' | '库存部分充足' | '库存不足'
  ownerName: string; status: PreOutboundStatus
  createTime: string; payTime: string; shipDeadline: string
}

function statusBadgeClass(status: PreOutboundStatus): string {
  switch (status) {
    case '待处理': return 'bg-amber-50 text-amber-700'
    case '待拣货': return 'bg-blue-50 text-blue-700'
    case '拣货中': return 'bg-purple-50 text-purple-700'
    case '待出库': return 'bg-cyan-50 text-cyan-700'
    case '部分出库': return 'bg-indigo-50 text-indigo-700'
    case '已出库': return 'bg-emerald-50 text-emerald-700'
    case '已取消': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function stockStatusBadgeClass(status: string): string {
  switch (status) {
    case '库存不足': return 'bg-red-50 text-red-700'
    case '库存部分充足': return 'bg-orange-50 text-orange-700'
    default: return 'bg-emerald-50 text-emerald-700'
  }
}

const PRE_OUTBOUND_SEED: PreOutboundItem[] = (() => {
  const statuses: PreOutboundStatus[] = ['待处理', '待拣货', '拣货中', '待出库', '部分出库', '已出库']
  const stockStatuses: Array<'库存充足' | '库存部分充足' | '库存不足'> = ['库存充足', '库存部分充足', '库存不足']
  const outboundTypes = ['现货出库', '预售出库', '调拨出库', '退货出库']
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01']
  const owners = ['广州总店', '深圳分店', '武汉分店', '杭州分店', '成都分店']
  const items: PreOutboundItem[] = []

  for (let i = 0; i < 48; i++) {
    const status = statuses[i % statuses.length]
    const stockStatus = stockStatuses[i % 3]
    const outboundQty = 10 + (i * 3) % 50
    const pickedQty = status === '已出库' ? outboundQty : status === '部分出库' ? Math.floor(outboundQty * 0.6) : status === '拣货中' ? Math.floor(outboundQty * 0.3) : 0
    const dayOffset = Math.floor(i / 8)
    const baseDate = new Date(2026, 8, 18 - dayOffset)
    const createDate = baseDate.toISOString().slice(0, 16).replace('T', ' ')
    const payDate = new Date(baseDate.getTime() - 3600000).toISOString().slice(0, 16).replace('T', ' ')
    const deadlineDate = new Date(baseDate.getTime() + 86400000 * 2).toISOString().slice(0, 16).replace('T', ' ')

    items.push({
      id: `PO-${String(i + 1).padStart(5, '0')}`,
      outboundOrderNo: `CK2026${String(9000 + i).padStart(6, '0')}`,
      pickOrderNo: `PJ2026${String(8000 + i).padStart(6, '0')}`,
      relatedOrderNo: `SO2026${String(7000 + i).padStart(6, '0')}`,
      trackingNo: `SF${String(1000000000 + i * 12345).slice(0, 12)}`,
      spu: `SPU-GC-${String(10001 + (i % 20)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      skuCount: 1 + (i % 3),
      outboundWarehouse: warehouses[i % warehouses.length],
      outboundType: outboundTypes[i % outboundTypes.length],
      receivingUnit: owners[i % owners.length],
      outboundQuantity: outboundQty,
      pickedQuantity: pickedQty,
      stockStatus,
      ownerName: owners[i % owners.length],
      status,
      createTime: createDate,
      payTime: payDate,
      shipDeadline: deadlineDate,
    })
  }
  return items
})()

const EVENT_PREFIX = 'wls-pre-outbound'
const PREFERENCE_KEY = '/wls/finished/pre-outbound:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<PreOutboundItem>[] = [
  { key: 'orderNos', title: '单号', width: 220, required: true, freezeable: true,
    render: r => `<div class="space-y-0.5 text-xs">
      <div><span class="text-slate-400">出库单号：</span><span class="text-slate-700">${escapeHtml(r.outboundOrderNo)}</span></div>
      <div><span class="text-slate-400">拣货单号：</span><span class="text-slate-700">${escapeHtml(r.pickOrderNo)}</span></div>
      <div><span class="text-slate-400">关联单号：</span><span class="text-slate-700">${escapeHtml(r.relatedOrderNo)}</span></div>
      <div><span class="text-slate-400">跟踪单号：</span><span class="text-slate-700">${escapeHtml(r.trackingNo)}</span></div>
    </div>` },
  { key: 'spu', title: '商品SPU', width: 160, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="text-blue-600">${escapeHtml(r.spu)}（${r.skuCount}个SKU）</span>` },
  { key: 'sku', title: '商品SKU', width: 150, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'outboundWarehouse', title: '出库仓库', width: 160, sortable: true, sortValue: r => r.outboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundWarehouse)}</span>` },
  { key: 'outboundType', title: '出库类型', width: 100, sortable: true, sortValue: r => r.outboundType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundType)}</span>` },
  { key: 'receivingUnit', title: '收货单位', width: 120, sortable: true, sortValue: r => r.receivingUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.receivingUnit)}</span>` },
  { key: 'outboundQuantity', title: '计划出库数量', width: 110, align: 'right', sortable: true, sortValue: r => r.outboundQuantity,
    render: r => `<span class="text-slate-600">${r.outboundQuantity}</span>` },
  { key: 'stockStatus', title: '库存状态', width: 110, sortable: true, sortValue: r => r.stockStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${stockStatusBadgeClass(r.stockStatus)}">${escapeHtml(r.stockStatus)}</span>` },
  { key: 'pickedQuantity', title: '已拣货数量', width: 100, align: 'right', sortable: true, sortValue: r => r.pickedQuantity,
    render: r => `<span class="text-slate-600">${r.pickedQuantity}</span>` },
  { key: 'ownerName', title: '货主', width: 100, sortable: true, sortValue: r => r.ownerName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.ownerName)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>` },
  { key: 'time', title: '时间', width: 180,
    render: r => `<div class="space-y-0.5 text-xs text-slate-500">
      <div><span class="text-slate-400">创建时间：</span><span>${escapeHtml(r.createTime)}</span></div>
      <div><span class="text-slate-400">支付时间：</span><span>${escapeHtml(r.payTime)}</span></div>
      <div><span class="text-slate-400">发货截止：</span><span>${escapeHtml(r.shipDeadline)}</span></div>
    </div>` },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true,
    render: r => {
      const buttons: string[] = [`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-order-id="${escapeHtml(r.id)}">查看</button>`]
      if (r.status === '待处理') {
        buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="generate-pick" data-order-id="${escapeHtml(r.id)}">生成拣货单</button>`)
      }
      if (r.status === '待拣货' || r.status === '拣货中') {
        buttons.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="print-pick" data-order-id="${escapeHtml(r.id)}">打印拣货单</button>`)
      }
      return `<div class="flex flex-wrap items-center gap-1">${buttons.join('')}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['orderNos'] as string[],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): PreOutboundItem[] {
  const kw = state.keyword.trim().toLowerCase()
  return PRE_OUTBOUND_SEED.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.outboundOrderNo} ${o.pickOrderNo} ${o.relatedOrderNo} ${o.trackingNo} ${o.spu} ${o.sku} ${o.outboundWarehouse} ${o.ownerName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const statusOptions: PreOutboundStatus[] = ['待处理', '待拣货', '拣货中', '待出库', '部分出库', '已出库', '已取消']
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 拣货单号 / 关联单号 / 跟踪单号 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option>${statusOptions.map(s => `<option value="${escapeHtml(s)}" ${state.statusFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderPrimaryButton('生成波次', { prefix: EVENT_PREFIX, action: 'generate-wave' })}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const timeoutStats = {
    todayTimeoutCount: 8,
    tomorrowTimeoutCount: 15,
    threeDaysTimeoutCount: 42,
  }

  return renderStandardListPage({
    title: '预出库管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总预出库单', value: `${PRE_OUTBOUND_SEED.length} 条` },
      { label: '今日超时', value: `${timeoutStats.todayTimeoutCount}` },
      { label: '明日超时', value: `${timeoutStats.tomorrowTimeoutCount}` },
      { label: '3天内超时', value: `${timeoutStats.threeDaysTimeoutCount}` },
    ]),
    listTitle: '预出库单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无预出库单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '预出库单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderFinishedPreOutbound(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleFinishedPreOutboundEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'view' || action === 'generate-pick' || action === 'print-pick' || action === 'generate-wave') {
    const id = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}OrderId`] || ''
    console.log(`${action} pre-outbound order:`, id)
    return true
  }
  return false
}
