import assert from 'node:assert/strict'
import test from 'node:test'
import { readProductionSourceSnapshot } from '../../src/pages/production-fulfillment/source-tasks'
import { tasks, snapshot } from '../../src/pages/production-fulfillment/fixtures'
import { addDays } from '../../src/pages/production-fulfillment/calculations'
import type { PFTask } from '../../src/pages/production-fulfillment/model'
import type { TaskWorkRuleMapping, TimingRule } from '../../src/pages/production-fulfillment/config-model'
import { applyTaskRuleOverrides, previewTaskRuleRecalculation, saveTaskWorkRuleMapping, validateTaskWorkRuleMapping, type PublishedTaskRuleOverride } from '../../src/pages/production-fulfillment/rule-recalculation'
import { renderConfiguration, setConfigurationTaskSource, handleConfigurationAction, handleConfigurationField, applyPublishedInTransitOverrides } from '../../src/pages/production-fulfillment/configuration'
import { ui } from '../../src/pages/production-fulfillment/ui-state'

function sourceTask():PFTask { return readProductionSourceSnapshot().tasks.find(task=>task.id==='DEM-202603-0004')! }
function mappingFor(task:PFTask,nodeId=task.id+':production-order'):TaskWorkRuleMapping {
  const node=task.nodes.find(item=>item.id===nodeId)!
  return {id:'EXPLICIT-1',taskId:task.id,nodeId,facts:{work:'ACT-S04-02',region:'不适用',supplyMode:'不适用',process:'不适用',route:'已确认技术资料→生产单',quantity:node.requiredQty,unit:node.unit},sourceDocumentType:node.sourceDocumentType,sourceDocumentId:node.sourceDocumentId,sourceEntryId:node.sourceEntryId,startEvent:'必要输入就绪',endEvent:'生产单有效',startAnchor:'actualReadyAt',endAnchor:'actualEndAt',source:'本地测试口径；非正式业务批准'}
}
function ruleFor(mapping:TaskWorkRuleMapping,days:number|null=1):TimingRule {
  return {...mapping.facts,id:'LOCAL-SLA-1',name:'建单时效本地示例',minQty:0,maxQty:null,days,priority:2,state:'Mock 已发布',startEvent:mapping.startEvent,endEvent:mapping.endEvent,source:mapping.source,pending:''}
}
function overrideFor(result:ReturnType<typeof previewTaskRuleRecalculation>):PublishedTaskRuleOverride {
  return {id:'PUBLISH-1',taskId:result.taskId,version:result.version,publishedAt:snapshot,by:'本地配置者',reason:'专项验证',changes:result.changes,previousDays:result.previousDays,nextDays:result.nextDays,previousForecastAt:result.previousForecastAt,nextForecastAt:result.nextForecastAt,baselineDueAt:result.baselineDueAt,effectiveDueAt:result.effectiveDueAt,initialBaseline:result.initialBaseline}
}

test('当前非 Mock 需求可保存显式工作映射，序列化后可恢复且不改来源事实',()=>{
  const task=sourceTask(),before=structuredClone(task),mapping=mappingFor(task)
  const saved=saveTaskWorkRuleMapping([],mapping,task),restored:TaskWorkRuleMapping[]=JSON.parse(JSON.stringify(saved))
  const preview=previewTaskRuleRecalculation(task,[ruleFor(mapping)],'LOCAL-V2',task.asOf,{mappings:restored})
  assert.equal(preview.state,'可重算');assert.equal(preview.changes.length,1)
  assert.equal(preview.task!.nodes.find(node=>node.id===mapping.nodeId)!.durationDays,1)
  assert.deepEqual(task,before);assert.equal(preview.task!.baselineDueAt,null)
  assert.equal(preview.task!.nodes.find(node=>node.id===mapping.nodeId)!.actualReadyAt,undefined)
  assert.equal(preview.task!.nodes.find(node=>node.id===mapping.nodeId)!.localDueAt,undefined,'missing input-ready instant must not be replaced by document creation')
})

