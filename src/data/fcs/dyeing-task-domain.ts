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
import { listPdaGenericProcessTasks, type PdaGenericTaskMock } from './pda-task-mock-factory.ts'
import { type HandoverReceiverKind } from './process-tasks.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'

export type DyeWorkOrderStatus =
  | 'WAIT_SAMPLE'
  | 'WAIT_MATERIAL'
  | 'SAMPLE_TESTING'
  | 'SAMPLE_DONE'
  | 'MATERIAL_READY'
  | 'WAIT_VAT_PLAN'
  | 'DYEING'
  | 'DEHYDRATING'
  | 'DRYING'
  | 'SETTING'
  | 'ROLLING'
  | 'PACKING'
  | 'WAIT_HANDOVER'
  | 'HANDOVER_SUBMITTED'
  | 'RECEIVER_WRITTEN_BACK'
  | 'WAIT_REVIEW'
  | 'REVIEWING'
  | 'COMPLETED'
  | 'REJECTED'

export type SampleWaitType = 'NONE' | 'WAIT_SAMPLE_GARMENT' | 'WAIT_COLOR_CARD'
export type SampleStatus = 'NOT_REQUIRED' | 'WAITING' | 'TESTING' | 'DONE'
export type DyeExecutionNodeCode =
  | 'SAMPLE'
  | 'MATERIAL_READY'
  | 'VAT_PLAN'
  | 'DYE'
  | 'DEHYDRATE'
  | 'DRY'
  | 'SET'
  | 'ROLL'
  | 'PACK'
  | 'HANDOVER'
  | 'REVIEW'
export type DyeReviewStatus = 'WAIT_REVIEW' | 'PASS' | 'REJECTED' | 'PARTIAL_PASS'

export interface DyeWorkOrder {
  dyeOrderId: string
  dyeOrderNo: string
  sourceType: 'PRODUCTION_ORDER'
  sourceDemandIds: string[]
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
  waitWritebackCount: number
  waitReviewCount: number
  completedCount: number
  rejectedCount: number
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
  DYEING: '染色中',
  DEHYDRATING: '脱水中',
  DRYING: '烘干中',
  SETTING: '定型中',
  ROLLING: '打卷中',
  PACKING: '包装中',
  WAIT_HANDOVER: '待送货',
  HANDOVER_SUBMITTED: '待回写',
  RECEIVER_WRITTEN_BACK: '待审核',
  WAIT_REVIEW: '待审核',
  REVIEWING: '审核中',
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
  DYE: '染色',
  DEHYDRATE: '脱水',
  DRY: '烘干',
  SET: '定型',
  ROLL: '打卷',
  PACK: '包装',
  HANDOVER: '待送货',
  REVIEW: '审核',
}

