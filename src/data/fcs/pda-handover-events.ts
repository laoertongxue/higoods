import { initialProductionOrderIds, productionOrders } from './production-orders.ts'
import { recordRuntimeTaskExecution, runRuntimeTaskAction } from './runtime-process-tasks.ts'
import { isRuntimeTaskExecutionTask } from './runtime-process-tasks.ts'
import {
  buildWarehouseExecutionDocumentSnapshot,
  getWarehouseExecutionDocById,
  type WarehouseExecutionDoc,
  type WarehouseIssueOrder,
  type WarehouseReturnOrder,
} from './warehouse-material-execution.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { isKolGotoWholeOrderTask } from './kol-goto-special-flow.ts'
import {
  PROCESS_ASSIGNMENT_GRANULARITY_LABEL,
  getProcessDefinitionByCode,
  isExternalTaskProcess,
  isPostCapacityNode,
  type ProcessAssignmentGranularity,
} from './process-craft-dict.ts'
import type {
  RuntimeExecutorKind,
  RuntimeProcessTask,
  RuntimeTaskScopeType,
} from './runtime-process-tasks.ts'
import { readRuntimeTaskById } from './runtime-task-read-bridge.ts'
import { processTasks, resolveInitialOrderRuntimeTaskIdentity } from './process-tasks.ts'
import {
  handoverHeadAdditions,
  handoutRecordAdditions,
  handoutRecordOverrides,
  handoutRecordVersionHistory,
  installCompleteHandoutReaders,
} from './pda-handover-handout-registry.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  type ProcessWorkOrderSourceSnapshot,
  type ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import { resolveTerminalProcessOrderReceivingTarget } from './process-order-receiving-target.ts'

const getRuntimeTaskById = (taskId: string): RuntimeProcessTask | null =>
  readRuntimeTaskById<RuntimeProcessTask>(taskId)

const delayedReceiptDemoTaskIdentity = resolveInitialOrderRuntimeTaskIdentity('PO-202603-0015', 'SEW')
if (!delayedReceiptDemoTaskIdentity) {
  throw new Error('PO-202603-0015 必须且只能存在一张车缝来源任务，无法建立延迟回货交接演示事实')
}
const DELAYED_RECEIPT_DEMO_TASK_ID = delayedReceiptDemoTaskIdentity.runtimeTaskId
const DELAYED_RECEIPT_DEMO_TASK_NO = delayedReceiptDemoTaskIdentity.taskNo
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
  confirmWoolDownstreamReceipt,
  getWoolHandoverEffectiveQty,
  listWoolMobileProcessTasks,
  readWoolStore,
  type WoolHandoverRecord,
  type WoolOutputPlanLine,
  type WoolWorkOrder,
} from './wool-task-domain.ts'
import {
  getPostFinishingFullFlowOutboundOrder,
  listPostFinishingFactoryReturns,
  type PostFinishingFactoryReturnDelivery,
  listPostFinishingWaitHandoverWarehouseRecords,
  receivePostFinishingOutboundOrder,
  type PostFinishingWaitHandoverWarehouseRecord,
} from './post-finishing-full-flow.ts'
import {
  FULL_CAPABILITY_FACTORY_ID,
  FULL_CAPABILITY_FACTORY_NAME,
} from './post-finishing-current-read-model.ts'
import {
  buildHandoverOrderQrValue,
  buildHandoverRecordQrValue,
  buildTaskQrValue,
} from './task-qr.ts'
import {
  getWaterSolubleWorkOrderByTaskId,
  getWaterSolubleHandoverQtyUnit,
  linkWaterSolubleHandoverOrder,
  listWaterSolubleMobileTasks,
  resolveWaterSolubleReceiptDifference,
  submitWaterSolubleHandover,
  type WaterSolubleWorkOrder,
  writeBackWaterSolubleReceipt,
  receiveWaterSolubleHandoverBatch,
  restoreWaterSolubleOrderMutation,
  captureWaterSolubleOrderMutation,
} from './water-soluble-task-domain.ts'
import {
  validateWaterSolublePdaActor,
  type WaterSolublePdaActor,
} from './water-soluble-pda-actor.ts'
import { getPdaSession } from './store-domain-pda.ts'
import { getFactoryInternalWarehouseRegistryReference } from './factory-internal-warehouse-locations.ts'

export type HandoverAction = 'PICKUP' | 'HANDOUT'
export type HandoverStatus = 'PENDING' | 'CONFIRMED'
export type HandoverPartyKind = 'WAREHOUSE' | 'FACTORY'
export type HandoverReceiverKind = 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
export type PdaHandoverSourceType = ProcessWorkOrderSourceType
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
  | 'MATERIAL'
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

export type PdaHandoutObjectType = 'MATERIAL' | 'GARMENT' | 'CUT_PIECE' | 'FABRIC'

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
  feiTicketNo?: string
  bundleNo?: string
}

export interface PdaCuttingHandoverGapLine {
  lineId: string
  skuCode: string
  colorName: string
  sizeCode: string
  partName: string
  requiredPieceQty: number
  cumulativeSubmittedPieceQty: number
  missingPieceQty: number
  overPieceQty: number
  specialCraftRequired?: boolean
  specialCraftStatus?: string
  statusLabel: string
}

export interface PdaCuttingHandoverRecordSummary {
  previousSubmittedPieceQty: number
  currentSubmittedPieceQty: number
  cumulativeSubmittedPieceQty: number
  completeAfterSubmit: boolean
  gapPieceQtyTotal: number
  overPieceQtyTotal: number
  gapLines: PdaCuttingHandoverGapLine[]
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
    | 'SUBMITTED'
    | 'OBJECTION_RESOLVED'
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
  raisedAt?: string
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
  sourceType?: PdaHandoverSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
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
  /** Legacy list projection status; current flows use summaryStatus. */
  status?: string
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
  factoryCompletionRequired?: boolean
  factoryMarkedCompleteAt?: string
  completedByWarehouseAt?: string
  receiverClosedAt?: string
  qtyExpectedTotal: number
  qtyActualTotal: number
  qtyDiffTotal: number
  runtimeTaskId?: string
  sourceDocId?: string
  sourceDocNo?: string
  sourceBusinessType?: 'WATER_SOLUBLE_WORK_ORDER' | 'DYE_WORK_ORDER' | 'PRINT_WORK_ORDER'
  materialCode?: string
  materialName?: string
  materialSpec?: string
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
  /** Legacy projection fields retained for old locally persisted handover heads. */
  objectSummary?: string
  factoryName?: string
  deadlineAt?: string
  createdAt?: string
}

export interface PdaHandoverRecord {
  postReturnLink?: { deliveryId: string; deliveryOrderNo: string; linkedAt: string; linkedBy: string; linkedById: string }
  taskReceipts?: Array<{ receiptId: string; targetTaskOrderId: string; qty: number; receiverName: string; receivedAt: string }>
  recordId: string
  handoverRecordId?: string
  handoverRecordNo?: string
  handoverId: string
  handoverOrderId?: string
  taskId: string
  sourceTaskId?: string
  sourceType?: PdaHandoverSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  sourceWoolHandoverId?: string
  sourceWarehouseOutboundFlowId?: string
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  sequenceNo: number
  handoutObjectType?: PdaHandoutObjectType
  objectType?: HandoverObjectType
  handoutItemLabel?: string
  postFinishingRecheckOrderId?: string
  postFinishingRecheckOrderNo?: string
  postFinishingWarehouseRecordId?: string
  postFinishingSkuLineId?: string
  materialCode?: string
  materialName?: string
  materialSpec?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  garmentEquivalentQty?: number
  cutPieceLines?: PdaCutPieceHandoutLine[]
  cuttingHandoverSummary?: PdaCuttingHandoverRecordSummary
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
  // 生命周期版本时间：任何现有接收方实收回写都必须同步推进，用于按时点选择最新事实版本。
  lifecycleUpdatedAt?: string
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
  expectedTransferBagCount?: number
  receivedTransferBagCount?: number
  expectedFeiTicketCount?: number
  receivedFeiTicketCount?: number
  transferBagWritebackLines?: TransferBagWritebackLine[]
  feiTicketWritebackLines?: TransferBagFeiTicketWritebackLine[]
  writebackMode?: '按袋' | '按袋 + 菲票'
  combinedWritebackStatus?: '待收货确认' | '部分收货' | '已确认收货' | '差异' | '异议中' | '待回写' | '部分回写' | '已回写'
}

export function getPdaHandoverSourceDisplay(
  head: Pick<PdaHandoverHead, 'sourceType' | 'sourceSnapshot' | 'productionOrderId' | 'productionOrderNo' | 'stockMaterialId' | 'stockMaterialName'>,
): { label: '生产单号' | '备货物料' | '补料单'; value: string } {
  if (head.sourceType === 'STOCK') {
    return {
      label: '备货物料',
      value: [head.stockMaterialName, head.stockMaterialId].filter(Boolean).join(' / ') || '—',
    }
  }
  if (head.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    return {
      label: '补料单',
      value: head.sourceSnapshot?.supplementRecordNo || '—',
    }
  }
  return {
    label: '生产单号',
    value: head.productionOrderNo || head.productionOrderId || '—',
  }
}

export function getPdaHandoverSourceTypeLabel(
  head: Pick<PdaHandoverHead, 'sourceType'>,
): string {
  return PROCESS_WORK_ORDER_SOURCE_LABEL[head.sourceType || 'PRODUCTION_ORDER']
}

export interface TransferBagWritebackLine {
  lineId: string
  handoverRecordId: string
  transferBagId: string
  transferBagNo: string
  expectedFeiTicketCount: number
  receivedFeiTicketCount: number
  expectedQty: number
  actualQty: number
  differenceQty: number
  status: '待收货确认' | '已确认收货' | '差异' | '待回写' | '已回写'
  remark?: string
}

export interface TransferBagFeiTicketWritebackLine {
  lineId: string
  handoverRecordId: string
  transferBagId: string
  transferBagNo: string
  feiTicketNo: string
  partName: string
  colorName: string
  sizeCode: string
  expectedQty: number
  actualQty: number
  differenceQty: number
  status: '待收货确认' | '已确认收货' | '差异' | '待回写' | '已回写'
  remark?: string
}

export type PdaPickupRecordStatus =
  | 'PENDING_WAREHOUSE_DISPATCH'
  | 'PENDING_FACTORY_PICKUP'
  | 'PENDING_FACTORY_CONFIRM'
  | 'RECEIVED'
  | 'REJECTED'
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
  pickupModeLabel: '仓库配送到厂' | '工厂到仓自提' | '车缝厂送达到厂'
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
  factoryConfirmedBy?: string
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

export interface PdaHandoverStateSnapshot {
  persistedActionsRaw?: string | null
  handoverHeadAdditions: Array<[string, PdaHandoverHead]>
  pickupRecordAdditions: Array<[string, PdaPickupRecord[]]>
  handoutRecordAdditions: Array<[string, PdaHandoverRecord[]]>
  pickupRecordOverrides: Array<[string, Partial<PdaPickupRecord>]>
  handoutRecordOverrides: Array<[string, Partial<PdaHandoverRecord>]>
  handoutRecordVersionHistory: Array<[string, PdaHandoverRecord[]]>
  headCompletionOverrides: Array<[
    string,
    { completionStatus: PdaHeadCompletionStatus; completedByWarehouseAt?: string; factoryMarkedComplete?: boolean; factoryMarkedCompleteAt?: string },
  ]>
  cachedBuiltHeads: PdaHandoverHead[] | null
  cachedPostFinishingBuiltHeads: PdaHandoverHead[] | null
}

const pickupRecordAdditions = new Map<string, PdaPickupRecord[]>()
const pickupRecordOverrides = new Map<string, Partial<PdaPickupRecord>>()
const headCompletionOverrides = new Map<
  string,
  {
    completionStatus: PdaHeadCompletionStatus
    completedByWarehouseAt?: string
    factoryMarkedComplete?: boolean
    factoryMarkedCompleteAt?: string
  }
>()
let cachedBuiltHeads: PdaHandoverHead[] | null = null
let cachedPostFinishingBuiltHeads: PdaHandoverHead[] | null = null
let cachedWarehouseExecutionDocsById: Map<string, WarehouseExecutionDoc> | null = null

function invalidatePdaHandoverHeadCache(): void {
  cachedBuiltHeads = null
  cachedPostFinishingBuiltHeads = null
  cachedWarehouseExecutionDocsById = null
}

function cacheWarehouseExecutionDocuments(docs: WarehouseExecutionDoc[]): Map<string, WarehouseExecutionDoc> {
  const docsById = new Map<string, WarehouseExecutionDoc>()
  docs.forEach((doc) => {
    docsById.set(doc.id, doc)
    docsById.set(doc.docNo, doc)
  })
  cachedWarehouseExecutionDocsById = docsById
  return docsById
}

