import test from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import { getSkuArchiveById } from '../src/data/pcs-sku-archive-repository.ts'
import { getStyleArchiveById } from '../src/data/pcs-style-archive-repository.ts'
import { renderPcsChannelProductListPage, handlePcsChannelProductListInput, buildChannelFilteredExport } from '../src/pages/pcs-channel-products.ts'
import { renderPcsChannelStoreSyncPage } from '../src/pages/pcs-channel-stores.ts'
import type { ChannelCatalogSnapshot } from '../src/data/pcs-channel-catalog-types.ts'

// Node 计算与 HTML 字符串生成预算；不包含浏览器 DOM、布局、图片或 IndexedDB，不能替代页面性能验收。
// 2026-10-06 用户确认统一为 1 秒，无例外；浏览器完整绘制另行验收。
const limit = 1000
const repeats = Math.max(1, Number(process.env.PCS_CHANNEL_PERF_REPEATS || 5))
const baseline = catalog.getPcsChannelCatalogSnapshot()
test('channel list projections retain price and mapping identities without sharing mutable catalog records', () => {
  const rows = catalog.getChannelCatalogListSnapshot()
  const listing = rows.listings[0], variant = rows.variants.find(v => v.listingId === listing.id)!
  const fullVariant = baseline.variants.find(v => v.id === variant.id)!
  const resolve = catalog.createChannelPriceResolver(rows)
  assert.deepEqual(resolve(variant), catalog.resolveChannelPrice(fullVariant))
  assert.equal(variant.internalSkuId, fullVariant.internalSkuId)
  assert.equal(variant.platformVariantId, fullVariant.platformVariantId)
  listing.content.title = 'list-only mutation'
  listing.content.media[0].url = 'list-only-image'
  variant.internalSkuId = 'list-only-sku'
  if (rows.prices.length) rows.prices[0].amount = 999999
  assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(), baseline, 'list callers cannot change persisted facts or draft inheritance')
  assert.equal('syncOperations' in rows, false)
  assert.equal('publishedContent' in listing, false)
  assert.equal('mappingHistory' in variant, false)
})
const source = baseline.listings.find(l => l.platformProductId && l.storeId === 'ST-001')!
const variants = baseline.variants.filter(v => v.listingId === source.id)
const fixture: ChannelCatalogSnapshot = { version: 1, listings: [], variants: [], prices: [], fieldBaselines: [], syncOperations: [], logs: [], orderReferences: [] }
for (let index = 0; index < 2_000; index++) {
  const id = `perf-listing-${index}`, listing = { ...structuredClone(source), id, platformProductId: `perf-pid-${index}`, content: { ...structuredClone(source.content), title: `性能演示商品 ${index}` } }
  fixture.listings.push(listing)
  for (let line = 0; line < 5; line++) {
    const variant = { ...structuredClone(variants[line % variants.length]), id: `${id}-variant-${line}`, listingId: id, platformVariantId: `perf-external-${index}-${line}`, sellerSku: `perf-seller-${index}-${line}` }
    fixture.variants.push(variant)
    fixture.prices.push({ id: `${variant.id}-regular`, storeId: listing.storeId, internalSkuId: variant.internalSkuId, externalVariantId: variant.id, priceType: 'regular', amount: 149000 + line * 1000, currency: 'IDR', mode: '覆盖', validFrom: '', validTo: '', origin: '演示', version: 1, updatedAt: listing.updatedAt })
    fixture.fieldBaselines.push({ id: `${variant.id}-price`, listingId: id, targetId: variant.id, field: 'price.regular', value: 149000 + line * 1000, version: 1, eventId: 'perf-baseline', updatedAt: listing.updatedAt })
  }
  fixture.syncOperations.push({ id: `${id}-sync`, listingId: id, targetVariantIds: [], action: '发布', direction: 'PCS→平台', fieldScope: ['title'], baseVersion: 1, submittedVersion: 1, sourceEventId: `${id}-event`, result: '成功', items: [{ targetId: id, field: 'title', submittedValue: listing.content.title, baseValue: listing.content.title, fieldVersion: 1, result: '成功', error: '' }], conflicts: [], errorReason: '', startedAt: listing.updatedAt, completedAt: listing.updatedAt, parentOperationId: '', demo: true, attempt: 1, processedEventIds: [] })
}
const fixtureRaw = JSON.stringify(fixture)
const sku = getSkuArchiveById(variants[0].internalSkuId)!, style = getStyleArchiveById(source.styleId)!
const importRows = (count: number, samePid = false): catalog.ChannelImportRow[] => Array.from({ length: count }, (_, index) => ({ storeId: 'ST-001', styleCode: style.styleCode, internalSkuCode: sku.skuCode, platformProductId: `import-pid-${samePid ? 'one' : index}`, platformVariantId: `import-external-${index}`, sellerSku: sku.skuCode, title: samePid ? '同款多平台规格' : `导入商品 ${index}`, price: 149000 }))
function install() { pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, fixtureRaw); catalog.resetPcsChannelCatalogCache() }
function measure(label: string, fn: () => unknown) {
  const values: number[] = []
  for (let index = 0; index < repeats; index++) { const start = performance.now(); fn(); values.push(performance.now() - start) }
  const sorted = values.slice().sort((a, b) => a - b), maximum = Math.max(...values), p95 = sorted[Math.ceil(sorted.length * .95) - 1]
  console.log(`PCS_CHANNEL_PERF ${JSON.stringify({ label, pid: 2000, variants: 10000, samples: repeats, valuesMs: values.map(v => +v.toFixed(2)), p95Ms: +p95.toFixed(2), maxMs: +maximum.toFixed(2), budgetMs: limit, scope: 'Node only' })}`)
  assert.ok(maximum <= limit, `${label} ${maximum.toFixed(2)} ms > ${limit} ms（Node 预算）`)
}

