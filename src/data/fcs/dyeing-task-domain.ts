import { listFactoryDyeVatCapacities } from './factory-capacity-profile-mock.ts'
import {
  createFactoryHandoverRecord,
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  writeBackHandoverRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask, type PdaGenericTaskMock } from './pda-task-mock-factory.ts'
import { type HandoverReceiverKind, type QtyUnit } from './process-tasks.ts'
import type {
  FormalProductionOrderProcessSnapshot,
  FormalProductionOrderProcessSnapshotRecord,
  ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { getProcessWorkOrderStockMaterial, isValidProcessWorkOrderPlannedFinishAt } from './process-work-order-stock.ts'
import { registerCreatedDyeWorkOrderReader } from './dyeing-created-work-order-registry.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { listActiveProcessCraftDefinitions, type ProcessCraftDefinition } from './process-craft-dict.ts'
import {
  DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  getDictionaryCraftMockSource,
  listGeneratedProductionDemandArtifacts,
} from './production-artifact-generation.ts'
import {
  validateWaterSolublePdaActor,
  type WaterSolublePdaActor,
} from './water-soluble-pda-actor.ts'

export type DyeWorkOrderStatus =
  | 'WAIT_SAMPLE'
  | 'WAIT_MATERIAL'
  | 'SAMPLE_TESTING'
  | 'SAMPLE_DONE'
  | 'MATERIAL_READY'
  | 'WAIT_VAT_PLAN'
  | 'WAIT_WATER_SOLUBLE'
  | 'WATER_SOLUBLE_IN_PROGRESS'
  | 'PRODUCTION_PAUSED'
  | 'DYEING'
  | 'DEHYDRATING'
  | 'DRYING'
  | 'SETTING'
  | 'ROLLING'
  | 'PACKING'
  | 'WAIT_HANDOVER'
  | 'HANDOVER_WAIT_RECEIVE'
  | 'WAIT_REVIEW'
  | 'PARTIAL_HANDOVER'
  | 'FULL_HANDOVER'
  | 'HANDOVER_DIFFERENCE'
  | 'COMPLETED'
  | 'REJECTED'

export type SampleWaitType = 'NONE' | 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD'
export type SampleStatus = 'NOT_REQUIRED' | 'WAITING' | 'TESTING' | 'DONE'
export type DyeExecutionNodeCode =
  | 'SAMPLE'
  | 'MATERIAL_READY'
  | 'VAT_PLAN'
  | 'WATER_SOLUBLE'
  | 'DYE'
  | 'DEHYDRATE'
  | 'DRY'
  | 'SET'
  | 'ROLL'
  | 'PACK'
  | 'HANDOVER'
export type DyeReceiptStatus = 'WAIT_RECEIVE' | 'PARTIAL_HANDOVER' | 'FULL_HANDOVER' | 'HANDOVER_DIFFERENCE'
export type DyeReviewStatus = DyeReceiptStatus | 'WAIT_REVIEW' | 'REJECTED'

export interface DyeWorkOrder {
  dyeOrderId: string
  dyeOrderNo: string
  sourceType: ProcessWorkOrderSourceType
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  productionOrderOrderedAt?: string
  stockMaterialId?: string
  stockMaterialName?: string
  sourceArtifactIds?: string[]
  productionOrderIds?: string[]
  isFirstOrder: boolean
  sampleWaitType: SampleWaitType
  sampleStatus: SampleStatus
  sampleWaitStartedAt?: string
  sampleWaitFinishedAt?: string
  materialWaitStartedAt?: string
  materialWaitFinishedAt?: string
  colorNo?: string
  rawMaterialSku: string
  composition?: string
  width?: string
  weightGsm?: number
  targetColor: string
  plannedQty: number
  qtyUnit: string
  plannedFinishAt?: string
  requiresWaterSoluble: boolean
  waterSolublePlannedQty?: number
  waterSolubleCompletedQty?: number
  waterSolubleQtyUnit?: string
  plannedRollCount?: number
  assignmentMode: '派单'
  assignmentModeEditable: false
  dispatchPrice: number
  dispatchPriceCurrency: 'IDR'
  dispatchPriceUnit: 'Yard'
  dispatchPriceDisplay: string
  dyeFactoryId: string
  dyeFactoryName: string
  sourceWarehouseId?: string
  targetTransferWarehouseId: string
  targetTransferWarehouseName: string
  status: DyeWorkOrderStatus
  taskId: string
  taskNo: string
  taskQrValue: string
  handoverOrderId?: string
  handoverOrderNo?: string
  receiverKind: HandoverReceiverKind
  receiverName: string
  waitingReason?: string
  createdAt: string
  updatedAt: string
  remark?: string
  formalProductionOrderSnapshot?: FormalProductionOrderProcessSnapshotRecord
}

export interface DyeExecutionNodeRecord {
  nodeRecordId: string
  dyeOrderId: string
  taskId: string
  nodeCode: DyeExecutionNodeCode
  nodeName: string
  operatorUserId: string
  operatorName: string
  deviceId?: string
  startedAt?: string
  finishedAt?: string
  dyeVatId?: string
  dyeVatNo?: string
  inputQty?: number
  outputQty?: number
  lossQty?: number
  qtyUnit: string
  proofImageIds?: string[]
  remark?: string
}

export interface DyeVatSchedule {
  vatScheduleId: string
  dyeVatId: string
  dyeVatNo: string
  capacityQty: number
  capacityUnit: string
  supportedMaterialTypes: string[]
  dyeOrderId: string
  plannedStartAt: string
  plannedEndAt: string
  actualStartAt?: string
  actualEndAt?: string
  status: 'PLANNED' | 'IN_USE' | 'DONE' | 'DELAYED' | 'CANCELLED'
}

export interface DyeReviewRecord {
  reviewRecordId: string
  dyeOrderId: string
  handoverOrderId?: string
  handoverRecordIds?: string[]
  receiverName: string
  submittedQty: number
  receivedQty: number
  diffQty: number
  receivedRollCount?: number
  receivedLength?: number
  lengthUnit?: string
  reviewStatus: DyeReviewStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectReason?: string
  remark?: string
}

export interface DyeFormulaLine {
  materialName: string
  materialCode: string
  feedQty: number
  feedUnit: string
  note?: string
}

export interface DyeFormulaRecord {
  formulaId: string
  formulaNo: string
  dyeOrderId?: string
  dyeOrderNo?: string
  taskId?: string
  taskNo?: string
  colorNo: string
  rawMaterialSku: string
  targetColor: string
  formulaName: string
  feedTotalQty: number
  feedUnit: string
  usageStatus: '待使用' | '已投料' | '已复核'
  lines: DyeFormulaLine[]
  remark?: string
}

export interface DyeWorkOrderSummary {
  total: number
  waitSampleCount: number
  waitMaterialCount: number
  sampleTestingCount: number
  waitVatPlanCount: number
  dyeingCount: number
  waitHandoverCount: number
  waitReceiveCount: number
  partialHandoverCount: number
  fullHandoverCount: number
  handoverDifferenceCount: number
  diffQty: number
  objectionCount: number
  vatUtilizationCount: number
}

export interface DyeReportRow {
  dyeOrderId: string
  dyeOrderNo: string
  taskId: string
  taskNo: string
  currentNode: string
  waitingReason: string
  startedAt?: string
  finishedAt?: string
  durationHours: number
  dyeVatNo?: string
  plannedQty: number
  outputQty: number
  diffQty: number
  objectionCount: number
}

export const DYE_WORK_ORDER_STATUS_LABEL: Record<DyeWorkOrderStatus, string> = {
  WAIT_SAMPLE: '待样衣',
  WAIT_MATERIAL: '待原料',
  SAMPLE_TESTING: '打样中',
  SAMPLE_DONE: '打样完成',
  MATERIAL_READY: '备料完成',
  WAIT_VAT_PLAN: '待排缸',
  WAIT_WATER_SOLUBLE: '待水溶',
  WATER_SOLUBLE_IN_PROGRESS: '水溶中',
  PRODUCTION_PAUSED: '生产暂停',
  DYEING: '染色中',
  DEHYDRATING: '脱水中',
  DRYING: '烘干中',
  SETTING: '定型中',
  ROLLING: '打卷中',
  PACKING: '包装中',
  WAIT_HANDOVER: '待送货',
  HANDOVER_WAIT_RECEIVE: '交出待收货',
  WAIT_REVIEW: '待审核',
  PARTIAL_HANDOVER: '部分交出',
  FULL_HANDOVER: '全部交出',
  HANDOVER_DIFFERENCE: '收货差异',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
}

export const SAMPLE_WAIT_TYPE_LABEL: Record<SampleWaitType, string> = {
  NONE: '不需要',
  WAIT_SAMPLE_GARMENT: '样衣',
  WAIT_COLOR_CARD: '色样',
}

export const DYE_NODE_LABEL: Record<DyeExecutionNodeCode, string> = {
  SAMPLE: '打样',
  MATERIAL_READY: '备料',
  VAT_PLAN: '染缸安排',
  WATER_SOLUBLE: '水溶',
  DYE: '染色',
  DEHYDRATE: '脱水',
  DRY: '烘干',
  SET: '定型',
  ROLL: '打卷',
  PACK: '包装',
  HANDOVER: '交出',
}

export const DYE_REVIEW_STATUS_LABEL: Record<DyeReviewStatus, string> = {
  WAIT_RECEIVE: '交出待收货',
  WAIT_REVIEW: '待审核',
  PARTIAL_HANDOVER: '部分交出',
  FULL_HANDOVER: '全部交出',
  HANDOVER_DIFFERENCE: '收货差异',
  REJECTED: '已驳回',
}

const DYE_WORK_ORDER_IDS = [
  'DWO-001',
  'DWO-002',
  'DWO-003',
  'DWO-004',
  'DWO-005',
  'DWO-006',
  'DWO-007',
  'DWO-008',
  'DWO-009',
  'DWO-010',
  'DWO-011',
  'DWO-012',
  'DWO-013',
] as const

export type DyeWaterSolublePauseDecision = 'CONTINUE_PROCESSING' | 'CONTINUE_WITH_ACTUAL_QTY' | 'RETURN_FOR_REWORK'

const createdDyeOrderIds = new Set<string>()

type MutableDyeWorkOrder = DyeWorkOrder
type MutableDyeExecutionNodeRecord = DyeExecutionNodeRecord
type MutableDyeReviewRecord = DyeReviewRecord
type MutableDyeVatSchedule = DyeVatSchedule
type MutableDyeFormulaRecord = DyeFormulaRecord

const workOrderStore = new Map<string, MutableDyeWorkOrder>()
const nodeRecordStore = new Map<string, MutableDyeExecutionNodeRecord[]>()
const reviewRecordStore = new Map<string, MutableDyeReviewRecord>()
const vatScheduleStore = new Map<string, MutableDyeVatSchedule>()
const formulaStore = new Map<string, MutableDyeFormulaRecord>()

let seeded = false

const GENERATED_DYE_CRAFTS = listActiveProcessCraftDefinitions()
  .filter((definition) => definition.processCode === 'DYE' && definition.defaultDocType === 'DEMAND')

interface GeneratedDyeContext {
  productionOrder: ProductionOrder
  techPackSnapshot: ProductionOrderTechPackSnapshot
  craftDefinition: ProcessCraftDefinition
  mockIndex: number
  plannedQty: number
  materialName: string
  targetColor: string
}

function getProductionOrderQty(order: ProductionOrder): number {
  const skuQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  return Math.max(1, Math.round(skuQty || 1))
}

function getGeneratedDyeCraft(index: number): { craftDefinition: ProcessCraftDefinition; mockIndex: number } | null {
  const craftIndex = Math.floor(index / DICTIONARY_CRAFT_MOCKS_PER_DEFINITION)
  const craftDefinition = GENERATED_DYE_CRAFTS[craftIndex]
  if (!craftDefinition) return null
  return {
    craftDefinition,
    mockIndex: index % DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  }
}

function getGeneratedDyeContext(index: number): GeneratedDyeContext | null {
  const generatedCraft = getGeneratedDyeCraft(index)
  if (!generatedCraft) return null
  const source = getDictionaryCraftMockSource(generatedCraft.craftDefinition.craftCode, generatedCraft.mockIndex)
  const preferredOrderId = source?.order.productionOrderId
  const productionOrder = productionOrders.find((order) => order.productionOrderId === preferredOrderId)
  if (!productionOrder) return null
  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  if (!techPackSnapshot) return null
  const bomItem = techPackSnapshot.bomItems[0]
  return {
    productionOrder,
    techPackSnapshot,
    craftDefinition: generatedCraft.craftDefinition,
    mockIndex: generatedCraft.mockIndex,
    plannedQty: Math.max(1, Math.round(getProductionOrderQty(productionOrder) * 1.12)),
    materialName: bomItem ? `${bomItem.name}${bomItem.spec ? ` / ${bomItem.spec}` : ''}` : productionOrder.demandSnapshot.spuName,
    targetColor: bomItem?.colorLabel || productionOrder.demandSnapshot.skuLines[0]?.color || '按技术包配色',
  }
}

function listVisibleRawDyeWorkOrders(): MutableDyeWorkOrder[] {
  const sorted = Array.from(workOrderStore.values()).sort((left, right) => left.dyeOrderNo.localeCompare(right.dyeOrderNo))
  const selected = new Map<string, MutableDyeWorkOrder>()
  for (const order of sorted.slice(0, GENERATED_DYE_CRAFTS.length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION)) {
    selected.set(order.dyeOrderId, order)
  }
  for (const order of sorted) {
    if (
      createdDyeOrderIds.has(order.dyeOrderId)
      || reviewRecordStore.has(order.dyeOrderId)
      || ['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'WAIT_REVIEW', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'HANDOVER_DIFFERENCE', 'COMPLETED', 'REJECTED'].includes(order.status)
    ) {
      selected.set(order.dyeOrderId, order)
    }
  }
  return Array.from(selected.values())
}

function getVisibleDyeWorkOrderIds(): Set<string> {
  return new Set(listVisibleRawDyeWorkOrders().map((order) => order.dyeOrderId))
}

function buildGeneratedDyeWorkOrder(order: MutableDyeWorkOrder, index: number): MutableDyeWorkOrder {
  if (createdDyeOrderIds.has(order.dyeOrderId)) return order
  const generatedCount = GENERATED_DYE_CRAFTS.length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION
  const context = getGeneratedDyeContext(index) ?? (generatedCount > 0 ? getGeneratedDyeContext(index % generatedCount) : null)
  if (!context) {
    const sourceProductionOrderId = order.sourceProductionOrderId || order.productionOrderIds?.[0]
    const sourceOrder = productionOrders.find((item) => item.productionOrderId === sourceProductionOrderId)
    return {
      ...order,
      sourceProductionOrderId,
      sourceProductionOrderNo: order.sourceProductionOrderNo || sourceOrder?.productionOrderNo || sourceProductionOrderId,
      productionOrderOrderedAt: order.productionOrderOrderedAt || sourceOrder?.createdAt || order.createdAt,
    }
  }
  const { productionOrder, techPackSnapshot, craftDefinition, mockIndex, plannedQty, materialName, targetColor } = context
  return {
    ...order,
    sourceType: 'PRODUCTION_ORDER',
    sourceProductionOrderId: productionOrder.productionOrderId,
    sourceProductionOrderNo: productionOrder.productionOrderNo,
    productionOrderOrderedAt: productionOrder.createdAt,
    productionOrderIds: [productionOrder.productionOrderId],
    isFirstOrder: mockIndex === 0,
    rawMaterialSku: materialName,
    composition: techPackSnapshot.bomItems[0]?.spec || order.composition,
    targetColor,
    colorNo: techPackSnapshot.sourceTechPackVersionCode || order.colorNo,
    plannedQty,
    plannedRollCount: Math.max(1, Math.ceil(plannedQty / 80)),
    createdAt: productionOrder.createdAt,
    updatedAt: order.updatedAt || productionOrder.updatedAt,
    remark: `${craftDefinition.craftName}；来源生产单 ${productionOrder.productionOrderNo}，技术包 ${techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel}。`,
  }
}

function listGeneratedDyeWorkOrders(): MutableDyeWorkOrder[] {
  return listVisibleRawDyeWorkOrders()
}

function normalizeSeedWorkOrderSources(): void {
  listVisibleRawDyeWorkOrders().forEach((order, index) => {
    if (createdDyeOrderIds.has(order.dyeOrderId)) return
    const normalized = buildGeneratedDyeWorkOrder(order, index)
    workOrderStore.set(normalized.dyeOrderId, normalized)
    const task = getDyeingTaskById(normalized.taskId)
    if (!task) return
    task.sourceType = normalized.sourceType
    task.productionOrderId = normalized.sourceProductionOrderId
    task.productionOrderNo = normalized.sourceProductionOrderNo
    task.sourceProductionOrderId = normalized.sourceProductionOrderId
    task.stockMaterialId = normalized.stockMaterialId
    task.stockMaterialName = normalized.stockMaterialName
    registerPdaGenericProcessTask(task)
  })
}

function cloneWorkOrder(order: MutableDyeWorkOrder): DyeWorkOrder {
  return {
    ...order,
    sourceArtifactIds: order.sourceArtifactIds ? [...order.sourceArtifactIds] : undefined,
    productionOrderIds: order.productionOrderIds ? [...order.productionOrderIds] : undefined,
    formalProductionOrderSnapshot: order.formalProductionOrderSnapshot
      ? { ...order.formalProductionOrderSnapshot, processCodes: [...order.formalProductionOrderSnapshot.processCodes] }
      : undefined,
  }
}

function cloneNodeRecord(record: MutableDyeExecutionNodeRecord): DyeExecutionNodeRecord {
  return {
    ...record,
    proofImageIds: record.proofImageIds ? [...record.proofImageIds] : undefined,
  }
}

function cloneReviewRecord(record: MutableDyeReviewRecord): DyeReviewRecord {
  return {
    ...record,
    handoverRecordIds: record.handoverRecordIds ? [...record.handoverRecordIds] : undefined,
  }
}

function cloneVatSchedule(schedule: MutableDyeVatSchedule): DyeVatSchedule {
  return { ...schedule, supportedMaterialTypes: [...schedule.supportedMaterialTypes] }
}

function cloneFormulaRecord(record: MutableDyeFormulaRecord): DyeFormulaRecord {
  return {
    ...record,
    lines: record.lines.map((line) => ({ ...line })),
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function isDyeingTask(task: PdaGenericTaskMock): boolean {
  return task.processBusinessCode === 'DYE' || task.processCode === 'PROC_DYE' || task.processNameZh === '染色'
}

function getDyeingTasks(): PdaGenericTaskMock[] {
  return listPdaGenericProcessTasks()
    .filter(isDyeingTask)
    .sort((left, right) => left.taskId.localeCompare(right.taskId))
}

function getDyeingTaskById(taskId: string): PdaGenericTaskMock | undefined {
  return getDyeingTasks().find((task) => task.taskId === taskId)
}

function syncLinkedTaskState(
  taskId: string,
  input: {
    status?: PdaGenericTaskMock['status']
    startedAt?: string
    finishedAt?: string
    acceptanceStatus?: PdaGenericTaskMock['acceptanceStatus']
    assignmentMode?: PdaGenericTaskMock['assignmentMode']
    assignmentStatus?: PdaGenericTaskMock['assignmentStatus']
    blockReason?: PdaGenericTaskMock['blockReason']
    blockRemark?: PdaGenericTaskMock['blockRemark']
  },
): void {
  const task = getDyeingTaskById(taskId)
  if (!task) return

  if (input.status) task.status = input.status
  if (typeof input.assignmentMode !== 'undefined') task.assignmentMode = input.assignmentMode
  if (typeof input.assignmentStatus !== 'undefined') task.assignmentStatus = input.assignmentStatus
  if (typeof input.startedAt !== 'undefined') task.startedAt = input.startedAt
  if (typeof input.finishedAt !== 'undefined') task.finishedAt = input.finishedAt
  if (typeof input.acceptanceStatus !== 'undefined') task.acceptanceStatus = input.acceptanceStatus
  if (typeof input.blockReason !== 'undefined') task.blockReason = input.blockReason
  if (typeof input.blockRemark !== 'undefined') task.blockRemark = input.blockRemark
  task.updatedAt = nowTimestamp()
}

function syncWaterSolubleTaskState(order: MutableDyeWorkOrder): void {
  if (!order.requiresWaterSoluble) return
  const task = getDyeingTaskById(order.taskId)
  if (!task) return
  ;(task as PdaGenericTaskMock & { waterSolubleHandoverEligible?: boolean }).waterSolubleHandoverEligible = false

  if (order.status === 'WATER_SOLUBLE_IN_PROGRESS') {
    task.status = 'IN_PROGRESS'
    task.acceptanceStatus = 'ACCEPTED'
    task.startedAt = task.startedAt || nowTimestamp()
    task.finishedAt = undefined
    task.blockReason = undefined
    task.blockRemark = undefined
  } else if (order.status === 'PRODUCTION_PAUSED') {
    task.status = 'BLOCKED'
    task.acceptanceStatus = 'ACCEPTED'
    task.blockReason = 'MATERIAL'
    task.blockRemark = '水溶完成数量不足，待主管处理。'
  } else if (order.status === 'WAIT_WATER_SOLUBLE' || order.status === 'WAIT_VAT_PLAN') {
    task.status = 'NOT_STARTED'
    task.acceptanceStatus = 'ACCEPTED'
    task.startedAt = undefined
    task.finishedAt = undefined
    task.blockReason = undefined
    task.blockRemark = undefined
  } else {
    return
  }
  task.updatedAt = nowTimestamp()
}

function getPrimaryHandoverOrder(taskId: string): PdaHandoverHead | null {
  const existing = listHandoverOrdersByTaskId(taskId)
  return existing[0] ?? null
}

function syncTaskHandoverFields(taskId: string, handoverOrderId: string): void {
  const task = getDyeingTaskById(taskId) as (PdaGenericTaskMock & {
    handoverOrderId?: string
    handoverStatus?: string
  }) | undefined
  if (!task) return

  task.handoverOrderId = handoverOrderId
  const head = getHandoverOrderById(handoverOrderId)
  if (head?.handoverOrderStatus) {
    task.handoverStatus = head.handoverOrderStatus
  }
}

function ensureStartedTaskHandover(taskId: string): string | undefined {
  const task = getDyeingTaskById(taskId)
  if (!task?.startedAt) return undefined

  const ensured = ensureHandoverOrderForStartedTask(taskId)
  syncTaskHandoverFields(taskId, ensured.handoverOrderId)
  return ensured.handoverOrderId
}

function ensureSeededHandoverRecord(input: {
  taskId: string
  submittedQty: number
  receiverWrittenQty?: number
  submittedAt: string
  receiverWrittenAt?: string
  receiverRemark?: string
  diffReason?: string
}): { handoverOrderId?: string; recordIds: string[] } {
  const handoverOrderId = ensureStartedTaskHandover(input.taskId)
  if (!handoverOrderId) return { recordIds: [] }

  const head = getHandoverOrderById(handoverOrderId)
  if (!head) return { handoverOrderId, recordIds: [] }
  const existing = getPdaHandoverRecordsByHead(head.handoverId)
  if (existing.length === 0) {
    createFactoryHandoverRecord({
      handoverOrderId,
      submittedQty: input.submittedQty,
      qtyUnit: head.qtyUnit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: '染色工厂',
      factoryRemark: '染色面料送中转区域',
      objectType: 'FABRIC',
    })
  }

  const records = getPdaHandoverRecordsByHead(head.handoverId)
  const firstRecord = records[0]
  if (
    firstRecord
    && typeof input.receiverWrittenQty === 'number'
    && input.receiverWrittenAt
    && !firstRecord.receiverWrittenAt
  ) {
    writeBackHandoverRecord({
      handoverRecordId: firstRecord.handoverRecordId,
      receiverWrittenQty: input.receiverWrittenQty,
      receiverWrittenAt: input.receiverWrittenAt,
      receiverWrittenBy: '中转区域',
      receiverRemark: input.receiverRemark,
      diffReason: input.diffReason,
    })
  }

  const nextRecords = getPdaHandoverRecordsByHead(head.handoverId)
  return { handoverOrderId, recordIds: nextRecords.map((record) => record.handoverRecordId) }
}

function setNodeRecords(dyeOrderId: string, records: MutableDyeExecutionNodeRecord[]): void {
  nodeRecordStore.set(dyeOrderId, records.map((record) => ({ ...record })))
}

function appendNodeRecord(dyeOrderId: string, record: MutableDyeExecutionNodeRecord): void {
  const current = nodeRecordStore.get(dyeOrderId) ?? []
  current.push({ ...record })
  nodeRecordStore.set(dyeOrderId, current)
}

function upsertNodeRecord(
  dyeOrderId: string,
  nodeCode: DyeExecutionNodeCode,
  updater: (current?: MutableDyeExecutionNodeRecord) => MutableDyeExecutionNodeRecord,
): void {
  const current = nodeRecordStore.get(dyeOrderId) ?? []
  const index = current.findIndex((item) => item.nodeCode === nodeCode)
  const nextRecord = updater(index >= 0 ? current[index] : undefined)
  if (index >= 0) {
    current[index] = nextRecord
  } else {
    current.push(nextRecord)
  }
  nodeRecordStore.set(dyeOrderId, current)
}

function createNodeRecordId(dyeOrderId: string, nodeCode: DyeExecutionNodeCode): string {
  return `${dyeOrderId}-${nodeCode}`
}

function getQtyUnit(order: DyeWorkOrder): string {
  return order.qtyUnit || '件'
}

function getCurrentNode(order: DyeWorkOrder): string {
  return DYE_WORK_ORDER_STATUS_LABEL[order.status]
}

function getWaitingReason(order: DyeWorkOrder): string {
  switch (order.status) {
    case 'WAIT_SAMPLE':
      return order.sampleWaitType === 'WAIT_COLOR_CARD' ? '等待色样' : '等待样衣'
    case 'WAIT_MATERIAL':
      return '原料面料未齐'
    case 'SAMPLE_TESTING':
      return '打样执行中'
    case 'SAMPLE_DONE':
      return '等待备料完成'
    case 'MATERIAL_READY':
      return '备料完成，等待打样确认'
    case 'WAIT_VAT_PLAN':
      return '待排染缸'
    case 'WAIT_WATER_SOLUBLE':
      return '准备完成，待水溶'
    case 'WATER_SOLUBLE_IN_PROGRESS':
      return '水溶处理中'
    case 'PRODUCTION_PAUSED':
      return '水溶数量不足，待主管处理'
    case 'DYEING':
      return '染缸执行中'
    case 'DEHYDRATING':
      return '脱水处理中'
    case 'DRYING':
      return '烘干处理中'
    case 'SETTING':
      return '定型处理中'
    case 'ROLLING':
      return '打卷处理中'
    case 'PACKING':
      return '包装处理中'
    case 'WAIT_HANDOVER':
      return '包装完成待交出'
    case 'HANDOVER_WAIT_RECEIVE':
      return '已交出，等待确认收货'
    case 'WAIT_REVIEW':
      return '接收方已回写，等待平台审核'
    case 'PARTIAL_HANDOVER':
      return '部分交出'
    case 'HANDOVER_DIFFERENCE':
      return '收货差异待处理'
    case 'FULL_HANDOVER':
      return '全部交出'
    default:
      return '跟进中'
  }
}

function getStatusDurationHours(order: DyeWorkOrder): number {
  const start = order.sampleWaitStartedAt
    || getDyeExecutionNodeRecord(order.dyeOrderId, 'DYE')?.startedAt
    || getDyeExecutionNodeRecord(order.dyeOrderId, 'SAMPLE')?.startedAt
    || order.createdAt
  const end = order.updatedAt || start
  const startValue = Date.parse(start.replace(' ', 'T'))
  const endValue = Date.parse(end.replace(' ', 'T'))
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return 0
  return Number((Math.max(0, endValue - startValue) / 36e5).toFixed(1))
}

function getCurrentOutputQty(order: DyeWorkOrder): number {
  const nodes = nodeRecordStore.get(order.dyeOrderId) ?? []
  return nodes.reduce((current, node) => Math.max(current, node.outputQty ?? 0), 0)
}

function getCurrentDyeVatNo(order: DyeWorkOrder): string | undefined {
  return (
    getDyeExecutionNodeRecord(order.dyeOrderId, 'DYE')?.dyeVatNo
    || getDyeExecutionNodeRecord(order.dyeOrderId, 'VAT_PLAN')?.dyeVatNo
  )
}

function updateOrderTimestamp(order: MutableDyeWorkOrder, at = nowTimestamp()): void {
  order.updatedAt = at
}

function resolveDyeReceiptStatus(input: {
  completedQty: number
  submittedQty: number
  receivedQty: number
  forceDifference?: boolean
}): DyeReviewStatus {
  const completedQty = Math.max(Number(input.completedQty || 0), 0)
  const submittedQty = Math.max(Number(input.submittedQty || 0), 0)
  const receivedQty = Math.max(Number(input.receivedQty || 0), 0)
  if (input.forceDifference || receivedQty > submittedQty) return 'HANDOVER_DIFFERENCE'
  if (receivedQty <= 0) return 'WAIT_RECEIVE'
  if (completedQty > 0 && receivedQty < completedQty) return 'WAIT_REVIEW'
  return 'FULL_HANDOVER'
}

function createReviewFromHandover(order: MutableDyeWorkOrder, head: PdaHandoverHead): MutableDyeReviewRecord {
  const records = getPdaHandoverRecordsByHead(head.handoverId)
  const submittedQty = head.submittedQtyTotal ?? 0
  const receivedQty = head.pendingWritebackCount && head.pendingWritebackCount > 0 ? 0 : (head.writtenBackQtyTotal ?? 0)
  const diffQty = head.pendingWritebackCount && head.pendingWritebackCount > 0 ? 0 : (head.diffQtyTotal ?? receivedQty - submittedQty)
  const reviewStatus = resolveDyeReceiptStatus({
    completedQty: getCurrentOutputQty(order) || order.plannedQty,
    submittedQty,
    receivedQty,
    forceDifference: Math.abs(diffQty) > 0 && receivedQty > 0,
  })
  return {
    reviewRecordId: `DRV-${order.dyeOrderId}`,
    dyeOrderId: order.dyeOrderId,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverRecordIds: records.map((record) => record.handoverRecordId),
    receiverName: order.targetTransferWarehouseName,
    submittedQty,
    receivedQty,
    diffQty,
    receivedRollCount: receivedQty > 0 && order.plannedRollCount ? Math.max(1, order.plannedRollCount - (diffQty ? 1 : 0)) : undefined,
    receivedLength: receivedQty > 0 ? Number((receivedQty * 0.82).toFixed(1)) : undefined,
    lengthUnit: '米',
    reviewStatus,
    remark: reviewStatus === 'WAIT_RECEIVE'
      ? '交出记录已生成，等待接收方确认收货'
      : reviewStatus === 'WAIT_REVIEW'
        ? '接收方已回写，等待平台审核'
        : '接收方已确认收货',
  }
}

function syncReviewFromHandover(order: MutableDyeWorkOrder, head: PdaHandoverHead): MutableDyeReviewRecord {
  const next = createReviewFromHandover(order, head)
  const current = reviewRecordStore.get(order.dyeOrderId)
  if (!current) {
    reviewRecordStore.set(order.dyeOrderId, next)
    return next
  }
  current.handoverOrderId = next.handoverOrderId
  current.handoverRecordIds = next.handoverRecordIds
  current.receiverName = next.receiverName
  current.submittedQty = next.submittedQty
  if (current.reviewStatus === 'WAIT_RECEIVE') {
    current.receivedQty = next.receivedQty
    current.diffQty = next.diffQty
    current.receivedRollCount = next.receivedRollCount
    current.receivedLength = next.receivedLength
    current.lengthUnit = next.lengthUnit
    current.reviewStatus = next.reviewStatus
    current.remark = current.remark || next.remark
  }
  return current
}

function syncDyeOrderFromReview(order: MutableDyeWorkOrder, review?: MutableDyeReviewRecord): boolean {
  if (!review) return false
  if (review.reviewStatus === 'WAIT_RECEIVE') {
    order.status = 'HANDOVER_WAIT_RECEIVE'
  } else if (review.reviewStatus === 'REJECTED') {
    order.status = 'REJECTED'
  } else if (review.reviewStatus === 'FULL_HANDOVER' && review.reviewedAt) {
    order.status = 'COMPLETED'
  } else {
    order.status = review.reviewStatus
  }
  return true
}

function syncPreVatStatus(order: MutableDyeWorkOrder): void {
  if (
    order.status === 'DYEING'
    || order.status === 'DEHYDRATING'
    || order.status === 'DRYING'
    || order.status === 'SETTING'
    || order.status === 'ROLLING'
    || order.status === 'PACKING'
    || order.status === 'WAIT_HANDOVER'
    || order.status === 'HANDOVER_WAIT_RECEIVE'
    || order.status === 'HANDOVER_WAIT_RECEIVE'
    || order.status === 'WAIT_REVIEW'
    || order.status === 'PARTIAL_HANDOVER'
    || order.status === 'HANDOVER_WAIT_RECEIVE'
    || order.status === 'FULL_HANDOVER'
    || order.status === 'HANDOVER_DIFFERENCE'
    || order.status === 'COMPLETED'
    || order.status === 'REJECTED'
    || order.status === 'WAIT_WATER_SOLUBLE'
    || order.status === 'WATER_SOLUBLE_IN_PROGRESS'
    || order.status === 'PRODUCTION_PAUSED'
  ) {
    return
  }

  const materialReadyNode = getDyeExecutionNodeRecord(order.dyeOrderId, 'MATERIAL_READY')
  if (order.sampleWaitType !== 'NONE' && !order.sampleWaitFinishedAt) {
    order.status = 'WAIT_SAMPLE'
    return
  }
  if (order.sampleStatus === 'TESTING') {
    order.status = 'SAMPLE_TESTING'
    return
  }
  if (materialReadyNode?.finishedAt && (order.sampleStatus === 'DONE' || order.sampleStatus === 'NOT_REQUIRED')) {
    order.status = 'WAIT_VAT_PLAN'
    return
  }
  if (materialReadyNode?.finishedAt) {
    order.status = 'MATERIAL_READY'
    return
  }
  if (order.materialWaitFinishedAt) {
    order.status = order.sampleStatus === 'DONE' ? 'WAIT_VAT_PLAN' : 'WAIT_MATERIAL'
    return
  }
  if (order.sampleStatus === 'DONE') {
    order.status = 'SAMPLE_DONE'
    return
  }
  order.status = 'WAIT_MATERIAL'
}

function syncDerivedWorkflow(): void {
  seedDomain()

  for (const order of workOrderStore.values()) {
    const head = order.handoverOrderId
      ? getHandoverOrderById(order.handoverOrderId)
      : getPrimaryHandoverOrder(order.taskId)
    if (head) {
      order.handoverOrderId = head.handoverOrderId || head.handoverId
      order.handoverOrderNo = head.handoverOrderNo
      syncTaskHandoverFields(order.taskId, order.handoverOrderId)
    } else if (!order.handoverOrderId && (!order.requiresWaterSoluble || order.status === 'WAIT_HANDOVER')) {
      const ensured = ensureStartedTaskHandover(order.taskId)
      if (ensured) {
        const nextHead = getHandoverOrderById(ensured)
        order.handoverOrderId = ensured
        order.handoverOrderNo = nextHead?.handoverOrderNo
      }
    }

    const review = reviewRecordStore.get(order.dyeOrderId)
    if (syncDyeOrderFromReview(order, review)) {
      continue
    }

    if (head && (head.recordCount ?? 0) > 0) {
      const nextReview = syncReviewFromHandover(order, head)
      syncDyeOrderFromReview(order, nextReview)
      continue
    }

    syncPreVatStatus(order)
  }
}

function addSeedWorkOrder(input: Omit<
  MutableDyeWorkOrder,
  | 'taskQrValue'
  | 'receiverKind'
  | 'receiverName'
  | 'handoverOrderNo'
  | 'assignmentMode'
  | 'assignmentModeEditable'
  | 'dispatchPrice'
  | 'dispatchPriceCurrency'
  | 'dispatchPriceUnit'
  | 'dispatchPriceDisplay'
  | 'requiresWaterSoluble'
  | 'waterSolublePlannedQty'
  | 'waterSolubleCompletedQty'
  | 'waterSolubleQtyUnit'
> & {
  dispatchPrice?: number
  requiresWaterSoluble?: boolean
  waterSolublePlannedQty?: number
  waterSolubleCompletedQty?: number
  waterSolubleQtyUnit?: string
}): void {
  const task = getDyeingTaskById(input.taskId)
  const handoverOrder = input.handoverOrderId ? getHandoverOrderById(input.handoverOrderId) : getPrimaryHandoverOrder(input.taskId)
  if (task) {
    const hasFactory = Boolean(input.dyeFactoryId)
    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = hasFactory ? 'ASSIGNED' : 'UNASSIGNED'
    task.acceptanceStatus = hasFactory ? 'ACCEPTED' : 'PENDING'
    task.assignedFactoryId = hasFactory ? input.dyeFactoryId : undefined
    task.assignedFactoryName = hasFactory ? input.dyeFactoryName : '待分配工厂'
    task.tenderId = undefined
    task.awardedAt = undefined
    task.dispatchedBy = hasFactory ? '平台派单' : undefined
    task.dispatchRemark = hasFactory ? '染色加工单派单后直接进入执行待加工' : '正式生产单已生成加工单，待分配工厂。'
    task.dispatchPrice = input.dispatchPrice ?? 1500
    task.dispatchPriceCurrency = 'IDR'
    task.dispatchPriceUnit = 'Yard'
    task.standardPriceCurrency = 'IDR'
    task.standardPriceUnit = 'Yard'
    task.mockOrigin = 'DIRECT_ASSIGNED_EXECUTION'
    task.mockReceiveSummary = '染色加工单已派单，直接进入执行待加工。'
  }

  workOrderStore.set(input.dyeOrderId, {
    ...input,
    requiresWaterSoluble: input.requiresWaterSoluble === true,
    waterSolublePlannedQty: input.requiresWaterSoluble ? (input.waterSolublePlannedQty ?? input.plannedQty) : undefined,
    waterSolubleCompletedQty: input.requiresWaterSoluble ? (input.waterSolubleCompletedQty ?? 0) : undefined,
    waterSolubleQtyUnit: input.requiresWaterSoluble ? (input.waterSolubleQtyUnit || input.qtyUnit) : undefined,
    assignmentMode: '派单',
    assignmentModeEditable: false,
    dispatchPrice: input.dispatchPrice ?? 1500,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: 'Yard',
    dispatchPriceDisplay: `${input.dispatchPrice ?? 1500} IDR/Yard`,
    taskQrValue: task?.taskQrValue || buildTaskQrValue(input.taskId),
    receiverKind: task?.receiverKind || 'WAREHOUSE',
    receiverName: task?.receiverName || '中转区域',
    handoverOrderId: handoverOrder?.handoverOrderId || handoverOrder?.handoverId || input.handoverOrderId,
    handoverOrderNo: handoverOrder?.handoverOrderNo,
  })
}

function addVatSchedule(schedule: MutableDyeVatSchedule): void {
  vatScheduleStore.set(schedule.vatScheduleId, { ...schedule, supportedMaterialTypes: [...schedule.supportedMaterialTypes] })
}

function addFormulaRecord(record: MutableDyeFormulaRecord): void {
  formulaStore.set(record.formulaId, cloneFormulaRecord(record))
}

function seedWorkOrders(): void {
  const vats = listFactoryDyeVatCapacities(TEST_FACTORY_ID)
  const primaryVat = vats[0]
  const secondaryVat = vats[1] ?? vats[0]

  syncLinkedTaskState('TASK-DYE-000726', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-28 09:20:00',
  })
  syncLinkedTaskState('TASK-DYE-000725', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-28 09:40:00',
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-DYE-000727', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-28 13:10:00',
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-DYE-000728', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-28 13:40:00',
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-DYE-000729', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-27 15:00:00',
    finishedAt: undefined,
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-DYE-000730', {
    status: 'BLOCKED',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-27 16:00:00',
    finishedAt: undefined,
    blockReason: 'QUALITY',
    blockRemark: '中转区域收货差异',
  })
  syncLinkedTaskState('TASK-DYE-000731', {
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-28 08:20:00',
    finishedAt: '2026-03-29 18:10:00',
  })

  const orderWaitReview = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000729',
    submittedQty: 980,
    receiverWrittenQty: 972,
    submittedAt: '2026-03-28 18:10:00',
    receiverWrittenAt: '2026-03-28 20:40:00',
    diffReason: '中转区域复核少 8 米',
  })
  const orderRejected = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000730',
    submittedQty: 860,
    receiverWrittenQty: 842,
    submittedAt: '2026-03-28 16:00:00',
    receiverWrittenAt: '2026-03-28 19:30:00',
    diffReason: '卷数和长度复核不一致',
  })
  const orderCompleted = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000731',
    submittedQty: 1180,
    receiverWrittenQty: 1180,
    submittedAt: '2026-03-29 16:20:00',
    receiverWrittenAt: '2026-03-29 17:10:00',
  })
  const orderSubmitted = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000728',
    submittedQty: 910,
    submittedAt: '2026-03-28 17:25:00',
  })
  const orderWaitHandover = ensureStartedTaskHandover('TASK-DYE-000727')

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[0],
    dyeOrderNo: 'DY-20260328-001',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-401'],
    isFirstOrder: true,
    sampleWaitType: 'WAIT_SAMPLE_GARMENT',
    sampleStatus: 'WAITING',
    sampleWaitStartedAt: '2026-03-28 08:30:00',
    colorNo: undefined,
    rawMaterialSku: 'FAB-DYE-001',
    composition: '棉 95% / 氨纶 5%',
    width: '160 cm',
    weightGsm: 220,
    targetColor: '海军蓝',
    plannedQty: 920,
    qtyUnit: '米',
    plannedRollCount: 18,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_SAMPLE',
    taskId: 'TASK-DYE-000721',
    taskNo: 'TASK-DYE-000721',
    waitingReason: '等待样衣',
    createdAt: '2026-03-28 08:10:00',
    updatedAt: '2026-03-28 08:30:00',
    remark: '首单需要样衣确认',
  })

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[1],
    dyeOrderNo: 'DY-20260328-002',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-402'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 08:20:00',
    rawMaterialSku: 'FAB-DYE-002',
    composition: '涤棉混纺',
    width: '150 cm',
    weightGsm: 180,
    targetColor: '军绿',
    plannedQty: 760,
    qtyUnit: '米',
    plannedRollCount: 12,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_MATERIAL',
    taskId: 'TASK-DYE-000722',
    taskNo: 'TASK-DYE-000722',
    waitingReason: '等待原料面料',
    createdAt: '2026-03-28 08:15:00',
    updatedAt: '2026-03-28 08:20:00',
  })

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[2],
    dyeOrderNo: 'DY-20260328-003',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-403'],
    isFirstOrder: true,
    sampleWaitType: 'WAIT_COLOR_CARD',
    sampleStatus: 'TESTING',
    sampleWaitStartedAt: '2026-03-28 08:00:00',
    sampleWaitFinishedAt: '2026-03-28 09:10:00',
    materialWaitStartedAt: '2026-03-28 08:30:00',
    materialWaitFinishedAt: '2026-03-28 09:00:00',
    colorNo: 'C-815',
    rawMaterialSku: 'FAB-DYE-003',
    composition: '人棉 100%',
    width: '148 cm',
    weightGsm: 145,
    targetColor: '茶棕',
    plannedQty: 680,
    qtyUnit: '米',
    plannedRollCount: 10,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'SAMPLE_TESTING',
    taskId: 'TASK-DYE-000723',
    taskNo: 'TASK-DYE-000723',
    waitingReason: '打样执行中',
    createdAt: '2026-03-28 07:40:00',
    updatedAt: '2026-03-28 10:20:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[2], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[2]}-SAMPLE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[2],
      taskId: 'TASK-DYE-000723',
      nodeCode: 'SAMPLE',
      nodeName: DYE_NODE_LABEL.SAMPLE,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:20:00',
      qtyUnit: '米',
      remark: '色号确认中',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[3],
    dyeOrderNo: 'DY-20260328-004',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-404'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 08:30:00',
    materialWaitFinishedAt: '2026-03-28 09:10:00',
    colorNo: 'C-206',
    rawMaterialSku: 'FAB-DYE-004',
    composition: '毛织棉',
    width: '170 cm',
    weightGsm: 210,
    targetColor: '深卡其',
    plannedQty: 840,
    qtyUnit: '米',
    plannedRollCount: 14,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'MATERIAL_READY',
    taskId: 'TASK-DYE-000724',
    taskNo: 'TASK-DYE-000724',
    waitingReason: '备料完成，等待排染缸',
    createdAt: '2026-03-28 08:00:00',
    updatedAt: '2026-03-28 10:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[3], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[3]}-MATERIAL_READY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[3],
      taskId: 'TASK-DYE-000724',
      nodeCode: 'MATERIAL_READY',
      nodeName: DYE_NODE_LABEL.MATERIAL_READY,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:20:00',
      finishedAt: '2026-03-28 10:40:00',
      inputQty: 840,
      outputQty: 840,
      qtyUnit: '米',
      remark: '备料完成',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[4],
    dyeOrderNo: 'DY-20260328-005',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-405'],
    isFirstOrder: true,
    sampleWaitType: 'WAIT_COLOR_CARD',
    sampleStatus: 'DONE',
    sampleWaitStartedAt: '2026-03-28 07:50:00',
    sampleWaitFinishedAt: '2026-03-28 08:40:00',
    materialWaitStartedAt: '2026-03-28 08:20:00',
    materialWaitFinishedAt: '2026-03-28 08:55:00',
    colorNo: 'C-901',
    rawMaterialSku: 'FAB-DYE-005',
    composition: '牛仔布',
    width: '148 cm',
    weightGsm: 280,
    targetColor: '靛青',
    plannedQty: 980,
    qtyUnit: '米',
    plannedRollCount: 16,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'DRYING',
    taskId: 'TASK-DYE-000725',
    taskNo: 'TASK-DYE-000725',
    waitingReason: '烘干中',
    createdAt: '2026-03-28 07:30:00',
    updatedAt: '2026-03-28 12:50:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[4], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-SAMPLE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'SAMPLE',
      nodeName: DYE_NODE_LABEL.SAMPLE,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 08:45:00',
      finishedAt: '2026-03-28 09:30:00',
      qtyUnit: '米',
      remark: '色号已确认',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-MATERIAL_READY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'MATERIAL_READY',
      nodeName: DYE_NODE_LABEL.MATERIAL_READY,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:00:00',
      finishedAt: '2026-03-28 10:10:00',
      inputQty: 980,
      outputQty: 980,
      qtyUnit: '米',
      remark: '备料完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-VAT_PLAN`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'VAT_PLAN',
      nodeName: DYE_NODE_LABEL.VAT_PLAN,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 10:20:00',
      finishedAt: '2026-03-28 10:30:00',
      dyeVatId: secondaryVat?.dyeVatId,
      dyeVatNo: secondaryVat?.dyeVatNo,
      qtyUnit: '米',
      remark: '已排染缸',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-DYE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'DYE',
      nodeName: DYE_NODE_LABEL.DYE,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 10:35:00',
      finishedAt: '2026-03-28 12:10:00',
      dyeVatId: secondaryVat?.dyeVatId,
      dyeVatNo: secondaryVat?.dyeVatNo,
      inputQty: 980,
      outputQty: 962,
      lossQty: 18,
      qtyUnit: '米',
      remark: '染色完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-DEHYDRATE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'DEHYDRATE',
      nodeName: DYE_NODE_LABEL.DEHYDRATE,
      operatorUserId: 'USR-DYE-03',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 12:15:00',
      finishedAt: '2026-03-28 12:35:00',
      outputQty: 960,
      qtyUnit: '米',
      remark: '脱水完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-DRY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'DRY',
      nodeName: DYE_NODE_LABEL.DRY,
      operatorUserId: 'USR-DYE-03',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 12:40:00',
      outputQty: 958,
      qtyUnit: '米',
      remark: '烘干中',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[5],
    dyeOrderNo: 'DY-20260328-006',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-406'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 08:00:00',
    materialWaitFinishedAt: '2026-03-28 08:30:00',
    colorNo: 'C-612',
    rawMaterialSku: 'FAB-DYE-006',
    composition: '毛织棉',
    width: '160 cm',
    weightGsm: 200,
    targetColor: '燕麦灰',
    plannedQty: 1100,
    qtyUnit: '米',
    plannedRollCount: 18,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'DYEING',
    taskId: 'TASK-DYE-000726',
    taskNo: 'TASK-DYE-000726',
    waitingReason: '染缸执行中',
    createdAt: '2026-03-28 07:20:00',
    updatedAt: '2026-03-28 12:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[5], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[5]}-MATERIAL_READY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[5],
      taskId: 'TASK-DYE-000726',
      nodeCode: 'MATERIAL_READY',
      nodeName: DYE_NODE_LABEL.MATERIAL_READY,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 08:35:00',
      finishedAt: '2026-03-28 09:15:00',
      inputQty: 1100,
      outputQty: 1100,
      qtyUnit: '米',
      remark: '备料完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[5]}-VAT_PLAN`,
      dyeOrderId: DYE_WORK_ORDER_IDS[5],
      taskId: 'TASK-DYE-000726',
      nodeCode: 'VAT_PLAN',
      nodeName: DYE_NODE_LABEL.VAT_PLAN,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:20:00',
      finishedAt: '2026-03-28 09:25:00',
      dyeVatId: primaryVat?.dyeVatId,
      dyeVatNo: primaryVat?.dyeVatNo,
      qtyUnit: '米',
      remark: '已排染缸',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[5]}-DYE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[5],
      taskId: 'TASK-DYE-000726',
      nodeCode: 'DYE',
      nodeName: DYE_NODE_LABEL.DYE,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:30:00',
      dyeVatId: primaryVat?.dyeVatId,
      dyeVatNo: primaryVat?.dyeVatNo,
      inputQty: 1100,
      qtyUnit: '米',
      remark: '染色执行中',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[6],
    dyeOrderNo: 'DY-20260328-007',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-414'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 10:20:00',
    materialWaitFinishedAt: '2026-03-28 10:50:00',
    colorNo: 'C-407',
    rawMaterialSku: 'FAB-DYE-007',
    composition: '牛仔布',
    width: '150 cm',
    weightGsm: 300,
    targetColor: '深蓝',
    plannedQty: 1100,
    qtyUnit: '米',
    plannedRollCount: 15,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_HANDOVER',
    taskId: 'TASK-DYE-000727',
    taskNo: 'TASK-DYE-000727',
    handoverOrderId: orderWaitHandover,
    waitingReason: '包装完成待交出',
    createdAt: '2026-03-28 10:10:00',
    updatedAt: '2026-03-28 17:20:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[6], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-VAT_PLAN`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'VAT_PLAN',
      nodeName: DYE_NODE_LABEL.VAT_PLAN,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 10:55:00',
      finishedAt: '2026-03-28 11:05:00',
      dyeVatId: secondaryVat?.dyeVatId,
      dyeVatNo: secondaryVat?.dyeVatNo,
      qtyUnit: '米',
      remark: '已排染缸',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-DYE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'DYE',
      nodeName: DYE_NODE_LABEL.DYE,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 11:10:00',
      finishedAt: '2026-03-28 12:40:00',
      dyeVatId: secondaryVat?.dyeVatId,
      dyeVatNo: secondaryVat?.dyeVatNo,
      inputQty: 1100,
      outputQty: 1078,
      lossQty: 22,
      qtyUnit: '米',
      remark: '染色完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-DEHYDRATE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'DEHYDRATE',
      nodeName: DYE_NODE_LABEL.DEHYDRATE,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 12:50:00',
      finishedAt: '2026-03-28 13:20:00',
      outputQty: 1076,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-DRY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'DRY',
      nodeName: DYE_NODE_LABEL.DRY,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 13:25:00',
      finishedAt: '2026-03-28 14:10:00',
      outputQty: 1074,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-SET`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'SET',
      nodeName: DYE_NODE_LABEL.SET,
      operatorUserId: 'USR-DYE-03',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 14:20:00',
      finishedAt: '2026-03-28 15:10:00',
      outputQty: 1072,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-ROLL`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'ROLL',
      nodeName: DYE_NODE_LABEL.ROLL,
      operatorUserId: 'USR-DYE-03',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 15:20:00',
      finishedAt: '2026-03-28 16:10:00',
      outputQty: 1070,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[6]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      taskId: 'TASK-DYE-000727',
      nodeCode: 'PACK',
      nodeName: DYE_NODE_LABEL.PACK,
      operatorUserId: 'USR-DYE-03',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 16:15:00',
      finishedAt: '2026-03-28 17:00:00',
      outputQty: 1070,
      qtyUnit: '米',
      remark: '包装完成待交出',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[7],
    dyeOrderNo: 'DY-20260328-008',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-415'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 11:00:00',
    materialWaitFinishedAt: '2026-03-28 11:20:00',
    colorNo: 'C-516',
    rawMaterialSku: 'FAB-DYE-008',
    composition: '涤纶 100%',
    width: '155 cm',
    weightGsm: 165,
    targetColor: '砖红',
    plannedQty: 910,
    qtyUnit: '米',
    plannedRollCount: 13,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'HANDOVER_WAIT_RECEIVE',
    taskId: 'TASK-DYE-000728',
    taskNo: 'TASK-DYE-000728',
    handoverOrderId: orderSubmitted.handoverOrderId,
    waitingReason: '已交出，等待确认收货',
    createdAt: '2026-03-28 10:50:00',
    updatedAt: '2026-03-28 17:30:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[7], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[7]}-VAT_PLAN`,
      dyeOrderId: DYE_WORK_ORDER_IDS[7],
      taskId: 'TASK-DYE-000728',
      nodeCode: 'VAT_PLAN',
      nodeName: DYE_NODE_LABEL.VAT_PLAN,
      operatorUserId: 'USR-DYE-04',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 11:15:00',
      finishedAt: '2026-03-28 11:20:00',
      dyeVatId: primaryVat?.dyeVatId,
      dyeVatNo: primaryVat?.dyeVatNo,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[7]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[7],
      taskId: 'TASK-DYE-000728',
      nodeCode: 'PACK',
      nodeName: DYE_NODE_LABEL.PACK,
      operatorUserId: 'USR-DYE-04',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 15:40:00',
      finishedAt: '2026-03-28 16:50:00',
      outputQty: 910,
      qtyUnit: '米',
      remark: '包装完成',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[8],
    dyeOrderNo: 'DY-20260328-009',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-416'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 09:00:00',
    materialWaitFinishedAt: '2026-03-28 09:25:00',
    colorNo: 'C-330',
    rawMaterialSku: 'FAB-DYE-009',
    composition: '毛织棉',
    width: '162 cm',
    weightGsm: 215,
    targetColor: '豆沙粉',
    plannedQty: 980,
    qtyUnit: '米',
    plannedRollCount: 17,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_REVIEW',
    taskId: 'TASK-DYE-000729',
    taskNo: 'TASK-DYE-000729',
    handoverOrderId: orderWaitReview.handoverOrderId,
    waitingReason: '接收方已回写，等待平台审核',
    createdAt: '2026-03-27 14:50:00',
    updatedAt: '2026-03-28 20:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[8], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[8]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[8],
      taskId: 'TASK-DYE-000729',
      nodeCode: 'PACK',
      nodeName: DYE_NODE_LABEL.PACK,
      operatorUserId: 'USR-DYE-05',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 13:20:00',
      finishedAt: '2026-03-28 14:50:00',
      outputQty: 980,
      qtyUnit: '米',
      remark: '包装完成',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[9],
    dyeOrderNo: 'DY-20260328-010',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-417'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-27 15:20:00',
    materialWaitFinishedAt: '2026-03-27 15:40:00',
    colorNo: 'C-118',
    rawMaterialSku: 'FAB-DYE-010',
    composition: '涤棉混纺',
    width: '152 cm',
    weightGsm: 175,
    targetColor: '灰绿',
    plannedQty: 860,
    qtyUnit: '米',
    plannedRollCount: 12,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'HANDOVER_DIFFERENCE',
    taskId: 'TASK-DYE-000730',
    taskNo: 'TASK-DYE-000730',
    handoverOrderId: orderRejected.handoverOrderId,
    waitingReason: '收货差异待处理',
    createdAt: '2026-03-27 15:00:00',
    updatedAt: '2026-03-28 19:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[9], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[9]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[9],
      taskId: 'TASK-DYE-000730',
      nodeCode: 'PACK',
      nodeName: DYE_NODE_LABEL.PACK,
      operatorUserId: 'USR-DYE-05',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 12:40:00',
      finishedAt: '2026-03-28 14:40:00',
      outputQty: 860,
      qtyUnit: '米',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[10],
    dyeOrderNo: 'DY-20260328-011',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-418'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 07:20:00',
    materialWaitFinishedAt: '2026-03-28 07:45:00',
    colorNo: 'C-552',
    rawMaterialSku: 'FAB-DYE-011',
    composition: '牛仔布',
    width: '150 cm',
    weightGsm: 285,
    targetColor: '墨黑',
    plannedQty: 1180,
    qtyUnit: '米',
    plannedRollCount: 20,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'FULL_HANDOVER',
    taskId: 'TASK-DYE-000731',
    taskNo: 'TASK-DYE-000731',
    handoverOrderId: orderCompleted.handoverOrderId,
    waitingReason: '已完成',
    createdAt: '2026-03-28 07:00:00',
    updatedAt: '2026-03-29 18:10:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[10], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-VAT_PLAN`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'VAT_PLAN',
      nodeName: DYE_NODE_LABEL.VAT_PLAN,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 08:00:00',
      finishedAt: '2026-03-28 08:05:00',
      dyeVatId: secondaryVat?.dyeVatId,
      dyeVatNo: secondaryVat?.dyeVatNo,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-DYE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'DYE',
      nodeName: DYE_NODE_LABEL.DYE,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 08:20:00',
      finishedAt: '2026-03-28 10:10:00',
      dyeVatId: secondaryVat?.dyeVatId,
      dyeVatNo: secondaryVat?.dyeVatNo,
      inputQty: 1180,
      outputQty: 1176,
      lossQty: 4,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-DEHYDRATE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'DEHYDRATE',
      nodeName: DYE_NODE_LABEL.DEHYDRATE,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 10:20:00',
      finishedAt: '2026-03-28 10:50:00',
      outputQty: 1176,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-DRY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'DRY',
      nodeName: DYE_NODE_LABEL.DRY,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 11:00:00',
      finishedAt: '2026-03-28 11:50:00',
      outputQty: 1174,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-SET`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'SET',
      nodeName: DYE_NODE_LABEL.SET,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 12:10:00',
      finishedAt: '2026-03-28 13:20:00',
      outputQty: 1173,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-ROLL`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'ROLL',
      nodeName: DYE_NODE_LABEL.ROLL,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 13:30:00',
      finishedAt: '2026-03-28 14:05:00',
      outputQty: 1172,
      qtyUnit: '米',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[10]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      taskId: 'TASK-DYE-000731',
      nodeCode: 'PACK',
      nodeName: DYE_NODE_LABEL.PACK,
      operatorUserId: 'USR-DYE-06',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 14:20:00',
      finishedAt: '2026-03-28 15:10:00',
      outputQty: 1172,
      qtyUnit: '米',
      remark: '包装完成',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[11],
    dyeOrderNo: 'DY-20260329-012',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260329-412'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-29 08:20:00',
    materialWaitFinishedAt: '2026-03-29 09:05:00',
    colorNo: 'C-612',
    rawMaterialSku: 'FAB-DYE-012',
    composition: '棉麻混纺',
    width: '152 cm',
    weightGsm: 190,
    targetColor: '雾灰',
    plannedQty: 930,
    qtyUnit: '米',
    plannedRollCount: 15,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_VAT_PLAN',
    taskId: 'TASK-DYE-000732',
    taskNo: 'TASK-DYE-000732',
    waitingReason: '待排缸',
    createdAt: '2026-03-29 08:00:00',
    updatedAt: '2026-03-29 09:05:00',
    remark: '补充统计样本，备料完成后等待排染缸',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[11], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[11]}-MATERIAL_READY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[11],
      taskId: 'TASK-DYE-000732',
      nodeCode: 'MATERIAL_READY',
      nodeName: DYE_NODE_LABEL.MATERIAL_READY,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-29 08:25:00',
      finishedAt: '2026-03-29 09:05:00',
      inputQty: 930,
      outputQty: 930,
      qtyUnit: '米',
      remark: '备料完成',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[12],
    dyeOrderNo: 'DY-20260329-013',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260329-413'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-29 09:20:00',
    materialWaitFinishedAt: '2026-03-29 10:05:00',
    colorNo: 'C-613',
    rawMaterialSku: 'FAB-DYE-013',
    composition: '棉涤混纺',
    width: '150 cm',
    weightGsm: 185,
    targetColor: '雾蓝',
    plannedQty: 940,
    qtyUnit: '米',
    plannedRollCount: 16,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'PACKING',
    taskId: 'TASK-DYE-000733',
    taskNo: 'TASK-DYE-000733',
    waitingReason: '包装中',
    createdAt: '2026-03-29 09:00:00',
    updatedAt: '2026-03-29 10:05:00',
    remark: '包装中演示样本，完成包装后进入染色待交出仓',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[12], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[12]}-MATERIAL_READY`,
      dyeOrderId: DYE_WORK_ORDER_IDS[12],
      taskId: 'TASK-DYE-000733',
      nodeCode: 'MATERIAL_READY',
      nodeName: DYE_NODE_LABEL.MATERIAL_READY,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-29 09:25:00',
      finishedAt: '2026-03-29 10:05:00',
      inputQty: 940,
      outputQty: 940,
      qtyUnit: '米',
      remark: '备料完成',
    },
  ])

  if (primaryVat) {
    addVatSchedule({
      vatScheduleId: 'DVS-001',
      dyeVatId: primaryVat.dyeVatId,
      dyeVatNo: primaryVat.dyeVatNo,
      capacityQty: primaryVat.capacityQty,
      capacityUnit: primaryVat.capacityUnit,
      supportedMaterialTypes: primaryVat.supportedMaterialTypes,
      dyeOrderId: DYE_WORK_ORDER_IDS[5],
      plannedStartAt: '2026-03-28 09:20:00',
      plannedEndAt: '2026-03-28 13:20:00',
      actualStartAt: '2026-03-28 09:30:00',
      status: 'IN_USE',
    })
    addVatSchedule({
      vatScheduleId: 'DVS-002',
      dyeVatId: primaryVat.dyeVatId,
      dyeVatNo: primaryVat.dyeVatNo,
      capacityQty: primaryVat.capacityQty,
      capacityUnit: primaryVat.capacityUnit,
      supportedMaterialTypes: primaryVat.supportedMaterialTypes,
      dyeOrderId: DYE_WORK_ORDER_IDS[7],
      plannedStartAt: '2026-03-28 11:10:00',
      plannedEndAt: '2026-03-28 14:40:00',
      actualStartAt: '2026-03-28 11:15:00',
      actualEndAt: '2026-03-28 14:30:00',
      status: 'DONE',
    })
  }
  if (secondaryVat) {
    addVatSchedule({
      vatScheduleId: 'DVS-003',
      dyeVatId: secondaryVat.dyeVatId,
      dyeVatNo: secondaryVat.dyeVatNo,
      capacityQty: secondaryVat.capacityQty,
      capacityUnit: secondaryVat.capacityUnit,
      supportedMaterialTypes: secondaryVat.supportedMaterialTypes,
      dyeOrderId: DYE_WORK_ORDER_IDS[6],
      plannedStartAt: '2026-03-28 10:55:00',
      plannedEndAt: '2026-03-28 17:00:00',
      actualStartAt: '2026-03-28 11:10:00',
      actualEndAt: '2026-03-28 12:40:00',
      status: 'DONE',
    })
    addVatSchedule({
      vatScheduleId: 'DVS-004',
      dyeVatId: secondaryVat.dyeVatId,
      dyeVatNo: secondaryVat.dyeVatNo,
      capacityQty: secondaryVat.capacityQty,
      capacityUnit: secondaryVat.capacityUnit,
      supportedMaterialTypes: secondaryVat.supportedMaterialTypes,
      dyeOrderId: DYE_WORK_ORDER_IDS[10],
      plannedStartAt: '2026-03-28 08:00:00',
      plannedEndAt: '2026-03-28 10:20:00',
      actualStartAt: '2026-03-28 08:20:00',
      actualEndAt: '2026-03-28 10:10:00',
      status: 'DONE',
    })
  }

  const waitReviewHead = orderWaitReview.handoverOrderId ? getHandoverOrderById(orderWaitReview.handoverOrderId) : undefined
  if (waitReviewHead) {
    const partialReview = createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[8])!, waitReviewHead)
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[8], {
      ...partialReview,
      receivedQty: partialReview.submittedQty,
      diffQty: 0,
      reviewStatus: 'WAIT_REVIEW',
      reviewedBy: '中转仓管',
      reviewedAt: '2026-03-28 17:30:00',
      remark: '接收方已回写，等待平台审核',
    })
  }

  const rejectedHead = orderRejected.handoverOrderId ? getHandoverOrderById(orderRejected.handoverOrderId) : undefined
  if (rejectedHead) {
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[9], {
      ...createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[9])!, rejectedHead),
      reviewStatus: 'REJECTED',
      reviewedBy: '中转仓管',
      reviewedAt: '2026-03-28 19:40:00',
      rejectReason: '卷数与长度复核不一致',
      remark: '中转区域收货差异',
    })
  }

  const completedHead = orderCompleted.handoverOrderId ? getHandoverOrderById(orderCompleted.handoverOrderId) : undefined
  if (completedHead) {
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[10], {
      ...createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[10])!, completedHead),
      reviewStatus: 'FULL_HANDOVER',
      reviewedBy: '中转仓管',
      reviewedAt: '2026-03-29 18:10:00',
      remark: '中转区域已全部确认收货',
    })
  }

  addFormulaRecord({
    formulaId: 'DF-001',
    formulaNo: 'FORMULA-DYE-001',
    dyeOrderId: DYE_WORK_ORDER_IDS[0],
    dyeOrderNo: 'DY-20260328-001',
    taskId: 'TASK-DYE-000721',
    taskNo: 'TASK-DYE-000721',
    colorNo: 'C-701',
    rawMaterialSku: 'FAB-DYE-001',
    targetColor: '海军蓝',
    formulaName: '海军蓝首单配方',
    feedTotalQty: 18,
    feedUnit: 'kg',
    usageStatus: '待使用',
    lines: [
      { materialName: '活性蓝', materialCode: 'DYE-BLUE-01', feedQty: 10, feedUnit: 'kg' },
      { materialName: '固色剂', materialCode: 'AUX-FIX-01', feedQty: 8, feedUnit: 'kg' },
    ],
    remark: '首单样衣确认后投料',
  })
  addFormulaRecord({
    formulaId: 'DF-002',
    formulaNo: 'FORMULA-DYE-006',
    dyeOrderId: DYE_WORK_ORDER_IDS[5],
    dyeOrderNo: 'DY-20260328-006',
    taskId: 'TASK-DYE-000726',
    taskNo: 'TASK-DYE-000726',
    colorNo: 'C-612',
    rawMaterialSku: 'FAB-DYE-006',
    targetColor: '燕麦灰',
    formulaName: '燕麦灰标准配方',
    feedTotalQty: 20,
    feedUnit: 'kg',
    usageStatus: '已投料',
    lines: [
      { materialName: '分散灰', materialCode: 'DYE-GREY-03', feedQty: 13, feedUnit: 'kg' },
      { materialName: '匀染剂', materialCode: 'AUX-DYE-02', feedQty: 7, feedUnit: 'kg' },
    ],
    remark: '染缸执行中',
  })
  addFormulaRecord({
    formulaId: 'DF-003',
    formulaNo: 'FORMULA-DYE-009',
    dyeOrderId: DYE_WORK_ORDER_IDS[8],
    dyeOrderNo: 'DY-20260328-009',
    taskId: 'TASK-DYE-000729',
    taskNo: 'TASK-DYE-000729',
    colorNo: 'C-330',
    rawMaterialSku: 'FAB-DYE-009',
    targetColor: '豆沙粉',
    formulaName: '豆沙粉返单配方',
    feedTotalQty: 16,
    feedUnit: 'kg',
    usageStatus: '已复核',
    lines: [
      { materialName: '活性红', materialCode: 'DYE-RED-02', feedQty: 9, feedUnit: 'kg' },
      { materialName: '皂洗剂', materialCode: 'AUX-SOAP-01', feedQty: 7, feedUnit: 'kg' },
    ],
  })
  addFormulaRecord({
    formulaId: 'DF-004',
    formulaNo: 'FORMULA-DYE-010',
    dyeOrderId: DYE_WORK_ORDER_IDS[9],
    dyeOrderNo: 'DY-20260328-010',
    taskId: 'TASK-DYE-000730',
    taskNo: 'TASK-DYE-000730',
    colorNo: 'C-118',
    rawMaterialSku: 'FAB-DYE-010',
    targetColor: '灰绿',
    formulaName: '灰绿配方',
    feedTotalQty: 14,
    feedUnit: 'kg',
    usageStatus: '已复核',
    lines: [
      { materialName: '活性绿', materialCode: 'DYE-GREEN-05', feedQty: 8, feedUnit: 'kg' },
      { materialName: '稳定剂', materialCode: 'AUX-STABLE-02', feedQty: 6, feedUnit: 'kg' },
    ],
    remark: '收货差异后待复核',
  })
  addFormulaRecord({
    formulaId: 'DF-005',
    formulaNo: 'FORMULA-DYE-011',
    dyeOrderId: DYE_WORK_ORDER_IDS[10],
    dyeOrderNo: 'DY-20260328-011',
    taskId: 'TASK-DYE-000731',
    taskNo: 'TASK-DYE-000731',
    colorNo: 'C-552',
    rawMaterialSku: 'FAB-DYE-011',
    targetColor: '墨黑',
    formulaName: '墨黑成品配方',
    feedTotalQty: 24,
    feedUnit: 'kg',
    usageStatus: '已复核',
    lines: [
      { materialName: '活性黑', materialCode: 'DYE-BLACK-01', feedQty: 16, feedUnit: 'kg' },
      { materialName: '还原剂', materialCode: 'AUX-REDUCE-01', feedQty: 8, feedUnit: 'kg' },
    ],
    remark: '已全部交出',
  })
}

function buildFreshDyeMobileTask(input: {
  taskId: string
  taskNo?: string
  sourceType?: ProcessWorkOrderSourceType
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  spuCode?: string
  spuName?: string
  requiredDeliveryDate?: string
  factoryId: string
  factoryName: string
  qty: number
  qtyDisplayUnit: string
  processName?: string
  createdAt: string
  dispatchedBy: string
  receiveSummary: string
  executionSummary: string
  handoverSummary: string
}): PdaGenericTaskMock {
  const sourceType: ProcessWorkOrderSourceType = input.sourceType === 'STOCK' ? 'STOCK' : 'PRODUCTION_ORDER'
  const sourceOrder = input.productionOrderId
    ? productionOrders.find((order) => order.productionOrderId === input.productionOrderId)
    : undefined
  const hasFactory = Boolean(input.factoryId)
  const qtyUnit: QtyUnit = ['件', '片', '个', '套'].includes(input.qtyDisplayUnit)
    ? 'PIECE'
    : ['卷', '捆', '包', '打'].includes(input.qtyDisplayUnit)
      ? 'BUNDLE'
      : 'METER'
  return {
    taskId: input.taskId,
    taskNo: input.taskNo || input.taskId,
    sourceType,
    ...(sourceType === 'STOCK'
      ? { stockMaterialId: input.stockMaterialId, stockMaterialName: input.stockMaterialName }
      : {
          productionOrderId: input.productionOrderId,
          productionOrderNo: input.productionOrderNo || sourceOrder?.productionOrderNo || input.productionOrderId,
          sourceProductionOrderId: input.productionOrderId,
        }),
    spuCode: input.spuCode || sourceOrder?.demandSnapshot.spuCode || '',
    spuName: input.spuName || sourceOrder?.demandSnapshot.spuName || '',
    requiredDeliveryDate: input.requiredDeliveryDate || sourceOrder?.demandSnapshot.requiredDeliveryDate || '',
    seq: 1,
    processCode: 'PROC_DYE',
    processNameZh: input.processName || '染色',
    stage: 'PREP',
    qty: input.qty,
    qtyUnit,
    qtyDisplayUnit: input.qtyDisplayUnit,
    assignmentMode: 'DIRECT',
    assignmentStatus: hasFactory ? 'ASSIGNED' : 'UNASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['DYEING'] },
    assignedFactoryId: hasFactory ? input.factoryId : undefined,
    assignedFactoryName: hasFactory ? input.factoryName : '待分配工厂',
    qcPoints: [],
    attachments: [],
    status: 'NOT_STARTED',
    dispatchRemark: hasFactory ? '染色加工单已分配，待工厂接收。' : '正式生产单已生成加工单，待分配工厂。',
    dispatchedAt: hasFactory ? input.createdAt : undefined,
    dispatchedBy: hasFactory ? input.dispatchedBy : undefined,
    acceptanceStatus: hasFactory ? 'ACCEPTED' : 'PENDING',
    acceptedAt: hasFactory ? input.createdAt : undefined,
    acceptedBy: hasFactory ? input.factoryName : undefined,
    taskQrValue: buildTaskQrValue(input.taskId),
    taskQrStatus: 'ACTIVE',
    handoverStatus: 'NOT_CREATED',
    receiverKind: 'WAREHOUSE',
    receiverId: 'WH-TRANSFER',
    receiverName: '中转区域',
    stageCode: 'PREP',
    stageName: '准备阶段',
    processBusinessCode: 'DYE',
    processBusinessName: input.processName || '染色',
    mockProcessKey: 'DYEING',
    mockOrigin: hasFactory ? 'EXEC_NOT_STARTED' : 'DIRECT_PENDING',
    handoutStatus: 'PENDING',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    auditLogs: [],
    mockReceiveSummary: input.receiveSummary,
    mockExecutionSummary: input.executionSummary,
    mockHandoverSummary: input.handoverSummary,
  }
}

function seedPersistentWaterSolubleDyeWorkOrder(): void {
  const artifact = listGeneratedProductionDemandArtifacts()
    .find((item) => item.processCode === 'DYE' && item.requiresWaterSoluble && item.orderId === 'PO-202603-081')
  if (!artifact || workOrderStore.has('DYE-WATER-PO-202603-081')) return

  const taskId = 'TASK-DYE-WATER-PO-202603-081'
  const createdAt = '2026-03-26 09:00:00'
  registerPdaGenericProcessTask(buildFreshDyeMobileTask({
    taskId,
    productionOrderId: artifact.orderId,
    factoryId: TEST_FACTORY_ID,
    factoryName: TEST_FACTORY_NAME,
    qty: artifact.plannedQty,
    qtyDisplayUnit: artifact.plannedUnit || '米',
    createdAt,
    dispatchedBy: '平台派单',
    receiveSummary: '染色加工单已派单，需先完成水溶。',
    executionSummary: '同一染厂先水溶后染色，中间不交出。',
    handoverSummary: '完成染色及后处理后统一交出。',
  }))
  addSeedWorkOrder({
    dyeOrderId: 'DYE-WATER-PO-202603-081',
    dyeOrderNo: 'RSJG-WATER-202603081',
    sourceType: 'PRODUCTION_ORDER',
    sourceProductionOrderId: artifact.orderId,
    sourceProductionOrderNo: productionOrders.find((order) => order.productionOrderId === artifact.orderId)?.productionOrderNo || artifact.orderId,
    productionOrderOrderedAt: createdAt,
    sourceArtifactIds: [artifact.artifactId],
    productionOrderIds: [artifact.orderId],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    rawMaterialSku: `${artifact.materialCode || ''} ${artifact.materialName || '水溶染色物料'}`.trim(),
    targetColor: '按生产需求目标色执行',
    plannedQty: artifact.plannedQty,
    qtyUnit: artifact.plannedUnit || '米',
    requiresWaterSoluble: true,
    waterSolublePlannedQty: artifact.plannedQty,
    waterSolubleCompletedQty: 0,
    waterSolubleQtyUnit: artifact.plannedUnit || '米',
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WAREHOUSE-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_MATERIAL',
    taskId,
    taskNo: taskId,
    createdAt,
    updatedAt: createdAt,
    remark: '正式技术包 BOM 触发：同一染厂连续完成水溶与染色。',
  })
  createdDyeOrderIds.add('DYE-WATER-PO-202603-081')
}

function seedDomain(): void {
  if (seeded) return
  seeded = true
  seedWorkOrders()
  normalizeSeedWorkOrderSources()
  seedPersistentWaterSolubleDyeWorkOrder()
}

function getMutableWorkOrder(dyeOrderId: string): MutableDyeWorkOrder {
  syncDerivedWorkflow()
  const order = workOrderStore.get(dyeOrderId)
  if (!order) {
    throw new Error(`未找到染色加工单：${dyeOrderId}`)
  }
  return order
}

function getMutableNodeRecord(
  dyeOrderId: string,
  nodeCode: DyeExecutionNodeCode,
): MutableDyeExecutionNodeRecord | undefined {
  seedDomain()
  return (nodeRecordStore.get(dyeOrderId) ?? []).find((record) => record.nodeCode === nodeCode)
}

export function getDyeWorkOrderStatusLabel(status: DyeWorkOrderStatus): string {
  return DYE_WORK_ORDER_STATUS_LABEL[status]
}

export function getDyeCurrentStepLabel(order: DyeWorkOrder): string {
  if (
    order.requiresWaterSoluble
    && order.status === 'WAIT_VAT_PLAN'
    && getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')?.finishedAt
  ) return '待染色'
  return DYE_WORK_ORDER_STATUS_LABEL[order.status]
}

export function getDyeExecutionRoute(dyeOrderId: string): DyeExecutionNodeCode[] {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return []
  const route: DyeExecutionNodeCode[] = ['SAMPLE', 'MATERIAL_READY', 'VAT_PLAN']
  if (order.requiresWaterSoluble) route.push('WATER_SOLUBLE')
  return [...route, 'DYE', 'DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK']
}

export function getSampleWaitTypeLabel(type: SampleWaitType): string {
  return SAMPLE_WAIT_TYPE_LABEL[type]
}

export function getDyeReviewStatusLabel(status: DyeReviewStatus): string {
  return DYE_REVIEW_STATUS_LABEL[status]
}

export function listDyeWorkOrders(): DyeWorkOrder[] {
  syncDerivedWorkflow()
  return listGeneratedDyeWorkOrders().map((order) => cloneWorkOrder(order))
}

export function listCreatedDyeWorkOrders(): DyeWorkOrder[] {
  syncDerivedWorkflow()
  return Array.from(createdDyeOrderIds)
    .map((dyeOrderId) => workOrderStore.get(dyeOrderId))
    .filter((order): order is MutableDyeWorkOrder => Boolean(order))
    .map(cloneWorkOrder)
}

registerCreatedDyeWorkOrderReader(listCreatedDyeWorkOrders)

export function getDyeWorkOrderById(dyeOrderId: string): DyeWorkOrder | undefined {
  syncDerivedWorkflow()
  const canonical = workOrderStore.get(dyeOrderId)
  const order = listGeneratedDyeWorkOrders().find((item) => item.dyeOrderId === dyeOrderId)
  return order && canonical
    ? cloneWorkOrder({
        ...order,
        dyeOrderId: canonical.dyeOrderId,
        dyeOrderNo: canonical.dyeOrderNo,
        taskId: canonical.taskId,
        taskNo: canonical.taskNo,
      })
    : undefined
}

export function getDyeWorkOrderByTaskId(taskId: string): DyeWorkOrder | undefined {
  syncDerivedWorkflow()
  const canonical = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!canonical) return undefined
  const order = listGeneratedDyeWorkOrders().find((item) => item.dyeOrderId === canonical.dyeOrderId)
  return order
    ? cloneWorkOrder({
        ...order,
        dyeOrderId: canonical.dyeOrderId,
        dyeOrderNo: canonical.dyeOrderNo,
        taskId: canonical.taskId,
        taskNo: canonical.taskNo,
      })
    : undefined
}

export function registerFormalProductionOrderDyeWorkOrder(input: FormalProductionOrderProcessSnapshot & {
  workOrderId: string
  workOrderNo: string
  processName: string
  requiresWaterSoluble?: boolean
}): DyeWorkOrder {
  seedDomain()
  const existing = Array.from(workOrderStore.values())
    .find((order) => order.sourceProductionOrderId === input.productionOrderId)
  if (existing) return cloneWorkOrder(existing)

  const factoryId = input.factoryId || ''
  const factoryName = input.factoryName || '待分配工厂'
  registerPdaGenericProcessTask(buildFreshDyeMobileTask({
    taskId: input.workOrderId,
    taskNo: input.workOrderNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    spuCode: input.spuCode,
    spuName: input.spuName,
    requiredDeliveryDate: input.requiredDeliveryDate,
    factoryId,
    factoryName,
    qty: input.plannedQty,
    qtyDisplayUnit: input.qtyUnit,
    processName: input.processName,
    createdAt: input.orderedAt,
    dispatchedBy: '平台自动生成',
    receiveSummary: factoryId ? '染色加工单已分配，待工厂接收。' : '染色加工单待分配工厂。',
    executionSummary: `按${input.processName}执行。`,
    handoverSummary: '完成染色及后处理后统一交出。',
  }))
  addSeedWorkOrder({
    dyeOrderId: input.workOrderId,
    dyeOrderNo: input.workOrderNo,
    sourceType: 'PRODUCTION_ORDER',
    sourceProductionOrderId: input.productionOrderId,
    sourceProductionOrderNo: input.productionOrderNo,
    productionOrderOrderedAt: input.orderedAt,
    productionOrderIds: [input.productionOrderId],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    rawMaterialSku: input.materialId,
    composition: input.materialName,
    targetColor: input.targetColor,
    plannedQty: input.plannedQty,
    qtyUnit: input.qtyUnit,
    requiresWaterSoluble: input.requiresWaterSoluble === true,
    waterSolublePlannedQty: input.requiresWaterSoluble ? input.plannedQty : undefined,
    waterSolubleCompletedQty: input.requiresWaterSoluble ? 0 : undefined,
    waterSolubleQtyUnit: input.requiresWaterSoluble ? input.qtyUnit : undefined,
    dyeFactoryId: factoryId,
    dyeFactoryName: factoryName,
    targetTransferWarehouseId: 'WAREHOUSE-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_MATERIAL',
    taskId: input.workOrderId,
    taskNo: input.workOrderNo,
    createdAt: input.orderedAt,
    updatedAt: input.orderedAt,
    remark: `${input.processName}；来源正式生产单 ${input.productionOrderNo}；技术包 ${input.techPackVersionLabel}。`,
    formalProductionOrderSnapshot: {
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderNo,
      orderedAt: input.orderedAt,
      techPackVersionId: input.techPackVersionId,
      techPackVersionLabel: input.techPackVersionLabel,
      materialId: input.materialId,
      materialName: input.materialName,
      targetColor: input.targetColor,
      plannedQty: input.plannedQty,
      qtyUnit: input.qtyUnit,
      processCodes: [...input.processCodes],
      processName: input.processName,
      spuCode: input.spuCode,
      spuName: input.spuName,
      requiredDeliveryDate: input.requiredDeliveryDate,
    },
  })
  createdDyeOrderIds.add(input.workOrderId)
  return getDyeWorkOrderById(input.workOrderId)!
}

export function listDyeExecutionNodeRecords(dyeOrderId?: string): DyeExecutionNodeRecord[] {
  seedDomain()
  const visibleIds = getVisibleDyeWorkOrderIds()
  if (dyeOrderId) {
    if (!visibleIds.has(dyeOrderId)) return []
    return (nodeRecordStore.get(dyeOrderId) ?? []).map((record) => cloneNodeRecord(record))
  }
  return Array.from(visibleIds)
    .flatMap((visibleDyeOrderId) => nodeRecordStore.get(visibleDyeOrderId) ?? [])
    .map((record) => cloneNodeRecord(record))
}

export function getDyeExecutionNodeRecord(
  dyeOrderId: string,
  nodeCode: DyeExecutionNodeCode,
): DyeExecutionNodeRecord | undefined {
  const record = getMutableNodeRecord(dyeOrderId, nodeCode)
  return record ? cloneNodeRecord(record) : undefined
}

export function listDyeReviewRecords(): DyeReviewRecord[] {
  syncDerivedWorkflow()
  const visibleIds = getVisibleDyeWorkOrderIds()
  return Array.from(reviewRecordStore.values())
    .filter((record) => visibleIds.has(record.dyeOrderId))
    .sort((left, right) => left.dyeOrderId.localeCompare(right.dyeOrderId))
    .map((record) => cloneReviewRecord(record))
}

export function getDyeReviewRecordByOrderId(dyeOrderId: string): DyeReviewRecord | undefined {
  syncDerivedWorkflow()
  if (!getVisibleDyeWorkOrderIds().has(dyeOrderId)) return undefined
  const review = reviewRecordStore.get(dyeOrderId)
  return review ? cloneReviewRecord(review) : undefined
}

export function listDyeVatSchedules(): DyeVatSchedule[] {
  seedDomain()
  const visibleIds = getVisibleDyeWorkOrderIds()
  return Array.from(vatScheduleStore.values())
    .filter((schedule) => visibleIds.has(schedule.dyeOrderId))
    .sort((left, right) => left.plannedStartAt.localeCompare(right.plannedStartAt))
    .map((schedule) => cloneVatSchedule(schedule))
}

export function listDyeVatOptions(factoryId: string) {
  return listFactoryDyeVatCapacities(factoryId)
}

export function listDyeFormulaRecords(): DyeFormulaRecord[] {
  seedDomain()
  const visibleIds = getVisibleDyeWorkOrderIds()
  return Array.from(formulaStore.values())
    .filter((record) => visibleIds.has(record.dyeOrderId))
    .sort((left, right) => left.formulaNo.localeCompare(right.formulaNo))
    .map((record) => cloneFormulaRecord(record))
}

export function getDyeOrderHandoverHead(dyeOrderId: string): PdaHandoverHead | undefined {
  syncDerivedWorkflow()
  const order = workOrderStore.get(dyeOrderId)
  if (!order?.handoverOrderId) return undefined
  return getHandoverOrderById(order.handoverOrderId) ?? undefined
}

export function getDyeOrderHandoverRecords(dyeOrderId: string): PdaHandoverRecord[] {
  const head = getDyeOrderHandoverHead(dyeOrderId)
  if (!head) return []
  return getPdaHandoverRecordsByHead(head.handoverId)
}

export function getDyeOrderHandoverSummary(dyeOrderId: string): {
  recordCount: number
  pendingWritebackCount: number
  submittedQty: number
  writtenBackQty: number
  diffQty: number
  objectionCount: number
} {
  const head = getDyeOrderHandoverHead(dyeOrderId)
  return {
    recordCount: head?.recordCount ?? 0,
    pendingWritebackCount: head?.pendingWritebackCount ?? 0,
    submittedQty: head?.submittedQtyTotal ?? 0,
    writtenBackQty: head?.writtenBackQtyTotal ?? 0,
    diffQty: head?.diffQtyTotal ?? 0,
    objectionCount: head?.objectionCount ?? 0,
  }
}

export function getDyeWorkOrderSummary(): DyeWorkOrderSummary {
  syncDerivedWorkflow()
  const orders = Array.from(workOrderStore.values())
  const vatInUse = Array.from(vatScheduleStore.values()).filter((schedule) => schedule.status === 'IN_USE' || schedule.status === 'DONE')
  return {
    total: orders.length,
    waitSampleCount: orders.filter((order) => order.status === 'WAIT_SAMPLE').length,
    waitMaterialCount: orders.filter((order) => order.status === 'WAIT_MATERIAL').length,
    sampleTestingCount: orders.filter((order) => order.status === 'SAMPLE_TESTING').length,
    waitVatPlanCount: orders.filter((order) => order.status === 'WAIT_VAT_PLAN').length,
    dyeingCount: orders.filter((order) =>
      ['DYEING', 'DEHYDRATING', 'DRYING', 'SETTING', 'ROLLING', 'PACKING'].includes(order.status),
    ).length,
    waitHandoverCount: orders.filter((order) => order.status === 'WAIT_HANDOVER').length,
    waitReceiveCount: orders.filter((order) => order.status === 'HANDOVER_WAIT_RECEIVE').length,
    partialHandoverCount: orders.filter((order) => order.status === 'PARTIAL_HANDOVER' || order.status === 'WAIT_REVIEW').length,
    fullHandoverCount: orders.filter((order) => order.status === 'FULL_HANDOVER' || order.status === 'COMPLETED').length,
    handoverDifferenceCount: orders.filter((order) => order.status === 'HANDOVER_DIFFERENCE' || order.status === 'REJECTED').length,
    diffQty: orders.reduce((sum, order) => sum + Math.abs(getDyeOrderHandoverSummary(order.dyeOrderId).diffQty), 0),
    objectionCount: orders.reduce((sum, order) => sum + getDyeOrderHandoverSummary(order.dyeOrderId).objectionCount, 0),
    vatUtilizationCount: vatInUse.length,
  }
}

export function listDyeReportRows(): DyeReportRow[] {
  syncDerivedWorkflow()
  return listDyeWorkOrders().map((order) => {
    const handover = getDyeOrderHandoverSummary(order.dyeOrderId)
    return {
      dyeOrderId: order.dyeOrderId,
      dyeOrderNo: order.dyeOrderNo,
      taskId: order.taskId,
      taskNo: order.taskNo,
      currentNode: getCurrentNode(order),
      waitingReason: getWaitingReason(order),
      startedAt: order.sampleWaitStartedAt || getDyeExecutionNodeRecord(order.dyeOrderId, 'DYE')?.startedAt,
      finishedAt: order.status === 'FULL_HANDOVER' || order.status === 'COMPLETED'
        ? (getDyeReviewRecordByOrderId(order.dyeOrderId)?.reviewedAt || order.updatedAt)
        : undefined,
      durationHours: Number(getStatusDurationHours(order)),
      dyeVatNo: getCurrentDyeVatNo(order),
      plannedQty: order.plannedQty,
      outputQty: getCurrentOutputQty(order),
      diffQty: handover.diffQty,
      objectionCount: handover.objectionCount,
    }
  })
}

function hasActiveFactoryProcessAbility(factoryId: string, processCode: 'WATER_SOLUBLE' | 'DYE'): boolean {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory || factory.status !== 'active' || !factory.eligibility.allowDispatch) return false
  return factory.processAbilities.some((ability) =>
    ability.processCode === processCode
    && (ability.status ?? 'ACTIVE') === 'ACTIVE'
    && ability.canReceiveTask !== false,
  )
}

export function createDyeWorkOrderFromStock(input: {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  factoryId: string
  plannedFinishAt: string
  createdBy?: string
  plannedQty: number
  qtyUnit: string
  processName: string
  targetColor: string
  sampleWaitType?: SampleWaitType
}): { ok: boolean; message: string; order?: DyeWorkOrder } {
  const stockMaterialId = input.stockMaterialId.trim()
  const stockMaterial = getProcessWorkOrderStockMaterial(stockMaterialId)
  const stockMaterialName = input.stockMaterialName.trim()
  const materialSku = input.materialSku.trim()
  const normalizedUnit = input.qtyUnit.trim()
  const plannedFinishAt = input.plannedFinishAt.trim()
  if (!stockMaterial) return { ok: false, message: '请选择仓库中存在的备货物料。' }
  if (stockMaterial.factoryId !== input.factoryId) return { ok: false, message: '所选备货物料不属于当前染色工厂。' }
  if (stockMaterial.processCode !== 'DYE') return { ok: false, message: '所选备货物料不属于染色工序。' }
  if (stockMaterial.status !== '已入待加工仓' || stockMaterial.differenceQty !== 0) {
    return { ok: false, message: '所选备货物料尚未正常入待加工仓或存在待处理差异。' }
  }
  if (stockMaterial.stockMaterialName !== stockMaterialName || stockMaterial.materialSku !== materialSku) {
    return { ok: false, message: '备货物料名称或编码与仓库库存不一致，请重新选择。' }
  }
  if (stockMaterial.qtyUnit !== normalizedUnit) return { ok: false, message: '计划数量单位必须与仓库库存单位一致。' }
  if (!Number.isFinite(input.plannedQty) || input.plannedQty <= 0 || !normalizedUnit) {
    return { ok: false, message: '计划数量和单位必须有效。' }
  }
  if (input.plannedQty > stockMaterial.availableQty) {
    return { ok: false, message: `计划数量超过可用库存，当前最多可用 ${stockMaterial.availableQty} ${stockMaterial.qtyUnit}。` }
  }
  if (!isValidProcessWorkOrderPlannedFinishAt(plannedFinishAt)) return { ok: false, message: '请填写有效的计划完成时间。' }
  if (!input.processName.trim()) return { ok: false, message: '请填写染色工艺。' }
  if (!hasActiveFactoryProcessAbility(input.factoryId, 'DYE')) {
    return { ok: false, message: '所选工厂不可派单或缺少正式有效的染色能力。' }
  }
  const factory = getFactoryMasterRecordById(input.factoryId)!
  const sampleWaitType = input.sampleWaitType ?? 'NONE'
  const requiresSample = sampleWaitType !== 'NONE'
  const plannedQty = input.plannedQty
  const sequence = workOrderStore.size + createdDyeOrderIds.size + 1
  const dyeOrderId = `DYE-CREATED-${String(sequence).padStart(4, '0')}`
  const dyeOrderNo = `RSJG-CREATED-${String(sequence).padStart(4, '0')}`
  const taskId = `TASK-${dyeOrderId}`
  const now = nowTimestamp()
  registerPdaGenericProcessTask(buildFreshDyeMobileTask({
    taskId,
    sourceType: 'STOCK',
    stockMaterialId,
    stockMaterialName,
    spuName: stockMaterialName,
    factoryId: factory.id,
    factoryName: factory.name,
    qty: plannedQty,
    qtyDisplayUnit: normalizedUnit,
    createdAt: now,
    dispatchedBy: input.createdBy || '业务人员',
    processName: input.processName.trim(),
    receiveSummary: '备货染色加工单已派单。',
    executionSummary: `按${input.processName.trim()}执行。`,
    handoverSummary: '完成全部后处理后统一交出。',
  }))
  addSeedWorkOrder({
    dyeOrderId,
    dyeOrderNo,
    sourceType: 'STOCK',
    stockMaterialId,
    stockMaterialName,
    productionOrderIds: [],
    isFirstOrder: requiresSample,
    sampleWaitType,
    sampleStatus: requiresSample ? 'WAITING' : 'NOT_REQUIRED',
    sampleWaitStartedAt: requiresSample ? now : undefined,
    rawMaterialSku: materialSku,
    targetColor: input.targetColor.trim() || '按工艺要求执行',
    plannedQty,
    qtyUnit: normalizedUnit,
    plannedFinishAt,
    requiresWaterSoluble: false,
    dyeFactoryId: factory.id,
    dyeFactoryName: factory.name,
    targetTransferWarehouseId: 'WAREHOUSE-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: requiresSample ? 'WAIT_SAMPLE' : 'WAIT_MATERIAL',
    taskId,
    taskNo: taskId,
    createdAt: now,
    updatedAt: now,
    remark: `${input.processName.trim()}；按备货创建；创建人：${input.createdBy || '业务人员'}；计划完成：${plannedFinishAt}`,
  })
  createdDyeOrderIds.add(dyeOrderId)
  return { ok: true, message: '', order: getDyeWorkOrderById(dyeOrderId) }
}

export function validateDyeStartPrerequisite(
  dyeOrderId: string,
  inputQty: number,
): { ok: boolean; message: string } {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!Number.isFinite(inputQty) || inputQty <= 0) return { ok: false, message: '请填写有效的染色投入数量。' }
  if (!order.requiresWaterSoluble) return { ok: true, message: '' }
  const waterNode = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (!waterNode?.finishedAt || order.status === 'PRODUCTION_PAUSED') {
    return { ok: false, message: '请先完成水溶，再开始染色。' }
  }
  const completedQty = order.waterSolubleCompletedQty ?? Number(waterNode.outputQty || 0)
  if (inputQty > completedQty) {
    return { ok: false, message: '染色投入数量不能超过水溶完成数量。' }
  }
  return { ok: true, message: '' }
}

export function startDyeWaterSolubleNode(
  dyeOrderId: string,
  operatorName: string,
): { ok: boolean; message: string; order?: DyeWorkOrder; node?: DyeExecutionNodeRecord } {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!order.requiresWaterSoluble) return { ok: false, message: '普通染色加工单不需要水溶。' }
  if (order.isFirstOrder && order.sampleWaitType !== 'NONE') {
    const sampleNode = getDyeExecutionNodeRecord(dyeOrderId, 'SAMPLE')
    if (order.sampleStatus !== 'DONE' || !sampleNode?.finishedAt) {
      return { ok: false, message: '请先完成打样并确认色样，再开始水溶。' }
    }
  }
  const materialNode = getDyeExecutionNodeRecord(dyeOrderId, 'MATERIAL_READY')
  const vatNode = getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')
  if (!materialNode?.finishedAt || !vatNode?.finishedAt) {
    return { ok: false, message: '请先完成备料和染缸安排，再开始水溶。' }
  }
  const current = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (current?.finishedAt) return { ok: false, message: '水溶已完成，请勿重复开始。' }
  if (current?.startedAt) return { ok: false, message: '水溶已开始，请勿重复操作。' }
  const mutable = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, 'WATER_SOLUBLE', () => ({
    nodeRecordId: createNodeRecordId(dyeOrderId, 'WATER_SOLUBLE'),
    dyeOrderId,
    taskId: mutable.taskId,
    nodeCode: 'WATER_SOLUBLE',
    nodeName: DYE_NODE_LABEL.WATER_SOLUBLE,
    operatorUserId: 'USR-DYE',
    operatorName,
    startedAt: now,
    inputQty: mutable.waterSolublePlannedQty,
    outputQty: mutable.waterSolubleCompletedQty,
    qtyUnit: mutable.waterSolubleQtyUnit || mutable.qtyUnit,
    remark: '开始水溶',
  }))
  mutable.status = 'WATER_SOLUBLE_IN_PROGRESS'
  updateOrderTimestamp(mutable, now)
  syncWaterSolubleTaskState(mutable)
  return { ok: true, message: '', order: cloneWorkOrder(mutable), node: getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE') }
}

export function completeDyeWaterSolubleNode(
  dyeOrderId: string,
  outputQty: number,
  reason = '',
): { ok: boolean; message: string; order?: DyeWorkOrder; node?: DyeExecutionNodeRecord } {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  const current = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (!current?.startedAt || current.finishedAt) return { ok: false, message: '请先开始水溶，且不要重复完成。' }
  if (!Number.isFinite(outputQty) || outputQty < 0) return { ok: false, message: '水溶完成数量必须是大于或等于 0 的有效数字。' }
  const plannedQty = order.waterSolublePlannedQty ?? order.plannedQty
  const completedQty = order.waterSolubleCompletedQty ?? 0
  if (outputQty < completedQty) return { ok: false, message: '水溶累计完成数量不能小于已有完成数量。' }
  if (outputQty < plannedQty && !reason.trim()) return { ok: false, message: '水溶完成数量不足，请填写原因。' }
  if (outputQty > plannedQty && !reason.trim()) return { ok: false, message: '水溶完成数量超过计划数量，请填写原因。' }
  const mutable = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  mutable.waterSolubleCompletedQty = outputQty
  mutable.status = outputQty < plannedQty ? 'PRODUCTION_PAUSED' : 'WAIT_VAT_PLAN'
  upsertNodeRecord(dyeOrderId, 'WATER_SOLUBLE', () => ({
    ...current,
    finishedAt: now,
    outputQty,
    lossQty: plannedQty - outputQty,
    remark: outputQty < plannedQty ? `数量不足：${reason.trim()}` : (reason.trim() || '水溶完成，同厂继续染色'),
  }))
  updateOrderTimestamp(mutable, now)
  syncWaterSolubleTaskState(mutable)
  return { ok: true, message: '', order: cloneWorkOrder(mutable), node: getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE') }
}

export function resolveDyeWaterSolublePause(
  dyeOrderId: string,
  decision: DyeWaterSolublePauseDecision,
  supervisor: string,
): { ok: boolean; message: string; order?: DyeWorkOrder } {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!['CONTINUE_PROCESSING', 'CONTINUE_WITH_ACTUAL_QTY', 'RETURN_FOR_REWORK'].includes(decision)) {
    return { ok: false, message: '未知的主管处理决定，请重新选择。' }
  }
  if (order.status !== 'PRODUCTION_PAUSED') return { ok: false, message: '当前加工单不在生产暂停状态。' }
  const mutable = getMutableWorkOrder(dyeOrderId)
  const current = getMutableNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (decision === 'CONTINUE_WITH_ACTUAL_QTY') {
    if ((mutable.waterSolubleCompletedQty ?? 0) <= 0) {
      return { ok: false, message: '当前没有可投入染色的水溶完成数量。' }
    }
    mutable.status = 'WAIT_VAT_PLAN'
    mutable.remark = `${supervisor}确认按水溶实际完成数量继续染色`
  } else {
    if (decision === 'RETURN_FOR_REWORK') mutable.waterSolubleCompletedQty = 0
    mutable.status = 'WAIT_WATER_SOLUBLE'
    if (current) {
      current.startedAt = undefined
      current.finishedAt = undefined
      if (decision === 'RETURN_FOR_REWORK') current.outputQty = 0
      current.remark = decision === 'RETURN_FOR_REWORK' ? `${supervisor}退回返工` : `${supervisor}确认继续补做`
    }
  }
  updateOrderTimestamp(mutable)
  syncWaterSolubleTaskState(mutable)
  return { ok: true, message: '', order: cloneWorkOrder(mutable) }
}

export type DyeWaterSolublePdaActionInput =
  | { action: 'START'; dyeOrderId: string; taskId: string; expectedStatus: 'WAIT_WATER_SOLUBLE'; expectedNode: 'WATER_SOLUBLE'; actor: WaterSolublePdaActor }
  | { action: 'COMPLETE'; dyeOrderId: string; taskId: string; expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS'; expectedNode: 'WATER_SOLUBLE'; outputQty: number; reason: string; actor: WaterSolublePdaActor }
  | { action: 'RESOLVE_PAUSE'; dyeOrderId: string; taskId: string; expectedStatus: 'PRODUCTION_PAUSED'; expectedNode: 'WATER_SOLUBLE'; decision: DyeWaterSolublePauseDecision; actor: WaterSolublePdaActor }

export function executeDyeWaterSolublePdaAction(
  input: DyeWaterSolublePdaActionInput,
): { ok: boolean; message: string; order?: DyeWorkOrder; node?: DyeExecutionNodeRecord } {
  const order = getDyeWorkOrderById(input.dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!order.requiresWaterSoluble) return { ok: false, message: '普通染色加工单不需要水溶。' }
  if (order.taskId !== input.taskId) return { ok: false, message: '当前任务与染色加工单不一致，不能操作。' }
  if (input.expectedNode !== 'WATER_SOLUBLE' || !getDyeExecutionRoute(order.dyeOrderId).includes('WATER_SOLUBLE')) {
    return { ok: false, message: '当前步骤不是水溶，不能操作。' }
  }
  const roleAction = input.action === 'RESOLVE_PAUSE' ? 'SUPERVISE' : 'OPERATE'
  const actorError = validateWaterSolublePdaActor(input.actor, order.dyeFactoryId, roleAction)
  if (actorError) return { ok: false, message: actorError }
  if (order.status !== input.expectedStatus) {
    return { ok: false, message: `当前状态为“${getDyeWorkOrderStatusLabel(order.status)}”，此操作已经处理或已失效。` }
  }
  if (input.action === 'START') {
    const result = startDyeWaterSolubleNode(input.dyeOrderId, input.actor.userName)
    const node = getMutableNodeRecord(input.dyeOrderId, 'WATER_SOLUBLE')
    if (result.ok && node) node.operatorUserId = input.actor.userId
    return result.ok ? { ...result, node: getDyeExecutionNodeRecord(input.dyeOrderId, 'WATER_SOLUBLE') } : result
  }
  if (input.action === 'COMPLETE') {
    const result = completeDyeWaterSolubleNode(input.dyeOrderId, input.outputQty, input.reason)
    const node = getMutableNodeRecord(input.dyeOrderId, 'WATER_SOLUBLE')
    if (result.ok && node) {
      node.operatorUserId = input.actor.userId
      node.operatorName = input.actor.userName
    }
    return result.ok ? { ...result, node: getDyeExecutionNodeRecord(input.dyeOrderId, 'WATER_SOLUBLE') } : result
  }
  return resolveDyeWaterSolublePause(input.dyeOrderId, input.decision, input.actor.userName)
}

export function validateDyeStartPayload(input: { dyeVatNo?: string }): { ok: boolean; message?: string } {
  if (!input.dyeVatNo?.trim()) {
    return { ok: false, message: '请填写染缸编号' }
  }
  return { ok: true }
}

export function hasDirectPackingToReviewOrCompleteTransition(): boolean {
  return false
}

export function startDyeSampleWait(
  dyeOrderId: string,
  input: { waitType: SampleWaitType; operatorName?: string },
): DyeWorkOrder {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.sampleWaitType = input.waitType
  order.sampleStatus = order.isFirstOrder ? 'WAITING' : 'NOT_REQUIRED'
  order.sampleWaitStartedAt = order.sampleWaitStartedAt || now
  order.status = order.isFirstOrder ? 'WAIT_SAMPLE' : order.status
  order.waitingReason = getWaitingReason(order)
  order.remark = input.operatorName || order.remark
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)
}

export function completeDyeSampleWait(dyeOrderId: string, operatorName = '染色工厂'): DyeWorkOrder {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.sampleWaitFinishedAt = now
  order.waitingReason = '样衣/色样已到'
  order.remark = operatorName
  syncPreVatStatus(order)
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)
}

export function startDyeMaterialWait(dyeOrderId: string, operatorName = '染色工厂'): DyeWorkOrder {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.materialWaitStartedAt = order.materialWaitStartedAt || now
  order.status = 'WAIT_MATERIAL'
  order.waitingReason = '原料面料待到位'
  order.remark = operatorName
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)
}

export function completeDyeMaterialWait(dyeOrderId: string, operatorName = '染色工厂'): DyeWorkOrder {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.materialWaitFinishedAt = now
  order.waitingReason = '原料已到，可转备料'
  order.remark = operatorName
  syncPreVatStatus(order)
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)
}

export function startDyeSampleTest(dyeOrderId: string, operatorName = '染色工厂'): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.sampleStatus = 'TESTING'
  order.status = 'SAMPLE_TESTING'
  updateOrderTimestamp(order, now)
  upsertNodeRecord(dyeOrderId, 'SAMPLE', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'SAMPLE'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'SAMPLE',
    nodeName: DYE_NODE_LABEL.SAMPLE,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName,
    startedAt: current?.startedAt || now,
    finishedAt: current?.finishedAt,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark || '打样开始',
  }))
  return getDyeExecutionNodeRecord(dyeOrderId, 'SAMPLE')!
}

export function completeDyeSampleTest(
  dyeOrderId: string,
  input: { colorNo: string; operatorName?: string },
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  const current = getMutableNodeRecord(dyeOrderId, 'SAMPLE')
  order.sampleStatus = 'DONE'
  order.colorNo = input.colorNo.trim() || order.colorNo
  upsertNodeRecord(dyeOrderId, 'SAMPLE', () => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'SAMPLE'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'SAMPLE',
    nodeName: DYE_NODE_LABEL.SAMPLE,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName: input.operatorName || current?.operatorName || '染色工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    qtyUnit: getQtyUnit(order),
    remark: `色号已确认 ${order.colorNo || '—'}`,
  }))
  syncPreVatStatus(order)
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'SAMPLE')!
}

export function startDyeMaterialReady(dyeOrderId: string, operatorName = '染色工厂'): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, 'MATERIAL_READY', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'MATERIAL_READY'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'MATERIAL_READY',
    nodeName: DYE_NODE_LABEL.MATERIAL_READY,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName,
    startedAt: current?.startedAt || now,
    finishedAt: current?.finishedAt,
    inputQty: current?.inputQty || order.plannedQty,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark || '备料开始',
  }))
  order.status = 'WAIT_MATERIAL'
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'MATERIAL_READY')!
}

export function completeDyeMaterialReady(
  dyeOrderId: string,
  input: { outputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  const current = getMutableNodeRecord(dyeOrderId, 'MATERIAL_READY')
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, 'MATERIAL_READY', () => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'MATERIAL_READY'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'MATERIAL_READY',
    nodeName: DYE_NODE_LABEL.MATERIAL_READY,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName: input.operatorName || current?.operatorName || '染色工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    inputQty: current?.inputQty || order.plannedQty,
    outputQty: Number.isFinite(input.outputQty) ? Number(input.outputQty) : order.plannedQty,
    qtyUnit: getQtyUnit(order),
    remark: '备料完成',
  }))
  syncPreVatStatus(order)
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'MATERIAL_READY')!
}

export function planDyeVat(
  dyeOrderId: string,
  input: { dyeVatNo: string; operatorName?: string },
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status !== 'WAIT_VAT_PLAN') throw new Error('当前状态不允许排缸。')
  const materialNode = getMutableNodeRecord(dyeOrderId, 'MATERIAL_READY')
  if (!materialNode?.finishedAt) throw new Error('请先完成备料，再安排染缸。')
  if (order.sampleWaitType !== 'NONE' && order.sampleStatus !== 'DONE') throw new Error('请先完成打样，再安排染缸。')
  const existingVatNode = getMutableNodeRecord(dyeOrderId, 'VAT_PLAN')
  if (existingVatNode?.startedAt || existingVatNode?.finishedAt) throw new Error('染缸已安排，请勿重复排缸。')
  if (!input.dyeVatNo.trim()) throw new Error('请填写染缸编号。')
  const vat = listDyeVatOptions(order.dyeFactoryId).find((item) => item.dyeVatNo === input.dyeVatNo)
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, 'VAT_PLAN', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'VAT_PLAN'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'VAT_PLAN',
    nodeName: DYE_NODE_LABEL.VAT_PLAN,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName: input.operatorName || current?.operatorName || '染色工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    dyeVatId: vat?.dyeVatId,
    dyeVatNo: input.dyeVatNo.trim(),
    qtyUnit: getQtyUnit(order),
    remark: '已排染缸',
  }))
  order.status = order.requiresWaterSoluble ? 'WAIT_WATER_SOLUBLE' : 'WAIT_VAT_PLAN'
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')!
}

export function startDyeing(
  dyeOrderId: string,
  input: { dyeVatNo: string; inputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  const validation = validateDyeStartPayload(input)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
  const order = getMutableWorkOrder(dyeOrderId)
  const inputQty = Number.isFinite(input.inputQty) ? Number(input.inputQty) : order.plannedQty
  const prerequisite = validateDyeStartPrerequisite(dyeOrderId, inputQty)
  if (!prerequisite.ok) throw new Error(prerequisite.message)
  const existingDyeNode = getMutableNodeRecord(dyeOrderId, 'DYE')
  if (existingDyeNode?.startedAt) throw new Error('染色已经开始，请勿重复操作。')
  const vat = listDyeVatOptions(order.dyeFactoryId).find((item) => item.dyeVatNo === input.dyeVatNo)
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, 'DYE', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'DYE'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'DYE',
    nodeName: DYE_NODE_LABEL.DYE,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName: input.operatorName || current?.operatorName || '染色工厂',
    startedAt: current?.startedAt || now,
    finishedAt: current?.finishedAt,
    dyeVatId: vat?.dyeVatId,
    dyeVatNo: input.dyeVatNo.trim(),
    inputQty: current?.inputQty || inputQty,
    outputQty: current?.outputQty,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark || '染色开始',
  }))
  order.status = 'DYEING'
  syncLinkedTaskState(order.taskId, {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: getDyeingTaskById(order.taskId)?.startedAt || now,
    blockReason: undefined,
    blockRemark: undefined,
  })
  if (!order.handoverOrderId && !order.requiresWaterSoluble) {
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'DYE')!
}

export function completeDyeing(
  dyeOrderId: string,
  input: { inputQty?: number; outputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status !== 'DYEING') {
    throw new Error(`当前状态为“${DYE_WORK_ORDER_STATUS_LABEL[order.status]}”，不能重复完成染色。`)
  }
  const current = getMutableNodeRecord(dyeOrderId, 'DYE')
  if (!current?.startedAt) {
    throw new Error('请先开始染色，再确认完成。')
  }
  if (current.finishedAt) {
    throw new Error('染色已经完成，请勿重复操作。')
  }
  if (!current?.dyeVatNo?.trim()) {
    throw new Error('染色开始必须记录染缸编号')
  }
  const inputQty = order.requiresWaterSoluble
    ? Number(current.inputQty)
    : Number.isFinite(input.inputQty)
      ? Number(input.inputQty)
      : Number(current.inputQty || order.plannedQty)
  const outputQty = order.requiresWaterSoluble
    ? Number(input.outputQty)
    : Number.isFinite(input.outputQty)
      ? Number(input.outputQty)
      : Number(current.outputQty || order.plannedQty)
  if (order.requiresWaterSoluble) {
    if (!Number.isFinite(current.inputQty) || inputQty < 0) {
      throw new Error('染色节点缺少有效投入数量，请先重新确认染色投入。')
    }
    if (!Number.isFinite(input.outputQty) || outputQty < 0) {
      throw new Error('请输入大于或等于 0 的有效染色完成数量。')
    }
    if (outputQty > inputQty) {
      throw new Error(`染色完成数量不能超过真实投入 ${inputQty} ${getQtyUnit(order)}。`)
    }
  }
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, 'DYE', () => ({
    nodeRecordId: current.nodeRecordId,
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'DYE',
    nodeName: DYE_NODE_LABEL.DYE,
    operatorUserId: current.operatorUserId,
    operatorName: input.operatorName || current.operatorName || '染色工厂',
    startedAt: current.startedAt || now,
    finishedAt: now,
    dyeVatId: current.dyeVatId,
    dyeVatNo: current.dyeVatNo,
    inputQty,
    outputQty,
    lossQty: inputQty - outputQty,
    qtyUnit: getQtyUnit(order),
    remark: '染色完成，进入脱水',
  }))
  order.status = 'DEHYDRATING'
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'DYE')!
}

function getNodeStatusAfterStart(nodeCode: Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>): DyeWorkOrderStatus {
  switch (nodeCode) {
    case 'DEHYDRATE':
      return 'DEHYDRATING'
    case 'DRY':
      return 'DRYING'
    case 'SET':
      return 'SETTING'
    case 'ROLL':
      return 'ROLLING'
    case 'PACK':
      return 'PACKING'
    default:
      return 'DYEING'
  }
}

function getNodeStatusAfterComplete(nodeCode: Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>): DyeWorkOrderStatus {
  switch (nodeCode) {
    case 'DEHYDRATE':
      return 'DRYING'
    case 'DRY':
      return 'SETTING'
    case 'SET':
      return 'ROLLING'
    case 'ROLL':
      return 'PACKING'
    case 'PACK':
      return 'WAIT_HANDOVER'
    default:
      return 'DYEING'
  }
}

type DyePostNodeCode = Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>

const DYE_POST_NODE_PREDECESSOR: Record<
  DyePostNodeCode,
  Extract<DyeExecutionNodeCode, 'DYE' | 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL'>
> = {
  DEHYDRATE: 'DYE',
  DRY: 'DEHYDRATE',
  SET: 'DRY',
  ROLL: 'SET',
  PACK: 'ROLL',
}

const DYE_POST_NODE_EXPECTED_STATUS: Record<DyePostNodeCode, DyeWorkOrderStatus> = {
  DEHYDRATE: 'DEHYDRATING',
  DRY: 'DRYING',
  SET: 'SETTING',
  ROLL: 'ROLLING',
  PACK: 'PACKING',
}

function assertDyePostNodeReady(order: DyeWorkOrder, nodeCode: DyePostNodeCode): void {
  const expectedStatus = DYE_POST_NODE_EXPECTED_STATUS[nodeCode]
  if (order.status !== expectedStatus) {
    throw new Error(`当前状态为“${DYE_WORK_ORDER_STATUS_LABEL[order.status]}”，不能执行${DYE_NODE_LABEL[nodeCode]}。`)
  }
  const predecessor = DYE_POST_NODE_PREDECESSOR[nodeCode]
  if (!getMutableNodeRecord(order.dyeOrderId, predecessor)?.finishedAt) {
    throw new Error(`请先完成前序节点“${DYE_NODE_LABEL[predecessor]}”，再执行${DYE_NODE_LABEL[nodeCode]}。`)
  }
}

export function startDyeNode(
  dyeOrderId: string,
  nodeCode: Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>,
  operatorName = '染色工厂',
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  assertDyePostNodeReady(order, nodeCode)
  const current = getMutableNodeRecord(dyeOrderId, nodeCode)
  if (current?.startedAt || current?.finishedAt) {
    throw new Error(`${DYE_NODE_LABEL[nodeCode]}已经开始或完成，请勿重复操作。`)
  }
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, nodeCode, () => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, nodeCode),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode,
    nodeName: DYE_NODE_LABEL[nodeCode],
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName,
    startedAt: current?.startedAt || now,
    finishedAt: current?.finishedAt,
    outputQty: current?.outputQty,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark,
  }))
  order.status = getNodeStatusAfterStart(nodeCode)
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, nodeCode)!
}

export function completeDyeNode(
  dyeOrderId: string,
  nodeCode: Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>,
  input: { outputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  assertDyePostNodeReady(order, nodeCode)
  const current = getMutableNodeRecord(dyeOrderId, nodeCode)
  if (!current?.startedAt) {
    throw new Error(`请先开始${DYE_NODE_LABEL[nodeCode]}，再确认完成。`)
  }
  if (current.finishedAt) {
    throw new Error(`${DYE_NODE_LABEL[nodeCode]}已经完成，请勿重复操作。`)
  }
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, nodeCode, () => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, nodeCode),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode,
    nodeName: DYE_NODE_LABEL[nodeCode],
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName: input.operatorName || current?.operatorName || '染色工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    outputQty: Number.isFinite(input.outputQty) ? Number(input.outputQty) : current?.outputQty || order.plannedQty,
    qtyUnit: getQtyUnit(order),
    remark: nodeCode === 'PACK' ? '包装完成待交出' : `${DYE_NODE_LABEL[nodeCode]}完成`,
  }))
  order.status = getNodeStatusAfterComplete(nodeCode)
  if (nodeCode === 'PACK' && !order.handoverOrderId) {
    const task = getDyeingTaskById(order.taskId) as (PdaGenericTaskMock & { waterSolubleHandoverEligible?: boolean }) | undefined
    if (task && order.requiresWaterSoluble) task.waterSolubleHandoverEligible = true
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, nodeCode)!
}

export function submitDyeHandover(
  dyeOrderId: string,
  input: { handoverQty?: number; handoverPerson?: string; handoverAt?: string; remark?: string } = {},
): { handoverOrderId?: string; recordIds: string[] } {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status !== 'WAIT_HANDOVER') {
    throw new Error('请先完成染色及全部后处理，包装完成后再交出。')
  }
  const now = input.handoverAt || nowTimestamp()
  if (!order.handoverOrderId) {
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  const result = ensureSeededHandoverRecord({
    taskId: order.taskId,
    submittedQty: Number.isFinite(input.handoverQty) ? Number(input.handoverQty) : order.plannedQty,
    submittedAt: now,
  })
  order.handoverOrderId = result.handoverOrderId || order.handoverOrderId
  order.status = 'HANDOVER_WAIT_RECEIVE'
  order.remark = input.remark?.trim() || order.remark
  updateOrderTimestamp(order, now)
  syncDerivedWorkflow()
  return result
}

function getMutableDyeReceiptReview(dyeOrderId: string): { order: MutableDyeWorkOrder; review: MutableDyeReviewRecord } {
  const order = getMutableWorkOrder(dyeOrderId)
  let review = reviewRecordStore.get(dyeOrderId)
  if (!review) {
    const head = order.handoverOrderId
      ? getHandoverOrderById(order.handoverOrderId)
      : getPrimaryHandoverOrder(order.taskId)
    if (!head) {
      throw new Error('交出记录创建后才能确认收货')
    }
    review = syncReviewFromHandover(order, head)
  }
  return { order, review }
}

function applyDyeReceiptState(order: MutableDyeWorkOrder, review: MutableDyeReviewRecord): void {
  order.status = review.reviewStatus === 'WAIT_RECEIVE'
    ? 'HANDOVER_WAIT_RECEIVE'
    : review.reviewStatus === 'REJECTED'
      ? 'HANDOVER_DIFFERENCE'
      : review.reviewStatus
  if (review.reviewStatus === 'FULL_HANDOVER') {
    syncLinkedTaskState(order.taskId, {
      status: 'DONE',
      finishedAt: review.reviewedAt,
      blockReason: undefined,
      blockRemark: undefined,
    })
  } else if (review.reviewStatus === 'HANDOVER_DIFFERENCE' || review.reviewStatus === 'REJECTED') {
    syncLinkedTaskState(order.taskId, {
      status: 'BLOCKED',
      finishedAt: undefined,
      blockReason: 'QUALITY',
      blockRemark: review.rejectReason,
    })
  } else {
    syncLinkedTaskState(order.taskId, {
      status: 'IN_PROGRESS',
      finishedAt: undefined,
      blockReason: undefined,
      blockRemark: undefined,
    })
  }
}

export function confirmDyeReceipt(
  dyeOrderId: string,
  input: { receivedBy: string; receivedQty?: number; remark?: string },
): DyeReviewRecord {
  const { order, review } = getMutableDyeReceiptReview(dyeOrderId)
  const receivedQty = Number.isFinite(input.receivedQty) ? Number(input.receivedQty) : review.submittedQty
  review.receivedQty = receivedQty
  review.diffQty = Number((receivedQty - review.submittedQty).toFixed(2))
  review.reviewStatus = resolveDyeReceiptStatus({
    completedQty: getCurrentOutputQty(order) || order.plannedQty,
    submittedQty: review.submittedQty,
    receivedQty,
  })
  review.reviewedBy = input.receivedBy
  review.reviewedAt = nowTimestamp()
  review.rejectReason = undefined
  review.remark = input.remark?.trim() || (
    review.reviewStatus === 'WAIT_REVIEW'
      ? '接收方已回写，等待平台审核'
      : review.reviewStatus === 'PARTIAL_HANDOVER'
        ? '本次收货已确认，仍有未交出数量'
        : '本次收货已确认'
  )
  applyDyeReceiptState(order, review)
  updateOrderTimestamp(order, review.reviewedAt)
  return cloneReviewRecord(review)
}

export function markDyeReceiptDifference(
  dyeOrderId: string,
  input: { receivedBy: string; receivedQty?: number; differenceReason: string; remark?: string },
): DyeReviewRecord {
  if (!input.differenceReason.trim()) {
    throw new Error('请填写收货差异原因')
  }
  const { order, review } = getMutableDyeReceiptReview(dyeOrderId)
  const receivedQty = Number.isFinite(input.receivedQty) ? Number(input.receivedQty) : review.receivedQty
  review.receivedQty = receivedQty
  review.diffQty = Number((receivedQty - review.submittedQty).toFixed(2))
  review.reviewStatus = 'REJECTED'
  review.reviewedBy = input.receivedBy
  review.reviewedAt = nowTimestamp()
  review.rejectReason = input.differenceReason.trim()
  review.remark = input.remark?.trim() || '中转区域收货差异'
  applyDyeReceiptState(order, review)
  updateOrderTimestamp(order, review.reviewedAt)
  return cloneReviewRecord(review)
}

export function approveDyeReview(
  dyeOrderId: string,
  input: { reviewedBy: string; remark?: string },
): DyeReviewRecord {
  return confirmDyeReceipt(dyeOrderId, { receivedBy: input.reviewedBy, remark: input.remark })
}

export function rejectDyeReview(
  dyeOrderId: string,
  input: { reviewedBy: string; rejectReason: string; remark?: string },
): DyeReviewRecord {
  return markDyeReceiptDifference(dyeOrderId, {
    receivedBy: input.reviewedBy,
    differenceReason: input.rejectReason,
    remark: input.remark,
  })
}
