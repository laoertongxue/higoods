import assert from 'node:assert/strict'

import {
  listPlateMakingTasks,
  resetPlateMakingTaskRepository,
} from '../src/data/pcs-plate-making-repository.ts'
import { listPatternTasks, resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectNodeRecordByStepCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  getRevisionTaskById,
  resetRevisionTaskRepository,
  updateRevisionTask,
} from '../src/data/pcs-revision-task-repository.ts'
import {
  completeFirstOrderSampleTask,
  completeFirstSampleTask,
  completePatternTask,
  completePlateMakingTask,
  completeRevisionTask,
  createFirstOrderSampleTaskWithProjectRelation,
  createFirstSampleTaskWithProjectRelation,
  createDownstreamTasksFromRevision,
  createPatternTask,
  createPlateMakingTask,
  createRevisionTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import {
  listFirstSampleTasks,
  resetFirstSampleTaskRepository,
  updateFirstSampleTask,
} from '../src/data/pcs-first-sample-repository.ts'
import {
  listFirstOrderSampleTasks,
  resetFirstOrderSampleTaskRepository,
  updateFirstOrderSampleTask,
} from '../src/data/pcs-first-order-sample-repository.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetProjectRelationRepository()
resetRevisionTaskRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()

const project = listProjects()[0]
assert.ok(project, '必须存在商品项目演示数据')

const plateResult = createPlateMakingTask({
  projectId: project.projectId,
  title: '商品项目制版回归',
  sourceType: '商品项目',
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
  title: '商品项目花型回归',
  sourceType: '商品项目',
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

const firstSampleResult = createFirstSampleTaskWithProjectRelation({
  projectId: project.projectId,
  title: '项目级首版样衣关系回归',
  sourceType: '人工创建',
  sourceTechPackVersionId: 'tpv-project-level-first-sample',
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳样衣间',
  targetSite: '深圳',
  sampleMaterialMode: '正确布',
  samplePurpose: '首版确认',
  operatorName: '测试用户',
})
assert.equal(firstSampleResult.ok, true, firstSampleResult.message)
assert.equal(firstSampleResult.task?.projectNodeId, '')
const firstSampleRelation = listProjectRelationsByProject(project.projectId).find(
  (item) => item.sourceObjectId === firstSampleResult.task?.firstSampleTaskId,
)
assert.ok(firstSampleRelation, '首版样衣任务创建时必须立即持久化项目级关系')
assert.equal(firstSampleRelation.projectNodeId || '', '')
assert.equal(firstSampleRelation.stepCode, '')

updateFirstSampleTask(firstSampleResult.task!.firstSampleTaskId, {
  sampleImageIds: ['mock://first-sample/project-level.png'],
  fitConfirmationSummary: '版型确认通过。',
  productionReadinessNote: '首版样衣已具备生产准备条件。',
  confirmedAt: '2026-07-31 10:00',
})
const completedFirstSample = completeFirstSampleTask(firstSampleResult.task!.firstSampleTaskId, '测试用户')
assert.equal(completedFirstSample.ok, true, completedFirstSample.message)
assert.equal(
  listProjectRelationsByProject(project.projectId).find(
    (item) => item.sourceObjectId === firstSampleResult.task?.firstSampleTaskId,
  )?.sourceStatus,
  '已完成',
  '首版样衣任务完成后必须统一回写项目级关系完成态',
)

const firstOrderResult = createFirstOrderSampleTaskWithProjectRelation({
  projectId: project.projectId,
  title: '项目级首单样衣关系回归',
  sourceType: '首版样衣任务',
  upstreamModule: '首版样衣打样',
  upstreamObjectType: '首版样衣打样任务',
  upstreamObjectId: firstSampleResult.task!.firstSampleTaskId,
  upstreamObjectCode: firstSampleResult.task!.firstSampleTaskCode,
  sourceFirstSampleTaskId: firstSampleResult.task!.firstSampleTaskId,
  sourceFirstSampleTaskCode: firstSampleResult.task!.firstSampleTaskCode,
  sourceFirstSampleCode: firstSampleResult.task!.sampleCode,
  sourceTechPackVersionId: 'tpv-project-level-first-order',
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳样衣间',
  targetSite: '深圳',
  sampleChainMode: '复用首版结论',
  operatorName: '测试用户',
})
assert.equal(firstOrderResult.ok, true, firstOrderResult.message)
assert.equal(firstOrderResult.task?.projectNodeId, '')
const firstOrderRelation = listProjectRelationsByProject(project.projectId).find(
  (item) => item.sourceObjectId === firstOrderResult.task?.firstOrderSampleTaskId,
)
assert.ok(firstOrderRelation, '首单样衣任务创建时必须立即持久化项目级关系')
assert.equal(firstOrderRelation.projectNodeId || '', '')
assert.equal(firstOrderRelation.stepCode, '')

updateFirstOrderSampleTask(firstOrderResult.task!.firstOrderSampleTaskId, {
  samplePlanLines: [{
    lineId: 'line-project-level-first-order',
    lineCode: 'FOS-LINE-001',
    sampleMaterialMode: '正确布',
    targetSite: '深圳',
    factoryId: 'factory-shenzhen-01',
    factoryName: '深圳样衣间',
    sampleCode: firstOrderResult.task!.sampleCode,
    sampleStatus: '已完成',
    note: '',
  }],
  finalReferenceNote: '首单样衣作为大货参照。',
  conclusionResult: '通过',
  conclusionNote: '首单样衣确认通过。',
  confirmedAt: '2026-07-31 10:30',
  confirmedBy: '测试用户',
})
const completedFirstOrder = completeFirstOrderSampleTask(firstOrderResult.task!.firstOrderSampleTaskId, '测试用户')
assert.equal(completedFirstOrder.ok, true, completedFirstOrder.message)
assert.equal(
  listProjectRelationsByProject(project.projectId).find(
    (item) => item.sourceObjectId === firstOrderResult.task?.firstOrderSampleTaskId,
  )?.sourceStatus,
  '已完成',
  '首单样衣任务完成后必须统一回写项目级关系完成态',
)

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
  revisionScopeCodes: ['PATTERN', 'PRINT'],
  revisionScopeNames: ['版型结构', '花型颜色'],
  sampleQty: 1,
  issueSummary: '测款结论要求调整版型。',
  evidenceSummary: '试穿反馈确认版型需要修改。',
  operatorName: '测试用户',
})
assert.equal(revisionResult.ok, true, revisionResult.message)
if (revisionResult.ok) {
  const downstream = createDownstreamTasksFromRevision(
    revisionResult.task.revisionTaskId,
    ['PLATE', 'PRINT', 'FIRST_SAMPLE', 'FIRST_ORDER_SAMPLE'],
  )
  assert.equal(downstream.successCount, 4, '改版任务四类下游均不得依赖已删除的专业项目节点')
  assert.ok(
    !downstream.failureMessages.some((message) => message.includes('节点')),
    '缺少任何专业项目节点不得阻断改版下游任务',
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

  const downstreamPattern = listPatternTasks().find(
    (item) => item.upstreamObjectId === revisionResult.task.revisionTaskId,
  )
  const downstreamFirstSample = listFirstSampleTasks().find(
    (item) => item.upstreamObjectId === revisionResult.task.revisionTaskId,
  )
  const downstreamFirstOrder = listFirstOrderSampleTasks().find(
    (item) => item.upstreamObjectId === revisionResult.task.revisionTaskId,
  )
  assert.ok(downstreamPattern, '应能按改版任务上游关系查到花型下游任务')
  assert.ok(downstreamFirstSample, '应能按改版任务上游关系查到首版样衣下游任务')
  assert.ok(downstreamFirstOrder, '应能在不存在 FIRST_ORDER_SAMPLE 项目节点时创建首单样衣下游任务')

  for (const task of [
    {
      id: downstreamPattern?.patternTaskId,
      module: '花型任务',
      type: '花型任务',
    },
    {
      id: downstreamFirstSample?.firstSampleTaskId,
      module: '首版样衣打样',
      type: '首版样衣打样任务',
    },
    {
      id: downstreamFirstOrder?.firstOrderSampleTaskId,
      module: '首单样衣打样',
      type: '首单样衣打样任务',
    },
  ]) {
    const relation = listProjectRelationsByProject(revisionProject.projectId).find(
      (item) => item.sourceObjectId === task.id,
    )
    assert.ok(relation, `${task.module}必须持久化商品项目关系`)
    assert.equal(relation.projectId, revisionProject.projectId)
    assert.equal(relation.projectCode, revisionProject.projectCode)
    assert.equal(relation.sourceModule, task.module)
    assert.equal(relation.sourceObjectType, task.type)
    assert.equal(relation.projectNodeId || '', '')
    assert.equal(relation.stepCode, '')
    assert.equal(relation.stepName, '')
  }

  const repeated = createDownstreamTasksFromRevision(
    revisionResult.task.revisionTaskId,
    ['PLATE', 'PRINT', 'FIRST_SAMPLE', 'FIRST_ORDER_SAMPLE'],
  )
  assert.equal(repeated.successCount, 0, '同一改版任务不得重复创建制版下游任务')
  assert.equal(
    listPlateMakingTasks().filter((item) => item.upstreamObjectId === revisionResult.task.revisionTaskId).length,
    1,
    '重复创建被阻止后只能保留一张制版下游任务',
  )
}

const completablePlate = listPlateMakingTasks().find((item) => item.plateTaskId === 'PT-20260425-008')
assert.ok(completablePlate, '必须存在可完成的制版任务演示数据')
const completedPlate = completePlateMakingTask(completablePlate!.plateTaskId, '测试用户')
assert.equal(completedPlate.ok, true, completedPlate.message)
assert.equal(
  listProjectRelationsByProject(completablePlate!.projectId).find(
    (item) => item.sourceObjectId === completablePlate!.plateTaskId,
  )?.sourceStatus,
  '已完成',
  '制版任务完成后必须回写项目关系完成态',
)

const completablePattern = listPatternTasks().find((item) => item.patternTaskId === 'AT-20260405-015')
assert.ok(completablePattern, '必须存在可完成的花型任务演示数据')
const completedPattern = completePatternTask(completablePattern!.patternTaskId, '测试用户')
assert.equal(completedPattern.ok, true, completedPattern.message)
assert.equal(
  listProjectRelationsByProject(completablePattern!.projectId).find(
    (item) => item.sourceObjectId === completablePattern!.patternTaskId,
  )?.sourceStatus,
  '已完成',
  '花型任务完成后必须回写项目关系完成态',
)

const completableRevision = getRevisionTaskById('RT-20260402-018')
assert.ok(completableRevision, '必须存在可完成的改版任务演示数据')
updateRevisionTask(completableRevision!.revisionTaskId, {
  status: '已生成技术包',
  linkedTechPackVersionId: 'tpv-project-relation-completion-test',
  linkedTechPackVersionCode: 'TPV-RELATION-COMPLETION-TEST',
  generatedNewTechPackVersionFlag: true,
  liveRetestRequired: false,
})
const completedRevision = completeRevisionTask(completableRevision!.revisionTaskId, '测试用户')
assert.equal(completedRevision.ok, true, completedRevision.message)
assert.equal(
  listProjectRelationsByProject(completableRevision!.projectId).find(
    (item) => item.sourceObjectId === completableRevision!.revisionTaskId,
  )?.sourceStatus,
  '已完成',
  '改版任务完成后必须回写项目关系完成态',
)

console.log('pcs-professional-task-project-binding.spec.ts PASS')
