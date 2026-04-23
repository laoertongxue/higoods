import { mockFactories } from './factory-mock-data.ts'
import type { Factory } from './factory-types.ts'
import type {
  FactoryInternalWarehouse,
  FactoryWaitHandoverStockItem,
  FactoryWaitProcessStockItem,
  FactoryWarehouseInboundRecord,
  FactoryWarehouseNodeRow,
  FactoryWarehouseOutboundRecord,
  FactoryWarehouseStocktakeOrder,
} from './factory-internal-warehouse.ts'
import {
  buildFactoryWaitHandoverStockItemFromOutboundRecord,
  buildFactoryWaitProcessStockItemFromInboundRecord,
  findFactoryInternalWarehouseByFactoryAndKind,
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseNodeRows,
  listFactoryWarehouseOutboundRecords,
  listFactoryWarehouseStocktakeOrders,
  upsertFactoryWaitHandoverStockItem,
  upsertFactoryWaitProcessStockItem,
  upsertFactoryWarehouseInboundRecord,
  upsertFactoryWarehouseOutboundRecord,
} from './factory-internal-warehouse.ts'
import type { SpecialCraftOperationDefinition, SpecialCraftTargetObject } from './special-craft-operations.ts'
import {
  buildSpecialCraftOperationSlug,
  getSpecialCraftOperationById,
  getSpecialCraftOperationBySlug as getOperationBySlug,
  listEnabledSpecialCraftOperationDefinitions,
} from './special-craft-operations.ts'
import {
  generateSpecialCraftTaskOrdersForAllProductionOrders,
  getSpecialCraftGenerationBatchByProductionOrder,
} from './special-craft-task-generation.ts'

export type SpecialCraftTaskStatus =
  | '待领料'
  | '已入待加工仓'
  | '加工中'
  | '已完成'
  | '待交出'
  | '已交出'
  | '已回写'
  | '差异'
  | '异议中'
  | '异常'

export type SpecialCraftTaskAbnormalStatus =
  | '无异常'
  | '数量差异'
  | '破损'
  | '错片'
  | '延期'
  | '设备异常'
  | '其他异常'

export type SpecialCraftTaskGenerationSource = 'PRODUCTION_ORDER' | 'PROTOTYPE_SEED'
export type SpecialCraftTaskSourceTrigger = 'PRODUCTION_ORDER_CREATED' | 'PROTOTYPE_SEED'
export type SpecialCraftTaskAssignmentStatus = 'WAIT_ASSIGN' | 'ASSIGNED'
export type SpecialCraftTaskExecutionStatus =
  | 'WAIT_PICKUP'
  | 'IN_WAIT_PROCESS_WAREHOUSE'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'WAIT_HANDOVER'
  | 'HANDED_OVER'
  | 'WRITTEN_BACK'
  | 'DIFFERENCE'
  | 'OBJECTION'
  | 'ABNORMAL'

export interface SpecialCraftTaskDemandLine {
  demandLineId: string
  taskOrderId: string
  productionOrderId: string
  productionOrderNo: string
  patternFileId: string
  patternFileName: string
  pieceRowId: string
  partName: string
  colorName: string
  colorCode: string
  sizeCode: string
  pieceCountPerGarment: number
  orderQty: number
  planPieceQty: number
  specialCraftKey: string
  operationId: string
  operationName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  targetObject: SpecialCraftTargetObject
  unit: string
  feiTicketNos: string[]
  bundleWidthCm?: number
  bundleLengthCm?: number
  stripCount?: number
  remark?: string
}

export interface SpecialCraftTaskWorkOrderLine {
  lineId: string
  workOrderId: string
  taskOrderId: string
  demandLineId: string
  partName: string
  colorName: string
  colorCode: string
  sizeCode: string
  pieceCountPerGarment: number
  orderQty: number
  planPieceQty: number
  currentQty: number
  feiTicketNos: string[]
  bundleWidthCm?: number
  bundleLengthCm?: number
  stripCount?: number
  remark?: string
}

export interface SpecialCraftTaskWorkOrder {
  workOrderId: string
  workOrderNo: string
  taskOrderId: string
  taskOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  operationId: string
  operationName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  factoryId: string
  factoryName: string
  targetObject: string
  partName: string
  planQty: number
  receivedQty: number
  scrapQty: number
  damageQty: number
  currentQty: number
  returnedQty: number
  waitReturnQty: number
  status: string
  openDifferenceReportCount: number
  openObjectionCount: number
  feiTicketNos: string[]
  lineIds: string[]
  createdAt: string
  updatedAt: string
  remark?: string
}

export interface SpecialCraftTaskGenerationError {
  errorId: string
  productionOrderId: string
  productionOrderNo: string
  patternFileId: string
  pieceRowId: string
  partName: string
  colorName?: string
  sizeCode?: string
  operationName: string
  errorType:
    | '裁片部位缺失'
    | '裁片颜色片数缺失'
    | '生产数量缺失'
    | '特殊工艺未启用'
    | '特殊工艺字典缺失'
    | '作用对象缺失'
  errorMessage: string
  blocking: boolean
}

export interface SpecialCraftTaskGenerationBatch {
  generationBatchId: string
  productionOrderId: string
  productionOrderNo: string
  productionOrderVersion: string
  techPackSnapshotId: string
  techPackVersion: string
  generatedAt: string
  generatedBy: string
  generatedTaskOrderIds: string[]
  generatedLineCount: number
  status: '已生成' | '生成失败' | '已跳过'
  errorList: SpecialCraftTaskGenerationError[]
  warningList: string[]
}

export interface SpecialCraftTaskNodeRecord {
  nodeRecordId: string
  taskOrderId: string
  nodeName: SpecialCraftTaskStatus
  actionName: string
  beforeStatus: string
  afterStatus: string
  qty: number
  unit: string
  operatorName: string
  operatedAt: string
  relatedRecordNo?: string
  relatedRecordType?: '入库记录' | '出库记录' | '交出记录' | '任务记录' | '异常记录'
  photoCount: number
  remark?: string
}

export interface SpecialCraftTaskWarehouseLink {
  linkId: string
  taskOrderId: string
  warehouseKind: '待加工仓' | '待交出仓'
  warehouseName: string
  inboundRecordId?: string
  inboundRecordNo?: string
  outboundRecordId?: string
  outboundRecordNo?: string
  waitProcessStockItemId?: string
  waitHandoverStockItemId?: string
  handoverRecordId?: string
  handoverRecordNo?: string
  status: '已入库' | '待交出' | '已出库' | '已回写' | '差异' | '异议中'
}

export interface SpecialCraftTaskAbnormalRecord {
  abnormalId: string
  taskOrderId: string
  abnormalType: '数量差异' | '破损' | '错片' | '延期' | '设备异常' | '其他异常'
  qty: number
  unit: string
  description: string
  photoCount: number
  reportedBy: string
  reportedAt: string
  status: '待处理' | '处理中' | '已关闭'
}

export interface SpecialCraftTaskOrder {
  taskOrderId: string
  taskOrderNo: string
  operationId: string
  operationName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  factoryId: string
  factoryName: string
  productionOrderId: string
  productionOrderNo: string
  productionOrderVersion?: string
  techPackSnapshotId?: string
  techPackVersion?: string
  sourceTaskId?: string
  sourceTaskNo?: string
  generationBatchId?: string
  generationSource?: SpecialCraftTaskGenerationSource
  generationSourceLabel?: string
  sourceTrigger?: SpecialCraftTaskSourceTrigger
  sourceTriggerLabel?: string
  assignmentStatus?: SpecialCraftTaskAssignmentStatus
  assignmentStatusLabel?: string
  executionStatus?: SpecialCraftTaskExecutionStatus
  executionStatusLabel?: string
  demandLines?: SpecialCraftTaskDemandLine[]
  sourcePieceRowIds?: string[]
  sourcePatternFileIds?: string[]
  sourceSpecialCraftKeys?: string[]
  targetObject: SpecialCraftTargetObject
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNos: string[]
  transferBagNos: string[]
  fabricRollNos: string[]
  materialSku?: string
  planQty: number
  receivedQty: number
  completedQty: number
  lossQty: number
  damageQty?: number
  currentQty?: number
  returnedQty?: number
  waitHandoverQty: number
  unit: string
  status: SpecialCraftTaskStatus
  abnormalStatus: SpecialCraftTaskAbnormalStatus
  dueAt: string
  createdAt: string
  updatedAt?: string
  waitProcessStockItemIds?: string[]
  waitHandoverStockItemIds?: string[]
  inboundRecordIds?: string[]
  outboundRecordIds?: string[]
  validationWarnings?: string[]
  workOrderIds?: string[]
  openDifferenceReportCount?: number
  openObjectionCount?: number
  isGenerated?: boolean
  isManualCreated?: boolean
  generationKey?: string
  suggestedFactoryId?: string
  suggestedFactoryName?: string
  assignedFactoryId?: string
  assignedFactoryName?: string
  assignmentMode?: string
  nodeRecords: SpecialCraftTaskNodeRecord[]
  warehouseLinks: SpecialCraftTaskWarehouseLink[]
  abnormalRecords: SpecialCraftTaskAbnormalRecord[]
  remark?: string
}

