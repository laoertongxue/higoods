import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  approveProjectInitAndSync,
  archiveProject,
  saveProjectNodeFormalRecord,
  syncProjectLifecycle,
  terminateProject,
} from '../src/data/pcs-project-flow-service.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  listProjectNodes,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { listRevisionTasks, resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'

const pageSource = fs.readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')

for (const functionName of [
  'applyFeasibilityReviewBranch',
  'applySampleConfirmBranch',
  'applyTestConclusionBranch',
  'routeNodeAfterFormalSave',
]) {
  assert.ok(
    !pageSource.includes(`function ${functionName}`),
    `页面文件不应继续定义正式推进函数 ${functionName}`,
  )
}

assert.ok(!pageSource.includes('upsertRevisionTaskRelation'), '页面文件不应再通过关系写入函数推进改版任务')
assert.ok(!pageSource.includes('createRevisionTaskWithProjectRelation'), '页面文件不应直接创建正式改版任务，必须通过数据层服务编排')

assert.equal(typeof saveProjectNodeFormalRecord, 'function', '正式记录流转应由数据层服务提供')
assert.equal(typeof syncProjectLifecycle, 'function', '项目生命周期同步应由数据层服务提供')
assert.equal(typeof approveProjectInitAndSync, 'function', '立项审核通过动作应由数据层服务提供')
assert.equal(typeof terminateProject, 'function', '项目终止动作应由数据层服务提供')
assert.equal(typeof archiveProject, 'function', '项目归档动作应由数据层服务提供')

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
    projectName: '推进服务收口验证项目',
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
    ownerId: owner?.id || 'owner-zl',
    ownerName: owner?.name || '张丽',
    teamId: team?.id || 'team-plan',
    teamName: team?.name || '商品企划组',
  },
  '测试用户',
)

assert.ok(created.project, '应能创建推进服务验证项目')

const approveResult = approveProjectInitAndSync(created.project!.projectId, '测试用户')
assert.ok(approveResult.ok, '应能通过数据层服务完成立项审核')

const projectId = created.project!.projectId
const sampleAcquireNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')
assert.ok(sampleAcquireNode, '应存在样衣获取节点')

const saveResult = saveProjectNodeFormalRecord({
  projectId,
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

assert.ok(saveResult.ok, '应能通过数据层服务保存正式记录并推进节点')

const completedSampleAcquireNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')
const nextNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_INBOUND_CHECK')
assert.equal(completedSampleAcquireNode?.currentStatus, '已完成', '样衣获取节点应由服务推进为已完成')
assert.equal(nextNode?.currentStatus, '进行中', '后续节点应由服务自动解锁')

const project = getProjectById(projectId)
assert.equal(project?.projectStatus, '进行中', '项目状态应由服务同步到项目主记录')
assert.ok(listProjectNodes(projectId).some((node) => node.currentStatus === '进行中'), '项目节点流转结果应写回仓储')

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()
resetRevisionTaskRepository()

const adjustProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-014')
assert.ok(adjustProject, '应存在用于验证调整分支的演示项目')
const adjustConclusionNode = getProjectNodeRecordByWorkItemTypeCode(adjustProject!.projectId, 'TEST_CONCLUSION')
assert.ok(adjustConclusionNode, '调整演示项目应存在测款结论节点')

const revisionTaskCountBefore = listRevisionTasks().length
const adjustResult = saveProjectNodeFormalRecord({
  projectId: adjustProject!.projectId,
  projectNodeId: adjustConclusionNode!.projectNodeId,
  payload: {
    businessDate: '2026-04-15 11:00',
    values: {
      conclusion: '调整',
      conclusionNote: '验证项目页提交调整时必须创建正式改版任务。',
    },
  },
  completeAfterSave: true,
  operatorName: '测试用户',
})

assert.ok(adjustResult.ok, '项目页走 flow service 提交调整结论应成功')
const revisionTasks = listRevisionTasks()
assert.ok(revisionTasks.length > revisionTaskCountBefore, '调整结论应创建正式改版任务，而不是只写项目关系')
assert.ok(
  revisionTasks.some(
    (task) =>
      task.projectId === adjustProject!.projectId &&
      task.workItemTypeCode === 'TEST_CONCLUSION' &&
      task.title.includes('测款调整改版任务'),
  ),
  '调整结论创建的正式改版任务应绑定到项目和测款结论节点',
)

console.log('pcs-project-flow-service.spec.ts PASS')
