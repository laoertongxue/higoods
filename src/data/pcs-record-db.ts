/** PCS record storage. Opening/reading never copies demonstration data. */
export interface PcsStoredRecord { id: string; collection: string; value: unknown; version: number; deleted?: boolean }
export interface PcsStoredFile { id: string; blob: Blob }
export interface PcsCommitInput {
  puts: Array<Omit<PcsStoredRecord, 'version'> & { expectedVersion: number }>
  deletes: Array<{ id: string; expectedVersion: number }>
  files?: PcsStoredFile[]
  deleteFileIds?: string[]
  operationId: string
  intent: string
}
export interface PcsBackup { format: 'higood-pcs-records'; version: 1; records: PcsStoredRecord[]; files: PcsStoredFile[] }
const DATABASE = 'higood-pcs-records'
const stores = ['records', 'files', 'operations', 'meta']

function failure(error: unknown): Error {
  if (error instanceof Error && !(error instanceof DOMException)) return error
  const name = (error as { name?: string })?.name
  if (name === 'QuotaExceededError') return new Error('浏览器空间不足，PCS 数据未保存，请导出备份后释放空间并重试。')
  return new Error(`PCS 数据未保存或无法读取，请保留当前输入后重试。${name ? `（${name}）` : ''}`)
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('当前浏览器无法使用 IndexedDB，PCS 用户数据无法读取或保存。')); return }
    let request: IDBOpenDBRequest
    try { request = indexedDB.open(DATABASE, 1) } catch (error) { reject(failure(error)); return }
    let blocked = false
    request.onblocked = () => { blocked = true; reject(new Error('PCS 数据库升级被其他标签页阻止，请关闭旧页面后重试。')) }
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of stores) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
    }
    request.onerror = () => reject(failure(request.error))
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      if (blocked) db.close(); else resolve(db)
    }
  })
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function transaction<T>(mode: IDBTransactionMode, action: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await open()
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
      await completed
      return value
    } catch (error) {
      original = error
      try { tx.abort() } catch { /* already complete/aborted */ }
      await completed.catch(() => undefined)
      throw failure(error)
    }
  } finally { db.close() }
}
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function checkVersion(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('PCS 记录版本无效。') }
/** Explicit references must resolve; bare IDs are also recognized for deletion protection. */
export function pcsFileReferences(value: unknown, knownIds: Set<string> = new Set()): Set<string> {
  const references = new Set<string>(); const visited = new Set<object>()
  function walk(item: unknown, key?: string) {
    if (typeof item === 'string') {
      if (/^data:.*;base64,/i.test(item)) throw new Error('PCS 附件必须以原始 Blob 保存，不能保存 Base64 文件。')
      if (item.startsWith('pcs-file:')) references.add(item.slice(9))
      else if (key === 'fileId' && item) references.add(item)
      else if (knownIds.has(item)) references.add(item)
    } else if (item && typeof item === 'object' && !visited.has(item)) {
      visited.add(item)
      if (item instanceof Blob) throw new Error('请将 PCS 附件保存到文件仓库，业务记录只保留文件引用。')
      for (const [childKey, child] of Object.entries(item)) {
        const staticFile = (item as Record<string, unknown>).fileStorage === 'static' && typeof (item as Record<string, unknown>).dataUrl === 'string' && String((item as Record<string, unknown>).dataUrl).startsWith('/')
        if (childKey === 'fileId' && staticFile) continue
        walk(child, childKey)
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
export async function readPcsRecords(): Promise<{ records: PcsStoredRecord[]; files: PcsStoredFile[] }> {
  return transaction('readonly', async tx => {
    const [records, files] = await Promise.all([result(tx.objectStore('records').getAll()), result(tx.objectStore('files').getAll())])
    return { records, files }
  })
}
export async function commitPcsRecords(input: PcsCommitInput): Promise<void> {
  if (!nonempty(input.operationId) || !nonempty(input.intent)) throw new Error('PCS 保存缺少操作编号或操作说明。')
  const ids = new Set<string>()
  for (const record of [...input.puts, ...input.deletes]) {
    if (!nonempty(record.id) || ids.has(record.id)) throw new Error('PCS 保存记录编号无效或重复。')
    ids.add(record.id); checkVersion(record.expectedVersion)
  }
  for (const record of input.puts) {
    if (!nonempty(record.collection)) throw new Error('PCS 记录缺少业务分类。')
    pcsFileReferences(record.value)
  }
  checkFiles(input.files ?? [])
  const intentHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.intent)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  await transaction('readwrite', async tx => {
    const operations = tx.objectStore('operations')
    const previous = await result(operations.get(input.operationId))
    if (previous) {
      if ((previous.intentHash ?? previous.intent) !== (previous.intentHash ? intentHash : input.intent)) throw new Error('PCS 操作编号已用于其他操作，请重新读取后重试。')
      return
    }
    const recordsStore = tx.objectStore('records'); const fileStore = tx.objectStore('files')
    const [records, fileKeys] = await Promise.all([result(recordsStore.getAll()) as Promise<PcsStoredRecord[]>, result(fileStore.getAllKeys())])
    const final = new Map(records.map(record => [record.id, record]))
    const knownFiles = new Set(fileKeys.map(String))
    for (const file of input.files ?? []) {
      if (knownFiles.has(file.id)) throw new Error('PCS 附件编号已存在，请复用引用或使用新编号，不能覆盖原文件。')
      knownFiles.add(file.id)
    }
    for (const record of input.puts) {
      if ((final.get(record.id)?.version ?? 0) !== record.expectedVersion) throw new Error('PCS 记录已被其他页面修改，请重新读取后再保存。')
      const { expectedVersion, ...stored } = record
      const next = { ...stored, version: expectedVersion + 1 }
      final.set(record.id, next); recordsStore.put(next)
    }
    for (const record of input.deletes) {
      const current = final.get(record.id)
      if ((current?.version ?? 0) !== record.expectedVersion) throw new Error('PCS 记录已被其他页面修改，请重新读取后再删除。')
      const next: PcsStoredRecord = { id: record.id, collection: current?.collection ?? 'deleted', value: null, deleted: true, version: record.expectedVersion + 1 }
      final.set(record.id, next); recordsStore.put(next)
    }
    const references = new Set<string>()
    for (const record of final.values()) if (!record.deleted) for (const id of pcsFileReferences(record.value, knownFiles)) references.add(id)
    for (const id of references) if (!knownFiles.has(id)) throw new Error('PCS 附件引用不完整，文件缺失，数据未保存。')
    for (const id of input.deleteFileIds ?? []) {
      if (references.has(id)) throw new Error('PCS 附件仍被记录或历史版本引用，不能删除。')
      fileStore.delete(id)
    }
    for (const file of input.files ?? []) {
      if (input.deleteFileIds?.includes(file.id)) throw new Error('同一 PCS 附件不能同时保存和删除。')
      fileStore.add(file)
    }
    // 最近 1000 次操作保留幂等收据；更早的重试仍受记录版本及删除标记保护。
    const receipts = await result(operations.getAll())
    receipts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const receipt of receipts.slice(0, Math.max(0, receipts.length - 999))) operations.delete(receipt.id)
    operations.add({ id: input.operationId, intentHash, createdAt: new Date().toISOString() })
  })
}
export async function cleanupUnreferencedPcsFiles(): Promise<number> {
  return transaction('readwrite', async tx => {
    const [records, keys] = await Promise.all([result(tx.objectStore('records').getAll()) as Promise<PcsStoredRecord[]>, result(tx.objectStore('files').getAllKeys())])
    const ids = new Set(keys.map(String)); const referenced = new Set<string>()
    for (const record of records) if (!record.deleted) for (const id of pcsFileReferences(record.value, ids)) referenced.add(id)
    let count = 0
    for (const id of ids) if (!referenced.has(id)) { tx.objectStore('files').delete(id); count++ }
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
