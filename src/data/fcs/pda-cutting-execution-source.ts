import { buildFcsCuttingDomainSnapshot, type CuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import {
  getGeneratedOriginalCutOrderSourceRecordById,
  type GeneratedOriginalCutOrderSourceRecord,
} from './cutting/generated-original-cut-orders.ts'
import {
  getPdaCuttingExecutionSourceRecord,
  getPdaCuttingTaskSourceRecord,
  listPdaCuttingTaskSourceRecords,
  listPdaCuttingExecutionSourceRecords,
  type PdaCuttingExecutionSourceRecord,
  type PdaCuttingTaskSourceRecord,
} from './cutting/pda-cutting-task-source.ts'
import {
  matchPdaExecutionRecord,
  toLegacyCutPieceOrderNo,
} from './pda-cutting-legacy-compat.ts'
import { findPdaHandoverHead } from './pda-handover-events.ts'
import { getTaskChainTaskById, listTaskChainTasks } from './page-adapters/task-chain-pages-adapter.ts'
import type { ProcessTask } from './process-tasks.ts'
import {
  PDA_MOCK_AWARDED_TENDER_NOTICES,
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
} from './pda-mobile-mock.ts'
import type {
  PdaCutPieceHandoverWritebackRecord,
  PdaCutPieceInboundWritebackRecord,
  PdaPickupWritebackRecord,
  PdaReplenishmentFeedbackWritebackRecord,
} from './cutting/pda-execution-writeback-ledger.ts'
import type { MarkerSpreadingStore, SpreadingOperatorRecord, SpreadingRollRecord, SpreadingSession } from './cutting/marker-spreading-ledger.ts'
import { getLatestClaimDisputeByOriginalCutOrderNo } from '../../state/fcs-claim-dispute-store.ts'

export type PdaTaskEntryMode = 'DEFAULT' | 'CUTTING_SPECIAL'
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

export interface PdaTaskFlowProjectedTask extends ProcessTask {
  taskType: string
  taskTypeLabel: string
  factoryType: string
  factoryTypeLabel: string
  supportsCuttingSpecialActions: boolean
  entryMode: PdaTaskEntryMode
  productionOrderNo?: string
  originalCutOrderIds?: string[]
  originalCutOrderNos?: string[]
  mergeBatchIds?: string[]
  mergeBatchNos?: string[]
  executionOrderIds?: string[]
  executionOrderNos?: string[]
  defaultExecutionOrderId?: string
  defaultExecutionOrderNo?: string
  cutPieceOrderCount?: number
  completedCutPieceOrderCount?: number
  pendingCutPieceOrderCount?: number
  exceptionCutPieceOrderCount?: number
  taskProgressLabel?: string
  taskStateLabel?: string
  taskNextActionLabel?: string
  hasMultipleCutPieceOrders?: boolean
  taskReadyForDirectExec?: boolean
  summary: PdaTaskSummary
}

export interface PdaCuttingTaskOrderLine {
  executionOrderId: string
  executionOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
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

export interface PdaCuttingPickupLog {
  executionOrderId: string
  id: string
  scannedAt: string
  operatorName: string
  resultLabel: string
  note: string
  photoProofCount: number
}

export interface PdaCuttingSpreadingRecord {
  executionOrderId: string
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
  executionOrderId: string
  id: string
  scannedAt: string
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

export interface PdaCuttingHandoverRecord {
  executionOrderId: string
  id: string
  handoverAt: string
  operatorName: string
  targetLabel: string
  resultLabel: string
  note: string
}

export interface PdaCuttingReplenishmentFeedbackRecord {
  executionOrderId: string
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
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchIds: string[]
  mergeBatchNos: string[]
  executionOrderId: string
  executionOrderNo: string
  // Boundary-only alias for frozen legacy pickup adapters.
  cutPieceOrderNo: string
  cutPieceOrders: PdaCuttingTaskOrderLine[]
  cutPieceOrderCount: number
  completedCutPieceOrderCount: number
  pendingCutPieceOrderCount: number
  exceptionCutPieceOrderCount: number
  defaultExecutionOrderId: string
  defaultExecutionOrderNo: string
  currentSelectedExecutionOrderId: string | null
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

export interface PdaCuttingRouteOptions {
  executionOrderId?: string
  executionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  returnTo?: string
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null))) as T[]
}

function mapTaskStatusLabel(status: ProcessTask['status']): string {
  if (status === 'DONE') return '已完成'
  if (status === 'BLOCKED') return '有异常'
  if (status === 'IN_PROGRESS') return '进行中'
  return '待开始'
}

function mapMaterialTypeLabel(record: GeneratedOriginalCutOrderSourceRecord | null): string {
  if (!record) return '待补面料类型'
  if (record.materialCategory) return record.materialCategory
  if (record.materialType === 'PRINT') return '印花主料'
  if (record.materialType === 'DYE') return '染色主料'
  if (record.materialType === 'LINING') return '里辅料'
  return '净色 / 拼接主料'
}

function mapReceiveStatusLabel(status: string | undefined): string {
  if (status === 'RECEIVED') return '领取成功'
  if (status === 'PARTIAL') return '部分领取'
  return '待领料确认'
}

function buildPickupSlipNo(originalCutOrderNo: string): string {
  return `LLD-${originalCutOrderNo.replace(/^CUT-/, '')}`
}

function buildQrCodeValue(originalCutOrderNo: string): string {
  return `QR-${originalCutOrderNo}`
}

function buildConfiguredQtyText(record: GeneratedOriginalCutOrderSourceRecord, configuredLength = 0, configuredRollCount = 0): string {
  if (configuredRollCount > 0 || configuredLength > 0) {
    return `卷数 ${configuredRollCount || 0} 卷 / 长度 ${configuredLength || 0} 米`
  }
  const estimatedRollCount = Math.max(1, Math.ceil(record.requiredQty / 40))
  const estimatedLength = Math.max(record.requiredQty * 2, estimatedRollCount * 30)
  return `卷数 ${estimatedRollCount} 卷 / 长度 ${estimatedLength} 米`
}

function buildActualReceivedQtyText(input: {
  latestPickup: PdaPickupWritebackRecord | null
  receivedLength?: number
  receivedRollCount?: number
}): string {
  if (input.latestPickup?.actualReceivedQtyText) return input.latestPickup.actualReceivedQtyText
  if ((input.receivedRollCount || 0) > 0 || (input.receivedLength || 0) > 0) {
    return `卷数 ${input.receivedRollCount || 0} 卷 / 长度 ${input.receivedLength || 0} 米`
  }
  return '待扫码回写'
}

function getSnapshot(snapshot?: CuttingDomainSnapshot): CuttingDomainSnapshot {
  return snapshot ?? buildFcsCuttingDomainSnapshot()
}

function buildFallbackCuttingTaskFact(record: PdaCuttingTaskSourceRecord): ProcessTask {
  const firstExecution = getSourceExecutionsByTaskId(record.taskId)[0] ?? null
  const originalRecord = firstExecution?.originalCutOrderId
    ? getGeneratedOriginalCutOrderSourceRecordById(firstExecution.originalCutOrderId)
    : null
  const awardedNotice = PDA_MOCK_AWARDED_TENDER_NOTICES.find((item) => item.taskId === record.taskId) ?? null
  const quotedTender = PDA_MOCK_QUOTED_TENDERS.find((item) => item.taskId === record.taskId) ?? null
  const biddingTender = PDA_MOCK_BIDDING_TENDERS.find((item) => item.taskId === record.taskId) ?? null
  const isBiddingTask = record.taskId.includes('-BID-') || Boolean(awardedNotice || quotedTender || biddingTender)
  const assignmentStatus = awardedNotice ? 'AWARDED' : isBiddingTask ? 'BIDDING' : 'ASSIGNED'
  const assignmentMode = isBiddingTask ? 'BIDDING' : 'DIRECT'
  const baseAt = awardedNotice?.notifiedAt || quotedTender?.quotedAt || biddingTender?.biddingDeadline || '2026-03-22 08:00:00'
  const qty = originalRecord?.requiredQty || quotedTender?.qty || biddingTender?.qty || awardedNotice?.qty || 0
  const pricing = quotedTender?.quotedPrice || biddingTender?.standardPrice || 6.5
  const task = {
    taskId: record.taskId,
    taskNo: record.taskNo || record.taskId,
    productionOrderId: record.productionOrderId,
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty,
    qtyUnit: 'PIECE',
    assignmentMode,
    assignmentStatus,
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: 'ID-F001',
    assignedFactoryName: 'PT Sinar Garment Indonesia',
    qcPoints: [],
    attachments: [],
    status: awardedNotice ? 'IN_PROGRESS' : 'NOT_STARTED',
    acceptDeadline: '2026-03-28 10:00:00',
    taskDeadline: awardedNotice?.notifiedAt ? '2026-03-29 18:00:00' : '2026-03-28 20:00:00',
    dispatchRemark: 'PDA 裁片执行投影任务',
    dispatchedAt: baseAt,
    dispatchedBy: '系统派单',
    standardPrice: pricing,
    standardPriceCurrency: quotedTender?.currency || biddingTender?.currency || 'CNY',
    standardPriceUnit: quotedTender?.unit || quotedTender?.qtyUnit || biddingTender?.qtyUnit || '件',
    dispatchPrice: awardedNotice ? pricing : undefined,
    dispatchPriceCurrency: quotedTender?.currency || biddingTender?.currency || 'CNY',
    dispatchPriceUnit: quotedTender?.unit || quotedTender?.qtyUnit || biddingTender?.qtyUnit || '件',
    priceDiffReason: isBiddingTask ? 'PDA 裁片投影中标价' : 'PDA 裁片投影派单价',
    acceptanceStatus: isBiddingTask ? undefined : 'PENDING',
    acceptedAt: awardedNotice ? awardedNotice.notifiedAt : undefined,
    awardedAt: awardedNotice?.notifiedAt,
    acceptedBy: awardedNotice ? '平台自动下发' : undefined,
    rootTaskNo: record.taskNo || record.taskId,
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    createdAt: baseAt,
    updatedAt: baseAt,
    auditLogs: [
      {
        id: `AL-${record.taskId}`,
        action: isBiddingTask ? (awardedNotice ? 'AWARDED' : 'BIDDING_OPEN') : 'DISPATCHED',
        detail: isBiddingTask
          ? awardedNotice
            ? '裁片竞价中标后已同步为 PDA 执行任务'
            : '裁片竞价任务已同步为 PDA 执行投影'
          : '裁片直接派单任务已同步为 PDA 执行投影',
        at: baseAt,
        by: 'SYSTEM',
      },
    ],
  } satisfies ProcessTask

  return Object.assign(task, {
    productionOrderNo: firstExecution?.productionOrderNo || record.productionOrderNo,
  })
}

function getMarkerStore(snapshot: CuttingDomainSnapshot): MarkerSpreadingStore {
  return snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore
}

function listTaskFacts(): ProcessTask[] {
  const runtimeTasks = listTaskChainTasks()
  const runtimeTaskIds = new Set(runtimeTasks.map((task) => task.taskId))
  const fallbackCuttingTasks = listPdaCuttingTaskSourceRecords()
    .filter((record) => !runtimeTaskIds.has(record.taskId))
    .map((record) => buildFallbackCuttingTaskFact(record))

  return [...runtimeTasks, ...fallbackCuttingTasks]
}

function getRuntimeTask(taskId: string): ProcessTask | null {
  return getTaskChainTaskById(taskId) ?? null
}

function getSourceExecutionsByTaskId(taskId: string): PdaCuttingExecutionSourceRecord[] {
  return listPdaCuttingExecutionSourceRecords()
    .filter((record) => record.taskId === taskId)
    .sort((left, right) => left.executionOrderNo.localeCompare(right.executionOrderNo, 'zh-CN'))
}

function getProgressLine(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord) {
  for (const record of snapshot.progressRecords) {
    const line = record.materialLines.find((item) => item.originalCutOrderId === execution.originalCutOrderId || item.originalCutOrderNo === execution.originalCutOrderNo)
    if (line) return line
  }
  return null
}

function getOriginalCutOrderRecord(execution: PdaCuttingExecutionSourceRecord) {
  if (!execution.originalCutOrderId) return null
  return getGeneratedOriginalCutOrderSourceRecordById(execution.originalCutOrderId)
}

function getLatestPickup(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaPickupWritebackRecord | null {
  const rows = snapshot.pdaExecutionState.pickupWritebacks as unknown as PdaPickupWritebackRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.originalCutOrderId === execution.originalCutOrderId) ?? null
}

function getLatestInbound(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCutPieceInboundWritebackRecord | null {
  const rows = snapshot.pdaExecutionState.inboundWritebacks as unknown as PdaCutPieceInboundWritebackRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.originalCutOrderId === execution.originalCutOrderId) ?? null
}

function getLatestHandover(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCutPieceHandoverWritebackRecord | null {
  const rows = snapshot.pdaExecutionState.handoverWritebacks as unknown as PdaCutPieceHandoverWritebackRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.originalCutOrderId === execution.originalCutOrderId) ?? null
}

function getLatestReplenishment(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaReplenishmentFeedbackWritebackRecord | null {
  const rows = snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as unknown as PdaReplenishmentFeedbackWritebackRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.originalCutOrderId === execution.originalCutOrderId) ?? null
}

function listSessionsForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): SpreadingSession[] {
  const store = getMarkerStore(snapshot)
  return (store.sessions || [])
    .filter((session) => session.originalCutOrderIds.includes(execution.originalCutOrderId) || (execution.mergeBatchId && session.mergeBatchId === execution.mergeBatchId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

function listRollsForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): Array<{ session: SpreadingSession; roll: SpreadingRollRecord }> {
  return listSessionsForExecution(snapshot, execution).flatMap((session) =>
    session.rolls.map((roll) => ({ session, roll })),
  )
}

function listOperatorsForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): Array<{ session: SpreadingSession; operator: SpreadingOperatorRecord }> {
  return listSessionsForExecution(snapshot, execution).flatMap((session) =>
    session.operators.map((operator) => ({ session, operator })),
  )
}

function buildReplenishmentLabel(latestReplenishment: PdaReplenishmentFeedbackRecord | null): string {
  if (!latestReplenishment) return '当前无补料风险'
  return `${latestReplenishment.reasonLabel}，待工艺工厂跟进`
}

function resolveNextAction(line: {
  pickupSuccess: boolean
  hasSpreading: boolean
  hasInbound: boolean
  hasHandover: boolean
  replenishmentLabel: string
  hasException: boolean
}): string {
  if (!line.pickupSuccess) return '扫码领料'
  if (!line.hasSpreading) return '铺布录入'
  if (!line.hasInbound) return '入仓扫码'
  if (!line.hasHandover) return '交接扫码'
  if (line.replenishmentLabel !== '当前无补料风险') return '补料反馈'
  if (line.hasException) return '查看异常'
  return '查看当前情况'
}

function resolveCurrentState(line: {
  pickupSuccess: boolean
  hasSpreading: boolean
  hasInbound: boolean
  hasHandover: boolean
  replenishmentLabel: string
  hasException: boolean
}): string {
  if (line.hasException && !line.pickupSuccess) return '领料差异待处理'
  if (!line.pickupSuccess) return '待领料'
  if (!line.hasSpreading) return '待铺布'
  if (!line.hasInbound) return '待入仓'
  if (!line.hasHandover) return '待交接'
  if (line.replenishmentLabel !== '当前无补料风险') return '补料风险待关注'
  return '已完成'
}

function listRiskTips(line: {
  disputeSummary?: string
  replenishmentLabel: string
  hasInbound: boolean
  hasHandover: boolean
}): string[] {
  const tips: string[] = []
  if (line.disputeSummary) tips.push(line.disputeSummary)
  if (!line.hasInbound) tips.push('当前尚未完成入仓扫码，后续仓务无法稳定回流。')
  if (!line.hasHandover) tips.push('当前尚未完成交接扫码，后道承接状态未闭环。')
  if (line.replenishmentLabel !== '当前无补料风险') tips.push(line.replenishmentLabel)
  return unique(tips)
}

function buildTaskOrderLine(
  execution: PdaCuttingExecutionSourceRecord,
  sortOrder: number,
  snapshot: CuttingDomainSnapshot,
): PdaCuttingTaskOrderLine {
  const progressLine = getProgressLine(snapshot, execution)
  const originalRecord = getOriginalCutOrderRecord(execution)
  const latestPickup = getLatestPickup(snapshot, execution)
  const latestInbound = getLatestInbound(snapshot, execution)
  const latestHandover = getLatestHandover(snapshot, execution)
  const latestReplenishment = getLatestReplenishment(snapshot, execution)
  const sessions = listSessionsForExecution(snapshot, execution)
  const pickupDispute = execution.originalCutOrderNo ? getLatestClaimDisputeByOriginalCutOrderNo(execution.originalCutOrderNo) : null
  const currentReceiveStatus =
    pickupDispute && pickupDispute.status !== 'COMPLETED' && pickupDispute.status !== 'REJECTED'
      ? '领料异议处理中'
      : latestPickup?.resultLabel || mapReceiveStatusLabel(progressLine?.receiveStatus)
  const hasPickupSuccess = Boolean(latestPickup?.resultLabel?.includes('成功')) || progressLine?.receiveStatus === 'RECEIVED'
  const hasSpreading = sessions.length > 0
  const currentExecutionStatus = hasSpreading ? `已有 ${sessions.length} 条铺布记录` : '待铺布录入'
  const hasInbound = Boolean(latestInbound)
  const currentInboundStatus = latestInbound ? '已入仓' : '待入仓扫码'
  const hasHandover = Boolean(latestHandover)
  const currentHandoverStatus = latestHandover ? '已交接' : '待交接扫码'
  const replenishmentRiskLabel = buildReplenishmentLabel(latestReplenishment)
  const hasException = currentReceiveStatus.includes('异议') || replenishmentRiskLabel !== '当前无补料风险' || execution.bindingState === 'UNBOUND'
  const currentStateLabel = resolveCurrentState({
    pickupSuccess: hasPickupSuccess,
    hasSpreading,
    hasInbound,
    hasHandover,
    replenishmentLabel: replenishmentRiskLabel,
    hasException,
  })
  return {
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    productionOrderId: execution.productionOrderId,
    productionOrderNo: execution.productionOrderNo,
    originalCutOrderId: execution.originalCutOrderId,
    originalCutOrderNo: execution.originalCutOrderNo,
    mergeBatchId: execution.mergeBatchId,
    mergeBatchNo: execution.mergeBatchNo,
    materialSku: execution.materialSku,
    materialTypeLabel: mapMaterialTypeLabel(originalRecord),
    colorLabel: originalRecord?.colorScope.join(' / ') || progressLine?.color || '',
    plannedQty: originalRecord?.requiredQty || 0,
    currentReceiveStatus,
    currentExecutionStatus,
    currentInboundStatus,
    currentHandoverStatus,
    replenishmentRiskLabel,
    currentStateLabel,
    nextActionLabel: resolveNextAction({
      pickupSuccess: hasPickupSuccess,
      hasSpreading,
      hasInbound,
      hasHandover,
      replenishmentLabel: replenishmentRiskLabel,
      hasException,
    }),
    qrCodeValue: buildQrCodeValue(execution.originalCutOrderNo || execution.executionOrderNo),
    pickupSlipNo: buildPickupSlipNo(execution.originalCutOrderNo || execution.executionOrderNo),
    isDone: hasPickupSuccess && hasSpreading && hasInbound && hasHandover && replenishmentRiskLabel === '当前无补料风险',
    hasException,
    sortOrder,
  }
}

function buildPickupLogs(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingPickupLog[] {
  const latestPickup = getLatestPickup(snapshot, execution)
  if (!latestPickup) return []
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestPickup.writebackId,
    scannedAt: latestPickup.submittedAt,
    operatorName: latestPickup.operatorName,
    resultLabel: latestPickup.resultLabel,
    note: latestPickup.discrepancyNote,
    photoProofCount: latestPickup.photoProofCount,
  }]
}

