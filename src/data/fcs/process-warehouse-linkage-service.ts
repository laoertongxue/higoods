import {
  DEDICATED_POST_FACTORY_ID,
  DEDICATED_POST_FACTORY_NAME,
  GARMENT_WAREHOUSE_FACTORY_ID,
  GARMENT_WAREHOUSE_FACTORY_NAME,
  TEST_FACTORY_ID,
  TEST_FACTORY_NAME,
} from './factory-mock-data.ts'
import { getPrintWorkOrderById } from './printing-task-domain.ts'
import { getDyeWorkOrderById } from './dyeing-task-domain.ts'
import { cutPieceOrderRecords, type CutPieceOrderRecord } from './cutting/cut-piece-orders.ts'
import { buildFcsCuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import type { GeneratedCutOrderSourceRecord } from './cutting/generated-cut-orders.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
  listSpreadingResultGeneratedFeiTicketsByCutOrderId,
} from './cutting/generated-fei-tickets.ts'
import {
  getSpecialCraftTaskOrderById,
} from './special-craft-task-orders.ts'
import { resolveAuxiliaryWarehouseFlow } from './special-craft-operations.ts'
import {
  listFactoryWarehouseOutboundRecords,
  recordGarmentReceiptAtAuxiliaryFactory,
  recordGarmentReadyToHandoverAtAuxiliaryFactory,
  upsertFactoryWarehouseOutboundRecord,
  validateGarmentReadyToHandoverAtAuxiliaryFactory,
} from './factory-internal-warehouse.ts'
import {
  getPostFinishingWorkOrderById,
} from './post-finishing-domain.ts'
import {
  applySpecialCraftDifferenceToFeiTickets,
  attachProcessHandoverRecordFeiTickets,
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
  validatePostFinishingMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
  validateSpecialCraftMobileTaskBinding,
} from './process-mobile-task-binding.ts'
import { mapCraftStatusToPlatformStatus } from './process-platform-status-adapter.ts'
import type { ProcessWorkOrderSourceType } from './process-work-order-domain.ts'

