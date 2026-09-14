import {localDateTimeText} from '../../utils.ts'
import {listWaterSolubleWorkOrders, getWaterSolubleWorkOrderById, mutateWaterSolubleOutput, type WaterSolubleWorkOrder} from './water-soluble-task-domain.ts'
import type {ProcessOutputRoll, ProcessDispatchDocument} from './process-output-types.ts'
import {getWaterSolubleOrderImageManifest} from './process-order-image-manifest.ts'
import {productionOrders} from './production-orders.ts'
import {resolveTerminalProcessOrderReceivingTarget} from './process-order-receiving-target.ts'
import {capturePdaHandoverState,restorePdaHandoverState,ensureHandoverOrderForStartedTask,createFactoryHandoverRecord,listHandoverOrdersByTaskId,getPdaHandoverRecordsByHead} from './pda-handover-events.ts'
import {getPdaSession} from './store-domain-pda.ts'
import {validateWaterSolublePdaActor} from './water-soluble-pda-actor.ts'
import type {OutputWorkOrderRow} from './process-output-view.ts'

const qtyOf=(line:ProcessDispatchDocument['lines'][number])=>line.rolls.reduce((n,r)=>n+r.qty,0)
const required=(id:string)=>{const o=getWaterSolubleWorkOrderById(id);if(!o)throw new Error('水溶加工单不存在，请重新查询。');return o}
const storedDocs=(orders:WaterSolubleWorkOrder[])=>orders.flatMap(o=>o.dispatchDocuments??[])
const targetOf=(o:WaterSolubleWorkOrder)=>resolveTerminalProcessOrderReceivingTarget({sourceType:'PRODUCTION_ORDER',productionOrderNo:o.productionOrderNo})
const available=(o:WaterSolubleWorkOrder)=>Math.max(0,o.completedQty-(o.handoverQty??0))
function transaction<T>(action:(orders:WaterSolubleWorkOrder[])=>T):T{
 const pda=capturePdaHandoverState()
 try{return mutateWaterSolubleOutput(action)}catch(error){restorePdaHandoverState(pda);throw error}
}
export function getWaterOutputRolls(id:string):ProcessOutputRoll[]{return structuredClone(required(id).outputRolls??[])}
export function getWaterDispatchAvailableQty(id:string):number{return available(required(id))}
export function listWaterDispatchDocuments():ProcessDispatchDocument[]{
 const orders=listWaterSolubleWorkOrders(),docs=storedDocs(orders),linked=new Set(docs.flatMap(d=>d.lines.map(l=>l.handoverRecordId).filter(Boolean)))
 // 已有 PDA 交出只投影展示，不重复创建交出量；历史没有卷码时保留空卷及原数量。
 for(const o of orders)for(const head of listHandoverOrdersByTaskId(o.taskId))for(const r of getPdaHandoverRecordsByHead(head.handoverId)){
  const id=r.handoverRecordId||r.recordId
  if(linked.has(id)||r.handoverRecordStatus==='VOIDED')continue
  const t=targetOf(o)
  docs.push({id:r.handoverRecordNo||id,status:'已交出',createdAt:'',handedOverAt:r.factorySubmittedAt,operator:r.factorySubmittedBy||'历史未登记交出人',transport:{driver:'历史未登记',vehicle:'历史未登记',plate:'历史未登记',note:'历史通用交接记录；原记录未登记卷码'},scans:[],lines:[{orderId:o.waterOrderId,orderNo:o.waterOrderNo,taskNo:o.taskNo,factoryId:o.factoryId!,factoryName:o.factoryName!,receiver:head.receiverName||head.targetName,partner:{kind:head.receiverKind==='WAREHOUSE'?'WAREHOUSE':'FACTORY',id:head.receiverId||t.targetBusinessId,name:head.receiverName||t.targetName,warehouseAttribute:'原交接接收方',factoryType:'加工厂'} as ProcessDispatchDocument['lines'][number]['partner'],sku:o.materialCode,unit:o.qtyUnit,rolls:[],handoverRecordId:id,historicalQty:r.submittedQty??r.plannedQty??0}],historical:true})
 }
 return structuredClone(docs)
}
export function listWaterOutputRows():OutputWorkOrderRow[]{return listWaterSolubleWorkOrders().map(o=>{
 const p=productionOrders.find(p=>p.productionOrderId===o.productionOrderId),image=getWaterSolubleOrderImageManifest(o.handoverDemoSourceOrderId||o.waterOrderId),t=targetOf(o)
 const records=listHandoverOrdersByTaskId(o.taskId).flatMap(h=>getPdaHandoverRecordsByHead(h.handoverId))
 return {orderId:o.waterOrderId,factoryId:o.factoryId||'',factoryName:o.factoryName||'待分配',workOrderNo:o.waterOrderNo,taskNo:o.taskNo,productCode:p?.demandSnapshot.spuCode||o.productionOrderNo,productName:p?.demandSnapshot.spuName||'水溶花边配套款式',productImageUrl:image?.product||'',productionOrderNo:o.productionOrderNo,purchaseOrderNo:o.sourceDemandIds.join(' / ')||p?.demandId||'生产单直接创建',receiverName:t.targetName,downstreamPartner:{kind:'WAREHOUSE',id:t.targetBusinessId,name:t.targetName,warehouseAttribute:'裁床配套中转仓'},materialName:o.materialName,colorSku:o.materialCode,outputImageUrl:image?.material||'',composition:'100% 涤纶',width:'15 mm',weightGsm:0,materialSpec:'本白水溶花边 / 宽 15 mm',isYarn:false,rawMaterialQty:o.inputQty??0,completedQty:o.completedQty,qtyUnit:o.qtyUnit,orderedAt:o.createdAt,handoverRecords:records,blockedReason:!o.factoryId?'尚未分配加工厂':o.status!=='WAIT_HANDOVER'?'加工单当前尚不能交出':''}
})}
export function isWaterRollAvailable(id:string,roll:ProcessOutputRoll):boolean{
 const o=required(id),reserved=storedDocs(listWaterSolubleWorkOrders()).some(d=>d.status==='草稿'&&d.lines.some(l=>l.orderId===id&&l.rolls.some(r=>r.id===roll.id)))
 return o.status==='WAIT_HANDOVER'&&Boolean(o.factoryId)&&roll.qty>0&&Boolean(roll.printedAt)&&!roll.dispatchId&&!reserved&&roll.qty<=available(o)+.000001
}
export function saveWaterOutputRolls(id:string,inputs:Array<Partial<ProcessOutputRoll>>):ProcessOutputRoll[]{return transaction(orders=>{
 const o=orders.find(o=>o.waterOrderId===id);if(!o||!inputs.length)throw new Error('请先选择有效的水溶加工单并填写卷长。')
 const rolls=o.outputRolls??=[]
 for(const input of inputs){
  const old=input.id?rolls.find(r=>r.id===input.id):undefined
  if(input.id&&!old)throw new Error('卷码不存在。')
  if(old&&(old.dispatchId||storedDocs(orders).some(d=>d.status==='草稿'&&d.lines.some(l=>l.orderId===id&&l.rolls.some(r=>r.id===old.id)))))throw new Error('此卷已被交出单占用，不能修改。')
  const qty=Number(Number(input.qty).toFixed(2));if(!Number.isFinite(qty)||qty<=0)throw new Error('卷长至少为 0.01，最多保留两位小数。')
  const no=String(o.nextOutputRollNo??(rolls.length+1)).padStart(4,'0')
  const roll:ProcessOutputRoll=old??{id:`${id}-R${no}`,barcode:`${o.waterOrderNo}_${no}`,rollNo:no,qty:0,weightKg:0,widthCm:1.5,gsm:0,vatNo:'',remark:'',createdAt:localDateTimeText()}
  if(roll.qty!==qty){roll.printedAt=undefined;roll.printedBy=undefined}
  roll.qty=Number(qty.toFixed(2));roll.remark=input.remark?.trim()??roll.remark
  if(!old){rolls.push(roll);o.nextOutputRollNo=Number(no)+1}
 }
 if(rolls.filter(r=>!r.dispatchId).reduce((n,r)=>n+r.qty,0)>available(o)+.000001)throw new Error('待交卷合计不能超过实际完成后的剩余可交数量。')
 o.actionLogs.push({action:'维护产出卷码',detail:`${rolls.length} 卷`,at:localDateTimeText(),operatorName:'原型管理操作员'})
 return structuredClone(rolls)
})}
export function markWaterOutputRolls(id:string,ids:string[],operator:string):void{transaction(orders=>{const o=orders.find(o=>o.waterOrderId===id);const rolls=ids.map(id=>o?.outputRolls?.find(r=>r.id===id));if(!operator.trim()||!rolls.length||rolls.some(r=>!r||r.qty<=0))throw new Error('请维护有效卷长和打印人。');for(const r of rolls){r!.printedAt=localDateTimeText();r!.printedBy=operator}o!.actionLogs.push({action:'打印产出条码',detail:`${ids.length} 卷`,at:localDateTimeText(),operatorName:operator})})}
export function createWaterDispatchDocument(selections:{orderId:string;rollIds:string[]}[],operator:string,mergeId?:string):ProcessDispatchDocument{return transaction(orders=>{
 if(!operator.trim()||!selections.length)throw new Error('请选择实物卷并填写建单人。')
 if(new Set(selections.map(s=>s.orderId)).size!==selections.length)throw new Error('同一加工单不能重复选择。')
 const existing=mergeId?storedDocs(orders).find(d=>d.id===mergeId):undefined
 if(mergeId&&(!existing||existing.status!=='草稿'))throw new Error('只能合入尚未交出的单据。')
 const lines=selections.map(s=>{const o=orders.find(o=>o.waterOrderId===s.orderId);if(!o||o.status!=='WAIT_HANDOVER'||!o.factoryId)throw new Error('当前水溶加工单尚不能交出。');const rolls=s.rollIds.map(id=>o.outputRolls?.find(r=>r.id===id));if(!rolls.length||new Set(s.rollIds).size!==rolls.length||rolls.some(r=>!r||!isWaterRollAvailable(o.waterOrderId,r)))throw new Error('所选卷未打印、已占用或不可交出，请重新选择。');const reserved=storedDocs(orders).filter(d=>d.status==='草稿').flatMap(d=>d.lines).filter(l=>l.orderId===o.waterOrderId).reduce((n,l)=>n+qtyOf(l),0);if(rolls.reduce((n,r)=>n+r!.qty,0)+reserved>available(o)+.000001)throw new Error('所选卷加已占用数量超过可交数量。');const t=targetOf(o);return {orderId:o.waterOrderId,orderNo:o.waterOrderNo,taskNo:o.taskNo,factoryId:o.factoryId,factoryName:o.factoryName!,receiver:t.targetName,partner:{kind:'WAREHOUSE' as const,id:t.targetBusinessId,name:t.targetName,warehouseAttribute:'裁床配套中转仓'},sku:o.materialCode,unit:o.qtyUnit,rolls:structuredClone(rolls as ProcessOutputRoll[])}})
 if(new Set([...lines,...(existing?.lines??[])].map(l=>l.factoryId)).size!==1)throw new Error('不同加工厂请分别建单。')
 const at=localDateTimeText();let serial=Date.now();while(storedDocs(orders).some(d=>d.id===`SJ-SR-${at.slice(0,10).replaceAll('-','')}-${serial}`))serial++
 const doc=existing??{id:`SJ-SR-${at.slice(0,10).replaceAll('-','')}-${serial}`,status:'草稿' as const,createdAt:at,operator:operator.trim(),transport:{driver:'',vehicle:'',plate:'',note:''},scans:[],lines:[]}
 for(const line of lines){const same=doc.lines.find(l=>l.orderId===line.orderId);if(same)same.rolls.push(...line.rolls);else doc.lines.push(line)}
 if(!existing){const owner=orders.find(o=>o.waterOrderId===lines[0].orderId)!;(owner.dispatchDocuments??=[]).push(doc);owner.actionLogs.push({action:'创建交出单',detail:doc.id,at,operatorName:operator})}
 return structuredClone(doc)
})}
export function scanWaterDispatchRoll(id:string,barcode:string,operator:string):ProcessDispatchDocument{return transaction(orders=>{const d=storedDocs(orders).find(d=>d.id===id),code=barcode.trim();if(!d||d.status!=='草稿')throw new Error('只有草稿可以扫码。');if(!operator.trim())throw new Error('请填写扫码操作人。');if(!d.lines.some(l=>l.rolls.some(r=>r.barcode===code)))throw new Error('此卷不在本单，请核对卷码。');if(d.scans.some(s=>s.barcode===code))throw new Error('此卷已扫码，请勿重复。');d.scans.push({barcode:code,operator,at:localDateTimeText()});return structuredClone(d)})}
export function saveWaterDispatchTransport(id:string,transport:ProcessDispatchDocument['transport']):void{transaction(orders=>{const d=storedDocs(orders).find(d=>d.id===id);if(!d||d.status!=='草稿')throw new Error('只有草稿可以修改运输信息。');if(!transport.driver.trim()||!transport.vehicle.trim()||!transport.plate.trim())throw new Error('请填写司机、车型和车牌。');d.transport={...transport}})}
export function finishWaterDispatchDocument(id:string,action:'confirm'|'void'):ProcessDispatchDocument{return transaction(orders=>{
 const d=storedDocs(orders).find(d=>d.id===id);if(!d||d.status!=='草稿')throw new Error('当前单据已处理，请勿重复操作。')
 if(action==='void'){d.status='已作废';d.voidedAt=localDateTimeText();return structuredClone(d)}
 const actor=getPdaSession();if(!actor)throw new Error('请先登录本厂交接员或管理员账号，再确认实物交出。')
 for(const l of d.lines){const o=orders.find(o=>o.waterOrderId===l.orderId)!;const error=validateWaterSolublePdaActor(actor,o.factoryId,'HANDOVER');if(error)throw new Error(error);if(o.status!=='WAIT_HANDOVER'||o.factoryId!==l.factoryId||o.qtyUnit!==l.unit||targetOf(o).targetBusinessId!==l.partner.id||qtyOf(l)>available(o)+.000001)throw new Error('原加工单的状态、接收方或可交数量已变化。');if(l.rolls.some(r=>!o.outputRolls?.some(current=>current.id===r.id&&current.qty===r.qty&&!current.dispatchId&&current.printedAt)))throw new Error('卷记录已变化，请重新核对。')}
 if(d.lines.flatMap(l=>l.rolls).some(r=>!d.scans.some(s=>s.barcode===r.barcode)))throw new Error('请先逐卷扫码核对。')
 if(!d.transport.driver||!d.transport.plate||!d.transport.vehicle)throw new Error('请先保存运输信息。')
 const at=localDateTimeText()
 for(const l of d.lines){const o=orders.find(o=>o.waterOrderId===l.orderId)!;const head=ensureHandoverOrderForStartedTask(o.taskId);const record=createFactoryHandoverRecord({handoverOrderId:head.handoverOrderId,submittedQty:qtyOf(l),qtyUnit:l.unit,factorySubmittedAt:at,factorySubmittedBy:actor.userName,factoryRemark:`水溶交出单 ${d.id}`,materialCode:l.sku,materialName:o.materialName,scanCode:o.waterOrderNo,actor});l.handoverRecordId=record.handoverRecordId||record.recordId;for(const r of o.outputRolls??[])if(l.rolls.some(s=>s.id===r.id))r.dispatchId=d.id}
 d.status='已交出';d.handedOverAt=at
 return structuredClone(d)
})}
