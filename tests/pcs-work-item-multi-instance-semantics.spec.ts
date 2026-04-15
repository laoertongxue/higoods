import assert from 'node:assert/strict'

import {
  getProjectWorkItemContract,
  listProjectWorkItemContracts,
} from '../src/data/pcs-project-domain-contract.ts'
import { getPcsWorkItemRuntimeCarrierDefinition } from '../src/data/pcs-work-item-runtime-carrier.ts'
import {
  getProjectNodeInstanceRuntimeSnapshot,
  syncProjectNodeInstanceRuntime,
} from '../src/data/pcs-project-node-instance-registry.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { renderPcsWorkItemDetailPage } from '../src/pages/pcs-work-items.ts'

for (const contract of listProjectWorkItemContracts()) {
  if (!contract.capabilities.canMultiInstance) continue
  assert.ok(
    contract.multiInstanceDefinition,
    `${contract.workItemTypeCode} 已声明 canMultiInstance=true，但缺少统一实例语义定义`,
  )
  assert.ok(
    contract.multiInstanceDefinition!.primaryInstanceTypeName,
    `${contract.workItemTypeCode} 必须声明主实例对象`,
  )
}

const channelListingContract = getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING')
assert.equal(
  channelListingContract.multiInstanceDefinition?.primaryInstanceTypeName,
  '渠道商品',
  'CHANNEL_PRODUCT_LISTING 的主实例对象应统一为渠道商品',
)
assert.deepEqual(
  channelListingContract.multiInstanceDefinition?.primaryRelationObjectTypes,
  ['渠道商品'],
  'CHANNEL_PRODUCT_LISTING 的主实例只应按渠道商品正式对象认定',
)

const summaryContract = getProjectWorkItemContract('TEST_DATA_SUMMARY')
assert.equal(
  summaryContract.multiInstanceDefinition?.semanticKind,
  'AGGREGATE_RECORDS',
  'TEST_DATA_SUMMARY 应统一为聚合快照语义',
)
assert.equal(
  summaryContract.multiInstanceDefinition?.primaryInstanceTypeName,
  '测款汇总快照',
  'TEST_DATA_SUMMARY 的主实例对象应为测款汇总快照',
)

const transferPrepContract = getProjectWorkItemContract('PROJECT_TRANSFER_PREP')
assert.equal(
  transferPrepContract.multiInstanceDefinition?.semanticKind,
  'COMPOSITE_OBJECTS',
  'PROJECT_TRANSFER_PREP 应统一为复合正式对象语义',
)
assert.equal(
  transferPrepContract.multiInstanceDefinition?.primaryInstanceTypeName,
  '技术包版本',
  'PROJECT_TRANSFER_PREP 的主实例对象应为技术包版本',
)
assert.ok(
  transferPrepContract.multiInstanceDefinition?.supportingRelationObjectTypes.includes('项目资料归档'),
  'PROJECT_TRANSFER_PREP 应把项目资料归档定义为伴随对象',
)

const costReviewCarrier = getPcsWorkItemRuntimeCarrierDefinition('SAMPLE_COST_REVIEW')
assert.equal(
  costReviewCarrier.projectDisplayRequirementCode,
  'PROJECT_INLINE_RECORDS',
  'SAMPLE_COST_REVIEW 多实例节点应按项目内记录列表展示',
)

const returnHandleCarrier = getPcsWorkItemRuntimeCarrierDefinition('SAMPLE_RETURN_HANDLE')
assert.equal(
  returnHandleCarrier.projectDisplayRequirementCode,
  'PROJECT_INLINE_RECORDS',
  'SAMPLE_RETURN_HANDLE 多实例节点应按项目内记录列表展示',
)

const detailHtml = renderPcsWorkItemDetailPage('WI-015')
assert.match(detailHtml, /多实例语义/, '工作项详情应展示多实例语义章节')
assert.match(detailHtml, /技术包版本/, '项目转档准备详情应明确主实例对象是技术包版本')
assert.match(detailHtml, /项目资料归档/, '项目转档准备详情应展示伴随对象')

resetProjectRepository()
resetProjectRelationRepository()
resetProjectChannelProductRepository()

const demoProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(demoProject, '应存在 PRJ-20251216-015 演示项目')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(demoProject!.projectId, 'PROJECT_TRANSFER_PREP')
assert.ok(transferNode, '演示项目应存在项目转档准备节点')
syncProjectNodeInstanceRuntime(demoProject!.projectId, transferNode!.projectNodeId, '测试用户')
const transferSnapshot = getProjectNodeInstanceRuntimeSnapshot(demoProject!.projectId, transferNode!.projectNodeId)
assert.ok(transferSnapshot, '项目转档准备节点应生成实例快照')
assert.equal(
  transferSnapshot!.latestInstance?.sourceObjectType,
  '技术包版本',
  'PROJECT_TRANSFER_PREP 的 latestInstance 应只按技术包版本认定',
)
assert.ok(
  transferSnapshot!.supportingInstances.some((item) => item.sourceObjectType === '项目资料归档'),
  'PROJECT_TRANSFER_PREP 应把项目资料归档保留为伴随对象',
)

const listingNode = getProjectNodeRecordByWorkItemTypeCode(demoProject!.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingNode, '演示项目应存在商品上架节点')
syncProjectNodeInstanceRuntime(demoProject!.projectId, listingNode!.projectNodeId, '测试用户')
const listingSnapshot = getProjectNodeInstanceRuntimeSnapshot(demoProject!.projectId, listingNode!.projectNodeId)
assert.ok(listingSnapshot, '商品上架节点应生成实例快照')
assert.ok(
  listingSnapshot!.primaryInstances.every((item) => item.sourceObjectType === '渠道商品'),
  'CHANNEL_PRODUCT_LISTING 的主实例只应统计渠道商品正式对象',
)
assert.ok(
  listingSnapshot!.instances.every(
    (item) =>
      item.sourceKind !== 'RELATION_OBJECT' ||
      item.sourceObjectType === '渠道商品' ||
      item.sourceObjectType === '上游渠道商品同步',
  ),
  'CHANNEL_PRODUCT_LISTING 的正式关系对象只能是渠道商品或其伴随的上游同步对象',
)

console.log('pcs-work-item-multi-instance-semantics.spec.ts PASS')
