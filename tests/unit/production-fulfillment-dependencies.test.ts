import {test} from 'node:test'
import assert from 'node:assert/strict'
import {tasks} from '../../src/pages/production-fulfillment/fixtures.ts'
import {dependencyAnalysis,dependencyLayout,renderDependencyGraph} from '../../src/pages/production-fulfillment/dependency-graph.ts'
import {renderWorkDetail,renderFormula} from '../../src/pages/production-fulfillment/task-detail.ts'
import {ui} from '../../src/pages/production-fulfillment/ui-state.ts'
import type {PFNode,PFTask} from '../../src/pages/production-fulfillment/model.ts'
const task=()=>structuredClone(tasks[0])
function node(id:string,parents:string[]=[],extra:Partial<PFNode>={}):PFNode{return {...task().nodes[0],id,taskId:'test',name:id,predecessors:parents,durationDays:null,actualStartAt:null,actualEndAt:null,businessState:'待开始',timeState:'待判定',actualOverdueDays:0,predictedDelayDays:null,sourceDocumentId:'DOC-'+id,includedInProductionDuration:true,...extra}}
function chain(nodes:PFNode[]):PFTask{return {...task(),id:'test',nodes}}
test('未知预算仍保留串并行和汇合箭头，位置不依赖日期',()=>{
 const t=chain([node('A'),node('B',['A']),node('C',['A']),node('D',['B','C'])])
 const l=dependencyLayout(t.nodes)
 assert.equal(l.positions.get('B')!.x,l.positions.get('C')!.x)
 assert(l.positions.get('A')!.x<l.positions.get('B')!.x)
 assert(l.positions.get('B')!.x<l.positions.get('D')!.x)
 const html=renderDependencyGraph(t,{...ui,dependencyScope:'全部工作'})
 assert.equal((html.match(/data-dependency-from=/g)||[]).length,4)
 assert.match(html,/data-dependency-from="C" data-dependency-to="D"/)
 assert.doesNotMatch(html,/NaN/)
})
test('下游未开工且前置未完的逾期归为等待；根卡点标出具体工作和全部后继',()=>{
 const t=chain([node('A',[],{actualStartAt:'2026-09-01T10:00:00+08:00',actualOverdueDays:3}),node('B',['A'],{actualOverdueDays:2}),node('C',['B'])])
 const a=dependencyAnalysis(t)
 assert.deepEqual(a.blockers.map(b=>b.node.id),['A'])
 assert.deepEqual(a.blockers[0].downstream,['B','C'])
 assert.deepEqual(a.pendingParents(t.nodes[1]).map(n=>n.id),['A'])
})
test('取消和已完成不是当前卡点，数据缺口不当执行逾期',()=>{
 const t=chain([node('done',[],{businessState:'已完成',actualOverdueDays:2}),node('cancel',[],{businessState:'已取消',actualOverdueDays:3}),node('gap',[],{origin:'decision',sourceDocumentId:'',blocker:'缺来源',actualOverdueDays:4})])
 const a=dependencyAnalysis(t);assert.equal(a.blockers.length,0);assert.deepEqual(a.dataGaps.map(n=>n.id),['gap'])
})
test('已开工工作即使前置未完，也保留其来源责任逾期并提示核对',()=>{
 const t=chain([node('A'),node('B',['A'],{actualStartAt:'2026-09-01T10:00:00+08:00',actualOverdueDays:2})])
 assert.deepEqual(dependencyAnalysis(t).blockers.map(b=>b.node.id),['B'])
})
test('卡点范围仍显示上游参照及所有受影响后继，不显示无关支路',()=>{
 const t=chain([node('A',[],{businessState:'已完成'}),node('B',['A'],{actualStartAt:'2026-09-01T10:00:00+08:00',actualOverdueDays:1}),node('C',['B']),node('X')])
 const html=renderDependencyGraph(t,{...ui,dependencyScope:'卡点与影响'})
 for(const id of ['A','B','C'])assert(html.includes(`data-flow-node="${id}"`))
 assert(!html.includes('data-flow-node="X"'))
})
test('单据摘要默认展开来源核心字段，不只展示时效',()=>{
 const n=node('裁片',[],{sourceSummary:{documentType:'裁床加工单',documentNo:'CUT-001',status:'进行中',href:'/fcs/cutting/CUT-001',fields:[{label:'应裁数量',value:'1200 件'},{label:'工厂',value:'裁厂A'}]}})
 const html=renderWorkDetail(chain([n]),n)
 assert.match(html,/CUT-001/);assert.match(html,/应裁数量/);assert.match(html,/1200 件/);assert.match(html,/查看来源页面/);assert.match(html,/href="\/fcs\/cutting\/CUT-001"/)
})
test('需求摘要指向已存在的需求列表，入口不冒称独立详情',()=>{
 const n=node('需求下达',[],{sourceHref:'/fcs/production/demand-inbox'})
 const html=renderWorkDetail(chain([n]),n)
 assert.match(html,/前往生产需求列表/)
 assert.match(html,/href="\/fcs\/production\/demand-inbox"/)
 assert.doesNotMatch(html,/打开完整业务单据|\/fcs\/production\/demands\//)
})
test('缺少单据不得生成虚构摘要或默认完成数',()=>{
 const n=node('来源缺口',[],{sourceDocumentId:'',blocker:'尚未关联到厂接收单'})
 const html=renderWorkDetail(chain([n]),n)
 assert.match(html,/尚未关联对应业务单据/);assert.match(html,/尚未关联到厂接收单/)
 assert.doesNotMatch(html,/查看来源页面/)
})
test('已实收的有效结束满足前置，取消前置不会被视为供给完成',()=>{
 const t=chain([node('receipt',[],{businessState:'已实收',actualEndAt:'2026-09-01T10:00:00+08:00'}),node('cancel',[],{businessState:'已取消'}),node('B',['receipt','cancel'])])
 assert.deepEqual(dependencyAnalysis(t).pendingParents(t.nodes[2]).map(n=>n.id),['cancel'])
})
test('质检不合格仍是放行卡点，不因检验时间存在变为可放行',()=>{
 const t=chain([node('qc',[],{businessState:'检验不合格',actualEndAt:'2026-09-01T10:00:00+08:00'}),node('ship',['qc'])])
 assert.deepEqual(dependencyAnalysis(t).blockers.map(b=>b.node.id),['qc'])
 assert.deepEqual(dependencyAnalysis(t).pendingParents(t.nodes[1]).map(n=>n.id),['qc'])
})
test('来源已有不合格检验结果但缺建立时间时，不因前置未完而隐藏本项卡点',()=>{
 const t=chain([node('sew'),node('qc',['sew'],{businessState:'检验不合格',actualEndAt:'2026-09-01T10:00:00+08:00',blocker:'检验不合格 42 件'}),node('ship',['qc'])])
 assert.deepEqual(dependencyAnalysis(t).blockers.map(b=>b.node.id),['qc'])
 assert.deepEqual(dependencyAnalysis(t).blockers[0].downstream,['ship'])
 const html=renderDependencyGraph(t,{...ui,dependencyScope:'卡点与影响'})
 assert.match(html,/pf-flow-blocked[^>]*data-flow-node="qc"/)
 assert.match(html,/检验不合格 42 件/)
})
test('作废且不计时不等于前置已完成；来源已阻断是明确卡点',()=>{
 const t=chain([node('void',[],{businessState:'已作废',includedInProductionDuration:false}),node('next',['void']),node('blocked',[],{businessState:'已阻断',blocker:'裁片尚未验收'})])
 assert.deepEqual(dependencyAnalysis(t).pendingParents(t.nodes[1]).map(n=>n.id),['void'])
 assert.deepEqual(dependencyAnalysis(t).blockers.map(b=>b.node.id),['blocked'])
 assert.equal(dependencyAnalysis(t).blockers[0].reason,'裁片尚未验收')
})

test('已知工作预算齐备但范围未确认时，公式页不得称作全程标准',()=>{
 const t=chain([node('A',[],{durationDays:1}),node('B',['A'],{durationDays:2})])
 t.standardDays=null;t.sourceContext={demandHref:'/source',gaps:[],sourceKind:'当前原型业务来源',timingScope:{state:'pending',terminalNodeIds:['B'],blockingReasons:['供给路线待确认']}}
 const html=renderFormula(t,{...ui,detailSubTab:'整体公式'})
 assert.match(html,/总时效待判定/);assert.match(html,/当前已知工作子图长度 3 自然日/);assert.doesNotMatch(html,/<b>L = 3 自然日<\/b>/)
})

test('暂停或受阻工作不因遗留结束时间而放行下游',()=>{
 for(const state of ['暂停','受阻']){
 const t=chain([node('A',[],{businessState:state,actualEndAt:'2026-09-01T10:00:00+08:00'}),node('B',['A'])])
 assert.deepEqual(dependencyAnalysis(t).pendingParents(t.nodes[1]).map(n=>n.id),['A']);assert.equal(dependencyAnalysis(t).blockers[0].node.id,'A')
 }
})
