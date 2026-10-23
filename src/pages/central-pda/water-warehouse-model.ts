import { listFactoryReceipts, listReceivingAllocations, getHistoricalReceiptPosition } from '../../data/fcs/factory-receiving.ts'
import { listFactoryInternalWarehouses } from '../../data/fcs/factory-internal-warehouse.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import { listCentralWaterFacts, centralWaterInputStock } from './water-model.ts'
import { centralWaterOutput, centralWaterReceiptHistory } from './water-output-model.ts'

/** A receipt is a physical fact; allocation relates a portion to an order without receiving it again. */
export function centralWaterWarehouse(factoryId:string){
  return withWashingStaticRead(()=>{
    const facts=listCentralWaterFacts(factoryId),byId=new Map(facts.map(fact=>[fact.order.waterOrderId,fact])),allocations=listReceivingAllocations()
    const incoming=listFactoryReceipts(factoryId).flatMap(receipt=>receipt.lines.flatMap(line=>{
      const direct=line.waterOrderId&&byId.get(line.waterOrderId)
      const assigned=allocations.filter(row=>row.receiptLineId===line.id&&!!row.waterOrderId&&byId.has(row.waterOrderId))
      if(!direct&&!assigned.length)return[]
      const orderIds=[...new Set(assigned.map(row=>row.waterOrderId!))]
      return [{receipt,line,position:getHistoricalReceiptPosition(factoryId,line),orders:direct?[{fact:direct,allocated:undefined}]:orderIds.map(id=>({fact:byId.get(id)!,allocated:assigned.filter(row=>row.waterOrderId===id).reduce((sum,row)=>sum+row.qty,0)}))}]
    })).sort((a,b)=>b.receipt.receivedAt.localeCompare(a.receipt.receivedAt)||b.line.id.localeCompare(a.line.id))
    const outgoing=facts.flatMap(fact=>centralWaterReceiptHistory(fact.order.waterOrderId,factoryId).map(row=>({fact,...row})))
      .sort((a,b)=>(b.doc.handedOverAt||'').localeCompare(a.doc.handedOverAt||'')||b.doc.id.localeCompare(a.doc.id)||a.line.orderId.localeCompare(b.line.orderId))
    const outputs=facts.flatMap(fact=>{
      const output=centralWaterOutput(fact.order.waterOrderId,factoryId),rolls=output?.rolls.filter(roll=>!roll.dispatchId)||[]
      const unregistered=Math.max(0,fact.availableOutput-rolls.reduce((sum,roll)=>sum+roll.qty,0))
      return rolls.length||unregistered>0.000001?[{fact,rolls,unregistered}]:[]
    })
    const stockByObject=new Map<string,ReturnType<typeof centralWaterInputStock>[number]&{receiptLineIds:string[]}>()
    for(const row of centralWaterInputStock(factoryId).filter(row=>row.receipt.factoryId===factoryId&&row.qty>0.000001)){
      const key=JSON.stringify([row.order.waterOrderId,row.line.sourceId,row.line.sourceLineId,row.line.warehouseId,row.line.locationId,row.line.unit,row.line.material.sku,row.line.material.name,row.line.material.kind,row.line.material.imageUrl,row.line.material.color,row.line.material.composition,row.line.material.specification,row.line.material.batchNo]),existing=stockByObject.get(key)
      if(existing){existing.qty+=row.qty;existing.receiptLineIds.push(row.line.id)}else stockByObject.set(key,{...row,receiptLineIds:[row.line.id]})
    }
    return {incoming,outgoing,outputs,stock:[...stockByObject.values()],
      warehouses:listFactoryInternalWarehouses().filter(warehouse=>warehouse.factoryId===factoryId)}
  })
}
export type CentralWaterWarehouse=ReturnType<typeof centralWaterWarehouse>
