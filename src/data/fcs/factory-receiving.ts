import {getBrowserLocalStorage} from '../browser-storage.ts'
import {listFactoryInternalWarehouses,resolveEnabledFactoryWarehouseLocation,resolveFactoryWarehouseLocation,type ResolvedFactoryWarehouseLocation} from './factory-internal-warehouse-locations.ts'
import {calculateYarnWeight,weightGrams} from './yarn-weight.ts'
import {buildFactoryReceivingDemoSources} from './factory-receiving-mock.ts'
import {DYE_DEMO_DETAILS,DYE_DEMO_PARTNER_SCENARIOS,type DyePartner} from './dye-work-order-demo-details.ts'
import type {FactoryReceivingSource,FactoryReceiptInput,FactoryReceipt,FactoryReceiptLine,FactoryDeliveryNote,FactoryDeliveryLine,ReceivingAllocation,ReceiptPosition} from './factory-receiving-types.ts'
export type * from './factory-receiving-types.ts'
export const FACTORY_RECEIVING_KEY='higood-factory-material-receiving-v1'
interface ReceivingData {version:1;sources:FactoryReceivingSource[];deliveries:FactoryDeliveryNote[];receipts:FactoryReceipt[];allocations:ReceivingAllocation[];defaults:Record<string,ReceiptPosition>;materialUses?:FactoryMaterialUse[]}
let cache:ReceivingData|undefined
const clone=<T>(v:T):T=>structuredClone(v)
function validateStoredReceiving(data:ReceivingData){
 const sourceIds=new Set<string>(),lineIds=new Set<string>(),receiptIds=new Set<string>(),rolls=new Set<string>()
 for(const s of data.sources){if(!s.id||sourceIds.has(s.id)||!s.documentNo||!s.targetFactoryId||!s.targetFactoryName||!s.origin?.id||!s.origin.name||!s.createdAt||!s.createdBy||!Array.isArray(s.lines))throw new Error('来源单据缺少必需值或编号重复，请核对保存记录。');sourceIds.add(s.id);for(const l of s.lines){if(!l.id||lineIds.has(l.id)||!l.material||!l.unit||!l.label||!Array.isArray(l.rolls)||!['sku','name','kind','imageUrl','color','composition','specification','batchNo'].every(k=>String(l.material[k as keyof typeof l.material]||'').trim())||![l.plannedQty,l.sentQty].every(n=>Number.isFinite(n)&&n>=0))throw new Error('来源物料必需字段不完整。');lineIds.add(l.id)}}
 for(const u of data.materialUses??[]){if(!u.id||!(u.dyeOrderId||u.waterOrderId)||!u.factoryId||!u.operatorName||!u.at||!Array.isArray(u.lines)||u.lines.some(l=>!l.receiptLineId||!Number.isFinite(l.qty)||l.qty<=0))throw new Error('用料记录不完整，请保留记录并联系主管。')}
 for(const r of data.receipts){if(!r.id||receiptIds.has(r.id)||!r.factoryId||!r.operatorId||!r.operatorName||!r.receivedAt||!r.fingerprint||!r.lines?.length)throw new Error('接收记录缺少必需值或确认号重复。');receiptIds.add(r.id);for(const l of r.lines){if(!sourceIds.has(l.sourceId)||!lineIds.has(l.sourceLineId)||!Number.isFinite(l.qty)||l.qty<0||!l.locationId||!l.warehouseId||!l.material?.sku)throw new Error('接收明细的来源、数量或库位不完整。');for(const roll of l.rolls||[]){const key=l.sourceId+'|'+roll.barcode;if(rolls.has(key)||!roll.barcode||!(roll.yard>0))throw new Error('已保存的原卷码重复或数量无效。');rolls.add(key)}}}
}
function read():ReceivingData {
 if(cache)return cache
 const raw=getBrowserLocalStorage()?.getItem(FACTORY_RECEIVING_KEY)
 if(raw){const saved=JSON.parse(raw) as ReceivingData;if(saved.version!==1||!['sources','deliveries','receipts','allocations'].every(k=>Array.isArray(saved[k as keyof ReceivingData])))throw new Error('接收记录格式不完整，请保留现场数据并联系主管。');validateStoredReceiving(saved)
  // Only correct the untouched seed association. Existing delivery/receipt facts remain immutable.
  const old=saved.sources.find(s=>s.id==='RCV-SRC-003'),seed=buildFactoryReceivingDemoSources().find(s=>s.id==='RCV-SRC-003')!
  if(old&&!saved.receipts.some(r=>r.lines.some(l=>l.sourceId===old.id))&&!saved.deliveries.some(d=>d.lines.some(l=>l.sourceId===old.id))){
   const corrected=clone(old),line=corrected.lines[0]
   if(line?.dyeOrderId==='DWO-001'){delete line.dyeOrderId;delete line.productionOrderNo;delete line.taskNo;if(JSON.stringify(corrected)===JSON.stringify(seed))saved.sources[saved.sources.indexOf(old)]=corrected}
  }
  cache=saved}
 else cache={version:1,sources:buildFactoryReceivingDemoSources(),deliveries:[],receipts:[],allocations:[],defaults:{}}
 return cache
}
function save(next:ReceivingData){validateStoredReceiving(next);const storage=getBrowserLocalStorage();if(typeof window!=='undefined'&&!storage?.setItem)throw new Error('浏览器无法保存，请保留输入并恢复本地存储后重试。');storage?.setItem?.(FACTORY_RECEIVING_KEY,JSON.stringify(next));cache=next}
export function clearFactoryReceivingCache(){cache=undefined}
export function captureFactoryReceivingData(){return clone(read())}
export function restoreFactoryReceivingData(value:ReturnType<typeof captureFactoryReceivingData>){save(clone(value))}
export function eligibleReceivingSource(s:FactoryReceivingSource):boolean {return !s.voidedAt&&s.lines.length>0&&(s.type==='HANDOUT'?Boolean(s.handedOutAt)&&s.lines.some(l=>l.sentQty>0):Boolean(s.approvedAt))}
export function listFactoryReceivingSources(factoryId?:string, includeIneligible=false){return clone(read().sources.filter(s=>(!factoryId||s.targetFactoryId===factoryId)&&(includeIneligible||eligibleReceivingSource(s))))}
export function getFactoryReceivingSource(id:string){return clone(read().sources.find(s=>s.id===id))}
/** A dye order may receive several batches of its one material from its one supplier. */
export function getDyeReceivingConflict(orderId:string,sku:string,origin:DyePartner):string|undefined {
 const data=read(),demo=DYE_DEMO_DETAILS[orderId],partner=DYE_DEMO_PARTNER_SCENARIOS[orderId]?.upstream
 const sameOrigin=(p:DyePartner)=>p.kind===origin.kind&&p.id===origin.id
 if(demo&&demo.rawSku!==sku)return '一张染色加工单只能关联一种投入物料，请选择相同 SKU 的加工单。'
 if(partner&&!sameOrigin(partner))return '一张染色加工单只能关联一个上游，请选择同一上游的加工单，或保留为备料。'
 const assigned=[...data.sources.flatMap(s=>s.lines.filter(l=>l.dyeOrderId===orderId).map(l=>({sku:l.material.sku,origin:s.origin}))),...data.receipts.flatMap(r=>r.lines.filter(l=>l.dyeOrderId===orderId||data.allocations.some(a=>a.receiptLineId===l.id&&a.dyeOrderId===orderId)).map(l=>({sku:l.material.sku,origin:l.origin})))]
 if(assigned.some(l=>l.sku!==sku))return '一张染色加工单只能关联一种投入物料，请核对本单已有来货。'
 if(assigned.some(l=>!sameOrigin(l.origin)))return '一张染色加工单只能关联一个上游，请核对本单已有来货。'
}
export function registerFactoryReceivingSource(source:FactoryReceivingSource){
 if(!source.id.trim()||!source.documentNo.trim()||!source.targetFactoryId||!source.origin.id||!source.createdBy||!source.createdAt)throw new Error('来源单据、来源组织、收货工厂和建单信息必须完整。')
 for(const l of source.lines){if(!l.id||!l.unit||!l.label||![l.plannedQty,l.sentQty].every(n=>Number.isFinite(n)&&n>=0)||['sku','name','kind','imageUrl','color','composition','specification','batchNo'].some(k=>!String(l.material[k as keyof typeof l.material]||'').trim()))throw new Error('原单物料的标识、图片、规格、批次和数量必须完整。');if(l.material.kind==='FABRIC'&&((source.type==='HANDOUT'&&!l.rolls.length)||l.rolls.some(r=>!r.barcode||!Number.isFinite(r.yard)||r.yard<=0)))throw new Error('面料原单必须有具体卷码和 Yard。')}
 const previous=read().sources.find(s=>s.id===source.id);if(previous&&(previous.type!==source.type||previous.targetFactoryId!==source.targetFactoryId||previous.origin.id!==source.origin.id))throw new Error('已存在的原单身份、收货工厂与上游不可替换。')
 if(previous&&(read().receipts.some(r=>r.lines.some(l=>l.sourceId===source.id))||read().deliveries.some(d=>d.lines.some(l=>l.sourceId===source.id)))){
  for(const old of previous.lines){const next=source.lines.find(l=>l.id===old.id)
   if(!next||JSON.stringify(old.material)!==JSON.stringify(next.material)||old.unit!==next.unit||old.dyeOrderId!==next.dyeOrderId||old.woolOrderId!==next.woolOrderId||old.waterOrderId!==next.waterOrderId||old.sentQty>next.sentQty||old.plannedQty>next.plannedQty||old.rolls.some(r=>!next.rolls.some(n=>n.barcode===r.barcode&&n.yard===r.yard)))throw new Error('已送货或接收的原单不能覆盖物料、归属和已有数量；可追加后续发出数量及新卷码。')
  }
 }
 for(const line of source.lines)if(line.dyeOrderId){const error=getDyeReceivingConflict(line.dyeOrderId,line.material.sku,source.origin);if(error)throw new Error(error);if(source.lines.some(other=>other.dyeOrderId===line.dyeOrderId&&other.material.sku!==line.material.sku))throw new Error('一张染色加工单只能关联一种投入物料。')}
 const next=clone(read());const index=next.sources.findIndex(s=>s.id===source.id)
 if(index>=0){if(JSON.stringify(next.sources[index])===JSON.stringify(source))return;next.sources[index]=clone(source)}else next.sources.push(clone(source))
 save(next)
}
export function approveFactoryTransfer(id:string,operator:string,at:string){const s=getFactoryReceivingSource(id);if(!s||s.type==='HANDOUT'||s.voidedAt)throw new Error('请选择有效的仓库调拨单。');if(!operator.trim()||!at)throw new Error('请确认审核人和时间。');registerFactoryReceivingSource({...s,approvedAt:s.approvedAt||at,approvedBy:s.approvedBy||operator})}
export function confirmFactorySourceHandout(id:string,operator:string,at:string){const s=getFactoryReceivingSource(id);if(!s||s.type!=='HANDOUT'||s.voidedAt||!s.lines.some(l=>l.sentQty>0))throw new Error('交出明细必须包含实际发出数量。');registerFactoryReceivingSource({...s,handedOutAt:s.handedOutAt||at,createdBy:operator})}
function displayPosition(p:ResolvedFactoryWarehouseLocation){const name=({'ID-F003':'GTG','ID-F002':'MJS','OWN_WOOL_FACTORY':'周哥毛织厂'} as Record<string,string>)[p.warehouse.factoryId];return name?{...p,warehouse:{...p.warehouse,factoryName:name,warehouseName:`${name} · ${p.warehouse.warehouseShortName}`}}:p}
export function getFactoryReceiptLocations(factoryId:string):ResolvedFactoryWarehouseLocation[]{return listFactoryInternalWarehouses().filter(w=>w.factoryId===factoryId&&w.warehouseKind==='WAIT_PROCESS'&&w.isEnabled).flatMap(w=>w.areaList.flatMap(a=>a.shelfList.flatMap(s=>s.locationList.map(l=>resolveEnabledFactoryWarehouseLocation(w.warehouseId,l.locationId)).filter((l):l is ResolvedFactoryWarehouseLocation=>Boolean(l))))).map(displayPosition)}
export function getDefaultFactoryReceiptPosition(factoryId:string):ReceiptPosition {
 const saved=read().defaults[factoryId];if(saved){assertReceiptPosition(factoryId,saved);return clone(saved)}
 const first=getFactoryReceiptLocations(factoryId).find(p=>p.warehouse.isDefault&&!['异常区','待确认区'].includes(p.area.areaName))
 if(!first)throw new Error('本厂没有启用的待加工仓库位，请主管先维护库位。')
 return {warehouseId:first.warehouse.warehouseId,locationId:first.location.locationId}
}
export function assertReceiptPosition(factoryId:string,p:ReceiptPosition){const resolved=resolveEnabledFactoryWarehouseLocation(p.warehouseId,p.locationId);if(!resolved||resolved.warehouse.factoryId!==factoryId||resolved.warehouse.warehouseKind!=='WAIT_PROCESS')throw new Error('请选择本厂已启用的待加工仓库位。');return displayPosition(resolved)}
export function getHistoricalReceiptPosition(factoryId:string,p:ReceiptPosition){const resolved=resolveFactoryWarehouseLocation(p.warehouseId,p.locationId);if(!resolved||resolved.warehouse.factoryId!==factoryId)throw new Error('原入库位置不存在，请保留原单并联系主管核查。');return displayPosition(resolved)}
export function setDefaultFactoryReceiptPosition(factoryId:string,p:ReceiptPosition){assertReceiptPosition(factoryId,p);const next=clone(read());next.defaults[factoryId]=p;save(next)}
export function listFactoryReceipts(factoryId?:string){return clone(read().receipts.filter(r=>!factoryId||r.factoryId===factoryId))}
export function getSourceActualReceipts(sourceId:string){return listFactoryReceipts().flatMap(r=>r.lines.filter(l=>l.sourceId===sourceId).map(l=>({receiptId:r.id,receivedAt:r.receivedAt,receivedBy:r.operatorName,factoryId:r.factoryId,...l})))}
export function listFactoryDeliveryNotes(){return clone(read().deliveries)}
export function createFactoryDeliveryNote(input:{id:string;deliveredAt:string;createdBy:string;lines:Omit<FactoryDeliveryLine,'id'>[]}):FactoryDeliveryNote {
 const existing=read().deliveries.find(d=>d.id===input.id)
 const note:FactoryDeliveryNote={...clone(input),barcode:`DLV:${input.id}`,lines:input.lines.map((l,i)=>({...l,id:`${input.id}-L${i+1}`}))}
 if(existing){if(JSON.stringify(existing)!==JSON.stringify(note))throw new Error('同一送货单号已用于其他明细。');return clone(existing)}
 if(!input.id.trim()||!input.createdBy.trim()||!input.deliveredAt||!input.lines.length)throw new Error('请填写送货单号、送货人、时间并选择本次货物。')
 const used=new Set<string>(), scheduledHere=new Map<string,number>()
 for(const l of note.lines){const s=getFactoryReceivingSource(l.sourceId),line=s?.lines.find(x=>x.id===l.sourceLineId)
  if(!s||!eligibleReceivingSource(s)||!line)throw new Error('送货明细必须来自审核通过的仓库单或有效交出单。')
  if(!Number.isFinite(l.qty)||l.qty<=0||!l.unit.trim())throw new Error('请填写本次送货数量和单位。')
  if(l.unit!==line.unit)throw new Error('本次送货必须保留原单业务单位。')
  if(line.material.kind==='FABRIC'){
   if(!l.rollBarcodes.length)throw new Error('面料送货必须带卷码。')
   for(const barcode of l.rollBarcodes){const key=`${s.id}|${barcode}`;if(!line.rolls.some(r=>r.barcode===barcode)||used.has(key)||read().deliveries.some(d=>d.lines.some(x=>x.sourceId===s.id&&x.rollBarcodes.includes(barcode))))throw new Error('卷码不属于本单，或已安排在另一次送货中。');used.add(key)}
   const yards=line.rolls.filter(r=>l.rollBarcodes.includes(r.barcode)).reduce((n,r)=>n+r.yard,0);const qty=['米','m'].includes(line.unit)?yards*.9144:yards
   if(Math.abs(l.qty-qty)>.00001)throw new Error('本次送货数量应等于选中卷的长度合计。')
  }
  const scheduled=read().deliveries.flatMap(d=>d.lines).filter(x=>x.sourceId===l.sourceId&&x.sourceLineId===l.sourceLineId).reduce((n,x)=>n+x.qty,0)
  const lineKey=`${l.sourceId}|${l.sourceLineId}`;if(scheduledHere.has(lineKey))throw new Error('同一原单物料行请合并为一条送货明细。');const here=scheduledHere.get(lineKey)||0;scheduledHere.set(lineKey,here+l.qty)
  if(l.qty+scheduled+here>line.sentQty+.000001)throw new Error('本次送货不能超过原单实际发出后尚未安排的数量。')
 }
 const next=clone(read());next.deliveries.push(note);save(next);return clone(note)
}
export function resolveFactoryReceiptScan(code:string,factoryId:string){const value=code.trim();const d=read().deliveries.find(d=>d.id===value||d.barcode===value);const ids=d?[...new Set(d.lines.map(l=>l.sourceId))]:read().sources.filter(s=>s.id===value||s.documentNo===value||s.workOrderNo===value||s.lines.some(l=>l.label===value||l.rolls.some(r=>r.barcode===value))).map(s=>s.id);const sources=listFactoryReceivingSources(factoryId).filter(s=>ids.includes(s.id));if(!sources.length)throw new Error('未找到本厂可接收单据，请核对送货单号和收货工厂。');return {delivery:d?clone(d):undefined,sources,otherFactoryCount:ids.length-sources.length}}
export function prepareFactoryReceipt(input:FactoryReceiptInput):FactoryReceipt {
 const fingerprint=JSON.stringify(input),existing=read().receipts.find(r=>r.id===input.id)
 if(existing){if(existing.fingerprint!==fingerprint)throw new Error('同一确认号已保存其他数量，请重新打开接收。');return clone(existing)}
 if(!input.id.trim()||!input.factoryId||!input.operatorName.trim()||!input.operatorId.trim()||!input.receivedAt||!input.lines.length)throw new Error('请确认接收工厂、接收人、时间和本次实收明细。')
 const delivery=input.deliveryId?read().deliveries.find(d=>d.id===input.deliveryId):undefined
 if(input.deliveryId&&!delivery)throw new Error('送货单不存在。')
 const used=new Set<string>(), usedLines=new Set<string>()
 const lines=input.lines.map((l,i):FactoryReceiptLine=>{
  const s=getFactoryReceivingSource(l.sourceId),line=s?.lines.find(x=>x.id===l.sourceLineId)
  if(!s||!eligibleReceivingSource(s)||s.targetFactoryId!==input.factoryId||!line)throw new Error('来货不属于本厂，或原单尚未审核/交出/已作废。')
  if(line.dyeOrderId){const error=getDyeReceivingConflict(line.dyeOrderId,line.material.sku,s.origin);if(error)throw new Error(error)}
  const dl=delivery?.lines.find(x=>x.id===l.deliveryLineId&&x.sourceId===s.id&&x.sourceLineId===line.id)
  if(delivery&&!dl)throw new Error('本次物料不属于所扫送货单。')
  const lineKey=`${l.sourceId}|${l.sourceLineId}`;if(usedLines.has(lineKey))throw new Error('同一来源行请合并填写一次，各卷可分别选库位。');usedLines.add(lineKey)
  assertReceiptPosition(input.factoryId,l)
  let qty:number,unit:'Yard'|'kg',yarn:FactoryReceiptLine['yarn']
  if(line.material.kind==='FABRIC'){
   if(!Array.isArray(l.rolls))throw new Error('请填写原卷码和实收 Yard，未收到请明确选择零接收。')
   for(const roll of l.rolls){const key=`${s.id}|${roll.barcode}`;if(!line.rolls.some(r=>r.barcode===roll.barcode)||(dl&&!dl.rollBarcodes.includes(roll.barcode)))throw new Error('卷码不属于本次来货，请核对原单和物料。');if(used.has(key)||read().receipts.some(r=>r.lines.some(x=>x.sourceId===s.id&&x.rolls?.some(y=>y.barcode===roll.barcode))))throw new Error('本段来货的卷码已经接收，不能重复入库。');used.add(key);if(!Number.isFinite(roll.yard)||roll.yard<=0)throw new Error('实收卷的 Yard 必须大于 0。');assertReceiptPosition(input.factoryId,roll)}
   qty=l.rolls.reduce((sum,r)=>sum+r.yard,0);unit='Yard'
  }else if(line.material.kind==='ACCESSORY'){if(l.weightKg===undefined)throw new Error('请填写实收重量，未收到请明确填写 0。');qty=weightGrams(l.weightKg)/1000;unit='kg'}
  else{if(l.grossKg===undefined||!l.tubes||l.pcs===undefined)throw new Error('请填写筒数、毛重和各管型数量。');yarn=calculateYarnWeight(l.grossKg,l.tubes,l.pcs);qty=yarn.netGrams/1000;unit='kg'}
  if(line.material.kind==='ACCESSORY'&&convertReceiptQuantity(qty,'kg',line.unit)===undefined){if(l.businessUnit!==line.unit||!Number.isFinite(l.businessQty)||l.businessQty!<0||((qty===0)!==(l.businessQty===0)))throw new Error('请同时填写实收重量和原单单位的实测数量，零接收两项均填 0。')}
  return {...clone(l),id:`${input.id}-L${i+1}`,material:clone(line.material),qty,unit,yarn,sourceDocumentNo:s.documentNo,sourceType:s.type,origin:clone(s.origin),dyeOrderId:line.dyeOrderId,waterOrderId:line.waterOrderId,woolOrderId:line.woolOrderId,productionOrderNo:line.productionOrderNo,taskNo:line.taskNo}
 });return {...clone(input),lines,fingerprint}
}
/** One persisted receipt is the source of the warehouse and order views. */
export function savePreparedFactoryReceipt(receipt:FactoryReceipt){const checked=prepareFactoryReceipt(JSON.parse(receipt.fingerprint));if(JSON.stringify(checked)!==JSON.stringify(receipt))throw new Error('复核内容已变化，请重新核对本次接收。');const next=clone(read());if(next.receipts.some(r=>r.id===receipt.id))return;next.receipts.push(clone(checked));save(next)}
export function listReceivingAllocations(){return clone(read().allocations)}
export function allocateFactoryReceivedMaterial(input:ReceivingAllocation){
 const existing=read().allocations.find(a=>a.id===input.id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(input))throw new Error('分配确认号已使用。');return}
 const line=read().receipts.flatMap(r=>r.lines).find(l=>l.id===input.receiptLineId)
 if(!line||line.dyeOrderId||line.waterOrderId||line.woolOrderId)throw new Error('请选择尚未直接关联加工单的备料实收明细。')
 if(!Number.isFinite(input.qty)||input.qty<=0||!input.operatorName.trim()||!input.at||[input.dyeOrderId,input.waterOrderId,input.woolOrderId].filter(Boolean).length!==1)throw new Error('请填写分配数量并选择一个加工单。')
 const allocated=read().allocations.filter(a=>a.receiptLineId===line.id).reduce((n,a)=>n+a.qty,0)
 if(allocated+input.qty>line.qty+.000001)throw new Error('分配数量不能超过该明细尚未分配的实收量。')
 if(input.dyeOrderId){const error=getDyeReceivingConflict(input.dyeOrderId,line.material.sku,line.origin);if(error)throw new Error(error)}
 const next=clone(read());next.allocations.push(clone(input));save(next)
}

