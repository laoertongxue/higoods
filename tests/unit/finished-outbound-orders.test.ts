import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FINISHED_OUTBOUND_SEED,
  OUTBOUND_STATUSES,
  applyFinishedOutboundAction,
  emptyFinishedOutboundFilters,
  filterFinishedOutboundOrders,
  loadFinishedOutboundOrders,
  outboundQuantity,
  saveFinishedOutboundAction,
  type FinishedOutboundFilters,
  type FinishedOutboundOrder,
} from '../../src/data/wls/finished-outbound-orders.ts'

const at = '2026-10-20 12:00:00'
function fixture(patch: Partial<FinishedOutboundOrder> = {}): FinishedOutboundOrder {
  return { ...structuredClone(FINISHED_OUTBOUND_SEED[0]!), ...patch }
}
function filters(patch: Partial<FinishedOutboundFilters> = {}): FinishedOutboundFilters {
  return { ...emptyFinishedOutboundFilters(), ...patch }
}

test('静态演示保留三条参照和42条对齐样本，增加30条可追溯QC需求', () => {
  assert.equal(FINISHED_OUTBOUND_SEED.length, 75)
  assert.equal(new Set(FINISHED_OUTBOUND_SEED.map(row => row.id)).size, 75)
  assert.equal(FINISHED_OUTBOUND_SEED.filter(row => row.outboundOrderNo.startsWith('DEMO-DN-')).length, 42)
  assert.equal(FINISHED_OUTBOUND_SEED.filter(row => row.outboundOrderNo.startsWith('DEMO-QC-DN-')).length, 30)
  assert.deepEqual([...new Set(FINISHED_OUTBOUND_SEED.map(row => row.status))].sort(), [...OUTBOUND_STATUSES].sort())
  assert.deepEqual(FINISHED_OUTBOUND_SEED.slice(0, 3).map(row => row.outboundOrderNo), ['DN2TENR6HH1Q80476789', 'DN2TENR3X2SXS0475456', 'DN2TENR3DSL5OG475179'])
  assert.equal(FINISHED_OUTBOUND_SEED[0]!.products[0]!.sku, 'FADSS2610168888-sameasphoto-m')
  assert.equal(FINISHED_OUTBOUND_SEED[1]!.products[0]!.imageUrl, '/images/wls-outbound/ASYSA26100755-coffee.webp')
  assert.ok(FINISHED_OUTBOUND_SEED.some(row => row.products.length > 1))
  assert.ok(FINISHED_OUTBOUND_SEED.some(row => row.labelDownloadedAt && !row.printedAt && row.printCount === 0))
})

test('搜索单号仅查询出库、关联及跟踪号，不误查备注和商品', () => {
  const rows = [fixture({ relatedOrderNo: 'REL-ABC', trackingNo: 'TRACK-XYZ', remark: 'in-remark' })]
  assert.equal(filterFinishedOutboundOrders(rows, filters({ keyword: ' rel-abc ' })).length, 1)
  assert.equal(filterFinishedOutboundOrders(rows, filters({ keyword: 'track-xyz' })).length, 1)
  assert.equal(filterFinishedOutboundOrders(rows, filters({ keyword: 'in-remark' })).length, 0)
  assert.equal(filterFinishedOutboundOrders(rows, filters({ keyword: rows[0]!.products[0]!.spu })).length, 0)
})

test('查询条件以AND组合，SKU/SPU大小写无关，状态同时生效', () => {
  const row = fixture({ status: '已打单', isKol: true, labelDownloadedAt: at })
  const query = filters({ keyword: row.relatedOrderNo, spu: 'fadss', sku: 'SAMEASPHOTO', warehouse: 'F&M WH', platform: 'Tiktok', hasLabel: 'yes', orderType: '预售订单', pickType: 'single', kol: 'yes' })
  assert.equal(filterFinishedOutboundOrders([row], query, '已打单').length, 1)
  assert.equal(filterFinishedOutboundOrders([row], { ...query, warehouse: 'A&C WH' }, '已打单').length, 0)
  assert.equal(filterFinishedOutboundOrders([row], query, '已出库').length, 0)
  assert.equal(filterFinishedOutboundOrders([row], filters({ hasLabel: 'no' })).length, 0)
  assert.equal(filterFinishedOutboundOrders([row], filters({ kol: 'no' })).length, 0)
})

