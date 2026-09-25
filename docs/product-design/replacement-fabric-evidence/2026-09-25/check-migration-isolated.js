async(page)=>{const context=await page.context().browser().newContext(),p=await context.newPage();await p.goto('http://127.0.0.1:43225/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();const result=await p.evaluate(async()=>{
 const db=await import('/src/data/fcs/cutting/cutting-record-repository.ts');const m=await import('/src/data/fcs/cutting/cutting-event-migration.ts');
 const key='cuttingRuntimeEventLedger',old=localStorage.getItem(key),run=crypto.randomUUID();const result={};
 const event=i=>({eventId:`MFAIL-${run}-${i}`,eventNo:`MFAIL-${i}`,eventType:'菲票装袋',eventStatus:'已同步',eventSource:'PDA',occurredAt:'2026-09-25',createdAt:'2026-09-25',refs:{},payload:{}});
 try{
  const raw=JSON.stringify({events:Array.from({length:101},(_,i)=>event(i))});localStorage.setItem(key,raw);
  try{await m.migrateLegacyCuttingEvents({otherPagesClosed:true,progress:()=>{throw Error('模拟迁移中断')}})}catch(e){result.interrupt=e.message}
  result.sourcePreserved=localStorage.getItem(key)===raw;
  result.resumeCount=await m.migrateLegacyCuttingEvents({otherPagesClosed:true,progress:()=>{}});
  result.uniqueTargets=(await db.readCuttingRecords()).records.filter(r=>r.id.startsWith('cutting-event:MFAIL-'+run)).length;
  localStorage.setItem(key,JSON.stringify({events:[event('changed')]}));
  try{await m.migrateLegacyCuttingEvents({otherPagesClosed:true,progress:()=>localStorage.setItem(key,JSON.stringify({events:[event('changed'),event('late')]}))})}catch(e){result.oldPage=e.message}
  result.latePreserved=JSON.parse(localStorage.getItem(key)).events.length===2;
  localStorage.setItem(key,JSON.stringify({events:[{...event(0),operatorName:'冲突内容'}]}));
  try{await m.migrateLegacyCuttingEvents({otherPagesClosed:true,progress:()=>{}})}catch(e){result.conflict=e.message}
  localStorage.setItem(key,JSON.stringify({events:[event('after-cleanup')]}));const put=IDBObjectStore.prototype.put;
  try{IDBObjectStore.prototype.put=function(row){if(this.name==='records'&&row.collection==='cutting-migrations'&&row.value.phase==='COMPLETE')throw Error('模拟完成标记写失败');return put.apply(this,arguments)};await m.migrateLegacyCuttingEvents({otherPagesClosed:true,progress:()=>{}})}catch(e){result.afterCleanup=e.message}finally{IDBObjectStore.prototype.put=put}
  const progress=[];await m.migrateLegacyCuttingEvents({otherPagesClosed:true,progress:m=>progress.push(m)});result.cleanupResume=progress;
 }finally{if(old===null)localStorage.removeItem(key);else localStorage.setItem(key,old)}
 if(!result.sourcePreserved||result.resumeCount!==101||result.uniqueTargets!==101||!result.oldPage||!result.latePreserved||!result.conflict||!result.cleanupResume.some(m=>m.includes('已恢复迁移完成记录')))throw Error(JSON.stringify(result));
 return result;
});await context.close();return result;}
