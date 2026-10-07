// @page-pattern: detail
import type { PFNode, PFTask } from './model'
import type { ViewState } from './ui-state'
import { e, fmt, dt, button, badge } from './common'
import { isWorkReleased, isWorkTerminal, dependencyAnalysis, workDependencyState } from './calculations'
import { stages } from './fixtures'
import { workObjectLabel, releaseLabel } from './work-labels'

export { dependencyAnalysis } from './calculations'
const completed=isWorkReleased
const terminal=isWorkTerminal
export function dependencyLayout(nodes:PFNode[]) {
  const byId=new Map(nodes.map(n=>[n.id,n])),ranks=new Map<string,number>(),cycles=new Set<string>()
  const visit=(id:string,stack=new Set<string>()):number=>{
    if(ranks.has(id))return ranks.get(id)!
    if(stack.has(id)){stack.forEach(key=>cycles.add(key));return 0}
    const next=new Set([...stack,id]),parents=byId.get(id)!.predecessors.filter(p=>byId.has(p))
    const rank=parents.length?1+Math.max(...parents.map(p=>visit(p,next))):0
    ranks.set(id,rank);return rank
  }
  nodes.forEach(n=>visit(n.id))
  const width=256,height=218,gapX=56,gapY=24,pad=20
  const reach=(id:string,seen=new Set<string>()):number=>{if(seen.has(id))return 0;seen.add(id);return nodes.filter(n=>n.predecessors.includes(id)).reduce((count,n)=>count+1+reach(n.id,seen),0)}
  const columns=Array.from({length:Math.max(0,...ranks.values())+1},(_,rank)=>nodes.filter(n=>ranks.get(n.id)===rank))
  // Keep the connected production path on the first row. Unrelated metadata must
  // not visually occupy the place of an arrow's actual upstream node.
  columns[0].sort((a,b)=>reach(b.id)-reach(a.id)||Number(!b.sourceDocumentId)-Number(!a.sourceDocumentId))
  for(let column=1;column<columns.length;column++){
    const parentRow=(n:PFNode)=>Math.min(...n.predecessors.map(id=>columns[column-1].findIndex(p=>p.id===id)).filter(i=>i>=0),nodes.length)
    columns[column].sort((a,b)=>parentRow(a)-parentRow(b))
  }
  const rows=Math.max(1,...columns.map(c=>c.length)),positions=new Map<string,{x:number;y:number}>()
  columns.forEach((column,index)=>column.forEach((n,row)=>positions.set(n.id,{x:pad+index*(width+gapX),y:pad+row*(height+gapY)})))
  return {columns,positions,width,height,canvasWidth:pad*2+columns.length*(width+gapX)-gapX,canvasHeight:pad*2+rows*(height+gapY)-gapY,cycles}
}
function workButton(task:PFTask,node:PFNode,label=node.name):string {return button(label,'open-node',`data-task-id="${e(task.id)}" data-node-id="${e(node.id)}"`)}
export function renderBlockerSummary(task:PFTask):string {
  const {blockers,dataGaps}=dependencyAnalysis(task),lead=blockers[0]
  return `<section class="pf-blocker-summary" aria-label="具体工作卡点"><div class="pf-blocker-summary-main"><strong>${lead?'当前首要卡点':'当前无已确认的执行卡点'}</strong>${lead?workButton(task,lead.node):'<span>缺少单据、标准或进度时，不作正常判断</span>'}${lead?badge(lead.kind==='逾期'?'已逾期':lead.kind==='风险'?'预计逾期':'阻塞'):''}<span>${lead?e(lead.reason):''}</span>${lead?button('定位卡点','locate-bottleneck',`data-node-id="${e(lead.node.id)}"`):''}</div>${lead?`<div class="pf-blocker-summary-meta">${e(lead.node.sourceDocumentType)} ${e(lead.node.sourceDocumentId)} · ${e(lead.node.team)}${lead.node.factory?' / '+e(lead.node.factory):''} · 影响 ${lead.downstream.length} 项后续工作${task.effectiveDueAt?'':' · 整体截止待配置，尚不能折算总延误'}</div>`:''}${blockers.length>1?`<details><summary>其他 ${blockers.length-1} 个具体卡点</summary>${blockers.slice(1).map(b=>`<div class="pf-blocker-other">${workButton(task,b.node)}<span>${e(b.reason)} · ${e(b.node.factory||b.node.team)} · 影响 ${b.downstream.length} 项</span>${button('定位','locate-bottleneck',`data-node-id="${e(b.node.id)}"`)}</div>`).join('')}</details>`:''}</section>`
}
export function renderDependencyGraph(task:PFTask,state:ViewState,routeOnly=false):string {
  const analysis=dependencyAnalysis(task),blockerIds=new Set(analysis.blockers.map(b=>b.node.id))
  const affected=new Set(analysis.blockers.flatMap(b=>b.downstream))
  let nodes=routeOnly?task.nodes.filter(n=>n.origin==='route'||n.origin==='execution'):task.nodes
  if(!routeOnly&&state.dependencyScope==='卡点与影响'){
    const keep=new Set([...blockerIds,...affected])
    const ancestors=(id:string)=>{for(const p of analysis.byId.get(id)?.predecessors||[])if(!keep.has(p)){keep.add(p);ancestors(p)}}
    analysis.blockers.forEach(b=>ancestors(b.node.id));nodes=nodes.filter(n=>keep.has(n.id))
  }
  if(!nodes.length)return `<section class="pf-dependency-panel"><div class="pf-dependency-toolbar">${button('全部工作','dependency-scope','data-value="全部工作"')}</div><p class="pf-source-empty">${routeOnly?'当前未关联工艺工作':'尚无可确认的执行卡点。可切回全部工作查看来源缺口。'}</p></section>`
  const layout=dependencyLayout(nodes),visible=new Set(nodes.map(n=>n.id)),zoom=state.dependencyZoom||1
  const edgeCount=nodes.reduce((count,n)=>count+n.predecessors.filter(id=>visible.has(id)).length,0)
  const edges=nodes.flatMap(n=>n.predecessors.filter(id=>visible.has(id)).map(id=>{
    const from=layout.positions.get(id)!,to=layout.positions.get(n.id)!,x=from.x+layout.width,y=from.y+layout.height/2,ty=to.y+layout.height/2
    const impacted=blockerIds.has(id)||affected.has(id),color=impacted?'#dc2626':'#94a3b8'
    return `<path data-dependency-from="${e(id)}" data-dependency-to="${e(n.id)}" d="M ${x} ${y} H ${x+24} V ${ty} H ${to.x-7}" fill="none" stroke="${color}" stroke-dasharray="${n.releaseMode==='分批'?'5 3':''}" stroke-width="${impacted?2:1.5}" marker-end="url(#pf-flow-${impacted?'red':'gray'})"><title>${e(analysis.byId.get(id)?.name||id)} → ${e(n.name)}${n.releaseMode==='分批'?' · 达到分批放行条件':''}</title></path>`
  })).join('')
  const cards=nodes.map(n=>{
    const p=layout.positions.get(n.id)!,missing=analysis.dataGaps.includes(n),isBlocker=blockerIds.has(n.id),parents=analysis.pendingParents(n),dependency=workDependencyState(task,n),waiting=dependency.waiting
    const stateClass=missing?'unknown':isBlocker?'blocked':completed(n)?'done':terminal(n)?'unknown':dependency.unknown?'unknown':waiting?'waiting':n.actualStartAt?'running':'pending'
    const status=missing?'来源待确认':isBlocker?'当前卡点':terminal(n)?n.businessState:dependency.status
    const due=n.localDueAt||n.baselineDueAt
    return `<button class="pf-flow-node pf-flow-${stateClass} ${affected.has(n.id)?'pf-flow-affected':''} ${state.selectedNode===n.id?'is-selected':''}" style="left:${p.x}px;top:${p.y}px;width:${layout.width}px;height:${layout.height}px" data-flow-node="${e(n.id)}" data-pf-action="open-node" data-task-id="${e(task.id)}" data-node-id="${e(n.id)}" title="${e(n.name)} · ${e(workObjectLabel(task,n))} · ${e(releaseLabel(n))}"><span class="pf-flow-node-stage">${e(n.stage)} · ${e(stages.find(stage=>stage.id===n.stage)?.name||'阶段待确认')}</span><span class="pf-flow-node-head"><b>${e(n.name)}</b><em>${e(status)}</em></span><span class="pf-flow-node-doc">${e(workObjectLabel(task,n))}</span><span class="pf-flow-node-owner">${e(n.factory||n.team)} · ${e(n.owner||'待指派')}</span><span class="pf-flow-node-time">要求 ${n.durationDays===null?'待配置':fmt(n.durationDays)+'天'} <i>已用 ${n.actualElapsedDays===null?'—':fmt(n.actualElapsedDays)+'天'}</i></span><span class="pf-flow-node-progress">${n.quantityKnown===false?'完成数待同步':`完成 ${fmt(n.qualifiedQty)} / ${n.requiredQuantityKnown===false?'待确认':fmt(n.requiredQty)} ${e(n.unit)}`}${due?` · 截止 ${dt(due,true)}`:''}</span><span class="pf-flow-node-note">${e(isBlocker?analysis.blockers.find(b=>b.node.id===n.id)!.reason:missing?'来源待核实，协调人 '+task.follower:dependency.note)}</span></button>`
  }).join('')
  return `<section class="pf-dependency-panel" data-dependency-panel><div class="pf-dependency-toolbar"><div role="group" aria-label="依赖图范围">${!routeOnly?['全部工作','卡点与影响'].map(value=>button(value,'dependency-scope',`data-value="${value}" aria-pressed="${(state.dependencyScope||'全部工作')===value}"`)).join(''):''}</div><span>${nodes.length} 项工作 · ${edgeCount} 条明确依赖</span><div class="pf-dependency-tools">${[.75,1,1.25].map(value=>button(value*100+'%','dependency-zoom',`data-zoom="${value}" aria-pressed="${zoom===value}"`)).join('')}${button('定位卡点','locate-bottleneck',analysis.blockers.length?'':'disabled')}</div></div><div class="pf-dependency-legend"><span class="pf-red">● 当前卡点</span><span class="pf-amber">● 等待前置</span><span class="pf-blue">● 进行中</span><span class="pf-green">● 已完成</span><span>┄ 来源 / 执行进度待核实</span><span>→ 按前置衔接；分叉为对象分支；整批 / 分批按已确认规则；虚线为分批放行</span></div><div class="pf-dependency-scroll" tabindex="0" aria-label="工作项依赖关系图，可横向和纵向滚动"><div style="width:${layout.canvasWidth*zoom}px;height:${layout.canvasHeight*zoom}px"><div class="pf-dependency-canvas" style="width:${layout.canvasWidth}px;height:${layout.canvasHeight}px;transform:scale(${zoom})"><svg width="${layout.canvasWidth}" height="${layout.canvasHeight}" aria-label="明确前后依赖箭头"><defs>${['gray','red'].map((name)=>`<marker id="pf-flow-${name}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${name==='red'?'#dc2626':'#94a3b8'}"/></marker>`).join('')}</defs>${edges}</svg>${cards}</div></div></div><p class="pf-dependency-caption">箭头表示来源记录的工艺关系；实际等待须有执行依据。未连线的工作只表示关系尚未记录，不等于可并行。点击工作卡片查看对应单据。</p></section>`
}
