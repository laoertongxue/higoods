#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  isRuntimeSewingTask,
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
} from '../src/data/fcs/runtime-process-tasks.ts'
import { listSewingDispatchWorkbenchTasks } from '../src/data/fcs/sewing-dispatch-workbench.ts'

const runtimeTasks = listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))

function requireTask(taskId: string): (typeof runtimeTasks)[number] {
  const task = runtimeTasks.find((item) => item.taskId === taskId)
  assert(task, `缺少运行时任务：${taskId}`)
  return task
}

const sewingBusinessTask = requireTask('TASKGEN-202603-082-002__ORDER')
assert.equal(sewingBusinessTask.processBusinessCode, 'SEW', '回归样本必须是车缝业务码任务')
assert.equal(isRuntimeSewingTask(sewingBusinessTask), true, '车缝业务码任务必须进入车缝分配工作台')

const combinedSewingTask = requireTask('TASKGEN-202603-0015-001__ORDER')
assert(
  combinedSewingTask.coveredProcesses?.some((process) => process.processCode === 'SEW'),
  '回归样本必须覆盖车缝工序',
)
assert.equal(isRuntimeSewingTask(combinedSewingTask), true, '覆盖车缝工序的组合任务必须按车缝任务归类')

const specialCraftNamedLikeSewing = requireTask('TASKGEN-202603-084-006__ORDER')
assert.equal(specialCraftNamedLikeSewing.processBusinessCode, 'SPECIAL_CRAFT', '回归样本必须是特殊工艺任务')
assert.equal(isRuntimeSewingTask(specialCraftNamedLikeSewing), false, '特殊工艺不能仅因名称包含车缝进入车缝分配工作台')

const workbenchTasks = listSewingDispatchWorkbenchTasks()
assert(workbenchTasks.length > 0, '车缝分配工作台必须有可展示的 mock 任务')
assert(
  workbenchTasks.some((task) => task.taskId === sewingBusinessTask.taskId),
  '车缝业务码任务必须出现在车缝分配工作台列表',
)

console.log(`车缝分配工作台检查通过：taskCount=${workbenchTasks.length}`)
