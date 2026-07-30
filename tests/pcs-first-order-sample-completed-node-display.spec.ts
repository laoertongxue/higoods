import assert from 'node:assert/strict'

import { listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import {
  getFirstOrderSampleTaskById,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { renderPcsFirstOrderSampleTaskDetailPage } from '../src/pages/pcs-engineering-tasks.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()

const task = getFirstOrderSampleTaskById('FOS-20260425-003')
assert.ok(task, '缺少首单样衣完成展示 mock 任务')
assert.equal(task.projectNodeId, '')
assert.equal(task.status, '已通过')
assert.equal(task.sourceFirstSampleTaskId, 'FSD-20260425-003')
assert.equal(task.sourceFirstSampleTaskCode, 'FSD-20260425-003')
assert.equal(task.sourceFirstSampleCode, 'FS-RESULT-25003')
assert.equal(task.sourceTechPackVersionId, 'TDV-ID-0008')
assert.equal(task.sourceTechPackVersionLabel, 'V2')
assert.equal(task.factoryName, '深圳工厂01')
assert.equal(task.sampleChainMode, '复用首版结论')
assert.equal(task.sampleCode, 'FOS-RESULT-25001')
assert.equal(task.conclusionResult, '通过')
assert.equal(task.confirmedAt, '2026-04-25 11:20')
assert.equal(task.confirmedBy, '张娜')
assert.ok(
  listProjectNodes(task.projectId).every((node) => node.workItemTypeCode !== 'FIRST_ORDER_SAMPLE'),
  '完成态首单样衣只在专业任务模块展示，不得恢复固定流程节点',
)

const html = renderPcsFirstOrderSampleTaskDetailPage(task.firstOrderSampleTaskId)
assert.match(html, /FOS-RESULT-25001/)
assert.match(html, /首版样衣确认通过，首单阶段直接沿用/)

console.log('pcs-first-order-sample-completed-node-display.spec.ts PASS')
