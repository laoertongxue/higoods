import assert from 'node:assert/strict'
import test from 'node:test'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { hasMaterialPrepProductionIdentity } from '../../src/data/fcs/cutting/production-material-prep.ts'
import * as sources from '../../src/data/wls/accessory-warehouse-sources.ts'
import { accessoryRecord, ensureAccessoryWarehouseRecords, saveAccessoryWarehouseAction } from '../../src/data/wls/accessory-warehouse-records.ts'
import type { AccessoryPreparation } from '../../src/data/wls/accessory-warehouse-flow.ts'

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

test('PFN-056/068：当前实际辅料准备单每个生产ID和单号均被保守候选覆盖，未知身份为false', context => {
  context.diagnostic(JSON.stringify({ actualPreparationCount: actualPreparations.length, productionIdentities: actualPreparations.map(row => [row.productionOrderId, row.productionOrderNo]) }))
  for (const preparation of actualPreparations) {
    for (const identity of [preparation.productionOrderId, preparation.productionOrderNo]) {
      assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([identity])), true, `不得漏掉实际输出 ${identity}`)
    }
  }
  assert.equal(hasMaterialPrepProductionIdentity(new Set([unknownIdentity])), false)
  assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([unknownIdentity])), false)
  assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set()), false)
})

test('PFN-056/068：合法保存的准备单单号别名仍是实际输出，并命中候选而非误判无归属', async () => {
  const preparation = actualPreparations[0]
  const alias = `${preparation.productionOrderNo}-SAVED-IDENTITY-ALIAS`
  assert.equal(hasMaterialPrepProductionIdentity(new Set([alias])), false, '别名不是静态或正式生产单号，必须覆盖保存分支')
  assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([alias])), false)
  const saved = { ...structuredClone(preparation), productionOrderNo: alias }
  const record = accessoryRecord('preparation', saved.id, saved)
  try {
    await saveAccessoryWarehouseAction({ commandId: 'IDENTITY-SAVE-ALIAS', intent: 'isolated valid saved preparation identity', result: saved.id, change: { puts: [record] } })
    const actualSaved = sources.listAccessoryPreparations().find(row => row.id === saved.id)
    assert.ok(actualSaved, '必须经现有完整投影读取，不仅把别名塞入候选输入')
    assert.equal(actualSaved.productionOrderId, preparation.productionOrderId)
    assert.equal(actualSaved.productionOrderNo, alias)
    assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([alias])), true)
  } finally {
    await saveAccessoryWarehouseAction({ commandId: 'IDENTITY-REMOVE-ALIAS', intent: 'remove isolated saved alias overlay', result: saved.id, change: { puts: [], deletes: [record.id] } })
  }
  assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([alias])), false, '下一次读取必须看到别名已移除，不能缓存owner')
})

test('PFN-056/068：正式来源当前单号和技术包变化在下一次候选判断生效，不跨调用缓存', () => {
  const order = productionOrders.find(row => row.techPackSnapshot)
  assert.ok(order)
  const beforeNo = order.productionOrderNo
  const beforeSnapshot = order.techPackSnapshot
  const changedNo = `${beforeNo}-CURRENT-IDENTITY-CONTROL`
  assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([changedNo])), false)
  try {
    // Isolated source identity variation; no production completion, stock,
    // assignment, transfer or receipt facts are generated by this control.
    order.productionOrderNo = changedNo
    assert.equal(hasMaterialPrepProductionIdentity(new Set([changedNo])), true)
    assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([changedNo])), true)
    order.techPackSnapshot = null
    assert.equal(hasMaterialPrepProductionIdentity(new Set([changedNo])), false)
    assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([changedNo])), false)
  } finally {
    order.productionOrderNo = beforeNo
    order.techPackSnapshot = beforeSnapshot
  }
  assert.equal(sources.hasPotentialAccessoryPreparationIdentity(new Set([changedNo])), false)
})

test('PFN-054/068：未知候选不能吞掉原配料JSON损坏或集合结构错误', () => {
  let raw = '{broken'
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => raw } } })
  assert.throws(() => sources.hasPotentialAccessoryPreparationIdentity(new Set([unknownIdentity])), /原配料资料格式损坏/)
  raw = '{}'
  assert.throws(() => sources.hasPotentialAccessoryPreparationIdentity(new Set([unknownIdentity])), /缺少配料记录/)
})

test('PFN-054/068：未知候选不能把被禁用的原配料存储当成无来源', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { throw new Error('isolated storage denied') } } })
  assert.throws(() => sources.hasPotentialAccessoryPreparationIdentity(new Set([unknownIdentity])), /原配料资料存储不可读取/)
})

test('PFN-054/068：已记录的实际来源读取失败必须继续阻断未知候选', async () => {
  // Separate source module only to isolate its sticky read-failure flag, as in
  // the existing source contracts; public record/runtime dependencies are shared.
  const modulePath = '../../src/data/wls/accessory-warehouse-sources.ts'
  const isolated = await import(`${modulePath}?post-identity-source-failure`)
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => '{broken' } } })
  assert.throws(() => isolated.listAccessoryPreparations(), /原配料资料格式损坏/)
  restoreWindow()
  assert.throws(() => isolated.hasPotentialAccessoryPreparationIdentity(new Set([unknownIdentity])), /原配料资料格式损坏/, '原错误存在时不能用无交集结果绕过')
})
