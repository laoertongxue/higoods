import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { getPrintWorkOrderById } from './printing-task-domain.ts'
import { getDyeWorkOrderById } from './dyeing-task-domain.ts'
import { cutPieceOrderRecords, type CutPieceOrderRecord } from './cutting/cut-piece-orders.ts'
import { buildFcsCuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import type { GeneratedOriginalCutOrderSourceRecord } from './cutting/generated-original-cut-orders.ts'
import { listGeneratedFeiTicketsByOriginalCutOrderId } from './cutting/generated-fei-tickets.ts'
import {
  getSpecialCraftTaskWorkOrderById,
} from './special-craft-task-orders.ts'
import {
  applySpecialCraftDifferenceToFeiTickets,
  createProcessHandoverDifferenceRecord,
  createProcessHandoverRecord,
  createWaitHandoverWarehouseRecord,
  createWaitProcessWarehouseRecord,
  getProcessHandoverDifferenceRecordById,
  getProcessHandoverRecordById,
  getProcessWarehouseRecordById,
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  type ProcessHandoverRecord,
  type ProcessWarehouseCraftType,
  type ProcessWarehouseObjectType,
  type ProcessWarehouseRecord,
} from './process-warehouse-domain.ts'
import {
  validateCuttingOrderMobileTaskBinding,
  validateDyeWorkOrderMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
  validateSpecialCraftMobileTaskBinding,
} from './process-mobile-task-binding.ts'
import { mapCraftStatusToPlatformStatus } from './process-platform-status-adapter.ts'

export interface ProcessWarehouseLinkageActionResult {
  success: boolean
  sourceChannel?: 'Web 端' | '移动端'
  sourceType: 'PRINT' | 'DYE' | 'CUTTING' | 'SPECIAL_CRAFT'
  sourceId: string
  taskId: string
  actionCode: string
  actionLabel?: string
  previousStatus: string
  nextStatus: string
  objectType?: string
  objectQty?: number
  qtyUnit?: string
  affectedWarehouseRecordId?: string
  affectedHandoverRecordId?: string
  affectedReviewRecordId?: string
  affectedDifferenceRecordId?: string
  platformStatusAfter?: string
  message?: string
}

export interface ProcessWarehouseLinkageResult {
  success: boolean
  sourceType: string
  sourceId: string
  taskId: string
  actionCode: string
  previousStatus: string
  nextStatus: string
  createdWaitProcessWarehouseRecordId: string
  updatedWaitProcessWarehouseRecordId: string
  createdWaitHandoverWarehouseRecordId: string
  updatedWaitHandoverWarehouseRecordId: string
  createdHandoverRecordId: string
  updatedHandoverRecordId: string
  createdReviewRecordId: string
  updatedReviewRecordId: string
  createdDifferenceRecordId: string
  updatedDifferenceRecordId: string
  updatedFeiTicketIds: string[]
  platformStatusAfter: string
  message: string
}

interface WarehouseBaseContext {
  craftType: ProcessWarehouseCraftType
  craftName: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceDemandId: string
  sourceDemandNo: string
  sourceFactoryId: string
  sourceFactoryName: string
  targetFactoryId: string
  targetFactoryName: string
  targetWarehouseName: string
  warehouseLocation: string
  skuSummary: string
  materialSku: string
  materialName: string
  batchNo: string
  objectType: ProcessWarehouseObjectType
  plannedObjectQty: number
  objectQty: number
  qtyUnit: string
  packageQty: number
  packageUnit: string
  relatedFeiTicketIds: string[]
}

function emptyLinkageResult(actionResult: ProcessWarehouseLinkageActionResult, message = '当前动作不需要仓交出联动'): ProcessWarehouseLinkageResult {
  return {
    success: true,
    sourceType: actionResult.sourceType,
    sourceId: actionResult.sourceId,
    taskId: actionResult.taskId,
    actionCode: actionResult.actionCode,
    previousStatus: actionResult.previousStatus,
    nextStatus: actionResult.nextStatus,
    createdWaitProcessWarehouseRecordId: '',
    updatedWaitProcessWarehouseRecordId: '',
    createdWaitHandoverWarehouseRecordId: '',
    updatedWaitHandoverWarehouseRecordId: '',
    createdHandoverRecordId: '',
    updatedHandoverRecordId: '',
    createdReviewRecordId: '',
    updatedReviewRecordId: '',
    createdDifferenceRecordId: '',
    updatedDifferenceRecordId: '',
    updatedFeiTicketIds: [],
    platformStatusAfter: actionResult.platformStatusAfter || derivePlatformStatus(actionResult),
    message,
  }
}

function roundQty(value: number | undefined): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function derivePlatformStatus(actionResult: ProcessWarehouseLinkageActionResult): string {
  return mapCraftStatusToPlatformStatus({
    sourceType: actionResult.sourceType,
    sourceId: actionResult.sourceId,
    processType: actionResult.sourceType,
    craftStatusCode: actionResult.nextStatus,
    craftStatusLabel: actionResult.nextStatus,
  }).platformStatusLabel
}

function mergeResult(
  base: ProcessWarehouseLinkageResult,
  patch: Partial<ProcessWarehouseLinkageResult>,
): ProcessWarehouseLinkageResult {
  return {
    ...base,
    ...patch,
    updatedFeiTicketIds: [...new Set([...(base.updatedFeiTicketIds || []), ...(patch.updatedFeiTicketIds || [])])],
  }
}

function resolvePrintContext(actionResult: ProcessWarehouseLinkageActionResult): WarehouseBaseContext | null {
  const order = getPrintWorkOrderById(actionResult.sourceId)
  if (!order) return null
  const binding = validatePrintWorkOrderMobileTaskBinding(order.printOrderId)
  const isCutPiece = actionResult.objectType === '裁片' || order.qtyUnit === '片' || order.objectType === '裁片'
  const objectQty = roundQty(actionResult.objectQty || order.plannedQty)
  return {
    craftType: 'PRINT',
    craftName: '印花',
    sourceWorkOrderId: order.printOrderId,
    sourceWorkOrderNo: order.printOrderNo,
    sourceTaskId: binding.actualTaskId || order.taskId,
    sourceTaskNo: binding.actualTaskNo || order.taskNo,
    sourceProductionOrderId: order.productionOrderIds[0] || '',
    sourceProductionOrderNo: order.productionOrderIds[0] || '',
    sourceDemandId: order.sourceDemandIds[0] || '',
    sourceDemandNo: order.sourceDemandIds[0] || '',
    sourceFactoryId: order.printFactoryId,
    sourceFactoryName: order.printFactoryName,
    targetFactoryId: order.targetTransferWarehouseId || TEST_FACTORY_ID,
    targetFactoryName: order.targetTransferWarehouseName || TEST_FACTORY_NAME,
    targetWarehouseName: '印花待交出仓',
    warehouseLocation: '印花待交出仓-A01',
    skuSummary: order.materialSku,
    materialSku: order.materialSku,
    materialName: isCutPiece ? '印花裁片' : '印花面料',
    batchNo: '',
    objectType: isCutPiece ? '裁片' : '面料',
    plannedObjectQty: roundQty(order.plannedQty),
    objectQty,
    qtyUnit: actionResult.qtyUnit || order.qtyUnit || (isCutPiece ? '片' : '米'),
    packageQty: isCutPiece ? 1 : order.plannedRollCount || 1,
    packageUnit: isCutPiece ? '包' : '卷',
    relatedFeiTicketIds: [],
  }
}

function resolveDyeContext(actionResult: ProcessWarehouseLinkageActionResult): WarehouseBaseContext | null {
  const order = getDyeWorkOrderById(actionResult.sourceId)
  if (!order) return null
  const binding = validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId)
  const objectQty = roundQty(actionResult.objectQty || order.plannedQty)
  return {
    craftType: 'DYE',
    craftName: '染色',
    sourceWorkOrderId: order.dyeOrderId,
    sourceWorkOrderNo: order.dyeOrderNo,
    sourceTaskId: binding.actualTaskId || order.taskId,
    sourceTaskNo: binding.actualTaskNo || order.taskNo,
    sourceProductionOrderId: order.productionOrderIds[0] || '',
    sourceProductionOrderNo: order.productionOrderIds[0] || '',
    sourceDemandId: order.sourceDemandIds[0] || '',
    sourceDemandNo: order.sourceDemandIds[0] || '',
    sourceFactoryId: order.dyeFactoryId,
    sourceFactoryName: order.dyeFactoryName,
    targetFactoryId: order.targetTransferWarehouseId || TEST_FACTORY_ID,
    targetFactoryName: order.targetTransferWarehouseName || TEST_FACTORY_NAME,
    targetWarehouseName: '染色待交出仓',
    warehouseLocation: '染色待交出仓-B01',
    skuSummary: order.rawMaterialSku,
    materialSku: order.rawMaterialSku,
    materialName: '染色面料',
    batchNo: '',
    objectType: '面料',
    plannedObjectQty: roundQty(order.plannedQty),
    objectQty,
    qtyUnit: actionResult.qtyUnit || order.qtyUnit || '米',
    packageQty: order.plannedRollCount || 1,
    packageUnit: '卷',
    relatedFeiTicketIds: [],
  }
}

