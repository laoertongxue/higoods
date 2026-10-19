import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLegacyAccessoryMigrationPlan, validateAccessoryWarehouseBackup,
  encodeAccessoryWarehouseBackup, parseAccessoryWarehouseBackup,
  restoreAccessoryWarehouseBackup,
  type AccessoryWarehouseBackup,
} from '../../src/data/wls/accessory-warehouse-migration.ts'
import { accessoryRecord } from '../../src/data/wls/accessory-warehouse-records.ts'
import { listEnabledAccessoryWarehouseLocations } from '../../src/data/wls/accessory-warehouse-master.ts'
import type { AccessoryPreparation } from '../../src/data/wls/accessory-warehouse-flow.ts'
import { createProductionMaterialPrepSeedStore, listMaterialPrepOrderProjections, persistProductionMaterialPrepStore, PRODUCTION_MATERIAL_PREP_STORAGE_KEY } from '../../src/data/fcs/cutting/production-material-prep.ts'

function preparation(): AccessoryPreparation {
  return { id: 'PREP-1', productionOrderId: 'PO-1', productionOrderNo: 'PO-001', styleName: '样例款', styleImageUrl: '/sample.jpg',
    techPackVersion: 'TP-1', cuttingFactoryId: null, cuttingFactoryName: null, version: 0, status: '配料中', remark: '', history: [],
    lines: [{ id: 'ACC-1', materialSku: 'ACC-001', materialName: '拉链', imageUrl: '/materials/accessory-zipper.jpg', color: '灰色', spec: '60cm',
      unit: '条', requiredQty: 100, preparedQty: 7, availableQty: 93, locationId: 'GTP-A-01', purpose: '其他', requiresCutting: false }] }
}
function legacy() {
  return { otherModuleMeta: { retained: true }, prepRecords: [
    { prepRecordId: 'MIXED-1', prepOrderId: 'PREP-1', prepLineId: 'ACC-1', recordStatus: 'CONFIRMED', confirmedAt: '2026-10-18 09:00:00', confirmedBy: '原仓管',
      preparedQty: null, rollCount: 2, items: [
        { prepRecordItemId: 'I-ACC', prepLineId: 'ACC-1', preparedQty: 7, rollCount: 0, sourceUnit: '条' },
        { prepRecordItemId: 'I-FAB', prepLineId: 'FAB-1', preparedQty: 11, rollCount: 2, sourceUnit: '米' },
      ] },
    { prepRecordId: 'DRAFT-1', prepOrderId: 'PREP-1', prepLineId: 'ACC-1', recordStatus: 'DRAFT', preparedAt: '2026-10-18 10:00:00', operatorName: '原仓管', preparedQty: 2, remark: '已登记待拣货' },
    { prepRecordId: 'OTHER-1', prepOrderId: 'PREP-2', prepLineId: 'WOOL-1', recordStatus: 'CONFIRMED', preparedQty: 3, unit: '公斤' },
  ], pickupRecords: [], pickupSessions: [], pickupNodeSnapshots: [], pickupReturnRecords: [], rejectRecords: [],
    stagingRecords: [{ stagingRecordId: 'STAGE-1', prepRecordId: 'MIXED-1', prepOrderId: 'PREP-1', status: '已确认' }], closedOrders: [] }
}

test('混合旧记录逐条归档且仅移出辅料明细，其他工艺、共享头、未知元数据完整保留', () => {
  const old = legacy(), raw = JSON.stringify(old), p = preparation()
  const result = buildLegacyAccessoryMigrationPlan(raw, [p])
  assert.deepEqual(result.issues, [])
  assert.equal(result.preparations.length, 1)
  assert.equal(result.preparations[0].lines[0].preparedQty, 7)
  assert.ok(result.preparations[0].history.some(row => row.action === '旧配料记录' && row.detail.includes('2 条') && row.detail.includes('待拣货')))
  const mixedArchive = result.entries.find(row => row.sourceId === 'MIXED-1')!
  assert.deepEqual(mixedArchive.entry, old.prepRecords[0])
  assert.equal(mixedArchive.retainedShared, true)
  const remaining = JSON.parse(result.remainingRaw!)
  assert.equal(remaining.prepRecords.length, 2)
  assert.deepEqual(remaining.prepRecords.find((row: any) => row.prepRecordId === 'OTHER-1'), old.prepRecords[2])
  assert.deepEqual(remaining.prepRecords[0].items, [old.prepRecords[0].items![1]])
  assert.equal(remaining.prepRecords[0].preparedQty, 11)
  assert.deepEqual(remaining.stagingRecords, old.stagingRecords)
  assert.deepEqual(remaining.otherModuleMeta, old.otherModuleMeta)
  assert.equal(JSON.stringify(old), raw)
})

