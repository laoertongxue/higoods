// @page-pattern: list

import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { listFactoryInternalWarehouses } from '../../../data/fcs/factory-internal-warehouse-locations.ts'
import {
  adjustWoolWarehouseStock,
  issueWoolYarn,
  listWoolYarnReceiptLineTracesFromStore,
  listWoolWarehouseStocksFromStore,
  normalizeWoolBatchNo,
  readWoolStore,
  returnWoolYarn,
  transferWoolWarehouseStock,
  WOOL_DEFAULT_WAREHOUSE_BY_LOCATION,
  WOOL_WAIT_HANDOVER_WAREHOUSE_ID,
  WOOL_WAIT_PROCESS_WAREHOUSE_ID,
  type WoolDefaultLocationId,
  type WoolWarehouseFlow,
  type WoolWarehouseStockRow,
  type WoolDomainStore,
} from '../../../data/fcs/wool-task-domain.ts'
import { buildWoolWorkOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

type WarehouseMode = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
type WarehouseTab =
  | 'inventory'
  | 'receipts'
  | 'issues'
  | 'returns'
  | 'inbounds'
  | 'outbounds'
  | 'adjustments'
  | 'transfers'

interface WarehouseFilters {
  woolOrderNo: string
  productionOrderNo: string
  objectSkuCode: string
  batchNo: string
  objectType: '' | 'YARN' | 'CUT_PIECE' | 'GARMENT'
  completion: '' | 'ACTIVE' | 'COMPLETED'
}

interface WarehouseListRow {
  rowId: string
  woolOrderId: string
  woolOrderNo: string
  productionOrderNo: string
  objectSkuCode: string
  objectName: string
  objectType: 'YARN' | 'CUT_PIECE' | 'GARMENT'
  batchNo?: string
  locationId: WoolDefaultLocationId
  quantity: number
  unit: WoolWarehouseFlow['unit']
  businessLabel: string
  recordNo: string
  operatedAt: string
  operatedBy: string
  reason: string
  completed: boolean
  stock?: WoolWarehouseStockRow
  flow?: WoolWarehouseFlow
}

type WarehouseOverlay =
  | {
      kind: 'detail'
      rowId: string
      receiptPage: number
      flowPage: number
      changePages: Record<string, number>
    }
  | {
      kind: 'issue' | 'return' | 'adjust' | 'transfer-out' | 'transfer-back'
      rowId: string
      draft?: Record<string, string>
    }

interface WarehousePageState {
  activeTab: WarehouseTab
  filters: WarehouseFilters
  currentPage: number
  sort: StandardListSortState | null
  preferences: Record<string, StandardListColumnPreferences>
  showColumnSettings: boolean
  overlay: WarehouseOverlay | null
  overlayError: string
  feedback: string
}

const EVENT_PREFIX = 'wool-warehouse'
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const DEFAULT_FILTERS: WarehouseFilters = {
  woolOrderNo: '',
  productionOrderNo: '',
  objectSkuCode: '',
  batchNo: '',
  objectType: '',
  completion: '',
}
const LOCATION_LABELS: Record<WoolDefaultLocationId, string> = {
  'WOOL-WP-YARN-DEFAULT': '毛织待加工仓 / 纱线默认库位',
  'WOOL-WH-CUT-DEFAULT': '毛织待交出仓 / 裁片默认库位',
  'WOOL-WH-GARMENT-DEFAULT': '毛织待交出仓 / 成衣默认库位',
}
const WAREHOUSE_LABELS = {
  [WOOL_WAIT_PROCESS_WAREHOUSE_ID]: '毛织待加工仓',
  [WOOL_WAIT_HANDOVER_WAREHOUSE_ID]: '毛织待交出仓',
} as const
const TYPE_LABELS = {
  YARN: '纱线',
  CUT_PIECE: '裁片',
  GARMENT: '成衣',
} as const
const BUSINESS_LABELS: Record<WoolWarehouseFlow['businessType'], string> = {
  YARN_RECEIPT: '确认接收入库',
  YARN_ISSUE: '纱线领用',
  YARN_RETURN: '纱线退回',
  PROCESS_REPORT: '加工填报入库',
  HANDOVER: '发起交出出库',
  STOCK_ADJUSTMENT: '库存调整',
  STOCK_TRANSFER: '库存转移',
}
const states: Record<WarehouseMode, WarehousePageState> = {
  WAIT_PROCESS: {
    activeTab: 'inventory',
    filters: { ...DEFAULT_FILTERS },
    currentPage: 1,
    sort: null,
    preferences: {},
    showColumnSettings: false,
    overlay: null,
    overlayError: '',
    feedback: '',
  },
  WAIT_HANDOVER: {
    activeTab: 'inventory',
    filters: { ...DEFAULT_FILTERS },
    currentPage: 1,
    sort: null,
    preferences: {},
    showColumnSettings: false,
    overlay: null,
    overlayError: '',
    feedback: '',
  },
}

let filterDebounce: ReturnType<typeof setTimeout> | undefined
let commandSequence = 0
let draggedColumnKey = ''
let warehouseRuntime: {
  mode: WarehouseMode
  store: WoolDomainStore
  completedOrderIds: Set<string>
} | undefined

function withWarehouseRuntime<T>(mode: WarehouseMode, callback: () => T): T {
  if (warehouseRuntime) return callback()
  const store = readWoolStore()
  warehouseRuntime = {
    mode,
    store,
    completedOrderIds: new Set(store.completions.map((item) => item.woolOrderId)),
  }
  try {
    return callback()
  } finally {
    warehouseRuntime = undefined
  }
}

function runtimeStore(): WoolDomainStore {
  return warehouseRuntime?.store ?? readWoolStore()
}

function isOrderCompleted(woolOrderId: string): boolean {
  return warehouseRuntime?.completedOrderIds.has(woolOrderId)
    ?? runtimeStore().completions.some((item) => item.woolOrderId === woolOrderId)
}

function currentMode(): WarehouseMode {
  return appStore.getState().pathname.includes('wait-handover') ? 'WAIT_HANDOVER' : 'WAIT_PROCESS'
}

function tabsForMode(mode: WarehouseMode): Array<{ key: WarehouseTab; label: string }> {
  return mode === 'WAIT_PROCESS'
    ? [
        { key: 'inventory', label: '库存' },
        { key: 'receipts', label: '确认接收入库' },
        { key: 'issues', label: '纱线领用' },
        { key: 'returns', label: '纱线退回' },
        { key: 'adjustments', label: '调整' },
        { key: 'transfers', label: '转移' },
      ]
    : [
        { key: 'inventory', label: '库存' },
        { key: 'inbounds', label: '入库' },
        { key: 'outbounds', label: '出库' },
        { key: 'adjustments', label: '调整' },
        { key: 'transfers', label: '转移' },
      ]
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function nextCommandId(action: string, woolOrderId: string): string {
  commandSequence += 1
  return `WEB-WOOL-WAREHOUSE-${action}-${woolOrderId}-${Date.now()}-${commandSequence}`
}

function matches(value: string | undefined, keyword: string): boolean {
  return !keyword.trim()
    || String(value ?? '').toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase())
}

function stockToRow(stock: WoolWarehouseStockRow): WarehouseListRow {
  return {
    rowId: `stock:${stock.stockKey}`,
    woolOrderId: stock.woolOrderId,
    woolOrderNo: stock.woolOrderNo,
    productionOrderNo: stock.productionOrderNo,
    objectSkuCode: stock.objectSkuCode,
    objectName: stock.objectName,
    objectType: stock.objectType,
    batchNo: stock.batchNo,
    locationId: stock.defaultLocationId,
    quantity: stock.currentQty,
    unit: stock.unit,
    businessLabel: '当前有效库存',
    recordNo: stock.stockKey,
    operatedAt: '',
    operatedBy: '',
    reason: stock.completed && stock.currentQty > 0 ? '已完成加工单剩余库存' : '',
    completed: stock.completed,
    stock,
  }
}

function flowToRow(flow: WoolWarehouseFlow): WarehouseListRow | undefined {
  const order = runtimeStore().workOrders[flow.woolOrderId]
  if (!order) return undefined
  const outputLine = order.outputPlanLines.find((line) => line.outputSkuCode === flow.objectSkuCode)
  const objectType = flow.defaultLocationType === 'YARN'
    ? 'YARN'
    : flow.defaultLocationType === 'CUT_PIECE'
      ? 'CUT_PIECE'
      : 'GARMENT'
  return {
    rowId: `flow:${flow.flowId}`,
    woolOrderId: flow.woolOrderId,
    woolOrderNo: order.woolOrderNo,
    productionOrderNo: order.productionOrderNo,
    objectSkuCode: flow.objectSkuCode,
    objectName: objectType === 'YARN'
      ? flow.objectSkuCode
      : [outputLine?.colorName, outputLine?.sizeCode, outputLine?.woolPartName]
        .filter(Boolean).join(' / ') || flow.objectSkuCode,
    objectType,
    batchNo: flow.batchNo,
    locationId: flow.defaultLocationId,
    quantity: flow.qty,
    unit: flow.unit,
    businessLabel: BUSINESS_LABELS[flow.businessType],
    recordNo: flow.sourceRecordId,
    operatedAt: flow.operatedAt,
    operatedBy: flow.operatedBy,
    reason: flow.reason ?? '',
    completed: isOrderCompleted(flow.woolOrderId),
    flow,
  }
}

function rowsForTab(mode: WarehouseMode, tab: WarehouseTab): WarehouseListRow[] {
  if (tab === 'inventory') {
    return listWoolWarehouseStocksFromStore(runtimeStore(), mode)
      .filter((stock) => stock.currentQty !== 0)
      .map(stockToRow)
  }
  return runtimeStore().warehouseFlows
    .filter((flow) => flow.warehouseMode === mode)
    .filter((flow) => {
      if (tab === 'receipts') return flow.businessType === 'YARN_RECEIPT'
      if (tab === 'issues') return flow.businessType === 'YARN_ISSUE'
      if (tab === 'returns') return flow.businessType === 'YARN_RETURN'
      if (tab === 'inbounds') return flow.businessType === 'PROCESS_REPORT'
      if (tab === 'outbounds') return flow.businessType === 'HANDOVER'
      if (tab === 'adjustments') return flow.flowType === 'ADJUSTMENT'
      return flow.flowType === 'TRANSFER'
    })
    .map(flowToRow)
    .filter((row): row is WarehouseListRow => Boolean(row))
}

function filteredRows(mode: WarehouseMode, tab: WarehouseTab): WarehouseListRow[] {
  const filters = states[mode].filters
  return rowsForTab(mode, tab)
    .filter((row) => matches(row.woolOrderNo, filters.woolOrderNo))
    .filter((row) => matches(row.productionOrderNo, filters.productionOrderNo))
    .filter((row) => matches(row.objectSkuCode, filters.objectSkuCode))
    .filter((row) => matches(row.batchNo, filters.batchNo))
    .filter((row) => !filters.objectType || row.objectType === filters.objectType)
    .filter((row) => !filters.completion
      || (filters.completion === 'COMPLETED' ? row.completed : !row.completed))
}

function flowBelongsToTab(flow: WoolWarehouseFlow, tab: WarehouseTab): boolean {
  if (tab === 'receipts') return flow.businessType === 'YARN_RECEIPT'
  if (tab === 'issues') return flow.businessType === 'YARN_ISSUE'
  if (tab === 'returns') return flow.businessType === 'YARN_RETURN'
  if (tab === 'inbounds') return flow.businessType === 'PROCESS_REPORT'
  if (tab === 'outbounds') return flow.businessType === 'HANDOVER'
  if (tab === 'adjustments') return flow.flowType === 'ADJUSTMENT'
  return flow.flowType === 'TRANSFER'
}

function countFilteredRows(mode: WarehouseMode, tab: WarehouseTab): number {
  if (tab === 'inventory') return filteredRows(mode, tab).length
  const filters = states[mode].filters
  const store = runtimeStore()
  return store.warehouseFlows.filter((flow) => {
    if (flow.warehouseMode !== mode || !flowBelongsToTab(flow, tab)) return false
    const order = store.workOrders[flow.woolOrderId]
    if (!order) return false
    const completed = isOrderCompleted(flow.woolOrderId)
    return matches(order.woolOrderNo, filters.woolOrderNo)
      && matches(order.productionOrderNo, filters.productionOrderNo)
      && matches(flow.objectSkuCode, filters.objectSkuCode)
      && matches(normalizeWoolBatchNo(flow.batchNo), filters.batchNo)
      && (!filters.objectType || flow.defaultLocationType === filters.objectType)
      && (!filters.completion
        || (filters.completion === 'COMPLETED' ? completed : !completed))
  }).length
}

function issueReturnBalance(row: WarehouseListRow): number {
  const store = runtimeStore()
  const issued = store.yarnIssues
    .filter((record) =>
      record.woolOrderId === row.woolOrderId
      && record.yarnSkuCode === row.objectSkuCode
      && normalizeWoolBatchNo(record.batchNo) === normalizeWoolBatchNo(row.batchNo),
    )
    .reduce((sum, record) => sum + record.issuedQty, 0)
  const returned = store.yarnReturns
    .filter((record) =>
      record.woolOrderId === row.woolOrderId
      && record.yarnSkuCode === row.objectSkuCode
      && normalizeWoolBatchNo(record.batchNo) === normalizeWoolBatchNo(row.batchNo),
    )
    .reduce((sum, record) => sum + record.returnedQty, 0)
  return Math.max(0, issued - returned)
}

function externalTransferBalance(flow: WoolWarehouseFlow): number {
  const defaultWarehouseId = WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[flow.defaultLocationId]
  if (
    flow.flowType !== 'TRANSFER'
    || flow.fromWarehouseId !== defaultWarehouseId
    || flow.fromLocationId !== flow.defaultLocationId
    || !flow.toWarehouseId
    || !flow.toLocationId
  ) return 0
  return runtimeStore().warehouseFlows
    .filter((item) =>
      item.woolOrderId === flow.woolOrderId
      && item.objectSkuCode === flow.objectSkuCode
      && item.defaultLocationId === flow.defaultLocationId
      && item.flowType === 'TRANSFER'
      && item.defaultLocationType === flow.defaultLocationType
      && normalizeWoolBatchNo(item.batchNo) === normalizeWoolBatchNo(flow.batchNo)
      && (
        (
          item.fromWarehouseId === defaultWarehouseId
          && item.fromLocationId === flow.defaultLocationId
          && item.toWarehouseId === flow.toWarehouseId
          && item.toLocationId === flow.toLocationId
        )
        || (
          item.fromWarehouseId === flow.toWarehouseId
          && item.fromLocationId === flow.toLocationId
          && item.toWarehouseId === defaultWarehouseId
          && item.toLocationId === flow.defaultLocationId
        )
      ),
    )
    .reduce((sum, item) =>
      item.fromWarehouseId === defaultWarehouseId
        && item.fromLocationId === flow.defaultLocationId
        && item.toWarehouseId === flow.toWarehouseId
        && item.toLocationId === flow.toLocationId
        ? sum + Math.abs(item.qty)
        : sum - Math.abs(item.qty), 0)
}

function actionButton(label: string, action: string, rowId: string, tone = ''): string {
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted ${tone}" data-wool-warehouse-action="${escapeHtml(action)}" data-row-id="${escapeHtml(rowId)}" data-skip-page-rerender="true">${escapeHtml(label)}</button>`
}

function renderRowActions(row: WarehouseListRow): string {
  const state = isOrderCompleted(row.woolOrderId) ? 'COMPLETED' : 'PROCESSING'
  const actions = [actionButton('查看明细', 'open-detail', row.rowId)]
  if (row.stock) {
    if (row.objectType === 'YARN' && state !== 'COMPLETED' && row.quantity > 0) {
      actions.push(actionButton('纱线领用', 'open-issue', row.rowId, 'border-blue-200 text-blue-700'))
    }
    if (row.objectType === 'YARN' && state !== 'COMPLETED' && issueReturnBalance(row) > 0) {
      actions.push(actionButton('纱线退回', 'open-return', row.rowId, 'border-emerald-200 text-emerald-700'))
    }
    actions.push(actionButton('库存调整', 'open-adjust', row.rowId))
    if (row.quantity > 0) actions.push(actionButton('库存转移', 'open-transfer-out', row.rowId))
  }
  if (row.flow && externalTransferBalance(row.flow) > 0) {
    actions.push(actionButton('转回默认库位', 'open-transfer-back', row.rowId))
  }
  actions.push(`<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(row.woolOrderId))}">查看加工单</button>`)
  return `<div class="flex max-w-[310px] flex-wrap justify-end gap-1.5">${actions.join('')}</div>`
}

function resolveEndpointLabel(warehouseId?: string, locationId?: string): {
  warehouseName: string
  warehouseId: string
  locationName: string
  locationId: string
} {
  const normalizedWarehouseId = warehouseId ?? ''
  const normalizedLocationId = locationId ?? ''
  if (normalizedWarehouseId in WAREHOUSE_LABELS) {
    return {
      warehouseName: WAREHOUSE_LABELS[normalizedWarehouseId as keyof typeof WAREHOUSE_LABELS],
      warehouseId: normalizedWarehouseId,
      locationName: LOCATION_LABELS[normalizedLocationId as WoolDefaultLocationId] ?? normalizedLocationId,
      locationId: normalizedLocationId,
    }
  }
  for (const warehouse of listFactoryInternalWarehouses()) {
    if (warehouse.warehouseId !== normalizedWarehouseId) continue
    for (const area of warehouse.areaList) {
      for (const shelf of area.shelfList) {
        const location = shelf.locationList.find((item) => item.locationId === normalizedLocationId)
        if (!location) continue
        return {
          warehouseName: warehouse.warehouseName,
          warehouseId: warehouse.warehouseId,
          locationName: `${area.areaName} / ${shelf.shelfName} / ${location.locationName}`,
          locationId: location.locationId,
        }
      }
    }
  }
  return {
    warehouseName: normalizedWarehouseId || '未记录仓库',
    warehouseId: normalizedWarehouseId,
    locationName: normalizedLocationId || '未记录库位',
    locationId: normalizedLocationId,
  }
}

function renderEndpoint(warehouseId?: string, locationId?: string): string {
  const endpoint = resolveEndpointLabel(warehouseId, locationId)
  return `<div><div>${escapeHtml(endpoint.warehouseName)} / ${escapeHtml(endpoint.locationName)}</div><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(endpoint.warehouseId)} / ${escapeHtml(endpoint.locationId)}</div></div>`
}

function renderRowLocation(row: WarehouseListRow): string {
  if (row.flow?.flowType === 'TRANSFER') {
    return `<div class="space-y-2"><div><span class="text-xs text-muted-foreground">从</span>${renderEndpoint(row.flow.fromWarehouseId, row.flow.fromLocationId)}</div><div><span class="text-xs text-muted-foreground">到</span>${renderEndpoint(row.flow.toWarehouseId, row.flow.toLocationId)}</div></div>`
  }
  return renderEndpoint(
    WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[row.locationId],
    row.locationId,
  )
}

const columns: StandardListColumn<WarehouseListRow>[] = [
  {
    key: 'record', title: '记录 / 库存键', width: 210, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.recordNo,
    render: (row) => `<div><div class="font-mono text-xs font-medium text-blue-700">${escapeHtml(row.recordNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.businessLabel)}</div></div>`,
  },
  {
    key: 'order', title: '毛织加工单', width: 180, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.woolOrderNo,
    render: (row) => `<div><div class="font-mono text-xs">${escapeHtml(row.woolOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.productionOrderNo)}</div></div>`,
  },
  {
    key: 'object', title: '库存对象', width: 230, required: true, sortable: true,
    sortValue: (row) => row.objectSkuCode,
    render: (row) => `<div><div class="font-mono text-xs font-medium">${escapeHtml(row.objectSkuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(TYPE_LABELS[row.objectType])} / ${escapeHtml(row.objectName)}</div></div>`,
  },
  {
    key: 'batch', title: '批次', width: 130, sortable: true,
    sortValue: (row) => row.batchNo ?? '',
    render: (row) => escapeHtml(row.batchNo || '不分批次'),
  },
  {
    key: 'qty', title: '数量', width: 120, required: true, sortable: true, align: 'right',
    sortValue: (row) => row.quantity,
    render: (row) => `<span class="font-medium tabular-nums">${escapeHtml(`${row.quantity} ${row.unit}`)}</span>`,
  },
  {
    key: 'location', title: '仓库 / 库位', width: 360, required: true, sortable: true,
    sortValue: (row) => row.locationId,
    render: renderRowLocation,
  },
  {
    key: 'operator', title: '操作事实', width: 190, sortable: true,
    sortValue: (row) => row.operatedAt,
    render: (row) => row.operatedAt
      ? `<div>${escapeHtml(row.operatedBy)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.operatedAt)}</div>`
      : '<span class="text-muted-foreground">当前汇总</span>',
  },
  {
    key: 'reason', title: '原因 / 状态', width: 220,
    render: (row) => row.completed && row.quantity > 0
      ? `<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">已完成加工单剩余库存</span>${row.reason && row.reason !== '已完成加工单剩余库存' ? `<div class="mt-1 text-xs">${escapeHtml(row.reason)}</div>` : ''}`
      : escapeHtml(row.reason || (row.completed ? '加工单已完成' : '加工单未完成')),
  },
  {
    key: 'actions', title: '操作', width: 330, required: true, actionColumn: true,
    render: renderRowActions,
  },
]

const columnRules = columns.map(({ key, required, freezeable, actionColumn }) => ({
  key,
  required,
  freezeable,
  actionColumn,
}))

function preferenceKey(mode: WarehouseMode, tab: WarehouseTab): string {
  return `/fcs/craft/wool/${mode.toLocaleLowerCase()}:${tab}:list-columns`
}

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map((column) => column.key),
    visibleKeys: columns.map((column) => column.key),
    frozenKeys: ['record'],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function preferences(mode: WarehouseMode): StandardListColumnPreferences {
  const state = states[mode]
  const key = state.activeTab
  if (!state.preferences[key]) {
    state.preferences[key] = typeof window === 'undefined'
      ? defaultPreferences()
      : loadListColumnPreferences(
          window.localStorage,
          preferenceKey(mode, key),
          columnRules,
          defaultPreferences(),
          PAGE_SIZE_OPTIONS,
        )
  }
  return state.preferences[key]
}

function savePreferences(mode: WarehouseMode): void {
  if (typeof window === 'undefined') return
  saveListColumnPreferences(
    window.localStorage,
    preferenceKey(mode, states[mode].activeTab),
    preferences(mode),
  )
}

function currentView(mode: WarehouseMode) {
  const state = states[mode]
  const rows = filteredRows(mode, state.activeTab)
  const sorted = sortStandardListRows(rows, state.sort, (row, key) =>
    columns.find((column) => column.key === key)?.sortValue?.(row),
  )
  const paging = paginateStandardListRows(sorted, state.currentPage, preferences(mode).pageSize)
  state.currentPage = paging.currentPage
  return {
    rows,
    tableHtml: renderStandardListTable({
      columns,
      rows: paging.rows,
      preferences: preferences(mode),
      sort: state.sort,
      eventPrefix: EVENT_PREFIX,
      emptyText: '当前筛选条件下暂无仓库事实',
      skipPageRerender: true,
    }),
    paginationHtml: renderTablePagination({
      total: paging.total,
      from: paging.from,
      to: paging.to,
      currentPage: paging.currentPage,
      totalPages: paging.totalPages,
      pageSize: paging.pageSize,
      actionPrefix: EVENT_PREFIX,
      fieldPrefix: EVENT_PREFIX,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      skipPageRerender: true,
    }),
  }
}

function renderFilterInput(
  label: string,
  field: keyof WarehouseFilters,
  value: string,
  placeholder: string,
): string {
  return `<label class="min-w-[11rem] flex-1"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-wool-warehouse-filter="${escapeHtml(field)}" data-skip-page-rerender="true"></label>`
}

function renderFilters(mode: WarehouseMode): string {
  const filters = states[mode].filters
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
    ${renderFilterInput('毛织加工单', 'woolOrderNo', filters.woolOrderNo, '输入加工单号')}
    ${renderFilterInput('生产单', 'productionOrderNo', filters.productionOrderNo, '输入生产单号')}
    ${renderFilterInput(mode === 'WAIT_PROCESS' ? '纱线 SKU' : '加工后 SKU', 'objectSkuCode', filters.objectSkuCode, '输入 SKU')}
    ${renderFilterInput('批次', 'batchNo', filters.batchNo, '输入批次')}
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">对象类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-warehouse-filter="objectType" data-skip-page-rerender="true"><option value="">全部类型</option><option value="YARN" ${filters.objectType === 'YARN' ? 'selected' : ''}>纱线</option><option value="CUT_PIECE" ${filters.objectType === 'CUT_PIECE' ? 'selected' : ''}>裁片</option><option value="GARMENT" ${filters.objectType === 'GARMENT' ? 'selected' : ''}>成衣</option></select></label>
    <label class="min-w-[10rem]"><span class="mb-1 block text-xs text-muted-foreground">加工单状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-warehouse-filter="completion" data-skip-page-rerender="true"><option value="">全部状态</option><option value="ACTIVE" ${filters.completion === 'ACTIVE' ? 'selected' : ''}>未完成</option><option value="COMPLETED" ${filters.completion === 'COMPLETED' ? 'selected' : ''}>已完成</option></select></label>
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filters' }, 'rotate-ccw')}
  </div>`
}

function renderTabBar(mode: WarehouseMode): string {
  const tabs = tabsForMode(mode).map((tab) => ({
    ...tab,
    count: countFilteredRows(mode, tab.key),
  }))
  return renderTabs({
    tabs,
    activeKey: states[mode].activeTab,
    prefix: EVENT_PREFIX,
    action: 'tab',
    variant: 'pills',
    className: 'max-w-full overflow-x-auto',
  }).replaceAll('<button', '<button data-skip-page-rerender="true"')
}

function renderFeedback(mode: WarehouseMode): string {
  const feedback = states[mode].feedback
  return feedback
    ? `<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" data-wool-warehouse-feedback>${escapeHtml(feedback)}</div>`
    : '<div data-wool-warehouse-feedback></div>'
}

function renderPublicLocationOptions(selectedValue = ''): string {
  return listFactoryInternalWarehouses()
    .filter((warehouse) => warehouse.isEnabled)
    .flatMap((warehouse) => warehouse.areaList.flatMap((area) =>
      area.status !== 'AVAILABLE' ? [] : area.shelfList.flatMap((shelf) =>
        shelf.status !== 'AVAILABLE' ? [] : shelf.locationList
          .filter((location) => location.status === 'AVAILABLE')
          .map((location) => ({
            value: `${warehouse.warehouseId}|${location.locationId}`,
            label: `${warehouse.warehouseName} / ${area.areaName} / ${shelf.shelfName} / ${location.locationName}`,
          })),
      ),
    ))
    .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('')
}

function findRow(mode: WarehouseMode, rowId: string): WarehouseListRow | undefined {
  if (rowId.startsWith('stock:')) {
    const stock = listWoolWarehouseStocksFromStore(runtimeStore(), mode)
      .find((item) => `stock:${item.stockKey}` === rowId)
    return stock ? stockToRow(stock) : undefined
  }
  if (rowId.startsWith('flow:')) {
    const flow = runtimeStore().warehouseFlows.find((item) => `flow:${item.flowId}` === rowId)
    return flow ? flowToRow(flow) : undefined
  }
  return undefined
}

function renderDialog(
  title: string,
  body: string,
  footer: string,
  error: string,
): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-wool-warehouse-dialog><section class="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg border bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><h2 class="font-semibold">${escapeHtml(title)}</h2><button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-warehouse-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="max-h-[72vh] overflow-y-auto p-4">${error ? `<div class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-wool-warehouse-overlay-error>${escapeHtml(error)}</div>` : '<div data-wool-warehouse-overlay-error></div>'}${body}</div><footer class="flex justify-end gap-2 border-t px-4 py-3">${footer}</footer></section></div>`
}

