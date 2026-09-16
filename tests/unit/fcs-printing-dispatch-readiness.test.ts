import assert from 'node:assert/strict'
import test from 'node:test'

import {
  completePrintWorkOrderDocument,
  getPrintingRollDispatchBlockReason,
  isPrintablePrintingRoll,
  isPrintingRollReadyForDispatch,
  resetPrintingWorkOrderBusinessStore,
  type PrintingBusinessViewFacts,
  type PrintingRollBarcode,
} from '../../src/data/fcs/printing-task-domain.ts'

function fixture() {
  const roll: PrintingRollBarcode = {
    id: 'ROLL-READY-001', barcode: 'BARCODE-READY-001', printOrderNo: 'PWO-READY-001', sku: 'OUT-SKU', status: '草稿',
    rollNo: '001', lengthY: 10, meters: 9.14, weightKg: 2.93, gsm: 200, widthCm: 160, vatNo: 'VAT-01',
    warehouseName: '待交出仓', inboundStatus: '待上架', quantityConfirmed: true,
  }
  const view = {
    output: { completedQty: 10, sku: 'OUT-SKU', objectType: '面料' },
    barcodes: [roll],
  } as Pick<PrintingBusinessViewFacts, 'output' | 'barcodes'>
  return { view, roll }
}

test('可打印不等于可建交出单，必须完成真实标签打印', () => {
  const { view, roll } = fixture()
  assert.equal(isPrintablePrintingRoll(view, roll), true)
  assert.equal(isPrintingRollReadyForDispatch(view, roll), false)
  assert.match(getPrintingRollDispatchBlockReason(view, roll), /打印产出卷标签/)

  roll.status = '已打印'
  roll.printedAt = '2026-09-15 09:00:00'
  roll.printedBy = '标签打印员-王宁'
  assert.equal(isPrintingRollReadyForDispatch(view, roll), true)
})

test('卷规格无效时不可建交出单，且不改变原可打印判定语义', () => {
  const { view, roll } = fixture()
  roll.status = '已打印'
  roll.printedAt = '2026-09-15 09:00:00'
  roll.printedBy = '标签打印员-王宁'
  roll.widthCm = 0
  assert.equal(isPrintablePrintingRoll(view, roll), true)
  assert.equal(isPrintingRollReadyForDispatch(view, roll), false)
  assert.match(getPrintingRollDispatchBlockReason(view, roll), /克重和幅宽/)
})

test('人工完成印花加工单不再自动填充操作人', () => {
  resetPrintingWorkOrderBusinessStore()
  assert.throws(
    () => completePrintWorkOrderDocument('PWO-PRINT-001', { operatorName: '   ' }),
    /请填写实际完成人/,
  )
})
