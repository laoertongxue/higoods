// @page-pattern: detail
import type { PFTask, PFNode } from './model'
import type { ViewState } from './ui-state'
import { stages, snapshot } from './fixtures'
import { dayDiff, calculateNetwork } from './calculations'
import { e, fmt, dt, badge, button, select } from './common'

export function renderTimeline(task:PFTask,state:ViewState):string {
  const now=task.asOf??snapshot
  const graph=calculateNetwork(task.nodes)
  const maxDay=Math.ceil(Math.max(28,dayDiff(now,task.startedAt)+3,...task.nodes.map(n=>n.predictedEndAt?dayDiff(n.predictedEndAt,task.startedAt)+1:n.standardEndDay+1)))
  const tickStep=Math.max(1,Math.ceil(maxDay/12))
  const width=state.timelineScale==='小时'?maxDay*100:Math.max(320,window.innerWidth-(state.fullscreen?48:300)-370)
  const scale=(day:number)=>Math.max(0,day)/maxDay*100
  const stamp=(v:string|null|undefined)=>v?dayDiff(v,task.startedAt):null
  function bar(start:number|null,end:number|null,kind:string,label:string):string {if(start===null||end===null)return '';return `<span class="pf-bar pf-bar-${kind}" style="left:${scale(start)}%;width:${Math.max(.12,scale(end-start))}%" title="${e(label)}">${kind==='actual'?e(label):''}</span>`}
  const selected=task.nodes.filter(n=>(state.timelineTeam==='全部'||n.team===state.timelineTeam)&&(state.timelineMode==='全部工作'||state.timelineMode==='关键路径'&&graph.criticalPath.includes(n.id)||state.timelineMode==='风险工作'&&/风险|逾期|待判定/.test(n.timeState)))
  const selectedIds=new Set(selected.map(n=>n.id)),visibleIds=new Set(selectedIds)
  const includeParents=(id:string)=>{const n=task.nodes.find(n=>n.id===id);for(const parent of n?.predecessors??[]){if(!visibleIds.has(parent)){visibleIds.add(parent);includeParents(parent)}}}
  selected.forEach(n=>includeParents(n.id))
  const filtered=task.nodes.filter(n=>visibleIds.has(n.id))
  const planStart=(n:PFNode)=>state.timelineBasis==='原始基线'?stamp(n.standardStartAt):n.standardStartAt?n.standardStartDay:null
  const planEnd=(n:PFNode)=>state.timelineBasis==='原始基线'?stamp(n.baselineDueAt):n.baselineDueAt?n.standardEndDay:null
  const rowPositions=new Map<string,number>();let rowHeight=0
  const rows=stages.map(stage=>{
    const nodes=filtered.filter(n=>n.stage===stage.id);if(!nodes.length)return ''
    rowHeight+=44
    const collapsed=state.collapsed.includes(stage.id)
    const stageStart=Math.min(...nodes.map(n=>planStart(n)??0)),stageEnd=Math.max(...nodes.map(n=>planEnd(n)??0)),known=nodes.every(n=>n.standardStartAt&&n.baselineDueAt)
    const head=`<div class="pf-gantt-row pf-stage-row" data-stage-row="${stage.id}"><div class="pf-gantt-label">${button(`${collapsed?'▸':'▾'} ${stage.id} ${stage.name}`,'toggle-stage',`data-stage="${stage.id}"`)}<small>${nodes.length} 个工作 · ${known?`D${fmt(stageStart)}—D${fmt(stageEnd)}`:'预算范围待判定'}</small></div><div class="pf-gantt-lane" style="width:${width}px;background-size:${width/maxDay}px 100%;background-image:linear-gradient(to right,transparent calc(100% - 1px),#edf0f4 1px)">${bar(known?stageStart:null,known?stageEnd:null,'stage',stage.name)}</div></div>`
    if(collapsed)return head
    return head+nodes.map(n=>{
      rowPositions.set(n.id,rowHeight);rowHeight+=94;const critical=graph.criticalPath.includes(n.id)
      const actualEnd=n.actualEndAt?stamp(n.actualEndAt):n.actualStartAt?stamp(now):null
      const childRows=state.showChildren&&n.childActions?n.childActions.map(c=>{rowHeight+=94;return `<div class="pf-gantt-row pf-child-row"><div class="pf-gantt-label"><b>${e(c.id)} ${e(c.name)}</b><small>${e(c.team)} · ${e(c.owner)} · ${e(c.businessState)}</small><small>${fmt(c.qualifiedQty)}/${fmt(c.requiredQty)}${e(c.unit)} · ${c.budgetDays===null?'单项时效待配置':fmt(c.budgetDays)+'天'}${!c.includedInProductionDuration?' · 不计生产时长':''}</small></div><div class="pf-gantt-lane" style="width:${width}px;background-size:${width/maxDay}px 100%;background-image:linear-gradient(to right,transparent calc(100% - 1px),#edf0f4 1px)">${bar(stamp(c.actualStartAt),stamp(c.actualEndAt)??(c.actualStartAt?stamp(now):null),'actual',c.businessState)}</div></div>`}).join(''):''
      return `<div class="pf-gantt-row ${critical?'pf-critical':''} ${!selectedIds.has(n.id)?'pf-dependency-context':''}"><div class="pf-gantt-label"><button class="pf-node-link" data-pf-action="open-node" data-task-id="${e(task.id)}" data-node-id="${e(n.id)}"><b>${e(n.name)}${!selectedIds.has(n.id)?' · 前置参照':''}</b></button><div>${badge(n.timeState)} <span>${n.quantityKnown===false?'进度待同步':fmt(n.qualifiedQty)+'/'+fmt(n.requiredQty)+e(n.unit)}</span></div><small>${e(n.team)}${n.factory?' · '+e(n.factory):''} · ${n.durationDays===null?'要求待配置':'要求 '+fmt(n.durationDays)+'天'} · 已用 ${fmt(n.actualElapsedDays)}天</small><small>${dt(n.actualStartAt,true)} → ${n.actualEndAt?dt(n.actualEndAt,true):'未结束'} · ${n.localDueAt||n.baselineDueAt?'逾期'+fmt(n.actualOverdueDays)+'天':'时效待判'}</small></div><div class="pf-gantt-lane" style="width:${width}px;background-size:${width/maxDay}px 100%;background-image:linear-gradient(to right,transparent calc(100% - 1px),#edf0f4 1px)">${bar(planStart(n),planEnd(n),'standard',`${state.timelineBasis}D${fmt(planStart(n))}—D${fmt(planEnd(n))}`)}${bar(stamp(n.actualStartAt),actualEnd,n.actualEndAt?'done':'actual',n.businessState)}${n.actualOverdueDays>0&&actualEnd!==null?bar(Math.max(stamp(n.actualStartAt)??0,actualEnd-n.actualOverdueDays),actualEnd,'late','逾期'+fmt(n.actualOverdueDays)+'天'):''}${!n.actualEndAt?bar(stamp(n.predictedStartAt)??stamp(now),stamp(n.predictedEndAt),'forecast',`预计${dt(n.predictedEndAt)}`):''}${n.predictedEndAt===null&&!n.actualEndAt?'<span class="pf-unknown">预测待判定</span>':''}</div></div>${childRows}`
    }).join('')
  }).join('')
  const connectors=state.showDependencies?task.nodes.flatMap(n=>n.predecessors.map(p=>{
    const from=task.nodes.find(v=>v.id===p),a=rowPositions.get(p),b=rowPositions.get(n.id);if(!from||a===undefined||b===undefined)return ''
    const end=planEnd(from),start=planStart(n)
    if(end===null||start===null)return ''
    const x1=scale(end)*width/100,x2=scale(start)*width/100,y1=a+20,y2=b+20
    return `<path d="M${x1},${y1} H${x1+9} V${y2} H${x2}" fill="none" stroke="#64748b" stroke-width="1.2" marker-end="url(#pf-arrow)"/>`
  })).join(''):''
  const strip=stages.filter(s=>task.nodes.some(n=>n.stage===s.id)).map(s=>{const nodes=task.nodes.filter(n=>n.stage===s.id);const done=nodes.filter(n=>n.actualEndAt).length;const risk=nodes.some(n=>/逾期|风险/.test(n.timeState));return `<button class="pf-stage-chip ${risk?'risk':nodes.length>0&&done===nodes.length?'done':''}" data-pf-action="focus-stage" data-stage="${s.id}"><b>${s.id} ${e(s.name)}</b><small>${nodes.length}项 · 已完成${done}项</small></button>`}).join('')
  return `<div class="pf-stage-strip">${strip}</div><section class="pf-card"><div class="pf-timeline-toolbar">${select('视图','timeline-mode',state.timelineMode,['全部工作','关键路径','风险工作'])}${select('团队','timeline-team',state.timelineTeam,['全部',...new Set(task.nodes.map(n=>n.team))])}${select('预算','timeline-basis',state.timelineBasis,['当前标准','原始基线'])}${select('刻度','timeline-scale',state.timelineScale,['日','小时'])}${button(state.showChildren?'收起组内动作':'展开组内动作','toggle-children')}${button(state.showDependencies?'隐藏依赖':'显示依赖','toggle-dependencies')}${button('展开全部阶段','expand-all')}${button('折叠全部阶段','collapse-all')}${button('适配屏幕','fit-timeline')}</div><div class="pf-legend"><span>▱ 标准预算</span><span class="pf-blue">━ 实际进行</span><span class="pf-green">━ 完成</span><span class="pf-amber">┄ 最新预测 / 风险</span><span class="pf-red">━ 逾期</span><span>◆ 关键路径（左侧标记）</span><span>自然日</span></div><div class="pf-gantt-scroll"><div class="pf-gantt" style="width:${width+370}px"><div class="pf-gantt-axis"><div class="pf-gantt-label">阶段 / 工作 · 责任 · 数量 · 时效</div><div class="pf-axis-ticks" style="width:${width}px">${Array.from({length:maxDay+1},(_,i)=>i).filter(i=>i===maxDay||i%tickStep===0).map(i=>`<span style="left:${scale(i)}%;${i===maxDay?'transform:translateX(-100%);padding-left:0':''}">D${i}</span>`).join('')}</div></div><div class="pf-gantt-rows">${rows}<div class="pf-gantt-lines" style="left:370px;width:${width}px"><i class="pf-today" style="left:${scale(dayDiff(now,task.startedAt))}%"><b>当前D${fmt(dayDiff(now,task.startedAt))}</b></i>${task.effectiveDueAt?`<i class="pf-deadline" style="left:${scale(dayDiff(task.effectiveDueAt,task.startedAt))}%"><b>生效截止</b></i>`:''}${task.predictedFinishAt?`<i class="pf-forecast-line" style="left:${scale(dayDiff(task.predictedFinishAt,task.startedAt))}%"><b>预测终点</b></i>`:''}<svg class="pf-dependency-lines" width="${width}" height="${rowHeight}" aria-label="工作项前置依赖"><defs><marker id="pf-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#64748b"/></marker></defs>${connectors}</svg></div></div></div></div><p class="pf-footnote">共${task.nodes.length}个工作，当前显示${rowPositions.size}个；默认折叠已完成阶段。标准、实际、预测分别展示；尚未确认的预算和预测不按0天处理。阶段可并行，不能把阶段跨度直接相加。未排期工作不在 D0 绘制虚假连线，可切到“依赖与卡点”查看完整关系。点击任一工作查看单据与责任截止。</p></section>`
}
