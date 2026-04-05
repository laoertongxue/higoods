import { buildFcsCuttingDomainSnapshot, type CuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import {
  getGeneratedOriginalCutOrderSourceRecordById,
  type GeneratedOriginalCutOrderSourceRecord,
} from './cutting/generated-original-cut-orders.ts'
import { buildMarkerPlanProjection } from '../../pages/process-factory/cutting/marker-plan-projection.ts'
import {
  getPdaCuttingExecutionSourceRecord,
  getPdaCuttingTaskSourceRecord,
  listPdaCuttingTaskSourceRecords,
  listPdaCuttingExecutionSourceRecords,
  type PdaCuttingExecutionSourceRecord,
  type PdaCuttingTaskSourceRecord,
} from './cutting/pda-cutting-task-source.ts'
import { listPdaGenericProcessTasks } from './pda-task-mock-factory.ts'
import {
  matchPdaExecutionRecord,
  toLegacyCutPieceOrderNo,
} from './pda-cutting-legacy-compat.ts'
import {
  getPdaCuttingTaskScenarioByTaskId,
  listPdaCuttingSpreadingPresetExecutions,
} from './cutting/pda-cutting-task-scenarios.ts'
import { findPdaHandoverHead } from './pda-handover-events.ts'
import { getTaskChainTaskById, listTaskChainTasks } from './page-adapters/task-chain-pages-adapter.ts'
import type { ProcessTask } from './process-tasks.ts'
import { getPdaSession, initialFactoryPdaUsers, initialFactoryUsers } from './store-domain-pda.ts'
import type {
  PdaCutPieceHandoverWritebackRecord,
  PdaCutPieceInboundWritebackRecord,
  PdaPickupWritebackRecord,
  PdaReplenishmentFeedbackWritebackRecord,
} from './cutting/pda-execution-writeback-ledger.ts'
import type { MarkerSpreadingStore, SpreadingOperatorRecord, SpreadingRollRecord, SpreadingSession } from './cutting/marker-spreading-ledger.ts'
import { getLatestClaimDisputeByOriginalCutOrderNo } from '../../state/fcs-claim-dispute-store.ts'
import {
  buildSpreadingPlanUnitsFromMarker,
  type MarkerSpreadingContext,
  type SpreadingPlanUnit,
} from '../../pages/process-factory/cutting/marker-spreading-model.ts'
import type { MarkerPlanViewRow } from '../../pages/process-factory/cutting/marker-plan-model.ts'

export type PdaTaskEntryMode = 'DEFAULT' | 'CUTTING_SPECIAL'
export type PdaCuttingRouteKey = 'task' | 'unit' | 'pickup' | 'spreading' | 'inbound' | 'handover' | 'replenishment-feedback'
export type PdaCuttingCurrentStepCode = 'PICKUP' | 'SPREADING' | 'REPLENISHMENT' | 'HANDOVER' | 'INBOUND' | 'DONE'
export type PdaSpreadingMode = 'NORMAL' | 'HIGH_LOW' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW'

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
  bindingState: 'BOUND' | 'UNBOUND'
  materialTypeLabel: string
  colorLabel?: string
  plannedQty: number
  currentReceiveStatus: string
  currentExecutionStatus: string
  currentInboundStatus: string
  currentHandoverStatus: string
  replenishmentRiskLabel: string
  currentStateLabel: string
  currentStepCode: PdaCuttingCurrentStepCode
  currentStepLabel: string
  primaryExecutionRouteKey: Exclude<PdaCuttingRouteKey, 'task' | 'unit'>
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
  spreadingSessionId: string
  markerId: string
  markerNo: string
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  calculatedLength: number
  usableLength: number
  enteredBy: string
  enteredByAccountId: string
  enteredAt: string
  sourceType: 'PDA' | 'PCS'
  sourceWritebackId: string
  sourceRollWritebackItemId: string
  handoverFlag: boolean
  note: string
}

export interface PdaCuttingSpreadingTarget {
  targetKey: string
  targetType: 'session' | 'marker' | 'manual-entry'
  spreadingSessionId: string
  markerId: string
  markerNo: string
  sourceMarkerLabel: string
  spreadingMode: PdaSpreadingMode
  title: string
  contextLabel: string
  statusLabel: string
  originalCutOrderNo: string
  mergeBatchNo: string
  productionOrderNo: string
  materialSku: string
  colorSummary: string
  importedFromMarker: boolean
  planUnits: PdaCuttingSpreadingPlanUnitOption[]
}

export interface PdaCuttingSpreadingPlanUnitOption {
  planUnitId: string
  sourceType: 'marker-line' | 'high-low-row' | 'exception'
  sourceLineId: string
  label: string
  color: string
  materialSku: string
  garmentQtyPerUnit: number
  plannedRepeatCount: number
  lengthPerUnitM: number
  plannedCutGarmentQty: number
  plannedSpreadLengthM: number
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
  originalCutOrderId: string
  originalCutOrderNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
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
  spreadingTargets: PdaCuttingSpreadingTarget[]
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
  if (status === 'CANCELLED') return '已中止'
  if (status === 'BLOCKED') return '有异常'
  if (status === 'IN_PROGRESS') return '进行中'
  return '待开始'
}

function mapMaterialTypeLabel(record: GeneratedOriginalCutOrderSourceRecord | null): string {
  if (!record) return '待补面料类型'
  if (record.materialCategory) return record.materialCategory
  if (record.materialType === 'PRINT' || record.materialType === 'DYE' || record.materialType === 'SOLID') return '面料主料'
  if (record.materialType === 'LINING') return '里辅料'
  return '面料主料'
}

function mapReceiveStatusLabel(status: string | undefined): string {
  if (status === 'RECEIVED') return '领取成功'
  if (status === 'PARTIAL') return '部分领取'
  return '待领料确认'
}

