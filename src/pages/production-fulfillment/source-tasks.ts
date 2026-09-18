/** DDS reads existing prototype business sources. Only explicit DDS bindings are written here. */
import { productionDemands, type ProductionDemand } from '../../data/fcs/production-demands'
import { listRuntimeExecutionTasks, type RuntimeProcessTask } from '../../data/fcs/runtime-process-tasks'
import { listEngineeringMasterOrders } from '../../data/pcs-engineering-master-repository'
import { projectEngineeringMasterToPreparation } from '../../data/pcs-engineering-preparation-projection'
import { getTechnicalDataVersionStoreSnapshot } from '../../data/pcs-technical-data-version-repository'
import { buildDemandStyleId, buildDemandTechnicalVersionId } from '../../data/pcs-production-demand-tech-pack-seeds'
import type { EngineeringPriorResultReuseLine, EngineeringTaskRecord } from '../../data/pcs-engineering-master-types'
import type { ProductionPreparationItem } from '../../data/fcs/production-preparation-timing'
import type { TechnicalDataVersionRecord, TechnicalDataVersionContent, TechnicalProcessEntry } from '../../data/pcs-technical-data-version-types'
import { snapshot } from './fixtures'
import { dependencyAnalysis } from './calculations'
import type { PFNode, PFTask } from './model'
import { readProductionDocumentFacts, type ProductionDocumentFacts } from './source-document-facts'

export interface ProductionSourceBinding { preparationId?: string; technicalVersionId?: string }
export interface PreparationSourceOption { id:string; code:string; styleRef:string; name:string; type:string }
export interface TechnicalSourceOption { id:string; code:string; styleRef:string; name:string }
export interface ProductionSourceSnapshot { asOf:string; tasks:PFTask[]; preparations:PreparationSourceOption[]; techPacks:TechnicalSourceOption[] }
export interface PreparationSource extends PreparationSourceOption {
  status:string; taskPlanConfirmedAt?:string; updatedAt?:string; items:ProductionPreparationItem[];
  taskSources:({id:string;type:string;status:string;assigneeName:string;sourceType:string}&Partial<Pick<EngineeringTaskRecord,'taskName'|'resultQuantity'|'materialLines'|'boundPurchaseOrderNos'|'plannedCompleteAt'|'submittedAt'>>)[];
  reuseLines:EngineeringPriorResultReuseLine[];
  formalTechnicalVersionId?:string; formalPublishedAt?:string;
}
export interface TechnicalSource {
  record:Pick<TechnicalDataVersionRecord,'technicalVersionId'|'technicalVersionCode'|'styleId'|'styleCode'|'styleName'|'versionLabel'|'versionStatus'|'updatedAt'>&Partial<Pick<TechnicalDataVersionRecord,'createdFromTaskId'|'createdFromTaskType'|'sourceProjectId'|'publishedAt'|'publishedBy'>>;
  content:Pick<TechnicalDataVersionContent,'technicalVersionId'|'processEntries'|'processRouteStatus'|'processRouteConfirmedAt'|'processRouteUpdatedAt'|'bomItems'>|null;
}
export type ExecutionSource = Pick<RuntimeProcessTask,'taskId'|'productionOrderId'|'processCode'|'processNameZh'|'stage'|'qty'|'qtyUnit'|'status'|'dependsOnTaskIds'|'updatedAt'> & Partial<Pick<RuntimeProcessTask,'taskNo'|'assignedFactoryName'|'assignedFactoryId'|'acceptedBy'|'startedAt'|'finishedAt'|'taskDeadline'|'sourceArtifactId'|'sourceEntryId'|'sourceEntryIds'|'qtyDisplayUnit'|'scopeLabel'|'blockNoteZh'|'blockRemark'|'inputObjectType'|'outputObjectType'>>
export interface ProductionSourceInput { demand:ProductionDemand; preparation?:PreparationSource; technical?:TechnicalSource; executions?:ExecutionSource[]; documents?:ProductionDocumentFacts; gaps?:string[]; at?:string }
const bindingsKey='dds-production-fulfillment-source-bindings-v1'
const DAY=86_400_000
const preparationTypes:Record<string,string>={PURE_WOVEN:'纯梭织',HEAT_TRANSFER_DIRECT_PRINT:'烫画与直喷',KNIT:'毛织',KNIT_WOVEN:'毛织与梭织'}

