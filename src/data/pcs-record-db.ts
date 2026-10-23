import { RETIRED_WASHING_COLLECTIONS, hasRetiredWashingFacts } from './fcs/legacy-washing-removal.ts'
/** PCS record storage. Opening/reading never copies demonstration data. */
export interface PcsStoredRecord { id: string; collection: string; value: unknown; version: number; deleted?: boolean }
export interface PcsStoredFile { id: string; blob: Blob }
export interface PcsMigrationReceipt {
  id: string; sourceDigest: string; legacyKey: string; legacyDigest: string
  recordIds: string[]; completedAt: string
}
export interface PcsCommitInput {
  guards?: Array<{ id: string; expectedVersion: number }>
  puts: Array<Omit<PcsStoredRecord, 'version'> & { expectedVersion: number }>
  deletes: Array<{ id: string; expectedVersion: number }>
  files?: PcsStoredFile[]
  deleteFileIds?: string[]
  migrationReceipts?: PcsMigrationReceipt[]
  operationId: string
  intent: string
}
export interface PcsBackup { format: 'higood-pcs-records'; version: 1; records: PcsStoredRecord[]; files: PcsStoredFile[] }
const DATABASE = 'higood-pcs-records'
const stores = ['records', 'files', 'operations', 'meta']
let opening: Promise<IDBDatabase> | undefined
let activeTransactions = 0

