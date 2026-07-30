import { readWoolStore, type WoolDomainStore } from './store.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
  WoolOperationLog,
  WoolOutputPlanLine,
  WoolProcessReportRecord,
  WoolProcessingStatus,
  WoolQtyChangeLog,
  WoolWarehouseFlow,
  WoolWorkOrder,
  WoolWorkOrderKind,
  WoolYarnIssueRecord,
  WoolYarnReceiptLine,
  WoolYarnReceiptRecord,
  WoolYarnReturnRecord,
} from './types.ts'

export type WoolWorkOrderTab = 'READY' | 'NOT_READY' | 'COMPLETED'
export type WoolAllowedAction =
  | 'DETAIL'
  | 'RECEIVE_YARN'
  | 'REPORT_PROCESS'
  | 'HANDOVER'
  | 'ASSOCIATE_MACHINE'
  | 'COMPLETE'

export interface WoolOutputReadiness {
  outputSkuCode: string
  requiredYarnSkus: string[]
  confirmedYarnSkus: string[]
  missingYarnSkus: string[]
  isReady: boolean
  plannedQty: number
  reportLimitQty: number
  reportedQty: number
  remainingReportQty: number
  canReport: boolean
}

export interface WoolWorkOrderFilters {
  keyword?: string
  kind?: WoolWorkOrderKind
  tab?: WoolWorkOrderTab
  productionOrderNo?: string
  woolOrderNo?: string
}

export type WoolFactRecordType =
  | 'YARN_RECEIPT'
  | 'YARN_ISSUE'
  | 'YARN_RETURN'
  | 'PROCESS_REPORT'
  | 'HANDOVER'
  | 'QTY_CHANGE'
  | 'WAREHOUSE_FLOW'
  | 'COMPLETION'
  | 'OPERATION_LOG'

export type WoolFactRecord =
  | WoolYarnReceiptRecord
  | WoolYarnIssueRecord
  | WoolYarnReturnRecord
  | WoolProcessReportRecord
  | WoolHandoverRecord
  | WoolQtyChangeLog
  | WoolWarehouseFlow
  | WoolCompletionRecord
  | WoolOperationLog

export interface WoolFactRecordItem {
  recordType: WoolFactRecordType
  woolOrderId: string
  occurredAt: string
  record: WoolFactRecord
}

export interface WoolFactRecordQuery {
  woolOrderId?: string
  recordType?: WoolFactRecordType | WoolFactRecordType[]
  objectSkuCode?: string
  sourceRecordId?: string
}

export interface WoolWarehouseStockKey {
  woolOrderId: string
  objectSkuCode: string
  defaultLocationId: WoolWarehouseFlow['defaultLocationId']
  batchNo?: string
}

function requireOrder(woolOrderId: string): WoolWorkOrder {
  const order = readWoolStore().workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  return order
}

function requireOutputLine(order: WoolWorkOrder, outputSkuCode: string): WoolOutputPlanLine {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  if (!line) throw new Error(`毛织加工单 ${order.woolOrderNo} 不包含加工后 SKU ${outputSkuCode}`)
  return line
}

export interface WoolEffectiveQtyTarget {
  recordType: WoolQtyChangeLog['recordType']
  recordId: string
  recordLineId?: string
  baseQty: number
}

export function resolveWoolEffectiveQty(
  qtyChangeLogs: readonly WoolQtyChangeLog[],
  target: WoolEffectiveQtyTarget,
): number {
  return qtyChangeLogs
    .filter((change) =>
      change.recordType === target.recordType
      && change.recordId === target.recordId
      && (target.recordType !== 'YARN_RECEIPT' || change.recordLineId === target.recordLineId),
    )
    .sort((left, right) =>
      left.changedAt.localeCompare(right.changedAt) || left.changeId.localeCompare(right.changeId),
    )
    .reduce((_currentQty, change) => change.afterQty, target.baseQty)
}

