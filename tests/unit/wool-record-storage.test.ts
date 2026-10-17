import assert from 'node:assert/strict'
import test from 'node:test'
import { decodePcsRecordSnapshot, assemblePcsRecordSnapshot, encodePcsRecordSnapshot } from '../../src/data/pcs-record-codec.ts'
import { buildWoolFactWorkflowMockStore } from '../../src/data/fcs/wool-domain/mock-data.ts'
import { WOOL_DOMAIN_STORE_KEY, readWoolStore, clearWoolStoreMemoryCache } from '../../src/data/fcs/wool-domain/store.ts'
import type { PcsStoredRecord } from '../../src/data/pcs-record-db.ts'
import { listWoolCraftTaskOrders, executeWoolCraftAction, getWoolCraftFactoryConflict } from '../../src/data/fcs/wool-domain/craft-flow.ts'
import { replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { configureDesignRevisionPcsStorage, getDesignRevisionFcsStorage, PCS_FCS_COLLECTIONS } from '../../src/data/fcs/design-revision-pcs-storage.ts'
import { captureFactoryReceivingData } from '../../src/data/fcs/factory-receiving.ts'
import { buildWoolCraftWarehouseProjection } from '../../src/data/fcs/wool-domain/craft-warehouse.ts'

test('接收先于毛织读取时，固定事实只补缺项且仓库数量仍闭合', () => {
  const before=captureFactoryReceivingData()
  readWoolStore()
  const after=captureFactoryReceivingData()
  for(const source of before.sources)assert.deepEqual(after.sources.find(row=>row.id===source.id),source)
  for(const receipt of before.receipts)assert.deepEqual(after.receipts.find(row=>row.id===receipt.id),receipt)
  assert.equal(after.receipts.length,38)
  assert.doesNotThrow(()=>buildWoolCraftWarehouseProjection())
})

test('毛织加工单逐单、事实逐自身稳定ID存储，meta不含整包workOrders', () => {
  const original = buildWoolFactWorkflowMockStore()
  const rows = decodePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, JSON.stringify(original))
  const meta = rows.find(row => row.id.endsWith('/meta'))!.value as {fields: object}
  assert.equal('workOrders' in meta.fields, false)
  assert.equal(rows.filter(row => row.collection.endsWith('/workOrders')).length, Object.keys(original.workOrders).length)
  for (const [id, order] of Object.entries(original.workOrders)) {
    const row = rows.find(row => row.id === `${WOOL_DOMAIN_STORE_KEY}/workOrders/${encodeURIComponent(id)}`)
    assert.deepEqual((row!.value as {data: unknown}).data, order)
  }
  const restored = assemblePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, rows.map(row => ({...row, version: 1})))
  assert.deepEqual(restored, original)
})

test('毛织事实删除标记不复活，修改一张单不改变其他记录身份', () => {
  const seed = JSON.stringify(buildWoolFactWorkflowMockStore())
  const rows = decodePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, seed)
  const order = rows.find(row => row.collection.endsWith('/workOrders'))!
  const deletion: PcsStoredRecord = {...order, version: 1, deleted: true, value: null}
  const restored = assemblePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, [deletion], seed) as {workOrders: Record<string, unknown>}
  const id = decodeURIComponent(order.id.split('/').at(-1)!)
  assert.equal(restored.workOrders[id], undefined)
  const changed = JSON.parse(seed)
  const second = Object.keys(changed.workOrders).find(key => key !== id)!
  changed.workOrders[second].updatedBy = '本次保存'
  const next = decodePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, JSON.stringify(changed))
  assert.deepEqual(next.map(row => row.id), rows.map(row => row.id))
  assert.equal(next.filter(row => JSON.stringify(row.value) !== JSON.stringify(rows.find(old => old.id === row.id)!.value)).length, 1)
})

test('旧工艺编码在LS与已有IDB读取边界规范，记录和实际工厂身份不变', () => {
  const value = buildWoolFactWorkflowMockStore()
  const order = Object.values(value.workOrders).find(order => order.externalPieces.length)!
  const node = order.externalPieces[0].routeNodes[0]
  node.craftCode = 'CRAFT_' + 3000004
  const before = {sourceEntryId: node.sourceEntryId, factoryId: node.factoryId, taskOrderId: node.taskOrderId}
  const raw = JSON.stringify(value)
  const normalized = assemblePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, decodePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY, raw).map(row => ({...row,version:1}))) as typeof value
  const actual = normalized.workOrders[order.woolOrderId].externalPieces[0].routeNodes[0]
  assert.equal(actual.craftCode, 'CRAFT_' + 3000010)
  assert.equal(actual.craftName, '缝边绣')
  assert.deepEqual({sourceEntryId:actual.sourceEntryId,factoryId:actual.factoryId,taskOrderId:actual.taskOrderId}, before)
  const generic = 'higood-pcs-testing-orders-v1'
  const saved = decodePcsRecordSnapshot(generic, JSON.stringify([{id:'old-id',craftCode:'CRAFT_' + 3000010,craftName:'缝边绣'}]))
  const record = saved.find(row => row.collection.endsWith('/items'))!
  ;((record.value as {data: {craftCode:string}}).data).craftCode = 'CRAFT_' + 3000003
  const reread = JSON.parse(encodePcsRecordSnapshot(generic, saved.map(row => ({...row,version:1})))!)
  assert.equal(reread[0].id, 'old-id')
  assert.equal(reread[0].craftCode, 'CRAFT_' + 3000010)
})

