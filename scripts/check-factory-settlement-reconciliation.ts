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
import {
  buildProductionOrderSettlementProjections,
  buildStatementDraftLinesFromSettlementSelection,
} from '../src/data/fcs/store-domain-statement-source-adapter.ts'
import { listPostFinishingQcOrders } from '../src/data/fcs/post-finishing-domain.ts'

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
const externalReworkChargeback = listPostFinishingQcOrders()
  .flatMap((record) =>
    (record.qcSkuResults ?? []).map((sku) => ({
      qcRecordId: record.actionRecordId,
      skuResultId: sku.qcSkuResultId,
      factoryName: record.sourceFactoryName,
      reworkQty: sku.reworkQty ?? 0,
      receiverName: sku.reworkReceiveFactoryName,
      amount: sku.sourceChargeback?.amount ?? sku.reworkDeductionAmountIdr ?? 0,
    })),
  )
  .find((item) => item.reworkQty > 0 && item.receiverName && item.receiverName !== item.factoryName && item.amount > 0)
assert(externalReworkChargeback, '缺少后道质检返工反扣样例')
const chargebackLedger = allLedgers.find(
  (ledger) =>
    ledger.sourceType === 'QC_REWORK_CHARGEBACK' &&
    ledger.qcRecordId === externalReworkChargeback!.qcRecordId &&
    ledger.sourceRefId.includes(externalReworkChargeback!.skuResultId),
)
assert(chargebackLedger, '质检记录里的返工反扣必须进入预结算流水')
assert.equal(chargebackLedger.ledgerType, 'QUALITY_DEDUCTION')
assert.equal(chargebackLedger.direction, 'DEDUCTION')
assert.equal(chargebackLedger.settlementCurrency, 'IDR')
assert.equal(chargebackLedger.settlementAmount, externalReworkChargeback!.amount)
const chargebackEligible = listStatementEligiblePreSettlementLedgersByRange({
  factoryId: chargebackLedger.factoryId,
  occurredFrom: chargebackLedger.occurredAt.slice(0, 10),
  occurredTo: chargebackLedger.occurredAt.slice(0, 10),
})
assert(
  chargebackEligible.some((ledger) => ledger.ledgerId === chargebackLedger.ledgerId),
  '质检记录返工反扣必须可进入对账单选择范围',
)
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

const projections = buildProductionOrderSettlementProjections({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
})

assert(projections.length > 0, '按时间段反查必须展示生产单')
assert(projections.every((item) => item.productionOrderNo))
assert(projections.every((item) => typeof item.isComplete === 'boolean'))
const firstProjection = projections.find((item) => item.productionOrderNo === firstOpenLedger.productionOrderNo)
const firstProjectionDetail = firstProjection?.handoverDetailLines.find(
  (item) => item.recordId === (firstOpenLedger.returnInboundBatchNo ?? firstOpenLedger.ledgerId),
)
assert(firstProjectionDetail, '生产单投影必须保留来源流水明细')
assert.equal(
  firstProjectionDetail.handedOverQty,
  firstOpenLedger.ledgerType === 'TASK_EARNING' ? firstOpenLedger.qty : 0,
)

const completedIds = projections.filter((item) => item.isComplete).map((item) => item.productionOrderNo)
const emptyLedgerSelectionLines = buildStatementDraftLinesFromSettlementSelection({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
  objectMode: 'LEDGER',
  selectedLedgerIds: [],
})
const lines = buildStatementDraftLinesFromSettlementSelection({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
  objectMode: 'PRODUCTION_ORDER',
  selectedProductionOrderNos: completedIds,
})

assert.equal(emptyLedgerSelectionLines.length, 0)
assert(lines.every((item) => completedIds.includes(item.productionOrderNo ?? '')))
assert(lines.every((item) => item.settlementObjectMode === 'PRODUCTION_ORDER'))

const qualityOnlyOpenLedger = allLedgers.find((ledger) => {
  if (ledger.status !== 'OPEN' || ledger.ledgerType !== 'QUALITY_DEDUCTION' || !ledger.productionOrderNo) return false
  return !allLedgers.some(
    (item) =>
      item.status === 'OPEN' &&
      item.ledgerType === 'TASK_EARNING' &&
      item.factoryId === ledger.factoryId &&
      item.occurredAt.slice(0, 10) === ledger.occurredAt.slice(0, 10) &&
      item.productionOrderNo === ledger.productionOrderNo,
  )
})

if (qualityOnlyOpenLedger) {
  const qualityOnlyProjection = buildProductionOrderSettlementProjections({
    factoryId: qualityOnlyOpenLedger.factoryId,
    occurredFrom: qualityOnlyOpenLedger.occurredAt.slice(0, 10),
    occurredTo: qualityOnlyOpenLedger.occurredAt.slice(0, 10),
  }).find((item) => item.productionOrderNo === qualityOnlyOpenLedger.productionOrderNo)

  assert(qualityOnlyProjection, '质量扣款流水生产单必须能反查到投影')
  assert.equal(qualityOnlyProjection.isComplete, false)
  assert.equal(qualityOnlyProjection.includedInStatement, false)
}

const futureRange = listStatementEligiblePreSettlementLedgersByRange({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: '2099-01-01',
  occurredTo: '2099-01-01',
})

assert(!futureRange.some((item) => item.ledgerId === firstOpenLedger.ledgerId))

const statementId = 'ST-RANGE-CHECK-001'
const beforeCount = initialStatementDrafts.length
try {
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
} finally {
  initialStatementDrafts.splice(beforeCount)
}

const defaultModeBeforeCount = initialStatementDrafts.length
try {
  const firstDefaultModeCreate = createStatementFromEligibleLedgers({
    statementId: 'ST-RANGE-DEFAULT-MODE-001',
    settlementPartyType: 'FACTORY',
    settlementPartyId: firstOpenLedger.factoryId,
    settlementPartyLabel: firstOpenLedger.factoryName,
    settlementRangeStartAt: firstOpenLedger.occurredAt.slice(0, 10),
    settlementRangeEndAt: firstOpenLedger.occurredAt.slice(0, 10),
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
    remark: 'range default mode check',
    by: '检查脚本',
    at: '2026-07-01 18:05:00',
  })
  const secondDefaultModeCreate = createStatementFromEligibleLedgers({
    statementId: 'ST-RANGE-DEFAULT-MODE-002',
    settlementPartyType: 'FACTORY',
    settlementPartyId: firstOpenLedger.factoryId,
    settlementPartyLabel: firstOpenLedger.factoryName,
    settlementRangeStartAt: firstOpenLedger.occurredAt.slice(0, 10),
    settlementRangeEndAt: firstOpenLedger.occurredAt.slice(0, 10),
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
    remark: 'range default mode duplicate check',
    by: '检查脚本',
    at: '2026-07-01 18:06:00',
  })

  assert.equal(firstDefaultModeCreate.ok, true)
  assert.equal(secondDefaultModeCreate.ok, false)
  assert.equal(initialStatementDrafts.length, defaultModeBeforeCount + 1)
} finally {
  initialStatementDrafts.splice(defaultModeBeforeCount)
}

console.log('check:factory-settlement-reconciliation passed')
