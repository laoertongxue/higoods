// @page-pattern: detail
import type { PFNode, PFTask } from './model'
import type { ViewState } from './ui-state'
import { renderDependencyGraph } from './dependency-graph'
import { e, fmt, dt, anchor, badge, button, renderDataTable } from './common'

export function renderTaskSources(task:PFTask):string {
  const source=task.sourceContext
  if(!source)return ''
  return `<section class="pf-source-strip" aria-label="任务业务来源"><div><span>生产需求</span>${anchor(task.demandNo+' · 需求列表',source.demandHref)}</div><div><span>生产准备</span>${source.preparationHref?anchor(task.preparationNo,source.preparationHref):'<b>未关联</b>'}</div><div><span>工艺路线</span>${source.technicalHref?anchor(source.technicalVersionLabel||'技术包',source.technicalHref):'<b>未关联</b>'}</div>${button('关联来源','bind-sources',`data-task-id="${e(task.id)}"`)}</section>`
}
function empty(text:string,href?:string):string {return `<section class="pf-source-empty"><strong>${e(text)}</strong><p>先明确业务来源，再生成对应工作和串并行关系。</p>${href?anchor('查看来源',href):''}</section>`}
function entryButton(task:PFTask,node:PFNode):string {return button(node.name,'open-node',`data-task-id="${e(task.id)}" data-node-id="${e(node.id)}"`)}
export function renderPreparation(task:PFTask,state:ViewState):string {
  const source=task.sourceContext,nodes=task.nodes.filter(n=>n.origin==='preparation')
  if(!source?.preparationId)return empty('尚未关联生产准备单。准备工作、适用类型与复用结果不能由系统猜测。')
  const excluded=source.excludedPreparation||[]
  return `<div class="pf-source-summary"><strong>${e(task.preparationNo)}</strong><span>${e(source.preparationType||'类型待确认')}</span>${badge(source.preparationState||'状态待同步')}<span>${nodes.length} 项适用工作 · ${nodes.filter(n=>n.includedInProductionDuration===false).length} 项结果复用</span>${source.preparationHref?anchor('打开生产准备单',source.preparationHref):''}</div>`+renderDataTable('prep-'+task.id,'适用专业任务',[
    {key:'name',title:'准备工作',width:210,required:true,freezeable:true,render:(n:PFNode)=>entryButton(task,n)},
    {key:'state',title:'执行状态',width:145,render:(n:PFNode)=>badge(n.businessState)},
    {key:'owner',title:'责任团队 / 人',width:150,render:(n:PFNode)=>`${e(n.team)}<small>${e(n.owner||'待指派')}</small>`},
    {key:'predecessors',title:'直接前置',width:240,render:(n:PFNode)=>n.predecessors.map(id=>task.nodes.find(x=>x.id===id)?.name||id).map(e).join('、')||'无直接前置'},
    {key:'time',title:'实际开始 → 完成',width:200,render:(n:PFNode)=>`${dt(n.actualStartAt)}<small>→ ${dt(n.actualEndAt)}</small>`},
    {key:'sla',title:'时效要求 / 实际用时',width:160,render:(n:PFNode)=>`${n.durationDays===null?'要求待配置':fmt(n.durationDays)+' 天'}<small>实际 ${n.actualElapsedDays===null?'待同步':fmt(n.actualElapsedDays)+' 天'}</small>`},
    {key:'reuse',title:'本次计时',width:220,render:(n:PFNode)=>n.includedInProductionDuration===false?'复用有效结果 · 不重复计时':e(n.durationSource)},
  ],nodes,state,{embedded:true})+`<details class="pf-source-exclusions"><summary>不适用或未启用的准备工作（${excluded.length}）</summary>${excluded.map(n=>`<p><b>${e(n.name)}</b><span>${e(n.reason)}</span></p>`).join('')||'<p>无排除工作</p>'}</details>`
}
export function renderProcessRoute(task:PFTask,state:ViewState):string {
  const source=task.sourceContext
  if(!source?.technicalVersionId)return empty('尚未关联正式技术包，无法确认本任务工艺路线。')
  return `<div class="pf-source-summary"><strong>技术包 ${e(source.technicalVersionLabel||source.technicalVersionId)}</strong>${badge(source.routeStatus||'路线待确认')}<span>工艺与实际执行任务</span>${source.technicalHref?anchor('打开技术包工艺路线',source.technicalHref):''}</div>`+renderDependencyGraph(task,state,true)
}
export function renderSourceGaps(task:PFTask):string {
  const gaps=task.sourceContext?.gaps||[]
  return gaps.length?`<details class="pf-source-gaps"><summary>时效暂不能完整判定 · ${gaps.length} 项待补</summary><ul>${gaps.map(gap=>`<li>${e(gap)}</li>`).join('')}</ul></details>`:''
}
