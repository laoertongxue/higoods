import {chromium} from 'playwright'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const server=process.env.PF_CHECK_URL||'http://192.168.0.10:4179',output=process.env.PF_CHECK_OUTPUT||'output/playwright/dds-pf-v4-source-entry',base='/dds/supply-chain/production-fulfillment/',results=[]
const targets=[{kind:'execution',taskId:'DEM-202603-0005',documentNo:'TASKGEN-202603-0002-001'},{kind:'qc',taskId:'DEM-202603-0005',documentNo:'QC-RIB-202603-0002'}]
if(process.argv.includes('--with-demand-list'))targets.push({kind:'demand-list',taskId:'DEM-202603-0005',documentNo:'DEM-202603-0005'})
await mkdir(output,{recursive:true});const browser=await chromium.launch({headless:true}),script=await readFile(new URL(import.meta.url))
try{for(const target of targets)for(let i=0;i<5;i++){
 const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page),pageErrors=[];await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache');page.on('pageerror',error=>pageErrors.push(String(error)))
 try{
  await page.goto(server+base+'tasks/'+target.taskId);await page.locator('.pf-flow-node').first().waitFor()
  await page.locator('.pf-flow-node-doc').filter({hasText:target.documentNo}).first().click();await page.locator('.pf-document-summary').waitFor()
  const href=await page.locator('.pf-source-document-link a').getAttribute('href'),linkLabel=await page.locator('.pf-source-document-link a').textContent()
  await page.evaluate(({target,href})=>{
   document.addEventListener('click',event=>{if(!(event.target instanceof Element)||!event.target.closest('.pf-source-document-link a'))return
    const start=event.timeStamp>1e12?event.timeStamp-performance.timeOrigin:event.timeStamp
    window.sourceEntryResult=new Promise(resolve=>{
     const inspect=()=>{
      const root=document.querySelector('#root')||document.body,text=root.textContent||'',targetReached=location.pathname+location.search===href&&!document.querySelector('#pf-app')
      const identity=target.kind==='demand-list'?/生产需求/.test(text):text.includes(target.documentNo)
      const core=target.kind==='execution'?!!root.querySelector('[data-progress-task-detail]')&&['任务ID','生产单号','工序','任务对象与单位'].every(s=>text.includes(s)):target.kind==='qc'?/质检记录/.test(text)&&/检查人|质检人/.test(text)&&/质检结果|检验结果/.test(text):!!root.querySelector('table')&&/查询/.test(text)&&/需求单/.test(text)
      const images=[...root.querySelectorAll('img')].filter(img=>img.getClientRects().length&&getComputedStyle(img).visibility!=='hidden'),error=targetReached&&/页面不存在|页面未找到|功能开发中|页面开发中|未找到任务|当前任务不存在|质检记录不存在/.test(text)
      return {targetReached,identity,core,contentReady:targetReached&&identity&&core&&images.every(img=>img.complete&&img.naturalWidth>0),error,images:images.map(img=>({src:img.src,alt:img.alt,complete:img.complete,width:img.naturalWidth})),text:text.slice(-9000)}
     }
     const tick=()=>{const state=inspect();if(performance.now()-start>10000){resolve({ms:performance.now()-start,start,...state,failure:'目标编号、核心内容或必要图片10秒内未就绪'});return}if(!state.contentReady&&!state.error){requestAnimationFrame(tick);return}requestAnimationFrame(()=>{const again=inspect();if(!again.contentReady&&!again.error){requestAnimationFrame(tick);return}resolve({ms:performance.now()-start,start,...again,...(again.error?{failure:'目标业务页面呈现缺失/开发中状态'}:{})})})};requestAnimationFrame(tick)
    })
   },{capture:true,once:true})
  },{target,href})
  await page.locator('.pf-source-document-link a').click();const result=await page.evaluate(()=>window.sourceEntryResult);results.push({...target,iteration:i+1,href,linkLabel,url:page.url(),pageErrors,...result});await page.screenshot({path:output+'/'+target.kind+'-target-'+(i+1)+'.png'});console.log(JSON.stringify({...target,iteration:i+1,href,ms:result.ms,contentReady:result.contentReady,failure:result.failure,pageErrors}))
 }catch(error){results.push({...target,iteration:i+1,failure:String(error),pageErrors})}finally{await context.close()}
}}finally{await browser.close();await writeFile(output+'/measurement-script.mjs',script);await writeFile(output+'/verification.json',JSON.stringify({server,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:process.cwd(),scriptSha256:createHash('sha256').update(script).digest('hex'),measurement:'Actual source link click event.timeStamp through target URL, document identity, core content, necessary images and completed ready-check paint followed by next-frame recheck; five isolated cold contexts per source type. Demand-list target is explicitly list navigation, not automatic document opening.',results,pass:results.length===targets.length*5&&results.every(row=>row.contentReady&&!row.failure&&!row.pageErrors.length&&row.ms<200)},null,2))}
if(results.some(row=>row.failure||row.ms>=200||row.pageErrors.length))process.exitCode=1
