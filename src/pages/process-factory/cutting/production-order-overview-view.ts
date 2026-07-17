import { renderMultiSelectFilter } from '../../../components/ui/filter-bar.ts'
import { escapeHtml } from '../../../utils.ts'
import { paginateItems, renderStickyFilterShell, renderStickyTableScroller, renderWorkbenchPagination } from './layout.helpers.ts'
import type { ProductionOrderOverviewFactoryLine } from './production-order-overview-model.ts'
import type { ProductionOrderOverviewRow } from './production-order-overview-projection.ts'

export interface ProductionOrderOverviewFilters {
  keyword: string
  orderDateFrom: string
  orderDateTo: string
  printingStatuses: string[]
  dyeingStatuses: string[]
  materialPrepStatuses: string[]
  acceptanceStatuses: string[]
  pickupStatuses: string[]
}

export interface ProductionOrderOverviewPageState {
  filters: ProductionOrderOverviewFilters
  draftFilters: ProductionOrderOverviewFilters
  page: number
  pageSize: number
}

export const PRODUCTION_ORDER_OVERVIEW_HEADERS = [
  '生产单',
  '款式',
  '印花',
  '染色',
  '拆解',
  '配料',
  '工厂 / 接单 / 领取',
  '唛架',
  '铺布',
  '裁剪',
  '入仓',
  '发货 / 接收工厂',
] as const

export function createProductionOrderOverviewPageState(): ProductionOrderOverviewPageState {
  const filters = {
      keyword: '',
      orderDateFrom: '',
      orderDateTo: '',
      printingStatuses: [],
      dyeingStatuses: [],
      materialPrepStatuses: [],
      acceptanceStatuses: [],
      pickupStatuses: [],
  }
  return {
    filters: { ...filters },
    draftFilters: { ...filters },
    page: 1,
    pageSize: 20,
  }
}

const MULTI_SELECT_CONFIG = {
  printing: { key: 'printingStatuses', label: '印花状态', options: ['未开始', '印花中', '印花完成', '无需印花'] },
  dyeing: { key: 'dyeingStatuses', label: '染色状态', options: ['未开始', '染色中', '染色完成', '无需染色'] },
  materialPrep: { key: 'materialPrepStatuses', label: '配料状态', options: ['未配料', '部分配料', '配料完成'] },
  acceptance: { key: 'acceptanceStatuses', label: '接单状态', options: ['未接单', '已经接单'] },
  pickup: { key: 'pickupStatuses', label: '领取状态', options: ['未领取', '部分领取', '领取完成'] },
} as const

type MultiSelectField = keyof typeof MULTI_SELECT_CONFIG
type MultiSelectFilterKey = (typeof MULTI_SELECT_CONFIG)[MultiSelectField]['key']

let latestOverviewRows: ProductionOrderOverviewRow[] = []

function includesSelected(selected: string[], values: string[]): boolean {
  return selected.length === 0 || values.some((value) => selected.includes(value))
}

function filterRows(rows: ProductionOrderOverviewRow[], filters: ProductionOrderOverviewFilters): ProductionOrderOverviewRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (keyword && !row.keywordIndex.some((item) => item.toLowerCase().includes(keyword))) return false
    const orderDate = row.orderDate.slice(0, 10)
    if (filters.orderDateFrom && orderDate < filters.orderDateFrom) return false
    if (filters.orderDateTo && orderDate > filters.orderDateTo) return false
    if (!includesSelected(filters.printingStatuses, [row.printingStatus])) return false
    if (!includesSelected(filters.dyeingStatuses, [row.dyeingStatus])) return false
    if (!includesSelected(filters.materialPrepStatuses, [row.materialPrepStatus])) return false
    const factoryLines = getFactoryLines(row)
    if (!includesSelected(filters.acceptanceStatuses, factoryLines.map((line) => line.acceptanceLabel))) return false
    if (!includesSelected(filters.pickupStatuses, factoryLines.map((line) => line.pickupLabel))) return false
    return true
  })
}

function getFactoryLines(row: ProductionOrderOverviewRow): ProductionOrderOverviewFactoryLine[] {
  return row.factoryLines.length
    ? row.factoryLines
    : [{
        factoryId: `UNASSIGNED-${row.productionOrderId}`,
        factoryName: '未派单',
        factoryTypeLabel: '待分配',
        acceptanceLabel: '未接单',
        pickupLabel: '未领取',
      }]
}

