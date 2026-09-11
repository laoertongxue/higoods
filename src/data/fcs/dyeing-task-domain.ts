import {captureFactoryReceivingData,restoreFactoryReceivingData} from './factory-receiving.ts'
import {calculateYarnWeight,assertYarnShipment,type YarnTubeCounts,type YarnWeight} from './yarn-weight.ts'
import {listFactoryReceivingSources,registerFactoryReceivingSource,getFactoryReceivingSource} from './factory-receiving.ts'
import {RECEIVING_YARN_MATERIAL} from './factory-receiving-mock.ts'
import {getDyeFactoryReceiptProjection} from './factory-receiving-warehouse.ts'
import { DYE_DEMO_DETAILS } from './dye-work-order-demo-details.ts'
import { localDateTimeText } from '../../utils.ts'
import { listFactoryDyeVatCapacities } from './factory-capacity-profile-mock.ts'
import {
  capturePdaHandoverState,
  restorePdaHandoverState,
  persistPdaHandoverState,
  upsertPdaHandoverHeadMock,
  createFactoryHandoverRecord,
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  listPdaHandoverHeads,
  writeBackHandoverRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type HandoverReceiverKind,
} from './pda-handover-events.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask, unregisterPdaGenericProcessTask, type PdaGenericTaskMock } from './pda-task-mock-factory.ts'
import { type QtyUnit } from './process-tasks.ts'
import type {
  FormalProductionOrderProcessSnapshot,
  FormalProductionOrderProcessSnapshotRecord,
  ProcessWorkOrderAutoSyncRecord,
  ProcessWorkOrderChangeImpact,
  ProcessWorkOrderSourceSnapshot,
  ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import {
  deriveFormalProductionOrderMaterialFields,
  normalizeFormalProductionOrderMaterialItems,
} from './formal-production-order-material-items.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { DYE_INPUT_TRANSFER_FIXTURES } from './process-order-input-transfer-fixtures.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { selectPrimaryProductionMaterialBomItem } from './production-material-bom.ts'
import { getProcessWorkOrderStockMaterial, isValidProcessWorkOrderPlannedFinishAt } from './process-work-order-stock.ts'
import { resolveTerminalProcessOrderReceivingTarget } from './process-order-receiving-target.ts'
import {
  ensureProcessWorkOrders,
  registerProcessWorkOrderGenerationRegistrar,
} from './process-work-order-generation-registry.ts'
import { registerCreatedDyeWorkOrderReader } from './dyeing-created-work-order-registry.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { deriveFormalProductionOrderProcessSnapshots, getRestoredFormalProcessDefinitions } from './production-process-snapshot-derivation.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { listActiveProcessCraftDefinitions, type ProcessCraftDefinition } from './process-craft-dict.ts'
import {
  DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  getDictionaryCraftMockSource,
} from './production-artifact-generation.ts'
import {
  validateWaterSolublePdaActor,
  type WaterSolublePdaActor,
} from './water-soluble-pda-actor.ts'
import {
  getActiveCombinedDyeingMembership,
  getEffectiveDyeingFulfillment,
  getProductionChangeProtectedCombinedDyeingMembership,
  type CombinedDyeingSatisfaction,
  type ProductionChangeProtectedCombinedDyeingMembership,
} from './combined-dyeing-domain.ts'
import { registerCanonicalDyeWorkOrderReader } from './dye-work-order-canonical-registry.ts'

export type DyeWorkOrderStatus =
  | 'WAIT_SAMPLE'
  | 'WAIT_MATERIAL'
  | 'SAMPLE_TESTING'
  | 'SAMPLE_DONE'
  | 'INPUT_RECEIVED'
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
  | 'WAIT_MANUAL_COMPLETION'
  | 'COMPLETED'
  | 'REJECTED'

export type SampleWaitType = 'NONE' | 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD'
export type SampleStatus = 'NOT_REQUIRED' | 'WAITING' | 'TESTING' | 'DONE'
export type DyeExecutionNodeCode =
  | 'SAMPLE'
  | 'INPUT_RECEIVED'
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

export interface DyeOutputRoll {
  id: string
  barcode: string
  rollNo: string
  qty: number
  weightKg: number
  widthCm: number
  gsm: number
  vatNo: string
  remark: string
  createdAt: string
  printedAt?: string
  printedBy?: string
  warehouseName?: string
  locationName?: string
  inboundStatus?: '未入库' | '已入库'
  inboundAt?: string
  stagedAt?: string
  dispatchId?: string
}
export interface DyeDispatchDocument {
  id: string
  status: '草稿' | '已交出' | '已作废'
  createdAt: string
  operator: string
  handedOverAt?: string
  lines: { orderId: string; orderNo: string; taskNo: string; factoryName: string; receiver: string; sku: string; unit: string; rolls: DyeOutputRoll[] }[]
}
export interface DyeWorkOrder {
  yarnOrderedWeightKg?: number
  initialYarnReceipt?: YarnWeight
  initialYarnTransfer?: { documentNo: string; warehouseId: string; warehouseName: string; plannedNetKg: number; sentNetKg: number; status: string }
  nextOutputRollNo?: number
  outputRolls?: DyeOutputRoll[]
  dispatchDocuments?: DyeDispatchDocument[]
  dyeOrderId: string
  dyeOrderNo: string
  sourceType: ProcessWorkOrderSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  sourceKey?: string
  isReplenishment?: boolean
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
  completedWaterSolubleBatches?: DyeExecutionNodeRecord[]
  completedExecutionBatches?: DyeExecutionNodeRecord[][]
  materialReceipts?: Array<{ receiptId: string; upstreamRecordId?: string; qty: number; receiverName: string; receivedAt: string }>
  materialWaitStartedAt?: string
  materialWaitFinishedAt?: string
  colorNo?: string
  rawMaterialSku: string
  composition?: string
  width?: string
  weightGsm?: number
  targetColor: string
  materialId: string
  dyeProcessCode: 'DYE'
  dyeProcessName: string
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
  acceptanceStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  acceptedAt?: string
  acceptedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectionReason?: string
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
  documentCompletedBy?: string
  documentCompletedAt?: string
  formalProductionOrderSnapshot?: FormalProductionOrderProcessSnapshotRecord
  changeImpact?: ProcessWorkOrderChangeImpact[]
  autoSyncHistory?: ProcessWorkOrderAutoSyncRecord[]
  combinedDyeing?: DyeWorkOrderCombinedDyeingProjection
}

export interface DyeWorkOrderCombinedDyeingProjection {
  currentTaskId?: string
  currentTaskNo?: string
  effectiveSatisfiedQty: number
  remainingNeedQty: number
  satisfaction: CombinedDyeingSatisfaction
  occupiedByActiveTask: boolean
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
  INPUT_RECEIVED: '投入已接收',
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
  WAIT_MANUAL_COMPLETION: '待人工完成单据',
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
  INPUT_RECEIVED: '投入接收',
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

export interface DyeProcessMutationSnapshot {
  workOrders: Array<[string, MutableDyeWorkOrder]>
  nodeRecords: Array<[string, MutableDyeExecutionNodeRecord[]]>
  reviewRecords: Array<[string, MutableDyeReviewRecord]>
  vatSchedules: Array<[string, MutableDyeVatSchedule]>
  formulas: Array<[string, MutableDyeFormulaRecord]>
}

export function captureDyeProcessMutationState(): DyeProcessMutationSnapshot {
  return structuredClone({
    workOrders: Array.from(workOrderStore.entries()),
    nodeRecords: Array.from(nodeRecordStore.entries()),
    reviewRecords: Array.from(reviewRecordStore.entries()),
    vatSchedules: Array.from(vatScheduleStore.entries()),
    formulas: Array.from(formulaStore.entries()),
  })
}

export function restoreDyeProcessMutationState(snapshot: DyeProcessMutationSnapshot): void {
  const restored = structuredClone(snapshot)
  workOrderStore.clear()
  nodeRecordStore.clear()
  reviewRecordStore.clear()
  vatScheduleStore.clear()
  formulaStore.clear()
  restored.workOrders.forEach(([id, order]) => workOrderStore.set(id, order))
  restored.nodeRecords.forEach(([id, records]) => nodeRecordStore.set(id, records))
  restored.reviewRecords.forEach(([id, record]) => reviewRecordStore.set(id, record))
  restored.vatSchedules.forEach(([id, record]) => vatScheduleStore.set(id, record))
  restored.formulas.forEach(([id, record]) => formulaStore.set(id, record))
}

const DYE_EXECUTION_STORAGE_KEY = 'higoods.formal-dye-execution.v1'
let dyeMutationDepth = 0
let dyePersistenceReadError: string | null = null
const initialDyeOrderIds = new Set<string>()

function formalDyeIds(): Set<string> {
  return new Set(productionOrders.flatMap(order => (order.processWorkOrderDefinitions ?? [])
    .filter(definition => definition.processCode === 'DYE' && !initialDyeOrderIds.has(definition.workOrderId)).map(definition => definition.workOrderId)))
}

function saveFormalDyeExecution(): void {
  if (typeof localStorage === 'undefined') return
  const ids = formalDyeIds()
  const state = captureDyeProcessMutationState()
  state.workOrders = state.workOrders.filter(([id]) => ids.has(id))
  state.nodeRecords = state.nodeRecords.filter(([id]) => ids.has(id))
  state.reviewRecords = state.reviewRecords.filter(([id]) => ids.has(id))
  state.vatSchedules = state.vatSchedules.filter(([, item]) => ids.has(item.dyeOrderId || ''))
  state.formulas = state.formulas.filter(([, item]) => ids.has(item.dyeOrderId || ''))
  const tasks = state.workOrders.flatMap(([, order]) => {
    const task = getDyeingTaskById(order.taskId)
    return task ? [structuredClone(task)] : []
  })
  // Seeded production/handover events reset per session. Persist barcode fields only, never stale dispatch locks.
  const demoOutput = [...workOrderStore.values()].filter(order => initialDyeOrderIds.has(order.dyeOrderId)).map(order => ({id: order.dyeOrderId, outputRolls: order.outputRolls?.map(({dispatchId: _sessionDispatchId, ...roll}) => roll), nextOutputRollNo: order.nextOutputRollNo}))
  const value = JSON.stringify({ version: 1, state, tasks, demoOutput })
  localStorage.setItem(DYE_EXECUTION_STORAGE_KEY, value)
  if (localStorage.getItem(DYE_EXECUTION_STORAGE_KEY) !== value) throw new Error('染色保存结果未核实，请重试。')
}

function restoreFormalDyeExecution(): void {
  if (typeof localStorage === 'undefined') return
  let saved: { version: number; state: DyeProcessMutationSnapshot; tasks: PdaGenericTaskMock[]; demoOutput?: Array<{id: string; outputRolls?: DyeOutputRoll[]; nextOutputRollNo?: number}> }
  try {
    const raw = localStorage.getItem(DYE_EXECUTION_STORAGE_KEY)
    if (!raw) return
    saved = JSON.parse(raw)
    if (saved.version !== 1 || !Array.isArray(saved.tasks) || !saved.state || !['workOrders', 'nodeRecords', 'reviewRecords', 'vatSchedules', 'formulas'].every(key => Array.isArray(saved.state[key as keyof DyeProcessMutationSnapshot]))) throw new Error('染色记录格式不完整')
  } catch { dyePersistenceReadError = '已保存的染色记录无法读取，本次操作已阻断；请保留原数据并联系主管。'; return }
  if (['workOrders', 'nodeRecords', 'reviewRecords', 'vatSchedules', 'formulas'].some(key => saved.state[key as keyof DyeProcessMutationSnapshot].some((entry: unknown) => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !entry[1] || typeof entry[1] !== 'object'))) { dyePersistenceReadError = '已保存的染色记录格式不完整，不能覆盖，请联系主管。'; return }
  if (saved.demoOutput !== undefined) {
    if (!Array.isArray(saved.demoOutput) || saved.demoOutput.some(item => !item || !initialDyeOrderIds.has(item.id) || (item.nextOutputRollNo !== undefined && (!Number.isInteger(item.nextOutputRollNo) || item.nextOutputRollNo < 1)) || (item.outputRolls !== undefined && (!Array.isArray(item.outputRolls) || item.outputRolls.some(roll => !roll || !roll.id?.startsWith(item.id + '-') || !roll.barcode || [roll.qty,roll.weightKg,roll.widthCm,roll.gsm].some(n => !Number.isFinite(n) || n < 0)))))) { dyePersistenceReadError = '条码记录格式有误，请保留记录并联系主管。'; return }
    saved.demoOutput.forEach(item => {
      const order = workOrderStore.get(item.id)!
      order.outputRolls = item.outputRolls
      order.nextOutputRollNo = item.nextOutputRollNo
    })
  }
  const ids = formalDyeIds()
  for (const entry of saved.state.workOrders) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [id, order] = entry
    if (!ids.has(id)) continue
    const current = workOrderStore.get(id)
    if ( !current || !order || order.dyeOrderId !== id || order.taskId !== current.taskId || !order.sourceKey || order.sourceKey !== current.sourceKey || JSON.stringify(order.sourceSnapshot) !== JSON.stringify(current.sourceSnapshot) || order.qtyUnit !== current.qtyUnit || !Number.isFinite(order.plannedQty) || !(order.status in DYE_WORK_ORDER_STATUS_LABEL)) { dyePersistenceReadError = '已保存的染色记录与当前原单不一致，不能覆盖，请联系主管。'; continue }
    const nodes = saved.state.nodeRecords.find(item => Array.isArray(item) && item[0] === id)?.[1]
    if (!Array.isArray(nodes) || nodes.some(node => !node || node.dyeOrderId !== id || node.taskId !== order.taskId || typeof node.nodeCode !== 'string' || [node.inputQty, node.outputQty, node.lossQty].some(qty => qty !== undefined && (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0)))) { dyePersistenceReadError = '已保存的染色记录与当前原单不一致，不能覆盖，请联系主管。'; continue }
    if (order.completedWaterSolubleBatches !== undefined && (!Array.isArray(order.completedWaterSolubleBatches) || order.completedWaterSolubleBatches.some(node => !node || node.dyeOrderId !== id || node.taskId !== order.taskId || !node.finishedAt || !Number.isFinite(node.inputQty) || !Number.isFinite(node.outputQty)))) { dyePersistenceReadError = '已保存的染色记录与当前原单不一致，不能覆盖，请联系主管。'; continue }
    if (order.completedExecutionBatches !== undefined && (!Array.isArray(order.completedExecutionBatches) || order.completedExecutionBatches.some(batch => !Array.isArray(batch) || batch.some(node => !node || node.dyeOrderId !== id || node.taskId !== order.taskId)))) { dyePersistenceReadError = '已保存的染色记录与当前原单不一致，不能覆盖，请联系主管。'; continue }
    if (order.materialReceipts !== undefined && (!Array.isArray(order.materialReceipts) || order.materialReceipts.some(item => !item.receiptId || !Number.isFinite(item.qty) || item.qty < 0))) { dyePersistenceReadError = '已保存的染色记录与当前原单不一致，不能覆盖，请联系主管。'; continue }
    const task = saved.tasks.find(item => item && item.taskId === order.taskId && JSON.stringify(item.sourceSnapshot) === JSON.stringify(order.sourceSnapshot) && item.assignedFactoryId === (order.dyeFactoryId || undefined))
    if (!task) { dyePersistenceReadError = '已保存的染色记录与当前原单不一致，不能覆盖，请联系主管。'; continue }
    workOrderStore.set(id, structuredClone(order))
    nodeRecordStore.set(id, structuredClone(nodes))
    const review = saved.state.reviewRecords.find(item => Array.isArray(item) && item[0] === id)?.[1]
    if (review?.dyeOrderId === id) reviewRecordStore.set(id, structuredClone(review))
    for (const [key, value] of saved.state.vatSchedules) if (value?.dyeOrderId === id) vatScheduleStore.set(key, structuredClone(value))
    for (const [key, value] of saved.state.formulas) if (value?.dyeOrderId === id) formulaStore.set(key, structuredClone(value))
    registerPdaGenericProcessTask(structuredClone(task))
  }
}

export function runDyeProcessMutation<T>(action: () => T): T {
  if (dyeMutationDepth > 0) return action()
  seedDomain()
  if (dyePersistenceReadError) throw new Error(dyePersistenceReadError)
  const before = captureDyeProcessMutationState()
  const tasksBefore = Array.from(workOrderStore.values()).flatMap(order => {
    const task = getDyeingTaskById(order.taskId)
    return task ? [structuredClone(task)] : []
  })
  const receivingBefore = captureFactoryReceivingData()
  const handoverBefore = capturePdaHandoverState()
  const storedBefore = typeof localStorage === 'undefined' ? null : localStorage.getItem(DYE_EXECUTION_STORAGE_KEY)
  dyeMutationDepth += 1
  try {
    const result = action()
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) return result
    for (const order of workOrderStore.values()) {
      if (!formalDyeIds().has(order.dyeOrderId) || !order.handoverOrderId) continue
      const head = getHandoverOrderById(order.handoverOrderId)
      if (!head || head.taskId !== order.taskId || head.sourceSnapshot?.processEntryId !== order.sourceSnapshot?.processEntryId || (head.sourceDocId && head.sourceDocId !== order.dyeOrderId) || (head.sourceBusinessType && head.sourceBusinessType !== 'DYE_WORK_ORDER')) throw new Error('原交出单与染色加工单不一致，不能保存。')
      if (!head.sourceDocId || !head.sourceBusinessType) upsertPdaHandoverHeadMock({ ...head, sourceBusinessType: 'DYE_WORK_ORDER', sourceDocId: order.dyeOrderId, sourceDocNo: order.dyeOrderNo })
      persistPdaHandoverState({ handoverId: head.handoverId, taskId: order.taskId, productionOrderId: order.sourceSnapshot?.productionOrderId || '', sourceDocId: order.dyeOrderId, sourceBusinessType: 'DYE_WORK_ORDER' })
    }
    saveFormalDyeExecution()
    return result
  } catch (error) {
    restoreDyeProcessMutationState(before)
    tasksBefore.forEach(task => registerPdaGenericProcessTask(task))
    let rollbackFailed = false
    try { restoreFactoryReceivingData(receivingBefore) } catch { rollbackFailed = true }
    try { restorePdaHandoverState(handoverBefore) } catch { rollbackFailed = true }
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(DYE_EXECUTION_STORAGE_KEY) !== storedBefore) {
        if (storedBefore === null) localStorage.removeItem(DYE_EXECUTION_STORAGE_KEY)
        else localStorage.setItem(DYE_EXECUTION_STORAGE_KEY, storedBefore)
      }
    } catch { rollbackFailed = true }
    if (rollbackFailed) throw new Error('本次染色操作未保存，存储回退未核实，请保留当前页面并联系主管。')
    throw new Error(`本次染色操作未保存：${error instanceof Error ? error.message : '保存失败，请重试。'}`)
  } finally { dyeMutationDepth -= 1 }
}

