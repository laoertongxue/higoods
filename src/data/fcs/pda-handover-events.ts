import {
  getWarehouseExecutionDocById,
  listWarehouseIssueOrders,
  listWarehouseReturnOrders,
  type WarehouseIssueOrder,
  type WarehouseReturnOrder,
} from './warehouse-material-execution.ts'
import {
  PROCESS_ASSIGNMENT_GRANULARITY_LABEL,
  getProcessDefinitionByCode,
  isExternalTaskProcess,
  isPostCapacityNode,
  type ProcessAssignmentGranularity,
} from './process-craft-dict.ts'
import {
  getRuntimeTaskById,
  type RuntimeExecutorKind,
  type RuntimeProcessTask,
  type RuntimeTaskScopeType,
} from './runtime-process-tasks.ts'
import {
  getPdaGenericHandoutRecordSeedsByHeadId,
  getPdaGenericPickupRecordSeedsByHeadId,
  listPdaGenericProcessTasks,
  listPdaGenericHandoverHeadSeeds,
  type PdaTaskMockHandoutRecordSeed,
  type PdaTaskMockHandoverHeadSeed,
  type PdaTaskMockPickupRecordSeed,
} from './pda-task-mock-factory.ts'
import {
  buildHandoverOrderQrValue,
  buildHandoverRecordQrValue,
  buildTaskQrValue,
} from './task-qr.ts'

export type HandoverAction = 'PICKUP' | 'HANDOUT'
export type HandoverStatus = 'PENDING' | 'CONFIRMED'
export type HandoverPartyKind = 'WAREHOUSE' | 'FACTORY'
export type HandoverReceiverKind = 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
export type HandoverOrderStatus =
  | 'AUTO_CREATED'
  | 'OPEN'
  | 'PARTIAL_SUBMITTED'
  | 'WAIT_RECEIVER_WRITEBACK'
  | 'PARTIAL_WRITTEN_BACK'
  | 'WRITTEN_BACK'
  | 'DIFF_WAIT_FACTORY_CONFIRM'
  | 'HAS_OBJECTION'
  | 'OBJECTION_PROCESSING'
  | 'CLOSED'
export type HandoverRecordLifecycleStatus =
  | 'SUBMITTED_WAIT_WRITEBACK'
  | 'WRITTEN_BACK_MATCHED'
  | 'WRITTEN_BACK_DIFF'
  | 'DIFF_ACCEPTED'
  | 'OBJECTION_REPORTED'
  | 'OBJECTION_PROCESSING'
  | 'OBJECTION_RESOLVED'
  | 'VOIDED'
export type HandoverObjectType =
  | 'FABRIC'
  | 'CUT_PIECE'
  | 'SEMI_FINISHED_GARMENT'
  | 'FINISHED_GARMENT'

export interface HandoverEvent {
  eventId: string
  action: HandoverAction
  taskId: string
  productionOrderId: string
  currentProcess: string
  prevProcess?: string
  isFirstProcess: boolean
  fromPartyKind: HandoverPartyKind
  fromPartyName: string
  toPartyKind: HandoverPartyKind
  toPartyName: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  qtyDiff?: number
  diffReason?: string
  diffNote?: string
  deadlineTime: string
  status: HandoverStatus
  confirmedAt?: string
  proofCount?: number
  factoryId: string
  materialSummary?: string
}

// 保留旧导出以兼容历史引用，真实数据由下方构建函数实时生成。
export const pdaHandoverEvents: HandoverEvent[] = []

export type HandoverHeadSummaryStatus =
  | 'NONE'
  | 'SUBMITTED'
  | 'PARTIAL_WRITTEN_BACK'
  | 'WRITTEN_BACK'
  | 'HAS_OBJECTION'
export type PdaHandoverHeadType = 'PICKUP' | 'HANDOUT'
export type PdaHeadCompletionStatus = 'OPEN' | 'COMPLETED'

export type HandoverRecordStatus =
  | 'PENDING_WRITEBACK'
  | 'WRITTEN_BACK'
  | 'OBJECTION_REPORTED'
  | 'OBJECTION_PROCESSING'
  | 'OBJECTION_RESOLVED'

export type PdaHandoutObjectType = 'GARMENT' | 'CUT_PIECE' | 'FABRIC'

export interface PdaCutPieceHandoutLine {
  lineId: string
  piecePartLabel: string
  piecePartCode?: string
  garmentSkuCode: string
  garmentSkuLabel?: string
  colorLabel?: string
  sizeLabel?: string
  pieceQty: number
  garmentEquivalentQty: number
}

export interface PdaCutPiecePartGroup {
  partLabel: string
  partCode?: string
  totalPieceQty: number
  totalGarmentEquivalentQty: number
  skuLines: PdaCutPieceHandoutLine[]
}

export interface PdaCutPieceRecordSummary {
  involvedPartLabels: string[]
  involvedPartCount: number
  involvedSkuCodes: string[]
  involvedSkuCount: number
  plannedPieceQtyTotal: number
  returnedPieceQtyTotal: number
  pendingPieceQtyTotal: number
  garmentEquivalentQtyTotal: number
}

export interface PdaHandoutObjectProfile {
  objectType: PdaHandoutObjectType
  objectTypeLabel: string
  primaryQtyLabel: string
  writtenQtyLabel: string
  pendingQtyLabel: string
  displayUnit: string
  objectInfoLines: string[]
  totalPlannedQty: number
  totalWrittenQty: number
  totalPendingQty: number
  garmentEquivalentQtyTotal?: number
  cutPieceRecordSummary?: PdaCutPieceRecordSummary
}

export interface PdaHandoutRecordProfile {
  objectType: PdaHandoutObjectType
  objectTypeLabel: string
  displayUnit: string
  plannedQtyLabel: string
  writtenQtyLabel: string
  pendingQtyLabel: string
  itemTitle: string
  infoLines: string[]
  plannedQtyText: string
  writtenQtyText: string
  pendingQtyText: string
  garmentEquivalentQty?: number
  cutPieceRecordSummary?: PdaCutPieceRecordSummary
  cutPiecePartGroups?: PdaCutPiecePartGroup[]
}

export interface HandoverRecordLine {
  lineId: string
  handoverRecordId: string
  objectType: HandoverObjectType
  materialSku?: string
  fabricRollId?: string
  fabricRollNo?: string
  fabricColor?: string
  garmentSkuId?: string
  garmentSkuCode?: string
  garmentColor?: string
  sizeCode?: string
  partCode?: string
  partName?: string
  feiTicketId?: string
  feiTicketNo?: string
  assemblyGroupKey?: string
  bundleNo?: string
  submittedQty: number
  receiverWrittenQty?: number
  qtyUnit: string
  remark?: string
}

export interface ReceiverWriteback {
  writebackId: string
  handoverRecordId: string
  handoverOrderId: string
  receiverKind: HandoverReceiverKind
  receiverId: string
  receiverName: string
  submittedQty: number
  writtenQty: number
  diffQty: number
  qtyUnit: string
  writebackResult: 'MATCH' | 'SHORT' | 'OVER'
  diffReason?: string
  proofFiles?: HandoverProofFile[]
  writtenBy: string
  writtenAt: string
  isLatest: boolean
  voidReason?: string
}

export interface QuantityObjection {
  objectionId: string
  objectionNo: string
  handoverRecordId: string
  handoverOrderId: string
  sourceTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  raisedByKind: 'FACTORY'
  submittedQty: number
  receiverWrittenQty: number
  diffQty: number
  qtyUnit: string
  objectionReason:
    | 'RECEIVER_COUNT_ERROR'
    | 'LOST_IN_TRANSIT'
    | 'WRONG_RECORD'
    | 'MIXED_BATCH'
    | 'OTHER'
  objectionRemark: string
  factoryProofFiles?: HandoverProofFile[]
  receiverProofFiles?: HandoverProofFile[]
  status:
    | 'REPORTED'
    | 'PROCESSING'
    | 'RESOLVED_ACCEPT_FACTORY'
    | 'RESOLVED_ACCEPT_RECEIVER'
    | 'RESOLVED_PARTIAL'
    | 'REJECTED'
  resolvedQty?: number
  resolvedRemark?: string
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
  createdBy: string
}

export interface HandoverProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

export interface PdaHandoverHead {
  handoverId: string
  handoverOrderId?: string
  handoverOrderNo?: string
  headType: PdaHandoverHeadType
  qrCodeValue: string
  handoverOrderQrValue?: string
  taskId: string
  sourceTaskId?: string
  taskNo: string
  sourceTaskNo?: string
  baseTaskId?: string
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  isSplitResult?: boolean
  productionOrderNo: string
  processName: string
  sourceFactoryName: string
  sourceFactoryId?: string
  targetName: string
  targetKind: HandoverPartyKind
  receiverKind?: HandoverReceiverKind
  receiverId?: string
  receiverName?: string
  qtyUnit: string
  factoryId: string
  taskStatus: 'IN_PROGRESS' | 'DONE'
  summaryStatus: HandoverHeadSummaryStatus
  handoverOrderStatus?: HandoverOrderStatus
  recordCount: number
  pendingWritebackCount: number
  submittedQtyTotal?: number
  writtenBackQtyTotal: number
  diffQtyTotal?: number
  objectionCount: number
  lastRecordAt?: string
  plannedQty?: number
  completionStatus: PdaHeadCompletionStatus
  factoryMarkedComplete?: boolean
  factoryMarkedCompleteAt?: string
  completedByWarehouseAt?: string
  receiverClosedAt?: string
  qtyExpectedTotal: number
  qtyActualTotal: number
  qtyDiffTotal: number
  runtimeTaskId?: string
  sourceDocId?: string
  sourceDocNo?: string
  scopeType?: RuntimeTaskScopeType
  scopeKey?: string
  scopeLabel?: string
  executorKind?: RuntimeExecutorKind
  transitionFromPrev?: 'RETURN_TO_WAREHOUSE' | 'SAME_FACTORY_CONTINUE' | 'NOT_APPLICABLE'
  transitionToNext?: 'RETURN_TO_WAREHOUSE' | 'SAME_FACTORY_CONTINUE' | 'NOT_APPLICABLE'
  stageCode?: 'PREP' | 'PROD' | 'POST'
  stageName?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
  taskTypeCode?: string
  taskTypeLabel?: string
  assignmentGranularity?: ProcessAssignmentGranularity
  assignmentGranularityLabel?: string
  isSpecialCraft?: boolean
}

export interface PdaHandoverRecord {
  recordId: string
  handoverRecordId?: string
  handoverRecordNo?: string
  handoverId: string
  handoverOrderId?: string
  taskId: string
  sourceTaskId?: string
  sequenceNo: number
  handoutObjectType?: PdaHandoutObjectType
  objectType?: HandoverObjectType
  handoutItemLabel?: string
  materialCode?: string
  materialName?: string
  materialSpec?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  garmentEquivalentQty?: number
  cutPieceLines?: PdaCutPieceHandoutLine[]
  recordLines?: HandoverRecordLine[]
  plannedQty?: number
  submittedQty?: number
  qtyUnit?: string
  factorySubmittedAt: string
  factorySubmittedBy?: string
  factorySubmittedByKind?: 'FACTORY'
  factoryRemark?: string
  factoryProofFiles: HandoverProofFile[]
  status: HandoverRecordStatus
  handoverRecordStatus?: HandoverRecordLifecycleStatus
  handoverRecordQrValue?: string
  warehouseReturnNo?: string
  warehouseWrittenQty?: number
  warehouseWrittenAt?: string
  receiverWrittenQty?: number
  receiverWrittenAt?: string
  receiverWrittenBy?: string
  receiverRemark?: string
  receiverProofFiles?: HandoverProofFile[]
  diffQty?: number
  diffReason?: string
  factoryDiffDecision?: 'ACCEPT_DIFF' | 'RAISE_OBJECTION'
  quantityObjectionId?: string
  objectionReason?: string
  objectionRemark?: string
  objectionProofFiles?: HandoverProofFile[]
  objectionStatus?: 'REPORTED' | 'PROCESSING' | 'RESOLVED'
  followUpRemark?: string
  resolvedRemark?: string
}

export type PdaPickupRecordStatus =
  | 'PENDING_WAREHOUSE_DISPATCH'
  | 'PENDING_FACTORY_PICKUP'
  | 'PENDING_FACTORY_CONFIRM'
  | 'RECEIVED'
  | 'OBJECTION_REPORTED'
  | 'OBJECTION_PROCESSING'
  | 'OBJECTION_RESOLVED'

export interface PdaPickupRecord {
  recordId: string
  handoverId: string
  taskId: string
  sequenceNo: number
  materialCode?: string
  materialName?: string
  materialSpec?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  pickupMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
  pickupModeLabel: '仓库配送到厂' | '工厂到仓自提'
  materialSummary: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  submittedAt: string
  status: PdaPickupRecordStatus
  receivedAt?: string
  qrCodeValue: string
  warehouseHandedQty?: number
  warehouseHandedAt?: string
  warehouseHandedBy?: string
  factoryConfirmedQty?: number
  factoryConfirmedAt?: string
  factoryReportedQty?: number
  finalResolvedQty?: number
  finalResolvedAt?: string
  exceptionCaseId?: string
  objectionReason?: string
  objectionRemark?: string
  objectionProofFiles?: HandoverProofFile[]
  objectionStatus?: 'REPORTED' | 'PROCESSING' | 'RESOLVED'
  followUpRemark?: string
  resolvedRemark?: string
  remark?: string
}

export interface PdaHandoverSummary {
  totalHeads: number
  pickupPendingCount: number
  handoutPendingCount: number
  completedCount: number
  objectionCount: number
}

const handoverHeadAdditions = new Map<string, PdaHandoverHead>()
const pickupRecordAdditions = new Map<string, PdaPickupRecord[]>()
const handoutRecordAdditions = new Map<string, PdaHandoverRecord[]>()
const pickupRecordOverrides = new Map<string, Partial<PdaPickupRecord>>()
const handoutRecordOverrides = new Map<string, Partial<PdaHandoverRecord>>()
const headCompletionOverrides = new Map<
  string,
  { completionStatus: PdaHeadCompletionStatus; completedByWarehouseAt?: string }
>()
let cachedBuiltHeads: PdaHandoverHead[] | null = null

function invalidatePdaHandoverHeadCache(): void {
  cachedBuiltHeads = null
}

function buildHandoverOrderNo(handoverOrderId: string): string {
  return `HDO-${handoverOrderId.replace(/[^A-Za-z0-9]/g, '').slice(-12)}`
}

function buildHandoverRecordNo(handoverRecordId: string): string {
  return `HDR-${handoverRecordId.replace(/[^A-Za-z0-9]/g, '').slice(-12)}`
}

function normalizeReceiverKind(
  targetKind: HandoverPartyKind | undefined,
  receiverKind?: HandoverReceiverKind,
): HandoverReceiverKind {
  if (receiverKind) return receiverKind
  return targetKind === 'FACTORY' ? 'MANAGED_POST_FACTORY' : 'WAREHOUSE'
}

function normalizeReceiverId(head: {
  receiverId?: string
  targetName?: string
  processBusinessCode?: string
  factoryId?: string
}): string {
  if (head.receiverId) return head.receiverId
  if (head.targetName?.includes('后道工厂')) return 'POST-FACTORY-OWN'
  if (head.targetName?.includes('裁片仓')) return 'WH-CUT-PIECE'
  if (head.targetName?.includes('成衣仓')) return 'WH-GARMENT-HANDOFF'
  if (head.targetName?.includes('中转')) return 'WH-TRANSFER'
  return head.factoryId ? `${head.factoryId}-RECEIVER` : 'FCS-RECEIVER'
}

function normalizeReceiverName(head: { receiverName?: string; targetName?: string }): string {
  return head.receiverName || head.targetName || '接收方'
}

function normalizeFactorySubmittedBy(value: string | undefined): string {
  return value?.trim() || '工厂操作员'
}

function resolveHandoverObjectType(record: Pick<PdaHandoverRecord, 'handoutObjectType'>): HandoverObjectType {
  if (record.handoutObjectType === 'CUT_PIECE') return 'CUT_PIECE'
  if (record.handoutObjectType === 'FABRIC') return 'FABRIC'
  return 'FINISHED_GARMENT'
}

function resolveSubmittedQty(record: Pick<PdaHandoverRecord, 'submittedQty' | 'plannedQty'>): number {
  if (typeof record.submittedQty === 'number') return record.submittedQty
  if (typeof record.plannedQty === 'number') return record.plannedQty
  return 0
}

function resolveReceiverWrittenQty(
  record: Pick<PdaHandoverRecord, 'receiverWrittenQty' | 'warehouseWrittenQty'>,
): number | undefined {
  if (typeof record.receiverWrittenQty === 'number') return record.receiverWrittenQty
  if (typeof record.warehouseWrittenQty === 'number') return record.warehouseWrittenQty
  return undefined
}

function resolveReceiverWrittenAt(
  record: Pick<PdaHandoverRecord, 'receiverWrittenAt' | 'warehouseWrittenAt'>,
): string | undefined {
  return record.receiverWrittenAt || record.warehouseWrittenAt
}

function mapRecordLifecycleStatus(record: Pick<PdaHandoverRecord, 'status' | 'objectionStatus' | 'receiverWrittenQty' | 'warehouseWrittenQty' | 'submittedQty' | 'plannedQty' | 'factoryDiffDecision'>): HandoverRecordLifecycleStatus {
  if (record.status === 'OBJECTION_REPORTED') return 'OBJECTION_REPORTED'
  if (record.status === 'OBJECTION_PROCESSING') return 'OBJECTION_PROCESSING'
  if (record.status === 'OBJECTION_RESOLVED') return 'OBJECTION_RESOLVED'
  if (record.factoryDiffDecision === 'ACCEPT_DIFF') return 'DIFF_ACCEPTED'
  const submittedQty = resolveSubmittedQty(record)
  const writtenQty = resolveReceiverWrittenQty(record)
  if (typeof writtenQty !== 'number') return 'SUBMITTED_WAIT_WRITEBACK'
  if (writtenQty === submittedQty) return 'WRITTEN_BACK_MATCHED'
  return 'WRITTEN_BACK_DIFF'
}

