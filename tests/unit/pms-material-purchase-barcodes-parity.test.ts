import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPmsMaterialPurchaseOrder,
  getPmsMaterialPurchaseOrderLines,
  publishPmsMaterialPurchaseOrders,
  resetPmsMaterialPurchaseRuntimeForTest,
  type PmsMaterialPurchaseOrder,
  type PmsMaterialPurchaseOrderLine,
  type PmsMpoDetailBarcode,
} from '../../src/data/pms/material-purchase-orders.ts'
import {
  parseMpoBarcodeImportRows,
  renderMpoBarcodeOverlay,
  renderMpoBarcodePrintLabel,
  validateMpoBarcodeRows,
} from '../../src/pages/pms/material-purchase-barcodes.ts'

const createdAt = '2026-10-14T07:00:00.000Z'
const headers = ['SKU', '条码', '数量', '单位', '仓库']
const legacyHeaders = ['条码', '数量', '单位', '仓库']

function fixture(): PmsMaterialPurchaseOrder {
  const order = structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!)
  const line: PmsMaterialPurchaseOrderLine = {
    lineId: 'BARCODE-PARITY:L1', materialCode: 'FABRIC-BLUE', materialName: '蓝色棉布',
    materialSpu: 'FABRIC', imageUrl: '/materials/fabric-main.jpg', colorName: '蓝色', specName: '120g',
    unit: 'Yard', orderedQty: 1248, plannedRolls: 10, unitPrice: 3,
    actualPurchasedQty: 0, sellerReceivedQty: 0, inboundQty: 0, priceConfirmed: false,
  }
  order.purchaseOrderNo = 'CGF-BARCODE-PARITY'
  // Deliberately misleading parent fields detect regressions to whole-order quantities/units.
  order.unit = '多单位'; order.orderedQty = 0; order.detailBarcodes = []
  order.lines = [line, {
    ...line, lineId: 'BARCODE-PARITY:L2', materialCode: 'YARN-WHITE', materialName: '白色纱线',
    materialSpu: 'YARN', imageUrl: '/materials/process-orders/cotton-yarn-cone.jpg',
    colorName: '白色', specName: '40支', unit: 'kg', orderedQty: 30, actualPurchasedQty: 20,
  }]
  return order
}

function barcode(order: PmsMaterialPurchaseOrder, index: number, quantity: number, code = `BC-${index}`): PmsMpoDetailBarcode {
  const line = getPmsMaterialPurchaseOrderLines(order)[index]
  return { purchaseLineId: line.lineId, materialCode: line.materialCode, code, quantity, unit: line.unit, warehouse: '中央仓', status: '有效', createdAt }
}

test('细码使用每个 SKU 的单位；未知实采的新记录允许线上超计划数量', () => {
  const order = fixture()
  assert.doesNotThrow(() => validateMpoBarcodeRows([barcode(order, 0, 1250), barcode(order, 1, 20)], order))
  assert.throws(() => validateMpoBarcodeRows([barcode(order, 1, 21)], order), /YARN-WHITE.*21 kg.*20 kg/)
  assert.throws(() => validateMpoBarcodeRows([{ ...barcode(order, 1, 5), unit: 'Yard' }], order), /单位.*SKU YARN-WHITE.*kg/)
})

test('按 SKU 累计已明确的实物上限，不把不同单位合成主单总量', () => {
  const order = fixture()
  order.lines![0].actualPurchasedQty = 100
  assert.doesNotThrow(() => validateMpoBarcodeRows([barcode(order, 0, 100), barcode(order, 1, 20)], order))
  assert.throws(() => validateMpoBarcodeRows([barcode(order, 1, 12, 'BC-KG-1'), barcode(order, 1, 9, 'BC-KG-2')], order), /YARN-WHITE.*21 kg/)
})

test('细码拒绝串 SKU、重复编码和缺少多 SKU 归属', () => {
  const order = fixture(), existing = barcode(order, 0, 10)
  order.detailBarcodes = [existing]
  assert.throws(() => validateMpoBarcodeRows([{ ...barcode(order, 1, 10), code: existing.code }], order), /不能改换归属/)
  assert.throws(() => validateMpoBarcodeRows([{ ...existing, materialCode: 'YARN-WHITE' }], order), /未关联/)
  assert.throws(() => validateMpoBarcodeRows([existing, { ...existing }], order), /重复/)
  const { purchaseLineId: _, materialCode: __, ...unassigned } = existing
  assert.throws(() => validateMpoBarcodeRows([unassigned], order), /未关联/)
})