test('未解决旧页面冲突备份独立标注且恢复提前整批拒绝，不进入任何数据库写入', async () => {
  const value = backup()
  value.conflicts = [{ id: 'CONFLICT-1', state: 'UNRESOLVED', sourceKey: PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
    sourceFingerprint: 'b'.repeat(64), detectedAfterMigration: true,
    entries: [{ preparationId: 'PREP-1', field: 'prepRecords', sourceId: 'OLD-LATE', entry: { prepRecordId: 'OLD-LATE', prepLineId: 'ACC-1', preparedQty: 3 } }] }]
  validateAccessoryWarehouseBackup(value)
  await assert.rejects(restoreAccessoryWarehouseBackup(value), /未解决.*冲突/)
  const encoded = await encodeAccessoryWarehouseBackup(value), parsed = await parseAccessoryWarehouseBackup(encoded)
  assert.deepEqual(parsed.conflicts, value.conflicts)
  assert.equal((parsed.records[0].value as AccessoryPreparation).lines[0].preparedQty, 7)
  const badState = structuredClone(value); (badState.conflicts![0] as any).state = 'MERGED'
  assert.throws(() => validateAccessoryWarehouseBackup(badState), /冲突片段不完整/)
  const missingAttachment = structuredClone(value); missingAttachment.conflicts![0].entries[0].entry.fileId = 'missing-file'
  assert.throws(() => validateAccessoryWarehouseBackup(missingAttachment), /附件实体/)
})

test('附件缺原始实体、非法数量和重复旧身份阻断，不允许借迁移清理原资料', () => {
  const old = legacy()
  ;(old.prepRecords[0] as any).imageNames = ['原现场照片.jpg']
  assert.match(buildLegacyAccessoryMigrationPlan(JSON.stringify(old), [preparation()]).issues.join(''), /缺少可恢复实体/)
  old.prepRecords[0].items![0].preparedQty = -1
  assert.match(buildLegacyAccessoryMigrationPlan(JSON.stringify(old), [preparation()]).issues.join(''), /数量无效/)
  old.prepRecords.push(structuredClone(old.prepRecords[0]))
  assert.match(buildLegacyAccessoryMigrationPlan(JSON.stringify(old), [preparation()]).issues.join(''), /重复记录/)
})

function backup(): AccessoryWarehouseBackup {
  return { format: 'higood-accessory-warehouse-backup', version: 1, exportedAt: '2026-10-19T00:00:00Z',
    records: [accessoryRecord('preparation', 'PREP-1', preparation())], dependencies: [], commands: [], files: [] }
}
test('本范围备份校验阻止版本错误、重复身份、负数量、越界记录和缺失调拨来源', () => {
  validateAccessoryWarehouseBackup(backup())
  const b = backup()
  assert.throws(() => validateAccessoryWarehouseBackup({ ...b, version: 2 }), /版本/)
  assert.throws(() => validateAccessoryWarehouseBackup({ ...b, records: [...b.records, ...b.records] }), /重复/)
  const negative = backup(); (negative.records[0].value as AccessoryPreparation).lines[0].preparedQty = -1
  assert.throws(() => validateAccessoryWarehouseBackup(negative), /数量/)
  assert.throws(() => validateAccessoryWarehouseBackup({ ...b, records: [{ id: 'other:1', collection: 'other', value: {} }] }), /越界/)
  const transfer = accessoryRecord('transfer', 'T-1', { id: 'T-1', productionOrderId: 'PO-1', preparationId: 'MISSING', lines: [{ id: 'L-1', materialSku: 'ACC-001', unit: '条', qty: 7 }] })
  assert.throws(() => validateAccessoryWarehouseBackup({ ...b, records: [...b.records, transfer] }), /缺少原配料/)
})

test('备份原始 Blob 及引用完整往返；缺实体与错误附件字节不会被接受', async () => {
  const b = backup(), fileId = `production-context-file:${'a'.repeat(64)}`
  ;(b.records[0].value as any).attachment = { $productionFile: fileId }
  assert.throws(() => validateAccessoryWarehouseBackup(b), /附件实体/)
  b.files = [{ id: fileId, blob: new Blob(['原始附件'], { type: 'text/plain' }) }]
  const encoded = await encodeAccessoryWarehouseBackup(b)
  const restored = await parseAccessoryWarehouseBackup(encoded)
  assert.equal(await restored.files[0].blob.text(), '原始附件')
  assert.equal(restored.files[0].blob.type, 'text/plain')
  assert.deepEqual(restored.records, b.records)
  await assert.rejects(parseAccessoryWarehouseBackup(new Blob([JSON.stringify({ ...b, files: [{ id: fileId, bytes: [-1] }] })])), /字节格式/)
})

