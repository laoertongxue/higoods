import assert from 'node:assert/strict'
import test from 'node:test'
import { productionDemands, type ProductionDemand } from '../../src/data/fcs/production-demands'
import { productionOrders } from '../../src/data/fcs/production-orders'
import type { ProductionDocumentFacts } from '../../src/pages/production-fulfillment/source-document-facts'
import type { FactoryReceivingSource, FactoryReceipt, FactoryDeliveryNote } from '../../src/data/fcs/factory-receiving-types'
import { initialQualityInspections } from '../../src/data/fcs/store-domain-quality-seeds'
import type { ProductionPreparationItem } from '../../src/data/fcs/production-preparation-timing'
import type { TechnicalProcessEntry } from '../../src/data/pcs-technical-data-version-types'
import { assessTask, calculateNetwork, projectManualForecast, dependencyAnalysis } from '../../src/pages/production-fulfillment/calculations'
import { bindProductionTaskSources, projectProductionSourceTask, productionSourceTime, readProductionSourceSnapshot, validateProductionTaskSourceBinding, type PreparationSource, type TechnicalSource, type ExecutionSource } from '../../src/pages/production-fulfillment/source-tasks'

const demand:ProductionDemand={...productionDemands[0],demandId:'SOURCE-DEMAND-1',legacyOrderNo:'SOURCE-PURCHASE-1',spuCode:'STYLE-A',spuName:'来源款式A',requiredQtyTotal:100,createdAt:'2026-09-01 10:00:00',updatedAt:'2026-09-17 10:00:00',productionOrderId:'SOURCE-PO-1',hasProductionOrder:true,skuLines:[{skuCode:'STYLE-A-BLACK-M',size:'M',color:'Black',qty:100}]}
const at='2026-09-17T10:00:00+08:00'
function item(id:string,patch:Partial<ProductionPreparationItem>={}):ProductionPreparationItem {
  return {itemId:id,recordId:'PREP-A',itemType:'梭织基码纸样',required:true,requiredKind:'必做',selectedByMerchandiser:true,selectedAt:'2026-09-01 10:00:00',sequenceGroup:'并行准备',dependsOnItemIds:[],parallelGroup:'PATTERN',status:'待开始',ownerTeam:'版房',ownerName:'版师甲',plannedStartAt:'2026-09-01 10:00:00',plannedFinishAt:'2026-09-10 10:00:00',actualFinishAt:'',evidenceType:'工程任务事件',evidenceSummary:'来自生产准备专业任务',sourceObjectType:'生产准备单',sourceObjectNo:`task-${id}`,sourceHref:`/pcs/production-preparation/plate-making/task-${id}`,overdueHours:999,remark:'',taskId:`task-${id}`,...patch}
}
function preparation(items:ProductionPreparationItem[],patch:Partial<PreparationSource>={}):PreparationSource {
  return {id:'PREP-A',code:'PRP-001',styleRef:'STYLE-A',name:'来源款式A',type:'纯梭织',status:'进行中',taskPlanConfirmedAt:'2026-09-01 10:00:00',updatedAt:'2026-09-17 10:00:00',items,taskSources:items.map(item=>({id:item.taskId!,type:'BASE_PATTERN_WOVEN',status:item.status,assigneeName:'版师甲',sourceType:'ENGINEERING_MASTER'})),reuseLines:[],...patch}
}
function entry(id:string,parents:string[]|undefined,patch:Partial<TechnicalProcessEntry>={}):TechnicalProcessEntry {
  return {id,entryType:'PROCESS_BASELINE',stageCode:'PROD',stageName:'生产',processCode:'SEW',processName:'车缝',assignmentGranularity:'ORDER',defaultDocType:'TASK',taskTypeMode:'PROCESS',isSpecialCraft:false,predecessorEntryIds:parents,routeObjectKey:'MAIN',...patch}
}
function technical(entries:TechnicalProcessEntry[],patch:Partial<NonNullable<TechnicalSource['content']>>={}):TechnicalSource {
  return {record:{technicalVersionId:'TECH-A',technicalVersionCode:'TDV-A-V1',styleId:'style-a',styleCode:'STYLE-A',styleName:'来源款式A',versionLabel:'v1.0',versionStatus:'PUBLISHED',updatedAt:'2026-09-17 10:00:00'},content:{technicalVersionId:'TECH-A',processEntries:entries,processRouteStatus:'CONFIRMED',processRouteConfirmedAt:'2026-09-01 10:00:00',bomItems:[],...patch}}
}