function findCuttingOrder(sourceId: string): CutPieceOrderRecord | undefined {
  return cutPieceOrderRecords.find(
    (item) =>
      item.originalCutOrderId === sourceId ||
      item.originalCutOrderNo === sourceId ||
      item.id === sourceId ||
      item.cutPieceOrderNo === sourceId,
  )
}

function findGeneratedOriginalCutOrder(sourceId: string): GeneratedOriginalCutOrderSourceRecord | undefined {
  return buildFcsCuttingDomainSnapshot().originalCutOrders.find(
    (item) => item.originalCutOrderId === sourceId || item.originalCutOrderNo === sourceId,
  )
}

function resolveCuttingFeiTicketIds(originalCutOrderId: string | undefined): string[] {
  if (!originalCutOrderId) return []
  return listGeneratedFeiTicketsByOriginalCutOrderId(originalCutOrderId).map((ticket) => ticket.feiTicketNo)
}

function resolveCuttingContextFromGeneratedOrder(
  actionResult: ProcessWarehouseLinkageActionResult,
  order: GeneratedOriginalCutOrderSourceRecord,
): WarehouseBaseContext {
  const binding = validateCuttingOrderMobileTaskBinding(order.originalCutOrderId)
  const isPickup = actionResult.actionCode === 'CUTTING_CONFIRM_PICKUP'
  const objectQty = roundQty(actionResult.objectQty || order.requiredQty)
  const feiTicketIds = resolveCuttingFeiTicketIds(order.originalCutOrderId)
  return {
    craftType: 'CUTTING',
    craftName: '裁片',
    sourceWorkOrderId: order.originalCutOrderId,
    sourceWorkOrderNo: order.originalCutOrderNo,
    sourceTaskId: binding.actualTaskId,
    sourceTaskNo: binding.actualTaskNo,
    sourceProductionOrderId: order.productionOrderId,
    sourceProductionOrderNo: order.productionOrderNo,
    sourceDemandId: order.originalCutOrderId,
    sourceDemandNo: order.originalCutOrderNo,
    sourceFactoryId: TEST_FACTORY_ID,
    sourceFactoryName: TEST_FACTORY_NAME,
    targetFactoryId: TEST_FACTORY_ID,
    targetFactoryName: TEST_FACTORY_NAME,
    targetWarehouseName: isPickup ? '裁床待加工仓' : '裁片待交出仓',
    warehouseLocation: isPickup ? '裁床待加工仓-C01' : '裁片待交出仓-C01',
    skuSummary: order.pieceSummary || order.materialSku,
    materialSku: order.materialSku,
    materialName: order.materialLabel,
    batchNo: order.mergeBatchNo || '',
    objectType: isPickup ? '面料' : '裁片',
    plannedObjectQty: roundQty(order.requiredQty),
    objectQty,
    qtyUnit: isPickup ? '米' : '片',
    packageQty: Math.max(feiTicketIds.length, 1),
    packageUnit: '包',
    relatedFeiTicketIds: feiTicketIds,
  }
}

