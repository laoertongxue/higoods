import test from 'node:test'
import assert from 'node:assert/strict'
import { assertMaterialMainUnitChangeAllowed } from '../src/data/pcs-material-reference-check.ts'

const sku = { materialSkuId: 'material-unit-reference-test', mainUnit: 'M', pricingUnit: 'M', mainUnitUsed: false, approvalStatus: 'DRAFT' as const }

test('UOM/PMS: unchanged units and locally locked units do not query another domain', async () => {
  let reads = 0
  const read = async () => { reads += 1; return false }
  await assertMaterialMainUnitChangeAllowed(sku, undefined, read)
  await assertMaterialMainUnitChangeAllowed(sku, 'm', read)
  await assert.rejects(assertMaterialMainUnitChangeAllowed({ ...sku, mainUnitUsed: true }, 'KG', read), /已审核或已使用/)
  await assert.rejects(assertMaterialMainUnitChangeAllowed({ ...sku, approvalStatus: 'APPROVED' }, 'KG', read), /已审核或已使用/)
  await assert.rejects(assertMaterialMainUnitChangeAllowed(sku, '', read), /不能为空/)
  assert.equal(reads, 0)
})

test('UOM/PMS: purchase drafts or historical purchase references block changing the unit', async () => {
  const before = structuredClone(sku)
  let checkedId = ''
  await assert.rejects(assertMaterialMainUnitChangeAllowed(sku, 'KG', async id => { checkedId = id; return true }), /采购草稿或采购记录引用/)
  assert.equal(checkedId, sku.materialSkuId)
  assert.deepEqual(sku, before)
})

test('UOM/PMS: unused draft may change its unit only after the reference read completes', async () => {
  const events: string[] = []
  await assertMaterialMainUnitChangeAllowed(sku, 'KG', async () => {
    events.push('read-start')
    await Promise.resolve()
    events.push('read-complete')
    return false
  })
  events.push('PCS-write-may-start')
  assert.deepEqual(events, ['read-start', 'read-complete', 'PCS-write-may-start'])
  assert.equal(sku.mainUnit, 'M')
})

test('UOM/PMS: failed reference reads preserve the input and block the PCS write', async () => {
  const before = structuredClone(sku)
  let writes = 0
  await assert.rejects((async () => {
    await assertMaterialMainUnitChangeAllowed(sku, 'KG', async () => { throw new Error('IndexedDB unavailable') })
    writes += 1
  })(), /无法核对采购记录.*未修改.*重试/)
  assert.equal(writes, 0)
  assert.deepEqual(sku, before)
})
