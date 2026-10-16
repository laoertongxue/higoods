import { renderCode128Barcode } from '../../../../components/real-barcode.ts'
// @page-pattern: list
import { escapeHtml as e } from '../../../../utils.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../../components/ui/pagination.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../../components/ui/list-table-model.ts'
import { getPdaSession } from '../../../../data/fcs/store-domain-pda.ts'
import { getPrintingWorkOrderById, PRINTING_DEMAND_SOURCE_LABEL } from '../../../../data/fcs/printing-task-domain.ts'
import { getFactoryReceiptLocations, getDefaultFactoryReceiptPosition, listFactoryReceipts, getReceiptMaterialUsed } from '../../../../data/fcs/factory-receiving.ts'
import { getWashingSources, listWashingCandidates, listWashingFactories, submitWashingCommand, WASHING_ROUTE } from '../../../../data/fcs/fabric-washing.ts'
import { ensureWashingRecords, readWashingState, washingMigrationWarnings } from '../../../../data/fcs/fabric-washing-repository.ts'
import { WASHING_HAND_FEELS, washingRollRelease, washingPrintSignature, washingInitiationRolls, washingCanExecute, type WashingActor, type WashingOrder, type WashingSource, type WashingRole, type WashingCommand } from '../../../../data/fcs/fabric-washing-model.ts'
import { washingOrderStatus } from '../../../../data/fcs/fabric-washing-views.ts'
export { washingOrderStatus } from '../../../../data/fcs/fabric-washing-views.ts'
import { washingInformationColumns, renderWashingInformation, upgradeWashingColumnPreferences } from './order-presentation.ts'
import { renderWashingDetailTabs, renderWashingDetailPanel, renderWashingDetailSummary, renderWashingDetailBase, renderWashingHandover, renderWashingLogs, washingDetailTab, switchWashingDetailTab, handleWashingDetailTabKey, type WashingDetailTab } from './detail-views.ts'
import { WASHING_FACTORY_ID } from '../../../../data/fcs/fabric-washing-model.ts'
import { renderWashingStorageTools, handleWashingStorageAction } from './storage-tools.ts'

const ui = { page:1, pageSize:10, query:'', handFeel:'', status:'', busy:false }
let candidatePage=1
let columnsOpen=false,listPreferences:StandardListColumnPreferences|undefined,listSort:StandardListSortState|null=null,listColumns:StandardListColumn<WashingOrder>[]=[]
const safePreferenceStorage={getItem:(key:string)=>{try{return localStorage.getItem(key)}catch{return null}},setItem:(key:string,value:string)=>{try{localStorage.setItem(key,value)}catch{}}}
const operations = new Map<string,{intent:string;id:string}>()
let previewFocus:HTMLElement|null=null
const button=(label:string,action:string,attrs='',primary=false)=>`<button type="button" class="min-h-10 rounded-md border px-3 py-2 text-sm ${primary?'border-blue-600 bg-blue-600 text-white':'bg-white text-slate-800'}" data-fabric-washing-action="${action}" data-skip-page-rerender="true" ${attrs}>${e(label)}</button>`
const link=(label:string,url:string)=>`<a class="text-blue-700 underline-offset-2 hover:underline" href="${e(url)}" data-nav="${e(url)}">${e(label)}</a>`
export function washingImage(url:string,name:string,size='h-16 w-16') {
 if(!url)return '<p class="text-red-700">缺少对应面料图片，请核对资料。</p>'
 return `<button type="button" class="relative ${size} shrink-0 rounded border bg-white" data-fabric-washing-action="image" data-image-url="${e(url)}" data-image-title="${e(name)}" data-skip-page-rerender="true" aria-label="查看${e(name)}大图"><img class="h-full w-full object-contain" src="${e(url)}" alt="${e(name)}" data-washing-image><span class="absolute inset-x-0 bottom-0 bg-white/95 text-xs" data-washing-image-status>图片加载中</span></button>`
}
function updateWashingImageStatus(img:HTMLImageElement){
 const status=img.parentElement?.querySelector('[data-washing-image-status]')
 if(status)status.textContent=img.naturalWidth?'':'图片加载失败，点击后重试'
}
export function installWashingImages() {
 setTimeout(()=>{
  document.querySelectorAll<HTMLImageElement>('[data-washing-image]').forEach(img=>{
   const ready=()=>updateWashingImageStatus(img)
   img.onload=ready;img.onerror=ready;if(img.complete)ready()
  })
 },0)
}
function actor(source?:WashingSource,command?:WashingCommand,pda=false):WashingActor {
 const session=pda?getPdaSession():null
 const type=command?.type||'JUDGE'
 const role:WashingRole=['JUDGE','SEND'].includes(type)?'现场判断人员':['ASSIGN','LINK'].includes(type)?'计划跟单':type==='DOWNSTREAM_RECEIVE'?'接收人员':['RESOLVE_EXCEPTION'].includes(type)?'现场负责人':'染厂人员'
 const order=command&&'orderId'in command?readWashingState().orders.find(o=>o.id===command.orderId):undefined
 return {id:session?.userId||'web-washing-'+role,name:session?.userName||'Web 端操作员',role,
  factoryId:session?.factoryId||(role==='现场判断人员'?source?.factoryId:role==='接收人员'?source?.target?.factoryId:order?.assignedFactoryId||WASHING_FACTORY_ID),
  ...(role==='接收人员'&&source?.target?.warehouseId?{warehouseId:source.target.warehouseId}:{})}
}
/** The full-capability factory's PDA uses a post-finishing warehouse view.
 * Show its actual washing stock beside that view, reading the same records. */
