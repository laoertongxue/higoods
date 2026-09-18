import test from 'node:test'
import assert from 'node:assert/strict'
import { tasks } from '../../src/pages/production-fulfillment/fixtures'
import { emptyDataIssueLedger, reconcileDataIssues, registerDataIssue, dataIssueKey, dataIssueStorageKey, readDataIssueLedger, persistDataIssueLedger, filterDataIssues } from '../../src/pages/production-fulfillment/data-issues'
import { renderOverview } from '../../src/pages/production-fulfillment/dashboards'
import { ui } from '../../src/pages/production-fulfillment/ui-state'

const first='2026-09-18T09:00:00+08:00',second='2026-09-18T10:00:00+08:00',third='2026-09-18T11:00:00+08:00'
function source(){
  const task=structuredClone(tasks[0]);task.id='DEMAND/1';task.asOf=first;task.shipmentQuantityKnown=true
  task.sourceContext={sourceKind:'当前来源',demandHref:'/demand',preparationId:'PREP-1',technicalVersionId:'TECH-1',gaps:[],timingScope:{state:'confirmed',terminalNodeIds:['SHIP'],blockingReasons:[]}}
  task.nodes=[{...task.nodes[0],id:'DEMAND/1:work',taskId:task.id,name:'已有工作',origin:'execution',durationDays:2,businessState:'进行中',includedInProductionDuration:true,requiredQuantityKnown:true,quantityKnown:true,sourceDocumentType:'执行任务',sourceDocumentId:'TASK-1',sourceEntryId:'LINE-1'}]
  return task
}
function storage(initial?:string){
  const values=new Map<string,string>();if(initial!==undefined)values.set(dataIssueStorageKey,initial)
  return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}}
}

test('首次来源读取只创建当前存在的缺口，历史从本次观察开始',()=>{
  const task=source();assert.equal(reconcileDataIssues(emptyDataIssueLedger(),[task],first).issues.length,0)
  task.nodes[0].durationDays=null
  const result=reconcileDataIssues(emptyDataIssueLedger(),[task],second),issue=result.issues[0]
  assert.equal(result.issues.length,1);assert.equal(issue.firstDetectedAt,second);assert.equal(issue.resolvedAt,null)
  assert.equal(issue.history.length,1);assert.equal(issue.history[0].action,'首次发现');assert.equal(issue.history[0].at,second)
  assert.equal(issue.id,`DI/${dataIssueKey(task.id,task.nodes[0].id,'work-sla')}`)
})

test('事项键由任务、工作与类型生成，中文说明变化不新增事项',()=>{
  const task=source();task.nodes[0].durationDays=null
  const before=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  task.nodes[0].name='更新后的中文工作名';task.nodes[0].durationSource='更新后的规则来源'
  const after=reconcileDataIssues(before,[task],second)
  assert.equal(after.issues.length,1);assert.equal(after.issues[0].id,before.issues[0].id);assert.equal(after.issues[0].history.length,1)
  assert.match(after.issues[0].detail,/更新后的中文/)
})

test('缺款图形成独立事项，增加地址不等于款色对应核验通过',()=>{
 const task=source();task.imageUrl=''
 const firstRead=reconcileDataIssues(emptyDataIssueLedger(),[task],first),issue=firstRead.issues.find(issue=>issue.kind==='style-image')!
 assert(issue);assert.match(issue.detail,/通用品类示例图/);assert.equal(issue.autoResolve,false)
 task.imageUrl='/source-style-photo.jpg'
 const secondRead=reconcileDataIssues(firstRead,[task],second),updated=secondRead.issues.find(row=>row.id===issue.id)!
 assert.equal(updated.status,'待处理');assert.match(updated.detail,/款色对应关系仍待核对/)
 assert(!updated.detail.includes('数量已知性'))
})

test('登记责任期限不修改事实或关闭事项，只有后续来源读取确认恢复',()=>{
  const task=source();task.nodes[0].quantityKnown=false
  const firstRead=reconcileDataIssues(emptyDataIssueLedger(),[task],first),id=firstRead.issues[0].id
  const registered=registerDataIssue(firstRead,id,{owner:'质量负责人甲',team:'质检团队',dueAt:third,note:'补齐来源检验记录'},'跟单甲',second)
  assert.equal(registered.issues[0].status,'待处理');assert.equal(task.nodes[0].quantityKnown,false)
  const repaired=structuredClone(task);repaired.nodes[0].quantityKnown=true;repaired.nodes[0].qualifiedQty=10
  assert.equal(registered.issues[0].status,'待处理','changing a source object alone does not mutate ledger')
  const restored=reconcileDataIssues(registered,[repaired],third).issues[0]
  assert.equal(restored.status,'已恢复');assert.equal(restored.resolvedAt,third);assert.equal(restored.owner,'质量负责人甲')
  assert.deepEqual(restored.history.map(event=>event.action),['首次发现','登记责任与期限','来源确认恢复'])
  assert.match(restored.history.at(-1)!.detail,/10/)
})