test('production source time uses explicit Shanghai time and rejects date-only completion',()=>{
  assert.equal(productionSourceTime('2026-09-01 10:30:00'),'2026-09-01T10:30:00+08:00')
  assert.equal(productionSourceTime('2026-09-01T02:30:00Z'),'2026-09-01T10:30:00+08:00')
  assert.equal(productionSourceTime('2026-09-01'),null)
})
test('DDS tasks use demand identity and do not invent preparation, budgets, shipment quantities or orders',()=>{
  const task=projectProductionSourceTask({demand,at})
  assert.equal(task.id,demand.demandId);assert.equal(task.purchaseNo,demand.legacyOrderNo)
  assert.equal(task.sourceContext?.demandHref,'/fcs/production/demand-inbox')
  assert.equal(task.nodes.find(node=>node.origin==='decision'&&node.name==='生产需求下达')?.sourceHref,'/fcs/production/demand-inbox')
  assert.equal(task.startedAt,'2026-09-01T10:00:00+08:00');assert.equal(task.preparationNo,'')
  assert(task.nodes.some(node=>node.name==='关联生产准备单'&&node.durationDays===null))
  assert.equal(task.standardDays,null);assert.equal(task.effectiveDueAt,null)
  assert.equal(task.quantityKnown,false);assert.equal(task.shipmentQuantityKnown,false)
  assert.equal(task.progressPct,null);assert.equal(task.hasActualShipmentOrderFacts,false)
  assert.deepEqual(task.productionOrderNos,['SOURCE-PO-1'])
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('实发来源与数量未知')))
  assert(!task.nodes.some(node=>node.actualEndAt&&node.origin==='route'))
})
test('source bindings require existing same-style preparation and published technical version',()=>{
  const prep=preparation([]),version=technical([]).record
  assert.deepEqual(validateProductionTaskSourceBinding(demand,{preparationId:prep.id,technicalVersionId:version.technicalVersionId},[prep],[version]),{preparationId:'PREP-A',technicalVersionId:'TECH-A'})
  assert.throws(()=>validateProductionTaskSourceBinding(demand,{preparationId:'missing'},[prep],[version]),/不存在/)
  assert.throws(()=>validateProductionTaskSourceBinding(demand,{preparationId:prep.id},[{...prep,styleRef:'STYLE-B'}],[version]),/款号.*不一致/)
  assert.throws(()=>validateProductionTaskSourceBinding(demand,{technicalVersionId:version.technicalVersionId},[prep],[{...version,styleCode:'STYLE-B'}]),/款号.*不一致/)
  assert.throws(()=>validateProductionTaskSourceBinding(demand,{technicalVersionId:version.technicalVersionId},[prep],[{...version,versionStatus:'DRAFT'}]),/正式发布/)
})
test('reuse preserves its source/version and does not add past preparation duration',()=>{
  const reused=item('reused',{reusedPriorResult:true,status:'已完成',actualStartAt:'2026-08-01 10:00:00',actualFinishAt:'2026-08-05 10:00:00',effectiveFinishedAt:'2026-08-05 10:00:00',evidenceSummary:'复用前期纸样'})
  const active=item('active',{status:'进行中',actualStartAt:'2026-09-15 10:00:00'})
  const prep=preparation([reused,active],{reuseLines:[{resultType:'BASE_PATTERN_WOVEN',resultLabel:'梭织基码纸样',decision:'复用',sourceTaskId:'OLD-TASK-1',sourceTaskLabel:'前期纸样',sourceResultVersion:'V3',confirmedBy:'跟单甲',confirmedAt:'2026-09-01 10:00:00'}]})
  const task=projectProductionSourceTask({demand,preparation:prep,at}),reuseNode=task.nodes.find(node=>node.sourceEntryId==='reused')!,activeNode=task.nodes.find(node=>node.sourceEntryId==='active')!
  assert.equal(reuseNode.sourceDocumentId,'OLD-TASK-1');assert(reuseNode.dependencyNote?.includes('V3'))
  assert.equal(reuseNode.durationDays,0);assert.equal(reuseNode.includedInProductionDuration,false)
  assert.equal(reuseNode.actualStartAt,null);assert.equal(reuseNode.actualEndAt,null)
  assert.equal(activeNode.durationDays,null,'9-day source plan must not become SLA')
  assert.equal(activeNode.actualElapsedDays,2);assert.equal(activeNode.timeState,'待判定')
  assert.equal(activeNode.actualOverdueDays,0,'plan lateness is not SLA lateness')
})
test('explicit unneeded work is excluded but unconfirmed missing work remains a decision, never zero-day completion',()=>{
  const skipped=item('skipped',{status:'无需',required:false})
  const confirmed=projectProductionSourceTask({demand,preparation:preparation([skipped],{taskSources:[{id:'task-skipped',type:'BASE_PATTERN_WOVEN',status:'未启用',assigneeName:'',sourceType:'ENGINEERING_MASTER'}]}),at})
  assert.equal(confirmed.nodes.some(node=>node.sourceEntryId==='skipped'),false)
  assert(confirmed.sourceContext?.excludedPreparation?.some(row=>row.reason.includes('明确未启用')))
  const unknown=projectProductionSourceTask({demand,preparation:preparation([skipped],{type:'类型待确认',taskPlanConfirmedAt:'',taskSources:[]}),at})
  assert(unknown.nodes.some(node=>node.name==='确认生产准备工作范围'&&node.durationDays===null))
  assert.equal(unknown.sourceContext?.excludedPreparation?.length,0)
})
test('explicit dependencies preserve parallel entries and repeated processes instead of serial sorting',()=>{
  const entries=[entry('A',[],{routeStepNo:1}),entry('B',[],{routeStepNo:2}),entry('C',['A'],{routeStepNo:3}),entry('D',['B'],{routeStepNo:4})]
  const task=projectProductionSourceTask({demand,technical:technical(entries),at}),route=task.nodes.filter(node=>node.origin==='route')
  assert.equal(route.length,4)
  assert.deepEqual(route.find(node=>node.sourceEntryId==='A')!.predecessors,[])
  assert.deepEqual(route.find(node=>node.sourceEntryId==='B')!.predecessors,[])
  assert.deepEqual(route.find(node=>node.sourceEntryId==='C')!.predecessors,[demand.demandId+':route:A'])
  assert.deepEqual(route.find(node=>node.sourceEntryId==='D')!.predecessors,[demand.demandId+':route:B'])
  assert(route.every(node=>node.durationDays===null&&node.actualStartAt===null&&node.factory===undefined))
  assert.equal(calculateNetwork(task.nodes).durationDays,null)
})
test('missing explicit predecessors do not become confirmed parallel roots',()=>{
  const task=projectProductionSourceTask({demand,technical:technical([entry('unknown',undefined)]),at})
  assert.equal(task.sourceContext?.routeStatus,'待确认')
  assert(task.nodes.find(node=>node.sourceEntryId==='unknown')!.predecessors.length>0)
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('未提供显式前置关系')))
  assert.doesNotThrow(()=>calculateNetwork(task.nodes))
})
test('missing predecessor and material SKU discontinuity block route certainty without fabricated edges',()=>{
  const tech=technical([entry('raw',[],{stageCode:'PREP',processName:'原料加工',inputMaterialSkuCode:'WHITE',outputMaterialSkuCode:'BLUE'}),entry('dye',['raw'],{stageCode:'PREP',processName:'辅料染色',inputMaterialSkuCode:'RED',outputMaterialSkuCode:'BLACK'}),entry('sew',['missing'])])
  const task=projectProductionSourceTask({demand,technical:tech,at})
  assert.equal(task.sourceContext?.routeStatus,'待确认')
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('SKU 不连续')))
  assert(task.nodes.some(node=>node.id.endsWith(':route:missing')&&node.durationDays===null&&node.origin==='decision'))
  assert.equal(calculateNetwork(task.nodes).durationDays,null)
})
test('cyclic source dependency stays a blocking issue and source objects remain unchanged',()=>{
  const tech=technical([entry('A',['B']),entry('B',['A'])]),before=structuredClone(tech)
  const task=projectProductionSourceTask({demand,technical:tech,at})
  assert.equal(task.sourceContext?.routeStatus,'待确认')
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('循环')))
  assert.doesNotThrow(()=>calculateNetwork(task.nodes));assert.deepEqual(tech,before)
})
test('read snapshot uses all current demand records without private Mock tasks or automatic same-style preparations',()=>{
  const result=readProductionSourceSnapshot()
  assert.equal(result.tasks.length,productionDemands.length)
  assert.deepEqual(result.tasks.map(task=>task.id),productionDemands.map(demand=>demand.demandId))
  assert(!result.tasks.some(task=>task.id.startsWith('MOCK-')))
  assert(result.tasks.every(task=>task.quantityKnown===false&&task.shipmentQuantityKnown===false))
  assert(result.tasks.every(task=>task.preparationNo===''),'without explicit DDS bindings, same-style preparation is not assumed')
  assert(result.techPacks.length>0)
})

