async root=>{const browser=root.context().browser(),results=[];
for(let sample=1;sample<=5;sample++){
const name='pda-stages',selector='[data-pda-cut-spreading-action=start-spreading]';
const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.addInitScript(({selector})=>{
   localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'F090_operator',loginId:'F090_operator',userName:'裁片操作工',roleId:'ROLE_OPERATOR',factoryId:'F090',factoryName:'测试工厂',loggedAt:'2026-09-25 11:00:00'}));
   window.__measure={selector,start:0,result:0};let pending=false;
   window.__tick=()=>{const m=window.__measure;if(m.result||pending||!m.start&&m.start!==0)return;let ready=m.predicate?m.predicate():document.querySelector(m.selector);if(!ready)return;const imgs=[...document.querySelectorAll('[data-page-content-root] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight});if(imgs.some(i=>!i.complete))return;pending=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(window.__measure===m){m.result=performance.now()-m.start;}pending=false;}));};
   new MutationObserver(()=>window.__tick()).observe(document,{childList:true,subtree:true,attributes:true});document.addEventListener('load',()=>window.__tick(),true);
  },{selector});
  const collect=async scene=>{await p.waitForFunction(()=>window.__measure.result>0,null,{timeout:10000});results.push({name,sample,scene,ms:await p.evaluate(()=>window.__measure.result),errors:[...errors],brokenImages:await p.evaluate(()=>[...document.querySelectorAll('[data-page-content-root] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&i.complete&&!i.naturalWidth}).map(i=>i.src))})};
  const action=async(scene,selector,predicate)=>{await p.evaluate(({selector,predicate})=>{window.__measure={start:null,result:0,predicate:Function('return ('+predicate+')')()};document.addEventListener('click',function start(e){if(!(e.target instanceof Element)||!e.target.closest(selector))return;document.removeEventListener('click',start,true);window.__measure.start=performance.now()},{capture:true})},{selector,predicate});await p.locator(selector).first().click();await collect(scene)};

try {
await p.goto('http://127.0.0.1:43236/fcs/pda/cutting/spreading/TASK-CUT-000201?executionOrderId=CPO-20260318-A1&executionOrderNo=CPO-20260318-A1');await p.locator(selector).waitFor();
await p.locator('[data-pda-cut-spreading-field=cuttingTableId]').selectOption({label:'裁床1'});
await action('start-spreading',selector,'()=>document.body.textContent.includes("开始铺布已提交")');
await action('finish-without-roll','[data-pda-cut-spreading-action=finish-spreading]','()=>document.body.textContent.includes("必须至少提交一卷记录后")');
for(const [field,value] of [['layerCount','50'],['actualLength','2'],['headLength','0'],['tailLength','0']])await p.locator('[data-pda-cut-spreading-field='+field+']').fill(value);
await p.locator('[data-pda-cut-spreading-field=note]').fill('全阶段真实保存验收');
await action('submit-roll','[data-pda-cut-spreading-submit-stage=submit-roll]','()=>document.body.textContent.includes("本卷已提交")');
for(const [field,value] of [['layerCount','50'],['actualLength','2'],['headLength','0'],['tailLength','0']])await p.locator('[data-pda-cut-spreading-field='+field+']').fill(value);
await p.evaluate(()=>{window.__partPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,...args){if(v?.collection==='part-ticket:spreading-sessions')throw Error('验收注入第二卷保存失败');return window.__partPut.call(this,v,...args)}});
await action('second-roll-failure','[data-pda-cut-spreading-submit-stage=submit-roll]','()=>document.body.textContent.includes("验收注入第二卷保存失败")');
const preservedInput=await p.locator('[data-pda-cut-spreading-field=layerCount]').inputValue();if(preservedInput!=='50')throw Error('保存失败未保留第二卷层数');
await p.evaluate(()=>IDBObjectStore.prototype.put=window.__partPut);
await action('second-roll-retry','[data-pda-cut-spreading-submit-stage=submit-roll]','()=>document.body.textContent.includes("本卷已提交")&&!document.body.textContent.includes("验收注入第二卷保存失败")');
await action('finish-spreading','[data-pda-cut-spreading-action=finish-spreading]','()=>document.body.textContent.includes("完成铺布已提交")');
await action('start-cutting','[data-pda-cut-spreading-action=start-cutting]','()=>document.body.textContent.includes("开始裁剪已提交")');
await p.locator('[data-pda-cut-spreading-field=actualCutQty]').fill('6900');await p.locator('[data-pda-cut-spreading-field=actualUsage]').fill('200');
await action('finish-cutting','[data-pda-cut-spreading-submit-stage=finish-cutting]','()=>document.body.textContent.includes("完成裁剪已提交")');
const persisted=await p.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('higood-cutting-records-v1');q.onsuccess=()=>{const db=q.result,r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{resolve(r.result.filter(x=>['part-ticket:spreading-sessions','cutting-events'].includes(x.collection)));db.close()}}}));results.at(-1).persisted=persisted;
const events=persisted.filter(r=>r.collection==='cutting-events'),session=persisted.find(r=>r.collection==='part-ticket:spreading-sessions')?.value;
if(events.length!==6||new Set(events.map(r=>r.id)).size!==6)throw Error('六个现场动作必须保留六个不同事件');
const rollEvents=events.filter(r=>r.value.payload.recordType==='提交本卷');if(rollEvents.length!==2||new Set(rollEvents.map(r=>r.value.payload.fabricRollNo)).size!==2)throw Error('两卷必须保留两个不同身份');
if(!events.some(r=>r.value.eventType==='开始铺布'&&r.value.payload.stageOnly)||session?.rolls?.length!==2)throw Error('开工事实或卷明细丢失');
if(session.totalActualLength!==200||session.actualCutPieceQty!==6900||events.some(r=>r.value.refs.spreadingOrderId!=='CPO-20260318-A1'))throw Error('实际用量/裁剪数量/铺布单引用不一致');
await p.reload();await p.getByText(/已同步：完成裁剪/).waitFor();results.push({sample,scene:'reload-completed',body:(await p.locator('body').innerText()).slice(-3500),errors});
}catch(e){results.push({sample,error:String(e),errors,body:(await p.locator('body').innerText()).slice(-3000)})}finally{await c.close()}
}return{version:'post-build5 frozen sources',results,failed:results.filter(r=>r.error||r.ms>=500||r.errors?.length||r.brokenImages?.length)};}