function failure(error: unknown): Error {
  if (error instanceof Error && !(error instanceof DOMException)) return error
  const name = (error as { name?: string })?.name
  if (name === 'QuotaExceededError') return new Error('浏览器空间不足，本次未保存。请保留当前输入，空间恢复后重试。')
  return new Error(`PCS 数据未保存或无法读取，请保留当前输入后重试。${name ? `（${name}）` : ''}`)
}
function open(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('当前浏览器无法使用 IndexedDB，PCS 用户数据无法读取或保存。')); return }
    let request: IDBOpenDBRequest
    try { request = indexedDB.open(DATABASE, 4) } catch (error) { reject(failure(error)); return }
    let blocked = false
    request.onblocked = () => { blocked = true; reject(new Error('PCS 数据库升级被其他标签页阻止，请关闭旧页面后重试。')) }
    request.onupgradeneeded = event => {
      const db = request.result
      for (const name of stores) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      const records = request.transaction!.objectStore('records')
      // A new empty library can index subsequent writes without rebuilding a
      // populated archive. Legacy libraries use the bounded readonly header
      // projection below; existing v4 indexes remain usable. Both paths read
      // the same original records, with no additional persisted facts.
      for(const field of ['status','qcTaskNo','productionOrderId','productionOrderNo']){
        const old='lookup:'+field
        if(records.indexNames.contains(old))records.deleteIndex(old)
      }
      if(event.oldVersion===0 && !records.indexNames.contains('lookup:qualityHeader'))records.createIndex('lookup:qualityHeader',
        ['collection','value.status','value.qcTaskNo','value.productionOrderId','value.productionOrderNo'])
      const operations = request.transaction!.objectStore('operations')
      if (!operations.indexNames.contains('createdAt')) operations.createIndex('createdAt', 'createdAt')
    }
    request.onerror = () => reject(failure(request.error))
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); opening = undefined }
      if (blocked) db.close(); else resolve(db)
    }
  }).catch(error => { opening = undefined; throw error })
  return opening
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function transaction<T>(mode: IDBTransactionMode, action: (tx: IDBTransaction) => Promise<T>, actionCommits = false): Promise<T> {
  const db = await open()
  activeTransactions++
  try {
    const tx = db.transaction(stores, mode)
    let original: unknown
    const completed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(original ?? tx.error ?? new Error('PCS 保存已中止，原有数据保持不变，请重试。'))
      tx.onerror = () => { /* onabort is the transaction-wide outcome */ }
    })
    // Attach immediately: request failure may abort before the action finishes.
    completed.catch(() => undefined)
    try {
      const value = await action(tx)
      if (!actionCommits) tx.commit?.()
      await completed
      return value
    } catch (error) {
      original = error
      try { tx.abort() } catch { /* already complete/aborted */ }
      await completed.catch(() => undefined)
      throw failure(error)
    }
  } finally {
    activeTransactions--
    if (!activeTransactions) { db.close(); opening = undefined }
  }
}
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function checkVersion(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('PCS 记录版本无效。') }
/** Explicit references must resolve; bare IDs are also recognized for deletion protection. */
export function pcsFileReferences(value: unknown, knownIds: Set<string> = new Set(), validateFileBytes = true): Set<string> {
  const references = new Set<string>(); const visited = new Set<object>()
  const recognizeBareIds = knownIds.size > 0
  function walk(item: unknown) {
    if (typeof item === 'string') {
      const first = item.charCodeAt(0)
      if (validateFileBytes && (first === 100 || first === 68) && /^data:.*;base64,/i.test(item)) throw new Error('PCS 附件必须以原始 Blob 保存，不能保存 Base64 文件。')
      if (first === 112 && item.startsWith('pcs-file:')) references.add(item.slice(9))
      else if (recognizeBareIds && knownIds.has(item)) references.add(item)
    } else if (item && typeof item === 'object' && !visited.has(item)) {
      // Only ordinary JSON arrays are reference-free leaves. Custom iterators
      // still pass through the original traversal, including byte validation.
      if (Array.isArray(item) && item.length === 0 && Object.getPrototypeOf(item) === Array.prototype
        && !Object.hasOwn(item, Symbol.iterator) && !Object.hasOwn(item, 'fileId')) {
        let plainEmpty = true
        for (const key in item) if (Object.hasOwn(item, key)) { plainEmpty = false; break }
        if (plainEmpty) return
      }
      visited.add(item)
      if (item instanceof Blob) { if (validateFileBytes) throw new Error('请将 PCS 附件保存到文件仓库，业务记录只保留文件引用。'); return }
      const record = item as Record<string, unknown>
      const staticFile = record.fileStorage === 'static' && typeof record.dataUrl === 'string' && record.dataUrl.startsWith('/')
      if (!staticFile && Object.hasOwn(record, 'fileId') && typeof record.fileId === 'string' && record.fileId) references.add(record.fileId)
      if (Array.isArray(item)) {
        for (const child of item) {
          if (typeof child === 'string') {
            const first = child.charCodeAt(0)
            if (recognizeBareIds || first === 112 || (validateFileBytes && (first === 100 || first === 68))) walk(child)
          } else if (child && typeof child === 'object') walk(child)
        }
        return
      }
      // Avoid allocating an entries array and repeating static metadata checks
      // for each field of every imported row. The reference/byte rules are unchanged.
      for (const childKey in record) {
        if (!Object.hasOwn(record, childKey)) continue
        if (childKey === 'fileId' && staticFile) continue
        const child = record[childKey]
        if (typeof child === 'string') {
          const first = child.charCodeAt(0)
          if (recognizeBareIds || first === 112 || (validateFileBytes && (first === 100 || first === 68))) walk(child)
        } else if (child && typeof child === 'object') walk(child)
      }
    }
  }
  walk(value); return references
}
function checkFiles(files: PcsStoredFile[]) {
  const ids = new Set<string>()
  for (const file of files) {
    if (!nonempty(file.id) || !(file.blob instanceof Blob) || ids.has(file.id)) throw new Error('PCS 附件格式或文件编号无效、重复。')
    ids.add(file.id)
  }
}
export interface PcsRecordNativeLookup {
 ids(prefix:string):Promise<string[]>
 idsByField(field:'status'|'qcTaskNo'|'productionOrderId'|'productionOrderNo',collection:string,value:string):Promise<string[]>
 records(ids:readonly string[]):Promise<PcsStoredRecord[]>
}
export interface PcsRecordReadSelection {
 /** A complete encoded-record prefix; only this range is chosen by native keys. */
 excludedPrefix?:string
 retain(row:PcsStoredRecord):boolean
 additionalIds(retained:readonly PcsStoredRecord[],lookup:PcsRecordNativeLookup):readonly string[]|Promise<readonly string[]>
}
export async function readPcsRecords(collections?: readonly string[], selection?:PcsRecordReadSelection): Promise<{ records: PcsStoredRecord[]; files: PcsStoredFile[]; migrations: PcsMigrationReceipt[]; referenceFreeValues?: WeakSet<object> }> {
  return transaction('readonly', async tx => {
    const recordStore = tx.objectStore('records'), fileStore = tx.objectStore('files')
    // IDs are namespaced by the registered collection. The existing primary-key
    // range reads only that namespace, without a schema upgrade or full scan.
    const selected = collections?.length ? [...new Set(collections)] : undefined
    const records:PcsStoredRecord[]=[]
    const references = new Set<string>()
    const referenceFreeValues = new WeakSet<object>()
    const metadataRequest=result(tx.objectStore('meta').getAll())
    const append=(batch:PcsStoredRecord[],applySelection=true)=>{
      const retained=selection && applySelection ? batch.filter(row=>selection.retain(row)) : batch
      records.push(...retained)
      if(selected)for(const row of retained)if(!row.deleted){
        try{
          const ids=pcsFileReferences(row.value)
          for(const id of ids)references.add(id)
          if(!ids.size && row.value && typeof row.value==='object'){
            referenceFreeValues.add(row.value)
            const data=(row.value as {data?:unknown}).data
            if(data && typeof data==='object')referenceFreeValues.add(data)
          }
        }catch{ /* Collection hydration retains its original validation boundary. */ }
      }
    }
    const ranges=selected?.flatMap(key=>{
      const excluded=selection?.excludedPrefix
      if(!excluded)return [IDBKeyRange.bound(key+'/',key+'0',false,true)]
      if(!excluded.startsWith(key+'/') || !excluded.endsWith('/'))throw Error('原记录读取范围不一致。')
      return [IDBKeyRange.bound(key+'/',excluded,false,true),IDBKeyRange.bound(excluded.slice(0,-1)+'0',key+'0',false,true)]
    })
    const firstReads=ranges?.map(range=>result(recordStore.getAll(range,1024)) as Promise<PcsStoredRecord[]>)
    firstReads?.forEach(read=>read.catch(()=>undefined))
    if(ranges)for(const [index,range] of ranges.entries()){
      let pending:Promise<PcsStoredRecord[]>|undefined=firstReads![index]
      while(pending){
        const batch:PcsStoredRecord[]=await pending
        pending=batch.length===1024 ? result(recordStore.getAll(IDBKeyRange.bound(batch[batch.length-1].id,range.upper,true,range.upperOpen),1024)) : undefined
        pending?.catch(()=>undefined)
        append(batch)
      }
    }else append(await result(recordStore.getAll()))
    if(selection){
      const retainedIds=new Set(records.map(row=>row.id))
      const headerReads=new Map<string,Promise<Array<{id:string;key:IDBValidKey[]}>>>()
      const headers=(collection:string)=>{
        let reading=headerReads.get(collection)
        if(!reading){
          if(!recordStore.indexNames.contains('lookup:qualityHeader')){
            reading=(async()=>{
              const prefix=selection.excludedPrefix
              if(!prefix || !prefix.endsWith('/'))throw Error('原记录读取范围不完整。')
              const upper=prefix.slice(0,-1)+'0',rows:Array<{id:string;key:IDBValidKey[]}>=[]
              let pending:Promise<PcsStoredRecord[]>|undefined=result(recordStore.getAll(IDBKeyRange.bound(prefix,upper,false,true),256))
              while(pending){
                const batch:PcsStoredRecord[]=await pending
                pending=batch.length===256?result(recordStore.getAll(IDBKeyRange.bound(batch[batch.length-1].id,upper,true,true),256)):undefined
                pending?.catch(()=>undefined)
                for(const row of batch){
                  if(row.collection!==collection)continue
                  const value=row.value as Record<string,IDBValidKey>|null
                  const key=[row.collection,value?.status,value?.qcTaskNo,value?.productionOrderId,value?.productionOrderNo]
                  // Native compound indexes omit incomplete/invalid keys. Match
                  // that behavior; the caller separately retains missing facts.
                  try{indexedDB.cmp(key as IDBValidKey[],key as IDBValidKey[])}catch{continue}
                  rows.push({id:row.id,key:key as IDBValidKey[]})
                }
              }
              return rows
            })()
          }else{
          reading=new Promise<Array<{id:string;key:IDBValidKey[]}>>((resolve,reject)=>{
            const rows:Array<{id:string;key:IDBValidKey[]}>=[]
            const request=recordStore.index('lookup:qualityHeader').openKeyCursor(IDBKeyRange.bound([collection],[collection,[]]))
            request.onerror=()=>reject(request.error)
            request.onsuccess=()=>{
              const cursor=request.result
              if(!cursor){resolve(rows);return}
              if(typeof cursor.primaryKey!=='string' || !Array.isArray(cursor.key)){reject(Error('原记录索引身份不完整。'));return}
              rows.push({id:cursor.primaryKey,key:cursor.key});cursor.continue()
            }
          })
          }
          headerReads.set(collection,reading)
        }
        return reading
      }
      const fieldPosition={status:1,qcTaskNo:2,productionOrderId:3,productionOrderNo:4} as const
      const lookup:PcsRecordNativeLookup={
        ids:async prefix=>{
          if(!prefix.endsWith('/'))throw Error('原记录索引范围不完整。')
          return await result(recordStore.getAllKeys(IDBKeyRange.bound(prefix,prefix.slice(0,-1)+'0',false,true))) as string[]
        },
        idsByField:async(field,collection,value)=>(await headers(collection)).filter(row=>row.key[fieldPosition[field]]===value).map(row=>row.id),
        records:async ids=>(await Promise.all([...new Set(ids)].map(id=>result(recordStore.get(id)) as Promise<PcsStoredRecord|undefined>))).filter((row):row is PcsStoredRecord=>!!row),
      }
      const ids=[...new Set(await selection.additionalIds(records,lookup))].filter(id=>!retainedIds.has(id))
      const additional=await Promise.all(ids.map(id=>result(recordStore.get(id)) as Promise<PcsStoredRecord|undefined>))
      append(additional.filter((row):row is PcsStoredRecord=>!!row).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),false)
    }
    const metadata=await metadataRequest
    const files: PcsStoredFile[] = selected
      ? (await Promise.all([...references].map(id => result(fileStore.get(id)) as Promise<PcsStoredFile | undefined>))).filter((file): file is PcsStoredFile => file !== undefined)
      : await result(fileStore.getAll())
    return { records, files, migrations: metadata.filter(item => item.kind === 'legacy-verified').map(item => item.value), referenceFreeValues }
  })
}
/** Narrow readonly projections for quality lists: native values remain detached,
 * and only the requested fields survive. No attachment scan, seed copy or write. */
