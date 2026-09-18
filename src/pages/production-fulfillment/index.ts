// @page-pattern: dashboard
import './styles.css'
import './source-views.css'
import { readProductionSourceSnapshot, bindProductionTaskSources } from './source-tasks'
import { orders, snapshot, stages } from './fixtures'
import { filterTasks, assessTask, projectManualForecast, restoreManualForecasts } from './calculations'
import { ui, base, sections, emptyFilters } from './ui-state'
import { e, dt, fmt, select, field, button, card, renderColumns, tableContexts, setActiveTable, activeTableId, saveTablePreferences, resetTablePages, anchor } from './common'
import { renderTasks, renderWorkItems, workRows } from './tasks'
import { renderTaskDetail, renderWorkDetail, writeFollowup } from './task-detail'
import { renderOverview, renderTeams, renderFulfillment, fulfillmentRows } from './dashboards'
import { renderConfiguration, handleConfigurationAction, handleConfigurationField, setConfigurationTaskSource, applyPublishedInTransitOverrides } from './configuration'
import type { PFTask, PFFilters } from './model'
import { dependencyAnalysis } from './dependency-graph'
import { renderExamples } from './examples'
import { handleScenarioAction } from './scenarios'
import { connectProductionFulfillmentHandlers } from './events'
import { readDataIssueLedger, reconcileDataIssues, persistDataIssueLedger, registerDataIssue, filterDataIssues, type DataIssueLedger, type DataIssueFilters, type DataIssue } from './data-issues'

