async page=>{
 const c=await page.context().browser().newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[],o='http://127.0.0.1:43236',out={errors,steps:[]};p.on('pageerror',e=>errors.push(String(e)));p.setDefaultTimeout(6000);
 const note=async name=>out.steps.push({name,body:await p.locator('body').innerText()});
 try{
  await p.goto(o+'/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-action=data-tools]').click();await p.locator('[data-hpb-restore-file]').setInputFiles('/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-bag-lifecycle/repack-prerequisite.higcut');await p.waitForFunction(()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('已恢复'),{},{timeout:6000});
  await p.goto(o+'/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin');await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
  try{
   await p.goto(o+'/fcs/pda/cutting/transfer-bag/repack');await p.getByPlaceholder('扫描或填写车缝任务编号').fill('TASKGEN-202603-0002-002');await p.getByPlaceholder('扫描或填写接收 PPIC 编号').fill('PPIC-ACTIVE-004');await p.locator('[data-pda-repack-action=resolve-task]').click();await p.locator('[data-pda-repack-action=bags-reviewed]').waitFor();await note('classify-repack');
   await p.locator('[data-pda-repack-action=bags-reviewed]').click();await p.getByPlaceholder('扫描或填写结果袋编号').fill('BAG-UI-REPACK-RESULT');await p.locator('[data-pda-repack-action=activate-result]').click();
   for(const no of ['CUT-MIX-2','HPB/PO-202603-0002/tdv_demand_SPU_2024_005-bom-main/Grey/002','BND-MIX-2']){await p.getByPlaceholder('连续扫描菲票；也可手工填写').fill(no);await p.locator('[data-pda-repack-action=scan-ticket-to-active]').click();await note('scan '+no)}
   await p.locator('[data-pda-repack-action=complete-result]').click();await note('retained-source');
   if(await p.locator('[data-pda-repack-field=returnLocation]').count()){await p.locator('[data-pda-repack-field=returnLocation]').fill('A-R01-L01-P01');await p.locator('[data-pda-repack-action=set-return-location]').click();await note('location')}
   await p.locator('[data-pda-repack-action=returns-done]').click();await note('summary');await p.locator('[data-pda-repack-action=confirm]').click();await p.waitForFunction(()=>document.body.innerText.includes('本次中转袋交出成功')||document.body.innerText.includes('未保存'),{},{timeout:6000});await note('repack-submit');
  }catch(e){out.repackError=String(e);out.repackRuntimeState=await p.evaluate(()=>window.__higoodPdaTransferBagRepackState);out.repackDb=await p.evaluate(async()=>{const q=indexedDB.open('higood-cutting-records-v1');const db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});const rows=await new Promise((ok,no)=>{const x=db.transaction('records').objectStore('records').getAll();x.onsuccess=()=>ok(x.result);x.onerror=()=>no(x.error)});db.close();return rows.filter(r=>r.collection==='cutting-events').map(r=>({id:r.id,type:r.value.eventType,bag:r.value.refs.transferBagCode,payload:r.value.payload}))});await note('repack-blocked')}
  for(const [kind,code] of [['recovery','BAG-HPB-BROWSER-CUT'],['scrap','BAG-HPB-BROWSER-FAB']]){try{
   await p.goto(o+'/fcs/pda/cutting/transfer-bag/'+kind);await p.getByPlaceholder('扫描或填写中转袋编号').fill(code);await p.getByPlaceholder('扫描或填写中转袋编号').press('Enter');await note(kind+' identified');
   await p.getByLabel('我已收到实物中转袋').check();await p.getByLabel('我已确认实物袋内没有菲票或裁片').check();
   if(kind==='scrap'){await p.getByPlaceholder('例如：袋体破损，无法继续使用').fill('隔离验收：实物袋破损');await p.getByPlaceholder('填写主管姓名').fill('隔离验收主管');await p.getByLabel(/我确认报废后该袋永久不能再次装袋/).check()}
   await p.getByRole('button',{name:kind==='scrap'?'确认报废':'确认回收',exact:true}).click();await p.waitForFunction(k=>document.body.innerText.includes(k==='scrap'?'报废成功':'回收成功')||document.body.innerText.includes('未保存'),kind,{timeout:6000});await note(kind+' saved');
   await p.goto(o+'/fcs/pda/transfer-bag-detail?bagNo='+code);await p.getByRole('heading',{name:'中转袋扫码详情'}).waitFor();await note(kind+' detail');
  }catch(e){out[kind+'Error']=String(e);await note(kind+' blocked')}}
  return out;
 }catch(e){return {...out,error:String(e),body:await p.locator('body').innerText()}}finally{await c.close()}
}
