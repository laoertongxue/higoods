import {
  getWoolHandoverEffectiveQty,
  getWoolProcessReportEffectiveQty,
  getWoolYarnReceiptLineEffectiveQty,
} from './queries.ts'
import { commitWoolStore, readWoolStore, type WoolDomainStore } from './store.ts'
import { resolveEnabledFactoryWarehouseLocation } from '../factory-internal-warehouse-locations.ts'
import type {
  WoolCompletionRecord,
  WoolDefaultLocationId,
  WoolHandoverRecord,
  WoolOutputPlanLine,
  WoolProcessReportRecord,
  WoolQtyChangeLog,
  WoolQtyChangeRecordType,
  WoolWarehouseFlow,
  WoolWorkOrder,
  WoolYarnIssueRecord,
  WoolYarnReceiptLine,
  WoolYarnReceiptRecord,
  WoolYarnReturnRecord,
} from './types.ts'

interface CommandInput {
  commandId: string
}

export interface AddWoolYarnReceiptInput extends CommandInput {
  deliveryNo?: string
  batchNo?: string
  receivedAt: string
  receivedBy: string
  lines: Array<{
    yarnSkuCode: string
    yarnName?: string
    receivedQty: number
  }>
}

export interface AddWoolProcessReportInput extends CommandInput {
  outputSkuCode: string
  reportedQty: number
  reportedAt: string
  reportedBy: string
}

export interface AddWoolHandoverInput extends CommandInput {
  outputSkuCode: string
  handoverQty: number
  handedOverAt: string
  handedOverBy: string
}

export interface ConfirmWoolDownstreamReceiptInput extends CommandInput {
  actualReceivedQty: number
  receivedAt: string
  receivedBy: string
}

export interface IssueWoolYarnInput extends CommandInput {
  yarnSkuCode: string
  batchNo?: string
  issuedQty: number
  issuedAt: string
  issuedBy: string
}

export interface ReturnWoolYarnInput extends CommandInput {
  yarnSkuCode: string
  batchNo?: string
  returnedQty: number
  returnedAt: string
  returnedBy: string
}

export interface AdjustWoolWarehouseStockInput extends CommandInput {
  woolOrderId: string
  objectSkuCode: string
  defaultLocationId: WoolDefaultLocationId
  batchNo?: string
  afterQty: number
  reason: string
  operatedAt: string
  operatedBy: string
}

export interface TransferWoolWarehouseStockInput extends CommandInput {
  woolOrderId: string
  objectSkuCode: string
  defaultLocationId: WoolDefaultLocationId
  batchNo?: string
  toWarehouseId: string
  toLocationId: string
  qty: number
  reason: string
  operatedAt: string
  operatedBy: string
}

export interface ChangeWoolFactQtyInput extends CommandInput {
  recordType: WoolQtyChangeRecordType
  recordId: string
  recordLineId?: string
  afterQty: number
  reason: string
  changedAt: string
  changedBy: string
}

export interface CompleteWoolWorkOrderInput extends CommandInput {
  completedAt: string
  completedBy: string
  remark?: string
}

const WOOL_DEFAULT_LOCATION_IDS = new Set<WoolDefaultLocationId>([
  'WOOL-WP-YARN-DEFAULT',
  'WOOL-WH-CUT-DEFAULT',
  'WOOL-WH-GARMENT-DEFAULT',
])

function commandToken(commandId: string): string {
  const value = commandId.trim()
  if (!value) throw new Error('commandId 不能为空')
  return encodeURIComponent(value)
}

function commandRecordId(prefix: string, commandId: string): string {
  return `${prefix}-${commandToken(commandId)}`
}

function requireText(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) throw new Error(`${label}不能为空`)
  return normalized
}

function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须大于 0`)
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label}必须为正整数`)
}

function requireOrder(store: WoolDomainStore, woolOrderId: string): WoolWorkOrder {
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  return order
}

function requireUncompleted(store: WoolDomainStore, woolOrderId: string): WoolWorkOrder {
  const order = requireOrder(store, woolOrderId)
  if (store.completions.some((record) => record.woolOrderId === woolOrderId)) {
    throw new Error(`毛织加工单 ${order.woolOrderNo} 已完成`)
  }
  return order
}

function requireOutputLine(order: WoolWorkOrder, outputSkuCode: string): WoolOutputPlanLine {
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  if (!line) throw new Error(`毛织加工单 ${order.woolOrderNo} 不包含加工后 SKU ${outputSkuCode}`)
  return line
}

function requiredYarnSkus(order: WoolWorkOrder): Set<string> {
  return new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))
}

function outputLocation(line: WoolOutputPlanLine): Pick<
  WoolWarehouseFlow,
  'warehouseMode' | 'defaultLocationType' | 'defaultLocationId'
> {
  return line.outputObjectType === 'GARMENT'
    ? {
        warehouseMode: 'WAIT_HANDOVER',
        defaultLocationType: 'GARMENT',
        defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT',
      }
    : {
        warehouseMode: 'WAIT_HANDOVER',
        defaultLocationType: 'CUT_PIECE',
        defaultLocationId: 'WOOL-WH-CUT-DEFAULT',
      }
}