export interface SpecialCraftTaskStatistic {
  statisticId: string
  operationId: string
  operationName: string
  factoryId: string
  factoryName: string
  date: string
  taskCount: number
  planQty: number
  receivedQty: number
  completedQty: number
  waitHandoverQty: number
  waitPickupTaskCount: number
  waitProcessTaskCount: number
  processingTaskCount: number
  completedTaskCount: number
  waitHandoverTaskCount: number
  handedOverTaskCount: number
  writtenBackTaskCount: number
  differenceTaskCount: number
  objectionTaskCount: number
  abnormalTaskCount: number
  unit: string
}

export interface SpecialCraftWarehouseView {
  operation: SpecialCraftOperationDefinition
  factoryIds: string[]
  waitProcessItems: FactoryWaitProcessStockItem[]
  waitHandoverItems: FactoryWaitHandoverStockItem[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  outboundRecords: FactoryWarehouseOutboundRecord[]
  warehouses: FactoryInternalWarehouse[]
  nodeRows: FactoryWarehouseNodeRow[]
  stocktakeOrders: FactoryWarehouseStocktakeOrder[]
}

interface SpecialCraftTaskFilters {
  factoryId?: string
  status?: string
  abnormalStatus?: string
  keyword?: string
  timeRange?: 'TODAY' | '7D' | '30D' | 'ALL'
}

interface TaskSeedContext {
  operation: SpecialCraftOperationDefinition
  taskOrderId: string
  taskOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  factory: Factory
  targetObject: SpecialCraftTargetObject
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNos: string[]
  transferBagNos: string[]
  fabricRollNos: string[]
  materialSku?: string
  unit: string
  itemName: string
  itemKind: '裁片' | '面料' | '成衣半成品'
  planQty: number
  receivedQty: number
  completedQty: number
  lossQty: number
  waitHandoverQty: number
  status: SpecialCraftTaskStatus
  abnormalStatus: SpecialCraftTaskAbnormalStatus
  createdAt: string
  dueAt: string
  receiverName: string
  receiverKind: FactoryWaitHandoverStockItem['receiverKind']
  sourceAction: '领料确认' | '交出接收'
  sourceRecordType: FactoryWarehouseInboundRecord['sourceRecordType']
  sourceRecordNo: string
  sourceObjectName: string
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  handoverRecordQrValue: string
}

interface WarehouseArtifacts {
  inboundRecord?: FactoryWarehouseInboundRecord
  waitProcessStockItem?: FactoryWaitProcessStockItem
  waitHandoverStockItem?: FactoryWaitHandoverStockItem
  outboundRecord?: FactoryWarehouseOutboundRecord
}

interface SpecialCraftTaskStore {
  taskOrders: SpecialCraftTaskOrder[]
  workOrders: SpecialCraftTaskWorkOrder[]
  workOrderLines: SpecialCraftTaskWorkOrderLine[]
  statistics: SpecialCraftTaskStatistic[]
  generationBatches: SpecialCraftTaskGenerationBatch[]
  generationErrors: SpecialCraftTaskGenerationError[]
}

const PART_NAMES = ['前片', '后片', '袖片', '领片', '门襟', '裤身片', '侧片']
const FABRIC_COLORS = ['象牙白', '海军蓝', '雾霾灰', '焦糖棕', '雾粉', '橄榄绿', '深炭黑']
const SIZE_CODES = ['S', 'M', 'L', 'XL', '2XL']
const PRIMARY_STATUSES: SpecialCraftTaskStatus[] = ['待领料', '已入待加工仓', '加工中', '加工中', '已完成', '已入待加工仓', '待领料']
const FLOW_STATUSES: SpecialCraftTaskStatus[] = ['待交出', '已交出', '已回写', '差异', '异议中', '待交出', '已回写']
const PRIMARY_ABNORMALS: SpecialCraftTaskAbnormalStatus[] = ['无异常', '数量差异', '设备异常', '无异常', '延期', '无异常', '无异常']
const FLOW_ABNORMALS: SpecialCraftTaskAbnormalStatus[] = ['无异常', '无异常', '无异常', '数量差异', '数量差异', '破损', '无异常']
let specialCraftTaskStore: SpecialCraftTaskStore | null = null

function formatDay(offsetDays = 0): string {
  const date = new Date(Date.UTC(2026, 3, 23 + offsetDays, 9, 0, 0))
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100
}

function resolveOperationFactories(operation: SpecialCraftOperationDefinition): Factory[] {
  const matched = mockFactories.filter((factory) =>
    factory.processAbilities.some((ability) => ability.craftCodes.includes(operation.craftCode)),
  )
  const preferred = operation.targetObject === '完整面料' || operation.targetObject === '面料'
    ? matched.filter((factory) => factory.factoryType === 'CENTRAL_DENIM_WASH')
    : matched.filter((factory) => factory.factoryType === 'SATELLITE_FINISHING' || factory.factoryType === 'CENTRAL_SPECIAL')
  const pool = preferred.length > 0 ? preferred : matched
  if (pool.length === 0) {
    throw new Error(`未找到特殊工艺执行工厂：${operation.operationName}`)
  }
  return pool
}

function pickFactoryForOperation(operation: SpecialCraftOperationDefinition, variantIndex: number): Factory {
  const pool = resolveOperationFactories(operation)
  return pool[variantIndex % pool.length]
}

function getWarehouse(factoryId: string, warehouseKind: FactoryInternalWarehouse['warehouseKind']): FactoryInternalWarehouse {
  const warehouse = findFactoryInternalWarehouseByFactoryAndKind(factoryId, warehouseKind)
  if (!warehouse) {
    throw new Error(`未找到仓库：${factoryId} / ${warehouseKind}`)
  }
  return warehouse
}

function pickWarehousePosition(
  warehouse: FactoryInternalWarehouse,
  preferredAreaName: 'A区' | 'B区' | '异常区' | '待确认区',
  seed: number,
): { areaName: string; shelfNo: string; locationNo: string; locationText: string } {
  const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName) ?? warehouse.areaList[0]
  const shelf = area.shelfList[seed % area.shelfList.length]
  const location = shelf.locationList[seed % shelf.locationList.length]
  return {
    areaName: area.areaName,
    shelfNo: shelf.shelfNo,
    locationNo: location.locationNo,
    locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
  }
}

function getTaskUnit(targetObject: SpecialCraftTargetObject): string {
  if (targetObject === '完整面料' || targetObject === '面料') return '卷'
  if (targetObject === '成衣半成品') return '件'
  return '片'
}

function getTaskItemKind(targetObject: SpecialCraftTargetObject): '裁片' | '面料' | '成衣半成品' {
  if (targetObject === '完整面料' || targetObject === '面料') return '面料'
  if (targetObject === '成衣半成品') return '成衣半成品'
  return '裁片'
}

function getTaskItemName(operation: SpecialCraftOperationDefinition, targetObject: SpecialCraftTargetObject, partName?: string): string {
  if (targetObject === '完整面料' || targetObject === '面料') {
    return `${operation.operationName}面料批次`
  }
  if (targetObject === '成衣半成品') {
    return `${operation.operationName}半成品工单`
  }
  return `${partName || '裁片'}${operation.operationName}任务`
}

function getReceiverKind(operation: SpecialCraftOperationDefinition): FactoryWaitHandoverStockItem['receiverKind'] {
  return operation.mustReturnToCuttingFactory ? '裁床厂' : '中转仓'
}

function getReceiverName(operation: SpecialCraftOperationDefinition): string {
  if (operation.mustReturnToCuttingFactory) {
    return mockFactories.find((factory) => factory.factoryType === 'CENTRAL_CUTTING')?.name ?? '裁床厂'
  }
  return '公司中转仓'
}

