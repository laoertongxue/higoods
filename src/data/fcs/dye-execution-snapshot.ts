import { sameProcessLedgerRow, splitWashingLedger } from './fabric-washing-storage-bridge.ts'

/** Record-owner overlays may reorder identified collections; node/roll order remains significant. */
export function sameDyeExecutionSnapshot(saved: string | null, expected: string): boolean {
  if (saved === expected) return true
  if (!saved) return false
  try {
    const rows = splitWashingLedger(saved), wanted = splitWashingLedger(expected)
    const indexed = new Map(rows.map(row => [row.path + '/' + row.key, row]))
    const expectedIds = new Set(wanted.map(row => row.path + '/' + row.key))
    if (rows.length !== wanted.length || indexed.size !== rows.length || expectedIds.size !== wanted.length
      || wanted.some(row => !sameProcessLedgerRow(row, indexed.get(row.path + '/' + row.key)))) return false
    const metadata = (raw: string) => {
      const value = JSON.parse(raw)
      for (const key of ['workOrders', 'nodeRecords', 'reviewRecords', 'vatSchedules', 'formulas']) {
        if (Array.isArray(value.state?.[key])) value.state[key] = { recordCount: value.state[key].length }
      }
      for (const key of ['tasks', 'demoOutput', 'demoHandovers']) {
        if (Array.isArray(value[key])) value[key] = { recordCount: value[key].length }
      }
      return { path: 'metadata', key: 'dye', tuple: false, value }
    }
    return sameProcessLedgerRow(metadata(saved), metadata(expected))
  } catch { return false }
}
