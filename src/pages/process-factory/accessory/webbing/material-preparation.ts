import { getWebbingPhysicalSpecificationKey } from '../../../../data/fcs/webbing-specifications.ts'
import {readTmfUpstreamProcessOrders} from '../../../../data/fcs/tmf-upstream-process-orders.ts'
import {getTmfUpstreamReceivedMeters,tmfUpstreamReceivingId} from '../../../../data/fcs/tmf-upstream-receiving.ts'
// @page-pattern: list
import { renderTmfTipMaterialDispatchForm, readTmfTipMaterialDispatchForm } from './tip-material-dispatch-form.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfPurchaseState, getTmfContinuousLotEntry, issueTmfMergedContinuousMaterial, reserveTmfContinuousMaterial, releaseTmfContinuousReservation, issueTmfContinuousMaterial, issueTmfUpstreamMaterial, dispatchTmfTipMaterial, receiveTmfTipMaterialReturn } from '../../../../data/pms/tmf-material-purchases.ts'
const prefix='tmf-preparation',selector='[data-tmf-preparation]'
const actor={id:'TMF-DEMO-WAREHOUSE-SUPERVISOR',name:'辅料仓主管（演示）',role:'仓库主管' as const}
const round=(n:number)=>Math.round(n*1000)/1000
const state:ProcessOrderListControllerState & {keyword:string}={currentPage:1,sort:null,preferences:{order:[],visibleKeys:[],frozenKeys:[],pageSize:10},preferencesLoaded:false,showColumnSettings:false,keyword:''}
const action=(name:string,label:string,id='')=>`<button type="button" class="border rounded px-3 py-2 text-xs ${['confirm','prepare','query'].includes(name)?'bg-blue-600 text-white':''}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
function rows(){const data=getTmfPurchaseState();return data.demands.map(d=>{
 const reservations=data.reservations.filter(r=>r.demandId===d.id),issues=data.processingIssues.filter(i=>i.demandId===d.id)
 const lots=data.lots.filter(l=>getTmfContinuousLotEntry(d.id,l.id))
 return {d,reservations,issues,lots,material:data.orders.find(p=>p.materialSkuId===d.sourceMaterialSkuId),control:data.productionControls.find(c=>c.productionOrderId===d.productionOrderId),root:d.routeSnapshot.find(r=>r.id===d.sourceRouteEntryId),reserved:round(reservations.reduce((n,r)=>n+r.reservedMeters,0)),issued:round(issues.reduce((n,i)=>n+i.dispatchedMeters,0)),received:round(issues.reduce((n,i)=>n+(i.upstream?getTmfUpstreamReceivedMeters(i.id):i.receivedMeters),0)),available:round(lots.reduce((n,l)=>n+l.onHandMeters-l.reservedMeters-l.frozenMeters,0))}
})}
type Row=ReturnType<typeof rows>[number]
const filtered=()=>rows().filter(r=>!state.keyword||[r.d.productionOrderNo,r.d.sourceMaterialSkuId,r.d.garmentSize,r.d.specification.usage].join(' ').toLowerCase().includes(state.keyword.toLowerCase()))
const columns:StandardListColumn<Row>[]=[
 {key:'demand',title:'生产单 / 需求规格',width:240,required:true,freezeable:true,sortable:true,sortValue:r=>r.d.productionOrderNo,render:r=>`<strong>${e(r.d.productionOrderNo)}</strong><div>${e(r.d.specification.usage)} · ${e(r.d.garmentSize)} · ${r.d.specification.cutLengthMm}mm</div><div class="text-xs">${r.d.requiredPieces} 条/根；技术包 ${e(r.d.techPackVersionId)}</div>`},
 {key:'material',title:'首道投入半成品',width:250,required:true,render:r=>`<div class="flex gap-2">${r.material?.materialImageUrl?`<button data-${prefix}-action="image" data-id="${e(r.d.id)}" data-skip-page-rerender="true"><img src="${e(r.material.materialImageUrl)}" alt="${e(r.material.materialName)}半成品参考图" class="h-12 w-12 rounded border object-cover"></button>`:'<span class="text-xs text-amber-700">缺物料实图</span>'}<div>${e(r.material?.materialName??r.d.sourceMaterialSkuId)}<div class="text-xs break-all">${e(r.d.sourceMaterialSkuId)}</div></div></div>`},
 {key:'quantity',title:'理论 / 未发占用 / 已发',width:200,required:true,render:r=>`${r.d.theoreticalCutMeters} / ${r.reserved} / ${r.issued} 米<div class="text-xs">工厂实际已收 ${r.received} 米</div>`},
 {key:'available',title:'匹配连续料可用',width:150,render:r=>`${r.available} 米<div class="text-xs">含可接续截断的回料；多需求共用，不逐行相加</div>`},
 {key:'route',title:'首道工艺 / 限制',width:190,render:r=>`${e(r.root?.processName??'路线缺失')}${r.root?.processCode!=='WEBBING_CUT'?'<p class="text-amber-700 text-xs">按正式印染单指定工厂发出</p>':''}${r.control&&r.control.status!=='ACTIVE'?'<p class="text-amber-700">生产单受限</p>':''}`},
 {key:'actions',title:'操作',width:130,required:true,actionColumn:true,render:r=>action('prepare','备料与发出',r.d.id)+(r.root?.processCode==='WEBBING_CUT'?action('merge','同规格合并发料',r.d.id):'')},
]
const controller=createProcessOrderListController({state,columns,preferenceKey:'higood:list:/wls/accessory-material-preparation',eventPrefix:prefix,rootSelector:selector,tableSurfaceSelector:'[data-tmf-preparation-table]',paginationSurfaceSelector:'[data-tmf-preparation-pagination]',overlaysSurfaceSelector:'[data-tmf-preparation-columns]',defaultFrozenKeys:['demand'],pageSizeOptions:[10,20,50],getRows:filtered,locallyManagedEvents:true,emptyText:'暂无从生产单生成的织带加工需求。',columnSettingsTitle:'连续料备料列设置'})
const stats=()=>renderStandardListStats([{label:'当前需求',value:`${filtered().length} 条`},{label:'未发占用',value:`${round(filtered().reduce((n,r)=>n+r.reserved,0))} 米`},{label:'已发出',value:`${round(filtered().reduce((n,r)=>n+r.issued,0))} 米`}])
const root=()=>document.querySelector<HTMLElement>(selector)
let demandId='',selected='',mode='',operationId=''
function refresh(){controller.refresh({overlays:true});const el=root();if(!el)return;el.querySelector('[data-tmf-preparation-stats]')!.innerHTML=stats();const title=el.querySelector('[data-standard-list-table-section] > header h2');if(title)title.textContent=`备料需求 · ${filtered().length} 条`}
function close(){root()?.querySelector('[data-tmf-preparation-dialog]')?.replaceChildren();demandId=selected=mode=operationId=''}
function open(id:string,next='prepare',reservationId=''){
 const row=rows().find(r=>r.d.id===id);if(!row)throw new Error('生产需求不存在。');demandId=id;mode=next;selected=reservationId;operationId=`tmf-preparation-ui:${crypto.randomUUID()}`
 const field=(name:string,label:string,type='text')=>`<label class="block mt-3 text-sm">${label}<input name="${name}" type="${type}" class="w-full border rounded p-2 mt-1" ${type==='number'?'min="0" step="0.001"':''}></label>`
 const select=(name:string,label:string,html:string)=>`<label class="block mt-3 text-sm">${label}<select name="${name}" class="w-full border rounded p-2 mt-1">${html}</select></label>`
 let content=`<p>${e(row.d.productionOrderNo)} · ${e(row.d.specification.usage)} · ${e(row.d.garmentSize)} · ${row.d.specification.cutLengthMm}mm</p><p class="text-xs break-all">首道投入 ${e(row.d.sourceMaterialSkuId)}；理论 ${row.d.theoreticalCutMeters} 米</p>`
 if(next==='prepare')content+=`<div class="mt-3">${action('reserve','按批次占用',id)}</div><h3 class="mt-3 font-medium">批次占用与已发记录</h3>${row.reservations.map(r=>`<article class="border rounded p-3 mt-2"><p>批次 ${e(r.lotId)} · ${e(row.lots.find(l=>l.id===r.lotId)?.materialSkuId??'来源待核对')} · 投入 ${e(row.d.routeSnapshot.find(n=>n.id===(r.targetRouteEntryId??row.d.sourceRouteEntryId))?.processName??'待核对')}；未发占用 ${r.reservedMeters} 米；累计已发 ${r.issuedMeters} 米</p><div class="flex gap-2 mt-2">${r.reservedMeters>0?action('issue','登记实际发出',r.id)+action('release','释放未发占用',r.id):''}</div>${row.issues.filter(i=>i.reservationId===r.id).map(i=>`<p class="mt-2 text-xs">发料 ${e(i.id)}${i.mergedBatchId?` · 合并批 ${e(i.mergedBatchId)}`:''}：已发 ${i.dispatchedMeters} 米，工厂实收 ${i.upstream?getTmfUpstreamReceivedMeters(i.id):i.receivedMeters} 米${i.upstream?` · ${e(i.upstream.orderNo)} <a class="text-blue-700" href="/fcs/craft/${i.upstream.processCode==='DYE'?'dyeing':'printing'}/pending-receipts?sourceId=${encodeURIComponent(tmfUpstreamReceivingId(i.id))}">查看工厂实收</a>`:''}</p>`).join('')}</article>`).join('')||'<p>尚无占用。</p>'}`
 if(next==='prepare'&&row.d.specification.tippingRequired)content+=`<h3 class="font-medium mt-4">打头辅材</h3><div class="mt-2">${action('tip-issue','发出打头辅材',id)}</div>${getTmfPurchaseState().tipMaterialIssues.filter(i=>i.demandId===id).map(i=>`<p class="text-sm mt-2">${e(i.id)} · ${e(i.materialSkuId)}<span class="block text-xs">来源批次 ${e(i.stockLotId??'历史缺来源批次')}；已发 ${i.dispatchedQty} ${i.unit}，工厂实收 ${i.receivedQty} ${i.unit}</span></p>`).join('')}`
 if(next==='prepare'){
  const data=getTmfPurchaseState(),issueIds=new Set(data.tipMaterialIssues.filter(i=>i.demandId===id).map(i=>i.id))
  content+=data.tipMaterialReturns.filter(r=>issueIds.has(r.sourceIssueId)).map(r=>{const lot=data.tipMaterialLots.find(l=>l.id===r.stockLotId)!;return `<article class="border rounded p-3 mt-3"><p>辅材退料 ${e(r.id)} · ${e(lot.materialSkuId)}</p><p>来源批次 ${e(r.stockLotId)}；交回 ${r.dispatchedQty}，已收 ${r.receivedQty} ${lot.unit}</p><p class="text-xs">${e(r.reason)}</p>${r.receivedQty<r.dispatchedQty?action('tip-return','登记辅材退回实收',r.id):''}</article>`}).join('')
 }
 if(next==='tip-return'){
  const data=getTmfPurchaseState(),returned=data.tipMaterialReturns.find(r=>r.id===reservationId),issue=data.tipMaterialIssues.find(i=>i.id===returned?.sourceIssueId&&i.demandId===id),lot=data.tipMaterialLots.find(l=>l.id===returned?.stockLotId)
  if(!returned||!issue||!lot)throw new Error('辅材退料不属于当前需求或缺来源批次。')
  content+=`<p class="mt-3">${e(lot.materialSkuId)} · 退料 ${e(returned.id)}；待收 ${round(returned.dispatchedQty-returned.receivedQty)} ${lot.unit}</p><p>回原仓 ${e(lot.warehouseId)} / ${e(lot.location)}，原批次 ${e(lot.id)}</p><p class="text-xs text-amber-700">辅材实图待补，请核对实际物料</p>`+field('returnScan','扫描退料单号')+field('sku','扫描辅材SKU')+field('quantity',`本次实收（${lot.unit}）`,'number')+'<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认未用辅材与来源规格一致，实物已回原仓原库位</label>'
 }
 if(next==='merge'){
  const data=getTmfPurchaseState(),key=getWebbingPhysicalSpecificationKey(row.d.specification)
  content+=`<div class="flex gap-2 items-center mt-3">${row.material?.materialImageUrl?`<button type="button" data-${prefix}-action="image" data-id="${e(row.d.id)}" data-skip-page-rerender="true"><img src="${e(row.material.materialImageUrl)}" alt="${e(row.material.materialName)}半成品参考图" class="h-12 w-12 object-cover rounded"></button>`:'<span class="text-amber-700 text-xs">缺物料实图</span>'}<span>${e(row.material?.materialName??row.d.sourceMaterialSkuId)}<span class="block text-xs">半成品参考；实际幅宽/绳径须核对物料资料</span></span></div>`

  const candidates=rows().filter(r=>r.root?.processCode==='WEBBING_CUT'&&r.d.materialSkuId===row.d.materialSkuId&&getWebbingPhysicalSpecificationKey(r.d.specification)===key&&(!r.control||r.control.status==='ACTIVE'))
  content+=`<p class="mt-3 text-sm">接收工厂：TMF－辅料厂。仅列同SKU、同长度和端头要求的未发占用；选择同一仓库、不同需求的至少两行。数量继续归属各生产单。</p>`+field('mergedBatch','合并批号')+field('reason','合并原因')
  content+=candidates.flatMap(r=>r.reservations.filter(x=>x.reservedMeters>0).map(x=>{const lot=data.lots.find(l=>l.id===x.lotId)!;return `<article class="border rounded p-3 mt-3" data-merge-line data-reservation="${e(x.id)}" data-lot="${e(x.lotId)}"><label class="flex gap-2"><input type="checkbox" name="mergeSelected">${e(r.d.productionOrderNo)} · ${e(r.d.specification.usage)} · ${e(r.d.garmentSize)}</label><p class="text-xs mt-2">${e(lot.warehouseId)} / ${e(lot.location)} · 批次 ${e(x.lotId)} · 未发占用 ${x.reservedMeters} 米</p><label class="block text-sm mt-2">扫描实物批次<input name="mergeLot" class="border rounded p-2 w-full"></label><label class="block text-sm mt-2">本次实际发出（米）<input name="mergeMeters" type="number" min="0" step="0.001" class="border rounded p-2 w-full"></label></article>`})).join('')||'<p class="mt-3">暂无可合并的未发占用，请先按需求备料。</p>'
  content+=field('sku','扫描共同半成品SKU')+'<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认所选各行的批次、米数及TMF接收工厂与实际交接一致</label>'
 }
 if(next==='tip-issue')content+=renderTmfTipMaterialDispatchForm(row.d)
 if(next==='reserve')content+=select('lot','可用实收批次','<option value="">请选择批次</option>'+row.lots.filter(l=>l.onHandMeters-l.reservedMeters-l.frozenMeters>0).map(l=>`<option value="${e(l.id)}">${e(l.id)} · ${e(l.materialSkuId)} · 投入${e(getTmfContinuousLotEntry(row.d.id,l.id)?.processName??'待核对')} · ${e(l.warehouseId)} / ${e(l.location)} · 可用 ${round(l.onHandMeters-l.reservedMeters-l.frozenMeters)} 米</option>`).join(''))+field('quantity','本次占用（米）','number')+field('reason','超过理论需求时填写损耗或补做依据')
 if(next==='reserve'&&row.lots.some(l=>l.materialSkuId!==row.d.sourceMaterialSkuId))content+='<p class="text-xs text-amber-700 mt-2">加工后半成品对应实物图待补；首道物料图片不代表染色或印花后的实物。</p>'
 if(next==='release'||next==='issue'){
  const r=row.reservations.find(r=>r.id===reservationId);if(!r)throw new Error('占用不属于当前需求。')
  const target=getTmfContinuousLotEntry(row.d.id,r.lotId);if(!target)throw new Error('批次投入来源失效，请重新核对。')
  content+=`<p class="mt-3">批次 ${e(r.lotId)}；当前未发占用 ${r.reservedMeters} 米</p><p class="text-sm">实际SKU ${e(row.lots.find(l=>l.id===r.lotId)?.materialSkuId??'待核对')} · 投入 ${e(target.processName)}${r.targetRouteEntryId?'；已加工回仓连续料，按截断要求使用':''}</p>`+field('quantity',next==='release'?'本次释放（米）':'本次实际发出（米）','number')
  if(r.targetRouteEntryId)content+='<p class="text-xs text-amber-700 mt-2">缺此加工后SKU的对应实物图，须补齐原加工产出资料。</p>'
  content+=next==='release'?field('reason','释放原因')+'<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认只释放未发占用，已发物料不撤回</label>':field('issue','本次发料单号')+field('batch','扫描实物批次')+field('sku','扫描物料SKU')+`<p class="mt-3 text-sm">${target.processCode==='WEBBING_CUT'?'接收工厂：TMF－辅料厂': '接收工厂按首道正式印染加工单核对'}。</p>${target.processCode==='WEBBING_CUT'?'':'<p data-tmf-expected-factory class="text-sm mt-2">正在读取正式加工单接收工厂…</p><label class="block mt-2 text-sm">扫描确认接收工厂编号<input name="targetFactory" class="border rounded p-2 w-full"></label>'}<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认批次、米数及接收工厂与实物交接一致</label>`
 }
 const surface=root()!.querySelector('[data-tmf-preparation-dialog]')!;surface.innerHTML=renderDialog({title:({'tip-return':'未用辅材回仓实收','tip-issue':'打头辅材实际发出',prepare:'连续料备料与发出',reserve:'占用连续半成品',release:'释放未发占用',issue:'实际交出连续料',merge:'同规格合并发料'})[next]??'备料',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},`<div class="max-h-[60vh] overflow-y-auto">${content}</div><p role="alert" data-tmf-preparation-error class="text-red-700 text-sm"></p>`,action('close','关闭')+(next==='prepare'?'':action('confirm','确认')));hydrateIcons(surface);surface.setAttribute('tabindex','-1');(surface as HTMLElement).focus({preventScroll:true})
 const expected = surface.querySelector('[data-tmf-expected-factory]')
 if(expected)void readTmfUpstreamProcessOrders([row.d]).then(stages=>{
  if(!expected.isConnected)return
  const stage=stages.find(s=>s.entryId===row.d.sourceRouteEntryId),order=stage?.rows[0]
  expected.textContent=stage?.matchedOrderId&&order?`正式加工单 ${order.no}；接收工厂 ${order.factoryName}（${order.factoryId}）`:`不可交出：${stage?.state??'缺少首道加工单'}。请先核对正式加工单。`
 }).catch(error=>{if(expected.isConnected)expected.textContent=`读取接收工厂失败：${error instanceof Error?error.message:'请重试'}`})
}
function bind(){const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true';controller.installColumnDragEvents()
 el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)
 el.addEventListener('change',event=>{const f=event.target as HTMLSelectElement;if(f.getAttribute(`data-${prefix}-field`)==='pageSize'){controller.setPageSize(Number(f.value));refresh()}})
 el.addEventListener('keydown',event=>{if(event.key==='Escape'){const img=el.querySelector('[data-tmf-preparation-image]')!;if(img.innerHTML)img.innerHTML='';else{close();state.showColumnSettings=false;controller.refresh({table:false,pagination:false,overlays:true})}}})
 el.addEventListener('click',async event=>{const b=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!b)return;event.stopPropagation();const name=b.getAttribute(`data-${prefix}-action`)
  try{
   if(name==='query'){state.keyword=el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim();state.currentPage=1;refresh()}
   else if(name==='reset'){state.keyword='';el.querySelector<HTMLInputElement>('[name="keyword"]')!.value='';state.currentPage=1;state.sort=null;refresh()}
   else if(name==='export')exportStandardListRows({fileName:'织带连续料备料',columns,rows:filtered()})
   else if(name==='prev-page'||name==='next-page'){controller.stepPage(name==='prev-page'?-1:1);refresh()}
   else if(name==='sort-column'){controller.cycleSort(b.dataset.columnKey||'');refresh()}
   else if(name==='open-column-settings'||name==='close-column-settings'){state.showColumnSettings=name==='open-column-settings';controller.refresh({table:false,pagination:false,overlays:true})}
   else if(name==='restore-column-settings'){controller.restorePreferences();refresh()}
   else if(name==='toggle-column-visibility'||name==='toggle-column-freeze'){controller.updateColumnPreference(name,b.getAttribute(`data-${prefix}-column-key`)||b.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`)||'',b instanceof HTMLInputElement?b.checked:undefined);refresh()}
   else if(name==='prepare'||name==='reserve'||name==='tip-issue'||name==='merge')open(b.dataset.id||'',name)
   else if(name==='issue'||name==='release'||name==='tip-return')open(demandId,name,b.dataset.id||'')
   else if(name==='close')close()
   else if(name==='close-image')el.querySelector('[data-tmf-preparation-image]')!.innerHTML=''
   else if(name==='image'){const r=rows().find(r=>r.d.id===b.dataset.id);if(r?.material?.materialImageUrl)el.querySelector('[data-tmf-preparation-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative bg-white p-3 rounded"><p>半成品参考图 ${action('close-image','关闭')}</p><img src="${e(r.material.materialImageUrl)}" alt="${e(r.material.materialName)}半成品参考图" class="max-h-[70vh] max-w-[85vw] object-contain"></div></div>`}
   else if(name==='confirm'){
    const row=rows().find(r=>r.d.id===demandId);if(!row)throw new Error('来源需求不存在。')
    const value=(name:string)=>el.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-tmf-preparation-dialog] [name="${name}"]`)!.value.trim(),quantity=mode==='merge'?0:Number(value('quantity'))
    if(mode==='merge'){
     if(value('sku')!==row.d.sourceMaterialSkuId||!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked)throw new Error('请扫描正确的半成品SKU并确认实际交接。')
     const lines=Array.from(el.querySelectorAll<HTMLElement>('[data-merge-line]')).filter(line=>line.querySelector<HTMLInputElement>('[name="mergeSelected"]')!.checked).map(line=>{
      if(line.querySelector<HTMLInputElement>('[name="mergeLot"]')!.value.trim()!==line.dataset.lot)throw new Error('所选行的实物批次不符，请逐行扫码核对。')
      return {issueId:`${operationId}:${line.dataset.reservation}`,reservationId:line.dataset.reservation!,targetFactoryId:'FAC-TMF',dispatchedMeters:Number(line.querySelector<HTMLInputElement>('[name="mergeMeters"]')!.value)}
     })
     issueTmfMergedContinuousMaterial({batchId:value('mergedBatch'),lines,reason:value('reason')},actor,operationId)
    }
    if(mode==='tip-return'){const data=getTmfPurchaseState(),returned=data.tipMaterialReturns.find(r=>r.id===selected),issue=data.tipMaterialIssues.find(i=>i.id===returned?.sourceIssueId&&i.demandId===demandId),lot=data.tipMaterialLots.find(l=>l.id===returned?.stockLotId);if(!returned||!issue||!lot||value('returnScan')!==returned.id||!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked)throw new Error('请核对退料单、实物数量及原仓库位后确认。');receiveTmfTipMaterialReturn({returnId:returned.id,warehouseId:lot.warehouseId,materialSkuId:value('sku'),unit:lot.unit,quantity},actor,operationId)}
    if(mode==='tip-issue')dispatchTmfTipMaterial(readTmfTipMaterialDispatchForm(el.querySelector('[data-tmf-preparation-dialog]')!,row.d),actor,operationId)
    if(mode==='reserve')reserveTmfContinuousMaterial({reservationId:`${operationId}:reservation`,demandId,lotId:value('lot'),reservedMeters:quantity,reason:value('reason')},actor,operationId)
    if(mode==='release'||mode==='issue'){
     if(!el.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked)throw new Error('请核对本次操作及实物数量后确认。')
     const reservation=row.reservations.find(r=>r.id===selected);if(!reservation)throw new Error('原占用不存在。')
     if(mode==='release')releaseTmfContinuousReservation(selected,quantity,value('reason'),actor,operationId)
     else {const lot=getTmfPurchaseState().lots.find(l=>l.id===reservation.lotId),entry=getTmfContinuousLotEntry(row.d.id,reservation.lotId);if(!lot||!entry)throw new Error('占用批次或投入来源失效。');if(value('batch')!==reservation.lotId||value('sku')!==lot.materialSkuId)throw new Error('所扫批次或SKU不符，不能按其他物料发出。');await (entry.processCode==='WEBBING_CUT'?issueTmfContinuousMaterial({issueId:value('issue'),reservationId:selected,targetFactoryId:'FAC-TMF',dispatchedMeters:quantity},actor,operationId):issueTmfUpstreamMaterial({issueId:value('issue'),reservationId:selected,targetFactoryId:value('targetFactory'),dispatchedMeters:quantity},actor,operationId))}
    }
    const id=demandId;refresh();open(id);el.querySelector('[data-tmf-preparation-feedback]')!.textContent='已保存本次记录；仓库发出与工厂实收分别核对。'
   }
  }catch(cause){const target=el.querySelector('[data-tmf-preparation-error]')??el.querySelector('[data-tmf-preparation-feedback]');if(target)target.textContent=cause instanceof Error?cause.message:'未保存，请重试。'}
 })
}
export function renderTmfMaterialPreparationPage(){state.currentPage=1;state.sort=null;controller.ensurePreferencesLoaded();const view=controller.getView();if(typeof window!=='undefined')requestAnimationFrame(bind);return `<div data-tmf-preparation>${renderStandardListPage({title:'织带／绳子连续料备料',primaryActionsHtml:'<span class="text-xs text-slate-500">辅料仓主管（演示）</span>',feedbackHtml:'<p role="status" data-tmf-preparation-feedback class="text-blue-700 text-sm"></p>',filtersHtml:`<div class="border rounded bg-white p-3"><label class="text-xs">生产单 / 半成品SKU / 尺码 / 用途<input name="keyword" value="${e(state.keyword)}" class="block border rounded p-2 mt-1 w-80 max-w-full text-sm"></label><div class="flex gap-2 mt-3">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`,statsHtml:`<div data-tmf-preparation-stats>${stats()}</div>`,listTitle:`备料需求 · ${filtered().length} 条`,listActionsHtml:action('open-column-settings','列设置'),tableHtml:`<div data-tmf-preparation-table>${view.tableHtml}</div>`,paginationHtml:`<div data-tmf-preparation-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-tmf-preparation-columns>${controller.renderColumnSettings()}</div><div data-tmf-preparation-dialog></div><div data-tmf-preparation-image></div>`})}</div>`}
