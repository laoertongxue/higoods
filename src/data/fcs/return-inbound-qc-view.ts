import type { ProcessTask } from './process-tasks'
import {
  inferReturnInboundProcessTypeFromTask,
  resolveDefaultReturnInboundQcPolicy,
  type InspectionMethod,
  type InspectionNextAction,
  type InspectionScene,
  type InspectionType,
  type QcDisposition,
  type QcStatus,
  type QualityInspection,
  type ReturnInboundBatch,
  type ReturnInboundProcessType,
  type ReturnInboundQcPolicy,
  type SewPostProcessMode,
} from './store-domain-quality-types'
import {
  findReturnInboundBatchForQc,
  isReturnInboundInspection,
  resolveReturnInboundTaskId,
} from './return-inbound-workflow'
import { getPostExecutionModeLabel } from './post-process-route'

export const RETURN_INBOUND_PROCESS_LABEL: Record<ReturnInboundProcessType, string> = {
  PRINT: '印花',
  DYE: '染色',
  CUT_PANEL: '裁片',
  SEW: '车缝',
  OTHER: '其他',
  DYE_PRINT: '染印',
}

export const RETURN_INBOUND_QC_POLICY_LABEL: Record<ReturnInboundQcPolicy, string> = {
  REQUIRED: '必检',
  OPTIONAL: '可选',
  SKIPPED: '免检',
}

export const SEW_POST_PROCESS_MODE_LABEL: Record<SewPostProcessMode, string> = {
  SEW_FACTORY_INCLUDES_POST: '车缝厂含后道',
  MANAGED_POST_FACTORY_EXECUTES: '我方后道工厂执行后道',
}

export const INSPECTION_SCENE_LABEL: Record<InspectionScene, string> = {
  SEW_RETURN_RECEIVING_QC: '回货质检',
  POST_FINAL_RECHECK: '后道复检',
  PRINT_RECEIVING_QC: '印花回货质检',
  DYE_RECEIVING_QC: '染色回货质检',
  CUT_PIECE_RECEIVING_QC: '裁片回货质检',
}

export const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  QC: '质检',
  RECHECK: '复检',
}

export const INSPECTION_METHOD_LABEL: Record<InspectionMethod, string> = {
  COUNT_ONLY: '数量复核',
  SAMPLING: '抽检',
  FULL_INSPECTION: '全检',
}

export const INSPECTION_NEXT_ACTION_LABEL: Record<InspectionNextAction, string> = {
  ENTER_POST_PROCESS: '进入后道',
  ENTER_FINAL_RECHECK: '进入复检',
  HANDOVER_FINISHED_WAREHOUSE: '交成衣仓',
  REWORK: '返工',
  WAIT_EXCEPTION_HANDLE: '待处理',
}

export type ReturnInboundQcDisplayResult = 'PASS' | 'PARTIAL_PASS' | 'FAIL'

export interface ReturnInboundQcQuantitySummary {
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  qualifiedRate: number
  unqualifiedRate: number
  result: ReturnInboundQcDisplayResult
}

export interface ReturnInboundQcView {
  qc: QualityInspection
  qcId: string
  isReturnInbound: boolean
  isLegacy: boolean
  batchId: string
  productionOrderId: string
  sourceTaskId: string
  processType: ReturnInboundProcessType
  processLabel: string
  qcPolicy: ReturnInboundQcPolicy
  returnFactoryId: string
  returnFactoryName: string
  warehouseId: string
  warehouseName: string
  receiverName: string
  inboundAt: string
  inboundBy: string
  sewPostProcessMode?: SewPostProcessMode
  inspectionSceneLabel?: string
  inspectionTypeLabel?: string
  inspectionMethodLabel?: string
  nextActionLabel?: string
  declaredQty: number
  receivedQty: number
  sourceBusinessType: string
  sourceBusinessId: string
  inspector: string
  result: ReturnInboundQcDisplayResult
  status: QcStatus
  disposition?: QcDisposition
  affectedQty?: number
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  qualifiedRate: number
  unqualifiedRate: number
  inspectedAt: string
}

