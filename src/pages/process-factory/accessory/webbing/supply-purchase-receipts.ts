// @page-pattern: list
import { listPmsMaterialPurchaseOrders } from '../../../../data/pms/material-purchase-orders.ts'
import { getTmfPurchaseState, receiveTmfSupplyPurchase } from '../../../../data/pms/tmf-material-purchases.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
const prefix='tmf-supply-receipts',selector='[data-tmf-supply-receipts]'
const actor={id:'TMF-DEMO-WAREHOUSE-CLERK',name:'原料／辅料仓管（演示）',role:'仓管' as const}
const state:ProcessOrderListControllerState & {keyword:string}={currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:10},preferencesLoaded:false,showColumnSettings:false,keyword:''}
const action=(name:string,label:string,id='')=>`<button type="button" class="border rounded px-3 py-2 text-xs" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
function rows(){
 const data=getTmfPurchaseState()
 return listPmsMaterialPurchaseOrders().filter(p=>!data.orders.some(o=>o.purchaseOrderNo===p.purchaseOrderNo)&&['公斤','千克','kg','克','g','个'].includes(p.unit)).map(p=>{
  const receipts=data.supplyPurchaseReceipts.filter(r=>r.purchaseOrderNo===p.purchaseOrderNo)
  const blocked=p.status==='待采购'?'采购尚未下达':p.status==='已关闭'?'采购已关闭':!receipts.length&&p.receivedQty>0?'已有历史到货，须核对原实收来源':p.receivedQty>=p.orderedQty?'已收齐':''
  return {p,receipts,blocked}
 })
}
type Row=ReturnType<typeof rows>[number]
const filtered=()=>rows().filter(r=>!state.keyword||[r.p.purchaseOrderNo,r.p.materialCode,r.p.materialName,r.p.warehouse].join(' ').toLowerCase().includes(state.keyword.toLowerCase()))
const material=(r:Row)=>`<div class="flex gap-2 items-center">${r.p.materialImageUrl?`<button data-${prefix}-action="image" data-id="${e(r.p.purchaseOrderNo)}" data-skip-page-rerender="true"><img src="${e(r.p.materialImageUrl)}" alt="${e(r.p.materialName)}采购物料图" class="h-12 w-12 rounded object-cover border"></button>`:'<span class="text-xs text-amber-700">缺物料实图</span>'}<div>${e(r.p.materialName)}<div class="text-xs">${e(r.p.materialCode)}</div></div></div>`
const columns:StandardListColumn<Row>[]=[
 {key:'purchase',title:'采购来源',width:220,required:true,freezeable:true,sortable:true,sortValue:r=>r.p.purchaseOrderNo,render:r=>`<strong>${e(r.p.purchaseOrderNo)}</strong><div class="text-xs">${e(r.p.requirementNo||'采购直接来源')}</div>`},
 {key:'material',title:'投入物料',width:240,required:true,render:material},
 {key:'warehouse',title:'供应方 / 目标仓',width:220,render:r=>`${e(r.p.supplierName)}<div class="text-xs">${e(r.p.warehouse)}</div>`},
 {key:'quantity',title:'采购 / 实收 / 未收',width:190,required:true,render:r=>`${r.p.orderedQty} / ${r.p.receivedQty} / ${Math.round((r.p.orderedQty-r.p.receivedQty)*1000)/1000} ${e(r.p.unit)}`},
 {key:'status',title:'状态 / 收货限制',width:220,render:r=>`${e(r.p.status)}<p class="text-xs ${r.blocked?'text-amber-700':''}">${e(r.blocked||'按本次实际数量收货')}</p>`},
 {key:'actions',title:'操作',width:180,required:true,actionColumn:true,render:r=>action('detail','实收记录',r.p.purchaseOrderNo)+(r.blocked?'':action('receive','登记采购实收',r.p.purchaseOrderNo))},
]
const controller=createProcessOrderListController({state,columns,preferenceKey:'higood:list:/wls/accessory-receipts:tmf-supply',eventPrefix:prefix,rootSelector:selector,tableSurfaceSelector:'[data-tmf-supply-table]',paginationSurfaceSelector:'[data-tmf-supply-pagination]',overlaysSurfaceSelector:'[data-tmf-supply-columns]',defaultFrozenKeys:['purchase'],pageSizeOptions:[10,20,50],getRows:filtered,locallyManagedEvents:true,emptyText:'暂无重量或按个计量的投入料采购。',columnSettingsTitle:'投入料采购收货列设置'})
const root=()=>document.querySelector<HTMLElement>(selector)
const stats=()=>renderStandardListStats([{label:'当前采购',value:`${filtered().length} 单`},{label:'可登记实收',value:`${filtered().filter(r=>!r.blocked).length} 单`},{label:'已关联实收',value:`${filtered().reduce((n,r)=>n+r.receipts.length,0)} 次`}])
let selected='',operationId=''
function refresh(){controller.refresh({overlays:true});const el=root();if(!el)return;el.querySelector('[data-tmf-supply-stats]')!.innerHTML=stats();const title=el.querySelector('[data-standard-list-table-section] > header h2');if(title)title.textContent=`投入料采购 · ${filtered().length} 单`}
function close(){root()?.querySelector('[data-tmf-supply-dialog]')?.replaceChildren();selected=operationId=''}
function open(id:string,receive:boolean){
 const r=rows().find(r=>r.p.purchaseOrderNo===id);if(!r)throw new Error('采购不存在。');if(receive&&r.blocked)throw new Error(r.blocked)
 selected=id;operationId=`tmf-supply-ui:${crypto.randomUUID()}`
 const field=(name:string,label:string,type='text')=>`<label class="block text-sm mt-3">${label}<input name="${name}" type="${type}" class="border rounded p-2 w-full mt-1" ${type==='number'?'min="0" step="0.001"':''}></label>`
 const known=r.receipts[0]?.purpose??(r.p.tmfTipSource?'TIP_MATERIAL':undefined)
 let content=material(r)+`<p class="mt-3">采购 ${e(id)}；未收 ${Math.round((r.p.orderedQty-r.p.receivedQty)*1000)/1000} ${e(r.p.unit)}</p><p class="text-sm">目标仓 ${e(r.p.warehouse)}</p>`
 if(receive)content+=`<label class="block text-sm mt-3">实际库存用途<select name="purpose" class="border rounded p-2 w-full" ${known?'disabled':''}>${r.p.unit!=='个'?`<option value="BASE_MATERIAL" ${known==='BASE_MATERIAL'?'selected':''}>基础生产原料</option>`:''}<option value="TIP_MATERIAL" ${known==='TIP_MATERIAL'?'selected':''}>打头辅材</option></select></label><p class="text-xs mt-2">用途须符合已确认的材料标准／BOM，不按名称自动判断；不同用途不重复入库。</p>`+field('receipt','本次收货单号')+field('lot','实物批次号')+field('sku','扫描采购物料编码')+field('warehouse','核对并填写采购目标仓')+field('location','实际库位')+field('quantity',`本次清点实收（${r.p.unit}）`,'number')+'<label class="flex gap-2 text-sm mt-3"><input name="confirmed" type="checkbox">确认物料、用途、目标仓及实际数量一致，实物已经收到</label>'
 else content+=r.receipts.map(receipt=>`<article class="border rounded p-3 mt-3"><p>${e(receipt.id)} · ${receipt.quantity} ${receipt.unit}</p><p class="text-xs">${receipt.purpose==='BASE_MATERIAL'?'基础原料':'打头辅材'}；批次 ${e(receipt.lotId)}；${e(receipt.receivedAt)}</p></article>`).join('')||'<p class="text-sm mt-3">尚无本入口的实际收货记录；历史手工到货不等同可用库存。</p>'
 const surface=root()!.querySelector('[data-tmf-supply-dialog]')!;surface.innerHTML=renderDialog({title:receive?'投入料采购实收':'采购实收记录',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},`<div class="max-h-[60vh] overflow-y-auto">${content}</div><p role="alert" data-tmf-supply-error class="text-red-700 text-sm"></p>`,action('close','关闭')+(receive?action('confirm','确认实收'):''));hydrateIcons(surface);surface.setAttribute('tabindex','-1');(surface as HTMLElement).focus({preventScroll:true})
}
function bind(){const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true';controller.installColumnDragEvents()
 el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const text=document.createElement('span');text.textContent='物料图片加载失败';event.target.replaceWith(text)}},true)
 el.addEventListener('change',event=>{const f=event.target as HTMLSelectElement;if(f.getAttribute(`data-${prefix}-field`)==='pageSize'){controller.setPageSize(Number(f.value));refresh()}})
 el.addEventListener('keydown',event=>{if(event.key==='Escape'){const image=el.querySelector('[data-tmf-supply-image]')!;if(image.innerHTML)image.innerHTML='';else{close();state.showColumnSettings=false;controller.refresh({table:false,pagination:false,overlays:true})}}})
 el.addEventListener('click',async event=>{const b=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!b)return;event.stopPropagation();const name=b.getAttribute(`data-${prefix}-action`)
  try{
   if(name==='query'){state.keyword=el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim();state.currentPage=1;refresh()}
   else if(name==='reset'){state.keyword='';el.querySelector<HTMLInputElement>('[name="keyword"]')!.value='';state.currentPage=1;state.sort=null;refresh()}
   else if(name==='export')exportStandardListRows({fileName:'投入料采购实收',columns,rows:filtered()})
   else if(name==='prev-page'||name==='next-page'){controller.stepPage(name==='prev-page'?-1:1);refresh()}
   else if(name==='sort-column'){controller.cycleSort(b.dataset.columnKey||'');refresh()}
   else if(name==='open-column-settings'||name==='close-column-settings'){state.showColumnSettings=name==='open-column-settings';controller.refresh({table:false,pagination:false,overlays:true})}
   else if(name==='restore-column-settings'){controller.restorePreferences();refresh()}
   else if(name==='toggle-column-visibility'||name==='toggle-column-freeze'){controller.updateColumnPreference(name,b.getAttribute(`data-${prefix}-column-key`)||b.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`)||'',b instanceof HTMLInputElement?b.checked:undefined);refresh()}
   else if(name==='receive'||name==='detail')open(b.dataset.id!,name==='receive')
   else if(name==='close')close()
   else if(name==='close-image')el.querySelector('[data-tmf-supply-image]')!.innerHTML=''
   else if(name==='image'){const r=rows().find(r=>r.p.purchaseOrderNo===b.dataset.id);if(r?.p.materialImageUrl)el.querySelector('[data-tmf-supply-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative bg-white rounded p-3"><p>${e(r.p.materialName)} ${action('close-image','关闭')}</p><img src="${e(r.p.materialImageUrl)}" alt="${e(r.p.materialName)}采购物料图" class="max-h-[70vh] max-w-[85vw] object-contain"></div></div>`}
   else if(name==='confirm'){
    const value=(field:string)=>el.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-tmf-supply-dialog] [name="${field}"]`)!.value.trim()
    if(!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked||!value('quantity'))throw new Error('请填写实际数量并核对收货信息后确认。')
    const submitted=operationId; if(b instanceof HTMLButtonElement)b.disabled=true
    try{await receiveTmfSupplyPurchase({receiptId:value('receipt'),purchaseOrderNo:selected,purpose:value('purpose') as 'BASE_MATERIAL'|'TIP_MATERIAL',lotId:value('lot'),scannedMaterialCode:value('sku'),warehouse:value('warehouse'),location:value('location'),quantity:Number(value('quantity'))},actor,submitted)
     if(root()===el){if(operationId===submitted)close();refresh();el.querySelector('[data-tmf-supply-feedback]')!.textContent='本次实际收货已保存；采购实收和投入料批次同步，后续发料不会重复累计采购实收。'}
    }finally{if(b instanceof HTMLButtonElement)b.disabled=false}
   }
  }catch(error){const target=el.querySelector('[data-tmf-supply-error]')??el.querySelector('[data-tmf-supply-feedback]');if(target)target.textContent=error instanceof Error?error.message:'未保存，请重试。'}
 })
}
export function renderTmfSupplyPurchaseReceiptsPage(){state.currentPage=1;state.sort=null;controller.ensurePreferencesLoaded();const view=controller.getView();if(typeof window!=='undefined')requestAnimationFrame(bind);return `<div data-tmf-supply-receipts>${renderStandardListPage({title:'织带投入料采购实收',primaryActionsHtml:'<span class="text-xs">原料／辅料仓管（演示）</span>',feedbackHtml:'<p role="status" data-tmf-supply-feedback class="text-sm text-blue-700"></p>',filtersHtml:`<div class="border rounded bg-white p-3"><label class="text-sm">采购单 / 物料 / 目标仓<input name="keyword" value="${e(state.keyword)}" class="block border rounded p-2 mt-1 w-72 max-w-full"></label><div class="flex gap-2 mt-3">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`,statsHtml:`<div data-tmf-supply-stats>${stats()}</div>`,listTitle:`投入料采购 · ${filtered().length} 单`,listActionsHtml:action('open-column-settings','列设置'),tableHtml:`<div data-tmf-supply-table>${view.tableHtml}</div>`,paginationHtml:`<div data-tmf-supply-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-tmf-supply-columns>${controller.renderColumnSettings()}</div><div data-tmf-supply-dialog></div><div data-tmf-supply-image></div>`})}</div>`}
