'use strict';
// Standalone interaction sample. Business records remain in page memory; refresh resets them.
(() => {
const prior={render,go,submit,open:openTask,step:setStep,warehouse:renderers['warehouse-home'],receive:renderers['receive-list'],list:renderers['process-list']};
const ITEMS=['开扣眼','装扣子','熨烫','包装'];
const roles={receive:{name:'Rina',role:'后道点收 / 仓管'},work:{name:'Lina',role:'后道处理员'},work2:{name:'Budi',role:'后道处理员'},check:{name:'Ayu',role:'复核员'},check2:{name:'Nina',role:'复核员'},warehouse:{name:'Sari',role:'成衣仓收货员'}};
const s=window.postFlow={version:'9',role:'receive',batches:{},current:null,origin:'warehouse-home',error:'',notice:'',auth:null,scan:'',material:{no:'DB-PF-082',status:'待入库',qty:95,requested:100,location:'PF-MAT-A01',inbound:null},materialsForm:{},materialOpen:false};
const now=()=>new Date().toLocaleString('zh-CN'),sum=a=>a.reduce((x,y)=>x+y,0),who=()=>({name:window.pdaOperator?.name||'Rina · 018',role:'当前示例操作人'}),own=()=>screen==='post-batch'||screen==='post-material',rnow=()=>s.current&&s.batches[s.current];
const same=(a,c)=>a.every((value,i)=>value===c[i]),line=(a,unit='件')=>`M ${a[0]} · L ${a[1]} ${unit}`;
const b=(text,key,cls='secondary')=>`<button class="${cls}" data-pf="${esc(key)}" ${key==='save'&&Date.now()<(s.readyAt||0)?'disabled':''}>${text}</button>`;
function currentOut(x){return x.outbounds.find(o=>o.no===x.selectedOutbound)||null;}
function currentCheck(x){return x.rechecks.find(r=>r.no===x.selectedRecheck)||null;}
function all(){
 for(const row of warehouseV7.rows.filter(row=>row.kind==='post')){
  if(s.batches[row.task])continue;
  const x={id:row.task,row,registered:warehouseV7.expected(row),counts:null,first:null,sent:null,qc:null,processEntries:[],rechecks:[],outbounds:[],view:'work',process:ITEMS[0],selectedRecheck:null,selectedOutbound:null,form:{},history:[],version:1};
  // Existing shared handoff context reads the currently selected outbound only.
  Object.defineProperty(x,'out',{get(){return currentOut(this)||(this.view==='check'?this.outbounds.find(o=>o.recheckNo===this.selectedRecheck):null);}});
  s.batches[row.task]=x;
 }
 return Object.values(s.batches);
}
const fields=()=>screen==='post-material'?s.materialsForm:rnow()?.form||{},v=key=>String(fields()[key]??''),n=key=>v(key).trim()===''?NaN:Number(v(key));
function progress(x){
 const items=ITEMS.filter(item=>x.qc?.items.includes(item)),counts={};
 for(const item of ITEMS)counts[item]=[0,1].map(i=>sum(x.processEntries.filter(r=>r.item===item).map(r=>r.qty[i])));
 const finished=items.length?counts[items.at(-1)]:[0,0];
 const reserved=[0,1].map(i=>sum(x.rechecks.map(r=>Math.max(r.qty[i],r.actual?.[i]??r.qty[i]))));
 const available=finished.map((value,i)=>value-reserved[i]);
 return {items,counts,finished,reserved,available,
  forItem:item=>[0,1].map(i=>(items.indexOf(item)>0?counts[items[items.indexOf(item)-1]][i]:x.qc.pass[i])-counts[item][i])};
}
function stage(x){return !x.counts?'receive':!x.sent?'send':!x.qc?'qc':sum(x.qc.pass)===0?'empty':'flow';}
function closed(x){
 if(!x.qc||sum(x.qc.pass)===0)return !!x.qc;
 if(!x.qc.items.length)return x.outbounds.length>0&&x.outbounds.every(o=>o.receipt&&same(o.receipt.qty,o.qty));
 const p=progress(x);
 return same(p.finished,x.qc.pass)&&same(p.reserved,x.qc.pass)&&x.rechecks.every(r=>r.status==='已复核'&&same(r.qty,r.actual))&&x.outbounds.length>0&&x.outbounds.every(o=>o.receipt&&same(o.receipt.qty,o.qty));
}
function stageName(x){
 const k=stage(x);
 if(k!=='flow')return {receive:'点数接收',send:'待送检',qc:'等待质检',empty:'合格0 · 无下游单据'}[k];
 if(closed(x))return '全部交接完成';
 const p=progress(x),labels=[];
 if(x.qc.items.length)labels.push(same(p.finished,x.qc.pass)?'后道完成':'后道加工中');
 if(sum(p.available)>0)labels.push('可交复检 '+sum(p.available));
 const pending=x.rechecks.filter(r=>r.status!=='已复核').length,receiving=x.outbounds.filter(o=>!o.receipt).length;
 if(pending)labels.push('待复检 '+pending+' 张');
 if(receiving)labels.push('待实收 '+receiving+' 张');
 if(x.outbounds.some(o=>o.receipt&&!same(o.receipt.qty,o.qty))||x.rechecks.some(r=>r.actual&&!same(r.actual,r.qty)))labels.push('差异待处理');
 return labels.join(' · ')||'待出货';
}
function event(x,action,detail='',actor=who().name){x.history.push({action,detail,actor,time:now()});x.version++;}
function fail(text){s.error=text;const el=$('#pf-error');if(el){el.textContent=text;el.scrollIntoView({block:'nearest'});}return false;}
function ok(text){s.readyAt=Date.now()+450;setTimeout(()=>{if(own()&&$('.footer'))$('.footer').innerHTML=primary();},460);s.notice=text;s.error='';s.auth=null;dirty=false;done=null;render();}
function gate(){if(sewingReturn.locked)return fail('先结束车缝回货登记，再继续本次作业。');if(scenario!=='normal')return fail(scenario==='failed'?'未保存，填写已保留。恢复后重试。':scenario==='conflict'?'本单记录已变化，本次未保存。重新读取后核对。':'当前状态不允许操作，请核对来源单据。');if(rnow()?.row.discarded)return fail('本次回货已废弃，不能继续接收或交出。');return true;}
function nums(){const a=[n('m'),n('l')];if(a.some(value=>!Number.isSafeInteger(value)||value<0)){fail('逐码填写非负整数件数；本次没有数量填0，空白不算0。');return null;}return a;}
function freshForm(x){x.form={};s.auth=null;dirty=false;}
function initForm(x){
 freshForm(x);
 if(stage(x)==='flow'){
  const q=x.view==='check'?currentCheck(x)?.qty:x.view==='out'&&s.receivingOut===x.selectedOutbound?currentOut(x)?.qty:[0,0];
  if(q)x.form={m:String(q[0]),l:String(q[1])};
 }
}
function syncSource(x){
 const p=x.qc?progress(x):null;
 Object.assign(x.row.post||warehouseV7.post,{received:!!x.counts,counts:x.counts?[...x.counts]:undefined,sent:!!x.sent,qc:!!x.qc,processed:!!p&&x.qc.items.length>0&&same(p.finished,x.qc.pass),rechecked:!!p&&same(p.reserved,x.qc.pass)&&x.rechecks.length>0&&x.rechecks.every(r=>r.status==='已复核')});
 if(x.row.returnRecord&&x.qc)x.row.returnRecord.status=closed(x)?'已完成':'已送检';
}
function field(key,label,type='text',hint=''){return `<div class="field"><label class="label" for="pf-${key}">${label}</label><div class="input-box"><input id="pf-${key}" data-pf-field="${key}" type="${type==='number'?'text':type}" ${type==='number'?'inputmode="numeric"':''} value="${esc(v(key))}" autocomplete="off" placeholder="${hint}">${type==='number'?'<span>件</span>':''}</div></div>`;}
function quantities(exp,label){return `<div class="pf-quantities">${[0,1].map(i=>`<div>${field(i?'l':'m',(i?'L':'M')+'码 · '+label,'number','实际件数')}<small>${label.includes('本次')?'本次可用':'应交 / 应收'} ${exp[i]} 件</small></div>`).join('')}</div><div class="pf-live" id="pf-live"></div>`;}
function summary(x){return `<div class="pf-id"><span><b>${esc(x.id)}</b><small>原回货 · ${esc(x.row.returnRecord?.factory||'Bintang 车缝厂')} → 中央工厂后道</small></span><span class="pill ${closed(x)?'ready':'warn'}">${esc(stageName(x))}</span></div>${panel(product('hoodie','PO-082 · 雾霾灰'))}`;}
function trail(x){const rr=x.row.returnRecord;return `<details class="pf-details"><summary>数量与责任历史</summary>${kv('原送货登记',line(x.registered))}${kv('送货人',esc(rr?.person||'Adi'))}${x.counts?kv('后道实收',line(x.counts))+kv('点收人 / 时间',esc(x.receivedBy+' · '+x.receivedAt)):''}${x.qc?kv('质检合格',line(x.qc.pass))+kv('次品 / 退回',sum(x.qc.defect)+' / '+sum(x.qc.returned)+' 件')+kv('加工链',x.qc.items.join(' → ')||'不涉及后道加工'):''}${x.history.map(e=>`<div class="pf-event"><b>${esc(e.action)}</b><span>${esc(e.actor)} · ${esc(e.time)}</span>${e.detail?`<small>${esc(e.detail)}</small>`:''}</div>`).join('')}</details>`;}
function receivePage(x){return `<h3>逐码点数</h3>${quantities(x.registered,'实收')}<details class="pf-details"><summary>补登早前点收</summary>${field('at','实际点收时间','datetime-local')}${field('delay','补登原因','text','未填写时间时按当前时间记录')}</details><details class="pf-details"><summary>登记有误</summary>${b('废弃这次回货登记','discard','pf-link danger')}</details>`;}
function qcPanel(x){return `<details class="pf-details"><summary>质检结果 · 合格 ${sum(x.qc.pass)} / 异常 ${sum(x.qc.defect)+sum(x.qc.returned)} 件</summary>${kv('合格',line(x.qc.pass))}${kv('次品',line(x.qc.defect))}${kv('退回车缝厂',line(x.qc.returned))}${kv('质检人',x.qc.actor)}${kv('车缝任务类型',x.qc.taskType)}${kv('后道责任',x.qc.responsibility)}${kv('加工项目',x.qc.items.join(' → ')||'无需后道加工')}</details>`;}
function tabs(x){return `<div class="pf-tabs">${[['work','加工登记'],['submit','交复检'],['check','复检 '+x.rechecks.length],['out','出货 '+x.outbounds.length]].filter(([key])=>x.qc.items.length||key==='out').map(([key,label])=>b(label,'view:'+key,key===x.view?'primary':'secondary')).join('')}</div>`;}
function workPage(x){
 const p=progress(x),item=p.items.includes(x.process)?x.process:p.items[0];x.process=item;
 if(!item)return note('本单无需后道加工，查看独立出货与实收记录。','info');
 const available=p.forItem(item),records=x.processEntries.filter(r=>r.item===item);
 return `<div class="pf-process-grid">${ITEMS.map(name=>p.items.includes(name)?b(`<b>${name}</b><small>${sum(p.counts[name])} / ${sum(x.qc.pass)} 件</small>`,'item:'+name,name===item?'primary':'secondary'):`<div class="pf-not-applicable"><b>${name}</b><small>不涉及</small></div>`).join('')}</div><h3>${item} · 本次登记</h3>${kv('责任人 / 录入人',esc(who().name))}${kv('已完成',line(p.counts[item]))}${quantities(available,'本次完成')}<p class="hint">按实际加工链逐码控制上限。正常余量继续加工，无需填写未处理原因。</p>${s.material.status==='已入库'?note('辅料已整单入库。','good'):note('辅料尚未整单入库，当前仅提示，可继续登记。','info')}<details class="pf-details"><summary>本项登记 ${records.length} 次</summary>${records.map(r=>`<div class="pf-event"><b>本次 ${line(r.qty)}</b><span>责任人 ${esc(r.responsible)} · 录入人 ${esc(r.recordedBy)}</span><small>${esc(r.time)}</small></div>`).join('')||'<p class="hint">尚未登记。</p>'}</details>${b('清空本次未保存填写','clear-form','pf-link')}`;
}
function submitPage(x){const p=progress(x);return `<h3>本次交复检</h3>${kv('全部后道完成',line(p.finished))}${kv('已被复检占用',line(p.reserved))}${quantities(p.available,'本次交复检')}<p class="hint">复检单创建即占用，尚未领取也不能重复交出。加工保存后不会自动生成复检单。</p>${b('清空本次未保存填写','clear-form','pf-link')}`;}
function codeUI(r,i){if(!r.qty[i])return '';const key=i?'l':'m',status=r.codes[key]||'未扫';return `<section class="pf-code"><b>${key.toUpperCase()}码 SKU 条码</b><div class="input-box"><input id="pf-code-${key}" data-pf-field="code${key}" value="${esc(v('code'+key))}" placeholder="逐码扫描实物 SKU 条码"><button data-pf="scan-${key}" aria-label="核对${key.toUpperCase()}码条码">${I('scan')}</button></div><p class="${status==='正确'?'pf-good':status==='未扫'?'hint':'error'}">${status}</p>${status==='条码错误'?b('打印正确标签（预览）','label-'+key,'pf-link')+b('已重新贴码','relabel-'+key):''}</section>`;}
function checkPage(x){
 const r=currentCheck(x);
 const records=x.rechecks.map(r=>b(`<b>${r.no}</b><small>${line(r.qty)} · ${r.status}${r.checker?' · '+esc(r.checker):''}</small>`,'check:'+r.no,'choose-row')).join('');
 if(!r)return `<h3>选择本张复检单</h3>${records||note('尚未交复检。完成适用加工项后，单独登记交复检数量。','info')}`;
 const editable=r.status!=='已复核'&&r.checker===who().name;
 return `<details class="pf-details"><summary>全部复检（${x.rechecks.length} 张）</summary>${records}</details><h3>${r.no}</h3>${kv('应交数量',line(r.qty))}${kv('创建人 / 时间',esc(r.createdBy+' · '+r.createdAt))}${r.status==='已复核'?note('本张已复核：'+line(r.actual)+'；对应出货 '+r.outboundNo,'good'):!r.checker?note('本张待领取，数量已经占用。','info')+b('领取本张复检单','claim-check','primary'):!editable?note('由 '+esc(r.checker)+' 复核中，切换到本人后继续。'):quantities(r.qty,'交出实物')+codeUI(r,0)+codeUI(r,1)+field('differenceReason','数量有差异时填写原因')+b('释放本张领取','release','pf-link')}`;
}
function outPage(x){
 const records=x.outbounds.map(o=>b(`<b>${o.no}</b><small>${line(o.qty)} · ${o.receipt?'已登记实收':'待成衣仓实收'}</small>`,'out:'+o.no,'choose-row')).join('');
 const o=currentOut(x);
 if(!o)return `<h3>选择本张出货单</h3>${records||note('尚未生成出货单。','info')}`;
 return `<details class="pf-details"><summary>全部出货（${x.outbounds.length} 张）</summary>${records}</details><h3>${o.no} · ${sum(o.qty)} 件</h3>${kv('去向','成衣中央仓')}${kv('本次出货',line(o.qty))}${kv('来源',o.recheckNo||'质检直达')}${kv('交出责任',esc(o.actor+' · '+o.time))}${o.receipt?panel(kv('成衣仓实收',line(o.receipt.qty))+kv('实收人 / 时间',esc(o.receipt.actor+' · '+o.receipt.time)))+note(same(o.receipt.qty,o.qty)?'本张逐码一致；父单仍按全部余量判断。':'本张实收有差异，原出货数量保留。',same(o.receipt.qty,o.qty)?'good':'warn'):s.receivingOut===o.no?quantities(o.qty,'成衣仓实收')+field('differenceReason','数量有差异时填写原因'):note('本张等待成衣仓独立点收，其他出货记录分别保留。','info')}`;
}
function flowPage(x){const p=progress(x);return qcPanel(x)+`<section class="pf-progress">${kv('全部后道完成',x.qc.items.length?line(p.finished):'不涉及')}${kv('可交复检',x.qc.items.length?line(p.available):'不涉及')}${kv('本单已生成',x.rechecks.length+' 张复检 / '+x.outbounds.length+' 张出货')}${kv('累计已实收',line([0,1].map(i=>sum(x.outbounds.map(o=>o.receipt?.qty[i]||0)))))}</section>${tabs(x)}${x.view==='work'?workPage(x):x.view==='submit'?submitPage(x):x.view==='check'?checkPage(x):outPage(x)}`;}
function body(){all();const x=rnow();if(!x)return scanPage();const k=stage(x);return (s.notice?`<div role="status" class="pf-notice">${esc(s.notice)}</div>`:'')+summary(x)+(x.row.discarded?note('本次回货已废弃，原因和操作人保留。'):k==='receive'?receivePage(x):k==='send'?kv('已点收入仓',line(x.counts))+kv('质检单','QC-'+x.id.slice(3))+note('将本次回货整量交到质检工作区。','info'):k==='qc'?kv('已送检',line(x.counts))+kv('送检人 / 时间',esc(x.sent.actor+' · '+x.sent.time))+note('等待质检人员登记结果。','info'):k==='empty'?qcPanel(x)+note('合格为0，不创建加工单、复检单或空出货单。'):flowPage(x))+trail(x)+`<div id="pf-error" class="error" role="alert">${esc(s.error)}</div>`;}
function scanPage(){return `<h3>扫描或输入完整单号</h3><p class="hint">原送货单、加工单、具体复检单、出货单均可查询。</p><div class="input-box"><input id="pf-scan" value="${esc(s.scan)}" placeholder="完整单号"><button data-pf="scan" aria-label="识别后道单据">${I('scan')}</button></div><details class="pf-details"><summary>无扫码设备？选择原回货</summary>${batchRows()}</details><div id="pf-error" class="error" role="alert">${esc(s.error)}</div>`;}
function batchRows(){return all().filter(x=>!x.row.discarded).map(x=>`<button class="choose-row" data-pf="open:${x.id}"><span><b>${x.id} · 原回货 ${sum(x.registered)} 件</b><small>${esc(stageName(x))} · ${esc(x.row.returnRecord?.person||'Adi')}</small></span>${I('next')}</button>`).join('');}
function rootPage(which){return `<div class="pf-home">${which==='warehouse-home'?`<h3>待加工仓</h3><div class="pf-actions">${b('<b>回货点收 / 送检</b><small>扫原送货单，继续下一步</small>','scan-open','choose-row')}${b('<b>辅料整单入库</b><small>按调出方实配数量入库</small>','material','choose-row')}${b('<b>车缝回货模式</b><small>公共机 · 送货人登记</small>','public','choose-row')}</div><h3>后道执行与交出</h3>${b('<b>加工 / 复检 / 出货 / 实收</b><small>同一加工单下分别登记多次记录</small>','scan-open','choose-row')}`:which==='receive-list'?b('<b>车缝回货登记</b><small>交给送货人使用公共机</small>','public','choose-row')+b('<b>扫送货单点数</b><small>登记数量与后道实收分开</small>','scan-open','choose-row'):b('<b>扫后道完整单号</b><small>分项加工，多次复检与出货</small>','scan-open','choose-row')}<h3>按原回货继续</h3>${batchRows()}</div>`;}
function materialPage(){const m=s.material;return `<h3>后道辅料整单入库</h3>${!s.materialOpen?`<div class="input-box"><input id="pf-material-code" placeholder="完整辅料调拨单号"><button data-pf="material-scan" aria-label="识别辅料调拨单">${I('scan')}</button></div><details class="pf-details"><summary>无扫码设备？选择本单</summary>${b(m.no+' · 待入库','material-select','choose-row')}</details>`:`<b>${m.no} · PO-082</b>${panel(product('postlabel','吊牌 · WLID009 · 个'))}${kv('调出方','中央辅料仓')}${kv('存放位置',m.location)}${kv('申请 / 实配',m.requested+' / '+m.qty+' 个')}${m.inbound?note('已整单入库 '+m.qty+' 个 · '+m.inbound.actor+' · '+m.inbound.time,'good'):note('核对全部实配辅料，按实配 '+m.qty+' 个整单入库，不分批、不改数量。','info')}`}<div id="pf-error" class="error" role="alert">${esc(s.error)}</div>`;}
Object.assign(productData,{postlabel:['accessory-label.jpg','服装吊牌','后道包装辅料']});
function primary(){
 const x=rnow();
 if(screen==='post-material')return s.materialOpen&&!s.material.inbound?b('确认全部 '+s.material.qty+' 个已入库','material-save','primary'):b('返回仓管','home','primary');
 if(!x||x.row.discarded)return b('返回仓管','home','primary');
 const k=stage(x),count=[n('m'),n('l')],total=count.every(Number.isFinite)?sum(count):null;
 if(k==='receive')return b(total===null?'确认本次点数':'确认逐码实收 '+total+' 件','save','primary');
 if(k==='send')return b('将本次回货 '+sum(x.counts)+' 件送检','save','primary');
 if(k==='qc')return b('查看质检结果','refresh','primary');
 if(k==='empty')return b('返回原回货列表','next-batch','primary');
 if(x.view==='work')return b('保存本次'+x.process+(total===null?'数量':' '+total+' 件'),'save','primary');
 if(x.view==='submit')return sum(progress(x).available)>0?b('确认本次交复检'+(total===null?'数量':' '+total+' 件'),'save','primary'):b('选择已创建的复检单','check-list','primary');
 if(x.view==='check'){const r=currentCheck(x);return r?.status!=='已复核'&&r?.checker===who().name?b('确认数量条码，完成本张复检','save','primary'):b('选择其他复检单','check-list','primary');}
 const o=currentOut(x);return o&&!o.receipt?(s.receivingOut===o.no?b('确认本张成衣仓实收','save','primary'):b('登记本张成衣仓实收','receive-out','primary')):b('选择其他出货单','out-list','primary');
}
function makeOut(x,qty,source,actor,recheck=null){
 const existing=x.outbounds.find(o=>recheck?o.recheckNo===recheck.no:o.source==='质检直达');if(existing)return existing;
 const o={no:'CH-'+x.id.slice(3)+'-'+String(x.outbounds.length+1).padStart(3,'0'),qty:[...qty],source,actor,time:now(),recheckNo:recheck?.no,receipt:null};
 x.outbounds.push(o);x.selectedOutbound=o.no;if(recheck)recheck.outboundNo=o.no;x.row.outbound=o.no;event(x,'生成出货单',o.no+' · '+line(qty),actor);return o;
}
function differenceAllowed(scope,a,exp){
 if(same(a,exp))return true;
 if(!v('differenceReason').trim())return fail('数量有差异，填写差异原因；评审工具可模拟本次授权。');
 if(!s.auth||s.auth.scope!==scope||!same(s.auth.qty,a))return fail('差异待授权，本次尚未完成；请使用评审工具模拟当前数量的授权。');
 return true;
}
function save(){
 if(Date.now()<(s.readyAt||0))return;
 const x=rnow();if(!x||!gate())return;
 const k=stage(x);
 if(k==='receive'){
  const a=nums();if(!a)return;let when=now();
  if(v('at')){const date=new Date(v('at'));if(!Number.isFinite(date.getTime())||date.getTime()>Date.now())return fail('实际点收时间不能晚于现在。');if(!v('delay').trim())return fail('补登早前点收时，填写补登原因。');when=date.toLocaleString('zh-CN');}
  x.counts=[...a];x.receivedBy=who().name;x.receivedAt=when;event(x,'后道点收确认',line(a)+(v('delay')?' · 补登 '+v('delay'):'')+' · 录入 '+now());x.row.received=sum(a);
  if(x.row.returnRecord)Object.assign(x.row.returnRecord,{actual:[...a],status:'已确认待送检',receiver:who().name,receivedAt:when});
  syncSource(x);freshForm(x);return ok('点收已登记，下一步将本次回货交到质检工作区。');
 }
 if(k==='send'){x.sent={actor:who().name,time:now()};x.row.used=sum(x.counts);if(x.row.returnRecord)x.row.returnRecord.status='已送检';event(x,'整量送检',line(x.counts)+' → 质检工作区');syncSource(x);return ok('已送检，等待质检结果。');}
 if(k!=='flow')return fail('当前没有可提交的后道动作。');
 const a=nums();if(!a)return;
 if(x.view==='work'){
  const p=progress(x);if(!p.items.includes(x.process))return fail('该加工项不在质检确认范围内。');
  if(sum(a)===0)return fail('至少登记1件本次完成量，不保存空记录。');
  const available=p.forItem(x.process);if(a.some((value,i)=>value>available[i]))return fail('超过该尺码本次可登记量：'+line(available)+'。不能跨尺码抵扣或补造前序。');
  const record={item:x.process,qty:[...a],responsible:who().name,recordedBy:who().name,time:now()};x.processEntries.push(record);event(x,'登记'+x.process+'本次完成',line(a)+'；责任人 '+record.responsible);
  syncSource(x);const total=sum(progress(x).counts[x.process]);initForm(x);return ok('本次已保存 '+sum(a)+' 件，'+x.process+'累计 '+total+' 件；可独立交复检。');
 }
 if(x.view==='submit'){
  const p=progress(x);if(!x.qc.items.length||sum(a)===0)return fail('本次至少交复检1件，不生成空单。');
  if(a.some((value,i)=>value>p.available[i]))return fail('超过本尺码可交复检量：'+line(p.available)+'；已有复检占用不能重复使用。');
  const r={no:'FH-'+x.id.slice(3)+'-'+String(x.rechecks.length+1).padStart(3,'0'),qty:[...a],actual:null,codes:{},checker:null,status:'待复检',createdBy:who().name,createdAt:now(),outboundNo:null};
  x.rechecks.push(r);x.selectedRecheck=r.no;event(x,'创建复检单',r.no+' · '+line(a)+'；创建即占用');syncSource(x);initForm(x);return ok('已生成 '+r.no+'，立即占用 '+sum(a)+' 件；其余数量继续加工。');
 }
 if(x.view==='check'){
  const r=currentCheck(x);if(!r||r.status==='已复核'||r.checker!==who().name)return fail('请由本张领取人复检，已完成单不能重复出货。');
  if(sum(a)===0)return fail('实际总量为0，不完成复检、不生成空出货单，原占用保留。');
  if(a.some((value,i)=>r.qty[i]===0&&value>0))return fail('本张未交入的尺码不能补入实际复核量，请按本张应交尺码登记。');
  if(r.qty.some((value,i)=>value>0&&r.codes[i?'l':'m']!=='正确'))return fail('应交数量大于0的尺码，须正确核对条码；错码先重贴再复扫。');
  const p=progress(x);if(a.some((value,i)=>Math.max(0,value-r.qty[i])>p.available[i]))return fail('多交量超过本尺码未占用完成量，授权不能增加实物完成量。');
  if(!differenceAllowed(r.no,a,r.qty))return;
  r.actual=[...a];r.status='已复核';r.completedBy=who().name;r.completedAt=now();r.differenceReason=v('differenceReason');event(x,'复检完成',r.no+' · '+line(a));const o=makeOut(x,a,'后道复检',who().name,r);syncSource(x);initForm(x);return ok('本张复检完成，已生成 '+o.no+'；其他复检分别处理。');
 }
 const o=currentOut(x);if(!o||s.receivingOut!==o.no)return fail('先选择具体出货单并进入成衣仓实收。');if(o.receipt)return fail('本张已经实收，不可重复覆盖。');
 if(!differenceAllowed(o.no,a,o.qty))return;
 o.receipt={qty:[...a],actor:who().name,time:now(),differenceReason:v('differenceReason')};event(x,'成衣仓独立实收',o.no+' · '+line(a));syncSource(x);s.receivingOut=null;freshForm(x);return ok(same(a,o.qty)?'本张实收一致；父单按全部加工及后续余量判断。':'本张实收差异已记录，其他出货单不受影响。');
}
function expected(x){
 if(stage(x)==='receive')return x.registered;
 if(stage(x)!=='flow')return x.counts||x.registered;
 const p=progress(x);
 return x.view==='work'?p.forItem(x.process):x.view==='submit'?p.available:x.view==='check'?currentCheck(x)?.qty||[0,0]:currentOut(x)?.qty||[0,0];
}
function update(){const x=rnow();if(!x||!own()||screen==='post-material')return;const a=[n('m'),n('l')],valid=a.every(Number.isFinite),exp=expected(x),live=$('#pf-live');if(live)live.textContent=valid?'本次 '+sum(a)+' 件 · '+a.map((value,i)=>(i?'L':'M')+' / 可用或应交 '+exp[i]).join('；'):'按实物逐码填写，空白不算0';const footer=$('.footer');if(footer)footer.innerHTML=primary();}
function open(id){all();const x=s.batches[id];if(!x)return fail('没有找到这次原回货。');if(window.pdaFloorScanTarget?.({family:'pf',current:id,screen:'post-batch'}))return;if(dirty)return fail('当前填写尚未提交，请先保存或清空。');s.current=id;s.error='';s.notice='';s.scan='';initForm(x);go('post-batch',true);}
function scan(raw){
 const code=raw.trim().toUpperCase();s.scan=code;
 const x=all().find(x=>[x.id,x.row.code,...(x.qc&&sum(x.qc.pass)>0&&x.qc.items.length?['JG-'+x.id.slice(3)]:[]),...x.rechecks.map(r=>r.no),...x.outbounds.map(o=>o.no)].includes(code));
 if(!x)return fail('未找到完整单号，或尚未生成本张单据。请核对后重扫。');if(x.row.discarded)return fail('本次回货已废弃，不能继续操作。');if(dirty)return fail('当前填写未提交，请先保存或清空。');
 if(x.rechecks.some(r=>r.no===code)){x.view='check';x.selectedRecheck=code;}
 else if(x.outbounds.some(o=>o.no===code)){x.view='out';x.selectedOutbound=code;}
 else if(code.startsWith('JG-'))x.view='work';
 open(x.id);
}
function publicHandoff(record){all();if(record&&s.batches[record.no]){s.current=record.no;s.origin='warehouse-home';s.role='receive';go('post-batch',true);}else go('warehouse-home',true);}
s.afterPublicExit=publicHandoff;
for(const key of ['post-batch','post-material']){catalog.push([key,key==='post-batch'?'后道作业':'后道辅料入库','后整 · V9',key==='post-batch'?'分项登记，多次复检、出货和独立实收。':'整单按实配数量入库。','示例只存页面内存，刷新后重置。']);pageCap[key]='后整';}
renderers['post-batch']=body;renderers['post-material']=materialPage;
for(const [key,old] of [['warehouse-home',prior.warehouse],['receive-list',prior.receive],['process-list',prior.list]])renderers[key]=()=>selectedOp==='后整'?rootPage(key):old();
function target(id){return selectedOp==='后整'&&['wh7-post-receive','wh7-post-qc','wh7-post-work','wh7-post-out','wh-query','wh-count','handoff','receive-check','receive-difference','material-receive','process-finishing','finishing-recheck','task-detail','task-work','handover-detail'].includes(id)?'post-batch':id;}
go=function(id,force=false){return prior.go(target(id),force);};
openTask=function(id){if(selectedOp==='后整'&&all().some(x=>x.id===id||id==='HZ-082'))return open(id==='HZ-082'?'SH-082':id);return prior.open(id);};
setStep=function(id){if(selectedOp==='后整')return go(target(id));return prior.step(id);};
submit=function(){if(own())return save();return prior.submit();};
function review(){return `<div class="note-box" id="pf-review"><b>后道分支评审 · 不属于PDA</b>${b('质检：四项全选','qc-normal')}${b('质检：仅装扣子→包装','qc-two')}${b('质检：仅熨烫','qc-single')}${b('质检：三方责任，仅包装','qc-extra')}${b('质检：不选项目，直接出货','qc-direct')}${b('质检：合格0','qc-zero')}${b('模拟本次差异授权','authorize-demo')}<p id="pf-review-state"></p><p>仅提供上游质检与授权样例。实际身份沿用当前示例操作人；所有记录仅在页面内存，刷新重置。</p></div>`;}
render=function(){
 if(selectedOp==='后整'&&!sewingReturn.locked){screen=target(screen);if(own()){cap='后整';done=null;taskWorkspace=false;}}
 prior.render();
 for(const el of document.querySelectorAll('[data-review=fill],[data-review=reset]')){el.hidden=selectedOp==='后整';el.style.display=selectedOp==='后整'?'none':'';}
 $('#pf-review')?.remove();
 if(selectedOp==='后整'){$('#v7-review')?.remove();$('#review-receipt')?.remove();if(screen!=='sewing-return')$('#sr-review')?.remove();$('.review-notes').insertAdjacentHTML('beforeend',review());}
 if(own()&&!sewingReturn.locked){
  $('.appbar').innerHTML=b(I('back')+'<span class="pf-sr-only">返回</span>','back','back')+'<h2>'+(screen==='post-material'?'辅料入库':'后道作业')+'</h2><span class="pf-role">'+esc(who().name)+'<small>页面内存演示</small></span>';
  $('.content').classList.add('pf-content');$('.footer').innerHTML=primary();
  $('#note-body').textContent='原回货身份保持；各项记录本次完成量，已完成部分可多次交复检、出货和实收。';
  $('#note-source').textContent='V9 后道分项与多次下游交互样例；纯内存，刷新重置，不代表主应用已保存或现场执行。';update();
  // Later shared render wrappers write a generic source note; keep this sample's boundary explicit.
  queueMicrotask(()=>{if(selectedOp==='后整'&&own()){if($('#note-source'))$('#note-source').textContent='依据2026-10-19后道逐项加工与多次复检出货方案。页面内存示例，刷新重置；不代表主应用持久化或工厂现场验收。';for(const el of document.querySelectorAll('[data-review=fill],[data-review=reset]')){el.hidden=true;el.style.display='none';}}});
 }
 const url=new URL(location.href);url.searchParams.set('v','9');if(own())url.searchParams.set('screen',screen);history.replaceState({},'',url);window.pdaPostFlowReady=9;
};
function modal(action,title,text){sheet(title,text+'<label class="label" for="pf-modal-reason">原因</label><input id="pf-modal-reason" class="pf-modal-input" placeholder="填写本次原因"><div id="pf-modal-error" class="error"></div>',b(title,action,'primary'));}
window.addEventListener('input',e=>{const key=e.target.dataset.pfField;if(!key)return;fields()[key]=e.target.value;dirty=true;s.auth=null;s.error='';if($('#pf-error'))$('#pf-error').textContent='';update();},true);
window.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const id=e.target.id;if(id==='pf-scan'){e.preventDefault();e.stopImmediatePropagation();scan(e.target.value);}if(id==='pf-material-code'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)handle('material-scan');}if(id.startsWith('pf-code-')){e.preventDefault();e.stopImmediatePropagation();handle('scan-'+id.slice(-1));}},true);
function selectView(x,view){
 if(dirty)return fail('本次填写尚未提交，先保存或清空再切换。');
 x.view=view;s.receivingOut=null;s.error='';s.notice='';initForm(x);render();
}
function setQc(x,mode){
 const zero=mode==='zero',direct=mode==='direct',pass=x.counts.map(value=>zero?0:direct?value:Math.max(0,value-2)),defect=x.counts.map((value,i)=>value-pass[i]);
 x.qc={pass,defect,returned:[0,0],items:direct?[]:mode==='two'?['装扣子','包装']:mode==='single'?['熨烫']:mode==='extra'?['包装']:[...ITEMS],taskType:direct||mode==='extra'?'车缝＋烫包':'仅车缝',responsibility:direct||mode==='extra'?'三方工厂负责':'后道工厂负责',source:mode==='extra'?'质检补加工':direct?'质检直达':'任务后道',actor:'Dewi · 质检员'};
 x.process=x.qc.items[0]||ITEMS[0];event(x,'质检结果就绪','合格 '+line(pass)+'；实际加工链 '+(x.qc.items.join('→')||'无'),x.qc.actor);
 if(direct&&sum(pass)>0){makeOut(x,pass,'质检直达',x.qc.actor);x.view='out';}else x.view='work';
 syncSource(x);initForm(x);
}
function handle(action){
 const x=rnow();
 if(action.startsWith('open:'))return open(action.slice(5));
 if(action==='public')return go('sewing-return');
 if(action==='scan-open'||action==='next-batch'){if(dirty)return fail('本次填写未提交，先保存或清空。');s.current=null;if(action==='scan-open')s.origin=screen;s.error='';s.notice='';return go('post-batch');}
 if(action==='scan')return scan($('#pf-scan').value);
 if(action==='material'){s.materialOpen=false;s.origin=screen;return go('post-material');}
 if(action==='material-select'||action==='material-scan'){
  const code=action==='material-select'?s.material.no:$('#pf-material-code').value.trim();if(code!==s.material.no)return fail('未找到完整辅料调拨单号，不提供模糊候选。');if(!['待入库','已入库'].includes(s.material.status))return fail('辅料尚未备妥，不能确认入库。');s.materialOpen=true;s.error='';return render();
 }
 if(action==='material-save'){if(!gate())return;if(s.material.inbound)return fail('本单已入库，不能重复。');if(!s.materialOpen||s.material.status!=='待入库')return fail('只有已识别的待入库辅料单可整单入库。');s.material.inbound={actor:who().name,time:now()};s.material.status='已入库';return ok('辅料已按实配整单入库。');}
 if(action==='back'||action==='home')return go(s.origin||'warehouse-home');
 if(action==='refresh'){s.error='';s.notice=x&&stage(x)==='qc'?'质检结果尚未就绪，保留当前回货等待。':'已读取本单当前进度。';return render();}
 if(action==='save')return save();
 if(action.startsWith('qc-')){if(!x||stage(x)!=='qc'){$('#pf-review-state').textContent='只为已送检、尚无结果的当前回货登记质检样例。';return;}if(!gate())return;setQc(x,action.slice(3));return ok('质检结果就绪；各项按实际选择顺序独立登记。');}
 if(!x)return;
 if(action==='clear-form'){initForm(x);s.error='';s.notice='未保存填写已清空，正式历史保留。';return render();}
 if(action.startsWith('view:'))return selectView(x,action.slice(5));
 if(action==='check-list'){x.selectedRecheck=null;return selectView(x,'check');}
 if(action==='out-list'){x.selectedOutbound=null;return selectView(x,'out');}
 if(action.startsWith('item:')){if(dirty)return fail('本次填写未提交，先保存或清空。');const item=action.slice(5);if(!progress(x).items.includes(item))return fail('未勾选的加工项不生成待办。');x.process=item;return selectView(x,'work');}
 if(action.startsWith('check:')){if(dirty)return fail('本次填写未提交，先保存或清空。');x.selectedRecheck=action.slice(6);return selectView(x,'check');}
 if(action.startsWith('out:')){if(dirty)return fail('本次填写未提交，先保存或清空。');x.selectedOutbound=action.slice(4);return selectView(x,'out');}
 if(action==='claim-check'){const r=currentCheck(x);if(!gate()||!r||r.status==='已复核')return fail('本张不能领取。');if(r.checker&&r.checker!==who().name)return fail('本张已有其他领取人。');r.checker=who().name;r.status='复检中';event(x,'领取复检单',r.no);initForm(x);return ok('已领取 '+r.no+'，逐码核对数量与条码。');}
 if(action==='receive-out'){const o=currentOut(x);if(!o||o.receipt)return fail('先选择未实收的具体出货单。');s.receivingOut=o.no;initForm(x);s.error='';return render();}
 if(action==='authorize-demo'){
  const r=x.view==='check'?currentCheck(x):currentOut(x),scope=r?.no,a=nums();
  if(!scope||!a||!v('differenceReason').trim())return fail('先选择本张复检或出货，填写数量和差异原因。');
  s.auth={scope,qty:[...a],actor:'评审模拟授权',time:now()};s.notice='仅评审工具：已模拟当前单号与数量的差异授权。';s.error='';return render();
 }
 if(action.startsWith('scan-')||action.startsWith('relabel-')||action.startsWith('label-')){
  const r=currentCheck(x);if(!gate()||x.view!=='check'||!r||r.status==='已复核'||r.checker!==who().name)return fail('请由本张复检领取人核对条码。');
  const key=action.slice(-1);
  if(action.startsWith('label-'))return sheet('正确标签预览',product('hoodie')+panel(kv('尺码',key.toUpperCase())+kv('正确条码','SKU-082-'+key.toUpperCase()))+note('仅设计预览，未发送到实体打印机。','info'));
  if(action.startsWith('relabel-')){if(r.codes[key]!=='条码错误')return;r.codes[key]='已重贴，待复扫';event(x,'条码已重贴',r.no+' · '+key.toUpperCase());x.form['code'+key]='';return render();}
  if(r.codes[key]==='条码错误')return fail('先更换正确标签并点“已重新贴码”，再复扫。');
  r.codes[key]=v('code'+key).trim()==='SKU-082-'+key.toUpperCase()?'正确':'条码错误';event(x,'核对条码',r.no+' · '+key.toUpperCase()+' · '+r.codes[key]);return render();
 }
 if(action==='release'){const r=currentCheck(x);if(!r||r.status==='已复核'||r.checker!==who().name)return fail('仅本张领取人可释放。');return modal('release-save','释放本张领取',panel(kv('复检单',r.no))+'<p>解除人员领取并清空本张未提交复核，原加工与复检占用保留。</p>');}
 if(action==='discard')return modal('discard-save','废弃本次回货',panel(kv('原送货单',x.id)+kv('登记数量',line(x.registered)))+'<p>本次不再点收，保留原登记与废弃原因。</p>');
 if(action==='release-save'||action==='discard-save'){
  const reason=$('#pf-modal-reason').value.trim(),err=text=>$('#pf-modal-error').textContent=text;if(!reason)return err('填写本次原因。');if(scenario!=='normal')return err('本次未保存，原因已保留。');
  if(action==='release-save'){const r=currentCheck(x);if(!r||r.status==='已复核'||r.checker!==who().name)return err('本单领取或状态已变化。');event(x,'释放复检领取',r.no+' · '+reason+'；数量占用保留');r.checker=null;r.codes={};r.status='待复检';}
  else{if(stage(x)!=='receive')return err('仅未确认点收的原回货可废弃。');x.row.discarded=true;if(x.row.returnRecord)Object.assign(x.row.returnRecord,{status:'已废弃',reason,discardedBy:who().name,discardedAt:now()});event(x,'废弃原回货登记',reason);}
  freshForm(x);closeSheet();return ok(action==='release-save'?'已释放领取，原数量占用保留。':'已废弃本次回货登记。');
 }
}
window.addEventListener('click',e=>{
 if(own()&&e.target.closest('[data-action=discard]')){const x=rnow();if(x)freshForm(x);s.error='';}
 const el=e.target.closest('[data-pf]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();handle(el.dataset.pf);
},true);
all();
// Explicit URL fixtures for review only; normal interaction starts with original receipt.
const demo=params.get('demo');
if(['receive','work','two','single','partial','multiple','check','out','receipt','direct','zero'].includes(demo)){
 const x=s.batches['SH-082'];s.current=x.id;selectedOp='后整';screen='post-batch';
 if(demo!=='receive'){
  x.counts=['partial','multiple','work','two','single'].includes(demo)?[600,400]:[60,40];x.registered=[...x.counts];
  x.receivedBy='Rina';x.receivedAt='2026/10/19 09:00';x.sent={actor:'Rina',time:'2026/10/19 09:10'};
  setQc(x,demo==='two'?'two':demo==='single'?'single':demo==='direct'?'direct':demo==='zero'?'zero':'normal');
  // The 1000-piece review fixtures have no QC deductions.
  if(['partial','multiple','work','two','single'].includes(demo)){x.qc.pass=[...x.counts];x.qc.defect=[0,0];x.history.at(-1).detail='合格 '+line(x.qc.pass)+'；实际加工链 '+x.qc.items.join('→');}
  if(['partial','multiple','check','out','receipt'].includes(demo)){
   const quantities=['partial','multiple'].includes(demo)?[[300,200],[180,120],[120,80],[60,40]]:ITEMS.map(()=>[...x.qc.pass]);
   ITEMS.forEach((item,i)=>x.processEntries.push({item,qty:quantities[i],responsible:i%2?'Budi':'Lina',recordedBy:i%2?'Budi':'Lina',time:'2026/10/19 10:'+String(i*5).padStart(2,'0')}));
   event(x,'分项样例就绪','各项完成量独立，责任分别保留','评审夹具');
  }
  if(['check','out','receipt','multiple'].includes(demo)){
   const r={no:'FH-082-001',qty:demo==='multiple'?[60,40]:[...x.qc.pass],actual:null,codes:{},checker:demo==='check'?null:'Ayu',status:demo==='check'?'待复检':'复检中',createdBy:'Lina',createdAt:'2026/10/19 10:30'};x.rechecks.push(r);x.selectedRecheck=r.no;x.view='check';
   if(['out','receipt','multiple'].includes(demo)){r.actual=[...r.qty];r.status='已复核';const o=makeOut(x,r.qty,'后道复检','Ayu',r);x.view='out';if(demo==='receipt')o.receipt={qty:[57,39],actor:'Sari',time:'2026/10/19 11:30'};}
  }
  syncSource(x);initForm(x);
 }
}
const requested=params.get('screen');if(requested?.startsWith('wh7-post-')){selectedOp='后整';screen='post-batch';}if(['post-batch','post-material'].includes(requested)){selectedOp='后整';screen=requested;}
s.roleOptions=roles;s.progress=id=>progress(s.batches[id]);s.stageName=id=>stageName(s.batches[id]);render();
})();
