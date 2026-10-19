'use strict';
// V14 shop-floor continuity across the existing, separate process demonstrations.
(()=>{
const prior=render;
const parked=new Map(); let discardTarget=null,handoffTarget=null,draftChoices=null;
const families={cf:()=>window.cuttingFlow,kl:()=>window.knitLinkFlow,dpw:()=>window.dyePrintWashFlow,pf:()=>window.postFlow,wb:()=>window.waterBindingFlow,asa:()=>window.auxSpecialAccessoryFlow};
function family(){return selectedOp==='裁剪'?'cf':selectedOp==='毛织'?'kl':['染色','印花','洗水'].includes(selectedOp)?'dpw':selectedOp==='后整'?'pf':['水溶','捆条'].includes(selectedOp)?'wb':'asa';}
function context(){const f=family(),s=families[f]();return {family:f,role:s.role,...window.pdaOperator,label:''};}
// Keep input continuation within the same person, operation and physical source.
window.pdaFloorInputKey=()=>{const f=family(),s=families[f]();const keys={cf:[s.node,s.bag,s.form?.batch,s.outMode,s.tool],kl:[s.stage,s.pair,s.sku,s.source,s.piece,s.stock,s.stockKind],dpw:[s.order,s.source,s.batch,s.form?.input],asa:[s.order,s.forms?.[s.order+':'+s.role+':'+s.view]?.source,s.forms?.[s.order+':'+s.role+':'+s.view]?.batch],wb:[s.source,s.spec],pf:[s.current,s.materialOpen,s.receivingOut]}[f];return JSON.stringify([f,selectedOp,screen,s.role,s.factory,s.view,...keys]);};
let identity=context();window.pdaCrossRoleBlocked=false;
function identityUI(){identity=context();window.pdaCrossRoleBlocked=false;window.pdaCurrentIdentity={...identity};$('#floor-identity')?.remove();$('#floor-account')?.remove();}

// V24: erased receiving, process and outgoing inputs are not unfinished operations.
// Keep explicit zero, selected location and changed tube counts; ignore source metadata.
function settleEmptyInput(e){
 if(!e.target.closest('#content')||window.pdaCrossRoleBlocked)return;
 const f=family(),s=families[f]();let form,fields,formKey;
 if(f==='kl'&&screen==='kl-receive'){form=s.form;fields=['qty','gross','location'];}
 else if(f==='dpw'&&screen==='dpw-receive'){form=s.form;fields=['qty','gross','location'];}
 else if(f==='asa'&&screen==='asa-task'&&s.view==='receive'){formKey=s.order+':'+s.role+':receive';form=s.forms[formKey]||{};fields=['qty','receiveMaterial',...(['辅助工艺','特种工艺'].includes(operations.find(o=>o.name===selectedOp)?.group)?[]:['loc']),...Object.keys(form).filter(k=>k.startsWith('receive-'))];}
 else if(f==='wb'&&screen==='wb-task'&&s.view==='receive'){formKey=[selectedOp,s.role,s.view,selectedOp==='水溶'?s.source:s.spec].join(':');form=s.forms[formKey]||{};fields=['qty','loc'];}
 else if(f==='pf'&&screen==='post-batch'&&s.role==='receive'&&s.current&&!s.batches[s.current]?.counts){form=s.batches[s.current].form;fields=Object.keys(form);}
 else if(['kl','dpw'].includes(f)&&screen===f+'-task'){form=s.form;fields=Object.keys(form).filter(k=>!['sourceVersion','stockVersion','version','inputVersion','newBatch','sourceCode','outCode','taskCode'].includes(k));if(f==='dpw'&&s.scanSet.length)return;}
 else if(f==='asa'&&screen==='asa-task'&&['work','out'].includes(s.view)){formKey=s.order+':'+s.role+':'+s.view;form=s.forms[formKey]||{};fields=Object.keys(form).filter(k=>!['source','batch','package','scan'].includes(k));}
 else if(f==='wb'&&screen==='wb-task'&&['work','out'].includes(s.view)){formKey=[selectedOp,s.role,s.view,selectedOp==='水溶'?s.source:s.spec].join(':');form=s.forms[formKey]||{};fields=['qty','rollQty','driver','vehicle','plate','rolls','scans','outCode'];}
 else return;
 const filled=v=>v!==undefined&&v!==null&&(Array.isArray(v)?v.length>0:String(v).trim()!=='');
 const hasInput=fields.some(k=>filled(form[k]))||(['kl','dpw'].includes(f)&&['paper','cone','pagoda'].some(k=>filled(form[k])&&Number(form[k])!==0));
 if(hasInput)return;
 dirty=false;
 if(f==='dpw'&&screen==='dpw-task'&&s.taskDrafts)delete s.taskDrafts[s.order+':'+s.role+':'+s.view];
 if(f==='kl'&&screen==='kl-task'&&s.taskDrafts)delete s.taskDrafts[[selectedOp,s.stage,s.pair,s.sku,s.role,s.view].join(':')];
 if(f==='asa'&&s.pendingDrafts)delete s.pendingDrafts[formKey];
 if(f==='wb')delete s.forms[formKey];
}
// Bubble after the individual process handlers; never redraw or move the typing cursor.
window.addEventListener('input',settleEmptyInput);

function draftAllowed(d){const id=d.order||d.ui?.order||d.object;if(d.family==='asa')return !auxSpecialAccessoryFlow.orders[id]?.closed;if(d.family==='dpw')return !dyePrintWashFlow.orders[id]?.closed;if(d.family==='wb'&&d.op==='水溶')return !waterBindingFlow.water.closed;return true;}
window.pdaFloorForgetOrder=function(f,id){if(['dpw','wb'].includes(f)){for(const [k,d]of parked)if(d.family===f&&(f==='wb'?d.op==='水溶'&&(d.order||d.ui?.order||waterBindingFlow.water.id)===id:(d.order||d.ui?.order||d.object)===id))parked.delete(k);return;}if(f!=='asa')return;for(const [k,d]of parked)if(d.family===f&&(d.order||d.ui?.order||d.object)===id)parked.delete(k);for(const k of Object.keys(auxSpecialAccessoryFlow.forms))if(k.startsWith(id+':'))delete auxSpecialAccessoryFlow.forms[k];for(const k of Object.keys(auxSpecialAccessoryFlow.pendingDrafts||{}))if(k.startsWith(id+':'))delete auxSpecialAccessoryFlow.pendingDrafts[k];};
function drafts(){const a=[],dp=window.dyePrintWashFlow,kl=window.knitLinkFlow,cf=window.cuttingFlow,as=window.auxSpecialAccessoryFlow,wb=window.waterBindingFlow;
for(const [key,d]of Object.entries(dp?.taskDrafts||{}))if(d.dirty){const [order,role,view]=key.split(':');a.push({family:'dpw',key,op:dp.orders[order].op,label:order+' · '+(view==='out'?'交出':'加工'),order,role,view,d});}
for(const [key,d]of Object.entries(kl?.taskDrafts||{}))if(d.dirty){const [op,stage,pair,sku,role,view]=key.split(':');a.push({family:'kl',key,op,label:kl.pairs[pair][stage]+' · '+kl.skus[sku].name+' · '+(view==='out'?'交出':'加工'),stage,pair,sku,role,view,d});}
for(const [key,d]of Object.entries(cf?.batchDrafts||{}))if(d.dirty)a.push({family:'cf',key,op:'裁剪',label:key+' · 加工接收',d});
for(const [key,d]of Object.entries(as?.pendingDrafts||{})){const f=as.forms[key]||{},sourceObject=d.view==='out'?(f.package||f.batch):f.source;a.push({family:'asa',key,op:as.orders[d.order].op,sourceObject,label:d.order+(sourceObject?' / '+sourceObject:'')+' · '+({work:'加工',out:'交出',receive:'实收',material:'辅材',issue:'领用',return:'退回'}[d.view]||'本单填写'),...d});}
for(const [key,d]of Object.entries(wb?.forms||{}))if(d._dirty){const [op,role,view,object]=key.split(':');a.push({family:'wb',key,op,role,view,object,label:(op==='水溶'?wb.water.id+(view==='out'?(d.rolls?.length?' / '+d.rolls.join(' / '):''):' / '+object):'KT-082 · '+wb.binding.specs[object]?.name)+' · '+({work:'加工',out:'交出',receive:'实收'}[view]||'填写')});}return [...parked.values(),...a].filter(draftAllowed);}
window.pdaPendingDrafts=drafts;window.pdaHasHiddenDrafts=()=>drafts().length>0;
function owned(d){return !!families[d.family];}
function resume(d){if(!d||!draftAllowed(d))return;selectedOp=d.op;done=null;error='';taskWorkspace=false;
if(d.family==='dpw'){const s=dyePrintWashFlow;s.role=d.role;Object.assign(s,{order:d.order,view:d.view,form:structuredClone(d.d.form),batch:d.d.batch,selected:[...d.d.selected],scanSet:[...d.d.scanSet]});screen='dpw-task';cap=d.op;}
if(d.family==='kl'){const s=knitLinkFlow;s.role=d.role;Object.assign(s,{stage:d.stage,pair:d.pair,sku:d.sku,view:d.view,form:structuredClone(d.d.form),piece:d.d.piece});screen='kl-task';cap=d.op;}
if(d.family==='cf'){cuttingFlow.form=structuredClone(d.d.form);screen='cf-issue';cap='裁剪';}
if(d.family==='asa'){const s=auxSpecialAccessoryFlow;s.role=d.role;s.order=d.order;s.view=d.view;screen='asa-task';cap='特殊工艺';}
if(d.family==='wb'){const s=waterBindingFlow;s.role=d.role;s.view=d.view;if(d.op==='水溶')s.source=d.object;else s.spec=d.object;screen='wb-task';cap='特殊工艺';}dirty=true;closeSheet();render();}
function token(d){return d.family+':'+d.key;}
function removeDraft(d){
 if(d.parked){parked.delete(token(d));return;}
 if(d.family==='dpw')delete dyePrintWashFlow.taskDrafts[d.key];
 if(d.family==='kl')delete knitLinkFlow.taskDrafts[d.key];
 if(d.family==='cf')delete cuttingFlow.batchDrafts[d.key];
 if(d.family==='asa'){delete auxSpecialAccessoryFlow.forms[d.key];delete auxSpecialAccessoryFlow.pendingDrafts[d.key];}
 if(d.family==='wb')delete waterBindingFlow.forms[d.key];
}
function current(){
 const f=family(),s=families[f]();if(['asa','dpw'].includes(f)&&s.orders[s.order]?.closed||f==='wb'&&selectedOp==='水溶'&&s.water.closed)return null;if(['receive-list','process-list','warehouse-home','sewing-return'].includes(screen)||!dirty)return null;
 const fields={cf:['form','node','bag','view','outMode','selectedTickets','outBagCodes','tool'],kl:['form','stage','pair','sku','view','source','piece','stock','stockKind'],dpw:['form','order','view','source','batch','selected','scanSet'],asa:['order','view'],wb:['view','source','spec'],pf:['current','materialOpen','receivingOut']}[f];
 const ui=Object.fromEntries(fields.map(k=>[k,structuredClone(s[k])]));
 const object=f==='cf'?(s.node||s.form.batch||s.job.id):f==='kl'?(s.stage+' · '+s.pair+' · '+s.sku):f==='dpw'||f==='asa'?s.order:f==='wb'?(selectedOp==='水溶'?s.source:s.spec):s.current||s.material.no;
 const sourceObject=(f==='dpw'&&screen==='dpw-receive'||f==='kl'&&screen==='kl-receive')?(s.source||''):f==='kl'&&screen==='kl-task'&&s.view==='out'&&s.stage==='knit'?(s.piece||''):f==='asa'&&s.view==='out'?(s.forms?.[s.order+':'+s.role+':out']?.package||s.forms?.[s.order+':'+s.role+':out']?.batch||''):f==='asa'?(s.forms?.[s.order+':'+s.role+':'+s.view]?.source||s.orders[s.order]?.sources.find(r=>r.received===null||r.received<r.qty)?.id||s.orders[s.order]?.sources[0]?.id||''):'';
 const key=[s.role,selectedOp,screen,object,sourceObject,s.view||''].join('|');
 if(f==='asa'){const k=s.order+':'+s.role+':'+s.view;ui.formKey=k;ui.form=structuredClone(s.forms[k]||{});}
 if(f==='wb'){const k=[selectedOp,s.role,s.view,selectedOp==='水溶'?s.source:s.spec].join(':');ui.formKey=k;ui.form=structuredClone(s.forms[k]||{});}
 if(f==='pf')ui.form=structuredClone(screen==='post-material'?s.materialsForm:s.batches[s.current]?.form||{});
 const displayObject=f==='kl'?s.pairs[s.pair][s.stage]+' · '+s.skus[s.sku].name:f==='wb'?(selectedOp==='水溶'?s.water.id+(s.view==='out'?(ui.form.rolls?.length?' / '+ui.form.rolls.join(' / '):''):' / '+s.source):s.binding.id+' · '+s.binding.specs[s.spec].name):object;
 const displaySource=f==='kl'&&screen==='kl-task'&&s.view==='out'&&s.stage==='knit'?(s.pieces[sourceObject]?.name||sourceObject):sourceObject;
 const activity=['kl-task','dpw-task','asa-task','wb-task'].includes(screen)?({receive:'接收',process:'加工',work:'加工',out:'交出'}[s.view]||''):'';
 return {family:f,key,role:s.role,op:selectedOp,screen,object,sourceObject,view:s.view,ui,inputFocus:window.pdaCaptureInput?.(),parked:true,label:displayObject+(displaySource?' / '+displaySource:'')+' · '+(activity||(window.pdaOriginalText?window.pdaOriginalText(document.querySelector('.appbar h2')):document.querySelector('.appbar h2')?.textContent)||'填写')};
}
function park(){const d=current();if(!d)return;const s=families[d.family]();
 // Move this visible draft out of the legacy view cache, without touching business records.
 if(d.family==='asa'&&s.pendingDrafts)delete s.pendingDrafts[d.ui.formKey];
 if(d.family==='wb'&&s.forms[d.ui.formKey])delete s.forms[d.ui.formKey]._dirty;
 if(d.family==='dpw'&&s.taskDrafts)delete s.taskDrafts[s.order+':'+s.role+':'+s.view];
 if(d.family==='kl'&&s.taskDrafts)delete s.taskDrafts[[selectedOp,s.stage,s.pair,s.sku,s.role,s.view].join(':')];
 if(d.family==='cf'&&s.batchDrafts)delete s.batchDrafts[s.form.batch];
 parked.set(token(d),d);
 if(d.family==='asa')s.forms[d.ui.formKey]={};else if(d.family==='wb')s.forms[d.ui.formKey]={};else if(d.family==='pf'){if(screen==='post-material')s.materialsForm={};else if(s.batches[s.current])s.batches[s.current].form={};s.auth=null;}else s.form={};
 dirty=false;
}
function restore(d){if(!d||!owned(d)||!draftAllowed(d))return;if(!d.parked)return resume(d);const s=families[d.family](),u=structuredClone(d.ui);s.role=d.role;selectedOp=d.op;cap=['asa','wb'].includes(d.family)?'特殊工艺':d.op;screen=d.screen;done=null;error='';taskWorkspace=false;
 if(['asa','wb'].includes(d.family)){const {formKey,form,...rest}=u;Object.assign(s,rest);s.forms[formKey]=form;if(d.family==='asa'){s.pendingDrafts??={};s.pendingDrafts[formKey]={order:s.order,role:s.role,view:s.view};}else form._dirty=true;}
 else if(d.family==='pf'){const {form,...rest}=u;Object.assign(s,rest);if(screen==='post-material')s.materialsForm=form;else if(s.batches[s.current])s.batches[s.current].form=form;s.auth=null;}
 else Object.assign(s,u);
 parked.delete(token(d));s.notice='';s.error='';dirty=true;closeSheet();render();window.pdaRestoreInput?.(d.inputFocus);
}
function listDrafts(items=drafts().filter(owned)){draftChoices=items;sheet('选择未提交填写',items.map((d,i)=>'<div class="floor-draft-row"><button data-floor="pick:'+i+'"><b>'+esc(d.label)+'</b><small>'+esc(d.op)+' · 仅本页保留</small></button><button data-floor="drop:'+i+'" aria-label="放弃 '+esc(d.label)+'">放弃</button></div>').join(''));}
function askDiscard(d){if(!d||!owned(d))return;discardTarget=d;sheet('放弃这笔填写',panel(kv('单据 / 操作',esc(d.label))+kv('工序',esc(d.op)))+note('只清除这笔未提交填写。其他单据及已登记数量保留。'),'<button class="secondary" data-action="close">继续保留</button><button class="primary" data-floor="discard-confirm">放弃这笔填写</button>');}
function discardOne(){if(discardTarget){removeDraft(discardTarget);discardTarget=null;}closeSheet();render();}
window.pdaFloorRememberOrigin=function(){if(['receive-list','process-list','warehouse-home'].includes(screen))families[family()]().origin=screen;};
window.pdaFloorOrigin=()=>families[family()]().origin;
window.pdaFloorNavigate=function(target){if(sewingReturn.locked)return false;const f=family(),s=families[f]();if(!target)target=s.origin||(['kl-receive','dpw-receive'].includes(screen)?'receive-list':'process-list');park();screen=target;done=null;error='';dirty=false;taskWorkspace=false;s.error='';s.notice='';closeSheet();render();window.pdaFocusScanner?.();return true;};
function handoff(id,value){const f=family(),s=families[f](),field=id.includes('factory')?'factory':'role';if(value===s[field])return false;const active=current();park();const mine=drafts().filter(owned);if(!mine.length)return false;handoffTarget={id,value,ds:mine,active:active?token(active):null};document.getElementById(id).value=s[field];sheet('交接设备前处理填写',note('以下内容尚未提交，不会交给下一位员工。')+mine.map(d=>panel('<b>'+esc(d.label)+'</b><p>'+esc(d.op)+'</p>')).join(''),'<button class="secondary" data-floor="handoff-stay">返回继续填写</button><button class="primary" data-floor="handoff-confirm">放弃这 '+mine.length+' 笔填写并交接</button>');return true;}
window.pdaFloorHandoff=handoff;
// V19: a validated scan resumes exactly the same source, not another roll of its order.
window.pdaFloorScanTarget=function(t){
 const matches=d=>d.family===t.family&&d.op===selectedOp&&(!t.screen||d.screen===t.screen)&&(!t.order||(d.order||d.ui?.order)===t.order)&&(!t.view||d.view===t.view)&&(!t.source||(d.sourceObject||d.ui?.source||d.ui?.form?.source)===t.source)&&(!t.node||d.ui?.node===t.node)&&(!t.current||d.ui?.current===t.current);
 const active=current();if(active&&matches(active)){render();return true;}
 park();const ds=drafts().filter(d=>owned(d)&&matches(d));
 if(ds.length===1){restore(ds[0]);return true;}
 if(ds.length>1){listDrafts(ds);return true;}return false;
};
// Reuse an existing next-source draft after a successful receipt; never select another action.
window.pdaFloorContinueReceiving=function(f,order,source){
 if(!source)return false;
 const matches=drafts().filter(d=>owned(d)&&d.family===f&&d.op===selectedOp&&(d.order||d.ui?.order)===order&&(d.view==='receive'||f==='dpw'&&d.screen==='dpw-receive')&&(d.sourceObject||d.ui?.source||d.ui?.form?.source)===source);
 if(matches.length!==1)return false;restore(matches[0]);return true;
};
window.pdaFloorContinueOutput=function(order,batch){
 const ds=drafts().filter(d=>owned(d)&&d.family==='asa'&&d.op===selectedOp&&(d.order||d.ui?.order)===order&&d.view==='out'&&(d.sourceObject||d.ui?.form?.batch)===batch);
 if(ds.length!==1)return false;restore(ds[0]);return true;
};
const loginAccounts=[['rina','101','Rina · 018'],['adi','102','Adi · 032'],['sari','103','Sari · 021'],['budi','104','Budi · 026']].map(([role,id,name])=>({role,id,name,factory:'中央工厂'}));
window.pdaFloorLoginAccounts=()=>loginAccounts;
window.pdaFloorLoginAs=key=>{const a=loginAccounts.find(a=>a.role===key);if(!a)return false;window.pdaOperator.name=a.name;identity=context();window.pdaCrossRoleBlocked=false;return true;};
window.pdaFloorResumeTarget=function(b){
 const a=b.dataset.asa,dp=b.dataset.dpw,kl=b.dataset.kl,cf=b.dataset.cf,wb=b.dataset.wb;let choices=[];
 let mine=drafts().filter(d=>owned(d)&&d.op===selectedOp);
 if(a?.startsWith('order:')){const [,id,view]=a.split(':');choices=mine.filter(d=>d.family==='asa'&&(d.order||d.ui?.order)===id&&d.view===(view||'work'));}
 if(a?.startsWith('order-source:')){const [,id,source]=a.split(':');choices=mine.filter(d=>d.family==='asa'&&(d.order||d.ui?.order)===id&&d.view==='receive'&&(d.sourceObject||auxSpecialAccessoryFlow.forms[d.key]?.source)===source);}
 if(dp?.startsWith('order:'))choices=mine.filter(d=>d.family==='dpw'&&(d.order||d.ui?.order)===dp.slice(6)&&d.view==='process');
 if(kl?.startsWith('pair:'))choices=mine.filter(d=>d.family==='kl'&&(d.stage||d.ui?.stage)===knitLinkFlow.stage&&(d.pair||d.ui?.pair)===kl.slice(5)&&d.view==='process');
 if(cf?.startsWith('node:'))choices=mine.filter(d=>d.family==='cf'&&d.ui?.node===cf.slice(5));
 if(a?.startsWith('source:')&&screen==='asa-task'){
  const state=auxSpecialAccessoryFlow,id=a.slice(7);
  if(state.orders[state.order]?.sources.some(r=>r.id===id)){
   park();state.notice='';state.error='';mine=drafts().filter(d=>owned(d)&&d.op===selectedOp);
   choices=mine.filter(d=>d.family==='asa'&&(d.order||d.ui?.order)===state.order&&d.view===state.view&&(d.sourceObject||state.forms[d.key]?.source)===id);
  }
 }
 if(a&&screen==='asa-task'&&(/^(choose-batch:|batch-out:)/.test(a)||['view:work','view:out','view:receipt','receipts-all'].includes(a))){
  const state=auxSpecialAccessoryFlow,[action,id]=a.split(':'),batch=['view','receipts-all'].includes(action)?null:id,view=action==='view'?id:action==='receipts-all'?'receipt':'out';
  if(!batch||state.orders[state.order].batches.some(b=>b.id===batch)){
   const receiptPackage=action==='view'&&id==='receipt'&&state.view==='out'?state.forms[state.order+':'+state.role+':out']?.package:null;
   const receiptBatch=action==='view'&&id==='receipt'&&state.view==='out'?state.forms[state.order+':'+state.role+':out']?.batch:null;
   park();if(receiptBatch){state.forms[state.order+':'+state.role+':out']??={};state.forms[state.order+':'+state.role+':out'].batch=receiptBatch;if(receiptPackage)state.forms[state.order+':'+state.role+':out'].package=receiptPackage;}state.notice='';state.error='';mine=drafts().filter(d=>owned(d)&&d.op===selectedOp);
   choices=mine.filter(d=>d.family==='asa'&&(d.order||d.ui?.order)===state.order&&d.view===view&&(!batch||(d.sourceObject||d.ui?.form?.batch||state.forms[d.key]?.batch)===batch));
  }
 }
 if(kl&&(kl==='related'||kl.startsWith('stage:'))){park();knitLinkFlow.notice='';knitLinkFlow.error='';}
 if(kl&&screen==='kl-task'&&(/^(sku:|piece:)/.test(kl)||['view:process','view:out','open:task','open:out'].includes(kl))){
  const state=knitLinkFlow,[action,id]=kl.split(':');
  const sku=action==='sku'?id:state.sku,view=['view','open'].includes(action)?(id==='task'?'process':id):state.view;
  if((action!=='sku'||state.pairs[state.pair].skus.includes(sku))&&(action!=='piece'||state.skus[sku].pieces.includes(id))){
   park();state.notice='';state.error='';mine=drafts().filter(d=>owned(d)&&d.op===selectedOp);
   choices=mine.filter(d=>d.family==='kl'&&(d.stage||d.ui?.stage)===state.stage&&(d.pair||d.ui?.pair)===state.pair&&(d.sku||d.ui?.sku)===sku&&d.view===view&&(action!=='piece'||(d.ui?.piece||d.d?.piece)===id));
  }
 }
 if(wb&&/^(view:|source:|spec:)/.test(wb)){
  // Switching the physical source parks its own input and focus before opening another.
  const state=waterBindingFlow,[action,id]=wb.split(':'),withinTask=screen==='wb-task';
  const currentObject=selectedOp==='水溶'?state.source:state.spec;
  if(withinTask)park();
  mine=drafts().filter(d=>owned(d)&&d.op===selectedOp);
  const view=action==='view'?id:action==='source'?'receive':state.view;
  const object=action==='source'||action==='spec'?id:withinTask?currentObject:null;
  choices=mine.filter(d=>d.family==='wb'&&d.view===view&&(!object||(d.parked?(selectedOp==='水溶'?d.ui.source:d.ui.spec):d.object)===object));
 }
 if(choices.length===1){restore(choices[0]);return true;}if(choices.length>1){listDrafts(choices);return true;}return false;
};
window.addEventListener('beforeunload',e=>{if(dirty||drafts().length){e.preventDefault();e.returnValue='';}});
window.addEventListener('click',e=>{const b=e.target.closest('[data-floor]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.floor,mine=drafts().filter(owned);
 if(a==='activate'){if(dirty)return;identity=context();window.pdaCrossRoleBlocked=false;return render();}
 if(a==='resume')return mine.length===1?restore(mine[0]):listDrafts();
 if(a==='discard')return askDiscard(mine[0]);
 if(a==='discard-confirm')return discardOne();
 if(a.startsWith('pick:'))return restore((draftChoices||mine)[Number(a.slice(5))]);
 if(a.startsWith('drop:'))return askDiscard((draftChoices||mine)[Number(a.slice(5))]);
 if(a==='handoff-stay'){const h=handoffTarget,d=h?.ds.find(d=>token(d)===h.active);handoffTarget=null;if(d)return restore(d);if(h?.ds.length===1)return restore(h.ds[0]);return listDrafts();}
 if(a==='handoff-confirm'){const h=handoffTarget;if(!h)return;h.ds.forEach(removeDraft);handoffTarget=null;dirty=false;closeSheet();render();const el=document.getElementById(h.id);if(el){el.value=h.value;el.dispatchEvent(new Event('change',{bubbles:true}));}}
},true);
render=function(){window.pdaCrossRoleBlocked=false;prior();$('#review-nav').innerHTML=['receive-list','process-list','warehouse-home'].map((id,i)=>`<button data-go="${id}"><span>${i+1}</span>${['接收','执行','仓管'][i]}</button>`).join('');if(screen==='kl-task'){const s=knitLinkFlow,h=$('.appbar h2');if(h)h.textContent=s.pairs[s.pair][s.stage]+' · '+s.skus[s.sku].name+(s.stage==='knit'&&s.view==='out'&&s.piece?' · '+s.pieces[s.piece].name:'');}if(screen==='asa-task'&&['out','receipt'].includes(auxSpecialAccessoryFlow.view)){const s=auxSpecialAccessoryFlow,b=s.view==='out'?(s.forms[s.order+':'+s.role+':out']?.package||s.forms[s.order+':'+s.role+':out']?.batch):s.receiptOrder===s.order?(s.receiptPackage||s.receiptBatch):null,h=$('.appbar h2');if(h&&b)h.textContent=b;}identityUI();if(unavailableOperation&&!document.querySelector('#unavailable-operation'))$('#content').insertAdjacentHTML('afterbegin','<p id="unavailable-operation" class="error">工序入口已失效，请重新选择工序。</p>');$('#note-source').textContent='V34 对照 main 90092818 的加工单来源、接收方与数量单位。独立可点击设计，页面使用示例数据。';$('#floor-draft')?.remove();const ds=drafts(),mine=ds.filter(owned);if(ds.length&&!dirty&&$('#content'))$('#content').insertAdjacentHTML('afterbegin',`<div id="floor-draft" class="floor-draft"><span>${'未提交 · '+mine.length+' 笔'}<small>${esc((mine[0]||ds[0]).label)} · 仅本页保留</small></span>${mine.length?'<button data-floor="resume">'+(mine.length===1?'继续填写':'选择填写')+'</button>'+(mine.length===1?'<button data-floor="discard" aria-label="放弃这笔填写">放弃</button>':''):''}</div>`);const u=new URL(location.href);u.searchParams.set('v','34');history.replaceState({},'',u);window.pdaFloorReady=34;};
const originalCloseSheet=closeSheet;
closeSheet=function(){draftChoices=null;if(handoffTarget){const h=handoffTarget,d=h.ds.find(d=>token(d)===h.active);handoffTarget=null;if(d)return restore(d);originalCloseSheet();render();return;}return originalCloseSheet();};
window.pdaFloorPark=park;
window.pdaFloorActivateCurrent=()=>{const s=families[family()]();s.notice='';s.error='';if('auth' in s)s.auth=null;identity=context();window.pdaCrossRoleBlocked=false;};
// V17: expose only owned, unsubmitted forms for the local logout demonstration.
const exitOwned=d=>owned(d);
window.pdaFloorExitDrafts=()=>{const a=drafts().filter(exitOwned),d=window.pdaCrossRoleBlocked?null:current();if(d){const s=families[d.family]();const activeKey=['asa','wb'].includes(d.family)?d.ui.formKey:d.family==='dpw'?[s.order,s.role,s.view].join(':'):d.family==='kl'?[selectedOp,s.stage,s.pair,s.sku,s.role,s.view].join(':'):d.family==='cf'?s.form.batch:null;if(!a.some(x=>x.family===d.family&&(x.parked?x.key===d.key:!!activeKey&&x.key===activeKey)))a.push(d);}return a;};
window.pdaFloorDiscardForExit=()=>{if(!window.pdaCrossRoleBlocked)park();drafts().filter(exitOwned).forEach(removeDraft);dirty=false;};
if(params.get('floordemo')==='multi'&&selectedOp==='织带／绳子截断'){
 const s=auxSpecialAccessoryFlow;s.role='store';s.order='ZD-001';s.view='receive';s.pendingDrafts??={};
 for(const [order,source,qty]of [['ZD-001','ZD-001-IN','30'],['ZD-002','ZD-ROPE-IN','20']]){const k=order+':store:receive';s.forms[k]={source,qty};s.pendingDrafts[k]={order,role:'store',view:'receive'};}
 screen='receive-list';dirty=false;identity=context();
}
render();
})();
