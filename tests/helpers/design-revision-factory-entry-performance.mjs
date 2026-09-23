const evidenceOrigin=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4732';
import {chromium,expect} from '@playwright/test';import fs from 'node:fs';import crypto from 'node:crypto';
const dir='output/playwright/design-revision-gap/',runId=new Date().toISOString().replaceAll(':','-');const receipt={runId,distSha:crypto.createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),viewport:{width:1366,height:768},routes:[]};const b=await chromium.launch();receipt.browser=b.version();
for(const path of ["/fcs/craft/dyeing/work-orders", "/fcs/craft/dyeing/pending-receipts", "/fcs/craft/dyeing/pending-handover", "/fcs/craft/dyeing/handover-documents", "/fcs/craft/dyeing/wait-process-warehouse", "/fcs/craft/dyeing/wait-handover-warehouse", "/fcs/craft/printing/work-orders", "/fcs/craft/printing/pending-receipts", "/fcs/craft/printing/pending-handover", "/fcs/craft/printing/handover-documents", "/fcs/craft/printing/wait-process-warehouse", "/fcs/craft/printing/wait-handover-warehouse"]){if(process.argv[2]&&!process.argv[2].split(',').some(part=>path.includes(part)))continue;const r={path,samples:{},errors:[],notApplicable:[]};receipt.routes.push(r);
for(let n=0;n<5;n++){const c=await b.newContext({viewport:receipt.viewport,storageState:{cookies:[],origins:[{origin:evidenceOrigin,localStorage:Object.entries(JSON.parse(fs.readFileSync(dir+'fixtures/completed.json'))).filter(([key])=>key!=='fcs_pda_session').map(([name,value])=>({name,value}))}]}});const p=await c.newPage();p.setDefaultTimeout(3000);p.on('pageerror',e=>r.errors.push(e.message));
const measure=async(key,fn,ev='click')=>{await p.evaluate(ev=>{window.__actionStart=null;window.__dropStart=null;if(ev==='dragstart')document.addEventListener('drop',e=>window.__dropStart=e.timeStamp,{capture:true,once:true});document.addEventListener(ev,e=>window.__actionStart=e.timeStamp,{capture:true,once:true})},ev);await fn();const t=await p.evaluate(async()=>{if(window.__actionStart===null)throw Error('未捕获事件');await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-(window.__dropStart??window.__actionStart)});(r.samples[key]??=[]).push(t);if(ev==='dragstart')(r.gestureDuration??=[]).push(await p.evaluate(()=>performance.now()-window.__actionStart))};
try{
 await p.goto(evidenceOrigin+path,{waitUntil:'domcontentloaded'});const main=p.locator('main').last();await main.locator('table').first().waitFor();const table=main.locator('table').first();const query=main.getByRole('button',{name:'查询',exact:true}).first(),reset=main.getByRole('button',{name:'重置',exact:true}).first();
 const factoryTabs=main.locator('[data-dye-work-orders-action="factory-tab"], [data-printing-work-orders-action="factory-tab"], [data-dye-output-action="factory"], [data-printing-dispatch="factory"], [data-factory-receiving-action="factory"]').filter({visible:true});
 const tabCount=await factoryTabs.count();
 for(let ti=1;ti<tabCount;ti++)await measure('factoryTab:'+ti,async()=>{await factoryTabs.nth(ti).click();await expect(table).toBeVisible()});
 if(tabCount>1)await measure('factoryTab:all',async()=>{await factoryTabs.first().click();await expect(table).toBeVisible()});
 const overflow=main.locator('details[aria-label="更多加工厂"]');
 if(await overflow.count()){
  const ids=await overflow.locator('[data-factory]').evaluateAll(ns=>ns.map(e=>e.getAttribute('data-factory')));
  for(const id of ids){
   await measure('moreFactories:'+id,async()=>{await overflow.locator('summary').click();await expect(overflow).toHaveAttribute('open','')});
   await measure('overflowFactory:'+id,async()=>{await overflow.locator(`[data-factory="${id}"]`).click();await expect(table).toBeVisible()});
  }
  await measure('overflowFactory:restoreAll',async()=>{await factoryTabs.first().click();await expect(table).toBeVisible()});
 }
 const more=main.getByRole('button',{name:'更多筛选',exact:true});if(await more.count())await measure('expandFilters',()=>more.click());
 const filters=await main.locator('select:visible').evaluateAll(ns=>ns.filter(e=>!e.outerHTML.includes('page-size')&&!e.outerHTML.includes('pageSize')&&!e.outerHTML.includes('identity')&&!e.outerHTML.includes('selection-scope')).map(e=>{const a=[...e.attributes].find(a=>a.name.startsWith('data-')&&['field','filter','rfield'].some(x=>a.name.includes(x)));return a?{selector:`[${a.name}="${a.value}"]`,key:a.value,values:[...e.options].map(o=>o.value)}:null}).filter(Boolean));
 for(const f of filters){const v=f.values.find(v=>v);if(!v)continue;const input=main.locator(f.selector).first();if(!await input.isVisible()){const more=main.getByRole('button',{name:'更多筛选',exact:true});if(await more.count())await more.click()}
 await measure('filter:'+f.key,async()=>{await input.selectOption(v);await expect(input).toHaveValue(v)},'change');
 if(await query.count())await measure('query:'+f.key,async()=>{await query.click();await expect(input).toHaveValue(v);await expect(table).toBeVisible()});
 await measure('reset:'+f.key,async()=>{await reset.click();await expect(table).toBeVisible()});
 }
 const textFilters=await main.locator('input:visible').evaluateAll(ns=>ns.filter(e=>['text','search','date'].includes(e.type)).map(e=>{const a=[...e.attributes].find(a=>a.name.startsWith('data-')&&['field','filter','rfield'].some(x=>a.name.includes(x)));return a?{selector:`[${a.name}="${a.value}"]`,key:a.value,type:e.type}:null}).filter(Boolean));
 for(const f of textFilters){const input=main.locator(f.selector).first();if(!await input.isVisible()){const more=main.getByRole('button',{name:'更多筛选',exact:true});if(await more.count())await more.click()}
 const value=f.type==='date'?'2026-09-23':'NO-MATCH-DESIGN-REVISION-VERIFY';
 await measure('input:'+f.key,async()=>{await input.fill(value);await expect(input).toHaveValue(value)},'input');
 await measure('queryInput:'+f.key,async()=>{await query.click();await expect(input).toHaveValue(value);await expect(table).toBeVisible();if(f.type!=='date')await expect(table.locator('tbody')).toContainText(/暂无|没有|无符合|无匹配/)});
 await measure('resetInput:'+f.key,async()=>{await reset.click();await expect(input).toHaveValue('');await expect(table).toBeVisible()});
 }
 const pageSizes=main.locator('select').filter({visible:true});
 for(let si=0;si<await pageSizes.count();si++){
 const control=pageSizes.nth(si),html=await control.evaluate(e=>e.outerHTML);if(!/page-size|pageSize/.test(html))continue;
 const original=await control.inputValue(),values=await control.locator('option').evaluateAll(ns=>ns.map(e=>e.value));const value=values.find(v=>v!==original);if(!value)continue;
 await measure('pageSize',async()=>{await control.selectOption(value);await expect(control).toHaveValue(value);await expect(table).toBeVisible()},'change');
 await measure('restorePageSize',async()=>{await control.selectOption(original);await expect(control).toHaveValue(original)},'change');
 }
 const exports=main.getByRole('button',{name:'导出',exact:true});if(await exports.count())await measure('export',async()=>{const download=p.waitForEvent('download');await exports.first().click();const file=await download;if(!await file.path())throw Error('导出文件未生成')});
 const cols=main.getByRole('button',{name:'列设置',exact:true}).first();if(await cols.count()){
 await measure('openColumns',async()=>{await cols.click();await expect(main.locator('[data-standard-list-column-key]').first()).toBeVisible()});
 const rows=main.locator('[data-standard-list-column-key]');const drags=rows.locator('[draggable="true"]');
 // Common list columns put drag metadata on the row itself.
 const draggable=main.locator('[draggable="true"][data-standard-list-column-key], [draggable="true"][data-dye-output-column-key], [draggable="true"][data-drag-source], [draggable="true"][data-factory-receiving-column-key]');
 if(await draggable.count()>1){const before=await table.locator('thead').innerText();await measure('dragColumn',async()=>{await draggable.nth((await draggable.count())-1).dragTo(draggable.nth((await draggable.count())-2));await expect(table.locator('thead')).not.toHaveText(before)},'dragstart')}else if(n===0)r.notApplicable.push('未发现适用的可拖动列入口');
 const visibility=main.locator('[data-standard-list-column-key] label').filter({hasText:'显示'}).locator('input:not(:disabled)').first();
 if(await visibility.count()){const before=await table.locator('thead').innerText();await measure('toggleColumnVisibility',async()=>{await visibility.click();await expect(table.locator('thead')).not.toHaveText(before)})}
 const freeze=main.locator('[data-standard-list-column-key] label').filter({hasText:'冻结'}).locator('input:not(:disabled)').first();
 if(await freeze.count()){const before=await freeze.isChecked();await measure('toggleColumnFreeze',async()=>{await freeze.click();await expect(freeze).toBeChecked({checked:!before})})}
 const restore=main.getByRole('button',{name:/恢复默认/}).first();if(await restore.count())await measure('restoreColumns',()=>restore.click());
 const close=main.getByRole('button',{name:'关闭',exact:true}).last();await measure('closeColumns',async()=>{await close.click();await expect(rows).toHaveCount(0)});
 }
 const sort=table.locator('thead button').first();if(await sort.count())await measure('sortColumn',()=>sort.click());
 const next=main.getByRole('button',{name:'下一页',exact:true}).first();if(await next.count()&&await next.isEnabled()){const before=await table.locator('tbody').innerText();await measure('nextPage',async()=>{await next.click();await expect(table.locator('tbody')).not.toHaveText(before)});const prev=main.getByRole('button',{name:'上一页',exact:true}).first();await measure('previousPage',()=>prev.click())}else if(n===0)r.notApplicable.push('当前完整数据只有一页，无可用下一页');
}catch(e){r.errors.push(`round ${n+1}: ${e.message}`)}finally{await c.close();fs.writeFileSync(dir+'list-entry-performance-'+runId+'.json',JSON.stringify(receipt,null,2))}}
console.log(path,JSON.stringify(Object.fromEntries(Object.entries(r.samples).map(([k,v])=>[k,Math.max(...v)]))),r.errors.map(e=>e.slice(0,100)))}await b.close();

// Preserve all raw samples and fail the command when any measured gate fails.
if (receipt.routes.some(r => r.errors.length || Object.values(r.samples).some(v=>v.length!==5||v.some(ms=>ms>=500)))) process.exitCode = 1;
