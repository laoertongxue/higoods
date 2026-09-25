async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),out=[];
 p.on('pageerror',e=>out.push({pageerror:String(e),url:p.url()}));
 try{
  for(const path of ['/fcs/dispatch/workbench?type=NON_SEWING','/fcs/dispatch/tenders','/fcs/sewing-outsourcing/sample-approval-suggestions','/fcs/sewing-outsourcing/responsibility-transfers','/fcs/contracts','/fcs/progress/handover']){
   await p.goto('http://127.0.0.1:43236'+path);await p.waitForTimeout(350);
   out.push({path,url:p.url(),body:(await p.locator('[data-page-content-root]').innerText()).slice(0,2500),buttons:await p.locator('[data-page-content-root] button').evaluateAll(es=>es.filter(e=>e.textContent.trim()).map(e=>({text:e.textContent.trim(),disabled:e.disabled,data:{...e.dataset}})).slice(0,30)),links:await p.locator('[data-page-content-root] a').evaluateAll(es=>es.slice(0,15).map(e=>({text:e.textContent,href:e.getAttribute('href')})))});
  }
  await p.goto('http://127.0.0.1:43236/fcs/pda/auth/login');await p.getByRole('textbox',{name:'登录账号'}).fill('OWN-CUTTING-001_admin',{timeout:4000});await p.getByRole('textbox',{name:'密码',exact:true}).fill('123456');await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/fcs/pda/exec');
  for(const path of ['/fcs/pda/task-receive','/fcs/pda/exec','/fcs/pda/handover']){
   await p.goto('http://127.0.0.1:43236'+path);await p.waitForTimeout(200);
   out.push({path,body:(await p.locator('body').innerText()).slice(-3000),buttons:await p.locator('button').evaluateAll(es=>es.filter(e=>e.textContent.trim()).map(e=>({text:e.textContent.trim(),disabled:e.disabled,data:{...e.dataset}})).slice(-25)),links:await p.locator('a').evaluateAll(es=>es.slice(-15).map(e=>({text:e.textContent,href:e.getAttribute('href')})))});
  }
 }catch(e){out.push({error:String(e),url:p.url(),body:(await p.locator('body').innerText()).slice(-4500)})}finally{await c.close()}return out
}
