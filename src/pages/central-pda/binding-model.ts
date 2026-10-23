import { buildBindingProcessOrders, getBindingProcessOrderById, getBindingDetailAvailableProcessQty, type BindingProcessActionCode } from '../process-factory/cutting/binding-strip-orders.ts'
import type { BindingProcessOrder } from '../process-factory/cutting/binding-strip-order-types.ts'
import { hydrateBindingProcessRecords, runBindingProcessRecordCommand } from '../../data/fcs/binding-process-records.ts'
import { getHandoverRecordsByWorkOrderId, getWarehouseRecordsByWorkOrderId } from '../../data/fcs/process-warehouse-domain.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
export { hydrateBindingProcessRecords }
export type BindingAction = 'receive' | 'work' | 'handoff' | 'finish'
export function bindingOrders(factoryId: string) { return buildBindingProcessOrders().filter(o => o.factoryId === factoryId && isCentralPdaFactory(getFactoryMasterRecordById(o.factoryId)!)) }
export function bindingFactory(preferred: string) { return isCentralPdaFactory(getFactoryMasterRecordById(preferred)) ? preferred : buildBindingProcessOrders().find(o => {const f=getFactoryMasterRecordById(o.factoryId);return f&&isCentralPdaFactory(f)})?.factoryId || '' }
export function bindingOrder(id: string, factoryId: string) { return bindingOrders(factoryId).find(o=>o.bindingOrderId===id) }
export function bindingRemaining(o: BindingProcessOrder, action: BindingAction, detailId='') { const d=o.bindingDetails.find(d=>d.detailId===detailId);return Math.round(Math.max(action==='receive' ? d ? d.requiredLength-d.receivedMaterialLength : 0 : action==='work' ? d ? getBindingDetailAvailableProcessQty(d) : 0 : action==='handoff' ? o.actualOutputQty-(o.handedOverQty||0):0,0)*100)/100 }
export function bindingActions(o: BindingProcessOrder): BindingAction[] { const actions:BindingAction[]=[];if(o.status==='待加工'||o.status==='加工中'){if(o.bindingDetails.some(d=>bindingRemaining(o,'receive',d.detailId)>0))actions.push('receive')};if(o.status==='加工中'){if(o.bindingDetails.some(d=>bindingRemaining(o,'work',d.detailId)>0))actions.push('work');if(o.actualOutputQty>0)actions.push('finish')};if((o.status==='加工中'||o.status==='已完成')&&bindingRemaining(o,'handoff')>0)actions.push('handoff');return actions }
export function bindingScanKey(code:string){return code.trim().replace(/^FCS:WORK_ORDER:v1:/i,'').toLowerCase()}
export function bindingScan(code:string,factoryId:string){const key=bindingScanKey(code);return key?bindingOrders(factoryId).filter(o=>[o.bindingOrderId,o.bindingOrderNo,o.sourceTaskId,o.sourceTaskNo,o.sourceProductionOrderId,o.sourceProductionOrderNo,...o.sourceFeiTicketIds,o.materialIdentity.materialSku,...o.sourceFeiTicketNos,...o.bindingDetails.flatMap(d=>[d.detailId,d.bindingStripNo,d.feiTicketNo])].some(v=>v?.toLowerCase()===key)):[]}
export function bindingHistory(id:string){return getHandoverRecordsByWorkOrderId(id)}
export function bindingStock(id:string){return getWarehouseRecordsByWorkOrderId(id)}
export type BindingDraft={raw:string;remark:string;revision:string;operationId:string;committed?:boolean;error?:unknown}
export async function saveBindingAction(id:string,action:BindingAction,detailId:string,draft:BindingDraft,qty:number|undefined,actor:FactoryPdaUser){
 const o=getBindingProcessOrderById(id);if(!o||o.factoryId!==actor.factoryId)throw Error('CHANGED')
 const actions:Record<BindingAction,BindingProcessActionCode>={receive:'BINDING_CONFIRM_RECEIVE',work:'BINDING_PROCESS_REPORT',handoff:'BINDING_SUBMIT_HANDOVER',finish:'BINDING_COMPLETE_ORDER'}
 return runBindingProcessRecordCommand({bindingOrderId:id,actionCode:actions[action],detailId:action==='receive'||action==='work'?detailId:undefined,qty,remark:draft.remark,confirmationKey:draft.operationId,operatorName:actor.name,operatedAt:new Date().toLocaleString('sv-SE').replace('T',' ')},actor,draft.revision)
}
