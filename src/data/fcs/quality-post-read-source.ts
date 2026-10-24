import type { InspectionSourceKind, QualityInspectionRecordView } from './quality-management-types.ts'
import type { PostFinishingQcTask, PostFinishingFactoryReturnDelivery } from './post-finishing-full-flow.ts'
import './post-finishing-full-flow.ts'
import { projectPostFinishingStaticRecords } from './post-finishing-records.ts'
import { readPcsRecordProjection, readPcsFiles, pcsFileReferences, type PcsStoredRecord } from '../pcs-record-db.ts'
import { getPostQcSummary, applyPostQcFullCoverage } from './post-finishing-quality.ts'
import { finishedInventoryApplicationStatus, finishedInventoryTransferStatus } from '../wls/finished-inventory-quality.ts'
import type { FinishedInventoryApplication, FinishedInventoryTransfer } from '../wls/finished-inventory-quality-types.ts'
const post='higood-fcs-post-finishing-records', inventory='higood-finished-inventory'
const summaries=new Map<string,QualityInspectionRecordView>(), details=new Map<string,QualityInspectionRecordView>()
const fileUrls=new Map<string,string>()
let activeFileIds=new Set<string>(),fileObserver:MutationObserver|undefined
let preparing:Promise<void>|undefined
function cleanupUnusedFiles():void {
 if(typeof document==='undefined')return
 const inRecordPage=/^\/fcs\/quality-management\/(?:records|audits|statistics)(?:\/|$)/.test(location.pathname)
 const visible=new Set([...document.querySelectorAll<HTMLImageElement|HTMLAnchorElement|HTMLObjectElement|HTMLEmbedElement>('img,a,object,embed')].flatMap(node=>[node.getAttribute('src'),node.getAttribute('href'),node.getAttribute('data')]).filter(Boolean))
 for(const [id,url] of fileUrls)if((!inRecordPage || !activeFileIds.has(id)) && !visible.has(url)){URL.revokeObjectURL(url);fileUrls.delete(id)}
 if(!fileUrls.size){fileObserver?.disconnect();fileObserver=undefined}
}
function observeFiles():void {
 if(typeof document==='undefined' || fileObserver || !fileUrls.size)return
 fileObserver=new MutationObserver(cleanupUnusedFiles);fileObserver.observe(document.body,{childList:true,subtree:true})
}
function numeric(value:number):number {if(!Number.isSafeInteger(value)||value<0)throw new Error('质检来源数量不完整，未用0替代。');return value}
function view(task:PostFinishingQcTask,delivery:PostFinishingFactoryReturnDelivery|undefined,app:FinishedInventoryApplication|undefined,transfers:FinishedInventoryTransfer[],coverages:any[],detail:boolean):QualityInspectionRecordView {
 const kind=task.sourceKind || 'PRODUCTION_RETURN'
 if(task.sourceKind!==undefined && !['PRODUCTION_RETURN','WAREHOUSE_STOCK'].includes(task.sourceKind))throw new Error('质检原记录的来源类型无法识别，请保留原记录并核对。')
 if(!task.qcTaskId || !task.qcTaskNo || !task.lines?.length || (kind==='WAREHOUSE_STOCK' ? !task.inventoryApplicationId : !task.deliveryId))throw new Error('质检原记录身份不完整，未用其他来源代替。')
 if(new Set(task.lines.map(row=>row.sku?.skuId)).size!==task.lines.length || task.lines.some(row=>!row.sku?.skuId))throw new Error('质检原记录SKU身份缺失或重复，请核对来源。')
 if(kind==='WAREHOUSE_STOCK'&&!app)throw new Error('库存质检没有找到原送检申请，请核对来源。')
 for(const round of task.inspection?.rounds || [])for(const line of round.lines){numeric(line.passedQty);numeric(line.defectQty);numeric(line.returnQty);if(!task.lines.some(row=>row.sku.skuId===line.skuId))throw new Error('质检轮次包含非本批SKU。')}
 const quantity=task.lines.reduce((n,row)=>n+numeric(row.expectedQty),0)
 let inspection=task.inspection
 if(!inspection&&!['待送检','待质检'].includes(task.status))throw new Error('质检来源缺少本次开检标准，请重新读取后核对。')
 if(inspection && task.status!=='质检完成' && kind!=='WAREHOUSE_STOCK'){
  const matched=coverages.filter(row=>row.productionOrderId===task.productionOrderId && (row.scope==='PRODUCTION_ORDER' || row.factoryId===delivery?.sewingFactoryId))
  if(matched.length){inspection={...inspection,fullReasons:[...inspection.fullReasons],audits:inspection.audits.map(row=>({...row}))};applyPostQcFullCoverage(inspection,matched.map(row=>row.label),matched.map(row=>row.createdAt).sort()[0])}
 }
 const summary=inspection?getPostQcSummary(inspection,task.lines.map(row=>({skuId:row.sku.skuId,quantity:row.expectedQty}))):undefined
 const issues=inspection?.rounds.flatMap(round=>round.lines.flatMap(line=>line.issues || [])) || []
 const issueNames:Record<string,string>={}
 for(const issue of issues){const item=inspection!.snapshot.items.find(row=>row.id===issue.itemId) || inspection!.snapshot.skuSnapshots?.flatMap(row=>row.snapshot.items).find(row=>row.id===issue.itemId);issueNames[issue.itemId]=item?.name || issue.itemId}
 const sum=(category:string,key:'receivedQty'|'putawayQty')=>transfers.filter(row=>row.category===category).reduce((n,row)=>n+row.lines.reduce((total,line)=>total+(key==='putawayQty'?(line.putawayAt?line.receivedQty || 0:0):line.receivedQty || 0),0),0)
 return {id:task.qcTaskId,sourceKind:kind,sourceId:app?.id || task.inventoryApplicationId || task.deliveryId,displayNo:task.qcTaskNo,
  sourceHref:`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}&view=detail`,styleId:task.styleId,styleCode:task.lines[0].sku.spuCode,styleName:task.lines[0].sku.spuName,imageUrl:task.lines[0].sku.imageUrl,
  factoryName:delivery?.sewingFactoryName,warehouseName:task.sourceWarehouseName,productionOrderNo:task.productionOrderNo || undefined,status:task.status,openedAt:task.claimedAt || app?.receivedAt || app?.createdAt,completedAt:task.completedAt,quantity,
  inspectedQty:summary?.inspectedQty,passedQty:summary?.passedQty,defectQty:summary?.defectQty,returnedQty:summary?.returnQty,uninspectedReleaseQty:task.status==='质检完成'?summary?.uninspectedQty:undefined,normalReleaseQty:task.status==='质检完成'?summary?.releasedQty:undefined,
  issues,issueNames,audits:inspection?.audits.map(row=>({...row})),
  sentQty:app?.lines.reduce((n,row)=>n+numeric(row.outboundQty),0),receivedQty:app?.receivedAt?app.lines.reduce((n,row)=>n+numeric(row.receivedQty!),0):undefined,
  returnReceivedQty:app?sum('正常返仓','receivedQty'):undefined,putawayQty:app?sum('正常返仓','putawayQty'):undefined,gotoReceivedQty:app?sum('返工交接','receivedQty'):undefined,
  defectReceivedQty:app?sum('瑕疵入仓','receivedQty'):undefined,defectPutawayQty:app?sum('瑕疵入仓','putawayQty'):undefined,
  destinationSummary:transfers.map(row=>`${row.category}：${finishedInventoryTransferStatus(row)}`).join('；'),
  ...(detail?{snapshot:inspection?.snapshot,basisClarifications:inspection?.basisClarifications,independentChecks:task.independentChecks,
   rounds:inspection?.rounds.map(round=>({id:round.id,roundNumber:round.roundNumber,percent:round.percent,target:round.target,submittedAt:round.submittedAt,passedQty:round.lines.reduce((n,line)=>n+line.passedQty,0),defectQty:round.lines.reduce((n,line)=>n+line.defectQty,0),returnedQty:round.lines.reduce((n,line)=>n+line.returnQty,0),issues:round.lines.flatMap(line=>line.issues || []),observations:round.lines.flatMap(line=>line.observations || [])}))}:{}),
 }
}
const applicationRecordPrefix='inventory-application:'
/** Read the original application before physical receipt. No QC or write is created. */
function inventoryApplicationView(app:FinishedInventoryApplication,transfers:FinishedInventoryTransfer[]):QualityInspectionRecordView {
 if(!app.id || !app.applicationNo || !app.styleId || !app.styleNo || !app.warehouseId || !app.lines?.length)throw new Error('库存送检申请身份不完整，未用空质检记录替代。')
 const sentQty=app.lines.reduce((n,row)=>n+numeric(row.outboundQty),0)
 const receivedQty=app.receivedAt?app.lines.reduce((n,row)=>n+numeric(row.receivedQty!),0):undefined
 return {id:applicationRecordPrefix+app.id,sourceId:app.id,sourceKind:'WAREHOUSE_STOCK',inventoryApplicationOnly:true,
  displayNo:app.applicationNo,sourceHref:`/wls/finished/inventory-quality?id=${encodeURIComponent(app.id)}`,
  styleId:app.styleId,styleCode:app.styleNo,styleName:app.styleName,imageUrl:app.imageUrl,warehouseName:app.warehouseName,
  status:finishedInventoryApplicationStatus(app),openedAt:app.createdAt,quantity:receivedQty,sentQty,receivedQty,issues:[],
  destinationSummary:transfers.map(row=>`${row.category}：${finishedInventoryTransferStatus(row)}`).join('；')}
}
async function materialize(rows:QualityInspectionRecordView[]):Promise<QualityInspectionRecordView[]> {
 const ids=new Set(rows.flatMap(row=>[...pcsFileReferences(row)]))
 const missing=[...ids].filter(id=>!fileUrls.has(id))
 if(missing.length){const files=await readPcsFiles(missing);if(missing.some(id=>!files.some(row=>row.id===id)))throw new Error('固定检查资料引用的原文件缺失，请核对原记录。');for(const id of missing)fileUrls.set(id,URL.createObjectURL(files.find(row=>row.id===id)!.blob))}
 activeFileIds=ids;observeFiles();cleanupUnusedFiles()
 if(!ids.size)return rows
 const visit=(value:any):any=>typeof value==='string'&&value.startsWith('pcs-file:')?fileUrls.get(value.slice(9)) || value:Array.isArray(value)?value.map(visit):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visit(item)])):value
 return rows.map(visit)
}
async function read(detailId?:string):Promise<void> {
 const deliveries=new Map<string,PostFinishingFactoryReturnDelivery>(),apps=new Map<string,FinishedInventoryApplication>(),transfers=new Map<string,FinishedInventoryTransfer>(),coverage=new Map<string,any>()
 const transferGroups=new Map<string,FinishedInventoryTransfer[]>()
 const baseline=projectPostFinishingStaticRecords('flow',(row)=>row).filter(row=>['flow/qcTasks','flow/deliveries','flow/fullCoverages'].includes(row.collection))
 const tasks=new Map<string,PostFinishingQcTask>()
 const collect=(row:PcsStoredRecord):null=>{
  const value:any=row.value
  if(!row.deleted){
   const identities:[string,string,string][]=[['flow/deliveries',`${post}/flow/deliveries/`,'deliveryId'],['flow/fullCoverages',`${post}/flow/fullCoverages/`,'coverageId'],[`${inventory}/applications`,`${inventory}/applications/`,'id'],[`${inventory}/transfers`,`${inventory}/transfers/`,'id']]
   const identity=identities.find(([collection,prefix])=>row.collection===collection || row.id.startsWith(prefix))
   if(identity && (row.collection!==identity[0] || !value?.[identity[2]] || row.id!==identity[1]+encodeURIComponent(value[identity[2]])))throw new Error('质检来源关联记录的身份与保存位置不一致，请保留原资料并核对。')
  }
  if(row.collection==='flow/deliveries' || row.id.startsWith(`${post}/flow/deliveries/`)){if(row.deleted)deliveries.delete(decodeURIComponent(row.id.split('/').at(-1)!));else deliveries.set(value.deliveryId,value)}
  else if(row.collection==='flow/fullCoverages' || row.id.startsWith(`${post}/flow/fullCoverages/`)){if(row.deleted)coverage.delete(decodeURIComponent(row.id.split('/').at(-1)!));else coverage.set(value.coverageId,value)}
  else if(row.collection===`${inventory}/applications` || row.id.startsWith(`${inventory}/applications/`)){if(row.deleted)apps.delete(decodeURIComponent(row.id.split('/').at(-1)!));else apps.set(value.id,value)}
  else if(row.collection===`${inventory}/transfers` || row.id.startsWith(`${inventory}/transfers/`)){if(row.deleted)transfers.delete(decodeURIComponent(row.id.split('/').at(-1)!));else transfers.set(value.id,value)}
  return null
 }
 for(const row of baseline){if(row.collection==='flow/qcTasks')tasks.set((row.value as PostFinishingQcTask).qcTaskId,row.value as PostFinishingQcTask);else collect(row)}
 // Queue metadata before QC values, then project each detached QC immediately.
 // Only the chosen detail retains its frozen tree; list scans never materialize
 // unrelated attachments or hydrate mutable execution stores.
 const selectors=[{prefix:`${post}/flow/deliveries/`},{prefix:`${post}/flow/fullCoverages/`},{prefix:`${inventory}/applications/`},{prefix:`${inventory}/transfers/`},{id:`${post}/flow/schemaVersion/value`},detailId?{id:`${post}/flow/qcTasks/${encodeURIComponent(detailId)}`}:{prefix:`${post}/flow/qcTasks/`}]
 const projected=new Map<string,QualityInspectionRecordView>();let indexed=false
 const indexTransfers=()=>{
  if(indexed)return
  for(const transfer of transfers.values()){const group=transferGroups.get(transfer.applicationId)||[];group.push(transfer);transferGroups.set(transfer.applicationId,group)}indexed=true
 }
 const projectTask=(task:PostFinishingQcTask)=>{
  indexTransfers()
  return view(task,deliveries.get(task.deliveryId),task.inventoryApplicationId?apps.get(task.inventoryApplicationId):undefined,task.inventoryApplicationId?transferGroups.get(task.inventoryApplicationId) || []:[],[...coverage.values()],!!detailId)
 }
 await readPcsRecordProjection(selectors,row=>{
  if(row.id===`${post}/flow/schemaVersion/value`){if(!row.deleted&&Number(row.value)!==5)throw new Error('后道来源不是当前演示版本，请完成本次定向重建后重新打开。');return null}
  if(row.collection==='flow/qcTasks' || row.id.startsWith(`${post}/flow/qcTasks/`)){
   const id=decodeURIComponent(row.id.split('/').at(-1)!);tasks.delete(id)
   if(!row.deleted){if(row.collection!=='flow/qcTasks' || !id || (row.value as PostFinishingQcTask)?.qcTaskId!==id)throw new Error('质检原记录身份与保存位置不一致，请保留原记录并核对。');projected.set(id,projectTask(row.value as PostFinishingQcTask))}
  }else collect(row)
  return null
 })
 for(const task of tasks.values())if(!detailId || task.qcTaskId===detailId)projected.set(task.qcTaskId,projectTask(task))
 indexTransfers()
 const applicationIds=new Set<string>()
 for(const row of projected.values())if(row.sourceKind==='WAREHOUSE_STOCK'){
  if(applicationIds.has(row.sourceId))throw new Error('同一库存送检申请出现多张质检记录，请核对唯一来源。')
  applicationIds.add(row.sourceId)
 }
 for(const app of apps.values()){
  const applicationDetail=detailId===applicationRecordPrefix+app.id
  if(applicationDetail || (!detailId && !applicationIds.has(app.id))){
   if(!applicationDetail && app.qcTaskId)throw new Error('库存送检申请关联的质检记录缺失，未用待接收记录掩盖。')
   const row=inventoryApplicationView(app,transferGroups.get(app.id) || []);projected.set(row.id,row)
  }
 }
 const rows=await materialize([...projected.values()])
 if(detailId){details.clear();for(const row of rows)details.set(row.id,row)}else{summaries.clear();for(const row of rows)summaries.set(row.id,row);details.clear()}
}
export function postQualityReadSource(kind:'PRODUCTION_RETURN'|'WAREHOUSE_STOCK') {
 return {prepare:()=>{preparing ||=read().finally(()=>{preparing=undefined});return preparing},list:()=>[...summaries.values()].filter(row=>row.sourceKind===kind),get:(id:string)=>{const row=details.get(id);return row?.sourceKind===kind?row:undefined},prepareDetail:async(id:string)=>{await read(id)}}
}