test('多件拣货依据总件数，单SKU多件亦属于多件', () => {
  const one = fixture()
  const many = fixture({ id: 'many', products: [{ ...one.products[0]!, quantity: 3 }] })
  assert.equal(outboundQuantity(many), 3)
  assert.deepEqual(filterFinishedOutboundOrders([one, many], filters({ pickType: 'single' })).map(row => row.id), [one.id])
  assert.deepEqual(filterFinishedOutboundOrders([one, many], filters({ pickType: 'multiple' })).map(row => row.id), ['many'])
})

test('库存充足要求每个商品库位合计充足，未知与零库存不能当充足', () => {
  const base = fixture().products[0]!
  const enough = fixture({ id: 'enough', products: [{ ...base, quantity: 3, locations: [{ name: 'A', quantity: 1 }, { name: 'B', quantity: 2 }] }] })
  const partial = fixture({ id: 'partial', products: [...enough.products, { ...base, locations: [] }] })
  const zero = fixture({ id: 'zero', products: [{ ...base, locations: [{ name: 'A', quantity: 0 }] }] })
  assert.deepEqual(filterFinishedOutboundOrders([enough, partial, zero], filters({ stock: 'available' })).map(row => row.id), ['enough'])
  assert.deepEqual(filterFinishedOutboundOrders([enough, partial, zero], filters({ stock: 'shortage' })).map(row => row.id), ['partial', 'zero'])
})

test('日期与分钟结束范围包含完整当天/分钟，缺日期记录从有范围查询中排除', () => {
  const rows = [fixture({ id: 'start', shippedAt: '2026-10-20 00:00:00' }), fixture({ id: 'end', shippedAt: '2026-10-20 23:59:59' }), fixture({ id: 'empty', shippedAt: '' })]
  assert.deepEqual(filterFinishedOutboundOrders(rows, filters({ shippedFrom: '2026-10-20', shippedTo: '2026-10-20' })).map(row => row.id), ['start', 'end'])
  const minute = [fixture({ createdAt: '2026-10-20 10:31:59' }), fixture({ id: 'next', createdAt: '2026-10-20 10:32:00' })]
  assert.equal(filterFinishedOutboundOrders(minute, filters({ createdFrom: '2026-10-20T10:31', createdTo: '2026-10-20T10:31' })).length, 1)
  assert.equal(filterFinishedOutboundOrders(rows, filters({ deadlineFrom: '2026-11-22' })).length, 0)
})

test('排序升降序均将未知日期置后，不修改输入顺序', () => {
  const rows = [fixture({ id: 'empty', pickedAt: '' }), fixture({ id: 'late', pickedAt: '2026-10-20 12:00:00' }), fixture({ id: 'early', pickedAt: '2026-10-20 11:00:00' })]
  assert.deepEqual(filterFinishedOutboundOrders(rows, filters({ sortField: 'pickedAt', sortDirection: 'asc' })).map(row => row.id), ['early', 'late', 'empty'])
  assert.deepEqual(filterFinishedOutboundOrders(rows, filters({ sortField: 'pickedAt', sortDirection: 'desc' })).map(row => row.id), ['late', 'early', 'empty'])
  assert.deepEqual(rows.map(row => row.id), ['empty', 'late', 'early'])
})

