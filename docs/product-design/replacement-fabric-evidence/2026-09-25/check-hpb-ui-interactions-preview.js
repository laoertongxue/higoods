async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await context.newPage(),results=[];
 await p.goto('http://127.0.0.1:43226/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.locator('[data-hpb-page]').waitFor();
 await p.locator('[data-hpb-action="detail"]').first().click();
 for(let i=0;i<11;i++){await p.locator('[data-hpb-action="add"]').first().click();await p.waitForFunction(()=>document.querySelectorAll('[data-hpb-ticket]').length===Math.min(10, Number(document.querySelector('[data-hpb-action="print-all"]').textContent.match(/\d+/)[0])));await p.waitForFunction(()=>document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('已新增'));}
 await p.locator('[data-hpb-action="close"]').click();
 await p.reload();await p.locator('[data-hpb-page]').waitFor();
 await p.evaluate(()=>{document.addEventListener('click',()=>{window.__start=performance.now()},true);document.addEventListener('input',()=>{window.__start=performance.now()},true);document.addEventListener('change',()=>{window.__start=performance.now()},true)});
 const act=async(name,run,check)=>{await p.evaluate(()=>{window.__start=0});await run();if(check)await p.waitForFunction(check,{},{timeout:5000});const ms=await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__start)))));results.push({name,ms});};
 const click=(key)=>()=>p.locator('[data-hpb-action="'+key+'"]').first().click();
 for(let sample=1;sample<=5;sample++){
  await act('输入生产单',()=>p.locator('[data-hpb-filter="order"]').fill('NO-MATCH-'+sample),()=>document.querySelector('[data-hpb-filter="order"]').value.startsWith('NO-MATCH'));
  await act('查询无结果',click('query'),()=>document.querySelector('[data-hpb-page]').textContent.includes('当前没有分配'));
  await act('空结果导出提示',click('export'),()=>document.querySelector('[role="status"]')?.textContent.includes('无可导出'));
  await act('重置',click('reset'),()=>document.querySelector('[data-hpb-action="detail"]'));
  const download=p.waitForEvent('download');await act('导出全部匹配',click('export'));const file=await download;await file.saveAs('output/playwright/hpb/hpb-export-'+sample+'.csv');
  await act('排序',()=>p.locator('[data-hpb-action="sort-column"]').first().click());
  await act('列设置打开',click('column-settings'),()=>document.querySelector('[data-hpb-action="close-column-settings"]'));
  await act('列可见性',()=>p.locator('[data-hpb-action="toggle-column-visibility"]').filter({hasNot:p.locator('[disabled]')}).last().click());
  await act('恢复列设置',click('restore-column-settings'));
  await act('列设置关闭',click('close-column-settings'),()=>!document.querySelector('[data-hpb-action="close-column-settings"]'));
  await act('详情',click('detail'),()=>document.querySelector('[data-hpb-ticket]'));
  await act('勾选单票',()=>p.locator('[data-hpb-ticket]').first().check(),()=>document.querySelector('[data-hpb-action="print-selected"]').textContent.includes('1 张'));
  await act('票分页下一页',click('ticket-next'),()=>document.querySelectorAll('[data-hpb-ticket]').length===2);
  await act('跨页勾选',()=>p.locator('[data-hpb-ticket]').last().check(),()=>document.querySelector('[data-hpb-action="print-selected"]').textContent.includes('2 张'));
  await act('清空选择',click('clear-selection'),()=>document.querySelector('[data-hpb-action="print-selected"]').textContent.includes('0 张'));
  await act('全选',click('select-all'),()=>document.querySelector('[data-hpb-action="print-selected"]').textContent.includes('12 张'));
  await act('票分页上一页',click('ticket-prev'),()=>document.querySelectorAll('[data-hpb-ticket]').length===10);
  await act('关闭详情',click('close'),()=>!document.querySelector('[data-hpb-ticket]'));
  await act('历史打开',click('history'),()=>document.querySelector('[data-hpb-history-query]'));
  await act('历史查询',click('history-query'));
  await act('历史关闭',click('close'),()=>!document.querySelector('[data-hpb-history-query]'));
  await act('刷新状态',click('reload'),()=>document.querySelector('[role="status"]')?.textContent.includes('已读取'));
  await act('本机数据',click('data-tools'),()=>document.querySelector('[data-hpb-data-action="export"]'));
  await act('迁移未确认阻断',()=>p.locator('[data-hpb-data-action="migrate"]').click(),()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('未保存'));
  const backup=p.waitForEvent('download');await act('导出备份',()=>p.locator('[data-hpb-data-action="export"]').click(),()=>document.querySelector('[data-hpb-data-message]')?.textContent.includes('已生成'));await (await backup).saveAs('output/playwright/hpb/ui-backup.higcut');
  await act('关闭本机数据',click('close'),()=>!document.querySelector('[data-hpb-data-action="export"]'));
 }
 const sizes=[];for(const [width,height] of [[1366,768],[1280,720],[1024,768]]){await p.setViewportSize({width,height});await p.screenshot({path:'output/playwright/hpb/list-'+width+'.png',fullPage:true});sizes.push({width,height,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)})}
 await context.close();return{results,sizes,failed:results.filter(r=>r.ms>=500),max:Math.max(...results.map(r=>r.ms))};
}
