import { escapeHtml as e } from '../../../../utils.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import type { WashingOrder } from '../../../../data/fcs/fabric-washing-model.ts'
import { getPrintingWorkOrderById } from '../../../../data/fcs/printing-task-domain.ts'
import { PRINTING_DEMAND_SOURCE_LABEL } from '../../../../data/fcs/printing-task-domain.ts'
import { washingOrderStatus } from '../../../../data/fcs/fabric-washing-views.ts'

type ImageRenderer=(url:string,name:string,size?:string)=>string
type LinkRenderer=(name:string,url:string)=>string
type Group='order'|'input'|'requirements'|'progress'|'output'|'time'|'qty'
const titles:Record<Group,string>={order:'加工单/商品',input:'加工投入/上游',requirements:'加工要求',progress:'处理进度',output:'加工产出/下游',time:'时间',qty:'数量'}

/** Upgrade only the obsolete preference schema; current user choices stay intact. Reads never save. */
export function upgradeWashingColumnPreferences(value:unknown):unknown {
  if(!value||typeof value!=='object')return value
  const old=value as {order?:unknown;frozenKeys?:unknown;pageSize?:unknown}
  if(!Array.isArray(old.order)||!old.order.some(key=>['material','source','handFeel','factory','status'].includes(key)))return value
  const order=[...Object.keys(titles),'action']
  const mapping:Record<string,string>={material:'order',factory:'order',source:'input',handFeel:'requirements',status:'progress',qty:'qty'}
  const frozenKeys=Array.isArray(old.frozenKeys)?[...new Set(old.frozenKeys.filter((key):key is string=>typeof key==='string').map(key=>mapping[key]).filter(Boolean))]:[]
  return {order,visibleKeys:order,frozenKeys,pageSize:old.pageSize}
}
const field=(label:string,value:string)=>`<p class="leading-5"><span class="text-slate-500">${e(label)}：</span><span class="break-words">${e(value)}</span></p>`
const number=(n:number)=>String(Number(n.toFixed(4)))
const date=(at:string|undefined)=>at?(Number.isNaN(Date.parse(at))?at:new Date(at).toLocaleString('zh-CN',{hour12:false})):'尚未发生'
const prior=new WeakMap<WashingOrder,ReturnType<typeof getPrintingWorkOrderById>>()
function sourceView(o:WashingOrder){
  if(!prior.has(o))prior.set(o,getPrintingWorkOrderById(o.source.printOrderId))
  return prior.get(o)
}
function imageMaterial(o:WashingOrder,image:ImageRenderer):string {
  const live=o.source.materialProperties?undefined:sourceView(o),properties=o.source.materialProperties||(live?.output.sku===o.source.materialSku?live.output:undefined)
  return `<div class="flex items-start gap-2">${image(o.source.imageUrl,o.source.materialName,'h-12 w-12')}<div class="min-w-0"><strong>${e(o.source.materialName)}</strong><p class="break-all text-slate-500">${e(o.source.materialSku)}</p></div></div><div class="mt-2">${field('物料类型','面料')}${properties?.composition?field('成分',properties.composition):''}${properties?.widthCm?field('幅宽',number(properties.widthCm)+' cm'):''}${properties?.gsm?field('克重',number(properties.gsm)+' g/㎡'):''}</div>`
}
export function washingQuantities(o:WashingOrder){
  const sum=(read:(r:WashingOrder['rolls'][number])=>number)=>o.rolls.reduce((n,r)=>n+read(r),0)
  return {unit:o.rolls[0]?.unit||'',input:sum(r=>r.inputQty),sent:sum(r=>r.sentAt?r.inputQty:0),received:sum(r=>r.receivedQty||0),used:sum(r=>r.startedAt?r.receivedQty||0:0),output:sum(r=>r.completedAt?r.outputQty||0:0),change:sum(r=>r.completedAt?(r.receivedQty||0)-(r.outputQty||0):0),handedOut:sum(r=>r.handedOutAt?r.outputQty||0:0),downstream:sum(r=>r.downstreamQty||0),pending:sum(r=>r.handedOutAt?(r.outputQty||0)-(r.downstreamQty||0):0)}
}
function axis(label:string,value:string,done:boolean){return `<p class="flex flex-wrap items-center gap-2"><span class="text-slate-500">${e(label)}</span><span class="rounded-full px-2 py-0.5 ${done?'bg-emerald-100 text-emerald-800':'bg-blue-50 text-blue-800'}">${e(value)}</span></p>`}
export function renderWashingInformationCell(o:WashingOrder,key:Group,image:ImageRenderer,link:LinkRenderer):string {
  if(key==='order'){
    const product=o.source.product||sourceView(o)?.product
    return `<div class="space-y-2">${field('加工厂',o.assignedFactoryName||'待确认 GTG')}${field('需求来源',PRINTING_DEMAND_SOURCE_LABEL[o.source.sourceType])}<div>${link(o.no,'/fcs/craft/dyeing/washing/work-orders/'+encodeURIComponent(o.id))}</div>${o.source.taskNo?field('来源任务单',o.source.taskNo):''}${field('来源单',o.source.sourceNo)}${o.source.productionOrderId?`<p>生产单：${link(o.source.productionOrderId,'/fcs/production/orders/'+encodeURIComponent(o.source.productionOrderId))}</p>`:''}${o.source.salesType?field('售卖类型',o.source.salesType):''}${field('创建方式','印花后现场发起')}${product?`<div class="flex gap-2 border-t pt-2">${image(product.imageUrl,product.imageAlt||product.productName,'h-12 w-12')}<div class="min-w-0"><strong>${e(product.productName)}</strong><p>${e(product.spu)}</p></div></div>`:field('商品关联','本次按面料来源加工')}</div>`
  }
  if(key==='input')return `${imageMaterial(o,image)}<div class="mt-3 space-y-1 border-t pt-2"><p class="font-medium text-slate-500">上游</p>${field('工厂名称',o.source.factoryName)}${field('工厂类型','印花厂')}<p>${link(o.source.printOrderNo,'/fcs/craft/printing/work-orders/'+encodeURIComponent(o.source.printOrderId))}</p>${field('印花批次',o.source.batchId)}</div>`
  if(key==='requirements')return `<div class="space-y-1">${field('工艺','洗水')}${field('目标手感',o.handFeel)}${field('承接染厂',o.assignedFactoryName||'GTG')}</div>`
  if(key==='progress'){
    const all=(key:'receivedAt'|'completedAt'|'handedOutAt')=>o.rolls.length>0&&o.rolls.every(r=>!!r[key])
    const some=(key:'receivedAt'|'startedAt'|'completedAt'|'handedOutAt')=>o.rolls.some(r=>!!r[key])
    return `<div class="space-y-2">${axis('接收',all('receivedAt')?'已收齐':some('receivedAt')?'部分接收':o.rolls.some(r=>r.sentAt)?'待接收':'待来料',all('receivedAt'))}${axis('加工',all('completedAt')?'加工完成':some('completedAt')?'部分完成':some('startedAt')?'加工中':'未开始',all('completedAt'))}${axis('交出',all('handedOutAt')?'全部交回':some('handedOutAt')?'部分交回':some('completedAt')?'待交回':'未到交出',all('handedOutAt'))}<p class="${o.exception||o.cancelledAt?'text-red-700':'text-slate-600'}">${e(washingOrderStatus(o))}</p></div>`
  }
  if(key==='output')return `${imageMaterial(o,image)}<div class="mt-3 space-y-1 border-t pt-2"><p class="font-medium text-slate-500">下游</p>${field(o.source.target?.factoryId?'工厂名称':'仓库名称',o.source.target?.name||'原接收方待核对')}${o.source.target?field('接收方编号',o.source.target.id):''}${field('接收方类型',o.source.target?.factoryId?'原接收工厂':o.source.target?.warehouseId?'原接收仓库':'待核对')}</div>`
  if(key==='time'){
    const last=(key:'sentAt'|'receivedAt'|'startedAt'|'completedAt'|'handedOutAt'|'downstreamReceivedAt')=>o.rolls.map(r=>r[key]).filter((v):v is string=>!!v).sort().at(-1)
    return `<div class="space-y-2">${field('洗水单创建',date(o.createdAt))}${o.acceptedAt?field('历史接单时间',date(o.acceptedAt)):''}<div class="border-t pt-2">${field('印花交出',date(last('sentAt')))}${field('染厂实收',date(last('receivedAt')))}</div><div class="border-t pt-2">${field('投入洗水',date(last('startedAt')))}${field('加工完成',date(last('completedAt')))}</div><div class="border-t pt-2">${field('交回原接收方',date(last('handedOutAt')))}${field('下游实收',date(last('downstreamReceivedAt')))}${field('人工完单',date(o.completedAt))}</div></div>`
  }
  const q=washingQuantities(o),f=(label:string,n:number)=>field(label,number(n)+' '+q.unit)
  return `<div class="space-y-2"><div>${f('计划投入',q.input)}${field('实物卷数',o.rolls.length+' 卷')}</div><div class="border-t pt-2">${f('上游交出',q.sent)}${f('染厂实收',q.received)}</div><div class="border-t pt-2">${f('实际使用',q.used)}${f('加工完成',q.output)}${f('完成数量变化',q.change)}</div><div class="border-t pt-2">${f('实际交回',q.handedOut)}${f('下游实收',q.downstream)}${f('下游待接收',q.pending)}</div></div>`
}
export function washingInformationColumns(image:ImageRenderer,link:LinkRenderer):StandardListColumn<WashingOrder>[] {
  const widths:Record<Group,number>={order:280,input:270,requirements:180,progress:180,output:270,time:270,qty:230}
  return (Object.keys(titles) as Group[]).map(key=>({key,title:titles[key],width:widths[key],required:key==='order'||key==='requirements',freezeable:true,sortable:true,
    sortValue:o=>key==='order'?o.no:key==='requirements'?o.handFeel:key==='progress'?washingOrderStatus(o):key==='time'?o.createdAt:key==='qty'?washingQuantities(o).input:o.source.materialSku,
    render:o=>`<div class="text-xs" data-washing-info="${key}">${renderWashingInformationCell(o,key,image,link)}</div>`}))
}
export function renderWashingInformation(o:WashingOrder,image:ImageRenderer,link:LinkRenderer):string {
  return `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-washing-information>${(Object.keys(titles) as Group[]).map(key=>`<section class="space-y-3 rounded-lg border bg-white p-4"><h2 class="font-semibold">${titles[key]}</h2><div class="text-sm" data-washing-info="${key}">${renderWashingInformationCell(o,key,image,link)}</div></section>`).join('')}</div>`
}