export interface ProcessWarehouseLinkageActionResult {
  success: boolean
  sourceChannel?: 'Web 端' | '移动端'
  sourceType: 'PRINT' | 'DYE' | 'CUTTING' | 'SPECIAL_CRAFT' | 'POST_FINISHING'
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
  operatorName?: string
  operatorUserId?: string
  operatorFactoryId?: string
  operatorRoleId?: string
  operatorRoleName?: string
  operatedAt?: string
  skuQtyBySkuCode?: Record<string, number>
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

export function validateWarehouseLinkageBeforeAction(
  actionResult: ProcessWarehouseLinkageActionResult,
): { success: boolean; message: string } {
  if (
    actionResult.sourceType !== 'SPECIAL_CRAFT'
    || actionResult.actionCode !== 'SPECIAL_CRAFT_PROCESS_REPORT'
    || actionResult.objectType !== '成衣'
  ) {
    return { success: true, message: '无需仓事实预校验' }
  }
  const context = resolveSpecialCraftContext(actionResult)
  if (!context) return { success: false, message: '未找到特殊工艺单，不能校验成衣完工仓事实' }
  if (!actionResult.skuQtyBySkuCode) return { success: false, message: '成衣完工必须逐 SKU 确认完工件数' }
  try {
    validateGarmentReadyToHandoverAtAuxiliaryFactory({
      sourceTaskOrderId: context.sourceTaskOrderId,
      targetFactoryId: context.currentFactoryId,
      targetFactoryName: context.currentFactoryName,
      totalCompletedQty: Number(actionResult.objectQty || 0),
      completedQtyBySkuCode: actionResult.skuQtyBySkuCode,
    })
    return { success: true, message: '成衣完工仓事实校验通过' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : '成衣完工仓事实校验失败' }
  }
}

interface WarehouseBaseContext {
  craftType: ProcessWarehouseCraftType
  craftName: string
  sourceTaskOrderId: string
  sourceWorkOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceType?: ProcessWorkOrderSourceType
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  sourceFactoryId: string
  sourceFactoryName: string
  targetFactoryId: string
  targetFactoryName: string
  targetWarehouseName: string
  receiveWarehouseName?: string
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

interface SpecialCraftWarehouseContext extends WarehouseBaseContext {
  upstreamWarehouseId: string
  upstreamWarehouseName: string
  currentFactoryId: string
  currentFactoryName: string
  downstreamFactoryId: string
  downstreamFactoryName: string
  downstreamWarehouseName: string
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
    sourceTaskOrderId: order.printOrderId,
    sourceWorkOrderNo: order.printOrderNo,
    sourceTaskId: binding.actualTaskId || order.taskId,
    sourceTaskNo: binding.actualTaskNo || order.taskNo,
    sourceType: order.sourceType,
    ...(order.sourceType === 'STOCK'
      ? { stockMaterialId: order.stockMaterialId, stockMaterialName: order.stockMaterialName }
      : { sourceProductionOrderId: order.sourceProductionOrderId, sourceProductionOrderNo: order.sourceProductionOrderNo }),
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
    sourceTaskOrderId: order.dyeOrderId,
    sourceWorkOrderNo: order.dyeOrderNo,
    sourceTaskId: binding.actualTaskId || order.taskId,
    sourceTaskNo: binding.actualTaskNo || order.taskNo,
    sourceType: order.sourceType,
    ...(order.sourceType === 'STOCK'
      ? { stockMaterialId: order.stockMaterialId, stockMaterialName: order.stockMaterialName }
      : { sourceProductionOrderId: order.sourceProductionOrderId, sourceProductionOrderNo: order.sourceProductionOrderNo }),
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
      item.cutOrderId === sourceId ||
      item.cutOrderNo === sourceId ||
      item.id === sourceId ||
      item.cutPieceOrderNo === sourceId,
  )
}

function findGeneratedCutOrder(sourceId: string): GeneratedCutOrderSourceRecord | undefined {
  return buildFcsCuttingDomainSnapshot().cutOrders.find(
    (item) => item.cutOrderId === sourceId || item.cutOrderNo === sourceId,
  )
}

function resolveCuttingFeiTicketIds(cutOrderId: string | undefined, cutOrderNo?: string, productionOrderNo?: string): string[] {
  const byCutOrderId = cutOrderId ? listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId) : []
  const allTickets = byCutOrderId.length ? byCutOrderId : listSpreadingResultGeneratedFeiTickets().filter((ticket) =>
    (cutOrderId && ticket.cutOrderId === cutOrderId) ||
    (cutOrderNo && ticket.cutOrderNo === cutOrderNo) ||
    (productionOrderNo && ticket.productionOrderNo === productionOrderNo),
  )
  const ticketNos = allTickets.map((ticket) => ticket.feiTicketNo).filter(Boolean)
  if (ticketNos.length) return ticketNos
  return cutOrderNo ? [`FT-${cutOrderNo}-001`] : []
}

