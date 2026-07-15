#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as productionOrderDomain from '../src/data/fcs/production-orders.ts'
import {
  acceptRuntimeTaskAssignment,
  allocateRuntimeSewingTaskScope,
  applyRuntimeDirectDispatchMeta,
  awardRuntimeTaskTender,
  captureRuntimeDirectDispatchState,
  getRuntimeTaskById,
  isRuntimeIndependentSewingTask,
  isRuntimeSewingTask,
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  restoreRuntimeDirectDispatchState,
  upsertRuntimeTaskTender,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  createSewingDispatchWorkbenchDraft,
  listSewingDispatchWorkbenchDrafts,
  listSewingDispatchWorkbenchRows,
  listSewingDispatchWorkbenchTasks,
  listSewingFactoryOptions,
  runSewingDispatchWorkbenchTransaction,
} from '../src/data/fcs/sewing-dispatch-workbench.ts'
import {
  captureSewingDeliverySlaSnapshotStore,
  getSewingDeliverySlaSnapshot,
  restoreSewingDeliverySlaSnapshotStore,
} from '../src/data/fcs/sewing-delivery-sla.ts'
import {
  closeDispatchDialog,
  openDispatchDialog,
} from '../src/pages/dispatch-board/dispatch-domain.ts'
import { state as dispatchBoardState } from '../src/pages/dispatch-board/context.ts'

const runtimeTasks = listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))

assert.equal(typeof isRuntimeIndependentSewingTask, 'function', '运行时任务必须提供独立车缝任务判定')

const sewingBusinessTask = runtimeTasks.find((task) =>
  task.processBusinessCode === 'SEW' && task.assignmentStatus === 'UNASSIGNED' && !getSewingDeliverySlaSnapshot(task.taskId),
)
assert(sewingBusinessTask, '必须动态找到 processBusinessCode=SEW 的独立车缝样本')
assert.equal(sewingBusinessTask.processBusinessCode, 'SEW', '回归样本必须是车缝业务码任务')
assert.equal(isRuntimeSewingTask(sewingBusinessTask), true, '车缝业务码任务必须属于含车缝宽口径')
assert.equal(isRuntimeIndependentSewingTask(sewingBusinessTask), true, '独立车缝任务必须进入独立车缝工作台口径')
assert.equal(
  isRuntimeIndependentSewingTask({
    ...sewingBusinessTask,
    taskUnitType: 'COMBINED_PROCESS_TASK',
    acceptanceMode: 'SINGLE_PROCESS',
    processBusinessCode: 'SEW',
  }),
  false,
  'taskUnitType 已标记为连续工序时，即使其他字段像独立车缝也必须排除',
)

const combinedSewingTask = runtimeTasks.find((task) =>
  task.processBusinessCode === 'COMBINED_PROCESS_TASK' &&
  task.coveredProcesses?.some((process) => process.processCode === 'SEW'),
)
assert(combinedSewingTask, '必须动态找到覆盖车缝的连续工序样本')
assert(
  combinedSewingTask.coveredProcesses?.some((process) => process.processCode === 'SEW'),
  '回归样本必须覆盖车缝工序',
)
assert.equal(isRuntimeSewingTask(combinedSewingTask), true, '覆盖车缝工序的组合任务必须属于含车缝宽口径')
assert.equal(isRuntimeIndependentSewingTask(combinedSewingTask), false, '连续工序任务不得进入独立车缝工作台口径')
assert.equal(combinedSewingTask.acceptanceMode, 'CONTINUOUS_PROCESS', '连续工序回归样本必须带连续工序接单模式')

const specialCraftNamedLikeSewing = runtimeTasks.find((task) =>
  task.processBusinessCode === 'SPECIAL_CRAFT',
)
assert(specialCraftNamedLikeSewing, '必须动态找到特殊工艺样本')
assert.equal(specialCraftNamedLikeSewing.processBusinessCode, 'SPECIAL_CRAFT', '回归样本必须是特殊工艺任务')
assert.equal(isRuntimeSewingTask(specialCraftNamedLikeSewing), false, '特殊工艺不能仅因名称包含车缝进入车缝分配工作台')

