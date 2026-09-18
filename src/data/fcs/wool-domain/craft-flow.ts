import { woolSkuGenerationIssues } from './stage-rules.ts'
import { listFactoryReceipts, listFactoryReceivingSources, registerFactoryReceivingSource } from '../factory-receiving.ts'
import type { FactoryReceivingSource } from '../factory-receiving-types.ts'
import { listEnabledSpecialCraftOperationDefinitions } from '../special-craft-operations.ts'
import type { SpecialCraftTaskOrder } from '../special-craft-task-orders.ts'
import { commitWoolStore, readWoolStore, type WoolDomainStore } from './store.ts'
import { readWoolQuerySnapshot, readWoolReceivingQuerySnapshot } from './queries.ts'
import type { WoolExternalPiece, WoolPieceRouteNode, WoolWorkOrder } from './types.ts'

export function woolCraftOrderId(order: WoolWorkOrder, piece: WoolExternalPiece, node: WoolPieceRouteNode): string {
  return node.taskOrderId || `WSC:${order.pairId}:${piece.pieceKey}:${node.sourceEntryId}`
}
export function sourceForBatch(order: WoolWorkOrder, piece: WoolExternalPiece, input: {
  id:string; qty:number; at:string; by:string; factoryId:string; factoryName:string;
  target:WoolPieceRouteNode | null; sourceFactoryId:string; sourceFactoryName:string; routeNodeId:string
}): FactoryReceivingSource {
  const line = order.outputPlanLines.find(l => l.outputSkuCode === piece.skuCode)!
  return { id:`WRC:${input.id}`, documentNo:input.id, type:'HANDOUT', originalRecordId:input.id,
    origin:{kind:'FACTORY',id:input.sourceFactoryId,name:input.sourceFactoryName,factoryType:input.target ? '工艺加工厂' : '毛织工艺厂'},
    targetFactoryId:input.factoryId,targetFactoryName:input.factoryName,createdAt:input.at,createdBy:input.by,handedOutAt:input.at,
    workOrderNo:order.woolOrderNo, lines:[{id:`${input.id}:line`,material:{sku:piece.pieceKey,name:piece.pieceName,kind:'WOOL_PIECE',
      imageUrl:order.styleImageUrl || '',color:line.colorName,composition:'毛织片',specification:`${order.styleNo} / ${line.sizeCode} / ${piece.pieceName}`,batchNo:input.id},
      plannedQty:line.plannedQty * piece.pieceCountPerGarment,sentQty:input.qty,unit:'片',rolls:[],label:input.id,
      woolPieceKey:piece.pieceKey,woolRouteNodeId:input.target?.sourceEntryId || input.routeNodeId,
      ...(input.target ? {woolCraftOrderId:woolCraftOrderId(order,piece,input.target)} : {woolOrderId:order.pairedWorkOrderId}),
      productionOrderNo:order.productionOrderNo,taskNo:order.taskNo}] }
}
/** Publish only actual batches; calling again recreates the identical receiving source. */
export function registerWoolPieceHandover(handoverId:string, store:WoolDomainStore=readWoolStore()):void {
  const h = store.handovers.find(h => h.handoverId === handoverId)
  if (!h?.pieceKey) return
  const order=store.workOrders[h.woolOrderId], piece=order.externalPieces.find(p=>p.pieceKey===h.pieceKey)!, node=piece.routeNodes[0]
  registerFactoryReceivingSource(sourceForBatch(order,piece,{id:h.handoverId,qty:h.handoverQty,at:h.handedOverAt,by:h.handedOverBy,
    factoryId:node.factoryId,factoryName:node.factoryName,target:node,routeNodeId:node.sourceEntryId,
    sourceFactoryId:order.factoryId,sourceFactoryName:order.factoryName}))
}
function context(store:WoolDomainStore,taskId:string){
  for(const order of Object.values(store.workOrders).filter(o=>o.stage==='KNITTING'))
    for(const piece of order.externalPieces) for(let index=0;index<piece.routeNodes.length;index++){
      const node=piece.routeNodes[index]
      if(woolCraftOrderId(order,piece,node)===taskId)return {order,piece,node,index}
    }
  return undefined
}
function receivedQty(taskId:string):number{return readWoolReceivingQuerySnapshot().receipts.flatMap(r=>r.lines).filter(l=>l.woolCraftOrderId===taskId).reduce((n,l)=>n+l.qty,0)}
export function listWoolCraftTaskOrders():SpecialCraftTaskOrder[]{
  const store=readWoolQuerySnapshot(), operations=listEnabledSpecialCraftOperationDefinitions(),result:SpecialCraftTaskOrder[]=[]
  const receivedByTask = new Map<string, number>()
  for (const receipt of readWoolReceivingQuerySnapshot().receipts) for (const line of receipt.lines) {
    if (line.woolCraftOrderId) receivedByTask.set(line.woolCraftOrderId, (receivedByTask.get(line.woolCraftOrderId) || 0) + line.qty)
  }
  for(const order of Object.values(store.workOrders).filter(o=>o.stage==='KNITTING')) for(const piece of order.externalPieces) for(const node of piece.routeNodes){
    const op=operations.find(op=>op.craftCode===node.craftCode)
    if(!op || !node.factoryId || piece.issues.length || woolSkuGenerationIssues(order, piece.skuCode).length)continue
    const id=woolCraftOrderId(order,piece,node),facts=store.craftRecords.filter(r=>r.taskOrderId===id)
    const received=receivedByTask.get(id)||0,completed=facts.filter(r=>r.action==='PROCESS_REPORT').reduce((n,r)=>n+r.qty,0),handed=facts.filter(r=>r.action==='HANDOVER').reduce((n,r)=>n+r.qty,0)
    const plan=order.outputPlanLines.find(l=>l.outputSkuCode===piece.skuCode)!
    result.push({taskOrderId:id,taskOrderNo:`${order.woolOrderNo}-${piece.pieceInstanceId}-${node.sourceEntryId.split(':').at(-1)}`,
      woolPieceKey:piece.pieceKey,woolOrderId:order.woolOrderId,woolRouteNodeId:node.sourceEntryId,
      operationId:op.operationId,operationName:op.operationName,managementDomain:op.managementDomain,managementDomainName:op.managementDomainName,
      processCode:op.processCode,processName:op.processName,craftCode:op.craftCode,craftName:op.craftName,
      factoryId:node.factoryId,factoryName:node.factoryName,sourceFactoryId:order.factoryId,sourceFactoryName:order.factoryName,
      productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo,techPackVersion:order.sourceTechPackVersionCode,
      sourceTaskId:order.sourceTaskId,sourceTaskNo:order.taskNo,sourceEntryId:node.sourceEntryId,routeObjectKey:piece.pieceKey,predecessorEntryIds:node.predecessorEntryIds,
      inputObjectType:'CUT_PIECE',outputObjectType:'CUT_PIECE',targetObject:'已裁部位',quantityMode:'SAME_UNIT',inputUnit:'片',outputUnit:'片',
      partName:piece.pieceName,fabricColor:plan.colorName,sizeCode:plan.sizeCode,feiTicketNos:[],transferBagNos:[],fabricRollNos:[],
      materialSku:piece.pieceKey,planQty:plan.plannedQty*piece.pieceCountPerGarment,receivedQty:received,completedQty:completed,lossQty:0,
      returnedQty:handed,currentQty:Math.max(0,received-completed),waitHandoverQty:Math.max(0,completed-handed),writebackQty:handed,unit:'片',
      status:facts.some(r=>r.action==='COMPLETE')?'已完结':received>0?'加工中':'待接收',abnormalStatus:'无异常',dueAt:order.plannedCompletionAt,
      createdAt:order.createdAt,updatedAt:facts.at(-1)?.operatedAt||order.updatedAt,nodeRecords:[],warehouseLinks:[],
      remark:`毛织外发片；${node.craftName}。按技术包逐片路线交接，末工艺回缝盘。`})
  }
  return result
}
export function executeWoolCraftAction(input:{taskOrderId:string;actionCode:string;qty?:number;operatorName:string;operatedAt:string;commandId:string}):void{
  const store=readWoolStore(), c=context(store,input.taskOrderId)
  if(!c)throw new Error('毛织工艺单不存在')
  const {order,piece,node,index}=c
  if(piece.issues.length||woolSkuGenerationIssues(order, piece.skuCode).length)throw new Error('该片路线尚未确定')
  if(input.actionCode==='SPECIAL_CRAFT_CONFIRM_RECEIVE')throw new Error('请从待接收按实际交出批次确认接收毛织片')
  const action=input.actionCode==='SPECIAL_CRAFT_PROCESS_REPORT'?'PROCESS_REPORT':input.actionCode==='SPECIAL_CRAFT_SUBMIT_HANDOVER'?'HANDOVER':input.actionCode==='SPECIAL_CRAFT_COMPLETE_ORDER'?'COMPLETE':null
  if(!action)throw new Error('毛织工艺动作不支持')
  const qty=action==='COMPLETE'?0:Number(input.qty),existing=store.craftRecords.find(r=>r.commandId===input.commandId)
  if(existing){if(existing.taskOrderId!==input.taskOrderId||existing.action!==action||existing.qty!==qty||existing.operatedBy!==input.operatorName||existing.operatedAt!==input.operatedAt)throw new Error('重复请求的内容不一致');return}
  if(!input.commandId||!input.operatorName||!input.operatedAt)throw new Error('操作身份和时间缺失')
  const facts=store.craftRecords.filter(r=>r.taskOrderId===input.taskOrderId),received=receivedQty(input.taskOrderId)
  if(facts.some(r=>r.action==='COMPLETE'))throw new Error('工艺单已完结')
  const completed=facts.filter(r=>r.action==='PROCESS_REPORT').reduce((n,r)=>n+r.qty,0),handed=facts.filter(r=>r.action==='HANDOVER').reduce((n,r)=>n+r.qty,0)
  if(action!=='COMPLETE'&&(!Number.isSafeInteger(qty)||qty<=0))throw new Error('请输入大于 0 的整数片数')
  if(action==='PROCESS_REPORT'&&qty>received-completed)throw new Error('填报不能超过实际接收未加工片数')
  if(action==='HANDOVER'&&qty>completed-handed)throw new Error('交出不能超过实际加工未交出片数')
  const next=piece.routeNodes[index+1]||null
  if(next&&!next.factoryId)throw new Error('下一工艺尚未分配工厂')
  if(action==='COMPLETE'){
    const plan=order.outputPlanLines.find(l=>l.outputSkuCode===piece.skuCode)!.plannedQty*piece.pieceCountPerGarment
    const sources=listFactoryReceivingSources(undefined,true),receipts=listFactoryReceipts()
    if(completed<plan||completed!==handed||received!==completed)throw new Error('计划加工未完成或仍有未交出片')
    for(const h of facts.filter(r=>r.action==='HANDOVER')){
      const source=sources.find(s=>s.originalRecordId===h.recordId)
      const accepted=receipts.flatMap(r=>r.lines).filter(l=>l.sourceId===source?.id).reduce((n,l)=>n+l.qty,0)
      if(accepted!==h.qty)throw new Error('直接下游尚未收齐本工艺交出片')
    }
  }
  const id=`WCF:${input.commandId}`
  commitWoolStore(draft=>draft.craftRecords.push({recordId:id,commandId:input.commandId,taskOrderId:input.taskOrderId,action,qty,
    pieceKey:piece.pieceKey,routeNodeId:node.sourceEntryId,woolOrderId:order.woolOrderId,operatedAt:input.operatedAt,operatedBy:input.operatorName,
    ...(action==='HANDOVER'?{targetFactoryId:next?.factoryId||order.factoryId,targetOrderId:next?woolCraftOrderId(order,piece,next):order.pairedWorkOrderId}:{})}),()=>{
  if(action==='HANDOVER')registerFactoryReceivingSource(sourceForBatch(order,piece,{id,qty,at:input.operatedAt,by:input.operatorName,
    factoryId:next?.factoryId||order.factoryId,factoryName:next?.factoryName||order.factoryName,target:next,routeNodeId:node.sourceEntryId,
    sourceFactoryId:node.factoryId,sourceFactoryName:node.factoryName}))
  })
}
