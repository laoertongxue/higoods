import { readWoolStore, type WoolDomainStore } from './store.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
  WoolMachineAssociation,
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

export interface WoolYarnReceiptAggregate {
  yarnSkuCode: string
  receivedQty: number
  qtyUnit: 'kg'
  effectiveRecordCount: number
  effectiveBatchCount: number
  latestReceivedAt?: string
  isReceived: boolean
}

export interface WoolReadinessOutputProjection {
  readiness: WoolOutputReadiness
  handedOverQty: number
  stockQty: number
  handoverAvailableQty: number
}

export interface WoolWorkOrderReadinessProjection {
  yarnReceiptsBySku: Map<string, WoolYarnReceiptAggregate>
  outputsBySku: Map<string, WoolReadinessOutputProjection>
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

export interface WoolWarehouseFlowQuery {
  woolOrderId?: string
  objectSkuCode?: string
  sourceRecordType?: string
  sourceRecordId?: string
  defaultLocationId?: WoolWarehouseFlow['defaultLocationId']
}

export interface WoolWarehouseStockRow {
  stockKey: string
  woolOrderId: string
  woolOrderNo: string
  productionOrderNo: string
  kind: WoolWorkOrderKind
  objectSkuCode: string
  objectName: string
  objectType: 'YARN' | 'CUT_PIECE' | 'GARMENT'
  batchNo?: string
  defaultLocationId: WoolWarehouseFlow['defaultLocationId']
  currentQty: number
  unit: WoolWarehouseFlow['unit']
  completed: boolean
}

export interface WoolYarnReceiptLineTrace {
  traceKey: string
  receiptId: string
  receiptNo: string
  lineId: string
  woolOrderId: string
  deliveryNo?: string
  batchNo?: string
  yarnSkuCode: string
  yarnName: string
  originalQty: number
  effectiveQty: number
  qtyUnit: 'kg'
  proofFiles: string[]
  remark?: string
  differenceNote?: string
  receivedAt: string
  receivedBy: string
  qtyChanges: WoolQtyChangeLog[]
}

export interface WoolYarnReceiptLineTraceQuery {
  woolOrderId: string
  objectSkuCode?: string
  batchMatch: 'ANY' | 'EXACT'
  batchNo?: string
}

export function normalizeWoolBatchNo(batchNo?: string): string | undefined {
  const normalized = batchNo?.trim()
  return normalized || undefined
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

export function listWoolYarnReceiptLineTraces(
  query: WoolYarnReceiptLineTraceQuery,
): WoolYarnReceiptLineTrace[] {
  const store = readWoolStore()
  const expectedBatchNo = normalizeWoolBatchNo(query.batchNo)
  return store.yarnReceipts
    .filter((receipt) => receipt.woolOrderId === query.woolOrderId)
    .flatMap((receipt) => receipt.lines
      .filter((line) => !query.objectSkuCode || line.yarnSkuCode === query.objectSkuCode)
      .filter(() =>
        query.batchMatch === 'ANY'
        || normalizeWoolBatchNo(receipt.batchNo) === expectedBatchNo,
      )
      .map((line): WoolYarnReceiptLineTrace => {
        const qtyChanges = store.qtyChangeLogs
          .filter((change) =>
            change.recordType === 'YARN_RECEIPT'
            && change.recordId === receipt.receiptId
            && change.recordLineId === line.lineId,
          )
          .sort((left, right) =>
            left.changedAt.localeCompare(right.changedAt)
            || left.changeId.localeCompare(right.changeId),
          )
        return {
          traceKey: `${receipt.receiptId}|${line.lineId}`,
          receiptId: receipt.receiptId,
          receiptNo: receipt.receiptNo,
          lineId: line.lineId,
          woolOrderId: receipt.woolOrderId,
          deliveryNo: receipt.deliveryNo,
          batchNo: normalizeWoolBatchNo(receipt.batchNo),
          yarnSkuCode: line.yarnSkuCode,
          yarnName: line.yarnName,
          originalQty: line.receivedQty,
          effectiveQty: resolveWoolEffectiveQty(qtyChanges, {
            recordType: 'YARN_RECEIPT',
            recordId: receipt.receiptId,
            recordLineId: line.lineId,
            baseQty: line.receivedQty,
          }),
          qtyUnit: line.qtyUnit,
          proofFiles: [...(receipt.proofFiles ?? [])],
          remark: receipt.remark,
          differenceNote: line.differenceNote,
          receivedAt: receipt.receivedAt,
          receivedBy: receipt.receivedBy,
          qtyChanges,
        }
      }),
    )
    .sort((left, right) =>
      left.receivedAt.localeCompare(right.receivedAt)
      || left.receiptId.localeCompare(right.receiptId)
      || left.lineId.localeCompare(right.lineId),
    )
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

export function getWoolWorkOrderReadinessProjection(
  woolOrderId: string,
): WoolWorkOrderReadinessProjection {
  const store = readWoolStore()
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)

  const changedQtyByTarget = new Map<string, number>()
  for (const change of store.qtyChangeLogs) {
    const lineId = change.recordType === 'YARN_RECEIPT' ? change.recordLineId || '' : ''
    changedQtyByTarget.set(`${change.recordType}\u0000${change.recordId}\u0000${lineId}`, change.afterQty)
  }
  const yarnWorking = new Map<string, {
    receivedQty: number
    receiptIds: Set<string>
    batchNos: Set<string>
    latestReceivedAt?: string
  }>()
  for (const receipt of store.yarnReceipts) {
    if (receipt.woolOrderId !== woolOrderId) continue
    for (const line of receipt.lines) {
      const effectiveQty = changedQtyByTarget.get(
        `YARN_RECEIPT\u0000${receipt.receiptId}\u0000${line.lineId}`,
      ) ?? line.receivedQty
      if (effectiveQty <= 0) continue
      const current = yarnWorking.get(line.yarnSkuCode) ?? {
        receivedQty: 0,
        receiptIds: new Set<string>(),
        batchNos: new Set<string>(),
      }
      current.receivedQty += effectiveQty
      current.receiptIds.add(receipt.receiptId)
      if (receipt.batchNo) current.batchNos.add(receipt.batchNo)
      if (
        !current.latestReceivedAt
        || receipt.receivedAt.replace('T', ' ') > current.latestReceivedAt.replace('T', ' ')
      ) {
        current.latestReceivedAt = receipt.receivedAt
      }
      yarnWorking.set(line.yarnSkuCode, current)
    }
  }
  const yarnReceiptsBySku = new Map<string, WoolYarnReceiptAggregate>()
  for (const [yarnSkuCode, aggregate] of yarnWorking) {
    yarnReceiptsBySku.set(yarnSkuCode, {
      yarnSkuCode,
      receivedQty: aggregate.receivedQty,
      qtyUnit: 'kg',
      effectiveRecordCount: aggregate.receiptIds.size,
      effectiveBatchCount: aggregate.batchNos.size,
      latestReceivedAt: aggregate.latestReceivedAt,
      isReceived: aggregate.receivedQty > 0,
    })
  }

  const reportedBySku = new Map<string, number>()
  for (const report of store.processReports) {
    if (report.woolOrderId !== woolOrderId) continue
    const effectiveQty = changedQtyByTarget.get(`PROCESS_REPORT\u0000${report.reportId}\u0000`)
      ?? report.reportedQty
    reportedBySku.set(
      report.outputSkuCode,
      (reportedBySku.get(report.outputSkuCode) ?? 0) + effectiveQty,
    )
  }
  const handedOverBySku = new Map<string, number>()
  for (const handover of store.handovers) {
    if (handover.woolOrderId !== woolOrderId) continue
    const effectiveQty = changedQtyByTarget.get(`HANDOVER\u0000${handover.handoverId}\u0000`)
      ?? handover.handoverQty
    handedOverBySku.set(
      handover.outputSkuCode,
      (handedOverBySku.get(handover.outputSkuCode) ?? 0) + effectiveQty,
    )
  }

  const outputsBySku = new Map<string, WoolReadinessOutputProjection>()
  for (const line of order.outputPlanLines) {
    const requiredYarnSkus = [...new Set(line.requiredYarnSkus.filter(Boolean))]
    const confirmedYarnSkus = requiredYarnSkus.filter((sku) =>
      yarnReceiptsBySku.get(sku)?.isReceived,
    )
    const missingYarnSkus = requiredYarnSkus.filter((sku) =>
      !yarnReceiptsBySku.get(sku)?.isReceived,
    )
    const reportedQty = reportedBySku.get(line.outputSkuCode) ?? 0
    const handedOverQty = handedOverBySku.get(line.outputSkuCode) ?? 0
    const reportLimitQty = Math.floor(line.plannedQty * 1.5)
    const remainingReportQty = Math.max(reportLimitQty - reportedQty, 0)
    const isReady = requiredYarnSkus.length > 0 && missingYarnSkus.length === 0
    const stockQty = getWoolWarehouseStockFromStore(store, {
      woolOrderId,
      objectSkuCode: line.outputSkuCode,
      defaultLocationId: line.outputObjectType === 'GARMENT'
        ? 'WOOL-WH-GARMENT-DEFAULT'
        : 'WOOL-WH-CUT-DEFAULT',
    })
    outputsBySku.set(line.outputSkuCode, {
      readiness: {
        outputSkuCode: line.outputSkuCode,
        requiredYarnSkus,
        confirmedYarnSkus,
        missingYarnSkus,
        isReady,
        plannedQty: line.plannedQty,
        reportLimitQty,
        reportedQty,
        remainingReportQty,
        canReport: isReady && remainingReportQty > 0,
      },
      handedOverQty,
      stockQty,
      handoverAvailableQty: Math.max(0, Math.min(stockQty, reportedQty - handedOverQty)),
    })
  }
  return { yarnReceiptsBySku, outputsBySku }
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
  const output = getWoolWorkOrderReadinessProjection(woolOrderId).outputsBySku.get(outputSkuCode)
  if (!output) throw new Error(`毛织加工单 ${woolOrderId} 不包含加工后 SKU ${outputSkuCode}`)
  return output.readiness
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
  if (order.outputPlanLines.some((line) =>
    getWoolOutputHandoverAvailableQtyFromStore(store, woolOrderId, line.outputSkuCode) > 0,
  )) {
    actions.push('HANDOVER')
  }
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
  return getWoolWarehouseStockFromStore(readWoolStore(), key)
}

function getWoolWarehouseStockFromStore(
  store: WoolDomainStore,
  key: WoolWarehouseStockKey,
): number {
  return store.warehouseFlows
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

export function getWoolOutputHandoverAvailableQtyFromStore(
  store: WoolDomainStore,
  woolOrderId: string,
  outputSkuCode: string,
): number {
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  const line = requireOutputLine(order, outputSkuCode)
  const reportedQty = store.processReports
    .filter((record) => record.woolOrderId === woolOrderId && record.outputSkuCode === outputSkuCode)
    .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(store, record), 0)
  const handedOverQty = store.handovers
    .filter((record) => record.woolOrderId === woolOrderId && record.outputSkuCode === outputSkuCode)
    .reduce((sum, record) => sum + getWoolHandoverEffectiveQty(store, record), 0)
  const stockQty = getWoolWarehouseStockFromStore(store, {
    woolOrderId,
    objectSkuCode: outputSkuCode,
    defaultLocationId: line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT'
      : 'WOOL-WH-CUT-DEFAULT',
  })
  return Math.max(0, Math.min(stockQty, reportedQty - handedOverQty))
}

export function getWoolOutputHandoverAvailableQty(
  woolOrderId: string,
  outputSkuCode: string,
): number {
  return getWoolOutputHandoverAvailableQtyFromStore(readWoolStore(), woolOrderId, outputSkuCode)
}

export function getWoolOutputStockQty(woolOrderId: string, outputSkuCode: string): number {
  const order = requireOrder(woolOrderId)
  const line = requireOutputLine(order, outputSkuCode)
  return getWoolWarehouseStock({
    woolOrderId,
    objectSkuCode: outputSkuCode,
    defaultLocationId: line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT'
      : 'WOOL-WH-CUT-DEFAULT',
  })
}

export function listWoolWarehouseFlows(query: WoolWarehouseFlowQuery = {}): WoolWarehouseFlow[] {
  return readWoolStore().warehouseFlows
    .filter((flow) => !query.woolOrderId || flow.woolOrderId === query.woolOrderId)
    .filter((flow) => !query.objectSkuCode || flow.objectSkuCode === query.objectSkuCode)
    .filter((flow) => !query.sourceRecordType || flow.sourceRecordType === query.sourceRecordType)
    .filter((flow) => !query.sourceRecordId || flow.sourceRecordId === query.sourceRecordId)
    .filter((flow) => !query.defaultLocationId || flow.defaultLocationId === query.defaultLocationId)
    .sort((left, right) =>
      right.operatedAt.localeCompare(left.operatedAt) || right.flowId.localeCompare(left.flowId),
    )
}

export function listWoolWarehouseStocks(
  warehouseMode?: WoolWarehouseFlow['warehouseMode'],
): WoolWarehouseStockRow[] {
  const store = readWoolStore()
  const candidates = new Map<string, WoolWarehouseFlow>()
  for (const flow of store.warehouseFlows) {
    if (warehouseMode && flow.warehouseMode !== warehouseMode) continue
    const stockKey = [
      flow.woolOrderId,
      flow.objectSkuCode,
      flow.batchNo ?? '',
      flow.defaultLocationId,
    ].join('|')
    if (!candidates.has(stockKey)) candidates.set(stockKey, flow)
  }
  return [...candidates.entries()]
    .flatMap(([stockKey, flow]): WoolWarehouseStockRow[] => {
      const order = store.workOrders[flow.woolOrderId]
      if (!order) return []
      const outputLine = order.outputPlanLines.find((line) => line.outputSkuCode === flow.objectSkuCode)
      const objectType = flow.defaultLocationType === 'YARN'
        ? 'YARN'
        : flow.defaultLocationType === 'CUT_PIECE'
          ? 'CUT_PIECE'
          : 'GARMENT'
      const objectName = objectType === 'YARN'
        ? store.yarnReceipts
          .filter((receipt) => receipt.woolOrderId === flow.woolOrderId)
          .flatMap((receipt) => receipt.lines)
          .find((line) => line.yarnSkuCode === flow.objectSkuCode)?.yarnName ?? flow.objectSkuCode
        : [
            outputLine?.colorName,
            outputLine?.sizeCode,
            outputLine?.woolPartName,
          ].filter(Boolean).join(' / ') || flow.objectSkuCode
      return [{
        stockKey,
        woolOrderId: flow.woolOrderId,
        woolOrderNo: order.woolOrderNo,
        productionOrderNo: order.productionOrderNo,
        kind: order.kind,
        objectSkuCode: flow.objectSkuCode,
        objectName,
        objectType,
        batchNo: flow.batchNo,
        defaultLocationId: flow.defaultLocationId,
        currentQty: getWoolWarehouseStockFromStore(store, {
          woolOrderId: flow.woolOrderId,
          objectSkuCode: flow.objectSkuCode,
          batchNo: flow.batchNo,
          defaultLocationId: flow.defaultLocationId,
        }),
        unit: flow.unit,
        completed: store.completions.some((completion) =>
          completion.woolOrderId === flow.woolOrderId,
        ),
      }]
    })
    .sort((left, right) =>
      left.woolOrderNo.localeCompare(right.woolOrderNo)
      || left.objectSkuCode.localeCompare(right.objectSkuCode)
      || (left.batchNo ?? '').localeCompare(right.batchNo ?? ''),
    )
}

export function getWoolCompletion(woolOrderId: string): WoolCompletionRecord | undefined {
  requireOrder(woolOrderId)
  return readWoolStore().completions.find((record) => record.woolOrderId === woolOrderId)
}

export function listWoolMachineAssociations(woolOrderId?: string): WoolMachineAssociation[] {
  if (woolOrderId) requireOrder(woolOrderId)
  return readWoolStore().machineAssociations
    .filter((association) => !woolOrderId || association.woolOrderId === woolOrderId)
    .sort((left, right) => left.machineId.localeCompare(right.machineId))
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
    return ('woolOrderId' in record ? record.woolOrderId : '') ?? ''
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
