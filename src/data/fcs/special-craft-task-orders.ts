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
import {
  BUTTON_LOOP_INPUT_UNIT,
  BUTTON_LOOP_OPERATION_ID,
  BUTTON_LOOP_OUTPUT_UNIT,
  BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME,
  applyButtonLoopTaskAction,
  buildButtonLoopTaskOrders,
  type ButtonLoopTaskAction,
  type ButtonLoopTaskEvent,
  type ButtonLoopTaskInputLine,
  type ButtonLoopTaskOrder,
  type ButtonLoopSelectedBindingStripInput,
} from './button-loop-craft-flow.ts'
import { buildBindingProcessOrders } from '../../pages/process-factory/cutting/binding-strip-orders.ts'
import { shouldGenerateInternalCraftOrderForProductionOrder } from './task-generation-boundaries.ts'

export type SpecialCraftTaskStatus =
  | '待接收'
  | '加工中'
  | '已完结'

export type SpecialCraftTaskAbnormalStatus = '无异常'

export type SpecialCraftTaskGenerationSource = 'PRODUCTION_ORDER'
export type SpecialCraftTaskSourceTrigger = 'PRODUCTION_ORDER_CREATED'
export type SpecialCraftTaskAssignmentStatus = 'WAIT_ASSIGN' | 'ASSIGNED'
export type SpecialCraftTaskExecutionStatus =
  | 'WAIT_PICKUP'
  | 'PROCESSING'
  | 'COMPLETED'

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
  status: '已入库' | '待交出' | '已出库' | '已回写'
}

export interface SpecialCraftTaskLineProgress {
  lineProgressKey: string
  lineType: 'sku' | 'fei-ticket'
  skuCode?: string
  feiTicketNo?: string
  partName: string
  colorName: string
  sizeCode: string
  planQty: number
  receivedQty: number
  completedQty: number
  returnedQty: number
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
  quantityMode?: SpecialCraftOperationDefinition['quantityMode']
  inputUnit?: string
  outputUnit?: string
  receiverWarehouseName?: string
  selectedBindingStripCount?: number
  inputTicketCount?: number
  receivedTicketCount?: number
  inputLengthM?: number
  outputQty?: number
  handedOverQty?: number
  buttonLoopInputLines?: ButtonLoopTaskInputLine[]
  buttonLoopEvents?: ButtonLoopTaskEvent[]
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
  writebackQty?: number
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
  lineProgress?: SpecialCraftTaskLineProgress[]
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
  sourceAction: '接收确认' | '交出接收'
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
  '待接收',
  '加工中',
  '加工中',
  '已完结',
  '加工中',
  '已完结',
  '已完结',
  '加工中',
  '加工中',
]
const LINKED_DEMO_ABNORMALS: SpecialCraftTaskAbnormalStatus[] = [
  '无异常',
  '无异常',
  '无异常',
  '无异常',
  '无异常',
  '无异常',
  '无异常',
  '无异常',
  '无异常',
]
let specialCraftTaskStore: SpecialCraftTaskStore | null = null
const invalidatedMergedTaskOrderLogs: Array<{
  taskOrderId: string
  productionOrderId: string
  mergedTaskId: string
  invalidatedAt: string
  invalidatedBy: string
  reason: string
  restoredAt?: string
  restoredBy?: string
  restoreReason?: string
}> = []

function formatDay(offsetDays = 0): string {
  const date = new Date(Date.UTC(2026, 3, 23 + offsetDays, 9, 0, 0))
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100
}

function clampQty(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return roundQty(Math.min(Math.max(value, min), max))
}

function allocateProgress(rows: SpecialCraftTaskLineProgress[], total: number, field: 'receivedQty' | 'completedQty' | 'returnedQty'): void {
  let remaining = Math.max(total || 0, 0)
  rows.forEach((row) => {
    const fieldMax = field === 'receivedQty'
      ? row.planQty
      : field === 'completedQty'
        ? row.receivedQty
        : row.completedQty
    const qty = clampQty(Math.min(remaining, fieldMax), 0, fieldMax)
    row[field] = qty
    remaining = roundQty(remaining - qty)
  })
}

function buildSpecialCraftTaskLineProgress(taskOrder: SpecialCraftTaskOrder): SpecialCraftTaskLineProgress[] {
  const lines = taskOrder.demandLines || []
  const rows = new Map<string, SpecialCraftTaskLineProgress>()
  const isGarment = taskOrder.targetObject === '成衣'

  if (isGarment) {
    lines.forEach((line) => {
      const skuCode = line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
      const key = `sku:${skuCode}`
      const existing = rows.get(key)
      if (existing) {
        existing.planQty = roundQty(existing.planQty + line.planPieceQty)
      } else {
        rows.set(key, {
          lineProgressKey: key,
          lineType: 'sku',
          skuCode,
          partName: line.partName || taskOrder.partName || '成衣',
          colorName: line.colorName || taskOrder.fabricColor || '—',
          sizeCode: line.sizeCode || taskOrder.sizeCode || '—',
          planQty: roundQty(line.planPieceQty),
          receivedQty: 0,
          completedQty: 0,
          returnedQty: 0,
        })
      }
    })
  } else {
    lines.forEach((line) => {
      const ticketNos = line.feiTicketNos?.length ? line.feiTicketNos : ['无菲票']
      const ticketQty = line.planPieceQty / ticketNos.length
      ticketNos.forEach((ticketNo) => {
        const key = `fei:${ticketNo}`
        const existing = rows.get(key)
        if (existing) {
          existing.planQty = roundQty(existing.planQty + ticketQty)
        } else {
          rows.set(key, {
            lineProgressKey: key,
            lineType: 'fei-ticket',
            feiTicketNo: ticketNo,
            partName: line.partName || taskOrder.partName || '裁片',
            colorName: line.colorName || taskOrder.fabricColor || '—',
            sizeCode: line.sizeCode || taskOrder.sizeCode || '—',
            planQty: roundQty(ticketQty),
            receivedQty: 0,
            completedQty: 0,
            returnedQty: 0,
          })
        }
      })
    })
  }

  if (rows.size === 0) {
    rows.set(isGarment ? 'sku:DEFAULT' : 'fei:DEFAULT', {
      lineProgressKey: isGarment ? 'sku:DEFAULT' : 'fei:DEFAULT',
      lineType: isGarment ? 'sku' : 'fei-ticket',
      skuCode: isGarment ? taskOrder.materialSku || 'DEFAULT' : undefined,
      feiTicketNo: isGarment ? undefined : taskOrder.feiTicketNos[0] || '无菲票',
      partName: taskOrder.partName || (isGarment ? '成衣' : '裁片'),
      colorName: taskOrder.fabricColor || '—',
      sizeCode: taskOrder.sizeCode || '—',
      planQty: taskOrder.planQty,
      receivedQty: 0,
      completedQty: 0,
      returnedQty: 0,
    })
  }

  const progressRows = [...rows.values()]
  allocateProgress(progressRows, taskOrder.receivedQty, 'receivedQty')
  allocateProgress(progressRows, taskOrder.completedQty, 'completedQty')
  allocateProgress(progressRows, taskOrder.returnedQty || 0, 'returnedQty')
  return progressRows
}

