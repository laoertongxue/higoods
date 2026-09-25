// Production preview strict script. Two explicit Mock backups contain no tested handover. Real UI only after restore. Not executed by source agent.
async page => {
 const base='http://127.0.0.1:43236',results=[],parts='BAG-HPB-PARTS-VERIFY',fabric='BAG-HPB-FABRIC-VERIFY';
 const fixtures={"unbound-fabric-omission-and-retry": {"taskId": "TASKGEN-202603-0002-002__ORDER", "taskNo": "TASKGEN-202603-0002-002", "productionOrderId": "PO-202603-0002", "ppicId": "PPIC-ACTIVE-004", "ppicName": "王芳", "factoryId": "ID-F001", "ticketId": "HPB-9d4be639f04a5998f33d9fc453a5f404f0156805ff666bb090b049b164226b49", "partId": "SIMPLE-OUTPUT-PO-202603-0002-1-L-tdv_demand_SPU_2024_005-pattern-main-back", "partQty": 800, "unit": "Yard", "length": 5, "boundFabric": false}, "both-bound-auto-aggregation": {"taskId": "TASKGEN-202603-0002-002__ORDER", "taskNo": "TASKGEN-202603-0002-002", "productionOrderId": "PO-202603-0002", "ppicId": "PPIC-ACTIVE-004", "ppicName": "王芳", "factoryId": "ID-F001", "ticketId": "HPB-9d4be639f04a5998f33d9fc453a5f404f0156805ff666bb090b049b164226b49", "partId": "SIMPLE-OUTPUT-PO-202603-0002-1-L-tdv_demand_SPU_2024_005-pattern-main-back", "partQty": 800, "unit": "Yard", "length": 5, "boundFabric": true}};
 const modal='[data-wait-handover-modal="handover"]';
 async function dbSnapshot(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('higood-cutting-records-v1');req.onsuccess=()=>{const db=req.result,tx=db.transaction(['records','commands','meta'],'readonly'),out={};for(const name of ['records','commands','meta']){const r=tx.objectStore(name).getAll();r.onsuccess=()=>out[name]=r.result.sort((a,b)=>String(a.id).localeCompare(String(b.id)))}tx.oncomplete=()=>{db.close();resolve(out)};tx.onabort=()=>reject(tx.error)};req.onerror=()=>reject(req.error)}))}
 async function measured(p,action,selector,invoke,condition,eventType='click'){
  await p.evaluate(({selector,condition,eventType})=>{
   window.__batchActionMs=0;let start=0,done=false,pending=false;
   const check=new Function('return ('+condition+')');
   const listen=e=>{if(!e.target.closest(selector))return;start=performance.now();document.removeEventListener(eventType,listen,true)};
   document.addEventListener(eventType,listen,true);
   async function tick(){if(done)return;if(start&&!pending){pending=true;let valid=false;try{valid=await check()}catch{}pending=false;
    const images=[...document.querySelectorAll('[data-wait-handover-modal] img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0});
    if(valid&&images.every(i=>i.complete&&i.naturalWidth)){done=true;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__batchActionMs=performance.now()-start));return}}
    requestAnimationFrame(tick)}requestAnimationFrame(tick);
  },{selector,condition,eventType});
  await invoke();await p.waitForFunction(()=>window.__batchActionMs>0,null,{timeout:10000});
  return {action,ms:await p.evaluate(()=>window.__batchActionMs)};
 }
 const stageCondition=name=>`[...document.querySelectorAll('[data-wait-handover-modal="handover"] [data-wait-handover-repack-step="${name}"]')].some(n=>n.getClientRects().length)`;
 async function stage(p,name){await p.locator(modal+' [data-wait-handover-repack-step="'+name+'"]').waitFor({state:'visible'});}
 async function move(p,name,direction,measures){const selector=modal+' [data-wait-handover-action=repack-'+direction+']';measures.push(await measured(p,direction+'-to-'+name,selector,()=>p.locator(selector+':visible').click(),stageCondition(name)));await stage(p,name)}
 async function next(p,name,measures){return move(p,name,'next',measures)}
 async function selected(p){return p.locator(modal+' select[data-wait-handover-field=sourceBagCodes]').evaluate(node=>[...node.selectedOptions].map(o=>o.value))}
 async function submit(p,word,measures){
  const selector=modal+' [data-wait-handover-action=submit-repack]';
  let condition=`document.querySelector('${modal} [data-wait-handover-feedback]')?.textContent.includes(${JSON.stringify(word)})`;
  if(word==='本次交出成功')condition=`(${condition}) && new Promise(resolve=>{const req=indexedDB.open('higood-cutting-records-v1');req.onsuccess=()=>{const db=req.result,tx=db.transaction('records','readonly'),r=tx.objectStore('records').getAll();tx.oncomplete=()=>{db.close();resolve(r.result.filter(x=>x.collection==='cutting-events'&&x.value.eventType==='新增交出记录'&&['BAG-HPB-PARTS-VERIFY','BAG-HPB-FABRIC-VERIFY'].includes(x.value.refs?.transferBagCode)).length===2&&r.result.some(x=>x.collection==='replacement-receipts'))}};req.onerror=()=>resolve(false)})`;
  measures.push(await measured(p,word==='本次交出成功'?'confirm-handover-persisted':'missing-fabric-block',selector,()=>p.locator(selector+':visible').click(),condition));
  return p.locator(modal+' [data-wait-handover-feedback]').innerText();
 }
 for(const scenario of ['unbound-fabric-omission-and-retry','both-bound-auto-aggregation'])for(let sample=1;sample<=5;sample++){
  const context=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await context.newPage(),errors=[],infrastructureErrors=[],steps=[],measures=[];p.setDefaultTimeout(10000);p.on('pageerror',error=>errors.push(String(error)));p.on('console',message=>{if(message.type()==='error'){const text=message.text();errors.push(text)}});
  try {
   
   await p.goto(base+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
   await p.goto(base+'/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
   const fixture=fixtures[scenario];
   await p.locator('[data-hpb-action=data-tools]').click();
   await p.locator('[data-hpb-restore-file]').setInputFiles('output/playwright/hpb/acceptance-final/batch-prerequisite-'+scenario+'.higcut');
   await p.waitForFunction(()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('已恢复并读回确认。'));
   const prerequisite=await dbSnapshot(p);
   if(prerequisite.records.some(r=>r.collection==='cutting-events'&&r.value.eventType==='新增交出记录'&&['BAG-HPB-PARTS-VERIFY','BAG-HPB-FABRIC-VERIFY'].includes(r.value.refs?.transferBagCode)))throw Error('备份包含被测交出结果');
   await p.goto(base+'/fcs/craft/cutting/warehouse-management/wait-handover');
   const open=p.locator('[data-wait-handover-action=open-handover]');try{await open.waitFor({state:'visible'})}catch{throw Error('无可达真实UI入口：中转袋交出按钮不存在或页面未完成读取')}measures.push(await measured(p,'open-handover','[data-wait-handover-action=open-handover]',()=>open.click(),stageCondition('sources')));await stage(p,'sources');
   const task=p.locator(modal+' [data-wait-handover-field=handoverTaskSelection]');if(!await task.locator('option').evaluateAll((nodes,id)=>nodes.some(n=>n.value===id),fixture.taskId))throw Error('真实任务下拉没有Mock分配任务');measures.push(await measured(p,'select-task',modal+' [data-wait-handover-field=handoverTaskSelection]',()=>task.selectOption(fixture.taskId),`document.querySelector('${modal} [data-wait-handover-field=handoverTaskSelection]')?.value===${JSON.stringify(fixture.taskId)} && [...document.querySelectorAll('${modal} [data-wait-handover-field=handoverPpicSelection] option')].some(o=>o.value.startsWith(${JSON.stringify(fixture.ppicId+'|')}))`,'change'));
   const ppic=p.locator(modal+' [data-wait-handover-field=handoverPpicSelection]');await p.waitForFunction(({modal,id})=>[...document.querySelectorAll(modal+' [data-wait-handover-field=handoverPpicSelection] option')].some(o=>o.value.startsWith(id+'|')),{modal,id:fixture.ppicId});const ppicValue=await ppic.locator('option').evaluateAll((nodes,id)=>nodes.find(n=>n.value.startsWith(id+'|')).value,fixture.ppicId);measures.push(await measured(p,'select-ppic',modal+' [data-wait-handover-field=handoverPpicSelection]',()=>ppic.selectOption(ppicValue),`document.querySelector('${modal} [data-wait-handover-field=handoverPpicSelection]')?.value===${JSON.stringify(ppicValue)}`,'change'));
   await next(p,'groups',measures);const initialSelection=await selected(p);steps.push({action:'UI选择任务与PPIC后自动归集',initialSelection,groupText:await p.locator(modal+' [data-wait-handover-repack-group-preview]').innerText()});
   if(scenario==='unbound-fabric-omission-and-retry'){
    if(JSON.stringify(initialSelection)!==JSON.stringify([parts]))throw Error('未绑定换片布袋不应自动计入本次提交：'+JSON.stringify(initialSelection));
    await next(p,'results',measures);await next(p,'returns',measures);await next(p,'confirm',measures);await p.locator(modal+' [data-wait-handover-field=operatorName]').fill('真实UI边界验收仓管');
    const before=await dbSnapshot(p);const feedback=await submit(p,'缺少换片布',measures);const after=await dbSnapshot(p);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('漏选换片布被阻断后records/commands/meta发生变化');steps.push({action:'真实确认漏选袋阻断',feedback,databaseUnchanged:true});
    for(const name of ['returns','results','groups']){await move(p,name,'back',measures)}
    await p.locator(modal+' [data-wait-handover-field=repackSourceBagCode]').fill(fabric);measures.push(await measured(p,'scan-add-fabric-bag',modal+' [data-wait-handover-action=add-repack-source]',()=>p.locator(modal+' [data-wait-handover-action=add-repack-source]').click(),`[...document.querySelector('${modal} select[data-wait-handover-field=sourceBagCodes]').selectedOptions].some(o=>o.value===${JSON.stringify(fabric)}) && document.querySelector('${modal} [data-wait-handover-repack-group-preview]')?.textContent.includes('5 Yard')`));await p.waitForFunction(({modal,fabric})=>[...document.querySelector(modal+' select[data-wait-handover-field=sourceBagCodes]').selectedOptions].some(o=>o.value===fabric),{modal,fabric});
    steps.push({action:'真实扫描输入补充换片布袋',selection:await selected(p),groupText:await p.locator(modal+' [data-wait-handover-repack-group-preview]').innerText()});
   }else if(initialSelection.length!==2||![parts,fabric].every(code=>initialSelection.includes(code)))throw Error('两个已绑定任务袋没有自动完整归集');
   const selectedBags=await selected(p);if(selectedBags.length!==2||![parts,fabric].every(code=>selectedBags.includes(code)))throw Error('确认前不恰好是两个袋');
   const groupText=await p.locator(modal+' [data-wait-handover-repack-group-preview]').innerText();if(!groupText.includes(fixture.partQty+' 片')||!groupText.includes('5 Yard'))throw Error('袋内裁片数量与5 Yard单位展示不一致：'+groupText);
   await next(p,'results',measures);await next(p,'returns',measures);await next(p,'confirm',measures);await p.locator(modal+' [data-wait-handover-field=operatorName]').fill('真实UI边界验收仓管');const beforeSuccess=await dbSnapshot(p);const feedback=await submit(p,'本次交出成功',measures);const saved=await dbSnapshot(p);
   const oldIds=new Set(beforeSuccess.records.map(r=>r.id));const events=saved.records.filter(r=>!oldIds.has(r.id)&&r.collection==='cutting-events'&&r.value.eventType==='新增交出记录'&&[parts,fabric].includes(r.value.refs?.transferBagCode)).map(r=>r.value);
   if(events.length!==2||new Set(events.map(e=>e.refs.handoverOrderId)).size!==1)throw Error('两袋没有以同一交出批次产生恰好两条事件');
   const snapshots=events.flatMap(e=>e.payload.feiTicketItems||[]);const hpb=snapshots.find(t=>t.feiTicketId===fixture.ticketId),part=snapshots.find(t=>t.feiTicketId===fixture.partId);if(!hpb||hpb.ticketKind!=='REPLACEMENT_FABRIC'||hpb.quantity!==5||hpb.quantityUnit!=='Yard'||hpb.pieceQty!==0||part?.pieceQty!==fixture.partQty)throw Error('交出快照混淆裁片与换片布数量单位');
   const receipts=saved.records.filter(r=>r.collection==='replacement-receipts'&&r.value.ticket?.id===fixture.ticketId).map(r=>r.value);if(receipts.length!==1||receipts[0].taskId!==fixture.taskId||!events.some(e=>e.refs.handoverRecordId===receipts[0].handoverRecordId)||receipts[0].ticket.length!==5||receipts[0].ticket.unit!=='Yard')throw Error('换片布回执与任务/同批交出事件不一致');
   await p.screenshot({path:'output/playwright/hpb/acceptance-final/batch-ui-preview-'+scenario+'-'+sample+'.png',fullPage:true});await p.reload();await p.locator('[data-wait-handover-action=open-handover]').waitFor();const reopened=await dbSnapshot(p);if(events.some(e=>!reopened.records.some(r=>r.collection==='cutting-events'&&r.value.eventId===e.eventId)))throw Error('刷新丢失交出事件');if(!reopened.records.some(r=>r.collection==='replacement-receipts'&&r.value.ticket?.id===fixture.ticketId))throw Error('刷新丢失换片布回执');
   results.push({scenario,sample,measures,fixture,steps,feedback,selectedBags,groupText,events:events.map(e=>({eventId:e.eventId,refs:e.refs,items:e.payload.feiTicketItems})),receipts,errors,infrastructureErrors,refreshConsistent:true,prerequisite:'明确Mock任务分配、已打印换片布票及两个入仓袋；未预写交出或领取结果。被测确认均来自真实待交出UI。'});
  }catch(error){results.push({scenario,sample,measures,error:String(error),steps,errors,infrastructureErrors,url:p.url(),body:(await p.locator('body').innerText()).slice(-9000),buttons:await p.locator('[data-wait-handover-action]').evaluateAll(nodes=>nodes.map(n=>({action:n.dataset.waitHandoverAction,text:n.textContent?.trim(),visible:!!(n.getClientRects().length),disabled:n.disabled})))})}finally{await context.close()}
 }
 return {results,failed:results.filter(r=>r.error||r.errors.length),reverseOrder:{uiApplicable:false,reason:'页面固定按任务自动归集已绑定袋；未提供控制批次处理先后顺序的用户操作。未强改hidden select或制造DOM按钮。逆序提交由既有领域单元/集成证据覆盖，由root绑定对应证据。'},overBudget:results.flatMap(r=>r.measures.filter(m=>m.ms>=500).map(m=>({scenario:r.scenario,sample:r.sample,...m}))),performance:'2场景各5次；从实际click/change事件到可读结果+可见图片完成+两帧；成功确认包含IndexedDB交出事件和回执读回。所有慢样本原样保留。' };
}
