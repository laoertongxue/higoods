import type { CuttingOrderProgressRecord, CuttingMaterialLine } from '../../data/fcs/cutting/types'
import type { PdaPickupWritebackRecord } from '../../data/fcs/cutting/pda-execution-writeback-ledger.ts'
import type { OriginalCutOrderRef } from '../cutting-core/index.ts'
import type { CuttingDomainSnapshot } from '../fcs-cutting-runtime/index.ts'

export type PlatformPickupResultStatus = 'MATCHED' | 'RECHECK_REQUIRED' | 'PHOTO_SUBMITTED' | 'NOT_SCANNED'
export type PlatformPickupReceiptStatus = 'NOT_SCANNED' | 'SCANNED_MATCHED' | 'SCANNED_RECHECK' | 'PHOTO_SUBMITTED'

export interface PlatformCuttingPickupAggregate {
  printedSlipCount: number
  qrGeneratedCount: number
  receiveSuccessCount: number
  recheckRequiredCount: number
  photoSubmittedCount: number
  latestReceiveAt: string
  latestReceiveBy: string
  materialReceiveSummaryText: string
  resultSummaryText: string
}

export interface PlatformCuttingPickupSummary {
  pickupSlipNo: string
  latestPrintVersionNo: string
  printCopyCount: number
  printSlipStatusLabel: string
  qrCodeValue: string
  qrStatus: '已生成二维码' | '未生成二维码'
  latestResultStatus: PlatformPickupResultStatus
  latestResultLabel: string
  latestScannedBy: string
  needsRecheck: boolean
  hasPhotoEvidence: boolean
  photoProofCount: number
  receiptStatus: PlatformPickupReceiptStatus
  receiptStatusLabel: string
  latestScannedAt: string
  printVersionSummaryText: string
  qrBindingSummaryText: string
  resultSummaryText: string
  evidenceSummaryText: string
  summaryText: string
}

export interface PlatformCuttingPrepProjection {
  aggregate: PlatformCuttingPickupAggregate
  summary: PlatformCuttingPickupSummary
}

