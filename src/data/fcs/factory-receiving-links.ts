import {invalidatePdaHandoverHeadCache} from './pda-handover-events.ts'
import {listFactoryReceipts,listReceivingAllocations,allocateFactoryReceivedMaterial,prepareFactoryReceipt,savePreparedFactoryReceipt,type FactoryReceiptInput,type ReceivingAllocation} from './factory-receiving.ts'
import {listDyeWorkOrders} from './dyeing-task-domain.ts'
import {readWoolStore} from './wool-domain/store.ts'
export function listReceivingAllocationTargets(receiptLineId:string){
 const receipt=listFactoryReceipts().find(r=>r.lines.some(l=>l.id===receiptLineId)),line=receipt?.lines.find(l=>l.id===receiptLineId)
 if(!receipt||!line||line.dyeOrderId||line.woolOrderId)return []
 if(receipt.factoryId==='OWN_WOOL_FACTORY')return Object.values(readWoolStore().workOrders).filter(o=>o.factoryId===receipt.factoryId&&o.outputPlanLines.some(l=>l.requiredYarnSkus.includes(line.material.sku))).map(o=>({id:o.woolOrderId,no:o.woolOrderNo,kind:'wool' as const}))
 return listDyeWorkOrders().filter(o=>o.dyeFactoryId===receipt.factoryId&&[o.rawMaterialSku,o.materialId].includes(line.material.sku)&&!['COMPLETED','REJECTED'].includes(o.status)).map(o=>({id:o.dyeOrderId,no:o.dyeOrderNo,kind:'dye' as const}))
}
export function allocateReceivedMaterialToOrder(input:ReceivingAllocation){
 if(!listReceivingAllocationTargets(input.receiptLineId).some(t=>t.id===(input.dyeOrderId||input.woolOrderId)))throw new Error('请选择本厂、同一物料 SKU 的有效加工单。')
 allocateFactoryReceivedMaterial(input)
}
export function confirmFactoryMaterialReceipt(input:FactoryReceiptInput){
 const receipt=prepareFactoryReceipt(input)
 if(input.factoryId==='OWN_WOOL_FACTORY'){
  const store=readWoolStore()
  for(const line of receipt.lines){if(line.material.kind!=='YARN'||!line.yarn)throw new Error('毛织接收来纱必须有 pcs、毛重和净重。');if(line.woolOrderId){const order=store.workOrders[line.woolOrderId];if(!order||order.factoryId!==input.factoryId||!order.outputPlanLines.some(l=>l.requiredYarnSkus.includes(line.material.sku)))throw new Error('纱线与毛织加工单不匹配，请核对来源关联。')}}
 }
 savePreparedFactoryReceipt(receipt);invalidatePdaHandoverHeadCache();return receipt
}
export function remainingReceivingAllocationQty(id:string){const line=listFactoryReceipts().flatMap(r=>r.lines).find(l=>l.id===id);return Math.max(0,(line?.qty||0)-listReceivingAllocations().filter(a=>a.receiptLineId===id).reduce((n,a)=>n+a.qty,0))}
