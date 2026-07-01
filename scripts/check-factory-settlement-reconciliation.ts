import assert from 'node:assert/strict'
import {
  DEFAULT_SETTLEMENT_CURRENCY,
  SETTLEMENT_CURRENCIES,
  SEWING_FACTORY_LIABILITY_REASONS,
  calculateProductionOrderSettlementSummary,
  isSewingFactoryLiabilityReason,
} from '../src/data/fcs/factory-settlement-reconciliation.ts'

const summary = calculateProductionOrderSettlementSummary({
  cuttingCompletedQty: 100,
  handoverLines: [
    { recordId: 'H-1', handedOverQty: 80, handedOverAt: '2026-07-01 10:00:00' },
  ],
  reworkLines: [
    { qcOrderId: 'QC-1', receiveObject: 'ORIGINAL_FACTORY', reworkQty: 10 },
    { qcOrderId: 'QC-2', receiveObject: 'POST_FACTORY', reworkQty: 20 },
  ],
  defectReasonLines: [
    { reasonName: '做工原因', qty: 3 },
    { reasonName: '布料原因', qty: 4 },
    { reasonName: '破洞', qty: 2 },
  ],
})

assert.equal(DEFAULT_SETTLEMENT_CURRENCY, 'IDR')
assert.deepEqual(SETTLEMENT_CURRENCIES, ['IDR', 'CNY', 'USD'])
assert(SEWING_FACTORY_LIABILITY_REASONS.includes('做工原因'))
assert(SEWING_FACTORY_LIABILITY_REASONS.includes('破洞'))
assert.equal(isSewingFactoryLiabilityReason('布料原因'), false)
assert.equal(summary.normalHandoverQty, 80)
assert.equal(summary.originalFactoryReworkQty, 10)
assert.equal(summary.postFactoryReworkQty, 20)
assert.equal(summary.settlementHandoverQty, 100)
assert.equal(summary.isComplete, true)
assert.equal(summary.shortageQty, 0)
assert.equal(summary.defectQty, 9)
assert.equal(summary.sewingFactoryLiabilityDefectQty, 5)

const incomplete = calculateProductionOrderSettlementSummary({
  cuttingCompletedQty: 120,
  handoverLines: [{ recordId: 'H-2', handedOverQty: 90, handedOverAt: '2026-07-02 10:00:00' }],
  reworkLines: [{ qcOrderId: 'QC-3', receiveObject: 'ORIGINAL_FACTORY', reworkQty: 10 }],
  defectReasonLines: [],
})

assert.equal(incomplete.settlementHandoverQty, 90)
assert.equal(incomplete.isComplete, false)
assert.equal(incomplete.shortageQty, 30)

console.log('check:factory-settlement-reconciliation passed')
