import assert from 'node:assert/strict'

import {
  evaluateContinuousRuntimeTaskMerge,
  listRuntimeProcessTasks,
  listRuntimeTaskAllocatableGroups,
  type RuntimeProcessTask,
} from '../src/data/fcs/runtime-process-tasks.ts'
import type { TaskDetailRow } from '../src/data/fcs/task-detail-rows.ts'

function detailRow(taskId: string): TaskDetailRow {
  return {
    rowKey: `ROW-${taskId}`,
    taskId,
    rowType: 'COMPOSITE',
    rowLabel: '检查明细',
    qty: 100,
    uom: '件',
    dimensions: { GARMENT_SKU: 'SKU-CHECK' },
    sourceRefs: {
      orderId: 'PO-CHECK-CONTINUOUS',
      spuCode: 'SPU-CHECK',
      processCode: `PROCESS-${taskId}`,
      sourceEntryId: `ENTRY-${taskId}`,
      garmentSku: 'SKU-CHECK',
      garmentColor: '黑色',
    },
    sortKey: `SORT-${taskId}`,
  }
}

function runtimeTask(
  taskId: string,
  routeStepNo: number,
  routeLaneNo = 1,
  overrides: Partial<RuntimeProcessTask> = {},
): RuntimeProcessTask {
  const row = detailRow(taskId)
  return {
    taskId,
    taskNo: taskId,
    productionOrderId: 'PO-CHECK-CONTINUOUS',
    baseTaskId: taskId,
    baseQty: 100,
    baseDependsOnTaskIds: [],
    dependsOnTaskIds: [],
    seq: routeStepNo * 10 + routeLaneNo,
    qty: 100,
    qtyUnit: 'PIECE',
    processCode: `PROCESS-${taskId}`,
    processNameZh: `检查工序${routeStepNo}-${routeLaneNo}`,
    processBusinessCode: `PROCESS-${taskId}`,
    processBusinessName: `检查工序${routeStepNo}-${routeLaneNo}`,
    defaultDocType: 'TASK',
    taskUnitType: 'SINGLE_PROCESS_TASK',
    assignmentStatus: 'UNASSIGNED',
    status: 'NOT_STARTED',
    scopeType: 'ORDER',
    scopeKey: 'ORDER',
    scopeLabel: '整单',
    scopeQty: 100,
    scopeSkuLines: [{ skuCode: 'SKU-CHECK', size: 'M', color: '黑色', qty: 100 }],
    scopeDetailRows: [row],
    detailRows: [row],
    routeStepNo,
    routeLaneNo,
    routeParallelAcceptanceMode: 'INDEPENDENT_ONLY',
    ...overrides,
  } as RuntimeProcessTask
}

const serialTasks = [
  runtimeTask('SERIAL-1', 1, 1, {
    processCode: 'SEW',
    processNameZh: '车缝',
  }),
  runtimeTask('SERIAL-2', 2, 1, {
    processCode: 'POST_FINISHING',
    processNameZh: '后道',
  }),
]
const serialResult = evaluateContinuousRuntimeTaskMerge(['SERIAL-1', 'SERIAL-2'], serialTasks)
assert.equal(serialResult.ok, true, '相邻串行任务应可合并')

const serialWithoutSingleFactoryTasks = [
  runtimeTask('SERIAL-NO-SINGLE-FACTORY-A', 1, 1, {
    processCode: 'CUT_PANEL',
    processNameZh: '裁片',
  }),
  runtimeTask('SERIAL-NO-SINGLE-FACTORY-B', 2, 1, {
    processCode: 'DYE',
    processNameZh: '染色',
  }),
  runtimeTask('SERIAL-NO-SINGLE-FACTORY-C', 3, 1, {
    processCode: 'SEW',
    processNameZh: '车缝',
  }),
]
const serialWithoutSingleFactoryResult = evaluateContinuousRuntimeTaskMerge(
  ['SERIAL-NO-SINGLE-FACTORY-A', 'SERIAL-NO-SINGLE-FACTORY-B', 'SERIAL-NO-SINGLE-FACTORY-C'],
  serialWithoutSingleFactoryTasks,
)
assert.equal(serialWithoutSingleFactoryResult.ok, false, '串行连续工序合并必须存在同一工厂覆盖全部工序能力')
assert.match(
  serialWithoutSingleFactoryResult.message,
  /同一工厂.*连续工序.*全部工序能力/,
  '串行连续工序缺少同一工厂覆盖能力时必须返回中文原因',
)

