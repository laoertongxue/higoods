import assert from 'node:assert/strict'
import test from 'node:test'
import { PMS_STORES, PMS_IDB_VERSION, pmsCommitRecords, pmsPut, pmsPutWithVersion, pmsGet, pmsAll, importPmsDataBundle, closePmsDb } from '../../src/data/pms/idb-storage.ts'
import { createPmsOperationLog, listPmsLogs } from '../../src/data/pms/runtime.ts'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'

test('unavailable storage rejects a procurement action without publishing its candidate or log', async () => {
  closePmsDb()
  const candidate = { supplierCode: 'CHECK-unavailable', supplierName: '未保存', _pmsBaseVersion: 0 }
  const log = { objectType: '保存契约测试', objectId: candidate.supplierCode, action: '新增', beforeValue: '', afterValue: '未保存', reason: '', actorId: 'CHECK', actorName: '测试', actorRole: '系统' as const }
  const before = structuredClone(candidate)
  await assert.rejects(pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value: candidate }], { log }), { code: 'PMS_IDB_UNAVAILABLE' })
  assert.deepEqual(candidate, before)
  assert.equal(listPmsLogs(log.objectType, log.objectId).length, 0)
  await assert.rejects(pmsPut(PMS_STORES.pmsSuppliers, candidate), { code: 'PMS_IDB_UNAVAILABLE' })
})

test('duplicate records and missing business identity are rejected before starting a write', async () => {
  const value = { supplierCode: 'CHECK-duplicate' }
  await assert.rejects(pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value }, { store: PMS_STORES.pmsSuppliers, value }]), { code: 'PMS_IDB_DUPLICATE_RECORD' })
  await assert.rejects(pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value: { supplierName: '无编号' } }]), { code: 'PMS_IDB_KEY_REQUIRED' })
})

test('a file requires a business owner in the same action and cannot become an orphan', async () => {
  const attachment = { id: 'CHECK-file', name: 'test.txt', type: 'text/plain', size: 1, blob: new Blob(['X']) }
  await assert.rejects(pmsCommitRecords([], { attachments: [attachment] }), { code: 'PMS_IDB_ATTACHMENT_UNREFERENCED' })
  await assert.rejects(pmsCommitRecords([], { attachments: [attachment], attachmentReferences: [{ store: PMS_STORES.pmsSuppliers, key: 'absent', fileIds: [attachment.id] }] }), { code: 'PMS_IDB_ATTACHMENT_OWNER' })
})

test('log preparation is pure and malformed backup is rejected without opening storage', async () => {
  const entry = { objectType: '保存契约测试', objectId: 'CHECK-log', action: '准备', beforeValue: '', afterValue: '', reason: '', actorId: 'CHECK', actorName: '测试', actorRole: '系统' as const }
  const first = createPmsOperationLog(entry); const second = createPmsOperationLog(entry)
  assert.notEqual(first.id, second.id)
  assert.equal(listPmsLogs(entry.objectType, entry.objectId).length, 0)
  await assert.rejects(importPmsDataBundle(new Blob(['INVALID BACKUP'])), { code: 'PMS_IDB_IMPORT_INVALID' })
})

test('duplicate file identities or inconsistent byte sizes are rejected before writing', async () => {
  const value = { supplierCode: 'CHECK-file-owner' }
  const attachment = { id: 'CHECK-unique-file', name: 'test.txt', type: 'text/plain', size: 1, blob: new Blob(['X']) }
  const attachmentReferences = [{ store: PMS_STORES.pmsSuppliers, key: value.supplierCode, fileIds: [attachment.id] }]
  await assert.rejects(pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value }], { attachments: [attachment, attachment], attachmentReferences }), { code: 'PMS_IDB_ATTACHMENT_INVALID' })
  await assert.rejects(pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value }], { attachments: [{ ...attachment, size: 99 }], attachmentReferences }), { code: 'PMS_IDB_ATTACHMENT_INVALID' })
})

test('duplicate attachment owners cannot leave a file outside the committed reference list', async () => {
  const memory = installPmsMemoryIdb()
  try {
    const value = { supplierCode: 'CHECK-owner-once' }
    const attachments = ['CHECK-A', 'CHECK-B'].map(id => ({ id, name: id, type: 'text/plain', size: 1, blob: new Blob(['X']) }))
    await assert.rejects(pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value }], { attachments, attachmentReferences: attachments.map(file => ({ store: PMS_STORES.pmsSuppliers, key: value.supplierCode, fileIds: [file.id] })) }), { code: 'PMS_IDB_ATTACHMENT_DUPLICATE_OWNER' })
    assert.deepEqual(await pmsAll(PMS_STORES.pmsAttachments), [])
    assert.equal(await pmsGet(PMS_STORES.pmsSuppliers, value.supplierCode), undefined)
  } finally { memory.restore() }
})

test('a newer read does not promote an older draft version in the legacy write adapter', async () => {
  const memory = installPmsMemoryIdb()
  try {
    const first = { supplierCode: 'CHECK-observed-version', supplierName: 'first', _pmsBaseVersion: 0 }
    await pmsPutWithVersion(PMS_STORES.pmsSuppliers, first, 'CHECK')
    const stale = { ...first, supplierName: 'stale' }
    const current = { ...first, supplierName: 'current' }
    await pmsPutWithVersion(PMS_STORES.pmsSuppliers, current, 'CHECK')
    await assert.rejects(pmsPutWithVersion(PMS_STORES.pmsSuppliers, stale, 'CHECK'), { code: 'PMS_IDB_VERSION_CONFLICT' })
    assert.equal((await pmsGet<{ supplierName: string }>(PMS_STORES.pmsSuppliers, first.supplierCode))!.supplierName, 'current')
    assert.equal(stale._pmsBaseVersion, 1)
  } finally { memory.restore() }
})