function signedFlowQty(flow: WoolWarehouseFlow): number {
  if (flow.flowType === 'INBOUND') return Math.abs(flow.qty)
  if (flow.flowType === 'OUTBOUND') return -Math.abs(flow.qty)
  if (flow.flowType === 'TRANSFER') {
    if (flow.fromLocationId === flow.defaultLocationId) return -Math.abs(flow.qty)
    if (flow.toLocationId === flow.defaultLocationId) return Math.abs(flow.qty)
    return 0
  }
  return flow.qty
}

function stockQty(
  store: WoolDomainStore,
  input: {
    woolOrderId: string
    objectSkuCode: string
    defaultLocationId: WoolDefaultLocationId
    batchNo?: string
  },
): number {
  return store.warehouseFlows
    .filter((flow) =>
      flow.woolOrderId === input.woolOrderId
      && flow.objectSkuCode === input.objectSkuCode
      && flow.defaultLocationId === input.defaultLocationId
      && (input.batchNo === undefined || flow.batchNo === input.batchNo),
    )
    .reduce((sum, flow) => sum + signedFlowQty(flow), 0)
}

function confirmedYarnSkus(store: WoolDomainStore, woolOrderId: string): Set<string> {
  return new Set(
    store.yarnReceipts
      .filter((record) => record.woolOrderId === woolOrderId)
      .flatMap((record) => record.lines.map((line) => ({ record, line })))
      .filter(({ record, line }) => getWoolYarnReceiptLineEffectiveQty(store, record, line) > 0)
      .map(({ line }) => line.yarnSkuCode),
  )
}

function resolveYarnBatch(
  store: WoolDomainStore,
  input: {
    woolOrderId: string
    yarnSkuCode: string
    batchNo?: string
    requiredStockQty?: number
    issuedOnly?: boolean
  },
): string | undefined {
  if (input.batchNo) return input.batchNo
  const candidates = input.issuedOnly
    ? store.yarnIssues
        .filter((record) =>
          record.woolOrderId === input.woolOrderId && record.yarnSkuCode === input.yarnSkuCode,
        )
        .map((record) => record.batchNo)
    : store.warehouseFlows
        .filter((flow) =>
          flow.woolOrderId === input.woolOrderId
          && flow.objectSkuCode === input.yarnSkuCode
          && flow.defaultLocationId === 'WOOL-WP-YARN-DEFAULT',
        )
        .map((flow) => flow.batchNo)
  const distinct = [...new Set(candidates)]
  if (input.requiredStockQty !== undefined) {
    return distinct.find((batchNo) =>
      stockQty(store, {
        woolOrderId: input.woolOrderId,
        objectSkuCode: input.yarnSkuCode,
        batchNo,
        defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      }) >= input.requiredStockQty!,
    )
  }
  if (distinct.length > 1) throw new Error('存在多个纱线批次，请选择对应批次')
  return distinct[0]
}

function requireStockObject(
  store: WoolDomainStore,
  input: {
    woolOrderId: string
    objectSkuCode: string
    defaultLocationId: WoolDefaultLocationId
    batchNo?: string
  },
): {
  order: WoolWorkOrder
  unit: WoolWarehouseFlow['unit']
  warehouseMode: WoolWarehouseFlow['warehouseMode']
  defaultLocationType: WoolWarehouseFlow['defaultLocationType']
  batchNo?: string
} {
  const order = requireOrder(store, input.woolOrderId)
  if (requiredYarnSkus(order).has(input.objectSkuCode)) {
    if (input.defaultLocationId !== 'WOOL-WP-YARN-DEFAULT') {
      throw new Error('纱线库存只能使用纱线默认库位')
    }
    const batchNo = input.batchNo ?? resolveYarnBatch(store, {
      woolOrderId: input.woolOrderId,
      yarnSkuCode: input.objectSkuCode,
    })
    return {
      order,
      unit: 'kg',
      warehouseMode: 'WAIT_PROCESS',
      defaultLocationType: 'YARN',
      batchNo,
    }
  }
  const line = requireOutputLine(order, input.objectSkuCode)
  const location = outputLocation(line)
  if (input.defaultLocationId !== location.defaultLocationId) {
    throw new Error('加工后对象与默认库位不一致')
  }
  return { order, unit: line.qtyUnit, ...location, batchNo: undefined }
}

function isEnabledPublicWarehouseLocation(warehouseId: string, locationId: string): boolean {
  if (WOOL_DEFAULT_LOCATION_IDS.has(locationId as WoolDefaultLocationId)) return false
  return Boolean(resolveEnabledFactoryWarehouseLocation(warehouseId, locationId))
}

