import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { renderPcsFabricArchiveListPage } from '../src/pages/pcs-material-archives.ts'
import type { MaterialArchiveStoreSnapshot } from '../src/data/pcs-material-archive-types.ts'

const baseline = repo.getMaterialArchiveBaseline()
function publish(snapshot: MaterialArchiveStoreSnapshot) {
  pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot))
  repo.resetMaterialArchiveCache()
}
beforeEach(() => publish(baseline))

test('PERF/GOV-019: current-view projection keeps every filtered row and full statistics without constructing the other view', () => {
  const filters: Omit<repo.MaterialListFilter, 'view'>[] = [{}, { search: 'MAT-FB' }, { category: '梭织布' },
    { process: 'DYEING' }, { stage: 'PRINTING' }, { color: 'black' }, { approval: 'APPROVED', status: 'ACTIVE' }, { cost: 'missing' }, { cost: 'complete' }]
  for (const view of ['root', 'sku'] as const) for (const filter of filters) {
    const full = repo.queryMaterialArchiveList('fabric', { ...filter, view })
    const current = repo.queryMaterialArchiveList('fabric', { ...filter, view }, { rows: 'current-view' })
    assert.deepEqual(current.stats, full.stats)
    assert.deepEqual(current[view === 'root' ? 'roots' : 'skus'], full[view === 'root' ? 'roots' : 'skus'])
    assert.deepEqual(current[view === 'root' ? 'skus' : 'roots'], [])
    assert.equal(current.stats.incompleteCost, full.skus.filter(row => repo.getMaterialStandardCost(row.materialSkuId).completeness.length).length)
  }
})

test('COST/GOV-019: list completeness preserves zero, included transport and processed material dependency checks', () => {
  const source = structuredClone(baseline)
  const baseId = 'material-r1-MAT-FB-00000001-B01'
  const current = source.costVersions!.findLast(row => row.materialSkuId === baseId)!
  current.purchaseStandardCny = 0
  current.transportStandardCny = null
  current.purchaseIncludesTransport = true
  publish(source)
  const rows = repo.queryMaterialArchiveList('fabric', { view: 'sku', cost: 'complete' }, { rows: 'current-view' })
  assert.ok(rows.skus.some(row => row.materialSkuId === baseId))
  assert.equal(repo.getMaterialStandardCost(baseId).totalStandardCny, 0)
  for (const missingInput of ['absent-input', 'material-r1-process-dye']) {
    const invalid = structuredClone(source)
    invalid.skuRecords.find(row => row.materialSkuId === 'material-r1-process-dye')!.inputSkuId = missingInput
    publish(invalid)
    assert.throws(() => repo.queryMaterialArchiveList('fabric', { view: 'root' }, { rows: 'current-view' }), /SKU 不存在|成本依赖出现循环/)
  }
})

test('PERF/GOV-024: a 15506-root cold list reads every record, renders one page and never writes while normalizing', t => {
  const root = baseline.records.find(row => row.materialId === 'material-r1-MAT-FB-00000001')!
  const sku = baseline.skuRecords.find(row => row.materialSkuId === 'material-r1-MAT-FB-00000001-B01')!
  const cost = baseline.costVersions!.findLast(row => row.materialSkuId === sku.materialSkuId)!
  const count = 15506
  const source: MaterialArchiveStoreSnapshot = { ...baseline,
    records: Array.from({ length: count }, (_, i) => ({ ...root, materialId: `read-${i}`, materialCode: `READ-${i}`, updatedAt: `2026-10-${String(1 + i % 28).padStart(2, '0')} 12:00` })),
    skuRecords: Array.from({ length: count }, (_, i) => ({ ...sku, materialId: `read-${i}`, materialCode: `READ-${i}`, materialSkuId: `read-sku-${i}`, materialSkuCode: `READ-${i}-B01`, currentCostVersionId: `read-cost-${i}` })),
    costVersions: Array.from({ length: count }, (_, i) => ({ ...cost, materialSkuId: `read-sku-${i}`, costVersionId: `read-cost-${i}` })),
    usageRecords: [], logRecords: [], processDefinitions: [], unitRelations: [], packages: [], assets: [],
  }
  publish(source)
  const saved = pcsRecordStore.getItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY)
  const setItem = pcsRecordStore.setItem
  let writes = 0
  pcsRecordStore.setItem = (...args) => { writes++; setItem(...args) }
  try {
    const started = performance.now(), html = renderPcsFabricArchiveListPage(), elapsed = performance.now() - started
    assert.equal(writes, 0)
    assert.equal(pcsRecordStore.getItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY), saved)
    assert.equal((html.match(/data-pcs-material-archive-field="selection"/g) || []).length, 20)
    const selected = repo.queryMaterialArchiveList('fabric', { view: 'root' }, { rows: 'current-view' })
    assert.equal(selected.stats.total, count)
    assert.equal(selected.stats.skuCount, count)
    assert.equal(selected.roots.length, count)
    assert.equal(selected.skus.length, 0)
    assert.equal(selected.roots[0].updatedAt, '2026-10-28 12:00')
    const reread = repo.getMaterialArchiveById('read-15505')!
    reread.categoryAttributes!.width = 999
    assert.notEqual(repo.getMaterialArchiveById('read-15505')!.categoryAttributes!.width, 999)
    repo.resetMaterialArchiveCache()
    assert.equal(repo.queryMaterialArchiveList('fabric', { view: 'root', search: 'READ-15505-B01' }, { rows: 'current-view' }).stats.skuCount, 1)
    t.diagnostic(`15506 roots + SKUs + cost versions: cold read, normalize, aggregate and HTML ${elapsed.toFixed(2)} ms (Node diagnostic; browser gate remains separate)`)
  } finally { pcsRecordStore.setItem = setItem }
})