test('optional notification failure after complete cannot turn a committed save into failure', async () => {
  const memory = installPmsMemoryIdb()
  try {
    Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: class { constructor() { throw new DOMException('notification blocked', 'SecurityError') } } })
    const value = { supplierCode: 'CHECK-notify', supplierName: 'saved' }
    await pmsCommitRecords([{ store: PMS_STORES.pmsSuppliers, value }])
    assert.equal((await pmsGet<{ supplierName: string }>(PMS_STORES.pmsSuppliers, value.supplierCode))!.supplierName, 'saved')
    assert.equal((value as { _pmsBaseVersion?: number })._pmsBaseVersion, 1)
  } finally { memory.restore() }
})

function backupFile(stores: { store: string; records: object[] }[], bytes = new Uint8Array()): Blob {
  const json = new TextEncoder().encode(JSON.stringify({ format: 'higood-pms', formatVersion: 1, databaseVersion: PMS_IDB_VERSION, stores }))
  const header = new Uint8Array(12); header.set(new TextEncoder().encode('HGPMS001')); new DataView(header.buffer).setUint32(8, json.length, true)
  return new Blob([header, json, bytes])
}

test('备份缺失业务附件、归属或元数据不符时整批拒绝，不写入其它合法记录', async () => {
  const memory = installPmsMemoryIdb()
  try {
    const order = { purchaseOrderNo: 'CHECK-backup-MO', attachments: [{ fileId: 'CHECK-bytes', name: 'receipt.txt', type: 'text/plain', size: 3 }] }
    const validOwner = { id: `${PMS_STORES.pmsMaterialPurchaseOrderDeltas}::${order.purchaseOrderNo}`, fileIds: ['CHECK-bytes'] }
    const file = { id: 'CHECK-bytes', name: 'receipt.txt', type: 'text/plain', size: 3, backupOffset: 0, backupLength: 3 }
    for (const [index, extra] of [
      [],
      [{ store: PMS_STORES.pmsAttachmentReferences, records: [validOwner] }],
      [{ store: PMS_STORES.pmsAttachments, records: [file] }],
      [{ store: PMS_STORES.pmsAttachments, records: [file] }, { store: PMS_STORES.pmsAttachmentReferences, records: [{ ...validOwner, id: `${PMS_STORES.pmsMaterialPurchaseOrderDeltas}::absent` }] }],
      [{ store: PMS_STORES.pmsAttachments, records: [{ ...file, name: 'different.txt' }] }, { store: PMS_STORES.pmsAttachmentReferences, records: [validOwner] }],
    ].entries()) {
      await assert.rejects(importPmsDataBundle(backupFile([
        { store: PMS_STORES.pmsMaterialPurchaseOrderDeltas, records: [order] },
        { store: PMS_STORES.pmsSuppliers, records: [{ supplierCode: `CHECK-valid-${index}`, supplierName: '共同不应保存' }] }, ...extra,
      ], new TextEncoder().encode('ABC'))), { code: 'PMS_IDB_IMPORT_INVALID' })
      assert.equal(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas, order.purchaseOrderNo), undefined)
      assert.equal(await pmsGet(PMS_STORES.pmsSuppliers, `CHECK-valid-${index}`), undefined)
      assert.deepEqual(await pmsAll(PMS_STORES.pmsAttachments), [])
    }
  } finally { memory.restore() }
})

test('备份业务 JSON 内嵌 Base64 或临时 blob 地址被阻断；完整附件恢复原始字节', async () => {
  const memory = installPmsMemoryIdb()
  try {
    for (const url of ['data:image/png;base64,QUJD', 'blob:http://localhost/session-file']) {
      await assert.rejects(importPmsDataBundle(backupFile([{ store: PMS_STORES.pmsSuppliers, records: [{ supplierCode: 'CHECK-inline', imageUrl: url }] }])), { code: 'PMS_IDB_IMPORT_INVALID' })
      assert.equal(await pmsGet(PMS_STORES.pmsSuppliers, 'CHECK-inline'), undefined)
    }
    const order = { purchaseOrderNo: 'CHECK-backup-complete', attachments: [{ fileId: 'CHECK-complete-bytes', name: 'receipt.txt', type: 'text/plain', size: 3 }] }
    const result = await importPmsDataBundle(backupFile([
      { store: PMS_STORES.pmsMaterialPurchaseOrderDeltas, records: [order] },
      { store: PMS_STORES.pmsAttachments, records: [{ id: 'CHECK-complete-bytes', name: 'receipt.txt', type: 'text/plain', size: 3, backupOffset: 0, backupLength: 3 }] },
      { store: PMS_STORES.pmsAttachmentReferences, records: [{ id: `${PMS_STORES.pmsMaterialPurchaseOrderDeltas}::${order.purchaseOrderNo}`, fileIds: ['CHECK-complete-bytes'] }] },
    ], new TextEncoder().encode('ABC')))
    assert.equal(result.imported, 3)
    assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas, order.purchaseOrderNo), order)
    const restored = await pmsGet<{ blob: Blob }>(PMS_STORES.pmsAttachments, 'CHECK-complete-bytes')
    assert.equal(await restored!.blob.text(), 'ABC')
  } finally { memory.restore() }
})
