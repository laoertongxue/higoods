import { buildFcsCuttingDomainSnapshot, type CuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import {
  getGeneratedCutOrderSourceRecordById,
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from './cutting/generated-cut-orders.ts'
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
import { listWoolMobileProcessTasks } from './wool-task-domain.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import {
  resolveSpreadingMaterialReadiness,
  type SpreadingMaterialReadiness,
} from './cutting/spreading-material-readiness.ts'
import {
  getPdaCuttingTaskScenarioByTaskId,
  listPdaCuttingSpreadingPresetExecutions,
} from './cutting/pda-cutting-task-scenarios.ts'
import { getTaskChainTaskById, listTaskChainTasks } from './page-adapters/task-chain-pages-adapter.ts'
import type { ProcessTask } from './process-tasks.ts'
import type { MarkerSpreadingStore, SpreadingOperatorRecord, SpreadingRollRecord, SpreadingSession } from './cutting/marker-spreading-ledger.ts'
import {
  listCuttingRuntimeEvents,
  type CuttingRuntimeEvent,
  type CuttingRuntimeEventType,
  type PdaCutPieceHandoverEventRecord,
  type PdaCutPieceInboundEventRecord,
  type PdaPickupEventRecord,
} from './cutting/cutting-runtime-event-ledger.ts'
import { getLatestClaimDisputeByCutOrderNo } from '../../state/fcs-claim-dispute-store.ts'
import {
  buildSpreadingPlanUnitsFromMarker,
  type MarkerSpreadingContext,
  type SpreadingPlanUnit,
} from '../../pages/process-factory/cutting/marker-spreading-model.ts'
import type { MarkerPlanViewRow } from '../../pages/process-factory/cutting/marker-plan-model.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type PdaTaskEntryMode = 'DEFAULT' | 'CUTTING_SPECIAL'
export type PdaCuttingRouteKey = 'task' | 'unit' | 'spreading' | 'inbound' | 'handover'
export type PdaCuttingCurrentStepCode = 'START' | 'PICKUP' | 'SPREADING' | 'HANDOVER' | 'INBOUND' | 'DONE'
export type PdaSpreadingMode = 'NORMAL' | 'HIGH_LOW' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW'
type PdaCuttingMobileStage =
  | 'WAIT_PICKUP'
  | 'WAIT_START'
  | 'WAIT_SPREADING'
  | 'SPREADING'
  | 'WAIT_CUTTING'
  | 'CUTTING'
  | 'CUT_DONE'

type PdaCuttingStageActionType =
  | 'START_WORK'
  | 'START_SPREADING'
  | 'FINISH_SPREADING'
  | 'START_CUTTING'
  | 'FINISH_CUTTING'

type PdaCuttingSyncStatus = '已同步' | '待同步' | '同步失败'

interface PdaCuttingStageEventRecord {
  runtimeEventId: string
  taskId: string
  executionOrderId: string
  executionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  actionType: PdaCuttingStageActionType
  actionLabel: string
  submittedAt: string
  operatorName: string
  syncStatus: PdaCuttingSyncStatus
  planUnitId?: string
  sourceLineId?: string
  stepNo?: number
  stepLabel?: string
  actualLayerCount?: number
  actualSpreadLength?: number
  headLength?: number
  tailLength?: number
  actualCutQty?: number
  actualUsage?: number
  varianceFlag?: boolean
  note: string
}

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
  cutOrderIds?: string[]
  cutOrderNos?: string[]
  markerPlanIds?: string[]
  markerPlanNos?: string[]
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

export type PdaTaskFlowMock = PdaTaskFlowProjectedTask

export interface PdaCuttingTaskOrderLine {
  executionOrderId: string
  executionOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  bindingState: 'BOUND' | 'UNBOUND'
  materialTypeLabel: string
  colorLabel?: string
  plannedQty: number
  currentReceiveStatus: string
  currentExecutionStatus: string
  currentInboundStatus: string
  currentHandoverStatus: string
  currentStateLabel: string
  currentStepCode: PdaCuttingCurrentStepCode
  currentStepLabel: string
  primaryExecutionRouteKey: Exclude<PdaCuttingRouteKey, 'task' | 'unit'>
  nextActionLabel: string
  mobileStage: PdaCuttingMobileStage
  latestSyncStatus: string
  latestSyncSummary: string
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
  planUnitId: string
  stepNo?: number
  stepLabel?: string
  rollRecordId: string
  operatorRecordId: string
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
  handoverResultLabel: string
  note: string
}

export interface PdaCuttingSpreadingTarget {
  targetKey: string
  targetType: 'session' | 'marker'
  spreadingSessionId: string
  markerId: string
  markerNo: string
  sourceMarkerLabel: string
  spreadingMode: PdaSpreadingMode
  title: string
  contextLabel: string
  statusLabel: string
  cutOrderNo: string
  markerPlanNo: string
  productionOrderNo: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  colorSummary: string
  importedFromMarker: boolean
  materialReadiness: SpreadingMaterialReadiness
  planUnits: PdaCuttingSpreadingPlanUnitOption[]
}

export interface PdaCuttingSpreadingPlanUnitOption {
  planUnitId: string
  sourceType: 'marker-line' | 'high-low-row' | 'exception'
  sourceLineId: string
  stepNo?: number
  stepLabel?: string
  label: string
  color: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  garmentQtyPerUnit: number
  plannedRepeatCount: number
  lengthPerUnitM: number
  plannedCutGarmentQty: number
  plannedSpreadLengthM: number
  sizeRows: Array<{
    skuCode: string
    color: string
    size: string
    plannedQty: number
    plannedLayerCount?: number
  }>
  partRows: Array<{
    partCode: string
    partName: string
    pieceCountPerUnit: number
  }>
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

export interface PdaCuttingRecentAction {
  actionType: 'PICKUP' | 'SPREADING' | 'INBOUND' | 'HANDOVER'
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
  cutOrderId: string
  cutOrderNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
  markerPlanIds: string[]
  markerPlanNos: string[]
  executionOrderId: string
  executionOrderNo: string
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
  assigneeFactoryId: string
  assigneeFactoryName: string
  orderQty: number
  taskStatusLabel: string
  currentOwnerName: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
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
  recentActions: PdaCuttingRecentAction[]
  pickupLogs: PdaCuttingPickupLog[]
  spreadingTargets: PdaCuttingSpreadingTarget[]
  spreadingRecords: PdaCuttingSpreadingRecord[]
  inboundRecords: PdaCuttingInboundRecord[]
  handoverRecords: PdaCuttingHandoverRecord[]
  latestSyncStatus: string
  latestSyncSummary: string
}

export interface PdaCuttingRouteOptions {
  executionOrderId?: string
  executionOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  materialSku?: string
  returnTo?: string
}

export function listWorkerVisiblePdaSpreadingTargets(detail: PdaCuttingTaskDetailData): PdaCuttingSpreadingTarget[] {
  return detail.spreadingTargets.filter((target) => target.targetType === 'session')
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null))) as T[]
}

function matchPdaExecutionRecord(record: PdaCuttingExecutionSourceRecord, executionKey?: string | null): boolean {
  const key = executionKey?.trim()
  if (!key) return false

  return [
    record.executionOrderId,
    record.executionOrderNo,
    record.cutOrderId,
    record.cutOrderNo,
    record.markerPlanId,
    record.markerPlanNo,
    record.materialSku,
  ].some((value) => value === key)
}

function mapTaskStatusLabel(status: ProcessTask['status']): string {
  if (status === 'DONE') return '已完成'
  if (status === 'CANCELLED') return '已中止'
  if (status === 'BLOCKED') return '有异常'
  if (status === 'IN_PROGRESS') return '进行中'
  return '待开始'
}

function mapMaterialTypeLabel(record: GeneratedCutOrderSourceRecord | null): string {
  if (!record) return '待补面料类型'
  if (record.materialCategory) return record.materialCategory
  if (record.materialType === 'PRINT' || record.materialType === 'DYE' || record.materialType === 'SOLID') return '面料主料'
  if (record.materialType === 'LINING') return '里辅料'
  return '面料主料'
}

function mapReceiveStatusLabel(status: string | undefined): string {
  if (status === 'RECEIVED') return '已领料入仓'
  if (status === 'PARTIAL') return '领料数量不足'
  return '待裁床领料确认'
}

