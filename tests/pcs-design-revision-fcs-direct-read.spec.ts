import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
// Browser regression: prepare a true PCS design revision from its static eligible source,
// persist receipt before ANY FCS page has been opened, then cold-load the print detail.
// Fixture preparation only; its API duration is never counted as UI performance.
async function createDesignRevision(page){
return await page.evaluate(async()=>{
  const rt=await import('/src/data/pcs-record-runtime.ts'),db=await import('/src/data/pcs-record-db.ts'),sampling=await import('/src/data/pcs-engineering-master-sampling.ts'),bom=await import('/src/data/pcs-engineering-bom-repository.ts')
  await import('/src/data/fcs/design-revision-process-work-order-adapter.ts')
  const dye=await import('/src/data/fcs/dyeing-task-domain.ts'),print=await import('/src/data/fcs/printing-task-domain.ts')
  await rt.ensurePcsRecordState()
  const woolWrites=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes('wool-stage'))woolWrites.push(new Error().stack);return set.call(this,k,v)};const audit=[];const snap=(label)=>{const r=JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')||'null');audit.push({label,wool:Boolean(localStorage.getItem('higood-fcs-wool-stage-store-v3')),sources:r?.sources.length,receipts:r?.receipts.length})};snap('initial');const initial=await db.readPcsRecords(), records=sampling.listEngineeringIndependentSamplingRecords()
  const reference=records.find(item=>item.targetStyleCode==='STYLE-PRJ-202603-011'&&item.status==='COMPLETED'),target=records.find(item=>item.targetStyleCode==='STYLE-PRJ-202603-012')
  const pattern=reference.professionalTasks.find(task=>task.taskType==='BASE_PATTERN').results[0].files.find(file=>file.extension==='prj')
  const buyer={role:'买手',userId:target.buyerId,userName:target.buyerName}
  const draft=await rt.runPcsRecordCommand(()=>sampling.createEngineeringIndependentSampling({sourceStyleId:reference.targetStyleId,targetStyleId:target.targetStyleId,creationReason:'浏览器原生IndexedDB染印原子集成验证',designFiles:target.designFiles,patternHandling:'REUSE',reusedPatternFiles:[pattern],buyer,creationSampleRequirements:[{targetColor:'整款',targetSize:'M',requiredQuantity:1,requirementNote:''}]}))
  await rt.runPcsRecordCommand(()=>bom.saveEngineeringBomVersion({versionId:draft.bomDraftVersionId,...buyer,materialLines:[{materialSkuId:'dr_cotton_dyed',usage:20,quantityBasis:'ORDER_TOTAL',sampleQuantity:1,usageUnit:'Yard',lossRate:0,dyeRequirement:'是',printRequirement:'否'},{materialSkuId:'dr_cotton_print',usage:20,quantityBasis:'ORDER_TOTAL',sampleQuantity:1,usageUnit:'Yard',lossRate:0,dyeRequirement:'否',printRequirement:'是'}]}))
  await rt.runPcsRecordCommand(()=>bom.saveEngineeringBomPricingPlan({ownerStage:'INDEPENDENT_SAMPLING',ownerId:draft.samplingTaskId,...buyer,customCostDecision:'NO_CUSTOM_COST',customCosts:[]}))
  const confirm=()=>sampling.confirmEngineeringIndependentSamplingScheme({samplingTaskId:draft.samplingTaskId,actor:buyer,displaySampleAssignment:sampling.DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],sampleRequirements:[{targetColor:'整款',targetSize:'M',requiredQuantity:1,requirementNote:''}],selectedTaskTypes:['DISPLAY_SAMPLE']})
  const woolBefore=localStorage.getItem('higood-fcs-wool-stage-store-v3'),receivingBefore=localStorage.getItem('higood-factory-material-receiving-v1');snap('before-confirm');const before=await db.readPcsRecords(),beforeParent=JSON.stringify(sampling.getEngineeringIndependentSamplingRecord(draft.samplingTaskId));const originalPut=IDBObjectStore.prototype.put;let injected=false,failed=''
  IDBObjectStore.prototype.put=function(value,...args){if(this.name==='records'&&value.id?.includes('higood-pcs-fcs-design-revision-print-v1')){injected=true;throw new DOMException('injected print write failure','QuotaExceededError')}return originalPut.call(this,value,...args)}
  try{await rt.runPcsRecordCommand(confirm)}catch(error){failed=String(error)}finally{IDBObjectStore.prototype.put=originalPut}
  snap('after-failed-confirm');if(localStorage.getItem('higood-fcs-wool-stage-store-v3')!==woolBefore)throw new Error('Failed PCS confirmation created unrelated wool data: '+JSON.stringify(woolWrites));if(localStorage.getItem('higood-factory-material-receiving-v1')!==receivingBefore)throw new Error('Failed PCS confirmation changed unrelated receiving data');const after=await db.readPcsRecords()
  if(!injected||!failed)throw new Error('FCS put failure injection was not reached: '+failed)
  if(JSON.stringify(after.records)!==JSON.stringify(before.records))throw new Error('PCS/FCS half-save after injected failure')
  if(JSON.stringify(sampling.getEngineeringIndependentSamplingRecord(draft.samplingTaskId))!==beforeParent)throw new Error('PCS memory changed after failure')
  const active=await rt.runPcsRecordCommand(confirm),refs=active.professionalTasks.flatMap(task=>task.processWorkOrderRefs)
  if(refs.length!==2||!refs.some(ref=>ref.processType==='DYEING')||!refs.some(ref=>ref.processType==='PRINTING'))throw new Error('Expected one dye and one print')
  if(!dye.listDyeWorkOrderSourceReferences().some(order=>order.dyeOrderId==='DWO-013'))throw new Error('First design revision rollback lost existing dye orders until refresh')
  if(!print.listPrintWorkOrderSourceReferences().some(order=>order.printOrderId==='PWO-PRINT-001'))throw new Error('First design revision rollback lost existing print orders until refresh')
  const saved=await db.readPcsRecords();const native=Object.fromEntries(['higoods.formal-dye-execution.v1','higoods.formal-print-execution.v1','higood.formal-merged-handout-actions.v1','higood-factory-material-receiving-v1'].map(key=>[key,localStorage.getItem(key)]))
  if(Object.values(native).some(raw=>raw?.includes(draft.samplingTaskId)))throw new Error('design revision written to native localStorage')
  snap('after-success-confirm');return {woolWrites,audit,taskId:draft.samplingTaskId,refs,initialCount:initial.records.length,records:saved.records.length,failed,atomicRollback:true,nativeKeys:Object.entries(native).filter(([,value])=>value!==null).map(([key])=>key)}
 })
}

