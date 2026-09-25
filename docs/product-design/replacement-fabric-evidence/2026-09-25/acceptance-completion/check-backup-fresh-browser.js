async page => {
 const browser=page.context().browser(),source=await browser.newContext(),p=await source.newPage();
 const url='http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets';
 await p.goto(url);await p.locator('[data-hpb-page]').waitFor();await p.locator('[data-hpb-action="detail"]').first().click();await p.locator('[data-hpb-action="add"]').click();await p.waitForFunction(()=>document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('已新增'));
 await p.locator('[data-hpb-action="close"]').click();await p.locator('[data-hpb-action="data-tools"]').click();
 const download=p.waitForEvent('download');await p.locator('[data-hpb-data-action="export"]').click();await (await download).saveAs('output/playwright/hpb/fresh-restore.higcut');await source.close();
 const results=[];
 for(let sample=1;sample<=5;sample++){
  const target=await browser.newContext(),t=await target.newPage();await t.goto(url);await t.locator('[data-hpb-page]').waitFor();
  await t.locator('[data-hpb-action="data-tools"]').click();
  await t.evaluate(()=>document.addEventListener('change',()=>window.__start=performance.now(),true));
  await t.locator('[data-hpb-restore-file]').setInputFiles('output/playwright/hpb/fresh-restore.higcut');await t.waitForFunction(()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('已恢复并读回确认'));
  const ms=await t.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))));
  await t.locator('[data-hpb-action="close"]').click();await t.reload();await t.locator('[data-hpb-action="detail"]').first().click();await t.locator('[data-hpb-ticket]').first().waitFor();const count=await t.locator('[data-hpb-ticket]').count();if(count!==2)throw Error('新浏览器恢复后票数错误 '+count);
  await t.locator('[data-hpb-action="close"]').click();await t.locator('[data-hpb-action="data-tools"]').click();
  await t.locator('[data-hpb-restore-file]').setInputFiles('output/playwright/hpb/invalid.higcut');await t.waitForFunction(()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('未保存'));
  await t.locator('[data-hpb-action="close"]').click();await t.reload();await t.locator('[data-hpb-action="detail"]').first().click();await t.locator('[data-hpb-ticket]').first().waitFor();const after=await t.locator('[data-hpb-ticket]').count();if(after!==count)throw Error('错误备份改变原记录');
  results.push({sample,ms,count,invalidPreserved:true});await target.close();
 }
 return {results,failed:results.filter(r=>r.ms>=500)};
}
