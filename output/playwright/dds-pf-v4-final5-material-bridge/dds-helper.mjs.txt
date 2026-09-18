import { chromium } from 'playwright'
import { mkdir,writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const server=process.env.PF_CHECK_URL||'http://127.0.0.1:4179',base='/dds/supply-chain/production-fulfillment/'
const output=process.env.PF_CHECK_OUTPUT||'output/playwright/dds-pf-v4-final',quick=process.argv.includes('--quick'),iterations=quick?1:5,imageTaskPath='tasks/DEM-202603-0082'
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7)
await mkdir(output,{recursive:true})
const executedScript=await readFile(new URL(import.meta.url)),executedScriptHash=createHash('sha256').update(executedScript).digest('hex')
const browser=await chromium.launch({headless:true})
let context,page,cdp,caseName='',iteration=0,contextNumber=0,operationSequence=0,requestUrls=[]
const samples=[],errors=[],checks=[],omissions=[],evidence=[],requiredCases=new Map(),observedControls=new Map(),executedControls=new Map(),missingImageObjects=new Map()
function recordSample(sample){
 samples.push(sample)
 if(sample.ms>=200||sample.error)console.error('PERFORMANCE_FAIL '+JSON.stringify(sample))
}
const sections=['overview','tasks','follow-up','work-items','teams','fulfillment','configuration']
// Register key cases before execution: an early failure must not erase later unexecuted requirements.
const plannedCases=[
 ...sections.flatMap(section=>[section+'-cold',section+'-refresh',section+'-route',...(section==='configuration'?[]:[section+'-filters',section+'-search',section+'-date-boundary',...['follower','team','factory'].map(key=>section+'-'+key),...['health','scope','stage','region','supplyMode',...(section==='fulfillment'?[]:['dateField'])].map(key=>section+'-filter-'+key)])]),
 'task-cold','task-refresh','team-detail-cold','team-detail-refresh','work-drawer','image-preview','source-association-persist','followup-save',
 ...['全程时效','工作明细','数量批次','实际发货与订单','计算与版本','跟进记录'].map(tab=>'detail-'+tab),
 ...['依赖与卡点','生产准备','工艺路线','全程甘特'].map(tab=>'source-'+tab),
 ...['0.75','1','1.25'].map(value=>'dependency-zoom-'+value),...['卡点与影响','全部工作'].map(value=>'dependency-scope-'+value),
 'dependency-locate-bottleneck','source-number-core-summary','source-summary-escape','source-summary-backdrop','dependency-refresh-summary','dependency-route-summary','print-preview-cancel',
 ...['阶段与工作','任务规则映射','单据与事件','时效要求','组上限与依赖','责任规则','风险与数据','版本与发布'].map(tab=>'config-tab-'+tab),
 ...['完整实收事件','缺少物流批次关联','重复读取同一事件','只有采购入库事件'].map(value=>'config-mapping-'+value),
 'config-publish-missing-reason','config-publish-invalid-target-empty','config-publish-invalid-target-不存在的生产任务','config-group-limit-blocks-publication','config-new-tasks-only-publish','config-source-task-mapping-publish',
 'columns','pagination','sort','page-size','fullscreen',
]
plannedCases.forEach(name=>requiredCases.set(name,5))
const routeKey=path=>path.replace(/(\/tasks|\/teams)\/[^/]+$/, '$1/:id')
function controlKey(data){return data.action?'action:'+data.action+(data.value?'='+data.value:'')+(data.tab?'='+data.tab:'')+(data.zoom?'='+data.zoom:''):data.field?'field:'+data.field:data.tag==='SUMMARY'?'summary:'+data.label.replace(/（\d+ 条）/g,'（记录数）').replace(/\d+ 项待补/g,'N 项待补'):'key:'+data.key}
async function freshContext(navigationExpectations=[]){
  if(context)await context.close()
  context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true,serviceWorkers:'block'})
  contextNumber++
  await context.addInitScript(navigationExpectations=>{
    window.pfV4EventRecords=[];window.pfV4Expected=[]
    const matches=expectations=>expectations.every(item=>{
      const elements=[...document.querySelectorAll(item.selector)]
      if(item.absent)return elements.length===0
      return elements.some(el=>(!item.visible||el.getClientRects().length&&getComputedStyle(el).display!=='none')&&(!item.text||el.textContent.includes(item.text))&&(item.value===undefined||el.value===item.value)&&(!item.attr||el.getAttribute(item.attr[0])===item.attr[1]))
    })
    const ready=expectations=>{
      const app=document.querySelector('#pf-app'),content=app?.querySelector('#pf-content')
      const relative=location.pathname.split('/production-fulfillment/')[1]||'',section=relative.split('/')[0],detail=relative.split('/').length>1
      const target=section==='configuration'?'.pf-config-panel':section==='examples'?'.pf-example-content':section==='tasks'&&detail?'.pf-detail-heading':section==='overview'?'[data-pf-action="overview-tab"]':section==='teams'&&detail?'[data-pf-action="team-tab"]':section==='fulfillment'?'[data-pf-action="fulfillment-mode"]':'table'
      const targetReady=content?.querySelector(target)||section==='teams'&&detail&&content?.textContent.includes('团队暂无匹配记录')&&content.querySelector('a[href="/dds/supply-chain/production-fulfillment/teams"]')
      return app&&content?.children.length&&targetReady&&decodeURI(app.dataset.pfRoute)===decodeURI(location.pathname)&&matches(expectations)&&[...app.querySelectorAll('img')].filter(img=>img.getClientRects().length&&getComputedStyle(img).visibility!=='hidden').every(img=>img.complete&&(img.naturalWidth>0||expectations.some(item=>item.expectedImageFailure&&img.matches(item.expectedImageFailure))&&img.parentElement?.querySelector('.pf-image-error:not([hidden])')))
    }
    window.pfV4Settle=(start,label,expectations=[],extra={})=>new Promise(resolve=>{
      const finish=error=>resolve({label,ms:performance.now()-start,route:location.pathname,viewport:innerWidth+'×'+innerHeight,...extra,...(error?{error}:{})})
      const tick=()=>{
        if(performance.now()-start>10000){finish('目标内容、必要图片或预期状态未就绪');return}
        if(!ready(expectations)){requestAnimationFrame(tick);return}
        // The ready-check frame must paint before the next frame confirms usable content.
        requestAnimationFrame(()=>{if(!ready(expectations)){requestAnimationFrame(tick);return}finish()})
      };requestAnimationFrame(tick)
    })
    window.pfV4Navigation=window.pfV4Settle(0,'navigation',navigationExpectations)
    for(const type of ['click','input','change','keydown','drop'])document.addEventListener(type,event=>{
      if(!document.querySelector('#pf-app'))return
      if(type==='keydown'&&!['Escape','Enter'].includes(event.key))return
      const target=event.target instanceof Element?event.target:null
      const field=target?.closest('[data-pf-field]'),candidate=target?.closest('[data-pf-action]'),action=candidate&&['config-dialog','backdrop','config-close'].includes(candidate.dataset.pfAction)&&candidate.tagName!=='BUTTON'&&candidate!==target?null:candidate,routeLink=target?.closest('a[href^="/dds/supply-chain/production-fulfillment/"],[data-tab-href^="/dds/supply-chain/production-fulfillment/"]'),menu=target?.closest('[data-action="toggle-menu-item"][data-item-key="production-fulfillment"]')
      if(!action&&!field&&!routeLink&&!menu&&type!=='keydown'&&type!=='drop'&&target?.tagName!=='SUMMARY')return
      // event.timeStamp precedes dispatch; using handler-entry time would hide input queue delay.
      const start=event.timeStamp>1e12?event.timeStamp-performance.timeOrigin:event.timeStamp
      const details={type,eventStart:start,handlerStart:performance.now(),originRoute:location.pathname,action:action?.dataset.pfAction||(routeLink?'route-link':menu?'shell-toggle-menu':''),value:action?(action.dataset.value||''):routeLink?(routeLink.getAttribute('href')||routeLink.dataset.tabHref):'',tab:action?.dataset.configTab||'',zoom:action?.dataset.zoom||'',field:field?.dataset.pfField||'',tag:target?.tagName||'',key:event.key||'',label:target?.textContent?.trim().slice(0,60)||''}
      window.pfV4EventRecords.push(window.pfV4Settle(start,type+':'+(details.action||details.field||details.key||details.tag),window.pfV4Expected.slice(),details))
    },true)
  },navigationExpectations)
  page=await context.newPage();page.setDefaultTimeout(8000)
  requestUrls=[];page.on('request',request=>requestUrls.push(request.url()))
  page.on('pageerror',error=>errors.push({check:caseName,type:'pageerror',message:String(error)}))
  cdp=await context.newCDPSession(page);await cdp.send('Network.enable')
}
await freshContext()
async function inventory(){
  const controls=await page.evaluate(()=>[...document.querySelectorAll('#pf-app [data-pf-action],#pf-app [data-pf-field],#pf-app summary')].filter(el=>el.getClientRects().length&&!el.disabled).map(el=>({action:el.dataset.pfAction||'',value:el.dataset.value||'',tab:el.dataset.configTab||'',zoom:el.dataset.zoom||'',field:el.dataset.pfField||'',tag:el.tagName,label:el.textContent.trim().slice(0,60),path:el.getAttribute('href')||el.dataset.path||''})))
  for(const control of controls){if(['config-dialog','backdrop','config-close'].includes(control.action)&&control.tag!=='BUTTON')continue;const key=routeKey(new URL(page.url()).pathname)+'|'+controlKey(control);if(!observedControls.has(key))observedControls.set(key,{route:routeKey(new URL(page.url()).pathname),...control,key})}
  const missing=await page.locator('#pf-app .pf-missing-image').evaluateAll(els=>els.map(el=>({name:el.closest('.pf-object')?.querySelector('strong')?.textContent,code:el.closest('.pf-object')?.querySelector('small')?.textContent,label:el.parentElement?.textContent?.trim()||el.textContent,reason:el.textContent})))
  for(const object of missing){const route=new URL(page.url()).pathname,key=object.code+'|'+object.name;if(!missingImageObjects.has(key))missingImageObjects.set(key,{route,...object})}
}
async function begin(expect=[]){await page.evaluate(expected=>{window.pfV4Expected=expected},expect);return page.evaluate(()=>window.pfV4EventRecords.length)}
async function end(index,kind,selector){
  const results=await page.evaluate(async start=>Promise.all(window.pfV4EventRecords.slice(start)),index)
  assert(results.length,'missing event '+selector)
  const operation=++operationSequence,keys=new Set()
  for(const result of results){const item={...result,kind,selector,operation,case:caseName||'setup',iteration,context:contextNumber};recordSample(item);keys.add(routeKey(result.originRoute||result.route)+'|'+controlKey(result));assert(!result.error,result.error+' '+selector)}
  // input and change are separate timing samples from one user operation, not two coverage repetitions.
  for(const key of keys)executedControls.set(key,(executedControls.get(key)||0)+1)
  await inventory();return results.at(-1)
}
async function act(selector,kind='click',value,expect=[]){
  const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded()
  if(['fill','select'].includes(kind))expect=[...expect,{selector,value}]
  const index=await begin(expect)
  if(kind==='select')await target.selectOption(value)
  else if(kind==='fill')await target.fill(value)
  else if(kind==='check')await target.check()
  else if(kind==='uncheck')await target.uncheck()
  else await target.click()
  return end(index,kind,selector)
}
async function keypress(key,expect=[]){const index=await begin(expect);await page.keyboard.press(key);return end(index,'key',key)}
async function nav(path,label='refresh'){
  await page.goto(server+base+path);await page.waitForSelector('#pf-content')
  const result=await page.evaluate(()=>window.pfV4Navigation)
  if(process.argv.includes('--diagnose'))result.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,end:e.responseEnd,duration:e.duration,size:e.transferSize})))
  recordSample({...result,kind:label,case:caseName||'setup',iteration,context:contextNumber,cache:label==='cold'?'new isolated context + browser HTTP cache cleared':'same isolated context; browser cache retained'})
  assert(!result.error,result.error);await inventory();return result
}
async function cold(path){await freshContext();await cdp.send('Network.clearBrowserCache');return nav(path,'cold')}
async function repeat(name,fn){requiredCases.set(name,5);const previous=caseName;caseName=name;try{for(let i=0;i<iterations;i++){iteration=i+1;await fn(i)}}finally{caseName=previous}}
async function check(name,fn){
  if(only&&!name.includes(only)){omissions.push({check:name,reason:'--only diagnostic selection'});return}
  try{await fn();checks.push(name);console.log('PASS',name)}catch(error){errors.push({check:name,type:'functional',message:String(error)});console.error('FAIL',name,error);await page.screenshot({path:output+'/failure-'+errors.length+'-'+name.replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,40)+'.png'}).catch(()=>{})}
}
async function layout(){assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false,'page horizontal overflow');assert.equal(await page.locator('[data-pf-field="role"],[data-pf-field="timezone"],.pf-mock-label').count(),0);if(await page.locator('.pf-filter-fields').count()){
const r=await page.locator('.pf-query-card').evaluate(card=>{const fields=[...card.querySelectorAll('.pf-filter-fields>.pf-field')].map(e=>e.getBoundingClientRect());return{widths:fields.map(r=>r.width),bottom:Math.max(...fields.map(r=>r.bottom)),actions:card.querySelector('.pf-filter-actions').getBoundingClientRect().top,labels:[...card.querySelectorAll('.pf-filter-fields>.pf-field>span:first-child')].slice(0,4).map(e=>e.textContent)}});assert(r.actions>=r.bottom);assert(Math.max(...r.widths)-Math.min(...r.widths)<1);assert.deepEqual(r.labels,['任务 / 需求 / 采购 / 生产单 / 款号','跟单','责任团队','责任工厂'])}}
async function routeTo(path){
 const selector=`a[href="${base+path}"]:visible,[data-action="open-tab"][data-tab-href="${base+path}"]:visible`
 if(!await page.locator(selector).count())await act('[data-action="toggle-menu-item"][data-item-key="production-fulfillment"]','click',undefined,[{selector:`[data-tab-href="${base+path}"]`}])
 return act(selector,'click',undefined,[{selector:'#pf-app',attr:['data-pf-route',base+path]}])
}
async function configTab(value){return act(`[data-pf-action="config-tab"][data-config-tab="${value}"]`,'click',undefined,[{selector:'.pf-config-panel',attr:['aria-label',value]}])}
async function closeConfig(){return act('.pf-config-dialog header [data-pf-action="config-close"]','click',undefined,[{selector:'.pf-config-dialog',absent:true}])}
async function closeWork(){return act('#pf-overlays [data-pf-action="close"]','click',undefined,[{selector:'#pf-overlays [role="dialog"]',absent:true}])}
async function exerciseFields(container,prefix){
 const fields=await page.locator(`${container} [data-pf-field]:enabled`).evaluateAll(els=>els.filter(el=>!el.readOnly).map(el=>({field:el.dataset.pfField,value:el.value,type:el.type,tag:el.tagName,options:el.tagName==='SELECT'?[...el.options].map(option=>option.value):[]})))
 for(const item of fields)await repeat(prefix+'-'+item.field,async()=>{
  const selector=`${container} [data-pf-field="${item.field}"]`
  if(item.tag==='SELECT'){await act(selector,'select',item.options.find(value=>value!==item.value)??item.value);await act(selector,'select',item.value)}
  else {const alternate=item.type==='number'?String((Number(item.value)||0)+1):item.type==='date'?(item.value==='2099-01-01'?'2099-01-02':'2099-01-01'):item.type==='datetime-local'?(item.value==='2099-01-01T12:00'?'2099-01-02T12:00':'2099-01-01T12:00'):item.value+' V4临时输入';await act(selector,'fill',alternate);await act(selector,'fill',item.value)}
 })
}
async function exerciseImages(prefix){
 if(!await page.locator('#pf-content [data-pf-action="image"]').count())return
 await repeat(prefix+'-image-all-close-modes',async()=>{
  for(const mode of ['button','escape','backdrop']){
   await act('#pf-content [data-pf-action="image"]','click',undefined,[{selector:'.pf-image-modal img'}])
   if(mode==='button')await closeWork()
   else if(mode==='escape')await keypress('Escape',[{selector:'.pf-image-modal',absent:true}])
   else {const index=await begin([{selector:'.pf-image-modal',absent:true}]);await page.locator('.pf-overlay-backdrop').click({position:{x:2,y:2}});await end(index,'click','image backdrop')}
  }
 })
}
async function exerciseSummaries(prefix){
 const labels=await page.locator('#pf-content summary').allTextContents()
 for(let index=0;index<labels.length;index++)await repeat(prefix+'-summary-'+index,async()=>{
  const selector=`#pf-content summary >> nth=${index}`,before=await page.locator(selector).evaluate(el=>el.parentElement.open),requestStart=requestUrls.length
  await act(selector);assert.equal(await page.locator(selector).evaluate(el=>el.parentElement.open),!before,'native details must toggle');await act(selector);assert.equal(await page.locator(selector).evaluate(el=>el.parentElement.open),before)
  const added=requestUrls.slice(requestStart),unrelated=added.filter(url=>/\/(?:fcs|pcs|pda)-handlers[-.]/.test(url));assert.deepEqual(unrelated,[],'DDS native details must not load unrelated system handlers');evidence.push({kind:'native-summary-network',route:new URL(page.url()).pathname,label:labels[index],iteration,newRequests:added})
 })
}
async function exerciseTable(prefix){
 const id=await page.locator('[data-pf-table]').first().getAttribute('data-pf-table').catch(()=>null)
 if(!id)return
 const table=`[data-pf-table="${id}"]`
 if(await page.locator(`${table} [data-pf-action="columns"]`).count()){
  await repeat(prefix+'-columns-all-settings',async()=>{
   await act(`${table} [data-pf-action="columns"]`)
   for(const action of ['toggle-column-visibility','toggle-column-freeze','column-up']){
    const selector=`#pf-overlays [data-pf-action="${action}"]:enabled`
    if(await page.locator(selector).count()){await act(selector);await act('#pf-overlays [data-pf-action="restore-column-settings"]')}
   }
   const drags=page.locator('#pf-overlays [data-standard-list-column-drag]')
   if(await drags.count()>1){
    const before=await drags.evaluateAll(els=>els.map(el=>el.dataset.pfColumnKey)),index=await begin()
    await drags.nth(0).dragTo(drags.nth(1));await end(index,'drop','column-order-drag')
    const after=await page.locator('#pf-overlays [data-standard-list-column-drag]').evaluateAll(els=>els.map(el=>el.dataset.pfColumnKey));assert.notDeepEqual(after,before,'drag must persist a changed column order');await act('#pf-overlays [data-pf-action="restore-column-settings"]')
   }
   await act('#pf-overlays [data-pf-action="close-column-settings"]')
  })
 }
 if(await page.locator(`${table} [data-pf-action="sort-column"]`).count())await repeat(prefix+'-table-sort',()=>act(`${table} [data-pf-action="sort-column"]`))
 if(await page.locator(`${table} [data-pf-field="pageSize"]`).count()){
  await repeat(prefix+'-table-page-sizes',async()=>{for(const value of ['10','50','20'])await act(`${table} [data-pf-field="pageSize"]`,'select',value)})
  await act(`${table} [data-pf-field="pageSize"]`,'select','10')
  if(await page.locator(`${table} [data-pf-action="next-page"]:enabled`).count())await repeat(prefix+'-table-pagination',async()=>{await act(`${table} [data-pf-action="next-page"]:enabled`);await act(`${table} [data-pf-action="prev-page"]:enabled`)})
  await act(`${table} [data-pf-field="pageSize"]`,'select','20')
 }
}
async function issueRecord(id){return page.evaluate(issueId=>JSON.parse(localStorage.getItem('dds-pf-data-issues-v1')||'{"issues":[]}').issues.find(issue=>issue.id===issueId),id)}
async function openIssue(id){
 const selector=`[data-pf-action="data-issue-open"][data-issue-id="${id}"]`,table='[data-pf-table="pf-overview-data-issues"]'
 if(!await page.locator(selector).count())await act(`${table} [data-pf-field="pageSize"]`,'select','50')
 for(let i=0;i<30&&!await page.locator(selector).count();i++){assert(await page.locator(`${table} [data-pf-action="next-page"]:enabled`).count(),'target issue must be in current visible scope');await act(`${table} [data-pf-action="next-page"]:enabled`)}
 await act(selector,'click',undefined,[{selector:'#pf-overlays [role="dialog"]',text:id}])
}
async function registerIssue(id,note='V4隔离验收：仅登记安排，等待来源核对'){
 await openIssue(id)
 for(const [field,value] of [['owner','V4时效核验人'],['team','跟单核验团队'],['dueAt','2099-01-01T12:00'],['note',note]])await act(`[data-pf-field="data-issue-${field}"]`,'fill',value)
 await act('[data-pf-action="data-issue-save"]','click',undefined,[{selector:'#pf-overlays [role="dialog"]',absent:true},{selector:'#pf-notice',text:'事项仍待来源确认'}])
 const issue=await issueRecord(id);assert.equal(issue.owner,'V4时效核验人');assert.equal(issue.status,'待处理');assert.equal(issue.dueAt,'2099-01-01T12:00:00+08:00');return issue
}
async function exerciseFullscreen(prefix){await repeat(prefix+'-fullscreen',async()=>{await act('[data-pf-action="fullscreen"]');assert(await page.locator('#pf-app.pf-fullscreen').count());await act('[data-pf-action="fullscreen"]');assert.equal(await page.locator('#pf-app.pf-fullscreen').count(),0)})}
async function graphEvidence(label,requireEdges=true){
  const graph=await page.locator('.pf-dependency-scroll').evaluate(scroll=>{
    const nodes=[...scroll.querySelectorAll('[data-flow-node]')].map(el=>({id:el.dataset.flowNode,left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight,status:el.querySelector('em')?.textContent,document:el.querySelector('.pf-flow-node-doc')?.textContent}))
    const edges=[...scroll.querySelectorAll('path[data-dependency-from][data-dependency-to]')].map(el=>{const length=el.getTotalLength(),start=el.getPointAtLength(0),end=el.getPointAtLength(length),marker=el.getAttribute('marker-end');return{from:el.dataset.dependencyFrom,to:el.dataset.dependencyTo,length,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},marker,markerExists:!!scroll.querySelector(marker?.replace('url(','').replace(')','')||'missing'),description:el.querySelector('title')?.textContent}})
    return{nodes,edges,zoom:scroll.querySelector('.pf-dependency-canvas')?.style.transform}
  })
  assert(graph.nodes.length,'dependency graph must contain real work cards')
  if(requireEdges)assert(graph.edges.length,'connected execution scenario must show SVG dependency arrows')
  for(const edge of graph.edges){const from=graph.nodes.find(n=>n.id===edge.from),to=graph.nodes.find(n=>n.id===edge.to);assert(from&&to,'edge endpoints must be displayed work items');assert(edge.length>0&&edge.markerExists&&edge.description,'arrow must have geometry, marker and business description');assert(to.left>from.left,'arrow must go from earlier dependency rank to later rank');assert(Math.abs(edge.start.x-(from.left+from.width))<2&&Math.abs(edge.start.y-(from.top+from.height/2))<2,'arrow start must join predecessor card');assert(Math.abs(edge.end.x-(to.left-7))<2&&Math.abs(edge.end.y-(to.top+to.height/2))<2,'arrow end must point to successor card')}
  evidence.push({kind:'dependency-geometry',label,route:new URL(page.url()).pathname,...graph});return graph
}
let taskPath='tasks/DEM-202603-0005',teamPath=''
try{
 if(process.argv.includes('--profile')){
 const profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');await nav('overview','profile');const result=await profiler.send('Profiler.stop');await writeFile(output+'/cpu-profile.json',JSON.stringify(result.profile));console.log(result.profile.nodes.sort((a,b)=>(b.hitCount||0)-(a.hitCount||0)).slice(0,25).map(n=>({fn:n.callFrame.functionName,url:n.callFrame.url.split('/').pop(),line:n.callFrame.lineNumber,col:n.callFrame.columnNumber,hits:n.hitCount})));}
 for(const section of sections)await check('七菜单冷进入与刷新、筛选结构：'+section,async()=>{
   await repeat(section+'-cold',async()=>{await cold(section);await layout()})
   await repeat(section+'-refresh',()=>nav(section,'refresh'))
   if(section==='configuration'){await page.screenshot({path:output+'/configuration-1366.png'});return}
   await repeat(section+'-filters',async()=>{await act('[data-pf-action="more"]');await layout();await act('[data-pf-action="more"]');await layout()})
   for(const key of ['follower','team','factory'])await repeat(section+'-'+key,async()=>{const options=await page.locator(`[data-pf-field="${key}"] option`).evaluateAll(es=>es.map(e=>e.value));if(options.length>1)await act(`[data-pf-field="${key}"]`,'select',options[1]);await act('[data-pf-action="query"]');await act('[data-pf-action="reset"]')})
   await repeat(section+'-search',async()=>{await act('[data-pf-field="query"]','fill','不匹配的检索');await act('[data-pf-action="query"]');await act('[data-pf-action="export"]');await act('[data-pf-action="reset"]')})
   if(section==='tasks'){taskPath=(await page.locator('a[href*="/tasks/"]').first().getAttribute('href')).replace(base,'');assert(!taskPath.includes('MOCK-PT'));await repeat('task-export',async()=>{const download=page.waitForEvent('download');await act('[data-pf-action="export"]');await(await download).saveAs(output+'/tasks.csv')})}
   if(section==='teams')teamPath=(await page.locator('a[href*="/teams/"]').first().getAttribute('href')).replace(base,'')
   await page.screenshot({path:output+'/'+section+'-1366.png'})
 })
 {
 await check('七菜单站内切换及筛选范围',async()=>{
  await nav('overview')
  for(const section of sections)await repeat(section+'-route',async()=>{
   const other=section==='overview'?'tasks':'overview'
   await routeTo(other);await routeTo(section);await layout()
  })
  for(const section of sections.filter(item=>item!=='configuration')){
   await nav(section);await act('[data-pf-action="more"]')
   for(const key of ['health','scope','stage','region','supplyMode',...(section==='fulfillment'?[]:['dateField'])])await repeat(section+'-filter-'+key,async()=>{
    const options=await page.locator(`[data-pf-field="${key}"] option`).evaluateAll(es=>es.map(e=>e.value));assert(options.length,`missing filter ${section}/${key}`)
    await act(`[data-pf-field="${key}"]`,'select',options.at(-1));await act('[data-pf-action="query"]');await act('[data-pf-action="reset"]')
   })
   await repeat(section+'-date-boundary',async()=>{
    await act('[data-pf-field="dateFrom"]','fill','2099-01-01');await act('[data-pf-field="dateTo"]','fill','2099-01-02');await act('[data-pf-action="query"]');await act('[data-pf-action="export"]');assert(await page.locator('#pf-notice').textContent());await act('[data-pf-action="reset"]')
   })
  }
 })
 await check('总览各视图及团队队列',async()=>{
  await nav('overview');for(const value of ['运行概况','分布分析','数据待补'])await repeat('overview-'+value,()=>act(`[data-pf-action="overview-tab"][data-value="${value}"]`))
  await act('[data-pf-action="overview-tab"][data-value="分布分析"]');for(const value of ['分布','交付表现'])await repeat('analysis-'+value,()=>act('[data-pf-field="analysis-view"]','select',value))
  if(!teamPath){await nav('teams');teamPath=(await page.locator('a[href*="/teams/"]').first().getAttribute('href')).replace(base,'')}
  await repeat('team-detail-cold',()=>cold(teamPath));await repeat('team-detail-refresh',()=>nav(teamPath))
  await nav(teamPath);for(const value of ['可执行工作','需要协调','交付记录'])await repeat('team-'+value,()=>act(`[data-pf-action="team-tab"][data-value="${value}"]`))
  await nav('fulfillment');for(const value of ['发货行','完整订单','时钟对照'])await repeat('fulfillment-'+value,()=>act(`[data-pf-action="fulfillment-mode"][data-value="${value}"]`))
 })
 await check('真实依赖箭头、卡点定位与单据摘要',async()=>{
  const path='tasks/DEM-202603-0005';await nav(path)
  assert.equal(await page.locator('[data-pf-action="detail-subtab"][data-value="依赖与卡点"][aria-selected="true"]').count(),1,'fresh task must default to dependency and bottlenecks')
  const all=await graphEvidence('默认全部工作')
  for(const value of ['0.75','1','1.25'])await repeat('dependency-zoom-'+value,async()=>{
   await act(`[data-pf-action="dependency-zoom"][data-zoom="${value}"]`,'click',undefined,[{selector:`[data-pf-action="dependency-zoom"][data-zoom="${value}"]`,attr:['aria-pressed','true']}]);assert.equal(await page.locator('.pf-dependency-canvas').evaluate(el=>Number(el.style.transform.match(/scale\(([^)]+)\)/)[1])),Number(value))
  })
  await act('[data-pf-action="dependency-zoom"][data-zoom="1"]')
  for(const value of ['卡点与影响','全部工作'])await repeat('dependency-scope-'+value,async()=>{
   const expectations=value==='全部工作'?[{selector:'.pf-flow-node'}]:[]
   await act(`[data-pf-action="dependency-scope"][data-value="${value}"]`,'click',undefined,expectations)
   const count=await page.locator('.pf-flow-node').count();assert(count<=all.nodes.length)
   if(count)await graphEvidence(value,false)
   else assert((await page.locator('.pf-source-empty').textContent()).includes('尚无可确认的执行卡点'))
   if(value==='卡点与影响')await act('[data-pf-action="dependency-scope"][data-value="全部工作"]')
  })
  assert(await page.locator('[data-pf-action="locate-bottleneck"]:enabled').count(),'execution scenario must expose an actionable bottleneck')
  await repeat('dependency-locate-bottleneck',async()=>{
   await act('[data-pf-action="locate-bottleneck"]:enabled','click',undefined,[{selector:'.pf-flow-node.is-selected'}])
   const location=await page.locator('.pf-flow-node.is-selected').evaluate(el=>{const node=el.getBoundingClientRect(),viewport=el.closest('.pf-dependency-scroll').getBoundingClientRect();return{id:el.dataset.flowNode,focused:document.activeElement===el,visible:node.left>=viewport.left&&node.right<=viewport.right&&node.top>=viewport.top&&node.bottom<=viewport.bottom}})
   assert(location.focused&&location.visible,'locating bottleneck must scroll and focus the actual work');evidence.push({kind:'located-bottleneck',...location})
  })
  await page.screenshot({path:output+'/dependency-bottleneck-1366.png'})
  const blockerNodes=await page.locator('.pf-flow-node.pf-flow-blocked').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.flowNode,documentNo:node.querySelector('.pf-flow-node-doc').textContent})))
  assert(blockerNodes.length,'a concrete blocker must expose its own source document')
  for(const blocker of blockerNodes)await repeat('blocker-document-summary-'+blocker.id,async i=>{
   await act(`.pf-flow-node[data-flow-node="${blocker.id}"]`,'click',undefined,[{selector:'.pf-document-header',text:blocker.documentNo},{selector:'.pf-work-impact',text:'具体卡点'}])
   assert(await page.locator('.pf-document-summary dt').count()>=3)
   const fields=await page.locator('.pf-document-summary').textContent(),impact=await page.locator('.pf-work-impact').textContent()
   evidence.push({kind:'concrete-blocker-document-summary',...blocker,fields,impact})
   if(i===0)await page.screenshot({path:output+'/blocker-summary-'+blocker.id.replace(/[^a-z0-9-]/gi,'_')+'.png'})
   await closeWork()
  })
  const sourceNode=await page.locator('.pf-flow-node').evaluateAll(nodes=>nodes.find(node=>node.querySelector('.pf-flow-node-doc').textContent&&!node.querySelector('.pf-flow-node-doc').textContent.includes('尚未关联'))?.dataset.flowNode)
  assert(sourceNode,'execution scenario has source-backed work')
  const sourceSelector=`.pf-flow-node[data-flow-node="${sourceNode}"] .pf-flow-node-doc`
  await repeat('source-number-core-summary',async i=>{
   const documentNo=await page.locator(sourceSelector).textContent()
   await act(sourceSelector,'click',undefined,[{selector:'[role="dialog"][aria-label="工作项与单据摘要"]'},{selector:'[data-pf-action="work-tab"][data-value="单据简要信息"][aria-selected="true"]'},{selector:'.pf-document-header',text:documentNo}])
   assert(await page.locator('.pf-document-summary dt').count()>=3,'summary needs real source facts')
   const fields=await page.locator('.pf-document-summary').textContent();assert(fields.trim(),'document fields must be readable')
   const href=await page.locator('.pf-source-document-link a').getAttribute('href');assert(href?.startsWith('/')&&!href.startsWith(base),'source must link to the existing business document module')
   evidence.push({kind:'document-summary',documentNo,fields,href})
   if(i===0)await page.screenshot({path:output+'/document-summary-1366.png'})
   for(const value of ['时效与数量','前后依赖','来源证据','单据简要信息'])await act(`[data-pf-action="work-tab"][data-value="${value}"]`,'click',undefined,[{selector:`[data-pf-action="work-tab"][data-value="${value}"]`,attr:['aria-selected','true']}])
   await closeWork()
  })
  await repeat('source-summary-escape',async()=>{await act(sourceSelector);await keypress('Escape',[{selector:'#pf-overlays [role="dialog"]',absent:true}])})
  await repeat('source-summary-backdrop',async()=>{await act(sourceSelector);const index=await begin([{selector:'#pf-overlays [role="dialog"]',absent:true}]);await page.locator('.pf-overlay-backdrop').click({position:{x:2,y:2}});await end(index,'click','backdrop outside work summary')})
  await repeat('dependency-refresh-summary',async()=>{await nav(path);assert(await page.locator('.pf-flow-node').count());await act(sourceSelector,'click',undefined,[{selector:'.pf-document-summary'}]);await closeWork()})
  await repeat('dependency-route-summary',async()=>{await routeTo('tasks');await act('[data-pf-field="query"]','fill',path.split('/').pop());await act('[data-pf-action="query"]');await routeTo(path);await act('[data-pf-action="detail-tab"][data-value="全程时效"]');await act('[data-pf-action="detail-subtab"][data-value="依赖与卡点"]');await act(sourceSelector,'click',undefined,[{selector:'.pf-document-summary'}]);await closeWork()})
  await repeat('print-preview-cancel',async()=>{
   await act('[data-pf-action="print-task"]','click',undefined,[{selector:'[role="dialog"][aria-label="任务摘要打印预览"]'},{selector:'.pf-print-summary',text:path.split('/').pop()}])
   const text=await page.locator('.pf-print-summary').textContent();for(const label of ['读取于','规则版本','范围：当前任务','已发','卡点'])assert(text.includes(label),`print summary missing ${label}`)
   await closeWork();await act('[data-pf-action="print-task"]');await keypress('Escape',[{selector:'#pf-overlays [role="dialog"]',absent:true}])
  })
 })
 await check('任务来源、准备与工艺路线、工作明细',async()=>{
  await repeat('task-cold',async()=>{await cold(taskPath)})
  await repeat('task-refresh',()=>nav(taskPath))
  for(const tab of ['全程时效','工作明细','数量批次','实际发货与订单','计算与版本','跟进记录'])await repeat('detail-'+tab,()=>act(`[data-pf-action="detail-tab"][data-value="${tab}"]`))
  await act('[data-pf-action="detail-tab"][data-value="全程时效"]')
  for(const value of ['依赖与卡点','生产准备','工艺路线','全程甘特'])await repeat('source-'+value,()=>act(`[data-pf-action="detail-subtab"][data-value="${value}"]`))
  await act('[data-pf-action="detail-subtab"][data-value="工艺路线"]');await page.screenshot({path:output+'/route-1366.png'});await act('[data-pf-action="detail-subtab"][data-value="全程甘特"]');await page.screenshot({path:output+'/timeline-1366.png'})
  for(const action of ['expand-all','collapse-all','toggle-dependencies','toggle-children','fit-timeline'])await repeat('timeline-'+action,()=>act(`[data-pf-action="${action}"]`))
  for(const [key,values] of [['timeline-mode',['全部工作','风险工作','关键路径']],['timeline-basis',['原始基线','当前标准']],['timeline-scale',['小时','日']]])for(const value of values)await repeat(key+value,()=>act(`[data-pf-field="${key}"]`,'select',value))
  await act('[data-pf-field="timeline-mode"]','select','全部工作');await act('[data-pf-action="expand-all"]')
  await repeat('source-association-persist',async()=>{await act('[data-pf-action="bind-sources"]');await act('[data-pf-action="save-sources"]');assert.equal(await page.locator('#pf-overlays [role="dialog"]').count(),0);assert(await page.evaluate(id=>Object.hasOwn(JSON.parse(localStorage.getItem('dds-production-fulfillment-source-bindings-v1')||'{}'),id),taskPath.split('/').pop()))})
  await act('[data-pf-action="detail-tab"][data-value="工作明细"]');assert.equal(await page.getByText('本任务工作项',{exact:false}).count(),0)
  const alignment=await page.evaluate(()=>{const tabs=document.querySelector('[aria-label="任务详情视图"]').getBoundingClientRect();const table=document.querySelector('#pf-content table').getBoundingClientRect();return Math.abs(tabs.left-table.left)});assert(alignment<=2,'embedded table alignment '+alignment)
  await page.screenshot({path:output+'/work-detail-1366.png'})
  await repeat('work-drawer',async()=>{await act('[data-pf-action="open-node"]','click',undefined,[{selector:'[role="dialog"][aria-label="工作项与单据摘要"]'},{selector:'[data-pf-action="work-tab"][data-value="单据简要信息"][aria-selected="true"]'}]);for(const value of ['单据简要信息','时效与数量','前后依赖','来源证据'])await act(`[data-pf-action="work-tab"][data-value="${value}"]`);await act('#pf-overlays [data-pf-action="close"]')})
  await nav(imageTaskPath);await repeat('image-preview',async()=>{await act('[data-pf-action="image"]');await act('#pf-overlays [data-pf-action="close"]')});await nav(taskPath)
  await act('[data-pf-action="detail-tab"][data-value="计算与版本"]');for(const value of ['整体公式','逐项倒排','版本记录'])await repeat('formula-'+value,()=>act(`[data-pf-action="detail-subtab"][data-value="${value}"]`))
  await act('[data-pf-action="detail-tab"][data-value="跟进记录"]');await repeat('followup-save',async()=>{await act('[data-pf-action="followup"]');await act('[name="reason"]','fill','来源需补齐');await act('[name="action"]','fill','核对当前专业任务');await act('[data-pf-action="save-followup"]')})
 })
 await check('规则配置分区及弹窗层级',async()=>{
  await nav('configuration');for(const value of ['阶段与工作','任务规则映射','单据与事件','时效要求','组上限与依赖','责任规则','风险与数据','版本与发布'])await repeat('config-tab-'+value,()=>act(`[data-pf-action="config-tab"][data-config-tab="${value}"]`))
  for(const [tab,action] of [['阶段与工作','config-edit-stage'],['阶段与工作','config-select-work'],['单据与事件','config-select-mapping'],['时效要求','config-select-rule'],['责任规则','config-select-owner']]){await act(`[data-pf-action="config-tab"][data-config-tab="${tab}"]`);await repeat(action,async()=>{await act(`[data-pf-action="${action}"]`);await act('.pf-config-dialog header [data-pf-action="config-close"]')})}
  await act('[data-pf-action="config-tab"][data-config-tab="版本与发布"]');
  for(const action of ['config-validate','config-preview','config-history'])await repeat(action,async()=>{await act(`[data-pf-action="${action}"]`);await act('.pf-config-dialog header [data-pf-action="config-close"]')})
  await repeat('config-save',()=>act('[data-pf-action="config-save"]'));await page.screenshot({path:output+'/configuration-publishing-1366.png'})
 })
 await check('配置事件匹配、规则试算与发布边界',async()=>{
  await nav('configuration');await configTab('单据与事件')
  await act('[data-pf-action="config-select-mapping"][data-config-id="MAP-TRANSFER"]')
  await act('.pf-config-dialog [data-pf-action="config-open-mapping-test"]')
  for(const [value,result] of [['完整实收事件','命中'],['缺少物流批次关联','未命中'],['重复读取同一事件','重复事件'],['只有采购入库事件','未命中']])await repeat('config-mapping-'+value,async()=>{await act('[data-pf-field="config-mappingCase"]','select',value);await act('[data-pf-action="config-match-mapping"]','click',undefined,[{selector:'.pf-config-result',text:result}]);assert((await page.locator('.pf-config-result').textContent()).includes(result))})
  await closeConfig();await configTab('时效要求');await act('[data-pf-action="config-open-rule-test"]')
  for(const [value,result] of [['CN','命中'],['待确定','未命中']])await repeat('config-rule-region-'+value,async()=>{await act('[data-pf-field="config-sample-region"]','select',value);await act('[data-pf-action="config-match"]','click',undefined,[{selector:'.pf-config-result',text:result}])})
  await repeat('config-rule-invalid-quantity',async()=>{await act('[data-pf-field="config-sample-quantity"]','fill','-1');await act('[data-pf-action="config-match"]','click',undefined,[{selector:'.pf-config-result',text:'输入无效'}]);await act('[data-pf-field="config-sample-quantity"]','fill','1000')})
  await closeConfig();await configTab('版本与发布')
  await repeat('config-publish-missing-reason',async()=>{
   await act('[data-pf-field="config-publish-reason"]','fill','');await act('[data-pf-action="config-preview"]','click',undefined,[{selector:'.pf-config-dialog',text:'必须填写变更依据或原因'}]);assert(await page.locator('[data-pf-action="config-publish"]').isDisabled());await closeConfig();await act('[data-pf-field="config-publish-reason"]','fill','V4 验收：仅修改隔离浏览器的本地规则草稿')
  })
  await act('[data-pf-field="config-publish-scope"]','select','选定在途任务本地重算并发布')
  for(const [value,result] of [['','请选择要重算'],['不存在的生产任务','不存在或不是可重算的在途任务']])await repeat('config-publish-invalid-target-'+(value||'empty'),async()=>{
   // Alternate through a nonempty value so every fill dispatches a real input event.
   if(!value)await act('[data-pf-field="config-publish-taskIds"]','fill','临时边界输入')
   await act('[data-pf-field="config-publish-taskIds"]','fill',value);await act('[data-pf-action="config-preview"]','click',undefined,[{selector:'.pf-config-dialog',text:result}]);assert(await page.locator('[data-pf-action="config-publish"]').isDisabled());await closeConfig()
  })
  await act('[data-pf-field="config-publish-scope"]','select','仅新任务')
  await configTab('组上限与依赖')
  await repeat('config-group-limit-blocks-publication',async()=>{
   await act('[data-pf-action="config-select-dependency"][data-config-id="DEP-DYE"]');const original=await page.locator('[data-pf-field="config-dependency-days"]').inputValue();await act('[data-pf-field="config-dependency-days"]','fill','20');await closeConfig();await act('[data-pf-action="config-preview"]');assert(await page.locator('[data-pf-action="config-publish"]').isDisabled());const message=await page.locator('.pf-config-dialog').textContent();assert(message.includes('上限'),'network duration may not be silently clipped');await closeConfig();await act('[data-pf-action="config-select-dependency"][data-config-id="DEP-DYE"]');await act('[data-pf-field="config-dependency-days"]','fill',original);await closeConfig()
  })
  await configTab('版本与发布')
  await repeat('config-new-tasks-only-publish',async i=>{
   const reason='V4 隔离验收版本 '+i+' '+Date.now();await act('[data-pf-field="config-publish-reason"]','fill',reason)
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('dds-production-fulfillment-config-mock-v1')||'{"versions":[],"publishedTaskOverrides":[]}'))
   await act('[data-pf-action="config-preview"]','click',undefined,[{selector:'.pf-config-dialog',text:'仅新任务生效'}]);assert(await page.locator('[data-pf-action="config-publish"]').isEnabled())
   await act('[data-pf-action="config-publish"]','click',undefined,[{selector:'.pf-config-dialog',attr:['aria-label','规则版本历史']},{selector:'.pf-config-dialog',text:reason}])
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('dds-production-fulfillment-config-mock-v1')))
   assert.equal(after.versions.length,(before.versions?.length||0)+1);assert.deepEqual(after.publishedTaskOverrides||[],before.publishedTaskOverrides||[]);assert.equal(after.versions.at(-1).reason,reason);assert.deepEqual(after.versions.at(-1).affectedIds,[])
   evidence.push({kind:'local-publication',version:after.versions.at(-1).version,scope:after.versions.at(-1).scope,affectedIds:after.versions.at(-1).affectedIds})
   await act('[data-pf-action="config-load-history"]','click',undefined,[{selector:'.pf-config-dialog',text:'保存的规则快照'}]);await closeConfig()
  })
  await nav('configuration');await configTab('版本与发布');await act('[data-pf-action="config-history"]');assert((await page.locator('.pf-config-dialog').textContent()).includes('V4 隔离验收版本'));await closeConfig()
 })
 await check('真实来源任务单项映射与发布、不伪造整体截止',async()=>{
  const taskId='DEM-202603-0004',nodeId=taskId+':production-order'
  await repeat('config-source-task-mapping-publish',async i=>{
   // Each sample is a separate local browser draft; no repeated-rule conflicts or user storage changes.
   await cold('overview');await act('[data-pf-field="query"]','fill',taskId);await act('[data-pf-action="query"]');await act('[data-pf-action="overview-tab"][data-value="数据待补"]')
   const issueId=`DI/${encodeURIComponent(taskId)}/${encodeURIComponent(nodeId)}/work-sla`
   await registerIssue(issueId);const initialIssue=await issueRecord(issueId)
   await nav('overview');await act('[data-pf-action="overview-tab"][data-value="数据待补"]');assert.equal((await issueRecord(issueId)).firstDetectedAt,initialIssue.firstDetectedAt,'refresh preserves issue identity and discovery time')
   await nav('configuration');await configTab('任务规则映射');await act('[data-pf-field="config-mappingTask"]','select',taskId);await act('[data-pf-action="config-load-task-mappings"]')
   await act(`[data-pf-action="config-select-task-mapping"][data-config-id="${taskId}:preparation-binding"]`);await act('[data-pf-field="config-taskmap-work"]','select','ACT-S04-02');await act('[data-pf-action="config-save-task-mapping"]','click',undefined,[{selector:'.pf-config-result',text:'规则数量须来自当前工作已知的来源数量'}]);await closeConfig()
   await act(`[data-pf-action="config-select-task-mapping"][data-config-id="${nodeId}"]`)
   await act('[data-pf-action="config-save-task-mapping"]');assert((await page.locator('.pf-config-result').textContent()).length,'incomplete mapping must explain its missing facts')
   for(const [key,value,kind] of [['work','ACT-S04-02','select'],['startEvent','必要输入就绪','fill'],['endEvent','生产单有效','fill'],['startAnchor','actualReadyAt','select'],['endAnchor','actualEndAt','select'],['region','不适用','select'],['supplyMode','不适用','select'],['process','不适用','select'],['route','已确认技术资料→生产单','fill'],['unit','项','fill'],['source','本地规则演示；不代表正式批准。V4-'+i,'fill']])await act(`[data-pf-field="config-taskmap-${key}"]`,kind,value)
   await act('[data-pf-field="config-taskmap-startAnchor"]','select','');await act('[data-pf-action="config-save-task-mapping"]','click',undefined,[{selector:'.pf-config-result',text:'须明确选择起点时间字段与实际结束字段'}]);await act('[data-pf-field="config-taskmap-startAnchor"]','select','actualReadyAt')
   await act('[data-pf-action="config-save-task-mapping"]','click',undefined,[{selector:'.pf-config-result',text:'尚未改变任何预算'}])
   let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dds-production-fulfillment-config-mock-v1')))
   assert(saved.draft.taskWorkMappings.some(item=>item.taskId===taskId&&item.nodeId===nodeId));assert.equal(saved.publishedTaskOverrides.length,0)
   await act('[data-pf-action="config-create-mapped-rule"]');assert.equal(await page.locator('[data-pf-field="config-rule-days"]').inputValue(),'','new single-work standard must not be invented')
   const ruleId=(await page.locator('.pf-config-dialog').getAttribute('aria-label')).split(' · ').at(-1)
   await closeConfig();await configTab('任务规则映射');await act('[data-pf-action="config-preview-mapping-task"]');assert(await page.locator('[data-pf-action="config-publish"]').isDisabled(),'missing budget must block publish');await closeConfig()
   await configTab('时效要求');await act(`[data-pf-action="config-select-rule"][data-config-id="${ruleId}"]`);await act('[data-pf-field="config-rule-days"]','fill','1');await closeConfig();await configTab('任务规则映射');await act(`[data-pf-action="config-select-task-mapping"][data-config-id="${nodeId}"]`)
   await act('[data-pf-action="config-try-task-mapping"]','click',undefined,[{selector:'.pf-config-result',text:'可重算'}]);await closeConfig();await configTab('任务规则映射');await act('[data-pf-action="config-preview-mapping-task"]')
   assert(await page.locator('[data-pf-action="config-publish"]').isEnabled());await act('[data-pf-action="config-publish"]','click',undefined,[{selector:'.pf-config-dialog',attr:['aria-label','规则版本历史']}])
   saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dds-production-fulfillment-config-mock-v1')))
   const applied=saved.publishedTaskOverrides.at(-1);assert.equal(applied.taskId,taskId);assert(applied.changes.some(change=>change.nodeId===nodeId&&change.nextDays===1));assert.equal(applied.baselineDueAt,null);assert.equal(applied.effectiveDueAt,null);assert.equal(applied.nextDays,null,'partial route must not become a complete task duration')
   evidence.push({kind:'single-work-rule-publication',taskId,nodeId,...applied});await closeConfig()
   await nav('tasks/'+taskId);assert((await page.locator('.pf-detail-summary').textContent()).includes('待配置'),'whole-task SLA remains pending when source route is incomplete')
   await nav('overview');await act('[data-pf-action="overview-tab"][data-value="数据待补"]');await act('[data-pf-action="data-issue-refresh"]');await act('[data-pf-field="data-issue-view"]','select','已恢复');await act('[data-pf-field="data-issue-owner-filter"]','select','V4时效核验人')
   const restored=await issueRecord(issueId);assert.equal(restored.status,'已恢复');assert.equal(restored.id,initialIssue.id);assert.equal(restored.owner,initialIssue.owner);assert(restored.resolvedAt&&restored.history.some(event=>event.action==='来源确认恢复'),'only matching source rule publication restores issue')
   await openIssue(issueId);assert.equal(await page.locator('[data-pf-action="data-issue-save"]').count(),0,'resolved issue is read only');await act('#pf-overlays summary');await act('#pf-overlays summary');await closeWork()
   const download=page.waitForEvent('download');await act('[data-pf-action="export"]');const file=await download,csv=await readFile(await file.path(),'utf8');assert(csv.includes('事项编号')&&csv.includes(issueId)&&csv.includes('已恢复')&&!csv.includes('"操作"'),'data issue view must export filtered issue rows, not task rows');await file.saveAs(output+'/data-issues-restored-'+i+'.csv')
   evidence.push({kind:'data-issue-source-recovery',id:issueId,firstDetectedAt:restored.firstDetectedAt,resolvedAt:restored.resolvedAt,status:restored.status,history:restored.history})
  })
 })
 await check('明确执行任务来源与工厂',async()=>{await nav('tasks/DEM-202603-0005');await act('[data-pf-action="detail-tab"][data-value="工作明细"]');assert(await page.getByText('全能力测试工厂',{exact:true}).count());assert(await page.getByText('SPF - 特种工艺',{exact:true}).count());await page.screenshot({path:output+'/execution-1366.png'});await act('[data-pf-action="detail-tab"][data-value="全程时效"]');await act('[data-pf-action="detail-subtab"][data-value="工艺路线"]');await page.screenshot({path:output+'/execution-route-1366.png'})});
 await check('列设置、分页、排序与低分辨率',async()=>{
  await nav('work-items');await repeat('columns',async()=>{await act('[data-pf-action="columns"]');await act('[data-pf-action="close-column-settings"]')})
  await repeat('pagination',async()=>{await act('[data-pf-action="next-page"]');await act('[data-pf-action="prev-page"]')})
  await repeat('sort',()=>act('[data-pf-action="sort-column"]'))
  await repeat('page-size',async()=>{await act('[data-pf-field="pageSize"]','select','10');await act('[data-pf-field="pageSize"]','select','20')})
  for(const width of [1280,1024]){
   await page.setViewportSize({width,height:width===1280?720:768})
   for(const route of ['overview','tasks','follow-up','work-items','teams','fulfillment','configuration',taskPath,teamPath]){await repeat('responsive-'+width+'-'+route,()=>nav(route));await layout()}
   await nav('tasks/DEM-202603-0005');await page.screenshot({path:output+'/task-'+width+'.png'})
   await repeat('responsive-document-'+width,async i=>{
    await act('.pf-flow-node','click',undefined,[{selector:'[role="dialog"][aria-label="工作项与单据摘要"]'},{selector:'[data-pf-action="work-tab"][data-value="单据简要信息"][aria-selected="true"]'}])
    const within=await page.locator('#pf-overlays [role="dialog"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight});assert(within,'work summary fits low-resolution viewport')
    if(i===0)await page.screenshot({path:output+'/document-summary-'+width+'.png'});await closeWork()
   })
   await nav(imageTaskPath);await repeat('responsive-image-'+width,async()=>{await act('[data-pf-action="image"]','click',undefined,[{selector:'.pf-image-modal img'}]);const within=await page.locator('.pf-image-modal img').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.naturalWidth>0});assert(within,'full image fits low-resolution viewport');await closeWork()})
  }
  await page.setViewportSize({width:1920,height:1080});await nav('overview');await repeat('fullscreen',async()=>{await act('[data-pf-action="fullscreen"]');await act('[data-pf-action="fullscreen"]')})
 })
 await check('统计卡片、到期分布和阶段下钻',async()=>{
  await page.setViewportSize({width:1366,height:768});await nav('overview')
  const health=await page.locator('[data-pf-action="health-filter"]').evaluateAll(els=>els.map(el=>el.dataset.value))
  for(const value of health)await repeat('overview-health-drill-'+value,async()=>{await act(`[data-pf-action="health-filter"][data-value="${value}"]`,'click',undefined,[{selector:'#pf-app',attr:['data-pf-route',base+'tasks']}]);await routeTo('overview')})
  await repeat('overview-all-tasks-drill',async()=>{await act('[data-pf-action="drill-tasks"]','click',undefined,[{selector:'#pf-app',attr:['data-pf-route',base+'tasks']}]);await routeTo('overview')})
  await act('[data-pf-action="overview-tab"][data-value="分布分析"]')
  for(const action of ['due-filter','stage-filter']){
   const values=await page.locator(`[data-pf-action="${action}"]`).evaluateAll(els=>els.map(el=>el.dataset.value))
   for(const value of values)await repeat('overview-'+action+'-'+value,async()=>{await act(`[data-pf-action="${action}"][data-value="${value}"]`,'click',undefined,[{selector:'#pf-app',attr:['data-pf-route',base+'tasks']}]);await routeTo('overview')})
  }
  for(const route of ['tasks','follow-up']){await nav(route);const values=await page.locator('[data-pf-action="health-filter"]').evaluateAll(els=>els.map(el=>el.dataset.value));for(const value of values)await repeat(route+'-health-shortcut-'+value,async()=>{await act(`[data-pf-action="health-filter"][data-value="${value}"]`);await act('[data-pf-action="reset"]')})}
 })
 await check('各命名路由的通用可操作入口',async()=>{
  await page.setViewportSize({width:1366,height:768})
  if(!teamPath){await nav('teams');teamPath=(await page.locator('a[href*="/teams/"]').first().getAttribute('href')).replace(base,'')}
  for(const route of [...sections,teamPath,taskPath,'tasks/DEM-202603-0005']){
   await nav(route)
   if(route==='overview')await act('[data-pf-action="overview-tab"][data-value="数据待补"]')
   if(route==='fulfillment')await act('[data-pf-action="fulfillment-mode"][data-value="发货行"]')
   if(route.startsWith('teams/'))await act('[data-pf-action="team-tab"][data-value="需要协调"]')
   await exerciseFullscreen(route);await exerciseImages(route);await exerciseSummaries(route)
   if(route.startsWith('tasks/'))await act('[data-pf-action="detail-tab"][data-value="工作明细"]')
   await exerciseTable(route)
   if(['work-items',teamPath].includes(route)&&await page.locator('#pf-content [data-pf-action="open-node"]').count()){
    await repeat(route+'-work-summary',async()=>{await act('#pf-content [data-pf-action="open-node"]','click',undefined,[{selector:'[role="dialog"][aria-label="工作项与单据摘要"]'}]);for(const value of ['单据简要信息','时效与数量','前后依赖','来源证据'])await act(`[data-pf-action="work-tab"][data-value="${value}"]`);await closeWork()})
    await act('#pf-content [data-pf-action="open-node"]');const operations=await page.locator('.pf-work-footer [data-pf-action]').evaluateAll(els=>els.map(el=>el.dataset.pfAction));await closeWork()
    for(const action of operations)await repeat(route+'-work-'+action,async()=>{
     await act('#pf-content [data-pf-action="open-node"]');await act(`.pf-work-footer [data-pf-action="${action}"]`)
     const selected=await page.locator('[data-pf-field="form-nodeId"]').inputValue();await act('[data-pf-field="form-nodeId"]','select',selected)
     await act('[name="reason"]','fill','V4隔离验收：在本工作入口记录');await act('[name="action"]','fill','保留来源事实与原始截止');await act('[name="expectedAt"]','fill','2099-01-01T12:00');await act('[data-pf-action="save-followup"]','click',undefined,[{selector:'#pf-overlays [role="dialog"]',absent:true},{selector:'#pf-notice',text:'已保存'}])
    })
   }
   if(route.startsWith('teams/')){
    if(await page.locator('[data-pf-action="more"]').getAttribute('aria-expanded')==='false')await act('[data-pf-action="more"]')
    await exerciseFields('#pf-filter',route+'-query-input')
    await repeat(route+'-query-reset-export',async()=>{await act('[data-pf-action="query"]');await act('[data-pf-action="reset"]');await act('[data-pf-action="export"]');await act('[data-pf-action="more"]');await act('[data-pf-action="more"]')})
   }
   if(route!=='configuration'&&await page.locator(`#pf-content a[data-pf-action="navigate"][href^="${base}"]`).count()){
    const href=await page.locator(`#pf-content a[data-pf-action="navigate"][href^="${base}"]`).first().getAttribute('href')
    await repeat(route+'-internal-link',async()=>{await act(`#pf-content a[data-pf-action="navigate"][href="${href}"]`,'click',undefined,[{selector:'#pf-app',attr:['data-pf-route',href]}]);await nav(route,'return-to-route')})
   }
  }
 })
 await check('任务数量、阶段展开、来源选择和预测登记',async()=>{
  await nav('tasks/DEM-202603-0005');await act('[data-pf-action="detail-tab"][data-value="数量批次"]')
  for(const value of ['数量进度','数量与放行'])await repeat('quantity-subtab-'+value,()=>act(`[data-pf-action="detail-subtab"][data-value="${value}"]`))
  await act('[data-pf-action="detail-tab"][data-value="全程时效"]');await act('[data-pf-action="detail-subtab"][data-value="全程甘特"]')
  await repeat('timeline-stage-operations',async()=>{await act('[data-pf-action="focus-stage"]');await act('[data-pf-action="toggle-stage"]');await act('[data-pf-action="toggle-stage"]')})
  const teamOptions=await page.locator('[data-pf-field="timeline-team"] option').evaluateAll(els=>els.map(el=>el.value))
  await repeat('timeline-team-filter',async()=>{await act('[data-pf-field="timeline-team"]','select',teamOptions.at(-1));await act('[data-pf-field="timeline-team"]','select','全部')})
  await act('[data-pf-action="bind-sources"]');await exerciseFields('#pf-overlays','source-selection');await closeWork()
  await act('[data-pf-action="detail-tab"][data-value="跟进记录"]');await act('[data-pf-action="followup"]');await exerciseFields('#pf-overlays','followup-fields');await closeWork()
  await repeat('followup-validation',async()=>{await act('#pf-content [data-pf-action="followup"]');await act('[data-pf-action="save-followup"]','click',undefined,[{selector:'.pf-form-error',text:'请填写原因和跟进动作'}]);assert(await page.locator('#pf-overlays [role="dialog"]').count());await closeWork()})
  await repeat('manual-forecast-save',async()=>{
   await act('#pf-content [data-pf-action="estimate"]');await act('[name="reason"]','fill','V4隔离验收：责任方补充当前工作预计');await act('[name="action"]','fill','保持来源实际数量、原始基线和生效截止不变');await act('[name="expectedAt"]','fill','2099-01-01T12:00')
   await act('[data-pf-action="save-followup"]','click',undefined,[{selector:'#pf-overlays [role="dialog"]',absent:true},{selector:'#pf-notice',text:'已保存'}])
   assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('dds-pf-forecasts-v1')||'[]'))).length)
  })
 })
 await check('配置表单全部字段与维护动作',async()=>{
  await nav('configuration')
  await configTab('阶段与工作');await repeat('config-stage-selection',async()=>{await act('[data-pf-action="config-select-stage"][data-config-id="S01"]');await act('[data-pf-action="config-select-stage"][data-config-id="S03"]')})
  for(const [tab,action] of [['阶段与工作','config-edit-stage'],['阶段与工作','config-select-work'],['单据与事件','config-select-mapping'],['时效要求','config-select-rule'],['组上限与依赖','config-edit-group'],['组上限与依赖','config-select-dependency'],['责任规则','config-select-owner']]){
   await configTab(tab);await act(`[data-pf-action="${action}"]`);await exerciseFields('.pf-config-dialog',action+'-field');await closeConfig()
   if(['config-edit-group','config-select-dependency'].includes(action))await repeat(action+'-reopen',async()=>{await act(`[data-pf-action="${action}"]`);await closeConfig()})
  }
  await configTab('单据与事件');await act('[data-pf-action="config-select-mapping"]')
  await repeat('config-mapping-validation-return',async()=>{await act('.pf-config-dialog [data-pf-action="config-validate-mapping"]');await act('.pf-config-dialog [data-pf-action="config-return"]')});await closeConfig()
  await configTab('时效要求');await act('[data-pf-action="config-select-rule"][data-config-id="MOCK-SLA-CN-TRANSFER-01"]')
  await repeat('config-rule-enable-disable',async()=>{await act('[data-pf-action="config-toggle-rule"]');await act('[data-pf-action="config-toggle-rule"]')})
  await repeat('config-rule-copy-confirm-remove',async()=>{await act('[data-pf-action="config-duplicate-rule"]');await act('[data-pf-action="config-remove-rule"]');await act('[data-pf-action="config-cancel-remove-rule"]');await act('[data-pf-action="config-remove-rule"]');await act('[data-pf-action="config-confirm-remove-rule"]')});await closeConfig()
  await act('[data-pf-action="config-open-rule-test"]');await exerciseFields('.pf-config-dialog','rule-matching-fields');await closeConfig()
  await configTab('风险与数据');await exerciseFields('.pf-config-panel','risk-fields')
  await configTab('版本与发布');await exerciseFields('.pf-config-panel','publication-fields')
  await repeat('config-pending-dialog',async()=>{await act('[data-pf-action="config-open-pending"]');await closeConfig()})
  await act('[data-pf-action="config-save"]')
 })
 await check('独立规则示例及往返入口',async()=>{
  await repeat('examples-cold',()=>cold('examples'));await repeat('examples-refresh',()=>nav('examples'))
  for(const value of ['BOM','REUSE','REWORK','DATE-PRECISION','SHIPMENT-IDENTITY','AWAITING-FULFILLMENT','BATCH','SKU'])await repeat('example-'+value,()=>act(`[data-pf-action="example-select"][data-value="${value}"]`,'click',undefined,[{selector:`[data-pf-action="example-select"][data-value="${value}"]`,attr:['aria-current','page']}]))
  await exerciseFullscreen('examples');await exerciseSummaries('examples')
  await repeat('examples-configuration-links',async()=>{await routeTo('configuration');await routeTo('examples')})
 })
 await check('空查询履约列表及匹配试算入口覆盖',async()=>{
  await nav('fulfillment');await act('[data-pf-field="query"]','fill','V4-无匹配');await act('[data-pf-action="query"]')
  for(const mode of ['发货行','完整订单']){await act(`[data-pf-action="fulfillment-mode"][data-value="${mode}"]`);await exerciseTable('fulfillment-empty-'+mode);await exerciseSummaries('fulfillment-empty-'+mode)}
  await act('[data-pf-action="reset"]');await nav('configuration');await configTab('单据与事件')
  await repeat('config-mapping-test-entry',async()=>{await act('.pf-config-panel [data-pf-action="config-open-mapping-test"]');await closeConfig()})
  await configTab('时效要求');await repeat('config-rule-test-entry',async()=>{await act('[data-pf-action="config-open-rule-test"]');await closeConfig()})
 })
 await check('数据事项责任期限、筛选导出与持久化',async()=>{
  await cold('overview');await act('[data-pf-action="overview-tab"][data-value="数据待补"]')
  const issueId=await page.locator('[data-pf-action="data-issue-open"]').first().getAttribute('data-issue-id');assert(issueId)
  await repeat('data-issue-required-fields',async()=>{
   await openIssue(issueId);await act('[data-pf-field="data-issue-owner"]','fill','')
   await act('[data-pf-action="data-issue-save"]','click',undefined,[{selector:'.pf-form-error',text:'请填写明确的责任人和责任团队',visible:true}])
   await act('[data-pf-field="data-issue-owner"]','fill','V4时效核验人');await act('[data-pf-field="data-issue-team"]','fill','跟单核验团队');await act('[data-pf-field="data-issue-dueAt"]','fill','')
   await act('[data-pf-action="data-issue-save"]','click',undefined,[{selector:'.pf-form-error',text:'请填写有效的修复期限',visible:true}])
   await act('[data-pf-field="data-issue-dueAt"]','fill','2099-01-01T12:00');await act('[data-pf-action="data-issue-save"]','click',undefined,[{selector:'.pf-form-error',text:'请填写修复安排或本次调整原因',visible:true}]);await closeWork()
  })
  await repeat('data-issue-register-persist',async i=>{
   const before=await issueRecord(issueId);await registerIssue(issueId,'V4第'+i+'次登记，不关闭来源事项')
   await nav('overview');await act('[data-pf-action="overview-tab"][data-value="数据待补"]');const after=await issueRecord(issueId);assert.equal(after.id,before.id);assert.equal(after.firstDetectedAt,before.firstDetectedAt);assert.equal(after.status,'待处理');assert.equal(after.history.length,before.history.length+1)
   await openIssue(issueId);await act('#pf-overlays summary');assert((await page.locator('#pf-overlays details').textContent()).includes('登记责任与期限'));await act('#pf-overlays summary');await keypress('Escape',[{selector:'#pf-overlays [role="dialog"]',absent:true}])
  })
  for(const [field,values] of [['data-issue-view',['待处理','已恢复','全部']],['data-issue-owner-filter',['V4时效核验人','全部']],['data-issue-deadline-filter',['全部','未登记','已逾期','2日内到期','2日后到期']]])for(const value of values)await repeat('data-issue-filter-'+field+'-'+value,()=>act(`[data-pf-field="${field}"]`,'select',value))
  await repeat('data-issue-reset-refresh-export',async i=>{
   await act('[data-pf-action="data-issue-reset"]');assert.equal(await page.locator('[data-pf-field="data-issue-view"]').inputValue(),'待处理');assert.equal(await page.locator('[data-pf-field="data-issue-owner-filter"]').inputValue(),'全部');assert.equal(await page.locator('[data-pf-field="data-issue-deadline-filter"]').inputValue(),'全部')
   await act('[data-pf-action="data-issue-refresh"]','click',undefined,[{selector:'#pf-notice',text:'已重新读取来源并核对事项'}]);assert.equal((await issueRecord(issueId)).status,'待处理')
   await act('[data-pf-field="data-issue-owner-filter"]','select','V4时效核验人');await act('[data-pf-field="data-issue-deadline-filter"]','select','2日后到期')
   const download=page.waitForEvent('download');await act('[data-pf-action="export"]');const file=await download,csv=await readFile(await file.path(),'utf8');for(const text of ['事项编号','来源缺口键','修复期限','来源确认恢复时间',issueId,'V4时效核验人'])assert(csv.includes(text),'missing issue export field '+text);assert(!csv.includes('"操作"'));await file.saveAs(output+'/data-issues-pending-'+i+'.csv')
   const rows=csv.split(/\r?\n/).filter(line=>line.includes('DI/'));assert.equal(rows.length,1,'export uses current issue-owner and deadline filters');await act('[data-pf-action="data-issue-reset"]')
  })
  await page.screenshot({path:output+'/data-issues-1366.png'})
 })
 await check('数据事项查询层级与多分辨率',async()=>{
  for(const width of [1366,1280,1024]){
   await page.setViewportSize({width,height:width===1280?720:768})
   await repeat('data-issues-responsive-'+width,async i=>{
    await nav('overview');for(const view of ['运行概况','分布分析','数据待补']){await act(`[data-pf-action="overview-tab"][data-value="${view}"]`);await layout()}
    const shape=await page.locator('.pf-data-issue-query').evaluate(el=>{const fields=[...el.querySelectorAll('.pf-data-issue-fields>.pf-field')].map(field=>field.getBoundingClientRect());return{widths:fields.map(field=>field.width),bottom:Math.max(...fields.map(field=>field.bottom)),actionsTop:el.querySelector('.pf-data-issue-actions').getBoundingClientRect().top}})
    assert.equal(shape.widths.length,3);assert(Math.max(...shape.widths)-Math.min(...shape.widths)<1,'issue filters have equal column widths');assert(shape.actionsTop>=shape.bottom,'issue actions stay below all conditions')
    if(i===0)await page.screenshot({path:output+'/data-issues-'+width+'.png'})
   })
  }
  await page.setViewportSize({width:1366,height:768})
 })
 await check('键盘查询、日期边界与列偏好刷新',async()=>{
  for(const route of [...sections.filter(section=>section!=='configuration'),teamPath]){
   await nav(route)
   await repeat(route+'-keyboard-query',async()=>{await act('[data-pf-field="query"]','fill','V4-无匹配');await keypress('Enter');assert.equal(await page.locator(`#pf-content a[href^="${base}tasks/"]`).count(),0,'query results must not contain unrelated tasks');await act('[data-pf-action="reset"]')})
   await act('[data-pf-action="more"]')
   await repeat(route+'-invalid-date-order',async()=>{await act('[data-pf-field="dateFrom"]','fill','2099-02-01');await act('[data-pf-field="dateTo"]','fill','2099-01-01');await act('[data-pf-action="query"]','click',undefined,[{selector:'#pf-notice',text:'结束日期不能早于开始日期'}]);await act('[data-pf-action="reset"]')})
  }
  await nav('work-items')
  await repeat('table-preferences-refresh-persist',async()=>{
   const id=await page.locator('[data-pf-table]').first().getAttribute('data-pf-table'),key='dds-pf-columns-v1:'+id
   await act('[data-pf-action="columns"]');await act('[data-pf-action="toggle-column-visibility"]:enabled');await act('[data-pf-action="toggle-column-freeze"]:enabled');await act('[data-pf-action="column-up"]:enabled');await act('[data-pf-action="close-column-settings"]');await act('[data-pf-field="pageSize"]','select','50')
   const saved=await page.evaluate(k=>localStorage.getItem(k),key);assert(saved,'column preference record exists');await nav('work-items');assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),saved);assert.equal(await page.locator('[data-pf-field="pageSize"]').inputValue(),'50');await act('[data-pf-action="columns"]');await act('[data-pf-action="restore-column-settings"]');await act('[data-pf-action="close-column-settings"]');await act('[data-pf-field="pageSize"]','select','20')
  })
 })
 await check('专属款图在各列表和团队的大图入口',async()=>{
  await freshContext();await nav('teams');await act('[data-pf-field="query"]','fill','DEM-202603-0082');await act('[data-pf-action="query"]')
  const matchingTeam=(await page.locator('a[href*="/teams/"]').first().getAttribute('href')).replace(base,'')
  for(const route of ['tasks','follow-up','work-items',matchingTeam]){
   await nav(route);await act('[data-pf-action="reset"]');await act('[data-pf-field="query"]','fill','DEM-202603-0082');await act('[data-pf-action="query"]')
   if(route.startsWith('teams/')&&!await page.locator('#pf-content [data-pf-action="image"]').count()){
    for(const tab of ['需要协调','交付记录']){await act(`[data-pf-action="team-tab"][data-value="${tab}"]`);if(await page.locator('#pf-content [data-pf-action="image"]').count())break}
   }
   assert(await page.locator('#pf-content [data-pf-action="image"]').count(),'matching source task must expose its dedicated style image on '+route)
   const src=await page.locator('#pf-content [data-pf-action="image"] img').first().getAttribute('src');assert(src.includes('grey-zip-hoodie'),'do not substitute generic sample images')
   await exerciseImages(route+'-dedicated-style');await act('[data-pf-action="reset"]')
  }
  await nav(imageTaskPath);await exerciseSummaries('dedicated-style-task')
 })
 await check('图片失败明确反馈与重新打开恢复',async()=>{
  await nav(imageTaskPath)
  const imagePath=await page.locator('#pf-content [data-pf-action="image"]').first().getAttribute('data-image'),url=new URL(imagePath,page.url()).href
  const thumbnailFailure={selector:'.pf-thumbnail .pf-image-error',text:'图片加载失败',visible:true,expectedImageFailure:`.pf-thumbnail img[src="${imagePath}"]`}
  await repeat('large-image-failure-and-recovery',async()=>{
   await freshContext([thumbnailFailure]);await cdp.send('Network.clearBrowserCache');await page.route(url,route=>route.abort('failed'))
   try{await nav(imageTaskPath,'cold-image-failure');await act('#pf-content [data-pf-action="image"]','click',undefined,[thumbnailFailure,{selector:'.pf-image-modal .pf-image-error',text:'图片加载失败',visible:true,expectedImageFailure:'.pf-image-modal img'}]);assert.equal(await page.locator('.pf-image-modal img').evaluate(img=>img.naturalWidth),0);await act('#pf-overlays [data-pf-action="close"]','click',undefined,[thumbnailFailure,{selector:'.pf-image-modal',absent:true}])}finally{await page.unroute(url)}
   // Recovery is another real navigation in a fresh isolated context, with the normal image gate restored.
   await cold(imageTaskPath)
   await act('#pf-content [data-pf-action="image"]','click',undefined,[{selector:'.pf-image-modal img'}]);assert(await page.locator('.pf-image-modal img').evaluate(img=>img.naturalWidth>0));await closeWork()
  })
 })
 }
}catch(error){errors.push({check:caseName,type:'unexpected',message:String(error)});console.error(error);await page.screenshot({path:output+'/failure.png'}).catch(()=>{})}
finally{
  const groups=[...requiredCases].map(([name,min])=>{const group=samples.filter(sample=>sample.case===name);return{name,required:min,iterations:[...new Set(group.map(sample=>sample.iteration))].length,samples:group.length,maxMs:Math.max(0,...group.map(sample=>sample.ms)),pass:group.length>0&&new Set(group.map(sample=>sample.iteration)).size>=min&&group.every(sample=>sample.ms<200&&!sample.error)}})
  const controls=[...observedControls.values()].map(control=>({...control,samples:executedControls.get(control.key)||0,applicable:control.action!=='print-confirm',...(control.action==='print-confirm'?{exclusion:'物理/系统打印不属于本次用户修改要求；仅验收打印预览和取消，不宣称打印输出已验收'}:{})})),uncoveredControls=controls.filter(control=>control.applicable&&control.samples<5)
  const performanceFailures=samples.filter(sample=>sample.ms>=200||sample.error)
  const servedEntry=await context.request.get(server+base+'overview').then(async response=>({url:response.url(),status:response.status(),sha256:createHash('sha256').update(await response.body()).digest('hex')})).catch(error=>({error:String(error)}))
  const report={server,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),worktree:process.cwd(),servedEntry,scriptSha256:executedScriptHash,browser:browser.version(),checks,samples,errors,omissions,evidence,groups,unexecutedGroups:groups.filter(group=>!group.samples),controls,uncoveredControls,performanceFailures,
    measurement:'navigation starts at timeOrigin; interaction starts at event.timeStamp including queue; enter an animation frame to verify expected content and visible necessary images, allow that frame to paint, then recheck readiness in the next frame before finishing; all raw samples retained. Earlier candidate measurements used an additional frame and are not recalculated.',
    environment:{contexts:contextNumber,isolatedStorage:true,cold:'new browser context per sample; Network.clearBrowserCache; no module warmup; service workers blocked',device:'headless Chromium desktop, actual host; no CPU throttling',platform:process.platform,architecture:process.arch,viewport:'1366×768,1280×720,1024×768,1920×1080',coverageGranularity:'每个命名路由的操作类别；同类工作行使用真实来源代表场景。未达到5个原始样本的已发现控件单列，不当作通过。'},
    missingImageObjects:[...missingImageObjects.values()],imageCompletenessPass:missingImageObjects.size===0,imageAssessment:'Missing-object inventory covers objects encountered on visited screens, not a claim of exhaustive source-data audit. Loaded images prove availability and interaction only; matching each business object still requires source correspondence review. Explicit missing images block complete delivery.',
    performancePass:samples.length>0&&performanceFailures.length===0,
    coveragePass:!quick&&!only&&!omissions.length&&groups.every(group=>group.pass)&&uncoveredControls.length===0,
    maxMs:Math.max(0,...samples.map(sample=>sample.ms)),at:new Date().toISOString()}
  report.completePass=report.performancePass&&report.coveragePass&&report.imageCompletenessPass&&errors.length===0
  await writeFile(output+'/verification.json',JSON.stringify(report,null,2));await writeFile(output+'/uncovered-controls.json',JSON.stringify(uncoveredControls,null,2));await writeFile(output+'/missing-image-objects.json',JSON.stringify(report.missingImageObjects,null,2));await writeFile(output+'/measurement-script.mjs',executedScript)
  console.log(JSON.stringify({checks:checks.length,samples:samples.length,max:report.maxMs,errors,uncoveredControls:uncoveredControls.length,completePass:report.completePass}))
  await browser.close();if(!report.completePass)process.exitCode=1
}
