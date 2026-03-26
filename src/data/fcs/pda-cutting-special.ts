import type { OwnerSuggestion } from './routing-templates'
import type { ProcessTask } from './process-tasks'
import { getTaskChainTaskById, listTaskChainTasks } from './page-adapters/task-chain-pages-adapter'
import { findPdaHandoverHead } from './pda-handover-events'
import { buildClaimDisputeWritebackSummary, formatClaimQty, getClaimDisputeStatusLabel } from '../../helpers/fcs-claim-dispute'
import { getLatestClaimDisputeByOriginalCutOrderNo, getLatestClaimDisputeByTaskId } from '../../state/fcs-claim-dispute-store'

export type PdaTaskEntryMode = 'DEFAULT' | 'CUTTING_SPECIAL'
export type CuttingMaterialType = 'PRINT' | 'DYE' | 'SOLID' | 'LINING'
export type PdaCuttingRouteKey = 'task' | 'pickup' | 'spreading' | 'inbound' | 'handover' | 'replenishment-feedback'

export interface PdaTaskSummary {
  currentStage: string
  materialSku?: string
  materialTypeLabel?: string
  pickupSlipNo?: string
  qrCodeValue?: string
  receiveSummary: string
  executionSummary: string
  handoverSummary: string
}

export interface PdaTaskFlowMock extends ProcessTask {
  taskType: string
  taskTypeLabel: string
  factoryType: string
  factoryTypeLabel: string
  supportsCuttingSpecialActions: boolean
  entryMode: PdaTaskEntryMode
  cutPieceOrderNo?: string
  cutPieceOrderCount?: number
  completedCutPieceOrderCount?: number
  pendingCutPieceOrderCount?: number
  exceptionCutPieceOrderCount?: number
  taskProgressLabel?: string
  taskStateLabel?: string
  taskNextActionLabel?: string
  hasMultipleCutPieceOrders?: boolean
  defaultExecCutPieceOrderNo?: string
  taskReadyForDirectExec?: boolean
  summary: PdaTaskSummary
}

export interface PdaCuttingTaskOrderLine {
  cutPieceOrderId: string
  cutPieceOrderNo: string
  materialSku: string
  materialTypeLabel: string
  colorLabel?: string
  plannedQty: number
  currentReceiveStatus: string
  currentExecutionStatus: string
  currentInboundStatus: string
  currentHandoverStatus: string
  replenishmentRiskLabel: string
  currentStateLabel: string
  nextActionLabel: string
  qrCodeValue: string
  pickupSlipNo: string
  isDone: boolean
  hasException: boolean
  sortOrder: number
}

export interface PdaCuttingRouteOptions {
  cutPieceOrderNo?: string
  returnTo?: string
}

export interface PdaCuttingPickupLog {
  cutPieceOrderNo?: string
  id: string
  scannedAt: string
  operatorName: string
  resultLabel: string
  note: string
  photoProofCount: number
}

export interface PdaCuttingSpreadingRecord {
  cutPieceOrderNo?: string
  id: string
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  calculatedLength: number
  enteredBy: string
  enteredAt: string
  sourceType: 'PDA' | 'PCS'
  note: string
}

