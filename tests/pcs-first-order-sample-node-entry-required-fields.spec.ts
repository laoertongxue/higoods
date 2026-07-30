import assert from 'node:assert/strict'

import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetFirstOrderSampleTaskRepository } from '../src/data/pcs-first-order-sample-repository.ts'
import {
  createOrUpdateFirstOrderSampleTaskFromProjectNode,
  listFirstOrderSourceFirstSampleOptions,
} from '../src/data/pcs-first-order-sample-project-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-202603-004')
assert.ok(project, '缺少首单样衣来源演示项目')
assert.ok(listFirstOrderSourceFirstSampleOptions(project.projectId).length > 0)
assert.ok(
  listProjectNodes(project.projectId).every((node) => node.stepCode !== 'FIRST_ORDER_SAMPLE'),
  '固定五步项目不得再提供首单样衣节点入口',
)

const legacyEntry = createOrUpdateFirstOrderSampleTaskFromProjectNode({
  projectId: project.projectId,
  projectNodeId: '',
  sourceFirstSampleTaskId: '',
  sourceTechPackVersionId: '',
  factoryId: '',
  targetSite: '',
  sampleChainMode: '',
  specialSceneReasonCodes: [],
  operatorName: '测试用户',
})
assert.equal(legacyEntry.ok, false)
assert.match(legacyEntry.message, /未找到首单样衣打样节点/)

console.log('pcs-first-order-sample-node-entry-required-fields.spec.ts PASS')