function buildTaskSeed(operation: SpecialCraftOperationDefinition, operationIndex: number, variantIndex: number): TaskSeedContext {
  const factory = pickFactoryForOperation(operation, variantIndex)
  const baseSuffix = `${String(operationIndex + 1).padStart(2, '0')}${String(variantIndex + 1).padStart(2, '0')}`
  const isFabricTarget = operation.targetObject === '完整面料' || operation.targetObject === '面料'
  const isCutPieceTarget = operation.targetObject === '已裁部位' || operation.targetObject === '裁片'
  const planQty = isFabricTarget ? 6 + operationIndex + variantIndex : 180 + operationIndex * 40 + variantIndex * 26
  const receivedQty =
    variantIndex === 0 && PRIMARY_STATUSES[operationIndex % PRIMARY_STATUSES.length] === '待领料'
      ? 0
      : roundQty(planQty - ((operationIndex + variantIndex) % 3 === 0 ? 4 : 0))
  const completedQty = roundQty(Math.max(receivedQty - (variantIndex === 1 ? (operationIndex % 2) + 1 : 0), 0))
  const lossQty = roundQty(Math.max(receivedQty - completedQty, 0))
  const waitHandoverQty = roundQty(Math.max(completedQty - (variantIndex === 1 ? (operationIndex % 3) * 12 : 0), 0))
  const targetObject = operation.targetObject
  const partName = isCutPieceTarget ? PART_NAMES[(operationIndex + variantIndex) % PART_NAMES.length] : undefined
  const fabricColor = FABRIC_COLORS[(operationIndex + variantIndex) % FABRIC_COLORS.length]
  const sizeCode = isCutPieceTarget ? SIZE_CODES[(operationIndex + variantIndex) % SIZE_CODES.length] : undefined
  const feiTicketNos = isCutPieceTarget ? [`FP-${baseSuffix}-01`, `FP-${baseSuffix}-02`] : []
  const transferBagNos = isCutPieceTarget && variantIndex === 1 ? [`TB-${baseSuffix}`] : []
  const fabricRollNos = isFabricTarget ? [`ROLL-${baseSuffix}-A`, `ROLL-${baseSuffix}-B`] : []
  const materialSku = isFabricTarget ? `FAB-${String(operationIndex + 1).padStart(3, '0')}` : `PANEL-${String(operationIndex + 1).padStart(3, '0')}`
  const status = variantIndex === 0
    ? PRIMARY_STATUSES[operationIndex % PRIMARY_STATUSES.length]
    : FLOW_STATUSES[operationIndex % FLOW_STATUSES.length]
  const abnormalStatus = variantIndex === 0
    ? PRIMARY_ABNORMALS[operationIndex % PRIMARY_ABNORMALS.length]
    : FLOW_ABNORMALS[operationIndex % FLOW_ABNORMALS.length]
  const sourceAction: '领料确认' | '交出接收' =
    variantIndex === 0 || isFabricTarget ? '领料确认' : '交出接收'
  const sourceRecordType: FactoryWarehouseInboundRecord['sourceRecordType'] =
    sourceAction === '领料确认' && isFabricTarget ? 'MATERIAL_PICKUP' : 'HANDOVER_RECEIVE'

  return {
    operation,
    taskOrderId: `SC-TASK-${operation.operationId}-${String(variantIndex + 1).padStart(2, '0')}`,
    taskOrderNo: `TG-${operation.operationId.slice(-6)}-${String(variantIndex + 1).padStart(2, '0')}`,
    productionOrderId: `PO-${operation.operationId.slice(-6)}-${baseSuffix}`,
    productionOrderNo: `SCPO-${operation.operationId.slice(-6)}-${baseSuffix}`,
    sourceTaskId: `TASK-SC-${operation.operationId.slice(-6)}-${baseSuffix}`,
    sourceTaskNo: `TASK-SC-${operation.operationId.slice(-6)}-${baseSuffix}`,
    factory,
    targetObject,
    partName,
    fabricColor,
    sizeCode,
    feiTicketNos,
    transferBagNos,
    fabricRollNos,
    materialSku,
    unit: getTaskUnit(targetObject),
    itemName: getTaskItemName(operation, targetObject, partName),
    itemKind: getTaskItemKind(targetObject),
    planQty,
    receivedQty,
    completedQty,
    lossQty,
    waitHandoverQty,
    status,
    abnormalStatus,
    createdAt: formatDay(-(operationIndex + variantIndex + 2)),
    dueAt: formatDay(operationIndex + variantIndex + 1),
    receiverName: getReceiverName(operation),
    receiverKind: getReceiverKind(operation),
    sourceAction,
    sourceRecordType,
    sourceRecordNo: `${sourceAction === '领料确认' ? 'LL' : 'JS'}-${operation.operationId.slice(-6)}-${baseSuffix}`,
    sourceObjectName:
      sourceAction === '领料确认'
        ? isFabricTarget
          ? '面辅料仓'
          : mockFactories.find((factoryItem) => factoryItem.factoryType === 'CENTRAL_CUTTING')?.name ?? '裁床厂'
        : mockFactories.find((factoryItem) => factoryItem.factoryType === 'CENTRAL_CUTTING')?.name ?? '裁床厂',
    handoverOrderId: `SC-HO-${operation.operationId.slice(-6)}-${baseSuffix}`,
    handoverOrderNo: `SC-HDO-${operation.operationId.slice(-6)}-${baseSuffix}`,
    handoverRecordId: `SC-HR-${operation.operationId.slice(-6)}-${baseSuffix}`,
    handoverRecordNo: `SC-HDR-${operation.operationId.slice(-6)}-${baseSuffix}`,
    handoverRecordQrValue: `SCQR-${operation.operationId.slice(-6)}-${baseSuffix}`,
  }
}

function shouldCreateInboundRecord(status: SpecialCraftTaskStatus): boolean {
  return status !== '待领料'
}

function shouldCreateWaitProcessRecord(status: SpecialCraftTaskStatus): boolean {
  return ['已入待加工仓', '加工中', '差异', '异常'].includes(status)
}

function shouldCreatePendingWaitHandoverRecord(status: SpecialCraftTaskStatus): boolean {
  return ['已完成', '待交出'].includes(status)
}

function shouldCreateOutboundRecord(status: SpecialCraftTaskStatus): boolean {
  return ['已交出', '已回写', '差异', '异议中'].includes(status)
}