test('重打面单增加次数、更新最后打印时间和版本，不改原记录', () => {
  const row = fixture({ status: '已打单', printCount: 2, printedAt: '2026-10-20 11:00:00' })
  const logCount = row.logs.length
  const next = applyFinishedOutboundAction(row, 'print', at)
  assert.equal(next.printCount, 3)
  assert.equal(next.printedAt, at)
  assert.equal(next.version, 2)
  assert.equal(next.logs.at(-1)!.action, '打印面单')
  assert.equal(row.printCount, 2)
  assert.equal(next.logs.length, logCount + 1)
  assert.equal(row.logs.length, logCount)
})

test('取消打单后出库单为已取消，记录取消时间并保留历史打印事实', () => {
  const row = fixture({ status: '已打单', printCount: 2, printedAt: '2026-10-20 11:00:00' })
  const next = applyFinishedOutboundAction(row, 'cancel-print', at)
  assert.equal(next.status, '已取消')
  assert.equal(next.cancelledAt, at)
  assert.equal(next.updatedAt, at)
  assert.equal(next.version, 2)
  assert.equal(next.printCount, 2)
  assert.equal(next.printedAt, row.printedAt)
  assert.equal(next.logs.at(-1)!.action, '取消打单')
  assert.equal(row.status, '已打单')
  assert.equal(row.cancelledAt, '')
  assert.deepEqual(filterFinishedOutboundOrders([next], filters(), '已取消'), [next])
  assert.equal(filterFinishedOutboundOrders([next], filters(), '已打单').length, 0)
  for (const action of ['print', 'cancel-print', 'outbound', 'download-label'] as const) {
    assert.throws(() => applyFinishedOutboundAction(next, action, at))
  }
})

test('确认出库产生出库事实与操作日志，不改变商品库存参考', () => {
  const row = fixture({ status: '已打单' })
  const next = applyFinishedOutboundAction(row, 'outbound', at)
  assert.equal(next.status, '已出库')
  assert.equal(next.shippedAt, at)
  assert.deepEqual(next.products, row.products)
  assert.equal(next.logs.at(-1)!.action, '确认出库')
})

test('非已打单状态阻止重打、取消打单与确认出库', () => {
  for (const status of OUTBOUND_STATUSES.filter(value => value !== '已打单')) {
    for (const action of ['print', 'cancel-print', 'outbound'] as const) assert.throws(() => applyFinishedOutboundAction(fixture({ status }), action, at), /仅已打单/)
  }
})

test('下载面单独立于打印，仅Tiktok可用且阻断待处理及已取消', () => {
  const row = fixture({ status: '拣货完成', platform: 'Tiktok' })
  const next = applyFinishedOutboundAction(row, 'download-label', at)
  assert.equal(next.labelDownloadedAt, at)
  assert.equal(next.status, '拣货完成')
  assert.equal(next.printCount, 0)
  assert.equal(next.printedAt, '')
  assert.throws(() => applyFinishedOutboundAction(fixture({ status: '已打单', platform: 'Shopee' }), 'download-label', at), /不能下载/)
  assert.throws(() => applyFinishedOutboundAction(fixture(), 'download-label', at), /不能下载/)
  assert.throws(() => applyFinishedOutboundAction(fixture({ status: '已取消' }), 'download-label', at), /不能下载/)
})

test('IndexedDB不可用显式报错，读失败不伪装静态结果或写入后备', async () => {
  assert.equal(typeof globalThis.indexedDB, 'undefined')
  await assert.rejects(loadFinishedOutboundOrders(), /无法读取/)
  await assert.rejects(saveFinishedOutboundAction(['7010498'], { '7010498': 1 }, 'print', 'no-db'), /无法读取/)
})

test('空选择与缺操作标识在打开数据库前被阻断', async () => {
  await assert.rejects(saveFinishedOutboundAction([], {}, 'print', 'empty'), /先选择/)
  await assert.rejects(saveFinishedOutboundAction(['7010498'], { '7010498': 1 }, 'print', ' '), /操作标识/)
})
