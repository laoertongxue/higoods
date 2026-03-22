import { buildPickupResultSummary } from '../helpers'
import { listCuttingPickupViewsByProductionOrder } from './cutting-shared'

export interface CuttingSummaryPickupView {
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

export function buildCuttingSummaryPickupView(productionOrderNo: string): CuttingSummaryPickupView {
  const views = listCuttingPickupViewsByProductionOrder(productionOrderNo)
  const latestView = [...views]
    .filter((item) => item.latestScannedAt && item.latestScannedAt !== '-')
    .sort((left, right) => right.latestScannedAt.localeCompare(left.latestScannedAt))[0]

  return {
    printedSlipCount: views.filter((item) => item.printCopyCount > 0).length,
    qrGeneratedCount: views.filter((item) => item.qrStatus === 'GENERATED').length,
    receiveSuccessCount: views.filter((item) => item.latestResultStatus === 'MATCHED').length,
    recheckRequiredCount: views.filter((item) => item.latestResultStatus === 'RECHECK_REQUIRED').length,
    photoSubmittedCount: views.filter((item) => item.latestResultStatus === 'PHOTO_SUBMITTED').length,
    latestReceiveAt: latestView?.latestScannedAt || '-',
    latestReceiveBy: latestView?.latestScannedBy || '-',
    materialReceiveSummaryText: views.length
      ? `打印 ${views.filter((item) => item.printCopyCount > 0).length} · 二维码 ${views.filter((item) => item.qrStatus === 'GENERATED').length} · 领料成功 ${views.filter((item) => item.latestResultStatus === 'MATCHED').length}`
      : '当前没有领料单据摘要',
    resultSummaryText: views.length
      ? buildPickupResultSummary(views[0].receiptSummary)
      : '当前无扫码回写',
  }
}

