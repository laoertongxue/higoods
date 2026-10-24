import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'
const base=process.env.QUALITY_MANAGEMENT_TEST_URL || 'http://127.0.0.1:43270'
let browser:Browser
before(async()=>{browser=await chromium.launch({headless:true})})
after(async()=>{await browser?.close()})
async function isolated(run:(page:Page)=>Promise<void>){
 const context=await browser.newContext(),page=await context.newPage(),errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 await context.addInitScript(()=>{(globalThis as any).__name=(value:unknown)=>value})
 await page.route('**/__quality-config-contract',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh"><head><meta charset="utf-8"></head><body></body></html>'}))
 try{await page.goto(base+'/__quality-config-contract');await run(page);assert.deepEqual(errors,[])}finally{await context.close()}
}
test('配置首读无seed写入，草稿/生效/停用及开检固定快照真实回读',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts')
  let writes=0;const put=IDBObjectStore.prototype.put,add=IDBObjectStore.prototype.add
  IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){writes++;return put.apply(this,args)}
  IDBObjectStore.prototype.add=function(...args:Parameters<typeof add>){writes++;return add.apply(this,args)}
  try{await m.ensureQualityManagementRecords();await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN'});const initialWrites=writes
   const draft=m.buildQualityConfigurationDraft('ADDITIONAL');if(draft.kind!=='ADDITIONAL')throw Error('wrong kind')
   draft.name='M胸围专用要求';draft.applicability.sourceKinds=['PRODUCTION_RETURN','WAREHOUSE_STOCK'];draft.applicability.stages=['POST_FINISHING_QC','WAREHOUSE_STOCK_QC'];draft.applicability.styleIds=['STYLE-CONTRACT'];draft.overrides=[{targetItemId:'garment-size-chest',fields:['criterion'],values:{criterion:'按业务明确M码胸围要求'},applicability:{attributes:[{key:'size',value:'M'}]}}]
   await m.saveQualityConfigurationDraft(draft);const before=await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN',styleId:'STYLE-CONTRACT',attributes:{size:'M'}})
   await m.publishQualityConfiguration(draft.id);const current=await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN',styleId:'STYLE-CONTRACT',attributes:{size:'M'}}),otherSize=await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN',styleId:'STYLE-CONTRACT',attributes:{size:'L'}})
   let immutable=false;try{await m.saveQualityConfigurationDraft({...m.getQualityConfiguration(draft.id)!,name:'非法原改'})}catch{immutable=true}
   await m.disableQualityConfiguration(draft.id);const after=await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN',styleId:'STYLE-CONTRACT',attributes:{size:'M'}})
   const saved=await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE]);await m.ensureQualityManagementRecords()
   return {initialWrites,before:before.items.find(row=>row.id==='garment-size-chest')!.criterion,current:current.items.find(row=>row.id==='garment-size-chest')!.criterion,other:otherSize.items.find(row=>row.id==='garment-size-chest')!.criterion,after:after.items.find(row=>row.id==='garment-size-chest')!.criterion,immutable,status:m.getQualityConfiguration(draft.id)!.status,rows:saved.records.map(row=>({id:row.id,collection:row.collection})),snapshotStill:current.items.find(row=>row.id==='garment-size-chest')!.criterion}
  }finally{IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.add=add}
 })
 assert.equal(result.initialWrites,0);assert.equal(result.current,'按业务明确M码胸围要求');assert.equal(result.snapshotStill,result.current);assert.notEqual(result.before,result.current);assert.equal(result.other,result.before);assert.equal(result.after,result.before);assert.equal(result.status,'DISABLED');assert.equal(result.immutable,true);assert.ok(result.rows.some(row=>row.collection==='quality/scope'));assert.ok(result.rows.some(row=>row.collection==='quality/operation'))
}))
test('两标签同范围并发生效仅一份成功，scope revision拒绝过期配置',{timeout:60000},()=>isolated(async page=>{
 const second=await page.context().newPage();await second.route('**/__quality-config-contract',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await second.goto(base+'/__quality-config-contract')
 const make=async(p:Page,name:string)=>p.evaluate(async name=>{const m=await import('/src/data/fcs/quality-management-records.ts');await m.ensureQualityManagementRecords();const draft=m.buildQualityConfigurationDraft('ADDITIONAL');if(draft.kind!=='ADDITIONAL')throw Error('kind');draft.name=name;draft.applicability.styleIds=['SAME-STYLE'];draft.items=[{id:'item-'+name,dimension:'清洁度',name:'附加检查',content:'检查',criterion:'明确要求',references:[]}];await m.saveQualityConfigurationDraft(draft);return draft.id},name)
 const firstId=await make(page,'first'),secondId=await make(second,'second')
 await Promise.all([page.evaluate(async()=>{await(await import('/src/data/fcs/quality-management-records.ts')).ensureQualityManagementRecords()}),second.evaluate(async()=>{await(await import('/src/data/fcs/quality-management-records.ts')).ensureQualityManagementRecords()})])
 const outcomes=await Promise.all([page.evaluate(async id=>{try{await(await import('/src/data/fcs/quality-management-records.ts')).publishQualityConfiguration(id);return true}catch{return false}},firstId),second.evaluate(async id=>{try{await(await import('/src/data/fcs/quality-management-records.ts')).publishQualityConfiguration(id);return true}catch{return false}},secondId)])
 assert.equal(outcomes.filter(Boolean).length,1)
 const effective=await page.evaluate(async()=>{const m=await import('/src/data/fcs/quality-management-records.ts');await m.ensureQualityManagementRecords();return m.listQualityConfigurations('ADDITIONAL').filter(row=>row.status==='EFFECTIVE').length})
 assert.equal(effective,1)
}))
test('保存事务中止不改变配置/范围/操作记录，原草稿可重试且无localStorage后备',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts');await m.ensureQualityManagementRecords()
  const before=await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE]),draft=m.buildQualityConfigurationDraft('BASIC');draft.name='故障恢复草稿';const put=IDBObjectStore.prototype.put
  let rejected=false
  IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){if(this.name==='records' && String(args[0]?.id).startsWith(m.QUALITY_CONFIGURATION_NAMESPACE+'/config/'))throw new DOMException('隔离故障','QuotaExceededError');return put.apply(this,args)}
  try{await m.saveQualityConfigurationDraft(draft)}catch{rejected=true}finally{IDBObjectStore.prototype.put=put}
  const failed=await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE]),notPublished=m.getQualityConfiguration(draft.id)===undefined
  await m.saveQualityConfigurationDraft(draft);await m.ensureQualityManagementRecords();const saved=m.getQualityConfiguration(draft.id)
  return {rejected,before:JSON.stringify(before.records),failed:JSON.stringify(failed.records),notPublished,name:saved?.name,localKeys:Object.keys(localStorage).filter(key=>key.includes('quality-management')),draftStill:draft.name}
 })
 assert.equal(result.rejected,true);assert.equal(result.before,result.failed);assert.equal(result.notPublished,true);assert.equal(result.name,'故障恢复草稿');assert.equal(result.draftStill,result.name);assert.deepEqual(result.localKeys,[])
}))
test('配置页面真实草稿编辑与M/L覆盖预览，局部输入保持DOM；中心无执行动作',{timeout:60000},()=>isolated(async page=>{
 await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),ui=await import('/src/pages/quality-management/index.ts'),store=(await import('/src/state/store.ts')).appStore
  await ui.prepareQualityManagementPage('/fcs/quality-management/additional-standards')
  const draft=m.buildQualityConfigurationDraft('ADDITIONAL');if(draft.kind!=='ADDITIONAL')throw Error('kind');draft.applicability.sourceKinds=['PRODUCTION_RETURN','WAREHOUSE_STOCK'];draft.applicability.stages=['POST_FINISHING_QC','WAREHOUSE_STOCK_QC'];draft.applicability.styleIds=['UI-STYLE'];draft.overrides=[{targetItemId:'garment-size-chest',fields:['criterion'],values:{criterion:'M码胸围特定要求'},applicability:{attributes:[{key:'size',value:'M'}]}}];await m.saveQualityConfigurationDraft(draft)
  await ui.prepareQualityManagementPage('/fcs/quality-management/additional-standards/'+draft.id+'/edit')
  document.body.innerHTML=ui.renderQualityManagementPage('/fcs/quality-management/additional-standards/'+draft.id+'/edit')
  for(const type of ['input','change','click'])document.addEventListener(type,event=>void ui.handleQualityManagementEvent(event))
  store.navigate=(pathname:string)=>{document.body.innerHTML=ui.renderQualityManagementPage(pathname)}
  ;(window as any).draftId=draft.id
 })
 const name=page.locator('[data-qm-edit="name"]');await name.fill('页面保存的附加标准')
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('[data-qm-edit="name"]')),true)
 await page.locator('[data-qm-preview="styleId"]').fill('UI-STYLE');await page.locator('[data-qm-action="preview"]').click()
 assert.match(await page.locator('[data-qm-preview-result]').innerText(),/M码胸围特定要求/)
 await page.locator('[data-qm-preview="size"]').fill('L');await page.locator('[data-qm-action="preview"]').click()
 assert.doesNotMatch(await page.locator('[data-qm-preview-result]').innerText(),/M码胸围特定要求/)
 await page.locator('[data-qm-action="save"]').click();await page.waitForFunction(()=>document.querySelector('[data-qm-feedback]')?.textContent?.includes('草稿已保存'))
 assert.equal(await page.evaluate(async()=>{const m=await import('/src/data/fcs/quality-management-records.ts');await m.ensureQualityManagementRecords();return m.getQualityConfiguration((window as any).draftId)?.name}),'页面保存的附加标准')
 await page.locator('[data-qm-action="publish"]').click();await page.locator('[data-qm-action="confirm-publish"]').click();await page.waitForFunction(()=>document.querySelector('[data-quality-management-page]')?.textContent?.includes('有效'))
 const readonly=await page.evaluate(async()=>{const ui=await import('/src/pages/quality-management/index.ts');return ['records','audits','statistics'].map(section=>ui.renderQualityManagementPage('/fcs/quality-management/'+section)).join('')})
 assert.doesNotMatch(readonly,/data-qm-action="(?:claim|submit-round|audit-upgrade|complete-inspection)"/)
}))