const workbenchTasks = listSewingDispatchWorkbenchTasks()
assert(workbenchTasks.length > 0, '车缝分配工作台必须有可展示的 mock 任务')
assert.equal(workbenchTasks.some((task) => task.taskId === 'TASKGEN-202603-083-002__ORDER'), false, '已中标待确认任务不得继续出现在车缝待分配工作台')
assert(
  workbenchTasks.some((task) => task.taskId === sewingBusinessTask.taskId),
  '车缝业务码任务必须出现在车缝分配工作台列表',
)
assert.equal(
  workbenchTasks.some((task) => task.taskId === combinedSewingTask.taskId),
  false,
  '含车缝的连续工序任务不得出现在独立车缝工作台列表',
)
assert.equal(
  workbenchTasks.every((task) => isRuntimeIndependentSewingTask(getRuntimeTaskById(task.taskId)!)),
  true,
  '独立车缝工作台不得混入整单或连续工序任务',
)

const {
  listProductionOrderSewingFactories,
  registerProductionOrderSewingFactory,
  selectProductionOrderMainFactory,
} = productionOrderDomain

assert.equal(typeof registerProductionOrderSewingFactory, 'function', '生产单必须提供车缝承接工厂登记能力')
assert.equal(typeof selectProductionOrderMainFactory, 'function', '生产单必须提供唯一主工厂选择能力')
assert.equal(typeof listProductionOrderSewingFactories, 'function', '生产单必须提供全部车缝承接工厂查询能力')

const stateBeforeFactoryRelationTest = captureRuntimeDirectDispatchState()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === 'PO-202603-084')
  assert(order, '必须存在尚未登记车缝承接关系的真实生产单 PO-202603-084')
  const orderCreatedMainFactoryId = order.mainFactoryId
  assert.notEqual(orderCreatedMainFactoryId, 'ID-F011', '回归样本的订单创建主工厂必须与首家真实车缝承接工厂不同')
  assert.deepEqual(listProductionOrderSewingFactories(order.productionOrderId), [], '订单创建主工厂不得自动成为有效车缝承接关系')

  const first = registerProductionOrderSewingFactory({
    productionOrderId: order.productionOrderId,
    factoryId: 'ID-F011',
    factoryName: '错误的工厂入参名称',
    by: '跟单A',
    at: '2026-07-10 09:00:00',
  })
  assert(first, '登记第一家有效车缝承接工厂必须成功')
  assert.equal(first.mainFactoryId, 'ID-F011', '首家真实车缝承接工厂必须覆盖不在有效承接关系内的订单创建主工厂')
  assert.deepEqual(listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id), ['ID-F011'])
  assert.match(first.auditLogs.at(-1)?.detail ?? '', /CV Satellite Cluster Malang A/, '登记审计必须使用 factoryId 解析的规范工厂名称')
  assert.doesNotMatch(first.auditLogs.at(-1)?.detail ?? '', /错误的工厂入参名称/, '登记审计不得信任不一致的工厂名称入参')

  const second = registerProductionOrderSewingFactory({
    productionOrderId: order.productionOrderId,
    factoryId: 'ID-F012',
    factoryName: 'CV Satellite Cluster Denpasar',
    by: '跟单A',
    at: '2026-07-10 09:10:00',
  })
  assert(second, '登记第二家有效车缝承接工厂必须成功')
  assert.equal(second.mainFactoryId, 'ID-F011', '后续车缝承接工厂不得自动覆盖现有主工厂')
  assert.deepEqual(listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id), ['ID-F011', 'ID-F012'])
  assert.equal(productionOrderDomain.formatProductionOrderMainFactoryName(second), 'CV Satellite Cluster Malang A', '主工厂格式化始终只能返回一家')

  const selected = selectProductionOrderMainFactory({
    productionOrderId: order.productionOrderId,
    factoryId: 'ID-F012',
    by: '生产主管A',
    at: '2026-07-10 09:20:00',
    reason: '两家共同承接，指定后道衔接更稳定的工厂为主工厂',
  })
  assert(selected, '已登记的车缝承接工厂必须可被选择为主工厂')
  assert.equal(selected.mainFactoryId, 'ID-F012')
  assert.equal(productionOrderDomain.formatProductionOrderMainFactoryName(selected), 'CV Satellite Cluster Denpasar')
  assert.match(selected.auditLogs.at(-1)?.detail ?? '', /两家共同承接，指定后道衔接更稳定的工厂为主工厂/)
  assert.match(selected.auditLogs.at(-1)?.detail ?? '', /CV Satellite Cluster Malang A → CV Satellite Cluster Denpasar/, '主工厂调整审计必须记录原工厂到新工厂')
  assert.equal(selected.auditLogs.at(-1)?.by, '生产主管A')
  assert.equal(selected.auditLogs.at(-1)?.at, '2026-07-10 09:20:00')

  const rejected = selectProductionOrderMainFactory({
    productionOrderId: order.productionOrderId,
    factoryId: 'ID-F014',
    by: '生产主管A',
    reason: '未登记工厂不允许成为主工厂',
  })
  assert.equal(rejected, null, '主工厂只能从已登记的车缝承接工厂中选择')
  assert.equal(order.mainFactoryId, 'ID-F012', '非法主工厂选择不得改变当前主工厂')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeFactoryRelationTest)
}

