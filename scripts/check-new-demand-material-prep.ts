// E2E-003/004/005/013: replay initial facts from the failed UI run; no completed production outcomes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
const modulePath='../src/data/fcs/cutting/production-material-prep.ts'
const prep=await import(modulePath)
const imported=JSON.parse(fs.readFileSync('output/verification/seven-demand-acceptance/first-run/higoods-demand-seven-facts.json','utf8')).orders.filter((o:any)=>['0103','0104','0105','0106','0107'].some(s=>o.productionOrderId.endsWith(s)))
const before=prep.listMaterialPrepOrderProjections(null)
for(const o of imported) {const i=productionOrders.findIndex(x=>x.productionOrderId===o.productionOrderId);if(i>=0)productionOrders.splice(i,1);productionOrders.push(o)}
for(const o of imported) {
 const p=prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===o.productionOrderId)
 assert(p,`${o.productionOrderId} 新单必须产生物料投影；旧实现0行`)
 assert.equal(p.lines.length,o.techPackSnapshot.bomItems.filter((b:any)=>b.type!=='成衣').length)
 if(o.productionOrderId==='PO-202603-0103') assert.equal(p.lines[0].requiredQty,12.36,'技术资料编辑3%存为0.03，10件×1.2米×1.03必须12.36米')
 assert(p.lines.every((l:any)=>!l.taskLinks.length),'未拆解不得制造加工任务')
 assert(p.lines.every((l:any)=>l.availableStockQty===0),'无匹配原库存不能制造足量')
 assert.equal(prep.getMaterialPrepBreakdownReadinessForOrder(o.productionOrderId,null).ready,false)
 console.log(o.productionOrderId,p.lines.map((l:any)=>({sku:l.materialSku,qty:l.requiredQty,unit:l.unit,issue:l.sourceDataIssue})))
}
const derived=await import('../src/data/fcs/production-process-snapshot-derivation.ts')
const formal=derived.deriveFormalProductionOrderProcessSnapshots(imported[0]);assert(formal.some((row:any)=>row.materialItems.some((item:any)=>item.sourceBomItemId===imported[0].techPackSnapshot.bomItems[0].id)&&row.plannedQty===12.36),'正式PRINT/DYE加工单必须同源12.36米，不能用/100变12.0036')
const one=imported[0],snap=one.techPackSnapshot, first=snap.bomItems[0]
const linesBefore=prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===one.productionOrderId).lines
snap.bomItems.push({...first,id:first.id+'-same-code',unit:'Yard',unitConsumption:2})
let view=prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===one.productionOrderId)
assert.equal(view.lines.length,linesBefore.length+1,'缓存须识别冻结BOM变化')
assert.equal(new Set(view.lines.map((l:any)=>l.prepLineId)).size,view.lines.length,'同码多BOM按BOM身份隔离')
assert.equal(view.lines.at(-1).unit,'Yard','同码不同单位不可被首行覆盖')
assert.throws(()=>prep.appendManualPrepRecord({prepOrderId:view.order.prepOrderId,prepLineId:view.lines[0].prepLineId,preparedQty:1,rollCount:1,warehouseArea:'',locationCode:'',operatorName:'验收'},null),/不能超过/,'手动不得绕过0库存')
assert.equal(prep.appendAutoPrepRecordForOrder(view.order.prepOrderId,'验收',null),null)
assert.equal(prep.listMaterialPrepOrderProjections(null).filter((p:any)=>before.some((b:any)=>b.order.prepOrderId===p.order.prepOrderId)).length,before.length,'原seed场景保留')
console.log('新5单BOM范围/数量单位缺口、同码多BOM隔离、缓存变化、无假任务、零库存门禁通过')
const stockRow={materialSku:'RAW-EXPLICIT-INPUT-001'};const stockTotal=80
prep.materialPrepInitialStockInputs.push({sourceId:'OPENING-001',materialSku:stockRow.materialSku,unit:'Yard',stockWarehouseName:'中转仓',warehouseArea:'中转仓A区',locationCode:'TR-A-001',quantity:stockTotal,sourceDescription:'专项明确输入初始原料80 Yard；不是采购入库或加工完成'})
first.materialCode=stockRow.materialSku; first.unit='Yard';first.unitConsumption=100;first.lossRate=0
const duplicate=snap.bomItems.at(-1);duplicate.materialCode=stockRow.materialSku;duplicate.unit='Yard';duplicate.unitConsumption=100;duplicate.lossRate=0
view=prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===one.productionOrderId)
const matching=view.lines.filter((l:any)=>l.materialSku===stockRow.materialSku)
assert(matching[0].availableStockQty>0,'精确初始库存输入必须可读')
assert(matching.every((l:any)=>l.availableStockQty===stockTotal),'显示同一真实库存余额，不因未配料BOM静默预分配')
const autoMemory=new Map<string,string>();const autoStorage={getItem:(k:string)=>autoMemory.get(k)??null,setItem:(k:string,v:string)=>{autoMemory.set(k,v)},removeItem:(k:string)=>{autoMemory.delete(k)}}
const autoRecord=prep.appendAutoPrepRecordForOrder(view.order.prepOrderId,'初始库存守恒',autoStorage);assert.equal(autoRecord.items.reduce((n:number,item:any)=>n+item.preparedQty,0),stockTotal,'一次自动配料同SKU多BOM合计不能超过实际库存');assert.equal(prep.appendAutoPrepRecordForOrder(view.order.prepOrderId,'禁止重复占用',autoStorage),null)
duplicate.unit='米'
view=prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===one.productionOrderId)
assert.equal(view.lines.at(-1).availableStockQty,0,'Yard库存不可算作米')
assert.equal(prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===imported[1].productionOrderId).lines[0].availableStockQty,0,'非匹配单不得借用其他单同物料可配量')
const change=await import('../src/data/fcs/production-tech-pack-change-domain.ts')
const facts=change.listProductionOrderChangeCurrentFacts()
change.replaceProductionOrderChangeCurrentFacts([...facts,{...facts[0],productionOrderId:one.productionOrderId,materialFacts:[{...facts[0].materialFacts[0],sourceBomItemId:first.id,sourceTechPackVersionId:snap.sourceTechPackVersionId,executionMaterialReplacement:{materialCode:'REPLACED-ACTUAL-SKU',materialName:'实际替代物料',changeRecordId:'CHECK-ACTUAL-REPLACE'}}]}])
view=prep.listMaterialPrepOrderProjections(null).find((p:any)=>p.order.productionOrderId===one.productionOrderId)
assert.equal(view.lines[0].materialSku,'REPLACED-ACTUAL-SKU','读取按版本+BOM绑定的已执行替料事实')
assert.equal(view.lines[0].availableStockQty,0,'替料后不能沿用原料库存')
assert.equal(view.lines.at(-1).materialSku,stockRow.materialSku,'同码另一BOM不能被替料污染')
console.log('显式原料初始非空库存只按精确SKU/单位读取、不多BOM重复分配、替料独立及缓存失效通过')
// Preparation commands reuse the existing record store and preserve the runtime line's exact unit.
const memory=new Map<string,string>();const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v)},removeItem:(k:string)=>{memory.delete(k)}}
change.replaceProductionOrderChangeCurrentFacts(facts)
view=prep.listMaterialPrepOrderProjections(storage).find((p:any)=>p.order.productionOrderId===one.productionOrderId)
const stocked=view.lines.find((l:any)=>l.availableStockQty>0)
const made=prep.appendManualPrepRecord({prepOrderId:view.order.prepOrderId,prepLineId:stocked.prepLineId,preparedQty:stocked.availableStockQty,rollCount:1,warehouseArea:stocked.stockWarehouseArea,locationCode:stocked.stockLocationCode,operatorName:'专项操作员'},storage)
assert.equal(prep.getMaterialPrepRecordUnitSummaries(made)[0].unit,'Yard','新增物料记录不能回落件')
assert.equal(prep.listMaterialPrepOrderProjections(storage).find((p:any)=>p.order.productionOrderId===one.productionOrderId).lines.find((l:any)=>l.prepLineId===stocked.prepLineId).canPrepQty,0,'已有草稿占用数量不能重复配料')
assert.equal(prep.getMaterialPrepRecordContext(made.prepRecordId,storage)?.items[0].unit,'Yard')
console.log('手动配料共用原记录、单位明细/上下文保持、草稿防重复占库通过')

