// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type Line = { sku: string; name: string; need: number; collected: number; stock: number; occupied: number; productionNo: string; cutStatus: string; location: string; zone: string }
type Order = { id: string; preNo: string; shipNo: string; platform: string; status: string; box?: string; created: string; deadline: string; lines: Line[] }
type RetryCandidate = { preNo: string; description: string; skuCount: number; status: 'WAIT_RETRY' | 'INVALID'; reason: string }

const statusLabel: Record<string, string> = {
  WAIT_WAVE: '待集货', WAVE_CREATED: '已创建波次', COLLECTING: '集货中', PARTIAL_COLLECTED: '部分集货',
  COLLECTED: '已集齐', REMOVING: '移出中', REMOVED: '已移出', SHIPPED: '已发货',
}

function badgeClass(s: string): string {
  if (['COMPLETED', 'COLLECTED'].includes(s)) return 'bg-emerald-50 text-emerald-700'
  if (s === 'PARTIAL_COLLECTED') return 'bg-amber-50 text-amber-700'
  if (['EXCEPTION', 'REMOVING'].includes(s)) return 'bg-orange-50 text-orange-700'
  return 'bg-blue-50 text-blue-700'
}

const seedOrders: Order[] = [
  { id: 'JH-20260829-001', preNo: 'POUT-20260829-A', shipNo: 'SO-20260829-001', platform: 'TikTok', status: 'WAIT_WAVE', created: '2026-08-29 09:00', deadline: '2026-08-31 18:00', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', need: 2, collected: 0, stock: 8, occupied: 0, productionNo: 'MO-260801', cutStatus: '已裁剪', location: 'A01-01', zone: 'A区' },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', need: 1, collected: 0, stock: 4, occupied: 0, productionNo: 'MO-260802', cutStatus: '已裁剪', location: 'A02-03', zone: 'A区' },
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', need: 1, collected: 0, stock: 0, occupied: 0, productionNo: 'MO-260803', cutStatus: '已裁剪', location: 'B01-02', zone: 'B区' },
  ]},
  { id: 'JH-20260829-002', preNo: 'POUT-20260829-D', shipNo: 'SO-20260829-004', platform: 'Shopee', status: 'WAIT_WAVE', created: '2026-08-29 09:30', deadline: '2026-08-31 12:00', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', need: 3, collected: 0, stock: 8, occupied: 0, productionNo: 'MO-260801', cutStatus: '已裁剪', location: 'A01-01', zone: 'A区' },
    { sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', need: 2, collected: 0, stock: 5, occupied: 0, productionNo: 'MO-260810', cutStatus: '已裁剪', location: 'B03-01', zone: 'B区' },
  ]},
  { id: 'JH-20260829-003', preNo: 'POUT-20260829-E', shipNo: 'SO-20260829-005', platform: '独立站', status: 'WAIT_WAVE', created: '2026-08-29 10:00', deadline: '2026-09-01 10:00', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', need: 1, collected: 0, stock: 8, occupied: 0, productionNo: 'MO-260801', cutStatus: '已裁剪', location: 'A01-01', zone: 'A区' },
    { sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', need: 2, collected: 0, stock: 6, occupied: 0, productionNo: 'MO-260811', cutStatus: '已裁剪', location: 'C01-01', zone: 'C区' },
  ]},
  { id: 'JH-20260820-018', preNo: 'POUT-20260820-X', shipNo: 'SO-20260820-018', platform: 'TikTok', status: 'COLLECTING', box: 'BOX-001', created: '2026-08-20 08:30', deadline: '2026-08-25 18:00', lines: [
    { sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', need: 1, collected: 1, stock: 5, occupied: 0, productionNo: 'MO-260700', cutStatus: '已裁剪', location: 'A03-08', zone: 'A区' },
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', need: 1, collected: 0, stock: 0, occupied: 0, productionNo: 'MO-260803', cutStatus: '已裁剪', location: 'B01-02', zone: 'B区' },
  ]},
]

const seedRetryCandidates: RetryCandidate[] = [
  { preNo: 'POUT-20260829-B', description: '有效3 SKU预售订单，全部无库存', skuCount: 3, status: 'WAIT_RETRY', reason: '库存条件暂未满足' },
  { preNo: 'POUT-20260829-C', description: '有效2 SKU预售订单，夹克未达到裁剪状态', skuCount: 2, status: 'WAIT_RETRY', reason: '生产裁剪条件暂未满足' },
  { preNo: 'POUT-20260829-D', description: '单商品订单', skuCount: 1, status: 'INVALID', reason: '订单类型不符合，不进入重试' },
]

const EVENT_PREFIX = 'wls-collection-orders'
const PREFERENCE_KEY = '/wls/finished/collection-orders:list-columns'
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