export function renderWashingFactoryStockSection(factoryId:string|undefined,kind:'WAIT_PROCESS'|'WAIT_HANDOVER'):string {
 if(!factoryId)return ''
 const state=readWashingState()
 const rows=kind==='WAIT_HANDOVER'
  ?state.orders.filter(o=>!o.cancelledAt&&o.assignedFactoryId===factoryId).flatMap(o=>o.rolls.filter(r=>r.completedAt&&!r.handedOutAt).map(r=>({id:o.id,no:o.no,image:o.source.imageUrl,name:o.source.materialName,sku:o.source.materialSku,barcode:r.outputBarcode||r.barcode,qty:r.outputQty!,unit:r.unit,label:o.exception?'异常待核对':'洗水完成待交回'})))
  :listFactoryReceipts(factoryId).flatMap(receipt=>receipt.lines.filter(line=>line.washingOrderId).flatMap(line=>{
   const remaining=line.qty-getReceiptMaterialUsed(line.id),order=state.orders.find(o=>o.id===line.washingOrderId)
   return remaining>0&&order?[{id:order.id,no:order.no,image:line.material.imageUrl,name:line.material.name,sku:line.material.sku,barcode:line.rolls?.map(r=>r.barcode).join('、')||'',qty:remaining,unit:line.unit,label:order.exception?'异常待核对':line.washingDirection==='TO_WASH'?'洗水待投入':'洗水后待领用'}]:[]
  }))
 if(!rows.length)return ''
 installWashingImages()
 return `<section class="space-y-3 rounded-xl border bg-white p-3" data-washing-factory-stock="${kind}"><h2 class="font-semibold">洗水面料${kind==='WAIT_HANDOVER'?'待交出':'待加工'}</h2>${rows.map(row=>`<article class="flex gap-3 rounded border p-3">${washingImage(row.image,row.name)}<div class="min-w-0 break-words"><strong>${e(row.name)}</strong><p>${e(row.sku)}</p><p>${e(row.barcode)}</p><p>${e(row.label)} · ${qty(row.qty,row.unit)}</p>${link(row.no,'/fcs/pda/washing/'+encodeURIComponent(row.id))}</div></article>`).join('')}</section>`
}
const time=(value:string)=>Number.isNaN(new Date(value).getTime())?value:new Date(value).toLocaleString('zh-CN',{hour12:false})
const qty=(n:number|undefined,unit:string)=>n===undefined?'—':`${n} ${unit}`
function washingWarnings() {return washingMigrationWarnings().map(warning=>`<p class="text-amber-800">${e(warning)} 业务已保存，旧片段尚待清理；保留原资料并关闭旧页后重新核对。</p>`).join('')}
function errorSlot() {return washingWarnings()+'<p class="min-h-5 text-sm text-red-700" role="alert" data-washing-error></p>'}
export function isWashingSavePending():boolean { return ui.busy }
export function renderWashingJudgmentPanel(printOrderId:string,pda=false,initiationOnly=false):string {
 const order=getPrintingWorkOrderById(printOrderId)
 if(!order||order.output.objectType!=='面料')return ''
 const state=readWashingState(),sources=getWashingSources(printOrderId).filter(source=>!initiationOnly||washingInitiationRolls(state,source).length>0)
 const content=sources.length?sources.map(source=>{
  const available=initiationOnly?washingInitiationRolls(state,source):source.rolls.filter(r=>r.confirmed&&!r.handedOut&&r.qty>0&&!state.judgments.some(j=>j.printOrderId===source.printOrderId&&j.rollId===r.id))
  return `<article class="space-y-3 rounded-lg border p-3" data-washing-source="${e(source.id)}" data-print-order="${e(printOrderId)}"><div class="flex items-start gap-3">${washingImage(source.imageUrl,source.materialName)}<div class="min-w-0 break-words"><strong>${e(source.materialName)}</strong><p>${e(source.materialSku)}</p><p>批次 ${e(source.batchId)} · ${e(source.printOrderNo)}</p><p>${e(source.sourceNo)} · ${source.demo?'原型演示':''}</p></div></div>${source.actualCompleted&&!source.blockedReason?`<p class="text-sm">实际触摸所选面料后登记结果。数量单位：${e(source.rolls[0]?.unit||'')}</p><div class="grid gap-2 sm:grid-cols-2">${source.rolls.map(roll=>{
   const j=state.judgments.find(j=>j.printOrderId===printOrderId&&j.rollId===roll.id),active=j?.orderId?state.orders.find(o=>o.id===j.orderId&&!o.cancelledAt):undefined,reason=washingRollRelease(state,printOrderId,roll.id,roll.revision??source.revision)
   const canCorrect=!initiationOnly&&j?.actorId===actor(source,undefined,pda).id&&!roll.handedOut&&(!active||!active.acceptedAt&&!active.rolls.some(r=>r.sentAt))
   const disabled=!roll.confirmed||!available.includes(roll)&&!canCorrect
   return `<label class="flex items-start gap-2 rounded border p-3 text-sm"><input class="mt-1 h-5 w-5 shrink-0" type="checkbox" data-preserve-native-click="true" data-washing-judge-roll="${e(roll.id)}" ${available.includes(roll)?'checked':''} ${disabled?'disabled':''}><span class="min-w-0 break-all"><strong>${e(roll.barcode)}</strong> · ${qty(roll.qty,roll.unit)}<br>${j?(j.sourceRevision!==(roll.revision??source.revision)?'面料已变化，须重新核对':j.decision==='NO_WASH'?'已触摸：不需要洗水':`已触摸：${e(active?.handFeel||j.handFeel||'')} ${active?link(active.no,(pda?'/fcs/pda/washing':WASHING_ROUTE)+'/'+encodeURIComponent(active.id)): '原单已作废'}`):roll.handedOut?'历史已交付':'尚未判断'}${roll.blockedReason?`<span class="block text-amber-800">${e(roll.blockedReason)}</span>`:''}${reason&&j?`<span class="block text-amber-800">${e(reason)}</span>`:''}</span></label>`
  }).join('')}</div><div class="flex flex-wrap items-end gap-3"><label class="text-sm">目标手感<select class="mt-1 block min-h-10 w-full rounded border bg-white px-2" data-washing-feel aria-label="目标手感"><option value="">选择手感</option>${WASHING_HAND_FEELS.map(f=>`<option>${e(f)}</option>`).join('')}</select></label>${button('创建洗水加工单','judge-wash','',true)}${button('不需要洗水','judge-no')}${!initiationOnly&&state.judgments.some(j=>j.printOrderId===printOrderId)?button('纠正为所选手感','correct-wash')+button('纠正为无需洗水','correct-no'):''}</div>`:`<p class="text-amber-800">${e(source.blockedReason||'面料尚未实际完成印花，暂不能判断。')}</p>`}${errorSlot()}</article>`
 }).join(''):initiationOnly?'<p class="text-sm">当前没有待发起洗水的面料卷。</p>':'<p class="rounded border border-amber-200 bg-amber-50 p-3">尚无已完成的面料产出批次。热转印须先完成面料转印并登记实物卷。</p>'
 installWashingImages()
 return `<section class="space-y-3 ${pda||initiationOnly?'':'rounded-xl border bg-white p-4'}" data-washing-judgment-root="${e(printOrderId)}" data-washing-pda="${pda}" data-washing-initiation="${initiationOnly}" data-skip-page-rerender="true">${initiationOnly?'':'<h2 class="font-semibold">印花后触摸面料</h2>'}${content}<p class="text-sm" data-washing-result></p></section>`
}
function listContent(pda=false) {
 const session=pda?getPdaSession():null
 const all=readWashingState().orders.filter(o=>!session||[o.assignedFactoryId,o.source.factoryId,o.source.target?.factoryId].includes(session.factoryId))
 let rows=all.filter(o=>(!ui.query||[o.no,o.source.sourceNo,o.source.materialSku,o.source.materialName].join(' ').toLowerCase().includes(ui.query.toLowerCase()))&&(!ui.handFeel||o.handFeel===ui.handFeel)&&(!ui.status||washingOrderStatus(o)===ui.status))
 ui.page=Math.min(ui.page,Math.max(1,Math.ceil(rows.length/ui.pageSize)))
 let slice:WashingOrder[]=[]
 const route=pda?'/fcs/pda/washing':WASHING_ROUTE
 const columns:StandardListColumn<WashingOrder>[]=[...washingInformationColumns(washingImage,link),{key:'action',title:'操作',width:100,actionColumn:true,render:o=>link('查看',route+'/'+encodeURIComponent(o.id))}]

 listColumns=columns
 const preferenceKey=WASHING_ROUTE+':columns'
 const preferenceReader={getItem:(key:string)=>{const raw=safePreferenceStorage.getItem(key);try{return raw?JSON.stringify(upgradeWashingColumnPreferences(JSON.parse(raw))):null}catch{return null}}}
 const preferences=listPreferences??loadListColumnPreferences(preferenceReader,preferenceKey,columns,{order:columns.map(c=>c.key),visibleKeys:columns.map(c=>c.key),frozenKeys:[],pageSize:ui.pageSize},[10,20,50])
 listPreferences=preferences;ui.pageSize=preferences.pageSize
 rows=sortStandardListRows(rows,listSort,(o,key)=>columns.find(c=>c.key===key)?.sortValue?.(o))
 slice=rows.slice((ui.page-1)*ui.pageSize,ui.page*ui.pageSize)
 const cardsHtml=pda?`<div class="space-y-3 p-3">${slice.map(o=>`<article class="rounded border p-3"><div class="flex gap-3">${washingImage(o.source.imageUrl,o.source.materialName)}<div class="min-w-0 break-words">${link(o.no,route+'/'+encodeURIComponent(o.id))}<p>${e(o.handFeel)}</p><p>${e(washingOrderStatus(o))}</p><p>${qty(o.rolls.reduce((n,r)=>n+r.inputQty,0),o.rolls[0].unit)} · ${o.rolls.length} 卷</p></div></div></article>`).join('')||'<p>暂无洗水加工单</p>'}</div>`:''
 const tableHtml=renderStandardListTable({columns,rows:slice,preferences,sort:listSort,eventPrefix:'fabric-washing',skipPageRerender:true,emptyText:'暂无洗水加工单，从印花实际产出登记触摸结果。'})
 const filtersHtml=`<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label>单号 / 来源 / 面料<input class="mt-1 block min-h-10 rounded border px-2" data-washing-filter="query" value="${e(ui.query)}"></label><label>手感<select class="mt-1 block min-h-10 rounded border px-2" data-washing-filter="handFeel"><option value="">全部手感</option>${WASHING_HAND_FEELS.map(f=>`<option ${ui.handFeel===f?'selected':''}>${e(f)}</option>`).join('')}</select></label><label>状态<select class="mt-1 block min-h-10 rounded border px-2" data-washing-filter="status"><option value="">全部状态</option>${[...new Set(all.map(washingOrderStatus))].map(s=>`<option ${s===ui.status?'selected':''}>${e(s)}</option>`).join('')}</select></label>${button('查询','query')}${button('重置','reset')}</div>`
 const paginationHtml=renderTablePagination({currentPage:ui.page,pageSize:ui.pageSize,total:rows.length,pageSizeOptions:[10,20,50],actionPrefix:'fabric-washing',from:rows.length?(ui.page-1)*ui.pageSize+1:0,to:Math.min(ui.page*ui.pageSize,rows.length),totalPages:Math.max(1,Math.ceil(rows.length/ui.pageSize)),skipPageRerender:true})
 installWashingImages()
 if(pda)return `<div class="space-y-3 p-3"><h1 class="text-xl font-semibold">洗水加工单</h1>${filtersHtml}${cardsHtml}${paginationHtml}</div>`
 return renderStandardListPage({title:'洗水加工单',filtersHtml,statsHtml:renderStandardListStats([{label:'筛选结果',value:rows.length},{label:'待印花交出',value:rows.filter(o=>washingCanExecute(o)&&!o.cancelledAt&&!o.exception&&!o.completedAt&&!o.rolls.some(r=>r.sentAt)).length},{label:'异常',value:rows.filter(o=>o.exception).length}]),listTitle:`洗水加工单 · ${rows.length} 条`,listActionsHtml:pda?'':button('列设置','columns'),overlaysHtml:columnsOpen?renderStandardListColumnSettings({title:'洗水列表列设置',columns,preferences,eventPrefix:'fabric-washing',maxFrozenWidth:650,skipPageRerender:true}):'',primaryActionsHtml:button('查看印花产出','candidates')+button('本地资料','storage'),tableHtml,paginationHtml})
}
function renderCandidateView(){
 const candidates=listWashingCandidates().sort((a,b)=>Number(b.sources.some(s=>s.actualCompleted))-Number(a.sources.some(s=>s.actualCompleted)))
 candidatePage=Math.max(1,Math.min(candidatePage,Math.ceil(candidates.length/20)))
 const shown=candidates.slice((candidatePage-1)*20,candidatePage*20)
 installWashingImages()
 return `<div class="space-y-3 p-4"><h1 class="text-xl font-semibold">印花实际产出</h1>${button('返回洗水列表','list')}<p>第 ${candidatePage} / ${Math.max(1,Math.ceil(candidates.length/20))} 页 · ${candidates.length} 张印花单</p>${shown.map(c=>`<article class="flex gap-3 rounded border bg-white p-3">${washingImage(c.order.output.imageUrl,c.order.output.materialName)}<div class="min-w-0 break-words"><strong>${e(PRINTING_DEMAND_SOURCE_LABEL[c.order.demandSource.type])} · ${e(c.order.printOrderNo)}</strong><p>${e(c.order.output.materialName)} · ${c.sources.some(source=>source.actualCompleted)?'已有面料实际完成批次':'尚无可判断的面料实物'}</p>${link('进入印花实物判断','/fcs/craft/printing/work-orders/'+encodeURIComponent(c.order.workOrderId))}</div></article>`).join('')}${candidatePage>1?button('上一页','candidates-prev'):''}${candidatePage*20<candidates.length?button('下一页','candidates-next'):''}</div>`
}
export async function renderFabricWashingListPage(pda=false) {
 if(pda&&!getPdaSession())return '<p class="p-4">请先登录工厂 PDA。</p><a href="/fcs/pda/auth/login?returnTo=%2Ffcs%2Fpda%2Fwashing">登录后进入洗水执行</a>'
 try {
  await ensureWashingRecords()
  const content=`<div data-washing-list-root data-washing-pda="${pda}" data-skip-page-rerender="true">${listContent(pda)}</div>`
  if(pda)return (await import('../../../pda-shell.ts')).renderPdaFrame(content,'exec',{disableTodoAutoOpen:true})
  return content
 }catch(err){return `<div class="p-4 text-red-700" role="alert">${e(message(err))} 刷新页面后重试。</div>`}
}
function rollState(r:WashingOrder['rolls'][number]) {return r.downstreamReceivedAt?'下游已实收':r.handedOutAt?'交回待实收':r.completedAt?'加工完成':r.startedAt?'洗水加工中':r.receivedAt?'已实收':r.sentAt?'印花已交出':'待印花交出'}
function detailContent(orderId:string,pda=false,active:WashingDetailTab='execution'):string {
 const o=readWashingState().orders.find(o=>o.id===orderId),session=pda?getPdaSession():null
 if(!o)return '<div class="p-4"><h1>洗水加工单不存在</h1><p>请核对单号或返回洗水加工单列表。</p>'+link('返回列表',pda?'/fcs/pda/washing':WASHING_ROUTE)+'</div>'
 if(session&&![o.assignedFactoryId,o.source.factoryId,o.source.target?.factoryId].includes(session.factoryId))return '<p class="p-4 text-red-700">本单不属于当前工厂，不能查看或处理。</p>'
 const canFactory=!session||session.factoryId===o.assignedFactoryId,canSite=!session||session.factoryId===o.source.factoryId,canReceiver=!session||session.factoryId===o.source.target?.factoryId
 const receivingFactories=[...(canFactory?[o.assignedFactoryId||WASHING_FACTORY_ID]:[]),...(canReceiver&&o.source.target?.factoryId?[o.source.target.factoryId]:[])]
 const locations=[...new Set(receivingFactories)].flatMap(factoryId=>getFactoryReceiptLocations(factoryId))
 const mainActions:string[]=[]
 if(!o.cancelledAt&&!o.completedAt&&!o.exception){
  if(!pda){if((o.assignedFactoryId!==WASHING_FACTORY_ID||o.acceptance==='REJECTED')&&!o.rolls.some(r=>r.sentAt))mainActions.push(button(o.acceptance==='REJECTED'?'重新交由 GTG 承接':'交由 GTG 承接','assign'))}
  if(canSite&&washingCanExecute(o)&&o.rolls.some(r=>!r.sentAt))mainActions.push(button('印花交给染厂','send','',true))
  if(canFactory&&washingCanExecute(o)){
   const available:Array<[boolean,string,string]>=[[o.rolls.some(r=>!!r.sentAt&&!r.receivedAt),'登记逐卷实收','receive'],[o.rolls.some(r=>!!r.receivedAt&&!r.startedAt),'投入洗水','start'],[o.rolls.some(r=>!!r.startedAt&&!r.completedAt),'登记实际产出','output'],[o.rolls.some(r=>!!r.completedAt&&!r.handedOutAt),'交回原接收方','handout'],[o.rolls.every(r=>r.downstreamReceivedAt),'人工完单','complete']]
   available.filter(([ready])=>ready).forEach(([,label,action],i)=>mainActions.push(button(label,action,'',i===0)))
  }
  if(canReceiver&&o.rolls.some(r=>!!r.handedOutAt&&!r.downstreamReceivedAt))mainActions.push(button('登记下游实收','downstream-receive','',true))
 }
 if(o.exception&&!pda)mainActions.push(button('核对实物并恢复','resolve-exception'))
 mainActions.sort((a,b)=>Number(b.includes('bg-blue-600'))-Number(a.includes('bg-blue-600')))
 const showEntry=mainActions.some(html=>/data-fabric-washing-action="(?:send|receive|start|output|handout|downstream-receive)"/.test(html))
 const total=(field:'inputQty'|'receivedQty'|'outputQty'|'downstreamQty')=>o.rolls.reduce((n,r)=>n+(r[field]??0),0),unit=o.rolls[0].unit
 installWashingImages()
 const execution=`<section class="space-y-3 rounded-lg border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">本次实物 · ${o.rolls.length} 卷</h2><div class="flex flex-wrap items-end gap-3">${mainActions.join('')}</div></div><div class="grid gap-2 text-sm sm:grid-cols-3"><p>原卷数量 ${qty(total('inputQty'),unit)}</p><p>染厂实收 ${qty(total('receivedQty'),unit)}</p><p>加工产出 ${qty(total('outputQty'),unit)}</p><p>下游实收 ${qty(total('downstreamQty'),unit)}</p><p>已完成数量变化 ${qty(o.rolls.filter(r=>r.completedAt).reduce((n,r)=>n+r.receivedQty!-r.outputQty!,0),unit)}</p><p>未加工实收余量 ${qty(o.rolls.filter(r=>!r.completedAt).reduce((n,r)=>n+(r.receivedQty||0),0),unit)}</p></div>
 <div class="grid gap-3 ${pda?'':'lg:grid-cols-2'}">${o.rolls.map(r=>`<label class="flex items-start gap-3 rounded-lg border p-3">${showEntry?`<input type="checkbox" data-preserve-native-click="true" class="mt-1 h-5 w-5 shrink-0" data-washing-exec-roll="${e(r.id)}">`:''}<span class="min-w-0 flex-1 break-all"><strong>${e(r.outputBarcode||r.barcode)}</strong><span class="block text-sm">${e(rollState(r))} · 原卷 ${qty(r.inputQty,r.unit)} · 实收 ${qty(r.receivedQty,r.unit)} · 产出 ${qty(r.outputQty,r.unit)}</span>${showEntry?`<span class="block text-sm">本次实测数量（${e(r.unit)}）<input class="mt-1 block min-h-10 w-full rounded border px-2" type="number" min="0" step="any" data-washing-qty="${e(r.id)}" aria-label="${e(r.barcode)}本次实测数量"></span>`:''}${canFactory&&r.startedAt&&!r.completedAt?`<span class="block mt-2 text-sm">重包新卷码（选填）<input class="mt-1 block min-h-10 w-full rounded border px-2" data-washing-output-code="${e(r.id)}" aria-label="${e(r.barcode)}重包新卷码"></span>`:''}${r.outputBarcode&&r.outputBarcode!==r.barcode?`<span class="block text-xs">原卷 ${e(r.barcode)}</span>`:''}</span></label>`).join('')}</div>
 ${showEntry?`${o.source.target?.warehouseId&&canReceiver&&o.rolls.some(r=>r.handedOutAt&&!r.downstreamReceivedAt)?`<label class="block text-sm">本次实际收货库位<input class="mt-1 block min-h-10 w-full rounded border px-2" data-washing-central-location aria-label="本次实际收货库位"></label>`:''}<label class="block text-sm">接收库位<select class="mt-1 block min-h-10 max-w-full rounded border px-2" data-washing-position><option value="">选择实际库位</option>${locations.map(p=>`<option value="${e(p.warehouse.warehouseId+'|'+p.location.locationId)}">${e(p.warehouse.warehouseName+' · '+p.location.locationNo)}</option>`).join('')}</select></label>
 <div class="flex flex-wrap items-end gap-2"><label class="text-sm min-w-0">扫描或手输实际卷码<input class="mt-1 block min-h-10 max-w-full rounded border px-2" data-washing-scan aria-label="扫描或手输实际卷码"></label>${button('核对卷码','scan')}</div><p class="text-sm" data-washing-scans></p>
 <label class="flex gap-2 text-sm"><input type="checkbox" data-preserve-native-click="true" class="h-5 w-5" data-washing-difference>已核对本次所选卷的实交、实收或加工数量变化，确认按实测数量记录。</label>`:''}
 <div data-washing-confirm></div></section>`
 const printing=`<section class="rounded-lg border bg-white p-4"><div class="flex flex-wrap gap-3">${button('洗水加工单预览','print-order')}${button('交接与卷标预览','print-transfer')}</div><div data-washing-print></div></section>`
 const history=renderWashingLogs(o,readWashingState().actions,actionName)
 const panels=pda?execution+printing+`<details class="rounded-lg border bg-white p-3"><summary class="cursor-pointer font-semibold">判断、执行与实物交接记录</summary><div class="mt-3">${history}</div></details>`:
  renderWashingDetailPanel('execution',active,execution)+renderWashingDetailPanel('base',active,renderWashingDetailBase(o,washingImage,link))+renderWashingDetailPanel('handover',active,renderWashingHandover(o))+renderWashingDetailPanel('logs',active,history)+renderWashingDetailPanel('print',active,printing)
 return `<div class="space-y-4 p-4" data-washing-order="${e(o.id)}" data-washing-active-tab="${active}"><header class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-3"><h1 class="break-words text-xl font-semibold">洗水加工单 ${e(o.no)}</h1><span class="rounded-full px-2 py-1 text-xs ${o.cancelledAt||o.exception?'bg-red-50 text-red-700':o.completedAt?'bg-emerald-50 text-emerald-800':'bg-blue-50 text-blue-800'}">${e(washingOrderStatus(o))}</span></div>${o.source.demo?'<p class="mt-1 text-xs text-slate-500">原型演示</p>':''}</div>${link('返回列表',pda?'/fcs/pda/washing':WASHING_ROUTE)}</header>
 ${pda?`<section class="space-y-3 rounded-lg border bg-white p-3"><div class="flex gap-3">${washingImage(o.source.imageUrl,o.source.materialName,'h-20 w-20')}<div class="min-w-0 break-words"><strong>${e(o.source.materialName)}</strong><p>${e(o.source.materialSku)}</p><p class="font-semibold text-blue-800">${e(o.handFeel)}</p></div></div><p>印花方：${e(o.source.factoryName)}</p><p>承接染厂：${e(o.assignedFactoryName||'GTG')}</p><p>下游：${e(o.source.target?.name||'原接收方待核对')}</p>${link(o.source.printOrderNo,'/fcs/craft/printing/work-orders/'+encodeURIComponent(o.source.printOrderId))}</section><details class="rounded border bg-white p-3"><summary class="cursor-pointer text-blue-700">加工单完整信息</summary><div class="mt-3">${renderWashingInformation(o,washingImage,link)}</div></details>`:renderWashingDetailSummary(o,washingImage)}
 ${o.rejectionReason?`<p class="text-sm text-amber-800">拒单原因：${e(o.rejectionReason)}</p>`:''}${o.exception?`<p class="text-sm text-red-700">异常：${e(o.exception)}</p>`:''}<p class="empty:hidden text-sm text-amber-800" data-washing-print-warning>${washingPrintWarning(o)}</p>
 ${pda?'':renderWashingDetailTabs(active)}${washingWarnings()}<div class="empty:hidden text-sm text-red-700" role="alert" data-washing-error></div><p class="empty:hidden text-sm text-green-700" data-washing-result></p>${panels}</div>`
}
function washingPrintWarning(o:WashingOrder){return o.printedRevision&&(o.printedRevision!==o.revision||o.printedContentSignature!==washingPrintSignature(o))?'记录已有变更，旧单据需重印。':''}
const actionNames:Record<string,string>={JUDGE:'触摸判断并创建洗水单',ASSIGN:'派给染厂',ACCEPT:'染厂接单',REJECT:'染厂拒单',SEND:'印花方交出',RECEIVE:'染厂实际接收',START:'投入洗水',OUTPUT:'登记实际产出',HANDOUT:'交回原接收方',DOWNSTREAM_RECEIVE:'下游实际接收',COMPLETE:'人工完单',CANCEL:'作废',EXCEPTION:'登记异常',RESOLVE_EXCEPTION:'核对实物并恢复',PRINT:'打印预览',LINK:'补充生产关联'}
function actionName(code:string){return actionNames[code]||code}
export async function renderFabricWashingDetailPage(orderId:string,pda=false) {
 if(pda&&!getPdaSession())return '<p class="p-4">请先登录工厂 PDA。</p><a href="/fcs/pda/auth/login?returnTo=%2Ffcs%2Fpda%2Fwashing">登录后进入洗水执行</a>'
 try {
  await ensureWashingRecords()
  const content=`<div data-washing-detail-root="${e(orderId)}" data-washing-pda="${pda}" data-skip-page-rerender="true">${detailContent(orderId,pda)}</div>`;return pda?(await import('../../../pda-shell.ts')).renderPdaFrame(content,'exec',{disableTodoAutoOpen:true}):content
 }catch(err){return `<p class="p-4 text-red-700" role="alert">${e(message(err))} 刷新后重试。</p>`}
}
function message(error:unknown){return error instanceof Error?error.message:String(error)}
const scans=new Map<string,Set<string>>()
function scopedInput<T extends HTMLElement=HTMLInputElement>(root:Element,selector:string){const el=root.querySelector<T>(selector);if(!el)throw new Error('当前输入已变化，请重新打开单据。');return el}
function selected(root:Element,attr:string){return [...root.querySelectorAll<HTMLInputElement>('['+attr+']:checked')].map(x=>x.getAttribute(attr)!)}
async function save(root:HTMLElement,command:WashingCommand,source?:WashingSource) {
 const pda=root.closest<HTMLElement>('[data-washing-pda]')?.dataset.washingPda==='true'
 const a=actor(source,command,pda),key=root.dataset.washingSource||root.dataset.washingOrder||'washing',intent=JSON.stringify({command,a})
 let operation=operations.get(key);if(!operation||operation.intent!==intent){operation={intent,id:crypto.randomUUID()};operations.set(key,operation)}
 ui.busy=true
 root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=true})
 try{const result=await submitWashingCommand(command,a,operation.id);operations.delete(key);return result}
 finally{ui.busy=false;root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=false})}
}
function refresh(root:HTMLElement) {
 const detail=root.closest<HTMLElement>('[data-washing-detail-root]'),judge=root.closest<HTMLElement>('[data-washing-judgment-root]'),list=root.closest<HTMLElement>('[data-washing-list-root]')
 if(detail)detail.innerHTML=detailContent(detail.dataset.washingDetailRoot!,detail.dataset.washingPda==='true',washingDetailTab(detail.querySelector<HTMLElement>('[data-washing-order]')?.dataset.washingActiveTab))
 else if(judge)judge.outerHTML=renderWashingJudgmentPanel(judge.dataset.washingJudgmentRoot!,judge.dataset.washingPda==='true',judge.dataset.washingInitiation==='true')
 else if(list)list.innerHTML=listContent(list.dataset.washingPda==='true')
}
export function renderWashingPrint(o:WashingOrder,transfer=false) {
 const rows=o.rolls
 return `<article class="my-4 space-y-3 rounded border bg-white p-4 text-black" data-washing-print-document><h2 class="text-xl font-semibold">${transfer?'洗水交接与卷标':'洗水加工单'}</h2><p>单号 ${e(o.no)} · 版本 ${o.revision}</p><div class="flex gap-4"><img class="h-28 w-28 object-contain" src="${e(o.source.imageUrl)}" alt="${e(o.source.materialName)}"><div><p>${e(o.source.materialName)} · ${e(o.source.materialSku)}</p><strong>目标手感：${e(o.handFeel)}</strong><p>来源 ${e(o.source.sourceNo)} · 印花单 ${e(o.source.printOrderNo)}</p><p>批次 ${e(o.source.batchId)}</p></div></div><p>印花方 ${e(o.source.factoryName)} → 承接染厂 ${e(o.assignedFactoryName||'待派厂')} → 最终接收方 ${e(o.source.target?.name||'待核对')}</p><div class="overflow-auto"><table class="w-full text-left text-sm"><thead><tr><th>原卷 / 产出卷码</th><th>原量</th><th>实收</th><th>加工产出</th><th>下游实收</th></tr></thead><tbody>${rows.map(r=>`<tr class="border-t"><td class="break-all py-2">${e(r.barcode)}${transfer?renderCode128Barcode(r.outputBarcode||r.barcode,'洗水实物卷码'):''}${r.outputBarcode&&r.outputBarcode!==r.barcode?'<br>'+e(r.outputBarcode):''}</td><td>${qty(r.inputQty,r.unit)}</td><td>${qty(r.receivedQty,r.unit)}</td><td>${qty(r.outputQty,r.unit)}</td><td>${qty(r.downstreamQty,r.unit)}</td></tr>`).join('')}</tbody></table></div><p>登记人 ${e(o.createdBy)} · ${e(time(o.createdAt))}</p>${o.cancelledAt?'<p>本单已作废</p>':''}${o.exception?'<p>异常：'+e(o.exception)+'</p>':''}</article>${button('打印本预览','print-browser')}`
}
function openImage(url:string,title:string) {
 document.querySelector('[data-washing-image-overlay]')?.remove();previewFocus=document.activeElement as HTMLElement
 const dialog=document.createElement('dialog');dialog.setAttribute('data-washing-image-overlay','');dialog.className='max-h-[95vh] max-w-[95vw] rounded-lg p-4';dialog.innerHTML=`<div class="mb-3 flex items-center justify-between gap-3"><strong>${e(title)}</strong>${button('关闭大图','close-image')}</div><img class="max-h-[80vh] max-w-full object-contain" src="${e(url)}" alt="${e(title)}">`
 document.body.append(dialog)
 dialog.querySelector('[data-fabric-washing-action="close-image"]')?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();dialog.close()})
 dialog.addEventListener('click',event=>{if(event.target===dialog){dialog.close();dialog.remove();previewFocus?.focus()}});dialog.addEventListener('close',()=>{dialog.remove();previewFocus?.focus()});dialog.showModal()
}
export async function handleFabricWashingEvent(target:HTMLElement,event?:Event):Promise<boolean> {
 if(target.closest('[data-washing-scan]')&&event instanceof KeyboardEvent&&event.key==='Enter'){event.preventDefault();target.closest('[data-washing-order]')?.querySelector<HTMLButtonElement>('[data-fabric-washing-action="scan"]')?.click();return true}
 const trigger=target.closest<HTMLElement>('[data-fabric-washing-action], [data-fabric-washing-page], [data-fabric-washing-page-size], [data-fabric-washing-field]')
 if(!trigger||event&&event.type!=='click'&&event.type!=='change')return !!target.closest('[data-washing-judgment-root], [data-washing-detail-root], [data-washing-list-root]')
 if(ui.busy)return true
 const action=trigger.dataset.fabricWashingAction,root=trigger.closest<HTMLElement>('[data-washing-source], [data-washing-order], [data-washing-list-root]')||trigger
 if(action==='detail-tab'){switchWashingDetailTab(root,washingDetailTab(trigger.dataset.washingTab));return true}
 const error=root.querySelector('[data-washing-error]');if(error)error.textContent=''
 try{
  if(action==='image'){openImage(trigger.dataset.imageUrl!,trigger.dataset.imageTitle!);return true}
  if(action==='close-image'){(trigger.closest('dialog') as HTMLDialogElement)?.close();return true}
  if(action==='query'){const list=root;ui.query=scopedInput<HTMLInputElement>(list,'[data-washing-filter="query"]').value;ui.handFeel=scopedInput<HTMLSelectElement>(list,'[data-washing-filter="handFeel"]').value;ui.status=scopedInput<HTMLSelectElement>(list,'[data-washing-filter="status"]').value;ui.page=1;refresh(root);return true}
  if(action==='reset'){ui.query='';ui.handFeel='';ui.status='';ui.page=1;refresh(root);return true}
  if(action==='columns'||action==='close-column-settings'){columnsOpen=action==='columns';refresh(root);return true}
  if(action==='restore-column-settings'){listPreferences=undefined;safePreferenceStorage.setItem(WASHING_ROUTE+':columns','null');refresh(root);return true}
  if(action==='sort-column'){const key=trigger.dataset.columnKey!;listSort=listSort?.key!==key?{key,direction:'asc'}:listSort.direction==='asc'?{key,direction:'desc'}:null;refresh(root);return true}
  if((action==='toggle-column-visibility'||action==='toggle-column-freeze')&&listPreferences){const key=trigger.dataset.fabricWashingColumnKey!,field=action==='toggle-column-visibility'?'visibleKeys':'frozenKeys';const values=listPreferences[field];listPreferences[field]=values.includes(key)?values.filter(k=>k!==key):[...values,key];listPreferences=normalizeListColumnPreferences(listColumns,listPreferences,[10,20,50]);saveListColumnPreferences(safePreferenceStorage,WASHING_ROUTE+':columns',listPreferences);refresh(root);return true}
  if(action==='prev-page'||action==='next-page'){ui.page+=action==='next-page'?1:-1;refresh(root);return true}
  if(trigger.dataset.fabricWashingField==='pageSize'){ui.pageSize=Number((trigger as HTMLSelectElement).value);ui.page=1;if(listPreferences){listPreferences.pageSize=ui.pageSize;saveListColumnPreferences(safePreferenceStorage,WASHING_ROUTE+':columns',listPreferences)};refresh(root);return true}
  if(trigger.dataset.fabricWashingPage){ui.page=Number(trigger.dataset.fabricWashingPage);refresh(root);return true}
  if(trigger.dataset.fabricWashingPageSize!==undefined){ui.pageSize=Number((trigger as HTMLSelectElement).value);ui.page=1;refresh(root);return true}
  if(['candidates','candidates-prev','candidates-next'].includes(action||'')){if(action==='candidates')candidatePage=1;else candidatePage+=action==='candidates-next'?1:-1;root.innerHTML=renderCandidateView();return true}
  if(action==='list'){refresh(root);return true}
  if(action==='storage'){root.innerHTML=await renderWashingStorageTools();return true}
  if(action?.startsWith('storage-'))return handleWashingStorageAction(action,root)
  if(['judge-wash','judge-no','correct-wash','correct-no'].includes(action||'')){
   const source=getWashingSources(root.dataset.printOrder!).find(s=>s.id===root.dataset.washingSource);if(!source)throw new Error('批次不存在，请重新打开原印花单。')
   const pda=root.closest<HTMLElement>('[data-washing-judgment-root]')?.dataset.washingPda==='true'
   const feel=scopedInput<HTMLSelectElement>(root,'[data-washing-feel]').value
   const result=await save(root,{type:'JUDGE',source,rollIds:selected(root,'data-washing-judge-roll'),decision:action!.endsWith('wash')?'WASH':'NO_WASH',...(action!.endsWith('wash')?{handFeel:feel as any}:{}),...(action!.startsWith('correct')?{correct:true}:{})},source)
   refresh(root);const current=document.querySelector<HTMLElement>('[data-washing-judgment-root="'+CSS.escape(source.printOrderId)+'"] [data-washing-result]');if(current)current.innerHTML=result.orderId?`已创建 ${link('查看洗水加工单',(pda?'/fcs/pda/washing':WASHING_ROUTE)+'/'+encodeURIComponent(result.orderId))}`:'已保存：所选卷不需要洗水。';return true
  }
  const o=readWashingState().orders.find(o=>o.id===root.dataset.washingOrder);if(!o)return false
  const ids=selected(root,'data-washing-exec-roll'),lines=ids.map(rollId=>{const input=scopedInput<HTMLInputElement>(root,'[data-washing-qty="'+CSS.escape(rollId)+'"]');return{rollId,qty:input.value===''?NaN:Number(input.value),barcode:o.rolls.find(r=>r.id===rollId)!.barcode}})
  const checked=root.querySelector<HTMLInputElement>('[data-washing-difference]')?.checked??false
  if(action==='scan'){
   const input=scopedInput<HTMLInputElement>(root,'[data-washing-scan]'),code=input.value.trim()
   if(!o.rolls.some(r=>r.barcode===code||r.outputBarcode===code))throw new Error('卷码不属于本单，请核对实际面料。')
   const set=scans.get(o.id)||new Set<string>();if(set.has(code))throw new Error('本卷已经核对，不能重复扫描。');set.add(code);scans.set(o.id,set);input.value='';scopedInput(root,'[data-washing-scans]').textContent='已核对：'+[...set].join('、');return true
  }
  if(action==='print-browser'){await printWashingPreview(root);return true}
  if(action==='print-order'||action==='print-transfer'){
   await save(root,{type:'PRINT',orderId:o.id},o.source);const current=readWashingState().orders.find(row=>row.id===o.id)!;const slot=scopedInput(root,'[data-washing-print]');slot.innerHTML=renderWashingPrint(current,action==='print-transfer');const log=root.querySelector('[data-washing-log]');if(log)log.outerHTML=renderWashingLogs(current,readWashingState().actions,actionName);const warning=root.querySelector('[data-washing-print-warning]');if(warning)warning.textContent=washingPrintWarning(current);return true
  }
  if(action==='resolve-exception'){
   const confirm=scopedInput(root,'[data-washing-confirm]');confirm.innerHTML=`<div class="mt-3 space-y-3 rounded border border-amber-300 bg-amber-50 p-3"><p>${e(o.no)} · ${o.rolls.length} 卷。确认已核对本单实物责任，恢复后续流转。</p><label>实际原因<textarea class="mt-1 block w-full rounded border p-2" data-washing-reason></textarea></label><label>实物协调后的目标手感<select class="block min-h-10 rounded border px-2" data-washing-resolved-feel><option value="">维持当前手感</option>${WASHING_HAND_FEELS.map(f=>`<option>${e(f)}</option>`).join('')}</select></label>${button('确认恢复流转','confirm-resolve-exception')}${button('返回填写','dismiss-confirm')}</div>`;return true
  }
  if(action==='dismiss-confirm'){scopedInput(root,'[data-washing-confirm]').innerHTML='';return true}
  let command:WashingCommand
  switch(action){
   case 'assign':{const f=listWashingFactories().find(f=>f.id===WASHING_FACTORY_ID);if(!f)throw new Error('GTG 当前不能接单，请核对工厂档案。');command={type:'ASSIGN',orderId:o.id,factory:{id:f.id,name:'GTG',enabled:true}};break}
   case 'send':command={type:'SEND',orderId:o.id,rollIds:ids,scannedCodes:[...(scans.get(o.id)||[])]};break
   case 'receive':{const value=scopedInput<HTMLSelectElement>(root,'[data-washing-position]').value.split('|');command={type:'RECEIVE',orderId:o.id,lines,warehouseId:value[0]||'',locationId:value[1]||'',differenceConfirmed:checked};break}
   case 'start':command={type:'START',orderId:o.id,rollIds:ids};break
   case 'output':command={type:'OUTPUT',orderId:o.id,lines:lines.map(line=>({...line,barcode:root.querySelector<HTMLInputElement>('[data-washing-output-code="'+CSS.escape(line.rollId)+'"]')?.value||line.barcode})),differenceConfirmed:checked};break
   case 'handout':if(!o.source.target)throw new Error('原最终去向待核对，请跟单先核对实际接收方。');command={type:'HANDOUT',orderId:o.id,rollIds:ids,scannedCodes:[...(scans.get(o.id)||[])],target:o.source.target};break
   case 'downstream-receive':command={type:'DOWNSTREAM_RECEIVE',orderId:o.id,lines,differenceConfirmed:checked,...(o.source.target?.warehouseId?{warehouseId:o.source.target.warehouseId,locationId:scopedInput<HTMLInputElement>(root,'[data-washing-central-location]').value}:(()=>{const value=scopedInput<HTMLSelectElement>(root,'[data-washing-position]').value.split('|');return{warehouseId:value[0]||'',locationId:value[1]||''}})())};break
   case 'complete':command={type:'COMPLETE',orderId:o.id};break
   case 'confirm-resolve-exception':command={type:'RESOLVE_EXCEPTION',orderId:o.id,reason:scopedInput<HTMLTextAreaElement>(root,'[data-washing-reason]').value,confirmed:true,handFeel:(scopedInput<HTMLSelectElement>(root,'[data-washing-resolved-feel]').value||undefined) as any};break
   default:return true
  }
  await save(root,command,o.source);scans.delete(o.id);refresh(root);document.querySelector('[data-washing-detail-root] [data-washing-result]')!.textContent='已保存：'+actionName(command.type)
 }catch(err){const slot=error||root.querySelector('[data-washing-result]');if(slot)slot.textContent=message(err);else throw err}
 return true
}