export const DYE_REVIEW_STATUS_LABEL: Record<DyeReviewStatus, string> = {
  WAIT_REVIEW: '待审核',
  PASS: '审核通过',
  REJECTED: '审核驳回',
  PARTIAL_PASS: '部分通过',
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

function cloneWorkOrder(order: MutableDyeWorkOrder): DyeWorkOrder {
  return {
    ...order,
    sourceDemandIds: [...order.sourceDemandIds],
    productionOrderIds: order.productionOrderIds ? [...order.productionOrderIds] : undefined,
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
      return '包装完成待送货'
    case 'HANDOVER_SUBMITTED':
      return '已交出待接收方回写'
    case 'RECEIVER_WRITTEN_BACK':
      return '接收方已回写'
    case 'WAIT_REVIEW':
      return '接收方回写后待审核'
    case 'REVIEWING':
      return '审核处理中'
    case 'REJECTED':
      return '审核驳回待处理'
    case 'COMPLETED':
      return '已完成'
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

function createReviewFromHandover(order: MutableDyeWorkOrder, head: PdaHandoverHead): MutableDyeReviewRecord {
  const records = getPdaHandoverRecordsByHead(head.handoverId)
  return {
    reviewRecordId: `DRV-${order.dyeOrderId}`,
    dyeOrderId: order.dyeOrderId,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverRecordIds: records.map((record) => record.handoverRecordId),
    receiverName: order.targetTransferWarehouseName,
    submittedQty: head.submittedQtyTotal ?? 0,
    receivedQty: head.writtenBackQtyTotal ?? 0,
    diffQty: head.diffQtyTotal ?? 0,
    receivedRollCount: order.plannedRollCount ? Math.max(1, order.plannedRollCount - (head.diffQtyTotal ? 1 : 0)) : undefined,
    receivedLength: head.writtenBackQtyTotal ? Number((head.writtenBackQtyTotal * 0.82).toFixed(1)) : undefined,
    lengthUnit: '米',
    reviewStatus: 'WAIT_REVIEW',
    remark: '接收方回写后待审核',
  }
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
    || order.status === 'HANDOVER_SUBMITTED'
    || order.status === 'RECEIVER_WRITTEN_BACK'
    || order.status === 'WAIT_REVIEW'
    || order.status === 'REVIEWING'
    || order.status === 'COMPLETED'
    || order.status === 'REJECTED'
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
    } else if (!order.handoverOrderId) {
      const ensured = ensureStartedTaskHandover(order.taskId)
      if (ensured) {
        const nextHead = getHandoverOrderById(ensured)
        order.handoverOrderId = ensured
        order.handoverOrderNo = nextHead?.handoverOrderNo
      }
    }

    const review = reviewRecordStore.get(order.dyeOrderId)
    if (review?.reviewStatus === 'PASS') {
      order.status = 'COMPLETED'
      continue
    }
    if (review?.reviewStatus === 'REJECTED') {
      order.status = 'REJECTED'
      continue
    }

    if (head && (head.writtenBackQtyTotal ?? 0) > 0) {
      if (!review) {
        reviewRecordStore.set(order.dyeOrderId, createReviewFromHandover(order, head))
      } else {
        review.handoverOrderId = head.handoverOrderId || head.handoverId
        review.submittedQty = head.submittedQtyTotal ?? review.submittedQty
        review.receivedQty = head.writtenBackQtyTotal ?? review.receivedQty
        review.diffQty = head.diffQtyTotal ?? review.diffQty
      }
      if (reviewRecordStore.get(order.dyeOrderId)?.reviewStatus === 'WAIT_REVIEW') {
        order.status = 'WAIT_REVIEW'
      }
      continue
    }

    if (head && (head.recordCount ?? 0) > 0 && (head.pendingWritebackCount ?? 0) > 0) {
      order.status = 'HANDOVER_SUBMITTED'
      continue
    }

    if (head && (head.recordCount ?? 0) > 0) {
      order.status = 'HANDOVER_SUBMITTED'
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
> & {
  dispatchPrice?: number
}): void {
  const task = getDyeingTaskById(input.taskId)
  const handoverOrder = input.handoverOrderId ? getHandoverOrderById(input.handoverOrderId) : getPrimaryHandoverOrder(input.taskId)
  if (task) {
    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = 'ASSIGNED'
    task.acceptanceStatus = 'ACCEPTED'
    task.tenderId = undefined
    task.awardedAt = undefined
    task.dispatchedBy = '平台派单'
    task.dispatchRemark = '染色加工单派单后直接进入执行待加工'
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
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-27 15:00:00',
    finishedAt: '2026-03-28 18:00:00',
  })
  syncLinkedTaskState('TASK-DYE-000730', {
    status: 'BLOCKED',
    acceptanceStatus: 'ACCEPTED',
    startedAt: '2026-03-27 16:00:00',
    finishedAt: undefined,
    blockReason: 'QUALITY',
    blockRemark: '中转审核驳回',
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
    sourceDemandIds: ['DM-DYE-001'],
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
    sourceDemandIds: ['DM-DYE-002'],
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
    sourceDemandIds: ['DM-DYE-003'],
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
    sourceDemandIds: ['DM-DYE-004'],
    productionOrderIds: ['PO-20260328-404'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 08:30:00',
    materialWaitFinishedAt: '2026-03-28 09:10:00',
    colorNo: 'C-206',
    rawMaterialSku: 'FAB-DYE-004',
    composition: '针织棉',
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
    sourceDemandIds: ['DM-DYE-005'],
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
    sourceDemandIds: ['DM-DYE-006'],
    productionOrderIds: ['PO-20260328-406'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 08:00:00',
    materialWaitFinishedAt: '2026-03-28 08:30:00',
    colorNo: 'C-612',
    rawMaterialSku: 'FAB-DYE-006',
    composition: '针织棉',
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
    sourceDemandIds: ['DM-DYE-007'],
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
    waitingReason: '包装完成待送货',
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
      remark: '包装完成待送货',
    },
  ])

  addSeedWorkOrder({
    dyeOrderId: DYE_WORK_ORDER_IDS[7],
    dyeOrderNo: 'DY-20260328-008',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['DM-DYE-008'],
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
    status: 'HANDOVER_SUBMITTED',
    taskId: 'TASK-DYE-000728',
    taskNo: 'TASK-DYE-000728',
    handoverOrderId: orderSubmitted.handoverOrderId,
    waitingReason: '已交出待回写',
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
    sourceDemandIds: ['DM-DYE-009'],
    productionOrderIds: ['PO-20260328-416'],
    isFirstOrder: false,
    sampleWaitType: 'NONE',
    sampleStatus: 'NOT_REQUIRED',
    materialWaitStartedAt: '2026-03-28 09:00:00',
    materialWaitFinishedAt: '2026-03-28 09:25:00',
    colorNo: 'C-330',
    rawMaterialSku: 'FAB-DYE-009',
    composition: '针织棉',
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
    waitingReason: '接收方回写后待审核',
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
    sourceDemandIds: ['DM-DYE-010'],
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
    status: 'REJECTED',
    taskId: 'TASK-DYE-000730',
    taskNo: 'TASK-DYE-000730',
    handoverOrderId: orderRejected.handoverOrderId,
    waitingReason: '审核驳回待处理',
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
    sourceDemandIds: ['DM-DYE-011'],
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
    status: 'COMPLETED',
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
    sourceDemandIds: ['DM-DYE-012'],
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
    sourceDemandIds: ['DM-DYE-013'],
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
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[8], {
      ...createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[8])!, waitReviewHead),
      reviewStatus: 'WAIT_REVIEW',
      remark: '接收方回写后待审核',
    })
  }

  const rejectedHead = orderRejected.handoverOrderId ? getHandoverOrderById(orderRejected.handoverOrderId) : undefined
  if (rejectedHead) {
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[9], {
      ...createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[9])!, rejectedHead),
      reviewStatus: 'REJECTED',
      reviewedBy: '中转审核员',
      reviewedAt: '2026-03-28 19:40:00',
      rejectReason: '卷数与长度复核不一致',
      remark: '中转区域审核驳回',
    })
  }

  const completedHead = orderCompleted.handoverOrderId ? getHandoverOrderById(orderCompleted.handoverOrderId) : undefined
  if (completedHead) {
    reviewRecordStore.set(DYE_WORK_ORDER_IDS[10], {
      ...createReviewFromHandover(workOrderStore.get(DYE_WORK_ORDER_IDS[10])!, completedHead),
      reviewStatus: 'PASS',
      reviewedBy: '中转审核员',
      reviewedAt: '2026-03-29 18:10:00',
      remark: '中转区域审核通过',
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
    remark: '中转审核驳回后待复核',
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
    remark: '已审核通过',
  })
}

