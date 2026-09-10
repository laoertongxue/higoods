import { printingPendingReceiptQty, isPrintablePrintingRoll } from '../src/data/fcs/printing-task-domain.ts'
import assert from 'node:assert/strict'
import { listPrintingWorkOrders } from '../src/data/fcs/printing-work-order-business.ts'
import { buildPrintingInfoSheetDocument, buildPrintingConfirmationDocument, buildPrintingRollLabelDocument } from '../src/pages/print/templates/printing-work-order-template.ts'
const rows=listPrintingWorkOrders()
const input=(sourceId:string)=>({documentType:'PRINTING_INFO_SHEET' as const,sourceType:'PRINTING_WORK_ORDER' as const,sourceId})
for(const row of rows){
 const doc=buildPrintingInfoSheetDocument(input(row.workOrderId))
 for(const block of doc.imageBlocks || []) if(block.title.includes('花型')) assert(!/sample\./.test(block.imageUrl || ''),'样衣图不能作为正式花型打印')
 const fields=doc.sections.flatMap(x=>x.fields || [])
 assert(!fields.some(x=>x.label==='物料 SPU'))
 const output=fields.find(x=>x.label==='加工产出 SKU')
 if(/^tdv[-_]/i.test(row.output.sku)) assert.equal(output?.value,'产出编码待完善')
 assert(fields.some(x=>x.label==='下游待接收' && x.value===`${row.pendingWritebackQty.toFixed(2)} ${row.output.qtyUnit}`))
 if(row.historicalInputQuantityUnknown) assert(fields.some(x=>x.label==='实际接收' && x.value==='历史未记录'))
}
const selected=[rows[1].workOrderId,rows[3].workOrderId]
assert.deepEqual(buildPrintingConfirmationDocument({...input(selected.join(',')),documentType:'PRINTING_CONFIRMATION'}).relatedObjectIds,selected)
assert.throws(()=>buildPrintingInfoSheetDocument(input(`${selected[0]},NOT-EXIST`)),/不存在/)
const withRoll=rows.find(x=>x.barcodes.length)!
assert.throws(()=>buildPrintingRollLabelDocument({...input(`${withRoll.workOrderId}:${withRoll.barcodes[0].id},NOT-EXIST`),documentType:'PRINTING_ROLL_LABEL',sourceType:'PRINTING_ROLL_RECORD'}),/不存在/)
console.log('PASS 打印两端字段、历史未知数量、花型参考与正式区分、批量范围和不存在卷阻断')

const draftOrder=rows.find(row=>row.output.completedQty===0 && row.barcodes.length)!
assert(!isPrintablePrintingRoll(draftOrder,draftOrder.barcodes[0]))
assert.throws(()=>buildPrintingRollLabelDocument({...input(`${draftOrder.workOrderId}:${draftOrder.barcodes[0].id}`),documentType:'PRINTING_ROLL_LABEL',sourceType:'PRINTING_ROLL_RECORD'}),/仅能打印/)
assert.equal(printingPendingReceiptQty([{handoverRecordStatus:'VOIDED',submittedQty:800,receiverWrittenQty:760} as any],40),0,'全部撤销不能退回历史待收')
assert.equal(printingPendingReceiptQty([{factoryDiffDecision:'ACCEPT_DIFF',submittedQty:800,receiverWrittenQty:760} as any],40),0)
assert.equal(printingPendingReceiptQty([{submittedQty:800,receiverWrittenQty:760} as any],0),40)
console.log('PASS 零数量草稿禁止打印、全部作废与已确认差异不挂待收')