export function getWoolYarnReceiptLineEffectiveQty(
  store: WoolDomainStore,
  receipt: WoolYarnReceiptRecord,
  line: WoolYarnReceiptLine,
): number {
  return resolveWoolEffectiveQty(store.qtyChangeLogs, {
    recordType: 'YARN_RECEIPT',
    recordId: receipt.receiptId,
    recordLineId: line.lineId,
    baseQty: line.receivedQty,
  })
}

export function getWoolProcessReportEffectiveQty(
  store: WoolDomainStore,
  record: WoolProcessReportRecord,
): number {
  return resolveWoolEffectiveQty(store.qtyChangeLogs, {
    recordType: 'PROCESS_REPORT',
    recordId: record.reportId,
    baseQty: record.reportedQty,
  })
}

export function getWoolHandoverEffectiveQty(
  store: WoolDomainStore,
  record: WoolHandoverRecord,
): number {
  return resolveWoolEffectiveQty(store.qtyChangeLogs, {
    recordType: 'HANDOVER',
    recordId: record.handoverId,
    baseQty: record.handoverQty,
  })
}

export function getWoolOutputReportedQty(woolOrderId: string, outputSkuCode: string): number {
  const store = readWoolStore()
  return store.processReports
    .filter((record) => record.woolOrderId === woolOrderId && record.outputSkuCode === outputSkuCode)
    .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(store, record), 0)
}

export function getWoolOutputHandedOverQty(woolOrderId: string, outputSkuCode: string): number {
  const store = readWoolStore()
  return store.handovers
    .filter((record) => record.woolOrderId === woolOrderId && record.outputSkuCode === outputSkuCode)
    .reduce((sum, record) => sum + getWoolHandoverEffectiveQty(store, record), 0)
}

export function getWoolOutputReadiness(
  woolOrderId: string,
  outputSkuCode: string,
): WoolOutputReadiness {
  const store = readWoolStore()
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  const line = requireOutputLine(order, outputSkuCode)
  const requiredYarnSkus = [...new Set(line.requiredYarnSkus.filter(Boolean))]
  const confirmedSet = new Set(
    store.yarnReceipts
      .filter((record) => record.woolOrderId === woolOrderId)
      .flatMap((record) => record.lines.map((line) => ({ record, line })))
      .filter(({ record, line: receiptLine }) =>
        getWoolYarnReceiptLineEffectiveQty(store, record, receiptLine) > 0,
      )
      .map(({ line: receiptLine }) => receiptLine.yarnSkuCode),
  )
  const confirmedYarnSkus = requiredYarnSkus.filter((sku) => confirmedSet.has(sku))
  const missingYarnSkus = requiredYarnSkus.filter((sku) => !confirmedSet.has(sku))
  const isReady = requiredYarnSkus.length > 0 && missingYarnSkus.length === 0
  const reportedQty = store.processReports
    .filter((record) => record.woolOrderId === woolOrderId && record.outputSkuCode === outputSkuCode)
    .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(store, record), 0)
  const reportLimitQty = Math.floor(line.plannedQty * 1.5)
  const remainingReportQty = Math.max(reportLimitQty - reportedQty, 0)
  return {
    outputSkuCode,
    requiredYarnSkus,
    confirmedYarnSkus,
    missingYarnSkus,
    isReady,
    plannedQty: line.plannedQty,
    reportLimitQty,
    reportedQty,
    remainingReportQty,
    canReport: isReady && remainingReportQty > 0,
  }
}

export function getWoolProcessingStatus(woolOrderId: string): WoolProcessingStatus {
  const store = readWoolStore()
  if (!store.workOrders[woolOrderId]) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  if (store.completions.some((record) => record.woolOrderId === woolOrderId)) return 'COMPLETED'
  if (
    store.processReports.some((record) =>
      record.woolOrderId === woolOrderId && getWoolProcessReportEffectiveQty(store, record) > 0,
    )
    || store.handovers.some((record) =>
      record.woolOrderId === woolOrderId && getWoolHandoverEffectiveQty(store, record) > 0,
    )
  ) {
    return 'PROCESSING'
  }
  return 'UNPROCESSED'
}

