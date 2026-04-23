import { indonesiaFactories } from './indonesia-factories.ts'
import type { OwnerSuggestion } from './routing-templates.ts'
import type {
  AcceptanceStatus,
  BlockReason,
  ProcessTask,
  TaskAssignmentStatus,
  TaskStatus,
} from './process-tasks.ts'
import type {
  PdaMobileAwardedTenderNoticeMock,
  PdaMobileBiddingTenderMock,
  PdaMobileQuotedTenderMock,
} from './pda-mobile-mock.ts'
import {
  PDA_MOBILE_PROCESS_DEFINITIONS,
  type PdaMobileProcessKey,
} from './pda-task-scenario-matrix.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { TEST_FACTORY_ID } from './factory-mock-data.ts'

export type PdaTaskMockOrigin =
  | 'DIRECT_PENDING'
  | 'DIRECT_REJECTED'
  | 'EXEC_NOT_STARTED'
  | 'EXEC_IN_PROGRESS'
  | 'EXEC_BLOCKED'
  | 'EXEC_DONE'
  | 'EXEC_CANCELLED'
  | 'BIDDING_PENDING'
  | 'BIDDING_QUOTED'
  | 'AWARDED_PENDING'
  | 'AWARDED_ACCEPTED_NOT_STARTED'
  | 'AWARDED_ACCEPTED_IN_PROGRESS'
  | 'AWARDED_ACCEPTED_BLOCKED'
  | 'AWARDED_ACCEPTED_DONE'
  | 'AWARDED_ACCEPTED_CANCELLED'
  | 'AWARDED_REJECTED'

export interface PdaGenericTaskMock extends ProcessTask {
  productionOrderNo: string
  spuCode: string
  spuName: string
  requiredDeliveryDate: string
  mockProcessKey: Exclude<PdaMobileProcessKey, 'CUTTING'>
  mockOrigin: PdaTaskMockOrigin
  mockReceiveSummary: string
  mockExecutionSummary: string
  mockHandoverSummary: string
  mockStartPrerequisiteMet?: boolean
  handoutStatus?: 'PENDING' | 'HANDED_OUT'
}

export interface PdaTaskMockHandoverHeadSeed {
  handoverId: string
  headType: 'PICKUP' | 'HANDOUT'
  taskId: string
  taskNo: string
  productionOrderNo: string
  processKey: Exclude<PdaMobileProcessKey, 'CUTTING'>
  processName: string
  sourceFactoryName: string
  targetName: string
  targetKind: 'WAREHOUSE' | 'FACTORY'
  receiverKind?: 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
  receiverId?: string
  receiverName?: string
  qtyUnit: string
  factoryId: string
  taskStatus: 'IN_PROGRESS' | 'DONE'
  summaryStatus: 'NONE' | 'SUBMITTED' | 'PARTIAL_WRITTEN_BACK' | 'WRITTEN_BACK' | 'HAS_OBJECTION'
  completionStatus: 'OPEN' | 'COMPLETED'
  completedByWarehouseAt?: string
  qtyExpectedTotal: number
  qtyActualTotal: number
  qtyDiffTotal: number
  sourceDocNo: string
  scopeLabel: string
  stageCode: 'PREP' | 'PROD' | 'POST'
  stageName: string
  processBusinessCode: string
  processBusinessName: string
  taskTypeCode: string
  taskTypeLabel: string
  assignmentGranularityLabel: string
}

export interface PdaTaskMockPickupRecordSeed {
  handoverId: string
  recordId: string
  taskId: string
  sequenceNo?: number
  materialCode?: string
  materialSummary: string
  materialName: string
  materialSpec: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  submittedAt: string
  status:
    | 'PENDING_WAREHOUSE_DISPATCH'
    | 'PENDING_FACTORY_PICKUP'
    | 'PENDING_FACTORY_CONFIRM'
    | 'RECEIVED'
    | 'OBJECTION_REPORTED'
    | 'OBJECTION_PROCESSING'
    | 'OBJECTION_RESOLVED'
  receivedAt?: string
  pickupMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
  qrCodeValue?: string
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
  objectionProofFiles?: Array<{ id: string; type: 'IMAGE' | 'VIDEO'; name: string; uploadedAt: string }>
  objectionStatus?: 'REPORTED' | 'PROCESSING' | 'RESOLVED'
  followUpRemark?: string
  resolvedRemark?: string
  remark?: string
}

export interface PdaTaskMockHandoutRecordSeed {
  handoverId: string
  recordId: string
  taskId: string
  materialName: string
  materialSpec: string
  materialCode?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  plannedQty: number
  qtyUnit: string
  handoutObjectType?: 'GARMENT' | 'CUT_PIECE' | 'FABRIC'
  handoutItemLabel?: string
  garmentEquivalentQty?: number
  factorySubmittedBy?: string
  receiverWrittenQty?: number
  receiverWrittenAt?: string
  receiverWrittenBy?: string
  receiverRemark?: string
  diffReason?: string
  factoryDiffDecision?: 'ACCEPT_DIFF' | 'RAISE_OBJECTION'
  quantityObjectionId?: string
  factorySubmittedAt: string
  status:
    | 'PENDING_WRITEBACK'
    | 'WRITTEN_BACK'
    | 'OBJECTION_REPORTED'
    | 'OBJECTION_PROCESSING'
    | 'OBJECTION_RESOLVED'
  warehouseReturnNo?: string
  warehouseWrittenQty?: number
  warehouseWrittenAt?: string
  factoryRemark?: string
  objectionReason?: string
  objectionRemark?: string
}

export interface PdaTaskMockCutPieceHandoutLineSeed {
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

export interface PdaTaskMockHandoutRecordSeed {
  cutPieceLines?: PdaTaskMockCutPieceHandoutLineSeed[]
}

interface GenericProcessProfile {
  key: Exclude<PdaMobileProcessKey, 'CUTTING'>
  taskPrefix: string
  processCode: string
  processNameZh: string
  factoryId: string
  qtyBase: number
  priceBase: number
  spuName: string
  materialSummary: string
  handoverTargetName: string
  handoverTargetKind: 'WAREHOUSE' | 'FACTORY'
  handoverSourceName: string
  receiveHint: string
  blockedReason: BlockReason
  blockedRemark: string
  biddingFactoryPoolCount?: number
}

function getHandoutObjectTypeForProcess(
  key: GenericProcessProfile['key'],
): 'GARMENT' | 'CUT_PIECE' | 'FABRIC' {
  if (key === 'PRINTING') return 'CUT_PIECE'
  if (key === 'DYEING') return 'FABRIC'
  return 'GARMENT'
}

function getHandoutQtyUnitForProcess(key: GenericProcessProfile['key']): string {
  if (key === 'PRINTING') return '片'
  if (key === 'DYEING') return '卷'
  return '件'
}

function roundQty(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100)
}

function getGarmentEquivalentQty(pieceQty: number, pieceCountPerGarment = 2): number {
  return roundQty(pieceQty / pieceCountPerGarment)
}

const PROCESS_DEFINITION_BY_KEY = new Map(
  PDA_MOBILE_PROCESS_DEFINITIONS.map((item) => [item.key, item] as const),
)

