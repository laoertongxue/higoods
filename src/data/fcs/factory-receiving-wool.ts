import {listFactoryReceipts,getHistoricalReceiptPosition,listReceivingAllocations,listFactoryReceivingSources} from './factory-receiving.ts'
import type {WoolDomainStore} from './wool-domain/store.ts'
/** Integrate into the existing wool ledger only. No generic factory inbound is posted. */
export function projectFactoryReceiptsIntoWool(store:WoolDomainStore):void {
 const factories=new Set(Object.values(store.workOrders).map(order=>order.factoryId))
 const receipts=listFactoryReceipts()
 const sources=new Map(listFactoryReceivingSources(undefined,true).map(source=>[source.id,source]))
 for(const receipt of receipts.filter(r=>factories.has(r.factoryId)))for(const line of receipt.lines){
  if(line.material.kind!=='YARN'||!line.yarn || (line.woolOrderId && store.workOrders[line.woolOrderId]?.stage!=='KNITTING')) continue
  const id=`WFR-${line.id}`
  if(store.yarnReceipts.some(r=>r.receiptId===id))continue
  const p=getHistoricalReceiptPosition(receipt.factoryId,line),flowId=`WF-${id}`,woolOrderId=line.woolOrderId||''
  if(woolOrderId){const order=store.workOrders[woolOrderId];if(!order||order.factoryId!==receipt.factoryId||!order.outputPlanLines.some(o=>o.requiredYarnSkus.includes(line.material.sku)))throw new Error('来纱关联的毛织加工单或纱线不匹配。')}
  store.yarnReceipts.push({receiptId:id,receiptNo:id,woolOrderId,factoryReceiptId:receipt.id,factoryId:receipt.factoryId,deliveryNo:receipt.deliveryId,batchNo:line.material.batchNo,receivedAt:receipt.receivedAt,receivedBy:receipt.operatorName,remark:receipt.remark,createdAt:receipt.receivedAt,updatedAt:receipt.receivedAt,lines:[{lineId:line.id,yarnSkuCode:line.material.sku,yarnName:line.material.name,receivedQty:line.qty,qtyUnit:'kg',warehouseInboundFlowId:flowId,yarnWeight:line.yarn,sourceDocumentNo:line.sourceDocumentNo,physicalWarehouseId:p.warehouse.warehouseId,physicalLocationId:p.location.locationId,imageUrl:line.material.imageUrl}]})
  if(line.qty>0)store.warehouseFlows.push({flowId,woolOrderId,factoryReceiptId:receipt.id,factoryId:receipt.factoryId,flowType:'INBOUND',businessType:'YARN_RECEIPT',warehouseMode:'WAIT_PROCESS',defaultLocationType:'YARN',defaultLocationId:'WOOL-WP-YARN-DEFAULT',objectSkuCode:line.material.sku,batchNo:line.material.batchNo,qty:line.qty,unit:'kg',sourceRecordType:'YARN_RECEIPT',sourceRecordId:line.id,operatedAt:receipt.receivedAt,operatedBy:receipt.operatorName,physicalWarehouseId:p.warehouse.warehouseId,physicalLocationId:p.location.locationId})
 }
 for(const receipt of receipts)for(const line of receipt.lines){
  if(line.material.kind!=='WOOL_PIECE'||!line.woolOrderId||line.woolCraftOrderId)continue
  const order=store.workOrders[line.woolOrderId],piece=order?.externalPieces.find(piece=>piece.pieceKey===line.woolPieceKey)
  if(!order||order.stage!=='LINKING'||order.factoryId!==receipt.factoryId||!piece)continue
  const source=sources.get(line.sourceId),last=piece.routeNodes.at(-1)
  if(!source?.originalRecordId||!last||last.sourceEntryId!==line.woolRouteNodeId||last.factoryId!==source.origin.id)continue
  const actualHandover=store.craftRecords.find(record=>record.recordId===source.originalRecordId&&record.action==='HANDOVER')
  if(!actualHandover||actualHandover.pieceKey!==piece.pieceKey||actualHandover.routeNodeId!==last.sourceEntryId||actualHandover.targetOrderId!==order.woolOrderId||actualHandover.targetFactoryId!==order.factoryId)continue
  const receiptId=`WFPR-${line.id}`
  if(store.pieceReceipts.some(item=>item.receiptId===receiptId))continue
  const position=getHistoricalReceiptPosition(receipt.factoryId,line)
  store.pieceReceipts.push({receiptId,woolOrderId:order.woolOrderId,pieceKey:piece.pieceKey,sourceHandoverId:source.originalRecordId,qty:line.qty,receivedAt:receipt.receivedAt,receivedBy:receipt.operatorName})
  if(line.qty>0)store.warehouseFlows.push({flowId:`WF-${receiptId}`,woolOrderId:order.woolOrderId,factoryReceiptId:receipt.id,factoryId:receipt.factoryId,flowType:'INBOUND',businessType:'PIECE_RECEIPT',warehouseMode:'WAIT_HANDOVER',defaultLocationType:'CUT_PIECE',defaultLocationId:'WOOL-WH-CUT-DEFAULT',objectSkuCode:piece.pieceKey,qty:line.qty,unit:'片',sourceRecordType:'PIECE_RECEIPT',sourceRecordId:receiptId,operatedAt:receipt.receivedAt,operatedBy:receipt.operatorName,physicalWarehouseId:position.warehouse.warehouseId,physicalLocationId:position.location.locationId})
 }
 // Only the receiver's saved receipts acknowledge a horizontal-machine handover.
 for(const handover of store.handovers.filter(item=>item.pieceKey)){
  const actual=receipts.flatMap(receipt=>receipt.lines.filter(line=>line.material.kind==='WOOL_PIECE'&&line.woolPieceKey===handover.pieceKey&&line.woolCraftOrderId===handover.targetWorkOrderId&&line.woolRouteNodeId===handover.routeNodeId&&receipt.factoryId===handover.receiverId&&sources.get(line.sourceId)?.originalRecordId===handover.handoverId).map(line=>({receipt,line})))
  if(!actual.length)continue
  const qty=actual.reduce((sum,item)=>sum+item.line.qty,0),last=actual.at(-1)!.receipt
  handover.downstreamReceipt={receiptConfirmationId:last.id,status:qty>=handover.handoverQty?'CONFIRMED':'PENDING',actualReceivedQty:qty,differenceQty:qty-handover.handoverQty,receivedAt:last.receivedAt,receivedBy:last.operatorName}
 }
 for(const allocation of listReceivingAllocations().filter(a=>a.woolOrderId)){
  const original=store.yarnReceipts.find(r=>r.lines.some(l=>l.lineId===allocation.receiptLineId)),line=original?.lines.find(l=>l.lineId===allocation.receiptLineId)
  if(!original||!line||!original.factoryReceiptId)continue
  const base=store.warehouseFlows.find(f=>f.flowId===line.warehouseInboundFlowId);if(!base)continue
  for(const [suffix,orderId,qty] of [['OUT','',-allocation.qty],['IN',allocation.woolOrderId!,allocation.qty]] as const){const id=`WFA-${allocation.id}-${suffix}`;if(store.warehouseFlows.some(f=>f.flowId===id))continue;store.warehouseFlows.push({...base,flowId:id,woolOrderId:orderId,flowType:'ADJUSTMENT',businessType:'STOCK_ADJUSTMENT',sourceRecordType:'STOCK_ADJUSTMENT',sourceRecordId:id,receivingAllocationId:allocation.id,qty,reason:`备料关联 ${allocation.id}；仅分配归属，不重复入库`,operatedAt:allocation.at,operatedBy:allocation.operatorName})}
 }
}