test('新模板按 SKU 匹配图片和计量归属，逐行报告错误且不改变订单', () => {
  const order = fixture(), before = structuredClone(order)
  const rows = parseMpoBarcodeImportRows([headers,
    ['FABRIC-BLUE', 'BC-YARD', '1250', 'Yard', '面料中央仓'],
    ['YARN-WHITE', 'BC-KG', '12', 'kg', '纱线中央仓'],
    ['YARN-WHITE', 'BC-WRONG-UNIT', '1', 'Yard', '纱线中央仓'],
    ['OTHER-SKU', 'BC-OTHER', '1', 'kg', '纱线中央仓'],
  ], order, createdAt)
  assert.equal(rows[0].row.purchaseLineId, order.lines![0].lineId)
  assert.equal(rows[1].row.purchaseLineId, order.lines![1].lineId)
  assert.equal(rows[0].error, ''); assert.equal(rows[1].error, '')
  assert.match(rows[2].error, /单位.*kg/); assert.match(rows[3].error, /不属于本采购单/)
  assert.deepEqual(order, before)
})

test('导入预览校验同 SKU 累计实物数量与现有重复编码', () => {
  const order = fixture()
  order.detailBarcodes = [barcode(order, 1, 10, 'BC-EXISTING')]
  const over = parseMpoBarcodeImportRows([headers,
    ['YARN-WHITE', 'BC-NEW-1', '6', 'kg', '中央仓'],
    ['YARN-WHITE', 'BC-NEW-2', '5', 'kg', '中央仓'],
  ], order, createdAt)
  assert.ok(over.every(entry => /导入后 21 kg.*20 kg/.test(entry.error)))
  const duplicate = parseMpoBarcodeImportRows([headers,
    ['FABRIC-BLUE', 'BC-EXISTING', '5', 'Yard', '中央仓'],
    ['FABRIC-BLUE', 'BC-NEW', '5', 'Yard', '中央仓'],
    ['YARN-WHITE', 'BC-NEW', '1', 'kg', '中央仓'],
  ], order, createdAt)
  assert.match(duplicate[0].error, /重复/); assert.match(duplicate[2].error, /重复/)
})

test('旧四列模板只映射单 SKU；旧数量上限保留，多 SKU 必须填写 SKU', () => {
  const multi = fixture()
  assert.throws(() => parseMpoBarcodeImportRows([legacyHeaders, ['BC-LEGACY', '1', 'Yard', '中央仓']], multi, createdAt), /必须填写 SKU/)
  const legacy = structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!)
  delete legacy.lines; legacy.detailBarcodes = []; legacy.orderedQty = 5
  const imported = parseMpoBarcodeImportRows([legacyHeaders, ['BC-LEGACY', '5', legacy.unit, '中央仓']], legacy, createdAt)
  assert.equal(imported[0].error, '')
  assert.equal(imported[0].row.materialCode, legacy.materialCode)
  assert.equal(imported[0].row.purchaseLineId, getPmsMaterialPurchaseOrderLines(legacy)[0].lineId)
  assert.throws(() => validateMpoBarcodeRows([{ ...imported[0].row, quantity: 6 }], legacy), /超过可编数量 5/)
})

test('标签打印绑定本行图片、规格、数量与单位，预览不登记打印或库存', () => {
  const order = fixture(), row = barcode(order, 1, 12), before = structuredClone({ order, row })
  const html = renderMpoBarcodePrintLabel(order, row)
  assert.match(html, /白色纱线/); assert.match(html, /YARN-WHITE/); assert.match(html, /白色 · 40支/)
  assert.match(html, /cotton-yarn-cone\.jpg/); assert.match(html, /12 kg/); assert.match(html, /<svg/)
  assert.doesNotMatch(html, /蓝色棉布|FABRIC-BLUE|fabric-main\.jpg/)
  assert.deepEqual({ order, row }, before)
  assert.throws(() => renderMpoBarcodePrintLabel(order, { ...row, materialCode: 'FABRIC-BLUE' }), /未关联/)
  assert.throws(() => renderMpoBarcodePrintLabel(order, { ...row, unit: 'Yard' }), /单位/)
})

test('条码明细列表保留已有动作并按单位分组汇总，导入入口直接显示文件表单', () => {
  resetPmsMaterialPurchaseRuntimeForTest()
  try {
    const order = fixture()
    order.detailBarcodes = [barcode(order, 0, 100), barcode(order, 1, 12)]
    publishPmsMaterialPurchaseOrders([order])
    const list = renderMpoBarcodeOverlay(order.purchaseOrderNo)
    assert.match(list, /100 Yard · 12 kg/)
    assert.match(list, /筛选采购 SKU/); assert.match(list, /蓝色 · 120g/); assert.match(list, /白色 · 40支/)
    for (const label of ['批量修改', '补充条码', '导入细码', '批量删除', '下架到待出库区', '批量打印预览']) assert.ok(list.includes(label))
    const importedOrder = { ...order, purchaseOrderNo: 'CGF-BARCODE-IMPORT' }
    publishPmsMaterialPurchaseOrders([importedOrder])
    const form = renderMpoBarcodeOverlay(importedOrder.purchaseOrderNo, 'import')
    assert.match(form, /选择细码文件/); assert.match(form, /下载导入模板/)
    assert.doesNotMatch(form, /条码列表 · 共/)
  } finally { resetPmsMaterialPurchaseRuntimeForTest() }
})
