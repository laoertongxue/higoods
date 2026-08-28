import assert from 'node:assert/strict'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'

assert.throws(
  () => getProjectStepDefinition('PATTERN_ARTWORK_TASK' as never),
  /未找到商品项目定义：PATTERN_ARTWORK_TASK/,
  '花型任务不再作为商品项目工作项，必须由设计改款任务或工程主单承载',
)

console.log('pcs-pattern-task-work-item-contract-sync.spec.ts PASS')
