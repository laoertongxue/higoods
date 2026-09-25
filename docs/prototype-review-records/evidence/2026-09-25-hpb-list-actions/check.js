async(page)=>{
 const browser=page.context().browser(),base='http://127.0.0.1:43236',route='/fcs/craft/cutting/replacement-fabric-fei-tickets',results=[],layouts=[];
 const setup=await browser.newContext(),sp=await setup.newPage();await sp.goto('http://127.0.0.1:43235'+route);await sp.waitForSelector('[data-hpb-page]');
 await sp.evaluate(async()=>{
  const repo=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');const {readCuttingRecords,commitCuttingRecords}=await import('/src/data/fcs/cutting/cutting-record-repository.ts');
  const state=await repo.loadReplacementFabricState(),first=state.tickets[0];
  if(!first)throw Error('Missing real assignment fixture');
  state.tickets=Array.from({length:12},(_,i)=>({...structuredClone(first),id:i?first.id+'-ui-'+i:first.id,sequence:i+1,ticketNo:first.ticketNo.replace(/\d+$/,String(i+1).padStart(3,'0')),creationCommandId:'ui-display-fixture',...(i===11?{invalidatedAt:'2026-09-25T01:00:00Z',invalidReason:'测试旧分配已变更'}:{})}));
  state.prints=[{id:'ui-first',ticketId:first.id,commandId:'ui-first',printedAt:'2026-09-25 09:00:00',printedBy:'打票员甲',kind:'FIRST_PRINT'},{id:'ui-reprint',ticketId:first.id,commandId:'ui-reprint',printedAt:'2026-09-25 10:00:00',printedBy:'打票员乙',kind:'REPRINT'}];
  state.receipts=[{id:'ui-receipt',ticket:state.tickets[0],taskId:'TASK-SEW-UI-001',receiverFactoryId:'FACTORY-UI-002',handoverRecordId:'HANDOVER-UI-003',confirmedAt:'2026-09-25 11:00:00',confirmedBy:'仓管甲',bagUseId:'BAG-USE-UI-004'}];
  const snapshot=await readCuttingRecords();await commitCuttingRecords({revision:snapshot.revision,change:{puts:repo.replacementStateToRecords(state)},command:{id:"ui-display-fixture",intent:"isolated display fixture",at:"2026-09-25 12:00:00",result:null}});
 });
 const fixture=await setup.storageState({indexedDB:true});fixture.origins.forEach(o=>o.origin=base);await setup.close();
 const c=await browser.newContext({viewport:{width:1366,height:768},storageState:fixture}),p=await c.newPage();
 await p.addInitScript(()=>{window.__stamp=0;['click','input','change','keydown'].forEach(t=>document.addEventListener(t,()=>window.__stamp=performance.now(),true));window.open=(url)=>{window.__opened=url;return null};});
 await p.goto(base+route);await p.waitForSelector('[data-hpb-page]');
 const click=a=>()=>p.locator('[data-hpb-action="'+a+'"]').first().click();
 const images=()=>p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-hpb-page] img')].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const act=async(name,run,check)=>{await run();if(check)await check();await images();const ms=await p.evaluate(()=>performance.now()-window.__stamp);results.push({name,ms});};
 const read=()=>p.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('higood-cutting-records-v1',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('records','readonly'),r=tx.objectStore('records').getAll();r.onsuccess=()=>resolve(JSON.stringify(r.result));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();};}));
 const before=await read();
 for(let i=0;i<5;i++){
  await p.evaluate(()=>window.__list=document.querySelector('[data-standard-list-table-section]'));
  await act('详情打开',click('detail'),()=>p.getByRole('dialog',{name:'换片布菲票详情',exact:true}).waitFor());
  const detail=p.getByRole('dialog',{name:'换片布菲票详情',exact:true});const content=await detail.innerText();
  for(const word of ['已打印 2 次','首次打印','补打','打票员甲','打票员乙','TASK-SEW-UI-001','FACTORY-UI-002','HANDOVER-UI-003','仓管甲','BAG-USE-UI-004','暂无打印记录','暂无交出记录'])if(!content.includes(word))throw Error('Missing detail '+word);
  if(await detail.locator('[data-hpb-action="add"], [data-hpb-ticket], [data-hpb-action="print-all"]').count())throw Error('Detail contains print controls');
  if(!await p.evaluate(()=>window.__list===document.querySelector('[data-standard-list-table-section]')))throw Error('List redrawn');
  await act('详情下一页',click('ticket-next'),()=>p.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('测试旧分配已变更')));
  await act('详情上一页',click('ticket-prev'),()=>p.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('TASK-SEW-UI-001')));
  if(i===0)await p.screenshot({path:'output/playwright/hpb-ui-split/detail.png'});
  await act('详情关闭',click('close'),()=>detail.waitFor({state:'detached'}));
  await act('打印打开',click('print'),()=>p.getByRole('dialog',{name:'打印换片布菲票',exact:true}).waitFor());
  if(await p.locator('[data-hpb-detail-ticket]').count())throw Error('Wrong print dialog');
  await act('打印全选',click('select-all'));await act('打印选中',click('print-selected'));
  if(!await p.evaluate(()=>JSON.parse(new URL(window.__opened,location.origin).searchParams.get('ticketIds')).length===11))throw Error('Print current 11 only');
  await act('清空选择',click('clear-selection'));await act('选一票',()=>p.locator('[data-hpb-ticket]').first().check());
  await act('打印单票',click('print-selected'));if(!await p.evaluate(()=>JSON.parse(new URL(window.__opened,location.origin).searchParams.get('ticketIds')).length===1))throw Error('Single print');
  await act('整单打印',click('print-all'));await act('打印下一页',click('ticket-next'));await act('打印上一页',click('ticket-prev'));await act('打印关闭',click('close'));
  await act('刷新状态',click('reload'));await act('历史查询打开',click('history'));await act('历史查询',click('history-query'));await act('历史关闭',click('close'));
  await act('本机数据打开',click('data-tools'),()=>p.locator('[data-hpb-data-action="export"]').waitFor());await act('本机数据关闭',click('close'));
  await act('筛选输入',()=>p.locator('[data-hpb-filter="order"]').fill('NO-SUCH-ORDER'));await act('查询',click('query'));await act('重置',click('reset'));await act('导出',click('export'));
  await act('排序',click('sort-column'));await act('列设置',click('column-settings'));await act('列设置关闭',click('close-column-settings'));
 }
 if(before!==await read())throw Error('Read-only display/print selection wrote records');
 for(const [width,height]of [[1366,768],[1280,720],[1024,768]]){await p.setViewportSize({width,height});await images();const layout=await p.evaluate(()=>{const b=[...document.querySelectorAll('[data-hpb-toolbar] button')].map(x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top}});return {overflow:document.documentElement.scrollWidth>innerWidth,gaps:b.slice(1).map((x,i)=>x.left-b[i].right),sameRow:b.every(x=>x.top===b[0].top)}});layouts.push({width,...layout});await p.screenshot({path:'output/playwright/hpb-ui-split/list-'+width+'.png'});await p.locator('[data-hpb-action=detail]').first().click();await images();if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('detail overflow');await p.locator('[data-hpb-action=close]').click();}
 await c.close();return {results,layouts,max:Math.max(...results.map(x=>x.ms)),failed:results.filter(x=>x.ms>=500),readOnly:true};
}