const stateBeforeKeepMainFactoryUiTest = captureRuntimeDirectDispatchState()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === sewingBusinessTask.productionOrderId)
  assert(order)
  assert(registerProductionOrderSewingFactory({
    productionOrderId: order.productionOrderId,
    factoryId: 'ID-F011',
    by: '跟单A',
  }))
  openDispatchDialog([sewingBusinessTask.taskId])
  assert.equal(dispatchBoardState.dispatchForm.mainFactoryGroupKey, '__KEEP_CURRENT_MAIN_FACTORY__', '已有有效主工厂时明细派单应默认保留当前主工厂')
} finally {
  closeDispatchDialog()
  restoreRuntimeDirectDispatchState(stateBeforeKeepMainFactoryUiTest)
}

const stateBeforeMissingMainFactoryUiTest = captureRuntimeDirectDispatchState()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === sewingBusinessTask.productionOrderId)
  assert(order)
  order.mainFactoryId = productionOrderDomain.PENDING_MAIN_FACTORY_ID
  order.mainFactorySnapshot = productionOrderDomain.createPendingMainFactorySnapshot()
  order.mainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT'
  order.sewingFactorySnapshots = []
  openDispatchDialog([sewingBusinessTask.taskId])
  assert.equal(dispatchBoardState.dispatchForm.mainFactoryGroupKey, '', '没有有效车缝主工厂时不得默认保留订单创建主工厂，必须由用户明确选择本次分配单元')
} finally {
  closeDispatchDialog()
  restoreRuntimeDirectDispatchState(stateBeforeMissingMainFactoryUiTest)
}

const directDispatchBase = {
  taskId: sewingBusinessTask.taskId,
  factoryId: 'ID-F011',
  factoryName: 'CV Satellite Cluster Malang A',
  acceptDeadline: '',
  taskDeadline: '',
  remark: '主工厂关系检查',
  by: '跟单A',
  dispatchPrice: 12000,
  dispatchPriceCurrency: 'IDR',
  dispatchPriceUnit: '件',
  priceDiffReason: '',
  businessAssignedAt: '2026-07-10 08:00:00',
  operatedAt: '2026-07-10 09:00:00',
} as const

assert.equal(typeof runSewingDispatchWorkbenchTransaction, 'function', '车缝工作台必须提供工作流级原子事务')