export function addWoolYarnReceipt(
  woolOrderId: string,
  input: AddWoolYarnReceiptInput,
): WoolYarnReceiptRecord {
  const receiptId = commandRecordId('WR', input.commandId)
  const existing = readWoolStore().yarnReceipts.find((record) => record.receiptId === receiptId)
  if (existing) return existing
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('确认接收至少一条纱线明细')
  }
  input.lines.forEach((line) => requirePositive(line.receivedQty, '接收数量'))
  const receivedBy = requireText(input.receivedBy, '接收人')
  const committed = commitWoolStore((draft) => {
    const order = requireUncompleted(draft, woolOrderId)
    const allowedYarns = requiredYarnSkus(order)
    for (const line of input.lines) {
      if (!allowedYarns.has(line.yarnSkuCode)) {
        throw new Error(`纱线 SKU ${line.yarnSkuCode} 不属于加工单冻结必需纱线`)
      }
    }
    const receipt: WoolYarnReceiptRecord = {
      receiptId,
      receiptNo: commandRecordId('WR-NO', input.commandId),
      woolOrderId,
      deliveryNo: input.deliveryNo?.trim() || undefined,
      batchNo: input.batchNo?.trim() || undefined,
      receivedAt: input.receivedAt,
      receivedBy,
      lines: input.lines.map((line, index): WoolYarnReceiptLine => {
        const lineId = `${receiptId}-LINE-${index + 1}`
        return {
          lineId,
          yarnSkuCode: line.yarnSkuCode,
          yarnName: line.yarnName?.trim() || `${line.yarnSkuCode} 纱线`,
          receivedQty: line.receivedQty,
          qtyUnit: 'kg',
          warehouseInboundFlowId: `WF-${lineId}`,
        }
      }),
      createdAt: input.receivedAt,
      updatedAt: input.receivedAt,
    }
    draft.yarnReceipts.push(receipt)
    draft.warehouseFlows.push(...receipt.lines.map((line): WoolWarehouseFlow => ({
      flowId: line.warehouseInboundFlowId,
      woolOrderId,
      flowType: 'INBOUND',
      businessType: 'YARN_RECEIPT',
      warehouseMode: 'WAIT_PROCESS',
      defaultLocationType: 'YARN',
      defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      objectSkuCode: line.yarnSkuCode,
      batchNo: receipt.batchNo,
      qty: line.receivedQty,
      unit: 'kg',
      sourceRecordType: 'YARN_RECEIPT',
      sourceRecordId: line.lineId,
      operatedAt: input.receivedAt,
      operatedBy: receivedBy,
    })))
  })
  return committed.yarnReceipts.find((record) => record.receiptId === receiptId)!
}

export function addWoolProcessReport(
  woolOrderId: string,
  input: AddWoolProcessReportInput,
): WoolProcessReportRecord {
  const reportId = commandRecordId('WPR', input.commandId)
  const existing = readWoolStore().processReports.find((record) => record.reportId === reportId)
  if (existing) return existing
  requirePositiveInteger(input.reportedQty, '加工填报数量')
  const reportedBy = requireText(input.reportedBy, '填报人')
  const committed = commitWoolStore((draft) => {
    const order = requireUncompleted(draft, woolOrderId)
    const line = requireOutputLine(order, input.outputSkuCode)
    const confirmed = confirmedYarnSkus(draft, woolOrderId)
    const missing = [...new Set(line.requiredYarnSkus)].filter((sku) => !confirmed.has(sku))
    if (missing.length > 0) throw new Error(`必需纱线未齐：${missing.join('、')}`)
    const reportedQty = draft.processReports
      .filter((record) =>
        record.woolOrderId === woolOrderId && record.outputSkuCode === input.outputSkuCode,
      )
      .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(draft, record), 0)
    const limit = Math.floor(line.plannedQty * 1.5)
    if (reportedQty + input.reportedQty > limit) {
      throw new Error(`累计加工填报不能超过计划数量的 150%（${limit}${line.qtyUnit}）`)
    }
    const warehouseInboundFlowId = `WF-${reportId}`
    const report: WoolProcessReportRecord = {
      reportId,
      woolOrderId,
      outputSkuCode: input.outputSkuCode,
      reportedQty: input.reportedQty,
      reportedAt: input.reportedAt,
      reportedBy,
      warehouseInboundFlowId,
      createdAt: input.reportedAt,
      updatedAt: input.reportedAt,
    }
    draft.processReports.push(report)
    draft.warehouseFlows.push({
      flowId: warehouseInboundFlowId,
      woolOrderId,
      flowType: 'INBOUND',
      businessType: 'PROCESS_REPORT',
      ...outputLocation(line),
      objectSkuCode: line.outputSkuCode,
      qty: input.reportedQty,
      unit: line.qtyUnit,
      sourceRecordType: 'PROCESS_REPORT',
      sourceRecordId: reportId,
      operatedAt: input.reportedAt,
      operatedBy: reportedBy,
    })
  })
  return committed.processReports.find((record) => record.reportId === reportId)!
}

export function addWoolHandover(
  woolOrderId: string,
  input: AddWoolHandoverInput,
): WoolHandoverRecord {
  const handoverId = commandRecordId('WHO', input.commandId)
  const existing = readWoolStore().handovers.find((record) => record.handoverId === handoverId)
  if (existing) return existing
  requirePositiveInteger(input.handoverQty, '交出数量')
  const handedOverBy = requireText(input.handedOverBy, '交出人')
  const committed = commitWoolStore((draft) => {
    const order = requireUncompleted(draft, woolOrderId)
    const line = requireOutputLine(order, input.outputSkuCode)
    if (!order.downstreamTarget.receiverId || !order.downstreamTarget.receiverName) {
      throw new Error('交出去向未配置')
    }
    const location = outputLocation(line)
    const currentStock = stockQty(draft, {
      woolOrderId,
      objectSkuCode: line.outputSkuCode,
      defaultLocationId: location.defaultLocationId,
    })
    if (input.handoverQty > currentStock) throw new Error('交出数量不能超过默认库位当前库存')
    const warehouseOutboundFlowId = `WF-${handoverId}`
    const record: WoolHandoverRecord = {
      handoverId,
      woolOrderId,
      outputSkuCode: line.outputSkuCode,
      handoverQty: input.handoverQty,
      qtyUnit: line.qtyUnit,
      ...order.downstreamTarget,
      handedOverAt: input.handedOverAt,
      handedOverBy,
      warehouseOutboundFlowId,
      downstreamReceipt: {
        receiptConfirmationId: `DRC-${handoverId}`,
        status: 'PENDING',
      },
      createdAt: input.handedOverAt,
      updatedAt: input.handedOverAt,
    }
    draft.handovers.push(record)
    draft.warehouseFlows.push({
      flowId: warehouseOutboundFlowId,
      woolOrderId,
      flowType: 'OUTBOUND',
      businessType: 'HANDOVER',
      ...location,
      objectSkuCode: line.outputSkuCode,
      qty: input.handoverQty,
      unit: line.qtyUnit,
      sourceRecordType: 'HANDOVER',
      sourceRecordId: handoverId,
      operatedAt: input.handedOverAt,
      operatedBy: handedOverBy,
    })
  })
  return committed.handovers.find((record) => record.handoverId === handoverId)!
}

