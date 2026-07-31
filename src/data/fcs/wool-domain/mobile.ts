import type { ProcessTask } from '../process-tasks.ts'
import {
  getWoolHandoverEffectiveQty,
  getWoolProcessReportEffectiveQty,
  getWoolYarnReceiptLineEffectiveQty,
  type WoolAllowedAction,
} from './queries.ts'
import { readWoolStore } from './store.ts'
import type {
  WoolHandoverRecord,
  WoolOutputPlanLine,
  WoolQtyChangeLog,
  WoolWarehouseFlow,
  WoolWorkOrder,
} from './types.ts'
import { getWoolWarehouseLedgerBalance } from './warehouse-ledger.ts'

export interface WoolMobileQtyChangeFact {
  changeId: string
  recordType: WoolQtyChangeLog['recordType']
  recordId: string
  recordLineId?: string
  objectSkuCode: string
  beforeQty: number
  afterQty: number
  qtyUnit: WoolQtyChangeLog['qtyUnit']
  reason: string
  changedAt: string
  changedBy: string
}

export interface WoolMobileFactRecord {
  recordType: 'YARN_RECEIPT' | 'PROCESS_REPORT' | 'HANDOVER' | 'QTY_CHANGE' | 'WAREHOUSE_FLOW'
  recordId: string
  recordLineId?: string
  objectSkuCode: string
  originalQty?: number
  effectiveQty?: number
  qtyUnit: string
  occurredAt: string
  operatedBy: string
  batchNo?: string
  deliveryNo?: string
  proofFiles: string[]
  remark?: string
  differenceNote?: string
  receiverName?: string
  downstreamActualReceivedQty?: number
  downstreamDifferenceQty?: number
  downstreamReceivedAt?: string
  warehouseFlowIds: string[]
  qtyChanges: WoolMobileQtyChangeFact[]
  flow?: WoolWarehouseFlow
}

export interface WoolMobileCompletionFacts {
  yarnReceipts: Array<{
    yarnSkuCode: string
    effectiveReceivedQty: number
    qtyUnit: 'kg'
    batchNos: string[]
    latestReceivedAt?: string
  }>
  processReports: Array<{
    outputSkuCode: string
    plannedQty: number
    reportLimitQty: number
    effectiveReportedQty: number
    differenceFromPlanQty: number
    qtyUnit: '件' | '片'
  }>
  handovers: Array<{
    handoverId: string
    outputSkuCode: string
    originalQty: number
    effectiveQty: number
    qtyUnit: '件' | '片'
    receiverName: string
    downstreamActualReceivedQty?: number
    downstreamDifferenceQty?: number
    downstreamReceivedAt?: string
  }>
  waitHandoverStocks: Array<{
    outputSkuCode: string
    outputObjectType: WoolOutputPlanLine['outputObjectType']
    defaultLocationId: 'WOOL-WH-CUT-DEFAULT' | 'WOOL-WH-GARMENT-DEFAULT'
    effectiveStockQty: number
    qtyUnit: '件' | '片'
  }>
  currentMachines: Array<{
    machineId: string
    machineNo: string
    machineName: string
    associatedAt: string
  }>
  completionSnapshot?: ReturnType<typeof readWoolStore>['completions'][number]['confirmationSnapshot']
}

export interface WoolMobileTaskProjection {
  woolOrderId: string
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  processingStatus: 'UNPROCESSED' | 'PROCESSING' | 'COMPLETED'
  processingStatusLabel: '未加工' | '加工中' | '已完成'
  allowedActions: WoolAllowedAction[]
  requiredYarnSkus: string[]
  confirmedYarnSkus: string[]
  missingYarnSkus: string[]
  readyOutputSkuCodes: string[]
  factRecords: WoolMobileFactRecord[]
  completionFacts: WoolMobileCompletionFacts
}

const STATUS_LABELS: Record<WoolMobileTaskProjection['processingStatus'], WoolMobileTaskProjection['processingStatusLabel']> = {
  UNPROCESSED: '未加工',
  PROCESSING: '加工中',
  COMPLETED: '已完成',
}

