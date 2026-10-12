import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as runtimeModule from '../../src/data/fcs/runtime-process-tasks.ts'
import { captureRuntimeTaskTenderRecordStore, restoreRuntimeTaskTenderRecordStore, upsertRuntimeTaskTenderRecord, getRuntimeTaskTenderRecord, cancelRuntimeTaskTenderRecord } from '../../src/data/fcs/runtime-task-tenders.ts'
import { classifyTaskFulfillmentPolicy } from '../../src/data/fcs/task-fulfillment-policy.ts'
import { captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState, createEffectiveTaskAssignment } from '../../src/data/fcs/effective-task-assignments.ts'
import {
  allocateRuntimeSkuTaskScope, captureRuntimeDirectDispatchState, createFixedMergedTask,
  getRuntimeTaskById, listRuntimeExecutionTasks, listRuntimeTaskSplitGroupsByOrder,
  restoreRuntimeDirectDispatchState, resolveRuntimeTaskAssignmentScope,
} from '../../src/data/fcs/runtime-process-tasks.ts'

test('只有车缝、车缝加烫包允许完整 SKU 分配，不采信旧粒度字段', () => {
  for (const processCode of ['CUTTING', 'IRON_PACK', 'SPECIAL_CRAFT', 'WOOL', 'DYE', 'PRINT']) {
    assert.equal(classifyTaskFulfillmentPolicy({ processCode, processNameZh: '', assignmentGranularity: 'SKU' }).assignmentGranularity, 'ORDER')
  }
  assert.equal(classifyTaskFulfillmentPolicy({ processCode: 'SEWING', processNameZh: '' }).assignmentGranularity, 'SKU')
  assert.equal(classifyTaskFulfillmentPolicy({ processCode: 'SEWING', processNameZh: '', taskUnitType: 'WHOLE_ORDER_TASK' }).assignmentGranularity, 'ORDER')
  for (const [mergedTaskType, expected] of [['SEWING_IRON_PACK', 'SKU'], ['CUTTING_SEWING_IRON_PACK', 'ORDER']] as const) {
    assert.equal(classifyTaskFulfillmentPolicy({ processCode: 'SEWING', processNameZh: '', taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType }).assignmentGranularity, expected)
  }
})

test('取消后重新竞价的最新记录不依赖持久回读恢复顺序', () => {
  const before = captureRuntimeTaskTenderRecordStore()
  try {
    const input = { taskId: 'TEST-TENDER-RESTORE-ORDER', businessAssignedAt: '2099-01-01 08:00:00', assignmentOperatedAt: '2099-01-01 08:00:00', biddingDeadline: '2099-01-02 18:00:00', taskDeadline: '', poolMode: 'ALL_ELIGIBLE' as const,
      taskSnapshot: { taskNo: 'TEST-TENDER-RESTORE-ORDER', productionOrderId: 'TEST-PO', processName: '车缝', taskTypeLabel: '独立车缝任务', qty: 500, qtyUnit: '件', skuLines: [{ skuCode: 'TEST-SKU', color: '灰', size: 'S', qty: 500 }] },
      factoryPool: [{ factoryId: 'ID-F001', factoryName: '验收工厂' }], standardPrice: 1500, minPrice: 1200, currency: 'IDR', unit: '件', remark: '', createdBy: '测试' }
    upsertRuntimeTaskTenderRecord({ ...input, tenderId: 'TD-100' })
    const older = cancelRuntimeTaskTenderRecord({ taskId: input.taskId, tenderId: 'TD-100', cancelledAt: '2099-01-01 08:00:00', cancelledBy: '测试', reason: '重新选择工厂池' })
    const newer = upsertRuntimeTaskTenderRecord({ ...input, tenderId: 'TD-100-2' })
    for (const records of [[older, newer], [newer, older]]) {
      restoreRuntimeTaskTenderRecordStore(records)
      assert.equal(getRuntimeTaskTenderRecord(input.taskId)?.tenderId, newer.tenderId)
    }
  } finally { restoreRuntimeTaskTenderRecordStore(before) }
})

