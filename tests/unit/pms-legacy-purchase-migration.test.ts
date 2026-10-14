import assert from 'node:assert/strict'
import test from 'node:test'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { getPmsMaterialPurchaseOrder } from '../../src/data/pms/material-purchase-orders.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords, pmsGet, pmsPut } from '../../src/data/pms/idb-storage.ts'
import { detectLegacyMaterialPurchaseOrders, migrateLegacyMaterialPurchaseOrders, readLegacyMaterialPurchaseBackup, PMS_LEGACY_MPO_KEY, type LegacyPurchaseStorage } from '../../src/data/pms/legacy-purchase-migration.ts'

function purchase(no = 'CGF-LEGACY-001') {
  return { ...structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!), purchaseOrderNo: no, remark: '保留旧采购记录', _pmsBaseVersion: 0 }
}
function storage(raw: string) {
  const rows = new Map<string, string>([[PMS_LEGACY_MPO_KEY, raw], ['ui.theme', 'dark'], ['higood-pms-warehouses-v1', 'preserve-retired-source']])
  const controls = { reads: 0, removes: 0, readFailureAt: 0, removeFailures: 0, changedAt: 0, changedRaw: '' }
  const source: LegacyPurchaseStorage = {
    getItem(key) {
      assert.equal(key, PMS_LEGACY_MPO_KEY)
      controls.reads += 1
      if (controls.reads === controls.readFailureAt) throw new Error('Local source unavailable')
      if (controls.reads === controls.changedAt) rows.set(key, controls.changedRaw)
      return rows.get(key) ?? null
    },
    removeItem(key) {
      assert.equal(key, PMS_LEGACY_MPO_KEY); controls.removes += 1
      if (controls.removeFailures) { controls.removeFailures -= 1; throw new Error('Cleanup blocked') }
      rows.delete(key)
    },
  }
  return { rows, controls, source }
}
const migrate = (source: LegacyPurchaseStorage, expectedSourceHash?: string) => migrateLegacyMaterialPurchaseOrders({ otherPagesClosed: true, storage: source, expectedSourceHash })