test('continuous material SKU edges stay confirmed while an unconfirmed route remains pending',()=>{
  const entries=[entry('white',[],{stageCode:'PREP',inputMaterialSkuCode:'RAW',outputMaterialSkuCode:'WHITE'}),entry('black',['white'],{stageCode:'PREP',inputMaterialSkuCode:'WHITE',outputMaterialSkuCode:'BLACK'})]
  const confirmed=projectProductionSourceTask({demand,technical:technical(entries),at})
  assert.equal(confirmed.sourceContext?.routeStatus,'已确认')
  assert.equal(confirmed.nodes.find(node=>node.sourceEntryId==='black')?.inputSku,'WHITE')
  assert.equal(confirmed.nodes.find(node=>node.sourceEntryId==='black')?.outputSku,'BLACK')
  assert.equal(confirmed.standardDays,null,'confirmed route alone does not supply SLA')
  const pending=projectProductionSourceTask({demand,technical:technical(entries,{processRouteStatus:'UNCONFIRMED'}),at})
  assert.equal(pending.sourceContext?.routeStatus,'待确认')
  assert(pending.nodes.some(node=>node.name==='确认技术包工艺路线'))
})
test('unverified reuse does not fabricate a completed zero-day result',()=>{
  const task=projectProductionSourceTask({demand,preparation:preparation([item('reuse',{reusedPriorResult:true,status:'已完成'})]),at})
  const node=task.nodes.find(node=>node.sourceEntryId==='reuse')!
  assert.equal(node.durationDays,null);assert.equal(node.businessState,'待确认')
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('复用缺少明确来源或成果版本')))
})
test('binding writes only the DDS association key and is reflected by the next read',()=>{
  const source=readProductionSourceSnapshot(),candidate=source.tasks.find(task=>task.sourceContext?.technicalVersionId)!
  const priorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>(),written:string[]=[]
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{written.push(key);values.set(key,value)},removeItem:(key:string)=>values.delete(key)}})
  try {
    bindProductionTaskSources(candidate.demandNo,{technicalVersionId:candidate.sourceContext!.technicalVersionId})
    assert.deepEqual(written,['dds-production-fulfillment-source-bindings-v1'])
    const read=readProductionSourceSnapshot().tasks.find(task=>task.id===candidate.id)!
    assert.equal(read.sourceContext?.technicalVersionId,candidate.sourceContext?.technicalVersionId)
    assert.equal(read.preparationNo,'')
  } finally {
    if(priorDescriptor)Object.defineProperty(globalThis,'localStorage',priorDescriptor)
    else Reflect.deleteProperty(globalThis,'localStorage')
  }
})