function buildSpreadingRecords(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingRecord[] {
  return listRollsForExecution(snapshot, execution).map(({ session, roll }) => ({
    executionOrderId: execution.executionOrderId,
    id: roll.rollRecordId,
    fabricRollNo: roll.rollNo,
    layerCount: roll.layerCount,
    actualLength: roll.actualLength,
    headLength: roll.headLength,
    tailLength: roll.tailLength,
    calculatedLength: roll.actualLength + roll.headLength + roll.tailLength,
    enteredBy: roll.operatorNames[0] || session.operators[0]?.operatorName || '现场铺布员',
    enteredAt: roll.updatedFromPdaAt || session.updatedAt,
    sourceType: roll.sourceChannel === 'PDA_WRITEBACK' ? 'PDA' : 'PCS',
    note: roll.note,
  }))
}

function buildInboundRecords(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingInboundRecord[] {
  const latestInbound = getLatestInbound(snapshot, execution)
  if (!latestInbound) return []
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestInbound.writebackId,
    scannedAt: latestInbound.submittedAt,
    operatorName: latestInbound.operatorName,
    zoneCode: latestInbound.zoneCode,
    locationLabel: latestInbound.locationLabel,
    note: latestInbound.note,
  }]
}

function buildHandoverRecords(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingHandoverRecord[] {
  const latestHandover = getLatestHandover(snapshot, execution)
  if (!latestHandover) return []
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestHandover.writebackId,
    handoverAt: latestHandover.submittedAt,
    operatorName: latestHandover.operatorName,
    targetLabel: latestHandover.targetLabel,
    resultLabel: '交接扫码确认完成',
    note: latestHandover.note,
  }]
}

