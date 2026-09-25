async page=>{
 const results=[];
 for(const scene of ['create','abort']){
  const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  try{
   await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/transfer-bags');await p.locator('[data-transfer-bags-action=new-master]').click();
   await p.locator('[data-transfer-bags-master-draft-field=bagCode]').fill('BAG-ACCEPT-ATOMIC');await p.locator('[data-transfer-bags-master-draft-field=note]').fill('原子保存输入保留');
   await p.evaluate(scene=>{window.__bagWrites=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__bagWrites.push(k);return set.call(this,k,v)};const put=IDBObjectStore.prototype.put;window.__bagPut=put;IDBObjectStore.prototype.put=function(v,...args){if(v?.collection?.includes('bag-masters')&&scene==='abort')throw new DOMException('袋档案模拟空间不足','QuotaExceededError');return put.call(this,v,...args)}},scene);
   await p.locator('[data-transfer-bags-action=save-master]').click();
   if(scene==='create')await p.waitForFunction(()=>!document.querySelector('[data-transfer-bags-action=save-master]')&&document.body.innerText.includes('BAG-ACCEPT-ATOMIC'));
   else await p.waitForFunction(()=>document.body.innerText.includes('未保存'));
   const result={scene,errors,writes:await p.evaluate(()=>window.__bagWrites),dialog:await p.locator('[data-transfer-bags-action=save-master]').count(),body:(await p.locator('body').innerText()).slice(-800)};
   result.records=await p.evaluate(async()=>{const req=indexedDB.open('higood-cutting-records-v1',1);const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});const rows=await new Promise((res,rej)=>{const r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();return rows.map(r=>({id:r.id,collection:r.collection}))});
   if(scene==='abort'){result.input=await p.locator('[data-transfer-bags-master-draft-field=bagCode]').inputValue();result.note=await p.locator('[data-transfer-bags-master-draft-field=note]').inputValue()}
   await p.screenshot({path:`/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-legacy-bags/ui-${scene}.png`});
   if(scene==='create'){await p.reload();await p.locator('[data-transfer-bags-master-field=keyword]').fill('BAG-ACCEPT-ATOMIC');await p.waitForFunction(()=>[...document.querySelectorAll('tr')].some(e=>e.innerText.includes('BAG-ACCEPT-ATOMIC')));result.afterReload=await p.locator('tr').filter({hasText:'BAG-ACCEPT-ATOMIC'}).innerText()}
   results.push(result)
  }catch(e){results.push({scene,error:String(e),errors,body:(await p.locator('body').innerText()).slice(-2000)})}finally{await c.close()}
 }return results;
}