const columns: StandardListColumn<Order>[] = [
  { key: 'id', title: '集货订单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.id,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.id)}">${escapeHtml(r.id)}</span>` },
  { key: 'preNo', title: '预出库订单号', width: 170, sortable: true, sortValue: r => r.preNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.preNo)}</span>` },
  { key: 'shipNo', title: '发货单号', width: 160, sortable: true, sortValue: r => r.shipNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.shipNo)}</span>` },
  { key: 'platform', title: '平台', width: 100, sortable: true, sortValue: r => r.platform,
    render: r => `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">${escapeHtml(r.platform)}</span>` },
  { key: 'skuCount', title: 'SKU数', width: 80, align: 'center', sortable: true, sortValue: r => r.lines.length,
    render: r => `<span class="text-slate-600">${r.lines.length}</span>` },
  { key: 'needSku', title: '应集 SKU', width: 90, align: 'center', sortable: true, sortValue: r => r.lines.length,
    render: r => `<span class="text-slate-600">${r.lines.length}</span>` },
  { key: 'collectedSku', title: '已集 SKU', width: 90, align: 'center', sortable: true, sortValue: r => r.lines.filter(l => l.collected >= l.need).length,
    render: r => `<span class="text-slate-600">${r.lines.filter(l => l.collected >= l.need).length}</span>` },
  { key: 'pickable', title: '可拣件数', width: 90, align: 'center', sortable: true,
    sortValue: r => r.lines.reduce((s, l) => s + Math.min(Math.max(0, l.need - l.collected - l.occupied), Math.max(0, l.stock - l.occupied)), 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + Math.min(Math.max(0, l.need - l.collected - l.occupied), Math.max(0, l.stock - l.occupied)), 0)}</span>` },
  { key: 'occupied', title: '波次占用', width: 90, align: 'center', sortable: true,
    sortValue: r => r.lines.reduce((s, l) => s + l.occupied, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.occupied, 0)}</span>` },
  { key: 'box', title: '集货箱', width: 110, sortable: true, sortValue: r => r.box || '',
    render: r => `<span class="text-slate-600">${escapeHtml(r.box || '-')}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(statusLabel[r.status] || r.status)}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="whitespace-nowrap text-xs text-slate-500">${escapeHtml(r.created)}</span>` },
  { key: 'deadline', title: '发货截止', width: 150, sortable: true, sortValue: r => r.deadline,
    render: r => `<span class="whitespace-nowrap text-xs text-slate-500">${escapeHtml(r.deadline)}</span>` },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true,
    render: r => {
      const isCollected = r.status === 'COLLECTED'
      return `<div class="flex gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-order-id="${escapeHtml(r.id)}">查看详情</button>${isCollected ? `<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="go-packing" data-order-id="${escapeHtml(r.id)}">多件打包</button>` : ''}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['id'] as string[],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): Order[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.id} ${o.preNo} ${o.shipNo} ${o.platform}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const statuses = Object.entries(statusLabel)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="集货订单号 / 预出库单号 / 发货单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option>${statuses.map(([k, v]) => `<option value="${escapeHtml(k)}" ${state.statusFilter === k ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderRetrySection(): string {
  return `<div class="rounded-lg border bg-white p-4">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm font-medium text-slate-800">自动生成规则 · 订单创建时实时判断 + 未满足条件每 30 分钟重试</div>
        <div class="mt-1 text-xs text-slate-500">数据来源：成衣厂预出库订单；首次判断：订单创建后立即执行；定时重试：仅检查 WAIT_RETRY 候选；防重复：pre_outbound_order_no 唯一</div>
      </div>
      <button class="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="run-rule">模拟待重试候选规则执行</button>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-3">${seedRetryCandidates.map(x => `
      <div class="rounded-md bg-slate-50 p-3 text-xs">
        <b class="text-slate-800">${escapeHtml(x.preNo)}</b>
        <p class="my-1 text-slate-500">${escapeHtml(x.description)}</p>
        <span class="${x.status === 'WAIT_RETRY' ? 'text-amber-600' : 'text-slate-500'}">${escapeHtml(x.status)} · ${escapeHtml(x.reason)}</span>
      </div>`).join('')}
    </div>
  </div>`
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '集货订单',
    primaryActionsHtml: renderPrimaryButton('创建拣货波次', { prefix: EVENT_PREFIX, action: 'build-wave' }),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '最近执行', value: '2026-08-29 10:30:00' },
      { label: '下次执行', value: '2026-08-29 11:00:00' },
      { label: '最近扫描', value: '2 单' },
      { label: '本轮生成', value: '0 单' },
    ]),
    listTitle: '集货订单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无集货订单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: (state.showColumnSettings ? renderStandardListColumnSettings({ title: '集货订单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '') + renderRetrySection(),
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

export function renderCollectionOrders(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleCollectionOrdersEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'view-detail') {
    const id = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}OrderId`] || ''
    console.log('查看集货订单详情', id)
    return true
  }
  if (action === 'build-wave') {
    console.log('创建拣货波次')
    return true
  }
  if (action === 'run-rule') {
    console.log('模拟规则执行')
    return true
  }
  if (action === 'go-packing') {
    console.log('跳转多件打包')
    return true
  }
  return false
}