function resolveCuttingContext(actionResult: ProcessWarehouseLinkageActionResult): WarehouseBaseContext | null {
  const order = findCuttingOrder(actionResult.sourceId)
  if (!order) {
    const generatedOrder = findGeneratedOriginalCutOrder(actionResult.sourceId)
    return generatedOrder ? resolveCuttingContextFromGeneratedOrder(actionResult, generatedOrder) : null
  }
  const binding = validateCuttingOrderMobileTaskBinding(order.originalCutOrderId || order.id)
  const isPickup = actionResult.actionCode === 'CUTTING_CONFIRM_PICKUP'
  const objectQty = roundQty(actionResult.objectQty || (isPickup ? order.markerInfo.netLength : order.markerInfo.totalPieces || order.orderQty))
  const feiTicketIds = resolveCuttingFeiTicketIds(order.originalCutOrderId || order.id)
  return {
    craftType: 'CUTTING',
    craftName: '裁片',
    sourceWorkOrderId: order.originalCutOrderId || order.id,
    sourceWorkOrderNo: order.originalCutOrderNo || order.cutPieceOrderNo,
    sourceTaskId: binding.actualTaskId,
    sourceTaskNo: binding.actualTaskNo,
    sourceProductionOrderId: order.productionOrderId,
    sourceProductionOrderNo: order.productionOrderNo,
    sourceDemandId: order.originalCutOrderId || order.id,
    sourceDemandNo: order.originalCutOrderNo || order.cutPieceOrderNo,
    sourceFactoryId: TEST_FACTORY_ID,
    sourceFactoryName: TEST_FACTORY_NAME,
    targetFactoryId: TEST_FACTORY_ID,
    targetFactoryName: TEST_FACTORY_NAME,
    targetWarehouseName: isPickup ? '裁床待加工仓' : '裁片待交出仓',
    warehouseLocation: isPickup ? '裁床待加工仓-C01' : '裁片待交出仓-C01',
    skuSummary: `${order.materialSku} / ${order.materialLabel}`,
    materialSku: order.materialSku,
    materialName: order.materialLabel,
    batchNo: order.latestConfigBatchNo || order.boundMergeBatchNo,
    objectType: isPickup ? '面料' : '裁片',
    plannedObjectQty: roundQty(isPickup ? order.markerInfo.netLength : order.markerInfo.totalPieces || order.orderQty),
    objectQty,
    qtyUnit: isPickup ? '米' : '片',
    packageQty: Math.max(feiTicketIds.length, 1),
    packageUnit: '包',
    relatedFeiTicketIds: feiTicketIds,
  }
}

