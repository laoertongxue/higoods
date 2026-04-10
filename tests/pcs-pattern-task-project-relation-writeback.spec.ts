import assert from 'node:assert/strict'
import { createPatternTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'
import { getPatternTaskById, resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
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
resetPatternTaskRepository()
clearProjectRelationStore()

const project = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'PATTERN_ARTWORK_TASK'))
assert.ok(project, '应存在可用于花型任务创建的商品项目')
const node = findProjectNodeByWorkItemTypeCode(project!.projectId, 'PATTERN_ARTWORK_TASK')!
updateProjectNodeRecord(project!.projectId, node.projectNodeId, { currentStatus: '已完成' }, '测试脚本')

const relationCountBefore = listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length
const result = createPatternTaskWithProjectRelation({
  patternTaskId: 'AT-TST-001',
  patternTaskCode: 'AT-TST-001',
  projectId: project!.projectId,
  title: '测试花型任务正式创建',
  sourceType: '项目模板阶段',
  ownerName: '测试花型设计',
  artworkType: '印花',
  patternMode: '定位印',
  artworkName: '测试花型稿',
  operatorName: '测试脚本',
})

assert.ok(result.ok, '满足条件时应能正式创建花型任务')
assert.ok(getPatternTaskById('AT-TST-001'), '正式创建后应写入花型任务仓储')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '花型任务正式创建后应写入 PATTERN_ARTWORK_TASK 项目关系',
)

const updatedNode = getProjectNodeRecordById(project!.projectId, node.projectNodeId)
assert.equal(updatedNode?.currentStatus, '进行中', '节点已完成后再次创建花型任务时，应重新写为进行中')
assert.equal(updatedNode?.latestInstanceCode, 'AT-TST-001', '应回写花型任务最新实例编号')
assert.equal(updatedNode?.latestResultType, '已创建花型任务', '应回写花型任务最新结果')

const duplicate = createPatternTaskWithProjectRelation({
  patternTaskId: 'AT-TST-001',
  patternTaskCode: 'AT-TST-001',
  projectId: project!.projectId,
  title: '测试花型任务正式创建',
  sourceType: '项目模板阶段',
  ownerName: '测试花型设计',
  artworkType: '印花',
  patternMode: '定位印',
  artworkName: '测试花型稿',
  operatorName: '测试脚本',
})
assert.ok(duplicate.ok, '重复提交同一花型任务时仍应返回成功结果')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '同一花型任务重复提交时，不会重复写项目关系记录',
)

const cancelledProject = listProjects().find((item) => item.projectId !== project!.projectId && findProjectNodeByWorkItemTypeCode(item.projectId, 'PATTERN_ARTWORK_TASK'))
assert.ok(cancelledProject, '应存在第二个可用于取消节点拦截的项目')
const cancelledNode = findProjectNodeByWorkItemTypeCode(cancelledProject!.projectId, 'PATTERN_ARTWORK_TASK')!
updateProjectNodeRecord(cancelledProject!.projectId, cancelledNode.projectNodeId, { currentStatus: '已取消' }, '测试脚本')
const blocked = createPatternTaskWithProjectRelation({
  patternTaskId: 'AT-TST-BLOCK',
  patternTaskCode: 'AT-TST-BLOCK',
  projectId: cancelledProject!.projectId,
  title: '取消节点上的花型任务',
  sourceType: '项目模板阶段',
  ownerName: '测试花型设计',
  operatorName: '测试脚本',
})
assert.ok(!blocked.ok, '项目节点已取消时，不允许正式创建花型任务')
assert.equal(getPatternTaskById('AT-TST-BLOCK'), null, '正式创建失败时，不应写入花型任务记录')

console.log('pcs-pattern-task-project-relation-writeback.spec.ts PASS')
