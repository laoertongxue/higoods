import { pcsRecordStore, withPcsDemoData } from './pcs-record-runtime.ts'
import staticBaselineUrl from './generated/pcs-record-baseline.json?url'

let initialized = false
/** Fixed demonstrations ship with the app; initialization only prepares memory.
 * Regenerate after editing seed sources: node --import tsx scripts/generate-pcs-static-baseline.ts
 */
export async function initializePcsRecordBaseline(): Promise<void> {
  if (initialized) return
  // The fixed JSON ships beside the application. Keep its 3 MB of data out of
  // executable JavaScript so a cold page need not compile an escaped string.
  let staticBaseline: Record<string, string>
  try {
    const response = await fetch(staticBaselineUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    staticBaseline = await response.json() as Record<string, string>
  } catch (cause) {
    throw new Error('演示基础资料暂时无法读取，请检查连接后重新读取。', { cause })
  }
  withPcsDemoData(() => {
    for (const [key, value] of Object.entries(staticBaseline)) pcsRecordStore.setItem(key, value)
  })
  initialized = true
}
