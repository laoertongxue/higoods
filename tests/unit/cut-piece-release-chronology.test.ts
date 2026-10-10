import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareCuttingRuntimeChronologyAscending as compare, createCuttingRuntimeChronologyComparator }  from '../../src/data/fcs/cutting/cutting-runtime-chronology.ts'
import { deriveTransferBagLifecycle, type TransferBagLifecycleFact } from '../../src/data/fcs/cutting/transfer-bag-lifecycle.ts'
test('ISO与旧本地文本按实际时刻排序，不按空格与T字典排序',()=>{
 const local='2026-10-09 16:53:00',earlier=new Date(2026,9,9,16,52,50).toISOString()
 assert(compare({occurredAt:local},{occurredAt:earlier})>0)
 assert(compare({occurredAt:'2026-10-09T08:54:00Z'},{occurredAt:'2026-10-09T16:53:00+08:00'})>0)
 assert(compare({occurredAt:earlier},{occurredAt:local})<0)
})
test('同一时刻不同时间表达仍按账本序号和稳定ID防重复',()=>{
 const a={occurredAt:'2026-10-09T08:54:00Z',ledgerSequence:2,eventId:'A'}
 const b={occurredAt:'2026-10-09T16:54:00+08:00',ledgerSequence:3,eventId:'B'}
 assert(compare(a,b)<0);assert(compare(b,a)>0);assert.equal(compare(a,a),0)
 assert(compare({...a,ledgerSequence:undefined},{...a,ledgerSequence:undefined,eventId:'B'})<0)
})


test('整组同分钟含低精度记录时，唯一可靠顺序形成稳定全序，不按成对条件切换',()=>{
 const rows=[
  {occurredAt:'2026-10-09T08:54:50Z',ledgerSequence:1,eventId:'A'},
  {occurredAt:'2026-10-09T16:54+08:00',ledgerSequence:2,eventId:'B'},
  {occurredAt:'2026-10-09T08:54:10Z',ledgerSequence:3,eventId:'C'},
 ]
 const order=createCuttingRuntimeChronologyComparator(rows)
 for(const permutation of [rows,[rows[2],rows[0],rows[1]],[rows[1],rows[2],rows[0]]])assert.deepEqual(permutation.slice().sort(order).map(row=>row.eventId),['A','B','C'])
 assert(order(rows[0],rows[1])<0 && order(rows[1],rows[2])<0 && order(rows[0],rows[2])<0)
 assert.equal(order(rows[1],rows[1]),0)
 assert.deepEqual(rows.map(row=>row.occurredAt),['2026-10-09T08:54:50Z','2026-10-09T16:54+08:00','2026-10-09T08:54:10Z'])
})

test('全部精确时刻仍按秒排序，跨分钟不会被新账本号倒置',()=>{
 const rows=[{occurredAt:'2026-10-09T08:54:50Z',ledgerSequence:1,eventId:'A'},{occurredAt:'2026-10-09T08:54:10Z',ledgerSequence:2,eventId:'B'},{occurredAt:'2026-10-09T08:53Z',ledgerSequence:99,eventId:'C'}]
 assert.deepEqual(rows.slice().sort(createCuttingRuntimeChronologyComparator(rows)).map(row=>row.eventId),['C','B','A'])
})

test('缺少或重复账本顺序不恢复低精度秒数，沿用原时刻规则',()=>{
 for(const sequence of [undefined,2]){
  const rows=[{occurredAt:'2026-10-09T08:54:50Z',ledgerSequence:2,eventId:'A'},{occurredAt:'2026-10-09T08:54Z',ledgerSequence:sequence,eventId:'B'}]
  assert.deepEqual(rows.slice().sort(createCuttingRuntimeChronologyComparator(rows)).map(row=>row.eventId),['B','A'])
 }
})

test('共享生命周期在同分钟旧入仓后允许交出，并保留原周期和事实', () => {
 const facts: TransferBagLifecycleFact[] = [
  {factId:'PACK',factType:'BAGGING_CONFIRMED',usageCycleId:'C1',occurredAt:'2026-10-09T08:54:50Z',ledgerSequence:1},
  {factId:'IN',factType:'INBOUND_CONFIRMED',usageCycleId:'C1',occurredAt:'2026-10-09T16:54+08:00',ledgerSequence:2},
 ]
 const input={carrierId:'B1',bagCode:'B1',cycles:[{usageCycleId:'C1',startedAt:facts[0].occurredAt,startedChronology:{factId:'PACK',ledgerSequence:1}}],facts}
 const original=structuredClone(input),result=deriveTransferBagLifecycle(input)
 assert.equal(result.flowStage,'INBOUND_STORED');assert.ok(result.allowedActions.includes('HANDOVER'))
 assert.deepEqual(result.sourceFactIds,['PACK','IN']);assert.deepEqual(input,original)
})

test('同分钟物理回收之后报废按真实顺序生效，不被周期边界副本或秒数重排', () => {
 const facts: TransferBagLifecycleFact[] = [
  {factId:'PACK',factType:'BAGGING_CONFIRMED',usageCycleId:'C1',occurredAt:'2026-10-09T08:54:50Z',ledgerSequence:1},
  {factId:'RETURN',factType:'PHYSICAL_BAG_RETURNED',usageCycleId:'C1',occurredAt:'2026-10-09T16:54+08:00',ledgerSequence:2},
  {factId:'SCRAP',factType:'BAG_SCRAPPED',occurredAt:'2026-10-09T08:54:10Z',ledgerSequence:3},
 ]
 const input={carrierId:'B1',bagCode:'B1',cycles:[{usageCycleId:'C1',startedAt:facts[0].occurredAt,startedChronology:{factId:'PACK',ledgerSequence:1},closedAt:facts[1].occurredAt,closedChronology:{factId:'RETURN',ledgerSequence:2},closeResult:'REUSABLE' as const}],facts}
 const original=structuredClone(input),result=deriveTransferBagLifecycle(input)
 assert.equal(result.mainStatus,'DISABLED');assert.deepEqual(result.sourceFactIds,['SCRAP']);assert.deepEqual(input,original)
})


