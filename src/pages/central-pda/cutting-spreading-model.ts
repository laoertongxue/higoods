import { withGeneratedCutOrderReadFrame } from '../../data/fcs/cutting/generated-cut-orders.ts'
import { listMaterialLedgerProjections } from '../../data/fcs/cutting/material-ledger.ts'
import { convertCuttingQuantity } from '../../data/fcs/cutting/cutting-quantity-unit.ts'
import { resolveSpreadingMaterialReadiness } from '../../data/fcs/cutting/spreading-material-readiness.ts'
import { prepareCentralSpreadingAction, centralSpreadingSourceSnapshot, type CentralSpreadingAction, type CentralSpreadingInput, type CentralSpreadingSource } from '../../data/fcs/cutting/cutting-spreading-command.ts'
import { runCuttingEventAction, committedCuttingEvents } from '../../data/fcs/cutting/cutting-event-repository.ts'
import { appendCuttingRuntimeEventIdempotent } from '../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { stagePartTicketSpreadingStore } from '../../data/fcs/cutting/part-ticket-records.ts'
import { readCentralCuttingFacts, assertCentralCuttingActor, prepareCentralCutting, cuttingEventPayload, type CentralCuttingFacts } from './cutting-model.ts'
import { readCentralCuttingExecution, type CentralCuttingExecution } from './cutting-execution-model.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'