const workbenchTransactionRuntimeBefore = captureRuntimeDirectDispatchState()
const workbenchTransactionSnapshotBefore = captureSewingDeliverySlaSnapshotStore()
const secondIndependentTask = runtimeTasks.find((task) =>
  task.taskId !== sewingBusinessTask.taskId
  && task.processBusinessCode === 'SEW'
  && task.assignmentStatus === 'UNASSIGNED'
  && !getSewingDeliverySlaSnapshot(task.taskId),
)
assert(secondIndependentTask, '跨任务事务回归必须找到不与草稿重叠的第二个独立车缝任务')
assert.throws(
  () => runSewingDispatchWorkbenchTransaction(() => {
    assert(applyRuntimeDirectDispatchMeta({
      ...directDispatchBase,
      taskId: sewingBusinessTask.taskId,
      factoryId: 'ID-F011',
      factoryName: 'CV Satellite Cluster Malang A',
    }))
    applyRuntimeDirectDispatchMeta({
      ...directDispatchBase,
      taskId: secondIndependentTask.taskId,
      factoryId: 'NOT-A-FACTORY',
      factoryName: '不存在的第二家工厂',
    })
  }),
  /车缝承接工厂登记失败/,
  '第二个任务失败时工作流事务必须抛错并触发整体回滚',
)
assert.deepEqual(captureRuntimeDirectDispatchState(), workbenchTransactionRuntimeBefore, '跨任务失败必须恢复全部运行时、拆分结果、生产单和主工厂状态')
assert.deepEqual(captureSewingDeliverySlaSnapshotStore(), workbenchTransactionSnapshotBefore, '跨任务失败必须恢复全部履约快照')

const stateBeforeDirectDispatchRelationTest = captureRuntimeDirectDispatchState()
const snapshotBeforeDirectDispatchRelationTest = captureSewingDeliverySlaSnapshotStore()
try {
  let order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === sewingBusinessTask.productionOrderId)
  assert(order)
  order.mainFactoryId = productionOrderDomain.PENDING_MAIN_FACTORY_ID
  order.mainFactorySnapshot = productionOrderDomain.createPendingMainFactorySnapshot()
  order.mainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT'
  order.sewingFactorySnapshots = []

  const secondAssignmentTaskId = `${sewingBusinessTask.taskId}__SECOND_FACTORY`
  const fixtureState = captureRuntimeDirectDispatchState()
  fixtureState.reassignedTasks.push([secondAssignmentTaskId, {
    ...structuredClone(sewingBusinessTask),
    taskId: secondAssignmentTaskId,
    taskNo: secondAssignmentTaskId,
    assignmentMode: 'HOLD',
    assignmentStatus: 'UNASSIGNED',
    acceptanceStatus: undefined,
    assignedFactoryId: undefined,
    assignedFactoryName: undefined,
    tenderId: undefined,
    executionEnabled: true,
  }])
  restoreRuntimeDirectDispatchState(fixtureState)
  order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === sewingBusinessTask.productionOrderId)
  assert(order)

  assert(applyRuntimeDirectDispatchMeta({ ...directDispatchBase, writeBackMainFactory: false }))
  assert.deepEqual(listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id), ['ID-F011'])
  assert.equal(order.mainFactoryId, 'ID-F011', '第一家直派车缝工厂必须自动成为主工厂')

  assert(applyRuntimeDirectDispatchMeta({
    ...directDispatchBase,
    taskId: secondAssignmentTaskId,
    factoryId: 'ID-F012',
    factoryName: 'CV Satellite Cluster Denpasar',
    operatedAt: '2026-07-10 09:10:00',
    writeBackMainFactory: false,
  }))
  assert.deepEqual(
    listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id),
    ['ID-F011', 'ID-F012'],
    '新增第二家车缝承接工厂必须保留全部承接关系',
  )
  assert.equal(order.mainFactoryId, 'ID-F011', '已有有效主工厂时必须支持保留当前主工厂')

  assert(selectProductionOrderMainFactory({
    productionOrderId: order.productionOrderId,
    factoryId: 'ID-F012',
    by: '跟单A',
    at: '2026-07-10 09:20:00',
    reason: '两家实际分配任务共同承接，明确指定第二家为主工厂。',
  }))
  assert.deepEqual(
    listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id),
    ['ID-F011', 'ID-F012'],
    '多工厂派单必须登记全部车缝承接关系',
  )
  assert.equal(order.mainFactoryId, 'ID-F012', '按明细明确选择的工厂必须成为唯一主工厂')
  assert.equal(productionOrderDomain.formatProductionOrderMainFactoryName(order), 'CV Satellite Cluster Denpasar')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeDirectDispatchRelationTest)
  restoreSewingDeliverySlaSnapshotStore(snapshotBeforeDirectDispatchRelationTest)
}

