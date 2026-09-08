// E2E-003/004: actual page handlers, partial quantities, operator facts and atomic reservations.
import assert from 'node:assert/strict'
import * as prep from '../src/data/fcs/cutting/production-material-prep.ts'
import {handleFcsCuttingPrepEvent} from '../src/pages/fcs/material-prep/cutting.ts'
import {handleFcsSewingPrepEvent} from '../src/pages/fcs/material-prep/sewing.ts'
import {handleFcsOtherPrepEvent} from '../src/pages/fcs/material-prep/other.ts'
import {handleFcsDyeingPrepEvent} from '../src/pages/fcs/material-prep/dyeing.ts'
import {handleFcsPrintingPrepEvent} from '../src/pages/fcs/material-prep/printing.ts'
const memory=new Map<string,string>();const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}
const alerts:string[]=[];let prompts:(string|null)[]=[]
;(globalThis as any).window={localStorage:storage,alert:(s:string)=>alerts.push(s),prompt:()=>prompts.shift()??null,history:{replaceState(){}},location:{pathname:'/fcs/material-prep/cutting',search:''},dispatchEvent(){}}
;(globalThis as any).PopStateEvent=class {constructor(public type:string){}}
const cases=[['裁片配料',handleFcsCuttingPrepEvent],['车缝配料',handleFcsSewingPrepEvent],['其他配料',handleFcsOtherPrepEvent],['染色配料',handleFcsDyeingPrepEvent],['印花配料',handleFcsPrintingPrepEvent]] as const
for(const [category,handler] of cases){
 const projection=prep.listMaterialPrepOrderProjections(storage).find(p=>!p.order.isClosed&&p.lines.some(l=>prep.classifyPrepLineType(l)===category&&l.maxPrepQty>1&&!l.sourceDataIssue))
 assert(projection,category+' requires actual stocked fixture');const line=projection.lines.find(l=>prep.classifyPrepLineType(l)===category&&l.maxPrepQty>1&&!l.sourceDataIssue)!
 let qty='0';let count='0';const fields:any={'[data-fcs-prep-operator]':{value:'Budi'},'[data-fcs-prep-time]':{value:'2026-09-07 15:53'},'[data-fcs-prep-remark]':{value:'实际部分配料；余量下次'}}
 const row={dataset:{prepLineId:line.prepLineId},querySelector:(s:string)=>({value:s.includes('-qty')?qty:count})}
 const form={querySelector:(s:string)=>fields[s],querySelectorAll:()=>[row]}
 const button:any={dataset:{fcsMaterialPrepAction:'create-prep-record',prepOrderId:projection.order.prepOrderId},closest:(s:string)=>s==='[data-fcs-prep-form]'?form:button}
 const before=()=>JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords)
 let snapshot=before();handler(button);assert.equal(before(),snapshot,category+' zero must not auto-fill')
 qty=String(line.maxPrepQty+1);handler(button);assert.equal(before(),snapshot,category+' excess must not write')
 qty='0.000001';handler(button);assert.equal(before(),snapshot,category+' rounded-zero must not write')
 qty='1';handler(button);const record=prep.hydrateProductionMaterialPrepStore(storage).prepRecords[0]
 assert.equal(record.operatorName,'Budi');assert.equal(record.preparedAt,'2026-09-07 15:53');assert.equal(record.remark,fields['[data-fcs-prep-remark]'].value);assert.equal(record.items?.length,1);assert.equal(record.items?.[0].preparedQty,1);assert.equal(record.items?.[0].rollCount,0)
 assert.equal(prep.getMaterialPrepRecordItems(record)[0].rollCount,0,'页面读取不得把0卷改成1卷')
 button.dataset={fcsMaterialPrepAction:'pick-record',prepRecordId:record.prepRecordId};snapshot=before();prompts=[null];handler(button);assert.equal(before(),snapshot,'cancel pick no write');prompts=['Agus'];handler(button)
 let saved=prep.hydrateProductionMaterialPrepStore(storage).prepRecords.find(r=>r.prepRecordId===record.prepRecordId)!;assert.equal(saved.pickedBy,'Agus')
 button.dataset.fcsMaterialPrepAction='stage-record';snapshot=before();prompts=['实际仓库备料区',null];handler(button);assert.equal(before(),snapshot,'cancel stage operator no write');prompts=['实际仓库备料区','Siti'];handler(button)
 saved=prep.hydrateProductionMaterialPrepStore(storage).prepRecords.find(r=>r.prepRecordId===record.prepRecordId)!;assert.equal(saved.stagedBy,'Siti')
 button.dataset.fcsMaterialPrepAction='confirm-record';snapshot=before();prompts=[null];handler(button);assert.equal(before(),snapshot,'cancel confirm no write');prompts=['Dewi'];handler(button)
 saved=prep.hydrateProductionMaterialPrepStore(storage).prepRecords.find(r=>r.prepRecordId===record.prepRecordId)!;assert.equal(saved.confirmedBy,'Dewi')
 console.log(category,'actual handler: zero/excess/partial/person/time/remark/count/pick/stage/confirm/cancel PASS')
}
console.log('PASS five actual handlers')
const p=prep.listMaterialPrepOrderProjections(storage).find(p=>!p.order.isClosed&&p.lines.filter(l=>l.maxPrepQty>2&&!l.sourceDataIssue).length>1)!
const lines=p.lines.filter(l=>l.maxPrepQty>2&&!l.sourceDataIssue).slice(0,2)
const input={prepOrderId:p.order.prepOrderId,prepLineId:lines[0].prepLineId,preparedQty:1,rollCount:0,operatorName:'Budi',preparedAt:'2026-09-07 15:53',remark:'两行部分量',warehouseArea:'',locationCode:'',items:lines.map(l=>({prepLineId:l.prepLineId,preparedQty:1,rollCount:0}))}
const beforeRows=JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords)
assert.throws(()=>prep.appendManualPrepRecord({...input,items:[input.items[0],{...input.items[1],preparedQty:lines[1].maxPrepQty+1}]},storage),/不能超过/)
assert.equal(JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords),beforeRows,'second invalid line leaves no first-line reservation')
for(const override of [{operatorName:''},{preparedAt:'2026-02-30 15:53'},{preparedAt:'bad'},{items:[input.items[0],input.items[0]]}]) {assert.throws(()=>prep.appendManualPrepRecord({...input,...override},storage));assert.equal(JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords),beforeRows)}
const saved=prep.appendManualPrepRecord(input,storage);assert.equal(saved.items?.length,2);assert(saved.items?.every(i=>i.preparedQty===1));assert.equal(saved.preparedAt,input.preparedAt);assert.equal(prep.hydrateProductionMaterialPrepStore(storage).prepRecords.length,JSON.parse(beforeRows).length+1)
console.log('PASS multi-line single record, second-invalid-line atomicity, invalid calendar/person/duplicate rejects')
import fs from 'node:fs'
import {productionOrders} from '../src/data/fcs/production-orders.ts'
const fresh=JSON.parse(fs.readFileSync('output/verification/seven-demand-acceptance/first-run/higoods-demand-seven-facts.json','utf8')).orders[0]
fresh.productionOrderId='PO-PREP-FORM-POOL';fresh.techPackSnapshot.bomItems=fresh.techPackSnapshot.bomItems.slice(0,1);const bom=fresh.techPackSnapshot.bomItems[0];bom.materialCode='FORM-POOL-SKU';bom.unit='米';bom.unitConsumption=10;bom.lossRate=0;fresh.techPackSnapshot.bomItems.push({...bom,id:bom.id+'-second'});productionOrders.push(fresh)
prep.materialPrepInitialStockInputs.push({sourceId:'FORM-POOL-INITIAL',materialSku:'FORM-POOL-SKU',unit:'米',stockWarehouseName:prep.listMaterialPrepOrderProjections(storage).find(p=>p.order.productionOrderId===fresh.productionOrderId)!.lines[0].stockWarehouseName,warehouseArea:'原仓库A区',locationCode:'RAW-A-001',quantity:10,sourceDescription:'专项显式初始输入10米'})
const pool=prep.listMaterialPrepOrderProjections(storage).find(p=>p.order.productionOrderId===fresh.productionOrderId)!;assert.equal(pool.lines.length,2)
const poolInput={...input,prepOrderId:pool.order.prepOrderId,prepLineId:pool.lines[0].prepLineId,items:pool.lines.map(l=>({prepLineId:l.prepLineId,preparedQty:6,rollCount:0}))}
console.log('POOL',pool.lines.map(l=>({sku:l.materialSku,qty:l.requiredQty,max:l.maxPrepQty,stock:l.availableStockQty,issue:l.sourceDataIssue})))
const poolBefore=JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords)
assert.throws(()=>prep.appendManualPrepRecord(poolInput,storage),/合计配料数量/);assert.equal(JSON.stringify(prep.hydrateProductionMaterialPrepStore(storage).prepRecords),poolBefore)
const partial=prep.appendManualPrepRecord({...poolInput,items:poolInput.items.map(i=>({...i,preparedQty:3}))},storage);assert.equal(partial.items?.length,2)
assert(prep.listMaterialPrepOrderProjections(storage).find(p=>p.order.productionOrderId===fresh.productionOrderId)!.lines.every(l=>l.availableStockQty===4))
console.log('PASS same-SKU two-BOM 6+6 exceeds initial10 atomically;3+3 saves one record, shared balance4')
