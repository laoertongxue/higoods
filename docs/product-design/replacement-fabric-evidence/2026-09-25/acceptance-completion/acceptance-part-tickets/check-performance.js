async root=>{
 const browser=root.context().browser(),results=[];
 const routes=[['fei','/fcs/craft/cutting/fei-tickets','[data-cutting-fei-action=open-manual-create]'],['print','/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=mock-fei-ticket-ordinary-001&paperColor=WHITE','[data-print-preview-action=print]'],['spreading','/fcs/craft/cutting/spreading-list','[data-cutting-marker-action=create-spreading]'],['pda','/fcs/pda/cutting/spreading/TASK-CUT-000201?executionOrderId=CPO-20260318-A1&executionOrderNo=CPO-20260318-A1','[data-pda-cut-spreading-action=start-spreading]']];
 for(const [name,path,selector] of routes)for(let sample=1;sample<=5;sample++){
  const c=await browser.newContext({viewport:name==='pda'?{width:390,height:844}:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.addInitScript(({selector})=>{
   localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'F090_operator',loginId:'F090_operator',userName:'裁片操作工',roleId:'ROLE_OPERATOR',factoryId:'F090',factoryName:'测试工厂',loggedAt:'2026-09-25 11:00:00'}));
   window.__measure={selector,start:0,result:0};let pending=false;
   window.__tick=()=>{const m=window.__measure;if(m.result||pending||!m.start&&m.start!==0)return;let ready=m.predicate?m.predicate():document.querySelector(m.selector);if(!ready)return;const imgs=[...document.querySelectorAll('[data-page-content-root] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight});if(imgs.some(i=>!i.complete))return;pending=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(window.__measure===m){m.result=performance.now()-m.start;}pending=false;}));};
   new MutationObserver(()=>window.__tick()).observe(document,{childList:true,subtree:true,attributes:true});document.addEventListener('load',()=>window.__tick(),true);
  },{selector});
  const collect=async scene=>{await p.waitForFunction(()=>window.__measure.result>0,null,{timeout:10000});results.push({name,sample,scene,ms:await p.evaluate(()=>window.__measure.result),errors:[...errors],brokenImages:await p.evaluate(()=>[...document.querySelectorAll('[data-page-content-root] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&i.complete&&!i.naturalWidth}).map(i=>i.src))})};
  const action=async(scene,selector,predicate)=>{await p.evaluate(({selector,predicate})=>{window.__measure={start:null,result:0,predicate:Function('return ('+predicate+')')()};document.addEventListener('click',function start(e){if(!(e.target instanceof Element)||!e.target.closest(selector))return;document.removeEventListener('click',start,true);window.__measure.start=performance.now()},{capture:true})},{selector,predicate});await p.locator(selector).first().click();await collect(scene)};
  try{
   await p.goto('http://127.0.0.1:43236'+path);await collect('cold');await p.reload();await collect('refresh');
   await p.goto('http://127.0.0.1:43236/fcs/craft/cutting/handover-orders');await p.locator('[data-handover-list-root]').waitFor({timeout:10000});
   await p.evaluate(({path,selector})=>{window.__measure={start:performance.now(),result:0,selector};history.pushState(null,'',path);dispatchEvent(new PopStateEvent('popstate'))},{path,selector});await collect('navigation');
   if(name==='fei'){
    await action('open-manual','[data-cutting-fei-action=open-manual-create]','()=>document.querySelector("[data-cutting-fei-action=confirm-manual-create]")');
    await p.locator('[data-cutting-fei-manual-field=layerCount]').fill('5');await p.locator('[data-cutting-fei-manual-field=remark]').fill('首打性能验收');
    await action('save-manual','[data-cutting-fei-action=confirm-manual-create]','()=>document.querySelector("[data-fei-feedback-surface]")?.textContent.includes("已按唛架")');
    const href=await p.locator('[data-nav*="sourceId=mock-fei-ticket-ordinary-"]').first().getAttribute('data-nav');await p.goto('http://127.0.0.1:43236'+href);await p.locator('[data-print-preview-action=print]').waitFor({timeout:10000});
    await p.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;window.__tick()}});
    await action('actual-first-print','[data-print-preview-action=print]','()=>window.__printCalls===1');
    const persisted=await p.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('higood-cutting-records-v1');q.onsuccess=()=>{const db=q.result,r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{resolve(r.result.filter(x=>x.collection==='part-ticket:records').length);db.close()}}}));results.at(-1).persistedTickets=persisted;
   }else if(name==='spreading'){
    const start=p.locator('[data-cutting-marker-action=start-cutting]').first(),id=await start.getAttribute('data-session-id');
    await action('start-cutting',`[data-cutting-marker-action=start-cutting][data-session-id="${id}"]`,`()=>document.querySelector('[data-cutting-marker-action=finish-cutting][data-session-id="${id}"]')`);
   }else if(name==='pda'){
    await p.locator('[data-pda-cut-spreading-field=cuttingTableId]').selectOption({label:'裁床1'});await p.locator('[data-pda-cut-spreading-field=note]').fill('PDA首个保存性能');
    await action('start-spreading','[data-pda-cut-spreading-action=start-spreading]','()=>document.body.textContent.includes("开始铺布已提交")');
   }
  }catch(e){results.push({name,sample,error:String(e),errors,body:(await p.locator('body').innerText()).slice(-1200)})}finally{await c.close()}
 }
 return {version:'build-7 2026-09-25 source-build7.json',environment:'Chromium local preview43236; fresh isolated contexts, 1366x768 Web / 390x844 PDA; navigation0/event to content+images+2RAF',results,failed:results.filter(r=>r.error||r.ms>=500||r.errors?.length||r.brokenImages?.length),max:Math.max(...results.map(r=>r.ms||0))};
}
