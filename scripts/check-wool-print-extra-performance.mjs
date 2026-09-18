import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {chromium} from 'playwright'
const base=process.env.WOOL_BASE_URL||'http://127.0.0.1:4198'
const output=process.env.WOOL_PERF_OUTPUT||'docs/product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/print-extra-performance.json'
const outDir=path.dirname(output);fs.mkdirSync(outDir,{recursive:true})
const report={base,at:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),cwd:process.cwd(),buildSha256:createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),viewport:{width:1366,height:768},thresholdMs:500,conditions:'Five independent contexts. Four final handovers created through visible UI, full normal prototype data. Image request abort only in the explicitly failing scenario; successful recovery removes it. PDF timing begins at actual print-button click, uses Chromium Page.printToPDF instead of native OS print dialog, ends once the complete PDF buffer is available; OS printer queue is outside prototype scope.',samples:[],errors:[]}
const browser=await chromium.launch({headless:true});report.browser=browser.version()
try{for(let iteration=1;iteration<=5;iteration++){
 const context=await browser.newContext({viewport:report.viewport});const page=await context.newPage();page.setDefaultTimeout(10000)
 const result={iteration};try{
  await page.goto(base+'/fcs/craft/wool/linking-orders')
  for(let batch=1;batch<=4;batch++){
   await page.locator('[data-wool-work-orders-action="open-handover"][data-wool-order-id="WOOL-STAGE-004:LINKING"]').click()
   await page.locator('[data-wool-dialog-field="qty"]').fill('5')
   await page.locator('[data-wool-dialog-field="factRemark"]').fill(`批次${batch}：`+'需核对本批颜色尺码和数量。'.repeat(20))
   await page.locator('[data-wool-work-orders-action="save-handover"]').click();await page.locator('[data-wool-business-dialog]').waitFor({state:'detached'})
  }
  await page.goto(base+'/fcs/craft/wool/linking-orders/WOOL-STAGE-004%3ALINKING/handover-print')
  await page.waitForFunction(()=>{const b=document.querySelector('[data-wool-print-button]');return b&&!b.disabled})
  const imageUrl=await page.locator('[data-wool-print-style-image]').first().getAttribute('src')
  const matcher=url=>url.href===new URL(imageUrl,base).href
  await page.route(matcher,r=>r.abort('failed'))
  await page.reload({waitUntil:'domcontentloaded'})
  result.imageFailure=await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const start=performance.now();function check(){const b=document.querySelector('[data-wool-print-button]'),m=document.querySelector('[data-wool-print-readiness-message]'),imgs=[...document.querySelectorAll('[data-wool-print-style-image]')];if(b?.disabled&&m?.textContent.includes('款式图不完整')&&imgs.length===4&&imgs.every(i=>i.complete&&i.naturalWidth===0)){requestAnimationFrame(()=>requestAnimationFrame(resolve));return}if(performance.now()-start>8000){reject(Error('图片失败态未就绪'));return}requestAnimationFrame(check)}check()});const ms=performance.now();return{ms,pass:ms<500,images:4,printBlocked:true}})
  await page.unroute(matcher)
  await page.reload({waitUntil:'domcontentloaded'})
  result.imageRecovery=await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const start=performance.now();function check(){const b=document.querySelector('[data-wool-print-button]'),imgs=[...document.querySelectorAll('[data-wool-print-style-image]')],qrs=document.querySelectorAll('[data-real-qr] svg');if(b&&!b.disabled&&imgs.length===4&&imgs.every(i=>i.complete&&i.naturalWidth>0)&&qrs.length===4){Promise.all(imgs.map(i=>i.decode())).then(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return}if(performance.now()-start>8000){reject(Error('图片恢复及QR未就绪'));return}requestAnimationFrame(check)}check()});const ms=performance.now();return{ms,pass:ms<500,images:4,qrs:4,printEnabled:true}})
  await page.evaluate(()=>{window.print=()=>{window.__printRequested=true};document.addEventListener('click',event=>{if(event.target.closest('[data-wool-print-button]'))window.__printStart=performance.now()},{capture:true,once:true})})
  await page.locator('[data-wool-print-button]').click();if(!await page.evaluate(()=>window.__printRequested))throw Error('真实打印按钮未触发')
  const pdf=await page.pdf({path:path.join(outDir,`print-four-batch-${iteration}.pdf`),format:'A4',preferCSSPageSize:true,printBackground:true})
  const ms=await page.evaluate(()=>performance.now()-window.__printStart),pages=(pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length
  result.pdf={ms,pass:ms<500&&pages===4,pages,bytes:pdf.length}
 }catch(error){result.error=String(error);report.errors.push({iteration,error:String(error)})}finally{report.samples.push(result);await context.close();fs.writeFileSync(output,JSON.stringify(report,null,2))}
}}finally{await browser.close()}
report.pass=report.errors.length===0&&report.samples.length===5&&report.samples.every(s=>s.imageFailure?.pass&&s.imageRecovery?.pass&&s.pdf?.pass)
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,samples:report.samples},null,2));if(!report.pass)process.exitCode=1
