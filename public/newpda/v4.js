'use strict';
// V4 standalone design. Source contracts remain in app.js/v3.js; no business API.
catalog.find(x=>x[0]==='handoff')[1]='交出本批实物';
const operations = [
 ...['毛织','染色','印花','洗水','裁剪','后整'].map(name=>({name,group:'基础工序',cap:name,task:taskIds[name]})),
 {name:'水溶',group:'基础工序',cap:'特殊工艺',task:'SR-001'},
 {name:'捆条',group:'裁床工序',cap:'特殊工艺',task:'KT-082'},
 ...['绣花','打条','压褶','打揽','烫画','直喷','贝壳绣','曲牙绣','一字贝绣花','布包扣','打褶','烫钻'].map(name=>({name,group:'辅助工艺',cap:'特殊工艺',task:name==='绣花'?'XH-001':name==='盘扣'?'PK-082':null})),
 ...['模板工序','激光开袋','特种车缝（花样机）','橡筋定长切割'].map(name=>({name,group:'特种工艺',cap:'特殊工艺',task:null})),
 ...['盘扣','花朵','织带／绳子截断','织带／绳子打头','花边生产'].map(name=>({name,group:'辅料厂',cap:'特殊工艺',task:null}))
];
let selectedOp = params.get('op') || (screen.startsWith('binding')?'捆条':screen==='loop-report'?'盘扣':screen==='water-report'?'水溶':cap==='特殊工艺'?'绣花':cap);
let unavailableOperation=!operations.some(o=>o.name===selectedOp);
if(unavailableOperation){selectedOp='毛织';cap='毛织';screen='process-list';}
const opInfo=()=>operations.find(o=>o.name===selectedOp);
const opForTask=id=>operations.find(o=>o.task===id);
const executionPages=new Set(['knit-report','knit-machine','link-report','dye-input','dye-step','print-test','print-run','print-transfer','wash-input','wash-output','special-report','binding-report','binding-finish','loop-report','water-report','process-finishing','finishing-recheck','process-cutting','cutting-progress','cutting-tickets','cutting-inbound','task-detail','handoff','handover-detail','handover-objection','complete-order','complete-handout']);
let taskWorkspace=executionPages.has(screen), taskFlash='', operationSearch='', pendingOperation=null, lastReceiptOnly=false;
const v4Render=render,v4Go=go,v4Save=save,v4Submit=submit,v4Label=submitLabel,v4Recalc=recalc,v4ScanConfirm=scanConfirm;
const v4TaskDetail=renderers['task-detail'];
const v4TaskPage=currentPage;
function applyOperation(name){const o=operations.find(x=>x.name===name);if(!o)return;unavailableOperation=false;selectedOp=name;cap=o.cap;viewTask=o.task||'';closeSheet();error='';done=null;localFlash='';taskWorkspace=false;render();}
function pickOperation(){operationSearch='';sheet('选择一道工序',`<div class="input-box"><input id="operation-search" class="code" aria-label="查找工序" placeholder="查找工序" autocomplete="off"></div><div id="operation-options">${operationOptions('')}</div>`);}
function operationOptions(q){const matches=o=>!q||o.name.includes(q)||(document.querySelector('.device')?.lang==='id'&&window.pdaTranslate?.(o.name).toLocaleLowerCase('id').includes(q.toLocaleLowerCase('id')));const item=(o,label=o.name)=>`<button data-op="${o.name}" class="${o.name===selectedOp?'selected':''}">${label}</button>`;return [...new Set(operations.map(o=>o.group))].map(g=>{const a=operations.filter(o=>o.group===g&&matches(o));if(!a.length)return '';if(g!=='辅料厂')return `<h4 class="op-group">${g}</h4><div class="cap-grid">${a.map(o=>item(o)).join('')}</div>`;const ribbon=a.filter(o=>o.name.startsWith('织带'));return `<h4 class="op-group">辅料厂</h4><div class="cap-grid accessory-categories">${['盘扣','花朵'].map(n=>a.find(o=>o.name===n)).filter(Boolean).map(o=>item(o)).join('')}${ribbon.length?`<details class="op-subgroup" ${q?'open':''}><summary>织带</summary><div>${ribbon.map(o=>item(o,o.name.replace('织带／绳子',''))).join('')}</div></details>`:''}${a.filter(o=>o.name==='花边生产').map(o=>item(o,'花边')).join('')}</div>`;}).join('')||note('没有匹配的工序。','info');}
renderers['process-list']=()=>{const o=opInfo();return `${o.task?scanEntry('扫任务 / 输编号'):''}${heading(selectedOp+'任务',o.task?'1 笔':'0 笔')}${o.task?taskCard(o.task,o.cap).replace(/<button class="textline task-link"[\s\S]*?<\/button>/,''):note('当前没有分配到'+selectedOp+'的任务。','info')}`;};
const v4ReceiveList=renderers['receive-list'];
renderers['receive-list']=()=>{const o=opInfo();if(!o.task)return `${heading(selectedOp+'待接收','0 笔')}${note('当前没有'+selectedOp+'的待接收实物。','info')}`;
 if(['KT-082','PK-082','SR-001'].includes(o.task))return `${heading(selectedOp+'待接收','0 笔')}${note('本示例任务的投入已经接收。','info')}`;
 return v4ReceiveList();};

