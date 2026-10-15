import { readWashingState } from './fabric-washing-repository.ts'
import type { WashingOrder, WashingState } from './fabric-washing-model.ts'
import { productionOrders } from './production-orders.ts'

let printingRead:WashingState|undefined
/** One committed snapshot for a synchronous list/query render; never retained across actions. */
export function withPrintingWashingRead<T>(read:()=>T):T {
  const previous=printingRead
  printingRead=previous||readWashingState()
  try{return read()}finally{printingRead=previous}
}
const printingState=()=>printingRead||readWashingState()

/** All derived views use the committed washing order and its atomic action facts. */
export function printingWashingOrders(printOrderId:string,state:WashingState=printingState(),includeCancelled=false):WashingOrder[] {
  return state.orders.filter(order=>order.source.printOrderId===printOrderId&&(includeCancelled||!order.cancelledAt))
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))
}

/** The saved print target remains the return destination; only washed rolls go via the dye factory. */
export function printingDownstreamNames(order:{workOrderId:string;receivingTargetName:string;barcodes:ReadonlyArray<{id:string}>},state:WashingState=printingState()):string[] {
  const washes=printingWashingOrders(order.workOrderId,state)
  const covered=new Set(washes.flatMap(wash=>wash.rollIds))
  const names=washes.map(wash=>wash.assignedFactoryName||'待确认 GTG')
  if(!washes.length||order.barcodes.some(roll=>!covered.has(roll.id)))names.push(order.receivingTargetName)
  return [...new Set(names.filter(Boolean))]
}

export function printingWashingLogs(printOrderId:string,state:WashingState=readWashingState()) {
  const orders=new Map(printingWashingOrders(printOrderId,state,true).map(order=>[order.id,order]))
  return state.actions.filter(action=>action.action==='JUDGE'&&action.orderId&&orders.has(action.orderId)).map(action=>{
    const order=orders.get(action.orderId!)!
    return {id:action.id,operatedAt:action.at,operatorName:action.actor.name,action:'发起洗水',
      remark:`${order.no} · ${order.handFeel} · 承接染厂 ${order.assignedFactoryName||'待确认'} · ${order.rolls.map(roll=>`${roll.barcode} (${roll.inputQty} ${roll.unit})`).join('、')}`}
  })
}

function canonicalVersion(id:string):string {
  // The legacy version-code alias is an explicit existing identity, not a same-style match.
  return id.replace(/^TDV-DEMAND-/, 'tdv_demand_')
}
export function technicalWashingOrders(technicalVersionId:string,productionOrderId?:string,state:WashingState=readWashingState()):WashingOrder[] {
  if(!technicalVersionId)return []
  return state.orders.filter(order=>{
    const boundVersion=order.source.techPackVersionId||productionOrders.find(item=>item.productionOrderId===order.source.productionOrderId)?.techPackSnapshot?.sourceTechPackVersionId
    return !order.cancelledAt&&!!boundVersion&&canonicalVersion(boundVersion)===canonicalVersion(technicalVersionId)
      &&(!productionOrderId||order.source.productionOrderId===productionOrderId)
  })
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))
}

export function washingOrderStatus(o:WashingOrder):string {
  if(o.cancelledAt)return '已作废'
  if(o.exception)return '异常待核对'
  if(o.completedAt)return '已人工完成'
  if(o.rolls.every(r=>r.downstreamReceivedAt))return '全部实收待完单'
  if(o.rolls.some(r=>r.downstreamReceivedAt))return '部分下游实收'
  if(o.rolls.some(r=>r.handedOutAt))return '已交回待实收'
  if(o.rolls.every(r=>r.completedAt))return '加工完成待交回'
  if(o.rolls.some(r=>r.completedAt))return '部分加工完成'
  if(o.rolls.some(r=>r.startedAt))return '洗水加工中'
  if(o.rolls.some(r=>r.receivedAt))return '已实收待开工'
  if(o.rolls.some(r=>r.sentAt))return '印花已交出待实收'
  return ({UNASSIGNED:'待确认承接',PENDING:'待接单',ACCEPTED:'已接单待来货',REJECTED:'已拒单'})[o.acceptance]
}