const PROCESS_PROFILES: GenericProcessProfile[] = [
  {
    key: 'SEWING',
    taskPrefix: 'SEW',
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    factoryId: 'ID-F001',
    qtyBase: 920,
    priceBase: 4.9,
    spuName: 'POLO 基础款',
    materialSummary: '主身片 / 领片 / 袖片',
    handoverTargetName: '我方后道工厂',
    handoverTargetKind: 'FACTORY',
    handoverSourceName: 'PT Sinar Garment Indonesia',
    receiveHint: '车缝主线待开工，当前已安排整单派工。',
    blockedReason: 'CAPACITY',
    blockedRemark: '后道锁眼机待维护，当前主线暂缓切换。',
  },
  {
    key: 'IRONING',
    taskPrefix: 'IRON',
    processCode: 'PROC_IRON',
    processNameZh: '整烫',
    factoryId: 'ID-F001',
    qtyBase: 680,
    priceBase: 1.9,
    spuName: '夹克后整批次',
    materialSummary: '成衣包 / 熨烫辅料',
    handoverTargetName: '一号成衣仓',
    handoverTargetKind: 'WAREHOUSE',
    handoverSourceName: 'PT Sinar Garment Indonesia',
    receiveHint: '整烫批次待接单，需预留后整线体。',
    blockedReason: 'EQUIPMENT',
    blockedRemark: '蒸汽整烫设备温控报警，待机修确认。',
  },
  {
    key: 'PACKAGING',
    taskPrefix: 'PACK',
    processCode: 'PROC_PACK',
    processNameZh: '包装',
    factoryId: 'ID-F001',
    qtyBase: 720,
    priceBase: 1.3,
    spuName: '成衣包装批次',
    materialSummary: '包装袋 / 吊牌 / 外箱',
    handoverTargetName: '一号成衣仓',
    handoverTargetKind: 'WAREHOUSE',
    handoverSourceName: 'PT Sinar Garment Indonesia',
    receiveHint: '包装待接单，需先确认包材批次。',
    blockedReason: 'MATERIAL',
    blockedRemark: '吊牌补料延迟，包装线暂停切入。',
  },
  {
    key: 'QC',
    taskPrefix: 'QC',
    processCode: 'PROC_QC',
    processNameZh: '质检',
    factoryId: 'ID-F001',
    qtyBase: 560,
    priceBase: 0.9,
    spuName: '尾部质检抽检批',
    materialSummary: '成衣抽检包 / 抽检标签',
    handoverTargetName: '一号成衣仓',
    handoverTargetKind: 'WAREHOUSE',
    handoverSourceName: 'PT Sinar Garment Indonesia',
    receiveHint: '质检批次待接单，需确认抽检比例。',
    blockedReason: 'QUALITY',
    blockedRemark: '抽检发现色差争议，暂停放行。',
  },
  {
    key: 'FINISHING',
    taskPrefix: 'FIN',
    processCode: 'PROC_FINISHING',
    processNameZh: '后整理',
    factoryId: 'ID-F001',
    qtyBase: 640,
    priceBase: 1.6,
    spuName: '后整理返修批',
    materialSummary: '成衣返修包 / 补料附件',
    handoverTargetName: '一号成衣仓',
    handoverTargetKind: 'WAREHOUSE',
    handoverSourceName: 'PT Sinar Garment Indonesia',
    receiveHint: '后整理返修批待接单，需安排返修工位。',
    blockedReason: 'QUALITY',
    blockedRemark: '返修工艺意见未统一，暂缓放量。',
  },
  {
    key: 'PRINTING',
    taskPrefix: 'PRINT',
    processCode: 'PROC_PRINT',
    processNameZh: '印花',
    factoryId: 'ID-F002',
    qtyBase: 860,
    priceBase: 3.8,
    spuName: '满版印花款',
    materialSummary: '印花片 / 色浆 / 网版',
    handoverTargetName: '中转区域',
    handoverTargetKind: 'WAREHOUSE',
    handoverSourceName: 'PT Prima Printing Center',
    receiveHint: '印花招标单待报价，需确认网版切换窗口。',
    blockedReason: 'TECH',
    blockedRemark: '花位确认未回传，印花线暂停开机。',
    biddingFactoryPoolCount: 4,
  },
  {
    key: 'DYEING',
    taskPrefix: 'DYE',
    processCode: 'PROC_DYE',
    processNameZh: '染色',
    factoryId: 'ID-F003',
    qtyBase: 910,
    priceBase: 4.2,
    spuName: '大货染色批',
    materialSummary: '坯布 / 染化料 / 色卡',
    handoverTargetName: '中转区域',
    handoverTargetKind: 'WAREHOUSE',
    handoverSourceName: 'PT Cahaya Dyeing Sejahtera',
    receiveHint: '染色招标单待报价，需确认缸位与交期。',
    blockedReason: 'CAPACITY',
    blockedRemark: '染缸排期冲突，当前批次暂停插单。',
    biddingFactoryPoolCount: 3,
  },
]

function getFactoryName(factoryId: string): string {
  return indonesiaFactories.find((item) => item.id === factoryId)?.name ?? factoryId
}

function getProcessDef(profile: GenericProcessProfile) {
  return PROCESS_DEFINITION_BY_KEY.get(profile.key)
}

function isExternalMockProcess(profile: GenericProcessProfile): boolean {
  return profile.key !== 'IRONING' && profile.key !== 'PACKAGING'
}

function resolveMockBusinessProcessCode(profile: GenericProcessProfile): string {
  if (profile.key === 'SEWING') return 'SEW'
  if (profile.key === 'PRINTING') return 'PRINT'
  if (profile.key === 'DYEING') return 'DYE'
  if (profile.key === 'FINISHING') return 'POST_FINISHING'
  if (profile.key === 'QC') return 'QC'
  if (profile.key === 'IRONING') return 'IRONING'
  if (profile.key === 'PACKAGING') return 'PACKAGING'
  return profile.processCode
}

function resolveMockStageCode(profile: GenericProcessProfile): 'PREP' | 'PROD' | 'POST' {
  if (profile.key === 'FINISHING' || profile.key === 'QC' || profile.key === 'IRONING' || profile.key === 'PACKAGING') {
    return 'POST'
  }
  return profile.key === 'PRINTING' || profile.key === 'DYEING' ? 'PREP' : 'PROD'
}

function resolveMockStageName(profile: GenericProcessProfile): string {
  const stageCode = resolveMockStageCode(profile)
  if (stageCode === 'PREP') return '准备阶段'
  if (stageCode === 'POST') return '后道阶段'
  return '生产阶段'
}

function resolveMockTaskReceiver(profile: GenericProcessProfile): Pick<
  PdaGenericTaskMock,
  'receiverKind' | 'receiverId' | 'receiverName'