test('未保存映射、规则空天数、事件范围变化与同级冲突分别给出真实阻断',()=>{
  const task=sourceTask(),mapping=mappingFor(task),rule=ruleFor(mapping),options={mappings:[mapping]}
  assert.equal(previewTaskRuleRecalculation(task,[rule],'V2').state,'未命中')
  assert.equal(previewTaskRuleRecalculation(task,[ruleFor(mapping,null)],'V2',task.asOf,options).state,'未命中')
  assert.equal(previewTaskRuleRecalculation(task,[{...rule,endEvent:'到仓入库'}],'V2',task.asOf,options).state,'未命中')
  assert.equal(previewTaskRuleRecalculation(task,[rule,{...rule,id:'CONFLICT'}],'V2',task.asOf,options).state,'规则冲突')
})

test('同一工作不得存两份口径，来源身份变化或未知数量不允许保存',()=>{
  const task=sourceTask(),mapping=mappingFor(task),saved=saveTaskWorkRuleMapping([],mapping,task)
  assert.throws(()=>saveTaskWorkRuleMapping(saved,{...mapping,id:'DUPLICATE'},task),/已有映射/)
  assert.throws(()=>saveTaskWorkRuleMapping([],{...mapping,sourceDocumentId:'OTHER'},task),/来源定义、单据/)
  assert.throws(()=>saveTaskWorkRuleMapping([],{...mapping,startEvent:''},task),/起止事件/)
  const node=task.nodes.find(item=>item.id===mapping.nodeId)!
  node.requiredQuantityKnown=false
  assert.throws(()=>saveTaskWorkRuleMapping([],mapping,task),/未知量/)
})

test('工作单位不换算、通配值不充当事实、里程碑不重复加预算',()=>{
  const task=sourceTask(),mapping=mappingFor(task)
  assert.ok(validateTaskWorkRuleMapping({...mapping,facts:{...mapping.facts,unit:'PCS'}},task).some(error=>error.includes('单位')))
  assert.ok(validateTaskWorkRuleMapping({...mapping,facts:{...mapping.facts,region:'全部'}},task).some(error=>error.includes('通配')))
  const node=task.nodes.find(item=>item.id===mapping.nodeId)!;node.includedInProductionDuration=false
  assert.ok(validateTaskWorkRuleMapping(mapping,task).some(error=>error.includes('重复配置')))
})

test('来源任务发布单项预算后保持整体待定，刷新覆盖和已有截止均保留',()=>{
  const task=sourceTask(),mapping=mappingFor(task),node=task.nodes.find(item=>item.id===mapping.nodeId)!
  task.baselineDueAt='2026-03-15T10:00:00+08:00';task.effectiveDueAt='2026-03-16T10:00:00+08:00'
  const before=structuredClone(task),preview=previewTaskRuleRecalculation(task,[ruleFor(mapping)],'V2',task.asOf,{mappings:[mapping]})
  const restored=applyTaskRuleOverrides([task],[JSON.parse(JSON.stringify(overrideFor(preview)))])[0]
  assert.equal(restored.standardDays,null);assert.equal(restored.predictedFinishAt,null)
  assert.equal(restored.baselineDueAt,before.baselineDueAt);assert.equal(restored.effectiveDueAt,before.effectiveDueAt)
  const after=restored.nodes.find(item=>item.id===node.id)!
  assert.equal(after.actualStartAt,node.actualStartAt);assert.equal(after.actualEndAt,node.actualEndAt)
  assert.equal(after.requiredQty,node.requiredQty);assert.equal(after.qualifiedQty,node.qualifiedQty)
  assert.deepEqual(task,before)
})

test('缺准备或实发范围时即使要求首次建基线也阻断，并且不写覆盖',()=>{
  const task=sourceTask(),mapping=mappingFor(task)
  const result=previewTaskRuleRecalculation(task,[ruleFor(mapping)],'V2',task.asOf,{mappings:[mapping],establishBaseline:true})
  assert.equal(result.state,'规则无效');assert.equal(result.task,null);assert.equal(result.initialBaseline,undefined)
  assert.match(result.message,/首次基线未建立/)
})

