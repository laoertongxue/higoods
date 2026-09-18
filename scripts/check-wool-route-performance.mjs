import { createHash } from 'node:crypto'
import {chromium} from 'playwright'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const base=process.env.WOOL_BASE_URL||'http://127.0.0.1:4186'
const out=process.env.WOOL_PERF_OUTPUT||'docs/product-design/wool-two-stage-adjustment/evidence/acceptance-500/route-performance.json'
const session={userId:'OWN_WOOL_FACTORY_operator',loginId:'OWN_WOOL_FACTORY_operator',userName:'周哥毛织厂_操作工',roleId:'ROLE_OPERATOR',factoryId:'OWN_WOOL_FACTORY',factoryName:'周哥毛织厂',loggedAt:'2026-09-18 10:00:00'}
const stage='/fcs/craft/wool/',pda='/fcs/pda/'
const allRoutes=[
 ['横机列表',stage+'knitting-orders','[data-wool-work-orders-root]',1366,768],
 ['缝盘列表',stage+'linking-orders','[data-wool-work-orders-root]',1280,720],
 ['横机详情',stage+'knitting-orders/WOOL-STAGE-008%3AKNITTING','[data-wool-detail-root]',1366,768],
 ['缝盘详情',stage+'linking-orders/WOOL-STAGE-010%3ALINKING','[data-wool-detail-root]',1280,720],
 ['纱线待接收',stage+'pending-receipts','[data-wool-receiving-page]',1366,768],
 ['外工艺片待接收',stage+'pending-receipts?workOrderId=WOOL-STAGE-010%3ALINKING','[data-wool-receiving-page]',1280,720],
 ['备料分配',stage+'pending-receipts?view=stock','[data-wool-stock-page]',1280,720],
 ['待加工仓',stage+'wait-process-warehouse','[data-wool-warehouse-root]',1366,768],
 ['待交出仓',stage+'wait-handover-warehouse','[data-wool-warehouse-root]',1280,720],
 ['横机设备',stage+'machines','[data-wool-machines-root]',1366,768],
 ['设备关联','/fcs/process-factory/wool/machine-associations','[data-wool-machine-associations-root]',1366,768],
 ['横机打印',stage+'knitting-orders/WOOL-STAGE-009%3AKNITTING/handover-print','[data-wool-print-button]:enabled',1366,768],
 ['缝盘打印',stage+'linking-orders/WOOL-STAGE-005%3ALINKING/handover-print','[data-wool-print-button]:enabled',1366,768],
 ['PDA纱线接收',pda+'wool/pending-receipts?workOrderId=WOOL-STAGE-001%3AKNITTING','[data-wool-receiving-page]',360,800],
 ['PDA回货片接收',pda+'wool/pending-receipts?workOrderId=WOOL-STAGE-010%3ALINKING','[data-wool-receiving-page]',400,806],
 ['PDA备料分配',pda+'wool/pending-receipts?view=stock','[data-wool-stock-page]',360,800],
 ['PDA仓管摘要',pda+'warehouse','[data-nav="/fcs/pda/warehouse/stocktake?mode=search"]',400,806],
 ['PDA任务队列',pda+'exec','[data-testid="pda-exec-card-list"]',360,800],
 ['PDA横机交出',pda+'handover?tab=handout&taskId=TASK-WOOL-STAGE-008%3AKNITTING','[data-pda-wool-root]',360,800],
 ['PDA缝盘交出',pda+'handover?tab=handout&taskId=TASK-WOOL-STAGE-010%3ALINKING','[data-pda-wool-root]',400,806],
 ['PDA横机执行',pda+'exec/TASK-WOOL-STAGE-002%3AKNITTING','[data-pda-wool-root]',360,800],
 ['PDA缝盘执行',pda+'exec/TASK-WOOL-STAGE-010%3ALINKING','[data-pda-wool-root]',400,806],
 ['PDA入库记录',pda+'warehouse/inbound-records','[data-wool-pda-warehouse-flows]',360,800],
 ['PDA出库记录',pda+'warehouse/outbound-records','[data-wool-pda-warehouse-flows]',400,806],
 ['工艺片详情','/fcs/process-factory/special-craft/aux-op-embroidery/work-orders/WSC%3AWOOL-STAGE-009%3AWOOL-STAGE-009%3AQ1%3ACARDIGAN-CREAM-M%3AWOOL-STAGE-009%3AQ1%3Astep1','[data-wool-craft-detail]',1366,768],
]
// Supervisor Web coverage uses the same full data and route, at the required smaller viewport.
allRoutes.push(...allRoutes.filter(row => !row[1].includes('/pda/') && !row[0].includes('打印')).map(([name,url,selector]) => [name+'1024',url,selector,1024,768]))
const selectedNames=process.env.WOOL_ROUTE_NAMES?.split(',')
const routes=selectedNames ? allRoutes.filter(row=>selectedNames.includes(row[0])) : allRoutes
if(!routes.length)throw new Error('No performance routes selected')
const report={buildIndexSha256:createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),scope:selectedNames?'diagnostic subset':'all named routes',at:new Date().toISOString(),base,cwd:process.cwd(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:'',gate:'Default <500ms; user-authorized 2026-09-19 exception: PDA task queue cold entry <=1000ms. No other exception. Failure/missing content/image is failure.',cache:'Cold: new empty browser context (PDA login only); reload: same context persisted facts/cache; route switch: real data-nav dispatch after different stage page.',measurement:'Browser navigation origin or captured click to target content, visible real images decoded and 2 requestAnimationFrames. No driver polling time included.',routes:[],errors:[]}
const browser=await chromium.launch();report.browser=browser.version()
function observer({selector,session,isPda}){
 if(isPda)localStorage.setItem('fcs_pda_session',JSON.stringify(session))
 let generation=0
 window.__beginWoolMeasure=(target,start=0,previousRoot=null)=>{
  const gen=++generation;window.__woolTiming=undefined;let queued=false
  const check=()=>{if(gen!==generation||queued||!document.querySelector(target)||document.querySelector(target)===previousRoot)return;queued=true
   const content=performance.now();const images=[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0})
   Promise.all(images.map(i=>i.decode())).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(gen===generation){ const broken=[...document.querySelectorAll('[data-pda-image-preview-url]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0&&el.querySelector('img')&&!el.querySelector('img').naturalWidth});window.__woolTiming={ms:performance.now()-start,contentMs:content-start,imageCount:images.length,visibleImageFailures:broken.length,pass:broken.length===0&&performance.now()-start<500} }}))).catch(e=>{window.__woolTiming={error:String(e),pass:false}})
  };new MutationObserver(check).observe(document,{childList:true,subtree:true,attributes:true});check()
 };window.__beginWoolMeasure(selector)
}
async function timing(page){try{await page.waitForFunction(()=>window.__woolTiming,null,{timeout:20000});return await page.evaluate(()=>window.__woolTiming)}catch(e){return{error:String(e),pass:false}}}
try {
 for (const [name,url,selector,width,height] of routes) {
  const record={name,url,viewport:{width,height},cold:[],refresh:[],routeSwitch:[]}
  for (let n=0;n<5;n++) {
   const c=await browser.newContext({viewport:{width,height}}),p=await c.newPage()
   p.on('pageerror',e=>report.errors.push({route:url,iteration:n,error:e.message}))
   await p.addInitScript(observer,{selector,session,isPda:url.includes('/pda/')})
   try {
    await p.goto(base+url,{waitUntil:'domcontentloaded',timeout:10000})
    record.cold.push(await timing(p))
    await p.reload({waitUntil:'domcontentloaded',timeout:10000})
    record.refresh.push(await timing(p))
    const other=url.includes('linking-orders')?stage+'knitting-orders':stage+'linking-orders'
    await p.goto(base+other,{waitUntil:'domcontentloaded',timeout:10000})
    await p.locator('[data-wool-work-orders-root]').waitFor()
    await p.evaluate(({url,selector})=>{
     const button=document.createElement('button');button.dataset.nav=url;document.querySelector('#app').append(button)
     button.addEventListener('click',()=>window.__beginWoolMeasure(selector,performance.now(),document.querySelector(selector)),{once:true,capture:true})
     button.click();button.remove()
    },{url,selector})
    record.routeSwitch.push(await timing(p))
   } catch (error) {
    report.errors.push({route:url,iteration:n,error:String(error)})
    for (const samples of [record.cold,record.refresh,record.routeSwitch]) if(samples.length===n) samples.push({error:String(error),pass:false})
   } finally { await c.close() }
  }
  for (const mode of ['cold','refresh','routeSwitch']) for (const sample of record[mode]) {
    const exception = name === 'PDA任务队列' && mode === 'cold'
    sample.limitMs = exception ? 1000 : 500
    sample.exception = exception ? 'User authorized occasional heavy pages <=1s on 2026-09-19; PDA queue cold entry only' : undefined
    sample.pass = !sample.error && sample.visibleImageFailures === 0 && (exception ? sample.ms <= 1000 : sample.ms < 500)
  }
  record.max=Math.max(...[...record.cold,...record.refresh,...record.routeSwitch].map(x=>x.ms??Infinity))
  record.pass=[...record.cold,...record.refresh,...record.routeSwitch].every(x=>x.pass)
  report.routes.push(record);fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2))
  console.log(name,record.max,record.pass?'PASS':'FAIL')
 }
} finally {
 report.pass=report.errors.length===0&&report.routes.length===routes.length&&report.routes.every(r=>r.pass)
 fs.writeFileSync(out,JSON.stringify(report,null,2));await browser.close()
}
if(!report.pass)process.exitCode=1
