import { renderMultiSelectFilter } from '../../../components/ui/filter-bar.ts'
import { escapeHtml } from '../../../utils.ts'
import { paginateItems, renderStickyFilterShell, renderStickyTableScroller, renderWorkbenchPagination } from './layout.helpers.ts'
import type { ProductionOrderOverviewFactoryLine } from './production-order-overview-model.ts'
import type { ProductionOrderOverviewRow } from './production-order-overview-projection.ts'

export interface ProductionOrderOverviewFilters {
  keyword: string
  printingStatuses: string[]
  dyeingStatuses: string[]
  materialPrepStatuses: string[]
  acceptanceStatuses: string[]
  pickupStatuses: string[]
}

export interface ProductionOrderOverviewPageState {
  filters: ProductionOrderOverviewFilters
  page: number
  pageSize: number
}

export function createProductionOrderOverviewPageState(): ProductionOrderOverviewPageState {
  return {
    filters: {
      keyword: '',
      printingStatuses: [],
      dyeingStatuses: [],
      materialPrepStatuses: [],
      acceptanceStatuses: [],
      pickupStatuses: [],
    },
    page: 1,
    pageSize: 20,
  }
}

const MULTI_SELECT_CONFIG = {
  printing: { key: 'printingStatuses', label: '印花状态', options: ['未开始', '进行中', '已完成', '无需印花', '—'] },
  dyeing: { key: 'dyeingStatuses', label: '染色状态', options: ['未开始', '进行中', '已完成', '无需染色', '—'] },
  materialPrep: { key: 'materialPrepStatuses', label: '配料状态', options: ['未配料', '部分配料', '配料完成', '—'] },
  acceptance: { key: 'acceptanceStatuses', label: '接单状态', options: ['未接单', '已接单'] },
  pickup: { key: 'pickupStatuses', label: '领取状态', options: ['未领取', '部分领取', '领取完成'] },
} as const

type MultiSelectField = keyof typeof MULTI_SELECT_CONFIG
type MultiSelectFilterKey = (typeof MULTI_SELECT_CONFIG)[MultiSelectField]['key']

function includesSelected(selected: string[], values: string[]): boolean {
  return selected.length === 0 || values.some((value) => selected.includes(value))
}

function filterRows(rows: ProductionOrderOverviewRow[], filters: ProductionOrderOverviewFilters): ProductionOrderOverviewRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (keyword && !row.keywordIndex.some((item) => item.toLowerCase().includes(keyword))) return false
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
        factoryTypeLabel: '—',
        acceptanceLabel: '未接单',
        pickupLabel: '未领取',
      }]
}

function statusClass(status: string): string {
  if (['已完成', '配料完成', '领取完成', '已接单', '已入仓', '发货完成'].includes(status)) {
    return 'bg-emerald-50 text-emerald-700'
  }
  if (['进行中', '部分配料', '部分领取'].includes(status) || status.includes('未完成')) {
    return 'bg-amber-50 text-amber-700'
  }
  if (status.startsWith('无需')) return 'bg-slate-100 text-slate-600'
  if (status === '—') return 'bg-muted text-muted-foreground'
  return 'bg-blue-50 text-blue-700'
}

function renderStatus(status: string): string {
  return `<span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(status)}">${escapeHtml(status)}</span>`
}

