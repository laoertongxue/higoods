import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import { listTechnicalDataVersions } from '../src/data/pcs-technical-data-version-repository.ts'
import { listEngineeringBomPricingPlans } from '../src/data/pcs-engineering-bom-repository.ts'

test('technical data browser reads propagate unavailable collection and invalid structure without seeding', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const get = pcsRecordStore.getItem, set = pcsRecordStore.setItem
  let writes = 0, input: string | Error = new Error('当前页面所需资料尚未读取')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  pcsRecordStore.getItem = key => key === 'higood-pcs-technical-data-version-store-v5'
    ? (() => { if (input instanceof Error) throw input; return input })() : get(key)
  pcsRecordStore.setItem = () => { writes++; throw new Error('reads cannot write') }
  try {
    assert.throws(() => listTechnicalDataVersions(), /尚未读取/)
    input = '{}'
    assert.throws(() => listTechnicalDataVersions(), /格式不完整/)
    input = '{malformed'
    assert.throws(() => listTechnicalDataVersions(), SyntaxError)
    assert.equal(writes, 0)
  } finally {
    pcsRecordStore.getItem = get; pcsRecordStore.setItem = set
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('GOV-016 BOM read errors and invalid stored structure stay retryable without caching an empty result or writing', () => {
  const get = pcsRecordStore.getItem, set = pcsRecordStore.setItem
  let writes = 0, input: string | Error = new Error('BOM 资料尚未读取')
  pcsRecordStore.getItem = key => key === 'higood-pcs-engineering-bom-pricing-plan-store-v2'
    ? (() => { if (input instanceof Error) throw input; return input })() : get(key)
  pcsRecordStore.setItem = () => { writes++; throw new Error('reads cannot write') }
  try {
    assert.throws(() => listEngineeringBomPricingPlans(), /尚未读取/)
    for (const invalid of ['', '{}', 'null', '{"version":1,"records":[],"plans":[]}', '{"version":2,"records":[]}']) {
      input = invalid
      assert.throws(() => listEngineeringBomPricingPlans(), /BOM.*格式不完整/, `must reject ${JSON.stringify(invalid)}`)
    }
    input = '{malformed'
    assert.throws(() => listEngineeringBomPricingPlans())
    input = JSON.stringify({ version: 2, records: [], plans: [{
      pricingPlanId: 'recovered-plan', ownerStage: 'ENGINEERING_MASTER',
      ownerId: 'prepare-r1', ownerCode: 'PREP-R1', styleId: 'style-r1',
      styleCode: 'SPU-R1', styleName: '读取恢复验收款', styleImageUrl: '',
      status: 'DRAFT', customCostDecision: 'NO_CUSTOM_COST', customCosts: [],
      buyerId: 'buyer-r1', buyerName: '验收买手',
      createdAt: '2026-10-06 12:00:00', createdBy: '验收买手',
      updatedAt: '2026-10-06 12:00:00', updatedBy: '验收买手',
    }] })
    const recovered = listEngineeringBomPricingPlans()
    assert.equal(recovered.length, 1)
    assert.equal(recovered[0].pricingPlanId, 'recovered-plan')
    assert.equal(writes, 0)
  } finally {
    pcsRecordStore.getItem = get; pcsRecordStore.setItem = set
  }
})