test('已确认的未来发货工作尚无实发事实也可建 T0+最长路径基线，缺进度只影响预测',()=>{
  const task=structuredClone(tasks[0]);task.id='COMPLETE-SCOPE-TEST';task.startedAt=snapshot
  task.baselineDueAt=null;task.effectiveDueAt=null;task.standardDays=null
  task.sourceContext={sourceKind:'专项完整来源图',demandHref:'/demand',routeStatus:'已确认',gaps:['实际发货尚未发生，实发记录和客户订单集合未知','合格进度尚未同步'],timingScope:{state:'confirmed',terminalNodeIds:['SHIP'],blockingReasons:[]}}
  task.hasActualShipmentOrderFacts=false;task.shipmentQuantityKnown=false;task.knownShipmentOrderScope='实际发货时才确定'
  task.quantityLines=undefined
  const original=task.nodes[0]
  task.nodes=[{...original,id:'BUILD',taskId:task.id,stage:'S04',origin:'decision',durationDays:null,predecessors:[],sourceDocumentType:'生产单',sourceDocumentId:'PO-1',requiredQty:1,qualifiedQty:0,unit:'项',actualStartAt:snapshot,actualEndAt:null,actualReadyAt:snapshot,businessState:'进行中',baselineDueAt:null,localDueAt:null,standardStartAt:null,predictedEndAt:null,includedInProductionDuration:true},{...original,id:'SHIP',taskId:task.id,stage:'S09',origin:'fulfillment',durationDays:2,predecessors:['BUILD'],sourceDocumentType:'未来发货工作定义',sourceDocumentId:'',actualStartAt:null,actualEndAt:null,businessState:'待开始',baselineDueAt:null,localDueAt:null,standardStartAt:null,predictedStartAt:null,predictedEndAt:null}]
  const mapping=mappingFor(task,'BUILD'),future=mappingFor(task,'SHIP')
  future.id='FUTURE-SHIP';future.facts.work='ACT-S09-04';future.startEvent='本批具备发货条件';future.endEvent='本批实际发货'
  const stored=saveTaskWorkRuleMapping(saveTaskWorkRuleMapping([],mapping,task),future,task)
  const preview=previewTaskRuleRecalculation(task,[ruleFor(mapping,1),{...ruleFor(future,2),id:'FUTURE-SHIP-SLA'}],'V2',snapshot,{mappings:stored,establishBaseline:true})
  assert.equal(preview.state,'可重算');assert.equal(preview.nextDays,3)
  assert.equal(preview.nextForecastAt,null,'missing actual progress does not erase standard but cannot manufacture forecast')
  assert.equal(preview.task!.hasActualShipmentOrderFacts,false);assert.equal(preview.task!.nodes.find(node=>node.id==='SHIP')!.sourceDocumentId,'')
  const unknownSupply=structuredClone(task);unknownSupply.sourceContext!.gaps=[];unknownSupply.sourceContext!.timingScope={state:'pending',terminalNodeIds:['SHIP'],blockingReasons:['供给范围未确认']}
  const pending=previewTaskRuleRecalculation(unknownSupply,[ruleFor(mapping,1)],'V2',snapshot,{mappings:[mapping],establishBaseline:true})
  assert.equal(pending.state,'规则无效');assert.equal(pending.initialBaseline,undefined)
  assert.equal(preview.task!.baselineDueAt,addDays(snapshot,3));assert.equal(preview.task!.effectiveDueAt,addDays(snapshot,3))
  const restored=applyTaskRuleOverrides([task],[overrideFor(preview)],snapshot)[0]
  assert.equal(restored.baselineDueAt,addDays(snapshot,3));assert.equal(restored.baselineStandardDays,3)
  const replacedSource=structuredClone(task);replacedSource.nodes[0].sourceDocumentId='PO-REPLACED'
  const invalidated=applyTaskRuleOverrides([replacedSource],[overrideFor(preview)],snapshot)[0]
  assert.match(invalidated.missingRule!,/映射失效/);assert.equal(invalidated.nodes[0].durationDays,null)
  assert.equal(invalidated.baselineDueAt,addDays(snapshot,3));assert.equal(invalidated.effectiveDueAt,addDays(snapshot,3));assert.equal(invalidated.baselineStandardDays,3)
  const changed=previewTaskRuleRecalculation(restored,[ruleFor(mapping,4)],'V3',snapshot,{mappings:[mapping]})
  assert.equal(changed.nextDays,6);assert.equal(changed.task!.baselineDueAt,addDays(snapshot,3));assert.equal(changed.task!.effectiveDueAt,addDays(snapshot,3))
  assert.equal(previewTaskRuleRecalculation(restored,[ruleFor(mapping)],'V3',snapshot,{mappings:[mapping],establishBaseline:true}).state,'规则无效')
})

