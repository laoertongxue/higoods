import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import * as sync from '../src/data/pcs-channel-sync.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'

const baseline = catalog.getPcsChannelCatalogSnapshot()
const styleId = 'style_r1_wms_tee', internalSkuId = 'sku_r1_wms_tee_black_s'
beforeEach(() => { pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, JSON.stringify(baseline)); catalog.resetPcsChannelCatalogCache() })
function create(storeId = 'ST-001', count = 2) { return catalog.createChannelListing({ storeId, styleId, internalSkuIds: Array(count).fill(internalSkuId), initialPrice: 149000, content: { title: '同款多个独立刊登' } }) }
function publish(id: string) {
  catalog.reviewChannelListing(id, '提交审核'); catalog.reviewChannelListing(id, '审核通过')
  const operation = sync.submitChannelSync(id, '发布'), receipt = sync.demoChannelReceipt(operation.id)
  assert.equal(sync.receiveChannelReceipt(receipt).result, '成功')
  return catalog.getChannelListing(id)!
}

test('R1 one current store allows multiple PIDs of the same SPU, each with multiple external instances of one internal SKU', () => {
  const first = create(), second = create(), anotherStore = create('ST-007', 1)
  assert.notEqual(first.id, second.id); assert.equal(first.platformProductId, ''); assert.equal(second.platformProductId, '')
  const published = [first, second, anotherStore].map(item => publish(item.id))
  assert.equal(new Set(published.map(item => item.platformProductId)).size, 3)
  for (const listing of published) {
    const variants = catalog.listChannelVariants(listing.id)
    assert.equal(listing.styleId, styleId); assert.equal(new Set(variants.map(item => item.internalSkuId)).size, 1)
    assert.equal(new Set(variants.map(item => item.platformVariantId)).size, variants.length)
    assert.ok(variants.every(item => item.internalSkuId === internalSkuId && item.platformVariantId && !item.platformVariantId.includes(internalSkuId)))
  }
  const reverse = catalog.listChannelMappingsBySkuId(internalSkuId)
  for (const listing of published) assert.ok(reverse.some(item => item.listingId === listing.id), '内部 SKU 能反查每个 PID 的平台实例')
})

test('R1 same-store default prices are shared across PIDs, external-instance overrides remain independent', () => {
  const first = create(), second = create(), rows = [...catalog.listChannelVariants(first.id), ...catalog.listChannelVariants(second.id)]
  const price = { storeId: 'ST-001', internalSkuId, priceType: 'regular' as const, validFrom: '', validTo: '' }
  catalog.saveChannelPrice({ ...price, externalVariantId: '', amount: 149000 })
  assert.deepEqual(rows.map(row => catalog.resolveChannelPrice(row).amount), [149000, 149000, 149000, 149000])
  catalog.saveChannelPrice({ ...price, externalVariantId: rows[1].id, amount: 159000 })
  catalog.saveChannelPrice({ ...price, externalVariantId: '', amount: 169000 })
  assert.deepEqual(rows.map(row => catalog.resolveChannelPrice(row).amount), [169000, 159000, 169000, 169000])
  assert.equal(catalog.resolveChannelPrice(rows[1]).mode, '独立覆盖')
  catalog.followChannelDefaultPrice(rows[1].id, 'regular')
  assert.deepEqual(rows.map(row => catalog.resolveChannelPrice(row).amount), [169000, 169000, 169000, 169000])
})

test('R1 cardinality never relaxes the single-SPU rule, current operating scope or external identity constraints', () => {
  const otherSku = listSkuArchives().find(item => item.styleId !== styleId && catalog.isChannelSkuSelectable(item))!
  assert.ok(otherSku)
  const before = catalog.getPcsChannelCatalogSnapshot()
  assert.throws(() => catalog.createChannelListing({ storeId: 'ST-001', styleId, internalSkuIds: [internalSkuId, otherSku.skuId], initialPrice: 149000 }), /当前款式/)
  assert.throws(() => create('ST-002'), /当前启用/); assert.throws(() => create('ST-003'), /当前启用/)
  assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(), before)
  const listing = publish(create().id), row = catalog.listChannelVariants(listing.id)[0]
  assert.throws(() => catalog.saveChannelVariant({ ...row, internalSkuId: otherSku.skuId }, row.version, '测试', '跨款错误'), /同一款式/)
  assert.throws(() => catalog.saveChannelVariant({ ...row, platformVariantId: 'manually-forged-id' }, row.version), /平台回执/)
  assert.equal(catalog.listChannelVariants(listing.id)[0].internalSkuId, internalSkuId)
  assert.equal(catalog.listChannelVariants(listing.id)[0].platformVariantId, row.platformVariantId)
})