test('生效集合反向校验基本删项和停用，拒绝后持久数据不变且已生效要求继续可开检',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts');await m.ensureQualityManagementRecords()
  const base=m.listQualityConfigurations('BASIC').find(row=>row.status==='EFFECTIVE')!
  const extra=m.buildQualityConfigurationDraft('ADDITIONAL');if(extra.kind!=='ADDITIONAL')throw Error('kind');extra.applicability.styleIds=['DEPENDENCY-STYLE'];extra.overrides=[{targetItemId:'garment-size-chest',fields:['criterion'],values:{criterion:'独立胸围要求'}}];await m.saveQualityConfigurationDraft(extra);await m.publishQualityConfiguration(extra.id)
  const next=m.buildQualityConfigurationDraft('BASIC',base.id);if(next.kind!=='BASIC')throw Error('kind');next.items=next.items.filter(item=>item.id!=='garment-size-chest');await m.saveQualityConfigurationDraft(next)
  const before=JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records);let publishError='',disableError=''
  try{await m.publishQualityConfiguration(next.id)}catch(error){publishError=String(error)}
  try{await m.disableQualityConfiguration(base.id)}catch(error){disableError=String(error)}
  const after=JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records),snapshot=await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN',styleId:'DEPENDENCY-STYLE'})
  await m.disableQualityConfiguration(extra.id);await m.publishQualityConfiguration(next.id)
  return {publishError,disableError,unchanged:before===after,criterion:snapshot.items.find(item=>item.id==='garment-size-chest')?.criterion,nextStatus:m.getQualityConfiguration(next.id)?.status,baseStatus:m.getQualityConfiguration(base.id)?.status}
 })
 assert.match(result.publishError,/覆盖|原项|检查项/);assert.match(result.disableError,/覆盖|原项|检查项/);assert.equal(result.unchanged,true);assert.equal(result.criterion,'独立胸围要求');assert.equal(result.nextStatus,'EFFECTIVE');assert.equal(result.baseStatus,'DISABLED')
}))