test('统一范围校验拒绝空、重复、未知和非整单选择；SKU 数量不可部分分配', () => {
  const task = getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')!
  const line = task.scopeSkuLines[0]!
  const before = captureRuntimeDirectDispatchState()
  for (const codes of [[], [line.skuCode, line.skuCode], ['unknown']]) {
    assert.throws(() => resolveRuntimeTaskAssignmentScope(task.taskId, codes))
  }
  assert.throws(() => allocateRuntimeSkuTaskScope({ taskId: task.taskId, lines: [{ ...line, qty: line.qty - 1 }], by: '测试' }), /不能按数量拆分/)
  const whole = listRuntimeExecutionTasks().find(item => classifyTaskFulfillmentPolicy(item).assignmentGranularity === 'ORDER' && item.scopeSkuLines.length > 1)!
  assert.throws(() => resolveRuntimeTaskAssignmentScope(whole.taskId, [whole.scopeSkuLines[0]!.skuCode]), /整单分配/)
  assert.deepEqual(resolveRuntimeTaskAssignmentScope(whole.taskId), whole.scopeSkuLines)
  assert.deepEqual({ ...captureRuntimeDirectDispatchState(), auditSeq: 0 }, { ...before, auditSeq: 0 })
})

test('车缝加烫包按完整 SKU 分区保留两道工序、源任务和总数量', () => {
  const before = captureRuntimeDirectDispatchState()
  try {
    getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')
    const sources = listRuntimeExecutionTasks().filter(task => task.productionOrderId === 'PO-202603-0002' && ['SEW', 'IRON_PACK'].includes(task.processBusinessCode || task.processCode))
    assert.equal(sources.length, 2)
    const merged = createFixedMergedTask(sources.map(task => task.taskId), '粒度契约测试')
    assert(merged)
    assert.equal(merged.scopeType, 'ORDER', '源任务不得提前拆成 SKU 任务')
    const line = merged.scopeSkuLines[0]!
    const selected = allocateRuntimeSkuTaskScope({ taskId: merged.taskId, lines: [line], by: '粒度契约测试' })
    const group = listRuntimeTaskSplitGroupsByOrder(merged.productionOrderId).find(item => item.sourceTaskId === merged.taskId)
    assert(group)
    assert.equal(group.resultTasks.length, 2)
    assert.equal(group.resultTasks.reduce((sum, task) => sum + task.scopeQty, 0), merged.scopeQty)
    assert.equal(selected.scopeQty, line.qty)
    for (const result of group.resultTasks) {
      const task = getRuntimeTaskById(result.taskId)!
      assert.equal(task.mergedTaskType, 'SEWING_IRON_PACK')
      assert.deepEqual(task.coveredProcesses, merged.coveredProcesses)
      assert.deepEqual(task.mergeSourceTaskIds, merged.mergeSourceTaskIds)
      assert.notEqual(task.taskQrValue, merged.taskQrValue)
    }
    assert.equal(getRuntimeTaskById(merged.taskId)?.executionEnabled, false)
  } finally { restoreRuntimeDirectDispatchState(before) }
})

test('所有非允许任务拒绝底层 SKU 分区，失败不改变任务状态', () => {
  getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')
  const tasks = listRuntimeExecutionTasks().filter(task => classifyTaskFulfillmentPolicy(task).assignmentGranularity === 'ORDER')
  assert(tasks.length > 20)
  const before = captureRuntimeDirectDispatchState()
  for (const task of tasks.filter(task => task.assignmentStatus === 'UNASSIGNED' && task.scopeSkuLines.length > 1)) {
    assert.throws(() => allocateRuntimeSkuTaskScope({ taskId: task.taskId, lines: [task.scopeSkuLines[0]!], by: '粒度契约测试' }), /整单分配/)
  }
  assert.deepEqual({ ...captureRuntimeDirectDispatchState(), auditSeq: 0 }, { ...before, auditSeq: 0 })
})

