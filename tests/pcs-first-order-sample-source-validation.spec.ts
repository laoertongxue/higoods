import assert from 'node:assert/strict'

import {
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import {
  listFirstSampleTasks,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import {
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { createFirstOrderSampleTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const passedSources = listFirstSampleTasks().filter(
  (task) => task.projectId && task.status === '已通过' && task.sampleCode,
)
assert.ok(passedSources.length >= 2, '测试需要至少两个不同项目的已通过首版样衣任务')
const source = passedSources[0]
const crossProjectSource = passedSources.find((task) => task.projectId !== source.projectId)
assert.ok(crossProjectSource, '测试需要另一商品项目的已通过首版样衣任务')
const notPassedSource = listFirstSampleTasks().find(
  (task) => task.projectId === source.projectId && task.status !== '已通过',
)

function createInput(id: string) {
  return {
    firstOrderSampleTaskId: id,
    firstOrderSampleTaskCode: id,
    projectId: source.projectId,
    title: `首单来源校验-${id}`,
    sourceType: '首版样衣打样' as const,
    upstreamModule: '首版样衣打样',
    upstreamObjectType: '首版样衣打样任务',
    upstreamObjectId: source.firstSampleTaskId,
    upstreamObjectCode: source.firstSampleTaskCode,
    sourceFirstSampleTaskId: source.firstSampleTaskId,
    sourceFirstSampleTaskCode: '伪造任务编码',
    sourceFirstSampleCode: '伪造首版结果',
    sampleChainMode: '复用首版结论' as const,
    operatorName: '首单来源校验',
  }
}

const valid = createFirstOrderSampleTaskWithProjectRelation(createInput('FOS-SOURCE-VALID'))
assert.equal(valid.ok, true, valid.message)
assert.equal(valid.task?.sourceFirstSampleTaskId, source.firstSampleTaskId)
assert.equal(valid.task?.sourceFirstSampleTaskCode, source.firstSampleTaskCode)
assert.equal(valid.task?.sourceFirstSampleCode, source.sampleCode)

const crossProject = createFirstOrderSampleTaskWithProjectRelation({
  ...createInput('FOS-SOURCE-CROSS-PROJECT'),
  upstreamObjectId: crossProjectSource!.firstSampleTaskId,
  upstreamObjectCode: crossProjectSource!.firstSampleTaskCode,
  sourceFirstSampleTaskId: crossProjectSource!.firstSampleTaskId,
})
assert.equal(crossProject.ok, false)
assert.match(crossProject.message, /同一商品项目|不属于当前商品项目/)

if (notPassedSource) {
  const notPassed = createFirstOrderSampleTaskWithProjectRelation({
    ...createInput('FOS-SOURCE-NOT-PASSED'),
    upstreamObjectId: notPassedSource.firstSampleTaskId,
    upstreamObjectCode: notPassedSource.firstSampleTaskCode,
    sourceFirstSampleTaskId: notPassedSource.firstSampleTaskId,
  })
  assert.equal(notPassed.ok, false)
  assert.match(notPassed.message, /已通过/)
}

const missing = createFirstOrderSampleTaskWithProjectRelation({
  ...createInput('FOS-SOURCE-MISSING'),
  upstreamObjectId: '',
  upstreamObjectCode: '',
  sourceFirstSampleTaskId: '',
  sourceFirstSampleTaskCode: '',
  sourceFirstSampleCode: '',
})
assert.equal(missing.ok, false)
assert.match(missing.message, /来源首版样衣任务/)

console.log('pcs-first-order-sample-source-validation.spec.ts PASS')
