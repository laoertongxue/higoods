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
  getProjectNodeRecordByStepCode,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { approveProjectInitAndSync, saveProjectNodeFormalRecord } from '../src/data/pcs-project-flow-service.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()

const catalog = getProjectCreateCatalog()
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.categoryNumbers[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]

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
    categoryNumberId: styleCode?.id || 'style-001',
    categoryNumberName: styleCode?.name || '1-Casul Shirt-18-30休闲衬衫',
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

const projectInitNode = getProjectNodeRecordByStepCode(created.project!.projectId, 'PROJECT_INIT')
assert.ok(projectInitNode, '新项目应存在项目立项节点')
const projectInitSnapshot = getProjectNodeInstanceRuntimeSnapshot(created.project!.projectId, projectInitNode!.projectNodeId)
assert.equal(projectInitNode?.latestInstanceId, projectInitSnapshot?.latestInstanceId, 'PROJECT_INIT 应回写项目主记录实例 ID')
assert.equal(
  projectInitNode?.latestInstanceCode,
  projectInitSnapshot?.latestInstanceCode,
  'PROJECT_INIT 应回写项目主记录实例编码',
)

const sampleAcquireNode = getProjectNodeRecordByStepCode(created.project!.projectId, 'SAMPLE_ACQUIRE')
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
const sampleAcquireNodeAfterSave = getProjectNodeRecordByStepCode(created.project!.projectId, 'SAMPLE_ACQUIRE')
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

// R1: channel publications are independent PID/variant records, not project-node instances.
const channelNode = getProjectNodeRecordByStepCode(created.project!.projectId, 'CHANNEL_PRODUCT_LISTING')
if (channelNode) {
  const channelSnapshot = getProjectNodeInstanceRuntimeSnapshot(created.project!.projectId, channelNode.projectNodeId)
  assert.equal(channelSnapshot?.validInstanceCount ?? 0, 0, '项目节点不能创建或重复持有渠道实例')
}
console.log('pcs-project-node-instance-registry.spec.ts PASS')