function statusClass(status: string): string {
  if (['已完成', '印花完成', '染色完成', '配料完成', '已经拆解', '唛架完成', '铺布完成', '裁剪完成', '已入仓', '发货完成', '领取完成', '已接单', '已经接单'].includes(status)) {
    return 'bg-emerald-50 text-emerald-700'
  }
  if (['进行中', '印花中', '染色中', '部分配料', '部分领取', '铺布中', '待交出'].includes(status) || status.includes('未完成')) {
    return 'bg-amber-50 text-amber-700'
  }
  if (status.startsWith('无需')) return 'bg-slate-100 text-slate-600'
  if (status === '—') return 'bg-muted text-muted-foreground'
  return 'bg-blue-50 text-blue-700'
}

type StatusDetailKey =
  | 'printing'
  | 'dyeing'
  | 'breakdown'
  | 'materialPrep'
  | 'factory'
  | 'marker'
  | 'spreading'
  | 'cutting'
  | 'inbound'
  | 'shipping'

const STATUS_DETAIL_TAB: Record<StatusDetailKey, string> = {
  printing: 'material-flow',
  dyeing: 'material-flow',
  breakdown: 'cut-orders',
  materialPrep: 'material-flow',
  factory: 'material-flow',
  marker: 'marker-spreading',
  spreading: 'marker-spreading',
  cutting: 'fei-tickets',
  inbound: 'warehouse-bags',
  shipping: 'handover',
}

function buildStatusDetailPath(row: ProductionOrderOverviewRow, key: StatusDetailKey): string {
  if (row.id === row.productionOrderId) {
    return `/fcs/production/orders/${encodeURIComponent(row.productionOrderId)}`
  }
  return `/fcs/craft/cutting/production-progress-detail/${encodeURIComponent(row.id)}?tab=${STATUS_DETAIL_TAB[key]}`
}

function renderStatus(row: ProductionOrderOverviewRow, status: string, key: StatusDetailKey): string {
  return `<button type="button" class="inline-flex rounded-full px-2 py-1 text-xs font-medium hover:ring-2 hover:ring-blue-200 ${statusClass(status)}" data-nav="${escapeHtml(buildStatusDetailPath(row, key))}">${escapeHtml(status)}</button>`
}

function renderProductionOrderCell(row: ProductionOrderOverviewRow): string {
  return `
    <div class="space-y-1 text-xs leading-5">
      <div class="font-semibold text-foreground">生产单号：${escapeHtml(row.productionOrderNo)}</div>
      <div class="text-muted-foreground">生成时间：${escapeHtml(row.productionOrderCreatedAt || '暂无时间')}</div>
      <div class="font-medium text-foreground">需求单号：${escapeHtml(row.demandId || '暂无需求单')}</div>
      <div class="text-muted-foreground">创建时间：${escapeHtml(row.demandCreatedAt || '暂无时间')}</div>
      <div class="text-muted-foreground">需求数量：${row.orderQty.toLocaleString('zh-CN')} 件</div>
    </div>
  `
}

function renderStyleCell(row: ProductionOrderOverviewRow): string {
  return `
    <div class="flex min-w-0 items-start gap-3">
      <img
        src="${escapeHtml(row.styleImageUrl)}"
        alt="${escapeHtml(row.styleName)}"
        class="h-16 w-16 shrink-0 rounded-md border bg-muted object-cover"
        onerror="this.onerror=null;this.src='/placeholder.svg?height=80&width=80'"
      />
      <div class="min-w-0 space-y-1 text-xs leading-5">
        <div class="font-semibold text-foreground">${escapeHtml(row.styleName)}</div>
        <div class="text-muted-foreground">款式编号：${escapeHtml(row.styleCode)}</div>
        <div class="text-muted-foreground">跟单：${escapeHtml(row.merchandiserName)}</div>
        <div class="text-muted-foreground">买手：${escapeHtml(row.buyerName)}</div>
      </div>
    </div>
  `
}

function renderFactoryLines(row: ProductionOrderOverviewRow): string {
  return `
    <div class="min-w-[430px] overflow-hidden rounded-md border text-xs">
      <div class="grid grid-cols-[minmax(150px,1.4fr)_95px_70px_80px] bg-muted/60 px-2 py-1.5 font-medium text-muted-foreground">
        <span>工厂</span><span>类型</span><span>接单</span><span>领取</span>
      </div>
      ${getFactoryLines(row).map((line) => `
        <div class="grid grid-cols-[minmax(150px,1.4fr)_95px_70px_80px] items-center border-t px-2 py-2 leading-5" data-cutting-overview-factory-line>
          <span class="font-medium text-foreground">${escapeHtml(line.factoryName)}</span>
          <span class="text-muted-foreground">${escapeHtml(line.factoryTypeLabel)}</span>
          <button type="button" class="text-left hover:underline" data-nav="${escapeHtml(buildStatusDetailPath(row, 'factory'))}">${escapeHtml(line.acceptanceLabel)}</button>
          <button type="button" class="text-left hover:underline" data-nav="${escapeHtml(buildStatusDetailPath(row, 'factory'))}">${escapeHtml(line.pickupLabel)}</button>
        </div>
      `).join('')}
    </div>
  `
}