export interface PdaCuttingInboundRecord {
  cutPieceOrderNo?: string
  id: string
  scannedAt: string
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

export interface PdaCuttingHandoverRecord {
  cutPieceOrderNo?: string
  id: string
  handoverAt: string
  operatorName: string
  targetLabel: string
  resultLabel: string
  note: string
}

export interface PdaCuttingReplenishmentFeedbackRecord {
  cutPieceOrderNo?: string
  id: string
  feedbackAt: string
  operatorName: string
  reasonLabel: string
  note: string
  photoProofCount: number
}

export interface PdaCuttingRecentAction {
  actionType: 'PICKUP' | 'SPREADING' | 'INBOUND' | 'HANDOVER' | 'REPLENISHMENT'
  actionTypeLabel: string
  operatedBy: string
  operatedAt: string
  summary: string
}

export interface PdaCuttingTaskDetailData {
  taskId: string
  taskNo: string
  productionOrderNo: string
  cutPieceOrderNo: string
  cutPieceOrders: PdaCuttingTaskOrderLine[]
  cutPieceOrderCount: number
  completedCutPieceOrderCount: number
  pendingCutPieceOrderCount: number
  exceptionCutPieceOrderCount: number
  defaultCutPieceOrderNo: string
  currentSelectedCutPieceOrderNo: string | null
  taskProgressLabel: string
  taskNextActionLabel: string
  taskTypeLabel: string
  factoryTypeLabel: string
  assigneeFactoryName: string
  orderQty: number
  taskStatusLabel: string
  currentOwnerName: string
  materialSku: string
  materialTypeLabel: string
  pickupSlipNo: string
  pickupSlipPrintStatusLabel: string
  qrObjectLabel: string
  discrepancyAllowed: boolean
  hasQrCode: boolean
  qrCodeValue: string
  qrVersionNote: string
  currentStage: string
  currentActionHint: string
  nextRecommendedAction: string
  riskFlags: string[]
  riskTips: string[]
  receiveSummary: string
  executionSummary: string
  handoverSummary: string
  currentReceiveStatus: string
  currentExecutionStatus: string
  currentInboundStatus: string
  currentHandoverStatus: string
  scanResultLabel: string
  latestReceiveAt: string
  latestReceiveBy: string
  latestPickupRecordNo: string
  latestPickupScanAt: string
  latestPickupOperatorName: string
  configuredQtyText: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
  markerSummary: string
  hasMarkerImage: boolean
  latestSpreadingAt: string
  latestSpreadingBy: string
  latestSpreadingRecordNo: string
  inboundZoneLabel: string
  inboundLocationLabel: string
  latestInboundAt: string
  latestInboundBy: string
  latestInboundRecordNo: string
  latestHandoverAt: string
  latestHandoverBy: string
  latestHandoverRecordNo: string
  handoverTargetLabel: string
  replenishmentRiskSummary: string
  latestReplenishmentFeedbackAt: string
  latestReplenishmentFeedbackBy: string
  latestReplenishmentFeedbackRecordNo: string
  latestFeedbackAt: string
  latestFeedbackBy: string
  latestFeedbackReason: string
  latestFeedbackNote: string
  recentActions: PdaCuttingRecentAction[]
  pickupLogs: PdaCuttingPickupLog[]
  spreadingRecords: PdaCuttingSpreadingRecord[]
  inboundRecords: PdaCuttingInboundRecord[]
  handoverRecords: PdaCuttingHandoverRecord[]
  replenishmentFeedbacks: PdaCuttingReplenishmentFeedbackRecord[]
}

export interface PdaCuttingTaskRollup {
  cutPieceOrderCount: number
  completedCutPieceOrderCount: number
  pendingCutPieceOrderCount: number
  exceptionCutPieceOrderCount: number
  taskProgressLabel: string
  taskStateLabel: string
  taskNextActionLabel: string
  hasMultipleCutPieceOrders: boolean
  defaultExecCutPieceOrderNo: string
  taskReadyForDirectExec: boolean
}

type PdaCuttingTaskDetailSeed = Omit<
  PdaCuttingTaskDetailData,
  | 'cutPieceOrders'
  | 'cutPieceOrderCount'
  | 'completedCutPieceOrderCount'
  | 'pendingCutPieceOrderCount'
  | 'exceptionCutPieceOrderCount'
  | 'defaultCutPieceOrderNo'
  | 'currentSelectedCutPieceOrderNo'
  | 'taskProgressLabel'
  | 'taskNextActionLabel'
>

const cuttingOwnerSuggestion: OwnerSuggestion = { kind: 'MAIN_FACTORY' }
const DEFAULT_FACTORY_ID = 'ID-F001'
const DEFAULT_FACTORY_NAME = '小飞裁片厂'
const DEFAULT_CREATED_AT = '2026-03-19 08:30:00'

function buildTaskAuditLogs(action: string, detail: string, at: string, by: string) {
  return [
    {
      id: `AL-${action}-${at}`,
      action,
      detail,
      at,
      by,
    },
  ]
}

type CuttingActionIdPrefix = 'PK' | 'SPR' | 'INB' | 'HO' | 'FB'

interface CuttingActionAnchorInput {
  cutPieceOrderNo?: string
  taskNo?: string
  sourceTaskNo?: string
  productionOrderNo?: string
}

function normalizeCuttingBusinessAnchor(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function resolveCuttingBusinessAnchor(input: CuttingActionAnchorInput): string {
  const rawAnchor = [input.cutPieceOrderNo, input.taskNo, input.sourceTaskNo, input.productionOrderNo].find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )

  return normalizeCuttingBusinessAnchor(rawAnchor ?? 'CUTTING')
}

function resolveNextStableSequence(existingIds: string[], prefix: CuttingActionIdPrefix, anchor: string): string {
  const idPrefix = `${prefix}-${anchor}-`
  let maxSequence = 0

  existingIds.forEach((existingId) => {
    if (!existingId.startsWith(idPrefix)) return
    const sequence = Number.parseInt(existingId.slice(idPrefix.length), 10)
    if (Number.isFinite(sequence) && sequence > maxSequence) {
      maxSequence = sequence
    }
  })

  return String(maxSequence + 1).padStart(3, '0')
}

function createStableCuttingActionId(
  prefix: CuttingActionIdPrefix,
  anchorInput: CuttingActionAnchorInput,
  existingIds: string[],
): string {
  const anchor = resolveCuttingBusinessAnchor(anchorInput)
  const nextSequence = resolveNextStableSequence(existingIds, prefix, anchor)
  return `${prefix}-${anchor}-${nextSequence}`
}

const CUTTING_STYLE_SNAPSHOT_BY_ORDER: Record<
  string,
  {
    spuCode: string
    spuName: string
    requiredDeliveryDate: string
  }
> = {
  'PO-20260319-011': { spuCode: 'SPU-CUT-011', spuName: '春季连帽卫衣', requiredDeliveryDate: '2026-03-24' },
  'PO-20260319-012': { spuCode: 'SPU-CUT-012', spuName: '休闲抽绳短裤', requiredDeliveryDate: '2026-03-23' },
  'PO-20260319-013': { spuCode: 'SPU-CUT-013', spuName: '净色针织上衣', requiredDeliveryDate: '2026-03-23' },
  'PO-20260319-014': { spuCode: 'SPU-CUT-014', spuName: '户外轻量夹克', requiredDeliveryDate: '2026-03-22' },
  'PO-20260319-015': { spuCode: 'SPU-CUT-015', spuName: '基础圆领卫衣', requiredDeliveryDate: '2026-03-22' },
  'PO-20260319-016': { spuCode: 'SPU-CUT-016', spuName: '运动收脚裤', requiredDeliveryDate: '2026-03-22' },
  'PO-20260319-017': { spuCode: 'SPU-CUT-017', spuName: '印花短袖上衣', requiredDeliveryDate: '2026-03-23' },
  'PO-20260319-018': { spuCode: 'SPU-CUT-018', spuName: '弹力拼接长裤', requiredDeliveryDate: '2026-03-24' },
  'PO-20260319-019': { spuCode: 'SPU-CUT-019', spuName: '印花运动套装', requiredDeliveryDate: '2026-03-24' },
  'PO-20260319-020': { spuCode: 'SPU-CUT-020', spuName: '净色休闲卫裤', requiredDeliveryDate: '2026-03-22' },
  'PO-20260319-021': { spuCode: 'SPU-CUT-021', spuName: '里布拼接风衣', requiredDeliveryDate: '2026-03-23' },
  'PO-20260319-022': { spuCode: 'SPU-CUT-022', spuName: '印花专版套头衫', requiredDeliveryDate: '2026-03-25' },
  'PO-20260321-019': { spuCode: 'SPU-CUT-BID-017', spuName: '印花版型连帽上衣', requiredDeliveryDate: '2026-03-24' },
  'PO-20260321-018': { spuCode: 'SPU-SEW-BID-113', spuName: '春季针织卫衣套装', requiredDeliveryDate: '2026-03-25' },
  'PO-20260321-020': { spuCode: 'SPU-PACK-BID-009', spuName: '轻量运动外套套装', requiredDeliveryDate: '2026-03-24' },
  'PO-20260322-031': { spuCode: 'SPU-CUT-BID-201', spuName: '夏季印花短裤', requiredDeliveryDate: '2026-03-24' },
  'PO-20260322-032': { spuCode: 'SPU-SEW-BID-118', spuName: '连帽针织开衫', requiredDeliveryDate: '2026-03-25' },
  'PO-20260322-033': { spuCode: 'SPU-IRON-BID-071', spuName: '休闲抽绳长裤', requiredDeliveryDate: '2026-03-25' },
  'PO-20260322-034': { spuCode: 'SPU-PACK-000241', spuName: '高弹运动拉链外套', requiredDeliveryDate: '2026-03-24' },
}

function createMockTask(input: {
  taskId: string
  taskNo: string
  productionOrderId: string
  seq: number
  processCode: string
  processNameZh: string
  stage: ProcessTask['stage']
  qty: number
  assignmentMode: ProcessTask['assignmentMode']
  assignmentStatus: ProcessTask['assignmentStatus']
  status: ProcessTask['status']
  acceptanceStatus?: ProcessTask['acceptanceStatus']
  assignedFactoryId: string
  assignedFactoryName: string
  acceptDeadline?: string
  taskDeadline?: string
  taskType: string
  taskTypeLabel: string
  factoryType: string
  factoryTypeLabel: string
  supportsCuttingSpecialActions: boolean
  entryMode: PdaTaskEntryMode
  cutPieceOrderNo?: string
  summary: PdaTaskSummary
  overrides?: Partial<PdaTaskFlowMock> & Record<string, unknown>
}): PdaTaskFlowMock {
  return Object.assign({
    taskId: input.taskId,
    taskNo: input.taskNo,
    productionOrderId: input.productionOrderId,
    seq: input.seq,
    processCode: input.processCode,
    processNameZh: input.processNameZh,
    stage: input.stage,
    qty: input.qty,
    qtyUnit: 'PIECE',
    assignmentMode: input.assignmentMode,
    assignmentStatus: input.assignmentStatus,
    ownerSuggestion: cuttingOwnerSuggestion,
    assignedFactoryId: input.assignedFactoryId,
    assignedFactoryName: input.assignedFactoryName,
    qcPoints: [],
    attachments: [],
    status: input.status,
    acceptanceStatus: input.acceptanceStatus,
    acceptedAt: input.acceptanceStatus === 'ACCEPTED' ? '2026-03-19 09:10:00' : undefined,
    acceptedBy: input.acceptanceStatus === 'ACCEPTED' ? input.assignedFactoryName : undefined,
    acceptDeadline: input.acceptDeadline,
    taskDeadline: input.taskDeadline,
    startDueAt: input.acceptanceStatus === 'ACCEPTED' ? '2026-03-21 09:10:00' : undefined,
    startDueSource: input.acceptanceStatus === 'ACCEPTED' ? 'ACCEPTED' : undefined,
    startRiskStatus: input.status === 'NOT_STARTED' ? 'DUE_SOON' : 'NORMAL',
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: '2026-03-19 10:20:00',
    auditLogs: buildTaskAuditLogs(
      input.acceptanceStatus === 'ACCEPTED' ? 'ACCEPT_TASK' : 'DISPATCH_TASK',
      input.acceptanceStatus === 'ACCEPTED' ? '工厂已接单' : '平台已派单，待工厂接单',
      '2026-03-19 09:20:00',
      input.acceptanceStatus === 'ACCEPTED' ? input.assignedFactoryName : '平台调度',
    ),
    taskType: input.taskType,
    taskTypeLabel: input.taskTypeLabel,
    factoryType: input.factoryType,
    factoryTypeLabel: input.factoryTypeLabel,
    supportsCuttingSpecialActions: input.supportsCuttingSpecialActions,
    entryMode: input.entryMode,
    cutPieceOrderNo: input.cutPieceOrderNo,
    summary: input.summary,
    ...(CUTTING_STYLE_SNAPSHOT_BY_ORDER[input.productionOrderId] ?? {}),
  }, input.overrides ?? {}) as PdaTaskFlowMock
}

const ordinaryTaskStore: PdaTaskFlowMock[] = [
  createMockTask({
    taskId: 'TASK-SEW-000231',
    taskNo: 'TASK-SEW-000231',
    productionOrderId: 'PO-20260318-001',
    seq: 1,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 280,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: 'A 车缝厂',
    acceptDeadline: '2026-03-22 18:00:00',
    taskDeadline: '2026-03-25 18:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '待接单',
      receiveSummary: '不适用',
      executionSummary: '等待工厂接单',
      handoverSummary: '未开始',
    },
    overrides: {
      dispatchedAt: '2026-03-21 17:10:00',
      dispatchedBy: '平台调度',
      dispatchRemark: '优先锁定 3 月 23 日上午产能，需在今晚确认接单。',
      standardPrice: 4.2,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      dispatchPrice: 4.6,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      updatedAt: '2026-03-22 08:10:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-000232',
    taskNo: 'TASK-SEW-000232',
    productionOrderId: 'PO-20260318-002',
    seq: 2,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 160,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: 'B 车缝厂',
    acceptDeadline: '2026-03-21 18:00:00',
    taskDeadline: '2026-03-24 20:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '车缝执行中',
      receiveSummary: '不适用',
      executionSummary: '通用执行流程中',
      handoverSummary: '待后续交接',
    },
    overrides: {
      startedAt: '2026-03-20 08:30:00',
      dispatchRemark: '领料已到位，先做肩部与侧缝主线。',
      standardPrice: 3.9,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      dispatchPrice: 4.1,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      updatedAt: '2026-03-22 09:20:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-000233',
    taskNo: 'TASK-SEW-000233',
    productionOrderId: 'PO-20260318-003',
    seq: 3,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 420,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '华盛车缝二厂',
    acceptDeadline: '2026-03-21 16:00:00',
    taskDeadline: '2026-03-24 18:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '待开工',
      receiveSummary: '不适用',
      executionSummary: '前置已确认，待开工',
      handoverSummary: '未开始',
    },
    overrides: {
      acceptedAt: '2026-03-21 10:05:00',
      acceptedBy: '华盛车缝二厂',
      startDueAt: '2026-03-22 12:00:00',
      startDueSource: 'ACCEPTED',
      startRiskStatus: 'DUE_SOON',
      dispatchRemark: '已确认裁片与辅料，今日需排首件。',
      standardPrice: 4.0,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      dispatchPrice: 4.2,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      updatedAt: '2026-03-22 07:40:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-000234',
    taskNo: 'TASK-SEW-000234',
    productionOrderId: 'PO-20260318-004',
    seq: 4,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 310,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'BLOCKED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '卓越车缝厂',
    acceptDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-03-23 20:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '生产暂停',
      receiveSummary: '不适用',
      executionSummary: '因物料问题暂停',
      handoverSummary: '未开始',
    },
    overrides: {
      startedAt: '2026-03-21 08:20:00',
      blockedAt: '2026-03-22 09:15:00',
      blockReason: 'MATERIAL',
      blockRemark: '里布剩余数量不足，待仓库补发后继续。',
      pauseStatus: 'REPORTED',
      pauseReasonCode: 'MATERIAL_ISSUE',
      pauseReasonLabel: '物料异常',
      pauseRemark: '现场确认里布短少，已上报。',
      updatedAt: '2026-03-22 09:18:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-IRON-000235',
    taskNo: 'TASK-IRON-000235',
    productionOrderId: 'PO-20260318-005',
    seq: 5,
    processCode: 'IRONING',
    processNameZh: '整烫',
    stage: 'POST',
    qty: 260,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '华盛后整厂',
    acceptDeadline: '2026-03-20 12:00:00',
    taskDeadline: '2026-03-22 18:30:00',
    taskType: 'IRONING',
    taskTypeLabel: '整烫任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '已完工待交出',
      receiveSummary: '不适用',
      executionSummary: '整烫已完成',
      handoverSummary: '待交出',
    },
    overrides: {
      startedAt: '2026-03-21 08:00:00',
      finishedAt: '2026-03-22 11:35:00',
      updatedAt: '2026-03-22 11:35:00',
      handoutStatus: 'PENDING',
    },
  }),
  createMockTask({
    taskId: 'TASK-PACK-000236',
    taskNo: 'TASK-PACK-000236',
    productionOrderId: 'PO-20260318-006',
    seq: 6,
    processCode: 'PACKING',
    processNameZh: '包装',
    stage: 'POST',
    qty: 540,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '锦程包装厂',
    acceptDeadline: '2026-03-20 16:00:00',
    taskDeadline: '2026-03-22 16:30:00',
    taskType: 'PACKING',
    taskTypeLabel: '包装任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '已完成',
      receiveSummary: '不适用',
      executionSummary: '包装已完成',
      handoverSummary: '已交接完成',
    },
    overrides: {
      startedAt: '2026-03-21 09:10:00',
      finishedAt: '2026-03-22 14:15:00',
      updatedAt: '2026-03-22 14:15:00',
      handoutStatus: 'DONE',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-000237',
    taskNo: 'TASK-SEW-000237',
    productionOrderId: 'PO-20260318-007',
    seq: 7,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 190,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '锦泰车缝厂',
    acceptDeadline: '2026-03-22 10:30:00',
    taskDeadline: '2026-03-23 18:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '待接单',
      receiveSummary: '不适用',
      executionSummary: '接单即将逾期',
      handoverSummary: '未开始',
    },
    overrides: {
      dispatchedAt: '2026-03-22 08:40:00',
      dispatchedBy: '平台调度',
      dispatchRemark: '客户急单，若无法接单需立即反馈。',
      updatedAt: '2026-03-22 09:50:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-000238',
    taskNo: 'TASK-SEW-000238',
    productionOrderId: 'PO-20260318-008',
    seq: 8,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 360,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'AWARDED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '腾越车缝厂',
    acceptDeadline: '2026-03-22 18:30:00',
    taskDeadline: '2026-03-25 12:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '已中标待接单',
      receiveSummary: '不适用',
      executionSummary: '待确认排产',
      handoverSummary: '未开始',
    },
    overrides: {
      awardedAt: '2026-03-22 07:45:00',
      dispatchPrice: 4.5,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      standardPrice: 4.1,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      priceDiffReason: '中标价包含夜班排期补贴',
      updatedAt: '2026-03-22 07:45:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-000239',
    taskNo: 'TASK-SEW-000239',
    productionOrderId: 'PO-20260318-009',
    seq: 9,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 210,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '旭成车缝厂',
    acceptDeadline: '2026-03-22 20:00:00',
    taskDeadline: '2026-03-24 22:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '待接单',
      receiveSummary: '不适用',
      executionSummary: '待确认夜班产能',
      handoverSummary: '未开始',
    },
    overrides: {
      dispatchedAt: '2026-03-22 10:05:00',
      dispatchedBy: '平台调度',
      dispatchRemark: '该单需晚间开线，若无法接单请立即回退。',
      standardPrice: 4.4,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      dispatchPrice: 4.8,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      updatedAt: '2026-03-22 10:05:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-BID-118',
    taskNo: 'TASK-SEW-BID-118',
    productionOrderId: 'PO-20260322-032',
    seq: 10,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 880,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    status: 'NOT_STARTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '腾越车缝厂',
    acceptDeadline: '2026-03-22 20:00:00',
    taskDeadline: '2026-03-25 18:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '待报价',
      receiveSummary: '不适用',
      executionSummary: '招标中，待确认报价方案',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-SEW-118',
      standardPrice: 4.3,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      updatedAt: '2026-03-22 09:10:00',
      auditLogs: buildTaskAuditLogs(
        'OPEN_BIDDING',
        '平台发起车缝招标，等待工厂报价',
        '2026-03-22 09:10:00',
        '平台调度',
      ),
    },
  }),
  createMockTask({
    taskId: 'TASK-PACK-000241',
    taskNo: 'TASK-PACK-000241',
    productionOrderId: 'PO-20260322-034',
    seq: 11,
    processCode: 'PACKING',
    processNameZh: '包装',
    stage: 'POST',
    qty: 680,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'AWARDED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '汇成包装厂',
    acceptDeadline: '2026-03-22 19:30:00',
    taskDeadline: '2026-03-24 18:00:00',
    taskType: 'PACKING',
    taskTypeLabel: '包装任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '已中标待接单',
      receiveSummary: '不适用',
      executionSummary: '待确认包装排线',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-PACK-011',
      awardedAt: '2026-03-22 09:20:00',
      dispatchPrice: 1.3,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      standardPrice: 1.1,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      priceDiffReason: '中标价包含晚班包装与分批交付协同。',
      updatedAt: '2026-03-22 09:20:00',
      auditLogs: buildTaskAuditLogs(
        'AWARD_BID',
        '平台已完成定标，等待工厂确认并进入执行',
        '2026-03-22 09:20:00',
        '平台调度',
      ),
    },
  }),
  createMockTask({
    taskId: 'TASK-IRON-BID-071',
    taskNo: 'TASK-IRON-BID-071',
    productionOrderId: 'PO-20260322-033',
    seq: 12,
    processCode: 'IRONING',
    processNameZh: '整烫',
    stage: 'POST',
    qty: 540,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    status: 'NOT_STARTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '华盛后整厂',
    acceptDeadline: '2026-03-23 10:00:00',
    taskDeadline: '2026-03-25 20:00:00',
    taskType: 'IRONING',
    taskTypeLabel: '整烫任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '待报价',
      receiveSummary: '不适用',
      executionSummary: '等待工厂确认整烫报价',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-IRON-071',
      standardPrice: 1.8,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      updatedAt: '2026-03-22 09:25:00',
      auditLogs: buildTaskAuditLogs(
        'OPEN_BIDDING',
        '平台发起整烫招标，等待工厂报价',
        '2026-03-22 09:25:00',
        '平台调度',
      ),
    },
  }),
  createMockTask({
    taskId: 'TASK-SEW-BID-113',
    taskNo: 'TASK-SEW-BID-113',
    productionOrderId: 'PO-20260321-018',
    seq: 13,
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    stage: 'SEWING',
    qty: 760,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    status: 'NOT_STARTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '腾越车缝厂',
    acceptDeadline: '2026-03-22 12:00:00',
    taskDeadline: '2026-03-25 20:00:00',
    taskType: 'SEWING',
    taskTypeLabel: '车缝任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '已报价待定标',
      receiveSummary: '不适用',
      executionSummary: '工厂已报价，等待平台定标',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-SEW-113',
      standardPrice: 4.3,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      updatedAt: '2026-03-22 09:10:00',
      auditLogs: buildTaskAuditLogs(
        'SUBMIT_BID',
        '工厂已提交车缝报价，等待平台定标',
        '2026-03-22 09:10:00',
        '腾越车缝厂',
      ),
    },
  }),
  createMockTask({
    taskId: 'TASK-PACK-BID-009',
    taskNo: 'TASK-PACK-BID-009',
    productionOrderId: 'PO-20260321-020',
    seq: 14,
    processCode: 'PACKING',
    processNameZh: '包装',
    stage: 'POST',
    qty: 920,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    status: 'NOT_STARTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: '汇成包装厂',
    acceptDeadline: '2026-03-22 09:30:00',
    taskDeadline: '2026-03-24 16:00:00',
    taskType: 'PACKING',
    taskTypeLabel: '包装任务',
    factoryType: 'GENERAL_FACTORY',
    factoryTypeLabel: '普通工厂',
    supportsCuttingSpecialActions: false,
    entryMode: 'DEFAULT',
    summary: {
      currentStage: '已报价待定标',
      receiveSummary: '不适用',
      executionSummary: '工厂已报价，待确认包装排期',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-PACK-009',
      standardPrice: 1.1,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      updatedAt: '2026-03-21 17:40:00',
      auditLogs: buildTaskAuditLogs(
        'SUBMIT_BID',
        '工厂已提交包装报价，等待平台定标',
        '2026-03-21 17:40:00',
        '汇成包装厂',
      ),
    },
  }),
]

