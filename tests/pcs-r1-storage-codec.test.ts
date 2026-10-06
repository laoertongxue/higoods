import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodePcsRecordSnapshot as decode, encodePcsRecordSnapshot as encode, normalizePcsRecordSnapshot, equalPcsRecordValues } from '../src/data/pcs-record-codec.ts'
import { assignPcsRecordPositions } from '../src/data/pcs-record-position.ts'
import { pcsFileReferences } from '../src/data/pcs-record-db.ts'

test('same internal SKU under one PID retains several platform variant identities', () => {
  const key = 'higood-pcs-channel-catalog-v1'
  const value = { variants: [{ id: 'external-1', internalSkuId: 'sku-one', listingId: 'pid-one' }, { id: 'external-2', internalSkuId: 'sku-one', listingId: 'pid-one' }] }
  const rows = decode(key, JSON.stringify(value))
  assert.deepEqual(rows.slice(1).map(row => row.id), [`${key}/variants/external-1`, `${key}/variants/external-2`])
  assert.deepEqual(JSON.parse(encode(key, rows.map(row => ({ ...row, version: 1 })))!), value)
})

test('material processes, cost versions and unit relations use own identities', () => {
  const key = 'higood-pcs-material-archive-store-v2'
  const value = { records: [{ materialId: 'root' }], skuRecords: [{ materialSkuId: 'base', materialId: 'root' }, { materialSkuId: 'dyed', materialId: 'root' }], costVersions: [{ costVersionId: 'cost-1', materialSkuId: 'dyed' }, { costVersionId: 'cost-2', materialSkuId: 'dyed' }], unitRelations: [{ relationId: 'unit-1', materialSkuId: 'dyed' }, { relationId: 'unit-2', materialSkuId: 'dyed' }] }
  assert.equal(decode(key, JSON.stringify(value)).length, 8)
  assert.throws(() => decode(key, JSON.stringify({ skuRecords: [{ materialId: 'parent-only' }] })), /materialSkuId/)
})

test('template version and dimension are part of configuration record identity', () => {
  const templates = decode('higood-pcs-material-config-v1', JSON.stringify({ templates: [{ templateId: 'fabric', version: 1 }, { templateId: 'fabric', version: 2 }], units: [{ id: 'M', code: 'M' }] }))
  assert.equal(templates.length, 4)
  assert.ok(templates[1].id.endsWith('fabric%3Av1'))
  const key = 'higood-pcs-config-workspace-store-v1'
  const dimensions = decode(key, JSON.stringify({ options: [{ id: 'same', dimensionId: 'brands' }, { id: 'same', dimensionId: 'styles' }] }))
  assert.equal(dimensions.length, 3)
})

test('old category-number references and dictionaries retain their stable IDs', () => {
  const value = normalizePcsRecordSnapshot('higood-pcs-style-archive-store-v3', JSON.stringify({ records: [{ styleId: 'style', productConfigRefs: { styleCodes: ['styleCodes-89'], styles: ['styles-1'] } }] })) as any
  assert.deepEqual(value.records[0].productConfigRefs, { categoryNumbers: ['styleCodes-89'], styles: ['styles-1'] })
  const config = normalizePcsRecordSnapshot('higood-pcs-config-workspace-store-v1', JSON.stringify({ flatOptions: { styleCodes: [{ id: 'styleCodes-89', code: '89', name_zh: '印花套装' }] }, categoryNodes: [] })) as any
  assert.equal(config.options[0].dimensionId, 'categoryNumbers')
  assert.equal(config.options[0].id, 'styleCodes-89')
  assert.ok(!('flatOptions' in config))
})

test('saved overlays and tombstones survive seed updates without duplicating snapshots', () => {
  const key = 'higood-pcs-channel-store-v1'
  const seed = JSON.stringify({ version: 1, stores: [{ id: 'one', name: 'Static' }, { id: 'two', name: 'Delete me' }], logs: [] })
  const original = decode(key, seed)
  const edited = original.find(row => row.id.endsWith('/one'))!
  const rows = [{ ...edited, value: { position: 0, data: { id: 'one', name: 'Edited' } }, version: 1 }, { id: `${key}/stores/two`, collection: `${key}/stores`, value: null, deleted: true, version: 1 }]
  assert.deepEqual(JSON.parse(encode(key, rows, seed)!).stores, [{ id: 'one', name: 'Edited' }])
})