test('已发布后来源工作身份变化，不把旧映射预算套到新单据',()=>{
  const task=sourceTask(),mapping=mappingFor(task),preview=previewTaskRuleRecalculation(task,[ruleFor(mapping)],'V2',task.asOf,{mappings:[mapping]})
  task.nodes.find(node=>node.id===mapping.nodeId)!.sourceDocumentId='NEW-PO'
  const after=applyTaskRuleOverrides([task],[overrideFor(preview)])[0]
  assert.equal(after.nodes.find(node=>node.id===mapping.nodeId)!.durationDays,null)
  assert.match(after.missingRule!,/映射失效/)
})

test('配置页面保存映射到本地，空天数发布被阻断，填写预算后实际发布当前来源任务',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>()
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}})
  try{
    const task=sourceTask(),mapping=mappingFor(task),notices:string[]=[]
    setConfigurationTaskSource(()=>[task])
    const render=()=>renderConfiguration({...ui,section:'configuration',role:'供应链管理',user:'规则测试者'})
    const action=(name:string,dataset:Record<string,string>={})=>handleConfigurationAction(name,{dataset} as unknown as HTMLElement,()=>{},message=>notices.push(message))
    const field=(name:string,value:string)=>handleConfigurationField('config-'+name,{value} as HTMLInputElement)
    render();action('config-tab',{configTab:'任务规则映射'});assert.match(render(),/config-load-task-mappings/)
    action('config-select-task-mapping',{configId:mapping.nodeId})
    for(const [key,value] of Object.entries({work:mapping.facts.work,startEvent:mapping.startEvent,endEvent:mapping.endEvent,startAnchor:mapping.startAnchor,endAnchor:mapping.endAnchor,region:mapping.facts.region,supplyMode:mapping.facts.supplyMode,process:mapping.facts.process,route:mapping.facts.route,unit:mapping.facts.unit,source:mapping.source}))field('taskmap-'+key,value)
    action('config-save-task-mapping')
    const key='dds-production-fulfillment-config-mock-v1'
    const saved=JSON.parse(values.get(key)!)
    assert.equal(saved.draft.taskWorkMappings.length,1);assert.equal(saved.draft.taskWorkMappings[0].taskId,task.id)
    action('config-create-mapped-rule');assert.match(render(),/要求自然日/)
    action('config-open-rule-test');field('sample-work','ACT-S09-04')
    const ruleTest=render();assert.match(ruleTest,/<option value="ACT-S09-04" selected>/);assert.match(ruleTest,/ACT-S01-01/);assert.match(ruleTest,/<option value="不适用"/)
    field('publish-scope','选定在途任务本地重算并发布');field('publish-taskIds',task.id);field('publish-reason','测试本地单项规则发布')
    action('config-publish');assert.match(notices.at(-1)!,/发布已阻断/)
    field('rule-days','1');action('config-publish')
    const published=JSON.parse(values.get(key)!)
    assert.equal(published.publishedTaskOverrides.length,1)
    const after=applyPublishedInTransitOverrides([task])[0]
    assert.equal(after.nodes.find(node=>node.id===mapping.nodeId)!.durationDays,1)
    assert.equal(after.baselineDueAt,null);assert.equal(after.standardDays,null)
    assert.equal(task.nodes.find(node=>node.id===mapping.nodeId)!.durationDays,null)
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')}
})
