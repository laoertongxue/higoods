/** 本次裁后动作的记录级持久化。旧同步领域可在提交前计算，事务只做版本核对和逐记录写入。 */
export const CUTTING_RECORD_DB = 'higood-cutting-records-v1'
export interface CuttingStoredRecord<T = unknown> { id: string; collection: string; value: T }
export interface CuttingRecordSnapshot { revision: number; records: CuttingStoredRecord[] }
export interface CuttingRecordChange { puts: CuttingStoredRecord[]; deletes?: string[] }
export interface CuttingStoredCommand { id: string; intent: string; result: unknown; at: string }
const STORES = ['records', 'commands', 'meta', 'files'] as const
let connection: Promise<IDBDatabase> | null = null

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('本机记录读取失败。'))
  })
}
function completion(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || new Error('尚未保存：本次操作已撤回，请重试。'))
    tx.onerror = () => { /* abort 是最终结果；单个 request 成功不等于保存成功。 */ }
  })
}
export function openCuttingRecordDatabase(): Promise<IDBDatabase> {
  if (connection) return connection
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('用户数据无法读取／保存：当前浏览器不支持本地数据库。')); return }
    const request = indexedDB.open(CUTTING_RECORD_DB, 1)
    let blocked = false
    request.onupgradeneeded = () => {
      for (const store of STORES) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' })
    }
    request.onerror = () => reject(new Error(`用户数据无法读取／保存：${request.error?.message || '本地数据库打开失败'}。请保留现有数据后重试。`))
    request.onblocked = () => { blocked = true; reject(new Error('本地数据升级正在等待旧页面关闭。请关闭其他 HiGood 标签页后重试，不要清除网站数据。')) }
    request.onsuccess = () => {
      const db = request.result
      if (blocked) { db.close(); return }
      db.onversionchange = () => { db.close(); connection = null; window.dispatchEvent(new CustomEvent('cutting-record-versionchange')) }
      resolve(db)
    }
  }).catch(error => { connection = null; throw error })
  return connection
}
export async function readCuttingRecords(): Promise<CuttingRecordSnapshot> {
  const db = await openCuttingRecordDatabase()
  const tx = db.transaction(['records', 'meta'], 'readonly'); const done = completion(tx)
  const [records, revision] = await Promise.all([
    requestValue(tx.objectStore('records').getAll()) as Promise<CuttingStoredRecord[]>,
    requestValue(tx.objectStore('meta').get('revision')),
  ])
  await done
  return { records, revision: revision?.value || 0 }
}
export async function readCuttingCommand(id: string): Promise<CuttingStoredCommand | undefined> {
  const db = await openCuttingRecordDatabase(); const tx = db.transaction('commands', 'readonly'); const done = completion(tx)
  const result = await requestValue(tx.objectStore('commands').get(id)); await done; return result
}