function qtyChangesFor(
  allChanges: WoolQtyChangeLog[],
  recordType: WoolQtyChangeLog['recordType'],
  recordId: string,
  recordLineId?: string,
): WoolMobileQtyChangeFact[] {
  return allChanges
    .filter((change) =>
      change.recordType === recordType
      && change.recordId === recordId
      && (recordType !== 'YARN_RECEIPT' || change.recordLineId === recordLineId),
    )
    .sort((left, right) =>
      left.changedAt.localeCompare(right.changedAt) || left.changeId.localeCompare(right.changeId),
    )
    .map((change) => ({ ...change }))
}

function flowsForRecord(
  flows: WoolWarehouseFlow[],
  recordIds: string[],
): WoolWarehouseFlow[] {
  const ids = new Set(recordIds)
  return flows.filter((flow) => ids.has(flow.sourceRecordId))
}

function buildFactRecords(
  store: ReturnType<typeof readWoolStore>,
  order: WoolWorkOrder,
): WoolMobileFactRecord[] {
  const receiptFacts = store.yarnReceipts
    .filter((receipt) => receipt.woolOrderId === order.woolOrderId)
    .flatMap((receipt) => receipt.lines.map((line): WoolMobileFactRecord => {
      const qtyChanges = qtyChangesFor(
        store.qtyChangeLogs,
        'YARN_RECEIPT',
        receipt.receiptId,
        line.lineId,
      )
      const flows = flowsForRecord(store.warehouseFlows, [
        line.lineId,
        receipt.receiptId,
        line.warehouseInboundFlowId,
      ])
      return {
        recordType: 'YARN_RECEIPT',
        recordId: receipt.receiptId,
        recordLineId: line.lineId,
        objectSkuCode: line.yarnSkuCode,
        originalQty: line.receivedQty,
        effectiveQty: getWoolYarnReceiptLineEffectiveQty(store, receipt, line),
        qtyUnit: line.qtyUnit,
        occurredAt: receipt.receivedAt,
        operatedBy: receipt.receivedBy,
        batchNo: receipt.batchNo,
        deliveryNo: receipt.deliveryNo,
        proofFiles: [...(receipt.proofFiles ?? [])],
        remark: receipt.remark,
        differenceNote: line.differenceNote,
        warehouseFlowIds: flows.map((flow) => flow.flowId),
        qtyChanges,
      }
    }))
  const reportFacts = store.processReports
    .filter((record) => record.woolOrderId === order.woolOrderId)
    .map((record): WoolMobileFactRecord => {
      const flows = flowsForRecord(store.warehouseFlows, [
        record.reportId,
        record.warehouseInboundFlowId,
      ])
      return {
        recordType: 'PROCESS_REPORT',
        recordId: record.reportId,
        objectSkuCode: record.outputSkuCode,
        originalQty: record.reportedQty,
        effectiveQty: getWoolProcessReportEffectiveQty(store, record),
        qtyUnit: order.outputPlanLines.find((line) =>
          line.outputSkuCode === record.outputSkuCode)?.qtyUnit ?? '件',
        occurredAt: record.reportedAt,
        operatedBy: record.reportedBy,
        proofFiles: [...(record.proofFiles ?? [])],
        remark: record.remark,
        warehouseFlowIds: flows.map((flow) => flow.flowId),
        qtyChanges: qtyChangesFor(store.qtyChangeLogs, 'PROCESS_REPORT', record.reportId),
      }
    })
  const handoverFacts = store.handovers
    .filter((record) => record.woolOrderId === order.woolOrderId)
    .map((record): WoolMobileFactRecord => {
      const flows = flowsForRecord(store.warehouseFlows, [
        record.handoverId,
        record.warehouseOutboundFlowId,
      ])
      return {
        recordType: 'HANDOVER',
        recordId: record.handoverId,
        objectSkuCode: record.outputSkuCode,
        originalQty: record.handoverQty,
        effectiveQty: getWoolHandoverEffectiveQty(store, record),
        qtyUnit: record.qtyUnit,
        occurredAt: record.handedOverAt,
        operatedBy: record.handedOverBy,
        proofFiles: [...(record.proofFiles ?? [])],
        remark: record.remark,
        receiverName: record.receiverName,
        downstreamActualReceivedQty: record.downstreamReceipt?.actualReceivedQty,
        downstreamDifferenceQty: record.downstreamReceipt?.differenceQty,
        downstreamReceivedAt: record.downstreamReceipt?.receivedAt,
        warehouseFlowIds: flows.map((flow) => flow.flowId),
        qtyChanges: qtyChangesFor(store.qtyChangeLogs, 'HANDOVER', record.handoverId),
      }
    })
  const qtyChangeFacts = store.qtyChangeLogs
    .filter((change) => {
      if (change.recordType === 'YARN_RECEIPT') {
        return store.yarnReceipts.some((receipt) =>
          receipt.woolOrderId === order.woolOrderId
          && receipt.receiptId === change.recordId
          && (!change.recordLineId || receipt.lines.some((line) => line.lineId === change.recordLineId)),
        )
      }
      if (change.recordType === 'PROCESS_REPORT') {
        return store.processReports.some((record) =>
          record.woolOrderId === order.woolOrderId && record.reportId === change.recordId,
        )
      }
      return store.handovers.some((record) =>
        record.woolOrderId === order.woolOrderId && record.handoverId === change.recordId,
      )
    })
    .map((change): WoolMobileFactRecord => ({
      recordType: 'QTY_CHANGE',
      recordId: change.changeId,
      recordLineId: change.recordLineId,
      objectSkuCode: change.objectSkuCode,
      originalQty: change.beforeQty,
      effectiveQty: change.afterQty,
      qtyUnit: change.qtyUnit,
      occurredAt: change.changedAt,
      operatedBy: change.changedBy,
      proofFiles: [],
      remark: change.reason,
      warehouseFlowIds: [],
      qtyChanges: [{ ...change }],
    }))
  const flowFacts = store.warehouseFlows
    .filter((flow) => flow.woolOrderId === order.woolOrderId)
    .map((flow): WoolMobileFactRecord => ({
      recordType: 'WAREHOUSE_FLOW',
      recordId: flow.flowId,
      objectSkuCode: flow.objectSkuCode,
      originalQty: flow.qty,
      effectiveQty: flow.qty,
      qtyUnit: flow.unit,
      occurredAt: flow.operatedAt,
      operatedBy: flow.operatedBy,
      batchNo: flow.batchNo,
      proofFiles: [],
      remark: flow.reason,
      warehouseFlowIds: [flow.flowId],
      qtyChanges: [],
      flow: { ...flow },
    }))
  return [
    ...receiptFacts,
    ...reportFacts,
    ...handoverFacts,
    ...qtyChangeFacts,
    ...flowFacts,
  ].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt) || left.recordId.localeCompare(right.recordId),
  )
}