function mapLegacyRecordStatus(status: HandoverRecordLifecycleStatus): HandoverRecordStatus {
  if (status === 'OBJECTION_REPORTED') return 'OBJECTION_REPORTED'
  if (status === 'OBJECTION_PROCESSING') return 'OBJECTION_PROCESSING'
  if (status === 'OBJECTION_RESOLVED') return 'OBJECTION_RESOLVED'
  return status === 'SUBMITTED_WAIT_WRITEBACK' ? 'PENDING_WRITEBACK' : 'WRITTEN_BACK'
}

function deriveDiffQty(record: Pick<PdaHandoverRecord, 'submittedQty' | 'plannedQty' | 'receiverWrittenQty' | 'warehouseWrittenQty'>): number | undefined {
  const writtenQty = resolveReceiverWrittenQty(record)
  if (typeof writtenQty !== 'number') return undefined
  return writtenQty - resolveSubmittedQty(record)
}

function createRecordLines(record: Pick<
  PdaHandoverRecord,
  'recordId' | 'handoutObjectType' | 'cutPieceLines' | 'materialCode' | 'skuCode' | 'skuColor' | 'skuSize' | 'pieceName' | 'plannedQty' | 'submittedQty' | 'receiverWrittenQty' | 'warehouseWrittenQty' | 'qtyUnit'
>): HandoverRecordLine[] {
  const recordId = record.recordId
  const submittedQty = resolveSubmittedQty(record)
  const receiverWrittenQty = resolveReceiverWrittenQty(record)
  if (record.cutPieceLines && record.cutPieceLines.length > 0) {
    return record.cutPieceLines.map((line) => ({
      lineId: line.lineId,
      handoverRecordId: recordId,
      objectType: 'CUT_PIECE',
      garmentSkuCode: line.garmentSkuCode,
      garmentColor: line.colorLabel,
      sizeCode: line.sizeLabel,
      partCode: line.piecePartCode,
      partName: line.piecePartLabel,
      submittedQty: line.pieceQty,
      qtyUnit: '片',
      receiverWrittenQty: undefined,
    }))
  }

  return [
    {
      lineId: `${recordId}-LINE-001`,
      handoverRecordId: recordId,
      objectType: resolveHandoverObjectType(record),
      materialSku: record.materialCode,
      garmentSkuCode: record.skuCode,
      garmentColor: record.skuColor,
      sizeCode: record.skuSize,
      partName: record.pieceName,
      submittedQty,
      receiverWrittenQty,
      qtyUnit: record.qtyUnit || '件',
    },
  ]
}

function hydrateHandoverRecordDomain(
  record: PdaHandoverRecord,
  head: Pick<PdaHandoverHead, 'handoverId' | 'handoverOrderId'>,
): PdaHandoverRecord {
  const handoverOrderId = head.handoverOrderId || head.handoverId
  const submittedQty = resolveSubmittedQty(record)
  const receiverWrittenQty = resolveReceiverWrittenQty(record)
  const receiverWrittenAt = resolveReceiverWrittenAt(record)
  const handoverRecordStatus = mapRecordLifecycleStatus(record)
  const diffQty = deriveDiffQty(record)

  return {
    ...record,
    handoverRecordId: record.handoverRecordId || record.recordId,
    handoverRecordNo: record.handoverRecordNo || buildHandoverRecordNo(record.recordId),
    handoverOrderId,
    sourceTaskId: record.sourceTaskId || record.taskId,
    objectType: record.objectType || resolveHandoverObjectType(record),
    submittedQty,
    factorySubmittedBy: normalizeFactorySubmittedBy(record.factorySubmittedBy),
    factorySubmittedByKind: 'FACTORY',
    handoverRecordStatus,
    handoverRecordQrValue: record.handoverRecordQrValue || buildHandoverRecordQrValue(record.recordId),
    receiverWrittenQty,
    receiverWrittenAt,
    receiverWrittenBy: record.receiverWrittenBy || (receiverWrittenAt ? '接收方扫码员' : undefined),
    receiverRemark: record.receiverRemark,
    diffQty,
    diffReason: record.diffReason || record.objectionReason,
    factoryDiffDecision:
      record.factoryDiffDecision
      || (handoverRecordStatus === 'OBJECTION_REPORTED' || handoverRecordStatus === 'OBJECTION_PROCESSING'
        ? 'RAISE_OBJECTION'
        : undefined),
    quantityObjectionId:
      record.quantityObjectionId
      || (handoverRecordStatus === 'OBJECTION_REPORTED' || handoverRecordStatus === 'OBJECTION_PROCESSING' || handoverRecordStatus === 'OBJECTION_RESOLVED'
        ? `QO-${record.recordId}`
        : undefined),
    recordLines: createRecordLines(record),
    warehouseWrittenQty: receiverWrittenQty,
    warehouseWrittenAt: receiverWrittenAt,
    status: mapLegacyRecordStatus(handoverRecordStatus),
  }
}

function deriveHandoverOrderStatus(records: PdaHandoverRecord[], hasFactoryMarkedComplete: boolean): HandoverOrderStatus {
  if (records.length === 0) return hasFactoryMarkedComplete ? 'OPEN' : 'AUTO_CREATED'
  const lifecycleStatuses = records.map((record) => record.handoverRecordStatus || mapRecordLifecycleStatus(record))
  const objectionCount = lifecycleStatuses.filter((status) => status === 'OBJECTION_REPORTED' || status === 'OBJECTION_PROCESSING').length
  if (objectionCount > 0) return objectionCount === lifecycleStatuses.length ? 'HAS_OBJECTION' : 'OBJECTION_PROCESSING'
  const pendingCount = lifecycleStatuses.filter((status) => status === 'SUBMITTED_WAIT_WRITEBACK').length
  const diffCount = lifecycleStatuses.filter((status) => status === 'WRITTEN_BACK_DIFF').length
  if (diffCount > 0) return 'DIFF_WAIT_FACTORY_CONFIRM'
  if (pendingCount === lifecycleStatuses.length) return 'WAIT_RECEIVER_WRITEBACK'
  if (pendingCount > 0) return 'PARTIAL_WRITTEN_BACK'
  if (!hasFactoryMarkedComplete) return 'PARTIAL_SUBMITTED'
  return 'WRITTEN_BACK'
}

function hydrateHandoverHeadDomain(head: PdaHandoverHead, records: PdaHandoverRecord[]): PdaHandoverHead {
  const handoverOrderId = head.handoverOrderId || head.handoverId
  const receiverKind = normalizeReceiverKind(head.targetKind, head.receiverKind)
  const receiverName = normalizeReceiverName(head)
  const submittedQtyTotal = sumBy(records, (record) => resolveSubmittedQty(record))
  const writtenBackQtyTotal = sumBy(records, (record) => resolveReceiverWrittenQty(record) ?? 0)
  const diffQtyTotal = sumBy(records, (record) => deriveDiffQty(record) ?? 0)
  const factoryMarkedComplete = head.factoryMarkedComplete ?? head.completionStatus === 'COMPLETED'
  const handoverOrderStatus =
    head.headType === 'HANDOUT'
      ? deriveHandoverOrderStatus(records, factoryMarkedComplete)
      : undefined

  return {
    ...head,
    handoverOrderId,
    handoverOrderNo: head.handoverOrderNo || buildHandoverOrderNo(handoverOrderId),
    handoverOrderQrValue: head.headType === 'HANDOUT' ? buildHandoverOrderQrValue(handoverOrderId) : undefined,
    qrCodeValue: head.headType === 'HANDOUT' ? buildHandoverOrderQrValue(handoverOrderId) : head.qrCodeValue,
    sourceTaskId: head.sourceTaskId || head.taskId,
    sourceTaskNo: head.sourceTaskNo || head.taskNo,
    sourceFactoryId: head.sourceFactoryId || head.factoryId,
    receiverKind,
    receiverId: normalizeReceiverId(head),
    receiverName,
    handoverOrderStatus,
    submittedQtyTotal,
    writtenBackQtyTotal,
    diffQtyTotal,
    plannedQty: head.plannedQty ?? head.qtyExpectedTotal,
    factoryMarkedComplete,
    factoryMarkedCompleteAt: head.factoryMarkedCompleteAt || head.completedByWarehouseAt,
    receiverClosedAt: head.receiverClosedAt || head.completedByWarehouseAt,
    qtyActualTotal: writtenBackQtyTotal,
    qtyDiffTotal: head.qtyExpectedTotal - writtenBackQtyTotal,
  }
}

function buildGenericMockHead(seed: PdaTaskMockHandoverHeadSeed): PdaHandoverHead {
  const handoverOrderId = seed.handoverId
  const receiverKind = normalizeReceiverKind(seed.targetKind, seed.receiverKind)
  const receiverName = normalizeReceiverName(seed)
  return {
    handoverId: seed.handoverId,
    handoverOrderId,
    handoverOrderNo: buildHandoverOrderNo(handoverOrderId),
    headType: seed.headType,
    qrCodeValue: seed.headType === 'HANDOUT' ? buildHandoutHeadQrCodeValue(seed.handoverId) : '',
    handoverOrderQrValue: seed.headType === 'HANDOUT' ? buildHandoverOrderQrValue(handoverOrderId) : undefined,
    taskId: seed.taskId,
    sourceTaskId: seed.taskId,
    taskNo: seed.taskNo,
    sourceTaskNo: seed.taskNo,
    productionOrderNo: seed.productionOrderNo,
    processName: seed.processName,
    sourceFactoryName: seed.sourceFactoryName,
    targetName: seed.targetName,
    targetKind: seed.targetKind,
    receiverKind,
    receiverId: normalizeReceiverId({ ...seed, targetName: seed.targetName }),
    receiverName,
    qtyUnit: seed.qtyUnit,
    factoryId: seed.factoryId,
    taskStatus: seed.taskStatus,
    summaryStatus: seed.summaryStatus,
    handoverOrderStatus: seed.headType === 'HANDOUT' ? 'AUTO_CREATED' : undefined,
    recordCount: 0,
    pendingWritebackCount: 0,
    submittedQtyTotal: 0,
    writtenBackQtyTotal: 0,
    diffQtyTotal: 0,
    objectionCount: 0,
    plannedQty: seed.qtyExpectedTotal,
    completionStatus: seed.completionStatus,
    factoryMarkedComplete: seed.completionStatus === 'COMPLETED',
    factoryMarkedCompleteAt: seed.completedByWarehouseAt,
    completedByWarehouseAt: seed.completedByWarehouseAt,
    receiverClosedAt: seed.completedByWarehouseAt,
    qtyExpectedTotal: seed.qtyExpectedTotal,
    qtyActualTotal: seed.qtyActualTotal,
    qtyDiffTotal: seed.qtyDiffTotal,
    sourceDocNo: seed.sourceDocNo,
    scopeLabel: seed.scopeLabel,
    stageCode: seed.stageCode,
    stageName: seed.stageName,
    processBusinessCode: seed.processBusinessCode,
    processBusinessName: seed.processBusinessName,
    taskTypeCode: seed.taskTypeCode,
    taskTypeLabel: seed.taskTypeLabel,
    assignmentGranularityLabel: seed.assignmentGranularityLabel,
  }
}

function buildGenericPickupRecord(seed: PdaTaskMockPickupRecordSeed): PdaPickupRecord {
  return {
    recordId: seed.recordId,
    handoverId: seed.handoverId,
    taskId: seed.taskId,
    sequenceNo: seed.sequenceNo ?? 1,
    materialCode: seed.materialCode,
    materialName: seed.materialName,
    materialSpec: seed.materialSpec,
    skuCode: seed.skuCode,
    skuColor: seed.skuColor,
    skuSize: seed.skuSize,
    pieceName: seed.pieceName,
    pickupMode: seed.pickupMode,
    pickupModeLabel: seed.pickupMode === 'FACTORY_PICKUP' ? '工厂到仓自提' : '仓库配送到厂',
    materialSummary: seed.materialSummary,
    qtyExpected: seed.qtyExpected,
    qtyActual: seed.qtyActual,
    qtyUnit: seed.qtyUnit,
    submittedAt: seed.submittedAt,
    status: seed.status,
    receivedAt: seed.receivedAt,
    qrCodeValue: seed.qrCodeValue || `PICKUP-RECORD:${seed.recordId}`,
    warehouseHandedQty: seed.warehouseHandedQty,
    warehouseHandedAt: seed.warehouseHandedAt,
    warehouseHandedBy: seed.warehouseHandedBy,
    factoryConfirmedQty: seed.factoryConfirmedQty,
    factoryConfirmedAt: seed.factoryConfirmedAt,
    factoryReportedQty: seed.factoryReportedQty,
    finalResolvedQty: seed.finalResolvedQty,
    finalResolvedAt: seed.finalResolvedAt,
    exceptionCaseId: seed.exceptionCaseId,
    objectionReason: seed.objectionReason,
    objectionRemark: seed.objectionRemark,
    objectionProofFiles: cloneProofFiles(seed.objectionProofFiles ?? []),
    objectionStatus: seed.objectionStatus,
    followUpRemark: seed.followUpRemark,
    resolvedRemark: seed.resolvedRemark,
    remark: seed.remark,
  }
}

function buildGenericHandoutRecord(seed: PdaTaskMockHandoutRecordSeed): PdaHandoverRecord {
  return hydrateHandoverRecordDomain({
    recordId: seed.recordId,
    handoverId: seed.handoverId,
    taskId: seed.taskId,
    sequenceNo: 1,
    handoutObjectType: seed.handoutObjectType,
    handoutItemLabel: seed.handoutItemLabel,
    garmentEquivalentQty: seed.garmentEquivalentQty,
    materialCode: seed.materialCode,
    materialName: seed.materialName,
    materialSpec: seed.materialSpec,
    skuCode: seed.skuCode,
    skuColor: seed.skuColor,
    skuSize: seed.skuSize,
    pieceName: seed.pieceName,
    plannedQty: seed.plannedQty,
    submittedQty: seed.plannedQty,
    qtyUnit: seed.qtyUnit,
    cutPieceLines: seed.cutPieceLines?.map((line) => ({ ...line })),
    factorySubmittedAt: seed.factorySubmittedAt,
    factorySubmittedBy: seed.factorySubmittedBy,
    factoryRemark: seed.factoryRemark,
    factoryProofFiles: [],
    status: seed.status,
    warehouseReturnNo: seed.warehouseReturnNo,
    warehouseWrittenQty: seed.warehouseWrittenQty,
    warehouseWrittenAt: seed.warehouseWrittenAt,
    receiverWrittenQty: seed.receiverWrittenQty ?? seed.warehouseWrittenQty,
    receiverWrittenAt: seed.receiverWrittenAt ?? seed.warehouseWrittenAt,
    receiverWrittenBy: seed.receiverWrittenBy,
    receiverRemark: seed.receiverRemark,
    diffReason: seed.diffReason,
    factoryDiffDecision: seed.factoryDiffDecision,
    quantityObjectionId: seed.quantityObjectionId,
    objectionReason: seed.objectionReason,
    objectionRemark: seed.objectionRemark,
  }, { handoverId: seed.handoverId })
}

const PDA_GENERIC_HANDOVER_HEADS = listPdaGenericHandoverHeadSeeds().map((seed) => buildGenericMockHead(seed))
const PDA_GENERIC_PICKUP_RECORDS = Object.fromEntries(
  PDA_GENERIC_HANDOVER_HEADS
    .filter((head) => head.headType === 'PICKUP')
    .map(
      (head) =>
        [
          head.handoverId,
          getPdaGenericPickupRecordSeedsByHeadId(head.handoverId).map((seed) => buildGenericPickupRecord(seed)),
        ] as const,
    ),
)
const PDA_GENERIC_HANDOUT_RECORDS = Object.fromEntries(
  PDA_GENERIC_HANDOVER_HEADS
    .filter((head) => head.headType === 'HANDOUT')
    .map(
      (head) =>
        [
          head.handoverId,
          getPdaGenericHandoutRecordSeedsByHeadId(head.handoverId).map((seed) => buildGenericHandoutRecord(seed)),
        ] as const,
    ),
)

const PDA_MOCK_FACTORY_ID = 'ID-F001'
const PDA_MOCK_CUTTING_FACTORY_ID = 'ID-F004'

