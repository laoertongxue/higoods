// @page-pattern: list
// 表格通过 common.renderDataTable 统一调用 renderStandardListPage、renderStandardListTable、renderTablePagination，避免重复标准组件装配。
import type { StandardListColumn } from '../../components/ui/list-table'
import type { PFTask, PFNode } from './model'
import type { ViewState } from './ui-state'
import { base } from './ui-state'
import { assessTask, taskStats, getNodes } from './calculations'
import { e, fmt, dt, badge, anchor, button, card, styleCell, materialCell, renderDataTable } from './common'

export function summary(tasks:PFTask[]):string {
  const s=taskStats(tasks)
  const remainingUnknown=tasks.some(t=>assessTask(t).active&&(t.quantityKnown===false||t.shipmentQuantityKnown===false))
  return `<div class="pf-kpis">${[['范围内任务',s.totalTasks,'全部'],['在途已逾期',s.overdueTasks,'已逾期'],['在途有风险',s.riskTasks,'预计逾期'],['待判定',s.unknownTasks,'待判定'],['在途剩余件数',remainingUnknown?'待同步':s.remainingQty,'']].map(([name,value,health])=>`<${health?'button':'div'} ${health?`data-pf-action="health-filter" data-value="${health}"`:""} class="pf-kpi"><span>${name}</span><b>${value==='待同步'?value:fmt(Number(value))}</b></${health?'button':'div'}>`).join('')}</div>`
}
function taskQuantityCell(task:PFTask):string {
  const quantityKnown=task.quantityKnown!==false
  const shipmentKnown=quantityKnown&&task.shipmentQuantityKnown!==false
  if(!quantityKnown||!shipmentKnown)return `${shipmentKnown?fmt(task.shippedQty):'待同步'} / ${fmt(task.effectiveQty)} ${e(task.unit)}<small>进度待同步 · 剩余待同步</small>`
  return `${fmt(task.shippedQty)} / ${fmt(task.effectiveQty)} ${e(task.unit)}<div class="pf-progress"><i style="width:${task.progressPct??0}%"></i></div><small>${task.progressPct===null?'终止，不计100%完成':fmt(task.progressPct)+'%'} · 剩余 ${fmt(task.remainingQty)}</small>`
}
export function taskColumns():StandardListColumn<PFTask>[] {return [
  {key:'id',title:'生产任务 / 需求来源',width:220,required:true,freezeable:true,sortable:true,render:t=>`${anchor(t.id,`${base}/tasks/${t.id}`)}<small>采购 ${e(t.purchaseNo)}<br>需求 ${e(t.demandNo)}</small>`},
  {key:'style',title:'款式',width:210,render:styleCell},
  {key:'health',title:'时效 / 业务状态',width:145,sortable:true,render:t=>`${badge(assessTask(t).health)}<small>${e(t.businessState)}</small>`},
  {key:'follower',title:'跟单 / 总责团队',width:140,sortable:true,render:t=>`${e(t.follower)}<small>${e(t.accountableTeam)}</small>`},
  {key:'startedAt',title:'起点 / 已用自然日',width:170,sortable:true,render:t=>`${dt(t.startedAt)}<small>已用 ${fmt(assessTask(t).elapsedDays)} 天</small>`},
  {key:'standardDays',title:'要求 / 生效截止',width:175,sortable:true,sortValue:t=>t.standardDays??Infinity,render:t=>`<b>${t.standardDays===null?'待判定':fmt(t.standardDays)+' 自然日'}</b><small>${dt(t.effectiveDueAt)}</small>`},
  {key:'predictedFinishAt',title:'预计完成 / 预测偏差',width:180,sortable:true,render:t=>`${dt(t.predictedFinishAt)}<small>${assessTask(t).predictedDelayDays===null?'风险待判定':'预计超期 '+fmt(assessTask(t).predictedDelayDays)+' 天'}</small>`},
  {key:'quantity',title:'发货 / 有效需求',width:175,render:taskQuantityCell},
  {key:'blocker',title:'卡点 / 责任团队',width:250,render:t=>`${e(assessTask(t).blocker||'暂无已知卡点')}<small>${e(assessTask(t).responsibleTeam||'—')}</small>`},
  {key:'operations',title:'操作',width:90,actionColumn:true,required:true,render:t=>anchor('全程时效',`${base}/tasks/${t.id}`)},
]}
export function renderTasks(tasks:PFTask[],state:ViewState):string {
  const mine=state.section==='follow-up'
  return `${mine?`<p class="pf-list-context">跟单 <b>${e(state.filters.follower)}</b> · 点击任务查看卡点与执行责任</p>`:`<p class="pf-list-context">${anchor('返回时效总览',base+'/overview')} · 当前条件内的生产任务</p>`}${summary(tasks)}${renderDataTable(mine?'follow-up':'tasks',mine?'我的生产任务':'生产任务',taskColumns(),tasks,state)}`
}
export type WorkRow=PFNode & {task:PFTask; relatedTasks?:PFTask[]}
export function workColumns():StandardListColumn<WorkRow>[] {return [
  {key:'id',title:'工作项 / 来源任务',width:230,required:true,freezeable:true,render:n=>`${button(n.name,'open-node',`data-task-id="${e(n.taskId)}" data-node-id="${e(n.id)}"`)}<small>${(n.relatedTasks??[n.task]).map(t=>anchor(t.id,`${base}/tasks/${t.id}`)).join(' / ')}</small>`},
  {key:'object',title:'款式 / 物料',width:210,render:n=>n.material?materialCell(n.material):styleCell(n.task)},
  {key:'team',title:'责任团队 / 人',width:160,sortable:true,render:n=>`${e(n.team)}<small>${e(n.owner||'负责人待指派')}</small>`},
  {key:'factory',title:'责任工厂',width:150,sortable:true,render:n=>e(n.factory||'未指定')},
  {key:'businessState',title:'业务 / 时效状态',width:165,sortable:true,render:n=>`${badge(n.timeState)}<small>${e(n.businessState)}</small>`},
  {key:'durationDays',title:'单项要求',width:130,sortable:true,sortValue:n=>n.durationDays??Infinity,render:n=>`${n.durationDays===null?'待配置':fmt(n.durationDays)+' 自然日'}<small>${n.includedInProductionDuration===false?'里程碑 / 复用，不重复计时':n.timingKind==='groupProxy'?'组预算；子项不重复累加':'独立计时'}</small>`},
  {key:'standardStartAt',title:'计划开始 / 截止',width:170,render:n=>`${dt(n.standardStartAt,true)}<small>${dt(n.baselineDueAt,true)}</small>`},
  {key:'actualStartAt',title:'实际开始 / 结束',width:170,render:n=>`${dt(n.actualStartAt,true)}<small>${dt(n.actualEndAt,true)}</small>`},
  {key:'actualElapsedDays',title:'已用 / 逾期',width:135,render:n=>`${fmt(n.actualElapsedDays)} / ${n.localDueAt||n.baselineDueAt?fmt(n.actualOverdueDays):'待判'} 天`},
  {key:'predictedEndAt',title:'预计结束 / 风险',width:175,render:n=>`${dt(n.predictedEndAt,true)}<small>${n.predictedDelayDays===null?'风险待判定':'预计超期 '+fmt(n.predictedDelayDays)+' 天'}</small>`},
  {key:'quantity',title:'合格完成 / 应完成',width:155,render:n=>`${n.quantityKnown===false?'待同步':fmt(n.qualifiedQty)} / ${n.requiredQuantityKnown===false?'待同步':fmt(n.requiredQty)} ${e(n.unit)}${n.quantityScope?'<small>'+e(n.quantityScope)+'</small>':''}`},
  {key:'mappingState',title:'关联单据 / 数据',width:190,render:n=>`${e(n.sourceDocumentId)}<small>${e(n.mappingState)} · ${dt(n.sourceUpdatedAt,true)}</small>`},
]}
export function renderWorkItems(tasks:PFTask[],state:ViewState):string {
  const rows=workRows(tasks,state)
  return `<div class="pf-kpis"><div class="pf-kpi"><span>工作实例</span><b>${rows.length}</b></div><div class="pf-kpi"><span>已逾期</span><b>${rows.filter(n=>n.timeState==='已逾期').length}</b></div><div class="pf-kpi"><span>预计逾期</span><b>${rows.filter(n=>n.timeState==='预计逾期').length}</b></div><div class="pf-kpi"><span>待判定</span><b>${rows.filter(n=>n.timeState==='待判定').length}</b></div><div class="pf-kpi"><span>已完成</span><b>${rows.filter(n=>n.actualEndAt).length}</b></div></div>${renderDataTable('work-items','工作项监控',workColumns(),rows,state)}<details class="pf-metric-definition"><summary>数量与责任计时口径</summary><p>各工作使用自己的应完成数量；入库、到厂、目标SKU可用分别判断。等待前置不启动团队执行计时，但整体节点持续计时。</p></details>`
}
export function workRows(tasks:PFTask[],state:ViewState):WorkRow[] {
  return getNodes(tasks).map(node=>({...node,task:tasks.find(t=>t.id===node.taskId)??tasks.find(t=>t.nodes.some(n=>n.id===node.id))!,relatedTasks:tasks.filter(t=>t.nodes.some(n=>n.id===node.id))})).filter(n=>{
    const f=state.filters,q=f.query.trim().toLowerCase()
    if(q&&![n.id,n.name,n.sourceDocumentId,n.taskId,n.task.purchaseNo,n.task.demandNo,n.task.styleRef,...n.task.productionOrderNos].join(' ').toLowerCase().includes(q))return false
    if(f.team!=='全部'&&n.team!==f.team||f.factory&&f.factory!=='全部'&&(n.factory||'未指定')!==f.factory||f.stage!=='全部'&&n.stage!==f.stage)return false
    if(f.health!=='全部'&&n.timeState!==(f.health==='有风险'?'预计逾期':f.health))return false
    if(f.issuesOnly&&!/风险|逾期|待判定|临期/.test(n.timeState))return false
    const date=f.dateField==='起点'?n.actualStartAt:f.dateField==='预计完成'?n.predictedEndAt:n.localDueAt??n.baselineDueAt
    if((f.dateFrom||f.dateTo)&&!date)return false
    const offset='+08:00',ts=date?Date.parse(date):0
    if(f.dateFrom&&ts<Date.parse(`${f.dateFrom}T00:00:00${offset}`)||f.dateTo&&ts>=Date.parse(`${f.dateTo}T00:00:00${offset}`)+86400000)return false
    return true
  })
}