function buildCompletionFacts(
  store: ReturnType<typeof readWoolStore>,
  order: WoolWorkOrder,
): WoolMobileCompletionFacts {
  const requiredYarnSkus = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))]
  const yarnReceipts = requiredYarnSkus.map((yarnSkuCode) => {
    const effectiveLines = store.yarnReceipts
      .filter((receipt) => receipt.woolOrderId === order.woolOrderId)
      .flatMap((receipt) => receipt.lines
        .filter((line) => line.yarnSkuCode === yarnSkuCode)
        .map((line) => ({
          qty: getWoolYarnReceiptLineEffectiveQty(store, receipt, line),
          batchNo: receipt.batchNo,
          receivedAt: receipt.receivedAt,
        })))
      .filter((item) => item.qty > 0)
    return {
      yarnSkuCode,
      effectiveReceivedQty: effectiveLines.reduce((sum, item) => sum + item.qty, 0),
      qtyUnit: 'kg' as const,
      batchNos: [...new Set(effectiveLines.map((item) => item.batchNo).filter((value): value is string => Boolean(value)))],
      latestReceivedAt: effectiveLines
        .map((item) => item.receivedAt)
        .sort((left, right) => right.localeCompare(left))[0],
    }
  })
  const processReports = order.outputPlanLines.map((line) => {
    const effectiveReportedQty = store.processReports
      .filter((record) =>
        record.woolOrderId === order.woolOrderId && record.outputSkuCode === line.outputSkuCode,
      )
      .reduce((sum, record) => sum + getWoolProcessReportEffectiveQty(store, record), 0)
    return {
      outputSkuCode: line.outputSkuCode,
      plannedQty: line.plannedQty,
      reportLimitQty: Math.floor(line.plannedQty * 1.5),
      effectiveReportedQty,
      differenceFromPlanQty: effectiveReportedQty - line.plannedQty,
      qtyUnit: line.qtyUnit,
    }
  })
  const handovers = store.handovers
    .filter((record) => record.woolOrderId === order.woolOrderId)
    .map((record: WoolHandoverRecord) => ({
      handoverId: record.handoverId,
      outputSkuCode: record.outputSkuCode,
      originalQty: record.handoverQty,
      effectiveQty: getWoolHandoverEffectiveQty(store, record),
      qtyUnit: record.qtyUnit,
      receiverName: record.receiverName,
      downstreamActualReceivedQty: record.downstreamReceipt?.actualReceivedQty,
      downstreamDifferenceQty: record.downstreamReceipt?.differenceQty,
      downstreamReceivedAt: record.downstreamReceipt?.receivedAt,
    }))
    .sort((left, right) => left.handoverId.localeCompare(right.handoverId))
  const waitHandoverStocks = order.outputPlanLines.map((line) => {
    const defaultLocationId = line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT' as const
      : 'WOOL-WH-CUT-DEFAULT' as const
    return {
      outputSkuCode: line.outputSkuCode,
      outputObjectType: line.outputObjectType,
      defaultLocationId,
      effectiveStockQty: getWoolWarehouseLedgerBalance(store.warehouseFlows, {
        woolOrderId: order.woolOrderId,
        objectSkuCode: line.outputSkuCode,
        defaultLocationId,
      }),
      qtyUnit: line.qtyUnit,
    }
  })
  const currentMachines = store.machineAssociations
    .filter((association) => association.woolOrderId === order.woolOrderId)
    .map((association) => {
      const machine = store.machines.find((item) => item.machineId === association.machineId)
      return {
        machineId: association.machineId,
        machineNo: machine?.machineNo ?? association.machineId,
        machineName: machine?.machineName ?? '设备档案缺失',
        associatedAt: association.associatedAt,
      }
    })
  return {
    yarnReceipts,
    processReports,
    handovers,
    waitHandoverStocks,
    currentMachines,
    completionSnapshot: store.completions.find((item) =>
      item.woolOrderId === order.woolOrderId)?.confirmationSnapshot,
  }
}

