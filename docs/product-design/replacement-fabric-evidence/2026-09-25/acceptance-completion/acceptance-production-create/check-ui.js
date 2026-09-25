async page=>{
 const results=[];
 for(const scene of ['save','kol-save','abort']){
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 try{await p.goto('http://127.0.0.1:43235/fcs/production/demand-inbox');const row=p.locator('tr').filter({hasText:scene==='kol-save'?'DEM-202603-0092':'DEM-202603-0091'});await row.getByRole('button',{name:'生成',exact:true}).click();await p.locator('[data-prod-action=open-demand-generate-confirm]').click();await p.locator('[data-prod-action=confirm-demand-generate]').waitFor();
 await p.evaluate(scene=>{window.__createWrites=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__createWrites.push(k);return set.call(this,k,v)};if(scene==='abort'){const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,...args){if(v?.collection==='production-context:orders')throw new DOMException('UI模拟空间不足','QuotaExceededError');return put.call(this,v,...args)}}},scene);
 const start=Date.now();await p.locator('[data-prod-action=confirm-demand-generate]').click();
 if(scene.endsWith('save'))await p.waitForFunction(()=>location.pathname.includes('/production/orders/PO-')&&!document.querySelector('[data-prod-action=confirm-demand-generate]')&&document.body.innerText.includes('基本信息'));else await p.waitForFunction(()=>document.body.innerText.includes('UI模拟空间不足'));
 const result={scene,ms:Date.now()-start,url:p.url(),errors,writes:await p.evaluate(()=>window.__createWrites),dialog:await p.locator('[data-prod-action=confirm-demand-generate]').count(),body:(await p.locator('body').innerText()).slice(-800)};
 await p.screenshot({path:`/private/tmp/higoods-replacement-fabric-release-20260925/output/playwright/hpb/acceptance-production-create/ui-${scene}.png`});
 if(scene.endsWith('save')){await p.reload();await p.waitForFunction(id=>document.body.innerText.includes(id),scene==='kol-save'?'DEM-202603-0092':'DEM-202603-0091');result.reloadBody=(await p.locator('body').innerText()).slice(-900)}
 results.push(result)
 }catch(e){results.push({scene,error:String(e),errors,body:(await p.locator('body').innerText()).slice(-1600)})}finally{await c.close()}
 }return results;
}
