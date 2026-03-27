export const CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY = 'cuttingReplenishmentReviews'
export const CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY = 'cuttingReplenishmentImpactPlans'
export const CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY = 'cuttingReplenishmentAuditTrail'
export const CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY = 'cuttingReplenishmentFollowupActions'

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
