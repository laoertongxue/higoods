async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1366,height:768}}),p=await c.newPage(),results=[];
 await p.addInitScript(()=>['click','input','change','keydown'].forEach(t=>document.addEventListener(t,()=>window.__stamp=performance.now(),true)));await p.goto('http://127.0.0.1:43236/fcs/craft/cutting/replacement-fabric-fei-tickets');await p.waitForSelector('[data-hpb-action=detail]');
 const click=a=>()=>p.locator('[data-hpb-action="'+a+'"]').first().click();const act=async(name,fn)=>{await fn();await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-hpb-page] img')].map(n=>n.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});results.push({name,ms:await p.evaluate(()=>performance.now()-window.__stamp)})};
 for(let i=0;i<5;i++){
 for(const [n,a]of [['刷新','reload'],['历史','history'],['历史查询','history-query'],['关闭历史','close'],['本机数据','data-tools'],['关闭数据','close'],['导出','export'],['排序','sort-column'],['列设置','column-settings'],['关闭列设置','close-column-settings']])await act(n,click(a));
 await act('查询输入',()=>p.locator('[data-hpb-filter=order]').fill('9003'));await act('查询',click('query'));if(await p.locator('tbody tr').count()!==1)throw Error('Search');await act('重置',click('reset'));
 for(const image of ['主面料 Grey','黑色拼接面料 Black','白色府绸袋布 White']){await act('大图'+image,()=>p.getByRole('button',{name:image,exact:true}).first().click());await p.waitForFunction(()=>document.querySelector('[data-pda-image-preview-root] img')?.complete);await act('关闭大图',()=>p.locator('[data-pda-image-preview-close]').nth(1).click());}
 }
 await c.close();return {results,max:Math.max(...results.map(x=>x.ms)),failed:results.filter(x=>x.ms>=500)};
}