function buildReplenishmentRecords(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingReplenishmentFeedbackRecord[] {
  const latestReplenishment = getLatestReplenishment(snapshot, execution)
  if (!latestReplenishment) return []
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestReplenishment.writebackId,
    feedbackAt: latestReplenishment.submittedAt,
    operatorName: latestReplenishment.operatorName,
    reasonLabel: latestReplenishment.reasonLabel,
    note: latestReplenishment.note,
    photoProofCount: latestReplenishment.photoProofCount,
  }]
}

function buildRecentActions(input: {
  pickupLogs: PdaCuttingPickupLog[]
  spreadingRecords: PdaCuttingSpreadingRecord[]
  inboundRecords: PdaCuttingInboundRecord[]
  handoverRecords: PdaCuttingHandoverRecord[]
  replenishmentFeedbacks: PdaCuttingReplenishmentFeedbackRecord[]
}): PdaCuttingRecentAction[] {
  const actions: PdaCuttingRecentAction[] = []
  const latestPickup = input.pickupLogs[0]
  if (latestPickup) {
    actions.push({
      actionType: 'PICKUP',
      actionTypeLabel: '扫码领取',
      operatedBy: latestPickup.operatorName,
      operatedAt: latestPickup.scannedAt,
      summary: latestPickup.resultLabel,
    })
  }
  const latestSpreading = input.spreadingRecords[0]
  if (latestSpreading) {
    actions.push({
      actionType: 'SPREADING',
      actionTypeLabel: '铺布录入',
      operatedBy: latestSpreading.enteredBy,
      operatedAt: latestSpreading.enteredAt,
      summary: `${latestSpreading.fabricRollNo} / ${latestSpreading.layerCount} 层`,
    })
  }
  const latestInbound = input.inboundRecords[0]
  if (latestInbound) {
    actions.push({
      actionType: 'INBOUND',
      actionTypeLabel: '入仓扫码',
      operatedBy: latestInbound.operatorName,
      operatedAt: latestInbound.scannedAt,
      summary: `${latestInbound.zoneCode} 区 / ${latestInbound.locationLabel}`,
    })
  }
  const latestHandover = input.handoverRecords[0]
  if (latestHandover) {
    actions.push({
      actionType: 'HANDOVER',
      actionTypeLabel: '交接扫码',
      operatedBy: latestHandover.operatorName,
      operatedAt: latestHandover.handoverAt,
      summary: latestHandover.targetLabel,
    })
  }
  const latestReplenishment = input.replenishmentFeedbacks[0]
  if (latestReplenishment) {
    actions.push({
      actionType: 'REPLENISHMENT',
      actionTypeLabel: '补料反馈',
      operatedBy: latestReplenishment.operatorName,
      operatedAt: latestReplenishment.feedbackAt,
      summary: latestReplenishment.reasonLabel,
    })
  }
  return actions.sort((left, right) => right.operatedAt.localeCompare(left.operatedAt, 'zh-CN'))
}