function receiptInline(id=viewTask){const hs=transfers(id);if(!hs.length)return '';return `<section class="receipt-section" aria-label="本单交出与实收">${heading('交出与实收',hs.length+' 笔')}${hs.map((h,i)=>`<article class="receipt-card"><div class="receipt-top"><b>${h.id}</b><span class="pill ${h.actual===h.qty?'ready':h.actual!==undefined?'warn':''}">${h.state}</span></div>${kv('交给',esc(h.target))}<div class="receipt-qty"><div><small>我方交出</small><strong>${fmt(h.qty)} <small>${h.unit}</small></strong></div><div><small>对方实收</small><strong>${h.actual===undefined?'待点收':fmt(h.actual)+' <small>'+h.unit+'</small>'}</strong></div></div>${h.actual!==undefined&&h.actual!==h.qty?note('差异 '+fmt(h.actual-h.qty)+' '+h.unit+' · '+esc(h.reason||'原因待核对')):''}<details class="receipt-details" ${i===0&&h.actual!==undefined?'open':''}><summary>交接责任与记录</summary>${kv('实物',esc(h.code))}${kv('交出人','Rina · 018')}${kv('交出时间',esc(h.time))}${h.actual!==undefined?kv('接收人',esc(h.receiver))+kv('接收时间',esc(h.receivedAt))+kv('接收位置',esc(h.location||'随接收记录')):'<p class="hint">由接收方点清实物后登记。</p>'}</details>${h.objection?note('异议已提交：'+esc(h.objection)):h.actual!==undefined&&h.actual!==h.qty?`<button class="textline" data-v4-objection="${h.id}">对实收提出异议</button>`:''}</article>`).join('')}</section>`;}
const v4LogInline=logInline;logInline=function(t,m){v4LogInline(t,m);if(records[0]){records[0].task=viewTask;records[0].operation=selectedOp;}};
const v4Records=showRecords;
showRecords=function(warehouse=false){if(warehouse)return v4Records(true);const rs=records.filter(r=>taskWorkspace?r.task===viewTask:r.operation===selectedOp);sheet('本单操作记录',rs.length?rs.map(r=>panel(kv(esc(r.title),esc(r.qty))+kv('操作人',r.actor||'Rina · 018')+kv('记录时间',r.time)+(r.fields?.reason?kv('原因',esc(r.fields.reason)):'')+(r.fields?.authorizedBy?kv('授权人',esc(r.fields.authorizedBy)):''))).join(''):note('本次预览还没有该任务的操作记录。','info'));};
renderers['task-detail']=()=>{if(!taskWorkspace)return v4TaskDetail();const p=currentPage(cap,viewTask),bs=batches().filter(b=>b.qty>0);return `${taskFlash?note(esc(taskFlash),'good'):''}${receiptInline()}${bs.length?heading('本单待交实物')+batchCards(viewTask):''}${p!=='task-detail'&&p!=='complete-order'&&!closed[viewTask]?`<button class="choose-row" data-v4-continue="${p}"><span>继续${selectedOp}<small>登记下一批实际作业</small></span>${I('next')}</button>`:''}${viewTask==='SR-001'&&work.waterPaused?note('数量不足已记录，待有权人员处理后继续。'):''}<details class="task-more"><summary>本单记录与结束条件</summary><button class="choose-row" data-action="records">查看加工记录 ${I('next')}</button>${['HJ-008','FP-011','RS-002','PH-008','WS-001','SR-001'].includes(viewTask)?'<button class="choose-row" data-go="complete-order">核对完单条件</button>':''}${['XH-001','KT-082','PK-082','SR-001'].includes(viewTask)?'<button class="choose-row" data-go="complete-handout">核对并结束本单交出</button>':''}</details>`;};
const washV3=renderers['wash-output'];
renderers['wash-output']=()=>washV3().replace(check('difference','数量变化已核对，按本次实测记录'),'');
const materialV3=renderers['material-receive'];
renderers['material-receive']=()=>materialV3().replace(check('difference','已核对本次实物及数量'),'');
const loopV3=renderers['loop-report'];
renderers['loop-report']=()=>loopV3().replace('投入菲票','已收捆条菲票').replace('KT-082-01 · 已接收','KT-082-01 · 1 张').replace('已产出 / 可交出','计划 / 已产出').replace('80 / 80 个','200 / '+batches('PK-082').reduce((s,b)=>s+b.total,0)+' 个')+note('本单交回中央辅料仓。','info');
for(const b of batches('PK-082'))b.target='中央辅料仓';
const v4AddOutput=addOutput;
addOutput=function(c,q,u,s,t,code,img){if(s.startsWith('PK-082'))t='中央辅料仓';v4AddOutput(c,q,u,s,t,code,img);};setupHand=addOutput;

