async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),out=[],errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try {
 for(const [path,ready] of [['/fcs/dispatch/workbench?type=MERGED','[data-unified-dispatch-page]'],['/fcs/progress/handover','[data-handover-action=refresh]']]){
 await p.goto('http://127.0.0.1:43236'+path);await p.locator(ready).waitFor();if(path.includes('workbench')){await p.locator('[data-unified-action=switch-situation][data-situation=ASSIGNED]').click();await p.waitForFunction(()=>document.querySelector('[data-unified-action=switch-situation][data-situation=ASSIGNED]')?.className.includes('bg-blue'))}
 out.push({path,body:(await p.locator('body').innerText()).slice(-12000),actions:await p.locator('button[data-unified-action],button[data-handover-action]').evaluateAll(xs=>xs.map(x=>({action:x.dataset.unifiedAction||x.dataset.handoverAction,taskId:x.dataset.taskId,head:x.dataset.handoverId,text:x.textContent.trim(),disabled:x.disabled})))})
 }
 return {out,errors}
 } finally {await c.close()}
}
