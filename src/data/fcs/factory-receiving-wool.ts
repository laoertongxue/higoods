import {listFactoryReceipts,getHistoricalReceiptPosition,listReceivingAllocations} from './factory-receiving.ts'
import type {WoolDomainStore} from './wool-domain/store.ts'
/** Integrate into the existing wool ledger only. No generic factory inbound is posted. */
export function projectFactoryReceiptsIntoWool(store:WoolDomainStore):void {
 if(!store.workOrders['WOOL-RCV-DEMO-001']){
  const template=structuredClone(Object.values(store.workOrders)[0]);
  store.workOrders['WOOL-RCV-DEMO-001']={...template,woolOrderId:'WOOL-RCV-DEMO-001',woolOrderNo:'MZ-RCV-260911-001',taskId:'TASK-WOOL-RCV-001',taskNo:'TK-WOOL-RCV-001',productionOrderId:'PO-WOOL-RCV-001',productionOrderNo:'PO-WOOL-RCV-001',styleNo:'YARN-TRIAL-001',styleName:'段染棉纱试织（备料关联演示）',styleImageUrl:'/materials/process-orders/cotton-yarn-cone.jpg',internalStyleCode:'TRIAL-001',plannedStartAt:'2026-09-11',plannedCompletionAt:'2026-09-13',sourceTechPackVersionId:'TP-WOOL-RCV-001',sourceTechPackVersionCode:'TP-WOOL-RCV-V1',outputPlanLines:[{...template.outputPlanLines[0],outputSkuCode:'TRIAL-COTTON-MIXED',garmentSkuCode:'TRIAL-COTTON-MIXED',colorCode:'MIXED',colorName:'粉/黑/白段染',requiredYarnSkus:['YARN-COTTON-MIXED'],sourceTechPackVersionId:'TP-WOOL-RCV-001',sourceTechPackVersionCode:'TP-WOOL-RCV-V1',sourceColorMappingIds:['MAP-WOOL-RCV-001'],sourceBomItemIds:['BOM-WOOL-RCV-001']}],downstreamTarget:{receiverType:'DOWNSTREAM_FACTORY',receiverId:'ID-FAC-001203',receiverName:'SPF - 特种工艺'},createdAt:'2026-09-11 08:00:00',updatedAt:'2026-09-11 08:00:00'}
 }

 for(const receipt of listFactoryReceipts('OWN_WOOL_FACTORY'))for(const line of receipt.lines){
  if(line.material.kind!=='YARN'||!line.yarn)throw new Error('毛织来纱必须记录 pcs、毛重和净重。')
  const id=`WFR-${line.id}`
  if(store.yarnReceipts.some(r=>r.receiptId===id))continue
  const p=getHistoricalReceiptPosition(receipt.factoryId,line),flowId=`WF-${id}`,woolOrderId=line.woolOrderId||''
  if(woolOrderId){const order=store.workOrders[woolOrderId];if(!order||order.factoryId!==receipt.factoryId||!order.outputPlanLines.some(o=>o.requiredYarnSkus.includes(line.material.sku)))throw new Error('来纱关联的毛织加工单或纱线不匹配。')}
  store.yarnReceipts.push({receiptId:id,receiptNo:id,woolOrderId,factoryReceiptId:receipt.id,factoryId:receipt.factoryId,deliveryNo:receipt.deliveryId,batchNo:line.material.batchNo,receivedAt:receipt.receivedAt,receivedBy:receipt.operatorName,remark:receipt.remark,createdAt:receipt.receivedAt,updatedAt:receipt.receivedAt,lines:[{lineId:line.id,yarnSkuCode:line.material.sku,yarnName:line.material.name,receivedQty:line.qty,qtyUnit:'kg',warehouseInboundFlowId:flowId,yarnWeight:line.yarn,sourceDocumentNo:line.sourceDocumentNo,physicalWarehouseId:p.warehouse.warehouseId,physicalLocationId:p.location.locationId,imageUrl:line.material.imageUrl}]})
  if(line.qty>0)store.warehouseFlows.push({flowId,woolOrderId,factoryReceiptId:receipt.id,factoryId:receipt.factoryId,flowType:'INBOUND',businessType:'YARN_RECEIPT',warehouseMode:'WAIT_PROCESS',defaultLocationType:'YARN',defaultLocationId:'WOOL-WP-YARN-DEFAULT',objectSkuCode:line.material.sku,batchNo:line.material.batchNo,qty:line.qty,unit:'kg',sourceRecordType:'YARN_RECEIPT',sourceRecordId:line.id,operatedAt:receipt.receivedAt,operatedBy:receipt.operatorName,physicalWarehouseId:p.warehouse.warehouseId,physicalLocationId:p.location.locationId})
 }
 for(const allocation of listReceivingAllocations().filter(a=>a.woolOrderId)){
  const original=store.yarnReceipts.find(r=>r.lines.some(l=>l.lineId===allocation.receiptLineId)),line=original?.lines.find(l=>l.lineId===allocation.receiptLineId)
  if(!original||!line||!original.factoryReceiptId)continue
  const base=store.warehouseFlows.find(f=>f.flowId===line.warehouseInboundFlowId);if(!base)continue
  for(const [suffix,orderId,qty] of [['OUT','',-allocation.qty],['IN',allocation.woolOrderId!,allocation.qty]] as const){const id=`WFA-${allocation.id}-${suffix}`;if(store.warehouseFlows.some(f=>f.flowId===id))continue;store.warehouseFlows.push({...base,flowId:id,woolOrderId:orderId,flowType:'ADJUSTMENT',businessType:'STOCK_ADJUSTMENT',sourceRecordType:'STOCK_ADJUSTMENT',sourceRecordId:id,receivingAllocationId:allocation.id,qty,reason:`备料关联 ${allocation.id}；仅分配归属，不重复入库`,operatedAt:allocation.at,operatedBy:allocation.operatorName})}
 }
}
