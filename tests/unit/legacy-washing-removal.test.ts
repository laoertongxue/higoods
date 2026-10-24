import test from 'node:test'
import assert from 'node:assert/strict'
import { containsRetiredWashingIdentity, hasRetiredWashingFacts, RETIRED_WASHING_COLLECTIONS, stripRetiredWashingFacts } from '../../src/data/fcs/legacy-washing-removal.ts'

test('AC-031/039: retirement is bounded to the two old business collections, never the whole PCS/source database', () => {
  assert.deepEqual(RETIRED_WASHING_COLLECTIONS, ['fcs.fabric-washing.v1', 'fcs.fabric-washing.process-records.v1'])
  assert.equal(RETIRED_WASHING_COLLECTIONS.some(name => name === 'higood-pcs-records' as string), false)
})

test('AC-032/039: retired source/receipt/use/transfer and demonstration identities are recognized', () => {
  for (const row of [{ washingOrderId: 'WASH-OP-1' }, { processCode: 'WASH' }, { processCode: 'PROC_WASH' }, { id: 'WASH-SOURCE-1' }, { id: 'WASH-RECEIPT-1' }, { id: 'WASH-USE-1' }, { id: 'WASH-TRANSFER-1' }, { printOrderId: 'PWO-WASH-DEMO-1' }]) assert.equal(containsRetiredWashingIdentity(row), true)
})

test('AC-031/039: ordinary printing, dyeing and soluble facts keep their real identity and quantities', () => {
  const rows = [{ id: 'PWO-PRINT-1', completedQty: 12.345, handedOverQty: 10, receivedQty: 9 }, { id: 'DWO-1', outputQty: 20, actualInputQty: 21 }, { waterOrderId: 'WATER-1', completedQty: 30, unit: '米' }]
  for (const row of rows) {
    assert.equal(containsRetiredWashingIdentity(row), false)
    assert.deepEqual(stripRetiredWashingFacts(row), row)
  }
})

test('AC-031/039: a mixed shared receipt retains every nonretired line and its original attachment reference', () => {
  const original = { id: 'SHARED-RECEIPT', receivedAt: '2026-10-22T10:00:00Z', lines: [{ id: 'PRINT-L1', printingOrderId: 'PWO-1', qty: 12.345, unit: '米', fileId: 'wash-file-shared-photo' }, { id: 'RETIRED-L2', washingOrderId: 'WASH-1', qty: 100, unit: 'Yard' }, { id: 'DYE-L3', dyeOrderId: 'DWO-1', qty: 4, unit: 'kg' }] }
  const before = structuredClone(original), result = stripRetiredWashingFacts(original) as typeof original
  assert.deepEqual(result.lines, [original.lines[0], original.lines[2]])
  assert.equal(result.receivedAt, original.receivedAt)
  assert.equal(result.lines[0].fileId, 'wash-file-shared-photo', '附件共用字节的保留不能靠名称判删')
  assert.deepEqual(original, before, '清理预览不能改写传入的原事实')
})

test('AC-031/039: a retired-only shared document disappears without a fake empty receipt or zero balance', () => {
  const original = { id: 'RECEIPT-ONLY-OLD', receivedAt: '2026-10-22', lines: [{ id: 'L1', washingOrderId: 'WASH-1', qty: 100 }] }
  assert.equal(stripRetiredWashingFacts(original), undefined)
  assert.equal(original.lines[0].qty, 100)
})

test('AC-031/039: old printing demo tuples are removed while original source and real handout tuples survive', () => {
  const original = { version: 1, state: { workOrders: [['PWO-PRINT-1', { printOrderId: 'PWO-PRINT-1', completedQty: 9 }], ['PWO-WASH-DEMO-1', { printOrderId: 'PWO-WASH-DEMO-1' }]], nodeRecords: [['PWO-PRINT-1', [{ nodeCode: 'PRINT', outputQty: 9 }]], ['PWO-WASH-DEMO-1', [{ nodeCode: 'PRINT', outputQty: 99 }]]] }, handoverHeadAdditions: [['HANDOUT-REAL', { id: 'HANDOUT-REAL', sourceDocId: 'PWO-PRINT-1', qty: 8 }]] }
  const result = stripRetiredWashingFacts(original) as typeof original
  assert.deepEqual(result.state.workOrders, [original.state.workOrders[0]])
  assert.deepEqual(result.state.nodeRecords, [original.state.nodeRecords[0]])
  assert.deepEqual(result.handoverHeadAdditions, original.handoverHeadAdditions)
})

