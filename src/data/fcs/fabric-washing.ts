import { getPrintWorkOrderById, getPrintingWorkOrderById, listPrintingWorkOrders, capturePrintProcessMutationState, markPrintingWashingTransfer, isInitializingPrintingDemos } from './printing-task-domain.ts'
import { listFactoryMasterRecords } from './factory-master-store.ts'
import { productionOrders } from './production-orders.ts'
import { registerFabricWashingRelease, registerWashingOutputStock } from './fabric-washing-gates.ts'
import { readWashingState, registerWashingProjection, executeWashingCommand, ensureWashingRecords, adoptWashingLedgerRows, washingLedgerSnapshot, guardWashingLedger } from './fabric-washing-repository.ts'
import { assertWashingSource, washingRollRelease, washingInitiationRolls, WASHING_FACTORY_ID, WASHING_FACTORY_NAME, type WashingSource, type WashingActor, type WashingCommand, type WashingOrder } from './fabric-washing-model.ts'
import { FACTORY_RECEIVING_KEY, registerFactoryReceivingSource, assertReceiptPosition, prepareFactoryReceipt, savePreparedFactoryReceipt, listFactoryReceipts, recordWashingMaterialUsage } from './factory-receiving.ts'
import type { FactoryReceivingSource } from './factory-receiving-types.ts'
const PRINT_KEY='higoods.formal-print-execution.v1'
export const WASHING_ROUTE='/fcs/craft/dyeing/washing/work-orders'
export function listWashingFactories() {
 return listFactoryMasterRecords().filter(f=>f.id===WASHING_FACTORY_ID&&f.status==='active'&&f.eligibility?.allowExecute!==false&&f.processAbilities.some(a=>['DYE','WASH'].includes(a.processCode)&&a.status!=='DISABLED'&&a.status!=='PAUSED'&&a.canReceiveTask!==false)).map(f=>({...f,name:WASHING_FACTORY_NAME}))
}
export function getWashingSources(printOrderId: string): WashingSource[] {
 const raw=getPrintWorkOrderById(printOrderId),view=getPrintingWorkOrderById(printOrderId)
 if(!raw||!view||view.output.objectType!=='面料')return []
 return buildWashingSources(raw,view)
}
export function canInitiateFabricWashing(printOrderId: string): boolean {
 const state=readWashingState()
 return getWashingSources(printOrderId).some(source=>washingInitiationRolls(state,source).length>0)
}
/** Reuse the synchronized list snapshot; row rendering must not resync the printing domain per row. */
export function washingInitiationOrderIds(views:ReturnType<typeof listPrintingWorkOrders>):Set<string> {
 const raws=new Map(capturePrintProcessMutationState().workOrders),state=readWashingState()
 return new Set(views.filter(view=>{
  const raw=raws.get(view.workOrderId)
  return raw&&view.output.objectType==='面料'&&buildWashingSources(raw,view).some(source=>washingInitiationRolls(state,source).length>0)
 }).map(view=>view.workOrderId))
}
function buildWashingSources(raw:NonNullable<ReturnType<typeof getPrintWorkOrderById>>,view:NonNullable<ReturnType<typeof getPrintingWorkOrderById>>):WashingSource[]{
 const printOrderId=raw.printOrderId
 const production=productionOrders.find(p=>p.productionOrderId===(raw.sourceSnapshot?.productionOrderId||raw.sourceProductionOrderId))
 const blockedReason=raw.status==='CANCELLED'||production&&['CANCELLED','ON_HOLD'].includes(production.status)?'原生产或印花单已暂停或取消，请核对后再处理。':''
 const batches=view.productionBatches?.length?view.productionBatches:[]
 return batches.map(batch=>{
  const rolls=view.barcodes.filter(r=>r.batchId===batch.id)
  const needsTransfer=/热转印|转印/.test(batch.requirement.type+' '+batch.requirement.craftName)
  const finalStage=needsTransfer?'TRANSFER':'PRINT'
  const finished=(view.productionActions??[]).filter(a=>a.stage===finalStage&&a.action==='FINISH'&&a.requirementVersion===batch.requirementVersion).reduce((n,a)=>Math.max(n,a.qty??0),0)
  const revision=JSON.stringify([batch.id,batch.requirementVersion,view.requirementVersion,view.output.sku,view.output.qtyUnit,rolls.map(r=>[r.id,r.barcode,r.sku,r.lengthY,r.quantityConfirmed])])
  const targetId=view.receivingTargetId
  const target=targetId?{id:targetId,name:view.receivingTargetName||view.receivingTargetWarehouseName,...(raw.receiverKind==='FACTORY'?{factoryId:targetId}:{warehouseId:targetId})}:undefined
  return {objectType:'FABRIC',id:printOrderId+'/'+batch.id,printOrderId,printOrderNo:view.printOrderNo,batchId:batch.id,
   sourceType:view.demandSource.type,sourceNo:view.demandSource.sourceNo,rootSource:structuredClone(raw.sourceSnapshot??{sourceType:raw.sourceType}),
   productionOrderId:raw.sourceSnapshot?.productionOrderId||raw.sourceProductionOrderId,productionDemandId:view.productionDemandId||undefined,techPackVersionId:raw.sourceSnapshot?.techPackVersionId||production?.techPackSnapshot?.sourceTechPackVersionId,
   factoryId:raw.printFactoryId,factoryName:raw.printFactoryName,materialSku:view.output.sku,materialName:view.output.materialName,imageUrl:view.output.imageUrl,
   product:structuredClone(view.product),materialProperties:{composition:view.output.composition||'',gsm:view.output.gsm,widthCm:view.output.widthCm},taskNo:view.taskNo,salesType:view.salesType,creationMethod:view.creationMethod,
   actualCompleted:batch.qty>0&&finished>=batch.qty&&rolls.length>0&&rolls.reduce((sum,r)=>sum+r.lengthY,0)<=batch.qty+0.000001,blockedReason,revision,target,
   rolls:rolls.map(r=>({id:r.id,barcode:r.barcode,qty:r.lengthY,unit:view.output.qtyUnit,confirmed:r.quantityConfirmed===true&&r.sku===view.output.sku,handedOut:['已交出','已入库'].includes(r.status),blockedReason:(view.dispatchDocuments??[]).some(doc=>doc.status==='草稿'&&doc.lines.some(line=>line.workOrderId===printOrderId&&line.barcodeIds.includes(r.id)))?'本卷已加入印花交出草稿，请先解除或更正草稿。':undefined,revision:JSON.stringify([batch.id,batch.requirementVersion,view.requirementVersion,view.output.sku,view.output.qtyUnit,r.id,r.barcode,r.lengthY,r.quantityConfirmed])})),demo:printOrderId.includes('DEMO') } satisfies WashingSource
 })
}
export function listWashingCandidates() {
 const views=listPrintingWorkOrders().filter(order=>order.output.objectType==='面料'),raws=new Map(capturePrintProcessMutationState().workOrders)
 return views.map(order=>({order,sources:raws.has(order.workOrderId)?buildWashingSources(raws.get(order.workOrderId)!,order):[]}))
}
function adoptPrint(printOrderId:string) {
 const raw=getPrintWorkOrderById(printOrderId);if(!raw)throw new Error('来源印花单不存在。')
 adoptWashingLedgerRows(PRINT_KEY,washingLedgerSnapshot(PRINT_KEY),row=>row.key===printOrderId||(row.value as any)?.taskId===raw.taskId||(row.value as any)?.orderId===printOrderId)
 guardWashingLedger(PRINT_KEY,'state.workOrders',printOrderId)
 // Preserve necessary received input and mixed receipt documents, without moving unrelated modules.
 const sourceIds=new Set(listFactoryReceipts().flatMap(r=>r.lines.filter(l=>l.printingOrderId===printOrderId).map(l=>l.sourceId)))
 adoptWashingLedgerRows(FACTORY_RECEIVING_KEY,washingLedgerSnapshot(FACTORY_RECEIVING_KEY),row=>sourceIds.has(row.key)||(row.value as any)?.lines?.some((l:any)=>l.printingOrderId===printOrderId||sourceIds.has(l.sourceId))||(row.value as any)?.printingOrderId===printOrderId)
}
function material(order:WashingOrder) {return {sku:order.source.materialSku,name:order.source.materialName,kind:'FABRIC' as const,imageUrl:order.source.imageUrl,color:'按原面料',composition:'见原面料档案',specification:getPrintingWorkOrderById(order.source.printOrderId)?.output.widthCm+' cm',batchNo:order.source.batchId}}
function transferSource(order:WashingOrder, command: Extract<WashingCommand,{type:'SEND'|'HANDOUT'}>, actor:WashingActor, operationId:string):FactoryReceivingSource {
 const outbound=command.type==='HANDOUT',selected=order.rolls.filter(r=>command.rollIds.includes(r.id)),target=outbound?order.source.target:{id:order.assignedFactoryId!,name:order.assignedFactoryName!,factoryId:order.assignedFactoryId!}
 if(!target)throw new Error('原来源最终接收方尚未核对。')
 const id='WASH-TRANSFER-'+operationId,at=new Date().toISOString()
 return {id,documentNo:'JS-'+order.no+'-'+(readWashingState().actions.filter(a=>a.orderId===order.id&&(a.action==='SEND'||a.action==='HANDOUT')).length),type:'HANDOUT',processCode:'WASH',origin:{kind:'FACTORY',id:outbound?order.assignedFactoryId!:order.source.factoryId,name:outbound?order.assignedFactoryName!:order.source.factoryName,factoryType:outbound?'染厂':'印花厂'},
  targetFactoryId:target.factoryId||target.id,targetFactoryName:target.name,createdAt:at,createdBy:actor.name,handedOutAt:at,workOrderNo:order.no,originalRecordId:id,
  lines:[{id:id+'-L1',material:material(order),plannedQty:selected.reduce((n,r)=>n+(outbound?r.outputQty!:r.inputQty),0),sentQty:selected.reduce((n,r)=>n+(outbound?r.outputQty!:r.inputQty),0),unit:selected[0].unit,
   rolls:selected.map(r=>({barcode:outbound?r.outputBarcode||r.barcode:r.barcode,yard:outbound?r.outputQty!:r.inputQty,qty:outbound?r.outputQty!:r.inputQty,unit:r.unit,originRollId:r.sourceRollId})),label:order.no,washingOrderId:order.id,washingDirection:outbound?'AFTER_WASH':'TO_WASH',originPrintOrderId:order.source.printOrderId,productionOrderNo:order.source.productionOrderId}]}
}
export async function submitWashingCommand(command:WashingCommand,actor:WashingActor,operationId:string) {
 await ensureWashingRecords()
 if(command.type==='LINK'){
  const current=getWashingSources(command.printOrderId)[0]
  if(!current||current.productionOrderId!==command.productionOrderId||(current.rootSource as any)?.matchStatus!=='MATCHED')throw new Error('须先由原提前加工完成正式匹配，不能手工补造生产来源。')
  command={...command,target:current.target}
 }
 if(command.type==='RESOLVE_EXCEPTION'){
  const id=command.orderId,order=readWashingState().orders.find(o=>o.id===id)
  const current=order&&getWashingSources(order.source.printOrderId).find(s=>s.id===order.source.id)
  if(!current)throw new Error('未找到原印花实物，须先核对来源后恢复。')
  command={...command,verifiedSource:current}
 }
 if(command.type==='ASSIGN'&&!listWashingFactories().some(f=>f.id===command.factory.id))throw new Error('承接厂未启用或不具备染厂加工能力。')
 if(command.type==='JUDGE'&&command.decision==='WASH'&&!listWashingFactories().length)throw new Error('GTG 当前未启用或不能接单，洗水单未保存。请核对 GTG 工厂档案后重试。')
 const refreshed=command.type==='JUDGE'?getWashingSources(command.source.printOrderId).find(source=>source.id===command.source.id):undefined
 if(command.type==='JUDGE'&&(!refreshed||refreshed.revision!==command.source.revision))throw new Error('上游面料已变化，请重新读取并实际核对。')
 if(refreshed)assertWashingSource(refreshed)
 const usesProcessLedgers=['JUDGE','SEND','RECEIVE','START','HANDOUT','DOWNSTREAM_RECEIVE'].includes(command.type)
 return executeWashingCommand(command.type==='JUDGE'?{...command,source:refreshed!}:command,actor,operationId,()=>{
  const order='orderId'in command?readWashingState().orders.find(o=>o.id===command.orderId):undefined
  if(command.type==='JUDGE')adoptPrint(command.source.printOrderId)
  if(order&&usesProcessLedgers){
   adoptPrint(order.source.printOrderId)
   if(command.type==='SEND'||command.type==='HANDOUT'){
    const source=transferSource(order,command,actor,operationId);if(command.type==='SEND'||order.source.target?.factoryId)registerFactoryReceivingSource(source)
    if(command.type==='SEND')markPrintingWashingTransfer(order.source.printOrderId,command.rollIds,source.id,actor.name,source.createdAt)
   }
   if(command.type==='RECEIVE'||command.type==='DOWNSTREAM_RECEIVE'){
    const outbound=command.type==='DOWNSTREAM_RECEIVE'
    if(outbound&&order.source.target?.warehouseId)return
    const {listFactoryReceivingSources}=receiving
    const sources=listFactoryReceivingSources().filter(s=>s.lines.some(l=>l.washingOrderId===order.id&&l.washingDirection===(outbound?'AFTER_WASH':'TO_WASH')))
    const bySource=new Map<string,typeof command.lines>()
    for(const line of command.lines){const roll=order.rolls.find(r=>r.id===line.rollId)!,barcode=outbound?roll.outputBarcode||roll.barcode:roll.barcode
     const source=sources.find(s=>s.lines.some(l=>l.rolls.some(r=>r.barcode===barcode)));if(!source)throw new Error('未找到本卷真实交出来源。')
     bySource.set(source.id,[...(bySource.get(source.id)||[]),line])
    }
    const factoryId=outbound?(order.source.target?.factoryId||order.source.target?.id)!:order.assignedFactoryId!
    const position={warehouseId:command.warehouseId!,locationId:command.locationId!}
    assertReceiptPosition(factoryId,position)
    const input={id:'WASH-RECEIPT-'+operationId,factoryId,operatorName:actor.name,operatorId:actor.id,receivedAt:new Date().toISOString(),remark:outbound?'洗水后逐卷实收':'洗水染厂逐卷实收',lines:[...bySource].map(([sourceId,lines])=>{
     const source=sources.find(s=>s.id===sourceId)!,sourceLine=source.lines[0],unit=order.rolls[0].unit
     return {sourceId,sourceLineId:sourceLine.id,...position,businessQty:lines.reduce((n,l)=>n+l.qty,0),businessUnit:unit,rolls:lines.map(line=>{const roll=order.rolls.find(r=>r.id===line.rollId)!;return{...position,barcode:outbound?roll.outputBarcode||roll.barcode:roll.barcode,yard:line.qty,qty:line.qty,unit}})}
    })}
    savePreparedFactoryReceipt(prepareFactoryReceipt(input))
    if(!outbound)markPrintingWashingTransfer(order.source.printOrderId,command.lines.map(l=>l.rollId),'WASH-RECEIPT-'+operationId,actor.name,input.receivedAt,command.lines.reduce((n,l)=>n+l.qty,0))
   }
   if(command.type==='START'){
    for(const roll of order.rolls.filter(r=>command.rollIds.includes(r.id))){const location=receiving.getFactoryReceiptLocations(order.assignedFactoryId!).find(p=>p.warehouse.warehouseId===roll.warehouseId&&p.location.locationId===roll.locationId);if(!location||['异常区','待确认区'].includes(location.area.areaName))throw new Error('本卷所在库位不可用于洗水投入，请负责人先核对实物。')}
    recordWashingMaterialUsage({id:'WASH-USE-'+operationId,washingOrderId:order.id,factoryId:order.assignedFactoryId!,operatorName:actor.name,at:new Date().toISOString(),barcodes:order.rolls.filter(r=>command.rollIds.includes(r.id)).map(r=>r.barcode)})
   }
  }
 },()=>{
  if(command.type==='JUDGE'){const current=getWashingSources(command.source.printOrderId).find(s=>s.id===command.source.id);if(!current||current.revision!==command.source.revision||command.rollIds.some(id=>current.rolls.find(r=>r.id===id)?.handedOut))throw new Error('原面料已变化或已经交出，请重新读取后核对。');assertWashingSource(current)}
  if(['SEND','RECEIVE','START','OUTPUT','HANDOUT','DOWNSTREAM_RECEIVE','COMPLETE'].includes(command.type)&&'orderId'in command){
   const state=readWashingState(),order=state.orders.find(o=>o.id===command.orderId)
   const current=order&&getWashingSources(order.source.printOrderId).find(s=>s.id===order.source.id)
   if(!order||!current)throw new Error('来源面料已变化，请登记异常并由负责人核对。')
   assertWashingSource(current)
   if(order.rolls.some(roll=>{const r=current.rolls.find(r=>r.id===roll.sourceRollId),j=state.judgments.find(j=>j.orderId===order.id&&j.rollId===roll.sourceRollId);return !r||j?.sourceRevision!==(r.revision??current.revision)}))throw new Error('来源面料要求或卷版本已变化，请登记异常并由负责人重新核对后恢复。')
  }
 },usesProcessLedgers)
}
import * as receiving from './factory-receiving.ts'
registerFabricWashingRelease((printOrderId,rollId,mode)=>{
 if(isInitializingPrintingDemos())return ''
 const order=getPrintingWorkOrderById(printOrderId);if(!order)return '未找到来源印花单，请核对实物。';if(order.output.objectType!=='面料')return ''
 const roll=order.barcodes.find(r=>r.id===rollId||r.barcode===rollId);if(!roll)return '原印花卷不存在，请重新核对。'
 const state=readWashingState(),judgment=state.judgments.find(j=>j.printOrderId===printOrderId&&j.rollId===roll.id)
 // Existing delivered facts have no new judgment; do not retroactively invent or block them.
 if(!judgment&&['已交出','已入库'].includes(roll.status))return ''
 const source=getWashingSources(printOrderId).find(s=>s.rolls.some(r=>r.id===roll.id))
 const reason=washingRollRelease(state,printOrderId,roll.id,source?.rolls.find(r=>r.id===roll.id)?.revision??source?.revision)
 if(!reason&&mode==='HANDOUT'&&judgment?.decision==='WASH')return '本卷已经交给洗水，请从洗水加工单交回，不能再次作为印花产出发出。'
 return reason
})

