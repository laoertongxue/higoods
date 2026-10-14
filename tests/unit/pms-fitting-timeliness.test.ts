import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords, pmsGet } from '../../src/data/pms/idb-storage.ts'
import { getPmsMaterialPurchaseOrder, publishPmsMaterialPurchaseOrders, type PmsMaterialPurchaseOrder } from '../../src/data/pms/material-purchase-orders.ts'
import type { PmsFittingTimelinessRow } from '../../src/data/pms/fitting-timeliness.ts'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
let moduleInstance = 0
const loadTimeline = () => import(new URL(`../../src/data/pms/fitting-timeliness.ts?fitting-contract=${++moduleInstance}`, import.meta.url).href) as Promise<typeof import('../../src/data/pms/fitting-timeliness.ts')>

test('lazy timeline load cannot turn a changed planned date into actual arrival', () => {
  execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    import { getPmsMaterialPurchaseOrder, publishPmsMaterialPurchaseOrders } from './src/data/pms/material-purchase-orders.ts'
    const order = getPmsMaterialPurchaseOrder('CGF-2026-0001')
    publishPmsMaterialPurchaseOrders([{ ...order, status: '已入库', expectedArrivalDate: '2030-12-31' }])
    const timeline = await import('./src/data/pms/fitting-timeliness.ts')
    const linked = timeline.listPmsFittingTimelinessRows().filter(row => row.purchaseOrderNo === order.purchaseOrderNo)
    assert.equal(linked.length, 2)
    for (const row of linked) {
      assert.equal(row.purchaseOrderStatus, '已入库')
      for (const field of ['arrivedLongmailAt', 'arrivedShenzhenAt', 'arrivedJakartaAt', 'arrivedBandungAt']) assert.equal(row[field], '')
      assert.equal(row.fittingSku, 'FAB-2026-0001')
      assert.equal(row.fittingImageUrl, '/materials/fabric-main.jpg')
    }
    assert.equal(timeline.filterPmsFittingTimeliness({purchaseOrderNo: order.purchaseOrderNo, purchaseOrderStatus: '已入库'}).length, 2)
    assert.ok(timeline.listPmsFittingTimelinessPurchaseOrderStatuses().includes('已入库'))
    assert.equal(timeline.summarizePmsFittingTimeliness({purchaseOrderNo: order.purchaseOrderNo}).fullyArrived, 0)
    publishPmsMaterialPurchaseOrders([{ ...order, status: '已关闭', expectedArrivalDate: '2031-12-31' }])
    assert.equal(timeline.filterPmsFittingTimeliness({purchaseOrderNo: order.purchaseOrderNo, purchaseOrderStatus: '已入库'}).length, 0)
    assert.equal(timeline.filterPmsFittingTimeliness({purchaseOrderNo: order.purchaseOrderNo, purchaseOrderStatus: '已关闭'}).length, 2)
    assert.ok(timeline.listPmsFittingTimelinessPurchaseOrderStatuses().includes('已关闭'))
    assert.equal(timeline.listPmsFittingTimelinessRows()[0].arrivedBandungAt, '')
  `], { cwd: projectRoot, stdio: 'pipe' })
})

test('timeline keeps all 13 fixture identities, exact material images and linked units', async () => {
  const timeline = await loadTimeline()
  const rows = timeline.listPmsFittingTimelinessRows()
  assert.deepEqual(rows.map(row => row.id), ['FIT-ASYAL26042588-1', 'FIT-ASYAL26042588-2', 'FIT-ASYAL26042588-3', 'FIT-ASYAL26080801-1', 'FIT-ASYAL26080801-2', 'FIT-ASYAP26042501-1', 'FIT-ASYER26081901-1', 'FIT-ASYER26081905-1', 'FIT-ASYER26081908-1', 'FIT-ASYNR26012101-1', 'FIT-ASYNR26032801-1', 'FIT-ASYQU25082783-1', 'FIT-ASYQU26052109-1'])
  const units = ['米', '个', '米', '米', '卷', '个', 'KG', '个']
  for (const [index, row] of rows.entries()) {
    const order = getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!
    assert.equal(row.purchaseOrderNo, `CGF-2026-${String(index % 8 + 1).padStart(4, '0')}`)
    assert.equal(row.fittingSku, order.materialCode)
    assert.equal(row.fittingImageUrl, order.materialImageUrl)
    assert.equal(order.unit, units[index % 8])
  }
  const returned = rows[0]
  returned.confirmedAt = '2099-01-01'
  assert.notEqual(timeline.listPmsFittingTimelinessRows()[0].confirmedAt, returned.confirmedAt)
})

test('direct hydration reads current purchase status and user dates without initial seed writes', async () => {
  const fixture = installPmsMemoryIdb()
  const order = structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!)
  try {
    const timeline = await loadTimeline()
    const candidate: PmsMaterialPurchaseOrder = { ...order, status: '已入库', expectedArrivalDate: '2030-12-31' }
    await pmsCommitRecords([{store: PMS_STORES.pmsMaterialPurchaseOrderDeltas, value: candidate}], {operationId: 'fitting-direct-mpo'})
    const saved: PmsFittingTimelinessRow = { ...timeline.listPmsFittingTimelinessRows()[0], confirmedAt: '2026-06-10 11:30:00', shippedAt: '2026-06-11', arrivedBandungAt: '2026-06-26', purchaseOrderStatus: '已采购' }
    await pmsCommitRecords([{store: PMS_STORES.pmsFittingTimeliness, value: saved}], {operationId: 'fitting-existing-node'})
    await timeline.hydratePmsFittingTimeliness()
    const row = timeline.listPmsFittingTimelinessRows().find(item => item.id === saved.id)!
    assert.equal(row.purchaseOrderStatus, '已入库')
    assert.equal(row.confirmedAt, saved.confirmedAt)
    assert.equal(row.shippedAt, saved.shippedAt)
    assert.equal(row.arrivedBandungAt, saved.arrivedBandungAt)
    assert.equal(row.arrivedJakartaAt, '')
    assert.equal(timeline.filterPmsFittingTimeliness({purchaseOrderStatus: '已采购', purchaseOrderNo: order.purchaseOrderNo}).length, 0)
    assert.ok(timeline.listPmsFittingTimelinessPurchaseOrderStatuses().includes('已入库'))
    assert.equal((await pmsAll(PMS_STORES.pmsFittingTimeliness)).length, 1)
    assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length, 1)
  } finally {
    publishPmsMaterialPurchaseOrders([order])
    fixture.restore()
  }
})

test('confirmed and shipped nodes survive independent timeline reload; invalid dates do not save', async () => {
  const fixture = installPmsMemoryIdb()
  try {
    const timeline = await loadTimeline()
    await timeline.hydratePmsFittingTimeliness()
    assert.equal((await pmsAll(PMS_STORES.pmsFittingTimeliness)).length, 0)
    const id = timeline.listPmsFittingTimelinessRows()[0].id
    await timeline.updatePmsFittingTimelinessConfirmedAt(id, '2026-06-12 08:00:00', 'fitting-confirm-node')
    await timeline.updatePmsFittingTimelinessShippedAt(id, '2026-06-13', 'fitting-ship-node')
    const stored = await pmsGet<PmsFittingTimelinessRow>(PMS_STORES.pmsFittingTimeliness, id)
    assert.equal(stored?.confirmedAt, '2026-06-12 08:00:00')
    assert.equal(stored?.shippedAt, '2026-06-13')
    const fresh = await loadTimeline()
    await fresh.hydratePmsFittingTimeliness()
    const row = fresh.listPmsFittingTimelinessRows().find(item => item.id === id)!
    assert.equal(row.confirmedAt, stored?.confirmedAt)
    assert.equal(row.shippedAt, stored?.shippedAt)
    await assert.rejects(fresh.updatePmsFittingTimelinessConfirmedAt(id, 'bad-date', 'fitting-invalid'), /有效日期/)
    await assert.rejects(fresh.updatePmsFittingTimelinessShippedAt(id, '2026-06-01', 'fitting-too-early'), /不能早于发起/)
    assert.deepEqual(await pmsGet(PMS_STORES.pmsFittingTimeliness, id), stored)
  } finally { fixture.restore() }
})

test('aborted node transaction preserves prior dates and allows the same form to retry', async () => {
  const fixture = installPmsMemoryIdb()
  try {
    const timeline = await loadTimeline()
    await timeline.hydratePmsFittingTimeliness()
    const before = timeline.listPmsFittingTimelinessRows()[0]
    fixture.setFailWrites(true)
    await assert.rejects(timeline.updatePmsFittingTimelinessConfirmedAt(before.id, '2026-06-14 08:00:00', 'fitting-abort-retry'), /abort|中止|存储|数据库/i)
    assert.deepEqual(timeline.listPmsFittingTimelinessRows()[0], before)
    assert.equal(await pmsGet(PMS_STORES.pmsFittingTimeliness, before.id), undefined)
    fixture.setFailWrites(false)
    await timeline.updatePmsFittingTimelinessConfirmedAt(before.id, '2026-06-14 08:00:00', 'fitting-abort-retry')
    assert.equal((await pmsGet<PmsFittingTimelinessRow>(PMS_STORES.pmsFittingTimeliness, before.id))?.confirmedAt, '2026-06-14 08:00:00')
  } finally { fixture.restore() }
})

test('comma-separated style, material and purchase queries match either identifier and ignore empty terms', async () => {
  const fixture = installPmsMemoryIdb()
  try {
    const timeline = await loadTimeline()
    assert.equal(timeline.filterPmsFittingTimeliness({ garmentSpu: ' sh-2607, SK-2604， ' }).length, 6)
    assert.equal(timeline.filterPmsFittingTimeliness({ fittingSku: 'FAB-2026-0001,ACC-2026-0002' }).length, 6)
    assert.equal(timeline.filterPmsFittingTimeliness({ purchaseOrderNo: 'CGF-2026-0001，CGF-2026-0007' }).length, 3)
    assert.equal(timeline.filterPmsFittingTimeliness({ garmentSpu: ' , ， ' }).length, 13)
    assert.equal(timeline.filterPmsFittingTimeliness({ garmentSpu: 'CHECK-unknown,SH-2607', fittingSku: 'ACC-2026-0002' }).length, 2)
  } finally { fixture.restore() }
})

test('date-only nodes preserve day precision and allow the initiation day without inventing an earlier time', async () => {
  const fixture = installPmsMemoryIdb()
  try {
    const timeline = await loadTimeline(), row = timeline.listPmsFittingTimelinessRows()[0]
    const day = row.initiatedAt.slice(0, 10)
    await timeline.updatePmsFittingTimelinessShippedAt(row.id, day, 'fitting-date-only-shipped')
    await timeline.updatePmsFittingTimelinessConfirmedAt(row.id, day, 'fitting-date-only-confirmed')
    const saved = await pmsGet<PmsFittingTimelinessRow>(PMS_STORES.pmsFittingTimeliness, row.id)
    assert.equal(saved?.shippedAt, day)
    assert.equal(saved?.confirmedAt, day)
    await assert.rejects(timeline.updatePmsFittingTimelinessShippedAt(row.id, '2026-06-08', 'fitting-day-earlier'), /不能早于发起/)
    await assert.rejects(timeline.updatePmsFittingTimelinessShippedAt(row.id, `${day} 08:59:00`, 'fitting-time-earlier'), /不能早于发起/)
    await assert.rejects(timeline.updatePmsFittingTimelinessShippedAt(row.id, '2030-02-30', 'fitting-invalid-calendar'), /有效日期/)
  } finally { fixture.restore() }
})
