import { TEST_FACTORY_ID, TEST_FACTORY_NAME, mockFactories } from './factory-mock-data.ts'
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
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import type { SpecialCraftOperationDefinition, SpecialCraftTargetObject } from './special-craft-operations.ts'
import {
  buildSpecialCraftOperationSlug,
  getSpecialCraftFlowRule,
  getSpecialCraftOperationById,
  getSpecialCraftOperationBySlug as getOperationBySlug,
  listEnabledSpecialCraftOperationDefinitions,
  resolveAuxiliaryWarehouseFlow,
} from './special-craft-operations.ts'
import {
  generateSpecialCraftTaskOrdersForAllProductionOrders,
  getSpecialCraftGenerationBatchByProductionOrder,
} from './special-craft-task-generation.ts'
import { shouldGenerateInternalCraftOrderForProductionOrder } from './task-generation-boundaries.ts'

export type SpecialCraftTaskStatus =
  | '待领料'
  | '成衣仓已出库待收货'
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

export type SpecialCraftTaskGenerationSource = 'PRODUCTION_ORDER'
export type SpecialCraftTaskSourceTrigger = 'PRODUCTION_ORDER_CREATED'
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
  skuCode: string
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
  managementDomain: SpecialCraftOperationDefinition['managementDomain']
  managementDomainName: SpecialCraftOperationDefinition['managementDomainName']
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  targetObject: SpecialCraftTargetObject
  unit: string
  feiTicketNos: string[]
  sourceBomItemId?: string
  bundleWidthCm?: number
  bundleLengthCm?: number
  stripCount?: number
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
    | '成衣BOM缺失'
    | '生产SKU重复'
    | '成衣BOM适用SKU缺失'
    | '成衣BOM适用SKU无生产数量'
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
  businessType?: string
  managementDomain: SpecialCraftOperationDefinition['managementDomain']
  managementDomainName: SpecialCraftOperationDefinition['managementDomainName']
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
  managementDomain?: SpecialCraftOperationDefinition['managementDomain']
}

interface TaskSeedContext {
  operation: SpecialCraftOperationDefinition
  taskOrderId: string
  taskOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  productionOrderVersion?: string
  techPackSnapshotId?: string
  techPackVersion?: string
  sourceTaskId: string
  sourceTaskNo: string
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
  itemKind: '裁片' | '面料' | '成衣'
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
  generationKey?: string
  suggestedFactoryId?: string
  suggestedFactoryName?: string
  assignedFactoryId?: string
  assignedFactoryName?: string
  assignmentMode?: string
  remark?: string
}

interface WarehouseArtifacts {
  inboundRecord?: FactoryWarehouseInboundRecord
  waitProcessStockItem?: FactoryWaitProcessStockItem
  waitHandoverStockItem?: FactoryWaitHandoverStockItem
  outboundRecord?: FactoryWarehouseOutboundRecord
}

interface SpecialCraftTaskStore {
  taskOrders: SpecialCraftTaskOrder[]
  generationBatches: SpecialCraftTaskGenerationBatch[]
  generationErrors: SpecialCraftTaskGenerationError[]
}

const PART_NAMES = ['前片', '后片', '袖片', '领片', '门襟', '裤身片', '侧片']
const MIN_TASK_ORDER_COUNT_PER_OPERATION = 9
const LINKED_DEMO_STATUSES: SpecialCraftTaskStatus[] = [
  '待领料',
  '已入待加工仓',
  '加工中',
  '已完成',
  '待交出',
  '已交出',
  '已回写',
  '差异',
  '异议中',
]
const LINKED_DEMO_ABNORMALS: SpecialCraftTaskAbnormalStatus[] = [
  '无异常',
  '无异常',
  '设备异常',
  '无异常',
  '无异常',
  '无异常',
  '无异常',
  '数量差异',
  '数量差异',
]
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
    factory.processAbilities.some((ability) =>
      ability.processCode === operation.processCode
      && ability.craftCodes.includes(operation.craftCode)
      && ability.canReceiveTask !== false
      && (ability.status ?? 'ACTIVE') !== 'DISABLED',
    ),
  )
  const visibleFactoryIds = new Set(operation.visibleFactoryIds ?? [])
  if (visibleFactoryIds.size > 0) {
    const scoped = matched.filter((factory) => visibleFactoryIds.has(factory.id))
    if (scoped.length === 0) {
      throw new Error(`未找到特殊工艺专属工厂：${operation.operationName}`)
    }
    return scoped
  }
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
  return getSpecialCraftFlowRule(targetObject).unit
}

function getTaskItemKind(targetObject: SpecialCraftTargetObject): '裁片' | '面料' | '成衣' {
  return resolveAuxiliaryWarehouseFlow(targetObject).itemKind
}

function getTaskItemName(operation: SpecialCraftOperationDefinition, targetObject: SpecialCraftTargetObject, partName?: string): string {
  if (targetObject === '完整面料' || targetObject === '面料') {
    return `${operation.operationName}面料批次`
  }
  if (targetObject === '成衣') {
    return `${operation.operationName}成衣工单`
  }
  return `${partName || '裁片'}${operation.operationName}任务`
}

function getReceiverKind(targetObject: SpecialCraftTargetObject): FactoryWaitHandoverStockItem['receiverKind'] {
  return resolveAuxiliaryWarehouseFlow(targetObject).receiverKind
}

function getReceiverName(targetObject: SpecialCraftTargetObject): string {
  return resolveAuxiliaryWarehouseFlow(targetObject).receiverName
}

function resolveProductionOrderVersion(order: ProductionOrder): string {
  const lastBreakdownAt = order.taskBreakdownSummary.lastBreakdownAt
  if (lastBreakdownAt) return `POV-${lastBreakdownAt.replace(/[^0-9]/g, '').slice(0, 14)}`
  return `POV-${String(order.updatedAt || order.createdAt).replace(/[^0-9]/g, '').slice(0, 14) || 'CURRENT'}`
}