const GENERATED_DYE_CRAFTS = listActiveProcessCraftDefinitions()
  .filter((definition) => definition.processCode === 'DYE' && definition.defaultDocType === 'PREPARATION_ORDER')

interface GeneratedDyeContext {
  productionOrder: ProductionOrder
  techPackSnapshot: ProductionOrderTechPackSnapshot
  craftDefinition: ProcessCraftDefinition
  mockIndex: number
  plannedQty: number
  materialName: string
  materialId: string
  composition: string
  targetColor: string
}

export function resolveDyeDemoMaterial(
  techPackSnapshot: Pick<ProductionOrderTechPackSnapshot, 'bomItems'>,
  fallbackMaterialName: string,
  fallbackColor?: string,
): { materialName: string; materialId: string; composition: string; targetColor: string } {
  const bomItem = selectPrimaryProductionMaterialBomItem(techPackSnapshot.bomItems)
  return {
    materialName: bomItem ? `${bomItem.name}${bomItem.spec ? ` / ${bomItem.spec}` : ''}` : fallbackMaterialName,
    materialId: bomItem?.id || '',
    composition: '',
    targetColor: bomItem?.colorLabel || fallbackColor || '按技术包配色',
  }
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
  const material = resolveDyeDemoMaterial(
    techPackSnapshot,
    productionOrder.demandSnapshot.spuName,
    productionOrder.demandSnapshot.skuLines[0]?.color,
  )
  return {
    productionOrder,
    techPackSnapshot,
    craftDefinition: generatedCraft.craftDefinition,
    mockIndex: generatedCraft.mockIndex,
    plannedQty: Math.max(1, Math.round(getProductionOrderQty(productionOrder) * 1.12)),
    materialName: material.materialName,
    materialId: material.materialId || `DYE-MATERIAL-${productionOrder.productionOrderId}`,
    composition: material.composition,
    targetColor: material.targetColor,
  }
}

function getGeneratedSeedPlannedQty(index: number, fallback: number): number {
  const generatedCount = GENERATED_DYE_CRAFTS.length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION
  const context = getGeneratedDyeContext(index) ?? (generatedCount > 0 ? getGeneratedDyeContext(index % generatedCount) : null)
  return context?.plannedQty ?? fallback
}

function scaleSeedQty(index: number, originalPlan: number, originalQty: number): number {
  return Number((originalQty * getGeneratedSeedPlannedQty(index, originalPlan) / originalPlan).toFixed(2))
}