prep.pickMaterialPrepRecord(made.prepRecordId,'专项拣货',storage)
prep.stageMaterialPrepRecord(made.prepRecordId,'中转仓暂存A区','专项暂存',storage)
prep.confirmMaterialPrepRecord(made.prepRecordId,'专项确认',storage)
const events=await import('../src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
const written=['印花厂配料完成通知','染色厂配料完成通知','中转仓配料完成通知','配料完成通知'].flatMap(type=>events.listCuttingRuntimeEventsByType(type,storage)).find((e:any)=>e.payload?.prepRecordId===made.prepRecordId)
assert(written,'新增BOM确认配料必须写原事件')
assert.equal(written.material.unit,'Yard','原单位不能回落小写yard或件')
const oneMeter=events.appendCuttingRuntimeEvent({eventType:'配料完成通知',eventSource:'WEB',eventStatus:'已同步',occurredAt:'2026-09-07 15:00:00',operatorName:'单位专项',operatorRole:'配料小组',refs:{productionOrderId:one.productionOrderId},material:{materialSku:'METER-ONLY',materialName:'米制物料',materialColor:'白',unit:'米'},payload:{preparedQty:3}},storage)
assert.equal(events.listCuttingRuntimeEventsByType('配料完成通知',storage).find((e:any)=>e.eventId===oneMeter.eventId).material.unit,'米','事件序列化重读不得把3米写成3yard')
console.log('配料拣货/暂存/确认沿用原事件；Yard/米持久化保真通过')