export function getWoolWorkOrderTab(woolOrderId: string): WoolWorkOrderTab {
  const order = requireOrder(woolOrderId)
  if (getWoolProcessingStatus(woolOrderId) === 'COMPLETED') return 'COMPLETED'
  return order.outputPlanLines.some((line) =>
    getWoolOutputReadiness(woolOrderId, line.outputSkuCode).canReport,
  )
    ? 'READY'
    : 'NOT_READY'
}

export function getWoolWorkOrderBlockReason(woolOrderId: string): string {
  const order = requireOrder(woolOrderId)
  if (getWoolProcessingStatus(woolOrderId) === 'COMPLETED') return '加工单已完成'
  const readiness = order.outputPlanLines.map((line) =>
    getWoolOutputReadiness(woolOrderId, line.outputSkuCode),
  )
  if (readiness.some((item) => item.canReport)) return ''
  if (
    readiness.length > 0
    && readiness.every((item) => item.isReady && item.remainingReportQty === 0)
  ) {
    return '全部加工后 SKU 已达到填报上限'
  }
  if (readiness.every((item) => item.requiredYarnSkus.length === 0)) {
    return '技术包未提供可核对的必需纱线关系'
  }
  const missing = [...new Set(readiness.flatMap((item) => item.missingYarnSkus))]
  return missing.length > 0 ? `必需纱线未齐：${missing.join('、')}` : '当前没有可继续填报的加工后 SKU'
}

export function getWoolAllowedActions(woolOrderId: string): WoolAllowedAction[] {
  const store = readWoolStore()
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  const actions: WoolAllowedAction[] = ['DETAIL']
  if (getWoolProcessingStatus(woolOrderId) === 'COMPLETED') return actions
  actions.push('RECEIVE_YARN')
  const readiness = order.outputPlanLines.map((line) =>
    getWoolOutputReadiness(woolOrderId, line.outputSkuCode),
  )
  if (readiness.some((item) => item.canReport)) actions.push('REPORT_PROCESS')
  const hasStock = order.outputPlanLines.some((line) => {
    const location = line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT'
      : 'WOOL-WH-CUT-DEFAULT'
    return getWoolWarehouseStock({
      woolOrderId,
      objectSkuCode: line.outputSkuCode,
      defaultLocationId: location,
    }) > 0
  })
  if (hasStock) actions.push('HANDOVER')
  if (
    readiness.some((item) => item.canReport)
    || store.machineAssociations.some((association) => association.woolOrderId === woolOrderId)
  ) {
    actions.push('ASSOCIATE_MACHINE')
  }
  if (store.handovers.some((record) =>
    record.woolOrderId === woolOrderId && getWoolHandoverEffectiveQty(store, record) > 0,
  )) {
    actions.push('COMPLETE')
  }
  return actions
}

function parseStockKey(stockKey: string): WoolWarehouseStockKey {
  const [woolOrderId, objectSkuCode, batchNo, defaultLocationId] = stockKey.split('|')
  if (!woolOrderId || !objectSkuCode || !defaultLocationId) {
    throw new Error('毛织库存键必须为“加工单|对象 SKU|批次|默认库位”')
  }
  return {
    woolOrderId,
    objectSkuCode,
    batchNo: batchNo || undefined,
    defaultLocationId: defaultLocationId as WoolWarehouseFlow['defaultLocationId'],
  }
}

