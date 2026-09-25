async(page)=>{
 const browser=page.context().browser(),results=[];
 for(const scene of ['commit','abort','cas','legacy','migration-interrupt','migration-changed','migration-complete-retry']){
  const c=await browser.newContext(),p=await c.newPage();await p.route('**/acceptance-core',r=>r.fulfill({contentType:'text/html',body:'<html><body>Core storage acceptance</body></html>'}));await p.goto('http://127.0.0.1:43235/acceptance-core');
  try{results.push(await p.evaluate(async(scene)=>{
   const m=await import('/src/data/fcs/production-context-records.ts'),r=await import('/src/data/fcs/cutting/cutting-record-repository.ts');
   const key=m.PRODUCTION_CONTEXT_KEYS.orders,raw=(n=1)=>JSON.stringify({version:1,orders:Array.from({length:n},(_,i)=>({productionOrderId:'p'+i,status:'WAIT_ASSIGNMENT'}))});const assert=(b,msg)=>{if(!b)throw Error(msg)};const errors=[];const rejects=async(fn,part)=>{try{await fn();throw Error('DID_NOT_REJECT')}catch(e){assert(!String(e).includes('DID_NOT_REJECT'),part+': did not reject');if(part)assert(String(e).includes(part),String(e));errors.push(String(e));}};
   if(scene==='legacy'){
    localStorage.setItem(key,raw());assert((await m.listProductionContextMigrationStatus())[0].phase==='PENDING','pending visible');await rejects(()=>m.hydrateProductionContextRecords(),'先完成显式迁移');assert(!m.isProductionContextReady(),'not ready');assert((await r.readCuttingRecords()).records.length===0,'read did not seed');return {scene,errors};
   }
   if(scene.startsWith('migration-')){
    localStorage.setItem(key,raw(205));localStorage.setItem('unrelated','keep');let stopped=false;const originalPut=IDBObjectStore.prototype.put;
    if(scene==='migration-complete-retry')IDBObjectStore.prototype.put=function(v,...args){if(v?.id==='source-migration:'+key&&v.value.phase==='COMPLETE'&&!stopped){stopped=true;throw new DOMException('injected-complete-failure','QuotaExceededError')}return originalPut.call(this,v,...args)};
    await rejects(()=>m.migrateProductionContextRecords({otherPagesClosed:true,progress:t=>{if(scene==='migration-complete-retry')return;if(!stopped){stopped=true;if(scene==='migration-changed')localStorage.setItem(key,raw(206));else throw Error('injected-interrupt');}}}),scene==='migration-complete-retry'?'injected-complete-failure':scene==='migration-changed'?'改变':'injected-interrupt');
    IDBObjectStore.prototype.put=originalPut;const partial=await r.readCuttingRecords();
    if(scene==='migration-complete-retry'){assert(localStorage.getItem(key)===null,'verified source removed');assert(partial.records.find(x=>x.id==='source-migration:'+key).value.phase==='VERIFIED','verified checkpoint');}
    else {assert(partial.records.filter(x=>x.collection==='production-context:orders').length===100,'batch100 atomic');assert(localStorage.getItem(key)!==null,'source retained')}
    if(scene==='migration-changed'){await rejects(()=>m.migrateProductionContextRecords({otherPagesClosed:true,progress:()=>{}}),'改变');assert(JSON.parse(localStorage.getItem(key)).orders.length===206,'changed source retained');return{scene,errors,records:partial.records.length};}
    await m.migrateProductionContextRecords({otherPagesClosed:true,progress:()=>{}});const final=await r.readCuttingRecords();assert(final.records.filter(x=>x.collection==='production-context:orders').length===205,'no duplication');assert(localStorage.getItem(key)===null&&localStorage.getItem('unrelated')==='keep','selective cleanup');assert((await m.listProductionContextMigrationStatus()).every(x=>x.phase==='COMPLETE'),'all complete');
    Storage.prototype.getItem=function(){throw Error('disabled')};await m.hydrateProductionContextRecords();assert(JSON.parse(m.readProductionContextValue(key)).orders.length===205,'no LS after migration');return{scene,errors,records:205};
   }
   await m.hydrateProductionContextRecords();assert((await r.readCuttingRecords()).records.length===0,'no seed');let memory={v:0},calls=0,restores=[];let notifications=0;m.onProductionContextChanged(key,()=>{notifications++;if(m.readProductionContextValue(key))memory=JSON.parse(m.readProductionContextValue(key)).orders[0]});
   const action=()=>{calls++;memory={productionOrderId:'p0',v:1};m.writeProductionContextValue(key,JSON.stringify({version:1,orders:[memory]}));return{ok:1}};
   const capture=()=>memory,restore=v=>{memory=v;restores.push(v);m.writeProductionContextValue(key,JSON.stringify({version:1,orders:v.productionOrderId?[v]:[]}))};
   if(scene==='abort'){
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,...args){if(v?.collection==='production-context:orders')throw new DOMException('injected-abort','QuotaExceededError');return put.call(this,v,...args)};await rejects(()=>m.saveProductionContextAction({id:'abort',intent:'x',action,capture,restore}),'injected-abort');IDBObjectStore.prototype.put=put;assert(memory.v===0,'memory rollback');assert((await r.readCuttingRecords()).records.length===0,'atomic rollback');assert(notifications===0,'no premature publish');await m.saveProductionContextAction({id:'abort',intent:'x',action,capture,restore});return{scene,errors,memory,calls};
   }
   if(scene==='cas'){
    const external=await r.openCuttingRecordDatabase();let queued=false;const actionCas=()=>{const out=action();const tx=external.transaction(['meta'],'readwrite');tx.objectStore('meta').put({id:'revision',value:77});queued=true;return out};await rejects(()=>m.saveProductionContextAction({id:'cas',intent:'x',action:actionCas,capture,restore}),'其他页面');assert(memory.v===0,'cas rollback');assert(!(await r.readCuttingRecords()).records.some(x=>x.collection==='production-context:orders'),'no cas writes');return{scene,errors,queued};
   }
   const first=m.saveProductionContextAction({id:'same',intent:'x',action,capture,restore});await rejects(()=>m.saveProductionContextAction({id:'other',intent:'x',action,capture,restore}),'尚未完成');const saved=await first;assert(calls===1&&memory.v===1,'published');assert((await r.readCuttingRecords()).records.filter(x=>x.collection==='production-context:orders').length===1,'one record');const replay=await m.saveProductionContextAction({id:'same',intent:'x',action,capture,restore});assert(calls===1&&replay.ok===saved.ok,'replay no action');await rejects(()=>m.saveProductionContextAction({id:'same',intent:'different',action,capture,restore}),'不同内容');Storage.prototype.getItem=function(){throw Error('disabled')};await m.hydrateProductionContextRecords();assert(JSON.parse(m.readProductionContextValue(key)).orders[0].v===1,'first-save marker allows disabledLS');return{scene,errors,calls,notifications,restores};
  },scene))}catch(e){results.push({scene,error:String(e)})}finally{await c.close()}
 }
 return{results,failed:results.filter(x=>x.error)};
}
