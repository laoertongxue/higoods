import assert from 'node:assert/strict'

import {
  createProjectChannelProductFromListingNode,
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
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectById,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { buildLiveProductLineProjectRelation } from '../src/data/pcs-testing-relation-normalizer.ts'
import { getLiveProductLineById } from '../src/data/pcs-live-testing-repository.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const project = getProjectById('prj_20251216_004')
assert.ok(project, '应存在 PRJ-20251216-004 演示项目')

const [listingImage] = createProjectImageAssetRecords(
  project!,
  [
    {
      imageUrl: 'mock://listing-image/testing-relation',
      imageName: '测款关系测试主图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'test-testing-relation',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
  ],
  '测试用户',
  '2026-04-20T10:10:00.000Z',
)
upsertProjectImageAssets([listingImage])

const sampleConfirmNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'SAMPLE_CONFIRM')
const sampleCostReviewNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'SAMPLE_COST_REVIEW')
assert.ok(sampleConfirmNode, '应存在样衣确认节点')
assert.ok(sampleCostReviewNode, '应存在样衣核价节点')

const confirmResult = saveProjectNodeFormalRecord({
  projectId: project!.projectId,
  projectNodeId: sampleConfirmNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 12:00',
    values: {
      confirmResult: '通过',
      confirmNote: '进入商品上架。',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})
assert.equal(confirmResult.ok, true, '应能先完成样衣确认')

const costReviewResult = saveProjectNodeFormalRecord({
  projectId: project!.projectId,
  projectNodeId: sampleCostReviewNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 12:10',
    values: {
      costTotal: 188,
      costNote: '已完成样衣核价。',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})
assert.equal(costReviewResult.ok, true, '应能完成样衣核价并进入商品上架')

const createResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '待测款上架批次',
    defaultPriceAmount: 239,
    currencyCode: 'IDR',
    listingMainImageId: listingImage.imageId,
    listingImageIds: [listingImage.imageId],
    specLines: [
      { colorName: '奶白', sizeName: 'M', priceAmount: 239, currencyCode: 'IDR', stockQty: 9 },
      { colorName: '奶白', sizeName: 'L', priceAmount: 239, currencyCode: 'IDR', stockQty: 7 },
    ],
  },
  '测试用户',
)
assert.equal(createResult.ok, true, '应能创建商品上架批次')

const line = getLiveProductLineById('LS-20260331-017__item-001')
assert.ok(line, '应存在可用于关系校验的直播商品明细')

const beforeUploadRelation = buildLiveProductLineProjectRelation(line!, project!.projectId, {
  operatorName: '测试用户',
})
assert.equal(beforeUploadRelation.relation, null, '未完成商品上架前不应建立正式测款关系')
assert.match(beforeUploadRelation.errorMessage || '', /未完成商品上架/, '未完成商品上架前应明确提示')

const launchResult = launchProjectChannelProductListing(createResult.record!.channelProductId, '测试用户')
assert.equal(launchResult.ok, true, '应能上传款式到渠道')

const afterUploadRelation = buildLiveProductLineProjectRelation(line!, project!.projectId, {
  operatorName: '测试用户',
})
assert.equal(afterUploadRelation.relation, null, '已上传待确认但未完成时仍不应建立正式测款关系')
assert.match(afterUploadRelation.errorMessage || '', /未完成商品上架/, '上传后未完成时仍应明确提示')

const completeResult = markProjectChannelProductListingCompleted(createResult.record!.channelProductId, '测试用户')
assert.equal(completeResult.ok, true, '上传后应能标记商品上架完成')

const afterCompleteRelation = buildLiveProductLineProjectRelation(line!, project!.projectId, {
  operatorName: '测试用户',
})
assert.ok(afterCompleteRelation.relation, '商品上架完成后应允许建立正式测款关系')

console.log('pcs-channel-listing-testing-relation.spec.ts PASS')
