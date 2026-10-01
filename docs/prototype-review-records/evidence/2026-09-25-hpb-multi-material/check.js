async(page)=>{
const results=[];const route='http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets';
for(let sample=1;sample<=5;sample++){
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage();
 await p.addInitScript(()=>document.addEventListener('click',()=>window.__stamp=performance.now(),true));
 const ready=async()=>{await p.waitForFunction(()=>[...document.querySelectorAll('[data-real-qr]')].every(n=>n.querySelector('svg')));await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-hpb-page] img,.hpb-print-root img')].map(n=>n.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});};
 const act=async(name,fn,check)=>{await fn();if(check)await check();await ready();results.push({sample,name,ms:await p.evaluate(()=>performance.now()-window.__stamp)})};
 for(const mode of ['cold','refresh']){if(mode==='cold')await p.goto(route);else await p.reload();await p.waitForSelector('[data-hpb-action=detail]');await ready();results.push({sample,name:mode,ms:await p.evaluate(()=>performance.now())});}
 const row=p.locator('tbody tr').filter({hasText:'PO-202603-0002'});if(await row.locator('img').count()!==3)throw Error('Expected three materials');if(!(await p.locator('[data-hpb-page]').innerText()).includes('15 Yard'))throw Error('Expected 15 Yard');
 if(sample===1)for(const [width,height]of [[1366,768],[1280,720],[1024,768]]){await p.setViewportSize({width,height});await p.screenshot({path:'output/playwright/hpb-multi-material/list-'+width+'.png'});if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow');}
 await act('三种面料详情',()=>row.locator('[data-hpb-action=detail]').click(),()=>p.locator('[data-hpb-label]').first().waitFor());
 if(await p.locator('[data-hpb-label]').count()!==3)throw Error('Expected 3 tickets');const ids=await p.locator('[data-hpb-label]').evaluateAll(ns=>ns.map(n=>n.dataset.hpbLabel));if(new Set(ids).size!==3)throw Error('duplicate identity');
 for(let i=0;i<3;i++){
 const label=p.locator('[data-hpb-detail-ticket]').nth(i);
 await act('票面放大-'+i,()=>label.locator('[data-hpb-action=preview-ticket]').click(),()=>p.locator('[data-hpb-enlarged-host] [data-hpb-label]').waitFor());
 await act('关闭放大-'+i,()=>p.getByRole('button',{name:'关闭预览',exact:true}).click());
 await act('面料大图-'+i,()=>label.locator('[data-pda-image-preview-url]').click(),()=>p.waitForFunction(()=>document.querySelector('[data-pda-image-preview-root] img')?.complete));
 await act('关闭大图-'+i,()=>p.locator('[data-pda-image-preview-close]').nth(1).click());
 }
 if(sample===1)await p.screenshot({path:'output/playwright/hpb-multi-material/details.png'});
 await act('关闭详情',()=>p.getByRole('button',{name:'关闭',exact:true}).click());
 await act('三种面料打印选择',()=>row.locator('[data-hpb-action=print]').click(),()=>p.locator('[data-hpb-ticket]').first().waitFor());
 if(await p.locator('[data-hpb-ticket]').count()!==3)throw Error('Expected 3 choices');
 for(let i=0;i<2;i++)await act('勾选面料-'+i,()=>p.locator('[data-hpb-ticket]').nth(i).check());
 await act('选中两种面料生成预览',async()=>{const popup=c.waitForEvent('page');await p.locator('[data-hpb-action=print-selected]').click();const q=await popup;await q.waitForSelector('[data-hpb-label]');await q.waitForFunction(()=>document.querySelectorAll('[data-hpb-label]').length===2&&[...document.querySelectorAll('[data-real-qr]')].every(n=>n.querySelector('svg')));await q.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));});await q.close();});
 await act('整单三票生成预览',async()=>{const popup=c.waitForEvent('page');await p.locator('[data-hpb-action=print-all]').click();const q=await popup;await q.waitForSelector('[data-hpb-label]');await q.waitForFunction(()=>document.querySelectorAll('[data-hpb-label]').length===3&&[...document.querySelectorAll('[data-real-qr]')].every(n=>n.querySelector('svg')));await q.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));});if(sample===1)await q.screenshot({path:'output/playwright/hpb-multi-material/print-all.png',fullPage:true});await q.close();});
 await c.close();
}
return {results,max:Math.max(...results.map(r=>r.ms)),failed:results.filter(r=>r.ms>=500)};
}