function resolveSpecialCraftContext(actionResult: ProcessWarehouseLinkageActionResult): WarehouseBaseContext | null {
  const workOrder = getSpecialCraftTaskWorkOrderById(actionResult.sourceId)
  if (!workOrder) return null
  const binding = validateSpecialCraftMobileTaskBinding(workOrder.workOrderId)
  const objectQty = roundQty(actionResult.objectQty || workOrder.currentQty || workOrder.planQty)
  const transferBagNos = [...(workOrder.transferBagNos || [])]
  const feiTicketNos = [...(workOrder.feiTicketNos || [])]
  return {
    craftType: 'SPECIAL_CRAFT',
    craftName: workOrder.operationName,
    sourceWorkOrderId: workOrder.workOrderId,
    sourceWorkOrderNo: workOrder.workOrderNo,
    sourceTaskId: binding.actualTaskId || workOrder.taskOrderId,
    sourceTaskNo: binding.actualTaskNo || workOrder.taskOrderNo,
    sourceProductionOrderId: workOrder.productionOrderId,
    sourceProductionOrderNo: workOrder.productionOrderNo,
    sourceDemandId: workOrder.taskOrderId,
    sourceDemandNo: workOrder.taskOrderNo,
    sourceFactoryId: workOrder.factoryId,
    sourceFactoryName: workOrder.factoryName,
    targetFactoryId: workOrder.factoryId,
    targetFactoryName: workOrder.factoryName,
    targetWarehouseName: `${workOrder.operationName}待交出仓`,
    warehouseLocation: `${workOrder.operationName}-A01`,
    skuSummary: [workOrder.partName, workOrder.fabricColor, workOrder.sizeCode].filter(Boolean).join(' / ') || workOrder.operationName,
    materialSku: workOrder.materialSku || '',
    materialName: workOrder.partName || workOrder.operationName,
    batchNo: transferBagNos[0] || '',
    objectType: '裁片',
    plannedObjectQty: roundQty(workOrder.planQty),
    objectQty,
    qtyUnit: '片',
    packageQty: Math.max(feiTicketNos.length, 1),
    packageUnit: '包',
    relatedFeiTicketIds: feiTicketNos,
  }
}

