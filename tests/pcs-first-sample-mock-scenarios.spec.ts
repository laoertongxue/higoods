import assert from 'node:assert/strict'

import { getProjectById, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasks,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()

const tasks = listFirstSampleTasks()
assert.ok(tasks.length >= 8, '首版样衣模块应保留足够的独立任务场景')
assert.ok(tasks.every((task) => task.projectId && !task.projectNodeId), '独立首版样衣任务不得依赖商品项目节点')
assert.ok(tasks.every((task) => getProjectById(task.projectId)), '首版样衣任务关联的来源项目必须存在')

const incompleteTask = getFirstSampleTaskById('FS-20260425-002')
assert.ok(incompleteTask, '缺少已建未补齐首版样衣任务')
assert.equal(incompleteTask.sourceTaskType, '制版任务')
assert.equal(incompleteTask.sourceTechPackVersionCode, 'TDV-20260425-002')
assert.equal(incompleteTask.factoryName, '深圳工厂01')
assert.equal(incompleteTask.sampleCode, '')
assert.deepEqual(incompleteTask.sampleImageIds, [])
assert.equal(incompleteTask.fitConfirmationSummary, '')

const completedTask = getFirstSampleTaskById('FS-20260425-008')
assert.ok(completedTask, '缺少已完成首版样衣任务')
assert.equal(completedTask.sourceTaskCode, 'PT-20260425-008')
assert.equal(completedTask.sourceTechPackVersionCode, 'TDV-20260425-008')
assert.equal(completedTask.factoryName, '深圳工厂02')
assert.equal(completedTask.sampleCode, 'FS-RESULT-25001')
assert.deepEqual(completedTask.sampleImageIds, ['mock://sample-result/fs-25001-1', 'mock://sample-result/fs-25001-2'])
assert.equal(completedTask.reuseAsFirstOrderBasisFlag, true)
assert.equal(completedTask.confirmedAt, '2026-04-25 10:30')
