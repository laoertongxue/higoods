import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

const feasibilityOptions =
  getProjectWorkItemContract('FEASIBILITY_REVIEW').fieldDefinitions
    .find((field) => field.fieldKey === 'reviewConclusion')
    ?.options?.map((option) => option.value) ?? []

assert.deepEqual(
  feasibilityOptions,
  ['进入测款', '样衣退回'],
  '商品测款项目内的可行性判断不得包含“重新改版出样衣”',
)

const decisionFlowSource = readFileSync(
  new URL('../src/data/pcs-project-decision-flow-service.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(
  decisionFlowSource,
  /routeProjectToRevisionTask|重新改版出样衣|workItemTypeCode === 'REVISION_TASK'/,
  '商品测款决策流不得创建或查找改版任务',
)

console.log('pcs-project-feasibility-boundary.spec.ts PASS')