/** 事务中的 command 与 revision 检查同时防止重放、抢票、旧页面静默覆盖。 */
export async function commitCuttingRecords<T>(input: {
  revision: number; change: CuttingRecordChange; command: CuttingStoredCommand & { result: T }; assertSourcesCurrent?: () => void
}): Promise<{ result: T; revision: number; replayed: boolean }> {
  if (!input.command.id || !input.command.intent) throw new Error('保存失败：操作标识缺失。')
  if (new Set(input.change.puts.map(record => record.id)).size !== input.change.puts.length) throw new Error('保存失败：记录编号重复。')
  const db = await openCuttingRecordDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['records', 'commands', 'meta'], 'readwrite')
    let failure: Error | null = null; let replayed = false; let revision = input.revision; let result = input.command.result
    const abort = (error: Error) => { failure = error; tx.abort() }
    tx.onabort = () => reject(failure || tx.error || new Error('尚未保存：本次操作已撤回，请重试。'))
    tx.onerror = () => {}
    tx.oncomplete = () => {
      // 通知只在 complete 后发布；其他页收到通知需重新读取，不能接受旧内存继续写入。
      if (!replayed && typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(CUTTING_RECORD_DB); channel.postMessage({ revision }); channel.close()
      }
      resolve({ result, revision, replayed })
    }
    const commandRequest = tx.objectStore('commands').get(input.command.id)
    commandRequest.onsuccess = () => {
      const previous = commandRequest.result as CuttingStoredCommand | undefined
      if (previous) {
        if (previous.intent !== input.command.intent) { abort(new Error('本次确认编号已用于不同内容，请重新核对。')); return }
        result = previous.result as T; replayed = true
        const revisionRequest = tx.objectStore('meta').get('revision')
        revisionRequest.onsuccess = () => { revision = revisionRequest.result?.value || 0 }
        return
      }
      const revisionRequest = tx.objectStore('meta').get('revision')
      revisionRequest.onsuccess = () => {
        if ((revisionRequest.result?.value || 0) !== input.revision) {
          abort(new Error('其他页面已更新票据或交出记录。本次未保存，请刷新并重新核对后确认。')); return
        }
        try {
          input.assertSourcesCurrent?.()
          for (const record of input.change.puts) tx.objectStore('records').put(record)
          for (const id of input.change.deletes || []) tx.objectStore('records').delete(id)
          tx.objectStore('commands').add(input.command)
          revision = input.revision + 1
          tx.objectStore('meta').put({ id: 'revision', value: revision })
        } catch (error) { abort(error instanceof Error ? error : new Error(String(error))) }
      }
    }
  })
}
export function diffCuttingRecords(before: CuttingStoredRecord[], after: CuttingStoredRecord[]): CuttingRecordChange {
  const previous = new Map(before.map(record => [record.id, record]))
  const next = new Map(after.map(record => [record.id, record]))
  return { puts: after.filter(record => JSON.stringify(previous.get(record.id)) !== JSON.stringify(record)),
    deletes: before.filter(record => !next.has(record.id)).map(record => record.id) }
}

export interface CuttingRecordBackup {
  format: 'higood-cutting-record-backup'; version: 1; exportedAt: string
  records: CuttingStoredRecord[]; commands: CuttingStoredCommand[]; files: Array<{ id: string; blob: Blob }>
}
export async function exportCuttingRecordBackup(): Promise<CuttingRecordBackup> {
  const db = await openCuttingRecordDatabase(); const tx = db.transaction(['records', 'commands', 'files'], 'readonly'); const done = completion(tx)
  const [records, commands, files] = await Promise.all(['records', 'commands', 'files'].map(store => requestValue(tx.objectStore(store).getAll())))
  await done
  return { format: 'higood-cutting-record-backup', version: 1, exportedAt: new Date().toISOString(), records, commands, files }
}
export function validateCuttingRecordBackup(value: unknown): asserts value is CuttingRecordBackup {
  const data = value as CuttingRecordBackup
  if (!data || data.format !== 'higood-cutting-record-backup' || data.version !== 1
    || !Array.isArray(data.records) || !Array.isArray(data.commands) || !Array.isArray(data.files)) throw new Error('备份格式或版本不正确，未改动现有数据。')
  for (const entries of [data.records, data.commands, data.files]) {
    if (entries.some(row => !row || typeof row.id !== 'string' || !row.id) || new Set(entries.map(row => row.id)).size !== entries.length) throw new Error('备份包含无效或重复编号，未改动现有数据。')
  }
  if (data.records.some(row => typeof row.collection !== 'string' || !row.collection || row.value === undefined)
    || data.commands.some(row => typeof row.intent !== 'string' || !row.intent)
    || data.files.some(row => !(row.blob instanceof Blob))) throw new Error('备份内容不完整，未改动现有数据。')
  const tickets = new Map(data.records.filter(row => row.collection === 'replacement-tickets').map(row => [String((row.value as { id?: string }).id), row.value as Record<string, unknown>]))
  if (new Set([...tickets.values()].map(ticket => ticket.ticketNo)).size !== tickets.size) throw new Error('备份包含重复换片布票号。')
  const handoverIds = new Set(data.records.filter(row => row.collection === 'cutting-events').map(row => (row.value as { refs?: { handoverRecordId?: string } }).refs?.handoverRecordId).filter(Boolean))
  const receivedTickets = new Set<string>()
  const printedIds = new Set<string>()
  for (const row of data.records) {
    const value = row.value as Record<string, unknown>
    if (!value || typeof value !== 'object') throw new Error('备份记录格式错误。')
    if (row.collection === 'replacement-tickets') {
      const material = value.material as Record<string, unknown> | undefined
      if (row.id !== `replacement-tickets:${value.id}` || !value.id || !String(value.ticketNo || '').startsWith('HPB/')
        || value.length !== 5 || value.unit !== 'Yard' || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1
        || !value.productionOrderId || !value.assignmentKey || !material?.key || !material.code || !material.name) throw new Error('备份换片布票身份或 5 Yard 数量不正确。')
    } else if (row.collection === 'replacement-prints') {
      if (!tickets.has(String(value.ticketId)) || !value.commandId || !value.printedAt || !value.printedBy) throw new Error('备份打印记录缺少关联原票或确认信息。')
      printedIds.add(String(value.ticketId))
    } else if (row.collection === 'cutting-events') {
      if (row.id !== `cutting-event:${value.eventId}` || !value.eventType || !value.refs || !value.payload) throw new Error('备份裁床动作记录不完整。')
    }
  }
  for (const row of data.records.filter(row => row.collection === 'replacement-receipts')) {
    const receipt = row.value as Record<string, unknown>; const ticket = receipt.ticket as Record<string, unknown> | undefined
    if (!ticket || !tickets.has(String(ticket.id)) || !printedIds.has(String(ticket.id)) || !receipt.taskId || !receipt.receiverFactoryId
      || !receipt.handoverRecordId || !handoverIds.has(String(receipt.handoverRecordId)) || ticket.length !== 5 || ticket.unit !== 'Yard') throw new Error('备份交出记录缺少原票、打印确认、交出事件或接收任务。')
    const original = tickets.get(String(ticket.id))!
    const material = ticket.material as Record<string, unknown> | undefined
    const originalMaterial = original.material as Record<string, unknown>
    if (['ticketNo', 'productionOrderId', 'productionOrderNo', 'cuttingFactoryId', 'assignmentKey', 'sequence', 'length', 'unit']
      .some(field => ticket[field] !== original[field]) || !material
      || ['key', 'code', 'name', 'color', 'imageUrl'].some(field => material[field] !== originalMaterial[field])) {
      throw new Error('备份交出回执与关联原票内容不一致，未恢复。')
    }
    if (receivedTickets.has(String(ticket.id))) throw new Error('备份同一张换片布票存在重复交出。')
    receivedTickets.add(String(ticket.id))
  }
}