const base=process.env.PCS_TEST_BASE_URL||'http://127.0.0.1:5173'
const browser=await chromium.launch()
try {
 const context=await browser.newContext(),page=await context.newPage(),errors=[]
 await page.addInitScript(()=>{globalThis.__name=value=>value;Error.stackTraceLimit=50})
 page.on('pageerror',error=>errors.push(String(error)))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 await page.goto(base+'/pcs/testing/orders');await page.getByRole('heading',{name:'测款单',exact:true}).waitFor()
 const fixture=await createDesignRevision(page),printId=fixture.refs.find(ref=>ref.processType==='PRINTING').processOrderId
 const dyeIdsAfterFailedCreationRetry=await page.evaluate(async()=>(await import('/src/data/fcs/dyeing-task-domain.ts')).listDyeWorkOrders().map(order=>order.dyeOrderId))
 assert(dyeIdsAfterFailedCreationRetry.includes('DWO-013'),'uninitialized dye cache must retain static baseline after design revision failure/retry')
 await page.evaluate(async({printId})=>{  const rt=await import('/src/data/pcs-record-runtime.ts');await rt.ensurePcsRecordState();const domain=await import('/src/data/fcs/printing-task-domain.ts'),factories=await import('/src/data/fcs/printing-factories.ts'),command=await import('/src/data/fcs/design-revision-pcs-command.ts'),db=await import('/src/data/pcs-record-db.ts')
  const before=domain.getPrintWorkOrderById(printId);if(!before)throw new Error('direct print order missing after navigation')
  const receiving=await import('/src/data/fcs/factory-receiving.ts'),links=await import('/src/data/fcs/factory-receiving-links.ts'),transferApi=await import('/src/data/fcs/design-revision-material-transfer.ts')
  const factory=factories.listPrintingFactoryOptions().find(factory=>{try{return Boolean(receiving.getDefaultFactoryReceiptPosition(factory.id).locationId)}catch{return false}})
  await command.runDesignRevisionFcsCommand(printId,()=>domain.assignPrintingWorkOrder(printId,{factoryId:factory.id,operatorName:'浏览器验证PPIC'}))
  const order=domain.getPrintWorkOrderById(printId)
  await command.runDesignRevisionFcsCommand(order.taskId,()=>domain.acceptPrintWorkOrderPdaTask(order.taskId,'浏览器验证工厂'))
  const saved=domain.getPrintWorkOrderById(printId);if(saved.acceptanceStatus!=='ACCEPTED')throw new Error('acceptance not saved')
  const transfer=await command.runDesignRevisionFcsCommand(printId,()=>transferApi.createDesignRevisionProcessMaterialTransfer({processType:'PRINTING',processOrderId:printId,issuedBy:'仓管',issuedAt:'2026-10-03 11:40:00'}))
  await command.runDesignRevisionFcsCommand(printId,()=>transferApi.confirmDesignRevisionWarehouseDispatch({processType:'PRINTING',processOrderId:printId,sentQty:20,rolls:[{barcode:'PCS-IDB-PRINT-ROLL',yard:20}],operatorName:'仓管',dispatchedAt:'2026-10-03 11:41:00'}))
  await command.runDesignRevisionFcsCommand(transfer.id,()=>receiving.approveFactoryTransfer(transfer.id,'仓库主管','2026-10-03 11:42:00'))
  const position=receiving.getDefaultFactoryReceiptPosition(factory.id)
  const woolBeforeReceipt=localStorage.getItem('higood-fcs-wool-stage-store-v3')
  await command.runDesignRevisionFcsCommand(transfer.id,()=>links.confirmFactoryMaterialReceipt({id:'PCS-IDB-PRINT-INPUT',factoryId:factory.id,operatorId:'PRINT-WAREHOUSE',operatorName:'印花厂仓管',receivedAt:'2026-10-03 11:43:00',remark:'实际接收20Yard',lines:[{sourceId:transfer.id,sourceLineId:transfer.lines[0].id,...position,rolls:[{barcode:'PCS-IDB-PRINT-ROLL',yard:20,...position}]}]}))
  if(localStorage.getItem('higood-fcs-wool-stage-store-v3')!==woolBeforeReceipt)throw new Error('Non-wool receipt initialized unrelated wool facts inside PCS transaction')
  return {orderId:printId,taskId:saved.taskId,factoryId:saved.printFactoryId}
},{printId})

 const woolBefore=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>key.includes('wool')).map(key=>[key,localStorage.getItem(key)])))
 await page.addInitScript(()=>{globalThis.__woolWrites=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes('wool'))globalThis.__woolWrites.push(key);return original.call(this,key,value)}})
 await page.goto(base+'/fcs/craft/printing/work-orders/'+printId)
 await page.locator('[data-printing-work-order-detail-root]').waitFor()
 const observed=await page.evaluate(async id=>{
  const links=await import('/src/data/fcs/process-order-task-links.ts')
  const view=links.getProcessOrderTaskRelationView(id)
  return {view,woolWrites:globalThis.__woolWrites,wool:Object.fromEntries(Object.keys(localStorage).filter(key=>key.includes('wool')).map(key=>[key,localStorage.getItem(key)]))}
 },printId)
 assert.deepEqual(observed.woolWrites,[],'first direct print read must not initialize wool persistence')
 assert.deepEqual(observed.wool,woolBefore,'first direct print read must preserve unrelated wool keys')
 assert.equal(observed.view?.current.documentId,printId)
 assert(observed.view?.predecessors.some(ref=>ref.documentId===fixture.refs.find(ref=>ref.processType==='PRINTING').professionalTaskId||ref.processCode==='DESIGN_REVISION'),'must preserve design-revision professional task predecessor')
 assert.deepEqual(errors,[])
 const dyeId=fixture.refs.find(ref=>ref.processType==='DYEING').processOrderId
 const rejection=await page.evaluate(async id=>{
  const domain=await import('/src/data/fcs/dyeing-task-domain.ts'),factories=await import('/src/data/fcs/factory-master-store.ts'),cmd=await import('/src/data/fcs/design-revision-pcs-command.ts'),bridge=await import('/src/data/fcs/design-revision-pcs-storage.ts')
  const factory=factories.listFactoryMasterRecords().find(candidate=>candidate.status==='active'&&candidate.eligibility.allowDispatch&&candidate.processAbilities.some(ability=>ability.processCode==='DYE'&&(ability.status??'ACTIVE')==='ACTIVE'&&ability.canReceiveTask!==false))
  await cmd.runDesignRevisionFcsCommand(id,()=>domain.assignDyeWorkOrderFactory(id,{factoryId:factory.id,factoryName:factory.name,assignedAt:'2026-10-03 12:00:00',assignedBy:'回归PPIC'}))
  const order=domain.getDyeWorkOrderById(id)
  await cmd.runDesignRevisionFcsCommand(id,()=>domain.rejectDyeWorkOrderPdaTask(order.taskId,'回归工厂','排期不足','2026-10-03 12:01:00'))
  const stored=JSON.parse(bridge.getDesignRevisionFcsStorage().getItem('higoods.formal-dye-execution.v1'))
  return {order:stored.state.workOrders.find(([key])=>key===id)[1],task:stored.tasks.find(task=>task.taskId===order.taskId)}
 },dyeId)
 assert.equal(rejection.order.acceptanceStatus,'REJECTED')
 assert.equal(rejection.order.dyeFactoryId,'')
 assert.equal(rejection.task.assignedFactoryId,undefined,'rejection must persist matching unassigned order and task')
 assert.equal(rejection.task.acceptanceStatus,'REJECTED')
 await page.goto(base+'/fcs/craft/dyeing/work-orders/'+dyeId)
 await page.getByRole('heading',{name:'染色加工单详情',exact:true}).waitFor();assert((await page.locator('body').innerText()).includes(rejection.order.dyeOrderNo),'cold dye detail must display the actual saved order number')
 const restored=await page.evaluate(async id=>{await(await import('/src/data/pcs-record-runtime.ts')).ensurePcsRecordState();return(await import('/src/data/fcs/dyeing-task-domain.ts')).getDyeWorkOrderById(id)},dyeId)
 assert(restored,'rejected design-revision dye order must survive cold reload')
 assert.equal(restored.acceptanceStatus,'REJECTED')
 assert.equal(restored.rejectionReason,'排期不足')
 assert.equal(restored.dyeFactoryId,'')
 assert.deepEqual(errors,[])
 await page.evaluate(async id=>{const d=await import('/src/data/fcs/printing-task-domain.ts'),c=await import('/src/data/fcs/design-revision-pcs-command.ts');await c.runDesignRevisionFcsCommand(id,()=>{d.startPrintingProduction(id,{id:'PRINT-PREVIEW-PREP',qty:20,operatorName:'验收准备'});d.recordPrintingProductionStage(id,{id:'PRINT-PREVIEW-START',stage:'PRINT',action:'START',operatorName:'验收准备'});d.recordPrintingProductionStage(id,{id:'PRINT-PREVIEW-FINISH',stage:'PRINT',action:'FINISH',qty:20,operatorName:'验收准备'});d.completePrintingWorkOrder(id,{batchId:'PRINT-PREVIEW-OUTPUT',usedQty:20,usedRollCount:1,completedQty:20,completedRollCount:1,lossQty:0,finishOrder:false,printerNo:'',operatorName:'验收准备'});const roll=d.getPrintingWorkOrderById(id).barcodes[0];d.updatePrintingRollBarcode(id,roll.id,{lengthY:20,gsm:roll.gsm,widthCm:roll.widthCm,vatNo:roll.vatNo||'',warehouseName:roll.warehouseName||'',remark:roll.remark||''})})},printId)
 await page.goto(base+'/fcs/craft/printing/work-orders/'+printId)
 await page.locator('[data-printing-action="open-barcodes"]').first().click()
 await page.locator('[data-printing-action="print-one-barcode"]').first().click()
 await page.locator('.print-preview-root').waitFor()
 await page.reload();await page.locator('.print-preview-root').waitFor()
 assert((await page.locator('.print-preview-root').innerText()).includes('20.00 Yard'),'cold printing preview must restore saved roll quantity')
 assert(await page.locator('.print-preview-root svg').count()>0,'cold preview must render a scannable graphic')
 const coldPrint=await page.evaluate(async()=>{const q=new URLSearchParams(location.search),template=await import('/src/pages/print/templates/printing-work-order-template.ts');return template.buildPrintingRollLabelDocument(Object.fromEntries(q))})
 assert.equal(coldPrint.labelItems[0].labelFields.find(field=>field.label==='数量')?.value,'20.00 Yard')
 assert.deepEqual(await page.evaluate(()=>globalThis.__woolWrites),[],'cold print must not write unrelated wool data')
 assert.deepEqual(errors,[])
 await page.goto(base+'/fcs/craft/dyeing/work-orders');await page.locator('[data-dye-work-orders-root]').waitFor()
 assert(!(await page.locator('body').innerText()).includes('页面内容加载失败'),'full dye list must remain readable after design-revision receipt and refresh')
 assert.deepEqual(errors,[])
 await context.close();console.log('PASS: design revision first direct print detail, actual scoped relations, no unrelated wool writes, rejected dye order survives reload, and cold print preview restores saved roll')
} finally {await browser.close()}
