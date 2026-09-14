import { getFactoryById, getFactoryByCode } from './indonesia-factories.ts'
import { getPrintingWorkflowFacts, listPrintingWorkOrders, listPrintingDispatchDocuments, type PrintingWorkOrderBusinessRecord } from './printing-task-domain.ts'
import { convertReceiptQuantity } from './factory-receiving.ts'

export interface PrintingStatisticsFilters {factoryId?:string;craft?:string;demandSource?:string;materialType?:string;dateFrom?:string;dateTo?:string}
export const normalizePrintingUnit=(unit:string)=>['kg','公斤','千克'].includes(unit)?'kg':['m','米'].includes(unit)?'米':['Yard','yard','YARD','y'].includes(unit)?'Yard':unit
export const printingFactoryTimeZone=(factoryId:string)=>(getFactoryById(factoryId)||getFactoryByCode(factoryId))?.timezone||'Asia/Jakarta'
export function printingBusinessDate(value:Date|number=new Date(),factoryId=''):string {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:printingFactoryTimeZone(factoryId),year:'numeric',month:'2-digit',day:'2-digit'}).format(value)
}
/** Offset-bearing timestamps are instants; legacy wall times belong to the factory, never the viewer. */
export function printingEventTimestamp(value:string|undefined,factoryId=''):number|undefined {
  if(!value)return undefined
  const text=value.trim().replace(' ','T')
  if(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)){const n=Date.parse(text);return Number.isFinite(n)?n:undefined}
  const match=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if(!match)return undefined
  const [,y,m,d,h='0',minute='0',second='0']=match
  if(+m<1||+m>12||+d<1||+d>31||+h>23||+minute>59||+second>59)return undefined
  const wall=Date.UTC(+y,+m-1,+d,+h,+minute,+second)
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:printingFactoryTimeZone(factoryId),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
  let instant=wall
  for(let i=0;i<2;i++){const p=Object.fromEntries(formatter.formatToParts(instant).map(part=>[part.type,part.value]));instant+=wall-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)}
  const expected=`${y}-${m}-${d}`
  return printingBusinessDate(instant,factoryId)===expected?instant:undefined
}
export function printingOrderIsOverdue(order:PrintingWorkOrderBusinessRecord,now=new Date()):boolean {
  if(['CANCELLED','PROCESS_COMPLETED'].includes(order.processingStatus)||order.manuallyCompletedAt)return false
  const due=printingEventTimestamp(order.plannedFinishAt?.length===10?`${order.plannedFinishAt} 23:59:59`:order.plannedFinishAt,order.printFactoryId)
  return due!==undefined&&due<now.getTime()
}
export function filterPrintingStatisticsOrders(rows:PrintingWorkOrderBusinessRecord[],filters:PrintingStatisticsFilters):PrintingWorkOrderBusinessRecord[]{
  return rows.filter(order=>{
    if(filters.factoryId&&order.printFactoryId!==filters.factoryId||filters.craft&&`${order.requirement.craftName} · ${order.requirement.type}`!==filters.craft||filters.demandSource&&order.demandSource.type!==filters.demandSource||filters.materialType&&order.materialType!==filters.materialType)return false
    const timestamp=printingEventTimestamp(order.orderedAt,order.printFactoryId),date=timestamp===undefined?'':printingBusinessDate(timestamp,order.printFactoryId)
    return (!filters.dateFrom||Boolean(date&&date>=filters.dateFrom))&&(!filters.dateTo||Boolean(date&&date<=filters.dateTo))
  })
}
export type PrintingQuantityMetric='planned'|'localReceived'|'used'|'completed'|'handedOver'|'downstreamReceived'|'downstreamPending'|'loss'|'todayPlanned'|'todayCompleted'
export interface PrintingStatisticsSummary {orderCount:number;productionOrderCount:number;demandOrderCount:number;overdueCount:number;noDueDateCount:number;unknownReceiptCount:number;unknownLossCount:number;unknownCompletionHistoryCount:number;receiptDifferenceCount:number;byUnit:Record<string,Record<PrintingQuantityMetric,number>>;lossRates:Record<string,number|undefined>}
const emptyMetrics=():Record<PrintingQuantityMetric,number>=>({planned:0,localReceived:0,used:0,completed:0,handedOver:0,downstreamReceived:0,downstreamPending:0,loss:0,todayPlanned:0,todayCompleted:0})
export function summarizePrintingStatistics(rows:PrintingWorkOrderBusinessRecord[],now=new Date()):PrintingStatisticsSummary {
  const summary:PrintingStatisticsSummary={orderCount:rows.length,productionOrderCount:new Set(rows.map(o=>o.demandSource.productionOrderNo).filter(Boolean)).size,demandOrderCount:new Set(rows.map(o=>o.demandSource.demandNo).filter(Boolean)).size,overdueCount:0,noDueDateCount:0,unknownReceiptCount:0,unknownLossCount:0,unknownCompletionHistoryCount:0,receiptDifferenceCount:0,byUnit:{},lossRates:{}}
  const denominator:Record<string,number>={},batchLoss:Record<string,number>={}
  const add=(unit:string,key:PrintingQuantityMetric,value:number)=>{const bucket=summary.byUnit[normalizePrintingUnit(unit)]??=emptyMetrics();bucket[key]+=value}
  for(const order of rows){
    const facts=getPrintingWorkflowFacts(order.workOrderId),input=order.plannedInput.qtyUnit,output=order.output.qtyUnit
    add(input,'planned',order.plannedInput.plannedQty);add(input,'used',order.actualInput.usedQty)
    if(order.historicalInputQuantityUnknown)summary.unknownReceiptCount++;else add(input,'localReceived',order.actualInput.receivedQty)
    add(output,'completed',order.output.completedQty);add(output,'handedOver',order.handover.handedOverQty);add(output,'downstreamReceived',order.handover.receivedQty);add(output,'downstreamPending',order.pendingWritebackQty)
    if(facts.lossQty===undefined)summary.unknownLossCount++;else add(input,'loss',facts.lossQty)
    if(order.output.completedQty>0&&!order.productionBatches?.length)summary.unknownCompletionHistoryCount++
    if(order.receiptStatus==='RECEIPT_DIFFERENCE')summary.receiptDifferenceCount++
    if(!printingEventTimestamp(order.plannedFinishAt,order.printFactoryId))summary.noDueDateCount++
    if(printingOrderIsOverdue(order,now))summary.overdueCount++
    const today=printingBusinessDate(now,order.printFactoryId),due=printingEventTimestamp(order.plannedFinishAt,order.printFactoryId)
    if(due!==undefined&&printingBusinessDate(due,order.printFactoryId)===today&&!['CANCELLED','PROCESS_COMPLETED'].includes(order.processingStatus))add(output,'todayPlanned',Math.max(0,order.output.plannedQty-order.output.completedQty))
    for(const batch of order.productionBatches??[]){
      const at=printingEventTimestamp(batch.at,order.printFactoryId)
      if(at!==undefined&&at<=now.getTime()&&printingBusinessDate(at,order.printFactoryId)===today)add(output,'todayCompleted',batch.qty)
      const completed=convertReceiptQuantity(batch.qty,output,input)
      if(completed!==undefined&&batch.lossQty!==undefined){const unit=normalizePrintingUnit(input);denominator[unit]=(denominator[unit]??0)+completed+batch.lossQty;batchLoss[unit]=(batchLoss[unit]??0)+batch.lossQty}
    }
  }
  for(const unit of Object.keys(summary.byUnit))summary.lossRates[unit]=denominator[unit]>0?batchLoss[unit]/denominator[unit]:undefined
  return summary
}
export function formatPrintingStatistic(summary:PrintingStatisticsSummary,metric:PrintingQuantityMetric):string{
  if(summary.orderCount>0&&metric==='localReceived'&&summary.unknownReceiptCount===summary.orderCount)return '历史未记录'
  if(summary.orderCount>0&&metric==='loss'&&summary.unknownLossCount===summary.orderCount)return '尚未核算'
  const entries=Object.entries(summary.byUnit).filter(([,values])=>values[metric]!==0)
  if(!entries.length)return Object.keys(summary.byUnit).map(unit=>`0 ${unit}`).join(' / ')||'暂无数据'
  return entries.map(([unit,values])=>`${values[metric].toLocaleString('zh-CN',{maximumFractionDigits:2})} ${unit}`).join(' / ')
}
export function printingCompletionTrend(rows:PrintingWorkOrderBusinessRecord[],now=new Date()):Array<{date:string;unit:string;qty:number;batches:number}>{
  const groups=new Map<string,{date:string;unit:string;qty:number;batches:number}>()
  for(const order of rows)for(const batch of order.productionBatches??[]){const at=printingEventTimestamp(batch.at,order.printFactoryId);if(at===undefined||at>now.getTime())continue;const date=printingBusinessDate(at,order.printFactoryId),unit=normalizePrintingUnit(order.output.qtyUnit),key=`${date}:${unit}`,group=groups.get(key)??{date,unit,qty:0,batches:0};group.qty+=batch.qty;group.batches++;groups.set(key,group)}
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.unit.localeCompare(b.unit))
}
export function printingCurrentAction(order:PrintingWorkOrderBusinessRecord):{label:string;route:string;priority:number}|undefined {
  if(order.processingStatus==='CANCELLED'||order.manuallyCompletedAt)return undefined
  const facts=getPrintingWorkflowFacts(order.workOrderId),id=encodeURIComponent(order.workOrderId)
  const detail=`/fcs/craft/printing/work-orders/${id}`
  if(order.pendingWritebackQty>0){
    const hasDispatch=listPrintingDispatchDocuments().some(d=>d.status==='已交出'&&d.lines.some(l=>l.workOrderId===order.workOrderId))
    return hasDispatch?{label:'跟进下游实收',route:`/fcs/craft/printing/handover-documents?workOrderId=${id}`,priority:7}:{label:'核对历史交接',route:detail,priority:7}
  }
  if(order.processingStatus==='PROCESS_COMPLETED'&&order.handoverStatus==='FULL_HANDOVER')return undefined
  if(order.historicalInputQuantityUnknown)return {label:'核对历史用料',route:detail,priority:1}
  const docs=listPrintingDispatchDocuments().filter(d=>d.status==='草稿'&&d.lines.some(l=>l.workOrderId===order.workOrderId))
  if(docs.some(d=>d.scanCompletedAt))return {label:'扫齐待实际交接',route:`/fcs/craft/printing/handover-documents?workOrderId=${id}`,priority:6}
  if(docs.length)return {label:'交出单待扫码',route:`/fcs/craft/printing/handover-documents?workOrderId=${id}`,priority:5}
  if(facts.availableOutputQty>0)return {label:order.barcodes.some(b=>b.quantityConfirmed===true)?'待建立交出单':'待整理产出卷',route:`/fcs/craft/printing/pending-handover?workOrderId=${id}`,priority:4}
  if(['WAIT_SOURCE','WAIT_RECEIVE','PARTIAL_RECEIVED'].includes(order.receiptStatus)&&order.actualInput.receivedQty<=0)return {label:order.receiptStatus==='WAIT_SOURCE'?'待上游供料':'待接收入仓',route:`/fcs/craft/printing/pending-receipts?workOrderId=${id}`,priority:0}
  if(!facts.artworkConfirmed)return {label:'待确认花型',route:detail,priority:1}
  if(!facts.sampleConfirmed)return {label:'待确认打样',route:detail,priority:1}
  if(order.processingStatus==='WAIT_START')return {label:'待实际开工',route:detail,priority:2}
  if(order.processingStatus==='PROCESSING')return {label:facts.requiresTransfer&&facts.transferStartedAt?'转印在制':'印制在制',route:detail,priority:3}
  return undefined
}
export function getPrintingStatistics(filters:PrintingStatisticsFilters={},now=new Date()) {const rows=filterPrintingStatisticsOrders(listPrintingWorkOrders(),filters);return {rows,summary:summarizePrintingStatistics(rows,now),trend:printingCompletionTrend(rows,now)}}
