import { ensurePcsRecordState } from '../pcs-record-runtime.ts'
import { getChannelStore } from '../pcs-channel-store-repository.ts'
import { getChannelListing, listChannelVariants } from '../pcs-channel-catalog.ts'
import { getSkuArchiveById } from '../pcs-sku-archive-repository.ts'
import { applyFeedbackCommand, canonicalFeedbackTime } from './model.ts'
import { createFeedbackSeed } from './mock.ts'
import { phase2 } from './phase2-model.ts'
import type { FeedbackCommand, FeedbackSnapshot } from './types.ts'

export const FEEDBACK_DATABASE_NAME = 'higood-product-feedback-v1'
const STORE_NAME = 'records'
type Collection = 'translations' | 'suggestions' | 'issues' | 'issueActions' | 'issuePlans' | 'issueJudgments' | 'issueReviews' | 'actionAttachments' | 'schedules' | 'tasks' | 'executions' | 'batches' | 'comments' | 'metrics' | 'logs' | 'notes' | 'historyDrafts' | 'reviewDrafts'
const collections: Collection[] = ['translations', 'suggestions', 'issues', 'issueActions', 'issuePlans', 'issueJudgments', 'issueReviews', 'actionAttachments', 'schedules', 'tasks', 'executions', 'batches', 'comments', 'metrics', 'logs', 'notes', 'historyDrafts', 'reviewDrafts']
interface StoredRecord { key: string; collection: Collection | 'meta'; value: unknown }
let dbPromise: Promise<IDBDatabase> | null = null
let snapshot: FeedbackSnapshot | null = null
let failure = ''
let readiness: Promise<void> | null = null