function renderProductionOrderCell(row: ProductionOrderOverviewRow): string {
  return `
    <div class="space-y-2 text-xs leading-5">
      <div>
        <div class="font-semibold text-foreground">${escapeHtml(row.productionOrderNo)}</div>
        <div class="text-muted-foreground">生成：${escapeHtml(row.productionOrderCreatedAt || '—')}</div>
      </div>
      <div class="border-t pt-2">
        <div class="font-medium text-foreground">${escapeHtml(row.demandId || '—')}</div>
        <div class="text-muted-foreground">创建：${escapeHtml(row.demandCreatedAt || '—')}</div>
      </div>
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
        <div class="grid grid-cols-[minmax(150px,1.4fr)_95px_70px_80px] items-center border-t px-2 py-2 leading-5">
          <span class="font-medium text-foreground">${escapeHtml(line.factoryName)}</span>
          <span class="text-muted-foreground">${escapeHtml(line.factoryTypeLabel)}</span>
          <span>${escapeHtml(line.acceptanceLabel)}</span>
          <span>${escapeHtml(line.pickupLabel)}</span>
        </div>
      `).join('')}
    </div>
  `
}

function renderShippingCell(row: ProductionOrderOverviewRow): string {
  return `
    <div class="space-y-2 text-xs leading-5">
      ${renderStatus(row.shippingStatus)}
      <div class="text-muted-foreground">接收工厂：${escapeHtml(row.receiverFactoryNames.join('、') || '—')}</div>
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
              <th colspan="2" class="px-3 py-2 text-center font-semibold">下单</th>
              <th colspan="2" class="px-3 py-2 text-center font-semibold">印染</th>
              <th colspan="3" class="px-3 py-2 text-center font-semibold">中转仓</th>
              <th colspan="5" class="px-3 py-2 text-center font-semibold">裁床厂</th>
            </tr>
            <tr>
              ${['生产单', '款式', '印花', '染色', '拆解', '配料', '派单工厂 / 接单 / 领取', '唛架', '铺布', '裁剪', '入仓', '发货 / 接收工厂']
                .map((label, index) => `<th class="${index === 0 ? 'sticky left-0 z-30 bg-muted/95' : index === 1 ? 'sticky left-[240px] z-30 bg-muted/95' : ''} px-3 py-2 text-left font-medium">${label}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${pagination.items.length ? pagination.items.map((row) => `
              <tr class="border-b align-top last:border-b-0 hover:bg-muted/20" data-production-order-id="${escapeHtml(row.productionOrderId)}">
                <td class="sticky left-0 z-10 bg-card px-3 py-3">${renderProductionOrderCell(row)}</td>
                <td class="sticky left-[240px] z-10 bg-card px-3 py-3">${renderStyleCell(row)}</td>
                <td class="px-3 py-3">${renderStatus(row.printingStatus)}</td>
                <td class="px-3 py-3">${renderStatus(row.dyeingStatus)}</td>
                <td class="px-3 py-3">${renderStatus(row.breakdownStatus)}</td>
                <td class="px-3 py-3">${renderStatus(row.materialPrepStatus)}</td>
                <td class="px-3 py-3">${renderFactoryLines(row)}</td>
                <td class="px-3 py-3">${renderStatus(row.markerStatus)}</td>
                <td class="px-3 py-3">${renderStatus(row.spreadingStatus)}</td>
                <td class="px-3 py-3">${renderStatus(row.cuttingStatus)}</td>
                <td class="px-3 py-3">${renderStatus(row.inboundStatus)}</td>
                <td class="px-3 py-3">${renderShippingCell(row)}</td>
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
      })}
    </section>
  `
}

function renderFilters(state: ProductionOrderOverviewPageState): string {
  return renderStickyFilterShell(`
    <div class="flex flex-wrap items-end gap-3">
      <label class="min-w-[280px] flex-1 space-y-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <div class="flex gap-2">
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="生产单 / 需求单 / 款式 / 跟单 / 买手 / 工厂"
            class="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-overview-keyword
            data-skip-page-rerender="true"
          />
          <button type="button" class="h-10 rounded-md border bg-background px-3 text-sm hover:bg-muted" data-cutting-overview-action="apply-keyword">查询</button>
        </div>
      </label>
      ${Object.entries(MULTI_SELECT_CONFIG).map(([field, config]) => renderMultiSelectFilter({
        label: config.label,
        field,
        selectedValues: state.filters[config.key],
        options: [...config.options],
        actionAttr: 'data-cutting-overview-multiselect',
      })).join('')}
      <button type="button" class="h-10 rounded-md border bg-background px-3 text-sm hover:bg-muted" data-cutting-overview-action="clear-filters">重置</button>
    </div>
  `)
}

export function renderProductionOrderOverview(
  rows: ProductionOrderOverviewRow[],
  state: ProductionOrderOverviewPageState,
): string {
  const filteredRows = filterRows(rows, state.filters)
  return `${renderFilters(state)}${renderTable(filteredRows, state)}`
}

export function handleProductionOrderOverviewEvent(target: Element, state: ProductionOrderOverviewPageState): boolean {
  const keywordNode = target.closest<HTMLInputElement>('[data-cutting-overview-keyword]')
  if (keywordNode) {
    state.filters.keyword = keywordNode.value
    state.page = 1
    return true
  }

  const multiSelectNode = target.closest<HTMLInputElement>('[data-cutting-overview-multiselect]')
  if (multiSelectNode) {
    const field = multiSelectNode.dataset.cuttingOverviewMultiselect as MultiSelectField | undefined
    const config = field ? MULTI_SELECT_CONFIG[field] : undefined
    if (!config) return false
    const key = config.key as MultiSelectFilterKey
    const current = new Set(state.filters[key])
    if (multiSelectNode.checked) current.add(multiSelectNode.value)
    else current.delete(multiSelectNode.value)
    state.filters[key] = [...current]
    state.page = 1
    return true
  }

  const pageSizeNode = target.closest<HTMLSelectElement>('[data-cutting-overview-page-size]')
  if (pageSizeNode) {
    state.pageSize = Number(pageSizeNode.value) || 20
    state.page = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-overview-action]')
  const action = actionNode?.dataset.cuttingOverviewAction
  if (!action) return false
  if (action === 'clear-filters') {
    Object.assign(state, createProductionOrderOverviewPageState())
    return true
  }
  if (action === 'apply-keyword') return true
  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page) || 1
    return true
  }
  return false
}