const PDA_MOCK_HANDOVER_HEADS: PdaHandoverHead[] = [
  {
    handoverId: 'PKH-MOCK-CUT-089',
    headType: 'PICKUP',
    qrCodeValue: '',
    taskId: 'TASK-CUT-000089',
    taskNo: 'TASK-CUT-000089',
    productionOrderNo: 'PO-20260319-013',
    processName: '裁片',
    sourceFactoryName: '一仓裁床仓',
    targetName: '小飞裁片厂',
    targetKind: 'FACTORY',
    qtyUnit: '卷',
    factoryId: PDA_MOCK_FACTORY_ID,
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'SUBMITTED',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 10,
    qtyActualTotal: 0,
    qtyDiffTotal: 10,
    sourceDocNo: 'ISS-MOCK-013',
    scopeLabel: '主布首批领料',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'NOT_APPLICABLE',
    transitionToNext: 'SAME_FACTORY_CONTINUE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'PROC_CUT',
    processBusinessName: '裁片',
    taskTypeCode: 'CUTTING',
    taskTypeLabel: '裁片任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: true,
  },
  {
    handoverId: 'HOH-MOCK-SEW-235',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-MOCK-SEW-235'),
    taskId: 'TASK-POST-000235',
    taskNo: 'TASK-POST-000235',
    productionOrderNo: 'PO-20260318-005',
    processName: '后道',
    sourceFactoryName: '华盛后道厂',
    targetName: '成衣仓交接点',
    targetKind: 'WAREHOUSE',
    qtyUnit: '件',
    factoryId: PDA_MOCK_FACTORY_ID,
    taskStatus: 'DONE',
    summaryStatus: 'SUBMITTED',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 260,
    qtyActualTotal: 0,
    qtyDiffTotal: 260,
    sourceDocNo: 'RET-MOCK-POST-235',
    scopeLabel: '整单',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'RETURN_TO_WAREHOUSE',
    transitionToNext: 'RETURN_TO_WAREHOUSE',
    stageCode: 'POST',
    stageName: '后道阶段',
    processBusinessCode: 'POST_FINISHING',
    processBusinessName: '后道',
    taskTypeCode: 'POST_FINISHING',
    taskTypeLabel: '后道任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: false,
  },
  {
    handoverId: 'HOH-MOCK-CUT-093',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-MOCK-CUT-093'),
    taskId: 'TASK-CUT-000093',
    taskNo: 'TASK-CUT-000093',
    productionOrderNo: 'PO-20260319-017',
    processName: '裁片',
    sourceFactoryName: '小飞裁片厂',
    targetName: '后道车缝',
    targetKind: 'FACTORY',
    qtyUnit: '片',
    factoryId: PDA_MOCK_FACTORY_ID,
    taskStatus: 'DONE',
    summaryStatus: 'PARTIAL_WRITTEN_BACK',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 320,
    qtyActualTotal: 240,
    qtyDiffTotal: 80,
    sourceDocNo: 'RET-MOCK-CUT-093',
    scopeLabel: '多部位尾批交接',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'RETURN_TO_WAREHOUSE',
    transitionToNext: 'SAME_FACTORY_CONTINUE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'PROC_CUT',
    processBusinessName: '裁片',
    taskTypeCode: 'CUTTING',
    taskTypeLabel: '裁片任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: true,
  },
  {
    handoverId: 'HOH-MOCK-CUT-094',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-MOCK-CUT-094'),
    taskId: 'TASK-CUT-000094',
    taskNo: 'TASK-CUT-000094',
    productionOrderNo: 'PO-20260319-018',
    processName: '裁片',
    sourceFactoryName: '小飞裁片厂',
    targetName: '后道车缝',
    targetKind: 'FACTORY',
    qtyUnit: '片',
    factoryId: PDA_MOCK_FACTORY_ID,
    taskStatus: 'DONE',
    summaryStatus: 'WRITTEN_BACK',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'COMPLETED',
    qtyExpectedTotal: 320,
    qtyActualTotal: 320,
    qtyDiffTotal: 0,
    sourceDocNo: 'RET-MOCK-CUT-094',
    scopeLabel: '整单多部位交接',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'RETURN_TO_WAREHOUSE',
    transitionToNext: 'SAME_FACTORY_CONTINUE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'PROC_CUT',
    processBusinessName: '裁片',
    taskTypeCode: 'CUTTING',
    taskTypeLabel: '裁片任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: true,
  },
  {
    handoverId: 'PKH-MOCK-CUT-020-F004',
    headType: 'PICKUP',
    qrCodeValue: '',
    taskId: 'TASK-CUT-BID-020',
    taskNo: 'TASK-CUT-BID-020',
    productionOrderNo: 'PO-202603-0003',
    processName: '裁片',
    sourceFactoryName: '五仓裁片仓',
    targetName: 'PT Mulia Cutting Center',
    targetKind: 'FACTORY',
    qtyUnit: '卷',
    factoryId: PDA_MOCK_CUTTING_FACTORY_ID,
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'PARTIAL_WRITTEN_BACK',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 8,
    qtyActualTotal: 0,
    qtyDiffTotal: 8,
    sourceDocNo: 'ISS-MOCK-CUT-020',
    scopeLabel: '异地裁床首批领料',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'NOT_APPLICABLE',
    transitionToNext: 'SAME_FACTORY_CONTINUE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'PROC_CUT',
    processBusinessName: '裁片',
    taskTypeCode: 'CUTTING',
    taskTypeLabel: '裁片任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: true,
  },
  {
    handoverId: 'HOH-MOCK-CUT-103-F004-OPEN',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-MOCK-CUT-103-F004-OPEN'),
    taskId: 'TASK-CUT-000103',
    taskNo: 'TASK-CUT-000103',
    productionOrderNo: 'PO-202603-0009',
    processName: '裁片',
    sourceFactoryName: 'PT Mulia Cutting Center',
    targetName: 'PT Sinar Garment Indonesia',
    targetKind: 'FACTORY',
    qtyUnit: '片',
    factoryId: PDA_MOCK_CUTTING_FACTORY_ID,
    taskStatus: 'DONE',
    summaryStatus: 'SUBMITTED',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 180,
    qtyActualTotal: 0,
    qtyDiffTotal: 180,
    sourceDocNo: 'RET-MOCK-CUT-103-OPEN',
    scopeLabel: '尾批交接',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'RETURN_TO_WAREHOUSE',
    transitionToNext: 'SAME_FACTORY_CONTINUE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'PROC_CUT',
    processBusinessName: '裁片',
    taskTypeCode: 'CUTTING',
    taskTypeLabel: '裁片任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: true,
  },
  {
    handoverId: 'HOH-MOCK-CUT-103-F004-DONE',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-MOCK-CUT-103-F004-DONE'),
    taskId: 'TASK-CUT-000103',
    taskNo: 'TASK-CUT-000103',
    productionOrderNo: 'PO-202603-0009',
    processName: '裁片',
    sourceFactoryName: 'PT Mulia Cutting Center',
    targetName: 'PT Sinar Garment Indonesia',
    targetKind: 'FACTORY',
    qtyUnit: '片',
    factoryId: PDA_MOCK_CUTTING_FACTORY_ID,
    taskStatus: 'DONE',
    summaryStatus: 'WRITTEN_BACK',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: '2026-03-24 18:20:00',
    qtyExpectedTotal: 220,
    qtyActualTotal: 0,
    qtyDiffTotal: 220,
    sourceDocNo: 'RET-MOCK-CUT-103-DONE',
    scopeLabel: '首批交接',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'RETURN_TO_WAREHOUSE',
    transitionToNext: 'SAME_FACTORY_CONTINUE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'PROC_CUT',
    processBusinessName: '裁片',
    taskTypeCode: 'CUTTING',
    taskTypeLabel: '裁片任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: true,
  },
  ...PDA_GENERIC_HANDOVER_HEADS,
]

const PDA_MOCK_PICKUP_RECORDS: Record<string, PdaPickupRecord[]> = {
  'PKH-MOCK-CUT-089': [
    {
      recordId: 'PKR-MOCK-CUT089-001',
      handoverId: 'PKH-MOCK-CUT-089',
      taskId: 'TASK-CUT-000089',
      sequenceNo: 1,
      materialCode: 'FAB-SKU-DYE-022',
      materialName: '染色主布',
      materialSpec: '150cm / 120g',
      skuCode: 'FAB-SKU-DYE-022',
      skuColor: '雾蓝',
      skuSize: '均码',
      pieceName: '主片',
      pickupMode: 'WAREHOUSE_DELIVERY',
      pickupModeLabel: '仓库配送到厂',
      materialSummary: '染色主布 / 主片',
      qtyExpected: 4,
      qtyUnit: '卷',
      submittedAt: '2026-03-22 08:10:00',
      status: 'PENDING_FACTORY_CONFIRM',
      qrCodeValue: buildPickupQrCodeValue('PKR-MOCK-CUT089-001'),
      warehouseHandedQty: 4,
      warehouseHandedAt: '2026-03-22 08:40:00',
      warehouseHandedBy: '五仓发料员',
      remark: '首批已扫码交付，待工厂确认',
    },
    {
      recordId: 'PKR-MOCK-CUT089-002',
      handoverId: 'PKH-MOCK-CUT-089',
      taskId: 'TASK-CUT-000089',
      sequenceNo: 2,
      materialCode: 'FAB-SKU-DYE-022',
      materialName: '染色主布',
      materialSpec: '150cm / 120g',
      skuCode: 'FAB-SKU-DYE-022',
      skuColor: '雾蓝',
      skuSize: '均码',
      pieceName: '主片',
      pickupMode: 'FACTORY_PICKUP',
      pickupModeLabel: '工厂到仓自提',
      materialSummary: '染色主布 / 主片补批',
      qtyExpected: 6,
      qtyUnit: '卷',
      submittedAt: '2026-03-22 09:15:00',
      status: 'PENDING_FACTORY_PICKUP',
      qrCodeValue: buildPickupQrCodeValue('PKR-MOCK-CUT089-002'),
      remark: '余下 6 卷待工厂到仓自提',
    },
  ],
  'PKH-MOCK-CUT-020-F004': [
    {
      recordId: 'PKR-MOCK-CUT020-001',
      handoverId: 'PKH-MOCK-CUT-020-F004',
      taskId: 'TASK-CUT-BID-020',
      sequenceNo: 1,
      materialCode: 'FAB-SKU-CUT-020',
      materialName: '弹力牛仔主布',
      materialSpec: '150cm / 10oz',
      skuCode: 'FAB-SKU-CUT-020',
      skuColor: '深靛蓝',
      skuSize: '均码',
      pieceName: '主片',
      pickupMode: 'WAREHOUSE_DELIVERY',
      pickupModeLabel: '仓库配送到厂',
      materialSummary: '主布 / 首批裁床领料',
      qtyExpected: 5,
      qtyUnit: '卷',
      submittedAt: '2026-03-24 08:10:00',
      status: 'OBJECTION_PROCESSING',
      qrCodeValue: buildPickupQrCodeValue('PKR-MOCK-CUT020-001'),
      warehouseHandedQty: 5,
      warehouseHandedAt: '2026-03-24 08:45:00',
      warehouseHandedBy: '五仓发料员',
      factoryReportedQty: 3,
      exceptionCaseId: 'EX-PDA-PICK-CUT-020',
      objectionReason: '首批到厂数量少于仓库扫码交付数量',
      objectionRemark: '工厂复点少 2 卷，待平台核定。',
      objectionStatus: 'PROCESSING',
      followUpRemark: '平台已要求仓库复点并补传交付凭证。',
      remark: '首批主布存在数量差异，处理中',
    },
    {
      recordId: 'PKR-MOCK-CUT020-002',
      handoverId: 'PKH-MOCK-CUT-020-F004',
      taskId: 'TASK-CUT-BID-020',
      sequenceNo: 2,
      materialCode: 'FAB-SKU-CUT-020',
      materialName: '弹力牛仔主布',
      materialSpec: '150cm / 10oz',
      skuCode: 'FAB-SKU-CUT-020',
      skuColor: '深靛蓝',
      skuSize: '均码',
      pieceName: '主片',
      pickupMode: 'FACTORY_PICKUP',
      pickupModeLabel: '工厂到仓自提',
      materialSummary: '主布 / 余量补批',
      qtyExpected: 3,
      qtyUnit: '卷',
      submittedAt: '2026-03-24 10:05:00',
      status: 'PENDING_FACTORY_PICKUP',
      qrCodeValue: buildPickupQrCodeValue('PKR-MOCK-CUT020-002'),
      remark: '余下 3 卷待裁片专厂自提',
    },
  ],
  ...PDA_GENERIC_PICKUP_RECORDS,
}