export function getWoolWarehouseStock(stockKey: WoolWarehouseStockKey | string): number {
  const key = typeof stockKey === 'string' ? parseStockKey(stockKey) : stockKey
  return readWoolStore().warehouseFlows
    .filter((flow) =>
      flow.woolOrderId === key.woolOrderId
      && flow.objectSkuCode === key.objectSkuCode
      && flow.defaultLocationId === key.defaultLocationId
      && (key.batchNo === undefined || flow.batchNo === key.batchNo),
    )
    .reduce((sum, flow) => {
      if (flow.flowType === 'INBOUND') return sum + Math.abs(flow.qty)
      if (flow.flowType === 'OUTBOUND') return sum - Math.abs(flow.qty)
      if (flow.flowType === 'TRANSFER') {
        if (flow.fromLocationId === key.defaultLocationId) return sum - Math.abs(flow.qty)
        if (flow.toLocationId === key.defaultLocationId) return sum + Math.abs(flow.qty)
      }
      return sum + flow.qty
    }, 0)
}

function includesKeyword(order: WoolWorkOrder, keyword: string): boolean {
  const normalized = keyword.trim().toLocaleLowerCase()
  if (!normalized) return true
  return [
    order.woolOrderId,
    order.woolOrderNo,
    order.taskId,
    order.taskNo,
    order.productionOrderId,
    order.productionOrderNo,
    order.sourceTechPackVersionCode,
    order.mockScenarioCode,
    ...order.outputPlanLines.flatMap((line) => [
      line.outputSkuCode,
      line.garmentSkuCode,
      line.colorName,
      line.woolPartName,
    ]),
  ].some((value) => String(value ?? '').toLocaleLowerCase().includes(normalized))
}

export function listWoolWorkOrders(filters: WoolWorkOrderFilters = {}): WoolWorkOrder[] {
  const candidates = Object.values(readWoolStore().workOrders)
    .filter((order) => includesKeyword(order, filters.keyword ?? ''))
    .filter((order) => !filters.kind || order.kind === filters.kind)
    .filter((order) =>
      !filters.productionOrderNo
      || order.productionOrderNo.includes(filters.productionOrderNo.trim()),
    )
    .filter((order) =>
      !filters.woolOrderNo
      || order.woolOrderNo.includes(filters.woolOrderNo.trim()),
    )
  return candidates
    .filter((order) => !filters.tab || getWoolWorkOrderTab(order.woolOrderId) === filters.tab)
    .sort((left, right) => left.woolOrderNo.localeCompare(right.woolOrderNo))
}

export function getWoolWorkOrderTabCounts(
  filters: Omit<WoolWorkOrderFilters, 'tab'> = {},
): Record<WoolWorkOrderTab, number> {
  const filtered = listWoolWorkOrders(filters)
  return filtered.reduce<Record<WoolWorkOrderTab, number>>(
    (counts, order) => {
      counts[getWoolWorkOrderTab(order.woolOrderId)] += 1
      return counts
    },
    { READY: 0, NOT_READY: 0, COMPLETED: 0 },
  )
}

function occurredAt(record: WoolFactRecord, fallback = ''): string {
  if ('receivedAt' in record && typeof record.receivedAt === 'string') return record.receivedAt
  if ('issuedAt' in record) return record.issuedAt
  if ('returnedAt' in record) return record.returnedAt
  if ('reportedAt' in record) return record.reportedAt
  if ('handedOverAt' in record) return record.handedOverAt
  if ('changedAt' in record) return record.changedAt
  if ('operatedAt' in record) return record.operatedAt
  if ('completedAt' in record) return record.completedAt
  return fallback
}

function resolveFactWoolOrderId(
  store: ReturnType<typeof readWoolStore>,
  recordType: WoolFactRecordType,
  record: WoolFactRecord,
): string {
  if (recordType !== 'QTY_CHANGE') {
    return 'woolOrderId' in record ? record.woolOrderId : ''
  }
  const change = record as WoolQtyChangeLog
  if (change.recordType === 'YARN_RECEIPT') {
    return store.yarnReceipts.find((item) =>
      item.receiptId === change.recordId
      && (!change.recordLineId || item.lines.some((line) => line.lineId === change.recordLineId)),
    )?.woolOrderId ?? ''
  }
  if (change.recordType === 'PROCESS_REPORT') {
    return store.processReports.find((item) => item.reportId === change.recordId)?.woolOrderId ?? ''
  }
  return store.handovers.find((item) => item.handoverId === change.recordId)?.woolOrderId ?? ''
}