test('普通毛织读取不写LS种子或清理历史源', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let writes = 0
  const storage = {getItem: () => null, setItem: () => {writes++; throw Error('禁止业务LS写入')}, removeItem: () => {writes++; throw Error('禁止普通读取清理')}}
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage}})
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage})
  try { clearWoolStoreMemoryCache(); assert.ok(Object.keys(readWoolStore().workOrders).length); assert.equal(writes,0) }
  finally {
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window')
    if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage')
  }
})

test('旧编码与旧厂的实际毛织事实归属保留，工艺处理明确阻断', () => {
  const original = readWoolStore()
  const saved = structuredClone(original)
  const order = saved.workOrders['WOOL-STAGE-009:KNITTING']
  const node = order.externalPieces[0].routeNodes[0]
  node.craftCode = 'CRAFT_' + 3000004
  node.factoryId = 'F090'
  node.factoryName = '历史实际工厂'
  // Exercise the same private legacy normalization used by both read boundaries.
  const rows = decodePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY,JSON.stringify(saved))
  const normalized = assemblePcsRecordSnapshot(WOOL_DOMAIN_STORE_KEY,rows.map(row=>({...row,version:1}))) as typeof saved
  try {
    replaceWoolStore(normalized)
    const task = listWoolCraftTaskOrders().find(task=>task.woolOrderId===order.woolOrderId&&task.woolRouteNodeId===node.sourceEntryId)!
    assert.equal(task.factoryId,'F090')
    assert.match(getWoolCraftFactoryConflict(task),/历史承接工厂/)
    const before=readWoolStore()
    assert.throws(()=>executeWoolCraftAction({taskOrderId:task.taskOrderId,actionCode:'SPECIAL_CRAFT_PROCESS_REPORT',qty:1,operatorName:'验收',operatedAt:'2026-10-17 12:00:00',commandId:'historic-factory-block'}),/历史工厂归属/)
    assert.deepEqual(readWoolStore(),before)
    assert.deepEqual(before.craftRecords,original.craftRecords)
  } finally { replaceWoolStore(original) }
})

test('固定接收seed仅补缺项，旧源事实优先，已持久覆盖仍优先于旧源', () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  const legacy={version:1,sources:[{id:'same-source',targetFactoryId:'F090',createdAt:'old-time',createdBy:'old-person',lines:[{woolCraftOrderId:'historical-task',sentQty:73}]}],receipts:[{id:'same-receipt',factoryId:'F090',receivedAt:'old-receipt-time',operatorName:'actual-receiver',lines:[{sourceId:'same-source',qty:71}]}],deliveries:[],allocations:[],defaults:{}}
  const seedRows=[{id:'sources/same-source',path:'sources',key:'same-source',tuple:false,value:{...legacy.sources[0],targetFactoryId:'FAC-APF'}},{id:'receipts/same-receipt',path:'receipts',key:'same-receipt',tuple:false,value:{...legacy.receipts[0],factoryId:'FAC-APF'}}]
  const raw=JSON.stringify(seedRows),nativeRaw=JSON.stringify(legacy)
  let token={},saved=false
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key==='higood-factory-material-receiving-v1'?nativeRaw:null}})
  configureDesignRevisionPcsStorage({getItem:key=>key===PCS_FCS_COLLECTIONS[3]?raw:'[]',getBaselineItem:key=>key===PCS_FCS_COLLECTIONS[3]?raw:'[]',isPersistedRow:()=>saved,persistenceToken:()=>token,setItem:()=>{throw Error('普通读取不可写')},isStaging:()=>false})
  try {
    const storage=getDesignRevisionFcsStorage()
    const read=()=>JSON.parse(storage.getItem('higood-factory-material-receiving-v1')!)
    assert.deepEqual(read(),legacy)
    saved=true;token={}
    assert.equal(read().sources[0].targetFactoryId,'FAC-APF')
    assert.equal(read().receipts[0].factoryId,'FAC-APF')
  } finally {
    configureDesignRevisionPcsStorage({getItem:()=>null,setItem:()=>{},isStaging:()=>false})
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage')
  }
})