/** Real central-warehouse stock and pending handovers share the same persisted roll facts. */
export function washingWarehouseStock() {
 return readWashingState().orders.filter(order=>order.source.target?.warehouseId).flatMap(order=>order.rolls.filter(roll=>roll.downstreamReceivedAt).map(roll=>({
  id:order.id+'/'+roll.id,orderId:order.id,orderNo:order.no,source:order.source,barcode:roll.outputBarcode||roll.barcode,qty:roll.downstreamQty!,unit:roll.unit,
  warehouseId:roll.downstreamWarehouseId!,locationId:roll.downstreamLocationId!,at:roll.downstreamReceivedAt!,blocked:!!order.exception,
 })))
}

// Matching remains owned by the existing production-source transaction. The view joins its
// actual committed source, so no second writable match fact or duplicate washing order exists.
registerWashingProjection(state=>{
 const sources=new Map<string,WashingSource[]>()
 for(const order of state.orders){
  if(order.source.sourceType!=='PRODUCTION_DEMAND'&&order.source.target)continue
  if(!sources.has(order.source.printOrderId))sources.set(order.source.printOrderId,getWashingSources(order.source.printOrderId))
  const current=sources.get(order.source.printOrderId)!.find(source=>source.id===order.source.id)
  if(!current)continue
  const root=current.rootSource as {matchStatus?:string}|undefined
  if(root?.matchStatus==='MATCHED'&&current.productionOrderId){
   order.source.productionOrderId=current.productionOrderId
   order.source.techPackVersionId=current.techPackVersionId
   if(!order.rolls.some(roll=>roll.handedOutAt)&&current.target)order.source.target=current.target
  }else if(!order.source.target&&current.target)order.source.target=current.target
 }
 return state
})

