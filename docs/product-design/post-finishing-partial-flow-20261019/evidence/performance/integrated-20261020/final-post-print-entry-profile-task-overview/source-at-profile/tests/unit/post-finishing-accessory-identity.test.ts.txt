import assert from 'node:assert/strict'
import test from 'node:test'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { listMaterialPrepProductionIdsForIdentities } from '../../src/data/fcs/cutting/production-material-prep.ts'
import * as sources from '../../src/data/wls/accessory-warehouse-sources.ts'
import { accessoryRecord, ensureAccessoryWarehouseRecords, saveAccessoryWarehouseAction } from '../../src/data/wls/accessory-warehouse-records.ts'
import type { AccessoryPreparation } from '../../src/data/wls/accessory-warehouse-flow.ts'
import { listAccessoryStaticStockSources } from '../../src/data/wls/accessory-warehouse-stock-sources.ts'

// Identity contracts only: use the existing narrow Node request facility and the
// public accessory record API. This does not verify browser IDB or UI behavior.
const unknownIdentity = 'POST-IDENTITY-CONTRACT-NOT-A-PRODUCTION-SOURCE'
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange')
let memory: ReturnType<typeof installPmsMemoryIdb>
let actualPreparations: AccessoryPreparation[]

function restoreWindow() {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
}

function productionIdentities(preparations: AccessoryPreparation[]) {
  return new Set(preparations.flatMap(row => [row.productionOrderId, row.productionOrderNo]))
}

async function isolatedSources(tag: string) {
  // A separate source instance isolates its sticky read-failure flag. Public
  // runtime and accessory record dependencies remain the shared real modules.
  const modulePath = '../../src/data/wls/accessory-warehouse-sources.ts'
  return import(`${modulePath}?post-identity-${tag}`)
}

test.before(async () => {
  memory = installPmsMemoryIdb()
  // The existing helper does not expose range/add operations. Only this isolated
  // accessory namespace is written, with unique command IDs; storage isolation,
  // duplicate-key behavior and transaction guarantees are not tested here.
  Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: { bound: (lower: string, upper: string) => ({ lower, upper }) } })
  const open = indexedDB.open.bind(indexedDB)
  const adapted = new WeakSet<object>()
  indexedDB.open = ((...args: Parameters<IDBFactory['open']>) => {
    const request = open(...args)
    const database = request.result
    if (!adapted.has(database)) {
      adapted.add(database)
      const transaction = database.transaction.bind(database)
      database.transaction = ((...transactionArgs: Parameters<IDBDatabase['transaction']>) => {
        const tx = transaction(...transactionArgs)
        const objectStore = tx.objectStore.bind(tx)
        tx.objectStore = (name: string) => {
          const store = objectStore(name)
          if (!store.add) store.add = store.put.bind(store)
          return store
        }
        return tx
      }) as IDBDatabase['transaction']
    }
    return request
  }) as IDBFactory['open']
  await ensureAccessoryWarehouseRecords()
  actualPreparations = sources.listAccessoryPreparations()
  assert.ok(actualPreparations.length > 0, '必须使用实际全量投影的非空准备单，不能以空输出证明超集')
})

test.afterEach(restoreWindow)
test.after(() => {
  restoreWindow()
  memory?.restore()
  if (originalRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalRange)
  else Reflect.deleteProperty(globalThis, 'IDBKeyRange')
})

test('PFN-056/068：逐个候选归属与当前完整21张准备单的ID和单号成员关系相同', context => {
  context.diagnostic(JSON.stringify({ actualPreparationCount: actualPreparations.length, productionIdentities: actualPreparations.map(row => [row.productionOrderId, row.productionOrderNo]) }))
  const complete = productionIdentities(actualPreparations)
  const issuesBefore = sources.listAccessoryWarehouseSourceIssues()
  for (const preparation of actualPreparations) {
    for (const identity of [preparation.productionOrderId, preparation.productionOrderNo]) {
      assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([identity])).has(identity), complete.has(identity), `必须等于完整实际归属 ${identity}`)
    }
  }
  assert.deepEqual(sources.listAccessoryPreparationProductionIdentities(complete), complete)
  assert.equal(listMaterialPrepProductionIdsForIdentities(new Set([unknownIdentity])).size, 0)
  assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([unknownIdentity])).size, 0)
  assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set()).size, 0)
  assert.deepEqual(sources.listAccessoryWarehouseSourceIssues(), issuesBefore, '归属查询不能覆盖业务页面完整问题目录')
  assert.deepEqual(productionIdentities(sources.listAccessoryPreparations()), complete, '窄查询后完整页面仍返回原完整范围')
})

test('PFN-056/068：合法保存的准备单单号别名仍是实际输出，并命中候选而非误判无归属', async () => {
  const preparation = actualPreparations[0]
  const alias = `${preparation.productionOrderNo}-SAVED-IDENTITY-ALIAS`
  assert.equal(listMaterialPrepProductionIdsForIdentities(new Set([alias])).size, 0, '别名不是静态或正式生产单号，必须覆盖保存分支')
  assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([alias])).has(alias), false)
  const saved = { ...structuredClone(preparation), productionOrderNo: alias }
  const record = accessoryRecord('preparation', saved.id, saved)
  try {
    await saveAccessoryWarehouseAction({ commandId: 'IDENTITY-SAVE-ALIAS', intent: 'isolated valid saved preparation identity', result: saved.id, change: { puts: [record] } })
    const complete = sources.listAccessoryPreparations()
    const actualSaved = complete.find(row => row.id === saved.id)
    assert.ok(actualSaved, '必须经现有完整投影读取，不仅把别名塞入候选输入')
    assert.equal(actualSaved.productionOrderId, preparation.productionOrderId)
    assert.equal(actualSaved.productionOrderNo, alias)
    const fullIdentities = productionIdentities(complete)
    for (const identity of [alias, preparation.productionOrderId, preparation.productionOrderNo]) {
      assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([identity])).has(identity), fullIdentities.has(identity), '原单号、保存别名及生产ID须分别与实际输出等价')
    }
  } finally {
    await saveAccessoryWarehouseAction({ commandId: 'IDENTITY-REMOVE-ALIAS', intent: 'remove isolated saved alias overlay', result: saved.id, change: { puts: [], deletes: [record.id] } })
  }
  assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([alias])).has(alias), false, '下一次读取必须看到别名已移除，不能缓存owner')
})

