import {
  generateCaseId,
  getProgressExceptionById,
  type CaseStatus,
  type ExceptionAction,
  type ExceptionAuditLog,
  type ExceptionCase,
  upsertProgressExceptionCase,
} from '../data/fcs/store-domain-progress'
import {
  applyClaimDisputeHandleResult,
  buildClaimDisputeRecord,
  buildPlatformClaimDisputeSummary,
  computeClaimDisputeQty,
  getClaimDisputeStatusLabel,
  parseLengthQtyFromText,
  validateClaimDisputeHandleInput,
  validateClaimDisputeInput,
} from '../helpers/fcs-claim-dispute'
import type {
  ClaimDisputeCreateInput,
  ClaimDisputeHandleInput,
  ClaimDisputeRecord,
  ClaimDisputeStatus,
} from '../models/fcs-claim-dispute'

export const FCS_CLAIM_DISPUTE_LEDGER_STORAGE_KEY = 'fcsClaimDisputeLedger'

let memoryLedger: ClaimDisputeRecord[] | null = null

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function toCaseStatus(status: ClaimDisputeStatus): CaseStatus {
  if (status === 'PENDING') return 'OPEN'
  if (status === 'VIEWED' || status === 'CONFIRMED') return 'IN_PROGRESS'
  if (status === 'REJECTED') return 'RESOLVED'
  return 'CLOSED'
}

function serialize(records: ClaimDisputeRecord[]): string {
  return JSON.stringify(records)
}

function deserialize(raw: string | null): ClaimDisputeRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ClaimDisputeRecord => Boolean(item && typeof item.disputeId === 'string'))
  } catch {
    return []
  }
}

function createAction(id: string, actionType: string, actionDetail: string, at: string, by: string): ExceptionAction {
  return { id, actionType, actionDetail, at, by }
}

function createAudit(id: string, action: string, detail: string, at: string, by: string): ExceptionAuditLog {
  return { id, action, detail, at, by }
}

function buildExceptionCase(record: ClaimDisputeRecord): ExceptionCase {
  const existing = record.platformCaseId ? getProgressExceptionById(record.platformCaseId) : undefined
  const createdAt = existing?.createdAt || record.submittedAt
  const actions = existing?.actions ?? [
    createAction(`ACT-${record.disputeId}-CREATE`, 'SUBMIT_DISPUTE', '移动端已提交裁片领料数量异议。', record.submittedAt, record.submittedBy),
  ]
  const auditLogs = existing?.auditLogs ?? [
    createAudit(`AUD-${record.disputeId}-CREATE`, 'CREATE', '移动端提交裁片领料数量异议', record.submittedAt, record.submittedBy),
  ]

  return {
    caseId: record.platformCaseId,
    caseStatus: toCaseStatus(record.status),
    severity: record.discrepancyQty < 0 ? 'S1' : Math.abs(record.discrepancyQty) >= 5 ? 'S2' : 'S3',
    category: 'MATERIAL',
    unifiedCategory: 'MATERIAL',
    subCategoryKey: 'MATERIAL_QTY_SHORT',
    reasonCode: 'MATERIAL_NOT_READY',
    reasonLabel: '裁片领料数量异议',
    sourceType: 'TASK',
    sourceId: record.relatedClaimRecordNo || record.sourceTaskNo || record.sourceTaskId,
    sourceSystem: 'RUNTIME_FLOW',
    sourceModule: 'CUTTING_CLAIM_DISPUTE',
    relatedOrderIds: record.productionOrderNos,
    relatedTaskIds: record.sourceTaskId ? [record.sourceTaskId] : [],
    relatedTenderIds: [],
    linkedProductionOrderNo: record.productionOrderNo,
    linkedTaskNo: record.sourceTaskNo,
    ownerUserId: existing?.ownerUserId || 'U004',
    ownerUserName: existing?.ownerUserName || '运营A',
    summary: buildPlatformClaimDisputeSummary(record),
    detail: [
      `原始裁片单：${record.originalCutOrderNo}`,
      `生产单：${record.productionOrderNo}`,
      `面料编码：${record.materialSku}`,
      `仓库配置数量：${record.configuredQty} 米`,
      `默认应领数量：${record.defaultClaimQty} 米`,
      `实际领取数量：${record.actualClaimQty} 米`,
      `差异数量：${record.discrepancyQty} 米`,
      `异议原因：${record.disputeReason}`,
      `异议说明：${record.disputeNote || '无'}`,
      `证据数量：${record.evidenceCount}`,
      `处理结论：${record.handleConclusion || '待平台处理'}`,
    ].join('\n'),
    createdAt,
    updatedAt: record.handledAt || record.submittedAt,
    resolvedAt: record.status === 'REJECTED' ? record.handledAt : undefined,
    resolvedBy: record.status === 'REJECTED' ? record.handledBy : undefined,
    resolvedDetail: record.status === 'REJECTED' ? record.handleNote : undefined,
    closedAt: record.status === 'COMPLETED' ? record.handledAt : undefined,
    closedBy: record.status === 'COMPLETED' ? record.handledBy : undefined,
    closeDetail: record.status === 'COMPLETED' ? record.handleNote : undefined,
    followUpRemark: record.handleNote || record.disputeNote,
    linkedFactoryName: '裁片工厂移动端',
    tags: Array.from(
      new Set([
        '裁片',
        '领料异议',
        record.materialSku,
        getClaimDisputeStatusLabel(record.status),
        record.writtenBackToCraft ? '已回写工艺端' : '待回写工艺端',
        record.writtenBackToPda ? '已回写移动端' : '待回写移动端',
      ]),
    ),
    actions,
    auditLogs,
  }
}

