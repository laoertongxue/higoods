import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { FIRST_SAMPLE_TASK_STATUS_LIST } from '../src/data/pcs-first-sample-types.ts'

const formalStatuses = [...FIRST_SAMPLE_TASK_STATUS_LIST]
assert.deepEqual(formalStatuses, ['草稿', '待处理', '打样中', '待确认', '已通过', '需改版', '已取消'])
assert.equal(formalStatuses.includes('需补测' as never), false)
assert.equal(formalStatuses.includes('需补样' as never), false)

const repositorySource = readFileSync(
  new URL('../src/data/pcs-first-sample-repository.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(
  repositorySource,
  /status === '需补样'|status === '需补测'/,
  '首版样衣仓储只处理当前任务状态，不保留老任务状态迁移逻辑',
)