function ensureWaitProcessWarehouseRecord(
  context: WarehouseBaseContext,
  actionResult: ProcessWarehouseLinkageActionResult,
  currentActionName: string,
): ProcessWarehouseRecord {
  return createWaitProcessWarehouseRecord({
    ...context,
    targetWarehouseName: context.targetWarehouseName.includes('待加工仓') ? context.targetWarehouseName : `${context.craftName}待加工仓`,
    currentActionName,
    plannedObjectQty: context.plannedObjectQty,
    receivedObjectQty: context.objectQty,
    availableObjectQty: context.objectQty,
    handedOverObjectQty: 0,
    writtenBackObjectQty: 0,
    diffObjectQty: 0,
    status: actionResult.nextStatus.includes('加工中') ? '加工中' : '已入仓',
    inboundAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    remark: `${actionResult.sourceChannel || '统一写回'}触发${currentActionName}`,
  })
}

function ensureWaitHandoverWarehouseRecord(
  context: WarehouseBaseContext,
  actionResult: ProcessWarehouseLinkageActionResult,
): ProcessWarehouseRecord {
  return createWaitHandoverWarehouseRecord({
    ...context,
    currentActionName: `${context.craftName}待交出`,
    plannedObjectQty: context.plannedObjectQty,
    receivedObjectQty: context.objectQty,
    availableObjectQty: context.objectQty,
    handedOverObjectQty: 0,
    writtenBackObjectQty: 0,
    diffObjectQty: 0,
    status: '待交出',
    inboundAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    remark: `${actionResult.sourceChannel || '统一写回'}触发${context.craftName}待交出仓`,
  })
}

function ensureHandoverRecord(
  context: WarehouseBaseContext,
  actionResult: ProcessWarehouseLinkageActionResult,
  warehouseRecordId?: string,
): ProcessHandoverRecord {
  const existed = actionResult.affectedHandoverRecordId ? getProcessHandoverRecordById(actionResult.affectedHandoverRecordId) : undefined
  if (existed) return existed
  const fallbackWarehouse =
    warehouseRecordId ||
    listWaitHandoverWarehouseRecords({
      craftType: context.craftType,
      craftName: context.craftName,
      sourceWorkOrderId: context.sourceWorkOrderId,
    })[0]?.warehouseRecordId
  return createProcessHandoverRecord({
    warehouseRecordId: fallbackWarehouse,
    craftType: context.craftType,
    craftName: context.craftName,
    sourceWorkOrderId: context.sourceWorkOrderId,
    sourceWorkOrderNo: context.sourceWorkOrderNo,
    sourceTaskId: context.sourceTaskId,
    sourceTaskNo: context.sourceTaskNo,
    sourceProductionOrderId: context.sourceProductionOrderId,
    sourceProductionOrderNo: context.sourceProductionOrderNo,
    handoverFactoryId: context.sourceFactoryId,
    handoverFactoryName: context.sourceFactoryName,
    receiveFactoryId: context.targetFactoryId,
    receiveFactoryName: context.targetFactoryName,
    receiveWarehouseName: context.targetWarehouseName,
    objectType: context.objectType,
    handoverObjectQty: context.objectQty,
    receiveObjectQty: 0,
    diffObjectQty: 0,
    qtyUnit: context.qtyUnit,
    packageQty: context.packageQty,
    packageUnit: context.packageUnit,
    handoverPerson: actionResult.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员',
    relatedFeiTicketIds: context.relatedFeiTicketIds,
    remark: `${actionResult.sourceChannel || '统一写回'}发起${context.craftName}交出`,
  })
}