function buildPickupSlipNo(cutOrderNo: string): string {
  return `LLD-${cutOrderNo.replace(/^CUT-/, '')}`
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

function buildQrCodeValue(cutOrderNo: string): string {
  return `QR-${cutOrderNo}`
}

function buildConfiguredQtyText(record: GeneratedCutOrderSourceRecord, configuredLength = 0, configuredRollCount = 0): string {
  if (configuredRollCount > 0 || configuredLength > 0) {
    return `卷数 ${configuredRollCount || 0} 卷 / 长度 ${configuredLength || 0} 米`
  }
  const estimatedRollCount = Math.max(1, Math.ceil(record.requiredQty / 40))
  const estimatedLength = Math.max(record.requiredQty * 2, estimatedRollCount * 30)
  return `卷数 ${estimatedRollCount} 卷 / 长度 ${estimatedLength} 米`
}

function buildActualReceivedQtyText(input: {
  latestPickup: PdaPickupEventRecord | null
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

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(Number(value || 0), 0))
}

function buildSpreadingPlanUnitLabel(unit: SpreadingPlanUnit): string {
  const prefix = unit.stepLabel ? `${unit.stepLabel} / ` : ''
  return `${prefix}${unit.color || '待补颜色'} / ${unit.materialSku || '待补面料'} / ${formatQty(unit.garmentQtyPerUnit)}件/层`
}

function buildPlanUnitSizeRows(execution: PdaCuttingExecutionSourceRecord, color?: string): PdaCuttingSpreadingPlanUnitOption['sizeRows'] {
  const record = getCutOrderRecord(execution)
  if (!record?.skuScopeLines?.length) return []
  const normalizedColor = String(color || '').trim().toLowerCase()
  const matchingRows = normalizedColor
    ? record.skuScopeLines.filter((line) => String(line.color || '').trim().toLowerCase() === normalizedColor)
    : []
  const rows = matchingRows.length ? matchingRows : record.skuScopeLines
  return rows.map((line) => ({
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    plannedQty: Number(line.plannedQty || 0),
  }))
}

function buildPlanUnitPartRows(execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingPlanUnitOption['partRows'] {
  const record = getCutOrderRecord(execution)
  return (record?.pieceRows || [])
    .map((row) => ({
      partCode: row.partCode,
      partName: row.partName,
      pieceCountPerUnit: Number(row.pieceCountPerUnit || 0),
    }))
    .filter((row) => row.partName && row.pieceCountPerUnit > 0)
}

function withCuttingBreakdownRows(
  unit: Omit<PdaCuttingSpreadingPlanUnitOption, 'sizeRows' | 'partRows'>,
  execution: PdaCuttingExecutionSourceRecord,
  sizeRows?: PdaCuttingSpreadingPlanUnitOption['sizeRows'],
): PdaCuttingSpreadingPlanUnitOption {
  return {
    ...unit,
    sizeRows: sizeRows?.length ? sizeRows : buildPlanUnitSizeRows(execution, unit.color),
    partRows: buildPlanUnitPartRows(execution),
  }
}

function toSpreadingPlanUnitOption(unit: SpreadingPlanUnit, execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingPlanUnitOption {
  return {
    ...withCuttingBreakdownRows({
      planUnitId: unit.planUnitId,
      sourceType: unit.sourceType,
      sourceLineId: unit.sourceLineId,
      stepNo: unit.stepNo,
      stepLabel: unit.stepLabel,
      label: buildSpreadingPlanUnitLabel(unit),
      color: unit.color,
      materialSku: unit.materialSku,
      materialAlias: unit.materialAlias || '',
      materialImageUrl: unit.materialImageUrl || '',
      garmentQtyPerUnit: unit.garmentQtyPerUnit,
      plannedRepeatCount: unit.plannedRepeatCount,
      lengthPerUnitM: unit.lengthPerUnitM,
      plannedCutGarmentQty: unit.plannedCutGarmentQty,
      plannedSpreadLengthM: unit.plannedSpreadLengthM,
    }, execution, unit.sizeRows),
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
    color: session.colorSummary?.split(' / ')[0] || '',
    materialSku: session.materialSkuSummary?.split(' / ')[0] || execution.materialSku || '',
    materialAlias: execution.materialAlias || '',
    materialImageUrl: execution.materialImageUrl || '',
    garmentQtyPerUnit,
    plannedRepeatCount: Math.max(Number(session.plannedLayers || 0), 1),
    lengthPerUnitM: Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0) > 0 && Math.max(Number(session.plannedLayers || 0), 0) > 0
      ? Number((Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0) / Math.max(Number(session.plannedLayers || 0), 1)).toFixed(2))
      : 0,
    plannedCutGarmentQty: Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0),
    plannedSpreadLengthM: Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0),
  }
  return [toSpreadingPlanUnitOption(fallbackUnit, execution)]
}

function buildFallbackPlanUnitFromExecution(execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingPlanUnitOption {
  const scenario = getPdaCuttingTaskScenarioByTaskId(execution.taskId)
  const originalRecord = getCutOrderRecord(execution)
  const plannedRepeatCount = Math.max(
    Number(scenario?.executions.find((item) => item.executionOrderId === execution.executionOrderId)?.spreadingPreset?.layerCount || 0),
    100,
  )
  const plannedCutGarmentQty = Math.max(Number(scenario?.qty || originalRecord?.requiredQty || 0), 1)
  const garmentQtyPerUnit = Math.max(Math.round(plannedCutGarmentQty / plannedRepeatCount), 1)
  const plannedSpreadLengthM = Number((plannedRepeatCount * 2).toFixed(2))
  const unit: SpreadingPlanUnit = {
    planUnitId: `plan-unit-${execution.executionOrderId}-pda`,
    sourceType: 'exception',
    sourceLineId: execution.executionOrderId,
    color: originalRecord?.materialColor || '',
    materialSku: execution.materialSku || originalRecord?.materialSku || '',
    materialAlias: execution.materialAlias || originalRecord?.materialAlias || '',
    materialImageUrl: execution.materialImageUrl || originalRecord?.materialImageUrl || '',
    garmentQtyPerUnit,
    plannedRepeatCount,
    lengthPerUnitM: 2,
    plannedCutGarmentQty,
    plannedSpreadLengthM,
  }
  return toSpreadingPlanUnitOption(unit, execution)
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
    contextType: execution.markerPlanId ? 'marker-plan' : 'cut-order',
    cutOrderIds: execution.cutOrderId ? [execution.cutOrderId] : [],
    cutOrderNos: execution.cutOrderNo ? [execution.cutOrderNo] : [],
    markerPlanId: execution.markerPlanId || '',
    markerPlanNo: execution.markerPlanNo || '',
    productionOrderNos: execution.productionOrderNo ? [execution.productionOrderNo] : [],
    styleCode: input.styleCode || '',
    spuCode: input.spuCode || '',
    techPackSpuCode: input.spuCode || '',
    styleName: input.styleName || '',
    materialSkuSummary: input.markerMaterialSku || execution.materialSku || '',
    materialAliasSummary: execution.materialAlias || '',
    materialImageUrl: execution.materialImageUrl || '',
    materialPrepRows: [],
  }
}