test('PFN-056/068：正式来源当前单号和技术包变化在下一次候选判断生效，不跨调用缓存', () => {
  const order = productionOrders.find(row => row.productionOrderId === 'PO-AW-202610-F01' && row.techPackSnapshot)
  assert.ok(order)
  const beforeNo = order.productionOrderNo
  const beforeSnapshot = order.techPackSnapshot
  const changedNo = `${beforeNo}-CURRENT-IDENTITY-CONTROL`
  assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([changedNo])).has(changedNo), false)
  try {
    // Isolated source identity variation; no production completion, stock,
    // assignment, transfer or receipt facts are generated by this control.
    order.productionOrderNo = changedNo
    assert.equal(listMaterialPrepProductionIdsForIdentities(new Set([changedNo])).has(order.productionOrderId), true)
    assert.equal(productionIdentities(sources.listAccessoryPreparations()).has(changedNo), true)
    assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([changedNo])).has(changedNo), true)
    order.techPackSnapshot = null
    assert.equal(listMaterialPrepProductionIdsForIdentities(new Set([changedNo])).size, 0)
    assert.equal(productionIdentities(sources.listAccessoryPreparations()).has(changedNo), false)
    assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([changedNo])).has(changedNo), false)
  } finally {
    order.productionOrderNo = beforeNo
    order.techPackSnapshot = beforeSnapshot
  }
  assert.equal(sources.listAccessoryPreparationProductionIdentities(new Set([changedNo])).has(changedNo), false)
})

test('PFN-056/068：PF-ACCEPT生产单仅可能有材料投影，不得因此认定实际辅料归属', () => {
  const candidates = new Set(['PF-ACCEPT-PO-1', 'PO-QC-202608-001'])
  assert.equal(listMaterialPrepProductionIdsForIdentities(candidates).has('PF-ACCEPT-PO-1'), true)
  const fullIdentities = productionIdentities(sources.listAccessoryPreparations())
  for (const identity of candidates) assert.equal(fullIdentities.has(identity), false)
  const scoped = sources.listAccessoryPreparationProductionIdentities(candidates)
  assert.equal(scoped.size, 0, '必须经过实际辅料用途和明细投影，不能把possible直接当owned')
})

test('PFN-054/068：窄范围实际归属仍执行全部已保存物理库存的完整性门禁', async () => {
  const stock = { ...listAccessoryStaticStockSources()[0], onHandQty: -1, version: 1 }
  const record = accessoryRecord('stock', stock.id, stock)
  const full = await isolatedSources('invalid-stock-full')
  const scoped = await isolatedSources('invalid-stock-scoped')
  try {
    // Explicit malformed-record fault input through the public record API;
    // this is not a generated stock movement or a claimed normal business fact.
    await saveAccessoryWarehouseAction({ commandId: 'IDENTITY-INVALID-STOCK', intent: 'isolated negative stock read fault', result: stock.id, change: { puts: [record] } })
    assert.throws(() => full.listAccessoryPreparations(), /库存数量必须是有效的非负数量/)
    assert.throws(() => scoped.listAccessoryPreparationProductionIdentities(new Set([actualPreparations[0].productionOrderId])), /库存数量必须是有效的非负数量/)
  } finally {
    await saveAccessoryWarehouseAction({ commandId: 'IDENTITY-REMOVE-INVALID-STOCK', intent: 'remove isolated invalid stock fault', result: stock.id, change: { puts: [], deletes: [record.id] } })
  }
})

test('PFN-054/068：未知候选不能吞掉原配料JSON损坏或集合结构错误', async () => {
  let raw = '{broken'
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => raw } } })
  const broken = await isolatedSources('damaged-json')
  assert.throws(() => broken.listAccessoryPreparationProductionIdentities(new Set([unknownIdentity])), /原配料资料格式损坏/)
  raw = '{}'
  const malformed = await isolatedSources('damaged-shape')
  assert.throws(() => malformed.listAccessoryPreparationProductionIdentities(new Set([unknownIdentity])), /缺少配料记录/)
})

test('PFN-054/068：未知候选不能把被禁用的原配料存储当成无来源', async () => {
  const isolated = await isolatedSources('disabled-storage')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { throw new Error('isolated storage denied') } } })
  assert.throws(() => isolated.listAccessoryPreparationProductionIdentities(new Set([unknownIdentity])), /原配料资料存储不可读取/)
})

test('PFN-054/068：已记录的实际来源读取失败必须继续阻断未知候选', async () => {
  const isolated = await isolatedSources('sticky-source-failure')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => '{broken' } } })
  assert.throws(() => isolated.listAccessoryPreparations(), /原配料资料格式损坏/)
  restoreWindow()
  assert.throws(() => isolated.listAccessoryPreparationProductionIdentities(new Set([unknownIdentity])), /原配料资料格式损坏/, '原错误存在时不能用无交集结果绕过')
})
