import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { createFinishedInventoryBaseSeed, FINISHED_INVENTORY_LOCATIONS, FINISHED_INVENTORY_NORMAL_WAREHOUSE } from '../src/data/wls/finished-inventory-quality-seed.ts'
import { captureFinishedInventoryState, restoreFinishedInventoryState } from '../src/data/wls/finished-inventory-records.ts'
import * as stock from '../src/data/wls/finished-inventory-quality.ts'
import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'
import { projectPostFinishingStaticRecords } from '../src/data/fcs/post-finishing-records.ts'
import { listPostFinishingOperationLogs } from '../src/data/fcs/post-finishing-operation-log.ts'
import { ensureQualityManagementRecords } from '../src/data/fcs/quality-management-records.ts'

// Offline authoring only. The product reads the resulting static records and
// never runs this script or writes a batch of samples when a page opens.
const version = '2026-10-24-inventory-quality-mock-v2'
const styleCodes = ['001','002','003','004','005','006','010','011'].map(code => `STYLE-PRJ-202603-${code}`)
const catalogue = listSkuArchives()
const seed = createFinishedInventoryBaseSeed()
seed.applications = []; seed.transfers = []; seed.movements = []; seed.differences = []; seed.scopes = []
seed.lots = seed.lots.filter(lot => !lot.sourceRef.includes('inventory-quality-mock'))
const baseLots = new Map(seed.lots.map(lot => [lot.id,JSON.stringify(lot)]))
const styles = styleCodes.map(code => {
  const skus = catalogue.filter(sku => sku.styleCode === code && sku.skuImageUrl.startsWith('/materials/pcs-reviewed/')).slice(0,2)
  if (skus.length !== 2) throw new Error(`${code}缺少两条正式SKU与对应图片`)
  for (const sku of skus) for (const [bin,location] of FINISHED_INVENTORY_LOCATIONS.filter(row=>row.warehouseId===FINISHED_INVENTORY_NORMAL_WAREHOUSE.id).slice(0,2).entries()) seed.lots.push({
    id:`FI-MOCK-LOT-${sku.skuId}-${bin}`,warehouseId:FINISHED_INVENTORY_NORMAL_WAREHOUSE.id,warehouseName:FINISHED_INVENTORY_NORMAL_WAREHOUSE.name,
    styleId:sku.styleId,styleNo:sku.styleCode,styleName:sku.styleName,skuId:sku.skuId,skuCode:sku.skuCode,colorName:sku.colorName,sizeName:sku.sizeName,imageUrl:sku.skuImageUrl,barcode:sku.barcode,
    zoneName:location.zoneName,locationCode:location.locationCode,quality:'正常',putaway:true,quantity:25,updatedAt:'2026-10-17T08:00:00+07:00',sourceRef:`STATIC:${version}`,identityVerified:true,
  })
  return skus[0].styleId
})
restoreFinishedInventoryState(seed)
await ensureQualityManagementRecords()
flow.resetPostFinishingFullFlow()
stock.registerFinishedInventoryQcBridge({receiveIntoQc:flow.createInventoryPostFinishingQcTask})
flow.registerPostFinishingInventoryQcCompletion(stock.completeFinishedInventoryQc)
flow.registerPostFinishingInventoryPostBridge({progress:stock.updateFinishedInventoryPostProgress,shipped:stock.finishedInventoryPostShippedQuantities})
const warehouse={actorId:'WEB-ADMIN',actorName:'管理员',roleName:'仓库收货人员'}, qcActor=flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcB, postActor=flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator
let sequence=0, clock=0
let uuid=0, interval=5*60*1000
const RealDate=Date
globalThis.Date=new Proxy(RealDate,{construct:(target,args)=>Reflect.construct(target,args.length?args:[clock]),get:(target,key)=>key==='now'?()=>clock:Reflect.get(target,key)})
Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`})
const cases:Array<{id:string;applicationNo:string;stage:string;styleNo:string;outboundQty:number}> = []
const iso=()=>new Date(clock).toISOString(), tick=()=>{clock+=interval;return clock}
function receive(application:any, short=0){tick();return stock.receiveFinishedInventoryQualityApplication({applicationId:application.id,actor:postActor,at:iso(),quantities:application.lines.map((line:any,index:number)=>({skuId:line.skuId,quantity:line.outboundQty-(index===0?short:0)}))})}
function inspect(application:any,processItems:string[],reject=false,blackFirst=false){
  let qc=flow.claimPostFinishingQcTask({qcTaskNo:application.qcTaskNo,actor:qcActor,nowMs:tick()})
  let remaining=flow.getPostFinishingQcInspectionSummary(qc.qcTaskId)!.remainingQty
  const lines=blackFirst?[...qc.lines].sort((a,b)=>Number(b.sku.skuCode==='SKU-GC-20001')-Number(a.sku.skuCode==='SKU-GC-20001')):qc.lines
  flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:qcActor,operationId:`MOCK-ROUND:${application.id}:1`,nowMs:tick(),lines:lines.map((line,index)=>{
    const quantity=Math.min(remaining,line.expectedQty);remaining-=quantity
    return {skuId:line.sku.skuId,passedQty:quantity-(reject&&index===0?4:0),defectQty:reject&&index===0?2:0,returnQty:reject&&index===0?2:0,issues:reject&&index===0?[{itemId:'garment-clean',note:'演示检查结果：2件瑕疵、2件返工；商品识别图不作为缺陷凭证'}]:[]}
  })})
  if(flow.getPostFinishingQcInspectionSummary(qc.qcTaskId)!.pendingAudit){
    flow.upgradePostFinishingQcInspection({qcTaskId:qc.qcTaskId,actor:qcActor,nextPercent:100,note:'本轮发现不合格，稽查决定对剩余实收全部检查',nowMs:tick()})
    const summary=flow.getPostFinishingQcInspectionSummary(qc.qcTaskId)!
    flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor:qcActor,operationId:`MOCK-ROUND:${application.id}:2`,nowMs:tick(),lines:summary.lines.map(line=>({skuId:line.skuId,passedQty:line.uninspectedQty,defectQty:0,returnQty:0}))})
  }
  return flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor:qcActor,processItems,nowMs:tick()})
}
function completeProcessing(application:any,firstOnly=false){
  const task=flow.getPostFinishingFullFlowPostTask(stock.getFinishedInventoryApplication(application.id)!.postTaskId!)!
  for(const processItem of firstOnly?task.processItems.slice(0,1):task.processItems)flow.appendPostFinishingProcessCompletion({postTaskId:task.postTaskId,actor:postActor,responsible:postActor,processItem,operationId:`MOCK-PROCESS:${task.postTaskId}:${processItem}`,nowMs:tick(),quantities:task.lines.map(line=>({skuId:line.sku.skuId,quantity:line.expectedQty}))})
}
function transfer(application:any,stage:'ship'|'receive'|'putaway',skipRework=false){
  for(let row of stock.listFinishedInventoryTransfers(application.id).filter(row=>row.category!=='送后道')){
    if(!row.shippedAt){tick();row=stock.shipFinishedInventoryTransfer({transferId:row.id,actor:postActor,at:iso()})}
    if(stage==='ship'||skipRework&&row.category==='返工交接')continue
    if(!row.receivedAt){tick();row=stock.receiveFinishedInventoryTransfer({transferId:row.id,targetId:row.targetId,actor:warehouse,at:iso(),quantities:row.lines.map(line=>({skuId:line.skuId,quantity:line.quantity}))})}
    if(stage==='putaway'&&row.category!=='返工交接'&&!row.putawayAt){tick();stock.putawayFinishedInventoryTransfer({transferId:row.id,actor:warehouse,at:iso(),locations:row.lines.map(line=>({skuId:line.skuId,locationCode:FINISHED_INVENTORY_LOCATIONS.find(location=>location.warehouseId===row.targetId)!.locationCode}))})}
  }
}
function create(styleIndex:number,stage:string,day:number){
  clock=Date.UTC(2026,9,day,1,sequence*90)
  const preview=stock.previewFinishedInventoryQuality(FINISHED_INVENTORY_NORMAL_WAREHOUSE.id,styles[styleIndex])
  const app=stock.createFinishedInventoryQualityApplication({preview,operationId:`MOCK-INVQC-20261024-${String(++sequence).padStart(5,'0')}`,actor:warehouse,at:iso()})
  cases.push({id:app.id,applicationNo:app.applicationNo,stage,styleNo:app.styleNo,outboundQty:preview.eligibleQty})
  return app
}
// Earlier completed cycles supply the next real warehouse issue of the same
// style. No extra replenishment or duplicate on-hand stock is invented.
for(let index=0;index<3;index++){
  let app=create(index,index===1?'已完成（加工返仓）':index===2?'已完成（实收差异已核实）':'已完成（三类交接）',22)
  app=receive(app,index===2?1:0);inspect(app,index===1?['熨烫','包装']:[],index!==1)
  if(index===1)completeProcessing(app)
  transfer(app,'putaway')
  for(const difference of stock.listFinishedInventoryDifferences(app.id)){tick();stock.resolveFinishedInventoryDifference({differenceId:difference.id,actor:warehouse,reason:'交接复核确认少1件',disposition:'按实际实收质检，短少1件确认损耗，不改原出库数',at:iso()})}
}
for(let index=0;index<8;index++){
  const stage=['待后道实收','待质检（短收1件）','待质检','待后道加工（熨烫已完成）','待分类交出（无需加工）','待返仓接收','待返仓上架','待goto_global返工接收'][index]
  let app=create(index,stage,23)
  if(index===0)continue
  app=receive(app,index===1?1:0)
  if(index<=2)continue
  inspect(app,index===3?['熨烫','包装']:[],true)
  if(index===3){completeProcessing(app,true);continue}
  if(index===4)continue
  transfer(app,index===5?'ship':index===6?'receive':'putaway',index===7)
}
// Rebuild the two public-site walkthroughs as one chronological warehouse
// history. The second batch consumes the first return: 80 -> 76 -> 72 normal.
// Keep the visible original numbers; new Mock identities distinguish these
// reproducible examples from records authored in an independent browser.
interval=5000
for(const [operationId,stage,at,processItems] of [
  ['MOCK-ONLINE-NOPROCESS-b3d3cc91-7167-447d-82ef-01222e43126b','已完成（线上完整流程·不加工）','2026-10-24T08:48:25.678Z',[]],
  ['MOCK-ONLINE-PROCESS-5d69f7be-03ee-4d2a-9559-432db1fa26c7','已完成（线上完整流程·熨烫包装）','2026-10-24T08:55:44.708Z',['熨烫','包装']],
] as const){
  clock=Date.parse(at)
  const preview=stock.previewFinishedInventoryQuality(FINISHED_INVENTORY_NORMAL_WAREHOUSE.id,'style_r1_wms_tee')
  let app=stock.createFinishedInventoryQualityApplication({preview,operationId,actor:warehouse,at:iso()})
  cases.push({id:app.id,applicationNo:app.applicationNo,stage,styleNo:app.styleNo,outboundQty:preview.eligibleQty})
  app=receive(app);inspect(app,[...processItems],true,true)
  if(processItems.length)completeProcessing(app)
  transfer(app,'ship');transfer(app,'receive',true);transfer(app,'putaway',true);transfer(app,'putaway')
}
const inventory=captureFinishedInventoryState()
inventory.lots=inventory.lots.filter(lot=>baseLots.get(lot.id)!==JSON.stringify(lot))
inventory.exclusions=[]
const ids=new Set(inventory.applications.map(row=>row.id))
const rows=projectPostFinishingStaticRecords('flow',row=>row)
const post={qcTasks:rows.filter(row=>row.collection==='flow/qcTasks'&&ids.has((row.value as any).inventoryApplicationId)).map(row=>row.value),postTasks:rows.filter(row=>row.collection==='flow/postTasks'&&ids.has((row.value as any).inventoryApplicationId)).map(row=>row.value),processCompletions:[] as unknown[],logs:[] as unknown[]}
const postIds=new Set(post.postTasks.map((task:any)=>task.postTaskId)),qcIds=new Set(post.qcTasks.map((task:any)=>task.qcTaskId))
post.processCompletions=rows.filter(row=>row.collection==='flow/processCompletions'&&postIds.has((row.value as any).postTaskId)).map(row=>row.value)
const priorApplicationIds=new Set(cases.slice(0,11).map(row=>row.id))
const priorObjectIds=new Set([...post.qcTasks.filter((row:any)=>priorApplicationIds.has(row.inventoryApplicationId)).map((row:any)=>row.qcTaskId),...post.postTasks.filter((row:any)=>priorApplicationIds.has(row.inventoryApplicationId)).map((row:any)=>row.postTaskId)])
let priorLog=0,onlineLog=0
post.logs=listPostFinishingOperationLogs().filter(row=>qcIds.has(row.objectId)||postIds.has(row.objectId)).map(row=>({...row,logId:priorObjectIds.has(row.objectId)?`PF-INVENTORY-MOCK-LOG-${String(++priorLog).padStart(3,'0')}`:`PF-INVENTORY-ONLINE-LOG-${String(++onlineLog).padStart(3,'0')}`}))
const target=new URL('../src/data/wls/finished-inventory-quality-mock.json',import.meta.url)
const output=JSON.stringify({version,cases,inventory,post},null,2)+'\n'
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),output,'固定Mock必须能由原业务命令完整重建')
else writeFileSync(target,output)
console.log(JSON.stringify({applications:cases.length,qc:post.qcTasks.length,processing:post.postTasks.length,cases},null,2))
