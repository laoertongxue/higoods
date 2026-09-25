async page => {
 const context=await page.context().browser().newContext({viewport:{width:1280,height:720}}),p=await context.newPage(),results=[];
 const url='http://127.0.0.1:43226/fcs/craft/cutting/replacement-fabric-fei-tickets';
 await p.goto(url);await p.locator('[data-hpb-page]').waitFor();
 await p.evaluate(()=>{for(const name of ['click','change','input','dragstart','keydown'])document.addEventListener(name,()=>{window.__start=performance.now()},true)});
 const action=(name)=>p.locator(`[data-hpb-action="${name}"]`).first();
 const measure=async(name,run,check)=>{await run();if(check)await p.waitForFunction(check);await p.waitForFunction(()=>[...document.querySelectorAll('[data-hpb-page] img')].every(i=>i.complete));results.push({name,ms:await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))))})};
 for(let sample=1;sample<=5;sample++){
  await measure('面料筛选输入',()=>p.locator('[data-hpb-filter="material"]').fill('不存在面料-'+sample));
  await measure('面料查询',()=>action('query').click(),()=>document.querySelector('[data-hpb-page]').textContent.includes('当前没有分配'));
  await measure('重置筛选',()=>action('reset').click(),()=>document.querySelector('[data-hpb-action="detail"]'));
  await measure('打印状态选择',()=>p.locator('[data-hpb-filter="status"]').selectOption('全部已打印'));
  await measure('打印状态查询',()=>action('query').click(),()=>document.querySelector('[data-hpb-page]').textContent.includes('当前没有分配'));
  await action('reset').click();
  await measure('每页50条',()=>p.locator('[data-hpb-field="pageSize"]').selectOption('50'),()=>document.querySelector('[data-hpb-field="pageSize"]').value==='50');
  await measure('每页10条',()=>p.locator('[data-hpb-field="pageSize"]').selectOption('10'),()=>document.querySelector('[data-hpb-field="pageSize"]').value==='10');
  await action('column-settings').click();
  await measure('冻结列',()=>p.locator('[data-hpb-action="toggle-column-freeze"]:not([disabled])').first().click());
  await measure('列拖拽排序',()=>p.locator('[data-standard-list-column-drag]').last().dragTo(p.locator('[data-standard-list-column-drag]').first()));
  await action('close-column-settings').click();
  await action('column-settings').click();await action('restore-column-settings').click();await action('close-column-settings').click();
  await p.locator('[data-pda-image-preview-url]').first().click();await p.waitForFunction(()=>document.querySelector('[data-pda-image-preview-root] img')?.complete);
  await measure('大图Esc关闭',()=>p.keyboard.press('Escape'),()=>!document.querySelector('[data-pda-image-preview-root]')?.innerHTML);
  await action('detail').click();await measure('详情Esc关闭',()=>p.keyboard.press('Escape'),()=>!document.querySelector('[data-hpb-ticket]'));
 }
 await p.route('**/materials/fei-ticket/**',route=>route.abort());await p.reload();await p.locator('[data-hpb-page]').waitFor();await p.waitForFunction(()=>document.querySelector('[data-hpb-page]').textContent.includes('图片失败'));
 const failureVisible=true;await p.screenshot({path:'output/playwright/hpb/image-failure.png',fullPage:true});await p.unroute('**/materials/fei-ticket/**');await p.reload();await p.waitForFunction(()=>[...document.querySelectorAll('[data-hpb-page] img')].length&&[...document.querySelectorAll('[data-hpb-page] img')].every(i=>i.complete&&i.naturalWidth));
 const preference=await p.evaluate(()=>JSON.parse(localStorage.getItem('/fcs/craft/cutting/replacement-fabric-fei-tickets:columns')));
 await context.close();return{results,failed:results.filter(r=>r.ms>=500),failureVisible,recovered:true,preference};
}
