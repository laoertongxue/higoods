import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  approveProjectInitAndSync,
  saveProjectNodeFormalRecord,
  syncProjectLifecycle,
  terminateProject,
  archiveProject,
} from '../src/data/pcs-project-flow-service.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'

const pageSource = fs.readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')

for (const functionName of [
  'applyFeasibilityReviewBranch',
  'applySampleConfirmBranch',
  'applyTestConclusionBranch',
  'routeNodeAfterFormalSave',
]) {
  assert.ok(!pageSource.includes(`function ${functionName}`), `页面文件不应继续定义旧推进函数 ${functionName}`)
}

assert.equal(typeof saveProjectNodeFormalRecord, 'function')
assert.equal(typeof syncProjectLifecycle, 'function')
assert.equal(typeof approveProjectInitAndSync, 'function')
assert.equal(typeof terminateProject, 'function')
assert.equal(typeof archiveProject, 'function')

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
    projectName: '推进服务线性流转验证项目',
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
    priceRangeLabel: '￥199-299',
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'tiktok-shop'],
    ownerId: owner?.id || 'owner-zl',
    ownerName: owner?.name || '张丽',
    teamId: team?.id || 'team-plan',
    teamName: team?.name || '商品企划组',
  },
  '测试用户',
)

assert.ok(created.project, '应能创建验证项目')

const approveResult = approveProjectInitAndSync(created.project!.projectId, '测试用户')
assert.ok(approveResult.ok, '应能完成立项审核')

const projectId = created.project!.projectId
const sampleAcquireNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')
assert.ok(sampleAcquireNode, '应存在样衣获取节点')

const saveResult = saveProjectNodeFormalRecord({
  projectId,
  projectNodeId: sampleAcquireNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-20 10:00',
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

assert.ok(saveResult.ok, '执行类节点应能保存并线性流转')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')?.currentStatus, '已完成')
assert.equal(getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_INBOUND_CHECK')?.currentStatus, '进行中')
assert.equal(getProjectById(projectId)?.projectStatus, '进行中')
assert.ok(listProjectNodes(projectId).some((node) => node.currentStatus === '进行中'))

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

console.log('pcs-project-flow-service.spec.ts PASS')