export function buildWoolMobileTaskProjection(
  woolOrderId: string,
): WoolMobileTaskProjection {
  const store = readWoolStore()
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  const completionFacts = buildCompletionFacts(store, order)
  const confirmedYarnSkus = completionFacts.yarnReceipts
    .filter((item) => item.effectiveReceivedQty > 0)
    .map((item) => item.yarnSkuCode)
  const confirmedSet = new Set(confirmedYarnSkus)
  const requiredYarnSkus = completionFacts.yarnReceipts.map((item) => item.yarnSkuCode)
  const missingYarnSkus = requiredYarnSkus.filter((sku) => !confirmedSet.has(sku))
  const completion = store.completions.find((item) => item.woolOrderId === woolOrderId)
  const processingStatus: WoolMobileTaskProjection['processingStatus'] = completion
    ? 'COMPLETED'
    : store.processReports.some((item) => item.woolOrderId === woolOrderId)
      ? 'PROCESSING'
      : 'UNPROCESSED'
  const readyOutputSkuCodes = order.outputPlanLines
    .filter((line) => line.requiredYarnSkus.every((sku) => confirmedSet.has(sku)))
    .filter((line) => {
      const summary = completionFacts.processReports.find((item) =>
        item.outputSkuCode === line.outputSkuCode)
      return Boolean(summary && summary.effectiveReportedQty < summary.reportLimitQty)
    })
    .map((line) => line.outputSkuCode)
  const actions: WoolAllowedAction[] = ['DETAIL']
  if (!completion) {
    actions.push('RECEIVE_YARN')
    if (readyOutputSkuCodes.length > 0) actions.push('REPORT_PROCESS')
    const hasAvailableHandover = completionFacts.waitHandoverStocks.some((item) =>
      item.effectiveStockQty > 0,
    )
    if (hasAvailableHandover) actions.push('HANDOVER')
    if (readyOutputSkuCodes.length > 0 || completionFacts.currentMachines.length > 0) {
      actions.push('ASSOCIATE_MACHINE')
    }
    if (completionFacts.handovers.some((item) => item.effectiveQty > 0)) actions.push('COMPLETE')
  }
  return {
    woolOrderId: order.woolOrderId,
    taskId: order.taskId,
    taskNo: order.taskNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    processingStatus,
    processingStatusLabel: STATUS_LABELS[processingStatus],
    allowedActions: actions,
    requiredYarnSkus,
    confirmedYarnSkus,
    missingYarnSkus,
    readyOutputSkuCodes,
    factRecords: buildFactRecords(store, order),
    completionFacts,
  }
}

