async(page)=>{
 const results=[],layouts=[];const url='http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets';
 for(let sample=1;sample<=5;sample++){
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage();await p.addInitScript(()=>document.addEventListener('click',()=>window.__stamp=performance.now(),true));
 const ready=async(q=p)=>{await q.waitForFunction(()=>[...document.querySelectorAll('[data-real-qr]')].every(n=>n.querySelector('svg')));await q.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-hpb-page] img,.hpb-print-root img')].map(n=>n.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});};
 const act=async(name,fn)=>{const targetReadyMs=await fn();await ready();results.push({sample,name,ms:typeof targetReadyMs === 'number' ? targetReadyMs : await p.evaluate(()=>performance.now()-window.__stamp)});};
 for(const mode of ['cold','refresh']){if(mode==='cold')await p.goto(url);else await p.reload();await p.waitForSelector('[data-hpb-action=detail]');await ready();results.push({sample,name:mode,ms:await p.evaluate(()=>performance.now())});}
 if(await p.locator('tbody tr').count()!==5)throw Error('Expected 5 rows');
 const expected=[['PO-202603-0002',3,0,'待打印'],['PO-202610-9001',4,2,'部分已打印'],['PO-202610-9002',1,1,'全部已打印'],['PO-202610-9003',4,4,'全部已打印'],['PO-202610-9004',2,0,'待打印']];
 if(sample===1)for(const [width,height]of [[1366,768],[1280,720],[1024,768]]){await p.setViewportSize({width,height});await p.screenshot({path:'output/playwright/hpb-five/list-'+width+'.png',fullPage:true});layouts.push({width,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 for(const [id,count,printed,status]of expected){
 const row=p.locator('tbody tr').filter({hasText:id});const text=await row.innerText();if(!text.includes(count+' 张 / '+printed+' 张')||!text.includes(status))throw Error('Wrong row '+id+text);
 await act(id+'详情',()=>row.locator('[data-hpb-action=detail]').click());
 const labels=p.locator('[data-hpb-detail-ticket]');if(await labels.count()!==count+(id.endsWith('9004')?1:0))throw Error('Detail count');
 const detail=await p.getByRole('dialog',{name:'换片布菲票详情',exact:true}).innerText();if(id.endsWith('9002')&&!detail.includes('补打'))throw Error('Missing reprint');if(id.endsWith('9003')&&(!detail.includes('ID-F003')||!detail.includes('2026-09-29 14:00:00')))throw Error('Missing handover');if(id.endsWith('9004')&&!detail.includes('已失效'))throw Error('Missing invalid');
 const identities=await p.locator('[data-hpb-label]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.hpbLabel,n.querySelector('[data-real-qr]').getAttribute('data-qr-value')]));if(identities.some(([id,qr])=>qr!=='HIG:HPB:1:'+encodeURIComponent(id)))throw Error('QR mismatch');
 await act(id+'放大',()=>labels.first().locator('[data-hpb-action=preview-ticket]').click());await act(id+'关闭放大',()=>p.getByRole('button',{name:'关闭预览',exact:true}).click());
 if(sample===1)await p.screenshot({path:'output/playwright/hpb-five/detail-'+id+'.png'});
 await act(id+'关闭详情',()=>p.getByRole('button',{name:'关闭',exact:true}).click());
 await act(id+'打印选票',()=>row.locator('[data-hpb-action=print]').click());if(await p.locator('[data-hpb-ticket]').count()!==count)throw Error('Invalid in printable choices');
 await act(id+'单选',()=>p.locator('[data-hpb-ticket]').first().check());
 for(const [action,n]of [['print-selected',1],['print-all',count]])await act(id+action,async()=>{const popup=c.waitForEvent('page');await p.locator('[data-hpb-action='+action+']').click();const q=await popup;await q.waitForSelector('[data-hpb-label]');await ready(q);if(await q.locator('[data-hpb-label]').count()!==n)throw Error('Print label count');const targetReadyMs=await p.evaluate(()=>performance.now()-window.__stamp);await q.close();return targetReadyMs;});
 await act(id+'关闭打印',()=>p.getByRole('button',{name:'关闭',exact:true}).click());
 }
 for(const [status,n]of [['待打印',2],['部分已打印',1],['全部已打印',2]]){await p.locator('[data-hpb-filter=status]').selectOption(status);await act('筛选'+status,()=>p.locator('[data-hpb-action=query]').click());if(await p.locator('tbody tr').count()!==n)throw Error('Filter mismatch');await act('重置'+status,()=>p.locator('[data-hpb-action=reset]').click());}
 const records=await p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('higood-cutting-records-v1');r.onsuccess=()=>{const db=r.result,t=db.transaction('records','readonly'),q=t.objectStore('records').count();q.onsuccess=()=>resolve(q.result);t.oncomplete=()=>db.close();}}));if(records!==0)throw Error('Preview seeded persistent data');
 await c.close();
 }
 return {results,layouts,max:Math.max(...results.map(r=>r.ms)),failed:results.filter(r=>r.ms>=500),readOnly:true};
}
