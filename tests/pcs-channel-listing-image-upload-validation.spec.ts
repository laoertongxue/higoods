import assert from 'node:assert/strict'

import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import { validateChannelListingImagesForUpload } from '../src/data/pcs-channel-listing-image-utils.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
  getProjectImageAssetById,
} from '../src/data/pcs-project-image-repository.ts'
import { getProjectById, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const project = getProjectById('prj_20251216_015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')
const secondProject = getProjectById('prj_20251216_022')
assert.ok(secondProject, '应存在 PRJ-20251216-022 演示项目')

const noImageResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '无图片批次',
    defaultPriceAmount: 229,
    currencyCode: 'IDR',
    specLines: [{ colorName: '黑色', sizeName: 'M', priceAmount: 229, currencyCode: 'IDR' }],
  },
  '测试用户',
)
assert.equal(noImageResult.ok, true, '创建批次时允许暂不选择图片')

const noImageLaunch = launchProjectChannelProductListing(noImageResult.record!.channelProductId, '测试用户')
assert.equal(noImageLaunch.ok, false, '没有上架图片时不应允许上传')
assert.match(noImageLaunch.message, /请先选择或上传上架图片/, '没有图片时应明确提示先补齐上架图片')

const [referenceImage] = createProjectImageAssetRecords(
  secondProject!,
  [
    {
      imageUrl: 'mock://listing-image/unconfirmed',
      imageName: '未确认参考图',
      imageType: '项目参考图',
      sourceNodeCode: 'PROJECT_INIT',
      sourceRecordId: secondProject!.projectId,
      sourceType: '商品项目立项',
      usageScopes: ['立项参考', '项目资料归档'],
      imageStatus: '待确认',
      mainFlag: false,
      sortNo: 1,
    },
  ],
  '测试用户',
  '2026-04-20T11:10:00.000Z',
)
upsertProjectImageAssets([referenceImage])

const unconfirmedImageResult = createProjectChannelProductFromListingNode(
  secondProject!.projectId,
  {
    targetChannelCode: 'shopee',
    targetStoreId: 'store-shopee-01',
    listingTitle: '未确认图片批次',
    defaultPriceAmount: 229,
    currencyCode: 'IDR',
    listingMainImageId: referenceImage.imageId,
    listingImageIds: [referenceImage.imageId],
    specLines: [{ colorName: '黑色', sizeName: 'L', priceAmount: 229, currencyCode: 'IDR' }],
  },
  '测试用户',
)
assert.equal(unconfirmedImageResult.ok, true, '未确认图片仍可先创建批次')

const unconfirmedLaunch = launchProjectChannelProductListing(unconfirmedImageResult.record!.channelProductId, '测试用户')
assert.equal(unconfirmedLaunch.ok, false, '未确认用途的图片不应允许上传')
assert.match(unconfirmedLaunch.message, /请确认图片可用于商品上架/, '未确认用途时应明确提示先确认图片可用于上架')

const [listingImage] = createProjectImageAssetRecords(
  project!,
  [
    {
      imageUrl: 'mock://listing-image/no-main',
      imageName: '缺少主图测试图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'no-main-check',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: false,
      sortNo: 1,
    },
  ],
  '测试用户',
  '2026-04-20T11:20:00.000Z',
)
upsertProjectImageAssets([listingImage])

const noMainMessage = validateChannelListingImagesForUpload({
  listingImages: [
    {
      listingImageId: 'manual-check-01',
      listingBatchId: 'manual-batch',
      imageId: listingImage.imageId,
      imageUrl: listingImage.imageUrl,
      imageName: listingImage.imageName,
      sourceType: '上架补充图',
      sortNo: 1,
      mainFlag: false,
    },
  ],
  listingMainImageId: '',
  getImageAssetById: getProjectImageAssetById,
})
assert.equal(noMainMessage, '请设置上架主图。', '缺少主图时应明确提示先设置上架主图')

console.log('pcs-channel-listing-image-upload-validation.spec.ts PASS')
