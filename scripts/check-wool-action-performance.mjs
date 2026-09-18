import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const base = process.env.WOOL_BASE_URL || 'http://127.0.0.1:4186'
const output = 'docs/product-design/wool-two-stage-adjustment/evidence/action-performance.json'
const key = 'higood-fcs-wool-stage-store-v3'
const session = { userId: 'OWN_WOOL_FACTORY_operator', loginId: 'OWN_WOOL_FACTORY_operator', userName: '周哥毛织厂_操作工', roleId: 'ROLE_OPERATOR', factoryId: 'OWN_WOOL_FACTORY', factoryName: '周哥毛织厂', loggedAt: '2026-09-18 10:00:00' }
const report = { buildIndexSha256: createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'), at: new Date().toISOString(), base, branch: execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(), head: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), cwd: process.cwd(), scope: 'Named actions below only; does not claim all affected-entry coverage.', measurement: 'Captured click/input/change/keydown until explicit result predicate, all visible images decoded, and two animation frames. Raw five samples; no driver waiting counted.', actions: {}, errors: [] }
const browser = await chromium.launch()
const a = (name,id) => `[data-wool-work-orders-action="${name}"]${id?`[data-wool-order-id="${id}"]`:''}`
const q = s => `document.querySelector(${JSON.stringify(s)})`
const visible = s => `${q(s)} && ${q(s)}.getBoundingClientRect().height>0`
const absent = s => `!${q(s)}`
const field = (prefix,name) => `[data-${prefix}-field="${name}"]`
const save = () => fs.writeFileSync(output,JSON.stringify(report,null,2))
async function measure(page,name,operation,ready,type='click') {
  await page.evaluate(({ready,type}) => {
    window.__woolActionTiming=undefined
    const ctx={table:document.querySelector('table'),body:document.querySelector('[data-wool-work-orders-table-surface]')?.firstElementChild}
    const test=new Function('ctx',`return Boolean(${ready})`)
    const eventStart=()=>{
      const start=performance.now();let pending=false,finished=false
      const observer=new MutationObserver(check)
      function check(){if(pending||finished)return;try{if(!test(ctx))return}catch{return}pending=true
        const images=[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0})
        Promise.all(images.map(img=>img.decode())).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(!test(ctx)){pending=false;check();return}
          finished=true;observer.disconnect();const ms=performance.now()-start
          window.__woolActionTiming={ms,pass:ms<200,imageCount:images.length}
        }))).catch(error=>{finished=true;observer.disconnect();window.__woolActionTiming={error:String(error),pass:false}})
      }
      observer.observe(document,{subtree:true,childList:true,attributes:true,characterData:true})
      queueMicrotask(check)
    }
    document.addEventListener(type,eventStart,{once:true,capture:true})
  },{ready,type})
  try {
    await operation()
    await page.waitForFunction(()=>window.__woolActionTiming,null,{timeout:10000})
    const result=await page.evaluate(()=>window.__woolActionTiming)
    ;(report.actions[name] ||= []).push(result)
  } catch(error) { (report.actions[name] ||= []).push({error:String(error),pass:false});throw error }
}
async function click(page,name,selector,ready){await measure(page,name,()=>page.locator(selector).first().click(),ready)}
async function fill(page,name,selector,value){await measure(page,name,()=>page.locator(selector).fill(value),`${q(selector)}?.value===${JSON.stringify(value)}`,'input')}
async function imageActions(page,prefix){
  await click(page,prefix+'图片打开','[data-pda-image-preview-url]',visible('[data-pda-image-preview-root] img'))
  await measure(page,prefix+'图片Esc关闭',()=>page.keyboard.press('Escape'),absent('[data-pda-image-preview-root]'),'keydown')
}
async function listActions(page,stage){
 const prefix=stage==='knitting'?'横机':'缝盘'
 await page.goto(`${base}/fcs/craft/wool/${stage}-orders`)
 await page.locator('[data-wool-work-orders-root]').waitFor()
 for(const tab of ['UNPROCESSED','READY','PROCESSING','PROCESS_COMPLETE','COMPLETED','ALL']) await click(page,prefix+'状态'+tab,a('tab:'+tab),`${q('[data-wool-work-orders-table-surface]')}?.firstElementChild!==ctx.body`)
 await fill(page,prefix+'关键词输入',field('wool-work-orders','keyword'),'NO-MATCH')
 await click(page,prefix+'查询空结果',a('query'),`${q('[data-wool-work-orders-table-surface]')}?.textContent.includes('暂无')`)
 await click(page,prefix+'重置',a('reset-filters'),`${q('[data-wool-work-orders-total]')}?.textContent.includes('14') && ${q('tbody tr')}`)
 await click(page,prefix+'下一页',a('next-page'),`document.querySelectorAll('[data-wool-work-orders-table-surface] tbody tr').length===4`)
 await click(page,prefix+'上一页',a('prev-page'),`document.querySelectorAll('[data-wool-work-orders-table-surface] tbody tr').length===10`)
 await click(page,prefix+'排序',a('sort-column')+'[data-column-key="order"]',`${q('th[data-column-key="order"]')}?.getAttribute('aria-sort')==='ascending'`)
 await click(page,prefix+'列设置打开',a('open-column-settings'),visible(a('restore-column-settings')))
 const toggle=a('toggle-column-visibility')+'[data-wool-work-orders-column-key="requirements"]'
 await measure(page,prefix+'隐藏列',()=>page.locator(toggle).uncheck(),absent('th[data-column-key="requirements"]'),'change')
 await click(page,prefix+'列设置恢复',a('restore-column-settings'),visible('th[data-column-key="requirements"]'))
 await click(page,prefix+'列设置关闭',a('close-column-settings'),absent(a('restore-column-settings')))
 await imageActions(page,prefix)
 const id=stage==='knitting'?'WOOL-STAGE-002:KNITTING':'WOOL-STAGE-010:LINKING'
 await click(page,prefix+'填报打开',a('open-report',id),visible('[data-wool-business-dialog]'))
 await fill(page,prefix+'超量输入',field('wool-dialog','qty'),stage==='knitting'?'151':'81')
 await click(page,prefix+'超量阻断',a('save-report'),visible('[data-wool-overlay-error]'))
 await fill(page,prefix+'填报数量',field('wool-dialog','qty'),'1')
 const saved=`JSON.parse(localStorage.getItem('${key}')).processReports.some(r=>r.woolOrderId==='${id}'&&r.reportedQty===1)`
 await click(page,prefix+'填报保存',a('save-report'),`${absent('[data-wool-business-dialog]')} && ${saved}`)
}
async function receivingActions(page,pda,piece){
 const prefix=(pda?'PDA':'Web')+(piece?'片接收':'纱线接收'),route=pda?'pda/wool':'craft/wool'
 await page.goto(`${base}/fcs/${route}/pending-receipts?workOrderId=${piece?'WOOL-STAGE-010%3ALINKING':'WOOL-STAGE-001%3AKNITTING'}`)
 const action=name=>`[data-wool-receiving-action="${name}"]`
 await page.locator('[data-wool-receiving-page]').waitFor()
 await click(page,prefix+'打开',action('receive'),visible(field('wool-receiving',piece?'pieceQty':'pcs')))
 if(piece) await fill(page,prefix+'数量输入',field('wool-receiving','pieceQty'),'1')
 else for(const[name,value]of [['pcs','1'],['grossKg','1.062'],['PAPER','1']]) await fill(page,prefix+name+'输入',field('wool-receiving',name),value)
 await click(page,prefix+'复核',action('review'),visible(action('save')))
 await click(page,prefix+'保存',action('save'),`${q('[data-wool-receiving-feedback]')}?.textContent.includes('已保存')`)
}
async function stockActions(page){
 await page.goto(base+'/fcs/craft/wool/pending-receipts?view=stock')
 const action=name=>`[data-wool-stock-action="${name}"]`
 await click(page,'备料分配打开',action('allocate'),visible(field('wool-stock','target')))
 const target=field('wool-stock','target')
 await measure(page,'备料选择横机',()=>page.locator(target).selectOption('WOOL-STAGE-001:KNITTING'),`${q(target)}?.value==='WOOL-STAGE-001:KNITTING'`,'change')
 await fill(page,'备料分配数量',field('wool-stock','qty'),'2')
 await click(page,'备料分配复核',action('review'),visible(action('save')))
 await click(page,'备料分配保存',action('save'),`${q('[data-wool-stock-table]')}?.textContent.includes('8 kg')`)
}
const scenarios=[['横机列表',p=>listActions(p,'knitting'),1366,768],['缝盘列表',p=>listActions(p,'linking'),1280,720],['Web纱线接收',p=>receivingActions(p,false,false),1366,768],['Web片接收',p=>receivingActions(p,false,true),1280,720],['PDA纱线接收',p=>receivingActions(p,true,false),360,800],['PDA片接收',p=>receivingActions(p,true,true),400,806],['备料分配',stockActions,1280,720]]
try {
 for(const[name,run,width,height]of scenarios){
  for(let n=0;n<5;n++){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage()
   page.setDefaultTimeout(10000)
   await page.addInitScript(session=>localStorage.setItem('fcs_pda_session',JSON.stringify(session)),session)
   page.on('pageerror',error=>report.errors.push({name,iteration:n,error:error.message}))
   try{await run(page)}catch(error){report.errors.push({name,iteration:n,error:String(error)})}
   finally{await context.close();save()}
  }
  console.log(name, 'five scenarios recorded')
 }
}finally{
 report.pass=report.errors.length===0&&Object.values(report.actions).every(samples=>samples.length===5&&samples.every(sample=>sample.pass))
 report.summary=Object.entries(report.actions).map(([name,samples])=>({name,samples:samples.length,maxMs:Math.max(...samples.map(s=>s.ms||Infinity)),pass:samples.length===5&&samples.every(s=>s.pass)}))
 save();await browser.close()
}
console.log(JSON.stringify({actions:report.summary.length,failed:report.summary.filter(a=>!a.pass).length,errors:report.errors.length,pass:report.pass}))
if(!report.pass)process.exitCode=1