const stateBeforeInvalidFactoryTest = captureRuntimeDirectDispatchState()
const snapshotBeforeInvalidFactoryTest = captureSewingDeliverySlaSnapshotStore()
try {
  const taskBefore = getRuntimeTaskById(sewingBusinessTask.taskId)
  const orderBefore = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === sewingBusinessTask.productionOrderId)
  assert(taskBefore && orderBefore)
  const mainFactoryBefore = orderBefore.mainFactoryId
  const sewingFactoryIdsBefore = listProductionOrderSewingFactories(orderBefore.productionOrderId).map((factory) => factory.id)
  assert.throws(
    () => applyRuntimeDirectDispatchMeta({
      ...directDispatchBase,
      factoryId: 'NOT-A-FACTORY',
      factoryName: '不存在的工厂',
    }),
    /车缝承接工厂登记失败/,
    '车缝承接关系登记失败必须阻断直接派单',
  )
  assert.equal(getRuntimeTaskById(sewingBusinessTask.taskId)?.assignmentStatus, taskBefore.assignmentStatus, '登记失败不得留下部分运行时派单状态')
  assert.equal(orderBefore.mainFactoryId, mainFactoryBefore, '登记失败不得改变生产单主工厂')
  assert.deepEqual(listProductionOrderSewingFactories(orderBefore.productionOrderId).map((factory) => factory.id), sewingFactoryIdsBefore)
  assert.equal(getSewingDeliverySlaSnapshot(sewingBusinessTask.taskId), null, '登记失败不得留下履约快照')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeInvalidFactoryTest)
  restoreSewingDeliverySlaSnapshotStore(snapshotBeforeInvalidFactoryTest)
}

const stateBeforeContinuousRelationTest = captureRuntimeDirectDispatchState()
const snapshotBeforeContinuousRelationTest = captureSewingDeliverySlaSnapshotStore()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === combinedSewingTask.productionOrderId)
  assert(order)
  order.mainFactoryId = productionOrderDomain.PENDING_MAIN_FACTORY_ID
  order.mainFactorySnapshot = productionOrderDomain.createPendingMainFactorySnapshot()
  order.mainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT'
  order.sewingFactorySnapshots = []
  assert(applyRuntimeDirectDispatchMeta({
    ...directDispatchBase,
    taskId: combinedSewingTask.taskId,
  }))
  assert.deepEqual(
    listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id),
    ['ID-F011'],
    '含车缝连续工序虽然不进独立工作台，仍必须登记车缝承接关系',
  )
  assert.equal(order.mainFactoryId, 'ID-F011')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeContinuousRelationTest)
  restoreSewingDeliverySlaSnapshotStore(snapshotBeforeContinuousRelationTest)
}