const PDA_MOCK_HANDOUT_RECORDS: Record<string, PdaHandoverRecord[]> = {
  'HOH-MOCK-SEW-235': [
    {
      recordId: 'HOR-MOCK-SEW235-001',
      handoverId: 'HOH-MOCK-SEW-235',
      taskId: 'TASK-POST-000235',
      sequenceNo: 1,
      handoutObjectType: 'GARMENT',
      handoutItemLabel: '黑色 / SKU-IRON-235 / 140件',
      materialName: '后道成衣',
      materialSpec: '男款外套整单交接',
      skuCode: 'SKU-IRON-235',
      skuColor: '黑色',
      skuSize: 'L',
      pieceName: '成衣包',
      plannedQty: 140,
      qtyUnit: '件',
      factorySubmittedAt: '2026-03-22 11:00:00',
      factoryRemark: '首批交出完成',
      factoryProofFiles: [],
      status: 'WRITTEN_BACK',
      warehouseReturnNo: 'RET-MOCK-POST-235-001',
      warehouseWrittenQty: 140,
      warehouseWrittenAt: '2026-03-22 11:20:00',
      receiverWrittenBy: '成衣仓收货员',
    },
    {
      recordId: 'HOR-MOCK-SEW235-002',
      handoverId: 'HOH-MOCK-SEW-235',
      taskId: 'TASK-POST-000235',
      sequenceNo: 2,
      handoutObjectType: 'GARMENT',
      handoutItemLabel: '黑色 / SKU-IRON-235 / 120件',
      materialName: '后道成衣',
      materialSpec: '男款外套整单交接',
      skuCode: 'SKU-IRON-235',
      skuColor: '黑色',
      skuSize: 'L',
      pieceName: '成衣包',
      plannedQty: 120,
      qtyUnit: '件',
      factorySubmittedAt: '2026-03-22 14:05:00',
      factoryRemark: '尾批待仓库回写',
      factoryProofFiles: [],
      status: 'PENDING_WRITEBACK',
    },
  ],
  'HOH-MOCK-CUT-093': [
    {
      recordId: 'HOR-MOCK-CUT093-001',
      handoverId: 'HOH-MOCK-CUT-093',
      taskId: 'TASK-CUT-000093',
      sequenceNo: 1,
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: '前片、后片（2 种部位） / CPO-20260319-G / CPO-20260319-H（2 个）',
      garmentEquivalentQty: 120,
      materialCode: 'CUT-093-PANEL',
      materialName: '裁片',
      materialSpec: '前片、后片首批交接',
      skuCode: 'CPO-20260319-G',
      skuColor: '石灰蓝',
      skuSize: 'M / L',
      pieceName: '前片 / 后片',
      cutPieceLines: [
        {
          lineId: 'CUT093-001-FRONT-G',
          piecePartLabel: '前片',
          garmentSkuCode: 'CPO-20260319-G',
          colorLabel: '石灰蓝',
          sizeLabel: 'M',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT093-001-FRONT-H',
          piecePartLabel: '前片',
          garmentSkuCode: 'CPO-20260319-H',
          colorLabel: '石灰蓝',
          sizeLabel: 'L',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT093-001-BACK-G',
          piecePartLabel: '后片',
          garmentSkuCode: 'CPO-20260319-G',
          colorLabel: '石灰蓝',
          sizeLabel: 'M',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT093-001-BACK-H',
          piecePartLabel: '后片',
          garmentSkuCode: 'CPO-20260319-H',
          colorLabel: '石灰蓝',
          sizeLabel: 'L',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
      ],
      plannedQty: 240,
      qtyUnit: '片',
      factorySubmittedAt: '2026-03-22 09:40:00',
      factoryRemark: '前片、后片首批已完成仓库回写',
      factoryProofFiles: [],
      status: 'WRITTEN_BACK',
      warehouseReturnNo: 'RET-MOCK-CUT-093-001',
      warehouseWrittenQty: 240,
      warehouseWrittenAt: '2026-03-22 10:05:00',
    },
    {
      recordId: 'HOR-MOCK-CUT093-002',
      handoverId: 'HOH-MOCK-CUT-093',
      taskId: 'TASK-CUT-000093',
      sequenceNo: 2,
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: '罗纹领口（1 种部位） / CPO-20260319-G / CPO-20260319-H（2 个）',
      garmentEquivalentQty: 40,
      materialCode: 'CUT-093-COLLAR',
      materialName: '裁片',
      materialSpec: '罗纹领口尾批待回写',
      skuCode: 'CPO-20260319-G / CPO-20260319-H',
      skuColor: '石灰蓝',
      skuSize: 'M / L',
      pieceName: '罗纹领口',
      cutPieceLines: [
        {
          lineId: 'CUT093-002-COLLAR-G',
          piecePartLabel: '罗纹领口',
          garmentSkuCode: 'CPO-20260319-G',
          colorLabel: '石灰蓝',
          sizeLabel: 'M',
          pieceQty: 40,
          garmentEquivalentQty: 20,
        },
        {
          lineId: 'CUT093-002-COLLAR-H',
          piecePartLabel: '罗纹领口',
          garmentSkuCode: 'CPO-20260319-H',
          colorLabel: '石灰蓝',
          sizeLabel: 'L',
          pieceQty: 40,
          garmentEquivalentQty: 20,
        },
      ],
      plannedQty: 80,
      qtyUnit: '片',
      factorySubmittedAt: '2026-03-22 14:10:00',
      factoryRemark: '罗纹领口待仓库回写',
      factoryProofFiles: [],
      status: 'PENDING_WRITEBACK',
    },
  ],
  'HOH-MOCK-CUT-094': [
    {
      recordId: 'HOR-MOCK-CUT094-001',
      handoverId: 'HOH-MOCK-CUT-094',
      taskId: 'TASK-CUT-000094',
      sequenceNo: 1,
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: '前片、后片、罗纹领口（3 种部位） / CPO-20260319-G / CPO-20260319-H（2 个）',
      garmentEquivalentQty: 160,
      materialCode: 'CUT-094-MULTI',
      materialName: '印花裁片',
      materialSpec: '整单多部位交接',
      skuCode: 'CPO-20260319-G / CPO-20260319-H',
      skuColor: '石灰蓝',
      skuSize: 'M / L',
      pieceName: '前片 / 后片 / 罗纹领口',
      cutPieceLines: [
        {
          lineId: 'CUT094-001-FRONT-G',
          piecePartLabel: '前片',
          garmentSkuCode: 'CPO-20260319-G',
          colorLabel: '石灰蓝',
          sizeLabel: 'M',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT094-001-FRONT-H',
          piecePartLabel: '前片',
          garmentSkuCode: 'CPO-20260319-H',
          colorLabel: '石灰蓝',
          sizeLabel: 'L',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT094-001-BACK-G',
          piecePartLabel: '后片',
          garmentSkuCode: 'CPO-20260319-G',
          colorLabel: '石灰蓝',
          sizeLabel: 'M',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT094-001-BACK-H',
          piecePartLabel: '后片',
          garmentSkuCode: 'CPO-20260319-H',
          colorLabel: '石灰蓝',
          sizeLabel: 'L',
          pieceQty: 60,
          garmentEquivalentQty: 30,
        },
        {
          lineId: 'CUT094-001-COLLAR-G',
          piecePartLabel: '罗纹领口',
          garmentSkuCode: 'CPO-20260319-G',
          colorLabel: '石灰蓝',
          sizeLabel: 'M',
          pieceQty: 40,
          garmentEquivalentQty: 20,
        },
        {
          lineId: 'CUT094-001-COLLAR-H',
          piecePartLabel: '罗纹领口',
          garmentSkuCode: 'CPO-20260319-H',
          colorLabel: '石灰蓝',
          sizeLabel: 'L',
          pieceQty: 40,
          garmentEquivalentQty: 20,
        },
      ],
      plannedQty: 320,
      qtyUnit: '片',
      factorySubmittedAt: '2026-03-22 10:10:00',
      factoryRemark: '多部位裁片已交接后道车缝',
      factoryProofFiles: [],
      status: 'WRITTEN_BACK',
      warehouseReturnNo: 'RET-MOCK-CUT-094-001',
      warehouseWrittenQty: 320,
      warehouseWrittenAt: '2026-03-22 10:30:00',
    },
  ],
  'HOH-MOCK-CUT-103-F004-OPEN': [
    {
      recordId: 'HOR-MOCK-CUT103-OPEN-001',
      handoverId: 'HOH-MOCK-CUT-103-F004-OPEN',
      taskId: 'TASK-CUT-000103',
      sequenceNo: 1,
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: '灰蓝拼接 / CPO-20260324-E1 / 180片 / 前片',
      garmentEquivalentQty: 90,
      materialCode: 'CUT-103-FRONT',
      materialName: '裁片',
      materialSpec: '异地裁床尾批交接',
      skuCode: 'CPO-20260324-E1',
      skuColor: '灰蓝拼接',
      skuSize: 'M',
      pieceName: '前片',
      plannedQty: 180,
      qtyUnit: '片',
      factorySubmittedAt: '2026-03-24 16:10:00',
      factoryRemark: '尾批已发出，待主厂回写签收',
      factoryProofFiles: [],
      status: 'PENDING_WRITEBACK',
    },
  ],
  'HOH-MOCK-CUT-103-F004-DONE': [
    {
      recordId: 'HOR-MOCK-CUT103-DONE-001',
      handoverId: 'HOH-MOCK-CUT-103-F004-DONE',
      taskId: 'TASK-CUT-000103',
      sequenceNo: 1,
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: '灰蓝拼接 / CPO-20260324-E1 / 220片 / 前后片整单',
      garmentEquivalentQty: 110,
      materialCode: 'CUT-103-SET',
      materialName: '裁片',
      materialSpec: '异地裁床首批交接',
      skuCode: 'CPO-20260324-E1',
      skuColor: '灰蓝拼接',
      skuSize: 'M',
      pieceName: '前后片整单',
      plannedQty: 220,
      qtyUnit: '片',
      factorySubmittedAt: '2026-03-24 14:20:00',
      factoryRemark: '首批已交回主厂',
      factoryProofFiles: [],
      status: 'WRITTEN_BACK',
      warehouseReturnNo: 'RET-MOCK-CUT-103-001',
      warehouseWrittenQty: 220,
      warehouseWrittenAt: '2026-03-24 15:00:00',
    },
  ],
  ...PDA_GENERIC_HANDOUT_RECORDS,
}

function buildTaskBoardPickupRecordSeeds(head: PdaHandoverHead): PdaPickupRecord[] {
  if (head.headType !== 'PICKUP') return []

  if (head.taskId === 'TASKGEN-202603-0003-001__ORDER') {
    return [
      {
        recordId: 'PKR-SEED-TASKGEN0003001-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialCode: 'FAB-SEW-0003',
        materialName: '车缝主布',
        materialSpec: '首批裁片',
        skuCode: 'SKU-0003-A',
        skuColor: '雾蓝',
        skuSize: 'M',
        pieceName: '主片',
        pickupMode: 'WAREHOUSE_DELIVERY',
        pickupModeLabel: '仓库配送到厂',
        materialSummary: '车缝主布 / 主片',
        qtyExpected: Math.max(head.qtyExpectedTotal, 120),
        qtyActual: 0,
        qtyUnit: head.qtyUnit || '件',
        submittedAt: '2026-03-20 12:20:00',
        status: 'PENDING_FACTORY_CONFIRM',
        qrCodeValue: buildPickupQrCodeValue('PKR-SEED-TASKGEN0003001-001'),
        warehouseHandedQty: Math.max(head.qtyExpectedTotal, 120),
        warehouseHandedAt: '2026-03-20 12:15:00',
        warehouseHandedBy: '一仓发料员',
        remark: '首批已配送到厂，待工厂确认',
      },
    ]
  }

  if (head.taskId === 'TASKGEN-202603-0004-001__ORDER') {
    return [
      {
        recordId: 'PKR-SEED-TASKGEN0004001-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialCode: 'FAB-SEW-0004',
        materialName: '车缝主布',
        materialSpec: '首批裁片',
        skuCode: 'SKU-0004-A',
        skuColor: '砂灰',
        skuSize: 'L',
        pieceName: '主片',
        pickupMode: 'WAREHOUSE_DELIVERY',
        pickupModeLabel: '仓库配送到厂',
        materialSummary: '车缝主布 / 主片',
        qtyExpected: Math.max(head.qtyExpectedTotal, 160),
        qtyActual: Math.max(head.qtyExpectedTotal, 160),
        qtyUnit: head.qtyUnit || '件',
        submittedAt: '2026-03-20 15:40:00',
        status: 'RECEIVED',
        receivedAt: '2026-03-20 16:10:00',
        qrCodeValue: buildPickupQrCodeValue('PKR-SEED-TASKGEN0004001-001'),
        warehouseHandedQty: Math.max(head.qtyExpectedTotal, 160),
        warehouseHandedAt: '2026-03-20 15:50:00',
        warehouseHandedBy: '一仓发料员',
        factoryConfirmedQty: Math.max(head.qtyExpectedTotal, 160),
        factoryConfirmedAt: '2026-03-20 16:10:00',
        remark: '整单已确认领料',
      },
    ]
  }

  if (head.taskId === 'TASKGEN-202603-0005-001__ORDER') {
    return [
      {
        recordId: 'PKR-SEED-TASKGEN0005001-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialCode: 'FAB-SEW-0005',
        materialName: '车缝主布',
        materialSpec: '首批自提',
        skuCode: 'SKU-0005-A',
        skuColor: '深蓝',
        skuSize: 'M',
        pieceName: '主片',
        pickupMode: 'FACTORY_PICKUP',
        pickupModeLabel: '工厂到仓自提',
        materialSummary: '车缝主布 / 主片',
        qtyExpected: Math.max(head.qtyExpectedTotal, 140),
        qtyUnit: head.qtyUnit || '件',
        submittedAt: '2026-03-20 17:10:00',
        status: 'OBJECTION_PROCESSING',
        qrCodeValue: buildPickupQrCodeValue('PKR-SEED-TASKGEN0005001-001'),
        warehouseHandedQty: Math.max(head.qtyExpectedTotal, 140),
        warehouseHandedAt: '2026-03-20 17:00:00',
        warehouseHandedBy: '二仓发料员',
        factoryReportedQty: Math.max(head.qtyExpectedTotal - 28, 112),
        exceptionCaseId: 'EX-PICKUP-TASKGEN0005001',
        objectionReason: '工厂复点数量少于仓库交付数量',
        objectionRemark: '差异待仓库复核处理',
        objectionStatus: 'PROCESSING',
        followUpRemark: '仓库正在复核并补传交付凭证',
        remark: '数量差异处理中',
      },
    ]
  }

  return []
}

function buildTaskBoardHandoutRecordSeeds(head: PdaHandoverHead): PdaHandoverRecord[] {
  if (head.headType !== 'HANDOUT') return []

  if (head.taskId === 'TASKGEN-202603-0001-001__ORDER') {
    return [
      {
        recordId: 'HOR-SEED-TASKGEN0001001-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialName: '车缝半成品',
        materialSpec: '整单回货',
        skuCode: 'SKU-0001-A',
        skuColor: '黑色',
        skuSize: 'M',
        pieceName: '半成品包',
        plannedQty: Math.max(head.qtyExpectedTotal, 180),
        qtyUnit: head.qtyUnit || '件',
        factorySubmittedAt: '2026-03-21 09:10:00',
        factoryRemark: '仓库复核数量存在差异',
        factoryProofFiles: [],
        status: 'OBJECTION_PROCESSING',
        objectionReason: '仓库回写数量与工厂提交数量不一致',
        objectionRemark: '待平台核对后处理',
        objectionStatus: 'PROCESSING',
        followUpRemark: '仓库与工厂正在共同复核',
      },
    ]
  }

  if (head.taskId === 'TASKGEN-202603-0002-003__ORDER') {
    return [
      {
        recordId: 'HOR-SEED-TASKGEN0002003-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialName: '特殊工艺半成品',
        materialSpec: '首批回货',
        skuCode: 'SKU-0002-C',
        skuColor: '水洗蓝',
        skuSize: '整单',
        pieceName: '半成品包',
        plannedQty: Math.max(head.qtyExpectedTotal, 120),
        qtyUnit: head.qtyUnit || '件',
        factorySubmittedAt: '2026-03-21 10:20:00',
        factoryRemark: '已发起交出，待仓库回写',
        factoryProofFiles: [],
        status: 'PENDING_WRITEBACK',
      },
    ]
  }

  if (head.taskId === 'TASKGEN-202603-0002-005__ORDER') {
    return [
      {
        recordId: 'HOR-SEED-TASKGEN0002005-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialName: '后道成衣',
        materialSpec: '后道首批交出',
        skuCode: 'SKU-0002-E',
        skuColor: '暗红',
        skuSize: '整单',
        pieceName: '半成品包',
        plannedQty: Math.max(Math.round(head.qtyExpectedTotal * 0.6), 90),
        qtyUnit: head.qtyUnit || '件',
        factorySubmittedAt: '2026-03-21 11:00:00',
        factoryRemark: '首批已回写',
        factoryProofFiles: [],
        status: 'WRITTEN_BACK',
        warehouseReturnNo: 'RET-TASKGEN0002005-001',
        warehouseWrittenQty: Math.max(Math.round(head.qtyExpectedTotal * 0.6), 90),
        warehouseWrittenAt: '2026-03-21 11:20:00',
      },
      {
        recordId: 'HOR-SEED-TASKGEN0002005-002',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 2,
        materialName: '后道成衣',
        materialSpec: '后道尾批交出',
        skuCode: 'SKU-0002-E',
        skuColor: '暗红',
        skuSize: '整单',
        pieceName: '半成品包',
        plannedQty: Math.max(head.qtyExpectedTotal - Math.max(Math.round(head.qtyExpectedTotal * 0.6), 90), 40),
        qtyUnit: head.qtyUnit || '件',
        factorySubmittedAt: '2026-03-21 11:45:00',
        factoryRemark: '尾批待接收方回写',
        factoryProofFiles: [],
        status: 'PENDING_WRITEBACK',
      },
    ]
  }

  if (head.taskId === 'TASKGEN-202603-0008-001__ORDER') {
    return [
      {
        recordId: 'HOR-SEED-TASKGEN0008001-001',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: 1,
        materialName: '车缝半成品',
        materialSpec: '整单回货',
        skuCode: 'SKU-0008-A',
        skuColor: '卡其',
        skuSize: '整单',
        pieceName: '半成品包',
        plannedQty: Math.max(head.qtyExpectedTotal, 150),
        qtyUnit: head.qtyUnit || '件',
        factorySubmittedAt: '2026-03-21 12:10:00',
        factoryRemark: '整单已回仓完成',
        factoryProofFiles: [],
        status: 'WRITTEN_BACK',
        warehouseReturnNo: 'RET-TASKGEN0008001-001',
        warehouseWrittenQty: Math.max(head.qtyExpectedTotal, 150),
        warehouseWrittenAt: '2026-03-21 12:40:00',
      },
    ]
  }

  return []
}

headCompletionOverrides.set('HOH-MOCK-CUT-094', {
  completionStatus: 'COMPLETED',
  completedByWarehouseAt: '2026-03-22 10:45:00',
})

headCompletionOverrides.set('HOH-MOCK-CUT-103-F004-DONE', {
  completionStatus: 'COMPLETED',
  completedByWarehouseAt: '2026-03-24 18:20:00',
})

PDA_GENERIC_HANDOVER_HEADS
  .filter((head) => head.completionStatus === 'COMPLETED')
  .forEach((head) => {
    headCompletionOverrides.set(head.handoverId, {
      completionStatus: 'COMPLETED',
      completedByWarehouseAt: head.completedByWarehouseAt,
    })
  })

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function cloneProofFiles(files: HandoverProofFile[]): HandoverProofFile[] {
  return files.map((file) => ({ ...file }))
}

function cloneCutPieceLines(lines: PdaCutPieceHandoutLine[] | undefined): PdaCutPieceHandoutLine[] | undefined {
  return lines?.map((line) => ({ ...line }))
}

function cloneHead(head: PdaHandoverHead): PdaHandoverHead {
  return { ...head }
}

function clonePickupRecord(record: PdaPickupRecord): PdaPickupRecord {
  return {
    ...record,
    objectionProofFiles: cloneProofFiles(record.objectionProofFiles ?? []),
  }
}

function cloneRecord(record: PdaHandoverRecord): PdaHandoverRecord {
  return {
    ...record,
    cutPieceLines: cloneCutPieceLines(record.cutPieceLines),
    recordLines: record.recordLines?.map((line) => ({ ...line })),
    factoryProofFiles: cloneProofFiles(record.factoryProofFiles),
    receiverProofFiles: cloneProofFiles(record.receiverProofFiles ?? []),
    objectionProofFiles: cloneProofFiles(record.objectionProofFiles ?? []),
  }
}

function sumBy<T>(rows: T[], picker: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + picker(row), 0)
}

function makePickupHeadId(docId: string): string {
  return `PKH-${docId}`
}

function makeHandoutHeadId(docId: string): string {
  return `HOH-${docId}`
}

function readIssueDocByHeadId(handoverId: string): WarehouseIssueOrder | undefined {
  if (!handoverId.startsWith('PKH-')) return undefined
  return listWarehouseIssueOrders().find((doc) => makePickupHeadId(doc.id) === handoverId)
}

function readReturnDocByHeadId(handoverId: string): WarehouseReturnOrder | undefined {
  if (!handoverId.startsWith('HOH-')) return undefined
  return listWarehouseReturnOrders().find((doc) => makeHandoutHeadId(doc.id) === handoverId)
}

function mapTaskStatus(task: RuntimeProcessTask | null): 'IN_PROGRESS' | 'DONE' {
  return task?.status === 'DONE' ? 'DONE' : 'IN_PROGRESS'
}

function buildPickupHeadFromIssue(doc: WarehouseIssueOrder): PdaHandoverHead {
  const runtimeTask = getRuntimeTaskById(doc.runtimeTaskId)
  const assignmentGranularity = runtimeTask?.assignmentGranularity
  return {
    handoverId: makePickupHeadId(doc.id),
    headType: 'PICKUP',
    qrCodeValue: '',
    taskId: runtimeTask?.taskId ?? doc.runtimeTaskId,
    taskNo: runtimeTask?.taskNo ?? doc.taskNo ?? doc.runtimeTaskId,
    baseTaskId: runtimeTask?.baseTaskId ?? doc.baseTaskId,
    rootTaskNo: runtimeTask?.rootTaskNo ?? doc.rootTaskNo,
    splitGroupId: runtimeTask?.splitGroupId ?? doc.splitGroupId,
    splitFromTaskNo: runtimeTask?.splitFromTaskNo ?? doc.splitFromTaskNo,
    isSplitResult: runtimeTask?.isSplitResult ?? doc.isSplitResult,
    productionOrderNo: doc.productionOrderId,
    processName: doc.processNameZh,
    sourceFactoryName: doc.warehouseName ?? '仓库',
    targetName: doc.targetFactoryName ?? runtimeTask?.assignedFactoryName ?? '待分配工厂',
    targetKind: 'FACTORY',
    qtyUnit: runtimeTask?.qtyUnit ?? '件',
    factoryId: doc.targetFactoryId ?? runtimeTask?.assignedFactoryId ?? '',
    taskStatus: mapTaskStatus(runtimeTask),
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: sumBy(doc.lines, (line) => line.plannedQty),
    qtyActualTotal: 0,
    qtyDiffTotal: 0,
    runtimeTaskId: doc.runtimeTaskId,
    sourceDocId: doc.id,
    sourceDocNo: doc.docNo,
    scopeType: doc.scopeType,
    scopeKey: doc.scopeKey,
    scopeLabel: doc.scopeLabel,
    executorKind: doc.executorKind,
    transitionFromPrev: runtimeTask?.transitionFromPrev,
    transitionToNext: runtimeTask?.transitionToNext,
    stageCode: runtimeTask?.stageCode,
    stageName: runtimeTask?.stageName,
    processBusinessCode: runtimeTask?.processBusinessCode,
    processBusinessName: runtimeTask?.processBusinessName,
    craftCode: runtimeTask?.craftCode,
    craftName: runtimeTask?.craftName,
    taskTypeCode: runtimeTask
      ? runtimeTask.isSpecialCraft
        ? runtimeTask.craftCode || runtimeTask.processBusinessCode
        : runtimeTask.processBusinessCode
      : undefined,
    taskTypeLabel: runtimeTask?.taskCategoryZh,
    assignmentGranularity,
    assignmentGranularityLabel: assignmentGranularity
      ? PROCESS_ASSIGNMENT_GRANULARITY_LABEL[assignmentGranularity]
      : undefined,
    isSpecialCraft: runtimeTask?.isSpecialCraft,
  }
}