import { listFactoryInternalWarehouses } from './factory-internal-warehouse-locations.ts'
registerWashingOutputStock(()=>readWashingState().orders.filter(order=>!order.cancelledAt&&order.assignedFactoryId).flatMap(order=>order.rolls.filter(roll=>roll.completedAt).map(roll=>{
 const warehouse=listFactoryInternalWarehouses(order.assignedFactoryId!).find(w=>w.warehouseKind==='WAIT_HANDOVER')
 return {stockItemId:'WASH-OUTPUT-'+order.id+'-'+roll.id,washingOrderId:order.id,warehouseId:warehouse?.warehouseId||'',warehouseName:warehouse?.warehouseName||'待交出仓',factoryId:order.assignedFactoryId!,factoryName:order.assignedFactoryName!,factoryKind:warehouse?.factoryKind||'CENTRAL_DYE' as const,
  processCode:'PROC_WASH',processName:'洗水',craftCode:'WASH',craftName:'洗水',itemKind:'面料' as const,itemName:order.source.materialName,materialSku:order.source.materialSku,fabricRollNo:roll.outputBarcode||roll.barcode,unit:roll.unit,
  areaName:'洗水实物产出',shelfNo:'按卷保管',locationNo:roll.locationId||'',locationText:'源卷 '+roll.barcode,photoList:[order.source.imageUrl],completedQty:roll.outputQty!,lossQty:0,waitHandoverQty:roll.handedOutAt||order.exception?0:roll.outputQty!,inTransitQty:roll.handedOutAt&&!roll.downstreamReceivedAt?roll.outputQty!:0,
  receiverKind:order.source.target?.factoryId?'加工任务' as const:'中转仓' as const,receiverName:order.source.target?.name||'待核对',sourceType:(order.source.rootSource as any)?.sourceType,productionOrderId:order.source.productionOrderId,productionOrderNo:order.source.productionOrderId,taskNo:order.no,
  abnormalReason:order.exception,status:order.exception?'异议中' as const:roll.downstreamReceivedAt?'已回写' as const:roll.handedOutAt?'已交出' as const:'待交出' as const,remark:'洗水数量变化 '+(roll.receivedQty!-roll.outputQty!)+' '+roll.unit+'；原卷 '+roll.barcode,
 }
})))