function dialogField(label: string, input: string, _compat = ''): string {
  return `<label class="block"><span class="mb-1 block text-sm font-medium">${escapeHtml(label)}</span>${input}</label>`
}

function renderDetailPager(
  kind: 'receipts' | 'flows' | 'changes',
  paging: ReturnType<typeof paginateStandardListRows<unknown>>,
  traceKey = '',
): string {
  return `<div data-wool-warehouse-detail-kind="${kind}" data-trace-key="${escapeHtml(traceKey)}" data-current-page="${paging.currentPage}">${renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'wool-warehouse-detail',
    fieldPrefix: 'wool-warehouse-detail',
    pageSizeOptions: [paging.pageSize],
    skipPageRerender: true,
  })}</div>`
}

function renderDetailDialog(mode: WarehouseMode, row: WarehouseListRow, overlay: Extract<WarehouseOverlay, { kind: 'detail' }>): string {
  const store = runtimeStore()
  const flows = store.warehouseFlows.filter((flow) =>
    flow.woolOrderId === row.woolOrderId
    && flow.objectSkuCode === row.objectSkuCode
    && flow.defaultLocationId === row.locationId
    &&
    normalizeWoolBatchNo(flow.batchNo) === normalizeWoolBatchNo(row.batchNo),
  )
  const flowPaging = paginateStandardListRows(flows, overlay.flowPage, 10)
  overlay.flowPage = flowPaging.currentPage
  const receiptTraces = row.objectType === 'YARN'
    ? listWoolYarnReceiptLineTracesFromStore(store, {
        woolOrderId: row.woolOrderId,
        objectSkuCode: row.objectSkuCode,
        batchMatch: 'EXACT',
        batchNo: row.batchNo,
      })
    : []
  const receiptPaging = paginateStandardListRows(receiptTraces, overlay.receiptPage, 5)
  overlay.receiptPage = receiptPaging.currentPage
  const receiptCards = receiptPaging.rows.map((trace) => {
    const changePaging = paginateStandardListRows(
      trace.qtyChanges,
      overlay.changePages[trace.traceKey] ?? 1,
      5,
    )
    overlay.changePages[trace.traceKey] = changePaging.currentPage
    const changeRows = changePaging.rows.map((change) => `<tr class="border-b last:border-b-0"><td class="px-2 py-1.5">${escapeHtml(`${change.beforeQty} → ${change.afterQty} ${change.qtyUnit}`)}</td><td class="px-2 py-1.5">${escapeHtml(`${change.afterQty - change.beforeQty} ${change.qtyUnit}`)}</td><td class="px-2 py-1.5">${escapeHtml(change.changedBy)}</td><td class="px-2 py-1.5">${escapeHtml(change.changedAt)}</td><td class="px-2 py-1.5">${escapeHtml(change.reason)}</td></tr>`).join('')
    return `<article class="rounded-md border p-3" data-wool-warehouse-receipt-trace="${escapeHtml(trace.traceKey)}"><div class="flex flex-wrap items-start justify-between gap-2"><div><div class="font-medium">${escapeHtml(trace.receiptNo)} / ${escapeHtml(trace.lineId)}</div><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(trace.receiptId)} / ${escapeHtml(trace.traceKey)}</div></div><div class="text-right text-sm"><div>原始 ${escapeHtml(`${trace.originalQty} ${trace.qtyUnit}`)}</div><div class="font-medium text-blue-700">有效 ${escapeHtml(`${trace.effectiveQty} ${trace.qtyUnit}`)}</div></div></div><div class="mt-2 grid gap-1 text-xs md:grid-cols-2"><div>批次：${escapeHtml(trace.batchNo || '不分批次')}</div><div>送货单：${escapeHtml(trace.deliveryNo || '未填写')}</div><div>接收人：${escapeHtml(trace.receivedBy)}</div><div>接收时间：${escapeHtml(trace.receivedAt)}</div><div>凭证：${escapeHtml(trace.proofFiles.join('、') || '无')}</div><div>差异：${escapeHtml(trace.differenceNote || '无')}</div><div class="md:col-span-2">备注：${escapeHtml(trace.remark || '无')}</div></div><div class="mt-3 overflow-x-auto rounded-md border"><table class="min-w-[760px] w-full text-xs"><thead class="bg-muted/50"><tr><th class="px-2 py-1.5 text-left">修改前 → 修改后</th><th class="px-2 py-1.5 text-left">变化量</th><th class="px-2 py-1.5 text-left">修改人</th><th class="px-2 py-1.5 text-left">时间</th><th class="px-2 py-1.5 text-left">原因</th></tr></thead><tbody>${changeRows || '<tr><td colspan="5" class="px-2 py-3 text-center text-muted-foreground">暂无数量修改历史</td></tr>'}</tbody></table>${renderDetailPager('changes', changePaging, trace.traceKey)}</div></article>`
  }).join('')
  const flowRows = flowPaging.rows.map((flow) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2">${escapeHtml(BUSINESS_LABELS[flow.businessType])}</td><td class="px-3 py-2 font-mono text-xs">${escapeHtml(flow.sourceRecordId)}</td><td class="px-3 py-2">${escapeHtml(`${flow.qty} ${flow.unit}`)}</td><td class="px-3 py-2">${flow.flowType === 'TRANSFER' ? `<div><span class="text-xs text-muted-foreground">从：</span>${renderEndpoint(flow.fromWarehouseId, flow.fromLocationId)}</div><div class="mt-1"><span class="text-xs text-muted-foreground">到：</span>${renderEndpoint(flow.toWarehouseId, flow.toLocationId)}</div>` : renderEndpoint(WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[flow.defaultLocationId], flow.defaultLocationId)}</td><td class="px-3 py-2">${escapeHtml(flow.operatedBy)}</td><td class="px-3 py-2">${escapeHtml(flow.operatedAt)}</td><td class="px-3 py-2">${escapeHtml(flow.reason || '—')}</td></tr>`).join('')
  return renderDialog(
    '库存与流水明细',
    `<div class="rounded-md border p-3 text-sm"><div class="font-medium">${escapeHtml(row.objectSkuCode)} / ${escapeHtml(row.objectName)}</div><div class="mt-1">${escapeHtml(row.woolOrderNo)} / ${escapeHtml(row.productionOrderNo)}</div><div class="mt-2">${renderEndpoint(WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[row.locationId], row.locationId)}</div></div><section class="mt-4"><div class="mb-2 font-medium">确认接收明细</div><div class="space-y-3">${receiptCards || '<div class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">当前对象没有确认接收明细</div>'}</div>${renderDetailPager('receipts', receiptPaging)}</section><section class="mt-4"><div class="mb-2 font-medium">仓库流水</div><div class="overflow-x-auto rounded-md border"><table class="min-w-[1100px] w-full text-sm"><thead class="bg-muted/50"><tr><th class="px-3 py-2 text-left">业务</th><th class="px-3 py-2 text-left">来源记录</th><th class="px-3 py-2 text-left">数量</th><th class="px-3 py-2 text-left">起止仓库 / 库位</th><th class="px-3 py-2 text-left">操作人</th><th class="px-3 py-2 text-left">时间</th><th class="px-3 py-2 text-left">原因</th></tr></thead><tbody>${flowRows || '<tr><td colspan="7" class="px-3 py-6 text-center text-muted-foreground">暂无流水</td></tr>'}</tbody></table>${renderDetailPager('flows', flowPaging)}</div></section>`,
    '<button type="button" class="rounded-md border px-3 py-2 text-sm" data-wool-warehouse-action="close-overlay" data-skip-page-rerender="true">关闭</button>',
    states[mode].overlayError,
  )
}

function operationDraft(
  overlay: Exclude<WarehouseOverlay, { kind: 'detail' }>,
  field: string,
  fallback = '',
): string {
  return overlay.draft?.[field] ?? fallback
}

function renderQuantityFieldError(mode: WarehouseMode, message: string): string {
  return states[mode].overlayError === message
    ? `<div class="mt-1 text-xs text-red-700" data-wool-warehouse-field-error>${escapeHtml(message)}</div>`
    : ''
}

function renderOperationDialog(mode: WarehouseMode, row: WarehouseListRow, overlay: Exclude<WarehouseOverlay, { kind: 'detail' }>): string {
  const common = `<div class="mb-4 rounded-md border bg-muted/20 p-3 text-sm"><div class="font-medium">${escapeHtml(row.woolOrderNo)} / ${escapeHtml(row.objectSkuCode)}</div><div class="mt-1">${escapeHtml(row.batchNo || '不分批次')} / ${escapeHtml(`${row.quantity} ${row.unit}`)}</div><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(row.locationId)}</div></div>`
  const inputClass = 'h-9 w-full rounded-md border bg-background px-3 text-sm'
  if (overlay.kind === 'issue' || overlay.kind === 'return') {
    const maxQty = overlay.kind === 'issue' ? row.quantity : issueReturnBalance(row)
    const label = overlay.kind === 'issue' ? '纱线领用' : '纱线退回'
    const emptyMessage = `${label}数量不能为空`
    return renderDialog(
      label,
      `${common}<div class="grid gap-3 md:grid-cols-2">${dialogField('数量', `<input type="number" min="0.001" step="0.001" max="${maxQty}" class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'qty'))}" data-wool-warehouse-dialog-field="qty" data-skip-page-rerender="true">${renderQuantityFieldError(mode, emptyMessage)}`, '')}${dialogField('操作人', `<input class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'operator', '毛织仓管'))}" data-wool-warehouse-dialog-field="operator" data-skip-page-rerender="true">`, '')}</div><p class="mt-3 text-xs text-muted-foreground">最多 ${escapeHtml(`${maxQty} ${row.unit}`)}；该动作只形成库存与流水，不改变齐料和加工状态。</p>`,
      `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" data-wool-warehouse-action="save-${overlay.kind}" data-skip-page-rerender="true">确认${escapeHtml(label)}</button>`,
      states[mode].overlayError,
    )
  }
  if (overlay.kind === 'adjust') {
    return renderDialog(
      '库存调整',
      `${common}<div class="grid gap-3 md:grid-cols-2">${dialogField('调整后数量', `<input type="number" min="0" step="${row.unit === 'kg' ? '0.001' : '1'}" class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'afterQty', String(row.quantity)))}" data-wool-warehouse-dialog-field="afterQty" data-skip-page-rerender="true">${renderQuantityFieldError(mode, '调整后数量不能为空')}`, '')}${dialogField('操作人', `<input class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'operator', '毛织仓管'))}" data-wool-warehouse-dialog-field="operator" data-skip-page-rerender="true">`, '')}</div><div class="mt-3">${dialogField('调整原因', `<textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-wool-warehouse-dialog-field="reason" data-skip-page-rerender="true">${escapeHtml(operationDraft(overlay, 'reason'))}</textarea>`, '')}</div>`,
      '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" data-wool-warehouse-action="save-adjust" data-skip-page-rerender="true">确认库存调整</button>',
      states[mode].overlayError,
    )
  }
  if (overlay.kind === 'transfer-out') {
    return renderDialog(
      '库存转移',
      `${common}<div class="space-y-3">${dialogField('目标公共库位', `<select class="${inputClass}" data-wool-warehouse-dialog-field="target" data-skip-page-rerender="true">${renderPublicLocationOptions(operationDraft(overlay, 'target'))}</select>`, '')}<div class="grid gap-3 md:grid-cols-2">${dialogField('转移数量', `<input type="number" min="0.001" step="${row.unit === 'kg' ? '0.001' : '1'}" max="${row.quantity}" class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'qty'))}" data-wool-warehouse-dialog-field="qty" data-skip-page-rerender="true">${renderQuantityFieldError(mode, '转移数量不能为空')}`, '')}${dialogField('操作人', `<input class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'operator', '毛织仓管'))}" data-wool-warehouse-dialog-field="operator" data-skip-page-rerender="true">`, '')}</div>${dialogField('转移原因', `<textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-wool-warehouse-dialog-field="reason" data-skip-page-rerender="true">${escapeHtml(operationDraft(overlay, 'reason'))}</textarea>`, '')}</div>`,
      '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" data-wool-warehouse-action="save-transfer-out" data-skip-page-rerender="true">确认库存转移</button>',
      states[mode].overlayError,
    )
  }
  const sourceFlow = row.flow!
  const returnable = externalTransferBalance(sourceFlow)
  return renderDialog(
    '转回默认库位',
    `${common}<div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">从 ${renderEndpoint(sourceFlow.toWarehouseId, sourceFlow.toLocationId)}<div class="mt-2">转回</div>${renderEndpoint(WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[row.locationId], row.locationId)}<div class="mt-2">最多 ${escapeHtml(`${returnable} ${row.unit}`)}。</div></div><div class="mt-3 grid gap-3 md:grid-cols-2">${dialogField('转回数量', `<input type="number" min="0.001" step="${row.unit === 'kg' ? '0.001' : '1'}" max="${returnable}" class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'qty'))}" data-wool-warehouse-dialog-field="qty" data-skip-page-rerender="true">${renderQuantityFieldError(mode, '转回数量不能为空')}`, '')}${dialogField('操作人', `<input class="${inputClass}" value="${escapeHtml(operationDraft(overlay, 'operator', '毛织仓管'))}" data-wool-warehouse-dialog-field="operator" data-skip-page-rerender="true">`, '')}</div><div class="mt-3">${dialogField('转回原因', `<textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-wool-warehouse-dialog-field="reason" data-skip-page-rerender="true">${escapeHtml(operationDraft(overlay, 'reason'))}</textarea>`, '')}</div>`,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" data-wool-warehouse-action="save-transfer-back" data-skip-page-rerender="true">确认转回默认库位</button>',
    states[mode].overlayError,
  )
}

