import assert from 'node:assert/strict'
import {
  DEFAULT_SETTLEMENT_CURRENCY,
  SETTLEMENT_CURRENCIES,
  SEWING_FACTORY_LIABILITY_REASONS,
  calculateProductionOrderSettlementSummary,
  isSewingFactoryLiabilityReason,
} from '../src/data/fcs/factory-settlement-reconciliation.ts'
import {
  listPreSettlementLedgers,
  listStatementEligiblePreSettlementLedgersByRange,
} from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  createStatementFromEligibleLedgers,
  findOpenStatementByPartyAndRange,
  initialStatementDrafts,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

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

const allLedgers = listPreSettlementLedgers()
const firstOpenLedger = allLedgers.find((item) => item.status === 'OPEN')
assert(firstOpenLedger, '需要至少一条 OPEN 预结算流水作为时间段检查样例')

const ranged = listStatementEligiblePreSettlementLedgersByRange({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
})
const targetDate = firstOpenLedger.occurredAt.slice(0, 10)

assert(ranged.some((item) => item.ledgerId === firstOpenLedger.ledgerId))
assert(ranged.every((item) => item.factoryId === firstOpenLedger.factoryId))
assert(ranged.every((item) => item.status === 'OPEN'))
assert(ranged.every((item) => item.occurredAt.slice(0, 10) === targetDate))

const futureRange = listStatementEligiblePreSettlementLedgersByRange({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: '2099-01-01',
  occurredTo: '2099-01-01',
})

assert(!futureRange.some((item) => item.ledgerId === firstOpenLedger.ledgerId))

const statementId = 'ST-RANGE-CHECK-001'
const beforeCount = initialStatementDrafts.length
const createResult = createStatementFromEligibleLedgers({
  statementId,
  settlementPartyType: 'FACTORY',
  settlementPartyId: firstOpenLedger.factoryId,
  settlementPartyLabel: firstOpenLedger.factoryName,
  settlementRangeStartAt: firstOpenLedger.occurredAt.slice(0, 10),
  settlementRangeEndAt: firstOpenLedger.occurredAt.slice(0, 10),
  settlementObjectMode: 'LEDGER',
  settlementCurrency: 'IDR',
  itemSourceIds: [firstOpenLedger.ledgerId],
  itemBasisIds: [],
  items: [
    {
      sourceItemId: firstOpenLedger.ledgerId,
      sourceItemType: 'TASK_EARNING',
      basisId: firstOpenLedger.ledgerId,
      deductionQty: 0,
      deductionAmount: 0,
      currency: 'IDR',
      productionOrderNo: firstOpenLedger.productionOrderNo,
      returnInboundQty: firstOpenLedger.qty,
      earningAmount: firstOpenLedger.settlementAmount,
      qualityDeductionAmount: 0,
      netAmount: firstOpenLedger.settlementAmount,
      occurredAt: firstOpenLedger.occurredAt,
    },
  ],
  productionOrderSettlementSnapshots: [],
  remark: 'range check',
  by: '检查脚本',
  at: '2026-07-01 18:00:00',
})

assert.equal(createResult.ok, true)
assert.equal(createResult.data?.settlementRangeStartAt, firstOpenLedger.occurredAt.slice(0, 10))
assert.equal(createResult.data?.settlementObjectMode, 'LEDGER')
assert.equal(createResult.data?.settlementCurrency, 'IDR')
assert(
  findOpenStatementByPartyAndRange(
    firstOpenLedger.factoryId,
    firstOpenLedger.occurredAt.slice(0, 10),
    firstOpenLedger.occurredAt.slice(0, 10),
    'LEDGER',
  ),
)
initialStatementDrafts.splice(beforeCount)

console.log('check:factory-settlement-reconciliation passed')
