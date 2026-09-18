import type { PFNode, PFTask } from './model'
import { addDays, assessNodeTiming, assessTask, calculateNetwork, predictNetwork } from './calculations'
import { snapshot } from './fixtures'
import { matchTimingRules, type RuleSample, type TimingRule, type TaskWorkRuleMapping } from './config-model'

export interface TaskRuleBudgetChange { nodeId:string; work:string; ruleId:string; previousDays:number|null; nextDays:number; facts:RuleSample; mappingSource:string; mapping?:TaskWorkRuleMapping }
export interface InitialTaskBaseline { dueAt:string; days:number; version:string; nodes:{id:string;startAt:string;dueAt:string}[] }
export interface TaskRuleOptions { mappings?:TaskWorkRuleMapping[]; establishBaseline?:boolean }
export interface TaskRuleRecalculation {
  taskId:string; state:'可重算'|'未命中'|'规则冲突'|'规则无效'|'已关闭'; message:string;
  previousVersion:string; version:string; previousDays:number|null; nextDays:number|null;
  previousForecastAt:string|null; nextForecastAt:string|null; baselineDueAt:string|null;
  effectiveDueAt:string|null; changes:TaskRuleBudgetChange[]; task:PFTask|null;
  initialBaseline?:InitialTaskBaseline;
}
export interface PublishedTaskRuleOverride {
  id:string; taskId:string; version:string; publishedAt:string; by:string; reason:string;
  changes:TaskRuleBudgetChange[]; previousDays:number|null; nextDays:number|null;
  previousForecastAt:string|null; nextForecastAt:string|null;
  baselineDueAt:string|null; effectiveDueAt:string|null;
  initialBaseline?:InitialTaskBaseline;
}

/** Kept only for the independent historical rule example, never applied to current source tasks. */
function exampleTaskRuleFacts(task:PFTask):TaskWorkRuleMapping[] {
  if(task.id!=='MOCK-PT-001')return []
  const node=task.nodes.find(item=>item.id==='W19')
  if(!node||node.sourceDocumentType!=='调拨接收记录'||node.unit!=='PCS')return []
  return [{id:'EXAMPLE-W19',taskId:task.id,nodeId:node.id,facts:{work:'ACT-S03-12',region:'CN',supplyMode:'现货采购',process:'无加工',route:'印尼仓→车缝厂',quantity:node.requiredQty,unit:node.unit},sourceDocumentId:node.sourceDocumentId,sourceDocumentType:node.sourceDocumentType,startEvent:'调拨出库确认',endEvent:'目标工厂合格实收',startAnchor:'actualStartAt',endAnchor:'actualEndAt',source:'产品方案主例：W12中国辅料采购 → W18调拨出库 → W19车缝厂合格实收；不使用生产区域ID推断采购地区'}]
}

export function validateTaskWorkRuleMapping(mapping:TaskWorkRuleMapping,task:PFTask):string[] {
  const node=task.nodes.find(item=>item.id===mapping.nodeId),errors:string[]=[]
  if(mapping.taskId!==task.id||!node)return ['任务或工作项不存在，不能保存映射。']
  const futureTerminal=task.sourceContext?.timingScope?.state==='confirmed'&&task.sourceContext.timingScope.terminalNodeIds.includes(node.id)&&node.stage==='S09'&&node.origin==='fulfillment'
  if((!node.sourceDocumentId&&!futureTerminal)||node.sourceDocumentId!==mapping.sourceDocumentId||node.sourceDocumentType!==mapping.sourceDocumentType||node.sourceEntryId!==mapping.sourceEntryId)errors.push('来源定义、单据或明细已变化，须重新确认映射。')
  if(node.businessState==='已取消'||node.businessState==='已作废')errors.push('已取消或作废的工作不配置在途时效。')
  if(node.includedInProductionDuration===false)errors.push('起点里程碑或已复用成果不重复配置生产预算。')
  if(node.requiredQuantityKnown===false||!Number.isFinite(mapping.facts.quantity)||mapping.facts.quantity<0||mapping.facts.quantity!==node.requiredQty)errors.push('规则数量须来自当前工作已知的来源数量；不得把未知量填成 0 或改成本需求份额。')
  if(mapping.facts.unit!==node.unit)errors.push('单位须与当前工作来源一致；未配置换算不能直接套用。')
  if([mapping.id,mapping.facts.work,mapping.facts.region,mapping.facts.supplyMode,mapping.facts.process,mapping.facts.route,mapping.facts.unit,mapping.startEvent,mapping.endEvent,mapping.source].some(value=>!value?.trim()||['全部','待确定','待同步','待配置','待确认','单位未提供','未知'].includes(value)))errors.push('候选动作、匹配事实、起止事件和映射依据须逐项明确，不允许以未知或通配条件代替业务事实。')
  if(!['actualStartAt','actualReadyAt','taskStartedAt'].includes(mapping.startAnchor)||mapping.endAnchor!=='actualEndAt')errors.push('须明确选择起点时间字段与实际结束字段。')
  return errors
}