test('旧明细写入接口已删除；既有按原明细键保存的拆分计划仍能读取', () => {
  for (const name of ['listRuntimeTaskAllocatableGroups', 'dispatchRuntimeTaskByDetailGroups', 'createRuntimeTaskTenderByDetailGroups']) {
    assert.equal(name in runtimeModule, false)
  }
  const source = getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')!
  const before = captureRuntimeDirectDispatchState()
  try {
    const selected = allocateRuntimeSkuTaskScope({ taskId: source.taskId, lines: [source.scopeSkuLines[0]!], by: '历史读取测试' })
    const saved = captureRuntimeDirectDispatchState()
    const plan = saved.splitPlans.find(([id]) => id === source.taskId)![1]
    for (const result of plan.results) {
      const codes = new Set(result.scopeSkuLines!.map(line => line.skuCode))
      result.detailRowKeys = source.scopeDetailRows.filter(row => codes.has(row.dimensions.GARMENT_SKU!)).map(row => row.rowKey)
      delete result.scopeSkuLines
      delete result.scopeDetailRows
    }
    restoreRuntimeDirectDispatchState(saved)
    assert.deepEqual(getRuntimeTaskById(selected.taskId)!.scopeSkuLines, [source.scopeSkuLines[0]!])
    assert.equal(getRuntimeTaskById(selected.taskId)!.scopeQty, selected.scopeQty)
  } finally { restoreRuntimeDirectDispatchState(before) }
})

test('竞价底层不能用局部快照绕过整任务范围；允许的分区任务保存完整子范围', () => {
  const source = getRuntimeTaskById('TASKGEN-202603-0002-002__ORDER')!
  const state = captureRuntimeDirectDispatchState(), tenderState = captureRuntimeTaskTenderRecordStore()
  try {
    const line = source.scopeSkuLines[0]!
    const input = { tenderId: 'TD-SCOPE-CONTRACT', taskId: source.taskId, businessAssignedAt: '2099-01-01 08:00:00', assignmentOperatedAt: '2099-01-01 08:00:00', biddingDeadline: '2099-01-02 18:00:00', taskDeadline: '', poolMode: 'ALL_ELIGIBLE' as const,
      taskSnapshot: { taskNo: source.taskNo!, productionOrderId: source.productionOrderId, processName: source.processNameZh, taskTypeLabel: '独立车缝任务', qty: line.qty, qtyUnit: '件', skuLines: [line] },
      factoryPool: [{ factoryId: 'ID-F001', factoryName: '验收工厂' }], standardPrice: 1500, minPrice: 1200, currency: 'IDR', unit: '件', remark: '', createdBy: '测试' }
    assert.throws(() => upsertRuntimeTaskTenderRecord(input), /完整任务范围一致/)
    const whole = listRuntimeExecutionTasks().find(task => classifyTaskFulfillmentPolicy(task).assignmentGranularity === 'ORDER' && task.scopeSkuLines.length > 1)!
    assert.throws(() => upsertRuntimeTaskTenderRecord({ ...input, taskId: whole.taskId }), /完整任务范围一致/)
    const selected = allocateRuntimeSkuTaskScope({ taskId: source.taskId, lines: [line], by: '测试' })
    assert.equal(upsertRuntimeTaskTenderRecord({ ...input, taskId: selected.taskId }).taskSnapshot.qty, line.qty)
  } finally { restoreRuntimeDirectDispatchState(state); restoreRuntimeTaskTenderRecordStore(tenderState) }
})

test('整单任务的有效分配写入也拒绝局部 SKU，派单和定标均不能绕过', () => {
  const task = listRuntimeExecutionTasks().find(task => classifyTaskFulfillmentPolicy(task).normalizedProcessCodes[0] === 'CUTTING' && task.scopeSkuLines.length > 1)!
  const state = captureEffectiveTaskAssignmentState()
  try {
    const input = { runtimeTaskId: task.taskId, productionOrderId: task.productionOrderId, factoryId: 'ID-FAC-0001', factoryName: '验收工厂', source: 'DIRECT_DISPATCH' as const,
      assignedQty: task.scopeQty, skuLines: task.scopeSkuLines, processCodes: ['CUTTING'], frozenPrice: 1200, priceCurrency: 'IDR', priceUnit: '件', businessAssignedAt: '2026-10-10 09:00:00', operatedAt: '2026-10-10 09:00:00', operatedBy: '测试' }
    for (const source of ['DIRECT_DISPATCH', 'TENDER_AWARD'] as const) {
      assert.throws(() => createEffectiveTaskAssignment({ ...input, source, assignedQty: task.scopeSkuLines[0]!.qty, skuLines: [task.scopeSkuLines[0]!] }), /只允许整单分配/)
    }
    assert.equal(createEffectiveTaskAssignment(input).assignedQty, task.scopeQty)
  } finally { restoreEffectiveTaskAssignmentState(state) }
})
