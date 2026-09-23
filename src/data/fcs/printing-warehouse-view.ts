import { listFactoryInternalWarehouses, listFactoryWarehouseNodeRows, type FactoryInternalWarehouse, type FactoryWaitProcessStockItem, type FactoryWaitHandoverStockItem, type FactoryWarehouseInboundRecord, type FactoryWarehouseOutboundRecord, type FactoryWarehouseNodeRow, type FactoryWarehouseStocktakeOrder } from './factory-internal-warehouse.ts'
import { listFactoryReceipts, listFactoryReceivingSources, listReceivingAllocations, listFactoryMaterialUses } from './factory-receiving.ts'
import { listPrintingWorkOrders, listPrintingDispatchDocuments, getPrintWorkOrderById } from './printing-task-domain.ts'
import { listHandoverOrdersByTaskId, getPdaHandoverRecordsByHead } from './pda-handover-events.ts'
import { printingEventTimestamp, normalizePrintingUnit } from './printing-statistics.ts'

export interface PrintingWarehouseViewFilters { factoryId?: string; status?: string; keyword?: string; timeRange?: '7D' | '30D' | 'ALL' }
export interface PrintingStockFlow {flowType:string;qtyText:string;sourceNo:string;operatedAt:string;operatorName:string;statusText:string}
interface PhysicalMetadata { imageUrl:string; workOrderIds:string[]; flows:PrintingStockFlow[] }
export interface PrintingInputStock extends FactoryWaitProcessStockItem, PhysicalMetadata {
  originalReceivedQty:number; preparedQty:number; freeQty:number; receiptLineId:string
  rolls:Array<{barcode:string;receivedQty:number;usedQty:number;remainingQty:number;location:string}>
}
export interface PrintingOutputStock extends Omit<FactoryWaitHandoverStockItem,'lossQty'>, PhysicalMetadata {
  lossQty?:number; reservedQty:number; availableQty:number; dispatchIds:string[]; receivedAt?:string; inboundOperator?:string
}
export interface PrintingUsageRecord {id:string;workOrderId:string;receiptLineId:string;sourceNo:string;factoryId:string;factoryName:string;materialSku:string;materialName:string;imageUrl:string;barcode?:string;qty:number;unit:string;at:string;operatorName:string}
export interface PrintingWarehouseView {
  factoryIds:string[];taskIds:string[];printOrderIds:string[];handoverOrderIds:string[]
  waitProcessItems:PrintingInputStock[];waitHandoverItems:PrintingOutputStock[];outputInboundItems:PrintingOutputStock[]
  inboundRecords:Array<FactoryWarehouseInboundRecord & PhysicalMetadata>;outboundRecords:Array<FactoryWarehouseOutboundRecord & PhysicalMetadata>
  usageRecords:PrintingUsageRecord[]; warehouses:FactoryInternalWarehouse[];nodeRows:FactoryWarehouseNodeRow[];stocktakeOrders:FactoryWarehouseStocktakeOrder[]
  unknownInputOrders:number;unknownOutputOrders:number;unlocatedOutputByUnit:Record<string,number>
}
const numberText=(value:number,unit:string)=>`${value.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${unit}`
const unique=<T>(values:T[])=>[...new Set(values)]
const itemKind=(kind:string):FactoryWaitProcessStockItem['itemKind']=>kind==='YARN'?'纱线':kind==='ACCESSORY'?'辅料':'面料'

