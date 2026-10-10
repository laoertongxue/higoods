import type {CutPieceFact,ReleaseTicketDetail,ReleaseTicketCraftStep} from '../cut-piece-release-domain.ts'
import {listGeneratedFeiTickets,type GeneratedFeiTicketSourceRecord} from './generated-fei-tickets.ts'
import {listManualFeiTicketSources} from './manual-fei-tickets.ts'
import {listManagedCuttingRuntimeEvents,type CuttingRuntimeEvent} from './cutting-runtime-event-ledger.ts'
import {listSpecialCraftTicketReturnFacts,listSpecialCraftProcessingCompletionFacts,type SpecialCraftTicketReturnFact,type SpecialCraftProcessingCompletionFact,isCompleteSuccessfulSpecialCraftHandoverEvent,isCompleteSuccessfulWholeBagHandoverEvent,resolveTransferBagCurrentUse,resolveTransferBagCurrentUsesFromEvents,resolveTransferBagAuthoritativeCurrentLocation} from './transfer-bag-operations.ts'
import {createCuttingRuntimeChronologyComparator} from './cutting-runtime-chronology.ts'
import type {BrowserStorageLike} from '../../browser-storage.ts'
import {listCuttingSpecialCraftFeiTicketBindingsForProjection,type CuttingSpecialCraftFeiTicketBinding} from './special-craft-fei-ticket-flow.ts'
import type {TechPackCutPiecePartSnapshot,TechPackPatternFileSnapshot} from '../production-tech-pack-snapshot-types.ts'
import {getProductionOrderCutPieceParts,getProductionOrderPatternFiles} from '../production-order-tech-pack-runtime.ts'
import {getCutPieceTicketValidity,isCutPieceTicketUsable} from './cut-piece-ticket-validity.ts'

