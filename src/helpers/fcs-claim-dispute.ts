import type {
  ClaimDisputeCreateInput,
  ClaimDisputeEvidenceFile,
  ClaimDisputeHandleInput,
  ClaimDisputeRecord,
  ClaimDisputeStatus,
} from '../models/fcs-claim-dispute'

const statusMeta: Record<ClaimDisputeStatus, { label: string; className: string }> = {
  PENDING: { label: '待处理', className: 'bg-amber-100 text-amber-700' },
  VIEWED: { label: '已查看', className: 'bg-blue-100 text-blue-700' },
  CONFIRMED: { label: '已确认差异', className: 'bg-orange-100 text-orange-700' },
  REJECTED: { label: '已驳回异议', className: 'bg-rose-100 text-rose-700' },
  COMPLETED: { label: '已处理完成', className: 'bg-emerald-100 text-emerald-700' },
}

export function computeClaimDisputeQty(actualClaimQty: number, defaultClaimQty: number): number {
  return Number((actualClaimQty - defaultClaimQty).toFixed(2))
}

export function canInitiateClaimDispute(actualClaimQty: number, defaultClaimQty: number): boolean {
  return Number.isFinite(actualClaimQty) && Number.isFinite(defaultClaimQty) && actualClaimQty !== defaultClaimQty
}

export function hasRequiredClaimDisputeEvidence(
  imageFiles: ClaimDisputeEvidenceFile[] = [],
  videoFiles: ClaimDisputeEvidenceFile[] = [],
): boolean {
  return imageFiles.length + videoFiles.length > 0
}

export function getClaimDisputeStatusMeta(status: ClaimDisputeStatus): { label: string; className: string } {
  return statusMeta[status]
}

export function getClaimDisputeStatusLabel(status: ClaimDisputeStatus): string {
  return getClaimDisputeStatusMeta(status).label
}

export function buildPdaClaimDisputeSummary(record: ClaimDisputeRecord): string {
  return `${getClaimDisputeStatusLabel(record.status)} · 差异 ${formatClaimQty(record.discrepancyQty)} · 证据 ${record.evidenceCount} 个`
}

export function buildCraftClaimDisputeSummary(record: ClaimDisputeRecord): string {
  return `${getClaimDisputeStatusLabel(record.status)} · 实领 ${formatClaimQty(record.actualClaimQty)} / 应领 ${formatClaimQty(record.defaultClaimQty)}`
}

export function buildPlatformClaimDisputeSummary(record: ClaimDisputeRecord): string {
  return `裁片领料长度异议｜${record.originalCutOrderNo}｜${record.materialSku}｜差异 ${formatClaimQty(record.discrepancyQty)}`
}

export function buildClaimDisputeWritebackSummary(record: ClaimDisputeRecord): string {
  return `${getClaimDisputeStatusLabel(record.status)} · ${record.handleConclusion || '待平台处理'}`
}

export function parseLengthQtyFromText(text: string): number {
  const lengthMatched = text.match(/长度\\s*([0-9]+(?:\\.[0-9]+)?)\\s*米/)
  if (lengthMatched) return Number(lengthMatched[1]) || 0
  const fallback = text.match(/([0-9]+(?:\\.[0-9]+)?)\\s*米/)
  return fallback ? Number(fallback[1]) || 0 : 0
}

export function parseRollCountFromText(text: string): number {
  const matched = text.match(/卷数\\s*([0-9]+(?:\\.[0-9]+)?)\\s*卷/)
  return matched ? Number(matched[1]) || 0 : 0
}

export function buildClaimDisputeEvidenceFiles(
  names: string[],
  fileType: 'IMAGE' | 'VIDEO',
  now: string,
): ClaimDisputeEvidenceFile[] {
  return names.map((fileName, index) => ({
    fileId: `${fileType}-${sanitizeId(fileName)}-${index + 1}`,
    fileType,
    fileName,
    uploadedAt: now,
  }))
}

