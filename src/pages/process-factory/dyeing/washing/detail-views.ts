import { escapeHtml as e } from '../../../../utils.ts'
import type { WashingAction, WashingOrder } from '../../../../data/fcs/fabric-washing-model.ts'
import { getPrintingWorkOrderById, PRINTING_DEMAND_SOURCE_LABEL } from '../../../../data/fcs/printing-task-domain.ts'

type ImageRenderer = (url:string, name:string, size?:string) => string
type LinkRenderer = (name:string, url:string) => string
export const washingDetailTabs = [
  {key:'execution',label:'加工执行'}, {key:'base',label:'基本信息'},
  {key:'handover',label:'交接记录'}, {key:'logs',label:'操作日志'}, {key:'print',label:'打印'},
] as const
export type WashingDetailTab = typeof washingDetailTabs[number]['key']
export const washingDetailTab = (value?:string):WashingDetailTab => washingDetailTabs.find(tab=>tab.key===value)?.key || 'execution'
const tabClass = (active:boolean) => `shrink-0 border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active?'border-blue-600 text-blue-700':'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`
const at = (value?:string) => value ? (Number.isNaN(Date.parse(value))?value:new Date(value).toLocaleString('zh-CN',{hour12:false})) : '尚未发生'
const qty = (value:number|undefined, unit:string) => value===undefined?'—':`${Number(value.toFixed(4))} ${unit}`
const field = (label:string, value:string) => `<div class="min-w-0"><dt class="mb-1 text-xs text-slate-500">${e(label)}</dt><dd class="break-words text-sm text-slate-900">${value}</dd></div>`
const section = (title:string, content:string) => `<section class="space-y-4 rounded-lg border bg-white p-4"><h2 class="font-semibold">${e(title)}</h2>${content}</section>`