function setStep(p){screen=p;done=null;error='';dirty=!!draftDirty[p];taskWorkspace=true;renderedPage='';render();}
function openTask(id){const o=opForTask(id);if(!o)return;selectedOp=o.name;cap=o.cap;viewTask=id;taskWorkspace=true;taskFlash='';lastReceiptOnly=false;setStep(currentPage(cap,id));}
function taskUrl(){const url=new URL(location.href);url.searchParams.set('screen',taskWorkspace?'task-work':screen);url.searchParams.set('v','5');url.searchParams.set('op',selectedOp);if(taskWorkspace){url.searchParams.set('task',viewTask);url.searchParams.set('step',screen);}else{url.searchParams.delete('step');url.searchParams.delete('task');}history.replaceState({},'',url);}
go=function(id,force=false){if(dirty&&!force){v4Go(id,false);return;}const was=screen;if(id==='warehouse-home'){cap=opInfo().cap;taskWorkspace=false;}else if(['receive-list','process-list'].includes(id)){cap=opInfo().cap;viewTask=opInfo().task||'';taskWorkspace=false;}else if(executionPages.has(id)){taskWorkspace=true;if(screen.startsWith('cw-')||screen.startsWith('warehouse')){const o=opForTask(viewTask);if(o){selectedOp=o.name;cap=o.cap;}}}else if(!executionPages.has(id))taskWorkspace=false;
 v4Go(id,force);if(screen!==was&&!['handoff','task-detail','handover-objection'].includes(screen))taskFlash='';taskUrl();};