export function validateClaimDisputeInput(input: ClaimDisputeCreateInput): string[] {
  const issues: string[] = []
  if (!input.sourceTaskId.trim()) issues.push('缺少来源任务')
  if (!input.originalCutOrderNo.trim()) issues.push('缺少原始裁片单号')
  if (!input.productionOrderNo.trim()) issues.push('缺少生产单号')
  if (!Number.isFinite(input.actualClaimQty)) issues.push('请填写实际领取长度')
  const defaultQty = input.defaultClaimQty ?? input.configuredQty
  if (!Number.isFinite(defaultQty)) issues.push('缺少默认应领长度')
  if (!input.disputeReason.trim()) issues.push('请填写异议原因')
  if (!hasRequiredClaimDisputeEvidence(input.imageFiles, input.videoFiles)) issues.push('请至少上传一张图片或一个视频')
  if (!canInitiateClaimDispute(input.actualClaimQty, defaultQty)) issues.push('实际领取长度与默认应领长度一致，无需发起异议')
  return issues
}

export function validateClaimDisputeHandleInput(input: ClaimDisputeHandleInput): string[] {
  const issues: string[] = []
  if (!input.handleNote.trim()) issues.push('请填写处理说明')
  if (!input.handleConclusion.trim()) issues.push('请填写处理结论')
  return issues
}

export function buildClaimDisputeRecord(
  input: ClaimDisputeCreateInput,
  disputeId: string,
  disputeNo: string,
  platformCaseId: string,
): ClaimDisputeRecord {
  const defaultClaimQty = input.defaultClaimQty ?? input.configuredQty
  const imageFiles = input.imageFiles ?? []
  const videoFiles = input.videoFiles ?? []
  return {
    disputeId,
    disputeNo,
    sourceTaskType: 'CUTTING',
    isCutPieceTask: true,
    sourceTaskId: input.sourceTaskId,
    sourceTaskNo: input.sourceTaskNo,
    originalCutOrderNo: input.originalCutOrderNo,
    originalCutOrderNos: input.originalCutOrderNos?.length ? input.originalCutOrderNos : [input.originalCutOrderNo],
    productionOrderNo: input.productionOrderNo,
    productionOrderNos: input.productionOrderNos?.length ? input.productionOrderNos : [input.productionOrderNo],
    relatedClaimRecordNo: input.relatedClaimRecordNo,
    materialSku: input.materialSku,
    materialCategory: input.materialCategory ?? '主面料',
    materialAttr: input.materialAttr ?? '待补录',
    configuredQty: input.configuredQty,
    defaultClaimQty,
    actualClaimQty: input.actualClaimQty,
    discrepancyQty: computeClaimDisputeQty(input.actualClaimQty, defaultClaimQty),
    disputeReason: input.disputeReason,
    disputeNote: input.disputeNote,
    submittedBy: input.submittedBy,
    submittedAt: input.submittedAt,
    submittedSource: 'PDA',
    imageFiles,
    videoFiles,
    evidenceCount: imageFiles.length + videoFiles.length,
    hasEvidence: hasRequiredClaimDisputeEvidence(imageFiles, videoFiles),
    status: 'PENDING',
    processingStatus: 'PENDING',
    handledBy: '',
    handledAt: '',
    handleNote: '',
    handleConclusion: '',
    writtenBackToCraft: false,
    writtenBackToPda: false,
    platformCaseId,
    generatedAt: input.submittedAt,
    note: input.note ?? '',
  }
}

export function applyClaimDisputeHandleResult(
  record: ClaimDisputeRecord,
  input: ClaimDisputeHandleInput,
): ClaimDisputeRecord {
  return {
    ...record,
    status: input.status,
    processingStatus: input.status,
    handledBy: input.handledBy,
    handledAt: input.handledAt,
    handleNote: input.handleNote,
    handleConclusion: input.handleConclusion,
    writtenBackToCraft: true,
    writtenBackToPda: true,
  }
}

export function formatClaimQty(value: number): string {
  return `${Number.isFinite(value) ? value : 0} 米`
}

export function getClaimDisputeEvidenceHint(): string {
  return '请至少上传图片或视频其一，未上传证据不可提交异议。'
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .replace(/\\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_./]/g, '-')
}
