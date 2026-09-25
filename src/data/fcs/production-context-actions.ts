import {captureProcessTaskStore,restoreProcessTaskStore} from './process-tasks.ts'
import type {CuttingRecordChange, CuttingRecordSnapshot} from './cutting/cutting-record-repository.ts'
import {captureSewingResponsibilityState,restoreSewingResponsibilityState} from './sewing-outsourcing-responsibility.ts'
import {captureMergedTaskSpecialCraftInvalidations,restoreMergedTaskSpecialCraftInvalidations} from './special-craft-task-orders.ts'
import {cuttingRecordUuid} from './cutting/cutting-record-identity.ts'
import { saveProductionContextAction, productionContextStorage, PRODUCTION_CONTEXT_KEYS, onProductionContextChanged, isProductionContextReady } from './production-context-records.ts'
import { captureRuntimeDirectDispatchState, restoreRuntimeDirectDispatchState } from './runtime-process-tasks.ts'
import { captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState } from './effective-task-assignments.ts'
import { captureProductionOrderPersistenceState, restoreProductionOrderPersistenceState } from './production-orders.ts'
import { captureSewingDeliverySlaSnapshotStore, restoreSewingDeliverySlaSnapshotStore } from './sewing-delivery-sla.ts'
import { captureSewingSampleState, restoreSewingSampleState } from './sewing-sample-approval-suggestion.ts'
import { captureSewingMaterialState, restoreSewingMaterialState } from './sewing-material-handover.ts'
import { captureProductionReturnState, restoreProductionReturnState } from './production-return-fulfillment.ts'
import { captureProductionContractState, restoreProductionContractState } from './production-contracts.ts'
import { captureRuntimeTaskTenderRecordStore, restoreRuntimeTaskTenderRecordStore } from './runtime-task-tenders.ts'