function listVisibleRawDyeWorkOrders(): MutableDyeWorkOrder[] {
  const sorted = Array.from(workOrderStore.values()).sort((left, right) => left.dyeOrderNo.localeCompare(right.dyeOrderNo))
  const selected = new Map<string, MutableDyeWorkOrder>()
  for (const order of sorted.slice(0, DYE_WORK_ORDER_IDS.length)) {
    selected.set(order.dyeOrderId, order)
  }
  for (const order of sorted) {
    if (
      createdDyeOrderIds.has(order.dyeOrderId)
      || reviewRecordStore.has(order.dyeOrderId)
      || ['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'WAIT_REVIEW', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'HANDOVER_DIFFERENCE', 'WAIT_MANUAL_COMPLETION', 'COMPLETED', 'REJECTED'].includes(order.status)
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
  const { productionOrder, techPackSnapshot, craftDefinition, mockIndex, plannedQty, materialName, materialId, composition, targetColor } = context
  return {
    ...order,
    sourceType: 'PRODUCTION_ORDER',
    sourceProductionOrderId: productionOrder.productionOrderId,
    sourceProductionOrderNo: productionOrder.productionOrderNo,
    productionOrderOrderedAt: productionOrder.createdAt,
    productionOrderIds: [productionOrder.productionOrderId],
    isFirstOrder: mockIndex === 0,
    rawMaterialSku: materialName,
    materialId,
    composition: composition || order.composition,
    targetColor,
    dyeProcessCode: 'DYE',
    dyeProcessName: craftDefinition.craftName,
    colorNo: techPackSnapshot.sourceTechPackVersionCode || order.colorNo,
    plannedQty,
    plannedRollCount: Math.max(1, Math.ceil(plannedQty / 80)),
    // 染色开单时间独立于关联生产单日期，保留预设执行记录的时序。
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || productionOrder.updatedAt,
    remark: `${craftDefinition.craftName}；来源生产单 ${productionOrder.productionOrderNo}，技术包 ${techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel}。`,
  }
}

function listGeneratedDyeWorkOrders(): MutableDyeWorkOrder[] {
  return listVisibleRawDyeWorkOrders()
}

function syncDyeSeedReceivingTarget(order: MutableDyeWorkOrder): void {
  const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
    sourceType: order.sourceType,
    productionOrderNo: order.sourceProductionOrderNo || order.productionOrderIds?.[0],
    supplementRecordId: order.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: order.sourceSnapshot?.supplementRecordNo,
  })
  order.receiverKind = 'WAREHOUSE'
  order.receiverName = receivingTarget.targetName
  order.targetTransferWarehouseId = receivingTarget.targetWarehouseId
  order.targetTransferWarehouseName = receivingTarget.targetWarehouseName
  const task = getDyeingTaskById(order.taskId)
  if (task) {
    task.receiverKind = 'WAREHOUSE'
    task.receiverId = receivingTarget.targetBusinessId
    task.receiverName = receivingTarget.targetName
    registerPdaGenericProcessTask(task)
  }
  listHandoverOrdersByTaskId(order.taskId).forEach((head) => {
    upsertPdaHandoverHeadMock({
      ...head,
      targetName: receivingTarget.targetName,
      targetKind: 'WAREHOUSE',
      receiverKind: 'WAREHOUSE',
      receiverId: receivingTarget.targetBusinessId,
      receiverName: receivingTarget.targetName,
    })
  })
}

function normalizeSeedWorkOrderSources(): void {
  listVisibleRawDyeWorkOrders().forEach((order, index) => {
    if (createdDyeOrderIds.has(order.dyeOrderId) || order.sourceType === 'STOCK') {
      syncDyeSeedReceivingTarget(order)
      return
    }
    const originalPlannedQty = order.plannedQty
    const normalized = buildGeneratedDyeWorkOrder(order, index)
    workOrderStore.set(normalized.dyeOrderId, normalized)
    const scale = normalized.plannedQty / originalPlannedQty
    const records = nodeRecordStore.get(normalized.dyeOrderId)
    if (records && scale !== 1) {
      nodeRecordStore.set(normalized.dyeOrderId, records.map((record) => ({
        ...record,
        inputQty: typeof record.inputQty === 'number' ? Number((record.inputQty * scale).toFixed(2)) : undefined,
        outputQty: typeof record.outputQty === 'number' ? Number((record.outputQty * scale).toFixed(2)) : undefined,
        lossQty: typeof record.lossQty === 'number' ? Number((record.lossQty * scale).toFixed(2)) : undefined,
      })))
    }
    const task = getDyeingTaskById(normalized.taskId)
    if (!task) return
    task.sourceType = normalized.sourceType
    task.sourceSnapshot = normalized.sourceSnapshot ? structuredClone(normalized.sourceSnapshot) : undefined
    task.productionOrderId = normalized.sourceProductionOrderId
    task.productionOrderNo = normalized.sourceProductionOrderNo
    task.sourceProductionOrderId = normalized.sourceProductionOrderId
    task.stockMaterialId = normalized.stockMaterialId
    task.stockMaterialName = normalized.stockMaterialName
    registerPdaGenericProcessTask(task)
    syncDyeSeedReceivingTarget(normalized)
  })
}

function cloneWorkOrder(order: MutableDyeWorkOrder): DyeWorkOrder {
  const activeMembership = getActiveCombinedDyeingMembership(order.dyeOrderId)
  const fulfillment = getEffectiveDyeingFulfillment(order.dyeOrderId)
  const combinedDyeing = activeMembership || fulfillment.requiredQty > 0
    ? {
        currentTaskId: activeMembership?.taskId,
        currentTaskNo: activeMembership?.taskNo,
        effectiveSatisfiedQty: fulfillment.effectiveSatisfiedQty,
        remainingNeedQty: fulfillment.requiredQty > 0 ? fulfillment.remainingNeedQty : order.plannedQty,
        satisfaction: fulfillment.requiredQty > 0 ? fulfillment.satisfaction : 'UNMET' as const,
        occupiedByActiveTask: Boolean(activeMembership),
      }
    : undefined
  return {
    ...order,
    materialReceipts: order.materialReceipts?.map(item => ({ ...item })),
    completedWaterSolubleBatches: order.completedWaterSolubleBatches?.map(cloneNodeRecord),
    completedExecutionBatches: order.completedExecutionBatches?.map(batch => batch.map(cloneNodeRecord)),
    sourceSnapshot: order.sourceSnapshot ? structuredClone(order.sourceSnapshot) : undefined,
    sourceArtifactIds: order.sourceArtifactIds ? [...order.sourceArtifactIds] : undefined,
    productionOrderIds: order.productionOrderIds ? [...order.productionOrderIds] : undefined,
    formalProductionOrderSnapshot: order.formalProductionOrderSnapshot
      ? structuredClone(order.formalProductionOrderSnapshot)
      : undefined,
    changeImpact: order.changeImpact ? structuredClone(order.changeImpact) : undefined,
    autoSyncHistory: order.autoSyncHistory ? structuredClone(order.autoSyncHistory) : undefined,
    combinedDyeing,
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
  return localDateTimeText(date)
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
    task.status = task.startedAt ? 'IN_PROGRESS' : 'NOT_STARTED'
    task.acceptanceStatus = 'ACCEPTED'
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
  createNewBatch?: boolean
  submittedBy?: string
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
  if (existing.length === 0 || input.createNewBatch) {
    const workOrder = Array.from(workOrderStore.values()).find((order) => order.taskId === input.taskId)
    const material = workOrder?.formalProductionOrderSnapshot?.materialItems?.find(item => item.materialId === workOrder.rawMaterialSku && (!workOrder.sourceSnapshot?.bomItemId || item.sourceBomItemId === workOrder.sourceSnapshot.bomItemId))
    const materialType = material?.materialType?.trim()
    const isFabricMaterial = workOrder?.yarnOrderedWeightKg === undefined && (!materialType || materialType === 'FABRIC' || materialType.includes('面料'))
    createFactoryHandoverRecord({
      handoverOrderId,
      submittedQty: input.submittedQty,
      qtyUnit: head.qtyUnit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: input.submittedBy?.trim() || '染色工厂',
      materialCode: workOrder?.rawMaterialSku,
      materialName: material?.materialName || workOrder?.stockMaterialName,
      skuCode: workOrder?.rawMaterialSku,
      skuColor: workOrder?.targetColor,
      handoutObjectType: isFabricMaterial ? 'FABRIC' : 'MATERIAL',
      factoryRemark: `染色${materialType || '面料'}交给${head.receiverName || head.targetName}`,
      objectType: isFabricMaterial ? 'FABRIC' : 'MATERIAL',
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
      handoverRecordId: firstRecord.handoverRecordId || firstRecord.recordId || '',
      receiverWrittenQty: input.receiverWrittenQty,
      receiverWrittenAt: input.receiverWrittenAt,
      receiverWrittenBy: head.receiverName || head.targetName,
      receiverRemark: input.receiverRemark,
      diffReason: input.diffReason,
    })
  }

  const nextRecords = getPdaHandoverRecordsByHead(head.handoverId)
  return {
    handoverOrderId,
    recordIds: nextRecords.flatMap((record) => record.handoverRecordId ? [record.handoverRecordId] : []),
  }
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
      return '等待投入接收'
    case 'INPUT_RECEIVED':
      return '投入已接收，等待打样确认'
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
    case 'WAIT_MANUAL_COMPLETION':
      return '全部产出已收货，待人工完成单据'
    case 'COMPLETED':
      return '加工单已完成'
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
  return [...(order.completedExecutionBatches ?? []).flat(), ...nodes].filter(node => node.nodeCode === 'PACK' && node.finishedAt).reduce((total, node) => total + (node.outputQty ?? 0), 0)
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
  const receivedRecords = records.filter(record => record.handoverRecordStatus !== 'VOIDED' && record.receiverWrittenAt && record.receiverWrittenQty !== undefined)
  const receivedQty = receivedRecords.reduce((sum, record) => sum + Number(record.receiverWrittenQty), 0)
  const diffQty = receivedRecords.reduce((sum, record) => sum + Number(record.receiverWrittenQty) - Number(record.submittedQty ?? record.plannedQty ?? 0), 0)
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
    handoverRecordIds: records.flatMap((record) => record.handoverRecordId ? [record.handoverRecordId] : []),
    receiverName: order.targetTransferWarehouseName,
    submittedQty,
    receivedQty,
    diffQty,
    receivedRollCount: undefined,
    receivedLength: receivedRecords.length > 0 && ['米', 'm', 'M'].includes(head.qtyUnit) ? receivedQty : undefined,
    lengthUnit: receivedRecords.length > 0 && ['米', 'm', 'M'].includes(head.qtyUnit) ? '米' : undefined,
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
  {
    current.receivedQty = next.receivedQty
    current.diffQty = next.diffQty
    if (!current.reviewedAt || !current.reviewedBy) {
      current.receivedRollCount = next.receivedRollCount
      current.receivedLength = next.receivedLength
      current.lengthUnit = next.lengthUnit
    } else {
      current.receivedRollCount ??= next.receivedRollCount
      current.receivedLength ??= next.receivedLength
      current.lengthUnit ??= next.lengthUnit
    }
    if (current.reviewStatus !== 'REJECTED') current.reviewStatus = next.reviewStatus
    current.remark = current.remark || next.remark
  }
  return current
}

function syncDyeOrderFromReview(order: MutableDyeWorkOrder, review?: MutableDyeReviewRecord): boolean {
  if (!review) return false
  if (order.status === 'COMPLETED') return true
  if (order.completedWaterSolubleBatches?.length && ['WAIT_WATER_SOLUBLE', 'WATER_SOLUBLE_IN_PROGRESS', 'PRODUCTION_PAUSED', 'WAIT_VAT_PLAN'].includes(order.status)) return false
  if (order.completedExecutionBatches?.length && ['DYEING', 'DEHYDRATING', 'DRYING', 'SETTING', 'ROLLING', 'PACKING', 'WAIT_HANDOVER'].includes(order.status)) return false
  if (review.reviewStatus === 'WAIT_RECEIVE') {
    order.status = 'HANDOVER_WAIT_RECEIVE'
  } else if (review.reviewStatus === 'REJECTED') {
    order.status = 'HANDOVER_DIFFERENCE'
  } else if (review.reviewStatus === 'FULL_HANDOVER') {
    order.status = 'WAIT_MANUAL_COMPLETION'
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
    || order.status === 'WAIT_REVIEW'
    || order.status === 'PARTIAL_HANDOVER'
    || order.status === 'FULL_HANDOVER'
    || order.status === 'HANDOVER_DIFFERENCE'
    || order.status === 'WAIT_MANUAL_COMPLETION'
    || order.status === 'COMPLETED'
    || order.status === 'REJECTED'
    || order.status === 'WAIT_WATER_SOLUBLE'
    || order.status === 'WATER_SOLUBLE_IN_PROGRESS'
    || order.status === 'PRODUCTION_PAUSED'
  ) {
    return
  }

  const materialReadyNode = getDyeExecutionNodeRecord(order.dyeOrderId, 'INPUT_RECEIVED')
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
    order.status = 'INPUT_RECEIVED'
    return
  }
  if (order.materialWaitFinishedAt) {
    order.status = 'WAIT_MATERIAL'
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

  const handoutHeads = listPdaHandoverHeads().filter(head => head.headType === 'HANDOUT')
  for (const order of workOrderStore.values()) {
    const receipts = getDyeFactoryReceiptProjection(order.dyeOrderId, order.qtyUnit)
    if (receipts.length) {
      order.materialReceipts = [...(order.materialReceipts ?? []).filter(r => !r.receiptId.startsWith('FRP-')), ...receipts]
      const total = order.materialReceipts.reduce((n, r) => n + r.qty, 0)
      if (total > 0) {
        const nodes = nodeRecordStore.get(order.dyeOrderId) ?? []
        const old = nodes.find(n => n.nodeCode === 'INPUT_RECEIVED')
        const latest = receipts.at(-1)!
        const node: MutableDyeExecutionNodeRecord = {...old, nodeRecordId: old?.nodeRecordId || `FRP-${order.dyeOrderId}`, dyeOrderId: order.dyeOrderId, taskId: order.taskId, nodeCode: 'INPUT_RECEIVED', nodeName: '接收原料', operatorUserId: 'FACTORY-RECEIVER', operatorName: latest.receiverName, finishedAt: latest.receivedAt, inputQty: total, outputQty: total, qtyUnit: getQtyUnit(order), remark: '按工厂实收记录汇总；接收不代表开工'}
        nodeRecordStore.set(order.dyeOrderId, [...nodes.filter(n => n.nodeCode !== 'INPUT_RECEIVED'), node])
      }
    }
    const head = order.handoverOrderId
      ? handoutHeads.find(head => (head.handoverOrderId || head.handoverId) === order.handoverOrderId)
      : handoutHeads.find(head => head.taskId === order.taskId)
    if (head) {
      order.handoverOrderId = head.handoverOrderId || head.handoverId
      order.handoverOrderNo = head.handoverOrderNo
      syncTaskHandoverFields(order.taskId, order.handoverOrderId)
    } else if (!order.handoverOrderId && order.status === 'WAIT_HANDOVER') {
      const ensured = ensureStartedTaskHandover(order.taskId)
      if (ensured) {
        const nextHead = getHandoverOrderById(ensured)
        order.handoverOrderId = ensured
        order.handoverOrderNo = nextHead?.handoverOrderNo
      }
    }

    if (order.yarnOrderedWeightKg !== undefined && order.status !== 'COMPLETED') {
      const shipped=listFactoryReceivingSources(undefined,true).filter(s=>s.workOrderNo===order.dyeOrderNo&&s.type==='HANDOUT'&&!s.voidedAt).reduce((n,s)=>n+s.lines.reduce((m,l)=>m+(l.yarn?.netGrams||0)/1000,0),0)
      order.status=shipped<=0?'WAIT_HANDOVER':shipped+0.000001<getCurrentOutputQty(order)?'PARTIAL_HANDOVER':'HANDOVER_WAIT_RECEIVE'
      continue
    }

    if (head && reviewRecordStore.get(order.dyeOrderId)?.reviewStatus !== 'REJECTED' && getPdaHandoverRecordsByHead(head.handoverId).some(record => record.taskReceipts?.length)) {
      const current = createReviewFromHandover(order, head)
      current.reviewedAt = getPdaHandoverRecordsByHead(head.handoverId).map(record => record.receiverWrittenAt || '').sort().at(-1)
      reviewRecordStore.set(order.dyeOrderId, current)
      syncDyeOrderFromReview(order, current)
      continue
    }

    const review = head && (head.recordCount ?? 0) > 0
      ? syncReviewFromHandover(order, head)
      : reviewRecordStore.get(order.dyeOrderId)
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
  | 'dyeProcessCode'
  | 'dyeProcessName'
  | 'combinedDyeing'
  | 'materialId'
  | 'targetTransferWarehouseId'
  | 'targetTransferWarehouseName'
> & {
  dispatchPrice?: number
  requiresWaterSoluble?: boolean
  waterSolublePlannedQty?: number
  waterSolubleCompletedQty?: number
  waterSolubleQtyUnit?: string
  dyeProcessCode?: 'DYE'
  dyeProcessName?: string
  materialId?: string
}): void {
  const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
    sourceType: input.sourceType,
    productionOrderNo: input.sourceProductionOrderNo || input.productionOrderIds?.[0],
    supplementRecordId: input.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: input.sourceSnapshot?.supplementRecordNo,
  })
  let task = getDyeingTaskById(input.taskId)
  if (!task) {
    task = buildFreshDyeMobileTask({
      taskId: input.taskId,
      taskNo: input.taskNo,
      sourceType: input.sourceType,
      sourceSnapshot: input.sourceSnapshot,
      productionOrderId: input.sourceProductionOrderId || input.productionOrderIds?.[0],
      productionOrderNo: input.sourceProductionOrderNo,
      stockMaterialId: input.stockMaterialId,
      stockMaterialName: input.stockMaterialName,
      spuCode: input.rawMaterialSku,
      spuName: `${input.targetColor}染色`,
      factoryId: input.dyeFactoryId,
      factoryName: input.dyeFactoryName,
      qty: input.plannedQty,
      qtyDisplayUnit: input.qtyUnit,
      processName: input.dyeProcessName || '染色',
      createdAt: input.createdAt,
      dispatchedBy: '平台派单',
      receiveSummary: input.dyeFactoryId ? '染色加工单已分配，待工厂接单。' : '染色加工单待分配工厂。',
      executionSummary: '按染色加工单当前节点执行。',
      handoverSummary: '完成染色及后处理后统一交出。',
    })
    registerPdaGenericProcessTask(task)
  }
  const handoverOrder = input.handoverOrderId ? getHandoverOrderById(input.handoverOrderId) : getPrimaryHandoverOrder(input.taskId)
  if (task) {
    const hasFactory = Boolean(input.dyeFactoryId)
    const executionStarted = [
      'WATER_SOLUBLE_IN_PROGRESS', 'PRODUCTION_PAUSED', 'DYEING', 'DEHYDRATING', 'DRYING',
      'SETTING', 'ROLLING', 'PACKING', 'WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'WAIT_REVIEW',
      'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'HANDOVER_DIFFERENCE', 'WAIT_MANUAL_COMPLETION', 'COMPLETED', 'REJECTED',
    ].includes(input.status)
    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = hasFactory ? 'ASSIGNED' : 'UNASSIGNED'
    task.acceptanceStatus = hasFactory && executionStarted ? 'ACCEPTED' : 'PENDING'
    if (task.acceptanceStatus === 'PENDING') {
      task.acceptedAt = undefined
      task.acceptedBy = undefined
    }
    task.assignedFactoryId = hasFactory ? input.dyeFactoryId : undefined
    task.assignedFactoryName = hasFactory ? input.dyeFactoryName : '待分配工厂'
    task.tenderId = undefined
    task.awardedAt = undefined
    task.dispatchedBy = hasFactory ? '平台派单' : undefined
    task.dispatchRemark = hasFactory ? '染色加工单已分配，待工厂接单。' : '正式生产单已生成加工单，待分配工厂。'
    task.dispatchPrice = input.dispatchPrice ?? 1500
    task.dispatchPriceCurrency = 'IDR'
    task.dispatchPriceUnit = 'Yard'
    task.standardPriceCurrency = 'IDR'
    task.standardPriceUnit = 'Yard'
    task.mockOrigin = task.acceptanceStatus === 'PENDING' ? 'DIRECT_PENDING' : 'DIRECT_ASSIGNED_EXECUTION'
    task.mockReceiveSummary = task.acceptanceStatus === 'PENDING' ? '染色加工单已分配，待工厂接单。' : '染色加工单已接单。'
    task.sourceType = input.sourceType
    task.productionOrderId = input.sourceType !== 'STOCK' ? input.sourceProductionOrderId || input.productionOrderIds?.[0] : undefined
    task.productionOrderNo = input.sourceType !== 'STOCK' ? input.sourceProductionOrderNo : undefined
    task.sourceProductionOrderId = task.productionOrderId
    task.sourceSnapshot = input.sourceSnapshot ? structuredClone(input.sourceSnapshot) : undefined
    task.stockMaterialId = input.sourceType === 'STOCK' ? input.stockMaterialId : undefined
    task.stockMaterialName = input.sourceType === 'STOCK' ? input.stockMaterialName : undefined
    task.receiverKind = 'WAREHOUSE'
    task.receiverId = receivingTarget.targetBusinessId
    task.receiverName = receivingTarget.targetName
  }

  workOrderStore.set(input.dyeOrderId, {
    ...input,
    materialId: input.materialId?.trim() || input.rawMaterialSku.trim(),
    dyeProcessCode: input.dyeProcessCode ?? 'DYE',
    dyeProcessName: input.dyeProcessName?.trim() || input.formalProductionOrderSnapshot?.processName || '普通染色',
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
    targetTransferWarehouseId: receivingTarget.targetWarehouseId,
    targetTransferWarehouseName: receivingTarget.targetWarehouseName,
    receiverKind: 'WAREHOUSE',
    receiverName: receivingTarget.targetName,
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
  const waitReceiveSubmittedQty = scaleSeedQty(7, 910, 910)
  const partialSubmittedQty = scaleSeedQty(8, 980, 980)
  const partialReceivedQty = scaleSeedQty(8, 980, 900)
  const cancelledSubmittedQty = scaleSeedQty(9, 860, 860)
  const cancelledReceivedQty = scaleSeedQty(9, 860, 842)
  const completedSubmittedQty = scaleSeedQty(10, 1180, 1172)
  const partialTaskId = 'TASK-DYE-000734'
  const seededExecutionProjections = [
    { taskId: 'TASK-DYE-000727', productionOrderId: 'PO-20260328-414', qty: 1100, createdAt: '2026-03-28 10:10:00' },
    { taskId: 'TASK-DYE-000728', productionOrderId: 'PO-20260328-415', qty: 910, createdAt: '2026-03-28 10:50:00' },
    { taskId: partialTaskId, productionOrderId: 'PO-20260328-416', qty: 980, createdAt: '2026-03-27 14:50:00' },
    { taskId: 'TASK-DYE-000730', productionOrderId: 'PO-20260328-417', qty: 860, createdAt: '2026-03-27 15:00:00' },
    { taskId: 'TASK-DYE-000731', productionOrderId: 'PO-20260328-418', qty: 1180, createdAt: '2026-03-28 07:00:00' },
  ]
  seededExecutionProjections.forEach((projection) => {
    if (getDyeingTaskById(projection.taskId)) return
    registerPdaGenericProcessTask(buildFreshDyeMobileTask({
      ...projection,
      taskNo: projection.taskId,
      factoryId: TEST_FACTORY_ID,
      factoryName: TEST_FACTORY_NAME,
      qtyDisplayUnit: '米',
      processName: '染色',
      dispatchedBy: '平台加工单',
      receiveSummary: '染色加工单已分配，待工厂接收。',
      executionSummary: '按染色加工单当前节点执行。',
      handoverSummary: '完成染色及后处理后统一交出。',
    }))
  })

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
  syncLinkedTaskState(partialTaskId, {
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
    blockRemark: '指定接收方收货差异',
  })
  syncLinkedTaskState('TASK-DYE-000731', {
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-28 08:20:00',
    finishedAt: '2026-03-29 18:10:00',
  })

  const orderWaitReview = ensureSeededHandoverRecord({
    taskId: partialTaskId,
    submittedQty: partialSubmittedQty,
    receiverWrittenQty: partialReceivedQty,
    submittedAt: '2026-03-28 18:10:00',
    receiverWrittenAt: '2026-03-28 20:40:00',
    diffReason: `接收方复核少 ${Number((partialSubmittedQty - partialReceivedQty).toFixed(2))} 米`,
  })
  const orderRejected = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000730',
    submittedQty: cancelledSubmittedQty,
    receiverWrittenQty: cancelledReceivedQty,
    submittedAt: '2026-03-28 16:00:00',
    receiverWrittenAt: '2026-03-28 19:30:00',
    diffReason: '卷数和长度复核不一致',
  })
  const orderCompleted = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000731',
    submittedQty: completedSubmittedQty,
    receiverWrittenQty: completedSubmittedQty,
    submittedAt: '2026-03-29 16:20:00',
    receiverWrittenAt: '2026-03-29 17:10:00',
  })
  const orderSubmitted = ensureSeededHandoverRecord({
    taskId: 'TASK-DYE-000728',
    submittedQty: waitReceiveSubmittedQty,
    submittedAt: '2026-03-28 17:25:00',
    receiverWrittenQty: waitReceiveSubmittedQty,
    receiverWrittenAt: '2026-03-28 18:10:00',
    receiverRemark: '接收方已足额确认',
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
    dyeFactoryId: 'ID-F003',
    dyeFactoryName: 'PT Cahaya Dyeing Sejahtera',
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
    isReplenishment: true,
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
    dyeFactoryId: 'ID-F003',
    dyeFactoryName: 'PT Cahaya Dyeing Sejahtera',
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
    dyeFactoryId: 'ID-F002',
    dyeFactoryName: 'PT Prima Printing Center',
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
  const acceptedWaitingTask = getDyeingTaskById('TASK-DYE-000723')
  if (acceptedWaitingTask) {
    acceptedWaitingTask.acceptanceStatus = 'ACCEPTED'
    acceptedWaitingTask.acceptedAt = '2026-03-28 09:10:00'
    acceptedWaitingTask.acceptedBy = 'PDA 接单员'
    acceptedWaitingTask.mockReceiveSummary = '染厂已接单，等待色卡确认后开工。'
    registerPdaGenericProcessTask(acceptedWaitingTask)
  }

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
    status: 'INPUT_RECEIVED',
    taskId: 'TASK-DYE-000724',
    taskNo: 'TASK-DYE-000724',
    waitingReason: '投入已接收，等待排染缸',
    createdAt: '2026-03-28 08:00:00',
    updatedAt: '2026-03-28 10:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[3], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[3]}-INPUT_RECEIVED`,
      dyeOrderId: DYE_WORK_ORDER_IDS[3],
      taskId: 'TASK-DYE-000724',
      nodeCode: 'INPUT_RECEIVED',
      nodeName: DYE_NODE_LABEL.INPUT_RECEIVED,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:20:00',
      finishedAt: '2026-03-28 10:40:00',
      inputQty: 840,
      outputQty: 840,
      qtyUnit: '米',
      remark: '投入已接收',
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
      nodeRecordId: `${DYE_WORK_ORDER_IDS[4]}-INPUT_RECEIVED`,
      dyeOrderId: DYE_WORK_ORDER_IDS[4],
      taskId: 'TASK-DYE-000725',
      nodeCode: 'INPUT_RECEIVED',
      nodeName: DYE_NODE_LABEL.INPUT_RECEIVED,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 09:00:00',
      finishedAt: '2026-03-28 10:10:00',
      inputQty: 980,
      outputQty: 980,
      qtyUnit: '米',
      remark: '投入已接收',
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
    isReplenishment: true,
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
    status: 'DYEING',
    taskId: 'TASK-DYE-000726',
    taskNo: 'TASK-DYE-000726',
    waitingReason: '染缸执行中',
    createdAt: '2026-03-28 07:20:00',
    updatedAt: '2026-03-28 12:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[5], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[5]}-INPUT_RECEIVED`,
      dyeOrderId: DYE_WORK_ORDER_IDS[5],
      taskId: 'TASK-DYE-000726',
      nodeCode: 'INPUT_RECEIVED',
      nodeName: DYE_NODE_LABEL.INPUT_RECEIVED,
      operatorUserId: 'USR-DYE-01',
      operatorName: '染色工厂',
      startedAt: '2026-03-28 08:35:00',
      finishedAt: '2026-03-28 09:15:00',
      inputQty: 1100,
      outputQty: 1100,
      qtyUnit: '米',
      remark: '投入已接收',
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
    status: 'WAIT_REVIEW',
    taskId: 'TASK-DYE-000728',
    taskNo: 'TASK-DYE-000728',
    handoverOrderId: orderSubmitted.handoverOrderId,
    waitingReason: '接收方已回写，等待平台审核',
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
    status: 'PARTIAL_HANDOVER',
    taskId: partialTaskId,
    taskNo: partialTaskId,
    handoverOrderId: orderWaitReview.handoverOrderId,
    waitingReason: '已部分入库，剩余数量不再继续染色',
    createdAt: '2026-03-27 14:50:00',
    updatedAt: '2026-03-28 20:40:00',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[8], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[8]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[8],
      taskId: partialTaskId,
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
    colorNo: 'C-612',
    rawMaterialSku: 'FAB-DYE-012',
    composition: '棉麻混纺',
    width: '152 cm',
    weightGsm: 190,
    targetColor: '雾灰',
    plannedQty: 930,
    qtyUnit: '米',
    plannedRollCount: 15,
    dyeFactoryId: '',
    dyeFactoryName: '待分配工厂',
    status: 'WAIT_MATERIAL',
    taskId: 'TASK-DYE-000732',
    taskNo: 'TASK-DYE-000732',
    waitingReason: '待分配工厂并等待来源单据',
    createdAt: '2026-03-29 08:00:00',
    updatedAt: '2026-03-29 08:00:00',
    remark: '补充待分配工厂与来源单据未到位场景',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[11], [])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[12],
    dyeOrderNo: 'DY-20260329-013',
    sourceType: 'STOCK',
    stockMaterialId: 'STOCK-DYE-FABRIC-013',
    stockMaterialName: '备货棉涤坯布',
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
    dyeFactoryId: 'ID-F002',
    dyeFactoryName: 'PT Prima Printing Center',
    status: 'PACKING',
    taskId: 'TASK-DYE-000733',
    taskNo: 'TASK-DYE-000733',
    waitingReason: '备货染色已完成打卷，正在包装',
    createdAt: '2026-03-29 09:00:00',
    updatedAt: '2026-03-29 10:05:00',
    remark: '业务人员按备货创建，染色与打卷已完成，待确认包装完成',
  })
  setNodeRecords(DYE_WORK_ORDER_IDS[12], [
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[12]}-DYE`,
      dyeOrderId: DYE_WORK_ORDER_IDS[12],
      taskId: 'TASK-DYE-000733',
      nodeCode: 'DYE',
      nodeName: DYE_NODE_LABEL.DYE,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-29 11:00:00',
      finishedAt: '2026-03-29 14:00:00',
      dyeVatId: primaryVat?.dyeVatId,
      dyeVatNo: primaryVat?.dyeVatNo || 'DV-01',
      inputQty: 940,
      outputQty: 940,
      lossQty: 0,
      qtyUnit: '米',
      remark: '备货染色完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[12]}-ROLL`,
      dyeOrderId: DYE_WORK_ORDER_IDS[12],
      taskId: 'TASK-DYE-000733',
      nodeCode: 'ROLL',
      nodeName: DYE_NODE_LABEL.ROLL,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-29 14:20:00',
      finishedAt: '2026-03-29 15:00:00',
      outputQty: 940,
      qtyUnit: '米',
      remark: '打卷完成',
    },
    {
      nodeRecordId: `${DYE_WORK_ORDER_IDS[12]}-PACK`,
      dyeOrderId: DYE_WORK_ORDER_IDS[12],
      taskId: 'TASK-DYE-000733',
      nodeCode: 'PACK',
      nodeName: DYE_NODE_LABEL.PACK,
      operatorUserId: 'USR-DYE-02',
      operatorName: '染色工厂',
      startedAt: '2026-03-29 15:10:00',
      qtyUnit: '米',
      remark: '包装中',
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

  const waitAuditHead = orderSubmitted.handoverOrderId ? getHandoverOrderById(orderSubmitted.handoverOrderId) : undefined
  if (waitAuditHead) {
    const waitAuditReview = createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[7])!, waitAuditHead)
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[7], {
      ...waitAuditReview,
      receivedQty: waitReceiveSubmittedQty,
      diffQty: 0,
      reviewStatus: 'WAIT_REVIEW',
      reviewedBy: '中转仓管',
      reviewedAt: '2026-03-28 18:10:00',
      remark: '指定接收方已足额确认',
    })
  }

  const waitReviewHead = orderWaitReview.handoverOrderId ? getHandoverOrderById(orderWaitReview.handoverOrderId) : undefined
  if (waitReviewHead) {
    const partialReview = createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[8])!, waitReviewHead)
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[8], {
      ...partialReview,
      receivedQty: partialReceivedQty,
      diffQty: Number((partialReceivedQty - partialSubmittedQty).toFixed(2)),
      reviewStatus: 'PARTIAL_HANDOVER',
      reviewedBy: '中转仓管',
      reviewedAt: '2026-03-28 17:30:00',
      remark: '本次按实收数量部分入库，剩余数量终止',
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
      remark: '指定接收方收货差异',
    })
  }

  const completedHead = orderCompleted.handoverOrderId ? getHandoverOrderById(orderCompleted.handoverOrderId) : undefined
  if (completedHead) {
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[10], {
      ...createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[10])!, completedHead),
      reviewStatus: 'FULL_HANDOVER',
      reviewedBy: '中转仓管',
      reviewedAt: '2026-03-29 18:10:00',
      remark: '指定接收方已全部确认收货',
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
    taskId: partialTaskId,
    taskNo: partialTaskId,
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
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
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
  const sourceType: ProcessWorkOrderSourceType = input.sourceType || 'PRODUCTION_ORDER'
  const sourceOrder = input.productionOrderId
    ? productionOrders.find((order) => order.productionOrderId === input.productionOrderId)
    : undefined
  const hasFactory = Boolean(input.factoryId)
  const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
    sourceType,
    productionOrderNo: input.productionOrderNo || sourceOrder?.productionOrderNo || input.productionOrderId,
    supplementRecordId: input.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: input.sourceSnapshot?.supplementRecordNo,
  })
  const qtyUnit: QtyUnit = ['件', '片', '个', '套'].includes(input.qtyDisplayUnit)
    ? 'PIECE'
    : ['卷', '捆', '包', '打'].includes(input.qtyDisplayUnit)
      ? 'BUNDLE'
      : 'METER'
  return {
    taskId: input.taskId,
    taskNo: input.taskNo || input.taskId,
    sourceType,
    sourceSnapshot: input.sourceSnapshot ? structuredClone(input.sourceSnapshot) : undefined,
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
    acceptanceStatus: 'PENDING',
    acceptedAt: undefined,
    acceptedBy: undefined,
    taskQrValue: buildTaskQrValue(input.taskId),
    taskQrStatus: 'ACTIVE',
    handoverStatus: 'NOT_CREATED',
    receiverKind: 'WAREHOUSE',
    receiverId: receivingTarget.targetBusinessId,
    receiverName: receivingTarget.targetName,
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
  const productionOrder = productionOrders.find((order) => order.productionOrderId === 'PO-202603-081')
  const techPackSnapshot = productionOrder ? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId) : undefined
  if (!productionOrder || !techPackSnapshot || workOrderStore.has('DYE-WATER-PO-202603-081')) return
  const dyeSnapshot = deriveFormalProductionOrderProcessSnapshots({
    ...productionOrder,
    techPackSnapshot,
  }).find((snapshot) => snapshot.processCodes.includes('DYE'))
  if (!dyeSnapshot?.requiresWaterSoluble) return
  const processName = dyeSnapshot.dyeProcessName || '染色'

  const taskId = 'TASK-DYE-WATER-PO-202603-081'
  const createdAt = '2026-03-26 09:00:00'
  registerPdaGenericProcessTask(buildFreshDyeMobileTask({
    taskId,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    spuCode: productionOrder.demandSnapshot.spuCode,
    spuName: productionOrder.demandSnapshot.spuName,
    requiredDeliveryDate: productionOrder.demandSnapshot.requiredDeliveryDate ?? undefined,
    factoryId: TEST_FACTORY_ID,
    factoryName: TEST_FACTORY_NAME,
    qty: dyeSnapshot.plannedQty,
    qtyDisplayUnit: dyeSnapshot.qtyUnit,
    processName,
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
    sourceProductionOrderId: productionOrder.productionOrderId,
    sourceProductionOrderNo: productionOrder.productionOrderNo,
    productionOrderOrderedAt: createdAt,
    productionOrderIds: [productionOrder.productionOrderId],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    rawMaterialSku: dyeSnapshot.materialId,
    composition: dyeSnapshot.materialName,
    materialId: dyeSnapshot.materialId,
    dyeProcessCode: 'DYE',
    dyeProcessName: processName,
    targetColor: dyeSnapshot.targetColor,
    plannedQty: dyeSnapshot.plannedQty,
    qtyUnit: dyeSnapshot.qtyUnit,
    requiresWaterSoluble: true,
    waterSolublePlannedQty: dyeSnapshot.plannedQty,
    waterSolubleCompletedQty: 0,
    waterSolubleQtyUnit: dyeSnapshot.qtyUnit,
    dyeFactoryId: TEST_FACTORY_ID,
    dyeFactoryName: TEST_FACTORY_NAME,
    status: 'WAIT_MATERIAL',
    taskId,
    taskNo: taskId,
    createdAt,
    updatedAt: createdAt,
    remark: '正式技术包 BOM 触发：同一染厂连续完成水溶与染色。',
    formalProductionOrderSnapshot: {
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: productionOrder.productionOrderNo,
      orderedAt: productionOrder.createdAt,
      techPackVersionId: dyeSnapshot.techPackVersionId,
      techPackVersionLabel: dyeSnapshot.techPackVersionLabel,
      materialId: dyeSnapshot.materialId,
      materialName: dyeSnapshot.materialName,
      materialItems: dyeSnapshot.materialItems,
      targetColor: dyeSnapshot.targetColor,
      plannedQty: dyeSnapshot.plannedQty,
      qtyUnit: dyeSnapshot.qtyUnit,
      processCodes: dyeSnapshot.processCodes,
      processName,
      requiresWaterSoluble: true,
      spuCode: productionOrder.demandSnapshot.spuCode,
      spuName: productionOrder.demandSnapshot.spuName,
      requiredDeliveryDate: productionOrder.demandSnapshot.requiredDeliveryDate || '',
    },
  })
  createdDyeOrderIds.add('DYE-WATER-PO-202603-081')
}