const stateBeforeTenderAcceptanceRelationTest = captureRuntimeDirectDispatchState()
const snapshotBeforeTenderAcceptanceRelationTest = captureSewingDeliverySlaSnapshotStore()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === sewingBusinessTask.productionOrderId)
  assert(order)
  order.mainFactoryId = productionOrderDomain.PENDING_MAIN_FACTORY_ID
  order.mainFactorySnapshot = productionOrderDomain.createPendingMainFactorySnapshot()
  order.mainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT'
  order.sewingFactorySnapshots = []
  assert(upsertRuntimeTaskTender(sewingBusinessTask.taskId, {
    tenderId: `TENDER-${sewingBusinessTask.taskId}`,
    biddingDeadline: '2026-07-10 18:00:00',
    taskDeadline: '2026-07-20 18:00:00',
    businessAssignedAt: '2026-07-10 08:00:00',
    assignmentOperatedAt: '2026-07-10 08:30:00',
  }, '跟单A'))
  awardRuntimeTaskTender({
    taskId: sewingBusinessTask.taskId,
    factoryId: 'ID-F011',
    factoryName: 'CV Satellite Cluster Malang A',
    awardedAt: '2026-07-10 09:00:00',
    awardedPrice: 12000,
    by: '运营A',
  })
  assert.deepEqual(listProductionOrderSewingFactories(order.productionOrderId), [], '竞价定标尚未接单时不得提前登记车缝承接关系')
  acceptRuntimeTaskAssignment(sewingBusinessTask.taskId, {
    factoryId: 'ID-F011',
    acceptedAt: '2026-07-10 10:00:00',
    acceptedBy: '工厂接单员A',
  })
  assert.deepEqual(
    listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id),
    ['ID-F011'],
    '竞价中标工厂确认接单后必须登记车缝承接关系',
  )
  assert.equal(order.mainFactoryId, 'ID-F011', '首家确认接单的车缝工厂必须自动成为主工厂')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeTenderAcceptanceRelationTest)
  restoreSewingDeliverySlaSnapshotStore(snapshotBeforeTenderAcceptanceRelationTest)
}

const stateBeforeAutoAcceptedTenderRelationTest = captureRuntimeDirectDispatchState()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === combinedSewingTask.productionOrderId)
  assert(order)
  order.mainFactoryId = productionOrderDomain.PENDING_MAIN_FACTORY_ID
  order.mainFactorySnapshot = productionOrderDomain.createPendingMainFactorySnapshot()
  order.mainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT'
  order.sewingFactorySnapshots = []
  assert(upsertRuntimeTaskTender(combinedSewingTask.taskId, {
    tenderId: `TENDER-${combinedSewingTask.taskId}`,
    biddingDeadline: '2026-07-10 18:00:00',
    taskDeadline: '2026-07-20 18:00:00',
    businessAssignedAt: '2026-07-10 08:00:00',
    assignmentOperatedAt: '2026-07-10 08:30:00',
  }, '跟单A'))
  const awarded = awardRuntimeTaskTender({
    taskId: combinedSewingTask.taskId,
    factoryId: 'ID-F011',
    factoryName: 'CV Satellite Cluster Malang A',
    awardedAt: '2026-07-10 09:00:00',
    awardedPrice: 12000,
    by: '运营A',
  })
  assert.equal(awarded.acceptanceStatus, 'ACCEPTED', '无需二次确认的含车缝任务应保持原有定标即接单行为')
  assert.deepEqual(
    listProductionOrderSewingFactories(order.productionOrderId).map((factory) => factory.id),
    ['ID-F011'],
    '定标即接单的含车缝任务必须在定标时登记车缝承接关系',
  )
  assert.equal(order.mainFactoryId, 'ID-F011')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeAutoAcceptedTenderRelationTest)
}

const dispatchDomainSource = readFileSync(new URL('../src/pages/dispatch-board/dispatch-domain.ts', import.meta.url), 'utf8')
assert.match(dispatchDomainSource, /当前主工厂：/, '按明细多工厂派单必须展示生产单当前唯一主工厂')
assert.match(dispatchDomainSource, /formatProductionOrderMainFactoryName/, '主工厂展示必须复用生产单唯一主工厂口径')
assert.match(dispatchDomainSource, /KEEP_CURRENT_MAIN_FACTORY/, '按明细多工厂派单必须具备保留当前有效主工厂的明确选择值')
assert.match(dispatchDomainSource, /保留当前主工厂/, '已有有效主工厂时必须向用户展示保留选项')

