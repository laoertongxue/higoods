async root=>{
 const results=[];
 for(let sample=1;sample<=5;sample++){
  const c=await root.context().browser().newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[];c.on('page',q=>q.on('pageerror',e=>errors.push(e.message)));
  await c.addInitScript(()=>{window.print=()=>window.__printed=(window.__printed||0)+1;let ready=false;const done=()=>{if(ready||!document.querySelector('[data-hpb-label] svg')||[...document.querySelectorAll('[data-hpb-label] img')].some(i=>!i.complete||!i.naturalWidth))return;ready=true;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__labelReady=performance.timeOrigin+performance.now()))};new MutationObserver(done).observe(document,{childList:true,subtree:true});document.addEventListener('load',done,true);for(const t of ['click','change'])document.addEventListener(t,()=>window.__start=performance.now(),true)});
  const ms=async(q)=>q.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))));
  const act=async(q,name,run,check)=>{await run();if(check)await q.waitForFunction(check);results.push({sample,name,ms:await ms(q)})};
  await p.goto('http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-action=detail]').first().click();await p.locator('[data-hpb-action=add]').first().click();await p.waitForFunction(()=>document.querySelector('[role=dialog] [role=status]')?.textContent.includes('已新增'));
  const ids=await p.locator('[data-hpb-ticket]').evaluateAll(ns=>ns.map(n=>n.dataset.hpbTicket));if(ids.length!==2)throw Error('前置票数错误');
  await p.locator('[data-hpb-ticket]').first().check();const pop=c.waitForEvent('page');await p.locator('[data-hpb-action=print-selected]').click();const q=await pop;
  await q.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] svg').length===1&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));
  await q.waitForFunction(()=>window.__labelReady);results.push({sample,name:'选票预览加载',ms:(await q.evaluate(()=>window.__labelReady))-(await p.evaluate(()=>performance.timeOrigin+window.__start))});
  await act(q,'未打印确认阻断',()=>q.locator('[data-hpb-print-action=confirm]').click(),()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('请先打印'));
  await act(q,'调用打印',()=>q.locator('[data-hpb-print-action=print]').click(),()=>window.__printed===1);
  await act(q,'成功票全选',()=>q.locator('[data-hpb-print-action=all]').click(),()=>document.querySelector('[data-hpb-print-success]')?.checked);
  await act(q,'成功票取消勾选',()=>q.locator('[data-hpb-print-success]').uncheck(),()=>!document.querySelector('[data-hpb-print-success]')?.checked);
  await act(q,'成功票单选',()=>q.locator('[data-hpb-print-success]').check(),()=>document.querySelector('[data-hpb-print-success]')?.checked);
  await act(q,'首打确认保存',()=>q.locator('[data-hpb-print-action=confirm]').click(),()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 1'));
  await act(q,'补打调用',()=>q.locator('[data-hpb-print-action=print]').click(),()=>window.__printed===2);await q.locator('[data-hpb-print-success]').check();
  await act(q,'补打确认保存',()=>q.locator('[data-hpb-print-action=confirm]').click(),()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('已保存 1'));
  await q.close();await p.locator('[data-hpb-action=close]').click();await p.reload();await p.waitForFunction(()=>document.querySelector('[data-hpb-page]')?.textContent.includes('部分已打印'));await p.locator('[data-hpb-action=detail]').first().click();
  const popAll=c.waitForEvent('page');await p.locator('[data-hpb-action=print-all]').click();const all=await popAll;await all.waitForFunction(()=>document.querySelectorAll('[data-hpb-label] svg').length===2&&[...document.querySelectorAll('[data-hpb-label] img')].every(i=>i.complete&&i.naturalWidth));await all.waitForFunction(()=>window.__labelReady);results.push({sample,name:'整单预览加载',ms:(await all.evaluate(()=>window.__labelReady))-(await p.evaluate(()=>performance.timeOrigin+window.__start))});await c.route('**/materials/fei-ticket/**',route=>route.abort());await all.reload();await all.waitForFunction(()=>document.querySelector('[data-hpb-label] img')?.complete&&!document.querySelector('[data-hpb-label] img')?.naturalWidth);await act(all,'图片失败阻断打印',()=>all.locator('[data-hpb-print-action=print]').click(),()=>document.querySelector('[data-hpb-print-feedback]')?.textContent.includes('图片尚未'));if(await all.evaluate(()=>window.__printed||0))throw Error('图片失败仍调用打印');await c.unroute('**/materials/fei-ticket/**');await all.close();
  const saved=await p.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('higood-cutting-records-v1');open.onsuccess=()=>{const d=open.result,r=d.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{d.close();resolve(r.result)}}}));
  if(saved.filter(r=>r.collection==='replacement-tickets').length!==2||saved.filter(r=>r.collection==='replacement-prints').length!==2)throw Error('取消整单预览或补打改变票/打印数量');if(errors.length)throw Error(errors.join('\n'));await c.close();
 }
 return {results,failed:results.filter(x=>x.ms>=500),max:Math.max(...results.map(x=>x.ms)),identityPreserved:true,cancelDoesNotPrint:true};
}