function renderBusinessOverlay(mode: WarehouseMode): string {
  const overlay = states[mode].overlay
  if (!overlay) return ''
  const row = findRow(mode, overlay.rowId)
  if (!row) return ''
  return overlay.kind === 'detail'
    ? renderDetailDialog(mode, row, overlay)
    : renderOperationDialog(mode, row, overlay)
}

function renderColumnOverlay(mode: WarehouseMode): string {
  return states[mode].showColumnSettings
    ? renderStandardListColumnSettings({
        title: '毛织仓库列设置',
        columns,
        preferences: preferences(mode),
        eventPrefix: EVENT_PREFIX,
        maxFrozenWidth: 520,
        skipPageRerender: true,
      })
    : ''
}

function renderPage(mode: WarehouseMode): string {
  return withWarehouseRuntime(mode, () => renderPageFromRuntime(mode))
}

function renderPageFromRuntime(mode: WarehouseMode): string {
  const state = states[mode]
  const view = currentView(mode)
  const title = mode === 'WAIT_PROCESS' ? '毛织待加工仓' : '毛织待交出仓'
  const locationSummary = mode === 'WAIT_PROCESS'
    ? 'WOOL-WP-YARN-DEFAULT'
    : 'WOOL-WH-CUT-DEFAULT / WOOL-WH-GARMENT-DEFAULT'
  return `<div data-wool-warehouse-root data-wool-warehouse-mode="${mode}" data-skip-page-rerender="true">${renderStandardListPage({
    title,
    primaryActionsHtml: `<div class="rounded-md border bg-muted/30 px-3 py-2 text-xs"><span class="text-muted-foreground">固定默认库位：</span><span class="font-mono">${escapeHtml(locationSummary)}</span></div>`,
    feedbackHtml: renderFeedback(mode),
    filtersHtml: renderFilters(mode),
    listTitle: tabsForMode(mode).find((tab) => tab.key === state.activeTab)?.label ?? '库存',
    listActionsHtml: `<div class="flex max-w-full flex-wrap items-center justify-end gap-2"><div data-wool-warehouse-tabs>${renderTabBar(mode)}</div><button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-wool-warehouse-action="open-column-settings" data-skip-page-rerender="true">列设置</button></div>`,
    tableHtml: `<div data-wool-warehouse-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wool-warehouse-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wool-warehouse-column-overlays>${renderColumnOverlay(mode)}</div><div data-wool-warehouse-business-overlays>${renderBusinessOverlay(mode)}</div>`,
    className: 'min-w-0',
  })}</div>`
}