/** Physical rows are keyed by receipt line, never by allocation or work-order totals. */
export function getPrintingWarehouseView(filters:PrintingWarehouseViewFilters={}):PrintingWarehouseView {
  const orders=listPrintingWorkOrders(),orderMap=new Map(orders.map(o=>[o.workOrderId,o]))
  const sources=listFactoryReceivingSources(),sourceMap=new Map(sources.map(s=>[s.id,s]))
  const allocations=listReceivingAllocations(),uses=listFactoryMaterialUses(),documents=listPrintingDispatchDocuments()
  const warehouses=listFactoryInternalWarehouses()
  const factoryNames=new Map(orders.map(o=>[o.printFactoryId,o.printFactoryName]))
  const visible=(factoryId:string,status:string,tokens:string[],at?:string)=>{
    if(filters.factoryId&&factoryId!==filters.factoryId||filters.status&&filters.status!=='ALL'&&status!==filters.status)return false
    if(filters.keyword&&!tokens.join(' ').toLowerCase().includes(filters.keyword.trim().toLowerCase()))return false
    if(filters.timeRange&&filters.timeRange!=='ALL') { const timestamp=printingEventTimestamp(at,factoryId); if(timestamp===undefined||timestamp>Date.now()||Date.now()-timestamp>(filters.timeRange==='7D'?7:30)*86400000)return false }
    return true
  }
  const location=(warehouseId:string,locationId:string)=>{
    const warehouse=warehouses.find(w=>w.warehouseId===warehouseId)
    for(const area of warehouse?.areaList??[])for(const shelf of area.shelfList)for(const loc of shelf.locationList)if(loc.locationId===locationId)return {warehouseName:warehouse!.warehouseName,areaName:area.areaName,shelfNo:shelf.shelfNo,locationNo:loc.locationNo,locationText:`${area.areaName}/${shelf.shelfNo}/${loc.locationNo}`}
    return {warehouseName:warehouse?.warehouseName||'历史仓库未记录',areaName:'未记录',shelfNo:'未记录',locationNo:locationId||'未记录',locationText:locationId||'历史库位未记录'}
  }
  const knownInputOrders=new Set<string>(),knownOutputOrders=new Set<string>()
  const waitProcessItems:PrintingInputStock[]=[],inboundRecords:PrintingWarehouseView['inboundRecords']=[],usageRecords:PrintingUsageRecord[]=[]
  for(const receipt of listFactoryReceipts())for(const line of receipt.lines){
    const source=sourceMap.get(line.sourceId),lineAllocations=allocations.filter(a=>a.receiptLineId===line.id)
    const workOrderIds=unique([line.printingOrderId,...lineAllocations.map(a=>a.printingOrderId)].filter((id):id is string=>Boolean(id&&orderMap.has(id))))
    if(!workOrderIds.length&&source?.processCode!=='PRINT')continue
    workOrderIds.forEach(id=>knownInputOrders.add(id))
    const linkedOrders=workOrderIds.map(id=>orderMap.get(id)!),lineUses=uses.flatMap(u=>u.lines.filter(l=>l.receiptLineId===line.id).map(l=>({use:u,line:l})))
    const issuedQty=lineUses.reduce((n,u)=>n+u.line.qty,0),remaining=Math.max(0,line.qty-issuedQty)
    const assignedQty=line.printingOrderId?line.qty:lineAllocations.reduce((n,a)=>n+a.qty,0)
    const preparedQty=Math.min(remaining,Math.max(0,assignedQty-issuedQty)),loc=location(line.warehouseId,line.locationId)
    const sourceLine=source?.lines.find(l=>l.id===line.sourceLineId)
    const expected=line.rolls?.length?line.rolls.reduce((n,r)=>n+(sourceLine?.rolls.find(sr=>sr.barcode===r.barcode)?.yard??0),0):undefined
    const diff=expected===undefined?0:line.qty-expected
    const status:FactoryWaitProcessStockItem['status']=remaining<=0?'已领用':Math.abs(diff)>.00001?'差异待处理':'已入待加工仓'
    const factoryName=source?.targetFactoryName||factoryNames.get(receipt.factoryId)||receipt.factoryId
    const flows:PrintingStockFlow[]=[{flowType:'接收入仓',qtyText:numberText(line.qty,line.unit),sourceNo:receipt.id,operatedAt:receipt.receivedAt,operatorName:receipt.operatorName,statusText:'按实际接收'}]
    for(const {use,line:usage} of lineUses){
      flows.push({flowType:'加工用料',qtyText:`−${numberText(usage.qty,usage.unit)}`,sourceNo:use.id,operatedAt:use.at,operatorName:use.operatorName,statusText:usage.barcode||'按实际包装'})
      if(visible(receipt.factoryId,'已领用',[use.id,line.material.sku,...workOrderIds],use.at))usageRecords.push({id:`${use.id}:${line.id}:${usage.barcode||''}`,workOrderId:use.printingOrderId||'',receiptLineId:line.id,sourceNo:receipt.id,factoryId:receipt.factoryId,factoryName,materialSku:line.material.sku,materialName:line.material.name,imageUrl:line.material.imageUrl,barcode:usage.barcode,qty:usage.qty,unit:usage.unit,at:use.at,operatorName:use.operatorName})
    }
    const stock:PrintingInputStock={stockItemId:line.id,receiptLineId:line.id,warehouseId:line.warehouseId,factoryId:receipt.factoryId,factoryName,factoryKind:'CENTRAL_PRINT',...loc,processCode:'PRINT',processName:'印花',craftCode:'PRINT',craftName:'印花',itemKind:itemKind(line.material.kind),itemName:line.material.name,materialSku:line.material.sku,fabricColor:line.material.color,fabricRollNo:line.rolls?.map(r=>r.barcode).join(' / '),unit:line.unit,photoList:[line.material.imageUrl],imageUrl:line.material.imageUrl,sourceRecordId:workOrderIds[0]||'',sourceRecordNo:line.sourceDocumentNo,sourceRecordType:'HANDOVER_RECEIVE',sourceObjectKind:'上游工厂仓',sourceObjectName:line.origin.name,taskId:(linkedOrders[0] ? getPrintWorkOrderById(linkedOrders[0].workOrderId)?.taskId : undefined),taskNo:linkedOrders.map(o=>o.taskNo).join(' / '),productionOrderNo:linkedOrders.map(o=>o.demandSource.productionOrderNo).filter(Boolean).join(' / '),expectedQty:expected??line.qty,receivedQty:remaining,originalReceivedQty:line.qty,availableQty:remaining,issuedQty,preparedQty,freeQty:Math.max(0,remaining-preparedQty),differenceQty:diff,receiverName:receipt.operatorName,receivedAt:receipt.receivedAt,status,workOrderIds,flows,rolls:(line.rolls??[]).map(r=>{const used=lineUses.filter(u=>u.line.barcode===r.barcode).reduce((n,u)=>n+u.line.qty,0);return {barcode:r.barcode,receivedQty:r.yard,usedQty:used,remainingQty:Math.max(0,r.yard-used),location:location(r.warehouseId,r.locationId).locationText}})}
    if(visible(receipt.factoryId,status,[line.sourceDocumentNo,line.material.name,line.material.sku,...workOrderIds,stock.fabricRollNo||''],receipt.receivedAt)){
      if(remaining>0)waitProcessItems.push(stock)
      inboundRecords.push({...stock,inboundRecordId:line.id,inboundRecordNo:receipt.id,receivedQty:line.qty,status:Math.abs(diff)>.00001?'差异待处理':'已入库',generatedStockItemId:line.id})
    }
  }
  const outputInboundItems:PrintingOutputStock[]=[],outboundRecords:PrintingWarehouseView['outboundRecords']=[]
  for(const order of orders){
    const heads=listHandoverOrdersByTaskId(getPrintWorkOrderById(order.workOrderId)?.taskId || order.taskNo, {includeWool:false}),records=heads.flatMap(h=>getPdaHandoverRecordsByHead(h.handoverId,h)).filter(r=>r.handoverRecordStatus!=='VOIDED')
    const defaultWarehouse=warehouses.find(w=>w.factoryId===order.printFactoryId&&w.warehouseKind==='WAIT_HANDOVER')
    for(const roll of order.barcodes){
      if(!(roll.lengthY>0)||(roll.quantityConfirmed!==true&&!roll.handoverRecordId))continue
      knownOutputOrders.add(order.workOrderId)
      const actualOut=records.find(r=>r.recordId===roll.handoverRecordId||r.handoverRecordId===roll.handoverRecordId)
      const handedOut=Boolean(actualOut),reservedDocs=documents.filter(d=>d.status==='草稿'&&d.lines.some(l=>l.workOrderId===order.workOrderId&&l.barcodeIds.includes(roll.id)))
      const physicalQty=handedOut?0:roll.lengthY,batch=order.productionBatches?.find(b=>b.id===roll.batchId)
      const flows:PrintingStockFlow[]=[]
      if(batch?.at)flows.push({flowType:'加工入仓',qtyText:numberText(roll.lengthY,order.output.qtyUnit),sourceNo:batch?.id||roll.barcode,operatedAt:batch!.at,operatorName:batch?.operatorName||'历史操作人未记录',statusText:'实际产出卷入仓'})
      if(actualOut)flows.push({flowType:'交出出仓',qtyText:`−${numberText(roll.lengthY,order.output.qtyUnit)}`,sourceNo:actualOut.handoverRecordNo||actualOut.recordId,operatedAt:actualOut.factorySubmittedAt,operatorName:actualOut.factorySubmittedBy||'历史操作人未记录',statusText:'实际交出'})
      const stock:PrintingOutputStock={stockItemId:roll.id,warehouseId:defaultWarehouse?.warehouseId||'',factoryId:order.printFactoryId,factoryName:order.printFactoryName,factoryKind:'CENTRAL_PRINT',warehouseName:roll.warehouseName||'库位待登记',processCode:'PRINT',processName:'印花',craftCode:'PRINT',craftName:order.requirement.craftName,itemKind:order.output.objectType==='纱线'?'纱线':'面料',itemName:order.output.materialName,materialSku:roll.sku,fabricRollNo:roll.barcode,unit:order.output.qtyUnit,areaName:roll.outboundArea||'未记录',shelfNo:'未记录',locationNo:roll.outboundArea||'未记录',locationText:roll.outboundArea||'库位待登记',photoList:[order.output.imageUrl],imageUrl:order.output.imageUrl,taskId:getPrintWorkOrderById(order.workOrderId)?.taskId || order.taskNo,taskNo:order.taskNo,productionOrderNo:order.demandSource.productionOrderNo,completedQty:roll.lengthY,lossQty:undefined,waitHandoverQty:physicalQty,reservedQty:reservedDocs.length?physicalQty:0,availableQty:reservedDocs.length?0:physicalQty,dispatchIds:reservedDocs.map(d=>d.id),receiverKind:'其他接收方',receiverName:order.receivingTargetName||order.handover.receiverName,handoverRecordId:actualOut?.recordId,handoverRecordNo:actualOut?.handoverRecordNo,status:handedOut?'已交出':'待交出',workOrderIds:[order.workOrderId],flows,receivedAt:batch?.at,inboundOperator:batch?.operatorName}
      if(visible(order.printFactoryId,stock.status,[order.printOrderNo,order.taskNo,roll.sku,roll.barcode],batch?.at))outputInboundItems.push(stock)
    }
    for(const record of records){
      const head=heads.find(h=>h.handoverId===record.handoverId),receivedQty=record.receiverWrittenQty??record.warehouseWrittenQty
      if(!visible(order.printFactoryId,'已出库',[order.printOrderNo,record.recordId,order.output.sku],record.factorySubmittedAt))continue
      outboundRecords.push({outboundRecordId:record.recordId,outboundRecordNo:record.handoverRecordNo||record.recordId,warehouseId:defaultWarehouse?.warehouseId||'',warehouseName:defaultWarehouse?.warehouseName||'历史仓库未记录',factoryId:order.printFactoryId,factoryName:order.printFactoryName,factoryKind:'CENTRAL_PRINT',sourceTaskId:getPrintWorkOrderById(order.workOrderId)?.taskId || order.taskNo,sourceTaskNo:order.taskNo,sourceRecordId:order.workOrderId,sourceRecordNo:order.printOrderNo,handoverOrderId:record.handoverId,handoverOrderNo:head?.handoverOrderNo,handoverRecordId:record.recordId,handoverRecordNo:record.handoverRecordNo,receiverKind:'其他接收方',receiverName:order.receivingTargetName||order.handover.receiverName,itemKind:order.output.objectType==='纱线'?'纱线':'面料',itemName:order.output.materialName,materialSku:record.skuCode||order.output.sku,outboundQty:record.submittedQty??0,receiverWrittenQty:receivedQty,differenceQty:receivedQty===undefined?undefined:receivedQty-(record.submittedQty??0),unit:record.qtyUnit||order.output.qtyUnit,operatorName:record.factorySubmittedBy||'历史操作人未记录',outboundAt:record.factorySubmittedAt,status:receivedQty!==undefined&&Math.abs(receivedQty-(record.submittedQty??0))>.01?'差异':receivedQty!==undefined&&receivedQty>=(record.submittedQty??0)?'已回写':'已出库',photoList:[order.output.imageUrl],imageUrl:order.output.imageUrl,relatedWaitHandoverStockItemId:order.workOrderId,workOrderIds:[order.workOrderId],flows:[]})
    }
  }
  const visibleOrders=orders.filter(o=>!filters.factoryId||o.printFactoryId===filters.factoryId)
  const unlocatedOutputByUnit:Record<string,number>={}
  for(const o of visibleOrders){const missing=Math.max(0,o.output.completedQty-o.barcodes.filter(b=>b.quantityConfirmed===true||Boolean(b.handoverRecordId)).reduce((n,b)=>n+b.lengthY,0));if(missing>0){const unit=normalizePrintingUnit(o.output.qtyUnit);unlocatedOutputByUnit[unit]=(unlocatedOutputByUnit[unit]||0)+missing}}
  const factoryIds=unique([...visibleOrders.map(o=>o.printFactoryId),...waitProcessItems.map(i=>i.factoryId)].filter(Boolean))
  return {unlocatedOutputByUnit,factoryIds,taskIds:visibleOrders.map(o=>getPrintWorkOrderById(o.workOrderId)?.taskId||o.taskNo),printOrderIds:visibleOrders.map(o=>o.workOrderId),handoverOrderIds:unique(outboundRecords.map(r=>r.handoverOrderId).filter((id):id is string=>Boolean(id))),waitProcessItems,waitHandoverItems:outputInboundItems.filter(i=>i.waitHandoverQty>0),outputInboundItems,inboundRecords,outboundRecords,usageRecords,warehouses:warehouses.filter(w=>factoryIds.includes(w.factoryId)),nodeRows:factoryIds.flatMap(id=>listFactoryWarehouseNodeRows(id)),stocktakeOrders:[],unknownInputOrders:visibleOrders.filter(o=>o.actualInput.receivedQty>0&&!knownInputOrders.has(o.workOrderId)).length,unknownOutputOrders:visibleOrders.filter(o=>o.output.completedQty>0&&!knownOutputOrders.has(o.workOrderId)).length}
}
