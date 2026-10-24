import { readPcsRecords, type PcsStoredRecord } from '../pcs-record-db.ts'
import { registerSpecialCraftStorageBridge, rebuildFactoryProcessLedger, splitFactoryProcessLedger, sameProcessLedgerRow, FACTORY_PROCESS_KEYS, WATER_EXECUTION_STORAGE_KEY, type ProcessLedgerRow } from './factory-process-storage.ts'
import { hydrateDesignRevisionFcsCaches } from './design-revision-pcs-storage.ts'

// Retain the existing collection identities; ordinary dye execution shares the
// same process ledgers and PCS transaction, without loading the Special Craft UI.
export const SPECIAL_CRAFT_RECORDS = 'fcs.special-craft.records.v1'
export const SPECIAL_CRAFT_LEDGER_RECORDS = 'fcs.special-craft.ledger-records.v1'
export const CENTRAL_EXECUTION_COMMAND_GUARDS = 'fcs.central-execution.command-guards.v1'
export const CENTRAL_EXECUTION_COLLECTIONS = [SPECIAL_CRAFT_RECORDS, SPECIAL_CRAFT_LEDGER_RECORDS, CENTRAL_EXECUTION_COMMAND_GUARDS]
export const CENTRAL_EXECUTION_LEGACY_KEYS = [...FACTORY_PROCESS_KEYS]
type LedgerRow = ProcessLedgerRow & { legacyKey: string; deleted?: boolean }
let snapshot = new Map<string, PcsStoredRecord>(), epoch = 0, loaded = false
let pending: Promise<void> | undefined
let staged: Map<string, string> | undefined
let forwardStagedWrites = false
export const centralExecutionRecordChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('higood-special-craft-records-v1') : undefined
centralExecutionRecordChannel?.addEventListener('message', () => { loaded = false; epoch++ })

export function centralLedgerRecordId(key: string, row: ProcessLedgerRow) {
  return `${SPECIAL_CRAFT_LEDGER_RECORDS}/${encodeURIComponent(key)}/${encodeURIComponent(row.path + '/' + row.key)}`
}
/** A related action guards the current owner instead of adopting a second copy. */
export function getCentralExecutionLedgerGuard(key: string, path: string, identity: string): {id:string;expectedVersion:number} | undefined {
  const id=centralLedgerRecordId(key,{path,key:identity,value:null,tuple:true}),row=snapshot.get(id)
  return row?{id,expectedVersion:row.version}:undefined
}
export function getCentralExecutionRecordEpoch() { return epoch }
export function setCentralExecutionLedgerStage(value: Map<string, string> | undefined, forward = false) {
  staged = value; forwardStagedWrites = !!value && forward
}
export function replaceCentralExecutionRecordSnapshot(rows: Iterable<PcsStoredRecord>) {
  const next = new Map<string, PcsStoredRecord>()
  for (const row of rows) {
    if(row.collection===CENTRAL_EXECUTION_COMMAND_GUARDS){
      const value=row.value as {key?:string;operationId?:string}
      if(!value?.key||!value.operationId||row.id!==`${CENTRAL_EXECUTION_COMMAND_GUARDS}/${encodeURIComponent(value.key)}`)throw new Error('作业版本记录不完整，请重新读取。')
    }
    if (row.collection === SPECIAL_CRAFT_LEDGER_RECORDS) {
      const value = row.value as LedgerRow
      if (!value || !CENTRAL_EXECUTION_LEGACY_KEYS.includes(value.legacyKey) || typeof value.path !== 'string'
        || typeof value.key !== 'string' || typeof value.tuple !== 'boolean'
        || row.id !== centralLedgerRecordId(value.legacyKey, value)) throw new Error('共同收发记录格式不完整，未覆盖原记录。')
    }
    next.set(row.id, row)
  }
  snapshot = next; loaded = true; epoch++
}
function ledgerRows(key: string) {
  return [...snapshot.values()].filter(row => row.collection === SPECIAL_CRAFT_LEDGER_RECORDS)
    .map(row => ({ ...(row.value as LedgerRow), deleted: row.deleted || (row.value as LedgerRow).deleted }))
    .filter(row => row.legacyKey === key)
}