> | null {
  if (!isExternalMockProcess(profile)) return null

  if (profile.key === 'SEWING') {
    return {
      receiverKind: 'MANAGED_POST_FACTORY',
      receiverId: 'POST-FACTORY-OWN',
      receiverName: '我方后道工厂',
    }
  }

  if (profile.key === 'FINISHING' || profile.key === 'QC') {
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

function buildOwnerSuggestion(profile: GenericProcessProfile, assignmentMode: 'DIRECT' | 'BIDDING'): OwnerSuggestion {
  if (assignmentMode === 'BIDDING') {
    return {
      kind: 'RECOMMENDED_FACTORY_POOL',
      recommendedTier: 'CENTRAL',
      recommendedTypes: [profile.key === 'PRINTING' ? 'PRINTING' : profile.key === 'DYEING' ? 'DYEING' : 'CENTRAL_FACTORY'],
    }
  }
  return { kind: 'MAIN_FACTORY' }
}

function createAuditLog(taskId: string, action: string, detail: string, at: string, by: string) {
  return {
    id: `AL-${taskId}-${action}-${at.replace(/[^0-9]/g, '').slice(-10)}`,
    action,
    detail,
    at,
    by,
  }
}

function taskNo(taskPrefix: string, index: number): string {
  return `TASK-${taskPrefix}-${String(index).padStart(6, '0')}`
}

function orderNo(index: number): string {
  return `PO-20260328-${String(index).padStart(3, '0')}`
}

function nowLike(day: number, time: string): string {
  return `2026-03-${String(day).padStart(2, '0')} ${time}`
}

function createTask(
  profile: GenericProcessProfile,
  index: number,
  origin: PdaTaskMockOrigin,
  input: {
    assignmentMode: 'DIRECT' | 'BIDDING'
    assignmentStatus: TaskAssignmentStatus
    acceptanceStatus?: AcceptanceStatus
    status: TaskStatus
    qty: number
    taskSummaryNote: string
    acceptDeadline: string
    taskDeadline: string
    dispatchedAt: string
    dispatchedBy: string
    productionOrderNo: string
    productionOrderId: string
    tenderId?: string
    biddingDeadline?: string
    standardPrice?: number
    dispatchPrice?: number
    dispatchRemark?: string
    priceDiffReason?: string
    acceptedAt?: string
    acceptedBy?: string
    awardedAt?: string
    startedAt?: string
    finishedAt?: string
    blockedAt?: string
    blockReason?: BlockReason
    blockRemark?: string
    spuCode?: string
    spuName?: string
    requiredDeliveryDate?: string
    handoutStatus?: 'PENDING' | 'HANDED_OUT'
    mockReceiveSummary: string
    mockExecutionSummary: string
    mockHandoverSummary: string
    hasMaterialRequest?: boolean
    mockStartPrerequisiteMet?: boolean
  },
): PdaGenericTaskMock {
  const definition = getProcessDef(profile)
  const taskId = taskNo(profile.taskPrefix, index)
  const factoryName = getFactoryName(profile.factoryId)
  const createdAt = input.dispatchedAt
  const receiver = resolveMockTaskReceiver(profile)
  const isExternal = isExternalMockProcess(profile)
  const processBusinessCode = resolveMockBusinessProcessCode(profile)
  const stageCode = resolveMockStageCode(profile)
  const stageName = resolveMockStageName(profile)

  return {
    taskId,
    taskNo: taskId,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    seq: 1,
    processCode: profile.processCode,
    processNameZh: profile.processNameZh,
    stage: definition?.stage ?? 'SEWING',
    qty: input.qty,
    qtyUnit: '件' as never,
    assignmentMode: input.assignmentMode,
    assignmentStatus: input.assignmentStatus,
    ownerSuggestion: buildOwnerSuggestion(profile, input.assignmentMode),
    assignedFactoryId: profile.factoryId,
    assignedFactoryName: factoryName,
    tenderId: input.tenderId,
    qcPoints: [],
    attachments: [],
    status: input.status,
    acceptDeadline: input.acceptDeadline,
    taskDeadline: input.taskDeadline,
    dispatchRemark: input.dispatchRemark ?? input.taskSummaryNote,
    dispatchedAt: input.dispatchedAt,
    dispatchedBy: input.dispatchedBy,
    standardPrice: input.standardPrice ?? profile.priceBase,
    standardPriceCurrency: 'CNY',
    standardPriceUnit: '件',
    dispatchPrice: input.dispatchPrice,
    dispatchPriceCurrency: 'CNY',
    dispatchPriceUnit: '件',
    priceDiffReason: input.priceDiffReason,
    acceptanceStatus: input.acceptanceStatus,
    acceptedAt: input.acceptedAt,
    awardedAt: input.awardedAt,
    acceptedBy: input.acceptedBy,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    blockedAt: input.blockedAt,
    blockReason: input.blockReason,
    blockRemark: input.blockRemark,
    hasMaterialRequest: input.hasMaterialRequest,
    materialRequestNo: input.hasMaterialRequest ? `MR-${profile.taskPrefix}-${String(index).padStart(3, '0')}` : undefined,
    materialMode: input.hasMaterialRequest ? 'factory_pickup' : undefined,
    materialModeLabel: input.hasMaterialRequest ? '工厂到仓自提' : undefined,
    materialRequestStatus: input.hasMaterialRequest ? '待自提' : undefined,
    taskQrValue: isExternal ? buildTaskQrValue(taskId) : undefined,
    taskQrStatus: isExternal ? 'ACTIVE' : undefined,
    handoverAutoCreatePolicy: isExternal ? 'CREATE_ON_START' : undefined,
    handoverStatus: isExternal ? (input.startedAt ? 'AUTO_CREATED' : 'NOT_CREATED') : undefined,
    receiverKind: receiver?.receiverKind,
    receiverId: receiver?.receiverId,
    receiverName: receiver?.receiverName,
    taskKind: 'NORMAL',
    taskCategoryZh: `${profile.processNameZh}任务`,
    stageCode,
    stageName,
    processBusinessCode,
    processBusinessName: profile.processNameZh,
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    createdAt,
    updatedAt: input.finishedAt || input.blockedAt || input.startedAt || input.acceptedAt || createdAt,
    auditLogs: [
      createAuditLog(taskId, 'DISPATCH', input.taskSummaryNote, input.dispatchedAt, input.dispatchedBy),
      ...(input.acceptedAt && input.acceptanceStatus === 'ACCEPTED'
        ? [createAuditLog(taskId, 'ACCEPT', '工厂确认接单', input.acceptedAt, input.acceptedBy || factoryName)]
        : []),
      ...(input.acceptanceStatus === 'REJECTED'
        ? [createAuditLog(taskId, 'REJECT', '工厂拒绝接单，已保留历史供验收', input.dispatchedAt, factoryName)]
        : []),
    ],
    spuCode: input.spuCode ?? `${profile.taskPrefix}-SPU-${String(index).padStart(3, '0')}`,
    spuName: input.spuName ?? profile.spuName,
    requiredDeliveryDate: input.requiredDeliveryDate ?? input.taskDeadline.slice(0, 10),
    mockProcessKey: profile.key,
    mockOrigin: origin,
    mockReceiveSummary: input.mockReceiveSummary,
    mockExecutionSummary: input.mockExecutionSummary,
    mockHandoverSummary: input.mockHandoverSummary,
    mockStartPrerequisiteMet: input.mockStartPrerequisiteMet,
    handoutStatus: input.handoutStatus,
  }
}

function buildDirectTaskSet(profile: GenericProcessProfile, baseIndex: number): PdaGenericTaskMock[] {
  const baseOrderNo = orderNo(baseIndex)
  const pendingAcceptDeadline =
    profile.key === 'SEWING'
      ? nowLike(28, '20:30:00')
      : nowLike(29, '10:00:00')
  return [
    createTask(profile, baseIndex * 10 + 1, 'DIRECT_PENDING', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'PENDING',
      status: 'NOT_STARTED',
      qty: profile.qtyBase,
      taskSummaryNote: `${profile.processNameZh}直接派单待接单`,
      acceptDeadline: pendingAcceptDeadline,
      taskDeadline: nowLike(31, '18:00:00'),
      dispatchedAt: nowLike(28, '08:10:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: baseOrderNo,
      productionOrderId: baseOrderNo,
      mockReceiveSummary: `待接单，${profile.receiveHint}`,
      mockExecutionSummary: '待开工',
      mockHandoverSummary: '待交接',
    }),
    createTask(profile, baseIndex * 10 + 2, 'DIRECT_REJECTED', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'REJECTED',
      status: 'NOT_STARTED',
      qty: profile.qtyBase - 60,
      taskSummaryNote: `${profile.processNameZh}直接派单已拒接`,
      acceptDeadline: nowLike(29, '09:00:00'),
      taskDeadline: nowLike(31, '16:00:00'),
      dispatchedAt: nowLike(28, '08:20:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: orderNo(baseIndex + 40),
      productionOrderId: orderNo(baseIndex + 40),
      mockReceiveSummary: '已拒接，保留历史卡片供验收。',
      mockExecutionSummary: '未开工',
      mockHandoverSummary: '无交接',
    }),
    createTask(profile, baseIndex * 10 + 3, 'EXEC_NOT_STARTED', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'ACCEPTED',
      status: 'NOT_STARTED',
      qty: profile.qtyBase + 20,
      taskSummaryNote: `${profile.processNameZh}已接单待开工`,
      acceptDeadline: nowLike(28, '12:00:00'),
      taskDeadline: nowLike(30, '20:00:00'),
      dispatchedAt: nowLike(28, '07:30:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: orderNo(baseIndex + 80),
      productionOrderId: orderNo(baseIndex + 80),
      acceptedAt: nowLike(28, '08:05:00'),
      acceptedBy: 'PDA 接单员',
      mockReceiveSummary: `已确认领料条件，${profile.materialSummary}`,
      mockExecutionSummary: '待开工',
      mockHandoverSummary: '待交接',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 4, 'EXEC_IN_PROGRESS', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'ACCEPTED',
      status: 'IN_PROGRESS',
      qty: profile.qtyBase + 80,
      taskSummaryNote: `${profile.processNameZh}执行中`,
      acceptDeadline: nowLike(28, '12:30:00'),
      taskDeadline: nowLike(30, '22:00:00'),
      dispatchedAt: nowLike(28, '07:40:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: orderNo(baseIndex + 120),
      productionOrderId: orderNo(baseIndex + 120),
      acceptedAt: nowLike(28, '08:20:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(28, '09:15:00'),
      mockReceiveSummary: `${profile.materialSummary}已到位`,
      mockExecutionSummary: `${profile.processNameZh}进行中`,
      mockHandoverSummary: '待交接',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 5, 'EXEC_BLOCKED', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'ACCEPTED',
      status: 'BLOCKED',
      qty: profile.qtyBase - 40,
      taskSummaryNote: `${profile.processNameZh}执行暂停`,
      acceptDeadline: nowLike(28, '13:00:00'),
      taskDeadline: nowLike(30, '23:00:00'),
      dispatchedAt: nowLike(28, '07:50:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: orderNo(baseIndex + 160),
      productionOrderId: orderNo(baseIndex + 160),
      acceptedAt: nowLike(28, '08:35:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(28, '10:10:00'),
      blockedAt: nowLike(28, '14:25:00'),
      blockReason: profile.blockedReason,
      blockRemark: profile.blockedRemark,
      mockReceiveSummary: `${profile.materialSummary}已到位`,
      mockExecutionSummary: '生产暂停',
      mockHandoverSummary: '待恢复后交接',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 6, 'EXEC_DONE', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'ACCEPTED',
      status: 'DONE',
      qty: profile.qtyBase - 90,
      taskSummaryNote: `${profile.processNameZh}已完工待交出`,
      acceptDeadline: nowLike(27, '16:00:00'),
      taskDeadline: nowLike(29, '20:00:00'),
      dispatchedAt: nowLike(27, '08:00:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: orderNo(baseIndex + 200),
      productionOrderId: orderNo(baseIndex + 200),
      acceptedAt: nowLike(27, '08:40:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(27, '10:00:00'),
      finishedAt: nowLike(28, '18:20:00'),
      mockReceiveSummary: `${profile.materialSummary}已满足`,
      mockExecutionSummary: '已完工',
      mockHandoverSummary: '待交接',
      handoutStatus: 'PENDING',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 7, 'EXEC_CANCELLED', {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'ACCEPTED',
      status: 'CANCELLED',
      qty: profile.qtyBase - 120,
      taskSummaryNote: `${profile.processNameZh}任务已取消`,
      acceptDeadline: nowLike(27, '17:00:00'),
      taskDeadline: nowLike(29, '18:00:00'),
      dispatchedAt: nowLike(27, '08:30:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: orderNo(baseIndex + 240),
      productionOrderId: orderNo(baseIndex + 240),
      acceptedAt: nowLike(27, '09:05:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(27, '11:00:00'),
      finishedAt: nowLike(28, '15:10:00'),
      mockReceiveSummary: `${profile.materialSummary}已到位`,
      mockExecutionSummary: '已中止',
      mockHandoverSummary: '已取消，不再交接',
      handoutStatus: 'HANDED_OUT',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
  ]
}

function buildBiddingTaskSet(profile: GenericProcessProfile, baseIndex: number): PdaGenericTaskMock[] {
  const pendingOne = orderNo(baseIndex + 300)
  const pendingTwo = orderNo(baseIndex + 301)
  const quotedOne = orderNo(baseIndex + 320)
  const quotedTwo = orderNo(baseIndex + 321)
  const awardedBase = orderNo(baseIndex + 340)
  return [
    createTask(profile, baseIndex * 10 + 1, 'BIDDING_PENDING', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      status: 'NOT_STARTED',
      qty: profile.qtyBase,
      taskSummaryNote: `${profile.processNameZh}招标待报价`,
      acceptDeadline: nowLike(29, '10:00:00'),
      taskDeadline: nowLike(31, '18:00:00'),
      dispatchedAt: nowLike(28, '08:00:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: pendingOne,
      productionOrderId: pendingOne,
      tenderId: `TENDER-${profile.taskPrefix}-PENDING-01`,
      biddingDeadline: nowLike(29, '15:00:00'),
      mockReceiveSummary: '待报价，需确认产能与工艺窗口。',
      mockExecutionSummary: '待报价',
      mockHandoverSummary: '未中标前无交接',
    }),
    createTask(profile, baseIndex * 10 + 2, 'BIDDING_PENDING', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      status: 'NOT_STARTED',
      qty: profile.qtyBase - 120,
      taskSummaryNote: `${profile.processNameZh}加急招标待报价`,
      acceptDeadline: nowLike(29, '11:00:00'),
      taskDeadline: nowLike(30, '20:00:00'),
      dispatchedAt: nowLike(28, '08:30:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: pendingTwo,
      productionOrderId: pendingTwo,
      tenderId: `TENDER-${profile.taskPrefix}-PENDING-02`,
      biddingDeadline: nowLike(29, '12:30:00'),
      mockReceiveSummary: '待报价，需抢占专项产能窗口。',
      mockExecutionSummary: '待报价',
      mockHandoverSummary: '未中标前无交接',
    }),
    createTask(profile, baseIndex * 10 + 3, 'BIDDING_QUOTED', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      status: 'NOT_STARTED',
      qty: profile.qtyBase + 60,
      taskSummaryNote: `${profile.processNameZh}已报价待定标`,
      acceptDeadline: nowLike(29, '12:00:00'),
      taskDeadline: nowLike(31, '22:00:00'),
      dispatchedAt: nowLike(28, '09:00:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: quotedOne,
      productionOrderId: quotedOne,
      tenderId: `TENDER-${profile.taskPrefix}-QUOTED-01`,
      biddingDeadline: nowLike(29, '17:00:00'),
      mockReceiveSummary: '已报价，等待平台定标。',
      mockExecutionSummary: '等待定标',
      mockHandoverSummary: '未中标前无交接',
    }),
    createTask(profile, baseIndex * 10 + 4, 'BIDDING_QUOTED', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      status: 'NOT_STARTED',
      qty: profile.qtyBase - 30,
      taskSummaryNote: `${profile.processNameZh}已报价待回标`,
      acceptDeadline: nowLike(29, '12:30:00'),
      taskDeadline: nowLike(31, '20:30:00'),
      dispatchedAt: nowLike(28, '09:10:00'),
      dispatchedBy: '移动端调度',
      productionOrderNo: quotedTwo,
      productionOrderId: quotedTwo,
      tenderId: `TENDER-${profile.taskPrefix}-QUOTED-02`,
      biddingDeadline: nowLike(29, '18:00:00'),
      mockReceiveSummary: '已报价，等待平台回标。',
      mockExecutionSummary: '等待定标',
      mockHandoverSummary: '未中标前无交接',
    }),
    createTask(profile, baseIndex * 10 + 5, 'AWARDED_PENDING', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'PENDING',
      status: 'NOT_STARTED',
      qty: profile.qtyBase + 110,
      taskSummaryNote: `${profile.processNameZh}已中标待接单`,
      acceptDeadline: nowLike(29, '14:00:00'),
      taskDeadline: nowLike(31, '21:00:00'),
      dispatchedAt: nowLike(28, '10:00:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: awardedBase,
      productionOrderId: awardedBase,
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-01`,
      biddingDeadline: nowLike(29, '09:00:00'),
      awardedAt: nowLike(28, '10:10:00'),
      mockReceiveSummary: '已中标，等待工厂确认接单。',
      mockExecutionSummary: '待开工',
      mockHandoverSummary: '待交接',
      dispatchPrice: profile.priceBase + 0.2,
      priceDiffReason: '定标按专项设备档期上浮',
    }),
    createTask(profile, baseIndex * 10 + 6, 'AWARDED_ACCEPTED_NOT_STARTED', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'ACCEPTED',
      status: 'NOT_STARTED',
      qty: profile.qtyBase + 150,
      taskSummaryNote: `${profile.processNameZh}已中标已接单待开工`,
      acceptDeadline: nowLike(29, '14:30:00'),
      taskDeadline: nowLike(31, '23:00:00'),
      dispatchedAt: nowLike(28, '10:15:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: orderNo(baseIndex + 341),
      productionOrderId: orderNo(baseIndex + 341),
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-02`,
      biddingDeadline: nowLike(29, '09:30:00'),
      awardedAt: nowLike(28, '10:20:00'),
      acceptedAt: nowLike(28, '11:05:00'),
      acceptedBy: 'PDA 接单员',
      mockReceiveSummary: `${profile.materialSummary}已备齐，可排产开工。`,
      mockExecutionSummary: '待开工',
      mockHandoverSummary: '待交接',
      dispatchPrice: profile.priceBase + 0.3,
      priceDiffReason: '定标含专项换版费用',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 7, 'AWARDED_ACCEPTED_IN_PROGRESS', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'ACCEPTED',
      status: 'IN_PROGRESS',
      qty: profile.qtyBase + 190,
      taskSummaryNote: `${profile.processNameZh}已中标执行中`,
      acceptDeadline: nowLike(29, '15:00:00'),
      taskDeadline: nowLike(31, '22:30:00'),
      dispatchedAt: nowLike(28, '10:20:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: orderNo(baseIndex + 342),
      productionOrderId: orderNo(baseIndex + 342),
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-03`,
      biddingDeadline: nowLike(29, '09:40:00'),
      awardedAt: nowLike(28, '10:30:00'),
      acceptedAt: nowLike(28, '11:25:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(28, '13:10:00'),
      mockReceiveSummary: `${profile.materialSummary}已到位`,
      mockExecutionSummary: `${profile.processNameZh}进行中`,
      mockHandoverSummary: '待交接',
      dispatchPrice: profile.priceBase + 0.4,
      priceDiffReason: '定标含紧急插单费用',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 8, 'AWARDED_ACCEPTED_BLOCKED', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'ACCEPTED',
      status: 'BLOCKED',
      qty: profile.qtyBase + 70,
      taskSummaryNote: `${profile.processNameZh}已中标执行暂停`,
      acceptDeadline: nowLike(29, '15:20:00'),
      taskDeadline: nowLike(31, '20:00:00'),
      dispatchedAt: nowLike(28, '10:30:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: orderNo(baseIndex + 343),
      productionOrderId: orderNo(baseIndex + 343),
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-04`,
      biddingDeadline: nowLike(29, '10:00:00'),
      awardedAt: nowLike(28, '10:40:00'),
      acceptedAt: nowLike(28, '11:40:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(28, '13:40:00'),
      blockedAt: nowLike(28, '16:10:00'),
      blockReason: profile.blockedReason,
      blockRemark: profile.blockedRemark,
      mockReceiveSummary: `${profile.materialSummary}已到位`,
      mockExecutionSummary: '生产暂停',
      mockHandoverSummary: '待恢复后交接',
      dispatchPrice: profile.priceBase + 0.5,
      priceDiffReason: '定标含专项工艺待机费用',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 9, 'AWARDED_ACCEPTED_DONE', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'ACCEPTED',
      status: 'DONE',
      qty: profile.qtyBase + 10,
      taskSummaryNote: `${profile.processNameZh}已中标完工待交接`,
      acceptDeadline: nowLike(28, '15:40:00'),
      taskDeadline: nowLike(30, '19:00:00'),
      dispatchedAt: nowLike(27, '10:30:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: orderNo(baseIndex + 344),
      productionOrderId: orderNo(baseIndex + 344),
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-05`,
      biddingDeadline: nowLike(28, '10:30:00'),
      awardedAt: nowLike(27, '11:00:00'),
      acceptedAt: nowLike(27, '12:00:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(27, '15:00:00'),
      finishedAt: nowLike(28, '18:00:00'),
      mockReceiveSummary: `${profile.materialSummary}已满足`,
      mockExecutionSummary: '已完工',
      mockHandoverSummary: '待交接',
      handoutStatus: 'PENDING',
      dispatchPrice: profile.priceBase + 0.35,
      priceDiffReason: '定标按历史合作价执行',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 10, 'AWARDED_ACCEPTED_CANCELLED', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'ACCEPTED',
      status: 'CANCELLED',
      qty: profile.qtyBase - 80,
      taskSummaryNote: `${profile.processNameZh}已中标后中止`,
      acceptDeadline: nowLike(28, '16:00:00'),
      taskDeadline: nowLike(30, '20:30:00'),
      dispatchedAt: nowLike(27, '10:40:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: orderNo(baseIndex + 345),
      productionOrderId: orderNo(baseIndex + 345),
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-06`,
      biddingDeadline: nowLike(28, '10:40:00'),
      awardedAt: nowLike(27, '11:10:00'),
      acceptedAt: nowLike(27, '12:20:00'),
      acceptedBy: 'PDA 接单员',
      startedAt: nowLike(27, '16:00:00'),
      finishedAt: nowLike(28, '14:20:00'),
      mockReceiveSummary: `${profile.materialSummary}已到位`,
      mockExecutionSummary: '已中止',
      mockHandoverSummary: '不再交接',
      handoutStatus: 'HANDED_OUT',
      dispatchPrice: profile.priceBase + 0.1,
      priceDiffReason: '定标后客户撤单，保留历史任务供验收',
      hasMaterialRequest: true,
      mockStartPrerequisiteMet: true,
    }),
    createTask(profile, baseIndex * 10 + 11, 'AWARDED_REJECTED', {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      acceptanceStatus: 'REJECTED',
      status: 'NOT_STARTED',
      qty: profile.qtyBase - 20,
      taskSummaryNote: `${profile.processNameZh}已中标但工厂拒接`,
      acceptDeadline: nowLike(28, '16:30:00'),
      taskDeadline: nowLike(30, '21:00:00'),
      dispatchedAt: nowLike(28, '10:50:00'),
      dispatchedBy: '平台定标',
      productionOrderNo: orderNo(baseIndex + 346),
      productionOrderId: orderNo(baseIndex + 346),
      tenderId: `TENDER-${profile.taskPrefix}-AWARDED-07`,
      biddingDeadline: nowLike(28, '10:50:00'),
      awardedAt: nowLike(28, '11:20:00'),
      mockReceiveSummary: '已中标但工厂拒绝接单，保留异常卡片供验收。',
      mockExecutionSummary: '未开工',
      mockHandoverSummary: '无交接',
      dispatchPrice: profile.priceBase + 0.15,
      priceDiffReason: '定标后工厂拒接，等待平台重分配',
    }),
  ]
}

function buildHandoverSeeds(
  profile: GenericProcessProfile,
  tasks: PdaGenericTaskMock[],
  baseIndex: number,
): {
  heads: PdaTaskMockHandoverHeadSeed[]
  pickupRecordsByHeadId: Record<string, PdaTaskMockPickupRecordSeed[]>
  handoutRecordsByHeadId: Record<string, PdaTaskMockHandoutRecordSeed[]>
} {
  const pickupTask = tasks.find((task) => task.mockOrigin === 'EXEC_NOT_STARTED' || task.mockOrigin === 'AWARDED_ACCEPTED_NOT_STARTED') || tasks[0]
  const openHandoutTask = tasks.find((task) => task.mockOrigin === 'EXEC_DONE' || task.mockOrigin === 'AWARDED_ACCEPTED_DONE') || tasks[0]
  const completedHandoutTask = tasks.find((task) => task.status === 'DONE') || tasks[0]
  const pickupHeadId = `PKH-MOCK-${profile.taskPrefix}-${String(baseIndex).padStart(3, '0')}`
  const openHandoutHeadId = `HOH-MOCK-${profile.taskPrefix}-${String(baseIndex + 1).padStart(3, '0')}`
  const doneHandoutHeadId = `HOH-MOCK-${profile.taskPrefix}-${String(baseIndex + 2).padStart(3, '0')}`
  const handoutObjectType = getHandoutObjectTypeForProcess(profile.key)
  const handoutQtyUnit = getHandoutQtyUnitForProcess(profile.key)
  const processBusinessCode = resolveMockBusinessProcessCode(profile)
  const stageCode = resolveMockStageCode(profile)
  const stageName = resolveMockStageName(profile)

  const openHandoutRecords: PdaTaskMockHandoutRecordSeed[] =
    handoutObjectType === 'CUT_PIECE'
      ? [
          {
            handoverId: openHandoutHeadId,
            recordId: `${openHandoutHeadId}-001`,
            taskId: openHandoutTask.taskId,
            materialCode: `${profile.taskPrefix}-CUT-001`,
            materialName: '印花裁片',
            materialSpec: '前片印花首批',
            skuCode: `${profile.taskPrefix}-SKU-001`,
            skuColor: '标准色',
            skuSize: 'M',
            pieceName: '前片',
            plannedQty: Math.max(Math.round(openHandoutTask.qty * 0.68), 96),
            qtyUnit: handoutQtyUnit,
            handoutObjectType,
            handoutItemLabel: `标准色 / ${profile.taskPrefix}-SKU-001 / ${Math.max(Math.round(openHandoutTask.qty * 0.68), 96)}片 / 前片`,
            garmentEquivalentQty: getGarmentEquivalentQty(Math.max(Math.round(openHandoutTask.qty * 0.68), 96)),
            factorySubmittedAt: nowLike(28, '15:30:00'),
            status: 'WRITTEN_BACK',
            warehouseReturnNo: `RET-WB-${profile.taskPrefix}-01`,
            warehouseWrittenQty: Math.max(Math.round(openHandoutTask.qty * 0.68), 96),
            warehouseWrittenAt: nowLike(28, '15:55:00'),
            factoryRemark: '前片已完成仓库回写',
          },
          {
            handoverId: openHandoutHeadId,
            recordId: `${openHandoutHeadId}-002`,
            taskId: openHandoutTask.taskId,
            materialCode: `${profile.taskPrefix}-CUT-002`,
            materialName: '印花裁片',
            materialSpec: '后片尾批交出',
            skuCode: `${profile.taskPrefix}-SKU-002`,
            skuColor: '标准色',
            skuSize: 'L',
            pieceName: '后片',
            plannedQty: Math.max(Math.round(openHandoutTask.qty * 0.52), 84),
            qtyUnit: handoutQtyUnit,
            handoutObjectType,
            handoutItemLabel: `标准色 / ${profile.taskPrefix}-SKU-002 / ${Math.max(Math.round(openHandoutTask.qty * 0.52), 84)}片 / 后片`,
            garmentEquivalentQty: getGarmentEquivalentQty(Math.max(Math.round(openHandoutTask.qty * 0.52), 84)),
            factorySubmittedAt: nowLike(28, '17:00:00'),
            status: 'PENDING_WRITEBACK',
            factoryRemark: '后片尾批待仓库回写',
          },
        ]
      : handoutObjectType === 'FABRIC'
        ? [
            {
              handoverId: openHandoutHeadId,
              recordId: `${openHandoutHeadId}-001`,
              taskId: openHandoutTask.taskId,
              materialCode: `${profile.taskPrefix}-FAB-001`,
              materialName: '染色主布',
              materialSpec: '主布首批回仓',
              skuCode: `${profile.taskPrefix}-FABRIC-001`,
              skuColor: '标准色',
              skuSize: '整单',
              plannedQty: Math.max(Math.round(openHandoutTask.qty * 0.008), 4),
              qtyUnit: handoutQtyUnit,
              handoutObjectType,
              handoutItemLabel: `标准色 / ${profile.taskPrefix}-FABRIC-001 / ${Math.max(Math.round(openHandoutTask.qty * 0.008), 4)}卷`,
              factorySubmittedAt: nowLike(28, '15:30:00'),
              status: 'WRITTEN_BACK',
              warehouseReturnNo: `RET-WB-${profile.taskPrefix}-01`,
              warehouseWrittenQty: Math.max(Math.round(openHandoutTask.qty * 0.008), 4),
              warehouseWrittenAt: nowLike(28, '15:55:00'),
              factoryRemark: '主布首批已回仓',
            },
            {
              handoverId: openHandoutHeadId,
              recordId: `${openHandoutHeadId}-002`,
              taskId: openHandoutTask.taskId,
              materialCode: `${profile.taskPrefix}-FAB-002`,
              materialName: '染色主布',
              materialSpec: '主布尾批回仓',
              skuCode: `${profile.taskPrefix}-FABRIC-002`,
              skuColor: '标准色',
              skuSize: '整单',
              plannedQty: Math.max(Math.round(openHandoutTask.qty * 0.006), 3),
              qtyUnit: handoutQtyUnit,
              handoutObjectType,
              handoutItemLabel: `标准色 / ${profile.taskPrefix}-FABRIC-002 / ${Math.max(Math.round(openHandoutTask.qty * 0.006), 3)}卷`,
              factorySubmittedAt: nowLike(28, '17:00:00'),
              status: 'PENDING_WRITEBACK',
              factoryRemark: '主布尾批待仓库回写',
            },
          ]
        : [
            {
              handoverId: openHandoutHeadId,
              recordId: `${openHandoutHeadId}-001`,
              taskId: openHandoutTask.taskId,
              materialCode: `${profile.taskPrefix}-GAR-001`,
              materialName: `${profile.processNameZh}成衣`,
              materialSpec: `${profile.processNameZh}首批交出`,
              skuCode: `${profile.taskPrefix}-SKU-001`,
              skuColor: '标准色',
              skuSize: '整单',
              pieceName: '成衣包',
              plannedQty: Math.max(Math.round(openHandoutTask.qty * 0.34), 60),
              qtyUnit: handoutQtyUnit,
              handoutObjectType,
              handoutItemLabel: `标准色 / ${profile.taskPrefix}-SKU-001 / ${Math.max(Math.round(openHandoutTask.qty * 0.34), 60)}件`,
              factorySubmittedAt: nowLike(28, '15:30:00'),
              status: 'WRITTEN_BACK',
              warehouseReturnNo: `RET-WB-${profile.taskPrefix}-01`,
              warehouseWrittenQty: Math.max(Math.round(openHandoutTask.qty * 0.34), 60),
              warehouseWrittenAt: nowLike(28, '15:55:00'),
              factoryRemark: '首批已完成仓库回写',
            },
            {
              handoverId: openHandoutHeadId,
              recordId: `${openHandoutHeadId}-002`,
              taskId: openHandoutTask.taskId,
              materialCode: `${profile.taskPrefix}-GAR-002`,
              materialName: `${profile.processNameZh}成衣`,
              materialSpec: `${profile.processNameZh}尾批交出`,
              skuCode: `${profile.taskPrefix}-SKU-002`,
              skuColor: '标准色',
              skuSize: '整单',
              pieceName: '成衣包',
              plannedQty: Math.max(Math.round(openHandoutTask.qty * 0.26), 48),
              qtyUnit: handoutQtyUnit,
              handoutObjectType,
              handoutItemLabel: `标准色 / ${profile.taskPrefix}-SKU-002 / ${Math.max(Math.round(openHandoutTask.qty * 0.26), 48)}件`,
              factorySubmittedAt: nowLike(28, '17:00:00'),
              status:
                profile.key === 'SEWING' || profile.key === 'QC'
                  ? 'OBJECTION_REPORTED'
                  : 'PENDING_WRITEBACK',
              warehouseReturnNo:
                profile.key === 'SEWING' || profile.key === 'QC'
                  ? `RET-DIFF-${profile.taskPrefix}-01`
                  : undefined,
              warehouseWrittenQty:
                profile.key === 'SEWING' || profile.key === 'QC'
                  ? Math.max(Math.round(Math.max(Math.round(openHandoutTask.qty * 0.26), 48) * 0.92), 40)
                  : undefined,
              warehouseWrittenAt:
                profile.key === 'SEWING' || profile.key === 'QC'
                  ? nowLike(28, '17:25:00')
                  : undefined,
              receiverWrittenBy:
                profile.key === 'SEWING'
                  ? '后道收货员'
                  : profile.key === 'QC'
                    ? '成衣仓收货员'
                    : undefined,
              factoryRemark:
                profile.key === 'SEWING'
                  ? '尾批已交我方后道工厂，数量异议处理中'
                  : profile.key === 'QC'
                    ? '数量异议待接收方确认'
                    : '尾批待接收方回写',
              objectionReason:
                profile.key === 'SEWING'
                  ? '我方后道工厂回写数量少于工厂交出数量'
                  : profile.key === 'QC'
                    ? '抽检不合格数量差异'
                    : undefined,
              objectionRemark:
                profile.key === 'SEWING'
                  ? '工厂复点与接收方回写不一致，待平台核定。'
                  : profile.key === 'QC'
                    ? '待复核差异责任'
                    : undefined,
            },
          ]

  const doneHandoutRecords: PdaTaskMockHandoutRecordSeed[] =
    handoutObjectType === 'CUT_PIECE'
      ? [
          {
            handoverId: doneHandoutHeadId,
            recordId: `${doneHandoutHeadId}-001`,
            taskId: completedHandoutTask.taskId,
            materialCode: `${profile.taskPrefix}-CUT-003`,
            materialName: '印花裁片',
            materialSpec: '整单交接完成',
            skuCode: `${profile.taskPrefix}-SKU-003`,
            skuColor: '标准色',
            skuSize: '整单',
            pieceName: '前后片整单',
            plannedQty: Math.max(Math.round(completedHandoutTask.qty * 1.1), 180),
            qtyUnit: handoutQtyUnit,
            handoutObjectType,
            handoutItemLabel: `标准色 / ${profile.taskPrefix}-SKU-003 / ${Math.max(Math.round(completedHandoutTask.qty * 1.1), 180)}片 / 前后片整单`,
            garmentEquivalentQty: getGarmentEquivalentQty(Math.max(Math.round(completedHandoutTask.qty * 1.1), 180)),
            factorySubmittedAt: nowLike(28, '16:10:00'),
            status: 'WRITTEN_BACK',
            warehouseReturnNo: `RET-WB-${profile.taskPrefix}-02`,
            warehouseWrittenQty: Math.max(Math.round(completedHandoutTask.qty * 1.1), 180),
            warehouseWrittenAt: nowLike(28, '16:35:00'),
            factoryRemark: '整单裁片已完成交接',
          },
        ]
      : handoutObjectType === 'FABRIC'
        ? [
            {
              handoverId: doneHandoutHeadId,
              recordId: `${doneHandoutHeadId}-001`,
              taskId: completedHandoutTask.taskId,
              materialCode: `${profile.taskPrefix}-FAB-003`,
              materialName: '染色主布',
              materialSpec: '整单回仓完成',
              skuCode: `${profile.taskPrefix}-FABRIC-003`,
              skuColor: '标准色',
              skuSize: '整单',
              plannedQty: Math.max(Math.round(completedHandoutTask.qty * 0.01), 5),
              qtyUnit: handoutQtyUnit,
              handoutObjectType,
              handoutItemLabel: `标准色 / ${profile.taskPrefix}-FABRIC-003 / ${Math.max(Math.round(completedHandoutTask.qty * 0.01), 5)}卷`,
              factorySubmittedAt: nowLike(28, '16:10:00'),
              status: 'WRITTEN_BACK',
              warehouseReturnNo: `RET-WB-${profile.taskPrefix}-02`,
              warehouseWrittenQty: Math.max(Math.round(completedHandoutTask.qty * 0.01), 5),
              warehouseWrittenAt: nowLike(28, '16:35:00'),
              factoryRemark: '整单面料已完成回仓',
            },
          ]
        : [
            {
              handoverId: doneHandoutHeadId,
              recordId: `${doneHandoutHeadId}-001`,
              taskId: completedHandoutTask.taskId,
              materialCode: `${profile.taskPrefix}-GAR-003`,
              materialName: `${profile.processNameZh}成衣`,
              materialSpec: `${profile.processNameZh}整单交接`,
              skuCode: `${profile.taskPrefix}-SKU-003`,
              skuColor: '标准色',
              skuSize: '整单',
              pieceName: '成衣包',
              plannedQty: Math.max(Math.round(completedHandoutTask.qty * 0.55), 100),
              qtyUnit: handoutQtyUnit,
              handoutObjectType,
              handoutItemLabel: `标准色 / ${profile.taskPrefix}-SKU-003 / ${Math.max(Math.round(completedHandoutTask.qty * 0.55), 100)}件`,
              factorySubmittedAt: nowLike(28, '16:10:00'),
              status: 'WRITTEN_BACK',
              warehouseReturnNo: `RET-WB-${profile.taskPrefix}-02`,
              warehouseWrittenQty: Math.max(Math.round(completedHandoutTask.qty * 0.55), 100),
              warehouseWrittenAt: nowLike(28, '16:35:00'),
              factoryRemark: '整单已完成交接',
            },
        ]

  const openHandoutExpectedTotal = roundQty(
    openHandoutRecords.reduce((sum, record) => sum + record.plannedQty, 0),
  )
  const openHandoutWrittenTotal = roundQty(
    openHandoutRecords.reduce((sum, record) => sum + (record.warehouseWrittenQty ?? 0), 0),
  )
  const doneHandoutExpectedTotal = roundQty(
    doneHandoutRecords.reduce((sum, record) => sum + record.plannedQty, 0),
  )
  const doneHandoutWrittenTotal = roundQty(
    doneHandoutRecords.reduce((sum, record) => sum + (record.warehouseWrittenQty ?? 0), 0),
  )

  return {
    heads: [
      {
        handoverId: pickupHeadId,
        headType: 'PICKUP',
        taskId: pickupTask.taskId,
        taskNo: pickupTask.taskNo || pickupTask.taskId,
        productionOrderNo: pickupTask.productionOrderNo,
        processKey: profile.key,
        processName: profile.processNameZh,
        sourceFactoryName: profile.key === 'PRINTING' || profile.key === 'DYEING' ? '主面料仓' : '辅料仓',
        targetName: profile.handoverSourceName,
        targetKind: 'FACTORY',
        qtyUnit: '件',
        factoryId: profile.factoryId,
        taskStatus: 'IN_PROGRESS',
        summaryStatus: 'PARTIAL_WRITTEN_BACK',
        completionStatus: 'OPEN',
        qtyExpectedTotal: Math.max(Math.round(pickupTask.qty * 0.4), 80),
        qtyActualTotal: Math.max(Math.round(pickupTask.qty * 0.18), 36),
        qtyDiffTotal: Math.max(Math.round(pickupTask.qty * 0.22), 44),
        sourceDocNo: `ISS-${profile.taskPrefix}-${String(baseIndex).padStart(3, '0')}`,
        scopeLabel: `${profile.processNameZh}首批领料`,
        stageCode,
        stageName,
        processBusinessCode,
        processBusinessName: profile.processNameZh,
        taskTypeCode: processBusinessCode,
        taskTypeLabel: `${profile.processNameZh}任务`,
        assignmentGranularityLabel: '整单',
      },
      {
        handoverId: openHandoutHeadId,
        headType: 'HANDOUT',
        taskId: openHandoutTask.taskId,
        taskNo: openHandoutTask.taskNo || openHandoutTask.taskId,
        productionOrderNo: openHandoutTask.productionOrderNo,
        processKey: profile.key,
        processName: profile.processNameZh,
        sourceFactoryName: profile.handoverSourceName,
        targetName: profile.handoverTargetName,
        targetKind: profile.handoverTargetKind,
        qtyUnit: handoutQtyUnit,
        factoryId: profile.factoryId,
        taskStatus: 'DONE',
        summaryStatus: profile.key === 'QC' ? 'HAS_OBJECTION' : 'PARTIAL_WRITTEN_BACK',
        completionStatus: 'OPEN',
        qtyExpectedTotal: openHandoutExpectedTotal,
        qtyActualTotal: openHandoutWrittenTotal,
        qtyDiffTotal: roundQty(openHandoutExpectedTotal - openHandoutWrittenTotal),
        sourceDocNo: `RET-${profile.taskPrefix}-${String(baseIndex + 1).padStart(3, '0')}`,
        scopeLabel: `${profile.processNameZh}尾批交出`,
        stageCode,
        stageName,
        processBusinessCode,
        processBusinessName: profile.processNameZh,
        taskTypeCode: processBusinessCode,
        taskTypeLabel: `${profile.processNameZh}任务`,
        assignmentGranularityLabel: '整单',
      },
      {
        handoverId: doneHandoutHeadId,
        headType: 'HANDOUT',
        taskId: completedHandoutTask.taskId,
        taskNo: completedHandoutTask.taskNo || completedHandoutTask.taskId,
        productionOrderNo: completedHandoutTask.productionOrderNo,
        processKey: profile.key,
        processName: profile.processNameZh,
        sourceFactoryName: profile.handoverSourceName,
        targetName: profile.handoverTargetName,
        targetKind: profile.handoverTargetKind,
        qtyUnit: handoutQtyUnit,
        factoryId: profile.factoryId,
        taskStatus: 'DONE',
        summaryStatus: 'WRITTEN_BACK',
        completionStatus: 'COMPLETED',
        completedByWarehouseAt: nowLike(28, '18:40:00'),
        qtyExpectedTotal: doneHandoutExpectedTotal,
        qtyActualTotal: doneHandoutWrittenTotal,
        qtyDiffTotal: roundQty(doneHandoutExpectedTotal - doneHandoutWrittenTotal),
        sourceDocNo: `RET-${profile.taskPrefix}-${String(baseIndex + 2).padStart(3, '0')}`,
        scopeLabel: `${profile.processNameZh}整单交接完成`,
        stageCode,
        stageName,
        processBusinessCode,
        processBusinessName: profile.processNameZh,
        taskTypeCode: processBusinessCode,
        taskTypeLabel: `${profile.processNameZh}任务`,
        assignmentGranularityLabel: '整单',
      },
    ],
    pickupRecordsByHeadId: {
      [pickupHeadId]: [
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-001`,
          taskId: pickupTask.taskId,
          sequenceNo: 1,
          materialCode: `${profile.taskPrefix}-MAT-001`,
          materialSummary: `${profile.materialSummary}首批待配`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}首批执行用料`,
          skuCode: `${profile.taskPrefix}-SKU-001`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '首批用料',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.1), 24),
          qtyUnit: '件',
          submittedAt: nowLike(28, '08:40:00'),
          status: 'PENDING_WAREHOUSE_DISPATCH',
          pickupMode: 'WAREHOUSE_DELIVERY',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-001`,
          remark: '仓库待发出，尚未完成扫码交付',
        },
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-002`,
          taskId: pickupTask.taskId,
          sequenceNo: 2,
          materialCode: `${profile.taskPrefix}-MAT-002`,
          materialSummary: `${profile.materialSummary}余料`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}余料补批`,
          skuCode: `${profile.taskPrefix}-SKU-002`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '余料补批',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.12), 28),
          qtyUnit: '件',
          submittedAt: nowLike(28, '09:20:00'),
          status: 'PENDING_FACTORY_PICKUP',
          pickupMode: 'FACTORY_PICKUP',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-002`,
          remark: '仓库已备齐，待工厂到仓自提',
        },
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-003`,
          taskId: pickupTask.taskId,
          sequenceNo: 3,
          materialCode: `${profile.taskPrefix}-MAT-003`,
          materialSummary: `${profile.materialSummary}二批配送`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}二批执行用料`,
          skuCode: `${profile.taskPrefix}-SKU-003`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '二批用料',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.08), 20),
          qtyUnit: '件',
          submittedAt: nowLike(28, '10:10:00'),
          status: 'PENDING_FACTORY_CONFIRM',
          pickupMode: 'WAREHOUSE_DELIVERY',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-003`,
          warehouseHandedQty: Math.max(Math.round(pickupTask.qty * 0.08), 20),
          warehouseHandedAt: nowLike(28, '11:00:00'),
          warehouseHandedBy: '仓库扫码员',
          remark: '仓库已扫码交付，待工厂确认本次领料',
        },
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-004`,
          taskId: pickupTask.taskId,
          sequenceNo: 4,
          materialCode: `${profile.taskPrefix}-MAT-004`,
          materialSummary: `${profile.materialSummary}首批已确认`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}首批执行用料`,
          skuCode: `${profile.taskPrefix}-SKU-004`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '首批已确认',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.1), 24),
          qtyActual: Math.max(Math.round(pickupTask.qty * 0.1), 24),
          qtyUnit: '件',
          submittedAt: nowLike(28, '07:50:00'),
          status: 'RECEIVED',
          receivedAt: nowLike(28, '09:15:00'),
          pickupMode: 'WAREHOUSE_DELIVERY',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-004`,
          warehouseHandedQty: Math.max(Math.round(pickupTask.qty * 0.1), 24),
          warehouseHandedAt: nowLike(28, '08:30:00'),
          warehouseHandedBy: '仓库扫码员',
          factoryConfirmedQty: Math.max(Math.round(pickupTask.qty * 0.1), 24),
          factoryConfirmedAt: nowLike(28, '09:15:00'),
          remark: '工厂已确认本次领料',
        },
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-005`,
          taskId: pickupTask.taskId,
          sequenceNo: 5,
          materialCode: `${profile.taskPrefix}-MAT-005`,
          materialSummary: `${profile.materialSummary}三批异议`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}三批执行用料`,
          skuCode: `${profile.taskPrefix}-SKU-005`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '三批异议',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.06), 16),
          qtyUnit: '件',
          submittedAt: nowLike(28, '11:40:00'),
          status: 'OBJECTION_REPORTED',
          pickupMode: 'WAREHOUSE_DELIVERY',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-005`,
          warehouseHandedQty: Math.max(Math.round(pickupTask.qty * 0.06), 16),
          warehouseHandedAt: nowLike(28, '12:10:00'),
          warehouseHandedBy: '仓库扫码员',
          factoryReportedQty: Math.max(Math.round(pickupTask.qty * 0.05), 14),
          exceptionCaseId: `EX-PDA-PICK-${profile.taskPrefix}-001`,
          objectionReason: '工厂复点少于仓库交付数量',
          objectionRemark: '现场复点少 2 件，待平台核定。',
          objectionProofFiles: [
            {
              id: `proof-${pickupHeadId}-005-1`,
              type: 'IMAGE',
              name: '领料差异照片_01.jpg',
              uploadedAt: nowLike(28, '12:18:00'),
            },
          ],
          objectionStatus: 'REPORTED',
          remark: '工厂已发起数量差异',
        },
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-006`,
          taskId: pickupTask.taskId,
          sequenceNo: 6,
          materialCode: `${profile.taskPrefix}-MAT-006`,
          materialSummary: `${profile.materialSummary}四批已裁定`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}四批执行用料`,
          skuCode: `${profile.taskPrefix}-SKU-006`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '四批已裁定',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.05), 12),
          qtyUnit: '件',
          submittedAt: nowLike(28, '12:30:00'),
          status: 'OBJECTION_RESOLVED',
          pickupMode: 'WAREHOUSE_DELIVERY',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-006`,
          warehouseHandedQty: Math.max(Math.round(pickupTask.qty * 0.05), 12),
          warehouseHandedAt: nowLike(28, '13:00:00'),
          warehouseHandedBy: '仓库扫码员',
          factoryReportedQty: Math.max(Math.round(pickupTask.qty * 0.04), 10),
          finalResolvedQty: Math.max(Math.round(pickupTask.qty * 0.04), 10),
          finalResolvedAt: nowLike(28, '15:20:00'),
          exceptionCaseId: `EX-PDA-PICK-${profile.taskPrefix}-002`,
          objectionReason: '工厂复点少于仓库交付数量',
          objectionRemark: '平台已核定以工厂实收为准。',
          objectionProofFiles: [
            {
              id: `proof-${pickupHeadId}-006-1`,
              type: 'IMAGE',
              name: '平台复点照片_01.jpg',
              uploadedAt: nowLike(28, '15:00:00'),
            },
          ],
          objectionStatus: 'RESOLVED',
          resolvedRemark: '平台复点确认工厂实收 10 件，按最终确认数量回写。',
          remark: '平台已处理完成',
        },
        {
          handoverId: pickupHeadId,
          recordId: `${pickupHeadId}-007`,
          taskId: pickupTask.taskId,
          sequenceNo: 7,
          materialCode: `${profile.taskPrefix}-MAT-007`,
          materialSummary: `${profile.materialSummary}驳回批次`,
          materialName: profile.materialSummary,
          materialSpec: `${profile.processNameZh}驳回批次`,
          skuCode: `${profile.taskPrefix}-SKU-007`,
          skuColor: '标准色',
          skuSize: '整单',
          pieceName: '驳回批次',
          qtyExpected: Math.max(Math.round(pickupTask.qty * 0.04), 10),
          qtyActual: 0,
          qtyUnit: '件',
          submittedAt: nowLike(28, '13:20:00'),
          status: 'REJECTED',
          pickupMode: 'WAREHOUSE_DELIVERY',
          qrCodeValue: `PICKUP-RECORD:${pickupHeadId}-007`,
          warehouseHandedQty: Math.max(Math.round(pickupTask.qty * 0.04), 10),
          warehouseHandedAt: nowLike(28, '13:40:00'),
          warehouseHandedBy: '仓库扫码员',
          factoryConfirmedAt: nowLike(28, '13:55:00'),
          objectionReason: '到货内容与领料记录不一致',
          objectionRemark: '工厂驳回本次领料，等待重新发料。',
          followUpRemark: '驳回记录不进入待加工仓',
          remark: '驳回后不生成入库记录',
        },
      ],
    },
    handoutRecordsByHeadId: {
      [openHandoutHeadId]: openHandoutRecords,
      [doneHandoutHeadId]: doneHandoutRecords,
    },
  }
}

const directTasks = PROCESS_PROFILES
  .filter((profile) => profile.key !== 'PRINTING' && profile.key !== 'DYEING')
  .flatMap((profile, index) => buildDirectTaskSet(profile, index + 51))

const biddingTasks = PROCESS_PROFILES
  .filter((profile) => profile.key === 'PRINTING' || profile.key === 'DYEING')
  .flatMap((profile, index) => buildBiddingTaskSet(profile, index + 71))

const PDA_GENERIC_PROCESS_TASKS: PdaGenericTaskMock[] = [...directTasks, ...biddingTasks]
const PDA_TEST_FACTORY_PROCESS_TASKS: PdaGenericTaskMock[] = PDA_GENERIC_PROCESS_TASKS
  .slice(0, 4)
  .map((task, index) => {
    const taskId = `${task.taskId}-F090-${index + 1}`
    return {
      ...task,
      taskId,
      taskNo: taskId,
      tenderId: task.tenderId ? `${task.tenderId}-F090-${index + 1}` : undefined,
      assignedFactoryId: TEST_FACTORY_ID,
      assignedFactoryName: '全能力测试工厂',
      taskQrValue: task.taskQrValue ? buildTaskQrValue(taskId) : task.taskQrValue,
      auditLogs: task.auditLogs.map((log, logIndex) => ({
        ...log,
        id: `${log.id}-F090-${index + 1}-${logIndex + 1}`,
      })),
    }
  })

const handoverSeedCollections = PROCESS_PROFILES.filter((profile) => isExternalMockProcess(profile)).map((profile, index) =>
  buildHandoverSeeds(
    profile,
    PDA_GENERIC_PROCESS_TASKS.filter((task) => task.mockProcessKey === profile.key),
    400 + index * 3,
  ),
)

const PDA_GENERIC_HANDOVER_HEADS = handoverSeedCollections.flatMap((item) => item.heads)
const PDA_GENERIC_PICKUP_RECORDS_BY_HEAD_ID = Object.assign({}, ...handoverSeedCollections.map((item) => item.pickupRecordsByHeadId))
const PDA_GENERIC_HANDOUT_RECORDS_BY_HEAD_ID = Object.assign({}, ...handoverSeedCollections.map((item) => item.handoutRecordsByHeadId))

const PDA_GENERIC_BIDDING_TENDERS: PdaMobileBiddingTenderMock[] = PDA_GENERIC_PROCESS_TASKS
  .filter((task) => task.mockOrigin === 'BIDDING_PENDING')
  .map((task) => ({
    tenderId: task.tenderId || `TENDER-${task.taskId}`,
    taskId: task.taskId,
    productionOrderId: task.productionOrderNo,
    processName: task.processNameZh,
    qty: task.qty,
    qtyUnit: '件',
    factoryPoolCount: PROCESS_PROFILES.find((item) => item.key === task.mockProcessKey)?.biddingFactoryPoolCount || 3,
    biddingDeadline: task.taskDeadline,
    taskDeadline: task.taskDeadline || '',
    standardPrice: task.standardPrice || 0,
    currency: task.standardPriceCurrency || 'CNY',
    factoryId: task.assignedFactoryId || '',
  }))

const PDA_GENERIC_QUOTED_TENDERS: PdaMobileQuotedTenderMock[] = PDA_GENERIC_PROCESS_TASKS
  .filter((task) => task.mockOrigin === 'BIDDING_QUOTED')
  .map((task, index) => ({
    tenderId: task.tenderId || `TENDER-${task.taskId}`,
    taskId: task.taskId,
    productionOrderId: task.productionOrderNo,
    processName: task.processNameZh,
    qty: task.qty,
    qtyUnit: '件',
    quotedPrice: (task.standardPrice || 0) + 0.25 + index * 0.05,
    quotedAt: task.dispatchedAt || task.createdAt,
    deliveryDays: 3 + (index % 2),
    currency: task.standardPriceCurrency || 'CNY',
    unit: '件',
    biddingDeadline: task.taskDeadline || '',
    taskDeadline: task.taskDeadline || '',
    tenderStatusLabel: '招标中',
    remark: `${task.processNameZh}报价已提交，待平台定标。`,
    factoryId: task.assignedFactoryId || '',
  }))

const PDA_GENERIC_AWARDED_TENDER_NOTICES: PdaMobileAwardedTenderNoticeMock[] = PDA_GENERIC_PROCESS_TASKS
  .filter((task) => task.assignmentMode === 'BIDDING' && task.assignmentStatus === 'AWARDED')
  .map((task) => ({
    tenderId: task.tenderId || `TENDER-${task.taskId}`,
    taskId: task.taskId,
    processName: task.processNameZh,
    qty: task.qty,
    notifiedAt: task.awardedAt || task.updatedAt || task.createdAt,
    productionOrderId: task.productionOrderNo,
    factoryId: task.assignedFactoryId || '',
  }))

export function listPdaGenericProcessTasks(): PdaGenericTaskMock[] {
  return [...PDA_GENERIC_PROCESS_TASKS, ...PDA_TEST_FACTORY_PROCESS_TASKS]
}

export function listPdaGenericBiddingTenderMocks(): PdaMobileBiddingTenderMock[] {
  return PDA_GENERIC_BIDDING_TENDERS.map((item) => ({ ...item }))
}

export function listPdaGenericQuotedTenderMocks(): PdaMobileQuotedTenderMock[] {
  return PDA_GENERIC_QUOTED_TENDERS.map((item) => ({ ...item }))
}

export function listPdaGenericAwardedTenderNoticeMocks(): PdaMobileAwardedTenderNoticeMock[] {
  return PDA_GENERIC_AWARDED_TENDER_NOTICES.map((item) => ({ ...item }))
}

export function listPdaGenericHandoverHeadSeeds(): PdaTaskMockHandoverHeadSeed[] {
  return PDA_GENERIC_HANDOVER_HEADS.map((item) => ({ ...item }))
}

export function getPdaGenericPickupRecordSeedsByHeadId(handoverId: string): PdaTaskMockPickupRecordSeed[] {
  return (PDA_GENERIC_PICKUP_RECORDS_BY_HEAD_ID[handoverId] ?? []).map((item) => ({ ...item }))
}

export function getPdaGenericHandoutRecordSeedsByHeadId(handoverId: string): PdaTaskMockHandoutRecordSeed[] {
  return (PDA_GENERIC_HANDOUT_RECORDS_BY_HEAD_ID[handoverId] ?? []).map((item) => ({ ...item }))
}

export function listPdaGenericTasksByFactory(factoryId: string): PdaGenericTaskMock[] {
  return listPdaGenericProcessTasks().filter((task) => task.assignedFactoryId === factoryId)
}

export function listPdaGenericTasksByProcess(processKey: Exclude<PdaMobileProcessKey, 'CUTTING'>): PdaGenericTaskMock[] {
  return listPdaGenericProcessTasks().filter((task) => task.mockProcessKey === processKey)
}
