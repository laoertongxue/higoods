import {
  findPdaPickupHead,
  findPdaPickupRecord,
  getPdaPickupRecordsByHead,
  listPdaHandoverHeads,
  processPdaPickupQtyObjection,
  reportPdaPickupQtyObjection,
  resolvePdaPickupQtyObjection,
  type HandoverProofFile,
  type PdaHandoverHead,
  type PdaPickupRecord,
} from '../data/fcs/pda-handover-events.ts'
import {
  appendCaseAction,
  appendCaseAuditLog,
  appendCaseStatusChangeAudit,
  markCaseResolved,
} from '../data/fcs/progress-exception-lifecycle.ts'
import {
  generateCaseId,
  getProgressExceptionById,
  type ExceptionCase,
  type CaseStatus,
  upsertProgressExceptionCase,
} from '../data/fcs/store-domain-progress.ts'

export interface PdaPickupDisputeFact {
  caseId: string
  head: PdaHandoverHead
  record: PdaPickupRecord
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function toCaseStatus(record: PdaPickupRecord): CaseStatus {
  if (record.status === 'OBJECTION_PROCESSING') return 'IN_PROGRESS'
  if (record.status === 'OBJECTION_RESOLVED') return 'RESOLVED'
  return 'OPEN'
}

function buildPickupDisputeSummary(head: PdaHandoverHead, record: PdaPickupRecord): string {
  return `${head.processName}领料记录 ${record.recordId} 存在数量差异`
}

function buildPickupDisputeDetail(head: PdaHandoverHead, record: PdaPickupRecord): string {
  return [
    `领料单：${head.handoverId}`,
    `领料记录：${record.recordId}`,
    `生产单：${head.productionOrderNo}`,
    `任务号：${head.taskNo}`,
    `工序：${head.processName}`,
    `物料说明：${record.materialSummary}`,
    `本次应领：${record.qtyExpected} ${record.qtyUnit}`,
    `仓库交付数量：${typeof record.warehouseHandedQty === 'number' ? `${record.warehouseHandedQty} ${record.qtyUnit}` : '待仓库扫码交付'}`,
    `工厂异议数量：${typeof record.factoryReportedQty === 'number' ? `${record.factoryReportedQty} ${record.qtyUnit}` : '待填写'}`,
    `最终确认数量：${typeof record.finalResolvedQty === 'number' ? `${record.finalResolvedQty} ${record.qtyUnit}` : '待平台裁定'}`,
    `差异原因：${record.objectionReason || '待填写'}`,
    `差异说明：${record.objectionRemark || '无'}`,
    `平台处理说明：${record.resolvedRemark || record.followUpRemark || '待处理'}`,
  ].join('\n')
}

function buildSeedCase(head: PdaHandoverHead, record: PdaPickupRecord, caseId: string, existing?: ExceptionCase): ExceptionCase {
  const createdAt = existing?.createdAt || record.warehouseHandedAt || record.submittedAt
  return {
    caseId,
    caseStatus: toCaseStatus(record),
    severity:
      Math.abs((record.warehouseHandedQty ?? record.qtyExpected) - (record.factoryReportedQty ?? record.finalResolvedQty ?? record.qtyExpected)) >= 5
        ? 'S2'
        : 'S3',
    category: 'MATERIAL',
    unifiedCategory: 'MATERIAL',
    subCategoryKey: 'MATERIAL_PICKUP_QTY_DIFF',
    reasonCode: 'MATERIAL_NOT_READY',
    reasonLabel: '领料数量差异',
    sourceType: 'TASK',
    sourceId: record.recordId,
    sourceSystem: 'PDA',
    sourceModule: 'PDA_PICKUP_DISPUTE',
    relatedOrderIds: [head.productionOrderNo],
    relatedTaskIds: [head.taskId],
    relatedTenderIds: [],
    linkedProductionOrderNo: head.productionOrderNo,
    linkedTaskNo: head.taskNo,
    ownerUserId: existing?.ownerUserId || 'U004',
    ownerUserName: existing?.ownerUserName || '运营A',
    summary: buildPickupDisputeSummary(head, record),
    detail: buildPickupDisputeDetail(head, record),
    createdAt,
    updatedAt: record.finalResolvedAt || record.factoryConfirmedAt || record.warehouseHandedAt || record.submittedAt,
    resolvedAt: record.status === 'OBJECTION_RESOLVED' ? record.finalResolvedAt : existing?.resolvedAt,
    resolvedBy: record.status === 'OBJECTION_RESOLVED' ? '平台运营' : existing?.resolvedBy,
    resolvedRuleCode: record.status === 'OBJECTION_RESOLVED' ? 'MATERIAL_SATISFIED' : existing?.resolvedRuleCode,
    resolvedSource: record.status === 'OBJECTION_RESOLVED' ? 'USER' : existing?.resolvedSource,
    resolvedDetail: record.status === 'OBJECTION_RESOLVED' ? `平台最终确认数量 ${record.finalResolvedQty} ${record.qtyUnit}` : existing?.resolvedDetail,
    linkedFactoryName: head.targetName,
    followUpRemark: record.followUpRemark || record.objectionRemark,
    tags: Array.from(
      new Set([
        '通用交接',
        '待领料',
        '领料数量差异',
        head.processName,
        record.status === 'OBJECTION_RESOLVED' ? '平台已裁定' : '待平台处理',
      ]),
    ),
    actions:
      existing?.actions ??
      [
        {
          id: `EA-${caseId}-001`,
          actionType: 'SUBMIT_PICKUP_DISPUTE',
          actionDetail: `工厂对领料记录 ${record.recordId} 发起数量差异`,
          at: record.warehouseHandedAt || record.submittedAt,
          by: head.targetName,
        },
      ],
    auditLogs:
      existing?.auditLogs ??
      [
        {
          id: `EAL-${caseId}-001`,
          action: 'CREATE',
          detail: `PDA 待领料记录 ${record.recordId} 发起数量差异`,
          at: record.warehouseHandedAt || record.submittedAt,
          by: head.targetName,
        },
      ],
  }
}

export function ensurePdaPickupDisputeSeedCases(): void {
  const heads = listPdaHandoverHeads().filter((head) => head.headType === 'PICKUP')
  heads.forEach((head) => {
    const records = getPdaPickupRecordsByHead(head.handoverId)
    records.forEach((record) => {
      if (!record.exceptionCaseId) return
      if (
        record.status !== 'OBJECTION_REPORTED' &&
        record.status !== 'OBJECTION_PROCESSING' &&
        record.status !== 'OBJECTION_RESOLVED'
      ) {
        return
      }
      upsertProgressExceptionCase(
        buildSeedCase(head, record, record.exceptionCaseId, getProgressExceptionById(record.exceptionCaseId)),
      )
    })
  })
}

export function getPdaPickupDisputeByCaseId(caseId: string): PdaPickupDisputeFact | null {
  ensurePdaPickupDisputeSeedCases()
  const heads = listPdaHandoverHeads().filter((head) => head.headType === 'PICKUP')
  for (const head of heads) {
    const record = getPdaPickupRecordsByHead(head.handoverId).find((item) => item.exceptionCaseId === caseId)
    if (record) {
      return { caseId, head, record }
    }
  }
  return null
}

export function createPdaPickupDisputeCase(
  recordId: string,
  payload: {
    factoryReportedQty: number
    objectionReason: string
    objectionRemark?: string
    objectionProofFiles: HandoverProofFile[]
  },
): { record: PdaPickupRecord | null; exceptionCase: ExceptionCase | null; issues: string[] } {
  const record = findPdaPickupRecord(recordId)
  if (!record) {
    return { record: null, exceptionCase: null, issues: ['未找到领料记录'] }
  }
  if (record.status !== 'PENDING_FACTORY_CONFIRM') {
    return { record: null, exceptionCase: null, issues: ['当前记录暂不可发起数量差异'] }
  }

  const head = findPdaPickupHead(record.handoverId)
  if (!head) {
    return { record: null, exceptionCase: null, issues: ['未找到对应领料单'] }
  }

  const caseId = generateCaseId()
  const updatedRecord = reportPdaPickupQtyObjection(recordId, {
    ...payload,
    exceptionCaseId: caseId,
  })
  if (!updatedRecord) {
    return { record: null, exceptionCase: null, issues: ['数量差异提交失败'] }
  }

  const exceptionCase = buildSeedCase(head, updatedRecord, caseId)
  upsertProgressExceptionCase(exceptionCase)
  return { record: updatedRecord, exceptionCase, issues: [] }
}

export function updatePdaPickupDisputePlatformHandling(
  caseId: string,
  payload: {
    status: 'PROCESSING' | 'RESOLVED'
    handledBy: string
    handledAt: string
    finalResolvedQty?: number
    handleNote?: string
  },
): { record: PdaPickupRecord | null; exceptionCase: ExceptionCase | null; issues: string[] } {
  const fact = getPdaPickupDisputeByCaseId(caseId)
  if (!fact) {
    return { record: null, exceptionCase: null, issues: ['未找到对应领料数量差异'] }
  }

  const existingCase = getProgressExceptionById(caseId)
  if (!existingCase) {
    return { record: null, exceptionCase: null, issues: ['未找到对应异常单'] }
  }

  if (payload.status === 'PROCESSING') {
    const processedRecord = processPdaPickupQtyObjection(fact.record.recordId, {
      followUpRemark: payload.handleNote,
      processedAt: payload.handledAt,
    })
    if (!processedRecord) {
      return { record: null, exceptionCase: null, issues: ['当前记录暂不可转入处理中'] }
    }

    let updatedCase: ExceptionCase = {
      ...existingCase,
      caseStatus: 'IN_PROGRESS',
      updatedAt: payload.handledAt,
      followUpRemark: payload.handleNote?.trim() || existingCase.followUpRemark,
      detail: buildPickupDisputeDetail(fact.head, processedRecord),
    }
    updatedCase = appendCaseAction(updatedCase, {
      actionType: 'PICKUP_DISPUTE_PROCESSING',
      actionDetail: payload.handleNote?.trim() || '平台已接手处理领料数量差异',
      at: payload.handledAt,
      by: payload.handledBy,
    })
    updatedCase = appendCaseAuditLog(updatedCase, {
      action: 'PICKUP_DISPUTE_PROCESSING',
      detail: payload.handleNote?.trim() || '平台已接手处理领料数量差异',
      at: payload.handledAt,
      by: payload.handledBy,
    })
    updatedCase = appendCaseStatusChangeAudit(updatedCase, existingCase.caseStatus, 'IN_PROGRESS', payload.handledAt, payload.handledBy)
    upsertProgressExceptionCase(updatedCase)
    return { record: processedRecord, exceptionCase: updatedCase, issues: [] }
  }

  if (!Number.isFinite(payload.finalResolvedQty) || (payload.finalResolvedQty ?? 0) < 0) {
    return { record: null, exceptionCase: null, issues: ['请填写最终确认数量'] }
  }

  const resolvedRecord = resolvePdaPickupQtyObjection(fact.record.recordId, {
    finalResolvedQty: payload.finalResolvedQty ?? 0,
    finalResolvedAt: payload.handledAt,
    resolvedRemark: payload.handleNote,
  })
  if (!resolvedRecord) {
    return { record: null, exceptionCase: null, issues: ['当前记录暂不可裁定最终数量'] }
  }

  const resolvedCase = markCaseResolved(
    {
      ...existingCase,
      updatedAt: payload.handledAt,
      detail: buildPickupDisputeDetail(fact.head, resolvedRecord),
      followUpRemark: payload.handleNote?.trim() || existingCase.followUpRemark,
    },
    {
      by: payload.handledBy,
      source: 'USER',
      ruleCode: 'MATERIAL_SATISFIED',
      detail: payload.handleNote?.trim() || `平台最终确认数量 ${resolvedRecord.finalResolvedQty} ${resolvedRecord.qtyUnit}`,
      at: payload.handledAt,
      actionType: 'RESOLVE_PICKUP_DISPUTE',
      auditAction: 'RESOLVE_PICKUP_DISPUTE',
    },
  )
  upsertProgressExceptionCase(resolvedCase)
  return { record: resolvedRecord, exceptionCase: resolvedCase, issues: [] }
}
