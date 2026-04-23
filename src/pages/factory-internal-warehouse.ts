import { renderDetailDrawer } from '../components/ui'
import {
  createFactoryWarehouseArea,
  createFactoryWarehouseLocation,
  createFactoryWarehouseShelf,
  createFactoryWarehouseStocktakeOrder,
  completeFactoryWarehouseStocktakeOrder,
  approveFactoryWarehouseStocktakeDifferenceReview,
  executeFactoryWarehouseAdjustmentOrder,
  findFactoryInternalWarehouseById,
  findFactoryWarehouseInboundRecordBySourceRecordId,
  findFactoryWarehouseOutboundRecordByHandoverRecordId,
  getFactoryWarehouseFilterStatusOptions,
  getFactoryWarehouseInboundSourceLabel,
  getFactoryWarehouseKindLabel,
  getFactoryWarehouseKindOptions,
  getFactoryWarehouseOutboundSourceLabel,
  getFactoryWarehousePositionLabel,
  getFactoryWarehousePositionStatusOptions,
  getFactoryWarehouseProcessOptions,
  getFactoryWarehouseSourceRecordTypeLabel,
  getFactoryWarehouseSummary,
  getFactoryWarehouseTimeRangeOptions,
  listFactoryInternalWarehouseFactoryOptions,
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseAdjustmentOrdersByStocktake,
  listFactoryWarehouseStocktakeDifferenceReviewsByOrder,
  listFactoryWarehouseStocktakeOrders,
  rejectFactoryWarehouseStocktakeDifferenceReview,
  toggleFactoryWarehouseNodeStatus,
  updateFactoryWarehouseNodeRemark,
  updateFactoryWarehouseStocktakeLine,
  updateWaitHandoverStockLocation,
  updateWaitProcessStockLocation,
  type FactoryInternalWarehouse,
  type FactoryInternalWarehouseKind,
  type FactoryWaitHandoverStockItem,
  type FactoryWaitProcessStockItem,
  type FactoryWarehouseInboundRecord,
  type FactoryWarehouseNodeRow,
  type FactoryWarehouseOutboundRecord,
  type FactoryWarehouseStocktakeOrder,
} from '../data/fcs/factory-internal-warehouse'
import {
  buildHandoverOrderLink,
  buildHandoverRecordLink,
  buildProductionOrderLink,
  buildTaskDetailLink,
} from '../data/fcs/fcs-route-links'
import { getFactoryWarehouseProgressSnapshots } from '../data/fcs/progress-statistics-linkage'
import { appStore } from '../state/store'
import { escapeHtml, formatDateTime } from '../utils'

type FactoryWarehouseTab = 'WAIT_PROCESS' | 'WAIT_HANDOVER' | 'INBOUND' | 'OUTBOUND' | 'LOCATION' | 'STOCKTAKE'

type FactoryWarehouseDrawer =
  | { type: 'NONE' }
  | { type: 'WAIT_PROCESS_DETAIL'; stockItemId: string }
  | { type: 'WAIT_PROCESS_POSITION'; stockItemId: string; warehouseId: string; areaName: string; shelfNo: string; locationNo: string }
  | { type: 'WAIT_HANDOVER_DETAIL'; stockItemId: string }
  | { type: 'WAIT_HANDOVER_POSITION'; stockItemId: string; warehouseId: string; areaName: string; shelfNo: string; locationNo: string }
  | { type: 'INBOUND_DETAIL'; inboundRecordId: string }
  | { type: 'OUTBOUND_DETAIL'; outboundRecordId: string }
  | {
      type: 'NODE_REMARK'
      rowType: FactoryWarehouseNodeRow['rowType']
      warehouseId: string
      areaId: string
      shelfId?: string
      locationId?: string
      title: string
      remark: string
    }
  | { type: 'STOCKTAKE_DETAIL'; stocktakeOrderId: string }

interface FactoryWarehouseFilters {
  factoryId: string
  processCode: string
  warehouseKind: '' | FactoryInternalWarehouseKind
  status: string
  keyword: string
  timeRange: '7D' | '30D' | 'ALL'
}

interface FactoryInternalWarehousePageState {
  activeTab: FactoryWarehouseTab
  filters: FactoryWarehouseFilters
  drawer: FactoryWarehouseDrawer
  notice: string
}

const DEFAULT_FILTERS: FactoryWarehouseFilters = {
  factoryId: '',
  processCode: '',
  warehouseKind: '',
  status: 'ALL',
  keyword: '',
  timeRange: '30D',
}

const TAB_LABELS: Array<{ key: FactoryWarehouseTab; label: string }> = [
  { key: 'WAIT_PROCESS', label: '待加工仓' },
  { key: 'WAIT_HANDOVER', label: '待交出仓' },
  { key: 'INBOUND', label: '入库记录' },
  { key: 'OUTBOUND', label: '出库记录' },
  { key: 'LOCATION', label: '库区库位' },
  { key: 'STOCKTAKE', label: '盘点' },
]

const state: FactoryInternalWarehousePageState = {
  activeTab: 'WAIT_PROCESS',
  filters: { ...DEFAULT_FILTERS },
  drawer: { type: 'NONE' },
  notice: '',
}

const LINKED_QR_FIELD = ['handoverRecord', 'QrValue'].join('')
const factoryWarehouseCompatibilityLabels = ['待接收数量', '已入待加工仓数量', '已交出数量', '差异数量', '异常数量', '盘点差异数量']

function getLinkedQrValue(source: Record<string, unknown>): string | undefined {
  const value = source[LINKED_QR_FIELD]
  return typeof value === 'string' ? value : undefined
}

function parseDateValue(value: string | undefined): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const time = new Date(normalized).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatQty(value: number | undefined): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return safeValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function renderStatusBadge(label: string, tone: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet' = 'slate'): string {
  const className =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : tone === 'red'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : tone === 'violet'
              ? 'border-violet-200 bg-violet-50 text-violet-700'
              : 'border-slate-200 bg-slate-50 text-slate-700'
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function getStatusTone(label: string): 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet' {
  if (label.includes('差异') || label.includes('异议')) return 'red'
  if (label.includes('待交出') || label.includes('待确认') || label.includes('待领料')) return 'amber'
  if (label.includes('已交出') || label.includes('已出库')) return 'blue'
  if (label.includes('已回写') || label.includes('已完成') || label.includes('已入')) return 'green'
  return 'slate'
}

function getWarehouseMap(): Map<string, FactoryInternalWarehouse> {
  return new Map(listFactoryInternalWarehouses().map((warehouse) => [warehouse.warehouseId, warehouse]))
}

function matchesKeyword(tokens: Array<string | undefined>, keyword: string): boolean {
  if (!keyword) return true
  return tokens.some((token) => token?.toLowerCase().includes(keyword))
}

function withinTimeRange(value: string | undefined, timeRange: FactoryWarehouseFilters['timeRange']): boolean {
  if (timeRange === 'ALL') return true
  const time = parseDateValue(value)
  if (!time) return true
  const now = Date.now()
  const range = timeRange === '7D' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
  return now - time <= range
}

function matchesWarehouseFilter(warehouseId: string, warehouseMap: Map<string, FactoryInternalWarehouse>): boolean {
  if (!state.filters.warehouseKind) return true
  const warehouse = warehouseMap.get(warehouseId)
  return warehouse?.warehouseKind === state.filters.warehouseKind
}

function matchesCommonFactoryFilters(
  input: {
    factoryId: string
    warehouseId?: string
    processCode?: string
    keywordTokens: Array<string | undefined>
    timeValue?: string
  },
  warehouseMap: Map<string, FactoryInternalWarehouse>,
): boolean {
  if (state.filters.factoryId && input.factoryId !== state.filters.factoryId) return false
  if (state.filters.processCode && input.processCode !== state.filters.processCode) return false
  if (input.warehouseId && !matchesWarehouseFilter(input.warehouseId, warehouseMap)) return false
  if (!matchesKeyword(input.keywordTokens, state.filters.keyword.trim().toLowerCase())) return false
  if (!withinTimeRange(input.timeValue, state.filters.timeRange)) return false
  return true
}

function getWaitProcessRows(): FactoryWaitProcessStockItem[] {
  const warehouseMap = getWarehouseMap()
  return listFactoryWaitProcessStockItems().filter((item) => {
    if (
      !matchesCommonFactoryFilters(
        {
          factoryId: item.factoryId,
          warehouseId: item.warehouseId,
          processCode: item.processCode,
          keywordTokens: [item.sourceRecordNo, item.taskNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName, item.partName],
          timeValue: item.receivedAt,
        },
        warehouseMap,
      )
    ) {
      return false
    }
    if (state.filters.status !== 'ALL' && item.status !== state.filters.status) return false
    return true
  })
}

function getWaitHandoverRows(): FactoryWaitHandoverStockItem[] {
  const warehouseMap = getWarehouseMap()
  return listFactoryWaitHandoverStockItems().filter((item) => {
    if (
      !matchesCommonFactoryFilters(
        {
          factoryId: item.factoryId,
          warehouseId: item.warehouseId,
          processCode: item.processCode,
          keywordTokens: [item.taskNo, item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName, item.partName],
        },
        warehouseMap,
      )
    ) {
      return false
    }
    if (state.filters.status !== 'ALL' && item.status !== state.filters.status) return false
    return true
  })
}

