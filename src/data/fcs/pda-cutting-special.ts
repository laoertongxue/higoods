import type { OwnerSuggestion } from './routing-templates'
import type { ProcessTask } from './process-tasks'
import { getTaskChainTaskById, listTaskChainTasks } from './page-adapters/task-chain-pages-adapter'
import { findPdaHandoverHead } from './pda-handover-events'

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
  summary: PdaTaskSummary
}

export interface PdaCuttingPickupLog {
  id: string
  scannedAt: string
  operatorName: string
  resultLabel: string
  note: string
  photoProofCount: number
}

export interface PdaCuttingSpreadingRecord {
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
  id: string
  scannedAt: string
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

export interface PdaCuttingHandoverRecord {
  id: string
  handoverAt: string
  operatorName: string
  targetLabel: string
  resultLabel: string
  note: string
}

export interface PdaCuttingReplenishmentFeedbackRecord {
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
}): PdaTaskFlowMock {
  return {
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
  }
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
  }),
]

const cuttingDetailStore: Record<string, PdaCuttingTaskDetailData> = {
  'TASK-CUT-000087': {
    taskId: 'TASK-CUT-000087',
    taskNo: 'TASK-CUT-000087',
    productionOrderNo: 'PO-20260319-011',
    cutPieceOrderNo: 'CPO-20260319-A',
    taskTypeLabel: '裁片任务',
    factoryTypeLabel: '裁片厂',
    assigneeFactoryName: DEFAULT_FACTORY_NAME,
    orderQty: 520,
    taskStatusLabel: '待领料',
    currentOwnerName: 'Dimas',
    materialSku: 'FAB-SKU-PRINT-001',
    materialTypeLabel: '印花面料',
    pickupSlipNo: 'PS-20260319-009',
    pickupSlipPrintStatusLabel: '已打印领料单',
    qrObjectLabel: '裁片单级二维码',
    discrepancyAllowed: true,
    hasQrCode: true,
    qrCodeValue: 'QR-CPO-20260319-A',
    qrVersionNote: '裁片单级二维码，后续重复领料与执行均复用此码',
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
    taskId: 'TASK-CUT-000088',
    taskNo: 'TASK-CUT-000088',
    productionOrderNo: 'PO-20260319-012',
    cutPieceOrderNo: 'CPO-20260319-B',
    taskTypeLabel: '裁片任务',
    factoryTypeLabel: '裁片厂',
    assigneeFactoryName: DEFAULT_FACTORY_NAME,
    orderQty: 360,
    taskStatusLabel: '铺布执行中',
    currentOwnerName: 'Rian',
    materialSku: 'FAB-SKU-SOLID-014',
    materialTypeLabel: '净色面料',
    pickupSlipNo: 'PS-20260319-010',
    pickupSlipPrintStatusLabel: '已打印领料单',
    qrObjectLabel: '裁片单级二维码',
    discrepancyAllowed: true,
    hasQrCode: true,
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
}

function compareTask(left: ProcessTask, right: ProcessTask): number {
  const leftTime = new Date((left.updatedAt || left.createdAt).replace(' ', 'T')).getTime()
  const rightTime = new Date((right.updatedAt || right.createdAt).replace(' ', 'T')).getTime()
  return rightTime - leftTime
}

export function listPdaTaskFlowTasks(): PdaTaskFlowMock[] {
  const baseTasks = listTaskChainTasks() as PdaTaskFlowMock[]
  return [...ordinaryTaskStore, ...cuttingTaskStore, ...baseTasks].sort(compareTask)
}

export function getPdaTaskFlowTaskById(taskId: string): PdaTaskFlowMock | null {
  const localTask = [...ordinaryTaskStore, ...cuttingTaskStore].find((task) => task.taskId === taskId)
  if (localTask) return localTask
  return (getTaskChainTaskById(taskId) as PdaTaskFlowMock | undefined) ?? null
}

export function listPdaOrdinaryTaskMocks(): PdaTaskFlowMock[] {
  return ordinaryTaskStore
}

export function listPdaCuttingTaskMocks(): PdaTaskFlowMock[] {
  return cuttingTaskStore
}

export function isCuttingSpecialTask(task: Partial<PdaTaskFlowMock> | null | undefined): boolean {
  if (!task) return false
  return task.taskType === 'CUTTING' || task.supportsCuttingSpecialActions === true || task.entryMode === 'CUTTING_SPECIAL'
}

export function getPdaCuttingTaskDetail(taskId: string): PdaCuttingTaskDetailData | null {
  return cuttingDetailStore[taskId] ?? null
}

export function buildPdaCuttingRoute(taskId: string, routeKey: PdaCuttingRouteKey): string {
  if (routeKey === 'task') return `/fcs/pda/cutting/task/${taskId}`
  if (routeKey === 'pickup') return `/fcs/pda/cutting/pickup/${taskId}`
  if (routeKey === 'spreading') return `/fcs/pda/cutting/spreading/${taskId}`
  if (routeKey === 'inbound') return `/fcs/pda/cutting/inbound/${taskId}`
  if (routeKey === 'handover') return `/fcs/pda/cutting/handover/${taskId}`
  return `/fcs/pda/cutting/replenishment-feedback/${taskId}`
}

function buildPdaCuttingTaskDetailPath(taskId: string, returnTo?: string): string {
  if (!returnTo) {
    return buildPdaCuttingRoute(taskId, 'task')
  }

  const params = new URLSearchParams()
  params.set('returnTo', returnTo)
  return `${buildPdaCuttingRoute(taskId, 'task')}?${params.toString()}`
}

function resolvePdaTaskDetailEntryPath(taskId: string, fallbackPath: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (isCuttingSpecialTask(task)) {
    return buildPdaCuttingTaskDetailPath(taskId, returnTo)
  }
  return fallbackPath
}

export function resolvePdaTaskDetailPath(taskId: string, returnTo?: string): string {
  return resolvePdaTaskDetailEntryPath(taskId, `/fcs/pda/task-receive/${taskId}`, returnTo)
}

export function resolvePdaTaskExecPath(taskId: string, returnTo?: string): string {
  return resolvePdaTaskDetailEntryPath(taskId, `/fcs/pda/exec/${taskId}`, returnTo)
}

export function resolvePdaHandoverDetailPath(handoverId: string, returnTo?: string): string {
  const head = findPdaHandoverHead(handoverId)
  if (!head) {
    return `/fcs/pda/handover/${handoverId}`
  }
  return resolvePdaTaskDetailEntryPath(head.taskId, `/fcs/pda/handover/${handoverId}`, returnTo)
}

function touchCuttingTask(taskId: string, patch: Partial<PdaCuttingTaskDetailData>, logPatch?: Partial<PdaTaskSummary>): void {
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
}): void {
  const detail = cuttingDetailStore[taskId]
  const task = cuttingTaskStore.find((item) => item.taskId === taskId)
  if (!detail || !task) return

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.pickupLogs.unshift({
    id: createStableCuttingActionId(
      'PK',
      {
        cutPieceOrderNo: detail.cutPieceOrderNo,
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
    detail.taskStatusLabel = '待铺布'
    detail.currentActionHint = '领料完成，下一步请录入铺布信息。'
    detail.nextRecommendedAction = '铺布录入'
    detail.riskFlags = ['待铺布', '待入仓']
  }

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
}): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return

  const calculatedLength = Number((payload.actualLength + payload.headLength + payload.tailLength).toFixed(1))
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.spreadingRecords.unshift({
    id: createStableCuttingActionId(
      'SPR',
      {
        cutPieceOrderNo: detail.cutPieceOrderNo,
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

  detail.taskStatusLabel = '铺布执行中'
  detail.currentActionHint = '铺布已开始，确认入仓区域后可继续入仓扫码。'
  detail.nextRecommendedAction = '入仓扫码'
  detail.riskFlags = ['待入仓']

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
}): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.inboundRecords.unshift({
    id: createStableCuttingActionId(
      'INB',
      {
        cutPieceOrderNo: detail.cutPieceOrderNo,
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

  detail.taskStatusLabel = '待交接'
  detail.currentActionHint = '已完成入仓，请确认交接去向并执行交接扫码。'
  detail.nextRecommendedAction = '交接扫码'
  detail.riskFlags = ['待交接']

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
}): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.handoverRecords.unshift({
    id: createStableCuttingActionId(
      'HO',
      {
        cutPieceOrderNo: detail.cutPieceOrderNo,
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

  detail.taskStatusLabel = '待后续确认'
  detail.currentActionHint = '交接已完成，如发现缺口可继续反馈补料风险。'
  detail.nextRecommendedAction = '补料反馈'
  detail.riskFlags = detail.replenishmentFeedbacks.length ? ['补料风险'] : []

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
}): void {
  const detail = cuttingDetailStore[taskId]
  if (!detail) return
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  detail.replenishmentFeedbacks.unshift({
    id: createStableCuttingActionId(
      'FB',
      {
        cutPieceOrderNo: detail.cutPieceOrderNo,
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

  detail.taskStatusLabel = '补料风险待关注'
  detail.currentActionHint = '补料风险已反馈，等待 PCS 侧跟进并返回专项页继续处理。'
  detail.nextRecommendedAction = '补料反馈'
  detail.riskFlags = ['补料风险', '待 PCS 跟进']

  pushRecentAction(taskId, {
    actionType: 'REPLENISHMENT',
    actionTypeLabel: '补料反馈',
    operatedBy: payload.operatorName,
    operatedAt: now,
    summary: `${payload.reasonLabel}，${payload.note}`,
  })
}
