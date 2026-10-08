/** Task and batch graphs read the same registered static documents as their native detail pages. */
import { getTimingBranch, TIMING_AS_OF, timingMs, timingDuration, timingClockHasCompletionFact, timingPostPositionLabel, timingClockHasNotStartedFact, type TimingCase, type TimingDocument } from '../../data/production-timing/source'
const e=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!))
const names:Record<string,string>={sewing:'独立车缝',combined:'车缝＋烫包',full:'裁剪＋车缝＋烫包'}
type RenderDocument=(branch:any,id:string)=>string
function flow(order:TimingCase):any{return order.fullFlow??{allocationStatus:'资料待核实',allocationDocuments:[],execution:[],postStatus:'资料待核实',batches:[],unlocatedQty:null}}
function empty(order:TimingCase,stage:'sewing'|'post'):string{const f=flow(order),status=stage==='sewing'?f.allocationStatus:f.postStatus;return status==='尚未分配'||status==='尚未进入'?'尚未进入 · 本场景没有已发生的执行记录':'资料待核实 · 不据此判断尚未生产'}
export function fullFlowDocumentIds(order:TimingCase,kind:string):string[]{const f=flow(order);if(kind==='allocation')return f.allocationDocuments;if(kind==='sewing')return f.execution.flatMap((t:any)=>t.steps.map((s:any)=>s.documentId));return f.batches.flatMap((b:any)=>kind==='qc'?[b.qcDocumentId]:kind==='processing'?[b.processingDocumentId]:kind==='recheck'?[b.recheckDocumentId]:kind==='delivery'?[b.outboundDocumentId]:[]).filter(Boolean)}
function workState(doc:TimingDocument):'complete'|'complete-time-unknown'|'not-started'|'unknown'|'active'{
 const clock=doc.clock
 if(clock?.end&&Number.isFinite(timingMs(clock.end)))return 'complete'
 if(timingClockHasCompletionFact(doc,clock))return 'complete-time-unknown'
 if(timingClockHasNotStartedFact(doc,clock))return 'not-started'
 if(!clock?.start||!Number.isFinite(timingMs(clock.start))||/待核实|待取得/.test(doc.status))return 'unknown'
 return 'active'
}
export function fullFlowWorkCounts(order:TimingCase,kind:string):{total:number;active:number;complete:number;notStarted:number;unknown:number;completionTimeUnknown:number;longestMs:number}{
 const branch=getTimingBranch(order),docs=fullFlowDocumentIds(order,kind).map(id=>branch?.docs[id]).filter(Boolean) as TimingDocument[]
 const result={total:docs.length,active:0,complete:0,notStarted:0,unknown:0,completionTimeUnknown:0,longestMs:0}
 for(const doc of docs){const state=workState(doc)
  if(state==='complete'||state==='complete-time-unknown'){result.complete++;if(state==='complete-time-unknown')result.completionTimeUnknown++}
  else if(state==='not-started')result.notStarted++
  else if(state==='unknown')result.unknown++
  else{result.active++;result.longestMs=Math.max(result.longestMs,timingMs(TIMING_AS_OF)-timingMs(doc.clock!.start!))}
 }
 return result
}
export function fullFlowRail(order:TimingCase,kind:string,period:(start:string,end:string,label:string,type:string)=>string):string{
 const branch=getTimingBranch(order),ids=fullFlowDocumentIds(order,kind),docs=ids.map(id=>branch?.docs[id]).filter(Boolean) as TimingDocument[]
 if(!docs.length){if(kind==='allocation'||kind==='sewing')return '<div class="unknownrail">'+(flow(order).allocationStatus==='资料待核实'?(kind==='allocation'?'分配记录待核实':'车缝执行记录待核实'):empty(order,'sewing'))+'</div>';const f=flow(order),allBypass=f.batches.length&&f.batches.every((b:any)=>b.position!=='unknown'&&branch?.docs[b.qcDocumentId]?.clock?.end&&!b.processingDocumentId)
  const unknown=f.postStatus==='资料待核实'||f.batches.some((b:any)=>b.position==='unknown');const reason=unknown?'后道资料待核实 · 不推定尚未开展':allBypass&&kind==='processing'?'本批无需我方后道加工 · 不生成加工单':allBypass&&kind==='recheck'?'无需我方加工 · 不生成处理后复核单':f.batches.length?kind==='processing'?'质检尚未完成 · 后道加工单尚未生成':kind==='recheck'?'后道加工尚未完成 · 处理后复核单尚未生成':kind==='delivery'?'前置尚未完成 · 交货单尚未生成':empty(order,'post'):empty(order,kind==='allocation'||kind==='sewing'?'sewing':'post')
  return '<div class="unknownrail">'+reason+'</div>'
 }
 if(kind==='allocation')return '<div class="flow-allocation-events">'+docs.map(d=>'<button class="doc-link" data-document="'+e(d.id)+'">'+e(d.object.split(' · ')[0])+' · 分配 '+e(d.times.业务分配?.slice(5)??'时间待核实')+'</button>').join('')+'</div>'
 const counts=fullFlowWorkCounts(order,kind),active=docs.filter(d=>workState(d)==='active'),closed=docs.filter(d=>workState(d)==='complete'&&d.clock?.start&&Number.isFinite(timingMs(d.clock.start)))
 const missingCompleted=counts.complete-closed.length
 const notes=(active.length&&counts.complete?' · '+counts.complete+'项已完成':'')+(counts.notStarted?' · '+counts.notStarted+'项尚未开始':'')+(counts.unknown?' · '+counts.unknown+'项执行资料待核实':'')+(missingCompleted?' · '+missingCompleted+'项完成记录已取得、实际起止时间待核实':'')
 const target=active.length?active:closed
 if(!target.length)return '<div class="unknownrail">'+(counts.complete?counts.complete+'项已完成'+notes:notes.replace(/^ · /,''))+(missingCompleted?'，实际耗时无法判定':'')+'</div>'
 const start=target.map(d=>d.clock!.start!).sort((a,b)=>timingMs(a)-timingMs(b))[0],open=!!active.length,end=target.map(d=>d.clock?.end??TIMING_AS_OF).sort((a,b)=>timingMs(b)-timingMs(a))[0]
 const label=open?active.length+'项'+(kind==='delivery'?'待接收':'进行中')+(active.length===1?' · 已用'+timingDuration(timingMs(end)-timingMs(start)):''):counts.complete+'项已完成'
 return period(start,end,label,kind==='delivery'?'wait':'process')+(notes?'<span class="flow-rail-status">'+notes.replace(/^ · /,'')+'</span>':'')
}
function processingStep(branch:any,batch:any,render:RenderDocument):string{
 const d=branch?.docs[batch.processingDocumentId],qc=branch?.docs[batch.qcDocumentId]
 const pending=d?Number(d.quantities?.应处理??0)-Number(d.quantities?.已处理??0)-Number(d.quantities?.未处理??0):0
 const content=d?'<div class="flow-process-items"><strong>本单后道项目</strong>'+d.processItems.map((item:string)=>'<span>'+e(item)+'</span>').join('')+'</div>'+render(branch,d.id)+(pending>0?'<div class="flow-placeholder">'+pending+'件尚待记录处理结果</div>':''):placeholder(batch.position==='unknown'?'本次加工资料待核实':!qc?.clock?.end?'质检未完成 · 后道加工单尚未生成':'本次无需我方加工 · 不生成加工单')
 return '<div class="flow-step"><div class="flow-step-label">③ 后道加工单</div>'+content+'</div>'
}
function postBatchChain(branch:any,batch:any,render:RenderDocument):string{
 const qc=branch?.docs[batch.qcDocumentId],direct=batch.position!=='unknown'&&!!qc?.clock?.end&&!batch.processingDocumentId
 const start=node(branch,batch.receiveDocumentId,'① 后道收货',render)+'<span class="flow-chain-arrow">→</span>'+node(branch,batch.qcDocumentId,'② 质检',render)
 const middle=direct?'':'<span class="flow-chain-arrow">→</span>'+processingStep(branch,batch,render)+'<span class="flow-chain-arrow">→</span>'+(batch.recheckDocumentId?node(branch,batch.recheckDocumentId,'④ 处理后交出复核',render):'<div class="flow-step"><div class="flow-step-label">④ 处理后交出复核</div>'+placeholder(batch.position==='unknown'?'复核资料待核实':'后道加工未完成 · 复核单尚未生成')+'</div>')
 const delivery=batch.outboundDocumentId?node(branch,batch.outboundDocumentId,direct?'③ 交货／实际交出':'⑤ 交货／实际交出',render):'<div class="flow-step"><div class="flow-step-label">⑤ 交货／实际交出</div>'+placeholder(batch.position==='unknown'?'交货资料待核实':'前置尚未完成 · 交货单尚未生成')+'</div>'
 const warehouse=batch.inboundDocumentId?node(branch,batch.inboundDocumentId,direct?'④ 成衣仓接收':'⑥ 成衣仓接收',render):'<div class="flow-step"><div class="flow-step-label">'+(direct?'④':'⑥')+' 成衣仓接收</div>'+placeholder(batch.position==='unknown'?'成衣仓入库资料待核实':batch.position==='delivery'?'成衣仓尚未接收 · 入库单尚未生成':'前置尚未完成 · 成衣仓入库单尚未生成')+'</div>'
 return (direct?'<div class="flow-direct-note">无需后道加工；质检后直接交成衣仓</div>':'')+'<div class="flow-chain'+(direct?' flow-chain-direct':'')+'">'+start+middle+'<span class="flow-chain-arrow">→</span>'+delivery+'<span class="flow-chain-arrow">→</span>'+warehouse+'</div>'
}
function title(phase:string,text:string):string{return '<div class="branch-head"><div><strong>'+text+' · 单据与交接链路</strong></div><button class="link" data-expand="'+phase+'">收起本阶段链路 ↑</button></div>'}
function placeholder(text:string):string{return '<div class="flow-placeholder">'+e(text)+'</div>'}
function node(branch:any,id:string|null,label:string,render:RenderDocument,context=''):string{return '<div class="flow-step"><div class="flow-step-label">'+e(label)+(context?'<small>'+e(context)+'</small>':'')+'</div>'+(id&&branch?.docs[id]?render(branch,id):placeholder('尚未取得对应执行单据 · 不填完成时间'))+'</div>'}
export function renderFullFlowBranch(order:TimingCase,phase:'sewing'|'post',renderDocument:RenderDocument):string{
 const f=flow(order),b=getTimingBranch(order),render:RenderDocument=(branch,id)=>{const d=branch.docs[id];return '<div class="flow-document-card">'+renderDocument(branch,id)+'<div class="flow-quantities">'+Object.entries(d.quantities??{}).map(([label,qty])=>'<span><small>'+e(d.type==='后道加工单'&&label==='未处理'?'已确认未处理':label)+'</small><b>'+(qty===null?'待核实':e(qty)+e(d.unit))+'</b></span>').join('')+'</div></div>'};let content=''
 if(phase==='sewing'){
  content=f.execution.length?f.execution.map((x:any)=>{const t=order.tasks.find((t:any)=>t.id===x.taskId);return '<article class="flow-object"><div class="flow-object-head"><strong>'+e(t?.factory)+' · '+e(x.taskId)+'</strong><b>'+names[x.type]+'</b><span>工厂实领 '+e(t?.held)+'件 · 合同从业务分配日起算</span></div><div class="flow-allocation-source"><strong>① 车缝任务分配</strong>'+f.allocationDocuments.filter((id:string)=>b?.docs[id]?.object.includes(x.taskId)).map((id:string)=>render(b,id)).join('')+'</div><strong class="flow-section-label">② 具体执行 · 分别记录实际开始与完成</strong><div class="flow-chain">'+x.steps.map((step:any)=>node(b,step.documentId,step.kind,render,step.kind==='烫包'?'承包工厂烫包':'')).join('<span class="flow-chain-arrow">→</span>')+'</div></article>'}).join(''):placeholder(empty(order,'sewing'))
  content+='<p class="branch-foot">回货进度以本任务后道实收为准；加工与交接分别计时。</p>'
 }else{
  content=f.batches.length?f.batches.map((batch:any)=>'<article class="flow-object" data-flow-batch="'+e(batch.id)+'"><div class="flow-object-head"><strong>'+e(batch.id)+' · '+e(batch.qty)+'件</strong><b class="flow-position '+e(batch.position)+'">'+timingPostPositionLabel(batch.position,b?.docs[batch.processingDocumentId]?.status)+'</b><span>来源任务 '+e(batch.taskId)+'</span></div>'+postBatchChain(b,batch,render)+'</article>').join(''):placeholder(empty(order,'post'))
  if(f.unlocatedQty)content+=placeholder(f.unlocatedQty+'件已实收但后道位置待核实；已在未知批次中登记，不再重复加量')
  content+='<p class="branch-foot">每批仅计一个当前位置；后道项目共用一张加工单的数量和起止时间。加工与交接分别计时，时效要求未确认。</p>'
 }
 return '<div class="branch-panel full-flow-panel" id="branch-'+phase+'">'+title(phase,phase==='sewing'?'车缝任务分配与具体执行':'后道质检／加工／复检／交货')+content+'</div>'
}
export function fullFlowPositionCaption(order:TimingCase):string{const batches=flow(order).batches;return ['qc','processing','recheck'].map(k=>{const qty=batches.filter((b:any)=>b.position===k).reduce((s:number,b:any)=>s+b.qty,0);return qty?(k==='processing'&&batches.some((b:any)=>getTimingBranch(order)?.docs[b.processingDocumentId]?.status==='待后道')?'待后道／加工中':timingPostPositionLabel(k))+qty+'件':''}).filter(Boolean).join(' · ')}