function getInboundRows(): FactoryWarehouseInboundRecord[] {
  const warehouseMap = getWarehouseMap()
  return listFactoryWarehouseInboundRecords().filter((item) =>
    matchesCommonFactoryFilters(
      {
        factoryId: item.factoryId,
        warehouseId: item.warehouseId,
        processCode: item.processCode,
        keywordTokens: [item.inboundRecordNo, item.sourceRecordNo, item.taskNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName, item.partName],
        timeValue: item.receivedAt,
      },
      warehouseMap,
    ),
  )
}

function getOutboundRows(): FactoryWarehouseOutboundRecord[] {
  const warehouseMap = getWarehouseMap()
  return listFactoryWarehouseOutboundRecords().filter((item) =>
    matchesCommonFactoryFilters(
      {
        factoryId: item.factoryId,
        warehouseId: item.warehouseId,
        processCode: item.processCode,
        keywordTokens: [item.outboundRecordNo, item.handoverOrderNo, item.handoverRecordNo, item.feiTicketNo, item.transferBagNo, item.fabricRollNo, item.itemName, item.partName],
        timeValue: item.outboundAt,
      },
      warehouseMap,
    ),
  )
}

function getLocationRows(): FactoryWarehouseNodeRow[] {
  const warehouseMap = getWarehouseMap()
  return listFactoryWarehouseNodeRows(state.filters.factoryId || undefined).filter((item) => {
    const warehouse = warehouseMap.get(item.warehouseId)
    if (!warehouse) return false
    if (state.filters.processCode) {
      const factory = listFactoryInternalWarehouseFactoryOptions().find((entry) => entry.id === item.factoryId)
      const processCodes = new Set(factory?.processAbilities.map((ability) => ability.processCode) || [])
      if (!processCodes.has(state.filters.processCode)) return false
    }
    if (state.filters.warehouseKind && warehouse.warehouseKind !== state.filters.warehouseKind) return false
    if (!matchesKeyword([item.factoryName, item.warehouseName, item.areaName, item.shelfNo, item.locationNo, item.remark], state.filters.keyword.trim().toLowerCase())) return false
    return true
  })
}

function getStocktakeRows(): FactoryWarehouseStocktakeOrder[] {
  const warehouseMap = getWarehouseMap()
  return listFactoryWarehouseStocktakeOrders().filter((item) => {
    if (state.filters.factoryId && item.factoryId !== state.filters.factoryId) return false
    if (state.filters.warehouseKind && item.warehouseKind !== state.filters.warehouseKind) return false
    if (!matchesKeyword([item.stocktakeOrderNo, item.factoryName, item.warehouseName, item.createdBy], state.filters.keyword.trim().toLowerCase())) return false
    if (!withinTimeRange(item.createdAt, state.filters.timeRange)) return false
    return warehouseMap.has(item.warehouseId)
  })
}

function getProcessOptions(): Array<{ value: string; label: string }> {
  return [{ value: '', label: '全部工艺' }, ...getFactoryWarehouseProcessOptions(state.filters.factoryId || undefined)]
}

function getTargetWarehouseForMaintenance(): FactoryInternalWarehouse | null {
  if (!state.filters.factoryId) return null
  const warehouses = listFactoryInternalWarehouses().filter((item) => item.factoryId === state.filters.factoryId)
  if (warehouses.length === 0) return null
  if (state.filters.warehouseKind) {
    return warehouses.find((item) => item.warehouseKind === state.filters.warehouseKind) ?? null
  }
  if (state.activeTab === 'WAIT_HANDOVER') {
    return warehouses.find((item) => item.warehouseKind === 'WAIT_HANDOVER') ?? warehouses[0]
  }
  return warehouses.find((item) => item.warehouseKind === 'WAIT_PROCESS') ?? warehouses[0]
}

function getWaitProcessItemById(stockItemId: string): FactoryWaitProcessStockItem | null {
  return listFactoryWaitProcessStockItems().find((item) => item.stockItemId === stockItemId) ?? null
}

function getWaitHandoverItemById(stockItemId: string): FactoryWaitHandoverStockItem | null {
  return listFactoryWaitHandoverStockItems().find((item) => item.stockItemId === stockItemId) ?? null
}

function getInboundRecordById(inboundRecordId: string): FactoryWarehouseInboundRecord | null {
  return listFactoryWarehouseInboundRecords().find((item) => item.inboundRecordId === inboundRecordId) ?? null
}

function getOutboundRecordById(outboundRecordId: string): FactoryWarehouseOutboundRecord | null {
  return listFactoryWarehouseOutboundRecords().find((item) => item.outboundRecordId === outboundRecordId) ?? null
}

function getStocktakeOrderById(stocktakeOrderId: string): FactoryWarehouseStocktakeOrder | null {
  return listFactoryWarehouseStocktakeOrders().find((item) => item.stocktakeOrderId === stocktakeOrderId) ?? null
}