export function centralSpreadingSource(facts:CentralCuttingFacts,execution:CentralCuttingExecution,id:string):CentralSpreadingSource|undefined {
 const order=execution.orders.find(order=>order.spreadingOrderId===id),session=execution.store.sessions.find(session=>session.spreadingSessionId===id)
 if(!order||!session||!facts.factory)return
 const persisted=new Set(committedCuttingEvents().map(event=>event.eventId)),actual=facts.events.filter(event=>persisted.has(event.eventId)&&event.eventStatus!=='已取消'
  && (cuttingEventPayload(event).warehouseLocations as Array<{factoryId:string}>|undefined)?.every(ref=>ref.factoryId===facts.factory!.id))
 const raw=listMaterialLedgerProjections().filter(row=>order.sourceCutOrderIds.includes(row.cutOrderId))
 const stock=new Map(execution.issues.filter(row=>row.order.spreadingOrderId===id).map(row=>[row.inbound.eventId,row]))
 const ledger=Object.fromEntries(raw.map(row=>{const convert=(qty:number,unit:string)=>{const value=convertCuttingQuantity(qty,unit,row.unit);if(value===null)throw new Error('CUT_unit');return value}
  const incoming=actual.filter(event=>event.eventType==='中转仓接收'&&event.refs.cutOrderId===row.cutOrderId)
  return[row.cutOrderId,{...row,cuttingClaimedQty:incoming.reduce((sum,event)=>sum+convert(event.inventoryEffect?.qty||0,event.inventoryEffect?.unit||''),0),
   availableQty:[...stock.values()].filter(stock=>stock.inbound.refs.cutOrderId===row.cutOrderId).reduce((sum,stock)=>sum+convert(stock.availableQty,stock.inbound.inventoryEffect?.unit||''),0),spreadingConsumedQty:0,returnedQty:0}]}))
 const rows=order.sourceCutOrderIds.map(id=>execution.rowsById[id]).filter(Boolean),first=rows[0]
 return{order,session,store:execution.store,factoryId:facts.factory.id,assignments:order.sourceCutOrderIds.map(id=>facts.assigned.find(source=>source.cutOrderId===id)),
  readiness:resolveSpreadingMaterialReadiness({sourceCutOrderIds:order.sourceCutOrderIds,plannedMaterialUsage:order.plannedMaterialUsage,plannedMaterialUsageUnit:order.plannedMaterialUsageUnit,
   spreadingOrderId:id,factoryId:facts.factory.id},ledger),issues:execution.returns.filter(row=>row.issue.refs.spreadingOrderId===id&&(cuttingEventPayload(row.issue).sourceInboundEventIds as string[]|undefined)?.length
   &&(cuttingEventPayload(row.issue).sourceInboundEventIds as string[]).every(sourceId=>persisted.has(sourceId)&&actual.some(event=>event.eventId===sourceId&&event.inventoryEffect?.direction==='IN'&&event.refs.cutOrderId===row.issue.refs.cutOrderId&&event.material?.materialSku===row.issue.material?.materialSku))),
  context:first?{contextType:session.contextType,cutOrderIds:order.sourceCutOrderIds,cutOrderNos:order.sourceCutOrderNos,markerPlanId:order.markerPlanId,markerPlanNo:order.markerPlanNo,
   productionOrderNos:order.productionOrderNos,styleCode:order.styleId,spuCode:order.spuCode,styleName:order.styleName,materialSkuSummary:order.materialIdentity.materialSku,
   materialImageUrl:order.materialIdentity.materialImageUrl,materialPrepRows:rows}:null}
}
export function centralSpreadingInput(source:CentralSpreadingSource,actor:FactoryPdaUser,action:CentralSpreadingAction,operationId:string):CentralSpreadingInput {
 return{operationId,spreadingOrderId:source.order.spreadingOrderId,expectedSource:centralSpreadingSourceSnapshot(source),factoryId:actor.factoryId,operatorId:actor.userId,operatorName:actor.name,action}
}
export async function saveCentralSpreading(input:CentralSpreadingInput,actor:FactoryPdaUser) {
 const assertActor=()=>{assertCentralCuttingActor(actor);if(input.factoryId!==actor.factoryId||input.operatorId!==actor.userId||input.operatorName!==actor.name)throw new Error('CUT_actor')}
 assertActor();await prepareCentralCutting();const now=new Date()
 const read=()=>withGeneratedCutOrderReadFrame(()=>{assertActor();const facts=readCentralCuttingFacts(actor.factoryId),source=centralSpreadingSource(facts,readCentralCuttingExecution(facts),input.spreadingOrderId)
  if(!source)throw new Error('CUT_changed');prepareCentralSpreadingAction(source,input,now);return source})
 // Only this synchronous action knows the exact session it committed. Keep the
 // comparison in memory; a later read may already include another device's edit.
 let savedSessionSignature:string|undefined
 const saved=await runCuttingEventAction({id:`central-spreading:${input.operationId}`,intent:JSON.stringify(input),assertCurrent:()=>{read()},action:storage=>{
  const source=read(),result=prepareCentralSpreadingAction(source,input,now)
  savedSessionSignature=JSON.stringify(result.session)
  stagePartTicketSpreadingStore(result.store,source.store,{sessions:[result.session.spreadingSessionId]})
  if(input.action!=='save-roll'){
   const types:Record<Exclude<CentralSpreadingAction,'save-roll'>,'开始铺布'|'完成铺布'|'开始裁剪'|'完成裁剪'>={'start-spreading':'开始铺布','finish-spreading':'完成铺布','start-cutting':'开始裁剪','finish-cutting':'完成裁剪'}
   appendCuttingRuntimeEventIdempotent({eventId:`central-spreading:${input.operationId}`,idempotencyKey:`central-spreading:${input.operationId}`,eventType:types[input.action],eventSource:'PDA',
    operatorId:actor.userId,operatorName:actor.name,operatorRole:'现场加工人员',occurredAt:result.session.operationLogs?.find(log=>log.logId===`central-spreading:${input.operationId}`)?.occurredAt,
    refs:{spreadingOrderId:source.order.spreadingOrderId,spreadingOrderNo:source.order.spreadingOrderNo,cutOrderId:source.order.sourceCutOrderIds[0],cutOrderNo:source.order.sourceCutOrderNos[0],
      productionOrderId:source.order.productionOrderIds[0],productionOrderNo:source.order.productionOrderNos[0],markerPlanId:source.order.markerPlanId,markerPlanNo:source.order.markerPlanNo},
    payload:{centralSpreadingActionVersion:1,action:input.action,spreadingOrderId:source.order.spreadingOrderId,spreadingOrderNo:source.order.spreadingOrderNo,
      sourceCutOrderIds:source.order.sourceCutOrderIds,factoryId:actor.factoryId,cuttingTableId:result.session.cuttingTableId,ownerAccountId:result.session.ownerAccountId,
      actualMaterialUsage:result.session.totalActualLength,actualMaterialUsageUnit:'米',actualLayerCount:result.session.actualLayers,actualGarmentQty:result.session.actualCutGarmentQty,
      unit:'米',rollNos:result.session.rolls.map(roll=>roll.rollNo),operatorNames:[actor.name],finishedAt:result.session.actualEndAt||'',cuttingCompletedAt:result.session.cuttingFinishedAt||''},
   },storage)
  }
  return{spreadingOrderId:result.session.spreadingSessionId,action:input.action}
 }})
 return{...saved,savedSessionSignature}
}