function normalizeSpecialCraftLineProgress(taskOrder: SpecialCraftTaskOrder): SpecialCraftTaskLineProgress[] {
  return (taskOrder.lineProgress?.length ? taskOrder.lineProgress : buildSpecialCraftTaskLineProgress(taskOrder)).map((row) => ({
    ...row,
    planQty: roundQty(row.planQty),
    receivedQty: clampQty(row.receivedQty, 0, row.planQty),
    completedQty: clampQty(row.completedQty, 0, row.receivedQty),
    returnedQty: clampQty(row.returnedQty, 0, row.completedQty),
  }))
}

function summarizeLineProgress(lineProgress: SpecialCraftTaskLineProgress[]): Pick<SpecialCraftTaskOrder, 'receivedQty' | 'completedQty' | 'returnedQty' | 'waitHandoverQty' | 'currentQty'> {
  const receivedQty = roundQty(lineProgress.reduce((sum, row) => sum + row.receivedQty, 0))
  const completedQty = roundQty(lineProgress.reduce((sum, row) => sum + row.completedQty, 0))
  const returnedQty = roundQty(lineProgress.reduce((sum, row) => sum + row.returnedQty, 0))
  return {
    receivedQty,
    completedQty,
    returnedQty,
    waitHandoverQty: roundQty(Math.max(completedQty - returnedQty, 0)),
    currentQty: completedQty,
  }
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
  const preferred = matched.filter(
    (factory) => factory.factoryType === 'SATELLITE_FINISHING' || factory.factoryType === 'CENTRAL_SPECIAL',
  )
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
  preferredAreaName: string,
  seed: number,
  fallbackAreaName?: 'A区' | 'B区' | '异常区' | '待确认区',
): { areaName: string; shelfNo: string; locationNo: string; locationText: string } {
  const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName)
    ?? warehouse.areaList.find((item) => item.areaName.includes(preferredAreaName))
    ?? warehouse.areaList.find((item) => item.areaName === fallbackAreaName)
    ?? warehouse.areaList[0]
  const shelf = area.shelfList[seed % area.shelfList.length]
  const location = shelf.locationList[seed % shelf.locationList.length]
  return {
    areaName: area.areaName,
    shelfNo: shelf.shelfNo,
    locationNo: location.locationNo,
    locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
  }
}

function getCraftWarehouseAreaName(operationName: string, targetObject: SpecialCraftTargetObject): string {
  const objectName = targetObject === '成衣'
    ? '成衣'
    : targetObject === '捆条'
      ? '捆条'
      : operationName.includes('橡筋')
        ? '辅料'
        : '裁片'
  return `${operationName}-${objectName}库区`
}

function getTaskUnit(targetObject: SpecialCraftTargetObject): string {
  return getSpecialCraftFlowRule(targetObject).unit
}

function getTaskItemKind(targetObject: SpecialCraftTargetObject): '裁片' | '面料' | '成衣' | '辅料' {
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
  if (status === '待接收') return 'WAIT_PICKUP'
  if (status === '加工中') return 'PROCESSING'
  return 'COMPLETED'
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
  const garmentBom = operation.targetObject === '成衣'
    ? snapshot.bomItems.find((item) =>
        item.type === '成衣'
        && (item.applicableSkuCodes ?? []).includes(orderLine.skuCode),
      )
    : undefined
  const taskPrefix = operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'AUX' : 'SPC'
  const craftShortCode = operation.craftCode.replace('CRAFT_', '').replace(/^0+/, '').slice(-4) || operation.operationId.slice(-4)
  const seedKey = stableDemoHash([operation.operationId, order.productionOrderId, variantIndex].join('|'))
  const variantNo = String(variantIndex + 1).padStart(2, '0')
  const taskOrderId = `${taskPrefix}-TASK-${order.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${operation.operationId.slice(-4)}-${variantNo}-${seedKey.slice(0, 8)}`
  const taskOrderNo = `${taskPrefix}-${order.productionOrderNo.replace(/^PO-/, '')}-${craftShortCode}-${variantNo}`
  const sourceTaskNo = `TASK-${taskOrderNo}`
  // PO-202603-0101 是任务分配页的“未合并来源任务”演示单；在用户决定是否创建
  // 裁剪+车缝+烫包之前，中央辅助/特种工艺加工单必须保持未接收，不能用轮转
  // Mock 伪造已经开工的事实，否则会错误阻断固定合并任务创建。
  const status = order.productionOrderId === 'PO-202603-0101'
    ? '待接收'
    : LINKED_DEMO_STATUSES[variantIndex % LINKED_DEMO_STATUSES.length]
  const abnormalStatus = LINKED_DEMO_ABNORMALS[variantIndex % LINKED_DEMO_ABNORMALS.length]
  const targetObject = operation.targetObject
  const pieceCountPerGarment = targetObject === '成衣' ? 1 : patternContext.pieceCountPerGarment
  const planQty = roundQty(orderLine.qty * pieceCountPerGarment)
  const receivedQty = status === '待接收' ? 0 : roundQty(planQty)
  const completedQty = status === '已完结'
    ? receivedQty
    : status === '加工中'
      ? roundQty(Math.max(receivedQty * 0.45, 0))
      : 0
  const lossQty = roundQty(Math.max(receivedQty - completedQty, 0))
  const waitHandoverQty = status === '已完结' ? completedQty : 0
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
    sourceBomItemId: garmentBom?.id,
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
    sourceAction: targetObject === '成衣' ? '交出接收' : '接收确认',
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
  return status !== '待接收'
}

function shouldCreateWaitProcessRecord(status: SpecialCraftTaskStatus): boolean {
  return status === '加工中'
}

function shouldCreatePendingWaitHandoverRecord(status: SpecialCraftTaskStatus): boolean {
  return status === '已完结'
}

function shouldCreateOutboundRecord(status: SpecialCraftTaskStatus): boolean {
  return status === '已完结'
}