function execution(id:string,patch:Partial<ExecutionSource>={}):ExecutionSource {
  return {taskId:id,taskNo:`TASK-${id}`,productionOrderId:'SOURCE-PO-1',processCode:'SEW',processNameZh:'车缝',stage:'SEWING',qty:100,qtyUnit:'PIECE',status:'IN_PROGRESS',dependsOnTaskIds:[],updatedAt:'2026-09-17 10:00:00',assignedFactoryName:'来源车缝厂',startedAt:'2026-09-15 10:00:00',taskDeadline:'2026-09-16 10:00:00',...patch}
}
test('execution source uses exact production-order identity, assigned factory and responsibility deadline',()=>{
  const task=projectProductionSourceTask({demand,executions:[execution('E1'),execution('OTHER',{productionOrderId:'OTHER-PO'})],at})
  const node=task.nodes.find(node=>node.origin==='execution')!
  assert.equal(task.nodes.filter(node=>node.origin==='execution').length,1)
  assert.equal(node.requiredQuantityKnown,true);assert.match(node.quantityScope!,/来源生产单总量/);assert(task.sourceContext?.gaps.some(g=>g.includes('分配份额待确认')));assert.equal(node.factory,'来源车缝厂');assert.equal(node.businessState,'进行中')
  assert.equal(node.actualStartAt,'2026-09-15T10:00:00+08:00')
  assert.equal(node.sourceHref,'/fcs/progress/board/tasks/E1')
  assert.equal(node.localDueAt,'2026-09-16T10:00:00+08:00');assert.equal(node.actualOverdueDays,1)
  assert.equal(node.durationDays,null,'assigned deadline minus start is not a standard SLA')
  assert.equal(node.qualifiedQty,0);assert.equal(node.quantityKnown,false,'execution status is not quality acceptance quantity')
})
test('only a unique exact technical entry binds execution to route; same-name and split executions stay independent',()=>{
  const tech=technical([entry('A',[]),entry('B',['A'])])
  const task=projectProductionSourceTask({demand,technical:tech,executions:[execution('EA',{sourceEntryId:'A',status:'DONE',finishedAt:'2026-09-16 09:00:00'}),execution('EB',{sourceEntryId:'B',dependsOnTaskIds:['EA']}),execution('UNMAPPED')],at})
  const a=task.nodes.find(node=>node.sourceEntryId==='A')!,b=task.nodes.find(node=>node.sourceEntryId==='B')!
  assert.equal(a.sourceDocumentId,'TASK-EA');assert.equal(a.actualEndAt,'2026-09-16T09:00:00+08:00')
  assert.deepEqual(b.predecessors,[a.id])
  assert(task.nodes.some(node=>node.id.endsWith(':execution:UNMAPPED')))
  const split=projectProductionSourceTask({demand,technical:technical([entry('A',[])]),executions:[execution('SPLIT-A',{sourceEntryId:'A',qty:60}),execution('SPLIT-B',{sourceEntryId:'A',qty:40})],at})
  assert.equal(split.nodes.filter(node=>node.origin==='execution').length,2)
  assert.equal(split.nodes.find(node=>node.origin==='route')!.actualStartAt,null)
})
test('preparation-only source cycles are blocked without depending on a technical pack branch',()=>{
  const a=item('a',{dependsOnItemIds:['b']}),b=item('b',{dependsOnItemIds:['a']})
  const task=projectProductionSourceTask({demand,preparation:preparation([a,b]),at})
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('循环')))
  assert(task.nodes.some(node=>node.name==='修正循环依赖'))
  assert.doesNotThrow(()=>calculateNetwork(task.nodes))
})

// An explicit estimate is a forecast fact even while management SLA remains unknown.
test('source time and manual forecast stay separate from frozen rule examples and missing SLA',()=>{
  const task=projectProductionSourceTask({demand,at:'2026-09-18T10:00:00+08:00'})
  assert.equal(assessTask(task).elapsedDays,17)
  const node=task.nodes.find(n=>!n.actualEndAt)!
  const updated=projectManualForecast(task,node.id,'2026-09-19T10:00:00+08:00')
  assert.equal(updated.nodes.find(n=>n.id===node.id)!.predictedEndAt,'2026-09-19T10:00:00+08:00')
  assert.equal(updated.standardDays,null)
  assert.equal(updated.predictedFinishAt,null)
  assert.equal(updated.nodes.find(n=>n.id===node.id)!.actualEndAt,null)
  assert.throws(()=>projectManualForecast(task,node.id,'2026-09-18T09:00:00+08:00'),/早于/)
})

test('cancelled execution is not a late blocker and unfinished status cannot borrow a stale completion timestamp',()=>{
 const source:ExecutionSource={taskId:'EXEC-X',productionOrderId:demand.productionOrderId!,processCode:'SEW',processNameZh:'车缝',stage:'SEWING',qty:100,qtyUnit:'PIECE',status:'CANCELLED',dependsOnTaskIds:[],updatedAt:'2026-09-17 10:00:00',taskDeadline:'2026-09-10 10:00:00',finishedAt:'2026-09-09 10:00:00'}
 const cancelled=projectProductionSourceTask({demand,executions:[source],at})
 const node=cancelled.nodes.find(n=>n.sourceDocumentId==='EXEC-X')!
 assert.equal(node.actualOverdueDays,0);assert.equal(node.actualEndAt,null);assert.equal(node.timeState,'已取消')
 assert(!cancelled.blocker?.includes('已超本项责任截止'))
 const running=projectProductionSourceTask({demand,executions:[{...source,status:'IN_PROGRESS',startedAt:'2026-09-08 10:00:00'}],at}).nodes.find(n=>n.sourceDocumentId==='EXEC-X')!
 assert.equal(running.actualEndAt,null);assert.equal(running.actualOverdueDays,7);assert.equal(running.timeState,'已逾期')
})

