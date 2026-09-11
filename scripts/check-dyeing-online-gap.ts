/** PEND-004..006, DOC-003..005, MOCK-001: dispatch transaction and cold-restart acceptance. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const saved = process.env.DYE_DISPATCH_REPLAY ? JSON.parse(readFileSync(process.env.DYE_DISPATCH_REPLAY,'utf8')) : []
const values = new Map<string,string>(saved), storage = {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})
Object.defineProperty(globalThis,'window',{value:{localStorage:storage,sessionStorage:storage,addEventListener:()=>{},dispatchEvent:()=>{},location:{pathname:'/fcs/craft/dyeing/pending-handover'}},configurable:true})
Object.defineProperty(globalThis,'document',{value:{addEventListener:()=>{}},configurable:true})
const d = await import('../src/data/fcs/dyeing-task-domain.ts')
const r = await import('../src/data/fcs/factory-receiving.ts')
const w = await import('../src/data/fcs/factory-receiving-warehouse.ts')
const id='DYE-DISPATCH-DEMO-1', second='DYE-DISPATCH-DEMO-2', pick=(orderId:string,index:number)=>({orderId,rollIds:[d.getDyeOutputRolls(orderId)[index].id]})
if(process.env.DYE_DISPATCH_REPLAY){
  const doc=d.listDyeDispatchDocuments().find(doc=>doc.operator==='交出验收')!
  assert.equal(doc.status,'已交出');assert.equal(doc.scans.length,2);assert.equal(doc.lines.length,2)
  assert.equal(d.getDyeDispatchAvailableQty(id),300)
  assert.equal(d.getDyeOrderHandoverSummary(id).submittedQty,60)
  assert.equal(d.getDyeOrderHandoverSummary(id).writtenBackQty,58)
  assert.equal(r.getSourceActualReceipts(doc.lines[0].receivingSourceId!).length,1)
  assert.equal(w.buildFactoryReceiptInboundRecords().filter(row=>row.remark.includes('DISPATCH-RECEIPT')).reduce((n,row)=>n+row.receivedQty,0),58)
  assert(d.getDyeOutputRolls(id).find(roll=>roll.id===doc.lines[0].rolls[0].id)!.dispatchId)
  const draft=d.listDyeDispatchDocuments().find(doc=>doc.operator==='刷新草稿')!
  assert.equal(draft.status,'草稿');assert(!d.isDyeRollAvailable(second,draft.lines[0].rolls[0]))
  console.log('PASS 冷启动：草稿占用、已交出卷、原交接单、下游58Yard实收、库存不重复')
  process.exit(0)
}
assert.equal(d.listDyeDispatchDocuments().length,3)
const doc=d.createDyeDispatchDocument([pick(id,1),pick(second,1)],'交出验收')
assert.equal(doc.lines.length,2);assert.equal(d.getDyeDispatchAvailableQty(id),360,'建单不发生实际交出')
assert.throws(()=>d.createDyeDispatchDocument([pick(id,1)],'重复'),/占用/)
assert.throws(()=>d.createDyeDispatchDocument([pick('DYE-DISPATCH-DEMO-4',2)],'跨厂',doc.id),/不同加工厂/)
assert.throws(()=>d.createDyeDispatchDocument([pick('DYE-DISPATCH-DEMO-3',0)],'零卷'),/未维护/)
assert.throws(()=>d.createDyeDispatchDocument([pick('DYE-DISPATCH-DEMO-3',1)],'未打印'),/未打印/)
assert.throws(()=>d.saveDyeOutputRolls(id,[{id:doc.lines[0].rolls[0].id,qty:100}]),/占用/)
assert.throws(()=>d.deleteDyeOutputRolls(id,[doc.lines[0].rolls[0].id]),/占用/)
assert.throws(()=>d.finishDyeDispatchDocument(doc.id,'confirm'),/逐卷扫码/)
assert.throws(()=>d.scanDyeDispatchRoll(doc.id,'WRONG','hilon'),/不在当前/)
for(const line of doc.lines)for(const roll of line.rolls)d.scanDyeDispatchRoll(doc.id,roll.barcode,'hilon')
assert.throws(()=>d.scanDyeDispatchRoll(doc.id,doc.lines[0].rolls[0].barcode,'hilon'),/已经扫码/)
assert.throws(()=>d.finishDyeDispatchDocument(doc.id,'confirm'),/司机/)
d.saveDyeDispatchTransport(doc.id,{driver:'Agus',vehicle:'厢式货车',plate:'B 9123 KJA',note:'按单核对'})
const finished=d.finishDyeDispatchDocument(doc.id,'confirm')
assert.equal(finished.status,'已交出');assert.equal(d.getDyeDispatchAvailableQty(id),300)
assert.throws(()=>d.finishDyeDispatchDocument(doc.id,'confirm'),/草稿/)
assert.throws(()=>d.createDyeDispatchDocument([pick(id,2)],'晚追加',doc.id),/草稿/)
const source=r.getFactoryReceivingSource(finished.lines[0].receivingSourceId!)!
assert.equal(source.targetFactoryId,'ID-F002');assert.equal(source.lines[0].sentQty,60);assert.equal(source.lines[0].rolls[0].yard,60)
assert(source.originalRecordId);assert.equal(source.documentNo,doc.id)
const position=r.getDefaultFactoryReceiptPosition('ID-F002')
const receipt=r.prepareFactoryReceipt({id:'DISPATCH-RECEIPT',factoryId:'ID-F002',operatorName:'dewi',operatorId:'RCV-DEWI',receivedAt:'2026-09-12 10:00:00',remark:'少收2Yard如实登记',lines:[{sourceId:source.id,sourceLineId:source.lines[0].id,...position,rolls:[{...position,barcode:source.lines[0].rolls[0].barcode,yard:58}]}]})
const links=await import('../src/data/fcs/factory-receiving-links.ts');links.confirmFactoryMaterialReceipt(JSON.parse(receipt.fingerprint))
assert.equal(d.getDyeOrderHandoverSummary(id).writtenBackQty,58)
const handovers=await import('../src/data/fcs/pda-handover-events.ts');const original=handovers.findPdaHandoverRecord(finished.lines[0].handoverRecordId!)!;handovers.upsertPdaHandoutRecordMock({...original,qtyUnit:'米'});assert.equal(handovers.findPdaHandoverRecord(original.recordId)!.receiverWrittenQty,53.0352,'58 Yard 实收回传米单据时必须换算');handovers.upsertPdaHandoutRecordMock(original);
const voidDoc=d.createDyeDispatchDocument([pick(id,2)],'作废验收');d.finishDyeDispatchDocument(voidDoc.id,'void');assert(d.isDyeRollAvailable(id,d.getDyeOutputRolls(id)[2]))
const merge=d.createDyeDispatchDocument([pick(second,2)],'刷新草稿');d.createDyeDispatchDocument([pick(second,3)],'追加',merge.id)
assert.equal(d.listDyeDispatchDocuments().find(doc=>doc.id===merge.id)!.lines[0].rolls.length,2)
assert.throws(()=>d.submitDyeHandover(second,{handoverQty:d.getDyeDispatchAvailableQty(second)}),/逐卷建单/)
const editable=d.getDyeOutputRolls(id)[4];d.saveDyeOutputRolls(id,[{id:editable.id,qty:editable.qty}]);assert(d.getDyeOutputRolls(id)[4].printedAt,'标签未变化保留打印状态');d.saveDyeOutputRolls(id,[{id:editable.id,qty:59}]);assert(!d.getDyeOutputRolls(id)[4].printedAt,'标签变化必须重打');assert.throws(()=>d.createDyeDispatchDocument([pick(id,4)],'未重打'),/未打印/);d.markDyeOutputRolls(id,[editable.id],'print');assert(d.isDyeRollAvailable(id,d.getDyeOutputRolls(id)[4]));
const before=JSON.stringify(d.getDyeOutputRolls(id));assert.throws(()=>d.saveDyeOutputRolls(id,[{qty:2},{qty:NaN}]),/非负/);assert.equal(JSON.stringify(d.getDyeOutputRolls(id)),before)
d.markDyeOutputRolls(id,[finished.lines[0].rolls[0].id],'print');assert(d.getDyeOutputRolls(id)[1].dispatchId,'补打不释放已交出卷')
const file=join(mkdtempSync(join(tmpdir(),'dye-dispatch-')),'storage.json');writeFileSync(file,JSON.stringify([...values]));const child=spawnSync(process.execPath,['--import','tsx',import.meta.filename],{env:{...process.env,DYE_DISPATCH_REPLAY:file},encoding:'utf8'});assert.equal(child.status,0,child.stdout+child.stderr);console.log(child.stdout.trim())
console.log('PASS 多单多SKU、打印门槛、跨厂/重复/超量保护、逐卷扫码、分批交出、下游实收回传、作废释放、补打及整体回滚')
