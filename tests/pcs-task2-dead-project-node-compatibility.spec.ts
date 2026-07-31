import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/data/pcs-task-project-relation-writeback.ts', import.meta.url),
  'utf8',
)

assert.doesNotMatch(
  source,
  /syncPlateResultToRevisionProjection/,
  '不得保留无调用的制版结果回写旧改版项目节点兼容函数',
)
assert.doesNotMatch(
  source,
  /function updateTaskNode/,
  '不得保留无调用的专业任务项目节点兼容函数',
)

console.log('pcs-task2-dead-project-node-compatibility.spec.ts PASS')
