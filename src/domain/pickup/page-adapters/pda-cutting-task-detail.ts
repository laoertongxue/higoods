import { getPdaCuttingTaskDetail } from '../../../data/fcs/pda-cutting-special'
import { cuttingPickupPrintVersions } from '../mock'
import type { PickupPrintVersion, PickupQrBinding } from '../types'
import { buildCuttingPickupViewFromPdaDetail } from './cutting-shared'

function findLatestPrintVersion(pickupSlipNo: string): PickupPrintVersion | null {
  return (
    [...cuttingPickupPrintVersions]
      .filter((item) => item.pickupSlipNo === pickupSlipNo)
      .sort((left, right) => Number(right.isLatestVersion) - Number(left.isLatestVersion) || right.printVersionNo.localeCompare(left.printVersionNo))[0] ?? null
  )
}

export function buildPdaCuttingTaskPickupView(taskId: string, cutPieceOrderNo?: string | null) {
  const detail = getPdaCuttingTaskDetail(taskId, cutPieceOrderNo ?? undefined)
  if (!detail) return null

  const latestPrintVersion = findLatestPrintVersion(detail.pickupSlipNo)
  const qrBinding: PickupQrBinding | null = detail.hasQrCode
    ? {
        qrCodeValue: detail.qrCodeValue,
        boundObjectType: 'CUT_PIECE_ORDER',
        boundObjectNo: detail.cutPieceOrderNo,
        scenarioType: 'CUTTING',
        reusePolicy: 'REUSE_BY_BOUND_OBJECT',
        generatedAt: latestPrintVersion?.printedAt || detail.latestReceiveAt || '',
        generatedBy: '仓库配料',
        status: 'ACTIVE',
        latestPrintVersionNo: latestPrintVersion?.printVersionNo || '',
      }
    : null

  return buildCuttingPickupViewFromPdaDetail(detail, latestPrintVersion, qrBinding)
}