function resolveCuttingContextFromGeneratedOrder(
  actionResult: ProcessWarehouseLinkageActionResult,
  order: GeneratedCutOrderSourceRecord,
): WarehouseBaseContext {
  const binding = validateCuttingOrderMobileTaskBinding(order.cutOrderId)
  const isPickup = actionResult.actionCode === 'CUTTING_CONFIRM_PICKUP'
  const objectQty = roundQty(actionResult.objectQty || order.requiredQty)
  const feiTicketIds = resolveCuttingFeiTicketIds(order.cutOrderId, order.cutOrderNo, order.productionOrderNo)
  return {
    craftType: 'CUTTING',
    craftName: '裁片',
    sourceTaskOrderId: actionResult.sourceId,
    sourceWorkOrderNo: order.cutOrderNo,
    sourceTaskId: binding.actualTaskId,
    sourceTaskNo: binding.actualTaskNo,
    sourceProductionOrderId: order.productionOrderId,
    sourceProductionOrderNo: order.productionOrderNo,
    sourceFactoryId: TEST_FACTORY_ID,
    sourceFactoryName: TEST_FACTORY_NAME,
    targetFactoryId: TEST_FACTORY_ID,
    targetFactoryName: TEST_FACTORY_NAME,
    targetWarehouseName: isPickup ? '裁床待加工仓' : '裁床待交出仓',
    warehouseLocation: isPickup ? '裁床待加工仓-C01' : '裁床待交出仓-C01',
    skuSummary: order.pieceSummary || order.materialSku,
    materialSku: order.materialSku,
    materialName: order.materialLabel,
    batchNo: order.markerPlanNo || '',
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
    const generatedOrder = findGeneratedCutOrder(actionResult.sourceId)
    return generatedOrder ? resolveCuttingContextFromGeneratedOrder(actionResult, generatedOrder) : null
  }
  const binding = validateCuttingOrderMobileTaskBinding(order.cutOrderId || order.id)
  const isPickup = actionResult.actionCode === 'CUTTING_CONFIRM_PICKUP'
  const objectQty = roundQty(actionResult.objectQty || (isPickup ? order.markerInfo.netLength : order.markerInfo.totalPieces || order.orderQty))
  const feiTicketIds = resolveCuttingFeiTicketIds(order.cutOrderId || order.id, order.cutOrderNo || order.cutPieceOrderNo, order.productionOrderNo)
  return {
    craftType: 'CUTTING',
    craftName: '裁片',
    sourceTaskOrderId: actionResult.sourceId,
    sourceWorkOrderNo: order.cutOrderNo || order.cutPieceOrderNo,
    sourceTaskId: binding.actualTaskId,
    sourceTaskNo: binding.actualTaskNo,
    sourceProductionOrderId: order.productionOrderId,
    sourceProductionOrderNo: order.productionOrderNo,
    sourceFactoryId: TEST_FACTORY_ID,
    sourceFactoryName: TEST_FACTORY_NAME,
    targetFactoryId: TEST_FACTORY_ID,
    targetFactoryName: TEST_FACTORY_NAME,
    targetWarehouseName: isPickup ? '裁床待加工仓' : '裁床待交出仓',
    warehouseLocation: isPickup ? '裁床待加工仓-C01' : '裁床待交出仓-C01',
    skuSummary: `${order.materialSku} / ${order.materialLabel}`,
    materialSku: order.materialSku,
    materialName: order.materialLabel,
    batchNo: order.latestConfigBatchNo || order.boundMarkerPlanSourceNo,
    objectType: isPickup ? '面料' : '裁片',
    plannedObjectQty: roundQty(isPickup ? order.markerInfo.netLength : order.markerInfo.totalPieces || order.orderQty),
    objectQty,
    qtyUnit: isPickup ? '米' : '片',
    packageQty: Math.max(feiTicketIds.length, 1),
    packageUnit: '包',
    relatedFeiTicketIds: feiTicketIds,
  }
}

function resolveSpecialCraftContext(actionResult: ProcessWarehouseLinkageActionResult): SpecialCraftWarehouseContext | null {
  const workOrder = getSpecialCraftTaskOrderById(actionResult.sourceId)
  if (!workOrder) return null
  const binding = validateSpecialCraftMobileTaskBinding(workOrder.taskOrderId)
  const objectQty = roundQty(actionResult.objectQty ?? workOrder.currentQty ?? workOrder.receivedQty)
  const transferBagNos = [...(workOrder.transferBagNos || [])]
  const feiTicketNos = [...(workOrder.feiTicketNos || [])]
  const flow = resolveAuxiliaryWarehouseFlow(workOrder.targetObject)
  return {
    craftType: 'SPECIAL_CRAFT',
    craftName: workOrder.operationName,
    sourceTaskOrderId: workOrder.taskOrderId,
    sourceWorkOrderNo: workOrder.taskOrderNo,
    sourceTaskId: binding.actualTaskId || workOrder.taskOrderId,
    sourceTaskNo: binding.actualTaskNo || workOrder.taskOrderNo,
    sourceProductionOrderId: workOrder.productionOrderId,
    sourceProductionOrderNo: workOrder.productionOrderNo,
    sourceFactoryId: workOrder.factoryId,
    sourceFactoryName: workOrder.factoryName,
    targetFactoryId: flow.receiverKind === '后道工厂'
      ? DEDICATED_POST_FACTORY_ID
      : flow.receiverKind === '裁床厂'
        ? 'CUTTING-FACTORY'
        : 'TRANSFER-WAREHOUSE',
    targetFactoryName: flow.receiverKind === '后道工厂' ? DEDICATED_POST_FACTORY_NAME : flow.receiverName,
    targetWarehouseName: `${workOrder.operationName}待交出仓`,
    receiveWarehouseName: flow.receiverWarehouseName,
    warehouseLocation: `${workOrder.operationName}-A01`,
    skuSummary: [workOrder.partName, workOrder.fabricColor, workOrder.sizeCode].filter(Boolean).join(' / ') || workOrder.operationName,
    materialSku: workOrder.materialSku || '',
    materialName: workOrder.partName || workOrder.operationName,
    batchNo: transferBagNos[0] || '',
    objectType: flow.objectType,
    plannedObjectQty: roundQty(workOrder.planQty),
    objectQty,
    qtyUnit: flow.qtyUnit,
    packageQty: Math.max(feiTicketNos.length, 1),
    packageUnit: '包',
    relatedFeiTicketIds: flow.objectType === '裁片' ? feiTicketNos : [],
    upstreamWarehouseId: flow.objectType === '成衣' ? GARMENT_WAREHOUSE_FACTORY_ID : 'CUTTING-WAIT-HANDOVER-WAREHOUSE',
    upstreamWarehouseName: flow.sourceObjectName,
    currentFactoryId: workOrder.factoryId,
    currentFactoryName: workOrder.factoryName,
    downstreamFactoryId: flow.receiverKind === '后道工厂'
      ? DEDICATED_POST_FACTORY_ID
      : flow.receiverKind === '裁床厂'
        ? 'CUTTING-FACTORY'
        : 'TRANSFER-WAREHOUSE',
    downstreamFactoryName: flow.receiverKind === '后道工厂' ? DEDICATED_POST_FACTORY_NAME : flow.receiverName,
    downstreamWarehouseName: flow.receiverWarehouseName,
  }
}

