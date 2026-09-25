// Script-only delivery. Run against dev43235; Mock prerequisites are explicit and contain no tested handover result.
async page => {
 const base='http://127.0.0.1:43235',results=[],parts='BAG-HPB-PARTS-VERIFY',fabric='BAG-HPB-FABRIC-VERIFY';
 const modal='[data-wait-handover-modal="handover"]';
 async function dbSnapshot(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('higood-cutting-records-v1');req.onsuccess=()=>{const db=req.result,tx=db.transaction(['records','commands','meta'],'readonly'),out={};for(const name of ['records','commands','meta']){const r=tx.objectStore(name).getAll();r.onsuccess=()=>out[name]=r.result.sort((a,b)=>String(a.id).localeCompare(String(b.id)))}tx.oncomplete=()=>{db.close();resolve(out)};tx.onabort=()=>reject(tx.error)};req.onerror=()=>reject(req.error)}))}
 async function stage(p,name){await p.locator(modal+' [data-wait-handover-repack-step="'+name+'"]').waitFor({state:'visible'});}
 async function next(p,name){await p.locator(modal+' [data-wait-handover-action=repack-next]:visible').click();await stage(p,name)}
 async function selected(p){return p.locator(modal+' select[data-wait-handover-field=sourceBagCodes]').evaluate(node=>[...node.selectedOptions].map(o=>o.value))}
 async function submit(p,word){await p.locator(modal+' [data-wait-handover-action=submit-repack]:visible').click();await p.waitForFunction(({modal,word})=>document.querySelector(modal+' [data-wait-handover-feedback]')?.textContent.includes(word),{modal,word});return p.locator(modal+' [data-wait-handover-feedback]').innerText()}
 for(const scenario of ['unbound-fabric-omission-and-retry','both-bound-auto-aggregation']){
  const context=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await context.newPage(),errors=[],infrastructureErrors=[],steps=[];await p.routeWebSocket('**',socket=>socket.close());p.setDefaultTimeout(10000);p.on('pageerror',error=>errors.push(String(error)));p.on('console',message=>{if(message.type()==='error'){const text=message.text();if(text.startsWith('[vite] failed to connect to websocket.'))infrastructureErrors.push(text);else errors.push(text)}});
  try {
   await p.routeWebSocket('**',socket=>socket.close());
   await p.goto(base+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
   await p.goto(base+'/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
   // The only domain writes below prepare assignment, printed ticket, bagging and inbound, never handover.
   const fixture=await p.evaluate(async boundFabric=>{

    const tasks = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/process-tasks.ts') || '/src/data/fcs/process-tasks.ts');
    const runtime = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/runtime-process-tasks.ts') || '/src/data/fcs/runtime-process-tasks.ts');
    const factories = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/factory-master-store.ts') || '/src/data/fcs/factory-master-store.ts');
    const assignments = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/effective-task-assignments.ts') || '/src/data/fcs/effective-task-assignments.ts');
    const repo = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/replacement-fabric-repository.ts') || '/src/data/fcs/cutting/replacement-fabric-repository.ts');
    const storage = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-record-repository.ts') || '/src/data/fcs/cutting/cutting-record-repository.ts');
    const actions = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-event-repository.ts') || '/src/data/fcs/cutting/cutting-event-repository.ts');
    const ledger = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-runtime-event-ledger.ts') || '/src/data/fcs/cutting/cutting-runtime-event-ledger.ts');
    const bag = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/transfer-bag-operations.ts') || '/src/data/fcs/cutting/transfer-bag-operations.ts');
    const mixed = await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/mixed-transfer-bag-ticket.ts') || '/src/data/fcs/cutting/mixed-transfer-bag-ticket.ts');
    const master=factories.getFactoryMasterRecordById('ID-F001');
    const ppic=factories.getFactoryActivePpicSnapshot('ID-F001');
    const source=tasks.processTasks.find(x=>x.productionOrderId==='PO-202603-0002'&&x.processCode==='PROC_SEW');
    const sourceActions=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/production-context-actions.ts') || '/src/data/fcs/production-context-actions.ts');
    const task=await sourceActions.saveProductionSourceAction({id:'mixed-source',intent:'mixed-source',action:()=>{
    Object.assign(source,{assignedFactoryId:master.id,assignedFactoryName:master.name,assignmentStatus:'ASSIGNED',status:'NOT_STARTED'});
    runtime.clearRuntimeProcessTasksCache();
    const task=runtime.listRuntimeProcessTasks().find(x=>x.baseTaskId===source.taskId);
    if(!assignments.listCurrentEffectiveTaskAssignments(task.taskId).length) assignments.createEffectiveTaskAssignment({assignmentId:'ASG-HPB-BROWSER-TEST',runtimeTaskId:task.taskId,productionOrderId:task.productionOrderId,productionOrderNo:task.productionOrderId,taskNo:task.taskNo,factoryId:master.id,factoryName:master.name,source:'DIRECT_DISPATCH',assignedQty:task.qty,skuLines:task.scopeSkuLines,processCodes:['SEW'],frozenPrice:1000,priceCurrency:'IDR',priceUnit:'件',businessAssignedAt:'2026-09-24 10:00:00',operatedAt:'2026-09-24 10:00:00',operatedBy:ppic.ppicName,allocationOperatorPpicId:ppic.ppicId,allocationOperatorPpicName:ppic.ppicName});
    const dispatch=runtime.captureRuntimeDirectDispatchState();
    dispatch.taskOverrides=dispatch.taskOverrides.filter(([id])=>id!==task.taskId);
    dispatch.taskOverrides.push([task.taskId,{assignmentMode:'DIRECT',assignmentStatus:'ASSIGNED',assignedFactoryId:master.id,assignedFactoryName:master.name,dispatchedAt:'2026-09-24 10:00:00',businessAssignedAt:'2026-09-24 10:00:00',dispatchedBy:ppic.ppicName,dispatchPrice:1000,acceptanceStatus:'PENDING',status:'NOT_STARTED',updatedAt:'2026-09-24 10:00:00'}]);
    runtime.restoreRuntimeDirectDispatchState(dispatch);
    return task;
    }});
    const scopes=(await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/replacement-fabric-source.ts') || '/src/data/fcs/cutting/replacement-fabric-source.ts')).listReplacementFabricOrderRows().flatMap(row=>row.scopes); const initial=await repo.loadReplacementFabricState(); const first=initial.tickets.find(t=>t.productionOrderId===task.productionOrderId); if(!first)throw Error('Mock来源生产单没有换片布'); await repo.saveReplacementFabricPrint([first.id],scopes,{id:'fixture-print',at:'2026-09-25 11:00:00',operator:'隔离验收夹具'});
    const state=await repo.loadReplacementFabricState();
    const hpb=state.tickets.find(t=>t.productionOrderId===task.productionOrderId&&state.prints.some(p=>p.ticketId===t.id)&&!state.receipts.some(r=>r.ticket.id===t.id));
    if(!hpb) throw new Error('缺少未交出的已打印票');
    const taskFields={sewingTaskId:task.taskId,sewingTaskNo:task.taskNo,receiverFactoryId:master.id,receiverFactoryName:master.name};
    const fabric={...mixed.replacementFabricBagTicket(hpb),...(boundFabric?taskFields:{sewingTaskId:'',sewingTaskNo:'',receiverFactoryId:'',receiverFactoryName:''})};
    const fixtureSource=await import('/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts');
    const cutting=fixtureSource.appendSimpleCutPieceDemoCuttingBatch(1,task.productionOrderId).event;
    const beforeCut=await storage.readCuttingRecords();await storage.commitCuttingRecords({revision:beforeCut.revision,change:{puts:[{id:'cutting-event:'+cutting.eventId,collection:'cutting-events',value:cutting}]},command:{id:'batch-ui-cut-prerequisite',intent:'explicit-mock-completed-cutting',result:null,at:'2026-09-25'}});await actions.hydrateCuttingEventRecords();
    const generated=await import('/src/data/fcs/cutting/generated-fei-tickets.ts');
    const partSource=generated.listSpreadingResultGeneratedFeiTickets().find(t=>t.productionOrderId===task.productionOrderId&&task.scopeSkuLines.some(s=>s.skuCode===t.skuCode&&s.color===t.skuColor&&s.size===t.skuSize));
    if(!partSource)throw Error('Mock完成裁剪未产生与分配SKU匹配的正式裁片来源');
    const builder=await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts');
    const part={...builder.buildWaitHandoverRuntimeTicketFromGeneratedTicket(partSource),...taskFields};
    const operator={operatorId:'HPB-TEST',operatorName:'隔离浏览器验收',operatorRole:'裁片仓交出员'};
    const at='2026-09-24 12:00:00';
    await actions.runCuttingEventAction({id:'HPB-BROWSER-SETUP-01',intent:'HPB-BROWSER-SETUP-01',action: target=>{
      for(const [code,ticket] of [['BAG-HPB-PARTS-VERIFY',part],['BAG-HPB-FABRIC-VERIFY',fabric]]){
        const cycle='CYCLE-'+code;
        ledger.appendCuttingRuntimeEventIdempotent({eventType:'菲票装袋',eventSource:'PDA',eventStatus:'已同步',idempotencyKey:'HPB-SETUP:'+code,occurredAt:at,operatorName:operator.operatorName,operatorRole:operator.operatorRole,refs:{productionOrderId:hpb.productionOrderId,productionOrderNo:hpb.productionOrderNo,transferBagCode:code,usageCycleId:cycle,feiTicketIds:[ticket.feiTicketId],feiTicketNos:[ticket.feiTicketNo]},payload:{baggingRecordId:'PACK-'+code,bagCode:code,feiTicketItems:[ticket],totalPieceQty:ticket.pieceQty,mixedFlag:false,baggingBy:operator.operatorName,baggingAt:at}},target);
        ledger.appendCuttingRuntimeEventIdempotent({eventType:'中转袋入仓',eventSource:'PDA',eventStatus:'已同步',idempotencyKey:'HPB-IN:'+code,occurredAt:'2026-09-24 12:01:00',operatorName:operator.operatorName,operatorRole:operator.operatorRole,refs:{productionOrderId:hpb.productionOrderId,productionOrderNo:hpb.productionOrderNo,transferBagCode:code,usageCycleId:cycle,feiTicketIds:[ticket.feiTicketId],feiTicketNos:[ticket.feiTicketNo]},inventoryEffect:{inventoryScope:'裁床待交出仓',direction:'IN',qty:ticket.pieceQty,unit:'片',toWarehouseArea:'A区',toLocationCode:'A-R01-L01-P01'},payload:{bagCode:code,warehouseArea:'A区',locationCode:'A-R01-L01-P01',inboundAt:'2026-09-24 12:01:00',inboundBy:operator.operatorName}},target);
      }
      return true;
    }});
    const snapshot=await storage.readCuttingRecords();
    if(snapshot.records.some(row=>row.collection==='cutting-events'&&row.value.eventType==='新增交出记录'&&["BAG-HPB-PARTS-VERIFY","BAG-HPB-FABRIC-VERIFY"].includes(row.value.refs?.transferBagCode)))throw Error('前置不得包含被测交出结果');
    return {taskId:task.taskId,taskNo:task.taskNo,productionOrderId:task.productionOrderId,ppicId:ppic.ppicId,ppicName:ppic.ppicName,factoryId:master.id,ticketId:hpb.id,partId:part.feiTicketId,partQty:part.pieceQty,unit:'Yard',length:5,boundFabric};
   },scenario==='both-bound-auto-aggregation');
   await p.goto(base+'/fcs/craft/cutting/warehouse-management/wait-handover');
   const open=p.locator('[data-wait-handover-action=open-handover]');try{await open.waitFor({state:'visible'})}catch{throw Error('无可达真实UI入口：中转袋交出按钮不存在或页面未完成读取')}await open.click();await stage(p,'sources');
   const task=p.locator(modal+' [data-wait-handover-field=handoverTaskSelection]');if(!await task.locator('option').evaluateAll((nodes,id)=>nodes.some(n=>n.value===id),fixture.taskId))throw Error('真实任务下拉没有Mock分配任务');await task.selectOption(fixture.taskId);
   const ppic=p.locator(modal+' [data-wait-handover-field=handoverPpicSelection]');await p.waitForFunction(({modal,id})=>[...document.querySelectorAll(modal+' [data-wait-handover-field=handoverPpicSelection] option')].some(o=>o.value.startsWith(id+'|')),{modal,id:fixture.ppicId});const ppicValue=await ppic.locator('option').evaluateAll((nodes,id)=>nodes.find(n=>n.value.startsWith(id+'|')).value,fixture.ppicId);await ppic.selectOption(ppicValue);
   await next(p,'groups');const initialSelection=await selected(p);steps.push({action:'UI选择任务与PPIC后自动归集',initialSelection,groupText:await p.locator(modal+' [data-wait-handover-repack-group-preview]').innerText()});
   if(scenario==='unbound-fabric-omission-and-retry'){
    if(JSON.stringify(initialSelection)!==JSON.stringify([parts]))throw Error('未绑定换片布袋不应自动计入本次提交：'+JSON.stringify(initialSelection));
    await next(p,'results');await next(p,'returns');await next(p,'confirm');await p.locator(modal+' [data-wait-handover-field=operatorName]').fill('真实UI边界验收仓管');
    const before=await dbSnapshot(p);const feedback=await submit(p,'缺少换片布');const after=await dbSnapshot(p);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('漏选换片布被阻断后records/commands/meta发生变化');steps.push({action:'真实确认漏选袋阻断',feedback,databaseUnchanged:true});
    for(const name of ['returns','results','groups']){await p.locator(modal+' [data-wait-handover-action=repack-back]:visible').click();await stage(p,name)}
    await p.locator(modal+' [data-wait-handover-field=repackSourceBagCode]').fill(fabric);await p.locator(modal+' [data-wait-handover-action=add-repack-source]').click();await p.waitForFunction(({modal,fabric})=>[...document.querySelector(modal+' select[data-wait-handover-field=sourceBagCodes]').selectedOptions].some(o=>o.value===fabric),{modal,fabric});
    steps.push({action:'真实扫描输入补充换片布袋',selection:await selected(p),groupText:await p.locator(modal+' [data-wait-handover-repack-group-preview]').innerText()});
   }else if(initialSelection.length!==2||![parts,fabric].every(code=>initialSelection.includes(code)))throw Error('两个已绑定任务袋没有自动完整归集');
   const selectedBags=await selected(p);if(selectedBags.length!==2||![parts,fabric].every(code=>selectedBags.includes(code)))throw Error('确认前不恰好是两个袋');
   const groupText=await p.locator(modal+' [data-wait-handover-repack-group-preview]').innerText();if(!groupText.includes(fixture.partQty+' 片')||!groupText.includes('5 Yard'))throw Error('袋内裁片数量与5 Yard单位展示不一致：'+groupText);
   await next(p,'results');await next(p,'returns');await next(p,'confirm');await p.locator(modal+' [data-wait-handover-field=operatorName]').fill('真实UI边界验收仓管');const beforeSuccess=await dbSnapshot(p);const feedback=await submit(p,'本次交出成功');const saved=await dbSnapshot(p);
   const oldIds=new Set(beforeSuccess.records.map(r=>r.id));const events=saved.records.filter(r=>!oldIds.has(r.id)&&r.collection==='cutting-events'&&r.value.eventType==='新增交出记录'&&[parts,fabric].includes(r.value.refs?.transferBagCode)).map(r=>r.value);
   if(events.length!==2||new Set(events.map(e=>e.refs.handoverOrderId)).size!==1)throw Error('两袋没有以同一交出批次产生恰好两条事件');
   const snapshots=events.flatMap(e=>e.payload.feiTicketItems||[]);const hpb=snapshots.find(t=>t.feiTicketId===fixture.ticketId),part=snapshots.find(t=>t.feiTicketId===fixture.partId);if(!hpb||hpb.ticketKind!=='REPLACEMENT_FABRIC'||hpb.quantity!==5||hpb.quantityUnit!=='Yard'||hpb.pieceQty!==0||part?.pieceQty!==fixture.partQty)throw Error('交出快照混淆裁片与换片布数量单位');
   const receipts=saved.records.filter(r=>r.collection==='replacement-receipts'&&r.value.ticket?.id===fixture.ticketId).map(r=>r.value);if(receipts.length!==1||receipts[0].taskId!==fixture.taskId||!events.some(e=>e.refs.handoverRecordId===receipts[0].handoverRecordId)||receipts[0].ticket.length!==5||receipts[0].ticket.unit!=='Yard')throw Error('换片布回执与任务/同批交出事件不一致');
   await p.screenshot({path:'output/playwright/hpb/acceptance-final/batch-ui-r5-'+scenario+'.png',fullPage:true});await p.reload();await p.locator('[data-wait-handover-action=open-handover]').waitFor();const reopened=await dbSnapshot(p);if(events.some(e=>!reopened.records.some(r=>r.collection==='cutting-events'&&r.value.eventId===e.eventId)))throw Error('刷新丢失交出事件');if(!reopened.records.some(r=>r.collection==='replacement-receipts'&&r.value.ticket?.id===fixture.ticketId))throw Error('刷新丢失换片布回执');
   results.push({scenario,fixture,steps,feedback,selectedBags,groupText,events:events.map(e=>({eventId:e.eventId,refs:e.refs,items:e.payload.feiTicketItems})),receipts,errors,infrastructureErrors,refreshConsistent:true,prerequisite:'明确Mock任务分配、已打印换片布票及两个入仓袋；未预写交出或领取结果。被测确认均来自真实待交出UI。'});
  }catch(error){results.push({scenario,error:String(error),steps,errors,infrastructureErrors,url:p.url(),body:(await p.locator('body').innerText()).slice(-9000),buttons:await p.locator('[data-wait-handover-action]').evaluateAll(nodes=>nodes.map(n=>({action:n.dataset.waitHandoverAction,text:n.textContent?.trim(),visible:!!(n.getClientRects().length),disabled:n.disabled})))})}finally{await context.close()}
 }
 return {results,failed:results.filter(r=>r.error||r.errors.length),reverseOrder:{uiApplicable:false,reason:'页面固定按任务自动归集已绑定袋；未提供控制批次处理先后顺序的用户操作。未强改hidden select或制造DOM按钮。逆序提交由既有领域单元/集成证据覆盖，由root绑定对应证据。'},performance:'该脚本是功能与原子性边界验证，不作为5样本strict性能结果。'};
}