function renderShippingCell(row: ProductionOrderOverviewRow): string {
  return `
    <div class="space-y-2 text-xs leading-5">
      ${renderStatus(row, row.shippingStatus, 'shipping')}
      <div class="text-muted-foreground">接收工厂：${escapeHtml(row.receiverFactoryNames.join('、') || '尚未指定')}</div>
    </div>
  `
}

function renderTable(rows: ProductionOrderOverviewRow[], state: ProductionOrderOverviewPageState): string {
  const pagination = paginateItems(rows, state.page, state.pageSize)
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">生产单总览</h2>
          <p class="mt-1 text-xs text-muted-foreground">一张生产单一行，状态均由业务事实自动汇总；子单明细进入详情查看。</p>
        </div>
        <span class="text-xs text-muted-foreground">共 ${pagination.total} 张生产单</span>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[2280px] w-full table-fixed text-sm" data-testid="cutting-production-progress-main-table">
          <colgroup>
            <col class="w-[240px]" /><col class="w-[300px]" /><col class="w-[110px]" /><col class="w-[110px]" />
            <col class="w-[100px]" /><col class="w-[110px]" /><col class="w-[470px]" /><col class="w-[100px]" />
            <col class="w-[100px]" /><col class="w-[110px]" /><col class="w-[100px]" /><col class="w-[220px]" />
          </colgroup>
          <thead class="sticky top-0 z-20 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr class="border-b">
              <th colspan="2" class="border-r-2 border-slate-300 bg-slate-100 px-3 py-2 text-center font-semibold text-slate-700">下单</th>
              <th colspan="2" class="border-r-2 border-blue-200 bg-blue-50 px-3 py-2 text-center font-semibold text-blue-800">印染</th>
              <th colspan="2" class="border-r-2 border-amber-200 bg-amber-50 px-3 py-2 text-center font-semibold text-amber-800">中转仓</th>
              <th colspan="6" class="bg-emerald-50 px-3 py-2 text-center font-semibold text-emerald-800">裁床厂</th>
            </tr>
            <tr>
              ${PRODUCTION_ORDER_OVERVIEW_HEADERS
                .map((label, index) => {
                  const sticky = index === 0 ? 'sticky left-0 z-30 bg-slate-100' : index === 1 ? 'sticky left-[240px] z-30 bg-slate-100' : ''
                  const group = index < 2 ? 'bg-slate-50' : index < 4 ? 'bg-blue-50/60' : index < 6 ? 'bg-amber-50/60' : 'bg-emerald-50/60'
                  const boundary = [0, 2, 4, 6].includes(index) ? 'border-l-2 border-slate-300' : ''
                  return `<th class="${sticky} ${group} ${boundary} px-3 py-2 text-left font-medium">${label}</th>`
                })
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${pagination.items.length ? pagination.items.map((row) => `
              <tr class="border-b align-top last:border-b-0 hover:bg-muted/20" data-production-order-id="${escapeHtml(row.productionOrderId)}">
                <td class="sticky left-0 z-10 bg-slate-50 px-3 py-3">${renderProductionOrderCell(row)}</td>
                <td class="sticky left-[240px] z-10 bg-slate-50 px-3 py-3">${renderStyleCell(row)}</td>
                <td class="border-l-2 border-slate-300 bg-blue-50/30 px-3 py-3">${renderStatus(row, row.printingStatus, 'printing')}</td>
                <td class="bg-blue-50/30 px-3 py-3">${renderStatus(row, row.dyeingStatus, 'dyeing')}</td>
                <td class="border-l-2 border-slate-300 bg-amber-50/30 px-3 py-3">${renderStatus(row, row.breakdownStatus, 'breakdown')}</td>
                <td class="bg-amber-50/30 px-3 py-3">${renderStatus(row, row.materialPrepStatus, 'materialPrep')}</td>
                <td class="border-l-2 border-slate-300 bg-emerald-50/30 px-3 py-3">${renderFactoryLines(row)}</td>
                <td class="bg-emerald-50/30 px-3 py-3">${renderStatus(row, row.markerStatus, 'marker')}</td>
                <td class="bg-emerald-50/30 px-3 py-3">${renderStatus(row, row.spreadingStatus, 'spreading')}</td>
                <td class="bg-emerald-50/30 px-3 py-3">${renderStatus(row, row.cuttingStatus, 'cutting')}</td>
                <td class="bg-emerald-50/30 px-3 py-3">${renderStatus(row, row.inboundStatus, 'inbound')}</td>
                <td class="bg-emerald-50/30 px-3 py-3">${renderShippingCell(row)}</td>
              </tr>
            `).join('') : '<tr><td colspan="12" class="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无匹配生产单。</td></tr>'}
          </tbody>
        </table>
      `, 'max-h-[68vh]')}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        itemUnit: '张生产单',
        actionAttr: 'data-cutting-overview-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-overview-page-size',
        extraAttrs: 'data-skip-page-rerender="true"',
      })}
    </section>
  `
}

function renderFilters(state: ProductionOrderOverviewPageState): string {
  return renderStickyFilterShell(`
    <div class="cutting-overview-filter-row flex flex-wrap items-end gap-3">
      <label class="cutting-overview-keyword-filter min-w-[280px] flex-1 space-y-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <input
          type="text"
          value="${escapeHtml(state.draftFilters.keyword)}"
          placeholder="生产单 / 需求单 / 款式 / 跟单 / 买手 / 工厂"
          class="h-10 min-w-0 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-cutting-overview-keyword
          data-skip-page-rerender="true"
        />
      </label>
      <details class="cutting-overview-date-filter relative min-w-[250px]">
        <summary class="list-none">
          <span class="flex h-10 w-full cursor-pointer items-center rounded-md border bg-background px-3 text-sm text-muted-foreground shadow-sm">${escapeHtml(state.draftFilters.orderDateFrom && state.draftFilters.orderDateTo ? `${state.draftFilters.orderDateFrom} 至 ${state.draftFilters.orderDateTo}` : '下单日期：选择开始时间和结束时间')}</span>
        </summary>
        <div class="absolute left-0 top-12 z-50 flex min-w-[360px] items-end gap-3 rounded-lg border bg-card p-3 shadow-lg">
          <label class="flex-1 space-y-1"><span class="block text-xs text-muted-foreground">开始</span><input type="date" value="${escapeHtml(state.draftFilters.orderDateFrom)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-overview-order-date="from" data-skip-page-rerender="true" /></label>
          <label class="flex-1 space-y-1"><span class="block text-xs text-muted-foreground">结束</span><input type="date" value="${escapeHtml(state.draftFilters.orderDateTo)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-overview-order-date="to" data-skip-page-rerender="true" /></label>
        </div>
      </details>
      ${Object.entries(MULTI_SELECT_CONFIG).map(([field, config]) => renderMultiSelectFilter({
        label: config.label,
        field,
        selectedValues: state.draftFilters[config.key],
        options: [...config.options],
        actionAttr: 'data-cutting-overview-filter',
        skipPageRerender: true,
      })).join('')}
      <div class="cutting-overview-filter-actions ml-auto flex min-w-0 items-end gap-2">
        <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-cutting-overview-action="apply-filters" data-skip-page-rerender="true">查询</button>
        <button type="button" class="h-10 rounded-md border bg-background px-4 text-sm hover:bg-muted" data-cutting-overview-action="clear-filters" data-skip-page-rerender="true">重置</button>
      </div>
  `, 'cutting-overview-filter-shell')
}

export function renderProductionOrderOverview(
  rows: ProductionOrderOverviewRow[],
  state: ProductionOrderOverviewPageState,
): string {
  latestOverviewRows = rows
  return `<div data-cutting-overview-root>${renderProductionOrderOverviewContent(rows, state)}</div>`
}

function renderProductionOrderOverviewContent(
  rows: ProductionOrderOverviewRow[],
  state: ProductionOrderOverviewPageState,
): string {
  const filteredRows = filterRows(rows, state.filters)
  return `${renderFilters(state)}<div class="mt-4" data-cutting-overview-results>${renderTable(filteredRows, state)}</div>`
}

function refreshProductionOrderOverview(target: Element, state: ProductionOrderOverviewPageState): void {
  const root = target.closest<HTMLElement>('[data-cutting-overview-root]')
  if (!root) return
  window.setTimeout(() => {
    if (!root.isConnected) return
    refreshProductionOrderOverviewControls(root, state)
    const results = root.querySelector<HTMLElement>('[data-cutting-overview-results]')
    if (results) results.innerHTML = renderTable(filterRows(latestOverviewRows, state.filters), state)
  }, 0)
}

function refreshProductionOrderOverviewControls(target: Element, state: ProductionOrderOverviewPageState): void {
  const root = target.closest<HTMLElement>('[data-cutting-overview-root]') ?? target
  window.setTimeout(() => {
    if (!root.isConnected) return
    Object.entries(MULTI_SELECT_CONFIG).forEach(([field, config]) => {
      const inputs = [...root.querySelectorAll<HTMLInputElement>(`input[data-cutting-overview-filter="${field}"]`)]
      const selectedValues = new Set(state.draftFilters[config.key])
      inputs.forEach((input) => {
        input.checked = selectedValues.has(input.value)
      })
      const summary = inputs[0]?.closest('details')?.querySelector('summary')
      const summaryLabel = summary?.querySelector('span')
      if (summaryLabel) summaryLabel.textContent = `${config.label}${selectedValues.size ? `（${selectedValues.size}）` : ''}`
    })
    const keywordInput = root.querySelector<HTMLInputElement>('[data-cutting-overview-keyword]')
    if (keywordInput && keywordInput.value !== state.draftFilters.keyword) keywordInput.value = state.draftFilters.keyword
    root.querySelector<HTMLInputElement>('[data-cutting-overview-order-date="from"]')?.setAttribute('value', state.draftFilters.orderDateFrom)
    root.querySelector<HTMLInputElement>('[data-cutting-overview-order-date="to"]')?.setAttribute('value', state.draftFilters.orderDateTo)
  }, 0)
}

export function handleProductionOrderOverviewEvent(
  target: Element,
  state: ProductionOrderOverviewPageState,
  event?: Event,
): boolean {
  const keywordNode = target.closest<HTMLInputElement>('[data-cutting-overview-keyword]')
  if (keywordNode) {
    state.draftFilters.keyword = keywordNode.value
    state.page = 1
    return true
  }

  const orderDateNode = target.closest<HTMLInputElement>('[data-cutting-overview-order-date]')
  if (orderDateNode) {
    const key = orderDateNode.dataset.cuttingOverviewOrderDate === 'to' ? 'orderDateTo' : 'orderDateFrom'
    state.draftFilters[key] = orderDateNode.value
    state.page = 1
    return true
  }

  const multiSelectNode = target.closest<HTMLInputElement>('[data-cutting-overview-filter]')
  if (multiSelectNode) {
    if (event?.type === 'input') return true
    const field = multiSelectNode.dataset.cuttingOverviewFilter as MultiSelectField | undefined
    const config = field ? MULTI_SELECT_CONFIG[field] : undefined
    if (!config) return false
    const key = config.key as MultiSelectFilterKey
    const current = new Set(state.draftFilters[key])
    if (multiSelectNode.checked) current.add(multiSelectNode.value)
    else current.delete(multiSelectNode.value)
    state.draftFilters[key] = [...current]
    state.page = 1
    refreshProductionOrderOverviewControls(target, state)
    return true
  }

  const pageSizeNode = target.closest<HTMLSelectElement>('[data-cutting-overview-page-size]')
  if (pageSizeNode) {
    state.pageSize = Number(pageSizeNode.value) || 20
    state.page = 1
    refreshProductionOrderOverview(target, state)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-overview-action]')
  const action = actionNode?.dataset.cuttingOverviewAction
  if (!action) return false
  if (action === 'clear-filters') {
    Object.assign(state, createProductionOrderOverviewPageState())
    refreshProductionOrderOverview(target, state)
    return true
  }
  if (action === 'apply-filters') {
    state.filters = {
      keyword: state.draftFilters.keyword,
      orderDateFrom: state.draftFilters.orderDateFrom,
      orderDateTo: state.draftFilters.orderDateTo,
      printingStatuses: [...state.draftFilters.printingStatuses],
      dyeingStatuses: [...state.draftFilters.dyeingStatuses],
      materialPrepStatuses: [...state.draftFilters.materialPrepStatuses],
      acceptanceStatuses: [...state.draftFilters.acceptanceStatuses],
      pickupStatuses: [...state.draftFilters.pickupStatuses],
    }
    refreshProductionOrderOverview(target, state)
    return true
  }
  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page) || 1
    refreshProductionOrderOverview(target, state)
    return true
  }
  return false
}
