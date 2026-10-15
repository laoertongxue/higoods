import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43157'
const out=resolve(process.env.WASH_OUT_DIR||'docs/verification-evidence/2026-10-15-washing-gtg-v1.3')
const stamp=new Date().toISOString().replaceAll(':','-'),report={at:new Date().toISOString(),base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:{browser:'Chromium',timezone:'Asia/Shanghai',viewport:'1366×768',node:process.version},cases:[],errors:[]}
mkdirSync(out,{recursive:true});mkdirSync('output/playwright/washing',{recursive:true})
let uiOrderId=''
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'})
const page=await context.newPage();page.on('pageerror',err=>report.errors.push(err.message))
async function check(id,name,fn){const start=performance.now();try{const detail=await fn();report.cases.push({id,name,status:'PASS',ms:performance.now()-start,detail});console.log('PASS',id,name)}catch(err){report.cases.push({id,name,status:'FAIL',ms:performance.now()-start,error:err.message,stack:err.stack});console.log('FAIL',id,name,err.message);if(process.env.WASH_STOP_ON_FAIL==='1'){await browser.close();throw err}}}
async function open(p=page,path='/fcs/craft/dyeing/washing/work-orders'){await p.goto(base+path);await p.waitForSelector('[data-washing-list-root], [data-washing-judgment-root], [data-washing-detail-root]',{timeout:15000})}
async function harness(p=page){return p.evaluate(async()=>{
 const app=await import('/src/data/fcs/fabric-washing.ts'),repo=await import('/src/data/fcs/fabric-washing-repository.ts'),model=await import('/src/data/fcs/fabric-washing-model.ts'),receiving=await import('/src/data/fcs/factory-receiving.ts'),printing=await import('/src/data/fcs/printing-task-domain.ts'),db=await import('/src/data/pcs-record-db.ts'),maintenance=await import('/src/data/fcs/fabric-washing-maintenance.ts')
 await repo.ensureWashingRecords();const site={id:'CONTRACT-SITE',name:'现场触摸责任人',role:'现场判断人员',factoryId:'F090'},planner={id:'CONTRACT-PLAN',name:'跟单',role:'计划跟单'},factory={id:'CONTRACT-FACTORY',name:'GTG 执行人',role:'染厂人员',factoryId:'ID-F003'},receiver={id:'CONTRACT-RECEIVER',name:'接收责任人',role:'接收人员',factoryId:'F090'},supervisor={id:'CONTRACT-SUPERVISOR',name:'现场负责人',role:'现场负责人',factoryId:'F090'}
 const invariant=(ok,message)=>{if(!ok)throw new Error(message)},expectError=async(fn,pattern)=>{try{await fn()}catch(error){if(!new RegExp(pattern).test(error.message))throw error;return error.message}throw new Error('未阻止：'+pattern)}
 window.washHarness={app,repo,model,receiving,printing,db,maintenance,site,planner,factory,receiver,supervisor,invariant,expectError,orders:{},sources:{},act:(command,actor=factory,op=crypto.randomUUID())=>app.submitWashingCommand(command,actor,op)}
 return true
})}
await open();await harness()
await check('CT-02/08/10','首次读取无判断、无洗水种子、无必要台账整包副本',async()=>page.evaluate(async()=>{
 const h=window.washHarness;h.invariant(h.repo.readWashingState().orders.length===0,'首次读取出现洗水单');const saved=await h.db.readPcsRecords([h.repo.WASHING_COLLECTION,h.repo.WASHING_BRIDGE_COLLECTION]);h.invariant(!saved.records.length,'首次读取落盘洗水种子');return{records:saved.records.length,legacyPrintBytes:localStorage.getItem('higoods.formal-print-execution.v1')?.length||0}
}))
await check('CT-02/03/04','六来源、三手感、无需与未判断按卷混合，缺手感和重复建单阻断',async()=>page.evaluate(async()=>{
 const h=window.washHarness,types=['PRODUCTION','PRODUCTION_DEMAND','PURCHASE','STOCK','SUPPLEMENT','DESIGN_REVISION'],feels=['柔软手感','增厚蓬松棉手感','硬挺手感'];const results=[]
 for(const type of types){const source=h.app.getWashingSources('PWO-WASH-DEMO-'+type+'-DONE')[0];h.sources[type]=source;h.invariant(source?.actualCompleted,'缺少实际完成来源 '+type);h.invariant(h.app.getWashingSources('PWO-WASH-DEMO-'+type+'-PAPER').length===0,'仅纸张完成可判断 '+type)
  await h.expectError(()=>h.act({type:'JUDGE',source,rollIds:[source.rolls[2].id],decision:'WASH'},h.site),'手感')
  await h.act({type:'JUDGE',source,rollIds:source.rolls.slice(0,2).map(r=>r.id),decision:'NO_WASH'},h.site)
  for(let n=0;n<3;n++){const op=crypto.randomUUID(),command={type:'JUDGE',source,rollIds:[source.rolls[n+2].id],decision:'WASH',handFeel:feels[n]};const a=await h.act(command,h.site,op),b=await h.act(command,h.site,op);h.invariant(a.orderId===b.orderId,'重试另建单');h.orders[type+'-'+n]=a.orderId;await h.expectError(()=>h.act(command,h.site),'已有触摸结果');}
  const state=h.repo.readWashingState();h.invariant(h.model.washingRollRelease(state,source.printOrderId,source.rolls[0].id)==='','无需洗水未放行 '+type+' '+h.model.washingRollRelease(state,source.printOrderId,source.rolls[0].id)+' '+JSON.stringify(state.judgments.map(j=>({id:j.id,rollId:j.rollId,decision:j.decision,sourceRevision:j.sourceRevision}))));h.invariant(h.model.washingRollRelease(state,source.printOrderId,source.rolls[5].id).includes('触摸'),'未判断自动放行');h.invariant(h.model.washingRollRelease(state,source.printOrderId,source.rolls[2].id).includes('洗水'),'待洗自动放行');results.push({type,sku:source.materialSku,rootType:source.rootSource.sourceType,productionOrderId:source.productionOrderId||null,target:source.target?.name})
 }
 const state=h.repo.readWashingState();h.invariant(state.orders.length===18,'六类三手感数量不符');h.invariant(state.orders.every(o=>o.assignedFactoryId==='ID-F003'&&o.acceptance==='PENDING'),'建单未直接交由 GTG');h.invariant(!JSON.stringify(state).includes('percentage'),'存在在线比例');return{orders:state.orders.length,sources:results}
}))
uiOrderId=await page.evaluate(()=>window.washHarness.orders['PRODUCTION-0'])
// A separate, actually saved six-source dataset for list-scale acceptance.
const benchmarkBackup=await page.evaluate(()=>window.washHarness.maintenance.exportWashingBackup())
const benchmarkContext=await browser.newContext({timezoneId:'Asia/Shanghai'}),benchmarkPage=await benchmarkContext.newPage();await open(benchmarkPage);await harness(benchmarkPage)
const benchmark=await benchmarkPage.evaluate(async backup=>{const h=window.washHarness;await h.maintenance.restoreWashingBackup(backup);for(const order of h.repo.readWashingState().orders)await h.act({type:'ASSIGN',orderId:order.id,factory:{id:'ID-F003',name:'GTG',enabled:true}},h.planner);return h.maintenance.exportWashingBackup()},benchmarkBackup)
writeFileSync('/tmp/washing-benchmark-18-orders.json',JSON.stringify(benchmark));
const benchmark36=await benchmarkPage.evaluate(async()=>{const h=window.washHarness;for(const type of ['PRODUCTION','PRODUCTION_DEMAND','PURCHASE','STOCK','SUPPLEMENT','DESIGN_REVISION']){const source=h.app.getWashingSources('PWO-WASH-DEMO-'+type+'-DONE')[0];for(const index of [0,1,5])await h.act({type:'JUDGE',source,rollIds:[source.rolls[index].id],decision:'WASH',handFeel:'柔软手感',...(index<2?{correct:true}:{})},h.site)}return h.maintenance.exportWashingBackup()});
writeFileSync('output/washing-gtg-v1.3/benchmark-36-orders.json',JSON.stringify(benchmark36));await benchmarkContext.close()