function ensureSpecialCraftDifference(
  context: WarehouseBaseContext,
  actionResult: ProcessWarehouseLinkageActionResult,
): { differenceId: string; updatedFeiTicketIds: string[] } {
  const existed = actionResult.affectedDifferenceRecordId
    ? getProcessHandoverDifferenceRecordById(actionResult.affectedDifferenceRecordId)
    : undefined
  const handover = actionResult.affectedHandoverRecordId
    ? getProcessHandoverRecordById(actionResult.affectedHandoverRecordId)
    : listProcessHandoverRecords({
        craftType: 'SPECIAL_CRAFT',
        craftName: context.craftName,
        sourceWorkOrderId: context.sourceWorkOrderId,
      })[0]
  const warehouse =
    getProcessWarehouseRecordById(handover?.warehouseRecordId || '') ||
    ensureWaitProcessWarehouseRecord(context, actionResult, `待${context.craftName}`)
  const diffQty = roundQty(actionResult.objectQty || context.objectQty)
  const difference = existed || createProcessHandoverDifferenceRecord({
    handoverRecordId: handover?.handoverRecordId || '',
    warehouseRecordId: warehouse.warehouseRecordId,
    sourceWorkOrderId: context.sourceWorkOrderId,
    sourceWorkOrderNo: context.sourceWorkOrderNo,
    sourceProductionOrderId: context.sourceProductionOrderId,
    sourceProductionOrderNo: context.sourceProductionOrderNo,
    craftType: 'SPECIAL_CRAFT',
    craftName: context.craftName,
    objectType: '裁片',
    expectedObjectQty: context.plannedObjectQty,
    actualObjectQty: Math.max(context.plannedObjectQty - diffQty, 0),
    diffObjectQty: diffQty,
    qtyUnit: context.qtyUnit,
    reportedBy: actionResult.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员',
    relatedFeiTicketIds: context.relatedFeiTicketIds,
    remark: `${actionResult.sourceChannel || '统一写回'}上报特殊工艺差异，关联菲票数量 ${context.relatedFeiTicketIds.length}`,
  })
  applySpecialCraftDifferenceToFeiTickets(difference.differenceRecordId, {
    operatorName: actionResult.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员',
    reason: '特殊工艺差异联动菲票数量变化',
  })
  return { differenceId: difference.differenceRecordId, updatedFeiTicketIds: [...context.relatedFeiTicketIds] }
}

