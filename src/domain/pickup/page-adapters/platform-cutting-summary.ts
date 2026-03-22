import type { PickupQrBinding, PickupReceiptSummary, PickupSlip } from '../types'

export interface PlatformCuttingPickupSummary {
  pickupSlipNo: string
  qrStatus: '已生成二维码' | '未生成二维码'
  latestResultStatus: PickupReceiptSummary['latestResultStatus']
  latestResultLabel: string
  needsRecheck: boolean
  hasPhotoEvidence: boolean
  latestScannedAt: string
  summaryText: string
}

export function buildPlatformCuttingPickupSummary(
  slip: PickupSlip,
  receiptSummary: PickupReceiptSummary,
  qrBinding?: PickupQrBinding | null,
): PlatformCuttingPickupSummary {
  return {
    pickupSlipNo: slip.pickupSlipNo,
    qrStatus: qrBinding ? '已生成二维码' : '未生成二维码',
    latestResultStatus: receiptSummary.latestResultStatus,
    latestResultLabel: receiptSummary.latestResultLabel,
    needsRecheck: receiptSummary.needsRecheck,
    hasPhotoEvidence: receiptSummary.hasPhotoEvidence,
    latestScannedAt: receiptSummary.latestScannedAt,
    summaryText: `${receiptSummary.latestResultLabel} · ${receiptSummary.hasPhotoEvidence ? '含照片凭证' : '无照片凭证'} · ${receiptSummary.needsRecheck ? '需复核' : '无需复核'}`,
  }
}

