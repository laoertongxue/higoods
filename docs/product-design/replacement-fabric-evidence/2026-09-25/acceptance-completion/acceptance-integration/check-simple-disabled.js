async page => {
 const context=await page.context().browser().newContext({viewport:{width:1366,height:768}});const p=await context.newPage();await p.routeWebSocket('**',socket=>socket.close());const errors=[];p.on('pageerror',e=>errors.push(String(e)));const wait=async(...args)=>{try{return await p.waitForFunction(...args)}catch(e){throw Error(String(args[0])+'\n'+errors.join('\n')+'\n'+(await p.locator('[data-simple-cut-content], [role=dialog], [role=alert]').allTextContents()).join('\n'))}};
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
 await p.addInitScript(()=>{
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
   Storage.prototype.getItem=function(key){if(key.startsWith('fcs_pda_'))return get.call(this,key);throw new DOMException('验收禁止旧存储读取 '+key,'SecurityError')};
   Storage.prototype.setItem=function(key,value){if(key.startsWith('fcs_pda_'))return set.call(this,key,value);throw new DOMException('验收禁止旧存储写入 '+key,'SecurityError')};
   Storage.prototype.removeItem=function(key){if(key.startsWith('fcs_pda_'))return remove.call(this,key);throw new DOMException('验收禁止旧存储删除 '+key,'SecurityError')};
 });
 await p.reload();await p.locator('[data-simple-cut-open]').waitFor();
 await p.locator('[data-simple-cut-open]').click();await p.locator('[data-simple-cut-input]').fill(fixture.sheet);await p.locator('[data-simple-cut-action="read"]').click();await wait(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
 await p.locator('[data-simple-cut-action="confirm"]').click();await wait(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('缺少换片布'));
 const blocked=await p.locator('[data-simple-cut-content] [role=status]').innerText();
 for(const t of fixture.tickets){await p.locator('[data-simple-replacement-input]').fill(t.qr);await p.locator('[data-simple-cut-action="scan-replacement"]').click();await wait(id=>document.querySelector('[data-simple-cut-action="remove-replacement:'+id+'"]'),t.id)}
 await p.locator('[data-simple-cut-action="confirm"]').click();await wait(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'),{},{timeout:15000});
 const saved=await p.locator('[data-simple-cut-content]').innerText();await p.screenshot({path:'output/playwright/hpb/simple-handover.png',fullPage:true});
 await p.evaluate(async()=>{(await import('/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts')).appendSimpleCutPieceDemoCuttingBatch(2)});
 await p.locator('[data-simple-cut-action="reset"]').click();await p.locator('[data-simple-cut-input]').fill(fixture.sheet);await p.locator('[data-simple-cut-action="read"]').click();await wait(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
 await p.locator('[data-simple-cut-action="confirm"]').click();await wait(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'));
 const second=await p.locator('[data-simple-cut-content]').innerText();if(!second.includes('换片布 0 张'))throw Error('分批交出重复要求换片布');
 const afterSecond=await p.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/cutting-record-repository.ts');const s=await r.readCuttingRecords();return {handovers:s.records.filter(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出').length,receipts:s.records.filter(r=>r.collection==='replacement-receipts').length}});
 if(afterSecond.handovers!==2||afterSecond.receipts!==1)throw Error('分批交出记录数量错误 '+JSON.stringify(afterSecond));
 const proof=await p.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/cutting-record-repository.ts');const s=await r.readCuttingRecords();return s.records.filter(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出').map(r=>r.value)});
 proof.sort((a,b)=>(b.payload.replacementFabricTickets?.length||0)-(a.payload.replacementFabricTickets?.length||0));const receiver=proof[0].payload.factoryId;await p.evaluate(async()=>{(await import('/src/data/fcs/store-domain-pda.ts')).clearPdaSession()});await p.goto('http://127.0.0.1:43235/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill(receiver+'_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
 await p.setViewportSize({width:360,height:800});
 await p.goto('http://127.0.0.1:43235/fcs/pda/handover/RECEIPT-'+proof[0].payload.handoverRecordId);
 await p.locator('[data-replacement-fabric-receipt]').waitFor({timeout:10000});
 const head=await p.locator('[data-simple-cut-piece-receipt]').innerText();await p.screenshot({path:'output/playwright/hpb/simple-receiver.png',fullPage:true});
 if(head.includes('车缝任务 未分配')||head.includes('接收工厂 未分配'))throw Error('接收详情错误显示未分配');
 await context.close();return {blocked,saved,second,afterSecond,head,events:proof.map(e=>({id:e.eventId,qty:e.payload.totalPieceQty,replacementCount:e.payload.replacementFabricTickets?.length}))};
}