test('类别附加新增项仍被指定款覆盖时，不允许删项或停用；解除依赖后可生效',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts');await m.ensureQualityManagementRecords()
  const category=m.buildQualityConfigurationDraft('ADDITIONAL');if(category.kind!=='ADDITIONAL')throw Error('kind');category.level='STYLE_CATEGORY';category.applicability.styleIds=[];category.applicability.styleCategories=['依赖类别'];category.items=[{id:'category-new-item',dimension:'缝制工艺',name:'指定加固',content:'检查指定加固点',criterion:'加固完整',references:[]}];await m.saveQualityConfigurationDraft(category);await m.publishQualityConfiguration(category.id)
  const style=m.buildQualityConfigurationDraft('ADDITIONAL');if(style.kind!=='ADDITIONAL')throw Error('kind');style.applicability.styleIds=['DEPENDENT-STYLE'];style.applicability.styleCategories=['依赖类别'];style.overrides=[{targetItemId:'category-new-item',fields:['criterion'],values:{criterion:'此款加固要求'}}];await m.saveQualityConfigurationDraft(style);await m.publishQualityConfiguration(style.id)
  const next=m.buildQualityConfigurationDraft('ADDITIONAL',category.id);if(next.kind!=='ADDITIONAL')throw Error('kind');next.items[0].id='replacement-item';await m.saveQualityConfigurationDraft(next)
  const before=JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records);let failures=0
  for(const action of [()=>m.publishQualityConfiguration(next.id),()=>m.disableQualityConfiguration(category.id)])try{await action()}catch{failures++}
  const unchanged=before===JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records)
  await m.disableQualityConfiguration(style.id);await m.publishQualityConfiguration(next.id)
  return {failures,unchanged,status:m.getQualityConfiguration(next.id)?.status}
 })
 assert.equal(result.failures,2);assert.equal(result.unchanged,true);assert.equal(result.status,'EFFECTIVE')
}))

