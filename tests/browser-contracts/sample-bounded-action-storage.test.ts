import assert from 'node:assert/strict'
import test from 'node:test'
import {chromium,type Page} from '@playwright/test'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
const base=process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43127'
const output=resolve(process.env.QUALITY_SAMPLE_BOUNDED_REPORT_PATH || 'output/qc-implementation-20261022/sample-bounded-action-native-results.json')
const image=readFileSync('public/tshirt-sample.jpg'),upload=Buffer.alloc(2*1024*1024)
image.copy(upload);upload.write('SAMPLE-BOUNDED-NEW-RECEIPT',image.length)
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
async function connect(page:Page){
 await page.route('**/__sample-bounded-contract',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh"><body></body></html>'}))
 await page.goto(base+'/__sample-bounded-contract')
 await page.evaluate(async()=>{
  const p=await import('/src/data/fcs/production-context-records.ts'),s=await import('/src/data/fcs/sewing-sample-approval-suggestion.ts'),a=await import('/src/data/fcs/production-context-actions.ts')
  const db=await import('/src/data/fcs/cutting/cutting-record-repository.ts'),demo=await import('/src/data/fcs/sewing-outsourcing-demo.ts'),orders=await import('/src/data/fcs/production-orders.ts')
  ;(window as any).__bounded={p,s,a,db,demo,orders}
 })
}
test('原生单件PP动作：2000件历史保护、Blob/命令同事务、失败稳定重试、CAS、fast→原generic→冷读', {timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
 await context.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
 const evidence:any={base,passed:false,kind:'隔离原生公开样衣动作/原库事务契约；2000件合法历史夹具，不是现场事实、原页面或性能'}
 const pageErrors:string[]=[];context.on('page',p=>p.on('pageerror',e=>pageErrors.push(e.message)));page.on('pageerror',e=>pageErrors.push(e.message))
 try{
  await connect(page)
  evidence.fixture=await page.evaluate(async({inline,sha})=>{
   const {p,s,db,demo,orders}=(window as any).__bounded,defaults=demo.getDefaultSewingSampleApprovalRecords()
   const records=[],sourceOrders=[]
   for(let index=0;index<2000;index++){
    const original=defaults[index===0?0:2],record=structuredClone(original),assignmentId=`BOUND-ASG-${index}`,orderId=`BOUND-ORDER-${index}`
    record.assignmentId=assignmentId;record.sample.assignmentId=assignmentId;record.sample.runtimeTaskId=`BOUND-TASK-${index}`;record.sample.sampleId=`BOUND-SAMPLE-${index}`
    const originalOrder=orders.productionOrders.find((o:any)=>o.productionOrderId===original.sample.productionOrderId),order=structuredClone(originalOrder)
    order.productionOrderId=orderId;order.productionOrderNo=orderId;order.techPackSnapshot.productionOrderId=orderId;order.techPackSnapshot.productionOrderNo=orderId
    order.selectedTechPackVersionId=order.techPackSnapshot.sourceTechPackVersionId;sourceOrders.push(order)
    record.sample.productionOrderId=orderId;record.sample.productionOrderNo=orderId;record.assignmentAliases=[{assignmentId,runtimeTaskId:record.sample.runtimeTaskId}]
    record.referenceSnapshots.forEach((ref:any)=>{if(ref.sourceObjectId===original.sample.productionOrderId)ref.sourceObjectId=orderId})
    record.suggestionVersions.forEach((v:any)=>{v.assignmentId=assignmentId;v.runtimeTaskId=record.sample.runtimeTaskId;v.sampleId=record.sample.sampleId;v.suggestionVersionId=`BOUND-OLD-${index}`})
    if(record.suggestionVersions.length)record.latestSuggestionVersionId=record.suggestionVersions.at(-1).suggestionVersionId
    if(index>0){record.sample.ppicReceivedSamplePhotoUrls=[{$productionFile:`production-context-file:${sha}`}];record.legacyHistory={original:{history:`原完整历史${index}`,refs:[{$productionFile:`production-context-file:${sha}`}]},convertedAt:'2026-10-22T00:00:00Z',convertedBy:'原核对人',unverifiedTime:true,note:'原资料保留'}}
    records.push(record)
   }
   orders.validatePersistedProductionOrders(sourceOrders)
   const rows=[...p.decodeProductionContextRecords(p.PRODUCTION_CONTEXT_KEYS.orders,JSON.stringify({version:1,orders:sourceOrders})),
    ...p.decodeProductionContextRecords(p.PRODUCTION_CONTEXT_KEYS.samples,JSON.stringify({version:3,records,commands:records.map((r:any)=>[`BOUND-OLD-CMD-${r.assignmentId}`,{assignmentId:r.assignmentId,action:'HISTORICAL'}]),sequence:6000}))]
   const initial=await db.readCuttingRecords(),blob=await(await fetch(inline)).blob()
   await db.commitCuttingRecords({revision:initial.revision,change:{puts:rows,files:[{id:`production-context-file:${sha}`,blob}]},command:{id:'BOUND-EXPLICIT-HISTORICAL-FIXTURE',intent:'合法2000原样衣/正式生产单历史预装，非本期业务已执行',result:2000,at:'2026-10-22T00:00:00Z'}})
   await p.hydrateProductionContextRecords();s.listSewingSampleApprovalRecords()
   return {samples:records.length,originalOpinionsFrozen:records.slice(1).every((r:any)=>r.sample.status==='SUGGESTION_UPLOADED'&&!!r.inspectionStandardSnapshot&&r.suggestionVersions.length===1),entities:rows.length,originalBlob:sha}
  },{inline:`data:image/jpeg;base64,${image.toString('base64')}`,sha:hash(image)})
  const snapshot=async(p:Page)=>p.evaluate(async()=>{
   const {db,s}=(window as any).__bounded,backup=await db.exportCuttingRecordBackup(),sha=async(v:BufferSource)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',v))].map(n=>n.toString(16).padStart(2,'0')).join('')
   const record=backup.records.find((r:any)=>r.id==='production-context:samples:BOUND-ASG-0'),other=backup.records.filter((r:any)=>r.id!=='production-context:samples:BOUND-ASG-0'&&!r.id.startsWith('source-migration:')&&!r.id.startsWith('production-context:sample-commands:BOUND-NEW')&&r.id!=='production-context:sample-meta:sequence'&&r.id!=='production-context:runtime-meta:sequence')
   return {revision:(await db.readCuttingRecords()).revision,record:record?.value,samples:backup.records.filter((r:any)=>r.collection==='production-context:samples').length,
    allSha:await sha(new TextEncoder().encode(JSON.stringify(backup.records))),otherSha:await sha(new TextEncoder().encode(JSON.stringify(other))),commands:backup.commands.map((c:any)=>({id:c.id,intent:c.intent})),
    domainCommands:backup.records.filter((r:any)=>r.id.startsWith('production-context:sample-commands:BOUND-NEW')),
    files:await Promise.all(backup.files.map(async(f:any)=>({id:f.id,size:f.blob.size,sha256:await sha(await f.blob.arrayBuffer())}))),memory:s.getSewingSampleApprovalRecord('BOUND-ASG-0')}
  })
  evidence.before=await snapshot(page)
  evidence.actual=await page.evaluate(async({inline,expectedHash})=>{
   const {p,s,a,db}=(window as any).__bounded,record=s.getSewingSampleApprovalRecord('BOUND-ASG-0'),actor={actorId:record.sample.currentPpicId,actorName:record.sample.currentPpicName,role:'PPIC'}
   const native={put:IDBObjectStore.prototype.put,getAll:IDBObjectStore.prototype.getAll,setItem:Storage.prototype.setItem,add:IDBObjectStore.prototype.add,transaction:IDBDatabase.prototype.transaction}
   let armed=true,rejected='',getAlls=0,lsWrites=0;const puts:string[]=[],beforeComplete:string[]=[],transactionCompleteStates:string[]=[]
   IDBDatabase.prototype.transaction=function(...args:Parameters<typeof native.transaction>){const tx=native.transaction.apply(this,args);if(tx.mode==='readwrite')tx.addEventListener('complete',()=>transactionCompleteStates.push(s.getSewingSampleApprovalRecord('BOUND-ASG-0').sample.status));return tx}
   IDBObjectStore.prototype.getAll=function(...args:Parameters<typeof native.getAll>){getAlls++;return native.getAll.apply(this,args)}
   Storage.prototype.setItem=function(...args:Parameters<typeof native.setItem>){lsWrites++;return native.setItem.apply(this,args)}
   IDBObjectStore.prototype.put=function(...args:Parameters<typeof native.put>){
    const value=args[0];if(this.transaction.mode==='readwrite'){
     puts.push(`${this.name}:${value.id}`);beforeComplete.push(s.getSewingSampleApprovalRecord('BOUND-ASG-0').sample.status)
     if(armed&&this.name==='files')throw new DOMException('原生样衣文件提交故障','QuotaExceededError')
    }return native.put.apply(this,args)
   }
   const receive=()=>a.saveSewingSampleSourceUiAction('BOUND-ASG-0','BOUND-NEW-RECEIVE','bounded actual receive',()=>s.receivePreProductionSampleByPpic({commandId:'BOUND-NEW-RECEIVE',assignmentId:'BOUND-ASG-0',actor,receivedAt:'2026-10-22T02:00:00Z',receivedSamplePhotoUrls:[inline]}))
   try{
    try{await receive()}catch(e){rejected=String(e)}
    const failedBackup=await db.exportCuttingRecordBackup(),failedRecord=failedBackup.records.find((r:any)=>r.id==='production-context:samples:BOUND-ASG-0').value
    const failed={recordsSha:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(failedBackup.records))))].map(n=>n.toString(16).padStart(2,'0')).join(''),revision:(await db.readCuttingRecords()).revision,fileCount:failedBackup.files.length,error:rejected,status:s.getSewingSampleApprovalRecord('BOUND-ASG-0').sample.status,recordStatus:failedRecord.sample.status,
     commandPresent:failedBackup.records.some((r:any)=>r.id==='production-context:sample-commands:BOUND-NEW-RECEIVE'),filePresent:failedBackup.files.some((f:any)=>f.id===`production-context-file:${expectedHash}`),inputStillAvailable:inline.startsWith('data:image/jpeg;base64,')&&inline.length>2000000,receiptCount:failedBackup.commands.filter((c:any)=>c.id.startsWith('SAMPLE-UI:')).length}
    // Snapshot/export is deliberate verification and excluded from action scope counters.
    getAlls=0;puts.length=0;beforeComplete.length=0;transactionCompleteStates.length=0;armed=false
    const saved=await receive(),counters={getAlls,lsWrites,puts:[...puts],beforeComplete:[...beforeComplete],transactionCompleteStates:[...transactionCompleteStates]}
    return {failed,counters,savedStatus:saved.sample.status}
   }finally{IDBObjectStore.prototype.put=native.put;IDBObjectStore.prototype.getAll=native.getAll;Storage.prototype.setItem=native.setItem;IDBDatabase.prototype.transaction=native.transaction}
  },{inline:`data:image/jpeg;base64,${upload.toString('base64')}`,expectedHash:hash(upload)})
  evidence.afterReceive=await snapshot(page)
  assert.equal(evidence.fixture.samples,2000);assert.equal(evidence.fixture.originalOpinionsFrozen,true)
  assert.match(evidence.actual.failed.error,/QuotaExceeded|尚未保存/);assert.equal(evidence.actual.failed.status,'WAITING_PPIC_RECEIVE');assert.equal(evidence.actual.failed.recordStatus,'WAITING_PPIC_RECEIVE')
  assert.equal(evidence.actual.failed.commandPresent,false);assert.equal(evidence.actual.failed.filePresent,false);assert.equal(evidence.actual.failed.receiptCount,0);assert.equal(evidence.actual.failed.inputStillAvailable,true);assert.equal(evidence.actual.failed.recordsSha,evidence.before.allSha);assert.equal(evidence.actual.failed.revision,evidence.before.revision);assert.equal(evidence.actual.failed.fileCount,evidence.before.files.length)
  assert.equal(evidence.actual.counters.getAlls,0);assert.equal(evidence.actual.counters.lsWrites,0);assert.ok(evidence.actual.counters.beforeComplete.every((s:string)=>s==='WAITING_PPIC_RECEIVE'));assert.deepEqual(evidence.actual.counters.transactionCompleteStates,['WAITING_PPIC_RECEIVE'])
  assert.ok(evidence.actual.counters.puts.every((id:string)=>id==='records:production-context:samples:BOUND-ASG-0'||id==='records:production-context:sample-commands:BOUND-NEW-RECEIVE'||id.startsWith('records:source-migration:')||id.startsWith('files:production-context-file:')||id==='meta:revision'),JSON.stringify(evidence.actual.counters.puts))
  assert.equal(evidence.afterReceive.samples,2000);assert.equal(evidence.afterReceive.otherSha,evidence.before.otherSha);assert.equal(evidence.afterReceive.domainCommands.length,1)
  assert.equal(evidence.actual.savedStatus,'PPIC_RECEIVED')
  assert.equal(evidence.afterReceive.files.find((f:any)=>f.id===`production-context-file:${hash(upload)}`).size,upload.length)
  // Exercise the original generic non-sample command and its synchronous legacy
  // storage consumer after the fast PP write. This explicitly updates only the
  // existing runtime audit sequence; it is not a fabricated physical task action.
  evidence.generic=await page.evaluate(async()=>{
   const {p,s}= (window as any).__bounded
   const capture=()=>p.productionContextStorage.getItem(p.PRODUCTION_CONTEXT_KEYS.runtime),before=capture()
   const old=before?JSON.parse(before):{version:1,taskOverrides:[],splitPlans:[],mergedPlans:[],reassignedTasks:[],auditSeq:0}
   await p.saveProductionContextAction({id:'BOUND-GENERIC-NON-SAMPLE',intent:'原generic同步runtime来源契约',capture,restore:(v:any)=>p.productionContextStorage.setItem(p.PRODUCTION_CONTEXT_KEYS.runtime,v),action:()=>{p.productionContextStorage.setItem(p.PRODUCTION_CONTEXT_KEYS.runtime,JSON.stringify({...old,auditSeq:old.auditSeq+1}));return old.auditSeq+1}})
   return {status:s.getSewingSampleApprovalRecord('BOUND-ASG-0').sample.status,legacyStatus:JSON.parse(p.productionContextStorage.getItem(p.PRODUCTION_CONTEXT_KEYS.samples)).records.find((r:any)=>r.assignmentId==='BOUND-ASG-0').sample.status}
  })
  assert.equal(evidence.generic.status,'PPIC_RECEIVED');assert.equal(evidence.generic.legacyStatus,'PPIC_RECEIVED')
  evidence.replay=await page.evaluate(async()=>{
   const {p,db}=(window as any).__bounded,backup=await db.exportCuttingRecordBackup(),receipt=backup.commands.find((c:any)=>c.id.startsWith('SAMPLE-UI:'))
   let calls=0;const before=(await db.readCuttingRecords()).revision
   await p.saveProductionSampleContextAction({id:receipt.id,intent:'bounded actual receive',commandId:'BOUND-NEW-RECEIVE',capture:()=>{throw Error('已提交命令重放不可执行capture')},restore:()=>{},action:()=>{calls++;throw Error('不可重复实收')}})
   return {calls,before,after:(await db.readCuttingRecords()).revision}
  })
  assert.equal(evidence.replay.calls,0);assert.equal(evidence.replay.before,evidence.replay.after)

  // Both tabs must read the same revision before either native write begins.
  const second=await context.newPage();await connect(second);await second.evaluate(async()=>{const {p,s}=(window as any).__bounded;await p.hydrateProductionContextRecords();s.listSewingSampleApprovalRecords()})
  let arrivals=0;let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve})
  await context.exposeBinding('sampleRevisionBarrier',async()=>{if(++arrivals===2)release();await barrier})
  const concurrent=(p:Page,commandId:string)=>p.evaluate(async(commandId)=>{
   const {s,a}=(window as any).__bounded,nativeGet=IDBObjectStore.prototype.get,descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess')!
   let seenRevision:number|undefined,held=false,error='',ok=false
   IDBObjectStore.prototype.get=function(...args:Parameters<typeof nativeGet>){
    const request=nativeGet.apply(this,args)
    if(!held&&this.name==='meta'&&args[0]==='revision'&&this.transaction.mode==='readonly'){
     held=true;Object.defineProperty(request,'onsuccess',{configurable:true,get(){return descriptor.get!.call(request)},set(handler){descriptor.set!.call(request,function(event:Event){seenRevision=request.result?.value;void (window as any).sampleRevisionBarrier().then(()=>handler.call(request,event))})}})
    }return request
   }
   try{const record=s.getSewingSampleApprovalRecord('BOUND-ASG-0');await a.saveSewingSampleSourceUiAction('BOUND-ASG-0',commandId,`bounded concurrent ${commandId}`,()=>s.handoffPreProductionSampleToApprover({commandId,assignmentId:'BOUND-ASG-0',actor:{actorId:record.sample.currentPpicId,actorName:record.sample.currentPpicName,role:'PPIC'},approverTeamName:'原批版组',handedAt:'2026-10-22T02:01:00Z'}));ok=true}catch(e){error=String(e)}finally{IDBObjectStore.prototype.get=nativeGet}
   return {ok,error,seenRevision,status:s.getSewingSampleApprovalRecord('BOUND-ASG-0').sample.status}
  },commandId)
  evidence.concurrent=await Promise.all([concurrent(page,'BOUND-NEW-HANDOFF-A'),concurrent(second,'BOUND-NEW-HANDOFF-B')])
  assert.equal(arrivals,2);assert.equal(evidence.concurrent.filter((r:any)=>r.ok).length,1);assert.equal(evidence.concurrent[0].seenRevision,evidence.concurrent[1].seenRevision)
  assert.match(evidence.concurrent.find((r:any)=>!r.ok).error,/其他页面已更新票据|未保存.*刷新/)
  const winner=evidence.concurrent[0].ok?page:second
  evidence.originalSynchronousView=await winner.evaluate(()=>{
   const {p}=(window as any).__bounded,view=JSON.parse(p.productionContextStorage.getItem(p.PRODUCTION_CONTEXT_KEYS.samples)),record=view.records.find((r:any)=>r.assignmentId==='BOUND-ASG-0')
   return {status:record.sample.status,photos:record.sample.ppicReceivedSamplePhotoUrls.length,count:view.records.filter((r:any)=>r.assignmentId.startsWith('BOUND-ASG-')).length}
  })
  assert.deepEqual(evidence.originalSynchronousView,{status:'HANDED_TO_APPROVER',photos:1,count:2000})
  await second.close()
  await page.reload();await connect(page)
  evidence.cold=await page.evaluate(async()=>{
   const {p,s,db}=(window as any).__bounded;let writes=0;const put=IDBObjectStore.prototype.put
   IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){writes++;return put.apply(this,args)}
   try{await p.hydrateProductionContextRecords();const record=s.getSewingSampleApprovalRecord('BOUND-ASG-0'),bytes=await(await fetch(record.sample.ppicReceivedSamplePhotoUrls[0])).arrayBuffer(),rows=await db.readCuttingRecords()
    return {writes,status:record.sample.status,count:s.listSewingSampleApprovalRecords().filter((r:any)=>r.assignmentId.startsWith('BOUND-ASG-')).length,
     hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''),handoffs:rows.records.filter((r:any)=>r.id.startsWith('production-context:sample-commands:BOUND-NEW-HANDOFF')).length}
   }finally{IDBObjectStore.prototype.put=put}
  })
  assert.equal(evidence.cold.writes,0);assert.equal(evidence.cold.count,2000);assert.equal(evidence.cold.status,'HANDED_TO_APPROVER');assert.equal(evidence.cold.hash,hash(upload));assert.equal(evidence.cold.handoffs,1)
  evidence.afterAll=await snapshot(page);assert.equal(evidence.afterAll.otherSha,evidence.before.otherSha,'原generic只新增runtime序次，其他1999样衣/原orders保持')
  for(const original of evidence.before.files)assert.deepEqual(evidence.afterAll.files.find((f:any)=>f.id===original.id),original)
  assert.equal(evidence.afterAll.files.length,evidence.before.files.length+1)
  evidence.reappearedLegacy=await page.evaluate(async()=>{
   const {p,s,a}=(window as any).__bounded,key=p.PRODUCTION_CONTEXT_KEYS.samples,legacy=JSON.stringify({version:3,records:[s.getSewingSampleApprovalRecord('BOUND-ASG-0')],commands:[],sequence:6000})
   localStorage.setItem(key,legacy)
   const put=IDBObjectStore.prototype.put;let writes=0,calls=0,error='',code=''
   IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){writes++;return put.apply(this,args)}
   try{await a.saveSewingSampleSourceUiAction('BOUND-ASG-0','BOUND-NEW-MUST-BLOCK','old source reappeared must block',()=>{calls++;return true})}catch(e){error=String(e);code=(e as any).code}
   finally{IDBObjectStore.prototype.put=put}
   return {writes,calls,error,code,legacyPreserved:localStorage.getItem(key)===legacy}
  })
  assert.equal(evidence.reappearedLegacy.writes,0);assert.equal(evidence.reappearedLegacy.calls,0);assert.equal(evidence.reappearedLegacy.code,'PRODUCTION_CONTEXT_RECOVERY');assert.match(evidence.reappearedLegacy.error,/又发现旧|重现/);assert.equal(evidence.reappearedLegacy.legacyPreserved,true)

  assert.deepEqual(pageErrors,[]);evidence.passed=true
 }catch(error){evidence.error=String(error);throw error}
 finally{evidence.pageErrors=pageErrors;mkdirSync(resolve('output/qc-implementation-20261022'),{recursive:true});writeFileSync(output,JSON.stringify(evidence,null,2));await context.close();await browser.close()}
})
