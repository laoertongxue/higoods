import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getFirstSampleTaskById,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import { getProjectById, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()

const task = getFirstSampleTaskById('FS-20260425-002')
assert.ok(task, '缺少独立首版样衣任务')
assert.equal(task.projectNodeId, '')
assert.ok(getProjectById(task.projectId), '首版样衣任务必须关联商品项目')

const source = readFileSync(resolve(process.cwd(), 'src/data/pcs-first-sample-project-writeback.ts'), 'utf8')
assert.doesNotMatch(source, /createOrUpdateFirstSampleTaskFromProjectNode/)
assert.doesNotMatch(source, /syncFirstSampleTaskToProjectNode/)

console.log('pcs-first-sample-node-entry-required-fields.spec.ts PASS')
