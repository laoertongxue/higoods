import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import { reviewChannelListing } from '../src/data/pcs-channel-catalog.ts'
import { submitChannelSync, receiveChannelReceipt, demoChannelReceipt } from '../src/data/pcs-channel-sync.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { createProjectChannelProductFromListingNode } from '../src/data/pcs-channel-product-project-repository.ts'
import { renderPcsChannelProductListPage, renderPcsChannelProductDetailPage, renderPcsChannelProductEditPage } from '../src/pages/pcs-channel-products.ts'

// R1 替代旧“项目上架节点”静态契约，验证独立 PID 容器与规格映射。
const types = readFileSync('src/data/pcs-channel-catalog-types.ts', 'utf8')
const listingType = types.match(/export interface ChannelListing \{[\s\S]*?\n\}/)?.[0] || ''
const variantType = types.match(/export interface ChannelVariant \{[\s\S]*?\n\}/)?.[0] || ''
assert.ok(listingType && variantType, '须存在独立刊登与外部规格契约')
assert.ok(!/projectId|projectCode|projectName|projectNodeId|stockQty/.test(listingType + variantType), '渠道身份不得绑定开发项目或手工库存')
assert.ok(!existsSync('src/data/pcs-channel-listing-spec-utils.ts'), '已退休的内部身份拼造平台 ID 工具不得复活')
const original = pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY)
const before = catalog.getPcsChannelCatalogSnapshot()
try {
  const internalSkuId = 'sku_r1_wms_tee_black_s', styleId = 'style_r1_wms_tee'
  const first = catalog.createChannelListing({ storeId: 'ST-001', styleId, internalSkuIds: [internalSkuId, internalSkuId], initialPrice: 149000 })
  const second = catalog.createChannelListing({ storeId: 'ST-001', styleId, internalSkuIds: [internalSkuId], initialPrice: 149000 })
  assert.notEqual(first.id, second.id, '同款同店允许多个 PID 容器')
  const variants = catalog.listChannelVariants(first.id)
  assert.equal(variants.length, 2); assert.notEqual(variants[0].id, variants[1].id)
  assert.equal(variants[0].internalSkuId, variants[1].internalSkuId)
  assert.ok(variants.every(row => !row.platformVariantId), '平台规格 ID 不能在本地新建时拼造')
  const foreign = listSkuArchives().find(row => row.styleId !== styleId && catalog.isChannelSkuSelectable(row))!
  assert.throws(() => catalog.addChannelVariant(first.id, foreign.skuId), /同一款式/)
  reviewChannelListing(first.id, '提交审核'); reviewChannelListing(first.id, '审核通过')
  const operation = submitChannelSync(first.id, '发布')
  assert.equal(catalog.getChannelListing(first.id)!.platformProductId, '')
  assert.equal(operation.result, '提交中')
  receiveChannelReceipt(demoChannelReceipt(operation.id))
  assert.equal(catalog.getChannelListing(first.id)!.platformStatus, '在售')
  assert.equal(new Set(catalog.listChannelVariants(first.id).map(row => row.platformVariantId)).size, 2)
  assert.equal(createProjectChannelProductFromListingNode('PRJ-008').ok, false, '旧项目新建入口已退役')
  assert.equal(catalog.getPcsChannelCatalogSnapshot().listings.length, before.listings.length + 2)
  const list = renderPcsChannelProductListPage(), detail = renderPcsChannelProductDetailPage(first.id), edit = renderPcsChannelProductEditPage(first.id)
  assert.ok(!list.includes('data-pcs-channel-product-list-field="content.title"'), '列表不能平铺编辑表单')
  for (const label of ['渠道内容', '规格映射', '价格', '发布与同步', '测款关联', '记录']) assert.ok(detail.includes(label), `详情缺少 ${label} Tab`)
  assert.ok(edit.includes('保存修改'), '编辑应有独立保存动作')
} finally {
  if (original === null) pcsRecordStore.removeItem(catalog.PCS_CHANNEL_CATALOG_KEY); else pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, original)
  catalog.resetPcsChannelCatalogCache()
}
console.log('check-pcs-channel-listing-style-specs.ts PASS (R1 CHAN-004/005/014, receipt identity and separate pages)')
