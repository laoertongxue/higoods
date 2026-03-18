import type { ProcessTask } from './process-tasks'
import type {
  AllocationEvent,
  AllocationSnapshot,
  DeductionDecision,
  DeductionBasisItem,
  DeductionBasisStatus,
  DefectItem,
  LiabilityDecisionStage,
  QcDisposition,
  QualityInspection,
  ReturnInboundBatch,
  ReturnInboundBatchStatus,
  ReturnInboundQcPolicy,
  ReturnInboundSourceBusinessType,
  RootCauseType,
  SettlementPartyType,
} from './store-domain-quality-types'

interface CreateReturnInboundBatchRecordInput {
  batches: ReturnInboundBatch[]
  batchId: string
  productionOrderId: string
  sourceTaskId?: string
  processType: ReturnInboundBatch['processType']
  processLabel?: string
  returnedQty: number
  returnFactoryId?: string
  returnFactoryName?: string
  warehouseId?: string
  warehouseName?: string
  inboundAt?: string
  inboundBy: string
  qcPolicy: ReturnInboundQcPolicy
  qcStatus?: ReturnInboundBatchStatus
  sourceType?: ReturnInboundSourceBusinessType
  sourceId?: string
  sewPostProcessMode?: ReturnInboundBatch['sewPostProcessMode']
  now?: string
}

interface UpdateReturnInboundBatchStatusInput {
  batches: ReturnInboundBatch[]
  batchId: string
  qcStatus: ReturnInboundBatchStatus
  linkedQcId?: string
  by: string
  now?: string
}

interface CreateQcFromReturnInboundBatchInput {
  inspections: QualityInspection[]
  batch: ReturnInboundBatch
  productionOrderId: string
  by: string
  inspectedAt?: string
  result?: 'PASS' | 'FAIL'
  disposition?: QcDisposition
  affectedQty?: number
  defectItems?: DefectItem[]
  remark?: string
  rootCauseType?: RootCauseType
  refTypeMode?: 'RETURN_BATCH' | 'LEGACY_TASK_COMPAT'
  refTaskId?: string
  sourceBusinessType?: ReturnInboundSourceBusinessType
  sourceBusinessId?: string
}

interface UpsertDeductionBasisFromReturnInboundQcInput {
  basisItems: DeductionBasisItem[]
  qc: QualityInspection
  batch: ReturnInboundBatch
  by: string
  now?: string
  taskId?: string
  factoryId?: string
  settlementPartyType?: SettlementPartyType
  settlementPartyId?: string
  summary?: string
}

interface BlockTaskForReturnInboundQcInput {
  task: ProcessTask
  qcId: string
  by: string
  now?: string
  remark?: string
}

