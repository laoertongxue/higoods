import assert from 'node:assert/strict'

import {
  createProjectChannelProductFromListingNode,
  getProjectChannelProductById,
  launchProjectChannelProductListing,
  markProjectChannelProductListingCompleted,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const project = getProjectById('prj_20251216_015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const [listingImage] = createProjectImageAssetRecords(
  project!,
  [
    {
      imageUrl: 'mock://listing-image/upload-complete',
      imageName: '上传完成测试主图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'test-upload-complete',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
  ],
  '测试用户',
  '2026-04-20T10:00:00.000Z',
)
upsertProjectImageAssets([listingImage])

const createResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '上传并确认完成的多规格批次',
    defaultPriceAmount: 219,
    currencyCode: 'IDR',
    listingMainImageId: listingImage.imageId,
    listingImageIds: [listingImage.imageId],
    specLines: [
      { colorName: '米白', sizeName: 'M', priceAmount: 219, currencyCode: 'IDR', stockQty: 10 },
      { colorName: '米白', sizeName: 'L', priceAmount: 219, currencyCode: 'IDR', stockQty: 8 },
    ],
  },
  '测试用户',
)

assert.equal(createResult.ok, true, '应能创建新的款式上架批次')
assert.ok(createResult.record, '创建成功后应返回批次记录')

const completeBeforeUpload = markProjectChannelProductListingCompleted(createResult.record!.channelProductId, '测试用户')
assert.equal(completeBeforeUpload.ok, false, '上传前不应允许直接标记完成')
assert.match(completeBeforeUpload.message, /尚未成功上传到渠道/, '上传前应提示不能标记完成')

const launchResult = launchProjectChannelProductListing(createResult.record!.channelProductId, '测试用户')
assert.equal(launchResult.ok, true, '规格完整时应允许上传款式到渠道')
assert.ok(launchResult.record?.upstreamProductId, '上传成功后应回填上游款式商品编号')
assert.equal(
  launchResult.record?.specLines.every((item) => Boolean(item.upstreamSkuId)),
  true,
  '上传成功后每条规格都应回填上游规格编号',
)

const listingNodeAfterUpload = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.equal(listingNodeAfterUpload?.currentStatus, '进行中', '上传成功后商品上架节点仍应保持进行中')

const uploadedRecord = getProjectChannelProductById(createResult.record!.channelProductId)
assert.equal(uploadedRecord?.listingBatchStatus, '已上传待确认', '上传成功后批次应进入已上传待确认')

const completeResult = markProjectChannelProductListingCompleted(createResult.record!.channelProductId, '测试用户')
assert.equal(completeResult.ok, true, '上传成功后应允许标记商品上架完成')

const completedRecord = getProjectChannelProductById(createResult.record!.channelProductId)
assert.equal(completedRecord?.listingBatchStatus, '已完成', '标记完成后批次状态应为已完成')
assert.equal(completedRecord?.channelProductStatus, '已上架待测款', '标记完成后应进入已上架待测款状态')

const listingNodeAfterComplete = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.equal(listingNodeAfterComplete?.currentStatus, '已完成', '标记完成后商品上架节点应写为已完成')

const projectAfterComplete = getProjectById(project!.projectId)
assert.equal(projectAfterComplete?.nextWorkItemName, '改版任务', '商品上架完成后应按模板顺序进入下一个工作项')

console.log('pcs-channel-listing-upload-complete.spec.ts PASS')