const cuttingTaskStore: PdaTaskFlowMock[] = [
  createMockTask({
    taskId: 'TASK-CUT-000087',
    taskNo: 'TASK-CUT-000087',
    productionOrderId: 'PO-20260319-011',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 520,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-03-24 12:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-A',
    summary: {
      currentStage: '待扫码领料',
      materialSku: 'FAB-SKU-PRINT-001',
      materialTypeLabel: '印花面料',
      pickupSlipNo: 'PS-20260319-009',
      qrCodeValue: 'QR-CPO-20260319-A',
      receiveSummary: '已配置，待扫码领取',
      executionSummary: '未开始铺布',
      handoverSummary: '未入仓',
    },
    overrides: {
      startedAt: undefined,
      updatedAt: '2026-03-22 08:20:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000088',
    taskNo: 'TASK-CUT-000088',
    productionOrderId: 'PO-20260319-012',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 360,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-19 18:00:00',
    taskDeadline: '2026-03-23 12:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-B',
    summary: {
      currentStage: '铺布执行中',
      materialSku: 'FAB-SKU-SOLID-014',
      materialTypeLabel: '净色面料',
      pickupSlipNo: 'PS-20260319-010',
      qrCodeValue: 'QR-CPO-20260319-B',
      receiveSummary: '领料成功',
      executionSummary: '已有 2 条铺布记录',
      handoverSummary: '待入仓',
    },
    overrides: {
      startedAt: '2026-03-19 10:25:00',
      updatedAt: '2026-03-22 09:30:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000089',
    taskNo: 'TASK-CUT-000089',
    productionOrderId: 'PO-20260319-013',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 440,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 14:00:00',
    taskDeadline: '2026-03-23 18:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-C',
    summary: {
      currentStage: '待铺布录入',
      materialSku: 'FAB-SKU-DYE-022',
      materialTypeLabel: '染色面料',
      pickupSlipNo: 'PS-20260319-011',
      qrCodeValue: 'QR-CPO-20260319-C',
      receiveSummary: '领料成功，待铺布',
      executionSummary: '未开始铺布',
      handoverSummary: '未入仓',
    },
    overrides: {
      updatedAt: '2026-03-22 09:05:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000090',
    taskNo: 'TASK-CUT-000090',
    productionOrderId: 'PO-20260319-014',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 580,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 12:00:00',
    taskDeadline: '2026-03-23 16:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-D',
    summary: {
      currentStage: '待入仓',
      materialSku: 'FAB-SKU-PRINT-008',
      materialTypeLabel: '印花面料',
      pickupSlipNo: 'PS-20260319-012',
      qrCodeValue: 'QR-CPO-20260319-D',
      receiveSummary: '领料成功',
      executionSummary: '铺布完成，待入仓',
      handoverSummary: '待入仓',
    },
    overrides: {
      startedAt: '2026-03-21 08:20:00',
      updatedAt: '2026-03-22 09:35:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000091',
    taskNo: 'TASK-CUT-000091',
    productionOrderId: 'PO-20260319-015',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 300,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 15:00:00',
    taskDeadline: '2026-03-23 14:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-E',
    summary: {
      currentStage: '待交接',
      materialSku: 'FAB-SKU-LINING-003',
      materialTypeLabel: '里布',
      pickupSlipNo: 'PS-20260319-013',
      qrCodeValue: 'QR-CPO-20260319-E',
      receiveSummary: '领料成功',
      executionSummary: '已完成入仓',
      handoverSummary: '待交接扫码',
    },
    overrides: {
      startedAt: '2026-03-21 08:40:00',
      updatedAt: '2026-03-22 09:40:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000092',
    taskNo: 'TASK-CUT-000092',
    productionOrderId: 'PO-20260319-016',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 410,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-03-23 17:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-F',
    summary: {
      currentStage: '待补料反馈',
      materialSku: 'FAB-SKU-SOLID-021',
      materialTypeLabel: '净色面料',
      pickupSlipNo: 'PS-20260319-014',
      qrCodeValue: 'QR-CPO-20260319-F',
      receiveSummary: '领料成功',
      executionSummary: '铺布完成，存在补料风险',
      handoverSummary: '未入仓',
    },
    overrides: {
      startedAt: '2026-03-21 07:55:00',
      updatedAt: '2026-03-22 09:45:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000093',
    taskNo: 'TASK-CUT-000093',
    productionOrderId: 'PO-20260319-017',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 260,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'BLOCKED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 10:00:00',
    taskDeadline: '2026-03-22 20:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-G',
    summary: {
      currentStage: '生产暂停',
      materialSku: 'FAB-SKU-PRINT-017',
      materialTypeLabel: '印花面料',
      pickupSlipNo: 'PS-20260319-015',
      qrCodeValue: 'QR-CPO-20260319-G',
      receiveSummary: '已领料',
      executionSummary: '因设备问题暂停',
      handoverSummary: '未入仓',
    },
    overrides: {
      startedAt: '2026-03-21 09:25:00',
      blockedAt: '2026-03-22 08:55:00',
      blockReason: 'EQUIPMENT',
      blockRemark: '主裁床检修中，预计中午恢复。',
      pauseStatus: 'REPORTED',
      pauseReasonCode: 'EQUIPMENT_ISSUE',
      pauseReasonLabel: '设备问题',
      updatedAt: '2026-03-22 08:55:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000094',
    taskNo: 'TASK-CUT-000094',
    productionOrderId: 'PO-20260319-018',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 240,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 09:30:00',
    taskDeadline: '2026-03-22 14:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-H',
    summary: {
      currentStage: '已完成',
      materialSku: 'FAB-SKU-DYE-009',
      materialTypeLabel: '染色面料',
      pickupSlipNo: 'PS-20260319-016',
      qrCodeValue: 'QR-CPO-20260319-H',
      receiveSummary: '领料成功',
      executionSummary: '裁片执行完成',
      handoverSummary: '已完成交接',
    },
    overrides: {
      startedAt: '2026-03-21 08:00:00',
      finishedAt: '2026-03-22 11:10:00',
      updatedAt: '2026-03-22 11:10:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000095',
    taskNo: 'TASK-CUT-000095',
    productionOrderId: 'PO-20260319-019',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 670,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 13:00:00',
    taskDeadline: '2026-03-23 15:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-I',
    summary: {
      currentStage: '高风险待复核',
      materialSku: 'FAB-SKU-PRINT-021',
      materialTypeLabel: '印花面料',
      pickupSlipNo: 'PS-20260319-017',
      qrCodeValue: 'QR-CPO-20260319-I',
      receiveSummary: '领料差异待复核',
      executionSummary: '执行放缓，待确认差异',
      handoverSummary: '未入仓',
    },
    overrides: {
      startedAt: '2026-03-21 08:50:00',
      updatedAt: '2026-03-22 09:55:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000096',
    taskNo: 'TASK-CUT-000096',
    productionOrderId: 'PO-20260319-020',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 350,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'ACCEPTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-20 17:30:00',
    taskDeadline: '2026-03-23 19:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-J',
    summary: {
      currentStage: '多次复核待处理',
      materialSku: 'FAB-SKU-SOLID-033',
      materialTypeLabel: '净色面料',
      pickupSlipNo: 'PS-20260319-018',
      qrCodeValue: 'QR-CPO-20260319-J',
      receiveSummary: '多次复核中',
      executionSummary: '待完成领料复核后开工',
      handoverSummary: '未开始',
    },
    overrides: {
      updatedAt: '2026-03-22 10:00:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000097',
    taskNo: 'TASK-CUT-000097',
    productionOrderId: 'PO-20260319-021',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 290,
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-22 17:30:00',
    taskDeadline: '2026-03-24 17:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-K',
    summary: {
      currentStage: '待接单确认',
      materialSku: 'FAB-SKU-LINING-007',
      materialTypeLabel: '里布',
      pickupSlipNo: 'PS-20260319-019',
      qrCodeValue: 'QR-CPO-20260319-K',
      receiveSummary: '待工厂确认',
      executionSummary: '尚未进入执行',
      handoverSummary: '未开始',
    },
    overrides: {
      dispatchedAt: '2026-03-22 09:20:00',
      dispatchedBy: '平台调度',
      dispatchRemark: '新增裁片急单，请在今日完成接单确认。',
      updatedAt: '2026-03-22 09:20:00',
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-BID-201',
    taskNo: 'TASK-CUT-BID-201',
    productionOrderId: 'PO-20260322-031',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 620,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    status: 'NOT_STARTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-22 18:00:00',
    taskDeadline: '2026-03-24 12:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260322-M',
    summary: {
      currentStage: '待报价',
      materialSku: 'FAB-SKU-PRINT-041',
      materialTypeLabel: '印花面料',
      pickupSlipNo: '待定标后生成',
      qrCodeValue: '待定标后生成',
      receiveSummary: '定标后生成领料草稿',
      executionSummary: '当前处于招标阶段',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-CUT-021',
      standardPrice: 6.5,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      updatedAt: '2026-03-22 09:05:00',
      auditLogs: buildTaskAuditLogs(
        'OPEN_BIDDING',
        '平台发起裁片招标，等待工厂报价',
        '2026-03-22 08:10:00',
        '平台调度',
      ),
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-BID-017',
    taskNo: 'TASK-CUT-BID-017',
    productionOrderId: 'PO-20260321-019',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 430,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    status: 'NOT_STARTED',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-22 11:00:00',
    taskDeadline: '2026-03-24 18:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260321-Q',
    summary: {
      currentStage: '已报价待定标',
      materialSku: 'FAB-SKU-PRINT-033',
      materialTypeLabel: '印花面料',
      pickupSlipNo: '待定标后生成',
      qrCodeValue: '待定标后生成',
      receiveSummary: '已报价，待定标后生成领料草稿',
      executionSummary: '当前处于已报价等待阶段',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-CUT-017',
      standardPrice: 6.2,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      updatedAt: '2026-03-22 08:35:00',
      auditLogs: buildTaskAuditLogs(
        'SUBMIT_BID',
        '工厂已提交裁片报价，等待平台定标',
        '2026-03-22 08:35:00',
        DEFAULT_FACTORY_NAME,
      ),
    },
  }),
  createMockTask({
    taskId: 'TASK-CUT-000098',
    taskNo: 'TASK-CUT-000098',
    productionOrderId: 'PO-20260319-022',
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: 470,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'AWARDED',
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: DEFAULT_FACTORY_ID,
    assignedFactoryName: DEFAULT_FACTORY_NAME,
    acceptDeadline: '2026-03-22 19:00:00',
    taskDeadline: '2026-03-25 12:00:00',
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_FACTORY',
    factoryTypeLabel: '裁片厂',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL',
    cutPieceOrderNo: 'CPO-20260319-L',
    summary: {
      currentStage: '已中标待接单',
      materialSku: 'FAB-SKU-PRINT-031',
      materialTypeLabel: '印花面料',
      pickupSlipNo: 'PS-20260319-020',
      qrCodeValue: 'QR-CPO-20260319-L',
      receiveSummary: '待工厂确认',
      executionSummary: '待接单后进入领料',
      handoverSummary: '未开始',
    },
    overrides: {
      tenderId: 'TENDER-PDA-CUT-017',
      awardedAt: '2026-03-22 08:35:00',
      dispatchPrice: 6.8,
      dispatchPriceCurrency: 'CNY',
      dispatchPriceUnit: '件',
      standardPrice: 6.2,
      standardPriceCurrency: 'CNY',
      standardPriceUnit: '件',
      priceDiffReason: '印花专版裁片加急单',
      updatedAt: '2026-03-22 08:35:00',
    },
  }),
]

const CUTTING_DETAIL_SHARED: Pick<
  PdaCuttingTaskDetailSeed,
  | 'taskTypeLabel'
  | 'factoryTypeLabel'
  | 'assigneeFactoryName'
  | 'pickupSlipPrintStatusLabel'
  | 'qrObjectLabel'
  | 'discrepancyAllowed'
  | 'hasQrCode'
  | 'qrVersionNote'
> = {
  taskTypeLabel: '裁片任务',
  factoryTypeLabel: '裁片厂',
  assigneeFactoryName: DEFAULT_FACTORY_NAME,
  pickupSlipPrintStatusLabel: '已打印领料单',
  qrObjectLabel: '裁片单级二维码',
  discrepancyAllowed: true,
  hasQrCode: true,
  qrVersionNote: '裁片单级二维码，后续重复领料与执行均复用此码',
}

const cuttingDetailStore: Record<string, PdaCuttingTaskDetailSeed> = {
  'TASK-CUT-000087': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000087',
    taskNo: 'TASK-CUT-000087',
    productionOrderNo: 'PO-20260319-011',
    cutPieceOrderNo: 'CPO-20260319-A',
    orderQty: 520,
    taskStatusLabel: '待领料',
    currentOwnerName: 'Dimas',
    materialSku: 'FAB-SKU-PRINT-001',
    materialTypeLabel: '印花面料',
    pickupSlipNo: 'PS-20260319-009',
    qrCodeValue: 'QR-CPO-20260319-A',
    currentStage: '待扫码领料',
    currentActionHint: '先完成扫码领料，再进入铺布录入。',
    nextRecommendedAction: '扫码领料',
    riskFlags: ['待领料', '待铺布'],
    riskTips: ['领料单已打印，待现场扫码领取', '未开始铺布，需先完成领料确认'],
    receiveSummary: '已配置，待扫码领取',
    executionSummary: '未开始铺布',
    handoverSummary: '未入仓',
    currentReceiveStatus: '待扫码领料',
    currentExecutionStatus: '未开始铺布',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '待扫码领取',
    latestReceiveAt: '2026-03-19 09:20:00',
    latestReceiveBy: 'Dimas',
    latestPickupRecordNo: '-',
    latestPickupScanAt: '2026-03-19 09:20:00',
    latestPickupOperatorName: 'Dimas',
    configuredQtyText: '卷数 12 卷 / 长度 485 米',
    actualReceivedQtyText: '待扫码回写',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '待维护唛架信息',
    hasMarkerImage: false,
    latestSpreadingAt: '-',
    latestSpreadingBy: '-',
    latestSpreadingRecordNo: '-',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待入仓指引',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待确定后道去向',
    replenishmentRiskSummary: '当前无补料反馈',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: 'Dimas',
        operatedAt: '2026-03-19 09:20:00',
        summary: '领料单已下发，等待现场扫码领取印花面料。',
      },
    ],
    pickupLogs: [],
    spreadingRecords: [],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000088': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000088',
    taskNo: 'TASK-CUT-000088',
    productionOrderNo: 'PO-20260319-012',
    cutPieceOrderNo: 'CPO-20260319-B',
    orderQty: 360,
    taskStatusLabel: '铺布执行中',
    currentOwnerName: 'Rian',
    materialSku: 'FAB-SKU-SOLID-014',
    materialTypeLabel: '净色面料',
    pickupSlipNo: 'PS-20260319-010',
    qrCodeValue: 'QR-CPO-20260319-B',
    qrVersionNote: '裁片单级二维码，沿用仓库配料生成的唯一编码',
    currentStage: '铺布执行中',
    currentActionHint: '继续铺布并准备入仓区域确认。',
    nextRecommendedAction: '铺布录入',
    riskFlags: ['待入仓', '补料风险'],
    riskTips: ['已完成首次领料，待继续铺布并确认入仓区域'],
    receiveSummary: '领料成功',
    executionSummary: '已有 2 条铺布记录',
    handoverSummary: '待入仓',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '铺布执行中',
    currentInboundStatus: '待入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-19 10:18:00',
    latestReceiveBy: 'Rian',
    latestPickupRecordNo: 'PK-CPO-20260319-B-001',
    latestPickupScanAt: '2026-03-19 10:18:00',
    latestPickupOperatorName: 'Rian',
    configuredQtyText: '卷数 8 卷 / 长度 320 米',
    actualReceivedQtyText: '卷数 8 卷 / 长度 318 米',
    discrepancyNote: '存在 2 米现场差异，已拍照留底',
    photoProofCount: 2,
    markerSummary: '已维护唛架，总件数 360 件',
    hasMarkerImage: true,
    latestSpreadingAt: '2026-03-19 13:10:00',
    latestSpreadingBy: 'Rian',
    latestSpreadingRecordNo: 'SPR-CPO-20260319-B-002',
    inboundZoneLabel: 'B 区',
    inboundLocationLabel: 'B-02 临时位',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待交接裁片仓',
    replenishmentRiskSummary: '存在轻微长度差异，待观察是否需补料',
    latestReplenishmentFeedbackAt: '2026-03-19 15:20:00',
    latestReplenishmentFeedbackBy: 'Rian',
    latestReplenishmentFeedbackRecordNo: 'FB-CPO-20260319-B-001',
    latestFeedbackAt: '2026-03-19 15:20:00',
    latestFeedbackBy: 'Rian',
    latestFeedbackReason: '铺布余量不足预警',
    latestFeedbackNote: '先继续铺布，若下一卷仍不足则提交补料',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: 'Rian',
        operatedAt: '2026-03-19 10:18:00',
        summary: '已领取 8 卷净色面料，现场差异 2 米并已拍照留底。',
      },
      {
        actionType: 'SPREADING',
        actionTypeLabel: '铺布录入',
        operatedBy: 'Rian',
        operatedAt: '2026-03-19 13:10:00',
        summary: '已录入 2 条铺布记录，当前待继续铺布。',
      },
      {
        actionType: 'REPLENISHMENT',
        actionTypeLabel: '补料反馈',
        operatedBy: 'Rian',
        operatedAt: '2026-03-19 15:20:00',
        summary: '已反馈铺布余量不足预警，待后续继续观察。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-B-001',
        scannedAt: '2026-03-19 10:18:00',
        operatorName: 'Rian',
        resultLabel: '扫码领取成功',
        note: '首批领料与系统配置一致',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [
      {
        id: 'SPR-CPO-20260319-B-001',
        fabricRollNo: 'ROLL-PRINT-011',
        layerCount: 24,
        actualLength: 68,
        headLength: 0.5,
        tailLength: 0.4,
        calculatedLength: 68.9,
        enteredBy: 'Rian',
        enteredAt: '2026-03-19 12:30:00',
        sourceType: 'PDA',
        note: '首卷铺布完成',
      },
      {
        id: 'SPR-CPO-20260319-B-002',
        fabricRollNo: 'ROLL-PRINT-012',
        layerCount: 20,
        actualLength: 60,
        headLength: 0.6,
        tailLength: 0.5,
        calculatedLength: 61.1,
        enteredBy: 'Rian',
        enteredAt: '2026-03-19 13:10:00',
        sourceType: 'PDA',
        note: '第二卷铺布中',
      },
    ],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [
      {
        id: 'FB-CPO-20260319-B-001',
        feedbackAt: '2026-03-19 15:20:00',
        operatorName: 'Rian',
        reasonLabel: '铺布余量不足预警',
        note: '第二卷余量偏少，建议关注下一次铺布结果',
        photoProofCount: 1,
      },
    ],
  },
  'TASK-CUT-000089': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000089',
    taskNo: 'TASK-CUT-000089',
    productionOrderNo: 'PO-20260319-013',
    cutPieceOrderNo: 'CPO-20260319-C',
    orderQty: 440,
    taskStatusLabel: '待铺布',
    currentOwnerName: 'Beni',
    materialSku: 'FAB-SKU-DYE-022',
    materialTypeLabel: '染色面料',
    pickupSlipNo: 'PS-20260319-011',
    qrCodeValue: 'QR-CPO-20260319-C',
    currentStage: '待铺布录入',
    currentActionHint: '领料已回写，下一步录入第一卷铺布数据。',
    nextRecommendedAction: '铺布录入',
    riskFlags: ['待铺布', '待入仓'],
    riskTips: ['已完成领料回写，待开始铺布', '首条铺布记录尚未建立'],
    receiveSummary: '领料成功，待铺布',
    executionSummary: '未开始铺布',
    handoverSummary: '未入仓',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '待铺布录入',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-21 09:30:00',
    latestReceiveBy: 'Beni',
    latestPickupRecordNo: 'PK-CPO-20260319-C-001',
    latestPickupScanAt: '2026-03-21 09:30:00',
    latestPickupOperatorName: 'Beni',
    configuredQtyText: '卷数 10 卷 / 长度 388 米',
    actualReceivedQtyText: '卷数 10 卷 / 长度 388 米',
    discrepancyNote: '现场领取数量与配置一致。',
    photoProofCount: 0,
    markerSummary: '唛架已维护，待上传铺布记录',
    hasMarkerImage: true,
    latestSpreadingAt: '-',
    latestSpreadingBy: '-',
    latestSpreadingRecordNo: '-',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待入仓指引',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待确定后道去向',
    replenishmentRiskSummary: '当前无补料风险',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: 'Beni',
        operatedAt: '2026-03-21 09:30:00',
        summary: '已领取 10 卷染色面料，等待开始铺布。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-C-001',
        scannedAt: '2026-03-21 09:30:00',
        operatorName: 'Beni',
        resultLabel: '扫码领取成功',
        note: '现场领取数量与配置一致。',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000090': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000090',
    taskNo: 'TASK-CUT-000090',
    productionOrderNo: 'PO-20260319-014',
    cutPieceOrderNo: 'CPO-20260319-D',
    orderQty: 580,
    taskStatusLabel: '待入仓',
    currentOwnerName: 'Arif',
    materialSku: 'FAB-SKU-PRINT-008',
    materialTypeLabel: '印花面料',
    pickupSlipNo: 'PS-20260319-012',
    qrCodeValue: 'QR-CPO-20260319-D',
    currentStage: '待入仓',
    currentActionHint: '铺布已完成，请优先确认 A/B/C 区并入仓。',
    nextRecommendedAction: '入仓扫码',
    riskFlags: ['待入仓'],
    riskTips: ['铺布已结束，待仓务确认区域与位置'],
    receiveSummary: '领料成功',
    executionSummary: '铺布完成，待入仓',
    handoverSummary: '待入仓',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '铺布完成',
    currentInboundStatus: '待入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-21 08:25:00',
    latestReceiveBy: 'Arif',
    latestPickupRecordNo: 'PK-CPO-20260319-D-001',
    latestPickupScanAt: '2026-03-21 08:25:00',
    latestPickupOperatorName: 'Arif',
    configuredQtyText: '卷数 14 卷 / 长度 520 米',
    actualReceivedQtyText: '卷数 14 卷 / 长度 520 米',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '唛架已维护，铺布已确认完工',
    hasMarkerImage: true,
    latestSpreadingAt: '2026-03-22 08:40:00',
    latestSpreadingBy: 'Arif',
    latestSpreadingRecordNo: 'SPR-CPO-20260319-D-002',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待入仓指引',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待交接裁片仓',
    replenishmentRiskSummary: '当前无补料风险',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'SPREADING',
        actionTypeLabel: '铺布录入',
        operatedBy: 'Arif',
        operatedAt: '2026-03-22 08:40:00',
        summary: '已完成 2 条铺布记录，等待入仓确认。',
      },
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: 'Arif',
        operatedAt: '2026-03-21 08:25:00',
        summary: '已领取 14 卷印花面料。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-D-001',
        scannedAt: '2026-03-21 08:25:00',
        operatorName: 'Arif',
        resultLabel: '扫码领取成功',
        note: '当前无差异',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [
      {
        id: 'SPR-CPO-20260319-D-001',
        fabricRollNo: 'ROLL-PRINT-021',
        layerCount: 26,
        actualLength: 78,
        headLength: 0.5,
        tailLength: 0.5,
        calculatedLength: 79,
        enteredBy: 'Arif',
        enteredAt: '2026-03-22 07:55:00',
        sourceType: 'PDA',
        note: '首卷铺布完成',
      },
      {
        id: 'SPR-CPO-20260319-D-002',
        fabricRollNo: 'ROLL-PRINT-022',
        layerCount: 24,
        actualLength: 72,
        headLength: 0.4,
        tailLength: 0.4,
        calculatedLength: 72.8,
        enteredBy: 'Arif',
        enteredAt: '2026-03-22 08:40:00',
        sourceType: 'PDA',
        note: '第二卷铺布完成，待入仓',
      },
    ],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000091': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000091',
    taskNo: 'TASK-CUT-000091',
    productionOrderNo: 'PO-20260319-015',
    cutPieceOrderNo: 'CPO-20260319-E',
    orderQty: 300,
    taskStatusLabel: '待交接',
    currentOwnerName: 'Aldi',
    materialSku: 'FAB-SKU-LINING-003',
    materialTypeLabel: '里布',
    pickupSlipNo: 'PS-20260319-013',
    qrCodeValue: 'QR-CPO-20260319-E',
    currentStage: '已入仓待交接',
    currentActionHint: '已入 B 区，下一步确认后道交接去向。',
    nextRecommendedAction: '交接扫码',
    riskFlags: ['待交接'],
    riskTips: ['裁片已入仓，待后道交接确认'],
    receiveSummary: '领料成功',
    executionSummary: '裁片完成并已入仓',
    handoverSummary: '待交接扫码',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '裁片完成',
    currentInboundStatus: '已入仓',
    currentHandoverStatus: '待交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-21 09:00:00',
    latestReceiveBy: 'Aldi',
    latestPickupRecordNo: 'PK-CPO-20260319-E-001',
    latestPickupScanAt: '2026-03-21 09:00:00',
    latestPickupOperatorName: 'Aldi',
    configuredQtyText: '卷数 6 卷 / 长度 240 米',
    actualReceivedQtyText: '卷数 6 卷 / 长度 240 米',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '唛架已维护，裁片完成',
    hasMarkerImage: true,
    latestSpreadingAt: '2026-03-21 14:30:00',
    latestSpreadingBy: 'Aldi',
    latestSpreadingRecordNo: 'SPR-CPO-20260319-E-001',
    inboundZoneLabel: 'B 区',
    inboundLocationLabel: 'B-03 常规位',
    latestInboundAt: '2026-03-22 08:35:00',
    latestInboundBy: 'Bagus',
    latestInboundRecordNo: 'INB-CPO-20260319-E-001',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '后道车缝',
    replenishmentRiskSummary: '当前无补料反馈',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'INBOUND',
        actionTypeLabel: '入仓扫码',
        operatedBy: 'Bagus',
        operatedAt: '2026-03-22 08:35:00',
        summary: '已入 B 区，位置 B-03 常规位。',
      },
      {
        actionType: 'SPREADING',
        actionTypeLabel: '铺布录入',
        operatedBy: 'Aldi',
        operatedAt: '2026-03-21 14:30:00',
        summary: '已完成首轮铺布并形成裁片。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-E-001',
        scannedAt: '2026-03-21 09:00:00',
        operatorName: 'Aldi',
        resultLabel: '扫码领取成功',
        note: '当前无差异',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [
      {
        id: 'SPR-CPO-20260319-E-001',
        fabricRollNo: 'ROLL-LINING-001',
        layerCount: 18,
        actualLength: 42,
        headLength: 0.3,
        tailLength: 0.3,
        calculatedLength: 42.6,
        enteredBy: 'Aldi',
        enteredAt: '2026-03-21 14:30:00',
        sourceType: 'PDA',
        note: '里布铺布完成',
      },
    ],
    inboundRecords: [
      {
        id: 'INB-CPO-20260319-E-001',
        scannedAt: '2026-03-22 08:35:00',
        operatorName: 'Bagus',
        zoneCode: 'B',
        locationLabel: 'B-03 常规位',
        note: '待交接至后道车缝',
      },
    ],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000092': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000092',
    taskNo: 'TASK-CUT-000092',
    productionOrderNo: 'PO-20260319-016',
    cutPieceOrderNo: 'CPO-20260319-F',
    orderQty: 410,
    taskStatusLabel: '待补料反馈',
    currentOwnerName: 'Rangga',
    materialSku: 'FAB-SKU-SOLID-021',
    materialTypeLabel: '净色面料',
    pickupSlipNo: 'PS-20260319-014',
    qrCodeValue: 'QR-CPO-20260319-F',
    currentStage: '待补料反馈',
    currentActionHint: '现场已发现长度缺口，请先提交补料反馈并附凭证。',
    nextRecommendedAction: '补料反馈',
    riskFlags: ['补料风险', '待反馈'],
    riskTips: ['铺布余量不足，待反馈补料说明', '补料处理前不建议继续入仓'],
    receiveSummary: '领料成功',
    executionSummary: '铺布完成，存在补料风险',
    handoverSummary: '未入仓',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '铺布完成待判断',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-21 08:10:00',
    latestReceiveBy: 'Rangga',
    latestPickupRecordNo: 'PK-CPO-20260319-F-001',
    latestPickupScanAt: '2026-03-21 08:10:00',
    latestPickupOperatorName: 'Rangga',
    configuredQtyText: '卷数 9 卷 / 长度 345 米',
    actualReceivedQtyText: '卷数 9 卷 / 长度 345 米',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '唛架已维护，待补料反馈确认',
    hasMarkerImage: true,
    latestSpreadingAt: '2026-03-22 08:20:00',
    latestSpreadingBy: 'Rangga',
    latestSpreadingRecordNo: 'SPR-CPO-20260319-F-001',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待补料确认后入仓',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待补料确认后确定',
    replenishmentRiskSummary: '待提交补料反馈',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'SPREADING',
        actionTypeLabel: '铺布录入',
        operatedBy: 'Rangga',
        operatedAt: '2026-03-22 08:20:00',
        summary: '铺布后预计存在缺口，待提交补料反馈。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-F-001',
        scannedAt: '2026-03-21 08:10:00',
        operatorName: 'Rangga',
        resultLabel: '扫码领取成功',
        note: '当前无差异',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [
      {
        id: 'SPR-CPO-20260319-F-001',
        fabricRollNo: 'ROLL-SOLID-041',
        layerCount: 20,
        actualLength: 58,
        headLength: 0.4,
        tailLength: 0.5,
        calculatedLength: 58.9,
        enteredBy: 'Rangga',
        enteredAt: '2026-03-22 08:20:00',
        sourceType: 'PDA',
        note: '铺布后发现余量偏紧',
      },
    ],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000093': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000093',
    taskNo: 'TASK-CUT-000093',
    productionOrderNo: 'PO-20260319-017',
    cutPieceOrderNo: 'CPO-20260319-G',
    orderQty: 260,
    taskStatusLabel: '生产暂停',
    currentOwnerName: 'Yusuf',
    materialSku: 'FAB-SKU-PRINT-017',
    materialTypeLabel: '印花面料',
    pickupSlipNo: 'PS-20260319-015',
    qrCodeValue: 'QR-CPO-20260319-G',
    currentStage: '生产暂停',
    currentActionHint: '当前因设备异常暂停，待设备恢复后继续裁片。',
    nextRecommendedAction: '查看暂停说明',
    riskFlags: ['生产暂停', '设备异常', '交期风险'],
    riskTips: ['主裁床检修中，待设备恢复', '若中午前未恢复需调整排期'],
    receiveSummary: '领料成功',
    executionSummary: '设备问题暂停',
    handoverSummary: '未入仓',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '生产暂停',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-21 08:35:00',
    latestReceiveBy: 'Yusuf',
    latestPickupRecordNo: 'PK-CPO-20260319-G-001',
    latestPickupScanAt: '2026-03-21 08:35:00',
    latestPickupOperatorName: 'Yusuf',
    configuredQtyText: '卷数 7 卷 / 长度 210 米',
    actualReceivedQtyText: '卷数 7 卷 / 长度 210 米',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '唛架已维护，执行中断',
    hasMarkerImage: true,
    latestSpreadingAt: '2026-03-22 08:10:00',
    latestSpreadingBy: 'Yusuf',
    latestSpreadingRecordNo: 'SPR-CPO-20260319-G-001',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待设备恢复后再入仓',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待设备恢复后确定',
    replenishmentRiskSummary: '暂停中，暂不触发补料',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'SPREADING',
        actionTypeLabel: '铺布录入',
        operatedBy: 'Yusuf',
        operatedAt: '2026-03-22 08:10:00',
        summary: '首卷铺布后因设备异常暂停。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-G-001',
        scannedAt: '2026-03-21 08:35:00',
        operatorName: 'Yusuf',
        resultLabel: '扫码领取成功',
        note: '当前无差异',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [
      {
        id: 'SPR-CPO-20260319-G-001',
        fabricRollNo: 'ROLL-PRINT-031',
        layerCount: 16,
        actualLength: 39,
        headLength: 0.4,
        tailLength: 0.4,
        calculatedLength: 39.8,
        enteredBy: 'Yusuf',
        enteredAt: '2026-03-22 08:10:00',
        sourceType: 'PDA',
        note: '设备异常前完成首卷',
      },
    ],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000094': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000094',
    taskNo: 'TASK-CUT-000094',
    productionOrderNo: 'PO-20260319-018',
    cutPieceOrderNo: 'CPO-20260319-H',
    orderQty: 240,
    taskStatusLabel: '已完成',
    currentOwnerName: 'Gilang',
    materialSku: 'FAB-SKU-DYE-009',
    materialTypeLabel: '染色面料',
    pickupSlipNo: 'PS-20260319-016',
    qrCodeValue: 'QR-CPO-20260319-H',
    currentStage: '已完成交接',
    currentActionHint: '当前任务已收口，可回看历史动作与交接记录。',
    nextRecommendedAction: '查看历史摘要',
    riskFlags: [],
    riskTips: ['当前任务已完成全部现场动作'],
    receiveSummary: '领料成功',
    executionSummary: '裁片执行完成',
    handoverSummary: '已完成交接',
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '裁片完成',
    currentInboundStatus: '已入仓',
    currentHandoverStatus: '已交接',
    scanResultLabel: '扫码领取成功',
    latestReceiveAt: '2026-03-21 07:50:00',
    latestReceiveBy: 'Gilang',
    latestPickupRecordNo: 'PK-CPO-20260319-H-001',
    latestPickupScanAt: '2026-03-21 07:50:00',
    latestPickupOperatorName: 'Gilang',
    configuredQtyText: '卷数 5 卷 / 长度 188 米',
    actualReceivedQtyText: '卷数 5 卷 / 长度 188 米',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '唛架已维护并归档',
    hasMarkerImage: true,
    latestSpreadingAt: '2026-03-21 13:20:00',
    latestSpreadingBy: 'Gilang',
    latestSpreadingRecordNo: 'SPR-CPO-20260319-H-001',
    inboundZoneLabel: 'A 区',
    inboundLocationLabel: 'A-01 快速交接位',
    latestInboundAt: '2026-03-22 09:10:00',
    latestInboundBy: 'Bagus',
    latestInboundRecordNo: 'INB-CPO-20260319-H-001',
    latestHandoverAt: '2026-03-22 10:30:00',
    latestHandoverBy: 'Bagus',
    latestHandoverRecordNo: 'HO-CPO-20260319-H-001',
    handoverTargetLabel: '后道车缝',
    replenishmentRiskSummary: '未触发补料',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'HANDOVER',
        actionTypeLabel: '交接扫码',
        operatedBy: 'Bagus',
        operatedAt: '2026-03-22 10:30:00',
        summary: '已交接至后道车缝。',
      },
      {
        actionType: 'INBOUND',
        actionTypeLabel: '入仓扫码',
        operatedBy: 'Bagus',
        operatedAt: '2026-03-22 09:10:00',
        summary: '已入 A 区快速交接位。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-H-001',
        scannedAt: '2026-03-21 07:50:00',
        operatorName: 'Gilang',
        resultLabel: '扫码领取成功',
        note: '当前无差异',
        photoProofCount: 0,
      },
    ],
    spreadingRecords: [
      {
        id: 'SPR-CPO-20260319-H-001',
        fabricRollNo: 'ROLL-DYE-009',
        layerCount: 14,
        actualLength: 36,
        headLength: 0.3,
        tailLength: 0.3,
        calculatedLength: 36.6,
        enteredBy: 'Gilang',
        enteredAt: '2026-03-21 13:20:00',
        sourceType: 'PDA',
        note: '单卷铺布完成',
      },
    ],
    inboundRecords: [
      {
        id: 'INB-CPO-20260319-H-001',
        scannedAt: '2026-03-22 09:10:00',
        operatorName: 'Bagus',
        zoneCode: 'A',
        locationLabel: 'A-01 快速交接位',
        note: '待立即交接后道',
      },
    ],
    handoverRecords: [
      {
        id: 'HO-CPO-20260319-H-001',
        handoverAt: '2026-03-22 10:30:00',
        operatorName: 'Bagus',
        targetLabel: '后道车缝',
        resultLabel: '交接扫码确认完成',
        note: '已由后道组长签收',
      },
    ],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000095': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000095',
    taskNo: 'TASK-CUT-000095',
    productionOrderNo: 'PO-20260319-019',
    cutPieceOrderNo: 'CPO-20260319-I',
    orderQty: 670,
    taskStatusLabel: '高风险待复核',
    currentOwnerName: 'Dian',
    materialSku: 'FAB-SKU-PRINT-021',
    materialTypeLabel: '印花面料',
    pickupSlipNo: 'PS-20260319-017',
    qrCodeValue: 'QR-CPO-20260319-I',
    currentStage: '领料差异待复核',
    currentActionHint: '已带照片提交差异，需先完成复核再继续执行。',
    nextRecommendedAction: '查看扫码领料',
    riskFlags: ['高风险', '领料差异', '待复核'],
    riskTips: ['当前实领与配置不一致', '已提交照片凭证，等待 PCS / 平台复核'],
    receiveSummary: '领料差异待复核',
    executionSummary: '待复核完成后恢复执行',
    handoverSummary: '未开始',
    currentReceiveStatus: '带照片提交',
    currentExecutionStatus: '待复核',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '带照片提交',
    latestReceiveAt: '2026-03-22 08:45:00',
    latestReceiveBy: 'Dian',
    latestPickupRecordNo: 'PK-CPO-20260319-I-002',
    latestPickupScanAt: '2026-03-22 08:45:00',
    latestPickupOperatorName: 'Dian',
    configuredQtyText: '卷数 16 卷 / 长度 612 米',
    actualReceivedQtyText: '卷数 15 卷 / 长度 589 米',
    discrepancyNote: '少 1 卷印花面料，已上传现场照片待仓库复核。',
    photoProofCount: 3,
    markerSummary: '唛架待再次确认',
    hasMarkerImage: true,
    latestSpreadingAt: '-',
    latestSpreadingBy: '-',
    latestSpreadingRecordNo: '-',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待复核后确定',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待复核后确定',
    replenishmentRiskSummary: '差异未复核前不建议补料',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: 'Dian',
        operatedAt: '2026-03-22 08:45:00',
        summary: '少 1 卷印花面料，已带照片提交差异。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-I-001',
        scannedAt: '2026-03-22 08:30:00',
        operatorName: 'Dian',
        resultLabel: '驳回核对',
        note: '现场数量与系统配置不一致，先发起核对。',
        photoProofCount: 0,
      },
      {
        id: 'PK-CPO-20260319-I-002',
        scannedAt: '2026-03-22 08:45:00',
        operatorName: 'Dian',
        resultLabel: '带照片提交',
        note: '少 1 卷印花面料，已上传现场照片待仓库复核。',
        photoProofCount: 3,
      },
    ],
    spreadingRecords: [],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000096': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000096',
    taskNo: 'TASK-CUT-000096',
    productionOrderNo: 'PO-20260319-020',
    cutPieceOrderNo: 'CPO-20260319-J',
    orderQty: 350,
    taskStatusLabel: '多次复核中',
    currentOwnerName: 'Hadi',
    materialSku: 'FAB-SKU-SOLID-033',
    materialTypeLabel: '净色面料',
    pickupSlipNo: 'PS-20260319-018',
    qrCodeValue: 'QR-CPO-20260319-J',
    currentStage: '多次复核待处理',
    currentActionHint: '该裁片单已连续两次复核，平台和 PCS 都需重点关注。',
    nextRecommendedAction: '查看扫码领料',
    riskFlags: ['多次复核', '待处理'],
    riskTips: ['当前裁片单两次复核未关闭', '建议优先确认差异原因与凭证'],
    receiveSummary: '多次复核中',
    executionSummary: '待完成领料复核后开工',
    handoverSummary: '未开始',
    currentReceiveStatus: '驳回核对',
    currentExecutionStatus: '待复核',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    scanResultLabel: '驳回核对',
    latestReceiveAt: '2026-03-22 09:10:00',
    latestReceiveBy: 'Hadi',
    latestPickupRecordNo: 'PK-CPO-20260319-J-002',
    latestPickupScanAt: '2026-03-22 09:10:00',
    latestPickupOperatorName: 'Hadi',
    configuredQtyText: '卷数 11 卷 / 长度 402 米',
    actualReceivedQtyText: '卷数 10 卷 / 长度 370 米',
    discrepancyNote: '第二次复核仍未通过，待仓库与现场共同复点。',
    photoProofCount: 1,
    markerSummary: '待复核完成后维护唛架',
    hasMarkerImage: false,
    latestSpreadingAt: '-',
    latestSpreadingBy: '-',
    latestSpreadingRecordNo: '-',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待复核后确定',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待复核后确定',
    replenishmentRiskSummary: '当前无补料反馈',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: 'Hadi',
        operatedAt: '2026-03-22 09:10:00',
        summary: '第二次驳回核对，待仓库与现场共同复点。',
      },
    ],
    pickupLogs: [
      {
        id: 'PK-CPO-20260319-J-001',
        scannedAt: '2026-03-22 08:40:00',
        operatorName: 'Hadi',
        resultLabel: '驳回核对',
        note: '第一次数量不一致，待复点。',
        photoProofCount: 0,
      },
      {
        id: 'PK-CPO-20260319-J-002',
        scannedAt: '2026-03-22 09:10:00',
        operatorName: 'Hadi',
        resultLabel: '驳回核对',
        note: '第二次复核仍未通过，待仓库与现场共同复点。',
        photoProofCount: 1,
      },
    ],
    spreadingRecords: [],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000097': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000097',
    taskNo: 'TASK-CUT-000097',
    productionOrderNo: 'PO-20260319-021',
    cutPieceOrderNo: 'CPO-20260319-K',
    orderQty: 290,
    taskStatusLabel: '待接单',
    currentOwnerName: '待工厂确认',
    materialSku: 'FAB-SKU-LINING-007',
    materialTypeLabel: '里布',
    pickupSlipNo: 'PS-20260319-019',
    qrCodeValue: 'QR-CPO-20260319-K',
    currentStage: '待工厂确认接单',
    currentActionHint: '平台已派单，待工厂确认接单后进入领料。',
    nextRecommendedAction: '确认接单',
    riskFlags: ['待接单'],
    riskTips: ['当前任务尚未确认接单，不建议提前进入执行'],
    receiveSummary: '待工厂确认',
    executionSummary: '尚未进入执行',
    handoverSummary: '未开始',
    currentReceiveStatus: '待接单',
    currentExecutionStatus: '未开始',
    currentInboundStatus: '未开始',
    currentHandoverStatus: '未开始',
    scanResultLabel: '待扫码领取',
    latestReceiveAt: '2026-03-22 09:20:00',
    latestReceiveBy: '平台调度',
    latestPickupRecordNo: '-',
    latestPickupScanAt: '2026-03-22 09:20:00',
    latestPickupOperatorName: '待接单',
    configuredQtyText: '卷数 6 卷 / 长度 225 米',
    actualReceivedQtyText: '待扫码回写',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '待接单后维护唛架',
    hasMarkerImage: false,
    latestSpreadingAt: '-',
    latestSpreadingBy: '-',
    latestSpreadingRecordNo: '-',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待接单后确认',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待接单后确定',
    replenishmentRiskSummary: '当前无补料反馈',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: '平台调度',
        operatedAt: '2026-03-22 09:20:00',
        summary: '裁片急单已派发，待工厂确认接单。',
      },
    ],
    pickupLogs: [],
    spreadingRecords: [],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
  'TASK-CUT-000098': {
    ...CUTTING_DETAIL_SHARED,
    taskId: 'TASK-CUT-000098',
    taskNo: 'TASK-CUT-000098',
    productionOrderNo: 'PO-20260319-022',
    cutPieceOrderNo: 'CPO-20260319-L',
    orderQty: 470,
    taskStatusLabel: '已中标待接单',
    currentOwnerName: '待工厂确认',
    materialSku: 'FAB-SKU-PRINT-031',
    materialTypeLabel: '印花面料',
    pickupSlipNo: 'PS-20260319-020',
    qrCodeValue: 'QR-CPO-20260319-L',
    currentStage: '已中标待接单',
    currentActionHint: '该裁片任务已中标，待工厂确认接单后进入领料。',
    nextRecommendedAction: '确认接单',
    riskFlags: ['待接单'],
    riskTips: ['中标后仍需工厂确认接单与排期'],
    receiveSummary: '待工厂确认',
    executionSummary: '待接单后进入领料',
    handoverSummary: '未开始',
    currentReceiveStatus: '待接单',
    currentExecutionStatus: '未开始',
    currentInboundStatus: '未开始',
    currentHandoverStatus: '未开始',
    scanResultLabel: '待扫码领取',
    latestReceiveAt: '2026-03-22 08:35:00',
    latestReceiveBy: '平台调度',
    latestPickupRecordNo: '-',
    latestPickupScanAt: '2026-03-22 08:35:00',
    latestPickupOperatorName: '待接单',
    configuredQtyText: '卷数 13 卷 / 长度 502 米',
    actualReceivedQtyText: '待扫码回写',
    discrepancyNote: '当前无差异',
    photoProofCount: 0,
    markerSummary: '待接单后维护唛架',
    hasMarkerImage: false,
    latestSpreadingAt: '-',
    latestSpreadingBy: '-',
    latestSpreadingRecordNo: '-',
    inboundZoneLabel: '未分配',
    inboundLocationLabel: '待接单后确认',
    latestInboundAt: '-',
    latestInboundBy: '-',
    latestInboundRecordNo: '-',
    latestHandoverAt: '-',
    latestHandoverBy: '-',
    latestHandoverRecordNo: '-',
    handoverTargetLabel: '待接单后确定',
    replenishmentRiskSummary: '当前无补料反馈',
    latestReplenishmentFeedbackAt: '-',
    latestReplenishmentFeedbackBy: '-',
    latestReplenishmentFeedbackRecordNo: '-',
    latestFeedbackAt: '-',
    latestFeedbackBy: '-',
    latestFeedbackReason: '-',
    latestFeedbackNote: '-',
    recentActions: [
      {
        actionType: 'PICKUP',
        actionTypeLabel: '扫码领取',
        operatedBy: '平台调度',
        operatedAt: '2026-03-22 08:35:00',
        summary: '裁片中标任务已通知工厂确认接单。',
      },
    ],
    pickupLogs: [],
    spreadingRecords: [],
    inboundRecords: [],
    handoverRecords: [],
    replenishmentFeedbacks: [],
  },
}