function buildTaskProgressLabel(completedCount: number, totalCount: number): string {
  if (!totalCount) return '暂无执行对象'
  return `${completedCount}/${totalCount} 个执行对象已完成`
}

function resolveTaskStateLabel(completedCount: number, totalCount: number, exceptionCount: number, taskStatus: ProcessTask['status']): string {
  if (exceptionCount > 0) return '有异常'
  if (totalCount > 0 && completedCount === totalCount) return '已完成'
  if (taskStatus === 'IN_PROGRESS') return '进行中'
  return '待开始'
}

function resolveTaskSummary(executions: PdaCuttingTaskOrderLine[]): PdaTaskSummary {
  const first = executions[0]
  const completedCount = executions.filter((item) => item.isDone).length
  return {
    currentStage: completedCount === executions.length && executions.length > 0 ? '已全部完成' : first?.currentStateLabel || '待开始',
    materialSku: executions.length === 1 ? first?.materialSku : `${unique(executions.map((item) => item.materialSku)).length} 种面料`,
    materialTypeLabel: first?.materialTypeLabel || '',
    pickupSlipNo: first?.pickupSlipNo || '',
    qrCodeValue: first?.qrCodeValue || '',
    receiveSummary: executions.some((item) => item.currentReceiveStatus.includes('异议')) ? '存在领料异议' : executions.every((item) => item.currentReceiveStatus.includes('成功')) ? '扫码领料完成' : '待领料确认',
    executionSummary: executions.some((item) => item.currentExecutionStatus.includes('已有')) ? '已有铺布记录' : '待开始铺布',
    handoverSummary: executions.every((item) => item.currentHandoverStatus === '已交接') && executions.length > 0 ? '交接扫码已完成' : '待交接扫码',
  }
}

