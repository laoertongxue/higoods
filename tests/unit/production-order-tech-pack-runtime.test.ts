import assert from 'node:assert/strict'
import test from 'node:test'
import { productionOrders, getProductionOrderTechPackSnapshot as getStoredSnapshot } from '../../src/data/fcs/production-orders.ts'
import * as runtime from '../../src/data/fcs/production-order-tech-pack-runtime.ts'
import type { ProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-tech-pack-snapshot-types.ts'

const subsets = [
  ['bomItems', runtime.getProductionOrderBomItems],
  ['patternFiles', runtime.getProductionOrderPatternFiles],
  ['processEntries', runtime.getProductionOrderProcessEntries],
  ['sizeTable', runtime.getProductionOrderSizeTable],
  ['colorMaterialMappings', runtime.getProductionOrderColorMaterialMappings],
  ['patternDesigns', runtime.getProductionOrderPatternDesigns],
  ['sizeMeasurements', runtime.getProductionOrderSizeMeasurements],
  ['cutPieceParts', runtime.getProductionOrderCutPieceParts],
  ['imageSnapshot', runtime.getProductionOrderTechPackImageSnapshot],
] as const

function assertDetached(value: unknown, source: unknown, label: string): void {
  if (!value || typeof value !== 'object' || !source || typeof source !== 'object') return
  assert.notEqual(value, source, `${label} must not expose source references`)
  for (const key of Object.keys(value)) {
    assertDetached((value as Record<string, unknown>)[key], (source as Record<string, unknown>)[key], `${label}.${key}`)
  }
}

test('PERF-001: runtime snapshot and all nine subsets preserve every production order value and caller isolation', () => {
  for (const order of productionOrders) {
    const expected = getStoredSnapshot(order.productionOrderId)
    const snapshot = runtime.getProductionOrderTechPackSnapshot(order.productionOrderId)
    assert.deepEqual(snapshot, expected)
    assertDetached(snapshot, order.techPackSnapshot, order.productionOrderId)
    assertDetached(snapshot, runtime.getProductionOrderTechPackSnapshot(order.productionOrderId), 'separate callers')
    for (const [key, get] of subsets) {
      const value = get(order.productionOrderId)
      // Runtime retains optional undefined properties; compare the serializable business facts.
      assert.deepEqual(JSON.parse(JSON.stringify(value)), JSON.parse(JSON.stringify(expected?.[key] ?? (key === 'imageSnapshot' ? null : []))))
      assertDetached(value, order.techPackSnapshot?.[key], key)
      assertDetached(value, get(order.productionOrderId), `${key} separate callers`)
    }
  }
})

test('PERF-001: a subset read does not traverse or clone unrelated snapshot sections', () => {
  const order = productionOrders.find(item => item.techPackSnapshot)!
  const original = order.techPackSnapshot!
  try {
    for (const [key, get] of subsets) {
      order.techPackSnapshot = new Proxy(original, {
        get(target, property, receiver) {
          assert.equal(property, key, `${key} read touched unrelated ${String(property)}`)
          return Reflect.get(target, property, receiver)
        },
        ownKeys() { assert.fail(`${key} read traversed the complete snapshot`) },
      })
      assert.ok(get(order.productionOrderId))
    }
  } finally { order.techPackSnapshot = original }
})

test('PERF-001: paper pattern binding strips and nested craft arrays remain isolated after mutation', () => {
  const order = productionOrders.find(item => item.techPackSnapshot?.patternFiles.length)!
  const original = order.techPackSnapshot!
  const fixture = structuredClone(original)
  const pattern = fixture.patternFiles[0]
  pattern.bindingStrips = [{
    bindingStripId: 'PERF-BINDING', relatedPieceId: 'PERF-PART', bindingStripName: '领口捆条', lengthCm: 20, widthCm: 2,
    specialCrafts: [{processCode:'DYE',processName:'染色',craftCode:'DYE',craftName:'染色',displayName:'捆条染色',supportedTargetObjects:['BINDING_STRIP'],supportedTargetObjectLabels:['捆条']}],
  }] as NonNullable<typeof pattern.bindingStrips>
  try {
    order.techPackSnapshot = fixture
    const value = runtime.getProductionOrderPatternFiles(order.productionOrderId)
    assertDetached(value, fixture.patternFiles, 'patterns')
    value[0].bindingStrips![0].specialCrafts![0].supportedTargetObjects!.push('FULL_FABRIC')
    value[0].bindingStrips![0].specialCrafts![0].supportedTargetObjectLabels!.push('完整面料')
    assert.deepEqual(fixture.patternFiles[0].bindingStrips![0].specialCrafts![0].supportedTargetObjects, ['BINDING_STRIP'])
    assert.deepEqual(runtime.getProductionOrderPatternFiles(order.productionOrderId)[0].bindingStrips, fixture.patternFiles[0].bindingStrips)
  } finally { order.techPackSnapshot = original }
})

test('PERF-001: replacing or updating the bound snapshot is visible immediately without a stale cache', () => {
  const order = productionOrders.find(item => item.techPackSnapshot?.bomItems.length)!
  const original = order.techPackSnapshot!
  const fixture: ProductionOrderTechPackSnapshot = structuredClone(original)
  try {
    runtime.getProductionOrderBomItems(order.productionOrderId)
    fixture.bomItems[0].applicableSkuCodes = ['PERF-NEW-SKU']
    order.techPackSnapshot = fixture
    assert.deepEqual(runtime.getProductionOrderBomItems(order.productionOrderId)[0].applicableSkuCodes, ['PERF-NEW-SKU'])
    fixture.bomItems[0].applicableSkuCodes.push('PERF-NEXT-SKU')
    assert.deepEqual(runtime.getProductionOrderBomItems(order.productionOrderId)[0].applicableSkuCodes, ['PERF-NEW-SKU', 'PERF-NEXT-SKU'])
  } finally { order.techPackSnapshot = original }
})

test('PERF-001: missing production order keeps null and empty-list contracts', () => {
  assert.equal(runtime.getProductionOrderTechPackSnapshot('missing-tech-pack-runtime'), null)
  for (const [key, get] of subsets) assert.deepEqual(get('missing-tech-pack-runtime'), key === 'imageSnapshot' ? null : [])
})
