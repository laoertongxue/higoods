import { renderDialog } from '../../../../components/ui/dialog.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { deriveTmfProductionDemands } from '../../../../data/fcs/webbing-production-demands.ts'
import { getTmfPurchaseState, registerTmfProductionOrder } from '../../../../data/pms/tmf-material-purchases.ts'

const actor={id:'TMF-DEMO-PRODUCTION-PLANNER',name:'生产计划（演示）',role:'生产计划' as const}
const prefix='tmf-generate'
const button=(action:string,label:string)=>`<button type="button" class="border rounded px-3 py-2 text-sm ${action==='confirm'?'bg-blue-600 text-white':''}" data-${prefix}-action="${action}" data-skip-page-rerender="true">${label}</button>`
/** 每次确认重新读取正式生产单，不能沿用预览时的状态、数量或版本。 */
async function source(code:string){
 const {productionOrders}=await import('../../../../data/fcs/production-orders.ts')
 const found=productionOrders.filter(o=>o.productionOrderNo===code||o.productionOrderId===code)
 if(found.length!==1)throw new Error(found.length?'生产单编号不唯一，请使用系统生产单ID核对。':'未找到生产单，请核对正式生产单号。')
 return found[0]
}
export function openTmfProductionDemandDialog(surface:HTMLElement, onGenerated:()=>void){
 let preview='',sourceId='',generation=0,busy=false
 const operationId=`tmf-generate:${crypto.randomUUID()}`
 surface.innerHTML=renderDialog({title:'从生产单生成织带加工需求',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},`<div class="max-h-[60vh] overflow-y-auto"><p class="text-xs text-slate-500">操作身份：${e(actor.name)}。读取生产单已采用的技术包，不自动采用最新版本，也不直接产生领料或库存。</p><label class="block mt-3 text-sm">生产单号或系统ID<input name="productionOrder" class="block border rounded p-2 w-full mt-1" autocomplete="off"></label><div class="mt-3">${button('preview','核对需求')}</div><div data-tmf-generate-preview class="mt-3"></div><p role="alert" data-tmf-generate-error class="text-red-700 text-sm mt-2"></p></div>`,button('close','关闭')+button('confirm','确认生成'))
 const dialogNode=surface.firstElementChild
 hydrateIcons(surface)
 const read=()=>surface.querySelector<HTMLInputElement>('[name="productionOrder"]')?.value.trim()??''
 const error=(text:string)=>{const el=surface.querySelector('[data-tmf-generate-error]');if(el)el.textContent=text}
 const reset=()=>{generation++;preview=sourceId='';surface.querySelector('[data-tmf-generate-preview]')?.replaceChildren();error('')}
 surface.oninput=()=>reset()
 surface.onkeydown=event=>{if(event.key==='Escape'){event.stopPropagation();const image=surface.querySelector('[data-tmf-generate-image]');if(image)image.remove();else {generation++;surface.replaceChildren()}}}
 if(!surface.dataset.imageErrorsBound){surface.dataset.imageErrorsBound='true';surface.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)}
 surface.onclick=async event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!target)return;event.stopPropagation()
  const action=target.getAttribute(`data-${prefix}-action`)
  if(action==='close-image'){surface.querySelector('[data-tmf-generate-image]')?.remove();return}
  if(action==='image'){const img=target.querySelector('img');if(img)surface.insertAdjacentHTML('beforeend',`<div data-tmf-generate-image class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative bg-white rounded p-3"><p>半成品参考图 ${button('close-image','关闭')}</p><img src="${e(img.src)}" alt="${e(img.alt)}" class="max-h-[70vh] max-w-[85vw] object-contain"></div></div>`);return}
  if(action==='close'){generation++;surface.replaceChildren();return}
  if(busy)return
  busy=true;target.setAttribute('disabled','');error('')
  const request=++generation
  try{
   if(action==='preview'){
    preview=sourceId=''
    const order=await source(read());if(request!==generation||!surface.isConnected||!dialogNode||!surface.contains(dialogNode))return
    const demands=deriveTmfProductionDemands(order)
    if(!demands.length)throw new Error('此生产单采用的技术包没有织带／绳子加工需求。')
    preview=JSON.stringify(demands);sourceId=order.productionOrderId
    const data=getTmfPurchaseState()
    surface.querySelector('[data-tmf-generate-preview]')!.innerHTML=`<div class="border rounded p-3"><p class="font-medium">${e(order.productionOrderNo)} · ${demands.length} 条规格需求</p><p class="text-xs break-all">采用技术包 ${e(order.techPackSnapshot!.sourceTechPackVersionId)}<br>快照 ${e(order.techPackSnapshot!.snapshotId)}</p>${demands.map(d=>{const material=data.orders.find(p=>p.materialSkuId===d.sourceMaterialSkuId);return `<article class="border-t pt-2 mt-2"><div class="flex gap-2">${material?.materialImageUrl?`<button data-tmf-generate-action="image" data-skip-page-rerender="true"><img src="${e(material.materialImageUrl)}" class="h-12 w-12 object-cover rounded border" alt="${e(material.materialName)}半成品参考图"></button>`:'<span class="text-xs text-amber-700">缺该物料实图</span>'}<div>${e(material?.materialName??d.sourceMaterialSkuId)}<p class="text-xs">${e(d.specification.usage)} · ${e(d.garmentColor)} · ${e(d.garmentSize)}</p></div></div><p class="text-sm">${d.garmentQuantity} 件 × 每件 ${d.specification.piecesPerGarment} 条/根＝${d.requiredPieces} 条/根；下料 ${d.specification.cutLengthMm}mm，共 ${d.theoreticalCutMeters} 米</p><p class="text-xs">${d.specification.tippingRequired?'需打头':'无需打头'}；成品 ${d.specification.finishedLengthMm}mm；${d.routeSnapshot.map(r=>e(r.processName)).join(' → ')}</p><p class="text-xs">${[d.specification.endA,d.specification.endB].map((end,index)=>`${index===0?'A':'B'}端：${({NONE:'无端头',METAL:'金属头',PLASTIC_WRAP:'塑料包头',SILICONE_DIP:'硅胶浸头'})[end.method]} ${e(end.specification)}`).join('；')}</p></article>`}).join('')}<p class="text-xs mt-3">同来源重复生成沿用原需求；已生成后版本或数量变化须走变更处理。</p></div>`
   }
   if(action==='confirm'){
    if(!preview||!sourceId)throw new Error('请先核对生产单采用的技术包及规格需求。')
    const order=await source(sourceId);if(request!==generation||!surface.isConnected||!dialogNode||!surface.contains(dialogNode))return
    const current=deriveTmfProductionDemands(order)
    if(JSON.stringify(current)!==preview){reset();throw new Error('生产单版本或数量已变化，请重新核对需求。')}
    registerTmfProductionOrder(order,actor,operationId)
    surface.replaceChildren();onGenerated()
   }
  }catch(cause){error(cause instanceof Error?cause.message:'需求未生成，请重新核对。')}
  finally{busy=false;target.removeAttribute('disabled')}
 }
}