function buildInboundArtifacts(seed: TaskSeedContext, positionIndex: number): WarehouseArtifacts {
  if (!shouldCreateInboundRecord(seed.status)) return {}

  const warehouse = getWarehouse(seed.factory.id, 'WAIT_PROCESS')
  const inboundPosition = pickWarehousePosition(
    warehouse,
    seed.status === '差异' || seed.abnormalStatus === '数量差异' ? '异常区' : 'A区',
    positionIndex,
  )
  const differenceQty = roundQty(seed.receivedQty - seed.planQty)
  const inboundRecord = upsertFactoryWarehouseInboundRecord({
    inboundRecordId: `SC-INB-${seed.taskOrderId}`,
    inboundRecordNo: `RK-${seed.taskOrderNo}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: seed.factory.id,
    factoryName: seed.factory.name,
    factoryKind: seed.factory.factoryType,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    sourceRecordId: `SC-SRC-${seed.taskOrderId}`,
    sourceRecordNo: seed.sourceRecordNo,
    sourceRecordType: seed.sourceRecordType,
    sourceObjectName: seed.sourceObjectName,
    taskId: seed.sourceTaskId,
    taskNo: seed.sourceTaskNo,
    itemKind: seed.itemKind,
    itemName: seed.itemName,
    materialSku: seed.materialSku,
    partName: seed.partName,
    fabricColor: seed.fabricColor,
    sizeCode: seed.sizeCode,
    feiTicketNo: seed.feiTicketNos[0],
    transferBagNo: seed.transferBagNos[0],
    fabricRollNo: seed.fabricRollNos[0],
    expectedQty: seed.planQty,
    receivedQty: seed.receivedQty,
    differenceQty,
    unit: seed.unit,
    receiverName: seed.factory.contact,
    receivedAt: seed.createdAt,
    areaName: inboundPosition.areaName,
    shelfNo: inboundPosition.shelfNo,
    locationNo: inboundPosition.locationNo,
    status: differenceQty !== 0 ? '差异待处理' : '已入库',
    abnormalReason: differenceQty !== 0 ? '数量不符' : undefined,
    photoList: differenceQty !== 0 ? ['diff-photo-1.jpg'] : [],
    remark: '由交接自动转单',
  })

  const waitProcessStockItem = shouldCreateWaitProcessRecord(seed.status)
    ? upsertFactoryWaitProcessStockItem({
        ...buildFactoryWaitProcessStockItemFromInboundRecord(inboundRecord),
        stockItemId: `SC-WPS-${seed.taskOrderId}`,
        productionOrderId: seed.productionOrderId,
        productionOrderNo: seed.productionOrderNo,
        taskId: seed.sourceTaskId,
        taskNo: seed.sourceTaskNo,
        status: differenceQty !== 0 ? '差异待处理' : '已入待加工仓',
        remark: seed.sourceAction,
      })
    : undefined

  const linkedInbound = upsertFactoryWarehouseInboundRecord({
    ...inboundRecord,
    generatedStockItemId: waitProcessStockItem?.stockItemId,
  })

  return {
    inboundRecord: linkedInbound,
    waitProcessStockItem,
  }
}

function buildPendingWaitHandoverItem(seed: TaskSeedContext, positionIndex: number): FactoryWaitHandoverStockItem {
  const warehouse = getWarehouse(seed.factory.id, 'WAIT_HANDOVER')
  const position = pickWarehousePosition(warehouse, 'B区', positionIndex)
  return upsertFactoryWaitHandoverStockItem({
    stockItemId: `SC-WHS-${seed.taskOrderId}`,
    warehouseId: warehouse.warehouseId,
    factoryId: seed.factory.id,
    factoryName: seed.factory.name,
    factoryKind: seed.factory.factoryType,
    warehouseName: warehouse.warehouseName,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    taskId: seed.sourceTaskId,
    taskNo: seed.sourceTaskNo,
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderNo,
    itemKind: seed.itemKind,
    itemName: seed.itemName,
    materialSku: seed.materialSku,
    partName: seed.partName,
    fabricColor: seed.fabricColor,
    sizeCode: seed.sizeCode,
    feiTicketNo: seed.feiTicketNos[0],
    transferBagNo: seed.transferBagNos[0],
    fabricRollNo: seed.fabricRollNos[0],
    completedQty: seed.completedQty,
    lossQty: seed.lossQty,
    waitHandoverQty: seed.waitHandoverQty,
    unit: seed.unit,
    receiverKind: seed.receiverKind,
    receiverName: seed.receiverName,
    handoverOrderId: seed.handoverOrderId,
    handoverOrderNo: seed.handoverOrderNo,
    areaName: position.areaName,
    shelfNo: position.shelfNo,
    locationNo: position.locationNo,
    locationText: position.locationText,
    status: '待交出',
    photoList: [],
    remark: '由任务完工沉淀',
  })
}

function buildOutboundArtifacts(seed: TaskSeedContext, positionIndex: number): WarehouseArtifacts {
  if (shouldCreatePendingWaitHandoverRecord(seed.status)) {
    return {
      waitHandoverStockItem: buildPendingWaitHandoverItem(seed, positionIndex),
    }
  }
  if (!shouldCreateOutboundRecord(seed.status)) return {}

  const warehouse = getWarehouse(seed.factory.id, 'WAIT_HANDOVER')
  const outboundPosition = pickWarehousePosition(
    warehouse,
    seed.status === '差异' || seed.status === '异议中' ? '异常区' : '待确认区',
    positionIndex,
  )
  const outboundQty = roundQty(seed.completedQty - seed.lossQty)
  const receiverWrittenQty =
    seed.status === '已回写'
      ? outboundQty
      : seed.status === '差异'
        ? roundQty(outboundQty - 6)
        : seed.status === '异议中'
          ? roundQty(outboundQty - 4)
          : undefined
  const differenceQty = typeof receiverWrittenQty === 'number' ? roundQty(receiverWrittenQty - outboundQty) : undefined
  const outboundStatus: FactoryWarehouseOutboundRecord['status'] =
    seed.status === '已交出'
      ? '已出库'
      : seed.status === '已回写'
        ? '已回写'
        : seed.status === '差异'
          ? '差异'
          : '异议中'
  const outboundRecord = upsertFactoryWarehouseOutboundRecord({
    outboundRecordId: `SC-OUT-${seed.taskOrderId}`,
    outboundRecordNo: `CK-${seed.taskOrderNo}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: seed.factory.id,
    factoryName: seed.factory.name,
    factoryKind: seed.factory.factoryType,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    sourceTaskId: seed.sourceTaskId,
    sourceTaskNo: seed.sourceTaskNo,
    handoverOrderId: seed.handoverOrderId,
    handoverOrderNo: seed.handoverOrderNo,
    handoverRecordId: seed.handoverRecordId,
    handoverRecordNo: seed.handoverRecordNo,
    handoverRecordQrValue: seed.handoverRecordQrValue,
    receiverKind: seed.receiverKind,
    receiverName: seed.receiverName,
    itemKind: seed.itemKind,
    itemName: seed.itemName,
    materialSku: seed.materialSku,
    partName: seed.partName,
    fabricColor: seed.fabricColor,
    sizeCode: seed.sizeCode,
    feiTicketNo: seed.feiTicketNos[0],
    transferBagNo: seed.transferBagNos[0],
    fabricRollNo: seed.fabricRollNos[0],
    outboundQty,
    receiverWrittenQty,
    differenceQty,
    unit: seed.unit,
    operatorName: seed.factory.contact,
    outboundAt: seed.createdAt,
    status: outboundStatus,
    abnormalReason:
      seed.status === '差异'
        ? '回写数量不符'
        : seed.status === '异议中'
          ? '已发起数量异议'
          : undefined,
    photoList: seed.status === '差异' || seed.status === '异议中' ? ['handover-proof-1.jpg'] : [],
    remark: '由交接自动转单',
  })
  const waitHandoverStockItem = upsertFactoryWaitHandoverStockItem({
    ...buildFactoryWaitHandoverStockItemFromOutboundRecord(outboundRecord),
    stockItemId: `SC-WHS-${seed.taskOrderId}`,
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderNo,
    handoverOrderId: seed.handoverOrderId,
    handoverOrderNo: seed.handoverOrderNo,
    handoverRecordId: seed.handoverRecordId,
    handoverRecordNo: seed.handoverRecordNo,
    handoverRecordQrValue: seed.handoverRecordQrValue,
    areaName: outboundPosition.areaName,
    shelfNo: outboundPosition.shelfNo,
    locationNo: outboundPosition.locationNo,
    locationText: outboundPosition.locationText,
    status:
      seed.status === '已交出'
        ? '已交出'
        : seed.status === '已回写'
          ? '已回写'
          : seed.status === '差异'
            ? '差异'
            : '异议中',
    differenceQty,
    objectionStatus: seed.status === '异议中' ? '异议中' : undefined,
    relatedWaitHandoverStockItemId: undefined,
    remark: '由交接自动转单',
  } as FactoryWaitHandoverStockItem)
  const linkedOutbound = upsertFactoryWarehouseOutboundRecord({
    ...outboundRecord,
    relatedWaitHandoverStockItemId: waitHandoverStockItem.stockItemId,
  })
  return {
    outboundRecord: linkedOutbound,
    waitHandoverStockItem,
  }
}

function buildWarehouseLinks(seed: TaskSeedContext, artifacts: WarehouseArtifacts): SpecialCraftTaskWarehouseLink[] {
  const links: SpecialCraftTaskWarehouseLink[] = []

  if (artifacts.inboundRecord) {
    links.push({
      linkId: `${seed.taskOrderId}-WAIT_PROCESS`,
      taskOrderId: seed.taskOrderId,
      warehouseKind: '待加工仓',
      warehouseName: artifacts.inboundRecord.warehouseName,
      inboundRecordId: artifacts.inboundRecord.inboundRecordId,
      inboundRecordNo: artifacts.inboundRecord.inboundRecordNo,
      waitProcessStockItemId: artifacts.waitProcessStockItem?.stockItemId,
      status: artifacts.inboundRecord.status === '差异待处理' ? '差异' : '已入库',
    })
  }

  if (artifacts.waitHandoverStockItem) {
    links.push({
      linkId: `${seed.taskOrderId}-WAIT_HANDOVER`,
      taskOrderId: seed.taskOrderId,
      warehouseKind: '待交出仓',
      warehouseName: artifacts.waitHandoverStockItem.warehouseName,
      outboundRecordId: artifacts.outboundRecord?.outboundRecordId,
      outboundRecordNo: artifacts.outboundRecord?.outboundRecordNo,
      waitHandoverStockItemId: artifacts.waitHandoverStockItem.stockItemId,
      handoverRecordId: artifacts.waitHandoverStockItem.handoverRecordId,
      handoverRecordNo: artifacts.waitHandoverStockItem.handoverRecordNo,
      status:
        artifacts.waitHandoverStockItem.status === '待交出'
          ? '待交出'
          : artifacts.waitHandoverStockItem.status === '已交出'
            ? '已出库'
            : artifacts.waitHandoverStockItem.status,
    })
  }

  return links
}

function createNodeRecord(
  seed: TaskSeedContext,
  index: number,
  input: Omit<SpecialCraftTaskNodeRecord, 'nodeRecordId' | 'taskOrderId'>,
): SpecialCraftTaskNodeRecord {
  return {
    nodeRecordId: `${seed.taskOrderId}-NODE-${String(index + 1).padStart(2, '0')}`,
    taskOrderId: seed.taskOrderId,
    ...input,
  }
}