function buildPickupSlipNo(originalCutOrderNo: string): string {
  return `LLD-${originalCutOrderNo.replace(/^CUT-/, '')}`
}

function mapSpreadingModeLabel(
  mode:
    | 'normal'
    | 'high-low'
    | 'high_low'
    | 'folded'
    | 'fold_normal'
    | 'fold_high_low'
    | PdaSpreadingMode
    | 'FOLD',
): string {
  if (mode === 'high-low' || mode === 'high_low' || mode === 'HIGH_LOW') return '高低层模式'
  if (mode === 'fold_high_low' || mode === 'FOLD_HIGH_LOW') return '对折-高低层模式'
  if (mode === 'folded' || mode === 'fold_normal' || mode === 'FOLD' || mode === 'FOLD_NORMAL') return '对折-普通模式'
  return '普通模式'
}

function mapSpreadingModeKey(
  mode: 'normal' | 'high_low' | 'high-low' | 'fold_normal' | 'fold_high_low' | 'folded' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW' | 'FOLD',
): PdaSpreadingMode {
  if (mode === 'high_low' || mode === 'high-low') return 'HIGH_LOW'
  if (mode === 'FOLD_HIGH_LOW' || mode === 'fold_high_low') return 'FOLD_HIGH_LOW'
  if (mode === 'FOLD_NORMAL' || mode === 'fold_normal' || mode === 'folded' || mode === 'FOLD') return 'FOLD_NORMAL'
  return 'NORMAL'
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

function canAccessManualSpreadingEntry(): boolean {
  const session = getPdaSession()
  if (!session.userId) return false
  const pdaUser = initialFactoryPdaUsers.find((item) => item.userId === session.userId)
  if (pdaUser) {
    return pdaUser.roleId === 'ROLE_ADMIN' || pdaUser.roleId === 'ROLE_DISPATCH'
  }
  const factoryUser = initialFactoryUsers.find((item) => item.userId === session.userId)
  if (!factoryUser) return false
  return factoryUser.roleIds.includes('ROLE_ADMIN') || factoryUser.roleIds.includes('ROLE_DISPATCH')
}

function buildSpreadingPlanUnitLabel(unit: SpreadingPlanUnit): string {
  return `${unit.color || '待补颜色'} / ${unit.materialSku || '待补面料'} / ${unit.garmentQtyPerUnit} 件`
}

function toSpreadingPlanUnitOption(unit: SpreadingPlanUnit): PdaCuttingSpreadingPlanUnitOption {
  return {
    planUnitId: unit.planUnitId,
    sourceType: unit.sourceType,
    sourceLineId: unit.sourceLineId,
    label: buildSpreadingPlanUnitLabel(unit),
    color: unit.color,
    materialSku: unit.materialSku,
    garmentQtyPerUnit: unit.garmentQtyPerUnit,
    plannedRepeatCount: unit.plannedRepeatCount,
    lengthPerUnitM: unit.lengthPerUnitM,
    plannedCutGarmentQty: unit.plannedCutGarmentQty,
    plannedSpreadLengthM: unit.plannedSpreadLengthM,
  }
}

function buildFallbackPlanUnitsFromSession(session: SpreadingSession, execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingPlanUnitOption[] {
  const garmentQtyPerUnit =
    Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0) > 0 && Math.max(Number(session.plannedLayers || 0), 0) > 0
      ? Number((Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0) / Math.max(Number(session.plannedLayers || 0), 1)).toFixed(0))
      : Math.max(Number(session.actualCutPieceQty || 0), 0)
  const fallbackUnit: SpreadingPlanUnit = {
    planUnitId: `plan-unit-fallback-${session.markerId || session.spreadingSessionId}`,
    sourceType: 'exception',
    sourceLineId: session.markerId || session.spreadingSessionId,
    color: session.colorSummary?.split(' / ')[0] || execution.colorLabel || '',
    materialSku: session.materialSkuSummary?.split(' / ')[0] || execution.materialSku || '',
    garmentQtyPerUnit,
    plannedRepeatCount: Math.max(Number(session.plannedLayers || 0), 1),
    lengthPerUnitM: Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0) > 0 && Math.max(Number(session.plannedLayers || 0), 0) > 0
      ? Number((Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0) / Math.max(Number(session.plannedLayers || 0), 1)).toFixed(2))
      : 0,
    plannedCutGarmentQty: Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0),
    plannedSpreadLengthM: Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0),
  }
  return [toSpreadingPlanUnitOption(fallbackUnit)]
}

function buildExecutionMarkerSpreadingContext(
  execution: PdaCuttingExecutionSourceRecord,
  input: {
    markerMaterialSku?: string
    styleCode?: string
    spuCode?: string
    styleName?: string
  } = {},
): MarkerSpreadingContext {
  return {
    contextType: execution.mergeBatchId ? 'merge-batch' : 'original-order',
    originalCutOrderIds: execution.originalCutOrderId ? [execution.originalCutOrderId] : [],
    originalCutOrderNos: execution.originalCutOrderNo ? [execution.originalCutOrderNo] : [],
    mergeBatchId: execution.mergeBatchId || '',
    mergeBatchNo: execution.mergeBatchNo || '',
    productionOrderNos: execution.productionOrderNo ? [execution.productionOrderNo] : [],
    styleCode: input.styleCode || '',
    spuCode: input.spuCode || '',
    techPackSpuCode: input.spuCode || '',
    styleName: input.styleName || '',
    materialSkuSummary: input.markerMaterialSku || execution.materialSku || '',
    materialPrepRows: [],
  }
}