function detectOrderLineException(detail: Pick<
  PdaCuttingTaskDetailSeed,
  | 'taskStatusLabel'
  | 'currentReceiveStatus'
  | 'currentExecutionStatus'
  | 'currentInboundStatus'
  | 'currentHandoverStatus'
  | 'replenishmentRiskSummary'
  | 'riskFlags'
>): boolean {
  return (
    detail.taskStatusLabel.includes('风险') ||
    detail.taskStatusLabel.includes('暂停') ||
    detail.taskStatusLabel.includes('复核') ||
    detail.currentReceiveStatus.includes('复核') ||
    detail.currentExecutionStatus.includes('暂停') ||
    detail.currentExecutionStatus.includes('复核') ||
    detail.currentInboundStatus.includes('异常') ||
    detail.currentHandoverStatus.includes('异常') ||
    detail.replenishmentRiskSummary.includes('风险') ||
    detail.riskFlags.some((flag) => flag.includes('风险') || flag.includes('异常') || flag.includes('复核'))
  )
}

function buildTaskOrderLineFromDetail(
  detail: PdaCuttingTaskDetailSeed,
  overrides: Partial<PdaCuttingTaskOrderLine> = {},
): PdaCuttingTaskOrderLine {
  return {
    cutPieceOrderId: overrides.cutPieceOrderId ?? detail.cutPieceOrderNo,
    cutPieceOrderNo: overrides.cutPieceOrderNo ?? detail.cutPieceOrderNo,
    materialSku: overrides.materialSku ?? detail.materialSku,
    materialTypeLabel: overrides.materialTypeLabel ?? detail.materialTypeLabel,
    colorLabel: overrides.colorLabel,
    plannedQty: overrides.plannedQty ?? detail.orderQty,
    currentReceiveStatus: overrides.currentReceiveStatus ?? detail.currentReceiveStatus,
    currentExecutionStatus: overrides.currentExecutionStatus ?? detail.currentExecutionStatus,
    currentInboundStatus: overrides.currentInboundStatus ?? detail.currentInboundStatus,
    currentHandoverStatus: overrides.currentHandoverStatus ?? detail.currentHandoverStatus,
    replenishmentRiskLabel: overrides.replenishmentRiskLabel ?? detail.replenishmentRiskSummary,
    currentStateLabel: overrides.currentStateLabel ?? detail.taskStatusLabel,
    nextActionLabel: overrides.nextActionLabel ?? detail.nextRecommendedAction,
    qrCodeValue: overrides.qrCodeValue ?? detail.qrCodeValue,
    pickupSlipNo: overrides.pickupSlipNo ?? detail.pickupSlipNo,
    isDone:
      overrides.isDone ??
      (detail.taskStatusLabel === '已完成' || detail.currentHandoverStatus.includes('已交接')),
    hasException: overrides.hasException ?? detectOrderLineException(detail),
    sortOrder: overrides.sortOrder ?? 1,
  }
}

