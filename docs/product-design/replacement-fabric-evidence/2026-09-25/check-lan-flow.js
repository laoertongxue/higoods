async page=>{
 const results=[];
 for(let sample=1;sample<=5;sample++){
  const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://192.168.5.10:43226/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
  const capabilities=await p.evaluate(()=>({secure:isSecureContext,subtle:!!crypto.subtle,randomUUID:!!crypto.randomUUID}));
  await p.locator('[data-hpb-action="detail"]').first().click();await p.locator('[data-hpb-ticket]').waitFor();
  const initial=await p.locator('[data-hpb-ticket]').getAttribute('data-hpb-ticket');await p.evaluate(()=>document.addEventListener('click',()=>window.__start=performance.now(),true));
  await p.locator('[data-hpb-action="add"]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-hpb-ticket]').length===2);const addMs=await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))));
  const popup=c.waitForEvent('page');await p.locator('[data-hpb-action="print-all"]').click();const print=await popup;
  await print.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] svg').length===2&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));
  await print.evaluate(()=>window.print=()=>window.__printed=true);await print.locator('[data-hpb-print-action="print"]').click();await print.waitForFunction(()=>window.__printed);
  await print.locator('[data-hpb-print-action="all"]').click();await print.locator('[data-hpb-print-action="confirm"]').click();await print.waitForFunction(()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 2'));
  await print.close();await p.reload();await p.waitForFunction(()=>document.querySelector('[data-hpb-page]')?.textContent.includes('全部已打印'));await p.locator('[data-hpb-action="detail"]').first().click();await p.locator('[data-hpb-ticket]').first().waitFor();
  const ids=await p.locator('[data-hpb-ticket]').evaluateAll(ns=>ns.map(n=>n.dataset.hpbTicket));if(ids.length!==2||!ids.includes(initial))throw Error('局域网刷新票号/数量不一致');
  results.push({sample,capabilities,initial,ids,addMs,errors,printed:2});await c.close();
 }
 return{results,failed:results.filter(r=>r.errors.length||r.addMs>=500)};
}