function buildWoolMobileTask(order: WoolWorkOrder, index: number): ProcessTask {
  const projection = buildWoolMobileTaskProjection(order.woolOrderId)
  const totalPlannedQty = order.outputPlanLines.reduce((sum, line) => sum + line.plannedQty, 0)
  const qtyUnit = order.outputPlanLines[0]?.qtyUnit || (order.kind === 'PART_PANEL' ? '片' : '件')
  const status: ProcessTask['status'] = projection.processingStatus === 'COMPLETED'
    ? 'DONE'
    : projection.processingStatus === 'PROCESSING'
      ? 'IN_PROGRESS'
      : 'NOT_STARTED'
  return {
    taskId: order.taskId,
    taskNo: order.taskNo,
    rootTaskNo: order.woolOrderNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    seq: index + 1,
    processCode: 'PROC_WOOL',
    processNameZh: '毛织',
    processBusinessCode: 'WOOL',
    processBusinessName: '毛织',
    stage: 'SPECIAL',
    qty: totalPlannedQty,
    qtyUnit: qtyUnit as ProcessTask['qtyUnit'],
    qtyDisplayUnit: qtyUnit,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: order.factoryId,
    assignedFactoryName: order.factoryName,
    qcPoints: [],
    attachments: [],
    status,
    taskDeadline: order.plannedCompletionAt,
    dispatchedAt: order.plannedStartAt || order.createdAt,
    dispatchedBy: order.createdBy,
    finishedAt: projection.processingStatus === 'COMPLETED' ? order.updatedAt : undefined,
    receiverId: order.downstreamTarget.receiverId,
    receiverName: order.downstreamTarget.receiverName,
    woolOrderId: order.woolOrderId,
    woolProcessingStatus: projection.processingStatus,
    woolAllowedActions: [...projection.allowedActions],
    woolRequiredYarnSkus: [...projection.requiredYarnSkus],
    woolConfirmedYarnSkus: [...projection.confirmedYarnSkus],
    woolMissingYarnSkus: [...projection.missingYarnSkus],
    woolReadyOutputSkuCodes: [...projection.readyOutputSkuCodes],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    auditLogs: [],
  } as ProcessTask
}

export function listWoolMobileProcessTasks(): ProcessTask[] {
  const store = readWoolStore()
  return Object.values(store.workOrders)
    .sort((left, right) => left.woolOrderNo.localeCompare(right.woolOrderNo))
    .map(buildWoolMobileTask)
}
