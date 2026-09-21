import assert from 'node:assert/strict'
import test from 'node:test'
import { TMF_PRODUCT_POLICY_VERSION, tmfProductPolicy } from '../../src/data/fcs/tmf-product-policy.ts'

test('TMF V1 原型范围、工厂身份和现场默认参数已冻结', () => {
  assert.equal(TMF_PRODUCT_POLICY_VERSION, 'TMF-POLICY-V1')
  assert.deepEqual(tmfProductPolicy.factories, { spf: 'FAC-SPF', tmf: 'FAC-TMF', apf: 'FAC-APF' })
  assert.equal(tmfProductPolicy.scope.excludesFinishedLongTermStock, true)
  assert.equal(tmfProductPolicy.scope.prototypeOnly, true)
  assert.deepEqual(tmfProductPolicy.device.pdaViewport, { width: 360, height: 640 })
  assert.deepEqual(tmfProductPolicy.device.labelSizes, ['150×100mm', 'A4'])
  assert.equal(tmfProductPolicy.device.maxLabelAgeHours, 24)
})

test('TMF 风险动作默认要求主管与二次确认，采购行身份不可丢失', () => {
  assert.equal(tmfProductPolicy.controls.overReceiptRequiresSupervisor, true)
  assert.equal(tmfProductPolicy.controls.hazardousDispositionRequiresSecondConfirmation, true)
  assert.equal(tmfProductPolicy.controls.skuLineageKeepsPurchaseLineId, true)
  assert.equal(tmfProductPolicy.controls.resetIsolatedFixtureOnly, true)
})
