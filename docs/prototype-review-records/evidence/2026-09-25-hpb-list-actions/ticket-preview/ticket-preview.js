async(page)=>{
 const results=[],layouts=[];
 for(let sample=1;sample<=5;sample++){
 const c=await page.context().browser().newContext({viewport:{width:1280,height:720}}),p=await c.newPage();
 await p.addInitScript(()=>{['click','keydown'].forEach(t=>document.addEventListener(t,()=>window.__stamp=performance.now(),true))});
 await p.goto('http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.waitForSelector('[data-hpb-action=detail]');
 const read=()=>p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('higood-cutting-records-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readonly'),q=tx.objectStore('records').getAll();q.onsuccess=()=>resolve(JSON.stringify(q.result));tx.oncomplete=()=>db.close()}}));
 const before=await read();
 const act=async(name,run,check)=>{await run();if(check)await check();await p.waitForFunction(()=>[...document.querySelectorAll('[data-hpb-label] [data-real-qr]')].every(n=>n.querySelector('svg')));await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-hpb-label] img')].map(n=>n.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});results.push({sample,name,ms:await p.evaluate(()=>performance.now()-window.__stamp)})};
 await act('首次详情含实际票面二维码',()=>p.locator('[data-hpb-action=detail]').first().click(),()=>p.locator('[data-hpb-label]').first().waitFor());
 const value=await p.locator('[data-hpb-label] [data-real-qr]').first().getAttribute('data-qr-value');const ticketId=await p.locator('[data-hpb-label]').first().getAttribute('data-hpb-label');if(value!=='HIG:HPB:1:'+encodeURIComponent(ticketId))throw Error('QR identity mismatch');
 const html=await p.locator('[data-hpb-label]').first().evaluate(n=>n.outerHTML);
 for(const close of ['button','escape','backdrop']){
 await p.evaluate(()=>{window.__detail=document.querySelector('[data-hpb-detail-ticket]');window.__scroll=document.querySelector('[data-hpb-detail-ticket]').parentElement.scrollTop});
 await act('放大票面-'+close,()=>p.locator('[data-hpb-action=preview-ticket]').first().click(),()=>p.getByRole('dialog',{name:'菲票放大预览',exact:true}).waitFor());
 if(await p.locator('[data-hpb-enlarged-host] [data-hpb-label]').evaluate(n=>n.outerHTML)!==html)throw Error('Enlarged label differs');
 if(sample===1&&close==='button')await p.screenshot({path:'output/playwright/hpb-ui-split/enlarged-ticket.png'});
 await act('关闭票面-'+close,()=>close==='escape'?p.keyboard.press('Escape'):close==='button'?p.getByRole('button',{name:'关闭预览',exact:true}).click():p.locator('[data-hpb-enlarged-host] > div').click({position:{x:2,y:2}}),()=>p.getByRole('dialog',{name:'菲票放大预览',exact:true}).waitFor({state:'detached'}));
 if(!await p.evaluate(()=>window.__detail===document.querySelector('[data-hpb-detail-ticket]')&&window.__scroll===document.querySelector('[data-hpb-detail-ticket]').parentElement.scrollTop))throw Error('Detail remounted/scroll changed');
 }
 if(before!==await read())throw Error('Preview changed persistent records');
 if(sample===1)for(const [width,height]of [[1366,768],[1280,720],[1024,768]]){await p.setViewportSize({width,height});await p.screenshot({path:'output/playwright/hpb-ui-split/ticket-detail-'+width+'.png'});layouts.push({width,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),labels:await p.locator('[data-hpb-label]').count()})}
 await c.close();
 }
 return {results,layouts,max:Math.max(...results.map(x=>x.ms)),failed:results.filter(x=>x.ms>=500),readOnly:true,qrIdentity:true,templateParity:true};
}