function buildProjectedTask(task: ProcessTask, snapshot: CuttingDomainSnapshot): PdaTaskFlowProjectedTask {
  const executionRecords = getSourceExecutionsByTaskId(task.taskId)
  if (!executionRecords.length) {
    return Object.assign(task, {
      taskType: 'PROCESS',
      taskTypeLabel: '常规工序任务',
      factoryType: 'FACTORY',
      factoryTypeLabel: '工厂执行',
      supportsCuttingSpecialActions: false,
      entryMode: 'DEFAULT' as const,
      summary: {
        currentStage: mapTaskStatusLabel(task.status),
        receiveSummary: '-',
        executionSummary: '-',
        handoverSummary: '-',
      },
    })
  }

  const executionRows = executionRecords.map((record, index) => buildTaskOrderLine(record, index + 1, snapshot))
  const completedCount = executionRows.filter((item) => item.isDone).length
  const exceptionCount = executionRows.filter((item) => item.hasException).length
  const defaultExecution = executionRows.find((item) => !item.isDone) || executionRows[0]

  return Object.assign(task, {
    taskType: 'CUTTING',
    taskTypeLabel: '裁片任务',
    factoryType: 'CUTTING_WORKSHOP',
    factoryTypeLabel: '裁片执行',
    supportsCuttingSpecialActions: true,
    entryMode: 'CUTTING_SPECIAL' as const,
    productionOrderNo: executionRecords[0]?.productionOrderNo || task.productionOrderId,
    originalCutOrderIds: unique(executionRecords.map((item) => item.originalCutOrderId).filter(Boolean)),
    originalCutOrderNos: unique(executionRecords.map((item) => item.originalCutOrderNo).filter(Boolean)),
    mergeBatchIds: unique(executionRecords.map((item) => item.mergeBatchId).filter(Boolean)),
    mergeBatchNos: unique(executionRecords.map((item) => item.mergeBatchNo).filter(Boolean)),
    executionOrderIds: executionRows.map((item) => item.executionOrderId),
    executionOrderNos: executionRows.map((item) => item.executionOrderNo),
    defaultExecutionOrderId: defaultExecution?.executionOrderId || '',
    defaultExecutionOrderNo: defaultExecution?.executionOrderNo || '',
    cutPieceOrderCount: executionRows.length,
    completedCutPieceOrderCount: completedCount,
    pendingCutPieceOrderCount: executionRows.length - completedCount,
    exceptionCutPieceOrderCount: exceptionCount,
    taskProgressLabel: buildTaskProgressLabel(completedCount, executionRows.length),
    taskStateLabel: resolveTaskStateLabel(completedCount, executionRows.length, exceptionCount, task.status),
    taskNextActionLabel: defaultExecution?.nextActionLabel || '查看任务',
    hasMultipleCutPieceOrders: executionRows.length > 1,
    taskReadyForDirectExec: executionRows.length === 1,
    summary: resolveTaskSummary(executionRows),
  })
}

