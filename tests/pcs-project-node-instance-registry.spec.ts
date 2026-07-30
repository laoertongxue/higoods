import assert from 'node:assert/strict'

import {
  getProjectNodeInstanceRegistry,
  getProjectNodeInstanceRuntimeSnapshot,
  syncProjectNodeInstanceRuntime,
} from '../src/data/pcs-project-node-instance-registry.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { approveProjectInitAndSync, saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  markProjectChannelProductListingCompleted,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const catalog = getProjectCreateCatalog()
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]

const demoProject = createProject(
  {
    ...createEmptyProjectDraft(),
    projectName: '渠道商品实例注册中心验证项目',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    categoryId: category?.id || 'cat-top',
    categoryName: category?.name || '上衣',
    subCategoryId: subCategory?.id || '',
    subCategoryName: subCategory?.name || '',
    brandId: brand?.id || 'brand-chicmore',
    brandName: brand?.name || 'Chicmore',
    styleCodeId: styleCode?.id || 'style-001',
    styleCodeName: styleCode?.name || '休闲衬衫',
    styleNumber: 'REGISTRY-LISTING-001',
    styleType: '基础款',
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'tiktok'],
    priceRangeLabel: '￥199-299',
    ownerId: owner?.id || 'owner-zl',
    ownerName: owner?.name || '张丽',
    teamId: team?.id || 'team-plan',
    teamName: team?.name || '商品企划组',
  },
  '测试用户',
).project
assert.ok(listProjects().some((item) => item.projectId === demoProject.projectId), '应创建渠道商品实例验证项目')
const [listingImage] = createProjectImageAssetRecords(
  demoProject,
  [
    {
      imageUrl: 'mock://listing-image/registry',
      imageName: '实例注册中心上架图',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'registry-listing',
      sourceType: '商品上架',
      usageScopes: ['商品上架'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
  ],
  '测试用户',
)
upsertProjectImageAssets([listingImage])
const demoApproveResult = approveProjectInitAndSync(demoProject.projectId, '测试用户')
assert.equal(demoApproveResult.ok, true, '渠道商品实例验证项目应完成项目立项')

const sampleConfirmNode = getProjectNodeRecordByWorkItemTypeCode(demoProject.projectId, 'SAMPLE_CONFIRM')
assert.ok(sampleConfirmNode, '验证项目应存在样衣确认节点')
const sampleCostNode = getProjectNodeRecordByWorkItemTypeCode(demoProject.projectId, 'SAMPLE_COST_REVIEW')
assert.ok(sampleCostNode, '验证项目应存在样衣核价节点')
listProjectNodes(demoProject.projectId)
  .filter((node) => node.sequenceNo < sampleCostNode!.sequenceNo && node.workItemTypeCode !== 'PROJECT_INIT')
  .forEach((node) => {
    updateProjectNodeRecord(
      demoProject.projectId,
      node.projectNodeId,
      { currentStatus: '已完成', completedAt: '2026-04-15 09:00', updatedAt: '2026-04-15 09:00' },
      '测试用户',
    )
  })
const sampleCostResult = saveProjectNodeFormalRecord({
  projectId: demoProject.projectId,
  projectNodeId: sampleCostNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-15 09:10',
    values: {
      spuCode: 'SPU-REGISTRY-001',
      productName: '渠道商品实例注册中心验证款',
      buyerName: '测试用户',
      brandName: demoProject.brandName,
      garmentCategory: '梭织',
      exchangeRate: 2200,
      materialCostCny: 80,
      dyeingCostCny: 10,
      auxiliaryCostAmount: 10,
      auxiliaryCostCurrency: 'RMB',
      auxiliaryCostCny: 10,
      fixedProcessCostCny: 20,
      sewingCostAmount: 30,
      sewingCostCurrency: 'RMB',
      sewingCostCny: 30,
      optionalProcessCostCny: 0,
      costTotal: 150,
      salesPrice: 299,
      salesCurrency: 'IDR',
      grossMarginRate: 30,
      reviewStatus: '已完成',
      costNote: '实例注册中心测试核价。',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})
assert.equal(sampleCostResult.ok, true, `验证项目应形成样衣核价销售价格：${sampleCostResult.message}`)

const listingNode = getProjectNodeRecordByWorkItemTypeCode(demoProject.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingNode, '验证项目应存在渠道商品上架节点')
listProjectNodes(demoProject.projectId)
  .filter((node) => node.sequenceNo < listingNode!.sequenceNo && node.currentStatus !== '已完成')
  .forEach((node) => {
    updateProjectNodeRecord(
      demoProject.projectId,
      node.projectNodeId,
      { currentStatus: '已完成', completedAt: '2026-04-15 09:20', updatedAt: '2026-04-15 09:20' },
      '测试用户',
    )
  })

const createListingResult = createProjectChannelProductFromListingNode(
  demoProject.projectId,
  {
    targetChannelCode: 'tiktok',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '项目节点实例注册中心回归验证款',
    defaultPriceAmount: 299,
    currencyCode: 'IDR',
    listingMainImageId: listingImage.imageId,
    listingImageIds: [listingImage.imageId],
    specLines: [
      { colorName: '黑色', sizeName: 'M', priceAmount: 299, currencyCode: 'IDR', stockQty: 10, productImageId: listingImage.imageId },
      { colorName: '黑色', sizeName: 'L', priceAmount: 299, currencyCode: 'IDR', stockQty: 8, productImageId: listingImage.imageId },
    ],
  },
  '测试用户',
)
assert.equal(createListingResult.ok, true, `应能创建新的渠道商品上架实例：${createListingResult.message}`)
assert.ok(createListingResult.record, '创建渠道商品实例后应返回正式记录')

const launchResult = launchProjectChannelProductListing(createListingResult.record!.channelProductId, '测试用户')
assert.equal(launchResult.ok, true, '应能上传款式上架批次')

const completeListingResult = markProjectChannelProductListingCompleted(
  createListingResult.record!.channelProductId,
  '测试用户',
)
assert.equal(completeListingResult.ok, true, `上传后应能标记商品上架完成：${completeListingResult.message}`)

const listingSnapshot = getProjectNodeInstanceRuntimeSnapshot(demoProject.projectId, listingNode!.projectNodeId)
const listingNodeAfterWrite = getProjectNodeRecordByWorkItemTypeCode(demoProject.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingSnapshot, '渠道商品上架节点应生成统一实例快照')
assert.equal(
  listingNodeAfterWrite?.validInstanceCount,
  listingSnapshot!.validInstanceCount,
  '渠道商品上架节点的实例数量应由统一实例注册中心回写',
)
assert.equal(
  listingNodeAfterWrite?.latestInstanceId,
  listingSnapshot!.latestInstanceId,
  '渠道商品上架节点的 latestInstanceId 应与统一实例注册中心一致',
)
assert.equal(
  listingNodeAfterWrite?.latestInstanceCode,
  listingSnapshot!.latestInstanceCode,
  '渠道商品上架节点的 latestInstanceCode 应与统一实例注册中心一致',
)

const created = createProject(
  {
    ...createEmptyProjectDraft(),
    projectName: '项目节点实例注册中心验证项目',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    categoryId: category?.id || 'cat-top',
    categoryName: category?.name || '上衣',
    subCategoryId: subCategory?.id || '',
    subCategoryName: subCategory?.name || '',
    brandId: brand?.id || 'brand-chicmore',
    brandName: brand?.name || 'Chicmore',
    styleCodeId: styleCode?.id || 'style-001',
    styleCodeName: styleCode?.name || '1-Casul Shirt-18-30休闲衬衫',
    styleNumber: 'REGISTRY-PATTERN-002',
    styleType: '基础款',
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'tiktok'],
    priceRangeLabel: '￥199-299',
    ownerId: owner?.id || 'owner-zl',
    ownerName: owner?.name || '张丽',
    teamId: team?.id || 'team-plan',
    teamName: team?.name || '商品企划组',
  },
  '测试用户',
)

assert.ok(created.project, '应能创建统一实例注册中心验证项目')

const approveResult = approveProjectInitAndSync(created.project!.projectId, '测试用户')
assert.equal(approveResult.ok, true, '应能完成项目立项审核')

const projectInitNode = getProjectNodeRecordByWorkItemTypeCode(created.project!.projectId, 'PROJECT_INIT')
assert.ok(projectInitNode, '新项目应存在项目立项节点')
const projectInitSnapshot = getProjectNodeInstanceRuntimeSnapshot(created.project!.projectId, projectInitNode!.projectNodeId)
assert.equal(projectInitNode?.latestInstanceId, projectInitSnapshot?.latestInstanceId, 'PROJECT_INIT 应回写项目主记录实例 ID')
assert.equal(
  projectInitNode?.latestInstanceCode,
  projectInitSnapshot?.latestInstanceCode,
  'PROJECT_INIT 应回写项目主记录实例编码',
)

const sampleAcquireNode = getProjectNodeRecordByWorkItemTypeCode(created.project!.projectId, 'SAMPLE_ACQUIRE')
assert.ok(sampleAcquireNode, '新项目应存在样衣获取节点')

const saveResult = saveProjectNodeFormalRecord({
  projectId: created.project!.projectId,
  projectNodeId: sampleAcquireNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-15 10:00',
    values: {
      sampleSourceType: '外采',
      sampleSupplierId: 'supplier-demo',
      sampleSupplierName: '广州样衣供应商',
      sampleLink: 'https://example.com/sample',
      sampleUnitPrice: '88',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})
assert.equal(saveResult.ok, true, '应能保存样衣获取正式记录')

const sampleAcquireSnapshot = getProjectNodeInstanceRuntimeSnapshot(created.project!.projectId, sampleAcquireNode!.projectNodeId)
const sampleAcquireNodeAfterSave = getProjectNodeRecordByWorkItemTypeCode(created.project!.projectId, 'SAMPLE_ACQUIRE')
assert.equal(
  sampleAcquireNodeAfterSave?.validInstanceCount,
  sampleAcquireSnapshot?.validInstanceCount,
  '项目内正式记录节点的实例数量应由统一实例注册中心回写',
)
assert.equal(
  sampleAcquireNodeAfterSave?.latestInstanceCode,
  sampleAcquireSnapshot?.latestInstanceCode,
  '项目内正式记录节点的 latestInstanceCode 应与统一实例注册中心一致',
)

const registry = getProjectNodeInstanceRegistry(created.project!.projectId)
assert.ok(registry, '应能输出项目维度的统一实例注册中心快照')
assert.ok(registry!.totalCount >= 2, '统一实例注册中心应同时纳入项目主记录与节点正式记录')

const syncResult = syncProjectNodeInstanceRuntime(created.project!.projectId, sampleAcquireNode!.projectNodeId, '测试用户')
assert.equal(syncResult?.latestInstanceCode, sampleAcquireSnapshot?.latestInstanceCode, '重复同步不应破坏当前节点实例真相')

console.log('pcs-project-node-instance-registry.spec.ts PASS')