function database(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('当前浏览器无法读取本地资料。可以查看固定示例，业务操作尚未保存。')); return }
    const request = indexedDB.open(FEEDBACK_DATABASE_NAME, 4)
    request.onupgradeneeded = event => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      else if (event.oldVersion < 3) request.transaction!.objectStore(STORE_NAME).clear()
      if (!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments', { keyPath: 'id' })
      else if (event.oldVersion < 3) request.transaction!.objectStore('attachments').clear()
      const records = request.transaction!.objectStore(STORE_NAME)
      if (event.oldVersion === 3) {
        // Old Mock review drafts never saved these dates; keep all other records and attachments.
        const cursor = records.openCursor()
        cursor.onsuccess = () => {
          const row = cursor.result
          if (!row) return
          const record = row.value as StoredRecord, value = record.value as { draft?: boolean; nextDueDate?: string; targetDate?: string }
          if (record.collection === 'issueReviews' && value.draft && (value.nextDueDate === undefined || value.targetDate === undefined)) row.delete()
          row.continue()
        }
      }
      records.put({ key: 'meta:phase2-cutover', collection: 'meta', value: { cutover: 'feedback-phase2-v1.1-review-draft-dates' } })
    }
    request.onerror = () => reject(request.error || new Error('本地资料打开失败。'))
    request.onblocked = () => reject(new Error('其他标签页仍占用资料，请关闭旧标签页后重新读取。'))
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); dbPromise = null }; resolve(request.result) }
  }).catch(error => { dbPromise = null; throw error })
  return dbPromise
}
function project(seed: FeedbackSnapshot, records: StoredRecord[]): FeedbackSnapshot {
  const result = phase2(structuredClone(seed))
  for (const row of records) {
    if (row.key === 'meta:phase2-cutover') continue
    if (row.collection === 'meta') { const meta = row.value as Pick<FeedbackSnapshot, 'version' | 'asOf'>; result.version = meta.version; result.asOf = meta.asOf; continue }
    const values = result[row.collection] as Array<{ id: string }>, value = row.value as { id: string }, index = values.findIndex(v => v.id === value.id)
    if (index >= 0) values[index] = structuredClone(value); else values.push(structuredClone(value))
  }
  return phase2(result)
}
function read(db: IDBDatabase, seed: FeedbackSnapshot): Promise<FeedbackSnapshot> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly'), request = transaction.objectStore(STORE_NAME).getAll()
    let result: FeedbackSnapshot
    request.onsuccess = () => { try { result = project(seed, request.result) } catch (error) { reject(error); transaction.abort() } }
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error || new Error('本地资料读取失败，原数据已保留。'))
    transaction.onabort = () => reject(transaction.error || new Error('本地资料读取中断。'))
  })
}
export async function ensureFeedbackState(): Promise<void> {
  if (readiness) return readiness
  readiness = (async () => {
    await ensurePcsRecordState(['higood-pcs-channel-store-v1', 'higood-pcs-channel-catalog-v1', 'higood-pcs-config-workspace-store-v1', 'higood-pcs-material-config-v1', 'higood-pcs-technical-data-version-store-v5'])
    const seed = createFeedbackSeed()
    try { snapshot = await read(await database(), seed); failure = '' } catch (error) { failure = error instanceof Error ? error.message : String(error); snapshot ||= seed }
  })().finally(() => { readiness = null })
  return readiness
}
export function getFeedbackSnapshot(): FeedbackSnapshot { return structuredClone(snapshot || createFeedbackSeed()) }
export function getFeedbackStorageFailure(): string { return failure }
function validateReferences(command: FeedbackCommand, current: FeedbackSnapshot): void {
  if (command.type === 'create-history-plan') for (const task of command.tasks) validateReferences({ ...command, type: 'create-history', task }, current)
  if (command.type === 'save-history-draft' && !getChannelStore(command.draft.storeId)) throw new Error('历史计划草稿的店铺档案不存在。')
  if (command.type === 'save-schedule') { const store = getChannelStore(command.schedule.storeId); if (!store || !['tiktok', 'shopee'].includes(store.channelCode)) throw new Error('请选择已有 TikTok 或 Shopee 店铺档案。') }
  if (command.type === 'create-history') { if (!getChannelStore(command.task.storeId)) throw new Error('历史任务的店铺档案不存在。'); for (const id of command.task.listingIds) if (getChannelListing(id)?.storeId !== command.task.storeId) throw new Error('目标链接必须属于所选店铺。') }
  if (command.type === 'correct-association') {
    const a = command.association, listing = getChannelListing(a.listingId), comment = current.comments.find(c => c.id === command.commentId)
    if (a.sourceEventAt) a.sourceEventAt = canonicalFeedbackTime(a.sourceEventAt)
    if (!listing || listing.styleId !== a.styleId || listing.storeId !== comment?.raw.storeId || listing.platformProductId !== comment.raw.platformProductId) throw new Error('目标款式和链接必须对应原评论所在店铺与平台商品 ID。')
    if (a.skuId) { const sku = getSkuArchiveById(a.skuId), variants = listChannelVariants(listing.id).filter(v => v.platformVariantId === comment.raw.platformVariantId), mapping = variants.flatMap(v => [...v.mappingHistory].filter(h => h.effectiveAt <= a.sourceEventAt!).sort((x, y) => y.effectiveAt.localeCompare(x.effectiveAt)).slice(0, 1)).find(h => h.internalSkuId === a.skuId && h.version === a.mappingVersion); if (!sku || sku.styleId !== a.styleId || !mapping) throw new Error('所选购买规格缺少适用于来源事件时间生效区间的映射记录。') }
  }
}
export async function runFeedbackCommand(command: FeedbackCommand, files: Array<{ id: string; blob: Blob }> = []): Promise<void> {
  await ensureFeedbackState()
  if (failure) throw new Error(failure)
  const db = await database(), seed = createFeedbackSeed()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, 'attachments'], 'readwrite'), store = tx.objectStore(STORE_NAME), request = store.getAll()
    let caught: unknown = null
    request.onsuccess = () => {
      try {
        // State, expected versions and operation identity are checked inside the committing transaction.
        const current = project(seed, request.result)
        validateReferences(command, current)
        const next = phase2(applyFeedbackCommand(current, command))
        for (const file of files) { const metadata = next.actionAttachments.find(a => a.id === file.id); if (!metadata || metadata.type !== file.blob.type || metadata.size !== file.blob.size) throw new Error('附件与行动引用不一致'); tx.objectStore('attachments').put(file) }
        if (command.type === 'p2-action' && command.attachments?.some(a => !files.some(f => f.id === a.id))) throw new Error('附件文件尚未准备完成')
        if (command.type === 'ingest-batch' || command.type === 'process-batch') for (const comment of next.comments.filter(c => c.firstBatchId === (command.type === 'ingest-batch' ? command.batch.id : command.batchId) && !c.association.styleId)) {
          const listing = getChannelListing(comment.raw.listingId)
          if (!listing || listing.storeId !== comment.raw.storeId || listing.platformProductId !== comment.raw.platformProductId) throw new Error('评论来源链接尚未与已有渠道商品档案对应，请核对来源。')
          comment.association.styleId = listing.styleId
          // Current variant mappings are not historical purchase evidence; keep SKU unconfirmed until supplied.
        }
        for (const collection of collections) { const before = new Map((current[collection] as Array<{ id: string }>).map(value => [value.id, JSON.stringify(value)])); for (const value of next[collection] as Array<{ id: string }>) if (before.get(value.id) !== JSON.stringify(value)) store.put({ key: `${collection}:${value.id}`, collection, value } satisfies StoredRecord) }
        if (next.version !== current.version) store.put({ key: 'meta:state', collection: 'meta', value: { version: next.version, asOf: next.asOf } } satisfies StoredRecord)
      } catch (error) { caught = error; tx.abort() }
    }
    request.onerror = () => { caught = request.error }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(caught || tx.error || new Error('本次保存中断，原资料与输入保持不变。'))
    tx.onerror = () => { caught ||= tx.error }
  })
  // Publishing occurs only after transaction completion and an independent durable reread.
  try { snapshot = await read(db, seed); failure = '' } catch (error) { failure = '本次提交已完成，但回读失败；请重新读取核对结果，勿重复创建操作。'; throw error }
}

export function resetFeedbackRuntimeForTests(): void { snapshot = null; readiness = null; failure = ''; if (dbPromise) void dbPromise.then(db => db.close()).catch(() => {}); dbPromise = null }

export async function readFeedbackAttachment(id: string): Promise<Blob> {
  const db = await database(); return new Promise((resolve,reject) => { const tx=db.transaction('attachments','readonly'),request=tx.objectStore('attachments').get(id); let blob:Blob; request.onsuccess=()=>{blob=request.result?.blob};tx.oncomplete=()=>blob?resolve(blob):reject(new Error('附件文件不可读取'));tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error) })
}
