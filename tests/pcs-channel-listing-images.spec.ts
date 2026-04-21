import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import {
  createProjectChannelProductFromListingNode,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  getProjectImageAssetById,
  markProjectImageAssetUsableForListing,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { getProjectById, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const listingContract = getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING')
const listingFieldKeys = listingContract.fieldDefinitions.map((field) => field.fieldKey)

assert.ok(listingFieldKeys.includes('listingMainImageId'), '商品上架字段应包含上架主图')
assert.ok(listingFieldKeys.includes('listingImageIds'), '商品上架字段应包含上架图片集合')
assert.ok(listingFieldKeys.includes('listingImageSource'), '商品上架字段应包含图片来源')
assert.ok(listingFieldKeys.includes('listingImageConfirmedAt'), '商品上架字段应包含图片确认时间')
assert.ok(listingFieldKeys.includes('listingImageConfirmedBy'), '商品上架字段应包含图片确认人')
assert.ok(!listingFieldKeys.includes('mainImageUrls'), '商品上架字段定义不应再把主图 URL 作为主输入')
assert.ok(!listingFieldKeys.includes('detailImageUrls'), '商品上架字段定义不应再把详情图 URL 作为主输入')

const project = getProjectById('prj_20251216_015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const [referenceImage, supplementImage] = createProjectImageAssetRecords(
  project!,
  [
    {
      imageUrl: 'mock://listing-image/reference',
      imageName: '项目参考图一',
      imageType: '项目参考图',
      sourceNodeCode: 'PROJECT_INIT',
      sourceRecordId: project!.projectId,
      sourceType: '商品项目立项',
      usageScopes: ['立项参考', '项目资料归档'],
      imageStatus: '待确认',
      mainFlag: false,
      sortNo: 1,
    },
    {
      imageUrl: 'mock://listing-image/supplement',
      imageName: '上架补图一',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'listing-images-spec',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: false,
      sortNo: 2,
    },
  ],
  '测试用户',
  '2026-04-20T11:00:00.000Z',
)
upsertProjectImageAssets([referenceImage, supplementImage])

const markedReference = markProjectImageAssetUsableForListing(referenceImage.imageId, '测试用户', '2026-04-20T11:05:00.000Z')
assert.ok(markedReference, '项目参考图应允许人工确认可用于上架')
assert.equal(markedReference?.imageStatus, '可用于上架', '确认后项目参考图状态应变为可用于上架')
assert.equal(markedReference?.usageScopes.includes('商品上架'), true, '确认后项目参考图用途应增加商品上架')

const createResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '带图片的款式上架批次',
    defaultPriceAmount: 219,
    currencyCode: 'IDR',
    listingMainImageId: referenceImage.imageId,
    listingImageIds: [referenceImage.imageId, supplementImage.imageId],
    specLines: [
      { colorName: '奶白', sizeName: 'M', priceAmount: 219, currencyCode: 'IDR', stockQty: 10 },
      { colorName: '奶白', sizeName: 'L', priceAmount: 219, currencyCode: 'IDR', stockQty: 8 },
    ],
  },
  '测试用户',
)

assert.equal(createResult.ok, true, '补齐上架图片后应能创建款式上架批次')
assert.equal(createResult.record?.listingMainImageId, referenceImage.imageId, '上架批次应记录主图图片资产编号')
assert.deepEqual(
  createResult.record?.listingImageIds,
  [referenceImage.imageId, supplementImage.imageId],
  '上架批次应按排序记录图片资产编号',
)
assert.equal(createResult.record?.listingImages.length, 2, '上架批次应保存两张正式上架图片')
assert.equal(createResult.record?.listingImages[0]?.sourceType, '项目参考图', '项目参考图加入后应保留来源')
assert.equal(createResult.record?.listingImages[1]?.sourceType, '上架补充图', '上架补图加入后应保留来源')
assert.match(createResult.record?.listingImageSource || '', /项目参考图/, '图片来源说明应包含项目参考图')
assert.match(createResult.record?.listingImageSource || '', /上架补充图/, '图片来源说明应包含上架补充图')

const referenceAsset = getProjectImageAssetById(referenceImage.imageId)
const supplementAsset = getProjectImageAssetById(supplementImage.imageId)
assert.equal(referenceAsset?.imageStatus, '可用于上架', '项目参考图确认后应写回图片资产池')
assert.equal(supplementAsset?.imageStatus, '可用于上架', '上架补图应保持可用于上架状态')

console.log('pcs-channel-listing-images.spec.ts PASS')