export function saveTaskWorkRuleMapping(mappings:TaskWorkRuleMapping[],mapping:TaskWorkRuleMapping,task:PFTask):TaskWorkRuleMapping[] {
  const errors=validateTaskWorkRuleMapping(mapping,task)
  if(mappings.some(item=>item.id===mapping.id&&(item.taskId!==mapping.taskId||item.nodeId!==mapping.nodeId)))errors.push('映射编号已属于另一任务工作项，不能覆盖。')
  if(mappings.some(item=>item.id!==mapping.id&&item.taskId===mapping.taskId&&item.nodeId===mapping.nodeId))errors.push('同一任务工作项已有映射，必须编辑原映射，不能同时保存两个口径。')
  if(errors.length)throw new Error(errors.join(' '))
  return [...mappings.filter(item=>item.id!==mapping.id),structuredClone(mapping)]
}

export function taskRuleFacts(task:PFTask,mappings?:TaskWorkRuleMapping[]):{node:PFNode;facts:RuleSample;mappingSource:string;mapping:TaskWorkRuleMapping}[] {
  const explicit=(mappings??[]).filter(item=>item.taskId===task.id)
  return (explicit.length?explicit:exampleTaskRuleFacts(task)).map(mapping=>{
    const errors=validateTaskWorkRuleMapping(mapping,task)
    if(errors.length)throw new Error(`${mapping.nodeId}：${errors.join(' ')}`)
    return {node:task.nodes.find(node=>node.id===mapping.nodeId)!,facts:mapping.facts,mappingSource:mapping.source,mapping}
  })
}

/** Scope confirmation is independent of missing actual progress or shipment records. */
function timingScopeBlockers(task:PFTask):string[] {
  const scope=task.sourceContext?.timingScope
  if(!scope)return ['完整工作范围尚无明确确认记录。']
  const reasons=[...scope.blockingReasons]
  if(scope.state!=='confirmed')reasons.push('准备、供给、工艺及必要发货工作范围尚未全部确认。')
  if(!scope.terminalNodeIds.length||scope.terminalNodeIds.some(id=>!task.nodes.some(node=>node.id===id&&node.stage==='S09'&&node.origin==='fulfillment')))reasons.push('必要的未来发货工作范围未确认。')
  try{
    const graph=calculateNetwork(task.nodes)
    if(graph.terminalIds.some(id=>!scope.terminalNodeIds.includes(id))||scope.terminalNodeIds.some(id=>!graph.terminalIds.includes(id)))reasons.push('工作分支尚未完整连接到已确认的必要发货终点。')
  }catch(error){reasons.push(error instanceof Error?error.message:String(error))}
  return [...new Set(reasons)]
}

/** A baseline needs a confirmed future work graph, not already completed customer shipments. */
export function initialBaselineBlockers(task:PFTask):string[] {
  const reasons:string[]=[]
  if(task.baselineDueAt||task.effectiveDueAt)reasons.push('任务已有冻结截止，不能再次建立首版基线。')
  if(!Number.isFinite(Date.parse(task.startedAt)))reasons.push('需求起点未确认。')
  reasons.push(...timingScopeBlockers(task))
  try{if(calculateNetwork(task.nodes).durationDays===null)reasons.push('完整工作图仍有预算或前置缺失。')}catch(error){reasons.push(error instanceof Error?error.message:String(error))}
  return [...new Set(reasons)]
}