const nonAdjacentTasks = [
  runtimeTask('NON-ADJACENT-1', 1),
  runtimeTask('NON-ADJACENT-3', 3),
]
const nonAdjacentResult = evaluateContinuousRuntimeTaskMerge(['NON-ADJACENT-1', 'NON-ADJACENT-3'], nonAdjacentTasks)
assert.equal(nonAdjacentResult.ok, false, '非相邻任务不可合并')
assert.match(nonAdjacentResult.message, /中间缺少第 2 步/, '非相邻任务必须返回中文原因')

const separateParallelTasks = [
  runtimeTask('PARALLEL-SEPARATE-A', 1, 1, {
    routeParallelGroupId: 'PARALLEL-SEPARATE',
    routeParallelGroupName: '默认分别承接组',
  }),
  runtimeTask('PARALLEL-SEPARATE-B', 1, 2, {
    routeParallelGroupId: 'PARALLEL-SEPARATE',
    routeParallelGroupName: '默认分别承接组',
  }),
  runtimeTask('PARALLEL-SEPARATE-C', 2),
]
const partialParallelResult = evaluateContinuousRuntimeTaskMerge(
  ['PARALLEL-SEPARATE-A', 'PARALLEL-SEPARATE-C'],
  separateParallelTasks,
)
assert.equal(partialParallelResult.ok, false, '并行组默认不可部分合并')
assert.match(partialParallelResult.message, /并行组未选择完整/, '并行组部分选择必须返回中文原因')
const separateParallelResult = evaluateContinuousRuntimeTaskMerge(
  ['PARALLEL-SEPARATE-A', 'PARALLEL-SEPARATE-B', 'PARALLEL-SEPARATE-C'],
  separateParallelTasks,
)
assert.equal(separateParallelResult.ok, false, '并行组默认分别承接不可合并')
assert.match(separateParallelResult.message, /未允许整体承接/, '默认分别承接必须返回中文原因')