function resolvePostFinishingContext(actionResult: ProcessWarehouseLinkageActionResult): WarehouseBaseContext | null {
  const order = getPostFinishingWorkOrderById(actionResult.sourceId)
  if (!order) return null
  const binding = validatePostFinishingMobileTaskBinding(order.postOrderId)
  const objectQty = roundQty(actionResult.objectQty || order.plannedGarmentQty)
  return {
    craftType: 'POST_FINISHING',
    craftName: '后道',
    sourceTaskOrderId: order.postOrderId,
    sourceWorkOrderNo: order.postOrderNo,
    sourceTaskId: binding.actualTaskId || order.sourceTaskId,
    sourceTaskNo: binding.actualTaskNo || order.postOrderNo,
    sourceProductionOrderId: order.sourceProductionOrderId,
    sourceProductionOrderNo: order.sourceProductionOrderNo,
    sourceFactoryId: order.managedPostFactoryId,
    sourceFactoryName: order.managedPostFactoryName,
    targetFactoryId: order.currentFactoryId || TEST_FACTORY_ID,
    targetFactoryName: order.currentFactoryName || TEST_FACTORY_NAME,
    targetWarehouseName: '后道待交出仓',
    warehouseLocation: '后道待交出仓-H01',
    skuSummary: order.skuSummary,
    materialSku: order.styleNo,
    materialName: '成衣',
    batchNo: order.sourceSewingTaskNo,
    objectType: '成衣',
    plannedObjectQty: roundQty(order.plannedGarmentQty),
    objectQty,
    qtyUnit: '件',
    packageQty: 1,
    packageUnit: '包',
    relatedFeiTicketIds: [],
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
  if (existed) return attachProcessHandoverRecordFeiTickets(existed.handoverRecordId, context.relatedFeiTicketIds) || existed
  const fallbackWarehouse =
    warehouseRecordId ||
    listWaitHandoverWarehouseRecords({
      craftType: context.craftType,
      craftName: context.craftName,
      sourceTaskOrderId: context.sourceTaskOrderId,
    })[0]?.warehouseRecordId
  return createProcessHandoverRecord({
    warehouseRecordId: fallbackWarehouse,
    craftType: context.craftType,
    craftName: context.craftName,
    sourceTaskOrderId: context.sourceTaskOrderId,
    sourceWorkOrderNo: context.sourceWorkOrderNo,
    sourceTaskId: context.sourceTaskId,
    sourceTaskNo: context.sourceTaskNo,
    sourceType: context.sourceType,
    sourceProductionOrderId: context.sourceProductionOrderId,
    sourceProductionOrderNo: context.sourceProductionOrderNo,
    stockMaterialId: context.stockMaterialId,
    stockMaterialName: context.stockMaterialName,
    handoverFactoryId: context.sourceFactoryId,
    handoverFactoryName: context.sourceFactoryName,
    receiveFactoryId: context.targetFactoryId,
    receiveFactoryName: context.targetFactoryName,
    receiveWarehouseName: context.receiveWarehouseName || context.targetWarehouseName,
    objectType: context.objectType,
    handoverObjectQty: context.objectQty,
    receiveObjectQty: 0,
    diffObjectQty: 0,
    qtyUnit: context.qtyUnit,
    packageQty: context.packageQty,
    packageUnit: context.packageUnit,
    handoverPerson: actionResult.operatorName || (actionResult.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员'),
    operatorUserId: actionResult.operatorUserId,
    operatorFactoryId: actionResult.operatorFactoryId,
    operatorRoleId: actionResult.operatorRoleId,
    operatorRoleName: actionResult.operatorRoleName,
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
        sourceTaskOrderId: context.sourceTaskOrderId,
      })[0]
  const warehouse =
    getProcessWarehouseRecordById(handover?.warehouseRecordId || '') ||
    ensureWaitProcessWarehouseRecord(context, actionResult, `待${context.craftName}`)
  const diffQty = roundQty(actionResult.objectQty || context.objectQty)
  const difference = existed || createProcessHandoverDifferenceRecord({
    handoverRecordId: handover?.handoverRecordId || '',
    warehouseRecordId: warehouse.warehouseRecordId,
    sourceTaskOrderId: context.sourceTaskOrderId,
    sourceWorkOrderNo: context.sourceWorkOrderNo,
    sourceProductionOrderId: context.sourceProductionOrderId,
    sourceProductionOrderNo: context.sourceProductionOrderNo,
    craftType: 'SPECIAL_CRAFT',
    craftName: context.craftName,
    objectType: context.objectType,
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
  if (!['PRINT_FINISH_TRANSFER', 'PRINT_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
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
  if (!['DYE_FINISH_PACKING', 'DYE_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
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
  if (!context) return mergeResult(base, { success: false, message: '未找到裁片单，不能执行仓联动' })
  // 裁片冻结口径：唛架方案只作为执行上下文，菲票归属裁片单。
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
    message: '裁床待交出仓已联动，菲票归属裁片单',
  })
  if (actionResult.actionCode === 'CUTTING_SUBMIT_HANDOVER') {
    const handover = ensureHandoverRecord({ ...context, objectType: '裁片', qtyUnit: '片' }, actionResult, waitHandover.warehouseRecordId)
    result = mergeResult(result, {
      createdHandoverRecordId: handover.handoverRecordId,
      updatedHandoverRecordId: handover.handoverRecordId,
      message: '裁片交出记录已联动并关联裁片单和菲票',
    })
  }
  return result
}

export function applySpecialCraftWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  const context = resolveSpecialCraftContext(actionResult)
  const base = emptyLinkageResult(actionResult)
  if (!context) return mergeResult(base, { success: false, message: '未找到特殊工艺单，不能执行仓联动' })
  if (!context.sourceProductionOrderId || !context.sourceProductionOrderNo) {
    return mergeResult(base, { success: false, message: '特殊工艺单缺少来源生产单，不能执行仓联动' })
  }
  if (actionResult.actionCode === 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND') {
    if (context.objectType !== '成衣') {
      return mergeResult(base, { success: false, message: '仅成衣作用对象可从成衣仓出库' })
    }
    const workOrder = getSpecialCraftTaskOrderById(context.sourceTaskOrderId)
    const skuLines = workOrder?.demandLines || []
    if (!workOrder || !skuLines.length || !actionResult.skuQtyBySkuCode) {
      return mergeResult(base, { success: false, message: '请逐 SKU 确认成衣仓实出件数' })
    }
    const invalidLine = skuLines.find((line) => {
      const qty = actionResult.skuQtyBySkuCode?.[line.skuCode]
      return !Number.isInteger(qty) || Number(qty) < 0 || Number(qty) > line.planPieceQty
    })
    if (invalidLine) {
      return mergeResult(base, { success: false, message: `SKU ${invalidLine.skuCode} 实出件数无效` })
    }
    const totalOutboundQty = skuLines.reduce(
      (sum, line) => sum + Number(actionResult.skuQtyBySkuCode?.[line.skuCode] || 0),
      0,
    )
    if (totalOutboundQty <= 0) {
      return mergeResult(base, { success: false, message: '成衣仓出库至少一个 SKU 实出件数必须大于 0' })
    }
    if (totalOutboundQty !== actionResult.objectQty) {
      return mergeResult(base, { success: false, message: '逐 SKU 实出合计必须等于本次出库总件数' })
    }
    skuLines.forEach((line, index) => {
      const outboundQty = Number(actionResult.skuQtyBySkuCode?.[line.skuCode] || 0)
      upsertFactoryWarehouseOutboundRecord({
        outboundRecordId: `GARMENT-OUT-${workOrder.taskOrderId}-${line.skuCode}`,
        outboundRecordNo: `CK-${workOrder.taskOrderNo}-${String(index + 1).padStart(2, '0')}`,
        warehouseId: `${GARMENT_WAREHOUSE_FACTORY_ID}-WH-GARMENT`,
        warehouseName: '成衣仓',
        factoryId: GARMENT_WAREHOUSE_FACTORY_ID,
        factoryName: GARMENT_WAREHOUSE_FACTORY_NAME,
        factoryKind: 'CENTRAL_GARMENT',
        processCode: workOrder.processCode,
        processName: workOrder.processName,
        craftCode: workOrder.craftCode,
        craftName: workOrder.craftName,
        sourceTaskId: workOrder.taskOrderId,
        sourceTaskNo: workOrder.taskOrderNo,
        sourceType: 'PRODUCTION_ORDER',
        productionOrderId: workOrder.productionOrderId,
        productionOrderNo: workOrder.productionOrderNo,
        receiverKind: '特殊工艺厂',
        receiverName: workOrder.factoryName,
        itemKind: '成衣',
        itemName: `${workOrder.craftName}成衣`,
        materialSku: line.skuCode,
        fabricColor: line.colorName,
        sizeCode: line.sizeCode,
        outboundQty,
        unit: '件',
        operatorName: actionResult.operatorName || '成衣仓管员',
        operatorUserId: actionResult.operatorUserId,
        operatorFactoryId: actionResult.operatorFactoryId,
        operatorRoleId: actionResult.operatorRoleId,
        operatorRoleName: actionResult.operatorRoleName,
        outboundAt: actionResult.operatedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: '已出库',
        photoList: [],
        remark: `成衣仓按 SKU 交往${workOrder.factoryName}`,
      })
    })
    return mergeResult(base, { message: `成衣仓已按 ${skuLines.length} 个 SKU 出库，等待辅助工艺确认收货` })
  }
  if (actionResult.actionCode === 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES') {
    if (
      context.objectType === '成衣'
      && !listFactoryWarehouseOutboundRecords().some((record) =>
        record.sourceTaskId === context.sourceTaskOrderId
        && record.warehouseName === '成衣仓'
        && record.status !== '已作废',
      )
    ) {
      return mergeResult(base, { success: false, message: '成衣仓尚未出库，不能确认收货' })
    }
    if (context.objectType === '成衣') {
      const outboundRecords = listFactoryWarehouseOutboundRecords().filter((record) =>
        record.sourceTaskId === context.sourceTaskOrderId
        && record.warehouseName === '成衣仓'
        && record.status !== '已作废',
      )
      if (!actionResult.skuQtyBySkuCode) {
        return mergeResult(base, { success: false, message: '请逐 SKU 确认辅助工艺实收件数' })
      }
      const invalidRecord = outboundRecords.find((record) => {
        const skuCode = record.materialSku || ''
        const qty = actionResult.skuQtyBySkuCode?.[skuCode]
        return !Number.isInteger(qty) || Number(qty) < 0 || Number(qty) > record.outboundQty
      })
      if (invalidRecord) {
        return mergeResult(base, { success: false, message: `SKU ${invalidRecord.materialSku || '未知'} 实收件数无效` })
      }
      const receivedQty = outboundRecords.reduce((sum, record) => sum + Number(actionResult.skuQtyBySkuCode?.[record.materialSku || ''] || 0), 0)
      if (receivedQty <= 0) {
        return mergeResult(base, { success: false, message: '辅助工艺收货至少一个 SKU 实收件数必须大于 0' })
      }
      if (receivedQty !== actionResult.objectQty) {
        return mergeResult(base, { success: false, message: '逐 SKU 实收合计与本次实收件数不一致' })
      }
      outboundRecords.forEach((record) => {
        recordGarmentReceiptAtAuxiliaryFactory({
          outboundRecord: record,
          targetFactoryId: context.currentFactoryId,
          targetFactoryName: context.currentFactoryName,
          sourceTaskId: context.sourceTaskOrderId,
          sourceTaskNo: context.sourceWorkOrderNo,
          productionOrderId: context.sourceProductionOrderId!,
          productionOrderNo: context.sourceProductionOrderNo!,
          processCode: getSpecialCraftTaskOrderById(context.sourceTaskOrderId)?.processCode || 'SPECIAL_CRAFT',
          processName: getSpecialCraftTaskOrderById(context.sourceTaskOrderId)?.processName || context.craftName,
          craftCode: getSpecialCraftTaskOrderById(context.sourceTaskOrderId)?.craftCode || context.craftName,
          craftName: context.craftName,
          receivedQty: Number(actionResult.skuQtyBySkuCode?.[record.materialSku || ''] || 0),
          receiverName: actionResult.operatorName || '辅助工艺仓管员',
          receivedAt: actionResult.operatedAt || new Date().toISOString().replace('T', ' ').slice(0, 19),
          operatorUserId: actionResult.operatorUserId,
          operatorFactoryId: actionResult.operatorFactoryId,
          operatorRoleId: actionResult.operatorRoleId,
          operatorRoleName: actionResult.operatorRoleName,
        })
      })
    }
    const waitProcessContext: WarehouseBaseContext = {
      ...context,
      sourceFactoryId: context.upstreamWarehouseId,
      sourceFactoryName: context.upstreamWarehouseName,
      targetFactoryId: context.currentFactoryId,
      targetFactoryName: context.currentFactoryName,
      targetWarehouseName: `${context.craftName}待加工仓`,
      warehouseLocation: `${context.craftName}待加工仓-A01`,
    }
    const waitProcess = ensureWaitProcessWarehouseRecord(waitProcessContext, actionResult, `待${context.craftName}`)
    return mergeResult(base, {
      createdWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      updatedWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      updatedFeiTicketIds: context.relatedFeiTicketIds,
      message: context.objectType === '成衣'
        ? `${context.currentFactoryName}已按 SKU 确认成衣收货`
        : `${context.currentFactoryName}待加工仓已联动并关联菲票`,
    })
  }
  if (!['SPECIAL_CRAFT_PROCESS_REPORT', 'SPECIAL_CRAFT_SUBMIT_HANDOVER'].includes(actionResult.actionCode)) return base
  const waitHandoverContext: WarehouseBaseContext = {
    ...context,
    sourceFactoryId: context.currentFactoryId,
    sourceFactoryName: context.currentFactoryName,
    targetFactoryId: context.downstreamFactoryId,
    targetFactoryName: context.downstreamFactoryName,
    receiveWarehouseName: context.downstreamWarehouseName,
    targetWarehouseName: `${context.craftName}待交出仓`,
    warehouseLocation: `${context.craftName}待交出仓-B01`,
  }
  if (context.objectType === '成衣' && actionResult.actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT') {
    if (!actionResult.skuQtyBySkuCode) {
      return mergeResult(base, { success: false, message: '成衣完工必须逐 SKU 确认完工件数' })
    }
    recordGarmentReadyToHandoverAtAuxiliaryFactory({
      sourceTaskOrderId: context.sourceTaskOrderId,
      sourceWorkOrderNo: context.sourceWorkOrderNo,
      targetFactoryId: context.currentFactoryId,
      targetFactoryName: context.currentFactoryName,
      productionOrderId: context.sourceProductionOrderId,
      productionOrderNo: context.sourceProductionOrderNo,
      totalCompletedQty: context.objectQty,
      completedQtyBySkuCode: actionResult.skuQtyBySkuCode,
      receiverKind: context.downstreamFactoryId === DEDICATED_POST_FACTORY_ID ? '后道工厂' : '裁床厂',
      receiverName: context.downstreamFactoryName,
      operatorUserId: actionResult.operatorUserId,
      operatorFactoryId: actionResult.operatorFactoryId,
      operatorRoleId: actionResult.operatorRoleId,
      operatorRoleName: actionResult.operatorRoleName,
    })
  }
  const waitHandover = ensureWaitHandoverWarehouseRecord(waitHandoverContext, actionResult)
  let result = mergeResult(base, {
    createdWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedFeiTicketIds: context.relatedFeiTicketIds,
    message: `${context.targetWarehouseName}已联动`,
  })
  if (actionResult.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER') {
    const handover = ensureHandoverRecord(waitHandoverContext, actionResult, waitHandover.warehouseRecordId)
    result = mergeResult(result, {
      createdHandoverRecordId: handover.handoverRecordId,
      updatedHandoverRecordId: handover.handoverRecordId,
      message: context.objectType === '成衣'
        ? `成衣已交往${context.downstreamFactoryName}`
        : '特殊工艺交出记录已联动并关联裁片菲票',
    })
  }
  return result
}

export function applyPostFinishingWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  const context = resolvePostFinishingContext(actionResult)
  const base = emptyLinkageResult(actionResult)
  if (!context) return mergeResult(base, { success: false, message: '未找到后道单，不能执行仓联动' })

  if (['POST_RECEIVE_FINISH', 'POST_QC_FINISH', 'POST_PROCESS_FINISH'].includes(actionResult.actionCode)) {
    const actionName =
      actionResult.actionCode === 'POST_RECEIVE_FINISH'
        ? '后道待质检'
        : actionResult.actionCode === 'POST_QC_FINISH'
          ? (actionResult.nextStatus === '待复检' ? '后道待复检' : '后道待后道')
          : '后道待复检'
    const waitProcess = ensureWaitProcessWarehouseRecord(
      { ...context, targetWarehouseName: '后道待加工仓', warehouseLocation: '后道待加工仓-H01' },
      actionResult,
      actionName,
    )
    return mergeResult(base, {
      createdWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      updatedWaitProcessWarehouseRecordId: waitProcess.warehouseRecordId,
      message: `${actionName}仓已联动`,
    })
  }

  if (actionResult.actionCode === 'POST_REPORT_DIFFERENCE') {
    const handover = listProcessHandoverRecords({ craftType: 'POST_FINISHING', sourceTaskOrderId: context.sourceTaskOrderId })[0]
    const warehouse =
      getProcessWarehouseRecordById(handover?.warehouseRecordId || '') ||
      ensureWaitProcessWarehouseRecord({ ...context, targetWarehouseName: '后道待加工仓' }, actionResult, '后道差异待处理')
    const diffQty = roundQty(actionResult.objectQty || context.objectQty)
    const difference = createProcessHandoverDifferenceRecord({
      handoverRecordId: handover?.handoverRecordId || '',
      warehouseRecordId: warehouse.warehouseRecordId,
      sourceTaskOrderId: context.sourceTaskOrderId,
      sourceWorkOrderNo: context.sourceWorkOrderNo,
      sourceProductionOrderId: context.sourceProductionOrderId,
      sourceProductionOrderNo: context.sourceProductionOrderNo,
      craftType: 'POST_FINISHING',
      craftName: '后道',
      objectType: '成衣',
      expectedObjectQty: context.plannedObjectQty,
      actualObjectQty: Math.max(context.plannedObjectQty - diffQty, 0),
      diffObjectQty: diffQty,
      qtyUnit: '件',
      reportedBy: actionResult.sourceChannel === '移动端' ? '移动端操作员' : 'Web 端操作员',
      relatedFeiTicketIds: [],
      remark: `${actionResult.sourceChannel || '统一写回'}上报后道成衣件数差异`,
    })
    return mergeResult(base, {
      createdDifferenceRecordId: difference.differenceRecordId,
      updatedDifferenceRecordId: difference.differenceRecordId,
      message: '后道差异记录已联动',
    })
  }

  if (actionResult.actionCode !== 'POST_RECHECK_FINISH') return base
  const waitHandover = ensureWaitHandoverWarehouseRecord(context, actionResult)
  let result = mergeResult(base, {
    createdWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    updatedWaitHandoverWarehouseRecordId: waitHandover.warehouseRecordId,
    message: '后道待交出仓已联动',
  })
  return result
}

export function applyWarehouseLinkageAfterAction(actionResult: ProcessWarehouseLinkageActionResult): ProcessWarehouseLinkageResult {
  if (!actionResult.success) return emptyLinkageResult(actionResult, '动作未成功，不执行仓交出联动')
  if (actionResult.sourceType === 'PRINT') return applyPrintWarehouseLinkageAfterAction(actionResult)
  if (actionResult.sourceType === 'DYE') return applyDyeWarehouseLinkageAfterAction(actionResult)
  if (actionResult.sourceType === 'CUTTING') return applyCuttingWarehouseLinkageAfterAction(actionResult)
  if (actionResult.sourceType === 'SPECIAL_CRAFT') return applySpecialCraftWarehouseLinkageAfterAction(actionResult)
  return applyPostFinishingWarehouseLinkageAfterAction(actionResult)
}

export const PROCESS_WAREHOUSE_LINKAGE_SERVICE_SOURCE = '待加工仓、待交出仓、交出、回写统一联动服务'