export function isCuttingSpecialTask(task: Partial<PdaTaskFlowProjectedTask> | string | null | undefined): boolean {
  if (!task) return false
  if (typeof task === 'string') return Boolean(getPdaCuttingTaskSourceRecord(task))
  return task.taskType === 'CUTTING' || task.supportsCuttingSpecialActions === true || Boolean(task.taskId && getPdaCuttingTaskSourceRecord(task.taskId))
}

export function listPdaTaskFlowProjectedTasks(snapshot?: CuttingDomainSnapshot): PdaTaskFlowProjectedTask[] {
  const currentSnapshot = getSnapshot(snapshot)
  return listTaskFacts()
    .map((task) => buildProjectedTask(task, currentSnapshot))
    .sort((left, right) => (left.taskNo || left.taskId).localeCompare(right.taskNo || right.taskId, 'zh-CN'))
}

export function listPdaTaskFlowTasks(snapshot?: CuttingDomainSnapshot): PdaTaskFlowProjectedTasks[] {
  return listPdaTaskFlowProjectedTasks(snapshot) as PdaTaskFlowProjectedTasks[]
}

type PdaTaskFlowProjectedTasks = PdaTaskFlowProjectedTask

export function getPdaTaskFlowTaskById(taskId: string, snapshot?: CuttingDomainSnapshot): PdaTaskFlowProjectedTask | null {
  return listPdaTaskFlowProjectedTasks(snapshot).find((task) => task.taskId === taskId) ?? null
}

export function listPdaOrdinaryTaskMocks(snapshot?: CuttingDomainSnapshot): PdaTaskFlowProjectedTask[] {
  return listPdaTaskFlowProjectedTasks(snapshot).filter((task) => !isCuttingSpecialTask(task))
}

export function listPdaCuttingTaskMocks(snapshot?: CuttingDomainSnapshot): PdaTaskFlowProjectedTask[] {
  return listPdaTaskFlowProjectedTasks(snapshot).filter((task) => isCuttingSpecialTask(task))
}

function resolveExecutionRecord(
  taskId: string,
  executionKey?: string,
): PdaCuttingExecutionSourceRecord | null {
  const executionRecords = getSourceExecutionsByTaskId(taskId)
  if (!executionRecords.length) return null
  if (!executionKey && executionRecords.length === 1) return executionRecords[0]
  if (!executionKey) return executionRecords[0] ?? null
  return executionRecords.find((record) => matchPdaExecutionRecord(record, executionKey)) ?? null
}

export function listPdaCuttingTaskRefs(snapshot?: CuttingDomainSnapshot): PdaTaskFlowProjectedTask[] {
  return listPdaCuttingTaskMocks(snapshot)
}

export function listPdaCuttingExecutionRowsByTaskId(taskId: string, snapshot?: CuttingDomainSnapshot): PdaCuttingTaskOrderLine[] {
  const currentSnapshot = getSnapshot(snapshot)
  return getSourceExecutionsByTaskId(taskId).map((record, index) => buildTaskOrderLine(record, index + 1, currentSnapshot))
}

export function getPdaCuttingExecutionSnapshot(taskId: string, executionKey?: string, snapshot?: CuttingDomainSnapshot): PdaCuttingTaskDetailData | null {
  return getPdaCuttingTaskSnapshot(taskId, executionKey, snapshot)
}