function buildHandoutHeadFromReturn(doc: WarehouseReturnOrder): PdaHandoverHead {
  const runtimeTask = getRuntimeTaskById(doc.runtimeTaskId)
  const assignmentGranularity = runtimeTask?.assignmentGranularity
  const displayUnit = normalizeDisplayUnit(doc.lines[0]?.unit || runtimeTask?.qtyUnit || '件')
  return {
    handoverId: makeHandoutHeadId(doc.id),
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue(makeHandoutHeadId(doc.id)),
    taskId: runtimeTask?.taskId ?? doc.runtimeTaskId,
    taskNo: runtimeTask?.taskNo ?? doc.taskNo ?? doc.runtimeTaskId,
    baseTaskId: runtimeTask?.baseTaskId ?? doc.baseTaskId,
    rootTaskNo: runtimeTask?.rootTaskNo ?? doc.rootTaskNo,
    splitGroupId: runtimeTask?.splitGroupId ?? doc.splitGroupId,
    splitFromTaskNo: runtimeTask?.splitFromTaskNo ?? doc.splitFromTaskNo,
    isSplitResult: runtimeTask?.isSplitResult ?? doc.isSplitResult,
    productionOrderNo: doc.productionOrderId,
    processName: doc.processNameZh,
    sourceFactoryName: doc.targetFactoryName ?? runtimeTask?.assignedFactoryName ?? '待分配工厂',
    targetName: doc.warehouseName ?? '仓库',
    targetKind: 'WAREHOUSE',
    qtyUnit: displayUnit,
    factoryId: doc.targetFactoryId ?? runtimeTask?.assignedFactoryId ?? '',
    taskStatus: mapTaskStatus(runtimeTask),
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: sumBy(doc.lines, (line) => line.plannedQty),
    qtyActualTotal: 0,
    qtyDiffTotal: 0,
    runtimeTaskId: doc.runtimeTaskId,
    sourceDocId: doc.id,
    sourceDocNo: doc.docNo,
    scopeType: doc.scopeType,
    scopeKey: doc.scopeKey,
    scopeLabel: doc.scopeLabel,
    executorKind: doc.executorKind,
    transitionFromPrev: runtimeTask?.transitionFromPrev,
    transitionToNext: runtimeTask?.transitionToNext,
    stageCode: runtimeTask?.stageCode,
    stageName: runtimeTask?.stageName,
    processBusinessCode: runtimeTask?.processBusinessCode,
    processBusinessName: runtimeTask?.processBusinessName,
    craftCode: runtimeTask?.craftCode,
    craftName: runtimeTask?.craftName,
    taskTypeCode: runtimeTask
      ? runtimeTask.isSpecialCraft
        ? runtimeTask.craftCode || runtimeTask.processBusinessCode
        : runtimeTask.processBusinessCode
      : undefined,
    taskTypeLabel: runtimeTask?.taskCategoryZh,
    assignmentGranularity,
    assignmentGranularityLabel: assignmentGranularity
      ? PROCESS_ASSIGNMENT_GRANULARITY_LABEL[assignmentGranularity]
      : undefined,
    isSpecialCraft: runtimeTask?.isSpecialCraft,
  }
}

function isPrepProcessCode(code: string | undefined): boolean {
  if (!code) return false
  return code === 'PRINT' || code === 'DYE' || code === 'PROC_PRINT' || code === 'PROC_DYE'
}

export function buildHandoutHeadQrCodeValue(handoverId: string): string {
  return buildHandoverOrderQrValue(handoverId)
}

function buildPickupQrCodeValue(recordId: string): string {
  return `PICKUP-RECORD:${recordId}`
}

function normalizeDisplayUnit(unit: string | undefined, fallback = '件'): string {
  if (!unit) return fallback
  if (unit === '米') return 'm'
  return unit
}

function resolveHandoutProcessKey(
  processCode: string | undefined,
):
  | 'CUTTING'
  | 'SEWING'
  | 'PRINTING'
  | 'DYEING'
  | 'IRONING'
  | 'PACKAGING'
  | 'QC'
  | 'FINISHING'
  | null {
  if (!processCode) return null
  const normalized = processCode.toUpperCase()
  if (normalized.includes('PRINT')) return 'PRINTING'
  if (normalized.includes('DYE')) return 'DYEING'
  if (normalized.includes('CUT')) return 'CUTTING'
  if (normalized.includes('IRON')) return 'IRONING'
  if (normalized.includes('PACK')) return 'PACKAGING'
  if (normalized.includes('FINISH')) return 'FINISHING'
  if (normalized.includes('QC')) return 'QC'
  if (normalized.includes('SEW')) return 'SEWING'
  return null
}

function deriveHandoutObjectType(
  head: PdaHandoverHead,
  record?: Pick<PdaHandoverRecord, 'handoutObjectType' | 'qtyUnit'>,
  runtimeTask?: RuntimeProcessTask | null,
  sourceDoc?: WarehouseReturnOrder | WarehouseIssueOrder,
): PdaHandoutObjectType {
  if (record?.handoutObjectType) return record.handoutObjectType

  const processKey =
    resolveHandoutProcessKey(runtimeTask?.processCode) ||
    resolveHandoutProcessKey(runtimeTask?.processBusinessCode) ||
    resolveHandoutProcessKey(head.processBusinessCode) ||
    resolveHandoutProcessKey(head.taskTypeCode) ||
    resolveHandoutProcessKey(sourceDoc?.processCode)

  if (processKey === 'PRINTING' || processKey === 'CUTTING') return 'CUT_PIECE'
  if (processKey === 'DYEING') return 'FABRIC'

  const displayUnit = normalizeDisplayUnit(record?.qtyUnit || head.qtyUnit)
  if (displayUnit === '片') return 'CUT_PIECE'
  if (displayUnit === '卷' || displayUnit === 'm') return 'FABRIC'
  return 'GARMENT'
}

function getHandoutObjectTypeLabel(objectType: PdaHandoutObjectType): string {
  if (objectType === 'CUT_PIECE') return '裁片'
  if (objectType === 'FABRIC') return '面料'
  return '成衣'
}

function getHandoutQtyLabels(
  objectType: PdaHandoutObjectType,
  unit: string,
): { primaryQtyLabel: string; writtenQtyLabel: string; pendingQtyLabel: string } {
  if (objectType === 'CUT_PIECE') {
    return {
      primaryQtyLabel: '计划交出裁片片数（片）',
      writtenQtyLabel: '接收方回写裁片片数（片）',
      pendingQtyLabel: '待接收方回写裁片片数（片）',
    }
  }
  if (objectType === 'FABRIC') {
    const normalizedUnit = normalizeDisplayUnit(unit, '卷')
    const objectLabel = normalizedUnit === '卷' ? '面料卷数（卷）' : '面料长度（m）'
    return {
      primaryQtyLabel: `计划交出${objectLabel}`,
      writtenQtyLabel: `接收方回写${objectLabel}`,
      pendingQtyLabel: `待接收方回写${objectLabel}`,
    }
  }
  return {
    primaryQtyLabel: '计划交出成衣件数（件）',
    writtenQtyLabel: '接收方回写成衣件数（件）',
    pendingQtyLabel: '待接收方回写成衣件数（件）',
  }
}

function formatQtyValue(qty: number | undefined, unit: string): string {
  if (typeof qty !== 'number') return '待接收方回写'
  const normalizedUnit = normalizeDisplayUnit(unit)
  return `${Math.round(qty * 100) / 100} ${normalizedUnit}`
}

function uniqueLabels(values: Array<string | undefined>): string[] {
  const normalized = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  return Array.from(new Set(normalized))
}

function formatPartScopeLine(labels: string[]): string {
  if (labels.length === 0) return '涉及部位裁片：未标部位'
  if (labels.length <= 3) return `涉及部位裁片：${labels.join('、')}（${labels.length} 种部位）`
  return `涉及部位裁片：${labels.slice(0, 3).join('、')}等 ${labels.length} 种部位`
}

function formatSkuScopeLine(codes: string[]): string {
  if (codes.length === 0) return '涉及 SKU：未标 SKU'
  if (codes.length <= 2) return `涉及 SKU：${codes.join(' / ')}（${codes.length} 个）`
  return `涉及 SKU：${codes.slice(0, 2).join(' / ')} 等 ${codes.length} 个`
}

export function listCutPieceLines(record: PdaHandoverRecord): PdaCutPieceHandoutLine[] {
  if (record.cutPieceLines && record.cutPieceLines.length > 0) {
    return cloneCutPieceLines(record.cutPieceLines) ?? []
  }

  const plannedPieceQty = typeof record.plannedQty === 'number' ? record.plannedQty : 0
  const garmentEquivalentQty = typeof record.garmentEquivalentQty === 'number' ? record.garmentEquivalentQty : 0
  if (!record.pieceName && !record.skuCode && plannedPieceQty === 0 && garmentEquivalentQty === 0) {
    return []
  }

  return [
    {
      lineId: `${record.recordId}-line-001`,
      piecePartLabel: record.pieceName || '未标部位',
      garmentSkuCode: record.skuCode || '未标 SKU',
      colorLabel: record.skuColor,
      sizeLabel: record.skuSize,
      pieceQty: plannedPieceQty,
      garmentEquivalentQty,
    },
  ]
}

export function groupCutPieceLinesByPart(record: PdaHandoverRecord): PdaCutPiecePartGroup[] {
  const groups = new Map<string, PdaCutPiecePartGroup>()
  listCutPieceLines(record).forEach((line) => {
    const key = `${line.piecePartLabel}::${line.piecePartCode || ''}`
    const existed = groups.get(key)
    if (existed) {
      existed.totalPieceQty += line.pieceQty
      existed.totalGarmentEquivalentQty += line.garmentEquivalentQty
      existed.skuLines.push({ ...line })
      return
    }

    groups.set(key, {
      partLabel: line.piecePartLabel,
      partCode: line.piecePartCode,
      totalPieceQty: line.pieceQty,
      totalGarmentEquivalentQty: line.garmentEquivalentQty,
      skuLines: [{ ...line }],
    })
  })
  return Array.from(groups.values())
}

export function deriveCutPieceRecordSummary(record: PdaHandoverRecord): PdaCutPieceRecordSummary {
  const lines = listCutPieceLines(record)
  const plannedFromLines = sumBy(lines, (line) => line.pieceQty)
  const garmentFromLines = sumBy(lines, (line) => line.garmentEquivalentQty)
  const plannedPieceQtyTotal = plannedFromLines > 0 ? plannedFromLines : typeof record.plannedQty === 'number' ? record.plannedQty : 0
  const returnedPieceQtyTotal = resolveReceiverWrittenQty(record) ?? 0
  const pendingPieceQtyTotal = Math.max(plannedPieceQtyTotal - returnedPieceQtyTotal, 0)
  const garmentEquivalentQtyTotal =
    garmentFromLines > 0 ? garmentFromLines : typeof record.garmentEquivalentQty === 'number' ? record.garmentEquivalentQty : 0

  return {
    involvedPartLabels: uniqueLabels(lines.map((line) => line.piecePartLabel)),
    involvedPartCount: uniqueLabels(lines.map((line) => line.piecePartLabel)).length,
    involvedSkuCodes: uniqueLabels(lines.map((line) => line.garmentSkuCode)),
    involvedSkuCount: uniqueLabels(lines.map((line) => line.garmentSkuCode)).length,
    plannedPieceQtyTotal,
    returnedPieceQtyTotal,
    pendingPieceQtyTotal,
    garmentEquivalentQtyTotal,
  }
}

export function buildCutPieceHeadSummary(head: PdaHandoverHead, records: PdaHandoverRecord[]): PdaCutPieceRecordSummary {
  const lines = records.flatMap((record) => listCutPieceLines(record))
  const plannedFromLines = sumBy(lines, (line) => line.pieceQty)
  const plannedFromRecords = sumBy(records, (record) => (typeof record.plannedQty === 'number' ? record.plannedQty : 0))
  const returnedPieceQtyTotal =
    records.length > 0
      ? sumBy(records, (record) => resolveReceiverWrittenQty(record) ?? 0)
      : head.writtenBackQtyTotal
  const plannedPieceQtyTotal = plannedFromLines > 0 ? plannedFromLines : records.length > 0 ? plannedFromRecords : head.qtyExpectedTotal
  const pendingPieceQtyTotal = Math.max(plannedPieceQtyTotal - returnedPieceQtyTotal, 0)
  const garmentFromLines = sumBy(lines, (line) => line.garmentEquivalentQty)
  const garmentFromRecords = sumBy(records, (record) => (typeof record.garmentEquivalentQty === 'number' ? record.garmentEquivalentQty : 0))

  return {
    involvedPartLabels: uniqueLabels(lines.map((line) => line.piecePartLabel)),
    involvedPartCount: uniqueLabels(lines.map((line) => line.piecePartLabel)).length,
    involvedSkuCodes: uniqueLabels(lines.map((line) => line.garmentSkuCode)),
    involvedSkuCount: uniqueLabels(lines.map((line) => line.garmentSkuCode)).length,
    plannedPieceQtyTotal,
    returnedPieceQtyTotal,
    pendingPieceQtyTotal,
    garmentEquivalentQtyTotal: garmentFromLines > 0 ? garmentFromLines : garmentFromRecords,
  }
}

function buildHandoutInfoLines(record: PdaHandoverRecord, objectType: PdaHandoutObjectType): string[] {
  if (objectType === 'CUT_PIECE') {
    const cutPieceSummary = deriveCutPieceRecordSummary(record)
    return [formatPartScopeLine(cutPieceSummary.involvedPartLabels), formatSkuScopeLine(cutPieceSummary.involvedSkuCodes)]
  }

  if (objectType === 'FABRIC') {
    return [
      record.materialCode || record.skuCode ? `面料 SKU：${record.materialCode || record.skuCode || '—'}` : '',
      record.skuColor ? `颜色：${record.skuColor}` : '',
      record.materialSpec ? `面料说明：${record.materialSpec}` : '',
    ].filter(Boolean)
  }

  return [
    record.skuCode ? `SKU 编码：${record.skuCode}` : '',
    record.skuColor || record.skuSize ? `颜色 / 尺码：${record.skuColor || '—'} / ${record.skuSize || '—'}` : '',
    record.materialSpec ? `交出说明：${record.materialSpec}` : '',
  ].filter(Boolean)
}

function buildHandoutListLine(record: PdaHandoverRecord, objectType: PdaHandoutObjectType): string {
  if (record.handoutItemLabel) return record.handoutItemLabel
  if (objectType === 'CUT_PIECE') {
    const cutPieceSummary = deriveCutPieceRecordSummary(record)
    return `${formatPartScopeLine(cutPieceSummary.involvedPartLabels).replace('涉及部位裁片：', '')} / ${formatSkuScopeLine(cutPieceSummary.involvedSkuCodes).replace('涉及 SKU：', '')}`
  }
  if (objectType === 'FABRIC') {
    return `${record.materialCode || record.skuCode || record.materialName || '面料'} / ${record.skuColor || '未标颜色'} / ${formatQtyValue(record.plannedQty, record.qtyUnit || '卷')}`
  }
  return `${record.skuColor || '未标颜色'} / ${record.skuCode || record.materialCode || record.materialName || '成衣'} / ${formatQtyValue(record.plannedQty, record.qtyUnit || '件')}`
}