type Entry = [string, unknown]
function captureEffects(): Entry[] {
  const sla=captureSewingDeliverySlaSnapshotStore(), material=captureSewingMaterialState(), returns=captureProductionReturnState()
  const entries=(prefix:string, rows: Entry[]):Entry[]=>rows.map(([id,value])=>[`${prefix}:${id}`,value])
  return [
    ...entries('sla-snapshot',sla.snapshots),...entries('sla-current',sla.currentSnapshotIds),...entries('sla-review',sla.responsibilityReviews.map(value=>[value.reviewId,value])),
    ...entries('material-context',material.contexts),...entries('material-event',material.events),...entries('material-command',material.commands),['material-sequence:value',material.sequence],
    ...entries('return-snapshot',returns.snapshots),...entries('return-reminder',returns.reminders),...entries('return-receipt',returns.receipts),['return-sequence:value',returns.sequence],
    ...entries('process-task',captureProcessTaskStore().map(value=>[value.taskId,value])),
    ...entries('special-invalidation',captureMergedTaskSpecialCraftInvalidations().map((value,index)=>[String(index),value])),
    ...entries('tender',captureRuntimeTaskTenderRecordStore().map(value=>[value.tenderId,value])),
  ]
}
function restoreEffects(entries: Entry[]): void {
  const rows=<T>(prefix:string): Array<[string,T]>=>entries.filter(([id])=>id.startsWith(prefix+':')).map(([id,value])=>[id.slice(prefix.length+1),structuredClone(value) as T])
  const seq=(prefix:string)=>rows<number>(prefix)[0]?.[1] || 0
  restoreSewingDeliverySlaSnapshotStore({snapshots:rows('sla-snapshot'),currentSnapshotIds:rows('sla-current'),responsibilityReviews:rows<ReturnType<typeof captureSewingDeliverySlaSnapshotStore>['responsibilityReviews'][number]>('sla-review').map(([,value])=>value)})
  restoreSewingMaterialState({contexts:rows('material-context'),events:rows('material-event'),commands:rows('material-command'),sequence:seq('material-sequence')})
  restoreProductionReturnState({snapshots:rows('return-snapshot'),reminders:rows('return-reminder'),receipts:rows('return-receipt'),sequence:seq('return-sequence')})
  restoreProcessTaskStore(rows<ReturnType<typeof captureProcessTaskStore>[number]>('process-task').map(([,value])=>value))
  restoreMergedTaskSpecialCraftInvalidations(rows<ReturnType<typeof captureMergedTaskSpecialCraftInvalidations>[number]>('special-invalidation').sort(([a],[b])=>Number(a)-Number(b)).map(([,value])=>value))
  restoreRuntimeTaskTenderRecordStore(rows<ReturnType<typeof captureRuntimeTaskTenderRecordStore>[number]>('tender').map(([,value])=>value))
}
const baseEffects=new Map<string, unknown>()
const knownEffectBases=new Set<string>()
let appliedEffects=new Set<string>()
/** 只覆盖真正保存的分配产物；保留静态演示默认值，不在首次访问写入种子。 */
export function hydrateProductionSourceEffects(): void {
  if (!isProductionContextReady()) return
  const live=new Map(captureEffects())
  for (const id of appliedEffects) { if(baseEffects.has(id)) live.set(id,baseEffects.get(id)); else live.delete(id) }
  const raw=productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.effects)
  const overlay:Entry[]=raw ? JSON.parse(raw).entries : []
  for(const [id,value] of overlay) {
    if (!knownEffectBases.has(id)) {if(live.has(id))baseEffects.set(id,structuredClone(live.get(id)));knownEffectBases.add(id)}
    if(value && typeof value==='object' && '__deletedAssignmentEffect' in value) live.delete(id)
    else live.set(id,value)
  }
  appliedEffects=new Set(overlay.map(([id])=>id)); restoreEffects([...live])
}
function persistChangedEffects(before:Entry[], after:Entry[]):void {
  const previous=new Map(before),next=new Map(after)
  const raw=productionContextStorage.getItem(PRODUCTION_CONTEXT_KEYS.effects)
  const overlay=new Map<string,unknown>(raw ? JSON.parse(raw).entries : [])
  let changed=false
  for(const id of new Set([...previous.keys(),...next.keys()])) if(JSON.stringify(previous.get(id))!==JSON.stringify(next.get(id))) {
    if(!knownEffectBases.has(id)){if(previous.has(id))baseEffects.set(id,structuredClone(previous.get(id)));knownEffectBases.add(id)}
    overlay.set(id,next.has(id)?next.get(id):{__deletedAssignmentEffect:true}); changed=true
  }
  if(changed) productionContextStorage.setItem(PRODUCTION_CONTEXT_KEYS.effects,JSON.stringify({version:1,entries:[...overlay]}))
}
function capture() {
  return { runtime:captureRuntimeDirectDispatchState(), assignments:captureEffectiveTaskAssignmentState(),orders:captureProductionOrderPersistenceState(),
    responsibility:captureSewingResponsibilityState(),effects:captureEffects(),samples:captureSewingSampleState(),contracts:captureProductionContractState() }
}
function restore(value:unknown):void {
  const state=value as ReturnType<typeof capture>
  restoreRuntimeDirectDispatchState(state.runtime,false);restoreEffectiveTaskAssignmentState(state.assignments);restoreProductionOrderPersistenceState(state.orders)
  restoreSewingResponsibilityState(state.responsibility);restoreEffects(state.effects);restoreSewingSampleState(state.samples);restoreProductionContractState(state.contracts)
}
/** 页面必须等待 complete，再关闭确认框或显示成功；同步副作用在等待期间恢复旧值。 */
export async function saveProductionSourceAction<T>(input:{id:string;intent:string;action:()=>T;events?:boolean;
 captureAdditional?:()=>unknown;restoreAdditional?:(value:unknown)=>void;
 prepareChange?:(result:T)=>CuttingRecordChange;assertAdditionalSourcesCurrent?:()=>void}):Promise<T> {
  const captureAll=()=>({source:capture(),additional:input.captureAdditional?.()})
  const restoreAll=(value:unknown)=>{const state=value as ReturnType<typeof captureAll>;restore(state.source);input.restoreAdditional?.(state.additional)}
  const eventRepo=await import('./cutting/cutting-event-repository.ts')
  const part=await import('./cutting/part-ticket-records.ts')
  const prepareSnapshot=async(snapshot:CuttingRecordSnapshot)=>{
    await part.hydratePartTicketRecords(snapshot)
    eventRepo.prepareManagedScope(snapshot.records)
  }
  const prepareChange=(result:T):CuttingRecordChange=>{
    const extra=input.prepareChange?.(result) || {puts:[]}
    const puts=[...extra.puts,...part.partTicketInitializationRecords(),...eventRepo.cuttingEventScopeInitializationRecords()]
    return {...extra,puts:[...new Map(puts.map(record=>[record.id,record])).values()]}
  }
  const assertAdditionalSourcesCurrent=()=>{part.assertPartTicketLegacyUnchanged();eventRepo.assertManagedScopeCurrent();input.assertAdditionalSourcesCurrent?.()}
  if(!input.events) return saveProductionContextAction({...input,prepareSnapshot,prepareChange,assertAdditionalSourcesCurrent,capture:captureAll,restore:restoreAll,action:()=>{
    const before=captureEffects();const result=input.action();persistChangedEffects(before,captureEffects());return result
  }})
  const ledger=await import('./cutting/cutting-runtime-event-ledger.ts')
  const {withBrowserBusinessStorage,getBrowserLocalStorage}=await import('../browser-storage.ts')
  await eventRepo.hydrateCuttingEventRecords()
  let raw=JSON.stringify({events:ledger.listManagedCuttingRuntimeEvents()})
  let before=ledger.deserializeCuttingRuntimeEventLedgerStorage(raw).events
  const native=getBrowserLocalStorage()
  const storage={getItem:(key:string)=>key===ledger.CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY?raw:native?.getItem(key) ?? null,
    setItem:(key:string,value:string)=>{if(key!==ledger.CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)throw new Error(`本次动作包含未登记保存 ${key}`);raw=value},removeItem:()=>{throw new Error('本次动作不能清除业务记录')}}
  const result=await saveProductionContextAction({...input,prepareSnapshot:async(snapshot)=>{
      await prepareSnapshot(snapshot)
      const persistedIds=new Set(eventRepo.committedCuttingEvents().map(event=>event.eventId))
      const events=[...ledger.listManagedCuttingRuntimeEvents().filter(event=>!persistedIds.has(event.eventId)),...snapshot.records.filter(record=>record.collection==='cutting-events').map(record=>record.value)]
      raw=JSON.stringify({events});before=ledger.deserializeCuttingRuntimeEventLedgerStorage(raw).events
    },capture:captureAll,restore:restoreAll,
    action:()=>{const previous=captureEffects();const result=withBrowserBusinessStorage(storage,input.action);persistChangedEffects(previous,captureEffects());return result},
    prepareChange:(result)=>{
      const after=ledger.deserializeCuttingRuntimeEventLedgerStorage(raw).events
      const previous=new Map(before.map(event=>[event.eventId,JSON.stringify(event)]))
      const extra=prepareChange(result)
      return {...extra,puts:[...extra.puts,...after.filter(event=>previous.get(event.eventId)!==JSON.stringify(event)).map(event=>({id:`cutting-event:${event.eventId}`,collection:'cutting-events',value:event}))]}
    },assertAdditionalSourcesCurrent})
  await eventRepo.hydrateCuttingEventRecords();return result
}

onProductionContextChanged(PRODUCTION_CONTEXT_KEYS.effects,hydrateProductionSourceEffects)
const pendingUiCommands=new Map<string,string>()
/** 相同未保存输入重试复用命令；成功后下一次明确操作产生新命令。 */
export async function saveProductionSourceUiAction<T>(intent:string,action:()=>T,events=false):Promise<T>{
  const id=pendingUiCommands.get(intent) || `PRODUCTION-UI:${cuttingRecordUuid()}`
  pendingUiCommands.set(intent,id)
  const result=await saveProductionSourceAction({id,intent,action,events})
  pendingUiCommands.delete(intent);return result
}
