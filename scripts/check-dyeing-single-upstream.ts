import assert from 'node:assert/strict'
const values = new Map<string,string>()
const storage = {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}
Object.defineProperty(globalThis,'window',{value:{localStorage:storage,sessionStorage:storage,addEventListener:()=>{},dispatchEvent:()=>{},location:{pathname:'/fcs/craft/dyeing/work-orders'}},configurable:true})
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})
Object.defineProperty(globalThis,'document',{value:{addEventListener:()=>{},querySelector:()=>null},configurable:true})
const core = await import('../src/data/fcs/factory-receiving.ts')
const links = await import('../src/data/fcs/factory-receiving-links.ts')
const view = await import('../src/data/fcs/dye-work-order-online-view.ts')
const page = await import('../src/pages/process-factory/dyeing/work-orders.ts')
for(const row of view.listDyeWorkOrderOnlineRows()) {
  assert.equal(row.inputMaterials.length,1,`${row.dyeOrderId} 只有一种投入物料`)
  assert.equal(new Set(row.upstreamDocuments.map(d=>d.partner.kind+'|'+d.partner.id)).size,1,`${row.dyeOrderId} 只有一个上游`)
}
const source = core.getFactoryReceivingSource('RCV-SRC-001')!
const foreign = core.getFactoryReceivingSource('RCV-SRC-003')!
assert.equal(foreign.lines[0].dyeOrderId,undefined,'其他上游的来货作为备料保留')
const wrong = structuredClone(source);wrong.id='SU-WRONG';wrong.documentNo='DB-SU-WRONG';wrong.lines[0].id='SU-WRONG-L1';wrong.lines[0].material.sku='OTHER-SKU'
assert.throws(()=>core.registerFactoryReceivingSource(wrong),/一种投入物料/)
wrong.lines[0].material.sku=source.lines[0].material.sku;wrong.origin=foreign.origin
assert.throws(()=>core.registerFactoryReceivingSource(wrong),/一个上游/)
const position = core.getDefaultFactoryReceiptPosition('ID-F003')
const receive=(id:string,s:typeof source,roll:number)=>links.confirmFactoryMaterialReceipt({id,factoryId:'ID-F003',operatorName:'hilon',operatorId:'RCV-HILON',receivedAt:'2026-09-12 14:00:00',remark:'单一投入验收',lines:[{sourceId:s.id,sourceLineId:s.lines[0].id,...position,rolls:[{...position,...s.lines[0].rolls[roll]}]}]})
receive('SU-PART-1',source,0);receive('SU-PART-2',source,1)
assert.equal(core.getSourceActualReceipts(source.id).reduce((n,r)=>n+r.qty,0),200)
const reserve=receive('SU-RESERVE',foreign,0)
assert(!links.listReceivingAllocationTargets(reserve.lines[0].id).some(t=>t.id==='DWO-001'))
assert.throws(()=>core.allocateFactoryReceivedMaterial({id:'SU-ALLOC',receiptLineId:reserve.lines[0].id,dyeOrderId:'DWO-001',qty:10,operatorName:'hilon',at:'2026-09-12 14:30:00'}),/一个上游/)
const row=view.listDyeWorkOrderOnlineRows().find(r=>r.dyeOrderId==='DWO-001')!
assert.equal(row.upstreamDocuments.length,2,'同上游分批单据保留')
assert.equal(row.upstreamDocuments.reduce((n,d)=>n+d.sentQty,0),800)
const html=page.renderCraftDyeingWorkOrdersPage()
assert.equal((html.match(/data-dye-upstream-partner/g)||[]).length,10,'每行仅显示一次上游资料')
assert(!html.includes('undefined')&&!html.includes('NaN'))
const csv=view.buildDyeWorkOrderCsv([row],'全部')
assert(csv.includes('DB-260911-001')&&csv.includes('DB-260911-016'))
// Old unoperated seed is repaired on load, without resetting other receipt facts.
const saved=core.captureFactoryReceivingData()
saved.receipts=saved.receipts.filter(r=>r.id!=='SU-RESERVE')
const old=saved.sources.find(s=>s.id==='RCV-SRC-003')!.lines[0]
old.dyeOrderId='DWO-001';old.productionOrderNo='PO-202603-086';old.taskNo='TASK-DYE-000721'
values.set(core.FACTORY_RECEIVING_KEY,JSON.stringify(saved));core.clearFactoryReceivingCache()
assert.equal(core.getFactoryReceivingSource('RCV-SRC-003')!.lines[0].dyeOrderId,undefined)
assert.equal(core.getSourceActualReceipts(source.id).reduce((n,r)=>n+r.qty,0),200)
const untouched=core.captureFactoryReceivingData()
const prior=structuredClone(saved)
prior.receipts.push({...reserve,lines:reserve.lines.map(line=>({...line,dyeOrderId:'DWO-001',productionOrderNo:'PO-202603-086',taskNo:'TASK-DYE-000721'}))})
values.set(core.FACTORY_RECEIVING_KEY,JSON.stringify(prior));core.clearFactoryReceivingCache()
assert.equal(core.getFactoryReceivingSource(foreign.id)!.lines[0].dyeOrderId,'DWO-001','已经实收的历史不静默改写')
assert.equal(core.getSourceActualReceipts(foreign.id)[0].qty,100)
assert.throws(()=>receive('SU-LEGACY-CONFLICT',foreign,1),/一个上游/,'有冲突的历史不能继续混入新来货')
core.restoreFactoryReceivingData(untouched)
console.log('PASS SU-001..006: single SKU/origin, source/receipt/allocation guards, split receipts, source documents, old seed repair without losing quantities')
