import assert from 'node:assert/strict'
import test from 'node:test'

import { getPmsSubjectOperation, updatePmsSubjectOperation } from '../../src/data/pms/subject-operations.ts'
import {
  PMS_LOGISTICS_IMPORT_HEADERS,
  batchConfirmPmsMaterialReconciliationFees,
  checkPmsMaterialReconciliationGenerate,
  confirmAllPmsLogisticsReconciliationFees,
  confirmAllPmsMaterialReconciliationFees,
  confirmPmsLogisticsReconciliation,
  confirmPmsLogisticsReconciliationDifference,
  confirmPmsMaterialReconciliation,
  confirmPmsMaterialReconciliationDifference,
  confirmPmsMaterialReconciliationFees,
  getPmsLogisticsReconciliation,
  getPmsMaterialReconciliation,
  importPmsLogisticsActualFees,
  importPmsMaterialSupplierBills,
  pmsMaterialEffectiveLogisticsFee,
  pmsMaterialEffectivePurchaseAmount,
  updatePmsMaterialReconciliation,
  validatePmsLogisticsActualImportRow,
  validatePmsMaterialBillImportRow,
} from '../../src/data/pms/reconciliations.ts'
import {
  addPmsPaymentAttachment,
  checkPmsPaymentRequestEditScope,
  consumePmsPaymentDraft,
  createPmsPaymentRequestFromDraft,
  getPmsPaymentRequest,
  registerPmsPayment,
  setPmsLogisticsPaymentDraft,
  setPmsMaterialPaymentDraft,
  submitPmsPaymentRequest,
  voidPmsPaymentRequest,
} from '../../src/data/pms/payment-requests.ts'
import { PMS_FINANCE_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'
import { formatPmsAmountUpper } from '../../src/pages/pms/payment-requests.ts'

test('主体经营明细总成本、毛利与毛利率公式', () => {
  const row = getPmsSubjectOperation('SO-2026-05-01')
  assert.ok(row)
  assert.equal(row.totalCost, row.purchaseCost + row.logisticsCost + row.allocatedCost + row.otherCost)
  assert.equal(row.grossProfit, row.salesAmount - row.totalCost)
  assert.equal(row.grossMargin, Math.round((row.grossProfit / row.salesAmount) * 10000) / 100)
  const before = { purchase: row.purchaseCost, logistics: row.logisticsCost, allocated: row.allocatedCost, other: row.otherCost }
  updatePmsSubjectOperation('SO-2026-05-01', { allocatedCost: before.allocated + 500 }, PMS_FINANCE_ACTOR)
  assert.equal(getPmsSubjectOperation('SO-2026-05-01')?.totalCost, before.purchase + before.logistics + before.allocated + 500 + before.other)
})

test('面辅料对账：预计/实际双层公式，费用项与差异双重门禁', () => {
  const row = getPmsMaterialReconciliation('MR-2026-0004')
  assert.ok(row)
  const effectivePurchase = pmsMaterialEffectivePurchaseAmount(row)
  const effectiveLogistics = pmsMaterialEffectiveLogisticsFee(row)
  assert.equal(row.actualPurchaseAmount, effectivePurchase)
  assert.equal(row.actualDomesticLogisticsFee, effectiveLogistics)
  assert.equal(Math.round((effectivePurchase + effectiveLogistics + row.adjustment) * 100) / 100, row.finalPayable)
  assert.equal(row.difference, row.supplierBillAmount - row.finalPayable)
  assert.notEqual(row.difference, 0)
  assert.equal(row.feeConfirmations.length, 2)
  assert.equal(row.status, '部分确认')
  assert.throws(() => confirmPmsMaterialReconciliation('MR-2026-0004', PMS_FINANCE_ACTOR), PmsDomainError)
  confirmAllPmsMaterialReconciliationFees('MR-2026-0004', PMS_FINANCE_ACTOR)
  assert.throws(() => confirmPmsMaterialReconciliation('MR-2026-0004', PMS_FINANCE_ACTOR), PmsDomainError)
  confirmPmsMaterialReconciliationDifference('MR-2026-0004', PMS_FINANCE_ACTOR)
  confirmPmsMaterialReconciliation('MR-2026-0004', PMS_FINANCE_ACTOR)
  assert.equal(getPmsMaterialReconciliation('MR-2026-0004')?.status, '已确认')
  assert.equal(checkPmsMaterialReconciliationGenerate(['MR-2026-0004']).ok, true)
})

test('面辅料费用项部分确认、批量确认与编辑失效', () => {
  confirmPmsMaterialReconciliationFees('MR-2026-0008', ['purchaseAmount'], PMS_FINANCE_ACTOR)
  assert.equal(getPmsMaterialReconciliation('MR-2026-0008')?.status, '部分确认')
  const outcome = batchConfirmPmsMaterialReconciliationFees(['MR-2026-0008', 'MR-2026-0001'], ['supplierBillAmount'], PMS_FINANCE_ACTOR)
  assert.deepEqual(outcome.updated, ['MR-2026-0008'])
  assert.equal(outcome.skipped[0]?.id, 'MR-2026-0001')
  updatePmsMaterialReconciliation('MR-2026-0008', { actualUnitPrice: 12.5 }, PMS_FINANCE_ACTOR)
  const edited = getPmsMaterialReconciliation('MR-2026-0008')
  assert.equal(edited?.feeConfirmations.includes('purchaseAmount'), false)
  assert.equal(edited?.feeConfirmations.includes('supplierBillAmount'), true)
  assert.equal(edited?.status, '部分确认')
})

test('请款草稿跨页创建、请款与付款上限、编辑范围', () => {
  const draft = setPmsMaterialPaymentDraft(['MR-2026-0004'])
  assert.ok(consumePmsPaymentDraft('material'))
  assert.equal(consumePmsPaymentDraft('material'), null)
  const request = createPmsPaymentRequestFromDraft(draft, PMS_FINANCE_ACTOR)
  assert.equal(request.status, '未请款')
  assert.equal(checkPmsPaymentRequestEditScope(request.requestNo).level, 'full')
  assert.equal(getPmsMaterialReconciliation('MR-2026-0004')?.paymentRequestNo, request.requestNo)
  assert.throws(() => submitPmsPaymentRequest(request.requestNo, request.payableAmount + 1, PMS_FINANCE_ACTOR), PmsDomainError)
  submitPmsPaymentRequest(request.requestNo, request.payableAmount, PMS_FINANCE_ACTOR)
  assert.equal(getPmsPaymentRequest(request.requestNo)?.status, '已请款')
  assert.equal(checkPmsPaymentRequestEditScope(request.requestNo).level, 'attachment-only')
  addPmsPaymentAttachment(request.requestNo, '回单.pdf', PMS_FINANCE_ACTOR)
  assert.equal(getPmsPaymentRequest(request.requestNo)?.attachments.length, 1)
  assert.throws(() => registerPmsPayment(request.requestNo, { amount: request.payableAmount + 1, method: '银行转账' }, PMS_FINANCE_ACTOR), PmsDomainError)
  registerPmsPayment(request.requestNo, { amount: request.payableAmount, method: '银行转账' }, PMS_FINANCE_ACTOR)
  assert.equal(getPmsPaymentRequest(request.requestNo)?.status, '已完成')
  assert.equal(getPmsPaymentRequest(request.requestNo)?.paymentStatus, '已付款')
})

test('物流实际费用 12 列导入校验、不自动确认与确认后锁定', () => {
  assert.equal(PMS_LOGISTICS_IMPORT_HEADERS.length, 12)
  assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-NOT-EXIST', fees: {} }, new Set()), /不在物流对账列表/)
  assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-2026-0002', fees: {} }, new Set()), /已确认/)
  assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-2026-0003', fees: { freight: -1 } }, new Set()), /非负数字/)
  assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-2026-0003', carrierName: '错误的物流商', fees: {} }, new Set()), /物流商/)
  assert.match(validatePmsLogisticsActualImportRow({ batchNo: 'FL-2026-0003', trackingNos: 'NO-SUCH-TRACKING', fees: {} }, new Set()), /不属于头程单/)
  const imported = importPmsLogisticsActualFees([{ batchNo: 'FL-2026-0003', carrierName: '义乌市陆港供应链管理有限公司', shipmentNo: 'HB-0009', remark: '导入验证', fees: { freight: 800, customsDuty: 50, clearance: 20, vat: 10 } }], PMS_FINANCE_ACTOR)
  assert.equal(imported, 1)
  const row = getPmsLogisticsReconciliation('LR-2026-0003')
  assert.equal(row?.actualTotal, 880)
  assert.equal(row?.feeDifference, 20)
  assert.equal(row?.remark, '导入验证')
  assert.equal(row?.shipmentNo, 'HB-0009')
  assert.equal(row?.status, '待确认')
  assert.equal(row?.fees.length, 7, '物流费用固定 7 项')
  assert.equal(row?.fees.every((fee) => !fee.confirmed), true, '导入后费用未确认')
  assert.throws(() => confirmPmsLogisticsReconciliation('LR-2026-0003', PMS_FINANCE_ACTOR), PmsDomainError)
  confirmAllPmsLogisticsReconciliationFees('LR-2026-0003', PMS_FINANCE_ACTOR)
  assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.fees.every((fee) => fee.confirmed), true)
  confirmPmsLogisticsReconciliationDifference('LR-2026-0003', PMS_FINANCE_ACTOR)
  confirmPmsLogisticsReconciliation('LR-2026-0003', PMS_FINANCE_ACTOR)
  assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.status, '已确认')
})