function cloneTaskOrderLine(line: PdaCuttingTaskOrderLine): PdaCuttingTaskOrderLine {
  return { ...line }
}

function getSortedTaskOrderLines(lines: PdaCuttingTaskOrderLine[]): PdaCuttingTaskOrderLine[] {
  return [...lines].sort((left, right) => left.sortOrder - right.sortOrder).map(cloneTaskOrderLine)
}

function includesAny(value: string | undefined, keywords: string[]): boolean {
  if (!value) return false
  return keywords.some((keyword) => value.includes(keyword))
}

function hasPendingReplenishment(line: PdaCuttingTaskOrderLine): boolean {
  return (
    Boolean(line.replenishmentRiskLabel)
    && !includesAny(line.replenishmentRiskLabel, ['当前无', '无补料', '暂无补料', '无需补料'])
  )
}

function hasTaskOrderLineStarted(line: PdaCuttingTaskOrderLine): boolean {
  if (line.isDone) return true
  if (line.hasException) return true
  if (includesAny(line.currentReceiveStatus, ['领取成功', '领料成功', '已领取', '已回执'])) return true
  if (includesAny(line.currentExecutionStatus, ['铺布', '已有'])) return true
  if (includesAny(line.currentInboundStatus, ['已入仓', '待交接'])) return true
  if (includesAny(line.currentHandoverStatus, ['待交接', '已交接'])) return true
  return false
}