export function applyPrintWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  const context = resolvePrintContext(actionResult)
  const base = emptyLinkageResult(actionResult)
  if (!context) return mergeResult(base, { success: false, message: '未找到印花加工单，不能执行仓联动' })
  if (!['PRINT_FINISH_TRANSFER', 'PRINT_MARK_WAIT_DELIVERY', 'PRINT_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
  const waitHandover = ensureWaitHandoverWarehouseRecord(context, actionResult)
  let result = mergeResult(base, {
    createdWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    message: '印花待交出仓已联动',
  })
  if (actionResult.actionCode === 'PRINT_SUBMIT_HANDOVER') {
    const handover = ensureHandoverRecord(context, actionResult, waitHandover.warehouseRecordId)
    result = mergeResult(result, {
      createdHandoverRecordId: handover.handoverRecordId,
      updatedHandoverRecordId: handover.handoverRecordId,
      message: '印花交出记录已联动',
    })
  }
  return result
}

export function applyDyeWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  const context = resolveDyeContext(actionResult)
  const base = emptyLinkageResult(actionResult)
  if (!context) return mergeResult(base, { success: false, message: '未找到染色加工单，不能执行仓联动' })
  if (!['DYE_FINISH_PACKING', 'DYE_MARK_WAIT_DELIVERY', 'DYE_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
  const waitHandover = ensureWaitHandoverWarehouseRecord(context, actionResult)
  let result = mergeResult(base, {
    createdWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    message: '染色待交出仓已联动',
  })
  if (actionResult.actionCode === 'DYE_SUBMIT_HANDOVER') {
    const handover = ensureHandoverRecord(context, actionResult, waitHandover.warehouseRecordId)
    result = mergeResult(result, {
      createdHandoverRecordId: handover.handoverRecordId,
      updatedHandoverRecordId: handover.handoverRecordId,
      message: '染色交出记录已联动',
    })
  }
  return result
}

export function applyCuttingWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  const context = resolveCuttingContext(actionResult)
  const base = emptyLinkageResult(actionResult)
  if (!context) return mergeResult(base, { success: false, message: '未找到原始裁片单，不能执行仓联动' })
  // 裁片冻结口径：合并裁剪批次只作为执行上下文，菲票归属原始裁片单。
  if (actionResult.actionCode === 'CUTTING_CONFIRM_PICKUP') {
    const waitProcess = ensureWaitProcessWarehouseRecord(context, actionResult, '裁片待加工')
    return mergeResult(base, {
      createdWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      updatedWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      message: '裁片待加工仓已联动',
    })
  }
  if (!['CUTTING_CONFIRM_INBOUND', 'CUTTING_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
  const waitHandover = ensureWaitHandoverWarehouseRecord({ ...context, objectType: '裁片', qtyUnit: '片' }, actionResult)
  let result = mergeResult(base, {
    createdWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedFeiTicketIds: context.relatedFeiTicketIds,
    message: '裁片待交出仓已联动，菲票归属原始裁片单',
  })
  if (actionResult.actionCode === 'CUTTING_SUBMIT_HANDOVER') {
    const handover = ensureHandoverRecord({ ...context, objectType: '裁片', qtyUnit: '片' }, actionResult, waitHandover.warehouseRecordId)
    result = mergeResult(result, {
      createdHandoverRecordId: handover.handoverRecordId,
      updatedHandoverRecordId: handover.handoverRecordId,
      message: '裁片交出记录已联动并关联原始裁片单和菲票',
    })
  }
  return result
}

export function applySpecialCraftWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  const context = resolveSpecialCraftContext(actionResult)
  const base = emptyLinkageResult(actionResult)
  if (!context) return mergeResult(base, { success: false, message: '未找到特殊工艺单，不能执行仓联动' })
  if (actionResult.actionCode === 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES') {
    const waitProcess = ensureWaitProcessWarehouseRecord(context, actionResult, `待${context.craftName}`)
    return mergeResult(base, {
      createdWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      updatedWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      updatedFeiTicketIds: context.relatedFeiTicketIds,
      message: '特殊工艺待加工仓已联动并关联菲票',
    })
  }
  if (actionResult.actionCode === 'SPECIAL_CRAFT_REPORT_DIFFERENCE') {
    const difference = ensureSpecialCraftDifference(context, actionResult)
    return mergeResult(base, {
      createdDifferenceRecordId: difference.differenceId,
      updatedDifferenceRecordId: difference.differenceId,
      updatedFeiTicketIds: difference.updatedFeiTicketIds,
      message: '特殊工艺差异记录已联动菲票数量变化',
    })
  }
  if (!['SPECIAL_CRAFT_FINISH_PROCESS', 'SPECIAL_CRAFT_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
  const waitHandover = ensureWaitHandoverWarehouseRecord(context, actionResult)
  let result = mergeResult(base, {
    createdWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedFeiTicketIds: context.relatedFeiTicketIds,
    message: '特殊工艺待交出仓已联动',
  })
  if (actionResult.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER') {
    const handover = ensureHandoverRecord(context, actionResult, waitHandover.warehouseRecordId)
    result = mergeResult(result, {
      createdHandoverRecordId: handover.handoverRecordId,
      updatedHandoverRecordId: handover.handoverRecordId,
      message: '特殊工艺交出记录已联动并关联菲票',
    })
  }
  return result
}

export function applyWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  if (!actionResult.success) return emptyLinkageResult(actionResult, '动作未成功，不执行仓交出联动')
  if (actionResult.sourceType === 'PRINT') return applyPrintWarehouseLinkageAfterAction(actionResult)
  if (actionResult.sourceType === 'DYE') return applyDyeWarehouseLinkageAfterAction(actionResult)
  if (actionResult.sourceType === 'CUTTING') return applyCuttingWarehouseLinkageAfterAction(actionResult)
  return applySpecialCraftWarehouseLinkageAfterAction(actionResult)
}

export const PROCESS_WAREHOUSE_LINKAGE_SERVICE_SOURCE = '待加工仓、待交出仓、交出、回写统一联动服务'