test('请款单作废释放来源对账，已有付款不能作废', () => {
  const draft = setPmsLogisticsPaymentDraft(['LR-2026-0003'])
  const request = createPmsPaymentRequestFromDraft(draft, PMS_FINANCE_ACTOR)
  assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.paymentRequestNo, request.requestNo)
  assert.throws(() => voidPmsPaymentRequest('PAY-M-2026-0002', '已有付款', PMS_FINANCE_ACTOR), PmsDomainError)
  voidPmsPaymentRequest(request.requestNo, '账单重开', PMS_FINANCE_ACTOR)
  assert.equal(getPmsPaymentRequest(request.requestNo)?.status, '已作废')
  assert.equal(getPmsLogisticsReconciliation('LR-2026-0003')?.paymentRequestNo, '')
})


test('供应商账单 9 列导入覆盖实际层且不自动确认', () => {
  const confirmed = getPmsMaterialReconciliation('MR-2026-0001')
  assert.ok(confirmed)
  assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: 'CGF-2026-9999', materialCode: 'MAT-X', supplierBillAmount: 1 }, new Set()), /不在对账列表/)
  assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: confirmed.purchaseOrderNos[0], materialCode: confirmed.materialCode, supplierBillAmount: 1 }, new Set()), /已确认/)
  const target = getPmsMaterialReconciliation('MR-2026-0006')
  assert.ok(target)
  assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: target.purchaseOrderNos[0], materialCode: target.materialCode }, new Set()), /至少要填写一项费用/)
  assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: target.purchaseOrderNos[0], materialCode: target.materialCode, adjustment: Number.NaN }, new Set()), /必须是数字/)
  const imported = importPmsMaterialSupplierBills([{
    purchaseOrderNo: target.purchaseOrderNos[0],
    materialCode: target.materialCode,
    actualUnitPrice: 20,
    actualDomesticLogisticsFee: target.domesticLogisticsFee + 5,
    supplierBillAmount: 6400,
    adjustment: -3,
    remark: '导入验证',
  }], PMS_FINANCE_ACTOR)
  assert.equal(imported, 1)
  const row = getPmsMaterialReconciliation('MR-2026-0006')
  assert.equal(row?.supplierBillAmount, 6400)
  assert.equal(row?.actualUnitPrice, 20)
  assert.equal(row?.actualDomesticLogisticsFee, target.domesticLogisticsFee + 5)
  assert.equal(row?.adjustment, -3)
  assert.equal(row?.remark, '导入验证')
  assert.equal(Math.round((20 * (row?.orderedQty ?? 0)) * 100) / 100, pmsMaterialEffectivePurchaseAmount(row!))
  assert.equal(row?.status, '待确认')
  assert.match(validatePmsMaterialBillImportRow({ purchaseOrderNo: target.purchaseOrderNos[0], materialCode: target.materialCode, supplierBillAmount: 1 }, new Set([`${target.purchaseOrderNos[0]}::${target.materialCode}`])), /重复/)
})

test('金额大写按 RMB 规则输出并覆盖跨节零', () => {
  assert.equal(formatPmsAmountUpper(24474), '贰万肆仟肆佰柒拾肆元整')
  assert.equal(formatPmsAmountUpper(1000001), '壹佰万零壹元整')
  assert.equal(formatPmsAmountUpper(100.05), '壹佰元零伍分')
  assert.equal(formatPmsAmountUpper(0), '零元整')
  assert.equal(formatPmsAmountUpper(Number.NaN), '—')
})