function factRecordMatchesObjectSku(
  recordType: WoolFactRecordType,
  record: WoolFactRecord,
  objectSkuCode: string,
): boolean {
  if (recordType === 'YARN_RECEIPT') {
    return (record as WoolYarnReceiptRecord).lines.some((line) => line.yarnSkuCode === objectSkuCode)
  }
  if (recordType === 'YARN_ISSUE') {
    return (record as WoolYarnIssueRecord).yarnSkuCode === objectSkuCode
  }
  if (recordType === 'YARN_RETURN') {
    return (record as WoolYarnReturnRecord).yarnSkuCode === objectSkuCode
  }
  if (recordType === 'PROCESS_REPORT') {
    return (record as WoolProcessReportRecord).outputSkuCode === objectSkuCode
  }
  if (recordType === 'HANDOVER') {
    return (record as WoolHandoverRecord).outputSkuCode === objectSkuCode
  }
  if (recordType === 'QTY_CHANGE') {
    return (record as WoolQtyChangeLog).objectSkuCode === objectSkuCode
  }
  if (recordType === 'WAREHOUSE_FLOW') {
    return (record as WoolWarehouseFlow).objectSkuCode === objectSkuCode
  }
  if (recordType === 'COMPLETION') {
    const snapshot = (record as WoolCompletionRecord).confirmationSnapshot
    return snapshot.yarnReceiptSummary.some((item) => item.yarnSkuCode === objectSkuCode)
      || snapshot.outputReadinessSummary.some((item) =>
        item.outputSkuCode === objectSkuCode
        || item.requiredYarnSkus.includes(objectSkuCode)
        || item.confirmedYarnSkus.includes(objectSkuCode)
        || item.missingYarnSkus.includes(objectSkuCode),
      )
      || snapshot.processReportSummary.some((item) => item.outputSkuCode === objectSkuCode)
      || snapshot.handoverSummary.some((item) => item.outputSkuCode === objectSkuCode)
      || snapshot.waitProcessStockSummary.some((item) => item.yarnSkuCode === objectSkuCode)
      || snapshot.waitHandoverStockSummary.some((item) => item.outputSkuCode === objectSkuCode)
  }
  return false
}

export function listWoolFactRecords(query: WoolFactRecordQuery = {}): WoolFactRecordItem[] {
  const store = readWoolStore()
  const groups: Array<[WoolFactRecordType, WoolFactRecord[]]> = [
    ['YARN_RECEIPT', store.yarnReceipts],
    ['YARN_ISSUE', store.yarnIssues],
    ['YARN_RETURN', store.yarnReturns],
    ['PROCESS_REPORT', store.processReports],
    ['HANDOVER', store.handovers],
    ['QTY_CHANGE', store.qtyChangeLogs],
    ['WAREHOUSE_FLOW', store.warehouseFlows],
    ['COMPLETION', store.completions],
    ['OPERATION_LOG', store.operationLogs],
  ]
  const allowedTypes = query.recordType
    ? new Set(Array.isArray(query.recordType) ? query.recordType : [query.recordType])
    : undefined
  return groups
    .filter(([recordType]) => !allowedTypes || allowedTypes.has(recordType))
    .flatMap(([recordType, records]) => records.map((record) => ({
      recordType,
      woolOrderId: resolveFactWoolOrderId(store, recordType, record),
      occurredAt: occurredAt(record),
      record,
    })))
    .filter((item) => !query.woolOrderId || item.woolOrderId === query.woolOrderId)
    .filter((item) => {
      if (!query.objectSkuCode) return true
      return factRecordMatchesObjectSku(item.recordType, item.record, query.objectSkuCode)
    })
    .filter((item) => {
      if (!query.sourceRecordId) return true
      return 'sourceRecordId' in item.record && item.record.sourceRecordId === query.sourceRecordId
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
}
