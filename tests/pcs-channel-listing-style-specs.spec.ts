import assert from 'node:assert/strict'

import {
  getProjectWorkItemContract,
  listProjectWorkItemFieldDefinitions,
} from '../src/data/pcs-project-domain-contract.ts'
import {
  createProjectChannelProductFromListingNode,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { listSkuArchives, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'
import { renderPcsProjectCreatePage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetProjectChannelProductRepository()
resetSkuArchiveRepository()
resetProjectImageAssets()

const projectInitFieldKeys = listProjectWorkItemFieldDefinitions('PROJECT_INIT')
  .map((field) => field.fieldKey)
  .join('|')
const forbiddenSpecPlanPattern = new RegExp(['规格计划', '预期颜色', '预期尺码', '预期花型'].join('|'))

assert.doesNotMatch(projectInitFieldKeys, /plannedColor|plannedSize|plannedPrint|plannedSpec/, '商品项目立项不应引入规格计划字段')

const createHtml = await renderPcsProjectCreatePage()
assert.doesNotMatch(createHtml, forbiddenSpecPlanPattern, '商品项目创建页不应出现规格计划相关字段')

const listingContract = getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING')
const listingFieldKeys = listingContract.fieldDefinitions.map((field) => field.fieldKey)

assert.ok(listingFieldKeys.includes('listingBatchCode'), '商品上架应定义上架批次编码')
assert.ok(listingFieldKeys.includes('specLineCount'), '商品上架应定义规格数量')
assert.ok(listingFieldKeys.includes('uploadedSpecLineCount'), '商品上架应定义已上传规格数量')
assert.ok(listingFieldKeys.includes('upstreamProductId'), '商品上架应定义上游款式商品编号')
assert.ok(!listingFieldKeys.includes('skuId'), '商品上架不应再以 skuId 作为主字段')
assert.ok(!listingFieldKeys.includes('skuCode'), '商品上架不应再以 skuCode 作为主字段')
assert.ok(!listingFieldKeys.includes('skuName'), '商品上架不应再以 skuName 作为主字段')

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const [listingImage] = createProjectImageAssetRecords(
  project!,
  [
    {
      imageUrl: 'mock://listing-image/style-specs',
      imageName: '规格明细测试主图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'test-style-specs',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
  ],
  '测试用户',
  '2026-04-20T10:20:00.000Z',
)
upsertProjectImageAssets([listingImage])

const skuArchiveCountBefore = listSkuArchives().length
const emptySpecResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '无规格明细批次',
    defaultPriceAmount: 199,
    currencyCode: 'IDR',
    specLines: [],
  },
  '测试用户',
)

assert.equal(emptySpecResult.ok, false, '没有规格明细时不应允许创建上架批次')
assert.match(emptySpecResult.message, /至少一条规格明细/, '应明确提示先补齐规格明细')

const createResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '多规格款式上架批次',
    defaultPriceAmount: 199,
    currencyCode: 'IDR',
    listingMainImageId: listingImage.imageId,
    listingImageIds: [listingImage.imageId],
    specLines: [
      { colorName: '黑色', sizeName: 'M', priceAmount: 199, currencyCode: 'IDR', stockQty: 8 },
      { colorName: '黑色', sizeName: 'L', priceAmount: 199, currencyCode: 'IDR', stockQty: 6 },
    ],
  },
  '测试用户',
)

assert.equal(createResult.ok, true, '补齐规格明细后应允许创建款式上架批次')
assert.equal(createResult.record?.specLines.length, 2, '创建后应保存多条规格明细')
assert.equal(listSkuArchives().length, skuArchiveCountBefore, '创建上架批次不应写入正式规格档案')

console.log('pcs-channel-listing-style-specs.spec.ts PASS')