const wholeSkuFixtureRows = listSewingDispatchWorkbenchRows().filter((row) =>
  row.productionOrderId === 'PO-202603-084' && row.completeKitQty === row.remainingQty && row.remainingQty > 1,
)
assert(wholeSkuFixtureRows.length >= 2, '必须存在同一生产单至少两个完整齐套 SKU，覆盖按 SKU 分配多工厂')
const [firstSkuRow, secondSkuRow] = wholeSkuFixtureRows

const stateBeforeWholeSkuGuard = captureRuntimeDirectDispatchState()
try {
  assert.throws(
    () => allocateRuntimeSewingTaskScope({
      taskId: firstSkuRow.taskId,
      lines: [{ skuCode: firstSkuRow.skuCode, qty: firstSkuRow.remainingQty - 1 }],
      by: '测试跟单',
      operatedAt: '2026-07-13 09:00:00',
    }),
    /SKU.*全部待分配数量|整.*SKU|不能按数量拆分/,
    '独立车缝分配必须拒绝把同一个 SKU 按数量拆给工厂',
  )
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeWholeSkuGuard)
}

const availableFactories = listSewingFactoryOptions()
const firstFactory = availableFactories.find((factory) => factory.id === 'ID-F001')
const secondFactory = availableFactories.find((factory) => factory.id === 'ID-F011')
assert(firstFactory && secondFactory, '必须存在两家可用于多工厂分配验收的车缝工厂')

const stateBeforeSkuFactoryAllocation = captureRuntimeDirectDispatchState()
const slaBeforeSkuFactoryAllocation = captureSewingDeliverySlaSnapshotStore()
try {
  const order = productionOrderDomain.productionOrders.find((item) => item.productionOrderId === firstSkuRow.productionOrderId)
  assert(order)
  order.mainFactoryId = productionOrderDomain.PENDING_MAIN_FACTORY_ID
  order.mainFactorySnapshot = productionOrderDomain.createPendingMainFactorySnapshot()
  order.mainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT'
  order.sewingFactorySnapshots = []

  const result = createSewingDispatchWorkbenchDraft({
    actionType: '直接派单',
    rowIds: [firstSkuRow.rowId, secondSkuRow.rowId],
    factoryIdByRowId: {
      [firstSkuRow.rowId]: firstFactory.id,
      [secondSkuRow.rowId]: secondFactory.id,
    },
    businessAssignedAt: '2026-07-13 08:00:00',
    operatedAt: '2026-07-13 09:00:00',
    mainFactoryIdByProductionOrderId: { [firstSkuRow.productionOrderId]: firstFactory.id },
    by: '测试跟单',
  })
  assert.equal(result.ok, true, result.message)
  assert.equal(result.draft?.factorySummaries.length, 2, '同一生产单不同 SKU 必须能在一次操作中分配给两家工厂')
  assert.deepEqual(
    result.draft?.factorySummaries.map((summary) => summary.factoryId).sort(),
    [firstFactory.id, secondFactory.id].sort(),
  )
  assert.equal(result.draft?.qty, firstSkuRow.remainingQty + secondSkuRow.remainingQty, '每个 SKU 必须按全部待分配数量派出')
  assert.equal(order.mainFactoryId, firstFactory.id, '多家车缝工厂承接时必须确认唯一主工厂')
} finally {
  restoreRuntimeDirectDispatchState(stateBeforeSkuFactoryAllocation)
  restoreSewingDeliverySlaSnapshotStore(slaBeforeSkuFactoryAllocation)
}

console.log(`车缝分配工作台检查通过：taskCount=${workbenchTasks.length}`)
