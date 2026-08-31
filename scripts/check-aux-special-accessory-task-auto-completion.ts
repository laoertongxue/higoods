#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  captureProcessTaskStore,
  processTasks,
  restoreProcessTaskStore,
} from '../src/data/fcs/process-tasks.ts'
import {
  listSpecialCraftTaskOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { reconcileSpecialCraftSourceTask } from '../src/data/fcs/special-craft-source-task-registry.ts'
import {
  buildBindingProcessOrders,
  captureBindingProcessOrderStore,
  getBindingProcessSourceTaskById,
  listBindingProcessSourceTasks,
  restoreBindingProcessOrderStore,
} from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import {
  listLaceProductionOrders,
  resetLaceFactoryRuntime,
  syncLaceProductionOrders,
} from '../src/data/fcs/lace-factory-domain.ts'
import {
  AUX_SPECIAL_ACCESSORY_CHAINS,
  VerificationRecorder,
  getChainByOperationId,
} from './aux-special-accessory-test-catalog.ts'

const recorder = new VerificationRecorder('task-auto-completion')
const specialOrders = listSpecialCraftTaskOrders()

for (const chain of AUX_SPECIAL_ACCESSORY_CHAINS.filter((item) => item.kind === 'SPECIAL_CRAFT')) {
  const operationOrders = specialOrders.filter((order) => order.operationId === chain.operationId)
  assert(operationOrders.length > 0, `${chain.id} 无加工单样本`)
  const first = operationOrders[0]
  const actualSiblings = specialOrders.filter((order) => order.sourceTaskId === first.sourceTaskId)
  const children = actualSiblings.length > 1
    ? actualSiblings.map((order) => ({ workOrderId: order.taskOrderId, status: order.status, updatedAt: order.updatedAt }))
    : [
        { workOrderId: first.taskOrderId, status: first.status, updatedAt: first.updatedAt },
        { workOrderId: `${first.taskOrderId}:CONTROL-SIBLING`, status: '加工中', updatedAt: '2026-08-31 09:01:00' },
      ]
  const taskSnapshot = captureProcessTaskStore()
  try {
    const task = processTasks.find((item) => item.taskId === first.sourceTaskId)
    assert(task, `${chain.id} 缺少来源任务 ${first.sourceTaskId}`)
    task.status = 'IN_PROGRESS'
    task.finishedAt = undefined
    const autoCompleteLogsBefore = task.auditLogs.filter((log) => log.action === 'AUTO_COMPLETE_FROM_WORK_ORDERS').length

    recorder.check({
      caseId: `TASK-PARTIAL-${chain.id}`,
      chainId: chain.id,
      workOrderId: first.taskOrderId,
      workOrderNo: first.taskOrderNo,
      assertion: '只完成部分子加工单时，来源任务不得自动完成',
      evidence: { sourceTaskId: first.sourceTaskId, childCount: children.length },
    }, () => {
      const partial = children.map((child, index) => ({
        ...child,
        status: index === children.length - 1 ? '加工中' : '已完结',
      }))
      reconcileSpecialCraftSourceTask(first.sourceTaskId || '', partial)
      assert.equal(task.status, 'IN_PROGRESS')
      assert.equal(task.finishedAt, undefined)
    })

    recorder.check({
      caseId: `TASK-ALL-DONE-${chain.id}`,
      chainId: chain.id,
      workOrderId: first.taskOrderId,
      workOrderNo: first.taskOrderNo,
      assertion: '同一任务下全部加工单完成后，任务由系统自动完成',
      evidence: { sourceTaskId: first.sourceTaskId, childWorkOrderIds: children.map((child) => child.workOrderId) },
    }, () => {
      reconcileSpecialCraftSourceTask(first.sourceTaskId || '', children.map((child) => ({
        ...child,
        status: '已完结',
        updatedAt: '2026-08-31 09:02:00',
      })))
      assert.equal(task.status, 'DONE')
      assert.equal(task.finishedAt, '2026-08-31 09:02:00')
      assert.equal(
        task.auditLogs.filter((log) => log.action === 'AUTO_COMPLETE_FROM_WORK_ORDERS').length,
        autoCompleteLogsBefore + 1,
      )
    })

    recorder.check({
      caseId: `TASK-IDEMPOTENT-${chain.id}`,
      chainId: chain.id,
      workOrderId: first.taskOrderId,
      workOrderNo: first.taskOrderNo,
      assertion: '重复聚合全部完成状态不重复生成任务完成事实',
      evidence: { sourceTaskId: first.sourceTaskId },
    }, () => {
      const completed = children.map((child) => ({ ...child, status: '已完结', updatedAt: '2026-08-31 09:02:00' }))
      reconcileSpecialCraftSourceTask(first.sourceTaskId || '', completed)
      reconcileSpecialCraftSourceTask(first.sourceTaskId || '', completed)
      assert.equal(task.status, 'DONE')
      assert.equal(
        task.auditLogs.filter((log) => log.action === 'AUTO_COMPLETE_FROM_WORK_ORDERS').length,
        autoCompleteLogsBefore + 1,
      )
    })

    recorder.check({
      caseId: `TASK-REOPEN-${chain.id}`,
      chainId: chain.id,
      workOrderId: first.taskOrderId,
      workOrderNo: first.taskOrderNo,
      assertion: '任一子加工单恢复为未完成后，任务自动恢复为进行中',
      evidence: { sourceTaskId: first.sourceTaskId },
    }, () => {
      reconcileSpecialCraftSourceTask(first.sourceTaskId || '', children.map((child, index) => ({
        ...child,
        status: index === 0 ? '加工中' : '已完结',
        updatedAt: '2026-08-31 09:03:00',
      })))
      assert.equal(task.status, 'IN_PROGRESS')
      assert.equal(task.finishedAt, undefined)
      assert(task.auditLogs.some((log) => log.action === 'AUTO_REOPEN_FROM_WORK_ORDERS'))
    })
  } finally {
    restoreProcessTaskStore(taskSnapshot)
  }
}

const bindingSnapshot = captureBindingProcessOrderStore()
try {
  for (const sourceTask of listBindingProcessSourceTasks()) {
    const siblings = buildBindingProcessOrders().filter((order) => order.sourceTaskId === sourceTask.sourceTaskId)
    assert(siblings.length > 0)
    recorder.check({
      caseId: `TASK-BIND-PARTIAL-${sourceTask.sourceTaskId}`,
      chainId: 'BIND-01',
      workOrderId: siblings[0].bindingOrderId,
      workOrderNo: siblings[0].bindingOrderNo,
      assertion: '捆条任务只完成部分加工单时仍为进行中',
      evidence: { sourceTaskId: sourceTask.sourceTaskId, childCount: siblings.length },
    }, () => {
      siblings.forEach((order, index) => { order.status = index === siblings.length - 1 ? '加工中' : '已完成' })
      assert.equal(getBindingProcessSourceTaskById(sourceTask.sourceTaskId)?.status, 'IN_PROGRESS')
    })
    recorder.check({
      caseId: `TASK-BIND-DONE-${sourceTask.sourceTaskId}`,
      chainId: 'BIND-01',
      workOrderId: siblings[0].bindingOrderId,
      workOrderNo: siblings[0].bindingOrderNo,
      assertion: '捆条任务下所有加工单完成后由聚合事实自动显示完成',
      evidence: { sourceTaskId: sourceTask.sourceTaskId, childWorkOrderIds: siblings.map((order) => order.bindingOrderId) },
    }, () => {
      siblings.forEach((order) => { order.status = '已完成' })
      const summary = getBindingProcessSourceTaskById(sourceTask.sourceTaskId)
      assert.equal(summary?.status, 'DONE')
      assert.equal(summary?.completedWorkOrderCount, summary?.workOrderCount)
    })
    recorder.check({
      caseId: `TASK-BIND-REOPEN-${sourceTask.sourceTaskId}`,
      chainId: 'BIND-01',
      workOrderId: siblings[0].bindingOrderId,
      workOrderNo: siblings[0].bindingOrderNo,
      assertion: '捆条任一加工单恢复为未完成后，来源任务自动恢复进行中',
      evidence: { sourceTaskId: sourceTask.sourceTaskId },
    }, () => {
      siblings[0].status = '加工中'
      assert.equal(getBindingProcessSourceTaskById(sourceTask.sourceTaskId)?.status, 'IN_PROGRESS')
    })
  }
} finally {
  restoreBindingProcessOrderStore(bindingSnapshot)
}

resetLaceFactoryRuntime()
syncLaceProductionOrders()
for (const order of listLaceProductionOrders()) {
  recorder.check({
    caseId: `TASK-LACE-NA-${order.workOrderId}`,
    chainId: 'ACC-LACE-01',
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
    assertion: '花边生产单保持独立 Web 执行，不虚构来源任务或任务手工完成',
    evidence: { taskCompletion: '不适用', reason: '花边本阶段无任务/PDA/打印' },
  }, () => {
    assert(!('sourceTaskId' in order))
    assert(!('sourceTaskNo' in order))
    assert.equal(getChainByOperationId('ACC-LACE-01'), undefined)
  })
}

recorder.finish({
  specialCraftChainCount: 17,
  bindingTaskCount: listBindingProcessSourceTasks().length,
  laceWorkOrderCount: listLaceProductionOrders().length,
  rule: '任务仅聚合；全部子加工单完成后自动完成，不提供任务手工完工',
})