/** Apply only current route budgets. Baseline, effective deadlines and actual facts are immutable. */
export function applyTaskRuleBudgets(task:PFTask,changes:TaskRuleBudgetChange[],version:string,now=task.asOf??snapshot,initialBaseline?:InitialTaskBaseline):PFTask {
  const next:PFTask=structuredClone(task)
  const changeById=new Map(changes.map(change=>[change.nodeId,change]))
  if(changeById.size!==changes.length)throw new Error('同一工作不能在一个版本重复覆盖预算')
  for(const change of changes){
    const node=next.nodes.find(item=>item.id===change.nodeId)
    if(!node)throw new Error(`缺少明确映射的工作 ${change.nodeId}`)
    if(change.mapping){const errors=validateTaskWorkRuleMapping(change.mapping,task);if(errors.length)throw new Error(errors.join(' '))}
    if(!Number.isFinite(change.nextDays)||change.nextDays<0)throw new Error(`无效预算 ${change.nodeId}`)
    const previous=node.durationDays
    node.durationDays=change.nextDays
    node.durationSource=`${version} / ${change.ruleId} / 本地原型规则，非正式业务批准`
    const start=change.mapping?.startAnchor==='taskStartedAt'?task.startedAt:change.mapping?.startAnchor==='actualReadyAt'?node.actualReadyAt:node.actualStartAt
    if(!node.localDueAt&&start)node.localDueAt=addDays(start,change.nextDays)
    // A completed work's real duration never changes. For a pending schedule, update its
    // duration estimate before propagating dependencies. Explicit manual/capacity forecasts stay factual.
    if(!node.actualEndAt&&node.predictedEndAt&&previous!==null&&node.forecastSource!=='manual'&&node.allocatedCapacityPerDay===undefined){
      node.predictedEndAt=addDays(node.predictedEndAt,change.nextDays-previous)
    }
  }
  const network=calculateNetwork(next.nodes)
  const scopeUnknown=Boolean(next.sourceContext&&timingScopeBlockers(next).length)
  next.standardDays=scopeUnknown?null:network.durationDays;next.ruleVersion=version
  for(const node of next.nodes){
    const timing=network.nodes[node.id]
    // An unknown route must remain unknown rather than acquiring a zero date.
    // standardStartAt and baselineDueAt belong to the original node baseline.
    // Current-route dates are derived by the view from T0 + standardStartDay/EndDay.
    if(timing.start!==null)node.standardStartDay=timing.start
    if(timing.finish!==null)node.standardEndDay=timing.finish
  }
  const forecast=predictNetwork(next,now)
  next.predictedFinishAt=scopeUnknown?null:forecast.finishAt
  for(const node of next.nodes){
    if(!node.actualEndAt&&node.businessState!=='已取消'){
      const result=forecast.nodes[node.id]
      node.predictedStartAt=result.startAt;node.predictedEndAt=result.endAt
    }
    const timing=assessNodeTiming(node,now)
    node.actualOverdueDays=timing.actualOverdueDays;node.predictedDelayDays=timing.predictedDelayDays;node.timeState=timing.timeState
  }
  const assessment=assessTask(next,now);next.health=assessment.health
  // Explicitly retain the copied deadlines; never replace them with T0 + current standard.
  next.baselineDueAt=task.baselineDueAt;next.effectiveDueAt=task.effectiveDueAt
  if(initialBaseline&&!task.baselineDueAt&&!task.effectiveDueAt){
    next.baselineDueAt=initialBaseline.dueAt;next.effectiveDueAt=initialBaseline.dueAt
    next.baselineRuleVersion=initialBaseline.version;next.baselineStandardDays=initialBaseline.days
    for(const node of next.nodes){const dates=initialBaseline.nodes.find(item=>item.id===node.id);if(dates){node.standardStartAt??=dates.startAt;node.baselineDueAt??=dates.dueAt}}
    next.health=assessTask(next,now).health
  }
  return next
}