function syncExceptionCase(record: ClaimDisputeRecord): void {
  upsertProgressExceptionCase(buildExceptionCase(record))
}

function syncAllCases(records: ClaimDisputeRecord[]): void {
  records.forEach(syncExceptionCase)
}

function save(records: ClaimDisputeRecord[]): void {
  memoryLedger = records
  try {
    localStorage.setItem(FCS_CLAIM_DISPUTE_LEDGER_STORAGE_KEY, serialize(records))
  } catch {
    // ignore storage errors in prototype
  }
  syncAllCases(records)
}

function getSeedDisputes(): ClaimDisputeRecord[] {
  const seed: ClaimDisputeRecord = buildClaimDisputeRecord(
    {
      sourceTaskId: 'TASK-CUT-000095',
      sourceTaskNo: 'TASK-CUT-000095',
      originalCutOrderNo: 'CPO-20260319-I',
      productionOrderNo: 'PO-20260319-019',
      relatedClaimRecordNo: 'PK-CPO-20260319-I-002',
      materialSku: 'FAB-SKU-PRINT-021',
      materialCategory: '印花主料',
      materialAttr: '印花 / 红黑拼色',
      configuredQty: 612,
      actualClaimQty: 589,
      disputeReason: '现场实领少 1 卷',
      disputeNote: '少 1 卷印花面料，已上传现场照片待仓库复核。',
      submittedBy: '现场领料员',
      submittedAt: '2026-03-22 10:18:00',
      imageFiles: [
        { fileId: 'IMG-1', fileType: 'IMAGE', fileName: '领料口照片-01.jpg', uploadedAt: '2026-03-22 10:18:00' },
        { fileId: 'IMG-2', fileType: 'IMAGE', fileName: '卷码照片-02.jpg', uploadedAt: '2026-03-22 10:18:00' },
      ],
      videoFiles: [
        { fileId: 'VID-1', fileType: 'VIDEO', fileName: '现场复点视频-01.mp4', uploadedAt: '2026-03-22 10:18:00' },
      ],
    },
    'CD-202603-0001',
    'LYY-202603-0001',
    'EX-202603-9101',
  )
  return [seed]
}

function ensureLedger(): ClaimDisputeRecord[] {
  if (memoryLedger) return memoryLedger
  const stored = deserialize(typeof localStorage === 'undefined' ? null : localStorage.getItem(FCS_CLAIM_DISPUTE_LEDGER_STORAGE_KEY))
  const next = stored.length ? stored : getSeedDisputes()
  save(next)
  return next
}

