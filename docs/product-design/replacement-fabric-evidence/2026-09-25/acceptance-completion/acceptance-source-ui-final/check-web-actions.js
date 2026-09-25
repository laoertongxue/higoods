async(page)=>{
 const results=[];for(const scene of ['dispatch','tender','sample']){const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 try{
 if(scene==='dispatch'){
 await p.goto('http://127.0.0.1:43236/fcs/dispatch/workbench?type=NON_SEWING');const id='TASKGEN-po-14671-001__ORDER';await p.locator(`[data-unified-action=open-direct][data-task-id="${id}"]`).click();await p.locator('[data-unified-field=factoryId]').selectOption('ID-F004');await p.locator('[data-unified-field=price]').fill('1000');await p.locator('[data-unified-action=confirm-dispatch]').click();await p.getByText('谨慎确认价格，一经提交确认不得修改。').waitFor();await p.locator('[data-unified-action=confirm-dispatch]').click();await p.waitForFunction(()=>!document.querySelector('[data-unified-action=confirm-dispatch]'));await p.reload();await p.locator('[data-unified-dispatch-page]').waitFor();
 }else if(scene==='tender'){
 await p.goto('http://127.0.0.1:43236/fcs/dispatch/tenders');await p.locator('[data-tender-action=open-view][data-tender-id=TENDER-0003-001]').first().click();await p.locator('[data-tender-action=select-award-factory][data-factory-id=OWN-CUTTING-001]').click();await p.locator('[data-tender-action=confirm-award]').click();await p.getByText('谨慎确认价格，一经提交确认不得修改。').waitFor();await p.locator('[data-tender-action=confirm-award]').click();await p.waitForTimeout(700);
 }else{
 await p.goto('http://127.0.0.1:43236/fcs/sewing-outsourcing/sample-approval-suggestions');await p.locator('[data-sample-approval-action=receive-sample]').click();await p.locator('[data-sample-approval-field=receivedSamplePhotos]').setInputFiles('/private/tmp/higoods-replacement-fabric-release-20260925/public/shirt-sample.jpg');await p.getByText('已选择 1 张',{exact:true}).waitFor();await p.locator('[data-sample-approval-action=submit-receive]').click();await p.waitForTimeout(700);
 }
 results.push({scene,errors,body:(await p.locator('body').innerText()).slice(-4000),buttons:await p.locator('button').evaluateAll(es=>es.slice(-15).map(e=>({text:e.textContent.trim(),data:{...e.dataset}})))})
 }catch(e){results.push({scene,error:String(e),errors,body:(await p.locator('body').innerText()).slice(-2000)})}finally{await c.close()}}
 return results
}
