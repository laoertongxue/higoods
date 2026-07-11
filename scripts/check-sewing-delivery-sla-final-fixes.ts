import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterReceiveAwardedTaskFacts } from '../src/data/fcs/pda-receive-scope.ts'
import {
  acceptRuntimeTaskAssignment,
  allocateRuntimeSewingTaskScope,
  awardRuntimeTaskTender,
  captureRuntimeDirectDispatchState,
  getRuntimeTaskById,
  listRuntimeTaskSplitGroupsByOrder,
  listRuntimeProcessTasks,
  rejectRuntimeTaskAssignment,
  restoreRuntimeDirectDispatchState,
  upsertRuntimeTaskTender,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  captureSewingDeliverySlaSnapshotStore,
  getSewingDeliverySlaSnapshot,
  restoreSewingDeliverySlaSnapshotStore,
} from '../src/data/fcs/sewing-delivery-sla.ts'
import {
  createSewingDispatchWorkbenchDraft,
  listSewingDispatchWorkbenchRows,
} from '../src/data/fcs/sewing-dispatch-workbench.ts'

const runtimeState = captureRuntimeDirectDispatchState()
const slaState = captureSewingDeliverySlaSnapshotStore()
try {
  const seedRow = listSewingDispatchWorkbenchRows().find((row) => row.completeKitQty >= 4)
  const taskId = seedRow?.taskId
  assert.ok(taskId, '必须存在可连续部分分配的独立车缝任务')
  const source = getRuntimeTaskById(taskId)
  assert.ok(source, '部分数量分配测试任务必须存在')
  const firstLine = source.scopeSkuLines.find((line) => line.skuCode === seedRow?.skuCode)
  assert.ok(firstLine && firstLine.qty >= 2, '部分数量分配测试任务必须有可拆 SKU')

  const allocated = allocateRuntimeSewingTaskScope({
    taskId,
    lines: [{ skuCode: firstLine.skuCode, qty: 1 }],
    by: '跟单A',
    operatedAt: '2026-07-10 10:00:00',
  })
  assert.notEqual(allocated.taskId, taskId, '部分数量必须生成真实运行时分配子任务')
  assert.equal(allocated.scopeQty, 1)
  assert.equal(getRuntimeTaskById(taskId)?.executionEnabled, false, '原任务分区后必须停用，避免与子任务重复执行')
  const firstGroup = listRuntimeTaskSplitGroupsByOrder(source.productionOrderId).find((group) => group.sourceTaskId === taskId)
  assert.ok(firstGroup)
  assert.equal(firstGroup.resultTasks.reduce((sum, task) => sum + task.scopeQty, 0), source.scopeQty, '分区前后总范围必须守恒')
  source.scopeSkuLines.forEach((line) => {
    const partitionQty = firstGroup.resultTasks.reduce((sum, result) => {
      const resultTask = getRuntimeTaskById(result.taskId)
      return sum + (resultTask?.scopeSkuLines.filter((item) => item.skuCode === line.skuCode).reduce((qty, item) => qty + item.qty, 0) ?? 0)
    }, 0)
    assert.equal(partitionQty, line.qty, `${line.skuCode} 分区数量必须守恒且不可重叠重复`)
  })
  const downstream = listRuntimeProcessTasks().find((task) => task.dependsOnTaskIds.includes(taskId))
  if (downstream) {
    assert.deepEqual(
      firstGroup.resultTasks.every((result) => getRuntimeTaskById(downstream.taskId)?.dependsOnTaskIds.includes(result.taskId)),
      true,
      '下游必须等待本次分配与全部剩余分区任务',
    )
  }
  const firstResidualRow = listSewingDispatchWorkbenchRows().find((row) => row.skuCode === firstLine.skuCode && row.taskId !== allocated.taskId)
  assert.ok(firstResidualRow, '剩余数量必须作为可执行子任务保留在工作台继续分配')

  const direct = createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    factoryId: 'ID-F003',
    factoryName: '万隆车缝厂',
    rowIds: [firstResidualRow.rowId],
    qtyByRowId: { [firstResidualRow.rowId]: 1 },
    businessAssignedAt: '2026-07-10 08:00:00',
    operatedAt: '2026-07-10 10:00:00',
    by: '跟单A',
  })
  assert.equal(direct.ok, true, direct.message)
  assert.ok(direct.runtimeTaskIds?.length, '成功 draft 必须关联真实运行时任务')
  const directTaskId = direct.runtimeTaskIds![0]
  assert.equal(getSewingDeliverySlaSnapshot(directTaskId)?.assignedQty, 1, '直接派单快照分母必须等于输入数量')
  const secondGroup = listRuntimeTaskSplitGroupsByOrder(source.productionOrderId).find((group) => group.sourceTaskId === taskId)
  assert.equal(secondGroup?.resultTasks.reduce((sum, task) => sum + task.scopeQty, 0), source.scopeQty, '连续第二次部分分配后总范围仍须守恒')

  const remainingRow = listSewingDispatchWorkbenchRows().find((row) => row.skuCode === firstLine.skuCode)
  assert.ok(remainingRow, '直接派出部分数量后仍应有剩余行')
  const bidding = createSewingDispatchWorkbenchDraft({
    actionType: '发起竞价',
    rowIds: [remainingRow.rowId],
    qtyByRowId: { [remainingRow.rowId]: 1 },
    businessAssignedAt: '2026-07-10 09:00:00',
    operatedAt: '2026-07-10 10:00:00',
    by: '跟单A',
  })
  assert.equal(bidding.ok, true)
  const bidTaskId = bidding.runtimeTaskIds?.[0]
  assert.ok(bidTaskId)
  assert.equal(getRuntimeTaskById(bidTaskId)?.assignmentStatus, 'BIDDING')
  assert.equal(getSewingDeliverySlaSnapshot(bidTaskId), null, '竞价发起时不得生成快照')
  const bidTask = getRuntimeTaskById(bidTaskId)!
  awardRuntimeTaskTender({ taskId: bidTaskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', awardedAt: '2026-07-10 11:00:00', awardedPrice: 12000, by: '跟单A' })
  assert.equal(getRuntimeTaskById(bidTaskId)?.acceptanceStatus, 'PENDING')
  acceptRuntimeTaskAssignment(bidTaskId, { factoryId: 'ID-F003', acceptedAt: '2026-07-10 12:00:00', acceptedBy: '万隆车缝厂' })
  assert.equal(getSewingDeliverySlaSnapshot(bidTaskId)?.assignedQty, bidTask.scopeQty)

  const futureRow = listSewingDispatchWorkbenchRows().find((row) => row.completeKitQty > 0)
  assert.ok(futureRow)
  const future = createSewingDispatchWorkbenchDraft({
    actionType: '直接派单', factoryId: 'ID-F003', factoryName: '万隆车缝厂', rowIds: [futureRow.rowId],
    qtyByRowId: { [futureRow.rowId]: 1 }, businessAssignedAt: '2026-07-10 11:00:00', operatedAt: '2026-07-10 10:00:00', by: '跟单A',
  })
  assert.equal(future.ok, false)
  assert.match(future.message, /业务分配时间不能晚于当前操作时间/)

  const rejectTask = listRuntimeProcessTasks().find((task) => task.acceptanceStatus === 'PENDING' && Boolean(task.assignedFactoryId) && (task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED'))
  assert.ok(rejectTask?.assignedFactoryId)
  const rejectTaskId = rejectTask.taskId
  const rejected = rejectRuntimeTaskAssignment(rejectTaskId, { factoryId: rejectTask.assignedFactoryId, reason: '产能不足', rejectedAt: '2026-07-10 13:00:00', rejectedBy: rejectTask.assignedFactoryName || '工厂' })
  assert.equal(rejected.acceptanceStatus, 'REJECTED')
  assert.equal(getRuntimeTaskById(rejectTaskId)?.acceptanceStatus, 'REJECTED', '重进页面仍应读取运行时拒单状态')
  assert.equal(filterReceiveAwardedTaskFacts([getRuntimeTaskById(rejectTaskId)!], rejectTask.assignedFactoryId).length, 0, '拒单后任务必须退出PDA已中标集合')
  assert.throws(() => rejectRuntimeTaskAssignment(rejectTaskId, { factoryId: rejectTask.assignedFactoryId!, reason: '重复', rejectedAt: '2026-07-10 13:01:00', rejectedBy: '工厂' }), /已拒单/)
  assert.throws(() => rejectRuntimeTaskAssignment(rejectTaskId, { factoryId: 'OTHER', reason: '无权', rejectedAt: '2026-07-10 13:02:00', rejectedBy: '其他工厂' }), /已拒单|无权/)
} finally {
  restoreRuntimeDirectDispatchState(runtimeState)
  restoreSewingDeliverySlaSnapshotStore(slaState)
}

const pdaReceiveSource = readFileSync(new URL('../src/pages/pda-task-receive.ts', import.meta.url), 'utf8')
const pdaReceiveDetailSource = readFileSync(new URL('../src/pages/pda-task-receive-detail.ts', import.meta.url), 'utf8')
assert.match(pdaReceiveSource, /rejectPdaTaskWithRuntimeFallback\(state\.rejectingTaskId, factoryId/, 'PDA 接单列表拒单 handler 必须调用统一入口')
assert.match(pdaReceiveDetailSource, /rejectPdaTaskWithRuntimeFallback\(taskId, factoryId/, 'PDA 接单详情拒单 handler 必须调用统一入口')
assert.match(pdaReceiveDetailSource, /acceptanceStatus === 'REJECTED'[\s\S]*已拒单/, 'PDA 详情重进后必须展示中文已拒单状态')
assert.match(pdaReceiveDetailSource, /rejected[\s\S]*已拒绝接单，不能进入执行/, 'PDA详情深链对已拒单任务必须阻断去执行')
assert.doesNotMatch(pdaReceiveDetailSource, /function mutateRejectTask/, 'PDA 详情不得保留绕过 runtime 的本地拒单 mutation')

console.log('sewing delivery SLA final fixes checks passed')