function buildNodeRecords(seed: TaskSeedContext, artifacts: WarehouseArtifacts): SpecialCraftTaskNodeRecord[] {
  const rows: SpecialCraftTaskNodeRecord[] = []

  rows.push(
    createNodeRecord(seed, rows.length, {
      nodeName: '待领料',
      actionName: '来源生产单',
      beforeStatus: '待领料',
      afterStatus: '待领料',
      qty: seed.planQty,
      unit: seed.unit,
      operatorName: '系统',
      operatedAt: seed.createdAt,
      relatedRecordNo: seed.productionOrderNo,
      relatedRecordType: '任务记录',
      photoCount: 0,
      remark: '由生产单结果沉淀为特殊工艺任务单',
    }),
  )

  if (artifacts.inboundRecord) {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '已入待加工仓',
        actionName: seed.sourceAction,
        beforeStatus: '待领料',
        afterStatus: '已入待加工仓',
        qty: seed.receivedQty,
        unit: seed.unit,
        operatorName: seed.factory.contact,
        operatedAt: seed.createdAt,
        relatedRecordNo: artifacts.inboundRecord.inboundRecordNo,
        relatedRecordType: '入库记录',
        photoCount: artifacts.inboundRecord.photoList.length,
        remark: '自动转单进入待加工仓',
      }),
    )
  }

  if (['加工中', '已完成', '待交出', '已交出', '已回写', '差异', '异议中', '异常'].includes(seed.status)) {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: seed.status === '异常' ? '加工中' : '加工中',
        actionName: '开工',
        beforeStatus: '已入待加工仓',
        afterStatus: '加工中',
        qty: seed.receivedQty || seed.planQty,
        unit: seed.unit,
        operatorName: `${seed.factory.contact}组长`,
        operatedAt: formatDay(0),
        relatedRecordNo: seed.taskOrderNo,
        relatedRecordType: '任务记录',
        photoCount: 0,
        remark: '进入当前特殊工艺加工节点',
      }),
    )
  }

  if (['已完成', '待交出', '已交出', '已回写', '差异', '异议中'].includes(seed.status)) {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '已完成',
        actionName: '完工',
        beforeStatus: '加工中',
        afterStatus: '已完成',
        qty: seed.completedQty,
        unit: seed.unit,
        operatorName: `${seed.factory.contact}组长`,
        operatedAt: formatDay(1),
        relatedRecordNo: seed.taskOrderNo,
        relatedRecordType: '任务记录',
        photoCount: 1,
        remark: '已沉淀完工数量',
      }),
    )
  }

  if (artifacts.waitHandoverStockItem && ['已完成', '待交出'].includes(seed.status)) {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '待交出',
        actionName: '入待交出仓',
        beforeStatus: '已完成',
        afterStatus: '待交出',
        qty: seed.waitHandoverQty,
        unit: seed.unit,
        operatorName: '系统',
        operatedAt: formatDay(1),
        relatedRecordNo: artifacts.waitHandoverStockItem.handoverOrderNo || seed.handoverOrderNo,
        relatedRecordType: '任务记录',
        photoCount: 0,
        remark: '完工后沉淀到待交出仓',
      }),
    )
  }

  if (artifacts.outboundRecord) {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '已交出',
        actionName: '交出',
        beforeStatus: '待交出',
        afterStatus: '已交出',
        qty: artifacts.outboundRecord.outboundQty,
        unit: seed.unit,
        operatorName: seed.factory.contact,
        operatedAt: formatDay(2),
        relatedRecordNo: artifacts.outboundRecord.handoverRecordNo,
        relatedRecordType: '交出记录',
        photoCount: artifacts.outboundRecord.photoList.length,
        remark: '交接提交后自动生成出库记录',
      }),
    )
  }

  if (seed.status === '已回写') {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '已回写',
        actionName: '回写',
        beforeStatus: '已交出',
        afterStatus: '已回写',
        qty: seed.waitHandoverQty || seed.completedQty,
        unit: seed.unit,
        operatorName: seed.receiverName,
        operatedAt: formatDay(3),
        relatedRecordNo: artifacts.outboundRecord?.outboundRecordNo,
        relatedRecordType: '出库记录',
        photoCount: 0,
        remark: '接收方已完成回写',
      }),
    )
  }

  if (seed.status === '差异') {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '差异',
        actionName: '回写',
        beforeStatus: '已交出',
        afterStatus: '差异',
        qty: Math.abs(artifacts.outboundRecord?.differenceQty || 0),
        unit: seed.unit,
        operatorName: seed.receiverName,
        operatedAt: formatDay(3),
        relatedRecordNo: artifacts.outboundRecord?.outboundRecordNo,
        relatedRecordType: '出库记录',
        photoCount: 1,
        remark: '接收方回写数量与交出数量不符',
      }),
    )
  }

  if (seed.status === '异议中') {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '异议中',
        actionName: '发起异议',
        beforeStatus: '差异',
        afterStatus: '异议中',
        qty: Math.abs(artifacts.outboundRecord?.differenceQty || 0),
        unit: seed.unit,
        operatorName: seed.factory.contact,
        operatedAt: formatDay(4),
        relatedRecordNo: artifacts.outboundRecord?.handoverRecordNo,
        relatedRecordType: '交出记录',
        photoCount: 1,
        remark: '已发起数量异议，等待平台处理',
      }),
    )
  }

  if (seed.abnormalStatus !== '无异常') {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '异常',
        actionName: '记录异常',
        beforeStatus: seed.status,
        afterStatus: seed.status,
        qty: seed.status === '待领料' ? seed.planQty : seed.receivedQty || seed.completedQty,
        unit: seed.unit,
        operatorName: `${seed.factory.contact}组长`,
        operatedAt: formatDay(2),
        relatedRecordNo: `${seed.taskOrderNo}-ABN`,
        relatedRecordType: '异常记录',
        photoCount: 1,
        remark: `已登记${seed.abnormalStatus}`,
      }),
    )
  }

  return rows
}

function buildAbnormalRecords(seed: TaskSeedContext): SpecialCraftTaskAbnormalRecord[] {
  if (seed.abnormalStatus === '无异常') return []
  return [
    {
      abnormalId: `${seed.taskOrderId}-ABN-01`,
      taskOrderId: seed.taskOrderId,
      abnormalType: seed.abnormalStatus === '其他异常' ? '其他异常' : seed.abnormalStatus,
      qty: seed.status === '待领料' ? seed.planQty : Math.max(seed.receivedQty, seed.completedQty, 1),
      unit: seed.unit,
      description:
        seed.abnormalStatus === '数量差异'
          ? '接收或回写数量不一致，需复核差异来源。'
          : seed.abnormalStatus === '设备异常'
            ? '关键设备停机，已改排临时机台。'
            : seed.abnormalStatus === '延期'
              ? '上游交接延后，交期需重新确认。'
              : seed.abnormalStatus === '破损'
                ? '来料局部破损，已转异常区待处理。'
                : seed.abnormalStatus === '错片'
                  ? '裁片部位错配，待复核来源菲票。'
                  : '已登记现场异常，等待处理。',
      photoCount: 1,
      reportedBy: `${seed.factory.contact}组长`,
      reportedAt: formatDay(2),
      status: seed.status === '异议中' ? '处理中' : '待处理',
    },
  ]
}

