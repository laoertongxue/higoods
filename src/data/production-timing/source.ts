/** Static cross-module source records for the accepted production timing prototype.
 * Ordinary reads never seed browser business storage. Records are identified by their native document IDs.
 */
import fixtures from './fixtures.json'
export const TIMING_AS_OF='2026-10-07 09:00'
export const TIMING_IMAGE='/images/production-timing/shirt-086.jpg'
const DAY=86400000
export interface TimingDocument {
 id:string;no:string;type:string;status:string;object:string;quantity:number|null;unit:string;
 times:Record<string,string|null>;quantities?:Record<string,number|null>;
 executor:string;receiver:string;production:string|null;style:string;related:string[];
 clock?:{kind:string;start:string|null;end:string|null;days?:number};module?:string;note?:string;ownerId?:string;
 taskId?:string;batchId?:string;executionScope?:string;processingLocation?:string;processItems?:string[];sourceType?:string;
 [key:string]:any
}
export interface TimingCase {
 id:string;key:string;title:string;order:string|null;style:string;merch:string;coordinator:string|null;
 purchases:{id:string;at:string;qty:number;documentId:string}[];
 warehouse:number|null;warehouseAt:string|null;tasks:any[];imageUrl:string;sceneLabel:string;
 [key:string]:any
}
export interface TimingBranch {docs:Record<string,TimingDocument>;materials:any[];parts:any[];prep:any[];factorySamples:any[];[key:string]:any}
const entries=fixtures as unknown as {order:TimingCase;branch:TimingBranch;issues:any[]}[]
export const TIMING_SCENES=Object.fromEntries(entries.map(e=>[e.order.key,e.order.sceneLabel]))
export function listTimingCases():TimingCase[]{return entries.map(e=>e.order)}
export function getTimingCaseByScene(scene:string):TimingCase { const entry=entries.find(e=>e.order.key===scene);if(!entry)throw new Error('未找到对应生产单场景');return entry.order }
export function findTimingCase(id:string):TimingCase|undefined{return entries.find(e=>e.order.id===id)?.order}
export function getTimingBranch(order:TimingCase):TimingBranch|null{return entries.find(e=>e.order.id===order.id)?.branch??null}
export function getTimingIssues(order:TimingCase):any[]{return entries.find(e=>e.order.id===order.id)?.issues??[]}
export function timingCaseHref(order:TimingCase):string{return '/dds/supply-chain/production-fulfillment/'+(order.order?'orders/':'pending-purchases/')+encodeURIComponent(order.id)}
export function timingMs(value:string):number{return Date.parse(value.replace(' ','T')+(value.length===16?':00':'')+'+08:00')}
export function timingDuration(value:number):string{const minutes=Math.floor(Math.abs(value)/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;return (days?days+'天':'')+(hours?hours+'小时':'')+(rest?rest+'分钟':'')||'不足1分钟'}
/** Completion is the clock's own endpoint: handing goods out does not complete receipt. */
export function timingClockHasCompletionFact(document:{status:string;clock?:{kind:string;start:string|null;end:string|null}},clock=document.clock):boolean{
 if(!clock)return false
 if(clock.end)return true
 if(/交接|调拨/.test(clock.kind))return /已接收|已全部接收|已入库|接收入库|交接完成/.test(document.status)
 if(/采购到仓/.test(clock.kind))return /已入仓|已入库|入库完成|已收齐入库/.test(document.status)
 return /已完成|加工完成|车缝完成|烫包完成|质检完成|复检完成|已质检|已复检|裁剪完成|制作完成|后道完成/.test(document.status)
}
export function timingReceiptTotal(task:TimingCase['tasks'][number]):number{return task.receipts.filter((r:any)=>timingMs(r.at)<=timingMs(TIMING_AS_OF)).reduce((sum:number,r:any)=>sum+r.qty,0)}
export function getTimingFacts(c:TimingCase):any{
 const required=c.purchases.reduce((s,p)=>s+p.qty,0),first=c.purchases.slice().sort((a,b)=>timingMs(a.at)-timingMs(b.at))[0],deadline=timingMs(first.at)+28*DAY,held=c.tasks.reduce((s,t)=>s+t.held,0),received=c.tasks.reduce((s,t)=>s+timingReceiptTotal(t),0)
 const complete=c.warehouse!==null&&c.warehouse>=required,remaining=c.warehouse===null?null:Math.max(0,required-c.warehouse),conflicts:string[]=[]
 let balance:any=null
 if(remaining!==null){const waiting=c.key==='late'?required:c.waitingConfirmed||0;balance={factory:complete?0:Math.max(0,held-received),processing:complete?0:(c.processing?.qty||0),handover:complete?0:(c.inbound&&!c.inbound.in?c.inbound.qty:0),unknown:complete||waiting?0:Math.max(0,required-held),waiting:complete?0:waiting,position:0};const known=Object.values(balance).reduce<number>((s,n)=>s+Number(n),0);balance.position=Math.max(0,remaining-known);if(known>remaining)conflicts.push('位置记录合计超过未入库量，可能重复或未更新，需核对');if(complete&&(held>received||c.processing||c.inbound&&!c.inbound.in))conflicts.push('成衣仓已全量入库，上游任务或批次仍保留旧未完成记录');if(c.warehouse!>required)conflicts.push('实际入库量超过采购应完成量，需核对数量来源')}
 const result=c.warehouse===null?'入库数量待核实，完成结果无法判定':complete?(c.warehouseAt?(timingMs(c.warehouseAt)<=deadline?'已全部入库 · 按期':'已全部入库 · 晚'+timingDuration(timingMs(c.warehouseAt)-deadline)):'已全部入库 · 是否按期待核实'):(timingMs(TIMING_AS_OF)>deadline?'未全部入库 · 已超时'+timingDuration(timingMs(TIMING_AS_OF)-deadline)+' · 仍有'+remaining+'件未完成':'未全部入库 · 截止未到')
 return {required,first,deadline,held,received,remaining,balance,result,complete,conflicts}
}
const documentIndex=new Map<string,{document:TimingDocument;order:TimingCase;branch:TimingBranch}>()
for(const entry of entries)for(const document of Object.values(entry.branch.docs))documentIndex.set(document.id,{document,order:entry.order,branch:entry.branch})
export function findTimingDocument(id:string){return documentIndex.get(id)}
/** Native module detail route; source summaries and module pages read this same record. */
export function timingDocumentHref(id:string):string{
 const d=documentIndex.get(id)?.document;if(!d)return ''
 const workPath=(record:TimingDocument):string|null=>{
  if(/大货染色加工/.test(record.type))return '/fcs/craft/dyeing/work-orders'
  if(/大货印花加工/.test(record.type))return '/fcs/craft/printing/work-orders'
  if(/水洗加工/.test(record.type))return '/fcs/craft/washing/work-orders'
  if(/后道加工/.test(record.type))return '/fcs/craft/post-finishing/work-orders'
  if(/绣花加工/.test(record.type))return '/fcs/process-factory/special-craft/aux-op-embroidery/work-orders'
  if(/打揽加工/.test(record.type))return '/fcs/process-factory/special-craft/aux-op-dalan/work-orders'
  if(/模版机加工/.test(record.type))return '/fcs/process-factory/special-craft/spc-op-template-process/work-orders'
  if(/裁剪单/.test(record.type))return '/fcs/craft/cutting/cut-orders'
  return null
 }
 const relatedWorkPath=():string|null=>{
  const seen=new Set<string>([d.id])
  const walk=(relatedId:string,depth:number):string|null=>{
   if(seen.has(relatedId)||depth>3)return null;seen.add(relatedId)
   const related=documentIndex.get(relatedId)?.document;if(!related)return null
   const direct=workPath(related);if(direct)return direct
   for(const next of related.related){const path=walk(next,depth+1);if(path)return path}
   return null
  }
  for(const relatedId of d.related){const path=walk(relatedId,0);if(path)return path}
  return null
 }
 let path='/fcs/production/records'
 if(d.type==='生产单')path='/fcs/production/orders'
 else if(['车缝执行单','承包裁剪执行单','工厂烫包执行单'].includes(d.type))path='/fcs/sewing-outsourcing/tasks'
 else if(d.type==='后道质检单')path='/fcs/craft/post-finishing/qc-orders'
 else if(d.type==='后道复检单')path='/fcs/craft/post-finishing/recheck-orders'
 else if(d.type==='后道交货单')path='/fcs/craft/post-finishing/outbound-orders'
 else if(d.type==='后道实收记录')path='/fcs/craft/post-finishing/factory-returns'
 else if(d.type==='商品采购单')path='/pms/product-purchase-orders'
 else if(d.type==='中转仓接收单')path='/wls/transit/receive-manage'
 else if(d.type==='中转仓人工配料任务')path='/wls/transit/allocation-manage'
 else if(d.type==='裁床领料单')path='/wls/transit/outbound-manage'
 else if(/物料采购/.test(d.type))path='/pms/material-purchase-orders'
 else if(/辅料下单/.test(d.type))path='/pcs/production-preparation/purchase'
 else if(/生产准备单|BOM/.test(d.type))path='/pcs/production-preparation/orders'
 else if(/调色/.test(d.type))path='/pcs/production-preparation/color'
 else if(/花型/.test(d.type))path='/pcs/production-preparation/artwork'
 else if(/纸样|制版/.test(d.type))path='/pcs/production-preparation/plate-making'
 else if(/技术包/.test(d.type))path='/pcs/production-preparation/tech-pack'
 else if(/首单样衣/.test(d.type))path='/pcs/production-preparation/first-sample'
 else if(/设计改款/.test(d.type))path='/pcs/production-preparation/design-revision'
 else if(/销售展示/.test(d.type))path='/pcs/production-preparation/display-sample'
 else if(/成衣仓|成衣入库/.test(d.type))path='/wls/finished-inbound'
 else if(/原料入库/.test(d.type))path='/wls/raw/inbound-list'
 else if(/调拨/.test(d.type))path='/wls/raw/stock/'+(/辅料仓/.test(d.executor)?'accessory-transfer':'fabric-transfer')
 else if(/合同|车缝任务/.test(d.type))path='/fcs/dispatch/workbench'
 else if(/领料/.test(d.type))path='/fcs/craft/factory-receiving'
 else if(/产前.*样衣/.test(d.type))path='/fcs/production/pre-production-samples'
 else if(/裁片放行/.test(d.type))path='/fcs/craft/cutting/cut-piece-release'
 else if(workPath(d))path=workPath(d)!
 else if(/交出|接收|质检交接|交接单/.test(d.type))path=(relatedWorkPath()??'/fcs/production').replace(/\/(?:work-orders|cut-orders)$/,'')+'/handover-records'
 return path+'/'+encodeURIComponent(d.id)
}
/** Diagram-local node aliases resolve to the same registered native documents. */
export function getTimingDiagramBranch(order:TimingCase):TimingBranch|null{
 if(order.key==='unknown')return null
 const b=getTimingBranch(order);if(!b)return null
 return {...b,docs:new Proxy(b.docs,{get(target,key:string){return target[key]??Object.values(target).find(d=>d.id.endsWith('/'+key))}})}
}

/** Current garment position labels are shared by the monitoring graph and native document pages. */
export function timingPostPositionLabel(position: string, processingStatus?:string): string {
  if(position==='processing'&&processingStatus==='待后道')return '待后道加工'
  return ({ qc: '待质检／质检中', processing: '后道加工中', recheck: '待复检／复检中', delivery: '已交出待入仓', warehouse: '成衣仓已入库', unknown: '后道位置待核实' } as Record<string, string>)[position] ?? '后道位置待核实'
}

/** No actual start is expected for an explicitly recorded future work state. */
export function timingClockHasNotStartedFact(document: {status: string; clock?: {start: string|null}}, clock = document.clock): boolean {
  return !!clock && !clock.start && /^(尚未开始|未开始|待质检|待复检|待后道|尚未交出)$/.test(document.status)
}

/** Display the actual work being timed without changing its recorded clock kind. */
export function timingClockWorkLabel(document: {type?:string}, clock: {kind:string}): string {
 if(clock.kind !== '制作')return clock.kind
 return ({后道质检单:'质检',后道复检单:'数量与条码复核',车缝执行单:'车缝',承包裁剪执行单:'裁剪',工厂烫包执行单:'烫包'} as Record<string,string>)[document.type ?? ''] ?? clock.kind
}
