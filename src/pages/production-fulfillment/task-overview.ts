import type { PFTask, PFNode } from './model'
import { stages } from './fixtures'
import { dependencyAnalysis, isWorkReleased, isWorkTerminal, isExecutionProgressUnknown } from './calculations'
import { e, dt, badge, button, anchor } from './common'
import { workObjectLabel, workLabel } from './work-labels'
import { readFollowups, followupStorageState } from './followup-storage'

function nodeAction(task:PFTask,node:PFNode,label='查看工作'):string {
  return button(label,'open-node',`data-task-id="${e(task.id)}" data-node-id="${e(node.id)}"`)
}
export function renderTaskOverview(task:PFTask):string {
  const analysis=dependencyAnalysis(task)
  const confirmed=task.nodes.filter(n=>isWorkReleased(n)||Boolean(n.actualStartAt)&&!isExecutionProgressUnknown(n))
  const routeUnknown=task.nodes.filter(n=>isExecutionProgressUnknown(n)&&n.origin==='route')
  const issues=analysis.dataGaps.slice().sort((a,b)=>Number(a.origin!=='decision')-Number(b.origin!=='decision')).slice(0,3)
  if(routeUnknown.length)issues.push(routeUnknown[0])
  const rows=issues.slice(0,4).map(node=>{
    const route=node.origin==='route',label=route?'加工执行进度待核实':node.name
    const detail=route?`${routeUnknown.length} 个工艺工作尚未取得对应执行进度、工厂及完成数量`:node.blocker||node.dependencyNote||'对应来源资料待确认'
    const last=readFollowups().filter(r=>r.taskId===task.id&&r.nodeId===node.id).sort((a,b)=>b.at.localeCompare(a.at))[0]
    return `<article class="pf-review-item"><div><strong>${e(label)}</strong><p>${e(detail)}</p><small>协调 ${e(task.follower)} · 对接 ${e(node.team)} · ${last?.expectedAt?'负责人预计结束 '+dt(last.expectedAt):'后续安排待登记'}</small>${last?`<small>最近跟进：${e(last.action)} · ${dt(last.at)}</small>`:''}</div><div class="pf-review-item-actions">${nodeAction(task,node,'核对来源')}${button('登记跟进','followup',`data-task-id="${e(task.id)}" data-node-id="${e(node.id)}"`)}</div></article>`
  }).join('')
  const blockers=analysis.blockers.map(b=>`<article class="pf-review-item pf-confirmed-blocker"><div><strong>${e(workLabel(task,b.node))}</strong><p>${e(b.reason)} · 影响 ${b.downstream.length} 项后续工作</p><small>${e(b.node.factory||b.node.team)} · ${e(b.node.owner||'执行负责人待明确')}</small></div>${nodeAction(task,b.node,'查看卡点')}</article>`).join('')
  const facts=confirmed.slice(0,4).map(node=>`<div class="pf-confirmed-fact"><span>${badge(node.businessState)}</span><div><strong>${e(node.name)}</strong><small>${e(node.origin==='route'?workObjectLabel(task,node):node.sourceDocumentType)} · ${dt(node.actualEndAt||node.actualStartAt)}</small></div>${nodeAction(task,node,'查看')}</div>`).join('')
  const latest=readFollowups().filter(r=>r.taskId===task.id).sort((a,b)=>b.at.localeCompare(a.at))[0]
  const storage=followupStorageState()
  const stageCards=stages.map(stage=>{
    const nodes=task.nodes.filter(n=>n.stage===stage.id),done=nodes.filter(isWorkReleased).length,active=nodes.filter(n=>n.actualStartAt&&!isWorkTerminal(n)).length,unknown=nodes.filter(isExecutionProgressUnknown).length
    const state=!nodes.length?'工作范围待确认':active?`${active} 项实际进行中`:unknown?`${unknown} 项进度待核实`:done===nodes.length?'已确认完成':'按来源继续跟进'
    return `<button class="pf-business-stage ${active?'is-running':''}" data-pf-action="overview-stage" data-stage="${e(stage.id)}"><small>${e(stage.id)}</small><b>${e(stage.name)}</b><span>${e(state)}</span><small>${nodes.length?`已读取 ${nodes.length} 项 · 完成 ${done} 项`:'尚未读取适用工作'}</small></button>`
  }).join('')
  return `<section class="pf-business-status" aria-label="当前任务判断"><div><strong>${analysis.blockers.length?'已确认 '+analysis.blockers.length+' 项卡点':task.sourceContext?'现场执行进度待核实':'按当前已确认事实跟进'}</strong><p>${task.sourceContext?'已读取需求与关联资料；实际加工、齐料及发货按对应来源分别核实。':'执行状态、责任截止与预计风险分别判断。'}${task.sourceContext?.timingScope?.state==='pending'?' 必要工作范围尚未确认，全程时效暂不能完整判断。':''}</p></div>${button('登记跟进','followup',`data-task-id="${e(task.id)}"`)}</section><div class="pf-business-columns"><section class="pf-business-card"><header><h3>优先核实与跟进</h3><span>${analysis.blockers.length?'含已确认卡点':'尚无已确认执行卡点'}</span></header>${blockers}${rows||'<p class="pf-business-empty">当前没有待核实来源事项。</p>'}<footer>${button('查看全部资料缺口','show-source-gaps')}<small>登记跟进后，仍以来源事实确认进度</small></footer></section><section class="pf-business-card"><header><h3>已确认事实</h3><span>${confirmed.length} 项</span></header>${facts||'<p class="pf-business-empty">尚未取得实际执行事实。</p>'}<div class="pf-latest-followup"><strong>最近跟进</strong>${storage.error?`<p>${e(storage.error)}</p>`:latest?`<p>${e(latest.action)}</p><small>${e(latest.author)} · ${dt(latest.at)}${latest.expectedAt?' · 预计 '+dt(latest.expectedAt):''}</small>`:storage.loaded?'<p>尚无已保存跟进记录</p>':'<p>跟进资料读取中</p>'}</div><footer><small>需求来源更新 ${dt(task.lastProgressAt)}<br>执行进度更新 ${task.lastExecutionProgressAt?dt(task.lastExecutionProgressAt):'尚未取得执行记录'}</small>${button('重新读取','refresh-task')}</footer></section></div><section class="pf-business-card pf-business-stages"><header><h3>阶段概览</h3><span>未取得工作 ≠ 已确认不适用</span></header><div class="pf-business-stage-grid">${stageCards}</div><p class="pf-business-caption">按本需求已关联工作展示；工艺分支保留实际关系，未确认的工作范围不推定省略。</p></section><details class="pf-source-gaps" data-source-gaps><summary>全部待核实资料与时效依据（${task.sourceContext?.gaps.length||0}）</summary><ul>${(task.sourceContext?.gaps||[]).map(gap=>`<li>${e(gap)}</li>`).join('')}</ul>${task.sourceContext?.demandHref?anchor('打开来源生产需求列表',task.sourceContext.demandHref):''}</details>`
}