function buildInboundArtifacts(seed: TaskSeedContext, positionIndex: number): WarehouseArtifacts {
  if (!shouldCreateInboundRecord(seed.status)) return {}

  const warehouse = getWarehouse(seed.factory.id, 'WAIT_PROCESS')
  const inboundPosition = pickWarehousePosition(
    warehouse,
    getCraftWarehouseAreaName(seed.operation.operationName, seed.operation.targetObject),
    positionIndex,
    'A区',
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
  const position = pickWarehousePosition(
    warehouse,
    getCraftWarehouseAreaName(seed.operation.operationName, seed.operation.targetObject),
    positionIndex,
    'B区',
  )
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
    getCraftWarehouseAreaName(seed.operation.operationName, seed.operation.targetObject),
    positionIndex,
    '待确认区',
  )
  const outboundQty = roundQty(seed.completedQty - seed.lossQty)
  const receiverWrittenQty = seed.status === '已完结'
    ? outboundQty
    : undefined
  const outboundStatus: FactoryWarehouseOutboundRecord['status'] =
    seed.status === '已完结'
      ? '已回写'
      : '待交出'
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
    unit: seed.unit,
    operatorName: seed.factory.contact,
    outboundAt: seed.createdAt,
    status: outboundStatus,
    photoList: [],
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
      seed.status === '已完结'
        ? '已回写'
        : '待交出',
    differenceQty: undefined,
    objectionStatus: undefined,
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
      status: '已入库',
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
          : '已回写',
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
      nodeName: '待接收',
      actionName: '来源生产单',
      beforeStatus: '待接收',
      afterStatus: '待接收',
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
        nodeName: '加工中',
        actionName: seed.sourceAction,
        beforeStatus: '待接收',
        afterStatus: '加工中',
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

  if (seed.status !== '待接收') {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '加工中',
        actionName: '开工',
        beforeStatus: '待接收',
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

  if (seed.status === '已完结') {
    rows.push(
      createNodeRecord(seed, rows.length, {
        nodeName: '已完结',
        actionName: '完结',
        beforeStatus: '加工中',
        afterStatus: '已完结',
        qty: seed.completedQty,
        unit: seed.unit,
        operatorName: `${seed.factory.contact}组长`,
        operatedAt: formatDay(1),
        relatedRecordNo: seed.taskOrderNo,
        relatedRecordType: '任务记录',
        photoCount: 1,
        remark: '已完结',
      }),
    )
  }

  return rows
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
    executionStatus: seed.executionStatus || (seed.status === '待接收'
        ? 'WAIT_PICKUP'
        : seed.status === '加工中'
          ? 'PROCESSING'
          : 'COMPLETED'),
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
    remark: seed.remark || '展示已由生产单沉淀后的工艺加工结果。',
  }
  taskOrder.nodeRecords = buildNodeRecords(seed, artifacts)
  taskOrder.warehouseLinks = buildWarehouseLinks(seed, artifacts)
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
    const operationCandidateContexts = operation.targetObject === '成衣'
      ? candidateContexts.filter(({ order, snapshot }) => {
          const productionSkuCodes = new Set(order.demandSnapshot.skuLines.map((line) => line.skuCode))
          return snapshot.bomItems.some((item) =>
            item.type === '成衣'
            && (item.applicableSkuCodes ?? []).some((skuCode) => productionSkuCodes.has(skuCode)),
          )
        })
      : candidateContexts
    if (operationCandidateContexts.length === 0) return
    const existingForOperation = existingTaskOrders
      .filter((taskOrder) => taskOrder.operationId === operation.operationId)
    const existingKeys = new Set(existingForOperation.map((taskOrder) => `${taskOrder.productionOrderId}::${taskOrder.operationId}`))
    let candidateCursor = operationIndex * MIN_TASK_ORDER_COUNT_PER_OPERATION
    while (existingForOperation.length + supplements.filter((taskOrder) => taskOrder.operationId === operation.operationId).length < MIN_TASK_ORDER_COUNT_PER_OPERATION) {
      const context = operationCandidateContexts[candidateCursor % operationCandidateContexts.length]
      candidateCursor += 1
      const key = `${context.order.productionOrderId}::${operation.operationId}`
      if (existingKeys.has(key) && operationCandidateContexts.length > 1 && existingKeys.size < operationCandidateContexts.length) continue
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

function getSpecialCraftWarehouseProfile(taskOrder: SpecialCraftTaskOrder): {
  inputItemKind: FactoryWaitProcessStockItem['itemKind']
  inputItemName: string
  inputUnit: string
  outputItemKind: FactoryWaitHandoverStockItem['itemKind']
  outputItemName: string
  outputUnit: string
  materialSku?: string
  receiverKind: FactoryWaitHandoverStockItem['receiverKind']
  receiverName: string
  sourceObjectName: string
} {
  if (taskOrder.quantityMode === 'TICKET_INPUT_OUTPUT') {
    return {
      inputItemKind: '辅料',
      inputItemName: '盘扣捆条菲票',
      inputUnit: taskOrder.inputUnit || '张',
      outputItemKind: '辅料',
      outputItemName: '盘扣成品',
      outputUnit: taskOrder.outputUnit || '个',
      materialSku: taskOrder.materialSku,
      receiverKind: '其他接收方',
      receiverName: taskOrder.receiverWarehouseName || '中央辅料仓',
      sourceObjectName: '裁床待交出仓',
    }
  }
  const isElastic = taskOrder.craftName.includes('橡筋')
  if (isElastic) {
    return {
      inputItemKind: '辅料',
      inputItemName: '定长橡筋',
      inputUnit: '条',
      outputItemKind: '辅料',
      outputItemName: '定长橡筋',
      outputUnit: '条',
      materialSku: taskOrder.materialSku || `ELASTIC-${taskOrder.sizeCode || 'STD'}`,
      receiverKind: '中转仓',
      receiverName: '辅料中转仓',
      sourceObjectName: '辅料仓',
    }
  }
  if (taskOrder.targetObject === '成衣') {
    const flow = resolveAuxiliaryWarehouseFlow('成衣')
    return {
      inputItemKind: flow.itemKind,
      inputItemName: `${taskOrder.craftName}成衣`,
      inputUnit: taskOrder.unit || flow.qtyUnit,
      outputItemKind: flow.itemKind,
      outputItemName: `${taskOrder.craftName}成衣`,
      outputUnit: taskOrder.unit || flow.qtyUnit,
      materialSku: taskOrder.materialSku,
      receiverKind: flow.receiverKind,
      receiverName: flow.receiverName,
      sourceObjectName: flow.sourceObjectName,
    }
  }
  const flow = resolveAuxiliaryWarehouseFlow('已裁部位')
  return {
    inputItemKind: flow.itemKind,
    inputItemName: `${taskOrder.partName || '裁片'}${taskOrder.craftName}`,
    inputUnit: taskOrder.unit || flow.qtyUnit,
    outputItemKind: flow.itemKind,
    outputItemName: `${taskOrder.partName || '裁片'}${taskOrder.craftName}`,
    outputUnit: taskOrder.unit || flow.qtyUnit,
    materialSku: taskOrder.materialSku,
    receiverKind: flow.receiverKind,
    receiverName: flow.receiverName,
    sourceObjectName: flow.sourceObjectName,
  }
}

function ensureSpecialCraftUnifiedWarehouseArtifacts(taskOrders: SpecialCraftTaskOrder[]): void {
  const managedTaskOrders = taskOrders.filter((taskOrder) =>
    taskOrder.managementDomain === 'SPECIAL_CRAFT_FACTORY'
    || taskOrder.managementDomain === 'AUXILIARY_CRAFT_FACTORY',
  )
  if (!managedTaskOrders.length) return

  managedTaskOrders.forEach((taskOrder, index) => {
    const factory = mockFactories.find((item) => item.id === taskOrder.factoryId)
    if (!factory) return
    const profile = getSpecialCraftWarehouseProfile(taskOrder)
    const isButtonLoop = taskOrder.quantityMode === 'TICKET_INPUT_OUTPUT'
    const hasPendingButtonLoopOutput = isButtonLoop && Number(taskOrder.waitHandoverQty || 0) > 0
    const inputExpectedQty = isButtonLoop ? taskOrder.inputTicketCount || taskOrder.planQty : taskOrder.planQty
    const inputReceivedQty = isButtonLoop ? taskOrder.receivedTicketCount || 0 : taskOrder.receivedQty
    let linkedInboundRecord: FactoryWarehouseInboundRecord | undefined
    let linkedWaitProcessItem: FactoryWaitProcessStockItem | undefined
    let linkedWaitHandoverItem: FactoryWaitHandoverStockItem | undefined
    let linkedOutboundRecord: FactoryWarehouseOutboundRecord | undefined

    if (shouldCreateInboundRecord(taskOrder.status)) {
      const warehouse = getWarehouse(taskOrder.factoryId, 'WAIT_PROCESS')
      const position = pickWarehousePosition(
        warehouse,
        getCraftWarehouseAreaName(taskOrder.operationName, taskOrder.targetObject),
        index + 1,
        'A区',
      )
      const receivedQty = roundQty(inputReceivedQty)
      const differenceQty = roundQty(receivedQty - inputExpectedQty)
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
        sourceRecordType: profile.inputItemKind === '成衣' ? 'HANDOVER_RECEIVE' : 'MATERIAL_PICKUP',
        sourceObjectName: profile.sourceObjectName,
        taskId: taskOrder.sourceTaskId,
        taskNo: taskOrder.sourceTaskNo,
        itemKind: profile.inputItemKind,
        itemName: profile.inputItemName,
        materialSku: profile.materialSku,
        partName: taskOrder.partName,
        fabricColor: taskOrder.fabricColor,
        sizeCode: taskOrder.sizeCode,
        feiTicketNo: taskOrder.feiTicketNos[0],
        transferBagNo: taskOrder.transferBagNos[0],
        fabricRollNo: taskOrder.fabricRollNos[0],
        expectedQty: inputExpectedQty,
        receivedQty,
        differenceQty,
        unit: profile.inputUnit,
        receiverName: factory.contact || '特种工艺仓管',
        receivedAt: taskOrder.createdAt,
        areaName: position.areaName,
        shelfNo: position.shelfNo,
        locationNo: position.locationNo,
        status: differenceQty !== 0 ? '差异待处理' : '已入库',
        abnormalReason: differenceQty !== 0 ? '数量不符' : undefined,
        photoList: differenceQty !== 0 ? ['special-craft-diff-proof.jpg'] : [],
        remark: isButtonLoop ? '盘扣捆条菲票确认接收入待加工仓' : '工艺接收入仓',
      })
      linkedInboundRecord = inboundRecord

      if (shouldCreateWaitProcessRecord(taskOrder.status)) {
        linkedWaitProcessItem = upsertFactoryWaitProcessStockItem({
          ...buildFactoryWaitProcessStockItemFromInboundRecord(inboundRecord),
          stockItemId: `SC-WPS-${taskOrder.taskOrderId}`,
          productionOrderId: taskOrder.productionOrderId,
          productionOrderNo: taskOrder.productionOrderNo,
          taskId: taskOrder.sourceTaskId,
          taskNo: taskOrder.sourceTaskNo,
          status: differenceQty !== 0 ? '差异待处理' : '已入待加工仓',
          remark: isButtonLoop ? '已接收盘扣捆条菲票，待加工填报盘扣产出' : taskOrder.status === '加工中' ? '加工接收中' : '工艺待加工库存',
        })
      }
    }

    if (shouldCreatePendingWaitHandoverRecord(taskOrder.status) || (isButtonLoop && (taskOrder.waitHandoverQty || 0) > 0)) {
      const warehouse = getWarehouse(taskOrder.factoryId, 'WAIT_HANDOVER')
      const position = pickWarehousePosition(
        warehouse,
        getCraftWarehouseAreaName(taskOrder.operationName, taskOrder.targetObject),
        index + 3,
        'B区',
      )
      linkedWaitHandoverItem = upsertFactoryWaitHandoverStockItem({
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
        itemKind: profile.outputItemKind,
        itemName: profile.outputItemName,
        materialSku: profile.materialSku,
        partName: taskOrder.partName,
        fabricColor: taskOrder.fabricColor,
        sizeCode: taskOrder.sizeCode,
        feiTicketNo: taskOrder.feiTicketNos[0],
        transferBagNo: taskOrder.transferBagNos[0],
        fabricRollNo: taskOrder.fabricRollNos[0],
        completedQty: roundQty(isButtonLoop ? taskOrder.outputQty || 0 : taskOrder.completedQty),
        lossQty: roundQty(taskOrder.lossQty),
        waitHandoverQty: roundQty(taskOrder.waitHandoverQty || taskOrder.completedQty),
        unit: profile.outputUnit,
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
        remark: isButtonLoop ? `盘扣成品待交${taskOrder.receiverWarehouseName || '中央辅料仓'}` : '工艺完工入仓',
      })
    }

    if (shouldCreateOutboundRecord(taskOrder.status) || (isButtonLoop && (taskOrder.handedOverQty || 0) > 0)) {
      const warehouse = getWarehouse(taskOrder.factoryId, 'WAIT_HANDOVER')
      const position = pickWarehousePosition(
        warehouse,
        getCraftWarehouseAreaName(taskOrder.operationName, taskOrder.targetObject),
        index + 5,
        '待确认区',
      )
      const outboundQty = roundQty(isButtonLoop ? taskOrder.handedOverQty || 0 : taskOrder.waitHandoverQty || taskOrder.completedQty)
      const receiverWrittenQty = taskOrder.status === '已完结'
        ? outboundQty
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
        itemKind: profile.outputItemKind,
        itemName: profile.outputItemName,
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
        unit: profile.outputUnit,
        operatorName: factory.contact || '特种工艺仓管',
        outboundAt: taskOrder.updatedAt || taskOrder.createdAt,
        status:
          isButtonLoop
            ? '已出库'
            : taskOrder.status === '已完结'
              ? '已回写'
              : '待交出',
        remark: isButtonLoop ? `盘扣成品交至${taskOrder.receiverWarehouseName || '中央辅料仓'}` : '工艺交出确认',
      })
      linkedOutboundRecord = outboundRecord
      if (!hasPendingButtonLoopOutput) {
        linkedWaitHandoverItem = upsertFactoryWaitHandoverStockItem({
          ...buildFactoryWaitHandoverStockItemFromOutboundRecord(outboundRecord),
          stockItemId: `SC-WHS-${taskOrder.taskOrderId}`,
          productionOrderId: taskOrder.productionOrderId,
          productionOrderNo: taskOrder.productionOrderNo,
          areaName: position.areaName,
          shelfNo: position.shelfNo,
          locationNo: position.locationNo,
          locationText: position.locationText,
          status:
            isButtonLoop
              ? '已交出'
              : taskOrder.status === '已完结'
                ? '已回写'
                : '待交出',
          differenceQty,
          remark: isButtonLoop ? `盘扣已发起交出至${taskOrder.receiverWarehouseName || '中央辅料仓'}` : '工艺交出记录',
        })
      }
    }

    taskOrder.waitProcessStockItemIds = linkedWaitProcessItem ? [linkedWaitProcessItem.stockItemId] : taskOrder.waitProcessStockItemIds || []
    taskOrder.waitHandoverStockItemIds = linkedWaitHandoverItem ? [linkedWaitHandoverItem.stockItemId] : taskOrder.waitHandoverStockItemIds || []
    taskOrder.inboundRecordIds = linkedInboundRecord ? [linkedInboundRecord.inboundRecordId] : taskOrder.inboundRecordIds || []
    taskOrder.outboundRecordIds = linkedOutboundRecord ? [linkedOutboundRecord.outboundRecordId] : taskOrder.outboundRecordIds || []
    taskOrder.warehouseLinks = [
      ...(linkedInboundRecord ? [{
        linkId: `${taskOrder.taskOrderId}-WAIT_PROCESS`,
        taskOrderId: taskOrder.taskOrderId,
        warehouseKind: '待加工仓' as const,
        warehouseName: linkedInboundRecord.warehouseName,
        inboundRecordId: linkedInboundRecord.inboundRecordId,
        inboundRecordNo: linkedInboundRecord.inboundRecordNo,
        waitProcessStockItemId: linkedWaitProcessItem?.stockItemId,
        status: '已入库' as const,
      }] : []),
      ...(linkedWaitHandoverItem ? [{
        linkId: `${taskOrder.taskOrderId}-WAIT_HANDOVER`,
        taskOrderId: taskOrder.taskOrderId,
        warehouseKind: '待交出仓' as const,
        warehouseName: linkedWaitHandoverItem.warehouseName,
        outboundRecordId: linkedOutboundRecord?.outboundRecordId,
        outboundRecordNo: linkedOutboundRecord?.outboundRecordNo,
        waitHandoverStockItemId: linkedWaitHandoverItem.stockItemId,
        handoverRecordId: linkedWaitHandoverItem.handoverRecordId,
        handoverRecordNo: linkedWaitHandoverItem.handoverRecordNo,
        status: hasPendingButtonLoopOutput
          ? '待交出' as const
          : linkedOutboundRecord
            ? (taskOrder.status === '已完结' ? '已回写' as const : '已出库' as const)
            : '待交出' as const,
      }] : []),
    ]
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

function buildButtonLoopTaskOrdersForStore(): SpecialCraftTaskOrder[] {
  const operation = getSpecialCraftOperationById(BUTTON_LOOP_OPERATION_ID)
  if (!operation) return []
  const bindingOrdersByProductionOrder = new Map<string, ReturnType<typeof buildBindingProcessOrders>>()
  buildBindingProcessOrders().forEach((bindingOrder) => {
    if (!bindingOrder.bindingDetails.some((detail) => detail.requiresButtonLoop)) return
    const current = bindingOrdersByProductionOrder.get(bindingOrder.sourceProductionOrderId) || []
    current.push(bindingOrder)
    bindingOrdersByProductionOrder.set(bindingOrder.sourceProductionOrderId, current)
  })

  return [...bindingOrdersByProductionOrder.entries()].flatMap(([productionOrderId, bindingOrders]) => {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
    const productionOrder = productionOrders.find((item) => item.productionOrderId === productionOrderId)
    if (!snapshot || !productionOrder) return []
    const selectedByStrip = new Map<string, ButtonLoopSelectedBindingStripInput>()
    bindingOrders.forEach((bindingOrder) => {
      bindingOrder.bindingDetails
        .filter((detail) => detail.requiresButtonLoop)
        .forEach((detail) => {
          const key = `${bindingOrder.patternIdentity.patternFileId}::${detail.bindingStripId}`
          const current = selectedByStrip.get(key)
          const ticket = {
            feiTicketId: detail.feiTicketId,
            feiTicketNo: detail.feiTicketNo,
            actualLengthM: detail.actualLength,
          }
          if (current) {
            if (!current.tickets?.some((item) => item.feiTicketId === ticket.feiTicketId)) current.tickets?.push(ticket)
            return
          }
          selectedByStrip.set(key, {
            patternFileId: bindingOrder.patternIdentity.patternFileId,
            patternFileName: bindingOrder.patternIdentity.patternFileName,
            bindingStripId: detail.bindingStripId,
            bindingStripNo: detail.bindingStripNo,
            bindingStripName: detail.bindingStripName,
            lengthCm: detail.sourceLengthCm,
            widthCm: detail.bindingWidth,
            requiresButtonLoop: true,
            tickets: [ticket],
          })
        })
    })

    return buildButtonLoopTaskOrders({
      productionOrderId,
      productionOrderNo: productionOrder.productionOrderNo,
      styleCode: snapshot.styleCode,
      styleName: snapshot.styleName,
      techPackSnapshotId: snapshot.snapshotId,
      selectedBindingStrips: [...selectedByStrip.values()],
    }).map((buttonLoopTask): SpecialCraftTaskOrder => {
      const demandLines: SpecialCraftTaskDemandLine[] = buttonLoopTask.inputLines.map((line) => ({
        demandLineId: `SCDL-${line.inputLineId}`,
        skuCode: line.feiTicketNo,
        taskOrderId: buttonLoopTask.taskOrderId,
        productionOrderId,
        productionOrderNo: productionOrder.productionOrderNo,
        patternFileId: line.patternFileId,
        patternFileName: line.patternFileName,
        pieceRowId: line.bindingStripId,
        partName: line.bindingStripName,
        colorName: '捆条',
        colorCode: 'BINDING_STRIP',
        sizeCode: `${line.widthCm} cm`,
        pieceCountPerGarment: 1,
        orderQty: 1,
        planPieceQty: 1,
        specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:捆条`,
        operationId: operation.operationId,
        operationName: operation.operationName,
        managementDomain: operation.managementDomain,
        managementDomainName: operation.managementDomainName,
        processCode: operation.processCode,
        processName: operation.processName,
        craftCode: operation.craftCode,
        craftName: operation.craftName,
        targetObject: '捆条',
        unit: BUTTON_LOOP_INPUT_UNIT,
        feiTicketNos: [line.feiTicketNo],
        bundleLengthCm: line.lengthCm,
        bundleWidthCm: line.widthCm,
        remark: `投入捆条 ${line.actualLengthM} m；盘扣产出另按个填报。`,
      }))
      const createdAt = snapshot.snapshotAt || productionOrder.updatedAt || productionOrder.createdAt
      return {
        taskOrderId: buttonLoopTask.taskOrderId,
        taskOrderNo: buttonLoopTask.taskOrderNo,
        operationId: operation.operationId,
        operationName: operation.operationName,
        businessType: 'BUTTON_LOOP',
        managementDomain: operation.managementDomain,
        managementDomainName: operation.managementDomainName,
        processCode: operation.processCode,
        processName: operation.processName,
        craftCode: operation.craftCode,
        craftName: operation.craftName,
        factoryId: buttonLoopTask.factoryId,
        factoryName: buttonLoopTask.factoryName,
        productionOrderId,
        productionOrderNo: productionOrder.productionOrderNo,
        productionOrderVersion: productionOrder.taskBreakdownSummary.lastBreakdownAt || productionOrder.updatedAt,
        techPackSnapshotId: snapshot.snapshotId,
        techPackVersion: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
        sourceTaskId: buttonLoopTask.taskOrderId,
        sourceTaskNo: buttonLoopTask.taskOrderNo,
        generationBatchId: `SCB-${buttonLoopTask.taskOrderId}`,
        generationSource: 'PRODUCTION_ORDER',
        generationSourceLabel: '生产单生成',
        sourceTrigger: 'PRODUCTION_ORDER_CREATED',
        sourceTriggerLabel: '技术包捆条标记盘扣后自动生成',
        assignmentStatus: 'ASSIGNED',
        assignmentStatusLabel: '已分配',
        executionStatus: 'WAIT_PICKUP',
        executionStatusLabel: '待接收',
        demandLines,
        sourcePieceRowIds: [...new Set(buttonLoopTask.inputLines.map((line) => line.bindingStripId))],
        sourcePatternFileIds: [...new Set(buttonLoopTask.inputLines.map((line) => line.patternFileId))],
        sourceSpecialCraftKeys: demandLines.map((line) => line.specialCraftKey),
        targetObject: '捆条',
        quantityMode: 'TICKET_INPUT_OUTPUT',
        inputUnit: BUTTON_LOOP_INPUT_UNIT,
        outputUnit: BUTTON_LOOP_OUTPUT_UNIT,
        receiverWarehouseName: BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME,
        selectedBindingStripCount: buttonLoopTask.selectedBindingStripCount,
        inputTicketCount: buttonLoopTask.inputTicketCount,
        receivedTicketCount: buttonLoopTask.receivedTicketCount,
        inputLengthM: buttonLoopTask.inputLengthM,
        outputQty: buttonLoopTask.outputQty,
        handedOverQty: buttonLoopTask.handedOverQty,
        buttonLoopInputLines: buttonLoopTask.inputLines.map((line) => ({ ...line })),
        buttonLoopEvents: buttonLoopTask.events.map((event) => ({ ...event })),
        partName: buttonLoopTask.selectedBindingStripCount > 1 ? `${buttonLoopTask.selectedBindingStripCount} 条盘扣捆条` : buttonLoopTask.inputLines[0]?.bindingStripName || '盘扣捆条',
        fabricColor: '捆条',
        sizeCode: '多规格',
        feiTicketNos: buttonLoopTask.inputLines.map((line) => line.feiTicketNo),
        transferBagNos: [],
        fabricRollNos: [],
        materialSku: snapshot.styleCode,
        planQty: buttonLoopTask.inputTicketCount,
        receivedQty: buttonLoopTask.receivedTicketCount,
        completedQty: buttonLoopTask.outputQty,
        lossQty: 0,
        currentQty: buttonLoopTask.outputQty,
        returnedQty: buttonLoopTask.handedOverQty,
        waitHandoverQty: buttonLoopTask.waitHandoverQty,
        unit: BUTTON_LOOP_INPUT_UNIT,
        status: buttonLoopTask.status,
        abnormalStatus: '无异常',
        dueAt: productionOrder.demandSnapshot.requiredDeliveryDate || productionOrder.updatedAt,
        createdAt,
        updatedAt: createdAt,
        waitProcessStockItemIds: [],
        waitHandoverStockItemIds: [],
        inboundRecordIds: [],
        outboundRecordIds: [],
        validationWarnings: [],
        isGenerated: true,
        isManualCreated: false,
        generationKey: `BUTTON_LOOP::${productionOrderId}::${snapshot.snapshotId}`,
        suggestedFactoryId: buttonLoopTask.factoryId,
        suggestedFactoryName: buttonLoopTask.factoryName,
        assignedFactoryId: buttonLoopTask.factoryId,
        assignedFactoryName: buttonLoopTask.factoryName,
        assignmentMode: '按工艺固定分配',
        nodeRecords: [{
          nodeRecordId: `${buttonLoopTask.taskOrderId}-NODE-01`,
          taskOrderId: buttonLoopTask.taskOrderId,
          nodeName: '待接收',
          actionName: '生产单生成',
          beforeStatus: '待接收',
          afterStatus: '待接收',
          qty: buttonLoopTask.inputTicketCount,
          unit: BUTTON_LOOP_INPUT_UNIT,
          operatorName: '系统',
          operatedAt: createdAt,
          relatedRecordNo: productionOrder.productionOrderNo,
          relatedRecordType: '任务记录',
          photoCount: 0,
          remark: `${buttonLoopTask.selectedBindingStripCount} 条捆条，共 ${buttonLoopTask.inputTicketCount} 张菲票作为盘扣投入。`,
        }],
        warehouseLinks: [],
        lineProgress: buttonLoopTask.inputLines.map((line) => ({
          lineProgressKey: `fei:${line.feiTicketNo}`,
          lineType: 'fei-ticket',
          feiTicketNo: line.feiTicketNo,
          partName: line.bindingStripName,
          colorName: '捆条',
          sizeCode: `${line.widthCm} cm`,
          planQty: 1,
          receivedQty: line.received ? 1 : 0,
          completedQty: 0,
          returnedQty: 0,
        })),
        remark: '投入为捆条菲票，投入长度仅追溯；加工产出与交出均按盘扣个数记录，交中央辅料仓。',
      }
    })
  })
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
    const buttonLoopTaskOrders = buildButtonLoopTaskOrdersForStore()
    const generatedWithoutGenericButtonLoop = generatedTaskOrders.filter((taskOrder) => taskOrder.operationId !== BUTTON_LOOP_OPERATION_ID)
    const supplementalTaskOrders = buildLinkedSupplementTaskOrders([...generatedWithoutGenericButtonLoop, ...buttonLoopTaskOrders])
      .filter((taskOrder) => taskOrder.operationId !== BUTTON_LOOP_OPERATION_ID)
    const taskOrders = [...generatedWithoutGenericButtonLoop, ...buttonLoopTaskOrders, ...supplementalTaskOrders].map((taskOrder) => ({
      ...taskOrder,
      lineProgress: normalizeSpecialCraftLineProgress(taskOrder),
    }))
    ensureSpecialCraftUnifiedWarehouseArtifacts(taskOrders)
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
  const resolveSkuCode = (line: SpecialCraftTaskDemandLine) => line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
  const expectedSkuCodes = lines.map(resolveSkuCode).sort()
  const actualSkuCodes = Object.keys(input.receivedQtyBySkuCode).sort()
  if (expectedSkuCodes.length !== actualSkuCodes.length || actualSkuCodes.some((skuCode, index) => skuCode !== expectedSkuCodes[index])) {
    throw new Error('逐 SKU 收货必须覆盖全部 SKU，且不得包含其他 SKU。')
  }
  const invalidLine = lines.find((line) => {
    const receivedQty = input.receivedQtyBySkuCode[resolveSkuCode(line)]
    return !Number.isInteger(receivedQty) || receivedQty < 0 || receivedQty > line.planPieceQty
  })
  if (invalidLine) throw new Error(`SKU ${invalidLine.skuCode} 实收件数无效。`)
  const totalReceivedQty = lines.reduce((sum, line) => sum + (input.receivedQtyBySkuCode[resolveSkuCode(line)] || 0), 0)
  if (taskOrder.receivedQty + totalReceivedQty > taskOrder.planQty) {
    throw new Error('本次接收后会超过计划数量，请检查 SKU 实收件数。')
  }
  return updateSpecialCraftTaskOrderWebStatus(input.taskOrderId, {
    status: '加工中',
    operatorName: input.receiverName,
    operatedAt: input.receivedAt,
    receivedQty: taskOrder.receivedQty + totalReceivedQty,
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
  const resolveSkuCode = (line: SpecialCraftTaskDemandLine) => line.skuCode || `${line.colorName || '成衣'}-${line.sizeCode || '均码'}`
  const expectedSkuCodes = lines.map(resolveSkuCode).sort()
  const hasExactSkuSet = (qtyBySkuCode: Record<string, number>) => {
    const actualSkuCodes = Object.keys(qtyBySkuCode).sort()
    return actualSkuCodes.length === expectedSkuCodes.length
      && actualSkuCodes.every((skuCode, index) => skuCode === expectedSkuCodes[index])
  }
  if (!hasExactSkuSet(input.completedQtyBySkuCode)) {
    throw new Error('逐 SKU 完工必须覆盖全部 SKU，且不得包含其他 SKU。')
  }
  const invalidLine = lines.find((line) => {
    const skuCode = resolveSkuCode(line)
    const completedQty = input.completedQtyBySkuCode[skuCode]
    const scrapQty = input.scrapQtyBySkuCode[skuCode] || 0
    const damageQty = input.damageQtyBySkuCode[skuCode] || 0
    return !Number.isInteger(completedQty) || completedQty < 0
      || !Number.isInteger(scrapQty) || scrapQty < 0
      || !Number.isInteger(damageQty) || damageQty < 0
      || completedQty + scrapQty + damageQty > line.planPieceQty
  })
  if (invalidLine) throw new Error(`SKU ${invalidLine.skuCode} 的完工、报废和货损件数必须为整数，且合计不能超过该 SKU 计划件数。`)
  const completedQty = lines.reduce((sum, line) => sum + (input.completedQtyBySkuCode[resolveSkuCode(line)] || 0), 0)
  const scrapQty = lines.reduce((sum, line) => sum + (input.scrapQtyBySkuCode[resolveSkuCode(line)] || 0), 0)
  const damageQty = lines.reduce((sum, line) => sum + (input.damageQtyBySkuCode[resolveSkuCode(line)] || 0), 0)
  return updateSpecialCraftTaskOrderWebStatus(input.taskOrderId, {
    status: '加工中',
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
    returnedQty?: number
    waitHandoverQty?: number
    lineProgress?: SpecialCraftTaskLineProgress[]
    remark?: string
  },
): SpecialCraftTaskOrder | undefined {
  const store = ensureStore()
  const taskOrderIndex = store.taskOrders.findIndex((taskOrder) => taskOrder.taskOrderId === taskOrderId)
  if (taskOrderIndex < 0) return undefined
  const current = store.taskOrders[taskOrderIndex]
  const lineProgress = payload.lineProgress ? normalizeSpecialCraftLineProgress({ ...current, lineProgress: payload.lineProgress }) : current.lineProgress
  const progressSummary = payload.lineProgress ? summarizeLineProgress(lineProgress || []) : null
  const next: SpecialCraftTaskOrder = {
    ...current,
    status: payload.status,
    receivedQty: progressSummary ? progressSummary.receivedQty : Number.isFinite(payload.receivedQty) ? Number(payload.receivedQty) : current.receivedQty,
    completedQty: progressSummary ? progressSummary.completedQty : Number.isFinite(payload.completedQty) ? Number(payload.completedQty) : current.completedQty,
    lossQty: Number.isFinite(payload.lossQty) ? Number(payload.lossQty) : current.lossQty,
    damageQty: Number.isFinite(payload.damageQty) ? Number(payload.damageQty) : current.damageQty,
    returnedQty: progressSummary ? progressSummary.returnedQty : Number.isFinite(payload.returnedQty) ? Number(payload.returnedQty) : current.returnedQty,
    waitHandoverQty: progressSummary ? progressSummary.waitHandoverQty : Number.isFinite(payload.waitHandoverQty) ? Number(payload.waitHandoverQty) : current.waitHandoverQty,
    currentQty: progressSummary ? progressSummary.currentQty : Number.isFinite(payload.completedQty) ? Number(payload.completedQty) : current.currentQty,
    lineProgress,
    executionStatus:
      payload.status === '待接收'
        ? 'WAIT_PICKUP'
        : payload.status === '加工中'
          ? 'PROCESSING'
          : 'COMPLETED',
    executionStatusLabel: payload.status,
    updatedAt: payload.operatedAt || formatDay(0),
    remark: payload.remark?.trim() || current.remark,
  }
  store.taskOrders[taskOrderIndex] = next
  ensureSpecialCraftUnifiedWarehouseArtifacts([next])
  return next
}

export function executeButtonLoopSpecialCraftAction(input: {
  taskOrderId: string
  actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE' | 'SPECIAL_CRAFT_PROCESS_REPORT' | 'SPECIAL_CRAFT_SUBMIT_HANDOVER' | 'SPECIAL_CRAFT_COMPLETE_ORDER'
  feiTicketNos?: string[]
  outputQty?: number
  operatorName: string
  operatedAt: string
}): SpecialCraftTaskOrder {
  const store = ensureStore()
  const taskOrderIndex = store.taskOrders.findIndex((item) => item.taskOrderId === input.taskOrderId)
  if (taskOrderIndex < 0) throw new Error('盘扣加工单不存在。')
  const current = store.taskOrders[taskOrderIndex]
  if (current.quantityMode !== 'TICKET_INPUT_OUTPUT' || current.operationId !== BUTTON_LOOP_OPERATION_ID) {
    throw new Error('当前加工单不是盘扣投入/产出双口径加工单。')
  }
  const domainCurrent: ButtonLoopTaskOrder = {
    taskOrderId: current.taskOrderId,
    taskOrderNo: current.taskOrderNo,
    operationId: BUTTON_LOOP_OPERATION_ID,
    craftName: '盘扣',
    quantityMode: 'TICKET_INPUT_OUTPUT',
    productionOrderId: current.productionOrderId,
    productionOrderNo: current.productionOrderNo,
    styleCode: current.materialSku || '',
    styleName: '',
    techPackSnapshotId: current.techPackSnapshotId || '',
    factoryId: current.factoryId,
    factoryName: current.factoryName,
    receiverWarehouseName: BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME,
    selectedBindingStripCount: current.selectedBindingStripCount || 0,
    inputLines: (current.buttonLoopInputLines || []).map((line) => ({ ...line })),
    inputTicketCount: current.inputTicketCount || 0,
    receivedTicketCount: current.receivedTicketCount || 0,
    inputLengthM: current.inputLengthM || 0,
    inputUnit: BUTTON_LOOP_INPUT_UNIT,
    outputQty: current.outputQty || 0,
    handedOverQty: current.handedOverQty || 0,
    waitHandoverQty: current.waitHandoverQty || 0,
    outputUnit: BUTTON_LOOP_OUTPUT_UNIT,
    status: current.status,
    events: (current.buttonLoopEvents || []).map((event) => ({ ...event })),
  }
  let action: ButtonLoopTaskAction
  if (input.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE') {
    action = {
      action: 'CONFIRM_RECEIVE',
      feiTicketNos: input.feiTicketNos || [],
      operatorName: input.operatorName,
      operatedAt: input.operatedAt,
    }
  } else if (input.actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT') {
    action = {
      action: 'PROCESS_REPORT',
      outputQty: Number(input.outputQty),
      operatorName: input.operatorName,
      operatedAt: input.operatedAt,
    }
  } else if (input.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER') {
    action = {
      action: 'SUBMIT_HANDOVER',
      outputQty: Number(input.outputQty),
      operatorName: input.operatorName,
      operatedAt: input.operatedAt,
    }
  } else {
    action = {
      action: 'COMPLETE',
      operatorName: input.operatorName,
      operatedAt: input.operatedAt,
    }
  }
  const nextDomain = applyButtonLoopTaskAction(domainCurrent, action)
  const lastEvent = nextDomain.events[nextDomain.events.length - 1]
  const eventUnit = lastEvent?.unit || (input.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE' ? BUTTON_LOOP_INPUT_UNIT : BUTTON_LOOP_OUTPUT_UNIT)
  const eventQty = input.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE'
    ? lastEvent?.inputTicketNos?.length || 0
    : input.actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER'
      ? nextDomain.outputQty
      : Number(input.outputQty || 0)
  const next: SpecialCraftTaskOrder = {
    ...current,
    status: nextDomain.status,
    executionStatus: nextDomain.status === '待接收' ? 'WAIT_PICKUP' : nextDomain.status === '已完结' ? 'COMPLETED' : 'PROCESSING',
    executionStatusLabel: nextDomain.status,
    receivedTicketCount: nextDomain.receivedTicketCount,
    outputQty: nextDomain.outputQty,
    handedOverQty: nextDomain.handedOverQty,
    receivedQty: nextDomain.receivedTicketCount,
    completedQty: nextDomain.outputQty,
    currentQty: nextDomain.outputQty,
    returnedQty: nextDomain.handedOverQty,
    waitHandoverQty: nextDomain.waitHandoverQty,
    buttonLoopInputLines: nextDomain.inputLines.map((line) => ({ ...line })),
    buttonLoopEvents: nextDomain.events.map((event) => ({ ...event })),
    lineProgress: (current.lineProgress || []).map((row) => {
      const inputLine = nextDomain.inputLines.find((line) => line.feiTicketNo === row.feiTicketNo)
      return inputLine ? { ...row, receivedQty: inputLine.received ? 1 : 0 } : { ...row }
    }),
    updatedAt: input.operatedAt,
    nodeRecords: lastEvent && nextDomain.events.length > domainCurrent.events.length
      ? [...current.nodeRecords, {
          nodeRecordId: `${current.taskOrderId}-NODE-${String(current.nodeRecords.length + 1).padStart(2, '0')}`,
          taskOrderId: current.taskOrderId,
          nodeName: nextDomain.status,
          actionName: input.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE'
            ? '确认接收'
            : input.actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT'
              ? '加工填报'
              : input.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
                ? '发起交出'
                : '完成加工单',
          beforeStatus: current.status,
          afterStatus: nextDomain.status,
          qty: eventQty,
          unit: eventUnit,
          operatorName: input.operatorName,
          operatedAt: input.operatedAt,
          relatedRecordNo: input.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' ? `JCD-${current.taskOrderNo}` : current.taskOrderNo,
          relatedRecordType: input.actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' ? '交出记录' : '任务记录',
          photoCount: 0,
          remark: lastEvent.remark,
        }]
      : current.nodeRecords,
  }
  store.taskOrders[taskOrderIndex] = next
  ensureSpecialCraftUnifiedWarehouseArtifacts([next])
  return next
}

export function applySpecialCraftLineProgressAction(input: {
  taskOrderId: string
  actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE' | 'SPECIAL_CRAFT_PROCESS_REPORT' | 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
  qtyByLineKey?: Record<string, number>
  skuQtyBySkuCode?: Record<string, number>
  feiQtyByTicketNo?: Record<string, number>
}): SpecialCraftTaskLineProgress[] {
  const taskOrder = getSpecialCraftTaskOrderById(input.taskOrderId)
  if (!taskOrder) throw new Error('特殊工艺加工单不存在')
  const currentRows = normalizeSpecialCraftLineProgress(taskOrder)
  return currentRows.map((row) => {
    const qty = Number(
      input.qtyByLineKey?.[row.lineProgressKey]
        ?? (row.skuCode ? input.skuQtyBySkuCode?.[row.skuCode] : undefined)
        ?? (row.feiTicketNo ? input.feiQtyByTicketNo?.[row.feiTicketNo] : undefined)
        ?? 0,
    )
    if (!Number.isFinite(qty) || qty < 0) throw new Error('本次数量必须为有效非负数。')
    if (input.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE') {
      const remaining = roundQty(row.planQty - row.receivedQty)
      if (qty > remaining) throw new Error('实收数量不能超过计划未接收数量。')
      return { ...row, receivedQty: roundQty(row.receivedQty + qty) }
    }
    if (input.actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT') {
      const remaining = roundQty(row.receivedQty - row.completedQty)
      if (qty > remaining) throw new Error('完工数量不能超过累计实收未完工数量。')
      return { ...row, completedQty: roundQty(row.completedQty + qty) }
    }
    const remaining = roundQty(row.completedQty - row.returnedQty)
    if (qty > remaining) throw new Error('交出数量不能超过累计完工未交出数量。')
    return { ...row, returnedQty: roundQty(row.returnedQty + qty) }
  })
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
  const invalidatedIds = new Set(invalidatedMergedTaskOrderLogs.filter((item) => !item.restoredAt).map((item) => item.taskOrderId))
  return ensureStore().taskOrders.filter((item) => !invalidatedIds.has(item.taskOrderId))
}

export function listBlockingSpecialCraftTaskOrdersForMergedTask(productionOrderId: string): SpecialCraftTaskOrder[] {
  return listSpecialCraftTaskOrders().filter((taskOrder) =>
    taskOrder.productionOrderId === productionOrderId && taskOrder.status !== '待接收',
  )
}

export function invalidateUnstartedSpecialCraftTaskOrdersForMergedTask(input: {
  productionOrderId: string
  mergedTaskId: string
  invalidatedAt: string
  invalidatedBy: string
  reason: string
}): string[] {
  const candidates = listSpecialCraftTaskOrders().filter((taskOrder) =>
    taskOrder.productionOrderId === input.productionOrderId && taskOrder.status === '待接收',
  )
  for (const taskOrder of candidates) {
    invalidatedMergedTaskOrderLogs.push({
      taskOrderId: taskOrder.taskOrderId,
      productionOrderId: input.productionOrderId,
      mergedTaskId: input.mergedTaskId,
      invalidatedAt: input.invalidatedAt,
      invalidatedBy: input.invalidatedBy,
      reason: input.reason,
    })
  }
  return candidates.map((item) => item.taskOrderId)
}

export function listMergedTaskSpecialCraftInvalidationLogs(): typeof invalidatedMergedTaskOrderLogs {
  return invalidatedMergedTaskOrderLogs.map((item) => ({ ...item }))
}

export function restoreSpecialCraftTaskOrdersAfterMergedTaskCancellation(input: {
  mergedTaskId: string
  restoredAt: string
  restoredBy: string
  reason: string
}): string[] {
  const restoredIds: string[] = []
  for (const log of invalidatedMergedTaskOrderLogs) {
    if (log.mergedTaskId !== input.mergedTaskId || log.restoredAt) continue
    log.restoredAt = input.restoredAt
    log.restoredBy = input.restoredBy
    log.restoreReason = input.reason
    restoredIds.push(log.taskOrderId)
  }
  return restoredIds
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
