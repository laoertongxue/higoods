// @page-pattern: dashboard
// 员工产能统计（非单据统计页，故不使用标准列表页骨架）。
// 6 个页面结构同构：仓库 / 账号 / 起止时间筛选 + 搜索 / 重置 + 统计三卡 + 统计表格，仅标题与时间列名不同。
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { CAPACITY_SEED, CAPACITY_ACCOUNTS, CAPACITY_WAREHOUSE_OPTIONS, type CapacityRow } from './seed.ts'

export type CapacityPageConfig = {
  title: string
  timeLabel: string
  route: string
}

const EVENT_PREFIX = 'capacity'
const DATA_PREFIX = 'capacity'

/** 表格筛选条件：搜索时从输入控件读取，仅用于筛选，不写业务数据。 */
type CapacityFilter = {
  warehouse: string
  account: string
  from: string
  to: string
}

/** 业务日定义：当日 08:00 至次日 07:59，凌晨（<08:00）计入前一天。 */
function businessDayStart(value: string): string {
  const normalized = value.trim().replace('T', ' ')
  if (!normalized) return ''
  const [datePart, timePart = '00:00'] = normalized.split(' ')
  const hour = Number(timePart.slice(0, 2)) || 0
  if (hour >= 8) return `${datePart} 08:00`
  const date = new Date(`${datePart}T12:00:00`)
  if (Number.isNaN(date.getTime())) return `${datePart} 08:00`
  date.setDate(date.getDate() - 1)
  const prev = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `${prev} 08:00`
}

function addDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateText
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toInputValue(businessDay: string): string {
  const [datePart, timePart = '08:00'] = businessDay.split(' ')
  return `${datePart}T${timePart.slice(0, 5)}`
}

const filtersByRoute = new Map<string, CapacityFilter>()

/** 默认业务日范围：数据起始业务日起 +7 天，等价测试环境 URL 默认参数。 */
function defaultFilter(route: string): CapacityFilter {
  const rows = CAPACITY_SEED[route] ?? []
  const earliest = [...rows].map(row => row.time).sort()[0] || ''
  const fromDay = businessDayStart(earliest) || '2026-06-01 08:00'
  const fromDate = fromDay.slice(0, 10)
  const toDay = `${addDays(fromDate, 7)} 08:00`
  return {
    warehouse: CAPACITY_WAREHOUSE_OPTIONS[0] || '全部仓库',
    account: '全部账号',
    from: toInputValue(fromDay),
    to: toInputValue(toDay),
  }
}

function filterOf(route: string): CapacityFilter {
  const existing = filtersByRoute.get(route)
  if (existing) return existing
  const created = defaultFilter(route)
  filtersByRoute.set(route, created)
  return created
}

function filterRows(rows: CapacityRow[], filter: CapacityFilter): CapacityRow[] {
  const from = businessDayStart(filter.from)
  const to = businessDayStart(filter.to)
  return rows.filter(row => {
    if (filter.warehouse && filter.warehouse !== '全部仓库' && row.warehouse !== filter.warehouse) return false
    if (filter.account && filter.account !== '全部账号' && row.account !== filter.account) return false
    const rowDay = businessDayStart(row.time)
    if (from && rowDay < from) return false
    if (to && rowDay > to) return false
    return true
  })
}

function renderTimeLabel(timeLabel: string): string {
  return escapeHtml(timeLabel)
}

function renderStats(rows: CapacityRow[]): string {
  const skuCount = new Set(rows.map(row => row.sku)).size
  const totalOutput = rows.reduce((sum, row) => sum + row.outputQty, 0)
  const accountCount = new Set(rows.map(row => row.account)).size
  return `
  <div class="grid gap-3 sm:grid-cols-3">
    <div class="rounded-lg border bg-white p-4"><div class="text-xs text-slate-500">SKU 种类总数</div><div class="mt-1 text-xl font-semibold text-slate-800">${skuCount} 个</div></div>
    <div class="rounded-lg border bg-white p-4"><div class="text-xs text-slate-500">总产能</div><div class="mt-1 text-xl font-semibold text-slate-800">${totalOutput.toLocaleString('zh-CN')}</div></div>
    <div class="rounded-lg border bg-white p-4"><div class="text-xs text-slate-500">涉及账号</div><div class="mt-1 text-xl font-semibold text-slate-800">${accountCount} 个</div></div>
  </div>`
}

function renderTable(config: CapacityPageConfig, rows: CapacityRow[]): string {
  const body = rows.length
    ? rows.map(row => `
        <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
          <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-600">${escapeHtml(row.warehouse)}</td>
          <td class="whitespace-nowrap px-3 py-2 text-xs text-slate-400">${escapeHtml(row.time)}</td>
          <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-700">${escapeHtml(row.account)}</td>
          <td class="whitespace-nowrap px-3 py-2 text-sm text-slate-600">${escapeHtml(row.position)}</td>
          <td class="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-800 text-right">${escapeHtml(row.output)}</td>
        </tr>`).join('')
    : `<tr><td class="px-3 py-8 text-center text-sm text-slate-400" colspan="5">未找到符合条件的产能记录</td></tr>`

  return `
  <div class="rounded-lg border bg-white">
    <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <h2 class="text-sm font-semibold text-slate-700">${escapeHtml(config.title)}产能统计</h2>
      <span class="text-xs text-slate-400">共 ${rows.length} 条</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead class="bg-slate-50">
          <tr class="text-left text-xs text-slate-500">
            <th class="whitespace-nowrap px-3 py-2 font-medium">仓库</th>
            <th class="whitespace-nowrap px-3 py-2 font-medium">${renderTimeLabel(config.timeLabel)}时间</th>
            <th class="whitespace-nowrap px-3 py-2 font-medium">账号</th>
            <th class="whitespace-nowrap px-3 py-2 font-medium">岗位</th>
            <th class="whitespace-nowrap px-3 py-2 text-right font-medium">产能</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`
}