export interface CutPieceReleaseTicketEligibility {found:boolean;valid:boolean;bagged:boolean;requiresSpecialCraft:boolean;craftRequirementKnown:boolean;physicalPieceQty:number;eligiblePieceQty:number;canHandover:boolean;reason:string}
export interface ReleaseBagEvidence {ticketId:string;ticketNo?:string;baggedPieceQty?:number;bagCode:string;bagUseId?:string;eventId:string;at:string;operator:string;locationLabel:string}
const qty=(value:unknown):value is number=>typeof value==='number' && Number.isSafeInteger(value) && value>=0
/** 一次读取的装袋历史；正常回收、换袋或车缝交出不撤销已经有效装袋的裁片。 */
export function buildReleaseBagEvidence(events:readonly CuttingRuntimeEvent[]):Map<string,ReleaseBagEvidence> {
  const result=new Map<string,ReleaseBagEvidence>()
  for(const event of events) {
    if(!['已记录','已同步'].includes(event.eventStatus) || !['菲票装袋','中转袋入仓'].includes(event.eventType)) continue
    const payload=event.payload as unknown as {bagCode?:string;feiTicketItems?:Array<{feiTicketId?:string;feiTicketNo?:string;pieceQty?:number;voidStatus?:string;printStatus?:string}>;warehouseArea?:string;locationCode?:string;tempBagUseId?:string}
    const bagCode=payload.bagCode || event.refs.transferBagCode
    if(!bagCode || !payload.feiTicketItems?.length) continue
    for(const item of payload.feiTicketItems) if(item.feiTicketId && item.feiTicketNo && qty(item.pieceQty) && item.voidStatus!=='VOIDED' && item.printStatus!=='VOIDED') {
      result.set(item.feiTicketId,{ticketId:item.feiTicketId,ticketNo:item.feiTicketNo,baggedPieceQty:item.pieceQty,bagCode,bagUseId:event.refs.usageCycleId || payload.tempBagUseId,eventId:event.eventId,at:event.occurredAt,operator:event.operatorName,locationLabel:[payload.warehouseArea,payload.locationCode].filter(Boolean).join(' / ') || '有效装袋'})
    }
  }
  return result
}
type ReleaseTicketProjectionInput={ticket:GeneratedFeiTicketSourceRecord;materialId:string;materialName:string;bag?:ReleaseBagEvidence;receipts:readonly SpecialCraftTicketReturnFact[];completions?:readonly SpecialCraftProcessingCompletionFact[];bindings?:readonly CuttingSpecialCraftFeiTicketBinding[];events?:readonly CuttingRuntimeEvent[];craftRequirementKnown:boolean;valid?:boolean}
export function projectReleaseTicket(input:ReleaseTicketProjectionInput):ReleaseTicketDetail {
  return projectReleaseTicketFromHandovers(input,input.events?.filter(isCompleteSuccessfulSpecialCraftHandoverEvent) || [])
}
function projectReleaseTicketFromHandovers(input:ReleaseTicketProjectionInput,handovers:readonly CuttingRuntimeEvent[]):ReleaseTicketDetail {
  const {ticket}=input
  const bagIdentityKnown=!input.bag || (!input.bag.ticketNo || input.bag.ticketNo===ticket.feiTicketNo) && (input.bag.baggedPieceQty===undefined || qty(input.bag.baggedPieceQty) && input.bag.baggedPieceQty>0 && input.bag.baggedPieceQty<=ticket.actualCutPieceQty)
  const valid=input.valid !== false && ticket.printStatus!=='VOIDED' && bagIdentityKnown && qty(ticket.actualCutPieceQty)
  const printed=qty(ticket.actualCutPieceQty)?ticket.actualCutPieceQty:qty(ticket.qty)?ticket.qty:0
  let stageQty=printed,eligible=0,at='',by='',receiptId='',differenceReason=''
  let previousComplete=true,previousReturnedAt='',completionEvidenceKnown=true
  const steps:ReleaseTicketCraftStep[]=ticket.specialCrafts.map((craft,index)=>{
    // 一袋多票的阶段 ID 属于各张票；袋头只代表首票，不能用于其他票的归属。
    const handedOver=handovers.filter(event=> (event.payload as unknown as {feiTicketItems?:Array<{feiTicketId:string;specialCraftId:string}>}).feiTicketItems?.some(item=>item.feiTicketId===ticket.feiTicketId && item.specialCraftId===craft.specialCraftId)).at(-1)
    const stageBindings=input.bindings?.filter(row=>row.feiTicketId===ticket.feiTicketId && row.specialCraftId===craft.specialCraftId) || []
    const assignedFactories=[...new Map(stageBindings.filter(row=>row.assignedFactoryConfirmed===true && row.targetFactoryId).map(row=>[row.targetFactoryId,{id:row.targetFactoryId,name:row.targetFactoryName}])).values()]
    const handoverPayload=handedOver?.payload as unknown as {receiverFactoryId:string;receiverFactoryName:string;handoverRecordNo?:string;handoverOrderNo?:string}|undefined
    // 已明确交出的实际承接厂优先；多项实际分配没有交出依据时，不猜其中一家。
    const factory=handoverPayload?{id:handoverPayload.receiverFactoryId,name:handoverPayload.receiverFactoryName}:assignedFactories.length===1?assignedFactories[0]:assignedFactories.length>1?{id:'',name:'承接厂待确认'}:{id:craft.receiverFactoryId,name:craft.receiverFactoryName}
    const receipt=input.receipts.find(row=>row.feiTicketId===ticket.feiTicketId && row.specialCraftId===craft.specialCraftId && row.receiverFactoryId===factory.id)
    const binding=stageBindings.find(row=>row.targetFactoryId===factory.id)
    const completion=input.completions?.find(row=>row.feiTicketId===ticket.feiTicketId && row.specialCraftId===craft.specialCraftId && row.receiverFactoryId===factory.id && row.processingCompleted===true && qty(row.returnedQty) && row.returnedQty<=stageQty && Number.isFinite(Date.parse(row.returnedAt)) && (!previousReturnedAt || Date.parse(row.returnedAt)>=Date.parse(previousReturnedAt)))
    const physicalReturnedAt=receipt?.originalReturnedAt || receipt?.returnedAt || ''
    const returnedQty=receipt && qty(receipt.returnedQty) && receipt.returnedQty<=stageQty && Number.isFinite(Date.parse(physicalReturnedAt)) && (!previousReturnedAt || Date.parse(physicalReturnedAt)>=Date.parse(previousReturnedAt)) ? receipt.returnedQty:null
    const hasCompletion=Boolean(receipt?.processingCompleted===true && returnedQty!==null || completion || binding && ['已完成','待回仓','已回仓'].includes(binding.specialCraftFlowStatus) && qty(binding.closingQty))
    if(returnedQty!==null && !hasCompletion)completionEvidenceKnown=false
    const expectedQty=stageQty
    const completed=previousComplete && hasCompletion
    if(returnedQty!==null) {stageQty=returnedQty;previousReturnedAt=physicalReturnedAt;at=receipt!.returnedAt;by=receipt!.returnedBy;receiptId=receipt!.eventId;differenceReason=receipt!.differenceReason}
    else if(completed && completion) {stageQty=completion.returnedQty;previousReturnedAt=completion.returnedAt}
    else if(completed && binding && qty(binding.closingQty)) stageQty=Math.min(stageQty,binding.closingQty)
    previousComplete=completed
    if(index===ticket.specialCrafts.length-1 && completed && returnedQty!==null) eligible=returnedQty
    return {sequence:index+1,craftId:craft.specialCraftId,craftName:craft.craftName,craftType:craft.craftCategory,factoryName:factory.name,expectedQty,
      processedQty:completed?(returnedQty ?? completion?.returnedQty ?? binding?.closingQty ?? 0):0,handedOverQty:handedOver?expectedQty:0,returnedQty,
      status:returnedQty!==null?(hasCompletion?'已实际回仓':'已实收，加工完成待核对'):completion && completed?'已交下一工艺':completed?'加工完成待回仓':handedOver?'加工中':'待加工',returnedAt:receipt?.returnedAt,returnedBy:receipt?.returnedBy,receiptId:receipt?.eventId,
      receiptNo:receipt?.returnRecordNo,sourceHandoverNo:receipt?.sourceHandoverRecordNo || receipt?.sourceHandoverOrderNo || handoverPayload?.handoverRecordNo || handoverPayload?.handoverOrderNo,
      returnLocationLabel:receipt?.locationRef?[receipt.locationRef.areaName,receipt.locationRef.shelfNo,receipt.locationRef.locationNo].filter(Boolean).join(' / '):undefined}
  })
  if(!ticket.specialCrafts.length && input.craftRequirementKnown) eligible=printed
  if(!valid || !input.bag || !input.craftRequirementKnown || ticket.hasSpecialCraft && !ticket.specialCrafts.length) eligible=0
  return {ticketId:ticket.feiTicketId,ticketNo:ticket.feiTicketNo,sourceType:ticket.sourceBasisType==='MANUAL_MARKER_PLAN'?'手动唛架':'实际裁剪',sourceNo:ticket.sourceMarkerPlanNo || ticket.sourceSpreadingSessionNo,
    cutOrderNo:ticket.cutOrderNo,spreadingOrderNo:ticket.spreadingOrderNo,garmentColor:ticket.garmentColor,size:ticket.skuSize,fabricColor:ticket.fabricColor,
    materialId:input.materialId,materialName:input.materialName,partId:ticket.partCode,partName:ticket.partName,printedPieceQty:printed,
    physicalPieceQty:valid?stageQty:0,eligiblePieceQty:eligible,validity:valid?'可用':'不可用',bagCode:input.bag?.bagCode || '',bagUseId:input.bag?.bagUseId,
    locationLabel:at?'裁床待交出仓':input.bag?.locationLabel || '尚未装袋',requiresSpecialCraft:ticket.hasSpecialCraft || ticket.specialCrafts.length>0,
    craftRequirementKnown:input.craftRequirementKnown && (!ticket.hasSpecialCraft || ticket.specialCrafts.length>0),completionEvidenceKnown,craftSteps:steps,returnedAt:at || undefined,returnedBy:by || undefined,receiptId:receiptId || undefined,differenceReason:differenceReason || undefined}
}
let publishedDetails:()=>ReleaseTicketDetail[]=()=>[]
export function setPublishedReleaseTicketDetails(reader:()=>ReleaseTicketDetail[]):void {publishedDetails=reader}
function allTickets():GeneratedFeiTicketSourceRecord[] {return [...new Map([...listGeneratedFeiTickets(),...listManualFeiTicketSources()].map(ticket=>[ticket.feiTicketId,ticket])).values()]}
const detailCache=new Map<string,{signature:string;value:ReleaseTicketDetail[]}>()
/** 当前归属取有效在用袋和真实交接，回仓记录中的库位仍保留为历史依据。 */
export function buildCutPieceReleaseCurrentTicketLocations(events:CuttingRuntimeEvent[],receipts:SpecialCraftTicketReturnFact[],storage?:BrowserStorageLike|null):Map<string,string> {
  const current=new Map<string,string>(),latest=new Map<string,{event:CuttingRuntimeEvent;label:string}>()
  const compareChronology=createCuttingRuntimeChronologyComparator(events.filter(event=>event.eventStatus!=='已取消'))
  const remember=(id:string,event:CuttingRuntimeEvent,label:string)=>{const prior=latest.get(id);if(!prior || compareChronology(event,prior.event)>0)latest.set(id,{event,label})}
  const byId=new Map(events.map(event=>[event.eventId,event]))
  for(const receipt of receipts){const event=byId.get(receipt.eventId);if(event && (event.payload as unknown as {inventoryAdjusted?:boolean}).inventoryAdjusted!==false)remember(receipt.feiTicketId,event,['裁床待交出仓',receipt.locationRef.areaName,receipt.locationRef.shelfNo,receipt.locationRef.locationNo].filter(Boolean).join(' / '))}
  for(const event of events) {
    if(!isCompleteSuccessfulSpecialCraftHandoverEvent(event) && !isCompleteSuccessfulWholeBagHandoverEvent(event) && !(event.eventType==='简易裁片交出' && event.eventStatus==='已同步'))continue
    const payload=event.payload as unknown as {receiverFactoryName?:string;receiverName?:string;factoryName?:string;feiTicketItems?:Array<{feiTicketId:string;receiverFactoryName?:string}>;tickets?:Array<{feiTicketId:string;receiverFactoryName?:string}>}
    for(const item of payload.feiTicketItems || payload.tickets || [])remember(item.feiTicketId,event,`已交出 · ${item.receiverFactoryName || payload.receiverFactoryName || payload.receiverName || payload.factoryName || '接收厂待核对'}`)
  }
  const codes=new Set(events.flatMap(event=>[event.refs.transferBagCode || '',...(event.refs.transferBagCodes || [])]).filter(Boolean))
  const uses=storage===undefined?resolveTransferBagCurrentUsesFromEvents([...codes],events):new Map([...codes].map(bagCode=>[bagCode,resolveTransferBagCurrentUse(bagCode,storage)]))
  for(const bagCode of codes){const use=uses.get(bagCode)!;if(!use.tickets.length || !use.usageCycleId)continue
    const location=resolveTransferBagAuthoritativeCurrentLocation({bagCode,usageCycleId:use.usageCycleId,events})
    const label=location?[location.warehouseArea,location.locationRef?.shelfNo,location.locationCode].filter(Boolean).join(' / '):`中转袋 ${bagCode} · 待入仓`
    for(const ticket of use.tickets)current.set(ticket.feiTicketId,label)
  }
  for(const [id,fact] of latest)if(!current.has(id))current.set(id,fact.label)
  return current
}
export function isReleaseTicketCraftRequirementKnown(ticket:GeneratedFeiTicketSourceRecord,parts:readonly TechPackCutPiecePartSnapshot[],patterns:readonly TechPackPatternFileSnapshot[]):boolean {
  const canonical=parts.filter(part=>part.partCode===ticket.partCode),named=parts.filter(part=>part.partNameCn===ticket.partName)
  const matched=canonical.length===1?canonical[0]:canonical.length===0 && named.length===1?named[0]:undefined
  // 旧部位快照可能丢失明确空数组；仅从本单同纸样、版本、材料和部位的正式资料补足。
  if(matched && !Array.isArray(matched.specialCrafts)) {
    const identity=ticket.patternIdentity
    if(canonical.length!==1 || matched.materialSku!==ticket.materialSku || !identity?.patternFileId || !identity.patternVersion || ticket.hasSpecialCraft || ticket.specialCrafts.length) return false
    const files=patterns.filter(pattern=>pattern.patternFileId===identity.patternFileId && pattern.patternVersion===identity.patternVersion && pattern.linkedBomItemId===ticket.materialSku)
    if(files.length!==1) return false
    const rows=files[0].pieceRows?.filter(row=>row.id===ticket.partCode) || []
    return rows.length===1 && Array.isArray(rows[0].specialCrafts) && rows[0].specialCrafts.length===0
  }
  const required=(matched?.specialCrafts || []).filter(craft=>!craft.selectedTargetObject || craft.selectedTargetObject==='已裁部位')
  return Boolean(matched && Array.isArray(matched.specialCrafts) && required.length===ticket.specialCrafts.length && required.every((craft,index)=>{const name=craft.displayName || craft.craftName || craft.processName;return ticket.specialCrafts[index]?.craftName===name}))
}
export function listCutPieceReleaseTicketDetails(ticketIds?:ReadonlySet<string>):ReleaseTicketDetail[] {
  const events=listManagedCuttingRuntimeEvents(),bags=buildReleaseBagEvidence(events),receipts=listSpecialCraftTicketReturnFacts(events),bindings=listCuttingSpecialCraftFeiTicketBindingsForProjection(receipts)
  const tickets=allTickets().filter(ticket=>!ticketIds || ticketIds.has(ticket.feiTicketId)),published=publishedDetails().filter(ticket=>!ticketIds || ticketIds.has(ticket.ticketId))
  const cacheKey=ticketIds?[...ticketIds].sort().join('\0'):'all'
  const partsByOrder=new Map([...new Set(tickets.map(ticket=>ticket.productionOrderId))].map(id=>[id,getProductionOrderCutPieceParts(id)]))
  const patternsByOrder=new Map([...partsByOrder].filter(([,parts])=>parts.some(part=>!Array.isArray(part.specialCrafts))).map(([id])=>[id,getProductionOrderPatternFiles(id)]))
  const signature=JSON.stringify([events.map(event=>[event.eventId,event.eventStatus,event.payload]),tickets.map(ticket=>[ticket.feiTicketId,ticket.printStatus,ticket.actualCutPieceQty,ticket.specialCrafts,ticket.manualUpdatedAt,getCutPieceTicketValidity(ticket.feiTicketId)]),[...partsByOrder],[...patternsByOrder],bindings,published])
  const cached=detailCache.get(cacheKey)
  if(cached?.signature===signature) return cached.value
  const completions=listSpecialCraftProcessingCompletionFacts(events),handovers=events.filter(isCompleteSuccessfulSpecialCraftHandoverEvent)
  const locations=buildCutPieceReleaseCurrentTicketLocations(events,receipts)
  const value=[...tickets.map(ticket=>{
    const parts=partsByOrder.get(ticket.productionOrderId)!
    const known=isReleaseTicketCraftRequirementKnown(ticket,parts,patternsByOrder.get(ticket.productionOrderId) || [])
    const detail=projectReleaseTicketFromHandovers({ticket,materialId:ticket.materialSku,materialName:ticket.materialIdentity.materialName || ticket.materialSku,bag:bags.get(ticket.feiTicketId),receipts,completions,bindings,events,craftRequirementKnown:known,valid:isCutPieceTicketUsable(ticket.feiTicketId)},handovers)
    if(locations.has(ticket.feiTicketId))detail.locationLabel=locations.get(ticket.feiTicketId)!
    return detail
  }),...published]
  if(detailCache.size>=2 && !detailCache.has(cacheKey))detailCache.delete(detailCache.keys().next().value!)
  detailCache.set(cacheKey,{signature,value})
  return value
}
export function getCutPieceReleaseTicketEligibility(ticketId:string):CutPieceReleaseTicketEligibility {
  return getCutPieceReleaseEligibilityForDetail(listCutPieceReleaseTicketDetails().find(ticket=>ticket.ticketId===ticketId))
}
export function getCutPieceReleaseEligibilityForDetail(detail:ReleaseTicketDetail|undefined):CutPieceReleaseTicketEligibility {
  if(!detail) return {found:false,valid:false,bagged:false,requiresSpecialCraft:false,craftRequirementKnown:false,physicalPieceQty:0,eligiblePieceQty:0,canHandover:false,reason:'菲票来源未找到，请核对票号。'}
  const valid=detail.validity==='可用',ready=detail.craftRequirementKnown && detail.completionEvidenceKnown!==false && (!detail.requiresSpecialCraft || detail.eligiblePieceQty>0)
  return {found:true,valid,bagged:Boolean(detail.bagCode),requiresSpecialCraft:detail.requiresSpecialCraft,craftRequirementKnown:detail.craftRequirementKnown,
    physicalPieceQty:detail.physicalPieceQty,eligiblePieceQty:detail.eligiblePieceQty,canHandover:valid && ready && detail.physicalPieceQty>0,
    reason:!valid?'整票不可用，不能交出。':!detail.craftRequirementKnown?'工艺要求待补齐，请核对部位资料。':detail.completionEvidenceKnown===false?'已实收，但加工完成依据待核对，不能交给车缝。':!ready?'必要工艺尚未全部最终回仓，不能交给车缝。':''}
}
export function buildTicketReleaseFacts(tickets:readonly GeneratedFeiTicketSourceRecord[],details:readonly ReleaseTicketDetail[],materialKeyByCutOrder:Map<string,string>):CutPieceFact[] {
  const byId=new Map(details.map(detail=>[detail.ticketId,detail]))
  return [...new Map(tickets.map(ticket=>[ticket.feiTicketId,ticket])).values()].flatMap(ticket=>{
    const detail=byId.get(ticket.feiTicketId),materialId=materialKeyByCutOrder.get(ticket.cutOrderId)
    if(!detail?.bagCode || !materialId || !['ACTUAL_CUTTING_OUTPUT','MANUAL_MARKER_PLAN'].includes(ticket.sourceBasisType)) return []
    const identityKnown=qty(ticket.actualCutPieceQty) && detail.ticketNo===ticket.feiTicketNo && detail.garmentColor===ticket.garmentColor && detail.size===ticket.skuSize && detail.fabricColor===ticket.fabricColor && detail.partId===ticket.partCode && detail.cutOrderNo===ticket.cutOrderNo
    // 身份矛盾不能转为正常零量或借用其他部位的票。

    const validity=getCutPieceTicketValidity(ticket.feiTicketId)
    return [{factId:`bagged-ticket:${ticket.feiTicketId}`,sourceEventId:ticket.feiTicketId,productionOrderId:ticket.productionOrderId,cutOrderId:ticket.cutOrderId,cutOrderNo:ticket.cutOrderNo,
      spreadingOrderNo:ticket.spreadingOrderNo,garmentColor:ticket.garmentColor,size:ticket.skuSize,materialId,partId:ticket.partCode,
      identityKnown,actualPieceQty:identityKnown?detail.eligiblePieceQty:0,physicalPieceQty:identityKnown?detail.physicalPieceQty:0,ticketDetail:{...detail,materialId},direction:'正向' as const,sourceStatus:'持续更新' as const,
      occurredAt:validity?.at || detail.returnedAt || ticket.manualUpdatedAt || ticket.issuedAt}]
  })
}
export function listReleaseSourceTickets():GeneratedFeiTicketSourceRecord[] {return allTickets()}