function buildPlanUnitsFromCanonicalPlan(
  plan: MarkerPlanViewRow,
  execution: PdaCuttingExecutionSourceRecord,
): PdaCuttingSpreadingPlanUnitOption[] {
  const materialSku = (plan.materialSkuSummary || execution.materialSku || '').split(' / ')[0] || execution.materialSku || ''
  const materialAlias = plan.materialAliasSummary || execution.materialAlias || ''
  const materialImageUrl = plan.materialImageUrl || execution.materialImageUrl || ''
  const fallbackColor = (plan.colorSummary || '').split(' / ')[0] || ''

  const bedUnits = Array.isArray(plan.beds)
    ? plan.beds
        .filter((bed) => bed.readyForSpreading)
        .flatMap((bed, index) => {
          if (bed.bedMode === 'high_low' || bed.bedMode === 'fold_high_low') {
            return (bed.highLowMatrixRows || []).map((row, rowIndex) => {
              const stepNo = Math.max(Number(row.stepNo || rowIndex + 1), 1)
              const stepLabel = row.stepLabel || `第${stepNo}阶`
              const plannedRepeatCount = Math.max(
                ...Object.values(row.sizeValues || {}).map((value) => Math.max(Math.round(Number(value || 0)), 0)),
                1,
              )
              const actualRepeatCount = bed.bedMode === 'fold_high_low' ? plannedRepeatCount / 2 : plannedRepeatCount
              const plannedCutGarmentQty = Object.entries(row.sizeValues || {}).reduce((sum, [size, layer]) => {
                return sum + Math.max(Number(layer || 0), 0) * Math.max(Number(bed.sizePiecePerLayer?.[size] || 0), 0)
              }, 0)
              const garmentQtyPerUnit = actualRepeatCount > 0 ? Math.max(Math.ceil(plannedCutGarmentQty / actualRepeatCount), 0) : plannedCutGarmentQty
              const unit: SpreadingPlanUnit = {
                planUnitId: `plan-unit-${plan.id}-bed-${bed.bedId || index + 1}-step-${stepNo}`,
                sourceType: 'high-low-row',
                sourceLineId: row.rowId || `${bed.bedId || index + 1}-step-${stepNo}`,
                stepNo,
                stepLabel,
                color: row.colorName || row.colorCode || bed.colorName || bed.colorCode || fallbackColor,
                materialSku: bed.materialSku || materialSku,
                materialAlias,
                materialImageUrl,
                garmentQtyPerUnit,
                plannedRepeatCount: actualRepeatCount,
                lengthPerUnitM: Number(row.markerLength || 0),
                plannedCutGarmentQty,
                plannedSpreadLengthM: Number((((Number(row.markerLength || 0) + 0.06) * actualRepeatCount).toFixed(2))),
                sizeLayerValues: Object.fromEntries(Object.entries(row.sizeValues || {}).map(([size, value]) => [size, Math.max(Number(value || 0), 0)])),
                sizeRows: Object.entries(row.sizeValues || {})
                  .filter(([, value]) => Math.max(Number(value || 0), 0) > 0)
                  .map(([size, value]) => ({
                    skuCode: `${row.colorName || row.colorCode || fallbackColor}-${size}`,
                    color: row.colorName || row.colorCode || fallbackColor,
                    size,
                    plannedQty: Math.max(Number(value || 0), 0) * Math.max(Number(bed.sizePiecePerLayer?.[size] || 0), 0),
                    plannedLayerCount: Math.max(Number(value || 0), 0),
                  })),
              }
              return withCuttingBreakdownRows({
                ...unit,
                label: buildSpreadingPlanUnitLabel(unit),
              }, execution, unit.sizeRows)
            })
          }
          const unit: SpreadingPlanUnit = {
            planUnitId: `plan-unit-${plan.id}-bed-${bed.bedId || index + 1}`,
            sourceType: bed.bedMode === 'high_low' || bed.bedMode === 'fold_high_low' ? 'high-low-row' : 'marker-line',
            sourceLineId: bed.bedId || `${index + 1}`,
            color: bed.colorName || bed.colorCode || fallbackColor,
            materialSku: bed.materialSku || materialSku,
            materialAlias,
            materialImageUrl,
            garmentQtyPerUnit: Number(bed.markerPieceQtyPerLayer || 0),
            plannedRepeatCount: Number(bed.plannedLayerCount || 0),
            lengthPerUnitM: Number(bed.markerLength || 0),
            plannedCutGarmentQty: Number(bed.plannedGarmentQty || 0),
            plannedSpreadLengthM: Number(bed.spreadTotalLength || 0),
          }
          return withCuttingBreakdownRows({
            ...unit,
            label: buildSpreadingPlanUnitLabel(unit),
          }, execution)
        })
    : []

  if (bedUnits.length) return bedUnits

  const layoutUnits = Array.isArray(plan.layoutLines)
    ? plan.layoutLines.map((line, index) => {
      const unit: Omit<PdaCuttingSpreadingPlanUnitOption, 'sizeRows' | 'partRows'> = {
        planUnitId: `plan-unit-${plan.id}-layout-${line.id || index + 1}`,
          sourceType: 'marker-line',
          sourceLineId: line.id || `${index + 1}`,
          color: line.colorCode || fallbackColor,
          materialSku,
          materialAlias,
          materialImageUrl,
          garmentQtyPerUnit: Number(line.markerPieceQty || 0),
          plannedRepeatCount: Number(line.repeatCount || 0),
          lengthPerUnitM: Number(line.markerLength || 0),
          plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
          plannedSpreadLengthM: Number(line.spreadLength || 0),
        label: '',
      }
      unit.label = buildSpreadingPlanUnitLabel(unit)
      return withCuttingBreakdownRows(unit, execution)
    })
    : []

  if (layoutUnits.length) return layoutUnits

  const modeUnits = Array.isArray(plan.modeDetailLines)
    ? plan.modeDetailLines.map((line, index) => {
      const unit: Omit<PdaCuttingSpreadingPlanUnitOption, 'sizeRows' | 'partRows'> = {
        planUnitId: `plan-unit-${plan.id}-mode-${line.id || index + 1}`,
          sourceType: 'high-low-row',
          sourceLineId: line.id || `${index + 1}`,
          color: line.colorCode || fallbackColor,
          materialSku,
          materialAlias,
          materialImageUrl,
          garmentQtyPerUnit: Number(line.markerPieceQty || 0),
          plannedRepeatCount: Number(line.repeatCount || 0),
          lengthPerUnitM: Number(line.markerLength || 0),
          plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
          plannedSpreadLengthM: Number(line.spreadLength || 0),
        label: '',
      }
      unit.label = buildSpreadingPlanUnitLabel(unit)
      return withCuttingBreakdownRows(unit, execution)
    })
    : []

  if (modeUnits.length) return modeUnits

  return [
    withCuttingBreakdownRows({
      planUnitId: `plan-unit-${plan.id}-fallback`,
      sourceType: 'exception',
      sourceLineId: 'fallback',
      label: `${fallbackColor || '待补颜色'} / ${materialSku || '待补面料'} / ${Number(plan.totalPieces || 0)} 件`,
      color: fallbackColor,
      materialSku,
      materialAlias,
      materialImageUrl,
      garmentQtyPerUnit: Number(plan.totalPieces || 0),
      plannedRepeatCount: 1,
      lengthPerUnitM: Number(plan.netLength || 0),
      plannedCutGarmentQty: Number(plan.totalPieces || 0),
      plannedSpreadLengthM: Number(plan.plannedSpreadLength || 0),
    }, execution),
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
  const originalRecord = firstExecution?.cutOrderId
    ? getGeneratedCutOrderSourceRecordById(firstExecution.cutOrderId)
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
    assignedFactoryId: scenario?.assignedFactoryId || TEST_FACTORY_ID,
    assignedFactoryName: scenario?.assignedFactoryName || TEST_FACTORY_NAME,
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
  const runtimeTasks = listTaskChainTasks().filter((task) =>
    task.processBusinessCode !== 'WOOL'
    && task.processCode !== 'PROC_WOOL'
    && task.processCode !== 'WOOL',
  )
  const runtimeTaskIds = new Set(runtimeTasks.map((task) => task.taskId))
  const genericTasks = listPdaGenericProcessTasks().filter((task) => !runtimeTaskIds.has(task.taskId))
  const existingAfterGenericIds = new Set([...runtimeTaskIds, ...genericTasks.map((task) => task.taskId)])
  const woolTasks = listWoolMobileProcessTasks().filter((task) => !existingAfterGenericIds.has(task.taskId))
  const genericTaskIds = new Set([...genericTasks.map((task) => task.taskId), ...woolTasks.map((task) => task.taskId)])
  const validCuttingCutOrderIds = new Set(listGeneratedCutOrderSourceRecords().map((record) => record.cutOrderId))
  const executableFallbackTaskIds = new Set(
    listPdaCuttingExecutionSourceRecords()
      .filter((record) => validCuttingCutOrderIds.has(record.cutOrderId))
      .map((record) => record.taskId),
  )
  const fallbackCuttingTasks = listPdaCuttingTaskSourceRecords()
    .filter((record) => executableFallbackTaskIds.has(record.taskId))
    .filter((record) => !runtimeTaskIds.has(record.taskId) && !genericTaskIds.has(record.taskId))
    .map((record) => buildFallbackCuttingTaskFact(record))

  return [...runtimeTasks, ...genericTasks, ...woolTasks, ...fallbackCuttingTasks]
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
    const line = record.materialLines.find((item) => item.cutOrderId === execution.cutOrderId || item.cutOrderNo === execution.cutOrderNo)
    if (line) return line
  }
  return null
}

function getCutOrderRecord(execution: PdaCuttingExecutionSourceRecord) {
  if (!execution.cutOrderId) return null
  return getGeneratedCutOrderSourceRecordById(execution.cutOrderId)
}

