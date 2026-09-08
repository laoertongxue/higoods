import assert from 'node:assert/strict'
import {
  loadPostFinishingDemoData,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingFullFlowPostTasks,
  listPostFinishingFullFlowRecheckOrders,
} from '../src/data/fcs/post-finishing-full-flow.ts'
import {
  buildPrintDocument,
  renderPrintDocument,
} from '../src/data/fcs/print-template-registry.ts'

loadPostFinishingDemoData()

const postTasks = listPostFinishingFullFlowPostTasks()
const rechecks = listPostFinishingFullFlowRecheckOrders()
const outbounds = listPostFinishingFullFlowOutboundOrders()
assert.ok(outbounds.length > 0, '当前后道全流程必须包含成衣仓交接单')
assert.equal(new Set(outbounds.map((item) => item.outboundOrderId)).size, outbounds.length, '同一当前事实不得重复生成平行出货单')
assert.equal(new Set(outbounds.map((item) => item.outboundOrderNo)).size, outbounds.length, '后道出货单号必须唯一')

for (const outbound of outbounds) {
  assert.ok(outbound.lines.length > 0, `${outbound.outboundOrderNo} 必须包含逐 SKU 出货数量`)
  assert.ok(outbound.lines.every((line) => line.outboundQty > 0 && line.sku.qtyUnit === '件'), `${outbound.outboundOrderNo} 必须使用正数成衣件数`)
  if (outbound.sourceType === '质检直达') {
    assert.ok(!postTasks.some((task) => task.deliveryId === outbound.deliveryId), `${outbound.outboundOrderNo} QC 空项目不得生成后道加工单`)
    assert.ok(!rechecks.some((order) => order.deliveryId === outbound.deliveryId), `${outbound.outboundOrderNo} QC 空项目不得生成处理后交出复核单`)
  } else {
    assert.ok(outbound.postTaskId && outbound.recheckOrderId, `${outbound.outboundOrderNo} 后道加工后出货必须追溯加工单与处理后复核单`)
  }
}

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

console.log('当前后道出货单唯一事实与线上打印版式专项契约通过。')