save=function(t,m,q,next,label){const sourcePage=screen,within=taskWorkspace,sourceTask=viewTask;v4Save(t,m,q,next,label);if(!done)return;
 if(records[0]){records[0].task=sourceTask;records[0].operation=selectedOp;}
 if(!within&&!['receive-check','receive-difference','yarn-receive','piece-receive','material-receive'].includes(sourcePage))return;
 const result=done;done=null;dirty=false;delete draftDirty[sourcePage];drafts[sourcePage]={};error='';taskFlash=t+' · '+q;
 if(!within){screen='receive-list';localFlash=t+' · '+q;taskWorkspace=false;}
 else {localFlash='';if(sourcePage==='handoff'||sourcePage==='handover-objection'||sourcePage==='complete-handout'||sourcePage==='complete-order')screen='task-detail';
 else if(next==='task-detail'&&batches().some(b=>b.qty>0)&&sourcePage!=='binding-finish'){hand={...batches().filter(b=>b.qty>0).at(-1)};screen='handoff';drafts.handoff={};}
 else if(next==='process-list')screen='task-detail';else screen=next||sourcePage;
 taskWorkspace=true;lastReceiptOnly=sourcePage==='handoff';}
 renderedPage='';render();return result;};
submit=function(){if(screen==='wash-output'&&scenario==='normal')D().difference=true;
 if(screen==='material-receive'&&scenario==='normal')D().difference=true;
 if(screen==='complete-handout')D().endConfirmed=true;
 return v4Submit();};
