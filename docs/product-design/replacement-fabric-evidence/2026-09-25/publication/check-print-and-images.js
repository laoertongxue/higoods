async page => {
 const context=await page.context().browser().newContext({viewport:{width:1280,height:720}}),p=await context.newPage(),samples=[];
 await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
 await p.evaluate(()=>{document.addEventListener('click',()=>window.__start=performance.now(),true)});
 const measure=async(name,action,condition)=>{await action();if(condition)await p.waitForFunction(condition,{},{timeout:5000});samples.push({name,ms:await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))))})};
 for(let i=0;i<5;i++){
  await measure('面料大图',()=>p.locator('[data-pda-image-preview-url]').first().click(),()=>{const img=document.querySelector('[data-pda-image-preview-root] img');return img?.complete&&img.naturalWidth});
  const overflow=await p.locator('[data-pda-image-preview-root] img').evaluate(img=>{const r=img.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight});if(overflow)throw Error('大图溢出');
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('[data-pda-image-preview-root]')?.innerHTML);
  await p.locator('[data-pda-image-preview-url]').first().click();await p.locator('[data-pda-image-preview-close]').last().click();
  await p.locator('[data-hpb-action="detail"]').first().click();
  await measure('新增独立票保存',()=>p.locator('[data-hpb-action="add"]').first().click(),()=>document.querySelector('[role=dialog]')?.textContent.includes('已新增 1 张独立票'));
  await p.locator('[data-hpb-action="close"]').click();
 }
 await p.locator('[data-hpb-action="detail"]').first().click();
 const ids=await p.locator('[data-hpb-ticket]').evaluateAll(ns=>ns.map(n=>n.dataset.hpbTicket));
 const pop=context.waitForEvent('page');await p.locator('[data-hpb-action="print-all"]').click();const print=await pop;
 await print.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] [data-real-qr] svg').length===6&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));
 await print.locator('[data-hpb-print-action="confirm"]').click();await print.waitForFunction(()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('请先打印'));const before=await print.locator('[data-hpb-print-feedback]').innerText();if(!before.includes('请先打印'))throw Error('未发起打印应阻断');
 await print.evaluate(()=>window.print=()=>{window.__printCount=(window.__printCount||0)+1});await print.locator('[data-hpb-print-action="print"]').click();await print.waitForFunction(()=>window.__printCount===1);
 await print.locator('[data-hpb-print-success]').first().check();await print.locator('[data-hpb-print-action="confirm"]').click();await print.waitForFunction(()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 1'));
 const first=await print.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');const s=await r.loadReplacementFabricState();return {tickets:s.tickets.length,prints:s.prints.length}});
 await print.locator('[data-hpb-print-action="print"]').click();await print.waitForFunction(()=>window.__printCount===2);await print.locator('[data-hpb-print-success]').first().check();await print.locator('[data-hpb-print-action="confirm"]').click();await print.waitForFunction(()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 1'));
 const reprint=await print.evaluate(async()=>{const r=await import('/src/data/fcs/cutting/replacement-fabric-repository.ts');const s=await r.loadReplacementFabricState();return {tickets:s.tickets.length,prints:s.prints.length,kinds:s.prints.map(x=>x.kind)}});
 if(first.tickets!==reprint.tickets||reprint.prints!==first.prints+1||!reprint.kinds.includes('REPRINT'))throw Error('补打数量/身份错误');
 await print.screenshot({path:'output/playwright/hpb/partial-reprint.png',fullPage:true});await print.close();await p.reload();await p.locator('[data-hpb-page]').waitFor();const partial=await p.locator('[data-hpb-page]').innerText();if(!partial.includes('部分已打印'))throw Error('部分打印状态错误');
 await context.close();return {samples,failed:samples.filter(s=>s.ms>=500),first,reprint,partial:true};
}
