import assert from 'node:assert/strict'

import {
  createProjectChannelProductFromListingNode,
  getProjectChannelProductById,
  launchProjectChannelProductListing,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  listProjectImageAssets,
  resetProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { getProjectById, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const project = getProjectById('prj_20251216_015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const createResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '旧图片链接迁移批次',
    defaultPriceAmount: 209,
    currencyCode: 'IDR',
    mainImageUrls: ['mock://legacy-listing/main-image'],
    detailImageUrls: ['mock://legacy-listing/detail-image'],
    specLines: [{ colorName: '卡其', sizeName: 'M', priceAmount: 209, currencyCode: 'IDR' }],
  },
  '测试用户',
)

assert.equal(createResult.ok, true, '旧上架图片链接应允许迁移为正式图片资产')
assert.equal(createResult.record?.listingImages.length, 2, '旧主图和详情图应迁移为两张正式上架图片')
assert.ok(createResult.record?.listingMainImageId, '迁移后应回填正式主图编号')
assert.equal(createResult.record?.mainImageUrls[0], 'mock://legacy-listing/main-image', '旧主图链接应保留为派生展示')
assert.equal(createResult.record?.detailImageUrls[0], 'mock://legacy-listing/detail-image', '旧详情图链接应保留为派生展示')

const migratedAssets = listProjectImageAssets(project!.projectId).filter(
  (item) =>
    item.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING' &&
    item.sourceRecordId === createResult.record!.channelProductId,
)
assert.equal(migratedAssets.length, 2, '旧图片链接应迁移为两条项目图片资产')
assert.equal(migratedAssets.every((item) => item.imageType === '上架图'), true, '迁移后的图片资产类型应为上架图')
assert.equal(migratedAssets.every((item) => item.imageStatus === '可用于上架'), true, '迁移后的图片资产状态应为可用于上架')
assert.equal(
  migratedAssets.every((item) => item.usageScopes.includes('商品上架')),
  true,
  '迁移后的图片资产用途应包含商品上架',
)

const firstRead = getProjectChannelProductById(createResult.record!.channelProductId)
const secondRead = getProjectChannelProductById(createResult.record!.channelProductId)
assert.equal(firstRead?.listingImages.length, 2, '首次读取时应能看到正式上架图片')
assert.equal(secondRead?.listingImages.length, 2, '重复读取时不应重复生成图片引用')

const migratedAssetsAfterRead = listProjectImageAssets(project!.projectId).filter(
  (item) =>
    item.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING' &&
    item.sourceRecordId === createResult.record!.channelProductId,
)
assert.equal(migratedAssetsAfterRead.length, 2, '迁移逻辑应保持幂等，不重复生成项目图片资产')

const launchResult = launchProjectChannelProductListing(createResult.record!.channelProductId, '测试用户')
assert.equal(launchResult.ok, true, '迁移后的正式图片资产应可直接用于上传')

console.log('pcs-channel-listing-image-migration.spec.ts PASS')