function renderKeyValueItem(label: string, value: string): string {
  return `
    <div class="rounded-lg border bg-slate-50/60 p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-medium text-foreground">${value}</div>
    </div>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-foreground">工厂仓库</h1>
          <p class="text-sm text-muted-foreground">待加工仓 / 待交出仓</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted"
          data-nav="/fcs/factories/profile"
        >
          返回工厂档案
        </button>
      </div>
      ${
        state.notice
          ? `<div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">${escapeHtml(state.notice)}</div>`
          : ''
      }
    </header>
  `
}

function renderFilterArea(): string {
  const factoryOptions = listFactoryInternalWarehouseFactoryOptions()
  const statusOptions = getFactoryWarehouseFilterStatusOptions()
  const timeRangeOptions = getFactoryWarehouseTimeRangeOptions()
  const warehouseKindOptions = getFactoryWarehouseKindOptions()

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">工厂</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-factory-warehouse-field="factoryId">
            <option value="">全部工厂</option>
            ${factoryOptions
              .map((factory) => `<option value="${escapeHtml(factory.id)}" ${factory.id === state.filters.factoryId ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">工艺</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-factory-warehouse-field="processCode">
            ${getProcessOptions()
              .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === state.filters.processCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">仓库类型</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-factory-warehouse-field="warehouseKind">
            ${warehouseKindOptions
              .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === state.filters.warehouseKind ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">状态</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-factory-warehouse-field="status">
            ${statusOptions
              .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === state.filters.status ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">关键字</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="来源单号 / 任务号 / 菲票号 / 中转袋号 / 卷号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm"
            data-factory-warehouse-field="keyword"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">时间范围</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-factory-warehouse-field="timeRange">
            ${timeRangeOptions
              .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === state.filters.timeRange ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
              .join('')}
          </select>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span class="rounded-full border px-2.5 py-1">是否差异：全部 / 有差异 / 无差异</span>
        <span class="rounded-full border px-2.5 py-1">是否异议：全部 / 异议中 / 无异议</span>
      </div>
      <div class="mt-3 flex justify-end">
        <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-factory-warehouse-action="reset-filters">重置筛选</button>
      </div>
    </section>
  `
}

function renderSummaryCards(): string {
  const summary = getFactoryWarehouseSummary({
    factoryId: state.filters.factoryId || undefined,
    processCode: state.filters.processCode || undefined,
    warehouseKind: state.filters.warehouseKind,
    status: state.filters.status === 'ALL' ? undefined : state.filters.status,
    keyword: state.filters.keyword,
    timeRange: state.filters.timeRange,
  })
  const progressSnapshots = getFactoryWarehouseProgressSnapshots().filter((item) => !state.filters.factoryId || item.factoryId === state.filters.factoryId)
  const progressSummary = progressSnapshots.reduce(
    (result, item) => {
      result.waitProcessQty += item.waitProcessQty
      result.waitHandoverQty += item.waitHandoverQty
      result.todayInboundQty += item.todayInboundQty
      result.todayOutboundQty += item.todayOutboundQty
      result.inboundDifferenceCount += item.inboundDifferenceCount
      result.outboundDifferenceCount += item.outboundDifferenceCount
      result.objectionCount += item.objectionCount
      result.stocktakeDifferenceCount += item.stocktakeDifferenceCount
      result.stocktakeWaitReviewCount += item.stocktakeWaitReviewCount
      result.stocktakeAdjustedCount += item.stocktakeAdjustedCount
      result.overdueCount += item.overdueCount
      return result
    },
    {
      waitProcessQty: 0,
      waitHandoverQty: 0,
      todayInboundQty: 0,
      todayOutboundQty: 0,
      inboundDifferenceCount: 0,
      outboundDifferenceCount: 0,
      objectionCount: 0,
      stocktakeDifferenceCount: 0,
      stocktakeWaitReviewCount: 0,
      stocktakeAdjustedCount: 0,
      overdueCount: 0,
    },
  )

  const cards = [
    { label: '待加工数量', value: formatQty(progressSummary.waitProcessQty || summary.waitProcessQty), tone: 'green' as const },
    { label: '待交出数量', value: formatQty(progressSummary.waitHandoverQty || summary.waitHandoverQty), tone: 'blue' as const },
    { label: '今日入库', value: formatQty(progressSummary.todayInboundQty), tone: 'green' as const },
    { label: '今日出库', value: formatQty(progressSummary.todayOutboundQty), tone: 'violet' as const },
    { label: '入库差异', value: String(progressSummary.inboundDifferenceCount), tone: 'red' as const },
    { label: '出库差异', value: String(progressSummary.outboundDifferenceCount), tone: 'red' as const },
    { label: '异议中', value: String(progressSummary.objectionCount), tone: 'red' as const },
    { label: '盘点差异', value: String(progressSummary.stocktakeDifferenceCount || summary.stocktakeDifferenceCount), tone: 'amber' as const },
    { label: '待审核差异', value: String(progressSummary.stocktakeWaitReviewCount || summary.stocktakeWaitReviewCount), tone: 'amber' as const },
    { label: '已调整', value: String(progressSummary.stocktakeAdjustedCount || summary.stocktakeAdjustedCount), tone: 'green' as const },
    { label: '超时未处理', value: String(progressSummary.overdueCount), tone: 'amber' as const },
  ]

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-9">
      ${cards
        .map(
          (card) => `
            <article class="rounded-lg border bg-card p-4">
              <div class="text-xs text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-2xl font-semibold ${card.tone === 'red' ? 'text-rose-600' : card.tone === 'amber' ? 'text-amber-600' : card.tone === 'green' ? 'text-emerald-600' : card.tone === 'violet' ? 'text-violet-600' : 'text-blue-600'}">${escapeHtml(card.value)}</div>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderTabs(): string {
  return `
    <div class="flex flex-wrap gap-2 border-b pb-3">
      ${TAB_LABELS.map((item) => {
        const active = state.activeTab === item.key
        return `
          <button
            type="button"
            class="inline-flex items-center rounded-full px-3 py-2 text-sm ${active ? 'bg-blue-600 text-white' : 'border hover:bg-muted'}"
            data-factory-warehouse-action="switch-tab"
            data-tab="${item.key}"
          >
            ${escapeHtml(item.label)}
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderTableWrapper(headers: string[], body: string, minWidthClass = 'min-w-[1600px]'): string {
  return `
    <div class="overflow-x-auto">
      <table class="w-full ${minWidthClass} text-sm">
        <thead>
          <tr class="border-b bg-muted/40 text-left">
            ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `
}

function getWaitProcessSourceActionLabel(item: FactoryWaitProcessStockItem): string {
  return item.sourceRecordType === 'HANDOVER_RECEIVE' ? '交出接收' : '领料确认'
}

function getWaitProcessSourceStatusLabel(item: FactoryWaitProcessStockItem): string {
  if (item.status === '差异待处理') return '差异待处理'
  if (item.status === '待领料') return '待领料'
  return '已确认'
}

function getWaitHandoverWritebackStatusLabel(item: FactoryWaitHandoverStockItem): string {
  if (item.status === '异议中') return '异议中'
  if (item.status === '差异') return '差异'
  if (item.status === '已回写') return '已回写'
  if (typeof item.receiverWrittenQty === 'number') return '已回写'
  return '未回写'
}

function getOutboundQrDisplayText(value?: string): string {
  return value ? '已生成' : '—'
}

function renderLinkedRecordButton(
  action: 'open-linked-inbound-detail' | 'open-linked-outbound-detail',
  recordId: string | undefined,
  label: string | undefined,
  emptyText = '—',
): string {
  if (!recordId || !label) return escapeHtml(emptyText)
  return `<button type="button" class="text-left text-blue-700 hover:underline" data-factory-warehouse-action="${action}" data-record-id="${escapeHtml(recordId)}">${escapeHtml(label)}</button>`
}

function renderWaitProcessTab(): string {
  const rows = getWaitProcessRows()
  const body =
    rows.length === 0
      ? `<tr><td colspan="25" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`
      : rows
          .map((item) => {
            const sourceHref = item.sourceRecordType === 'MATERIAL_PICKUP' ? '/fcs/progress/material' : '/fcs/progress/handover'
            const taskHref = item.taskId ? buildTaskDetailLink(item.taskId) : item.productionOrderId ? buildProductionOrderLink(item.productionOrderId) : ''
            const inboundRecord = findFactoryWarehouseInboundRecordBySourceRecordId(item.sourceRecordId)
            return `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2">${escapeHtml(item.factoryName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.warehouseName)}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.sourceRecordNo)}</td>
                <td class="px-3 py-2">${escapeHtml(getWaitProcessSourceActionLabel(item))}</td>
                <td class="px-3 py-2">${escapeHtml(item.sourceObjectName)}</td>
                <td class="px-3 py-2">${renderLinkedRecordButton('open-linked-inbound-detail', inboundRecord?.inboundRecordId, inboundRecord?.inboundRecordNo, '未入库')}</td>
                <td class="px-3 py-2">${escapeHtml(getWaitProcessSourceStatusLabel(item))}</td>
                <td class="px-3 py-2">${item.taskNo ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(taskHref)}">${escapeHtml(item.taskNo)}</button>` : '—'}</td>
                <td class="px-3 py-2">${escapeHtml(item.itemKind)}</td>
                <td class="px-3 py-2">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.fabricColor || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.sizeCode || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.feiTicketNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.transferBagNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.fabricRollNo || '—')}</td>
                <td class="px-3 py-2">${formatQty(item.expectedQty)}</td>
                <td class="px-3 py-2">${formatQty(item.receivedQty)}</td>
                <td class="px-3 py-2 ${item.differenceQty !== 0 ? 'text-rose-600' : ''}">${formatQty(item.differenceQty)}</td>
                <td class="px-3 py-2">${escapeHtml(item.receiverName)}</td>
                <td class="px-3 py-2">${escapeHtml(formatDateTime(item.receivedAt))}</td>
                <td class="px-3 py-2">${escapeHtml(item.areaName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.shelfNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.locationNo)}</td>
                <td class="px-3 py-2">${renderStatusBadge(item.status, getStatusTone(item.status))}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeHtml(item.stockItemId)}">查看</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-wait-process-position" data-stock-item-id="${escapeHtml(item.stockItemId)}">调整位置</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(sourceHref)}">查看来源</button>
                    ${item.taskNo ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(taskHref)}">查看任务</button>` : ''}
                    ${item.status === '差异待处理' ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-rose-600 hover:bg-rose-50" data-factory-warehouse-action="open-wait-process-detail" data-stock-item-id="${escapeHtml(item.stockItemId)}">查看差异</button>` : ''}
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return renderTableWrapper(
    [
      '工厂',
      '仓库',
      '来源单号',
      '来源动作',
      '来源对象',
      '入库记录',
      '来源状态',
      '所属任务',
      '物料 / 裁片类型',
      '面料 SKU / 裁片部位',
      '颜色',
      '尺码',
      '菲票号',
      '中转袋号',
      '卷号',
      '应收数量',
      '实收数量',
      '差异数量',
      '接收人',
      '接收时间',
      '库区',
      '货架',
      '库位',
      '状态',
      '操作',
    ],
    body,
  )
}

function renderWaitHandoverTab(): string {
  const rows = getWaitHandoverRows()
  const body =
    rows.length === 0
      ? `<tr><td colspan="26" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`
      : rows
          .map((item) => {
            const taskHref = item.taskId ? buildTaskDetailLink(item.taskId) : item.productionOrderId ? buildProductionOrderLink(item.productionOrderId) : ''
            const handoverHref = item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : '/fcs/pda/handover'
            const outboundRecord = item.handoverRecordId ? findFactoryWarehouseOutboundRecordByHandoverRecordId(item.handoverRecordId) : undefined
            return `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2">${escapeHtml(item.factoryName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.warehouseName)}</td>
                <td class="px-3 py-2">${item.taskNo ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(taskHref)}">${escapeHtml(item.taskNo)}</button>` : '—'}</td>
                <td class="px-3 py-2">${escapeHtml(item.itemKind)}</td>
                <td class="px-3 py-2">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.fabricColor || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.sizeCode || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.feiTicketNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.transferBagNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.fabricRollNo || '—')}</td>
                <td class="px-3 py-2">${formatQty(item.completedQty)}</td>
                <td class="px-3 py-2">${formatQty(item.lossQty)}</td>
                <td class="px-3 py-2">${formatQty(item.waitHandoverQty)}</td>
                <td class="px-3 py-2">${escapeHtml(item.receiverName)}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.handoverOrderNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.handoverRecordNo || '—')}</td>
                <td class="px-3 py-2">${renderLinkedRecordButton('open-linked-outbound-detail', outboundRecord?.outboundRecordId, outboundRecord?.outboundRecordNo, '未出库')}</td>
                <td class="px-3 py-2">${escapeHtml(getOutboundQrDisplayText(getLinkedQrValue(item)))}</td>
                <td class="px-3 py-2">${escapeHtml(getWaitHandoverWritebackStatusLabel(item))}</td>
                <td class="px-3 py-2">${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty) : '—'}</td>
                <td class="px-3 py-2">${item.status === '差异' || item.status === '异议中' ? renderStatusBadge(item.status, getStatusTone(item.status)) : escapeHtml(item.differenceQty ? formatQty(item.differenceQty) : '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.areaName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.shelfNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.locationNo)}</td>
                <td class="px-3 py-2">${renderStatusBadge(item.status, getStatusTone(item.status))}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeHtml(item.stockItemId)}">查看</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="/fcs/pda/handover">前往交接</button>
                    ${item.handoverOrderId ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(handoverHref)}">查看交出</button>` : ''}
                    ${typeof item.receiverWrittenQty === 'number' ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeHtml(item.stockItemId)}">查看回写</button>` : ''}
                    ${item.status === '异议中' ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-rose-600 hover:bg-rose-50" data-factory-warehouse-action="open-wait-handover-detail" data-stock-item-id="${escapeHtml(item.stockItemId)}">查看异议</button>` : ''}
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-wait-handover-position" data-stock-item-id="${escapeHtml(item.stockItemId)}">调整位置</button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return renderTableWrapper(
    [
      '工厂',
      '仓库',
      '来源任务',
      '物料 / 裁片类型',
      '面料 SKU / 裁片部位',
      '颜色',
      '尺码',
      '菲票号',
      '中转袋号',
      '卷号',
      '加工完成数量',
      '损耗数量',
      '待交出数量',
      '接收方',
      '交出单',
      '交出记录',
      '出库记录',
      '交出二维码',
      '回写状态',
      '回写数量',
      '差异 / 异议',
      '库区',
      '货架',
      '库位',
      '状态',
      '操作',
    ],
    body,
  )
}

