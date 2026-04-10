import assert from 'node:assert/strict'
import {
  createDownstreamTasksFromRevision,
  createRevisionTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import { listPatternTasks, resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { listPlateMakingTasks, resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { listPreProductionSampleTasks, resetPreProductionSampleTaskRepository } from '../src/data/pcs-pre-production-sample-repository.ts'
import { listFirstSampleTasks, resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProject,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetRevisionTaskRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetFirstSampleTaskRepository()
resetPreProductionSampleTaskRepository()
clearProjectRelationStore()

const project = listProjects().find((item) => {
  return (
    findProjectNodeByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION') &&
    !findProjectNodeByWorkItemTypeCode(item.projectId, 'PATTERN_TASK') &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'PATTERN_ARTWORK_TASK') &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'FIRST_SAMPLE') &&
    findProjectNodeByWorkItemTypeCode(item.projectId, 'PRE_PRODUCTION_SAMPLE')
  )
})
assert.ok(project, '应存在缺少 PATTERN_TASK 节点但具备其它下游节点的商品项目')

const revisionResult = createRevisionTaskWithProjectRelation({
  revisionTaskId: 'RT-DOWN-001',
  revisionTaskCode: 'RT-DOWN-001',
  projectId: project!.projectId,
  title: '测试改版下游批量创建',
  sourceType: '人工创建',
  ownerName: '测试版师',
  operatorName: '测试脚本',
})
assert.ok(revisionResult.ok, '应先成功创建正式改版任务')

const plateCountBefore = listPlateMakingTasks().length
const patternCountBefore = listPatternTasks().length
const firstCountBefore = listFirstSampleTasks().length
const preCountBefore = listPreProductionSampleTasks().length

const result = createDownstreamTasksFromRevision('RT-DOWN-001', ['PATTERN', 'PRINT', 'SAMPLE', 'PRE_PRODUCTION'])
assert.equal(result.successCount, 3, '缺少一个目标节点时，其它下游任务仍应正常创建')
assert.ok(
  result.failureMessages.some((message) => message.includes('未配置对应项目节点')),
  '缺少目标节点时，必须返回明确中文失败原因',
)
assert.equal(listPlateMakingTasks().length, plateCountBefore, '缺少 PATTERN_TASK 节点时，不应误创建制版任务')
assert.equal(listPatternTasks().length, patternCountBefore + 1, '应创建花型任务')
assert.equal(listFirstSampleTasks().length, firstCountBefore + 1, '应创建首版样衣打样任务')
assert.equal(listPreProductionSampleTasks().length, preCountBefore + 1, '应创建产前版样衣任务')

const patternNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PATTERN_ARTWORK_TASK')
const firstNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'FIRST_SAMPLE')
const preNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PRE_PRODUCTION_SAMPLE')
assert.equal(patternNode?.latestResultType, '已创建花型任务', '批量创建后应立即回写花型节点')
assert.equal(firstNode?.latestResultType, '已创建首版样衣打样任务', '批量创建后应立即回写首版样衣节点')
assert.equal(preNode?.latestResultType, '已创建产前版样衣任务', '批量创建后应立即回写产前版样衣节点')

const relations = listProjectRelationsByProject(project!.projectId)
assert.ok(relations.some((item) => item.sourceModule === '花型任务'), '项目关系中应包含新创建的花型任务')
assert.ok(relations.some((item) => item.sourceModule === '首版样衣打样'), '项目关系中应包含新创建的首版样衣打样任务')
assert.ok(relations.some((item) => item.sourceModule === '产前版样衣'), '项目关系中应包含新创建的产前版样衣任务')
assert.ok(!relations.some((item) => item.sourceModule === '制版任务' && item.sourceObjectCode.startsWith('PT-')), '目标节点缺失时不应误写制版任务正式关系')

console.log('pcs-revision-downstream-create-project-relation.spec.ts PASS')