await check('WASH-226/227','GTG 停用时不得静默改派或保存新单，用户工厂覆盖保留',async()=>page.evaluate(async()=>{
 const h=window.washHarness,master=await import('/src/data/fcs/factory-master-store.ts'),original=master.getFactoryMasterRecordById('ID-F003'),before=h.repo.readWashingState().orders.length
 h.invariant(!!original,'缺少 GTG 档案')
 try{
  master.upsertFactoryMasterRecord({...original,status:'paused',allowExecute:false})
  const source=h.app.getWashingSources('PWO-WASH-DEMO-PRODUCTION-DONE')[0]
  await h.expectError(()=>h.act({type:'JUDGE',source,rollIds:[source.rolls[5].id],decision:'WASH',handFeel:'柔软手感'},h.site),'GTG 当前未启用')
  h.invariant(h.repo.readWashingState().orders.length===before,'停用仍创建洗水单')
  h.invariant(master.getFactoryMasterRecordById('ID-F003').status==='paused','覆盖了用户停用')
  return {ordersBefore:before,ordersAfter:h.repo.readWashingState().orders.length,blocked:true}
 }finally{master.upsertFactoryMasterRecord(original)}
}))

await check('CT-05/06/07/11','真实收发、库存、实际领用、新卷标、正负差异与完单不互相代填',async()=>page.evaluate(async()=>{
 const h=window.washHarness,orderId=h.orders['PRODUCTION-0'],source=h.sources.PRODUCTION,roll=source.rolls[2],rollIds=[roll.id],position=h.receiving.getDefaultFactoryReceiptPosition('ID-F003'),act=(command,actor=h.factory)=>h.act({orderId,...command},actor),lines=[{rollId:roll.id,barcode:roll.barcode,qty:49}]
 await h.expectError(()=>act({type:'ASSIGN',factory:{id:'ID-F002',name:'其他厂',enabled:true}},h.planner),'未启用|不具备');await act({type:'ASSIGN',factory:{id:'ID-F003',name:'GTG',enabled:true}},h.planner)
 await h.expectError(()=>act({type:'ACCEPT'},{...h.factory,factoryId:'ID-F002'}),'本厂');await act({type:'ACCEPT'});h.invariant(!h.repo.readWashingState().orders.find(o=>o.id===orderId).rolls[0].receivedAt,'派厂自动实收')
 await h.expectError(()=>act({type:'START',rollIds}),'已接收');await h.expectError(()=>act({type:'SEND',rollIds,scannedCodes:['错误卷']},h.site),'实际卷|卷码');await act({type:'SEND',rollIds,scannedCodes:[roll.barcode]},h.site)
 h.invariant(!h.receiving.listFactoryReceipts().some(r=>r.lines.some(l=>l.washingOrderId===orderId)),'交出自动实收');await h.expectError(()=>act({type:'CANCEL',reason:'不能回删',confirmed:true},h.planner),'实物交接');await h.expectError(()=>act({type:'RECEIVE',lines,...position}),'差异');await act({type:'RECEIVE',lines,...position,differenceConfirmed:true})
 await h.expectError(()=>act({type:'RECEIVE',lines,...position,differenceConfirmed:true}),'卷码|状态|接收')
 const wh=await import('/src/data/fcs/factory-internal-warehouse.ts');h.invariant(wh.listFactoryWarehouseInboundRecords().some(r=>r.processCode==='PROC_WASH'&&r.materialSku===source.materialSku),'厂内库存将洗水归错类')
 await act({type:'START',rollIds});h.invariant(h.receiving.listFactoryMaterialUses().some(u=>u.washingOrderId===orderId&&u.lines.reduce((n,l)=>n+l.qty,0)===49),'洗水投入未用真实实收')
 await h.expectError(()=>act({type:'OUTPUT',lines:[{rollId:roll.id,qty:0}]}),'零产出');await h.expectError(()=>act({type:'OUTPUT',lines:[{rollId:roll.id,qty:52,barcode:'WS-REPACK-01'}]}),'数量有变化');await act({type:'OUTPUT',lines:[{rollId:roll.id,qty:52,barcode:'WS-REPACK-01'}],differenceConfirmed:true})
 h.invariant(!h.repo.readWashingState().orders.find(o=>o.id===orderId).completedAt,'加工完成自动人工完单');h.invariant(wh.listFactoryWaitHandoverStockItems().some(r=>r.craftCode==='WASH'&&r.fabricRollNo==='WS-REPACK-01'&&r.waitHandoverQty===52),'产出库存未读取洗水事实');await h.expectError(()=>act({type:'COMPLETE'}),'下游实收')
 await act({type:'HANDOUT',rollIds,scannedCodes:['WS-REPACK-01'],target:source.target});await h.expectError(()=>act({type:'DOWNSTREAM_RECEIVE',lines:[{rollId:roll.id,qty:51}],...h.receiving.getDefaultFactoryReceiptPosition('F090'),differenceConfirmed:true},{...h.receiver,factoryId:'ID-F002'}),'下游责任方');await act({type:'DOWNSTREAM_RECEIVE',lines:[{rollId:roll.id,qty:51}],...h.receiving.getDefaultFactoryReceiptPosition('F090'),differenceConfirmed:true},h.receiver);await act({type:'COMPLETE'})
 const state=h.repo.readWashingState(),order=state.orders.find(o=>o.id===orderId);h.invariant(!h.model.washingRollRelease(state,source.printOrderId,roll.id),'洗水完成实收仍拦截');h.invariant(h.printing.getPrintingWorkOrderById(source.printOrderId).output.completedQty===300,'洗水重复新增印花产出');return{orderId,received:49,output:52,downstream:51,manualComplete:!!order.completedAt,skuUnchanged:order.source.materialSku===source.materialSku}
}))
await check('CT-04/06','中央仓按原去向实收，独立责任库存且单位不变',async()=>page.evaluate(async()=>{
 const h=window.washHarness,orderId=h.orders['STOCK-0'],source=h.sources.STOCK,roll=source.rolls[2],rollIds=[roll.id],position=h.receiving.getDefaultFactoryReceiptPosition('ID-F003'),act=(command,actor=h.factory)=>h.act({orderId,...command},actor),lines=[{rollId:roll.id,barcode:roll.barcode,qty:50}]
 await act({type:'ASSIGN',factory:{id:'ID-F003',name:'GTG',enabled:true}},h.planner);await act({type:'ACCEPT'});await act({type:'SEND',rollIds,scannedCodes:[roll.barcode]},h.site);await act({type:'RECEIVE',lines,...position});await act({type:'START',rollIds});await act({type:'OUTPUT',lines});await act({type:'HANDOUT',rollIds,scannedCodes:[roll.barcode],target:source.target})
 h.invariant(!h.app.washingWarehouseStock().some(s=>s.orderId===orderId),'中央仓尚未收货已经有库存');await h.expectError(()=>act({type:'DOWNSTREAM_RECEIVE',lines,warehouseId:source.target.warehouseId,locationId:'A-01'},h.receiver),'原接收仓');await act({type:'DOWNSTREAM_RECEIVE',lines,warehouseId:source.target.warehouseId,locationId:'A-01'},{...h.receiver,warehouseId:source.target.warehouseId});const stock=h.app.washingWarehouseStock().find(s=>s.orderId===orderId);h.invariant(stock?.qty===50&&stock.unit==='Yard'&&stock.locationId==='A-01','中央仓实收库存不符');return stock
}))
await check('CT-07','本人纠正、派厂后协调、异常冻结与负责人恢复保留历史',async()=>page.evaluate(async()=>{
 const h=window.washHarness,oldId=h.orders['SUPPLEMENT-1'],source=h.sources.SUPPLEMENT,rollId=source.rolls[3].id
 await h.expectError(()=>h.act({type:'JUDGE',source,rollIds:[rollId],decision:'WASH',handFeel:'柔软手感',correct:true},{...h.site,id:'其他人员'}),'本人')
 const result=await h.act({type:'JUDGE',source,rollIds:[rollId],decision:'WASH',handFeel:'柔软手感',correct:true},h.site);const state=h.repo.readWashingState();h.invariant(state.orders.find(o=>o.id===oldId).cancelledAt,'纠正删除旧单历史');h.invariant(state.judgments.find(j=>j.rollId===rollId).history.length===1,'原判断未留版本')
 const orderId=result.orderId;await h.act({type:'ASSIGN',orderId,factory:{id:'ID-F003',name:'GTG',enabled:true}},h.planner);await h.act({type:'ACCEPT',orderId},h.factory);await h.expectError(()=>h.act({type:'JUDGE',source,rollIds:[rollId],decision:'NO_WASH',correct:true},h.site),'已接单|已交出')
 await h.act({type:'EXCEPTION',orderId,reason:'现场误判待核对',confirmed:true},h.supervisor);await h.expectError(()=>h.act({type:'ACCEPT',orderId},h.factory),'异常');await h.act({type:'RESOLVE_EXCEPTION',orderId,reason:'负责人实物核对并协调完成',confirmed:true,handFeel:'硬挺手感'},h.supervisor)
 const order=h.repo.readWashingState().orders.find(o=>o.id===orderId);h.invariant(order.handFeel==='硬挺手感'&&!order.exception,'纠正未按实际恢复');return{oldId,orderId,history:state.judgments.find(j=>j.rollId===rollId).history.length,handFeel:order.handFeel}
}))
await check('CT-08/10','备份仅必要 FCS，坏格式/缺附件/重复冲突不覆盖，完整恢复到隔离浏览器',async()=>{
 const backup=await page.evaluate(async()=>{const h=window.washHarness,b=await h.maintenance.exportWashingBackup();await h.expectError(()=>h.maintenance.restoreWashingBackup({format:'bad'}),'格式');const bad=structuredClone(b);bad.records.push(structuredClone(b.records[0]));await h.expectError(()=>h.maintenance.restoreWashingBackup(bad),'编号');const conflict=structuredClone(b);conflict.records.find(r=>r.value.kind==='orders').value.data.handFeel=conflict.records.find(r=>r.value.kind==='orders').value.data.handFeel==='柔软手感'?'硬挺手感':'柔软手感';await h.expectError(()=>h.maintenance.restoreWashingBackup(conflict),'不同版本');h.invariant(await h.maintenance.restoreWashingBackup(b)===0,'相同备份重复写入');return b})
 const other=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await other.newPage();await open(p);await harness(p)
 const restored=await p.evaluate(async b=>{const h=window.washHarness,count=await h.maintenance.restoreWashingBackup(b);return{count,orders:h.repo.readWashingState().orders.length,files:(await h.db.readPcsRecords([h.repo.WASHING_COLLECTION,h.repo.WASHING_BRIDGE_COLLECTION])).files.length}},backup);assert.equal(restored.orders,backup.records.filter(r=>r.value.kind==='orders').length);await other.close();return{records:backup.records.length,...restored}
})
await check('CT-09','同浏览器两标签竞争同一卷只有一张有效单',async()=>{
 const other=await context.newPage();await open(other);await harness(other)
 const command=async p=>p.evaluate(async()=>{const h=window.washHarness,source=h.app.getWashingSources('PWO-WASH-DEMO-PRODUCTION-DONE')[0];try{return {ok:true,result:await h.act({type:'JUDGE',source,rollIds:[source.rolls[5].id],decision:'WASH',handFeel:'柔软手感'},h.site)}}catch(err){return{ok:false,error:err.message}}})
 const results=await Promise.all([command(page),command(other)]);assert.equal(results.filter(r=>r.ok).length,1);await other.close();return results
})
await check('CT-08','事务中止不半套保存，输入保留并以同一操作重试',async()=>{
 const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await c.newPage();await open(p,'/fcs/craft/printing/work-orders/PWO-WASH-DEMO-PURCHASE-DONE')
 await p.locator('[data-washing-feel]').selectOption('柔软手感')
 await p.evaluate(()=>{window.washOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='records')throw new DOMException('quota test','QuotaExceededError');return window.washOriginalPut.apply(this,args)}})
 await p.getByRole('button',{name:'创建洗水加工单',exact:true}).click();await p.locator('[data-washing-error]').filter({hasText:/空间|未保存/}).waitFor();assert.equal(await p.locator('[data-washing-feel]').inputValue(),'柔软手感')
 const before=await p.evaluate(async()=>{const db=await import('/src/data/pcs-record-db.ts');return(await db.readPcsRecords(['fcs.fabric-washing.v1','fcs.fabric-washing.process-records.v1'])).records.length});assert.equal(before,0)
 await p.evaluate(()=>{IDBObjectStore.prototype.put=window.washOriginalPut});await p.getByRole('button',{name:'创建洗水加工单',exact:true}).click();await p.getByRole('link',{name:'查看洗水加工单',exact:true}).waitFor();await p.reload();await p.waitForSelector('[data-washing-judgment-root]');assert.match(await p.locator('[data-washing-judgment-root]').innerText(),/已触摸：柔软手感/);await c.close();return{recordsAfterAbort:before,retry:'durable after reload'}
})
await check('CT-08','IndexedDB 打开失败明确告知，不能显示空列表或保存成功',async()=>{
 const c=await browser.newContext();await c.addInitScript(()=>{indexedDB.open=()=>{throw new DOMException('blocked open','InvalidStateError')}});const p=await c.newPage();await p.goto(base+'/fcs/craft/dyeing/washing/work-orders');await p.getByRole('alert').filter({hasText:/无法|未保存|读取/}).first().waitFor();const result=await p.getByRole('alert').first().innerText();await c.close();return result
})
await check('CT-08/10','偏好存储禁用仍可按记录保存洗水业务',async()=>{
 const c=await browser.newContext();await c.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='higood-fcs-wool-stage-store-v3')return original.call(this,key,value);throw new DOMException('disabled preference storage','QuotaExceededError')}});const p=await c.newPage();await open(p,'/fcs/craft/printing/work-orders/PWO-WASH-DEMO-DESIGN_REVISION-DONE');await p.locator('[data-washing-feel]').selectOption('硬挺手感');await p.getByRole('button',{name:'创建洗水加工单',exact:true}).click();await p.getByRole('link',{name:'查看洗水加工单',exact:true}).waitFor();await c.close();return '业务保存未回退 localStorage'
})
await check('CT-10','旧原图转 Blob，选择性迁移读回后清理，其他旧记录保留',async()=>{
 const c=await browser.newContext(),p=await c.newPage();await open(p);await harness(p)
 const result=await p.evaluate(async()=>{const h=window.washHarness,bridge=await import('/src/data/fcs/fabric-washing-storage-bridge.ts'),codec=await import('/src/data/fcs/printing-execution-storage.ts');const id='PWO-WASH-DEMO-PURCHASE-DONE',source=h.app.getWashingSources(id)[0],snapshot=JSON.parse(bridge.washingLedgerSnapshots().get('higoods.formal-print-execution.v1')),ids=[id,'PWO-WASH-DEMO-PURCHASE-PAPER'];snapshot.state.workOrders=snapshot.state.workOrders.filter(([key])=>ids.includes(key));snapshot.state.nodeRecords=snapshot.state.nodeRecords.filter(([key])=>ids.includes(key));snapshot.state.reviewRecords=[];snapshot.tasks=snapshot.tasks.filter(task=>snapshot.state.workOrders.some(([,order])=>order.taskId===task.taskId));const image=await(await fetch(source.imageUrl)).blob();const dataUrl=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(image)});snapshot.state.workOrders.find(([key])=>key===id)[1].businessView.output.imageUrl=dataUrl;localStorage.setItem('higoods.formal-print-execution.v1',codec.serializePrintExecution(snapshot));return{bytes:image.size}})
 await p.reload();await open(p,'/fcs/craft/printing/work-orders/PWO-WASH-DEMO-PURCHASE-DONE');await harness(p)
 const migrated=await p.evaluate(async()=>{const h=window.washHarness,source=h.app.getWashingSources('PWO-WASH-DEMO-PURCHASE-DONE')[0];await h.act({type:'JUDGE',source,rollIds:[source.rolls[0].id],decision:'WASH',handFeel:'柔软手感'},h.site);const saved=await h.db.readPcsRecords([h.repo.WASHING_COLLECTION,h.repo.WASHING_BRIDGE_COLLECTION]),old=JSON.parse(localStorage.getItem('higoods.formal-print-execution.v1'));h.invariant(saved.files.length===1,'原图没有去重复用 Blob');h.invariant(!JSON.stringify(saved.records).includes('data:image'),'业务保留 Base64');h.invariant(old.state.workOrders.length===1&&old.state.workOrders[0][0].endsWith('-PAPER'),'选择性清理误删其他旧资料');const b=await h.maintenance.exportWashingBackup();const broken=structuredClone(b);broken.files=[];await h.expectError(()=>h.maintenance.restoreWashingBackup(broken),'缺少');return {records:saved.records.length,files:saved.files.length,bytes:saved.files[0].blob.size,oldRecords:old.state.workOrders.length,backup:b}});assert.equal(migrated.bytes,result.bytes);writeFileSync('/tmp/washing-blob-backup.json',JSON.stringify(migrated.backup))
 const c2=await browser.newContext(),p2=await c2.newPage();await open(p2);await harness(p2);const recovered=await p2.evaluate(async b=>{const h=window.washHarness;await h.maintenance.restoreWashingBackup(b);const state=h.repo.readWashingState();const blob=await(await fetch(state.orders[0].source.imageUrl)).blob();return{orders:state.orders.length,bytes:blob.size,sku:state.orders[0].source.materialSku}},migrated.backup);assert.equal(recovered.bytes,result.bytes);await c2.close();await c.close();delete migrated.backup;return{...migrated,recovered}
})
await check('PG-04/05/RL-01','原来源和下游直达读取、无效单号及中央仓库存入口',async()=>{
 await page.goto(base+'/wls/raw/inbound-list');await page.locator('[data-washing-warehouse-section]').waitFor();await page.locator('[data-wls-raw-inbound-list-action="reset-filter"]').click();await page.locator('[data-washing-warehouse-section]').waitFor();assert.match(await page.locator('[data-washing-warehouse-section]').innerText(),/面料中央仓|本仓实收/)
 await page.goto(base+'/fcs/craft/dyeing/washing/work-orders/DOES-NOT-EXIST');await page.getByText('洗水加工单不存在',{exact:true}).waitFor();return '中央仓入口读取同一实收；无效 ID 显示可理解结果'
})
await check('PD-01/02/03','PDA 原型会话、本厂单据和适用小屏',async()=>{
 await open();await page.evaluate(async()=>{const pda=await import('/src/data/fcs/store-domain-pda.ts');const user=pda.listFactoryPdaUsers('F090').find(u=>u.status!=='LOCKED');pda.setPdaSession(pda.createPdaSessionFromUser(user))});await page.setViewportSize({width:390,height:844});await page.goto(base+'/fcs/pda/washing');await page.waitForSelector('[data-washing-list-root]');assert.match(await page.locator('[data-washing-list-root]').innerText(),/洗水加工单/)
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await page.screenshot({path:'output/playwright/washing/pda-list-390.png',fullPage:true});return{viewport:'390×844',horizontalOverflow:overflow}
})
await page.setViewportSize({width:1366,height:768})
await check('PG-02/PR-01/02','洗水单和交接卷标预览包含真图、手感、源卷和实际责任方',async()=>{
 await page.evaluate(async()=>{const pda=await import('/src/data/fcs/store-domain-pda.ts');pda.clearPdaSession()});const orderId=uiOrderId;await page.goto(base+'/fcs/craft/dyeing/washing/work-orders/'+encodeURIComponent(orderId));await page.waitForSelector('[data-washing-order]');await page.getByRole('button',{name:'洗水加工单预览',exact:true}).click();await page.locator('[data-washing-print-document]').waitFor();assert.match(await page.locator('[data-washing-print-document]').innerText(),/目标手感：柔软手感/);assert.equal(await page.locator('[data-washing-print-document] img').evaluate(img=>img.complete&&img.naturalWidth>0),true);await page.getByRole('button',{name:'交接与卷标预览',exact:true}).click();await page.locator('[data-washing-print-document] [data-real-barcode]').first().waitFor();assert.match(await page.locator('[data-washing-print-document]').innerText(),/WS-REPACK-01/);await page.screenshot({path:'output/playwright/washing/print-preview-1366.png',fullPage:true});return{barcodes:await page.locator('[data-washing-print-document] [data-real-barcode]').count()}
})
const sourcePaths=execFileSync('git',['ls-files','-m','-o','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(p=>/^(src|tests|scripts)\//.test(p));report.sourceHashes=Object.fromEntries(sourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));report.browserVersion=browser.version();report.summary={pass:report.cases.filter(r=>r.status==='PASS').length,fail:report.cases.filter(r=>r.status==='FAIL').length,pageErrors:report.errors.length}
writeFileSync(out+'/browser-contracts-'+stamp+'.json',JSON.stringify(report,null,2));await browser.close();console.log(report.summary);if(report.summary.fail||report.summary.pageErrors)process.exitCode=1