function seedCombinedDyeingDemoWorkOrders(): void {
  const common = {
    techPackVersionId: 'TP-COMBINED-DEMO-V1',
    techPackVersionLabel: '技术包 V1',
    materialId: 'MAT-COMBINED-DEMO-001',
    materialName: '40 支精梳棉双面布',
    targetColor: '藏青色',
    qtyUnit: 'Yard',
    processCodes: ['DYE'] as const,
    processName: '活性染色',
    factoryId: 'F090',
    factoryName: '全能力测试工厂',
    requiredDeliveryDate: '2026-07-28 18:00:00',
  }
  const demos = [
    {
      workOrderId: 'DYE-COMBINED-DEMO-001',
      workOrderNo: 'RSJG-202607-901',
      productionOrderId: 'PO-COMBINED-DEMO-901',
      productionOrderNo: 'PO-202607-0901',
      orderedAt: '2026-07-15 08:30:00',
      plannedQty: 600,
      spuCode: 'SPU-COMBINED-901',
      spuName: '藏青基础款上衣',
    },
    {
      workOrderId: 'DYE-COMBINED-DEMO-002',
      workOrderNo: 'RSJG-202607-902',
      productionOrderId: 'PO-COMBINED-DEMO-902',
      productionOrderNo: 'PO-202607-0902',
      orderedAt: '2026-07-15 09:10:00',
      plannedQty: 400,
      spuCode: 'SPU-COMBINED-902',
      spuName: '藏青基础款下装',
    },
  ]

  for (const demo of demos) {
    const existing = Array.from(workOrderStore.values())
      .find((order) => order.sourceType === 'PRODUCTION_ORDER' && order.sourceProductionOrderId === demo.productionOrderId)
    if (existing) continue

    registerPdaGenericProcessTask(buildFreshDyeMobileTask({
      taskId: demo.workOrderId,
      taskNo: demo.workOrderNo,
      productionOrderId: demo.productionOrderId,
      productionOrderNo: demo.productionOrderNo,
      spuCode: demo.spuCode,
      spuName: demo.spuName,
      requiredDeliveryDate: common.requiredDeliveryDate,
      factoryId: common.factoryId,
      factoryName: common.factoryName,
      qty: demo.plannedQty,
      qtyDisplayUnit: common.qtyUnit,
      processName: common.processName,
      createdAt: demo.orderedAt,
      dispatchedBy: '平台自动生成',
      receiveSummary: '染色加工单已分配，待工厂接收。',
      executionSummary: `按${common.processName}执行。`,
      handoverSummary: '完成染色及后处理后统一交出。',
    }))
    addSeedWorkOrder({
      dyeOrderId: demo.workOrderId,
      dyeOrderNo: demo.workOrderNo,
      sourceType: 'PRODUCTION_ORDER',
      sourceProductionOrderId: demo.productionOrderId,
      sourceProductionOrderNo: demo.productionOrderNo,
      productionOrderOrderedAt: demo.orderedAt,
      productionOrderIds: [demo.productionOrderId],
      isFirstOrder: false,
      sampleWaitType: 'NONE',
      sampleStatus: 'NOT_REQUIRED',
      rawMaterialSku: common.materialId,
      composition: common.materialName,
      targetColor: common.targetColor,
      materialId: common.materialId,
      dyeProcessCode: 'DYE',
      dyeProcessName: common.processName,
      plannedQty: demo.plannedQty,
      qtyUnit: common.qtyUnit,
      dyeFactoryId: common.factoryId,
      dyeFactoryName: common.factoryName,
      status: 'WAIT_MATERIAL',
      taskId: demo.workOrderId,
      taskNo: demo.workOrderNo,
      createdAt: demo.orderedAt,
      updatedAt: demo.orderedAt,
      remark: `${common.processName}；来源中央演示生产单 ${demo.productionOrderNo}；技术包 ${common.techPackVersionLabel}。`,
      formalProductionOrderSnapshot: {
        productionOrderId: demo.productionOrderId,
        productionOrderNo: demo.productionOrderNo,
        orderedAt: demo.orderedAt,
        techPackVersionId: common.techPackVersionId,
        techPackVersionLabel: common.techPackVersionLabel,
        materialId: common.materialId,
        materialName: common.materialName,
        materialItems: [{ sourceBomItemId: common.materialId, materialId: common.materialId, materialName: common.materialName }],
        targetColor: common.targetColor,
        plannedQty: demo.plannedQty,
        qtyUnit: common.qtyUnit,
        processCodes: [...common.processCodes],
        processName: common.processName,
        spuCode: demo.spuCode,
        spuName: demo.spuName,
        requiredDeliveryDate: common.requiredDeliveryDate,
      },
    })
    createdDyeOrderIds.add(demo.workOrderId)
  }
}

function seedYarnReceivingDemos(): void {
  for (const [i, weight] of [10, 9.999, 10.001].entries()) {
    const id = `DYE-YARN-DEMO-${i + 1}`, no = `RS-YARN-260911-${i + 1}`
    addSeedWorkOrder({dyeOrderId: id, dyeOrderNo: no, sourceType: 'STOCK', stockMaterialId: RECEIVING_YARN_MATERIAL.sku, stockMaterialName: RECEIVING_YARN_MATERIAL.name, isFirstOrder: false, sampleWaitType: 'NONE', sampleStatus: 'NOT_REQUIRED', rawMaterialSku: RECEIVING_YARN_MATERIAL.sku, materialId: RECEIVING_YARN_MATERIAL.sku, composition: '100% 棉', targetColor: RECEIVING_YARN_MATERIAL.color, dyeProcessName: '纱线段染', plannedQty: weight, qtyUnit: 'kg', yarnOrderedWeightKg: weight, dyeFactoryId: 'ID-F002', dyeFactoryName: 'MJS', plannedFinishAt: '2026-09-12 18:00:00', status: 'WAIT_HANDOVER', taskId: id, taskNo: `TK-YARN-260911-${i + 1}`, createdAt: '2026-09-11 08:00:00', updatedAt: '2026-09-11 14:30:00', remark: '纱线重量边界演示；实际包装完工净重 30 kg；按完整交出毛重计算限额。'})
    const order = workOrderStore.get(id)!
    order.targetTransferWarehouseId = 'FIW-OWN_WOOL_FACTORY-WAIT_PROCESS'
    order.targetTransferWarehouseName = '周哥毛织厂 · 待加工仓'
    order.receiverName = '周哥毛织厂'
    const task = getDyeingTaskById(id)
    if (task) { task.startedAt = '2026-09-11 09:00:00'; task.status = 'IN_PROGRESS'; task.receiverKind = 'MANAGED_POST_FACTORY'; task.receiverId = 'OWN_WOOL_FACTORY'; task.receiverName = '周哥毛织厂'; registerPdaGenericProcessTask(task) }
    order.initialYarnReceipt = calculateYarnWeight(32.42,{PAPER:0,CONICAL:0,PAGODA:20},20)
    order.initialYarnTransfer = {documentNo:`DB-YARN-SEED-${i+1}`,warehouseId:'WH-MAOSHA-001',warehouseName:'纱线中央仓',plannedNetKg:30,sentNetKg:30,status:'已调拨'}
    order.outputRolls = []
    order.materialReceipts = [{receiptId:`YARN-SEED-RECEIPT-${id}`,upstreamRecordId:`DB-YARN-SEED-${i+1}-L1`,qty:30,receiverName:'dewi',receivedAt:'2026-09-11 08:30:00'}]
    nodeRecordStore.set(id, ['DYE','DEHYDRATE','DRY','SET','ROLL','PACK'].map((code, n) => ({nodeRecordId:`${id}-${code}`,dyeOrderId:id,taskId:id,nodeCode:code as DyeExecutionNodeCode,nodeName:DYE_NODE_LABEL[code as DyeExecutionNodeCode],operatorUserId:'RCV-DEWI',operatorName:'dewi',startedAt:`2026-09-11 ${String(9+n).padStart(2,'0')}:00:00`,finishedAt:`2026-09-11 ${String(9+n).padStart(2,'0')}:30:00`,inputQty:30,outputQty:30,lossQty:0,qtyUnit:'kg',remark:'完整纱线演示批次实际加工记录'})))
    createdDyeOrderIds.add(id)
  }
}

function seedDomain(): void {
  if (seeded) return
  seeded = true
  seedWorkOrders()
  normalizeSeedWorkOrderSources()
  DYE_INPUT_TRANSFER_FIXTURES.forEach((fixture) => {
    const order = workOrderStore.get(fixture.workOrderId)
    if (!order || order.materialReceipts?.length) return
    order.materialReceipts = [{
      receiptId: `DYE-SEED-RECEIPT-${fixture.workOrderId}`,
      upstreamRecordId: `ISSUE-DYE-${fixture.workOrderId}-L001`,
      qty: fixture.qty,
      receiverName: fixture.targetFactoryName,
      receivedAt: fixture.issuedAt,
    }]
  })
  seedPersistentWaterSolubleDyeWorkOrder()
  seedCombinedDyeingDemoWorkOrders()
  seedYarnReceivingDemos()
  // Complete the three historical demonstration records at their source; no view-layer quantity inference.
  for (const [id, inputQty] of [['DWO-008', 2016], ['DWO-009', 3798], ['DWO-010', 5600]] as const) {
    const order = workOrderStore.get(id)!
    const nodes = nodeRecordStore.get(id)!
    if (!nodes.some(node => node.nodeCode === 'DYE')) nodes.unshift({
      nodeRecordId: `${id}-DYE`, dyeOrderId: id, taskId: order.taskId, nodeCode: 'DYE', nodeName: '染色',
      operatorUserId: 'USR-DYE-01', operatorName: '染色工厂', startedAt: '2026-03-28 11:30:00',
      finishedAt: '2026-03-28 15:00:00', inputQty, outputQty: inputQty, lossQty: 0, qtyUnit: order.qtyUnit,
      remark: '预设演示批次：按实领数量投入，染色工序无损耗',
    })
  }
  // Complete named demo specifications once; quantities/status remain canonical execution facts.
  workOrderStore.forEach(order => {
    const details = DYE_DEMO_DETAILS[order.dyeOrderId]
    if (!details) return
    order.composition = details.composition
    order.width = String(details.widthCm)
    order.weightGsm = details.gsm
    order.colorNo = details.colorNo
    // 保留两条未填写备注的演示单，覆盖列表新增备注入口。
    if (['DWO-002', 'DWO-003'].includes(order.dyeOrderId)) order.remark = ''
  })
  workOrderStore.forEach((_, id) => initialDyeOrderIds.add(id))
  for (const order of productionOrders) {
    for (const definition of getRestoredFormalProcessDefinitions(order, 'DYE')) {
      registerFormalProductionOrderDyeWorkOrder(definition)
    }
  }
  restoreFormalDyeExecution()
  // Restore actual yarn batches by their original IDs; do not create receiving or inventory facts.
  for (const source of listFactoryReceivingSources(undefined, true).filter(s=>s.id.startsWith('YARN-SHIP-')&&s.originalRecordId&&!s.voidedAt)) {
    const order=Array.from(workOrderStore.values()).find(o=>o.dyeOrderNo===source.workOrderNo)
    if(!order)continue
    const headId=ensureStartedTaskHandover(order.taskId)
    if(headId && !getPdaHandoverRecordsByHead(headId).some(r=>(r.handoverRecordId||r.recordId)===source.originalRecordId)) {
      const restored=ensureSeededHandoverRecord({taskId:order.taskId,submittedQty:source.lines[0].sentQty,submittedAt:source.handedOutAt!,submittedBy:source.createdBy,createNewBatch:true})
      if(!restored.recordIds.includes(source.originalRecordId!))throw new Error('纱线交出原记录编号不一致，请保留记录并联系主管核对。')
    }
  }
  workOrderStore.forEach(order => {
    if (!DYE_DEMO_DETAILS[order.dyeOrderId] || order.outputRolls !== undefined) return
    const available = Math.max(0, getCurrentOutputQty(order) - listHandoverOrdersByTaskId(order.taskId).reduce((sum, head) => sum + (head.submittedQtyTotal ?? 0), 0))
    const count = available > 0 ? 3 : 1
    let remaining = available
    const spec = DYE_DEMO_DETAILS[order.dyeOrderId]
    order.outputRolls = Array.from({length: count}, (_, i) => {
      const no = String(i + 1).padStart(4, '0')
      const qty = Number((i === count - 1 ? remaining : available / count).toFixed(2)); remaining -= qty
      const meters = qty * (order.qtyUnit.toLowerCase() === 'yard' ? .9144 : 1)
      return {id: `${order.dyeOrderId}-${no}`, barcode: `${order.dyeOrderNo}_${no}`, rollNo: no, qty,
        weightKg: Number((meters * spec.widthCm / 100 * spec.gsm / 1000).toFixed(2)), widthCm: spec.widthCm, gsm: spec.gsm,
        vatNo: available ? `G-${order.dyeOrderNo.slice(-3)}` : '', remark: '演示产出卷', createdAt: order.updatedAt,
        warehouseName: order.targetTransferWarehouseName, locationName: '待上架', inboundStatus: '未入库' as const}
    })
    order.nextOutputRollNo = count + 1
  })
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
  const route: DyeExecutionNodeCode[] = ['SAMPLE', 'INPUT_RECEIVED', 'VAT_PLAN']
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
  return listGeneratedDyeWorkOrders().map((order) => {
    const canonical = workOrderStore.get(order.dyeOrderId) ?? order
    ensureDyeAcceptanceFact(canonical)
    return cloneWorkOrder({
      ...order,
      acceptanceStatus: canonical.acceptanceStatus,
      acceptedAt: canonical.acceptedAt,
      acceptedBy: canonical.acceptedBy,
      rejectedAt: canonical.rejectedAt,
      rejectedBy: canonical.rejectedBy,
      rejectionReason: canonical.rejectionReason,
    })
  })
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
  if (canonical) ensureDyeAcceptanceFact(canonical)
  const order = listGeneratedDyeWorkOrders().find((item) => item.dyeOrderId === dyeOrderId)
  return order && canonical
    ? cloneWorkOrder({
        ...order,
        dyeOrderId: canonical.dyeOrderId,
        dyeOrderNo: canonical.dyeOrderNo,
        taskId: canonical.taskId,
        taskNo: canonical.taskNo,
        acceptanceStatus: canonical.acceptanceStatus,
        acceptedAt: canonical.acceptedAt,
        acceptedBy: canonical.acceptedBy,
        rejectedAt: canonical.rejectedAt,
        rejectedBy: canonical.rejectedBy,
        rejectionReason: canonical.rejectionReason,
      })
    : undefined
}

