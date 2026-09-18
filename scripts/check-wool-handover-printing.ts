import assert from 'node:assert/strict'
import {readWoolStore} from '../src/data/fcs/wool-domain/store.ts'
import {renderCraftWoolHandoverPrintPage} from '../src/pages/process-factory/wool/handover-print.ts'
const store=readWoolStore()
for(const stage of ['KNITTING','LINKING'] as const){
 const order=store.workOrders[`WOOL-STAGE-013:${stage}`]
 const records=store.handovers.filter(h=>h.woolOrderId===order.woolOrderId&&!h.automatic)
 assert.ok(records.length)
 for(const handover of records){const html=renderCraftWoolHandoverPrintPage(order.woolOrderId,handover.handoverId,stage);assert.ok(html.includes(handover.handoverId));assert.ok(html.includes(handover.receiverName));assert.ok(html.includes(stage==='KNITTING'?'横机':'缝盘'));assert.ok(html.includes(handover.qtyUnit));assert.ok(html.includes('cardigan-sample.jpg'));assert.ok(/data-.*qr|qrcode|二维码/.test(html));if(handover.pieceKey)assert.ok(html.includes(order.externalPieces.find(p=>p.pieceKey===handover.pieceKey)!.pieceName))}
 const wrong=renderCraftWoolHandoverPrintPage(order.woolOrderId,records[0].handoverId,stage==='KNITTING'?'LINKING':'KNITTING');assert.ok(!wrong.includes('data-wool-print-page'))
 console.log(`PASS ${stage} 打印含真实阶段、批次、接收厂、图片、二维码及单位`)
}
const h=store.handovers.find(x=>x.automatic)!
assert.match(renderCraftWoolHandoverPrintPage(h.woolOrderId,h.handoverId),/未找到|不存在|无.*交出|自动|没有/)
console.log('PASS 内部自动衔接无外发打印单')
