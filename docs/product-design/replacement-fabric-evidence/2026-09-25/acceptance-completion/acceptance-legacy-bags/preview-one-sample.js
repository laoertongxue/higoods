async page => {
 const results=[], route='/fcs/craft/cutting/transfer-bags', origin='http://127.0.0.1:43236';
 const readRecords=async p=>p.evaluate(async()=>{const r=indexedDB.open('higood-cutting-records-v1');const db=await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const values=await new Promise((ok,no)=>{const x=db.transaction('records').objectStore('records').getAll();x.onsuccess=()=>ok(x.result);x.onerror=()=>no(x.error)});db.close();return values.filter(x=>x.collection?.startsWith('part-ticket:bag-'))});
 for(let sample=1;sample<=1;sample++){
  const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  const row={sample,errors};
  try{
   await p.addInitScript(()=>{
    window.__bagPerf={writes:[],actions:[],commits:[],fault:false};
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__bagPerf.writes.push(k);return set.call(this,k,v)};
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,...args){if(v?.collection?.includes('bag-masters')){if(window.__bagPerf.fault)throw new DOMException('模拟袋档案空间不足','QuotaExceededError');this.transaction.addEventListener('complete',()=>window.__bagPerf.commits.push(performance.now()),{once:true})}return put.call(this,v,...args)};
    const ready=()=>!!document.querySelector('[data-transfer-bags-action=new-master]')&&!!document.querySelector('tbody tr');
    const finish=async(start,label,condition)=>{while(!condition())await new Promise(requestAnimationFrame);await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():i.decode().catch(()=>{})));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);window.__bagPerf.actions.push({label,ms:performance.now()-start,at:performance.now()})};
    finish(0,'load',ready);
    document.addEventListener('click',e=>{const el=e.target.closest('[data-transfer-bags-action],[data-nav]');if(!el)return;const a=el.dataset.transferBagsAction;
     if(a==='save-master'){const code=document.querySelector('[data-transfer-bags-master-draft-field=bagCode]').value;const start=performance.now();const fault=window.__bagPerf.fault;finish(start,fault?'save-failure':'save-success',()=>fault?document.body.innerText.includes('本次操作未保存'):!document.querySelector('[data-transfer-bags-action=save-master]')&&document.body.innerText.includes(code)&&window.__bagPerf.commits.some(t=>t>=start))}
     if(a==='new-master')finish(performance.now(),'open-dialog',()=>!!document.querySelector('[data-transfer-bags-action=save-master]'));
     if(el.dataset.nav?.split('?')[0]==='/fcs/craft/cutting/transfer-bags')finish(performance.now(),'route-return',ready);
    },true);
   });
   await p.goto(origin+route);await p.waitForFunction(()=>window.__bagPerf.actions.some(a=>a.label==='load'));row.cold=await p.evaluate(()=>window.__bagPerf.actions.find(a=>a.label==='load').ms);row.initialRecords=(await readRecords(p)).length;
   await p.reload();await p.waitForFunction(()=>window.__bagPerf.actions.some(a=>a.label==='load'));row.refresh=await p.evaluate(()=>window.__bagPerf.actions.find(a=>a.label==='load').ms);
   await p.locator('tr').filter({hasText:'BAG-A-001'}).getByRole('button',{name:'查看袋内菲票明细和差异类型'}).click();await p.getByRole('button',{name:'返回中转袋流转'}).waitFor();row.detailUrl=p.url();row.printManifestButtons=await p.locator('[data-transfer-bags-action=print-manifest]').count();await p.getByRole('button',{name:'返回中转袋流转'}).click();await p.waitForFunction(()=>window.__bagPerf.actions.some(a=>a.label==='route-return'));row.navigation=await p.evaluate(()=>window.__bagPerf.actions.find(a=>a.label==='route-return').ms);
   const code=`BAG-PREVIEW-${sample}`;await p.locator('[data-transfer-bags-action=new-master]').click();await p.locator('[data-transfer-bags-master-draft-field=bagCode]').fill(code);await p.locator('[data-transfer-bags-master-draft-field=note]').fill('原子保存输入保留');
   await p.evaluate(()=>window.__bagPerf.fault=true);await p.locator('[data-transfer-bags-action=save-master]').click();await p.waitForFunction(()=>window.__bagPerf.actions.some(a=>a.label==='save-failure'));row.failure=await p.evaluate(()=>window.__bagPerf.actions.find(a=>a.label==='save-failure').ms);row.failureRecords=(await readRecords(p)).length;row.preserved={code:await p.locator('[data-transfer-bags-master-draft-field=bagCode]').inputValue(),note:await p.locator('[data-transfer-bags-master-draft-field=note]').inputValue()};
   if(sample===1)await p.screenshot({path:'/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-legacy-bags/preview-failure.png'});
   if(row.failureRecords||row.preserved.code!==code||row.preserved.note!=='原子保存输入保留')throw new Error('failure rollback/input assertion');
   await p.evaluate(()=>window.__bagPerf.fault=false);await p.locator('[data-transfer-bags-action=save-master]').click();await p.waitForFunction(()=>window.__bagPerf.actions.some(a=>a.label==='save-success'));row.save=await p.evaluate(()=>window.__bagPerf.actions.find(a=>a.label==='save-success').ms);row.savedRecords=await readRecords(p);if(row.savedRecords.length!==2)throw new Error('save must have exactly own master and reuse summary');row.actions=await p.evaluate(()=>window.__bagPerf.actions);row.storageWrites=await p.evaluate(()=>window.__bagPerf.writes);
   if(sample===1)await p.screenshot({path:'/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-legacy-bags/preview-save.png'});
   await p.reload();await p.waitForFunction(()=>window.__bagPerf.actions.some(a=>a.label==='load'));await p.locator('[data-transfer-bags-master-field=keyword]').fill(code);await p.locator('tr').filter({hasText:code}).waitFor();row.reloadedRow=await p.locator('tr').filter({hasText:code}).innerText();row.afterRefreshRecords=(await readRecords(p)).length;
   if(sample===1){const before=JSON.stringify(await readRecords(p));await p.locator('[data-transfer-bags-action=new-master]').click();await p.locator('[data-transfer-bags-master-draft-field=bagCode]').fill('BAG-PREVIEW-PRESERVE');await p.evaluate(()=>window.__bagPerf.fault=true);await p.locator('[data-transfer-bags-action=save-master]').click();await p.waitForFunction(()=>document.body.innerText.includes('本次操作未保存'));row.existingSavedRecordsUnchangedOnLaterFailure=before===JSON.stringify(await readRecords(p));if(!row.existingSavedRecordsUnchangedOnLaterFailure)throw new Error('existing user records changed on failed save')} 
   if(errors.length||row.afterRefreshRecords!==2)throw new Error('page error or missing persistence');
  }catch(e){row.error=String(e);row.body=(await p.locator('body').innerText()).slice(-1500)}finally{await c.close()}results.push(row);if(row.error)break
 }
 return {environment:{origin,route,viewport:'1366x768',browser:page.context().browser().version(),cold:'new isolated context per sample',measurement:'navigationStart or capture click through committed result DOM, images decode, and two animation frames; persisted records read back separately'},results};
}
