import assert from 'node:assert/strict'

import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  createPatternTask,
  createPlateMakingTask,
} from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetProjectRelationRepository()

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
assert.equal(patternResult.task?.upstreamObjectId, project.projectId)
assert.equal(patternResult.task?.upstreamObjectCode, project.projectCode)

const projectRelations = listProjectRelationsByProject(project.projectId)
const plateRelation = projectRelations.find((item) => item.sourceObjectId === plateResult.task?.plateTaskId)
const patternRelation = projectRelations.find((item) => item.sourceObjectId === patternResult.task?.patternTaskId)
assert.equal(plateRelation?.projectNodeId || '', '', '制版项目关系只绑定商品项目，不绑定专业节点')
assert.equal(patternRelation?.projectNodeId || '', '', '花型项目关系只绑定商品项目，不绑定专业节点')

console.log('pcs-professional-task-project-binding.spec.ts PASS')
