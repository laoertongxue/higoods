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
  'routeParallelAcceptanceMode',
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
;['routeStepNo?: number', 'routeLaneNo?: number', 'routeParallelGroupId?: string'].forEach((token) => {
  assert(processTasksSource.includes(token), `ProcessTask 必须写入冻结路线字段：${token}`)
})
assert(processTasksSource.includes('buildRouteTaskDependencyIds'), 'ProcessTask 依赖必须按冻结路线生成')

const processTasksDomain = await import('../src/data/fcs/process-tasks.ts')
const routeDependencyMap = processTasksDomain.buildRouteTaskDependencyIds([
  { taskId: 'route-step-1', routeStepNo: 1, routeLaneNo: 1 },
  { taskId: 'route-step-2-a', routeStepNo: 2, routeLaneNo: 1, routeParallelGroupId: 'G2' },
  { taskId: 'route-step-2-b', routeStepNo: 2, routeLaneNo: 2, routeParallelGroupId: 'G2' },
  { taskId: 'route-step-3', routeStepNo: 3, routeLaneNo: 1 },
])
assert.deepEqual(routeDependencyMap.get('route-step-1'), [], '首个串行步骤不应有前置依赖')
assert.deepEqual(routeDependencyMap.get('route-step-2-a'), ['route-step-1'], '并行组首个任务只依赖前一步')
assert.deepEqual(routeDependencyMap.get('route-step-2-b'), ['route-step-1'], '同一步并行任务不应互相依赖')
assert.deepEqual(routeDependencyMap.get('route-step-3'), ['route-step-2-a', 'route-step-2-b'], '并行组后一步必须依赖组内全部任务')

await import('./check-fcs-tech-pack-snapshot-consumption.ts')
