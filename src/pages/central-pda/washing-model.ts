import { washingCanExecute, washingExecutionRolls, type WashingExecutionAction, type WashingOrder, type WashingCommand, type WashingActor } from '../../data/fcs/fabric-washing-model.ts'
import { readWashingState, ensureWashingRecords } from '../../data/fcs/fabric-washing-repository.ts'
import { submitWashingCommand, getWashingSources, listWashingFactories } from '../../data/fcs/fabric-washing.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { getFactoryReceiptLocations } from '../../data/fcs/factory-receiving.ts'
import { ensureSpecialCraftRecords } from '../../data/fcs/special-craft-records.ts'
import { refreshPcsRecordStateAfterExternalChange } from '../../data/pcs-record-runtime.ts'
import { dyeNumber } from './dye-ui.ts'
import type { CentralPdaLanguage } from './frame.ts'

export type CentralWashingAction = Exclude<WashingExecutionAction,'send'>
export type CentralWashingCommand = Extract<WashingCommand,{type:'RECEIVE'|'START'|'OUTPUT'|'HANDOUT'|'DOWNSTREAM_RECEIVE'|'COMPLETE'|'PRINT'}>
export interface CentralWashingDraft {
 selected:string[]; quantities:Record<string,string>; newCodes:Record<string,string>; scans:string[]; scan:string
 position:string; revision:string; operationId:string
}
const related=(o:WashingOrder,factoryId:string)=>[o.assignedFactoryId,o.source.factoryId,o.source.target?.factoryId].includes(factoryId)
export async function prepareCentralWashing(){
 await refreshPcsRecordStateAfterExternalChange()
 await ensureSpecialCraftRecords(true)
 await ensureWashingRecords(true)
}
export function centralWashingOrders(factoryId:string){
 const factory=getFactoryMasterRecordById(factoryId)
 if(!factory||factory.status!=='active'||!isCentralPdaFactory(factory))return []
 return readWashingState().orders.filter(o=>related(o,factoryId))
}
export function centralWashingOrder(id:string,factoryId:string){return centralWashingOrders(factoryId).find(o=>o.id===id)}
export function centralWashingFactories(){
 const ids=new Set([...listWashingFactories().map(f=>f.id),...readWashingState().orders.flatMap(o=>[o.assignedFactoryId,o.source.target?.factoryId,o.source.factoryId].filter((id):id is string=>!!id))])
 return listFactoryMasterRecords().filter(f=>f.status==='active'&&isCentralPdaFactory(f)&&ids.has(f.id))
}
export const centralWashingPositions=getFactoryReceiptLocations
export function centralWashingRevision(order:WashingOrder){
 // Native PRINT changes only these markers, without advancing the physical revision.
 const {printedRevision:_printedRevision,printedContentSignature:_printedSignature,...physical}=order
 return withWashingStaticRead(()=>JSON.stringify([physical,getWashingSources(order.source.printOrderId).find(source=>source.id===order.source.id)?.revision]))
}
export function centralWashingRolls(order:WashingOrder,action:CentralWashingAction,factoryId:string){
 if(action==='downstream-receive' ? order.source.target?.factoryId!==factoryId||!!order.source.target.warehouseId : order.assignedFactoryId!==factoryId)return []
 return washingExecutionRolls(order,action)
}
export function centralWashingCanComplete(order:WashingOrder,factoryId:string){
 return order.assignedFactoryId===factoryId&&washingCanExecute(order)&&!order.cancelledAt&&!order.completedAt&&!order.exception
  &&order.rolls.length>0&&order.rolls.every(r=>!!r.completedAt&&!!r.downstreamReceivedAt)
}
export function assertCentralWashingActor(actor:FactoryPdaUser):void {
 const factory=getFactoryMasterRecordById(actor.factoryId),user=readFactoryPdaExecutionUsers(actor.factoryId).find(u=>u.userId===actor.userId)
 if(!factory||factory.status!=='active'||!isCentralPdaFactory(factory)||!user||user.status!=='ACTIVE'||user.name!==actor.name)throw new Error('CW_actor')
}
export function washingExpectedQuantity(order:WashingOrder,action:CentralWashingAction,id:string){const roll=order.rolls.find(r=>r.id===id);return roll&&(action==='receive'?roll.inputQty:action==='output'||action==='start'?roll.receivedQty:roll.outputQty)}
export function centralWashingQuantityChanges(order:WashingOrder,action:CentralWashingAction,draft:CentralWashingDraft,lang:CentralPdaLanguage){
 if(!['receive','output','downstream-receive'].includes(action))return []
 return draft.selected.flatMap(id=>{const qty=dyeNumber(draft.quantities[id]||'',lang,null),expected=washingExpectedQuantity(order,action,id);return qty!==expected?[{id,qty,expected,unit:order.rolls.find(r=>r.id===id)?.unit||''}]:[]})
}
export function centralWashingInput(order:WashingOrder,action:CentralWashingAction,draft:CentralWashingDraft,factoryId:string,lang:CentralPdaLanguage,confirmed=false):CentralWashingCommand {
 const allowed=centralWashingRolls(order,action,factoryId),ids=[...draft.selected]
 if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!allowed.some(r=>r.id===id)))throw new Error('CW_select')
 const rolls=ids.map(id=>allowed.find(r=>r.id===id)!)
 if(action==='start')return{type:'START',orderId:order.id,rollIds:ids}
 if(action==='handout'){
  if(!order.source.target)throw new Error('CW_target')
  if(draft.scans.length!==rolls.length||new Set(draft.scans).size!==rolls.length||rolls.some(r=>!draft.scans.includes(r.outputBarcode||r.barcode)))throw new Error('CW_scanFirst')
  return{type:'HANDOUT',orderId:order.id,rollIds:ids,scannedCodes:[...draft.scans],target:order.source.target}
 }
 const lines=rolls.map(r=>({rollId:r.id,qty:dyeNumber(draft.quantities[r.id]||'',lang,null),barcode:action==='output'?(draft.newCodes[r.id]?.trim()||r.barcode):r.barcode}))
 if(action!=='output'&&lines.some((l,i)=>l.qty>(action==='receive'?rolls[i].inputQty:rolls[i].outputQty!)))throw new Error('CW_overReceipt')
 const changed=centralWashingQuantityChanges(order,action,draft,lang).length>0
 if(changed&&!confirmed)throw new Error('CW_confirmAmounts')
 if(action==='output')return{type:'OUTPUT',orderId:order.id,lines,differenceConfirmed:changed&&confirmed}
 const [warehouseId,locationId]=draft.position.split('|')
 if(!warehouseId||!locationId||!centralWashingPositions(factoryId).some(p=>p.warehouse.warehouseId===warehouseId&&p.location.locationId===locationId))throw new Error('CW_position')
 return{type:action==='receive'?'RECEIVE':'DOWNSTREAM_RECEIVE',orderId:order.id,lines,warehouseId,locationId,differenceConfirmed:changed&&confirmed}
}
export function scanCentralWashingRoll(order:WashingOrder,action:CentralWashingAction,draft:CentralWashingDraft,factoryId:string,raw:string){
 const code=raw.trim(),roll=centralWashingRolls(order,action,factoryId).find(r=>(action==='handout'||action==='downstream-receive'?r.outputBarcode||r.barcode:r.barcode)===code)
 if(!roll)throw new Error('CW_scan')
 if(draft.selected.includes(roll.id))throw new Error('CW_duplicate')
 draft.selected.push(roll.id);if(action==='handout')draft.scans.push(code);draft.scan=''
}
export function findCentralWashingOrders(factoryId:string,raw:string){
 const value=raw.trim()
 return centralWashingOrders(factoryId).filter(o=>[o.id,o.no,o.source.printOrderNo,o.source.sourceNo,o.source.batchId].includes(value)||o.rolls.some(r=>r.barcode===value||r.outputBarcode===value))
}
export async function saveCentralWashing(command:CentralWashingCommand,actor:FactoryPdaUser,operationId:string,revision:string){
 assertCentralWashingActor(actor)
 await prepareCentralWashing()
 const order=centralWashingOrder(command.orderId,actor.factoryId)
 if(!order)throw new Error('CW_changed')
 const receiver=command.type==='DOWNSTREAM_RECEIVE'
 if(receiver?(order.source.target?.factoryId!==actor.factoryId||!!order.source.target.warehouseId):order.assignedFactoryId!==actor.factoryId)throw new Error('CW_actor')
 const nativeActor:WashingActor={id:actor.userId,name:actor.name,factoryId:actor.factoryId,role:receiver?'接收人员':'染厂人员'}
 return submitWashingCommand(command,nativeActor,operationId,()=>{
  assertCentralWashingActor(actor)
  const current=centralWashingOrder(command.orderId,actor.factoryId)
  if(!current||!revision||centralWashingRevision(current)!==revision)throw new Error('CW_changed')
 })
}