export function renderCraftWoolWaitProcessWarehousePage(): string {
  return renderPage('WAIT_PROCESS')
}

export function renderCraftWoolWaitHandoverWarehousePage(): string {
  return renderPage('WAIT_HANDOVER')
}

function hydrate(root: ParentNode): void {
  void import('../../../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(root))
    .catch(() => undefined)
}

function refresh(mode: WarehouseMode, options: {
  table?: boolean
  tabs?: boolean
  overlays?: boolean
  feedback?: boolean
} = {}): boolean {
  return withWarehouseRuntime(mode, () => refreshFromRuntime(mode, options))
}

function refreshFromRuntime(mode: WarehouseMode, options: {
  table?: boolean
  tabs?: boolean
  overlays?: boolean
  feedback?: boolean
} = {}): boolean {
  if (typeof document === 'undefined') return false
  const root = document.querySelector<HTMLElement>(`[data-wool-warehouse-root][data-wool-warehouse-mode="${mode}"]`)
  if (!root) return false
  const state = states[mode]
  if (options.table !== false) {
    const view = currentView(mode)
    const table = root.querySelector<HTMLElement>('[data-wool-warehouse-table-surface]')
    const pagination = root.querySelector<HTMLElement>('[data-wool-warehouse-pagination-surface]')
    const scrollLeft = table?.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft ?? 0
    if (table) {
      table.innerHTML = view.tableHtml
      const scroll = table.querySelector<HTMLElement>('[data-standard-list-scroll]')
      if (scroll) scroll.scrollLeft = Math.min(scrollLeft, Math.max(0, scroll.scrollWidth - scroll.clientWidth))
      hydrate(table)
    }
    if (pagination) {
      pagination.innerHTML = view.paginationHtml
      hydrate(pagination)
    }
  }
  if (options.tabs) {
    const tabs = root.querySelector<HTMLElement>('[data-wool-warehouse-tabs]')
    const title = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
    if (tabs) tabs.innerHTML = renderTabBar(mode)
    if (title) title.textContent = tabsForMode(mode).find((tab) => tab.key === state.activeTab)?.label ?? ''
  }
  if (options.overlays) {
    const columnsOverlay = root.querySelector<HTMLElement>('[data-wool-warehouse-column-overlays]')
    const businessOverlay = root.querySelector<HTMLElement>('[data-wool-warehouse-business-overlays]')
    if (columnsOverlay) columnsOverlay.innerHTML = renderColumnOverlay(mode)
    if (businessOverlay) businessOverlay.innerHTML = renderBusinessOverlay(mode)
    if (columnsOverlay) hydrate(columnsOverlay)
    if (businessOverlay) hydrate(businessOverlay)
  }
  if (options.feedback) {
    const feedback = root.querySelector<HTMLElement>('[data-wool-warehouse-feedback]')
    if (feedback) {
      feedback.outerHTML = renderFeedback(mode)
      const next = root.querySelector<HTMLElement>('[data-wool-warehouse-feedback]')
      if (next) hydrate(next)
    }
  }
  return true
}

function dialogRawValue(field: string): string {
  if (typeof document === 'undefined') return ''
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[data-wool-warehouse-dialog-field="${field}"]`,
  )?.value ?? ''
}

function dialogValue(field: string): string {
  return dialogRawValue(field).trim()
}

function requiredDialogNumber(
  field: string,
  label: string,
  options: { allowZero?: boolean } = {},
): number {
  const raw = dialogRawValue(field)
  if (!raw.trim()) throw new Error(`${label}不能为空`)
  const value = Number(raw.trim())
  if (!Number.isFinite(value)) throw new Error(`${label}必须是有效数字`)
  if (options.allowZero ? value < 0 : value <= 0) {
    throw new Error(`${label}${options.allowZero ? '不能小于 0' : '必须大于 0'}`)
  }
  return value
}

function captureOverlayDraft(
  overlay: Exclude<WarehouseOverlay, { kind: 'detail' }>,
): void {
  const fields = ['qty', 'afterQty', 'reason', 'operator', 'target']
  overlay.draft = Object.fromEntries(fields.map((field) => [field, dialogRawValue(field)]))
}

function saveOverlay(mode: WarehouseMode, action: string): void {
  const state = states[mode]
  const overlay = state.overlay
  if (!overlay || overlay.kind === 'detail') return
  const row = withWarehouseRuntime(mode, () => findRow(mode, overlay.rowId))
  if (!row) return
  try {
    const operatedAt = nowText()
    const operator = dialogValue('operator')
    if (action === 'save-issue') {
      issueWoolYarn(row.woolOrderId, {
        commandId: nextCommandId('ISSUE', row.woolOrderId),
        yarnSkuCode: row.objectSkuCode,
        batchNo: row.batchNo,
        issuedQty: requiredDialogNumber('qty', '纱线领用数量'),
        issuedAt: operatedAt,
        issuedBy: operator,
      })
      state.feedback = `已为 ${row.woolOrderNo} 记录纱线领用`
    } else if (action === 'save-return') {
      returnWoolYarn(row.woolOrderId, {
        commandId: nextCommandId('RETURN', row.woolOrderId),
        yarnSkuCode: row.objectSkuCode,
        batchNo: row.batchNo,
        returnedQty: requiredDialogNumber('qty', '纱线退回数量'),
        returnedAt: operatedAt,
        returnedBy: operator,
      })
      state.feedback = `已为 ${row.woolOrderNo} 记录纱线退回`
    } else if (action === 'save-adjust') {
      adjustWoolWarehouseStock({
        commandId: nextCommandId('ADJUST', row.woolOrderId),
        woolOrderId: row.woolOrderId,
        objectSkuCode: row.objectSkuCode,
        batchNo: row.batchNo,
        defaultLocationId: row.locationId,
        afterQty: requiredDialogNumber('afterQty', '调整后数量', { allowZero: true }),
        reason: dialogValue('reason'),
        operatedAt,
        operatedBy: operator,
      })
      state.feedback = `已调整 ${row.woolOrderNo} / ${row.objectSkuCode} 库存`
    } else if (action === 'save-transfer-out') {
      const [toWarehouseId = '', toLocationId = ''] = dialogValue('target').split('|')
      transferWoolWarehouseStock({
        commandId: nextCommandId('TRANSFER-OUT', row.woolOrderId),
        woolOrderId: row.woolOrderId,
        objectSkuCode: row.objectSkuCode,
        batchNo: row.batchNo,
        defaultLocationId: row.locationId,
        fromWarehouseId: WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[row.locationId],
        fromLocationId: row.locationId,
        toWarehouseId,
        toLocationId,
        qty: requiredDialogNumber('qty', '转移数量'),
        reason: dialogValue('reason'),
        operatedAt,
        operatedBy: operator,
      })
      state.feedback = `已从 ${row.locationId} 转出库存`
    } else if (action === 'save-transfer-back' && row.flow) {
      transferWoolWarehouseStock({
        commandId: nextCommandId('TRANSFER-BACK', row.woolOrderId),
        woolOrderId: row.woolOrderId,
        objectSkuCode: row.objectSkuCode,
        batchNo: row.batchNo,
        defaultLocationId: row.locationId,
        fromWarehouseId: row.flow.toWarehouseId,
        fromLocationId: row.flow.toLocationId,
        toWarehouseId: WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[row.locationId],
        toLocationId: row.locationId,
        qty: requiredDialogNumber('qty', '转回数量'),
        reason: dialogValue('reason'),
        operatedAt,
        operatedBy: operator,
      })
      state.feedback = `已转回 ${row.locationId}`
    }
    state.overlay = null
    state.overlayError = ''
    refresh(mode, { table: true, tabs: true, overlays: true, feedback: true })
  } catch (error) {
    captureOverlayDraft(overlay)
    state.overlayError = error instanceof Error ? error.message : String(error)
    refresh(mode, { table: false, overlays: true })
  }
}

function updateColumnPreference(mode: WarehouseMode, action: string, key: string, checked?: boolean): void {
  const current = preferences(mode)
  const column = columns.find((item) => item.key === key)
  if (!column || column.actionColumn) return
  const visibleKeys = action === 'toggle-column-visibility' && !column.required
    ? ((checked ?? !current.visibleKeys.includes(key))
        ? [...new Set([...current.visibleKeys, key])]
        : current.visibleKeys.filter((item) => item !== key))
    : current.visibleKeys
  const frozenKeys = action === 'toggle-column-freeze' && column.freezeable
    ? ((checked ?? !current.frozenKeys.includes(key))
        ? [...new Set([...current.frozenKeys, key])]
        : current.frozenKeys.filter((item) => item !== key))
    : current.frozenKeys
  states[mode].preferences[states[mode].activeTab] = normalizeListColumnPreferences(
    columnRules,
    { ...current, visibleKeys, frozenKeys },
    PAGE_SIZE_OPTIONS,
  )
  savePreferences(mode)
}

export async function handleCraftWoolWarehouseEvent(
  target: HTMLElement,
  event?: Event,
): Promise<boolean> {
  const root = target.closest<HTMLElement>('[data-wool-warehouse-root]')
  if (!root) return false
  const mode = root.dataset.woolWarehouseMode as WarehouseMode
  const state = states[mode]
  const filter = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wool-warehouse-filter]')
  if (filter) {
    const field = filter.dataset.woolWarehouseFilter as keyof WarehouseFilters
    state.filters[field] = filter.value as never
    const apply = () => {
      filterDebounce = undefined
      if (!root.isConnected) return
      state.currentPage = 1
      refresh(mode, { table: true, tabs: true })
    }
    if (event?.type === 'input') {
      if (filterDebounce) clearTimeout(filterDebounce)
      filterDebounce = setTimeout(apply, 180)
    } else apply()
    return true
  }
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event?.type === 'dragstart') {
    draggedColumnKey = dragNode.dataset.dragSource || ''
    return true
  }
  const dropNode = target.closest<HTMLElement>('[data-drop-target]')
  if (dropNode && event?.type === 'dragover') {
    event.preventDefault()
    return true
  }
  if (dropNode && event?.type === 'drop') {
    event.preventDefault()
    const targetKey = dropNode.dataset.dropTarget || ''
    const current = preferences(mode)
    const order = current.order.filter((key) => key !== draggedColumnKey && key !== 'actions')
    const targetIndex = order.indexOf(targetKey)
    if (draggedColumnKey && targetIndex >= 0) {
      order.splice(targetIndex, 0, draggedColumnKey)
      state.preferences[state.activeTab] = normalizeListColumnPreferences(
        columnRules,
        { ...current, order: [...order, 'actions'] },
        PAGE_SIZE_OPTIONS,
      )
      savePreferences(mode)
      refresh(mode, { table: true, overlays: true })
    }
    draggedColumnKey = ''
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-wool-warehouse-field="pageSize"]')
  if (pageSize) {
    state.preferences[state.activeTab] = {
      ...preferences(mode),
      pageSize: PAGE_SIZE_OPTIONS.includes(Number(pageSize.value)) ? Number(pageSize.value) : 10,
    }
    state.currentPage = 1
    savePreferences(mode)
    refresh(mode)
    return true
  }
  const detailAction = target.closest<HTMLElement>('[data-wool-warehouse-detail-action]')
  if (detailAction && state.overlay?.kind === 'detail') {
    const pager = detailAction.closest<HTMLElement>('[data-wool-warehouse-detail-kind]')
    const direction = detailAction.dataset.woolWarehouseDetailAction === 'prev-page' ? -1 : 1
    if (pager?.dataset.woolWarehouseDetailKind === 'receipts') {
      state.overlay.receiptPage = Math.max(1, state.overlay.receiptPage + direction)
    }
    if (pager?.dataset.woolWarehouseDetailKind === 'flows') {
      state.overlay.flowPage = Math.max(1, state.overlay.flowPage + direction)
    }
    if (pager?.dataset.woolWarehouseDetailKind === 'changes') {
      const traceKey = pager.dataset.traceKey || ''
      state.overlay.changePages[traceKey] = Math.max(
        1,
        (state.overlay.changePages[traceKey] ?? 1) + direction,
      )
    }
    refresh(mode, { table: false, overlays: true })
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wool-warehouse-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.woolWarehouseAction || ''
  if (action.startsWith('tab:')) {
    const tab = action.slice(4) as WarehouseTab
    if (tabsForMode(mode).some((item) => item.key === tab)) {
      state.activeTab = tab
      state.currentPage = 1
      state.sort = null
      state.showColumnSettings = false
      state.overlay = null
      refresh(mode, { table: true, tabs: true, overlays: true })
    }
    return true
  }
  if (action === 'reset-filters') {
    state.filters = { ...DEFAULT_FILTERS }
    state.currentPage = 1
    const filters = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-wool-warehouse-filter]')
    filters.forEach((node) => { node.value = '' })
    refresh(mode, { table: true, tabs: true })
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'prev-page' ? -1 : 1))
    refresh(mode)
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key !== key
      ? { key, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key, direction: 'desc' }
        : null
    state.currentPage = 1
    refresh(mode)
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refresh(mode, { table: false, overlays: true })
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refresh(mode, { table: false, overlays: true })
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const input = actionNode instanceof HTMLInputElement
      ? actionNode
      : actionNode.querySelector<HTMLInputElement>('input')
    updateColumnPreference(mode, action, actionNode.dataset.columnKey || '', input?.checked)
    refresh(mode, { table: true, overlays: true })
    return true
  }
  if (action === 'restore-column-settings' || action === 'restore-column-preferences') {
    if (typeof window !== 'undefined') {
      clearListColumnPreferences(window.localStorage, preferenceKey(mode, state.activeTab))
    }
    state.preferences[state.activeTab] = defaultPreferences()
    state.sort = null
    state.currentPage = 1
    refresh(mode, { table: true, overlays: true })
    return true
  }
  const overlayKinds: Record<string, WarehouseOverlay['kind']> = {
    'open-detail': 'detail',
    'open-issue': 'issue',
    'open-return': 'return',
    'open-adjust': 'adjust',
    'open-transfer-out': 'transfer-out',
    'open-transfer-back': 'transfer-back',
  }
  if (overlayKinds[action]) {
    const kind = overlayKinds[action]
    state.overlay = kind === 'detail'
      ? {
          kind,
          rowId: actionNode.dataset.rowId || '',
          receiptPage: 1,
          flowPage: 1,
          changePages: {},
        }
      : { kind, rowId: actionNode.dataset.rowId || '' } as WarehouseOverlay
    state.overlayError = ''
    refresh(mode, { table: false, overlays: true })
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refresh(mode, { table: false, overlays: true })
    return true
  }
  if (action.startsWith('save-')) {
    saveOverlay(mode, action)
    return true
  }
  return true
}