/** Actual cutting/processing usage, in the receipt's physical unit. */
export interface FactoryMaterialUse {
 id:string; dyeOrderId?:string; waterOrderId?:string; factoryId:string; operatorName:string; at:string;
 lines:Array<{receiptLineId:string;barcode?:string;qty:number;unit:'Yard'|'kg'}>
}
export function listFactoryMaterialUses(){return clone(read().materialUses ?? [])}
export function convertReceiptQuantity(qty:number,from:string,to:string):number|undefined {
 const canonical=(u:string)=>['米','m'].includes(u)?'m':['Yard','yard','YARD','y'].includes(u)?'Yard':['kg','公斤'].includes(u)?'kg':u
 const a=canonical(from),b=canonical(to)
 return a===b?qty:a==='Yard'&&b==='m'?qty*.9144:a==='m'&&b==='Yard'?qty/.9144:undefined
}
export function getReceiptMaterialUsed(receiptLineId:string,barcode?:string){
 return listFactoryMaterialUses().flatMap(u=>u.lines).filter(l=>l.receiptLineId===receiptLineId&&(barcode===undefined||l.barcode===barcode)).reduce((n,l)=>n+l.qty,0)
}
export function recordFactoryMaterialUsage(input:{id:string;dyeOrderId?:string; waterOrderId?:string;factoryId:string;operatorName:string;at:string;qty:number;unit:string;materialSku?:string;legacyAvailableQty:number}):void {
 const data=read(),uses=data.materialUses??[]
 if(uses.some(u=>u.id===input.id))throw new Error('本批用料已登记，请勿重复开工。')
 if(!(input.qty>0)||!Number.isFinite(input.qty))throw new Error('请填写本批实际投入数量。')
 const belongs=(o:{dyeOrderId?:string;waterOrderId?:string})=>Boolean(input.dyeOrderId&&o.dyeOrderId===input.dyeOrderId||input.waterOrderId&&o.waterOrderId===input.waterOrderId)
 const convert=(qty:number,line:FactoryReceiptLine,to:string)=>convertReceiptQuantity(qty,line.unit,to)??(line.businessUnit===to&&line.businessQty!==undefined&&line.qty>0?qty/line.qty*line.businessQty:undefined)
 const candidates=data.receipts.filter(r=>r.factoryId===input.factoryId).flatMap(r=>r.lines.map(line=>({line,quota:belongs(line)?line.qty:data.allocations.filter(a=>a.receiptLineId===line.id&&belongs(a)).reduce((n,a)=>n+a.qty,0)}))).filter(x=>x.quota>0&&convert(x.quota,x.line,input.unit)!==undefined)
 const skus=new Set(candidates.map(x=>x.line.material.sku))
 if(input.dyeOrderId&&skus.size>1)throw new Error('一张染色加工单只能使用一种投入物料，请先核对已有来货关联。')
 if(skus.size>1&&!input.materialSku)throw new Error('本单存在多个投入 SKU，请填写本批实际使用的物料 SKU。')
 if(input.materialSku&&!skus.has(input.materialSku))throw new Error('所选物料尚无本单可用实收库存。')
 const lines:FactoryMaterialUse['lines']=[]
 let remaining=input.qty
 for(const {line,quota} of candidates.filter(x=>!input.materialSku||x.line.material.sku===input.materialSku)){
  const orderUsed=uses.filter(u=>belongs(u)).flatMap(u=>u.lines).filter(l=>l.receiptLineId===line.id).reduce((n,l)=>n+l.qty,0)
  let availableQuota=Math.max(0,quota-orderUsed)
  const splits=line.rolls?.length?line.rolls.map(r=>({barcode:r.barcode,qty:r.yard})):[{barcode:undefined,qty:line.qty}]
  for(const split of splits){
   const used=uses.flatMap(u=>u.lines).filter(l=>l.receiptLineId===line.id&&l.barcode===split.barcode).reduce((n,l)=>n+l.qty,0)
   const qty=Math.min(Math.max(0,split.qty-used),availableQuota,(convertReceiptQuantity(remaining,input.unit,line.unit)??(line.businessUnit===input.unit&&line.businessQty?remaining/line.businessQty*line.qty:0)))
   if(qty>1e-8){lines.push({receiptLineId:line.id,barcode:split.barcode,qty,unit:line.unit});availableQuota-=qty;remaining-=convert(qty,line,input.unit)!}
  }
 }
 if(remaining>Math.max(0,input.materialSku?0:input.legacyAvailableQty)+.000001)throw new Error('本批投入超过本单所选物料的可用实收库存，请核对接收和已用数量。')
 const next=clone(data);next.materialUses=[...uses,{id:input.id,dyeOrderId:input.dyeOrderId,waterOrderId:input.waterOrderId,factoryId:input.factoryId,operatorName:input.operatorName,at:input.at,lines}];save(next)
}