function buildTaskOrder(seed: TaskSeedContext, artifacts: WarehouseArtifacts): SpecialCraftTaskOrder {
  const taskOrderId = seed.taskOrderId
  const demandLine: SpecialCraftTaskDemandLine = {
    demandLineId: `${taskOrderId}-LINE-01`,
    taskOrderId,
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderNo,
    patternFileId: `PF-${seed.operation.operationId}`,
    patternFileName: `${seed.operation.operationName}纸样`,
    pieceRowId: `PR-${taskOrderId}`,
    partName: seed.partName || seed.itemName,
    colorName: seed.fabricColor || '默认色',
    colorCode: seed.fabricColor || 'DEFAULT',
    sizeCode: seed.sizeCode || '均码',
    pieceCountPerGarment: 1,
    orderQty: seed.planQty,
    planPieceQty: seed.planQty,
    specialCraftKey: `${seed.operation.processCode}:${seed.operation.craftCode}`,
    operationId: seed.operation.operationId,
    operationName: seed.operation.operationName,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    targetObject: seed.targetObject,
    unit: seed.unit,
    feiTicketNos: [...seed.feiTicketNos],
    remark: '演示任务明细',
  }
  const taskOrder: SpecialCraftTaskOrder = {
    taskOrderId,
    taskOrderNo: seed.taskOrderNo,
    operationId: seed.operation.operationId,
    operationName: seed.operation.operationName,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    factoryId: seed.factory.id,
    factoryName: seed.factory.name,
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderNo,
    productionOrderVersion: 'POV-SEED',
    techPackSnapshotId: `TPS-${seed.operation.operationId}`,
    techPackVersion: '演示版',
    sourceTaskId: seed.sourceTaskId,
    sourceTaskNo: seed.sourceTaskNo,
    generationBatchId: `SCB-SEED-${seed.operation.operationId}`,
    generationSource: 'PROTOTYPE_SEED',
    generationSourceLabel: '生产单生成',
    sourceTrigger: 'PROTOTYPE_SEED',
    sourceTriggerLabel: '生产单生成',
    assignmentStatus: 'ASSIGNED',
    assignmentStatusLabel: '已分配',
    executionStatus:
      seed.status === '待领料'
        ? 'WAIT_PICKUP'
        : seed.status === '已入待加工仓'
          ? 'IN_WAIT_PROCESS_WAREHOUSE'
          : seed.status === '加工中'
            ? 'PROCESSING'
            : seed.status === '已完成'
              ? 'COMPLETED'
              : seed.status === '待交出'
                ? 'WAIT_HANDOVER'
                : seed.status === '已交出'
                  ? 'HANDED_OVER'
                  : seed.status === '已回写'
                    ? 'WRITTEN_BACK'
                    : seed.status === '差异'
                      ? 'DIFFERENCE'
                      : seed.status === '异议中'
                        ? 'OBJECTION'
                        : 'ABNORMAL',
    executionStatusLabel: seed.status,
    demandLines: [demandLine],
    sourcePieceRowIds: [demandLine.pieceRowId],
    sourcePatternFileIds: [demandLine.patternFileId],
    sourceSpecialCraftKeys: [demandLine.specialCraftKey],
    targetObject: seed.targetObject,
    partName: seed.partName,
    fabricColor: seed.fabricColor,
    sizeCode: seed.sizeCode,
    feiTicketNos: [...seed.feiTicketNos],
    transferBagNos: [...seed.transferBagNos],
    fabricRollNos: [...seed.fabricRollNos],
    materialSku: seed.materialSku,
    planQty: seed.planQty,
    receivedQty: seed.receivedQty,
    completedQty: seed.completedQty,
    lossQty: seed.lossQty,
    waitHandoverQty: seed.waitHandoverQty,
    unit: seed.unit,
    status: seed.status,
    abnormalStatus: seed.abnormalStatus,
    dueAt: seed.dueAt,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    waitProcessStockItemIds: artifacts.waitProcessStockItem ? [artifacts.waitProcessStockItem.stockItemId] : [],
    waitHandoverStockItemIds: artifacts.waitHandoverStockItem ? [artifacts.waitHandoverStockItem.stockItemId] : [],
    inboundRecordIds: artifacts.inboundRecord ? [artifacts.inboundRecord.inboundRecordId] : [],
    outboundRecordIds: artifacts.outboundRecord ? [artifacts.outboundRecord.outboundRecordId] : [],
    validationWarnings: [],
    isGenerated: true,
    isManualCreated: false,
    generationKey: `SEED-${taskOrderId}`,
    suggestedFactoryId: seed.factory.id,
    suggestedFactoryName: seed.factory.name,
    assignedFactoryId: seed.factory.id,
    assignedFactoryName: seed.factory.name,
    assignmentMode: '演示分配',
    nodeRecords: [],
    warehouseLinks: [],
    abnormalRecords: [],
    remark: '展示已由生产单沉淀后的特殊工艺任务结果。',
  }
  taskOrder.nodeRecords = buildNodeRecords(seed, artifacts)
  taskOrder.warehouseLinks = buildWarehouseLinks(seed, artifacts)
  taskOrder.abnormalRecords = buildAbnormalRecords(seed)
  assertSpecialCraftTaskOrderValid(taskOrder)
  return taskOrder
}

function buildSeedTaskOrders(): SpecialCraftTaskOrder[] {
  return listEnabledSpecialCraftOperationDefinitions().flatMap((operation, operationIndex) => {
    return [0, 1].map((variantIndex) => {
      const seed = buildTaskSeed(operation, operationIndex, variantIndex)
      const inboundArtifacts = buildInboundArtifacts(seed, operationIndex + variantIndex + 1)
      const outboundArtifacts = buildOutboundArtifacts(seed, operationIndex + variantIndex + 3)
      return buildTaskOrder(seed, {
        ...inboundArtifacts,
        ...outboundArtifacts,
      })
    })
  })
}

function buildStatistics(taskOrders: SpecialCraftTaskOrder[]): SpecialCraftTaskStatistic[] {
  const grouped = new Map<string, SpecialCraftTaskStatistic>()

  const ensureStatistic = (taskOrder: SpecialCraftTaskOrder): SpecialCraftTaskStatistic => {
    const date = taskOrder.createdAt.slice(0, 10)
    const key = `${taskOrder.operationId}::${taskOrder.factoryId}::${date}`
    const existing = grouped.get(key)
    if (existing) return existing
    const next: SpecialCraftTaskStatistic = {
      statisticId: `STAT-${taskOrder.operationId}-${taskOrder.factoryId}-${date}`,
      operationId: taskOrder.operationId,
      operationName: taskOrder.operationName,
      factoryId: taskOrder.factoryId,
      factoryName: taskOrder.factoryName,
      date,
      taskCount: 0,
      planQty: 0,
      receivedQty: 0,
      completedQty: 0,
      waitHandoverQty: 0,
      waitPickupTaskCount: 0,
      waitProcessTaskCount: 0,
      processingTaskCount: 0,
      completedTaskCount: 0,
      waitHandoverTaskCount: 0,
      handedOverTaskCount: 0,
      writtenBackTaskCount: 0,
      differenceTaskCount: 0,
      objectionTaskCount: 0,
      abnormalTaskCount: 0,
      unit: taskOrder.unit,
    }
    grouped.set(key, next)
    return next
  }

  taskOrders.forEach((taskOrder) => {
    const statistic = ensureStatistic(taskOrder)
    statistic.taskCount += 1
    statistic.planQty = roundQty(statistic.planQty + taskOrder.planQty)
    statistic.receivedQty = roundQty(statistic.receivedQty + taskOrder.receivedQty)
    statistic.completedQty = roundQty(statistic.completedQty + taskOrder.completedQty)
    statistic.waitHandoverQty = roundQty(statistic.waitHandoverQty + taskOrder.waitHandoverQty)
    if (taskOrder.status === '待领料') statistic.waitPickupTaskCount += 1
    if (taskOrder.status === '已入待加工仓') statistic.waitProcessTaskCount += 1
    if (taskOrder.status === '加工中') statistic.processingTaskCount += 1
    if (taskOrder.status === '已完成') statistic.completedTaskCount += 1
    if (taskOrder.status === '待交出') statistic.waitHandoverTaskCount += 1
    if (taskOrder.status === '已交出') statistic.handedOverTaskCount += 1
    if (taskOrder.status === '已回写') statistic.writtenBackTaskCount += 1
    if (taskOrder.status === '差异') statistic.differenceTaskCount += 1
    if (taskOrder.status === '异议中') statistic.objectionTaskCount += 1
    if (taskOrder.abnormalStatus !== '无异常' || taskOrder.status === '异常') statistic.abnormalTaskCount += 1
  })

  return [...grouped.values()].sort((left, right) =>
    left.date === right.date ? left.factoryName.localeCompare(right.factoryName, 'zh-CN') : right.date.localeCompare(left.date),
  )
}

function normalizeWorkOrderPartName(line: SpecialCraftTaskDemandLine, taskOrder: SpecialCraftTaskOrder): string {
  return line.partName || taskOrder.partName || '未命名部位'
}

function buildWorkOrderKey(taskOrder: SpecialCraftTaskOrder, line: SpecialCraftTaskDemandLine): string {
  return [
    taskOrder.taskOrderId,
    taskOrder.factoryId || 'WAIT_ASSIGN',
    normalizeWorkOrderPartName(line, taskOrder),
  ].join('::')
}

function buildWorkOrderId(taskOrder: SpecialCraftTaskOrder, partName: string, index: number): string {
  return `${taskOrder.taskOrderId}-WO-${String(index + 1).padStart(3, '0')}-${partName}`.replace(/[^A-Za-z0-9-]/g, '')
}

