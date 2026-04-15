import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import {
  buildProjectChannelProductChainSummary,
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  listProjectChannelProductsByProjectId,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetProjectChannelProductRepository()

const contract = getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING')
assert.equal(contract.capabilities.canMultiInstance, true, '商品上架节点应支持多实例')
assert.equal(contract.capabilities.canParallel, true, '商品上架节点应支持并行执行')
assert.ok(
  contract.fieldDefinitions.some((field) => field.fieldKey === 'targetChannelCodes'),
  '商品上架节点应展示项目目标渠道池',
)
assert.ok(
  contract.fieldDefinitions.some((field) => field.fieldKey === 'listingScopeRule'),
  '商品上架节点应展示实例粒度说明',
)

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const initialActiveRecords = listProjectChannelProductsByProjectId(project.projectId).filter(
  (item) => item.channelProductStatus !== '已作废',
)
assert.equal(initialActiveRecords.length, 1, '演示项目初始应只有 1 条有效渠道商品实例')

const tiktokMainStoreResult = createProjectChannelProductFromListingNode(
  project.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '印尼风格碎花连衣裙 TikTok 主店测款款',
    listingPrice: 279,
  },
  '测试用户',
)
assert.equal(tiktokMainStoreResult.ok, true, '应允许在第二个渠道创建新的商品上架实例')

const tiktokSecondStoreResult = createProjectChannelProductFromListingNode(
  project.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'ST-002',
    listingTitle: '印尼风格碎花连衣裙 TikTok 越南店测款款',
    listingPrice: 289,
  },
  '测试用户',
)
assert.equal(tiktokSecondStoreResult.ok, true, '应允许同一渠道在第二个店铺创建新的商品上架实例')

const duplicateStoreResult = createProjectChannelProductFromListingNode(
  project.projectId,
  {
    targetChannelCode: 'shopee',
    targetStoreId: 'store-shopee-01',
    listingTitle: '印尼风格碎花连衣裙 Shopee 重复店铺测款款',
    listingPrice: 299,
  },
  '测试用户',
)
assert.equal(duplicateStoreResult.ok, false, '同一渠道同一店铺不应重复创建有效实例')
assert.match(duplicateStoreResult.message, /同一渠道同一店铺/, '重复创建时应提示同店铺冲突')

const invalidChannelStoreResult = createProjectChannelProductFromListingNode(
  project.projectId,
  {
    targetChannelCode: 'shopee',
    targetStoreId: 'ST-002',
    listingTitle: '非法渠道店铺组合',
    listingPrice: 309,
  },
  '测试用户',
)
assert.equal(invalidChannelStoreResult.ok, false, '错误的渠道店铺组合不应允许创建')
assert.match(invalidChannelStoreResult.message, /不属于渠道/, '应明确提示渠道店铺归属错误')

assert.ok(tiktokMainStoreResult.record, '创建成功后应返回新实例')
assert.ok(tiktokSecondStoreResult.record, '创建成功后应返回新实例')
launchProjectChannelProductListing(tiktokMainStoreResult.record!.channelProductId, '测试用户')
launchProjectChannelProductListing(tiktokSecondStoreResult.record!.channelProductId, '测试用户')

const activeRecords = listProjectChannelProductsByProjectId(project.projectId).filter(
  (item) => item.channelProductStatus !== '已作废',
)
assert.equal(activeRecords.length, 3, '当前项目应支持 3 条有效渠道商品实例并行存在')
assert.ok(
  activeRecords.some((item) => item.channelCode === 'shopee' && item.storeId === 'store-shopee-01'),
  '应保留原有 Shopee 店铺实例',
)
assert.ok(
  activeRecords.some((item) => item.channelCode === 'tiktok-shop' && item.storeId === 'store-tiktok-01'),
  '应新增 TikTok 主店实例',
)
assert.ok(
  activeRecords.some((item) => item.channelCode === 'tiktok-shop' && item.storeId === 'ST-002'),
  '应新增 TikTok 第二店铺实例',
)
assert.ok(
  activeRecords.every((item) => item.upstreamChannelProductCode),
  '发起上架后，每条有效实例都应拥有上游渠道商品编码',
)

const chainSummary = buildProjectChannelProductChainSummary(project.projectId)
assert.ok(chainSummary, '应能生成项目渠道商品链路摘要')
assert.match(chainSummary!.summaryText, /3 个有效渠道商品实例/, '链路摘要应体现多渠道多店铺并行实例数量')

console.log('pcs-channel-product-listing-multi-instance.spec.ts PASS')