function resolveTaskOrderPrimaryExecRouteKey(line: PdaCuttingTaskOrderLine): PdaCuttingRouteKey | null {
  if (!includesAny(line.currentReceiveStatus, ['领取成功', '领料成功', '已领取', '已回执'])) {
    return 'pickup'
  }

  if (includesAny(line.currentExecutionStatus, ['待铺布', '未开始铺布', '未开始', '待开始'])) {
    return 'spreading'
  }

  if (!includesAny(line.currentInboundStatus, ['已入仓'])) {
    return 'inbound'
  }

  if (!includesAny(line.currentHandoverStatus, ['已交接'])) {
    return 'handover'
  }

  if (hasPendingReplenishment(line)) {
    return 'replenishment-feedback'
  }

  if (includesAny(line.nextActionLabel, ['领料'])) return 'pickup'
  if (includesAny(line.nextActionLabel, ['铺布'])) return 'spreading'
  if (includesAny(line.nextActionLabel, ['入仓'])) return 'inbound'
  if (includesAny(line.nextActionLabel, ['交接'])) return 'handover'
  if (includesAny(line.nextActionLabel, ['补料'])) return 'replenishment-feedback'
  return null
}

function buildTaskProgressLabel(lines: PdaCuttingTaskOrderLine[]): string {
  const totalCount = lines.length
  const completedCount = lines.filter((item) => item.isDone).length
  if (!totalCount) return '暂无裁片单'
  if (completedCount === totalCount) return `全部完成 ${completedCount} / ${totalCount}`
  return `已完成 ${completedCount} / ${totalCount}`
}

function buildTaskNextActionLabel(lines: PdaCuttingTaskOrderLine[]): string {
  const prioritizedLine =
    lines.find((item) => item.hasException) ??
    lines.find((item) => !item.isDone) ??
    lines[0]
  return prioritizedLine?.nextActionLabel || '查看任务'
}

function buildTaskStateLabel(lines: PdaCuttingTaskOrderLine[]): string {
  if (!lines.length) return '待开始'
  if (lines.some((item) => item.hasException)) return '有异常'

  const completedCount = lines.filter((item) => item.isDone).length
  if (completedCount === lines.length) return '已完成'
  if (completedCount > 0) return '部分完成'
  if (lines.some((item) => hasTaskOrderLineStarted(item))) return '进行中'
  return '待开始'
}

export function buildPdaCuttingTaskRollup(lines: PdaCuttingTaskOrderLine[]): PdaCuttingTaskRollup {
  const cutPieceOrderCount = lines.length
  const completedCutPieceOrderCount = lines.filter((item) => item.isDone).length
  const pendingCutPieceOrderCount = cutPieceOrderCount - completedCutPieceOrderCount
  const exceptionCutPieceOrderCount = lines.filter((item) => item.hasException).length
  const prioritizedLine = resolvePrioritizedTaskOrderLine(lines)
  const defaultExecRouteKey = prioritizedLine ? resolveTaskOrderPrimaryExecRouteKey(prioritizedLine) : null

  return {
    cutPieceOrderCount,
    completedCutPieceOrderCount,
    pendingCutPieceOrderCount,
    exceptionCutPieceOrderCount,
    taskProgressLabel: buildTaskProgressLabel(lines),
    taskStateLabel: buildTaskStateLabel(lines),
    taskNextActionLabel: buildTaskNextActionLabel(lines),
    hasMultipleCutPieceOrders: cutPieceOrderCount > 1,
    defaultExecCutPieceOrderNo: prioritizedLine?.cutPieceOrderNo || '',
    taskReadyForDirectExec:
      cutPieceOrderCount === 1
      && Boolean(prioritizedLine)
      && Boolean(defaultExecRouteKey)
      && !Boolean(prioritizedLine?.isDone),
  }
}

function applySelectedTaskOrderLine(
  detail: PdaCuttingTaskDetailSeed,
  orderLine: PdaCuttingTaskOrderLine,
): PdaCuttingTaskDetailSeed {
  return {
    ...detail,
    cutPieceOrderNo: orderLine.cutPieceOrderNo,
    orderQty: orderLine.plannedQty,
    materialSku: orderLine.materialSku,
    materialTypeLabel: orderLine.materialTypeLabel,
    pickupSlipNo: orderLine.pickupSlipNo,
    qrCodeValue: orderLine.qrCodeValue,
    taskStatusLabel: orderLine.currentStateLabel,
    currentReceiveStatus: orderLine.currentReceiveStatus,
    currentExecutionStatus: orderLine.currentExecutionStatus,
    currentInboundStatus: orderLine.currentInboundStatus,
    currentHandoverStatus: orderLine.currentHandoverStatus,
    replenishmentRiskSummary: orderLine.replenishmentRiskLabel,
    nextRecommendedAction: orderLine.nextActionLabel,
    currentActionHint: `当前裁片单 ${orderLine.cutPieceOrderNo} 下一步：${orderLine.nextActionLabel}`,
  }
}

const cuttingTaskOrderLineStore: Record<string, PdaCuttingTaskOrderLine[]> = Object.fromEntries(
  Object.entries(cuttingDetailStore).map(([taskId, detail]) => [
    taskId,
    [buildTaskOrderLineFromDetail(detail)],
  ]),
)

cuttingTaskOrderLineStore['TASK-CUT-000087'] = getSortedTaskOrderLines([
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000087'], {
    colorLabel: '黑色',
    plannedQty: 220,
    sortOrder: 1,
  }),
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000087'], {
    cutPieceOrderId: 'CPO-20260319-A-02',
    cutPieceOrderNo: 'CPO-20260319-A-02',
    materialSku: 'FAB-SKU-PRINT-001-B',
    materialTypeLabel: '印花面料',
    colorLabel: '白色',
    plannedQty: 180,
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '待铺布录入',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    replenishmentRiskLabel: '当前无补料反馈',
    currentStateLabel: '待铺布',
    nextActionLabel: '铺布录入',
    qrCodeValue: 'QR-CPO-20260319-A-02',
    pickupSlipNo: 'PS-20260319-009-02',
    hasException: false,
    isDone: false,
    sortOrder: 2,
  }),
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000087'], {
    cutPieceOrderId: 'CPO-20260319-A-03',
    cutPieceOrderNo: 'CPO-20260319-A-03',
    materialSku: 'FAB-SKU-LINING-001',
    materialTypeLabel: '里布',
    colorLabel: '红色',
    plannedQty: 120,
    currentReceiveStatus: '待扫码领料',
    currentExecutionStatus: '未开始铺布',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    replenishmentRiskLabel: '当前无补料反馈',
    currentStateLabel: '待领料',
    nextActionLabel: '扫码领料',
    qrCodeValue: 'QR-CPO-20260319-A-03',
    pickupSlipNo: 'PS-20260319-009-03',
    hasException: false,
    isDone: false,
    sortOrder: 3,
  }),
])

cuttingTaskOrderLineStore['TASK-CUT-000088'] = getSortedTaskOrderLines([
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000088'], {
    colorLabel: '军绿',
    plannedQty: 200,
    sortOrder: 1,
  }),
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000088'], {
    cutPieceOrderId: 'CPO-20260319-B-02',
    cutPieceOrderNo: 'CPO-20260319-B-02',
    materialSku: 'FAB-SKU-SOLID-014-B',
    materialTypeLabel: '净色面料',
    colorLabel: '深灰',
    plannedQty: 160,
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '铺布完成待判断',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    replenishmentRiskLabel: '待提交补料反馈',
    currentStateLabel: '待补料反馈',
    nextActionLabel: '补料反馈',
    qrCodeValue: 'QR-CPO-20260319-B-02',
    pickupSlipNo: 'PS-20260319-010-02',
    hasException: true,
    isDone: false,
    sortOrder: 2,
  }),
])

cuttingTaskOrderLineStore['TASK-CUT-000092'] = getSortedTaskOrderLines([
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000092'], {
    colorLabel: '藏青',
    plannedQty: 230,
    sortOrder: 1,
  }),
  buildTaskOrderLineFromDetail(cuttingDetailStore['TASK-CUT-000092'], {
    cutPieceOrderId: 'CPO-20260319-F-02',
    cutPieceOrderNo: 'CPO-20260319-F-02',
    materialSku: 'FAB-SKU-SOLID-021-B',
    materialTypeLabel: '净色面料',
    colorLabel: '卡其',
    plannedQty: 180,
    currentReceiveStatus: '领料成功',
    currentExecutionStatus: '待铺布录入',
    currentInboundStatus: '未入仓',
    currentHandoverStatus: '未交接',
    replenishmentRiskLabel: '当前无补料反馈',
    currentStateLabel: '待铺布',
    nextActionLabel: '铺布录入',
    qrCodeValue: 'QR-CPO-20260319-F-02',
    pickupSlipNo: 'PS-20260319-014-02',
    hasException: false,
    isDone: false,
    sortOrder: 2,
  }),
])

function getTaskOrderLines(taskId: string): PdaCuttingTaskOrderLine[] {
  return getSortedTaskOrderLines(cuttingTaskOrderLineStore[taskId] ?? [])
}

function touchTaskOrderLine(
  taskId: string,
  cutPieceOrderNo: string,
  patch: Partial<PdaCuttingTaskOrderLine>,
): void {
  const lines = cuttingTaskOrderLineStore[taskId]
  if (!lines?.length) return
  const targetLine = lines.find((item) => item.cutPieceOrderNo === cutPieceOrderNo)
  if (!targetLine) return
  Object.assign(targetLine, patch)
}

function resolvePrioritizedTaskOrderLine(lines: PdaCuttingTaskOrderLine[], preferredCutPieceOrderNo?: string): PdaCuttingTaskOrderLine | null {
  return (
    (preferredCutPieceOrderNo ? lines.find((item) => item.cutPieceOrderNo === preferredCutPieceOrderNo) : null) ??
    lines.find((item) => item.hasException) ??
    lines.find((item) => !item.isDone) ??
    lines[0] ??
    null
  )
}

function filterRecordsByCutPieceOrderNo<T extends { cutPieceOrderNo?: string }>(
  records: T[],
  fallbackCutPieceOrderNo: string,
  selectedCutPieceOrderNo?: string | null,
): T[] {
  const normalized = records.map((record) => ({
    ...record,
    cutPieceOrderNo: record.cutPieceOrderNo || fallbackCutPieceOrderNo,
  }))

  if (!selectedCutPieceOrderNo) {
    return normalized
  }

  return normalized.filter((record) => record.cutPieceOrderNo === selectedCutPieceOrderNo)
}