test('未知条件可保留草稿但不能生效，编辑页明确显示并可移除不支持条件',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts'),ui=await import('/src/pages/quality-management/index.ts');await m.prepareQualityConfigurationSchema();await m.ensureQualityManagementRecords()
  const draft=m.buildQualityConfigurationDraft('ADDITIONAL');if(draft.kind!=='ADDITIONAL')throw Error('kind');draft.applicability.styleIds=['UNKNOWN-ATTRIBUTE'];draft.applicability.attributes=[{key:'hasButton',value:'true'}];draft.items=[{id:'button-check',dimension:'辅料配件',name:'扣子',content:'检查扣子',criterion:'牢固',references:[]}];await m.saveQualityConfigurationDraft(draft)
  const before=JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records);let error='';try{await m.publishQualityConfiguration(draft.id)}catch(failure){error=String(failure)}
  await ui.prepareQualityManagementPage('/fcs/quality-management/additional-standards/'+draft.id+'/edit');document.body.innerHTML=ui.renderQualityManagementPage('/fcs/quality-management/additional-standards/'+draft.id+'/edit');document.addEventListener('click',event=>void ui.handleQualityManagementEvent(event))
  return {error,unchanged:before===JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records),status:m.getQualityConfiguration(draft.id)?.status}
 })
 assert.match(result.error,/支持|来源|条件/);assert.equal(result.unchanged,true);assert.equal(result.status,'DRAFT');assert.match(await page.locator('[data-qm-editor]').innerText(),/hasButton/)
 assert.equal(await page.locator('[data-condition-key="hasButton"]').count(),0);await page.locator('[data-qm-action="clear-unsupported-conditions"]').click();assert.doesNotMatch(await page.locator('[data-qm-editor]').innerText(),/hasButton/)
}))

