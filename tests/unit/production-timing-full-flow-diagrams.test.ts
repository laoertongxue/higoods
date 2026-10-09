import assert from 'node:assert/strict'
import test from 'node:test'
import {listTimingCases,getTimingBranch,getTimingCaseByScene} from '../../src/data/production-timing/source.ts'
import {renderTimingDiagramBody,renderTimingNodeDetail,renderTimingDocumentSummary,setTimingDiagramScene,timingDiagramState} from '../../src/pages/production-fulfillment/production-order-diagrams.ts'
import {fullFlowPositionCaption,fullFlowRail,fullFlowWorkCounts} from '../../src/pages/production-fulfillment/full-flow-diagrams.ts'
for(const c of listTimingCases())test(`FLOW graph ${c.key}: full lifecycle keeps allocation, execution and four post stages`,()=>{
 setTimingDiagramScene(c.key);let html=renderTimingDiagramBody()
 for(const label of ['车缝任务分配','车缝执行','后道','成衣仓入库'])assert.ok(html.includes(label),`${c.key}: ${label}`)
 assert.ok(html.indexOf('<strong>车缝任务分配')<html.indexOf('<strong>车缝执行'))
 const cards=html.slice(html.indexOf('<div class="stage-risk-overview">'),html.indexOf('<div class="branch-nav">'))
 assert.equal((cards.match(/class="stage-risk-card"/g)||[]).length,6)
 for(const label of ['车缝任务分配','车缝执行','后道'])assert.ok(cards.includes(`<strong>${label}</strong>`))
 timingDiagramState().expanded={prep:false,supply:false,craft:false,sewing:true,post:true};html=renderTimingDiagramBody()
 assert.ok(html.includes('id="branch-sewing"')&&html.includes('id="branch-post"'))
 for(const batch of c.fullFlow.batches)assert.ok(html.includes(`data-flow-batch="${batch.id}"`))
 const b=getTimingBranch(c)!
 for(const execution of c.fullFlow.execution)for(const step of execution.steps)assert.ok(html.includes(b.docs[step.documentId].no))
 if(c.fullFlow.postStatus==='尚未进入')assert.ok(html.includes('尚未进入 · 本场景没有已发生的执行记录'))
 if(c.key==='unknown'){assert.ok(html.includes('资料待核实 · 不据此判断尚未生产'));assert.equal(Object.keys(b.docs).length,1)}
})
test('FLOW live: QC, processing, recheck quantities have distinct current positions while history remains',()=>{
 const c=getTimingCaseByScene('live');assert.equal(fullFlowPositionCaption(c),'待质检／质检中50件 · 后道加工中50件 · 待复检／复检中50件')
 setTimingDiagramScene('live');const html=renderTimingNodeDetail('flow:post');for(const text of ['质检','复检','交货／实际交出','成衣仓接收','已交出待入仓','成衣仓已入库','无需后道加工'])assert.ok(html.includes(text),text)
})
test('FLOW full contract: scopes and execution documents stay distinct from cumulative contract milestones',()=>{
 setTimingDiagramScene('fullContract');const html=renderTimingNodeDetail('flow:sewing');for(const text of ['独立车缝','车缝＋烫包','裁剪＋车缝＋烫包','承包工厂烫包','裁剪','分别记录实际开始与完成'])assert.ok(html.includes(text),text)
})

test('FLOW delivery: outgoing without warehouse receipt keeps waiting clock active',()=>{
 const html=fullFlowRail(getTimingCaseByScene('live'),'delivery',(start,end,label,type)=>`${start}|${end}|${label}|${type}`)
 assert.ok(html.includes('|2026-10-07 09:00'))
 assert.ok(html.includes('1项待接收 · 已用17小时'))
 assert.ok(!html.includes('完成记录已取得'))
})

test('FLOW one post work order shares projects, quantity and clock without per-project chains',()=>{
 const c=getTimingCaseByScene('fullContract'),branch=getTimingBranch(c)!,batch=c.fullFlow.batches.find(b=>branch.docs[b.processingDocumentId]?.processItems?.length===3)!
 assert.ok(batch)
 setTimingDiagramScene(c.key);const html=renderTimingNodeDetail('flow:post'),part=html.split(`data-flow-batch="${batch.id}"`)[1].split('</article>')[0]
 for(const item of ['开扣眼','装扣子','烫包'])assert.ok(part.includes(item))
 assert.equal((part.match(new RegExp(`data-document="${batch.processingDocumentId}"`,'g'))||[]).length,1)
 assert.ok(part.includes('已确认未处理')&&part.includes('60件尚待记录处理结果'))
 assert.doesNotMatch(part,/下一道加工|剪线|钉扣/)
})
test('FLOW bypass records go from completed QC directly to delivery, without fabricated processing or recheck',()=>{
 const c=getTimingCaseByScene('complete'),b=getTimingBranch(c)!,batch=c.fullFlow.batches.find(x=>!x.processingDocumentId)!
 assert.ok(batch&&b.docs[batch.qcDocumentId].clock?.end)
 setTimingDiagramScene(c.key);const html=renderTimingNodeDetail('flow:post').split(`data-flow-batch="${batch.id}"`)[1].split('</article>')[0]
 assert.ok(html.includes('质检后直接交成衣仓'))
 assert.ok(!html.includes('③ 后道加工单')&&!html.includes('④ 处理后交出复核'))
})

