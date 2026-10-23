import test from 'node:test'
import assert from 'node:assert/strict'
import { hydratePartTicketRecords, isPartTicketReady, readPartTicketValue, savePartTicketAction, migratePartTicketRecords, PART_TICKET_KEYS } from '../../src/data/fcs/cutting/part-ticket-records.ts'

test('overlapping readers share only the same part-ticket read; writes and different snapshots still block', async () => {
  const first = { revision: 1, records: [] }
  const reads = await Promise.allSettled([hydratePartTicketRecords(first), hydratePartTicketRecords(first)])
  assert.deepEqual(reads.map(result => result.status), ['fulfilled', 'fulfilled'])
  assert.equal(isPartTicketReady(), true)

  const next = { revision: 2, records: [{ id: 'part-ticket:records:continuity', collection: 'part-ticket:records', value: { ticketRecordId: 'continuity', ticketNo: 'FP-CONTINUITY', status: 'PRINTED', quantity: 12 } }] }
  const reading = hydratePartTicketRecords(next)
  await assert.rejects(hydratePartTicketRecords({ revision: 3, records: [] }), /正在保存或迁移/)
  await reading
  assert.equal(JSON.parse(readPartTicketValue(PART_TICKET_KEYS.records)!)[0].quantity, 12)

  const broken = { revision: 4, records: [{ id: 'part-ticket:records:broken', collection: 'part-ticket:records', value: {} }] }
  const failures = await Promise.allSettled([hydratePartTicketRecords(broken), hydratePartTicketRecords(broken)])
  assert.deepEqual(failures.map(result => result.status), ['rejected', 'rejected'])
  assert.equal(isPartTicketReady(), false, 'read failure must not retain a usable empty snapshot')
  await hydratePartTicketRecords(next)
  assert.equal(isPartTicketReady(), true, 'an explicit later read can recover')

  const saving = savePartTicketAction({ intent: 'continuity-read-guard', action: () => null })
  const savingFailure = assert.rejects(saving, /不支持本地数据库/)
  await assert.rejects(hydratePartTicketRecords(next), /正在保存或迁移/)
  await savingFailure
  const migration = migratePartTicketRecords({ otherPagesClosed: true, progress() {} })
  const migrationFailure = assert.rejects(migration, /不支持本地数据库/)
  await assert.rejects(hydratePartTicketRecords(next), /正在保存或迁移/)
  await migrationFailure
})