export function previewTaskRuleRecalculation(task:PFTask,rules:TimingRule[],version:string,now=task.asOf??snapshot,options:TaskRuleOptions={}):TaskRuleRecalculation {
  const base:TaskRuleRecalculation={taskId:task.id,state:'未命中',message:'',previousVersion:task.ruleVersion,version,previousDays:task.standardDays,nextDays:null,previousForecastAt:task.predictedFinishAt,nextForecastAt:null,baselineDueAt:task.baselineDueAt,effectiveDueAt:task.effectiveDueAt,changes:[],task:null}
  if(task.completedAt||task.terminatedAt||(task.shipmentQuantityKnown!==false&&task.remainingQty===0))return {...base,state:'已关闭',message:'已完成或终止任务不参与本次在途标准重算。'}
  let mappings:ReturnType<typeof taskRuleFacts>
  try{mappings=taskRuleFacts(task,options.mappings)}catch(error){return {...base,state:'规则无效',message:error instanceof Error?error.message:String(error)}}
  if(!mappings.length)return {...base,message:'未命中：本任务暂无明确的工作→规则事实映射；不能从地区、名称或SPU推断套用。'}
  if(new Set(mappings.map(item=>item.node.id)).size!==mappings.length)return {...base,state:'规则冲突',message:'同一任务工作项存在多个映射，须先统一口径。'}
  for(const mapping of mappings){
    const match=matchTimingRules(rules,mapping.facts)
    if(match.state!=='命中')return {...base,state:match.state==='冲突'?'规则冲突':'未命中',message:`${mapping.node.id}：${match.message}`}
    const rule=match.matches[0]
    if(rule.days===null||rule.days<0||!Number.isFinite(rule.days))return {...base,state:'规则无效',message:`${rule.id} 缺少有效的自然日预算。`}
    // A changed event boundary is a different scope; it cannot silently replace this node's duration.
    if(rule.startEvent!==mapping.mapping.startEvent||rule.endEvent!==mapping.mapping.endEvent)return {...base,state:'未命中',message:`${rule.id} 起止事件不覆盖 ${mapping.node.id} 已确认的 ${mapping.mapping.startEvent} → ${mapping.mapping.endEvent}，需修正规则或映射。`}
    base.changes.push({nodeId:mapping.node.id,work:mapping.facts.work,ruleId:rule.id,previousDays:mapping.node.durationDays,nextDays:rule.days,facts:mapping.facts,mappingSource:mapping.mappingSource,mapping:structuredClone(mapping.mapping)})
  }
  try{
    let projected=applyTaskRuleBudgets(task,base.changes,version,now),initialBaseline:InitialTaskBaseline|undefined
    if(options.establishBaseline){
      const reasons=initialBaselineBlockers(projected)
      if(reasons.length)return {...base,state:'规则无效',message:`首次基线未建立：${reasons.join('；')}。可关闭首次建基线选项，仅发布已明确工作的单项预算。`}
      const network=calculateNetwork(projected.nodes)
      initialBaseline={dueAt:addDays(task.startedAt,network.durationDays!),days:network.durationDays!,version,nodes:projected.nodes.map(node=>({id:node.id,startAt:addDays(task.startedAt,network.nodes[node.id].start!),dueAt:addDays(task.startedAt,network.nodes[node.id].finish!)}))}
      projected=applyTaskRuleBudgets(task,base.changes,version,now,initialBaseline)
    }
    return {...base,state:'可重算',message:`${base.changes.length} 项明确映射已命中，将发布本地原型单项预算。${initialBaseline?'完整图已确认，首次基线 = 需求下单时间 + '+initialBaseline.days+' 自然日。':'已有原始/生效截止保留；未有基线时不自动建立。'}${projected.standardDays===null?'整体标准仍待定，来源或其余预算未齐。':''}${!projected.predictedFinishAt?'缺可靠进度或完整预测，不以理论预算伪造预计完成。':''}`,task:projected,nextDays:projected.standardDays,nextForecastAt:projected.predictedFinishAt,initialBaseline}
  }catch(error){return {...base,state:'规则无效',message:`无法重算：${error instanceof Error?error.message:String(error)}`}}
}

export function applyTaskRuleOverrides(tasks:PFTask[],overrides:PublishedTaskRuleOverride[],now?:string):PFTask[] {
  return tasks.map(task=>{
    let result=task
    const related=overrides.filter(item=>item.taskId===task.id)
    let currentIndex=-1
    for(let index=related.length-1;index>=0;index--)if(related[index].version===task.ruleVersion){currentIndex=index;break}
    for(const override of related.slice(currentIndex+1)){
      try{result=applyTaskRuleBudgets(result,override.changes,override.version,now??task.asOf??snapshot,override.initialBaseline)}catch(error){
        result={...result,missingRule:`本地映射失效：${error instanceof Error?error.message:String(error)}`}
        // A source change invalidates its new budget mapping, not the previously frozen deadline.
        if(override.initialBaseline&&!result.baselineDueAt&&!result.effectiveDueAt){
          const baseline=override.initialBaseline
          result={...result,baselineDueAt:baseline.dueAt,effectiveDueAt:baseline.dueAt,baselineRuleVersion:baseline.version,baselineStandardDays:baseline.days,nodes:result.nodes.map(node=>{const dates=baseline.nodes.find(item=>item.id===node.id);return dates?{...node,standardStartAt:node.standardStartAt??dates.startAt,baselineDueAt:node.baselineDueAt??dates.dueAt}:node})}
          result.health=assessTask(result,now??task.asOf??snapshot).health
        }
      }
    }
    return result
  })
}
