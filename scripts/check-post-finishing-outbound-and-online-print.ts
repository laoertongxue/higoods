import assert from 'node:assert/strict'
import {
  completePostFinishingRecheckOrder,
  getPostFinishingRecheckOrderById,
} from '../src/data/fcs/post-finishing-domain.ts'
import {
  getPostFinishingOutboundOrderByRecheckId,
  listPostFinishingOutboundOrders,
} from '../src/data/fcs/post-finishing-outbound-orders.ts'
import {
  buildPrintDocument,
  renderPrintDocument,
} from '../src/data/fcs/print-template-registry.ts'

const recheck = getPostFinishingRecheckOrderById('PF-RC-001')
assert.ok(recheck, '验收 Mock 必须包含 PF-RC-001 复检单')

const results = recheck.skuLines.map((line, index) => ({
  recheckSkuResultId: `${recheck.recheckOrderId}-ACCEPT-${index + 1}`,
  recheckOrderId: recheck.recheckOrderId,
  skuLineId: line.skuLineId,
  skuId: line.skuId,
  skuCode: line.skuCode,
  colorName: line.colorName,
  sizeName: line.sizeName,
  skuImageUrl: line.skuImageUrl,
  recheckQty: line.plannedQty,
  qualifiedQty: line.plannedQty,
  unqualifiedQty: 0,
  defectItems: [],
  evidenceAssets: [],
}))

const before = listPostFinishingOutboundOrders().filter((item) => item.recheckOrderId === recheck.recheckOrderId)
completePostFinishingRecheckOrder({
  recheckOrderId: recheck.recheckOrderId,
  operatorName: '后道出货单验收员',
  recheckSkuResults: results,
})
completePostFinishingRecheckOrder({
  recheckOrderId: recheck.recheckOrderId,
  operatorName: '后道出货单验收员',
  recheckSkuResults: results,
})

const after = listPostFinishingOutboundOrders().filter((item) => item.recheckOrderId === recheck.recheckOrderId)
assert.equal(after.length, 1, '同一复检单重复完成只允许存在一张后道出货单')
assert.equal(after.length, Math.max(before.length, 1))
const outbound = getPostFinishingOutboundOrderByRecheckId(recheck.recheckOrderId)
assert.ok(outbound)
assert.equal(outbound.sourceWarehouseName, `${outbound.managedPostFactoryName}-后道待加工仓`)
assert.equal(outbound.targetWarehouseName, `${outbound.managedPostFactoryName}-后道待交出仓`)
assert.equal(outbound.sourceActionLabel, '复检完成 → 后道待交出仓')
assert.equal(
  outbound.outboundQty,
  results.reduce((sum, item) => sum + item.qualifiedQty, 0),
  '后道出货数量必须等于逐 SKU 复检合格数量',
)

for (const input of [
  { sourceType: 'PRODUCTION_ORDER' as const, sourceId: 'PO-202603-0001' },
]) {
  const barcode = buildPrintDocument({ documentType: 'GARMENT_SKU_BARCODE', ...input })
  const barcodeHtml = renderPrintDocument(barcode)
  assert.equal(barcode.paperType, 'LABEL_40_30')
  assert.match(barcodeHtml, /data-online-print-layout="sku-barcode"/)
  assert.match(barcodeHtml, /@page\s*\{\s*size:\s*40mm 30mm/)
  assert.doesNotMatch(barcodeHtml, /来源 SKU|当前标签已按整色替换|零售条码|成衣新条码/)
  assert.equal((barcodeHtml.match(/data-real-barcode/g) || []).length, barcode.labelItems?.length)

  const hangtag = buildPrintDocument({ documentType: 'GARMENT_HANGTAG', ...input })
  const hangtagHtml = renderPrintDocument(hangtag)
  assert.equal(hangtag.paperType, 'LABEL_40_100')
  assert.match(hangtagHtml, /data-online-print-layout="garment-hangtag"/)
  assert.match(hangtagHtml, /@page\s*\{\s*size:\s*40mm 100mm/)
  for (const text of ['Kategori:', 'SPU:', 'Metode pencucian:', 'Standar implementasi:', 'Kategori keamanan:', 'Rp.']) {
    assert.match(hangtagHtml, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.equal(hangtag.imageBlocks.length, 0, '线上吊牌顶部纯色圆点不是商品图片，不应生成图片块')
  assert.equal((hangtagHtml.match(/data-online-color-dot/g) || []).length, hangtag.labelItems?.length)
  assert.doesNotMatch(hangtagHtml, /<img\b|online-hangtag-image|商品图片加载失败/)
  assert.doesNotMatch(hangtagHtml, /来源 SKU|当前标签已按整色替换/)
  assert.equal((hangtagHtml.match(/data-real-barcode/g) || []).length, (hangtag.labelItems?.length || 0) * 2)
}

console.log('后道出货单与线上打印版式专项契约通过。')
