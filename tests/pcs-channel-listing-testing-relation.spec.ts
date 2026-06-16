import assert from 'node:assert/strict'

import {
  createProjectChannelProductFromListingNode,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { getLatestSampleCostReviewSalesPrice } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { getDefaultPcsStoreIdByChannel } from '../src/data/pcs-channel-store-master.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const project = listProjects().find((item) => {
  const listingNode = getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'CHANNEL_PRODUCT_LISTING')
  const liveTestNode = getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'LIVE_TEST')
  return (
    listingNode &&
    listingNode.currentStatus !== '未开始' &&
    liveTestNode &&
    liveTestNode.currentStatus !== '未开始' &&
    ['PHASE_03', 'PHASE_04', 'PHASE_05'].includes(item.currentPhaseCode) &&
    getLatestSampleCostReviewSalesPrice(item.projectId)
  )
})
assert.ok(project, '应存在已进入商品上架且具备样衣核价销售价的演示项目')
const sampleCostReviewPrice = getLatestSampleCostReviewSalesPrice(project!.projectId)
assert.ok(sampleCostReviewPrice, '演示项目应存在样衣核价销售价')
const targetChannelCode = project!.targetChannelCodes[0] || 'TIKTOK_ID'
const targetStoreId = getDefaultPcsStoreIdByChannel(targetChannelCode)
assert.ok(targetStoreId, '应存在目标渠道默认店铺')

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

const sampleCostReviewNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'SAMPLE_COST_REVIEW')
assert.ok(sampleCostReviewNode, '应存在样衣核价节点')

const costReviewResult = saveProjectNodeFormalRecord({
  projectId: project!.projectId,
  projectNodeId: sampleCostReviewNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 12:10',
    values: {
      spuCode: 'SPU-TEST-RELATION',
      productName: '待测款上架批次',
      buyerName: '测试用户',
      brandName: 'HiGood 测试',
      garmentCategory: '梭织',
      exchangeRate: 2200,
      materialCostCny: 72,
      dyeingCostCny: 10,
      auxiliaryCostAmount: 18,
      auxiliaryCostCurrency: 'RMB',
      auxiliaryCostCny: 18,
      fixedProcessCostCny: 28,
      sewingCostAmount: 42,
      sewingCostCurrency: 'RMB',
      sewingCostCny: 42,
      optionalProcessCostCny: 18,
      costTotal: 188,
      salesPrice: sampleCostReviewPrice!.salesPrice,
      salesCurrency: sampleCostReviewPrice!.salesCurrency,
      grossMarginRate: 21.34,
      reviewStatus: '待复核',
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
    targetChannelCode,
    targetStoreId: targetStoreId!,
    listingTitle: '待测款上架批次',
    defaultPriceAmount: 239,
    currencyCode: 'IDR',
    listingMainImageId: listingImage.imageId,
    listingImageIds: [listingImage.imageId],
    specLines: [
      { productImageId: listingImage.imageId, colorName: '奶白', sizeName: 'M', priceAmount: 239, currencyCode: 'IDR', stockQty: 9 },
      { productImageId: listingImage.imageId, colorName: '奶白', sizeName: 'L', priceAmount: 239, currencyCode: 'IDR', stockQty: 7 },
    ],
  },
  '测试用户',
)
assert.equal(createResult.ok, true, '应能创建商品上架批次')
assert.equal(createResult.record?.defaultPriceAmount, sampleCostReviewPrice!.salesPrice, '商品上架默认售价应继承样衣核价销售价格')
assert.equal(createResult.record?.currencyCode, sampleCostReviewPrice!.salesCurrency, '商品上架币种应继承样衣核价销售币种')
assert.deepEqual(
  createResult.record?.specLines.map((item) => `${item.priceAmount}/${item.currencyCode}`),
  [
    `${sampleCostReviewPrice!.salesPrice}/${sampleCostReviewPrice!.salesCurrency}`,
    `${sampleCostReviewPrice!.salesPrice}/${sampleCostReviewPrice!.salesCurrency}`,
  ],
  '商品上架规格价格应继承样衣核价销售价格',
)

console.log('pcs-channel-listing-testing-relation.spec.ts PASS')
