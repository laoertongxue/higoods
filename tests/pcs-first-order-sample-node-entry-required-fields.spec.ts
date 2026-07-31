import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { resetFirstOrderSampleTaskRepository } from '../src/data/pcs-first-order-sample-repository.ts'
import { listFirstSampleTasks, resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { listFirstOrderSourceFirstSampleOptions } from '../src/data/pcs-first-order-sample-project-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()

const sourceFirstSample = listFirstSampleTasks().find((task) => task.projectId && task.sampleCode)
assert.ok(sourceFirstSample, '缺少首单样衣来源任务')
const project = listProjects().find((item) => item.projectId === sourceFirstSample.projectId)
assert.ok(project)
assert.ok(listFirstOrderSourceFirstSampleOptions(project.projectId).length > 0)
assert.ok(
  listProjectNodes(project.projectId).every((node) => node.stepCode !== 'FIRST_ORDER_SAMPLE'),
  '固定五步项目不得再提供首单样衣节点入口',
)

const source = readFileSync(resolve(process.cwd(), 'src/data/pcs-first-order-sample-project-writeback.ts'), 'utf8')
assert.doesNotMatch(source, /createOrUpdateFirstOrderSampleTaskFromProjectNode/)
assert.doesNotMatch(source, /syncFirstOrderSampleTaskToProjectNode/)

console.log('pcs-first-order-sample-node-entry-required-fields.spec.ts PASS')
