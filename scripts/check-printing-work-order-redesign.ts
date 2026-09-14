/** Approved 2026-09-14 contract: six processing states, eight columns, actual receipts and independent production. */
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {listPrintingWorkOrders,PRINTING_PROCESSING_STATUSES,PRINTING_RECEIPT_STATUSES,PRINTING_HANDOVER_STATUSES,metersFromYards,weightKgFromMeters,formatPrintingWeightKg,changePrintingInput,receivePrintingInput} from '../src/data/fcs/printing-work-order-business.ts'
import {renderCraftPrintingWorkOrdersPage} from '../src/pages/process-factory/printing/work-orders.ts'
import {renderCraftPrintingWorkOrderDetailPage} from '../src/pages/process-factory/printing/work-order-detail.ts'
const rows=listPrintingWorkOrders()
assert.deepEqual(PRINTING_PROCESSING_STATUSES.map(s=>s.label),['待分配','待接收投入','未开始','加工中','加工完成','已取消'])
assert.deepEqual(PRINTING_RECEIPT_STATUSES.map(s=>s.label),['待来源','待接收','部分接收','已收齐','差异待处理'])
assert.deepEqual(PRINTING_HANDOVER_STATUSES.map(s=>s.label),['未到交出','待交出','部分交出','全部交出'])
assert.equal(new Set(rows.map(o=>o.workOrderId)).size,rows.length)
for(const o of rows){
 assert.equal(o.plannedInput.objectType,o.output.objectType);assert.equal(o.plannedInput.qtyUnit,o.output.qtyUnit)
 for(const m of [o.product,o.plannedInput,o.output])assert(m.imageUrl&&existsSync(new URL(`../public${m.imageUrl}`,import.meta.url)),`${o.printOrderNo}: corresponding material/product asset`)
 assert(o.barcodes.every(b=>b.sku===o.output.sku));assert(!('editConfirmation' in o))
}
assert(rows.some(o=>o.plannedInput.objectType==='纱线'))
assert.equal(metersFromYards(48),43.89);assert.equal(weightKgFromMeters(10,165,220),3.63);assert.equal(formatPrintingWeightKg(12.3456),'12.346')
assert.throws(()=>receivePrintingInput(rows[0].workOrderId,{actualSku:rows[0].plannedInput.sku,receivedQty:1,receivedRollCount:1,receiverName:'检查员',receiptId:'FAKE',upstreamRecordId:'FAKE'}),/待接收/)
const done=rows.find(o=>o.output.completedQty>0)!
assert.throws(()=>changePrintingInput(done.workOrderId,{newSku:'OTHER',newMaterialName:'OTHER',newImageUrl:'',reason:'check',operatorName:'检查员'}),/拆分剩余数量/)
const html=renderCraftPrintingWorkOrdersPage()
for(const word of ['需求来源','加工投入','加工要求','处理进度','加工产出','时间','数量','更多筛选'])assert(html.includes(word),word)
assert.equal((html.match(/<th\b/g)||[]).length,9)
assert(html.includes('right-0'));assert(html.includes('data-printing-time-groups'))
const detail=renderCraftPrintingWorkOrderDetailPage(rows[0].workOrderId)
for(const word of ['需求来源','上游','加工要求','开工','印花信息单','印花确认单'])assert(detail.includes(word),word)
console.log('PASS printing redesign: objects, assets, actual-receipt boundary, immutable execution, eight columns and detail contracts')
