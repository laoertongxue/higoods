import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterReceiveAwardedTaskFacts } from '../src/data/fcs/pda-receive-scope.ts'
import {
  acceptRuntimeTaskAssignment,
  applyRuntimeDirectDispatchMeta,
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
  const directTaskBeforeIllegalReuse = structuredClone(getRuntimeTaskById(directTaskId))
  const directSnapshotBeforeIllegalReuse = getSewingDeliverySlaSnapshot(directTaskId)
  assert.throws(
    () => applyRuntimeDirectDispatchMeta({ ...directInputForGuard(directTaskId), factoryId: 'ID-F007', factoryName: '玛琅精工车缝' }),
    /普通入口覆盖|改派/,
    '含车缝任务已有直派结果后不得复用同 taskId 再次直派',
  )
  assert.throws(
    () => upsertRuntimeTaskTender(directTaskId, { tenderId: 'TENDER-ILLEGAL-REUSE', biddingDeadline: '2026-07-11 18:00:00', taskDeadline: '2026-07-20 18:00:00', businessAssignedAt: '2026-07-10 09:00:00', assignmentOperatedAt: '2026-07-10 10:00:00' }, '跟单A'),
    /普通入口发起新竞价|改派/,
    '含车缝任务已有直派结果后不得复用同 taskId 发起竞价',
  )
  assert.deepEqual(getRuntimeTaskById(directTaskId), directTaskBeforeIllegalReuse, '非法复用普通入口必须原子拒绝且不改变任务')
  assert.deepEqual(getSewingDeliverySlaSnapshot(directTaskId), directSnapshotBeforeIllegalReuse, '非法复用普通入口不得替换履约快照或污染旧实收归属')
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

  const directRejectTaskId = 'TASKGEN-202603-0002-006__ORDER'
  const directRejectBase = getRuntimeTaskById(directRejectTaskId)!
  const directPending = applyRuntimeDirectDispatchMeta({ taskId: directRejectTaskId, factoryId: 'ID-F001', factoryName: '测试综合工厂A', acceptDeadline: '2026-07-10 18:00:00', taskDeadline: '2026-07-20 18:00:00', remark: '非SLA直接派单拒单测试', by: '跟单A', dispatchPrice: 10000, dispatchPriceCurrency: 'IDR', dispatchPriceUnit: '件', priceDiffReason: '', businessAssignedAt: '2026-07-10 10:00:00', operatedAt: '2026-07-10 10:00:00', acceptanceSla: { ruleSource: 'GLOBAL_DEFAULT', processCode: directRejectBase.processCode, processName: directRejectBase.processNameZh, craftCode: '', craftName: '', acceptTimeoutHours: 8, enabled: true, autoAccept: false } })
  assert.equal(directPending?.acceptanceStatus, 'PENDING')
  const directRejected = rejectRuntimeTaskAssignment(directRejectTaskId, { factoryId: 'ID-F001', reason: '无法承接', rejectedAt: '2026-07-10 10:30:00', rejectedBy: '测试综合工厂A' })
  assert.equal(directRejected.assignmentMode, 'DIRECT')
  assert.equal(directRejected.assignmentStatus, 'UNASSIGNED', 'DIRECT无tender拒单后必须回到未分配')
  assert.equal(directRejected.acceptanceStatus, 'REJECTED')
  assert.equal(directRejected.assignedFactoryId, undefined)
  assert.equal(directRejected.dispatchPrice, undefined)
  assert.equal(directRejected.businessAssignedAt, undefined, 'DIRECT拒单回未分配后应清理原分配时间')
  assert.equal(directRejected.assignmentOperatedAt, undefined)
  assert.match(directRejected.auditLogs.at(-1)?.detail ?? '', /无法承接/, 'DIRECT拒单必须保留业务审计')
  const directRedispatched = applyRuntimeDirectDispatchMeta({ taskId: directRejectTaskId, factoryId: 'ID-F002', factoryName: '测试综合工厂B', acceptDeadline: '2026-07-11 18:00:00', taskDeadline: '2026-07-21 18:00:00', remark: '拒单后再次直接派单', by: '跟单A', dispatchPrice: 10500, dispatchPriceCurrency: 'IDR', dispatchPriceUnit: '件', priceDiffReason: '', businessAssignedAt: '2026-07-10 11:00:00', operatedAt: '2026-07-10 11:00:00', acceptanceSla: { ruleSource: 'GLOBAL_DEFAULT', processCode: directRejectBase.processCode, processName: directRejectBase.processNameZh, craftCode: '', craftName: '', acceptTimeoutHours: 8, enabled: true, autoAccept: false } })
  assert.equal(directRedispatched?.assignmentStatus, 'ASSIGNED')
  assert.equal(directRedispatched?.assignedFactoryId, 'ID-F002')
  assert.equal(directRedispatched?.acceptanceStatus, 'PENDING', 'DIRECT拒单后必须可正常再次派单')

  const rejectBid = createSewingDispatchWorkbenchDraft({ actionType: '发起竞价', rowIds: [futureRow.rowId], qtyByRowId: { [futureRow.rowId]: 1 }, businessAssignedAt: '2026-07-10 10:00:00', operatedAt: '2026-07-10 10:00:00', by: '跟单A' })
  assert.equal(rejectBid.ok, true, rejectBid.message)
  const rejectTaskId = rejectBid.runtimeTaskIds![0]
  const rejectTask = awardRuntimeTaskTender({ taskId: rejectTaskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', awardedAt: '2026-07-10 12:30:00', awardedPrice: 12000, by: '跟单A' })
  assert.ok(rejectTask.assignedFactoryId)
  const rejected = rejectRuntimeTaskAssignment(rejectTaskId, { factoryId: rejectTask.assignedFactoryId, reason: '产能不足', rejectedAt: '2026-07-10 13:00:00', rejectedBy: rejectTask.assignedFactoryName || '工厂' })
  assert.equal(rejected.acceptanceStatus, 'REJECTED')
  assert.equal(getRuntimeTaskById(rejectTaskId)?.acceptanceStatus, 'REJECTED', '重进页面仍应读取运行时拒单状态')
  assert.equal(filterReceiveAwardedTaskFacts([getRuntimeTaskById(rejectTaskId)!], rejectTask.assignedFactoryId).length, 0, '拒单后任务必须退出PDA已中标集合')
  assert.equal(getRuntimeTaskById(rejectTaskId)?.assignmentStatus, 'BIDDING', '拒单后必须释放为可重新定标状态')
  assert.equal(getRuntimeTaskById(rejectTaskId)?.assignedFactoryId, undefined, '拒单后必须释放原中标工厂归属')
  assert.equal(getRuntimeTaskById(rejectTaskId)?.businessAssignedAt, '2026-07-10 10:00:00', '竞价拒单回tender池必须保留业务分配时间事实')
  assert.equal(getRuntimeTaskById(rejectTaskId)?.assignmentOperatedAt, '2026-07-10 10:00:00', '竞价拒单回tender池必须保留原竞价操作时间事实')
  assert.throws(() => rejectRuntimeTaskAssignment(rejectTaskId, { factoryId: rejectTask.assignedFactoryId!, reason: '重复', rejectedAt: '2026-07-10 13:01:00', rejectedBy: '工厂' }), /已拒单/)
  assert.throws(() => rejectRuntimeTaskAssignment(rejectTaskId, { factoryId: 'OTHER', reason: '无权', rejectedAt: '2026-07-10 13:02:00', rejectedBy: '其他工厂' }), /已拒单|无权/)
  const reAwarded = awardRuntimeTaskTender({ taskId: rejectTaskId, factoryId: 'ID-F007', factoryName: '玛琅精工车缝', awardedAt: '2026-07-10 14:00:00', awardedPrice: 12500, by: '跟单A' })
  assert.equal(reAwarded.acceptanceStatus, 'PENDING', '重新定标给新工厂后必须回到待接单')
  assert.equal(reAwarded.assignedFactoryId, 'ID-F007')
  assert.equal(reAwarded.businessAssignedAt, '2026-07-10 10:00:00', '重新定标不得覆盖原竞价业务分配时间')
  assert.equal(reAwarded.assignmentOperatedAt, '2026-07-10 10:00:00', '重新定标不得覆盖原竞价操作时间')
  assert.equal(filterReceiveAwardedTaskFacts([reAwarded], 'ID-F007').length, 1, '重新定标后新工厂应重新进入PDA已中标待接单集合')
  const reAccepted = acceptRuntimeTaskAssignment(rejectTaskId, { factoryId: 'ID-F007', acceptedAt: '2026-07-10 15:00:00', acceptedBy: '玛琅精工车缝' })
  assert.equal(reAccepted.acceptanceStatus, 'ACCEPTED')
  assert.equal(getSewingDeliverySlaSnapshot(rejectTaskId)?.factoryId, 'ID-F007', '新工厂确认接单后必须生成新履约快照')
  assert.equal(getSewingDeliverySlaSnapshot(rejectTaskId)?.acceptedAt, '2026-07-10 15:00:00', '重新定标后的履约快照必须按新工厂实际接单时间启动')
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

function directInputForGuard(taskId: string) {
  return { taskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', acceptDeadline: '', taskDeadline: '', remark: '非法复用探针', by: '跟单A', dispatchPrice: 12000, dispatchPriceCurrency: 'IDR', dispatchPriceUnit: '件', priceDiffReason: '', businessAssignedAt: '2026-07-10 09:00:00', operatedAt: '2026-07-10 10:00:00' }
}
