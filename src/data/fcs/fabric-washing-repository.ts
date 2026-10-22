import { captureDesignRevisionFcsCaches, restoreDesignRevisionFcsCaches, hydrateDesignRevisionFcsCaches, PCS_FCS_COLLECTIONS } from './design-revision-pcs-storage.ts'
import { readPcsRecords, commitPcsRecords, type PcsStoredRecord, type PcsStoredFile, type PcsMigrationReceipt } from '../pcs-record-db.ts'
import { registerWashingStorageBridge, washingLedgerSnapshots, WASHING_LEGACY_KEYS, splitWashingLedger, rebuildWashingLedger, type ProcessLedgerRow } from './fabric-washing-storage-bridge.ts'
import { applyWashingCommand, emptyWashingState, type WashingActor, type WashingCommand, type WashingState } from './fabric-washing-model.ts'

export const WASHING_COLLECTION = 'fcs.fabric-washing.v1'
export const WASHING_BRIDGE_COLLECTION = 'fcs.fabric-washing.process-records.v1'
type BridgeRow = ProcessLedgerRow & { legacyKey: string; deleted?: boolean }
let records = new Map<string, PcsStoredRecord>()
let overlayEpoch=0
const bridgeReadCache=new Map<string,{raw:string|null;epoch:number;result:string|null}>()
let staged: Map<string, PcsStoredRecord> | undefined
const guards = new Set<string>()
let projecting=false
let projection:((state:WashingState)=>WashingState)|undefined
export function registerWashingProjection(read:(state:WashingState)=>WashingState){projection=read}
let baseline = new Map<string, string>()
const stagedRaw = new Map<string, string>()
let recipeActive = false
const adoptions=new Map<string,{raw:string;rows:ProcessLedgerRow[]}>()
let migrationWarnings:string[]=[]
let migrationReceipts:PcsMigrationReceipt[]=[]
export function washingMigrationWarnings(){return [...migrationWarnings]}
let loaded = false, saving = false, readFailure = ''
const fileUrls = new Map<string, string>(), urlFiles = new Map<string, string>()
let blobs = new Map<string, Blob>()
const channel = typeof window !== 'undefined' && window === globalThis && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('higood-fabric-washing-v1') : undefined
channel?.addEventListener('message', () => { loaded = false })
const keyFor = (kind: string, id: string) => WASHING_COLLECTION + '/' + kind + '/' + encodeURIComponent(id)
const bridgeId = (key: string, row: ProcessLedgerRow) => WASHING_BRIDGE_COLLECTION + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(row.path + '/' + row.key)
function current() { return recipeActive && staged ? staged : records }
function hydrate<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_, item) => {
    if (typeof item !== 'string' || !item.startsWith('pcs-file:')) return item
    const id = item.slice(9), blob = blobs.get(id)
    if (!blob) throw new Error('洗水资料的附件引用缺失，请保留资料后重新读取。')
    if (!fileUrls.has(id)) { const url = URL.createObjectURL(blob); fileUrls.set(id, url); urlFiles.set(url, id) }
    return fileUrls.get(id)
  })
}
function domainRows(state: WashingState): Array<{ id: string; value: unknown }> {
  return (['judgments', 'orders', 'actions'] as const).flatMap(kind => state[kind].map(value => ({ id: keyFor(kind, value.id), value: { kind, data: value } })))
}
export function readWashingState(): WashingState {
  if (readFailure) throw new Error(readFailure)
  const state = emptyWashingState()
  for (const row of current().values()) if (row.collection === WASHING_COLLECTION && !row.deleted) {
    const value = hydrate(row.value) as { kind: keyof WashingState; data: any }
    if (value.kind in state) state[value.kind].push(value.data)
  }
  if(!projection||projecting)return state
  projecting=true;try{return projection(state)}finally{projecting=false}
}
const bridgeVersions = (rows: Iterable<PcsStoredRecord>) => JSON.stringify([...rows].filter(row=>row.collection===WASHING_BRIDGE_COLLECTION).map(row=>[row.id,row.version]).sort())
export async function ensureWashingRecords(force = false): Promise<void> {
  if (loaded && !force) return
  if (saving) throw new Error('上一笔洗水动作尚未保存，请等待完成。')
  try {
    await (await import('../pcs-record-runtime.ts')).ensurePcsRecordState(PCS_FCS_COLLECTIONS)
    await (await import('./production-context-records.ts')).hydrateProductionContextRecords()
    const saved = await readPcsRecords([WASHING_COLLECTION, WASHING_BRIDGE_COLLECTION])
    const processChanged = bridgeVersions(records.values()) !== bridgeVersions(saved.records)
    records = new Map(saved.records.map(row => [row.id, row]))
    migrationReceipts=saved.migrations
    overlayEpoch++
    blobs = new Map(saved.files.map(file => [file.id, file.blob]))
    loaded = true; readFailure = ''
    if(processChanged)hydrateDesignRevisionFcsCaches()
  } catch (error) {
    readFailure = '洗水用户资料无法读取，未按空数据覆盖。' + (error instanceof Error ? error.message : String(error))
    throw new Error(readFailure)
  }
}
/** Route/history readers need the washing facts, not initialization of production writers. */
export async function ensureWashingViewRecords(includeBridge=false):Promise<void> {
  if(saving)throw new Error('上一笔洗水动作尚未保存，请等待完成。')
  try{
    // Shared read-only handover pages need the actual process ledger too, but
    // do not consume independent pre-production sample payloads. Real commands
    // still call ensureWashingRecords and restore the complete writer source.
    if(includeBridge){
      await (await import('../pcs-record-runtime.ts')).ensurePcsRecordState(PCS_FCS_COLLECTIONS)
      await (await import('./production-context-records.ts')).hydratePostFinishingProductionContextRecords()
    }
    const saved=await readPcsRecords(includeBridge?[WASHING_COLLECTION,WASHING_BRIDGE_COLLECTION]:[WASHING_COLLECTION])
    if(saving)throw new Error('上一笔洗水动作尚未保存，请等待完成。')
    const processChanged=includeBridge && bridgeVersions(records.values())!==bridgeVersions(saved.records)
    if(includeBridge){
      records=new Map(saved.records.map(row=>[row.id,row]));migrationReceipts=saved.migrations;overlayEpoch++
      blobs=new Map(saved.files.map(file=>[file.id,file.blob]))
    }else{
      const next=new Map([...records].filter(([,row])=>row.collection!==WASHING_COLLECTION))
      for(const row of saved.records)if(row.collection===WASHING_COLLECTION)next.set(row.id,row)
      records=next
      for(const file of saved.files)blobs.set(file.id,file.blob)
    }
    loaded=false;readFailure=''
    if(processChanged)hydrateDesignRevisionFcsCaches()
  }catch(error){
    readFailure='洗水用户资料无法读取，未按空数据覆盖。'+(error instanceof Error?error.message:String(error))
    throw new Error(readFailure)
  }
}
export function washingReadError() { return readFailure }
function overlayRows(key: string): BridgeRow[] {
  return [...current().values()].filter(row => row.collection === WASHING_BRIDGE_COLLECTION).map(row => hydrate(row.value) as BridgeRow).filter(row => row.legacyKey === key)
}
registerWashingStorageBridge({
  read(key, raw) {
    if(recipeActive && staged && stagedRaw.has(key))return stagedRaw.get(key)!
    if(!WASHING_LEGACY_KEYS.includes(key))return raw
    const cached=bridgeReadCache.get(key)
    if(cached?.raw===raw&&cached.epoch===overlayEpoch)return cached.result
    const result=rebuildWashingLedger(raw,overlayRows(key));bridgeReadCache.set(key,{raw,epoch:overlayEpoch,result});return result
  },
  owns(target) {
    const values = typeof target === 'string' ? [target] : JSON.stringify(target ?? '')
    return [...current().values()].some(row => row.collection === WASHING_BRIDGE_COLLECTION && (values as any).includes((row.value as BridgeRow).key))
  },
  write(key, raw, previous) {
    if (!WASHING_LEGACY_KEYS.includes(key)) return { handled: false }
    if(staged&&!recipeActive)throw new Error('本次实物记录正在保存，请等待完成后再操作。')
    const old = new Map(splitWashingLedger(rebuildWashingLedger(staged ? baseline.get(key) ?? previous : previous, overlayRows(key))).map(row => [row.path + '/' + row.key, row]))
    const next = new Map(splitWashingLedger(raw).map(row => [row.path + '/' + row.key, row]))
    if (!staged) {
      for (const adopted of overlayRows(key)) {
        const changed = next.get(adopted.path + '/' + adopted.key)
        if (!changed || JSON.stringify(changed.value) !== JSON.stringify(adopted.value)) throw new Error('本记录已切换为按记录保存，请重新读取后通过业务动作操作。')
      }
      // Already-adopted rows must never be written back to the old fact source.
      const adopted = overlayRows(key)
      return adopted.length ? { handled: false, raw: rebuildWashingLedger(raw, adopted.map(row => ({ ...row, deleted: true })))! } : { handled: false }
    }
    stagedRaw.set(key, raw)
    overlayEpoch++
    for (const [id, row] of next) if (JSON.stringify(old.get(id)) !== JSON.stringify(row)) {
      const recordId = bridgeId(key, row)
      staged.set(recordId, { id: recordId, collection: WASHING_BRIDGE_COLLECTION, value: { ...row, legacyKey: key }, version: records.get(recordId)?.version ?? 0 })
    }
    for (const [id, row] of old) if (!next.has(id)) {
      const recordId = bridgeId(key, row)
      staged.set(recordId, { id: recordId, collection: WASHING_BRIDGE_COLLECTION, value: { ...row, legacyKey: key, deleted: true }, version: records.get(recordId)?.version ?? 0 })
    }
    return { handled: true }
  },
})

