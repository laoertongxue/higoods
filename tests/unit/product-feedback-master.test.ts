import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { menusBySystem } from '../../src/data/app-shell-config.ts'
import type { ChannelCatalogSnapshot, ChannelStoreSnapshot } from '../../src/data/pcs-channel-catalog-types.ts'
import { isPcsNewStaticRecord } from '../../src/data/pcs-record-static-versions.ts'

const baseline = JSON.parse(readFileSync(new URL('../../src/data/generated/pcs-record-baseline.json', import.meta.url), 'utf8'))
const stores = (JSON.parse(baseline['higood-pcs-channel-store-v1']) as ChannelStoreSnapshot).stores
const catalog = JSON.parse(baseline['higood-pcs-channel-catalog-v1']) as ChannelCatalogSnapshot
const styles = JSON.parse(baseline['higood-pcs-style-archive-store-v3']).records
const skus = JSON.parse(baseline['higood-pcs-sku-archive-store-v1']).records

test('A01 商品反馈七页处于系统设置前，不占用商品档案入口', () => {
  const items = menusBySystem.pcs.flatMap(group => group.items)
  const feedback = items.findIndex(item => item.key === 'pcs-menu-product-feedback')
  assert.ok(feedback > 0)
  assert.equal(items[feedback + 1].key, 'pcs-menu-settings')
  assert.deepEqual(items[feedback].children?.map(item => item.title), ['采集工作台', '采集记录', '评论明细', '商品评价汇总', '反馈分析', '共性问题', '问题跟进'])
})

test('A45 首批九店唯一身份、code、市场与时区引用共享档案', () => {
  const expected = ['IDLCD3W8X6', 'IDLC2XWXEM', 'IDLCNHWLC3', 'IDLCEXWXE6', 'IDLCLGLL62', 'IDLCWNWW6Q', 'IDLC7U2LWUA', 'IDLC6EW72S', 'IDLCHVWXRR']
  const initial = stores.filter(store => store.id.startsWith('ST-FB-'))
  assert.equal(initial.length, 9)
  assert.deepEqual(initial.map(store => store.externalStoreId), expected)
  for (const store of initial) {
    assert.equal(store.channelCode, 'tiktok'); assert.equal(store.marketCode, 'ID'); assert.equal(store.timeZone, 'Asia/Jakarta')
    assert.equal(stores.filter(other => other.channelCode === store.channelCode && other.externalStoreId === store.externalStoreId).length, 1)
    assert.ok(isPcsNewStaticRecord(`higood-pcs-channel-store-v1/stores/${store.id}`))
  }
})

test('A11/A12/A27 反馈链接、规格、真实商品图片无断链，同SKU可处于不同链接', () => {
  const listings = catalog.listings.filter(listing => listing.id.startsWith('channel-listing-feedback-'))
  assert.equal(listings.length, 10)
  for (const listing of listings) {
    assert.ok(stores.some(store => store.id === listing.storeId))
    const style = styles.find((row: { styleId: string }) => row.styleId === listing.styleId)
    assert.ok(style)
    const variants = catalog.variants.filter(variant => variant.listingId === listing.id)
    assert.equal(variants.length, 2)
    for (const variant of variants) {
      const sku = skus.find((row: { skuId: string }) => row.skuId === variant.internalSkuId)
      assert.equal(sku.styleId, style.styleId)
      assert.equal(variant.imageUrl, sku.skuImageUrl || style.mainImageUrl)
      if (variant.imageUrl.startsWith('/')) assert.ok(existsSync(new URL(`../../public${variant.imageUrl}`, import.meta.url)))
      assert.ok(catalog.prices.some(price => price.storeId === listing.storeId && price.internalSkuId === sku.skuId && price.priceType === 'regular' && Number(price.amount) > 0))
    }
    assert.ok(isPcsNewStaticRecord(`higood-pcs-channel-catalog-v1/listings/${listing.id}`))
  }
  const first = listings.find(row => row.id === 'channel-listing-feedback-1')!
  const alternate = listings.find(row => row.id === 'channel-listing-feedback-10')!
  assert.equal(first.storeId, alternate.storeId); assert.equal(first.styleId, alternate.styleId)
  assert.notEqual(first.platformProductId, alternate.platformProductId)
  assert.deepEqual(catalog.variants.filter(row => row.listingId === first.id).map(row => row.internalSkuId), catalog.variants.filter(row => row.listingId === alternate.id).map(row => row.internalSkuId))
  assert.equal(listings.find(row => row.id === 'channel-listing-feedback-9')?.platformStatus, '已下架')
})