function seedDomain(): void {
  if (seeded) return
  seeded = true
  seedWorkOrders()
  syncDerivedWorkflow()
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

export function getSampleWaitTypeLabel(type: SampleWaitType): string {
  return SAMPLE_WAIT_TYPE_LABEL[type]
}

export function getDyeReviewStatusLabel(status: DyeReviewStatus): string {
  return DYE_REVIEW_STATUS_LABEL[status]
}

export function listDyeWorkOrders(): DyeWorkOrder[] {
  syncDerivedWorkflow()
  return Array.from(workOrderStore.values())
    .sort((left, right) => left.dyeOrderNo.localeCompare(right.dyeOrderNo))
    .map((order) => cloneWorkOrder(order))
}

export function getDyeWorkOrderById(dyeOrderId: string): DyeWorkOrder | undefined {
  syncDerivedWorkflow()
  const order = workOrderStore.get(dyeOrderId)
  return order ? cloneWorkOrder(order) : undefined
}

export function getDyeWorkOrderByTaskId(taskId: string): DyeWorkOrder | undefined {
  syncDerivedWorkflow()
  const order = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  return order ? cloneWorkOrder(order) : undefined
}

export function listDyeExecutionNodeRecords(dyeOrderId?: string): DyeExecutionNodeRecord[] {
  seedDomain()
  if (dyeOrderId) {
    return (nodeRecordStore.get(dyeOrderId) ?? []).map((record) => cloneNodeRecord(record))
  }
  return Array.from(nodeRecordStore.values()).flat().map((record) => cloneNodeRecord(record))
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
  return Array.from(reviewRecordStore.values())
    .sort((left, right) => left.dyeOrderId.localeCompare(right.dyeOrderId))
    .map((record) => cloneReviewRecord(record))
}

export function getDyeReviewRecordByOrderId(dyeOrderId: string): DyeReviewRecord | undefined {
  syncDerivedWorkflow()
  const review = reviewRecordStore.get(dyeOrderId)
  return review ? cloneReviewRecord(review) : undefined
}

export function listDyeVatSchedules(): DyeVatSchedule[] {
  seedDomain()
  return Array.from(vatScheduleStore.values())
    .sort((left, right) => left.plannedStartAt.localeCompare(right.plannedStartAt))
    .map((schedule) => cloneVatSchedule(schedule))
}

export function listDyeVatOptions(factoryId: string) {
  return listFactoryDyeVatCapacities(factoryId)
}

export function listDyeFormulaRecords(): DyeFormulaRecord[] {
  seedDomain()
  return Array.from(formulaStore.values())
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
    waitWritebackCount: orders.filter((order) => order.status === 'HANDOVER_SUBMITTED').length,
    waitReviewCount: orders.filter((order) => order.status === 'WAIT_REVIEW' || order.status === 'REVIEWING').length,
    completedCount: orders.filter((order) => order.status === 'COMPLETED').length,
    rejectedCount: orders.filter((order) => order.status === 'REJECTED').length,
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
      finishedAt: order.status === 'COMPLETED' ? (getDyeReviewRecordByOrderId(order.dyeOrderId)?.reviewedAt || order.updatedAt) : undefined,
      durationHours: Number(getStatusDurationHours(order)),
      dyeVatNo: getCurrentDyeVatNo(order),
      plannedQty: order.plannedQty,
      outputQty: getCurrentOutputQty(order),
      diffQty: handover.diffQty,
      objectionCount: handover.objectionCount,
    }
  })
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
  order.status = 'WAIT_VAT_PLAN'
  updateOrderTimestamp(order, now)
  return getDyeExecutionNodeRecord(dyeOrderId, 'VAT_PLAN')!
}