/** Source wall times are interpreted in Shanghai, never in the inspecting browser's timezone. */
export function productionSourceTime(value:string|undefined):string|null {
  if(!value||!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value))return null
  const text=value.trim().replace(' ','T'),zoned=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:`${text}+08:00`
  const instant=Date.parse(zoned)
  return Number.isFinite(instant)?`${new Date(instant+8*3_600_000).toISOString().slice(0,19)}+08:00`:null
}
function bindings():Record<string,ProductionSourceBinding> {
  try {
    const storage=globalThis.localStorage
    if(typeof storage?.getItem!=='function')return {}
    const parsed:unknown=JSON.parse(storage.getItem(bindingsKey)||'{}')
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {}
    return Object.fromEntries(Object.entries(parsed).filter(([,value])=>value&&typeof value==='object').map(([id,value])=>{
      const record=value as Record<string,unknown>
      return [id,{preparationId:typeof record.preparationId==='string'?record.preparationId:undefined,technicalVersionId:typeof record.technicalVersionId==='string'?record.technicalVersionId:undefined}]
    }))
  } catch {return {}}
}
export function validateProductionTaskSourceBinding(
  demand:Pick<ProductionDemand,'demandId'|'spuCode'>,
  binding:ProductionSourceBinding,
  preparations:PreparationSourceOption[],
  versions:TechnicalSource['record'][],
):ProductionSourceBinding {
  const normalized={preparationId:binding.preparationId?.trim()||undefined,technicalVersionId:binding.technicalVersionId?.trim()||undefined}
  if(normalized.preparationId){
    const preparation=preparations.find(item=>item.id===normalized.preparationId)
    if(!preparation)throw new Error('所选生产准备单不存在，请返回来源确认。')
    if(preparation.styleRef!==demand.spuCode)throw new Error('生产准备单款号与生产需求不一致，不能关联。')
  }
  if(normalized.technicalVersionId){
    const version=versions.find(item=>item.technicalVersionId===normalized.technicalVersionId)
    if(!version)throw new Error('所选技术包版本不存在，请返回来源确认。')
    if(version.styleCode!==demand.spuCode)throw new Error('技术包款号与生产需求不一致，不能关联。')
    if(version.versionStatus!=='PUBLISHED')throw new Error('只能关联已正式发布的技术包版本。')
  }
  return normalized
}
export function bindProductionTaskSources(demandId:string,binding:ProductionSourceBinding):ProductionSourceBinding {
  const demand=productionDemands.find(item=>item.demandId===demandId)
  if(!demand)throw new Error('生产需求不存在，不能建立关联。')
  const masters=listEngineeringMasterOrders(),technical=getTechnicalDataVersionStoreSnapshot()
  const normalized=validateProductionTaskSourceBinding(demand,binding,masters.map(master=>({id:master.masterOrderId,code:master.masterOrderCode,styleRef:master.styleCode,name:master.styleName,type:preparationTypes[master.preparationType]??'类型待确认'})),technical.records)
  const current=bindings()
  current[demandId]=normalized
  const storage=globalThis.localStorage
  if(typeof storage?.setItem!=='function')throw new Error('当前浏览器无法保存 DDS 来源关联，请检查本地存储。')
  storage.setItem(bindingsKey,JSON.stringify(current))
  return normalized
}
function sourceNode(demand:ProductionDemand,id:string,name:string,stage:string,origin:NonNullable<PFNode['origin']>,at:string):PFNode {
  return {id,taskId:demand.demandId,stage,name,origin,team:'待指派',owner:'待指派',durationDays:null,durationSource:'未读取到正式单项时效规则',predecessors:[],sourceDocumentType:'待关联业务单据',sourceDocumentId:'',unit:'项',requiredQty:1,qualifiedQty:0,quantityKnown:false,requiredQuantityKnown:false,standardStartDay:0,standardEndDay:0,baselineDueAt:null,standardStartAt:null,actualStartAt:null,actualEndAt:null,predictedStartAt:null,predictedEndAt:null,businessState:'待确认',timeState:'待判定',actualElapsedDays:null,actualOverdueDays:0,predictedDelayDays:null,mappingState:'待关联',sourceUpdatedAt:productionSourceTime(demand.updatedAt)??at,timingKind:'action',includedInProductionDuration:true}
}
function routeStage(entry:TechnicalProcessEntry):string {
  if(entry.stageCode==='PREP')return 'S03'
  if(entry.stageCode==='POST')return 'S08'
  const label=`${entry.processCode} ${entry.processName} ${entry.craftName??''}`
  if(/CUT|裁|开裁/i.test(label))return 'S05'
  if(/SEW|车缝|缝制|毛织生产|织片/i.test(label))return 'S07'
  return 'S06'
}
function routeTeam(entry:TechnicalProcessEntry):string {
  const text=`${entry.processCode} ${entry.processName} ${entry.craftName??''}`
  if(/CUT|裁/i.test(text))return '裁床团队待指派'
  if(/SEW|车缝|缝制/i.test(text))return '车缝团队待指派'
  if(/染|DYE/i.test(text))return '染色团队待指派'
  if(/印|PRINT/i.test(text))return '印花团队待指派'
  return entry.stageCode==='POST'?'后道团队待指派':'工艺团队待指派'
}
function elapsed(start:string|null,end:string|null,at:string):number|null {
  if(!start)return null
  const delta=(Date.parse(end??at)-Date.parse(start))/DAY
  return Number.isFinite(delta)&&delta>=0?delta:null
}
function summarize(node:PFNode,fields:[string,string|number|undefined|null][]):void {
  node.sourceSummary={documentType:node.sourceDocumentType,documentNo:node.sourceDocumentId,status:node.businessState,href:node.sourceHref,fields:fields.map(([label,value])=>({label,value:value===undefined||value===null||value===''?'来源未提供':String(value)}))}
}
const objectNames:Record<string,string>={BOM_MATERIAL:'BOM 物料',FABRIC:'面料',YARN:'纱线',ACCESSORY:'辅料',PACKAGING_MATERIAL:'包装物料',CUT_PIECE:'裁片',KNITTED_PANEL:'织片',BINDING_STRIP:'捆条',GARMENT:'成衣',PACKED_GARMENT:'包装成衣'}
function appendDocumentFacts(input:ProductionSourceInput,nodes:PFNode[],executions:ExecutionSource[],at:string,gaps:string[]):void {
  const {demand,documents}=input;if(!documents)return
  const order=documents.orders.find(order=>order.productionOrderId===demand.productionOrderId&&(order.demandId===demand.demandId||order.sourceDemandIds.includes(demand.demandId)))
  const orderKeys=new Set([demand.productionOrderId,order?.productionOrderNo].filter((value):value is string=>Boolean(value)))
  const taskKeys=new Set(executions.flatMap(task=>[task.taskId,task.taskNo].filter((value):value is string=>Boolean(value))))
  const inScope=(orderKey:string|undefined,taskKey:string|undefined)=>orderKey?orderKeys.has(orderKey):Boolean(taskKey&&taskKeys.has(taskKey))
  const executionNode=(id:string|undefined)=>id?nodes.find(node=>node.sourceDocumentType==='工序执行任务'&&(node.sourceDocumentId===id||executions.some(task=>task.taskId===id&&(node.sourceDocumentId===task.taskNo||node.sourceDocumentId===task.taskId)))):undefined
  const boundPurchases=new Set(input.preparation?.taskSources.flatMap(task=>task.boundPurchaseOrderNos??[])??[])
  for(const purchase of documents.purchases.filter(row=>boundPurchases.has(row.purchaseOrderNo)&&row.styleCode===demand.spuCode&&row.accessible!==false)){
    for(const [index,line] of purchase.materialLines.entries()){
      const node=sourceNode(demand,`${demand.demandId}:purchase:${purchase.purchaseOrderNo}:${index}`,`辅料采购 · ${line.materialName}`,'S03','material',at)
      Object.assign(node,{sourceDocumentType:'辅料采购单',sourceDocumentId:purchase.purchaseOrderNo,team:'采购团队',owner:'采购员来源未提供',inputSku:line.materialSkuId,requiredQty:line.quantity,unit:line.unit,requiredQuantityKnown:true,quantityScope:'已绑定准备任务的采购单明细量；本需求份额待确认',actualStartAt:productionSourceTime(purchase.orderedAt),businessState:purchase.status,dependencyNote:'只读准备专业任务绑定的采购单号；采购状态不代替到仓、入库或到厂实收。',mappingState:'准备任务明确绑定采购单号',blocker:'采购来源未提供到仓入库、物流批次和后续调拨关联'})
      summarize(node,[['生产需求',demand.demandId],['生产准备单',input.preparation?.code],['款号',purchase.styleCode],['供应商',purchase.supplierName],['物料',`${line.materialName} · ${line.materialSkuId}`],['采购数量',`${line.quantity} ${line.unit}`],['实际下单',node.actualStartAt],['到仓入库','当前采购事实未提供'],['调拨到厂','当前采购事实未提供']]);nodes.push(node)
    }
    gaps.push(`采购单 ${purchase.purchaseOrderNo} 已关联；源适配器只有下单和采购明细，未提供到仓入库及调拨事实`)
  }
  for(const source of documents.receivingSources){
    for(const line of source.lines.filter(line=>inScope(line.productionOrderNo,line.taskNo))){
      const prefix=`${demand.demandId}:transfer:${source.id}:${line.id}`
      const dispatch=sourceNode(demand,`${prefix}:dispatch`,`${source.type==='HANDOUT'?'物料交出':'调拨审核与交出'} · ${line.material.name}`,'S03','material',at)
      const transport=sourceNode(demand,`${prefix}:transport`,`运输到厂 · ${line.material.name}`,'S03','material',at)
      const receiving=sourceNode(demand,`${prefix}:receiving`,`工厂实收 · ${line.material.name}`,'S03','material',at)
      const createdAt=productionSourceTime(source.createdAt),approvedAt=productionSourceTime(source.approvedAt),handedOutAt=productionSourceTime(source.handedOutAt)
      const fullySent=Boolean(handedOutAt)&&line.plannedQty>0&&line.sentQty>=line.plannedQty
      const receipts=documents.receipts.flatMap(receipt=>receipt.lines.filter(row=>row.sourceId===source.id&&row.sourceLineId===line.id&&receipt.factoryId===source.targetFactoryId).map(row=>({receipt,row})))
      const comparable=receipts.filter(({row})=>(row.businessUnit||row.unit)===line.unit),received=comparable.reduce((sum,{row})=>sum+(row.businessQty??row.qty),0)
      const allComparable=comparable.length===receipts.length,fullyReceived=!source.voidedAt&&allComparable&&line.plannedQty>0&&received>=line.plannedQty
      const validReceiptTimes=receipts.map(({receipt})=>productionSourceTime(receipt.receivedAt)),receivedAt=fullyReceived&&validReceiptTimes.every(Boolean)?(validReceiptTimes as string[]).sort().at(-1)??null:null
      const deliveries=(documents.deliveries??[]).flatMap(delivery=>delivery.lines.filter(row=>row.sourceId===source.id&&row.sourceLineId===line.id).map(row=>({delivery,row})))
      // deliveredAt is written by “保存送货单”, not by a carrier arrival/hand-off confirmation.
      // A delivery note therefore supplies dispatch evidence only; it cannot close transportation.
      const deliveryQuantity=deliveries.length?deliveries.map(({delivery,row})=>`${delivery.id}：${row.qty} ${row.unit}`).join('；'):'尚无送货单'
      const route=source.processCode==='PRINT'?'/fcs/craft/printing/pending-receipts':'/fcs/craft/dyeing/pending-receipts'
      const href=`${route}?sourceId=${encodeURIComponent(source.id)}&factory=${encodeURIComponent(source.targetFactoryId)}`
      const material={id:line.material.sku,name:line.material.name,imageUrl:line.material.imageUrl,imageSource:'工厂接收单物料资料',unit:line.unit,inputSku:line.material.sku,outputSku:line.material.sku}
      for(const node of [dispatch,transport,receiving])Object.assign(node,{sourceDocumentId:source.documentNo,sourceEntryId:`${source.id}:${line.id}`,sourceHref:href,inputSku:line.material.sku,outputSku:line.material.sku,inputObjectType:objectNames[line.material.kind],outputObjectType:objectNames[line.material.kind],requiredQty:line.plannedQty,requiredQuantityKnown:true,quantityKnown:false,quantityScope:'同一来源明细在不同动作的监控量，不可跨动作加总；本需求份额待确认',unit:line.unit,mappingState:'按生产单号 / 执行任务号及来源明细精确关联',material})
      Object.assign(dispatch,{sourceDocumentType:source.type==='HANDOUT'?'物料交出单':source.type==='ISSUE'?'仓库发料单':'仓库调拨单',team:source.origin.name,owner:'交出负责人待指派',factory:source.origin.kind==='FACTORY'?source.origin.name:undefined,actualStartAt:createdAt,actualEndAt:fullySent?handedOutAt:null,businessState:handedOutAt?(fullySent?'已实际交出':line.sentQty>0?'部分实际交出':'本明细尚未交出'):source.type!=='HANDOUT'&&!approvedAt?'待审核':line.sentQty>0?'已发出数量已记录，交出时刻待补':'待实际交出',actualElapsedDays:elapsed(createdAt,fullySent?handedOutAt:null,at),dependencyNote:'创建、审核和实际交出分别保留；审核通过或已发出数量不代替实际交出时刻。创建人和审核人不自动成为交出负责人。'})
      Object.assign(transport,{sourceDocumentType:'调拨运输跟踪',team:'物流团队待指派',owner:'承运负责人待指派',predecessors:[dispatch.id],actualStartAt:line.sentQty>0?handedOutAt:null,actualEndAt:null,businessState:handedOutAt&&line.sentQty>0?'运输交付时刻待同步':deliveries.length?'已登记送货单，运输起止待同步':'运输起止待同步',actualElapsedDays:null,blocker:'来源未提供独立物流交付确认，不能判定运输结束或归因物流逾期',dependencyNote:'起点为真实交出，终点为物流交付；送货单登记时间不是物流到厂，工厂实收时间不反填运输完成。尚无正式 SLA，不重复套用创建至实收的总跨度。'})
      Object.assign(receiving,{sourceDocumentType:'工厂实收记录',team:source.targetFactoryName,owner:[...new Set(receipts.map(({receipt})=>receipt.operatorName))].join('、')||'工厂接收负责人待指派',factory:source.targetFactoryName,predecessors:[transport.id],actualStartAt:null,actualEndAt:receivedAt,businessState:fullyReceived?'已到厂接收':receipts.length?'部分到厂接收':'待工厂实收',actualElapsedDays:null,dependencyNote:'物流交付后由目标工厂接收；当前缺少独立交付时刻，不计算接收等待历时。实收不等于合格，不据此放行生产；不同单位不相加。'})
      if(source.voidedAt)for(const node of [dispatch,transport,receiving])Object.assign(node,{businessState:'已作废',actualEndAt:null,actualElapsedDays:null,includedInProductionDuration:false,blocker:'来源已作废，不参与有效供给或逾期责任判断'})
      summarize(dispatch,[['生产单',line.productionOrderNo||order?.productionOrderNo||demand.productionOrderId],['执行任务',line.taskNo],['来源明细',`${source.id} / ${line.id}`],['调出方',source.origin.name],['目标工厂',source.targetFactoryName],['计划调拨',`${line.plannedQty} ${line.unit}`],['已发出',`${line.sentQty} ${line.unit}`],['创建人',source.createdBy],['建立时间',createdAt],['审核人',source.approvedBy],['审核时间',approvedAt],['实际交出',handedOutAt]])
      summarize(transport,[['来源单据',source.documentNo],['来源明细',`${source.id} / ${line.id}`],['运输路线',`${source.origin.name} → ${source.targetFactoryName}`],['计划运输',`${line.plannedQty} ${line.unit}`],['送货单与本次数量',deliveryQuantity],['送货单登记时间',deliveries.map(({delivery})=>`${delivery.id}：${productionSourceTime(delivery.deliveredAt)||'时刻待补'}`).join('；')||'尚无记录'],['送货登记人',[...new Set(deliveries.map(({delivery})=>delivery.createdBy))].join('、')||'尚无记录'],['实际交出',handedOutAt],['物流实际交付','来源未提供独立交付确认'],['运输责任','承运团队 / 负责人待明确'],['计时边界','真实交出→物流交付；不采用工厂实收时间']])
      summarize(receiving,[['来源单据',source.documentNo],['来源明细',`${source.id} / ${line.id}`],['接收工厂',source.targetFactoryName],['应接收',`${line.plannedQty} ${line.unit}`],['实际接收',!receipts.length?'尚无接收记录':allComparable?`${received} ${line.unit}`:'实收单位不一致，需核对'],['实收凭据',[...new Set(receipts.map(({receipt})=>receipt.id))].join('、')||'尚无记录'],['实际接收人',receiving.owner],['物流交付时刻','来源未提供，接收等待时长待判'],['全部到厂实收',receivedAt],['合格可用','本实收记录不包含质检结果，待确认']])
      nodes.push(dispatch,transport,receiving)
      gaps.push(`调拨 ${source.documentNo} 缺少独立物流交付确认，运输与工厂接收等待时效不能确定归责`)
      if(!handedOutAt)gaps.push(`调拨 ${source.documentNo} 实际交出时刻待补；审核或送货单登记不替代交出`)
      if(!allComparable)gaps.push(`调拨 ${source.documentNo} 实收与计划单位不同，未做未经确认的换算`)
      if(source.voidedAt)gaps.push(`调拨 ${source.documentNo} 已作废，不能作为有效到厂供给`)
    }
  }
  const handoverIds=new Map<string,string>()
  for(const {head,records} of documents.handovers.filter(({head})=>inScope(head.productionOrderId||head.productionOrderNo,head.taskId))){
    for(const record of records){
      const node=sourceNode(demand,`${demand.demandId}:handover:${record.recordId}`,`${head.processName}交接`,'S07','fulfillment',at),parent=executionNode(record.taskId||head.taskId)
      const receivedAt=productionSourceTime(record.receiverWrittenAt||record.warehouseWrittenAt),sentAt=productionSourceTime(record.factorySubmittedAt),qty=record.submittedQty
      Object.assign(node,{sourceDocumentType:'工序交接记录',sourceDocumentId:record.handoverRecordNo||record.recordId,team:head.sourceFactoryName,factory:head.sourceFactoryName,owner:record.factorySubmittedBy||'交出人未记录',predecessors:parent?[parent.id]:[],unit:record.qtyUnit||head.qtyUnit,requiredQty:record.plannedQty??qty??0,requiredQuantityKnown:record.plannedQty!==undefined||qty!==undefined,quantityKnown:false,quantityScope:'本次交接记录数量；实收不代表合格或本需求完成',actualStartAt:sentAt,actualEndAt:receivedAt,businessState:receivedAt?'已实收':'已交出待实收',actualElapsedDays:elapsed(sentAt,receivedAt,at),mappingState:'生产单 / 执行任务明确交接记录',dependencyNote:`交接来源任务 ${record.taskId||head.taskId}；接收方 ${head.receiverName||head.targetName}；实际发货给客户仍需独立实发来源`})
      if(record.handoverRecordStatus==='VOIDED'){node.businessState='已作废';node.actualEndAt=null;node.includedInProductionDuration=false}
      else if(record.status==='OBJECTION_REPORTED'||record.status==='OBJECTION_PROCESSING')node.businessState='实收数量异议处理中'
      summarize(node,[['生产单',record.productionOrderNo||head.productionOrderNo||demand.productionOrderId],['工序任务',head.taskNo],['交出方',head.sourceFactoryName],['接收方',head.receiverName||head.targetName],['本次应交',node.requiredQuantityKnown?`${node.requiredQty} ${node.unit}`:undefined],['本次实交',qty===undefined?undefined:`${qty} ${node.unit}`],['实际接收',(record.receiverWrittenQty??record.warehouseWrittenQty)===undefined?undefined:`${record.receiverWrittenQty??record.warehouseWrittenQty} ${node.unit}`],['交出时间',sentAt],['接收时间',receivedAt]])
      nodes.push(node);handoverIds.set(record.recordId,node.id);if(record.handoverRecordId)handoverIds.set(record.handoverRecordId,node.id)
    }
  }
  for(const qc of documents.inspections.filter(qc=>inScope(qc.productionOrderId,qc.refTaskId||(qc.refType==='TASK'?qc.refId:undefined)))){
    const node=sourceNode(demand,`${demand.demandId}:qc:${qc.qcId}`,'回货质检','S08','fulfillment',at),parent=executionNode(qc.refTaskId||(qc.refType==='TASK'?qc.refId:undefined))
    const finish=productionSourceTime(qc.finishedAt)||(qc.status!=='DRAFT'?productionSourceTime(qc.inspectedAt):null),start=productionSourceTime(qc.createdAt)
    Object.assign(node,{stage:parent?.stage||'S08',sourceDocumentType:'质检记录',sourceDocumentId:qc.qcId,sourceHref:`/fcs/quality/qc-records/${encodeURIComponent(qc.qcId)}`,team:'质检团队',owner:qc.inspector,factory:qc.returnFactoryName,predecessors:qc.refType==='HANDOVER'&&handoverIds.has(qc.refId)?[handoverIds.get(qc.refId)!]:parent?[parent.id]:[],requiredQty:qc.inspectedQty??0,requiredQuantityKnown:qc.inspectedQty!==undefined,qualifiedQty:qc.qualifiedQty??0,quantityKnown:qc.qualifiedQty!==undefined,quantityScope:'本张质检记录检验范围，可能为抽检；不折算为整单合格回货',unit:parent?.unit||'单位未提供',actualStartAt:start,actualEndAt:finish,businessState:qc.status==='DRAFT'?'待检验':qc.result==='PASS'?'检验合格':'检验不合格',actualElapsedDays:elapsed(start,finish,at),mappingState:'按来源生产单 / 执行任务读取质检',blocker:qc.status!=='DRAFT'&&qc.result!=='PASS'?`检验不合格${qc.unqualifiedQty===undefined?'，不合格数量待补':`，不合格 ${qc.unqualifiedQty} ${parent?.unit||'单位未提供'}`}；需关联返工或复检放行结果`:undefined,dependencyNote:'检验结果不代替成衣实际发货；抽检合格数量不等于整批合格数量。'})
    summarize(node,[['生产单',qc.productionOrderId],['来源任务',qc.refTaskId||(qc.refType==='TASK'?qc.refId:undefined)],['来源单据',qc.refId],['回货工厂',qc.returnFactoryName],['检验人',qc.inspector],['检验数量',qc.inspectedQty===undefined?'未提供':`${qc.inspectedQty} ${node.unit}`],['合格 / 不合格',`${qc.qualifiedQty===undefined?'未提供':`${qc.qualifiedQty} ${node.unit}`} / ${qc.unqualifiedQty===undefined?'未提供':`${qc.unqualifiedQty} ${node.unit}`}`],['数量口径',node.quantityScope],['建立时间',start],['检验时间',productionSourceTime(qc.inspectedAt)],['完成时间',finish],['入库处理',qc.writebackCompletedAt?`${productionSourceTime(qc.writebackCompletedAt)} · 可用 ${qc.writebackAvailableQty===undefined?'未提供':`${qc.writebackAvailableQty} ${node.unit}`}`:'未提供实际入库结果']])
    nodes.push(node)
  }
}
/** Pure projection for source contracts; no storage, generated tasks, source writes or guessed SLA. */
export function projectProductionSourceTask(input:ProductionSourceInput):PFTask {
  const {demand}=input,at=productionSourceTime(input.at??snapshot)!,startedAt=productionSourceTime(demand.createdAt)
  if(!startedAt)throw new Error(`生产需求 ${demand.demandId} 缺少明确的下单时刻，不能虚构时效起点。`)
  const gaps=[...(input.gaps??[])],nodes:PFNode[]=[],excludedPreparation:{name:string;reason:string}[]=[]
  const demandHref='/fcs/production/demand-inbox'
  let preparation=input.preparation,technical=input.technical
  if(preparation&&preparation.styleRef!==demand.spuCode){gaps.push('已关联准备单款号不一致，关联待修正');preparation=undefined}
  if(technical&&(technical.record.styleCode!==demand.spuCode||technical.record.versionStatus!=='PUBLISHED')){gaps.push('已关联技术包不是同款正式版本，关联待修正');technical=undefined}
  const demandNode=sourceNode(demand,`${demand.demandId}:demand`,'生产需求下达','S01','decision',at)
  Object.assign(demandNode,{team:'跟单团队',owner:demand.merchandiserName||'待指派',durationDays:0,durationSource:'需求下达为时间起点里程碑，不代表受理或判断的 SLA',sourceDocumentType:'商品采购单 / 生产需求单',sourceDocumentId:demand.demandId,sourceHref:demandHref,actualStartAt:startedAt,actualEndAt:startedAt,businessState:'已完成',timeState:'起点已确认',qualifiedQty:1,quantityKnown:true,requiredQuantityKnown:true,actualElapsedDays:0,mappingState:'明确需求来源',includedInProductionDuration:false})
  summarize(demandNode,[['生产需求',demand.demandId],['商品采购单',demand.legacyOrderNo],['款号',demand.spuCode],['需求数量',`${demand.requiredQtyTotal} 件`],['主跟单',demand.merchandiserName],['下单时间',startedAt],['关联生产单',demand.productionOrderId]])
  nodes.push(demandNode)
  const preparationHref=preparation?`/pcs/production-preparation/orders/${encodeURIComponent(preparation.id)}`:undefined
  if(!preparation){
    const node=sourceNode(demand,`${demand.demandId}:preparation-binding`,'关联生产准备单','S02','decision',at)
    Object.assign(node,{team:'跟单团队',owner:demand.merchandiserName||'待指派',blocker:'尚未明确本需求对应的生产准备单；不能根据同款自动关联',sourceHref:'/pcs/production-preparation/orders'})
    nodes.push(node);gaps.push('生产需求尚未显式关联生产准备单，准备工作范围待确认')
  }else{
    const byItem=new Map(preparation.items.map(item=>[item.itemId,item]))
    const byTask=new Map(preparation.taskSources.map(task=>[task.id,task]))
    const planConfirmed=Boolean(preparation.taskPlanConfirmedAt&&preparation.type!=='类型待确认')
    if(!planConfirmed){
      const decision=sourceNode(demand,`${demand.demandId}:preparation-scope`,'确认生产准备工作范围','S02','decision',at)
      Object.assign(decision,{team:'跟单团队',owner:demand.merchandiserName||'待指派',sourceDocumentType:'生产准备单',sourceDocumentId:preparation.code,sourceHref:preparationHref,blocker:'准备类型或专业任务方案尚未确认；未生成任务不等于无需'})
      nodes.push(decision);gaps.push('生产准备工作范围未正式确认')
    }
    const activeIds=new Set<string>()
    for(const item of preparation.items){
      const task=item.taskId?byTask.get(item.taskId):undefined
      if(task&&task.sourceType!=='ENGINEERING_MASTER'){excludedPreparation.push({name:item.itemType,reason:'该任务不是生产准备单专业任务，不纳入本需求投影'});continue}
      if(item.status==='无需'&&!item.reusedPriorResult){
        if(task?.status==='未启用'||planConfirmed)excludedPreparation.push({name:item.itemType,reason:task?.status==='未启用'?'来源专业任务明确未启用':'已确认准备方案中无需本项'})
        continue
      }
      if(!task&&!item.reusedPriorResult){
        const missing=sourceNode(demand,`${demand.demandId}:prep:${item.itemId}`,item.itemType,'S02','preparation',at)
        Object.assign(missing,{team:item.ownerTeam||'准备团队待指派',sourceDocumentType:'生产准备单',sourceDocumentId:preparation.code,sourceHref:preparationHref,blocker:'适用工作尚未生成明确专业任务',sourceEntryId:item.itemId})
        nodes.push(missing);activeIds.add(item.itemId);gaps.push(`${item.itemType}缺少专业任务来源`);continue
      }
      const node=sourceNode(demand,`${demand.demandId}:prep:${item.itemId}`,item.itemType,'S02','preparation',at)
      const reuse=preparation.reuseLines.find(line=>line.decision==='复用'&&(line.resultLabel===item.itemType||line.resultType===task?.type))
      const reused=Boolean(item.reusedPriorResult&&reuse?.sourceTaskId&&reuse?.sourceResultVersion),start=reused?null:productionSourceTime(item.actualStartAt),finish=reused?null:productionSourceTime(item.effectiveFinishedAt||item.actualFinishAt)
      const complete=reused||Boolean(finish)
      if(item.reusedPriorResult&&!reused)gaps.push(`${item.itemType}复用缺少明确来源或成果版本，须核对`)
      Object.assign(node,{team:item.ownerTeam||'准备团队待指派',owner:task?.assigneeName||'待指派',sourceDocumentType:reused?'前期成果复用':'生产准备单专业任务',sourceDocumentId:reused?(reuse?.sourceTaskId||item.sourceObjectNo||preparation.code):(item.taskId||preparation.code),sourceHref:reused?preparationHref:(item.taskHref||item.sourceHref||preparationHref),sourceEntryId:item.itemId,quantityKnown:true,requiredQuantityKnown:true,qualifiedQty:complete?1:0,actualStartAt:start,actualEndAt:finish,businessState:complete?'已完成':item.reusedPriorResult?'待确认':item.status==='因需求变更结束'?'已取消':start?'进行中':item.status==='待确认'?'待确认':'待开始',timeState:reused?'复用成果':finish?'已完成，标准待配':'待判定',actualElapsedDays:elapsed(start,finish,at),durationDays:reused?0:null,durationSource:reused?'前期成果复用，不重复计入本任务准备时长':'专业任务没有正式单项 SLA；计划起止及实际历时均不作 SLA',includedInProductionDuration:!reused,mappingState:'准备单只读投影',sourceUpdatedAt:productionSourceTime(preparation.updatedAt)??node.sourceUpdatedAt,dependencyNote:reused?`${item.evidenceSummary}；来源 ${reuse?.sourceTaskLabel||reuse?.sourceTaskId||'见生产准备单'}；结果版本 ${reuse?.sourceResultVersion||'待核对'}`:`${item.evidenceSummary}；最近实际操作人 ${item.ownerName||'待补'}；事件 ${(item.eventKeys??[]).join('、')||'待补'}`})
      if(item.status==='已完成'&&!finish&&!reused){node.businessState='待确认';node.blocker='来源标为完成但缺少有效完成事件';gaps.push(`${item.itemType}缺少有效完成时刻`)}
      summarize(node,[['生产准备单',preparation.code],['生产需求',demand.demandId],['款号',preparation.styleRef],['负责人',task?.assigneeName],['责任团队',item.ownerTeam],['实际开始',start],['有效完成',finish],['计划完成（非 SLA）',item.plannedFinishAt],['成果数量',task?.resultQuantity],['关联采购单',task?.boundPurchaseOrderNos?.join('、')],['复用成果',reused?`${reuse?.sourceTaskLabel||reuse?.sourceTaskId} · ${reuse?.sourceResultVersion}`:undefined]])
      nodes.push(node);activeIds.add(item.itemId)
    }
    for(const node of nodes.filter(node=>node.origin==='preparation')){
      const item=byItem.get(node.sourceEntryId??'');if(!item)continue
      for(const predecessor of item.dependsOnItemIds){
        if(activeIds.has(predecessor)){node.predecessors.push(`${demand.demandId}:prep:${predecessor}`);continue}
        const parent=byItem.get(predecessor)
        if(parent?.status==='无需'&&planConfirmed)continue
        const id=`${demand.demandId}:missing-prep:${predecessor}`
        if(!nodes.some(existing=>existing.id===id)){const pending=sourceNode(demand,id,'补齐生产准备前置确认','S02','decision',at);pending.blocker=`缺少明确前置 ${predecessor}`;nodes.push(pending)}
        node.predecessors.push(id);gaps.push(`${item.itemType}前置准备工作待确认`)
      }
    }
  }
  const technicalHref=technical?`/pcs/products/styles/${encodeURIComponent(technical.record.styleId)}/technical-data/${encodeURIComponent(technical.record.technicalVersionId)}`:undefined
  const publishedAt=productionSourceTime(technical?.record.publishedAt)
  let technicalReleaseId:string|undefined
  if(technical&&publishedAt){
    const node=sourceNode(demand,`${demand.demandId}:technical-release`,'正式技术包发布','S02','preparation',at)
    const fromPreparation=Boolean(preparation&&technical.record.createdFromTaskType==='ENGINEERING_MASTER'&&technical.record.sourceProjectId===preparation.id&&preparation.taskSources.some(task=>task.id===technical!.record.createdFromTaskId&&task.type==='TECH_PACK_CONFIRMATION')&&preparation.formalTechnicalVersionId===technical.record.technicalVersionId)
    const confirmationTask=fromPreparation?preparation!.taskSources.find(task=>task.id===technical.record.createdFromTaskId&&task.type==='TECH_PACK_CONFIRMATION'):undefined
    const confirmationNode=confirmationTask?nodes.find(node=>node.origin==='preparation'&&node.sourceDocumentId===confirmationTask.id):undefined
    Object.assign(node,{team:'技术团队',owner:technical.record.publishedBy||'发布人未记录',sourceDocumentType:'正式技术包',sourceDocumentId:technical.record.technicalVersionCode,sourceHref:technicalHref,predecessors:confirmationNode?[confirmationNode.id]:[],actualStartAt:publishedAt,actualEndAt:publishedAt,businessState:'已发布',timeState:'成果已发布',durationDays:0,durationSource:'正式发布为成果事件，不推定准备工作标准历时',includedInProductionDuration:false,qualifiedQty:1,quantityKnown:true,requiredQuantityKnown:true,mappingState:fromPreparation?'生产准备单明确发布的技术包成果':'需求明确关联正式技术包；准备单来源未关联',dependencyNote:fromPreparation?`正式版本来源生产准备单 ${preparation!.code}；发布门禁沿用来源专业任务`:'正式版本有明确发布事实；尚无本需求准备单来源，不把同款准备单连入'})
    summarize(node,[['款号',technical.record.styleCode],['技术版本',technical.record.versionLabel],['发布人',technical.record.publishedBy],['发布时间',publishedAt],['来源准备单',fromPreparation?preparation!.code:undefined],['生产需求',demand.demandId]])
    nodes.push(node);technicalReleaseId=node.id
  }
  let routeConfirmed=false
  if(!technical||!technical.content){
    const node=sourceNode(demand,`${demand.demandId}:technical-binding`,'关联正式技术包与确认工艺路线','S02','decision',at)
    Object.assign(node,{team:'技术与跟单团队',owner:demand.merchandiserName||'待指派',sourceHref:technicalHref,sourceDocumentId:technical?.record.technicalVersionCode??'',blocker:technical?'正式版本内容缺失':'尚未关联明确的同款正式技术包'})
    nodes.push(node);gaps.push(technical?'技术包正式版本内容缺失':'缺少明确的同款正式技术包关联')
  }else{
    const {record,content}=technical
    routeConfirmed=content.processRouteStatus==='CONFIRMED'
    if(!routeConfirmed){gaps.push('技术包工艺路线尚未确认，不能形成整体时效标准');const decision=sourceNode(demand,`${demand.demandId}:route-confirmation`,'确认技术包工艺路线','S02','decision',at);Object.assign(decision,{team:'技术与跟单团队',sourceHref:technicalHref,sourceDocumentId:record.technicalVersionCode,blocker:'工艺路线待确认'});nodes.push(decision)}
    const entries=new Map<string,TechnicalProcessEntry>()
    for(const entry of content.processEntries){if(entries.has(entry.id)){gaps.push(`工序实例 ID ${entry.id} 重复，路线待修正`);routeConfirmed=false}else entries.set(entry.id,entry)}
    if(!entries.size){gaps.push('正式技术包尚无可读取工序实例，不能默认无需生产');routeConfirmed=false}
    const prefix=`${demand.demandId}:route:`
    for(const entry of entries.values()){
      const node=sourceNode(demand,prefix+entry.id,entry.craftName||entry.processName,routeStage(entry),'route',at)
      Object.assign(node,{team:routeTeam(entry),sourceDocumentType:'技术包工艺路线',sourceDocumentId:record.technicalVersionCode,sourceHref:technicalHref,sourceEntryId:entry.id,inputSku:entry.inputMaterialSkuCode,outputSku:entry.outputMaterialSkuCode,businessState:'执行进度待关联',mappingState:'正式技术包工序；执行单据待关联',sourceUpdatedAt:productionSourceTime(content.processRouteUpdatedAt||record.updatedAt)??node.sourceUpdatedAt,dependencyNote:`路线实例 ${entry.id}；对象分支 ${entry.routeObjectKey||'待确认'}；${entry.predecessorEntryIds===undefined?'前置关系未提供':entry.predecessorEntryIds.length?'直接前置 '+entry.predecessorEntryIds.join('、'):'已明确无路线前置'}；执行工厂、数量及起止事件待关联`})
      node.inputObjectType=objectNames[entry.inputObjectType??'']||entry.inputObjectType;node.outputObjectType=objectNames[entry.outputObjectType??'']||entry.outputObjectType
      if(entry.inputMaterialSkuCode&&entry.inputMaterialImageUrl)node.material={id:entry.inputMaterialSkuCode,name:entry.inputMaterialName||entry.inputMaterialSkuCode,imageUrl:entry.inputMaterialImageUrl,imageSource:'正式技术包投入物料',unit:entry.outputUnit||'单位待确认',inputSku:entry.inputMaterialSkuCode,outputSku:entry.outputMaterialSkuCode}
      else if(entry.outputMaterialSkuCode&&entry.outputMaterialImageUrl)node.material={id:entry.outputMaterialSkuCode,name:entry.outputMaterialName||entry.outputMaterialSkuCode,imageUrl:entry.outputMaterialImageUrl,imageSource:'正式技术包产出物料',unit:entry.outputUnit||'单位待确认',inputSku:entry.inputMaterialSkuCode,outputSku:entry.outputMaterialSkuCode}
      if(entry.predecessorEntryIds?.length===0&&technicalReleaseId){node.predecessors.push(technicalReleaseId);node.dependencyNote+='；正式技术包发布提供工艺依据，不代表生产建单前置关系'}
      if(entry.outputUnit&&entry.outputQtyPerGarment!==undefined&&Number.isFinite(entry.outputQtyPerGarment)&&entry.outputQtyPerGarment>=0){node.unit=entry.outputUnit;node.requiredQty=demand.requiredQtyTotal*entry.outputQtyPerGarment;node.requiredQuantityKnown=true;node.quantityScope='本需求数量 × 技术包单件产出量'}
      if(entry.predecessorEntryIds===undefined){routeConfirmed=false;gaps.push(`${node.name}未提供显式前置关系，不能按步骤号补串行`);node.predecessors.push(`${demand.demandId}:route-edge-gap:${entry.id}`)}
      for(const predecessor of entry.predecessorEntryIds??[]){
        node.predecessors.push(prefix+predecessor)
        const previous=entries.get(predecessor)
        if(!previous){routeConfirmed=false;gaps.push(`${node.name}引用不存在的前置工序 ${predecessor}`);continue}
        const sameObject=Boolean(entry.routeObjectKey&&entry.routeObjectKey===previous.routeObjectKey)
        if(sameObject&&entry.inputMaterialSkuCode&&previous.outputMaterialSkuCode&&entry.inputMaterialSkuCode!==previous.outputMaterialSkuCode){routeConfirmed=false;gaps.push(`${previous.processName}→${node.name}投入产出 SKU 不连续`);node.blocker=`前置产出 ${previous.outputMaterialSkuCode} 与本项投入 ${entry.inputMaterialSkuCode} 不一致`}
        if(sameObject&&entry.stageCode==='PREP'&&previous.stageCode==='PREP'&&(!entry.inputMaterialSkuCode||!previous.outputMaterialSkuCode)){routeConfirmed=false;gaps.push(`${node.name}缺少同对象前置投入产出 SKU，连续性待确认`)}
      }
      if(entry.linkageStatus==='待确认'){routeConfirmed=false;gaps.push(`${node.name}工艺关联待确认`)}
      summarize(node,[['技术包',record.technicalVersionCode],['款号',record.styleCode],['技术版本',record.versionLabel],['工序实例',entry.id],['工序名称',node.name],['投入对象',entry.inputMaterialSkuCode||objectNames[entry.inputObjectType??'']],['产出对象',entry.outputMaterialSkuCode||objectNames[entry.outputObjectType??'']],['明确前置',entry.predecessorEntryIds?.join('、')||(entry.predecessorEntryIds?'已明确无工艺前置':undefined)],['路线状态',content.processRouteStatus==='CONFIRMED'?'已确认':'待确认'],['执行事实','需关联本工序实例对应的执行任务'],['应做数量',node.requiredQuantityKnown?`${node.requiredQty} ${node.unit}`:undefined],['数量口径',node.quantityScope]])
      nodes.push(node)
    }
    const missing=new Set(nodes.flatMap(node=>node.predecessors).filter(id=>!nodes.some(node=>node.id===id)))
    for(const id of missing){const node=sourceNode(demand,id,'补齐工艺路线前置','S03','decision',at);Object.assign(node,{sourceHref:technicalHref,sourceDocumentId:record.technicalVersionCode,blocker:`路线缺少明确前置：${id.slice(prefix.length)}`});nodes.push(node)}

  }
  const executions=(input.executions??[]).filter(task=>Boolean(demand.productionOrderId)&&task.productionOrderId===demand.productionOrderId)
  const routeByEntry=new Map(nodes.filter(node=>node.origin==='route').map(node=>[node.sourceEntryId!,node]))
  const entryOf=(task:ExecutionSource):string|undefined=>task.sourceEntryId||(task.sourceEntryIds?.length===1?task.sourceEntryIds[0]:undefined)
  const entryCounts=new Map<string,number>()
  for(const task of executions){const id=entryOf(task);if(id)entryCounts.set(id,(entryCounts.get(id)??0)+1)}
  const executionIds=new Map(executions.map(task=>{
    const entryId=entryOf(task),route=entryId&&entryCounts.get(entryId)===1?routeByEntry.get(entryId):undefined
    return [task.taskId,route?.id??`${demand.demandId}:execution:${task.taskId}`]
  }))
  for(const source of executions){
    const entryId=entryOf(source),id=executionIds.get(source.taskId)!,existing=nodes.find(node=>node.id===id)
    const stages:Record<string,string>={PREP:'S03',MATERIAL:'S03',CUTTING:'S05',SPECIAL:'S06',SEWING:'S07',POST:'S08',WAREHOUSE:'S08'}
    const node=existing??sourceNode(demand,id,source.processNameZh,(/CUT|裁/.test(source.processCode+' '+source.processNameZh)?'S05':/SEW|WOOL|车缝|毛织/.test(source.processCode+' '+source.processNameZh)?'S07':stages[source.stage]??'S06'),'execution',at)
    const start=productionSourceTime(source.startedAt),finish=source.status==='DONE'?productionSourceTime(source.finishedAt):null,deadline=productionSourceTime(source.taskDeadline)
    const overdue=source.status!=='CANCELLED'&&deadline&&!(source.status==='DONE'&&!finish)?Math.max(0,(Date.parse(finish??at)-Date.parse(deadline))/DAY):0
    const state=source.status==='DONE'?(finish?'已完成':'完成时刻待补'):source.status==='IN_PROGRESS'?'进行中':source.status==='BLOCKED'?'已阻断':source.status==='CANCELLED'?'已取消':'待开始'
    Object.assign(node,{team:existing?.team||'生产执行团队',owner:'执行负责人待明确',factory:source.assignedFactoryName||undefined,sourceDocumentType:'工序执行任务',sourceDocumentId:source.taskNo||source.taskId,sourceHref:`/fcs/progress/board/tasks/${encodeURIComponent(source.taskId)}`,sourceEntryId:entryId||source.taskId,requiredQty:source.qty,quantityScope:'来源生产单总量；本需求份额待确认',qualifiedQty:0,unit:source.qtyDisplayUnit||({PIECE:'件',BUNDLE:'扎',METER:'米'} as Record<string,string>)[source.qtyUnit]||source.qtyUnit,quantityKnown:false,requiredQuantityKnown:true,actualStartAt:start,actualEndAt:source.status==='DONE'?finish:null,businessState:state,localDueAt:deadline,actualElapsedDays:elapsed(start,source.status==='DONE'?finish:null,at),actualOverdueDays:overdue,timeState:source.status==='CANCELLED'?'已取消':overdue>0?(finish?'完成但曾逾期':'已逾期'):finish?(deadline?'按期完成':'已完成，标准待配'):'待判定',durationDays:null,durationSource:'工序执行记录无单项 SLA；派发截止只作为本环节责任截止，不据此倒推标准历时',mappingState:existing?'技术工序与执行任务明确关联':'需求生产单与执行任务明确关联；技术工序关系待补',sourceUpdatedAt:productionSourceTime(source.updatedAt)??node.sourceUpdatedAt,dependencyNote:`执行任务 ${source.taskId}；${entryId?`技术工序 ${entryId}`:'技术工序实例未关联'}；来源产物 ${source.sourceArtifactId||'待补'}；范围 ${source.scopeLabel||'按执行任务'}；应完成量为来源生产单总量，本需求份额待确认；合格完成数量待接入；前置按执行记录明确关系读取`,blocker:source.blockNoteZh||source.blockRemark||undefined})
    node.inputObjectType=objectNames[source.inputObjectType??'']||source.inputObjectType||node.inputObjectType;node.outputObjectType=objectNames[source.outputObjectType??'']||source.outputObjectType||node.outputObjectType
    summarize(node,[['生产单',source.productionOrderId],['生产需求',demand.demandId],['款号',demand.spuCode],['执行工厂',source.assignedFactoryName],['应做数量',`${source.qty} ${node.unit}`],['数量口径',node.quantityScope],['投入 → 产出',`${node.inputSku||node.inputObjectType||'来源未提供'} → ${node.outputSku||node.outputObjectType||'来源未提供'}`],['实际开始',start],['实际完成',finish],['责任截止',deadline],['来源工序',entryId],['前置任务',source.dependsOnTaskIds.join('、')||'已明确无执行前置']])
    node.predecessors=[...new Set([...(existing?.predecessors??[]),...source.dependsOnTaskIds.map(predecessor=>executionIds.get(predecessor)??`${demand.demandId}:execution:${predecessor}`)])]
    if(!existing){nodes.push(node);gaps.push(`${source.taskNo||source.taskId}与当前技术工序未形成唯一关联，作为独立执行事实展示`)}
    if(source.status==='DONE'&&!finish)gaps.push(`${source.taskNo||source.taskId}已完成但缺少准确完成时刻`)
    if(!source.assignedFactoryName)gaps.push(`${source.taskNo||source.taskId}执行工厂尚未指派`)
  }
  if(executions.length)gaps.push('工序执行任务数量属于对应生产单责任范围；合格回货数量及需求分配待接入')
  appendDocumentFacts(input,nodes,executions,at,gaps)
  // Missing and cyclic source dependencies remain blockers, including preparation-only tasks.
  const missingIds=new Set(nodes.flatMap(node=>node.predecessors).filter(id=>!nodes.some(node=>node.id===id)))
  for(const id of missingIds){
    routeConfirmed=false
    const node=sourceNode(demand,id,'补齐工作前置来源','S04','decision',at)
    node.blocker=`来源前置 ${id} 尚未读取到有效工作事实`;nodes.push(node);gaps.push(node.blocker)
  }
  const seen=new Set<string>(),stack=new Set<string>(),byId=new Map(nodes.map(node=>[node.id,node]))
  const visit=(node:PFNode):void=>{
    if(seen.has(node.id))return
    stack.add(node.id)
    node.predecessors=node.predecessors.map(id=>{
      if(stack.has(id)){
        routeConfirmed=false;gaps.push(`工艺/准备依赖存在循环：${id} → ${node.id}`)
        const gapId=`${demand.demandId}:cycle:${node.id}:${id}`,gap=sourceNode(demand,gapId,'修正循环依赖',node.stage,'decision',at)
        gap.blocker=`来源前置 ${id} 构成循环；未采用该非法关系计算`;gap.sourceHref=node.sourceHref
        nodes.push(gap);byId.set(gapId,gap);node.dependencyNote=`${node.dependencyNote??''}；循环关系 ${id} 待修正`;return gapId
      }
      const parent=byId.get(id);if(parent)visit(parent);return id
    })
    stack.delete(node.id);seen.add(node.id)
  }
  for(const node of [...nodes])visit(node)

  const hasMaterialDocuments=nodes.some(node=>node.origin==='material'&&node.sourceSummary)
  if(!hasMaterialDocuments){
    const material=sourceNode(demand,`${demand.demandId}:material-sources`,'关联面辅料供给与到厂事实','S03','material',at)
    Object.assign(material,{team:'采购与仓储团队',sourceDocumentType:'面辅料需求 / 采购 / 调拨 / 工厂实收',blocker:'未发现本需求已绑定采购单，或精确归属本生产单 / 执行任务的仓库调拨、工厂实收明细',dependencyNote:'缺口采购需到仓入库并继续追踪到厂；现货需追踪调拨。按明确单号查询现有事实，未用同款或同物料推测归属。'})
    nodes.push(material)
  }
  gaps.push(hasMaterialDocuments?'已读取材料单据；本需求 BOM 总需求及每笔供给分配份额尚未形成可验证齐套关系':'面辅料供给路线及本需求到厂可用数量待关联')
  const production=sourceNode(demand,`${demand.demandId}:production-order`,'生产单建单','S04','decision',at)
  Object.assign(production,{team:'生产计划团队',sourceDocumentType:'生产需求关联生产单',sourceDocumentId:demand.productionOrderId??'',sourceHref:demand.productionOrderId?`/fcs/production/orders/${encodeURIComponent(demand.productionOrderId)}`:demandHref,businessState:demand.productionOrderId?(executions.length?'已建单':'已建单，执行事实待补'):'待建单',mappingState:demand.productionOrderId?'需求明确关联生产单':'生产需求尚未建单',qualifiedQty:demand.productionOrderId?1:0,quantityKnown:true,blocker:demand.productionOrderId?(executions.length?'已读取工序执行；回货质检事件待接入':'尚未关联该生产单工序执行及回货质检事件'):'尚未创建对应生产单'})
  const sourceOrder=input.documents?.orders.find(order=>order.productionOrderId===demand.productionOrderId&&(order.demandId===demand.demandId||order.sourceDemandIds.includes(demand.demandId)))
  if(sourceOrder){
    const created=productionSourceTime(sourceOrder.createdAt),versionId=sourceOrder.techPackSnapshot?.sourceTechPackVersionId||sourceOrder.selectedTechPackVersionId
    Object.assign(production,{sourceDocumentType:'生产单',sourceDocumentId:sourceOrder.productionOrderNo,actualStartAt:created,actualEndAt:created,requiredQuantityKnown:true,businessState:'已建单',blocker:undefined,predecessors:technicalReleaseId&&versionId===technical?.record.technicalVersionId?[technicalReleaseId]:[],dependencyNote:versionId===technical?.record.technicalVersionId?'生产单快照明确使用当前正式技术版本；发布成果为建单依据':'生产单使用的技术版本与当前关联版本不一致，未虚构准备前置'})
    summarize(production,[['生产单',sourceOrder.productionOrderNo],['本生产需求',demand.demandId],['来源需求',sourceOrder.sourceDemandIds.join('、')],['款号',demand.spuCode],['建单时间',created],['所用技术版本',versionId],['主工厂',sourceOrder.mainFactorySnapshot?.name]])
    if(versionId!==technical?.record.technicalVersionId)gaps.push('生产单使用的技术包版本与当前关联正式技术包不一致；准备至生产的版本关系待核对')
  }
  nodes.push(production)
  const sourceOrderVersion=sourceOrder?.techPackSnapshot?.sourceTechPackVersionId||sourceOrder?.selectedTechPackVersionId
  if(sourceOrder&&technical&&sourceOrderVersion===technical.record.technicalVersionId){
    for(const source of executions.filter(task=>task.dependsOnTaskIds.length===0)){
      const node=nodes.find(item=>item.id===executionIds.get(source.taskId))
      if(node&&!node.predecessors.includes(production.id)){node.predecessors.push(production.id);node.dependencyNote=`${node.dependencyNote??''}；本执行根任务由已确认同技术版本生产单建单后下发`}
    }
  }
  const fulfillment=sourceNode(demand,`${demand.demandId}:shipment-facts`,'关联实际发货事实','S09','fulfillment',at)
  Object.assign(fulfillment,{team:'质检与仓储团队',sourceDocumentType:'回货质检 / 成衣入库 / 实际发货',blocker:'未接入明确归属本需求的实发记录；发货数量和客户订单范围未知',dependencyNote:'客户订单仅在实际发货时确定，不能按生产数量或同款订单提前匹配。'})
  nodes.push(fulfillment);gaps.push('实发来源与数量未知，未建立已发客户订单集合')
  gaps.push('未关联正式工作项 SLA；计划历时和实际耗时不替代时效要求')
  if(nodes.some(node=>node.origin==='route'&&node.sourceDocumentType!=='工序执行任务'))gaps.push('部分技术工艺定义与生产执行单据未关联，执行起止、数量及工厂待补')
  if(nodes.some(n=>n.sourceDocumentType==='工序执行任务'))gaps.push('工序执行数量为来源生产单范围，本需求分配份额待确认，不直接汇入本需求完成量')
  // Scope uncertainty is a separate contract from missing actual progress in `gaps`.
  // The current adapters have no confirmed demand-level supply allocation or future shipment plan.
  const scopeBlockingReasons:string[]=[]
  if(!preparation?.taskPlanConfirmedAt||preparation.type==='类型待确认')scopeBlockingReasons.push('本需求生产准备工作范围未确认')
  if(!routeConfirmed)scopeBlockingReasons.push('完整技术工艺路线及显式前置未确认')
  scopeBlockingReasons.push('本需求面辅料供给路线、分配份额及使用工作关联未确认','必要的未来发货工作范围及依赖未确认')
  const timingScope:NonNullable<NonNullable<PFTask['sourceContext']>['timingScope']>={state:'pending',terminalNodeIds:[fulfillment.id],blockingReasons:scopeBlockingReasons}
  const cancelled=demand.demandStatus==='CANCELLED',qty=demand.requiredQtyTotal
  if(cancelled)gaps.push('生产需求已取消；取消的准确时刻尚无独立事件')
  // Upstream category fallbacks are shared sample assets, not a verified photo of this SPU.
  const genericStyleImages=['/jacket-sample.jpg','/dress-sample-1.jpg','/pants-sample.jpg','/cardigan-sample.jpg','/shirt-sample.jpg','/tshirt-sample.jpg','/placeholder.svg']
  const imageUrl=genericStyleImages.includes(demand.imageUrl.split('?')[0])?'':demand.imageUrl
  if(!imageUrl)gaps.push(`款式 ${demand.spuCode} 对应实图待补；来源只有通用示例图或未提供图片，未用其他款式替代`)
  const task:PFTask={asOf:at,id:demand.demandId,purchaseNo:demand.legacyOrderNo,demandNo:demand.demandId,scenario:'当前原型业务来源',startedAt,standardDays:null,baselineDueAt:null,effectiveDueAt:null,predictedFinishAt:null,originalQty:qty,effectiveQty:cancelled?0:qty,shippedQty:0,remainingQty:cancelled?0:qty,quantityKnown:false,shipmentQuantityKnown:false,businessState:cancelled?'已终止':demand.demandStatus==='HOLD'?'挂起':demand.productionOrderId?'已转生产':'准备中',health:cancelled?'已终止':'待判定',follower:demand.merchandiserName||'待指派',accountableTeam:'跟单团队',unit:'件',styleRef:demand.spuCode,styleName:demand.spuName,imageUrl,region:demand.marketScopes.join(' / '),supplyMode:'待确定',productionOrderNos:demand.productionOrderId?[demand.productionOrderId]:[],preparationNo:preparation?.code??'',ruleVersion:'来源时效待配置',nodes,progressPct:null,hasActualShipmentOrderFacts:false,knownShipmentOrderScope:'尚未关联实际发货事实',remainingQtyCustomerOrders:'实际发货时确定；当前未建立客户订单集合',lastProgressAt:productionSourceTime(demand.updatedAt)??startedAt,missingRule:'正式单项 SLA 未关联',uncertainty:[...new Set(gaps)].join('；'),blocker:gaps[0]??'等待来源完整性确认',responsibleTeam:'跟单团队',sourceDemandIds:[demand.demandId],demandReductionQty:cancelled?qty:undefined,terminationReason:cancelled?demand.constraintsNote:undefined,sourceContext:{timingScope,preparationId:preparation?.id,preparationType:preparation?.type,preparationState:preparation?.status,technicalVersionId:technical?.record.technicalVersionId,technicalVersionLabel:technical?.record.versionLabel,routeStatus:technical?(routeConfirmed?'已确认':'待确认'):'未关联',demandHref,preparationHref,technicalHref,gaps:[...new Set(gaps)],excludedPreparation,sourceKind:'当前原型业务来源'}}
  const lead=dependencyAnalysis(task).blockers[0]
  if(lead&&!cancelled){task.blocker=`${lead.node.name} · ${lead.node.sourceDocumentId}：${lead.reason}`;task.responsibleTeam=lead.node.team}
  return task
}