function documents(patch:Partial<ProductionDocumentFacts>={}):ProductionDocumentFacts {return {orders:[],receivingSources:[],receipts:[],deliveries:[],handovers:[],inspections:[],purchases:[],...patch}}
test('document summaries are factual, compact strings; decisions without a document stay unbound',()=>{
  const task=projectProductionSourceTask({demand,executions:[execution('E1',{inputObjectType:'CUT_PIECE',outputObjectType:'GARMENT'})],at})
  const node=task.nodes.find(node=>node.origin==='execution')!
  assert.equal(node.sourceSummary?.documentNo,'TASK-E1')
  assert.equal(node.sourceSummary?.status,'进行中')
  assert(node.sourceSummary?.fields.some(field=>field.label==='应做数量'&&field.value==='100 件'))
  assert.equal(node.inputObjectType,'裁片');assert.equal(node.outputObjectType,'成衣')
  assert.equal(task.nodes.find(node=>node.name==='关联生产准备单')?.sourceSummary,undefined)
  assert(task.nodes.every(node=>!node.sourceSummary||(node.sourceSummary.fields.length<=12&&node.sourceSummary.fields.every(field=>typeof field.value==='string'))))
})
test('formal preparation output connects the exact confirmation, route entry and production version',()=>{
  const ready=item('ready',{itemType:'技术包确认',status:'已完成',effectiveFinishedAt:'2026-09-02 10:00:00'} as Partial<ProductionPreparationItem>)
  const prep=preparation([ready],{formalTechnicalVersionId:'TECH-A',formalPublishedAt:'2026-09-02 11:00:00',taskSources:[{id:ready.taskId!,type:'TECH_PACK_CONFIRMATION',status:'已完成',assigneeName:'技术甲',sourceType:'ENGINEERING_MASTER'}]})
  const tech=technical([entry('A',[])]);Object.assign(tech.record,{createdFromTaskType:'ENGINEERING_MASTER',sourceProjectId:prep.id,createdFromTaskId:ready.taskId,publishedAt:'2026-09-02 11:00:00',publishedBy:'技术甲'})
  const order={...productionOrders[0],productionOrderId:'SOURCE-PO-1',productionOrderNo:'PROD-001',demandId:demand.demandId,sourceDemandIds:[demand.demandId],selectedTechPackVersionId:'TECH-A',techPackSnapshot:null,createdAt:'2026-09-03 10:00:00'}
  const task=projectProductionSourceTask({demand,preparation:prep,technical:tech,documents:documents({orders:[order]}),at})
  const release=task.nodes.find(node=>node.name==='正式技术包发布')!,preparationNode=task.nodes.find(node=>node.sourceEntryId==='ready')!,route=task.nodes.find(node=>node.sourceEntryId==='A')!,production=task.nodes.find(node=>node.name==='生产单建单')!
  assert.deepEqual(release.predecessors,[preparationNode.id]);assert.deepEqual(route.predecessors,[release.id]);assert.deepEqual(production.predecessors,[release.id])
  assert.equal(production.actualEndAt,'2026-09-03T10:00:00+08:00');assert.equal(production.sourceSummary?.documentNo,'PROD-001')
  const other=projectProductionSourceTask({demand,preparation:{...prep,id:'OTHER-PREP'},technical:tech,documents:documents({orders:[{...order,selectedTechPackVersionId:'OTHER-VERSION'}]}),at})
  assert.deepEqual(other.nodes.find(node=>node.name==='正式技术包发布')!.predecessors,[])
  assert.deepEqual(other.nodes.find(node=>node.name==='生产单建单')!.predecessors,[])
  assert(other.sourceContext?.gaps.some(gap=>/版本.*不一致/.test(gap)))
})
test('technical object identity and its material photo are retained without using the style photo',()=>{
  const task=projectProductionSourceTask({demand,technical:technical([entry('fabric',[],{inputObjectType:'FABRIC',outputObjectType:'CUT_PIECE',inputMaterialSkuCode:'FAB-1',inputMaterialName:'正式面料',inputMaterialImageUrl:'/real/fabric.jpg'})]),at})
  const node=task.nodes.find(node=>node.sourceEntryId==='fabric')!
  assert.equal(node.inputObjectType,'面料');assert.equal(node.outputObjectType,'裁片');assert.equal(node.material?.imageUrl,'/real/fabric.jpg')
  const absent=projectProductionSourceTask({demand,technical:technical([entry('no-photo',[],{inputObjectType:'GARMENT',outputObjectType:'PACKED_GARMENT'})]),at})
  assert.equal(absent.nodes.find(node=>node.sourceEntryId==='no-photo')!.material,undefined)
})
function transfer():FactoryReceivingSource {return {id:'TRANSFER-A',documentNo:'DB-A',type:'TRANSFER',origin:{id:'WH-A',name:'原料仓',kind:'WAREHOUSE'} as FactoryReceivingSource['origin'],targetFactoryId:'FACT-A',targetFactoryName:'染色厂甲',createdAt:'2026-09-10 10:00:00',createdBy:'仓管甲',approvedAt:'2026-09-10 11:00:00',lines:[{id:'LINE-A',material:{sku:'FAB-A',name:'白坯面料',kind:'FABRIC',imageUrl:'/fabric-a.jpg',color:'白色',composition:'棉',specification:'幅宽 150cm',batchNo:'LOT-A'},plannedQty:100,unit:'Yard',sentQty:100,rolls:[],label:'卷 A',productionOrderNo:'SOURCE-PO-1'}]}}
function receipt(qty:number):FactoryReceipt {return {id:'RCV-A',factoryId:'FACT-A',operatorName:'厂仓管',operatorId:'USER-A',receivedAt:'2026-09-12 10:00:00',remark:'实收',fingerprint:'source-fact',lines:[{id:'RCV-L-A',sourceId:'TRANSFER-A',sourceLineId:'LINE-A',material:transfer().lines[0].material,qty,unit:'Yard',businessQty:qty,businessUnit:'Yard',sourceDocumentNo:'DB-A',sourceType:'TRANSFER',origin:transfer().origin,warehouseId:'FACT-WH',locationId:'A-01'}]}}
test('material transfer has serial dispatch, transport and receipt with separate responsibility and source identity',()=>{
  const source=transfer(),other={...source,id:'OTHER',documentNo:'OTHER',lines:[{...source.lines[0],productionOrderNo:'OTHER-PO',taskNo:'TASK-E1'}]}
  const partial=projectProductionSourceTask({demand,executions:[execution('E1')],documents:documents({receivingSources:[source,other],receipts:[receipt(40)]}),at})
  const material=partial.nodes.filter(node=>node.sourceEntryId==='TRANSFER-A:LINE-A')
  assert.equal(material.length,3)
  const dispatch=material.find(node=>node.sourceDocumentType==='仓库调拨单')!,transport=material.find(node=>node.sourceDocumentType==='调拨运输跟踪')!,receiving=material.find(node=>node.sourceDocumentType==='工厂实收记录')!
  assert.deepEqual(transport.predecessors,[dispatch.id]);assert.deepEqual(receiving.predecessors,[transport.id])
  assert.equal(dispatch.team,'原料仓');assert.equal(dispatch.factory,undefined)
  assert.equal(transport.team,'物流团队待指派');assert.equal(transport.factory,undefined)
  assert.equal(receiving.team,'染色厂甲');assert.equal(receiving.factory,'染色厂甲');assert.equal(receiving.owner,'厂仓管')
  assert.equal(receiving.businessState,'部分到厂接收');assert.equal(receiving.actualEndAt,null)
  assert(receiving.sourceSummary!.fields.some(field=>field.label==='实际接收'&&field.value==='40 Yard'))
  assert.equal(receiving.quantityKnown,false,'factory receipt is not quality acceptance')
  assert(material.every(node=>node.sourceHref==='/fcs/craft/dyeing/pending-receipts?sourceId=TRANSFER-A&factory=FACT-A'))
  assert(material.every(node=>node.durationDays===null&&node.localDueAt===undefined&&node.sourceSummary!.fields.length<=12))
})
test('approval, sent quantities and delivery-note registration cannot prove physical handout or logistics delivery',()=>{
  const source=transfer(),delivery:FactoryDeliveryNote={id:'DEL-A',barcode:'DLV:DEL-A',createdBy:'送货登记人',deliveredAt:'2026-09-11 10:00:00',lines:[{id:'DEL-L-A',sourceId:source.id,sourceLineId:source.lines[0].id,qty:100,unit:'Yard',rollBarcodes:[]}]}
  const task=projectProductionSourceTask({demand,documents:documents({receivingSources:[source],deliveries:[delivery]}),at})
  const dispatch=task.nodes.find(node=>node.sourceDocumentType==='仓库调拨单')!,transport=task.nodes.find(node=>node.sourceDocumentType==='调拨运输跟踪')!,receiving=task.nodes.find(node=>node.sourceDocumentType==='工厂实收记录')!
  assert.equal(dispatch.actualEndAt,null);assert.equal(transport.actualStartAt,null);assert.equal(transport.actualEndAt,null)
  assert.equal(receiving.actualStartAt,null);assert.equal(receiving.actualEndAt,null)
  assert.equal(transport.actualOverdueDays,0);assert.equal(receiving.actualOverdueDays,0)
  assert.equal(transport.owner,'承运负责人待指派','delivery note creator is not an assigned carrier')
  assert(transport.sourceSummary!.fields.some(field=>field.label==='送货单登记时间'&&field.value.includes('2026-09-11')))
  assert(transport.sourceSummary!.fields.some(field=>field.label==='物流实际交付'&&field.value.includes('未提供')))
  assert(task.sourceContext!.gaps.some(gap=>gap.includes('缺少独立物流交付确认')))
})
test('actual handout starts transportation but factory receipt never backfills logistics delivery or reception start',()=>{
  const source={...transfer(),type:'HANDOUT' as const,handedOutAt:'2026-09-11 09:00:00'}
  const task=projectProductionSourceTask({demand,documents:documents({receivingSources:[source],receipts:[receipt(100)]}),at})
  const dispatch=task.nodes.find(node=>node.sourceDocumentType==='物料交出单')!,transport=task.nodes.find(node=>node.sourceDocumentType==='调拨运输跟踪')!,receiving=task.nodes.find(node=>node.sourceDocumentType==='工厂实收记录')!
  assert.equal(dispatch.actualEndAt,'2026-09-11T09:00:00+08:00');assert.equal(transport.actualStartAt,dispatch.actualEndAt)
  assert.equal(transport.actualEndAt,null);assert.equal(transport.actualElapsedDays,null)
  assert.equal(receiving.businessState,'已到厂接收');assert.equal(receiving.actualEndAt,'2026-09-12T10:00:00+08:00')
  assert.equal(receiving.actualStartAt,null);assert.equal(receiving.actualElapsedDays,null);assert.equal(receiving.quantityKnown,false)
  assert.match(receiving.dependencyNote!,/实收不等于合格/)
})
test('receipt quantities require the same source line, target factory and unit; mixed units never close reception',()=>{
  const source=transfer(),mismatch=receipt(100);mismatch.lines[0].businessUnit='米'
  const unknown=projectProductionSourceTask({demand,documents:documents({receivingSources:[source],receipts:[mismatch]}),at})
  assert.equal(unknown.nodes.find(node=>node.sourceDocumentType==='工厂实收记录')!.actualEndAt,null)
  assert(unknown.sourceContext?.gaps.some(gap=>gap.includes('单位不同')))
  const wrongFactory={...receipt(100),factoryId:'OTHER-FACTORY'},wrongLine=receipt(100);wrongLine.lines[0].sourceLineId='OTHER-LINE'
  const ignored=projectProductionSourceTask({demand,documents:documents({receivingSources:[source],receipts:[wrongFactory,wrongLine]}),at}).nodes.find(node=>node.sourceDocumentType==='工厂实收记录')!
  assert.equal(ignored.businessState,'待工厂实收');assert.equal(ignored.actualEndAt,null)
  assert(ignored.sourceSummary!.fields.some(field=>field.label==='实际接收'&&field.value==='尚无接收记录'))
})
test('voided transfers keep evidence but no effective supply or transport completion',()=>{
  const task=projectProductionSourceTask({demand,documents:documents({receivingSources:[{...transfer(),voidedAt:'2026-09-13 10:00:00'}],receipts:[receipt(100)]}),at})
  const nodes=task.nodes.filter(node=>node.sourceEntryId==='TRANSFER-A:LINE-A')
  assert.equal(nodes.length,3);assert(nodes.every(node=>node.businessState==='已作废'&&node.actualEndAt===null&&node.includedInProductionDuration===false))
})
test('a document handout timestamp does not complete unshipped or partially shipped source lines',()=>{
  const source={...transfer(),type:'HANDOUT' as const,handedOutAt:'2026-09-11 09:00:00'}
  for(const sentQty of [0,40]){
    source.lines[0].sentQty=sentQty
    const task=projectProductionSourceTask({demand,documents:documents({receivingSources:[source]}),at})
    const dispatch=task.nodes.find(node=>node.sourceDocumentType==='物料交出单')!,transport=task.nodes.find(node=>node.sourceDocumentType==='调拨运输跟踪')!
    assert.equal(dispatch.actualEndAt,null);assert.equal(dispatch.businessState,sentQty?'部分实际交出':'本明细尚未交出')
    assert.equal(transport.actualStartAt,sentQty?'2026-09-11T09:00:00+08:00':null)
  }
})
test('only preparation-bound purchase documents are included, and purchase completion never invents warehouse arrival',()=>{
  const prep=preparation([item('purchase')]);prep.taskSources[0].boundPurchaseOrderNos=['PO-A']
  const purchase={purchaseOrderNo:'PO-A',styleCode:'STYLE-A',supplierName:'供应商甲',status:'已完成' as const,orderedAt:'2026-09-02 10:00:00',materialLines:[{materialSkuId:'ZIP-A',materialName:'拉链',quantity:100,unit:'条'}]}
  const task=projectProductionSourceTask({demand,preparation:prep,documents:documents({purchases:[purchase,{...purchase,purchaseOrderNo:'UNBOUND'}]}),at})
  const purchases=task.nodes.filter(node=>node.sourceDocumentType==='辅料采购单')
  assert.equal(purchases.length,1);assert.equal(purchases[0].actualEndAt,null);assert.equal(purchases[0].durationDays,null)
  assert(task.sourceContext?.gaps.some(gap=>gap.includes('未提供到仓入库及调拨事实')))
})
test('quality is scoped to its recorded sample and does not establish shipment orders or whole-order completion',()=>{
  const qc={...initialQualityInspections[0],qcId:'QC-A',productionOrderId:'SOURCE-PO-1',refType:'TASK' as const,refId:'E1',refTaskId:'E1',status:'SUBMITTED' as const,result:'PASS' as const,inspectedQty:10,qualifiedQty:10,unqualifiedQty:0,inspectedAt:'2026-09-16 10:00:00',createdAt:'2026-09-16 09:00:00'}
  const task=projectProductionSourceTask({demand,executions:[execution('E1')],documents:documents({inspections:[qc,{...qc,qcId:'OTHER-QC',productionOrderId:'OTHER-PO',refTaskId:'OTHER',refId:'OTHER'}]}),at})
  const nodes=task.nodes.filter(node=>node.sourceDocumentType==='质检记录');assert.equal(nodes.length,1)
  assert(nodes[0].sourceSummary!.fields.some(field=>field.label==='检验数量'&&field.value==='10 件'))
  assert(nodes[0].sourceSummary!.fields.some(field=>field.label==='合格 / 不合格'&&field.value==='10 件 / 0 件'))
  assert.equal(nodes[0].qualifiedQty,10);assert.equal(nodes[0].requiredQty,10);assert.match(nodes[0].quantityScope!,/抽检/)
  assert.equal(task.quantityKnown,false);assert.equal(task.hasActualShipmentOrderFacts,false);assert.equal(task.shipmentQuantityKnown,false)
})
test('current source snapshot exposes matching handover, quality and transfer documents, not generic placeholders alone',()=>{
  const taskNodes=readProductionSourceSnapshot().tasks.flatMap(task=>task.nodes)
  for(const type of ['工序交接记录','质检记录','仓库调拨单','调拨运输跟踪','工厂实收记录','生产单'])assert(taskNodes.some(node=>node.sourceSummary?.documentType===type),`missing ${type}`)
  assert(taskNodes.every(node=>!node.sourceSummary||node.sourceSummary.fields.every(field=>typeof field.value==='string')))
})