registerCanonicalDyeWorkOrderReader(getDyeWorkOrderById)

export function getDyeWorkOrderByTaskId(taskId: string): DyeWorkOrder | undefined {
  syncDerivedWorkflow()
  const canonical = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!canonical) return undefined
  ensureDyeAcceptanceFact(canonical)
  const order = listGeneratedDyeWorkOrders().find((item) => item.dyeOrderId === canonical.dyeOrderId)
  return order
    ? cloneWorkOrder({
        ...order,
        dyeOrderId: canonical.dyeOrderId,
        dyeOrderNo: canonical.dyeOrderNo,
        taskId: canonical.taskId,
        taskNo: canonical.taskNo,
        acceptanceStatus: canonical.acceptanceStatus,
        acceptedAt: canonical.acceptedAt,
        acceptedBy: canonical.acceptedBy,
        rejectedAt: canonical.rejectedAt,
        rejectedBy: canonical.rejectedBy,
        rejectionReason: canonical.rejectionReason,
      })
    : undefined
}

function ensureDyeAcceptanceFact(order: MutableDyeWorkOrder): void {
  if (order.acceptanceStatus) return
  if (!order.dyeFactoryId) {
    order.acceptanceStatus = 'PENDING'
    order.acceptedAt = undefined
    order.acceptedBy = undefined
    return
  }
  const hasStarted = (nodeRecordStore.get(order.dyeOrderId) ?? []).some((node) => Boolean(node.startedAt))
  const hasHistoricalExecution = hasStarted || !['WAIT_SAMPLE', 'WAIT_MATERIAL'].includes(order.status)
  order.acceptanceStatus = hasHistoricalExecution ? 'ACCEPTED' : 'PENDING'
  order.acceptedAt = hasHistoricalExecution ? order.createdAt : undefined
  order.acceptedBy = hasHistoricalExecution ? order.dyeFactoryName : undefined
}

function deriveDyeMobileStatus(order: DyeWorkOrder): PdaGenericTaskMock['status'] {
  if (order.status === 'REJECTED' || order.status === 'HANDOVER_DIFFERENCE' || order.status === 'PRODUCTION_PAUSED') return 'BLOCKED'
  if (order.status === 'COMPLETED') return 'DONE'
  const hasStarted = (nodeRecordStore.get(order.dyeOrderId) ?? []).some((node) => Boolean(node.startedAt))
  return hasStarted ? 'IN_PROGRESS' : 'NOT_STARTED'
}

function deriveDyeMobileOrigin(order: DyeWorkOrder, status: PdaGenericTaskMock['status']): PdaGenericTaskMock['mockOrigin'] {
  if (order.acceptanceStatus === 'REJECTED') return 'DIRECT_REJECTED'
  if (order.acceptanceStatus !== 'ACCEPTED') return 'DIRECT_PENDING'
  if (status === 'DONE') return 'EXEC_DONE'
  if (status === 'BLOCKED') return 'EXEC_BLOCKED'
  if (status === 'IN_PROGRESS') return 'EXEC_IN_PROGRESS'
  if (status === 'CANCELLED') return 'EXEC_CANCELLED'
  return 'EXEC_NOT_STARTED'
}

export function listDyeMobileExecutionTasks(): PdaGenericTaskMock[] {
  syncDerivedWorkflow()
  return Array.from(workOrderStore.values()).flatMap((order) => {
    ensureDyeAcceptanceFact(order)
    const baseTask = getDyeingTaskById(order.taskId) ?? buildFreshDyeMobileTask({
      taskId: order.taskId,
      taskNo: order.taskNo,
      sourceType: order.sourceType,
      sourceSnapshot: order.sourceSnapshot,
      productionOrderId: order.sourceProductionOrderId || order.productionOrderIds?.[0],
      productionOrderNo: order.sourceProductionOrderNo,
      stockMaterialId: order.stockMaterialId,
      stockMaterialName: order.stockMaterialName,
      spuCode: order.rawMaterialSku,
      spuName: `${order.rawMaterialSku} / ${order.targetColor}`,
      requiredDeliveryDate: order.plannedFinishAt || '',
      factoryId: order.dyeFactoryId,
      factoryName: order.dyeFactoryName,
      qty: order.plannedQty,
      qtyDisplayUnit: order.qtyUnit,
      processName: order.dyeProcessName,
      createdAt: order.createdAt,
      dispatchedBy: '平台加工单',
      receiveSummary: order.dyeFactoryId ? '染色加工单已分配，待工厂接收。' : '染色加工单待分配工厂。',
      executionSummary: '按染色加工单当前节点执行。',
      handoverSummary: '完成染色及后处理后统一交出。',
    })
    const nodes = nodeRecordStore.get(order.dyeOrderId) ?? []
    const startedAt = nodes.map((node) => node.startedAt).filter((value): value is string => Boolean(value)).sort()[0]
    const status = deriveDyeMobileStatus(order)
    return [{
      ...structuredClone(baseTask),
      qty: order.plannedQty,
      qtyDisplayUnit: order.qtyUnit,
      assignedFactoryId: order.dyeFactoryId || undefined,
      assignedFactoryName: order.dyeFactoryName || undefined,
      assignmentStatus: order.dyeFactoryId ? 'ASSIGNED' : 'UNASSIGNED',
      acceptanceStatus: order.acceptanceStatus,
      mockOrigin: deriveDyeMobileOrigin(order, status),
      acceptedAt: order.acceptedAt,
      acceptedBy: order.acceptedBy,
      status,
      startedAt,
      finishedAt: status === 'DONE' ? order.updatedAt : undefined,
      handoutStatus: ['HANDOVER_WAIT_RECEIVE', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'WAIT_MANUAL_COMPLETION', 'COMPLETED'].includes(order.status) ? 'HANDED_OUT' : 'PENDING',
      defaultDocType: 'PREPARATION_ORDER',
      stage: 'PREP',
      stageCode: 'PREP',
      updatedAt: order.updatedAt,
    }]
  })
}

export function acceptDyeWorkOrderPdaTask(taskId: string, acceptedBy: string, acceptedAt = nowTimestamp()): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!order) throw new Error('染色加工单不存在')
  if (!order.dyeFactoryId) throw new Error('染色加工单尚未分配工厂')
  ensureDyeAcceptanceFact(order)
  if (order.acceptanceStatus === 'REJECTED') throw new Error('染色加工单已拒绝，不能接单')
  if (order.acceptanceStatus !== 'ACCEPTED') {
    order.acceptanceStatus = 'ACCEPTED'
    order.acceptedAt = acceptedAt
    order.acceptedBy = acceptedBy
    updateOrderTimestamp(order, acceptedAt)
  }
  return cloneWorkOrder(order)

  })
}

export function rejectDyeWorkOrderPdaTask(taskId: string, rejectedBy: string, reason: string, rejectedAt = nowTimestamp()): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!order) throw new Error('染色加工单不存在')
  if (!order.dyeFactoryId) throw new Error('染色加工单尚未分配工厂')
  ensureDyeAcceptanceFact(order)
  if (order.acceptanceStatus === 'REJECTED') throw new Error('染色加工单已拒单，不可重复拒单')
  if ((nodeRecordStore.get(order.dyeOrderId) ?? []).some((node) => Boolean(node.startedAt))) {
    throw new Error('染色加工单已经开工，不能拒单')
  }
  order.acceptanceStatus = 'REJECTED'
  order.acceptedAt = undefined
  order.acceptedBy = undefined
  order.rejectedAt = rejectedAt
  order.rejectedBy = rejectedBy
  order.rejectionReason = reason
  order.dyeFactoryId = ''
  order.dyeFactoryName = '待分配工厂'
  updateOrderTimestamp(order, rejectedAt)
  return cloneWorkOrder(order)

  })
}

export interface DyeReceiptOnlineStatusEvent {
  dyeOrderId: string
  receivedBy: string
  receivedAt: string
  receivedQty: number
  expectedQty: number
}

interface DyeReceiptOnlineStatusListener {
  validate: (event: DyeReceiptOnlineStatusEvent) => void
  commit: (event: DyeReceiptOnlineStatusEvent) => void
}

let dyeReceiptOnlineStatusListener: DyeReceiptOnlineStatusListener | null = null

export function registerDyeReceiptOnlineStatusListener(
  listener: DyeReceiptOnlineStatusListener,
): void {
  dyeReceiptOnlineStatusListener = listener
}

function validateDyeReceiptOnlineStatus(event: DyeReceiptOnlineStatusEvent): void {
  dyeReceiptOnlineStatusListener?.validate(event)
}

function notifyDyeReceiptOnlineStatus(event: DyeReceiptOnlineStatusEvent): void {
  dyeReceiptOnlineStatusListener?.commit(event)
}

export function registerFormalProductionOrderDyeWorkOrder(input: FormalProductionOrderProcessSnapshot & {
  workOrderId: string
  workOrderNo: string
  processName: string
  requiresWaterSoluble?: boolean
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  sourceKey?: string
  plannedFinishAt?: string
  createdBy?: string
  sampleWaitType?: SampleWaitType
}): DyeWorkOrder {
  seedDomain()
  const sourceSnapshot: ProcessWorkOrderSourceSnapshot = input.sourceSnapshot || {
    sourceType: 'PRODUCTION_ORDER',
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    techPackVersionId: input.techPackVersionId,
    techPackVersionLabel: input.techPackVersionLabel,
    processEntryId: input.processEntryId,
    routeObjectKey: input.routeObjectKey,
    bomItemId: input.materialItems?.[0]?.sourceBomItemId || input.materialId,
    bomItemIds: input.materialItems?.map((item) => item.sourceBomItemId) || [input.materialId],
  }
  const existing = Array.from(workOrderStore.values())
    .find((order) => input.sourceKey
      ? order.sourceKey === input.sourceKey
      : order.sourceProductionOrderId === input.productionOrderId)
  if (existing) return cloneWorkOrder(existing)

  const materialItems = normalizeFormalProductionOrderMaterialItems(input)
  const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)

  const factoryId = input.factoryId || ''
  const factoryName = input.factoryName || '待分配工厂'
  const factoryAssignmentError = getDyeFactoryAssignmentError(factoryId, input.requiresWaterSoluble === true)
  if (factoryAssignmentError) throw new Error(factoryAssignmentError)
  registerPdaGenericProcessTask(buildFreshDyeMobileTask({
    taskId: input.workOrderId,
    taskNo: input.workOrderNo,
    sourceType: sourceSnapshot.sourceType,
    sourceSnapshot: structuredClone(sourceSnapshot),
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    stockMaterialId: sourceSnapshot.stockMaterialId,
    stockMaterialName: sourceSnapshot.stockMaterialName,
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
    sourceType: sourceSnapshot.sourceType,
    sourceSnapshot,
    sourceKey: input.sourceKey,
    sourceProductionOrderId: sourceSnapshot.productionOrderId,
    sourceProductionOrderNo: sourceSnapshot.productionOrderNo,
    productionOrderOrderedAt: input.orderedAt,
    stockMaterialId: sourceSnapshot.stockMaterialId,
    stockMaterialName: sourceSnapshot.stockMaterialName,
    productionOrderIds: sourceSnapshot.productionOrderId ? [sourceSnapshot.productionOrderId] : [],
    isFirstOrder: (input.sampleWaitType ?? 'NONE') !== 'NONE',
    sampleWaitType: input.sampleWaitType ?? 'NONE',
    sampleStatus: (input.sampleWaitType ?? 'NONE') === 'NONE' ? 'NOT_REQUIRED' : 'WAITING',
    sampleWaitStartedAt: (input.sampleWaitType ?? 'NONE') === 'NONE' ? undefined : input.orderedAt,
    rawMaterialSku: materialFields.materialId,
    composition: materialFields.materialName,
    targetColor: input.targetColor,
    materialId: materialFields.materialId,
    dyeProcessCode: 'DYE',
    dyeProcessName: input.processName,
    plannedQty: input.plannedQty,
    qtyUnit: input.qtyUnit,
    plannedFinishAt: input.plannedFinishAt,
    requiresWaterSoluble: input.requiresWaterSoluble === true,
    waterSolublePlannedQty: input.requiresWaterSoluble ? input.plannedQty : undefined,
    waterSolubleCompletedQty: input.requiresWaterSoluble ? 0 : undefined,
    waterSolubleQtyUnit: input.requiresWaterSoluble ? input.qtyUnit : undefined,
    dyeFactoryId: factoryId,
    dyeFactoryName: factoryName,
    status: (input.sampleWaitType ?? 'NONE') === 'NONE' ? 'WAIT_MATERIAL' : 'WAIT_SAMPLE',
    taskId: input.workOrderId,
    taskNo: input.workOrderNo,
    createdAt: input.orderedAt,
    updatedAt: input.orderedAt,
    remark: sourceSnapshot.sourceType === 'STOCK'
      ? `${input.processName}；按备货创建；创建人：${input.createdBy || '业务人员'}；计划完成：${input.plannedFinishAt || input.requiredDeliveryDate}`
      : sourceSnapshot.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? `${input.processName}；来源补料单 ${sourceSnapshot.supplementRecordNo}；原裁片单 ${sourceSnapshot.originalCutOrderNo}。`
        : `${input.processName}；来源正式生产单 ${input.productionOrderNo}；技术包 ${input.techPackVersionLabel}。`,
    formalProductionOrderSnapshot: sourceSnapshot.sourceType === 'STOCK' ? undefined : {
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderNo,
      orderedAt: input.orderedAt,
      techPackVersionId: input.techPackVersionId,
      techPackVersionLabel: input.techPackVersionLabel,
      ...(input.processEntryId ? { processEntryId: input.processEntryId } : {}),
      ...(input.routeObjectKey ? { routeObjectKey: input.routeObjectKey } : {}),
      materialId: materialFields.materialId,
      materialName: materialFields.materialName,
      materialItems,
      targetColor: input.targetColor,
      plannedQty: input.plannedQty,
      qtyUnit: input.qtyUnit,
      processCodes: [...input.processCodes],
      processName: input.processName,
      requiresWaterSoluble: input.requiresWaterSoluble === true,
      spuCode: input.spuCode,
      spuName: input.spuName,
      requiredDeliveryDate: input.requiredDeliveryDate,
    },
  })
  if (sourceSnapshot.sourceType === 'PRODUCTION_ORDER') {
    const sourceOrder = productionOrders.find(order => order.productionOrderId === sourceSnapshot.productionOrderId)
    if (sourceOrder && !sourceOrder.processWorkOrderDefinitions?.some(item => item.workOrderId === input.workOrderId)) {
      sourceOrder.processWorkOrderDefinitions = [...(sourceOrder.processWorkOrderDefinitions || []), {
        processCode: 'DYE', workOrderId: input.workOrderId, workOrderNo: input.workOrderNo,
        sourceKey: input.sourceKey, sourceSnapshot: structuredClone(sourceSnapshot),
      }]
    }
  }
  createdDyeOrderIds.add(input.workOrderId)
  return getDyeWorkOrderById(input.workOrderId)!
}

