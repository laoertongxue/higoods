async page => {
 const context=await page.context().browser().newContext({viewport:{width:1366,height:768}});const p=await context.newPage();
 await p.goto('http://127.0.0.1:43235/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
 await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/warehouse-management/wait-handover');await p.locator('[data-simple-cut-open]').waitFor();
 const fixture=await p.evaluate(async()=>{
  const sheets=await import('/src/data/fcs/dispatch-task-sheet.ts');
  const assignments=sheets.listDispatchTaskSheetAssignments().filter(a=>a.productionOrderId==='PO-DEMO-SIMPLE-0916');
  const sheet=assignments.map(a=>sheets.buildDispatchTaskSheetData(a.assignmentId)).find(s=>s.supportsCutPieceHandover);if(!sheet)throw Error("无支持的任务");
  const repo=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');
  const source=await import('/src/data/fcs/cutting/replacement-fabric-source.ts');
  const scopes=source.listReplacementFabricOrderRows().flatMap(row=>row.scopes);
  const state=await repo.loadReplacementFabricState();const tickets=state.tickets.filter(t=>t.productionOrderId==='PO-DEMO-SIMPLE-0916');
  await repo.saveReplacementFabricPrint(tickets.map(t=>t.id),scopes,{id:'simple-fixture-print',operator:'隔离验收',at:'2026-09-25'});
  return {sheet:sheet.taskSheetNo,tickets:tickets.map(t=>({id:t.id,qr:"HIG:HPB:1:"+encodeURIComponent(t.id)})),assignment:sheet.assignment};
 });
 await p.locator('[data-simple-cut-open]').click();await p.locator('[data-simple-cut-input]').fill(fixture.sheet);await p.locator('[data-simple-cut-action="read"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
 await p.locator('[data-simple-cut-action="confirm"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('缺少换片布'));
 const blocked=await p.locator('[data-simple-cut-content] [role=status]').innerText();
 for(const t of fixture.tickets){await p.locator('[data-simple-replacement-input]').fill(t.qr);await p.locator('[data-simple-cut-action="scan-replacement"]').click();await p.waitForFunction(id=>document.querySelector('[data-simple-cut-action="remove-replacement:'+id+'"]'),t.id)}
 await p.locator('[data-simple-cut-action="confirm"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'),{},{timeout:15000});
 const saved=await p.locator('[data-simple-cut-content]').innerText();await p.screenshot({path:'output/playwright/hpb/simple-handover.png',fullPage:true});
 await p.evaluate(async()=>{(await import('/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts')).appendSimpleCutPieceDemoCuttingBatch(2)});
 await p.locator('[data-simple-cut-action="reset"]').click();await p.locator('[data-simple-cut-input]').fill(fixture.sheet);await p.locator('[data-simple-cut-action="read"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
 await p.locator('[data-simple-cut-action="confirm"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'));
 const second=await p.locator('[data-simple-cut-content]').innerText();if(!second.includes('换片布 0 张'))throw Error('分批交出重复要求换片布');
 const afterSecond=await p.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/cutting-record-repository.ts');const s=await r.readCuttingRecords();return {handovers:s.records.filter(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出').length,receipts:s.records.filter(r=>r.collection==='replacement-receipts').length}});
 if(afterSecond.handovers!==2||afterSecond.receipts!==1)throw Error('分批交出记录数量错误 '+JSON.stringify(afterSecond));
 const other=await p.evaluate(async()=>{
  const sheets=await import('/src/data/fcs/dispatch-task-sheet.ts');const all=sheets.listDispatchTaskSheetAssignments().filter(a=>a.productionOrderId==='PO-DEMO-SIMPLE-0916').map(a=>sheets.buildDispatchTaskSheetData(a.assignmentId)).filter(s=>s.supportsCutPieceHandover);return all.find(s=>s.assignment.skuLines[0].size==='L').taskSheetNo;
 });
 await p.locator('[data-simple-cut-action="reset"]').click();await p.locator('[data-simple-cut-input]').fill(other);await p.locator('[data-simple-cut-action="read"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
 await p.locator('[data-simple-cut-action="confirm"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('缺少换片布'));
 await p.locator('[data-simple-replacement-input]').fill(fixture.tickets[0].qr);await p.locator('[data-simple-cut-action="scan-replacement"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content] [role=status]')?.textContent.includes('已交出'));
 const newTicket=await p.evaluate(async()=>{
  const repo=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts'),source=await import('/src/data/fcs/cutting/replacement-fabric-source.ts');const scope=source.listReplacementFabricOrderRows().find(r=>r.order.productionOrderId==='PO-DEMO-SIMPLE-0916').scopes[0];const ticket=(await repo.addReplacementFabricTickets(scope,scope.materials[0].key,1,{id:'other-factory-add',at:'2026-09-25',operator:'隔离验收'}))[0];await repo.saveReplacementFabricPrint([ticket.id],[scope],{id:'other-factory-print',at:'2026-09-25',operator:'隔离验收'});return ticket;
 });
 await p.locator('[data-simple-replacement-input]').fill('HIG:HPB:1:'+encodeURIComponent(newTicket.id));await p.locator('[data-simple-cut-action="scan-replacement"]').click();await p.waitForFunction(id=>document.querySelector('[data-simple-cut-action="remove-replacement:'+id+'"]'),newTicket.id);
 await p.locator('[data-simple-cut-action="confirm"]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'));
 const otherSaved=await p.locator('[data-simple-cut-content]').innerText();if(!otherSaved.includes('换片布 1 张'))throw Error('另一工厂缺少独立换片布');
 const otherProof=await p.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');const s=await r.loadReplacementFabricState();return s.receipts.map(r=>({ticketId:r.ticket.id,sequence:r.ticket.sequence,taskId:r.taskId,factory:r.receiverFactoryId}))});
 if(otherProof.length!==2||new Set(otherProof.map(r=>r.ticketId)).size!==2||new Set(otherProof.map(r=>r.factory)).size!==2)throw Error('另一工厂回执错误 '+JSON.stringify(otherProof));
 const proof=await p.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/cutting-record-repository.ts');const s=await r.readCuttingRecords();return s.records.filter(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出').map(r=>r.value)});
 proof.sort((a,b)=>(b.payload.replacementFabricTickets?.length||0)-(a.payload.replacementFabricTickets?.length||0));const receiver=proof[0].payload.factoryId;await p.evaluate(async()=>{(await import('/src/data/fcs/store-domain-pda.ts')).clearPdaSession()});await p.goto('http://127.0.0.1:43235/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill(receiver+'_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
 await p.setViewportSize({width:360,height:800});
 await p.goto('http://127.0.0.1:43235/fcs/pda/handover/RECEIPT-'+proof[0].payload.handoverRecordId);
 await p.locator('[data-replacement-fabric-receipt]').waitFor({timeout:10000});
 const head=await p.locator('[data-simple-cut-piece-receipt]').innerText();await p.screenshot({path:'output/playwright/hpb/simple-receiver.png',fullPage:true});
 await context.close();return {blocked,saved,second,afterSecond,otherSaved,otherProof,proof,head};
}