test('FLOW summary cards distinguish pending, unknown, historical and current states without invented SLA',()=>{
 for(const scene of ['positioning','unknown','fullContract','completeUnknown','live']){
  setTimingDiagramScene(scene);const html=renderTimingDiagramBody(),cards=html.slice(html.indexOf('<div class="stage-risk-overview">'),html.indexOf('<div class="branch-nav">'))
  if(scene==='positioning')assert.ok(cards.includes('尚未进入 · 尚未分配执行任务')&&cards.includes('尚未进入 · 暂无后道执行记录'))
  if(scene==='unknown')assert.ok(cards.includes('执行资料待核实 · 不推定尚未生产')&&cards.includes('后道资料待核实 · 不推定尚未开展'))
  if(scene==='fullContract')assert.ok(cards.includes('回货节点未达标 · 已超时')&&cards.includes('时效要求未确认'))
  if(scene==='live')for(const label of ['待质检／质检中 50件','加工中 50件','待复检／复检中 50件','已交出待入仓 150件','成衣仓已入库 600件'])assert.ok(cards.includes(label),label)
  assert.ok(!cards.includes('已知时效项无当前逾期'))
 }
 const c=getTimingCaseByScene('completeUnknown'),work=fullFlowWorkCounts(c,'delivery');assert.equal(work.active,0);assert.ok(work.completionTimeUnknown>0)
})

test('FLOW mixed QC, processing and recheck quantities are summarized as post handling rather than processing',()=>{
 setTimingDiagramScene('live'); const html=renderTimingDiagramBody(); assert.ok(html.includes('后道处理中150')); assert.ok(!html.includes('后道加工150'));
})

test('FLOW pending inspection and recheck are not started rather than unknown, consistently with rails',()=>{
 const live=getTimingCaseByScene('live')
 for(const kind of ['qc','recheck']){const counts=fullFlowWorkCounts(live,kind);assert.ok(counts.notStarted>0);assert.equal(counts.unknown,0);const html=fullFlowRail(live,kind,(_a,_b,l)=>l);assert.ok(html.includes(counts.notStarted+'项尚未开始'));assert.ok(!html.includes('执行资料待核实'))}
})

test('FLOW pending document cards and summaries describe unstarted clocks rather than missing times',()=>{
 setTimingDiagramScene('live');timingDiagramState().expanded.post=true; const html=renderTimingDiagramBody();assert.ok(html.includes('质检尚未开始 · 未开始计时'));assert.ok(html.includes('交货单尚未生成'));assert.ok(html.includes('成衣仓尚未接收 · 入库单尚未生成'));assert.ok(html.includes('前置尚未完成 · 成衣仓入库单尚未生成'));assert.ok(!html.includes('交接尚未交出 · 未开始计时'))
})

test('FLOW document modal has one project block for its single processing order',()=>{
 const c=getTimingCaseByScene('fullContract'),b=getTimingBranch(c)!;setTimingDiagramScene(c.key)
 const batch=c.fullFlow.batches.find(x=>b.docs[x.processingDocumentId]?.processItems?.length===3)!
 const html=renderTimingDocumentSummary(batch.processingDocumentId);assert.equal((html.match(/本单后道项目/g)||[]).length,1)
 const qc=renderTimingDocumentSummary(batch.qcDocumentId);assert.ok(qc.includes('质检确认的后道项目'));assert.ok(!qc.includes('同一张后道加工单，一套数量'))
})


test('COPY developer round: unknown purchase keeps allocation and execution responsibilities unverified',()=>{
 setTimingDiagramScene('unknown');const html=renderTimingDiagramBody();
 for(const kind of ['allocation','sewing'])assert.ok(!fullFlowRail(getTimingCaseByScene('unknown'),kind,()=> '').includes('后道资料'))
 assert.ok(html.includes('分配责任待核实'));assert.ok(!html.includes('王明分配'))
})
test('COPY developer round: mixed post history and active work both remain visible',()=>{
 const c=getTimingCaseByScene('fullContract'),counts=fullFlowWorkCounts(c,'processing'),html=fullFlowRail(c,'processing',(_a,_b,label)=>label);
 assert.ok(counts.active&&counts.complete);assert.ok(html.includes(counts.active+'项进行中'));assert.ok(html.includes(counts.complete+'项已完成'));
})
test('COPY developer round: partial warehouse quantity is not a completed stage',()=>{
 setTimingDiagramScene('fullContract');const html=renderTimingDiagramBody();
 const row=html.slice(html.lastIndexOf('<div class="chart-row'),html.lastIndexOf('<p class="chart-note'));
 assert.ok(!row.includes('<span class="icon">✓</span>'));assert.ok(row.includes('累计480／应完成1500件'));
})
test('COPY developer round: process start and quantity appear once, QC uses its own business action',()=>{
 setTimingDiagramScene('fullContract');const c=getTimingCaseByScene('fullContract'),b=getTimingBranch(c)!,html=renderTimingNodeDetail('flow:post');
 const batch=c.fullFlow.batches.find(x=>b.docs[x.processingDocumentId]?.processItems?.length===3)!,part=html.split(`data-flow-batch="${batch.id}"`)[1].split('</article>')[0];
 const card=part.split('class="flow-process-items"')[1].split('④ 处理后交出复核')[0];
 assert.equal((card.match(/10-06 15:06/g)||[]).length,1);assert.ok(!card.includes('后道中 · 应处理'));assert.ok(part.includes('质检 耗时4分钟'));assert.ok(!part.includes('制作 已用'));
})