/** 恢复仅合并完全相同或不存在的记录；冲突整批中止，不覆盖、清空用户数据。 */
export async function restoreCuttingRecordBackup(data: unknown): Promise<void> {
  validateCuttingRecordBackup(data)
  const expectedRevision = (await readCuttingRecords()).revision
  const existing = await exportCuttingRecordBackup()
  const sameFiles = new Set<string>()
  for (const file of data.files) {
    const previous = existing.files.find(item => item.id === file.id)
    if (!previous) continue
    if (previous.blob.size !== file.blob.size || previous.blob.type !== file.blob.type) throw new Error('备份附件编号冲突，未恢复。')
    const [left, right] = await Promise.all([previous.blob.arrayBuffer(), file.blob.arrayBuffer()])
    const rightBytes = new Uint8Array(right)
    if (!new Uint8Array(left).every((byte, index) => byte === rightBytes[index])) throw new Error('备份附件内容冲突，未恢复。')
    sameFiles.add(file.id)
  }
  const db = await openCuttingRecordDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...STORES], 'readwrite'); let failure: Error | null = null
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(failure || tx.error || new Error('恢复未保存，原数据保持不变。')); tx.onerror = () => {}
    const rejectConflict = () => { if (failure) return; failure = new Error('备份与本机已有记录冲突，整批恢复已撤回，请主管核对备份版本。'); tx.abort() }
    for (const name of ['records', 'commands', 'files'] as const) {
      for (const row of data[name]) {
        const request = tx.objectStore(name).get(row.id)
        request.onsuccess = () => {
          if (failure) return
          if (request.result) {
            if (name === 'files' ? !sameFiles.has(row.id) : JSON.stringify(request.result) !== JSON.stringify(row)) rejectConflict()
          } else tx.objectStore(name).add(row)
        }
      }
    }
    const revisionRequest = tx.objectStore('meta').get('revision')
    revisionRequest.onsuccess = () => {
      if (failure) return
      if ((revisionRequest.result?.value || 0) !== expectedRevision) { rejectConflict(); return }
      tx.objectStore('meta').put({ id: 'revision', value: expectedRevision + 1 })
    }
  })
}
