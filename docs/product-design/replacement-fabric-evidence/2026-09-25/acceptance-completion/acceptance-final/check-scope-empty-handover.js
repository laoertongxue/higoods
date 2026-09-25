async page=>{
 const origin='http://127.0.0.1:43235',result={origin,kind:'functional actual UI; explicit Mock source only',scenarios:[]};
 for(const kind of ['SCOPE-001','MAT-006']){
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),out={kind,errors:[]};p.setDefaultTimeout(10000);await p.routeWebSocket('**',s=>s.close());await p.addInitScript(()=>performance.setResourceTimingBufferSize(10000));p.on('pageerror',e=>out.errors.push(String(e)));
 try{
 await p.goto(origin+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
 await p.goto(origin+'/fcs/craft/cutting/warehouse-management/wait-handover');await p.locator('[data-simple-cut-open]').waitFor();
 out.fixture=await p.evaluate(async kind=>{
 const imp=path=>import(performance.getEntriesByType('resource').map(e=>e.name).find(url=>new URL(url).pathname===path)||path);
 const fixtures=await imp('/src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts');fixtures.ensureSimpleCutPieceHandoverFixtures();const sheets=await imp('/src/data/fcs/dispatch-task-sheet.ts');
 const orderId=kind==='SCOPE-001'?'PO-DEMO-TRIPLE-0916':fixtures.SIMPLE_CUT_PIECE_DEMO_ORDER_ID;
 const sheet=sheets.listDispatchTaskSheetAssignments().filter(a=>a.productionOrderId===orderId).map(a=>sheets.buildDispatchTaskSheetData(a.assignmentId)).find(s=>kind==='SCOPE-001'||(s.supportsCutPieceHandover&&s.assignment.skuLines.some(line=>line.size==='M')));
 if(!sheet)throw Error('Missing explicit named task fixture');
 if(kind==='MAT-006'){
 const po=await imp('/src/data/fcs/production-orders.ts'),actions=await imp('/src/data/fcs/production-context-actions.ts');
 await actions.saveProductionSourceAction({id:'MOCK-ALL-PU-TECH',intent:'explicit-complete-all-pu-source',action:()=>{const order=po.productionOrders.find(o=>o.productionOrderId===orderId);order.techPackSnapshot.bomItems.filter(x=>x.type==='面料').forEach(x=>x.name='完整映射针织朴');order.selectedTechPackVersionId='MOCK-ALL-PU-V1';order.techPackSnapshot.sourceTechPackVersionId=order.selectedTechPackVersionId;po.persistCreatedProductionOrders([orderId]);}});
 }
 const repo=await imp('/src/data/fcs/cutting/cutting-record-repository.ts');return {orderId,sheetNo:sheet.taskSheetNo,supportsCutPieceHandover:sheet.supportsCutPieceHandover,before:(await repo.readCuttingRecords()).records};
 },kind);
 await p.locator('[data-simple-cut-open]').click();await p.locator('[data-simple-cut-input]').fill(out.fixture.sheetNo);await p.locator('[data-simple-cut-action=read]').click();
 if(kind==='SCOPE-001'){
 await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('三合一任务请到面辅料仓接收'));
 out.content=await p.locator('[data-simple-cut-content]').innerText();out.disabled=await p.locator('[data-simple-cut-action=confirm]').isDisabled();out.hpbInput=await p.locator('[data-simple-replacement-input]').count();
 if(out.fixture.supportsCutPieceHandover||!out.disabled||out.hpbInput)throw Error('Self-cutting triple task entered cutting/HPB handover');
 }else{
 await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('本次完整清单'));
 out.before=await p.locator('[data-simple-cut-content]').innerText();if(!out.before.includes('无需换片布')||!out.before.includes('本次 0 张 / 0 Yard'))throw Error('Complete all-pu source incorrectly requires HPB');
 if(await p.locator('[data-simple-cut-action=confirm]').isDisabled())throw Error('Eligible cut pieces cannot be confirmed');
 await p.locator('[data-simple-cut-action=confirm]').click();await p.waitForFunction(()=>document.querySelector('[data-simple-cut-content]')?.textContent.includes('已交出 · 工厂已接收'));out.after=await p.locator('[data-simple-cut-content]').innerText();
 }
 out.records=await p.evaluate(async()=>{const path='/src/data/fcs/cutting/cutting-record-repository.ts';return(await(await import(performance.getEntriesByType('resource').map(e=>e.name).find(url=>new URL(url).pathname===path)||path)).readCuttingRecords()).records});
 if(kind==='SCOPE-001'){if(JSON.stringify(out.records)!==JSON.stringify(out.fixture.before))throw Error('Inapplicable task read persisted records');out.noReadWrites=true;}
 else{out.receipts=out.records.filter(r=>r.collection==='replacement-receipts');out.handovers=out.records.filter(r=>r.collection==='cutting-events'&&r.value.eventType==='简易裁片交出');if(out.receipts.length||out.handovers.length!==1||(out.handovers[0].value.payload.replacementFabricTickets||[]).length)throw Error('All-pu handover saved HPB or failed exact one cut handover');}
 delete out.records;delete out.fixture.before;await p.screenshot({path:'/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-final/boundary-'+kind+'-actual-handover.png',fullPage:true});if(out.errors.length)throw Error('Browser errors');out.passed=true;
 }catch(e){out.passed=false;out.error=String(e);out.body=(await p.locator('body').innerText()).slice(-3000)}finally{await c.close()}result.scenarios.push(out);
 }return result;
}