test('AC-031/039: an original print reference is not sufficient to discard a valid downstream receipt', () => {
  const receipt = { id: 'REAL-RECEIPT', lines: [{ id: 'REAL-L1', originPrintOrderId: 'PWO-PRINT-1', qty: 8, rolls: [{ barcode: 'PRINT-REAL-1', originRollId: 'R1', qty: 8 }] }] }
  assert.deepEqual(stripRetiredWashingFacts(receipt), receipt)
})

test('AC-032/039: new handfeel source and receipt facts survive; the filter does not manufacture them from old orders', () => {
  const old = { id: 'WASH-SOURCE-1', processCode: 'WASH', washingOrderId: 'WASH-1' }
  const current = { id: 'SHF-TRANSFER-1', processCode: 'STENTER_HANDFEEL', stenterHandfeelOrderId: 'SHF-PRINTING-1', handfeelDirection: 'TO_HANDFEEL', lines: [{ id: 'SHF-L1', qty: 12.345 }] }
  const result = stripRetiredWashingFacts([old, current])
  assert.deepEqual(result, [current])
  assert.equal(JSON.stringify(result).includes('WASH-1'), false)
  assert.equal((result as unknown[]).length, 1, '不能把旧洗水单额外转换成新手感单')
})

test('AC-039: retirement is reentrant and preserves unrelated names, business snapshots and nested references', () => {
  const input = { productName: 'WASH 工艺字样款', materialSku: 'FAB-WASH-LOGO', attachment: { fileId: 'pcs-file-shared-1' }, nested: [{ id: 'WASH-USE-1', qty: 99 }, { id: 'REAL-USE-1', qty: 8 }] }
  const once = stripRetiredWashingFacts(input)
  assert.deepEqual(stripRetiredWashingFacts(once), once)
  assert.deepEqual(once, { productName: input.productName, materialSku: input.materialSku, attachment: input.attachment, nested: [{ id: 'REAL-USE-1', qty: 8 }] })
})

test('AC-032/039: old task identities disappear as complete tuples without leaving orphaned retired keys', () => {
  const current = ['TASK-PRINT-REAL', { taskId: 'TASK-PRINT-REAL', outputQty: 7 }]
  const input = { tasks: [{ taskId: 'TASK-PWO-WASH-DEMO-1' }, { taskId: 'TASK-PRINT-REAL' }], taskOverrides: [['TASK-PWO-WASH-DEMO-1', { status: 'IN_PROGRESS' }], current] }
  assert.equal(hasRetiredWashingFacts(input), true)
  const cleaned = stripRetiredWashingFacts(input)
  assert.deepEqual(cleaned, { tasks: [{ taskId: 'TASK-PRINT-REAL' }], taskOverrides: [current] })
  assert.equal(hasRetiredWashingFacts(cleaned), false)
})

test('AC-041: the actual backup validator rejects both retired collections and embedded washing facts without changing the supplied backup', async () => {
  const { validatePcsBackup } = await import('../../src/data/pcs-record-db.ts')
  for (const record of [
    ...RETIRED_WASHING_COLLECTIONS.map(collection => ({ id: collection + '/old-1', collection, version: 1, value: { id: 'OLD-1' } })),
    { id: 'fcs.factory-qc.process-records.v1/shared', collection: 'fcs.factory-qc.process-records.v1', version: 1, value: { washingOrderId: 'WASH-OLD-1' } },
  ]) {
    const backup = { format: 'higood-pcs-records', version: 1, records: [record], files: [] }
    const original = structuredClone(backup)
    assert.throws(() => validatePcsBackup(backup), /备份含已退役洗水业务资料/)
    assert.deepEqual(backup, original)
  }
})

test('AC-041: rejection of old washing formats does not reject valid new QC photos or other source facts', async () => {
  const { validatePcsBackup } = await import('../../src/data/pcs-record-db.ts')
  const originalPhoto = new Blob(['original-QC-photo'], { type: 'image/jpeg' })
  const backup = { format: 'higood-pcs-records', version: 1, records: [
    { id: 'fcs.factory-qc.v1/roll/qc-1/r1', collection: 'fcs.factory-qc.v1', version: 1, value: { kind: 'roll', qcId: 'qc-1', data: { id: 'r1', photos: [{ fileId: 'QC-PHOTO-1' }] } } },
    { id: 'fcs.factory-qc.process-records.v1/source-1', collection: 'fcs.factory-qc.process-records.v1', version: 1, value: { id: 'ORIGINAL-PRINT-1', receivedQty: 12.345, unit: '米' } },
  ], files: [{ id: 'QC-PHOTO-1', blob: originalPhoto }] }
  assert.doesNotThrow(() => validatePcsBackup(backup))
  assert.equal(backup.files[0].blob, originalPhoto)
  assert.equal(backup.records[1].value.receivedQty, 12.345)
})
