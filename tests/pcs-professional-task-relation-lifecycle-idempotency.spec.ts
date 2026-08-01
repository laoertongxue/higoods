import assert from 'node:assert/strict'

import {
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import {
  updateFirstOrderSampleTaskDetailAndSync,
} from '../src/data/pcs-first-order-sample-project-writeback.ts'
import {
  listFirstSampleTasks,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import {
  updateFirstSampleTaskDetailAndSync,
} from '../src/data/pcs-first-sample-project-writeback.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import {
  listProjectRelationsByTaskSource,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  completeFirstOrderSampleTask,
  completeFirstSampleTask,
  createFirstOrderSampleTaskWithProjectRelation,
  createFirstSampleTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const source = listFirstSampleTasks().find(
  (task) => task.projectId && task.status === '已通过' && task.sampleCode,
)
assert.ok(source, '测试需要一条已通过首版样衣作为首单真实来源')

const firstSample = createFirstSampleTaskWithProjectRelation({
  firstSampleTaskId: 'FS-RELATION-LIFECYCLE',
  firstSampleTaskCode: 'FS-RELATION-LIFECYCLE',
  projectId: source.projectId,
  title: '首版关系生命周期',
  sourceType: '人工创建',
  sourceTechPackVersionId: 'TPV-RELATION-LIFECYCLE',
  sourceTechPackVersionCode: 'TPV-RELATION-LIFECYCLE',
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  sampleMaterialMode: '正确布',
  samplePurpose: '首版确认',
  sampleCode: 'FS-RELATION-RESULT',
  sampleImageIds: ['mock://first-sample/relation-result'],
  fitConfirmationSummary: '版型确认通过。',
  productionReadinessNote: '可作为生产准备依据。',
  confirmedAt: '2026-07-31 10:00',
  operatorName: '关系生命周期测试',
})
assert.equal(firstSample.ok, true, firstSample.message)

let firstSampleRelations = listProjectRelationsByTaskSource(
  '首版样衣打样',
  firstSample.task.firstSampleTaskId,
)
assert.equal(firstSampleRelations.length, 1)
assert.equal(firstSampleRelations[0].relationRole, '执行记录')
assert.equal(firstSampleRelations[0].sourceStatus, '待处理')

const firstSampleSaved = updateFirstSampleTaskDetailAndSync(
  firstSample.task.firstSampleTaskId,
  { status: '打样中' },
  '关系生命周期测试',
)
assert.equal(firstSampleSaved.ok, true, firstSampleSaved.message)
firstSampleRelations = listProjectRelationsByTaskSource(
  '首版样衣打样',
  firstSample.task.firstSampleTaskId,
)
assert.equal(firstSampleRelations.length, 1)
assert.equal(firstSampleRelations[0].sourceStatus, '打样中')

const firstSampleCompleted = completeFirstSampleTask(
  firstSample.task.firstSampleTaskId,
  '关系生命周期测试',
)
assert.equal(firstSampleCompleted.ok, true, firstSampleCompleted.message)
firstSampleRelations = listProjectRelationsByTaskSource(
  '首版样衣打样',
  firstSample.task.firstSampleTaskId,
)
assert.equal(firstSampleRelations.length, 1)
assert.equal(firstSampleRelations[0].sourceStatus, '已完成')

const firstOrder = createFirstOrderSampleTaskWithProjectRelation({
  firstOrderSampleTaskId: 'FOS-RELATION-LIFECYCLE',
  firstOrderSampleTaskCode: 'FOS-RELATION-LIFECYCLE',
  projectId: source.projectId,
  title: '首单关系生命周期',
  sourceType: '首版样衣打样',
  upstreamModule: '首版样衣打样',
  upstreamObjectType: '首版样衣打样任务',
  upstreamObjectId: source.firstSampleTaskId,
  upstreamObjectCode: source.firstSampleTaskCode,
  sourceFirstSampleTaskId: source.firstSampleTaskId,
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  patternVersion: 'P1',
  sampleChainMode: '复用首版结论',
  samplePlanLines: [{
    lineId: 'first-order-relation-line',
    sampleRole: '正确布确认样',
    materialMode: '正确布',
    quantity: 1,
    targetFactoryId: 'factory-shenzhen-01',
    targetFactoryName: '深圳工厂01',
    linkedSampleCode: 'FOS-RELATION-RESULT',
    status: '已确认',
    note: '',
  }],
  finalReferenceNote: '首单生产参照。',
  sampleCode: 'FOS-RELATION-RESULT',
  conclusionResult: '通过',
  conclusionNote: '首单确认通过。',
  confirmedAt: '2026-07-31 11:00',
  confirmedBy: '关系生命周期测试',
  operatorName: '关系生命周期测试',
})
assert.equal(firstOrder.ok, true, firstOrder.message)

let firstOrderRelations = listProjectRelationsByTaskSource(
  '首单样衣打样',
  firstOrder.task.firstOrderSampleTaskId,
)
assert.equal(firstOrderRelations.length, 1)
assert.equal(firstOrderRelations[0].relationRole, '执行记录')
assert.equal(firstOrderRelations[0].sourceStatus, '待处理')

const firstOrderSaved = updateFirstOrderSampleTaskDetailAndSync(
  firstOrder.task.firstOrderSampleTaskId,
  { status: '打样中' },
  '关系生命周期测试',
)
assert.equal(firstOrderSaved.ok, true, firstOrderSaved.message)
firstOrderRelations = listProjectRelationsByTaskSource(
  '首单样衣打样',
  firstOrder.task.firstOrderSampleTaskId,
)
assert.equal(firstOrderRelations.length, 1)
assert.equal(firstOrderRelations[0].sourceStatus, '打样中')

const firstOrderCompleted = completeFirstOrderSampleTask(
  firstOrder.task.firstOrderSampleTaskId,
  '关系生命周期测试',
)
assert.equal(firstOrderCompleted.ok, true, firstOrderCompleted.message)
firstOrderRelations = listProjectRelationsByTaskSource(
  '首单样衣打样',
  firstOrder.task.firstOrderSampleTaskId,
)
assert.equal(firstOrderRelations.length, 1)
assert.equal(firstOrderRelations[0].sourceStatus, '已完成')

console.log('pcs-professional-task-relation-lifecycle-idempotency.spec.ts PASS')
