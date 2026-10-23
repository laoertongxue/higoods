import test from 'node:test'
import assert from 'node:assert/strict'
import { listWaterSolubleWorkOrders } from '../../src/data/fcs/water-soluble-task-domain.ts'
import { waterSolubleLegacyTargets } from '../../src/data/fcs/water-soluble-legacy-migration.ts'
import { WATER_EXECUTION_STORAGE_KEY } from '../../src/data/fcs/fabric-washing-storage-bridge.ts'
import { assertWaterSolubleLegacyMigrated } from '../../src/data/fcs/water-soluble-legacy-source.ts'
import { getDesignRevisionFcsStorage } from '../../src/data/fcs/design-revision-pcs-storage.ts'

const paused = listWaterSolubleWorkOrders().find(order => order.status === 'PRODUCTION_PAUSED')!
const encode = (orders: unknown[]) => JSON.stringify({ version: 1, orders })

test('C06.23: old water order retains original unit, cumulative quantities, actual receipt/handout responsibility and roll identity', () => {
  const original = structuredClone(paused)
  const [target] = waterSolubleLegacyTargets(encode([original]))
  const value = target.value as { legacyKey: string; key: string; value: typeof paused }
  assert.equal(value.legacyKey, WATER_EXECUTION_STORAGE_KEY)
  assert.equal(value.key, original.waterOrderId)
  assert.deepEqual(value.value, original)
  assert.equal(value.value.qtyUnit, original.qtyUnit)
  assert.deepEqual(original, paused)
  assert.equal(waterSolubleLegacyTargets(encode([])).length, 0)
})

test('C06.23: migration rejects changed frozen units/source, duplicate order, malformed rolls and unknown top-level content', () => {
  const invalid = [
    encode([{ ...paused, qtyUnit: 'kg' }]),
    encode([{ ...paused, sourceArtifactId: 'UNKNOWN-SOURCE' }]),
    encode([paused, paused]),
    encode([{ ...paused, outputRolls: [{ id: 'x', qty: -1 }] }]),
    JSON.stringify({ version: 1, orders: [paused], extraOrders: [paused] }),
    JSON.stringify({ version: 2, orders: [paused] }),
    'not-json',
  ]
  for (const raw of invalid) assert.throws(() => waterSolubleLegacyTargets(raw))
})

test('C06.23: browser old-water reads demand explicit migration and direct writes cannot overwrite the source', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const raw = encode([paused]); const values = new Map([[WATER_EXECUTION_STORAGE_KEY, raw]])
  let writes = 0
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: () => { writes++ }, removeItem: () => { writes++ } }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
  try {
    assert.throws(assertWaterSolubleLegacyMigrated, (error: any) => error.code === 'PRODUCTION_CONTEXT_RECOVERY')
    assert.throws(() => getDesignRevisionFcsStorage().setItem(WATER_EXECUTION_STORAGE_KEY, encode([])), /通过对应业务动作/)
    assert.equal(writes, 0); assert.equal(values.get(WATER_EXECUTION_STORAGE_KEY), raw)
    values.delete(WATER_EXECUTION_STORAGE_KEY)
    assert.doesNotThrow(assertWaterSolubleLegacyMigrated)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('C06.23: Indonesian recovery names the next action and keeps original quantities out of error translation', async () => {
  const { recoveryErrorText } = await import('../../src/pages/production-context-recovery.ts')
  for (const error of ['先关闭其他 HiGood 页面并确认；旧水溶资料已保留。', '旧水溶资料与记录库冲突，双方资料已保留。', '浏览器空间不足，本次未保存。', '水溶资料已核对，但旧记录未能清理，可从此处重试。', '本机水溶加工记录损坏或与冻结来源不一致']) {
    const message = recoveryErrorText(new Error(error), true)
    assert.doesNotMatch(message, /[\u3400-\u9fff]|\d|\bkg\b|\byard\b/)
    assert.ok(message.length > 20)
  }
})
