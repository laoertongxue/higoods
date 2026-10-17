import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pcsRecordStore, withPcsDemoData } from '../../src/data/pcs-record-runtime.ts'
import { getMaterialSkuRecordById, resetMaterialArchiveCache } from '../../src/data/pcs-material-archive-repository.ts'
import { readPcsMaterialSkuIdentity } from '../../src/data/pcs-material-sku-identity.ts'

const key = 'higood-pcs-material-archive-store-v2'
const baseline = JSON.parse(readFileSync(new URL('../../src/data/generated/pcs-record-baseline.json', import.meta.url), 'utf8'))
const source = JSON.parse(baseline[key])
function use(value: unknown) { withPcsDemoData(() => pcsRecordStore.setItem(key, JSON.stringify(value)));resetMaterialArchiveCache() }

test('display identity equals the existing repository for every published SKU and legacy image normalization', () => {
  try {
    use(source)
    for (const sku of source.skuRecords) {
      const expected = getMaterialSkuRecordById(sku.materialSkuId)!
      assert.deepEqual(readPcsMaterialSkuIdentity(sku.materialSkuId), { materialSkuCode: expected.materialSkuCode, skuImageUrl: expected.skuImageUrl }, sku.materialSkuId)
    }
    assert.equal(readPcsMaterialSkuIdentity('absent-sku'), null)
  } finally { use(source) }
})

test('committed owner replacement invalidates identity cache and returned values cannot mutate facts', () => {
  try {
    const changed = structuredClone(source), sku = changed.skuRecords[0]
    sku.materialSkuCode = 'USER-MATERIAL-001';sku.skuImageUrl = '/user-material-image.webp'
    use(changed)
    const identity = readPcsMaterialSkuIdentity(sku.materialSkuId)!
    assert.deepEqual(identity, { materialSkuCode: sku.materialSkuCode, skuImageUrl: sku.skuImageUrl })
    identity.materialSkuCode = 'mutated'
    assert.equal(readPcsMaterialSkuIdentity(sku.materialSkuId)?.materialSkuCode, sku.materialSkuCode)
    use(source)
    assert.notEqual(readPcsMaterialSkuIdentity(sku.materialSkuId)?.materialSkuCode, sku.materialSkuCode)
  } finally { use(source) }
})

test('incomplete stored material facts throw rather than becoming an empty display', () => {
  try { use({ version: 5, records: [] });assert.throws(() => readPcsMaterialSkuIdentity('some-sku'), /物料档案格式不完整/) }
  finally { use(source) }
})