export function confirmWoolDownstreamReceipt(
  handoverId: string,
  input: ConfirmWoolDownstreamReceiptInput,
): WoolHandoverRecord {
  const operationLogId = commandRecordId('WOOP-DOWNSTREAM', input.commandId)
  const current = readWoolStore()
  const existing = current.handovers.find((record) => record.handoverId === handoverId)
  if (!existing) throw new Error(`找不到交出记录 ${handoverId}`)
  if (current.operationLogs.some((log) => log.operationLogId === operationLogId)) return existing
  if (existing.downstreamReceipt?.status === 'CONFIRMED') throw new Error('下游已经确认接收')
  if (!Number.isInteger(input.actualReceivedQty) || input.actualReceivedQty < 0) {
    throw new Error('实际接收数量必须为非负整数')
  }
  const receivedBy = requireText(input.receivedBy, '接收人')
  const committed = commitWoolStore((draft) => {
    const record = draft.handovers.find((item) => item.handoverId === handoverId)!
    const effectiveQty = getWoolHandoverEffectiveQty(draft, record)
    record.downstreamReceipt = {
      receiptConfirmationId: record.downstreamReceipt?.receiptConfirmationId ?? `DRC-${handoverId}`,
      status: 'CONFIRMED',
      actualReceivedQty: input.actualReceivedQty,
      differenceQty: input.actualReceivedQty - effectiveQty,
      receivedAt: input.receivedAt,
      receivedBy,
    }
    record.updatedAt = input.receivedAt
    draft.operationLogs.push({
      operationLogId,
      woolOrderId: record.woolOrderId,
      action: 'CONFIRM_WOOL_DOWNSTREAM_RECEIPT',
      objectType: 'WOOL_HANDOVER',
      objectId: handoverId,
      afterValue: record.downstreamReceipt,
      operatedAt: input.receivedAt,
      operatedBy: receivedBy,
    })
  })
  return committed.handovers.find((record) => record.handoverId === handoverId)!
}

export function issueWoolYarn(
  woolOrderId: string,
  input: IssueWoolYarnInput,
): WoolYarnIssueRecord {
  const issueId = commandRecordId('WI', input.commandId)
  const existing = readWoolStore().yarnIssues.find((record) => record.issueId === issueId)
  if (existing) return existing
  requirePositive(input.issuedQty, '领用数量')
  const issuedBy = requireText(input.issuedBy, '领用人')
  const committed = commitWoolStore((draft) => {
    const order = requireUncompleted(draft, woolOrderId)
    if (!requiredYarnSkus(order).has(input.yarnSkuCode)) {
      throw new Error(`纱线 SKU ${input.yarnSkuCode} 不属于加工单冻结必需纱线`)
    }
    const batchNo = resolveYarnBatch(draft, {
      woolOrderId,
      yarnSkuCode: input.yarnSkuCode,
      batchNo: input.batchNo,
      requiredStockQty: input.issuedQty,
    })
    const currentStock = stockQty(draft, {
      woolOrderId,
      objectSkuCode: input.yarnSkuCode,
      batchNo,
      defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
    })
    if (input.issuedQty > currentStock) throw new Error('领用数量不能超过当前库存')
    const warehouseOutboundFlowId = `WF-${issueId}`
    draft.yarnIssues.push({
      issueId,
      issueNo: commandRecordId('WI-NO', input.commandId),
      woolOrderId,
      yarnSkuCode: input.yarnSkuCode,
      batchNo,
      issuedQty: input.issuedQty,
      qtyUnit: 'kg',
      warehouseOutboundFlowId,
      issuedAt: input.issuedAt,
      issuedBy,
    })
    draft.warehouseFlows.push({
      flowId: warehouseOutboundFlowId,
      woolOrderId,
      flowType: 'OUTBOUND',
      businessType: 'YARN_ISSUE',
      warehouseMode: 'WAIT_PROCESS',
      defaultLocationType: 'YARN',
      defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      objectSkuCode: input.yarnSkuCode,
      batchNo,
      qty: input.issuedQty,
      unit: 'kg',
      sourceRecordType: 'YARN_ISSUE',
      sourceRecordId: issueId,
      operatedAt: input.issuedAt,
      operatedBy: issuedBy,
    })
  })
  return committed.yarnIssues.find((record) => record.issueId === issueId)!
}