export function registerDyeProcessWorkOrderGenerationRegistrar(): void {
  registerProcessWorkOrderGenerationRegistrar({
    processCode: 'DYE',
    findBySourceKey: (sourceKey) => {
      seedDomain()
      return Array.from(workOrderStore.values()).find((order) => order.sourceKey === sourceKey)?.dyeOrderId
    },
    issueIdentity: (orderedAt, reserved) => {
      seedDomain()
      const occupiedIds = new Set(Array.from(workOrderStore.values()).map((order) => order.dyeOrderId))
      const occupiedNos = new Set(Array.from(workOrderStore.values()).map((order) => order.dyeOrderNo))
      const datePart = orderedAt.replace(/\D/g, '').slice(0, 8) || '00000000'
      for (let sequence = 1; sequence <= 999999; sequence += 1) {
        const padded = String(sequence).padStart(6, '0')
        const workOrderId = `DWO-AUTO-${padded}`
        const workOrderNo = `DY-${datePart}-${padded}`
        if (
          !occupiedIds.has(workOrderId)
          && !occupiedNos.has(workOrderNo)
          && !reserved.workOrderIds.has(workOrderId)
          && !reserved.workOrderNos.has(workOrderNo)
        ) return { workOrderId, workOrderNo }
      }
      throw new Error('染色加工单编号已耗尽')
    },
    prepare: (input) => {
      normalizeFormalProductionOrderMaterialItems(input)
      const factoryAssignmentError = getDyeFactoryAssignmentError(input.factoryId || '', input.requiresWaterSoluble === true)
      if (factoryAssignmentError) throw new Error(factoryAssignmentError)
      return {
        workOrderId: input.workOrderId,
        commit: () => { registerFormalProductionOrderDyeWorkOrder(input) },
        rollback: () => {
          workOrderStore.delete(input.workOrderId)
          createdDyeOrderIds.delete(input.workOrderId)
          const sourceOrder = productionOrders.find(order => order.productionOrderId === input.productionOrderId)
          if (sourceOrder?.processWorkOrderDefinitions) {
            sourceOrder.processWorkOrderDefinitions = sourceOrder.processWorkOrderDefinitions.filter(item => item.workOrderId !== input.workOrderId)
          }
          unregisterPdaGenericProcessTask(input.workOrderId)
        },
      }
    },
  })
}

export function assignDyeWorkOrderFactory(
  dyeOrderId: string,
  input: { factoryId: string; factoryName: string; assignedAt: string; assignedBy: string },
): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  const factoryId = input.factoryId.trim()
  const factoryName = input.factoryName.trim() || (factoryId ? factoryId : '待分配工厂')
  const factoryAssignmentError = getDyeFactoryAssignmentError(factoryId, order.requiresWaterSoluble)
  if (factoryAssignmentError) throw new Error(factoryAssignmentError)
  const changed = order.dyeFactoryId !== factoryId || order.dyeFactoryName !== factoryName

  order.dyeFactoryId = factoryId
  order.dyeFactoryName = factoryName
  if (changed) {
    order.acceptanceStatus = 'PENDING'
    order.acceptedAt = undefined
    order.acceptedBy = undefined
    order.rejectedAt = undefined
    order.rejectedBy = undefined
    order.rejectionReason = undefined
  }
  order.updatedAt = input.assignedAt

  const task = getDyeingTaskById(order.taskId)
  if (task) {
    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = factoryId ? 'ASSIGNED' : 'UNASSIGNED'
    task.assignedFactoryId = factoryId || undefined
    task.assignedFactoryName = factoryName
    task.dispatchedAt = factoryId ? input.assignedAt : undefined
    task.dispatchedBy = factoryId ? input.assignedBy : undefined
    task.dispatchRemark = factoryId ? '染色加工单已分配，待工厂接单。' : '染色加工单待分配工厂。'
    if (changed) {
      task.acceptanceStatus = 'PENDING'
      task.acceptedAt = undefined
      task.acceptedBy = undefined
    }
    task.updatedAt = input.assignedAt
  }

  return cloneWorkOrder(order)

  })
}

export const DYE_PRODUCTION_CHANGE_NOT_EXECUTED_STATUSES: readonly DyeWorkOrderStatus[] = [
  'WAIT_SAMPLE',
  'WAIT_MATERIAL',
  'INPUT_RECEIVED',
  'WAIT_VAT_PLAN',
  'WAIT_WATER_SOLUBLE',
]

export interface PreparedDyeWorkOrderProductionChangeSync {
  workOrderId?: string
  outcome: 'NOT_FOUND' | 'UNCHANGED' | 'AUTO_SYNCED' | 'PROTECTED'
  protectedCombinedMembership?: ProductionChangeProtectedCombinedDyeingMembership
  before?: FormalProductionOrderProcessSnapshotRecord
  after?: FormalProductionOrderProcessSnapshotRecord
  impact?: ProcessWorkOrderChangeImpact
  commit: () => void
  rollback: () => void
}

function toDyeSnapshotRecord(snapshot: FormalProductionOrderProcessSnapshot): FormalProductionOrderProcessSnapshotRecord {
  const materialItems = normalizeFormalProductionOrderMaterialItems(snapshot)
  const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)
  return {
    productionOrderId: snapshot.productionOrderId,
    productionOrderNo: snapshot.productionOrderNo,
    orderedAt: snapshot.orderedAt,
    techPackVersionId: snapshot.techPackVersionId,
    techPackVersionLabel: snapshot.techPackVersionLabel,
    ...(snapshot.processEntryId ? { processEntryId: snapshot.processEntryId } : {}),
    ...(snapshot.routeObjectKey ? { routeObjectKey: snapshot.routeObjectKey } : {}),
    materialId: materialFields.materialId,
    materialName: materialFields.materialName,
    materialItems,
    targetColor: snapshot.targetColor,
    plannedQty: snapshot.plannedQty,
    qtyUnit: snapshot.qtyUnit,
    processCodes: [...snapshot.processCodes],
    processName: snapshot.dyeProcessName || '染色',
    requiresWaterSoluble: snapshot.requiresWaterSoluble === true,
    spuCode: snapshot.spuCode,
    spuName: snapshot.spuName,
    requiredDeliveryDate: snapshot.requiredDeliveryDate,
  }
}

function hasActualDyeExecution(order: MutableDyeWorkOrder): boolean {
  const hasNodeFact = (nodeRecordStore.get(order.dyeOrderId) ?? [])
    .some((node) => Boolean(node.startedAt || node.finishedAt))
  const review = reviewRecordStore.get(order.dyeOrderId)
  const hasReviewFact = Boolean(review?.reviewedAt || review?.handoverRecordIds?.length || review?.submittedQty)
  const hasHandoverFact = getDyeOrderHandoverRecords(order.dyeOrderId).length > 0
  const isExplicitlyNotExecuted = DYE_PRODUCTION_CHANGE_NOT_EXECUTED_STATUSES.includes(order.status)
  return hasNodeFact || hasReviewFact || hasHandoverFact || !isExplicitlyNotExecuted
}

function toPdaQtyUnit(qtyDisplayUnit: string): QtyUnit {
  return ['件', '片', '个', '套'].includes(qtyDisplayUnit)
    ? 'PIECE'
    : ['卷', '捆', '包', '打'].includes(qtyDisplayUnit)
      ? 'BUNDLE'
      : 'METER'
}

export function prepareFormalProductionOrderDyeWorkOrderSync(
  snapshot: FormalProductionOrderProcessSnapshot,
  options: { changeRecordId: string; recordedAt: string },
): PreparedDyeWorkOrderProductionChangeSync {
  seedDomain()
  const candidates = Array.from(workOrderStore.values()).filter((order) => (
    order.sourceType === 'PRODUCTION_ORDER' && order.sourceProductionOrderId === snapshot.productionOrderId
  ))
  const syncTargetWorkOrderId = snapshot.syncTargetWorkOrderId?.trim()
  const current = syncTargetWorkOrderId
    ? candidates.find((order) => order.dyeOrderId === syncTargetWorkOrderId)
    : candidates.find((order) => (
        snapshot.processEntryId
          ? order.sourceSnapshot?.processEntryId === snapshot.processEntryId
            && (!snapshot.routeObjectKey || order.sourceSnapshot?.routeObjectKey === snapshot.routeObjectKey)
          : candidates.length === 1
      ))
  if (!current) return { outcome: 'NOT_FOUND', commit: () => undefined, rollback: () => undefined }
  const before = current.formalProductionOrderSnapshot
  if (!before) throw new Error(`染色加工单 ${current.dyeOrderNo} 缺少正式生产单快照`)
  const after = toDyeSnapshotRecord(snapshot)
  const alreadyRecorded = [...(current.changeImpact ?? []), ...(current.autoSyncHistory ?? [])]
    .some((item) => item.changeRecordId === options.changeRecordId)
  if (alreadyRecorded || JSON.stringify(before) === JSON.stringify(after)) {
    return {
      workOrderId: current.dyeOrderId,
      outcome: 'UNCHANGED',
      before,
      after,
      commit: () => undefined,
      rollback: () => undefined,
    }
  }

  const combinedMembership = getProductionChangeProtectedCombinedDyeingMembership(current.dyeOrderId)
  const reason = combinedMembership ? '已加入合并染色' : hasActualDyeExecution(current) ? '已执行' : undefined
  if (reason) {
    const impact: ProcessWorkOrderChangeImpact = {
      changeRecordId: options.changeRecordId,
      before: structuredClone(before),
      after: structuredClone(after),
      reason,
      recordedAt: options.recordedAt,
      suggestedAction: reason === '已加入合并染色'
        ? '由计划员核对合并染色任务；未执行任务可先删除后重新同步，已完成分配需保留原执行事实。'
        : '保留原执行快照，由计划员按实际进度处理数量、物料和交期影响。',
    }
    const next = cloneWorkOrder(current)
    next.changeImpact = [...(current.changeImpact ?? []), structuredClone(impact)]
    let committed = false
    return {
      workOrderId: current.dyeOrderId,
      outcome: 'PROTECTED',
      protectedCombinedMembership: combinedMembership,
      before,
      after,
      impact,
      commit: () => {
        if (committed) return
        workOrderStore.set(current.dyeOrderId, cloneWorkOrder(next))
        committed = true
      },
      rollback: () => {
        if (!committed) return
        workOrderStore.set(current.dyeOrderId, cloneWorkOrder(current))
        committed = false
      },
    }
  }

  const next = cloneWorkOrder(current)
  next.sourceProductionOrderNo = snapshot.productionOrderNo
  next.productionOrderOrderedAt = snapshot.orderedAt
  next.productionOrderIds = [snapshot.productionOrderId]
  next.rawMaterialSku = after.materialId
  next.materialId = after.materialId
  next.composition = after.materialName
  next.targetColor = snapshot.targetColor
  next.dyeProcessName = snapshot.dyeProcessName || '染色'
  next.plannedQty = snapshot.plannedQty
  next.qtyUnit = snapshot.qtyUnit
  next.requiresWaterSoluble = snapshot.requiresWaterSoluble === true
  next.waterSolublePlannedQty = next.requiresWaterSoluble ? snapshot.plannedQty : undefined
  next.waterSolubleCompletedQty = next.requiresWaterSoluble ? 0 : undefined
  next.waterSolubleQtyUnit = next.requiresWaterSoluble ? snapshot.qtyUnit : undefined
  if (snapshot.factoryId !== undefined) {
    next.dyeFactoryId = snapshot.factoryId
    next.dyeFactoryName = snapshot.factoryName || snapshot.factoryId || '待分配工厂'
  }
  next.formalProductionOrderSnapshot = structuredClone(after)
  next.updatedAt = options.recordedAt
  next.remark = `${after.processName}；来源正式生产单 ${snapshot.productionOrderNo}；技术包 ${snapshot.techPackVersionLabel}。`
  next.autoSyncHistory = [...(current.autoSyncHistory ?? []), {
    changeRecordId: options.changeRecordId,
    before: structuredClone(before),
    after: structuredClone(after),
    syncedAt: options.recordedAt,
  }]
  const currentTask = getDyeingTaskById(current.taskId)
  const nextTask = currentTask ? structuredClone(currentTask) : undefined
  const beforeTask = currentTask ? structuredClone(currentTask) : undefined
  if (nextTask) {
    nextTask.productionOrderId = snapshot.productionOrderId
    nextTask.productionOrderNo = snapshot.productionOrderNo
    nextTask.sourceProductionOrderId = snapshot.productionOrderId
    nextTask.spuCode = snapshot.spuCode
    nextTask.spuName = snapshot.spuName
    nextTask.requiredDeliveryDate = snapshot.requiredDeliveryDate
    nextTask.qty = snapshot.plannedQty
    nextTask.qtyUnit = toPdaQtyUnit(snapshot.qtyUnit)
    nextTask.qtyDisplayUnit = snapshot.qtyUnit
    nextTask.processNameZh = after.processName
    nextTask.processBusinessName = after.processName
    nextTask.updatedAt = options.recordedAt
  }
  let committed = false
  return {
    workOrderId: current.dyeOrderId,
    outcome: 'AUTO_SYNCED',
    before,
    after,
    commit: () => {
      if (committed) return
      workOrderStore.set(current.dyeOrderId, cloneWorkOrder(next))
      if (nextTask) registerPdaGenericProcessTask(nextTask)
      committed = true
    },
    rollback: () => {
      if (!committed) return
      workOrderStore.set(current.dyeOrderId, cloneWorkOrder(current))
      if (beforeTask) registerPdaGenericProcessTask(structuredClone(beforeTask))
      committed = false
    },
  }
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
    .filter((record) => Boolean(record.dyeOrderId && visibleIds.has(record.dyeOrderId)))
    .sort((left, right) => left.dyeOrderId.localeCompare(right.dyeOrderId))
    .map((record) => cloneReviewRecord(record))
}

// One synchronous list read; detail getters continue to refresh independently.
export function listDyeWorkOrderListRecords() {
  const orders = listDyeWorkOrders()
  const formulaRecords = listDyeFormulaRecords()
  return orders.map(order => {
    const review = reviewRecordStore.get(order.dyeOrderId)
    const handoverOrderId = workOrderStore.get(order.dyeOrderId)?.handoverOrderId
    const head = handoverOrderId ? getHandoverOrderById(handoverOrderId) : undefined
    return {
      order,
      review: review ? cloneReviewRecord(review) : undefined,
      handoverRecords: head ? getPdaHandoverRecordsByHead(head.handoverId) : [],
      formulaRecords: formulaRecords.filter(formula => formula.dyeOrderId === order.dyeOrderId),
    }
  })
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
    .filter((record) => Boolean(record.dyeOrderId && visibleIds.has(record.dyeOrderId)))
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
    fullHandoverCount: orders.filter((order) => ['FULL_HANDOVER', 'WAIT_MANUAL_COMPLETION', 'COMPLETED'].includes(order.status)).length,
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
      finishedAt: order.status === 'COMPLETED' ? order.updatedAt : undefined,
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

function getDyeFactoryAssignmentError(
  factoryId: string,
  requiresWaterSoluble: boolean,
): string | null {
  if (!factoryId.trim()) return null
  if (!hasActiveFactoryProcessAbility(factoryId, 'DYE')) {
    return '所选工厂不可派单或缺少正式有效的染色能力。'
  }
  if (requiresWaterSoluble && !hasActiveFactoryProcessAbility(factoryId, 'WATER_SOLUBLE')) {
    return '需先水溶的染色加工单只能分配给同时具备水溶和染色能力的工厂。'
  }
  return null
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
  if (!input.processName.trim()) return { ok: false, message: '请填写染色工序。' }
  const factoryAssignmentError = getDyeFactoryAssignmentError(input.factoryId, false)
  if (factoryAssignmentError) return { ok: false, message: factoryAssignmentError }
  const factory = getFactoryMasterRecordById(input.factoryId)!
  const sampleWaitType = input.sampleWaitType ?? 'NONE'
  const plannedQty = input.plannedQty
  const now = nowTimestamp()
  registerDyeProcessWorkOrderGenerationRegistrar()
  const result = ensureProcessWorkOrders({
    source: { sourceType: 'STOCK', stockMaterialId, stockMaterialName },
    processCodes: ['DYE'],
    orderedAt: now,
    materialId: materialSku,
    materialName: stockMaterialName,
    materialItems: [{ sourceBomItemId: stockMaterialId, materialId: materialSku, materialName: stockMaterialName }],
    targetColor: input.targetColor.trim() || '按工艺要求执行',
    plannedQty,
    qtyUnit: normalizedUnit,
    dyeProcessName: input.processName.trim(),
    requiresWaterSoluble: false,
    factoryId: factory.id,
    factoryName: factory.name,
    spuCode: '',
    spuName: stockMaterialName,
    requiredDeliveryDate: plannedFinishAt,
    plannedFinishAt,
    createdBy: input.createdBy,
    dyeSampleWaitType: sampleWaitType,
  })
  return { ok: true, message: '', order: getDyeWorkOrderById(result.dyeWorkOrderId!) }
}

export function validateDyeStartPrerequisite(
  dyeOrderId: string,
  inputQty: number,
): { ok: boolean; message: string } {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!Number.isFinite(inputQty) || inputQty <= 0) return { ok: false, message: '请填写有效的染色投入数量。' }
  const receivedQty = order.materialReceipts?.reduce((sum, item) => sum + item.qty, 0)
  const consumed = (order.completedExecutionBatches ?? []).flat().filter(node => node.nodeCode === 'DYE').reduce((sum, node) => sum + (node.inputQty ?? 0), 0)
  const active = getDyeExecutionNodeRecord(dyeOrderId, 'DYE')
  const restarting = Boolean(getDyeExecutionNodeRecord(dyeOrderId, 'PACK')?.finishedAt)
  if (receivedQty !== undefined && inputQty > receivedQty - consumed - (restarting ? active?.inputQty ?? 0 : 0)) return { ok: false, message: '染色投入不能超过剩余实际接收数量。' }
  if (!order.requiresWaterSoluble) return { ok: true, message: '' }
  const waterNode = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (!waterNode?.finishedAt || order.status === 'PRODUCTION_PAUSED') {
    return { ok: false, message: '请先完成水溶，再开始染色。' }
  }
  const completedQty = order.waterSolubleCompletedQty ?? Number(waterNode.outputQty || 0)
  const availableQty = completedQty - consumed - (restarting ? active?.inputQty ?? 0 : 0)
  if (inputQty > availableQty + 0.000001) {
    return { ok: false, message: '染色投入数量不能超过剩余水溶完成数量，请先完成本批水溶。' }
  }
  return { ok: true, message: '' }
}

