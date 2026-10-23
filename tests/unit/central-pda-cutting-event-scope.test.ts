import test from 'node:test'
import assert from 'node:assert/strict'
import { withBrowserBusinessStorage } from '../../src/data/browser-storage.ts'
import { prepareManagedScope, cuttingEventScopeInitializationRecords, assertManagedScopeCurrent } from '../../src/data/fcs/cutting/cutting-event-repository.ts'
import { CUTTING_EVENT_SCOPE_RECORD, isManagedCuttingEvent } from '../../src/data/fcs/cutting/cutting-event-scope.ts'
import type { CuttingRuntimeEvent } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

const oldScope = { id: 'cutting-event-scope:post-cutting-v2', collection: 'cutting-event-scopes', value: { phase: 'COMPLETE', version: 2 } }
const currentScope = () => ({ id: CUTTING_EVENT_SCOPE_RECORD, collection: 'cutting-event-scopes', value: { phase: 'COMPLETE', version: 3 } })
function event(type = '中转仓接收', physical = true): CuttingRuntimeEvent {
  return { eventId:'old-receipt', eventNo:'OLD-001',eventType:type,eventSource:'WEB',eventStatus:'已同步',occurredAt:'2026-10-01 08:00',createdAt:'2026-10-01 08:00',operatorId:'original-user',operatorName:'Original employee',operatorRole:'仓管',refs:{cutOrderId:'original-cut'},payload:{},...(physical?{inventoryEffect:{inventoryScope:'裁床待加工仓',direction:'IN',qty:12.5,unit:'Yard'}}:{}) } as CuttingRuntimeEvent
}
function storage(events: CuttingRuntimeEvent[] = []) {
  let raw = JSON.stringify({events}); const writes:string[]=[]
  return { getItem:(key:string)=>key==='cuttingRuntimeEventLedger'?raw:null,
    setItem:(key:string,_value:string)=>{writes.push(key)},removeItem:(key:string)=>{writes.push(key)},
    replace:(value:string)=>{raw=value},writes }
}

test('C01.04a: old v2 completion cannot silently adopt wait-process physical stock that remains in the shared old ledger',()=>{
 const s=storage([event()]);assert.throws(()=>withBrowserBusinessStorage(s,()=>prepareManagedScope([oldScope])),/迁移/);assert.deepEqual(s.writes,[])
})
test('C01.04a: missing wait-process records permit a new v3 marker to be staged, without ordinary-read writes',()=>{
 const s=storage();withBrowserBusinessStorage(s,()=>prepareManagedScope([oldScope]));const row=cuttingEventScopeInitializationRecords().find(row=>row.collection==='cutting-event-scopes')!
 assert.equal((row.value as {version:number}).version,3);assert.notEqual(row.id,oldScope.id);assert.deepEqual(s.writes,[])
})
test('C01.04a: completed v3 still rejects newly reintroduced old physical facts and malformed old data',()=>{
 const s=storage();withBrowserBusinessStorage(s,()=>prepareManagedScope([currentScope()]));s.replace(JSON.stringify({events:[event()]}));assert.throws(()=>withBrowserBusinessStorage(s,assertManagedScopeCurrent),/旧|迁移/)
 s.replace('{broken');assert.throws(()=>withBrowserBusinessStorage(s,()=>prepareManagedScope([currentScope()])),/格式|核对/);assert.deepEqual(s.writes,[])
})
test('C01.04a: all five physical wait-process actions are managed while unrelated preparation stays outside',()=>{
 for(const type of ['中转仓接收','待加工仓扫码入仓','待加工仓加工接收','待加工仓回收入仓','待加工仓位置调整'])assert.equal(isManagedCuttingEvent(event(type,false)),true,type)
 assert.equal(isManagedCuttingEvent(event('配料完成通知',false)),false)
})