function buildPlanUnitsFromCanonicalPlan(
  plan: MarkerPlanViewRow,
  execution: PdaCuttingExecutionSourceRecord,
): PdaCuttingSpreadingPlanUnitOption[] {
  const materialSku = (plan.materialSkuSummary || execution.materialSku || '').split(' / ')[0] || execution.materialSku || ''
  const fallbackColor = (plan.colorSummary || execution.colorLabel || '').split(' / ')[0] || execution.colorLabel || ''

  const layoutUnits = Array.isArray(plan.layoutLines)
    ? plan.layoutLines.map((line, index) => ({
      planUnitId: `plan-unit-${plan.id}-layout-${line.id || index + 1}`,
      sourceType: 'marker-line',
      sourceLineId: line.id || `${index + 1}`,
      label: buildSpreadingPlanUnitLabel({
        planUnitId: `plan-unit-${plan.id}-layout-${line.id || index + 1}`,
          sourceType: 'marker-line',
          sourceLineId: line.id || `${index + 1}`,
          color: line.colorCode || fallbackColor,
          materialSku,
          garmentQtyPerUnit: Number(line.markerPieceQty || 0),
          plannedRepeatCount: Number(line.repeatCount || 0),
          lengthPerUnitM: Number(line.markerLength || 0),
          plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
          plannedSpreadLengthM: Number(line.spreadLength || 0),
        }),
        color: line.colorCode || fallbackColor,
        materialSku,
        garmentQtyPerUnit: Number(line.markerPieceQty || 0),
        plannedRepeatCount: Number(line.repeatCount || 0),
        lengthPerUnitM: Number(line.markerLength || 0),
        plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
        plannedSpreadLengthM: Number(line.spreadLength || 0),
      }))
    : []

  if (layoutUnits.length) return layoutUnits

  const modeUnits = Array.isArray(plan.modeDetailLines)
    ? plan.modeDetailLines.map((line, index) => ({
      planUnitId: `plan-unit-${plan.id}-mode-${line.id || index + 1}`,
      sourceType: 'high-low-row',
      sourceLineId: line.id || `${index + 1}`,
      label: buildSpreadingPlanUnitLabel({
        planUnitId: `plan-unit-${plan.id}-mode-${line.id || index + 1}`,
          sourceType: 'high-low-row',
          sourceLineId: line.id || `${index + 1}`,
          color: line.colorCode || fallbackColor,
          materialSku,
          garmentQtyPerUnit: Number(line.markerPieceQty || 0),
          plannedRepeatCount: Number(line.repeatCount || 0),
          lengthPerUnitM: Number(line.markerLength || 0),
          plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
          plannedSpreadLengthM: Number(line.spreadLength || 0),
        }),
        color: line.colorCode || fallbackColor,
        materialSku,
        garmentQtyPerUnit: Number(line.markerPieceQty || 0),
        plannedRepeatCount: Number(line.repeatCount || 0),
        lengthPerUnitM: Number(line.markerLength || 0),
        plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
        plannedSpreadLengthM: Number(line.spreadLength || 0),
      }))
    : []

  if (modeUnits.length) return modeUnits

  return [
    {
      planUnitId: `plan-unit-${plan.id}-fallback`,
      sourceType: 'exception',
      sourceLineId: 'fallback',
      label: `${fallbackColor || '待补颜色'} / ${materialSku || '待补面料'} / ${Number(plan.totalPieces || 0)} 件`,
      color: fallbackColor,
      materialSku,
      garmentQtyPerUnit: Number(plan.totalPieces || 0),
      plannedRepeatCount: 1,
      lengthPerUnitM: Number(plan.netLength || 0),
      plannedCutGarmentQty: Number(plan.totalPieces || 0),
      plannedSpreadLengthM: Number(plan.plannedSpreadLength || 0),
    },
  ]
}

const pdaCuttingScenarioSpreadingPresetByExecutionId = new Map(
  listPdaCuttingSpreadingPresetExecutions().map((item) => [item.executionOrderId, item.preset] as const),
)

function mapScenarioAssignmentStatus(origin: string): ProcessTask['assignmentStatus'] {
  if (origin === 'BIDDING_PENDING' || origin === 'BIDDING_QUOTED') return 'BIDDING'
  if (origin === 'BIDDING_AWARDED') return 'AWARDED'
  return 'ASSIGNED'
}

function mapScenarioAssignmentMode(origin: string): ProcessTask['assignmentMode'] {
  return origin === 'DIRECT' ? 'DIRECT' : 'BIDDING'
}

