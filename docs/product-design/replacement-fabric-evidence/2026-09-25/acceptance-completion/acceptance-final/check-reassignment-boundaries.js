async root => {
  // Functional boundary script only. Unexecuted at authoring time; not a performance receipt.
  // Explicit Mock sources are allowed; prints and handovers below always use real UI.
  const base = 'http://127.0.0.1:43235', results = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const readRows = p => p.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('higood-cutting-records-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('records', 'readonly'), rows = tx.objectStore('records').getAll();
      tx.oncomplete = () => { db.close(); resolve(rows.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  const canonical = rows => JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
  const collection = (rows, name) => rows.filter(r=>r.collection===name);
  const eventReceipts = rows => rows.filter(r=>r.collection==='replacement-receipts'||r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出');
  async function login(p, account = 'OWN-CUTTING-001_admin') {
    await p.goto(base+'/fcs/pda/auth/login');
    await p.getByRole('textbox',{name:'登录账号'}).fill(account);
    await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');
    await p.getByRole('button',{name:'登录',exact:true}).click(); await p.waitForURL('**/fcs/pda/exec');
  }
  async function restorePrerequisite(p) {
    await p.goto(base+'/fcs/craft/cutting/replacement-fabric-fei-tickets');
    await p.locator('[data-hpb-action=data-tools]').click();
    await p.locator('[data-hpb-restore-file]').setInputFiles('output/playwright/hpb/acceptance-final/simple-prerequisite.higcut');
    await p.waitForFunction(()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('已恢复并读回确认'));
    const rows = await readRows(p);
    assert(!collection(rows,'replacement-prints').length&&!collection(rows,'replacement-receipts').length,
      '前置备份不得包含本次被测打印或换片布交出结果');
    assert(!rows.some(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出'),
      '前置备份不得包含本次被测裁片交出结果');
    await login(p);
    return p.evaluate(async()=>{
      const runtime=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/runtime-process-tasks.ts') || '/src/data/fcs/runtime-process-tasks.ts');
      const sheets=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/dispatch-task-sheet.ts') || '/src/data/fcs/dispatch-task-sheet.ts');
      const all=runtime.listRuntimeProcessTasks().filter(t=>t.productionOrderId==='PO-202603-0002');
      const cut=all.find(t=>runtime.canReassignRuntimeCuttingTask(t));
      const sheet=sheets.buildDispatchTaskSheetData('ASG-HPB-BROWSER-TEST');
      if(!cut||!sheet?.supportsCutPieceHandover)throw Error('现有前置缺少可整单改派的裁剪任务或可交出车缝任务');
      return {order:'PO-202603-0002',cutTaskId:cut.taskId,cutTaskNo:cut.taskNo||cut.taskId,
        sewingTaskId:sheet.assignment.runtimeTaskId,oldFactory:sheet.assignment.factoryId,sheet:sheet.taskSheetNo};
    });
  }
  async function openOrderDetail(p, order) {
    await p.goto(base+'/fcs/craft/cutting/replacement-fabric-fei-tickets');
    await p.locator('[data-hpb-filter=order]').fill(order);await p.locator('[data-hpb-action=query]').click();
    await p.locator('[data-hpb-action=detail][data-order-id="'+order+'"]').click();
    await p.locator('[data-hpb-ticket]').first().waitFor();
  }
  async function previewSelected(p,c, ticketId) {
    await p.locator('[data-hpb-ticket="'+ticketId+'"]').check();
    const popup=c.waitForEvent('page');await p.locator('[data-hpb-action=print-selected]').click();
    const q=await popup;
    await q.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] svg').length>0&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));
    return q;
  }
  async function printCurrentOrder(p,c,order) {
    await openOrderDetail(p,order);
    const ids=await p.locator('[data-hpb-ticket]').evaluateAll(nodes=>nodes.map(n=>n.dataset.hpbTicket));
    const pop=c.waitForEvent('page');await p.locator('[data-hpb-action=print-all]').click();const q=await pop;
    await q.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] svg').length>0&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));
    await q.locator('[data-hpb-print-action=print]').click();await q.waitForFunction(()=>window.__printed===1);
    await q.locator('[data-hpb-print-action=all]').click();await q.locator('[data-hpb-print-action=confirm]').click();
    await q.waitForFunction(n=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 '+n),ids.length);
    await q.close(); return ids;
  }
  async function reassignCuttingByUI(p, taskId, taskNo) {
    await p.goto(base+'/fcs/dispatch/workbench?type=NON_SEWING');
    await p.locator('[data-unified-field=keyword]').fill(taskNo);
    await p.locator('[data-unified-action=open-reassign][data-task-id="'+taskId+'"]').click();
    await p.locator('[data-unified-field=factoryId]').selectOption('ID-F004');
    await p.locator('[data-unified-field=price]').fill('1000');
    await p.locator('[data-unified-field=reassignReason]').fill('边界验收：整任务改派离开原裁床，保留原历史');
    await p.locator('[data-unified-action=confirm-dispatch]').click();
    await p.getByText('谨慎确认价格，一经提交确认不得修改。').waitFor();
    await p.locator('[data-unified-action=confirm-dispatch]').click();
    await p.waitForFunction(()=>document.body.innerText.includes('裁剪任务已整单改派给')&&!document.querySelector('[data-unified-action=confirm-dispatch]'));
  }
  async function readHandover(p,sheet) {
    await p.goto(base+'/fcs/craft/cutting/warehouse-management/wait-handover');
    await p.locator('[data-simple-cut-open]').click();
    await p.locator('[data-simple-cut-root=WEB] [data-simple-cut-input]').fill(sheet);
    await p.locator('[data-simple-cut-root=WEB] [data-simple-cut-action=read]').click();
    await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
  }
  async function scanReplacement(p,id) {
    await p.locator('[data-simple-replacement-input]').fill('HIG:HPB:1:'+encodeURIComponent(id));
    await p.locator('[data-simple-cut-action=scan-replacement]').click();
    await p.locator('[data-simple-cut-action="remove-replacement:'+id+'"]').waitFor();
  }
  async function firstHandover(p,c,f) {
    const ids=await printCurrentOrder(p,c,f.order);await readHandover(p,f.sheet);
    await p.locator('[data-simple-cut-action=confirm]').click();
    await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content] [role=status]')?.textContent.includes('缺少换片布'));
    for(const id of ids)await scanReplacement(p,id);
    await p.locator('[data-simple-cut-action=confirm]').click();
    await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'));
    const saved=await readRows(p),receipts=collection(saved,'replacement-receipts');
    assert(receipts.length===ids.length&&receipts.every(r=>r.value.taskId===f.sewingTaskId&&r.value.receiverFactoryId===f.oldFactory),
      '首批真实交出回执必须归属原taskId及原工厂');
    return {ids,receipts,saved,visible:await p.locator('[data-simple-cut-content]').innerText()};
  }
  for(const scene of ['ORDER-006-stale-preview','ORDER-007-handed-over-history','HAND-012-same-task-new-factory']) {
    const c=await root.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];
    c.on('page',q=>q.on('pageerror',e=>errors.push(String(e))));p.on('pageerror',e=>errors.push(String(e)));
    await c.routeWebSocket('**',socket=>socket.close());
    await c.addInitScript(()=>{performance.setResourceTimingBufferSize(10000);window.print=()=>{window.__printed=(window.__printed||0)+1;};});
    await p.routeWebSocket('**',socket=>socket.close());p.setDefaultTimeout(12000);
    try {
      if(scene==='ORDER-006-stale-preview') {
        const f=await restorePrerequisite(p),taskId=f.cutTaskId;
        await openOrderDetail(p,f.order);const id=await p.locator('[data-hpb-ticket]').first().getAttribute('data-hpb-ticket');
        const q=await previewSelected(p,c,id);await q.locator('[data-hpb-print-action=print]').click();await q.locator('[data-hpb-print-success]').check();
        const editor=await c.newPage();await reassignCuttingByUI(editor,taskId,f.cutTaskNo);
        const before=await readRows(editor);await q.locator('[data-hpb-print-action=confirm]').click();
        await q.waitForFunction(()=>{const t=document.querySelector('[data-hpb-print-feedback]')?.textContent||'';return t.length>0&&!t.includes('已保存')});
        const after=await readRows(editor),feedback=await q.locator('[data-hpb-print-feedback]').innerText();
        assert(/失效|分配|变更|范围|不可|不能|重新/.test(feedback),'旧预览拒绝须说明分配/范围变化');
        assert(canonical(collection(before,'replacement-prints'))===canonical(collection(after,'replacement-prints')),'旧预览确认不能落打印记录');
        assert(canonical(eventReceipts(before))===canonical(eventReceipts(after)),'旧预览拒绝不能改变交出历史');
        results.push({scene,passed:true,oldTicketId:id,feedback,unchangedPrints:true,unchangedReceipts:true,errors});
      } else {
        const f=await restorePrerequisite(p),first=await firstHandover(p,c,f);
        if(scene==='ORDER-007-handed-over-history') {
          await reassignCuttingByUI(p,f.cutTaskId,f.cutTaskNo);
          const after=await readRows(p);
          assert(canonical(eventReceipts(first.saved))===canonical(eventReceipts(after)),'改派后原裁片事件和HPB回执必须逐字段不变');
          await p.goto(base+'/fcs/craft/cutting/replacement-fabric-fei-tickets');
          await p.locator('[data-hpb-filter=order]').fill(f.order);await p.locator('[data-hpb-action=query]').click();
          await p.waitForFunction(order=>!document.querySelector('[data-hpb-action=detail][data-order-id="'+order+'"]'),f.order);
          await p.locator('[data-hpb-action=history]').click();await p.locator('[data-hpb-history-query]').fill(f.order);await p.locator('[data-hpb-action=history-query]').click();
          const history=await p.getByRole('dialog',{name:'历史换片布票'}).innerText();
          for(const r of first.receipts)assert(history.includes(r.value.ticket.ticketNo),'已交票须在历史中保留原票号');
          const event=first.saved.find(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出');
          const receiver=await c.newPage();await receiver.goto(base+'/fcs/pda/exec');
          await receiver.evaluate(async()=>{(await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/store-domain-pda.ts') || '/src/data/fcs/store-domain-pda.ts')).clearPdaSession()});
          await login(receiver,f.oldFactory+'_admin');await receiver.goto(base+'/fcs/pda/handover/RECEIPT-'+event.value.payload.handoverRecordId);
          await receiver.locator('[data-replacement-fabric-receipt]').waitFor();const visibleReceipt=await receiver.locator('[data-simple-cut-piece-receipt]').innerText();
          assert(visibleReceipt.includes(f.order),'改派后的原回执直达必须仍显示原生产单');
          await receiver.reload();await receiver.locator('[data-replacement-fabric-receipt]').waitFor();
          assert(canonical(eventReceipts(first.saved))===canonical(eventReceipts(await readRows(p))),'直达刷新不能改写原回执');
          results.push({scene,passed:true,fixture:f,history,visibleReceipt,receiptSnapshotsUnchanged:true,errors});
        } else {
          // Explicit Mock source boundary: production sewing reassign UI creates __Rxx task IDs.
          // Therefore keep the same taskId here by changing only the upstream assignment facts.
          // No replacement receipt, print or handover result is manufactured below.
          const changed=await p.evaluate(async(f)=>{
            const runtime=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/runtime-process-tasks.ts') || '/src/data/fcs/runtime-process-tasks.ts'),assignments=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/effective-task-assignments.ts') || '/src/data/fcs/effective-task-assignments.ts');
            const actions=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/production-context-actions.ts') || '/src/data/fcs/production-context-actions.ts'),factories=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/factory-master-store.ts') || '/src/data/fcs/factory-master-store.ts');
            const old=assignments.listCurrentEffectiveTaskAssignments(f.sewingTaskId).find(a=>a.factoryId===f.oldFactory);
            const target=factories.listSewingFactoryMasterRecords().find(x=>x.factoryType==='THIRD_SEWING'&&x.id!==f.oldFactory&&x.id!=='KOL_GOTO_FACTORY'&&!x.name.toLowerCase().includes('kol goto')&&!x.isTestFactory&&factories.getFactoryActivePpicSnapshot(x.id));
            if(!old||!target)throw Error('同ID来源边界缺原有效分配或不同的有效车缝工厂');
            const ppic=factories.getFactoryActivePpicSnapshot(target.id),at='2026-09-25 15:00:00',newId='ASG-MOCK-SAME-TASK-NEW-FACTORY';
            await actions.saveProductionSourceAction({id:'boundary-same-task-source',intent:'explicit-mock-upstream-factory-change-only',action:()=>{
              assignments.supersedeEffectiveTaskAssignmentsForReassignment({sourceRuntimeTaskId:f.sewingTaskId,replacementAssignmentId:newId,reason:'明确Mock：保持同taskId仅改变上游工厂',operatedAt:at,operatedBy:ppic.ppicName});
              const state=runtime.captureRuntimeDirectDispatchState(),prior=state.taskOverrides.find(([id])=>id===f.sewingTaskId)?.[1]||{};
              state.taskOverrides=state.taskOverrides.filter(([id])=>id!==f.sewingTaskId);
              state.taskOverrides.push([f.sewingTaskId,{...prior,assignedFactoryId:target.id,assignedFactoryName:target.name,businessAssignedAt:at,dispatchedAt:at,updatedAt:at}]);runtime.restoreRuntimeDirectDispatchState(state);
              assignments.createEffectiveTaskAssignment({assignmentId:newId,runtimeTaskId:f.sewingTaskId,productionOrderId:old.productionOrderId,productionOrderNo:old.productionOrderNo,taskNo:old.taskNo,factoryId:target.id,factoryName:target.name,source:'DIRECT_DISPATCH',assignedQty:old.assignedQty,skuLines:old.skuLines,processCodes:old.processCodes,frozenPrice:1000,priceCurrency:'IDR',priceUnit:'件',businessAssignedAt:at,operatedAt:at,operatedBy:ppic.ppicName,allocationOperatorPpicId:ppic.ppicId,allocationOperatorPpicName:ppic.ppicName});
              return true;
            }});
            // A new explicit MOCK cutting batch provides positive pieces for the second handover.
            const fixture=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts') || '/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts'),storage=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/cutting/cutting-record-repository.ts') || '/src/data/fcs/cutting/cutting-record-repository.ts');
            const snapshot=await storage.readCuttingRecords();
            const priorCut=snapshot.records.find(row=>row.collection==='cutting-events'&&row.value.eventType==='完成裁剪'&&row.value.refs.productionOrderId===f.order)?.value;
            if(!priorCut)throw Error('缺少可追溯的初批裁剪Mock来源');
            const cut=structuredClone(priorCut),suffix='HAND012-MOCK-NEW-BATCH';
            cut.eventId+='-'+suffix;cut.idempotencyKey+='-'+suffix;cut.occurredAt=at;
            for(const key of ['spreadingOrderId','spreadingOrderNo']) {cut.refs[key]+='-'+suffix;cut.payload[key]=cut.refs[key]}
            cut.payload.outputLines=cut.payload.outputLines.map(line=>({...line,outputId:line.outputId+'-'+suffix}));
            await storage.commitCuttingRecords({revision:snapshot.revision,change:{puts:[{id:'cutting-event:'+cut.eventId,collection:'cutting-events',value:cut}]},command:{id:'boundary-second-cutting-source',intent:'explicit-mock-new-completed-cutting-batch-no-handover',result:null,at}});
            const sheets=await import(performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname==='/src/data/fcs/dispatch-task-sheet.ts') || '/src/data/fcs/dispatch-task-sheet.ts'),sheet=sheets.buildDispatchTaskSheetData(newId);
            if(sheet.assignment.runtimeTaskId!==f.sewingTaskId)throw Error('夹具意外改变taskId，不能证明HAND012');
            return {taskId:sheet.assignment.runtimeTaskId,factoryId:target.id,factoryName:target.name,sheet:sheet.taskSheetNo};
          },f);
          assert(changed.taskId===f.sewingTaskId&&changed.factoryId!==f.oldFactory,'必须同taskId不同工厂');
          const beforeGate=await readRows(p);assert(canonical(eventReceipts(first.saved))===canonical(eventReceipts(beforeGate)),'来源前置不得伪造/改写真实首批交出结果');
          await readHandover(p,changed.sheet);await p.locator('[data-simple-cut-action=confirm]').click();
          await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content] [role=status]')?.textContent.includes('缺少换片布'));
          const missing=await p.locator('[data-simple-cut-content] [role=status]').innerText();
          await p.locator('[data-simple-replacement-input]').fill('HIG:HPB:1:'+encodeURIComponent(first.ids[0]));await p.locator('[data-simple-cut-action=scan-replacement]').click();
          await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content] [role=status]')?.textContent.includes('已交出'));
          const oldTicketRejected=await p.locator('[data-simple-cut-content] [role=status]').innerText();
          assert(canonical(eventReceipts(beforeGate))===canonical(eventReceipts(await readRows(p))),'新工厂缺票/旧票拒绝时不能新增交出');
          await openOrderDetail(p,f.order);await p.locator('[data-hpb-action=add]').first().click();await p.waitForFunction(()=>document.querySelector('[role=dialog] [role=status]')?.textContent.includes('已新增'));
          const ids=await p.locator('[data-hpb-ticket]').evaluateAll(ns=>ns.map(n=>n.dataset.hpbTicket)),newId=ids.find(id=>!first.ids.includes(id));assert(newId,'必须从真实新增按钮得到新独立票');
          const q=await previewSelected(p,c,newId);await q.locator('[data-hpb-print-action=print]').click();await q.locator('[data-hpb-print-success]').check();await q.locator('[data-hpb-print-action=confirm]').click();await q.waitForFunction(()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 1'));await q.close();
          await readHandover(p,changed.sheet);await scanReplacement(p,newId);await p.locator('[data-simple-cut-action=confirm]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'));
          const receipts=collection(await readRows(p),'replacement-receipts');
          assert(receipts.length===first.receipts.length+1,'只能增加新工厂本次一张回执');
          assert(receipts.every(r=>r.value.taskId===f.sewingTaskId)&&new Set(receipts.map(r=>r.value.receiverFactoryId)).size===2,'新旧回执必须同taskId而不同工厂');
          assert(first.receipts.every(old=>canonical([old])===canonical(receipts.filter(r=>r.id===old.id))),'旧工厂实收原快照不得改变');
          results.push({scene,passed:true,upstreamChangeIsExplicitMock:true,fixture:f,changed,missing,oldTicketRejected,firstTicketIds:first.ids,newTicketId:newId,receipts,errors});
        }
      }
    } catch(error) {results.push({scene,passed:false,error:String(error),errors,url:p.url(),body:(await p.locator('body').innerText()).slice(-4000)});}
    finally {await c.close();}
  }
  return {base,executedActions:'real UI printing, cutting reassignment and handover; same-task factory source change explicitly Mock',performanceClaim:false,results,failed:results.filter(r=>!r.passed||r.errors.length)};
}