test('only a real same-version production order becomes a root execution predecessor',()=>{
  const tech=technical([entry('A',[])]),order={...productionOrders[0],productionOrderId:'SOURCE-PO-1',productionOrderNo:'PROD-001',demandId:demand.demandId,sourceDemandIds:[demand.demandId],selectedTechPackVersionId:'TECH-A',techPackSnapshot:null,createdAt:'2026-09-03 10:00:00'}
  const root=execution('E1',{dependsOnTaskIds:[]}),child=execution('E2',{dependsOnTaskIds:['E1']})
  const matching=projectProductionSourceTask({demand,technical:tech,executions:[root,child],documents:documents({orders:[order]}),at})
  const production=matching.nodes.find(node=>node.id===demand.demandId+':production-order')!,first=matching.nodes.find(node=>node.sourceDocumentId==='TASK-E1')!,second=matching.nodes.find(node=>node.sourceDocumentId==='TASK-E2')!
  assert(first.predecessors.includes(production.id));assert.deepEqual(second.predecessors,[first.id]);assert.doesNotThrow(()=>calculateNetwork(matching.nodes))
  for(const orders of [[],[{...order,selectedTechPackVersionId:'OTHER-VERSION'}]]){
    const unconfirmed=projectProductionSourceTask({demand,technical:tech,executions:[root],documents:documents({orders}),at})
    assert(!unconfirmed.nodes.find(node=>node.sourceDocumentId==='TASK-E1')!.predecessors.includes(production.id))
  }
})

