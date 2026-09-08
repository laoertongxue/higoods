import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

const snapshotBuilderSource = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
const runtimeSource = read('src/data/fcs/production-order-tech-pack-runtime.ts')
const artifactGenerationSource = read('src/data/fcs/production-artifact-generation.ts')
const processTasksSource = read('src/data/fcs/process-tasks.ts')

;[
  'routeStepNo',
  'routeLaneNo',
  'routeParallelGroupId',
  'routeParallelGroupName',
  'routeObjectKey',
  'inputObjectType',
  'outputObjectType',
  'consumedBomItemIds',
  'predecessorEntryIds',
].forEach((token) => {
  assert(snapshotBuilderSource.includes(token), `生产单技术包快照构建必须冻结路线字段：${token}`)
  assert(runtimeSource.includes(token), `生产单技术包运行时克隆必须保留路线字段：${token}`)
})
assert(
  snapshotBuilderSource.includes("processRouteStatus !== 'CONFIRMED'"),
  '生产单冻结技术包前必须要求正式技术包路线已确认',
)
assert(artifactGenerationSource.includes('routeStepNo'), '任务产物排序必须优先读取冻结路线步骤')
assert(artifactGenerationSource.includes('routeLaneNo'), '任务产物排序必须优先读取冻结路线并行线')
;[
  'sourceEntryId?: string',
  'sourceEntryIds?: string[]',
  'predecessorEntryIds?: string[]',
  'routeObjectKey?: string',
  'inputObjectType?: TechnicalProcessObjectType',
  'outputObjectType?: TechnicalProcessObjectType',
].forEach((token) => {
  assert(processTasksSource.includes(token), `ProcessTask 必须写入冻结路线字段：${token}`)
})
assert(processTasksSource.includes('buildRouteTaskDependencyIds'), 'ProcessTask 依赖必须按冻结路线生成')

const processTasksDomain = await import('../src/data/fcs/process-tasks.ts')
const routeDependencyMap = processTasksDomain.buildRouteTaskDependencyIds([
  { taskId: 'source-a-sku-1', sourceEntryId: 'entry-a', predecessorEntryIds: [], routeStepNo: 1 },
  { taskId: 'source-a-sku-2', sourceEntryId: 'entry-a', predecessorEntryIds: [], routeStepNo: 1 },
  { taskId: 'parallel-b', sourceEntryId: 'entry-b', predecessorEntryIds: ['entry-a'], routeStepNo: 2 },
  { taskId: 'parallel-c', sourceEntryId: 'entry-c', predecessorEntryIds: ['entry-a'], routeStepNo: 2 },
  { taskId: 'merge-d', sourceEntryId: 'entry-d', predecessorEntryIds: ['entry-b', 'entry-c'], routeStepNo: 3 },
  { taskId: 'same-step-but-unconnected', sourceEntryId: 'entry-e', predecessorEntryIds: [], routeStepNo: 3 },
])
assert.deepEqual(routeDependencyMap.get('source-a-sku-1'), [], '路线起点不应有前置任务')
assert.deepEqual(routeDependencyMap.get('source-a-sku-2'), [], '同一 occurrence 拆出的任务不应互相依赖')
assert.deepEqual(routeDependencyMap.get('parallel-b'), ['source-a-sku-1', 'source-a-sku-2'], '前置 occurrence 拆出多张任务时必须全部可追溯')
assert.deepEqual(routeDependencyMap.get('parallel-c'), ['source-a-sku-1', 'source-a-sku-2'], '同一显式前置可以扇出到多个后置任务')
assert.deepEqual(routeDependencyMap.get('merge-d'), ['parallel-b', 'parallel-c'], '汇合任务只依赖显式前置 occurrence 对应任务')
assert.deepEqual(routeDependencyMap.get('same-step-but-unconnected'), [], '相邻步骤或相同步骤不能推导出隐式依赖')

await import('./check-fcs-tech-pack-snapshot-consumption.ts')
