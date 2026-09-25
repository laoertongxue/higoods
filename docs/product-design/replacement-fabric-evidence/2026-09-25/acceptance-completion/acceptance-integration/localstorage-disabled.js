async page => {
 const context=await page.context().browser().newContext(),p=await context.newPage();const errors=[];
 p.on('pageerror',e=>errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.goto('http://127.0.0.1:43235/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
 await p.locator('[data-hpb-action=detail]').first().click();await p.locator('[data-hpb-action=add]').first().click();await p.waitForFunction(()=>document.querySelector('[role=dialog]')?.textContent.includes('已新增 1 张'));
 const before=await p.evaluate(async()=>{const db=await import('/src/data/fcs/cutting/cutting-record-repository.ts');return await db.readCuttingRecords()});
 await p.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('read blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('write blocked','SecurityError')}});
 await p.reload();await p.locator('[data-hpb-page], [role=alert]').first().waitFor();
 const result={beforeCount:before.records.length,opened:await p.locator('[data-hpb-page]').count(),body:(await p.locator('body').innerText()).slice(-900),errors};
 await context.close();return result;
}
