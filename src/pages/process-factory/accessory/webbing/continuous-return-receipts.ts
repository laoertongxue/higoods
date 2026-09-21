// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfPurchaseState, receiveTmfContinuousReturn } from '../../../../data/pms/tmf-material-purchases.ts'

const prefix='tmf-return-receipts', selector='[data-tmf-return-receipts]'
const state:ProcessOrderListControllerState & {keyword:string;status:string}={currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:10},preferencesLoaded:false,showColumnSettings:false,keyword:'',status:''}
const actor={id:'TMF-DEMO-WAREHOUSE-CLERK',name:'辅料仓管（演示）',role:'仓管' as const}
const action=(name:string,label:string,id='')=>`<button type="button" class="border rounded px-3 py-2 text-xs ${['receive','confirm','query'].includes(name)?'bg-blue-600 text-white':''}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
const round=(n:number)=>Math.round(n*1000)/1000
function rows(){
 const data=getTmfPurchaseState()
 return data.continuousReturns.map(returned=>{
  const issue=data.processingIssues.find(i=>i.id===returned.sourceIssueId)
  const sourceLot=data.lots.find(l=>l.id===issue?.lotId)
  const purchase=data.orders.find(p=>p.purchaseOrderNo===sourceLot?.sourcePurchaseOrderNo&&p.purchaseLineId===sourceLot?.sourcePurchaseLineId)
  const demand=data.demands.find(d=>d.id===issue?.demandId)
  return {returned,purchase,demand,lot:data.lots.find(l=>l.id===returned.batchId),status:returned.receivedMeters===returned.dispatchedMeters?'已收齐':returned.receivedMeters?'部分实收':'待实收'}
 })
}
type Row=ReturnType<typeof rows>[number]
const filtered=()=>rows().filter(r=>(!state.status||r.status===state.status)&&(!state.keyword||[r.returned.id,r.returned.batchId,r.returned.materialSkuId,r.demand?.productionOrderNo].join(' ').toLowerCase().includes(state.keyword.toLowerCase())))
const columns:StandardListColumn<Row>[]=[
 {key:'return',title:'退料单 / 批次',width:230,required:true,freezeable:true,sortable:true,sortValue:r=>r.returned.id,render:r=>`<strong>${e(r.returned.id)}</strong><div class="text-xs break-all">${e(r.returned.batchId)}</div>`},
 {key:'material',title:'连续半成品',width:240,required:true,render:r=>`<div class="flex gap-2">${r.purchase?.materialImageUrl?`<button data-${prefix}-action="image" data-id="${e(r.returned.id)}" data-skip-page-rerender="true"><img class="h-12 w-12 object-cover rounded border" src="${e(r.purchase.materialImageUrl)}" alt="${e(r.purchase.materialName)}半成品参考图"></button>`:'<span class="text-amber-700 text-xs">缺物料实图</span>'}<div>${e(r.purchase?.materialName??'连续半成品')}<div class="text-xs">${e(r.returned.materialSkuId)}</div><div class="text-xs">未截断 · 按米收货</div></div></div>`},
 {key:'source',title:'生产来源 / 加工投入',width:240,render:r=>`${e(r.demand?.productionOrderNo??'来源缺失')}<div class="text-xs break-all">${e(r.returned.sourceIssueId)}</div>`},
 {key:'quantity',title:'交回 / 实收 / 待收',width:180,required:true,render:r=>`${r.returned.dispatchedMeters} / ${r.returned.receivedMeters} / ${round(r.returned.dispatchedMeters-r.returned.receivedMeters)} 米`},
 {key:'location',title:'目标仓 / 库位',width:180,render:r=>`${e(r.returned.warehouseId)}<div>${e(r.lot?.location??'待上架')}</div>`},
 {key:'status',title:'收货状态',width:100,render:r=>r.status},
 {key:'actions',title:'操作',width:170,required:true,actionColumn:true,render:r=>action('detail','详情',r.returned.id)+(r.status!=='已收齐'?action('receive','登记实收',r.returned.id):'')},
]
const controller=createProcessOrderListController({state,columns,preferenceKey:'higood:list:/wls/accessory-receipts:tmf-return',eventPrefix:prefix,rootSelector:selector,tableSurfaceSelector:'[data-tmf-return-table]',paginationSurfaceSelector:'[data-tmf-return-pagination]',overlaysSurfaceSelector:'[data-tmf-return-columns]',defaultFrozenKeys:['return'],pageSizeOptions:[10,20,50],getRows:filtered,locallyManagedEvents:true,emptyText:'暂无工厂实际交出的连续余料。',columnSettingsTitle:'余料回仓列设置'})
const stats=()=>renderStandardListStats([{label:'当前查询',value:`${filtered().length} 单`},{label:'待收米数',value:`${round(filtered().reduce((s,r)=>s+r.returned.dispatchedMeters-r.returned.receivedMeters,0))} 米`},{label:'已收米数',value:`${round(filtered().reduce((s,r)=>s+r.returned.receivedMeters,0))} 米`}])
const root=()=>document.querySelector<HTMLElement>(selector)
let selected='',operationId=''
function refresh(){controller.refresh({overlays:true});const el=root();if(!el)return;el.querySelector('[data-tmf-return-stats]')!.innerHTML=stats();const title=el.querySelector('[data-standard-list-table-section] > header h2');if(title)title.textContent=`连续余料 · ${filtered().length} 单`}
function close(){root()?.querySelector('[data-tmf-return-dialog]')?.replaceChildren();selected=operationId=''}
function open(id:string,receive:boolean){
 const r=rows().find(r=>r.returned.id===id);if(!r)throw new Error('退料单不存在，请刷新核对。');selected=id;operationId=`tmf-return-ui:${crypto.randomUUID()}`
 const field=(name:string,label:string,type='text',value='')=>`<label class="block mt-3 text-sm">${label}<input name="${name}" type="${type}" value="${e(value)}" class="w-full block border rounded p-2 mt-1" ${type==='number'?'min="0" step="0.001"':''}></label>`
 const content=`<div class="max-h-[60vh] overflow-y-auto"><p>退料单 ${e(id)}；生产单 ${e(r.demand?.productionOrderNo??'')}</p><p>物料 ${e(r.returned.materialSkuId)}；批次 ${e(r.returned.batchId)}</p><p>交回 ${r.returned.dispatchedMeters} 米；已收 ${r.returned.receivedMeters} 米</p><p>退料原因：${e(r.returned.reason)}</p><p class="text-xs text-slate-500">未截断连续料回原仓；采购累计实收保持不变。</p>${receive?field('batch','扫描回仓批次')+field('sku','扫描物料 SKU')+field('quantity','本次实际实收（米）','number')+field('location','实际库位','text',r.lot?.location??'')+'<label class="flex gap-2 mt-3 text-sm"><input type="checkbox" name="continuous">已核对实物为未截断连续料</label>':`<p>回仓批次实存 ${r.lot?.onHandMeters??0} 米；库位 ${e(r.lot?.location??'未上架')}</p>${getTmfPurchaseState().operations.filter(o=>o.objectId===id).map(o=>`<p class="text-xs mt-2">${e(o.occurredAt)} · ${e(o.actor.name)} · ${o.quantity} ${e(o.unit??'')}</p>`).join('')}`}</div><p role="alert" data-tmf-return-error class="text-red-700 text-sm"></p>`
 const surface=root()!.querySelector('[data-tmf-return-dialog]')!;surface.innerHTML=renderDialog({title:receive?'连续余料回仓实收':'连续余料收货详情',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},content,action('close','关闭')+(receive?action('confirm','确认实收'):''));hydrateIcons(surface)
}
function bind(){const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true';controller.installColumnDragEvents()
 el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)
 el.addEventListener('change',event=>{const f=event.target as HTMLSelectElement;if(f.getAttribute(`data-${prefix}-field`)==='pageSize'){controller.setPageSize(Number(f.value));refresh()}})
 el.addEventListener('keydown',event=>{if(event.key==='Escape'){const image=el.querySelector('[data-tmf-return-image]')!;if(image.innerHTML)image.innerHTML='';else {close();state.showColumnSettings=false;controller.refresh({table:false,pagination:false,overlays:true})}}})
 el.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!button)return;event.stopPropagation();const name=button.getAttribute(`data-${prefix}-action`)
  try{
   if(name==='query'){state.keyword=el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim();state.status=el.querySelector<HTMLSelectElement>('[name="status"]')!.value;state.currentPage=1;refresh()}
   else if(name==='reset'){state.keyword=state.status='';el.querySelector<HTMLInputElement>('[name="keyword"]')!.value='';el.querySelector<HTMLSelectElement>('[name="status"]')!.value='';state.currentPage=1;state.sort=null;refresh()}
   else if(name==='export')exportStandardListRows({fileName:'织带连续余料回仓',columns,rows:filtered()})
   else if(name==='prev-page'||name==='next-page'){controller.stepPage(name==='prev-page'?-1:1);refresh()}
   else if(name==='sort-column'){controller.cycleSort(button.dataset.columnKey||'');refresh()}
   else if(name==='open-column-settings'||name==='close-column-settings'){state.showColumnSettings=name==='open-column-settings';controller.refresh({table:false,pagination:false,overlays:true})}
   else if(name==='restore-column-settings'){controller.restorePreferences();refresh()}
   else if(name==='toggle-column-visibility'||name==='toggle-column-freeze'){controller.updateColumnPreference(name,button.getAttribute(`data-${prefix}-column-key`)||button.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`)||'',button instanceof HTMLInputElement?button.checked:undefined);refresh()}
   else if(name==='receive'||name==='detail')open(button.dataset.id||'',name==='receive')
   else if(name==='close')close()
   else if(name==='close-image')el.querySelector('[data-tmf-return-image]')!.innerHTML=''
   else if(name==='image'){const r=rows().find(r=>r.returned.id===button.dataset.id);if(r?.purchase?.materialImageUrl)el.querySelector('[data-tmf-return-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative bg-white p-3 rounded"><p>半成品参考图 ${action('close-image','关闭')}</p><img class="max-h-[70vh] max-w-[85vw] object-contain" src="${e(r.purchase.materialImageUrl)}" alt="${e(r.purchase.materialName)}半成品参考图"></div></div>`}
   else if(name==='confirm'){
    const r=rows().find(r=>r.returned.id===selected);if(!r)throw new Error('退料单不存在。')
    const value=(name:string)=>el.querySelector<HTMLInputElement>(`[data-tmf-return-dialog] [name="${name}"]`)!.value.trim()
    if(value('batch')!==r.returned.batchId)throw new Error('回仓批次不符，请核对实物标签。')
    if(!el.querySelector<HTMLInputElement>('[name="continuous"]')!.checked)throw new Error('请核对实物为未截断连续料；条料不能按米收回。')
    receiveTmfContinuousReturn({returnId:r.returned.id,warehouseId:r.returned.warehouseId,materialSkuId:value('sku'),location:value('location'),receivedMeters:Number(value('quantity'))},actor,operationId)
    close();refresh();el.querySelector('[data-tmf-return-feedback]')!.textContent='连续余料实收已保存，已增加回仓批次库存，未增加采购实收。'
   }
  }catch(error){const target=el.querySelector('[data-tmf-return-error]')??el.querySelector('[data-tmf-return-feedback]');if(target)target.textContent=error instanceof Error?error.message:'未保存，请重试。'}
 })
}
export function renderTmfContinuousReturnReceiptsPage():string{
 state.currentPage=1;state.sort=null;controller.ensurePreferencesLoaded();const view=controller.getView();if(typeof window!=='undefined')requestAnimationFrame(bind)
 return `<div data-tmf-return-receipts>${renderStandardListPage({title:'织带／绳子连续余料回仓',primaryActionsHtml:'<span class="text-xs text-slate-500">辅料仓 · 仓管演示身份</span>',feedbackHtml:'<p role="status" data-tmf-return-feedback class="text-blue-700 text-sm"></p>',filtersHtml:`<div class="rounded border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">生产单 / 退料单 / 批次 / SKU<input name="keyword" value="${e(state.keyword)}" class="block border rounded p-2 mt-1 w-72 text-sm"></label><label class="text-xs">收货进度<select name="status" class="block border rounded p-2 mt-1 text-sm"><option value="">全部</option>${['待实收','部分实收','已收齐'].map(s=>`<option ${state.status===s?'selected':''}>${s}</option>`).join('')}</select></label></div><div class="flex gap-2 mt-3">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`,statsHtml:`<div data-tmf-return-stats>${stats()}</div>`,listTitle:`连续余料 · ${filtered().length} 单`,listActionsHtml:action('open-column-settings','列设置'),tableHtml:`<div data-tmf-return-table>${view.tableHtml}</div>`,paginationHtml:`<div data-tmf-return-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-tmf-return-columns>${controller.renderColumnSettings()}</div><div data-tmf-return-dialog></div><div data-tmf-return-image></div>`})}</div>`
}