export function listClaimDisputes(): ClaimDisputeRecord[] {
  return [...ensureLedger()].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

export function getClaimDisputeById(disputeId: string): ClaimDisputeRecord | null {
  return listClaimDisputes().find((item) => item.disputeId === disputeId) ?? null
}

export function getClaimDisputeByCaseId(caseId: string): ClaimDisputeRecord | null {
  return listClaimDisputes().find((item) => item.platformCaseId === caseId) ?? null
}

export function listClaimDisputesByOriginalCutOrderNo(originalCutOrderNo: string): ClaimDisputeRecord[] {
  return listClaimDisputes().filter((item) => item.originalCutOrderNos.includes(originalCutOrderNo) || item.originalCutOrderNo === originalCutOrderNo)
}

export function getLatestClaimDisputeByOriginalCutOrderNo(originalCutOrderNo: string): ClaimDisputeRecord | null {
  return listClaimDisputesByOriginalCutOrderNo(originalCutOrderNo)[0] ?? null
}

export function listClaimDisputesByTaskId(taskId: string): ClaimDisputeRecord[] {
  return listClaimDisputes().filter((item) => item.sourceTaskId === taskId)
}

export function getLatestClaimDisputeByTaskId(taskId: string): ClaimDisputeRecord | null {
  return listClaimDisputesByTaskId(taskId)[0] ?? null
}

export function createClaimDispute(input: ClaimDisputeCreateInput): { record: ClaimDisputeRecord | null; issues: string[] } {
  const issues = validateClaimDisputeInput(input)
  if (issues.length) return { record: null, issues }

  const records = ensureLedger()
  const disputeSequence = String(records.length + 1).padStart(4, '0')
  const disputeId = `CD-202603-${disputeSequence}`
  const disputeNo = `LYY-202603-${disputeSequence}`
  const platformCaseId = generateCaseId()
  const record = buildClaimDisputeRecord(input, disputeId, disputeNo, platformCaseId)
  save([record, ...records])
  return { record, issues: [] }
}

export function updateClaimDisputePlatformHandling(
  disputeId: string,
  input: ClaimDisputeHandleInput,
): { record: ClaimDisputeRecord | null; issues: string[] } {
  const issues = validateClaimDisputeHandleInput(input)
  if (issues.length) return { record: null, issues }

  const records = ensureLedger()
  const index = records.findIndex((item) => item.disputeId === disputeId)
  if (index < 0) return { record: null, issues: ['未找到对应异议记录'] }

  const current = records[index]
  const updated = applyClaimDisputeHandleResult(current, input)
  const existingCase = getProgressExceptionById(updated.platformCaseId)
  const nextActionId = `${updated.platformCaseId}-HANDLE-${Date.now()}`
  const nextAuditId = `${updated.platformCaseId}-AUDIT-${Date.now()}`
  const nextCase = buildExceptionCase(updated)
  nextCase.actions = [
    ...(existingCase?.actions ?? nextCase.actions),
    createAction(nextActionId, 'HANDLE_DISPUTE', `${getClaimDisputeStatusLabel(updated.status)}：${updated.handleConclusion}`, updated.handledAt, updated.handledBy),
  ]
  nextCase.auditLogs = [
    ...(existingCase?.auditLogs ?? nextCase.auditLogs),
    createAudit(nextAuditId, 'HANDLE', `${getClaimDisputeStatusLabel(updated.status)}｜${updated.handleNote}`, updated.handledAt, updated.handledBy),
  ]
  upsertProgressExceptionCase(nextCase)

  const nextRecords = [...records]
  nextRecords[index] = updated
  save(nextRecords)
  return { record: updated, issues: [] }
}

export function buildClaimDisputePrefillPayload(record: ClaimDisputeRecord): Record<string, string> {
  return {
    originalCutOrderNo: record.originalCutOrderNo,
    productionOrderNo: record.productionOrderNo,
    materialSku: record.materialSku,
    riskLevel: record.status === 'CONFIRMED' || record.status === 'PENDING' ? 'high' : 'medium',
    varianceLength: String(record.discrepancyQty),
    shortageHint: String(Math.max(record.defaultClaimQty - record.actualClaimQty, 0)),
    claimDisputeId: record.disputeId,
  }
}

export function buildClaimDisputeQtySummary(record: ClaimDisputeRecord): string {
  return `应领 ${record.defaultClaimQty} 米 / 实领 ${record.actualClaimQty} 米 / 差异 ${record.discrepancyQty} 米`
}

export function mapTextQtyToDisputeValue(text: string): number {
  return parseLengthQtyFromText(text)
}
