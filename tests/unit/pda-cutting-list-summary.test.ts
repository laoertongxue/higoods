import test from 'node:test'
import assert from 'node:assert/strict'
import { listPdaTaskFlowTasks, isCuttingSpecialTask, getPdaCuttingTaskListSummary, getPdaCuttingTaskSnapshot } from '../../src/data/fcs/pda-cutting-execution-source.ts'

test('PDA 列表轻量摘要与详情的归属、数量、物料和下一步一致', () => {
  const tasks = listPdaTaskFlowTasks().filter(isCuttingSpecialTask).slice(0, 5)
  assert.ok(tasks.length > 0)
  for (const task of tasks) {
    const summary = getPdaCuttingTaskListSummary(task.taskId)
    const detail = getPdaCuttingTaskSnapshot(task.taskId)
    assert.equal(Boolean(summary), Boolean(detail))
    if (!summary || !detail) continue
    for (const key of ['productionOrderNo', 'cutPieceOrderCount', 'nextRecommendedAction', 'materialAlias', 'materialSku', 'materialTypeLabel', 'orderQty'] as const) assert.equal(summary[key], detail[key], `${task.taskId}: ${key}`)
    assert.deepEqual(summary.cutOrderGroups, detail.cutOrderGroups)
  }
})