export function deriveHandoutRecordProfile(
  record: PdaHandoverRecord,
  head: PdaHandoverHead,
  runtimeTask: RuntimeProcessTask | null = getPdaHeadRuntimeTask(head.handoverId),
  sourceDoc: WarehouseReturnOrder | WarehouseIssueOrder | undefined = getPdaHeadSourceExecutionDoc(head.handoverId),
): PdaHandoutRecordProfile {
  const objectType = deriveHandoutObjectType(head, record, runtimeTask, sourceDoc)
  const displayUnit = normalizeDisplayUnit(record.qtyUnit || head.qtyUnit, objectType === 'FABRIC' ? '卷' : objectType === 'CUT_PIECE' ? '片' : '件')
  const labels = getHandoutQtyLabels(objectType, displayUnit)
  if (objectType === 'CUT_PIECE') {
    const cutPieceRecordSummary = deriveCutPieceRecordSummary(record)
    const cutPiecePartGroups = groupCutPieceLinesByPart(record)
    const itemTitle =
      cutPiecePartGroups.length > 1
        ? '多部位裁片交出'
        : cutPiecePartGroups[0]?.partLabel
          ? `${cutPiecePartGroups[0].partLabel}交出`
          : record.pieceName || '裁片交出物'

    return {
      objectType,
      objectTypeLabel: getHandoutObjectTypeLabel(objectType),
      displayUnit,
      plannedQtyLabel: labels.primaryQtyLabel,
      writtenQtyLabel: labels.writtenQtyLabel,
      pendingQtyLabel: labels.pendingQtyLabel,
      itemTitle,
      infoLines: [formatPartScopeLine(cutPieceRecordSummary.involvedPartLabels), formatSkuScopeLine(cutPieceRecordSummary.involvedSkuCodes)],
      plannedQtyText: `${cutPieceRecordSummary.plannedPieceQtyTotal} ${displayUnit}`,
      writtenQtyText: formatQtyValue(
        typeof resolveReceiverWrittenQty(record) === 'number' ? cutPieceRecordSummary.returnedPieceQtyTotal : undefined,
        displayUnit,
      ),
      pendingQtyText: `${cutPieceRecordSummary.pendingPieceQtyTotal} ${displayUnit}`,
      garmentEquivalentQty:
        cutPieceRecordSummary.garmentEquivalentQtyTotal > 0 ? cutPieceRecordSummary.garmentEquivalentQtyTotal : undefined,
      cutPieceRecordSummary,
      cutPiecePartGroups,
    }
  }

  const plannedQty = typeof record.plannedQty === 'number' ? record.plannedQty : 0
  const writtenQty = resolveReceiverWrittenQty(record) ?? 0
  const pendingQty = Math.max(plannedQty - writtenQty, 0)

  return {
    objectType,
    objectTypeLabel: getHandoutObjectTypeLabel(objectType),
    displayUnit,
    plannedQtyLabel: labels.primaryQtyLabel,
    writtenQtyLabel: labels.writtenQtyLabel,
    pendingQtyLabel: labels.pendingQtyLabel,
    itemTitle:
      objectType === 'FABRIC'
        ? record.materialName || record.materialCode || '面料交出物'
        : objectType === 'CUT_PIECE'
          ? record.pieceName || record.materialName || '裁片交出物'
          : record.materialName || '成衣交出物',
    infoLines: buildHandoutInfoLines(record, objectType),
    plannedQtyText: `${plannedQty} ${displayUnit}`,
    writtenQtyText: formatQtyValue(resolveReceiverWrittenQty(record), displayUnit),
    pendingQtyText: `${pendingQty} ${displayUnit}`,
    garmentEquivalentQty: record.garmentEquivalentQty,
  }
}

export function deriveHandoutObjectProfile(
  head: PdaHandoverHead,
  records: PdaHandoverRecord[],
  runtimeTask: RuntimeProcessTask | null = getPdaHeadRuntimeTask(head.handoverId),
  sourceDoc: WarehouseReturnOrder | WarehouseIssueOrder | undefined = getPdaHeadSourceExecutionDoc(head.handoverId),
): PdaHandoutObjectProfile {
  const objectType = deriveHandoutObjectType(head, records[0], runtimeTask, sourceDoc)
  const displayUnit = normalizeDisplayUnit(
    records[0]?.qtyUnit || head.qtyUnit,
    objectType === 'FABRIC' ? '卷' : objectType === 'CUT_PIECE' ? '片' : '件',
  )
  const labels = getHandoutQtyLabels(objectType, displayUnit)
  if (objectType === 'CUT_PIECE') {
    const cutPieceRecordSummary = buildCutPieceHeadSummary(head, records)
    return {
      objectType,
      objectTypeLabel: getHandoutObjectTypeLabel(objectType),
      primaryQtyLabel: labels.primaryQtyLabel,
      writtenQtyLabel: labels.writtenQtyLabel,
      pendingQtyLabel: labels.pendingQtyLabel,
      displayUnit,
      objectInfoLines: [
        formatPartScopeLine(cutPieceRecordSummary.involvedPartLabels),
        formatSkuScopeLine(cutPieceRecordSummary.involvedSkuCodes),
      ],
      totalPlannedQty: cutPieceRecordSummary.plannedPieceQtyTotal,
      totalWrittenQty: cutPieceRecordSummary.returnedPieceQtyTotal,
      totalPendingQty: cutPieceRecordSummary.pendingPieceQtyTotal,
      garmentEquivalentQtyTotal:
        cutPieceRecordSummary.garmentEquivalentQtyTotal > 0 ? cutPieceRecordSummary.garmentEquivalentQtyTotal : undefined,
      cutPieceRecordSummary,
    }
  }

  const totalPlannedQty =
    records.length > 0
      ? sumBy(records, (record) => (typeof record.plannedQty === 'number' ? record.plannedQty : 0))
      : head.qtyExpectedTotal
  const totalWrittenQty =
    records.length > 0
      ? sumBy(records, (record) => resolveReceiverWrittenQty(record) ?? 0)
      : head.writtenBackQtyTotal
  const totalPendingQty = Math.max(totalPlannedQty - totalWrittenQty, 0)
  const garmentEquivalentQtyTotal =
    objectType === 'CUT_PIECE'
      ? sumBy(records, (record) => (typeof record.garmentEquivalentQty === 'number' ? record.garmentEquivalentQty : 0))
      : undefined

  return {
    objectType,
    objectTypeLabel: getHandoutObjectTypeLabel(objectType),
    primaryQtyLabel: labels.primaryQtyLabel,
    writtenQtyLabel: labels.writtenQtyLabel,
    pendingQtyLabel: labels.pendingQtyLabel,
    displayUnit,
    objectInfoLines: records.slice(0, 3).map((record) => buildHandoutListLine(record, objectType)),
    totalPlannedQty,
    totalWrittenQty,
    totalPendingQty,
    garmentEquivalentQtyTotal:
      typeof garmentEquivalentQtyTotal === 'number' && garmentEquivalentQtyTotal > 0
        ? garmentEquivalentQtyTotal
        : undefined,
  }
}

function isPickupRecordFinalized(record: PdaPickupRecord): boolean {
  return record.status === 'RECEIVED' || record.status === 'OBJECTION_RESOLVED'
}

function getPickupRecordFinalQty(record: PdaPickupRecord): number {
  if (typeof record.finalResolvedQty === 'number') return record.finalResolvedQty
  if (typeof record.factoryConfirmedQty === 'number') return record.factoryConfirmedQty
  return 0
}

function shouldIncludePdaDoc(
  doc: WarehouseIssueOrder | WarehouseReturnOrder,
  runtimeTask: RuntimeProcessTask | null,
): boolean {
  if (runtimeTask?.stageCode === 'PREP') return false
  if (isPrepProcessCode(runtimeTask?.processBusinessCode) || isPrepProcessCode(runtimeTask?.processCode)) return false
  if (isPrepProcessCode(doc.processCode)) return false
  const businessProcessCode = runtimeTask?.processBusinessCode
  if (businessProcessCode && isPostCapacityNode(businessProcessCode)) return false
  if (businessProcessCode && !isExternalTaskProcess(businessProcessCode)) return false
  return true
}

function mapIssueLineStatus(doc: WarehouseIssueOrder, line: WarehouseIssueOrder['lines'][number]): PdaPickupRecordStatus {
  if (
    (doc.status === 'ISSUED' || doc.status === 'IN_TRANSIT' || doc.status === 'RECEIVED' || doc.status === 'CLOSED') &&
    line.issuedQty > 0
  ) {
    return 'PENDING_FACTORY_CONFIRM'
  }
  if (line.preparedQty >= line.plannedQty && line.plannedQty > 0) return 'PENDING_FACTORY_PICKUP'
  if (doc.status === 'READY') return 'PENDING_FACTORY_PICKUP'
  return 'PENDING_WAREHOUSE_DISPATCH'
}

function buildPickupLineRecord(
  head: PdaHandoverHead,
  doc: WarehouseIssueOrder,
  line: WarehouseIssueOrder['lines'][number],
  index: number,
): PdaPickupRecord {
  const status = mapIssueLineStatus(doc, line)
  const recordId = `PKR-${doc.id}-${String(index + 1).padStart(3, '0')}`
  const warehouseHandedQty =
    status === 'PENDING_FACTORY_CONFIRM' ? Math.max(line.issuedQty, line.plannedQty > 0 ? line.plannedQty : line.issuedQty) : undefined
  return {
    recordId,
    handoverId: head.handoverId,
    taskId: head.taskId,
    sequenceNo: index + 1,
    materialCode: line.materialCode,
    materialName: line.materialName,
    materialSpec: line.materialSpec,
    skuCode: line.skuCode,
    skuColor: line.skuColor,
    skuSize: line.skuSize,
    pieceName: line.pieceName,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: line.pieceName ? `${line.materialName} / ${line.pieceName}` : line.materialName,
    qtyExpected: line.plannedQty,
    qtyUnit: line.unit,
    submittedAt: doc.updatedAt,
    status,
    qrCodeValue: buildPickupQrCodeValue(recordId),
    warehouseHandedQty,
    warehouseHandedAt: status === 'PENDING_FACTORY_CONFIRM' ? doc.updatedAt : undefined,
    warehouseHandedBy: status === 'PENDING_FACTORY_CONFIRM' ? '仓库扫码员' : undefined,
    remark: doc.remark,
  }
}

function mapReturnLineStatus(doc: WarehouseReturnOrder, line: WarehouseReturnOrder['lines'][number]): HandoverRecordStatus {
  if (line.returnedQty > 0) return 'WRITTEN_BACK'
  if (doc.status === 'RETURNED' || doc.status === 'CLOSED') return 'WRITTEN_BACK'
  return 'PENDING_WRITEBACK'
}

function buildHandoutLineRecord(
  head: PdaHandoverHead,
  doc: WarehouseReturnOrder,
  line: WarehouseReturnOrder['lines'][number],
  index: number,
): PdaHandoverRecord {
  const status = mapReturnLineStatus(doc, line)
  const writtenQty = status === 'WRITTEN_BACK' ? Math.max(line.returnedQty, 0) : undefined
  const objectType = deriveHandoutObjectType(
    head,
    { handoutObjectType: undefined, qtyUnit: line.unit },
    getRuntimeTaskById(doc.runtimeTaskId),
    doc,
  )
  const sourceText = line.pieceName ? `${line.materialName} / ${line.pieceName}` : line.materialName
  const garmentEquivalentQty =
    objectType === 'CUT_PIECE' && typeof line.pieceCountPerUnit === 'number' && line.pieceCountPerUnit > 0
      ? Math.round((line.plannedQty / line.pieceCountPerUnit) * 100) / 100
      : undefined

  return hydrateHandoverRecordDomain({
    recordId: `HOR-${doc.id}-${String(index + 1).padStart(3, '0')}`,
    handoverId: head.handoverId,
    taskId: head.taskId,
    sequenceNo: index + 1,
    handoutObjectType: objectType,
    handoutItemLabel: buildHandoutListLine(
      {
        recordId: '',
        handoverId: head.handoverId,
        taskId: head.taskId,
        sequenceNo: index + 1,
        handoutObjectType: objectType,
        materialCode: line.materialCode,
        materialName: line.materialName,
        materialSpec: line.materialSpec,
        skuCode: line.skuCode,
        skuColor: line.skuColor,
        skuSize: line.skuSize,
        pieceName: line.pieceName,
        plannedQty: line.plannedQty,
        qtyUnit: line.unit,
        factorySubmittedAt: doc.updatedAt,
        factoryProofFiles: [],
        status,
      },
      objectType,
    ),
    materialCode: line.materialCode,
    materialName: line.materialName,
    materialSpec: line.materialSpec,
    skuCode: line.skuCode,
    skuColor: line.skuColor,
    skuSize: line.skuSize,
    pieceName: line.pieceName,
    garmentEquivalentQty,
    cutPieceLines:
      objectType === 'CUT_PIECE'
        ? [
            {
              lineId: `CUTLINE-${doc.id}-${String(index + 1).padStart(3, '0')}`,
              piecePartLabel: line.pieceName || '未标部位',
              garmentSkuCode: line.skuCode || '未标 SKU',
              colorLabel: line.skuColor,
              sizeLabel: line.skuSize,
              pieceQty: line.plannedQty,
              garmentEquivalentQty: garmentEquivalentQty || 0,
            },
          ]
        : undefined,
    plannedQty: line.plannedQty,
    submittedQty: line.plannedQty,
    qtyUnit: normalizeDisplayUnit(line.unit),
    factorySubmittedAt: doc.updatedAt,
    factoryRemark: `回货来源：${sourceText}`,
    factoryProofFiles: [],
    status,
    warehouseReturnNo: status === 'WRITTEN_BACK' ? doc.docNo : undefined,
    warehouseWrittenQty: writtenQty,
    warehouseWrittenAt: status === 'WRITTEN_BACK' ? doc.updatedAt : undefined,
  }, head)
}

function getHeadCompletionOverride(handoverId: string): {
  completionStatus: PdaHeadCompletionStatus
  completedByWarehouseAt?: string
} | null {
  return headCompletionOverrides.get(handoverId) ?? null
}

function getPickupRecordsForHeadInternal(head: PdaHandoverHead): PdaPickupRecord[] {
  const mockRecords = PDA_MOCK_PICKUP_RECORDS[head.handoverId]?.map(clonePickupRecord) ?? []
  const taskBoardSeedRecords = buildTaskBoardPickupRecordSeeds(head)
  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseIssueOrder | null) : null
  const baseRecords =
    mockRecords.length > 0
      ? mockRecords
      : taskBoardSeedRecords.length > 0
        ? taskBoardSeedRecords
      : doc && doc.docType === 'ISSUE'
        ? doc.lines.map((line, index) => buildPickupLineRecord(head, doc, line, index))
        : []

  const appended = pickupRecordAdditions.get(head.handoverId) ?? []
  const merged = [...baseRecords, ...appended].map((record) => ({ ...record, ...(pickupRecordOverrides.get(record.recordId) ?? {}) }))

  return merged
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map(clonePickupRecord)
}

function getHandoutRecordsForHeadInternal(head: PdaHandoverHead): PdaHandoverRecord[] {
  const mockRecords = PDA_MOCK_HANDOUT_RECORDS[head.handoverId]?.map(cloneRecord) ?? []
  const taskBoardSeedRecords = buildTaskBoardHandoutRecordSeeds(head)
  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseReturnOrder | null) : null
  const baseRecords =
    mockRecords.length > 0
      ? mockRecords
      : taskBoardSeedRecords.length > 0
        ? taskBoardSeedRecords
      : doc && doc.docType === 'RETURN'
        ? doc.lines.map((line, index) => buildHandoutLineRecord(head, doc, line, index))
        : []

  const appended = handoutRecordAdditions.get(head.handoverId) ?? []
  const merged = [...baseRecords, ...appended].map((record) => ({ ...record, ...(handoutRecordOverrides.get(record.recordId) ?? {}) }))

  return merged
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map((record) => cloneRecord(hydrateHandoverRecordDomain(record, head)))
}

function refreshPickupHeadSummary(head: PdaHandoverHead): PdaHandoverHead {
  const records = getPickupRecordsForHeadInternal(head)
  const pendingCount = records.filter((record) => !isPickupRecordFinalized(record)).length
  const objectionCount = records.filter(
    (record) =>
      record.status === 'OBJECTION_REPORTED' ||
      record.status === 'OBJECTION_PROCESSING' ||
      record.status === 'OBJECTION_RESOLVED',
  ).length
  const writtenQtyTotal = sumBy(records.filter(isPickupRecordFinalized), getPickupRecordFinalQty)
  const latestAt = records
    .map(
      (record) =>
        record.finalResolvedAt ||
        record.factoryConfirmedAt ||
        record.warehouseHandedAt ||
        record.receivedAt ||
        record.submittedAt,
    )
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

  const updated: PdaHandoverHead = {
    ...head,
    recordCount: records.length,
    pendingWritebackCount: pendingCount,
    writtenBackQtyTotal: writtenQtyTotal,
    qtyActualTotal: writtenQtyTotal,
    qtyDiffTotal: head.qtyExpectedTotal - writtenQtyTotal,
    objectionCount,
    lastRecordAt: latestAt,
    summaryStatus:
      records.length === 0
        ? 'NONE'
        : objectionCount > 0
          ? 'HAS_OBJECTION'
          : pendingCount === records.length
          ? 'SUBMITTED'
          : pendingCount > 0
          ? 'PARTIAL_WRITTEN_BACK'
          : 'WRITTEN_BACK',
  }

  const completionOverride = getHeadCompletionOverride(head.handoverId)
  if (completionOverride) {
    updated.completionStatus = completionOverride.completionStatus
    updated.completedByWarehouseAt = completionOverride.completedByWarehouseAt
    return updated
  }

  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseIssueOrder | null) : null
  const autoCompleted = Boolean(
    doc &&
      (doc.status === 'RECEIVED' || doc.status === 'CLOSED') &&
      pendingCount === 0 &&
      objectionCount === 0,
  )
  updated.completionStatus = autoCompleted ? 'COMPLETED' : 'OPEN'
  updated.completedByWarehouseAt = autoCompleted ? doc?.updatedAt : undefined
  return updated
}

