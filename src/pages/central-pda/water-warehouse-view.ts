// @page-pattern: pda
import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, ct, centralNotice, centralTime, centralFormalName } from './ui.ts'
import { dyeLocationLabel, dyePartnerLabel } from './dye-ui.ts'
import { waterNumber as number, waterUnit, waterStatus, wt } from './water-ui.ts'
import { centralWaterWarehouse } from './water-warehouse-model.ts'

export interface WaterWarehouseUi {view:'locations'|'receiveRecords'|'handoffRecords';kind:'WAIT_PROCESS'|'WAIT_HANDOVER';location:string;limit:number}
const card=(body:string)=>`<article class="my-3 rounded-xl border border-slate-200 bg-white p-3">${body}</article>`
const amount=(qty:number,unit:string,lang:CentralPdaLanguage)=>`${number(qty,lang)} ${ce(waterUnit(unit))}`
const person=(name:string|undefined,id:string|undefined,lang:CentralPdaLanguage)=>id?centralFormalName(name,id,lang):name||'—'
function positionName(position:ReturnType<typeof centralWaterWarehouse>['incoming'][number]['position'],lang:CentralPdaLanguage){return dyeLocationLabel(`${position.area.areaName} / ${position.shelf.shelfNo} / ${position.location.locationNo}`,lang)}
function image(src:string,sku:string,lang:CentralPdaLanguage){if(!src)return `<span class="block text-sm text-red-700">${ct(lang,'noPhoto')}</span>`;return `<button type="button" data-central-action="water-photo" data-central-value="${ce(src)}" data-central-photo-label="${ce(sku)}" class="float-left mr-3 h-14 w-14 shrink-0 rounded-lg border"><img data-central-water-photo src="${ce(src)}" alt="${ce(sku)}" class="h-full w-full object-contain"></button>`}
function more(total:number,limit:number,lang:CentralPdaLanguage){return total>limit?cb(ct(lang,'more'),'water-wh-more'):''}
export function renderCentralWaterWarehouse(factoryId:string,ui:WaterWarehouseUi,lang:CentralPdaLanguage){
  const data=centralWaterWarehouse(factoryId),t=(key:Parameters<typeof ct>[1])=>ct(lang,key)
  let html=`<div class="grid grid-cols-3 gap-2">${(['locations','receiveRecords','handoffRecords'] as const).map(view=>cb(t(view),'water-wh-view',view,ui.view===view)).join('')}</div>`
  if(ui.view==='receiveRecords'){
    const rows=data.incoming.slice(0,ui.limit)
    return html+(rows.map(row=>card(`<strong class="block break-words">${ce(row.line.sourceDocumentNo)}</strong><p class="break-words text-sm">${ce(row.line.material.sku)} · ${ce(row.line.material.batchNo)}</p><p class="my-2 text-xl font-bold">${amount(row.line.qty,row.line.unit,lang)}</p><p class="break-words">${t('source')} · ${ce(dyePartnerLabel(row.line.origin,lang))}</p>${row.orders.map(order=>`<p class="break-words">${ce(order.fact.order.waterOrderNo)}${order.allocated===undefined?'':` · ${lang==='id'?'Dialokasikan':'分配'} ${amount(order.allocated,row.line.unit,lang)}`}</p>`).join('')}<p class="break-words">${ce(positionName(row.position,lang))}</p><p class="mt-2 text-sm">${t('receiver')} · ${ce(centralFormalName(row.receipt.operatorName,row.receipt.operatorId,lang))}</p><p class="text-sm">${ce(centralTime(row.receipt.receivedAt,lang))}</p>`)).join('')||centralNotice(t('noRecords')))+more(data.incoming.length,ui.limit,lang)
  }
  if(ui.view==='handoffRecords'){
    return html+(data.outgoing.slice(0,ui.limit).map(row=>card(`<strong class="block break-words">${ce(row.fact.order.waterOrderNo)}</strong><p class="break-all text-sm">${ce(row.doc.id)}</p><p class="break-words text-sm">${ce(row.line.sku)}</p><p class="my-2 text-xl font-bold">${t('handed')} ${amount(row.sent,row.line.unit,lang)}</p><p class="break-words">${t('target')} · ${ce(dyePartnerLabel(row.line.partner,lang))}</p><p>${row.actual===undefined?wt(lang,'awaiting'):`${t('actual')} ${amount(row.actual,row.line.unit,lang)}`}</p><p class="mt-2 text-sm">${t('sender')} · ${ce(person(row.sender,row.senderId,lang))} · ${ce(centralTime(row.doc.handedOverAt||'',lang))}</p>${row.receivedAt?`<p class="text-sm">${t('receiver')} · ${ce(person(row.receiver,undefined,lang))} · ${ce(centralTime(row.receivedAt,lang))}</p>`:''}`)).join('')||centralNotice(t('noRecords')))+more(data.outgoing.length,ui.limit,lang)
  }
  html+=`<div class="my-3 grid grid-cols-2 gap-2">${cb(t('waitProcess'),'water-wh-kind','WAIT_PROCESS',ui.kind==='WAIT_PROCESS')}${cb(t('waitHandover'),'water-wh-kind','WAIT_HANDOVER',ui.kind==='WAIT_HANDOVER')}</div>`
  const warehouses=data.warehouses.filter(warehouse=>warehouse.warehouseKind===ui.kind)
  html+=warehouses.map(warehouse=>warehouse.areaList.map(area=>`<section class="my-3"><h2 class="font-bold">${ce(dyeLocationLabel(area.areaName,lang))}</h2><div class="mt-2 grid grid-cols-2 gap-2">${area.shelfList.flatMap(shelf=>shelf.locationList.map(location=>{
    const key=warehouse.warehouseId+'|'+location.locationId,stopped=!warehouse.isEnabled||[area.status,shelf.status,location.status].includes('STOPPED')
    const rows=ui.kind==='WAIT_PROCESS'?data.stock.filter(row=>row.position.warehouse.warehouseId===warehouse.warehouseId&&row.position.location.locationId===location.locationId):[]
    return cb(`${dyeLocationLabel(shelf.shelfNo+' / '+location.locationNo,lang)}${stopped?' · '+t('locationStopped'):''}`,'water-wh-location',key,key===ui.location)+(key===ui.location?`<div class="col-span-2">${rows.map(row=>card(`${image(row.line.material.imageUrl,row.line.material.sku,lang)}<strong class="block break-words">${ce(row.order.waterOrderNo)}</strong><p class="break-words text-sm">${ce(row.line.material.sku)}</p><p class="my-2 font-bold">${lang==='id'?'Tersedia untuk order':'本单可用'} ${amount(row.qty,row.line.unit,lang)}</p><p class="clear-both break-words text-sm">${ce(row.line.material.batchNo)} · ${ce(row.line.sourceDocumentNo)}</p>`)).join('')||centralNotice(t('noStock'))}</div>`:'')
  })).join('')}</div></section>`).join('')).join('')
  if(!warehouses.length)html+=centralNotice(t('noRecords'))
  if(ui.kind==='WAIT_HANDOVER'&&data.outputs.length)html+=`<h2 class="my-3 font-bold">${wt(lang,'unlocated')}</h2>`+data.outputs.slice(0,ui.limit).map(row=>card(`${image(row.fact.image?.material||'',row.fact.order.materialCode,lang)}<strong class="block break-words">${ce(row.fact.order.waterOrderNo)}</strong><p class="break-words text-sm">${ce(row.fact.order.materialCode)}</p><p class="text-sm">${waterStatus(row.fact.order.status,lang)}</p><div class="clear-both pt-2">${row.rolls.map(roll=>`<div class="my-2 border-t pt-2"><p class="break-all text-sm">${ce(roll.barcode)}</p><strong>${amount(roll.qty,row.fact.order.qtyUnit,lang)}</strong><p class="text-sm">${roll.reservedBy?(lang==='id'?'Ada di dokumen kirim':'已加入交出单'):roll.printedAt?(lang==='id'?'Label sudah dicetak':'标签已打印'):(lang==='id'?'Label belum dicetak':'待打印标签')}</p></div>`).join('')}${row.unregistered>0.000001?`<p>${lang==='id'?'Belum dicatat per rol':'未登记卷码'} · ${amount(row.unregistered,row.fact.order.qtyUnit,lang)}</p>`:''}</div>`)).join('')+more(data.outputs.length,ui.limit,lang)
  return html
}
