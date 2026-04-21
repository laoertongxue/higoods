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
  listActiveProjectTemplates,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { approveProjectInitAndSync, saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  markProjectChannelProductListingCompleted,
  resetProjectChannelProductRepository,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createPlateMakingTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()
resetPlateMakingTaskRepository()

const demoProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(demoProject, '应存在 PRJ-20251216-015 演示项目')

const listingNode = getProjectNodeRecordByWorkItemTypeCode(demoProject!.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingNode, '演示项目应存在渠道商品上架节点')

const createListingResult = createProjectChannelProductFromListingNode(
  demoProject!.projectId,
  {
    targetChannelCode: 'tiktok-shop',
    targetStoreId: 'store-tiktok-01',
    listingTitle: '项目节点实例注册中心回归验证款',
    defaultPriceAmount: 299,
    currencyCode: 'IDR',
    specLines: [
      { colorName: '黑色', sizeName: 'M', priceAmount: 299, currencyCode: 'IDR', stockQty: 10 },
      { colorName: '黑色', sizeName: 'L', priceAmount: 299, currencyCode: 'IDR', stockQty: 8 },
    ],
  },
  '测试用户',
)
assert.equal(createListingResult.ok, true, '应能创建新的渠道商品上架实例')
assert.ok(createListingResult.record, '创建渠道商品实例后应返回正式记录')

const launchResult = launchProjectChannelProductListing(createListingResult.record!.channelProductId, '测试用户')
assert.equal(launchResult.ok, true, '应能上传款式上架批次')

const completeListingResult = markProjectChannelProductListingCompleted(
  createListingResult.record!.channelProductId,
  '测试用户',
)
assert.equal(completeListingResult.ok, true, '上传后应能标记商品上架完成')

const listingSnapshot = getProjectNodeInstanceRuntimeSnapshot(demoProject!.projectId, listingNode!.projectNodeId)
const listingNodeAfterWrite = getProjectNodeRecordByWorkItemTypeCode(demoProject!.projectId, 'CHANNEL_PRODUCT_LISTING')
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

const catalog = getProjectCreateCatalog()
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]
const templateId = listActiveProjectTemplates()[0]?.id ?? '1'

const created = createProject(
  {
    ...createEmptyProjectDraft(),
    projectName: '项目节点实例注册中心验证项目',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId,
    categoryId: category?.id || 'cat-top',
    categoryName: category?.name || '上衣',
    subCategoryId: subCategory?.id || '',
    subCategoryName: subCategory?.name || '',
    brandId: brand?.id || 'brand-chicmore',
    brandName: brand?.name || 'Chicmore',
    styleCodeId: styleCode?.id || 'style-001',
    styleCodeName: styleCode?.name || '1-Casul Shirt-18-30休闲衬衫',
    styleType: '基础款',
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'tiktok-shop'],
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

const patternNode = getProjectNodeRecordByWorkItemTypeCode(created.project!.projectId, 'PATTERN_TASK')
assert.ok(patternNode, '新项目应存在制版任务节点')

const plateTaskResult = createPlateMakingTaskWithProjectRelation({
  projectId: created.project!.projectId,
  title: '统一实例注册中心制版任务',
  sourceType: '项目模板阶段',
  operatorName: '测试用户',
})
assert.equal(plateTaskResult.ok, true, '应能创建正式制版任务并绑定到项目')

const patternSnapshot = getProjectNodeInstanceRuntimeSnapshot(created.project!.projectId, patternNode!.projectNodeId)
const patternNodeAfterCreate = getProjectNodeRecordByWorkItemTypeCode(created.project!.projectId, 'PATTERN_TASK')
assert.equal(
  patternNodeAfterCreate?.validInstanceCount,
  patternSnapshot?.validInstanceCount,
  '工程任务节点的实例数量应由统一实例注册中心回写',
)
assert.equal(
  patternNodeAfterCreate?.latestInstanceId,
  patternSnapshot?.latestInstanceId,
  '工程任务节点的 latestInstanceId 应与统一实例注册中心一致',
)

const registry = getProjectNodeInstanceRegistry(created.project!.projectId)
assert.ok(registry, '应能输出项目维度的统一实例注册中心快照')
assert.ok(registry!.totalCount >= 3, '统一实例注册中心应同时纳入主记录、正式记录与正式任务实例')

const syncResult = syncProjectNodeInstanceRuntime(created.project!.projectId, patternNode!.projectNodeId, '测试用户')
assert.equal(syncResult?.latestInstanceCode, patternSnapshot?.latestInstanceCode, '重复同步不应破坏当前节点实例真相')

console.log('pcs-project-node-instance-registry.spec.ts PASS')