export function returnWoolYarn(
  woolOrderId: string,
  input: ReturnWoolYarnInput,
): WoolYarnReturnRecord {
  const returnId = commandRecordId('WRT', input.commandId)
  const existing = readWoolStore().yarnReturns.find((record) => record.returnId === returnId)
  if (existing) return existing
  requirePositive(input.returnedQty, '退回数量')
  const returnedBy = requireText(input.returnedBy, '退回人')
  const committed = commitWoolStore((draft) => {
    const order = requireUncompleted(draft, woolOrderId)
    if (!requiredYarnSkus(order).has(input.yarnSkuCode)) {
      throw new Error(`纱线 SKU ${input.yarnSkuCode} 不属于加工单冻结必需纱线`)
    }
    const batchNo = resolveYarnBatch(draft, {
      woolOrderId,
      yarnSkuCode: input.yarnSkuCode,
      batchNo: input.batchNo,
      issuedOnly: true,
    })
    const issuedQty = draft.yarnIssues
      .filter((record) =>
        record.woolOrderId === woolOrderId
        && record.yarnSkuCode === input.yarnSkuCode
        && record.batchNo === batchNo,
      )
      .reduce((sum, record) => sum + record.issuedQty, 0)
    const returnedQty = draft.yarnReturns
      .filter((record) =>
        record.woolOrderId === woolOrderId
        && record.yarnSkuCode === input.yarnSkuCode
        && record.batchNo === batchNo,
      )
      .reduce((sum, record) => sum + record.returnedQty, 0)
    if (returnedQty + input.returnedQty > issuedQty) {
      throw new Error('同加工单、同纱线和对应批次的累计退回不能超过累计领用')
    }
    const warehouseInboundFlowId = `WF-${returnId}`
    draft.yarnReturns.push({
      returnId,
      returnNo: commandRecordId('WRT-NO', input.commandId),
      woolOrderId,
      yarnSkuCode: input.yarnSkuCode,
      batchNo,
      returnedQty: input.returnedQty,
      qtyUnit: 'kg',
      warehouseInboundFlowId,
      returnedAt: input.returnedAt,
      returnedBy,
    })
    draft.warehouseFlows.push({
      flowId: warehouseInboundFlowId,
      woolOrderId,
      flowType: 'INBOUND',
      businessType: 'YARN_RETURN',
      warehouseMode: 'WAIT_PROCESS',
      defaultLocationType: 'YARN',
      defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      objectSkuCode: input.yarnSkuCode,
      batchNo,
      qty: input.returnedQty,
      unit: 'kg',
      sourceRecordType: 'YARN_RETURN',
      sourceRecordId: returnId,
      operatedAt: input.returnedAt,
      operatedBy: returnedBy,
    })
  })
  return committed.yarnReturns.find((record) => record.returnId === returnId)!
}

export function adjustWoolWarehouseStock(
  input: AdjustWoolWarehouseStockInput,
): WoolWarehouseFlow {
  const sourceRecordId = commandRecordId('STOCK-ADJUSTMENT', input.commandId)
  const existing = readWoolStore().warehouseFlows.find((flow) =>
    flow.sourceRecordType === 'STOCK_ADJUSTMENT' && flow.sourceRecordId === sourceRecordId,
  )
  if (existing) return existing
  if (!Number.isFinite(input.afterQty) || input.afterQty < 0) {
    throw new Error('调整后数量不能小于 0')
  }
  const reason = requireText(input.reason, '调整原因')
  const operatedBy = requireText(input.operatedBy, '操作人')
  const committed = commitWoolStore((draft) => {
    const stockObject = requireStockObject(draft, input)
    const currentQty = stockQty(draft, {
      ...input,
      batchNo: stockObject.batchNo,
    })
    const delta = input.afterQty - currentQty
    if (delta === 0) throw new Error('调整前后数量不能相同')
    draft.warehouseFlows.push({
      flowId: `WF-${sourceRecordId}`,
      woolOrderId: input.woolOrderId,
      flowType: 'ADJUSTMENT',
      businessType: 'STOCK_ADJUSTMENT',
      warehouseMode: stockObject.warehouseMode,
      defaultLocationType: stockObject.defaultLocationType,
      defaultLocationId: input.defaultLocationId,
      objectSkuCode: input.objectSkuCode,
      batchNo: stockObject.batchNo,
      qty: delta,
      unit: stockObject.unit,
      sourceRecordType: 'STOCK_ADJUSTMENT',
      sourceRecordId,
      reason,
      operatedAt: input.operatedAt,
      operatedBy,
    })
    draft.operationLogs.push({
      operationLogId: commandRecordId('WOOP-STOCK-ADJUSTMENT', input.commandId),
      woolOrderId: input.woolOrderId,
      action: 'ADJUST_WOOL_WAREHOUSE_STOCK',
      objectType: 'WOOL_WAREHOUSE_STOCK',
      objectId: sourceRecordId,
      beforeValue: { qty: currentQty },
      afterValue: { qty: input.afterQty },
      operatedAt: input.operatedAt,
      operatedBy,
      remark: reason,
    })
  })
  return committed.warehouseFlows.find((flow) => flow.sourceRecordId === sourceRecordId)!
}

