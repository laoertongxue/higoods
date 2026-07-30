import assert from 'node:assert/strict'

import { listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import {
  getFirstOrderSampleTaskById,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import {
  renderPcsFirstOrderSampleTaskDetailPage,
  renderPcsFirstOrderSampleTaskPage,
} from '../src/pages/pcs-engineering-tasks.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()

const incomplete = getFirstOrderSampleTaskById('FOS-20260425-002')
assert.ok(incomplete, '缺少首单样衣已建未补齐场景')
assert.equal(incomplete.projectNodeId, '')
assert.equal(incomplete.status, '打样中')
assert.equal(incomplete.sourceFirstSampleTaskCode, 'FSD-20260425-002')
assert.equal(incomplete.sourceTechPackVersionId, 'TDV-ID-0007')
assert.equal(incomplete.factoryName, '深圳工厂01')
assert.equal(incomplete.samplePlanLines.length, 0)
assert.equal(incomplete.sampleCode, '')
assert.equal(incomplete.conclusionResult, '')

const incompleteHtml = renderPcsFirstOrderSampleTaskDetailPage(incomplete.firstOrderSampleTaskId)
assert.match(incompleteHtml, /FOS-20260425-002/)
assert.match(incompleteHtml, /深圳工厂01/)

const completed = getFirstOrderSampleTaskById('FOS-20260425-003')
assert.ok(completed, '缺少首单样衣已通过场景')
assert.equal(completed.projectNodeId, '')
assert.equal(completed.status, '已通过')
assert.equal(completed.sourceFirstSampleTaskCode, 'FSD-20260425-003')
assert.equal(completed.sampleCode, 'FOS-RESULT-25001')
assert.equal(completed.conclusionResult, '通过')
assert.equal(completed.confirmedBy, '张娜')

const completedHtml = renderPcsFirstOrderSampleTaskDetailPage(completed.firstOrderSampleTaskId)
assert.match(completedHtml, /FOS-RESULT-25001/)
assert.match(completedHtml, /首版样衣确认通过，首单阶段直接沿用/)

const listHtml = renderPcsFirstOrderSampleTaskPage()
assert.match(listHtml, /FOS-20260425-002/)
assert.match(listHtml, /FOS-20260425-003/)
assert.ok(
  [incomplete, completed].every((task) =>
    listProjectNodes(task.projectId).every((node) => node.stepCode !== 'FIRST_ORDER_SAMPLE'),
  ),
  '两类首单样衣场景均不得恢复固定流程节点',
)

console.log('pcs-first-order-sample-mock-scenarios.spec.ts PASS')