test('同一恢复事实重复核对不制造历史，缺口复现重新打开且保留期限',()=>{
  const task=source();task.nodes[0].durationDays=null
  let ledger=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  ledger=registerDataIssue(ledger,ledger.issues[0].id,{owner:'计划甲',team:'计划团队',dueAt:third,note:'配置规则'},'跟单甲',first)
  task.nodes[0].durationDays=2;ledger=reconcileDataIssues(ledger,[task],second)
  const repeated=reconcileDataIssues(ledger,[task],third);assert.equal(repeated.issues,ledger.issues)
  task.nodes[0].durationDays=null;const reopened=reconcileDataIssues(repeated,[task],third).issues[0]
  assert.equal(reopened.status,'待处理');assert.equal(reopened.reopenCount,1);assert.equal(reopened.resolvedAt,null)
  assert.equal(reopened.dueAt,third);assert.equal(reopened.owner,'计划甲');assert.equal(reopened.history.at(-1)!.action,'缺口重现')
})

test('任务或工作未返回、数量已知性字段消失均不是恢复证据',()=>{
  const task=source();task.nodes[0].quantityKnown=false
  const ledger=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  assert.equal(reconcileDataIssues(ledger,[],second).issues[0].status,'待处理')
  const missingNode=structuredClone(task);missingNode.nodes=[]
  assert.equal(reconcileDataIssues(ledger,[missingNode],second).issues[0].status,'待处理')
  delete task.nodes[0].quantityKnown
  const unknown=reconcileDataIssues(ledger,[task],second).issues[0]
  assert.equal(unknown.status,'待处理');assert.equal(unknown.autoResolve,false);assert.match(unknown.detail,/未明确提供数量已知性/)
  task.nodes[0].quantityKnown=true
  const restored=reconcileDataIssues(ledger,[task],second)
  assert.equal(restored.issues[0].status,'已恢复')
  delete task.nodes[0].quantityKnown
  const lost=reconcileDataIssues(restored,[task],third).issues[0]
  assert.equal(lost.status,'待处理');assert.equal(lost.autoResolve,false);assert.equal(lost.reopenCount,1)
})

test('来源身份变更不能在同一次读取中把旧缺口标为恢复',()=>{
  const task=source();task.nodes[0].durationDays=null
  const before=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  task.nodes[0].durationDays=2;task.nodes[0].sourceDocumentId='TASK-REPLACED'
  const changed=reconcileDataIssues(before,[task],second)
  assert.equal(changed.issues[0].status,'待处理');assert.equal(changed.issues[0].history.at(-1)!.action,'来源变化')
  assert.equal(reconcileDataIssues(changed,[task],third).issues[0].status,'已恢复')
})

test('未结构化来源审核项不因文字消失自动关闭',()=>{
  const task=source();task.sourceContext!.gaps=['采购供给描述尚待审核']
  const before=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  assert.equal(before.issues[0].kind,'source-review');assert.equal(before.issues[0].autoResolve,false)
  task.sourceContext!.gaps=[];const after=reconcileDataIssues(before,[task],second).issues[0]
  assert.equal(after.id,before.issues[0].id);assert.equal(after.status,'待处理');assert.match(after.detail,/尚无结构化恢复证据/)
})

test('本地持久化保留独立事项、责任、期限和恢复历史',()=>{
  const task=source();task.sourceContext!.preparationId=undefined
  let ledger=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  ledger=registerDataIssue(ledger,ledger.issues[0].id,{owner:'跟单甲',team:'技术团队',dueAt:third,note:'关联已有生产准备'},'跟单甲',second)
  task.sourceContext!.preparationId='PREP-1';ledger=reconcileDataIssues(ledger,[task],third)
  const port=storage();assert.equal(persistDataIssueLedger(ledger,port),null)
  const restored=readDataIssueLedger(port);assert.deepEqual(restored.issues,JSON.parse(JSON.stringify(ledger.issues)));assert.equal(restored.writable,true)
})