test('PERF channel 2000 PID / 10000 platform variants: scoped reads and list rendering', async () => {
  install()
  assert.equal(fixture.listings.length, 2000); assert.equal(fixture.variants.length, 10000)
  try {
    measure('cold-list-query', () => { catalog.resetPcsChannelCatalogCache(); assert.equal(catalog.listChannelListings().length, 2000) })
    measure('warm-list-query', () => assert.equal(catalog.listChannelListings().length, 2000))
    measure('variant-and-price-read', () => { const rows = catalog.listChannelVariants('perf-listing-1999'); assert.equal(rows.length, 5); assert.equal(catalog.resolveChannelPrice(rows[4]).amount, 153000) })
    measure('list-html-render-20', () => { const html = renderPcsChannelProductListPage(); assert.ok(html.includes('渠道商品（2000）')); assert.ok(html.includes('perf-pid-0')); assert.equal((html.match(/data-pcs-channel-product-list-action="select"/g) || []).length, 20) })
    measure('export-all-2000-PID-10000-variants', () => { const result = buildChannelFilteredExport(); assert.equal(result.listingCount, 2000); assert.equal(result.variantCount, 10000); assert.ok(result.csv.includes('perf-external-1999-4')); assert.ok(result.csv.includes('153000')) })
    measure('sync-workbench-html-20', () => { const html = renderPcsChannelStoreSyncPage(); assert.ok(html.includes('同步操作（2000）')); assert.ok(html.includes('第 1 / 100 页')); assert.equal((html.match(/data-pcs-channel-store-action="sync-detail"/g) || []).length, 20) })
    const node = { dataset: { pcsChannelProductListField: 'keyword' }, value: 'perf-external-1999-4', closest() { return this } } as unknown as Element
    await handlePcsChannelProductListInput(node)
    measure('platform-variant-filter-html', () => { const html = renderPcsChannelProductListPage(); assert.ok(html.includes('渠道商品（1）')); assert.ok(html.includes('perf-pid-1999')); assert.match(html, /当前 PID 容器<\/span>\s*<strong[^>]*>1<\/strong>/, '统计和导出使用同一个筛选范围') })
    const filteredExport=buildChannelFilteredExport();assert.equal(filteredExport.listingCount,1);assert.equal(filteredExport.variantCount,5);assert.ok(!filteredExport.csv.includes('perf-external-1998-'))
    ;(node as unknown as { value: string }).value = ''
    await handlePcsChannelProductListInput(node)
  } finally { pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, JSON.stringify(baseline)); catalog.resetPcsChannelCatalogCache() }
})

test('PERF import previews of 100 and 1000 rows against 2000 existing PIDs / 10000 variants', () => {
  install()
  try {
    for (const count of [100, 1000]) {
      const rows = importRows(count)
      measure(`import-preview-${count}`, () => { const preview = catalog.previewChannelImport(rows); assert.equal(preview.errors.length, 0); assert.equal(preview.groups.size, count) })
    }
    const repeated = importRows(1000, true)
    measure('import-preview-1000-same-PID', () => { const preview = catalog.previewChannelImport(repeated); assert.equal(preview.errors.length, 0); assert.equal(preview.groups.size, 1); assert.equal([...preview.groups.values()][0].length, 1000) })
    assert.equal(pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY), fixtureRaw, '预览必须不落业务数据')
  } finally { pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, JSON.stringify(baseline)); catalog.resetPcsChannelCatalogCache() }
})
