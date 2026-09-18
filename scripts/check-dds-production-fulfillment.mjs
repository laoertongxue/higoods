if(process.argv.includes('--v4')){await import('./check-dds-production-fulfillment-v4.mjs');process.exit(process.exitCode||0)}
if(process.argv.includes('--v3')){await import('./check-dds-production-fulfillment-v3.mjs');process.exit(process.exitCode||0)}
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const server=process.env.PF_CHECK_URL||(process.argv.includes('--production')?'http://127.0.0.1:4179':'http://127.0.0.1:4178')
const deep=process.argv.includes('--deep')
const diagnose=process.argv.includes('--diagnose')
const regressionV2=process.argv.includes('--regression-v2')
const metricsV2=process.argv.includes('--metrics-v2')
const output=metricsV2?'output/playwright/dds-pf-v2-metrics':regressionV2?'output/playwright/dds-pf-v2-regression':'output/playwright/dds-pf-v2'
const layoutV2=process.argv.includes('--layout-v2')
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true})
const page=await context.newPage()
const samples=[],checks=[],errors=[]
page.on('pageerror',error=>errors.push(String(error)))
await context.addInitScript(()=>{
  window.pfSamples=[]
  const ready=()=>{
    const root=document.querySelector('#pf-app');
    return root&&decodeURI(root.dataset.pfRoute)===decodeURI(location.pathname)&&[...root.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)
  }
  const settle=(start,label)=>new Promise(resolve=>{
    const tick=()=>{
      if(performance.now()-start>5000){resolve({label,ms:performance.now()-start,error:'内容未就绪',route:location.pathname});return}
      if(!ready()){requestAnimationFrame(tick);return}
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(!ready()){tick();return}
        const result={label,ms:performance.now()-start,route:location.pathname,viewport:innerWidth+'×'+innerHeight};window.pfSamples.push(result);resolve(result)
      }))
    };tick()
  })
  window.pfNavigation=settle(0,'navigation')
  for(const type of ['click','input','change','keydown','drop'])document.addEventListener(type,event=>{
    if(type==='keydown'&&!['Escape','Enter'].includes(event.key))return
    if(!document.querySelector('#pf-app'))return
    window.pfLast=settle(performance.now(),type+':'+(event.target.closest('[data-pf-action]')?.dataset.pfAction||event.target.dataset.pfField||event.key||event.target.tagName))
  },true)
})
const base='/dds/supply-chain/production-fulfillment/'
const paths=['overview','tasks','follow-up','work-items','teams','fulfillment','configuration','tasks/MOCK-PT-001','teams/'+encodeURIComponent('车缝厂A')]
async function nav(path){await page.goto(server+base+path);await page.waitForSelector('#pf-content');const result=await page.evaluate(()=>window.pfNavigation);if(diagnose)result.timings=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,duration:e.duration,size:e.transferSize}))}));samples.push({...result,kind:'load'});assert(!result.error,result.error);assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth>innerWidth),false,'body horizontal overflow');return samples.at(-1)}
async function act(selector,kind='click',value){const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded();if(kind==='click')await target.click();else if(kind==='select')await target.selectOption(value);else await target.fill(value);const result=await page.evaluate(()=>window.pfLast);assert(result,'event not recorded '+selector);samples.push({...result,selector,kind});assert(!result.error,result.error);return result}
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name)}
async function repeat(label,fn){for(let i=0;i<5;i++){await fn(i);const sample=samples.at(-1);if(sample)sample.case=label;}}
try{
  if(metricsV2){
    await check('当前逾期与预测可判率分别计算并随查询更新',async()=>{
      await nav('overview');await act('[data-pf-action="reset"]');await act('[data-pf-action="overview-tab"][data-value="分布分析"]')
      await repeat('metric-denominators',async()=>{
        await act('[data-pf-action="query"]')
        const text=await page.locator('[role="tabpanel"]').innerText()
        assert(text.includes('7/8 · 87.5%'));assert(text.includes('6/8 · 75%'))
        await act('[data-pf-field="query"]','fill','MOCK-PT-010');await act('[data-pf-action="query"]')
        const filtered=await page.locator('[role="tabpanel"]').innerText()
        assert(filtered.includes('1/1 · 100%'));assert(filtered.includes('0/1 · 0%'))
        await act('[data-pf-action="reset"]')
      })
      await page.screenshot({path:output+'/metric-denominators-1366.png'})
      await repeat('delivery-performance',async()=>{await act('[data-pf-field="analysis-view"]','select','交付表现');assert((await page.locator('[role="tabpanel"]').innerText()).includes('同类工作交付表现'));await act('[data-pf-field="analysis-view"]','select','分布')})
    })
  }else if(layoutV2){
    await check('七个菜单紧凑筛选与一致列宽',async()=>{
      for(const width of [1366,1280,1024]){
        await page.setViewportSize({width,height:width===1280?720:768})
        for(const path of paths.slice(0,7)){
          await nav(path)
          if(path==='configuration')continue
          await act('[data-pf-action="reset"]')
          const assertLayout=async()=>{
            const result=await page.locator('.pf-query-card').evaluate(card=>{
              const fields=[...card.querySelectorAll('.pf-filter-fields>.pf-field')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,bottom:r.bottom}})
              const actions=card.querySelector('.pf-filter-actions').getBoundingClientRect()
              return {fields,actionTop:actions.y,height:card.getBoundingClientRect().height,actions:[...card.querySelectorAll('.pf-filter-actions button')].map(el=>el.getBoundingClientRect().y)}
            })
            assert(result.fields.length>=4)
            assert(result.actionTop>=Math.max(...result.fields.map(f=>f.bottom)),'actions must be after all conditions')
            assert(Math.max(...result.fields.map(f=>f.w))-Math.min(...result.fields.map(f=>f.w))<1,'equal filter widths')
            assert(Math.max(...result.actions)-Math.min(...result.actions)<1,'actions share one final row')
            assert(result.height<(result.fields.length===4?(width===1024?155:110):300),'compact filter height')
            const heights=await page.locator('.pf-kpi,.pf-metric-card,.pf-brief-stat').evaluateAll(es=>es.map(el=>el.getBoundingClientRect().height))
            assert(heights.every(h=>h<=49),'stat card height <=48px')
            assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth>innerWidth),false)
          }
          await assertLayout()
          await repeat('filter-layout-'+width+'-'+path,async()=>{await act('[data-pf-action="more"]');await assertLayout();await act('[data-pf-action="more"]');await assertLayout()})
          if(width===1366){await act('[data-pf-action="more"]');await page.screenshot({path:output+'/'+path+'-filters-1366.png'});await act('[data-pf-action="more"]')}
        }
      }
    })
    await page.setViewportSize({width:1366,height:768})
    await check('总览互斥页签及带筛选下钻返回',async()=>{
      await nav('overview')
      for(const tab of ['运行概况','分布分析','数据待补'])await repeat('overview-tab-'+tab,async()=>{await act(`[data-pf-action="overview-tab"][data-value="${tab}"]`);assert.equal(await page.locator('[role="tabpanel"]').count(),1);assert.equal(await page.locator('.pf-priority-card').count(),tab==='运行概况'?3:0)})
      await act('[data-pf-action="overview-tab"][data-value="分布分析"]')
      await repeat('analysis-view',i=>act('[data-pf-field="analysis-view"]','select',i%2?'交付表现':'分布'))
      await act('[data-pf-action="overview-tab"][data-value="运行概况"]')
      await page.screenshot({path:output+'/overview-v2-1366.png'})
      await repeat('drilldown-and-return',async()=>{await act('[data-pf-action="health-filter"][data-value="预计逾期"]');assert(page.url().endsWith('/tasks'));assert.equal(await page.locator('[data-pf-field="health"]').inputValue(),'预计逾期');assert((await page.locator('#pf-content').innerText()).includes('MOCK-PT-001'));await act('a[data-pf-action="navigate"][href$="/overview"]');assert.equal(await page.locator('[data-pf-action="overview-tab"][aria-selected="true"]').innerText(),'运行概况')})
    })
    await check('任务详情、工作抽屉和示例分层',async()=>{
      await nav('tasks/MOCK-PT-001');assert(await page.locator('.pf-node-link').count()<31)
      assert((await page.locator('[aria-label="任务详情视图"]').boundingBox()).y<600)
      await page.screenshot({path:output+'/task-v2-1366.png'})
      for(const tab of ['全程时效','工作明细','数量批次','实际发货与订单','计算与版本','跟进记录'])await repeat('detail-tab-'+tab,()=>act(`[data-pf-action="detail-tab"][data-value="${tab}"]`))
      await act('[data-pf-action="detail-tab"][data-value="计算与版本"]')
      for(const tab of ['整体公式','逐项倒排','版本记录'])await repeat('formula-'+tab,()=>act(`[data-pf-action="detail-subtab"][data-value="${tab}"]`))
      await act('[data-pf-action="detail-tab"][data-value="数量批次"]')
      for(const tab of ['数量进度','数量与放行'])await repeat('quantity-'+tab,()=>act(`[data-pf-action="detail-subtab"][data-value="${tab}"]`))
      await act('[data-pf-action="detail-tab"][data-value="全程时效"]');await act('[data-pf-action="expand-all"]');assert.equal(await page.locator('.pf-node-link').count(),31)
      await act('[data-pf-action="open-node"][data-node-id="W29"]')
      for(const tab of ['时效与数量','前后依赖','来源证据'])await repeat('work-tab-'+tab,()=>act(`[data-pf-action="work-tab"][data-value="${tab}"]`))
      await page.screenshot({path:output+'/work-drawer-v2.png'});await act('#pf-overlays [data-pf-action="close"]')
      for(const field of ['timeline-basis','timeline-team'])await repeat(field,i=>act(`[data-pf-field="${field}"]`,'select',field==='timeline-basis'?(i%2?'原始基线':'当前标准'):(i%2?'车缝厂A':'全部')))
      await nav('examples');const examples=await page.locator('[data-pf-action="example-select"]').evaluateAll(es=>es.map(el=>el.dataset.value))
      for(const id of examples)await repeat('example-'+id,()=>act(`[data-pf-action="example-select"][data-value="${id}"]`))
    })
    await check('团队与履约互斥内容',async()=>{
      await nav('teams/'+encodeURIComponent('车缝厂A'))
      for(const tab of ['可执行工作','需要协调','交付记录'])await repeat('team-tab-'+tab,()=>act(`[data-pf-action="team-tab"][data-value="${tab}"]`))
      await nav('fulfillment');for(const tab of ['发货行','完整订单','时钟对照'])await repeat('fulfillment-'+tab,()=>act(`[data-pf-action="fulfillment-mode"][data-value="${tab}"]`))
    })
    await check('配置目录→编辑→试算→校验→发布各5次',async()=>{
      await nav('configuration');await act('[data-pf-field="role"]','select','供应链管理')
      const close=()=>act('.pf-config-dialog header [data-pf-action="config-close"]')
      const fields=async()=>{
        const entries=await page.locator('[data-pf-field^="config-"]:not(:disabled)').evaluateAll(es=>es.map(el=>({key:el.dataset.pfField,tag:el.tagName,value:el.value})))
        for(const f of entries)await repeat('config-input-'+f.key,()=>act(`[data-pf-field="${f.key}"]`,f.tag==='SELECT'?'select':'fill',f.value))
      }
      const tab=async name=>act(`[data-pf-action="config-tab"][data-config-tab="${name}"]`)
      await tab('阶段与工作');assert.equal(await page.locator('.pf-config-dialog').count(),0);assert.equal(await page.locator('[data-pf-field^="config-work-"]').count(),0)
      await repeat('stage-select',i=>act(`[data-pf-action="config-select-stage"][data-config-id="S0${i+1}"]`))
      await act('[data-pf-action="config-select-stage"][data-config-id="S01"]')
      await repeat('stage-dialog',async()=>{await act('[data-pf-action="config-edit-stage"]');await close()})
      await act('[data-pf-action="config-edit-stage"]');await fields();await close()
      const catalogIds=await page.locator('[data-pf-action="config-select-work"]').evaluateAll(es=>es.map(el=>el.dataset.configId));assert(catalogIds.every(id=>id.startsWith('ACT-S01')))
      await repeat('work-dialog',async()=>{await act('[data-pf-action="config-select-work"]');assert.equal(await page.locator('[data-pf-field="config-work-stage"]').inputValue(),'S01');await close()})
      await act('[data-pf-action="config-select-work"]');await fields();await close()
      await page.screenshot({path:output+'/configuration-v2-1366.png'})
      for(const [name,action] of [['单据与事件','config-select-mapping'],['时效要求','config-select-rule'],['组上限与依赖','config-select-dependency'],['责任规则','config-select-owner']]){
        await tab(name);assert.equal(await page.locator('.pf-config-dialog').count(),0)
        await repeat(action,async()=>{await act(`[data-pf-action="${action}"]`);assert.equal(await page.locator('.pf-config-dialog').count(),1);await close()})
        await act(`[data-pf-action="${action}"]`);await fields();await page.screenshot({path:output+'/'+action+'-dialog.png'});await close()
      }
      await tab('单据与事件');await act('[data-pf-action="config-select-mapping"][data-config-id="MAP-TRANSFER"]');await act('.pf-config-dialog [data-pf-action="config-open-mapping-test"]')
      for(const value of ['完整实收事件','缺少物流批次关联','重复读取同一事件','只有采购入库事件'])await repeat('mapping-test-'+value,async()=>{await act('[data-pf-field="config-mappingCase"]','select',value);await act('[data-pf-action="config-match-mapping"]')})
      await act('[data-pf-action="config-return"]');await repeat('mapping-validation',async()=>{await act('[data-pf-action="config-validate-mapping"]');await act('[data-pf-action="config-return"]')});await close()
      await tab('时效要求');await repeat('rule-test-dialog',async()=>{await act('[data-pf-action="config-open-rule-test"]');await act('[data-pf-action="config-match"]');await close()})
      await act('[data-pf-action="config-open-rule-test"]');await fields();await close()
      await act('[data-pf-action="config-select-rule"][data-config-id="MOCK-SLA-CN-TRANSFER-01"]')
      await repeat('rule-toggle',async()=>{await act('[data-pf-action="config-toggle-rule"]');await act('[data-pf-action="config-toggle-rule"]')})
      await repeat('rule-copy-remove',async()=>{await act('[data-pf-action="config-duplicate-rule"]');await act('[data-pf-action="config-remove-rule"]');await act('[data-pf-action="config-cancel-remove-rule"]');await act('[data-pf-action="config-remove-rule"]');await act('[data-pf-action="config-confirm-remove-rule"]')});await close()
      await tab('组上限与依赖');await repeat('group-dialog',async()=>{await act('[data-pf-action="config-edit-group"]');await close()});await act('[data-pf-action="config-edit-group"]');await fields();await close()
      for(const name of ['风险与数据','版本与发布']){await tab(name);await fields()}
      await repeat('config-validation',async()=>{await act('[data-pf-action="config-validate"]');assert.equal(await page.locator('.pf-config-dialog').count(),1);await close()})
      await repeat('save-draft',()=>act('[data-pf-action="config-save"]'))
      await repeat('publish-preview',async()=>{await act('[data-pf-action="config-preview"]');assert.equal(await page.locator('.pf-config-dialog').count(),1);await close()})
      await repeat('publish',async()=>{await act('[data-pf-action="config-preview"]');await act('[data-pf-action="config-publish"]');assert((await page.locator('.pf-config-dialog').innerText()).includes('MOCK'));await close()})
      await repeat('history',async()=>{await act('[data-pf-action="config-history"]');await act('[data-pf-action="config-load-history"]');await close()})
      await repeat('pending',async()=>{await act('[data-pf-action="config-open-pending"]');await close()})
      await act('[data-pf-field="role"]','select','只读查看者');await tab('阶段与工作');await act('[data-pf-action="config-select-work"]');assert.equal(await page.locator('.pf-config-dialog input:not(:disabled)').count(),0);await close();await act('[data-pf-field="role"]','select','供应链管理')
    })
    await check('最终版本10路由冷进入/刷新/站内切换各5次',async()=>{
      const cdp=await context.newCDPSession(page)
      for(const path of [...paths,'examples'])for(let i=0;i<5;i++){
        await cdp.send('Network.clearBrowserCache');const result=await nav(path);result.kind='cold';result.sample=i+1
        await page.reload();samples.push({...await page.evaluate(()=>window.pfNavigation),kind:'reload',sample:i+1})
        await page.evaluate(path=>{const a=document.createElement('a');a.textContent='验收路由切换';a.href=path;a.dataset.pfAction='navigate';a.dataset.path=path;a.id='pf-validation-navigation';document.querySelector('#pf-app').append(a)},base+path)
        await act('#pf-validation-navigation');samples.at(-1).case='SPA '+path;samples.at(-1).sample=i+1
      }
    })
  } else {

  if(diagnose){for(let i=0;i<5;i++){const result=await nav('overview');console.log('DIAG',JSON.stringify(result))}}
  for(const path of diagnose?[]:paths){const result=await nav(path);console.log('LOAD',path,result.ms)}
  if(diagnose)throw new Error('诊断已记录；不是验收通过')
  await check('总览8在途/7000/400/6600',async()=>{await nav('overview');const text=await page.locator('#pf-content').innerText();for(const term of ['8 笔','7,000','400','6,600'])assert(text.includes(term));await page.screenshot({path:output+'/overview-1366.png'})})
  await check('查询与重置共同范围',async()=>{await act('[data-pf-action="health-filter"][data-value="预计逾期"]');assert((await page.locator('#pf-content').innerText()).includes('MOCK-PT-001'));assert.equal(await page.locator('[data-pf-field="health"]').inputValue(),'预计逾期');await act('[data-pf-action="reset"]')})
  await check('跟单甲仅001/005',async()=>{await nav('follow-up');const text=await page.locator('#pf-content').innerText();assert(text.includes('MOCK-PT-001'));assert(text.includes('MOCK-PT-005'));assert(!text.includes('MOCK-PT-002'))})
  await check('任务31工作/21子动作/九阶段',async()=>{await nav('tasks/MOCK-PT-001');assert.equal(await page.locator('.pf-stage-chip').count(),9);assert(await page.locator('.pf-node-link').count()<31);await act('[data-pf-action="expand-all"]');assert.equal(await page.locator('.pf-node-link').count(),31);await act('[data-pf-action="toggle-children"]');assert.equal(await page.locator('.pf-child-row').count(),21);await act('[data-pf-action="toggle-dependencies"]');assert(await page.locator('.pf-dependency-lines path').count()>20);await page.locator('.pf-gantt-axis').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/gantt-1366.png'});assert(await page.locator('.pf-gantt-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'day view must fit all dates')})
  await check('工作抽屉及大图',async()=>{await act('[data-pf-action="open-node"][data-node-id="W29"]');const text=await page.locator('[role="dialog"]').innerText();assert(text.includes('1,000 / 400'));assert(text.includes('200'));await act('#pf-overlays [data-pf-action="image"]');assert.equal(await page.locator('.pf-image-modal img').evaluate(img=>img.complete&&img.naturalWidth>0),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#pf-overlays [role="dialog"]').count(),0)})
  await check('完整计算公式及数量曲线',async()=>{await act('[data-pf-action="detail-tab"][data-value="计算与版本"]');assert((await page.locator('#pf-content').innerText()).includes('max(14,15)'));assert.equal(await page.locator('[data-pf-boundary]').count(),0);await act('[data-pf-action="detail-tab"][data-value="数量批次"]');assert(await page.locator('#pf-content svg').count()>0);assert((await page.locator('#pf-content').innerText()).includes('400'));await page.screenshot({path:output+'/quantities-1366.png'})})
  await check('工作项状态独立于任务/共享去重',async()=>{await nav('work-items');await act('[data-pf-field="scope"]','select','全部');await act('[data-pf-action="query"]');assert((await page.locator('#pf-content').innerText()).includes('124'));await act('[data-pf-field="health"]','select','已逾期');await act('[data-pf-action="query"]');assert((await page.locator('#pf-content').innerText()).includes('T4-01'))})
  await check('实际发货订单60%及64.29%',async()=>{await nav('fulfillment');const text=await page.locator('#pf-content').innerText();assert(text.includes('60%'));assert(text.includes('64.29%'));await act('[data-pf-action="fulfillment-mode"][data-value="完整订单"]');const download=page.waitForEvent('download');await act('[data-pf-action="export"]');await(await download).saveAs(output+'/orders-export.csv')})
  await check('角色读取及编辑权限',async()=>{await nav('tasks');await act('[data-pf-field="role"]','select','跟单');assert(!(await page.locator('#pf-content').innerText()).includes('MOCK-PT-002'));await nav('tasks/MOCK-PT-002');assert((await page.locator('#pf-content').innerText()).includes('不在当前角色范围'));await act('[data-pf-field="role"]','select','供应链管理')})
  await check('配置7区和目录',async()=>{await nav('configuration');assert.equal(await page.locator('[data-pf-action="config-tab"]').count(),7);await act('[data-pf-action="config-validate"]');await page.screenshot({path:output+'/configuration-1366.png'})})
  if(deep){
    if(!regressionV2)await check('九类路由冷加载/刷新/站内切换各5次',async()=>{
      const cdp=await context.newCDPSession(page)
      for(const path of paths){for(let i=0;i<5;i++){
        await cdp.send('Network.clearBrowserCache');const result=await nav(path);result.kind='cold';result.sample=i+1
        await page.reload();samples.push({...await page.evaluate(()=>window.pfNavigation),kind:'reload',sample:i+1})
        await page.evaluate(path=>{const a=document.createElement('a');a.textContent='验收路由切换';a.href=path;a.dataset.pfAction='navigate';a.dataset.path=path;a.id='pf-validation-navigation';document.querySelector('#pf-app').append(a)},base+path)
        await act('#pf-validation-navigation');samples.at(-1).case='SPA '+path;samples.at(-1).sample=i+1
      }}
    })
    await check('查询/输入/筛选/空结果/日期/导出5次',async()=>{
      await nav('tasks');await repeat('query-input',i=>act('[data-pf-field="query"]','fill',i%2?'MOCK-PT-001':'无匹配记录'))
      await repeat('query',()=>act('[data-pf-action="query"]'));assert((await page.locator('#pf-content').innerText()).includes('没有记录'))
      await repeat('reset',()=>act('[data-pf-action="reset"]'));await repeat('more',()=>act('[data-pf-action="more"]'))
      for(const field of ['health','follower','scope','stage','team','region','supplyMode','dateField'])await repeat('field-'+field,()=>act(`[data-pf-field="${field}"]`,'select',field==='scope'?'全部':field==='dateField'?'起点':'全部'))
      for(const field of ['dateFrom','dateTo'])await repeat('field-'+field,()=>act(`[data-pf-field="${field}"]`,'fill','2026-09-17'))
      await repeat('reset',()=>act('[data-pf-action="reset"]'))
      await repeat('export',async()=>{const downloaded=page.waitForEvent('download');await act('[data-pf-action="export"]');await downloaded})
    })
    await check('列显示/顺序/冻结/拖拽/排序/分页5次',async()=>{
      await nav('work-items');await repeat('page-size',i=>act('[data-pf-field="pageSize"]','select',i%2?'20':'10'))
      await repeat('pagination-next-prev',async()=>{await act('[data-pf-action="next-page"]');await act('[data-pf-action="prev-page"]')})
      await repeat('sort',()=>act('[data-pf-action="sort-column"][data-column-key="team"]'))
      await repeat('columns-open-close',async()=>{await act('[data-pf-action="columns"]');await act('#pf-overlays [data-pf-action="close-column-settings"]')})
      await act('[data-pf-action="columns"]')
      await repeat('column-visible',()=>act('[data-pf-action="toggle-column-visibility"][data-pf-column-key="team"]'))
      await repeat('column-freeze',()=>act('[data-pf-action="toggle-column-freeze"][data-pf-column-key="id"]'))
      await repeat('column-order',()=>act('[data-pf-action="column-up"][data-key="quantity"]'))
      await repeat('column-restore',()=>act('[data-pf-action="restore-column-settings"]'))
      await repeat('column-drag-drop',async()=>{
      await act('[data-pf-action="restore-column-settings"]');const before=await page.locator('#pf-overlays [data-standard-list-column-drag]').first().getAttribute('data-pf-column-key')
      await page.locator('#pf-overlays [data-standard-list-column-drag][data-pf-column-key="team"]').dragTo(page.locator('#pf-overlays [data-standard-list-column-drag][data-pf-column-key="id"]'))
      assert.notEqual(await page.locator('#pf-overlays [data-standard-list-column-drag]').first().getAttribute('data-pf-column-key'),before);samples.push({...await page.evaluate(()=>window.pfLast),kind:'drop'})
      })
      await act('#pf-overlays [data-pf-action="close-column-settings"]')
    })
    await check('六个详情页签和甘特交互5次',async()=>{
      await nav('tasks/MOCK-PT-001')
      for(const name of ['工作明细','数量批次','实际发货与订单','计算与版本','跟进记录','全程时效'])await repeat('tab-'+name,()=>act(`[data-pf-action="detail-tab"][data-value="${name}"]`))
      for(const name of ['toggle-children','toggle-dependencies','collapse-all','expand-all','fit-timeline'])await repeat(name,()=>act(`[data-pf-action="${name}"]`))
      await repeat('timeline-mode',i=>act('[data-pf-field="timeline-mode"]','select',i%2?'关键路径':'全部工作'))
      await repeat('timeline-scale',i=>act('[data-pf-field="timeline-scale"]','select',i%2?'小时':'日'))
      await repeat('focus-stage',()=>act('[data-pf-action="focus-stage"][data-stage="S07"]'))
      await repeat('open-node-close',async()=>{await act('[data-pf-action="open-node"][data-node-id="W29"]');await act('#pf-overlays [data-pf-action="close"]')})
      await repeat('image-close',async()=>{await act('[data-pf-action="image"]');await act('#pf-overlays [data-pf-action="close"]')})
    })
    await check('跟进/人工预计写入及空值防错5次',async()=>{
      await repeat('followup-submit',async i=>{await act('[data-pf-action="detail-tab"][data-value="跟进记录"]');await act('[data-pf-action="followup"]');await act('[data-pf-action="save-followup"]');assert(await page.locator('.pf-form-error').isVisible());await act('[name="reason"]','fill','Mock产能核对 '+i);await act('[name="action"]','fill','联系责任团队确认剩余600件回货计划');await act('[data-pf-action="save-followup"]')})
      await repeat('estimate-submit',async i=>{await act('[data-pf-action="estimate"]');await act('[name="reason"]','fill','负责人反馈完成计划 '+i);await act('[name="action"]','fill','保持产能风险跟进，人工预计不作为完工事实');await act('[name="expectedAt"]','fill','2026-09-19T10:00');await act('[data-pf-action="save-followup"]')})
      assert((await page.locator('#pf-content').innerText()).includes('基线')||await page.locator('#pf-notice').isVisible())
      await repeat('print-preview',async()=>{await act('[data-pf-action="print-task"]');assert((await page.locator('[role="dialog"]').innerText()).includes('Mock'));await act('[data-pf-action="print-confirm"]');await page.emulateMedia({media:'print'});const printStart=performance.now();await page.pdf({path:output+'/task-report.pdf'});samples.push({label:'print-ready-pdf',ms:performance.now()-printStart,kind:'print',route:page.url()});await page.emulateMedia({media:'screen'});await act('#pf-overlays [data-pf-action="close"]')})
    })
    await check('未知路线有界/无界收敛5次',async()=>{
      await nav('tasks/MOCK-PT-004');await act('[data-pf-action="detail-tab"][data-value="计算与版本"]');await act('[data-pf-action="detail-subtab"][data-value="路线判断"]')
      await repeat('scenario-converge',async()=>{await act('[data-pf-action="scenario-reset"]');await act('[data-pf-action="scenario-craft"][data-value="有特殊工艺"]');await act('[data-pf-action="scenario-region"][data-value="CN"]');assert((await page.locator('#pf-content').innerText()).includes('24'));await act('[data-pf-action="scenario-unbounded"]')})
    })
    await check('配置全部页签/校验/发布/只读5次',async()=>{
      await nav('configuration');const tabs=await page.locator('[data-pf-action="config-tab"]').evaluateAll(elements=>elements.map(el=>el.dataset.configTab))
      for(const tab of tabs)await repeat('config-tab-'+tab,()=>act(`[data-pf-action="config-tab"][data-config-tab="${tab}"]`))
      await repeat('config-validate',async()=>{await act('[data-pf-action="config-validate"]');await act('.pf-config-dialog header [data-pf-action="config-close"]')});await repeat('config-save',()=>act('[data-pf-action="config-save"]'))
      await repeat('config-preview',async()=>{await act('[data-pf-action="config-preview"]');await act('.pf-config-dialog header [data-pf-action="config-close"]')})
      await repeat('config-publish',async()=>{await act('[data-pf-action="config-preview"]');await act('[data-pf-action="config-publish"]');assert((await page.locator('[role="dialog"]').innerText()).includes('MOCK'));await act('.pf-config-dialog header [data-pf-action="config-close"]')});await repeat('role-select',i=>act('[data-pf-field="role"]','select',i%2?'供应链管理':'只读查看者'));assert(await page.locator('[data-pf-action="config-save"]').first().isDisabled());await act('[data-pf-field="role"]','select','供应链管理')
    })
    if(!regressionV2)await check('配置编辑/匹配/冲突防错/历史5次',async()=>{
      await nav('configuration')
      const tabs=await page.locator('[data-pf-action="config-tab"]').evaluateAll(es=>es.map(el=>el.dataset.configTab))
      for(const tab of tabs){
        await act(`[data-pf-action="config-tab"][data-config-tab="${tab}"]`)
        const fields=await page.locator('[data-pf-field^="config-"]:not(:disabled)').evaluateAll(es=>es.map(el=>({key:el.dataset.pfField,tag:el.tagName,value:el.value})))
        for(const f of fields)await repeat('config-field-'+f.key,()=>act(`[data-pf-field="${f.key}"]`,f.tag==='SELECT'?'select':'fill',f.value))
        const records=await page.locator('[data-pf-action^="config-select-"]').evaluateAll(es=>es.map(el=>({action:el.dataset.pfAction,id:el.dataset.configId})))
        if(records.length)await repeat('config-record-'+tab,i=>act(`[data-pf-action="${records[i%records.length].action}"][data-config-id="${records[i%records.length].id}"]`))
      }
      await act('[data-pf-action="config-tab"][data-config-tab="单据与事件"]')
      await act('[data-pf-action="config-select-mapping"][data-config-id="MAP-TRANSFER"]')
      for(const value of ['完整实收事件','缺少物流批次关联','重复读取同一事件','只有采购入库事件'])await repeat('mapping-'+value,async()=>{await act('[data-pf-field="config-mappingCase"]','select',value);await act('[data-pf-action="config-match-mapping"]')})
      await repeat('mapping-validate',()=>act('[data-pf-action="config-validate-mapping"]'))
      await act('[data-pf-action="config-tab"][data-config-tab="时效要求"]')
      await act('[data-pf-action="config-select-rule"][data-config-id="MOCK-SLA-CN-TRANSFER-01"]')
      await repeat('rule-match',()=>act('[data-pf-action="config-match"]'))
      await repeat('rule-toggle',async()=>{await act('[data-pf-action="config-toggle-rule"]');await act('[data-pf-action="config-toggle-rule"]')})
      await repeat('rule-copy-conflict-remove',async()=>{await act('[data-pf-action="config-duplicate-rule"]');await act('[data-pf-action="config-validate"]');assert((await page.locator('#pf-content').innerText()).includes('冲突'));await act('[data-pf-action="config-remove-rule"]');await act('[data-pf-action="config-cancel-remove-rule"]');await act('[data-pf-action="config-remove-rule"]');await act('[data-pf-action="config-confirm-remove-rule"]');await act('[data-pf-action="config-select-rule"][data-config-id="MOCK-SLA-CN-TRANSFER-01"]')})
      await act('[data-pf-action="config-tab"][data-config-tab="版本与发布"]')
      await repeat('config-history',async()=>{await act('[data-pf-action="config-history"]');await act('[data-pf-action="config-load-history"]');await act('button[data-pf-action="config-close"]')})
    })
    await check('图表筛选/甘特折叠/关闭恢复/图片失败5次',async()=>{
      await nav('overview')
      for(const action of ['health-filter','due-filter','stage-filter'])await repeat(action,async()=>{await nav('overview');await act('[data-pf-action="overview-tab"][data-value="'+(action==='stage-filter'?'分布分析':'运行概况')+'"]');await act(`[data-pf-action="${action}"]`);await act('[data-pf-action="reset"]')})
      if(!await page.locator('[data-pf-field="issuesOnly"]').isVisible())await act('[data-pf-action="more"]');await repeat('issues-only',()=>act('[data-pf-field="issuesOnly"]'))
      await nav('tasks/MOCK-PT-001');await repeat('toggle-stage',()=>act('[data-pf-action="toggle-stage"]'))
      await repeat('image-Escape',async()=>{await act('[data-pf-action="image"]');await page.keyboard.press('Escape');samples.push({...await page.evaluate(()=>window.pfLast),kind:'key'})})
      await repeat('image-backdrop',async()=>{await act('[data-pf-action="image"]');await page.locator('.pf-overlay-backdrop').click({position:{x:2,y:2}});samples.push({...await page.evaluate(()=>window.pfLast),kind:'backdrop'});assert.equal(await page.locator('#pf-overlays [role="dialog"]').count(),0)})
      await page.route('**/pf-missing-test-image.png',route=>route.fulfill({status:404,body:''}));
      await page.locator('#pf-content img').first().evaluate(img=>img.src='/pf-missing-test-image.png');await page.waitForSelector('.pf-image-error:not([hidden])');assert(await page.locator('.pf-image-error:not([hidden])').count()>0);await nav('tasks/MOCK-PT-001')
    })
    await check('选定在途本地重算/原始基线保留/缺映射阻断5次',async()=>{
      await nav('configuration');await act('[data-pf-action="config-tab"][data-config-tab="时效要求"]');await act('[data-pf-action="config-select-rule"][data-config-id="MOCK-SLA-CN-TRANSFER-01"]');await act('[data-pf-field="config-rule-days"]','fill','3');await act('.pf-config-dialog header [data-pf-action="config-close"]');await act('[data-pf-action="config-tab"][data-config-tab="版本与发布"]');await act('[data-pf-field="config-publish-scope"]','select','选定在途任务本地重算并发布')
      await repeat('recalc-unmapped',async()=>{await act('[data-pf-field="config-publish-taskIds"]','fill','MOCK-PT-006');await act('[data-pf-action="config-preview"]');assert(await page.locator('[data-pf-action="config-publish"]').isDisabled());assert((await page.locator('[role="dialog"]').innerText()).includes('未命中'));await act('button[data-pf-action="config-close"]')})
      await repeat('recalc-publish',async i=>{await act('[data-pf-field="config-publish-taskIds"]','fill','MOCK-PT-001');await act('[data-pf-action="config-preview"]');const text=await page.locator('[role="dialog"]').innerText();assert(text.includes('26'));assert(text.includes('2026-09-21'));await act('[data-pf-action="config-publish"]');assert((await page.locator('[role="dialog"]').innerText()).includes('已本地重算并发布'));await act('button[data-pf-action="config-close"]')})
      await nav('tasks/MOCK-PT-001');assert((await page.locator('.pf-kpis').innerText()).includes('26'));assert((await page.locator('.pf-kpis').innerText()).includes('09-21'));await act('[data-pf-action="detail-tab"][data-value="计算与版本"]');assert((await page.locator('#pf-content').innerText()).includes('MOCK-RULE-V1'));assert(!(await page.locator('#pf-snapshot').innerText()).includes('MOCK-SLA-1'))
    })
    await check('主管本团队预计权限/外团队保存阻断5次',async()=>{
      await nav('tasks/MOCK-PT-001');await act('[data-pf-field="role"]','select','工厂主管');await act('[data-pf-action="detail-tab"][data-value="跟进记录"]')
      await repeat('supervisor-estimate-scope',async()=>{await act('[data-pf-action="estimate"]');const options=await page.locator('[name="nodeId"] option').evaluateAll(es=>es.map(e=>e.value));assert.deepEqual(options,['W29']);await act('[name="reason"]','fill','越权验证');await act('[name="action"]','fill','不得修改后道团队');await act('[name="expectedAt"]','fill','2026-09-19T10:00');await page.locator('[name="nodeId"]').evaluate(el=>{const option=document.createElement('option');option.value='W30';option.textContent='仅测试篡改';el.append(option);el.value='W30'});await act('[data-pf-action="save-followup"]');assert((await page.locator('#pf-notice').innerText()).includes('保存已阻断'));await act('#pf-overlays [data-pf-action="close"]')})
      await act('[data-pf-field="role"]','select','供应链管理')
    })
    await check('时区/大屏/履约模式5次',async()=>{
      await nav('fulfillment');await repeat('fulfillment-mode',i=>act(`[data-pf-action="fulfillment-mode"][data-value="${i%2?'完整订单':'发货行'}"]`));await repeat('timezone',i=>act('[data-pf-field="timezone"]','select',i%2?'Asia/Shanghai':'Asia/Jakarta'));await repeat('fullscreen',()=>act('[data-pf-action="fullscreen"]'))
    })
  }
  await check('1024主管工作台/1280甘特/1920大屏',async()=>{await page.setViewportSize({width:1024,height:768});await repeat('team-1024-load',()=>nav('teams/'+encodeURIComponent('车缝厂A')));await page.screenshot({path:output+'/team-1024.png'});await page.setViewportSize({width:1280,height:720});for(const path of paths)await repeat('1280-'+path,()=>nav(path));await nav('tasks/MOCK-PT-001');await page.screenshot({path:output+'/task-1280.png'});await page.setViewportSize({width:1920,height:1080});await repeat('overview-1920-load',()=>nav('overview'));await repeat('overview-1920-fullscreen',()=>act('[data-pf-action="fullscreen"]'));await page.screenshot({path:output+'/overview-1920.png'})})
  }
}catch(error){errors.push(String(error));await page.screenshot({path:output+'/failure.png'});console.error(error)}finally{
  await writeFile(output+'/verification.json',JSON.stringify({server,browser:browser.version(),viewport:'1366×768;1280×720;1024×768;1920×1080',checks,samples,errors,performancePass:samples.every(s=>s.ms<200&&!s.error),capturedAt:new Date().toISOString()},null,2));await browser.close()
}
if(errors.length||((deep||layoutV2||metricsV2)&&samples.some(s=>s.ms>=200||s.error)))process.exitCode=1