function normalizeRecordCutPieceOrderNo<T extends { cutPieceOrderNo?: string }>(record: T | undefined, fallbackCutPieceOrderNo: string): (T & { cutPieceOrderNo: string }) | null {
  if (!record) return null
  return {
    ...record,
    cutPieceOrderNo: record.cutPieceOrderNo || fallbackCutPieceOrderNo,
  }
}

function deriveTaskOverallStage(lines: PdaCuttingTaskOrderLine[]): string {
  if (!lines.length) return '暂无裁片单'
  if (lines.some((item) => item.hasException)) return '异常待处理'
  if (lines.every((item) => item.isDone)) return '已全部完成'
  if (lines.some((item) => !item.isDone)) return '处理中'
  return '待确认'
}

function syncCuttingTaskAggregate(taskId: string, preferredCutPieceOrderNo?: string): void {
  const detail = cuttingDetailStore[taskId]
  const task = cuttingTaskStore.find((item) => item.taskId === taskId)
  if (!detail || !task) return

  const lines = getTaskOrderLines(taskId)
  if (!lines.length) return

  const rollup = buildPdaCuttingTaskRollup(lines)
  const activeLine = resolvePrioritizedTaskOrderLine(lines, preferredCutPieceOrderNo)
  if (!activeLine) return

  Object.assign(detail, applySelectedTaskOrderLine(detail, activeLine), {
    cutPieceOrderCount: rollup.cutPieceOrderCount,
    completedCutPieceOrderCount: rollup.completedCutPieceOrderCount,
    pendingCutPieceOrderCount: rollup.pendingCutPieceOrderCount,
    exceptionCutPieceOrderCount: rollup.exceptionCutPieceOrderCount,
    taskProgressLabel: rollup.taskProgressLabel,
    taskNextActionLabel: rollup.taskNextActionLabel,
    currentStage: rollup.taskStateLabel,
    currentActionHint: `当前裁片单 ${activeLine.cutPieceOrderNo} 下一步：${activeLine.nextActionLabel}`,
    nextRecommendedAction: activeLine.nextActionLabel,
  })

  Object.assign(task, {
    cutPieceOrderNo: rollup.defaultExecCutPieceOrderNo || task.cutPieceOrderNo,
    ...rollup,
  })

  task.summary = {
    ...task.summary,
    currentStage: rollup.taskStateLabel,
    materialSku: activeLine.materialSku,
    materialTypeLabel: activeLine.materialTypeLabel,
    pickupSlipNo: activeLine.pickupSlipNo,
    qrCodeValue: activeLine.qrCodeValue,
    receiveSummary: activeLine.currentReceiveStatus,
    executionSummary: activeLine.currentExecutionStatus,
    handoverSummary: activeLine.currentHandoverStatus,
  }
}

function compareTask(left: ProcessTask, right: ProcessTask): number {
  const leftTime = new Date((left.updatedAt || left.createdAt).replace(' ', 'T')).getTime()
  const rightTime = new Date((right.updatedAt || right.createdAt).replace(' ', 'T')).getTime()
  return rightTime - leftTime
}

function getLatestCuttingClaimDispute(taskId: string, cutPieceOrderNo?: string) {
  return (cutPieceOrderNo ? getLatestClaimDisputeByOriginalCutOrderNo(cutPieceOrderNo) : null) || getLatestClaimDisputeByTaskId(taskId)
}

function withClaimDisputeTaskSummary(task: PdaTaskFlowMock): PdaTaskFlowMock {
  if (!isCuttingSpecialTask(task)) return task
  const latestDispute = getLatestCuttingClaimDispute(task.taskId, task.cutPieceOrderNo)
  if (!latestDispute) return task

  return {
    ...task,
    summary: {
      ...task.summary,
      currentStage: latestDispute.status === 'COMPLETED' || latestDispute.status === 'REJECTED' ? '领料异议已处理' : '领料异议处理中',
      receiveSummary: buildClaimDisputeWritebackSummary(latestDispute),
    },
  }
}

function withCuttingTaskOrderMeta(task: PdaTaskFlowMock): PdaTaskFlowMock {
  if (!isCuttingSpecialTask(task)) return task
  const lines = getTaskOrderLines(task.taskId)
  const rollup = buildPdaCuttingTaskRollup(lines)

  return {
    ...task,
    cutPieceOrderNo: rollup.defaultExecCutPieceOrderNo || task.cutPieceOrderNo,
    ...rollup,
  }
}

export function listPdaTaskFlowTasks(): PdaTaskFlowMock[] {
  const baseTasks = listTaskChainTasks() as PdaTaskFlowMock[]
  return [...ordinaryTaskStore, ...cuttingTaskStore, ...baseTasks]
    .map((task) => withCuttingTaskOrderMeta(withClaimDisputeTaskSummary(task)))
    .sort(compareTask)
}

export function getPdaTaskFlowTaskById(taskId: string): PdaTaskFlowMock | null {
  const localTask = [...ordinaryTaskStore, ...cuttingTaskStore].find((task) => task.taskId === taskId)
  if (localTask) return withCuttingTaskOrderMeta(withClaimDisputeTaskSummary(localTask))
  const runtimeTask = (getTaskChainTaskById(taskId) as PdaTaskFlowMock | undefined) ?? null
  return runtimeTask ? withCuttingTaskOrderMeta(withClaimDisputeTaskSummary(runtimeTask)) : null
}

export function listPdaOrdinaryTaskMocks(): PdaTaskFlowMock[] {
  return ordinaryTaskStore
}

export function listPdaCuttingTaskMocks(): PdaTaskFlowMock[] {
  return cuttingTaskStore.map((task) => withCuttingTaskOrderMeta(task))
}

export function isCuttingSpecialTask(task: Partial<PdaTaskFlowMock> | null | undefined): boolean {
  if (!task) return false
  return task.taskType === 'CUTTING' || task.supportsCuttingSpecialActions === true || task.entryMode === 'CUTTING_SPECIAL'
}

export function getPdaCuttingTaskDetail(taskId: string, selectedCutPieceOrderNo?: string): PdaCuttingTaskDetailData | null {
  const seed = cuttingDetailStore[taskId] ?? null
  if (!seed) return null

  const lines = getTaskOrderLines(taskId)
  const defaultCutPieceOrderNo = seed.cutPieceOrderNo || lines[0]?.cutPieceOrderNo || ''
  const resolvedSelectedLine =
    selectedCutPieceOrderNo && lines.find((item) => item.cutPieceOrderNo === selectedCutPieceOrderNo)
      ? lines.find((item) => item.cutPieceOrderNo === selectedCutPieceOrderNo) ?? null
      : !selectedCutPieceOrderNo && lines.length === 1
        ? lines[0]
        : null
  const rollup = buildPdaCuttingTaskRollup(lines)
  const selectedDetailSeed = resolvedSelectedLine ? applySelectedTaskOrderLine(seed, resolvedSelectedLine) : seed
  const latestDispute = getLatestCuttingClaimDispute(taskId, resolvedSelectedLine?.cutPieceOrderNo || selectedDetailSeed.cutPieceOrderNo)
  const resolvedCutPieceOrderNo = resolvedSelectedLine?.cutPieceOrderNo ?? null
  const pickupLogs = filterRecordsByCutPieceOrderNo(selectedDetailSeed.pickupLogs, seed.cutPieceOrderNo, resolvedCutPieceOrderNo)
  const spreadingRecords = filterRecordsByCutPieceOrderNo(selectedDetailSeed.spreadingRecords, seed.cutPieceOrderNo, resolvedCutPieceOrderNo)
  const inboundRecords = filterRecordsByCutPieceOrderNo(selectedDetailSeed.inboundRecords, seed.cutPieceOrderNo, resolvedCutPieceOrderNo)
  const handoverRecords = filterRecordsByCutPieceOrderNo(selectedDetailSeed.handoverRecords, seed.cutPieceOrderNo, resolvedCutPieceOrderNo)
  const replenishmentFeedbacks = filterRecordsByCutPieceOrderNo(
    selectedDetailSeed.replenishmentFeedbacks,
    seed.cutPieceOrderNo,
    resolvedCutPieceOrderNo,
  )
  const latestPickupLog = normalizeRecordCutPieceOrderNo(pickupLogs[0], seed.cutPieceOrderNo)
  const latestSpreadingRecord = normalizeRecordCutPieceOrderNo(spreadingRecords[0], seed.cutPieceOrderNo)
  const latestInboundRecord = normalizeRecordCutPieceOrderNo(inboundRecords[0], seed.cutPieceOrderNo)
  const latestHandoverRecord = normalizeRecordCutPieceOrderNo(handoverRecords[0], seed.cutPieceOrderNo)
  const latestFeedbackRecord = normalizeRecordCutPieceOrderNo(replenishmentFeedbacks[0], seed.cutPieceOrderNo)
  const normalizedDetail: PdaCuttingTaskDetailData = {
    ...selectedDetailSeed,
    cutPieceOrderNo: selectedDetailSeed.cutPieceOrderNo || defaultCutPieceOrderNo,
    cutPieceOrders: lines,
    defaultCutPieceOrderNo,
    currentSelectedCutPieceOrderNo: resolvedCutPieceOrderNo,
    cutPieceOrderCount: rollup.cutPieceOrderCount,
    completedCutPieceOrderCount: rollup.completedCutPieceOrderCount,
    pendingCutPieceOrderCount: rollup.pendingCutPieceOrderCount,
    exceptionCutPieceOrderCount: rollup.exceptionCutPieceOrderCount,
    taskProgressLabel: rollup.taskProgressLabel,
    taskNextActionLabel: rollup.taskNextActionLabel,
    pickupLogs,
    spreadingRecords,
    inboundRecords,
    handoverRecords,
    replenishmentFeedbacks,
    latestPickupRecordNo: latestPickupLog?.id || selectedDetailSeed.latestPickupRecordNo,
    latestReceiveAt: latestPickupLog?.scannedAt || selectedDetailSeed.latestReceiveAt,
    latestReceiveBy: latestPickupLog?.operatorName || selectedDetailSeed.latestReceiveBy,
    latestPickupScanAt: latestPickupLog?.scannedAt || selectedDetailSeed.latestPickupScanAt,
    latestPickupOperatorName: latestPickupLog?.operatorName || selectedDetailSeed.latestPickupOperatorName,
    scanResultLabel: latestPickupLog?.resultLabel || selectedDetailSeed.scanResultLabel,
    latestSpreadingRecordNo: latestSpreadingRecord?.id || selectedDetailSeed.latestSpreadingRecordNo,
    latestSpreadingAt: latestSpreadingRecord?.enteredAt || selectedDetailSeed.latestSpreadingAt,
    latestSpreadingBy: latestSpreadingRecord?.enteredBy || selectedDetailSeed.latestSpreadingBy,
    latestInboundRecordNo: latestInboundRecord?.id || selectedDetailSeed.latestInboundRecordNo,
    latestInboundAt: latestInboundRecord?.scannedAt || selectedDetailSeed.latestInboundAt,
    latestInboundBy: latestInboundRecord?.operatorName || selectedDetailSeed.latestInboundBy,
    inboundZoneLabel: latestInboundRecord ? `${latestInboundRecord.zoneCode} 区` : selectedDetailSeed.inboundZoneLabel,
    inboundLocationLabel: latestInboundRecord?.locationLabel || selectedDetailSeed.inboundLocationLabel,
    latestHandoverRecordNo: latestHandoverRecord?.id || selectedDetailSeed.latestHandoverRecordNo,
    latestHandoverAt: latestHandoverRecord?.handoverAt || selectedDetailSeed.latestHandoverAt,
    latestHandoverBy: latestHandoverRecord?.operatorName || selectedDetailSeed.latestHandoverBy,
    handoverTargetLabel: latestHandoverRecord?.targetLabel || selectedDetailSeed.handoverTargetLabel,
    latestReplenishmentFeedbackRecordNo: latestFeedbackRecord?.id || selectedDetailSeed.latestReplenishmentFeedbackRecordNo,
    latestReplenishmentFeedbackAt: latestFeedbackRecord?.feedbackAt || selectedDetailSeed.latestReplenishmentFeedbackAt,
    latestReplenishmentFeedbackBy: latestFeedbackRecord?.operatorName || selectedDetailSeed.latestReplenishmentFeedbackBy,
    latestFeedbackAt: latestFeedbackRecord?.feedbackAt || selectedDetailSeed.latestFeedbackAt,
    latestFeedbackBy: latestFeedbackRecord?.operatorName || selectedDetailSeed.latestFeedbackBy,
    latestFeedbackReason: latestFeedbackRecord?.reasonLabel || selectedDetailSeed.latestFeedbackReason,
    latestFeedbackNote: latestFeedbackRecord?.note || selectedDetailSeed.latestFeedbackNote,
    photoProofCount: latestFeedbackRecord?.photoProofCount ?? selectedDetailSeed.photoProofCount,
  }

  if (!latestDispute) return normalizedDetail

  const handledSummary =
    latestDispute.status === 'COMPLETED' || latestDispute.status === 'REJECTED'
      ? `${getClaimDisputeStatusLabel(latestDispute.status)} · ${latestDispute.handleConclusion || '已处理'}`
      : `${getClaimDisputeStatusLabel(latestDispute.status)} · 待平台处理`

  return {
    ...normalizedDetail,
    currentReceiveStatus: handledSummary,
    receiveSummary: buildClaimDisputeWritebackSummary(latestDispute),
    actualReceivedQtyText: `长度 ${formatClaimQty(latestDispute.actualClaimQty)}`,
    discrepancyNote:
      latestDispute.handleConclusion
        ? `${latestDispute.disputeNote}；平台结果：${latestDispute.handleConclusion}`
        : latestDispute.disputeNote,
    photoProofCount: latestDispute.evidenceCount,
    currentActionHint:
      latestDispute.status === 'COMPLETED' || latestDispute.status === 'REJECTED'
        ? '当前领料异议已收到平台处理结果，请按处理结论继续执行。'
        : '当前存在领料数量异议，等待平台处理结果回写。',
    nextRecommendedAction:
      latestDispute.status === 'COMPLETED' || latestDispute.status === 'REJECTED'
        ? '查看处理结果'
        : '等待平台处理',
    riskFlags: Array.from(new Set([...normalizedDetail.riskFlags, '领料异议'])),
  }
}

