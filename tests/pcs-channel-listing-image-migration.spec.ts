import test from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import { getPcsChannelStoreSnapshot } from '../src/data/pcs-channel-store-repository.ts'
import { convertLegacyChannelSnapshot } from '../src/data/pcs-channel-legacy-conversion.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { listProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'
import { getProjectChannelProductById } from '../src/data/pcs-channel-product-project-repository.ts'

// R1: 旧媒体承接为刊登自己的媒体引用，不在普通读取中生成项目资产。
const baseline = catalog.getPcsChannelCatalogSnapshot(), stores = getPcsChannelStoreSnapshot()
const sku = listSkuArchives().find(item => item.skuId === 'sku_r1_wms_tee_black_s')!
const style = listStyleArchives().find(item => item.styleId === sku.styleId)!
const source = {
  channelProductId: 'legacy-image-listing', storeId: 'store-tiktok-01', channelCode: 'tiktok', styleId: style.styleId,
  listingTitle: '历史媒体承接', upstreamProductId: '09999999999999999999999', listingPrice: 149000,
  specLines: [{ specLineId: 'external-black-s', internalSkuId: sku.skuId, upstreamSkuId: '08888888888888888888888', sellerSku: sku.skuCode, priceAmount: 149000 }],
}
function convert(records: unknown[], target = baseline) { return convertLegacyChannelSnapshot({ records }, stores, target, listSkuArchives(), listStyleArchives()) }

test('R1 legacy URL conversion is pure, preserves main/detail roles and is repeatable without writes', () => {
  const raw = { records: [{ ...source, mainImageUrls: [style.mainImageUrl, `${style.mainImageUrl}?view=back`], detailImageUrls: [`${style.mainImageUrl}?view=detail`] }] }
  const before = JSON.stringify(raw), originalStore = JSON.stringify(stores), originalCatalog = JSON.stringify(baseline)
  const originalWriter = pcsRecordStore.setItem, images = listProjectImageAssets('PRJ-008')
  let writes = 0
  try {
    pcsRecordStore.setItem = (...args) => { writes++; return originalWriter(...args) }
    const converted = convertLegacyChannelSnapshot(raw, stores, baseline, listSkuArchives(), listStyleArchives())
    const listing = converted.catalogSnapshot.listings.find(item => item.id === source.channelProductId)!
    assert.deepEqual(listing.content.media.map(image => [image.url, image.role, image.sort]), [
      [style.mainImageUrl, '主图', 1], [`${style.mainImageUrl}?view=back`, '主图', 2], [`${style.mainImageUrl}?view=detail`, '详情图', 3],
    ])
    assert.equal(listing.platformProductId, source.upstreamProductId)
    assert.equal(converted.catalogSnapshot.variants.find(item => item.listingId === listing.id)!.platformVariantId, source.specLines[0].upstreamSkuId)
    const repeat = convertLegacyChannelSnapshot(raw, converted.storeSnapshot, converted.catalogSnapshot, listSkuArchives(), listStyleArchives())
    assert.deepEqual(repeat.counts, { listings: 0, variants: 0, stores: 0 }); assert.deepEqual(repeat.catalogSnapshot, converted.catalogSnapshot)
    assert.equal(writes, 0); assert.deepEqual(listProjectImageAssets('PRJ-008'), images)
  } finally { pcsRecordStore.setItem = originalWriter }
  assert.equal(JSON.stringify(raw), before); assert.equal(JSON.stringify(stores), originalStore); assert.equal(JSON.stringify(baseline), originalCatalog)
})

test('R1 legacy media keeps explicit main identity, order and file references instead of assigning first row', () => {
  const converted = convert([{ ...source, listingMainImageId: 'legacy-main', listingImages: [
    { imageId: 'legacy-detail', imageUrl: `${style.mainImageUrl}?detail=1`, imageName: '细节', sortNo: 2, mainFlag: false },
    { imageId: 'legacy-main', imageUrl: style.mainImageUrl, imageName: '主图', sortNo: 1, mainFlag: true, fileId: 'retained-file-reference' },
  ] }])
  const listing = converted.catalogSnapshot.listings.find(item => item.id === source.channelProductId)!
  assert.deepEqual(listing.content.media.map(image => [image.id, image.role, image.sort]), [['legacy-main', '主图', 1], ['legacy-detail', '详情图', 2]])
  assert.equal(listing.content.media[0].fileId, 'retained-file-reference', '复用旧文件引用，不复制文件字节')
  const raw = pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY)
  try {
    pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, JSON.stringify(converted.catalogSnapshot)); catalog.resetPcsChannelCatalogCache()
    const installed = pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY)
    const first = getProjectChannelProductById(source.channelProductId)!, second = getProjectChannelProductById(source.channelProductId)!
    assert.deepEqual(first.listingImages, second.listingImages)
    assert.equal(first.listingMainImageId, 'legacy-main'); assert.equal(first.listingImages.length, 2)
    assert.deepEqual(first.listingImages.map(image => [image.imageId, image.mainFlag]), [['legacy-main', true], ['legacy-detail', false]])
    assert.equal(pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY), installed, '重复读取不重复转换、不落盘')
  } finally {
    if (raw === null) pcsRecordStore.removeItem(catalog.PCS_CHANNEL_CATALOG_KEY); else pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, raw)
    catalog.resetPcsChannelCatalogCache()
  }
})

test('R1 a legacy row without a confirmed internal mapping aborts conversion and preserves inputs', () => {
  const raw = [{ ...source, mainImageUrls: [style.mainImageUrl] }, { ...source, channelProductId: 'unmapped-legacy', styleId: '', specLines: [{ sellerSku: 'missing-sku', upstreamSkuId: 'external-missing' }] }]
  const before = JSON.stringify(raw), target = JSON.stringify(baseline)
  assert.throws(() => convert(raw), /未匹配内部 SKU/)
  assert.equal(JSON.stringify(raw), before); assert.equal(JSON.stringify(baseline), target, '前一条合法记录也不部分写入目标快照')
})