async function printWashingPreview(root:HTMLElement){
 const document=root.querySelector<HTMLElement>('[data-washing-print-document]');if(!document)throw new Error('请先生成需要打印的预览。')
 const frame=window.document.createElement('iframe');frame.title='洗水打印';frame.style.cssText='position:fixed;left:-10000px;width:794px;height:1123px;border:0';frame.dataset.washingPrintFrame='true';window.document.body.append(frame)
 const clone=document.cloneNode(true) as HTMLElement
 clone.querySelectorAll<HTMLImageElement>('img').forEach(img=>img.src=new URL(img.getAttribute('src')!,location.href).href)
 const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font:14px Arial,"PingFang SC",sans-serif;color:#000;margin:0}h2{font-size:22px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #bbb;vertical-align:top}img{width:110px;height:110px;object-fit:contain}svg{display:block;width:180px;height:40px}p{margin:8px 0}tr{break-inside:avoid}</style></head><body>'+clone.outerHTML+'</body></html>'
 const loaded=new Promise<void>(resolve=>{frame.onload=()=>resolve()});frame.srcdoc=html;await loaded
 await Promise.all([...frame.contentDocument!.images].map(img=>img.decode().catch(()=>{throw new Error('打印图片未加载，请重试。')})))
 frame.contentWindow!.addEventListener('afterprint',()=>frame.remove(),{once:true})
 frame.contentWindow!.focus();frame.contentWindow!.print()
}
if(typeof document!=='undefined'){
 document.addEventListener('keydown',handleWashingDetailTabKey)
 // PDA rendering can await its frame after the HTML string was built. Capture
 // native image events after actual mounting as well as checking cached images.
 for(const type of ['load','error'])document.addEventListener(type,event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.matches('[data-washing-image]'))updateWashingImageStatus(img)},true)
 let dragged=''
 document.addEventListener('dragstart',event=>{const node=(event.target as HTMLElement).closest<HTMLElement>('[data-fabric-washing-column-key][draggable="true"]');dragged=node?.dataset.fabricWashingColumnKey||''})
 document.addEventListener('dragover',event=>{if(dragged&&(event.target as HTMLElement).closest('[data-fabric-washing-column-key]'))event.preventDefault()})
 document.addEventListener('drop',event=>{const node=(event.target as HTMLElement).closest<HTMLElement>('[data-fabric-washing-column-key]');if(!dragged||!node||!listPreferences)return;event.preventDefault();const target=node.dataset.fabricWashingColumnKey!,order=listPreferences.order.filter(key=>key!==dragged),index=order.indexOf(target);if(index>=0){order.splice(index,0,dragged);listPreferences.order=order;saveListColumnPreferences(safePreferenceStorage,WASHING_ROUTE+':columns',listPreferences);refresh(node)}dragged=''})
}