const wholeGroupTasks = [
  runtimeTask('PARALLEL-WHOLE-A', 1, 1, {
    processCode: 'SEW',
    processNameZh: '车缝',
    routeParallelGroupId: 'PARALLEL-WHOLE',
    routeParallelGroupName: '整体承接组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
  runtimeTask('PARALLEL-WHOLE-B', 1, 2, {
    processCode: 'POST_FINISHING',
    processNameZh: '后道',
    routeParallelGroupId: 'PARALLEL-WHOLE',
    routeParallelGroupName: '整体承接组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
  runtimeTask('PARALLEL-WHOLE-C', 2, 1, {
    processCode: 'PLEATING',
    processNameZh: '压褶',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
]
const wholeGroupResult = evaluateContinuousRuntimeTaskMerge(
  ['PARALLEL-WHOLE-A', 'PARALLEL-WHOLE-B', 'PARALLEL-WHOLE-C'],
  wholeGroupTasks,
)
assert.equal(wholeGroupResult.ok, true, '并行组允许整体承接且完整选择时应可合并')

const wholeGroupWithoutSingleFactoryTasks = [
  runtimeTask('PARALLEL-NO-SINGLE-FACTORY-A', 1, 1, {
    processCode: 'CUT_PANEL',
    processNameZh: '裁片',
    routeParallelGroupId: 'PARALLEL-NO-SINGLE-FACTORY',
    routeParallelGroupName: '无单一工厂覆盖组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
  runtimeTask('PARALLEL-NO-SINGLE-FACTORY-B', 1, 2, {
    processCode: 'DYE',
    processNameZh: '染色',
    routeParallelGroupId: 'PARALLEL-NO-SINGLE-FACTORY',
    routeParallelGroupName: '无单一工厂覆盖组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
  runtimeTask('PARALLEL-NO-SINGLE-FACTORY-C', 2, 1, {
    processCode: 'SEW',
    processNameZh: '车缝',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
]
const wholeGroupWithoutSingleFactoryResult = evaluateContinuousRuntimeTaskMerge(
  [
    'PARALLEL-NO-SINGLE-FACTORY-A',
    'PARALLEL-NO-SINGLE-FACTORY-B',
    'PARALLEL-NO-SINGLE-FACTORY-C',
  ],
  wholeGroupWithoutSingleFactoryTasks,
)
assert.equal(wholeGroupWithoutSingleFactoryResult.ok, false, '并行组整体承接必须存在同一工厂覆盖全部工序能力')
assert.match(wholeGroupWithoutSingleFactoryResult.message, /同一工厂.*全部工序能力/, '缺少同一工厂覆盖能力时必须返回中文原因')

const lockedParallelTasks = [
  runtimeTask('PARALLEL-LOCKED-A', 1, 1, {
    routeParallelGroupId: 'PARALLEL-LOCKED',
    routeParallelGroupName: '含已分配成员组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
  runtimeTask('PARALLEL-LOCKED-B', 1, 2, {
    assignmentStatus: 'ASSIGNED',
    routeParallelGroupId: 'PARALLEL-LOCKED',
    routeParallelGroupName: '含已分配成员组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
  runtimeTask('PARALLEL-LOCKED-C', 2, 1, {
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  }),
]
const missingLockedMemberResult = evaluateContinuousRuntimeTaskMerge(
  ['PARALLEL-LOCKED-A', 'PARALLEL-LOCKED-C'],
  lockedParallelTasks,
)
assert.equal(missingLockedMemberResult.ok, false, '漏选同组已分配成员时不可合并')
assert.match(missingLockedMemberResult.message, /并行组未选择完整/, '漏选同组已分配成员必须先拦截并行组完整性')
const selectedLockedMemberResult = evaluateContinuousRuntimeTaskMerge(
  ['PARALLEL-LOCKED-A', 'PARALLEL-LOCKED-B', 'PARALLEL-LOCKED-C'],
  lockedParallelTasks,
)
assert.equal(selectedLockedMemberResult.ok, false, '选中已分配并行组成员时不可合并')
assert.match(selectedLockedMemberResult.message, /未分配、未开工、未拆分的单工序任务/, '选中已分配成员必须触发硬性限制')

const mergedTask = listRuntimeProcessTasks().find((task) => task.taskUnitType === 'COMBINED_PROCESS_TASK')
assert(mergedTask, '运行时 mock 必须存在任务清单人工合并后的连续工序任务')
const mergedTasks = listRuntimeProcessTasks().filter((task) =>
  task.taskUnitType === 'COMBINED_PROCESS_TASK'
  && task.acceptanceMode === 'CONTINUOUS_PROCESS'
)
assert(mergedTasks.length >= 2, '运行时 mock 必须覆盖至少两个连续工序任务场景')
for (const task of mergedTasks) {
  assert.equal(task.assignmentGranularity, 'ORDER', `${task.taskId} 合并后的连续工序任务必须按整任务分配`)
  assert.equal(task.detailSplitMode, undefined, `${task.taskId} 合并后的连续工序任务不得保留明细拆分模式`)
  assert.deepEqual(task.detailSplitDimensions ?? [], [], `${task.taskId} 合并后的连续工序任务不得保留明细拆分维度`)
  assert((task.mergeSourceTaskIds ?? []).length >= 2, `${task.taskId} 必须记录合并来源任务`)
  assert(
    task.auditLogs.some((log) => log.action === 'MERGE_CONTINUOUS_PROCESS'),
    `${task.taskId} 必须记录连续工序合并日志`,
  )

  const allocatableGroups = listRuntimeTaskAllocatableGroups(task.taskId)
  assert.equal(allocatableGroups.length, 1, `${task.taskId} 连续工序任务只能产生一个可分配整任务组`)
  assert.equal(allocatableGroups[0]?.granularity, 'ORDER', `${task.taskId} 连续工序任务可分配组必须是整任务粒度`)
}

console.log('连续工序路线合并资格检查通过')