function refreshHandoutHeadSummary(head: PdaHandoverHead): PdaHandoverHead {
  const records = getHandoutRecordsForHeadInternal(head)
  const pendingCount = records.filter((record) => record.handoverRecordStatus === 'SUBMITTED_WAIT_WRITEBACK').length
  const objectionCount = records.filter(
    (record) =>
      record.handoverRecordStatus === 'OBJECTION_REPORTED' ||
      record.handoverRecordStatus === 'OBJECTION_PROCESSING' ||
      record.handoverRecordStatus === 'OBJECTION_RESOLVED',
  ).length
  const writtenQtyTotal = sumBy(records, (record) => resolveReceiverWrittenQty(record) ?? 0)
  const latestAt = records
    .map((record) => record.receiverWrittenAt || record.factorySubmittedAt)
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

  let updated: PdaHandoverHead = {
    ...hydrateHandoverHeadDomain(head, records),
    recordCount: records.length,
    pendingWritebackCount: pendingCount,
    writtenBackQtyTotal: writtenQtyTotal,
    qtyActualTotal: writtenQtyTotal,
    qtyDiffTotal: head.qtyExpectedTotal - writtenQtyTotal,
    objectionCount,
    lastRecordAt: latestAt,
    summaryStatus:
      records.length === 0
        ? 'NONE'
        : objectionCount > 0
          ? 'HAS_OBJECTION'
          : pendingCount === records.length
            ? 'SUBMITTED'
            : pendingCount > 0
              ? 'PARTIAL_WRITTEN_BACK'
              : 'WRITTEN_BACK',
  }

  const completionOverride = getHeadCompletionOverride(head.handoverId)
  if (completionOverride) {
    updated = hydrateHandoverHeadDomain(
      {
        ...updated,
        completionStatus: completionOverride.completionStatus,
        completedByWarehouseAt: completionOverride.completedByWarehouseAt,
      },
      records,
    )
    return updated
  }

  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseReturnOrder | null) : null
  const autoCompleted = Boolean(
    doc &&
      (doc.status === 'RETURNED' || doc.status === 'CLOSED') &&
      pendingCount === 0 &&
      objectionCount === 0,
  )
  updated = hydrateHandoverHeadDomain(
    {
      ...updated,
      completionStatus: autoCompleted ? 'COMPLETED' : 'OPEN',
      completedByWarehouseAt: autoCompleted ? doc?.updatedAt : undefined,
    },
    records,
  )
  return updated
}

function recomputeHeadsInternal(): PdaHandoverHead[] {
  const pickupHeads = listWarehouseIssueOrders()
    .filter((doc) => doc.targetType === 'EXTERNAL_FACTORY')
    .filter((doc) => shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId)))
    .map((doc) => refreshPickupHeadSummary(buildPickupHeadFromIssue(doc)))

  const handoutHeads = listWarehouseReturnOrders()
    .filter((doc) => shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId)))
    .map((doc) => refreshHandoutHeadSummary(buildHandoutHeadFromReturn(doc)))

  const mockHeads = PDA_MOCK_HANDOVER_HEADS.map((head) =>
    head.headType === 'PICKUP'
      ? refreshPickupHeadSummary(cloneHead(head))
      : refreshHandoutHeadSummary(cloneHead(head)),
  )

  const addedHeads = Array.from(handoverHeadAdditions.values()).map((head) =>
    head.headType === 'PICKUP'
      ? refreshPickupHeadSummary(cloneHead(head))
      : refreshHandoutHeadSummary(cloneHead(head)),
  )

  return [...pickupHeads, ...handoutHeads, ...mockHeads, ...addedHeads]
}

function buildHeadsInternal(): PdaHandoverHead[] {
  if (!cachedBuiltHeads) {
    cachedBuiltHeads = recomputeHeadsInternal()
  }
  return cachedBuiltHeads
}

function listHeadsSorted(factoryId?: string): PdaHandoverHead[] {
  return buildHeadsInternal()
    .filter((head) => !factoryId || head.factoryId === factoryId)
    .sort((a, b) => {
      const bTime = parseDateMs(b.lastRecordAt || b.completedByWarehouseAt || '')
      const aTime = parseDateMs(a.lastRecordAt || a.completedByWarehouseAt || '')
      const safeB = Number.isFinite(bTime) ? bTime : 0
      const safeA = Number.isFinite(aTime) ? aTime : 0
      return safeB - safeA
    })
    .map(cloneHead)
}

function findHead(handoverId: string): PdaHandoverHead | undefined {
  return buildHeadsInternal().find((item) => item.handoverId === handoverId)
}

function findRecord(recordId: string): PdaHandoverRecord | undefined {
  const head = buildHeadsInternal().find((item) => item.headType === 'HANDOUT')
  if (!head) {
    for (const one of buildHeadsInternal().filter((item) => item.headType === 'HANDOUT')) {
      const found = getHandoutRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
      if (found) return found
    }
    return undefined
  }

  const allHeads = buildHeadsInternal().filter((item) => item.headType === 'HANDOUT')
  for (const one of allHeads) {
    const found = getHandoutRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
    if (found) return found
  }
  return undefined
}

function findPickupRecord(recordId: string): PdaPickupRecord | undefined {
  const allHeads = buildHeadsInternal().filter((item) => item.headType === 'PICKUP')
  for (const one of allHeads) {
    const found = getPickupRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
    if (found) return found
  }
  return undefined
}

function findTaskById(taskId: string): RuntimeProcessTask | PdaTaskMockProcessTaskLike | null {
  return getRuntimeTaskById(taskId) ?? listPdaGenericProcessTasks().find((task) => task.taskId === taskId) ?? null
}

type PdaTaskMockProcessTaskLike = ReturnType<typeof listPdaGenericProcessTasks>[number]

function isTaskEligibleForHandover(task: {
  processBusinessCode?: string
  processCode?: string
  startedAt?: string
}): boolean {
  const processCode = task.processBusinessCode || task.processCode
  if (!processCode) return false
  if (isPostCapacityNode(processCode)) return false
  const definition = getProcessDefinitionByCode(processCode)
  if (definition) return definition.generatesExternalTask
  return isExternalTaskProcess(processCode)
}

function resolveTaskReceiver(task: {
  receiverKind?: 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
  receiverId?: string
  receiverName?: string
  processBusinessCode?: string
  processNameZh?: string
  assignedFactoryId?: string
}): {
  receiverKind: HandoverReceiverKind
  receiverId: string
  receiverName: string
} {
  if (task.receiverKind && task.receiverId && task.receiverName) {
    return {
      receiverKind: task.receiverKind,
      receiverId: task.receiverId,
      receiverName: task.receiverName,
    }
  }

  if (task.processBusinessCode === 'SEW' || task.processNameZh?.includes('车缝')) {
    return {
      receiverKind: 'MANAGED_POST_FACTORY',
      receiverId: 'POST-FACTORY-OWN',
      receiverName: '我方后道工厂',
    }
  }

  if (task.processBusinessCode === 'CUT_PANEL' || task.processNameZh?.includes('裁片')) {
    return {
      receiverKind: 'WAREHOUSE',
      receiverId: 'WH-CUT-PIECE',
      receiverName: '裁片仓',
    }
  }

  if (task.processBusinessCode === 'POST_FINISHING' || task.processNameZh?.includes('后道')) {
    return {
      receiverKind: 'WAREHOUSE',
      receiverId: 'WH-GARMENT-HANDOFF',
      receiverName: '成衣仓交接点',
    }
  }

  return {
    receiverKind: 'WAREHOUSE',
    receiverId: 'WH-TRANSFER',
    receiverName: '中转区域',
  }
}

function savePickupRecord(record: PdaPickupRecord): void {
  if (findPickupRecord(record.recordId)) {
    const existedOverride = pickupRecordOverrides.get(record.recordId) ?? {}
    pickupRecordOverrides.set(record.recordId, { ...existedOverride, ...record })
    invalidatePdaHandoverHeadCache()
    return
  }

  const list = pickupRecordAdditions.get(record.handoverId) ?? []
  const index = list.findIndex((item) => item.recordId === record.recordId)
  if (index >= 0) {
    list[index] = clonePickupRecord(record)
  } else {
    list.push(clonePickupRecord(record))
  }
  pickupRecordAdditions.set(record.handoverId, list)
  invalidatePdaHandoverHeadCache()
}

function saveHandoutRecord(record: PdaHandoverRecord): void {
  if (record.recordId.startsWith('HOR-')) {
    const existedOverride = handoutRecordOverrides.get(record.recordId) ?? {}
    handoutRecordOverrides.set(record.recordId, { ...existedOverride, ...record })
    invalidatePdaHandoverHeadCache()
    return
  }

  const list = handoutRecordAdditions.get(record.handoverId) ?? []
  const index = list.findIndex((item) => item.recordId === record.recordId)
  if (index >= 0) {
    list[index] = cloneRecord(record)
  } else {
    list.push(cloneRecord(record))
  }
  handoutRecordAdditions.set(record.handoverId, list)
  invalidatePdaHandoverHeadCache()
}

function listLegacyHandoverEvents(): HandoverEvent[] {
  return buildHeadsInternal().map((head) => ({
    eventId: head.handoverId,
    action: head.headType,
    taskId: head.taskId,
    productionOrderId: head.productionOrderNo,
    currentProcess: head.processName,
    isFirstProcess: head.transitionFromPrev === 'NOT_APPLICABLE',
    fromPartyKind: head.headType === 'PICKUP' ? 'WAREHOUSE' : 'FACTORY',
    fromPartyName: head.sourceFactoryName,
    toPartyKind: head.targetKind,
    toPartyName: head.targetName,
    qtyExpected: head.qtyExpectedTotal,
    qtyActual: head.qtyActualTotal,
    qtyUnit: head.qtyUnit,
    qtyDiff: head.qtyDiffTotal,
    deadlineTime: head.lastRecordAt || '',
    status: head.completionStatus === 'COMPLETED' ? 'CONFIRMED' : 'PENDING',
    confirmedAt: head.completedByWarehouseAt,
    proofCount: 0,
    factoryId: head.factoryId,
    materialSummary: head.scopeLabel,
  }))
}

export function findPdaHandoverEvent(eventId: string): HandoverEvent | undefined {
  return listLegacyHandoverEvents().find((event) => event.eventId === eventId)
}

export function updatePdaHandoverEvent(
  eventId: string,
  updater: (event: HandoverEvent) => void,
): HandoverEvent | undefined {
  const found = findPdaHandoverEvent(eventId)
  if (!found) return undefined
  const next = { ...found }
  updater(next)
  return next
}

export function listPdaHandoverHeads(): PdaHandoverHead[] {
  return listHeadsSorted()
}

export function listPdaHandoverHeadsByType(type: PdaHandoverHeadType): PdaHandoverHead[] {
  return listPdaHandoverHeads().filter((head) => head.headType === type)
}

export function listPdaHandoverHeadsByFactory(factoryId: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId)
}

export function listPdaHandoverHeadsByOrder(productionOrderId: string): PdaHandoverHead[] {
  return listPdaHandoverHeads().filter((head) => head.productionOrderNo === productionOrderId)
}

export function getPdaHandoverHeadById(id: string): PdaHandoverHead | undefined {
  const found = findHead(id)
  return found ? cloneHead(found) : undefined
}

export function getPdaHeadSourceExecutionDoc(headId: string): WarehouseIssueOrder | WarehouseReturnOrder | undefined {
  const head = findHead(headId)
  if (!head?.sourceDocId) return undefined
  const doc = getWarehouseExecutionDocById(head.sourceDocId)
  if (!doc) return undefined
  if (doc.docType !== 'ISSUE' && doc.docType !== 'RETURN') return undefined
  return doc
}

export function getPdaHeadRuntimeTask(headId: string): RuntimeProcessTask | null {
  const head = findHead(headId)
  if (!head?.runtimeTaskId) return null
  return getRuntimeTaskById(head.runtimeTaskId)
}

export function getPdaPickupHeads(factoryId?: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId).filter(
    (head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN',
  )
}

export function getPdaHandoutHeads(factoryId?: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId).filter(
    (head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN',
  )
}

export function getPdaCompletedHeads(factoryId?: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId)
    .filter((head) => head.completionStatus === 'COMPLETED')
    .sort((a, b) => parseDateMs(b.completedByWarehouseAt || '') - parseDateMs(a.completedByWarehouseAt || ''))
}

export function getPdaPendingPickupHeads(factoryId?: string): PdaHandoverHead[] {
  return getPdaPickupHeads(factoryId)
}

export function getPdaPendingHandoutHeads(factoryId?: string): PdaHandoverHead[] {
  return getPdaHandoutHeads(factoryId)
}