function getLatestPickup(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaPickupEventRecord | null {
  const rows = snapshot.pdaExecutionState.pickupEvents as unknown as PdaPickupEventRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null
}

function getLatestInbound(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCutPieceInboundEventRecord | null {
  const rows = snapshot.pdaExecutionState.inboundEvents as unknown as PdaCutPieceInboundEventRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null
}

function getLatestHandover(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCutPieceHandoverEventRecord | null {
  const rows = snapshot.pdaExecutionState.handoverEvents as unknown as PdaCutPieceHandoverEventRecord[]
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null
}

function listSessionsForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): SpreadingSession[] {
  const store = getMarkerStore(snapshot)
  return (store.sessions || [])
    .filter((session) => (session.cutOrderIds || []).includes(execution.cutOrderId) || (execution.markerPlanId && session.markerPlanId === execution.markerPlanId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

function listMarkersForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord) {
  const store = getMarkerStore(snapshot)
  return (store.markers || [])
    .filter((marker) => (marker.cutOrderIds || []).includes(execution.cutOrderId) || (execution.markerPlanId && marker.markerPlanId === execution.markerPlanId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

function listCanonicalMarkerPlansForExecution(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord) {
  const projection = buildMarkerPlanProjection(snapshot)
  return projection.viewModel.plans
    .filter(
      (plan) =>
        plan.cutOrderIds.includes(execution.cutOrderId)
        || (execution.markerPlanId && plan.markerPlanId === execution.markerPlanId),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

function mapMarkerPlanModeToSpreadingMode(mode: 'normal' | 'high_low' | 'fold_normal' | 'fold_high_low'): PdaSpreadingMode {
  if (mode === 'high_low') return 'HIGH_LOW'
  if (mode === 'fold_high_low') return 'FOLD_HIGH_LOW'
  if (mode === 'fold_normal') return 'FOLD_NORMAL'
  return 'NORMAL'
}

function sumPlanUnitSpreadLength(planUnits: PdaCuttingSpreadingPlanUnitOption[]): number {
  return Number(planUnits.reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0).toFixed(2))
}

function resolvePdaTargetMaterialReadiness(
  execution: PdaCuttingExecutionSourceRecord,
  planUnits: PdaCuttingSpreadingPlanUnitOption[],
): SpreadingMaterialReadiness {
  return resolveSpreadingMaterialReadiness({
    sourceCutOrderIds: [execution.cutOrderId].filter(Boolean),
    sourceCutOrderNos: [execution.cutOrderNo].filter(Boolean),
    plannedMaterialUsage: sumPlanUnitSpreadLength(planUnits),
    plannedMaterialUsageUnit: '米',
  })
}

function buildSpreadingTargets(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingSpreadingTarget[] {
  const sessions = listSessionsForExecution(snapshot, execution)
  const sessionTargets = sessions.map((session) => {
    const planUnits = (session.planUnits?.length ? session.planUnits : undefined)?.map((unit) => toSpreadingPlanUnitOption(unit, execution)) || buildFallbackPlanUnitsFromSession(session, execution)
    return {
      targetKey: `session:${session.spreadingSessionId}`,
      targetType: 'session' as const,
      spreadingSessionId: session.spreadingSessionId,
      markerId: session.markerId || '',
      markerNo: session.markerNo || '',
      sourceMarkerLabel:
        session.sourceSchemeNo && (session.sourceBedNo || session.markerNo)
          ? `${session.sourceSchemeNo} / ${session.sourceBedNo || session.markerNo}`
          : session.markerNo || session.sourceMarkerNo || session.sessionNo || '待关联唛架编号',
      spreadingMode: mapSpreadingModeKey(session.spreadingMode),
      title: session.sessionNo || `铺布对象 ${session.spreadingSessionId.slice(-6)}`,
      contextLabel: '继续当前铺布',
      statusLabel: session.status === 'DONE' ? '已完成' : session.status === 'IN_PROGRESS' ? '进行中' : session.status === 'TO_FILL' ? '待补录' : '草稿',
      cutOrderNo: execution.cutOrderNo || '',
      markerPlanNo: execution.markerPlanNo || '',
      productionOrderNo: execution.productionOrderNo || '',
      materialSku: execution.materialSku || '',
      materialAlias: execution.materialAlias || '',
      materialImageUrl: execution.materialImageUrl || '',
      colorSummary: session.colorSummary || '',
      importedFromMarker: Boolean(session.importedFromMarker),
      materialReadiness: resolvePdaTargetMaterialReadiness(execution, planUnits),
      planUnits,
    }
  })
  if (sessionTargets.length) return sessionTargets

  const canonicalTargets = listCanonicalMarkerPlansForExecution(snapshot, execution).map((plan) => {
    const planUnits = buildPlanUnitsFromCanonicalPlan(plan, execution)
    return {
      targetKey: `marker-plan:${plan.id}`,
      targetType: 'session' as const,
      spreadingSessionId: '',
      markerId: plan.id,
      markerNo: plan.markerNo || plan.contextNo || '',
      sourceMarkerLabel: plan.markerNo || plan.contextNo || '待关联唛架编号',
      spreadingMode: mapMarkerPlanModeToSpreadingMode(plan.markerMode),
      title: plan.markerNo || plan.contextNo || `铺布对象 ${execution.executionOrderNo}`,
      contextLabel: '待铺布',
      statusLabel: '待铺布',
      cutOrderNo: execution.cutOrderNo || '',
      markerPlanNo: plan.markerPlanNo || execution.markerPlanNo || '',
      productionOrderNo: execution.productionOrderNo || '',
      materialSku: execution.materialSku || plan.sourceMaterialSku || '',
      materialAlias: execution.materialAlias || plan.materialAliasSummary || '',
      materialImageUrl: execution.materialImageUrl || plan.materialImageUrl || '',
      colorSummary: plan.colorSummary || '',
      importedFromMarker: true,
      materialReadiness: resolvePdaTargetMaterialReadiness(execution, planUnits),
      planUnits,
    }
  })
  if (canonicalTargets.length) return canonicalTargets

  if (!isPdaSequenceMockTask(execution.taskId)) return []
  const fallbackUnit = buildFallbackPlanUnitFromExecution(execution)
  return [{
    targetKey: `pda-sequence:${execution.executionOrderId}`,
    targetType: 'session',
    spreadingSessionId: '',
    markerId: execution.markerPlanId || '',
    markerNo: execution.markerPlanNo || 'A-1',
    sourceMarkerLabel: execution.markerPlanNo || 'PDA 验证唛架编号 A-1',
    spreadingMode: 'NORMAL',
    title: `铺布单 ${execution.taskId}`,
    contextLabel: '待铺布',
    statusLabel: '待铺布',
    cutOrderNo: execution.cutOrderNo || '',
    markerPlanNo: execution.markerPlanNo || '',
    productionOrderNo: execution.productionOrderNo || '',
    materialSku: execution.materialSku || fallbackUnit.materialSku || '',
    materialAlias: execution.materialAlias || fallbackUnit.materialAlias || '',
    materialImageUrl: execution.materialImageUrl || fallbackUnit.materialImageUrl || '',
    colorSummary: fallbackUnit.color || '',
    importedFromMarker: true,
    materialReadiness: resolvePdaTargetMaterialReadiness(execution, [fallbackUnit]),
    planUnits: [fallbackUnit],
  }]
}

function getScenarioSpreadingPreset(execution: PdaCuttingExecutionSourceRecord): {
  status: 'STARTED' | 'DONE' | 'CUTTING' | 'CUT_DONE' | 'BLOCKED'
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

function includesAny(value: string | undefined, keywords: string[]): boolean {
  if (!value) return false
  return keywords.some((keyword) => value.includes(keyword))
}

function isReceiveCompleted(status: string): boolean {
  return includesAny(status, ['来料已入仓', '已回执', '已领取'])
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
  mobileStage: PdaCuttingMobileStage
}): PdaCuttingCurrentStepCode {
  if (input.mobileStage === 'WAIT_PICKUP') return 'PICKUP'
  if (input.mobileStage === 'WAIT_START') return 'START'
  if (
    input.mobileStage === 'WAIT_SPREADING' ||
    input.mobileStage === 'SPREADING' ||
    input.mobileStage === 'WAIT_CUTTING' ||
    input.mobileStage === 'CUTTING'
  ) return 'SPREADING'
  return 'DONE'
}

function resolveMobileStageLabel(stage: PdaCuttingMobileStage): string {
  if (stage === 'WAIT_PICKUP') return '待领料'
  if (stage === 'WAIT_START') return '待开工'
  if (stage === 'WAIT_SPREADING') return '待铺布'
  if (stage === 'SPREADING') return '铺布中'
  if (stage === 'WAIT_CUTTING') return '待裁剪'
  if (stage === 'CUTTING') return '裁剪中'
  return '已裁剪'
}

function resolveNextAction(line: {
  mobileStage: PdaCuttingMobileStage
  taskStatus: ProcessTask['status']
  hasException: boolean
}): string {
  if (line.taskStatus === 'CANCELLED' || line.taskStatus === 'BLOCKED') return '查看提交结果'
  if (line.mobileStage === 'WAIT_PICKUP') return '去领料'
  if (line.mobileStage === 'WAIT_START') return '开工'
  if (line.mobileStage === 'WAIT_SPREADING') return '开始铺布'
  if (line.mobileStage === 'SPREADING') return '完成铺布'
  if (line.mobileStage === 'WAIT_CUTTING') return '开始裁剪'
  if (line.mobileStage === 'CUTTING') return '完成裁剪'
  return '查看提交结果'
}

function resolveCurrentState(line: {
  bindingState: 'BOUND' | 'UNBOUND'
  taskStatus: ProcessTask['status']
  currentExecutionStatus: string
  pickupSuccess: boolean
  hasSpreading: boolean
  hasInbound: boolean
  hasHandover: boolean
  hasException: boolean
}): string {
  if (line.bindingState === 'UNBOUND') return '待绑定'
  if (line.taskStatus === 'CANCELLED') return '已中止'
  if (line.taskStatus === 'BLOCKED' && line.currentExecutionStatus.includes('暂停')) return '执行暂停'
  if (line.hasException && !line.pickupSuccess) return '领料差异待处理'
  if (!line.pickupSuccess) return '待裁床领料'
  if (line.taskStatus === 'NOT_STARTED') return '待开工'
  if (line.currentExecutionStatus === '待铺布') return '待铺布'
  if (line.currentExecutionStatus === '铺布中') return '铺布中'
  if (line.currentExecutionStatus === '已铺布待裁剪') return '待裁剪'
  if (line.currentExecutionStatus === '裁剪中') return '裁剪中'
  if (line.currentExecutionStatus === '已裁剪') return '已裁剪'
  return line.currentExecutionStatus || '待铺布'
}

function resolvePrimaryExecutionRouteKey(input: {
  bindingState: 'BOUND' | 'UNBOUND'
  taskStatus: ProcessTask['status']
  currentStepCode: PdaCuttingCurrentStepCode
  hasException: boolean
}): Exclude<PdaCuttingRouteKey, 'task' | 'unit'> {
  if (input.bindingState === 'UNBOUND') return 'spreading'
  if (input.taskStatus === 'CANCELLED') return 'handover'
  if (input.currentStepCode === 'PICKUP') return 'spreading'
  if (input.currentStepCode === 'SPREADING') return 'spreading'
  if (input.currentStepCode === 'INBOUND') return 'inbound'
  if (input.currentStepCode === 'HANDOVER') return 'handover'
  return 'handover'
}

function runtimeEventActionType(eventType: CuttingRuntimeEventType): PdaCuttingStageActionType | null {
  if (eventType === '裁片单开工') return 'START_WORK'
  if (eventType === '开始铺布') return 'START_SPREADING'
  if (eventType === '完成铺布') return 'FINISH_SPREADING'
  if (eventType === '开始裁剪') return 'START_CUTTING'
  if (eventType === '完成裁剪') return 'FINISH_CUTTING'
  return null
}

function runtimeActionLabel(actionType: PdaCuttingStageActionType): string {
  if (actionType === 'START_WORK') return '开工'
  if (actionType === 'START_SPREADING') return '开始铺布'
  if (actionType === 'FINISH_SPREADING') return '完成铺布'
  if (actionType === 'START_CUTTING') return '开始裁剪'
  return '完成裁剪'
}

function eventMatchesExecution(event: CuttingRuntimeEvent, execution: PdaCuttingExecutionSourceRecord): boolean {
  return [
    event.refs.spreadingOrderId && event.refs.spreadingOrderId === execution.executionOrderId,
    event.refs.spreadingOrderNo && event.refs.spreadingOrderNo === execution.executionOrderNo,
    event.refs.cutOrderId && event.refs.cutOrderId === execution.cutOrderId,
    event.refs.cutOrderNo && event.refs.cutOrderNo === execution.cutOrderNo,
  ].some(Boolean)
}

function numberFromPayload(payload: CuttingRuntimeEvent['payload'], key: string): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = Number((payload as Record<string, unknown>)[key])
  return Number.isFinite(value) ? value : undefined
}

function stringFromPayload(payload: CuttingRuntimeEvent['payload'], key: string): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function actualCutQtyFromRuntimePayload(payload: CuttingRuntimeEvent['payload']): number | undefined {
  const direct = numberFromPayload(payload, 'actualPieceQty')
  if (direct !== undefined) return direct
  if (!payload || typeof payload !== 'object') return undefined
  const outputLines = (payload as Record<string, unknown>).outputLines
  if (!Array.isArray(outputLines)) return undefined
  const total = outputLines.reduce((sum, line) => {
    if (!line || typeof line !== 'object') return sum
    return sum + Number((line as Record<string, unknown>).actualPieceQty || 0)
  }, 0)
  return Number.isFinite(total) && total > 0 ? total : undefined
}

function noteFromRuntimeEvent(event: CuttingRuntimeEvent): string {
  if (event.eventType === '完成铺布') return 'PDA 完成铺布事件已同步。'
  if (event.eventType === '开始铺布') return 'PDA 开始铺布事件已同步。'
  if (event.eventType === '完成裁剪') return 'PDA 完成裁剪事件已同步。'
  if (event.eventType === '开始裁剪') return 'PDA 开始裁剪事件已同步。'
  return 'PDA 开工事件已同步。'
}

function mapRuntimeEventToStageRecord(
  event: CuttingRuntimeEvent,
  execution: PdaCuttingExecutionSourceRecord,
): PdaCuttingStageEventRecord | null {
  const actionType = runtimeEventActionType(event.eventType)
  if (!actionType || !eventMatchesExecution(event, execution)) return null
  const syncStatus: PdaCuttingSyncStatus = event.eventStatus === '同步失败' ? '同步失败' : '已同步'
  return {
    runtimeEventId: event.eventId,
    taskId: execution.taskId,
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    cutOrderId: event.refs.cutOrderId || execution.cutOrderId,
    cutOrderNo: event.refs.cutOrderNo || execution.cutOrderNo,
    markerPlanId: event.refs.markerPlanId || execution.markerPlanId,
    markerPlanNo: event.refs.markerPlanNo || execution.markerPlanNo,
    actionType,
    actionLabel: runtimeActionLabel(actionType),
    submittedAt: event.occurredAt,
    operatorName: event.operatorName || '现场操作员',
    syncStatus,
    planUnitId: stringFromPayload(event.payload, 'planUnitId'),
    sourceLineId: stringFromPayload(event.payload, 'sourceLineId'),
    stepNo: numberFromPayload(event.payload, 'stepNo'),
    stepLabel: stringFromPayload(event.payload, 'stepLabel'),
    actualLayerCount: numberFromPayload(event.payload, 'actualLayerCount'),
    actualSpreadLength: numberFromPayload(event.payload, 'actualSpreadLength'),
    headLength: numberFromPayload(event.payload, 'headLength'),
    tailLength: numberFromPayload(event.payload, 'tailLength'),
    actualCutQty: actualCutQtyFromRuntimePayload(event.payload),
    actualUsage: numberFromPayload(event.payload, 'actualMaterialUsage'),
    varianceFlag: Array.isArray((event.payload as Record<string, unknown>).differenceTypes)
      ? ((event.payload as Record<string, unknown>).differenceTypes as unknown[]).length > 0
      : Boolean((event.payload as Record<string, unknown>).hasDifference),
    note: noteFromRuntimeEvent(event),
  }
}

function listRuntimeStageEventsByExecution(execution: PdaCuttingExecutionSourceRecord): PdaCuttingStageEventRecord[] {
  return listCuttingRuntimeEvents()
    .map((event) => mapRuntimeEventToStageRecord(event, execution))
    .filter((record): record is PdaCuttingStageEventRecord => Boolean(record))
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

function hasSyncedAction(records: PdaCuttingStageEventRecord[], actionType: PdaCuttingStageActionType): boolean {
  return records.some((record) => record.actionType === actionType && record.syncStatus !== '同步失败')
}

function latestSyncedAction(records: PdaCuttingStageEventRecord[]): PdaCuttingStageEventRecord | null {
  return records.find((record) => record.syncStatus !== '同步失败') ?? null
}

function isPdaSequenceMockTask(taskId?: string): boolean {
  return Boolean(taskId?.startsWith('TASK-CUT-PDA-'))
}

function resolveMobileStage(input: {
  taskStatus: ProcessTask['status']
  hasPickupSuccess: boolean
  hasStarted: boolean
  stageActions: PdaCuttingStageEventRecord[]
  preset: ReturnType<typeof getScenarioSpreadingPreset>
  sessions: SpreadingSession[]
}): PdaCuttingMobileStage {
  if (!input.hasPickupSuccess) return 'WAIT_PICKUP'
  if (!input.hasStarted) return 'WAIT_START'

  const latestSynced = latestSyncedAction(input.stageActions)
  if (latestSynced?.actionType === 'FINISH_CUTTING') return 'CUT_DONE'
  if (latestSynced?.actionType === 'START_CUTTING') return 'CUTTING'
  if (latestSynced?.actionType === 'FINISH_SPREADING') return 'WAIT_CUTTING'
  if (latestSynced?.actionType === 'START_SPREADING') return 'SPREADING'

  if (input.taskStatus === 'DONE') return 'CUT_DONE'
  if (input.preset?.status === 'CUT_DONE') return 'CUT_DONE'
  if (input.preset?.status === 'CUTTING') return 'CUTTING'
  if (input.preset?.status === 'DONE') return 'WAIT_CUTTING'
  if (input.preset?.status === 'STARTED') return 'SPREADING'

  const latestSession = input.sessions[0] ?? null
  if (latestSession?.status === 'DONE') return 'WAIT_CUTTING'
  if (latestSession?.status === 'IN_PROGRESS') return 'SPREADING'

  return 'WAIT_SPREADING'
}

function buildSyncSummary(record: PdaCuttingStageEventRecord | null): string {
  if (!record) return '暂无提交'
  return `${record.syncStatus}：${record.actionLabel}${record.varianceFlag ? '（已标记差异）' : ''} / ${record.submittedAt}`
}

function listRiskTips(line: {
  disputeSummary?: string
  hasInbound: boolean
  hasHandover: boolean
}): string[] {
  const tips: string[] = []
  if (line.disputeSummary) tips.push(line.disputeSummary)
  if (!line.hasInbound) tips.push('当前尚未完成入仓扫码，后续仓务无法稳定回流。')
  if (!line.hasHandover) tips.push('当前尚未完成交接扫码，后道承接状态未闭环。')
  return unique(tips)
}

function buildTaskOrderLine(
  execution: PdaCuttingExecutionSourceRecord,
  sortOrder: number,
  snapshot: CuttingDomainSnapshot,
): PdaCuttingTaskOrderLine {
  const scenario = getPdaCuttingTaskScenarioByTaskId(execution.taskId)
  const progressLine = getProgressLine(snapshot, execution)
  const originalRecord = getCutOrderRecord(execution)
  const latestPickup = getLatestPickup(snapshot, execution)
  const latestInbound = getLatestInbound(snapshot, execution)
  const latestHandover = getLatestHandover(snapshot, execution)
  const sessions = listSessionsForExecution(snapshot, execution)
  const preset = getScenarioSpreadingPreset(execution)
  const stageActions = listRuntimeStageEventsByExecution(execution)
  const latestStageAction = stageActions[0] ?? null
  const pickupDispute = execution.cutOrderNo ? getLatestClaimDisputeByCutOrderNo(execution.cutOrderNo) : null
  const hasInbound = Boolean(latestInbound)
  const hasHandover = Boolean(latestHandover)
  const hasDownstreamWarehouseSignal = hasInbound || hasHandover
  const useExplicitPickupEvent = isPdaSequenceMockTask(execution.taskId)
  const currentReceiveStatus =
    pickupDispute && pickupDispute.status !== 'COMPLETED' && pickupDispute.status !== 'REJECTED'
      ? '来料异议处理中'
      : latestPickup?.resultLabel
        || (useExplicitPickupEvent
          ? '待裁床领料'
          : hasDownstreamWarehouseSignal
            ? '来料已入仓'
            : mapReceiveStatusLabel(progressLine?.receiveStatus))
  const hasPickupSuccess =
    Boolean(latestPickup)
    || (!useExplicitPickupEvent && (
      progressLine?.receiveStatus === 'RECEIVED'
      || hasDownstreamWarehouseSignal
    ))
  const hasStarted =
    scenario?.taskStatus === 'IN_PROGRESS'
    || scenario?.taskStatus === 'DONE'
    || scenario?.taskStatus === 'BLOCKED'
    || Boolean(scenario?.startedAt)
    || hasSyncedAction(stageActions, 'START_WORK')
  const mobileStage = resolveMobileStage({
    taskStatus: scenario?.taskStatus || 'NOT_STARTED',
    hasPickupSuccess,
    hasStarted,
    stageActions,
    preset,
    sessions,
  })
  const hasSpreading =
    mobileStage === 'SPREADING'
    || mobileStage === 'WAIT_CUTTING'
    || mobileStage === 'CUTTING'
    || mobileStage === 'CUT_DONE'
  const currentExecutionStatus =
    execution.bindingState === 'UNBOUND'
      ? '待绑定裁片单'
      : mobileStage === 'WAIT_PICKUP'
        ? '待领料'
        : mobileStage === 'WAIT_START'
        ? '待开工'
        : scenario?.taskStatus === 'CANCELLED'
          ? '执行已中止'
          : preset?.status === 'BLOCKED' || scenario?.taskStatus === 'BLOCKED'
            ? '铺布已暂停'
            : mobileStage === 'WAIT_SPREADING'
              ? '待铺布'
              : mobileStage === 'SPREADING'
                ? '铺布中'
                : mobileStage === 'WAIT_CUTTING'
                  ? '已铺布待裁剪'
                  : mobileStage === 'CUTTING'
                    ? '裁剪中'
                    : '已裁剪'
  const currentInboundStatus = latestInbound ? '已入仓' : '待入仓扫码'
  const currentHandoverStatus = latestHandover ? '已交接' : '待交接扫码'
  const hasException =
    currentReceiveStatus.includes('异议')
    || currentReceiveStatus.includes('差异')
    || execution.bindingState === 'UNBOUND'
    || currentExecutionStatus.includes('暂停')
    || currentExecutionStatus.includes('中止')
  const currentStepCode = resolveCurrentStepCode({
    mobileStage,
  })
  const currentStepLabel = resolveMobileStageLabel(mobileStage)
  const currentStateLabel = resolveCurrentState({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || 'NOT_STARTED',
    currentExecutionStatus,
    pickupSuccess: hasPickupSuccess,
    hasSpreading,
    hasInbound,
    hasHandover,
    hasException,
  })
  const primaryExecutionRouteKey = resolvePrimaryExecutionRouteKey({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || 'NOT_STARTED',
    currentStepCode,
    hasException,
  })
  const latestSyncStatus = latestStageAction?.syncStatus || (latestPickup ? '已同步' : '暂无提交')
  const latestSyncSummary = latestStageAction ? buildSyncSummary(latestStageAction) : (latestPickup ? `已同步：领料 / ${latestPickup.submittedAt}` : '暂无提交')
  return {
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    productionOrderId: execution.productionOrderId,
    productionOrderNo: execution.productionOrderNo,
    cutOrderId: execution.cutOrderId,
    cutOrderNo: execution.cutOrderNo,
    markerPlanId: execution.markerPlanId,
    markerPlanNo: execution.markerPlanNo,
    materialSku: execution.materialSku,
    materialAlias: execution.materialAlias || originalRecord?.materialAlias || '',
    materialImageUrl: execution.materialImageUrl || originalRecord?.materialImageUrl || '',
    bindingState: execution.bindingState,
    materialTypeLabel: mapMaterialTypeLabel(originalRecord),
    colorLabel: originalRecord?.colorScope.join(' / ') || progressLine?.color || (execution.bindingState === 'UNBOUND' ? '待绑定' : ''),
    plannedQty: originalRecord?.requiredQty || scenario?.qty || 0,
    currentReceiveStatus,
    currentExecutionStatus,
    currentInboundStatus,
    currentHandoverStatus,
    currentStateLabel,
    currentStepCode,
    currentStepLabel,
    primaryExecutionRouteKey,
    nextActionLabel: resolveNextAction({
      mobileStage,
      taskStatus: scenario?.taskStatus || 'NOT_STARTED',
      hasException,
    }),
    mobileStage,
    latestSyncStatus,
    latestSyncSummary,
    qrCodeValue: buildQrCodeValue(execution.cutOrderNo || execution.executionOrderNo),
    pickupSlipNo: buildPickupSlipNo(execution.cutOrderNo || execution.executionOrderNo),
    isDone:
      mobileStage === 'CUT_DONE'
      || scenario?.taskStatus === 'DONE',
    hasException,
    sortOrder,
  }
}

function buildPickupLogs(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingPickupLog[] {
  const latestPickup = getLatestPickup(snapshot, execution)
  if (!latestPickup) return []
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestPickup.runtimeEventId,
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
    const latestHandoverOperator =
      [...linkedOperators]
        .sort((left, right) => right.endAt.localeCompare(left.endAt, 'zh-CN'))
        .find((operator) =>
          operator.actionType === '中途交接'
          || operator.actionType === '接手继续'
          || operator.handoverFlag,
        )
      || null
    const handoverResultLabel =
      latestHandoverOperator?.actionType === '接手继续'
        ? `接手自：${latestHandoverOperator.previousOperatorName || '上一位铺布员'}`
        : latestHandoverOperator?.actionType === '中途交接'
          ? `交接给：${latestHandoverOperator.nextOperatorName || '下一位铺布员'}`
          : '无换班'
    return {
      executionOrderId: execution.executionOrderId,
      id: roll.rollRecordId,
      spreadingSessionId: session.spreadingSessionId,
      planUnitId: roll.planUnitId || '',
      stepNo: roll.stepNo,
      stepLabel: roll.stepLabel,
      rollRecordId: roll.rollRecordId,
      operatorRecordId: latestOperator?.operatorRecordId || '',
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
      handoverFlag: latestHandoverOperator !== null,
      handoverResultLabel,
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
      planUnitId: '',
      rollRecordId: '',
      operatorRecordId: '',
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
      handoverResultLabel: '无换班',
      note: preset.note,
    },
  ]
}

export interface PdaCuttingSpreadingTraceMatrixRow {
  taskId: string
  executionOrderId: string
  executionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  spreadingSessionId: string
  markerId: string
  markerNo: string
  sourceWritebackId: string
  planUnitId: string
  rollRecordId: string
  operatorRecordId: string
}

export function buildPdaCuttingSpreadingTraceMatrix(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): PdaCuttingSpreadingTraceMatrixRow[] {
  return listPdaCuttingExecutionSourceRecords()
    .flatMap((execution) =>
      buildSpreadingRecords(snapshot, execution)
        .filter((record) => Boolean(record.spreadingSessionId))
        .map((record) => ({
          taskId: execution.taskId,
          executionOrderId: execution.executionOrderId,
          executionOrderNo: execution.executionOrderNo,
          cutOrderId: execution.cutOrderId,
          cutOrderNo: execution.cutOrderNo,
          markerPlanId: execution.markerPlanId,
          markerPlanNo: execution.markerPlanNo,
          spreadingSessionId: record.spreadingSessionId,
          markerId: record.markerId,
          markerNo: record.markerNo,
          sourceWritebackId: record.sourceWritebackId || '',
          planUnitId: record.planUnitId || '',
          rollRecordId: record.rollRecordId || '',
          operatorRecordId: record.operatorRecordId || '',
        })),
    )
    .sort(
      (left, right) =>
        left.executionOrderNo.localeCompare(right.executionOrderNo, 'zh-CN')
        || left.spreadingSessionId.localeCompare(right.spreadingSessionId, 'zh-CN')
        || left.rollRecordId.localeCompare(right.rollRecordId, 'zh-CN'),
    )
}

function buildInboundRecords(snapshot: CuttingDomainSnapshot, execution: PdaCuttingExecutionSourceRecord): PdaCuttingInboundRecord[] {
  const latestInbound = getLatestInbound(snapshot, execution)
  if (!latestInbound) return []
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestInbound.runtimeEventId,
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
    id: latestHandover.runtimeEventId,
    handoverAt: latestHandover.submittedAt,
    operatorName: latestHandover.operatorName,
    targetLabel: latestHandover.targetLabel,
    resultLabel: '交接扫码确认完成',
    note: latestHandover.note,
  }]
}

function buildRecentActions(input: {
  pickupLogs: PdaCuttingPickupLog[]
  spreadingRecords: PdaCuttingSpreadingRecord[]
  inboundRecords: PdaCuttingInboundRecord[]
  handoverRecords: PdaCuttingHandoverRecord[]
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
    receiveSummary: executions.some((item) => item.currentReceiveStatus.includes('异议')) ? '存在来料异议' : executions.every((item) => isReceiveCompleted(item.currentReceiveStatus)) ? '来料已入待加工仓' : '待加工仓未入',
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
    handoverSummary: '后续阶段处理',
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
    const isSpecialCraftTask = task.processNameZh?.includes('特殊工艺') || task.processBusinessName?.includes('特殊工艺')
    const isCuttingTask = task.processNameZh === '裁片' || task.processBusinessName === '裁片'
    const shouldUseDemoFactory = isSpecialCraftTask || isCuttingTask
    return Object.assign(task, {
      assignedFactoryId: task.assignedFactoryId || (shouldUseDemoFactory ? TEST_FACTORY_ID : task.assignedFactoryId),
      assignedFactoryName: task.assignedFactoryName || (shouldUseDemoFactory ? TEST_FACTORY_NAME : task.assignedFactoryName),
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
    cutOrderIds: unique(executionRecords.map((item) => item.cutOrderId).filter(Boolean)),
    cutOrderNos: unique(executionRecords.map((item) => item.cutOrderNo).filter(Boolean)),
    markerPlanIds: unique(executionRecords.map((item) => item.markerPlanId).filter(Boolean)),
    markerPlanNos: unique(executionRecords.map((item) => item.markerPlanNo).filter(Boolean)),
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

  const originalRecord = getCutOrderRecord(selectedExecutionRecord)
  const progressLine = getProgressLine(currentSnapshot, selectedExecutionRecord)
  const pickupLogs = buildPickupLogs(currentSnapshot, selectedExecutionRecord)
  const spreadingTargets = buildSpreadingTargets(currentSnapshot, selectedExecutionRecord)
  const spreadingRecords = buildSpreadingRecords(currentSnapshot, selectedExecutionRecord)
  const inboundRecords = buildInboundRecords(currentSnapshot, selectedExecutionRecord)
  const handoverRecords = buildHandoverRecords(currentSnapshot, selectedExecutionRecord)
  const latestPickup = pickupLogs[0]
  const latestSpreading = spreadingRecords[0]
  const latestInbound = inboundRecords[0]
  const latestHandover = handoverRecords[0]
  const operators = listOperatorsForExecution(currentSnapshot, selectedExecutionRecord)
  const pickupDispute = selectedExecutionRecord.cutOrderNo
    ? getLatestClaimDisputeByCutOrderNo(selectedExecutionRecord.cutOrderNo)
    : null
  const riskTips = listRiskTips({
    disputeSummary: pickupDispute && pickupDispute.status !== 'COMPLETED' && pickupDispute.status !== 'REJECTED'
      ? `${pickupDispute.disputeReason}，待平台处理`
      : undefined,
    hasInbound: selectedLine.currentInboundStatus === '已入仓',
    hasHandover: selectedLine.currentHandoverStatus === '已交接',
  })
  const receiveSummary = selectedLine.currentReceiveStatus
  const executionSummary = spreadingRecords.length > 0 ? `已有 ${spreadingRecords.length} 条铺布记录` : '待开始铺布'
  const handoverSummary = handoverRecords.length > 0 ? '交接扫码已完成' : '待交接扫码'
  const configuredQtyText = buildConfiguredQtyText(
    originalRecord ?? {
      cutOrderId: selectedExecutionRecord.cutOrderId,
      cutOrderNo: selectedExecutionRecord.cutOrderNo,
      generationKey: selectedExecutionRecord.cutOrderId || selectedExecutionRecord.cutOrderNo,
      productionOrderId: selectedExecutionRecord.productionOrderId,
      productionOrderNo: selectedExecutionRecord.productionOrderNo,
      spuCode: '',
      styleId: '',
      styleCode: '',
      styleName: '',
      techPackVersionId: '',
      techPackVersionLabel: '',
      materialSku: selectedExecutionRecord.materialSku,
      materialName: selectedExecutionRecord.materialSku,
      materialColor: '',
      materialType: 'SOLID',
      materialLabel: selectedExecutionRecord.materialSku,
      materialCategory: '',
      materialAlias: selectedExecutionRecord.materialAlias || '',
      materialImageUrl: selectedExecutionRecord.materialImageUrl || '',
      materialUnit: '米',
      materialIdentity: {
        materialSku: selectedExecutionRecord.materialSku,
        materialName: selectedExecutionRecord.materialSku,
        materialColor: '',
        materialAlias: selectedExecutionRecord.materialAlias || selectedExecutionRecord.materialSku,
        materialImageUrl: selectedExecutionRecord.materialImageUrl || '',
        materialUnit: '米',
      },
      patternIdentity: {
        patternFileId: '',
        patternFileName: '待补纸样文件',
        patternVersion: '待补',
        patternKind: '待补纸样类型',
        effectiveWidthValue: 0,
        effectiveWidthUnit: 'cm',
        piecePartCodes: [],
        piecePartNames: [],
      },
      markerPlanId: selectedExecutionRecord.markerPlanId,
      markerPlanNo: selectedExecutionRecord.markerPlanNo,
      requiredQty: 0,
      sourceTechPackSpuCode: '',
      colorScope: [],
      skuScopeLines: [],
      pieceRows: [],
      pieceSummary: '裁片信息待补',
    },
    progressLine?.configuredLength,
    progressLine?.configuredRollCount,
  )
  const actualReceivedQtyText = buildActualReceivedQtyText({
    latestPickup: getLatestPickup(currentSnapshot, selectedExecutionRecord),
    receivedLength: isPdaSequenceMockTask(selectedExecutionRecord.taskId) && !latestPickup ? 0 : progressLine?.receivedLength,
    receivedRollCount: isPdaSequenceMockTask(selectedExecutionRecord.taskId) && !latestPickup ? 0 : progressLine?.receivedRollCount,
  })
  const currentOwnerName = task.assignedFactoryName || '工艺工厂裁片执行'
  const orderQty = originalRecord?.requiredQty || 0
  const latestOperatorName = operators[0]?.operator.operatorName || latestPickup?.operatorName || latestInbound?.operatorName || latestHandover?.operatorName || '现场操作员'

  return {
    taskId,
    taskNo: task.taskNo || task.taskId,
    productionOrderId: selectedExecutionRecord.productionOrderId,
    productionOrderNo: selectedExecutionRecord.productionOrderNo,
    cutOrderId: selectedExecutionRecord.cutOrderId,
    cutOrderNo: selectedExecutionRecord.cutOrderNo,
    cutOrderIds: unique(executionRecords.map((record) => record.cutOrderId).filter(Boolean)),
    cutOrderNos: unique(executionRecords.map((record) => record.cutOrderNo).filter(Boolean)),
    markerPlanId: selectedExecutionRecord.markerPlanId,
    markerPlanNo: selectedExecutionRecord.markerPlanNo,
    markerPlanIds: unique(executionRecords.map((record) => record.markerPlanId).filter(Boolean)),
    markerPlanNos: unique(executionRecords.map((record) => record.markerPlanNo).filter(Boolean)),
    executionOrderId: selectedExecutionRecord.executionOrderId,
    executionOrderNo: selectedExecutionRecord.executionOrderNo,
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
    assigneeFactoryId: task.assignedFactoryId || '',
    assigneeFactoryName: task.assignedFactoryName || '工艺工厂裁片执行',
    orderQty,
    taskStatusLabel: task.taskStateLabel || mapTaskStatusLabel(task.status),
    currentOwnerName,
    materialSku: selectedExecutionRecord.materialSku,
    materialAlias: selectedLine.materialAlias || selectedExecutionRecord.materialAlias || originalRecord?.materialAlias || '',
    materialImageUrl: selectedLine.materialImageUrl || selectedExecutionRecord.materialImageUrl || originalRecord?.materialImageUrl || '',
    materialTypeLabel: selectedLine.materialTypeLabel,
    pickupSlipNo: selectedLine.pickupSlipNo,
    pickupSlipPrintStatusLabel: progressLine?.printSlipStatus === 'PRINTED' ? '已打印' : '待打印',
    qrObjectLabel: '裁片单主码',
    discrepancyAllowed: true,
    hasQrCode: true,
    qrCodeValue: selectedLine.qrCodeValue,
    qrVersionNote: '二维码主码已绑定裁片单',
    currentStage: selectedLine.currentStateLabel,
    currentActionHint:
      selectedLine.bindingState === 'UNBOUND'
        ? `当前执行对象 ${selectedLine.executionOrderNo} 尚未绑定裁片单，请先处理绑定异常。`
        : `当前执行对象 ${selectedLine.executionOrderNo} 绑定裁片单 ${selectedLine.cutOrderNo}。`,
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
    photoProofCount: latestPickup?.photoProofCount || pickupDispute?.evidenceCount || 0,
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
    recentActions: buildRecentActions({ pickupLogs, spreadingRecords, inboundRecords, handoverRecords }),
    pickupLogs,
    spreadingTargets,
    spreadingRecords,
    inboundRecords,
    handoverRecords,
    latestSyncStatus: selectedLine.latestSyncStatus,
    latestSyncSummary: selectedLine.latestSyncSummary,
  }
}

export function getPdaCuttingTaskDetail(taskId: string, executionKey?: string): PdaCuttingTaskDetailData | null {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

export function listWorkerVisiblePdaSpreadingTargetsByTask(
  taskId: string,
  executionKey?: string,
): PdaCuttingSpreadingTarget[] {
  const detail = getPdaCuttingTaskSnapshot(taskId, executionKey)
  if (!detail) return []
  return detail.spreadingTargets.filter((target) => target.targetType === 'session')
}

export function buildPdaCuttingRoute(taskId: string, routeKey: PdaCuttingRouteKey, options: PdaCuttingRouteOptions = {}): string {
  const basePath =
    routeKey === 'task'
      ? `/fcs/pda/cutting/task/${taskId}`
      : routeKey === 'unit'
        ? `/fcs/pda/cutting/unit/${taskId}/${options.executionOrderId?.trim() || 'default'}`
        : routeKey === 'spreading'
          ? `/fcs/pda/cutting/spreading/${taskId}`
          : routeKey === 'inbound'
            ? `/fcs/pda/cutting/inbound/${taskId}`
            : `/fcs/pda/cutting/handover/${taskId}`
  const params = new URLSearchParams()
  if (options.returnTo?.trim()) params.set('returnTo', options.returnTo.trim())
  if (options.executionOrderId?.trim()) params.set('executionOrderId', options.executionOrderId.trim())
  if (options.executionOrderNo?.trim()) params.set('executionOrderNo', options.executionOrderNo.trim())
  if (options.cutOrderId?.trim()) params.set('cutOrderId', options.cutOrderId.trim())
  if (options.cutOrderNo?.trim()) params.set('cutOrderNo', options.cutOrderNo.trim())
  if (options.markerPlanId?.trim()) params.set('markerPlanId', options.markerPlanId.trim())
  if (options.markerPlanNo?.trim()) params.set('markerPlanNo', options.markerPlanNo.trim())
  if (options.materialSku?.trim()) params.set('materialSku', options.materialSku.trim())
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function resolvePdaTaskDetailPath(taskId: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (!task || !isCuttingSpecialTask(task)) {
    if (!returnTo?.trim()) return `/fcs/pda/task-receive/${taskId}`
    return `/fcs/pda/task-receive/${taskId}?returnTo=${encodeURIComponent(returnTo.trim())}`
  }
  return buildPdaCuttingRoute(taskId, 'task', { returnTo })
}

export function resolvePdaTaskExecPath(taskId: string, returnTo?: string): string {
  const task = getPdaTaskFlowTaskById(taskId)
  if (!task || !isCuttingSpecialTask(task)) {
    if (!returnTo?.trim()) return `/fcs/pda/exec/${taskId}`
    return `/fcs/pda/exec/${taskId}?returnTo=${encodeURIComponent(returnTo.trim())}`
  }
  const rows = listPdaCuttingExecutionRowsByTaskId(taskId)
  if (rows.length !== 1) return buildPdaCuttingRoute(taskId, 'task', { returnTo })
  const line = rows[0]
  if (!line) return buildPdaCuttingRoute(taskId, 'task', { returnTo })
  if (line.currentStepCode === 'PICKUP') {
    const query = new URLSearchParams()
    query.set('tab', 'pickup')
    query.set('focusTaskId', taskId)
    if (returnTo?.trim()) query.set('returnTo', returnTo.trim())
    return `/fcs/pda/handover?${query.toString()}`
  }
  if (line.currentStepCode === 'START') return buildPdaCuttingRoute(taskId, 'task', { returnTo })
  return buildPdaCuttingRoute(taskId, line.primaryExecutionRouteKey, {
    executionOrderId: line.executionOrderId,
    executionOrderNo: line.executionOrderNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo,
    markerPlanId: line.markerPlanId,
    markerPlanNo: line.markerPlanNo,
    materialSku: line.materialSku,
    returnTo,
  })
}

export function resolvePdaHandoverDetailPath(handoverId: string, _returnTo?: string): string {
  return `/fcs/pda/handover/${handoverId}`
}