test('真实正式类别ID/名称及款式ID/款号同层冲突在发布前拒绝，原有效配置和修订不变',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts'),runtime=await import('/src/data/pcs-record-runtime.ts')
  await runtime.ensurePcsRecordState(['higood-pcs-style-archive-store-v3','higood-pcs-config-workspace-store-v1']);await m.ensureQualityManagementRecords()
  const dictionary=await import('/src/data/pcs-config-workspace-repository.ts'),styles=await import('/src/data/pcs-style-archive-repository.ts')
  const category=dictionary.listConfigDimensionChoices('productPositioning').find(row=>row.name_zh==='基础款')!,style=styles.listStyleArchives()[0]
  if(!category||!style)throw Error('真实正式身份夹具缺失')
  const create=async(level:'STYLE'|'STYLE_CATEGORY',scope:string)=>{const draft=m.buildQualityConfigurationDraft('ADDITIONAL');if(draft.kind!=='ADDITIONAL')throw Error('kind');draft.level=level;draft.applicability[level==='STYLE'?'styleIds':'styleCategories']=[scope];draft.items=[{id:'identity-'+draft.id,dimension:'清洁度',name:'独立要求',content:'逐项核查',criterion:'符合标准',references:[]}];await m.saveQualityConfigurationDraft(draft);return draft.id}
  const firstCategory=await create('STYLE_CATEGORY',category.id);await m.publishQualityConfiguration(firstCategory)
  const secondCategory=await create('STYLE_CATEGORY',category.name_zh),firstStyle=await create('STYLE',style.styleId);await m.publishQualityConfiguration(firstStyle)
  const secondStyle=await create('STYLE',style.styleCode),before=JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records),errors:string[]=[]
  for(const id of [secondCategory,secondStyle])try{await m.publishQualityConfiguration(id)}catch(error){errors.push(String(error))}
  return {errors,unchanged:before===JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records),statuses:[firstCategory,secondCategory,firstStyle,secondStyle].map(id=>m.getQualityConfiguration(id)?.status)}
 })
 assert.equal(result.errors.length,2);assert.ok(result.errors.every(message=>/重叠/.test(message)));assert.equal(result.unchanged,true);assert.deepEqual(result.statuses,['EFFECTIVE','DRAFT','EFFECTIVE','DRAFT'])
}))