import * as ledger from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { withBrowserBusinessStorage, type BrowserStorageLike } from '../../src/data/browser-storage.ts'
test('同步动作反复读同一账本只转换一次，副本可修改，写后/下一动作/异常退出仍独立重读', () => {
 const key=ledger.CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY
 const event=(id:string,quantity:number)=>({eventId:id,eventNo:id,eventType:'菲票装袋',eventSource:'WEB',eventStatus:'已同步',occurredAt:'2026-10-10T00:00:00Z',operatorName:'仓管',refs:{transferBagCode:'READ-FRAME'},payload:{pieceQty:quantity}})
 const rawA=JSON.stringify({events:[event('A',5)]}),rawB=JSON.stringify({events:[event('A',3),event('B',2)]})
 let raw:string|null=rawA,conversions=0
 const storage:BrowserStorageLike={getItem:k=>k===key?raw:null,setItem:(k,v)=>{if(k===key)raw=v},removeItem:()=>{raw=null}}
 const originalParse=JSON.parse
 JSON.parse=((value:string,...args:unknown[])=>{if(value===rawA||value===rawB)conversions++;return Reflect.apply(originalParse,JSON,[value,...args])}) as typeof JSON.parse
 // 优化前使用相同动作作为基线，真实重复转换计数会失败；不是缺少导出的报错。
 const frame=(ledger as unknown as {withCuttingRuntimeEventReadFrame?:<T>(s:BrowserStorageLike,read:()=>T)=>T}).withCuttingRuntimeEventReadFrame || (<T>(_s:BrowserStorageLike,read:()=>T)=>read())
 try {
  withBrowserBusinessStorage(storage,()=>frame(storage,()=>{
   const first=ledger.listCuttingRuntimeEvents(storage);first[0].payload={pieceQty:999}
   assert.equal((ledger.listCuttingRuntimeEvents(storage)[0].payload as {pieceQty:number}).pieceQty,5)
   assert.equal(ledger.listManagedCuttingRuntimeEvents(storage).length,1)
   assert.equal(conversions,1,'同一未改账本不重复转换')
   storage.setItem(key,rawB)
   assert.equal(ledger.listCuttingRuntimeEvents(storage).length,2)
   assert.equal((ledger.listCuttingRuntimeEvents(storage).find(e=>e.eventId==='A')!.payload as {pieceQty:number}).pieceQty,3)
   assert.equal(conversions,2,'写后重新转换一次，不能沿用旧量')
   const otherRaw=JSON.stringify({events:[event('OTHER',7)]}),other:BrowserStorageLike={getItem:k=>k===key?otherRaw:null,setItem(){},removeItem(){}}
   withBrowserBusinessStorage(other,()=>frame(other,()=>assert.equal(ledger.listCuttingRuntimeEvents(other)[0].eventId,'OTHER')))
   assert.equal(ledger.listCuttingRuntimeEvents(storage).length,2)
   assert.equal(conversions,2,'嵌套其他来源退出后恢复当前来源，不能相互串量')
  }))
  assert.equal(conversions,2)
  withBrowserBusinessStorage(storage,()=>frame(storage,()=>{assert.equal(ledger.listCuttingRuntimeEvents(storage).length,2)}))
  assert.equal(conversions,3,'下一动作不沿用上次结果')
  assert.throws(()=>withBrowserBusinessStorage(storage,()=>frame(storage,()=>{ledger.listCuttingRuntimeEvents(storage);throw Error('中断')})),/中断/)
  ledger.listCuttingRuntimeEvents(storage)
  assert.equal(conversions,5,'异常退出不能残留缓存')
 } finally {JSON.parse=originalParse}
})

test('一次排序每个时间文本仅解析一次，保留时区、旧分钟顺序和无效时间兜底且不修改原记录', () => {
 const rows=[
  {occurredAt:'2026-10-09T08:54:50Z',createdAt:'2026-10-09T08:55:00Z',ledgerSequence:1,eventId:'A'},
  {occurredAt:'2026-10-09T16:54+08:00',ledgerSequence:2,eventId:'B'},
  {occurredAt:'2026-10-09T08:54:10Z',ledgerSequence:3,eventId:'C'},
  {occurredAt:'2026-10-09T08:53:00Z',eventId:'D'},
  {occurredAt:'无效时间',eventId:'E'},
 ]
 const original=structuredClone(rows),parse=Date.parse,counts=new Map<string,number>()
 Date.parse=(value:string)=>{counts.set(value,(counts.get(value)||0)+1);return parse(value)}
 try {
  const order=createCuttingRuntimeChronologyComparator(rows)
  for(let repeat=0;repeat<5;repeat++) {
   const result=rows.slice().sort(order)
   assert.deepEqual(result.filter(row=>row.eventId!=='E').map(row=>row.eventId),['D','A','B','C'])
   assert.equal(Math.sign(order(rows[4],rows[0])),Math.sign(rows[4].occurredAt.localeCompare(rows[0].occurredAt,'zh-CN')))
  }
  assert.ok([...counts.values()].every(count=>count===1),`重复解析时间：${JSON.stringify([...counts])}`)
  assert.deepEqual(rows,original)
  rows[3].occurredAt='2026-10-09T08:56:00Z'
  assert.ok(order(rows[3],rows[0])>0,'修改后的时间文本必须重新解析')
 } finally {Date.parse=parse}
})
