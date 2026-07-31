import assert from 'node:assert/strict'

import {
  listPlateMakingTasks,
  resetPlateMakingTaskRepository,
} from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectNodeRecordByStepCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import {
  createDownstreamTasksFromRevision,
  createPatternTask,
  createPlateMakingTask,
  createRevisionTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetProjectRelationRepository()
resetRevisionTaskRepository()

const project = listProjects()[0]
assert.ok(project, '必须存在商品项目演示数据')

const plateResult = createPlateMakingTask({
  projectId: project.projectId,
  title: '项目固定步骤制版回归',
  sourceType: '项目固定步骤',
  productStyleCode: project.linkedStyleCode || project.styleNumber,
  spuCode: project.linkedStyleCode || project.styleNumber,
  patternMakerName: '王版师',
  patternArea: '印尼',
  operatorName: '测试用户',
})
assert.equal(plateResult.ok, true, plateResult.message)
assert.equal(plateResult.task?.projectNodeId, '', '制版任务不得依赖已删除的专业项目节点')
assert.equal(plateResult.task?.upstreamModule, '商品项目')
assert.equal(plateResult.task?.upstreamObjectType, '商品项目', '制版任务页面来源不得伪造成具体测款步骤')
assert.equal(plateResult.task?.upstreamObjectId, project.projectId)
assert.equal(plateResult.task?.upstreamObjectCode, project.projectCode)

const patternResult = createPatternTask({
  projectId: project.projectId,
  title: '项目固定步骤花型回归',
  sourceType: '项目固定步骤',
  productStyleCode: project.linkedStyleCode || project.styleNumber,
  spuCode: project.linkedStyleCode || project.styleNumber,
  demandSourceType: '预售测款通过',
  processType: '数码印',
  requestQty: 1,
  fabricSku: 'FAB-TEST-001',
  fabricName: '测试坯布',
  demandImageIds: ['mock://pattern-demand/project-binding.png'],
  assignedTeamCode: 'JKT_TEAM',
  assignedMemberId: 'jkt_bandung',
  operatorName: '测试用户',
})
assert.equal(patternResult.ok, true, patternResult.message)
assert.equal(patternResult.task?.projectNodeId, '', '花型任务不得依赖已删除的专业项目节点')
assert.equal(patternResult.task?.upstreamModule, '商品项目')
assert.equal(patternResult.task?.upstreamObjectType, '商品项目', '花型任务页面来源不得伪造成具体测款步骤')
assert.equal(patternResult.task?.upstreamObjectId, project.projectId)
assert.equal(patternResult.task?.upstreamObjectCode, project.projectCode)

const projectRelations = listProjectRelationsByProject(project.projectId)
const plateRelation = projectRelations.find((item) => item.sourceObjectId === plateResult.task?.plateTaskId)
const patternRelation = projectRelations.find((item) => item.sourceObjectId === patternResult.task?.patternTaskId)
assert.ok(plateRelation, '制版任务必须持久化商品项目关系')
assert.ok(patternRelation, '花型任务必须持久化商品项目关系')
assert.equal(plateRelation.projectId, project.projectId)
assert.equal(patternRelation.projectId, project.projectId)
assert.equal(plateRelation.projectCode, project.projectCode)
assert.equal(patternRelation.projectCode, project.projectCode)
assert.equal(plateRelation.sourceModule, '制版任务')
assert.equal(patternRelation.sourceModule, '花型任务')
assert.equal(plateRelation.sourceObjectType, '制版任务')
assert.equal(patternRelation.sourceObjectType, '花型任务')
assert.equal(plateRelation.sourceObjectId, plateResult.task?.plateTaskId)
assert.equal(patternRelation.sourceObjectId, patternResult.task?.patternTaskId)
assert.equal(plateRelation.sourceObjectCode, plateResult.task?.plateTaskCode)
assert.equal(patternRelation.sourceObjectCode, patternResult.task?.patternTaskCode)
assert.equal(plateRelation.projectNodeId || '', '', '制版项目关系只绑定商品项目，不绑定专业节点')
assert.equal(patternRelation.projectNodeId || '', '', '花型项目关系只绑定商品项目，不绑定专业节点')
assert.equal(plateRelation.stepCode, '', '制版项目关系不得继续保存已删除的专业步骤编码')
assert.equal(patternRelation.stepCode, '', '花型项目关系不得继续保存已删除的专业步骤编码')

const revisionProject = listProjects().find((item) =>
  Boolean(getProjectNodeRecordByStepCode(item.projectId, 'TEST_CONCLUSION')),
)
assert.ok(revisionProject, '必须存在可创建测款返改任务的商品项目')
const revisionResult = createRevisionTaskWithProjectRelation({
  projectId: revisionProject.projectId,
  title: '测款返改后创建制版任务',
  sourceType: '测款结论返改',
  ownerName: revisionProject.ownerName,
  patternMakerName: '王版师',
  revisionScopeCodes: ['PATTERN'],
  revisionScopeNames: ['版型结构'],
  issueSummary: '测款结论要求调整版型。',
  evidenceSummary: '试穿反馈确认版型需要修改。',
  operatorName: '测试用户',
})
assert.equal(revisionResult.ok, true, revisionResult.message)
if (revisionResult.ok) {
  const downstream = createDownstreamTasksFromRevision(revisionResult.task.revisionTaskId, ['PLATE'])
  assert.equal(downstream.successCount, 1, '改版任务创建制版下游不得依赖已删除的专业项目节点')
  assert.ok(
    !downstream.failureMessages.some((message) => message.includes('制版任务节点')),
    '缺少制版任务节点不得阻断改版下游制版任务',
  )
  const downstreamPlate = listPlateMakingTasks().find(
    (item) => item.upstreamObjectId === revisionResult.task.revisionTaskId,
  )
  assert.ok(downstreamPlate, '应能按改版任务上游关系查到制版下游任务')
  assert.equal(downstreamPlate?.projectId, revisionProject.projectId)
  assert.equal(downstreamPlate?.projectNodeId, '', '改版下游制版任务只绑定商品项目，不绑定专业节点')
  const downstreamRelation = listProjectRelationsByProject(revisionProject.projectId).find(
    (item) => item.sourceObjectId === downstreamPlate?.plateTaskId,
  )
  assert.ok(downstreamRelation, '改版下游制版任务必须持久化商品项目关系')
  assert.equal(downstreamRelation.projectId, revisionProject.projectId)
  assert.equal(downstreamRelation.projectCode, revisionProject.projectCode)
  assert.equal(downstreamRelation.sourceModule, '制版任务')
  assert.equal(downstreamRelation.sourceObjectType, '制版任务')
  assert.equal(downstreamRelation.sourceObjectId, downstreamPlate?.plateTaskId)
  assert.equal(downstreamRelation.sourceObjectCode, downstreamPlate?.plateTaskCode)
  assert.equal(downstreamRelation.stepCode, '', '改版下游制版关系不得保存已删除的专业步骤编码')

  const repeated = createDownstreamTasksFromRevision(revisionResult.task.revisionTaskId, ['PLATE'])
  assert.equal(repeated.successCount, 0, '同一改版任务不得重复创建制版下游任务')
  assert.equal(
    listPlateMakingTasks().filter((item) => item.upstreamObjectId === revisionResult.task.revisionTaskId).length,
    1,
    '重复创建被阻止后只能保留一张制版下游任务',
  )
}

console.log('pcs-professional-task-project-binding.spec.ts PASS')