function ownsIdentity(value: unknown, target: string): boolean {
  if (Array.isArray(value)) return value.some(row => ownsIdentity(row, target))
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  const printView = typeof row.printOrderId === 'string' ? row.businessView as { dispatchDocuments?: unknown[]; barcodes?: Array<{ handoverRecordId?: string }> } | undefined : undefined
  const documents = row.dispatchDocuments ?? printView?.dispatchDocuments
  if ((typeof row.waterOrderId === 'string' || typeof row.dyeOrderId === 'string' || typeof row.printOrderId === 'string') && (row.waterOrderId === target || row.dyeOrderId === target || row.printOrderId === target || row.taskId === target
    || (Array.isArray(documents) && documents.some(doc => doc?.id === target
      || (Array.isArray(doc?.lines) && doc.lines.some((line: { handoverRecordId?: string }) => line?.handoverRecordId === target))))
    || printView?.barcodes?.some(roll => roll.handoverRecordId === target))) return true
  return ['id', 'recordId', 'handoverId', 'handoverOrderId', 'pickupRecordId'].some(key => row[key] === target)
    || (!!row.head && ownsIdentity(row.head, target))
}
export function isCentralExecutionRecordTarget(target: unknown): boolean {
  if (typeof target === 'string') return [...snapshot.values()].some(row => {
    if (row.deleted) return false
    if (row.collection === SPECIAL_CRAFT_RECORDS) {
      const value = row.value as { key?: string; target?: unknown }
      return value?.key === target || (row.id.includes('/commands/') && value?.target === target)
    }
    if (row.collection !== SPECIAL_CRAFT_LEDGER_RECORDS) return false
    const value = row.value as LedgerRow
    return value.key === target || ownsIdentity(value.value, target)
  })
  if (Array.isArray(target)) return target.some(isCentralExecutionRecordTarget)
  return !!target && typeof target === 'object' && Object.values(target).some(isCentralExecutionRecordTarget)
}

registerSpecialCraftStorageBridge({
  read(key, raw) {
    if (!CENTRAL_EXECUTION_LEGACY_KEYS.includes(key)) return raw
    if (staged?.has(key)) return staged.get(key)!
    return rebuildFactoryProcessLedger(raw, ledgerRows(key))
  },
  write(key, raw) {
    if (!CENTRAL_EXECUTION_LEGACY_KEYS.includes(key)) return { handled: false }
    if (staged) { staged.set(key, raw); return { handled: !(forwardStagedWrites && FACTORY_PROCESS_KEYS.includes(key)) } }
    if (key === WATER_EXECUTION_STORAGE_KEY && typeof window !== 'undefined') throw new Error('水溶记录须通过对应业务动作保存，本次未保存。')
    const owned = ledgerRows(key)
    if (owned.length) {
      // The underlying PCS/native document need not contain Central overlays.
      // Compare with their actual owner, including deletion, before allowing a
      // separate writer to retain those unchanged rows in its combined view.
      const after = new Map(splitFactoryProcessLedger(raw).map(row => [row.path + '/' + row.key, row]))
      if (owned.some(row=>row.deleted?after.has(row.path+'/'+row.key):!sameProcessLedgerRow(row,after.get(row.path+'/'+row.key)))) throw new Error('收发记录须通过对应业务动作保存，本次未保存。')
    }
    return { handled: false }
  },
  owns: isCentralExecutionRecordTarget,
})

/** Cold Web downstream entries read the same normalized facts before their page
 * modules build caches. Reads do not copy demonstrations or invoke mutations. */
export async function ensureCentralExecutionRecordRead(force = false): Promise<void> {
  if (loaded && !force) return
  if (pending) return pending
  pending = (async () => {
    const saved = await readPcsRecords(CENTRAL_EXECUTION_COLLECTIONS)
    const changed = saved.records.some(row => row.collection === SPECIAL_CRAFT_LEDGER_RECORDS && snapshot.get(row.id)?.version !== row.version)
    replaceCentralExecutionRecordSnapshot(saved.records)
    if (changed) hydrateDesignRevisionFcsCaches(['print', 'dye', 'dye-online', 'water', 'receiving', 'staged-storage'])
  })()
  try { await pending } finally { pending = undefined }
}
