import assert from 'node:assert/strict'

import { listFirstOrderSampleTasks } from '../src/data/pcs-first-order-sample-repository.ts'
import { listFirstSampleTasks } from '../src/data/pcs-first-sample-repository.ts'
import { listProjectNodes, listProjects } from '../src/data/pcs-project-repository.ts'
import { createFirstOrderSampleTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'

const sourceFirstSample = listFirstSampleTasks().find((task) => task.projectId && task.sampleCode)
assert.ok(sourceFirstSample, '测试必须存在可作为首单来源的正式首版样衣任务')
const project = listProjects().find((item) => item.projectId === sourceFirstSample?.projectId)
assert.ok(project)
const projectNodesBeforeCreate = listProjectNodes(project!.projectId)
const existingCount = listFirstOrderSampleTasks().length

const result = createFirstOrderSampleTaskWithProjectRelation({
  firstOrderSampleTaskId: `FOS-INDEPENDENT-ENTRY-${existingCount + 1}`,
  firstOrderSampleTaskCode: `FOS-INDEPENDENT-ENTRY-${existingCount + 1}`,
  projectId: project!.projectId,
  title: '真实页面入口首单样衣独立任务',
  sourceType: '首版样衣打样',
  upstreamModule: '首版样衣打样',
  upstreamObjectType: '首版样衣打样任务',
  upstreamObjectId: sourceFirstSample!.firstSampleTaskId,
  upstreamObjectCode: sourceFirstSample!.firstSampleTaskCode,
  sampleChainMode: '复用首版结论',
  samplePlanLines: [],
  operatorName: '入口回归测试',
})

assert.equal(result.ok, true, result.message)
assert.equal(result.task?.projectId, project!.projectId)
assert.equal(result.task?.projectNodeId, '')
assert.equal(result.task?.sourceFirstSampleTaskId, sourceFirstSample!.firstSampleTaskId)
assert.equal(result.task?.upstreamObjectId, sourceFirstSample!.firstSampleTaskId)
assert.ok(result.relation, '首单样衣入口必须立即生成商品项目关系')
assert.equal(result.relation?.projectNodeId, null, '首单样衣关系不得生成已删除专业节点关系')
assert.equal(result.relation?.stepCode, '')
assert.deepEqual(
  listProjectNodes(project!.projectId),
  projectNodesBeforeCreate,
  '真实首单样衣入口创建前后不得改写商品项目固定节点',
)

console.log('pcs-first-order-sample-independent-entry.spec.ts PASS')
