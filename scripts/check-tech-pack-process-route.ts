import assert from 'node:assert/strict'

import {
  areRouteEntriesContinuous,
  normalizeProcessRouteEntries,
  sortProcessRouteEntries,
} from '../src/data/tech-pack-process-route.ts'

type CheckRouteEntry = {
  id: string
  stageCode: string
  processCode: string
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
}

function ids(entries: Array<{ id: string }>): string[] {
  return entries.map((entry) => entry.id)
}

const singleEntry: CheckRouteEntry = { id: 'single', stageCode: 'PREP', processCode: 'CUTTING' }
assert.deepEqual(normalizeProcessRouteEntries([]), [], '空输入应返回空数组')
assert.deepEqual(ids(normalizeProcessRouteEntries([singleEntry])), ['single'], '单条输入应保留原条目')

const missingRouteEntries: CheckRouteEntry[] = [
  { id: 'a', stageCode: 'PREP', processCode: 'CUTTING' },
  { id: 'b', stageCode: 'PROD', processCode: 'SEWING' },
]
assert.deepEqual(
  normalizeProcessRouteEntries(missingRouteEntries).map((entry) => entry.routeStepNo),
  [1, 2],
  '缺 routeStepNo 时应从第 1 步开始归一化',
)

const sameSortKeyEntries: CheckRouteEntry[] = [
  { id: 'z-last-id', stageCode: 'PROD', processCode: 'SEWING', routeStepNo: 2, routeLaneNo: 1 },
  { id: 'a-first-id', stageCode: 'PROD', processCode: 'SEWING', routeStepNo: 2, routeLaneNo: 1 },
]
assert.deepEqual(
  ids(sortProcessRouteEntries(sameSortKeyEntries)),
  ['z-last-id', 'a-first-id'],
  '相同排序键时 sortProcessRouteEntries 必须保留原数组顺序',
)
assert.deepEqual(
  ids(normalizeProcessRouteEntries(sameSortKeyEntries)),
  ['z-last-id', 'a-first-id'],
  '相同排序键时 normalizeProcessRouteEntries 必须保留原数组顺序',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'step-1', routeStepNo: 1 },
    { id: 'step-2', routeStepNo: 2 },
  ]).allowed,
  true,
  '串行相邻步骤应允许连续判断',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'step-1', routeStepNo: 1 },
    { id: 'step-3', routeStepNo: 3 },
  ]).allowed,
  false,
  '路线步骤断档时不允许连续判断',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'parallel-a', routeStepNo: 2, routeParallelGroupId: 'G1' },
    { id: 'parallel-b', routeStepNo: 2, routeParallelGroupId: 'G1' },
  ]).allowed,
  false,
  '同一步并行默认不允许连续判断',
)

assert.equal(
  areRouteEntriesContinuous([
    { id: 'parallel-a', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
    { id: 'parallel-b', routeStepNo: 2, routeParallelGroupId: 'G1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
  ]).allowed,
  true,
  '同一步并行且允许整体承接时，本批内部连续判断应允许',
)

console.log('tech-pack process route checks passed')
