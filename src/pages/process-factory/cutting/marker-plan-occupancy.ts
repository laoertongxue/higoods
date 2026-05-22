import {
  MARKER_PLAN_STORAGE_KEY,
  type MarkerPlan,
  type MarkerPlanStatusKey,
} from './marker-plan-domain.ts'

export interface MarkerPlanOccupancyInfo {
  markerPlanId: string
  markerPlanNo: string
}

export type MarkerPlanOccupancyLookup = Record<string, MarkerPlanOccupancyInfo>

function isActiveMarkerPlanStatus(status: MarkerPlanStatusKey | string | undefined): boolean {
  const normalizedStatus = String(status || '').trim().toUpperCase()
  if (!normalizedStatus) return true
  return !['CANCELED', 'CANCELLED', 'DONE', 'COMPLETED', 'ARCHIVED'].includes(normalizedStatus)
}

function pickMarkerPlanNo(plan: Partial<MarkerPlan>): string {
  return plan.markerNo || plan.markerPlanNo || plan.schemeNo || ''
}

function addOccupancy(
  lookup: MarkerPlanOccupancyLookup,
  key: string | undefined,
  info: MarkerPlanOccupancyInfo,
): void {
  if (!key) return
  lookup[key] = info
}

export function buildMarkerPlanOccupancyLookup(
  plans: Array<Partial<MarkerPlan>>,
): MarkerPlanOccupancyLookup {
  const lookup: MarkerPlanOccupancyLookup = {}
  plans
    .filter((plan) => isActiveMarkerPlanStatus(plan.status))
    .forEach((plan) => {
      const info: MarkerPlanOccupancyInfo = {
        markerPlanId: plan.id || plan.markerPlanId || '',
        markerPlanNo: pickMarkerPlanNo(plan),
      }
      ;(plan.cutOrderIds || []).forEach((id) => addOccupancy(lookup, id, info))
      ;(plan.cutOrderNos || []).forEach((no) => addOccupancy(lookup, no, info))
    })
  return lookup
}

export function readStoredMarkerPlanOccupancyLookup(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): MarkerPlanOccupancyLookup {
  if (!storage) return {}
  try {
    const parsed = JSON.parse(storage.getItem(MARKER_PLAN_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return {}
    return buildMarkerPlanOccupancyLookup(parsed as Array<Partial<MarkerPlan>>)
  } catch {
    return {}
  }
}
