import assert from 'node:assert/strict'
import test from 'node:test'
import * as factoryStore from '../../src/data/fcs/factory-master-store.ts'
import { TEST_FACTORY_ID } from '../../src/data/fcs/factory-mock-data.ts'
import { resolveThirdPartyFactorySewingSeatCount } from '../../src/data/fcs/third-party-factory-rating.ts'
import type { Factory } from '../../src/data/fcs/factory-types.ts'

// Public master-record and rating contracts in an isolated Node process. The
// temporary storage only captures this test's explicit upserts; it is not a
// browser/IndexedDB, factory onboarding, dispatch or production execution test.
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const stored = new Map<string, string>()
let writes = 0
const baseFactory = factoryStore.listFactoryMasterRecords().find(row => row.id === 'FAC-APF')!

test.before(() => {
  assert.ok(baseFactory, '使用实际合法非车缝工厂档案作为隔离字段契约输入')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { writes++; stored.set(key, value) },
      removeItem: (key: string) => stored.delete(key),
    } },
  })
})

test.after(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

function controlFactory(id: string, code = id): Factory {
  return { ...structuredClone(baseFactory), id, code, name: `席位读取隔离契约 ${id}` }
}

function originalResolverOracle(identity: string, fallback?: number) {
  const raw = factoryStore.listFactoryMasterRecords().find(row => row.id === identity || row.code === identity)?.sewingSeatCount
  const numeric = typeof raw === 'number' ? raw : Number(raw)
  const integer = !Number.isFinite(numeric) || numeric <= 0 ? null : Math.floor(numeric)
  return integer
    ? { seatCount: integer, sourceLabel: '工厂档案 / 产能资料' }
    : { seatCount: fallback ?? 0, sourceLabel: '评级快照' }
}

function readSeatCount(identity: string): number | undefined {
  const read = (factoryStore as unknown as {
    readFactorySewingSeatCount?: (idOrCode: string) => number | undefined
  }).readFactorySewingSeatCount
  assert.equal(typeof read, 'function', '必须提供不复制全工厂目录的精确席位读取接口')
  return read!(identity)
}

test('PFN-067/068：席位primitive读取与完整工厂目录的实际ID和编号精确匹配相同', context => {
  const complete = factoryStore.listFactoryMasterRecords()
  assert.ok(complete.length > 0, '必须比较真实非空演示工厂目录')
  let checked = 0
  const beforeWrites = writes
  for (const factory of complete) for (const identity of [factory.id, factory.code]) {
    assert.equal(readSeatCount(identity), complete.find(row => row.id === identity || row.code === identity)?.sewingSeatCount, identity)
    assert.deepEqual(resolveThirdPartyFactorySewingSeatCount(identity, 73), originalResolverOracle(identity, 73), `${identity} 原席位/来源规则`)
    checked++
  }
  for (const identity of ['', 'POST-SEAT-UNKNOWN', 'ID-F090']) {
    assert.equal(readSeatCount(identity), complete.find(row => row.id === identity || row.code === identity)?.sewingSeatCount, identity)
    assert.deepEqual(resolveThirdPartyFactorySewingSeatCount(identity, 73), originalResolverOracle(identity, 73), identity)
  }
  assert.equal(writes, beforeWrites, '普通读取不保存工厂目录')
  context.diagnostic(JSON.stringify({ factories: complete.length, identityChecks: checked, boundary: 'Node public read contract; no browser/IDB or physical factory operation' }))
})

test('PFN-067/068：primitive返回不复制全目录，修改返回值或完整目录副本不改变原席位', () => {
  const id = 'POST-SEAT-PRIMITIVE-CONTROL'
  factoryStore.upsertFactoryMasterRecord({ ...controlFactory(id), sewingSeatCount: 47 })
  try {
    const beforeWrites = writes
    const originalClone = globalThis.structuredClone
    let returned: number | undefined
    try {
      globalThis.structuredClone = (() => { throw new Error('席位读取不能触发档案深复制') }) as typeof structuredClone
      returned = readSeatCount(id)
      assert.equal(readSeatCount('POST-SEAT-NOT-FOUND'), undefined)
      assert.deepEqual(resolveThirdPartyFactorySewingSeatCount(id, 9), { seatCount: 47, sourceLabel: '工厂档案 / 产能资料' })
    } finally {
      globalThis.structuredClone = originalClone
    }
    assert.equal(typeof returned, 'number')
    assert.equal(returned, 47)
    returned = 1000
    const copy = factoryStore.listFactoryMasterRecords().find(row => row.id === id)!
    copy.sewingSeatCount = 1001
    assert.equal(readSeatCount(id), 47)
    assert.equal(writes, beforeWrites)
  } finally {
    factoryStore.removeFactoryMasterRecord(id)
  }
})

test('PFN-068：零、负数、小数与有效席位遵循原取整/兜底/来源文案，公开upsert下一读即生效', context => {
  const id = 'POST-SEAT-NUMERIC-CONTROL'
  const code = 'POST-SEAT-NUMERIC-CODE'
  const values = [undefined, 0, -3, 0.25, 0.99, 1, 1.99, 29.99, 30.25, 127, Number.NaN, Number.POSITIVE_INFINITY]
  const fallbacks = [undefined, 0, -9, 2.75, 97]
  let checked = 0
  try {
    for (const value of values) {
      factoryStore.upsertFactoryMasterRecord({ ...controlFactory(id, code), sewingSeatCount: value })
      for (const identity of [id, code]) {
        assert.equal(readSeatCount(identity), value, 'reader必须返回原始值，不提前归一或沿用上一笔缓存')
        for (const fallback of fallbacks) {
          const actual = resolveThirdPartyFactorySewingSeatCount(identity, fallback)
          assert.deepEqual(actual, originalResolverOracle(identity, fallback), `${String(value)} / ${String(fallback)}`)
          if (value === 0.25 || value === 0.99) assert.equal(actual.sourceLabel, '评级快照', '正小数取整为0仍沿原规则回退')
          checked++
        }
      }
    }
    context.diagnostic(JSON.stringify({ rawValues: values.map(String), fallbackValues: fallbacks.map(String), resolverComparisons: checked }))
  } finally {
    factoryStore.removeFactoryMasterRecord(id)
  }
  assert.equal(readSeatCount(id), undefined, '删除后下一次读取不保留旧席位')
  assert.equal(readSeatCount(code), undefined)
})

test('PFN-068：ID-F090精确编号不走getById别名，合法自定义编号碰撞仍遵循原目录find顺序', () => {
  const id = 'POST-SEAT-ALIAS-CONTROL'
  const before = factoryStore.listFactoryMasterRecords()
  const previousExact = before.find(row => row.id === 'ID-F090' || row.code === 'ID-F090')?.sewingSeatCount
  const realTestFactorySeat = before.find(row => row.id === TEST_FACTORY_ID)?.sewingSeatCount
  assert.ok(factoryStore.getFactoryMasterRecordById('ID-F090'), '确认已有别名路径存在，不能用空结果绕过差异')
  assert.equal(factoryStore.getFactoryMasterRecordById('ID-F090')!.id, TEST_FACTORY_ID)
  assert.equal(readSeatCount('ID-F090'), previousExact)
  factoryStore.upsertFactoryMasterRecord({ ...controlFactory(id, 'ID-F090'), sewingSeatCount: 317 })
  try {
    assert.equal(factoryStore.listFactoryMasterRecords().find(row => row.id === 'ID-F090' || row.code === 'ID-F090')!.id, id)
    assert.equal(readSeatCount('ID-F090'), 317)
    assert.equal(readSeatCount(id), 317)
    assert.deepEqual(resolveThirdPartyFactorySewingSeatCount('ID-F090', 9), { seatCount: 317, sourceLabel: '工厂档案 / 产能资料' })
    assert.equal(factoryStore.getFactoryMasterRecordById('ID-F090')!.id, TEST_FACTORY_ID, '旧getById别名语义保持，reader不能复用它')
    assert.equal(readSeatCount(TEST_FACTORY_ID), realTestFactorySeat, '实际F090自身档案没有被代替')
  } finally {
    factoryStore.removeFactoryMasterRecord(id)
  }
  assert.equal(readSeatCount('ID-F090'), previousExact)
})

test('PFN-068：同一文本同时匹配另一个ID与自定义code时保持原数组首个匹配', () => {
  const existing = factoryStore.listFactoryMasterRecords().find(row => row.id === 'ID-F021')!
  assert.ok(existing)
  const id = 'POST-SEAT-FIRST-MATCH-CONTROL'
  const previousSeat = readSeatCount(existing.id)
  factoryStore.upsertFactoryMasterRecord({ ...controlFactory(id, existing.id), sewingSeatCount: 419 })
  try {
    const oracle = factoryStore.listFactoryMasterRecords().find(row => row.id === existing.id || row.code === existing.id)!
    assert.equal(oracle.id, id, '公开新增记录在原目录顺序置前，不能擅自改为ID优先')
    assert.equal(readSeatCount(existing.id), oracle.sewingSeatCount)
    assert.deepEqual(resolveThirdPartyFactorySewingSeatCount(existing.id, 9), originalResolverOracle(existing.id, 9))
    factoryStore.upsertFactoryMasterRecord({ ...controlFactory(id, existing.id), sewingSeatCount: 521 })
    assert.equal(readSeatCount(existing.id), 521, '更新后立即可见，不跨动作缓存')
  } finally {
    factoryStore.removeFactoryMasterRecord(id)
  }
  assert.equal(readSeatCount(existing.id), previousSeat)
})
