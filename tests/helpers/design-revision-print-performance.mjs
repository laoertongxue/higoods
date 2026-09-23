const evidenceOrigin=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4732';
import {chromium,expect} from '@playwright/test';import fs from 'node:fs';import crypto from 'node:crypto';
const runId=new Date().toISOString().replaceAll(':','-'),dir='output/playwright/design-revision-gap/';const result={runId,distSha:crypto.createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),cases:[]};const b=await chromium.launch();result.browser=b.version();
for(const type of ['dyeing','printing']){
 const row={type,samples:[],errors:[]};result.cases.push(row);
 for(let n=0;n<5;n++){
 const context=await b.newContext({storageState:{cookies:[],origins:[{origin:evidenceOrigin,localStorage:Object.entries(JSON.parse(fs.readFileSync(dir+'fixtures/completed.json'))).map(([name,value])=>({name,value}))}]},viewport:{width:1366,height:768}});await context.addInitScript(()=>{
 if(window===window.top)return;
 const probe=async()=>{
  const frame=window.frameElement;
  if(!frame?.matches('[data-dye-output-print],[data-dispatch-print-frame]')||!document.querySelector('h1')){requestAnimationFrame(probe);return}
  try{await Promise.all([...document.images].map(i=>i.decode()))}catch{return}
  if(frame.matches('[data-dispatch-print-frame]')&&frame.closest('[data-dispatch-print-preview]')?.getAttribute('data-print-ready')!=='true'){requestAnimationFrame(probe);return}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  window.parent.__printEnd=window.parent.performance.now();
 };requestAnimationFrame(probe);
 });const p=await context.newPage();p.on('pageerror',e=>row.errors.push(e.message));
 try{
 await p.goto(evidenceOrigin+'/fcs/craft/'+type+'/handover-documents');await p.locator('main table tbody tr').first().waitFor();
 const orderNo=type==='dyeing'?'DY-20260923-000001':'PH-20260923-000001';let tr=p.locator('main table tbody tr').filter({hasText:orderNo}).first();
 if(!await tr.count()){row.errors.push('目标设计改款加工单未出现在交出单列表');continue}
 const button=tr.locator(type==='dyeing'?'[data-dye-output-action="print-doc"]':'[data-printing-dispatch="print"]');
 await p.evaluate(()=>document.addEventListener('click',e=>window.__printStart=e.timeStamp,{once:true,capture:true}));await button.click();
 const frameEl=p.locator(type==='dyeing'?'[data-dye-output-print]':'[data-dispatch-print-frame]');await frameEl.waitFor();const frame=await (await frameEl.elementHandle()).contentFrame();await frame.locator('h1').waitFor();
 await frame.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 await p.waitForFunction(()=>window.__printEnd);row.samples.push(await p.evaluate(()=>window.__printEnd-window.__printStart));(row.automationElapsedSamples??=[]).push(await p.evaluate(()=>performance.now()-window.__printStart));const text=await frame.locator('body').innerText();if(!text.includes('设计改款任务')||!text.includes('ES-DR-025'))throw Error('打印缺少需求来源或设计改款任务号');if(!text.includes('20'))throw Error('缺少本次数量');
 if(n===0){row.text=text;const pdfPage=await context.newPage();await pdfPage.goto(evidenceOrigin);await pdfPage.setContent(await frame.content());await pdfPage.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));await pdfPage.pdf({path:dir+type+'-handover-'+runId+'.pdf',preferCSSPageSize:true,printBackground:true});await pdfPage.screenshot({path:dir+type+'-handover-'+runId+'.png',fullPage:true});await pdfPage.close();}
 await p.bringToFront();await p.evaluate(()=>document.addEventListener('click',e=>window.__closeStart=e.timeStamp,{once:true,capture:true}));await p.locator(type==='dyeing'?'[data-dye-output-action="close-overlay"]':'[data-printing-dispatch="close-print"]').first().click();await expect(frameEl).toHaveCount(0);(row.closeSamples??=[]).push(await p.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-window.__closeStart}));
 }catch(e){row.errors.push(e.message)}finally{await context.close();fs.writeFileSync(dir+'print-performance-'+runId+'.json',JSON.stringify(result,null,2))}
 }
 console.log(type,row.samples,row.errors);
}await b.close();

// Preserve all raw samples and fail the command when any measured gate fails.
if (result.cases.some(r => r.errors.length || r.samples.length!==5 || r.samples.some(ms=>ms>=500)||r.closeSamples?.length!==5||r.closeSamples.some(ms=>ms>=500))) process.exitCode = 1;
