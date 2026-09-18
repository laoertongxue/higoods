import assert from 'node:assert/strict'
import test from 'node:test'
import { createConfiguration, dependencySpan, matchEventMapping, matchTimingRules, publicationImpact, validateConfiguration, type RuleSample } from '../../src/pages/production-fulfillment/config-model'
import { tasks, snapshot } from '../../src/pages/production-fulfillment/fixtures'
import { addDays } from '../../src/pages/production-fulfillment/calculations'
import { applyTaskRuleOverrides, previewTaskRuleRecalculation, type PublishedTaskRuleOverride } from '../../src/pages/production-fulfillment/rule-recalculation'

const example = ():RuleSample => ({work:'ACT-S03-12',region:'CN',supplyMode:'现货采购',process:'无加工',route:'印尼仓→车缝厂',quantity:1000,unit:'PCS'})
const fixture = () => createConfiguration([], [{id:'S02',name:'技术与用料准备'}])

test('同一调拨动作按国家和供给方式命中不同预算，候选规则不参与匹配',()=>{
  const config=fixture()
  assert.equal(matchTimingRules(config.rules,example()).matches[0].days,1)
  assert.equal(matchTimingRules(config.rules,{...example(),region:'ID',supplyMode:'已有库存'}).matches[0].days,0.5)
  assert.equal(matchTimingRules(config.rules,{...example(),work:'ACT-S03-15',region:'ID',supplyMode:'本土制作'}).state,'未命中')
  assert.equal(matchTimingRules(config.rules,{...example(),region:'待确定'}).state,'未命中')
})

test('同优先级重叠命中必须冲突，明确更高优先级例外才可覆盖',()=>{
  const config=fixture(),duplicate={...config.rules[0],id:'SAME-PRIORITY',days:2}
  config.rules.push(duplicate)
  assert.equal(matchTimingRules(config.rules,example()).state,'冲突')
  assert.ok(validateConfiguration(config).some(issue=>issue.code==='RULE_CONFLICT'&&issue.severity==='阻断'))
  duplicate.priority=1;duplicate.source='任务特批 DEMO-001'
  const result=matchTimingRules(config.rules,example())
  assert.equal(result.state,'命中');assert.equal(result.matches[0].id,'SAME-PRIORITY')
})

test('数量档边界不得跨档或用默认预算掩盖无规则',()=>{
  const config=fixture(),sample={...example(),work:'ACT-S07-03',region:'ID',process:'梭织'}
  assert.equal(matchTimingRules(config.rules,{...sample,quantity:500}).matches[0].days,3)
  assert.equal(matchTimingRules(config.rules,{...sample,quantity:501}).matches[0].days,6)
  assert.equal(matchTimingRules(config.rules,{...sample,quantity:1001}).state,'未命中')
  assert.equal(matchTimingRules(config.rules,{...sample,quantity:-1}).state,'输入无效')
})

test('子项七天而组上限五天阻断，网络不被截短也不在组外重复加预算',()=>{
  const config=fixture();config.dependencies[0].days=5
  assert.equal(dependencySpan(config.dependencies).days,7)
  assert.ok(validateConfiguration(config).some(issue=>issue.code==='GROUP_CAP_EXCEEDED'))
  config.group.capDays=7
  assert.equal(dependencySpan(config.dependencies).days,7)
  assert.ok(!validateConfiguration(config).some(issue=>issue.code==='GROUP_CAP_EXCEEDED'))
})

test('并行分支取最大值，循环和缺失前置不得算成零天',()=>{
  const config=fixture();config.dependencies[1].predecessors=[]
  assert.equal(dependencySpan(config.dependencies).days,3)
  config.dependencies[0].predecessors=['DEP-DYE'];config.dependencies[1].predecessors=['DEP-MAKE']
  assert.equal(dependencySpan(config.dependencies).days,null)
  assert.ok(validateConfiguration(config).some(issue=>issue.code==='DEPENDENCY_CYCLE'))
  config.dependencies[0].predecessors=['MISSING']
  assert.ok(validateConfiguration(config).some(issue=>issue.code==='DEPENDENCY_MISSING'))
})