test('new schema groups are not lost when old metadata already exists', () => {
  const key = 'higood-pcs-channel-catalog-v1'
  const seed = JSON.stringify({ version: 2, variants: [], fieldBaselines: [{ id: 'baseline', value: 'current' }] })
  const old = decode(key, JSON.stringify({ version: 1, variants: [] })).map(row => ({ ...row, version: 1 }))
  assert.equal(JSON.parse(encode(key, old, seed)!).fieldBaselines.length, 1)
})

test('front insertion only changes the added row position', () => {
  const before = new Map([['one', 0], ['two', 1], ['three', 2]])
  const after = assignPcsRecordPositions(['new', ...before.keys()], before)
  for (const [id, position] of before) assert.equal(after.get(id), position)
  assert.ok(after.get('new')! < 0)
})

test('attachment reference validation rejects bytes in JSON and respects explicit static files', () => {
  assert.deepEqual([...pcsFileReferences({ images: [{ fileId: 'image', url: 'pcs-file:image' }] })], ['image'])
  assert.deepEqual([...pcsFileReferences({ fileId: 'demo-file', fileStorage: 'static', dataUrl: '/demo/material.jpg' })], [])
  assert.throws(() => pcsFileReferences({ dataUrl: 'data:image/png;base64,AABB' }), /Base64/)
  assert.throws(() => pcsFileReferences({ file: new Blob(['bytes']) }), /文件仓库/)
  const cyclic: Record<string, unknown> = { files: ['pcs-file:array-file'], nested: { fileId: 'nested-file' }, bare: 'protected-file' }
  cyclic.self = cyclic
  assert.deepEqual([...pcsFileReferences(cyclic, new Set(['protected-file']))].sort(), ['array-file', 'nested-file', 'protected-file'])
  assert.deepEqual([...pcsFileReferences(Object.assign(Object.create({ fileId: 'inherited-file' }), { title: 'plain' }))], [])
})


test('legacy configured-dimension metadata is equivalent only when derivable from unchanged option records', () => {
  const key = 'higood-pcs-config-workspace-store-v1'
  const old = decode(key, JSON.stringify({ version: 1, flatOptions: { colors: [{ id: 'color-1', name: '黑色' }] }, categoryNodes: [] }))
  const current = decode(key, JSON.stringify({ version: 1, options: [{ id: 'color-1', name: '黑色', dimensionId: 'colors' }], categoryNodes: [] }))
  assert.equal(equalPcsRecordValues(old[0], current[0], old, current), true)
  assert.equal(equalPcsRecordValues(old[1], current[1], old, current), true)
  const changed = structuredClone(current); changed[1].value.data.name = '红色'
  assert.equal(equalPcsRecordValues(old[1], changed[1], old, changed), false)
  const empty = decode(key, JSON.stringify({ version: 1, flatOptions: { colors: [], styles: [] }, categoryNodes: [] }))
  const noEmptyFlag = decode(key, JSON.stringify({ version: 1, options: [], categoryNodes: [] }))
  assert.equal(equalPcsRecordValues(empty[0], noEmptyFlag[0], empty, noEmptyFlag), false)
})

test('record assembly preserves current data and normalizes legacy references without mutating saved rows', () => {
  const key = 'higood-pcs-style-archive-store-v3'
  const data = Object.freeze({ styleId: 'style', productConfigRefs: Object.freeze({ styleCodes: Object.freeze(['styleCodes-89']), styles: Object.freeze(['styles-1']) }), notes: 'styleCodes is an old label, not a field' })
  const rows = [
    { id: `${key}/meta`, collection: key, value: { array: false, fields: { version: 3 }, groups: ['records'] }, version: 1 },
    { id: `${key}/records/style`, collection: `${key}/records`, value: Object.freeze({ position: 0, data }), version: 2 },
  ]
  const before = JSON.stringify(rows)
  const restored = JSON.parse(encode(key, rows)!)
  assert.deepEqual(restored.records[0].productConfigRefs, { categoryNumbers: ['styleCodes-89'], styles: ['styles-1'] })
  assert.equal(restored.records[0].notes, data.notes)
  assert.equal(JSON.stringify(rows), before)
  const current = decode(key, JSON.stringify(restored)).map(row => ({ ...row, version: 1 }))
  assert.deepEqual(JSON.parse(encode(key, current)!), restored)
  const escaped = normalizePcsRecordSnapshot(key, '{"records":[{"styleId":"escaped","productConfigRefs":{"style\\u0043odes":["old-id"]}}]}') as any
  assert.deepEqual(escaped.records[0].productConfigRefs, { categoryNumbers: ['old-id'] })
})