export function getPdaHandoverSummary(): PdaHandoverSummary {
  const heads = listPdaHandoverHeads()
  return {
    totalHeads: heads.length,
    pickupPendingCount: heads.filter((head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN').length,
    handoutPendingCount: heads.filter((head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN').length,
    completedCount: heads.filter((head) => head.completionStatus === 'COMPLETED').length,
    objectionCount: heads.filter((head) => head.objectionCount > 0).length,
  }
}

export function getPdaHandoverSummaryByFactory(factoryId: string): PdaHandoverSummary {
  const heads = listPdaHandoverHeadsByFactory(factoryId)
  return {
    totalHeads: heads.length,
    pickupPendingCount: heads.filter((head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN').length,
    handoutPendingCount: heads.filter((head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN').length,
    completedCount: heads.filter((head) => head.completionStatus === 'COMPLETED').length,
    objectionCount: heads.filter((head) => head.objectionCount > 0).length,
  }
}

export function findPdaHandoutHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found && found.headType === 'HANDOUT' ? cloneHead(found) : undefined
}

export function findPdaPickupHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found && found.headType === 'PICKUP' ? cloneHead(found) : undefined
}

export function findPdaHandoverHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found ? cloneHead(found) : undefined
}

export function listPdaHandoverRecordsByHeadId(handoverId: string): PdaHandoverRecord[] {
  return getPdaHandoverRecordsByHead(handoverId)
}

export function getPdaHandoverRecordsByHead(handoverId: string): PdaHandoverRecord[] {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT') return []
  return getHandoutRecordsForHeadInternal(head)
}

export function findPdaHandoverRecord(recordId: string): PdaHandoverRecord | undefined {
  const found = findRecord(recordId)
  return found ? cloneRecord(found) : undefined
}

export function getPdaPickupRecordsByHead(handoverId: string): PdaPickupRecord[] {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP') return []
  return getPickupRecordsForHeadInternal(head)
}

export function findPdaPickupRecord(recordId: string): PdaPickupRecord | undefined {
  const found = findPickupRecord(recordId)
  return found ? clonePickupRecord(found) : undefined
}

export function listHandoverOrdersByTaskId(taskId: string): PdaHandoverHead[] {
  return listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT' && head.taskId === taskId)
}

export function getHandoverOrderById(handoverOrderId: string): PdaHandoverHead | undefined {
  return listPdaHandoverHeads().find(
    (head) => head.headType === 'HANDOUT' && (head.handoverOrderId || head.handoverId) === handoverOrderId,
  )
}

export function listReceiverWritebacks(): ReceiverWriteback[] {
  return listPdaHandoverHeads()
    .filter((head) => head.headType === 'HANDOUT')
    .flatMap((head) =>
      getPdaHandoverRecordsByHead(head.handoverId)
        .filter((record) => typeof record.receiverWrittenQty === 'number' && Boolean(record.receiverWrittenAt))
        .map<ReceiverWriteback>((record) => {
          const writtenQty = record.receiverWrittenQty ?? 0
          const submittedQty = record.submittedQty ?? record.plannedQty ?? 0
          const diffQty = writtenQty - submittedQty
          return {
            writebackId: `WB-${record.handoverRecordId || record.recordId}`,
            handoverRecordId: record.handoverRecordId || record.recordId,
            handoverOrderId: head.handoverOrderId || head.handoverId,
            receiverKind: head.receiverKind || 'WAREHOUSE',
            receiverId: head.receiverId || normalizeReceiverId(head),
            receiverName: head.receiverName || normalizeReceiverName(head),
            submittedQty,
            writtenQty,
            diffQty,
            qtyUnit: record.qtyUnit || head.qtyUnit,
            writebackResult: diffQty === 0 ? 'MATCH' : diffQty < 0 ? 'SHORT' : 'OVER',
            diffReason: record.diffReason || record.objectionReason,
            proofFiles: cloneProofFiles(record.receiverProofFiles ?? []),
            writtenBy: record.receiverWrittenBy || '接收方扫码员',
            writtenAt: record.receiverWrittenAt || '',
            isLatest: true,
          }
        }),
    )
}

export function listQuantityObjections(): QuantityObjection[] {
  return listPdaHandoverHeads()
    .filter((head) => head.headType === 'HANDOUT')
    .flatMap((head) =>
      getPdaHandoverRecordsByHead(head.handoverId)
        .filter(
          (record) =>
            record.handoverRecordStatus === 'OBJECTION_REPORTED'
            || record.handoverRecordStatus === 'OBJECTION_PROCESSING'
            || record.handoverRecordStatus === 'OBJECTION_RESOLVED',
        )
        .map<QuantityObjection>((record) => ({
          objectionId: record.quantityObjectionId || `QO-${record.recordId}`,
          objectionNo: `OBJ-${(record.quantityObjectionId || record.recordId).replace(/[^A-Za-z0-9]/g, '').slice(-12)}`,
          handoverRecordId: record.handoverRecordId || record.recordId,
          handoverOrderId: head.handoverOrderId || head.handoverId,
          sourceTaskId: record.sourceTaskId || record.taskId,
          productionOrderId: head.productionOrderNo,
          factoryId: head.factoryId,
          factoryName: head.sourceFactoryName,
          raisedByKind: 'FACTORY',
          submittedQty: record.submittedQty ?? record.plannedQty ?? 0,
          receiverWrittenQty: record.receiverWrittenQty ?? 0,
          diffQty: record.diffQty ?? 0,
          qtyUnit: record.qtyUnit || head.qtyUnit,
          objectionReason: 'OTHER',
          objectionRemark: record.objectionRemark || record.objectionReason || '',
          factoryProofFiles: cloneProofFiles(record.objectionProofFiles ?? []),
          receiverProofFiles: cloneProofFiles(record.receiverProofFiles ?? []),
          status:
            record.handoverRecordStatus === 'OBJECTION_REPORTED'
              ? 'REPORTED'
              : record.handoverRecordStatus === 'OBJECTION_PROCESSING'
                ? 'PROCESSING'
                : 'RESOLVED_PARTIAL',
          resolvedQty: record.receiverWrittenQty,
          resolvedRemark: record.resolvedRemark,
          resolvedAt: record.handoverRecordStatus === 'OBJECTION_RESOLVED' ? record.receiverWrittenAt : undefined,
          createdAt: record.factorySubmittedAt,
          createdBy: record.factorySubmittedBy || '工厂操作员',
        })),
    )
}

export function ensureHandoverOrderForStartedTask(taskId: string): {
  taskId: string
  handoverOrderId: string
  created: boolean
} {
  const existing = listHandoverOrdersByTaskId(taskId)[0]
  if (existing) {
    return {
      taskId,
      handoverOrderId: existing.handoverOrderId || existing.handoverId,
      created: false,
    }
  }

  const task = findTaskById(taskId)
  if (!task) {
    throw new Error(`未找到任务：${taskId}`)
  }
  if (!isTaskEligibleForHandover(task)) {
    throw new Error(`当前任务不进入交出链路：${taskId}`)
  }
  if (!task.startedAt) {
    throw new Error(`任务尚未开工，不能创建交出单：${taskId}`)
  }

  const receiver = resolveTaskReceiver(task)
  const handoverOrderId = `HO-${taskId.replace(/[^A-Za-z0-9]/g, '')}`
  const productionOrderNo =
    'productionOrderNo' in task && typeof task.productionOrderNo === 'string'
      ? task.productionOrderNo
      : task.productionOrderId
  const assignmentGranularityLabel = task.assignmentGranularity
    ? PROCESS_ASSIGNMENT_GRANULARITY_LABEL[task.assignmentGranularity]
    : undefined
  const createdHead = hydrateHandoverHeadDomain(
    {
      handoverId: handoverOrderId,
      handoverOrderId,
      handoverOrderNo: buildHandoverOrderNo(handoverOrderId),
      headType: 'HANDOUT',
      qrCodeValue: buildHandoverOrderQrValue(handoverOrderId),
      handoverOrderQrValue: buildHandoverOrderQrValue(handoverOrderId),
      taskId: task.taskId,
      sourceTaskId: task.taskId,
      taskNo: task.taskNo || task.taskId,
      sourceTaskNo: task.taskNo || task.taskId,
      productionOrderNo,
      processName: task.processNameZh,
      sourceFactoryName: task.assignedFactoryName || '待分配工厂',
      sourceFactoryId: task.assignedFactoryId,
      targetName: receiver.receiverName,
      targetKind: receiver.receiverKind === 'MANAGED_POST_FACTORY' ? 'FACTORY' : 'WAREHOUSE',
      receiverKind: receiver.receiverKind,
      receiverId: receiver.receiverId,
      receiverName: receiver.receiverName,
      qtyUnit: task.qtyUnit === 'METER' ? 'm' : task.qtyUnit === 'BUNDLE' ? '打' : '件',
      factoryId: task.assignedFactoryId || '',
      taskStatus: task.status === 'DONE' ? 'DONE' : 'IN_PROGRESS',
      summaryStatus: 'NONE',
      handoverOrderStatus: 'AUTO_CREATED',
      recordCount: 0,
      pendingWritebackCount: 0,
      submittedQtyTotal: 0,
      writtenBackQtyTotal: 0,
      diffQtyTotal: 0,
      objectionCount: 0,
      completionStatus: 'OPEN',
      plannedQty: task.qty,
      qtyExpectedTotal: task.qty,
      qtyActualTotal: 0,
      qtyDiffTotal: task.qty,
      runtimeTaskId: taskId,
      stageCode: task.stageCode,
      stageName: task.stageName,
      processBusinessCode: task.processBusinessCode,
      processBusinessName: task.processBusinessName,
      craftCode: task.craftCode,
      craftName: task.craftName,
      taskTypeCode: task.taskTypeMode === 'CRAFT' ? task.craftCode || task.processBusinessCode : task.processBusinessCode,
      taskTypeLabel: task.taskCategoryZh,
      assignmentGranularity: task.assignmentGranularity,
      assignmentGranularityLabel,
      isSpecialCraft: task.isSpecialCraft,
      factoryMarkedComplete: false,
      factoryMarkedCompleteAt: undefined,
    },
    [],
  )

  handoverHeadAdditions.set(handoverOrderId, createdHead)
  invalidatePdaHandoverHeadCache()
  return { taskId, handoverOrderId, created: true }
}

export function createFactoryHandoverRecord(input: {
  handoverOrderId: string
  submittedQty: number
  qtyUnit?: string
  factorySubmittedAt: string
  factorySubmittedBy: string
  factoryRemark?: string
  factoryProofFiles?: HandoverProofFile[]
  objectType?: HandoverObjectType
}): PdaHandoverRecord {
  const head = getHandoverOrderById(input.handoverOrderId)
  if (!head || head.headType !== 'HANDOUT') {
    throw new Error(`未找到交出单：${input.handoverOrderId}`)
  }

  const existing = getPdaHandoverRecordsByHead(head.handoverId)
  const sequenceNo = existing.reduce((max, record) => Math.max(max, record.sequenceNo), 0) + 1
  const handoverRecordId = `HDR-${head.handoverId.replace(/[^A-Za-z0-9]/g, '')}-${String(sequenceNo).padStart(3, '0')}`
  const created = hydrateHandoverRecordDomain(
    {
      recordId: handoverRecordId,
      handoverRecordId,
      handoverId: head.handoverId,
      handoverOrderId: head.handoverOrderId || head.handoverId,
      taskId: head.taskId,
      sourceTaskId: head.taskId,
      sequenceNo,
      objectType: input.objectType,
      handoutObjectType:
        input.objectType === 'CUT_PIECE'
          ? 'CUT_PIECE'
          : input.objectType === 'FABRIC'
            ? 'FABRIC'
            : 'GARMENT',
      submittedQty: input.submittedQty,
      plannedQty: input.submittedQty,
      qtyUnit: input.qtyUnit || head.qtyUnit,
      factorySubmittedAt: input.factorySubmittedAt,
      factorySubmittedBy: input.factorySubmittedBy,
      factorySubmittedByKind: 'FACTORY',
      factoryRemark: input.factoryRemark,
      factoryProofFiles: cloneProofFiles(input.factoryProofFiles ?? []),
      status: 'PENDING_WRITEBACK',
    },
    head,
  )

  saveHandoutRecord(created)
  return cloneRecord(created)
}

export function writeBackHandoverRecord(input: {
  handoverRecordId: string
  receiverWrittenQty: number
  receiverWrittenAt: string
  receiverWrittenBy: string
  receiverRemark?: string
  diffReason?: string
}): PdaHandoverRecord {
  const current = findRecord(input.handoverRecordId)
  if (!current) {
    throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  }
  const head = findPdaHandoverHead(current.handoverId)
  if (!head) {
    throw new Error(`未找到交出单：${current.handoverId}`)
  }

  const updated = hydrateHandoverRecordDomain(
    {
      ...current,
      receiverWrittenQty: input.receiverWrittenQty,
      receiverWrittenAt: input.receiverWrittenAt,
      receiverWrittenBy: input.receiverWrittenBy,
      receiverRemark: input.receiverRemark?.trim() || undefined,
      diffReason: input.diffReason?.trim() || undefined,
      warehouseWrittenQty: input.receiverWrittenQty,
      warehouseWrittenAt: input.receiverWrittenAt,
    },
    head,
  )
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function acceptHandoverRecordDiff(handoverRecordId: string): PdaHandoverRecord | null {
  const current = findRecord(handoverRecordId)
  if (!current || current.handoverRecordStatus !== 'WRITTEN_BACK_DIFF') {
    return null
  }
  const head = findPdaHandoverHead(current.handoverId)
  if (!head) {
    throw new Error(`未找到交出单：${current.handoverId}`)
  }

  const updated = hydrateHandoverRecordDomain(
    {
      ...current,
      status: 'WRITTEN_BACK',
      factoryDiffDecision: 'ACCEPT_DIFF',
    },
    head,
  )
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function raiseQuantityObjection(input: {
  handoverRecordId: string
  objectionReason: QuantityObjection['objectionReason']
  objectionRemark: string
  factoryProofFiles?: HandoverProofFile[]
  createdBy: string
}): QuantityObjection {
  const current = findRecord(input.handoverRecordId)
  if (!current) {
    throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  }
  if (current.handoverRecordStatus !== 'WRITTEN_BACK_DIFF') {
    throw new Error(`当前交出记录没有数量差异，不能发起异议：${input.handoverRecordId}`)
  }

  const updated = hydrateHandoverRecordDomain(
    {
      ...current,
      factorySubmittedBy: current.factorySubmittedBy || input.createdBy,
      objectionReason: input.objectionRemark,
      objectionRemark: input.objectionRemark,
      objectionProofFiles: cloneProofFiles(input.factoryProofFiles ?? []),
      quantityObjectionId: current.quantityObjectionId || `QO-${current.recordId}`,
      factoryDiffDecision: 'RAISE_OBJECTION',
      status: 'OBJECTION_REPORTED',
    },
    { handoverId: current.handoverId, handoverOrderId: current.handoverOrderId },
  )

  saveHandoutRecord(updated)
  const objection = listQuantityObjections().find((item) => item.handoverRecordId === updated.recordId)
  if (!objection) {
    throw new Error(`数量异议生成失败：${input.handoverRecordId}`)
  }

  return {
    ...objection,
    objectionReason: input.objectionReason,
    objectionRemark: input.objectionRemark,
    createdBy: input.createdBy,
  }
}

export function confirmPdaPickupRecordReceived(
  recordId: string,
  payload: {
    factoryConfirmedQty: number
    factoryConfirmedAt: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || current.status !== 'PENDING_FACTORY_CONFIRM') return undefined

  const updated: PdaPickupRecord = {
    ...current,
    qtyActual: payload.factoryConfirmedQty,
    receivedAt: payload.factoryConfirmedAt,
    factoryConfirmedQty: payload.factoryConfirmedQty,
    factoryConfirmedAt: payload.factoryConfirmedAt,
    status: 'RECEIVED',
    objectionStatus: undefined,
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function markPdaPickupRecordWarehouseHanded(
  recordId: string,
  payload: {
    warehouseHandedQty: number
    warehouseHandedAt: string
    warehouseHandedBy: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (
    !current ||
    (current.status !== 'PENDING_WAREHOUSE_DISPATCH' && current.status !== 'PENDING_FACTORY_PICKUP')
  ) {
    return undefined
  }

  const updated: PdaPickupRecord = {
    ...current,
    status: 'PENDING_FACTORY_CONFIRM',
    warehouseHandedQty: payload.warehouseHandedQty,
    warehouseHandedAt: payload.warehouseHandedAt,
    warehouseHandedBy: payload.warehouseHandedBy,
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function reportPdaPickupQtyObjection(
  recordId: string,
  payload: {
    factoryReportedQty: number
    objectionReason: string
    objectionRemark?: string
    objectionProofFiles: HandoverProofFile[]
    exceptionCaseId?: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || current.status !== 'PENDING_FACTORY_CONFIRM') return undefined

  const updated: PdaPickupRecord = {
    ...current,
    status: 'OBJECTION_REPORTED',
    factoryReportedQty: payload.factoryReportedQty,
    exceptionCaseId: payload.exceptionCaseId || current.exceptionCaseId,
    objectionReason: payload.objectionReason.trim(),
    objectionRemark: payload.objectionRemark?.trim() || undefined,
    objectionProofFiles: cloneProofFiles(payload.objectionProofFiles),
    objectionStatus: 'REPORTED',
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function processPdaPickupQtyObjection(
  recordId: string,
  payload: {
    followUpRemark?: string
    processedAt?: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || (current.status !== 'OBJECTION_REPORTED' && current.status !== 'OBJECTION_PROCESSING')) {
    return undefined
  }

  const updated: PdaPickupRecord = {
    ...current,
    status: 'OBJECTION_PROCESSING',
    objectionStatus: 'PROCESSING',
    followUpRemark: payload.followUpRemark?.trim() || current.followUpRemark,
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function resolvePdaPickupQtyObjection(
  recordId: string,
  payload: {
    finalResolvedQty: number
    finalResolvedAt: string
    resolvedRemark?: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || (current.status !== 'OBJECTION_REPORTED' && current.status !== 'OBJECTION_PROCESSING')) {
    return undefined
  }

  const updated: PdaPickupRecord = {
    ...current,
    status: 'OBJECTION_RESOLVED',
    qtyActual: payload.finalResolvedQty,
    finalResolvedQty: payload.finalResolvedQty,
    finalResolvedAt: payload.finalResolvedAt,
    resolvedRemark: payload.resolvedRemark?.trim() || undefined,
    objectionStatus: 'RESOLVED',
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function createPdaHandoverRecord(
  handoverId: string,
  payload: {
    factorySubmittedAt: string
    factoryRemark?: string
    factoryProofFiles: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT' || head.completionStatus === 'COMPLETED') return undefined
  return createFactoryHandoverRecord({
    handoverOrderId: head.handoverOrderId || handoverId,
    submittedQty: Math.max(head.qtyExpectedTotal - (head.submittedQtyTotal ?? 0), 0),
    qtyUnit: head.qtyUnit,
    factorySubmittedAt: payload.factorySubmittedAt,
    factorySubmittedBy: '工厂操作员',
    factoryRemark: payload.factoryRemark?.trim() || undefined,
    factoryProofFiles: payload.factoryProofFiles,
  })
}

export function mockWritebackPdaHandoverRecord(
  recordId: string,
  payload: {
    warehouseReturnNo: string
    warehouseWrittenQty: number
    warehouseWrittenAt: string
  },
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || current.status !== 'PENDING_WRITEBACK') return undefined
  const updated = writeBackHandoverRecord({
    handoverRecordId: recordId,
    receiverWrittenQty: payload.warehouseWrittenQty,
    receiverWrittenAt: payload.warehouseWrittenAt,
    receiverWrittenBy: '接收方扫码员',
  })
  updated.warehouseReturnNo = payload.warehouseReturnNo
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function markPdaPickupHeadCompleted(
  handoverId: string,
  completedAt: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP') return { ok: false, message: '未找到领料头' }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该领料头已完成' }

  const records = getPdaPickupRecordsByHead(handoverId)
  if (records.length === 0) return { ok: false, message: '暂无领料记录，无法发起完成' }
  if (records.some((record) => record.status !== 'RECEIVED')) {
    return { ok: false, message: '仍有未完成的领料记录，暂不可标记完成' }
  }

  headCompletionOverrides.set(handoverId, {
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: completedAt,
  })
  invalidatePdaHandoverHeadCache()

  const updated = findHead(handoverId)
  return updated
    ? { ok: true, message: '已标记领料完成', data: cloneHead(updated) }
    : { ok: true, message: '已标记领料完成' }
}

export function markPdaHandoutHeadCompleted(
  handoverId: string,
  completedAt: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT') return { ok: false, message: '未找到交出单' }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该交出单已完成' }

  const records = getPdaHandoverRecordsByHead(handoverId)
  if (records.length === 0) return { ok: false, message: '暂无交出记录，无法发起完成' }
  if (records.some((record) => record.handoverRecordStatus === 'SUBMITTED_WAIT_WRITEBACK')) {
    return { ok: false, message: '仍有待接收方回写记录，暂不可标记完成' }
  }
  if (records.some((record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING')) {
    return { ok: false, message: '仍有未处理完成的数量异议，暂不可标记完成' }
  }

  headCompletionOverrides.set(handoverId, {
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: completedAt,
  })
  invalidatePdaHandoverHeadCache()

  const updated = findHead(handoverId)
  return updated
    ? { ok: true, message: '已标记交出完成', data: cloneHead(updated) }
    : { ok: true, message: '已标记交出完成' }
}

export function reportPdaHandoverQtyObjection(
  recordId: string,
  payload: {
    objectionReason: string
    objectionRemark?: string
    objectionProofFiles?: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || current.handoverRecordStatus !== 'WRITTEN_BACK_DIFF') return undefined
  raiseQuantityObjection({
    handoverRecordId: recordId,
    objectionReason: 'OTHER',
    objectionRemark: payload.objectionRemark?.trim() || payload.objectionReason.trim(),
    factoryProofFiles: payload.objectionProofFiles,
    createdBy: current.factorySubmittedBy || '工厂操作员',
  })
  return findPdaHandoverRecord(recordId)
}

export function followupPdaHandoverObjection(
  recordId: string,
  followUpRemark: string,
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || (current.status !== 'OBJECTION_REPORTED' && current.status !== 'OBJECTION_PROCESSING')) {
    return undefined
  }

  const updated: PdaHandoverRecord = {
    ...current,
    status: 'OBJECTION_PROCESSING',
    objectionStatus: 'PROCESSING',
    followUpRemark: followUpRemark.trim() || undefined,
  }
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function resolvePdaHandoverObjection(
  recordId: string,
  resolvedRemark: string,
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || (current.status !== 'OBJECTION_REPORTED' && current.status !== 'OBJECTION_PROCESSING')) {
    return undefined
  }

  const updated: PdaHandoverRecord = {
    ...current,
    status: 'OBJECTION_RESOLVED',
    objectionStatus: 'RESOLVED',
    resolvedRemark: resolvedRemark.trim() || undefined,
  }
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}