test('两个基本各自只选本环节仍可发布一份复用附加，正式款类别事实可提供原项且未知款拒绝',{timeout:60000},()=>isolated(async page=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/data/fcs/quality-management-records.ts'),db=await import('/src/data/pcs-record-db.ts');await m.ensureQualityManagementRecords()
  const seed=m.getQualityConfiguration('garment-basic-v1');if(seed?.kind!=='BASIC')throw Error('缺少成衣基本标准')
  const production=m.buildQualityConfigurationDraft('BASIC',seed.id);if(production.kind!=='BASIC')throw Error('kind');production.applicability={sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC']};await m.saveQualityConfigurationDraft(production);await m.publishQualityConfiguration(production.id)
  const stock=m.buildQualityConfigurationDraft('BASIC');if(stock.kind!=='BASIC')throw Error('kind');stock.name='库存独立基本标准';stock.items=structuredClone(seed.items);stock.applicability={sourceKinds:['WAREHOUSE_STOCK'],stages:['WAREHOUSE_STOCK_QC']};await m.saveQualityConfigurationDraft(stock);await m.publishQualityConfiguration(stock.id)
  const shared=m.buildQualityConfigurationDraft('ADDITIONAL');if(shared.kind!=='ADDITIONAL')throw Error('kind');shared.name='后道与库存复用附加';shared.applicability={sourceKinds:['PRODUCTION_RETURN','WAREHOUSE_STOCK'],stages:['POST_FINISHING_QC','WAREHOUSE_STOCK_QC'],styleIds:['PAIR-STYLE']};shared.overrides=[{targetItemId:'garment-size-chest',fields:['criterion'],values:{criterion:'两个独立环节共用的胸围附加要求'}}];await m.saveQualityConfigurationDraft(shared);await m.publishQualityConfiguration(shared.id)
  const criteria=await Promise.all((['PRODUCTION_RETURN','WAREHOUSE_STOCK'] as const).map(async sourceKind=>(await m.readInspectionSnapshot({sourceKind,styleId:'PAIR-STYLE'})).items.find(item=>item.id==='garment-size-chest')?.criterion))
  const removed=m.buildQualityConfigurationDraft('BASIC',stock.id);if(removed.kind!=='BASIC')throw Error('kind');removed.items=removed.items.filter(item=>item.id!=='garment-size-chest');await m.saveQualityConfigurationDraft(removed)
  const before=JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records);let removedError='';try{await m.publishQualityConfiguration(removed.id)}catch(error){removedError=String(error)}
  const unchanged=before===JSON.stringify((await db.readPcsRecords([m.QUALITY_CONFIGURATION_NAMESPACE])).records)
  const styles=await import('/src/data/pcs-style-archive-repository.ts'),dictionary=await import('/src/data/pcs-config-workspace-repository.ts')
  const style=styles.listStyleArchives().find(row=>row.productConfigRefs?.productPositioning?.length),categoryId=style?.productConfigRefs?.productPositioning?.[0],category=dictionary.listConfigDimensionChoices('productPositioning').find(row=>row.id===categoryId)
  if(!style||!categoryId||!category)throw Error('缺少正式款式与真实定位关系')
  const provider=m.buildQualityConfigurationDraft('ADDITIONAL');if(provider.kind!=='ADDITIONAL')throw Error('kind');provider.name='正式类别新增项';provider.level='STYLE_CATEGORY';provider.applicability={sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC'],styleCategories:[categoryId]};provider.items=[{id:'formal-category-dependency-item',dimension:'缝制工艺',name:'正式类别检查',content:'核对正式要求',criterion:'类别原始要求',references:[]}];await m.saveQualityConfigurationDraft(provider);await m.publishQualityConfiguration(provider.id)
  const consumer=m.buildQualityConfigurationDraft('ADDITIONAL');if(consumer.kind!=='ADDITIONAL')throw Error('kind');consumer.name='已确证款关联类别原项';consumer.applicability={sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC'],styleIds:[style.styleId]};consumer.overrides=[{targetItemId:'formal-category-dependency-item',fields:['criterion'],values:{criterion:'该款明确覆盖要求'}}];await m.saveQualityConfigurationDraft(consumer);await m.publishQualityConfiguration(consumer.id)
  const known=await m.readInspectionSnapshot({sourceKind:'PRODUCTION_RETURN',styleId:style.styleId,styleCode:style.styleCode,styleCategory:category.name_zh,styleCategoryAliases:[categoryId]})
  const unknown=m.buildQualityConfigurationDraft('ADDITIONAL');if(unknown.kind!=='ADDITIONAL')throw Error('kind');unknown.applicability={sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC'],styleIds:['UNKNOWN-FORMAL-DEPENDENCY']};unknown.overrides=structuredClone(consumer.overrides);await m.saveQualityConfigurationDraft(unknown);let unknownError='';try{await m.publishQualityConfiguration(unknown.id)}catch(error){unknownError=String(error)}
  return {criteria,removedError,unchanged,productionStages:m.getQualityConfiguration(production.id)!.applicability.stages,stockStages:m.getQualityConfiguration(stock.id)!.applicability.stages,criterion:known.items.find(item=>item.id==='formal-category-dependency-item')?.criterion,unknownError,knownStatus:m.getQualityConfiguration(consumer.id)?.status,unknownStatus:m.getQualityConfiguration(unknown.id)?.status}
 })
 assert.deepEqual(result.criteria,['两个独立环节共用的胸围附加要求','两个独立环节共用的胸围附加要求']);assert.deepEqual(result.productionStages,['POST_FINISHING_QC']);assert.deepEqual(result.stockStages,['WAREHOUSE_STOCK_QC'])
 assert.match(result.removedError,/garment-size-chest/);assert.equal(result.unchanged,true);assert.equal(result.criterion,'该款明确覆盖要求');assert.match(result.unknownError,/formal-category-dependency-item/);assert.equal(result.knownStatus,'EFFECTIVE');assert.equal(result.unknownStatus,'DRAFT')
}))