function listLinkedProductionOrderContexts(): Array<{ order: ProductionOrder; snapshot: ProductionOrderTechPackSnapshot }> {
  return productionOrders
    .map((order) => ({ order, snapshot: getProductionOrderTechPackSnapshot(order.productionOrderId) }))
    .filter((item): item is { order: ProductionOrder; snapshot: ProductionOrderTechPackSnapshot } =>
      Boolean(item.snapshot)
      && shouldGenerateInternalCraftOrderForProductionOrder(item.order)
      && item.order.demandSnapshot.skuLines.length > 0
      && item.snapshot.patternFiles.length > 0,
    )
}

function stableDemoHash(input: string): string {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function mapTaskStatusToExecutionStatus(status: SpecialCraftTaskStatus): SpecialCraftTaskExecutionStatus {
  if (status === '已入待加工仓') return 'IN_WAIT_PROCESS_WAREHOUSE'
  if (status === '加工中') return 'PROCESSING'
  if (status === '已完成') return 'COMPLETED'
  if (status === '待交出') return 'WAIT_HANDOVER'
  if (status === '已交出') return 'HANDED_OVER'
  if (status === '已回写') return 'WRITTEN_BACK'
  if (status === '差异') return 'DIFFERENCE'
  if (status === '异议中') return 'OBJECTION'
  if (status === '异常') return 'ABNORMAL'
  return 'WAIT_PICKUP'
}

function resolveSnapshotPatternContext(
  snapshot: ProductionOrderTechPackSnapshot,
  variantIndex: number,
): {
  patternFileId: string
  patternFileName: string
  pieceRowId: string
  partName: string
  pieceCountPerGarment: number
  bundleWidthCm?: number
  bundleLengthCm?: number
} {
  const patternFiles = snapshot.patternFiles.filter((file) => (file.pieceRows ?? []).length > 0)
  const patternFile = patternFiles[variantIndex % Math.max(patternFiles.length, 1)] ?? snapshot.patternFiles[0]
  const pieceRows = patternFile?.pieceRows ?? []
  const pieceRow = pieceRows[variantIndex % Math.max(pieceRows.length, 1)]
  const allocation = pieceRow?.colorAllocations?.find((item) => Number(item.pieceCount) > 0) ?? pieceRow?.colorAllocations?.[0]
  const pieceCountPerGarment = Number(allocation?.pieceCount)

  return {
    patternFileId: patternFile?.patternFileId || patternFile?.id || `PF-${snapshot.productionOrderNo}`,
    patternFileName: patternFile?.patternFileName || patternFile?.fileName || `${snapshot.styleCode}纸样`,
    pieceRowId: pieceRow?.id || `PR-${snapshot.productionOrderNo}-${String(variantIndex + 1).padStart(2, '0')}`,
    partName: pieceRow?.name || PART_NAMES[variantIndex % PART_NAMES.length],
    pieceCountPerGarment: Number.isFinite(pieceCountPerGarment) && pieceCountPerGarment > 0 ? pieceCountPerGarment : 1,
    bundleWidthCm: pieceRow?.bundleWidthCm,
    bundleLengthCm: pieceRow?.bundleLengthCm,
  }
}

function buildLinkedDemoTaskSeed(input: {
  operation: SpecialCraftOperationDefinition
  operationIndex: number
  variantIndex: number
  context: { order: ProductionOrder; snapshot: ProductionOrderTechPackSnapshot }
}): TaskSeedContext {
  const { operation, operationIndex, variantIndex, context } = input
  const { order, snapshot } = context
  const factory = pickFactoryForOperation(operation, variantIndex)
  const orderLine = order.demandSnapshot.skuLines[(operationIndex + variantIndex) % order.demandSnapshot.skuLines.length]
  const patternContext = resolveSnapshotPatternContext(snapshot, variantIndex)
  const taskPrefix = operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'AUX' : 'SPC'
  const craftShortCode = operation.craftCode.replace('CRAFT_', '').replace(/^0+/, '').slice(-4) || operation.operationId.slice(-4)
  const seedKey = stableDemoHash([operation.operationId, order.productionOrderId, variantIndex].join('|'))
  const variantNo = String(variantIndex + 1).padStart(2, '0')
  const taskOrderId = `${taskPrefix}-TASK-${order.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${operation.operationId.slice(-4)}-${variantNo}-${seedKey.slice(0, 8)}`
  const taskOrderNo = `${taskPrefix}-${order.productionOrderNo.replace(/^PO-/, '')}-${craftShortCode}-${variantNo}`
  const sourceTaskNo = `TASK-${taskOrderNo}`
  const status = LINKED_DEMO_STATUSES[variantIndex % LINKED_DEMO_STATUSES.length]
  const abnormalStatus = LINKED_DEMO_ABNORMALS[variantIndex % LINKED_DEMO_ABNORMALS.length]
  const targetObject = operation.targetObject
  const pieceCountPerGarment = targetObject === '成衣' ? 1 : patternContext.pieceCountPerGarment
  const planQty = roundQty(orderLine.qty * pieceCountPerGarment)
  const receivedQty = status === '待领料' ? 0 : roundQty(planQty - (abnormalStatus === '无异常' ? 0 : Math.max(1, Math.round(planQty * 0.01))))
  const completedQty = ['已完成', '待交出', '已交出', '已回写', '差异', '异议中'].includes(status)
    ? receivedQty
    : status === '加工中'
      ? roundQty(Math.max(receivedQty * 0.45, 0))
      : 0
  const lossQty = roundQty(Math.max(receivedQty - completedQty, 0))
  const waitHandoverQty = ['待交出', '已交出', '已回写', '差异', '异议中'].includes(status) ? completedQty : 0
  const demandLine: SpecialCraftTaskDemandLine = {
    demandLineId: `${taskOrderId}-LINE-01`,
    taskOrderId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    patternFileId: targetObject === '成衣' ? '' : patternContext.patternFileId,
    patternFileName: targetObject === '成衣' ? '' : patternContext.patternFileName,
    pieceRowId: targetObject === '成衣' ? '' : patternContext.pieceRowId,
    partName: targetObject === '成衣' ? '成衣' : patternContext.partName,
    colorName: orderLine.color,
    colorCode: orderLine.color,
    sizeCode: orderLine.size,
    pieceCountPerGarment,
    orderQty: orderLine.qty,
    planPieceQty: planQty,
    specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:${targetObject}`,
    operationId: operation.operationId,
    operationName: operation.operationName,
    managementDomain: operation.managementDomain,
    managementDomainName: operation.managementDomainName,
    processCode: operation.processCode,
    processName: operation.processName,
    craftCode: operation.craftCode,
    craftName: operation.craftName,
    targetObject,
    unit: getTaskUnit(targetObject),
    feiTicketNos: targetObject === '成衣' ? [] : [`FT-${order.productionOrderNo.replace(/^PO-/, '')}-${String(variantIndex + 1).padStart(2, '0')}`],
    bundleWidthCm: patternContext.bundleWidthCm,
    bundleLengthCm: patternContext.bundleLengthCm,
    remark: `来源生产单 ${order.productionOrderNo} / 技术包 ${snapshot.sourceTechPackVersionLabel || snapshot.versionLabel}`,
  }

  return {
    operation,
    taskOrderId,
    taskOrderNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    productionOrderVersion: resolveProductionOrderVersion(order),
    techPackSnapshotId: snapshot.snapshotId,
    techPackVersion: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
    sourceTaskId: sourceTaskNo,
    sourceTaskNo,
    generationBatchId: `SCB-${seedKey}`,
    generationSource: 'PRODUCTION_ORDER',
    generationSourceLabel: '生产单生成',
    sourceTrigger: 'PRODUCTION_ORDER_CREATED',
    sourceTriggerLabel: '生产单自动拆分任务',
    assignmentStatus: 'ASSIGNED',
    assignmentStatusLabel: '已分配',
    executionStatus: mapTaskStatusToExecutionStatus(status),
    executionStatusLabel: status,
    demandLines: [demandLine],
    sourcePieceRowIds: demandLine.pieceRowId ? [demandLine.pieceRowId] : [],
    sourcePatternFileIds: demandLine.patternFileId ? [demandLine.patternFileId] : [],
    sourceSpecialCraftKeys: [demandLine.specialCraftKey],
    factory,
    targetObject,
    partName: demandLine.partName,
    fabricColor: orderLine.color,
    sizeCode: orderLine.size,
    feiTicketNos: [...demandLine.feiTicketNos],
    transferBagNos: targetObject === '成衣' ? [] : [`TB-${order.productionOrderNo.replace(/^PO-/, '')}-${String(variantIndex + 1).padStart(2, '0')}`],
    fabricRollNos: [],
    materialSku: orderLine.skuCode,
    unit: getTaskUnit(targetObject),
    itemName: getTaskItemName(operation, targetObject, demandLine.partName),
    itemKind: getTaskItemKind(targetObject),
    planQty,
    receivedQty,
    completedQty,
    lossQty,
    waitHandoverQty,
    status,
    abnormalStatus,
    createdAt: order.updatedAt || order.createdAt,
    dueAt: order.demandSnapshot.requiredDeliveryDate || order.updatedAt,
    receiverName: getReceiverName(targetObject),
    receiverKind: getReceiverKind(targetObject),
    sourceAction: targetObject === '成衣' ? '交出接收' : '领料确认',
    sourceRecordType: targetObject === '成衣' ? 'HANDOVER_RECEIVE' : 'MATERIAL_PICKUP',
    sourceRecordNo: `${targetObject === '成衣' ? 'JS' : 'LL'}-${taskOrderNo}`,
    sourceObjectName: resolveAuxiliaryWarehouseFlow(targetObject).sourceObjectName,
    handoverOrderId: `SC-HO-${seedKey}`,
    handoverOrderNo: `SC-HDO-${taskOrderNo}`,
    handoverRecordId: `SC-HR-${seedKey}`,
    handoverRecordNo: `SC-HDR-${taskOrderNo}`,
    handoverRecordQrValue: `SCQR-${seedKey}`,
    generationKey: seedKey,
    suggestedFactoryId: factory.id,
    suggestedFactoryName: factory.name,
    assignedFactoryId: factory.id,
    assignedFactoryName: factory.name,
    assignmentMode: '直接派单',
    remark: `由生产单 ${order.productionOrderNo} 按正式技术包 ${snapshot.sourceTechPackVersionLabel || snapshot.versionLabel} 自动拆分生成。`,
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
        ? '回写对象数量不符'
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
      remark: '由生产单结果沉淀为工艺加工单',
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
        qty: seed.receivedQty,
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
        remark: '接收方回写对象数量与交出对象数量不符',
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
          ? '接收或回写对象数量不一致，需复核差异来源。'
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
  const fallbackDemandLine: SpecialCraftTaskDemandLine = {
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
    specialCraftKey: `${seed.operation.managementDomain}:${seed.operation.processCode}:${seed.operation.craftCode}`,
    operationId: seed.operation.operationId,
    operationName: seed.operation.operationName,
    managementDomain: seed.operation.managementDomain,
    managementDomainName: seed.operation.managementDomainName,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    targetObject: seed.targetObject,
    unit: seed.unit,
    feiTicketNos: [...seed.feiTicketNos],
    remark: '演示任务明细',
  }
  const demandLines = (seed.demandLines?.length ? seed.demandLines : [fallbackDemandLine]).map((line, index) => ({
    ...line,
    taskOrderId,
    demandLineId: line.demandLineId || `${taskOrderId}-LINE-${String(index + 1).padStart(2, '0')}`,
  }))
  const sourcePieceRowIds = seed.sourcePieceRowIds || [...new Set(demandLines.map((line) => line.pieceRowId))]
  const sourcePatternFileIds = seed.sourcePatternFileIds || [...new Set(demandLines.map((line) => line.patternFileId))]
  const sourceSpecialCraftKeys = seed.sourceSpecialCraftKeys || [...new Set(demandLines.map((line) => line.specialCraftKey))]
  const taskOrder: SpecialCraftTaskOrder = {
    taskOrderId,
    taskOrderNo: seed.taskOrderNo,
    operationId: seed.operation.operationId,
    operationName: seed.operation.operationName,
    businessType: getSpecialCraftWorkOrderBusinessType(seed.operation.operationId),
    managementDomain: seed.operation.managementDomain,
    managementDomainName: seed.operation.managementDomainName,
    processCode: seed.operation.processCode,
    processName: seed.operation.processName,
    craftCode: seed.operation.craftCode,
    craftName: seed.operation.craftName,
    factoryId: seed.factory.id,
    factoryName: seed.factory.name,
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderNo,
    productionOrderVersion: seed.productionOrderVersion || 'POV-SEED',
    techPackSnapshotId: seed.techPackSnapshotId || `TPS-${seed.operation.operationId}`,
    techPackVersion: seed.techPackVersion || '演示版',
    sourceTaskId: seed.sourceTaskId,
    sourceTaskNo: seed.sourceTaskNo,
    generationBatchId: seed.generationBatchId || `SCB-SEED-${seed.operation.operationId}`,
    generationSource: seed.generationSource || 'PRODUCTION_ORDER',
    generationSourceLabel: seed.generationSourceLabel || '生产单生成',
    sourceTrigger: seed.sourceTrigger || 'PRODUCTION_ORDER_CREATED',
    sourceTriggerLabel: seed.sourceTriggerLabel || '生产单生成',
    assignmentStatus: seed.assignmentStatus || 'ASSIGNED',
    assignmentStatusLabel: seed.assignmentStatusLabel || '已分配',
    executionStatus: seed.executionStatus || (seed.status === '待领料'
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
                        : 'ABNORMAL'),
    executionStatusLabel: seed.executionStatusLabel || seed.status,
    demandLines,
    sourcePieceRowIds,
    sourcePatternFileIds,
    sourceSpecialCraftKeys,
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
    generationKey: seed.generationKey || `SEED-${taskOrderId}`,
    suggestedFactoryId: seed.suggestedFactoryId || seed.factory.id,
    suggestedFactoryName: seed.suggestedFactoryName || seed.factory.name,
    assignedFactoryId: seed.assignedFactoryId || seed.factory.id,
    assignedFactoryName: seed.assignedFactoryName || seed.factory.name,
    assignmentMode: seed.assignmentMode || '演示分配',
    nodeRecords: [],
    warehouseLinks: [],
    abnormalRecords: [],
    remark: seed.remark || '展示已由生产单沉淀后的工艺加工结果。',
  }
  taskOrder.nodeRecords = buildNodeRecords(seed, artifacts)
  taskOrder.warehouseLinks = buildWarehouseLinks(seed, artifacts)
  taskOrder.abnormalRecords = buildAbnormalRecords(seed)
  assertSpecialCraftTaskOrderValid(taskOrder)
  return taskOrder
}

function buildLinkedSupplementTaskOrders(
  existingTaskOrders: SpecialCraftTaskOrder[],
  operations: SpecialCraftOperationDefinition[] = listEnabledSpecialCraftOperationDefinitions(),
): SpecialCraftTaskOrder[] {
  const contexts = listLinkedProductionOrderContexts()
  if (contexts.length === 0) return []
  const existingProductionOrderIds = new Set(existingTaskOrders.map((taskOrder) => taskOrder.productionOrderId))
  const supplementalContexts = contexts.filter((context) => !existingProductionOrderIds.has(context.order.productionOrderId))
  const candidateContexts = supplementalContexts.length > 0 ? supplementalContexts : contexts

  const supplements: SpecialCraftTaskOrder[] = []
  operations.forEach((operation, operationIndex) => {
    if (operation.operationName === '直喷') return
    const existingForOperation = existingTaskOrders
      .filter((taskOrder) => taskOrder.operationId === operation.operationId)
    const existingKeys = new Set(existingForOperation.map((taskOrder) => `${taskOrder.productionOrderId}::${taskOrder.operationId}`))
    let candidateCursor = operationIndex * MIN_TASK_ORDER_COUNT_PER_OPERATION
    while (existingForOperation.length + supplements.filter((taskOrder) => taskOrder.operationId === operation.operationId).length < MIN_TASK_ORDER_COUNT_PER_OPERATION) {
      const context = candidateContexts[candidateCursor % candidateContexts.length]
      candidateCursor += 1
      const key = `${context.order.productionOrderId}::${operation.operationId}`
      if (existingKeys.has(key) && candidateContexts.length > 1 && existingKeys.size < candidateContexts.length) continue
      existingKeys.add(key)

      const variantIndex = existingForOperation.length
        + supplements.filter((taskOrder) => taskOrder.operationId === operation.operationId).length
      const seed = buildLinkedDemoTaskSeed({
        operation,
        operationIndex,
        variantIndex,
        context,
      })
      const inboundArtifacts = buildInboundArtifacts(seed, operationIndex + variantIndex + 1)
      const outboundArtifacts = buildOutboundArtifacts(seed, operationIndex + variantIndex + 3)
      supplements.push(buildTaskOrder(seed, {
        ...inboundArtifacts,
        ...outboundArtifacts,
      }))
    }
  })

  return supplements
}

function getSpecialTypeWarehouseProfile(taskOrder: SpecialCraftTaskOrder): {
  itemKind: FactoryWaitProcessStockItem['itemKind']
  itemName: string
  unit: string
  materialSku?: string
  receiverKind: FactoryWaitHandoverStockItem['receiverKind']
  receiverName: string
  sourceObjectName: string
} {
  const isElastic = taskOrder.craftName.includes('橡筋')
  if (isElastic) {
    return {
      itemKind: '辅料',
      itemName: '定长橡筋',
      unit: '条',
      materialSku: taskOrder.materialSku || `ELASTIC-${taskOrder.sizeCode || 'STD'}`,
      receiverKind: '中转仓',
      receiverName: '辅料中转仓',
      sourceObjectName: '辅料仓',
    }
  }
  if (taskOrder.targetObject === '成衣') {
    const flow = resolveAuxiliaryWarehouseFlow('成衣')
    return {
      itemKind: flow.itemKind,
      itemName: `${taskOrder.craftName}成衣`,
      unit: taskOrder.unit || flow.qtyUnit,
      materialSku: taskOrder.materialSku,
      receiverKind: flow.receiverKind,
      receiverName: flow.receiverName,
      sourceObjectName: flow.sourceObjectName,
    }
  }
  const flow = resolveAuxiliaryWarehouseFlow('已裁部位')
  return {
    itemKind: flow.itemKind,
    itemName: `${taskOrder.partName || '裁片'}${taskOrder.craftName}`,
    unit: taskOrder.unit || flow.qtyUnit,
    materialSku: taskOrder.materialSku,
    receiverKind: flow.receiverKind,
    receiverName: flow.receiverName,
    sourceObjectName: flow.sourceObjectName,
  }
}

function ensureSpecialTypeUnifiedWarehouseArtifacts(taskOrders: SpecialCraftTaskOrder[]): void {
  const specialTypeTaskOrders = taskOrders.filter((taskOrder) => taskOrder.managementDomain === 'SPECIAL_CRAFT_FACTORY')
  if (!specialTypeTaskOrders.length) return

  specialTypeTaskOrders.forEach((taskOrder, index) => {
    const factory = mockFactories.find((item) => item.id === taskOrder.factoryId)
    if (!factory) return
    const profile = getSpecialTypeWarehouseProfile(taskOrder)

    if (shouldCreateInboundRecord(taskOrder.status)) {
      const warehouse = getWarehouse(taskOrder.factoryId, 'WAIT_PROCESS')
      const position = pickWarehousePosition(
        warehouse,
        taskOrder.status === '差异' || taskOrder.abnormalStatus === '数量差异' ? '异常区' : 'A区',
        index + 1,
      )
      const receivedQty = roundQty(taskOrder.receivedQty)
      const differenceQty = roundQty(receivedQty - taskOrder.planQty)
      const inboundRecord = upsertFactoryWarehouseInboundRecord({
        inboundRecordId: `SC-INB-${taskOrder.taskOrderId}`,
        inboundRecordNo: `RK-${taskOrder.taskOrderNo}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: taskOrder.factoryId,
        factoryName: taskOrder.factoryName,
        factoryKind: factory.factoryType,
        processCode: taskOrder.processCode,
        processName: taskOrder.processName,
        craftCode: taskOrder.craftCode,
        craftName: taskOrder.craftName,
        sourceRecordId: `SPC-SRC-${taskOrder.taskOrderId}`,
        sourceRecordNo: `LL-${taskOrder.taskOrderNo}`,
        sourceRecordType: profile.itemKind === '成衣' ? 'HANDOVER_RECEIVE' : 'MATERIAL_PICKUP',
        sourceObjectName: profile.sourceObjectName,
        taskId: taskOrder.sourceTaskId,
        taskNo: taskOrder.sourceTaskNo,
        itemKind: profile.itemKind,
        itemName: profile.itemName,
        materialSku: profile.materialSku,
        partName: taskOrder.partName,
        fabricColor: taskOrder.fabricColor,
        sizeCode: taskOrder.sizeCode,
        feiTicketNo: taskOrder.feiTicketNos[0],
        transferBagNo: taskOrder.transferBagNos[0],
        fabricRollNo: taskOrder.fabricRollNos[0],
        expectedQty: taskOrder.planQty,
        receivedQty,
        differenceQty,
        unit: profile.unit,
        receiverName: factory.contact || '特种工艺仓管',
        receivedAt: taskOrder.createdAt,
        areaName: position.areaName,
        shelfNo: position.shelfNo,
        locationNo: position.locationNo,
        status: differenceQty !== 0 ? '差异待处理' : '已入库',
        abnormalReason: differenceQty !== 0 ? '数量不符' : undefined,
        photoList: differenceQty !== 0 ? ['special-craft-diff-proof.jpg'] : [],
        remark: '特种工艺接收入仓 mock',
      })

      if (shouldCreateWaitProcessRecord(taskOrder.status)) {
        upsertFactoryWaitProcessStockItem({
          ...buildFactoryWaitProcessStockItemFromInboundRecord(inboundRecord),
          stockItemId: `SC-WPS-${taskOrder.taskOrderId}`,
          productionOrderId: taskOrder.productionOrderId,
          productionOrderNo: taskOrder.productionOrderNo,
          taskId: taskOrder.sourceTaskId,
          taskNo: taskOrder.sourceTaskNo,
          status: differenceQty !== 0 || taskOrder.status === '异常' ? '差异待处理' : '已入待加工仓',
          remark: taskOrder.status === '加工中' ? '加工领料中' : '特种工艺待加工库存',
        })
      }
    }

    if (shouldCreatePendingWaitHandoverRecord(taskOrder.status)) {
      const warehouse = getWarehouse(taskOrder.factoryId, 'WAIT_HANDOVER')
      const position = pickWarehousePosition(warehouse, 'B区', index + 3)
      upsertFactoryWaitHandoverStockItem({
        stockItemId: `SC-WHS-${taskOrder.taskOrderId}`,
        warehouseId: warehouse.warehouseId,
        factoryId: taskOrder.factoryId,
        factoryName: taskOrder.factoryName,
        factoryKind: factory.factoryType,
        warehouseName: warehouse.warehouseName,
        processCode: taskOrder.processCode,
        processName: taskOrder.processName,
        craftCode: taskOrder.craftCode,
        craftName: taskOrder.craftName,
        taskId: taskOrder.sourceTaskId,
        taskNo: taskOrder.sourceTaskNo,
        productionOrderId: taskOrder.productionOrderId,
        productionOrderNo: taskOrder.productionOrderNo,
        itemKind: profile.itemKind,
        itemName: profile.itemName,
        materialSku: profile.materialSku,
        partName: taskOrder.partName,
        fabricColor: taskOrder.fabricColor,
        sizeCode: taskOrder.sizeCode,
        feiTicketNo: taskOrder.feiTicketNos[0],
        transferBagNo: taskOrder.transferBagNos[0],
        fabricRollNo: taskOrder.fabricRollNos[0],
        completedQty: roundQty(taskOrder.completedQty),
        lossQty: roundQty(taskOrder.lossQty),
        waitHandoverQty: roundQty(taskOrder.waitHandoverQty || taskOrder.completedQty),
        unit: profile.unit,
        receiverKind: profile.receiverKind,
        receiverName: profile.receiverName,
        handoverOrderId: taskOrder.taskOrderId,
        handoverOrderNo: `JCD-${taskOrder.taskOrderNo}`,
        areaName: position.areaName,
        shelfNo: position.shelfNo,
        locationNo: position.locationNo,
        locationText: position.locationText,
        status: '待交出',
        photoList: [],
        remark: '特种工艺完工入仓 mock',
      })
    }

    if (shouldCreateOutboundRecord(taskOrder.status)) {
      const warehouse = getWarehouse(taskOrder.factoryId, 'WAIT_HANDOVER')
      const position = pickWarehousePosition(
        warehouse,
        taskOrder.status === '差异' || taskOrder.status === '异议中' ? '异常区' : '待确认区',
        index + 5,
      )
      const outboundQty = roundQty(taskOrder.waitHandoverQty || taskOrder.completedQty)
      const receiverWrittenQty =
        taskOrder.status === '已回写'
          ? outboundQty
          : taskOrder.status === '差异'
            ? roundQty(Math.max(outboundQty - Math.min(5, outboundQty), 0))
            : taskOrder.status === '异议中'
              ? roundQty(Math.max(outboundQty - Math.min(3, outboundQty), 0))
              : undefined
      const differenceQty = typeof receiverWrittenQty === 'number' ? roundQty(receiverWrittenQty - outboundQty) : undefined
      const outboundRecord = upsertFactoryWarehouseOutboundRecord({
        outboundRecordId: `SC-OUT-${taskOrder.taskOrderId}`,
        outboundRecordNo: `CK-${taskOrder.taskOrderNo}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: taskOrder.factoryId,
        factoryName: taskOrder.factoryName,
        factoryKind: factory.factoryType,
        processCode: taskOrder.processCode,
        processName: taskOrder.processName,
        craftCode: taskOrder.craftCode,
        craftName: taskOrder.craftName,
        sourceTaskId: taskOrder.sourceTaskId,
        sourceTaskNo: taskOrder.sourceTaskNo,
        handoverOrderId: taskOrder.taskOrderId,
        handoverOrderNo: `JCD-${taskOrder.taskOrderNo}`,
        handoverRecordId: `JH-${taskOrder.taskOrderId}`,
        handoverRecordNo: `JH-${taskOrder.taskOrderNo}`,
        handoverRecordQrValue: `JHQR-${taskOrder.taskOrderId}`,
        receiverKind: profile.receiverKind,
        receiverName: profile.receiverName,
        itemKind: profile.itemKind,
        itemName: profile.itemName,
        materialSku: profile.materialSku,
        partName: taskOrder.partName,
        fabricColor: taskOrder.fabricColor,
        sizeCode: taskOrder.sizeCode,
        feiTicketNo: taskOrder.feiTicketNos[0],
        transferBagNo: taskOrder.transferBagNos[0],
        fabricRollNo: taskOrder.fabricRollNos[0],
        outboundQty,
        receiverWrittenQty,
        differenceQty,
        unit: profile.unit,
        operatorName: factory.contact || '特种工艺仓管',
        outboundAt: taskOrder.updatedAt || taskOrder.createdAt,
        status:
          taskOrder.status === '已交出'
            ? '已出库'
            : taskOrder.status === '已回写'
              ? '已回写'
              : taskOrder.status === '差异'
                ? '差异'
                : '异议中',
        abnormalReason: taskOrder.status === '差异' ? '接收数量差异' : taskOrder.status === '异议中' ? '接收方发起异议' : undefined,
        photoList: taskOrder.status === '差异' || taskOrder.status === '异议中' ? ['special-craft-handover-proof.jpg'] : [],
        remark: '特种工艺交出确认 mock',
      })
      upsertFactoryWaitHandoverStockItem({
        ...buildFactoryWaitHandoverStockItemFromOutboundRecord(outboundRecord),
        stockItemId: `SC-WHS-${taskOrder.taskOrderId}`,
        productionOrderId: taskOrder.productionOrderId,
        productionOrderNo: taskOrder.productionOrderNo,
        areaName: position.areaName,
        shelfNo: position.shelfNo,
        locationNo: position.locationNo,
        locationText: position.locationText,
        status:
          taskOrder.status === '已交出'
            ? '已交出'
            : taskOrder.status === '已回写'
              ? '已回写'
              : taskOrder.status === '差异'
                ? '差异'
                : '异议中',
        differenceQty,
        objectionStatus: taskOrder.status === '异议中' ? '异议中' : undefined,
        remark: '特种工艺交出记录 mock',
      })
    }
  })
}

function normalizeGeneratedTaskOrderForMobile(taskOrder: SpecialCraftTaskOrder): SpecialCraftTaskOrder {
  const sourceTaskNo = taskOrder.sourceTaskNo || `TASK-${taskOrder.taskOrderNo}`
  const sourceTaskId = taskOrder.sourceTaskId || sourceTaskNo
  const operation = getSpecialCraftOperationById(taskOrder.operationId)
  const fallbackFactory = operation ? pickFactoryForOperation(operation, 0) : mockFactories.find((factory) => factory.id === TEST_FACTORY_ID)
  const currentFactoryIsReal = Boolean(taskOrder.factoryId && taskOrder.factoryId !== 'WAIT_ASSIGN')
  const assignedFactoryIsReal = Boolean(taskOrder.assignedFactoryId && taskOrder.assignedFactoryId !== 'WAIT_ASSIGN')
  const suggestedFactoryIsReal = Boolean(taskOrder.suggestedFactoryId && taskOrder.suggestedFactoryId !== 'WAIT_ASSIGN')
  const assignedFactoryId = (assignedFactoryIsReal ? taskOrder.assignedFactoryId : undefined)
    || (suggestedFactoryIsReal ? taskOrder.suggestedFactoryId : undefined)
    || (currentFactoryIsReal ? taskOrder.factoryId : fallbackFactory?.id)
    || TEST_FACTORY_ID
  const assignedFactoryName = (assignedFactoryIsReal ? taskOrder.assignedFactoryName : undefined)
    || (suggestedFactoryIsReal ? taskOrder.suggestedFactoryName : undefined)
    || (currentFactoryIsReal ? taskOrder.factoryName : fallbackFactory?.name)
    || TEST_FACTORY_NAME
  return {
    ...taskOrder,
    sourceTaskId,
    sourceTaskNo,
    factoryId: assignedFactoryId,
    factoryName: assignedFactoryName,
    generationSource: 'PRODUCTION_ORDER',
    generationSourceLabel: taskOrder.generationSourceLabel || '生产单生成',
    sourceTrigger: 'PRODUCTION_ORDER_CREATED',
    sourceTriggerLabel: taskOrder.sourceTriggerLabel || '生产单自动拆分任务',
    assignmentStatus: 'ASSIGNED',
    assignmentStatusLabel: '已分配',
    executionStatus: taskOrder.executionStatus || mapTaskStatusToExecutionStatus(taskOrder.status),
    executionStatusLabel: taskOrder.executionStatusLabel || taskOrder.status,
    assignedFactoryId,
    assignedFactoryName,
    suggestedFactoryId: taskOrder.suggestedFactoryId || assignedFactoryId,
    suggestedFactoryName: taskOrder.suggestedFactoryName || assignedFactoryName,
    assignmentMode: taskOrder.assignmentMode || '直接派单',
  }
}

export function getSpecialCraftWorkOrderBusinessType(
  operationId: string,
): string {
  if (operationId === 'AUX-OP-HEAT-TRANSFER') return 'HEAT_TRANSFER'
  if (operationId === 'AUX-OP-DIRECT-PRINT') return 'DIRECT_PRINT'
  return 'OTHER_SPECIAL_CRAFT'
}

function ensureStore(): SpecialCraftTaskStore {
  if (!specialCraftTaskStore) {
    const generatedResults = generateSpecialCraftTaskOrdersForAllProductionOrders([])
    const generatedTaskOrders = generatedResults
      .flatMap((item) => item.taskOrders)
      .map((taskOrder) => normalizeGeneratedTaskOrderForMobile(taskOrder))
    const generationBatches = generatedResults.map((item) => item.generationBatch)
    const generationErrors = generatedResults.flatMap((item) => item.errors)
    const supplementalTaskOrders = buildLinkedSupplementTaskOrders(generatedTaskOrders)
    const taskOrders = [...generatedTaskOrders, ...supplementalTaskOrders]
    ensureSpecialTypeUnifiedWarehouseArtifacts(taskOrders)
    specialCraftTaskStore = {
      taskOrders,
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
    throw new Error(`非法工艺加工单：${taskOrder.taskOrderNo}`)
  }
  if (operation.processCode !== taskOrder.processCode || operation.craftCode !== taskOrder.craftCode) {
    throw new Error(`工艺加工单编码不匹配：${taskOrder.taskOrderNo}`)
  }
  if (operation.managementDomain !== taskOrder.managementDomain) {
    throw new Error(`工艺加工单管理域不匹配：${taskOrder.taskOrderNo}`)
  }
}

export function getSpecialCraftTaskOrders(
  operationId: string,
  filters: SpecialCraftTaskFilters = {},
): SpecialCraftTaskOrder[] {
  return ensureStore().taskOrders.filter((taskOrder) => {
    if (taskOrder.operationId !== operationId) return false
    if (filters.managementDomain && taskOrder.managementDomain !== filters.managementDomain) return false
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

export function confirmSpecialCraftTaskOrderReceiptBySku(input: {
  taskOrderId: string
  receivedQtyBySkuCode: Record<string, number>
  receiverName: string
  receivedAt: string
}): SpecialCraftTaskOrder | undefined {
  const taskOrder = getSpecialCraftTaskOrderById(input.taskOrderId)
  if (!taskOrder || !taskOrder.demandLines?.length) return undefined
  const lines = taskOrder.demandLines
  const invalidLine = lines.find((line) => {
    const receivedQty = input.receivedQtyBySkuCode[line.skuCode]
    return !Number.isInteger(receivedQty) || receivedQty < 0 || receivedQty > line.planPieceQty
  })
  if (invalidLine) throw new Error(`SKU ${invalidLine.skuCode} 实收件数无效。`)
  const totalReceivedQty = lines.reduce((sum, line) => sum + (input.receivedQtyBySkuCode[line.skuCode] || 0), 0)
  return updateSpecialCraftTaskOrderWebStatus(input.taskOrderId, {
    status: '已入待加工仓',
    operatorName: input.receiverName,
    operatedAt: input.receivedAt,
    receivedQty: totalReceivedQty,
    completedQty: 0,
    remark: `按 ${lines.length} 个 SKU 确认实收 ${totalReceivedQty} 件`,
  })
}

export function confirmSpecialCraftTaskOrderCompletionBySku(input: {
  taskOrderId: string
  completedQtyBySkuCode: Record<string, number>
  scrapQtyBySkuCode: Record<string, number>
  damageQtyBySkuCode: Record<string, number>
  operatorName: string
  operatedAt: string
}): SpecialCraftTaskOrder | undefined {
  const taskOrder = getSpecialCraftTaskOrderById(input.taskOrderId)
  if (!taskOrder || !taskOrder.demandLines?.length) return undefined
  const lines = taskOrder.demandLines
  const expectedSkuCodes = lines.map((line) => line.skuCode).sort()
  const hasExactSkuSet = (qtyBySkuCode: Record<string, number>) => {
    const actualSkuCodes = Object.keys(qtyBySkuCode).sort()
    return actualSkuCodes.length === expectedSkuCodes.length
      && actualSkuCodes.every((skuCode, index) => skuCode === expectedSkuCodes[index])
  }
  if (
    !hasExactSkuSet(input.completedQtyBySkuCode)
    || !hasExactSkuSet(input.scrapQtyBySkuCode)
    || !hasExactSkuSet(input.damageQtyBySkuCode)
  ) {
    throw new Error('逐 SKU 完工必须覆盖全部 SKU，且不得包含其他 SKU。')
  }
  const invalidLine = lines.find((line) => {
    const completedQty = input.completedQtyBySkuCode[line.skuCode]
    const scrapQty = input.scrapQtyBySkuCode[line.skuCode]
    const damageQty = input.damageQtyBySkuCode[line.skuCode]
    return !Number.isInteger(completedQty) || completedQty < 0
      || !Number.isInteger(scrapQty) || scrapQty < 0
      || !Number.isInteger(damageQty) || damageQty < 0
      || completedQty + scrapQty + damageQty !== taskOrder.receivedQty
  })
  if (invalidLine) throw new Error(`SKU ${invalidLine.skuCode} 的完工、报废和货损件数必须为整数，且合计等于已收件数。`)
  const completedQty = lines.reduce((sum, line) => sum + (input.completedQtyBySkuCode[line.skuCode] || 0), 0)
  const scrapQty = lines.reduce((sum, line) => sum + (input.scrapQtyBySkuCode[line.skuCode] || 0), 0)
  const damageQty = lines.reduce((sum, line) => sum + (input.damageQtyBySkuCode[line.skuCode] || 0), 0)
  return updateSpecialCraftTaskOrderWebStatus(input.taskOrderId, {
    status: '待交出',
    operatorName: input.operatorName,
    operatedAt: input.operatedAt,
    completedQty,
    lossQty: scrapQty,
    damageQty,
    waitHandoverQty: completedQty,
    remark: `按 ${lines.length} 个 SKU 确认完工 ${completedQty} 件，报废 ${scrapQty} 件，货损 ${damageQty} 件`,
  })
}

export function updateSpecialCraftTaskOrderWebStatus(
  taskOrderId: string,
  payload: {
    status: SpecialCraftTaskStatus
    operatorName?: string
    operatedAt?: string
    receivedQty?: number
    completedQty?: number
    lossQty?: number
    damageQty?: number
    waitHandoverQty?: number
    remark?: string
  },
): SpecialCraftTaskOrder | undefined {
  const store = ensureStore()
  const taskOrderIndex = store.taskOrders.findIndex((taskOrder) => taskOrder.taskOrderId === taskOrderId)
  if (taskOrderIndex < 0) return undefined
  const current = store.taskOrders[taskOrderIndex]
  const next: SpecialCraftTaskOrder = {
    ...current,
    status: payload.status,
    receivedQty: Number.isFinite(payload.receivedQty) ? Number(payload.receivedQty) : current.receivedQty,
    completedQty: Number.isFinite(payload.completedQty) ? Number(payload.completedQty) : current.completedQty,
    lossQty: Number.isFinite(payload.lossQty) ? Number(payload.lossQty) : current.lossQty,
    damageQty: Number.isFinite(payload.damageQty) ? Number(payload.damageQty) : current.damageQty,
    waitHandoverQty: Number.isFinite(payload.waitHandoverQty) ? Number(payload.waitHandoverQty) : current.waitHandoverQty,
    currentQty: Number.isFinite(payload.completedQty) ? Number(payload.completedQty) : current.currentQty,
    executionStatus:
      payload.status === '已入待加工仓'
        ? 'IN_WAIT_PROCESS_WAREHOUSE'
        : payload.status === '加工中'
          ? 'PROCESSING'
          : payload.status === '已完成'
            ? 'COMPLETED'
            : payload.status === '待交出'
              ? 'WAIT_HANDOVER'
              : payload.status === '已交出'
                ? 'HANDED_OVER'
                : payload.status === '已回写'
                  ? 'WRITTEN_BACK'
                : payload.status === '差异'
                  ? 'DIFFERENCE'
                  : payload.status === '异议中'
                    ? 'OBJECTION'
                    : payload.status === '异常'
                      ? 'ABNORMAL'
                      : 'WAIT_PICKUP',
    executionStatusLabel: payload.status,
    abnormalStatus: payload.status === '差异' ? '数量差异' : current.abnormalStatus,
    openDifferenceReportCount:
      payload.status === '差异' || payload.status === '异常'
        ? Math.max(current.openDifferenceReportCount || 0, 1)
        : current.openDifferenceReportCount,
    updatedAt: payload.operatedAt || formatDay(0),
    remark: payload.remark?.trim() || current.remark,
  }
  store.taskOrders[taskOrderIndex] = next
  return next
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

export function listSpecialCraftTaskOrders(): SpecialCraftTaskOrder[] {
  return [...ensureStore().taskOrders]
}

export function listAuxiliaryCraftTaskOrders(): SpecialCraftTaskOrder[] {
  return listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.managementDomain === 'AUXILIARY_CRAFT_FACTORY')
}

export function listSpecialTypeCraftTaskOrders(): SpecialCraftTaskOrder[] {
  return listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.managementDomain === 'SPECIAL_CRAFT_FACTORY')
}

export function listSpecialCraftTaskOrdersByManagementDomain(
  managementDomain: SpecialCraftOperationDefinition['managementDomain'],
): SpecialCraftTaskOrder[] {
  return listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.managementDomain === managementDomain)
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

export function buildSpecialCraftPageTitle(
  operation: SpecialCraftOperationDefinition,
  suffix: '加工单' | '加工单详情' | '待加工仓' | '待交出仓',
): string {
  return `${operation.operationName}${suffix}`
}

export function getSpecialCraftOperationLabel(operation: SpecialCraftOperationDefinition): string {
  return operation.operationName
}

export function listSpecialCraftOperationSlugs(): string[] {
  return listEnabledSpecialCraftOperationDefinitions().map((item) => buildSpecialCraftOperationSlug(item))
}