export function transferWoolWarehouseStock(
  input: TransferWoolWarehouseStockInput,
): WoolWarehouseFlow {
  const sourceRecordId = commandRecordId('STOCK-TRANSFER', input.commandId)
  const existing = readWoolStore().warehouseFlows.find((flow) =>
    flow.sourceRecordType === 'STOCK_TRANSFER' && flow.sourceRecordId === sourceRecordId,
  )
  if (existing) return existing
  requirePositive(input.qty, '转移数量')
  const reason = requireText(input.reason, '转移原因')
  const operatedBy = requireText(input.operatedBy, '操作人')
  const toWarehouseId = requireText(input.toWarehouseId, '目标仓库')
  if (!isEnabledPublicWarehouseLocation(toWarehouseId, input.toLocationId)) {
    throw new Error('库存只能转到公共仓库位置主数据中的启用位置')
  }
  const committed = commitWoolStore((draft) => {
    const stockObject = requireStockObject(draft, input)
    const currentQty = stockQty(draft, {
      ...input,
      batchNo: stockObject.batchNo,
    })
    if (input.qty > currentQty) throw new Error('转移数量不能超过默认库位当前库存')
    draft.warehouseFlows.push({
      flowId: `WF-${sourceRecordId}`,
      woolOrderId: input.woolOrderId,
      flowType: 'TRANSFER',
      businessType: 'STOCK_TRANSFER',
      warehouseMode: stockObject.warehouseMode,
      defaultLocationType: stockObject.defaultLocationType,
      defaultLocationId: input.defaultLocationId,
      objectSkuCode: input.objectSkuCode,
      batchNo: stockObject.batchNo,
      qty: input.qty,
      unit: stockObject.unit,
      sourceRecordType: 'STOCK_TRANSFER',
      sourceRecordId,
      fromLocationId: input.defaultLocationId,
      toWarehouseId,
      toLocationId: input.toLocationId,
      reason,
      operatedAt: input.operatedAt,
      operatedBy,
    })
    draft.operationLogs.push({
      operationLogId: commandRecordId('WOOP-STOCK-TRANSFER', input.commandId),
      woolOrderId: input.woolOrderId,
      action: 'TRANSFER_WOOL_WAREHOUSE_STOCK',
      objectType: 'WOOL_WAREHOUSE_STOCK',
      objectId: sourceRecordId,
      beforeValue: { locationId: input.defaultLocationId, qty: currentQty },
      afterValue: { warehouseId: toWarehouseId, locationId: input.toLocationId, qty: input.qty },
      operatedAt: input.operatedAt,
      operatedBy,
      remark: reason,
    })
  })
  return committed.warehouseFlows.find((flow) => flow.sourceRecordId === sourceRecordId)!
}