test('new shared WMS channel examples survive old catalog metadata, but explicit deletion still wins', async () => {
  const { isPcsNewStaticRecord } = await import('../src/data/pcs-record-static-versions.ts')
  const key = 'higood-pcs-channel-catalog-v1', id = 'channel-listing-wms-demo-1'
  const seed = JSON.stringify({ version: 1, listings: [{ id, styleId: 'style_r1_wms_tee' }], variants: [{ id: `${id}-variant-1`, internalSkuId: 'sku_r1_wms_tee_black_s' }], prices: [] })
  const old = decode(key, JSON.stringify({ version: 1, listings: [], variants: [], prices: [] })).map(row => ({ ...row, version: 1 }))
  assert.equal(JSON.parse(encode(key, old, seed, isPcsNewStaticRecord)!).listings.length, 1)
  const deleted = { id: `${key}/listings/${id}`, collection: `${key}/listings`, value: null, deleted: true, version: 1 }
  assert.equal(JSON.parse(encode(key, [...old, deleted], seed, isPcsNewStaticRecord)!).listings.length, 0)
})

test('record assembly can hydrate files in one serialization without changing durable row values', () => {
  const key = 'higood-pcs-style-archive-store-v3', seed = JSON.stringify({ records: [{ styleId: 'one', mainImageUrl: 'pcs-file:image' }] })
  const rows = decode(key, seed).map(row => ({ ...row, version: 1 })), before = JSON.stringify(rows)
  const result = encode(key, rows, undefined, undefined, value => JSON.stringify(value, (_key, child) => child === 'pcs-file:image' ? 'blob:preview' : child))
  assert.equal(JSON.parse(result!).records[0].mainImageUrl, 'blob:preview')
  assert.equal(JSON.stringify(rows), before)
})


test('October 6 shared route materials survive old snapshots without resurrecting deletions or replacing edits', async () => {
  const { isPcsNewStaticRecord } = await import('../src/data/pcs-record-static-versions.ts')
  const key = 'higood-pcs-material-archive-store-v2'
  const seed = JSON.stringify({ version: 2, records: [{ materialId: 'material-r1-MAT-FB-00000002' }], skuRecords: [{ materialSkuId: 'material-r1-MAT-FB-00000002-B01', colorName: 'White' }, { materialSkuId: 'material-r1-process-techpack-cn360-dye' }, { materialSkuId: 'old-omitted' }], processDefinitions: [{ processDefinitionId: 'process-material-r1-process-techpack-cn360-dye' }], assets: [{ assetId: 'material-r1-execution-techpack-cn360-dye-document' }], costVersions: [{ costVersionId: 'legacy-standard-material-r1-MAT-FB-00000002-B01' }] })
  const old = decode(key, JSON.stringify({ version: 2, records: [], skuRecords: [], processDefinitions: [], assets: [], costVersions: [] })).map(row => ({ ...row, version: 1 }))
  const assembled = JSON.parse(encode(key, old, seed, isPcsNewStaticRecord)!)
  assert.equal(assembled.records.length, 1)
  assert.equal(assembled.skuRecords.length, 2)
  assert.equal(assembled.assets.length, 1)
  const edited = decode(key, JSON.stringify({ version: 2, records: [], skuRecords: [{ materialSkuId: 'material-r1-MAT-FB-00000002-B01', colorName: 'User edited' }] })).map(row => ({ ...row, version: 1 }))
  const restored = JSON.parse(encode(key, edited, seed, isPcsNewStaticRecord)!)
  assert.equal(restored.skuRecords.find((row: any) => row.materialSkuId === 'material-r1-MAT-FB-00000002-B01').colorName, 'User edited')
  const deleted = { id: `${key}/skuRecords/material-r1-MAT-FB-00000002-B01`, collection: `${key}/skuRecords`, value: null, deleted: true, version: 1 }
  assert.equal(JSON.parse(encode(key, [...old, deleted], seed, isPcsNewStaticRecord)!).skuRecords.some((row: any) => row.materialSkuId === 'material-r1-MAT-FB-00000002-B01'), false)
})