test('工厂实收映射须有明细与物流批次，入库不冒充到厂，重复事件不累加',()=>{
  const mapping=fixture().mappings[1]
  const sample={system:'FCS',document:'工厂接收单',event:'工厂合格实收',eventId:'EVT-1',attributes:{'调拨明细ID':'TR-1','物流批次ID':'BATCH-1','接收明细ID':'REC-1','工厂实收合格数量':800,'实收单位':'PCS'}}
  assert.equal(matchEventMapping(mapping,sample).state,'命中')
  const missing={...sample,attributes:{...sample.attributes,'物流批次ID':''}}
  assert.equal(matchEventMapping(mapping,missing).state,'未命中')
  assert.equal(matchEventMapping(mapping,{...sample,event:'采购入库确认'}).state,'未命中')
  assert.equal(matchEventMapping(mapping,sample,['EVT-1']).state,'重复事件')
})

test('投入产出、单位或质量门槛不合规，不能放行下游',()=>{
  const config=fixture();config.dependencies[1].unit='Yard';config.dependencies[1].inputSku='另一物料';config.dependencies[1].qualifiedOnly=false
  const codes=validateConfiguration(config).map(issue=>issue.code)
  assert.ok(codes.includes('UNIT_MISMATCH'));assert.ok(codes.includes('SKU_MISMATCH'));assert.ok(codes.includes('QUALITY_RELEASE'))
})

test('新版本仅记录显式重算范围，不能顺延旧基线或考核截止',()=>{
  const tasks=[{id:'T01',ruleVersion:'V1',baselineDueAt:'2026-09-15T10:00:00+08:00',effectiveDueAt:'2026-09-16T10:00:00+08:00',businessState:'进行中'},{id:'T02',ruleVersion:'V1',baselineDueAt:null,effectiveDueAt:null,businessState:'待判断'}]
  const before=structuredClone(tasks),impact=publicationImpact(tasks,'V2',['T01'])
  assert.deepEqual(tasks,before)
  assert.equal(impact[0].nextVersion,'V2');assert.equal(impact[0].baselineDueAt,before[0].baselineDueAt);assert.equal(impact[0].effectiveDueAt,before[0].effectiveDueAt)
  assert.equal(impact[1].nextVersion,'V1');assert.equal(impact[1].effectiveDueAt,null)
  assert.ok(impact[0].action.includes('历史逾期均保留'))
})

test('默认演示配置没有阻断，会议候选必须以提示保留',()=>{
  const issues=validateConfiguration(fixture())
  assert.equal(issues.filter(issue=>issue.severity==='阻断').length,0)
  assert.ok(issues.some(issue=>issue.code==='CANDIDATE_EXCLUDED'))
})

test('选定在途W19规则从1改3，本地路线24改26而原始/生效截止与实际事实不变',()=>{
  const original=tasks.find(task=>task.id==='MOCK-PT-001')!,before=structuredClone(original),config=fixture()
  config.rules[0].days=3
  const result=previewTaskRuleRecalculation(original,config.rules,'MOCK-RULE-V2')
  assert.equal(result.state,'可重算');assert.equal(result.previousDays,24);assert.equal(result.nextDays,26)
  assert.equal(result.task!.nodes.find(node=>node.id==='W19')!.durationDays,3)
  assert.equal(result.task!.ruleVersion,'MOCK-RULE-V2')
  assert.equal(result.task!.baselineDueAt,original.baselineDueAt)
  assert.equal(result.task!.effectiveDueAt,original.effectiveDueAt)
  // W19 is already completed; changing its theoretical standard cannot move its real receipt or the live forecast.
  assert.equal(Date.parse(result.nextForecastAt!),Date.parse(original.predictedFinishAt!))
  const facts=(task:typeof original)=>task.nodes.map(node=>({id:node.id,start:node.actualStartAt,end:node.actualEndAt,qualified:node.qualifiedQty,required:node.requiredQty,baselineStart:node.standardStartAt,baseline:node.baselineDueAt,local:node.localDueAt}))
  assert.deepEqual(facts(result.task!),facts(original));assert.deepEqual(original,before)
  assert.equal(result.task!.health,'预计逾期')
})

