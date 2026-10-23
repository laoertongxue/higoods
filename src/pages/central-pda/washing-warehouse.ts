import { listFactoryInternalWarehouses } from '../../data/fcs/factory-internal-warehouse-locations.ts'
import { listFactoryReceipts, getReceiptMaterialUsed, getHistoricalReceiptPosition } from '../../data/fcs/factory-receiving.ts'
import { readWashingState } from '../../data/fcs/fabric-washing-repository.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import { centralWashingOrders } from './washing-model.ts'
import { ce, cb, centralNotice, centralFormalName, centralTime } from './ui.ts'
import { dyeLocationLabel } from './dye-ui.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { cwt, washingNumber as n, washingUnit } from './washing-ui.ts'
import { washingCard, washingPhoto } from './washing-view.ts'
export interface WashingWarehouseUi {view:'locations'|'receive'|'handoff';kind:'WAIT_PROCESS'|'WAIT_HANDOVER';position:string;limit:number}
export function centralWashingWarehouse(factoryId:string){return withWashingStaticRead(()=>{
 const orders=centralWashingOrders(factoryId),ids=new Set(orders.map(o=>o.id)),receipts=listFactoryReceipts(factoryId).filter(r=>r.lines.some(l=>l.washingOrderId&&ids.has(l.washingOrderId)))
 const inputs=receipts.flatMap(receipt=>receipt.lines.filter(l=>l.washingOrderId&&ids.has(l.washingOrderId)).flatMap(line=>(line.rolls||[]).flatMap(roll=>{
  const unit=roll.unit||line.unit,quantity=(roll.qty??roll.yard)-getReceiptMaterialUsed(line.id,roll.barcode)
  if(quantity<=0)return []
  const warehouseId=roll.warehouseId||line.warehouseId,locationId=roll.locationId||line.locationId,position=getHistoricalReceiptPosition(factoryId,{warehouseId,locationId})
  return [{orderId:line.washingOrderId!,orderNo:orders.find(o=>o.id===line.washingOrderId)!.no,barcode:roll.barcode,unit,quantity,warehouseId,locationId,position,image:line.material.imageUrl,sku:line.material.sku}]
 })))
 const outputs=orders.filter(o=>o.assignedFactoryId===factoryId&&!o.cancelledAt).flatMap(order=>order.rolls.filter(r=>r.completedAt&&!r.handedOutAt).map(roll=>({order,roll})))
 const actions=readWashingState().actions.filter(a=>a.orderId&&ids.has(a.orderId)),handouts=actions.filter(a=>a.action==='HANDOUT'&&orders.find(o=>o.id===a.orderId)?.assignedFactoryId===factoryId)
 return {warehouses:listFactoryInternalWarehouses(factoryId),inputs,outputs,receipts,handouts,orders,actions}
})}
type WashingStock=ReturnType<typeof centralWashingWarehouse>
function stockState(order:WashingStock['orders'][number],lang:CentralPdaLanguage){return order.cancelledAt||order.exception?`<p class="mt-2 font-semibold text-red-700">${cwt(lang,order.cancelledAt?'cancelled':'blocked')}</p>`:''}
function positionName(factoryId:string,warehouseId:string,locationId:string,lang:CentralPdaLanguage){
 const position=getHistoricalReceiptPosition(factoryId,{warehouseId,locationId})
 return dyeLocationLabel(position.area.areaName+' / '+position.shelf.shelfNo+' / '+position.location.locationNo,lang)
}
function receiptHistory(view:WashingStock,receipt:WashingStock['receipts'][number],lang:CentralPdaLanguage){
 const lines=receipt.lines.filter(line=>view.orders.some(order=>order.id===line.washingOrderId))
 return washingCard(lines.map(line=>{
  const order=view.orders.find(order=>order.id===line.washingOrderId)!,outbound=line.washingDirection==='AFTER_WASH'
  const heading=`<strong class="block break-words">${ce(order.no)}</strong><p class="break-words text-sm">${ce(line.material.sku)}</p>`
  const source=`<p class="mt-2 break-words">${cwt(lang,'source')} · ${ce(centralFormalName(line.origin.name,line.origin.id,lang))}</p><p class="break-all text-sm">${ce(line.sourceDocumentNo)}</p>`
  const direction=line.washingDirection?`<p class="text-sm">${cwt(lang,outbound?'washedReturn':'incoming')}</p>`:''
  const rolls=(line.rolls||[]).map(roll=>{
   const original=order.rolls.find(item=>(outbound?item.outputBarcode||item.barcode:item.barcode)===roll.barcode)
   const sent=original&&view.actions.find(action=>action.orderId===order.id&&action.action===(outbound?'HANDOUT':'SEND')&&action.rollIds.includes(original.id))
   return `<div class="mt-3 border-t pt-2"><strong class="block break-all">${ce(roll.barcode)}</strong><p>${n(roll.qty??roll.yard,lang)} ${ce(washingUnit(roll.unit||line.unit))}</p><p class="break-words text-sm">${ce(positionName(receipt.factoryId,roll.warehouseId||line.warehouseId,roll.locationId||line.locationId,lang))}</p>${sent?`<p class="mt-2 text-sm">${cwt(lang,'sender')} · ${ce(centralFormalName(sent.actor.name,sent.actor.id,lang))} · ${ce(centralTime(sent.at,lang))}</p>`:''}</div>`
  }).join('')
  return heading+source+direction+(rolls||`<p>${n(line.qty,lang)} ${ce(washingUnit(line.unit))}</p><p class="break-words text-sm">${ce(positionName(receipt.factoryId,line.warehouseId,line.locationId,lang))}</p>`)
 }).join('')+`<p class="mt-3 text-sm">${cwt(lang,'receiver')} · ${ce(centralFormalName(receipt.operatorName,receipt.operatorId,lang))} · ${ce(centralTime(receipt.receivedAt,lang))}</p>`).replace('<article ',`<article data-central-washing-receipt="${ce(receipt.id)}" `)
}
function handoffHistory(view:WashingStock,action:WashingStock['handouts'][number],lang:CentralPdaLanguage){
 const order=view.orders.find(order=>order.id===action.orderId)!
 return washingCard(`<strong>${ce(order.no)}</strong><p class="break-words">${cwt(lang,'target')} · ${ce(centralFormalName(order.source.target?.name,order.source.target?.id||'',lang))}</p>`+order.rolls.filter(roll=>action.rollIds.includes(roll.id)).map(roll=>{
  const received=view.actions.find(item=>item.orderId===order.id&&item.action==='DOWNSTREAM_RECEIVE'&&item.rollIds.includes(roll.id))
  return `<div class="mt-3 border-t pt-2"><strong class="block break-all">${ce(roll.outputBarcode||roll.barcode)}</strong><p>${cwt(lang,'sent')} · ${n(roll.outputQty!,lang)} ${ce(washingUnit(roll.unit))}</p><p>${roll.downstreamReceivedAt?cwt(lang,'received')+' '+n(roll.downstreamQty!,lang)+' '+ce(washingUnit(roll.unit)):cwt(lang,'awaiting')}</p>${received?`<p class="mt-2 text-sm">${cwt(lang,'receiver')} · ${ce(centralFormalName(received.actor.name,received.actor.id,lang))} · ${ce(centralTime(received.at,lang))}</p>`:''}</div>`
 }).join('')+`<p class="mt-3 text-sm">${cwt(lang,'sender')} · ${ce(centralFormalName(action.actor.name,action.actor.id,lang))} · ${ce(centralTime(action.at,lang))}</p>`).replace('<article ',`<article data-central-washing-handoff="${ce(action.id)}" `)
}
export function renderWashingWarehouse(factoryId:string,ui:WashingWarehouseUi,lang:CentralPdaLanguage){
 const view=centralWashingWarehouse(factoryId),more=()=>cb(lang==='id'?'Lihat berikutnya':'查看更多','washing-more')
 let html=`<div class="grid grid-cols-3 gap-2">${(['locations','receive','handoff']as const).map(key=>cb(cwt(lang,({locations:'locations',receive:'receiveRecords',handoff:'handoffRecords'}as const)[key]),'washing-wh-view',key,key===ui.view)).join('')}</div>`
 if(ui.view==='receive')return html+(view.receipts.slice(0,ui.limit).map(receipt=>receiptHistory(view,receipt,lang)).join('')||centralNotice(cwt(lang,'noRecords')))+(view.receipts.length>ui.limit?more():'')
 if(ui.view==='handoff')return html+(view.handouts.slice().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,ui.limit).map(action=>handoffHistory(view,action,lang)).join('')||centralNotice(cwt(lang,'noRecords')))+(view.handouts.length>ui.limit?more():'')
 html+=`<div class="my-3 grid grid-cols-2 gap-2">${cb(lang==='id'?'Bahan diterima':'待加工仓','washing-wh-kind','WAIT_PROCESS',ui.kind==='WAIT_PROCESS')}${cb(cwt(lang,'ready'),'washing-wh-kind','WAIT_HANDOVER',ui.kind==='WAIT_HANDOVER')}</div>`
 if(ui.kind==='WAIT_HANDOVER')return html+(view.outputs.slice(0,ui.limit).map(({order,roll})=>washingCard(`<div class="flex items-center gap-3">${washingPhoto(order.source.imageUrl,order.source.materialSku)}<div class="min-w-0"><strong class="block break-all">${ce(roll.outputBarcode||roll.barcode)}</strong>${stockState(order,lang)}<span>${n(roll.outputQty!,lang)} ${ce(washingUnit(roll.unit))}</span></div></div><p class="my-2">${cwt(lang,'unknownPosition')}</p><p class="break-words text-sm">${ce(order.no)} · ${cwt(lang,'originRoll')} ${ce(roll.barcode)}</p>`).replace('<article ',`<article data-central-washing-stock="${ce(roll.id)}" `)).join('')||centralNotice(cwt(lang,'noRecords')))+(view.outputs.length>ui.limit?more():'')
 const positions=view.warehouses.filter(warehouse=>warehouse.warehouseKind==='WAIT_PROCESS').flatMap(warehouse=>warehouse.areaList.flatMap(area=>area.shelfList.flatMap(shelf=>shelf.locationList.map(location=>({key:warehouse.warehouseId+'|'+location.locationId,warehouse,area,shelf,location})))))
 const selected=positions.find(position=>position.key===ui.position)
 if(!selected)return html+positions.map(position=>{const rows=view.inputs.filter(item=>item.warehouseId===position.warehouse.warehouseId&&item.locationId===position.location.locationId);return cb(`${dyeLocationLabel(position.area.areaName+' / '+position.shelf.shelfNo+' / '+position.location.locationNo,lang)} · ${rows.length} ${lang==='id'?'rol':'卷'}`,'washing-wh-position',position.key)}).join('')
 const rows=view.inputs.filter(item=>item.warehouseId===selected.warehouse.warehouseId&&item.locationId===selected.location.locationId)
 return html+`<h2 class="my-3 break-words text-lg font-semibold">${ce(dyeLocationLabel(selected.area.areaName+' / '+selected.shelf.shelfNo+' / '+selected.location.locationNo,lang))}</h2>`+cb(lang==='id'?'Pilih lokasi lain':'换库位','washing-wh-position','')+(rows.slice(0,ui.limit).map(row=>washingCard(`<div class="flex items-center gap-3">${washingPhoto(row.image,row.sku)}<div class="min-w-0"><strong class="block break-words">${ce(row.sku)}</strong>${stockState(view.orders.find(order=>order.id===row.orderId)!,lang)}<span>${n(row.quantity,lang)} ${ce(washingUnit(row.unit))}</span></div></div><p class="mt-2 break-all">${ce(row.barcode)}</p><p>${ce(row.orderNo)}</p>`).replace('<article ',`<article data-central-washing-stock="${ce(row.barcode)}" `)).join('')||centralNotice(cwt(lang,'noRecords')))+(rows.length>ui.limit?more():'')
}
