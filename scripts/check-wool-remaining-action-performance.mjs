import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Timed actions always use real UI. Only finalGarment uses an explicit domain-fixture setup; see report.conditions.
const base = process.env.WOOL_BASE_URL || 'http://127.0.0.1:4198'
const output = process.env.WOOL_PERF_OUTPUT || `docs/product-design/wool-two-stage-adjustment/evidence/acceptance-500/remaining-action-performance${process.env.WOOL_ACTION_DEVICE==='1024'?'-1024':''}.json`
const selected = process.env.WOOL_ACTION_FLOWS?.split(',')
const supervisor1024 = process.env.WOOL_ACTION_DEVICE === '1024'
const supervisorFlows = new Set(['设备替换释放档案','设备关联档案列表控件','待加工仓列表控件','待交出仓列表控件','待加工仓交互','待交出仓明细','接收历史图片','主管纱线片接收','成片成衣库存调整转回'])
const repeats = Number(process.env.WOOL_ACTION_REPEATS || 5)
const storeKey = 'higood-fcs-wool-stage-store-v3'
const session = { userId: 'OWN_WOOL_FACTORY_operator', loginId: 'OWN_WOOL_FACTORY_operator', userName: '周哥毛织厂_操作工', roleId: 'ROLE_OPERATOR', factoryId: 'OWN_WOOL_FACTORY', factoryName: '周哥毛织厂', loggedAt: '2026-09-18 10:00:00' }
const q = s => `document.querySelector(${JSON.stringify(s)})`
const visible = s => `(${q(s)}?.getBoundingClientRect().height > 0)`
const absent = s => `!${q(s)}`
const txt = (s, value) => `${q(s)}?.textContent.includes(${JSON.stringify(value)})`
const a = (name, id) => `[data-wool-work-orders-action="${name}"]${id ? `[data-wool-order-id="${id}"]` : ''}`
const f = name => `[data-wool-work-orders-field="${name}"]`
const facts = `JSON.parse(localStorage.getItem(${JSON.stringify(storeKey)}))`
const report = {
  deviceMode:supervisor1024?'supervisor-1024x768':'standard-devices',
  at: new Date().toISOString(), base, cwd: process.cwd(),
  buildIndexSha256: createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),
  head: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  branch: execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
  gate: 'Every sample < 500ms; five independent contexts per flow; no skipped slow samples.',
  measurement: 'Capture actual event before handlers; wait for named result, visible image decode, then two animation frames. Download also waits for complete readable bytes; print also waits for actual generated PDF bytes. Initial navigation is setup, covered by route performance separately.',
  conditions: 'Normal full prototype data. No request stubs, prewarming, or clearing user data. Ordinary scenarios use only real UI writes plus isolated login. The final-garment scenario alone uses the documented wool-final-downstream-review domain fixture on WOOL_SETUP_BASE_URL, disables only the Vite HMR websocket during untimed fixture setup to avoid unrelated documentation-triggered reloads, copies persisted state into a fresh unmodified preview context, then times real receiving UI. No fixture work is timed or claimed as real factory activity.',
  definitions: {}, actions: {}, errors: [], scope: selected ? 'diagnostic subset' : 'remaining named UI actions',
}
fs.mkdirSync(path.dirname(output), { recursive: true })
const save = () => fs.writeFileSync(output, JSON.stringify(report,null,2))
let sample
async function measure(page, name, operation, ready, type='click') {
  sample={...sample,viewport:page.viewportSize()}
  report.definitions[name] = { event:type, finish:ready }
  await page.evaluate(({ready,type,storeKey}) => {
    window.__woolRemainingTiming = undefined
    window.__woolRemainingExternalDone = false
    const ctx={table:document.querySelector('table'),body:document.querySelector('[data-wool-work-orders-table-surface]')?.firstElementChild,storeBefore:localStorage.getItem(storeKey)}
    const test = new Function('ctx',`return Boolean(${ready})`)
    document.addEventListener(type,()=>{
      const start=performance.now(); let finished=false,pending=false
      const observer=new MutationObserver(check)
      function check(){
        if(finished||pending)return
        try{if(!test(ctx))return}catch{return}
        pending=true
        const images=[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0})
        Promise.all(images.map(img=>img.decode())).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(!test(ctx)){pending=false;check();return}
          finished=true;observer.disconnect();const ms=performance.now()-start
          const broken=[...document.querySelectorAll('[data-pda-image-preview-url]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0&&el.querySelector('img')&&!el.querySelector('img').naturalWidth})
          window.__woolRemainingTiming={ms,pass:ms<500&&broken.length===0,imageCount:images.length,visibleImageFailures:broken.length}
        }))).catch(error=>{finished=true;observer.disconnect();window.__woolRemainingTiming={error:String(error),pass:false}})
      }
      observer.observe(document,{subtree:true,childList:true,attributes:true,characterData:true})
      window.__woolRemainingCheck=check
      queueMicrotask(check)
    },{capture:true,once:true})
  },{ready,type,storeKey})
  const profiler=process.env.WOOL_ACTION_PROFILE_NAME===name?await page.context().newCDPSession(page):null
  if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start')}
  try{
    await operation()
    await page.waitForFunction(()=>window.__woolRemainingTiming,null,{timeout:10000})
    if(profiler){const {profile}=await profiler.send('Profiler.stop');fs.writeFileSync(process.env.WOOL_ACTION_PROFILE_OUTPUT||'/private/tmp/wool-action-cpu.json',JSON.stringify(profile));await profiler.detach()}
    ;(report.actions[name] ||= []).push({...sample,...await page.evaluate(()=>window.__woolRemainingTiming)})
  }catch(error){(report.actions[name] ||= []).push({...sample,error:String(error),body:(await page.locator('body').innerText()).slice(-16000),pass:false});throw error}
}
const click=(page,name,selector,ready)=>measure(page,name,()=>page.locator(selector).first().click(),ready)
const fill=(page,name,selector,value)=>measure(page,name,()=>page.locator(selector).fill(value),`${q(selector)}?.value===${JSON.stringify(value)} ${selector.includes('data-wool-work-orders-field')?'&& '+q('[data-wool-work-orders-table-surface]')+'?.firstElementChild!==ctx.body':''}`,'input')
const select=(page,name,selector,value,extra='true')=>measure(page,name,()=>page.locator(selector).selectOption(value),`${q(selector)}?.value===${JSON.stringify(value)} && (${extra})`,'change')
const goto=async(page,route,selector)=>{await page.goto(base+route);await page.locator(selector).first().waitFor()}
async function externalDone(page){await page.evaluate(()=>{window.__woolRemainingExternalDone=true;window.__woolRemainingCheck?.()})}