test('检测只读旧键；明确关闭旧页面之前不迁移或清理', async () => {
  const fixture = installPmsMemoryIdb(), raw = JSON.stringify([purchase()]), old = storage(raw)
  try {
    fixture.setFailWrites(true)
    const detection = await detectLegacyMaterialPurchaseOrders(old.source)
    assert.equal(detection.found, true); assert.equal(detection.count, 1); assert.match(detection.sourceHash!, /^[0-9a-f]{64}$/)
    assert.equal(old.controls.removes, 0); assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw)
    await assert.rejects(migrateLegacyMaterialPurchaseOrders({ otherPagesClosed: false, storage: old.source }), /先关闭/)
    assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), [])
  } finally { fixture.restore() }
})
test('正常迁入整批采购记录、版本、日志与稳定回执；独立读回后只清理指定旧键', async () => {
  const fixture = installPmsMemoryIdb(), orders = [purchase(), purchase('CGF-LEGACY-002')], old = storage(JSON.stringify(orders))
  try {
    const detection = await detectLegacyMaterialPurchaseOrders(old.source), result = await migrate(old.source, detection.sourceHash)
    assert.equal(result.status, 'completed'); assert.equal(result.targetVerified, true); assert.equal(result.migrated, 2); assert.equal(result.skipped, 0); assert.equal(result.removed, true)
    assert.equal(old.rows.has(PMS_LEGACY_MPO_KEY), false); assert.equal(old.rows.get('ui.theme'), 'dark'); assert.equal(old.rows.get('higood-pms-warehouses-v1'), 'preserve-retired-source')
    const saved = await pmsAll<any>(PMS_STORES.pmsMaterialPurchaseOrderDeltas)
    assert.equal(saved.length, 2); assert.ok(saved.every(row => row._pmsBaseVersion === 1))
    assert.equal((await pmsAll(PMS_STORES.pmsOperationLogs)).length, 1); assert.equal((await pmsAll(PMS_STORES.pmsCommittedOperations)).length, 1)
    assert.equal((await pmsAll<any>(PMS_STORES.pmsVersionSnapshots)).filter(row => row.version === 1).length, 2)
    const replay = await migrate(old.source); assert.equal(replay.status, 'no-source'); assert.equal((await pmsAll(PMS_STORES.pmsOperationLogs)).length, 1)
  } finally { fixture.restore() }
})
test('已有相同业务内容忽略存储基版本并跳过，不更新已有记录版本', async () => {
  const fixture = installPmsMemoryIdb(), order = purchase(), old = storage(JSON.stringify([{ ...order, _baseVersion: 99, _pmsBaseVersion: 55 }]))
  try {
    await pmsCommitRecords([{ store: PMS_STORES.pmsMaterialPurchaseOrderDeltas, value: order, expectedVersion: 0 }])
    const result = await migrate(old.source)
    assert.equal(result.migrated, 0); assert.equal(result.skipped, 1); assert.equal(result.status, 'completed')
    const saved = await pmsGet<any>(PMS_STORES.pmsMaterialPurchaseOrderDeltas, order.purchaseOrderNo)
    assert.equal(saved._pmsBaseVersion, 1); assert.equal(saved._baseVersion, undefined)
  } finally { fixture.restore() }
})
test('任一已有采购记录冲突阻断整批；不覆盖冲突或新增同批其它记录', async () => {
  const fixture = installPmsMemoryIdb(), orders = [purchase(), purchase('CGF-LEGACY-002')], raw = JSON.stringify(orders), old = storage(raw)
  try {
    await pmsCommitRecords([{ store: PMS_STORES.pmsMaterialPurchaseOrderDeltas, value: { ...orders[0], remark: '目标已有修改' }, expectedVersion: 0 }])
    await assert.rejects(migrate(old.source), /内容不同/)
    assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw); assert.equal(old.controls.removes, 0)
    const saved = await pmsAll<any>(PMS_STORES.pmsMaterialPurchaseOrderDeltas)
    assert.equal(saved.length, 1); assert.equal(saved[0].remark, '目标已有修改'); assert.equal((await pmsAll(PMS_STORES.pmsOperationLogs)).length, 0)
  } finally { fixture.restore() }
})
test('事务 complete 中止时没有采购单、版本、操作日志或迁移回执；保留旧源', async () => {
  const fixture = installPmsMemoryIdb(), raw = JSON.stringify([purchase()]), old = storage(raw)
  try {
    fixture.setFailWrites(true)
    await assert.rejects(migrate(old.source), /中止/)
    for (const store of [PMS_STORES.pmsMaterialPurchaseOrderDeltas, PMS_STORES.pmsVersionSnapshots, PMS_STORES.pmsOperationLogs, PMS_STORES.pmsCommittedOperations]) assert.deepEqual(await pmsAll(store), [])
    assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw); assert.equal(old.controls.removes, 0)
  } finally { fixture.restore() }
})
test('目标已保存但旧键删除失败明确报告；重试核对后清理且不重复建单、加版本或加日志', async () => {
  const fixture = installPmsMemoryIdb(), raw = JSON.stringify([purchase()]), old = storage(raw)
  try {
    old.controls.removeFailures = 1
    const first = await migrate(old.source)
    assert.equal(first.status, 'cleanup-pending'); assert.equal(first.targetVerified, true); assert.match(first.message, /目标已保存.*旧源未清理/); assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw)
    const second = await migrate(old.source)
    assert.equal(second.status, 'completed'); assert.equal(second.replayed, true); assert.equal(second.operationId, first.operationId); assert.equal(second.migrated, 0); assert.equal(second.skipped, 1)
    assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length, 1); assert.equal((await pmsAll(PMS_STORES.pmsOperationLogs)).length, 1); assert.equal((await pmsAll<any>(PMS_STORES.pmsVersionSnapshots))[0].version, 1)
  } finally { fixture.restore() }
})
test('格式错误、空字符串、重复单号、非法数量或版本均保留完整旧源且无业务写入', async () => {
  const fixture = installPmsMemoryIdb()
  try {
    for (const raw of ['invalid json', '', '{}', JSON.stringify([purchase(), purchase()]), JSON.stringify([{ ...purchase(), orderedQty: -1 }]), JSON.stringify([{ ...purchase(), _baseVersion: '3' }]), JSON.stringify([{ ...purchase(), status: '草稿' }]), JSON.stringify([{ ...purchase(), weightKg: '5' }]), JSON.stringify([{ purchaseOrderNo: 'incomplete' }])]) {
      const old = storage(raw)
      await assert.rejects(detectLegacyMaterialPurchaseOrders(old.source))
      await assert.rejects(migrate(old.source))
      assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw); assert.equal(old.controls.removes, 0)
    }
    assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), [])
  } finally { fixture.restore() }
})
test('只读备份完整返回原 raw，包括格式异常或 Base64 原始内容，不迁移、不删除', async () => {
  const fixture = installPmsMemoryIdb()
  try {
    fixture.setFailWrites(true)
    for (const raw of [JSON.stringify([purchase()]), '{invalid source', JSON.stringify([{ ...purchase(), materialImageUrl: 'data:image/png;base64,AAAA' }])]) {
      const old = storage(raw), backup = await readLegacyMaterialPurchaseBackup(old.source)
      assert.equal(backup.raw, raw); assert.match(backup.fileName, /旧面辅料采购资料-.*\.json$/); assert.match(backup.sourceHash, /^[0-9a-f]{64}$/)
      assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw); assert.equal(old.controls.removes, 0)
      if (raw === JSON.stringify([purchase()])) assert.equal(backup.count, 1)
      else { assert.equal(backup.count, null); assert.ok(backup.validationMessage) }
    }
    assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), [])
    const absent = storage('[]'); absent.rows.delete(PMS_LEGACY_MPO_KEY)
    await assert.rejects(readLegacyMaterialPurchaseBackup(absent.source), /不存在/)
  } finally { fixture.restore() }
})
test('旧键清理之后读取失败报告结果未确认，不以读错冒充不存在', async () => {
  const fixture = installPmsMemoryIdb(), old = storage(JSON.stringify([purchase()]))
  try {
    old.controls.readFailureAt = 4
    const result = await migrate(old.source)
    assert.equal(result.status, 'cleanup-pending'); assert.equal(result.targetVerified, true); assert.equal(result.removed, false)
    assert.match(result.message, /清理结果未能回读/); assert.equal(old.rows.has(PMS_LEGACY_MPO_KEY), false)
  } finally { fixture.restore() }
})
test('旧键读取失败不冒充没有旧资料；已提交后的读取失败不声称采购未保存', async () => {
  const fixture = installPmsMemoryIdb(), raw = JSON.stringify([purchase()])
  try {
    const unreadable = storage(raw); unreadable.controls.readFailureAt = 1
    await assert.rejects(detectLegacyMaterialPurchaseOrders(unreadable.source), /未能读取/)
    assert.equal(unreadable.rows.get(PMS_LEGACY_MPO_KEY), raw)
    const afterCommit = storage(raw); afterCommit.controls.readFailureAt = 3
    const result = await migrate(afterCommit.source)
    assert.equal(result.status, 'cleanup-pending'); assert.match(result.message, /目标迁入事务已完成/); assert.equal(result.targetVerified, true)
    assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length, 1); assert.equal(afterCommit.rows.get(PMS_LEGACY_MPO_KEY), raw); assert.equal(afterCommit.controls.removes, 0)
  } finally { fixture.restore() }
})
test('旧 raw 在提交前变化时整批中止；提交后变化时保留新 raw、不清理其它内容', async () => {
  const fixture = installPmsMemoryIdb(), raw = JSON.stringify([purchase()]), newRaw = JSON.stringify([purchase('CGF-NEW-001')])
  try {
    const before = storage(raw); before.controls.changedAt = 2; before.controls.changedRaw = newRaw
    await assert.rejects(migrate(before.source), /发生变化/)
    assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), []); assert.equal(before.rows.get(PMS_LEGACY_MPO_KEY), newRaw)
    const after = storage(raw); after.controls.changedAt = 3; after.controls.changedRaw = newRaw
    const result = await migrate(after.source)
    assert.equal(result.status, 'cleanup-pending'); assert.equal(result.targetVerified, true); assert.match(result.message, /旧内容已变化/)
    assert.equal(after.rows.get(PMS_LEGACY_MPO_KEY), newRaw); assert.equal(after.controls.removes, 0); assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length, 1)
  } finally { fixture.restore() }
})
test('明确展示的源 hash 与执行时不一致时不迁移', async () => {
  const fixture = installPmsMemoryIdb(), old = storage(JSON.stringify([purchase()]))
  try { await assert.rejects(migrate(old.source, 'stale-source-hash'), /已变化/); assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), []); assert.equal(old.controls.removes, 0) } finally { fixture.restore() }
})
test('孤立附件、内嵌 Base64 或无法识别的附件结构阻断，保留旧源与附件', async () => {
  const fixture = installPmsMemoryIdb(), metadata = { fileId: 'LEGACY-FILE-001', name: 'legacy.png', type: 'image/png', size: 3, category: '附加图片' as const }
  try {
    for (const order of [{ ...purchase(), attachments: [metadata] }, { ...purchase(), materialImageUrl: 'data:image/png;base64,AAAA' }, { ...purchase(), files: [{ url: 'unknown' }] }, { ...purchase(), attachments: [{ name: 'missing-file-id.png' }] }]) {
      const raw = JSON.stringify([order]), old = storage(raw)
      await assert.rejects(migrate(old.source), /附件|文件/)
      assert.equal(old.rows.get(PMS_LEGACY_MPO_KEY), raw); assert.equal(old.controls.removes, 0)
    }
    assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), []); assert.deepEqual(await pmsAll(PMS_STORES.pmsAttachmentReferences), [])
  } finally { fixture.restore() }
})
test('已存在且元数据匹配的原始 Blob 可关联迁入；不复制文件字节或移除其它附件引用', async () => {
  const fixture = installPmsMemoryIdb(), blob = new Blob(['ABC'], { type: 'image/png' }), metadata = { fileId: 'LEGACY-FILE-001', name: 'legacy.png', type: 'image/png', size: 3, category: '附加图片' as const }, order = { ...purchase(), attachments: [metadata] }, old = storage(JSON.stringify([order]))
  try {
    await pmsPut(PMS_STORES.pmsAttachments, { id: metadata.fileId, name: metadata.name, type: metadata.type, size: metadata.size, blob })
    await pmsPut(PMS_STORES.pmsAttachmentReferences, { id: 'other-store::existing-owner', fileIds: [metadata.fileId] })
    const result = await migrate(old.source)
    assert.equal(result.status, 'completed'); assert.equal((await pmsAll(PMS_STORES.pmsAttachments)).length, 1)
    assert.equal(await (await pmsGet<any>(PMS_STORES.pmsAttachments, metadata.fileId)).blob.text(), 'ABC')
    const owners = await pmsAll<any>(PMS_STORES.pmsAttachmentReferences)
    assert.equal(owners.length, 2); assert.deepEqual(owners.find(owner => owner.id === `${PMS_STORES.pmsMaterialPurchaseOrderDeltas}::${order.purchaseOrderNo}`).fileIds, [metadata.fileId]); assert.ok(owners.some(owner => owner.id === 'other-store::existing-owner'))
  } finally { fixture.restore() }
})
test('孤立或错位的目标版本记录阻断，不将已删除记录重新建回', async () => {
  const fixture = installPmsMemoryIdb(), order = purchase(), old = storage(JSON.stringify([order]))
  try {
    await pmsPut(PMS_STORES.pmsVersionSnapshots, { snapshotKey: `${PMS_STORES.pmsMaterialPurchaseOrderDeltas}::${order.purchaseOrderNo}`, version: 2 })
    await assert.rejects(migrate(old.source), /版本记录/)
    assert.deepEqual(await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas), []); assert.equal(old.controls.removes, 0)
  } finally { fixture.restore() }
})