function renderFilterCard(config: CapacityPageConfig): string {
  const filter = filterOf(config.route)
  const options = CAPACITY_WAREHOUSE_OPTIONS
    .map(option => `<option value="${escapeHtml(option)}" ${filter.warehouse === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
    .join('')
  const accountOptions = ['全部账号', ...CAPACITY_ACCOUNTS]
    .map(option => `<option value="${escapeHtml(option)}" ${filter.account === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
    .join('')

  return `
  <div class="rounded-lg border bg-white p-4">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label class="block">
        <span class="mb-1 block text-xs text-slate-500">仓库</span>
        <select class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" data-${DATA_PREFIX}-field="warehouse">${options}</select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-slate-500">账号</span>
        <select class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" data-${DATA_PREFIX}-field="account">${accountOptions}</select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-slate-500">${renderTimeLabel(config.timeLabel)}起始时间</span>
        <input type="datetime-local" value="${escapeHtml(filter.from)}" class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" data-${DATA_PREFIX}-field="from">
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-slate-500">${renderTimeLabel(config.timeLabel)}结束时间</span>
        <input type="datetime-local" value="${escapeHtml(filter.to)}" class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" data-${DATA_PREFIX}-field="to">
      </label>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-${DATA_PREFIX}-action="search" data-skip-page-rerender="true">搜索</button>
      <button type="button" class="h-9 rounded-md border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50" data-${DATA_PREFIX}-action="reset" data-skip-page-rerender="true">重置筛选</button>
    </div>
  </div>`
}

export function renderCapacityPage(config: CapacityPageConfig): string {
  const filter = filterOf(config.route)
  const rows = filterRows(CAPACITY_SEED[config.route] ?? [], filter)
  return `
  <div class="space-y-4" data-${DATA_PREFIX}-root data-${DATA_PREFIX}-route="${escapeHtml(config.route)}" data-${DATA_PREFIX}-time-label="${escapeHtml(config.timeLabel)}" data-skip-page-rerender="true">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">${escapeHtml(config.title)} - 员工产能统计</h1>
    </div>
    <div data-${DATA_PREFIX}-filter>${renderFilterCard(config)}</div>
    <div data-${DATA_PREFIX}-stats>${renderStats(rows)}</div>
    <div data-${DATA_PREFIX}-table>${renderTable(config, rows)}</div>
  </div>`
}

function readFilter(root: HTMLElement): CapacityFilter {
  const read = (field: string): string => {
    const node = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${DATA_PREFIX}-field="${field}"]`)
    return node ? node.value : ''
  }
  return {
    warehouse: read('warehouse') || '全部仓库',
    account: read('account') || '全部账号',
    from: read('from'),
    to: read('to'),
  }
}

function refreshTable(root: HTMLElement): void {
  const route = root.dataset[DATA_PREFIX + 'Route'] || ''
  const timeLabel = root.dataset[DATA_PREFIX + 'TimeLabel'] || ''
  const titleText = root.querySelector('h1')?.textContent?.replace(' - 员工产能统计', '') || ''
  const tableHost = root.querySelector<HTMLElement>(`[data-${DATA_PREFIX}-table]`)
  const statsHost = root.querySelector<HTMLElement>(`[data-${DATA_PREFIX}-stats]`)
  if (!tableHost) return
  const rows = filterRows(CAPACITY_SEED[route] ?? [], filterOf(route))
  tableHost.innerHTML = renderTable({ title: titleText, timeLabel, route }, rows)
  if (statsHost) statsHost.innerHTML = renderStats(rows)
  hydrateIcons(tableHost)
}

function refreshFilterCard(root: HTMLElement): void {
  const route = root.dataset[DATA_PREFIX + 'Route'] || ''
  const timeLabel = root.dataset[DATA_PREFIX + 'TimeLabel'] || ''
  const titleText = root.querySelector('h1')?.textContent?.replace(' - 员工产能统计', '') || ''
  const host = root.querySelector<HTMLElement>(`[data-${DATA_PREFIX}-filter]`)
  if (!host) return
  host.innerHTML = renderFilterCard({ title: titleText, timeLabel, route })
}

/** 事件分发由主壳按路由调用；本页处理搜索、重置与筛选字段，局部更新表格与统计。 */
export function handleCapacityPageEvent(target: HTMLElement, event?: Event): boolean {
  const root = target.closest<HTMLElement>(`[data-${DATA_PREFIX}-root]`)
  if (!root) return false
  const route = root.dataset[DATA_PREFIX + 'Route'] || ''
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${DATA_PREFIX}-field]`)
  if (field) {
    filtersByRoute.set(route, readFilter(root))
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${DATA_PREFIX}-action]`)
  const action = actionNode?.dataset[DATA_PREFIX + 'Action']
  if (!actionNode || !action) return false
  if (event?.type && event.type !== 'click') return false
  if (action === 'search') {
    filtersByRoute.set(route, readFilter(root))
    refreshTable(root)
    return true
  }
  if (action === 'reset') {
    filtersByRoute.set(route, defaultFilter(route))
    refreshFilterCard(root)
    refreshTable(root)
    return true
  }
  return false
}
