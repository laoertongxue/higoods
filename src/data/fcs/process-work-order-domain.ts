import {
  getPrintOrderHandoverRecords,
  getPrintReviewRecordByOrderId,
  getPrintWorkOrderById,
  getPrintWorkOrderStatusLabel,
  listPrintExecutionNodeRecords,
  listPrintWorkOrders,
  type PrintExecutionNodeRecord,
  type PrintReviewRecord,
  type PrintWorkOrder,
  type PrintWorkOrderStatus,
} from './printing-task-domain.ts'
import {
  getDyeOrderHandoverRecords,
  getDyeReviewRecordByOrderId,
  getDyeWorkOrderById,
  getDyeWorkOrderStatusLabel,
  listDyeExecutionNodeRecords,
  listDyeFormulaRecords,
  listDyeWorkOrders,
  type DyeExecutionNodeRecord,
  type DyeFormulaRecord,
  type DyeReviewRecord,
  type DyeWorkOrder,
  type DyeWorkOrderStatus,
} from './dyeing-task-domain.ts'
import type { PdaHandoverRecord } from './pda-handover-events.ts'
import {
  getProcessObjectType,
  getQuantityLabel,
} from './process-quantity-labels.ts'

export type ProcessWorkOrderType = 'PRINT' | 'DYE'
export type ProcessWorkOrderStatus = PrintWorkOrderStatus | DyeWorkOrderStatus

export interface ProcessWorkOrder {
  workOrderId: string
  workOrderNo: string
  processType: ProcessWorkOrderType
  sourceDemandIds: string[]
  productionOrderIds: string[]
  factoryId: string
  factoryName: string
  objectType?: string
  qtyLabel?: string
  isPiecePrinting?: boolean
  isFabricPrinting?: boolean
  plannedQty: number
  plannedUnit: string
  assignmentMode: '派单'
  assignmentModeEditable: false
  dispatchPrice: number
  dispatchPriceCurrency: 'IDR'
  dispatchPriceUnit: 'Yard'
  dispatchPriceDisplay: string
  materialSku: string
  materialName: string
  materialBatchNos: string[]
  status: ProcessWorkOrderStatus
  statusLabel: string
  taskId: string
  taskNo: string
  taskQrValue: string
  handoverOrderId?: string
  handoverOrderNo?: string
  reviewRecordId?: string
  printPayload?: {
    printOrderId: string
    printOrderNo: string
    patternNo: string
    patternVersion: string
    materialColor?: string
    plannedRollCount?: number
    targetTransferWarehouseName: string
    isFirstOrder: boolean
    remark?: string
  }
  dyePayload?: {
    dyeOrderId: string
    dyeOrderNo: string
    isFirstOrder: boolean
    sampleWaitType: string
    sampleStatus: string
    rawMaterialSku: string
    composition?: string
    width?: string
    weightGsm?: number
    targetColor: string
    colorNo?: string
    plannedRollCount?: number
    targetTransferWarehouseName: string
    formulaRecords: DyeFormulaRecord[]
    remark?: string
  }
  executionNodes: Array<PrintExecutionNodeRecord | DyeExecutionNodeRecord>
  reviewRecords: Array<PrintReviewRecord | DyeReviewRecord>
  handoverRecords: PdaHandoverRecord[]
  createdAt: string
  updatedAt: string
}

function cloneHandoverRecords(records: PdaHandoverRecord[]): PdaHandoverRecord[] {
  return records.map((record) => ({ ...record, recordLines: record.recordLines?.map((line) => ({ ...line })) }))
}