function normalizeQty(value?: number): number | null {
  if (value === undefined || value === null) return null
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

export function resolveQcInspectionSummary(
  qc: QualityInspection,
  batch: ReturnInboundBatch | null,
  task: ProcessTask | null,
): ReturnInboundQcQuantitySummary {
  const defectQty = qc.defectItems.reduce((sum, item) => sum + item.qty, 0)
  const writebackQty =
    (qc.writebackAvailableQty ?? 0) +
    (qc.writebackAcceptedAsDefectQty ?? 0) +
    (qc.writebackScrapQty ?? 0)

  const inspectedQty =
    normalizeQty(qc.inspectedQty) ??
    normalizeQty(batch?.returnedQty) ??
    normalizeQty(task?.qty) ??
    normalizeQty(writebackQty > 0 ? writebackQty : undefined) ??
    normalizeQty(qc.affectedQty) ??
    normalizeQty(defectQty) ??
    0

  let qualifiedQty = normalizeQty(qc.qualifiedQty)
  let unqualifiedQty = normalizeQty(qc.unqualifiedQty)

  if (qc.result === 'PASS') {
    qualifiedQty = inspectedQty
    unqualifiedQty = 0
  } else {
    const derivedUnqualifiedQty =
      unqualifiedQty ??
      normalizeQty(qc.affectedQty) ??
      normalizeQty(defectQty) ??
      normalizeQty(
        (qc.writebackAcceptedAsDefectQty ?? 0) + (qc.writebackScrapQty ?? 0) > 0
          ? (qc.writebackAcceptedAsDefectQty ?? 0) + (qc.writebackScrapQty ?? 0)
          : undefined,
      ) ??
      inspectedQty
    unqualifiedQty = Math.min(derivedUnqualifiedQty, inspectedQty)
    qualifiedQty = qualifiedQty ?? Math.max(inspectedQty - unqualifiedQty, 0)
  }

  const result: ReturnInboundQcDisplayResult =
    unqualifiedQty <= 0
      ? 'PASS'
      : qualifiedQty > 0
        ? 'PARTIAL_PASS'
        : 'FAIL'

  return {
    inspectedQty,
    qualifiedQty,
    unqualifiedQty,
    qualifiedRate: inspectedQty > 0 ? Math.round((qualifiedQty / inspectedQty) * 1000) / 10 : 0,
    unqualifiedRate: inspectedQty > 0 ? Math.round((unqualifiedQty / inspectedQty) * 1000) / 10 : 0,
    result,
  }
}

export function getReturnInboundBatchById(
  batches: ReturnInboundBatch[],
  batchId?: string,
): ReturnInboundBatch | null {
  if (!batchId) return null
  return batches.find((item) => item.batchId === batchId) ?? null
}

function resolveProcessType(
  qc: QualityInspection,
  batch: ReturnInboundBatch | null,
  task: ProcessTask | null,
): ReturnInboundProcessType {
  if (qc.returnProcessType) return qc.returnProcessType
  if (batch?.processType) return batch.processType
  if (qc.sourceProcessType) return qc.sourceProcessType
  if (task) return inferReturnInboundProcessTypeFromTask(task)
  return 'OTHER'
}

export function normalizeQcForView(
  qc: QualityInspection,
  batches: ReturnInboundBatch[],
  tasks: ProcessTask[],
): ReturnInboundQcView {
  const inboundBatch = findReturnInboundBatchForQc(qc, batches)
  const resolvedTaskId = resolveReturnInboundTaskId(qc, inboundBatch) ?? ''
  const task = resolvedTaskId ? tasks.find((item) => item.taskId === resolvedTaskId) ?? null : null
  const isInbound = isReturnInboundInspection(qc)
  const processType = resolveProcessType(qc, inboundBatch, task)
  const qcPolicy = qc.qcPolicy ?? inboundBatch?.qcPolicy ?? resolveDefaultReturnInboundQcPolicy(processType)
  const processLabel =
    processType === 'SEW' && (qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode)
      ? getPostExecutionModeLabel(qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode)
      : RETURN_INBOUND_PROCESS_LABEL[processType]
  const inspectionSummary = resolveQcInspectionSummary(qc, inboundBatch, task)
  const receiverName = qc.receiverName ?? inboundBatch?.receiverName ?? qc.warehouseName ?? inboundBatch?.warehouseName ?? '-'
  const inspectionSceneLabel =
    qc.inspectionScene && qc.inspectionScene !== 'RETURN_INBOUND' ? INSPECTION_SCENE_LABEL[qc.inspectionScene] : undefined
  const inspectionTypeLabel = qc.inspectionType ? INSPECTION_TYPE_LABEL[qc.inspectionType] : undefined
  const inspectionMethodLabel = qc.inspectionMethod ? INSPECTION_METHOD_LABEL[qc.inspectionMethod] : undefined
  const nextActionLabel = qc.nextAction ? INSPECTION_NEXT_ACTION_LABEL[qc.nextAction] : undefined

  return {
    qc,
    qcId: qc.qcId,
    isReturnInbound: isInbound,
    isLegacy: !isInbound,
    batchId: qc.returnBatchId ?? (qc.refType === 'RETURN_BATCH' ? qc.refId : inboundBatch?.batchId ?? ''),
    productionOrderId: qc.productionOrderId ?? inboundBatch?.productionOrderId ?? task?.productionOrderId ?? '-',
    sourceTaskId: resolvedTaskId,
    processType,
    processLabel,
    qcPolicy,
    returnFactoryId: qc.returnFactoryId ?? inboundBatch?.returnFactoryId ?? task?.assignedFactoryId ?? '',
    returnFactoryName: qc.returnFactoryName ?? inboundBatch?.returnFactoryName ?? task?.assignedFactoryName ?? '-',
    warehouseId: qc.warehouseId ?? inboundBatch?.warehouseId ?? '',
    warehouseName: qc.warehouseName ?? inboundBatch?.warehouseName ?? '-',
    receiverName,
    inboundAt: inboundBatch?.inboundAt ?? '-',
    inboundBy: inboundBatch?.inboundBy ?? '-',
    sewPostProcessMode: qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode,
    inspectionSceneLabel,
    inspectionTypeLabel,
    inspectionMethodLabel,
    nextActionLabel,
    declaredQty: qc.declaredQty ?? inboundBatch?.submittedQty ?? inboundBatch?.returnedQty ?? inspectionSummary.inspectedQty,
    receivedQty: qc.receivedQty ?? inboundBatch?.receiverWrittenQty ?? inspectionSummary.inspectedQty,
    sourceBusinessType: qc.sourceBusinessType ?? inboundBatch?.sourceType ?? 'OTHER',
    sourceBusinessId: qc.sourceBusinessId ?? inboundBatch?.sourceId ?? '',
    inspector: qc.inspector,
    result: inspectionSummary.result,
    status: qc.status,
    disposition: qc.disposition,
    affectedQty: qc.affectedQty,
    inspectedQty: inspectionSummary.inspectedQty,
    qualifiedQty: inspectionSummary.qualifiedQty,
    unqualifiedQty: inspectionSummary.unqualifiedQty,
    qualifiedRate: inspectionSummary.qualifiedRate,
    unqualifiedRate: inspectionSummary.unqualifiedRate,
    inspectedAt: qc.inspectedAt,
  }
}
