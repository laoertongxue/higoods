import type { WoolDomainStore } from './store.ts'
import type { WoolProcessReportRecord, WoolQtyChangeLog } from './types.ts'
import { stageReportedQty } from './stage-rules.ts'

/** Apply dependent facts inside the same store transaction as the original correction. */
export function syncStageReportCorrection(store:WoolDomainStore,report:WoolProcessReportRecord,change:WoolQtyChangeLog):void{
 const order=store.workOrders[report.woolOrderId], delta=change.afterQty-change.beforeQty
 const pieces=order.externalPieces.filter(p=>p.skuCode===report.outputSkuCode)
 const changeDerived=(type:'HANDOVER'|'PROCESS_REPORT',id:string,flowId:string)=>{
  const target=type==='HANDOVER'?store.handovers.find(h=>h.handoverId===id):store.processReports.find(r=>r.reportId===id)
  if(!target)throw new Error('自动衔接记录缺失，不能修改数量')
  const baseQty='handoverQty' in target?target.handoverQty:target.reportedQty
  const before=[...store.qtyChangeLogs].reverse().find(c=>c.recordType===type&&c.recordId===id)?.afterQty??baseQty
  const flow=store.warehouseFlows.find(f=>f.flowId===flowId)!
  const derived={...change,changeId:`${change.changeId}:${type}`,recordType:type,recordId:id,beforeQty:before,afterQty:before+delta}
  store.qtyChangeLogs.push(derived)
  store.warehouseFlows.push({...flow,flowId:`WF-${derived.changeId}`,flowType:'ADJUSTMENT',businessType:'STOCK_ADJUSTMENT',qty:delta*(type==='HANDOVER'?-1:1),sourceRecordType:'QTY_CHANGE',sourceRecordId:derived.changeId,reason:change.reason,operatedAt:change.changedAt,operatedBy:change.changedBy})
  if('downstreamReceipt' in target&&target.downstreamReceipt)target.downstreamReceipt.actualReceivedQty=derived.afterQty
 }
 if(order.stage==='KNITTING'){
  const linking=store.workOrders[order.pairedWorkOrderId]
  if(store.completions.some(c=>c.woolOrderId===linking.woolOrderId))throw new Error('关联缝盘单已完单，不能修改横机数量')
  const total=stageReportedQty(store,order.woolOrderId,report.outputSkuCode)
  const linked=stageReportedQty(store,linking.woolOrderId,report.outputSkuCode)
  if(pieces.length&&total<linked)throw new Error(`修改后不能少于缝盘已使用的 ${linked} 件`)
  for(const piece of pieces){
   const sent=store.handovers.filter(h=>h.woolOrderId===order.woolOrderId&&h.pieceKey===piece.pieceKey).reduce((n,h)=>n+h.handoverQty,0)
   if(total*piece.pieceCountPerGarment<sent)throw new Error(`${piece.pieceName} 已外发 ${sent} 片，不能调减到不足以支撑交出`)
  }
  if(!pieces.length&&store.handovers.some(h=>h.woolOrderId===linking.woolOrderId&&h.outputSkuCode===report.outputSkuCode))throw new Error('关联缝盘产物已经最终交出，不能修改自动衔接数量')
  const handover=store.handovers.find(h=>h.sourceReportId===report.reportId&&h.automatic)!
  const receipt=store.internalReceipts.find(r=>r.sourceReportId===report.reportId)
  if(!handover||!receipt)throw new Error('内部接收来源不完整')
  receipt.qty+=delta
  changeDerived('HANDOVER',handover.handoverId,handover.warehouseOutboundFlowId)
  if(!pieces.length){const auto=store.processReports.find(r=>r.sourceReportId===report.reportId)!
   changeDerived('PROCESS_REPORT',auto.reportId,auto.warehouseInboundFlowId)
  }
 }
 // Physical piece balances follow the effective report. The parent correction preserves the audit trail.
 for(const flow of store.warehouseFlows.filter(f=>f.sourceRecordType==='PROCESS_REPORT'&&f.sourceRecordId===report.reportId&&f.unit==='片')){
  const piece=pieces.find(p=>p.pieceKey===flow.objectSkuCode)!
  flow.qty=change.afterQty*piece.pieceCountPerGarment
 }
}
