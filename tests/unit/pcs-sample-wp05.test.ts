import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listStyleArchives } from '../../src/data/pcs-style-archive-repository.ts'
import { listSkuArchives } from '../../src/data/pcs-sku-archive-repository.ts'
import { createTestingOrder, updateTestingOrder, completeSampleInbound, completeLabelStep, advanceTestingOrder, getTestingOrderById, setBulkDecision, hasPassedTestingOrder, listTestingOrders } from '../../src/data/pcs-testing-order-repository.ts'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { PCS_SAMPLE_STORAGE_KEY, getPcsSampleById, listPcsSampleRecords, listPcsSampleTransfers, listPcsSampleLedgerEvents, listPcsSampleTypeConversionLogs, transferPcsSample, convertPcsSampleType, canCompletePcsSampleTagging } from '../../src/data/pcs-sample-management.ts'
import { getPcsSampleLocationById } from '../../src/data/pcs-sample-location-master.ts'

test('SAMP-001–013 Mock: receipt → all SKU tags → live/home → production/factory/department/warehouse → marketing, with adversarial gates', () => {
  const style = listStyleArchives().find(s => s.mainImageUrl && listSkuArchives().filter(k => k.styleId === s.styleId).length >= 2 && !s.styleId.includes('SPU_QC'))!
  assert.ok(style)
  const skuCodes = listSkuArchives().filter(s => s.styleId === style.styleId).slice(0, 2).map(s => s.skuCode)
  const submittedCodes = [...skuCodes]
  const created = createTestingOrder({ styleId: style.styleId, skuCodes: submittedCodes })
  assert.equal(created.ok, true, created.message)
  const id = created.order!.testingOrderId
  submittedCodes.pop(); created.order!.skuCodes.pop(); listTestingOrders().find(o => o.testingOrderId === id)!.skuCodes.pop()
  assert.deepEqual(getTestingOrderById(id)!.skuCodes, skuCodes, 'input, create and list aliases cannot mutate SKU membership')
  assert.equal(completeLabelStep(id, skuCodes[0]).ok, false, 'before receipt')
  assert.equal(setBulkDecision(id, '是', '绕过').ok, false)
  assert.equal(hasPassedTestingOrder(style.styleId), false)
  assert.throws(() => updateTestingOrder('to_seed_buyer_kill', { bulkDecision: '是' }), /对应业务动作/)
  const detached = getTestingOrderById(id)!
  detached.currentStepKey = 'bulk-decision'
  assert.equal(getTestingOrderById(id)!.currentStepKey, 'archive', 'read results cannot mutate stored flow')
  assert.equal(advanceTestingOrder(id, 'logistics').ok, true)
  updateTestingOrder(id, { logisticsCarrier: 'Mock 快递', logisticsTrackingNo: 'MOCK-001' })
  assert.equal(advanceTestingOrder(id, 'sample-inbound').ok, true)
  assert.throws(() => updateTestingOrder(id, { currentStepKey: 'buyer-confirm' }), /对应业务动作/)
  const before = listPcsSampleRecords().length
  assert.equal(completeSampleInbound(id, 'Mock 实物到样', '仓管').ok, true)
  assert.equal(listPcsSampleRecords().length, before + 2)
  assert.equal(completeSampleInbound(id, '重复').ok, false)
  assert.equal(advanceTestingOrder(id, 'buyer-confirm').ok, false, 'cannot skip tag')
  assert.equal(completeLabelStep(id, 'WRONG').ok, false)
  const sampleId = `testing-${id}-${skuCodes[0]}`
  assert.equal(transferPcsSample(sampleId, 'loc-live-01', '管理员', '未贴码').ok, false)
  assert.equal(completeLabelStep(id, skuCodes[0], '仓管').ok, true)
  assert.equal(getTestingOrderById(id)!.currentStepKey, 'label', 'one of two is not completion')
  const taggedEvents = listPcsSampleLedgerEvents().filter(e => e.sampleId === sampleId && e.eventType === '打标').length
  const historyCount = getTestingOrderById(id)!.history.length
  completeLabelStep(id, skuCodes[0], '仓管')
  assert.equal(getTestingOrderById(id)!.history.length, historyCount)
  assert.equal(listPcsSampleLedgerEvents().filter(e => e.sampleId === sampleId && e.eventType === '打标').length, taggedEvents, 'tag retry does not duplicate ledger')
  assert.equal(completeLabelStep(id, skuCodes[1], '仓管').ok, true)
  assert.equal(getTestingOrderById(id)!.currentStepKey, 'buyer-confirm')
  assert.equal(canCompletePcsSampleTagging(getPcsSampleById(sampleId)!), true)
  assert.equal(getPcsSampleById(sampleId)!.source!.code, created.order!.orderCode)
  const snap = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  for (const [location, reason] of [['loc-live-01', '营销直播'], ['loc-home-01', '达人家播']] as const) assert.equal(transferPcsSample(sampleId, location, '管理员', reason).ok, true)
  assert.equal(convertPcsSampleType(sampleId, 'production', '管理员', '转为工厂跟版').ok, true)
  for (const location of ['loc-factory-01', 'loc-dept-01', 'loc-wh-01']) assert.equal(transferPcsSample(sampleId, location, '管理员', '生产样衣交接').ok, true)
  assert.equal(convertPcsSampleType(sampleId, 'marketing', '管理员', '返回营销').ok, true)
  const invalidBefore = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  assert.equal(transferPcsSample(sampleId, 'invalid', '管理员', '位置错误').ok, false)
  assert.equal(transferPcsSample(sampleId, 'loc-wh-01', '管理员', '相同位置').ok, false)
  assert.equal(transferPcsSample(sampleId, 'loc-home-01', '管理员', '').ok, false)
  assert.equal(convertPcsSampleType(sampleId, 'production', '', '原因').ok, false)
  assert.equal(convertPcsSampleType(sampleId, 'other' as never, '管理员', '原因').ok, false)
  assert.equal(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY), invalidBefore, 'invalid commands never write')
  assert.equal(transferPcsSample(sampleId, 'loc-dept-01', '管理员', '营销样衣送商品部核对').ok, true)
  assert.ok(listPcsSampleTransfers().find(e => e.sampleId === sampleId)?.riskFlags.includes('例外用途'))
  assert.equal(listPcsSampleTypeConversionLogs(sampleId).length, 2)
  assert.ok(listPcsSampleTransfers().every(e => getPcsSampleLocationById(e.fromLocationId) && getPcsSampleLocationById(e.toLocationId)), 'all actual and Mock flows reference valid locations')
  assert.notEqual(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY), snap)
  assert.equal(getPcsSampleById(sampleId)!.currentLocationId, 'loc-dept-01')
})
