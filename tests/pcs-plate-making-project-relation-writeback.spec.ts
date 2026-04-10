import assert from 'node:assert/strict'
import { createPlateMakingTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'
import { getPlateMakingTaskById, resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
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
resetPlateMakingTaskRepository()
clearProjectRelationStore()

const project = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'PATTERN_TASK'))
assert.ok(project, '应存在可用于制版任务创建的商品项目')
const node = findProjectNodeByWorkItemTypeCode(project!.projectId, 'PATTERN_TASK')!
updateProjectNodeRecord(project!.projectId, node.projectNodeId, { currentStatus: '已完成' }, '测试脚本')

const relationCountBefore = listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length
const result = createPlateMakingTaskWithProjectRelation({
  plateTaskId: 'PT-TST-001',
  plateTaskCode: 'PT-TST-001',
  projectId: project!.projectId,
  title: '测试制版任务正式创建',
  sourceType: '项目模板阶段',
  ownerName: '测试版师',
  patternType: '连衣裙',
  sizeRange: 'S-XL',
  operatorName: '测试脚本',
})

assert.ok(result.ok, '满足条件时应能正式创建制版任务')
assert.ok(getPlateMakingTaskById('PT-TST-001'), '正式创建后应写入制版任务仓储')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '制版任务正式创建后应写入 PATTERN_TASK 项目关系',
)
const updatedNode = getProjectNodeRecordById(project!.projectId, node.projectNodeId)
assert.equal(updatedNode?.currentStatus, '进行中', '节点已完成后再次创建制版任务时，应重新写为进行中')
assert.equal(updatedNode?.latestInstanceCode, 'PT-TST-001', '应回写制版任务最新实例编号')
assert.equal(updatedNode?.latestResultType, '已创建制版任务', '应回写制版任务最新结果')

const duplicate = createPlateMakingTaskWithProjectRelation({
  plateTaskId: 'PT-TST-001',
  plateTaskCode: 'PT-TST-001',
  projectId: project!.projectId,
  title: '测试制版任务正式创建',
  sourceType: '项目模板阶段',
  ownerName: '测试版师',
  patternType: '连衣裙',
  sizeRange: 'S-XL',
  operatorName: '测试脚本',
})
assert.ok(duplicate.ok, '重复提交同一制版任务时仍应返回成功结果')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '同一制版任务重复提交时，不会重复写项目关系记录',
)

const cancelledProject = listProjects().find((item) => item.projectId !== project!.projectId && findProjectNodeByWorkItemTypeCode(item.projectId, 'PATTERN_TASK'))
assert.ok(cancelledProject, '应存在第二个可用于取消节点拦截的项目')
const cancelledNode = findProjectNodeByWorkItemTypeCode(cancelledProject!.projectId, 'PATTERN_TASK')!
updateProjectNodeRecord(cancelledProject!.projectId, cancelledNode.projectNodeId, { currentStatus: '已取消' }, '测试脚本')
const blocked = createPlateMakingTaskWithProjectRelation({
  plateTaskId: 'PT-TST-BLOCK',
  plateTaskCode: 'PT-TST-BLOCK',
  projectId: cancelledProject!.projectId,
  title: '取消节点上的制版任务',
  sourceType: '项目模板阶段',
  ownerName: '测试版师',
  operatorName: '测试脚本',
})
assert.ok(!blocked.ok, '项目节点已取消时，不允许正式创建制版任务')
assert.equal(getPlateMakingTaskById('PT-TST-BLOCK'), null, '正式创建失败时，不应写入制版任务记录')

console.log('pcs-plate-making-project-relation-writeback.spec.ts PASS')