interface ApplyReturnInboundPassWritebackInput {
  batch: ReturnInboundBatch
  allocationByTaskId: Record<string, AllocationSnapshot>
  allocationEvents: AllocationEvent[]
  by: string
  now?: string
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

function ensureUniqueId(prefix: string, hasId: (id: string) => boolean): string {
  const base = Date.now()
  let offset = 0
  while (offset < 1000) {
    const id = `${prefix}-${base + offset}-${randomSuffix(3)}`
    if (!hasId(id)) return id
    offset += 1
  }
  return `${prefix}-${base}-${randomSuffix(6)}`
}

export function createReturnInboundBatchRecord(input: CreateReturnInboundBatchRecordInput): ReturnInboundBatch {
  const ts = input.now ?? nowTimestamp()
  const next: ReturnInboundBatch = {
    batchId: input.batchId,
    productionOrderId: input.productionOrderId,
    sourceTaskId: input.sourceTaskId,
    processType: input.processType,
    processLabel: input.processLabel,
    returnedQty: input.returnedQty,
    returnFactoryId: input.returnFactoryId,
    returnFactoryName: input.returnFactoryName,
    warehouseId: input.warehouseId,
    warehouseName: input.warehouseName,
    inboundAt: input.inboundAt ?? ts,
    inboundBy: input.inboundBy,
    qcPolicy: input.qcPolicy,
    qcStatus: input.qcStatus ?? 'QC_PENDING',
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sewPostProcessMode: input.sewPostProcessMode,
    createdAt: ts,
    createdBy: input.inboundBy,
    updatedAt: ts,
    updatedBy: input.inboundBy,
  }

  const index = input.batches.findIndex((item) => item.batchId === input.batchId)
  if (index >= 0) {
    const previous = input.batches[index]
    input.batches[index] = {
      ...previous,
      ...next,
      createdAt: previous.createdAt,
      createdBy: previous.createdBy,
    }
    return input.batches[index]
  }

  input.batches.push(next)
  return next
}

export function updateReturnInboundBatchStatus(input: UpdateReturnInboundBatchStatusInput): ReturnInboundBatch | null {
  const index = input.batches.findIndex((item) => item.batchId === input.batchId)
  if (index < 0) return null

  const ts = input.now ?? nowTimestamp()
  const current = input.batches[index]
  const updated: ReturnInboundBatch = {
    ...current,
    qcStatus: input.qcStatus,
    linkedQcId: input.linkedQcId ?? current.linkedQcId,
    updatedAt: ts,
    updatedBy: input.by,
  }
  input.batches[index] = updated
  return updated
}

export function isReturnInboundInspection(qc: QualityInspection): boolean {
  return qc.inspectionScene === 'RETURN_INBOUND' || qc.refType === 'RETURN_BATCH' || Boolean(qc.returnBatchId)
}

export function isSewReturnInboundQc(qc: QualityInspection, batches: ReturnInboundBatch[] = []): boolean {
  if (!isReturnInboundInspection(qc)) return false
  const inboundBatch = findReturnInboundBatchForQc(qc, batches)
  const processType = qc.returnProcessType ?? qc.sourceProcessType ?? inboundBatch?.processType
  return processType === 'SEW'
}

export function requiresFinalLiabilityDecision(qc: QualityInspection, batches: ReturnInboundBatch[] = []): boolean {
  return isSewReturnInboundQc(qc, batches)
}

export function findReturnInboundBatchForQc(
  qc: QualityInspection,
  batches: ReturnInboundBatch[],
): ReturnInboundBatch | null {
  const batchId = qc.returnBatchId || (qc.refType === 'RETURN_BATCH' ? qc.refId : undefined)
  if (!batchId) return null
  return batches.find((item) => item.batchId === batchId) ?? null
}

export function resolveReturnInboundTaskId(qc: QualityInspection, batch: ReturnInboundBatch | null): string | undefined {
  return batch?.sourceTaskId || qc.refTaskId || (qc.refType === 'TASK' ? qc.refId : undefined)
}

export function createQcFromReturnInboundBatch(input: CreateQcFromReturnInboundBatchInput): QualityInspection {
  const ts = input.inspectedAt ?? nowTimestamp()
  const result = input.result ?? 'FAIL'
  const refTypeMode = input.refTypeMode ?? 'RETURN_BATCH'
  const refId = refTypeMode === 'RETURN_BATCH' ? input.batch.batchId : input.refTaskId || input.batch.sourceTaskId || input.batch.batchId
  const finalDecisionRequired = input.batch.processType === 'SEW'

  const qcId = ensureUniqueId('QC-RIB', (id) => input.inspections.some((item) => item.qcId === id))

  const defects =
    input.defectItems && input.defectItems.length > 0
      ? input.defectItems
      : result === 'FAIL'
        ? [
            {
              defectCode: 'RETURN_INBOUND_DEFECT',
              defectName: '回货入仓不合格',
              qty: input.affectedQty ?? input.batch.returnedQty,
            },
          ]
        : []

  const qc: QualityInspection = {
    qcId,
    refType: refTypeMode === 'RETURN_BATCH' ? 'RETURN_BATCH' : 'TASK',
    refId,
    refTaskId: input.refTaskId ?? input.batch.sourceTaskId,
    productionOrderId: input.productionOrderId,
    inspector: input.by,
    inspectedAt: ts,
    result,
    defectItems: defects,
    remark: input.remark,
    status: 'SUBMITTED',
    disposition: result === 'FAIL' ? input.disposition : undefined,
    affectedQty: result === 'FAIL' ? input.affectedQty ?? input.batch.returnedQty : undefined,
    rootCauseType: input.rootCauseType ?? 'UNKNOWN',
    responsiblePartyType: input.batch.sourceType === 'DYE_PRINT_ORDER' ? 'PROCESSOR' : 'FACTORY',
    responsiblePartyId: input.batch.returnFactoryId,
    liabilityStatus: 'DRAFT',
    liabilityDecisionStage: finalDecisionRequired ? 'SEW_RETURN_INBOUND_FINAL' : 'GENERAL',
    liabilityDecisionRequired: finalDecisionRequired,
    sourceProcessType: input.batch.processType,
    sourceOrderId:
      (input.sourceBusinessType ?? input.batch.sourceType) === 'DYE_PRINT_ORDER'
        ? (input.sourceBusinessId ?? input.batch.sourceId)
        : undefined,
    sourceReturnId: input.batch.batchId,
    inspectionScene: 'RETURN_INBOUND',
    returnBatchId: input.batch.batchId,
    returnProcessType: input.batch.processType,
    qcPolicy: input.batch.qcPolicy,
    returnFactoryId: input.batch.returnFactoryId,
    returnFactoryName: input.batch.returnFactoryName,
    warehouseId: input.batch.warehouseId,
    warehouseName: input.batch.warehouseName,
    sourceBusinessType: input.sourceBusinessType ?? input.batch.sourceType,
    sourceBusinessId: input.sourceBusinessId ?? input.batch.sourceId,
    sewPostProcessMode: input.batch.sewPostProcessMode,
    auditLogs: [
      {
        id: ensureUniqueId('QAL-RIB', () => false),
        action: 'CREATE_FROM_RETURN_INBOUND',
        detail: `回货入仓批次 ${input.batch.batchId} 生成质检记录`,
        at: ts,
        by: input.by,
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  }

  input.inspections.push(qc)
  return qc
}

export function upsertDeductionBasisFromReturnInboundQc(
  input: UpsertDeductionBasisFromReturnInboundQcInput,
): DeductionBasisItem | null {
  if (input.qc.result !== 'FAIL') return null

  const ts = input.now ?? nowTimestamp()
  const qty = input.qc.affectedQty && input.qc.affectedQty > 0 ? input.qc.affectedQty : input.batch.returnedQty
  if (!qty || qty <= 0) return null

  const sourceType = input.qc.disposition === 'ACCEPT_AS_DEFECT' ? 'QC_DEFECT_ACCEPT' : 'QC_FAIL'
  const sourceBusinessType = input.qc.sourceBusinessType ?? input.batch.sourceType
  const sourceBusinessId = input.qc.sourceBusinessId ?? input.batch.sourceId
  const taskId = input.taskId ?? input.qc.refTaskId ?? input.batch.sourceTaskId
  const factoryId = input.factoryId ?? input.batch.returnFactoryId ?? 'UNKNOWN'
  const settlementPartyType = input.settlementPartyType ?? (sourceBusinessType === 'DYE_PRINT_ORDER' ? 'PROCESSOR' : 'FACTORY')
  const settlementPartyId = input.settlementPartyId ?? input.batch.returnFactoryId
  const decisionStage: LiabilityDecisionStage = isSewReturnInboundQc(input.qc, [input.batch])
    ? 'SEW_RETURN_INBOUND_FINAL'
    : 'GENERAL'
  const deductionDecision: DeductionDecision =
    input.qc.deductionDecision ?? (input.qc.disposition === 'ACCEPT' ? 'NO_DEDUCT' : 'DEDUCT')
  const deductionQty = deductionDecision === 'NO_DEDUCT' ? 0 : qty
  const deductionAmountSnapshot = deductionDecision === 'DEDUCT' ? input.qc.deductionAmount : 0
  const responsiblePartyTypeSnapshot = input.qc.responsiblePartyType ?? settlementPartyType
  const responsiblePartyIdSnapshot = input.qc.responsiblePartyId ?? settlementPartyId

  const existing = input.basisItems.find(
    (item) =>
      item.sourceBatchId === input.batch.batchId ||
      item.sourceRefId === input.qc.qcId ||
      item.sourceId === input.qc.qcId,
  )

  const summary =
    input.summary ??
    `回货入仓不合格：${input.batch.processLabel ?? input.batch.processType}，数量 ${qty}，批次 ${input.batch.batchId}`

  if (existing) {
    const updated: DeductionBasisItem = {
      ...existing,
      sourceType,
      sourceRefId: input.qc.qcId,
      sourceId: input.qc.qcId,
      productionOrderId: input.qc.productionOrderId,
      taskId,
      factoryId,
      settlementPartyType,
      settlementPartyId,
      rootCauseType: input.qc.rootCauseType,
      reasonCode: 'QUALITY_FAIL',
      qty,
      deductionQty,
      disposition: input.qc.disposition,
      summary,
      deepLinks: {
        qcHref: `/fcs/quality/qc-records/${input.qc.qcId}`,
        taskHref: taskId ? `/fcs/pda/task-receive/${taskId}` : undefined,
      },
      sourceProcessType: input.batch.processType,
      sourceOrderId: sourceBusinessType === 'DYE_PRINT_ORDER' ? sourceBusinessId : existing.sourceOrderId,
      sourceReturnId: input.batch.batchId,
      sourceBatchId: input.batch.batchId,
      sourceBusinessType,
      sourceBusinessId,
      qcPolicySnapshot: input.batch.qcPolicy,
      decisionStage,
      responsiblePartyTypeSnapshot,
      responsiblePartyIdSnapshot,
      responsiblePartyNameSnapshot: input.qc.responsiblePartyName ?? input.batch.returnFactoryName,
      dispositionSnapshot: input.qc.disposition,
      deductionDecisionSnapshot: deductionDecision,
      deductionAmountSnapshot,
      processorFactoryId: input.batch.returnFactoryId,
      settlementReady: input.qc.status === 'CLOSED',
      settlementFreezeReason: input.qc.status === 'CLOSED' ? undefined : '质检未结案',
      qcStatusSnapshot: input.qc.status,
      liabilityStatusSnapshot:
        input.qc.liabilityStatus === 'DRAFT' ? 'PENDING' : input.qc.liabilityStatus,
      deductionAmountEditable: input.qc.status === 'CLOSED',
      updatedAt: ts,
      updatedBy: input.by,
      auditLogs: [
        ...existing.auditLogs,
        {
          id: ensureUniqueId('DBIL-RIB-UPD', () => false),
          action: 'UPDATE_BASIS_FROM_RETURN_INBOUND_QC',
          detail: `回货入仓质检 ${input.qc.qcId} 更新扣款依据，qty=${qty}`,
          at: ts,
          by: input.by,
        },
      ],
    }
    const index = input.basisItems.findIndex((item) => item.basisId === existing.basisId)
    input.basisItems[index] = updated
    return updated
  }

  const basis: DeductionBasisItem = {
    basisId: ensureUniqueId('DBI-RIB', (id) => input.basisItems.some((item) => item.basisId === id)),
    sourceType,
    sourceRefId: input.qc.qcId,
    sourceId: input.qc.qcId,
    productionOrderId: input.qc.productionOrderId,
    taskId,
    factoryId,
    settlementPartyType,
    settlementPartyId,
    rootCauseType: input.qc.rootCauseType,
    reasonCode: 'QUALITY_FAIL',
    qty,
    deductionQty,
    uom: 'PIECE',
    disposition: input.qc.disposition,
    summary,
    evidenceRefs: [],
    status: (input.qc.liabilityStatus as DeductionBasisStatus) ?? 'DRAFT',
    deepLinks: {
      qcHref: `/fcs/quality/qc-records/${input.qc.qcId}`,
      taskHref: taskId ? `/fcs/pda/task-receive/${taskId}` : undefined,
    },
    sourceProcessType: input.batch.processType,
    sourceOrderId: sourceBusinessType === 'DYE_PRINT_ORDER' ? sourceBusinessId : undefined,
    sourceReturnId: input.batch.batchId,
    sourceBatchId: input.batch.batchId,
    sourceBusinessType,
    sourceBusinessId,
    qcPolicySnapshot: input.batch.qcPolicy,
    decisionStage,
    responsiblePartyTypeSnapshot,
    responsiblePartyIdSnapshot,
    responsiblePartyNameSnapshot: input.qc.responsiblePartyName ?? input.batch.returnFactoryName,
    dispositionSnapshot: input.qc.disposition,
    deductionDecisionSnapshot: deductionDecision,
    deductionAmountSnapshot,
    processorFactoryId: input.batch.returnFactoryId,
    settlementReady: false,
    settlementFreezeReason: '质检未结案',
    qcStatusSnapshot: input.qc.status,
    liabilityStatusSnapshot:
      input.qc.liabilityStatus === 'DRAFT' ? 'PENDING' : input.qc.liabilityStatus,
    deductionAmountEditable: false,
    createdAt: ts,
    createdBy: input.by,
    updatedAt: ts,
    updatedBy: input.by,
    auditLogs: [
      {
        id: ensureUniqueId('DBIL-RIB-CR', () => false),
        action: 'CREATE_BASIS_FROM_RETURN_INBOUND_QC',
        detail: `回货入仓质检 ${input.qc.qcId} 生成扣款依据，qty=${qty}`,
        at: ts,
        by: input.by,
      },
    ],
  }

  input.basisItems.push(basis)
  return basis
}

export function blockTaskForReturnInboundQc(input: BlockTaskForReturnInboundQcInput): void {
  const ts = input.now ?? nowTimestamp()
  if (input.task.status === 'BLOCKED' && input.task.blockReason === 'QUALITY') return

  input.task.status = 'BLOCKED'
  input.task.blockReason = 'QUALITY'
  input.task.blockRemark = input.remark ?? `质检 ${input.qcId} 不合格，待处理`
  input.task.blockedAt = ts
  input.task.updatedAt = ts
  input.task.auditLogs = [
    ...input.task.auditLogs,
    {
      id: ensureUniqueId('AL-BLOCK-RIB', () => false),
      action: 'BLOCK_BY_QC',
      detail: `质检 ${input.qcId} 不合格，任务生产暂停`,
      at: ts,
      by: input.by,
    },
  ]
}

export function applyReturnInboundPassWriteback(
  input: ApplyReturnInboundPassWritebackInput,
): { ok: true; taskId: string; snapshot: AllocationSnapshot; event: AllocationEvent } | { ok: false; message: string } {
  const taskId = input.batch.sourceTaskId
  if (!taskId) {
    return { ok: false, message: `批次 ${input.batch.batchId} 缺少 sourceTaskId，无法回写可用量` }
  }

  const ts = input.now ?? nowTimestamp()
  const oldSnapshot = input.allocationByTaskId[taskId] ?? {
    taskId,
    availableQty: 0,
    acceptedAsDefectQty: 0,
    scrappedQty: 0,
    updatedAt: ts,
    updatedBy: input.by,
  }

  const nextSnapshot: AllocationSnapshot = {
    ...oldSnapshot,
    availableQty: oldSnapshot.availableQty + input.batch.returnedQty,
    updatedAt: ts,
    updatedBy: input.by,
  }
  input.allocationByTaskId[taskId] = nextSnapshot

  const refType: AllocationEvent['refType'] =
    input.batch.sourceType === 'DYE_PRINT_ORDER' ? 'DYE_PRINT_ORDER' : 'RETURN_BATCH'

  const event: AllocationEvent = {
    eventId: ensureUniqueId('ALLOC-RIB-PASS', () => false),
    taskId,
    refType,
    refId: refType === 'DYE_PRINT_ORDER' ? input.batch.sourceId ?? input.batch.batchId : input.batch.batchId,
    deltaAvailableQty: input.batch.returnedQty,
    deltaAcceptedAsDefectQty: 0,
    deltaScrappedQty: 0,
    noteZh: `回货入仓批次 ${input.batch.batchId} 合格可继续：可用量+${input.batch.returnedQty}`,
    createdAt: ts,
    createdBy: input.by,
  }

  input.allocationEvents.push(event)
  return { ok: true, taskId, snapshot: nextSnapshot, event }
}
