import assert from 'node:assert/strict'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'

assert.throws(
  () => getProjectStepDefinition('PATTERN_TASK' as never),
  /未找到商品项目定义：PATTERN_TASK/,
  '制版任务不再作为商品项目工作项，必须由设计改款任务或工程主单承载',
)

console.log('pcs-plate-making-work-item-contract.spec.ts PASS')
