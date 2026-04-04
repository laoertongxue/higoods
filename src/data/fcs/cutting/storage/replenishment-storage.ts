export const CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY = 'cuttingReplenishmentReviews'
export const CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY = 'cuttingReplenishmentImpactPlans'
export const CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY = 'cuttingReplenishmentAuditTrail'
export const CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY = 'cuttingReplenishmentFollowupActions'
export const CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY = 'cuttingReplenishmentPendingPrepFollowups'

export interface ReplenishmentPendingPrepFollowupRecord {
  followupId: string
  suggestionId: string
  sourceReplenishmentRequestId: string
  sourceSpreadingSessionId: string
  sourceMarkerId: string
  sourceMarkerNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  materialSku: string
  color: string
  shortageGarmentQty: number
  status: 'PENDING_PREP'
  createdAt: string
  createdBy: string
  note: string
}

function parseArray(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
  } catch {
    return []
  }
}

export const deserializeReplenishmentReviewsStorage = parseArray
export const deserializeReplenishmentImpactPlansStorage = parseArray
export const deserializeReplenishmentAuditTrailStorage = parseArray
export const deserializeReplenishmentActionsStorage = parseArray

function normalizePendingPrepRecord(record: Record<string, unknown>): ReplenishmentPendingPrepFollowupRecord | null {
  const followupId = String(record.followupId || '').trim()
  const originalCutOrderId = String(record.originalCutOrderId || '').trim()
  const materialSku = String(record.materialSku || '').trim()
  if (!followupId || !originalCutOrderId || !materialSku) return null

  return {
    followupId,
    suggestionId: String(record.suggestionId || '').trim(),
    sourceReplenishmentRequestId: String(record.sourceReplenishmentRequestId || record.suggestionId || '').trim(),
    sourceSpreadingSessionId: String(record.sourceSpreadingSessionId || '').trim(),
    sourceMarkerId: String(record.sourceMarkerId || '').trim(),
    sourceMarkerNo: String(record.sourceMarkerNo || '').trim(),
    originalCutOrderId,
    originalCutOrderNo: String(record.originalCutOrderNo || originalCutOrderId).trim(),
    materialSku,
    color: String(record.color || '').trim(),
    shortageGarmentQty: Number(record.shortageGarmentQty || 0),
    status: 'PENDING_PREP',
    createdAt: String(record.createdAt || '').trim(),
    createdBy: String(record.createdBy || '').trim(),
    note: String(record.note || '').trim(),
  }
}

export function serializeReplenishmentPendingPrepStorage(
  records: ReplenishmentPendingPrepFollowupRecord[],
): string {
  return JSON.stringify(records)
}

export function deserializeReplenishmentPendingPrepStorage(
  raw: string | null,
): ReplenishmentPendingPrepFollowupRecord[] {
  return parseArray(raw)
    .map(normalizePendingPrepRecord)
    .filter((record): record is ReplenishmentPendingPrepFollowupRecord => Boolean(record))
}

export function buildReplenishmentPendingPrepTraceMatrix(
  records: ReplenishmentPendingPrepFollowupRecord[],
) {
  return records
    .map((record) => ({
      followupId: record.followupId,
      sourceReplenishmentRequestId: record.sourceReplenishmentRequestId,
      sourceSpreadingSessionId: record.sourceSpreadingSessionId,
      sourceMarkerId: record.sourceMarkerId,
      sourceMarkerNo: record.sourceMarkerNo,
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      materialSku: record.materialSku,
      color: record.color,
      shortageGarmentQty: record.shortageGarmentQty,
      status: record.status,
    }))
    .sort(
      (left, right) =>
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
        || left.materialSku.localeCompare(right.materialSku, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN'),
    )
}
