import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PCS_SAMPLE_STORAGE_KEY, getPcsSampleLabelIdentity, receiveTestingOrderSamples, listPcsSampleRecords, buildPcsSampleTagCode, resolvePcsSampleLabelSku, convertPcsSampleType } from '../../src/data/pcs-sample-management.ts'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { listTestingOrders, completeLabelStep } from '../../src/data/pcs-testing-order-repository.ts'
import { sampleLabelHtml, sampleLabelDocument, sampleLabelSettings } from '../../src/pages/pcs-sample-label.ts'

test('HG-001/002/004: SKU identity survives duplicate receipts, transfers and repeats; HG resolves SKU', () => {
  const before = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  const seed = getPcsSampleLabelIdentity('SKU-DRESS-RED-M')!
  assert.match(seed.hgCode, /^HG\d+$/)
  assert.equal(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY), before, 'read does not write Mock seeds')
  const template = listTestingOrders()[0]
  const first = { ...template, testingOrderId: 'hg-test-1', sampleInboundAt: '2026-10-01 10:00:00', skuCodes: ['HG-TEST-blue-m','HG-TEST-blue-l'] }
  receiveTestingOrderSamples(first, '仓管')
  const identity = getPcsSampleLabelIdentity(first.skuCodes[0])!
  const other = getPcsSampleLabelIdentity(first.skuCodes[1])!
  assert.equal(Number(other.hgCode.slice(2)), Number(identity.hgCode.slice(2)) + 1)
  assert.equal(identity.registeredAt, first.sampleInboundAt)
  assert.equal(buildPcsSampleTagCode(identity.skuCode), identity.hgCode)
  assert.equal(resolvePcsSampleLabelSku(identity.hgCode), identity.skuCode)
  assert.equal(resolvePcsSampleLabelSku('HG000'), null)
  identity.hgCode = 'HG999'; assert.notEqual(getPcsSampleLabelIdentity(first.skuCodes[0])!.hgCode, identity.hgCode, 'returned identity is detached')
  const original = getPcsSampleLabelIdentity(first.skuCodes[0])!
  receiveTestingOrderSamples({ ...first, testingOrderId: 'hg-test-2', sampleInboundAt: '2026-10-06 12:00:00' }, '仓管')
  assert.deepEqual(getPcsSampleLabelIdentity(original.skuCode), original, 'same SKU on another receipt retains earliest registration identity')
  const row = listPcsSampleRecords().find(row => row.sampleId === `testing-hg-test-1-${original.skuCode}`)!
  convertPcsSampleType(row.sampleId, 'production', '管理员', '跟版')
  assert.deepEqual(getPcsSampleLabelIdentity(original.skuCode), original)
  assert.equal(completeLabelStep('to_seed_buyer_kill', original.hgCode).ok, false, 'HG from other SKU/order cannot tag this order')
})

test('HG-005/006/008: printed data and bounded settings; no truncation, images or state writes', () => {
  const before = pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)
  const identity = { id: 'x', skuCode: 'MODXU26081404-blue-m', hgCode: 'HG1761420', registeredAt: '2026-08-26 12:30:00' }
  const html = sampleLabelHtml(identity, { width: 60, height: 40 })
  assert.match(html, /data-barcode-value="HG1761420"/)
  assert.match(html, /2026-08-26/); assert.match(html, /MODXU26081404-blue-m/)
  assert.doesNotMatch(html, /<img|qr|truncate|ellipsis/)
  const doc = sampleLabelDocument(identity, { width: '55', height: '35', copies: '3' })
  assert.equal((doc.match(/data-hg-sample-label/g)||[]).length, 3)
  assert.match(doc, /size:55mm 35mm/)
  for (const settings of [{ width:'0',height:'40',copies:'1' }, { width:'60',height:'NaN',copies:'1' }, { width:'60',height:'40',copies:'1.5' }, {width:'60',height:'40',copies:'101'}]) assert.throws(() => sampleLabelSettings(settings))
  assert.equal(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY), before, 'rendering and repeat printing never write any sample fact')
})

test('HG-002/004 regression: older receipt without identities retains its first date; raw SKU is never HG', () => {
  const template = listTestingOrders()[0], code = 'HG-LEGACY-blue-m'
  receiveTestingOrderSamples({ ...template, testingOrderId: 'legacy-first', skuCodes: [code], sampleInboundAt: '2026-08-01 09:00:00' }, '仓管')
  const data = JSON.parse(pcsRecordStore.getItem(PCS_SAMPLE_STORAGE_KEY)!)
  data.identities = data.identities.filter((row: {skuCode: string}) => row.skuCode !== code)
  pcsRecordStore.setItem(PCS_SAMPLE_STORAGE_KEY, JSON.stringify(data))
  assert.equal(buildPcsSampleTagCode(code), '', 'unregistered identity never falls back to SKU')
  assert.equal(resolvePcsSampleLabelSku(code), null, 'raw SKU cannot masquerade as HG')
  receiveTestingOrderSamples({ ...template, testingOrderId: 'legacy-repeat', skuCodes: [code], sampleInboundAt: '2026-10-06 10:00:00' }, '仓管')
  assert.equal(getPcsSampleLabelIdentity(code)!.registeredAt, '2026-08-01 09:00:00', 'new registration must consult older receipt facts')
})
