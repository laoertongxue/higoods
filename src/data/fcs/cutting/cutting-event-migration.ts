import { migrateRetiredCutPiecePickupHistory } from './retired-cut-piece-pickup-history.ts'
import { CUTTING_EVENT_SCOPE_RECORD, isManagedCuttingEvent } from './cutting-event-scope.ts'
import { cuttingRecordFingerprint as fingerprint } from './cutting-record-identity.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, type CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import { readCuttingRecords, commitCuttingRecords } from './cutting-record-repository.ts'

async function markScopeComplete(expectedRaw: string | null): Promise<void> {
  const snapshot = await readCuttingRecords()
  if (snapshot.records.some(record => record.id === CUTTING_EVENT_SCOPE_RECORD)) return
  await commitCuttingRecords({ revision: snapshot.revision, assertSourcesCurrent: () => { if (localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) !== expectedRaw) throw new Error('旧裁床记录在核对后发生变化，请关闭其他页面后重试；未标记完成。') }, change: { puts: [{ id: CUTTING_EVENT_SCOPE_RECORD, collection: 'cutting-event-scopes', value: { phase: 'COMPLETE', version: 2 } }] }, command: { id: 'cutting-event-scope-v2:complete', intent: 'cutting-event-scope-v2:complete', result: true, at: new Date().toISOString() } })
}
/** 显式迁移共享旧账；不由读取触发，不改其他模块事件。 */
export async function migrateLegacyCuttingEvents(input: { otherPagesClosed: boolean; progress: (message: string) => void }): Promise<number> {
  if (!input.otherPagesClosed) throw new Error('请先关闭其他 HiGood 页面，并勾选确认；源记录尚未清理。')
  await migrateRetiredCutPiecePickupHistory(input)
  const raw = localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  const initial = await readCuttingRecords()
  for (const record of initial.records.filter(record => record.collection === 'cutting-migrations')) {
    const pending = record.value as { id: string; phase?: string; recordIds: string[]; contentFingerprint: string; sourceAfterFingerprint: string; count: number; retainedCount: number }
    if (pending.phase !== 'VERIFIED' || pending.sourceAfterFingerprint !== await fingerprint(raw || '')) continue
    const values = new Map(initial.records.map(row => [row.id, row.value]))
    if (await fingerprint(JSON.stringify(pending.recordIds.map(id => values.get(id)))) !== pending.contentFingerprint) throw new Error('迁移中断后的目标记录发生变化，未继续清理，请主管核对。')
    const snapshot = await readCuttingRecords()
    await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [{ ...record, value: { ...pending, phase: 'COMPLETE', completedAt: new Date().toISOString() } }] }, command: { id: `${pending.id}:complete`, intent: `complete:${pending.id}`, result: pending.count, at: new Date().toISOString() } })
    input.progress(`已恢复迁移完成记录：${pending.count} 条，未重复写入。`)
  }
  if (!raw) { await markScopeComplete(raw); input.progress('没有待迁移的旧裁后记录。'); return 0 }
  let source: { events: CuttingRuntimeEvent[]; [key: string]: unknown }
  try { source = JSON.parse(raw) } catch { throw new Error('旧裁床记录不是有效 JSON，未迁移或清理。') }
  if (!Array.isArray(source.events) || source.events.some(event => !event || !event.eventId || !event.eventType || !event.refs || !event.payload)) throw new Error('旧裁床记录不完整，未迁移或清理。')
  if (new Set(source.events.map(event => event.eventId)).size !== source.events.length) throw new Error('旧记录编号重复，未迁移或清理。')
  const selected = source.events.filter(isManagedCuttingEvent)
  const cutIds = new Set(selected.map(event => event.refs.cutOrderId).filter(Boolean))
  const selectedIds = new Set(selected.map(event => event.eventId))
  const dependencies = source.events.filter(event => event.eventType === '完成裁剪' && cutIds.has(event.refs.cutOrderId) && !selectedIds.has(event.eventId))
  const events = [...selected, ...dependencies]
  if (!events.length) { await markScopeComplete(raw); input.progress('共享旧账没有本次裁后处理范围内的记录。其他模块记录已保留。'); return 0 }
  const batch = await fingerprint(raw)
  const id = `cutting-migration:${batch}`
  for (let offset = 0; offset < events.length; offset += 100) {
    if (localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) !== raw) throw new Error('其他页面改变了旧账，迁移暂停，未删除源记录。请关闭旧页面后重试。')
    const snapshot = await readCuttingRecords()
    const existing = new Map(snapshot.records.map(record => [record.id, record]))
    const rows = events.slice(offset, offset + 100).map(event => ({ id: `cutting-event:${event.eventId}`, collection: 'cutting-events', value: event }))
    for (const row of rows) if (existing.has(row.id) && JSON.stringify(existing.get(row.id)) !== JSON.stringify(row)) throw new Error(`旧记录 ${row.value.eventNo || row.value.eventId} 与本机版本冲突，未覆盖或清理。`)
    await commitCuttingRecords({ revision: snapshot.revision, change: { puts: rows.filter(row => !existing.has(row.id)) }, command: { id: `${id}:${offset}`, intent: JSON.stringify(rows.map(row => row.id)), result: rows.length, at: new Date().toISOString() } })
    input.progress(`迁移中：已转换 ${Math.min(events.length, offset + 100)} / ${events.length} 条，源记录仍保留。`)
  }
  const readback = await readCuttingRecords()
  const records = new Map(readback.records.map(record => [record.id, record.value]))
  if (events.some(event => JSON.stringify(records.get(`cutting-event:${event.eventId}`)) !== JSON.stringify(event))) throw new Error('目标记录读回不一致，源数据未清理，请重试。')
  if (localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) !== raw) throw new Error('旧账在迁移期间发生变化，目标已保存，源数据保留，请关闭其他页面后重试。')
  const ids = new Set(events.map(event => event.eventId))
  const retained = source.events.filter(event => !ids.has(event.eventId))
  const retainedRaw = retained.length ? JSON.stringify({ ...source, events: retained }) : ''
  const pending = { id, version: 1, phase: 'VERIFIED', count: events.length, retainedCount: retained.length,
    recordIds: events.map(event => `cutting-event:${event.eventId}`), contentFingerprint: await fingerprint(JSON.stringify(events)), sourceAfterFingerprint: await fingerprint(retainedRaw) }
  const checkpoint = await readCuttingRecords()
  await commitCuttingRecords({ revision: checkpoint.revision, change: { puts: [{ id, collection: 'cutting-migrations', value: pending }] }, command: { id: `${id}:verified`, intent: `verified:${batch}`, result: events.length, at: new Date().toISOString() } })
  if (localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) !== raw) throw new Error('旧账在读回后发生变化，源数据未清理，请关闭其他页面后重试。')
  // localStorage 与 IDB 不能组成事务；清理前已存可恢复检查点。
  if (retained.length) localStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, retainedRaw)
  else localStorage.removeItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  const after = localStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  if (after && JSON.parse(after).events.some((event: CuttingRuntimeEvent) => ids.has(event.eventId))) throw new Error('旧页面重新写入源记录，迁移未完成，请关闭旧页面后重试。')
  const snapshot = await readCuttingRecords()
  await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [{ id, collection: 'cutting-migrations', value: { ...pending, phase: 'COMPLETE', completedAt: new Date().toISOString() } }] }, command: { id: `${id}:complete`, intent: `complete:${id}`, result: events.length, at: new Date().toISOString() } })
  await markScopeComplete(after)
  input.progress(`迁移完成：${events.length} 条已读回核对，旧源已清理；保留其他模块 ${retained.length} 条。`)
  return events.length
}