function buildWorkOrdersFromTaskOrders(taskOrders: SpecialCraftTaskOrder[]): {
  workOrders: SpecialCraftTaskWorkOrder[]
  workOrderLines: SpecialCraftTaskWorkOrderLine[]
  syncedTaskOrders: SpecialCraftTaskOrder[]
} {
  const workOrders: SpecialCraftTaskWorkOrder[] = []
  const workOrderLines: SpecialCraftTaskWorkOrderLine[] = []
  const taskWorkOrderIds = new Map<string, string[]>()

  taskOrders.forEach((taskOrder) => {
    const grouped = new Map<string, SpecialCraftTaskDemandLine[]>()
    const lines = taskOrder.demandLines?.length
      ? taskOrder.demandLines
      : [
          {
            demandLineId: `${taskOrder.taskOrderId}-LINE-01`,
            taskOrderId: taskOrder.taskOrderId,
            productionOrderId: taskOrder.productionOrderId,
            productionOrderNo: taskOrder.productionOrderNo,
            patternFileId: taskOrder.sourcePatternFileIds?.[0] || `PF-${taskOrder.taskOrderId}`,
            patternFileName: `${taskOrder.operationName}纸样`,
            pieceRowId: taskOrder.sourcePieceRowIds?.[0] || `PR-${taskOrder.taskOrderId}`,
            partName: taskOrder.partName || '未命名部位',
            colorName: taskOrder.fabricColor || '默认色',
            colorCode: taskOrder.fabricColor || 'DEFAULT',
            sizeCode: taskOrder.sizeCode || '均码',
            pieceCountPerGarment: 1,
            orderQty: taskOrder.planQty,
            planPieceQty: taskOrder.planQty,
            specialCraftKey: `${taskOrder.processCode}:${taskOrder.craftCode}`,
            operationId: taskOrder.operationId,
            operationName: taskOrder.operationName,
            processCode: taskOrder.processCode,
            processName: taskOrder.processName,
            craftCode: taskOrder.craftCode,
            craftName: taskOrder.craftName,
            targetObject: taskOrder.targetObject,
            unit: taskOrder.unit,
            feiTicketNos: [...taskOrder.feiTicketNos],
          },
        ]

    lines.forEach((line) => {
      const key = buildWorkOrderKey(taskOrder, line)
      const list = grouped.get(key) || []
      list.push(line)
      grouped.set(key, list)
    })

    Array.from(grouped.entries()).forEach(([, groupLines], groupIndex) => {
      const firstLine = groupLines[0]
      const partName = normalizeWorkOrderPartName(firstLine, taskOrder)
      const workOrderId = buildWorkOrderId(taskOrder, partName, groupIndex)
      const planQty = roundQty(groupLines.reduce((total, line) => total + line.planPieceQty, 0))
      const lineIds = groupLines.map((line, lineIndex) => `${workOrderId}-LINE-${String(lineIndex + 1).padStart(3, '0')}`)
      const feiTicketNos = [...new Set(groupLines.flatMap((line) => line.feiTicketNos))]
      const receivedQty = groupIndex === 0 ? taskOrder.receivedQty : 0
      const scrapQty = groupIndex === 0 ? taskOrder.lossQty || 0 : 0
      const damageQty = groupIndex === 0 ? taskOrder.damageQty || 0 : 0
      const returnedQty = groupIndex === 0 ? taskOrder.returnedQty || (taskOrder.status === '已回写' ? taskOrder.waitHandoverQty : 0) : 0
      const currentQty = groupIndex === 0
        ? taskOrder.currentQty ?? Math.max(taskOrder.completedQty || taskOrder.receivedQty || 0, 0)
        : 0

      const workOrder: SpecialCraftTaskWorkOrder = {
        workOrderId,
        workOrderNo: `${taskOrder.taskOrderNo}-部位${String(groupIndex + 1).padStart(2, '0')}`,
        taskOrderId: taskOrder.taskOrderId,
        taskOrderNo: taskOrder.taskOrderNo,
        productionOrderId: taskOrder.productionOrderId,
        productionOrderNo: taskOrder.productionOrderNo,
        operationId: taskOrder.operationId,
        operationName: taskOrder.operationName,
        processCode: taskOrder.processCode,
        processName: taskOrder.processName,
        craftCode: taskOrder.craftCode,
        craftName: taskOrder.craftName,
        factoryId: taskOrder.factoryId || 'WAIT_ASSIGN',
        factoryName: taskOrder.factoryName || '待分配',
        targetObject: taskOrder.targetObject,
        partName,
        planQty,
        receivedQty,
        scrapQty,
        damageQty,
        currentQty,
        returnedQty,
        waitReturnQty: groupIndex === 0 ? taskOrder.waitHandoverQty || 0 : 0,
        status: taskOrder.status,
        openDifferenceReportCount: taskOrder.abnormalStatus === '数量差异' || taskOrder.status === '差异' ? 1 : 0,
        openObjectionCount: taskOrder.status === '异议中' ? 1 : 0,
        feiTicketNos,
        lineIds,
        createdAt: taskOrder.createdAt,
        updatedAt: taskOrder.updatedAt || taskOrder.createdAt,
        remark: '按裁片部位拆分的特殊工艺工艺单',
      }
      workOrders.push(workOrder)
      taskWorkOrderIds.set(taskOrder.taskOrderId, [...(taskWorkOrderIds.get(taskOrder.taskOrderId) || []), workOrderId])

      groupLines.forEach((line, lineIndex) => {
        workOrderLines.push({
          lineId: lineIds[lineIndex],
          workOrderId,
          taskOrderId: taskOrder.taskOrderId,
          demandLineId: line.demandLineId,
          partName: line.partName,
          colorName: line.colorName,
          colorCode: line.colorCode,
          sizeCode: line.sizeCode,
          pieceCountPerGarment: line.pieceCountPerGarment,
          orderQty: line.orderQty,
          planPieceQty: line.planPieceQty,
          currentQty: 0,
          feiTicketNos: [...line.feiTicketNos],
          bundleWidthCm: line.bundleWidthCm,
          bundleLengthCm: line.bundleLengthCm,
          stripCount: line.stripCount,
          remark: line.remark,
        })
      })
    })
  })

  const syncedTaskOrders = taskOrders.map((taskOrder) => {
    const matchedWorkOrders = workOrders.filter((workOrder) => workOrder.taskOrderId === taskOrder.taskOrderId)
    return {
      ...taskOrder,
      workOrderIds: taskWorkOrderIds.get(taskOrder.taskOrderId) || [],
      damageQty: roundQty(matchedWorkOrders.reduce((total, workOrder) => total + workOrder.damageQty, 0)),
      currentQty: roundQty(matchedWorkOrders.reduce((total, workOrder) => total + workOrder.currentQty, 0)),
      returnedQty: roundQty(matchedWorkOrders.reduce((total, workOrder) => total + workOrder.returnedQty, 0)),
      openDifferenceReportCount: matchedWorkOrders.reduce((total, workOrder) => total + workOrder.openDifferenceReportCount, 0),
      openObjectionCount: matchedWorkOrders.reduce((total, workOrder) => total + workOrder.openObjectionCount, 0),
      feiTicketNos: [...new Set([...taskOrder.feiTicketNos, ...matchedWorkOrders.flatMap((workOrder) => workOrder.feiTicketNos)])],
    }
  })

  return {
    workOrders,
    workOrderLines,
    syncedTaskOrders,
  }
}

function ensureStore(): SpecialCraftTaskStore {
  if (!specialCraftTaskStore) {
    const seedTaskOrders = buildSeedTaskOrders()
    const generatedResults = generateSpecialCraftTaskOrdersForAllProductionOrders(seedTaskOrders)
    const generatedTaskOrders = generatedResults.flatMap((item) => item.taskOrders)
    const generationBatches = generatedResults.map((item) => item.generationBatch)
    const generationErrors = generatedResults.flatMap((item) => item.errors)
    const mergedTaskOrders = [...seedTaskOrders]

    generatedTaskOrders.forEach((taskOrder) => {
      const existingIndex = mergedTaskOrders.findIndex((item) => item.taskOrderId === taskOrder.taskOrderId)
      if (existingIndex >= 0) {
        mergedTaskOrders[existingIndex] = taskOrder
        return
      }
      mergedTaskOrders.push(taskOrder)
    })

    const workOrderBuild = buildWorkOrdersFromTaskOrders(mergedTaskOrders)
    specialCraftTaskStore = {
      taskOrders: workOrderBuild.syncedTaskOrders,
      workOrders: workOrderBuild.workOrders,
      workOrderLines: workOrderBuild.workOrderLines,
      statistics: buildStatistics(workOrderBuild.syncedTaskOrders),
      generationBatches,
      generationErrors,
    }
  }
  return specialCraftTaskStore
}

function matchesKeyword(taskOrder: SpecialCraftTaskOrder, keyword: string | undefined): boolean {
  if (!keyword) return true
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  const tokens = [
    taskOrder.taskOrderNo,
    taskOrder.productionOrderNo,
    taskOrder.factoryName,
    taskOrder.partName,
    taskOrder.materialSku,
    ...taskOrder.feiTicketNos,
    ...taskOrder.transferBagNos,
    ...taskOrder.fabricRollNos,
  ]
  return tokens.some((token) => token?.toLowerCase().includes(normalized))
}

function withinTimeRange(dateTime: string, timeRange: SpecialCraftTaskFilters['timeRange']): boolean {
  if (!timeRange || timeRange === 'ALL') return true
  const current = new Date('2026-04-23T12:00:00+08:00').getTime()
  const target = new Date(dateTime.replace(' ', 'T')).getTime()
  if (!Number.isFinite(target)) return true
  const diff = current - target
  if (timeRange === 'TODAY') return diff <= 24 * 60 * 60 * 1000
  if (timeRange === '7D') return diff <= 7 * 24 * 60 * 60 * 1000
  return diff <= 30 * 24 * 60 * 60 * 1000
}