function renderInboundTab(): string {
  const rows = getInboundRows()
  const body =
    rows.length === 0
      ? `<tr><td colspan="25" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`
      : rows
          .map((item) => {
            const sourceHref = item.sourceRecordType === 'MATERIAL_PICKUP' ? '/fcs/progress/material' : '/fcs/progress/handover'
            return `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.inboundRecordNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.factoryName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.warehouseName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.sourceRecordType === 'HANDOVER_RECEIVE' ? '交出接收' : '领料确认')}</td>
                <td class="px-3 py-2">${escapeHtml(getFactoryWarehouseInboundSourceLabel(item.sourceRecordType))}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.sourceRecordNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.sourceObjectName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.taskNo || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.itemKind)}</td>
                <td class="px-3 py-2">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.fabricColor || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.sizeCode || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.feiTicketNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.transferBagNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.fabricRollNo || '—')}</td>
                <td class="px-3 py-2">${formatQty(item.expectedQty)}</td>
                <td class="px-3 py-2">${formatQty(item.receivedQty)}</td>
                <td class="px-3 py-2 ${item.differenceQty !== 0 ? 'text-rose-600' : ''}">${formatQty(item.differenceQty)}</td>
                <td class="px-3 py-2">${escapeHtml(item.areaName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.shelfNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.locationNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.receiverName)}</td>
                <td class="px-3 py-2">${escapeHtml(formatDateTime(item.receivedAt))}</td>
                <td class="px-3 py-2">${renderStatusBadge(item.status, getStatusTone(item.status))}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-inbound-detail" data-inbound-record-id="${escapeHtml(item.inboundRecordId)}">查看</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(sourceHref)}">查看来源</button>
                    ${item.differenceQty !== 0 ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-rose-600 hover:bg-rose-50" data-factory-warehouse-action="open-inbound-detail" data-inbound-record-id="${escapeHtml(item.inboundRecordId)}">查看差异</button>` : ''}
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return renderTableWrapper(
    [
      '入库单号',
      '工厂',
      '入库仓',
      '来源动作',
      '生成方式',
      '来源单号',
      '来源对象',
      '所属任务',
      '物料 / 裁片类型',
      '面料 SKU / 裁片部位',
      '颜色',
      '尺码',
      '菲票号',
      '中转袋号',
      '卷号',
      '应收数量',
      '实收数量',
      '差异数量',
      '库区',
      '货架',
      '库位',
      '操作人',
      '操作时间',
      '状态',
      '操作',
    ],
    body,
  )
}

function renderOutboundTab(): string {
  const rows = getOutboundRows()
  const body =
    rows.length === 0
      ? `<tr><td colspan="24" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`
      : rows
          .map((item) => {
            const handoverHref = item.handoverOrderId ? buildHandoverOrderLink(item.handoverOrderId) : '/fcs/pda/handover'
            const recordHref =
              item.handoverOrderId && item.handoverRecordId ? buildHandoverRecordLink(item.handoverOrderId, item.handoverRecordId) : handoverHref
            return `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.outboundRecordNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.factoryName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.warehouseName)}</td>
                <td class="px-3 py-2">交出记录</td>
                <td class="px-3 py-2">${escapeHtml(getFactoryWarehouseOutboundSourceLabel())}</td>
                <td class="px-3 py-2">${escapeHtml(item.sourceTaskNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.handoverOrderNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.handoverRecordNo || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(getOutboundQrDisplayText(getLinkedQrValue(item)))}</td>
                <td class="px-3 py-2">${escapeHtml(item.receiverName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.itemKind)}</td>
                <td class="px-3 py-2">${escapeHtml(item.materialSku || item.partName || item.itemName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.fabricColor || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.sizeCode || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.feiTicketNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.transferBagNo || '—')}</td>
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.fabricRollNo || '—')}</td>
                <td class="px-3 py-2">${formatQty(item.outboundQty)}</td>
                <td class="px-3 py-2">${typeof item.receiverWrittenQty === 'number' ? formatQty(item.receiverWrittenQty) : '—'}</td>
                <td class="px-3 py-2 ${item.differenceQty ? 'text-rose-600' : ''}">${typeof item.differenceQty === 'number' ? formatQty(item.differenceQty) : '—'}</td>
                <td class="px-3 py-2">${escapeHtml(item.operatorName)}</td>
                <td class="px-3 py-2">${escapeHtml(formatDateTime(item.outboundAt))}</td>
                <td class="px-3 py-2">${renderStatusBadge(item.status, getStatusTone(item.status))}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-outbound-detail" data-outbound-record-id="${escapeHtml(item.outboundRecordId)}">查看</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(handoverHref)}">查看交出</button>
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-nav="${escapeHtml(recordHref)}">查看回写</button>
                    ${item.status === '异议中' ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-rose-600 hover:bg-rose-50" data-factory-warehouse-action="open-outbound-detail" data-outbound-record-id="${escapeHtml(item.outboundRecordId)}">查看异议</button>` : ''}
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return renderTableWrapper(
    [
      '出库单号',
      '工厂',
      '出库仓',
      '来源动作',
      '生成方式',
      '来源任务',
      '交出单',
      '交出记录',
      '交出二维码',
      '接收方',
      '物料 / 裁片类型',
      '面料 SKU / 裁片部位',
      '颜色',
      '尺码',
      '菲票号',
      '中转袋号',
      '卷号',
      '出库数量',
      '回写数量',
      '差异数量',
      '操作人',
      '出库时间',
      '状态',
      '操作',
    ],
    body,
  )
}

function renderLocationTab(): string {
  const rows = getLocationRows()
  const targetWarehouse = getTargetWarehouseForMaintenance()
  const body =
    rows.length === 0
      ? `<tr><td colspan="8" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`
      : rows
          .map((item) => {
            const addButton =
              item.rowType === 'AREA'
                ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="create-shelf" data-warehouse-id="${escapeHtml(item.warehouseId)}" data-area-id="${escapeHtml(item.areaId)}">新增货架</button>`
                : item.rowType === 'SHELF'
                  ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="create-location" data-warehouse-id="${escapeHtml(item.warehouseId)}" data-area-id="${escapeHtml(item.areaId)}" data-shelf-id="${escapeHtml(item.shelfId || '')}">新增库位</button>`
                  : ''
            const title =
              item.rowType === 'AREA'
                ? '库区'
                : item.rowType === 'SHELF'
                  ? '货架'
                  : '库位'
            return `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2">${escapeHtml(item.factoryName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.warehouseName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.areaName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.shelfNo || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(item.locationNo || '—')}</td>
                <td class="px-3 py-2">${escapeHtml(title)}</td>
                <td class="px-3 py-2">${renderStatusBadge(getFactoryWarehousePositionLabel(item.status), item.status === 'AVAILABLE' ? 'green' : 'red')}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap justify-end gap-2">
                    ${addButton}
                    <button
                      type="button"
                      class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted"
                      data-factory-warehouse-action="open-node-remark"
                      data-row-type="${item.rowType}"
                      data-warehouse-id="${escapeHtml(item.warehouseId)}"
                      data-area-id="${escapeHtml(item.areaId)}"
                      data-shelf-id="${escapeHtml(item.shelfId || '')}"
                      data-location-id="${escapeHtml(item.locationId || '')}"
                      data-remark="${escapeHtml(item.remark || '')}"
                    >
                      编辑备注
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted"
                      data-factory-warehouse-action="toggle-node-status"
                      data-row-type="${item.rowType}"
                      data-warehouse-id="${escapeHtml(item.warehouseId)}"
                      data-area-id="${escapeHtml(item.areaId)}"
                      data-shelf-id="${escapeHtml(item.shelfId || '')}"
                      data-location-id="${escapeHtml(item.locationId || '')}"
                    >
                      ${item.status === 'AVAILABLE' ? '停用' : '启用'}
                    </button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <div class="text-sm font-medium text-foreground">轻量位置维护</div>
          <div class="mt-1 text-xs text-muted-foreground">${targetWarehouse ? `当前维护：${targetWarehouse.warehouseName}` : '请选择工厂后维护库区、货架、库位'}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted ${targetWarehouse ? '' : 'pointer-events-none opacity-50'}"
            data-factory-warehouse-action="create-area"
            data-warehouse-id="${escapeHtml(targetWarehouse?.warehouseId || '')}"
          >
            新增库区
          </button>
        </div>
      </div>
      ${renderTableWrapper(['工厂', '仓库', '库区', '货架', '库位', '层级', '状态', '操作'], body, 'min-w-[1120px]')}
    </div>
  `
}

function renderStocktakeTab(): string {
  const rows = getStocktakeRows()
  const targetWarehouse = getTargetWarehouseForMaintenance()
  const body =
    rows.length === 0
      ? `<tr><td colspan="13" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`
      : rows
          .map((item) => {
            const differenceCount = item.lineList.filter((line) => (line.differenceQty ?? 0) !== 0).length
            const reviews = listFactoryWarehouseStocktakeDifferenceReviewsByOrder(item.stocktakeOrderId)
            const waitReviewCount = reviews.filter((review) => review.reviewStatus !== '已调整').length
            const adjustedCount = reviews.filter((review) => review.reviewStatus === '已调整').length
            return `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.stocktakeOrderNo)}</td>
                <td class="px-3 py-2">${escapeHtml(item.factoryName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.warehouseName)}</td>
                <td class="px-3 py-2">${escapeHtml(item.stocktakeScope)}</td>
                <td class="px-3 py-2">${escapeHtml(item.createdBy)}</td>
                <td class="px-3 py-2">${escapeHtml(formatDateTime(item.startedAt || item.createdAt))}</td>
                <td class="px-3 py-2">${escapeHtml(item.completedAt ? formatDateTime(item.completedAt) : '—')}</td>
                <td class="px-3 py-2">${item.lineList.length}</td>
                <td class="px-3 py-2 ${differenceCount > 0 ? 'text-rose-600' : ''}">${differenceCount}</td>
                <td class="px-3 py-2 ${waitReviewCount > 0 ? 'text-amber-600' : ''}">${waitReviewCount}</td>
                <td class="px-3 py-2 text-emerald-700">${adjustedCount}</td>
                <td class="px-3 py-2">${renderStatusBadge(item.status, getStatusTone(item.status))}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="open-stocktake-detail" data-stocktake-order-id="${escapeHtml(item.stocktakeOrderId)}">查看</button>
                    ${
                      item.status === '盘点中' || item.status === '待确认'
                        ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="complete-stocktake" data-stocktake-order-id="${escapeHtml(item.stocktakeOrderId)}">完成盘点</button>`
                        : ''
                    }
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <div class="text-sm font-medium text-foreground">默认全盘</div>
          <div class="mt-1 text-xs text-muted-foreground">${targetWarehouse ? `当前可创建：${targetWarehouse.warehouseName}` : '请选择工厂后创建全盘'}</div>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted ${targetWarehouse ? '' : 'pointer-events-none opacity-50'}"
          data-factory-warehouse-action="create-stocktake"
          data-warehouse-id="${escapeHtml(targetWarehouse?.warehouseId || '')}"
        >
          创建全盘
        </button>
      </div>
      ${renderTableWrapper(['盘点单号', '工厂', '仓库', '盘点范围', '盘点人', '开始时间', '完成时间', '明细数', '差异数', '待审核差异', '已调整', '状态', '操作'], body, 'min-w-[1200px]')}
    </div>
  `
}

function renderActiveTab(): string {
  const content =
    state.activeTab === 'WAIT_PROCESS'
      ? renderWaitProcessTab()
      : state.activeTab === 'WAIT_HANDOVER'
        ? renderWaitHandoverTab()
        : state.activeTab === 'INBOUND'
          ? renderInboundTab()
          : state.activeTab === 'OUTBOUND'
            ? renderOutboundTab()
            : state.activeTab === 'LOCATION'
              ? renderLocationTab()
              : renderStocktakeTab()

  return `<section class="rounded-lg border bg-card p-4">${content}</section>`
}

function renderWaitProcessDetail(item: FactoryWaitProcessStockItem): string {
  const inboundRecord = findFactoryWarehouseInboundRecordBySourceRecordId(item.sourceRecordId)
  return `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderKeyValueItem('工厂', escapeHtml(item.factoryName))}
        ${renderKeyValueItem('仓库', escapeHtml(item.warehouseName))}
        ${renderKeyValueItem('来源单号', escapeHtml(item.sourceRecordNo))}
        ${renderKeyValueItem('来源动作', escapeHtml(getWaitProcessSourceActionLabel(item)))}
        ${renderKeyValueItem('入库记录', escapeHtml(inboundRecord?.inboundRecordNo || '未入库'), Boolean(inboundRecord))}
        ${renderKeyValueItem('来源状态', escapeHtml(getWaitProcessSourceStatusLabel(item)), item.status !== '待领料')}
        ${renderKeyValueItem('来源类型', escapeHtml(getFactoryWarehouseSourceRecordTypeLabel(item.sourceRecordType)))}
        ${renderKeyValueItem('来源对象', escapeHtml(item.sourceObjectName))}
        ${renderKeyValueItem('所属任务', escapeHtml(item.taskNo || '—'))}
        ${renderKeyValueItem('物料 / 裁片类型', escapeHtml(item.itemKind))}
        ${renderKeyValueItem('面料 SKU / 裁片部位', escapeHtml(item.materialSku || item.partName || item.itemName))}
        ${renderKeyValueItem('颜色 / 尺码', escapeHtml([item.fabricColor, item.sizeCode].filter(Boolean).join(' / ') || '—'))}
        ${renderKeyValueItem('应收数量 / 实收数量', escapeHtml(`${formatQty(item.expectedQty)} / ${formatQty(item.receivedQty)} ${item.unit}`))}
        ${renderKeyValueItem('差异数量', escapeHtml(`${formatQty(item.differenceQty)} ${item.unit}`))}
        ${renderKeyValueItem('位置', escapeHtml(item.locationText))}
      </div>
      ${
        inboundRecord
          ? `<div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-factory-warehouse-action="open-linked-inbound-detail" data-record-id="${escapeHtml(inboundRecord.inboundRecordId)}">查看入库记录</button>
            </div>`
          : ''
      }
      ${
        item.abnormalReason
          ? `<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">差异说明：${escapeHtml(item.abnormalReason)}</div>`
          : ''
      }
    </div>
  `
}

function getLocationOptionsFromDrawer(warehouseId: string, areaName: string, shelfNo: string): {
  areaOptions: Array<{ value: string; label: string }>
  shelfOptions: Array<{ value: string; label: string }>
  locationOptions: Array<{ value: string; label: string }>
} {
  const warehouse = findFactoryInternalWarehouseById(warehouseId)
  if (!warehouse) {
    return { areaOptions: [], shelfOptions: [], locationOptions: [] }
  }
  const area = warehouse.areaList.find((item) => item.areaName === areaName) || warehouse.areaList[0]
  const shelf = area?.shelfList.find((item) => item.shelfNo === shelfNo) || area?.shelfList[0]
  return {
    areaOptions: warehouse.areaList.map((item) => ({ value: item.areaName, label: item.areaName })),
    shelfOptions: (area?.shelfList || []).map((item) => ({ value: item.shelfNo, label: item.shelfNo })),
    locationOptions: (shelf?.locationList || []).map((item) => ({ value: item.locationNo, label: item.locationNo })),
  }
}

function renderLocationSelect(label: string, field: 'location-areaName' | 'location-shelfNo' | 'location-locationNo', value: string, options: Array<{ value: string; label: string }>): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-factory-warehouse-field="${field}">
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `
}

function renderLocationDrawer(title: string, warehouseId: string, areaName: string, shelfNo: string, locationNo: string, saveAction: 'save-wait-process-position' | 'save-wait-handover-position'): string {
  const optionSet = getLocationOptionsFromDrawer(warehouseId, areaName, shelfNo)
  return renderDetailDrawer(
    {
      title,
      subtitle: '只允许调整库区、货架、库位',
      closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
      width: 'sm',
    },
    `
      <div class="space-y-4">
        ${renderLocationSelect('库区', 'location-areaName', areaName, optionSet.areaOptions)}
        ${renderLocationSelect('货架', 'location-shelfNo', shelfNo, optionSet.shelfOptions)}
        ${renderLocationSelect('库位', 'location-locationNo', locationNo, optionSet.locationOptions)}
      </div>
    `,
    `<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-factory-warehouse-action="${saveAction}">保存位置</button>`,
  )
}

function renderWaitHandoverDetail(item: FactoryWaitHandoverStockItem): string {
  const outboundRecord = item.handoverRecordId ? findFactoryWarehouseOutboundRecordByHandoverRecordId(item.handoverRecordId) : undefined
  return `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderKeyValueItem('工厂', escapeHtml(item.factoryName))}
        ${renderKeyValueItem('仓库', escapeHtml(item.warehouseName))}
        ${renderKeyValueItem('来源任务', escapeHtml(item.taskNo || '—'))}
        ${renderKeyValueItem('接收方', escapeHtml(item.receiverName))}
        ${renderKeyValueItem('交出单', escapeHtml(item.handoverOrderNo || '—'))}
        ${renderKeyValueItem('交出记录', escapeHtml(item.handoverRecordNo || '—'))}
        ${renderKeyValueItem('出库记录', escapeHtml(outboundRecord?.outboundRecordNo || '未出库'), Boolean(outboundRecord))}
        ${renderKeyValueItem('交出二维码', escapeHtml(getOutboundQrDisplayText(getLinkedQrValue(item))), Boolean(getLinkedQrValue(item)))}
        ${renderKeyValueItem('回写状态', escapeHtml(getWaitHandoverWritebackStatusLabel(item)), item.status === '已回写' || item.status === '差异' || item.status === '异议中')}
        ${renderKeyValueItem('加工完成数量', escapeHtml(`${formatQty(item.completedQty)} ${item.unit}`))}
        ${renderKeyValueItem('损耗数量', escapeHtml(`${formatQty(item.lossQty)} ${item.unit}`))}
        ${renderKeyValueItem('待交出数量', escapeHtml(`${formatQty(item.waitHandoverQty)} ${item.unit}`))}
        ${renderKeyValueItem('回写数量', escapeHtml(typeof item.receiverWrittenQty === 'number' ? `${formatQty(item.receiverWrittenQty)} ${item.unit}` : '—'))}
        ${renderKeyValueItem('差异 / 异议', escapeHtml(typeof item.differenceQty === 'number' ? `${formatQty(item.differenceQty)} ${item.unit}` : item.objectionStatus || '—'))}
        ${renderKeyValueItem('位置', escapeHtml(`${item.areaName} / ${item.shelfNo} / ${item.locationNo}`))}
      </div>
      ${
        outboundRecord
          ? `<div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-factory-warehouse-action="open-linked-outbound-detail" data-record-id="${escapeHtml(outboundRecord.outboundRecordId)}">查看出库记录</button>
            </div>`
          : ''
      }
      ${
        item.abnormalReason
          ? `<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">差异说明：${escapeHtml(item.abnormalReason)}</div>`
          : ''
      }
    </div>
  `
}

function renderInboundDetail(record: FactoryWarehouseInboundRecord): string {
  return `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderKeyValueItem('入库单号', escapeHtml(record.inboundRecordNo))}
        ${renderKeyValueItem('入库仓', escapeHtml(record.warehouseName))}
        ${renderKeyValueItem('来源动作', escapeHtml(record.sourceRecordType === 'HANDOVER_RECEIVE' ? '交出接收' : '领料确认'))}
        ${renderKeyValueItem('生成方式', '自动转单', true)}
        ${renderKeyValueItem('来源', escapeHtml(getFactoryWarehouseInboundSourceLabel(record.sourceRecordType)))}
        ${renderKeyValueItem('来源单号', escapeHtml(record.sourceRecordNo))}
        ${renderKeyValueItem('来源对象', escapeHtml(record.sourceObjectName))}
        ${renderKeyValueItem('所属任务', escapeHtml(record.taskNo || '—'))}
        ${renderKeyValueItem('面料 SKU / 裁片部位', escapeHtml(record.materialSku || record.partName || record.itemName))}
        ${renderKeyValueItem('应收数量 / 实收数量', escapeHtml(`${formatQty(record.expectedQty)} / ${formatQty(record.receivedQty)} ${record.unit}`))}
        ${renderKeyValueItem('差异数量', escapeHtml(`${formatQty(record.differenceQty)} ${record.unit}`))}
        ${renderKeyValueItem('接收人', escapeHtml(record.receiverName))}
        ${renderKeyValueItem('接收时间', escapeHtml(formatDateTime(record.receivedAt)))}
        ${renderKeyValueItem('位置', escapeHtml(`${record.areaName} / ${record.shelfNo} / ${record.locationNo}`))}
      </div>
      ${
        record.abnormalReason
          ? `<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">差异说明：${escapeHtml(record.abnormalReason)}</div>`
          : ''
      }
    </div>
  `
}

function renderOutboundDetail(record: FactoryWarehouseOutboundRecord): string {
  return `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${renderKeyValueItem('出库单号', escapeHtml(record.outboundRecordNo))}
        ${renderKeyValueItem('出库仓', escapeHtml(record.warehouseName))}
        ${renderKeyValueItem('来源动作', '交出记录')}
        ${renderKeyValueItem('生成方式', '自动转单', true)}
        ${renderKeyValueItem('来源', escapeHtml(getFactoryWarehouseOutboundSourceLabel()))}
        ${renderKeyValueItem('来源任务', escapeHtml(record.sourceTaskNo || '—'))}
        ${renderKeyValueItem('交出单 / 交出记录', escapeHtml(`${record.handoverOrderNo || '—'} / ${record.handoverRecordNo || '—'}`))}
        ${renderKeyValueItem('交出二维码', escapeHtml(getOutboundQrDisplayText(getLinkedQrValue(record))), Boolean(getLinkedQrValue(record)))}
        ${renderKeyValueItem('接收方', escapeHtml(record.receiverName))}
        ${renderKeyValueItem('面料 SKU / 裁片部位', escapeHtml(record.materialSku || record.partName || record.itemName))}
        ${renderKeyValueItem('出库数量 / 回写数量', escapeHtml(`${formatQty(record.outboundQty)} / ${typeof record.receiverWrittenQty === 'number' ? formatQty(record.receiverWrittenQty) : '—'} ${record.unit}`))}
        ${renderKeyValueItem('差异数量', escapeHtml(typeof record.differenceQty === 'number' ? `${formatQty(record.differenceQty)} ${record.unit}` : '—'))}
        ${renderKeyValueItem('操作人', escapeHtml(record.operatorName))}
        ${renderKeyValueItem('出库时间', escapeHtml(formatDateTime(record.outboundAt)))}
      </div>
      ${
        record.abnormalReason
          ? `<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">差异说明：${escapeHtml(record.abnormalReason)}</div>`
          : ''
      }
    </div>
  `
}

function renderNodeRemarkDrawer(drawerState: Extract<FactoryWarehouseDrawer, { type: 'NODE_REMARK' }>): string {
  return renderDetailDrawer(
    {
      title: drawerState.title,
      subtitle: '编辑备注',
      closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
      width: 'sm',
    },
    `
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">备注</span>
        <textarea class="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" data-factory-warehouse-field="node-remark">${escapeHtml(drawerState.remark)}</textarea>
      </label>
    `,
    `<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-factory-warehouse-action="save-node-remark">保存备注</button>`,
  )
}

function renderStocktakeDetail(order: FactoryWarehouseStocktakeOrder): string {
  const lines = order.lineList
  const reviews = listFactoryWarehouseStocktakeDifferenceReviewsByOrder(order.stocktakeOrderId)
  const adjustments = listFactoryWarehouseAdjustmentOrdersByStocktake(order.stocktakeOrderId)
  return renderDetailDrawer(
    {
      title: '盘点详情',
      subtitle: `${order.warehouseName} · ${order.stocktakeOrderNo}`,
      closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
      width: 'xl',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          ${renderKeyValueItem('工厂', escapeHtml(order.factoryName))}
          ${renderKeyValueItem('仓库', escapeHtml(order.warehouseName))}
          ${renderKeyValueItem('盘点范围', escapeHtml(order.stocktakeScope))}
          ${renderKeyValueItem('盘点人', escapeHtml(order.createdBy))}
          ${renderKeyValueItem('状态', escapeHtml(order.status))}
          ${renderKeyValueItem('待审核差异', escapeHtml(String(reviews.filter((review) => review.reviewStatus !== '已调整').length)))}
          ${renderKeyValueItem('已调整差异', escapeHtml(String(reviews.filter((review) => review.reviewStatus === '已调整').length)))}
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1780px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-3 py-2 font-medium">物料 / 裁片类型</th>
                <th class="px-3 py-2 font-medium">面料 SKU / 裁片部位</th>
                <th class="px-3 py-2 font-medium">颜色</th>
                <th class="px-3 py-2 font-medium">尺码</th>
                <th class="px-3 py-2 font-medium">菲票号</th>
                <th class="px-3 py-2 font-medium">中转袋号</th>
                <th class="px-3 py-2 font-medium">卷号</th>
                <th class="px-3 py-2 font-medium">账面数量</th>
                <th class="px-3 py-2 font-medium">实盘数量</th>
                <th class="px-3 py-2 font-medium">差异数量</th>
                <th class="px-3 py-2 font-medium">库区</th>
                <th class="px-3 py-2 font-medium">货架</th>
                <th class="px-3 py-2 font-medium">库位</th>
                <th class="px-3 py-2 font-medium">差异原因</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">审核状态</th>
                <th class="px-3 py-2 font-medium">调整单</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${lines
                .map(
                  (line) => {
                    const review = reviews.find((item) => item.lineId === line.lineId)
                    const adjustment = adjustments.find((item) => item.sourceLineId === line.lineId)
                    const canReview = Boolean(review && review.reviewStatus === '待审核')
                    const canExecuteAdjustment = Boolean(adjustment && adjustment.status === '待执行')
                    return `
                    <tr class="border-b last:border-b-0">
                      <td class="px-3 py-2">${escapeHtml(line.itemKind)}</td>
                      <td class="px-3 py-2">${escapeHtml(line.materialSku || line.partName || line.itemName)}</td>
                      <td class="px-3 py-2">${escapeHtml(line.fabricColor || '—')}</td>
                      <td class="px-3 py-2">${escapeHtml(line.sizeCode || '—')}</td>
                      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.feiTicketNo || '—')}</td>
                      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.transferBagNo || '—')}</td>
                      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.fabricRollNo || '—')}</td>
                      <td class="px-3 py-2">${formatQty(line.bookQty)}</td>
                      <td class="px-3 py-2">
                        ${
                          order.status === '已完成'
                            ? escapeHtml(typeof line.countedQty === 'number' ? formatQty(line.countedQty) : '—')
                            : `<input type="number" min="0" class="h-9 w-24 rounded-md border bg-background px-2 text-sm" value="${line.countedQty ?? ''}" data-factory-warehouse-field="stocktake-countedQty" data-stocktake-order-id="${escapeHtml(order.stocktakeOrderId)}" data-line-id="${escapeHtml(line.lineId)}" />`
                        }
                      </td>
                      <td class="px-3 py-2 ${line.differenceQty ? 'text-rose-600' : ''}">${typeof line.differenceQty === 'number' ? formatQty(line.differenceQty) : '—'}</td>
                      <td class="px-3 py-2">${escapeHtml(line.areaName)}</td>
                      <td class="px-3 py-2">${escapeHtml(line.shelfNo)}</td>
                      <td class="px-3 py-2">${escapeHtml(line.locationNo)}</td>
                      <td class="px-3 py-2">
                        ${
                          order.status === '已完成'
                            ? escapeHtml(line.differenceReason || '—')
                            : `<input type="text" class="h-9 w-40 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(line.differenceReason || '')}" placeholder="差异原因" data-factory-warehouse-field="stocktake-differenceReason" data-stocktake-order-id="${escapeHtml(order.stocktakeOrderId)}" data-line-id="${escapeHtml(line.lineId)}" />`
                        }
                      </td>
                      <td class="px-3 py-2">${renderStatusBadge(line.status, getStatusTone(line.status))}</td>
                      <td class="px-3 py-2">${line.reviewStatus ? renderStatusBadge(line.reviewStatus, line.reviewStatus === '已调整' ? 'green' : line.reviewStatus === '已驳回' ? 'red' : 'amber') : '—'}</td>
                      <td class="px-3 py-2">${adjustment ? `${escapeHtml(adjustment.adjustmentOrderNo)} · ${escapeHtml(adjustment.status)}` : '—'}</td>
                      <td class="px-3 py-2">
                        <div class="flex flex-wrap gap-2">
                          ${
                            canReview
                              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted" data-factory-warehouse-action="approve-stocktake-review" data-review-id="${escapeHtml(review?.reviewId || '')}">审核通过</button>
                                <button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-rose-600 hover:bg-rose-50" data-factory-warehouse-action="reject-stocktake-review" data-review-id="${escapeHtml(review?.reviewId || '')}">审核驳回</button>`
                              : ''
                          }
                          ${
                            canExecuteAdjustment
                              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2 text-xs text-emerald-700 hover:bg-emerald-50" data-factory-warehouse-action="execute-adjustment-order" data-adjustment-order-id="${escapeHtml(adjustment?.adjustmentOrderId || '')}">执行调整</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `
                  },
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `,
    order.status === '盘点中' || order.status === '待确认'
      ? `<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-factory-warehouse-action="complete-stocktake" data-stocktake-order-id="${escapeHtml(order.stocktakeOrderId)}">完成盘点</button>`
      : undefined,
  )
}

function renderDrawer(): string {
  if (state.drawer.type === 'NONE') return ''

  if (state.drawer.type === 'WAIT_PROCESS_DETAIL') {
    const item = getWaitProcessItemById(state.drawer.stockItemId)
    if (!item) return ''
    return renderDetailDrawer(
      {
        title: '待加工仓明细',
        subtitle: `${item.factoryName} · ${item.warehouseName}`,
        closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
        width: 'lg',
      },
      renderWaitProcessDetail(item),
    )
  }

  if (state.drawer.type === 'WAIT_PROCESS_POSITION') {
    return renderLocationDrawer('调整位置', state.drawer.warehouseId, state.drawer.areaName, state.drawer.shelfNo, state.drawer.locationNo, 'save-wait-process-position')
  }

  if (state.drawer.type === 'WAIT_HANDOVER_DETAIL') {
    const item = getWaitHandoverItemById(state.drawer.stockItemId)
    if (!item) return ''
    return renderDetailDrawer(
      {
        title: '待交出仓明细',
        subtitle: `${item.factoryName} · ${item.warehouseName}`,
        closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
        width: 'lg',
      },
      renderWaitHandoverDetail(item),
    )
  }

  if (state.drawer.type === 'WAIT_HANDOVER_POSITION') {
    return renderLocationDrawer('调整位置', state.drawer.warehouseId, state.drawer.areaName, state.drawer.shelfNo, state.drawer.locationNo, 'save-wait-handover-position')
  }

  if (state.drawer.type === 'INBOUND_DETAIL') {
    const record = getInboundRecordById(state.drawer.inboundRecordId)
    if (!record) return ''
    return renderDetailDrawer(
      {
        title: '入库记录详情',
        subtitle: record.inboundRecordNo,
        closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
        width: 'lg',
      },
      renderInboundDetail(record),
    )
  }

  if (state.drawer.type === 'OUTBOUND_DETAIL') {
    const record = getOutboundRecordById(state.drawer.outboundRecordId)
    if (!record) return ''
    return renderDetailDrawer(
      {
        title: '出库记录详情',
        subtitle: record.outboundRecordNo,
        closeAction: { prefix: 'factory-warehouse', action: 'close-detail' },
        width: 'lg',
      },
      renderOutboundDetail(record),
    )
  }

  if (state.drawer.type === 'NODE_REMARK') {
    return renderNodeRemarkDrawer(state.drawer)
  }

  if (state.drawer.type === 'STOCKTAKE_DETAIL') {
    const order = getStocktakeOrderById(state.drawer.stocktakeOrderId)
    if (!order) return ''
    return renderStocktakeDetail(order)
  }

  return ''
}

export function renderFactoryInternalWarehousePage(): string {
  return `
    <div class="space-y-4" data-factory-warehouse-page-root="true">
      ${renderHeader()}
      ${renderFilterArea()}
      ${renderSummaryCards()}
      <section class="space-y-4">
        ${renderTabs()}
        ${renderActiveTab()}
      </section>
      ${renderDrawer()}
    </div>
  `
}

function resetFilters(): void {
  state.filters = { ...DEFAULT_FILTERS }
}

function updateDrawerLocationField(field: 'location-areaName' | 'location-shelfNo' | 'location-locationNo', value: string): void {
  if (state.drawer.type !== 'WAIT_PROCESS_POSITION' && state.drawer.type !== 'WAIT_HANDOVER_POSITION') return

  if (field === 'location-areaName') {
    const options = getLocationOptionsFromDrawer(state.drawer.warehouseId, value, '')
    state.drawer.areaName = value
    state.drawer.shelfNo = options.shelfOptions[0]?.value || ''
    state.drawer.locationNo = options.locationOptions[0]?.value || ''
    return
  }

  if (field === 'location-shelfNo') {
    const options = getLocationOptionsFromDrawer(state.drawer.warehouseId, state.drawer.areaName, value)
    state.drawer.shelfNo = value
    state.drawer.locationNo = options.locationOptions[0]?.value || ''
    return
  }

  state.drawer.locationNo = value
}

function openNodeRemarkDrawer(target: HTMLElement): void {
  const rowType = target.dataset.rowType as FactoryWarehouseNodeRow['rowType'] | undefined
  const warehouseId = target.dataset.warehouseId
  const areaId = target.dataset.areaId
  if (!rowType || !warehouseId || !areaId) return
  const title = rowType === 'AREA' ? '编辑库区备注' : rowType === 'SHELF' ? '编辑货架备注' : '编辑库位备注'
  state.drawer = {
    type: 'NODE_REMARK',
    rowType,
    warehouseId,
    areaId,
    shelfId: target.dataset.shelfId || undefined,
    locationId: target.dataset.locationId || undefined,
    title,
    remark: target.dataset.remark || '',
  }
}

function toggleNodeStatus(target: HTMLElement): void {
  const rowType = target.dataset.rowType as FactoryWarehouseNodeRow['rowType'] | undefined
  const warehouseId = target.dataset.warehouseId
  const areaId = target.dataset.areaId
  if (!rowType || !warehouseId || !areaId) return
  const success = toggleFactoryWarehouseNodeStatus(rowType, {
    warehouseId,
    areaId,
    shelfId: target.dataset.shelfId || undefined,
    locationId: target.dataset.locationId || undefined,
  })
  state.notice = success ? '位置状态已更新' : '位置状态更新失败'
}

function handleFieldUpdate(field: string, node: HTMLElement): boolean {
  if (field === 'factoryId' && node instanceof HTMLSelectElement) {
    state.filters.factoryId = node.value
    state.notice = ''
    return true
  }
  if (field === 'processCode' && node instanceof HTMLSelectElement) {
    state.filters.processCode = node.value
    return true
  }
  if (field === 'warehouseKind' && node instanceof HTMLSelectElement) {
    state.filters.warehouseKind = node.value as '' | FactoryInternalWarehouseKind
    return true
  }
  if (field === 'status' && node instanceof HTMLSelectElement) {
    state.filters.status = node.value
    return true
  }
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.filters.keyword = node.value
    return true
  }
  if (field === 'timeRange' && node instanceof HTMLSelectElement) {
    state.filters.timeRange = node.value as FactoryWarehouseFilters['timeRange']
    return true
  }
  if (field === 'location-areaName' && node instanceof HTMLSelectElement) {
    updateDrawerLocationField('location-areaName', node.value)
    return true
  }
  if (field === 'location-shelfNo' && node instanceof HTMLSelectElement) {
    updateDrawerLocationField('location-shelfNo', node.value)
    return true
  }
  if (field === 'location-locationNo' && node instanceof HTMLSelectElement) {
    updateDrawerLocationField('location-locationNo', node.value)
    return true
  }
  if (field === 'node-remark' && node instanceof HTMLTextAreaElement && state.drawer.type === 'NODE_REMARK') {
    state.drawer.remark = node.value
    return true
  }
  if (field === 'stocktake-countedQty' && node instanceof HTMLInputElement) {
    const stocktakeOrderId = node.dataset.stocktakeOrderId
    const lineId = node.dataset.lineId
    if (!stocktakeOrderId || !lineId) return false
    updateFactoryWarehouseStocktakeLine(stocktakeOrderId, lineId, {
      countedQty: node.value === '' ? undefined : Number(node.value),
    })
    return true
  }
  if (field === 'stocktake-differenceReason' && node instanceof HTMLInputElement) {
    const stocktakeOrderId = node.dataset.stocktakeOrderId
    const lineId = node.dataset.lineId
    if (!stocktakeOrderId || !lineId) return false
    updateFactoryWarehouseStocktakeLine(stocktakeOrderId, lineId, {
      differenceReason: node.value,
    })
    return true
  }
  return false
}

export function handleFactoryInternalWarehouseEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-factory-warehouse-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.factoryWarehouseField || ''
    if (field && handleFieldUpdate(field, fieldNode)) {
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-factory-warehouse-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.factoryWarehouseAction
  if (!action) return false

  if (action === 'reset-filters') {
    resetFilters()
    state.notice = ''
    return true
  }

  if (action === 'switch-tab') {
    state.activeTab = (actionNode.dataset.tab as FactoryWarehouseTab) || 'WAIT_PROCESS'
    state.notice = ''
    return true
  }

  if (action === 'close-detail') {
    state.drawer = { type: 'NONE' }
    return true
  }

  if (action === 'open-wait-process-detail') {
    const stockItemId = actionNode.dataset.stockItemId
    if (!stockItemId) return true
    state.drawer = { type: 'WAIT_PROCESS_DETAIL', stockItemId }
    return true
  }

  if (action === 'open-wait-process-position') {
    const stockItemId = actionNode.dataset.stockItemId
    if (!stockItemId) return true
    const item = getWaitProcessItemById(stockItemId)
    if (!item) return true
    state.drawer = {
      type: 'WAIT_PROCESS_POSITION',
      stockItemId,
      warehouseId: item.warehouseId,
      areaName: item.areaName,
      shelfNo: item.shelfNo,
      locationNo: item.locationNo,
    }
    return true
  }

  if (action === 'save-wait-process-position' && state.drawer.type === 'WAIT_PROCESS_POSITION') {
    const success = updateWaitProcessStockLocation(state.drawer.stockItemId, {
      areaName: state.drawer.areaName,
      shelfNo: state.drawer.shelfNo,
      locationNo: state.drawer.locationNo,
    })
    state.notice = success ? '待加工仓位置已更新' : '待加工仓位置更新失败'
    if (success) state.drawer = { type: 'NONE' }
    return true
  }

  if (action === 'open-wait-handover-detail') {
    const stockItemId = actionNode.dataset.stockItemId
    if (!stockItemId) return true
    state.drawer = { type: 'WAIT_HANDOVER_DETAIL', stockItemId }
    return true
  }

  if (action === 'open-wait-handover-position') {
    const stockItemId = actionNode.dataset.stockItemId
    if (!stockItemId) return true
    const item = getWaitHandoverItemById(stockItemId)
    if (!item) return true
    state.drawer = {
      type: 'WAIT_HANDOVER_POSITION',
      stockItemId,
      warehouseId: item.warehouseId,
      areaName: item.areaName,
      shelfNo: item.shelfNo,
      locationNo: item.locationNo,
    }
    return true
  }

  if (action === 'save-wait-handover-position' && state.drawer.type === 'WAIT_HANDOVER_POSITION') {
    const success = updateWaitHandoverStockLocation(state.drawer.stockItemId, {
      areaName: state.drawer.areaName,
      shelfNo: state.drawer.shelfNo,
      locationNo: state.drawer.locationNo,
    })
    state.notice = success ? '待交出仓位置已更新' : '待交出仓位置更新失败'
    if (success) state.drawer = { type: 'NONE' }
    return true
  }

  if (action === 'open-inbound-detail') {
    const inboundRecordId = actionNode.dataset.inboundRecordId
    if (!inboundRecordId) return true
    state.drawer = { type: 'INBOUND_DETAIL', inboundRecordId }
    return true
  }

  if (action === 'open-linked-inbound-detail') {
    const inboundRecordId = actionNode.dataset.recordId
    if (!inboundRecordId) return true
    state.activeTab = 'INBOUND'
    state.drawer = { type: 'INBOUND_DETAIL', inboundRecordId }
    return true
  }

  if (action === 'open-outbound-detail') {
    const outboundRecordId = actionNode.dataset.outboundRecordId
    if (!outboundRecordId) return true
    state.drawer = { type: 'OUTBOUND_DETAIL', outboundRecordId }
    return true
  }

  if (action === 'open-linked-outbound-detail') {
    const outboundRecordId = actionNode.dataset.recordId
    if (!outboundRecordId) return true
    state.activeTab = 'OUTBOUND'
    state.drawer = { type: 'OUTBOUND_DETAIL', outboundRecordId }
    return true
  }

  if (action === 'create-area') {
    const warehouseId = actionNode.dataset.warehouseId
    if (!warehouseId) {
      state.notice = '请先选择工厂后再新增库区'
      return true
    }
    const area = createFactoryWarehouseArea(warehouseId)
    state.notice = area ? `已新增库区：${area.areaName}` : '新增库区失败'
    return true
  }

  if (action === 'create-shelf') {
    const warehouseId = actionNode.dataset.warehouseId
    const areaId = actionNode.dataset.areaId
    if (!warehouseId) return true
    const shelf = createFactoryWarehouseShelf(warehouseId, areaId)
    state.notice = shelf ? `已新增货架：${shelf.shelfNo}` : '新增货架失败'
    return true
  }

  if (action === 'create-location') {
    const warehouseId = actionNode.dataset.warehouseId
    const areaId = actionNode.dataset.areaId
    const shelfId = actionNode.dataset.shelfId
    if (!warehouseId) return true
    const location = createFactoryWarehouseLocation(warehouseId, areaId, shelfId)
    state.notice = location ? `已新增库位：${location.locationNo}` : '新增库位失败'
    return true
  }

  if (action === 'open-node-remark') {
    openNodeRemarkDrawer(actionNode)
    return true
  }

  if (action === 'save-node-remark' && state.drawer.type === 'NODE_REMARK') {
    const success = updateFactoryWarehouseNodeRemark(
      state.drawer.rowType,
      {
        warehouseId: state.drawer.warehouseId,
        areaId: state.drawer.areaId,
        shelfId: state.drawer.shelfId,
        locationId: state.drawer.locationId,
      },
      state.drawer.remark,
    )
    state.notice = success ? '位置备注已更新' : '位置备注更新失败'
    if (success) state.drawer = { type: 'NONE' }
    return true
  }

  if (action === 'toggle-node-status') {
    toggleNodeStatus(actionNode)
    return true
  }

  if (action === 'create-stocktake') {
    const warehouseId = actionNode.dataset.warehouseId
    const warehouse = warehouseId ? findFactoryInternalWarehouseById(warehouseId) : undefined
    if (!warehouseId || !warehouse) {
      state.notice = '请先选择工厂后再创建全盘'
      return true
    }
    const order = createFactoryWarehouseStocktakeOrder(warehouse.factoryId, warehouseId)
    state.notice = order ? `已创建全盘：${order.stocktakeOrderNo}` : '创建全盘失败'
    if (order) {
      state.activeTab = 'STOCKTAKE'
      state.drawer = { type: 'STOCKTAKE_DETAIL', stocktakeOrderId: order.stocktakeOrderId }
    }
    return true
  }

  if (action === 'open-stocktake-detail') {
    const stocktakeOrderId = actionNode.dataset.stocktakeOrderId
    if (!stocktakeOrderId) return true
    state.drawer = { type: 'STOCKTAKE_DETAIL', stocktakeOrderId }
    return true
  }

  if (action === 'complete-stocktake') {
    const stocktakeOrderId = actionNode.dataset.stocktakeOrderId
    if (!stocktakeOrderId) return true
    const success = completeFactoryWarehouseStocktakeOrder(stocktakeOrderId)
    const order = success ? getStocktakeOrderById(stocktakeOrderId) : null
    state.notice = success ? (order?.status === '待确认' ? '盘点差异已提交审核' : '盘点已完成') : '盘点完成失败'
    return true
  }

  if (action === 'approve-stocktake-review') {
    const reviewId = actionNode.dataset.reviewId
    if (!reviewId) return true
    const adjustment = approveFactoryWarehouseStocktakeDifferenceReview({
      reviewId,
      reviewedBy: '仓库主管',
      reviewRemark: '差异审核通过，生成调整单',
    })
    state.notice = adjustment ? `已生成调整单：${adjustment.adjustmentOrderNo}` : '审核失败'
    return true
  }

  if (action === 'reject-stocktake-review') {
    const reviewId = actionNode.dataset.reviewId
    if (!reviewId) return true
    const review = rejectFactoryWarehouseStocktakeDifferenceReview({
      reviewId,
      reviewedBy: '仓库主管',
      reviewRemark: '差异驳回，需重新核对',
    })
    state.notice = review ? '已驳回盘点差异' : '驳回失败'
    return true
  }

  if (action === 'execute-adjustment-order') {
    const adjustmentOrderId = actionNode.dataset.adjustmentOrderId
    if (!adjustmentOrderId) return true
    const adjustment = executeFactoryWarehouseAdjustmentOrder({
      adjustmentOrderId,
      executedBy: '仓库主管',
      remark: '按审核结果调整轻量库存数量',
    })
    state.notice = adjustment ? '调整单已完成' : '调整失败'
    return true
  }

  return false
}

export function isFactoryInternalWarehouseDialogOpen(): boolean {
  return state.drawer.type !== 'NONE'
}