async function compact<T>(value: T, newFiles: PcsStoredFile[]): Promise<T> {
  async function visit(item: any): Promise<any> {
    if (typeof item === 'string' && (item.startsWith('data:') || item.startsWith('blob:'))) {
      let id = urlFiles.get(item)
      if (!id) {
        const blob = await (await fetch(item)).blob()
        id = 'wash-file-' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('')
        if (!blobs.has(id) && !newFiles.some(file => file.id === id)) newFiles.push({ id, blob })
      }
      return 'pcs-file:' + id
    }
    if (Array.isArray(item)) return Promise.all(item.map(visit))
    if (item && typeof item === 'object') {
      const output=Object.fromEntries(await Promise.all(Object.entries(item).map(async ([key,v])=>[key,await visit(v)])))
      if(typeof output.dataUrl==='string'&&output.dataUrl.startsWith('pcs-file:')&&'fileId'in output){output.fileId=output.dataUrl.slice(9);output.fileStorage='indexeddb'}
      return output
    }
    return item
  }
  return visit(value)
}
export async function runWashingRecordCommand<T>(recipe: () => T, operationId: string, intent: string, usesProcessLedgers=true): Promise<T> {
  await ensureWashingRecords(true)
  if(usesProcessLedgers)hydrateDesignRevisionFcsCaches()
  const cacheBefore = usesProcessLedgers?captureDesignRevisionFcsCaches():undefined
  stagedRaw.clear()
  baseline = usesProcessLedgers?washingLedgerSnapshots():new Map()
  guards.clear();adoptions.clear();migrationWarnings=[]
  saving = true; staged = new Map(records)
  try {
    recipeActive=true
    const result = recipe()
    recipeActive=false;overlayEpoch++
    if(cacheBefore)restoreDesignRevisionFcsCaches(cacheBefore)
    const changed = [...staged.values()].filter(row => JSON.stringify(row.value) !== JSON.stringify(records.get(row.id)?.value))
    const files: PcsStoredFile[] = []
    const puts = await Promise.all(changed.map(async row => ({
      id: row.id, collection: row.collection, value: await compact(row.value, files), expectedVersion: records.get(row.id)?.version ?? 0,
    })))
    // An old tab may still hold an obsolete writer. Never delete a fragment
    // that changed after its first committed adoption, even on a later retry.
    for(const [legacyKey,source] of adoptions){
      const verified=new Set<string>()
      for(const receipt of migrationReceipts.filter(r=>r.legacyKey===legacyKey)){
        const rows=source.rows.filter(row=>receipt.recordIds.includes(bridgeId(legacyKey,row)))
        if(rows.length===receipt.recordIds.length&&await digest(JSON.stringify(rows))===receipt.sourceDigest)receipt.recordIds.forEach(id=>verified.add(id))
      }
      for(const row of source.rows){
        const id=bridgeId(legacyKey,row),existing=records.get(id)
        if(existing&&!verified.has(id)&&JSON.stringify((hydrate(existing.value) as BridgeRow).value)!==JSON.stringify(row.value))throw new Error('旧加工资料在切换后又发生变化，已保留旧源；请关闭旧页后核对，不能覆盖已保存记录。')
      }
    }
    const newMigrationReceipts:PcsMigrationReceipt[]=await Promise.all([...adoptions].map(async([legacyKey,source])=>({id:'washing-legacy:'+legacyKey+':'+await digest(JSON.stringify(source.rows)),sourceDigest:await digest(JSON.stringify(source.rows)),legacyKey,legacyDigest:await digest(source.raw),recordIds:source.rows.map(row=>bridgeId(legacyKey,row)),completedAt:new Date().toISOString()})))
    for(const [legacyKey,source] of adoptions)if(localStorage.getItem(legacyKey)!==source.raw)throw new Error('旧加工资料已在其他页面变化，本次未保存，请关闭旧页后重新读取。')
    await commitPcsRecords({ migrationReceipts:newMigrationReceipts, guards: [...guards].filter(id=>!puts.some(row=>row.id===id)).map(id => ({ id, expectedVersion: records.get(id)?.version ?? 0 })), puts, deletes: [], files, operationId, intent })
    files.forEach(file => blobs.set(file.id, file.blob))
    // Read the committed versions rather than predicting the outcome of a transaction.
    staged = undefined; stagedRaw.clear(); saving = false; loaded = false
    await ensureWashingRecords()
    // Target records and Blob references were read back before removing any verified old fragment.
    for(const [legacyKey,source] of adoptions){
      try{
        if(localStorage.getItem(legacyKey)!==source.raw)throw new Error('旧源在保存期间变化，已保留旧源，须关闭旧页后核对。')
        if(source.rows.some(row=>!records.has(bridgeId(legacyKey,row))))throw new Error('目标映射缺失，未清理旧源。')
        const cleaned=rebuildWashingLedger(source.raw,source.rows.map(row=>({...row,deleted:true})))!
        localStorage.setItem(legacyKey,cleaned)
      }catch(error){migrationWarnings.push(error instanceof Error?error.message:String(error))}
    }
    if(usesProcessLedgers)hydrateDesignRevisionFcsCaches()
    channel?.postMessage({ operationId })
    return result
  } catch (error) {
    recipeActive=false;overlayEpoch++
    if(cacheBefore)restoreDesignRevisionFcsCaches(cacheBefore)
    staged = undefined; stagedRaw.clear(); saving = false; loaded = false
    throw error
  }
}
export async function executeWashingCommand(command: WashingCommand, actor: WashingActor, operationId: string, extra?: () => void, validate?: () => void, usesProcessLedgers=true) {
  let orderId: string | undefined
  return runWashingRecordCommand(() => {
    const original = readWashingState()
    const duplicate = original.actions.some(action => action.id === operationId)
    if(!duplicate) validate?.()
    const applied = applyWashingCommand(original, command, actor, operationId, new Date().toISOString())
    if(duplicate) { if(command.type==='JUDGE')extra?.(); return { orderId: applied.orderId } }
    for (const row of domainRows(applied.state)) {
      const previous = current().get(row.id)
      current().set(row.id, { id: row.id, collection: WASHING_COLLECTION, value: row.value, version: previous?.version ?? 0 })
    }
    orderId = applied.orderId
    extra?.()
    return { orderId }
  }, operationId, washingCommandIntent(command, actor),usesProcessLedgers)
}
/** Explicit adoption, called only from a business save, never from ordinary reads. */
export function adoptWashingLedgerRows(key: string, raw: string | null, matches: (row: ProcessLedgerRow) => boolean): void {
  if (!staged) throw new Error('仅允许在明确业务保存中切换旧记录。')
  try{const old=localStorage.getItem(key);if(old){const rows=splitWashingLedger(old).filter(matches);if(rows.length)adoptions.set(key,{raw:old,rows})}}catch(error){if((error as {name?:string}).name!=='SecurityError')throw error}
  for (const row of splitWashingLedger(raw).filter(matches)) {
    const id = bridgeId(key, row)
    guards.add(id)
    if (!staged.has(id)) staged.set(id, { id, collection: WASHING_BRIDGE_COLLECTION, value: { ...row, legacyKey: key }, version: 0 })
  }
  overlayEpoch++
}

export function washingCommandIntent(command: WashingCommand, actor: WashingActor): string {
 return JSON.stringify({ command: command.type === 'JUDGE' ? { ...command, source: { id: command.source.id, revision: command.source.revision } } : command, actor })
}
export function guardWashingLedger(key: string, path: string, id: string): void { guards.add(bridgeId(key,{path,key:id,value:null,tuple:true})) }
export function isWashingCommandStaging() { return !!staged }

export function washingLedgerSnapshot(key: string): string | null { return washingLedgerSnapshots().get(key) ?? null }

export async function withWashingRecords(render:()=>string) { await import('./fabric-washing.ts'); await ensureWashingRecords(); return render() }

async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