export function canContinueDyeWaterSoluble(order: DyeWorkOrder): boolean {
  if (!order.requiresWaterSoluble || ['COMPLETED', 'REJECTED', 'PRODUCTION_PAUSED', 'WATER_SOLUBLE_IN_PROGRESS'].includes(order.status)) return false
  const water = getDyeExecutionNodeRecord(order.dyeOrderId, 'WATER_SOLUBLE')
  const pack = getDyeExecutionNodeRecord(order.dyeOrderId, 'PACK')
  const receivedQty = order.materialReceipts?.reduce((sum, receipt) => sum + receipt.qty, 0)
  if (!water?.finishedAt || !pack?.finishedAt || receivedQty === undefined || receivedQty <= (order.completedWaterSolubleBatches ?? []).reduce((sum, batch) => sum + Number(batch.inputQty || 0), 0) + Number(water.inputQty) + 0.000001) return false
  return getDyeOrderHandoverSummary(order.dyeOrderId).writtenBackQty + 0.000001 >= getCurrentOutputQty(order)
}

export function startDyeWaterSolubleNode(
  dyeOrderId: string,
  operatorName: string,
): { ok: boolean; message: string; order?: DyeWorkOrder; node?: DyeExecutionNodeRecord } {
  return runDyeProcessMutation(() => {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!order.requiresWaterSoluble) return { ok: false, message: '普通染色加工单不需要水溶。' }
  if (order.isFirstOrder && order.sampleWaitType !== 'NONE') {
    const sampleNode = getDyeExecutionNodeRecord(dyeOrderId, 'SAMPLE')
    if (order.sampleStatus !== 'DONE' || !sampleNode?.finishedAt) {
      return { ok: false, message: '请先完成打样并确认色样，再开始水溶。' }
    }
  }
  const materialNode = getDyeExecutionNodeRecord(dyeOrderId, 'INPUT_RECEIVED')
  const vatNode = getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')
  if (!materialNode?.finishedAt || !vatNode?.finishedAt) {
    return { ok: false, message: '请先确认投入接收并完成染缸安排，再开始水溶。' }
  }
  const current = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  const continuing = Boolean(current?.finishedAt && canContinueDyeWaterSoluble(order))
  if (current?.finishedAt && !continuing) return { ok: false, message: '没有新增待水溶原料，或上一批尚未交收完成，请核对后再操作。' }
  if (current?.startedAt && !continuing) return { ok: false, message: '水溶已开始，请勿重复操作。' }
  const receivedQty = order.materialReceipts !== undefined
    ? order.materialReceipts.reduce((sum, receipt) => sum + receipt.qty, 0)
    : Number(materialNode.outputQty)
  const previousInputQty = (order.completedWaterSolubleBatches ?? []).reduce((sum, batch) => sum + Number(batch.inputQty || 0), 0) + (continuing ? Number(current?.inputQty || 0) : 0)
  const actualInputQty = receivedQty - previousInputQty
  if (!Number.isFinite(actualInputQty) || actualInputQty <= 0) {
    return { ok: false, message: '请先记录实际接收数量，再开始水溶。' }
  }
  const mutable = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  if (continuing && current) mutable.completedWaterSolubleBatches = [...(mutable.completedWaterSolubleBatches ?? []), cloneNodeRecord(current)]
  upsertNodeRecord(dyeOrderId, 'WATER_SOLUBLE', () => ({
    nodeRecordId: createNodeRecordId(dyeOrderId, 'WATER_SOLUBLE'),
    dyeOrderId,
    taskId: mutable.taskId,
    nodeCode: 'WATER_SOLUBLE',
    nodeName: DYE_NODE_LABEL.WATER_SOLUBLE,
    operatorUserId: 'USR-DYE',
    operatorName,
    startedAt: now,
    inputQty: actualInputQty,
    outputQty: undefined,
    qtyUnit: mutable.waterSolubleQtyUnit || mutable.qtyUnit,
    remark: '开始水溶',
  }))
  mutable.status = 'WATER_SOLUBLE_IN_PROGRESS'
  updateOrderTimestamp(mutable, now)
  syncWaterSolubleTaskState(mutable)
  return { ok: true, message: '', order: cloneWorkOrder(mutable), node: getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE') }

  })
}

export function completeDyeWaterSolubleNode(
  dyeOrderId: string,
  outputQty: number,
  reason = '',
): { ok: boolean; message: string; order?: DyeWorkOrder; node?: DyeExecutionNodeRecord } {
  return runDyeProcessMutation(() => {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  const current = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (!current?.startedAt || current.finishedAt) return { ok: false, message: '请先开始水溶，且不要重复完成。' }
  if (!Number.isFinite(outputQty) || outputQty < 0) return { ok: false, message: '水溶完成数量必须是大于或等于 0 的有效数字。' }
  const actualInputQty = Number(current.inputQty)
  if (!Number.isFinite(actualInputQty) || actualInputQty <= 0) return { ok: false, message: '当前水溶投入数量未记录，请核对后再完成。' }
  if (outputQty > actualInputQty + 0.000001) return { ok: false, message: '水溶完成数量不能超过已记录的实际投入数量。' }
  const plannedQty = order.waterSolublePlannedQty ?? order.plannedQty
  const previousOutputQty = (order.completedWaterSolubleBatches ?? []).reduce((sum, batch) => sum + Number(batch.outputQty || 0), 0)
  const cumulativeOutputQty = previousOutputQty + outputQty
  if (cumulativeOutputQty + 0.000001 < (order.waterSolubleCompletedQty ?? 0)) {
    return { ok: false, message: '累计水溶完成数量不能少于已经记录的完成数量。' }
  }
  if (cumulativeOutputQty < plannedQty && !reason.trim()) return { ok: false, message: '水溶完成数量不足，请填写原因。' }
  if (cumulativeOutputQty > plannedQty && !reason.trim()) return { ok: false, message: '水溶完成数量超过计划数量，请填写原因。' }
  const mutable = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  mutable.waterSolubleCompletedQty = cumulativeOutputQty
  mutable.status = cumulativeOutputQty < plannedQty ? 'PRODUCTION_PAUSED' : 'WAIT_VAT_PLAN'
  upsertNodeRecord(dyeOrderId, 'WATER_SOLUBLE', () => ({
    ...current,
    finishedAt: now,
    outputQty,
    lossQty: Math.max(0, Math.round((actualInputQty - outputQty) * 1000000) / 1000000),
    remark: cumulativeOutputQty < plannedQty ? `数量不足：${reason.trim()}` : (reason.trim() || '水溶完成，同厂继续染色'),
  }))
  updateOrderTimestamp(mutable, now)
  syncWaterSolubleTaskState(mutable)
  return { ok: true, message: '', order: cloneWorkOrder(mutable), node: getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE') }

  })
}

export function resolveDyeWaterSolublePause(
  dyeOrderId: string,
  decision: DyeWaterSolublePauseDecision,
  supervisor: string,
): { ok: boolean; message: string; order?: DyeWorkOrder } {
  return runDyeProcessMutation(() => {
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

  })
}

export type DyeWaterSolublePdaActionInput =
  | { action: 'START'; dyeOrderId: string; taskId: string; expectedStatus: DyeWorkOrderStatus; expectedNode: 'WATER_SOLUBLE'; actor: WaterSolublePdaActor }
  | { action: 'COMPLETE'; dyeOrderId: string; taskId: string; expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS'; expectedNode: 'WATER_SOLUBLE'; outputQty: number; reason: string; actor: WaterSolublePdaActor }
  | { action: 'RESOLVE_PAUSE'; dyeOrderId: string; taskId: string; expectedStatus: 'PRODUCTION_PAUSED'; expectedNode: 'WATER_SOLUBLE'; decision: DyeWaterSolublePauseDecision; actor: WaterSolublePdaActor }

export function executeDyeWaterSolublePdaAction(
  input: DyeWaterSolublePdaActionInput,
): { ok: boolean; message: string; order?: DyeWorkOrder; node?: DyeExecutionNodeRecord } {
  try { return runDyeProcessMutation(() => {
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
    if (order.status !== 'WAIT_WATER_SOLUBLE' && !canContinueDyeWaterSoluble(order)) return { ok: false, message: '当前没有可继续水溶的批次，请按最新步骤操作。' }
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

  }) } catch(error) { return { ok: false, message: error instanceof Error ? error.message : '染色操作未保存。' } }
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
  return runDyeProcessMutation(() => {
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

  })
}

export function completeDyeSampleWait(dyeOrderId: string, operatorName = '染色工厂'): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.sampleWaitFinishedAt = now
  order.waitingReason = '样衣/色样已到'
  order.remark = operatorName
  syncPreVatStatus(order)
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)

  })
}

export function startDyeMaterialWait(dyeOrderId: string, operatorName = '染色工厂'): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.materialWaitStartedAt = order.materialWaitStartedAt || now
  order.status = 'WAIT_MATERIAL'
  order.waitingReason = '原料面料待到位'
  order.remark = operatorName
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)

  })
}

export function completeDyeMaterialWait(dyeOrderId: string, operatorName = '染色工厂'): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  order.materialWaitFinishedAt = now
  order.waitingReason = '来源原料已到，可确认接收'
  order.remark = operatorName
  syncPreVatStatus(order)
  updateOrderTimestamp(order, now)
  return cloneWorkOrder(order)

  })
}

export function startDyeSampleTest(dyeOrderId: string, operatorName = '染色工厂'): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
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

  })
}

export function completeDyeSampleTest(
  dyeOrderId: string,
  input: { colorNo: string; operatorName?: string },
): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
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

  })
}

export function completeDyeInputReceipt(
  dyeOrderId: string,
  input: { outputQty?: number; operatorName?: string; receiptId?: string; upstreamRecordId?: string },
): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status === 'COMPLETED' || order.status === 'REJECTED') throw new Error('当前加工单不能继续接收。')
  if (!Number.isFinite(input.outputQty) || Number(input.outputQty) < 0) throw new Error('请填写本次实际接收数量。')
  if (!input.receiptId?.trim()) throw new Error('本次接收确认号已失效，请重新打开。')
  if (!input.upstreamRecordId?.trim()) throw new Error('请选择本次接收的来源单据。')
  const receiptId = input.receiptId
  if (order.materialReceipts?.some(item => item.receiptId === receiptId)) throw new Error('本次接收已处理，请勿重复提交。')
  const current = getMutableNodeRecord(dyeOrderId, 'INPUT_RECEIVED')
  const now = nowTimestamp()
  order.materialReceipts = [...(order.materialReceipts ?? []), { receiptId, upstreamRecordId: input.upstreamRecordId, qty: Number(input.outputQty), receiverName: input.operatorName || '染色工厂', receivedAt: now }]
  const receivedQty = order.materialReceipts.reduce((sum, item) => sum + item.qty, 0)
  upsertNodeRecord(dyeOrderId, 'INPUT_RECEIVED', () => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(dyeOrderId, 'INPUT_RECEIVED'),
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'INPUT_RECEIVED',
    nodeName: DYE_NODE_LABEL.INPUT_RECEIVED,
    operatorUserId: current?.operatorUserId || 'USR-DYE',
    operatorName: input.operatorName || current?.operatorName || '染色工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    inputQty: receivedQty,
    outputQty: receivedQty,
    qtyUnit: getQtyUnit(order),
    remark: `来源单据 ${input.upstreamRecordId}；本次接收 ${input.outputQty} ${order.qtyUnit}，累计 ${receivedQty} ${order.qtyUnit}`,
  }))
  syncPreVatStatus(order)
  syncLinkedTaskState(order.taskId, { acceptanceStatus: 'ACCEPTED' })
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'INPUT_RECEIVED')!

  })
}

export function planDyeVat(
  dyeOrderId: string,
  input: { dyeVatNo: string; operatorName?: string },
): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status !== 'WAIT_VAT_PLAN') throw new Error('当前状态不允许排缸。')
  const materialNode = getMutableNodeRecord(dyeOrderId, 'INPUT_RECEIVED')
  if (!materialNode?.finishedAt) throw new Error('请先确认投入接收，再安排染缸。')
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

  })
}

export function startDyeing(
  dyeOrderId: string,
  input: { dyeVatNo: string; inputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
  const validation = validateDyeStartPayload(input)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
  const order = getMutableWorkOrder(dyeOrderId)
  const inputQty = Number.isFinite(input.inputQty) ? Number(input.inputQty) : order.plannedQty
  const prerequisite = validateDyeStartPrerequisite(dyeOrderId, inputQty)
  if (!prerequisite.ok) throw new Error(prerequisite.message)
  const existingDyeNode = getMutableNodeRecord(dyeOrderId, 'DYE')
  if (existingDyeNode?.startedAt) {
    const packed = getMutableNodeRecord(dyeOrderId, 'PACK')
    const summary = getDyeOrderHandoverSummary(dyeOrderId)
    if (!packed?.finishedAt || summary.writtenBackQty + 0.000001 < getCurrentOutputQty(order) || order.status === 'COMPLETED') throw new Error('当前批次尚未交收完成，不能重复开始染色。')
    const processNodes = (nodeRecordStore.get(dyeOrderId) ?? []).filter(node => ['DYE', 'DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK'].includes(node.nodeCode))
    order.completedExecutionBatches = [...(order.completedExecutionBatches ?? []), processNodes.map(cloneNodeRecord)]
    nodeRecordStore.set(dyeOrderId, (nodeRecordStore.get(dyeOrderId) ?? []).filter(node => !processNodes.includes(node)))
  }
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

  })
}

export function completeDyeing(
  dyeOrderId: string,
  input: { inputQty?: number; outputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
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
  if (order.materialReceipts?.length && (!Number.isFinite(outputQty) || outputQty < 0 || outputQty > Number(current.inputQty))) throw new Error('染色完成数量不能超过本批实际投入。')
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

  })
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
  return runDyeProcessMutation(() => {
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

  })
}

export function completeDyeNode(
  dyeOrderId: string,
  nodeCode: Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>,
  input: { outputQty?: number; operatorName?: string },
): DyeExecutionNodeRecord {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  assertDyePostNodeReady(order, nodeCode)
  const current = getMutableNodeRecord(dyeOrderId, nodeCode)
  if (!current?.startedAt) {
    throw new Error(`请先开始${DYE_NODE_LABEL[nodeCode]}，再确认完成。`)
  }
  if (current.finishedAt) {
    throw new Error(`${DYE_NODE_LABEL[nodeCode]}已经完成，请勿重复操作。`)
  }
  const actualOutput = Number.isFinite(input.outputQty) ? Number(input.outputQty) : Number(getMutableNodeRecord(dyeOrderId, DYE_POST_NODE_PREDECESSOR[nodeCode])?.outputQty || 0)
  const priorOutput = getMutableNodeRecord(dyeOrderId, DYE_POST_NODE_PREDECESSOR[nodeCode])?.outputQty ?? 0
  if (order.materialReceipts?.length && (actualOutput < 0 || actualOutput > priorOutput)) throw new Error('本节点完成数量不能超过前序实际产出。')
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
    outputQty: actualOutput,
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

  })
}

