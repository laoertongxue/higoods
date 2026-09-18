import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const base=process.env.WOOL_BASE_URL||'http://127.0.0.1:5186',out='docs/product-design/wool-two-stage-adjustment/evidence'
fs.mkdirSync(out,{recursive:true})
const result={at:new Date().toISOString(),base,cwd:process.cwd(),browser:'Chromium / Playwright',scope:'Functional screenshots only; performance is measured separately by check-wool-route-performance.mjs',routes:[],actions:[],checks:[],errors:[]}
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1366,height:768}}),p=await context.newPage()
p.setDefaultTimeout(15000)
p.on('pageerror',e=>result.errors.push(e.message))
async function settled(page){return page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}).map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()})}
async function action(name,fn,ready){console.log(`ACTION ${name}`);await p.evaluate(()=>{window.__woolEventStart=undefined;const record=()=>{window.__woolEventStart??=performance.now()};document.addEventListener('click',record,{once:true,capture:true});document.addEventListener('input',record,{once:true,capture:true})});await fn();if(ready)await ready();await settled(p);const ms=await p.evaluate(()=>performance.now()-window.__woolEventStart);result.actions.push({name,diagnosticDriverInclusiveMs:ms,pass:true})}
async function navigate(route,selector){console.log(`NAV ${route}`);await p.goto(base+route);await p.locator(selector).first().waitFor();await settled(p)}
try{
 await navigate('/fcs/craft/wool/knitting-orders','[data-wool-work-orders-root]')
 result.checks.push({name:'横机六状态与八列',pass:await p.locator('[data-wool-work-orders-action^="tab:"]').count()===6&&await p.locator('th').count()>=8})
 for(let n=0;n<5;n++){
  await action('横机查询',()=>p.locator('[data-wool-work-orders-action="query"]').click(),()=>p.locator('[data-wool-work-orders-total]').waitFor())
  await action('横机列设置打开',()=>p.locator('[data-wool-work-orders-action="open-column-settings"]').click(),()=>p.getByText('恢复默认',{exact:false}).first().waitFor())
  await action('横机列设置关闭',()=>p.locator('[data-wool-work-orders-action="close-column-settings"]').first().click(),()=>p.locator('[data-wool-work-orders-action="restore-column-settings"]').waitFor({state:'hidden'}))
 }
 await p.locator('[data-wool-work-orders-action="open-report"][data-wool-order-id="WOOL-STAGE-002:KNITTING"]').click()
 await p.locator('[data-wool-business-dialog]').waitFor()
 await p.locator('[data-wool-dialog-field="qty"]').fill('5')
 await action('横机填报保存及自动缝盘',()=>p.locator('[data-wool-work-orders-action="save-report"]').click(),()=>p.locator('[data-wool-business-dialog]').waitFor({state:'hidden'}))
 let facts=await p.evaluate(()=>JSON.parse(localStorage.getItem('higood-fcs-wool-stage-store-v3')))
 result.checks.push({name:'真实按钮无外加工四事实同步保存',pass:facts.processReports.some(r=>r.woolOrderId==='WOOL-STAGE-002:LINKING'&&r.reportedQty===5)&&facts.internalReceipts.some(r=>r.woolOrderId==='WOOL-STAGE-002:LINKING'&&r.qty===5)})
 await p.screenshot({path:path.join(out,'knitting-list.png')})
 await navigate('/fcs/craft/wool/pending-receipts?workOrderId=WOOL-STAGE-001%3AKNITTING','[data-wool-receiving-page]')
 await action('纱线接收弹窗',()=>p.getByRole('button',{name:'确认接收',exact:true}).first().click(),()=>p.locator('[data-wool-receiving-field="pcs"]').waitFor())
 await p.locator('[data-wool-receiving-field="pcs"]').fill('1');await p.locator('[data-wool-receiving-field="grossKg"]').fill('1.062');await p.locator('[data-wool-receiving-field="PAPER"]').fill('1')
 await p.getByRole('button',{name:'复核接收',exact:true}).click();await p.getByRole('button',{name:'确认保存',exact:true}).waitFor()
 await action('纱线实收保存',()=>p.getByRole('button',{name:'确认保存',exact:true}).click(),()=>p.locator('[data-wool-receiving-feedback]').filter({hasText:'已保存'}).waitFor())
 result.checks.push({name:'真实接收净重1kg',pass:(await p.locator('[data-wool-receiving-feedback]').innerText()).includes('1 kg')})
 await p.evaluate(async()=>{const m=await import('/src/data/fcs/store-domain-pda.ts');m.ensureFactoryPdaSeed('OWN_WOOL_FACTORY','周哥毛织厂');const u=m.listFactoryPdaUsers('OWN_WOOL_FACTORY').find(u=>u.status==='ACTIVE');m.setPdaSession(m.createPdaSessionFromUser(u))})
 await p.setViewportSize({width:360,height:800})
 await navigate('/fcs/pda/wool/pending-receipts?workOrderId=WOOL-STAGE-010%3ALINKING','[data-wool-receiving-page]')
 result.checks.push({name:'PDA独立外壳及无页面横溢',pass:await p.locator('[data-pda-standalone-root]').count()===1&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)})
 await p.getByRole('button',{name:'接收这批货',exact:true}).first().click();await p.locator('[data-wool-receiving-field="pieceQty"]').fill('5');await p.getByRole('button',{name:'复核接收',exact:true}).click()
 await action('PDA回货片实收保存',()=>p.getByRole('button',{name:'确认保存',exact:true}).click(),()=>p.locator('[data-wool-receiving-feedback]').filter({hasText:'已保存'}).waitFor())
 result.checks.push({name:'PDA实际回货片保存5片',pass:(await p.locator('[data-wool-receiving-feedback]').innerText()).includes('5 片')})
 await p.screenshot({path:path.join(out,'pda-piece-receive.png')})
 const routes=[
  ['knitting','/fcs/craft/wool/knitting-orders','[data-wool-work-orders-root]',1366,768],
  ['linking','/fcs/craft/wool/linking-orders','[data-wool-work-orders-root]',1280,720],
  ['knitting-detail','/fcs/craft/wool/knitting-orders/WOOL-STAGE-008%3AKNITTING','[data-wool-detail-root]',1366,768],
  ['linking-detail','/fcs/craft/wool/linking-orders/WOOL-STAGE-010%3ALINKING','[data-wool-detail-root]',1366,768],
  ['pending','/fcs/craft/wool/pending-receipts','[data-wool-receiving-page]',1280,720],
  ['pda-receive','/fcs/pda/wool/pending-receipts?workOrderId=WOOL-STAGE-010%3ALINKING','[data-wool-receiving-page]',360,800],
 ]
 const storage=await context.storageState()
 for(const [name,route,selector,width,height] of routes){const c=await browser.newContext({viewport:{width,height},storageState:storage});const page=await c.newPage();page.on('pageerror',e=>result.errors.push(e.message));await page.goto(base+route);await page.locator(selector).first().waitFor();await settled(page);const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);await page.screenshot({path:path.join(out,`${name}.png`)});result.routes.push({name,route,viewport:{width,height},pass:noOverflow,imagesDecoded:true});await c.close()}

}catch(e){result.errors.push(e.stack);console.error(e.message);await p.screenshot({path:path.join(out,'browser-failure.png')}).catch(()=>{})}
finally{fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));await browser.close()}
const functionalPass=result.errors.length===0&&result.checks.length===5&&result.checks.every(x=>x.pass)&&result.routes.length===6&&result.routes.every(r=>r.pass)&&result.actions.every(x=>x.pass)
console.log(JSON.stringify({checks:result.checks,errors:result.errors,functionalPass,performanceStatus:'NOT_ASSESSED_BY_THIS_SCRIPT'}));if(!functionalPass)process.exitCode=1