export function startDyeing(
  dyeOrderId: string,
  input: { dyeVatNo: string; operatorName?: string },
): DyeExecutionNodeRecord {
  const validation = validateDyeStartPayload(input)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
  const order = getMutableWorkOrder(dyeOrderId)
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
    inputQty: current?.inputQty || order.plannedQty,
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
  if (!order.handoverOrderId) {
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
  const current = getMutableNodeRecord(dyeOrderId, 'DYE')
  if (!current?.dyeVatNo?.trim()) {
    throw new Error('染色开始必须记录染缸编号')
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
    inputQty: Number.isFinite(input.inputQty) ? Number(input.inputQty) : current.inputQty || order.plannedQty,
    outputQty: Number.isFinite(input.outputQty) ? Number(input.outputQty) : current.outputQty || order.plannedQty,
    lossQty:
      (Number.isFinite(input.inputQty) ? Number(input.inputQty) : current.inputQty || order.plannedQty)
      - (Number.isFinite(input.outputQty) ? Number(input.outputQty) : current.outputQty || order.plannedQty),
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

export function startDyeNode(
  dyeOrderId: string,
  nodeCode: Extract<DyeExecutionNodeCode, 'DEHYDRATE' | 'DRY' | 'SET' | 'ROLL' | 'PACK'>,
  operatorName = '染色工厂',
): DyeExecutionNodeRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  const now = nowTimestamp()
  upsertNodeRecord(dyeOrderId, nodeCode, (current) => ({
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
  const current = getMutableNodeRecord(dyeOrderId, nodeCode)
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
    remark: nodeCode === 'PACK' ? '包装完成待送货' : `${DYE_NODE_LABEL[nodeCode]}完成`,
  }))
  order.status = getNodeStatusAfterComplete(nodeCode)
  if (nodeCode === 'PACK' && !order.handoverOrderId) {
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
  order.status = 'HANDOVER_SUBMITTED'
  order.remark = input.remark?.trim() || order.remark
  updateOrderTimestamp(order, now)
  syncDerivedWorkflow()
  return result
}

export function approveDyeReview(
  dyeOrderId: string,
  input: { reviewedBy: string; remark?: string },
): DyeReviewRecord {
  const order = getMutableWorkOrder(dyeOrderId)
  const review = reviewRecordStore.get(dyeOrderId)
  if (!review) {
    throw new Error('接收方回写后才能进入审核')
  }
  review.reviewStatus = 'PASS'
  review.reviewedBy = input.reviewedBy
  review.reviewedAt = nowTimestamp()
  review.remark = input.remark?.trim() || '中转区域审核通过'
  order.status = 'COMPLETED'
  syncLinkedTaskState(order.taskId, {
    status: 'DONE',
    finishedAt: review.reviewedAt,
    blockReason: undefined,
    blockRemark: undefined,
  })
  updateOrderTimestamp(order, review.reviewedAt)
  appendNodeRecord(dyeOrderId, {
    nodeRecordId: `${dyeOrderId}-REVIEW-${Date.now()}`,
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'REVIEW',
    nodeName: DYE_NODE_LABEL.REVIEW,
    operatorUserId: 'USR-REVIEW',
    operatorName: input.reviewedBy,
    finishedAt: review.reviewedAt,
    outputQty: review.receivedQty,
    qtyUnit: getQtyUnit(order),
    remark: review.remark,
  })
  return cloneReviewRecord(review)
}

export function rejectDyeReview(
  dyeOrderId: string,
  input: { reviewedBy: string; rejectReason: string; remark?: string },
): DyeReviewRecord {
  if (!input.rejectReason.trim()) {
    throw new Error('请填写驳回原因')
  }
  const order = getMutableWorkOrder(dyeOrderId)
  const review = reviewRecordStore.get(dyeOrderId)
  if (!review) {
    throw new Error('接收方回写后才能进入审核')
  }
  review.reviewStatus = 'REJECTED'
  review.reviewedBy = input.reviewedBy
  review.reviewedAt = nowTimestamp()
  review.rejectReason = input.rejectReason.trim()
  review.remark = input.remark?.trim() || '中转区域审核驳回'
  order.status = 'REJECTED'
  syncLinkedTaskState(order.taskId, {
    status: 'BLOCKED',
    finishedAt: undefined,
    blockReason: 'QUALITY',
    blockRemark: review.rejectReason,
  })
  updateOrderTimestamp(order, review.reviewedAt)
  appendNodeRecord(dyeOrderId, {
    nodeRecordId: `${dyeOrderId}-REVIEW-${Date.now()}`,
    dyeOrderId,
    taskId: order.taskId,
    nodeCode: 'REVIEW',
    nodeName: DYE_NODE_LABEL.REVIEW,
    operatorUserId: 'USR-REVIEW',
    operatorName: input.reviewedBy,
    finishedAt: review.reviewedAt,
    outputQty: review.receivedQty,
    qtyUnit: getQtyUnit(order),
    remark: `审核驳回：${review.rejectReason}`,
  })
  return cloneReviewRecord(review)
}
