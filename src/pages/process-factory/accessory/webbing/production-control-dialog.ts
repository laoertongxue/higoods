import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { getTmfPurchaseState, getTmfProductionDisposition, getTmfOutputPackageBalance, changeTmfProductionControl, type TmfProductionControl } from '../../../../data/pms/tmf-material-purchases.ts'
import { escapeHtml as e } from '../../../../utils.ts'

const prefix = 'tmf-production-control'
const actor = {id:'TMF-DEMO-PLAN',name:'生产计划（演示）',role:'生产计划' as const}
const button = (action:string,label:string) => `<button class="border rounded px-3 py-2 text-sm" data-${prefix}-action="${action}" data-skip-page-rerender="true">${label}</button>`
const labels:Record<string,string>={DRAFT:'草稿',WAIT_TECH_PACK_RELEASE:'待技术包发布',READY_FOR_BREAKDOWN:'待拆解',WAIT_ASSIGNMENT:'待分配',ASSIGNING:'分配中',EXECUTING:'执行中',COMPLETED:'已完成',ON_HOLD:'已暂停',CANCELLED:'已取消',ACTIVE:'可执行'}

export function openTmfProductionControlDialog(surface:HTMLElement,productionOrderId:string,onSaved:()=>void):void {
 const disposition=getTmfProductionDisposition(productionOrderId),data=getTmfPurchaseState()
 const demands=data.demands.filter(d=>d.productionOrderId===productionOrderId)
 const operationId=`TMF-CONTROL:${crypto.randomUUID()}`,signature=JSON.stringify(disposition)
 const options:Array<{value:TmfProductionControl['status'];label:string}>=[]
 if(disposition.localStatus!=='CANCELLED'&&!['COMPLETED','DRAFT','WAIT_TECH_PACK_RELEASE'].includes(disposition.mainStatus??'')){
  if(disposition.mainStatus==='CANCELLED')options.push({value:'CANCELLED',label:'确认取消处置并释放未发占用'})
  else if(disposition.localStatus==='ON_HOLD')options.push({value:'ACTIVE',label:'恢复织带执行（主单须允许执行）'})
  else options.push({value:'ON_HOLD',label:'暂停织带执行'})
 }
 const cards=demands.map(d=>{
  const material=data.orders.find(p=>p.materialSkuId===d.sourceMaterialSkuId),unit=material?(material.accessoryType==='绳子'?'根':'条'):'条／根（待核对）'
  const outputs=data.cutOutputs.filter(o=>o.demandId===d.id),packages=data.packages.filter(p=>p.demandId===d.id),packageIds=new Set(packages.map(p=>p.id))
  const handovers=data.outputHandovers.filter(h=>packageIds.has(h.packageId)),issues=data.productionIssues.filter(i=>i.demandId===d.id)
  const cut=outputs.reduce((n,o)=>n+o.cutPieces,0),factory=cut-handovers.reduce((n,h)=>n+h.dispatchedPieces,0)
  const warehouse=packages.filter(p=>!p.splitAt).reduce((n,p)=>n+getTmfOutputPackageBalance(p.id).onHandPieces,0)
  const reserved=data.reservations.filter(r=>r.demandId===d.id).reduce((n,r)=>n+r.reservedMeters,0)
  const allocated=data.outputAllocations.filter(a=>a.demandId===d.id).reduce((n,a)=>n+a.allocatedPieces-a.releasedPieces-issues.filter(i=>i.allocationId===a.id).reduce((q,i)=>q+i.dispatchedPieces,0),0)
  const metrics=[['未发连续料占用',`${Math.round(reserved*1000)/1000} 米`],['未发产出分配',`${allocated} ${unit}`],['厂内已截断',`${factory} ${unit}`],['仓内实存',`${warehouse} ${unit}`],['回仓在途',`${handovers.reduce((n,h)=>n+h.dispatchedPieces-h.receivedPieces,0)} ${unit}`],['生产领料在途',`${issues.reduce((n,i)=>n+i.dispatchedPieces-i.receivedPieces,0)} ${unit}`],['生产已实收',`${issues.reduce((n,i)=>n+i.receivedPieces,0)} ${unit}`]]
  return `<article class="border rounded p-3"><div class="flex gap-2">${material?.materialImageUrl?`<button data-${prefix}-action="image" data-image="${e(material.materialImageUrl)}" data-label="${e(material.materialName)}" data-skip-page-rerender="true"><img src="${e(material.materialImageUrl)}" alt="${e(material.materialName)}真实实拍替代图" class="w-12 h-12 object-cover rounded border"></button>`:'<span class="text-amber-700 text-xs">缺物料实图</span>'}<div class="min-w-0"><strong>${e(material?.materialName??d.materialSkuId)}</strong><p class="text-xs break-all">${e(d.materialSkuId)}</p><p class="text-xs">${e(d.garmentSize)} / ${e(d.specification.usage)} · 下料${d.specification.cutLengthMm}mm</p></div></div><p class="text-xs text-amber-700 mt-1">用户提供真实实拍替代图；规格按技术包核对</p><dl class="grid grid-cols-2 gap-2 mt-3 text-sm">${metrics.map(([label,value])=>`<div><dt class="text-xs text-slate-500">${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`
 }).join('')
 const content=`<div data-tmf-control-form class="max-h-[60vh] overflow-y-auto space-y-3"><p class="text-sm">操作身份：生产计划（演示）。本次影响生产单 <strong>${e(demands[0].productionOrderNo)}</strong> 下全部织带／绳子需求，不只当前加工单。</p><p class="text-sm">主单：${e(labels[disposition.mainStatus??'']??'无主单状态记录')}；织带侧：${e(labels[disposition.localStatus])}</p><p class="text-sm text-amber-700">${e(disposition.reason)}</p>${cards}<p class="text-sm">暂停保留占用；取消处置只释放尚未发出的占用与分配。已截断实物冻结，已发在途照实接收，不能还原成连续料或自动转给其他生产单。</p>${options.length?`<label class="block text-sm">处理动作<select name="status" class="w-full border rounded p-2">${options.map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}</select></label><label class="block text-sm">处理原因<textarea name="reason" class="w-full border rounded p-2"></textarea></label><label class="flex gap-2 text-sm"><input type="checkbox" name="confirmed">已核对全部需求的实物、在途与占用，确认执行上述处理</label>`:`<p class="text-sm">${disposition.localStatus==='CANCELLED'?'取消处置已确认，后续按实物退回、返工或报废流程处理。':'当前主单状态不允许改变织带执行限制，请先处理主单。'}</p>`}<p role="alert" data-tmf-control-error class="text-red-700 text-sm"></p></div>`
 surface.innerHTML=renderDialog({title:'生产限制与实物处置',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},content,button('close','关闭')+(options.length?button('save','确认处理'):''))+'<div data-tmf-control-image></div>'
 hydrateIcons(surface);surface.tabIndex=-1;surface.focus({preventScroll:true})
 surface.onkeydown=event=>{if(event.key==='Escape'){const preview=surface.querySelector('[data-tmf-control-image]')!;if(preview.innerHTML)preview.innerHTML='';else surface.replaceChildren();event.stopPropagation()}}
 surface.onclick=event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!target)return;event.stopPropagation()
  const action=target.getAttribute(`data-${prefix}-action`)
  if(action==='close'){surface.replaceChildren();return}
  if(action==='image'){surface.querySelector('[data-tmf-control-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" aria-label="关闭大图" data-${prefix}-action="close-image"></button><div class="relative bg-white p-3 rounded"><p>${e(target.dataset.label)} ${button('close-image','关闭大图')}</p><img src="${e(target.dataset.image)}" alt="${e(target.dataset.label)}半成品参考图" class="max-h-[70vh] max-w-[85vw] object-contain"></div></div>`;return}
  if(action==='close-image'){surface.querySelector('[data-tmf-control-image]')!.innerHTML='';return}
  if(action==='save')try{
   changeTmfProductionControl({productionOrderId,status:surface.querySelector<HTMLSelectElement>('[name="status"]')!.value as TmfProductionControl['status'],reason:surface.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value,confirmed:surface.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked,expectedDispositionSignature:signature},actor,operationId)
   surface.replaceChildren();onSaved()
  }catch(error){surface.querySelector('[data-tmf-control-error]')!.textContent=error instanceof Error?error.message:'未保存，请重试。'}
 }
}
