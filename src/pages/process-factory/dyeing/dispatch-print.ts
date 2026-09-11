import { escapeHtml as e } from '../../../utils.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { dyeLengthMeters } from '../../../data/fcs/dye-work-order-demo-details.ts'
import { getDyeDispatchStatus, type DyeDispatchDocument } from '../../../data/fcs/dyeing-task-domain.ts'
import type { DyeWorkOrderOnlineRow } from '../../../data/fcs/dye-work-order-online-view.ts'

export function dyeDispatchQuantities(doc: DyeDispatchDocument) {
  const units = new Map<string, number>()
  let meters = 0, rolls = 0
  for (const line of doc.lines) {
    const qty = line.rolls.reduce((sum, roll) => sum + roll.qty, 0)
    units.set(line.unit, (units.get(line.unit) || 0) + qty)
    meters += dyeLengthMeters(qty, line.unit) ?? 0
    rolls += line.rolls.length
  }
  return {rolls, meters, yards: meters / .9144, skus: new Set(doc.lines.map(line => line.sku)).size, text: [...units].map(([unit, qty]) => `${qty.toFixed(2)} ${unit}`).join(' / ')}
}

/** 依据线上 SURAT JALAN 字段组织；非长度单位独立保留，不能相加成长度。 */
export function renderDyeDispatchPrint(doc: DyeDispatchDocument, orders: DyeWorkOrderOnlineRow[]): string {
  const q = dyeDispatchQuantities(doc)
  const cell = (value: string | number) => `<td>${e(value)}</td>`
  const rows = doc.lines.map((line, index) => {
    const row = orders.find(order => order.dyeOrderId === line.orderId)!
    const qty = line.rolls.reduce((sum, roll) => sum + roll.qty, 0), meters = dyeLengthMeters(qty, line.unit)
    return `<tr>${cell(index+1)}${cell(meters === null ? '不适用' : (meters/.9144).toFixed(2))}${cell(meters === null ? '不适用' : meters.toFixed(2))}${cell(line.rolls.length)}<td class="object"><img src="${e(row.productImageUrl)}" alt="${e(row.productName)}"><b>${e(row.productName)}</b><br>${e(row.productCode)}</td><td class="object"><img src="${e(row.outputImageUrl)}" alt="${e(row.materialName)}"><b>${e(row.materialName)}</b><br>${e(line.sku)}</td>${cell(line.orderNo)}${cell(row.purchaseOrderNo)}${cell(row.productionOrderNo || '备料，未关联生产单')}${cell(`${qty.toFixed(2)} ${line.unit}\n${line.receiver}`)}</tr>`
  }).join('')
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>染色交出单 ${e(doc.id)}</title><style>
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#ddd;color:#172033;font:11px Arial,"Microsoft YaHei",sans-serif}.sheet{width:277mm;min-height:185mm;margin:12px auto;padding:7mm;background:white}header{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:20px;align-items:center;border-bottom:2px solid #1e293b;padding-bottom:14px}h1{font-size:24px;margin:0}h2{font-size:22px;margin:0 0 8px}.barcode{text-align:center}.barcode svg{width:310px;height:52px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:14px 0}.meta p{margin:6px 0}.meta b{display:inline-block;min-width:115px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}th{background:#1e293b;color:#fff;font-size:9px}th,td{border:1px solid #b7bec8;padding:7px 4px;overflow-wrap:anywhere;text-align:center;vertical-align:middle}th:nth-child(1){width:4%}th:nth-child(2),th:nth-child(3),th:nth-child(4){width:6%}th:nth-child(5),th:nth-child(6){width:16%}td.object{text-align:left}img{width:28px;height:32px;object-fit:contain;float:left;margin:0 5px 3px 0}tr{break-inside:avoid}tfoot td{background:#f1f5f9;font-weight:bold}.notes{border:1px solid #b7bec8;padding:10px;margin-top:12px;min-height:44px}.signatures{display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;margin-top:18px}.signatures div{height:70px}.signatures span{display:block;margin-top:35px}.footer{border-top:1px solid #ccc;padding-top:8px;display:flex;justify-content:space-between}.draft{color:#b45309;font-weight:bold}@media print{body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0}th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><article class="sheet">
    <header><h1>${e(doc.lines[0]?.factoryName || '')}</h1><div class="barcode">${renderCode128Barcode(doc.id,doc.id)}<div>${e(doc.id)}</div></div><div><h2>SURAT JALAN</h2><div>染色交出单</div><p>${e(doc.handedOverAt || doc.createdAt)}</p></div></header>
    <div class="meta"><div><p><b>KEPADA / PENERIMA</b>${e([...new Set(doc.lines.map(line=>line.receiver))].join(' / '))}</p><p><b>JUMLAH PESANAN</b>${doc.lines.length} 单 · ${q.rolls} Roll · ${q.skus} SKU</p><p><b>STATUS / 状态</b><span class="${doc.status==='草稿'?'draft':''}">${e(getDyeDispatchStatus(doc))}${doc.status==='草稿'?'（尚未交出）':''}</span></p></div><div><p><b>JENIS KENDARAAN</b>${e(doc.transport.vehicle || '尚未登记')}</p><p><b>DRIVER / SUPIR</b>${e(doc.transport.driver || '尚未登记')}</p><p><b>NO. POLISI</b>${e(doc.transport.plate || '尚未登记')}</p></div></div>
    <table><thead><tr>${['NO','YARD','METER','ROLL','SPU / 商品','JENIS KAIN / 面料 SKU','ID PRINT / 加工单','PURCHASE NO / 需求','ID PO / 生产单','KETERANGAN / 数量及接收方'].map(title=>`<th>${title}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td>合计</td><td>${q.yards.toFixed(2)}</td><td>${q.meters.toFixed(2)}</td><td>${q.rolls}</td><td colspan="6">${e(q.text)} · ${doc.lines.length} Pesanan</td></tr></tfoot></table>
    <div class="notes"><b>Catatan Pengiriman / 送货备注</b><p>${e(doc.transport.note || '无特殊交接要求')}</p></div><div class="signatures"><div>Tanda Tangan yang Terima / 收货人<span>____________________</span></div><div>Mengetahui / 核对人<span>____________________</span></div><div>Hormat Kami / 交货人<span>____________________</span></div></div><footer class="footer"><span>操作人：${e(doc.operator)}</span><span>单据：${e(doc.id)}</span></footer>
    </article></body></html>`
}
