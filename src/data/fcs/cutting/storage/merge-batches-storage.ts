export const CUTTING_SELECTED_IDS_STORAGE_KEY = 'cuttingSelectedOriginalOrderIds'
export const CUTTING_SELECTED_COMPATIBILITY_KEY_STORAGE_KEY = 'cuttingSelectedCompatibilityKey'
export const CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY = 'cuttingMergeBatchLedger'

export function deserializeMergeBatchStorage(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record): record is Record<string, unknown> => {
      return Boolean(record && typeof record === 'object' && typeof (record as Record<string, unknown>).mergeBatchId === 'string' && typeof (record as Record<string, unknown>).mergeBatchNo === 'string')
    })
  } catch {
    return []
  }
}
