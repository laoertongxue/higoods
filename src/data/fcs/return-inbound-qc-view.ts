import type { ProcessTask } from './process-tasks'
import {
  inferReturnInboundProcessTypeFromTask,
  resolveDefaultReturnInboundQcPolicy,
  type QcDisposition,
  type QcResult,
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
  SEW_WITH_POST: '车缝（含后道）',
  SEW_WITHOUT_POST_WAREHOUSE_INTEGRATED: '车缝（后道仓一体）',
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
  inboundAt: string
  inboundBy: string
  sewPostProcessMode?: SewPostProcessMode
  sourceBusinessType: string
  sourceBusinessId: string
  result: QcResult
  status: QcStatus
  disposition?: QcDisposition
  affectedQty?: number
  inspectedAt: string
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
      ? SEW_POST_PROCESS_MODE_LABEL[qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode!]
      : RETURN_INBOUND_PROCESS_LABEL[processType]

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
    inboundAt: inboundBatch?.inboundAt ?? '-',
    inboundBy: inboundBatch?.inboundBy ?? '-',
    sewPostProcessMode: qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode,
    sourceBusinessType: qc.sourceBusinessType ?? inboundBatch?.sourceType ?? 'OTHER',
    sourceBusinessId: qc.sourceBusinessId ?? inboundBatch?.sourceId ?? '',
    result: qc.result,
    status: qc.status,
    disposition: qc.disposition,
    affectedQty: qc.affectedQty,
    inspectedAt: qc.inspectedAt,
  }
}