function mapPrintWorkOrder(order: PrintWorkOrder): ProcessWorkOrder {
  const review = getPrintReviewRecordByOrderId(order.printOrderId)
  const quantityContext = {
    processType: 'PRINT',
    sourceType: 'PRINT_WORK_ORDER',
    sourceId: order.printOrderId,
    objectType: order.objectType,
    qtyUnit: order.qtyUnit,
    qtyPurpose: '计划' as const,
    isPiecePrinting: order.isPiecePrinting,
    isFabricPrinting: order.isFabricPrinting,
  }
  return {
    workOrderId: order.printOrderId,
    workOrderNo: order.printOrderNo,
    processType: 'PRINT',
    sourceDemandIds: [...order.sourceDemandIds],
    productionOrderIds: [...order.productionOrderIds],
    factoryId: order.printFactoryId,
    factoryName: order.printFactoryName,
    objectType: getProcessObjectType(quantityContext),
    qtyLabel: order.qtyLabel || getQuantityLabel(quantityContext),
    isPiecePrinting: getProcessObjectType(quantityContext) === '裁片',
    isFabricPrinting: getProcessObjectType(quantityContext) === '面料',
    plannedQty: order.plannedQty,
    plannedUnit: order.qtyUnit,
    assignmentMode: order.assignmentMode,
    assignmentModeEditable: order.assignmentModeEditable,
    dispatchPrice: order.dispatchPrice,
    dispatchPriceCurrency: order.dispatchPriceCurrency,
    dispatchPriceUnit: order.dispatchPriceUnit,
    dispatchPriceDisplay: order.dispatchPriceDisplay,
    materialSku: order.materialSku,
    materialName: order.materialColor ? `${order.materialSku} / ${order.materialColor}` : order.materialSku,
    materialBatchNos: order.sourceDemandIds,
    status: order.status,
    statusLabel: getPrintWorkOrderStatusLabel(order.status),
    taskId: order.taskId,
    taskNo: order.taskNo,
    taskQrValue: order.taskQrValue,
    handoverOrderId: order.handoverOrderId,
    handoverOrderNo: order.handoverOrderNo,
    reviewRecordId: review?.reviewRecordId,
    printPayload: {
      printOrderId: order.printOrderId,
      printOrderNo: order.printOrderNo,
      patternNo: order.patternNo,
      patternVersion: order.patternVersion,
      materialColor: order.materialColor,
      plannedRollCount: order.plannedRollCount,
      targetTransferWarehouseName: order.targetTransferWarehouseName,
      isFirstOrder: order.isFirstOrder,
      remark: order.remark,
    },
    executionNodes: listPrintExecutionNodeRecords(order.printOrderId),
    reviewRecords: review ? [review] : [],
    handoverRecords: cloneHandoverRecords(getPrintOrderHandoverRecords(order.printOrderId)),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

function mapDyeWorkOrder(order: DyeWorkOrder): ProcessWorkOrder {
  const review = getDyeReviewRecordByOrderId(order.dyeOrderId)
  const quantityContext = {
    processType: 'DYE',
    sourceType: 'DYE_WORK_ORDER',
    sourceId: order.dyeOrderId,
    objectType: '面料',
    qtyUnit: order.qtyUnit,
    qtyPurpose: '计划' as const,
  }
  return {
    workOrderId: order.dyeOrderId,
    workOrderNo: order.dyeOrderNo,
    processType: 'DYE',
    sourceDemandIds: [...order.sourceDemandIds],
    productionOrderIds: [...(order.productionOrderIds || [])],
    factoryId: order.dyeFactoryId,
    factoryName: order.dyeFactoryName,
    objectType: getProcessObjectType(quantityContext),
    qtyLabel: getQuantityLabel(quantityContext),
    plannedQty: order.plannedQty,
    plannedUnit: order.qtyUnit,
    assignmentMode: order.assignmentMode,
    assignmentModeEditable: order.assignmentModeEditable,
    dispatchPrice: order.dispatchPrice,
    dispatchPriceCurrency: order.dispatchPriceCurrency,
    dispatchPriceUnit: order.dispatchPriceUnit,
    dispatchPriceDisplay: order.dispatchPriceDisplay,
    materialSku: order.rawMaterialSku,
    materialName: order.composition ? `${order.rawMaterialSku} / ${order.composition}` : order.rawMaterialSku,
    materialBatchNos: order.sourceDemandIds,
    status: order.status,
    statusLabel: getDyeWorkOrderStatusLabel(order.status),
    taskId: order.taskId,
    taskNo: order.taskNo,
    taskQrValue: order.taskQrValue,
    handoverOrderId: order.handoverOrderId,
    handoverOrderNo: order.handoverOrderNo,
    reviewRecordId: review?.reviewRecordId,
    dyePayload: {
      dyeOrderId: order.dyeOrderId,
      dyeOrderNo: order.dyeOrderNo,
      isFirstOrder: order.isFirstOrder,
      sampleWaitType: order.sampleWaitType,
      sampleStatus: order.sampleStatus,
      rawMaterialSku: order.rawMaterialSku,
      composition: order.composition,
      width: order.width,
      weightGsm: order.weightGsm,
      targetColor: order.targetColor,
      colorNo: order.colorNo,
      plannedRollCount: order.plannedRollCount,
      targetTransferWarehouseName: order.targetTransferWarehouseName,
      formulaRecords: listDyeFormulaRecords().filter((formula) => formula.dyeOrderId === order.dyeOrderId),
      remark: order.remark,
    },
    executionNodes: listDyeExecutionNodeRecords(order.dyeOrderId),
    reviewRecords: review ? [review] : [],
    handoverRecords: cloneHandoverRecords(getDyeOrderHandoverRecords(order.dyeOrderId)),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

export function listProcessWorkOrders(processType?: ProcessWorkOrderType): ProcessWorkOrder[] {
  const printOrders = processType === 'DYE' ? [] : listPrintWorkOrders().map(mapPrintWorkOrder)
  const dyeOrders = processType === 'PRINT' ? [] : listDyeWorkOrders().map(mapDyeWorkOrder)
  return [...printOrders, ...dyeOrders].sort((left, right) => left.workOrderNo.localeCompare(right.workOrderNo))
}

export function getProcessWorkOrderById(workOrderId: string): ProcessWorkOrder | undefined {
  const printOrder = getPrintWorkOrderById(workOrderId)
  if (printOrder) return mapPrintWorkOrder(printOrder)
  const dyeOrder = getDyeWorkOrderById(workOrderId)
  if (dyeOrder) return mapDyeWorkOrder(dyeOrder)
  return undefined
}

export function getProcessWorkOrderByNo(workOrderNo: string): ProcessWorkOrder | undefined {
  return listProcessWorkOrders().find((order) => order.workOrderNo === workOrderNo)
}

export function getProcessWorkOrderStatusLabel(order: ProcessWorkOrder): string {
  return order.statusLabel
}
