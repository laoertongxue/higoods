import { commitPcsRecords, readPcsRecords, type PcsStoredRecord, type PcsMigrationReceipt } from '../pcs-record-db.ts'
import { decodeLegacyWaterSolubleExecution } from './water-soluble-task-domain.ts'
import { WATER_EXECUTION_STORAGE_KEY, withFactoryProcessStaticRead, sameProcessLedgerRow } from './factory-process-storage.ts'
import { centralLedgerRecordId, SPECIAL_CRAFT_LEDGER_RECORDS } from './central-execution-record-bridge.ts'
import { waterSolubleLegacyRaw } from './water-soluble-legacy-source.ts'

const receiptId = 'fcs.water-soluble.legacy-execution.v1'
const fingerprint = async (raw: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(v => v.toString(16).padStart(2, '0')).join('')
type WaterLedgerValue = { legacyKey: string; path: string; key: string; tuple: boolean; value: unknown }

export function waterSolubleLegacyTargets(raw: string): Array<Omit<PcsStoredRecord, 'version'>> {
  return withFactoryProcessStaticRead(() => decodeLegacyWaterSolubleExecution(raw).map(order => {
    const value: WaterLedgerValue = { legacyKey: WATER_EXECUTION_STORAGE_KEY, path: 'orders', key: order.waterOrderId, tuple: false, value: order }
    return { id: centralLedgerRecordId(WATER_EXECUTION_STORAGE_KEY, value), collection: SPECIAL_CRAFT_LEDGER_RECORDS, value }
  }))
}
function sameTarget(target: Omit<PcsStoredRecord, 'version'>, actual?: PcsStoredRecord) {
  return !!actual && !actual.deleted && actual.collection === target.collection
    && (actual.value as WaterLedgerValue)?.legacyKey === WATER_EXECUTION_STORAGE_KEY
    && sameProcessLedgerRow(target.value as WaterLedgerValue, actual.value as WaterLedgerValue)
}
function unchanged(raw: string) {
  if (waterSolubleLegacyRaw() !== raw) throw new Error('旧水溶资料已被其他页面改动，原资料未清理。关闭旧页面后重新读取。')
}

/** Only this explicit entry can retire the old water key; shared receiving ledgers are untouched. */
export async function migrateLegacyWaterSolubleExecution(input: { otherPagesClosed: boolean; progress(text: string): void }): Promise<number> {
  const raw = waterSolubleLegacyRaw()
  if (raw === null) return 0
  if (!input.otherPagesClosed) throw new Error('先关闭其他 HiGood 页面并确认；旧水溶资料已保留。')
  const targets = waterSolubleLegacyTargets(raw), digest = await fingerprint(raw)
  const initial = await readPcsRecords([SPECIAL_CRAFT_LEDGER_RECORDS])
  const receipt = initial.migrations.find(row => row.id === receiptId)
  if (receipt && (receipt.legacyKey !== WATER_EXECUTION_STORAGE_KEY || receipt.legacyDigest !== digest)) throw new Error('旧水溶资料与已核对版本不同，双方资料已保留。')
  const existing = new Map(initial.records.map(row => [row.id, row]))
  for (const target of targets) if (existing.has(target.id) && !sameTarget(target, existing.get(target.id))) throw new Error('旧水溶资料与记录库冲突，双方资料已保留。')
  for (let offset = 0; offset < targets.length; offset += 50) {
    unchanged(raw)
    const batch = targets.slice(offset, offset + 50), puts = batch.filter(row => !existing.has(row.id))
    if (puts.length) await commitPcsRecords({ operationId: `${receiptId}:${digest}:${offset}`, intent: JSON.stringify(batch),
      puts: puts.map(row => ({ ...row, expectedVersion: 0 })), deletes: [] })
    unchanged(raw)
    input.progress(`已迁移水溶加工单 ${Math.min(offset + 50, targets.length)} / ${targets.length}`)
  }
  const saved = await readPcsRecords([SPECIAL_CRAFT_LEDGER_RECORDS]), current = new Map(saved.records.map(row => [row.id, row]))
  if (targets.some(target => !sameTarget(target, current.get(target.id)))) throw new Error('水溶记录读回不一致，旧资料未清理。')
  unchanged(raw)
  const verified: PcsMigrationReceipt = { id: receiptId, legacyKey: WATER_EXECUTION_STORAGE_KEY, legacyDigest: digest,
    sourceDigest: await fingerprint(JSON.stringify(targets)), recordIds: targets.map(row => row.id), completedAt: receipt?.completedAt || new Date().toISOString() }
  await commitPcsRecords({ operationId: `${receiptId}:${digest}:verified`, intent: JSON.stringify(verified), puts: [], deletes: [],
    guards: targets.map(row => ({ id: row.id, expectedVersion: current.get(row.id)!.version })), migrationReceipts: [verified] })
  const readback = await readPcsRecords([SPECIAL_CRAFT_LEDGER_RECORDS])
  const proof = readback.migrations.find(row => row.id === receiptId)
  const finalRecords = new Map(readback.records.map(row => [row.id, row]))
  if (proof?.legacyDigest !== digest || proof.sourceDigest !== verified.sourceDigest || targets.some(row => !sameTarget(row, finalRecords.get(row.id)))) throw new Error('水溶迁移核对尚未完成，旧资料未清理。')
  unchanged(raw)
  window.localStorage.removeItem(WATER_EXECUTION_STORAGE_KEY)
  if (waterSolubleLegacyRaw() !== null) throw new Error('水溶资料已核对，但旧记录未能清理，可从此处重试。')
  input.progress('水溶记录已保存并核对，旧水溶资料已清理。')
  return targets.length
}
