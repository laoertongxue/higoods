import type {
  PickupBoundObjectType,
  PickupEvidence,
  PickupEvidenceSummary,
  PickupMaterialType,
  PickupPrintVersion,
  PickupQrBinding,
  PickupReceiptStatus,
  PickupReceiptSummary,
  PickupScenarioDifferenceSummary,
  PickupScenarioType,
  PickupScanRecord,
  PickupScanResultStatus,
  PickupSlip,
  PickupSlipStatus,
} from './types'

export const pickupScenarioTypeLabels: Record<PickupScenarioType, string> = {
  COMMON: '通用领料',
  CUTTING: '裁片领料',
  PRINTING: '印花领料',
  DYEING: '染色领料',
}

export const pickupBoundObjectTypeLabels: Record<PickupBoundObjectType, string> = {
  TASK: '任务级绑定',
  CUT_PIECE_ORDER: '裁片单级绑定',
  PRINT_ORDER: '印花单级绑定',
  DYE_ORDER: '染色单级绑定',
  MATERIAL_LINE: '物料行级绑定',
}

export const pickupMaterialTypeLabels: Record<PickupMaterialType, string> = {
  GENERAL: '通用物料',
  PRINT: '印花面料',
  DYE: '染色面料',
  SOLID: '净色面料',
  LINING: '里布',
}

export const pickupSlipStatusLabels: Record<PickupSlipStatus, string> = {
  PENDING_PRINT: '待打印',
  READY_TO_PICKUP: '待扫码领取',
  PARTIAL_RECEIVED: '部分领取',
  RECEIVED: '领取完成',
  RECHECK_REQUIRED: '待复核',
}

export const pickupScanResultLabels: Record<PickupScanResultStatus | 'NOT_SCANNED', string> = {
  NOT_SCANNED: '未扫码回写',
  MATCHED: '扫码领取成功',
  RECHECK_REQUIRED: '驳回核对',
  PHOTO_SUBMITTED: '带照片提交',
  CANCELLED: '已取消',
}

export const pickupReceiptStatusLabels: Record<PickupReceiptStatus, string> = {
  NOT_SCANNED: '未回执',
  SCANNED_MATCHED: '已回执',
  SCANNED_RECHECK: '待复核',
  PHOTO_SUBMITTED: '已提交照片',
  CANCELLED: '已取消',
}

export function getLatestPickupScanRecord(records: PickupScanRecord[]): PickupScanRecord | null {
  if (!records.length) return null
  return [...records].sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))[0]
}

export function buildPickupEvidenceSummary(evidences: PickupEvidence[]): PickupEvidenceSummary {
  const photoCount = evidences
    .filter((item) => item.evidenceType === 'PHOTO')
    .reduce((sum, item) => sum + item.count, 0)
  const manualNoteCount = evidences
    .filter((item) => item.evidenceType === 'MANUAL_NOTE')
    .reduce((sum, item) => sum + item.count, 0)
  const receiptNoteCount = evidences
    .filter((item) => item.evidenceType === 'RECEIPT_NOTE')
    .reduce((sum, item) => sum + item.count, 0)
  const latest = [...evidences].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]

  return {
    totalCount: evidences.reduce((sum, item) => sum + item.count, 0),
    photoCount,
    manualNoteCount,
    receiptNoteCount,
    latestEvidenceSummary: latest ? `${latest.summary}（${latest.createdAt}）` : '当前无差异凭证',
  }
}

export function derivePickupReceiptStatus(resultStatus: PickupScanResultStatus | 'NOT_SCANNED'): PickupReceiptStatus {
  if (resultStatus === 'MATCHED') return 'SCANNED_MATCHED'
  if (resultStatus === 'RECHECK_REQUIRED') return 'SCANNED_RECHECK'
  if (resultStatus === 'PHOTO_SUBMITTED') return 'PHOTO_SUBMITTED'
  if (resultStatus === 'CANCELLED') return 'CANCELLED'
  return 'NOT_SCANNED'
}

export function buildPickupReceiptSummary(
  pickupSlipNo: string,
  scanRecords: PickupScanRecord[],
  evidences: PickupEvidence[],
): PickupReceiptSummary {
  const latest = getLatestPickupScanRecord(scanRecords)
  const latestResultStatus = latest?.resultStatus ?? 'NOT_SCANNED'
  const hasPhotoEvidence = evidences.some((item) => item.evidenceType === 'PHOTO' && item.count > 0)
  const needsRecheck = latestResultStatus === 'RECHECK_REQUIRED' || latestResultStatus === 'PHOTO_SUBMITTED'

  return {
    pickupSlipNo,
    latestResultStatus,
    latestResultLabel: pickupScanResultLabels[latestResultStatus],
    latestScannedAt: latest?.scannedAt ?? '-',
    latestScannedBy: latest?.scannedBy ?? '-',
    hasPhotoEvidence,
    needsRecheck,
    receiptStatus: derivePickupReceiptStatus(latestResultStatus),
  }
}

export function buildPickupResultSummary(receiptSummary: PickupReceiptSummary): string {
  const evidenceText = receiptSummary.hasPhotoEvidence ? '含照片凭证' : '无照片凭证'
  const recheckText = receiptSummary.needsRecheck ? '需复核' : '无需复核'
  return `${receiptSummary.latestResultLabel}，${evidenceText}，${recheckText}`
}

export function buildPickupPrintVersionSummary(printVersion: PickupPrintVersion): string {
  const latestText = printVersion.isLatestVersion ? '当前最新版本' : '历史版本'
  return `${printVersion.printVersionNo} · ${printVersion.printedAt} · 打印 ${printVersion.printCopyCount} 份 · ${latestText}`
}

export function buildPickupQrBindingSummary(binding: PickupQrBinding): string {
  return `${pickupScenarioTypeLabels[binding.scenarioType]} / ${pickupBoundObjectTypeLabels[binding.boundObjectType]} / ${binding.qrCodeValue}`
}

export function hasPickupDiscrepancy(input: PickupSlip | PickupReceiptSummary | PickupScanRecord): boolean {
  if ('hasDiscrepancy' in input) return input.hasDiscrepancy
  if ('needsRecheck' in input) return input.needsRecheck
  return input.resultStatus === 'RECHECK_REQUIRED' || input.resultStatus === 'PHOTO_SUBMITTED'
}

export function needsPickupRecheck(input: PickupSlip | PickupReceiptSummary): boolean {
  if ('needsRecheck' in input) return input.needsRecheck
  return input.latestScanResult === 'RECHECK_REQUIRED' || input.latestScanResult === 'PHOTO_SUBMITTED'
}

export function buildPickupScenarioDifferenceSummary(input: Omit<PickupScenarioDifferenceSummary, 'summaryText'>): PickupScenarioDifferenceSummary {
  return {
    ...input,
    summaryText: `${pickupScenarioTypeLabels[input.scenarioType]}以${pickupBoundObjectTypeLabels[input.boundObjectType]}为主对象，二维码语义为“${input.qrMeaning}”，差异处理为“${input.discrepancySupport}”，后续动作为“${input.followUpActions}”。`,
  }
}
