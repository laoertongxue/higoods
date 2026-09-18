// @page-pattern: detail
import type { PFTask, PFNode } from './model'
import type { ViewState } from './ui-state'
import { base } from './ui-state'
import { snapshot, orders, tasks as sourceTasks } from './fixtures'
import { assessTask, calculateNetwork, dayDiff, backwardSchedule, predictNetwork, addDays } from './calculations'
import { e, fmt, dt, badge, button, card, styleCell, materialCell, anchor, renderDataTable, tabs } from './common'
import { renderTimeline } from './timeline'
import { dependencyAnalysis, renderDependencyGraph, renderBlockerSummary } from './dependency-graph'
import { renderQuantityEvidence, renderSourceEvidence } from './evidence'
import { renderRouteScenarios } from './scenarios'
import { workColumns } from './tasks'
import { renderTaskSources, renderPreparation, renderProcessRoute, renderSourceGaps } from './source-views'

export interface FollowupRecord {id:string;taskId:string;nodeId:string;author:string;at:string;reason:string;action:string;expectedAt:string;kind:string}
export function readFollowups():FollowupRecord[] {try{return JSON.parse(localStorage.getItem('dds-pf-followups-v1')||'[]')}catch{return []}}
export function writeFollowup(record:FollowupRecord):void {const list=readFollowups();list.unshift(record);localStorage.setItem('dds-pf-followups-v1',JSON.stringify(list))}
export function renderFormula(task:PFTask,state:ViewState):string {
  const graph=calculateNetwork(task.nodes),back=task.effectiveDueAt?backwardSchedule(task.nodes,dayDiff(task.effectiveDueAt,task.startedAt)):Object.fromEntries(task.nodes.map(n=>[n.id,{latestStart:null,latestFinish:null,floatDays:null}])),forecast=predictNetwork(task)
  const current=state.detailSubTab||'整体公式'
  const standardKnown=graph.durationDays!==null&&(!task.sourceContext||task.sourceContext.timingScope?.state==='confirmed'&&task.standardDays!==null)
  const navigation=tabs('计算视图','detail-subtab',['整体公式','逐项倒排','版本记录',...(task.id==='MOCK-PT-004'?['路线判断']:[])],current)
  if(current==='路线判断')return navigation+renderRouteScenarios(task,state)
  const summary=card('整体时效计算',`<div class="pf-formula"><p>起点 T₀ = ${dt(task.startedAt)}；商品采购单 ${e(task.purchaseNo)} 与生产需求单 ${e(task.demandNo)} 为同一任务起点。</p><p>ESᵢ = max(前置工作 EFⱼ)；EFᵢ = ESᵢ + 单项自然日预算；L = max(终点 EF)。并行取最大值，串行累加。</p><p>倒排：终点 LF = 生效截止相对 T₀ 的自然日；LFᵢ = min(后继工作 LSⱼ)；LSᵢ = LFᵢ − 单项预算；浮动余量 = LSᵢ − ESᵢ。</p><p><b>${!standardKnown?'总时效待判定':`L = ${fmt(task.sourceContext?task.standardDays:graph.durationDays)} 自然日`}</b>；生效截止 ${dt(task.effectiveDueAt)}；最新预测 ${dt(task.predictedFinishAt)}。</p>${task.id==='MOCK-PT-001'?`<p><b>原始基线算例（${fmt(task.baselineStandardDays??24)}天，${e(task.baselineRuleVersion||task.ruleVersion)}）</b>；当前逐节点公式与标准见下表。</p><p>面料：max(原料到厂2,调色批准3)+染色4+检验交出0.5+裁厂接收0.5 = 8</p><p>生产单就绪：准备发布4+建单0.5+派发0.5 = 5</p><p>裁片及辅助工艺：max(8,5)+配料1+裁片2+辅助工艺3 = 14</p><p>中国辅料到厂：需求确认1+下单1+供方1+国内1+跨境6+入库1+调拨等待2+交出1+到厂1 = 15</p><p><b>整体：max(14,15)+齐套1+车缝与合格回货6+后道质检入仓1+发货1 = 24</b></p><p>按现有产能独立推算：D20已合格回货400/1000件，剩余600÷已分配200件/日 = 3日；预计回货D23+后道1+发货1 = D25。要守住D22回货需600÷2 = 300件/日，缺口100件/日。</p><p>国内路线改成5天时：max(14,5)+1+6+1+1 = 23天，而非24−10=14天。</p>`:''}${!standardKnown&&graph.durationDays!==null?`<p>当前已知工作子图长度 ${fmt(graph.durationDays)} 自然日；必要工作范围尚未确认，不能作为全程时效要求。</p>`:''}<p>整体与阶段预算仅监控选中层；组预算和组内动作不得重复累加。历史基线保留，预测变化不延长生效截止。</p></div>`)
  const calculation=()=>renderDataTable('formula-'+task.id,'逐节点计算与倒排',[
    {key:'id',title:'工作项',width:240,required:true,freezeable:true,render:(n:PFNode)=>`${e(n.id)} ${e(n.name)}`},
    {key:'formula',title:'正推公式（自然日）',width:320,render:(n:PFNode)=>e(graph.nodes[n.id].formula)},
    {key:'back',title:'倒排最迟开始 / 结束',width:170,render:(n:PFNode)=>`D${fmt(back[n.id].latestStart)} / D${fmt(back[n.id].latestFinish)}`},
    {key:'float',title:'浮动余量',width:110,render:(n:PFNode)=>`${fmt(back[n.id].floatDays)} 天`},
    {key:'forecast',title:'预测方法 / 结果',width:300,render:(n:PFNode)=>`${e(forecast.nodes[n.id]?.method??'待判定')}<small>${dt(forecast.nodes[n.id]?.endAt)}</small>`},
  ],task.nodes,state)
  const versions=()=>card('计算版本',`<dl class="pf-facts"><dt>原始基线</dt><dd>${e(task.baselineRuleVersion||task.ruleVersion)} · ${dt(task.baselineDueAt)}</dd><dt>当前路线版本</dt><dd>${e(task.ruleVersion)} · ${fmt(task.standardDays)}自然日</dd><dt>当前生效截止</dt><dd>${dt(task.effectiveDueAt)}；路线重算不覆盖考核截止</dd><dt>最新预测</dt><dd>${dt(task.predictedFinishAt)}；读取于 ${dt(task.asOf??snapshot)}</dd><dt>未决规则</dt><dd>${e(task.missingRule||task.uncertainty||'本路线已选定；组内单项预算仍待配置')}</dd></dl>`)
  return (task.sourceContext?renderSourceGaps(task):'')+navigation+(current==='逐项倒排'?calculation():current==='版本记录'?versions()+renderMergedSources(task):summary)+`<p class="pf-footnote">${anchor('打开独立规则验证示例',base+'/examples')} · 示例与当前生产任务的事实分开展示。</p>`
}
export function renderQuantities(task:PFTask):string {
  if(task.sourceContext)return card('需求与执行数量',`<div class="pf-source-summary"><strong>来源需求 ${fmt(task.originalQty)} ${e(task.unit)}</strong><span>正式有效需求 ${fmt(task.effectiveQty)} ${e(task.unit)}</span><span>实际发货：${task.quantityKnown===false?'待同步':fmt(task.shippedQty)+' '+e(task.unit)}</span><span>剩余应发：${task.quantityKnown===false?'待同步':fmt(task.remainingQty)+' '+e(task.unit)}</span></div><p class="pf-subtitle">生产需求数量来自需求明细；合格完成与实际发货须读取对应执行记录。客户订单取消不能直接改写生产需求。采购到仓、调拨出库及目标厂接收分别判断，不把采购已下单当作到厂齐料。</p>`)+renderSourceGaps(task)

  const reductions=task.demandReductionQty??0
  const node=task.nodes.find(n=>n.allocatedCapacityPerDay!==undefined)
  const finished=node?.qualifiedQty??task.shippedQty
  return `${card('数量守恒与完成口径',`<div class="pf-quantity-grid">${[['原始需求',task.originalQty],['正式调减',reductions],['有效需求',task.effectiveQty],['已实际发货',task.shippedQty],['待发货',task.remainingQty]].map(([label,v])=>`<div><small>${label}</small><b>${fmt(Number(v))}件</b></div>`).join('')}</div><p>有效需求 = ${task.originalQty} − ${reductions} = ${task.effectiveQty} 件；剩余 = ${task.effectiveQty} − ${task.shippedQty} = ${task.remainingQty} 件。</p><p>${task.effectiveQty===0?'已终止，不计100%正常履约。':'实际发货进度 '+fmt(task.shippedQty/task.effectiveQty*100)+'%。不同单位工作项的完成数量不能直接相加或平均。'}</p><p>客户订单取消尚未关联到生产任务时，不改变这里的分母。${task.demandChangeId?`调减依据 ${e(task.demandChangeId)}，生效于${dt(task.demandChangeAt)}。`:'当前无正式需求调减。'}</p>`)}${card('当前供给与放行',`${task.id==='MOCK-PT-006'?'<p>物料需求1000：现货300已到厂，采购700中入库500、到厂200。工厂可用300+200=500；仓内待调拨300；尚未入库200。已落实采购700不重复补采，仍缺到厂可用500。</p>':''}${task.id==='MOCK-PT-001'?`<p>当前合格回货${fmt(finished)} / 1000件。演示放行规则 <b>MOCK-RELEASE-001：整批1000件合格回货后进入后道</b>。已回货400件尚未触发后道放行。</p><p>这是本场景明确的整批门禁；其他路线可配置分批放行，不能把整批规则默认为全局规则。</p>`:`<p>${e(task.supplyMode)} · ${e(task.scenario)}</p>`}<div class="pf-flow-steps"><span>需求数量</span><b>→</b><span>原料合格可用</span><b>→</b><span>到厂接收</span><b>→</b><span>加工合格产出</span><b>→</b><span>实际发货</span></div><p>白坯入库仅满足原料供给，必须在目标SKU加工合格且实际接收后，才计入目标物料齐套。</p>`)}`
}
export function renderShipmentFacts(task:PFTask,state:ViewState):string {
  const rows=orders.filter(o=>o.taskId===task.id)
  if(task.sourceContext&&!task.hasActualShipmentOrderFacts)return card('实际发货与订单',`<div class="pf-source-empty"><strong>尚未读取到本任务可归属的实际发货记录</strong><p>生产需求 ${e(task.demandNo)} · 需求 ${fmt(task.effectiveQty)} ${e(task.unit)}</p><p>实际发货时才确认客户订单；当前不预分配订单，也不生成订单时效达成率。</p></div>`)
  return `${card('实际发货后关联订单',`<p>已发货${fmt(task.shippedQty)}件；当前${rows.length}条发货事实明确了客户订单。未发货${fmt(task.remainingQty)}件对应客户订单仍为“发货时确认”。${task.effectiveQty===0?'任务已终止。':''}</p><p>任务T₀到任务完结、客户订单下单到实际发货分别计时，不互相替代。取消使订单关闭时保留关闭时间，不能回填为更早的全部发货时间。</p>`)}${renderDataTable('task-orders-'+task.id,'已关联实际发货订单',[
    {key:'orderNo',title:'客户订单 / 发货记录',width:240,required:true,render:o=>`${e(o.orderNo)}<small>${e(o.shipmentId)}</small>`},
    {key:'placedAt',title:'下单时间',width:180,render:o=>dt(o.placedAt)},
    {key:'shippedAt',title:'实际发货 / 关联时间',width:180,render:o=>`${dt(o.shippedAt)}<small>${dt(o.associatedAt)}</small>`},
    {key:'shippedQty',title:'数量',width:90,render:o=>fmt(o.shippedQty)+'件'},
    {key:'actualDays',title:'要求 / 实际',width:130,render:o=>`${fmt(o.requiredDays)} / ${fmt(o.actualDays)}天`},
    {key:'overdueDays',title:'结果',width:130,render:o=>badge(o.overdueDays>0?`逾期${o.overdueDays}天`:'按期发货')},
  ],rows,state)}`
}
export function renderFollowups(task:PFTask,state:ViewState):string {
  const records=readFollowups().filter(r=>r.taskId===task.id)
  return `${card('跟进与责任记录',`<p>跟单协调不替代各工作责任；跟进记录保存在当前浏览器。</p>${button('登记跟进','followup',`data-task-id="${e(task.id)}"`)} ${button('登记预计结束','estimate',`data-task-id="${e(task.id)}"`)}`)}${renderDataTable('followups-'+task.id,'本地跟进记录',[
    {key:'at',title:'记录时间 / 操作人',width:170,required:true,render:r=>`${dt(r.at)}<small>${e(r.author)}</small>`},
    {key:'kind',title:'类型 / 工作',width:180,render:r=>`${e(r.kind)}<small>${e(r.nodeId||'任务整体')}</small>`},
    {key:'reason',title:'原因',width:250,render:r=>e(r.reason)},
    {key:'action',title:'跟进动作',width:250,render:r=>e(r.action)},
    {key:'expectedAt',title:'负责人预计结束',width:180,render:r=>dt(r.expectedAt)},
  ],records,state)}`
}
function renderMergedSources(task:PFTask):string {
  return !task.sourceContext&&(task.sourceDemandIds?.length??0)>1?card('合并生产单与来源需求',`<p>合并单 ${e(task.productionOrderNos.join('、'))} · 主跟单 ${e(task.mergedProductionFollower||'待明确指派')}。各来源需求保留起点、数量和截止。</p>${sourceTasks.filter(t=>task.relatedTaskIds?.includes(t.id)||t.id===task.id).map(t=>`<p>${anchor(t.id,base+'/tasks/'+t.id)} · ${e(t.demandNo)} · ${e(t.follower)} · T₀ ${dt(t.startedAt)} · 应发${fmt(t.effectiveQty)}件 · 截止${dt(t.effectiveDueAt)}</p>`).join('')}`):''
}
export function renderTaskDetail(task:PFTask,state:ViewState):string {
  const a=assessTask(task),views=['全程时效','工作明细','数量批次','实际发货与订单','计算与版本','跟进记录']
  let body=''
  if(state.detailTab==='全程时效'){
    const current=state.detailSubTab||'依赖与卡点'
    body=tabs('全程视图','detail-subtab',['依赖与卡点','全程甘特','生产准备','工艺路线'],current)+(current==='依赖与卡点'?renderBlockerSummary(task)+renderDependencyGraph(task,state)+renderSourceGaps(task):current==='生产准备'?renderPreparation(task,state):current==='工艺路线'?renderProcessRoute(task,state):renderTimeline(task,state))
  }
  if(state.detailTab==='工作明细')body=renderDataTable('detail-work-'+task.id,'本任务工作项',workColumns(),task.nodes.map(n=>({...n,task})),state,{embedded:true})
  if(state.detailTab==='数量批次'){
    const current=state.detailSubTab||'数量进度'
    body=tabs('数量视图','detail-subtab',['数量进度','数量与放行'],current)+(task.sourceContext?renderQuantities(task):current==='数量进度'?renderQuantityEvidence(task):renderQuantities(task))
  }
  if(state.detailTab==='实际发货与订单')body=renderShipmentFacts(task,state)
  if(state.detailTab==='计算与版本')body=renderFormula(task,state)
  if(state.detailTab==='跟进记录')body=renderFollowups(task,state)
  return `<div class="pf-detail-heading">${styleCell(task)}<div><h2>${e(task.id)} ${badge(a.health)}</h2><p>采购${e(task.purchaseNo)} · ${e(task.productionOrderNos.join('、')||'生产单未创建')}</p><p>跟单 ${e(task.follower)} / ${e(task.accountableTeam)} · ${e(task.sourceContext?task.businessState:task.scenario)}</p></div><div class="pf-detail-utilities">${anchor('返回任务列表',base+'/tasks')}${button('全屏大屏','fullscreen')}${button('打印摘要','print-task',`data-task-id="${e(task.id)}"`)}</div></div><div class="pf-kpis pf-detail-summary"><div class="pf-kpi"><span>时效要求</span><b>${task.standardDays===null?'待配置':fmt(task.standardDays)+'<small>自然日</small>'}</b></div><div class="pf-kpi"><span>生效截止</span><b class="pf-small-value">${dt(task.effectiveDueAt,true)}</b></div><div class="pf-kpi"><span>已用 / 逾期</span><b>${fmt(a.elapsedDays)} / ${task.effectiveDueAt?fmt(a.actualOverdueDays):'待判'}<small>天</small></b></div><div class="pf-kpi"><span>预计超期</span><b>${a.predictedDelayDays===null?'待判定':fmt(a.predictedDelayDays)+'<small>天</small>'}</b></div><div class="pf-kpi"><span>已发 / 应发</span><b>${task.quantityKnown===false?'待同步':fmt(task.shippedQty)} / ${fmt(task.effectiveQty)}<small>件</small></b></div></div>${renderTaskSources(task)}${tabs('任务详情视图','detail-tab',views,state.detailTab)}${body}`
}
export function renderWorkDetail(task:PFTask,node:PFNode,current='单据简要信息'):string {
  const related=(nodes:PFNode[])=>nodes.map(n=>`<p>${button(n.id+' '+n.name,'open-node',`data-task-id="${e(task.id)}" data-node-id="${e(n.id)}"`)} ${badge(n.businessState)} · ${e(n.team)}</p>`).join('')||'无关联工作。'
  const blockers=node.predecessors.map(id=>task.nodes.find(n=>n.id===id)).filter((n):n is PFNode=>!!n)
  const analysis=dependencyAnalysis(task),blocker=analysis.blockers.find(b=>b.node.id===node.id),waiting=analysis.pendingParents(node)
  const summary=node.sourceSummary
  const sourceHref=summary?.href||node.sourceHref
  const sourceLabel=sourceHref==='/fcs/production/demand-inbox'?'前往生产需求列表':'查看来源页面'
  const sourceFields=summary?.fields??[{label:'所属生产需求',value:task.demandNo},{label:'所属生产单',value:task.productionOrderNos.join('、')||'尚未创建'},{label:'责任团队',value:node.team},{label:'责任工厂',value:node.factory||'尚未分配'},{label:'执行负责人',value:node.owner||'待指派'},{label:'应完成数量',value:node.requiredQuantityKnown===false?'待同步':fmt(node.requiredQty)+' '+node.unit},{label:'数量口径',value:node.quantityScope||'本工作项'},{label:'实际开始',value:dt(node.actualStartAt)},{label:'实际结束',value:dt(node.actualEndAt)},{label:'责任截止',value:dt(node.localDueAt||node.baselineDueAt)}]
  let content=''
  if(current==='单据简要信息')content=node.sourceDocumentId?`<dl class="pf-document-summary">${sourceFields.map(f=>`<div><dt>${e(f.label)}</dt><dd>${e(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(f.value)?dt(f.value):f.value||'尚未记录')}</dd></div>`).join('')}</dl>${blocker?`<div class="pf-work-impact"><b>具体卡点：</b>${e(blocker.reason)}；影响 ${blocker.downstream.length} 项后续工作。${task.effectiveDueAt?'':'整体截止尚未确定，不能据此推定全部发货延期天数。'}</div>`:waiting.length&&!node.actualStartAt?`<div class="pf-work-impact">等待前置：${waiting.map(n=>e(n.name)).join('、')}。执行责任与上游原因责任分别跟进。</div>`:''}<div class="pf-source-document-link"><span>来源更新 ${dt(node.sourceUpdatedAt)}</span>${sourceHref?anchor(sourceLabel,sourceHref):'来源详情入口待补'}</div>`:`<div class="pf-document-missing"><strong>尚未关联对应业务单据</strong><p>${e(node.blocker||node.dependencyNote||'当前只能识别待补工作，不能提供不存在的单据摘要。')}</p><p>跟进人 ${e(node.owner||task.follower)} · ${e(node.team)}</p>${node.sourceHref?anchor('前往来源模块核对',node.sourceHref):''}</div>`
  if(current==='时效与数量')content=`<dl class="pf-facts"><dt>执行责任</dt><dd>${e(node.team)} / ${e(node.factory||'工厂待分配')} / ${e(node.owner||'待指派')}</dd><dt>整体协调</dt><dd>${e(task.follower)} / ${e(task.accountableTeam)}</dd><dt>应完成 / 合格完成</dt><dd>${node.requiredQuantityKnown===false?'待同步':fmt(node.requiredQty)} / ${node.quantityKnown===false?'待同步':fmt(node.qualifiedQty)} ${e(node.unit)}${node.quantityScope?'<small>'+e(node.quantityScope)+'</small>':''}</dd><dt>计时标准</dt><dd>${node.durationDays===null?'待配置':fmt(node.durationDays)+'自然日'} · ${e(node.durationSource)}</dd><dt>当前标准计划</dt><dd>${dt(node.standardStartAt?addDays(task.startedAt,node.standardStartDay):null)} → ${dt(node.standardStartAt?addDays(task.startedAt,node.standardEndDay):null)}</dd><dt>原始节点截止</dt><dd>${dt(node.baselineDueAt)}</dd><dt>前置具备时间</dt><dd>${dt(node.actualReadyAt)}</dd><dt>本团队责任截止</dt><dd>${dt(node.localDueAt)}</dd><dt>为守整体需完成于</dt><dd>${dt(node.neededFinishAt)}</dd><dt>上游晚交 / 需追回</dt><dd>${node.upstreamDelayDays==null?'待判':fmt(node.upstreamDelayDays)} / ${node.recoverDays==null?'待判':fmt(node.recoverDays)}天</dd><dt>实际开始 / 结束</dt><dd>${dt(node.actualStartAt)} → ${dt(node.actualEndAt)}</dd><dt>实际已用 / 逾期</dt><dd>${fmt(node.actualElapsedDays)} / ${node.localDueAt||node.baselineDueAt?fmt(node.actualOverdueDays):'待判'}自然日</dd><dt>预计结束</dt><dd>${dt(node.predictedEndAt)}；${node.predictedDelayDays===null?'风险待判定':'预计超期 '+fmt(node.predictedDelayDays)+'天'}</dd><dt>数据更新</dt><dd>${dt(node.sourceUpdatedAt)}</dd></dl>${node.forecastNote?card('预测来源',e(node.forecastNote)):''}${node.allocatedCapacityPerDay!==undefined?card('数量与风险依据',`剩余 ${fmt(node.requiredQty-node.qualifiedQty)}${e(node.unit)} ÷ 分配能力 ${fmt(node.allocatedCapacityPerDay)}${e(node.unit)}/日；守住原节点需 ${fmt(node.requiredCapacityPerDay)}${e(node.unit)}/日，能力缺口 ${fmt(node.capacityGapPerDay)}。`):''}`
  if(current==='前后依赖')content=card('前置与阻塞',related(blockers))+card('后继工作',related(task.nodes.filter(n=>n.predecessors.includes(node.id))))+(node.releaseRuleId?card('放行门禁',`${e(node.releaseRuleId)} · ${e(node.releaseMode||'')} · ${e(node.releaseReason||'')}`):'')
  if(current==='来源证据')content=card('单据与映射证据',`<p>${e(node.sourceDocumentType)}：${e(node.sourceDocumentId)}</p><p>${e(node.mappingState)} · 生产需求${e(task.demandNo)}。来源记录与任务通过明确关联读取。</p><p>业务完成需满足合格数量与结束事件，单据创建不代表工作完成。</p>${node.sourceHref?anchor('查看来源模块',node.sourceHref):''}`)+(task.sourceContext?`<p>${e(node.dependencyNote||'')}</p>`:renderSourceEvidence(task,node))
  return `<div class="pf-document-header">${node.material?materialCell(node.material):styleCell(task)}<div><h3>${e(node.name)}</h3><p>${e(summary?.documentType||node.sourceDocumentType)} · ${e(summary?.documentNo||node.sourceDocumentId||'尚未关联')}</p><div>${badge(summary?.status||node.businessState)} ${badge(node.timeState)}</div></div></div>${tabs('工作项详情视图','work-tab',['单据简要信息','时效与数量','前后依赖','来源证据'],current)}<div class="pf-work-content">${content}</div><div class="pf-actions pf-work-footer">${button('登记跟进','followup',`data-task-id="${e(task.id)}" data-node-id="${e(node.id)}"`)}${!node.actualEndAt?button('登记预计结束','estimate',`data-task-id="${e(task.id)}" data-node-id="${e(node.id)}"`):''}</div>`
}