export function renderWashingDetailTabs(active:WashingDetailTab):string {
  // The shared visual tabs do not yet expose linked ARIA panels or roving focus.
  // Keep this small, semantic detail control local instead of changing every caller.
  return `<nav aria-label="洗水加工单视图" class="overflow-x-auto rounded-t-lg border-b bg-white"><div class="flex min-w-max" role="tablist" aria-label="洗水加工单视图">${washingDetailTabs.map(tab=>`<button type="button" role="tab" id="washing-tab-${tab.key}" aria-controls="washing-panel-${tab.key}" aria-selected="${active===tab.key}" tabindex="${active===tab.key?0:-1}" class="${tabClass(active===tab.key)}" data-fabric-washing-action="detail-tab" data-washing-tab="${tab.key}" data-skip-page-rerender="true">${tab.label}</button>`).join('')}</div></nav>`
}
export function renderWashingDetailPanel(key:WashingDetailTab, active:WashingDetailTab, content:string):string {
  return `<section role="tabpanel" id="washing-panel-${key}" aria-labelledby="washing-tab-${key}" tabindex="0" class="space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" data-washing-tab-panel="${key}" ${active===key?'':'hidden'}>${content}</section>`
}
export function switchWashingDetailTab(root:HTMLElement, key:WashingDetailTab, focus=false):void {
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-washing-tab]')
  if(!buttons.length)return
  root.dataset.washingActiveTab=key
  buttons.forEach(button=>{
    const active=button.dataset.washingTab===key
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.className=tabClass(active)
    if(active&&focus)button.focus()
  })
  root.querySelectorAll<HTMLElement>('[data-washing-tab-panel]').forEach(panel=>{panel.hidden=panel.dataset.washingTabPanel!==key})
}
export function handleWashingDetailTabKey(event:KeyboardEvent):void {
  const target=event.target
  if(!(target instanceof HTMLElement))return
  const button=target.closest<HTMLButtonElement>('[data-washing-tab]'),root=button?.closest<HTMLElement>('[data-washing-order]')
  if(!button||!root||button.disabled||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
  event.preventDefault()
  const index=washingDetailTabs.findIndex(tab=>tab.key===button.dataset.washingTab)
  const next=event.key==='Home'?0:event.key==='End'?washingDetailTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+washingDetailTabs.length)%washingDetailTabs.length
  switchWashingDetailTab(root,washingDetailTabs[next].key,true)
}
export function renderWashingDetailSummary(o:WashingOrder,image:ImageRenderer):string {
  return `<section class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-white p-4" data-washing-detail-summary><div class="flex min-w-0 items-center gap-3">${image(o.source.imageUrl,o.source.materialName,'h-16 w-16')}<div class="min-w-0"><h2 class="font-semibold">${e(o.source.materialName)}</h2><p class="mt-1 break-all text-sm text-slate-500">${e(o.source.materialSku)}</p><p class="mt-1 text-sm font-medium text-blue-800">${e(o.handFeel)}</p></div></div><div class="min-w-0 text-sm"><p class="break-words">${e(o.source.factoryName)} <span class="px-1 text-slate-400">→</span> <strong>${e(o.assignedFactoryName||'待确认 GTG')}</strong> <span class="px-1 text-slate-400">→</span> ${e(o.source.target?.name||'原接收方待核对')}</p><p class="mt-2 text-slate-500">${o.rolls.length} 卷 · 原卷 ${qty(o.rolls.reduce((n,r)=>n+r.inputQty,0),o.rolls[0]?.unit||'')}</p></div></section>`
}
export function renderWashingDetailBase(o:WashingOrder,image:ImageRenderer,link:LinkRenderer):string {
  const prior=getPrintingWorkOrderById(o.source.printOrderId),product=o.source.product||prior?.product
  const properties=o.source.materialProperties||(prior?.output.sku===o.source.materialSku?prior.output:undefined)
  const source=section('加工单与商品',`<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${field('需求来源',e(PRINTING_DEMAND_SOURCE_LABEL[o.source.sourceType]))}${field('来源单',e(o.source.sourceNo))}${o.source.taskNo?field('来源任务单',e(o.source.taskNo)):''}${o.source.productionOrderId?field('生产单',link(o.source.productionOrderId,'/fcs/production/orders/'+encodeURIComponent(o.source.productionOrderId))):''}${o.source.salesType?field('售卖类型',e(o.source.salesType)):''}${field('创建方式','印花后现场发起')}${field('发起人员',e(o.createdBy))}${field('发起时间',e(at(o.createdAt)))}${o.acceptedAt?field('历史接单时间',e(at(o.acceptedAt))):''}${field('人工完单',e(at(o.completedAt)))}</dl>${product?`<div class="flex items-center gap-3 border-t pt-4">${image(product.imageUrl,product.imageAlt||product.productName,'h-14 w-14')}<div><strong class="text-sm">${e(product.productName)}</strong><p class="mt-1 text-sm text-slate-500">${e(product.spu)}</p></div></div>`:'<p class="text-sm text-slate-500">本单按面料来源加工。</p>'}`)
  const requirements=section('面料与加工要求',`<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${field('物料类型','面料')}${field('目标手感',e(o.handFeel))}${field('承接染厂',e(o.assignedFactoryName||'待确认 GTG'))}${properties?.composition?field('成分',e(properties.composition)):''}${properties?.widthCm?field('幅宽',e(String(properties.widthCm))+' cm'):''}${properties?.gsm?field('克重',e(String(properties.gsm))+' g/㎡'):''}</dl>`)
  const route=section('加工投入与产出去向',`<div class="grid gap-5 sm:grid-cols-2"><div class="space-y-2"><h3 class="text-sm font-medium text-slate-500">上游 · 印花</h3><p class="text-sm">${e(o.source.factoryName)}</p><p class="text-sm">${link(o.source.printOrderNo,'/fcs/craft/printing/work-orders/'+encodeURIComponent(o.source.printOrderId))}</p><p class="break-words text-sm text-slate-500">批次 ${e(o.source.batchId)}</p></div><div class="space-y-2"><h3 class="text-sm font-medium text-slate-500">下游 · 原接收方</h3><p class="text-sm">${e(o.source.target?.name||'待核对')}</p><p class="text-sm text-slate-500">${e(o.source.target?.factoryId?'接收工厂':o.source.target?.warehouseId?'接收仓库':'接收方待核对')}${o.source.target?' · '+e(o.source.target.id):''}</p></div></div>`)
  return source+requirements+route
}
export function renderWashingHandover(o:WashingOrder):string {
  const cell=(label:string,when:string|undefined,value:number|undefined,unit:string)=>`<td class="px-3 py-3 align-top"><p>${when?e(qty(value,unit)):'—'}</p><p class="mt-1 whitespace-nowrap text-xs text-slate-500">${e(when?at(when):'尚未'+label)}</p></td>`
  const rows=o.rolls.map(r=>`<tr class="border-t"><th scope="row" class="max-w-56 break-all px-3 py-3 text-left align-top font-medium">${e(r.barcode)}${r.outputBarcode&&r.outputBarcode!==r.barcode?`<p class="mt-1 text-xs text-slate-500">产出 ${e(r.outputBarcode)}</p>`:''}</th>${cell('交出',r.sentAt,r.inputQty,r.unit)}${cell('实收',r.receivedAt,r.receivedQty,r.unit)}<td class="px-3 py-3 align-top"><p>${e(r.completedAt?qty(r.outputQty,r.unit):r.startedAt?'加工中':'尚未投入')}</p><p class="mt-1 whitespace-nowrap text-xs text-slate-500">投入：${e(at(r.startedAt))}</p><p class="mt-1 whitespace-nowrap text-xs text-slate-500">完成：${e(at(r.completedAt))}</p></td>${cell('交回',r.handedOutAt,r.outputQty,r.unit)}${cell('实收',r.downstreamReceivedAt,r.downstreamQty,r.unit)}</tr>`).join('')
  return section('逐卷交接',`<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm"><p>印花方：${e(o.source.factoryName)}</p><p>承接染厂：${e(o.assignedFactoryName||'待确认 GTG')}</p><p>最终接收方：${e(o.source.target?.name||'待核对')}</p></div><div class="overflow-x-auto"><table class="w-full min-w-[780px] text-left text-sm"><thead class="bg-slate-50 text-slate-600"><tr>${['实物卷码','印花交出','染厂实收','加工起止 / 产出','染厂交回','下游实收'].map(label=>`<th scope="col" class="whitespace-nowrap px-3 py-3 font-medium">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`)
}
export function renderWashingLogs(o:WashingOrder,actions:WashingAction[],actionName:(code:string)=>string):string {
  const records=actions.filter(a=>a.orderId===o.id).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.id.localeCompare(a.id))
  return `<section class="rounded-lg border bg-white p-4" data-washing-log><h2 class="font-semibold">操作日志</h2><ol class="mt-4 divide-y">${records.map(a=>`<li class="py-3 first:pt-0"><div class="flex flex-wrap justify-between gap-2"><strong class="text-sm">${e(actionName(a.action))}</strong><time class="text-xs text-slate-500">${e(at(a.at))}</time></div><p class="mt-1 text-sm text-slate-600">${e(a.actor.name)} · ${e(a.actor.role)}</p>${a.rollIds.length?`<p class="mt-2 break-all text-sm">${a.rollIds.map(id=>e(o.rolls.find(r=>r.id===id)?.barcode||id)).join('、')}</p>`:''}${a.note?`<p class="mt-1 break-words text-sm text-slate-600">${e(a.note)}</p>`:''}</li>`).join('')||'<li class="text-sm text-slate-500">暂无操作记录。</li>'}</ol></section>`
}