export function submitDyeHandover(
  dyeOrderId: string,
  input: { handoverQty?: number; handoverPerson?: string; handoverAt?: string; remark?: string; yarn?: {commandId:string;grossKg:number;pcs:number;tubes:YarnTubeCounts;receiverFactoryId:string;woolOrderId?:string} } = {},
): { handoverOrderId?: string; recordIds: string[] } {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  if (!['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'PARTIAL_HANDOVER'].includes(order.status)) {
    throw new Error('请先完成染色及全部后处理，包装完成后再交出。')
  }
  const yarnOrder = order.qtyUnit.toLowerCase() === 'kg' && /纱|yarn/i.test(`${order.rawMaterialSku} ${order.stockMaterialName}`)
  if (yarnOrder && !input.yarn) throw new Error('纱线交出必须登记 pcs、毛重和管型，请使用纱线整单交出。')
  const yarn = input.yarn ? calculateYarnWeight(input.yarn.grossKg, input.yarn.tubes, input.yarn.pcs) : undefined
  if (input.yarn && (!yarnOrder || !input.yarn.commandId.trim() || input.yarn.receiverFactoryId !== 'OWN_WOOL_FACTORY')) throw new Error('请核对纱线染色单、交出确认号和毛织接收工厂。')
  const previousYarnSources = listFactoryReceivingSources(undefined, true).filter(s => s.type === 'HANDOUT' && !s.voidedAt && s.workOrderNo === order.dyeOrderNo && s.lines.some(l => l.yarn))
  const completedQty = getCurrentOutputQty(order)
  const submittedQty = Math.max(listHandoverOrdersByTaskId(order.taskId).reduce((sum, head) => sum + (head.submittedQtyTotal ?? 0), 0), previousYarnSources.reduce((n,s) => n + s.lines.reduce((x,l) => x + (l.yarn?.netGrams ?? 0)/1000, 0),0))
  if (yarn && input.yarn) {
    const old = getFactoryReceivingSource(`YARN-SHIP-${input.yarn.commandId}`)
    if (old) {
      if (old.workOrderNo !== order.dyeOrderNo || old.targetFactoryId !== input.yarn.receiverFactoryId || old.lines[0].woolOrderId !== input.yarn.woolOrderId || JSON.stringify(old.lines[0].yarn) !== JSON.stringify(yarn)) throw new Error('交出确认号已被另一组数量使用。')
      return {handoverOrderId:order.handoverOrderId,recordIds:old.originalRecordId ? [old.originalRecordId] : []}
    }
    assertYarnShipment(order.yarnOrderedWeightKg ?? order.plannedQty, previousYarnSources.reduce((n,s)=>n+s.lines.reduce((x,l)=>x+(l.yarn?.grossGrams??0),0),0), yarn, completedQty-submittedQty)
    if (input.handoverQty !== undefined && Math.abs(input.handoverQty-yarn.netGrams/1000)>.000001) throw new Error('纱线交出库存数量必须等于净重。')
  }
  const requestedQty = yarn ? yarn.netGrams/1000 : Number.isFinite(input.handoverQty) ? Number(input.handoverQty) : completedQty
  const reservedQty = listDyeDispatchDocuments().filter(doc => doc.status === '草稿').flatMap(doc => doc.lines).filter(line => line.orderId === dyeOrderId).reduce((sum, line) => sum + line.rolls.reduce((n, roll) => n + roll.qty, 0), 0)
  const availableQty = Math.max(completedQty - submittedQty - reservedQty, 0)
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) throw new Error('交出数量必须大于 0。')
  if (requestedQty > availableQty + 0.000001) {
    throw new Error(`交出数量不能超过已完工未交出数量 ${availableQty} ${order.qtyUnit}。`)
  }
  const now = input.handoverAt || nowTimestamp()
  if (!order.handoverOrderId) {
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  const result = ensureSeededHandoverRecord({
    createNewBatch: true,
    submittedBy: input.handoverPerson,
    taskId: order.taskId,
    submittedQty: requestedQty,
    submittedAt: now,
  })
  if (yarn && input.yarn) {
    if (!result.recordIds.length) throw new Error('未能生成实际交出记录，请检查任务开工和接收方。')
    const id = `YARN-SHIP-${input.yarn.commandId}`
    registerFactoryReceivingSource({id,documentNo:id,type:'HANDOUT',origin:{kind:'FACTORY',id:order.dyeFactoryId,name:order.dyeFactoryName,factoryType:'染色厂'},targetFactoryId:input.yarn.receiverFactoryId,targetFactoryName:'周哥毛织厂',createdAt:now,createdBy:input.handoverPerson||'hilon',handedOutAt:now,workOrderNo:order.dyeOrderNo,originalRecordId:result.recordIds[0],lines:[{id:`${id}-L1`,material:{...RECEIVING_YARN_MATERIAL,sku:order.rawMaterialSku},plannedQty:order.plannedQty,sentQty:requestedQty,unit:'kg',rolls:[],label:`YARN:${order.dyeOrderNo}`,yarn,woolOrderId:input.yarn.woolOrderId,taskNo:order.taskNo}]})
  }
  order.handoverOrderId = result.handoverOrderId || order.handoverOrderId
  order.status = 'HANDOVER_WAIT_RECEIVE'
  order.remark = input.remark?.trim() || order.remark
  updateOrderTimestamp(order, now)
  syncDerivedWorkflow()
  return result

  })
}

function getMutableDyeReceiptReview(dyeOrderId: string): { order: MutableDyeWorkOrder; review: MutableDyeReviewRecord } {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status === 'COMPLETED') {
    throw new Error('染色加工单已由人工完成，不能再修改收货结果。')
  }
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
  if (order.status === 'COMPLETED') {
    throw new Error('染色加工单已由人工完成，不能再修改收货结果。')
  }
  order.status = review.reviewStatus === 'WAIT_RECEIVE'
    ? 'HANDOVER_WAIT_RECEIVE'
    : review.reviewStatus === 'REJECTED'
      ? 'HANDOVER_DIFFERENCE'
      : review.reviewStatus === 'FULL_HANDOVER'
        ? 'WAIT_MANUAL_COMPLETION'
        : review.reviewStatus
  if (review.reviewStatus === 'FULL_HANDOVER') {
    syncLinkedTaskState(order.taskId, {
      status: 'IN_PROGRESS',
      finishedAt: undefined,
      blockReason: undefined,
      blockRemark: undefined,
    })
  } else if (review.reviewStatus === 'HANDOVER_DIFFERENCE' || review.reviewStatus === 'REJECTED') {
    syncLinkedTaskState(order.taskId, {
      status: 'BLOCKED',
      finishedAt: undefined,
      blockReason: 'MATERIAL',
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

export function completeDyeWorkOrderDocument(
  dyeOrderId: string,
  input: { completedBy?: string; completedAt?: string; remark?: string } = {},
): DyeWorkOrder {
  return runDyeProcessMutation(() => {
  const order = getMutableWorkOrder(dyeOrderId)
  if (order.status !== 'WAIT_MANUAL_COMPLETION') {
    throw new Error(`当前状态为“${DYE_WORK_ORDER_STATUS_LABEL[order.status]}”，不能人工完成单据。`)
  }
  const review = reviewRecordStore.get(dyeOrderId)
  const records = order.handoverOrderId ? getPdaHandoverRecordsByHead(order.handoverOrderId).filter(record => record.handoverRecordStatus !== 'VOIDED') : []
  const outputQty = getCurrentOutputQty(order)
  const receivedQty = records.reduce((sum, record) => sum + Number(record.receiverWrittenQty || 0), 0)
  if (!review || review.reviewStatus !== 'FULL_HANDOVER' || !records.length || outputQty <= 0
    || records.some(record => !record.receiverWrittenAt || !record.receiverWrittenBy || record.receiverWrittenQty === undefined || Math.abs(record.receiverWrittenQty - Number(record.submittedQty ?? record.plannedQty ?? 0)) > 0.000001)
    || Math.abs(receivedQty - outputQty) > 0.000001) {
    throw new Error('全部加工产出确认收货后，才能人工完成单据。')
  }
  const completedAt = input.completedAt?.trim() || nowTimestamp()
  const completedBy = input.completedBy?.trim()
  if (!completedBy) throw new Error('请使用具名操作账号确认完单。')
  order.status = 'COMPLETED'
  order.documentCompletedBy = completedBy
  order.documentCompletedAt = completedAt
  order.remark = input.remark?.trim() || `加工单由${completedBy}人工确认完成`
  updateOrderTimestamp(order, completedAt)
  syncLinkedTaskState(order.taskId, {
    status: 'DONE',
    finishedAt: completedAt,
    blockReason: undefined,
    blockRemark: undefined,
  })
  return cloneWorkOrder(order)

  })
}

export function confirmDyeReceipt(
  dyeOrderId: string,
  input: { receivedBy: string; receivedQty?: number; remark?: string },
): DyeReviewRecord {
  return runDyeProcessMutation(() => {
  const { order, review } = getMutableDyeReceiptReview(dyeOrderId)
  const receivedQty = Number.isFinite(input.receivedQty) ? Number(input.receivedQty) : review.submittedQty
  const receivedAt = nowTimestamp()
  const expectedQty = getCurrentOutputQty(order) || order.plannedQty
  const onlineEvent = {
    dyeOrderId,
    receivedBy: input.receivedBy,
    receivedAt,
    receivedQty,
    expectedQty,
  }
  validateDyeReceiptOnlineStatus(onlineEvent)
  review.receivedQty = receivedQty
  review.diffQty = Number((receivedQty - review.submittedQty).toFixed(2))
  review.reviewStatus = resolveDyeReceiptStatus({
    completedQty: getCurrentOutputQty(order) || order.plannedQty,
    submittedQty: review.submittedQty,
    receivedQty,
  })
  review.reviewedBy = input.receivedBy
  review.reviewedAt = receivedAt
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
  notifyDyeReceiptOnlineStatus(onlineEvent)
  return cloneReviewRecord(review)

  })
}

export function markDyeReceiptDifference(
  dyeOrderId: string,
  input: { receivedBy: string; receivedQty?: number; differenceReason: string; remark?: string },
): DyeReviewRecord {
  return runDyeProcessMutation(() => {
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
  review.remark = input.remark?.trim() || '指定接收方收货差异'
  applyDyeReceiptState(order, review)
  updateOrderTimestamp(order, review.reviewedAt)
  return cloneReviewRecord(review)

  })
}

export function approveDyeReview(
  dyeOrderId: string,
  input: { reviewedBy: string; remark?: string },
): DyeReviewRecord {
  return runDyeProcessMutation(() => {
  return confirmDyeReceipt(dyeOrderId, { receivedBy: input.reviewedBy, remark: input.remark })

  })
}

export function rejectDyeReview(
  dyeOrderId: string,
  input: { reviewedBy: string; rejectReason: string; remark?: string },
): DyeReviewRecord {
  return runDyeProcessMutation(() => {
  return markDyeReceiptDifference(dyeOrderId, {
    receivedBy: input.reviewedBy,
    differenceReason: input.rejectReason,
    remark: input.remark,
  })

  })
}

// 染色产出卷与交出单：附着原加工单，复用原事务及正式单保存范围。
export function getDyeOutputRolls(id: string): DyeOutputRoll[] {
  return structuredClone(getMutableWorkOrder(id).outputRolls ?? [])
}
export function listDyeDispatchDocuments(): DyeDispatchDocument[] {
  seedDomain()
  return structuredClone(Array.from(workOrderStore.values()).flatMap(order => order.dispatchDocuments ?? []))
}
function dyeRollReserved(id: string, rollId: string): boolean {
  return Array.from(workOrderStore.values()).some(order => order.dispatchDocuments?.some(doc => doc.status === '草稿' && doc.lines.some(line => line.orderId === id && line.rolls.some(roll => roll.id === rollId))))
}
export function saveDyeOutputRolls(id: string, inputs: Array<Partial<DyeOutputRoll>>): DyeOutputRoll[] {
  return runDyeProcessMutation(() => {
    const order = getMutableWorkOrder(id)
    const rolls = order.outputRolls ??= []
    if (!inputs.length) throw new Error('请先选择或填写条码。')
    for (const input of inputs) {
      const existing = input.id ? rolls.find(roll => roll.id === input.id) : undefined
      if (input.id && !existing) throw new Error('条码不存在，请重新查询。')
      if (existing && (existing.dispatchId || dyeRollReserved(id, existing.id))) throw new Error('条码已被交出单占用，不能修改。')
      const nextNumber = Math.max(order.nextOutputRollNo || 1, Math.max(0, ...rolls.map(roll => Number(roll.rollNo))) + 1)
      const nextNo = String(nextNumber).padStart(4, '0')
      if (!existing) order.nextOutputRollNo = nextNumber + 1
      const roll: DyeOutputRoll = { id: `${id}-${nextNo}`, barcode: `${order.dyeOrderNo}_${nextNo}`, rollNo: nextNo, qty: 0, weightKg: 0, widthCm: DYE_DEMO_DETAILS[id]?.widthCm ?? (parseFloat(order.width || '') || 0), gsm: DYE_DEMO_DETAILS[id]?.gsm ?? order.weightGsm ?? 0, vatNo: '', remark: '', createdAt: nowTimestamp(), warehouseName: order.targetTransferWarehouseName, locationName: '待上架', inboundStatus: '未入库', ...existing }
      for (const key of ['qty', 'weightKg', 'widthCm', 'gsm'] as const) {
        if (input[key] !== undefined) roll[key] = Number(input[key])
        if (!Number.isFinite(roll[key]) || roll[key] < 0) throw new Error('数量、重量、幅宽和克重必须为非负数字。')
      }
      roll.qty = Number(roll.qty.toFixed(2)); roll.weightKg = Number(roll.weightKg.toFixed(3))
      if (input.vatNo !== undefined) roll.vatNo = input.vatNo.trim()
      if (input.remark !== undefined) roll.remark = input.remark.trim()
      if (existing) Object.assign(existing, roll)
      else rolls.push(roll)
    }
    return structuredClone(rolls)
  })
}
export function deleteDyeOutputRolls(id: string, ids: string[]): void {
  runDyeProcessMutation(() => {
    const order = getMutableWorkOrder(id)
    if (!ids.length) throw new Error('请先选择条码。')
    if (ids.some(key => !(order.outputRolls ?? []).some(roll => roll.id === key && !roll.dispatchId && !dyeRollReserved(id, key)))) throw new Error('条码不存在或已被交出单占用，不能删除。')
    order.outputRolls = order.outputRolls?.filter(roll => !ids.includes(roll.id))
  })
}
export function markDyeOutputRolls(id: string, ids: string[], action: 'print' | 'stage'): void {
  runDyeProcessMutation(() => {
    const order = getMutableWorkOrder(id)
    const rolls = ids.map(key => order.outputRolls?.find(roll => roll.id === key))
    if (!rolls.length || rolls.some(roll => !roll || roll.qty <= 0)) throw new Error('请先维护有效数量，再打印或下架。')
    if (action === 'stage' && rolls.some(roll => roll?.dispatchId)) throw new Error('已交出卷不能重复下架。')
    for (const roll of rolls) if (roll) {
      if (action === 'print') { roll.printedAt = nowTimestamp(); roll.printedBy = '原型操作员' }
      else roll.stagedAt = nowTimestamp()
    }
  })
}
export function getDyeDispatchAvailableQty(id: string): number {
  const order = getMutableWorkOrder(id)
  const submitted=listHandoverOrdersByTaskId(order.taskId).reduce((sum, head) => sum + (head.submittedQtyTotal ?? 0), 0)
  const yarnSubmitted=listFactoryReceivingSources(undefined,true).filter(s=>!s.voidedAt&&s.type==='HANDOUT'&&s.workOrderNo===order.dyeOrderNo).reduce((n,s)=>n+s.lines.reduce((a,l)=>a+(l.yarn?.netGrams||0)/1000,0),0)
  return Math.max(0, getCurrentOutputQty(order)-Math.max(submitted,yarnSubmitted))
}
export function isDyeRollAvailable(id: string, roll: DyeOutputRoll): boolean {
  return roll.qty > 0 && !roll.dispatchId && !dyeRollReserved(id, roll.id) && getDyeDispatchAvailableQty(id) >= roll.qty
}
export function createDyeDispatchDocument(selections: { orderId: string; rollIds: string[] }[], operator: string, mergeId?: string): DyeDispatchDocument {
  return runDyeProcessMutation(() => {
    if (!operator.trim()) throw new Error('请填写交出操作人。')
    const owner = Array.from(workOrderStore.values()).find(order => order.dispatchDocuments?.some(doc => doc.id === mergeId))
    const existing = owner?.dispatchDocuments?.find(doc => doc.id === mergeId)
    if (mergeId && (!existing || existing.status !== '草稿')) throw new Error('只能合入已有草稿。')
    if (!selections.length || selections.some(item => !item.rollIds.length)) throw new Error('请选择待交出的卷。')
    const doc: DyeDispatchDocument = existing ?? { id: `SJ-DYE-${Date.now()}-${listDyeDispatchDocuments().length + 1}`, status: '草稿', createdAt: nowTimestamp(), operator: operator.trim(), lines: [] }
    for (const selection of selections) {
      const order = getMutableWorkOrder(selection.orderId)
      if (order.yarnOrderedWeightKg !== undefined) throw new Error('纱线按一单一码交出，请使用纱线交出页面。')
      if (doc.lines.length && doc.lines[0].factoryName !== order.dyeFactoryName) throw new Error('不同加工厂请分别建单。')
      const rolls = selection.rollIds.map(key => order.outputRolls?.find(roll => roll.id === key))
      if (new Set(selection.rollIds).size !== selection.rollIds.length || rolls.some(roll => !roll || !isDyeRollAvailable(order.dyeOrderId, roll))) throw new Error('存在未维护、已占用或未完成包装的卷，请重新选择。')
      let line = doc.lines.find(item => item.orderId === order.dyeOrderId)
      if (!line) { line = { orderId: order.dyeOrderId, orderNo: order.dyeOrderNo, taskNo: order.taskNo, factoryName: order.dyeFactoryName, receiver: order.receiverName, sku: DYE_DEMO_DETAILS[order.dyeOrderId]?.outputSku || order.rawMaterialSku, unit: order.qtyUnit, rolls: [] }; doc.lines.push(line) }
      if (rolls.some(roll => line!.rolls.some(old => old.id === roll!.id))) throw new Error('同卷不能重复建单。')
      line.rolls.push(...structuredClone(rolls as DyeOutputRoll[]))
      const otherReserved = listDyeDispatchDocuments().filter(item => item.status === '草稿' && item.id !== doc.id).flatMap(item => item.lines).filter(item => item.orderId === order.dyeOrderId).reduce((sum, item) => sum + item.rolls.reduce((n, roll) => n + roll.qty, 0), 0)
      if (line.rolls.reduce((sum, roll) => sum + roll.qty, 0) + otherReserved > getDyeDispatchAvailableQty(order.dyeOrderId) + 0.001) throw new Error('所选卷数量超过包装完成后可交数量。')
    }
    if (!existing) (getMutableWorkOrder(selections[0].orderId).dispatchDocuments ??= []).push(doc)
    return structuredClone(doc)
  })
}
export function finishDyeDispatchDocument(id: string, action: 'confirm' | 'void'): DyeDispatchDocument {
  return runDyeProcessMutation(() => {
    const doc = Array.from(workOrderStore.values()).flatMap(order => order.dispatchDocuments ?? []).find(item => item.id === id)
    if (!doc || doc.status !== '草稿') throw new Error('只能操作草稿交出单。')
    if (action === 'void') { doc.status = '已作废'; return structuredClone(doc) }
    for (const line of doc.lines) {
      const order = getMutableWorkOrder(line.orderId)
      if (order.receiverName !== line.receiver || order.dyeFactoryName !== line.factoryName || order.qtyUnit !== line.unit) throw new Error('原单工厂、接收方或单位已变化，请作废后重新建单。')
      if (line.rolls.some(snapshot => !order.outputRolls?.some(roll => roll.id === snapshot.id && !roll.dispatchId && roll.qty === snapshot.qty))) throw new Error('卷记录已变化，请重新建单。')
    }
    doc.status = '已交出'
    for (const line of doc.lines) {
      submitDyeHandover(line.orderId, { handoverQty: line.rolls.reduce((sum, roll) => sum + roll.qty, 0), handoverPerson: doc.operator })
      for (const roll of getMutableWorkOrder(line.orderId).outputRolls ?? []) if (line.rolls.some(item => item.id === roll.id)) roll.dispatchId = doc.id
    }
    doc.handedOverAt = nowTimestamp()
    return structuredClone(doc)
  })
}