export function changeWoolFactQty(input: ChangeWoolFactQtyInput): WoolQtyChangeLog {
  const changeId = commandRecordId('WQC', input.commandId)
  const existing = readWoolStore().qtyChangeLogs.find((change) => change.changeId === changeId)
  if (existing) return existing
  requirePositive(input.afterQty, '修改后数量')
  const reason = requireText(input.reason, '修改原因')
  const changedBy = requireText(input.changedBy, '修改人')
  const committed = commitWoolStore((draft) => {
    let woolOrderId = ''
    let objectSkuCode = ''
    let beforeQty = 0
    let qtyUnit: WoolWarehouseFlow['unit'] = 'kg'
    let originalFlow: WoolWarehouseFlow | undefined
    if (input.recordType === 'YARN_RECEIPT') {
      if (!input.recordLineId) throw new Error('接收数量修改必须指定接收明细')
      const receipt = draft.yarnReceipts.find((record) => record.receiptId === input.recordId)
      const line = receipt?.lines.find((item) => item.lineId === input.recordLineId)
      if (!receipt || !line) throw new Error(`找不到接收明细 ${input.recordLineId}`)
      requireUncompleted(draft, receipt.woolOrderId)
      woolOrderId = receipt.woolOrderId
      objectSkuCode = line.yarnSkuCode
      beforeQty = getWoolYarnReceiptLineEffectiveQty(draft, receipt, line)
      originalFlow = draft.warehouseFlows.find((flow) => flow.flowId === line.warehouseInboundFlowId)
      const currentStock = stockQty(draft, {
        woolOrderId,
        objectSkuCode,
        batchNo: receipt.batchNo,
        defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      })
      if (currentStock + input.afterQty - beforeQty < 0) {
        throw new Error('调减后纱线默认库位库存不能小于零')
      }
    } else if (input.recordType === 'PROCESS_REPORT') {
      if (input.recordLineId) throw new Error('加工填报数量修改不得指定接收明细')
      const report = draft.processReports.find((record) => record.reportId === input.recordId)
      if (!report) throw new Error(`找不到加工填报 ${input.recordId}`)
      const order = requireUncompleted(draft, report.woolOrderId)
      const line = requireOutputLine(order, report.outputSkuCode)
      requirePositiveInteger(input.afterQty, '修改后数量')
      woolOrderId = report.woolOrderId
      objectSkuCode = report.outputSkuCode
      qtyUnit = line.qtyUnit
      beforeQty = getWoolProcessReportEffectiveQty(draft, report)
      const otherReportedQty = draft.processReports
        .filter((record) =>
          record.woolOrderId === woolOrderId
          && record.outputSkuCode === objectSkuCode
          && record.reportId !== report.reportId,
        )
        .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(draft, record), 0)
      if (otherReportedQty + input.afterQty > Math.floor(line.plannedQty * 1.5)) {
        throw new Error('累计加工填报不能超过计划数量的 150%')
      }
      const handedOverQty = draft.handovers
        .filter((record) => record.woolOrderId === woolOrderId && record.outputSkuCode === objectSkuCode)
        .reduce((sum, record) => sum + getWoolHandoverEffectiveQty(draft, record), 0)
      if (otherReportedQty + input.afterQty < handedOverQty) {
        throw new Error('累计加工填报不能低于累计交出')
      }
      originalFlow = draft.warehouseFlows.find((flow) => flow.flowId === report.warehouseInboundFlowId)
      const currentStock = stockQty(draft, {
        woolOrderId,
        objectSkuCode,
        defaultLocationId: outputLocation(line).defaultLocationId,
      })
      if (currentStock + input.afterQty - beforeQty < 0) {
        throw new Error('调减后默认库位库存不能小于零')
      }
    } else {
      if (input.recordLineId) throw new Error('交出数量修改不得指定接收明细')
      const handover = draft.handovers.find((record) => record.handoverId === input.recordId)
      if (!handover) throw new Error(`找不到交出记录 ${input.recordId}`)
      const order = requireUncompleted(draft, handover.woolOrderId)
      const line = requireOutputLine(order, handover.outputSkuCode)
      requirePositiveInteger(input.afterQty, '修改后数量')
      if (handover.downstreamReceipt?.status === 'CONFIRMED') {
        throw new Error('下游已确认，交出数量不可修改')
      }
      woolOrderId = handover.woolOrderId
      objectSkuCode = handover.outputSkuCode
      qtyUnit = line.qtyUnit
      beforeQty = getWoolHandoverEffectiveQty(draft, handover)
      originalFlow = draft.warehouseFlows.find((flow) => flow.flowId === handover.warehouseOutboundFlowId)
      const currentStock = stockQty(draft, {
        woolOrderId,
        objectSkuCode,
        defaultLocationId: outputLocation(line).defaultLocationId,
      })
      if (input.afterQty - beforeQty > currentStock) {
        throw new Error('交出增加量不能超过默认库位库存')
      }
    }
    if (!originalFlow) throw new Error('目标事实缺少原始仓库流水')
    if (input.afterQty === beforeQty) throw new Error('修改前后数量不能相同')
    const previousChanges = draft.qtyChangeLogs.filter((change) =>
      change.recordType === input.recordType
      && change.recordId === input.recordId
      && (input.recordType !== 'YARN_RECEIPT' || change.recordLineId === input.recordLineId),
    )
    if (previousChanges.some((change) => change.changedAt > input.changedAt)) {
      throw new Error('数量修改时间不能早于已有修改记录')
    }
    const change: WoolQtyChangeLog = {
      changeId,
      recordType: input.recordType,
      recordId: input.recordId,
      recordLineId: input.recordType === 'YARN_RECEIPT' ? input.recordLineId : undefined,
      objectSkuCode,
      beforeQty,
      afterQty: input.afterQty,
      qtyUnit,
      reason,
      changedAt: input.changedAt,
      changedBy,
    }
    draft.qtyChangeLogs.push(change)
    draft.warehouseFlows.push({
      ...originalFlow,
      flowId: `WF-${changeId}`,
      flowType: 'ADJUSTMENT',
      businessType: 'STOCK_ADJUSTMENT',
      qty: (input.afterQty - beforeQty) * (input.recordType === 'HANDOVER' ? -1 : 1),
      sourceRecordType: 'QTY_CHANGE',
      sourceRecordId: changeId,
      reason,
      operatedAt: input.changedAt,
      operatedBy: changedBy,
    })
  })
  return committed.qtyChangeLogs.find((change) => change.changeId === changeId)!
}

