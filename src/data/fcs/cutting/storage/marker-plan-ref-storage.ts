export const CUTTING_SELECTED_IDS_STORAGE_KEY = 'cuttingSelectedCutOrderIds'
export const CUTTING_SELECTED_MARKER_PLAN_GROUP_KEY_STORAGE_KEY = 'cuttingSelectedMarkerPlanKey'
export const CUTTING_MARKER_PLAN_REF_LEDGER_STORAGE_KEY = 'cuttingMarkerPlanRefLedger'

export function deserializeMarkerPlanRefStorage(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record): record is Record<string, unknown> => {
      return Boolean(record && typeof record === 'object' && typeof (record as Record<string, unknown>).markerPlanId === 'string' && typeof (record as Record<string, unknown>).markerPlanNo === 'string')
    })
  } catch {
    return []
  }
}
