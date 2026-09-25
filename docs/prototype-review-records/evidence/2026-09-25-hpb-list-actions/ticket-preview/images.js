async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),results=[];
 await p.addInitScript(()=>{['click','keydown'].forEach(t=>document.addEventListener(t,()=>window.__stamp=performance.now(),true))});
 await p.goto('http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.waitForSelector('[data-hpb-action=detail]');
 const act=async(name,run,check)=>{await run();await check();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));results.push({name,ms:await p.evaluate(()=>performance.now()-window.__stamp)})};
 for(let i=0;i<5;i++){
  await p.locator('[data-hpb-action=detail]').first().click();
  for(const close of ['button','backdrop','escape']){
   await act('详情大图打开-'+close,()=>p.locator('[role=dialog] [data-pda-image-preview-url]').first().click(),()=>p.waitForFunction(()=>document.querySelector('[data-pda-image-preview-root] img')?.complete));
   await act('详情大图关闭-'+close,()=>close==='escape'?p.keyboard.press('Escape'):p.locator('[data-pda-image-preview-close]').nth(close==='button'?1:0).click({position:{x:5,y:5}}),()=>p.waitForFunction(()=>!document.querySelector('[data-pda-image-preview-root] img')));
   if(!await p.getByRole('dialog',{name:'换片布菲票详情',exact:true}).count())throw Error('Image close also closed details');
  }
  await act('详情Esc关闭',()=>p.keyboard.press('Escape'),()=>p.waitForFunction(()=>!document.querySelector('[data-hpb-detail-ticket]')));
  await p.locator('[data-hpb-action=detail]').first().click();await act('详情遮罩关闭',()=>p.locator('[data-hpb-backdrop]').click({position:{x:3,y:3}}),()=>p.waitForFunction(()=>!document.querySelector('[data-hpb-detail-ticket]')));
 }
 await p.locator('[data-hpb-action=detail]').first().click();await p.locator('[role=dialog] img').first().evaluate(img=>img.src='/missing-hpb-ui-material.png');await p.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] span')].some(n=>n.textContent==='面料图片加载失败'&&!n.hidden));
 const failedImageVisible=true;await c.close();return{results,max:Math.max(...results.map(r=>r.ms)),failed:results.filter(r=>r.ms>=500),failedImageVisible};
}