function buildCompletionSnapshot(
  store: WoolDomainStore,
  order: WoolWorkOrder,
  releasedMachineIds: string[],
): WoolCompletionRecord['confirmationSnapshot'] {
  const receipts = store.yarnReceipts.filter((record) => record.woolOrderId === order.woolOrderId)
  const confirmed = confirmedYarnSkus(store, order.woolOrderId)
  const yarnSkus = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))]
  return {
    yarnReceiptSummary: yarnSkus.map((yarnSkuCode) => ({
      yarnSkuCode,
      receivedQty: receipts.reduce((sum, receipt) =>
        sum + receipt.lines
          .filter((line) => line.yarnSkuCode === yarnSkuCode)
          .reduce((lineSum, line) =>
            lineSum + getWoolYarnReceiptLineEffectiveQty(store, receipt, line), 0), 0),
      qtyUnit: 'kg',
    })),
    outputReadinessSummary: order.outputPlanLines.map((line) => ({
      outputSkuCode: line.outputSkuCode,
      requiredYarnSkus: [...line.requiredYarnSkus],
      confirmedYarnSkus: line.requiredYarnSkus.filter((sku) => confirmed.has(sku)),
      missingYarnSkus: line.requiredYarnSkus.filter((sku) => !confirmed.has(sku)),
    })),
    processReportSummary: order.outputPlanLines.map((line) => ({
      outputSkuCode: line.outputSkuCode,
      reportedQty: store.processReports
        .filter((record) =>
          record.woolOrderId === order.woolOrderId && record.outputSkuCode === line.outputSkuCode,
        )
        .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(store, record), 0),
      qtyUnit: line.qtyUnit,
    })),
    handoverSummary: store.handovers
      .filter((record) => record.woolOrderId === order.woolOrderId)
      .map((record) => ({
        handoverId: record.handoverId,
        outputSkuCode: record.outputSkuCode,
        handoverQty: getWoolHandoverEffectiveQty(store, record),
        qtyUnit: record.qtyUnit,
        downstreamActualReceivedQty: record.downstreamReceipt?.actualReceivedQty,
        downstreamDifferenceQty: record.downstreamReceipt?.differenceQty,
        downstreamReceivedAt: record.downstreamReceipt?.receivedAt,
      })),
    waitProcessStockSummary: yarnSkus.map((yarnSkuCode) => ({
      yarnSkuCode,
      stockQty: stockQty(store, {
        woolOrderId: order.woolOrderId,
        objectSkuCode: yarnSkuCode,
        defaultLocationId: 'WOOL-WP-YARN-DEFAULT',
      }),
      qtyUnit: 'kg',
    })),
    waitHandoverStockSummary: order.outputPlanLines.map((line) => ({
      outputSkuCode: line.outputSkuCode,
      stockQty: stockQty(store, {
        woolOrderId: order.woolOrderId,
        objectSkuCode: line.outputSkuCode,
        defaultLocationId: outputLocation(line).defaultLocationId,
      }),
      qtyUnit: line.qtyUnit,
    })),
    releasedMachineIds,
  }
}

function releaseMachineAssociationsForCompletion(
  draft: WoolDomainStore,
  order: WoolWorkOrder,
  input: CompleteWoolWorkOrderInput,
): string[] {
  const released = draft.machineAssociations
    .filter((association) => association.woolOrderId === order.woolOrderId)
    .map((association) => association.machineId)
  draft.machineAssociations = draft.machineAssociations.filter(
    (association) => association.woolOrderId !== order.woolOrderId,
  )
  for (const machineId of released) {
    const machine = draft.machines.find((item) => item.machineId === machineId)!
    machine.status = 'FREE'
    machine.updatedAt = input.completedAt
    draft.machineAssociationLogs.push({
      logId: `${commandRecordId('WMAL-COMPLETE', input.commandId)}-${machineId}`,
      machineId,
      fromWoolOrderId: order.woolOrderId,
      action: 'UNASSOCIATE',
      reason: 'ORDER_COMPLETED',
      operatedAt: input.completedAt,
      operatedBy: input.completedBy,
    })
  }
  if (released.length > 0) {
    draft.operationLogs.push({
      operationLogId: commandRecordId('WOOP-RELEASE-MACHINES', input.commandId),
      woolOrderId: order.woolOrderId,
      action: 'RELEASE_WOOL_MACHINES_FOR_COMPLETION',
      objectType: 'WOOL_MACHINE_ASSOCIATIONS',
      objectId: order.woolOrderId,
      beforeValue: { machineIds: released },
      afterValue: { machineIds: [] },
      operatedAt: input.completedAt,
      operatedBy: input.completedBy,
      remark: '完成加工单，批量解除当前横机关联',
    })
  }
  return released
}

export function completeWoolWorkOrder(
  woolOrderId: string,
  input: CompleteWoolWorkOrderInput,
): WoolCompletionRecord {
  const operationLogId = commandRecordId('WOOP-COMPLETE', input.commandId)
  const current = readWoolStore()
  const existing = current.completions.find((record) => record.woolOrderId === woolOrderId)
  if (existing && current.operationLogs.some((log) => log.operationLogId === operationLogId)) {
    return existing
  }
  if (existing) throw new Error('毛织加工单已完成')
  const completedBy = requireText(input.completedBy, '完成人')
  const committed = commitWoolStore((draft) => {
    const order = requireUncompleted(draft, woolOrderId)
    if (!draft.handovers.some((record) =>
      record.woolOrderId === woolOrderId && getWoolHandoverEffectiveQty(draft, record) > 0,
    )) {
      throw new Error('至少有一条交出记录后才能完成加工单')
    }
    const releasedMachineIds = releaseMachineAssociationsForCompletion(draft, order, {
      ...input,
      completedBy,
    })
    const completion: WoolCompletionRecord = {
      woolOrderId,
      completedAt: input.completedAt,
      completedBy,
      remark: input.remark?.trim() || undefined,
      confirmationSnapshot: buildCompletionSnapshot(draft, order, releasedMachineIds),
    }
    draft.completions.push(completion)
    order.updatedAt = input.completedAt
    order.updatedBy = completedBy
    draft.operationLogs.push({
      operationLogId,
      woolOrderId,
      action: 'COMPLETE_WOOL_WORK_ORDER',
      objectType: 'WOOL_WORK_ORDER',
      objectId: woolOrderId,
      afterValue: {
        completedAt: input.completedAt,
        releasedMachineIds,
        confirmationSnapshot: completion.confirmationSnapshot,
      },
      operatedAt: input.completedAt,
      operatedBy: completedBy,
      remark: completion.remark,
    })
  })
  return committed.completions.find((record) => record.woolOrderId === woolOrderId)!
}