test('task lead blocker matches dependency analysis instead of blaming an unstarted downstream deadline',()=>{
  const parent=execution('UPSTREAM',{status:'BLOCKED',dependsOnTaskIds:[],taskDeadline:undefined,blockNoteZh:'来源上游待处理'}),child=execution('DOWNSTREAM',{status:'NOT_STARTED',startedAt:undefined,dependsOnTaskIds:['UPSTREAM'],taskDeadline:'2026-09-10 10:00:00'})
  const task=projectProductionSourceTask({demand,executions:[parent,child],at}),lead=dependencyAnalysis(task).blockers[0]
  assert.equal(lead.node.sourceDocumentId,'TASK-UPSTREAM')
  assert.match(task.blocker!,/TASK-UPSTREAM/);assert(!task.blocker!.includes('TASK-DOWNSTREAM'))
  assert.equal(task.responsibleTeam,lead.node.team)
})

test('failed inspection exposes the concrete unqualified quantity as blocker reason',()=>{
 const qc={...initialQualityInspections[0],qcId:'QC-FAILED',productionOrderId:'SOURCE-PO-1',refType:'TASK' as const,refId:'E1',refTaskId:'E1',status:'SUBMITTED' as const,result:'FAIL' as const,inspectedQty:10,qualifiedQty:7,unqualifiedQty:3,inspectedAt:'2026-09-16 10:00:00',createdAt:'2026-09-16 09:00:00'}
 const task=projectProductionSourceTask({demand,executions:[execution('E1')],documents:documents({inspections:[qc]}),at})
 const node=task.nodes.find(node=>node.sourceDocumentId==='QC-FAILED')!
 assert.match(node.blocker!,/检验不合格，不合格 3 件/);assert.match(node.blocker!,/复检放行/)
})

test('category sample images never stand in for a source style; a dedicated source image is retained',()=>{
 for(const imageUrl of ['/jacket-sample.jpg','/tshirt-sample.jpg','/placeholder.svg?height=80&width=80','']){
  const task=projectProductionSourceTask({demand:{...demand,imageUrl},at})
  assert.equal(task.imageUrl,'');assert(task.sourceContext?.gaps.some(gap=>gap.includes('对应实图待补')))
 }
 const imageUrl='/production-confirmation-demo/grey-zip-hoodie.png'
 const task=projectProductionSourceTask({demand:{...demand,imageUrl},at})
 assert.equal(task.imageUrl,imageUrl);assert(!task.sourceContext?.gaps.some(gap=>gap.includes('对应实图待补')))
})