submitLabel=function(){if(screen==='wash-output')return Number.isFinite(n('qty'))?'记录实测 '+fmt(n('qty'))+' yard':'记录本卷实测产出';if(screen==='complete-handout')return '确认结束本单交出';if(screen==='material-receive'&&Number.isFinite(n('qty')))return '确认实收 '+fmt(n('qty'))+' '+inputReceipts[cap].unit;return v4Label();};
recalc=function(){v4Recalc();if(['wash-output','material-receive'].includes(screen)&&!done){const b=$('.footer [data-action="submit"]');if(b)b.textContent=submitLabel();}};
render=function(){v4Render();const o=opInfo();
 if(['process-list','receive-list'].includes(screen)){$('.appbar .cap').innerHTML=esc(selectedOp)+I('down');}
 if(screen==='warehouse-home'){$('.appbar .cap').innerHTML=esc(selectedOp)+I('down');}
 if(taskWorkspace&&!done){$('.appbar h2').textContent=viewTask;$('.appbar .tag').textContent=selectedOp;
 if(!['task-detail','handover-detail'].includes(screen)){$('#content').insertAdjacentHTML('afterbegin',`<div class="work-stage"><b>${esc(catalog.find(x=>x[0]===screen)?.[1]||'当前作业')}</b>${screen==='handoff'?'<button data-v4-continue="'+currentPage(cap,viewTask)+'">继续加工</button>':''}</div>`+(taskFlash?note(esc(taskFlash),'good'):''));
 if(!['handoff','handover-objection','complete-order','complete-handout','binding-finish','knit-machine'].includes(screen)&&batches().some(b=>b.qty>0))$('#error').insertAdjacentHTML('beforebegin','<details class="task-more"><summary>已有可交实物</summary>'+batchCards(viewTask)+'</details>');
 if(screen!=='handover-objection'&&transfers().length)$('#error').insertAdjacentHTML('beforebegin',receiptInline());}
 if(screen==='task-detail'){$('.footer').innerHTML='<button class="secondary" data-go="process-list">返回任务列表</button>';}
 if(['handoff','handover-objection','complete-order','complete-handout'].includes(screen))$('.back').dataset.v4Back='task';else $('.back').dataset.v4Back='list';
 }
 if(screen==='receive-difference'){$('.appbar h2').textContent='核对接收';$('.appbar .tag').textContent='后整';}
 taskUrl();recalc();
};
// Scan gun input shares the visible field. Enter never submits a business action.
window.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-field]')){e.preventDefault();e.stopImmediatePropagation();e.target.blur();}},true);
window.addEventListener('input',e=>{if(e.target.id==='operation-search'){$('#operation-options').innerHTML=operationOptions(e.target.value.trim());}},true);
window.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const stop=()=>{e.preventDefault();e.stopImmediatePropagation();};
 if(b.dataset.action==='cap'){stop();pickOperation();return;}
 if(b.dataset.op){stop();if(dirty){pendingOperation=b.dataset.op;sheet('当前填写尚未提交',note('切换工序会放弃这次未提交的填写。'),'<button class="secondary" data-action="keep">继续填写</button><button class="primary" data-v4-discard-op>放弃填写并切换</button>');}else applyOperation(b.dataset.op);return;}
 if(b.hasAttribute('data-v4-discard-op')){stop();drafts[screen]={};delete draftDirty[screen];dirty=false;screen='process-list';applyOperation(pendingOperation);return;}
 if(b.dataset.taskOpen||b.dataset.taskDetail){stop();if(dirty)return setError('先完成或返回并放弃本次填写，再切换任务。');openTask(b.dataset.taskOpen||b.dataset.taskDetail);return;}
 if(b.dataset.batchOpen&&taskWorkspace){stop();if(dirty)return setError('本次填写尚未提交，先提交或返回。');hand={...outputs[b.dataset.batchOpen]};drafts.handoff={};setStep('handoff');return;}
 if(b.dataset.v4Continue){stop();if(dirty){go(b.dataset.v4Continue);return;}taskFlash='';setStep(b.dataset.v4Continue);return;}
 if(b.dataset.v4Objection){stop();if(dirty)return setError('先提交当前填写，再登记实收异议。');activeHandover=b.dataset.v4Objection;setStep('handover-objection');return;}
 if(b.dataset.v4Back){stop();go(b.dataset.v4Back==='list'?'process-list':'task-detail');return;}
 if(b.dataset.scan&&$('#f-'+b.dataset.scan)){stop();$('#f-'+b.dataset.scan).focus();return;}
 if(b.dataset.reviewPage){taskWorkspace=executionPages.has(b.dataset.reviewPage);const p=b.dataset.reviewPage;const o=operations.find(x=>x.cap===pageCap[p]);if(o)selectedOp=p.startsWith('binding')?'捆条':p==='loop-report'?'盘扣':p==='water-report'?'水溶':o.name;}
},true);
scanConfirm=function(v){if(scanConfig?.key==='entry'&&screen==='process-list'){const value=String(v??$('#scan-input').value).trim().toUpperCase();if(value!==opInfo().task){$('#scan-error').textContent='该任务不属于当前工序，核对工序和任务编号。';return;}closeSheet();openTask(value);return;}return v4ScanConfirm(v);};
const v4Scan=scan;scan=function(k,code){if(k==='entry'&&screen==='process-list')return v4Scan(k,opInfo().task);return v4Scan(k,code)};
if(params.get('screen')==='task-work'){const id=params.get('task')||opInfo().task;const o=opForTask(id);if(o){selectedOp=o.name;viewTask=id;cap=o.cap;screen=currentPage(cap,id);taskWorkspace=true;}}
if(screen==='warehouse-home')cap=opInfo().cap;
if(['receive-list','process-list'].includes(screen)){cap=opInfo().cap;viewTask=opInfo().task||'';taskWorkspace=false;}
if(taskWorkspace){const directTask={'binding-report':'KT-082','binding-finish':'KT-082','loop-report':'PK-082','water-report':'SR-001'}[screen]||viewTask;const o=opForTask(directTask);if(o){viewTask=directTask;selectedOp=o.name;cap=o.cap;}}
// Boot once after the complete V4 design is installed.
