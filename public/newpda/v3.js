'use strict';
// Independent design only. All facts reset on reload; no repository APIs or storage.
const draftDirty = {}, received = {}, closed = {}, outputs = {}, handovers = [];
const taskIds = {毛织:'HJ-008',染色:'RS-002',印花:'PH-008',洗水:'WS-001',特殊工艺:'XH-001',裁剪:'CJ-082',后整:'HZ-082'};
let viewTask = taskIds[cap], activeHandover = '', localFlash = '', renderedPage = '', locationDraft = null;
let auth = null;
Object.assign(work,{dyeStarted:screen==='dye-step',dyeFinished:false,printOutput:false,washOutput:false,postProcessed:false,postChecked:false,cutStage:0,cutRolls:[],bagLocation:'A03',putaway:false,stocktakeDone:false,bindingClosed:{},waterPaused:false,waterReady:false});
const additions = [
 ['material-receive','来料实收','接收','按本工序的实际交接对象接收。','逐卷或逐菲票确认实际数量和位置；不是接单。'],
 ['task-detail','本单执行与交接','执行闭环','当前加工、可交批次、每次交接都在本单。','同一任务连续查看，不跳到另一张示例单。'],
 ['handover-detail','交接结果','执行闭环','查看本次交出及对方实收；有异议时记录原因。','交出人不能代接收方实收。差异保留原交出和原实收。'],
 ['handover-objection','实收查看','执行闭环','查看原交出与对方实收。','保留交接双方各自的数量、人员和时间。'],
 ['complete-order','核对完单','执行闭环','只展示本单还缺的条件。','不同工序按原完单规则执行；不以一次交出自动完单。'],
 ['complete-handout','结束本单交出','执行闭环','核对累计交出和结束后果。','通用交出单保留计划 80%–120% 完成区间；不套用于毛织。'],
 ['finishing-recheck','数量条码复核','后整 / 裁剪','逐 SKU 核对实际数量及包装条码。','任何数量差异需有效授权；条码错须换标重扫。'],
 ['cutting-progress','本床作业','后整 / 裁剪','继续登记布卷、结束铺布、开始裁剪、记录产出。','已收、已选裁床；至少一卷；实际用量和产出必须有效。'],
 ['cutting-tickets','菲票与装袋','后整 / 裁剪','核对已编号菲票，打印贴票后逐票装入正确袋。','未打印、已装袋、错单或重复菲票不能装袋。'],
 ['cutting-inbound','裁片入待交出仓','后整 / 裁剪','扫描装好的袋和实际存放位置。','空袋不可入仓；入仓不等于 PPIC 放行或车缝实收。'],
 ['binding-finish','结束本规格','特殊工艺','核对实际产出，少量结束填写原因。','结束加工仍保留已产出捆条的交出与接收责任。']
];
catalog.push(...additions);
Object.assign(pageCap,{'finishing-recheck':'后整','cutting-progress':'裁剪','cutting-tickets':'裁剪','cutting-inbound':'裁剪','binding-finish':'特殊工艺'});
if(catalog.some(p=>p[0]===params.get('screen')))screen=params.get('screen');
if(pageCap[screen])cap=pageCap[screen];
viewTask=taskIds[cap];
const inputReceipts={
 染色:{id:'RS-IN-02',code:'RS-IN-R02',key:'raw',qty:50,unit:'yard',from:'面料中央仓',target:'中央工厂 · 染色',kind:'卷'},
 印花:{id:'PH-IN-02',code:'PL-IN-R02',key:'raw',qty:50,unit:'yard',from:'面料中央仓',target:'中央工厂 · 印花',kind:'卷'},
 洗水:{id:'WS-IN-02',code:'WS-IN-R02',key:'print',qty:50,unit:'yard',from:'印花 PH-009',target:'GTG · 洗水',kind:'卷'},
 特殊工艺:{id:'XH-IN-02',code:'FP-Q1-002',key:'wool',qty:20,unit:'片',from:'横机 HJ-009',target:'本厂 · 绣花',kind:'菲票'},
 裁剪:{id:'CJ-IN-02',code:'RK-082-04',key:'rib',qty:100,unit:'yard',from:'面料中央仓',target:'本厂 · 裁床待加工仓',kind:'入仓节点'}
};
function receivePage(c){return c==='毛织'?'yarn-receive':c==='后整'?'receive-check':'material-receive'}
function currentPage(c=cap,id=taskIds[c]){
 if(closed[id])return 'complete-order';if(closed['handout:'+id])return 'task-detail';
 if(id==='XH-001'&&work.specialRemaining===0)return 'task-detail';if(id==='KT-082')return 'binding-report';if(id==='PK-082')return 'loop-report';if(id==='SR-001')return work.waterReady||work.waterPaused?'task-detail':'water-report';
 if(c==='染色')return work.dyeFinished?'task-detail':work.dyeStarted?'dye-step':'dye-input';
 if(c==='印花')return work.printOutput?'task-detail':work.testDone?(work.printDone?'print-transfer':'print-run'):'print-test';
 if(c==='洗水')return work.washOutput?'task-detail':work.washStarted?'wash-output':'wash-input';
 if(c==='后整')return work.postChecked?'task-detail':work.postProcessed?'finishing-recheck':'process-finishing';
 if(c==='裁剪')return work.cutStage>=4?'task-detail':work.cutStage===3?'cutting-inbound':work.cutStage===2?'cutting-tickets':work.cutRolls.length?'cutting-progress':'process-cutting';
 return firstPage[c];
}
function activeTask(){if(['binding-report','binding-finish'].includes(screen))return 'KT-082';if(screen==='loop-report')return 'PK-082';if(screen==='water-report')return 'SR-001';if(['handoff','handover-detail','handover-objection','task-detail','complete-order','complete-handout'].includes(screen))return viewTask||taskIds[cap];return taskIds[cap]}
function taskCap(id){return Object.keys(taskIds).find(c=>taskIds[c]===id)||'特殊工艺'}
function batchKey(c,source,code){return c+'|'+source+'|'+code}
function addOutput(c,qty,unit,source,target,code,image){
 const key=batchKey(c,source,code),id=source.split(' · ')[0];
 if(!outputs[key])outputs[key]={key,task:id,cap:c,total:0,qty:0,unit,source,target,code,image:image||objectKey(c)};
 outputs[key].total+=qty;outputs[key].qty+=qty;balances[key]=outputs[key].qty;
 hand={...outputs[key]};drafts.handoff={};delete scans['handoff:code'];viewTask=id;
}
setupHand = addOutput;
addOutput('毛织',40,'片','HJ-008 · Q / 第1片','APF · 绣花','FP-Q1-001','wool');
addOutput('毛织',30,'件','FP-011 · 本次完成','中央工厂 · 后整','FP-011-B03','wool');
addOutput('特殊工艺',60,'米','KT-082 · 领口捆条 · 2 cm','本单指定接收方 · 裁床','KT-082-01','rib');
addOutput('特殊工艺',80,'个','PK-082 · 规格01','本单指定接收方 · 车缝','PK-082-01','rib');
viewTask=taskIds[cap];
function batches(id=viewTask){return Object.values(outputs).filter(b=>b.task===id)}
function transfers(id=viewTask){return handovers.filter(h=>h.task===id)}
function openBatch(key){const b=outputs[key];if(!b)return;hand={...b};viewTask=b.task;cap=b.cap;drafts.handoff={};delete scans['handoff:code'];go('handoff')}
function batchCards(id){return batches(id).filter(b=>b.qty>0).map(b=>`<button class="choose-row" data-batch-open="${esc(b.key)}"><span>${b.code}<small>${b.cap==='裁剪'&&!work.cutReleased?'待 PPIC 放行':'可交'} ${fmt(b.qty)} ${b.unit} · ${b.target}</small></span>${I('out')}</button>`).join('')}
function handoverCards(id){return transfers(id).map(h=>`<button class="choose-row" data-handover-open="${h.id}"><span>${h.id} · ${h.state}<small>交出 ${h.qty} ${h.unit} · ${h.actual===undefined?'待对方点收':'实收 '+h.actual+' '+h.unit}</small></span>${I('next')}</button>`).join('')}
function taskCard(id,c){const p=currentPage(c,id),bs=batches(id),hs=transfers(id),pending=bs.reduce((s,b)=>s+b.qty,0);return `<article class="task"><div class="task-status"><span>${id}</span><span class="pill">${closed[id]?'已完单':hs.some(h=>h.state==='有差异')?'有接收差异':p==='task-detail'?'查看交接':'可执行'}</span></div>${product(['KT-082','PK-082'].includes(id)?'rib':objectKey(c))}<div class="task-foot"><span class="muted">${pending?'可交 '+fmt(pending)+' '+bs[0].unit:hs.length?hs.length+' 次交接':'按当前步骤执行'}</span><button class="task-go" data-task-open="${id}">${p==='task-detail'||closed[id]?'查看本单':'继续作业'} ${I('next')}</button></div>${!closed[id]&&(bs.length||hs.length)?`<button class="textline task-link" data-task-detail="${id}">本单交出与实收 ${I('next')}</button>`:''}</article>`}
listPage = function(){const ids=cap==='特殊工艺'?['XH-001','KT-082','PK-082','SR-001']:[taskIds[cap]];return `${scanEntry('扫任务 / 输编号')}${heading('本工序任务',ids.length+' 笔')}${ids.map(id=>taskCard(id,cap)).join('')}`};renderers['process-list']=listPage;
receiveList = function(){const id=receivePage(cap),r=inputReceipts[cap],key=r?.id||id;return `${scanEntry('扫来货单 / 输编号')}${heading('待接收',received[key]?'0 笔':'1 笔')}${received[key]?note('本批已接收，可在记录中核对实收。','good')+`<button class="choose-row" data-action="records">查看本次接收记录 ${I('next')}</button>`:task(r?.key||(cap==='毛织'?'yarn':'hoodie'),id,r?`${r.id} · ${r.from}`:cap==='毛织'?'SL-008 · 纱线中央仓':'JH-082-01 · 外部车缝 A 厂','待接收',r?.qty||(cap==='毛织'?25.8:100),r?.unit||(cap==='毛织'?'kg 毛重':'件'),'核对接收')}`};renderers['receive-list']=receiveList;
renderers['material-receive']=()=>{const r=inputReceipts[cap]||inputReceipts.染色;return `${heading(r.id,'待本厂实收')}<section class="panel">${product(r.key)}</section>${panel(kv('来自',r.from)+kv('交给',r.target)+kv('本批应收',r.qty+' '+r.unit))}${textfield('code','核对'+r.kind+'码','扫描 '+r.code,true)}${num('qty','本次实收',r.unit)}${textfield('position','实际接收库位','扫描 A03',true)}${check('difference','已核对本次实物及数量')}${cap==='特殊工艺'?check('ticketChecked','已逐票点收，核对上一工艺完成'):''}${cap==='裁剪'?note('当前节点 2 卷整体接收。'):''}`};
renderers['task-detail']=()=>{const id=viewTask,p=currentPage(cap,id);return `${heading(id,closed[id]?'已完单':'本单作业')}<section class="panel">${product(['KT-082','PK-082'].includes(id)?'rib':objectKey())}</section>${work.waterPaused&&id==='SR-001'?note('异常结束已记录，等待有权人员处理；未放行前不能交出。'):''}${p!=='task-detail'&&!closed[id]?`<button class="primary" data-task-open="${id}">${catalog.find(x=>x[0]===p)?.[1]||'继续加工'}</button>`:''}${id==='XH-001'&&work.specialRemaining===0?note('本批数量已归类：完成 '+work.specialDone+' 片，损坏 '+(20-work.specialDone)+' 片。损坏原因随本次记录保留。','info')+`<button class="choose-row" data-action="records">查看本单记录 ${I('next')}</button>`:''}${heading('可交批次')}${batchCards(id)||note('当前没有可交实物。','info')}${heading('本单交接')}${handoverCards(id)||'<p class="muted">尚未登记交出。</p>'}${id==='HJ-008'?note('不外发片按对应件数自动衔接；外发片仍逐部位交出。','info'):''}${['HJ-008','FP-011','RS-002','PH-008','WS-001','SR-001'].includes(id)?`<button class="choose-row" data-go="complete-order">核对完单条件 ${I('next')}</button>`:''}${['XH-001','KT-082','PK-082','SR-001'].includes(id)?`<button class="choose-row" data-go="complete-handout">结束本单交出 ${I('next')}</button>`:''}`};
function selectedH(){return handovers.find(h=>h.id===activeHandover)}
renderers['handover-detail']=()=>{const h=selectedH();if(!h)return note('先从本单交接记录打开一笔交出。');return `${heading(h.id,h.state)}<section class="panel">${product(h.image)}</section>${panel(kv('实物',h.code)+kv('交出方','中央工厂 · '+h.cap)+kv('接收方',h.target)+kv('本次交出',`${h.qty} ${h.unit}`)+kv('交出人','Rina · 018')+kv('交出时间',h.time))}${h.actual===undefined?note('等待接收方点清实物并登记实收。','info'):panel(kv('对方实收',h.actual+' '+h.unit)+kv('与交出差异',fmt(h.actual-h.qty)+' '+h.unit)+kv('接收人',h.receiver)+kv('接收时间',h.receivedAt)+(h.location?kv('接收位置',h.location):''))}`};
renderers['handover-objection']=()=>renderers['handover-detail']();
function completionIssues(id){let a=[];const bs=batches(id),hs=transfers(id);if(closed[id])return ['本单已完成'];
 if(id==='HJ-008'&&work.knit<100)a.push('横机各 SKU 尚未达到计划 100 件');if(id==='FP-011'&&work.link<100)a.push('缝盘各 SKU 尚未达到计划 100 件');
 if(id==='RS-002'&&!work.dyeFinished)a.push('染色、后处理和包装尚未全部完成');if(id==='PH-008'&&!work.printOutput)a.push('面料尚未完成实际产出');if(id==='WS-001'&&!work.washOutput)a.push('本卷尚未登记洗水实测产出');if(id==='SR-001'&&(!work.waterReady||work.waterPaused||work.waterDone<100))a.push('水溶尚未具备完成条件');
 if(bs.some(b=>b.qty>0))a.push('还有已加工实物未交出');if(!hs.length||hs.some(h=>h.actual===undefined))a.push('直接接收方尚未确认全部实收');
 return a;
}
renderers['complete-order']=()=>{const a=completionIssues(viewTask);return `${heading(viewTask,'完单核对')}${panel(kv('加工任务',viewTask)+kv('交出批次',transfers().length+' 批'))}${a.length?a.map(x=>note(x,closed[viewTask]?'good':'')).join(''):note('本单加工、交出与接收均满足完单条件。','good')}${viewTask==='WS-001'?'<p class="hint">洗水以每卷完成加工及下游实收为条件；已确认的实际数量变化保留。</p>':''}<p class="hint">完单后不再继续填报本加工单。</p>`};
function handoutBasis(id){return id==='XH-001'?20:id==='KT-082'?120:id==='PK-082'?200:id==='SR-001'?work.waterDone:0}
renderers['complete-handout']=()=>{const hs=transfers(),q=hs.reduce((s,h)=>s+h.qty,0),plan=handoutBasis(viewTask);return `${heading(viewTask,'交出结束核对')}${panel(kv('计划对象数量',plan)+kv('累计交出',fmt(q))+kv('待接收批次',hs.filter(h=>h.actual===undefined).length))}${note('结束后不能再新增本单交出；接收方仍可登记实收，数量异议仍可继续。','info')}<p class="hint">当前通用交出完成范围：计划的 80%–120%。加工单的完单条件另行核对。</p>`};
const oldHandoff=handoff;
handoff=()=>oldHandoff().replace(num('qty','本次交出',hand.unit,`最多 ${hand.qty} ${hand.unit}`),['洗水','裁剪'].includes(hand.cap)?panel(kv(hand.cap==='洗水'?'整卷交出':'整袋交出',hand.qty+' '+hand.unit))+note(hand.cap==='洗水'?'扫描实测后的卷码，按整卷交回。':'袋内有其他对象时，先按原流程拆袋重装。','info'):num('qty','本次交出',hand.unit,`最多 ${hand.qty} ${hand.unit}`));const handoffWithQuantity=handoff;handoff=()=>handoffWithQuantity()+(hand.cap==='裁剪'&&!work.cutReleased?note('本批尚未获得 PPIC 放行，当前不能交出。'):'');renderers.handoff=handoff;
const oldFinishing=finishing;finishing=()=>oldFinishing().replace(textfield('reason','未处理原因（有剩余时必填）'),textfield('reasonM','M 码未处理原因（有剩余时必填）')+textfield('reasonL','L 码未处理原因（有剩余时必填）'));renderers['process-finishing']=finishing;
renderers['finishing-recheck']=()=>`${heading('HZ-082 · 复核单 FH-082')}<section class="panel">${product('hoodie')}</section>${panel(kv('复核责任人','Rina · 018')+kv('本批已处理',`${work.postM??58} / ${work.postL??38} 件（M / L）`))}${num('m','M 码实际交出','件')}${textfield('mcode','M 码包装条码','扫描 SKU-082-M',true)}${num('l','L 码实际交出','件')}${textfield('lcode','L 码包装条码','扫描 SKU-082-L',true)}<p class="hint">条码不符需更换正确标签后重扫。品质检验仍按原流程完成。</p>`;
renderers['cutting-progress']=()=>`${heading('CJ-082 · 第03床','2 号裁床')}${panel(kv('已登记布卷',work.cutRolls.length+' 卷')+kv('实际铺布用量',fmt(work.clothUsed)+' 米')+kv('当前作业',['铺布中','裁剪中','裁剪已完成'][Math.min(work.cutStage,2)]))}${work.cutStage===0?`<button class="secondary" data-go="process-cutting">继续登记下一卷</button><p class="hint">本床铺布结束后，再确认开始裁剪。</p>`:work.cutStage===1?`${num('qty','实际裁剪数量','件')}${num('usage','实际用量','米')}${note('本床颜色、尺码及部位配比沿用已确认唛架。','info')}`:''}`;
renderers['cutting-tickets']=()=>`${heading('CJ-082 · 菲票与装袋')}<section class="panel">${product('hoodie')}</section>${panel(kv('本批产出',`${work.cutQty??24} 件对应裁片`)+kv('菲票','CJ082-Q1-01 · 前片 / M')+kv('本示例票内数量',`${work.cutQty??24} 片`))}${work.ticketPrinted?note('本票已确认打印。','good'):`<button class="secondary" data-v3="print-ticket">预览并确认打印菲票</button>`}${textfield('ticket','实物上的菲票码','扫描 CJ082-Q1-01',true)}${textfield('bag','装入中转袋','扫描 B082-03',true)}<p class="hint">按已编号、已打印的有效菲票装袋。每张菲票只装一次。</p>`;
renderers['cutting-inbound']=()=>`${heading('CJ-082 · B082-03','已装袋')}<section class="panel">${product('hoodie')}</section>${panel(kv('本袋实物',`${work.cutQty??24} 片 · 前片 / M`)+kv('本单接收方','指定车缝 A 厂'))}${textfield('bag','核对中转袋','扫描 B082-03',true)}${choose('locations',val('locations')||'扫描实际库位','本厂待交出仓')}<p class="hint">入仓后仍须满足 PPIC 裁片放行、接收工厂和整袋条件才能交出。</p>`;
const oldCut=cutting;cutting=()=>oldCut().replace('扫实际卷码','扫描 '+(work.cutRolls.length?'RJ-082-02':'RJ-082-01'))+`<p class="hint">${work.cutRolls.length?'已登记：'+work.cutRolls.map(r=>r.code).join('、'):'已接收；2 号裁床已选定。'}</p>`;renderers['process-cutting']=cutting;
const oldWater=water;water=()=>oldWater().replace(val('finishEarly')?textfield('reason','异常结束原因'):'', '').replace(check('finishEarly','本单异常结束'),check('finishEarly','数量不足，停止本次加工'))+textfield('reason','超计划 / 停止加工原因（适用时必填）');renderers['water-report']=water;
const oldBinding=binding;
binding=()=>oldBinding().replace(check('finishEarly','本规格少量结束'),'').replace(val('finishEarly')?textfield('reason','少量结束原因'):'','').replace("kv('本规格计划 / 已产出','120 / 60 米')",'')+`<button class="choose-row" data-go="binding-finish">核对本规格结束 ${I('next')}</button>`;renderers['binding-report']=binding;
renderers['binding-finish']=()=>{const spec=drafts['binding-report']?.spec||'领口捆条 · 2 cm',b=batches('KT-082').filter(x=>x.source.endsWith(spec)),q=b.reduce((s,x)=>s+x.total,0);return `${heading('KT-082 · '+spec)}${panel(kv('计划产出','120 米')+kv('实际已产出',q+' 米'))}${q<120?textfield('reason','少量结束原因'):''}${note('本规格结束后不能继续填产出；已产出的捆条仍需交出。','info')}`};
const oldBack=backTarget;backTarget=function(){if(screen==='material-receive')return 'receive-list';if(['handover-detail','handover-objection','complete-order','complete-handout'].includes(screen))return 'task-detail';return oldBack()};
const oldIssue=issue;issue=()=>oldIssue().replace(val('batch')==='RK-082-01'?'A03':'A04',stock[val('batch')]?.location||(val('batch')==='RK-082-01'?'A03':'A04'));renderers['warehouse-issue']=issue;
const oldMove=move;move=()=>oldMove().replace(kv('当前位置','A03'),kv('当前位置',work.bagLocation));renderers['warehouse-move']=move;
showRecords=function(warehouse=false){const rs=records.filter(r=>warehouse?r.page.startsWith('warehouse'):r.cap===cap);const labels={code:'实物码',position:'接收位置',locations:'实际位置',batch:'入仓批次',doc:'关联铺布单',reason:'操作原因',reasonM:'M 码未处理原因',reasonL:'L 码未处理原因',authorizedBy:'授权人',firstCount:'首次点数（M / L）',cones:'实收筒数',gross:'实称毛重',m:'M 码实际数',l:'L 码实际数'};sheet('本次操作记录',rs.length?rs.map(r=>panel(kv(r.title,r.qty)+Object.entries(labels).filter(([k])=>r.fields?.[k]).map(([k,v])=>kv(v,esc(r.fields[k]))).join('')+`<p class="muted">${r.time} · ${r.actor||'Rina · 018'}</p>`)).join(''):note('本次预览还没有完成记录。','info'));};
const originalRecalc=recalc;recalc=function(){originalRecalc();


};
const oldSubmit=submit, oldSave=save, oldGo=go, oldRender=render, oldLabel=submitLabel, oldScan=scan;
function logInline(t,message=''){records.unshift({page:screen,title:t,qty:'1 笔',time:new Date().toLocaleTimeString('zh-CN'),cap,actor:'Rina · 018',fields:structuredClone(D())});drafts[screen]={};delete draftDirty[screen];dirty=false;done=null;localFlash=message||t;render()}
function consumeAuth(scope){if(!auth||auth.scope!==scope||Date.now()>auth.expires||auth.snapshot!==JSON.stringify([n('m'),n('l')])||val('auth')!==auth.code)return setError('授权码无效、已过期或不属于本次操作。请由指定人员提供新的授权码。','auth');D().authorizedBy='Dewi · 指定授权人';D().firstCount=work.firstCounts.join(' / ');auth=null;return true}
function finishedPage(){const r=inputReceipts[cap];return received[screen]||screen==='receive-difference'&&received['receive-check']||screen==='material-receive'&&received[r?.id]||screen==='warehouse-putaway'&&work.putaway||screen==='warehouse-stocktake'&&work.stocktakeDone||screen==='wash-input'&&work.washStarted||screen==='wash-output'&&work.washOutput||screen==='dye-input'&&work.dyeStarted||screen==='dye-step'&&work.dyeFinished||screen==='print-transfer'&&work.printOutput||screen==='process-finishing'&&work.postProcessed||screen==='finishing-recheck'&&work.postChecked||screen==='cutting-inbound'&&work.cutStage>=4||screen==='cutting-tickets'&&work.cutStage>=3||screen==='binding-report'&&work.bindingClosed[val('spec')||'领口捆条 · 2 cm']||screen==='water-report'&&(work.waterReady||work.waterPaused)||closed[activeTask()]||closed['handout:'+activeTask()]}
submit=function(){
 if(done)return;if(scenario!=='normal')return oldSubmit();
 if(finishedPage())return setError('本次对象已处理，不能重复提交。返回本单查看下一步。');
 if(screen==='material-receive'){
 const r=inputReceipts[cap];if(!r)return setError('先在接收页选择工序。');if(!validCode('code',r.code)||!positive('qty','本次实收',r.unit==='片',r.unit==='片',r.qty)||!validLocation('position'))return;
 if(cap==='裁剪'&&n('qty')!==r.qty)return setError('本节点须整体接收，不能按部分数量上架。');
 delete D().reason;if(!val('difference')||cap==='特殊工艺'&&!val('ticketChecked'))return setError('先核对本次实物、实际数量及逐票接收责任。');received[r.id]=true;save('本批实收已记录',r.id+' · 实际存放 '+val('position'),n('qty')+' '+r.unit,'receive-list','返回接收');return;}
 if(screen==='handoff'){
 const b=outputs[hand.key];if(!b||b.qty<=0)return setError('本批已全部交出，不能重复交出。');if(closed['handout:'+viewTask])return setError('本单交出已结束，不能新增交出。');if(hand.cap==='裁剪'&&!work.cutReleased)return setError('本批裁片尚未获得 PPIC 放行，不能交出。');
 if(!validCode('code',b.code))return;const whole=['洗水','裁剪'].includes(b.cap);if(!whole&&!positive('qty','本次交出',!['yard','米','kg'].includes(b.unit),false,b.qty))return;
 const q=whole?b.qty:n('qty');b.qty-=q;balances[b.key]=b.qty;hand.qty=b.qty;
 const h={...b,id:'JH-'+String(handovers.length+1).padStart(3,'0'),qty:q,state:'待接收',time:new Date().toLocaleString('zh-CN')};handovers.unshift(h);activeHandover=h.id;
 save('本次已交出',`交给 ${b.target}，等待接收方实收。`,q+' '+b.unit,'handover-detail','查看本次交接');return;}
 if(screen==='handover-objection'){go('handover-detail',true);return;}
 if(screen==='complete-order'){const a=completionIssues(viewTask);if(a.length)return setError(a.join('；')+'。');closed[viewTask]=true;save('本加工单已完成',viewTask+' · 由 Rina 确认完成。','1 单','process-list','返回执行');return;}
 if(screen==='complete-handout'){const hs=transfers(),q=hs.reduce((s,h)=>s+h.qty,0),plan=handoutBasis(viewTask);if(closed['handout:'+viewTask])return setError('本单交出已经结束。');if(!plan||!hs.length||q<plan*.8||q>plan*1.2)return setError('累计交出须在本单计划的 80%–120% 范围内，并有实际交出记录。');if(viewTask==='SR-001'&&work.waterPaused)return setError('水溶异常尚未处理。');if(!val('endConfirmed')){sheet('结束本单交出',panel(kv('本单',viewTask)+kv('累计交出',fmt(q)))+note('结束后不能新增交出；对方实收和异议仍可继续。'),'<button class="primary" data-v3="confirm-handout-end">确认结束本单交出</button>');return;}closed['handout:'+viewTask]=true;save('本单交出已结束','仍保留接收方实收和数量异议。',fmt(q),'task-detail','查看本单');return;}
 if(screen==='process-finishing'){if(!positive('m','M 码已处理',true,true,58)||!positive('l','L 码已处理',true,true,38))return;if(n('m')<58&&!required('reasonM','M 码未处理原因')||n('l')<38&&!required('reasonL','L 码未处理原因'))return;work.postM=n('m');work.postL=n('l');work.postProcessed=true;save('加工数量归类已完成',`已处理 ${n('m')+n('l')} 件；未处理 ${96-n('m')-n('l')} 件，原因分别保留。`,n('m')+n('l')+' 件','finishing-recheck','核对数量与条码');return;}
 if(screen==='finishing-recheck'){if(!work.postProcessed)return setError('本批尚未完成加工数量归类。');if(!positive('m','M 码实交',true,true)||!positive('l','L 码实交',true,true)||!validCode('mcode','SKU-082-M')||!validCode('lcode','SKU-082-L'))return;
 delete D().reason;delete D().auth;work.postChecked=true;
 if(n('m')+n('l')>0)addOutput('后整',n('m')+n('l'),'件','HZ-082 · 复核批01','成品仓 · 本单指定收货方','HZ-082-B01','hoodie');save('数量条码已复核','已进入后道待交出仓，保留本批唯一出货单。',n('m')+n('l')+' 件','task-detail','查看本批出货');return;}
 if(screen==='process-cutting'){if(work.cutStage>0)return setError('本床已结束铺布，不能再登记本床布卷。');const code=String(val('roll')).trim();if(!['RJ-082-01','RJ-082-02'].includes(code))return setError('布卷不属于本床已接收物料。','roll');if(work.cutRolls.some(r=>r.code===code))return setError('本卷已登记，不能重复计入用布。');if(!positive('layers','层数',true)||!positive('length','每层长度')||!positive('head','布头',false,true)||!positive('tail','布尾',false,true))return;const q=n('layers')*n('length')+n('head')+n('tail');work.cutRolls.push({code,qty:q});work.clothUsed+=q;save('本卷铺布已登记','可继续下一卷，或结束本床铺布。',fmt(q)+' 米','cutting-progress','返回本床作业');return;}
 if(screen==='cutting-progress'){if(!work.cutRolls.length)return setError('至少登记一卷后才能结束铺布。');if(work.cutStage===0){work.cutStage=1;logInline('本床铺布已结束','铺布已结束，现场开始裁剪后确认。');return;}if(!work.cutStarted){work.cutStarted=true;logInline('本床裁剪已开始');return;}if(!positive('qty','实际裁剪数量',true)||!positive('usage','实际用量'))return;work.cutQty=n('qty');work.cutUsage=n('usage');work.cutStage=2;save('本床裁剪已记录','按本床既有尺码和部位配比形成实际菲票对象。',n('qty')+' 件','cutting-tickets','核对菲票并装袋');return;}
 if(screen==='cutting-tickets'){if(work.cutStage!==2)return setError('本床未完成裁剪或已装袋。');if(!work.ticketPrinted)return setError('先按本床已编号菲票打印并贴到实物。');if(!validCode('ticket','CJ082-Q1-01')||!validCode('bag','B082-03'))return;work.cutStage=3;save('本批菲票已装袋','B082-03 · 每张菲票与袋号关联。',work.cutQty+' 片','cutting-inbound','存入待交出仓');return;}
 if(screen==='cutting-inbound'){if(work.cutStage!==3||!validCode('bag','B082-03')||!validLocation())return;work.cutStage=4;addOutput('裁剪',work.cutQty,'片','CJ-082 · 前片 / M · B082-03','本单指定车缝 A 厂','B082-03','hoodie');save('本袋已入仓','存放 '+val('locations')+'；需满足 PPIC 放行后整袋交出。',work.cutQty+' 片','task-detail','查看本袋交出');return;}
 if(screen==='binding-finish'){const spec=drafts['binding-report']?.spec||'领口捆条 · 2 cm',q=batches('KT-082').filter(b=>b.source.endsWith(spec)).reduce((s,b)=>s+b.total,0);if(work.bindingClosed[spec])return setError('本规格已经结束。');if(q<=0)return setError('本规格还没有实际产出。');if(q<120&&!required('reason','少量结束原因'))return;work.bindingClosed[spec]=true;viewTask='KT-082';save('本规格加工已结束','已产出捆条继续保留交出责任。',q+' 米','task-detail','查看可交捆条');return;}
 if(screen==='special-report'){
 if(!validCode('ticket','FP-Q1-001')||!positive('qty','本次完成',true,true,work.specialRemaining))return;
 const loss=val('loss')?n('scrap')+n('damage'):0;
 if(val('loss')&&(!positive('scrap','报废数量',true,true)||!positive('damage','货损数量',true,true)))return;
 if(n('qty')+loss>work.specialRemaining)return setError('完成、报废与货损合计不能超过剩余 '+work.specialRemaining+' 片。');
 if(n('qty')+loss<=0)return setError('本次没有完成或损坏数量，请核对。');
 if(loss>0&&!required('reason','损坏原因'))return;const q=n('qty');work.specialDone+=q;work.specialRemaining-=q+loss;viewTask='XH-001';
 if(q>0)addOutput('特殊工艺',q,'片','XH-001 · Q / 第1片 · 批'+(records.length+1),'下一工艺 · 曲牙绣','FP-Q1-001','wool');
 save('本批加工实数已记录',loss?'完成 '+q+' 片；报废 '+n('scrap')+' 片；货损 '+n('damage')+' 片。原因与菲票保留。':'仅交出实际完成的实物。',q+' 片',q?'handoff':'task-detail',q?'核对本批交出':'查看本单异常');return;
 }
 if(screen==='water-report'){if(!positive('qty','累计完成',true,false,120))return;if(n('qty')<=work.waterDone)return setError('累计完成须大于已记录的 '+work.waterDone+' 件。');if(val('finishEarly')){if(!required('reason','异常结束原因'))return;work.waterPaused=true;work.waterDone=n('qty');viewTask='SR-001';save('水溶异常已记录','未自动批准按实际量结束，等待有权人员处理。',n('qty')+' 件累计','task-detail','查看本单');return;}if(n('qty')>100&&!required('reason','超计划原因'))return;if(n('qty')>100&&!val('overConfirmed')){sheet('核对超计划数量',note('累计 '+n('qty')+' 件，计划 100 件，实际投入 120 件。'),'<button class="primary" data-action="confirm-water-over">确认按实际数量记录</button>');return;}work.waterDone=n('qty');viewTask='SR-001';if(work.waterDone>0){work.waterReady=true;const already=batches('SR-001').reduce((s,b)=>s+b.total,0);addOutput('特殊工艺',work.waterDone-already,'件','SR-001 · 水溶完成','路线指定接收方 · 后整','SR-001-B01','wool');save('水溶完成已记录','本单按累计实物形成可交量。',work.waterDone+' 件','task-detail','查看本单交出');}else save('水溶进度已记录','未达到本单加工完成条件，可继续加工。',work.waterDone+' 件累计','water-report','继续水溶');return;}
 if(screen==='warehouse-move'&&val('locations')===work.bagLocation)return setError('目标与原库位相同，无需移库。');
 if(screen==='warehouse-issue'&&val('batch')){const s=stock[val('batch')];if(!positive('qty','实际领用',false,false,s.qty)||!positive('rolls','领用卷数',true,false,s.rolls))return;if((n('qty')===s.qty)!==(n('rolls')===s.rolls))return setError('清空本批长度时应核对全部卷数；仍有长度的余卷不能记为 0 卷。');}
 if(screen==='print-run'&&work.printDone)return setError('本次打印已完成，请继续本单转印。');
 if(screen==='print-transfer'&&work.transferStarted&&n('rolls')!==1)return setError('当前逐卷登记，只能记录这一卷；其他卷需逐卷识别。','rolls');

 return oldSubmit();
};
save=function(t,m,q,next,label){if(scenario!=='normal')return oldSave(t,m,q,next,label);
 if(['receive-check','yarn-receive','piece-receive'].includes(screen))received[screen]=true;if(screen==='receive-difference')received['receive-check']=true;
 if(screen==='piece-receive')work.linkMax=Math.min(100,work.linkMax+n('qty'));
 if(screen==='dye-step'&&next==='handoff'&&work.dyeOutput===0){work.dyeFinished=true;}
 if(screen==='dye-input')work.dyeStarted=true;if(screen==='dye-step'&&next==='handoff')work.dyeFinished=true;
 if(screen==='print-transfer'&&next==='handoff')work.printOutput=true;if(screen==='wash-output')work.washOutput=true;
 if(screen==='warehouse-putaway'){work.putaway=true;stock['RK-082-03']={qty:100,rolls:2,location:val('locations')};}
 if(screen==='warehouse-return'){const id='RETURN-'+(records.length+1);stock[id]={qty:n('qty'),rolls:n('rolls'),location:val('locations')};}
 if(screen==='warehouse-move')work.bagLocation=val('locations');
 if(screen==='warehouse-issue')m=val('batch')+' · 从 '+(stock[val('batch')].location||(val('batch')==='RK-082-01'?'A03':'A04'))+' 领出，用于 CJ-082。';if(screen==='warehouse-stocktake')work.stocktakeDone=true;
 if(screen==='knit-report'||screen==='link-report'||screen==='special-report'&&n('qty')>0||screen==='binding-report'||screen==='loop-report')viewTask=hand.task;
 // Routine stage actions stay on the working screen; handovers keep their explicit result.
 if(screen==='dye-step'&&next==='dye-step'){logInline(t);return true;}
 return oldSave(t,m,q,next,label);
};
submitLabel=function(){return {'material-receive':'确认本批实收','task-detail':'返回执行','handover-detail':'返回本单','handover-objection':'返回本单','complete-order':'确认本加工单完成','complete-handout':'结束本单交出','finishing-recheck':'确认数量与条码','cutting-progress':work.cutStage===0?'结束本床铺布':!work.cutStarted?'开始本床裁剪':'记录实际裁剪产出','cutting-tickets':'确认菲票装袋','cutting-inbound':'确认本袋入仓','binding-finish':'确认本规格结束'}[screen]||oldLabel()};
go=function(id,force=false){if(dirty)draftDirty[screen]=true;const from=screen;if(done&&id!==screen){drafts[screen]={};delete draftDirty[screen];}oldGo(id,force);if(screen!==from||force){dirty=!!draftDirty[screen];if(!done)localFlash='';renderedPage='';render();}};
render=function(){const same=renderedPage===screen,scroll=same?$('#content')?.scrollTop||0:0;const focus=document.activeElement?.id,sel=document.activeElement?.selectionStart;oldRender();renderedPage=screen;
 if(localFlash&&!done)$('#content').insertAdjacentHTML('afterbegin',note(esc(localFlash),'good'));

 if(screen==='cutting-progress'&&work.cutStage===1&&!work.cutStarted&&!done){$('#content').querySelectorAll('.field').forEach(e=>e.remove());}
 if(!done&&finishedPage()){$('#content').insertAdjacentHTML('afterbegin',note('本次对象已处理，重新提交不会重复记录。','good'));const b=$('.footer .primary');if(b){b.textContent='返回本单 / 记录';b.dataset.action='v3-return';}}
 if(!done&&['task-detail','handover-detail'].includes(screen)){const b=$('.footer .primary');b.dataset.action='v3-return';b.className='secondary';}
 if(!done&&screen==='complete-order'&&completionIssues(viewTask).length){const b=$('.footer button');b.textContent='查看未完成项';b.className='secondary';}
 if(same)$('#content').scrollTop=scroll;if(same&&focus&&$('#'+focus)&&document.activeElement?.id!==focus){$('#'+focus).focus({preventScroll:true});if(typeof sel==='number')try{$('#'+focus).setSelectionRange(sel,sel)}catch{}}
 recalc();$('#review-receipt')?.remove();$('.review-notes').insertAdjacentHTML('beforeend',`<div id="review-receipt" class="note-box"><b>责任方场景 · 仅评审</b><p>这些按钮模拟另一责任方的独立记录，不属于员工 PDA。</p><button data-v3="review-received">模拟接收方收齐</button><button data-v3="review-difference">模拟接收方少收</button><button data-v3="review-auth">生成本次授权样例</button><button data-v3="review-release">模拟本批 PPIC 已放行</button><div id="review-state" class="fine"></div></div>`);
};
scan=function(k,code){const extra={mcode:'SKU-082-M',lcode:'SKU-082-L',bag:'B082-03',ticket:screen==='cutting-tickets'?'CJ082-Q1-01':'FP-Q1-001',roll:screen==='process-cutting'?(work.cutRolls.length?'RJ-082-02':'RJ-082-01'):undefined,code:screen==='material-receive'?inputReceipts[cap]?.code:undefined,entry:screen==='receive-list'?inputReceipts[cap]?.id:undefined};oldScan(k,code||extra[k]);$('#overlay .scan-demo')?.remove();};
const oldScanConfirm=scanConfirm;scanConfirm=function(v){if(scanConfig?.key==='entry'&&screen==='process-list')viewTask=taskIds[cap];if(scanConfig?.key==='entry'&&screen==='receive-list'&&received[inputReceipts[cap]?.id||receivePage(cap)]){$('#scan-error').textContent='本次来货已经接收，不能重复接收。';return;}return oldScanConfirm(v)};
const oldSelection=selection;selection=function(k){
 if(k==='batch'){sheet('选择入仓批次',Object.entries(stock).map(([id,s])=>`<button class="choose-row" data-option="batch" data-value="${id}"><span>${id}<small>${s.location||(id==='RK-082-01'?'A03':'A04')} · ${fmt(s.qty)} yard / ${s.rolls} 卷</small></span>${I('next')}</button>`).join('')+'<div id="option-error" class="error"></div>');return;}
if(k==='locations'){if(locationDraft===null)locationDraft=String(val('locations')).split('、').filter(Boolean);const before=val('locations');D().locations=locationDraft.join('、');oldSelection(k);D().locations=before;return;}return oldSelection(k)};
const oldClose=closeSheet;closeSheet=function(){locationDraft=null;oldClose()};
document.addEventListener('input',e=>{if(e.target.dataset.field)draftDirty[screen]=true});
document.addEventListener('change',e=>{if(e.target.dataset.machine||e.target.dataset.field)draftDirty[screen]=true;if(e.target.id==='proof-input'){D().proofName=e.target.files[0]?.name||'';dirty=true;draftDirty[screen]=true;render()}});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 const stop=()=>{e.stopImmediatePropagation();e.preventDefault()};
 if(b.dataset.location){stop();const v=b.dataset.location;if(!['B05','B07'].includes(v)){$('#location-error').textContent=v==='B06'?'B06 已占用，请换位置。':'该库位不属于本厂。';return;}locationDraft=locationDraft||[];locationDraft=screen==='warehouse-move'?[v]:locationDraft.includes(v)?locationDraft.filter(x=>x!==v):[...locationDraft,v];selection('locations');return;}
 if(b.dataset.action==='locations-confirm'){stop();if(!locationDraft?.length){$('#location-error').textContent='至少选择一个实际库位。';return;}D().locations=locationDraft.join('、');dirty=true;draftDirty[screen]=true;closeSheet();render();return;}
 if(b.dataset.action==='discard'){delete draftDirty[screen];}
 if(b.dataset.action==='result-next'){delete draftDirty[screen];if(screen!=='print-run')drafts[screen]={};}
 if(b.dataset.action==='v3-return'){stop();if(screen==='handover-detail'){go('task-detail');return;}if(screen==='task-detail'){go('process-list');return;}go(screen.startsWith('warehouse')?'warehouse-home':['receive-check','receive-difference','yarn-receive','piece-receive','material-receive'].includes(screen)?'receive-list':'task-detail');return;}
 if(b.dataset.review==='reset'){stop();if(dirty){setError('先提交或放弃当前填写，再重新载入示例。');return;}location.reload();return;}
 if(b.dataset.taskOpen||b.dataset.taskDetail){stop();viewTask=b.dataset.taskOpen||b.dataset.taskDetail;cap=taskCap(viewTask);go(b.dataset.taskDetail?'task-detail':currentPage(cap,viewTask));return;}
 if(b.dataset.batchOpen){stop();openBatch(b.dataset.batchOpen);return;}if(b.dataset.handoverOpen){stop();activeHandover=b.dataset.handoverOpen;viewTask=selectedH().task;go('handover-detail');return;}
 if(b.dataset.go==='complete-order'||b.dataset.go==='complete-handout'){viewTask=activeTask();}
 if(b.dataset.option==='spec'&&b.dataset.value!==(val('spec')||'领口捆条 · 2 cm')){D().qty='';localFlash='规格已更换，重新填写本次产出。';}
 if(b.dataset.option==='batch'&&val('batch')&&b.dataset.value!==val('batch')){D().qty='';D().rolls='';localFlash='入仓批次已更换，重新填写本次领用。';}
 if(b.dataset.option||b.dataset.set||b.dataset.choice==='loss'){draftDirty[screen]=true;}
 const a=b.dataset.v3;if(!a)return;stop();
 if(a==='print-ticket'){sheet('核对菲票打印',panel(kv('菲票','CJ082-Q1-01')+kv('对象','CJ-082 · 前片 / M')+kv('数量',(work.cutQty??24)+' 片'))+note('设计预览不连接打印机；确认表示样例已打印并贴到对应实物。','info'),'<button class="primary" data-v3="ticket-printed">已打印并核对实物</button>');}
 if(a==='ticket-printed'){work.ticketPrinted=true;closeSheet();render();}
 if(a==='confirm-handout-end'){D().endConfirmed=true;closeSheet();submit();}
 if(a==='review-received'||a==='review-difference'){const h=selectedH()||transfers()[0];if(!h){$('#review-state').textContent='先完成一次本单交出。';return;}if(h.actual!==undefined){$('#review-state').textContent='这笔实收已记录，不能覆盖；可用另一笔交出查看其他场景。';return;}h.actual=a==='review-received'?h.qty:Math.max(0,h.qty-1);h.receiver='Sari · 接收方责任人';h.receivedAt=new Date().toLocaleString('zh-CN');h.location='接收仓 B05';h.reason='';h.state=h.actual===h.qty?'双方已交接':'有差异';if(h.task==='SR-001'&&h.actual===h.qty&&work.waterDone<100&&batches('SR-001').every(b=>!b.qty))work.waterReady=false;render();$('#review-state').textContent='已模拟接收方独立确认；原交出数量保持。';}
 if(a==='review-auth'){auth={scope:screen,code:'AUTH-3018',expires:Date.now()+30000,snapshot:JSON.stringify([n('m'),n('l')])};$('#review-state').textContent='指定人员授权样例 AUTH-3018，30 秒内有效；仅限当前动作。';}
 if(a==='review-release'){work.cutReleased=true;$('#review-state').textContent='样例 CJ-082 / B082-03 已由 PPIC 放行。';}
},true);
// Direct review links show an eligible fixture; ordinary task navigation never skips a gate.
if(['task-detail','complete-order','complete-handout'].includes(screen)){viewTask=params.get('task')||taskIds[cap];cap=taskCap(viewTask)}
if(screen==='finishing-recheck'){work.postProcessed=true;work.postM=58;work.postL=38;viewTask='HZ-082'}
if(['cutting-progress','cutting-tickets','cutting-inbound'].includes(screen)){work.cutRolls=[{code:'RJ-082-01',qty:84.8}];work.clothUsed=84.8;work.cutQty=24;work.cutStage=screen==='cutting-progress'?0:screen==='cutting-tickets'?2:3;}
if(['handoff','handover-detail','handover-objection'].includes(screen)){viewTask='FP-011';cap='毛织';hand={...batches(viewTask)[0]};if(screen!=='handoff'){handovers.push({...hand,id:'JH-EXAMPLE-01',qty:20,state:screen==='handover-objection'?'有差异':'待接收',time:'2026/10/17 09:20',...(screen==='handover-objection'?{actual:19,receiver:'Sari · 接收方责任人',receivedAt:'2026/10/17 09:28'}:{})});outputs[hand.key].qty-=20;balances[hand.key]=outputs[hand.key].qty;activeHandover='JH-EXAMPLE-01';}}
if(screen==='material-receive')cap='洗水';
if(screen==='binding-finish')viewTask='KT-082';
// Boot once after the complete V4 design is installed.
