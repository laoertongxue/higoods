import { formatIndonesiaBusinessDateTime } from '../indonesia-business-time.ts'
import {
  computeUsableLength, computeRemainingLength, createRollRecordDraft, createOperatorRecordDraft,
  createSpreadingOperationLog, normalizeSpreadingOperationLogs, deriveSpreadingSessionGarmentQtyPerLayer,
  summarizeSpreadingRolls, finalizeSpreadingCompletion, validateSpreadingCompletion, upsertSpreadingSession, deriveSpreadingListStatus, deriveSpreadingCuttingStatus,
  type SpreadingSession, type SpreadingOrder, type MarkerSpreadingStore, type MarkerSpreadingContext,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { findCuttingTableById } from '../../../pages/process-factory/cutting/cutting-table-resource.ts'
import { convertCuttingQuantity } from './cutting-quantity-unit.ts'
import type { SpreadingMaterialReadiness } from './spreading-material-readiness.ts'
import type { CuttingReturnSource } from './cutting-process-material.ts'

export type CentralSpreadingAction = 'start-spreading' | 'save-roll' | 'finish-spreading' | 'start-cutting' | 'finish-cutting'
export interface CentralSpreadingRollInput {
  rollRecordId?: string; sourceIssueEventId: string; planUnitId: string; rollNo: string
  labeledLength: number; actualLength: number; headLength: number; tailLength: number; layerCount: number; actualGarmentQty: number
}
export interface CentralSpreadingInput {
  operationId: string; spreadingOrderId: string; expectedSource: string; factoryId: string; operatorId: string; operatorName: string
  action: CentralSpreadingAction; tableId?: string; roll?: CentralSpreadingRollInput
}
export interface CentralSpreadingSource {
  order: SpreadingOrder; session: SpreadingSession; store: MarkerSpreadingStore; factoryId: string; assignments: unknown
  readiness: SpreadingMaterialReadiness; issues: CuttingReturnSource[]; context: MarkerSpreadingContext | null
}
export const centralSpreadingSourceSnapshot = (source: CentralSpreadingSource) => JSON.stringify({ order: source.order, session: source.session, factoryId: source.factoryId, assignments: source.assignments, issues: source.issues.map(row=>({id:row.issue.eventId,quantity:row.issue.inventoryEffect?.qty,returned:row.returnedQty,consumed:row.consumedQty||0})), availableQty:source.readiness.availableQty })
export function cuttingTableScheduleConflict(draft: Pick<SpreadingSession, 'spreadingSessionId' | 'cuttingTableId' | 'plannedStartAt' | 'plannedEndAt'>, sessions: SpreadingSession[]) {
  if (!draft.cuttingTableId || !draft.plannedStartAt || !draft.plannedEndAt) return false
  const start = new Date(draft.plannedStartAt).getTime(), end = new Date(draft.plannedEndAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false
  return sessions.some(session => session.spreadingSessionId !== draft.spreadingSessionId && session.cuttingTableId === draft.cuttingTableId
    && session.plannedStartAt && session.plannedEndAt && start < new Date(session.plannedEndAt).getTime() && end > new Date(session.plannedStartAt).getTime())
}
function assertRoll(source: CentralSpreadingSource, input: CentralSpreadingRollInput) {
  const unit = source.session.planUnits?.find(unit => unit.planUnitId === input.planUnitId)
  if (!unit || !input.rollNo.trim() || unit.materialSku !== source.order.materialIdentity.materialSku) throw new Error('CUT_rollSource')
  if (![input.labeledLength, input.actualLength, input.headLength, input.tailLength].every(value => Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)
    || input.actualLength <= 0 || input.labeledLength <= 0 || !Number.isSafeInteger(input.layerCount) || input.layerCount <= 0
    || !Number.isSafeInteger(input.actualGarmentQty) || input.actualGarmentQty < 0) throw new Error('CUT_rollQuantity')
  if (computeRemainingLength(input.labeledLength, input.actualLength, input.headLength, input.tailLength, input.layerCount) < 0) throw new Error('CUT_rollLength')
  const issue = source.issues.find(row => row.issue.eventId === input.sourceIssueEventId)
  if (!issue || issue.issue.refs.spreadingOrderId !== source.order.spreadingOrderId || issue.issue.material?.materialSku !== unit.materialSku) throw new Error('CUT_rollSource')
  const original = convertCuttingQuantity(issue.issue.inventoryEffect!.qty, issue.issue.inventoryEffect!.unit, '米')
  const net = convertCuttingQuantity(issue.issue.inventoryEffect!.qty - issue.returnedQty, issue.issue.inventoryEffect!.unit, '米')
  const others = source.session.rolls.filter(roll => roll.rollRecordId !== input.rollRecordId)
  if (others.some(roll => roll.rollNo.trim() === input.rollNo.trim() && roll.planUnitId === input.planUnitId)) throw new Error('CUT_rollDuplicate')
  if (input.rollRecordId && !source.session.rolls.some(roll => roll.rollRecordId === input.rollRecordId)) throw new Error('CUT_changed')
  const assigned = others.filter(roll => roll.sourceIssueEventId === input.sourceIssueEventId)
  if (net === null || original === null || assigned.reduce((sum, roll) => sum + roll.labeledLength, 0) + input.labeledLength > original + .005
    || assigned.reduce((sum, roll) => sum + computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength, roll.layerCount), 0)
      + computeUsableLength(input.actualLength, input.headLength, input.tailLength, input.layerCount) > net + .005) throw new Error('CUT_rollIssueLimit')
  return unit
}

/** Explicit execution actions use the existing metre formulas, completion rules and shared session model. */
export function prepareCentralSpreadingAction(source: CentralSpreadingSource, input: CentralSpreadingInput, now = new Date()) {
  if (!input.operationId.trim() || !input.operatorId.trim() || !input.operatorName.trim() || input.factoryId !== source.factoryId) throw new Error('CUT_actor')
  if (input.spreadingOrderId !== source.order.spreadingOrderId || input.expectedSource !== centralSpreadingSourceSnapshot(source)) throw new Error('CUT_changed')
  if (source.session.voidedAt || source.order.status === 'CANCELED' || source.session.cuttingStatus === 'CUTTING_DONE') throw new Error('CUT_spreadClosed')
  const next = structuredClone(source.session), at = formatIndonesiaBusinessDateTime(now)
  if(next.executionFactoryId&&next.executionFactoryId!==input.factoryId)throw new Error('CUT_actor')
  next.executionFactoryId=input.factoryId
  next.claimedLengthTotal=source.readiness.claimedQty||0;next.configuredLengthTotal=source.readiness.plannedUsageQty||0
  const cuttingAction=input.action==='start-cutting'||input.action==='finish-cutting'
  const previous = cuttingAction?deriveSpreadingCuttingStatus(next.cuttingStatus||'WAITING_CUTTING').label:deriveSpreadingListStatus(next.status).label
  if (input.action === 'start-spreading') {
    if (!['DRAFT','TO_FILL'].includes(next.status)) throw new Error('CUT_spreadState')
    if (!source.readiness.canStartSpreading) throw new Error('CUT_spreadMaterial')
    const table = findCuttingTableById(input.tableId || '')
    if (!table || ['保养中','停用'].includes(table.status)) throw new Error('CUT_table')
    Object.assign(next, { status:'IN_PROGRESS', cuttingTableId:table.cuttingTableId, cuttingTableNo:table.cuttingTableNo, cuttingTableName:table.cuttingTableName,
      ownerAccountId:input.operatorId, ownerName:input.operatorName, actualStartAt:next.actualStartAt || at })
    if (cuttingTableScheduleConflict(next, source.store.sessions)) throw new Error('CUT_tableBusy')
  } else if (input.action === 'save-roll') {
    if (next.status !== 'IN_PROGRESS' || !input.roll) throw new Error('CUT_spreadState')
    const data = input.roll, unit = assertRoll(source, data), old = next.rolls.find(roll => roll.rollRecordId === data.rollRecordId)
    const roll = old || createRollRecordDraft(next.spreadingSessionId, unit.materialSku, unit.planUnitId)
    const oldLayers = old?.layerCount || 0
    Object.assign(roll, { rollRecordId:old?.rollRecordId || `central-roll:${input.operationId}`, planUnitId:unit.planUnitId, rollNo:data.rollNo.trim(),
      materialSku:unit.materialSku, color:unit.color,width:source.order.patternIdentity.effectiveWidthValue||0,sortOrder:old?.sortOrder||next.rolls.length+1, sourceIssueEventId:data.sourceIssueEventId, sourceHighLowRowId:unit.sourceType==='high-low-row'?unit.sourceLineId:'',stepNo:unit.stepNo,stepLabel:unit.stepLabel,
      labeledLength:data.labeledLength,actualLength:data.actualLength,headLength:data.headLength,tailLength:data.tailLength,layerCount:data.layerCount,
      actualCutGarmentQty:data.actualGarmentQty,actualCutPieceQty:data.actualGarmentQty,occurredAt:old?.occurredAt||at,
      remainingLength:computeRemainingLength(data.labeledLength,data.actualLength,data.headLength,data.tailLength,data.layerCount),
      sourceChannel:'PDA_WRITEBACK',sourceWritebackId:`central-spreading-roll:${input.operationId}`,updatedFromPdaAt:at,lastUpdatedById:input.operatorId })
    const operators = next.operators.filter(operator => operator.rollRecordId === roll.rollRecordId), last = operators.at(-1)
    if (!last || last.operatorAccountId === input.operatorId) {
      const operator=last||createOperatorRecordDraft(next.spreadingSessionId)
      Object.assign(operator,{sortOrder:last?.sortOrder||next.operators.length+1,operatorRecordId:last?.operatorRecordId||`central-operator:${input.operationId}`,rollRecordId:roll.rollRecordId,operatorAccountId:input.operatorId,operatorName:input.operatorName,
        startLayer:last?.startLayer||1,endLayer:data.layerCount,startAt:last?.startAt||at,endAt:at,sourceChannel:'PDA_WRITEBACK',sourceWritebackId:`central-spreading-roll:${input.operationId}`,updatedFromPdaAt:at})
      if(!last)next.operators.push(operator)
    } else if(data.layerCount>oldLayers) {
      last.nextOperatorAccountId=input.operatorId;last.nextOperatorName=input.operatorName;last.handoverFlag=true
      next.operators.push({...createOperatorRecordDraft(next.spreadingSessionId),sortOrder:next.operators.length+1,operatorRecordId:`central-operator:${input.operationId}`,rollRecordId:roll.rollRecordId,
        operatorAccountId:input.operatorId,operatorName:input.operatorName,startLayer:oldLayers+1,endLayer:data.layerCount,startAt:at,endAt:at,actionType:'接手继续',
        previousOperatorName:last.operatorName,handoverAtLayer:oldLayers,handoverFlag:true,sourceChannel:'PDA_WRITEBACK',sourceWritebackId:`central-spreading-roll:${input.operationId}`,updatedFromPdaAt:at})
    }
    if(next.operators.some(operator=>operator.rollRecordId===roll.rollRecordId&&(operator.endLayer||0)>data.layerCount))throw new Error('CUT_rollHandover')
    roll.operatorLayerRows=next.operators.filter(operator=>operator.rollRecordId===roll.rollRecordId).map(operator=>({rowId:operator.operatorRecordId,startLayer:operator.startLayer,endLayer:operator.endLayer,operatorName:operator.operatorName}))
    roll.operatorLayerText='';roll.operatorNames=roll.operatorLayerRows.map(row=>row.operatorName)
    next.rolls=[...next.rolls.filter(row=>row.rollRecordId!==roll.rollRecordId),roll]
    const totals=summarizeSpreadingRolls(next.rolls);next.actualCutPieceQty=totals.totalActualCutGarmentQty;next.actualCutGarmentQty=totals.totalActualCutGarmentQty
  } else if (input.action === 'finish-spreading') {
    if(next.status!=='IN_PROGRESS')throw new Error('CUT_spreadState')
    const perLayer=deriveSpreadingSessionGarmentQtyPerLayer(next,source.store.markers.find(marker=>marker.markerId===next.markerId)||null)
    if(!validateSpreadingCompletion({session:next,markerTotalPieces:perLayer,selectedCutOrderIds:source.order.sourceCutOrderIds}).allowed)throw new Error('CUT_rollRequired')
    Object.assign(next,finalizeSpreadingCompletion({session:next,context:source.context,linkedCutOrderIds:source.order.sourceCutOrderIds,linkedCutOrderNos:source.order.sourceCutOrderNos,
      productionOrderNos:source.order.productionOrderNos,markerTotalPieces:perLayer,completedBy:input.operatorName,now}),{completedAt:at,actualEndAt:at,cuttingStatusUpdatedAt:at,completedBy:input.operatorName,completedByUserId:input.operatorId})
    if(next.completionLinkage)next.completionLinkage.completedAt=at
    if(next.varianceWarning)next.varianceWarning.createdAt=at
  } else if(input.action==='start-cutting') {
    if(next.status!=='DONE'||next.cuttingStatus!=='WAITING_CUTTING')throw new Error('CUT_spreadState')
    Object.assign(next,{cuttingStatus:'CUTTING',cuttingStatusUpdatedAt:at,cuttingStartedAt:at,cuttingStartedById:input.operatorId})
  } else if(input.action==='finish-cutting') {
    if(next.status!=='DONE'||next.cuttingStatus!=='CUTTING')throw new Error('CUT_spreadState')
    Object.assign(next,{cuttingStatus:'CUTTING_DONE',cuttingStatusUpdatedAt:at,cuttingFinishedAt:at,cuttingFinishedById:input.operatorId})
  } else throw new Error('CUT_spreadState')
  const labels:Record<CentralSpreadingAction,string>={'start-spreading':'开始铺布','save-roll':'登记卷','finish-spreading':'完成铺布','start-cutting':'开始裁剪','finish-cutting':'完成裁剪'}
  next.operationLogs=normalizeSpreadingOperationLogs([...(next.operationLogs||[]),createSpreadingOperationLog({logId:`central-spreading:${input.operationId}`,occurredAt:at,
    operatorId:input.operatorId,operatorName:input.operatorName,statusType:input.action.includes('cutting')?'裁剪状态':'铺布状态',actionLabel:labels[input.action],fromStatusLabel:previous,toStatusLabel:cuttingAction?deriveSpreadingCuttingStatus(next.cuttingStatus||'WAITING_CUTTING').label:deriveSpreadingListStatus(next.status).label})])
  next.sourceChannel='PDA_WRITEBACK';next.sourceWritebackId=`central-spreading:${input.operationId}`;next.updatedFromPdaAt=at;next.updatedBy=input.operatorName
  const store=upsertSpreadingSession(next,source.store,now),session=store.sessions.find(session=>session.spreadingSessionId===next.spreadingSessionId)!
  session.updatedAt=at
  return{session,store,actionLabel:labels[input.action]}
}