test('在途发布同层冲突、缺规则、缺映射或事件边界变化都不生成覆盖',()=>{
  const task=tasks.find(item=>item.id==='MOCK-PT-001')!,config=fixture()
  config.rules.push({...config.rules[0],id:'CONFLICT'})
  const conflict=previewTaskRuleRecalculation(task,config.rules,'V2')
  assert.equal(conflict.state,'规则冲突');assert.equal(conflict.task,null)
  assert.equal(previewTaskRuleRecalculation(task,[],'V2').state,'未命中')
  assert.equal(previewTaskRuleRecalculation(tasks.find(item=>item.id==='MOCK-PT-006')!,fixture().rules,'V2').state,'未命中')
  const changed=fixture();changed.rules[0].endEvent='采购到仓入库'
  assert.equal(previewTaskRuleRecalculation(task,changed.rules,'V2').state,'未命中')
})

test('发布覆盖可从初始快照恢复且重复应用幂等，未选任务不受影响',()=>{
  const task=tasks.find(item=>item.id==='MOCK-PT-001')!,config=fixture();config.rules[0].days=3
  const preview=previewTaskRuleRecalculation(task,config.rules,'MOCK-RULE-V2')
  const override:PublishedTaskRuleOverride={id:'APPLY-1',taskId:task.id,version:'MOCK-RULE-V2',publishedAt:'2026-09-17T10:00:00+08:00',by:'规则管理员',reason:'演示调拨标准变更',changes:preview.changes,previousDays:preview.previousDays,nextDays:preview.nextDays,previousForecastAt:preview.previousForecastAt,nextForecastAt:preview.nextForecastAt,baselineDueAt:preview.baselineDueAt,effectiveDueAt:preview.effectiveDueAt}
  const projected=applyTaskRuleOverrides(tasks,[override]),again=applyTaskRuleOverrides(projected,[override])
  assert.equal(projected[0].standardDays,26);assert.equal(projected[0].ruleVersion,'MOCK-RULE-V2')
  assert.deepEqual(again,projected);assert.equal(again[0],projected[0])
  assert.equal(projected[1],tasks[1]);assert.equal(tasks[0].standardDays,24)
})

test('未完成调拨预算增加后，预测沿下游传播；已完成上游事实仍原样',()=>{
  const task=structuredClone(tasks[0]),config=fixture();config.rules[0].days=3
  const outbound=task.nodes.find(node=>node.id==='W18')!,transport=task.nodes.find(node=>node.id==='W19')!,tail=task.nodes.find(node=>node.id==='W31')!
  task.startedAt=snapshot;task.standardDays=3;task.predictedFinishAt=addDays(snapshot,2)
  task.nodes=[
    {...outbound,predecessors:[],actualStartAt:addDays(snapshot,-1),actualEndAt:snapshot,durationDays:1,sourceUpdatedAt:snapshot},
    {...transport,predecessors:['W18'],actualStartAt:snapshot,actualEndAt:null,qualifiedQty:0,businessState:'进行中',predictedStartAt:snapshot,predictedEndAt:addDays(snapshot,1),durationDays:1,sourceUpdatedAt:snapshot},
    {...tail,id:'TAIL',predecessors:['W19'],actualStartAt:null,actualEndAt:null,predictedStartAt:addDays(snapshot,1),predictedEndAt:addDays(snapshot,2),durationDays:1,sourceUpdatedAt:snapshot},
  ]
  const result=previewTaskRuleRecalculation(task,config.rules,'V2')
  assert.equal(result.state,'可重算');assert.equal(result.nextDays,5)
  assert.equal(Date.parse(result.nextForecastAt!),Date.parse(addDays(snapshot,4)))
  assert.equal(result.task!.nodes[0].actualEndAt,snapshot)
  assert.equal(result.task!.effectiveDueAt,task.effectiveDueAt)
})