let sourceSnapshot:ReturnType<typeof readProductionSourceSnapshot>|null=null
let projectedTasks:PFTask[]=[]
let dataIssueLedger:DataIssueLedger|null=null,dataIssueFilters:DataIssueFilters={state:'待处理',owner:'全部',deadline:'全部'},overlayIssue=''
function refreshSources():void {
  sourceSnapshot=readProductionSourceSnapshot();projectedTasks=applyPublishedInTransitOverrides(sourceSnapshot.tasks);restoreForecasts()
  if(!dataIssueLedger)return // First overview paint does not initialize the independent issue ledger.
  const previous=dataIssueLedger,next=reconcileDataIssues(previous,projectedTasks,sourceSnapshot.asOf)
  if(next.issues!==previous.issues&&next.writable){const error=persistDataIssueLedger(next);if(error){next.warning=error;next.writable=false}}
  dataIssueLedger=next
}
let overlayKind='',overlayTask='',overlayNode='',lastFocus:HTMLElement|null=null,noticeTimer:ReturnType<typeof setTimeout>|undefined
let enteredPath=''
const routeViews=new Map<string,Partial<typeof ui>>()
let pendingTaskFilters:PFFilters|null=null
function restoreForecasts():void {
  let records:unknown=[]
  try {records=JSON.parse(localStorage.getItem('dds-pf-forecasts-v1')||'[]')}catch{return}
  projectedTasks=restoreManualForecasts(projectedTasks,records)
}
let restored=false
export function currentTasks():PFTask[]{return projectedTasks}
function allowedTasks():PFTask[]{return projectedTasks}
function currentSnapshot():string {return sourceSnapshot?.asOf??snapshot}
function visibleTasks():PFTask[]{
  const data=allowedTasks()
  const filters={...ui.filters}
  if(ui.section==='work-items'){filters.health='全部';filters.issuesOnly=false;filters.query='';filters.dateFrom='';filters.dateTo=''}
  if(ui.section==='fulfillment'){filters.dateFrom='';filters.dateTo=''}
  return filterTasks(data,filters)
}
function queryCard():string {
  if(ui.taskId||ui.section==='configuration'||ui.section==='examples')return ''
  const f=ui.draft,teams=[...new Set(projectedTasks.flatMap(t=>t.nodes.map(n=>n.team)))].filter(Boolean).sort()
  const factories=[...new Set(projectedTasks.flatMap(t=>t.nodes.map(n=>n.factory||'未指定')))].sort()
  const primary=field('任务 / 需求 / 采购 / 生产单 / 款号','query',f.query)+select('跟单','follower',f.follower,['全部',...new Set(projectedTasks.map(t=>t.follower))])+select('责任团队','team',f.team,['全部',...teams])+select('责任工厂','factory',f.factory||'全部',['全部',...factories])
  const more=ui.more?`${select('时效状态','health',f.health,['全部','已逾期','预计逾期','待判定','临期','正常'])}${select('任务范围','scope',f.scope,['在途','全部','已完成','已终止'])}${select('阶段','stage',f.stage,['全部',...stages.map(s=>s.id)])}${select('采购地区','region',f.region,['全部',...new Set(projectedTasks.map(t=>t.region))])}${select('供给方式','supplyMode',f.supplyMode,['全部',...new Set(projectedTasks.map(t=>t.supplyMode))])}${ui.section==='fulfillment'?`<div class="pf-field"><span>订单日期口径</span><b class="pf-static-value">${ui.fulfillmentMode==='完整订单'?'全单发货完成时间':'本次实际发货时间'}</b></div>`:select('日期口径','dateField',f.dateField,['生效到期','起点','预计完成'])}${field('开始日期','dateFrom',f.dateFrom,'date')}${field('结束日期','dateTo',f.dateTo,'date')}`:''
  return `<section class="pf-card pf-query-card" aria-label="查询范围"><div class="pf-card-body"><div class="pf-filter-fields">${primary}${more}</div><div class="pf-actions pf-filter-actions">${button('查询','query')}${button('重置','reset')}${button('导出当前查询全部结果','export')}${button(ui.more?'收起筛选':'更多筛选','more',`aria-expanded="${ui.more}"`)}<small>统计、图表、列表共用当前查询范围</small></div></div></section>`
}
function body():string {
  const data=visibleTasks()
  if(ui.taskId){const task=allowedTasks().find(t=>t.id===ui.taskId);return task?renderTaskDetail(task,ui):card('未找到对应生产需求',`${anchor('返回生产任务',base+'/tasks')}`)}
  if(ui.section==='overview')return renderOverview(data,ui,dataIssueLedger??undefined,dataIssueFilters)
  if(ui.section==='tasks'||ui.section==='follow-up')return renderTasks(data,ui)
  if(ui.section==='work-items')return renderWorkItems(data,ui)
  if(ui.section==='teams')return renderTeams(data,ui)
  if(ui.section==='fulfillment')return renderFulfillment(data,orders.filter(o=>data.some(t=>t.id===o.taskId)),ui)
  if(ui.section==='configuration')return renderConfiguration(ui)
  if(ui.section==='examples')return renderExamples(ui)
  return card('页面不存在',anchor('返回时效总览',base+'/overview'))
}
export function renderProductionFulfillmentPage(path:string):string {
  if(!restored){refreshSources();restored=true}
  const relative=path.replace(base,'').split('?')[0].split('/').filter(Boolean),section=relative[0]||'overview'
  if(enteredPath!==path){
    if(enteredPath)routeViews.set(enteredPath,{filters:{...ui.filters},draft:{...ui.draft},more:ui.more,overviewTab:ui.overviewTab,teamTab:ui.teamTab,analysisView:ui.analysisView,detailTab:ui.detailTab,detailSubTab:ui.detailSubTab,collapsed:[...ui.collapsed],timelineMode:ui.timelineMode,timelineScale:ui.timelineScale,timelineTeam:ui.timelineTeam,timelineBasis:ui.timelineBasis,showChildren:ui.showChildren,showDependencies:ui.showDependencies,exampleId:ui.exampleId})
    ui.section=section;ui.taskId=section==='tasks'?decodeURIComponent(relative[1]||''):'';ui.teamId=section==='teams'?decodeURIComponent(relative[1]||''):''
    ui.detailTab='全程时效';ui.detailSubTab='';ui.filters=emptyFilters();ui.draft=emptyFilters();ui.more=false;ui.timelineMode='全部工作';ui.timelineTeam='全部';ui.timelineBasis='当前标准';ui.timelineScale='日';ui.showChildren=false;ui.showDependencies=true;ui.dependencyScope='全部工作';ui.dependencyZoom=1;ui.selectedNode=''
    if(section==='fulfillment'){ui.filters.scope='全部';ui.draft.scope='全部'}
    const task=projectedTasks.find(t=>t.id===ui.taskId)
    ui.collapsed=stages.filter(stage=>{const nodes=task?.nodes.filter(n=>n.stage===stage.id)||[];return nodes.length>0&&nodes.every(n=>n.actualEndAt)}).map(s=>s.id)
    const saved=routeViews.get(path);if(saved)Object.assign(ui,saved)
    if(section==='tasks'&&!ui.taskId&&pendingTaskFilters){ui.filters={...pendingTaskFilters};ui.draft={...pendingTaskFilters};ui.more=Boolean(ui.filters.stage!=='全部'||ui.filters.dateFrom||ui.filters.issuesOnly);pendingTaskFilters=null}
    resetTablePages();tableContexts.forEach(ctx=>{ctx.sort=null});enteredPath=path;overlayKind='';ui.fullscreen=false
  }
  return `<div id="pf-app" class="${ui.taskId?'pf-task-detail':''}" data-pf-route="${e(path)}"><header class="pf-header"><div><p class="pf-subtitle">数据决策系统 DDS / 供应链域 / 生产与履约时效</p>${ui.taskId?'':`<h1>${ui.teamId?'团队工作台 · '+e(ui.teamId):e(sections[section]||'生产与履约时效')}</h1>`}<p id="pf-snapshot" class="pf-subtitle">读取于 ${dt(currentSnapshot())} · 自然日</p></div>${ui.taskId?'':`<div class="pf-header-actions">${button('全屏大屏','fullscreen')}</div>`}</header><div id="pf-filter">${queryCard()}</div><main id="pf-content">${body()}</main><div id="pf-overlays"></div><div id="pf-notice" role="status" aria-live="polite" class="pf-toast"></div></div>`
}
function images(root:Element):void {root.querySelectorAll<HTMLImageElement>('img').forEach(img=>{const fail=()=>{const el=img.parentElement?.querySelector<HTMLElement>('.pf-image-error');if(el)el.hidden=false};img.addEventListener('error',fail,{once:true});if(img.complete&&img.naturalWidth===0)fail()})}
export function refreshPF():void {
  const content=document.querySelector('#pf-content');if(!content)return
  const scrolls=Array.from(content.querySelectorAll<HTMLElement>('.pf-gantt-scroll,.pf-dependency-scroll,[data-standard-list-scroll]')).map(el=>[el.scrollLeft,el.scrollTop])
  const focused=document.activeElement as HTMLElement|null,focusAction=focused?.dataset.pfAction,focusValue=focused?.dataset.value,focusField=focused?.dataset.pfField
  content.innerHTML=body();images(content);const stamp=document.querySelector('#pf-snapshot');if(stamp)stamp.textContent=`读取于 ${dt(currentSnapshot())} · 自然日`
  const focusRoot=content.querySelector<HTMLElement>('.pf-config-dialog')??content
  if(focusAction)focusRoot.querySelector<HTMLElement>(`[data-pf-action="${CSS.escape(focusAction)}"]${focusValue?`[data-value="${CSS.escape(focusValue)}"]`:''}`)?.focus({preventScroll:true})
  if(focusField)focusRoot.querySelector<HTMLElement>(`[data-pf-field="${CSS.escape(focusField)}"]`)?.focus({preventScroll:true})
  if(focusRoot!==content&&!focusRoot.contains(document.activeElement))focusRoot.querySelector<HTMLElement>('button,input:not(:disabled),select:not(:disabled)')?.focus({preventScroll:true})
  content.querySelectorAll<HTMLElement>('.pf-gantt-scroll,.pf-dependency-scroll,[data-standard-list-scroll]').forEach((el,i)=>{el.scrollLeft=scrolls[i]?.[0]||0;el.scrollTop=scrolls[i]?.[1]||0})
}
function refreshQuery():void {const el=document.querySelector('#pf-filter');if(el)el.innerHTML=queryCard()}
function notice(text:string):void {ui.notice=text;const el=document.querySelector('#pf-notice');if(el)el.textContent=text;if(noticeTimer)clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{if(el)el.textContent=''},7000)}
function navigate(path:string):void {closeOverlay();window.history.pushState(window.history.state,'',path);window.dispatchEvent(new PopStateEvent('popstate'))}
function overlay(title:string,html:string,image=false):void {
  const root=document.querySelector('#pf-overlays');if(!root)return
  if(!root.innerHTML)lastFocus=document.activeElement as HTMLElement
  root.innerHTML=`<div class="pf-overlay-backdrop" data-pf-action="backdrop"><section class="pf-overlay-panel ${image?'pf-image-modal':overlayKind==='node'?'pf-document-modal':''}" role="dialog" aria-modal="true" aria-label="${e(title)}"><header class="pf-overlay-header"><h2>${e(title)}</h2>${button('关闭 ×','close')}</header>${html}</section></div>`
  root.querySelector<HTMLElement>('button')?.focus();images(root)
}
function closeOverlay():void {const el=document.querySelector('#pf-overlays');if(el)el.innerHTML='';overlayKind='';lastFocus?.focus()}
function followupForm(estimate:boolean):string {
  const task=projectedTasks.find(t=>t.id===overlayTask)!,node=task.nodes.find(n=>n.id===overlayNode)
  const permitted=task.nodes;const candidates=permitted.filter(n=>!n.actualEndAt)
  return `<form class="pf-form" onsubmit="return false"><p>${e(task.id)} · ${estimate?'本地预测会沿依赖传播；原基线与生效截止保持不变。':'保存本地跟进记录，不发送消息。'}</p><label>关联工作<select name="nodeId" data-pf-field="form-nodeId">${!estimate?'<option value="">任务整体</option>':''}${(estimate?candidates:permitted).map(n=>`<option value="${e(n.id)}" ${n.id===node?.id?'selected':''}>${e(n.id)} ${e(n.name)}</option>`).join('')}</select></label><label>原因（必填）<textarea name="reason" data-pf-field="form-reason" required placeholder="例如：当前合格回货400件，分配产能不足"></textarea></label><label>跟进动作（必填）<textarea name="action" data-pf-field="form-action" required placeholder="明确处理动作、责任人及下次反馈"></textarea></label><label>负责人预计结束${estimate?'（必填）':'（可选）'}<input type="datetime-local" name="expectedAt" data-pf-field="form-expectedAt" ${estimate?'required':''}></label><p class="pf-subtitle">预计时间不修改实际结束事实。</p><div class="pf-form-error" hidden></div><div class="pf-actions">${button(estimate?'保存本地预测':'保存跟进','save-followup')}${button('取消','close')}</div></form>`
}
function sourceBindingForm(task:PFTask):string {
  const current=task.sourceContext
  const option=(value:string,label:string,selected:string|undefined)=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(label)}</option>`
  const preparations=sourceSnapshot?.preparations.filter(p=>p.styleRef===task.styleRef)??[]
  const versions=sourceSnapshot?.techPacks.filter(p=>p.styleRef===task.styleRef)??[]
  return `<form class="pf-form" onsubmit="return false"><p>${e(task.demandNo)} · ${e(task.styleRef)} ${e(task.styleName)}</p><label>生产准备单<select name="preparationId" data-pf-field="form-preparationId">${option('','未关联',current?.preparationId)}${preparations.map(p=>option(p.id,p.code+' · '+p.type,current?.preparationId)).join('')}</select></label><label>正式技术包版本<select name="technicalVersionId" data-pf-field="form-technicalVersionId">${option('','未关联',current?.technicalVersionId)}${versions.map(p=>option(p.id,p.code+' · '+p.name,current?.technicalVersionId)).join('')}</select></label><p class="pf-subtitle">只列出本款已有来源。关联后读取专业任务及工艺前置关系；不会创建或修改来源单据。</p>${preparations.length?'':'<p>本款暂无可关联生产准备单，请先在商品中心创建。</p>'}<div class="pf-form-error" hidden></div><div class="pf-actions">${button('保存关联','save-sources')}${button('取消','close')}</div></form>`
}
function dataIssueForm(issue:DataIssue):string {
  const editable=issue.status==='待处理'&&dataIssueLedger?.writable
  const localDue=issue.dueAt?new Date(Date.parse(issue.dueAt)+8*3600000).toISOString().slice(0,16):''
  return `<form class="pf-form" onsubmit="return false"><p><strong>${e(issue.title)}</strong><br><small>${e(issue.id)}</small></p><p>${e(issue.detail)}</p><p class="pf-subtitle">来源键：${e(issue.sourceKey)}<br>${issue.autoResolve?'保存仅登记安排；刷新来源满足对应校验后自动恢复，缺口重现会重新打开。':'此项来源缺口尚未结构化，不能自动确认恢复；文字消失或跟进登记均不能关闭。'}</p><label>责任人<input name="owner" data-pf-field="data-issue-owner" value="${e(issue.owner)}" required ${editable?'':'disabled'}></label><label>责任团队<input name="team" data-pf-field="data-issue-team" value="${e(issue.team)}" required ${editable?'':'disabled'}></label><label>修复期限（北京时间）<input name="dueAt" data-pf-field="data-issue-dueAt" type="datetime-local" value="${localDue}" required ${editable?'':'disabled'}></label>${editable?'<label>修复安排 / 调整原因<textarea name="note" data-pf-field="data-issue-note" required></textarea></label>':''}<div class="pf-form-error" hidden></div><div class="pf-actions">${editable?button('保存责任与期限','data-issue-save'):''}${button('关闭','close')}</div><details><summary class="cursor-pointer text-sm">查看流转记录（${issue.history.length} 条）</summary><ol class="mt-2 max-h-56 space-y-2 overflow-auto text-xs">${issue.history.slice().reverse().map(event=>`<li class="rounded border p-2"><strong>${e(event.action)}</strong> · ${dt(event.at)} · ${e(event.by)}<p>${e(event.detail)}</p></li>`).join('')}</ol></details></form>`
}
function exportCurrent():void {
  const data=visibleTasks();let rows:unknown[][]=[]
  const exportingIssues=ui.section==='overview'&&ui.overviewTab==='数据待补'
  if(exportingIssues){
    const selected=dataIssueLedger?filterDataIssues(dataIssueLedger,new Set(data.map(task=>task.id)),dataIssueFilters):[]
    rows=[['事项编号','生产任务','工作项','问题','说明','来源缺口键','来源标识','责任人','责任团队','修复期限','状态','首次发现','来源确认恢复时间','重新打开次数','可自动核对恢复','最近来源核对'],...selected.map(issue=>[issue.id,issue.taskId,issue.nodeId||'任务整体',issue.title,issue.detail,issue.sourceKey,issue.sourceIdentity,issue.owner,issue.team,issue.dueAt,issue.status,issue.firstDetectedAt,issue.resolvedAt,issue.reopenCount,issue.autoResolve?'是':'否，须来源审核',dataIssueLedger?.checkedAt])]
  }else if(ui.section==='work-items'){
    rows=[['任务','工作项','名称','责任团队','责任工厂','负责人','状态','要求自然日','实际开始','实际结束','预计结束','应完成','已合格','单位','数量范围'],...workRows(data,ui).map(n=>[n.taskId,n.id,n.name,n.team,n.factory||'未指定',n.owner,n.businessState,n.durationDays,n.actualStartAt,n.actualEndAt,n.predictedEndAt,n.requiredQuantityKnown===false?'待同步':n.requiredQty,n.quantityKnown===false?'待同步':n.qualifiedQty,n.unit,n.quantityScope||'本需求'])]
  }else if(ui.section==='fulfillment'){
    const selected=fulfillmentRows(orders.filter(o=>data.some(t=>t.id===o.taskId)),ui)
    rows=ui.fulfillmentMode==='完整订单'?[['客户订单','关联任务','下单时间','全单发货完成时间','要求自然日','实际自然日','逾期自然日','有效件数','实发件数'],...selected.orders.map(o=>[o.orderNo,o.taskIds.join(' / '),o.placedAt,o.completedAt,o.requiredDays,o.actualDays,o.overdueDays,o.effectiveQty,o.shippedQty])]:[['任务','客户订单','发货记录','下单时间','实际发货','要求自然日','实际自然日','逾期自然日','发货件数'],...selected.facts.map(o=>[o.taskId,o.orderNo,o.shipmentId,o.placedAt,o.shippedAt,o.requiredDays,o.actualDays,o.overdueDays,o.shippedQty])]
  }else rows=[['任务','商品采购单','生产需求单','跟单','状态','开始','标准自然日','原始基线','生效截止','预计结束','有效数量','已发货','剩余','单位'],...data.map(t=>[t.id,t.purchaseNo,t.demandNo,t.follower,assessTask(t).health,t.startedAt,t.standardDays,t.baselineDueAt,t.effectiveDueAt,t.predictedFinishAt,t.effectiveQty,t.quantityKnown===false?'待同步':t.shippedQty,t.quantityKnown===false?'待同步':t.remainingQty,t.unit])]
  if(rows.length<2){notice('当前查询没有数据，未生成文件');return}
  const safe=(v:unknown)=>`"${String(v??'待判定').replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`
  const csv='\uFEFF'+[['来源：当前本地原型业务记录',`读取于${currentSnapshot()}`,`规则版本${[...new Set(data.map(t=>t.ruleVersion))].join(' / ')}`,`视图${exportingIssues?'数据待补事项':sections[ui.section]||ui.section}`,`查询范围${JSON.stringify(ui.filters)}`,exportingIssues?`事项筛选${JSON.stringify(dataIssueFilters)}`:`履约口径${ui.fulfillmentMode}`],...rows].map(r=>r.map(safe).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`生产与履约时效-${ui.section}-查询结果.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(`已导出当前条件全部 ${rows.length-1} 条记录（不含操作列）`)
}
export function handleProductionFulfillmentClick(target:Element):boolean {
  const el=target.closest<HTMLElement>('[data-pf-action]');if(!el)return false
  const action=el.dataset.pfAction??''
  if(action==='backdrop'&&target!==el||action==='config-dialog')return false
  if(el instanceof HTMLButtonElement&&el.disabled)return true
  const table=el.closest<HTMLElement>('[data-pf-table]')?.dataset.pfTable??el.dataset.table??activeTableId
  if(table)setActiveTable(table)
  if(action.startsWith('config-'))return handleConfigurationAction(action,el,()=>{projectedTasks=applyPublishedInTransitOverrides(projectedTasks);refreshPF()},notice)
  if(action.startsWith('scenario-'))return handleScenarioAction(action,el,refreshPF,notice)
  if(action==='navigate'){navigate(el.dataset.path||base+'/overview');return true}
  if(action==='data-issue-open'){
    const issue=dataIssueLedger?.issues.find(row=>row.id===el.dataset.issueId)
    if(issue){overlayIssue=issue.id;overlayKind='data-issue';overlay('数据事项 · 责任、期限与恢复记录',dataIssueForm(issue))}return true
  }
  if(action==='data-issue-reset'){dataIssueFilters={state:'待处理',owner:'全部',deadline:'全部'};resetTablePages();refreshPF();return true}
  if(action==='data-issue-refresh'){if(!dataIssueLedger?.writable)dataIssueLedger=readDataIssueLedger();refreshSources();resetTablePages();refreshPF();notice('已重新读取来源并核对事项；未结构化审核项不会自动关闭。');return true}
  if(action==='data-issue-save'){
    const form=document.querySelector<HTMLFormElement>('#pf-overlays form');if(!form||!dataIssueLedger)return true
    const values=new FormData(form),localDue=String(values.get('dueAt')||'')
    try{
      const next=registerDataIssue(dataIssueLedger,overlayIssue,{owner:String(values.get('owner')||''),team:String(values.get('team')||''),dueAt:localDue?`${localDue}:00+08:00`:'',note:String(values.get('note')||'')},ui.user,new Date().toISOString())
      const error=persistDataIssueLedger(next);if(error)throw new Error(error)
      dataIssueLedger=next;closeOverlay();refreshPF();notice('责任与修复期限已保存在本地；事项仍待来源确认。')
    }catch(error){const feedback=form.querySelector<HTMLElement>('.pf-form-error');if(feedback){feedback.hidden=false;feedback.textContent=error instanceof Error?error.message:'事项未保存'}}return true
  }
  if(action==='bind-sources'){const task=projectedTasks.find(t=>t.id===(el.dataset.taskId||ui.taskId));if(task){overlayTask=task.id;overlayKind='sources';overlay('关联生产准备与工艺路线',sourceBindingForm(task))}return true}
  if(action==='save-sources'){
    const form=document.querySelector<HTMLFormElement>('#pf-overlays form');if(!form)return true
    const values=new FormData(form)
    try{bindProductionTaskSources(overlayTask,{preparationId:String(values.get('preparationId')||''),technicalVersionId:String(values.get('technicalVersionId')||'')});refreshSources();closeOverlay();refreshPF();notice('来源关联已保存，工作项已按准备任务与工艺路线更新')}
    catch(error){const feedback=form.querySelector<HTMLElement>('.pf-form-error');if(feedback){feedback.hidden=false;feedback.textContent=error instanceof Error?error.message:'关联未保存'}}return true
  }
  if(action==='query'){if(ui.draft.dateFrom&&ui.draft.dateTo&&ui.draft.dateFrom>ui.draft.dateTo){notice('结束日期不能早于开始日期');return true}refreshSources();ui.filters={...ui.draft};resetTablePages();refreshPF();return true}
  if(action==='reset'){ui.filters=emptyFilters();if(ui.section==='fulfillment')ui.filters.scope='全部';ui.draft={...ui.filters};resetTablePages();refreshQuery();refreshPF();return true}
  if(action==='more'){ui.more=!ui.more;refreshQuery();return true}
  if(action==='export'){exportCurrent();return true}
  if(['overview-tab','team-tab','detail-subtab','example-select'].includes(action)){
    if(action==='overview-tab'){ui.overviewTab=el.dataset.value||'运行概况';if(ui.overviewTab==='数据待补'){dataIssueLedger??=readDataIssueLedger();refreshSources()}}
    if(action==='team-tab')ui.teamTab=el.dataset.value||'可执行工作'
    if(action==='detail-subtab')ui.detailSubTab=el.dataset.value||''
    if(action==='example-select')ui.exampleId=el.dataset.value||'BOM'
    refreshPF();return true
  }
  if(action==='drill-tasks'||ui.section==='overview'&&['health-filter','due-filter','stage-filter'].includes(action)){
    pendingTaskFilters={...ui.filters}
    if(el.dataset.health)pendingTaskFilters.health=el.dataset.health
    if(el.dataset.issues==='true')pendingTaskFilters.issuesOnly=true
    if(action==='health-filter')pendingTaskFilters.health=el.dataset.value||'全部'
    if(action==='due-filter'){pendingTaskFilters.dateField='生效到期';pendingTaskFilters.dateFrom=el.dataset.value||'';pendingTaskFilters.dateTo=pendingTaskFilters.dateFrom}
    if(action==='stage-filter')pendingTaskFilters.stage=el.dataset.value||'全部'
    navigate(base+'/tasks');return true
  }
  if(action==='dependency-scope'||action==='dependency-zoom'){
    if(action==='dependency-scope')ui.dependencyScope=el.dataset.value==='卡点与影响'?'卡点与影响':'全部工作'
    else ui.dependencyZoom=Number(el.dataset.zoom)||1
    refreshPF();return true
  }
  if(action==='locate-bottleneck'){
    const task=projectedTasks.find(t=>t.id===ui.taskId);if(!task)return true
    const id=el.dataset.nodeId||dependencyAnalysis(task).blockers[0]?.node.id;if(!id)return true
    ui.selectedNode=id;ui.detailTab='全程时效';ui.detailSubTab='依赖与卡点';refreshPF()
    const node=document.querySelector<HTMLElement>(`[data-flow-node="${CSS.escape(id)}"]`),scroll=node?.closest<HTMLElement>('.pf-dependency-scroll')
    if(node&&scroll){const zoom=ui.dependencyZoom||1;scroll.scrollTo({left:Math.max(0,node.offsetLeft*zoom-(scroll.clientWidth-node.offsetWidth*zoom)/2),top:Math.max(0,node.offsetTop*zoom-(scroll.clientHeight-node.offsetHeight*zoom)/2)});node.focus({preventScroll:true})}return true
  }
  if(action==='work-tab'){
    const task=allowedTasks().find(t=>t.id===overlayTask),node=task?.nodes.find(n=>n.id===overlayNode)
    if(task&&node){ui.workTab=el.dataset.value||'单据简要信息';overlay('工作项与单据摘要',renderWorkDetail(task,node,ui.workTab));document.querySelector<HTMLElement>(`[data-pf-action="work-tab"][data-value="${CSS.escape(ui.workTab)}"]`)?.focus()}
    return true
  }
  if(action==='health-filter'){ui.filters.health=el.dataset.value||'全部';ui.draft={...ui.filters};resetTablePages();refreshQuery();refreshPF();return true}
  if(action==='due-filter'){ui.filters.dateField='生效到期';ui.filters.dateFrom=el.dataset.value||'';ui.filters.dateTo=ui.filters.dateFrom;ui.draft={...ui.filters};ui.more=true;resetTablePages();refreshQuery();refreshPF();return true}
  if(action==='stage-filter'){ui.filters.stage=el.dataset.value||'全部';ui.draft={...ui.filters};ui.more=true;resetTablePages();refreshQuery();refreshPF();return true}
  if(action==='fulfillment-mode'){ui.fulfillmentMode=el.dataset.value||'发货行';refreshQuery();refreshPF();return true}
  if(action==='detail-tab'){ui.detailTab=el.dataset.value||'全程时效';ui.detailSubTab='';refreshPF();return true}
  if(action==='toggle-stage'){const id=el.dataset.stage||'';ui.collapsed=ui.collapsed.includes(id)?ui.collapsed.filter(v=>v!==id):[...ui.collapsed,id];refreshPF();return true}
  if(action==='focus-stage'){const id=el.dataset.stage||'';ui.collapsed=ui.collapsed.filter(v=>v!==id);ui.timelineMode='全部工作';refreshPF();document.querySelector(`[data-stage-row="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest'});return true}
  if(action==='expand-all'||action==='collapse-all'){ui.collapsed=action==='expand-all'?[]:stages.map(s=>s.id);refreshPF();return true}
  if(action==='toggle-children'||action==='toggle-dependencies'){if(action==='toggle-children')ui.showChildren=!ui.showChildren;else ui.showDependencies=!ui.showDependencies;refreshPF();return true}
  if(action==='fit-timeline'){ui.timelineScale='日';refreshPF();document.querySelector('.pf-gantt-scroll')?.scrollTo({left:0,top:0});return true}
  if(action==='fullscreen'){ui.fullscreen=!ui.fullscreen;document.querySelector('#pf-app')?.classList.toggle('pf-fullscreen',ui.fullscreen);el.textContent=ui.fullscreen?'退出大屏':'全屏大屏';if(ui.taskId)refreshPF();return true}
  if(action==='open-node'){const task=allowedTasks().find(t=>t.id===el.dataset.taskId),node=task?.nodes.find(n=>n.id===el.dataset.nodeId);if(task&&node){overlayKind='node';overlayTask=task.id;overlayNode=node.id;ui.selectedNode=node.id;ui.workTab='单据简要信息';overlay('工作项与单据摘要',renderWorkDetail(task,node,ui.workTab))}return true}
  if(action==='image'){overlayKind='image';overlay('查看大图 · '+(el.dataset.label||''),`<img src="${e(el.dataset.image||'')}" alt="${e(el.dataset.label||'')}" decoding="sync"><p class="pf-image-error" role="status" hidden>图片加载失败，请关闭后重试；当前未替换为其他素材。</p><p class="pf-subtitle">图片来自当前关联资料；比例保持原样。</p>`,true);return true}
  if(action==='followup'||action==='estimate'){
    if(ui.role==='只读查看者'){notice('只读查看者不能登记跟进或修改本地预测');return true}
    if(!allowedTasks().some(t=>t.id===(el.dataset.taskId||ui.taskId))){notice('该任务不在当前角色范围');return true};if(action==='estimate'&&ui.role==='工厂主管'&&el.dataset.nodeId&&allowedTasks().find(t=>t.id===(el.dataset.taskId||ui.taskId))?.nodes.find(n=>n.id===el.dataset.nodeId)?.team!=='车缝厂A'){notice('仅本团队可以登记该工作项的负责人预计；请由跟单协调责任团队。');return true};overlayKind=action;overlayTask=el.dataset.taskId||ui.taskId;overlayNode=el.dataset.nodeId||'';overlay(action==='estimate'?'登记负责人预计结束':'登记跟进',followupForm(action==='estimate'));return true
  }
  if(action==='save-followup'){
    if(ui.role==='只读查看者'){notice('当前角色无写入权限');return true}
    const form=document.querySelector<HTMLFormElement>('#pf-overlays form');if(!form)return true
    const fd=new FormData(form),reason=String(fd.get('reason')||'').trim(),actionText=String(fd.get('action')||'').trim(),value=String(fd.get('expectedAt')||''),nodeId=String(fd.get('nodeId')||''),endAt=value?value+':00+08:00':''
    if(ui.role==='工厂主管'&&nodeId&&projectedTasks.find(t=>t.id===overlayTask)?.nodes.find(n=>n.id===nodeId)?.team!=='车缝厂A'){notice('保存已阻断：不能修改其他团队的负责人预计或工作记录。');return true}
    let error=!reason||!actionText?'请填写原因和跟进动作':overlayKind==='estimate'&&!value?'请填写负责人预计结束时间':''
    if(value&&(!Number.isFinite(Date.parse(endAt))||Date.parse(endAt)<Date.parse(currentSnapshot())))error='预计结束不得早于当前数据时点'
    if(error){const feedback=form.querySelector<HTMLElement>('.pf-form-error');if(feedback){feedback.hidden=false;feedback.textContent=error}return true}
    if(overlayKind==='estimate'){
      const i=projectedTasks.findIndex(t=>t.id===overlayTask)
      try{projectedTasks[i]=projectManualForecast(projectedTasks[i],nodeId,endAt);const records=JSON.parse(localStorage.getItem('dds-pf-forecasts-v1')||'[]') as unknown[];records.push({taskId:overlayTask,nodeId,endAt});localStorage.setItem('dds-pf-forecasts-v1',JSON.stringify(records))}catch(err){notice('预测未保存：'+String(err));return true}
    }
    writeFollowup({id:globalThis.crypto?.randomUUID?.()??`PF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,taskId:overlayTask,nodeId,author:ui.user,at:new Date().toISOString(),reason,action:actionText,expectedAt:endAt,kind:overlayKind==='estimate'?'本地预测调整':'跟进记录'})
    closeOverlay();refreshPF();notice('已保存本浏览器Mock记录；原始基线与生效截止未改变');return true
  }
  if(action==='columns'){overlayKind='columns';const root=document.querySelector('#pf-overlays');if(root){lastFocus=document.activeElement as HTMLElement;root.innerHTML=renderColumns(table)}return true}
  if(['toggle-column-visibility','toggle-column-freeze','column-up','restore-column-settings'].includes(action)){
    const ctx=tableContexts.get(activeTableId);if(!ctx)return true;const key=el.dataset.pfColumnKey||el.dataset.columnKey||el.dataset.key||'',col=ctx.columns.find(c=>c.key===key)
    if(action==='toggle-column-visibility'&&col&&!col.required&&!col.actionColumn){ctx.preferences.visibleKeys=ctx.preferences.visibleKeys.includes(key)?ctx.preferences.visibleKeys.filter(k=>k!==key):[...ctx.preferences.visibleKeys,key]}
    if(action==='toggle-column-freeze'&&col?.freezeable){ctx.preferences.frozenKeys=ctx.preferences.frozenKeys.includes(key)?ctx.preferences.frozenKeys.filter(k=>k!==key):[...ctx.preferences.frozenKeys,key]}
    if(action==='column-up'){const i=ctx.preferences.order.indexOf(key);if(i>0)[ctx.preferences.order[i-1],ctx.preferences.order[i]]=[ctx.preferences.order[i],ctx.preferences.order[i-1]]}
    if(action==='restore-column-settings'){ctx.preferences={order:ctx.columns.map(c=>c.key),visibleKeys:ctx.columns.map(c=>c.key),frozenKeys:ctx.columns.filter(c=>c.required&&c.freezeable).slice(0,1).map(c=>c.key),pageSize:20}}
    saveTablePreferences(ctx);refreshPF();const root=document.querySelector('#pf-overlays');if(root)root.innerHTML=renderColumns(activeTableId);return true
  }
  if(action==='sort-column'){const ctx=tableContexts.get(table),key=el.dataset.columnKey||'';if(ctx){ctx.sort={key,direction:ctx.sort?.key===key&&ctx.sort.direction==='asc'?'desc':'asc'};ctx.page=1;refreshPF()}return true}
  if(action==='prev-page'||action==='next-page'){const ctx=tableContexts.get(table);if(ctx){ctx.page+=action==='next-page'?1:-1;refreshPF()}return true}
  if(action==='print-task'){const task=projectedTasks.find(t=>t.id===(el.dataset.taskId||ui.taskId));if(task){overlayKind='print';overlay('任务摘要打印预览',`<div class="pf-print-summary">${task.imageUrl?`<img src="${e(task.imageUrl)}" alt="${e(task.styleName)}" style="width:64px;height:64px;object-fit:contain">`:""}<p>${e(task.styleName)} · ${e(task.styleRef)}</p><h2>${e(task.id)}</h2><p>读取于 ${dt(currentSnapshot())}</p><p>规则版本${e(task.ruleVersion)} · 范围：当前任务${e(task.id)}</p><p>${e(task.follower)} · ${e(task.accountableTeam)}</p><p>起点 ${dt(task.startedAt)} / 要求${task.standardDays===null?'待配置':fmt(task.standardDays)+'天'} / 截止${dt(task.effectiveDueAt)}</p><p>预计 ${dt(task.predictedFinishAt)} / ${e(assessTask(task).health)}</p><p>已发 ${task.quantityKnown===false?'待同步':fmt(task.shippedQty)} / 需求 ${fmt(task.effectiveQty)}件</p><p>卡点：${e(dependencyAnalysis(task).blockers.map(b=>b.node.name+'（'+b.node.sourceDocumentId+'） · '+b.reason).join('；')||'没有已确认的执行卡点；来源缺口另行核对')}</p>${button('打印此摘要','print-confirm')}</div>`)}return true}
  if(action==='print-confirm'){window.print();return true}
  if(action==='close'||action==='close-column-settings'||action==='backdrop'&&target===el){closeOverlay();return true}
  return true
}
export function handleProductionFulfillmentField(target:Element):boolean {
  const el=target.closest<HTMLInputElement|HTMLSelectElement>('[data-pf-field]');if(!el)return false
  const key=el.dataset.pfField||''
  if(key.startsWith('config-'))return handleConfigurationField(key,el)
  if(['data-issue-view','data-issue-owner-filter','data-issue-deadline-filter'].includes(key)){
    if(key==='data-issue-view')dataIssueFilters.state=['待处理','已恢复','全部'].includes(el.value)?el.value as DataIssueFilters['state']:'待处理'
    if(key==='data-issue-owner-filter')dataIssueFilters.owner=el.value
    if(key==='data-issue-deadline-filter')dataIssueFilters.deadline=['全部','未登记','已逾期','2日内到期','2日后到期'].includes(el.value)?el.value as DataIssueFilters['deadline']:'全部'
    resetTablePages();refreshPF();return true
  }
  if(key==='pageSize'){const id=el.closest<HTMLElement>('[data-pf-table]')?.dataset.pfTable,ctx=tableContexts.get(id||'');if(ctx){ctx.preferences.pageSize=Number(el.value);ctx.page=1;saveTablePreferences(ctx);refreshPF()}return true}
  if(key==='analysis-view'){ui.analysisView=el.value;refreshPF();return true}
  if(key==='timeline-team'){ui.timelineTeam=el.value;refreshPF();return true}
  if(key==='timeline-basis'){ui.timelineBasis=el.value;refreshPF();return true}
  if(key==='timeline-mode'){ui.timelineMode=el.value;refreshPF();return true}
  if(key==='timeline-scale'){ui.timelineScale=el.value;refreshPF();return true}
  if(key in ui.draft){if(key==='issuesOnly')ui.draft.issuesOnly=(el as HTMLInputElement).checked;else (ui.draft as unknown as Record<string,unknown>)[key]=el.value;return true}
  return true
}
export function handleProductionFulfillmentKey(event:KeyboardEvent):boolean {
  if(!document.querySelector('#pf-app'))return false
  if(event.key==='Escape'){
    if(overlayKind){closeOverlay();event.preventDefault();return true}
    if(ui.fullscreen){ui.fullscreen=false;document.querySelector('#pf-app')?.classList.remove('pf-fullscreen');if(ui.taskId)refreshPF();event.preventDefault();return true}
    if(ui.section==='configuration'){handleConfigurationAction('config-close',document.querySelector('#pf-app') as HTMLElement,refreshPF,notice);return true}
  }
  if(event.key==='Tab'&&(overlayKind||document.querySelector('.pf-config-dialog'))){const panel=document.querySelector('#pf-overlays [role="dialog"],.pf-config-dialog');const controls=Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href]')??[]);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();return true}if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();return true}}
  if(event.key==='Enter'&&(event.target as Element)?.closest('#pf-filter')){const query=document.querySelector('[data-pf-action="query"]');if(query)handleProductionFulfillmentClick(query);event.preventDefault();return true}
  return false
}

if(typeof document!=='undefined')document.addEventListener('error',event=>{
  const img=event.target;if(!(img instanceof HTMLImageElement)||!img.closest('#pf-app'))return;
  const feedback=img.parentElement?.querySelector<HTMLElement>('.pf-image-error');if(feedback)feedback.hidden=false;
},true)
let draggingColumn=''
setConfigurationTaskSource(()=>projectedTasks)
connectProductionFulfillmentHandlers({click:handleProductionFulfillmentClick,field:handleProductionFulfillmentField,key:handleProductionFulfillmentKey})
if(typeof document!=='undefined')for(const type of ['dragstart','dragover','drop','dragend'])document.addEventListener(type,event=>{
  const drag=event as DragEvent,target=(event.target as Element)?.closest<HTMLElement>('#pf-overlays [data-standard-list-column-drag]')
  if(!target)return
  event.stopPropagation()
  const key=target.dataset.pfColumnKey??''
  if(type==='dragstart'){draggingColumn=key;drag.dataTransfer?.setData('text/plain',key);return}
  if(type==='dragend'){draggingColumn='';return}
  if(!draggingColumn)return
  event.preventDefault()
  if(type==='dragover'){if(drag.dataTransfer)drag.dataTransfer.dropEffect='move';return}
  const ctx=tableContexts.get(activeTableId);if(!ctx)return
  const from=ctx.preferences.order.indexOf(draggingColumn),to=ctx.preferences.order.indexOf(key)
  draggingColumn=''
  if(from<0||to<0||from===to)return
  const [moved]=ctx.preferences.order.splice(from,1);ctx.preferences.order.splice(to,0,moved);saveTablePreferences(ctx);refreshPF()
  const root=document.querySelector('#pf-overlays');if(root)root.innerHTML=renderColumns(activeTableId)
},true)