test('本地损坏记录不伪造历史、不覆盖旧内容、不允许假保存',()=>{
  for(const raw of ['broken','null','{"version":1,"issues":[{"status":"已恢复"}]}']){
    const port=storage(raw),ledger=readDataIssueLedger(port)
    assert.equal(ledger.issues.length,0);assert.equal(ledger.writable,false);assert.match(ledger.warning,/旧内容未覆盖/)
    const task=source();task.nodes[0].durationDays=null
    const current=reconcileDataIssues(ledger,[task],second)
    assert.equal(current.issues[0].history.length,1);assert.equal(current.issues[0].history[0].at,second)
    assert.ok(persistDataIssueLedger(current,port));assert.equal(port.values.get(dataIssueStorageKey),raw)
    assert.throws(()=>registerDataIssue(current,current.issues[0].id,{owner:'甲',team:'乙',dueAt:third,note:'修复'},'甲',second),/无法读取/)
  }
})

test('责任、期限、调整原因必填；存储失败给出未保存结果',()=>{
  const task=source();task.nodes[0].durationDays=null
  const ledger=reconcileDataIssues(emptyDataIssueLedger(),[task],first),id=ledger.issues[0].id
  const patch={owner:'责任甲',team:'计划团队',dueAt:third,note:'补规则'}
  assert.throws(()=>registerDataIssue(ledger,id,{...patch,owner:'待指派'},'甲',second),/明确的责任人/)
  assert.throws(()=>registerDataIssue(ledger,id,{...patch,dueAt:''},'甲',second),/有效的修复期限/)
  assert.throws(()=>registerDataIssue(ledger,id,{...patch,note:''},'甲',second),/调整原因/)
  assert.match(persistDataIssueLedger(ledger,{getItem:()=>null,setItem:()=>{throw new Error('quota')}})!,/未能保存/)
})

test('数据待补按事项分页和筛选，提供独立登记及来源刷新入口',()=>{
  const task=source();task.nodes[0].durationDays=null
  const ledger=reconcileDataIssues(emptyDataIssueLedger(),[task],first)
  const html=renderOverview([task],{...ui,overviewTab:'数据待补'},ledger,{state:'待处理',owner:'全部',deadline:'全部'})
  assert.match(html,/data-pf-field="data-issue-view"/);assert.match(html,/data-pf-action="data-issue-refresh"/)
  assert.match(html,/data-pf-action="data-issue-open"/);assert.match(html,/data-issue-id="DI\//)
  assert.match(html,/修复期限/);assert.match(html,/登记跟进不会关闭事项/)
  const restored=structuredClone(ledger);restored.issues[0].status='已恢复';restored.issues[0].resolvedAt=second
  assert.doesNotMatch(renderOverview([task],{...ui,overviewTab:'数据待补'},restored,{state:'待处理',owner:'全部',deadline:'全部'}),/data-pf-action="data-issue-open"/)
  assert.match(renderOverview([task],{...ui,overviewTab:'数据待补'},restored,{state:'已恢复',owner:'全部',deadline:'全部'}),/查看恢复记录/)
})

test('事项按自身负责人和修复期限筛选，不借任务跟单替代',()=>{
  const task=source();task.nodes[0].durationDays=null
  let ledger=reconcileDataIssues(emptyDataIssueLedger(),[task],first),ids=new Set([task.id])
  const criteria={state:'待处理' as const,owner:'修复甲',deadline:'全部' as const}
  ledger=registerDataIssue(ledger,ledger.issues[0].id,{owner:'修复甲',team:'数据团队',dueAt:third,note:'补规则'},'跟单甲',first)
  assert.equal(filterDataIssues(ledger,ids,criteria).length,1)
  assert.equal(filterDataIssues(ledger,ids,{...criteria,owner:task.follower}).length,0)
  assert.equal(filterDataIssues(ledger,ids,{...criteria,deadline:'2日内到期'}).length,1)
  assert.equal(filterDataIssues(ledger,ids,{...criteria,deadline:'已逾期'}).length,0)
  assert.equal(filterDataIssues({...ledger,checkedAt:'2026-09-19T10:00:00+08:00'},ids,{...criteria,deadline:'已逾期'}).length,1)
  assert.equal(filterDataIssues(ledger,new Set(),criteria).length,0)
  assert.equal(ledger.issues[0].status,'待处理','filtering does not alter resolution')
})

test('空在途范围不展示历史演示日期压力图',()=>{
  const html=renderOverview([],{...ui,overviewTab:'运行概况'})
  assert.match(html,/当前查询范围没有在途任务/);assert.doesNotMatch(html,/09\/17|NaN|data-pf-action="due-filter"/)
})