export function getPdaCuttingTaskSnapshot(
  taskId: string,
  executionKey?: string,
  snapshot?: CuttingDomainSnapshot,
): PdaCuttingTaskDetailData | null {
  const currentSnapshot = getSnapshot(snapshot)
  const task = getPdaTaskFlowTaskById(taskId, currentSnapshot)
  if (!task || !isCuttingSpecialTask(task)) return null

  const executionRecords = getSourceExecutionsByTaskId(taskId)
  if (!executionRecords.length) return null
  const selectedExecutionRecord = resolveExecutionRecord(taskId, executionKey) ?? executionRecords[0]
  if (!selectedExecutionRecord) return null

  const executionRows = executionRecords.map((record, index) => buildTaskOrderLine(record, index + 1, currentSnapshot))
  const selectedLine = executionRows.find((line) => line.executionOrderId === selectedExecutionRecord.executionOrderId) ?? executionRows[0]
  if (!selectedLine) return null

  const originalRecord = getOriginalCutOrderRecord(selectedExecutionRecord)
  const progressLine = getProgressLine(currentSnapshot, selectedExecutionRecord)
  const pickupLogs = buildPickupLogs(currentSnapshot, selectedExecutionRecord)
  const spreadingRecords = buildSpreadingRecords(currentSnapshot, selectedExecutionRecord)
  const inboundRecords = buildInboundRecords(currentSnapshot, selectedExecutionRecord)
  const handoverRecords = buildHandoverRecords(currentSnapshot, selectedExecutionRecord)
  const replenishmentFeedbacks = buildReplenishmentRecords(currentSnapshot, selectedExecutionRecord)
  const latestPickup = pickupLogs[0]
  const latestSpreading = spreadingRecords[0]
  const latestInbound = inboundRecords[0]
  const latestHandover = handoverRecords[0]
  const latestReplenishment = replenishmentFeedbacks[0]
  const operators = listOperatorsForExecution(currentSnapshot, selectedExecutionRecord)
  const pickupDispute = selectedExecutionRecord.originalCutOrderNo
    ? getLatestClaimDisputeByOriginalCutOrderNo(selectedExecutionRecord.originalCutOrderNo)
    : null
  const riskTips = listRiskTips({
    disputeSummary: pickupDispute && pickupDispute.status !== 'COMPLETED' && pickupDispute.status !== 'REJECTED'
      ? `${pickupDispute.disputeReason}，待平台处理`
      : undefined,
    replenishmentLabel: selectedLine.replenishmentRiskLabel,
    hasInbound: selectedLine.currentInboundStatus === '已入仓',
    hasHandover: selectedLine.currentHandoverStatus === '已交接',
  })
  const receiveSummary = task.summary.receiveSummary
  const executionSummary = spreadingRecords.length > 0 ? `已有 ${spreadingRecords.length} 条铺布记录` : '待开始铺布'
  const handoverSummary = handoverRecords.length > 0 ? '交接扫码已完成' : '待交接扫码'
  const configuredQtyText = buildConfiguredQtyText(
    originalRecord ?? {
      originalCutOrderId: selectedExecutionRecord.originalCutOrderId,
      originalCutOrderNo: selectedExecutionRecord.originalCutOrderNo,
      productionOrderId: selectedExecutionRecord.productionOrderId,
      productionOrderNo: selectedExecutionRecord.productionOrderNo,
      materialSku: selectedExecutionRecord.materialSku,
      materialType: 'SOLID',
      materialLabel: selectedExecutionRecord.materialSku,
      materialCategory: '',
      mergeBatchId: selectedExecutionRecord.mergeBatchId,
      mergeBatchNo: selectedExecutionRecord.mergeBatchNo,
      requiredQty: 0,
      techPackVersionLabel: '',
      sourceTechPackSpuCode: '',
      colorScope: [],
      skuScopeLines: [],
      pieceRows: [],
      pieceSummary: '待补裁片信息',
    },
    progressLine?.configuredLength,
    progressLine?.configuredRollCount,
  )
  const actualReceivedQtyText = buildActualReceivedQtyText({
    latestPickup: getLatestPickup(currentSnapshot, selectedExecutionRecord),
    receivedLength: progressLine?.receivedLength,
    receivedRollCount: progressLine?.receivedRollCount,
  })
  const currentOwnerName = task.assignedFactoryName || '工艺工厂裁片执行'
  const orderQty = originalRecord?.requiredQty || 0
  const latestOperatorName = operators[0]?.operator.operatorName || latestPickup?.operatorName || latestInbound?.operatorName || latestHandover?.operatorName || latestReplenishment?.operatorName || '现场操作员'

  return {
    taskId,
    taskNo: task.taskNo || task.taskId,
    productionOrderId: selectedExecutionRecord.productionOrderId,
    productionOrderNo: selectedExecutionRecord.productionOrderNo,
    originalCutOrderIds: unique(executionRecords.map((record) => record.originalCutOrderId).filter(Boolean)),
    originalCutOrderNos: unique(executionRecords.map((record) => record.originalCutOrderNo).filter(Boolean)),
    mergeBatchIds: unique(executionRecords.map((record) => record.mergeBatchId).filter(Boolean)),
    mergeBatchNos: unique(executionRecords.map((record) => record.mergeBatchNo).filter(Boolean)),
    executionOrderId: selectedExecutionRecord.executionOrderId,
    executionOrderNo: selectedExecutionRecord.executionOrderNo,
    cutPieceOrderNo: toLegacyCutPieceOrderNo(selectedExecutionRecord),
    cutPieceOrders: executionRows,
    cutPieceOrderCount: executionRows.length,
    completedCutPieceOrderCount: executionRows.filter((item) => item.isDone).length,
    pendingCutPieceOrderCount: executionRows.filter((item) => !item.isDone).length,
    exceptionCutPieceOrderCount: executionRows.filter((item) => item.hasException).length,
    defaultExecutionOrderId: task.defaultExecutionOrderId || selectedExecutionRecord.executionOrderId,
    defaultExecutionOrderNo: task.defaultExecutionOrderNo || selectedExecutionRecord.executionOrderNo,
    currentSelectedExecutionOrderId: selectedExecutionRecord.executionOrderId,
    taskProgressLabel: task.taskProgressLabel || buildTaskProgressLabel(executionRows.filter((item) => item.isDone).length, executionRows.length),
    taskNextActionLabel: task.taskNextActionLabel || selectedLine.nextActionLabel,
    taskTypeLabel: '裁片任务',
    factoryTypeLabel: '移动执行投影',
    assigneeFactoryName: task.assignedFactoryName || '工艺工厂裁片执行',
    orderQty,
    taskStatusLabel: task.taskStateLabel || mapTaskStatusLabel(task.status),
    currentOwnerName,
    materialSku: selectedExecutionRecord.materialSku,
    materialTypeLabel: selectedLine.materialTypeLabel,
    pickupSlipNo: selectedLine.pickupSlipNo,
    pickupSlipPrintStatusLabel: progressLine?.printSlipStatus === 'PRINTED' ? '已打印' : '待打印',
    qrObjectLabel: '原始裁片单主码',
    discrepancyAllowed: true,
    hasQrCode: true,
    qrCodeValue: selectedLine.qrCodeValue,
    qrVersionNote: '二维码主码已绑定原始裁片单',
    currentStage: selectedLine.currentStateLabel,
    currentActionHint: `当前执行对象 ${selectedLine.executionOrderNo} 绑定原始裁片单 ${selectedLine.originalCutOrderNo}。`,
    nextRecommendedAction: selectedLine.nextActionLabel,
    riskFlags: unique([
      ...(selectedLine.hasException ? ['执行风险'] : []),
      ...(riskTips.length ? ['待跟进'] : []),
    ]),
    riskTips,
    receiveSummary,
    executionSummary,
    handoverSummary,
    currentReceiveStatus: selectedLine.currentReceiveStatus,
    currentExecutionStatus: selectedLine.currentExecutionStatus,
    currentInboundStatus: selectedLine.currentInboundStatus,
    currentHandoverStatus: selectedLine.currentHandoverStatus,
    scanResultLabel: latestPickup?.resultLabel || selectedLine.currentReceiveStatus,
    latestReceiveAt: latestPickup?.scannedAt || '-',
    latestReceiveBy: latestPickup?.operatorName || '-',
    latestPickupRecordNo: latestPickup?.id || '',
    latestPickupScanAt: latestPickup?.scannedAt || '-',
    latestPickupOperatorName: latestPickup?.operatorName || '-',
    configuredQtyText,
    actualReceivedQtyText,
    discrepancyNote: latestPickup?.note || pickupDispute?.disputeNote || '当前无差异',
    photoProofCount: latestPickup?.photoProofCount || latestReplenishment?.photoProofCount || pickupDispute?.evidenceCount || 0,
    markerSummary: spreadingRecords.length > 0 ? `${spreadingRecords.length} 条铺布记录` : '待铺布录入',
    hasMarkerImage: spreadingRecords.length > 0,
    latestSpreadingAt: latestSpreading?.enteredAt || '-',
    latestSpreadingBy: latestSpreading?.enteredBy || latestOperatorName,
    latestSpreadingRecordNo: latestSpreading?.id || '',
    inboundZoneLabel: latestInbound ? `${latestInbound.zoneCode} 区` : '待分配区域',
    inboundLocationLabel: latestInbound?.locationLabel || '待分配库位',
    latestInboundAt: latestInbound?.scannedAt || '-',
    latestInboundBy: latestInbound?.operatorName || '-',
    latestInboundRecordNo: latestInbound?.id || '',
    latestHandoverAt: latestHandover?.handoverAt || '-',
    latestHandoverBy: latestHandover?.operatorName || '-',
    latestHandoverRecordNo: latestHandover?.id || '',
    handoverTargetLabel: latestHandover?.targetLabel || '待确定后道去向',
    replenishmentRiskSummary: selectedLine.replenishmentRiskLabel,
    latestReplenishmentFeedbackAt: latestReplenishment?.feedbackAt || '-',
    latestReplenishmentFeedbackBy: latestReplenishment?.operatorName || '-',
    latestReplenishmentFeedbackRecordNo: latestReplenishment?.id || '',
    latestFeedbackAt: latestReplenishment?.feedbackAt || '-',
    latestFeedbackBy: latestReplenishment?.operatorName || '-',
    latestFeedbackReason: latestReplenishment?.reasonLabel || '',
    latestFeedbackNote: latestReplenishment?.note || '',
    recentActions: buildRecentActions({ pickupLogs, spreadingRecords, inboundRecords, handoverRecords, replenishmentFeedbacks }),
    pickupLogs,
    spreadingRecords,
    inboundRecords,
    handoverRecords,
    replenishmentFeedbacks,
  }
}

