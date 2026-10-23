import assert from 'node:assert/strict'
import test from 'node:test'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  listPostFinishingWaitProcessWarehouseRecords,
  loadPostFinishingDemoData,
  movePostFinishingWarehouseLocation,
} from '../../src/data/fcs/post-finishing-full-flow.ts'

test('后道待加工仓整库位移库保留批次数量并留下可追溯记录', () => {
  loadPostFinishingDemoData()
  const record = listPostFinishingWaitProcessWarehouseRecords().find((row) => row.lines.some((line) => line.availableQty > 0))
  assert.ok(record, '演示数据必须有可移动的待加工库存')
  const before = record.lines.map((line) => ({ skuId: line.sku.skuId, availableQty: line.availableQty }))
  const moves = movePostFinishingWarehouseLocation({
    mode: 'wait-process',
    locationCode: record.locationCode,
    targetLocationCode: 'A-01',
    reason: '现场整理库位',
    actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
  })
  assert.ok(moves.length >= 1)
  assert.equal(moves[0].fromLocationCode, record.locationCode)
  assert.equal(moves[0].toLocationCode, 'A-01')
  assert.equal(moves[0].reason, '现场整理库位')
  const after = listPostFinishingWaitProcessWarehouseRecords().find((row) => row.warehouseRecordId === record.warehouseRecordId)
  assert.equal(after?.locationCode, 'A-01')
  assert.deepEqual(after?.lines.map((line) => ({ skuId: line.sku.skuId, availableQty: line.availableQty })), before)
})

test('后道移库拒绝同库位、非法目标、空原因和无仓管岗位', () => {
  loadPostFinishingDemoData()
  const record = listPostFinishingWaitProcessWarehouseRecords().find((row) => row.lines.some((line) => line.availableQty > 0))!
  const base = { mode: 'wait-process' as const, locationCode: record.locationCode, actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver }
  assert.throws(() => movePostFinishingWarehouseLocation({ ...base, targetLocationCode: record.locationCode, reason: '同库位' }), /相同/)
  assert.throws(() => movePostFinishingWarehouseLocation({ ...base, targetLocationCode: '库位 A', reason: '非法' }), /目标库位/)
  assert.throws(() => movePostFinishingWarehouseLocation({ ...base, targetLocationCode: 'B-01', reason: '' }), /原因/)
  assert.throws(() => movePostFinishingWarehouseLocation({ ...base, targetLocationCode: 'B-01', reason: '测试', actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator }), /仓库人员/)
})