function buildFallbackCuttingTaskFact(record: PdaCuttingTaskSourceRecord): ProcessTask {
  const scenario = getPdaCuttingTaskScenarioByTaskId(record.taskId)
  const firstExecution = getSourceExecutionsByTaskId(record.taskId)[0] ?? null
  const originalRecord = firstExecution?.originalCutOrderId
    ? getGeneratedOriginalCutOrderSourceRecordById(firstExecution.originalCutOrderId)
    : null
  const baseAt = scenario?.notifiedAt || scenario?.quotedAt || scenario?.biddingDeadline || scenario?.dispatchedAt || '2026-03-22 08:00:00'
  const qty = scenario?.qty || originalRecord?.requiredQty || 0
  const pricing = scenario?.dispatchPrice || scenario?.quotedPrice || scenario?.standardPrice || 6.5
  const task = {
    taskId: record.taskId,
    taskNo: record.taskNo || record.taskId,
    productionOrderId: record.productionOrderId,
    seq: 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty,
    qtyUnit: '件',
    assignmentMode: mapScenarioAssignmentMode(scenario?.origin || 'DIRECT'),
    assignmentStatus: mapScenarioAssignmentStatus(scenario?.origin || 'DIRECT'),
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: scenario?.assignedFactoryId || 'ID-F001',
    assignedFactoryName: scenario?.assignedFactoryName || 'PT Sinar Garment Indonesia',
    qcPoints: [],
    attachments: [],
    status: scenario?.taskStatus || 'NOT_STARTED',
    acceptDeadline: scenario?.acceptDeadline || '2026-03-28 10:00:00',
    taskDeadline: scenario?.taskDeadline || '2026-03-28 20:00:00',
    dispatchRemark: scenario?.dispatchRemark || scenario?.taskSummaryNote || 'PDA 裁片执行投影任务',
    dispatchedAt: scenario?.dispatchedAt || baseAt,
    dispatchedBy: scenario?.dispatchedBy || '系统派单',
    standardPrice: pricing,
    standardPriceCurrency: scenario?.currency || 'CNY',
    standardPriceUnit: scenario?.unit || scenario?.qtyUnit || '件',
    dispatchPrice: scenario?.dispatchPrice,
    dispatchPriceCurrency: scenario?.currency || 'CNY',
    dispatchPriceUnit: scenario?.unit || scenario?.qtyUnit || '件',
    priceDiffReason: scenario?.priceDiffReason || (scenario?.origin === 'DIRECT' ? 'PDA 裁片投影派单价' : 'PDA 裁片投影招标价'),
    acceptanceStatus: scenario?.acceptanceStatus,
    acceptedAt: scenario?.acceptedAt,
    awardedAt: scenario?.notifiedAt,
    acceptedBy: scenario?.acceptedBy,
    tenderId: scenario?.tenderId,
    blockReason: scenario?.blockReason,
    blockRemark: scenario?.blockRemark,
    blockedAt: scenario?.blockedAt,
    startedAt: scenario?.startedAt,
    finishedAt: scenario?.finishedAt,
    rootTaskNo: record.taskNo || record.taskId,
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    createdAt: baseAt,
    updatedAt: baseAt,
    auditLogs: [
      {
        id: `AL-${record.taskId}`,
        action:
          scenario?.origin === 'BIDDING_AWARDED'
            ? 'AWARDED'
            : scenario?.origin === 'BIDDING_PENDING' || scenario?.origin === 'BIDDING_QUOTED'
              ? 'BIDDING_OPEN'
              : 'DISPATCHED',
        detail:
          scenario?.taskSummaryNote
          || (scenario?.origin === 'BIDDING_AWARDED'
            ? '裁片竞价中标后已同步为 PDA 执行任务'
            : scenario?.origin === 'BIDDING_PENDING' || scenario?.origin === 'BIDDING_QUOTED'
              ? '裁片竞价任务已同步为 PDA 执行投影'
              : '裁片直接派单任务已同步为 PDA 执行投影'),
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
  const genericTasks = listPdaGenericProcessTasks().filter((task) => !runtimeTaskIds.has(task.taskId))
  const genericTaskIds = new Set(genericTasks.map((task) => task.taskId))
  const fallbackCuttingTasks = listPdaCuttingTaskSourceRecords()
    .filter((record) => !runtimeTaskIds.has(record.taskId) && !genericTaskIds.has(record.taskId))
    .map((record) => buildFallbackCuttingTaskFact(record))

  return [...runtimeTasks, ...genericTasks, ...fallbackCuttingTasks]
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

function listMarkersForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord) {
  const store = getMarkerStore(snapshot)
  return (store.markers || [])
    .filter((marker) => marker.originalCutOrderIds.includes(execution.originalCutOrderId) || (execution.mergeBatchId && marker.mergeBatchId === execution.mergeBatchId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

function listCanonicalMarkerPlansForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord) {
  const projection = buildMarkerPlanProjection(snapshot)
  return projection.viewModel.plans
    .filter(
      (plan) =>
        plan.originalCutOrderIds.includes(execution.originalCutOrderId)
        || (execution.mergeBatchId && plan.mergeBatchId === execution.mergeBatchId),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

function mapMarkerPlanModeToSpreadingMode(mode: 'normal' | 'high_low' | 'fold_normal' | 'fold_high_low'): PdaSpreadingMode {
  if (mode === 'high_low') return 'HIGH_LOW'
  if (mode === 'fold_high_low') return 'FOLD_HIGH_LOW'
  if (mode === 'fold_normal') return 'FOLD_NORMAL'
  return 'NORMAL'
}

function buildSpreadingTargets(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingTarget[] {
  const sessions = listSessionsForExecution(snapshot, execution)
  const markers = listMarkersForExecution(snapshot, execution)
  const canonicalPlanProjection = buildMarkerPlanProjection(snapshot)
  const canonicalPlans = canonicalPlanProjection.viewModel.plans
    .filter(
      (plan) =>
        plan.originalCutOrderIds.includes(execution.originalCutOrderId)
        || (execution.mergeBatchId && plan.mergeBatchId === execution.mergeBatchId),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
  const sessionMarkerIds = new Set(sessions.map((session) => session.markerId).filter(Boolean))
  const markerIds = new Set(markers.map((marker) => marker.markerId))
  const sessionTargets = sessions.map((session) => ({
    targetKey: `session:${session.spreadingSessionId}`,
    targetType: 'session' as const,
    spreadingSessionId: session.spreadingSessionId,
    markerId: session.markerId || '',
    markerNo: session.markerNo || '',
    sourceMarkerLabel: session.markerNo || session.sourceMarkerNo || '未绑定参考唛架',
    spreadingMode: mapSpreadingModeKey(session.spreadingMode),
    title: session.sessionNo || `铺布对象 ${session.spreadingSessionId.slice(-6)}`,
    contextLabel: '继续当前铺布',
    statusLabel: session.status === 'DONE' ? '已完成' : session.status === 'IN_PROGRESS' ? '进行中' : session.status === 'TO_FILL' ? '待补录' : '草稿',
    originalCutOrderNo: execution.originalCutOrderNo || '',
    mergeBatchNo: execution.mergeBatchNo || '',
    productionOrderNo: execution.productionOrderNo || '',
    materialSku: execution.materialSku || '',
    colorSummary: session.colorSummary || '',
    importedFromMarker: Boolean(session.importedFromMarker),
    planUnits: (session.planUnits?.length ? session.planUnits : undefined)?.map(toSpreadingPlanUnitOption) || buildFallbackPlanUnitsFromSession(session, execution),
  }))
  const markerTargets = markers
    .filter((marker) => !sessionMarkerIds.has(marker.markerId))
    .map((marker) => {
      const context = buildExecutionMarkerSpreadingContext(execution, {
        markerMaterialSku: marker.materialSkuSummary || marker.fabricSku || execution.materialSku || '',
        styleCode: marker.styleCode || '',
        spuCode: marker.spuCode || '',
      })
      return {
        targetKey: `marker:${marker.markerId}`,
        targetType: 'marker' as const,
        spreadingSessionId: '',
        markerId: marker.markerId,
        markerNo: marker.markerNo || '',
        sourceMarkerLabel: marker.markerNo || marker.markerId,
        spreadingMode: mapSpreadingModeKey(marker.markerMode),
        title: marker.markerNo || marker.markerId,
        contextLabel: '按唛架开始铺布',
        statusLabel: mapSpreadingModeLabel(marker.markerMode),
        originalCutOrderNo: execution.originalCutOrderNo || '',
        mergeBatchNo: execution.mergeBatchNo || '',
        productionOrderNo: execution.productionOrderNo || '',
        materialSku: marker.fabricSku || execution.materialSku || '',
        colorSummary: marker.colorSummary || '',
        importedFromMarker: true,
        planUnits: buildSpreadingPlanUnitsFromMarker(marker, context).map(toSpreadingPlanUnitOption),
      }
    })
  const canonicalMarkerTargets = canonicalPlans
    .filter((plan) => !sessionMarkerIds.has(plan.id) && !markerIds.has(plan.id))
    .map((plan) => ({
      targetKey: `marker:${plan.id}`,
      targetType: 'marker' as const,
      spreadingSessionId: '',
      markerId: plan.id,
      markerNo: plan.markerNo || '',
      sourceMarkerLabel: plan.markerNo || plan.id,
      spreadingMode: mapMarkerPlanModeToSpreadingMode(plan.markerMode),
      title: plan.markerNo || plan.id,
      contextLabel: '按唛架开始铺布',
      statusLabel: plan.statusMeta.label,
      originalCutOrderNo: execution.originalCutOrderNo || '',
      mergeBatchNo: execution.mergeBatchNo || '',
      productionOrderNo: execution.productionOrderNo || '',
      materialSku: plan.materialSkuSummary || execution.materialSku || '',
      colorSummary: plan.colorSummary || execution.colorLabel || '',
      importedFromMarker: true,
      planUnits: buildPlanUnitsFromCanonicalPlan(plan, execution),
    }))

  const targets: PdaCuttingSpreadingTarget[] = [
    ...sessionTargets,
    ...markerTargets,
    ...canonicalMarkerTargets,
  ]

  if (canAccessManualSpreadingEntry()) {
    targets.push({
      targetKey: `manual-entry:${execution.executionOrderId}`,
      targetType: 'manual-entry',
      spreadingSessionId: '',
      markerId: '',
      markerNo: '',
      sourceMarkerLabel: '未绑定参考唛架',
      spreadingMode: 'NORMAL',
      title: execution.mergeBatchNo ? '异常补录当前批次铺布' : '异常补录当前裁片单铺布',
      contextLabel: '异常补录铺布',
      statusLabel: '当前无唛架，仅允许异常补录',
      originalCutOrderNo: execution.originalCutOrderNo || '',
      mergeBatchNo: execution.mergeBatchNo || '',
      productionOrderNo: execution.productionOrderNo || '',
      materialSku: execution.materialSku || '',
      colorSummary: execution.colorLabel || '',
      importedFromMarker: false,
      planUnits: [
        {
          planUnitId: `plan-unit-manual-${execution.executionOrderId}`,
          sourceType: 'exception',
          sourceLineId: execution.executionOrderId,
          label: `${execution.colorLabel || '待补颜色'} / ${execution.materialSku || '待补面料'} / 0 件`,
          color: execution.colorLabel || '',
          materialSku: execution.materialSku || '',
          garmentQtyPerUnit: 0,
          plannedRepeatCount: 0,
          lengthPerUnitM: 0,
          plannedCutGarmentQty: 0,
          plannedSpreadLengthM: 0,
        },
      ],
    })
  }

  return targets
}

function getScenarioSpreadingPreset(execution: PdaCuttingExecutionSourceRecord): {
  status: 'STARTED' | 'DONE' | 'BLOCKED'
  recordId: string
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  enteredBy: string
  enteredAt: string
  note: string
} | null {
  return pdaCuttingScenarioSpreadingPresetByExecutionId.get(execution.executionOrderId) ?? null
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
  if (latestReplenishment.lifecycleStatus === 'CLOSED') return `${latestReplenishment.reasonLabel}，已关闭`
  if (latestReplenishment.lifecycleStatus === 'PENDING') return `${latestReplenishment.reasonLabel}，待工艺工厂跟进`
  return `${latestReplenishment.reasonLabel}，已提交补料反馈`
}

function includesAny(value: string | undefined, keywords: string[]): boolean {
  if (!value) return false
  return keywords.some((keyword) => value.includes(keyword))
}

function hasPendingReplenishmentRisk(label: string): boolean {
  return !includesAny(label, ['当前无补料风险', '暂无补料风险', '无需补料', '已关闭'])
}

function isReceiveCompleted(status: string): boolean {
  return includesAny(status, ['领取成功', '已回执', '已领取'])
}

function isSpreadingCompleted(status: string): boolean {
  return includesAny(status, ['铺布已完成'])
}

function isHandoverCompleted(status: string): boolean {
  return includesAny(status, ['已交接'])
}

function isInboundCompleted(status: string): boolean {
  return includesAny(status, ['已入仓'])
}

function resolveCurrentStepCode(input: {
  bindingState: 'BOUND' | 'UNBOUND'
  taskStatus: ProcessTask['status']
  currentReceiveStatus: string
  currentExecutionStatus: string
  currentInboundStatus: string
  currentHandoverStatus: string
  replenishmentRiskLabel: string
}): PdaCuttingCurrentStepCode {
  if (input.bindingState === 'UNBOUND') return 'SPREADING'
  if (input.taskStatus === 'CANCELLED') return 'DONE'
  if (!isReceiveCompleted(input.currentReceiveStatus)) return 'PICKUP'
  if (!isSpreadingCompleted(input.currentExecutionStatus)) return 'SPREADING'
  if (hasPendingReplenishmentRisk(input.replenishmentRiskLabel)) return 'REPLENISHMENT'
  if (!isHandoverCompleted(input.currentHandoverStatus)) return 'HANDOVER'
  if (!isInboundCompleted(input.currentInboundStatus)) return 'INBOUND'
  return 'DONE'
}

function resolveCurrentStepLabel(stepCode: PdaCuttingCurrentStepCode): string {
  if (stepCode === 'PICKUP') return '领料'
  if (stepCode === 'SPREADING') return '铺布'
  if (stepCode === 'REPLENISHMENT') return '补料反馈'
  if (stepCode === 'HANDOVER') return '交接'
  if (stepCode === 'INBOUND') return '入仓'
  return '已完成'
}

function resolveNextAction(line: {
  currentStepCode: PdaCuttingCurrentStepCode
  taskStatus: ProcessTask['status']
  hasException: boolean
}): string {
  if (line.taskStatus === 'CANCELLED') return '查看当前情况'
  if (line.taskStatus === 'BLOCKED') return '查看异常'
  if (line.hasException) return '查看异常'
  if (line.currentStepCode === 'PICKUP') return '扫码领料'
  if (line.currentStepCode === 'SPREADING') return '铺布录入'
  if (line.currentStepCode === 'REPLENISHMENT') return '补料反馈'
  if (line.currentStepCode === 'HANDOVER') return '交接扫码'
  if (line.currentStepCode === 'INBOUND') return '入仓扫码'
  return '查看当前情况'
}

function resolveCurrentState(line: {
  bindingState: 'BOUND' | 'UNBOUND'
  taskStatus: ProcessTask['status']
  currentExecutionStatus: string
  pickupSuccess: boolean
  hasSpreading: boolean
  hasInbound: boolean
  hasHandover: boolean
  replenishmentLabel: string
  hasException: boolean
}): string {
  if (line.bindingState === 'UNBOUND') return '待绑定'
  if (line.taskStatus === 'CANCELLED') return '已中止'
  if (line.taskStatus === 'BLOCKED' && line.currentExecutionStatus.includes('暂停')) return '执行暂停'
  if (line.hasException && !line.pickupSuccess) return '领料差异待处理'
  if (!line.pickupSuccess) return '待领料'
  if (!line.hasSpreading || line.currentExecutionStatus.includes('待铺布')) return '待铺布'
  if (!line.hasInbound) return '待入仓'
  if (!line.hasHandover) return '待交接'
  if (line.replenishmentLabel.includes('待工艺工厂跟进')) return '补料风险待关注'
  if (line.taskStatus === 'DONE' || line.replenishmentLabel.includes('已关闭')) return '已完成'
  return '已完成'
}

function resolvePrimaryExecutionRouteKey(input: {
  bindingState: 'BOUND' | 'UNBOUND'
  taskStatus: ProcessTask['status']
  currentStepCode: PdaCuttingCurrentStepCode
  replenishmentLabel: string
  hasException: boolean
}): Exclude<PdaCuttingRouteKey, 'task' | 'unit'> {
  if (input.bindingState === 'UNBOUND') return 'spreading'
  if (input.taskStatus === 'CANCELLED') return 'handover'
  if (input.taskStatus === 'BLOCKED' && input.replenishmentLabel !== '当前无补料风险') return 'replenishment-feedback'
  if (input.currentStepCode === 'PICKUP') return 'pickup'
  if (input.currentStepCode === 'SPREADING') return 'spreading'
  if (input.currentStepCode === 'REPLENISHMENT') return 'replenishment-feedback'
  if (input.currentStepCode === 'HANDOVER') return 'handover'
  if (input.currentStepCode === 'INBOUND') return 'inbound'
  return 'handover'
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
  const scenario = getPdaCuttingTaskScenarioByTaskId(execution.taskId)
  const progressLine = getProgressLine(snapshot, execution)
  const originalRecord = getOriginalCutOrderRecord(execution)
  const latestPickup = getLatestPickup(snapshot, execution)
  const latestInbound = getLatestInbound(snapshot, execution)
  const latestHandover = getLatestHandover(snapshot, execution)
  const latestReplenishment = getLatestReplenishment(snapshot, execution)
  const sessions = listSessionsForExecution(snapshot, execution)
  const preset = getScenarioSpreadingPreset(execution)
  const pickupDispute = execution.originalCutOrderNo ? getLatestClaimDisputeByOriginalCutOrderNo(execution.originalCutOrderNo) : null
  const currentReceiveStatus =
    pickupDispute && pickupDispute.status !== 'COMPLETED' && pickupDispute.status !== 'REJECTED'
      ? '领料异议处理中'
      : latestPickup?.resultLabel || mapReceiveStatusLabel(progressLine?.receiveStatus)
  const hasPickupSuccess = Boolean(latestPickup?.resultLabel?.includes('成功')) || progressLine?.receiveStatus === 'RECEIVED'
  const hasSpreading = sessions.length > 0 || Boolean(preset)
  const currentExecutionStatus =
    execution.bindingState === 'UNBOUND'
      ? '待绑定原始裁片单'
      : scenario?.taskStatus === 'CANCELLED'
        ? '执行已中止'
        : preset?.status === 'BLOCKED' || scenario?.taskStatus === 'BLOCKED'
          ? '铺布已暂停'
          : preset?.status === 'DONE' || scenario?.taskStatus === 'DONE'
            ? '铺布已完成'
            : hasSpreading
              ? '铺布进行中'
              : '待铺布录入'
  const hasInbound = Boolean(latestInbound)
  const currentInboundStatus = latestInbound ? '已入仓' : '待入仓扫码'
  const hasHandover = Boolean(latestHandover)
  const currentHandoverStatus = latestHandover ? '已交接' : '待交接扫码'
  const replenishmentRiskLabel = buildReplenishmentLabel(latestReplenishment)
  const hasException =
    currentReceiveStatus.includes('异议')
    || currentReceiveStatus.includes('差异')
    || replenishmentRiskLabel.includes('待工艺工厂跟进')
    || execution.bindingState === 'UNBOUND'
    || currentExecutionStatus.includes('暂停')
    || currentExecutionStatus.includes('中止')
  const currentStepCode = resolveCurrentStepCode({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || 'NOT_STARTED',
    currentReceiveStatus,
    currentExecutionStatus,
    currentInboundStatus,
    currentHandoverStatus,
    replenishmentRiskLabel,
  })
  const currentStepLabel = resolveCurrentStepLabel(currentStepCode)
  const currentStateLabel = resolveCurrentState({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || 'NOT_STARTED',
    currentExecutionStatus,
    pickupSuccess: hasPickupSuccess,
    hasSpreading,
    hasInbound,
    hasHandover,
    replenishmentLabel: replenishmentRiskLabel,
    hasException,
  })
  const primaryExecutionRouteKey = resolvePrimaryExecutionRouteKey({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || 'NOT_STARTED',
    currentStepCode,
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
    bindingState: execution.bindingState,
    materialTypeLabel: mapMaterialTypeLabel(originalRecord),
    colorLabel: originalRecord?.colorScope.join(' / ') || progressLine?.color || (execution.bindingState === 'UNBOUND' ? '待绑定' : ''),
    plannedQty: originalRecord?.requiredQty || scenario?.qty || 0,
    currentReceiveStatus,
    currentExecutionStatus,
    currentInboundStatus,
    currentHandoverStatus,
    replenishmentRiskLabel,
    currentStateLabel,
    currentStepCode,
    currentStepLabel,
    primaryExecutionRouteKey,
    nextActionLabel: resolveNextAction({
      currentStepCode,
      taskStatus: scenario?.taskStatus || 'NOT_STARTED',
      hasException,
    }),
    qrCodeValue: buildQrCodeValue(execution.originalCutOrderNo || execution.executionOrderNo),
    pickupSlipNo: buildPickupSlipNo(execution.originalCutOrderNo || execution.executionOrderNo),
    isDone:
      scenario?.taskStatus === 'DONE'
      || (hasPickupSuccess
        && hasSpreading
        && hasInbound
        && hasHandover
        && (replenishmentRiskLabel === '当前无补料风险' || replenishmentRiskLabel.includes('已关闭'))),
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
  const actualRecords = listRollsForExecution(snapshot, execution).map(({ session, roll }) => {
    const linkedOperators = session.operators.filter((operator) => operator.rollRecordId === roll.rollRecordId)
    const latestOperator = [...linkedOperators].sort((left, right) => right.endAt.localeCompare(left.endAt, 'zh-CN'))[0] || linkedOperators[0] || null
    return {
      executionOrderId: execution.executionOrderId,
      id: roll.rollRecordId,
      spreadingSessionId: session.spreadingSessionId,
      markerId: session.markerId || '',
      markerNo: session.markerNo || '',
      fabricRollNo: roll.rollNo,
      layerCount: roll.layerCount,
      actualLength: roll.actualLength,
      headLength: roll.headLength,
      tailLength: roll.tailLength,
      calculatedLength: roll.actualLength + roll.headLength + roll.tailLength,
      usableLength: roll.usableLength,
      enteredBy: latestOperator?.operatorName || roll.operatorNames[0] || session.operators[0]?.operatorName || '现场铺布员',
      enteredByAccountId: latestOperator?.operatorAccountId || '',
      enteredAt: roll.updatedFromPdaAt || latestOperator?.endAt || session.updatedAt,
      sourceType: roll.sourceChannel === 'PDA_WRITEBACK' ? 'PDA' : 'PCS',
      sourceWritebackId: roll.sourceWritebackId || '',
      sourceRollWritebackItemId: roll.rollRecordId,
      handoverFlag: linkedOperators.some((operator) => operator.handoverFlag) || linkedOperators.length > 1,
      note: roll.note,
    }
  })
  if (actualRecords.length > 0) return actualRecords

  const preset = getScenarioSpreadingPreset(execution)
  if (!preset) return []

  return [
    {
      executionOrderId: execution.executionOrderId,
      id: preset.recordId,
      spreadingSessionId: '',
      markerId: '',
      markerNo: '',
      fabricRollNo: preset.fabricRollNo,
      layerCount: preset.layerCount,
      actualLength: preset.actualLength,
      headLength: preset.headLength,
      tailLength: preset.tailLength,
      calculatedLength: preset.actualLength + preset.headLength + preset.tailLength,
      usableLength: Math.max(preset.actualLength - preset.headLength - preset.tailLength, 0),
      enteredBy: preset.enteredBy,
      enteredByAccountId: '',
      enteredAt: preset.enteredAt,
      sourceType: 'PDA',
      sourceWritebackId: '',
      sourceRollWritebackItemId: '',
      handoverFlag: false,
      note: preset.note,
    },
  ]
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
  if (taskStatus === 'CANCELLED') return '已中止'
  if (exceptionCount > 0) return '有异常'
  if (totalCount > 0 && completedCount === totalCount) return '已完成'
  if (taskStatus === 'IN_PROGRESS') return '进行中'
  if (taskStatus === 'BLOCKED') return '有异常'
  return '待开始'
}

function resolveTaskSummary(executions: PdaCuttingTaskOrderLine[]): PdaTaskSummary {
  const first = executions[0]
  const completedCount = executions.filter((item) => item.isDone).length
  const blockedCount = executions.filter((item) => item.currentExecutionStatus.includes('暂停')).length
  const cancelledCount = executions.filter((item) => item.currentExecutionStatus.includes('中止')).length
  return {
    currentStage:
      cancelledCount > 0
        ? '存在已中止执行'
        : blockedCount > 0
          ? '存在暂停执行'
          : completedCount === executions.length && executions.length > 0
            ? '已全部完成'
            : first?.currentStateLabel || '待开始',
    materialSku: executions.length === 1 ? first?.materialSku : `${unique(executions.map((item) => item.materialSku)).length} 种面料`,
    materialTypeLabel: first?.materialTypeLabel || '',
    pickupSlipNo: first?.pickupSlipNo || '',
    qrCodeValue: first?.qrCodeValue || '',
    receiveSummary: executions.some((item) => item.currentReceiveStatus.includes('异议')) ? '存在领料异议' : executions.every((item) => item.currentReceiveStatus.includes('成功')) ? '扫码领料完成' : '待领料确认',
    executionSummary:
      executions.some((item) => item.currentExecutionStatus.includes('暂停'))
        ? '存在铺布暂停'
        : executions.some((item) => item.currentExecutionStatus.includes('完成'))
          ? '已有铺布完成记录'
          : executions.some((item) => item.currentExecutionStatus.includes('进行中'))
            ? '已有铺布进行中记录'
            : executions.some((item) => item.currentExecutionStatus.includes('待绑定'))
              ? '存在待绑定执行对象'
              : '待开始铺布',
    handoverSummary: executions.every((item) => item.currentHandoverStatus === '已交接') && executions.length > 0 ? '交接扫码已完成' : '待交接扫码',
  }
}

function buildProjectedTask(task: ProcessTask, snapshot: CuttingDomainSnapshot): PdaTaskFlowProjectedTask {
  const executionRecords = getSourceExecutionsByTaskId(task.taskId)
  if (!executionRecords.length) {
    const genericTask = task as ProcessTask & {
      mockReceiveSummary?: string
      mockExecutionSummary?: string
      mockHandoverSummary?: string
    }
    return Object.assign(task, {
      taskType: 'PROCESS',
      taskTypeLabel: task.taskCategoryZh || `${task.processNameZh}任务`,
      factoryType: 'FACTORY',
      factoryTypeLabel: '工厂执行',
      supportsCuttingSpecialActions: false,
      entryMode: 'DEFAULT' as const,
      summary: {
        currentStage: mapTaskStatusLabel(task.status),
        receiveSummary: genericTask.mockReceiveSummary || '-',
        executionSummary: genericTask.mockExecutionSummary || '-',
        handoverSummary: genericTask.mockHandoverSummary || '-',
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
  const spreadingTargets = buildSpreadingTargets(currentSnapshot, selectedExecutionRecord)
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
    originalCutOrderId: selectedExecutionRecord.originalCutOrderId,
    originalCutOrderNo: selectedExecutionRecord.originalCutOrderNo,
    originalCutOrderIds: unique(executionRecords.map((record) => record.originalCutOrderId).filter(Boolean)),
    originalCutOrderNos: unique(executionRecords.map((record) => record.originalCutOrderNo).filter(Boolean)),
    mergeBatchId: selectedExecutionRecord.mergeBatchId,
    mergeBatchNo: selectedExecutionRecord.mergeBatchNo,
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
    currentActionHint:
      selectedLine.bindingState === 'UNBOUND'
        ? `当前执行对象 ${selectedLine.executionOrderNo} 尚未绑定原始裁片单，请先处理绑定异常。`
        : `当前执行对象 ${selectedLine.executionOrderNo} 绑定原始裁片单 ${selectedLine.originalCutOrderNo}。`,
    nextRecommendedAction: selectedLine.nextActionLabel,
    riskFlags: unique([
      ...(selectedLine.hasException ? ['执行风险'] : []),
      ...(riskTips.length ? ['待跟进'] : []),
    ]),
    riskTips,
    receiveSummary,
    executionSummary: selectedLine.currentExecutionStatus || executionSummary,
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
    spreadingTargets,
    spreadingRecords,
    inboundRecords,
    handoverRecords,
    replenishmentFeedbacks,
  }
}

export function getPdaCuttingTaskDetail(taskId: string, executionKey?: string): PdaCuttingTaskDetailData | null {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

export function listWorkerVisiblePdaSpreadingTargets(
  taskId: string,
  executionKey?: string,
): PdaCuttingSpreadingTarget[] {
  const detail = getPdaCuttingTaskSnapshot(taskId, executionKey)
  if (!detail) return []
  return detail.spreadingTargets.filter((target) => target.targetType === 'session' || target.targetType === 'marker')
}

export function buildPdaCuttingRoute(taskId: string, routeKey: PdaCuttingRouteKey, options: PdaCuttingRouteOptions = {}): string {
  const basePath =
    routeKey === 'task'
      ? `/fcs/pda/cutting/task/${taskId}`
      : routeKey === 'unit'
        ? `/fcs/pda/cutting/unit/${taskId}/${options.executionOrderId?.trim() || 'default'}`
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

export function resolvePdaTaskExecPath(taskId: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (!task || !isCuttingSpecialTask(task)) return `/fcs/pda/exec/${taskId}`
  const detail = getPdaCuttingTaskSnapshot(taskId, task.defaultExecutionOrderId || task.defaultExecutionOrderNo)
  if (!detail) return resolvePdaTaskDetailPath(taskId, returnTo)
  const selectedLine = detail.cutPieceOrders.find((line) => line.executionOrderId === detail.defaultExecutionOrderId) || detail.cutPieceOrders[0]
  if (!selectedLine || detail.cutPieceOrders.length !== 1) return resolvePdaTaskDetailPath(taskId, returnTo)
  return buildPdaCuttingRoute(taskId, 'unit', {
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