export function buildPdaCuttingRoute(
  taskId: string,
  routeKey: PdaCuttingRouteKey,
  options: PdaCuttingRouteOptions = {},
): string {
  const basePath =
    routeKey === 'task'
      ? `/fcs/pda/cutting/task/${taskId}`
      : routeKey === 'pickup'
        ? `/fcs/pda/cutting/pickup/${taskId}`
        : routeKey === 'spreading'
          ? `/fcs/pda/cutting/spreading/${taskId}`
          : routeKey === 'inbound'
            ? `/fcs/pda/cutting/inbound/${taskId}`
            : routeKey === 'handover'
              ? `/fcs/pda/cutting/handover/${taskId}`
              : `/fcs/pda/cutting/replenishment-feedback/${taskId}`

  const params = new URLSearchParams()
  if (options.returnTo?.trim()) {
    params.set('returnTo', options.returnTo.trim())
  }
  if (options.cutPieceOrderNo?.trim()) {
    params.set('cutPieceOrderNo', options.cutPieceOrderNo.trim())
  }

  const queryString = params.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

function buildPdaCuttingTaskDetailPath(taskId: string, returnTo?: string): string {
  return buildPdaCuttingRoute(taskId, 'task', { returnTo })
}

function resolvePdaTaskDetailEntryPath(taskId: string, fallbackPath: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (isCuttingSpecialTask(task)) {
    return buildPdaCuttingTaskDetailPath(taskId, returnTo)
  }
  return fallbackPath
}

function buildPdaTaskReceiveDetailPath(taskId: string, returnTo?: string): string {
  if (!returnTo) {
    return `/fcs/pda/task-receive/${taskId}`
  }

  const params = new URLSearchParams()
  params.set('returnTo', returnTo)
  return `/fcs/pda/task-receive/${taskId}?${params.toString()}`
}

function resolvePdaCuttingExecPath(taskId: string, returnTo?: string): string {
  const lines = getTaskOrderLines(taskId)
  const rollup = buildPdaCuttingTaskRollup(lines)
  if (!rollup.taskReadyForDirectExec || !rollup.defaultExecCutPieceOrderNo) {
    return buildPdaCuttingTaskDetailPath(taskId, returnTo)
  }

  const activeLine = lines.find((item) => item.cutPieceOrderNo === rollup.defaultExecCutPieceOrderNo) ?? null
  const routeKey = activeLine ? resolveTaskOrderPrimaryExecRouteKey(activeLine) : null
  if (!routeKey || routeKey === 'task') {
    return buildPdaCuttingTaskDetailPath(taskId, returnTo)
  }

  return buildPdaCuttingRoute(taskId, routeKey, {
    cutPieceOrderNo: rollup.defaultExecCutPieceOrderNo,
    returnTo,
  })
}

export function resolvePdaTaskDetailPath(taskId: string, returnTo?: string): string {
  return resolvePdaTaskDetailEntryPath(taskId, buildPdaTaskReceiveDetailPath(taskId, returnTo), returnTo)
}

export function resolvePdaTaskExecPath(taskId: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (isCuttingSpecialTask(task)) {
    return resolvePdaCuttingExecPath(taskId, returnTo)
  }
  return `/fcs/pda/exec/${taskId}`
}

export function resolvePdaHandoverDetailPath(handoverId: string, returnTo?: string): string {
  const head = findPdaHandoverHead(handoverId)
  if (!head) {
    return `/fcs/pda/handover/${handoverId}`
  }
  return resolvePdaTaskDetailEntryPath(head.taskId, `/fcs/pda/handover/${handoverId}`, returnTo)
}

function touchCuttingTask(taskId: string, patch: Partial<PdaCuttingTaskDetailSeed>, logPatch?: Partial<PdaTaskSummary>): void {
  const detail = cuttingDetailStore[taskId]
  const task = cuttingTaskStore.find((item) => item.taskId === taskId)
  if (!detail || !task) return

  Object.assign(detail, patch)
  task.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)

  if (logPatch) {
    task.summary = {
      ...task.summary,
      ...logPatch,
    }
  }
}

function pushRecentAction(
  taskId: string,
  action: PdaCuttingRecentAction,
): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  detail.recentActions = [action, ...detail.recentActions].slice(0, 6)
}

export function submitCuttingPickupResult(taskId: string, payload: {
  operatorName: string
  resultLabel: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
}, cutPieceOrderNo?: string): void {
  const detail = cuttingDetailStore[taskId]
  const task = cuttingTaskStore.find((item) => item.taskId === taskId)
  if (!detail || !task) return
  const targetCutPieceOrderNo = cutPieceOrderNo || detail.cutPieceOrderNo

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.pickupLogs.unshift({
    cutPieceOrderNo: targetCutPieceOrderNo,
    id: createStableCuttingActionId(
      'PK',
      {
        cutPieceOrderNo: targetCutPieceOrderNo,
        taskNo: detail.taskNo,
        productionOrderNo: detail.productionOrderNo,
      },
      detail.pickupLogs.map((item) => item.id),
    ),
    scannedAt: now,
    operatorName: payload.operatorName,
    resultLabel: payload.resultLabel,
    note: payload.discrepancyNote,
    photoProofCount: payload.photoProofCount,
  })
  const latestRecord = detail.pickupLogs[0]

  const isSuccess = payload.resultLabel.includes('成功')
  touchTaskOrderLine(taskId, targetCutPieceOrderNo, {
    currentReceiveStatus: payload.resultLabel,
    currentStateLabel: isSuccess ? '待铺布' : '领料差异待处理',
    currentExecutionStatus: isSuccess ? '待铺布录入' : '待复核',
    nextActionLabel: isSuccess ? '铺布录入' : '查看领料差异',
    hasException: !isSuccess,
    isDone: false,
  })
  touchCuttingTask(
    taskId,
    {
      currentStage: isSuccess ? '待铺布录入' : detail.currentStage,
      currentReceiveStatus: payload.resultLabel,
      scanResultLabel: payload.resultLabel,
      actualReceivedQtyText: payload.actualReceivedQtyText,
      discrepancyNote: payload.discrepancyNote,
      photoProofCount: payload.photoProofCount,
      latestPickupRecordNo: latestRecord.id,
      latestReceiveAt: now,
      latestReceiveBy: payload.operatorName,
      latestPickupScanAt: now,
      latestPickupOperatorName: payload.operatorName,
      receiveSummary: isSuccess ? '扫码领料完成' : '领料差异待处理',
    },
    {
      currentStage: isSuccess ? '待铺布录入' : task.summary.currentStage,
      receiveSummary: isSuccess ? '扫码领料完成' : '领料差异待处理',
    },
  )

  if (isSuccess) {
    task.status = 'IN_PROGRESS'
    task.summary.executionSummary = '待开始铺布'
    detail.riskFlags = ['待铺布', '待入仓']
  }

  syncCuttingTaskAggregate(taskId, targetCutPieceOrderNo)

  pushRecentAction(taskId, {
    actionType: 'PICKUP',
    actionTypeLabel: '扫码领取',
    operatedBy: payload.operatorName,
    operatedAt: now,
    summary: payload.resultLabel === '扫码领取成功' ? payload.actualReceivedQtyText : `${payload.resultLabel}：${payload.discrepancyNote}`,
  })
}

export function addCuttingSpreadingRecord(taskId: string, payload: {
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  note: string
  enteredBy: string
}, cutPieceOrderNo?: string): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const targetCutPieceOrderNo = cutPieceOrderNo || detail.cutPieceOrderNo

  const calculatedLength = Number((payload.actualLength + payload.headLength + payload.tailLength).toFixed(1))
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.spreadingRecords.unshift({
    cutPieceOrderNo: targetCutPieceOrderNo,
    id: createStableCuttingActionId(
      'SPR',
      {
        cutPieceOrderNo: targetCutPieceOrderNo,
        taskNo: detail.taskNo,
        productionOrderNo: detail.productionOrderNo,
      },
      detail.spreadingRecords.map((item) => item.id),
    ),
    fabricRollNo: payload.fabricRollNo,
    layerCount: payload.layerCount,
    actualLength: payload.actualLength,
    headLength: payload.headLength,
    tailLength: payload.tailLength,
    calculatedLength,
    enteredBy: payload.enteredBy,
    enteredAt: now,
    sourceType: 'PCS',
    note: payload.note,
  })

  touchTaskOrderLine(taskId, targetCutPieceOrderNo, {
    currentExecutionStatus: `已有 ${detail.spreadingRecords.length} 条铺布记录`,
    currentStateLabel: '铺布执行中',
    nextActionLabel: '入仓扫码',
    hasException: false,
    isDone: false,
  })
  touchCuttingTask(
    taskId,
    {
      currentStage: '铺布录入已更新',
      currentExecutionStatus: `已有 ${detail.spreadingRecords.length} 条铺布记录`,
      latestSpreadingAt: now,
      latestSpreadingBy: payload.enteredBy,
      latestSpreadingRecordNo: detail.spreadingRecords[0].id,
      executionSummary: `已有 ${detail.spreadingRecords.length} 条铺布记录`,
    },
    {
      currentStage: '铺布录入已更新',
      executionSummary: `已有 ${detail.spreadingRecords.length} 条铺布记录`,
    },
  )

  detail.riskFlags = ['待入仓']

  syncCuttingTaskAggregate(taskId, targetCutPieceOrderNo)

  pushRecentAction(taskId, {
    actionType: 'SPREADING',
    actionTypeLabel: '铺布录入',
    operatedBy: payload.enteredBy,
    operatedAt: now,
    summary: `新增卷号 ${payload.fabricRollNo}，累计 ${detail.spreadingRecords.length} 条铺布记录。`,
  })
}

export function confirmCuttingInbound(taskId: string, payload: {
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}, cutPieceOrderNo?: string): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const targetCutPieceOrderNo = cutPieceOrderNo || detail.cutPieceOrderNo
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.inboundRecords.unshift({
    cutPieceOrderNo: targetCutPieceOrderNo,
    id: createStableCuttingActionId(
      'INB',
      {
        cutPieceOrderNo: targetCutPieceOrderNo,
        taskNo: detail.taskNo,
        productionOrderNo: detail.productionOrderNo,
      },
      detail.inboundRecords.map((item) => item.id),
    ),
    scannedAt: now,
    operatorName: payload.operatorName,
    zoneCode: payload.zoneCode,
    locationLabel: payload.locationLabel,
    note: payload.note,
  })

  touchTaskOrderLine(taskId, targetCutPieceOrderNo, {
    currentInboundStatus: '已入仓',
    currentStateLabel: '待交接',
    nextActionLabel: '交接扫码',
    hasException: false,
    isDone: false,
  })
  touchCuttingTask(
    taskId,
    {
      currentStage: '已入仓待交接',
      currentInboundStatus: '已入仓',
      inboundZoneLabel: `${payload.zoneCode} 区`,
      inboundLocationLabel: payload.locationLabel,
      latestInboundAt: now,
      latestInboundBy: payload.operatorName,
      latestInboundRecordNo: detail.inboundRecords[0].id,
      handoverSummary: '待交接扫码',
    },
    {
      currentStage: '已入仓待交接',
      handoverSummary: '待交接扫码',
    },
  )

  detail.riskFlags = ['待交接']

  syncCuttingTaskAggregate(taskId, targetCutPieceOrderNo)

  pushRecentAction(taskId, {
    actionType: 'INBOUND',
    actionTypeLabel: '入仓扫码',
    operatedBy: payload.operatorName,
    operatedAt: now,
    summary: `已入 ${payload.zoneCode} 区，位置 ${payload.locationLabel}。`,
  })
}

export function confirmCuttingHandover(taskId: string, payload: {
  operatorName: string
  targetLabel: string
  note: string
}, cutPieceOrderNo?: string): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const targetCutPieceOrderNo = cutPieceOrderNo || detail.cutPieceOrderNo
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.handoverRecords.unshift({
    cutPieceOrderNo: targetCutPieceOrderNo,
    id: createStableCuttingActionId(
      'HO',
      {
        cutPieceOrderNo: targetCutPieceOrderNo,
        taskNo: detail.taskNo,
        productionOrderNo: detail.productionOrderNo,
      },
      detail.handoverRecords.map((item) => item.id),
    ),
    handoverAt: now,
    operatorName: payload.operatorName,
    targetLabel: payload.targetLabel,
    resultLabel: '交接扫码确认完成',
    note: payload.note,
  })

  touchTaskOrderLine(taskId, targetCutPieceOrderNo, {
    currentHandoverStatus: '已交接',
    currentStateLabel: '已完成',
    nextActionLabel: '查看历史摘要',
    hasException: false,
    isDone: true,
  })
  touchCuttingTask(
    taskId,
    {
      currentStage: '已交接待后续跟进',
      currentHandoverStatus: '已交接',
      latestHandoverAt: now,
      latestHandoverBy: payload.operatorName,
      latestHandoverRecordNo: detail.handoverRecords[0].id,
      handoverTargetLabel: payload.targetLabel,
      handoverSummary: '交接扫码已完成',
    },
    {
      currentStage: '已交接待后续跟进',
      handoverSummary: '交接扫码已完成',
    },
  )

  detail.riskFlags = detail.replenishmentFeedbacks.length ? ['补料风险'] : []

  syncCuttingTaskAggregate(taskId, targetCutPieceOrderNo)

  pushRecentAction(taskId, {
    actionType: 'HANDOVER',
    actionTypeLabel: '交接扫码',
    operatedBy: payload.operatorName,
    operatedAt: now,
    summary: `已交接至 ${payload.targetLabel}。`,
  })
}

export function submitCuttingReplenishmentFeedback(taskId: string, payload: {
  operatorName: string
  reasonLabel: string
  note: string
  photoProofCount: number
}, cutPieceOrderNo?: string): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const targetCutPieceOrderNo = cutPieceOrderNo || detail.cutPieceOrderNo
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.replenishmentFeedbacks.unshift({
    cutPieceOrderNo: targetCutPieceOrderNo,
    id: createStableCuttingActionId(
      'FB',
      {
        cutPieceOrderNo: targetCutPieceOrderNo,
        taskNo: detail.taskNo,
        productionOrderNo: detail.productionOrderNo,
      },
      detail.replenishmentFeedbacks.map((item) => item.id),
    ),
    feedbackAt: now,
    operatorName: payload.operatorName,
    reasonLabel: payload.reasonLabel,
    note: payload.note,
    photoProofCount: payload.photoProofCount,
  })

  touchTaskOrderLine(taskId, targetCutPieceOrderNo, {
    replenishmentRiskLabel: `${payload.reasonLabel}，待 PCS 跟进`,
    currentStateLabel: '补料风险待关注',
    nextActionLabel: '补料反馈',
    hasException: true,
    isDone: false,
  })
  touchCuttingTask(
    taskId,
    {
      replenishmentRiskSummary: `${payload.reasonLabel}，待 PCS 跟进`,
      latestReplenishmentFeedbackAt: now,
      latestReplenishmentFeedbackBy: payload.operatorName,
      latestReplenishmentFeedbackRecordNo: detail.replenishmentFeedbacks[0].id,
      latestFeedbackAt: now,
      latestFeedbackBy: payload.operatorName,
      latestFeedbackReason: payload.reasonLabel,
      latestFeedbackNote: payload.note,
    },
  )

  detail.riskFlags = ['补料风险', '待 PCS 跟进']

  syncCuttingTaskAggregate(taskId, targetCutPieceOrderNo)

  pushRecentAction(taskId, {
    actionType: 'REPLENISHMENT',
    actionTypeLabel: '补料反馈',
    operatedBy: payload.operatorName,
    operatedAt: now,
    summary: `${payload.reasonLabel}，${payload.note}`,
  })
}
