import { chromium } from 'playwright'
import { mkdir,writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const server=process.env.PF_CHECK_URL||'http://127.0.0.1:4179',base='/dds/supply-chain/production-fulfillment/'
const output='output/playwright/dds-pf-v3',quick=process.argv.includes('--quick')
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage()
const samples=[],errors=[],checks=[]
page.on('pageerror',error=>errors.push(String(error)))
await context.addInitScript(()=>{
  window.pfV3Samples=[]
  const ready=()=>{const app=document.querySelector('#pf-app');return app&&decodeURI(app.dataset.pfRoute)===decodeURI(location.pathname)&&[...app.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)}
  window.pfV3Settle=(start,label)=>new Promise(resolve=>{const tick=()=>{if(performance.now()-start>10000){resolve({label,ms:performance.now()-start,error:'内容未就绪'});return}if(!ready()){requestAnimationFrame(tick);return}requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!ready()){tick();return}const s={label,ms:performance.now()-start,route:location.pathname,viewport:innerWidth+'×'+innerHeight};window.pfV3Samples.push(s);resolve(s)}))};tick()})
  window.pfV3Navigation=window.pfV3Settle(0,'navigation')
  for(const type of ['click','input','change','keydown'])document.addEventListener(type,event=>{if(!document.querySelector('#pf-app'))return;if(type==='keydown'&&!['Escape','Enter'].includes(event.key))return;window.pfV3Last=window.pfV3Settle(performance.now(),type+':'+(event.target.closest('[data-pf-action]')?.dataset.pfAction||event.target.dataset.pfField||event.key||event.target.tagName))},true)
})
async function measure(promise,kind,selector){await promise;const result=await page.evaluate(()=>window.pfV3Last);assert(result,'missing event '+selector);assert(!result.error,result.error);samples.push({...result,kind,selector});return result}
async function act(selector,kind='click',value){const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded();return measure(kind==='select'?target.selectOption(value):kind==='fill'?target.fill(value):target.click(),kind,selector)}
async function nav(path,label='refresh'){await page.goto(server+base+path);await page.waitForSelector('#pf-content');const r=await page.evaluate(()=>window.pfV3Navigation);if(process.argv.includes('--diagnose'))r.marks=await page.evaluate(()=>performance.getEntriesByType('mark').map(e=>({name:e.name,start:e.startTime})));if(process.argv.includes('--diagnose'))r.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),start:e.startTime,end:e.responseEnd,duration:e.duration,size:e.transferSize})));samples.push({...r,kind:label});assert(!r.error,r.error);return r}
async function repeat(name,fn){for(let i=0;i<(quick?1:5);i++){await fn(i);if(samples.length)samples.at(-1).case=name}}
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name)}
async function layout(){assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false,'page horizontal overflow');assert.equal(await page.locator('[data-pf-field="role"],[data-pf-field="timezone"],.pf-mock-label').count(),0);if(await page.locator('.pf-filter-fields').count()){
const r=await page.locator('.pf-query-card').evaluate(card=>{const fields=[...card.querySelectorAll('.pf-filter-fields>.pf-field')].map(e=>e.getBoundingClientRect());return{widths:fields.map(r=>r.width),bottom:Math.max(...fields.map(r=>r.bottom)),actions:card.querySelector('.pf-filter-actions').getBoundingClientRect().top,labels:[...card.querySelectorAll('.pf-filter-fields>.pf-field>span:first-child')].slice(0,4).map(e=>e.textContent)}});assert(r.actions>=r.bottom);assert(Math.max(...r.widths)-Math.min(...r.widths)<1);assert.deepEqual(r.labels,['任务 / 需求 / 采购 / 生产单 / 款号','跟单','责任团队','责任工厂'])}}
let taskPath='',teamPath=''
try{
 if(process.argv.includes('--profile')){
 const profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');await nav('overview','profile');const result=await profiler.send('Profiler.stop');await writeFile(output+'/cpu-profile.json',JSON.stringify(result.profile));console.log(result.profile.nodes.sort((a,b)=>(b.hitCount||0)-(a.hitCount||0)).slice(0,25).map(n=>({fn:n.callFrame.functionName,url:n.callFrame.url.split('/').pop(),line:n.callFrame.lineNumber,col:n.callFrame.columnNumber,hits:n.hitCount})));}
 await check('七菜单冷进入与刷新、筛选结构',async()=>{
  const cdp=await context.newCDPSession(page)
  for(const section of ['overview','tasks','follow-up','work-items','teams','fulfillment','configuration']){
   await repeat(section+'-cold',async()=>{await cdp.send('Network.clearBrowserCache');await nav(section,'cold');await layout()})
   await repeat(section+'-refresh',()=>nav(section,'refresh'))
   if(section==='configuration'){await page.screenshot({path:output+'/configuration-1366.png'});continue}
   await repeat(section+'-filters',async()=>{await act('[data-pf-action="more"]');await layout();await act('[data-pf-action="more"]');await layout()})
   for(const key of ['follower','team','factory'])await repeat(section+'-'+key,async()=>{const options=await page.locator(`[data-pf-field="${key}"] option`).evaluateAll(es=>es.map(e=>e.value));if(options.length>1)await act(`[data-pf-field="${key}"]`,'select',options[1]);await act('[data-pf-action="query"]');await act('[data-pf-action="reset"]')})
   await repeat(section+'-search',async()=>{await act('[data-pf-field="query"]','fill','不匹配的检索');await act('[data-pf-action="query"]');await act('[data-pf-action="export"]');await act('[data-pf-action="reset"]')})
   if(section==='tasks'){taskPath=(await page.locator('a[href*="/tasks/"]').first().getAttribute('href')).replace(base,'');assert(!taskPath.includes('MOCK-PT'));await repeat('task-export',async()=>{const download=page.waitForEvent('download');await act('[data-pf-action="export"]');await(await download).saveAs(output+'/tasks.csv')})}
   if(section==='teams')teamPath=(await page.locator('a[href*="/teams/"]').first().getAttribute('href')).replace(base,'')
   await page.screenshot({path:output+'/'+section+'-1366.png'})
  }
 })
 if(!quick){
 await check('总览各视图及团队队列',async()=>{
  await nav('overview');for(const value of ['运行概况','分布分析','数据待补'])await repeat('overview-'+value,()=>act(`[data-pf-action="overview-tab"][data-value="${value}"]`))
  await act('[data-pf-action="overview-tab"][data-value="分布分析"]');for(const value of ['分布','交付表现'])await repeat('analysis-'+value,()=>act('[data-pf-field="analysis-view"]','select',value))
  await nav(teamPath);for(const value of ['可执行工作','需要协调','交付记录'])await repeat('team-'+value,()=>act(`[data-pf-action="team-tab"][data-value="${value}"]`))
  await nav('fulfillment');for(const value of ['发货行','完整订单','时钟对照'])await repeat('fulfillment-'+value,()=>act(`[data-pf-action="fulfillment-mode"][data-value="${value}"]`))
 })
 await check('任务来源、准备与工艺路线、工作明细',async()=>{
  await repeat('task-cold',async()=>{await(await context.newCDPSession(page)).send('Network.clearBrowserCache');await nav(taskPath,'cold')})
  await repeat('task-refresh',()=>nav(taskPath))
  for(const tab of ['全程时效','工作明细','数量批次','实际发货与订单','计算与版本','跟进记录'])await repeat('detail-'+tab,()=>act(`[data-pf-action="detail-tab"][data-value="${tab}"]`))
  await act('[data-pf-action="detail-tab"][data-value="全程时效"]')
  for(const value of ['生产准备','工艺路线','全程甘特'])await repeat('source-'+value,()=>act(`[data-pf-action="detail-subtab"][data-value="${value}"]`))
  await act('[data-pf-action="detail-subtab"][data-value="工艺路线"]');await page.screenshot({path:output+'/route-1366.png'});await act('[data-pf-action="detail-subtab"][data-value="全程甘特"]');await page.screenshot({path:output+'/timeline-1366.png'})
  for(const action of ['expand-all','collapse-all','toggle-dependencies','toggle-children','fit-timeline'])await repeat('timeline-'+action,()=>act(`[data-pf-action="${action}"]`))
  for(const [key,values] of [['timeline-mode',['全部工作','风险工作','关键路径']],['timeline-basis',['原始基线','当前标准']],['timeline-scale',['小时','日']]])for(const value of values)await repeat(key+value,()=>act(`[data-pf-field="${key}"]`,'select',value))
  await act('[data-pf-field="timeline-mode"]','select','全部工作');await act('[data-pf-action="expand-all"]')
  await repeat('source-association-persist',async()=>{await act('[data-pf-action="bind-sources"]');await act('[data-pf-action="save-sources"]');assert.equal(await page.locator('#pf-overlays [role="dialog"]').count(),0);assert(await page.evaluate(id=>Object.hasOwn(JSON.parse(localStorage.getItem('dds-production-fulfillment-source-bindings-v1')||'{}'),id),taskPath.split('/').pop()))})
  await act('[data-pf-action="detail-tab"][data-value="工作明细"]');assert.equal(await page.getByText('本任务工作项',{exact:false}).count(),0)
  const alignment=await page.evaluate(()=>{const tabs=document.querySelector('[aria-label="任务详情视图"]').getBoundingClientRect();const table=document.querySelector('#pf-content table').getBoundingClientRect();return Math.abs(tabs.left-table.left)});assert(alignment<=2,'embedded table alignment '+alignment)
  await page.screenshot({path:output+'/work-detail-1366.png'})
  await repeat('work-drawer',async()=>{await act('[data-pf-action="open-node"]');for(const value of ['时效与数量','前后依赖','来源证据'])await act(`[data-pf-action="work-tab"][data-value="${value}"]`);await act('#pf-overlays [data-pf-action="close"]')})
  await repeat('image-preview',async()=>{await act('[data-pf-action="image"]');await act('#pf-overlays [data-pf-action="close"]')})
  await act('[data-pf-action="detail-tab"][data-value="计算与版本"]');for(const value of ['整体公式','逐项倒排','版本记录'])await repeat('formula-'+value,()=>act(`[data-pf-action="detail-subtab"][data-value="${value}"]`))
  await act('[data-pf-action="detail-tab"][data-value="跟进记录"]');await repeat('followup-save',async()=>{await act('[data-pf-action="followup"]');await act('[name="reason"]','fill','来源需补齐');await act('[name="action"]','fill','核对当前专业任务');await act('[data-pf-action="save-followup"]')})
 })
 await check('规则配置七分区及弹窗层级',async()=>{
  await nav('configuration');for(const value of ['阶段与工作','单据与事件','时效要求','组上限与依赖','责任规则','风险与数据','版本与发布'])await repeat('config-tab-'+value,()=>act(`[data-pf-action="config-tab"][data-config-tab="${value}"]`))
  for(const [tab,action] of [['阶段与工作','config-edit-stage'],['阶段与工作','config-select-work'],['单据与事件','config-select-mapping'],['时效要求','config-select-rule'],['责任规则','config-select-owner']]){await act(`[data-pf-action="config-tab"][data-config-tab="${tab}"]`);await repeat(action,async()=>{await act(`[data-pf-action="${action}"]`);await act('.pf-config-dialog header [data-pf-action="config-close"]')})}
  await act('[data-pf-action="config-tab"][data-config-tab="版本与发布"]');
  for(const action of ['config-validate','config-preview','config-history'])await repeat(action,async()=>{await act(`[data-pf-action="${action}"]`);await act('.pf-config-dialog header [data-pf-action="config-close"]')})
  await repeat('config-save',()=>act('[data-pf-action="config-save"]'));await page.screenshot({path:output+'/configuration-publishing-1366.png'})
 })
 await check('明确执行任务来源与工厂',async()=>{await nav('tasks/DEM-202603-0005');await act('[data-pf-action="detail-tab"][data-value="工作明细"]');assert(await page.getByText('全能力测试工厂',{exact:true}).count());assert(await page.getByText('SPF - 特种工艺',{exact:true}).count());await page.screenshot({path:output+'/execution-1366.png'});await act('[data-pf-action="detail-tab"][data-value="全程时效"]');await act('[data-pf-action="detail-subtab"][data-value="工艺路线"]');await page.screenshot({path:output+'/execution-route-1366.png'})});
 await check('列设置、分页、排序与低分辨率',async()=>{
  await nav('work-items');await repeat('columns',async()=>{await act('[data-pf-action="columns"]');await act('[data-pf-action="close-column-settings"]')})
  await repeat('pagination',async()=>{await act('[data-pf-action="next-page"]');await act('[data-pf-action="prev-page"]')})
  await repeat('sort',()=>act('[data-pf-action="sort-column"]'))
  await repeat('page-size',async()=>{await act('[data-pf-field="pageSize"]','select','10');await act('[data-pf-field="pageSize"]','select','20')})
  for(const width of [1280,1024]){await page.setViewportSize({width,height:width===1280?720:768});for(const route of ['overview','tasks','follow-up','work-items','teams','fulfillment','configuration',taskPath,teamPath]){await repeat('responsive-'+width+'-'+route,()=>nav(route));await layout()}await page.screenshot({path:output+'/task-'+width+'.png'})}
  await page.setViewportSize({width:1920,height:1080});await nav('overview');await repeat('fullscreen',()=>act('[data-pf-action="fullscreen"]'))
 })
 }
}catch(error){errors.push(String(error));console.error(error);await page.screenshot({path:output+'/failure.png'})}
finally{const report={server,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),checks,samples,errors,performancePass:samples.every(s=>s.ms<200&&!s.error),maxMs:Math.max(...samples.map(s=>s.ms)),at:new Date().toISOString()};await writeFile(output+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:checks.length,samples:samples.length,max:report.maxMs,errors}));await browser.close();if(errors.length||!report.performancePass)process.exitCode=1}
