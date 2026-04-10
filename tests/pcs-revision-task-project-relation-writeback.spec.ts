import assert from 'node:assert/strict'
import {
  createRevisionTaskWithProjectRelation,
  saveRevisionTaskDraft,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import {
  getRevisionTaskById,
  resetRevisionTaskRepository,
} from '../src/data/pcs-revision-task-repository.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProjectNode,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  getProjectNodeRecordById,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetRevisionTaskRepository()
clearProjectRelationStore()

const draftProject = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION'))
assert.ok(draftProject, '应存在可用于改版任务草稿保存的商品项目')

const draftRelationCount = draftProject
  ? listProjectRelationsByProjectNode(
      draftProject.projectId,
      findProjectNodeByWorkItemTypeCode(draftProject.projectId, 'TEST_CONCLUSION')!.projectNodeId,
    ).length
  : 0

const draft = saveRevisionTaskDraft({
  projectId: draftProject!.projectId,
  title: '草稿-测试改版任务',
  sourceType: '人工创建',
  ownerName: '测试版师',
})
assert.equal(draft.status, '草稿', '保存草稿时应写入草稿状态')
assert.equal(
  listProjectRelationsByProjectNode(
    draftProject!.projectId,
    findProjectNodeByWorkItemTypeCode(draftProject!.projectId, 'TEST_CONCLUSION')!.projectNodeId,
  ).length,
  draftRelationCount,
  '保存草稿不会写项目关系',
)

const completedProject = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION'))
assert.ok(completedProject, '应存在可用于正式改版任务创建的商品项目')
const completedNode = findProjectNodeByWorkItemTypeCode(completedProject!.projectId, 'TEST_CONCLUSION')!

updateProjectNodeRecord(completedProject!.projectId, completedNode.projectNodeId, {
  currentStatus: '已完成',
}, '测试脚本')

const relationCountBefore = listProjectRelationsByProjectNode(completedProject!.projectId, completedNode.projectNodeId).length
const result = createRevisionTaskWithProjectRelation({
  revisionTaskId: 'RT-TST-001',
  revisionTaskCode: 'RT-TST-001',
  projectId: completedProject!.projectId,
  title: '测试改版任务正式创建',
  sourceType: '人工创建',
  ownerName: '测试版师',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  operatorName: '测试脚本',
})

assert.ok(result.ok, '满足条件时应能正式创建改版任务')
assert.ok(getRevisionTaskById('RT-TST-001'), '正式创建后应写入改版任务仓储')
assert.equal(
  listProjectRelationsByProjectNode(completedProject!.projectId, completedNode.projectNodeId).length,
  relationCountBefore + 1,
  '改版任务正式创建后应写入 TEST_CONCLUSION 项目关系',
)
const completedNodeAfter = getProjectNodeRecordById(completedProject!.projectId, completedNode.projectNodeId)
assert.equal(completedNodeAfter?.currentStatus, '已完成', '创建改版任务后不应把 TEST_CONCLUSION 节点改回进行中')
assert.equal(completedNodeAfter?.latestInstanceCode, 'RT-TST-001', '创建改版任务后应回写最新实例编号')
assert.equal(completedNodeAfter?.latestResultType, '已创建改版任务', '创建改版任务后应回写最新结果类型')

const duplicateResult = createRevisionTaskWithProjectRelation({
  revisionTaskId: 'RT-TST-001',
  revisionTaskCode: 'RT-TST-001',
  projectId: completedProject!.projectId,
  title: '测试改版任务正式创建',
  sourceType: '人工创建',
  ownerName: '测试版师',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  operatorName: '测试脚本',
})
assert.ok(duplicateResult.ok, '重复提交同一改版任务时仍应返回成功结果')
assert.equal(
  listProjectRelationsByProjectNode(completedProject!.projectId, completedNode.projectNodeId).length,
  relationCountBefore + 1,
  '同一改版任务重复提交时，不会重复写项目关系记录',
)

const cancelledProject = listProjects().find((item) => item.projectId !== completedProject!.projectId && findProjectNodeByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION'))
assert.ok(cancelledProject, '应存在第二个可用于取消节点拦截的商品项目')
const cancelledNode = findProjectNodeByWorkItemTypeCode(cancelledProject!.projectId, 'TEST_CONCLUSION')!
updateProjectNodeRecord(cancelledProject!.projectId, cancelledNode.projectNodeId, {
  currentStatus: '已取消',
}, '测试脚本')

const blocked = createRevisionTaskWithProjectRelation({
  revisionTaskId: 'RT-TST-BLOCK',
  revisionTaskCode: 'RT-TST-BLOCK',
  projectId: cancelledProject!.projectId,
  title: '取消节点上的改版任务',
  sourceType: '人工创建',
  ownerName: '测试版师',
  operatorName: '测试脚本',
})
assert.ok(!blocked.ok, '项目节点已取消时，不允许正式创建改版任务')
assert.equal(getRevisionTaskById('RT-TST-BLOCK'), null, '正式创建失败时不应写任务记录')

console.log('pcs-revision-task-project-relation-writeback.spec.ts PASS')