export function readProductionSourceSnapshot():ProductionSourceSnapshot {
  const asOf=new Date().toISOString()
  const masters=listEngineeringMasterOrders()
  const technical=getTechnicalDataVersionStoreSnapshot()
  const links=bindings(),executionFacts=listRuntimeExecutionTasks()
  const documents=readProductionDocumentFacts(new Set(executionFacts.map(task=>task.taskId)),masters.flatMap(master=>master.tasks.flatMap(task=>task.boundPurchaseOrderNos??[])))
  const preparations:PreparationSourceOption[]=masters.map(master=>({id:master.masterOrderId,code:master.masterOrderCode,styleRef:master.styleCode,name:master.styleName,type:preparationTypes[master.preparationType]??'类型待确认'}))
  const techPacks:TechnicalSourceOption[]=technical.records.filter(record=>record.versionStatus==='PUBLISHED').map(record=>({id:record.technicalVersionId,code:record.technicalVersionCode,styleRef:record.styleCode,name:`${record.styleName} · ${record.versionLabel}`}))
  const byVersion=new Map(technical.records.map(record=>[record.technicalVersionId,record])),byContent=new Map(technical.contents.map(content=>[content.technicalVersionId,content])),byMaster=new Map(masters.map(master=>[master.masterOrderId,master]))
  const projected=new Map<string,PreparationSource>()
  const tasks=productionDemands.map(demand=>{
    const binding=links[demand.demandId]??{},gaps:string[]=[]
    let version=binding.technicalVersionId?byVersion.get(binding.technicalVersionId):undefined
    if(!Object.prototype.hasOwnProperty.call(links,demand.demandId)&&!binding.technicalVersionId&&demand.techPackStatus==='RELEASED'){
      const seed=byVersion.get(buildDemandTechnicalVersionId(demand.spuCode))
      if(seed&&seed.styleId===buildDemandStyleId(demand.spuCode)&&seed.styleCode===demand.spuCode&&seed.versionLabel===demand.techPackVersionLabel&&seed.versionStatus==='PUBLISHED')version=seed
      else gaps.push('需求技术版本与当前明确映射版本不符，须选择正式版本')
    }
    if(binding.technicalVersionId&&(!version||version.styleCode!==demand.spuCode||version.versionStatus!=='PUBLISHED')){gaps.push('原 DDS 技术包关联已不存在、跨款或不再正式发布');version=undefined}
    let preparation:PreparationSource|undefined
    if(binding.preparationId){
      const master=byMaster.get(binding.preparationId)
      if(!master||master.styleCode!==demand.spuCode)gaps.push('原 DDS 关联生产准备单已不存在或款号不一致，须重新关联')
      else {
        const formal=version?.createdFromTaskType==='ENGINEERING_MASTER'&&version.sourceProjectId===master.masterOrderId&&master.tasks.some(task=>task.taskId===version!.createdFromTaskId&&task.taskType==='TECH_PACK_CONFIRMATION')?{masterOrderId:master.masterOrderId,technicalVersionId:version.technicalVersionId,versionLabel:version.versionLabel,publishedAt:version.publishedAt}:undefined
        const key=`${master.masterOrderId}:${formal?.technicalVersionId??''}`
        if(!projected.has(key)){
          const projection=projectEngineeringMasterToPreparation(master,formal)
          projected.set(key,{...preparations.find(item=>item.id===master.masterOrderId)!,status:master.status,taskPlanConfirmedAt:master.taskPlanConfirmedAt,updatedAt:master.updatedAt||master.createdAt,items:projection.items,taskSources:master.tasks.map(task=>({id:task.taskId,type:task.taskType,status:task.status,assigneeName:task.assigneeName,sourceType:task.sourceType,taskName:task.taskName,resultQuantity:task.resultQuantity,materialLines:task.materialLines,boundPurchaseOrderNos:task.boundPurchaseOrderNos,plannedCompleteAt:task.plannedCompleteAt,submittedAt:task.submittedAt})),reuseLines:master.priorResultReuseLines,formalTechnicalVersionId:formal?.technicalVersionId,formalPublishedAt:projection.techPackPublishedAt})
        }
        preparation=projected.get(key)
      }
    }
    return projectProductionSourceTask({at:asOf,demand,preparation,executions:executionFacts,documents,technical:version?{record:version,content:byContent.get(version.technicalVersionId)??null}:undefined,gaps})
  })
  return {asOf,tasks,preparations,techPacks}
}