function getCachedWarehouseExecutionDocById(docId: string): WarehouseExecutionDoc | null {
  if (!cachedWarehouseExecutionDocsById) {
    const snapshot = buildWarehouseExecutionDocumentSnapshot()
    cacheWarehouseExecutionDocuments([
      ...snapshot.issueOrders,
      ...snapshot.returnOrders,
      ...snapshot.internalTransferOrders,
    ])
  }
  return cachedWarehouseExecutionDocsById?.get(docId) ?? null
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
  if (record.handoutObjectType === 'MATERIAL') return 'MATERIAL'
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

function mapRecordLifecycleStatus(record: Pick<PdaHandoverRecord, 'status' | 'objectionStatus' | 'receiverWrittenQty' | 'warehouseWrittenQty' | 'submittedQty' | 'plannedQty' | 'factoryDiffDecision' | 'taskReceipts'>): HandoverRecordLifecycleStatus {
  if (record.status === 'OBJECTION_REPORTED') return 'OBJECTION_REPORTED'
  if (record.status === 'OBJECTION_PROCESSING') return 'OBJECTION_PROCESSING'
  if (record.status === 'OBJECTION_RESOLVED') return 'OBJECTION_RESOLVED'
  if (record.factoryDiffDecision === 'ACCEPT_DIFF') return 'DIFF_ACCEPTED'
  const submittedQty = resolveSubmittedQty(record)
  const writtenQty = resolveReceiverWrittenQty(record)
  if (typeof writtenQty !== 'number') return 'SUBMITTED_WAIT_WRITEBACK'
  if (record.taskReceipts?.length && writtenQty < submittedQty && !record.factoryDiffDecision) return 'SUBMITTED_WAIT_WRITEBACK'
  if (writtenQty === submittedQty) return 'WRITTEN_BACK_MATCHED'
  return 'WRITTEN_BACK_DIFF'
}

function mapLegacyRecordStatus(status: HandoverRecordLifecycleStatus): HandoverRecordStatus {
  if (status === 'OBJECTION_REPORTED') return 'OBJECTION_REPORTED'
  if (status === 'OBJECTION_PROCESSING') return 'OBJECTION_PROCESSING'
  if (status === 'OBJECTION_RESOLVED') return 'OBJECTION_RESOLVED'
  return status === 'SUBMITTED_WAIT_WRITEBACK' ? 'PENDING_WRITEBACK' : 'WRITTEN_BACK'
}

function deriveDiffQty(record: Pick<PdaHandoverRecord, 'submittedQty' | 'plannedQty' | 'receiverWrittenQty' | 'warehouseWrittenQty' | 'taskReceipts'>): number | undefined {
  const writtenQty = resolveReceiverWrittenQty(record)
  if (typeof writtenQty !== 'number') return undefined
  if (record.taskReceipts?.length && writtenQty < resolveSubmittedQty(record)) return undefined
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
  head: Pick<PdaHandoverHead,
    'handoverId' | 'handoverOrderId' | 'sourceType' | 'sourceSnapshot' | 'productionOrderId' | 'productionOrderNo' | 'stockMaterialId' | 'stockMaterialName'
  >,
): PdaHandoverRecord {
  const handoverOrderId = head.handoverOrderId || head.handoverId
  const submittedQty = resolveSubmittedQty(record)
  const receiverWrittenQty = resolveReceiverWrittenQty(record)
  const receiverWrittenAt = resolveReceiverWrittenAt(record)
  const handoverRecordStatus = record.handoverRecordStatus === 'VOIDED'
    ? 'VOIDED'
    : mapRecordLifecycleStatus(record)
  const diffQty = deriveDiffQty(record)

  return {
    ...record,
    ...(head.sourceType === 'STOCK'
      ? {
          sourceType: 'STOCK' as const,
          sourceSnapshot: head.sourceSnapshot ? structuredClone(head.sourceSnapshot) : undefined,
          stockMaterialId: head.stockMaterialId,
          stockMaterialName: head.stockMaterialName,
          productionOrderId: undefined,
          productionOrderNo: undefined,
        }
      : head.sourceType === 'PRODUCTION_ORDER' || head.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? {
            sourceType: head.sourceType,
            sourceSnapshot: head.sourceSnapshot ? structuredClone(head.sourceSnapshot) : undefined,
            productionOrderId: head.productionOrderId,
            productionOrderNo: head.productionOrderNo,
            stockMaterialId: undefined,
            stockMaterialName: undefined,
          }
        : {}),
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
  const isKolGotoWholeOrderHead = isKolGotoWholeOrderTask({
    productionOrderId: head.productionOrderId,
    taskUnitType: head.taskTypeCode,
    processCode: head.processBusinessCode,
    processBusinessCode: head.processBusinessCode,
    assignedFactoryId: head.factoryId,
  })
  const effectiveRecords = isKolGotoWholeOrderHead
    ? records.filter((record) => record.handoverRecordStatus !== 'VOIDED')
    : records
  const submittedQtyTotal = sumBy(effectiveRecords, (record) => resolveSubmittedQty(record))
  const writtenBackQtyTotal = sumBy(effectiveRecords, (record) => resolveReceiverWrittenQty(record) ?? 0)
  const diffQtyTotal = sumBy(effectiveRecords, (record) => deriveDiffQty(record) ?? 0)
  const factoryMarkedComplete = head.factoryMarkedComplete ?? head.completionStatus === 'COMPLETED'
  const derivedHandoverOrderStatus =
    head.headType === 'HANDOUT'
      ? deriveHandoverOrderStatus(effectiveRecords, factoryMarkedComplete)
      : undefined
  const waterRecordStatuses = effectiveRecords.map((record) => record.handoverRecordStatus || mapRecordLifecycleStatus(record))
  const waterReceiverClosed = head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
    && factoryMarkedComplete
    && waterRecordStatuses.length > 0
    && waterRecordStatuses.every((status) => status === 'WRITTEN_BACK_MATCHED' || status === 'DIFF_ACCEPTED')
  const handoverOrderStatus = head.handoverOrderStatus === 'CLOSED'
    ? 'CLOSED'
    : waterReceiverClosed
      ? 'CLOSED'
      : derivedHandoverOrderStatus
  const receiverClosedAt = waterReceiverClosed
    ? head.receiverClosedAt || effectiveRecords.map(resolveReceiverWrittenAt).filter((value): value is string => Boolean(value)).sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]
    : head.receiverClosedAt

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
    factoryMarkedCompleteAt: head.factoryMarkedCompleteAt || (head.factoryCompletionRequired ? undefined : head.completedByWarehouseAt),
    receiverClosedAt,
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

function normalizeIdSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(-16) || 'UNKNOWN'
}

function buildPostFinishingHandoutHeadId(recheckOrderNo: string): string {
  return `HOH-POST-${normalizeIdSegment(recheckOrderNo)}`
}

function buildPostFinishingHandoutHeads(): PdaHandoverHead[] {
  return listPostFinishingWaitHandoverWarehouseRecords().map((record) => {
    const handoverId = buildPostFinishingHandoutHeadId(record.outboundOrderNo)
    const qtyExpectedTotal = sumBy(record.lines, (line) => line.inboundQty)
    const handedOverQty = sumBy(record.lines, (line) => line.handedOverQty)
    return {
      handoverId,
      handoverOrderId: handoverId,
      handoverOrderNo: buildHandoverOrderNo(handoverId),
      headType: 'HANDOUT',
      qrCodeValue: buildHandoverOrderQrValue(handoverId),
      handoverOrderQrValue: buildHandoverOrderQrValue(handoverId),
      taskId: record.postTaskId || record.qcTaskId,
      sourceTaskId: record.postTaskId || record.qcTaskId,
      taskNo: record.postTaskNo || record.qcTaskNo,
      sourceTaskNo: record.postTaskNo || record.qcTaskNo,
      rootTaskNo: record.deliveryOrderNo,
      productionOrderNo: record.productionOrderNo,
      processName: '后道',
      sourceFactoryName: FULL_CAPABILITY_FACTORY_NAME,
      targetName: '成衣仓交接点',
      targetKind: 'WAREHOUSE',
      receiverKind: 'WAREHOUSE',
      receiverId: 'WH-GARMENT-HANDOFF',
      receiverName: '成衣仓交接点',
      qtyUnit: record.lines[0]?.sku.qtyUnit || '件',
      factoryId: FULL_CAPABILITY_FACTORY_ID,
      taskStatus: 'DONE',
      summaryStatus: 'NONE',
      handoverOrderStatus: 'AUTO_CREATED',
      recordCount: 0,
      pendingWritebackCount: 0,
      submittedQtyTotal: handedOverQty,
      writtenBackQtyTotal: handedOverQty,
      diffQtyTotal: qtyExpectedTotal - handedOverQty,
      objectionCount: 0,
      plannedQty: qtyExpectedTotal,
      completionStatus: record.status === '已交出' ? 'COMPLETED' : 'OPEN',
      qtyExpectedTotal,
      qtyActualTotal: handedOverQty,
      qtyDiffTotal: qtyExpectedTotal - handedOverQty,
      sourceDocId: record.outboundOrderId,
      sourceDocNo: record.outboundOrderNo,
      scopeLabel: `处理后复核合格成衣 ${record.lines.length} 个 SKU`,
      executorKind: 'EXTERNAL_FACTORY',
      transitionFromPrev: 'SAME_FACTORY_CONTINUE',
      transitionToNext: 'RETURN_TO_WAREHOUSE',
      stageCode: 'POST',
      stageName: '后道阶段',
      processBusinessCode: 'POST_FINISHING',
      processBusinessName: '后道',
      taskTypeCode: 'POST_FINISHING',
      taskTypeLabel: '后道生产任务',
      assignmentGranularity: 'ORDER',
      assignmentGranularityLabel: '整单',
      isSpecialCraft: false,
    }
  })
}

function isPostFinishingGeneratedHead(head: Pick<PdaHandoverHead, 'handoverId' | 'processBusinessCode'>): boolean {
  return head.processBusinessCode === 'POST_FINISHING' && head.handoverId.startsWith('HOH-POST-')
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

function buildWoolFactHandoverHeadId(handoverId: string): string {
  return `HOH-WOOL-${normalizeIdSegment(handoverId)}`
}

function buildWoolFactHandoverRecordId(handoverId: string): string {
  return `HOR-WOOL-${normalizeIdSegment(handoverId)}`
}

function getWoolFactHandoverContext(
  handoverId: string,
): {
  order: WoolWorkOrder
  handover: WoolHandoverRecord
  output: WoolOutputPlanLine
  effectiveQty: number
  completed: boolean
} | null {
  const store = readWoolStore()
  const handover = store.handovers.find((item) => item.handoverId === handoverId)
  if (!handover) return null
  const order = store.workOrders[handover.woolOrderId]
  const output = order?.outputPlanLines.find((item) => item.outputSkuCode === handover.outputSkuCode)
  if (!order || !output) return null
  return {
    order,
    handover,
    output,
    effectiveQty: getWoolHandoverEffectiveQty(store, handover),
    completed: store.completions.some((item) => item.woolOrderId === order.woolOrderId),
  }
}

const CUTTING_WAIT_HANDOVER_RECEIVER_ALIASES = new Set([
  'CUTTING-WAIT-HANDOVER',
  'WH-CUTTING-WAIT-HANDOVER',
  'WOOL-CUTTING-WAIT-HANDOVER',
])
const DEFAULT_CUTTING_WAIT_HANDOVER_WAREHOUSE_ID = 'FIW-ID-F004-WAIT_HANDOVER'

export function resolveWoolReceiverExecutionFactoryId(
  receiverType: WoolHandoverRecord['receiverType'],
  receiverId: string,
): string | undefined {
  const normalizedReceiverId = receiverId.trim()
  if (!normalizedReceiverId) return undefined
  if (receiverType === 'DOWNSTREAM_FACTORY') return normalizedReceiverId

  const warehouseRegistry = getFactoryInternalWarehouseRegistryReference()
  const isCuttingWaitHandoverWarehouse = (warehouse: (typeof warehouseRegistry)[number]): boolean =>
    warehouse.isEnabled
    && warehouse.warehouseKind === 'WAIT_HANDOVER'
    && warehouse.factoryKind === 'CENTRAL_CUTTING'
  const exactWarehouse = warehouseRegistry.find((warehouse) =>
    isCuttingWaitHandoverWarehouse(warehouse)
    && warehouse.warehouseId === normalizedReceiverId,
  )
  if (exactWarehouse) return exactWarehouse.factoryId
  if (!CUTTING_WAIT_HANDOVER_RECEIVER_ALIASES.has(normalizedReceiverId)) return undefined
  return warehouseRegistry.find((warehouse) =>
    isCuttingWaitHandoverWarehouse(warehouse)
    && warehouse.warehouseId === DEFAULT_CUTTING_WAIT_HANDOVER_WAREHOUSE_ID,
  )?.factoryId
}

function buildWoolFactHandoverHead(
  order: WoolWorkOrder,
  handover: WoolHandoverRecord,
  output: WoolOutputPlanLine,
  effectiveQty: number,
  completed: boolean,
): PdaHandoverHead {
  const handoverId = buildWoolFactHandoverHeadId(handover.handoverId)
  const confirmed = handover.downstreamReceipt?.status === 'CONFIRMED'
  const receivedQty = confirmed ? handover.downstreamReceipt?.actualReceivedQty ?? 0 : 0
  const targetKind: HandoverPartyKind = handover.receiverType === 'DOWNSTREAM_FACTORY' ? 'FACTORY' : 'WAREHOUSE'
  return {
    handoverId,
    handoverOrderId: handoverId,
    handoverOrderNo: buildHandoverOrderNo(handoverId),
    headType: 'HANDOUT',
    qrCodeValue: buildHandoverOrderQrValue(handoverId),
    handoverOrderQrValue: buildHandoverOrderQrValue(handoverId),
    taskId: order.taskId,
    sourceTaskId: order.taskId,
    taskNo: order.taskNo,
    sourceTaskNo: order.taskNo,
    sourceType: 'PRODUCTION_ORDER',
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    processName: '毛织',
    sourceFactoryName: order.factoryName,
    sourceFactoryId: order.factoryId,
    targetName: handover.receiverName,
    targetKind,
    receiverKind: targetKind === 'FACTORY' ? 'MANAGED_POST_FACTORY' : 'WAREHOUSE',
    receiverId: handover.receiverId,
    receiverName: handover.receiverName,
    qtyUnit: output.qtyUnit,
    factoryId: resolveWoolReceiverExecutionFactoryId(handover.receiverType, handover.receiverId) || '',
    taskStatus: completed ? 'DONE' : 'IN_PROGRESS',
    summaryStatus: confirmed ? 'WRITTEN_BACK' : 'SUBMITTED',
    handoverOrderStatus: confirmed ? 'WRITTEN_BACK' : 'WAIT_RECEIVER_WRITEBACK',
    recordCount: 1,
    pendingWritebackCount: confirmed ? 0 : 1,
    submittedQtyTotal: effectiveQty,
    writtenBackQtyTotal: receivedQty,
    diffQtyTotal: confirmed ? receivedQty - effectiveQty : 0,
    objectionCount: 0,
    lastRecordAt: handover.downstreamReceipt?.receivedAt || handover.handedOverAt,
    plannedQty: effectiveQty,
    completionStatus: confirmed ? 'COMPLETED' : 'OPEN',
    completedByWarehouseAt: handover.downstreamReceipt?.receivedAt,
    receiverClosedAt: handover.downstreamReceipt?.receivedAt,
    qtyExpectedTotal: effectiveQty,
    qtyActualTotal: receivedQty,
    qtyDiffTotal: confirmed ? effectiveQty - receivedQty : effectiveQty,
    sourceDocId: handover.handoverId,
    sourceDocNo: handover.warehouseOutboundFlowId,
    materialCode: output.outputSkuCode,
    materialName: [
      output.colorName,
      output.sizeCode,
      output.woolPartName,
    ].filter(Boolean).join(' / '),
    scopeType: 'ORDER',
    scopeKey: order.woolOrderId,
    scopeLabel: `${output.outputSkuCode} / ${output.colorName} / ${output.sizeCode}${output.woolPartName ? ` / ${output.woolPartName}` : ''}`,
    executorKind: 'WAREHOUSE_WORKSHOP',
    transitionFromPrev: 'SAME_FACTORY_CONTINUE',
    transitionToNext: 'RETURN_TO_WAREHOUSE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'WOOL',
    processBusinessName: '毛织',
    taskTypeCode: order.kind === 'PART_PANEL' ? 'WOOL_PART' : 'WOOL_WHOLE',
    taskTypeLabel: order.kind === 'PART_PANEL' ? '部位毛织任务' : '整件毛织任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: false,
  }
}

function buildWoolFactHandoverRecord(
  head: PdaHandoverHead,
  order: WoolWorkOrder,
  handover: WoolHandoverRecord,
  output: WoolOutputPlanLine,
  effectiveQty: number,
): PdaHandoverRecord {
  const confirmed = handover.downstreamReceipt?.status === 'CONFIRMED'
  const actualReceivedQty = handover.downstreamReceipt?.actualReceivedQty
  const objectType: HandoverObjectType = output.outputObjectType === 'WOOL_PANEL'
    ? 'CUT_PIECE'
    : 'FINISHED_GARMENT'
  const handoutObjectType: PdaHandoutObjectType = output.outputObjectType === 'WOOL_PANEL'
    ? 'CUT_PIECE'
    : 'GARMENT'
  return hydrateHandoverRecordDomain({
    recordId: buildWoolFactHandoverRecordId(handover.handoverId),
    handoverRecordId: handover.handoverId,
    handoverRecordNo: buildHandoverRecordNo(handover.handoverId),
    handoverId: head.handoverId,
    handoverOrderId: head.handoverOrderId,
    taskId: order.taskId,
    sourceTaskId: order.taskId,
    sourceType: 'PRODUCTION_ORDER',
    sourceWoolHandoverId: handover.handoverId,
    sourceWarehouseOutboundFlowId: handover.warehouseOutboundFlowId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    sequenceNo: 1,
    handoutObjectType,
    objectType,
    handoutItemLabel: [
      output.outputSkuCode,
      output.colorName,
      output.sizeCode,
      output.woolPartName,
    ].filter(Boolean).join(' / '),
    materialCode: output.outputSkuCode,
    materialName: output.outputObjectType === 'WOOL_PANEL' ? '毛织裁片' : '毛织成衣',
    skuCode: output.outputSkuCode,
    skuColor: output.colorName,
    skuSize: output.sizeCode,
    pieceName: output.woolPartName,
    recordLines: [{
      lineId: `LINE-${buildWoolFactHandoverRecordId(handover.handoverId)}`,
      handoverRecordId: handover.handoverId,
      objectType,
      garmentSkuId: output.garmentSkuCode,
      garmentSkuCode: output.outputSkuCode,
      garmentColor: output.colorName,
      sizeCode: output.sizeCode,
      partCode: output.woolPartCode,
      partName: output.woolPartName,
      submittedQty: effectiveQty,
      receiverWrittenQty: actualReceivedQty,
      qtyUnit: output.qtyUnit,
    }],
    plannedQty: effectiveQty,
    submittedQty: effectiveQty,
    qtyUnit: output.qtyUnit,
    factorySubmittedAt: handover.handedOverAt,
    factorySubmittedBy: handover.handedOverBy,
    factorySubmittedByKind: 'FACTORY',
    factoryRemark: handover.remark,
    factoryProofFiles: [],
    status: confirmed ? 'WRITTEN_BACK' : 'PENDING_WRITEBACK',
    handoverRecordStatus: confirmed
      ? actualReceivedQty === effectiveQty ? 'WRITTEN_BACK_MATCHED' : 'WRITTEN_BACK_DIFF'
      : 'SUBMITTED_WAIT_WRITEBACK',
    lifecycleUpdatedAt: handover.downstreamReceipt?.receivedAt || handover.updatedAt,
    handoverRecordQrValue: buildHandoverRecordQrValue(handover.handoverId),
    warehouseReturnNo: handover.warehouseOutboundFlowId,
    warehouseWrittenQty: actualReceivedQty,
    warehouseWrittenAt: handover.downstreamReceipt?.receivedAt,
    receiverWrittenQty: actualReceivedQty,
    receiverWrittenAt: handover.downstreamReceipt?.receivedAt,
    receiverWrittenBy: handover.downstreamReceipt?.receivedBy,
    diffQty: confirmed ? (actualReceivedQty ?? 0) - effectiveQty : undefined,
  }, head)
}

function listWoolFactHandoverHeads(): PdaHandoverHead[] {
  const store = readWoolStore()
  return store.handovers.flatMap((handover): PdaHandoverHead[] => {
    const order = store.workOrders[handover.woolOrderId]
    const output = order?.outputPlanLines.find((item) => item.outputSkuCode === handover.outputSkuCode)
    if (!order || !output) return []
    return [buildWoolFactHandoverHead(
      order,
      handover,
      output,
      getWoolHandoverEffectiveQty(store, handover),
      store.completions.some((item) => item.woolOrderId === order.woolOrderId),
    )]
  })
}

function getWoolFactHandoverRecordForHead(head: PdaHandoverHead): PdaHandoverRecord | null {
  if (head.processBusinessCode !== 'WOOL' || !head.sourceDocId) return null
  const context = getWoolFactHandoverContext(head.sourceDocId)
  if (!context) return null
  return buildWoolFactHandoverRecord(
    head,
    context.order,
    context.handover,
    context.output,
    context.effectiveQty,
  )
}

const PDA_GENERIC_HANDOVER_HEADS = listPdaGenericHandoverHeadSeeds()
  .map((seed) => buildGenericMockHead(seed))
const PDA_GENERIC_PICKUP_RECORDS = Object.fromEntries(
  PDA_GENERIC_HANDOVER_HEADS
    .filter((head) => head.headType === 'PICKUP')
    .map(
      (head) =>
        [
          head.handoverId,
          getPdaGenericPickupRecordSeedsByHeadId(head.handoverId)
            .map((seed) => buildGenericPickupRecord(seed)),
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
          getPdaGenericHandoutRecordSeedsByHeadId(head.handoverId)
            .map((seed) => buildGenericHandoutRecord(seed)),
        ] as const,
    ),
)

const PDA_MOCK_FACTORY_ID = TEST_FACTORY_ID
const PDA_MOCK_CUTTING_FACTORY_ID = TEST_FACTORY_ID

const PDA_MOCK_HANDOVER_HEADS: PdaHandoverHead[] = [
  {
    handoverId: 'HOH-SLA-DELAY-DEMO-001',
    handoverOrderId: 'HOH-SLA-DELAY-DEMO-001',
    handoverOrderNo: 'HDO-SLA-DELAY-DEMO-001',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-SLA-DELAY-DEMO-001'),
    handoverOrderQrValue: buildHandoverOrderQrValue('HOH-SLA-DELAY-DEMO-001'),
    taskId: DELAYED_RECEIPT_DEMO_TASK_ID,
    sourceTaskId: DELAYED_RECEIPT_DEMO_TASK_ID,
    taskNo: DELAYED_RECEIPT_DEMO_TASK_NO,
    sourceTaskNo: DELAYED_RECEIPT_DEMO_TASK_NO,
    productionOrderNo: 'PO-202603-0015',
    processName: '车缝',
    sourceFactoryId: 'ID-F021',
    sourceFactoryName: 'CV Micro Sewing Jakarta Pusat',
    targetName: '成衣仓',
    targetKind: 'WAREHOUSE',
    receiverKind: 'WAREHOUSE',
    receiverId: 'WH-GARMENT-DEMO',
    receiverName: '成衣仓',
    qtyUnit: '件',
    factoryId: 'ID-F021',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'WRITTEN_BACK',
    handoverOrderStatus: 'PARTIAL_WRITTEN_BACK',
    recordCount: 1,
    pendingWritebackCount: 0,
    submittedQtyTotal: 420,
    writtenBackQtyTotal: 420,
    diffQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    plannedQty: 1400,
    qtyExpectedTotal: 1400,
    qtyActualTotal: 420,
    qtyDiffTotal: 980,
    runtimeTaskId: DELAYED_RECEIPT_DEMO_TASK_ID,
    sourceDocNo: 'SLA-DELAY-DEMO-001',
    scopeLabel: '车缝成衣交出',
    executorKind: 'EXTERNAL_FACTORY',
    transitionFromPrev: 'RETURN_TO_WAREHOUSE',
    transitionToNext: 'RETURN_TO_WAREHOUSE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processBusinessCode: 'SEW',
    processBusinessName: '车缝',
    taskTypeCode: 'SINGLE_PROCESS_TASK',
    taskTypeLabel: '单工序任务',
    assignmentGranularity: 'ORDER',
    assignmentGranularityLabel: '整单',
    isSpecialCraft: false,
    lastRecordAt: '2026-07-05 12:00:00',
  },
  {
    handoverId: 'PKH-MOCK-CUT-089',
    headType: 'PICKUP',
    qrCodeValue: '',
    taskId: 'TASK-CUT-000089',
    taskNo: 'TASK-CUT-000089',
    productionOrderNo: 'PO-20260319-013',
    processName: '裁片',
    sourceFactoryName: '一仓裁床仓',
    targetName: TEST_FACTORY_NAME,
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
    scopeLabel: '主布首批接收',
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
    handoverId: 'HOH-MOCK-CUT-093',
    headType: 'HANDOUT',
    qrCodeValue: buildHandoutHeadQrCodeValue('HOH-MOCK-CUT-093'),
    taskId: 'TASK-CUT-000093',
    taskNo: 'TASK-CUT-000093',
    productionOrderNo: 'PO-20260319-017',
    processName: '裁片',
    sourceFactoryName: TEST_FACTORY_NAME,
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
    sourceFactoryName: TEST_FACTORY_NAME,
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
    scopeLabel: '异地裁床首批接收',
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
      materialSummary: '主布 / 首批裁床接收',
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
  'HOH-SLA-DELAY-DEMO-001': [
    {
      recordId: 'SLA-DEMO-RECEIVER-DELAY-001',
      handoverRecordId: 'SLA-DEMO-RECEIVER-DELAY-001',
      handoverRecordNo: 'SLA-DEMO-RECEIVER-DELAY-001',
      handoverId: 'HOH-SLA-DELAY-DEMO-001',
      handoverOrderId: 'HOH-SLA-DELAY-DEMO-001',
      taskId: DELAYED_RECEIPT_DEMO_TASK_ID,
      sourceTaskId: DELAYED_RECEIPT_DEMO_TASK_ID,
      sequenceNo: 1,
      handoutObjectType: 'GARMENT',
      objectType: 'SEMI_FINISHED_GARMENT',
      handoutItemLabel: '首批车缝成衣',
      plannedQty: 420,
      submittedQty: 420,
      qtyUnit: '件',
      factorySubmittedAt: '2026-07-04 22:00:00',
      factorySubmittedBy: 'CV Micro Sewing Jakarta Pusat 操作员',
      factorySubmittedByKind: 'FACTORY',
      factoryProofFiles: [],
      status: 'WRITTEN_BACK',
      handoverRecordStatus: 'WRITTEN_BACK_MATCHED',
      lifecycleUpdatedAt: '2026-07-05 02:00:00',
      receiverWrittenQty: 420,
      receiverWrittenAt: '2026-07-05 02:00:00',
      receiverWrittenBy: '成衣仓收货员',
      receiverProofFiles: [],
      diffQty: 0,
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
      factoryRemark: '前片、后片首批已完成仓库收货确认',
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
      materialSpec: '罗纹领口尾批待收货确认',
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
      factoryRemark: '罗纹领口已签收但存在数量差异',
      factoryProofFiles: [],
      status: 'WRITTEN_BACK',
      warehouseReturnNo: 'RET-MOCK-CUT-093-002',
      warehouseWrittenQty: 70,
      warehouseWrittenAt: '2026-03-22 14:35:00',
      diffReason: '主厂签收数量少于工厂交出对象数量',
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
      materialName: '裁片',
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
        factoryRemark: '尾批已发出，主厂收货确认后已发起数量异议',
      factoryProofFiles: [],
      status: 'OBJECTION_REPORTED',
      warehouseReturnNo: 'RET-MOCK-CUT-103-OPEN-001',
      warehouseWrittenQty: 168,
      warehouseWrittenAt: '2026-03-24 16:40:00',
      diffReason: '主厂签收数量少于交出对象数量',
      quantityObjectionId: 'QO-HOR-MOCK-CUT103-OPEN-001',
      objectionReason: '主厂签收数量少于交出对象数量',
      objectionRemark: '工厂已发起数量异议',
      factoryDiffDecision: 'RAISE_OBJECTION',
      followUpRemark: '等待双方复核处理',
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
        status: 'REJECTED',
        qrCodeValue: buildPickupQrCodeValue('PKR-SEED-TASKGEN0003001-001'),
        warehouseHandedQty: Math.max(head.qtyExpectedTotal, 120),
        warehouseHandedAt: '2026-03-20 12:15:00',
        warehouseHandedBy: '一仓发料员',
        factoryConfirmedAt: '2026-03-20 12:28:00',
        objectionReason: '到货数量与接收内容不符',
        objectionRemark: '已驳回，等待仓库重新发料',
        followUpRemark: '工厂已驳回本次接收',
        remark: '首批已驳回，不进入待加工仓',
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
        remark: '整单已确认接收',
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
        skuColor: '浅牛仔蓝',
        skuSize: '整单',
        pieceName: '半成品包',
        plannedQty: Math.max(head.qtyExpectedTotal, 120),
        qtyUnit: head.qtyUnit || '件',
        factorySubmittedAt: '2026-03-21 10:20:00',
        factoryRemark: '已发起交出，待仓库收货确认',
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
        factoryRemark: '首批已确认收货',
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
        factoryRemark: '尾批已确认收货，存在数量差异',
        factoryProofFiles: [],
        status: 'WRITTEN_BACK',
        warehouseReturnNo: 'RET-TASKGEN0002005-002',
        warehouseWrittenQty: Math.max(head.qtyExpectedTotal - Math.max(Math.round(head.qtyExpectedTotal * 0.6), 90), 40) - 8,
        warehouseWrittenAt: '2026-03-21 12:05:00',
        diffReason: '接收方签收数量少于交出对象数量',
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

function parseStrictOperationDateTimeMs(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  if (
    !Number.isFinite(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
    || date.getSeconds() !== second
  ) return null
  return date.getTime()
}

function roundNumber(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Number(value) * 100) / 100
}

function cloneProofFiles(files: HandoverProofFile[]): HandoverProofFile[] {
  return files.map((file) => ({ ...file }))
}

function cloneCutPieceLines(lines: PdaCutPieceHandoutLine[] | undefined): PdaCutPieceHandoutLine[] | undefined {
  return lines?.map((line) => ({ ...line }))
}

function cloneHead(head: PdaHandoverHead): PdaHandoverHead {
  return structuredClone(head)
}

function clonePickupRecord(record: PdaPickupRecord): PdaPickupRecord {
  return structuredClone(record)
}

function cloneRecord(record: PdaHandoverRecord): PdaHandoverRecord {
  return structuredClone(record)
}

const FORMAL_HANDOUT_STORAGE_KEY = 'higood.formal-merged-handout-actions.v1'
const formalHandoutStateKeys = ['handoverHeadAdditions', 'pickupRecordAdditions', 'handoutRecordAdditions', 'pickupRecordOverrides', 'handoutRecordOverrides', 'handoutRecordVersionHistory', 'headCompletionOverrides'] as const
export function persistPdaHandoverState(expectedSource?: { handoverId: string; taskId: string; productionOrderId: string; sourceDocId: string; sourceBusinessType: 'DYE_WORK_ORDER' | 'WATER_SOLUBLE_WORK_ORDER' | 'PRINT_WORK_ORDER' }): void {
  if (expectedSource) {
    const head = handoverHeadAdditions.get(expectedSource.handoverId)
    if (!head || head.taskId !== expectedSource.taskId || head.productionOrderNo !== expectedSource.productionOrderId || head.sourceDocId !== expectedSource.sourceDocId || head.sourceBusinessType !== expectedSource.sourceBusinessType || !expectedSource.sourceDocId.trim()) throw new Error('交接头与原加工单来源不一致，本次未保存。')
    if (!productionOrders.some(order => order.productionOrderId === expectedSource.productionOrderId && !initialProductionOrderIds.has(order.productionOrderId))) throw new Error('该接收来源不是本次正式生产单，不写入正式交接动作存储。')
  }
  if (typeof localStorage === 'undefined') return
  const snapshot = capturePdaHandoverState()
  for (const [, head] of snapshot.handoverHeadAdditions) {
    if (head.sourceBusinessType === 'PRINT_WORK_ORDER' && !isFormalPrintHandoutHead(head)) throw new Error('原印花交接头与冻结加工单来源不一致，本次未保存。')
    if ((head.sourceBusinessType === 'DYE_WORK_ORDER' || head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' || head.sourceBusinessType === 'PRINT_WORK_ORDER')
      && productionOrders.some(order => order.productionOrderId === head.productionOrderNo && !initialProductionOrderIds.has(order.productionOrderId))
      && (!head.sourceDocId?.trim() || !head.taskId?.trim())) throw new Error('原准备工艺交接头缺少明确加工单或任务来源，未保存，请核对原单。')
  }
  const heads = snapshot.handoverHeadAdditions.filter(([, head]) => head.factoryCompletionRequired || isFormalIssuePickupHead(head) || isFormalKolHandoutHead(head) || (
    (head.sourceBusinessType === 'DYE_WORK_ORDER' || head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' || head.sourceBusinessType === 'PRINT_WORK_ORDER')
    && Boolean(head.sourceDocId?.trim() && head.taskId?.trim())
    && productionOrders.some(order => order.productionOrderId === head.productionOrderNo && !initialProductionOrderIds.has(order.productionOrderId))
  ))
  const headIds = new Set(heads.map(([id]) => id))
  const records = snapshot.handoutRecordAdditions.filter(([id]) => headIds.has(id))
  const recordIds = new Set(records.flatMap(([, rows]) => rows.map(row => row.recordId)))
  const taskIds = new Set(heads.map(([, head]) => head.taskId))
  localStorage.setItem(FORMAL_HANDOUT_STORAGE_KEY, JSON.stringify({ version: 1, handoverHeadAdditions: heads,
    pickupRecordAdditions: snapshot.pickupRecordAdditions.filter(([id]) => headIds.has(id)),
    pickupRecordOverrides: snapshot.pickupRecordOverrides.filter(([, record]) => Boolean(record.handoverId && headIds.has(record.handoverId))), handoutRecordAdditions: records,
    handoutRecordOverrides: snapshot.handoutRecordOverrides.filter(([id]) => recordIds.has(id)),
    handoutRecordVersionHistory: snapshot.handoutRecordVersionHistory.filter(([id]) => taskIds.has(id)),
    headCompletionOverrides: snapshot.headCompletionOverrides.filter(([id]) => headIds.has(id)),
  }))
}
function readFormalHandoutActions(): void {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(FORMAL_HANDOUT_STORAGE_KEY)
  if (!raw) return
  const saved = JSON.parse(raw)
  if (saved?.version !== 1 || formalHandoutStateKeys.some(key => !Array.isArray(saved[key]) || saved[key].some((row: unknown) => !Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || !row[1] || typeof row[1] !== 'object'))) throw new Error('本机合并任务交出记录损坏，未用空记录覆盖，请联系负责人。')
  for (const [, head] of saved.handoverHeadAdditions as Array<[string, PdaHandoverHead]>) {
    if (head.sourceBusinessType === 'PRINT_WORK_ORDER' && !isFormalPrintHandoutHead(head)) throw new Error('已保存的印花交接记录与冻结来源不一致，未覆盖原记录。')
  }
  const snapshot = capturePdaHandoverState()
  for (const key of formalHandoutStateKeys) {
    // 只合入原动作保存的条目，原演示种子维持其现有范围。
    ;(snapshot as unknown as Record<string, unknown>)[key] = [...new Map<string, unknown>([...(snapshot[key] as Array<[string, unknown]>), ...saved[key]]).entries()]
  }
  snapshot.cachedBuiltHeads = null; snapshot.cachedPostFinishingBuiltHeads = null
  restorePdaHandoverState(snapshot)
}
function isFormalKolHandoutHead(head: PdaHandoverHead): boolean {
  const task = processTasks.find(item => item.taskId === head.taskId && item.productionOrderId === head.productionOrderNo)
  return Boolean(head.headType === 'HANDOUT' && task && isKolGotoWholeOrderTask(task)
    && head.handoverId === `HOH-KOL-${task.taskId}` && head.factoryId === task.assignedFactoryId
    && productionOrders.some(order => order.productionOrderId === task.productionOrderId && !initialProductionOrderIds.has(order.productionOrderId)))
}

function isFormalIssuePickupHead(head: PdaHandoverHead | undefined): boolean {
  return Boolean(head?.headType === 'PICKUP' && head.sourceDocId?.startsWith('ISSUE-') && head.taskId
    && productionOrders.some(order => order.productionOrderId === head.productionOrderNo && !initialProductionOrderIds.has(order.productionOrderId)))
}

function isFormalPrintHandoutHead(head: PdaHandoverHead): boolean {
  const order = productionOrders.find(order => order.productionOrderId === head.productionOrderNo && !initialProductionOrderIds.has(order.productionOrderId))
  return Boolean(order?.processWorkOrderDefinitions?.some(definition => definition.processCode === 'PRINT' && definition.workOrderId === head.sourceDocId && definition.workOrderId === head.taskId && JSON.stringify(definition.sourceSnapshot) === JSON.stringify(head.sourceSnapshot)))
}

function runFormalHandoutAction<T>(head: PdaHandoverHead | undefined, action: () => T): T {
  if (head?.sourceBusinessType === 'PRINT_WORK_ORDER' && !isFormalPrintHandoutHead(head)) throw new Error('原印花交接头与冻结加工单来源不一致，本次未保存。')
  const formalPreparation = Boolean(head && (head.sourceBusinessType === 'DYE_WORK_ORDER' || head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' || head.sourceBusinessType === 'PRINT_WORK_ORDER')
    && productionOrders.some(order => order.productionOrderId === head.productionOrderNo && !initialProductionOrderIds.has(order.productionOrderId)))
  if (!head || (!head.factoryCompletionRequired && !formalPreparation && !isFormalIssuePickupHead(head))) return action()
  if (formalPreparation && (!head.sourceDocId?.trim() || !head.taskId?.trim())) throw new Error('原准备工艺交接头缺少明确加工单或任务来源，本次未保存。')
  const waterBefore = formalPreparation && head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' ? getWaterSolubleWorkOrderByTaskId(head.taskId) : null
  if (formalPreparation && head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER' && (!waterBefore || waterBefore.waterOrderId !== head.sourceDocId || waterBefore.productionOrderId !== head.productionOrderNo)) throw new Error('水溶交接头与原加工单来源不一致，本次未保存。')
  const waterMutationBefore = waterBefore ? captureWaterSolubleOrderMutation(waterBefore) : null
  const before = capturePdaHandoverState()
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(FORMAL_HANDOUT_STORAGE_KEY)
  try {
    return runRuntimeTaskAction(() => {
      const result = action()
      if (!handoverHeadAdditions.has(head.handoverId)) handoverHeadAdditions.set(head.handoverId, cloneHead(head))
      persistPdaHandoverState()
      return result
    })
  } catch (error) {
    if (waterMutationBefore) restoreWaterSolubleOrderMutation(waterMutationBefore.order, waterMutationBefore.persistedRaw)
    restorePdaHandoverState(before)
    if (typeof localStorage !== 'undefined' && localStorage.getItem(FORMAL_HANDOUT_STORAGE_KEY) !== raw) {
      if (raw === null) localStorage.removeItem(FORMAL_HANDOUT_STORAGE_KEY)
      else localStorage.setItem(FORMAL_HANDOUT_STORAGE_KEY, raw)
    }
    throw new Error('交出或接收未保存，原动作已撤回，请检查本机存储后重试。' + (error instanceof Error ? error.message : String(error)))
  }
}

export function capturePdaHandoverState(): PdaHandoverStateSnapshot {
  return structuredClone({
    persistedActionsRaw: typeof localStorage === 'undefined' ? null : localStorage.getItem(FORMAL_HANDOUT_STORAGE_KEY),
    handoverHeadAdditions: Array.from(handoverHeadAdditions.entries()),
    pickupRecordAdditions: Array.from(pickupRecordAdditions.entries()),
    handoutRecordAdditions: Array.from(handoutRecordAdditions.entries()),
    pickupRecordOverrides: Array.from(pickupRecordOverrides.entries()),
    handoutRecordOverrides: Array.from(handoutRecordOverrides.entries()),
    handoutRecordVersionHistory: Array.from(handoutRecordVersionHistory.entries()),
    headCompletionOverrides: Array.from(headCompletionOverrides.entries()),
    cachedBuiltHeads,
    cachedPostFinishingBuiltHeads,
  })
}

export function restorePdaHandoverState(state: PdaHandoverStateSnapshot): void {
  handoverHeadAdditions.clear()
  pickupRecordAdditions.clear()
  handoutRecordAdditions.clear()
  pickupRecordOverrides.clear()
  handoutRecordOverrides.clear()
  handoutRecordVersionHistory.clear()
  headCompletionOverrides.clear()

  const restored = structuredClone(state)
  restored.handoverHeadAdditions.forEach(([id, head]) => handoverHeadAdditions.set(id, head))
  restored.pickupRecordAdditions.forEach(([id, records]) => pickupRecordAdditions.set(id, records))
  restored.handoutRecordAdditions.forEach(([id, records]) => handoutRecordAdditions.set(id, records))
  restored.pickupRecordOverrides.forEach(([id, record]) => pickupRecordOverrides.set(id, record))
  restored.handoutRecordOverrides.forEach(([id, record]) => handoutRecordOverrides.set(id, record))
  restored.handoutRecordVersionHistory.forEach(([id, records]) => handoutRecordVersionHistory.set(id, records))
  restored.headCompletionOverrides.forEach(([id, override]) => headCompletionOverrides.set(id, override))
  cachedBuiltHeads = restored.cachedBuiltHeads
  cachedPostFinishingBuiltHeads = restored.cachedPostFinishingBuiltHeads
  cachedWarehouseExecutionDocsById = null
  if (Object.prototype.hasOwnProperty.call(restored, 'persistedActionsRaw') && typeof localStorage !== 'undefined' && localStorage.getItem(FORMAL_HANDOUT_STORAGE_KEY) !== restored.persistedActionsRaw) {
    if (restored.persistedActionsRaw == null) localStorage.removeItem(FORMAL_HANDOUT_STORAGE_KEY)
    else localStorage.setItem(FORMAL_HANDOUT_STORAGE_KEY, restored.persistedActionsRaw)
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
  const doc = getCachedWarehouseExecutionDocById(handoverId.slice('PKH-'.length))
  return doc?.docType === 'ISSUE' ? doc : undefined
}

function readReturnDocByHeadId(handoverId: string): WarehouseReturnOrder | undefined {
  if (!handoverId.startsWith('HOH-')) return undefined
  const doc = getCachedWarehouseExecutionDocById(handoverId.slice('HOH-'.length))
  return doc?.docType === 'RETURN' ? doc : undefined
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
    qtyUnit: [...new Set(doc.lines.map(line => line.unit).filter(Boolean))].length === 1 ? doc.lines[0].unit : '',
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
  const directPostReceiver = doc.usesOriginalHandoverFacts && runtimeTask?.processBusinessCode === 'SEW'
    && runtimeTask.receiverKind === 'MANAGED_POST_FACTORY' && runtimeTask.receiverId && runtimeTask.receiverName
    ? { receiverKind: runtimeTask.receiverKind, receiverId: runtimeTask.receiverId, receiverName: runtimeTask.receiverName }
    : null
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
    targetName: directPostReceiver?.receiverName ?? doc.warehouseName ?? '仓库',
    targetKind: directPostReceiver ? 'FACTORY' : 'WAREHOUSE',
    ...(doc.usesOriginalHandoverFacts && ['SEW', 'CUTTING_SEWING_IRON_PACK', 'SEWING_IRON_PACK', 'CUTTING_SEWING'].includes(runtimeTask?.processBusinessCode || '') ? { factoryCompletionRequired: true, factoryMarkedComplete: false } : {}),
    ...(directPostReceiver || (doc.usesOriginalHandoverFacts ? { receiverKind: 'WAREHOUSE' as const, receiverId: doc.warehouseId, receiverName: doc.warehouseName } : {})),
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
  | 'IRON_PACK'
  | 'QC'
  | 'FINISHING'
  | null {
  if (!processCode) return null
  const normalized = processCode.toUpperCase()
  if (normalized.includes('PRINT')) return 'PRINTING'
  if (normalized.includes('DYE') || normalized.includes('WATER_SOLUBLE')) return 'DYEING'
  if (normalized.includes('CUT')) return 'CUTTING'
  if (normalized === 'IRON_PACK' || normalized === 'PROC_IRON_PACK') return 'IRON_PACK'
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
  if (head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER') return 'MATERIAL'

  const processKey =
    resolveHandoutProcessKey(runtimeTask?.processCode) ||
    resolveHandoutProcessKey(runtimeTask?.processBusinessCode) ||
    resolveHandoutProcessKey(head.processBusinessCode) ||
    resolveHandoutProcessKey(head.taskTypeCode) ||
    resolveHandoutProcessKey(sourceDoc?.processCode)

  // 正式印花交出会在记录上写入由 BOM 类别得到的 FABRIC / MATERIAL；
  // 缺少该事实的旧记录只能降级为“物料”，不能再按工序名或“片”单位猜成裁片。
  if (processKey === 'PRINTING') return 'MATERIAL'
  if (processKey === 'CUTTING') return 'CUT_PIECE'
  if (processKey === 'DYEING') {
    // 染色并不只发生在面料：纱线、花边等 BOM 原物料也会染色。
    // 正式任务已保存技术包路线的实际对象类型；只有明确是面料时才进入面料交出视图，
    // 其余原物料统一使用 MATERIAL，避免 PDA 将公斤、米等数量误写成面料卷/面料长度。
    return runtimeTask?.outputObjectType === 'FABRIC' ? 'FABRIC' : 'MATERIAL'
  }

  const displayUnit = normalizeDisplayUnit(record?.qtyUnit || head.qtyUnit)
  if (displayUnit === '片') return 'CUT_PIECE'
  if (displayUnit === '卷' || displayUnit === 'm') return 'FABRIC'
  return 'GARMENT'
}

function getHandoutObjectTypeLabel(objectType: PdaHandoutObjectType): string {
  if (objectType === 'MATERIAL') return '物料'
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
      writtenQtyLabel: '接收方实收裁片片数（片）',
      pendingQtyLabel: '待接收方确认裁片片数（片）',
    }
  }
  if (objectType === 'MATERIAL') {
    const normalizedUnit = unit || '单位'
    return {
      primaryQtyLabel: `计划交出物料数量（${normalizedUnit}）`,
      writtenQtyLabel: `接收方实收物料数量（${normalizedUnit}）`,
      pendingQtyLabel: `待接收方确认物料数量（${normalizedUnit}）`,
    }
  }
  if (objectType === 'FABRIC') {
    const normalizedUnit = normalizeDisplayUnit(unit, '卷')
    const objectLabel = normalizedUnit === '卷' ? '面料卷数（卷）' : '面料长度（m）'
    return {
      primaryQtyLabel: `计划交出${objectLabel}`,
      writtenQtyLabel: `接收方实收${objectLabel}`,
      pendingQtyLabel: `待接收方确认${objectLabel}`,
    }
  }
  return {
    primaryQtyLabel: '计划交出成衣件数（件）',
    writtenQtyLabel: '接收方实收成衣件数（件）',
    pendingQtyLabel: '待接收方确认成衣件数（件）',
  }
}

function formatQtyValue(qty: number | undefined, unit: string): string {
  if (typeof qty !== 'number') return '待接收方确认'
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
  if (objectType === 'MATERIAL') {
    return [
      record.materialName ? `物料：${record.materialName}` : '',
      record.materialCode ? `物料编码：${record.materialCode}` : '',
      record.materialSpec ? `规格：${record.materialSpec}` : '',
    ].filter(Boolean)
  }

  return [
    record.postFinishingRecheckOrderNo ? `来源复检单：${record.postFinishingRecheckOrderNo}` : '',
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
  if (objectType === 'MATERIAL') {
    return `${record.materialName || '物料'} / ${record.materialCode || '未标编码'} / ${formatQtyValue(record.plannedQty, record.qtyUnit || '')}`
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
  const displayUnit = objectType === 'MATERIAL'
    ? (record.qtyUnit || head.qtyUnit)
    : normalizeDisplayUnit(record.qtyUnit || head.qtyUnit, objectType === 'FABRIC' ? '卷' : objectType === 'CUT_PIECE' ? '片' : '件')
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
  const displayUnit = objectType === 'MATERIAL'
    ? (records[0]?.qtyUnit || head.qtyUnit)
    : normalizeDisplayUnit(
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
    sourceDoc?.docType === 'RETURN' && sourceDoc.usesOriginalHandoverFacts
      ? head.plannedQty ?? head.qtyExpectedTotal
      : records.length > 0
      ? sumBy(records, (record) => (typeof record.plannedQty === 'number' ? record.plannedQty : 0))
      : head.qtyExpectedTotal
  const totalWrittenQty =
    records.length > 0
      ? sumBy(records, (record) => resolveReceiverWrittenQty(record) ?? 0)
      : head.writtenBackQtyTotal
  const totalPendingQty = Math.max(totalPlannedQty - totalWrittenQty, 0)
  const garmentEquivalentQtyTotal = undefined

  return {
    objectType,
    objectTypeLabel: getHandoutObjectTypeLabel(objectType),
    primaryQtyLabel: labels.primaryQtyLabel,
    writtenQtyLabel: labels.writtenQtyLabel,
    pendingQtyLabel: labels.pendingQtyLabel,
    displayUnit,
    objectInfoLines: records.length > 0
      ? records.slice(0, 3).map((record) => buildHandoutListLine(record, objectType))
      : head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
        ? [
            `物料：${head.materialName || '—'}`,
            `物料编码：${head.materialCode || '—'}`,
            head.materialSpec ? `规格：${head.materialSpec}` : '',
          ].filter(Boolean)
        : [],
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
  if (runtimeTask && isRuntimeTaskExecutionTask(runtimeTask) && (runtimeTask.mergedTaskType === 'CUTTING_SEWING_IRON_PACK' || runtimeTask.mergedTaskType === 'SEWING_IRON_PACK')) return true
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
  factoryMarkedComplete?: boolean
  factoryMarkedCompleteAt?: string
} | null {
  return headCompletionOverrides.get(handoverId) ?? null
}

function getPickupRecordsForHeadInternal(head: PdaHandoverHead): PdaPickupRecord[] {
  const mockRecords = PDA_MOCK_PICKUP_RECORDS[head.handoverId]?.map(clonePickupRecord) ?? []
  const taskBoardSeedRecords = buildTaskBoardPickupRecordSeeds(head)
  const doc = head.sourceDocId ? (getCachedWarehouseExecutionDocById(head.sourceDocId) as WarehouseIssueOrder | null) : null
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

export function matchPostReturnToHandout(head: PdaHandoverHead, record: PdaHandoverRecord, delivery: PostFinishingFactoryReturnDelivery): boolean {
  if (head.processBusinessCode !== 'SEW' || !head.factoryCompletionRequired || head.receiverKind !== 'MANAGED_POST_FACTORY'
    || delivery.executionTaskId !== head.taskId || delivery.productionOrderNo !== head.productionOrderNo
    || delivery.sewingFactoryId !== head.factoryId || delivery.status === '已废弃'
    || (head.receiverId !== 'POST-FACTORY-OWN' && head.receiverId !== delivery.managedPostFactoryId)
    || delivery.lines.some(line => line.sku.qtyUnit !== '件')
    || record.qtyUnit !== '件' || record.handoverRecordStatus === 'VOIDED') return false
  const source = record.recordLines || []
  if (!source.length || source.some(line => !line.garmentSkuCode || !line.garmentColor || !line.sizeCode || line.qtyUnit !== '件' || !Number.isInteger(line.submittedQty) || line.submittedQty <= 0)) return false
  const vector = (rows: Array<[string, string, string, number]>) => {
    const totals = new Map<string, number>()
    for (const [sku, color, size, qty] of rows) {
      if (!Number.isInteger(qty) || qty < 0) return null
      if (qty) { const key = JSON.stringify([sku, color, size]); totals.set(key, (totals.get(key) || 0) + qty) }
    }
    return JSON.stringify([...totals].sort(([a], [b]) => a.localeCompare(b)))
  }
  const left = vector(source.map(line => [line.garmentSkuCode!, line.garmentColor!, line.sizeCode!, line.submittedQty]))
  const right = vector(delivery.lines.map(line => [line.sku.skuCode, line.sku.colorName, line.sku.sizeName, line.registeredQty]))
  return left !== null && left === right && source.reduce((n, line) => n + line.submittedQty, 0) === record.submittedQty
}

function projectLinkedPostReturn(record: PdaHandoverRecord, head: PdaHandoverHead): PdaHandoverRecord {
  if (!record.postReturnLink) return record
  const delivery = listPostFinishingFactoryReturns().find(row => row.deliveryId === record.postReturnLink!.deliveryId)
  // The link stores identity only. Never reuse a copied receipt when its original source is absent or invalid.
  const base = { ...record, receiverWrittenQty: undefined, receiverWrittenAt: undefined, receiverWrittenBy: undefined,
    warehouseWrittenQty: undefined, warehouseWrittenAt: undefined, diffQty: undefined, diffReason: undefined,
    handoverRecordStatus: record.handoverRecordStatus === 'VOIDED' ? 'VOIDED' as const : 'SUBMITTED_WAIT_WRITEBACK' as const, status: 'PENDING_WRITEBACK' as const }
  if (!delivery || !matchPostReturnToHandout(head, record, delivery) || !delivery.confirmedAt || !delivery.confirmedBy
    || delivery.lines.some(line => !Number.isFinite(line.confirmedQty) || line.confirmedQty! < 0)) return base
  const qty = delivery.lines.reduce((n, line) => n + line.confirmedQty!, 0)
  return { ...base, receiverWrittenQty: qty, warehouseWrittenQty: qty, receiverWrittenAt: delivery.confirmedAt,
    warehouseWrittenAt: delivery.confirmedAt, receiverWrittenBy: delivery.confirmedBy.actorName,
    lifecycleUpdatedAt: delivery.confirmedAt, receiverRemark: `原后道实收：${delivery.deliveryOrderNo}` }
}

export function canPostFactoryReadSewHandover(head: PdaHandoverHead, factoryId: string): boolean {
  return head.processBusinessCode === 'SEW' && head.receiverKind === 'MANAGED_POST_FACTORY'
    && listPostFinishingFactoryReturns().some(delivery => delivery.executionTaskId === head.taskId
      && delivery.productionOrderNo === head.productionOrderNo && delivery.sewingFactoryId === head.factoryId
      && delivery.managedPostFactoryId === factoryId && delivery.status !== '已废弃')
}

export function listPostReturnLinkCandidates(handoverRecordId: string): PostFinishingFactoryReturnDelivery[] {
  const record = findRecord(handoverRecordId)
  if (!record || record.postReturnLink || record.receiverWrittenAt) return []
  const head = findHead(record.handoverId)
  const session = getPdaSession()
  if (!head || !session || session.roleId !== 'ROLE_ADMIN') return []
  const used = new Set([...handoutRecordAdditions.values()].flatMap(rows => rows.flatMap(row => row.postReturnLink ? [row.postReturnLink.deliveryId] : [])))
  return listPostFinishingFactoryReturns().filter(delivery => delivery.managedPostFactoryId === session.factoryId
    && !used.has(delivery.deliveryId) && matchPostReturnToHandout(head, record, delivery))
}

export function linkHandoutToPostReturn(handoverRecordId: string, deliveryId: string): PdaHandoverRecord {
  const record = findRecord(handoverRecordId)
  const head = record && findHead(record.handoverId)
  const session = getPdaSession()
  if (!record || !head || !session || !session.userName.trim()) throw new Error('请由接收后道工厂管理员登录后核对原单。')
  const candidate = listPostReturnLinkCandidates(handoverRecordId).find(row => row.deliveryId === deliveryId)
  if (!candidate) throw new Error('原任务、工厂或逐SKU登记数量不一致，或该送货单已关联；本次未保存。')
  return runFormalHandoutAction(head, () => {
    const updated = { ...record, postReturnLink: { deliveryId, deliveryOrderNo: candidate.deliveryOrderNo,
      linkedAt: new Date().toISOString(), linkedBy: session.userName, linkedById: session.userId } }
    saveHandoutRecord(updated)
    invalidatePdaHandoverHeadCache()
    return hydrateHandoverRecordDomain(projectLinkedPostReturn(updated, head), head)
  })
}

function getHandoutRecordsForHeadInternal(head: PdaHandoverHead): PdaHandoverRecord[] {
  const woolFactRecord = getWoolFactHandoverRecordForHead(head)
  if (woolFactRecord) return [cloneRecord(woolFactRecord)]
  const mockRecords = PDA_MOCK_HANDOUT_RECORDS[head.handoverId]?.map(cloneRecord) ?? []
  const taskBoardSeedRecords = buildTaskBoardHandoutRecordSeeds(head)
  const doc = head.sourceDocId ? (getCachedWarehouseExecutionDocById(head.sourceDocId) as WarehouseReturnOrder | null) : null
  const baseRecords =
    doc?.docType === 'RETURN' && doc.usesOriginalHandoverFacts ? []
    : mockRecords.length > 0
      ? mockRecords
      : taskBoardSeedRecords.length > 0
        ? taskBoardSeedRecords
      : doc && doc.docType === 'RETURN'
        ? doc.lines.map((line, index) => buildHandoutLineRecord(head, doc, line, index))
        : []

  const appended = handoutRecordAdditions.get(head.handoverId) ?? []
  const recordsById = new Map<string, PdaHandoverRecord>()
  ;[...baseRecords, ...appended].forEach((record) => recordsById.set(record.recordId, record))
  const merged = Array.from(recordsById.values()).map((record) => ({
    ...record,
    ...(handoutRecordOverrides.get(record.recordId) ?? {}),
  }))

  return merged
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map((record) => cloneRecord(hydrateHandoverRecordDomain(projectLinkedPostReturn(record, head), head)))
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

  const doc = head.sourceDocId ? (getCachedWarehouseExecutionDocById(head.sourceDocId) as WarehouseIssueOrder | null) : null
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
  if (head.factoryCompletionRequired) {
    const task = getRuntimeTaskById(head.taskId)
    if (task) head = { ...head, taskStatus: mapTaskStatus(task) }
  }
  const water = head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
    ? getWaterSolubleWorkOrderByTaskId(head.taskId)
    : undefined
  if (water && water.waterOrderId === head.sourceDocId) {
    head = { ...head, plannedQty: water.completedQty, qtyExpectedTotal: water.completedQty }
  }
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
        factoryMarkedComplete: completionOverride.factoryMarkedComplete ?? updated.factoryMarkedComplete,
        factoryMarkedCompleteAt: completionOverride.factoryMarkedCompleteAt ?? updated.factoryMarkedCompleteAt,
      },
      records,
    )
    if (!head.factoryCompletionRequired) return updated
  }

  const currentPostOutbound = head.processBusinessCode === 'POST_FINISHING'
    ? getPostFinishingFullFlowOutboundOrder(head.sourceDocNo || head.sourceDocId || '')
    : undefined
  if (currentPostOutbound?.status === '已接收入库') {
    const receivedQty = sumBy(currentPostOutbound.lines, (line) => line.receivedQty || 0)
    return hydrateHandoverHeadDomain({
      ...updated,
      completionStatus: 'COMPLETED',
      completedByWarehouseAt: currentPostOutbound.receivedAt,
      writtenBackQtyTotal: receivedQty,
      qtyActualTotal: receivedQty,
      qtyDiffTotal: head.qtyExpectedTotal - receivedQty,
      summaryStatus: 'WRITTEN_BACK',
    }, records)
  }

  const doc = head.sourceDocId ? (getCachedWarehouseExecutionDocById(head.sourceDocId) as WarehouseReturnOrder | null) : null
  const linkedPostComplete = records.length > 0 && records.every(record => record.postReturnLink && record.receiverWrittenAt)
  const autoCompleted = linkedPostComplete || Boolean(
    doc &&
      (doc.status === 'RETURNED' || doc.status === 'CLOSED') &&
      pendingCount === 0 &&
      objectionCount === 0,
  )
  updated = hydrateHandoverHeadDomain(
    {
      ...updated,
      completionStatus: autoCompleted ? 'COMPLETED' : 'OPEN',
      completedByWarehouseAt: autoCompleted ? (head.factoryCompletionRequired ? latestAt : doc?.updatedAt) : undefined,
    },
    records,
  )
  return updated
}

function recomputeHeadsInternal(): PdaHandoverHead[] {
  const warehouseSnapshot = buildWarehouseExecutionDocumentSnapshot()
  cacheWarehouseExecutionDocuments([
    ...warehouseSnapshot.issueOrders,
    ...warehouseSnapshot.returnOrders,
    ...warehouseSnapshot.internalTransferOrders,
  ])

  const pickupHeads = warehouseSnapshot.issueOrders
    .filter((doc) => doc.targetType === 'EXTERNAL_FACTORY')
    .filter((doc) => shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId)))
    .map((doc) => refreshPickupHeadSummary(buildPickupHeadFromIssue(doc)))

  const handoutHeads = warehouseSnapshot.returnOrders
    .filter((doc) => shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId)))
    .map((doc) => refreshHandoutHeadSummary(buildHandoutHeadFromReturn(doc)))

  const postFinishingHandoutHeads = buildPostFinishingHandoutHeads().map((head) => refreshHandoutHeadSummary(head))

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

  const heads = [
    ...pickupHeads,
    ...handoutHeads,
    ...postFinishingHandoutHeads,
    ...mockHeads,
    ...addedHeads,
  ]
  const headsById = new Map<string, PdaHandoverHead>()
  heads.forEach((head) => headsById.set(head.handoverId, head))
  return Array.from(headsById.values())
}

function buildNonWoolHeadsInternal(): PdaHandoverHead[] {
  if (!cachedBuiltHeads) {
    cachedBuiltHeads = recomputeHeadsInternal()
  }
  return cachedBuiltHeads.filter((head) => head.processBusinessCode !== 'WOOL').map(head =>
    (handoutRecordAdditions.get(head.handoverId) || []).some(record => record.postReturnLink) ? refreshHandoutHeadSummary(head) : head)
}

function buildHeadsInternal(): PdaHandoverHead[] {
  return [...buildNonWoolHeadsInternal(), ...listWoolFactHandoverHeads()]
}

export function canPdaFactoryAccessHandoverHead(head: PdaHandoverHead, factoryId: string): boolean {
  if (head.processBusinessCode !== 'WOOL') return head.factoryId === factoryId
  return head.factoryId === factoryId
}

function recomputePostFinishingHeadsInternal(): PdaHandoverHead[] {
  const postFinishingHandoutHeads = buildPostFinishingHandoutHeads().map((head) => refreshHandoutHeadSummary(head))
  const addedHeads = Array.from(handoverHeadAdditions.values())
    .filter((head) => head.factoryId === FULL_CAPABILITY_FACTORY_ID && head.processBusinessCode === 'POST_FINISHING')
    .map((head) => (
      head.headType === 'PICKUP'
        ? refreshPickupHeadSummary(cloneHead(head))
        : refreshHandoutHeadSummary(cloneHead(head))
    ))

  return [
    ...postFinishingHandoutHeads,
    ...addedHeads,
  ]
}

function buildPostFinishingHeadsInternal(): PdaHandoverHead[] {
  if (!cachedPostFinishingBuiltHeads) {
    cachedPostFinishingBuiltHeads = recomputePostFinishingHeadsInternal()
  }
  return cachedPostFinishingBuiltHeads
}

function listHeadsSorted(factoryId?: string): PdaHandoverHead[] {
  return buildHeadsInternal()
    .filter((head) => !factoryId || canPdaFactoryAccessHandoverHead(head, factoryId))
    .sort((a, b) => {
      const bTime = parseDateMs(b.lastRecordAt || b.completedByWarehouseAt || '')
      const aTime = parseDateMs(a.lastRecordAt || a.completedByWarehouseAt || '')
      const safeB = Number.isFinite(bTime) ? bTime : 0
      const safeA = Number.isFinite(aTime) ? aTime : 0
      return safeB - safeA
    })
    .map(cloneHead)
}

function listPostFinishingHeadsSorted(): PdaHandoverHead[] {
  return buildPostFinishingHeadsInternal()
    .slice()
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
  const nonWoolHead = buildNonWoolHeadsInternal().find((item) => item.handoverId === handoverId)
  if (nonWoolHead) return nonWoolHead
  return listWoolFactHandoverHeads().find((item) => item.handoverId === handoverId)
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
  const issueMatch = /^PKR-(ISSUE-.+)-([0-9]{3})$/.exec(recordId)
  if (issueMatch) {
    const head = buildNonWoolHeadsInternal().find(item => item.headType === 'PICKUP' && item.sourceDocId === issueMatch[1])
    return head ? getPickupRecordsForHeadInternal(head).find(item => item.recordId === recordId) : undefined
  }
  const allHeads = buildHeadsInternal().filter((item) => item.headType === 'PICKUP')
  for (const one of allHeads) {
    const found = getPickupRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
    if (found) return found
  }
  return undefined
}

function findTaskById(taskId: string): RuntimeProcessTask | PdaTaskMockProcessTaskLike | ReturnType<typeof listWoolMobileProcessTasks>[number] | ReturnType<typeof listWaterSolubleMobileTasks>[number] | null {
  return getRuntimeTaskById(taskId)
    ?? listPdaGenericProcessTasks().find((task) => task.taskId === taskId)
    ?? listWoolMobileProcessTasks().find((task) => task.taskId === taskId)
    ?? listWaterSolubleMobileTasks().find((task) => task.taskId === taskId)
    ?? null
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
  if (definition) {
    return definition.generatesExternalTask || definition.defaultDocType === 'PREPARATION_ORDER'
  }
  return isExternalTaskProcess(processCode)
}

function resolveTaskReceiver(task: {
  receiverKind?: 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
  receiverId?: string
  receiverName?: string
  processBusinessCode?: string
  processNameZh?: string
  assignedFactoryId?: string
  sourceType?: ProcessWorkOrderSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  productionOrderId?: string
  productionOrderNo?: string
  handoverTargetBlockReason?: string
}): {
  receiverKind: HandoverReceiverKind
  receiverId: string
  receiverName: string
} {
  if (task.handoverTargetBlockReason) throw new Error(task.handoverTargetBlockReason)
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

  const terminal = resolveTerminalProcessOrderReceivingTarget({
    sourceType: task.sourceType || 'PRODUCTION_ORDER',
    productionOrderNo: task.productionOrderNo || task.productionOrderId,
    supplementRecordId: task.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: task.sourceSnapshot?.supplementRecordNo,
  })
  return {
    receiverKind: 'WAREHOUSE',
    receiverId: terminal.targetBusinessId,
    receiverName: terminal.targetName,
  }
}

function savePickupRecord(record: PdaPickupRecord): void {
  return runFormalHandoutAction(findHead(record.handoverId), () => {
  if (findPickupRecord(record.recordId)) {
    const existedOverride = pickupRecordOverrides.get(record.recordId) ?? {}
    pickupRecordOverrides.set(record.recordId, { ...existedOverride, ...record })
    if (cachedBuiltHeads) cachedBuiltHeads = cachedBuiltHeads.map(head =>
      head.handoverId === record.handoverId ? refreshPickupHeadSummary(head) : head)
    return
  }

  const head = findHead(record.handoverId)
  if (head?.completionStatus === 'COMPLETED') {
    throw new Error('接收单已完成，不允许新增接收记录')
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

  })
}

function saveHandoutRecord(record: PdaHandoverRecord): void {
  const current = findRecord(record.recordId)
  const projectionVersionSignature = (item: PdaHandoverRecord): string => JSON.stringify({
    recordId: item.handoverRecordId || item.recordId,
    handoverId: item.handoverId,
    taskId: item.taskId,
    handoverRecordStatus: item.handoverRecordStatus ?? '',
    submittedQty: item.submittedQty ?? item.plannedQty ?? null,
    factorySubmittedAt: item.factorySubmittedAt,
    receiverWrittenQty: item.receiverWrittenQty ?? null,
    receiverWrittenAt: item.receiverWrittenAt ?? '',
    lifecycleUpdatedAt: item.lifecycleUpdatedAt ?? '',
  })
  if (current && projectionVersionSignature(current) !== projectionVersionSignature(record)) {
    const history = handoutRecordVersionHistory.get(current.taskId) ?? []
    history.push(cloneRecord(current))
    handoutRecordVersionHistory.set(current.taskId, history)
  }
  if (record.recordId.startsWith('HOR-')) {
    const existedOverride = handoutRecordOverrides.get(record.recordId) ?? {}
    handoutRecordOverrides.set(record.recordId, { ...existedOverride, ...record })
    invalidatePdaHandoverHeadCache()
    return
  }

  const existingRecord = current
  const head = findHead(record.handoverId)
  if (!existingRecord && head?.completionStatus === 'COMPLETED') {
    throw new Error('交出单已完成，不允许新增交出记录')
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
    productionOrderId: head.productionOrderNo || '',
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

export function getPdaPostFinishingPickupHeads(): PdaHandoverHead[] {
  return listPostFinishingHeadsSorted().filter(
    (head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN' && head.processBusinessCode === 'POST_FINISHING',
  )
}

export function getPdaPostFinishingHandoutHeads(): PdaHandoverHead[] {
  return listPostFinishingHeadsSorted().filter(
    (head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN' && head.processBusinessCode === 'POST_FINISHING',
  )
}

export function getPdaPostFinishingCompletedHeads(): PdaHandoverHead[] {
  return listPostFinishingHeadsSorted()
    .filter((head) => head.completionStatus === 'COMPLETED' && head.processBusinessCode === 'POST_FINISHING')
    .sort((a, b) => parseDateMs(b.completedByWarehouseAt || '') - parseDateMs(a.completedByWarehouseAt || ''))
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

export function getPdaHandoverHeadBusinessLabel(headType: PdaHandoverHeadType): '接收单' | '交出单' {
  return headType === 'PICKUP' ? '接收单' : '交出单'
}

export function getPdaPickupOrderDisplayNo(head: PdaHandoverHead): string {
  return head.handoverOrderNo || head.handoverOrderId || head.handoverId
}

export function getPdaHandoutOrderDisplayNo(head: PdaHandoverHead): string {
  return head.handoverOrderNo || head.handoverOrderId || head.handoverId
}

function getHeadCompletionBasisQty(head: PdaHandoverHead | undefined): number {
  if (!head) return 0
  const basisQty = head.plannedQty ?? head.qtyExpectedTotal
  return Number.isFinite(basisQty) ? Number(basisQty) : 0
}

export function getPickupHeadCompletionBasisQty(handoverId: string): number {
  return getHeadCompletionBasisQty(findPdaPickupHead(handoverId))
}

export function getHandoutHeadCompletionBasisQty(handoverId: string): number {
  return getHeadCompletionBasisQty(findPdaHandoutHead(handoverId))
}

function getPickupRecordEffectiveCompletedQty(record: PdaPickupRecord): number {
  if (record.status === 'REJECTED') return 0
  if (record.status === 'RECEIVED') return roundNumber(record.factoryConfirmedQty ?? record.qtyActual ?? record.warehouseHandedQty ?? 0)
  if (record.status === 'OBJECTION_RESOLVED') return roundNumber(record.finalResolvedQty ?? record.qtyActual ?? record.factoryReportedQty ?? 0)
  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') {
    return roundNumber(record.factoryReportedQty ?? record.qtyActual ?? 0)
  }
  return 0
}

function getHandoutRecordEffectiveCompletedQty(record: PdaHandoverRecord): number {
  if ((record.handoverRecordStatus || mapRecordLifecycleStatus(record)) === 'VOIDED') return 0
  return roundNumber(record.submittedQty ?? record.plannedQty ?? 0)
}

export function getPickupHeadEffectiveCompletedQty(handoverId: string): number {
  return roundNumber(getPdaPickupRecordsByHead(handoverId).reduce((sum, record) => sum + getPickupRecordEffectiveCompletedQty(record), 0))
}

export function getHandoutHeadEffectiveCompletedQty(handoverId: string): number {
  return roundNumber(getPdaHandoverRecordsByHead(handoverId).reduce((sum, record) => sum + getHandoutRecordEffectiveCompletedQty(record), 0))
}

function isPickupRecordStillWaiting(record: PdaPickupRecord): boolean {
  return (
    record.status === 'PENDING_WAREHOUSE_DISPATCH'
    || record.status === 'PENDING_FACTORY_PICKUP'
    || record.status === 'PENDING_FACTORY_CONFIRM'
  )
}

function validateCompletionRange(label: '接收单' | '交出单', basisQty: number, effectiveQty: number): { ok: boolean; message: string } {
  if (!Number.isFinite(basisQty) || basisQty <= 0) {
    return { ok: false, message: `缺少计划对象数量，无法完成${label}` }
  }
  if (effectiveQty < basisQty * 0.8) {
    return { ok: false, message: `累计${label === '接收单' ? '接收' : '交出'}数量未达到计划对象数量的 80%，暂不可完成${label}` }
  }
  if (effectiveQty > basisQty * 1.2) {
    return { ok: false, message: `累计${label === '接收单' ? '接收' : '交出'}数量超出计划对象数量的 20%，请先核对后再完成${label}` }
  }
  return { ok: true, message: `可完成${label}` }
}

export function canCompletePdaPickupHead(handoverId: string): { ok: boolean; message: string; basisQty: number; effectiveQty: number } {
  const head = findPdaPickupHead(handoverId)
  const basisQty = getPickupHeadCompletionBasisQty(handoverId)
  const effectiveQty = getPickupHeadEffectiveCompletedQty(handoverId)
  if (!head) return { ok: false, message: '未找到接收单', basisQty, effectiveQty }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该接收单已完成', basisQty, effectiveQty }
  const records = getPdaPickupRecordsByHead(handoverId)
  if (records.length === 0) return { ok: false, message: '暂无接收记录，无法完成接收单', basisQty, effectiveQty }
  if (records.some(isPickupRecordStillWaiting)) {
    return { ok: false, message: '仍有待确认的接收记录，暂不可完成接收单', basisQty, effectiveQty }
  }
  const rangeResult = validateCompletionRange('接收单', basisQty, effectiveQty)
  return { ...rangeResult, basisQty, effectiveQty }
}

export function canCompletePdaHandoutHead(handoverId: string): { ok: boolean; message: string; basisQty: number; effectiveQty: number } {
  const head = findPdaHandoutHead(handoverId)
  const basisQty = getHandoutHeadCompletionBasisQty(handoverId)
  const effectiveQty = getHandoutHeadEffectiveCompletedQty(handoverId)
  if (!head) return { ok: false, message: '未找到交出单', basisQty, effectiveQty }
  if (head.processBusinessCode === 'WOOL') {
    return { ok: false, message: '毛织交出由加工单事实管理，不支持完成通用交出单', basisQty, effectiveQty }
  }
  if (head.factoryCompletionRequired ? head.factoryMarkedComplete : head.completionStatus === 'COMPLETED') return { ok: false, message: '该交出单已完成', basisQty, effectiveQty }
  const records = getPdaHandoverRecordsByHead(handoverId)
  if (records.length === 0) return { ok: false, message: '暂无交出记录，无法完成交出单', basisQty, effectiveQty }
  const rangeResult = validateCompletionRange('交出单', basisQty, effectiveQty)
  return { ...rangeResult, basisQty, effectiveQty }
}

export function listHandoverOrdersByTaskId(taskId: string): PdaHandoverHead[] {
  const matches = [
    ...buildNonWoolHeadsInternal()
      .filter((head) => head.headType === 'HANDOUT' && head.taskId === taskId),
    ...listWoolFactHandoverHeads()
      .filter((head) => head.headType === 'HANDOUT' && head.taskId === taskId),
  ]
  return matches
    .slice()
    .sort((a, b) => {
      const bTime = parseDateMs(b.lastRecordAt || b.completedByWarehouseAt || '')
      const aTime = parseDateMs(a.lastRecordAt || a.completedByWarehouseAt || '')
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
    })
    .map(cloneHead)
}

const disposeCompleteHandoutReaders = installCompleteHandoutReaders(
  () => listPdaHandoverHeads(),
  (handoverId) => getPdaHandoverRecordsByHead(handoverId),
  import.meta.url,
)
import.meta.hot?.dispose(disposeCompleteHandoutReaders)

export function getHandoverOrderById(handoverOrderId: string): PdaHandoverHead | undefined {
  const matchHead = (head: PdaHandoverHead) =>
    head.headType === 'HANDOUT' && (head.handoverOrderId || head.handoverId) === handoverOrderId
  const nonWoolHead = buildNonWoolHeadsInternal().find(matchHead)
  if (nonWoolHead) return cloneHead(nonWoolHead)
  const woolHead = listWoolFactHandoverHeads().find(matchHead)
  return woolHead ? cloneHead(woolHead) : undefined
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
          productionOrderId: head.productionOrderNo || '',
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
  const waterOrder = getWaterSolubleWorkOrderByTaskId(taskId)
  const existing = listHandoverOrdersByTaskId(taskId)[0]
  if (existing) {
    if (waterOrder && waterOrder.status !== 'DONE' && (
      (waterOrder.handoverQty ?? 0) + 0.000001 < waterOrder.completedQty
      || (waterOrder.completedQty + 0.000001 < waterOrder.plannedQty && waterOrder.supervisorDecision !== 'CONTINUE_WITH_ACTUAL_QTY')
    )) {
      headCompletionOverrides.delete(existing.handoverId)
      invalidatePdaHandoverHeadCache()
    }
    if (waterOrder) {
      const linkResult = linkWaterSolubleHandoverOrder(
        waterOrder.waterOrderId,
        taskId,
        existing.handoverOrderId || existing.handoverId,
      )
      if (!linkResult.ok) throw new Error(linkResult.message)
    }
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
  if (waterOrder && waterOrder.status !== 'WAIT_HANDOVER') {
    throw new Error(`水溶加工单当前为“${waterOrder.status}”，只有待交出时才能创建交出单。`)
  }
  if (waterOrder && (!waterOrder.factoryId || waterOrder.factoryId !== task.assignedFactoryId)) {
    throw new Error('水溶加工单尚未正确派厂，不能创建交出单。')
  }
  const dyeHandoverEligible = (task as typeof task & { waterSolubleHandoverEligible?: boolean }).waterSolubleHandoverEligible
  if (!waterOrder && dyeHandoverEligible === false) {
    throw new Error('含水溶染色加工单尚未完成包装，不能创建中间交出单。')
  }
  if (!waterOrder && !isTaskEligibleForHandover(task)) {
    throw new Error(`当前任务不进入交出链路：${taskId}`)
  }
  if (!waterOrder && !task.startedAt) {
    throw new Error(`任务尚未开工，不能创建交出单：${taskId}`)
  }

  const receiver = resolveTaskReceiver(task)
  const handoverOrderId = `HO-${taskId.replace(/[^A-Za-z0-9]/g, '')}`
  const sourceType: PdaHandoverSourceType = task.sourceType || 'PRODUCTION_ORDER'
  const sourceFields = sourceType === 'STOCK'
    ? {
        sourceType,
        sourceSnapshot: task.sourceSnapshot ? structuredClone(task.sourceSnapshot) : undefined,
        stockMaterialId: task.stockMaterialId,
        stockMaterialName: task.stockMaterialName,
      }
    : {
        sourceType,
        sourceSnapshot: task.sourceSnapshot ? structuredClone(task.sourceSnapshot) : undefined,
        productionOrderId: task.productionOrderId,
        productionOrderNo: task.productionOrderNo || task.productionOrderId,
      }
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
      ...sourceFields,
      processName: waterOrder ? '水溶' : task.processNameZh,
      sourceFactoryName: task.assignedFactoryName || '待分配工厂',
      sourceFactoryId: task.assignedFactoryId,
      targetName: receiver.receiverName,
      targetKind: receiver.receiverKind === 'MANAGED_POST_FACTORY' ? 'FACTORY' : 'WAREHOUSE',
      receiverKind: receiver.receiverKind,
      receiverId: receiver.receiverId,
      receiverName: receiver.receiverName,
      qtyUnit: waterOrder
        ? getWaterSolubleHandoverQtyUnit(waterOrder.qtyUnit)
        : task.qtyDisplayUnit?.trim() || (task.qtyUnit === 'METER' ? 'm' : task.qtyUnit === 'BUNDLE' ? '打' : '件'),
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
      plannedQty: waterOrder?.completedQty || task.qty,
      qtyExpectedTotal: waterOrder?.completedQty || task.qty,
      qtyActualTotal: 0,
      qtyDiffTotal: waterOrder?.completedQty || task.qty,
      runtimeTaskId: taskId,
      stageCode: task.stageCode,
      stageName: task.stageName,
      processBusinessCode: waterOrder ? 'WATER_SOLUBLE' : task.processBusinessCode,
      processBusinessName: waterOrder ? '水溶' : task.processBusinessName,
      craftCode: task.craftCode,
      craftName: task.craftName,
      taskTypeCode: task.taskTypeMode === 'CRAFT' ? task.craftCode || task.processBusinessCode : task.processBusinessCode,
      taskTypeLabel: waterOrder ? '水溶加工单' : task.taskCategoryZh,
      assignmentGranularity: task.assignmentGranularity,
      assignmentGranularityLabel,
      isSpecialCraft: task.isSpecialCraft,
      factoryMarkedComplete: false,
      factoryMarkedCompleteAt: undefined,
      sourceDocId: waterOrder?.waterOrderId,
      sourceDocNo: waterOrder?.waterOrderNo,
      sourceBusinessType: waterOrder ? 'WATER_SOLUBLE_WORK_ORDER' : task.processBusinessCode === 'DYE' ? 'DYE_WORK_ORDER' : undefined,
      materialCode: waterOrder?.materialCode,
      materialName: waterOrder?.materialName,
      materialSpec: waterOrder?.materialSpec,
    },
    [],
  )

  if (waterOrder) {
    const linkResult = linkWaterSolubleHandoverOrder(waterOrder.waterOrderId, taskId, handoverOrderId)
    if (!linkResult.ok) throw new Error(linkResult.message)
  }
  handoverHeadAdditions.set(handoverOrderId, createdHead)
  invalidatePdaHandoverHeadCache()
  return { taskId, handoverOrderId, created: true }
}

function resolvePostFinishingLineForCreate(
  head: PdaHandoverHead,
  submittedQty: number,
): {
  warehouseRecordId: string
  outboundOrderId: string
  outboundOrderNo: string
  recheckOrderId: string
  recheckOrderNo: string
  skuLineId: string
  skuId: string
  skuCode: string
  spuName: string
  colorName: string
  sizeName: string
  qtyUnit: string
  availableHandoverGarmentQty: number
} | undefined {
  if (!isPostFinishingGeneratedHead(head)) return undefined
  const submittedBySkuLineId = new Map<string, number>()
  getPdaHandoverRecordsByHead(head.handoverId).forEach((record) => {
    if (!record.postFinishingSkuLineId) return
    submittedBySkuLineId.set(
      record.postFinishingSkuLineId,
      (submittedBySkuLineId.get(record.postFinishingSkuLineId) || 0) + (record.submittedQty || 0),
    )
  })
  const lines = listPostFinishingWaitHandoverWarehouseRecords()
    .filter((record) => record.outboundOrderNo === head.sourceDocNo || record.outboundOrderId === head.sourceDocId)
    .flatMap((record) => record.lines.map((line) => {
      const skuLineId = `${record.warehouseRecordId}:${line.sku.skuId}`
      return {
        warehouseRecordId: record.warehouseRecordId,
        outboundOrderId: record.outboundOrderId,
        outboundOrderNo: record.outboundOrderNo,
        recheckOrderId: record.recheckOrderId,
        recheckOrderNo: record.recheckOrderNo,
        skuLineId,
        skuId: line.sku.skuId,
        skuCode: line.sku.skuCode,
        spuName: line.sku.spuName,
        colorName: line.sku.colorName,
        sizeName: line.sku.sizeName,
        qtyUnit: line.sku.qtyUnit,
        availableHandoverGarmentQty: Math.max(line.availableQty - (submittedBySkuLineId.get(skuLineId) || 0), 0),
      }
    }))
  const matched = lines.find((line) => line.availableHandoverGarmentQty >= submittedQty)
  if (!matched) {
    const totalAvailable = sumBy(lines, (line) => line.availableHandoverGarmentQty)
    if (totalAvailable <= 0) throw new Error('当前复检库存已全部交出')
    throw new Error(`本次交出数量不能超过单个复检明细可交出库存，请按 SKU 分批交出；当前最大可交出 ${Math.max(...lines.map((line) => line.availableHandoverGarmentQty))}${head.qtyUnit}`)
  }
  return matched
}

export function validateWaterSolubleHandoverScan(head: PdaHandoverHead, scanCode: string): string | null {
  if (head.sourceBusinessType !== 'WATER_SOLUBLE_WORK_ORDER') return null
  const order = getWaterSolubleWorkOrderByTaskId(head.taskId)
  if (!order || order.waterOrderId !== head.sourceDocId) {
    return '水溶加工单与当前交出单不一致，不能交出。'
  }
  const normalized = scanCode.trim()
  const allowedValues = [order.taskQrValue, order.taskNo, order.waterOrderNo, order.materialCode]
    .map((value) => value.trim())
    .filter(Boolean)
  return normalized && allowedValues.includes(normalized)
    ? null
    : '扫码不匹配，请扫描当前任务码、水溶加工单号或物料码。'
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
  handoutObjectType?: PdaHandoutObjectType
  handoutItemLabel?: string
  garmentEquivalentQty?: number
  materialCode?: string
  materialName?: string
  materialSpec?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  cutPieceLines?: PdaCutPieceHandoutLine[]
  scanCode?: string
  actor?: WaterSolublePdaActor
}): PdaHandoverRecord {
  return runFormalHandoutAction(getHandoverOrderById(input.handoverOrderId), () => {
  const head = getHandoverOrderById(input.handoverOrderId)
  if (!head || head.headType !== 'HANDOUT') {
    throw new Error(`未找到交出单：${input.handoverOrderId}`)
  }
  if (head.processBusinessCode === 'WOOL') {
    throw new Error('毛织交出记录由加工单发起交出事实生成，不允许新增通用交出记录')
  }
  if (head.completionStatus === 'COMPLETED' || (head.factoryCompletionRequired && head.factoryMarkedComplete)) {
    throw new Error('交出单已完成，不允许新增交出记录')
  }
  if (!Number.isFinite(input.submittedQty) || input.submittedQty <= 0) {
    throw new Error('交出数量必须是大于 0 的有限数字')
  }
  const isWaterSolubleHead = head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
  const waterOrder = isWaterSolubleHead
    ? getWaterSolubleWorkOrderByTaskId(head.taskId)
    : null
  if (isWaterSolubleHead) {
    if (!waterOrder || waterOrder.waterOrderId !== head.sourceDocId) {
      throw new Error('水溶加工单与当前交出单不一致，不能交出。')
    }
    if (!input.actor) throw new Error('水溶交出缺少当前登录交接身份，不能操作。')
    const actorError = validateWaterSolublePdaActor(input.actor, waterOrder.factoryId, 'HANDOVER')
    if (actorError) throw new Error(actorError)
    if (!input.scanCode?.trim()) throw new Error('请扫描当前任务码、水溶加工单号或物料码。')
    const scanError = validateWaterSolubleHandoverScan(head, input.scanCode)
    if (scanError) throw new Error(scanError)
    if (waterOrder.status !== 'WAIT_HANDOVER') throw new Error('当前水溶加工单没有可交出的完成数量。')
    const availableQty = Math.max(waterOrder.completedQty - (waterOrder.handoverQty ?? 0), 0)
    if (input.submittedQty - availableQty > 0.000001) throw new Error(`本次交出不能超过剩余可交出数量 ${availableQty} ${waterOrder.qtyUnit}。`)
    if (input.qtyUnit !== undefined && input.qtyUnit.trim() !== waterOrder.qtyUnit) {
      throw new Error(`水溶交出必须使用原 BOM 单位“${waterOrder.qtyUnit}”，不能改为“${input.qtyUnit.trim() || '空单位'}”。`)
    }
  }
  const postFinishingLine = resolvePostFinishingLineForCreate(head, input.submittedQty)

  const existing = getPdaHandoverRecordsByHead(head.handoverId)
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getRuntimeTaskById(head.taskId)
  const formalGarmentReturn = sourceDoc?.docType === 'RETURN' && sourceDoc.usesOriginalHandoverFacts
    && ['SEW', 'CUTTING_SEWING_IRON_PACK', 'SEWING_IRON_PACK', 'CUTTING_SEWING'].includes(runtimeTask?.processBusinessCode || '')
  let garmentSku: NonNullable<RuntimeProcessTask['scopeSkuLines']>[number] | undefined
  if (formalGarmentReturn) {
    const code = (input.scanCode || input.skuCode || '').trim()
    const matches = (runtimeTask?.scopeSkuLines ?? []).filter(line => line.skuCode === code)
    if (matches.length !== 1) throw new Error('请扫描本任务承接的成衣 SKU 码。')
    garmentSku = matches[0]
    if (input.skuCode && input.skuCode !== garmentSku.skuCode) throw new Error('交出 SKU 与扫码不一致。')
    if (input.qtyUnit !== undefined && input.qtyUnit !== head.qtyUnit) throw new Error('交出单位与当前任务不一致。')
    const active = existing.filter(record => record.handoverRecordStatus !== 'VOIDED')
    if (active.some(record => !record.skuCode)) throw new Error('已有交出记录缺少成衣 SKU，请先联系主管核对，不能重复交出。')
    const already = sumBy(active.filter(record => record.skuCode === garmentSku!.skuCode), record => record.submittedQty ?? 0)
    if (input.submittedQty + already > garmentSku.qty + 0.000001) throw new Error('本次交出不能超过该 SKU 剩余承接数量。')
  }
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
      handoutItemLabel: input.handoutItemLabel || (postFinishingLine ? `${postFinishingLine.skuCode} / ${postFinishingLine.colorName} / ${postFinishingLine.sizeName} / ${input.submittedQty}${postFinishingLine.qtyUnit}` : undefined),
      postFinishingRecheckOrderId: postFinishingLine?.recheckOrderId,
      postFinishingRecheckOrderNo: postFinishingLine?.recheckOrderNo,
      postFinishingWarehouseRecordId: postFinishingLine?.warehouseRecordId,
      postFinishingSkuLineId: postFinishingLine?.skuLineId,
      objectType: postFinishingLine ? 'FINISHED_GARMENT' : input.objectType,
      garmentEquivalentQty: input.garmentEquivalentQty,
      materialCode: input.materialCode || waterOrder?.materialCode || postFinishingLine?.skuCode,
      materialName: input.materialName || waterOrder?.materialName || (postFinishingLine ? '后道复检合格成衣' : undefined),
      materialSpec: input.materialSpec || waterOrder?.materialSpec || (postFinishingLine ? `${postFinishingLine.spuName} / ${postFinishingLine.colorName} / ${postFinishingLine.sizeName}` : undefined),
      skuCode: garmentSku?.skuCode || input.skuCode || postFinishingLine?.skuCode,
      skuColor: garmentSku?.color || input.skuColor || postFinishingLine?.colorName,
      skuSize: garmentSku?.size || input.skuSize || postFinishingLine?.sizeName,
      pieceName: input.pieceName || (postFinishingLine ? '成衣' : undefined),
      cutPieceLines: input.cutPieceLines?.map((line) => ({ ...line })),
      handoutObjectType:
        postFinishingLine
          ? 'GARMENT'
          : waterOrder
            ? 'MATERIAL'
          : input.handoutObjectType
          ? input.handoutObjectType
          : input.objectType === 'CUT_PIECE'
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

  let updatedWaterOrder: WaterSolubleWorkOrder | undefined
  if (waterOrder) {
    const result = submitWaterSolubleHandover(waterOrder.waterOrderId, input.submittedQty)
    if (!result.ok) throw new Error(result.message)
    updatedWaterOrder = result.order
  }
  saveHandoutRecord(created)
  if (waterOrder
    && (updatedWaterOrder?.handoverQty ?? 0) + 0.000001 >= waterOrder.completedQty
    && (waterOrder.completedQty + 0.000001 >= waterOrder.plannedQty || waterOrder.supervisorDecision === 'CONTINUE_WITH_ACTUAL_QTY')
  ) {
    headCompletionOverrides.set(head.handoverId, {
      completionStatus: 'COMPLETED',
      completedByWarehouseAt: input.factorySubmittedAt,
      factoryMarkedComplete: true,
      factoryMarkedCompleteAt: input.factorySubmittedAt,
    })
    invalidatePdaHandoverHeadCache()
  }
  if (postFinishingLine) invalidatePdaHandoverHeadCache()
  return cloneRecord(created)

  })
}

export function upsertPdaHandoverHeadMock(head: PdaHandoverHead): PdaHandoverHead {
  handoverHeadAdditions.set(head.handoverId, cloneHead(head))
  if (head.completionStatus === 'COMPLETED' && head.factoryMarkedComplete) {
    headCompletionOverrides.set(head.handoverId, {
      completionStatus: 'COMPLETED',
      completedByWarehouseAt: head.completedByWarehouseAt,
      factoryMarkedComplete: true,
      factoryMarkedCompleteAt: head.factoryMarkedCompleteAt,
    })
  }
  invalidatePdaHandoverHeadCache()
  return findPdaHandoverHead(head.handoverId) ?? cloneHead(head)
}

export function upsertPdaPickupRecordMock(record: PdaPickupRecord): PdaPickupRecord {
  const exists = findPickupRecord(record.recordId)
  const head = findHead(record.handoverId)
  if (!exists && head?.completionStatus === 'COMPLETED') {
    throw new Error('接收单已完成，不允许新增接收记录')
  }
  savePickupRecord(record)
  return findPdaPickupRecord(record.recordId) ?? clonePickupRecord(record)
}

export function upsertPdaHandoutRecordMock(record: PdaHandoverRecord): PdaHandoverRecord {
  const exists = findRecord(record.recordId)
  const head = findHead(record.handoverId)
  if (!exists && head?.completionStatus === 'COMPLETED') {
    throw new Error('交出单已完成，不允许新增交出记录')
  }
  saveHandoutRecord(record)
  return findPdaHandoverRecord(record.recordId) ?? cloneRecord(record)
}

function writeBackCurrentPostFinishingOutboundIfComplete(
  head: PdaHandoverHead,
  updatedRecord: PdaHandoverRecord,
  receiverWrittenAt: string,
  receiverWrittenBy: string,
): void {
  if (head.processBusinessCode !== 'POST_FINISHING' || !updatedRecord.postFinishingWarehouseRecordId) return
  const outbound = getPostFinishingFullFlowOutboundOrder(head.sourceDocNo || head.sourceDocId || '')
  if (!outbound) throw new Error('当前后道出货单不存在，不能通过旧交出事实继续收货。')
  const candidateRecords = getPdaHandoverRecordsByHead(head.handoverId)
    .filter((record) => record.recordId !== updatedRecord.recordId)
    .concat(updatedRecord)
  const quantities = outbound.lines.map((line) => {
    const skuRecords = candidateRecords.filter((record) => record.skuCode === line.sku.skuCode)
    const submittedQty = sumBy(skuRecords, (record) => record.submittedQty || 0)
    const fullyWrittenBack = skuRecords.length > 0 && skuRecords.every((record) => typeof record.receiverWrittenQty === 'number')
    return {
      skuId: line.sku.skuId,
      expectedQty: line.outboundQty,
      submittedQty,
      receivedQty: sumBy(skuRecords, (record) => record.receiverWrittenQty || 0),
      fullyWrittenBack,
    }
  })
  if (!quantities.every((line) => line.submittedQty >= line.expectedQty && line.fullyWrittenBack)) return
  if (quantities.some((line) => line.receivedQty !== line.expectedQty)) {
    throw new Error('后道出货实收存在差异，请在当前成衣仓收货入口完成授权确认。')
  }
  receivePostFinishingOutboundOrder({
    outboundOrderNo: outbound.outboundOrderNo,
    actor: {
      actorId: 'PDA-GARMENT-WAREHOUSE',
      actorName: receiverWrittenBy,
      roleName: '成衣仓收货员',
    },
    receivedQuantities: quantities.map((line) => ({ skuId: line.skuId, receivedQty: line.receivedQty })),
    nowMs: new Date(receiverWrittenAt.replace(' ', 'T')).getTime(),
  })
}

// 准备工艺分次接收始终写原交出记录，目标加工单明确绑定，不另建库存账。
export function receivePreparationHandoverForTask(recordId: string, input: { receiptId: string; targetTaskOrderId: string; qty: number; qtyUnit: string; receiverName: string; receivedAt: string }): PdaHandoverRecord {
  const current = findRecord(recordId)
  const head = current && findPdaHandoverHead(current.handoverId)
  if (!current || !head) throw new Error('未找到上游交出记录。')
  if (current.handoverRecordStatus === 'VOIDED') throw new Error('已作废的交出记录不能接收。')
  if (!input.receiverName.trim()) throw new Error('请填写接收人。')
  const receivedAt = parseStrictOperationDateTimeMs(input.receivedAt)
  const submittedAt = parseStrictOperationDateTimeMs(current.factorySubmittedAt)
  if (receivedAt === null || (submittedAt !== null && receivedAt < submittedAt)) throw new Error('接收时间必须有效，且不能早于交出时间。')
  const task = listPdaGenericProcessTasks().find(item => item.taskId === head.taskId)
  if (head.sourceBusinessType !== 'WATER_SOLUBLE_WORK_ORDER' && head.sourceBusinessType !== 'DYE_WORK_ORDER' && task?.processBusinessCode !== 'PRINT' && task?.processBusinessCode !== 'DYE') throw new Error('仅准备工艺交出记录可按加工单接收。')
  if (!input.receiptId.trim() || !input.targetTaskOrderId.trim() || !Number.isFinite(input.qty) || input.qty <= 0) throw new Error('请填写有效接收数量及目标加工单。')
  const sourceUnit = current.qtyUnit || head.qtyUnit
  if (!sourceUnit || input.qtyUnit !== sourceUnit) throw new Error('原交出单位缺失或接收单位与交出单位不一致。')
  const repeated = current.taskReceipts?.find(item => item.receiptId === input.receiptId)
  if (repeated) {
    if (repeated.targetTaskOrderId !== input.targetTaskOrderId || repeated.qty !== input.qty) throw new Error('确认号已用于其他接收内容。')
    return cloneRecord(current)
  }
  const received = resolveReceiverWrittenQty(current) ?? 0
  if (input.qty > resolveSubmittedQty(current) - received + 0.000001) throw new Error('本次接收不能超过上游剩余可接收数量。')
  const total = received + input.qty
  if (head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER') {
    const water = getWaterSolubleWorkOrderByTaskId(head.taskId)
    const result = water && receiveWaterSolubleHandoverBatch(water.waterOrderId, current.sequenceNo, total)
    if (!result?.ok) throw new Error(result?.message || '水溶来源不存在。')
  }
  const updated = hydrateHandoverRecordDomain({ ...current, taskReceipts: [...(current.taskReceipts ?? []), { ...input }], receiverWrittenQty: total, receiverWrittenAt: input.receivedAt, receiverWrittenBy: input.receiverName, warehouseWrittenQty: total, warehouseWrittenAt: input.receivedAt, lifecycleUpdatedAt: input.receivedAt }, head)
  saveHandoutRecord(updated)
  invalidatePdaHandoverHeadCache()
  return cloneRecord(updated)
}

export function writeBackHandoverRecord(input: {
  handoverRecordId: string
  receiverWrittenQty: number
  receiverWrittenAt: string
  receiverWrittenBy: string
  receiverRemark?: string
  diffReason?: string
}): PdaHandoverRecord {
  return runFormalHandoutAction(findPdaHandoverHead(findRecord(input.handoverRecordId)?.handoverId || ''), () => {
  if (!Number.isFinite(input.receiverWrittenQty) || input.receiverWrittenQty < 0) {
    throw new Error('实收数量必须为非负有限数（大于或等于 0 的有限数字）')
  }
  const current = findRecord(input.handoverRecordId)
  if (!current) {
    throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  }
  if (current.taskReceipts?.length) throw new Error('该批已分次接收，请继续按目标加工单确认，不能重复整批收货。')
  if (current.postReturnLink) throw new Error('该记录已关联原后道回货，请在原回货确认中订正实收。')
  const receiverWrittenAtMs = parseStrictOperationDateTimeMs(input.receiverWrittenAt)
  if (receiverWrittenAtMs === null) {
    throw new Error('实收时间必须为有效的 YYYY-MM-DD HH:mm:ss')
  }
  const factorySubmittedAtMs = parseStrictOperationDateTimeMs(current.factorySubmittedAt)
  if (factorySubmittedAtMs !== null && receiverWrittenAtMs < factorySubmittedAtMs) {
    throw new Error('实收时间不能早于交出时间')
  }
  if (current.sourceWoolHandoverId) {
    const contextBeforeWrite = getWoolFactHandoverContext(current.sourceWoolHandoverId)
    const currentPdaSession = getPdaSession()
    if (!contextBeforeWrite) {
      throw new Error(`未找到毛织交出事实：${current.sourceWoolHandoverId}`)
    }
    const receiverExecutionFactoryId = resolveWoolReceiverExecutionFactoryId(
      contextBeforeWrite.handover.receiverType,
      contextBeforeWrite.handover.receiverId,
    )
    if (!receiverExecutionFactoryId) {
      throw new Error('该毛织交出接收方没有可用的 PDA 执行作用域')
    }
    if (!currentPdaSession || currentPdaSession.factoryId !== receiverExecutionFactoryId) {
      throw new Error('该毛织交出不属于当前登录工厂，不能确认接收')
    }
    const updatedSource = confirmWoolDownstreamReceipt(current.sourceWoolHandoverId, {
      commandId: `PDA-WOOL-RECEIVE-${current.sourceWoolHandoverId}`,
      actualReceivedQty: input.receiverWrittenQty,
      receivedAt: input.receiverWrittenAt,
      receivedBy: input.receiverWrittenBy,
    })
    const context = getWoolFactHandoverContext(updatedSource.handoverId)
    if (!context) {
      throw new Error(`未找到毛织交出事实：${updatedSource.handoverId}`)
    }
    const updatedHead = buildWoolFactHandoverHead(
      context.order,
      context.handover,
      context.output,
      context.effectiveQty,
      context.completed,
    )
    return cloneRecord(buildWoolFactHandoverRecord(
      updatedHead,
      context.order,
      context.handover,
      context.output,
      context.effectiveQty,
    ))
  }
  const head = findPdaHandoverHead(current.handoverId)
  if (!head) {
    throw new Error(`未找到交出单：${current.handoverId}`)
  }
  if (!Number.isFinite(input.receiverWrittenQty) || input.receiverWrittenQty < 0) {
    throw new Error('收货数量必须是大于或等于 0 的有限数字')
  }
  if (head.factoryCompletionRequired && (current.receiverWrittenAt || current.warehouseWrittenAt)) {
    if (current.receiverWrittenQty === input.receiverWrittenQty && current.receiverWrittenAt === input.receiverWrittenAt && current.receiverWrittenBy === input.receiverWrittenBy) return cloneRecord(current)
    throw new Error('该批已确认接收，不能重复收货。')
  }
  const waterOrder = head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
    ? getWaterSolubleWorkOrderByTaskId(head.taskId)
    : null
  if (waterOrder) {
    const result = writeBackWaterSolubleReceipt(waterOrder.waterOrderId, input.receiverWrittenQty)
    if (!result.ok) throw new Error(result.message)
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
      lifecycleUpdatedAt: input.receiverWrittenAt,
    },
    head,
  )
  writeBackCurrentPostFinishingOutboundIfComplete(head, updated, input.receiverWrittenAt, input.receiverWrittenBy)
  saveHandoutRecord(updated)
  invalidatePdaHandoverHeadCache()
  return cloneRecord(updated)

  })
}

export function acceptHandoverRecordDiff(handoverRecordId: string): PdaHandoverRecord | null {
  const current = findRecord(handoverRecordId)
  if (!current || current.handoverRecordStatus !== 'WRITTEN_BACK_DIFF') {
    return null
  }
  if (current.postReturnLink) throw new Error('该记录实收来自原后道回货，请在原单处理差异。')
  const head = findPdaHandoverHead(current.handoverId)
  if (!head) {
    throw new Error(`未找到交出单：${current.handoverId}`)
  }
  const waterOrder = head.sourceBusinessType === 'WATER_SOLUBLE_WORK_ORDER'
    ? getWaterSolubleWorkOrderByTaskId(head.taskId)
    : null
  if (waterOrder) {
    const result = resolveWaterSolubleReceiptDifference(waterOrder.waterOrderId)
    if (!result.ok) throw new Error(result.message)
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
  if (current.postReturnLink) throw new Error('该记录实收来自原后道回货，请在原单处理差异。')
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
    factoryConfirmedBy?: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || current.status !== 'PENDING_FACTORY_CONFIRM') return undefined
  if (isFormalIssuePickupHead(findHead(current.handoverId)) && (!payload.factoryConfirmedBy?.trim() || !Number.isFinite(payload.factoryConfirmedQty) || payload.factoryConfirmedQty < 0 || payload.factoryConfirmedQty !== current.warehouseHandedQty || !Number.isFinite(Date.parse(payload.factoryConfirmedAt)))) throw new Error('请核对实际接收人、时间及原仓库交付数量。')

  const updated: PdaPickupRecord = {
    ...current,
    qtyActual: payload.factoryConfirmedQty,
    receivedAt: payload.factoryConfirmedAt,
    factoryConfirmedQty: payload.factoryConfirmedQty,
    factoryConfirmedAt: payload.factoryConfirmedAt,
    factoryConfirmedBy: payload.factoryConfirmedBy?.trim(),
    status: 'RECEIVED',
    objectionStatus: undefined,
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function rejectPdaPickupRecord(
  recordId: string,
  payload: {
    rejectedAt: string
    rejectedBy: string
    rejectReason: string
    rejectRemark?: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || current.status !== 'PENDING_FACTORY_CONFIRM') return undefined

  const updated: PdaPickupRecord = {
    ...current,
    status: 'REJECTED',
    objectionReason: payload.rejectReason.trim(),
    objectionRemark: payload.rejectRemark?.trim() || undefined,
    followUpRemark: payload.rejectRemark?.trim() || payload.rejectReason.trim(),
    resolvedRemark: undefined,
    factoryConfirmedQty: undefined,
    factoryConfirmedAt: payload.rejectedAt,
    factoryReportedQty: undefined,
    finalResolvedQty: undefined,
    finalResolvedAt: undefined,
    objectionStatus: undefined,
    remark: payload.rejectReason.trim(),
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
    actorRole?: 'WAREHOUSE' | 'FACTORY'
    targetFactoryId?: string
  },
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (
    !current ||
    (current.status !== 'PENDING_WAREHOUSE_DISPATCH' && current.status !== 'PENDING_FACTORY_PICKUP')
  ) {
    return undefined
  }

  const head = findHead(current.handoverId)
  const doc = head?.sourceDocId ? getWarehouseExecutionDocById(head.sourceDocId) : null
  const task = head ? getRuntimeTaskById(head.taskId) : null
  const line = doc?.docType === 'ISSUE' ? doc.lines.find((_, index) => current.recordId === `PKR-${doc.id}-${String(index + 1).padStart(3, '0')}`) : null
  if (payload.actorRole !== 'WAREHOUSE' || !payload.warehouseHandedBy.trim()) throw new Error('请由仓库发料员登记实际交付')
  if (!doc || !line || !task || !isRuntimeTaskExecutionTask(task) || task.status === 'CANCELLED' || task.status === 'DONE') throw new Error('原发料单或承接任务已失效')
  if (!payload.targetFactoryId || payload.targetFactoryId !== doc.targetFactoryId || task.assignedFactoryId !== doc.targetFactoryId) throw new Error('接收工厂已变化，请重新核对')
  const qty = Math.round(payload.warehouseHandedQty * 100) / 100
  if (!Number.isFinite(qty) || qty <= 0 || qty > line.preparedQty || qty > current.qtyExpected || !line.unit || current.qtyUnit !== line.unit) throw new Error('实际交付数量必须大于0且不能超过已确认配料，请核对数量和单位')
  if (!payload.warehouseHandedAt.trim() || !Number.isFinite(Date.parse(payload.warehouseHandedAt))) throw new Error('请填写有效交付时间')
  const updated: PdaPickupRecord = {
    ...current,
    status: 'PENDING_FACTORY_CONFIRM',
    warehouseHandedQty: qty,
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
  if (!head || head.headType !== 'HANDOUT') return undefined
  if (head.completionStatus === 'COMPLETED') {
    throw new Error('交出单已完成，不允许新增交出记录')
  }
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
  try { return runFormalHandoutAction(findHead(handoverId), () => {
  const validation = canCompletePdaPickupHead(handoverId)
  if (!validation.ok) return { ok: false, message: validation.message }

  headCompletionOverrides.set(handoverId, {
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: completedAt,
  })
  invalidatePdaHandoverHeadCache()

  const updated = findHead(handoverId)
  return updated
    ? { ok: true, message: '已完成接收单', data: cloneHead(updated) }
    : { ok: true, message: '已完成接收单' }

  }) } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '接收单未保存，请重试。' } }
}

export function markPdaHandoutHeadCompleted(
  handoverId: string,
  completedAt: string,
  completedBy?: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  try { return runFormalHandoutAction(findPdaHandoutHead(handoverId), () => {
  const validation = canCompletePdaHandoutHead(handoverId)
  if (!validation.ok) return { ok: false, message: validation.message }

  const head = findPdaHandoutHead(handoverId)!
  if (head.factoryCompletionRequired) {
    const task = getRuntimeTaskById(head.taskId)
    if (!task || task.status !== 'IN_PROGRESS') return { ok: false, message: '当前加工任务不在生产中，不能结束。' }
    if (!completedBy?.trim() || !Number.isFinite(parseDateMs(completedAt))) return { ok: false, message: '请核对当前操作人和结束时间。' }
    recordRuntimeTaskExecution(task.taskId, { status: 'DONE', finishedAt: completedAt, updatedAt: completedAt,
      auditLogs: [...task.auditLogs, { id: `AL-FACTORY-FINISH-${handoverId}-${completedAt}`, action: 'FACTORY_FINISH_HANDOUT', detail: '工厂确认加工完成并结束交出，接收方实收仍读取原交接记录。', at: completedAt, by: completedBy.trim() }] })
    headCompletionOverrides.set(handoverId, {
      completionStatus: head.completionStatus,
      completedByWarehouseAt: head.completedByWarehouseAt,
      factoryMarkedComplete: true,
      factoryMarkedCompleteAt: completedAt,
    })
  } else {
    headCompletionOverrides.set(handoverId, {
      completionStatus: 'COMPLETED',
      completedByWarehouseAt: completedAt,
    })
  }
  invalidatePdaHandoverHeadCache()

  const updated = findHead(handoverId)
  return updated
    ? { ok: true, message: '已完成交出单', data: cloneHead(updated) }
    : { ok: true, message: '已完成交出单' }

  }) } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '结束未保存，请重试' } }
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

// 只读原交付覆盖记录，不重建单头，也不产生第二份发料账。
export function getOriginalPickupWarehouseHandedQty(recordId: string): number {
  return pickupRecordOverrides.get(recordId)?.warehouseHandedQty ?? 0
}

export function syncPdaPickupHeadForMaterialRequest(materialRequestNo: string): void {
  if (!cachedBuiltHeads) return
  const doc = getWarehouseExecutionDocById(`ISSUE-${materialRequestNo}`)
  if (!doc || doc.docType !== 'ISSUE' || !shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId))) return
  const head = refreshPickupHeadSummary(buildPickupHeadFromIssue(doc))
  cachedBuiltHeads = [...cachedBuiltHeads.filter(item => item.handoverId !== head.handoverId), head]
}

// Read only the original explicit handout records; do not rebuild heads or return documents here.
export function getOriginalHandoutQuantities(handoverId: string, unit: string): { submittedQty: number; receivedQty: number } {
  let submittedQty = 0
  let receivedQty = 0
  for (const stored of handoutRecordAdditions.get(handoverId) ?? []) {
    const merged = { ...stored, ...(handoutRecordOverrides.get(stored.recordId) ?? {}) }
    const head = handoverHeadAdditions.get(handoverId)
    const record = head ? projectLinkedPostReturn(merged, head) : merged
    if ((record.handoverRecordStatus || mapRecordLifecycleStatus(record)) === 'VOIDED' || record.qtyUnit !== unit) continue
    if (Number.isFinite(record.submittedQty) && record.submittedQty! > 0) submittedQty += record.submittedQty!
    const writtenQty = record.receiverWrittenQty ?? record.warehouseWrittenQty
    if ((record.receiverWrittenAt || record.warehouseWrittenAt) && Number.isFinite(writtenQty) && writtenQty! >= 0) receivedQty += writtenQty!
  }
  return { submittedQty: roundNumber(submittedQty), receivedQty: roundNumber(receivedQty) }
}

// 正常模块加载读取原动作存储，不导入验收归档、不推断已完成数量。
readFormalHandoutActions()
