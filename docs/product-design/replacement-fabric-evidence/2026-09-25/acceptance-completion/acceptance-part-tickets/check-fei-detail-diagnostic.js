async root=>{const browser=root.context().browser(),results=[];
for(let sample=1;sample<=1;sample++){
const name='fei-detail',selector='[data-cutting-fei-action=open-manual-create]';
const c=await browser.newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.routeWebSocket('**',()=>{});
  await p.addInitScript(({selector})=>{
   localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'F090_operator',loginId:'F090_operator',userName:'裁片操作工',roleId:'ROLE_OPERATOR',factoryId:'F090',factoryName:'测试工厂',loggedAt:'2026-09-25 11:00:00'}));
   window.__measure={selector,start:0,result:0};let pending=false;
   window.__tick=()=>{const m=window.__measure;if(m.result||pending||!m.start&&m.start!==0)return;let ready=m.predicate?m.predicate():document.querySelector(m.selector);if(!ready)return;const imgs=[...document.querySelectorAll('[data-page-content-root] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight});if(imgs.some(i=>!i.complete))return;pending=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(window.__measure===m){m.result=performance.now()-m.start;}pending=false;}));};
   new MutationObserver(()=>window.__tick()).observe(document,{childList:true,subtree:true,attributes:true});document.addEventListener('load',()=>window.__tick(),true);
  },{selector});
  const collect=async scene=>{await p.waitForFunction(()=>window.__measure.result>0,null,{timeout:10000});results.push({name,sample,scene,ms:await p.evaluate(()=>window.__measure.result),errors:[...errors],brokenImages:await p.evaluate(()=>[...document.querySelectorAll('[data-page-content-root] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&i.complete&&!i.naturalWidth}).map(i=>i.src))})};
  const action=async(scene,selector,predicate)=>{await p.evaluate(({selector,predicate})=>{window.__measure={start:null,result:0,predicate:Function('return ('+predicate+')')()};document.addEventListener('click',function start(e){if(!(e.target instanceof Element)||!e.target.closest(selector))return;document.removeEventListener('click',start,true);window.__measure.start=performance.now()},{capture:true})},{selector,predicate});await p.locator(selector).first().click();await collect(scene)};

const rows=()=>p.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('higood-cutting-records-v1');q.onsuccess=()=>{const db=q.result,r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{resolve(r.result);db.close()}}}));
try {
await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/fei-tickets');await p.locator(selector).click();await p.locator('[data-cutting-fei-manual-field=layerCount]').fill('5');await p.locator('[data-cutting-fei-manual-field=remark]').fill('明细动作验收');await action('create-manual','[data-cutting-fei-action=confirm-manual-create]','()=>document.body.textContent.includes("已按唛架")');
const initial=await rows(),manual=initial.filter(r=>r.collection==='part-ticket:manual-records');if(manual.length!==12)throw Error('应生成12张手工票');
const detailUrl='http://127.0.0.1:43235/fcs/craft/cutting/fei-tickets/'+encodeURIComponent('spreading:'+manual[0].value.manualBatchId);
await p.goto(detailUrl);await p.locator('[data-cutting-fei-action=open-detail-add]').click();await p.locator('[data-cutting-fei-detail-dialog-field=qty]').fill('17');await p.locator('[data-cutting-fei-detail-dialog-field=remark]').fill('增加独立部位票');
await action('add','[data-cutting-fei-action=confirm-detail-add]','()=>document.body.textContent.includes("已新增未打印菲票")');
const afterAdd=await rows(),added=afterAdd.find(r=>r.collection==='part-ticket:manual-records'&&!manual.some(m=>m.id===r.id));if(!added||added.value.qty!==17)throw Error('新增票数量必须17');
await p.locator('[data-cutting-fei-action=open-detail-edit][data-ticket-id="'+added.value.feiTicketId+'"]').click();await p.locator('[data-cutting-fei-detail-dialog-field=qty]').fill('19');await p.locator('[data-cutting-fei-detail-dialog-field=remark]').fill('修正数量');
await action('edit','[data-cutting-fei-action=confirm-detail-edit]','()=>document.body.textContent.includes("数量修改为 19片")');
if((await rows()).find(r=>r.id===added.id)?.value.qty!==19)throw Error('修改数量未保存');
await p.locator('[data-cutting-fei-action=open-detail-delete][data-ticket-id="'+added.value.feiTicketId+'"]').click();await action('delete','[data-cutting-fei-action=confirm-detail-delete]','()=>document.body.textContent.includes("已删除该未打印手动菲票")');
if((await rows()).some(r=>r.id===added.id))throw Error('删除票仍存在');
await p.locator('[data-cutting-fei-action=request-detail-all-print]').click();await p.locator('[data-cutting-fei-action=confirm-detail-print]').click();await p.locator('[data-print-preview-action=print]').waitFor();await p.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;window.__tick()}});
await action('first-print','[data-print-preview-action=print]','()=>window.__printCalls===1');
await p.goto(detailUrl);await p.locator('[data-cutting-fei-action=request-detail-all-reprint]').click();await p.locator('[data-cutting-fei-detail-print-field=reason]').fill('验收补打保持身份');await p.locator('[data-cutting-fei-action=confirm-detail-print]').click();await p.locator('[data-print-preview-action=print]').waitFor();await p.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;window.__tick()}});
await action('reprint','[data-print-preview-action=print]','()=>window.__printCalls===1');
const final=await rows(),finalManual=final.filter(r=>r.collection==='part-ticket:manual-records');if(finalManual.length!==12||finalManual.some(r=>!manual.some(m=>m.id===r.id&&m.value.feiTicketNo===r.value.feiTicketNo)))throw Error('补打不得新增或变更票身份');results.at(-1).persisted=final;
await p.goto(detailUrl);await p.getByText('补打（12）',{exact:true}).waitFor();results.push({sample,scene:'reload',manualCount:finalManual.length,errors});
}catch(e){results.push({sample,error:String(e),errors,body:(await p.locator('body').innerText()).slice(-3000)})}finally{await c.close()}
}return{version:'frozen sources',results,failed:results.filter(r=>r.error||r.ms>=500||r.errors?.length||r.brokenImages?.length)};}
