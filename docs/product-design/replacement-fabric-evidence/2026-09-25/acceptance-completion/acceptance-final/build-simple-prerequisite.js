async (page) => {
  const context=await page.context().browser().newContext();const p=await context.newPage();await p.routeWebSocket('**',socket=>socket.close());
  await p.goto('http://127.0.0.1:43235/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
  await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
  const result=await p.evaluate(async () => {
    const tasks = await import('/src/data/fcs/process-tasks.ts');
    const runtime = await import('/src/data/fcs/runtime-process-tasks.ts');
    const factories = await import('/src/data/fcs/factory-master-store.ts');
    const assignments = await import('/src/data/fcs/effective-task-assignments.ts');
    const repo = await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');
    const storage = await import('/src/data/fcs/cutting/cutting-record-repository.ts');
    const actions = await import('/src/data/fcs/cutting/cutting-event-repository.ts');
    const ledger = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts');
    const bag = await import('/src/data/fcs/cutting/transfer-bag-operations.ts');
    const mixed = await import('/src/data/fcs/cutting/mixed-transfer-bag-ticket.ts');
    const handover = await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts');
    const master=factories.getFactoryMasterRecordById('ID-F001');
    const ppic=factories.getFactoryActivePpicSnapshot('ID-F001');
    const source=tasks.processTasks.find(x=>x.productionOrderId==='PO-202603-0002'&&x.processCode==='PROC_SEW');
    const sourceActions=await import('/src/data/fcs/production-context-actions.ts');
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
    const fixture=await import('/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts');
    const cutting=fixture.appendSimpleCutPieceDemoCuttingBatch(1,task.productionOrderId).event;
    const snap=await storage.readCuttingRecords();await storage.commitCuttingRecords({revision:snap.revision,change:{puts:[{id:'cutting-event:'+cutting.eventId,collection:'cutting-events',value:cutting}]},command:{id:'simple-perf-cut-prerequisite',intent:'explicit-mock-completed-cutting',result:null,at:'2026-09-25'}});
    const sheets=await import('/src/data/fcs/dispatch-task-sheet.ts');
    const sheet=sheets.buildDispatchTaskSheetData('ASG-HPB-BROWSER-TEST');
    return {order:task.productionOrderId,sheet:sheet.taskSheetNo,supports:sheet.supportsCutPieceHandover,taskId:task.taskId};
  });
  if(!result.supports)throw Error('前置任务不支持简易交出 '+JSON.stringify(result));
  await p.locator('[data-hpb-action=data-tools]').click();const download=p.waitForEvent('download');await p.locator('[data-hpb-data-action=export]').click();await (await download).saveAs('output/playwright/hpb/acceptance-final/simple-prerequisite.higcut');await context.close();return {...result,prerequisite:'原型静态PO-0002真实裁片来源，准备车缝任务有效分配与明确MOCK完成裁剪；无打印或交出结果'};
}