export async function readPcsRecordProjection<T>(selectors:ReadonlyArray<{prefix:string}|{id:string}>, project:(row:PcsStoredRecord)=>T|null):Promise<T[]> {
  return transaction('readonly',async tx=>{
    const store=tx.objectStore('records'), values:T[]=[]
    const apply=(row:PcsStoredRecord)=>{const value=project(row);if(value!==null)values.push(value)}
    // Keep the complete consistent transaction, but release each native batch
    // after its projection. A list must not retain thousands of frozen trees.
    // Selector order remains significant: metadata precedes dependent rows.
    for(const selector of selectors){
      if('id' in selector){const row=await result(store.get(selector.id));if(row)apply(row);continue}
      let lower=selector.prefix,openLower=false
      const upper=selector.prefix+'\uffff'
      while(true){
        const rows=await result(store.getAll(IDBKeyRange.bound(lower,upper,openLower,false),256)) as PcsStoredRecord[]
        for(const row of rows)apply(row)
        if(rows.length<256)break
        lower=rows[rows.length-1].id;openLower=true
      }
    }
    return values
  })
}

/** Saving a few references must not deserialize every unrelated business record. */
export async function readPcsFiles(ids: readonly string[]): Promise<PcsStoredFile[]> {
  if (!ids.length) return []
  return transaction('readonly', async tx => {
    const files = tx.objectStore('files')
    const values = await Promise.all([...new Set(ids)].map(id => result(files.get(id)) as Promise<PcsStoredFile | undefined>))
    return values.filter((file): file is PcsStoredFile => file !== undefined)
  })
}
function validateCommit(input: PcsCommitInput): Set<string> {
  if (!nonempty(input.operationId) || !nonempty(input.intent)) throw new Error('PCS 保存缺少操作编号或操作说明。')
  const ids = new Set<string>()
  for (const guard of input.guards ?? []) {
    if (!nonempty(guard.id)) throw new Error('关联资料校验编号无效。')
    checkVersion(guard.expectedVersion); ids.add(guard.id)
  }
  for (const record of [...input.puts, ...input.deletes]) {
    if (!nonempty(record.id) || ids.has(record.id)) throw new Error('PCS 保存记录编号无效或重复。')
    ids.add(record.id); checkVersion(record.expectedVersion)
  }
  for (const record of input.puts) {
    if (!nonempty(record.collection)) throw new Error('PCS 记录缺少业务分类。')
    if ((RETIRED_WASHING_COLLECTIONS as readonly string[]).includes(record.collection)) throw new Error('旧洗水业务已经退役，不能再次写入或恢复。')
    pcsFileReferences(record.value)
  }
  checkFiles(input.files ?? [])
  for (const receipt of input.migrationReceipts ?? []) {
    if (!nonempty(receipt.id) || !nonempty(receipt.sourceDigest) || !nonempty(receipt.legacyKey) || !nonempty(receipt.legacyDigest) || !Array.isArray(receipt.recordIds)) throw new Error('旧资料核对记录不完整，源资料已保留。')
  }
  return ids
}
async function hashIntent(intent: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(intent)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
async function pruneOperations(operations: IDBObjectStore, count: number): Promise<void> {
  if (count <= 1000) return
  const [expired, allKeys] = await Promise.all([
    result(operations.index('createdAt').getAllKeys(undefined, count - 1000)),
    result(operations.getAllKeys()),
  ])
  const expiredIds = new Set(expired as string[])
  // Primary keys from one import are usually adjacent. Delete only contiguous
  // expired runs in primary-key order, splitting at EVERY retained key. Both
  // reads and range deletes share the write transaction, so a newer receipt
  // can never be removed just because its ID lies between two expired IDs.
  let first: IDBValidKey | undefined, last: IDBValidKey | undefined
  const removals: Promise<unknown>[] = []
  const flush = () => {
    if (first !== undefined) removals.push(result(operations.delete(IDBKeyRange.bound(first, last!))))
    first = last = undefined
  }
  for (const key of allKeys) {
    if (typeof key === 'string' && expiredIds.has(key)) { first ??= key; last = key }
    else flush()
  }
  flush()
  await Promise.all(removals)
}

/** Each new parent group is atomic. Bounded cohorts share a transaction on the
 * success path; failed groups are isolated after rollback. Unique-key adds
 * perform the zero-version check without a read round trip for every new row.
 * Existing records, deletions and new attachments use the ordinary command. */
export async function commitPcsNewRecordGroups(inputs: PcsCommitInput[]): Promise<Array<{ ok: true } | { ok: false; message: string }>> {
  const prepared = await Promise.all(inputs.map(async input => {
    try {
      validateCommit(input)
      if (input.guards?.length || !input.puts.length || input.puts.some(row => row.expectedVersion !== 0) || input.deletes.length || input.files?.length || input.deleteFileIds?.length || input.migrationReceipts?.length) throw new Error('此导入操作只支持全新记录及已保存的文件引用。')
      return { input, intentHash: await hashIntent(input.intent), references: [...new Set(input.puts.flatMap(row => [...pcsFileReferences(row.value)]))] }
    } catch (error) { return { error: failure(error).message } }
  }))
  type Prepared = Extract<typeof prepared[number], { input: PcsCommitInput }>
  type Outcome = { ok: true } | { ok: false; message: string }
  const outcomes: Outcome[] = prepared.map(item => 'error' in item ? { ok: false, message: item.error! } : { ok: false, message: '本组未保存。' })
  const valid = prepared.flatMap((item, index) => 'error' in item ? [] : [{ ...item, index }])
  // A bounded cohort reduces database round trips. Every parent group stays
  // atomic. If any request fails, the whole cohort rolls back first; exclude
  // exactly that failed group, then save the unaffected groups. No partial root
  // or operation receipt is ever published, and a failed group is not retried.
  async function saveCohort(items: Array<Prepared & { index: number }>): Promise<void> {
    let failed: { index: number; error: unknown; repeatedOperation: boolean } | undefined
    const capture = (index: number, error: unknown, repeatedOperation = false) => {
      if (!failed && (error as { name?: string })?.name !== 'AbortError') failed = { index, error, repeatedOperation }
      throw error
    }
    const hasReferences = items.some(item => item.references.length > 0)
    try {
      await transaction('readwrite', async tx => {
        const requests: Promise<unknown>[] = []
        const track = (request: Promise<unknown>) => { request.catch(() => undefined); requests.push(request) }
        for (const { input, intentHash, references, index } of items) {
          try {
            track(result(tx.objectStore('operations').add({ id: input.operationId, intentHash, createdAt: new Date().toISOString() }))
              .catch(error => capture(index, error, error?.name === 'ConstraintError')))
            for (const { expectedVersion: _, ...row } of input.puts) track(result(tx.objectStore('records').add({ ...row, version: 1 }))
              .catch(error => capture(index, error?.name === 'ConstraintError' ? new Error('PCS 记录已被其他页面修改，请重新读取后再保存。') : error)))
            for (const id of references) track(result(tx.objectStore('files').getKey(id)).then(key => {
              if (key === undefined) capture(index, new Error('PCS 附件引用不完整，文件缺失，数据未保存。'))
            }).catch(error => capture(index, error)))
          } catch (error) { capture(index, error) }
        }
        // Synchronous queue errors still reach abort. With no read-dependent
        // validation, add constraints alone can finish or abort in IndexedDB.
        if (!hasReferences) tx.commit?.()
        await Promise.all(requests)
      }, !hasReferences)
      items.forEach(item => { outcomes[item.index] = { ok: true } })
    } catch (error) {
      if (!failed) { items.forEach(item => { outcomes[item.index] = { ok: false, message: failure(error).message } }); return }
      const rejected = failed as { index: number; error: unknown; repeatedOperation: boolean }
      outcomes[rejected.index] = { ok: false, message: failure(rejected.error).message }
      if (rejected.repeatedOperation) {
        const item = items.find(item => item.index === rejected.index)!
        const previous = await transaction('readonly', tx => result(tx.objectStore('operations').get(item.input.operationId))).catch(() => undefined)
        if (previous && (previous.intentHash ?? previous.intent) === (previous.intentHash ? item.intentHash : item.input.intent)) outcomes[item.index] = { ok: true }
        else if (previous) outcomes[item.index] = { ok: false, message: 'PCS 操作编号已用于其他操作，请重新读取后重试。' }
      }
      const remaining = items.filter(item => item.index !== rejected.index)
      if (remaining.length) await saveCohort(remaining)
    }
  }
  // Keep imports bounded while avoiding a separate disk commit for every few
  // dozen parents. Failure isolation above still reports each parent group.
  const cohortSize = 256
  const cohorts = Array.from({ length: Math.ceil(valid.length / cohortSize) }, (_, index) => valid.slice(index * cohortSize, (index + 1) * cohortSize))
  await Promise.all(cohorts.map(saveCohort))
  // Receipt retention is once per batch, not a full count for every group.
  // A retention failure cannot turn an already committed business group into
  // a failed save; the next ordinary/batch commit retries the same bounded trim.
  if (outcomes.some(row => row.ok)) await transaction('readwrite', async tx => {
    const operations = tx.objectStore('operations')
    await pruneOperations(operations, await result(operations.count()))
  }).catch(() => undefined)
  return outcomes
}

export async function commitPcsRecords(input: PcsCommitInput): Promise<void> {
  const ids = validateCommit(input)
  const intentHash = await hashIntent(input.intent)
  await transaction('readwrite', async tx => {
    const operations = tx.objectStore('operations')
    const previousRequest = result(operations.get(input.operationId))
    const receiptCountRequest = result(operations.count())
    const recordsStore = tx.objectStore('records'); const fileStore = tx.objectStore('files')
    const fileKeysRequest = result(fileStore.getAllKeys())
    const readRecords = input.deleteFileIds?.length
      ? result(recordsStore.getAll()) as Promise<PcsStoredRecord[]>
      : Promise.all([...ids].map(id => result(recordsStore.get(id)) as Promise<PcsStoredRecord | undefined>))
        .then(values => values.filter((record): record is PcsStoredRecord => record !== undefined))
    // Queue independent reads together while the transaction is active, instead
    // of a browser/database round trip for each class of validation.
    const [previous, records, fileKeys, receiptCount] = await Promise.all([previousRequest, readRecords, fileKeysRequest, receiptCountRequest])
    if (previous) {
      if ((previous.intentHash ?? previous.intent) !== (previous.intentHash ? intentHash : input.intent)) throw new Error('PCS 操作编号已用于其他操作，请重新读取后重试。')
      return
    }
    // Versions only depend on the records in this command. A full record scan
    // is needed solely when deleting files, to protect every live/history ref.
    const final = new Map(records.map(record => [record.id, record]))
    for (const guard of input.guards ?? []) {
      if ((final.get(guard.id)?.version ?? 0) !== guard.expectedVersion || final.get(guard.id)?.deleted) throw new Error('关联房间或地点已被其他页面修改，本次未保存。请重新读取后再操作。')
    }
    const knownFiles = new Set(fileKeys.map(String))
    for (const file of input.files ?? []) {
      if (knownFiles.has(file.id)) throw new Error('PCS 附件编号已存在，请复用引用或使用新编号，不能覆盖原文件。')
      knownFiles.add(file.id)
    }
    for (const record of input.puts) {
      if ((final.get(record.id)?.version ?? 0) !== record.expectedVersion) throw new Error('PCS 记录已被其他页面修改，请重新读取后再保存。')
      const prior = final.get(record.id)
      if (prior?.collection === 'fcs.factory-qc.v1' && (prior.value as any)?.kind === 'roll' && (prior.value as any)?.data?.completedAt && JSON.stringify(prior.value) !== JSON.stringify(record.value)) throw new Error('本卷已完成质检，不允许修改已完成的结果、照片或完成信息。')
      const { expectedVersion, ...stored } = record
      const next = { ...stored, version: expectedVersion + 1 }
      final.set(record.id, next); recordsStore.put(next)
    }
    for (const record of input.deletes) {
      const current = final.get(record.id)
      if ((current?.version ?? 0) !== record.expectedVersion) throw new Error('PCS 记录已被其他页面修改，请重新读取后再删除。')
      if (current?.collection === 'fcs.factory-qc.v1' && (current.value as any)?.kind === 'roll' && (current.value as any)?.data?.completedAt) throw new Error('本卷已完成质检，不允许删除已完成的检查事实。')
      const next: PcsStoredRecord = { id: record.id, collection: current?.collection ?? 'deleted', value: null, deleted: true, version: record.expectedVersion + 1 }
      final.set(record.id, next); recordsStore.put(next)
    }
    // 本次新增/修改引用必须完整；无关旧记录的问题不得阻断其他档案保存。
    // 删除仍检查全部有效引用，不能借此删除缺失资料所关联的文件。
    for (const record of input.puts) for (const id of pcsFileReferences(record.value, knownFiles)) if (!knownFiles.has(id)) throw new Error('PCS 附件引用不完整，文件缺失，数据未保存。')
    if (input.deleteFileIds?.length) {
      const references = new Set<string>()
      for (const record of final.values()) if (!record.deleted) for (const id of pcsFileReferences(record.value, knownFiles)) references.add(id)
      for (const id of input.deleteFileIds) {
        if (references.has(id)) throw new Error('PCS 附件仍被记录或历史版本引用，不能删除。')
        fileStore.delete(id)
      }
    }
    for (const file of input.files ?? []) {
      if (input.deleteFileIds?.includes(file.id)) throw new Error('同一 PCS 附件不能同时保存和删除。')
      fileStore.add(file)
    }
    for (const receipt of input.migrationReceipts ?? []) tx.objectStore('meta').put({ id: `legacy-verified:${receipt.id}`, kind: 'legacy-verified', value: receipt })
    // 最近 1000 次操作保留幂等收据；更早的重试仍受记录版本及删除标记保护。
    await pruneOperations(operations, receiptCount + 1)
    operations.add({ id: input.operationId, intentHash, createdAt: new Date().toISOString() })
  })
}
export async function cleanupUnreferencedPcsFiles(ownedPrefix?: string): Promise<number> {
  return transaction('readwrite', async tx => {
    const [records, keys] = await Promise.all([result(tx.objectStore('records').getAll()) as Promise<PcsStoredRecord[]>, result(tx.objectStore('files').getAllKeys())])
    const ids = new Set(keys.map(String)); const referenced = new Set<string>()
    for (const record of records) if (!record.deleted) for (const id of pcsFileReferences(record.value, ids)) referenced.add(id)
    let count = 0
    for (const id of ids) if ((!ownedPrefix || id.startsWith(ownedPrefix)) && !referenced.has(id)) { tx.objectStore('files').delete(id); count++ }
    return count
  })
}
export function validatePcsBackup(value: unknown): asserts value is PcsBackup {
  const backup = value as PcsBackup
  if (!backup || backup.format !== DATABASE || backup.version !== 1 || !Array.isArray(backup.records) || !Array.isArray(backup.files)) throw new Error('PCS 备份格式或版本不支持。')
  checkFiles(backup.files)
  const ids = new Set<string>(); const fileIds = new Set(backup.files.map(file => file.id))
  for (const record of backup.records) {
    if (!nonempty(record.id) || !nonempty(record.collection) || ids.has(record.id) || record.version < 1 || (record.deleted !== undefined && typeof record.deleted !== 'boolean')) throw new Error('PCS 备份记录格式或编号无效。')
    checkVersion(record.version); ids.add(record.id)
    if (!record.deleted && ((RETIRED_WASHING_COLLECTIONS as readonly string[]).includes(record.collection) || hasRetiredWashingFacts(record.value))) throw new Error('备份含已退役洗水业务资料，不能恢复旧业务。')
    for (const id of pcsFileReferences(record.value, fileIds)) if (!record.deleted && !fileIds.has(id)) throw new Error('PCS 备份缺少被引用的附件。')
  }
}
export async function exportPcsBackup(): Promise<PcsBackup> {
  const snapshot = await readPcsRecords()
  return { format: DATABASE, version: 1, ...snapshot }
}
/** Restore only into empty storage, with atomic rejection on any existing record/file. */
export async function restorePcsBackup(backup: unknown): Promise<void> {
  validatePcsBackup(backup)
  await transaction('readwrite', async tx => {
    const [records, files] = await Promise.all([result(tx.objectStore('records').count()), result(tx.objectStore('files').count())])
    if (records || files) throw new Error('PCS 当前已有本地数据，恢复已取消以防覆盖。请先导出当前数据并在空的浏览器存储中恢复。')
    for (const record of backup.records) tx.objectStore('records').add(record)
    for (const file of backup.files) tx.objectStore('files').add(file)
    tx.objectStore('meta').put({ id: 'restored', formatVersion: 1, at: new Date().toISOString() })
  })
}