async function filters(page,stage){
 const prefix=stage==='knitting'?'横机':'缝盘'
 await goto(page,`/fcs/craft/wool/${stage}-orders`,'[data-wool-work-orders-root]')
 await click(page,prefix+'更多筛选展开','[data-wool-work-orders-filters] summary',`${q('[data-wool-work-orders-filters] details')}?.open`)
 const values={factory:'周哥',productionOrderNo:'PO-MZ-008',woolOrderNo:stage==='knitting'?'HJ260918-008':'FP260918-008',outputSku:'CARDIGAN-CREAM-M',...(stage==='knitting'?{yarnSku:'YARN-COTTON-MIXED'}:{sourceCraft:'绣花'}),plannedFrom:'2026-09-01',plannedTo:'2026-09-30'}
 for(const [field,value] of Object.entries(values)){
  await fill(page,prefix+'筛选输入'+field,f(field),value)
  await click(page,prefix+'筛选查询'+field,a('query'),`${q('[data-wool-work-orders-table-surface]')}?.firstElementChild!==ctx.body`)
  await page.locator(f(field)).fill('')
 }
 for(const [field,options] of Object.entries({kind:['WHOLE_GARMENT','PART_PANEL'],external:['YES','NO'],receiptState:['NONE','PARTIAL','RECEIVED'],timeField:['CREATED','PLANNED_START','PLANNED_COMPLETE','REPORTED','RECEIVED','HANDOVER']})){
  for(const value of options){
   await select(page,prefix+'筛选选择'+field+value,f(field),value)
   await click(page,prefix+'筛选查询'+field+value,a('query'),`${q('[data-wool-work-orders-table-surface]')}?.firstElementChild!==ctx.body`)
  }
  if(field!=='timeField')await page.locator(f(field)).selectOption('')
 }
 await click(page,prefix+'更多筛选收起','[data-wool-work-orders-filters] summary',`!${q('[data-wool-work-orders-filters] details')}?.open`)
 await click(page,prefix+'更多筛选全部重置',a('reset-filters'),`${q('table')}!==ctx.table && ${txt('[data-wool-work-orders-total]','14')}`)
 await select(page,prefix+'每页20条',f('pageSize'),'20',`document.querySelectorAll('tbody tr').length===14`)
 await click(page,prefix+'冻结设置打开',a('open-column-settings'),visible(a('restore-column-settings')))
 const freeze=a('toggle-column-freeze')+'[data-wool-work-orders-column-key="order"]'
 const checked=await page.locator(freeze).isChecked()
 await measure(page,prefix+'冻结列切换',()=>page.locator(freeze).setChecked(!checked),`${q(freeze)}?.checked===${!checked} && ${q('table')}!==ctx.table`,'change')
 const drag='[data-standard-list-column-drag][data-drag-source="requirements"]',drop='[data-standard-list-column-drag][data-drag-source="inputs"]'
 await measure(page,prefix+'列拖拽',()=>page.locator(drag).dragTo(page.locator(drop)),`[...document.querySelectorAll('[data-standard-list-column-drag]')].findIndex(e=>e.dataset.dragSource==='requirements') < [...document.querySelectorAll('[data-standard-list-column-drag]')].findIndex(e=>e.dataset.dragSource==='inputs')`,'dragstart')
 await page.locator(a('close-column-settings')).first().click()
 await measure(page,prefix+'导出完成',async()=>{
  const pending=page.waitForEvent('download');await page.locator(a('export')).click();const download=await pending;const stream=await download.createReadStream();let bytes=0;for await(const chunk of stream)bytes+=chunk.length
  if(bytes<100)throw Error('CSV missing actual records');await externalDone(page)
 },`window.__woolRemainingExternalDone && ${txt('[data-wool-work-orders-feedback]','14 条')}`)
 await page.locator(f('keyword')).fill('NO-SUCH-WOOL');await page.locator(a('query')).click()
 await click(page,prefix+'空结果导出',a('export'),txt('[data-wool-work-orders-feedback]','没有可导出'))
}
async function correctionRejected(page){
 await goto(page,'/fcs/craft/wool/linking-orders','[data-wool-work-orders-root]')
 await click(page,'最终交出打开',a('open-handover','WOOL-STAGE-003:LINKING'),visible('[data-wool-dialog-field="qty"]'))
 await fill(page,'最终交出数量','[data-wool-dialog-field="qty"]','5')
 await click(page,'最终交出保存',a('save-handover'),`${absent('[data-wool-business-dialog]')} && ${facts}.handovers.some(r=>r.woolOrderId==='WOOL-STAGE-003:LINKING'&&r.handoverQty===5)`)
 await goto(page,'/fcs/craft/wool/knitting-orders','[data-wool-work-orders-root]')
 await click(page,'下游消费更正记录打开',a('open-qty-list','WOOL-STAGE-003:KNITTING'),visible(a('open-qty-edit')))
 await click(page,'下游消费更正编辑打开',a('open-qty-edit')+'[data-record-type="PROCESS_REPORT"]',visible('[data-wool-dialog-field="qty"]'))
 await fill(page,'下游消费更正数量','[data-wool-dialog-field="qty"]','36')
 await fill(page,'下游消费更正原因','[data-wool-dialog-field="reason"]','实际数量复核')
 await click(page,'下游消费更正拒绝',a('save-qty'),`${txt('[data-wool-overlay-error]','最终交出')} && localStorage.getItem(${JSON.stringify(storeKey)})===ctx.storeBefore`)
}
async function machines(page){
 await goto(page,'/fcs/process-factory/wool/machine-associations?woolOrderId=WOOL-STAGE-002%3AKNITTING','[data-wool-machine-association-dialog]')
 const checkbox=id=>`[data-wool-machine-associations-machine-id="${id}"]`,saveButton='[data-wool-machine-associations-action="save-association"]'
 for(const id of await page.locator('[data-wool-machine-associations-machine-id]:checked').evaluateAll(es=>es.map(e=>e.dataset.woolMachineAssociationsMachineId)))await page.locator(checkbox(id)).uncheck()
 await measure(page,'设备替换选择',()=>page.locator(checkbox('WM-003')).check(),`${q(checkbox('WM-003'))}?.checked && ${q(checkbox('WM-007'))}?.disabled`,'change')
 await click(page,'设备替换保存',saveButton,`${absent('[data-wool-machine-association-dialog]')} && ${facts}.machineAssociations.some(r=>r.woolOrderId==='WOOL-STAGE-002:KNITTING'&&r.machineId==='WM-003')`)
 await click(page,'设备释放打开','[data-wool-machine-associations-action="open-association"][data-machine-id="WM-003"]',visible(checkbox('WM-003')))
 await measure(page,'设备释放取消选择',()=>page.locator(checkbox('WM-003')).uncheck(),`!${q(checkbox('WM-003'))}?.checked`,'change')
 await click(page,'设备释放保存',saveButton,`${absent('[data-wool-machine-association-dialog]')} && !${facts}.machineAssociations.some(r=>r.woolOrderId==='WOOL-STAGE-002:KNITTING')`)
 await goto(page,'/fcs/craft/wool/machines','[data-wool-machines-root]')
 const m=name=>`[data-wool-machines-action="${name}"]`
 await click(page,'设备档案状态打开',m('open-status')+'[data-machine-id="WM-003"]',visible('[data-wool-machines-dialog-field="nextStatus"]'))
 await select(page,'设备档案改维修','[data-wool-machines-dialog-field="nextStatus"]','REPAIR')
 await fill(page,'设备档案原因','[data-wool-machines-dialog-field="reason"]','验收例行保养')
 await click(page,'设备档案状态保存',m('save-status'),`${absent('[data-wool-machines-dialog-field="nextStatus"]')} && ${txt('[data-wool-machines-feedback]','已')}`)
}
async function secondaryListControls(page,prefix,label,warehouseMode){
 const action=name=>`[data-${prefix}-action="${name}"]`,field=name=>`[data-${prefix}-field="${name}"]`
 const changed='document.querySelector("table")!==ctx.table'
 if(warehouseMode){
  const tabs=await page.locator(`[data-${prefix}-action^="tab:"]`).evaluateAll(es=>es.map(e=>e.getAttribute('data-wool-warehouse-action')))
  for(const tab of tabs)await click(page,label+'页签'+tab,action(tab),changed)
  await click(page,label+'返回库存页签',action(tabs[0]),changed)
 }
 const filterInputs=warehouseMode?await page.locator('[data-wool-warehouse-filter]').evaluateAll(es=>es.map(e=>({name:e.dataset.woolWarehouseFilter,select:e.tagName==='SELECT'}))):[{name:'keyword',select:false},{name:'status',select:true},...(prefix==='wool-machine-associations'?[{name:'linked',select:true}]:[])]
 for(const {name,select:isSelect} of filterInputs){
  const selector=warehouseMode?`[data-wool-warehouse-filter="${name}"]`:field(name)
  if(isSelect){
   const options=await page.locator(selector+' option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean))
   for(const value of options)await select(page,label+'筛选'+name+value,selector,value,changed)
  }else await measure(page,label+'筛选'+name+'等待真实空结果',()=>page.locator(selector).fill('NO-MATCH'),`${q(selector)}?.value==='NO-MATCH' && ${changed} && document.querySelector('tbody')?.textContent.includes('暂无')`,'input')
  await click(page,label+'重置'+name,action('reset-filters'),changed)
 }
 for(const value of ['20','50','10'])await select(page,label+'每页'+value,field('pageSize'),value,changed)
 const next=page.locator(action('next-page'))
 if(await next.count()&&await next.isEnabled()){
  await click(page,label+'下一页',action('next-page'),changed)
  await click(page,label+'上一页',action('prev-page'),changed)
 }else (report.notApplicable||=[]).push({...sample,entry:label+'下一页/上一页',reason:'完整当前数据不足一页，真实分页按钮禁用；未减少数据或注入可点击入口。'})
 const sortable=page.locator(action('sort-column')).first()
 if(await sortable.count())await measure(page,label+'排序',()=>sortable.click(),changed)
 await click(page,label+'列设置打开',action('open-column-settings'),visible(action('restore-column-settings')))
 for(const [kind,title]of [['visibility','显示'],['freeze','冻结']]){
  const input=page.locator(action('toggle-column-'+kind)+':not(:disabled)').first()
  if(await input.count()){const checked=await input.isChecked();await measure(page,label+'列'+title,()=>input.setChecked(!checked),changed,'change')}
 }
 const nodes=await page.locator('[data-standard-list-column-drag]').evaluateAll(es=>es.map(e=>e.dataset.dragSource))
 if(nodes.length>1){
  const from=nodes.at(-1),to=nodes[0]
  await measure(page,label+'列顺序拖拽',()=>page.locator(`[data-standard-list-column-drag][data-drag-source="${from}"]`).dragTo(page.locator(`[data-standard-list-column-drag][data-drag-source="${to}"]`)),`[...document.querySelectorAll('[data-standard-list-column-drag]')].findIndex(e=>e.dataset.dragSource===${JSON.stringify(from)}) < [...document.querySelectorAll('[data-standard-list-column-drag]')].findIndex(e=>e.dataset.dragSource===${JSON.stringify(to)})`,'dragstart')
 }
 await click(page,label+'恢复列设置',action('restore-column-settings'),changed)
 await click(page,label+'列设置关闭',action('close-column-settings'),absent(action('restore-column-settings')))
 ;(report.notApplicable||=[]).push({...sample,entry:label+'独立查询/导出',reason:'此现有页面只有自动筛选和重置；页面/处理器没有独立查询或导出入口。自动筛选180ms延迟已计入等待实际表格结果的测量。'})
}
async function machineLists(page){
 for(const [path,prefix,label]of [['machines','wool-machines','设备档案列表'],['machine-associations','wool-machine-associations','设备关联列表']]){
  await goto(page,(path==='machine-associations'?'/fcs/process-factory/wool/':'/fcs/craft/wool/')+path,`[data-${prefix}-root]`)
  await secondaryListControls(page,prefix,label,false)
 }
}
async function warehouseLists(page,mode){
 const label=mode==='process'?'待加工仓列表':'待交出仓列表'
 await goto(page,`/fcs/craft/wool/wait-${mode}-warehouse`,'[data-wool-warehouse-root]')
 await secondaryListControls(page,'wool-warehouse',label,true)
}

async function warehouse(page,mode){
 const prefix=mode==='process'?'待加工仓':'待交出仓', w=name=>`[data-wool-warehouse-action="${name}"]`
 await goto(page,`/fcs/craft/wool/wait-${mode}-warehouse`,'[data-wool-warehouse-root]')
 await click(page,prefix+'明细打开',w('open-detail'),visible('[data-wool-warehouse-dialog]'))
 await click(page,prefix+'明细关闭',w('close-overlay'),absent('[data-wool-warehouse-dialog]'))
 if(mode==='process'){
  const rowId=await page.locator(w('open-issue')).first().getAttribute('data-row-id'),byRow=name=>w(name)+`[data-row-id="${rowId}"]`
  await click(page,'纱线领用打开',byRow('open-issue'),visible('[data-wool-warehouse-dialog-field="qty"]'))
  await fill(page,'纱线领用数量','[data-wool-warehouse-dialog-field="qty"]','1')
  await click(page,'纱线领用保存',w('save-issue'),`${absent('[data-wool-warehouse-dialog]')} && ${txt('[data-wool-warehouse-feedback]','记录纱线')}`)
  await click(page,'纱线退回打开',byRow('open-return'),visible('[data-wool-warehouse-dialog-field="qty"]'))
  await fill(page,'纱线退回数量','[data-wool-warehouse-dialog-field="qty"]','1')
  await click(page,'纱线退回保存',w('save-return'),`${absent('[data-wool-warehouse-dialog]')} && ${txt('[data-wool-warehouse-feedback]','记录纱线')}`)
  await click(page,'纱线移库打开',byRow('open-transfer-out'),visible('[data-wool-warehouse-dialog-field="target"]'))
  const target='[data-wool-warehouse-dialog-field="target"]',options=await page.locator(target+' option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean))
  await select(page,'纱线移库选择库位',target,options.at(-1))
  await fill(page,'纱线移库数量','[data-wool-warehouse-dialog-field="qty"]','1')
  await fill(page,'纱线移库原因','[data-wool-warehouse-dialog-field="reason"]','本厂库位整理')
  await click(page,'纱线移库保存',w('save-transfer-out'),`${absent('[data-wool-warehouse-dialog]')} && ${txt('[data-wool-warehouse-feedback]','转出库存')}`)


 }
}
async function productStockOperations(page){
 await goto(page,'/fcs/craft/wool/wait-handover-warehouse','[data-wool-warehouse-root]')
 const w=name=>`[data-wool-warehouse-action="${name}"]`
  await click(page,'库存调整打开',w('open-adjust'),visible('[data-wool-warehouse-dialog-field="afterQty"]'))
  const afterQty=String(Number(await page.locator('[data-wool-warehouse-dialog-field="afterQty"]').inputValue())+1)
  await fill(page,'库存调整数量','[data-wool-warehouse-dialog-field="afterQty"]',afterQty)
  await fill(page,'库存调整原因','[data-wool-warehouse-dialog-field="reason"]','隔离验收盘点修正')
  await click(page,'库存调整保存',w('save-adjust'),`${absent('[data-wool-warehouse-dialog]')} && ${txt('[data-wool-warehouse-feedback]','已调整')} && localStorage.getItem(${JSON.stringify(storeKey)})!==ctx.storeBefore`)
 await click(page,'成片成衣库存转移打开',w('open-transfer-out'),visible('[data-wool-warehouse-dialog-field="target"]'))
 const target='[data-wool-warehouse-dialog-field="target"]',options=await page.locator(target+' option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean))
 await select(page,'成片成衣库存转移目标',target,options.at(-1))
 await fill(page,'成片成衣库存转移数量','[data-wool-warehouse-dialog-field="qty"]','1')
 await fill(page,'成片成衣库存转移原因','[data-wool-warehouse-dialog-field="reason"]','隔离验收移库')
 await click(page,'成片成衣库存转移保存',w('save-transfer-out'),`${absent('[data-wool-warehouse-dialog]')} && ${txt('[data-wool-warehouse-feedback]','转出库存')} && localStorage.getItem(${JSON.stringify(storeKey)})!==ctx.storeBefore`)
  await click(page,'库存转移记录页签',w('tab:transfers'),`document.querySelector('table')!==ctx.table`)
  await click(page,'库存转回打开',w('open-transfer-back'),visible('[data-wool-warehouse-dialog-field="qty"]'))
  await fill(page,'库存转回数量','[data-wool-warehouse-dialog-field="qty"]','1')
  await fill(page,'库存转回原因','[data-wool-warehouse-dialog-field="reason"]','隔离验收转回')
  await click(page,'库存转回保存',w('save-transfer-back'),`${absent('[data-wool-warehouse-dialog]')} && ${txt('[data-wool-warehouse-feedback]','已转回')} && localStorage.getItem(${JSON.stringify(storeKey)})!==ctx.storeBefore`)
}
async function detail(page,stage){
 const prefix=stage==='knitting'?'横机详情':'缝盘详情',id=stage==='knitting'?'008%3AKNITTING':'010%3ALINKING'
 await goto(page,`/fcs/craft/wool/${stage}-orders/WOOL-STAGE-${id}`,'[data-wool-detail-root]')
 const tabs=await page.locator('[data-wool-detail-action="switch-tab"]').evaluateAll(es=>es.map(e=>e.dataset.tab))
 for(const tab of tabs){
  const button=`[data-wool-detail-action="switch-tab"][data-tab="${tab}"]`
  await click(page,prefix+'页签'+tab,button,`${q(button)}?.classList.contains('bg-blue-600') && ${visible('[data-wool-detail-content]')}`)
  const open='[data-wool-detail-action="open-record"]'
  if(await page.locator(open).count()){
   await click(page,prefix+'记录打开'+tab,open,visible('[data-wool-detail-dialog]'))
   await click(page,prefix+'记录关闭'+tab,'[data-wool-detail-action="close-overlay"]',absent('[data-wool-detail-dialog]'))
  }
 }
}
async function supervisorReceipts(page){
 for(const piece of [false,true]){
  const prefix=piece?'主管外加工片接收':'主管纱线接收',id=piece?'WOOL-STAGE-010%3ALINKING':'WOOL-STAGE-001%3AKNITTING'
  await goto(page,`/fcs/craft/wool/pending-receipts?workOrderId=${id}`,'[data-wool-receiving-page]')
  const action=name=>`[data-wool-receiving-action="${name}"]`,field=name=>`[data-wool-receiving-field="${name}"]`
  await click(page,prefix+'打开',action('receive'),visible(field(piece?'pieceQty':'pcs')))
  for(const [name,value]of(piece?[['pieceQty','1']]:[['pcs','1'],['grossKg','1.062'],['PAPER','1']]))await fill(page,prefix+name+'输入',field(name),value)
  await click(page,prefix+'复核',action('review'),visible(action('save')))
  await click(page,prefix+'实际保存',action('save'),txt('[data-wool-receiving-feedback]','已保存'))
 }
}
async function receiveHistory(page){
 await goto(page,'/fcs/craft/wool/pending-receipts','[data-wool-receiving-page]')
 const history='[data-wool-receiving-action="history"]'
 await click(page,'接收历史明细打开',history,txt('[data-wool-receiving-overlay]','来源 / 实际接收记录'))
 await click(page,'接收历史明细关闭','button[data-wool-receiving-action="close"]',`${q('[data-wool-receiving-overlay]')}?.childElementCount===0`)
 await click(page,'接收款式图片打开','[data-pda-image-preview-url]',visible('[data-pda-image-preview-root] img'))
 await click(page,'接收款式图片按钮关闭','[data-pda-image-preview-root] header [data-pda-image-preview-close]',absent('[data-pda-image-preview-root]'))
 await click(page,'接收款式图片重开','[data-pda-image-preview-url]',visible('[data-pda-image-preview-root] img'))
 await measure(page,'接收款式图片遮罩关闭',()=>page.locator('[data-pda-image-preview-root] [data-pda-image-preview-close]').first().click({position:{x:5,y:5}}),absent('[data-pda-image-preview-root]'))
}
async function imageActions(page,prefix){
 const opener=page.locator('[data-wool-handover-object] [data-pda-image-preview-url]').first()
 for(const close of ['button','backdrop','escape']){
  await measure(page,prefix+'打开'+close,()=>opener.click(),visible('[data-pda-image-preview-root] img'))
  if(close==='escape')await measure(page,prefix+'Esc关闭',()=>page.keyboard.press('Escape'),absent('[data-pda-image-preview-root]'),'keydown')
  else if(close==='backdrop')await measure(page,prefix+'遮罩关闭',()=>page.locator('[data-pda-image-preview-root] [data-pda-image-preview-close]').first().click({position:{x:3,y:3}}),absent('[data-pda-image-preview-root]'))
  else await click(page,prefix+'按钮关闭','[data-pda-image-preview-root] header [data-pda-image-preview-close]',absent('[data-pda-image-preview-root]'))
 }
}
async function wrongFactory(page){
 await page.addInitScript(value=>{
  localStorage.setItem('fcs_pda_session',JSON.stringify(value))
  window.__wrongFactoryTiming=undefined
  const observer=new MutationObserver(()=>{
   const blocked=document.querySelector('[data-pda-wool-access-blocked]')
   if(!blocked||window.__wrongFactoryPending)return
   window.__wrongFactoryPending=true
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const ms=performance.now();observer.disconnect()
    window.__wrongFactoryTiming={ms,pass:ms<500&&!document.querySelector('[data-wool-fact-action]'),blockedText:blocked.textContent}
   }))
  });observer.observe(document,{childList:true,subtree:true})
 },{...session,userId:'ID-F004_admin',loginId:'ID-F004_admin',roleId:'ROLE_ADMIN',factoryId:'ID-F004',factoryName:'PT Mulia Cutting Center',userName:'PT_Mulia_管理员'})
 await page.goto(base+'/fcs/pda/exec/TASK-WOOL-STAGE-002%3AKNITTING')
 await page.waitForFunction(()=>window.__wrongFactoryTiming)
 const name='PDA错厂直达完整阻断'
 report.definitions[name]={event:'navigation start',finish:'Actual foreign-factory access-blocked content + no action + two rendered frames. No wool scanner exists for this factory.'}
 ;(report.actions[name]||=[]).push({...sample,...await page.evaluate(()=>window.__wrongFactoryTiming)})
}
async function pdaScan(page){
 await goto(page,'/fcs/pda/exec','[data-pda-exec-wool-scan]')
 const field='[data-pda-exec-wool-scan] [data-pda-exec-field="searchKeyword"]',scan='[data-pda-exec-action="scan-wool-order"]'
 await fill(page,'PDA错码输入',field,'WRONG-NUMBER')
 await click(page,'PDA错码阻断',scan,txt('[data-pda-exec-wool-scan-feedback]','未识别到'))
 await fill(page,'PDA加工单扫码输入',field,'HJ260918-002')
 await click(page,'PDA加工单扫码直达',scan,`${visible('[data-pda-wool-root]')} && ${txt('[data-pda-wool-root]','HJ260918-002')}`)
}
async function pdaHandover(page,stage){
 const prefix=stage==='KNITTING'?'PDA横机交出':'PDA缝盘交出',id=stage==='KNITTING'?'008':'011'
 await goto(page,`/fcs/pda/handover?tab=handout&taskId=TASK-WOOL-STAGE-${id}%3A${stage}`,'[data-pda-wool-root]')
 const open='[data-wool-fact-action="HANDOVER"]',saveButton='[data-pda-wool-action="save-fact"]'
 await click(page,prefix+'打开',open,visible(saveButton))
 const qty='[data-draft-field="qty"]'
 await fill(page,prefix+'超量输入',qty,'9999')
 await click(page,prefix+'超量拒绝',saveButton,`/最多|不能超过/.test(document.querySelector('[data-pda-wool-overlay-root]')?.textContent||'') && localStorage.getItem(${JSON.stringify(storeKey)})===ctx.storeBefore`)
 await fill(page,prefix+'数量',qty,'1')
 await click(page,prefix+'保存',saveButton,`${absent(saveButton)} && ${facts}.handovers.some(r=>r.woolOrderId==='WOOL-STAGE-${id}:${stage}'&&r.handoverQty===1)`)
}
async function linkingCompletion(page,pda){
 const id='WOOL-STAGE-004:LINKING',prefix=pda?'PDA缝盘完单':'Web缝盘完单'
 await goto(page,'/fcs/craft/wool/linking-orders','[data-wool-work-orders-root]')
 if(await page.locator(a('open-complete',id)).count())throw Error('Unreceived downstream must not complete')
 await page.locator(a('open-handover',id)).click();await page.locator('[data-wool-dialog-field="qty"]').fill('100');await page.locator(a('save-handover')).click();await page.waitForFunction(()=>!document.querySelector('[data-wool-business-dialog]'))
 const handoverId=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).handovers.find(r=>r.woolOrderId==='WOOL-STAGE-004:LINKING'&&!r.automatic).handoverId,storeKey)
 await page.evaluate(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),{...session,userId:'ID-F004_admin',loginId:'ID-F004_admin',roleId:'ROLE_ADMIN',factoryId:'ID-F004',factoryName:'裁床工厂',userName:'裁床工厂主管'})
 await page.setViewportSize({width:400,height:806})
 const headId='HOH-WOOL-'+handoverId.replace(/[^A-Za-z0-9]/g,'').slice(-16)
 await goto(page,`/fcs/pda/handover/${encodeURIComponent(headId)}`,'[data-pda-handoverd-action="open-receiver-writeback"]')
 await imageActions(page,prefix+'裁厂详情款图')
 await click(page,prefix+'下游接收打开','[data-pda-handoverd-action="open-receiver-writeback"]',visible('[data-pda-handoverd-field="writebackQty"]'))
 await fill(page,prefix+'下游实收数量','[data-pda-handoverd-field="writebackQty"]','100')
 await click(page,prefix+'下游实收保存','[data-pda-handoverd-action="submit-receiver-writeback"]',`${absent('[data-pda-handoverd-field="writebackQty"]')} && ${facts}.handovers.find(r=>r.handoverId===${JSON.stringify(handoverId)})?.downstreamReceipt?.actualReceivedQty===100`)
 await page.evaluate(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),session)
 if(pda){
  await goto(page,'/fcs/pda/exec','[data-pda-exec-wool-scan]')
  const scanField='[data-pda-exec-wool-scan] [data-pda-exec-field="searchKeyword"]'
  await fill(page,'PDA多候选生产单输入',scanField,'PO-MZ-004')
  await click(page,'PDA多候选扫码结果','[data-pda-exec-action="scan-wool-order"]',`document.querySelectorAll('[data-pda-wool-scan-candidate]').length===2`)
  await measure(page,'PDA多候选选择缝盘',()=>page.locator('[data-pda-wool-scan-candidate]').filter({hasText:'FP260918-004'}).getByRole('button',{name:'选择此加工单'}).click(),`${visible('[data-pda-wool-root]')} && ${txt('[data-pda-wool-root]','FP260918-004')}`)

  await click(page,prefix+'打开','[data-wool-fact-action="COMPLETE"]',visible('[data-pda-wool-action="save-fact"]'))
  await click(page,prefix+'取消','[data-pda-wool-action="close-overlay"]',absent('[data-pda-wool-action="save-fact"]'))
  await click(page,prefix+'重新打开','[data-wool-fact-action="COMPLETE"]',visible('[data-pda-wool-action="save-fact"]'))
  await fill(page,prefix+'备注','[data-draft-field="remark"]','实际裁厂接收闭合')
  await click(page,prefix+'确认','[data-pda-wool-action="save-fact"]',`${absent('[data-pda-wool-action="save-fact"]')} && ${facts}.completions.some(r=>r.woolOrderId===${JSON.stringify(id)})`)
 }else{
  await page.setViewportSize({width:1366,height:768})
  await goto(page,'/fcs/craft/wool/linking-orders','[data-wool-work-orders-root]')
  await click(page,prefix+'打开',a('open-complete',id),visible(a('save-complete')))
  await click(page,prefix+'取消',a('close-overlay'),absent('[data-wool-business-dialog]'))
  await click(page,prefix+'重新打开',a('open-complete',id),visible(a('save-complete')))
  await fill(page,prefix+'备注','[data-wool-dialog-field="remark"]','实际裁厂接收闭合')
  await click(page,prefix+'确认',a('save-complete'),`${absent('[data-wool-business-dialog]')} && ${facts}.completions.some(r=>r.woolOrderId===${JSON.stringify(id)})`)
 }
}
async function pdaShell(page){
 await goto(page,'/fcs/pda/exec','[data-pda-exec-wool-scan]')
 const button=name=>`[data-pda-shell-action="${name}"]`
 for(const kind of ['todo','account']){
  await click(page,'PDA顶部'+kind+'打开',button('open-'+kind+'-modal'),visible(`[data-pda-${kind}-modal]`))
  await measure(page,'PDA顶部'+kind+'关闭',()=>page.locator(button('close-'+kind+'-modal')).last().click(),absent(`[data-pda-${kind}-modal]`))
 }
 for(const [route,text]of [['task-receive','接单'],['handover','交接'],['warehouse','仓管'],['settlement','结算'],['exec','扫码进入加工填报']]){
  await click(page,'PDA底部导航'+route,`[data-nav="/fcs/pda/${route}"]`,`location.pathname==='/fcs/pda/${route}' && document.body.textContent.includes(${JSON.stringify(text)}) && !document.body.textContent.includes('页面加载中')`)
 }
 await goto(page,'/fcs/pda/exec/TASK-WOOL-STAGE-013%3ALINKING','[data-pda-wool-root]')
 await click(page,'PDA事实记录展开','[data-pda-wool-fact-list-root] summary',`${q('[data-pda-wool-fact-list-root] details')}?.open`)
 await click(page,'PDA事实记录下一页','[data-pda-wool-action="fact-page"][data-page="2"]',txt('[data-pda-wool-fact-list-root]','第 2 /'))
 await click(page,'PDA事实记录上一页','[data-pda-wool-action="fact-page"][data-page="1"]',txt('[data-pda-wool-fact-list-root]','第 1 /'))
 for(const direction of ['inbound','outbound']){
  const route=`/fcs/pda/warehouse/${direction}-records`
  await goto(page,route,'[data-wool-pda-warehouse-flows]')
  await click(page,'PDA'+direction+'来源展开','[data-wool-pda-warehouse-flows] summary',`${q('[data-wool-pda-warehouse-flows] details')}?.open`)
  await click(page,'PDA'+direction+'记录下一页',`[data-nav="${route}?page=2"]`,`${txt('[data-wool-pda-warehouse-flows] footer','2 /')} && location.search==='?page=2'`)
  await click(page,'PDA'+direction+'记录上一页',`[data-nav="${route}?page=1"]`,`${txt('[data-wool-pda-warehouse-flows] footer','1 /')} && location.search==='?page=1'`)
 }
}
async function craftChain(page){
 const task=step=>`WSC:WOOL-STAGE-009:WOOL-STAGE-009:Q1:CARDIGAN-CREAM-M:WOOL-STAGE-009:Q1:step${step}`
 const route=step=>`/fcs/process-factory/special-craft/${step===1?'aux-op-embroidery':'aux-op-curved-teeth-embroidery'}/work-orders/${encodeURIComponent(task(step))}`
 const craftAction=code=>`[data-special-craft-web-action="open-web-status-action-dialog"][data-action-code="${code}"]`
 const receiveAction=name=>`[data-wool-receiving-action="${name}"]`
 for(let step=1;step<=2;step++){
  const prefix='逐站工艺'+step
  await goto(page,route(step),'[data-wool-craft-detail]')
  if(step===2){
   await click(page,prefix+'待接收入口',craftAction('SPECIAL_CRAFT_CONFIRM_RECEIVE'),visible(receiveAction('receive')))
   await click(page,prefix+'实际批次打开',receiveAction('receive'),visible('[data-wool-receiving-field="pieceQty"]'))
   await fill(page,prefix+'实收片数','[data-wool-receiving-field="pieceQty"]','1')
   await click(page,prefix+'实收复核',receiveAction('review'),visible(receiveAction('save')))
   await click(page,prefix+'实收保存',receiveAction('save'),txt('[data-wool-receiving-feedback]','已保存'))
   await goto(page,route(step),'[data-wool-craft-detail]')
  }
  await click(page,prefix+'无效完单打开',craftAction('SPECIAL_CRAFT_COMPLETE_ORDER'),visible('[data-wool-craft-save]'))
  await click(page,prefix+'无效完单拒绝','[data-wool-craft-save]',`${q('#wool-craft-dialog [data-error]')}?.textContent.length>0 && localStorage.getItem(${JSON.stringify(storeKey)})===ctx.storeBefore`)
  await click(page,prefix+'无效完单关闭','[data-wool-craft-close]',absent('#wool-craft-dialog'))
  for(const [code,label,action] of [['SPECIAL_CRAFT_PROCESS_REPORT','加工填报','PROCESS_REPORT'],['SPECIAL_CRAFT_SUBMIT_HANDOVER','交出','HANDOVER']]){
   await click(page,prefix+label+'打开',craftAction(code),visible('#wool-craft-dialog [name="qty"]'))
   await fill(page,prefix+label+'数量','#wool-craft-dialog [name="qty"]','1')
   await click(page,prefix+label+'保存','[data-wool-craft-save]',`${absent('#wool-craft-dialog')} && ${facts}.craftRecords.some(r=>r.taskOrderId===${JSON.stringify(task(step))}&&r.action===${JSON.stringify(action)}&&r.qty===1)`)
  }
 }
 await goto(page,'/fcs/craft/wool/pending-receipts?workOrderId=WOOL-STAGE-009%3ALINKING','[data-wool-receiving-page]')
 await click(page,'末工艺回缝盘批次打开',receiveAction('receive'),visible('[data-wool-receiving-field="pieceQty"]'))
 await fill(page,'末工艺回缝盘数量','[data-wool-receiving-field="pieceQty"]','1')
 await click(page,'末工艺回缝盘复核',receiveAction('review'),visible(receiveAction('save')))
 await click(page,'末工艺回缝盘保存',receiveAction('save'),txt('[data-wool-receiving-feedback]','已保存'))
}
async function downstreamLoads(page){
 await goto(page,'/fcs/craft/wool/linking-orders','[data-wool-work-orders-root]')
 await page.locator(a('open-handover','WOOL-STAGE-004:LINKING')).click()
 await page.locator('[data-wool-dialog-field="qty"]').fill('100')
 await page.locator(a('save-handover')).click()
 await page.waitForFunction(()=>!document.querySelector('[data-wool-business-dialog]'))
 const handoverId=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).handovers.find(r=>r.woolOrderId==='WOOL-STAGE-004:LINKING'&&!r.automatic).handoverId,storeKey)
 await page.evaluate(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),{...session,userId:'ID-F004_admin',loginId:'ID-F004_admin',roleId:'ROLE_ADMIN',factoryId:'ID-F004',factoryName:'裁床工厂',userName:'裁床工厂管理员'})
 const state=await page.context().storageState(),headId='HOH-WOOL-'+handoverId.replace(/[^A-Za-z0-9]/g,'').slice(-16),route='/fcs/pda/handover/'+encodeURIComponent(headId)
 const context=await browser.newContext({viewport:{width:400,height:806},storageState:state}),actual=await context.newPage()
 actual.on('pageerror',error=>report.errors.push({...sample,error:error.message}))
 const record={...sample,route,viewport:{width:400,height:806},setup:'Real Web handover; persisted storage snapshot copied into a new empty-cache recipient context. No modules loaded before measured cold navigation.'}
 ;(report.downstreamRouteLoads ||= []).push(record)
 await actual.addInitScript(()=>{
  window.__startRemainingLoad=(start=0)=>{
   window.__remainingLoad=undefined;let pending=false,done=false
   const observer=new MutationObserver(check)
   function check(){
    if(pending||done||!document.querySelector('[data-pda-handoverd-action="open-receiver-writeback"]'))return
    pending=true
    const images=[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0})
    Promise.all(images.map(img=>img.decode())).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
     done=true;observer.disconnect();const ms=performance.now()-start;const broken=[...document.querySelectorAll('[data-pda-image-preview-url]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0&&el.querySelector('img')&&!el.querySelector('img').naturalWidth});window.__remainingLoad={ms,imageCount:images.length,visibleImageFailures:broken.length,pass:ms<500&&broken.length===0}
    }))).catch(error=>{done=true;observer.disconnect();window.__remainingLoad={error:String(error),pass:false}})
   }
   observer.observe(document,{subtree:true,attributes:true,childList:true});check()
  }
  window.__startRemainingLoad()
 })
 const read=async()=>{await actual.waitForFunction(()=>window.__remainingLoad,null,{timeout:15000});return actual.evaluate(()=>window.__remainingLoad)}
 try{
  const profiler=process.env.WOOL_DETAIL_PROFILE?await context.newCDPSession(actual):null
  if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start')}
  await actual.goto(base+route);record.cold=await read()
  if(profiler){const {profile}=await profiler.send('Profiler.stop');fs.writeFileSync(process.env.WOOL_DETAIL_PROFILE,JSON.stringify(profile));await profiler.detach()}
  await actual.reload();record.refresh=await read()
  await actual.goto(base+'/fcs/pda/handover?tab=handout')
  const card=`article[data-pda-handover-action="open-detail"][data-event-id="${headId}"]`
  await actual.locator(card).waitFor()
  await actual.evaluate(()=>document.addEventListener('click',()=>window.__startRemainingLoad(performance.now()),{capture:true,once:true}))
  await actual.locator(card).click();record.routeSwitch=await read()
  record.pass=[record.cold,record.refresh,record.routeSwitch].every(r=>r.pass)
 }catch(error){record.error=String(error);record.body=(await actual.locator('body').innerText()).slice(-12000);record.pass=false;throw error}finally{await context.close()}
}
async function finalGarment(page){
 // This is the one explicitly documented domain-fixture setup: the prototype has no UI
 // for creating this source snapshot. Timing starts only after opening its real UI.
 const setupBase=process.env.WOOL_SETUP_BASE_URL || 'http://127.0.0.1:5198'
 // Fixture setup alone uses Vite; unrelated documentation saves must not reload
 // its in-flight imports. The timed preview context below has no interception.
 await page.routeWebSocket(url=>url.host===new URL(setupBase).host,()=>{})
 await page.goto(setupBase+'/fcs/craft/wool/knitting-orders')
 await page.locator('[data-wool-work-orders-root]').waitFor()
 const scene=await page.evaluate(async()=>{
  const {prepareWoolFinalDownstreamReviewScenario}=await import('/scripts/fixtures/wool-final-downstream-review.ts')
  const {setPdaSession,listFactoryPdaUsers,createPdaSessionFromUser}=await import('/src/data/fcs/store-domain-pda.ts')
  const scene=prepareWoolFinalDownstreamReviewScenario()
  const users=listFactoryPdaUsers(scene.factoryId),user=users.find(u=>u.roleId==='ROLE_MANAGER')||users[0]
  setPdaSession(createPdaSessionFromUser(user));return scene
 })
 const state=await page.context().storageState()
 for(const origin of state.origins)if(origin.origin===new URL(setupBase).origin)origin.origin=new URL(base).origin
 const context=await browser.newContext({viewport:sample.viewport,storageState:state}),actual=await context.newPage();actual.setDefaultTimeout(10000)
 actual.on('pageerror',error=>report.errors.push({...sample,error:error.message}))
 try{
  await goto(actual,`/fcs/pda/exec/${encodeURIComponent(scene.taskId)}`,'[data-pda-execd-action="special-confirm-receive"]')
  await click(actual,'最终成衣工艺按批次待接收入口','[data-pda-execd-action="special-confirm-receive"]',`document.querySelectorAll('article button[data-nav]').length===2 && document.body.textContent.includes('接收缝盘成衣')`)
  const first=actual.locator('article').filter({hasText:scene.handovers[0].handoverId}).getByRole('button',{name:'接收本批'})
  await measure(actual,'最终成衣工艺实际批次打开',()=>first.click(),visible('[data-pda-handoverd-action="open-receiver-writeback"]'))
  await click(actual,'最终成衣工艺实收打开','[data-pda-handoverd-action="open-receiver-writeback"]',visible('[data-pda-handoverd-field="writebackQty"]'))
  await fill(actual,'最终成衣工艺实收数量','[data-pda-handoverd-field="writebackQty"]','12')
  await click(actual,'最终成衣工艺实收保存','[data-pda-handoverd-action="submit-receiver-writeback"]',`${absent('[data-pda-handoverd-field="writebackQty"]')} && ${facts}.handovers.find(r=>r.handoverId===${JSON.stringify(scene.handovers[0].handoverId)})?.downstreamReceipt?.actualReceivedQty===12`)
 }finally{await context.close()}
}
async function print(page,stage){
 const prefix=stage==='knitting'?'横机':'缝盘',id=stage==='knitting'?'009%3AKNITTING':'005%3ALINKING'
 await goto(page,`/fcs/craft/wool/${stage}-orders`,'[data-wool-work-orders-root]')
 await click(page,prefix+'打印入口生成',`[data-nav="/fcs/craft/wool/${stage}-orders/WOOL-STAGE-${id}/handover-print"]`,`${visible('[data-wool-print-button]:enabled')} && [...document.querySelectorAll('[data-wool-handover-print-page][data-handover-id]')].every(p=>p.querySelector('[data-real-qr] svg'))`)
 await measure(page,prefix+'打印PDF生成',async()=>{
  await page.locator('[data-wool-print-button]').click()
  const bytes=await page.pdf({format:'A4',printBackground:true});if(bytes.length<1000||bytes.subarray(0,4).toString()!=='%PDF')throw Error('Invalid PDF')
  await externalDone(page)
 },`window.__woolRemainingExternalDone && ${visible('[data-wool-print-button]:enabled')}`)
}
const scenarios=[
 ...(supervisor1024?[['主管纱线片接收',supervisorReceipts,1024,768]]:[]),
 ['横机筛选列导出',p=>filters(p,'knitting'),1366,768],['缝盘筛选列导出',p=>filters(p,'linking'),1280,720],
 ['消费后更正拒绝',correctionRejected,1366,768],['设备替换释放档案',machines,1366,768],
 ['设备关联档案列表控件',machineLists,1366,768],['待加工仓列表控件',p=>warehouseLists(p,'process'),1366,768],['待交出仓列表控件',p=>warehouseLists(p,'handover'),1280,720],
 ['成片成衣库存调整转回',productStockOperations,1366,768],
 ['待加工仓交互',p=>warehouse(p,'process'),1366,768],['待交出仓明细',p=>warehouse(p,'handover'),1280,720],
 ['横机详情展开',p=>detail(p,'knitting'),1366,768],['缝盘详情展开',p=>detail(p,'linking'),1280,720],
 ['错厂直达',wrongFactory,360,800],['PDA扫码',pdaScan,360,800],['PDA横机交出',p=>pdaHandover(p,'KNITTING'),360,800],['PDA缝盘交出',p=>pdaHandover(p,'LINKING'),400,806],
 ['缝盘Web闭合',p=>linkingCompletion(p,false),1366,768],['缝盘PDA闭合',p=>linkingCompletion(p,true),400,806],
 ['接收历史图片',receiveHistory,1280,720],
 ['PDA导航记录',pdaShell,400,806],
 ['逐站工艺',craftChain,1366,768],
 ['裁厂接收详情加载',downstreamLoads,1366,768],
 ['最终成衣工艺批次',finalGarment,400,806],
 ['横机打印',p=>print(p,'knitting'),1366,768],['缝盘打印',p=>print(p,'linking'),1366,768],
].filter(([name])=>(!selected||selected.includes(name))&&(!supervisor1024||supervisorFlows.has(name))).map(([name,run,width,height])=>[name,run,supervisor1024?1024:width,supervisor1024?768:height])
report.flows=scenarios.map(([name,,width,height])=>({name,viewport:{width,height}}))
const browser=await chromium.launch();report.browser=browser.version()
try{
 for(const [name,run,width,height]of scenarios){
  for(let iteration=1;iteration<=repeats;iteration++){
   sample={flow:name,iteration,viewport:{width,height}}
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(10000)
   if(name.startsWith('PDA'))await page.addInitScript(value=>localStorage.setItem('fcs_pda_session',JSON.stringify(value)),session)
   page.on('pageerror',error=>report.errors.push({...sample,error:error.message}))
   try{await run(page)}catch(error){report.errors.push({...sample,error:String(error),body:(await page.locator('body').innerText()).slice(-4000)})}
   finally{await context.close();save()}
  }
  console.log(name, 'recorded')
 }
}finally{
 report.buildIndexSha256After=createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex')
 if(report.buildIndexSha256After!==report.buildIndexSha256)report.errors.push({error:'Build changed during measurement; evidence invalid.'})
 report.summary=Object.entries(report.actions).map(([name,samples])=>({name,samples:samples.length,maxMs:Math.max(...samples.map(s=>s.ms??Infinity)),pass:samples.length===5&&samples.every(s=>s.pass)}))
 report.pass=scenarios.length>0&&repeats===5&&report.errors.length===0&&report.summary.every(r=>r.pass)&&(!report.downstreamRouteLoads || (report.downstreamRouteLoads.length===5&&report.downstreamRouteLoads.every(r=>r.pass)))
 save();await browser.close()
}
console.log(JSON.stringify({actions:report.summary.length,failed:report.summary.filter(r=>!r.pass).length,errors:report.errors.length,pass:report.pass}))
if(!report.pass)process.exitCode=1
