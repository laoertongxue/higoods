import type { CuttingStoredRecord } from './cutting-record-repository.ts'
import type { CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import type { SpreadingSession } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { computeUsableLength } from './spreading-length.ts'
import { convertCuttingQuantity } from './cutting-quantity-unit.ts'

/** Restore/read guards for new Central roll facts; historical unlinked records retain their old identity. */
export function validateCentralSpreadingMaterialRecords(records: CuttingStoredRecord[]) {
 const sessions=records.filter(row=>row.collection==='part-ticket:spreading-sessions').map(row=>row.value as SpreadingSession)
 const events=records.filter(row=>row.collection==='cutting-events').map(row=>row.value as CuttingRuntimeEvent),byId=new Map(events.map(event=>[event.eventId,event]))
 const used=new Map<string,number>()
 function fail():never{throw new Error('铺布卷的原领用、床次、单位或责任资料不完整，原资料未被覆盖。')}
 for(const session of sessions)for(const roll of session.rolls||[]){
  if(!roll.sourceWritebackId?.startsWith('central-spreading-roll:'))continue
  const source=byId.get(roll.sourceIssueEventId||''),unit=session.planUnits?.find(unit=>unit.planUnitId===roll.planUnitId)
  const locations=(source?.payload as {warehouseLocations?:Array<{factoryId:string;warehouseKind:string}>}|undefined)?.warehouseLocations
  if(!source||source.eventType!=='待加工仓加工接收'||source.eventStatus==='已取消'||source.refs.spreadingOrderId!==session.spreadingSessionId
   ||source.material?.materialSku!==roll.materialSku||!unit||unit.materialSku!==roll.materialSku||!roll.rollNo?.trim()||!roll.occurredAt||!roll.lastUpdatedById
   ||!session.executionFactoryId||!locations?.length||!locations.every(ref=>ref.factoryId===session.executionFactoryId&&ref.warehouseKind==='WAIT_PROCESS')
   ||!session.operationLogs?.some(log=>log.logId===roll.sourceWritebackId.replace('central-spreading-roll:','central-spreading:')&&log.operatorId===roll.lastUpdatedById)
   ||!Number.isSafeInteger(roll.layerCount)||roll.layerCount<=0||!Number.isSafeInteger(roll.actualCutGarmentQty)||Number(roll.actualCutGarmentQty)<0
   ||![roll.labeledLength,roll.actualLength,roll.headLength,roll.tailLength].every(value=>Number.isFinite(value)&&value>=0)||roll.actualLength<=0||roll.labeledLength<=0)fail()
  const metres=computeUsableLength(roll.actualLength,roll.headLength,roll.tailLength,roll.layerCount)
  if(metres>roll.labeledLength+.005||!source.inventoryEffect||source.inventoryEffect.direction!=='OUT'||convertCuttingQuantity(metres,'米',source.inventoryEffect.unit)===null)fail()
  used.set(source.eventId,(used.get(source.eventId)||0)+metres)
 }
 for(const [id,metres] of used){const source=byId.get(id)!,effect=source.inventoryEffect!,quantity=convertCuttingQuantity(metres,'米',effect.unit)!
  const returned=events.filter(event=>event.eventType==='待加工仓回收入仓'&&event.eventStatus!=='已取消'&&(event.payload as {sourceIssueEventId?:string}).sourceIssueEventId===id)
  if(returned.some(event=>event.inventoryEffect?.unit!==effect.unit)||Number(quantity.toFixed(2))+returned.reduce((sum,event)=>sum+(event.inventoryEffect?.qty||0),0)>effect.qty+1e-7)fail()
 }
}
