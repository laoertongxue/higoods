import type { PickupReceiptSummary } from '../types'
import type { CuttingPickupView } from './cutting-shared'

export interface PlatformCuttingPickupSummary {
  pickupSlipNo: string
  latestPrintVersionNo: string
  printCopyCount: number
  printSlipStatusLabel: string
  qrCodeValue: string
  qrStatus: '已生成二维码' | '未生成二维码'
  latestResultStatus: PickupReceiptSummary['latestResultStatus']
  latestResultLabel: string
  latestScannedBy: string
  needsRecheck: boolean
  hasPhotoEvidence: boolean
  photoProofCount: number
  receiptStatus: PickupReceiptSummary['receiptStatus']
  receiptStatusLabel: string
  latestScannedAt: string
  printVersionSummaryText: string
  qrBindingSummaryText: string
  resultSummaryText: string
  evidenceSummaryText: string
  summaryText: string
}

export function buildEmptyPlatformCuttingPickupSummary(): PlatformCuttingPickupSummary {
  return {
    pickupSlipNo: '-',
    latestPrintVersionNo: '-',
    printCopyCount: 0,
    printSlipStatusLabel: '未打印',
    qrCodeValue: '-',
    qrStatus: '未生成二维码',
    latestResultStatus: 'NOT_SCANNED',
    latestResultLabel: '未扫码回写',
    latestScannedAt: '-',
    latestScannedBy: '-',
    needsRecheck: false,
    hasPhotoEvidence: false,
    photoProofCount: 0,
    receiptStatus: 'NOT_SCANNED',
    receiptStatusLabel: '未回执',
    printVersionSummaryText: '当前尚无打印版本',
    qrBindingSummaryText: '当前尚未生成二维码绑定对象',
    resultSummaryText: '未扫码回写，无照片凭证，无需复核',
    evidenceSummaryText: '当前无差异凭证',
    summaryText: '当前没有领料回执摘要。',
  }
}

export function buildPlatformCuttingPickupSummary(view: CuttingPickupView): PlatformCuttingPickupSummary {
  return {
    pickupSlipNo: view.pickupSlipNo,
    latestPrintVersionNo: view.latestPrintVersionNo,
    printCopyCount: view.printCopyCount,
    printSlipStatusLabel: view.printSlipStatusLabel,
    qrCodeValue: view.qrCodeValue,
    qrStatus: view.qrStatusLabel,
    latestResultStatus: view.latestResultStatus,
    latestResultLabel: view.latestResultLabel,
    latestScannedAt: view.latestScannedAt,
    latestScannedBy: view.latestScannedBy,
    needsRecheck: view.needsRecheck,
    hasPhotoEvidence: view.hasPhotoEvidence,
    photoProofCount: view.photoProofCount,
    receiptStatus: view.receiptStatus,
    receiptStatusLabel: view.receiptStatusLabel,
    printVersionSummaryText: view.printVersionSummaryText,
    qrBindingSummaryText: view.qrBindingSummaryText,
    resultSummaryText: view.resultSummaryText,
    evidenceSummaryText: view.evidenceSummaryText,
    summaryText: view.resultSummaryText,
  }
}
