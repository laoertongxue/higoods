async page=>{
 const context=await page.context().browser().newContext(),p=await context.newPage();await p.goto('http://127.0.0.1:43225/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
 const result=await p.evaluate(async()=>{
  const d=await import('/src/data/fcs/cutting/cutting-record-repository.ts'),s=await import('/src/data/fcs/cutting/replacement-fabric-source.ts');
  const before=await d.readCuttingRecords(),guard=s.captureReplacementFabricSourceGuard(),key='higood.runtime-process-task-actions.v1',raw=localStorage.getItem(key);localStorage.setItem(key,'{"changedByOtherTab":true}');let sourceConflict='';
  try{await d.commitCuttingRecords({revision:before.revision,change:{puts:[{id:'source-race',collection:'test',value:{}}]},command:{id:'source-race',intent:'source-race',at:'2026-09-25',result:true},assertSourcesCurrent:guard})}catch(e){sourceConflict=e.message}
  if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);
  const unchanged=JSON.stringify(before)===JSON.stringify(await d.readCuttingRecords());if(!sourceConflict||!unchanged)throw Error('源版本冲突未原子阻断');
  let changed=false;window.addEventListener('cutting-record-versionchange',()=>changed=true,{once:true});
  const upgraded=await new Promise((resolve,reject)=>{const request=indexedDB.open(d.CUTTING_RECORD_DB,2);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('旧连接未释放'));request.onsuccess=()=>{request.result.close();resolve(true)}});
  let staleVersion='';try{await d.readCuttingRecords()}catch(e){staleVersion=e.message}
  if(!changed||!staleVersion.includes('用户数据无法读取'))throw Error('升级后旧代码未明确阻断');
  return {sourceConflict,unchanged,versionchangeReleased:changed,upgraded,staleVersion};
 });
 await context.close();
 const q=await page.context().browser().newContext(),qp=await q.newPage();await qp.addInitScript(()=>{const native=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fcs_pda_session')return native.call(this,k,v);throw new DOMException('模拟满额','QuotaExceededError')}});await qp.goto('http://127.0.0.1:43225/fcs/craft/cutting/replacement-fabric-fei-tickets');await qp.locator('[data-hpb-page], [role=alert]').first().waitFor();const quota=await qp.locator('body').innerText();
 const quotaOpen=await qp.locator('[data-hpb-page]').count()>0;let quotaSave=false;if(quotaOpen){await qp.locator('[data-hpb-action="detail"]').first().click();await qp.locator('[data-hpb-action="add"]').first().click();await qp.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('已新增 1 张'));quotaSave=true}
 await q.close();return {result,quotaOpen,quotaSave,quotaMessage:quotaOpen?'页面可打开':quota.slice(-1000)};
}
