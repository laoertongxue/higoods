import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { decodePcsRecordSnapshot } from '../../src/data/pcs-record-codec.ts'
import { listTestingOrders } from '../../src/data/pcs-testing-order-repository.ts'
import {
  PCS_SAMPLE_STORAGE_KEY,
  receiveTestingOrderSamples,
  labelTestingOrderSample,
  getPcsSampleById,
  listPcsSampleRequests,
  listPcsSampleLedgerEvents,
  listPcsSampleTransfers,
  listPcsSampleReturnCases,
  listPcsSampleStocktakeDiffs,
  savePcsSampleRequestDraft,
  actPcsSampleRequest,
  createPcsSampleReturnCase,
  actPcsSampleReturnCase,
  resolvePcsSampleStocktake,
  transferPcsSample,
  type PcsSampleRequestDraft,
} from '../../src/data/pcs-sample-management.ts'
function fixture(n: string) {
  const order = {
    ...listTestingOrders()[0],
    testingOrderId: `repair-${n}`,
    sampleInboundAt: '2026-10-01 09:00:00',
    labeledAt: '',
    skuCodes: [`REPAIR-${n}-blue-m`],
  }
  receiveTestingOrderSamples(order, '仓管')
  labelTestingOrderSample(order, order.skuCodes[0], '仓管')
  return `testing-${order.testingOrderId}-${order.skuCodes[0]}`
}
const input = (id: string, sampleIds: string[]): PcsSampleRequestDraft => ({
  requestId: id,
  responsibleSite: '深圳样衣间',
  sampleIds,
  purpose: '直播试穿',
  applicant: '申请人',
  receiver: '接收人',
  targetLocationId: 'loc-live-01',
  returnLocationId: 'loc-wh-01',
  useStartedAt: '2099-10-07T10:00',
  expectedReturnAt: '2099-10-08T18:00',
  remark: '测试',
})
test('SAMPLE-FIX-01–05/11: actual request→reserve→approve→pickup→return→receipt; stable own IDs and detached reads', () => {
  const id = fixture('a'),
    id2 = fixture('b'),
    r = savePcsSampleRequestDraft(input('repair-req', [id, id2]))
  assert.equal(r.status, '草稿')
  assert.equal(getPcsSampleById(id)!.occupancyType, '无')
  r.sampleIds.pop()
  assert.equal(listPcsSampleRequests().find((r) => r.requestId === 'repair-req')!.sampleIds.length, 2)
  const stale = r.revision
  savePcsSampleRequestDraft({ ...input('repair-req', [id, id2]), remark: '修改' }, r.revision)
  assert.throws(() => savePcsSampleRequestDraft(input('repair-req', [id]), stale), /重新读取/)
  actPcsSampleRequest('repair-req', 'submit', '申请人')
  assert.equal(getPcsSampleById(id)!.status, '预占锁定')
  assert.equal(getPcsSampleById(id)!.useRequestId, 'repair-req')
  assert.equal(transferPcsSample(id, 'loc-home-01', '管理员', '绕行').ok, false)
  const before = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  assert.throws(() => actPcsSampleRequest('repair-req', 'submit', '申请人'), /状态/)
  assert.equal(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY), before)
  actPcsSampleRequest('repair-req', 'approve', '申请人')
  actPcsSampleRequest('repair-req', 'pickup', '仓管')
  assert.equal(getPcsSampleById(id)!.currentLocationId, 'loc-live-01')
  assert.equal(getPcsSampleById(id)!.occupiedBy, '接收人')
  assert.throws(() => actPcsSampleRequest('repair-req', 'cancel', '管理员', '取消'), /状态/)
  actPcsSampleRequest('repair-req', 'return', '使用人')
  assert.equal(getPcsSampleById(id)!.status, '借出占用')
  actPcsSampleRequest('repair-req', 'receive', '仓管')
  assert.equal(getPcsSampleById(id)!.currentLocationId, 'loc-wh-01')
  assert.equal(getPcsSampleById(id)!.occupancyType, '无')
  assert.equal(listPcsSampleRequests().find((r) => r.requestId === 'repair-req')!.status, '已完成')
  assert.deepEqual(
    listPcsSampleLedgerEvents()
      .filter((e) => e.sampleId === id)
      .slice(0, 3)
      .map((e) => e.eventType),
    ['归还', '借出', '预占'],
  )
  assert.equal(listPcsSampleTransfers().find((t) => t.sampleId === id)!.fromLocationId, 'loc-live-01')
  const rows = decodePcsRecordSnapshot(PCS_SAMPLE_STORAGE_KEY, pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)!)
  assert.ok(rows.some((r) => r.id.endsWith('/requests/repair-req')))
  assert.equal(rows.filter((r) => r.id.includes('/records/')).length, 2)
})
test('SAMPLE-FIX-03/05: all invalid input blocks writes; cancellation/rejection frees only own reservation', () => {
  const id = fixture('gates'),
    good = input('repair-cancel', [id])
  const before = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  for (const bad of [
    { ...good, sampleIds: [] },
    { ...good, sampleIds: [id, id] },
    { ...good, targetLocationId: 'missing' },
    { ...good, returnLocationId: 'loc-home-01' },
    { ...good, expectedReturnAt: 'nonsense' },
    { ...good, responsibleSite: '雅加达样衣间' as const },
  ]) {
    assert.throws(() => savePcsSampleRequestDraft(bad))
    assert.equal(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY), before)
  }
  savePcsSampleRequestDraft(good)
  actPcsSampleRequest(good.requestId, 'submit', '申请人')
  assert.throws(() => savePcsSampleRequestDraft(input('another', [id])), /已占用/)
  assert.throws(() => actPcsSampleRequest(good.requestId, 'reject', '审批人', ''), /原因/)
  actPcsSampleRequest(good.requestId, 'reject', '审批人', '用途不符')
  assert.equal(getPcsSampleById(id)!.status, '在库可用')
  const next = input('repair-cancel2', [id])
  savePcsSampleRequestDraft(next)
  actPcsSampleRequest(next.requestId, 'submit', '申请人')
  actPcsSampleRequest(next.requestId, 'approve', '审批人')
  actPcsSampleRequest(next.requestId, 'cancel', '申请人', '取消使用')
  assert.equal(getPcsSampleById(id)!.occupancyType, '无')
})
test('SAMPLE-FIX-08/09/11: cases and stocktake persist independently, cannot execute twice or masquerade as adjustment', () => {
  const id = fixture('case')
  createPcsSampleReturnCase({
    caseId: 'repair-case',
    sampleId: id,
    caseType: '退货',
    reason: '质量不符',
    target: '供应商收货地址',
    actor: '管理员',
  })
  assert.equal(getPcsSampleById(id)!.status, '待处置')
  assert.equal(transferPcsSample(id, 'loc-home-01', '管理员', '绕过案件').ok, false)
  assert.throws(() => actPcsSampleReturnCase('repair-case', 'execute', '仓管', '寄回证据'), /状态/)
  actPcsSampleReturnCase('repair-case', 'approve', '审核人', '同意')
  actPcsSampleReturnCase('repair-case', 'execute', '仓管', '运单 MOCK-123 已交寄')
  assert.equal(getPcsSampleById(id)!.status, '已退货')
  assert.equal(listPcsSampleReturnCases().find((r) => r.caseId === 'repair-case')!.status, '已结案')
  assert.throws(() => actPcsSampleReturnCase('repair-case', 'execute', '仓管', '重复'), /状态/)
  const id2 = fixture('dispose')
  createPcsSampleReturnCase({
    caseId: 'repair-case2',
    sampleId: id2,
    caseType: '处置',
    reason: '破损',
    target: '',
    actor: '管理员',
  })
  actPcsSampleReturnCase('repair-case2', 'reject', '审核人', '可继续使用')
  assert.equal(getPcsSampleById(id2)!.status, '在库可用')
  const original = JSON.stringify(getPcsSampleById('smp-004'))
  assert.throws(() => resolvePcsSampleStocktake('diff-002', 'close', '仓管', '处理结论'), /先核查/)
  resolvePcsSampleStocktake('diff-002', 'investigate', '仓管', '核查在途')
  resolvePcsSampleStocktake('diff-002', 'close', '仓管', '确认在途差异，按物流单继续跟踪')
  assert.equal(listPcsSampleStocktakeDiffs().find((d) => d.diffId === 'diff-002')!.status, '已关闭')
  assert.equal(JSON.stringify(getPcsSampleById('smp-004')), original, 'no synthetic WMS adjustment')
  const rows = decodePcsRecordSnapshot(PCS_SAMPLE_STORAGE_KEY, pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)!)
  assert.ok(rows.some((r) => r.id.endsWith('/returnCases/repair-case')))
  assert.ok(rows.some((r) => r.id.endsWith('/stocktakeDiffs/diff-002')))
})