test('整单实收备份拒绝未知行、负数、部分明细、他仓库位和调拨库位不一致，且在恢复写入前拒绝', async () => {
  const value = backup()
  const location = listEnabledAccessoryWarehouseLocations('HILON-2')[0].id
  const otherWarehouseLocation = listEnabledAccessoryWarehouseLocations('WH-FITTING-MAHAMERU')[0].id
  value.records.push(accessoryRecord('transfer', 'T-1', {
    id: 'T-1', kind: 'GTP_TO_SITE', productionOrderId: 'PO-1', preparationId: 'PREP-1',
    fromWarehouse: 'WH-FITTING-001', toWarehouse: 'HILON-2', status: '已收货', version: 3,
    lines: [{ id: 'T-L1', materialSku: 'ACC-001', unit: '条', qty: 7, toLocationId: location }],
  }), accessoryRecord('receipt', 'R-1', {
    id: 'R-1', transferId: 'T-1', warehouseCode: 'HILON-2', status: '已收货', version: 2,
    lines: [{ lineId: 'T-L1', qty: 7, locationId: location }],
  }))
  validateAccessoryWarehouseBackup(value)
  const cases = [
    (receipt: any) => { receipt.lines[0].lineId = 'UNKNOWN' },
    (receipt: any) => { receipt.lines[0].qty = -99 },
    (receipt: any) => { receipt.lines[0].qty = 6 },
    (receipt: any) => { receipt.lines = [] },
    (receipt: any) => { receipt.lines.push(structuredClone(receipt.lines[0])) },
    (receipt: any) => { receipt.lines[0].locationId = '' },
    (receipt: any) => { receipt.lines[0].locationId = otherWarehouseLocation },
    (_receipt: any, transfer: any) => { transfer.lines[0].toLocationId = 'OTHER-LOCATION' },
    (_receipt: any, transfer: any) => { transfer.status = '已出库待收货' },
  ]
  for (const corrupt of cases) {
    const changed = structuredClone(value)
    corrupt(changed.records[2].value, changed.records[1].value)
    assert.throws(() => validateAccessoryWarehouseBackup(changed), /实收明细/)
    // This unit runs without indexedDB: rejection must happen before a DB can be opened.
    await assert.rejects(restoreAccessoryWarehouseBackup(changed), /实收明细/)
  }
  for (const qty of [undefined, Number.NaN, 0]) {
    const changed = structuredClone(value), line = (changed.records[1].value as any).lines[0]
    if (qty === undefined) delete line.qty
    else line.qty = qty
    ;(changed.records[2].value as any).lines[0].qty = 999
    assert.throws(() => validateAccessoryWarehouseBackup(changed), /数量/)
    await assert.rejects(restoreAccessoryWarehouseBackup(changed), /数量/)
  }
  const cancelled = structuredClone(value)
  Object.assign(cancelled.records[2].value as any, { status: '已取消', lines: [], cancelledAt: '2026-10-19T00:00:00Z', cancellationReason: '裁剪工厂变更' })
  ;(cancelled.records[1].value as any).toWarehouse = 'WH-FITTING-MAHAMERU'
  validateAccessoryWarehouseBackup(cancelled)
  delete (cancelled.records[2].value as any).cancellationReason
  assert.throws(() => validateAccessoryWarehouseBackup(cancelled), /取消接收事项/)
  const pending = structuredClone(value)
  Object.assign(pending.records[2].value as any, { status: '待收货', lines: [] })
  assert.throws(() => validateAccessoryWarehouseBackup(pending), /待收事项/)
})

test('旧配料写保护阻断辅料变化，同时允许纯面料记录保存', () => {
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const before = createProductionMaterialPrepSeedStore()
  values.set(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(before))
  const projection = listMaterialPrepOrderProjections(storage).find(row => row.lines.some(line => line.materialType === '辅料') && row.lines.some(line => line.materialType === '面料'))!
  const fabric = projection.lines.find(line => line.materialType === '面料')!, accessory = projection.lines.find(line => line.materialType === '辅料')!
  const add = (lineId: string) => ({ prepRecordId: `USER:${lineId}`, prepOrderId: projection.order.prepOrderId, prepLineId: lineId, preparedQty: 1, rollCount: 0,
    recordStatus: 'DRAFT', items: [{ prepRecordItemId: `ITEM:${lineId}`, prepLineId: lineId, preparedQty: 1, rollCount: 0 }] })
  const wrong = structuredClone(before); wrong.prepRecords.push(add(accessory.prepLineId) as any)
  assert.throws(() => persistProductionMaterialPrepStore(wrong, storage), /辅料中央仓/)
  assert.equal(values.get(PRODUCTION_MATERIAL_PREP_STORAGE_KEY), JSON.stringify(before))
  const allowed = structuredClone(before); allowed.prepRecords.push(add(fabric.prepLineId) as any)
  persistProductionMaterialPrepStore(allowed, storage)
  assert.ok(JSON.parse(values.get(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)!).prepRecords.some((record: any) => record.prepRecordId === `USER:${fabric.prepLineId}`))
})
