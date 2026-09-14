import {dyeLengthMeters} from '../../../data/fcs/dye-work-order-demo-details.ts'
import {escapeHtml as e} from '../../../utils.ts'
import {renderSecondaryButton} from '../../../components/ui/button.ts'
import {renderCode128Barcode} from '../../../components/real-barcode.ts'
import {listWaterOutputRows,getWaterOutputRolls,saveWaterOutputRolls,markWaterOutputRolls,listWaterDispatchDocuments} from '../../../data/fcs/water-soluble-output.ts'
let orderId='',onClose:(()=>void)|undefined
const root=()=>document.querySelector<HTMLElement>('[data-water-barcode-root]')
const btn=(label:string,action:string)=>renderSecondaryButton(label,{prefix:'water-barcode',action}).replace('<button','<button data-skip-page-rerender="true"')
function close(){root()?.remove();onClose?.()}
function body(){const row=listWaterOutputRows().find(r=>r.orderId===orderId)!;const rolls=getWaterOutputRolls(orderId),locked=new Set(listWaterDispatchDocuments().filter(d=>d.status!=='已作废').flatMap(d=>d.lines).filter(l=>l.orderId===orderId).flatMap(l=>l.rolls.map(r=>r.id)))
 return `<header class="flex justify-between border-b p-4"><h2 class="font-semibold">水溶卷码 · ${e(row.workOrderNo)}</h2>${btn('关闭','close')}</header><div class="overflow-auto p-4"><div class="mb-3 flex items-center gap-3"><button type="button" data-pda-image-preview-url="${e(row.outputImageUrl)}" data-pda-image-preview-title="${e(row.materialName)}"><img class="h-12 w-12 rounded border object-contain" src="${e(row.outputImageUrl)}" alt="${e(row.materialName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>图片加载失败</span></button><div>${e(row.materialName)}<div class="text-xs text-muted-foreground">${e(row.colorSku)} · ${e(row.materialSpec||'')}</div></div></div><p class="mb-3 text-xs">按实物填写卷长；修改后需重新打印，已占用或已交出的卷不可修改。</p><div class="space-y-3">${rolls.map(r=>`<label class="grid grid-cols-[1fr_120px] items-center gap-2 rounded border p-2 text-xs"><span>${e(r.barcode)}<span class="block text-muted-foreground">${locked.has(r.id)?'已占用 / 已交出':r.printedAt?'已打印':'待打印'}</span></span><span>卷长（${e(row.qtyUnit)}）<input type="number" min="0.01" step="0.01" value="${r.qty}" data-water-roll-id="${e(r.id)}" class="mt-1 h-9 w-full rounded border px-2" ${locked.has(r.id)?'disabled':''}></span></label>`).join('')||'<p>尚未维护卷码，请填写首卷数量。</p>'}</div><div class="mt-4 flex items-end gap-2"><label class="text-xs">新增卷长（${e(row.qtyUnit)}）<input type="number" min="0.01" step="0.01" data-water-new-roll class="mt-1 block h-9 w-32 rounded border px-2"></label>${btn('新增卷','add')}${btn('保存卷长','save')}${btn('打印条码','preview')}</div><p role="alert" data-water-barcode-feedback class="mt-3 text-sm text-red-700"></p><div data-water-barcode-print></div></div>`
}
export function openWaterOutputBarcode(id:string,afterClose:()=>void){close();orderId=id;onClose=afterClose;document.querySelector('[data-dye-output-page]')?.insertAdjacentHTML('beforeend',`<div data-water-barcode-root data-skip-page-rerender="true" class="fixed inset-0 z-[115] flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-label="水溶卷码" class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white">${body()}</section></div>`)}
export function handleWaterOutputBarcode(target:HTMLElement,event?:Event):boolean{
 if(event&&event.type!=='click')return true
 if(target===root()){close();return true}
 const action=target.closest<HTMLElement>('[data-water-barcode-action]')?.dataset.waterBarcodeAction;if(!action)return true
 try{
 if(action==='close'){close();return true}
 if(action==='add'){const value=root()!.querySelector<HTMLInputElement>('[data-water-new-roll]')!.value.trim();saveWaterOutputRolls(orderId,[{qty:value?Number(value):NaN}])}
 if(action==='save')saveWaterOutputRolls(orderId,[...root()!.querySelectorAll<HTMLInputElement>('[data-water-roll-id]:not(:disabled)')].map(i=>({id:i.dataset.waterRollId,qty:i.value.trim()?Number(i.value):NaN})))
 if(action==='preview'){
  const row=listWaterOutputRows().find(r=>r.orderId===orderId)!,rolls=getWaterOutputRolls(orderId);if(!rolls.length||rolls.some(r=>r.qty<=0))throw new Error('请先保存有效卷长。')
  const host=root()!.querySelector('[data-water-barcode-print]')!;host.innerHTML=`<div class="mt-4">${btn('确认打印','print')}</div><iframe title="水溶条码打印预览" class="mt-2 h-80 w-full border"></iframe>`
  host.querySelector('iframe')!.srcdoc=`<!doctype html><html><head><title>水溶条码</title><style>@page{size:100mm 70mm;margin:4mm}body{margin:0;font:12px Arial}article{box-sizing:border-box;width:92mm;height:62mm;padding:4mm;break-after:page;border:1px solid #ddd}article:last-child{break-after:auto}svg{width:100%;height:44px}img{width:38px;height:38px;object-fit:contain;float:right}p{margin:6px 0}@media print{article{border:0}}</style></head><body>${rolls.map(r=>`<article><img src="${e(row.outputImageUrl)}" alt="${e(row.materialName)}"><b>${e(row.materialName)}</b><p>${e(row.colorSku)}</p><p>水溶单：${e(row.workOrderNo)}</p><p>卷 ${e(r.rollNo)} · ${r.qty.toFixed(2)} ${e(row.qtyUnit)}${dyeLengthMeters(r.qty,row.qtyUnit)===null?'':` · ${(dyeLengthMeters(r.qty,row.qtyUnit)!/.9144).toFixed(2)} Yard`}</p>${renderCode128Barcode(r.barcode,r.barcode)}<p>${e(r.barcode)}</p></article>`).join('')}</body></html>`;return true
 }
 if(action==='print'){const frame=root()!.querySelector<HTMLIFrameElement>('iframe');if(!frame)throw new Error('请先打开打印预览。');markWaterOutputRolls(orderId,getWaterOutputRolls(orderId).map(r=>r.id),'水溶管理操作员');frame.contentWindow?.print();return true}
 root()!.querySelector('section')!.innerHTML=body()
 }catch(error){const node=root()?.querySelector('[data-water-barcode-feedback]');if(node)node.textContent=error instanceof Error?error.message:'保存失败，请重试。'}
 return true
}
if(typeof document!=='undefined')document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root()&&!document.querySelector('[data-pda-image-preview-root]')){event.stopPropagation();close()}})