interface PrepGroupProjection {
  originalCutOrderId: string
  originalCutOrderNo: string
  materialSkus: string[]
  lines: CuttingMaterialLine[]
  latestWriteback: PdaPickupWritebackRecord | null
  latestResultStatus: PlatformPickupResultStatus
  latestResultLabel: string
  latestScannedAt: string
  latestScannedBy: string
  hasPhotoEvidence: boolean
  photoProofCount: number
  needsRecheck: boolean
  receiptStatus: PlatformPickupReceiptStatus
  receiptStatusLabel: string
  printCopyCount: number
  printed: boolean
  qrGenerated: boolean
  printSlipStatusLabel: string
  pickupSlipNo: string
  latestPrintVersionNo: string
  qrCodeValue: string
  qrBindingSummaryText: string
  resultSummaryText: string
  evidenceSummaryText: string
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeDateTime(value?: string): string {
  return value && value.trim().length > 0 ? value : ''
}

function compareDateTime(left: string, right: string): number {
  return normalizeDateTime(left).localeCompare(normalizeDateTime(right), 'zh-CN')
}

function toResultLabel(status: PlatformPickupResultStatus): string {
  if (status === 'MATCHED') return '扫码领取成功'
  if (status === 'RECHECK_REQUIRED') return '领料差异待复核'
  if (status === 'PHOTO_SUBMITTED') return '已提交照片凭证'
  return '未扫码回写'
}

function toReceiptStatus(status: PlatformPickupResultStatus): PlatformPickupReceiptStatus {
  if (status === 'MATCHED') return 'SCANNED_MATCHED'
  if (status === 'RECHECK_REQUIRED') return 'SCANNED_RECHECK'
  if (status === 'PHOTO_SUBMITTED') return 'PHOTO_SUBMITTED'
  return 'NOT_SCANNED'
}

function toReceiptStatusLabel(status: PlatformPickupReceiptStatus): string {
  if (status === 'SCANNED_MATCHED') return '已回执'
  if (status === 'SCANNED_RECHECK') return '待复核'
  if (status === 'PHOTO_SUBMITTED') return '已提交凭证'
  return '未回执'
}

function deriveStatusFromWriteback(record: PdaPickupWritebackRecord): PlatformPickupResultStatus {
  const resultLabel = record.resultLabel || ''
  if (/成功|正常|匹配|一致/.test(resultLabel)) return 'MATCHED'
  if ((record.photoProofCount || 0) > 0) return 'PHOTO_SUBMITTED'
  return 'RECHECK_REQUIRED'
}

function deriveStatusFromLines(lines: CuttingMaterialLine[]): PlatformPickupResultStatus {
  if (!lines.length) return 'NOT_SCANNED'
  if (lines.some((line) => line.issueFlags.includes('RECEIVE_DIFF'))) return 'RECHECK_REQUIRED'
  if (lines.every((line) => line.receiveStatus === 'RECEIVED')) return 'MATCHED'
  if (lines.some((line) => line.receiveStatus === 'PARTIAL')) return 'RECHECK_REQUIRED'
  if (lines.some((line) => line.receiveStatus === 'RECEIVED')) return 'MATCHED'
  return 'NOT_SCANNED'
}

function buildPickupSlipNo(originalCutOrderNo: string, productionOrderNo: string): string {
  const base = originalCutOrderNo || productionOrderNo || 'UNKNOWN'
  return `LL-${base}`
}

function buildPrintVersionNo(pickupSlipNo: string, printCopyCount: number): string {
  if (printCopyCount <= 0) return '-'
  return `${pickupSlipNo}-V${String(printCopyCount).padStart(2, '0')}`
}

function buildQrCodeValue(originalCutOrderId: string, originalCutOrderNo: string): string {
  const key = originalCutOrderId || originalCutOrderNo || '-'
  return key === '-' ? '-' : `ORIGINAL_CUT_ORDER:${key}`
}

function buildResultSummaryText(group: PrepGroupProjection): string {
  const parts = [
    `最近领料结果：${group.latestResultLabel}`,
    `回执状态：${group.receiptStatusLabel}`,
  ]
  if (group.latestScannedAt !== '-') {
    parts.push(`最近确认 ${group.latestScannedAt} · ${group.latestScannedBy}`)
  }
  if (group.needsRecheck) {
    parts.push('当前存在领料差异，需复核配置和领取结果')
  }
  if (group.hasPhotoEvidence) {
    parts.push(`已提交 ${group.photoProofCount} 张照片凭证`)
  }
  return parts.join('；')
}

function buildEvidenceSummaryText(group: PrepGroupProjection): string {
  if (!group.hasPhotoEvidence) return '当前无照片凭证'
  return `当前已提交 ${group.photoProofCount} 张照片凭证`
}

function groupLinesByOriginalCutOrder(
  record: CuttingOrderProgressRecord,
  originalCutOrderRefs: OriginalCutOrderRef[],
): Array<{ originalCutOrderId: string; originalCutOrderNo: string; lines: CuttingMaterialLine[] }> {
  const groups = originalCutOrderRefs.map((ref) => ({
    originalCutOrderId: ref.originalCutOrderId,
    originalCutOrderNo: ref.originalCutOrderNo,
    lines: record.materialLines.filter(
      (line) =>
        (line.originalCutOrderId && line.originalCutOrderId === ref.originalCutOrderId)
        || (line.originalCutOrderNo && line.originalCutOrderNo === ref.originalCutOrderNo),
    ),
  }))

  if (groups.length > 0) return groups

  return [
    {
      originalCutOrderId: '',
      originalCutOrderNo: '',
      lines: record.materialLines.slice(),
    },
  ]
}

function buildGroupProjection(options: {
  record: CuttingOrderProgressRecord
  originalCutOrderId: string
  originalCutOrderNo: string
  lines: CuttingMaterialLine[]
  writebacks: PdaPickupWritebackRecord[]
}): PrepGroupProjection {
  const sortedWritebacks = options.writebacks
    .slice()
    .sort((left, right) => compareDateTime(right.submittedAt, left.submittedAt))
  const latestWriteback = sortedWritebacks[0] || null
  const latestResultStatus = latestWriteback
    ? deriveStatusFromWriteback(latestWriteback)
    : deriveStatusFromLines(options.lines)
  const latestResultLabel = latestWriteback?.resultLabel || toResultLabel(latestResultStatus)
  const receiptStatus = toReceiptStatus(latestResultStatus)
  const receiptStatusLabel = toReceiptStatusLabel(receiptStatus)
  const printed = options.lines.some((line) => line.printSlipStatus === 'PRINTED')
  const qrGenerated = options.lines.some((line) => line.qrStatus === 'GENERATED')
  const printCopyCount = printed ? Math.max(options.lines.filter((line) => line.printSlipStatus === 'PRINTED').length, 1) : 0
  const pickupSlipNo = buildPickupSlipNo(options.originalCutOrderNo, options.record.productionOrderNo)
  const latestPrintVersionNo = buildPrintVersionNo(pickupSlipNo, printCopyCount)
  const qrCodeValue = qrGenerated ? buildQrCodeValue(options.originalCutOrderId, options.originalCutOrderNo) : '-'
  const materialSkus = unique(options.lines.map((line) => line.materialSku))
  const hasPhotoEvidence = sortedWritebacks.some((item) => item.photoProofCount > 0)
  const photoProofCount = sortedWritebacks.reduce((sum, item) => sum + Number(item.photoProofCount || 0), 0)
  const needsRecheck = latestResultStatus === 'RECHECK_REQUIRED' || options.lines.some((line) => line.issueFlags.includes('RECEIVE_DIFF'))
  const latestScannedAt = latestWriteback?.submittedAt || options.record.lastPickupScanAt || '-'
  const latestScannedBy = latestWriteback?.operatorName || options.record.lastOperatorName || '-'
  const printSlipStatusLabel = printed ? '已打印' : '未打印'
  const qrBindingSummaryText = qrGenerated
    ? `主码已按原始裁片单生成，覆盖 ${materialSkus.length || options.lines.length || 1} 个面料项`
    : '当前尚未生成主码'

  const group: PrepGroupProjection = {
    originalCutOrderId: options.originalCutOrderId,
    originalCutOrderNo: options.originalCutOrderNo,
    materialSkus,
    lines: options.lines,
    latestWriteback,
    latestResultStatus,
    latestResultLabel,
    latestScannedAt,
    latestScannedBy,
    hasPhotoEvidence,
    photoProofCount,
    needsRecheck,
    receiptStatus,
    receiptStatusLabel,
    printCopyCount,
    printed,
    qrGenerated,
    printSlipStatusLabel,
    pickupSlipNo,
    latestPrintVersionNo,
    qrCodeValue,
    qrBindingSummaryText,
    resultSummaryText: '',
    evidenceSummaryText: '',
  }

  group.resultSummaryText = buildResultSummaryText(group)
  group.evidenceSummaryText = buildEvidenceSummaryText(group)

  return group
}

function buildAggregate(groups: PrepGroupProjection[], record: CuttingOrderProgressRecord): PlatformCuttingPickupAggregate {
  const latestGroup = groups
    .filter((group) => group.latestScannedAt !== '-')
    .sort((left, right) => compareDateTime(right.latestScannedAt, left.latestScannedAt))[0] || null
  const totalCount = Math.max(groups.length, 1)
  const configuredCount = groups.filter((group) => group.lines.every((line) => line.configStatus === 'CONFIGURED')).length
  const receiveSuccessCount = groups.filter((group) => group.latestResultStatus === 'MATCHED').length
  const recheckRequiredCount = groups.filter((group) => group.needsRecheck).length
  const photoSubmittedCount = groups.filter((group) => group.hasPhotoEvidence).length

  return {
    printedSlipCount: groups.filter((group) => group.printed).length,
    qrGeneratedCount: groups.filter((group) => group.qrGenerated).length,
    receiveSuccessCount,
    recheckRequiredCount,
    photoSubmittedCount,
    latestReceiveAt: latestGroup?.latestScannedAt || '-',
    latestReceiveBy: latestGroup?.latestScannedBy || '-',
    materialReceiveSummaryText: `配料 ${configuredCount}/${totalCount} · 领料成功 ${receiveSuccessCount}/${totalCount}`,
    resultSummaryText:
      latestGroup?.resultSummaryText
      || (record.materialLines.length > 0 ? '当前尚未形成正式扫码回执。' : '当前生产单下暂无可汇总的配料行。'),
  }
}

function buildSummary(groups: PrepGroupProjection[], aggregate: PlatformCuttingPickupAggregate): PlatformCuttingPickupSummary {
  const representative = groups
    .slice()
    .sort((left, right) => {
      const dateDiff = compareDateTime(right.latestScannedAt === '-' ? '' : right.latestScannedAt, left.latestScannedAt === '-' ? '' : left.latestScannedAt)
      if (dateDiff !== 0) return dateDiff
      return right.printCopyCount - left.printCopyCount
    })[0] || null

  if (!representative) {
    return {
      pickupSlipNo: '-',
      latestPrintVersionNo: '-',
      printCopyCount: 0,
      printSlipStatusLabel: '未打印',
      qrCodeValue: '-',
      qrStatus: '未生成二维码',
      latestResultStatus: 'NOT_SCANNED',
      latestResultLabel: '未扫码回写',
      latestScannedBy: '-',
      needsRecheck: false,
      hasPhotoEvidence: false,
      photoProofCount: 0,
      receiptStatus: 'NOT_SCANNED',
      receiptStatusLabel: '未回执',
      latestScannedAt: '-',
      printVersionSummaryText: '当前尚无打印版本',
      qrBindingSummaryText: '当前尚未生成二维码绑定对象',
      resultSummaryText: '当前尚无正式领料回写。',
      evidenceSummaryText: '当前无照片凭证',
      summaryText: '当前没有领料回执摘要。',
    }
  }

  return {
    pickupSlipNo: representative.pickupSlipNo,
    latestPrintVersionNo: representative.latestPrintVersionNo,
    printCopyCount: representative.printCopyCount,
    printSlipStatusLabel: representative.printSlipStatusLabel,
    qrCodeValue: representative.qrCodeValue,
    qrStatus: representative.qrGenerated ? '已生成二维码' : '未生成二维码',
    latestResultStatus: representative.latestResultStatus,
    latestResultLabel: representative.latestResultLabel,
    latestScannedBy: representative.latestScannedBy,
    needsRecheck: representative.needsRecheck,
    hasPhotoEvidence: representative.hasPhotoEvidence,
    photoProofCount: representative.photoProofCount,
    receiptStatus: representative.receiptStatus,
    receiptStatusLabel: representative.receiptStatusLabel,
    latestScannedAt: representative.latestScannedAt,
    printVersionSummaryText: representative.printed
      ? `当前共打印 ${aggregate.printedSlipCount} 张领料单，最新版本 ${representative.latestPrintVersionNo}`
      : '当前尚无打印版本',
    qrBindingSummaryText: representative.qrBindingSummaryText,
    resultSummaryText: representative.resultSummaryText,
    evidenceSummaryText: representative.evidenceSummaryText,
    summaryText: `${aggregate.materialReceiveSummaryText}；${representative.resultSummaryText}`,
  }
}

export function buildPlatformCuttingPrepProjection(
  snapshot: CuttingDomainSnapshot,
  record: CuttingOrderProgressRecord,
  originalCutOrderRefs: OriginalCutOrderRef[],
): PlatformCuttingPrepProjection {
  const groupedLines = groupLinesByOriginalCutOrder(record, originalCutOrderRefs)
  const pickupWritebacks = snapshot.pdaExecutionState.pickupWritebacks as unknown as PdaPickupWritebackRecord[]
  const groups = groupedLines.map((group) => {
    const writebacks = pickupWritebacks.filter(
      (item) => {
        if (group.originalCutOrderId) return item.originalCutOrderId === group.originalCutOrderId
        if (group.originalCutOrderNo) return item.originalCutOrderNo === group.originalCutOrderNo
        return item.productionOrderId === record.productionOrderId || item.productionOrderNo === record.productionOrderNo
      },
    )
    return buildGroupProjection({
      record,
      originalCutOrderId: group.originalCutOrderId,
      originalCutOrderNo: group.originalCutOrderNo,
      lines: group.lines,
      writebacks,
    })
  })
  const aggregate = buildAggregate(groups, record)
  const summary = buildSummary(groups, aggregate)
  return { aggregate, summary }
}

export function listPlatformCuttingPrepRowsByProductionOrder(
  snapshot: CuttingDomainSnapshot,
): Array<{ productionOrderId: string; productionOrderNo: string; prep: PlatformCuttingPrepProjection }> {
  return snapshot.progressRecords.map((record) => ({
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    prep: buildPlatformCuttingPrepProjection(
      snapshot,
      record,
      snapshot.originalCutOrders
        .filter((item) => item.productionOrderId === record.productionOrderId)
        .map((item) => snapshot.registry.originalCutOrdersById[item.originalCutOrderId] || snapshot.registry.originalCutOrdersByNo[item.originalCutOrderNo])
        .filter((item): item is OriginalCutOrderRef => Boolean(item)),
    ),
  }))
}

export function getPlatformCuttingPrepStatusByProductionOrder(
  snapshot: CuttingDomainSnapshot,
  productionOrderId: string,
): PlatformCuttingPrepProjection | null {
  const record = snapshot.progressRecords.find((item) => item.productionOrderId === productionOrderId)
  if (!record) return null
  const originalCutOrderRefs = snapshot.originalCutOrders
    .filter((item) => item.productionOrderId === productionOrderId)
    .map((item) => snapshot.registry.originalCutOrdersById[item.originalCutOrderId] || snapshot.registry.originalCutOrdersByNo[item.originalCutOrderNo])
    .filter((item): item is OriginalCutOrderRef => Boolean(item))
  return buildPlatformCuttingPrepProjection(snapshot, record, originalCutOrderRefs)
}
