// @page-pattern: dashboard
import './styles.css'
import './production-order-diagrams.css'
import { appStore } from '../../state/store'
import { escapeHtml as e } from '../../utils'
import { findTimingCase, getTimingCaseByScene, findTimingDocument, timingDocumentHref, timingCaseHref, listTimingCases, TIMING_SCENES, TIMING_AS_OF, TIMING_IMAGE } from '../../data/production-timing/source'
import { setTimingDiagramScene, renderTimingDiagramBody, timingDiagramState, renderTimingNodeDetail, renderTimingDocumentSummary, renderTimingSourceSummaryForCase } from './production-order-diagrams'
import { renderOrderModulePage, handleOrderModuleClick, handleOrderModuleField, handleOrderModuleKey, handleOrderModuleColumnDrag } from './order-pages'
import { connectProductionFulfillmentHandlers, timingEventStart, timingRouteStart } from './events'
import { loadFollowups } from './followup-storage'
import { renderTimingFollowups, handleTimingFollowupClick, handleTimingFollowupField } from './timing-followups'
import { materialImageContent } from './material-image-view'
const base='/dds/supply-chain/production-fulfillment'
let activeId='',previousFocus:HTMLElement|null=null,loading=false
const titles:Record<string,string>={overview:'时效总览',orders:'生产单监控','pending-purchases':'待关联采购','follow-up':'我的跟单','work-items':'工作项监控',teams:'团队与工厂','inbound-analysis':'入库时效分析',configuration:'时效口径与配置'}
function ready(start:number,action:string):void{
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const root=document.getElementById('pf-app');if(!root)return
  const images=Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(img=>img.getBoundingClientRect().width>0)
  if(images.some(img=>!img.complete)){Promise.all(images.map(img=>img.decode().catch(()=>undefined))).then(()=>ready(start,action));return}
  for(const img of images)if(!img.naturalWidth){if(!img.dataset.timingFailed){img.dataset.timingFailed='true';img.insertAdjacentHTML('afterend','<span role="alert" style="color:#c33f48">图片读取失败，请重新加载当前页面。</span>')};root.dataset.timingReady='image-error';return}
  const values=JSON.parse(root.dataset.timingMeasurements||'[]');const elapsedMs=performance.now()-start;values.push({action,elapsedMs,at:TIMING_AS_OF});root.dataset.timingMeasurements=JSON.stringify(values);root.dataset.timingReady=action;if(action==='route')root.dataset.timingNavigationMs=String(elapsedMs)
 }))
}
export function renderProductionFulfillmentPage(path:string):string{
 const started=timingRouteStart(),parts=path.replace(base,'').split('/').filter(Boolean),section=parts[0]||'overview',id=decodeURIComponent(parts[1]||'')
 if(!loading){loading=true;void loadFollowups()}
 if(!titles[section])return '<div class="p-6"><h1>该监控地址已移除</h1><p>请从生产单监控进入当前入库时效图。</p><a href="'+base+'/orders">生产单监控</a></div>'
 if(id&&(section==='orders'||section==='pending-purchases')){
  const c=findTimingCase(id);if(!c||Boolean(c.order)!==(section==='orders'))return '<div class="p-6">未找到对应记录。<a href="'+base+'/orders">返回生产单监控</a></div>'
  if(activeId!==id){setTimingDiagramScene(c.key);activeId=id}
  ready(started,'route')
  return '<div id="pf-app"><div id="production-timing"><main class="shell"><header class="top"><div class="brand"><h1>生产时效监控</h1><span class="tag">整单目标 · 执行卡点 · 经办动作，同一页</span></div><div class="toolbar"><a href="'+base+'/orders" data-pf-action="timing-list" data-skip-page-rerender="true">返回生产单监控</a><button data-pf-action="timing-fullscreen" data-skip-page-rerender="true">全屏图示</button><button data-pf-action="timing-print" data-skip-page-rerender="true">打印图示</button><label for="timing-scene">演示场景</label><select id="timing-scene" data-pf-field="timing-scene" data-skip-page-rerender="true">'+Object.entries(TIMING_SCENES).map(([key,label])=>'<option value="'+e(key)+'" '+(key===c.key?'selected':'')+'>'+e(label)+'</option>').join('')+'</select></div></header><section id="timing-diagram-body" class="page">'+renderTimingDiagramBody()+'</section><p class="page-note">固定演示查看时点 2026-10-07 09:00（北京时间）；演示数量、人员和时间用于验证展示方式。点击单据先查看核心信息，再在新标签页查看原模块详情。</p></main><div id="timing-overlay" hidden></div></div></div>'
 }
 activeId='';ready(started,'route')
 return '<div id="pf-app" class="pf-module">'+renderOrderModulePage(section)+'</div>'
}
function refreshDiagram():void{const body=document.getElementById('timing-diagram-body');if(body)body.innerHTML=renderTimingDiagramBody()}
function closeOverlay():void{const overlay=document.getElementById('timing-overlay');if(overlay){overlay.hidden=true;overlay.innerHTML=''}timingDiagramState().detail='';previousFocus?.focus({preventScroll:true})}
function showOverlay(content:string,kind='drawer',footer=''):void{
 previousFocus=document.activeElement as HTMLElement;const overlay=document.getElementById('timing-overlay');if(!overlay)return
 overlay.hidden=false;overlay.innerHTML='<div class="drawer-backdrop" data-close></div><section class="'+(kind==='document'?'document-modal':'drawer '+(kind==='wide'?'wide':''))+'" role="dialog" aria-modal="true" aria-label="'+(kind==='document'?'单据核心信息':'当前图节点明细')+'"><div class="'+(kind==='document'?'document-modal-head':'drawer-head')+'"><strong>'+ (kind==='document'?'单据核心信息':'生产单 '+e(activeId))+'</strong><button class="close" data-close>关闭'+(kind==='document'?'弹窗':'明细')+'</button></div><div class="'+(kind==='document'?'document-modal-body':'drawer-body')+'">'+content+'</div>'+footer+'</section>'
 overlay.querySelector<HTMLButtonElement>('[data-close]:not(.drawer-backdrop)')?.focus({preventScroll:true})
}
function openDocument(id:string):void{
 const found=findTimingDocument(id);if(!found)return
 const state=timingDiagramState();state.detail='document:'+id
 const summary=renderTimingSourceSummaryForCase(found.order,id)
 showOverlay(summary,'document','<div class="document-modal-foot"><span>关闭后继续查看当前监控位置</span><a class="btn primary" href="'+e(timingDocumentHref(id))+'" target="_blank" rel="noopener">查看详情（新标签页） ↗</a></div>')
}
export function handleProductionFulfillmentClick(target:Element):boolean{
 const start=timingEventStart();if(handleTimingFollowupClick(target as HTMLElement,()=>ready(start,'followup-result'))){if(target.closest('[data-timing-followup-action="new"]'))ready(start,'followup-new');return true};if(handleOrderModuleClick(target)){ready(start,'module-click');return true}
 const nav=target.closest<HTMLElement>('[data-pf-action="navigate"]');if(nav&&target.closest('#pf-app')){appStore.navigate(nav.dataset.path||nav.getAttribute('href')||base+'/orders');return true}
 const source=target.closest<HTMLElement>('[data-document]');if(source&&target.closest('#pf-app')&&!target.closest('#production-timing')){let overlayRoot=document.getElementById('production-timing');if(!overlayRoot){overlayRoot=document.createElement('div');overlayRoot.id='production-timing';overlayRoot.innerHTML='<div id="timing-overlay" hidden></div>';document.getElementById('pf-app')?.append(overlayRoot)};openDocument(source.dataset.document!);ready(start,'document-open');return true}
 const root=target.closest('#production-timing');if(!root)return false
 const el=target.closest<HTMLElement>('[data-stage-focus],[data-document],[data-timing-material],[data-close],[data-expand],[data-expand-all],[data-queue],[data-detail],[data-pf-action],.photo');if(!el)return false
 if(el.hasAttribute('data-close')){if(el.classList.contains('drawer-backdrop')&&target!==el)return false;closeOverlay()}
 else if(el.dataset.document)openDocument(el.dataset.document)
 else if(el.dataset.timingMaterial)showOverlay(materialImageContent(el.dataset.timingMaterial),'wide')
 else if(el.dataset.stageFocus||el.dataset.expand){const key=el.dataset.stageFocus||el.dataset.expand!,s=timingDiagramState();s.expanded[key]=el.dataset.stageFocus?true:!s.expanded[key];refreshDiagram();if(el.dataset.stageFocus)document.getElementById('branch-'+key)?.scrollIntoView({block:'start'})}
 else if(el.hasAttribute('data-expand-all')){const s=timingDiagramState(),value=!['prep','supply','craft'].every(p=>s.expanded[p]);s.expanded={prep:value,supply:value,craft:value};refreshDiagram()}
 else if(el.hasAttribute('data-queue')){timingDiagramState().queue=!timingDiagramState().queue;refreshDiagram()}
 else if(el.dataset.detail){const key=el.dataset.detail;timingDiagramState().detail=key;showOverlay(renderTimingNodeDetail(key),['prep','supply','release'].includes(key)?'wide':'drawer');const c=findTimingCase(activeId),body=document.querySelector('#timing-overlay .drawer-body');if(key==='source'&&c&&body)body.insertAdjacentHTML('beforeend','<div class="factbox">'+c.purchases.map(p=>'<button class="doc-link" data-document="'+e(p.documentId)+'">商品采购单 '+e(p.id)+'</button>').join('')+'</div>');if(body)body.insertAdjacentHTML('beforeend','<p style="margin-top:12px"><button class="btn" data-pf-action="timing-followups" data-skip-page-rerender="true">查看／登记跟进记录</button></p>')}
 else if(el.classList.contains('photo'))showOverlay('<img src="'+TIMING_IMAGE+'" alt="演示款蓝白印花衬衫实图" style="max-width:100%;max-height:78vh;object-fit:contain">','wide')
 else if(el.dataset.pfAction==='timing-list'){appStore.navigate(base+'/orders');return true}
 else if(el.dataset.pfAction==='timing-fullscreen'){root.classList.toggle('timing-fullscreen');el.textContent=root.classList.contains('timing-fullscreen')?'退出全屏':'全屏图示'}
 else if(el.dataset.pfAction==='timing-print'){window.print()}
 else if(el.dataset.pfAction==='timing-followups')showOverlay(renderTimingFollowups(activeId),'drawer')
 else return false
 ready(start,el.dataset.document?'document-open':el.dataset.detail?'node-open':el.hasAttribute('data-close')?'dialog-close':el.dataset.expand||el.dataset.stageFocus||el.hasAttribute('data-expand-all')?'phase-expand':'diagram-click');return true
}
export function handleProductionFulfillmentField(target:Element):boolean{
 if(handleTimingFollowupField(target as HTMLElement)){ready(timingEventStart(),'followup-field');return true}
 if(handleOrderModuleField(target)){ready(timingEventStart(),'module-field');return true}
 if(target instanceof HTMLSelectElement&&target.id==='timing-scene'){const c=getTimingCaseByScene(target.value);appStore.navigate(timingCaseHref(c));return true}return false
}
export function handleProductionFulfillmentKey(event:KeyboardEvent):boolean{
 if(handleOrderModuleKey(event)){ready(timingEventStart(),'module-key');return true}
 const overlay=document.getElementById('timing-overlay');if(!overlay||overlay.hidden)return false
 if(event.key==='Escape'){const start=timingEventStart();closeOverlay();ready(start,'escape-close');event.preventDefault();return true}
 if(event.key==='Tab'){const items=Array.from(overlay.querySelectorAll<HTMLElement>('button,a[href],input,textarea,select')).filter(el=>!el.hasAttribute('disabled'));const current=items.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&current<=0){items.at(-1)?.focus();event.preventDefault()}else if(!event.shiftKey&&current===items.length-1){items[0]?.focus();event.preventDefault()}return true}return false
}
connectProductionFulfillmentHandlers({click:handleProductionFulfillmentClick,field:handleProductionFulfillmentField,key:handleProductionFulfillmentKey,drag:(target,event)=>{if(!handleOrderModuleColumnDrag(target,event))return false;ready(timingEventStart(),'column-drag');return true}})