export function getPdaCuttingTaskDetail(taskId: string, executionKey?: string): PdaCuttingTaskDetailData | null {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

export function buildPdaCuttingRoute(taskId: string, routeKey: PdaCuttingRouteKey, options: PdaCuttingRouteOptions = {}): string {
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
  if (options.returnTo?.trim()) params.set('returnTo', options.returnTo.trim())
  if (options.executionOrderId?.trim()) params.set('executionOrderId', options.executionOrderId.trim())
  if (options.executionOrderNo?.trim()) params.set('executionOrderNo', options.executionOrderNo.trim())
  if (options.originalCutOrderId?.trim()) params.set('originalCutOrderId', options.originalCutOrderId.trim())
  if (options.originalCutOrderNo?.trim()) params.set('originalCutOrderNo', options.originalCutOrderNo.trim())
  if (options.mergeBatchId?.trim()) params.set('mergeBatchId', options.mergeBatchId.trim())
  if (options.mergeBatchNo?.trim()) params.set('mergeBatchNo', options.mergeBatchNo.trim())
  if (options.materialSku?.trim()) params.set('materialSku', options.materialSku.trim())
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function resolvePdaTaskDetailPath(taskId: string, returnTo?: string): string {
  return buildPdaCuttingRoute(taskId, 'task', { returnTo })
}

function resolvePrimaryExecRouteKey(line: PdaCuttingTaskOrderLine): PdaCuttingRouteKey {
  if (!line.currentReceiveStatus.includes('成功')) return 'pickup'
  if (!line.currentExecutionStatus.includes('已有')) return 'spreading'
  if (line.currentInboundStatus !== '已入仓') return 'inbound'
  if (line.currentHandoverStatus !== '已交接') return 'handover'
  if (line.replenishmentRiskLabel !== '当前无补料风险') return 'replenishment-feedback'
  return 'handover'
}

export function resolvePdaTaskExecPath(taskId: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (!task || !isCuttingSpecialTask(task)) return `/fcs/pda/exec/${taskId}`
  const detail = getPdaCuttingTaskSnapshot(taskId, task.defaultExecutionOrderId || task.defaultExecutionOrderNo)
  if (!detail) return resolvePdaTaskDetailPath(taskId, returnTo)
  const selectedLine = detail.cutPieceOrders.find((line) => line.executionOrderId === detail.defaultExecutionOrderId) || detail.cutPieceOrders[0]
  if (!selectedLine || detail.cutPieceOrders.length !== 1) return resolvePdaTaskDetailPath(taskId, returnTo)
  const routeKey = resolvePrimaryExecRouteKey(selectedLine)
  return buildPdaCuttingRoute(taskId, routeKey, {
    returnTo,
    executionOrderId: selectedLine.executionOrderId,
    executionOrderNo: selectedLine.executionOrderNo,
    originalCutOrderId: selectedLine.originalCutOrderId,
    originalCutOrderNo: selectedLine.originalCutOrderNo,
    mergeBatchId: selectedLine.mergeBatchId,
    mergeBatchNo: selectedLine.mergeBatchNo,
    materialSku: selectedLine.materialSku,
  })
}

export function resolvePdaHandoverDetailPath(handoverId: string, returnTo?: string): string {
  const head = findPdaHandoverHead(handoverId)
  if (!head) return `/fcs/pda/handover/${handoverId}`
  if (!isCuttingSpecialTask(head.taskId)) return `/fcs/pda/handover/${handoverId}`
  return resolvePdaTaskDetailPath(head.taskId, returnTo)
}