test('真实主页面快速切三业务后类别层级和范围不丢，新增项覆盖及草稿生效持久回读',{timeout:60000},()=>isolated(async page=>{
 await page.goto(base+'/fcs/quality-management/additional-standards')
 await page.locator('[data-qm-action="new"]').click();await page.locator('[data-qm-editor]').waitFor()
 const id=new URL(page.url()).pathname.split('/').at(-2)!
 await page.evaluate(()=>{(window as any).__originalQualityHost=document.querySelector('[data-quality-management-page]')})
 await page.locator('[data-qm-edit="name"]').fill('真实主页面类别快速输入')
 for(const kind of ['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'])await page.locator(`[data-qm-array="applicability.sourceKinds"][value="${kind}"]`).check()
 await page.locator('[data-qm-edit="level"]').selectOption('STYLE_CATEGORY')
 await page.locator('[data-qm-list="applicability.styleCategories"]').fill('基础款')
 await page.locator('[data-qm-list="applicability.styleIds"]').fill('')
 await page.locator('[data-qm-action="add-item"]').click()
 assert.equal(await page.locator('[data-qm-edit="level"]').inputValue(),'STYLE_CATEGORY');assert.equal(await page.locator('[data-qm-list="applicability.styleCategories"]').inputValue(),'基础款')
 for(const [field,value] of [['dimension','缝制工艺'],['name','真实类别额外加固'],['content','检查明确的加固点'],['criterion','符合类别附加加固要求']])await page.locator(`[data-qm-edit="items.0.${field}"]`).fill(value)
 await page.locator('[data-qm-action="add-override"]').click()
 await page.locator('[data-qm-edit="overrides.0.targetItemId"]').selectOption('garment-size-chest')
 await page.locator('[data-qm-edit="overrides.0.values.criterion"]').fill('三业务共用真实类别胸围要求')
 assert.equal(await page.evaluate(()=>(window as any).__originalQualityHost===document.querySelector('[data-quality-management-page]')),true,'字段与局部新增不能替换整页主体')
 await page.locator('[data-qm-action="save"]').click();await page.waitForFunction(()=>document.querySelector('[data-qm-feedback]')?.textContent?.includes('草稿已保存'))
 await page.locator('[data-qm-action="publish"]').click();await page.locator('[data-qm-action="confirm-publish"]').click()
 await page.waitForURL(url=>url.pathname==='/fcs/quality-management/additional-standards/'+id)
 const saved=await page.evaluate(async id=>{const m=await import('/src/data/fcs/quality-management-records.ts');await m.ensureQualityManagementRecords();const row=m.getQualityConfiguration(id);if(row?.kind!=='ADDITIONAL')throw Error('未找到本次附加标准');const snapshots=await Promise.all((['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'] as const).map(sourceKind=>m.readInspectionSnapshot({sourceKind,styleCategory:'基础款'})));return {row,criteria:snapshots.map(snapshot=>snapshot.items.find(item=>item.id==='garment-size-chest')?.criterion),newItems:snapshots.map(snapshot=>snapshot.items.find(item=>item.id===row.items[0].id)?.name)}},id)
 assert.equal(saved.row.status,'EFFECTIVE');assert.equal(saved.row.level,'STYLE_CATEGORY');assert.deepEqual(saved.row.applicability.styleCategories,['基础款']);assert.deepEqual(saved.row.applicability.sourceKinds,['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'])
 assert.deepEqual(saved.criteria,Array(3).fill('三业务共用真实类别胸围要求'));assert.deepEqual(saved.newItems,Array(3).fill('真实类别额外加固'))
 await page.reload();assert.match(await page.locator('[data-quality-management-page]').textContent()||'',/真实主页面类别快速输入/)
}))