export function getEnabledSpecialCraftOperations(): SpecialCraftOperationDefinition[] {
  return listEnabledSpecialCraftOperationDefinitions()
}

export function getSpecialCraftOperationBySlug(slug: string): SpecialCraftOperationDefinition | undefined {
  return getOperationBySlug(slug)
}

export function assertSpecialCraftTaskOrderValid(taskOrder: SpecialCraftTaskOrder): void {
  const operation = getSpecialCraftOperationById(taskOrder.operationId)
  if (!operation || !operation.isEnabled) {
    throw new Error(`非法特殊工艺任务单：${taskOrder.taskOrderNo}`)
  }
  if (operation.processCode !== taskOrder.processCode || operation.craftCode !== taskOrder.craftCode) {
    throw new Error(`特殊工艺任务单编码不匹配：${taskOrder.taskOrderNo}`)
  }
}

export function getSpecialCraftTaskOrders(
  operationId: string,
  filters: SpecialCraftTaskFilters = {},
): SpecialCraftTaskOrder[] {
  return ensureStore().taskOrders.filter((taskOrder) => {
    if (taskOrder.operationId !== operationId) return false
    if (filters.factoryId && taskOrder.factoryId !== filters.factoryId) return false
    if (filters.status && filters.status !== '全部' && taskOrder.status !== filters.status) return false
    if (filters.abnormalStatus && filters.abnormalStatus !== '全部' && taskOrder.abnormalStatus !== filters.abnormalStatus) return false
    if (!matchesKeyword(taskOrder, filters.keyword)) return false
    if (!withinTimeRange(taskOrder.createdAt, filters.timeRange)) return false
    return true
  })
}

export function getSpecialCraftTaskOrderById(taskOrderId: string): SpecialCraftTaskOrder | undefined {
  return ensureStore().taskOrders.find((taskOrder) => taskOrder.taskOrderId === taskOrderId)
}

export function buildSpecialCraftTaskWorkOrders(taskOrders: SpecialCraftTaskOrder[] = listSpecialCraftTaskOrders()): {
  workOrders: SpecialCraftTaskWorkOrder[]
  workOrderLines: SpecialCraftTaskWorkOrderLine[]
} {
  const result = buildWorkOrdersFromTaskOrders(taskOrders)
  return {
    workOrders: result.workOrders,
    workOrderLines: result.workOrderLines,
  }
}

export function listSpecialCraftTaskWorkOrders(): SpecialCraftTaskWorkOrder[] {
  return [...ensureStore().workOrders]
}

export function listSpecialCraftTaskWorkOrderLines(): SpecialCraftTaskWorkOrderLine[] {
  return [...ensureStore().workOrderLines]
}

export function getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrderId: string): SpecialCraftTaskWorkOrder[] {
  return ensureStore().workOrders.filter((workOrder) => workOrder.taskOrderId === taskOrderId)
}

export function getSpecialCraftTaskWorkOrderLinesByWorkOrderId(workOrderId: string): SpecialCraftTaskWorkOrderLine[] {
  return ensureStore().workOrderLines.filter((line) => line.workOrderId === workOrderId)
}

export function getSpecialCraftTaskWorkOrderById(workOrderId: string): SpecialCraftTaskWorkOrder | undefined {
  return ensureStore().workOrders.find((workOrder) => workOrder.workOrderId === workOrderId)
}

export function getSpecialCraftTaskWorkOrderLineByDemandLineId(
  taskOrderId: string,
  demandLineId: string,
): SpecialCraftTaskWorkOrderLine | undefined {
  return ensureStore().workOrderLines.find((line) => line.taskOrderId === taskOrderId && line.demandLineId === demandLineId)
}

export function syncSpecialCraftTaskOrderAggregatesFromWorkOrders(taskOrderId: string): SpecialCraftTaskOrder | undefined {
  const store = ensureStore()
  const taskOrderIndex = store.taskOrders.findIndex((taskOrder) => taskOrder.taskOrderId === taskOrderId)
  if (taskOrderIndex < 0) return undefined
  const workOrders = store.workOrders.filter((workOrder) => workOrder.taskOrderId === taskOrderId)
  const taskOrder = store.taskOrders[taskOrderIndex]
  const nextTaskOrder: SpecialCraftTaskOrder = {
    ...taskOrder,
    receivedQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.receivedQty, 0)) || taskOrder.receivedQty,
    lossQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.scrapQty, 0)),
    damageQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.damageQty, 0)),
    currentQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.currentQty, 0)),
    returnedQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.returnedQty, 0)),
    waitHandoverQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.waitReturnQty, 0)) || taskOrder.waitHandoverQty,
    openDifferenceReportCount: workOrders.reduce((total, workOrder) => total + workOrder.openDifferenceReportCount, 0),
    openObjectionCount: workOrders.reduce((total, workOrder) => total + workOrder.openObjectionCount, 0),
    feiTicketNos: [...new Set(workOrders.flatMap((workOrder) => workOrder.feiTicketNos))],
    workOrderIds: workOrders.map((workOrder) => workOrder.workOrderId),
    updatedAt: formatDay(0),
  }
  store.taskOrders[taskOrderIndex] = nextTaskOrder
  store.statistics = buildStatistics(store.taskOrders)
  return nextTaskOrder
}

export function getSpecialCraftWarehouseView(
  operationId: string,
  filters: SpecialCraftTaskFilters = {},
): SpecialCraftWarehouseView {
  const operation = getSpecialCraftOperationById(operationId)
  if (!operation) {
    throw new Error(`未找到特殊工艺运营分类：${operationId}`)
  }
  const taskOrders = getSpecialCraftTaskOrders(operationId, filters)
  const factoryIds = [...new Set(taskOrders.map((taskOrder) => taskOrder.factoryId))]

  const waitProcessItems = listFactoryWaitProcessStockItems().filter((item) =>
    item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId),
  )
  const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) =>
    item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId),
  )
  const inboundRecords = listFactoryWarehouseInboundRecords().filter((item) =>
    item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId),
  )
  const outboundRecords = listFactoryWarehouseOutboundRecords().filter((item) =>
    item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId),
  )
  const warehouses = listFactoryInternalWarehouses().filter((warehouse) =>
    factoryIds.includes(warehouse.factoryId),
  )
  const nodeRows = factoryIds.flatMap((factoryId) => listFactoryWarehouseNodeRows(factoryId))
  const stocktakeOrders = listFactoryWarehouseStocktakeOrders().filter((order) =>
    factoryIds.includes(order.factoryId),
  )

  return {
    operation,
    factoryIds,
    waitProcessItems,
    waitHandoverItems,
    inboundRecords,
    outboundRecords,
    warehouses,
    nodeRows,
    stocktakeOrders,
  }
}

export function getSpecialCraftStatistics(
  operationId: string,
  filters: SpecialCraftTaskFilters = {},
): SpecialCraftTaskStatistic[] {
  return ensureStore().statistics.filter((item) => {
    if (item.operationId !== operationId) return false
    if (filters.factoryId && item.factoryId !== filters.factoryId) return false
    if (!withinTimeRange(`${item.date} 00:00:00`, filters.timeRange)) return false
    return true
  })
}

export function listSpecialCraftTaskOrders(): SpecialCraftTaskOrder[] {
  return [...ensureStore().taskOrders]
}

export function listSpecialCraftGenerationBatches(): SpecialCraftTaskGenerationBatch[] {
  return [...ensureStore().generationBatches]
}

export function listSpecialCraftGenerationErrors(): SpecialCraftTaskGenerationError[] {
  return [...ensureStore().generationErrors]
}

export function getSpecialCraftTasksByProductionOrder(productionOrderId: string): SpecialCraftTaskOrder[] {
  return ensureStore().taskOrders.filter((taskOrder) => taskOrder.productionOrderId === productionOrderId)
}

export function getSpecialCraftGenerationBatchByOrderId(
  productionOrderId: string,
): SpecialCraftTaskGenerationBatch | undefined {
  return ensureStore().generationBatches.find((item) => item.productionOrderId === productionOrderId)
    || getSpecialCraftGenerationBatchByProductionOrder(productionOrderId, ensureStore().taskOrders)
}

export function buildSpecialCraftPageTitle(operation: SpecialCraftOperationDefinition, suffix: '任务单' | '任务详情' | '仓库管理' | '统计'): string {
  return `${operation.operationName}${suffix}`
}

export function getSpecialCraftOperationLabel(operation: SpecialCraftOperationDefinition): string {
  return operation.operationName
}

export function listSpecialCraftOperationSlugs(): string[] {
  return listEnabledSpecialCraftOperationDefinitions().map((item) => buildSpecialCraftOperationSlug(item))
}
