import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  captureSewingDeliverySlaSnapshotStore,
  classifySewingDeliverySla,
  clearSewingDeliverySlaSnapshotStore,
  createSewingDeliverySlaSnapshot,
  dateTimeLocalToOperationWallClock,
  formatOperationLocalWallClock,
  getSewingDeliverySlaSnapshot,
  listSewingDeliverySlaSnapshotHistory,
  operationWallClockToDateTimeLocal,
  projectSewingDeliverySla,
  restoreSewingDeliverySlaSnapshotStore,
  saveSewingDeliverySlaSnapshot,
} from '../src/data/fcs/sewing-delivery-sla.ts'
import {
  applyRuntimeDirectDispatchMeta,
  batchDispatchRuntimeTasks,
  captureRuntimeDirectDispatchState,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  listRuntimeTaskAllocatableGroups,
  listRuntimeTaskSplitGroupsByOrder,
  prepareRuntimeDirectDispatchMeta,
  restoreRuntimeDirectDispatchState,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  confirmDirectDispatch,
  openDispatchDialog,
  renderDirectDispatchDialog,
} from '../src/pages/dispatch-board/dispatch-domain.ts'
import { state } from '../src/pages/dispatch-board/context.ts'
import { handleDispatchBoardEvent } from '../src/pages/dispatch-board/events.ts'
import {
  handleContinuousDispatchEvent,
  isContinuousDispatchDialogOpen,
  renderContinuousDispatchPage,
} from '../src/pages/continuous-dispatch.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'

const coveredProcess = (processCode: string, processName: string) => ({
  processCode,
  processName,
  sourceArtifactIds: [],
})

assert.equal(
  classifySewingDeliverySla({
    taskUnitType: 'PROCESS_TASK',
    processCode: 'SEW',
    processBusinessCode: 'SEW',
    processNameZh: '车缝',
    coveredProcesses: [coveredProcess('SEW', '车缝')],
  }),
  'INDEPENDENT_SEWING',
  '独立车缝任务应按独立车缝时效考核',
)

assert.equal(
  classifySewingDeliverySla({
    taskUnitType: 'SINGLE_PROCESS_TASK',
    processCode: 'SEW',
    processNameZh: '车缝',
    coveredProcesses: [coveredProcess('SEW', '车缝')],
  }),
  'INDEPENDENT_SEWING',
  '运行时单工序车缝任务应按独立车缝时效考核',
)

assert.equal(
  classifySewingDeliverySla({
    taskUnitType: 'COMBINED_PROCESS_TASK',
    processCode: 'POST',
    processNameZh: '车缝到包装',
    coveredProcesses: [
      coveredProcess('SEW', '车缝'),
      coveredProcess('BUTTON', '装扣'),
      coveredProcess('POST', '包装'),
    ],
  }),
  'SEWING_TO_PACKAGING',
  '车缝开始、包装结束的连续任务应按车缝到包装时效考核',
)

assert.equal(
  classifySewingDeliverySla({
    taskUnitType: 'COMBINED_PROCESS_TASK',
    processCode: 'POST',
    processNameZh: '裁片到后道',
    coveredProcesses: [
      coveredProcess('CUT', '裁片'),
      coveredProcess('SEW', '车缝'),
      coveredProcess('POST', '后道'),
    ],
  }),
  'CUTTING_TO_PACKAGING',
  '裁片开始、后道结束的连续任务应按裁片到包装时效考核',
)

assert.equal(
  classifySewingDeliverySla({
    taskUnitType: 'COMBINED_PROCESS_TASK',
    processCode: 'POST',
    processNameZh: '裁片到包装',
    coveredProcesses: [
      coveredProcess('CUT', '裁片'),
      coveredProcess('IRON', '整烫'),
      coveredProcess('POST', '包装'),
    ],
  }),
  null,
  '裁片到包装连续任务若实际不含车缝，不应进入含车缝履约规则',
)

assert.equal(
  classifySewingDeliverySla({
    taskUnitType: 'COMBINED_PROCESS_TASK',
    processCode: 'SEW',
    processNameZh: '裁片到车缝',
    coveredProcesses: [coveredProcess('CUT', '裁片'), coveredProcess('SEW', '车缝')],
  }),
  null,
  '不以后道或包装结束的连续任务不进入本履约规则',
)

const snapshot = createSewingDeliverySlaSnapshot({
  assignmentId: 'ASSIGN-1',
  runtimeTaskId: 'TASK-1',
  productionOrderId: 'PO-1',
  factoryId: 'F-1',
  factoryName: '万隆车缝厂',
  assignedQty: 101,
  acceptedAt: '2026-07-01 15:30:00',
  slaKind: 'INDEPENDENT_SEWING',
})

for (const invalidAssignedQty of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.throws(
    () => createSewingDeliverySlaSnapshot({
      assignmentId: 'ASSIGN-INVALID',
      runtimeTaskId: 'TASK-INVALID',
      productionOrderId: 'PO-INVALID',
      factoryId: 'F-INVALID',
      factoryName: '无效数量测试厂',
      assignedQty: invalidAssignedQty,
      acceptedAt: '2026-07-01 15:30:00',
      slaKind: 'INDEPENDENT_SEWING',
    }),
    /分配数量必须为正有限整数/,
    `分配数量 ${String(invalidAssignedQty)} 应被拒绝`,
  )
}

assert.equal(snapshot.snapshotId, 'SEWING-DELIVERY-SLA-ASSIGN-1', '快照编号应绑定分配结果')
assert.equal(snapshot.active, true, '新建履约快照应处于生效状态')
assert.equal(Object.isFrozen(snapshot), true, '履约快照顶层必须冻结')
assert.equal(Object.isFrozen(snapshot.milestones), true, '履约快照节点数组必须冻结')
assert.equal(snapshot.milestones.every(Object.isFrozen), true, '每个履约快照节点必须冻结')
assert.deepEqual(
  snapshot.milestones.map((item) => item.hoursAfterAcceptance),
  [96, 192, 216],
  '独立车缝节点小时数应为 96、192、216 小时',
)
assert.deepEqual(
  snapshot.milestones.map((item) => item.deadlineAt),
  ['2026-07-05 15:30:00', '2026-07-09 15:30:00', '2026-07-10 15:30:00'],
  '节点时间应按接单时间精确增加规则小时数',
)
assert.deepEqual(
  snapshot.milestones.map((item) => item.targetQty),
  [31, 71, 101],
  '101 件的 30%、70%、100% 目标应分别向上取整为 31、71、101 件',
)

for (const invalidAcceptedAt of [
  '2026-7-01 15:30:00',
  '2026-07-01T15:30:00',
  '2026-02-30 15:30:00',
  '2026-07-01 24:00:00',
  '2026-07-01 15:60:00',
  '2026-07-01 15:30:60',
]) {
  assert.throws(
    () => createSewingDeliverySlaSnapshot({
      assignmentId: 'ASSIGN-INVALID-TIME',
      runtimeTaskId: 'TASK-INVALID-TIME',
      productionOrderId: 'PO-INVALID-TIME',
      factoryId: 'F-INVALID-TIME',
      factoryName: '无效时间测试厂',
      assignedQty: 100,
      acceptedAt: invalidAcceptedAt,
      slaKind: 'INDEPENDENT_SEWING',
    }),
    /接单时间/,
    `接单时间 ${invalidAcceptedAt} 应被拒绝`,
  )
}

const timezoneProbe = `
  import { createSewingDeliverySlaSnapshot } from './src/data/fcs/sewing-delivery-sla.ts'
  const result = createSewingDeliverySlaSnapshot({
    assignmentId: 'TZ', runtimeTaskId: 'TZ', productionOrderId: 'TZ',
    factoryId: 'TZ', factoryName: '时区测试厂', assignedQty: 100,
    acceptedAt: '2026-03-06 15:30:00', slaKind: 'INDEPENDENT_SEWING',
  })
  process.stdout.write(result.milestones[0].deadlineAt)
`
const runTimezoneProbe = (timezone: string) => execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '--eval', timezoneProbe],
  { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TZ: timezone } },
)
assert.equal(runTimezoneProbe('UTC'), '2026-03-10 15:30:00')
assert.equal(
  runTimezoneProbe('America/New_York'),
  runTimezoneProbe('UTC'),
  '抽象业务时间加小时不得依赖部署机本地时区',
)

const sewingToPackagingSnapshot = createSewingDeliverySlaSnapshot({
  assignmentId: 'ASSIGN-2',
  runtimeTaskId: 'TASK-2',
  productionOrderId: 'PO-1',
  factoryId: 'F-1',
  factoryName: '万隆车缝厂',
  assignedQty: 100,
  acceptedAt: '2026-07-01 15:30:00',
  slaKind: 'SEWING_TO_PACKAGING',
})
assert.deepEqual(
  sewingToPackagingSnapshot.milestones.map((item) => item.hoursAfterAcceptance),
  [120, 216, 240],
  '车缝到包装节点小时数应为 120、216、240 小时',
)

const cuttingToPackagingSnapshot = createSewingDeliverySlaSnapshot({
  assignmentId: 'ASSIGN-3',
  runtimeTaskId: 'TASK-3',
  productionOrderId: 'PO-1',
  factoryId: 'F-1',
  factoryName: '万隆车缝厂',
  assignedQty: 100,
  acceptedAt: '2026-07-01 15:30:00',
  slaKind: 'CUTTING_TO_PACKAGING',
})
assert.deepEqual(
  cuttingToPackagingSnapshot.milestones.map((item) => item.hoursAfterAcceptance),
  [144, 216, 288],
  '裁片到包装节点小时数应为 144、216、288 小时',
)

const projection = projectSewingDeliverySla(
  snapshot,
  [
    {
      recordId: 'R2',
      submittedQty: 80,
      submittedAt: '2026-07-09 10:00:00',
      receivedQty: 80,
      receivedAt: '2026-07-09 11:00:00',
    },
    {
      recordId: 'R1',
      submittedQty: 31,
      submittedAt: '2026-07-05 14:00:00',
      receivedQty: 31,
      receivedAt: '2026-07-05 16:00:00',
    },
  ],
  '2026-07-10 16:00:00',
)

assert.equal(projection.confirmedReceivedQty, 111, '有效实收应按确认时间排序累计')
assert.equal(projection.progressRatio, 111 / 101, '履约比例达到超收时不应封顶')
assert.equal(projection.remainingQty, 0, '超收后剩余数量最低为 0')
assert.equal(projection.completed, true, '累计实收达到分配量后应完成')
assert.equal(projection.completedAt, '2026-07-09 11:00:00', '完成时间应取首次达到分配量的实收确认时间')
assert.equal(projection.milestones[0]?.firstReachedAt, '2026-07-05 16:00:00')
assert.equal(projection.milestones[0]?.result, 'OVERDUE_REACHED')
assert.deepEqual(
  projection.milestones[0]?.receiverDelayRecordIds,
  ['R1'],
  '截止前交出但截止后确认、且使节点达标的记录应标记接收方确认延迟',
)
assert.equal(projection.milestones[1]?.result, 'ON_TIME', '截止前确认达标的节点应为按时达标')
assert.notEqual(projection.snapshot, snapshot, '投影不得直接暴露调用方传入的快照引用')
assert.equal(Object.isFrozen(projection), true, '投影结果顶层必须冻结')
assert.equal(Object.isFrozen(projection.snapshot), true, '投影内快照副本必须冻结')
assert.equal(Object.isFrozen(projection.snapshot.milestones), true, '投影内快照节点数组必须冻结')
assert.equal(projection.snapshot.milestones.every(Object.isFrozen), true, '投影内每个快照节点必须冻结')
assert.equal(Object.isFrozen(projection.milestones), true, '投影节点数组必须冻结')
assert.equal(projection.milestones.every(Object.isFrozen), true, '每个投影节点必须冻结')
assert.equal(
  projection.milestones.every((milestone) => Object.isFrozen(milestone.receiverDelayRecordIds)),
  true,
  '投影节点内的接收延迟记录数组必须冻结',
)

const mutableSnapshotInput = {
  ...snapshot,
  milestones: snapshot.milestones.map((milestone) => ({ ...milestone })),
}
const mutableSnapshotBeforeProjection = structuredClone(mutableSnapshotInput)
const defensiveProjection = projectSewingDeliverySla(mutableSnapshotInput, [], '2026-07-05 15:00:00')
assert.deepEqual(mutableSnapshotInput, mutableSnapshotBeforeProjection, '投影不得修改调用方传入的快照')
assert.equal(Object.isFrozen(mutableSnapshotInput), false, '投影不得通过冻结修改调用方快照')
assert.notEqual(defensiveProjection.snapshot, mutableSnapshotInput, '投影必须返回快照防御副本')

const adjustedProjection = projectSewingDeliverySla(
  snapshot,
  [
    {
      recordId: 'VOIDED',
      submittedQty: 50,
      submittedAt: '2026-07-03 09:00:00',
      receivedQty: 50,
      receivedAt: '2026-07-03 10:00:00',
      voided: true,
    },
    {
      recordId: 'REVERSED',
      submittedQty: 50,
      submittedAt: '2026-07-04 09:00:00',
      receivedQty: 50,
      receivedAt: '2026-07-04 10:00:00',
      reversedQty: 20,
    },
    {
      recordId: 'REACHED',
      submittedQty: 1,
      submittedAt: '2026-07-05 14:30:00',
      receivedQty: 1,
      receivedAt: '2026-07-05 15:00:00',
    },
  ],
  '2026-07-05 15:00:00',
)
assert.equal(adjustedProjection.confirmedReceivedQty, 31, '作废记录不计入实收，冲销数量应从实收中扣减')
assert.equal(adjustedProjection.milestones[0]?.result, 'ON_TIME', '冲销后仍在截止前达标应为按时达标')

assert.throws(
  () => projectSewingDeliverySla({ ...snapshot, assignedQty: 0 }, [], '2026-07-05 15:00:00'),
  /分配数量必须为正有限整数/,
  '投影也必须拒绝无效分配数量，不能产生 NaN 比例',
)

const validReceiptFact = {
  recordId: 'VALIDATION-RECEIPT',
  submittedQty: 1,
  submittedAt: '2026-07-04 09:00:00',
  receivedQty: 1,
  receivedAt: '2026-07-04 10:00:00',
  reversedQty: 0,
}
for (const invalidQty of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.throws(
    () => projectSewingDeliverySla(
      snapshot,
      [{ ...validReceiptFact, submittedQty: invalidQty }],
      '2026-07-05 15:00:00',
    ),
    /交出数量必须为非负有限数/,
    `交出数量 ${String(invalidQty)} 应被拒绝`,
  )
  assert.throws(
    () => projectSewingDeliverySla(
      snapshot,
      [{ ...validReceiptFact, receivedQty: invalidQty }],
      '2026-07-05 15:00:00',
    ),
    /实收数量必须为非负有限数/,
    `实收数量 ${String(invalidQty)} 应被拒绝`,
  )
  assert.throws(
    () => projectSewingDeliverySla(
      snapshot,
      [{ ...validReceiptFact, reversedQty: invalidQty }],
      '2026-07-05 15:00:00',
    ),
    /冲销数量必须为非负有限数/,
    `冲销数量 ${String(invalidQty)} 应被拒绝`,
  )
}
assert.throws(
  () => projectSewingDeliverySla(
    snapshot,
    [{ ...validReceiptFact, receivedQty: 1, reversedQty: 2 }],
    '2026-07-05 15:00:00',
  ),
  /冲销数量不能超过实收数量/,
  '冲销数量超过实收数量时必须拒绝',
)
assert.throws(
  () => projectSewingDeliverySla(snapshot, [], '2026-02-30 15:00:00'),
  /当前时间/,
  '投影必须拒绝不存在的当前时间',
)
assert.throws(
  () => projectSewingDeliverySla(
    snapshot,
    [{ ...validReceiptFact, submittedAt: '2026-02-30 09:00:00' }],
    '2026-07-05 15:00:00',
  ),
  /交出时间/,
  '投影必须拒绝不存在的交出时间',
)
assert.throws(
  () => projectSewingDeliverySla(
    snapshot,
    [{ ...validReceiptFact, receivedAt: '2026-07-04 10:00' }],
    '2026-07-05 15:00:00',
  ),
  /实收时间/,
  '投影必须拒绝格式不完整的实收时间',
)

const upcomingProjection = projectSewingDeliverySla(snapshot, [], '2026-07-05 15:29:59')
assert.equal(upcomingProjection.milestones[0]?.result, 'UPCOMING', '节点未到期且未达标时应为未到期')
assert.equal(upcomingProjection.completed, false)

const dueProjection = projectSewingDeliverySla(snapshot, [], '2026-07-05 15:30:00')
assert.equal(dueProjection.milestones[0]?.result, 'OVERDUE_PENDING', '节点到期时仍未达标应为逾期待达标')

const pendingProjection = projectSewingDeliverySla(snapshot, [], '2026-07-05 15:30:01')
assert.equal(pendingProjection.milestones[0]?.result, 'OVERDUE_PENDING', '节点到期后未达标应为逾期待达标')
assert.equal(pendingProjection.milestones[1]?.result, 'UPCOMING', '尚未到期的后续节点仍应为未到期')

const lateSubmissionProjection = projectSewingDeliverySla(
  snapshot,
  [{
    recordId: 'LATE-SUBMISSION',
    submittedQty: 31,
    submittedAt: '2026-07-05 15:31:00',
    receivedQty: 31,
    receivedAt: '2026-07-05 15:32:00',
  }],
  '2026-07-05 15:32:00',
)
assert.equal(lateSubmissionProjection.milestones[0]?.result, 'OVERDUE_REACHED', '截止后确认达标应为逾期达标')
assert.deepEqual(
  lateSubmissionProjection.milestones[0]?.receiverDelayRecordIds,
  [],
  '截止后交出的记录不应标记为接收方确认延迟',
)

const sameTimeReceiptBatch = [
  {
    recordId: 'A-LATE-SUBMISSION',
    submittedQty: 20,
    submittedAt: '2026-07-05 15:31:00',
    receivedQty: 20,
    receivedAt: '2026-07-05 16:00:00',
  },
  {
    recordId: 'Z-EARLY-SUBMISSION',
    submittedQty: 5,
    submittedAt: '2026-07-05 14:00:00',
    receivedQty: 5,
    receivedAt: '2026-07-05 16:00:00',
  },
  {
    recordId: 'B-ZERO-SUBMISSION',
    submittedQty: 0,
    submittedAt: '2026-07-05 14:10:00',
    receivedQty: 3,
    receivedAt: '2026-07-05 16:00:00',
  },
  {
    recordId: 'M-SMALL-SUBMISSION',
    submittedQty: 1,
    submittedAt: '2026-07-05 14:20:00',
    receivedQty: 3,
    receivedAt: '2026-07-05 16:00:00',
  },
]
const sameTimeBatchProjection = projectSewingDeliverySla(
  createSewingDeliverySlaSnapshot({
    assignmentId: 'ASSIGN-BATCH',
    runtimeTaskId: 'TASK-BATCH',
    productionOrderId: 'PO-BATCH',
    factoryId: 'F-BATCH',
    factoryName: '万隆批次车缝厂',
    assignedQty: 100,
    acceptedAt: '2026-07-01 15:30:00',
    slaKind: 'INDEPENDENT_SEWING',
  }),
  [...sameTimeReceiptBatch].reverse(),
  '2026-07-05 16:00:00',
)
assert.equal(sameTimeBatchProjection.confirmedReceivedQty, 31, '同一确认时间的多笔记录应作为一个批次累计')
assert.deepEqual(
  sameTimeBatchProjection.milestones[0]?.receiverDelayRecordIds,
  ['M-SMALL-SUBMISSION', 'Z-EARLY-SUBMISSION'],
  '同批次达标应收集全部截止前有效交出，且不受 recordId 排序影响',
)

const multiBatchSnapshot = createSewingDeliverySlaSnapshot({
  assignmentId: 'ASSIGN-MULTI-BATCH',
  runtimeTaskId: 'TASK-MULTI-BATCH',
  productionOrderId: 'PO-MULTI-BATCH',
  factoryId: 'F-MULTI-BATCH',
  factoryName: '万隆多批次车缝厂',
  assignedQty: 100,
  acceptedAt: '2026-07-01 15:30:00',
  slaKind: 'INDEPENDENT_SEWING',
})
const multiBatchReceipts = [
  {
    recordId: 'Z-FIRST-BATCH',
    submittedQty: 20,
    submittedAt: '2026-07-05 14:00:00',
    receivedQty: 20,
    receivedAt: '2026-07-05 16:00:00',
  },
  {
    recordId: 'A-SECOND-BATCH',
    submittedQty: 10,
    submittedAt: '2026-07-05 14:10:00',
    receivedQty: 10,
    receivedAt: '2026-07-05 16:10:00',
  },
]
const multiBatchReachedProjection = projectSewingDeliverySla(
  multiBatchSnapshot,
  [...multiBatchReceipts].reverse(),
  '2026-07-05 16:10:00',
)
assert.equal(multiBatchReachedProjection.milestones[0]?.result, 'OVERDUE_REACHED')
assert.deepEqual(
  multiBatchReachedProjection.milestones[0]?.receiverDelayRecordIds,
  ['A-SECOND-BATCH', 'Z-FIRST-BATCH'],
  '首次达标前多个确认批次中的接收延迟候选都应纳入归因',
)

const multiBatchPendingProjection = projectSewingDeliverySla(
  multiBatchSnapshot,
  [multiBatchReceipts[0]],
  '2026-07-05 16:05:00',
)
assert.equal(multiBatchPendingProjection.milestones[0]?.result, 'OVERDUE_PENDING')
assert.deepEqual(
  multiBatchPendingProjection.milestones[0]?.receiverDelayRecordIds,
  [],
  '节点最终未达标时不得暴露尚未形成达标归因的候选记录',
)

assert.equal(typeof formatOperationLocalWallClock, 'function', '应提供操作端本地墙钟格式化函数')
assert.equal(typeof operationWallClockToDateTimeLocal, 'function', '应显式转换墙钟时间到 datetime-local')
assert.equal(typeof dateTimeLocalToOperationWallClock, 'function', '应显式转换 datetime-local 到墙钟存储值')
assert.equal(typeof listSewingDeliverySlaSnapshotHistory, 'function', '应提供运行时任务履约快照历史')
assert.equal(typeof captureSewingDeliverySlaSnapshotStore, 'function', '应提供履约快照仓状态捕获')
assert.equal(typeof restoreSewingDeliverySlaSnapshotStore, 'function', '应提供履约快照仓状态恢复')
assert.equal(typeof clearSewingDeliverySlaSnapshotStore, 'function', '应提供履约快照仓清理')
assert.equal(typeof captureRuntimeDirectDispatchState, 'function', '应提供直接派单运行时状态捕获')
assert.equal(typeof restoreRuntimeDirectDispatchState, 'function', '应提供直接派单运行时状态恢复')
assert.equal(typeof prepareRuntimeDirectDispatchMeta, 'function', '应提供无副作用的直接派单准备函数')

const runtimeTenderModule = await import('../src/data/fcs/runtime-process-tasks.ts')
assert.equal(typeof runtimeTenderModule.awardRuntimeTaskTender, 'function', '应提供统一运行时竞价定标函数')
assert.equal(typeof runtimeTenderModule.acceptRuntimeTaskAssignment, 'function', '应提供统一运行时任务接单函数')

const timezoneWallClockProbe = `
  import {
    compareSewingDeliveryDateTimes,
    dateTimeLocalToOperationWallClock,
    formatOperationLocalWallClock,
    operationWallClockToDateTimeLocal,
  } from './src/data/fcs/sewing-delivery-sla.ts'
  const now = new Date('2026-07-10T00:00:00.000Z')
  const wallClock = formatOperationLocalWallClock(now)
  const controlValue = operationWallClockToDateTimeLocal(wallClock)
  const storedValue = dateTimeLocalToOperationWallClock(controlValue)
  process.stdout.write(JSON.stringify({ wallClock, controlValue, storedValue, comparison: compareSewingDeliveryDateTimes(storedValue, wallClock) }))
`
const runWallClockProbe = (timezone: string) => JSON.parse(execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '--eval', timezoneWallClockProbe],
  { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TZ: timezone } },
)) as { wallClock: string; controlValue: string; storedValue: string; comparison: number }
assert.deepEqual(runWallClockProbe('Asia/Shanghai'), {
  wallClock: '2026-07-10 08:00:00',
  controlValue: '2026-07-10T08:00',
  storedValue: '2026-07-10 08:00:00',
  comparison: 0,
}, '上海操作端默认时间应使用本地墙钟，且往返后不被误判为未来')
assert.deepEqual(runWallClockProbe('Asia/Jakarta'), {
  wallClock: '2026-07-10 07:00:00',
  controlValue: '2026-07-10T07:00',
  storedValue: '2026-07-10 07:00:00',
  comparison: 0,
}, '雅加达操作端默认时间应使用本地墙钟，且往返后不被误判为未来')

const tenderRuntimeState = captureRuntimeDirectDispatchState()
const tenderSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  const sewingTenderTaskId = 'TASKGEN-202603-083-002__ORDER'
  const unawardedTaskId = 'TASKGEN-202603-084-003__ORDER'
  const rejectedTaskId = 'TASKGEN-202603-086-002__ORDER'
  const nonSewingTenderTaskId = 'TASKGEN-202603-0002-006__ORDER'
  for (const taskId of [sewingTenderTaskId, unawardedTaskId, rejectedTaskId, nonSewingTenderTaskId]) {
    clearSewingDeliverySlaSnapshotStore(taskId)
  }

  const tenderCreated = runtimeTenderModule.upsertRuntimeTaskTender(
    sewingTenderTaskId,
    {
      tenderId: 'TENDER-SLA-ACCEPT-001',
      biddingDeadline: '2026-07-01 10:30:00',
      taskDeadline: '2026-07-20 18:00:00',
      businessAssignedAt: '2026-07-01 09:00:00',
      assignmentOperatedAt: '2026-07-01 10:00:00',
    },
    '跟单A',
  )
  assert.ok(tenderCreated, '含车缝任务应可创建竞价')
  assert.equal(tenderCreated.businessAssignedAt, '2026-07-01 09:00:00', '竞价应保存业务分配时间')
  assert.equal(tenderCreated.assignmentOperatedAt, '2026-07-01 10:00:00', '竞价应保存实际操作时间')
  assert.equal(tenderCreated.assignedFactoryId, undefined, '创建竞价时不得预选主工厂或承接工厂')
  assert.equal(tenderCreated.deliverySlaSnapshotId, undefined, '创建竞价时不得挂接履约快照')
  assert.equal(getSewingDeliverySlaSnapshot(sewingTenderTaskId), null, '创建竞价时不得生成履约快照')

  const beforeFutureTender = structuredClone(getRuntimeTaskById(unawardedTaskId))
  assert.throws(
    () => runtimeTenderModule.upsertRuntimeTaskTender(
      unawardedTaskId,
      {
        tenderId: 'TENDER-SLA-FUTURE',
        biddingDeadline: '2026-07-02 18:00:00',
        taskDeadline: '2026-07-20 18:00:00',
        businessAssignedAt: '2026-07-01 11:00:00',
        assignmentOperatedAt: '2026-07-01 10:00:00',
      },
      '跟单A',
    ),
    /业务分配时间不能晚于当前操作时间/,
    '竞价创建必须阻断未来业务分配时间',
  )
  assert.deepEqual(getRuntimeTaskById(unawardedTaskId), beforeFutureTender, '未来时间失败不得修改任务状态')
  assert.equal(getSewingDeliverySlaSnapshot(unawardedTaskId), null, '未来时间失败不得生成履约快照')

  const awarded = runtimeTenderModule.awardRuntimeTaskTender({
    taskId: sewingTenderTaskId,
    factoryId: 'ID-F003',
    factoryName: '万隆车缝厂',
    awardedAt: '2026-07-01 11:00:00',
    awardedPrice: 13200,
    by: '平台定标员',
  })
  assert.equal(awarded.assignmentStatus, 'AWARDED', '定标后任务应进入已中标')
  assert.equal(awarded.assignedFactoryId, 'ID-F003')
  assert.equal(awarded.assignedFactoryName, '万隆车缝厂')
  assert.equal(awarded.awardedAt, '2026-07-01 11:00:00')
  assert.equal(awarded.dispatchPrice, 13200)
  assert.equal(awarded.acceptanceStatus, 'PENDING', '含车缝中标后必须等待工厂确认接单')
  assert.equal(awarded.acceptedAt, undefined)
  assert.equal(getSewingDeliverySlaSnapshot(sewingTenderTaskId), null, '平台定标不得提前启动含车缝 SLA')

  const beforeWrongFactoryAccept = structuredClone(getRuntimeTaskById(sewingTenderTaskId))
  const beforeWrongFactorySnapshotState = captureSewingDeliverySlaSnapshotStore()
  assert.throws(
    () => runtimeTenderModule.acceptRuntimeTaskAssignment(sewingTenderTaskId, {
      factoryId: 'ID-F004',
      acceptedAt: '2026-07-01 11:25:00',
      acceptedBy: '泗水裁片厂',
    }),
    /不是中标工厂|无权确认接单/,
    '非中标工厂不得确认接单',
  )
  assert.deepEqual(
    getRuntimeTaskById(sewingTenderTaskId),
    beforeWrongFactoryAccept,
    '非中标工厂接单失败后任务状态与审计必须完全不变',
  )
  assert.deepEqual(
    captureSewingDeliverySlaSnapshotStore(),
    beforeWrongFactorySnapshotState,
    '非中标工厂接单失败后快照仓必须完全不变',
  )

  const accepted = runtimeTenderModule.acceptRuntimeTaskAssignment(sewingTenderTaskId, {
    factoryId: 'ID-F003',
    acceptedAt: '2026-07-01 11:30:00',
    acceptedBy: '万隆车缝厂',
  })
  assert.equal(accepted.acceptanceStatus, 'ACCEPTED')
  assert.equal(accepted.acceptedAt, '2026-07-01 11:30:00')
  assert.equal(accepted.acceptedBy, '万隆车缝厂')
  const acceptedSnapshot = getSewingDeliverySlaSnapshot(sewingTenderTaskId)
  assert.ok(acceptedSnapshot, '实际确认接单后应生成含车缝 SLA 快照')
  assert.equal(acceptedSnapshot.acceptedAt, '2026-07-01 11:30:00', '快照必须使用工厂实际接单时间')
  assert.notEqual(acceptedSnapshot.acceptedAt, accepted.businessAssignedAt, '竞价业务分配时间不是履约起点')
  assert.equal(acceptedSnapshot.assignedQty, accepted.scopeQty)
  assert.equal(acceptedSnapshot.factoryId, 'ID-F003')
  assert.equal(accepted.taskDeadline, '2026-07-10 11:30:00', '含车缝任务截止应取 100% 履约节点')

  const acceptedBeforeDuplicate = structuredClone(accepted)
  const acceptedHistoryLength = listSewingDeliverySlaSnapshotHistory(sewingTenderTaskId).length
  assert.throws(
    () => runtimeTenderModule.acceptRuntimeTaskAssignment(sewingTenderTaskId, {
      factoryId: 'ID-F003',
      acceptedAt: '2026-07-01 11:35:00',
      acceptedBy: '万隆车缝厂',
    }),
    /已接单|不可重复接单/,
    '重复接单必须失败',
  )
  assert.deepEqual(getRuntimeTaskById(sewingTenderTaskId), acceptedBeforeDuplicate, '重复接单不得新增审计或修改任务')
  assert.equal(
    listSewingDeliverySlaSnapshotHistory(sewingTenderTaskId).length,
    acceptedHistoryLength,
    '重复接单不得生成第二条履约快照',
  )

  const unawardedBeforeAccept = structuredClone(getRuntimeTaskById(unawardedTaskId))
  assert.throws(
    () => runtimeTenderModule.acceptRuntimeTaskAssignment(unawardedTaskId, {
      factoryId: 'ID-F003',
      acceptedAt: '2026-07-01 11:30:00',
      acceptedBy: '万隆车缝厂',
    }),
    /未定标|未分配|承接工厂/,
    '未定标任务不得接单',
  )
  assert.deepEqual(getRuntimeTaskById(unawardedTaskId), unawardedBeforeAccept, '未定标接单失败不得修改状态')

  runtimeTenderModule.upsertRuntimeTaskTender(
    rejectedTaskId,
    {
      tenderId: 'TENDER-SLA-REJECTED',
      biddingDeadline: '2026-07-01 10:30:00',
      taskDeadline: '2026-07-20 18:00:00',
      businessAssignedAt: '2026-07-01 09:00:00',
      assignmentOperatedAt: '2026-07-01 10:00:00',
    },
    '跟单A',
  )
  runtimeTenderModule.awardRuntimeTaskTender({
    taskId: rejectedTaskId,
    factoryId: 'ID-F003',
    factoryName: '万隆车缝厂',
    awardedAt: '2026-07-01 11:00:00',
    awardedPrice: 13200,
    by: '平台定标员',
  })
  const rejectedInjectedState = captureRuntimeDirectDispatchState()
  const rejectedOverride = rejectedInjectedState.taskOverrides.find(([taskId]) => taskId === rejectedTaskId)
  assert.ok(rejectedOverride, '拒单防错测试应存在运行时覆盖')
  rejectedOverride[1].acceptanceStatus = 'REJECTED'
  restoreRuntimeDirectDispatchState(rejectedInjectedState)
  const rejectedBeforeAccept = structuredClone(getRuntimeTaskById(rejectedTaskId))
  assert.throws(
    () => runtimeTenderModule.acceptRuntimeTaskAssignment(rejectedTaskId, {
      factoryId: 'ID-F003',
      acceptedAt: '2026-07-01 11:30:00',
      acceptedBy: '万隆车缝厂',
    }),
    /已拒单|拒单后不可接单/,
    '拒单后不得错误接单',
  )
  assert.deepEqual(getRuntimeTaskById(rejectedTaskId), rejectedBeforeAccept, '拒单后接单失败不得修改任务')
  assert.equal(getSewingDeliverySlaSnapshot(rejectedTaskId), null)

  runtimeTenderModule.upsertRuntimeTaskTender(
    nonSewingTenderTaskId,
    {
      tenderId: 'TENDER-NON-SEWING',
      biddingDeadline: '2026-07-01 10:30:00',
      taskDeadline: '2026-07-20 18:00:00',
      businessAssignedAt: '2026-07-01 09:00:00',
      assignmentOperatedAt: '2026-07-01 10:00:00',
    },
    '跟单A',
  )
  const nonSewingAwarded = runtimeTenderModule.awardRuntimeTaskTender({
    taskId: nonSewingTenderTaskId,
    factoryId: 'ID-F010',
    factoryName: '雅加达绣花专工厂',
    awardedAt: '2026-07-01 11:00:00',
    awardedPrice: 5800,
    by: '平台定标员',
  })
  assert.equal(nonSewingAwarded.assignmentStatus, 'AWARDED', '非含车缝竞价仍应保持定标即归属')
  assert.equal(nonSewingAwarded.assignedFactoryId, 'ID-F010')
  assert.equal(nonSewingAwarded.acceptanceStatus, 'ACCEPTED', '非含车缝竞价应保留定标后直接归属并可执行的旧语义')
  assert.equal(nonSewingAwarded.acceptedAt, '2026-07-01 11:00:00')
  assert.equal(getSewingDeliverySlaSnapshot(nonSewingTenderTaskId), null)
} finally {
  restoreRuntimeDirectDispatchState(tenderRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(tenderSnapshotState)
}

const batchAwardProbe = `
  import assert from 'node:assert/strict'
  import { awardRuntimeTenderTasks } from './src/pages/dispatch-tenders.ts'
  import {
    captureRuntimeDirectDispatchState,
    getRuntimeTaskById,
    restoreRuntimeDirectDispatchState,
    upsertRuntimeTaskTender,
  } from './src/data/fcs/runtime-process-tasks.ts'
  import {
    captureSewingDeliverySlaSnapshotStore,
    getSewingDeliverySlaSnapshot,
    restoreSewingDeliverySlaSnapshotStore,
  } from './src/data/fcs/sewing-delivery-sla.ts'
  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  try {
    const taskId = 'TASKGEN-202603-083-002__ORDER'
    const createdRuntimeTender = upsertRuntimeTaskTender(taskId, {
      tenderId: 'TENDER-BATCH-AWARD',
      biddingDeadline: '2026-07-01 10:30:00',
      taskDeadline: '2026-07-20 18:00:00',
      businessAssignedAt: '2026-07-01 09:00:00',
      assignmentOperatedAt: '2026-07-01 10:00:00',
    }, '跟单A')
    assert.equal(createdRuntimeTender.assignmentMode, 'BIDDING', '真实运行时创建必须进入竞价分配方式')
    assert.equal(createdRuntimeTender.assignmentStatus, 'BIDDING', '真实运行时创建必须保持竞价分配中')
    const before = structuredClone(getRuntimeTaskById(taskId))
    const result = awardRuntimeTenderTasks({
      taskIds: [taskId, taskId],
      factoryId: 'ID-F003',
      factoryName: '万隆车缝厂',
      awardedAt: '2026-07-01 11:00:00',
      awardedPrice: 13200,
      by: '平台定标员',
    })
    assert.equal(result.ok, false, '第二次提交同一任务应在第一条已提交后失败')
    assert.deepEqual(getRuntimeTaskById(taskId), before)
    assert.equal(getSewingDeliverySlaSnapshot(taskId), null)
    const legacyNonSewingResult = awardRuntimeTenderTasks({
      taskIds: ['TASK-LEGACY-NON-SEWING'],
      factoryId: 'ID-F010',
      factoryName: '雅加达绣花专工厂',
      awardedAt: '2026-07-01 11:00:00',
      awardedPrice: 5800,
      by: '平台定标员',
      allowLegacyLocalOnly: true,
    })
    assert.equal(legacyNonSewingResult.ok, true)
    process.stdout.write('PASS')
  } finally {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
  }
`
assert.equal(
  execFileSync(new URL('../node_modules/.bin/tsx', import.meta.url).pathname, ['--eval', batchAwardProbe], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }),
  'PASS',
  '多任务定标第二条失败时不得留下第一条已定标状态',
)

const runtimeReachabilityProbe = `
  import assert from 'node:assert/strict'
  import {
    handleDispatchTendersEvent,
    listDispatchTenderRows,
    renderDispatchTendersPage,
  } from './src/pages/dispatch-tenders.ts'
  import { state as dispatchBoardState } from './src/pages/dispatch-board/context.ts'
  import {
    acceptPdaTaskWithRuntimeFallback,
    listPdaAwardedTendersForFactory,
  } from './src/pages/pda-task-receive.ts'
  import {
    captureRuntimeDirectDispatchState,
    getRuntimeTaskById,
    restoreRuntimeDirectDispatchState,
    upsertRuntimeTaskTender,
  } from './src/data/fcs/runtime-process-tasks.ts'
  import {
    captureSewingDeliverySlaSnapshotStore,
    getSewingDeliverySlaSnapshot,
    restoreSewingDeliverySlaSnapshotStore,
  } from './src/data/fcs/sewing-delivery-sla.ts'
  import { getPdaMobileExecutionTaskById } from './src/data/fcs/process-mobile-task-binding.ts'
  class FakeInputElement {}
  class FakeSelectElement {}
  class FakeTextAreaElement {}
  Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: FakeInputElement })
  Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: FakeSelectElement })
  Object.defineProperty(globalThis, 'HTMLTextAreaElement', { configurable: true, value: FakeTextAreaElement })
  const actionTarget = (dataset) => ({
    closest(selector) {
      if (selector === '[data-tender-field]') return null
      if (selector === '[data-tender-action]') return { dataset }
      return null
    },
  })
  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  const taskId = 'TASKGEN-202603-083-002__ORDER'
  const fixedNow = '2026-07-01 11:00:00'
  const previousTender = dispatchBoardState.tenderState[taskId]
  try {
    const createdRuntimeTender = upsertRuntimeTaskTender(taskId, {
      tenderId: 'TENDER-RUNTIME-REACHABLE',
      biddingDeadline: '2026-07-01 10:30:00',
      taskDeadline: '2026-07-20 18:00:00',
      businessAssignedAt: '2026-07-01 09:00:00',
      assignmentOperatedAt: '2026-07-01 10:00:00',
    }, '跟单A')
    assert.equal(createdRuntimeTender.assignmentMode, 'BIDDING', '真实运行时创建必须进入竞价分配方式')
    assert.equal(createdRuntimeTender.assignmentStatus, 'BIDDING', '真实运行时创建必须保持竞价分配中')
    dispatchBoardState.tenderState[taskId] = {
      taskId,
      tenderId: 'TENDER-RUNTIME-REACHABLE',
      tenderStatus: 'BIDDING',
      factoryPool: ['ID-F003', 'ID-F024'],
      factoryPoolNames: ['同名工厂', '同名工厂'],
      factoryQuotes: [
        { factoryId: 'ID-F003', factoryName: '同名工厂', hasQuoted: true, quotePrice: 13200, quoteTime: '2026-07-01 10:10:00' },
        { factoryId: 'ID-F024', factoryName: '同名工厂', hasQuoted: true, quotePrice: 13500, quoteTime: '2026-07-01 10:15:00' },
      ],
      minPrice: 12000,
      maxPrice: 15000,
      currency: 'IDR',
      unit: '件',
      biddingDeadline: '2026-07-01 10:30:00',
      taskDeadline: '2026-07-20 18:00:00',
      standardPrice: 14000,
      remark: '运行时招标投影',
      createdAt: '2026-07-01 10:00:00',
      quotedCount: 2,
      participatingFactoryIds: ['ID-F003', 'ID-F024'],
    }

    assert.equal(dispatchBoardState.tenderState[taskId].tenderStatus, 'BIDDING', '真实创建结果必须从招标中开始')
    const runtimeRow = listDispatchTenderRows(fixedNow).find((row) => row.tenderId === 'TENDER-RUNTIME-REACHABLE')
    assert.ok(runtimeRow, '工作台创建的运行时招标必须出现在招标管理页')
    assert.equal(runtimeRow.status, 'AWAIT_AWARD', '竞价已截止且已有有效报价时应从真实 BIDDING 派生为待定标')
    assert.deepEqual(runtimeRow.factoryQuotes.map((quote) => quote.factoryId), ['ID-F003', 'ID-F024'])
    handleDispatchTendersEvent(actionTarget({ tenderAction: 'open-view', tenderId: runtimeRow.tenderId }), fixedNow)
    handleDispatchTendersEvent(actionTarget({ tenderAction: 'select-award-factory', factoryId: 'ID-F024' }), fixedNow)
    handleDispatchTendersEvent(actionTarget({ tenderAction: 'confirm-award' }), fixedNow)
    assert.equal(getRuntimeTaskById(taskId)?.assignedFactoryId, 'ID-F024', '同名工厂定标必须以稳定工厂 ID 为准')
    handleDispatchTendersEvent(actionTarget({ tenderAction: 'open-view', tenderId: runtimeRow.tenderId }), fixedNow)
    const awardedHtml = renderDispatchTendersPage(fixedNow)
    assert.match(awardedHtml, /data-quote-factory-id="ID-F024" data-awarded="true"/, '同名工厂中仅实际 factoryId 应高亮中标')
    assert.match(awardedHtml, /data-quote-factory-id="ID-F003" data-awarded="false"/, '同名未中标工厂不得被名称误高亮')

    const awarded = listPdaAwardedTendersForFactory('ID-F024')
    assert.ok(awarded.some((item) => item.taskId === taskId && item.execStatus === '待接单'), '运行时中标待接单任务必须直接投影到当前工厂 PDA')
    acceptPdaTaskWithRuntimeFallback(taskId, 'ID-F024', '同名工厂', '2026-07-01 11:10:00')
    assert.equal(getSewingDeliverySlaSnapshot(taskId)?.acceptedAt, '2026-07-01 11:10:00', '运行时含车缝任务必须走统一接单并以确认接单时间起算')

    const legacyBefore = structuredClone(getPdaMobileExecutionTaskById('TASK-IRON-000521'))
    assert.ok(legacyBefore, '旧 Mock 回退测试任务必须存在')
    const legacyAccepted = acceptPdaTaskWithRuntimeFallback('TASK-IRON-000521', 'ID-F001', '旧工厂', '2026-07-01 11:20:00')
    assert.equal(legacyAccepted.acceptanceStatus, 'ACCEPTED', '非 SLA 旧 Mock 任务应保留显式接单回退')
    assert.equal(legacyAccepted.assignmentMode, legacyBefore.assignmentMode, '旧 Mock 接单不得改变 DIRECT 等分配方式')
    assert.equal(legacyAccepted.assignmentStatus, legacyBefore.assignmentStatus, '旧 Mock ASSIGNED 接单不得伪造为 AWARDED')
    assert.equal(legacyAccepted.status, legacyBefore.status, '旧 Mock 接单不得改变执行状态')
    process.stdout.write('PASS')
  } finally {
    if (previousTender) dispatchBoardState.tenderState[taskId] = previousTender
    else delete dispatchBoardState.tenderState[taskId]
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
  }
`
assert.equal(
  execFileSync(new URL('../node_modules/.bin/tsx', import.meta.url).pathname, ['--eval', runtimeReachabilityProbe], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }),
  'PASS',
  '运行时招标应可从定标页到 PDA 接单形成真实可达闭环',
)

const historyStoreState = captureSewingDeliverySlaSnapshotStore()
try {
  clearSewingDeliverySlaSnapshotStore('TASK-HISTORY')
  const firstHistorySnapshot = createSewingDeliverySlaSnapshot({
    assignmentId: 'ASSIGN-HISTORY-1',
    runtimeTaskId: 'TASK-HISTORY',
    productionOrderId: 'PO-HISTORY',
    factoryId: 'F-HISTORY-1',
    factoryName: '万隆历史工厂一',
    assignedQty: 100,
    acceptedAt: '2026-07-01 08:00:00',
    slaKind: 'INDEPENDENT_SEWING',
  })
  saveSewingDeliverySlaSnapshot(firstHistorySnapshot)
  const firstReadBeforeReplacement = getSewingDeliverySlaSnapshot('TASK-HISTORY')
  const secondHistorySnapshot = createSewingDeliverySlaSnapshot({
    assignmentId: 'ASSIGN-HISTORY-2',
    runtimeTaskId: 'TASK-HISTORY',
    productionOrderId: 'PO-HISTORY',
    factoryId: 'F-HISTORY-2',
    factoryName: '万隆历史工厂二',
    assignedQty: 120,
    acceptedAt: '2026-07-02 08:00:00',
    slaKind: 'INDEPENDENT_SEWING',
  })
  saveSewingDeliverySlaSnapshot(secondHistorySnapshot)
  const history = listSewingDeliverySlaSnapshotHistory('TASK-HISTORY')
  assert.equal(history.length, 2, '再次派单后应保留两条履约快照历史')
  assert.equal(history[0].active, false, '旧履约快照应失效')
  assert.equal(history[0].replacedByAssignmentId, 'ASSIGN-HISTORY-2', '旧快照应指向新分配编号')
  assert.equal(history[1].active, true, '新履约快照应生效')
  assert.equal(getSewingDeliverySlaSnapshot('TASK-HISTORY')?.snapshotId, secondHistorySnapshot.snapshotId, '当前读取应返回新快照')
  assert.equal(firstReadBeforeReplacement?.active, true, '替换不得修改已返回给调用方的旧快照')
  assert.equal(Object.isFrozen(history[0]), true, '历史读取仍应返回冻结防御副本')
} finally {
  restoreSewingDeliverySlaSnapshotStore(historyStoreState)
}

const batchRuntimeState = captureRuntimeDirectDispatchState()
const batchSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  const batchTaskId = 'TASKGEN-202603-083-002__ORDER'
  const batchTaskBefore = structuredClone(getRuntimeTaskById(batchTaskId))
  clearSewingDeliverySlaSnapshotStore(batchTaskId)
  const batchResult = batchDispatchRuntimeTasks({
    taskIds: [batchTaskId, 'TASK-MISSING-SECOND'],
    factoryId: 'ID-F003',
    factoryName: '万隆车缝厂',
    acceptDeadline: '',
    taskDeadline: '2026-07-20 18:00:00',
    remark: '批量原子校验',
    by: '跟单A',
    dispatchPrice: 12000,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    priceDiffReason: '',
    businessAssignedAt: '2026-07-01 08:00:00',
    operatedAt: '2026-07-01 10:00:00',
  })
  assert.equal(batchResult.ok, false, '批量第二个任务非法时应整体失败')
  assert.deepEqual(getRuntimeTaskById(batchTaskId), batchTaskBefore, '批量准备失败不得更新第一个任务')
  assert.equal(getSewingDeliverySlaSnapshot(batchTaskId), null, '批量准备失败不得保存第一个任务快照')
} finally {
  restoreRuntimeDirectDispatchState(batchRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(batchSnapshotState)
}

const localDefaultCandidates = [
  operationWallClockToDateTimeLocal(formatOperationLocalWallClock()),
]
openDispatchDialog(['TASKGEN-202603-084-003__ORDER'])
localDefaultCandidates.push(operationWallClockToDateTimeLocal(formatOperationLocalWallClock()))
assert.ok(
  localDefaultCandidates.includes(state.dispatchForm.businessAssignedAt),
  '直接派单弹窗默认业务时间必须等于操作端当前本地墙钟',
)

const detailRuntimeState = captureRuntimeDirectDispatchState()
const detailSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  const detailTask = getRuntimeTaskById('TASKGEN-202603-084-003__ORDER')
  assert.ok(detailTask, '明细原子性测试任务必须存在')
  const splitGroupsBefore = listRuntimeTaskSplitGroupsByOrder(detailTask.productionOrderId)
  const detailGroups = listRuntimeTaskAllocatableGroups(detailTask.taskId)
  assert.ok(detailGroups.length > 1, '明细原子性测试任务至少需要两个分配组')
  openDispatchDialog([detailTask.taskId])
  state.dispatchForm.mode = 'DETAIL'
  state.dispatchForm.dispatchPrice = String(detailTask.standardPrice ?? 10000)
  state.dispatchForm.businessAssignedAt = '2099-01-01T00:00'
  state.dispatchForm.mainFactoryGroupKey = detailGroups[0].groupKey
  state.dispatchForm.factoryByGroupKey = Object.fromEntries(detailGroups.map((group) => [
    group.groupKey,
    { factoryId: 'ID-F003', factoryName: '万隆车缝厂' },
  ]))
  confirmDirectDispatch()
  assert.equal(state.dispatchDialogError, '业务分配时间不能晚于当前操作时间')
  assert.deepEqual(
    listRuntimeTaskSplitGroupsByOrder(detailTask.productionOrderId),
    splitGroupsBefore,
    '明细未来时间校验失败不得生成拆分结果',
  )
  assert.equal(getSewingDeliverySlaSnapshot(detailTask.taskId), null, '明细未来时间校验失败不得生成履约快照')
} finally {
  restoreRuntimeDirectDispatchState(detailRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(detailSnapshotState)
}

class FakeClassList {
  private values = new Set<string>()

  toggle(value: string, force?: boolean): void {
    if (force === false) this.values.delete(value)
    else this.values.add(value)
  }
}

const previewSlot = { innerHTML: '未局部更新' }
const dialogErrorNode = { textContent: '', hidden: true, classList: new FakeClassList() }
const operatedAtNode = { textContent: '' }
const confirmButton = {
  classList: new FakeClassList(),
  dataset: { dispatchOtherDisabled: 'false' },
  attributes: new Map<string, string>(),
  setAttribute(name: string, value: string) { this.attributes.set(name, value) },
}
const fakeDialogPanel = {
  querySelector(selector: string) {
    if (selector === '[data-sewing-delivery-sla-preview-slot]') return previewSlot
    if (selector === '[data-dispatch-dialog-error]') return dialogErrorNode
    if (selector === '[data-assignment-operated-at]') return operatedAtNode
    if (selector === '[data-dispatch-action="confirm-direct-dispatch"]') return confirmButton
    return null
  },
}
class FakeInputElement {
  value = '2099-01-01T00:00'
  dataset = { dispatchField: 'dispatch.businessAssignedAt' }

  closest(selector: string): unknown {
    if (selector === '[data-dispatch-field]') return this
    if (selector === '[data-dialog-panel]') return fakeDialogPanel
    if (selector === '[data-skip-page-rerender="true"]') return this
    return null
  }
}
class FakeSelectElement {}
class FakeTextAreaElement {}
const tenderTimeErrorNode = { textContent: '', hidden: true, classList: new FakeClassList() }
const tenderOperatedAtNode = { textContent: '' }
const tenderConfirmButton = {
  classList: new FakeClassList(),
  dataset: { tenderOtherDisabled: 'false' },
  attributes: new Map<string, string>(),
  setAttribute(name: string, value: string) { this.attributes.set(name, value) },
}
const fakeTenderSheet = {
  querySelector(selector: string) {
    if (selector === '[data-tender-business-time-error]') return tenderTimeErrorNode
    if (selector === '[data-tender-assignment-operated-at]') return tenderOperatedAtNode
    if (selector === '[data-dispatch-action="confirm-create-tender"]') return tenderConfirmButton
    return null
  },
}
class FakeTenderInputElement extends FakeInputElement {
  override dataset = { dispatchField: 'tender.businessAssignedAt' }

  override closest(selector: string): unknown {
    if (selector === '[data-dispatch-field]') return this
    if (selector === '[data-tender-sheet="true"]') return fakeTenderSheet
    if (selector === '[data-skip-page-rerender="true"]') return this
    return null
  }
}
const originalInputElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLInputElement')
const originalSelectElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLSelectElement')
const originalTextAreaElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLTextAreaElement')
try {
  Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: FakeInputElement })
  Object.defineProperty(globalThis, 'HTMLSelectElement', { configurable: true, value: FakeSelectElement })
  Object.defineProperty(globalThis, 'HTMLTextAreaElement', { configurable: true, value: FakeTextAreaElement })
  openDispatchDialog(['TASKGEN-202603-084-003__ORDER'])
  const handled = handleDispatchBoardEvent(new FakeInputElement() as unknown as HTMLElement)
  assert.equal(handled, true, '业务分配时间 change 应由派单事件层处理')
  assert.notEqual(previewSlot.innerHTML, '未局部更新', 'change 后应局部更新节点预览')
  assert.equal(dialogErrorNode.textContent, '业务分配时间不能晚于当前操作时间', 'change 后应局部显示未来时间错误')
  assert.equal(confirmButton.attributes.get('aria-disabled'), 'true', '未来时间应局部禁用确认按钮')
  state.createTenderForm.businessAssignedAt = '2099-01-01T00:00'
  const tenderHandled = handleDispatchBoardEvent(new FakeTenderInputElement() as unknown as HTMLElement)
  assert.equal(tenderHandled, true, '竞价业务分配时间 change 应由派单事件层处理')
  assert.equal(tenderTimeErrorNode.textContent, '业务分配时间不能晚于当前操作时间', '竞价未来时间应局部显示错误')
  assert.notEqual(tenderOperatedAtNode.textContent, '', '竞价局部反馈应刷新实际操作时间')
  assert.equal(tenderConfirmButton.attributes.get('aria-disabled'), 'true', '竞价未来时间应局部禁用确认按钮')
} finally {
  if (originalInputElement) Object.defineProperty(globalThis, 'HTMLInputElement', originalInputElement)
  else Reflect.deleteProperty(globalThis, 'HTMLInputElement')
  if (originalSelectElement) Object.defineProperty(globalThis, 'HTMLSelectElement', originalSelectElement)
  else Reflect.deleteProperty(globalThis, 'HTMLSelectElement')
  if (originalTextAreaElement) Object.defineProperty(globalThis, 'HTMLTextAreaElement', originalTextAreaElement)
  else Reflect.deleteProperty(globalThis, 'HTMLTextAreaElement')
}

const redispatchRuntimeState = captureRuntimeDirectDispatchState()
const redispatchSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  const redispatchTaskId = 'TASKGEN-202603-086-002__ORDER'
  const redispatchTask = getRuntimeTaskById(redispatchTaskId)
  assert.ok(redispatchTask, '再次派单历史测试任务必须存在')
  clearSewingDeliverySlaSnapshotStore(redispatchTaskId)
  const redispatchInput = {
    taskId: redispatchTaskId,
    factoryId: 'ID-F003',
    factoryName: '万隆车缝厂',
    acceptDeadline: '',
    taskDeadline: '2026-07-20 18:00:00',
    remark: '再次派单历史测试',
    by: '跟单A',
    dispatchPrice: 12000,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    priceDiffReason: '',
    businessAssignedAt: '2026-07-01 08:00:00',
    operatedAt: '2026-07-01 10:00:00',
    writeBackMainFactory: false,
  } as const
  assert.throws(
    () => prepareRuntimeDirectDispatchMeta(redispatchInput, { task: redispatchTask, assignedQty: 0 }),
    /分配数量必须为正有限整数/,
    '直接派单准备必须在提交前拒绝非法范围数量',
  )
  assert.ok(applyRuntimeDirectDispatchMeta(redispatchInput))
  assert.ok(applyRuntimeDirectDispatchMeta({
    ...redispatchInput,
    factoryId: 'ID-F004',
    factoryName: '泗水车缝厂',
    businessAssignedAt: '2026-07-02 08:00:00',
    operatedAt: '2026-07-02 10:00:00',
  }))
  const redispatchHistory = listSewingDeliverySlaSnapshotHistory(redispatchTaskId)
  assert.equal(redispatchHistory.length, 2, '同一任务再次派单应保留两条履约快照')
  assert.equal(redispatchHistory[0].active, false)
  assert.equal(redispatchHistory[1].active, true)
  assert.equal(redispatchHistory[0].replacedByAssignmentId, redispatchHistory[1].assignmentId)
} finally {
  restoreRuntimeDirectDispatchState(redispatchRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(redispatchSnapshotState)
}

const legacyRuntimeState = captureRuntimeDirectDispatchState()
const legacySnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
clearSewingDeliverySlaSnapshotStore('TASK-STORE')
const storeSnapshot = createSewingDeliverySlaSnapshot({
  assignmentId: 'ASSIGN-STORE',
  runtimeTaskId: 'TASK-STORE',
  productionOrderId: 'PO-STORE',
  factoryId: 'F-STORE',
  factoryName: '万隆快照测试厂',
  assignedQty: 100,
  acceptedAt: '2026-07-01 08:00:00',
  slaKind: 'INDEPENDENT_SEWING',
})
const mutableStoreInput = {
  ...storeSnapshot,
  milestones: storeSnapshot.milestones.map((milestone) => ({ ...milestone })),
}
saveSewingDeliverySlaSnapshot(mutableStoreInput)
mutableStoreInput.milestones[0].deadlineAt = '2099-01-01 00:00:00'
const firstStoredSnapshot = getSewingDeliverySlaSnapshot('TASK-STORE')
const secondStoredSnapshot = getSewingDeliverySlaSnapshot('TASK-STORE')
assert.ok(firstStoredSnapshot, '保存后应可按运行时任务读取履约快照')
assert.ok(secondStoredSnapshot, '重复读取应持续返回履约快照')
assert.notEqual(firstStoredSnapshot, mutableStoreInput, '保存时不得保留调用方快照引用')
assert.notEqual(firstStoredSnapshot, secondStoredSnapshot, '每次读取必须返回新的防御副本')
assert.equal(firstStoredSnapshot.milestones[0].deadlineAt, '2026-07-05 08:00:00', '保存后调用方修改不得污染仓内快照')
assert.equal(Object.isFrozen(firstStoredSnapshot), true, '读取的履约快照顶层必须冻结')
assert.equal(Object.isFrozen(firstStoredSnapshot.milestones), true, '读取的履约节点数组必须冻结')
assert.equal(firstStoredSnapshot.milestones.every(Object.isFrozen), true, '读取的每个履约节点必须冻结')

const independentSewingTasks = [
  'TASKGEN-202603-0015-001__ORDER',
  'TASKGEN-202603-083-002__ORDER',
  'TASKGEN-202603-084-003__ORDER',
].map((taskId) => getRuntimeTaskById(taskId))
assert.equal(independentSewingTasks.every(Boolean), true, '固定独立车缝测试任务必须存在')

const directDispatchBase = {
  factoryId: 'ID-F003',
  factoryName: '万隆车缝厂',
  acceptDeadline: '',
  taskDeadline: '2026-07-20 18:00:00',
  remark: '含车缝直接派单时效测试',
  by: '跟单A',
  dispatchPrice: 12000,
  dispatchPriceCurrency: 'IDR',
  dispatchPriceUnit: '件',
  priceDiffReason: '',
  writeBackMainFactory: false,
} as const

const backfilledTask = independentSewingTasks[0]!
clearSewingDeliverySlaSnapshotStore(backfilledTask.taskId)
const backfilledResult = applyRuntimeDirectDispatchMeta({
  ...directDispatchBase,
  taskId: backfilledTask.taskId,
  businessAssignedAt: '2026-07-01 08:00:00',
  operatedAt: '2026-07-01 10:00:00',
  autoAccept: false,
})
assert.ok(backfilledResult, '独立车缝直接派单应成功')
assert.equal(backfilledResult.acceptanceStatus, 'ACCEPTED', '含车缝直接派单必须自动接单，不受原接单时效开关影响')
assert.equal(backfilledResult.acceptedAt, '2026-07-01 08:00:00', '含车缝接单时间应使用业务分配时间')
assert.equal(backfilledResult.acceptedBy, '系统自动接单（含车缝直接派单）', '含车缝自动接单应记录清晰中文操作方')
assert.equal(backfilledResult.businessAssignedAt, '2026-07-01 08:00:00')
assert.equal(backfilledResult.assignmentOperatedAt, '2026-07-01 10:00:00')
assert.equal(backfilledResult.taskDeadline, '2026-07-10 08:00:00', '任务截止时间应取 100% 交付节点')
const backfilledSnapshot = getSewingDeliverySlaSnapshot(backfilledTask.taskId)
assert.ok(backfilledSnapshot, '含车缝直接派单后应保存履约快照')
assert.equal(backfilledResult.deliverySlaSnapshotId, backfilledSnapshot.snapshotId)
assert.match(backfilledSnapshot.assignmentId, new RegExp(`^${backfilledTask.taskId}`), '分配编号应以运行时任务编号开头并支持历史版本')
assert.equal(backfilledSnapshot.assignedQty, backfilledTask.scopeQty, '快照数量应使用实际运行时任务范围数量')
assert.equal(backfilledSnapshot.factoryId, directDispatchBase.factoryId)
assert.equal(backfilledSnapshot.factoryName, directDispatchBase.factoryName)
assert.deepEqual(
  backfilledSnapshot.milestones.map((milestone) => milestone.deadlineAt),
  ['2026-07-05 08:00:00', '2026-07-09 08:00:00', '2026-07-10 08:00:00'],
  '回填业务分配时间后应从该时间计算 30%、70%、100% 节点',
)

const defaultedTask = independentSewingTasks[1]!
clearSewingDeliverySlaSnapshotStore(defaultedTask.taskId)
const defaultedResult = applyRuntimeDirectDispatchMeta({
  ...directDispatchBase,
  taskId: defaultedTask.taskId,
  operatedAt: '2026-07-02 10:00:00',
})
assert.ok(defaultedResult, '省略业务分配时间的独立车缝派单应成功')
assert.equal(defaultedResult.businessAssignedAt, '2026-07-02 10:00:00', '业务分配时间省略时应等于实际操作时间')
assert.equal(defaultedResult.assignmentOperatedAt, '2026-07-02 10:00:00')
assert.equal(defaultedResult.acceptedAt, '2026-07-02 10:00:00')
assert.equal(defaultedResult.taskDeadline, '2026-07-11 10:00:00')
const defaultedSnapshot = getSewingDeliverySlaSnapshot(defaultedTask.taskId)
assert.ok(defaultedSnapshot)
assert.equal(defaultedSnapshot.assignedQty, defaultedTask.scopeQty, '第二个运行时任务必须按自己的范围数量生成快照')
assert.notEqual(
  defaultedSnapshot.assignedQty,
  backfilledSnapshot.assignedQty,
  '两个不同范围数量的运行时任务不得复用同一个快照数量',
)

const futureTask = independentSewingTasks[2]!
clearSewingDeliverySlaSnapshotStore(futureTask.taskId)
const futureTaskBefore = getRuntimeTaskById(futureTask.taskId)
assert.throws(
  () => applyRuntimeDirectDispatchMeta({
    ...directDispatchBase,
    taskId: futureTask.taskId,
    businessAssignedAt: '2026-07-03 11:00:00',
    operatedAt: '2026-07-03 10:00:00',
  }),
  /业务分配时间不能晚于当前操作时间/,
  '未来业务分配时间必须在领域层阻断',
)
assert.equal(getSewingDeliverySlaSnapshot(futureTask.taskId), null, '非法时间不得留下部分快照')
assert.equal(getRuntimeTaskById(futureTask.taskId)?.assignmentStatus, futureTaskBefore?.assignmentStatus, '非法时间不得部分更新任务')

openDispatchDialog([futureTask.taskId])
state.dispatchForm.mode = 'TASK'
state.dispatchForm.factoryId = directDispatchBase.factoryId
state.dispatchForm.factoryName = directDispatchBase.factoryName
state.dispatchForm.dispatchPrice = String(futureTask.standardPrice ?? 10000)
state.dispatchForm.businessAssignedAt = '2099-01-01T00:00'
confirmDirectDispatch()
assert.equal(state.dispatchDialogError, '业务分配时间不能晚于当前操作时间', '页面应把未来业务分配时间转换为中文错误')
assert.equal(getSewingDeliverySlaSnapshot(futureTask.taskId), null, '页面阻断未来时间后也不得留下快照')

const nonSewingTasks = [
  'TASKGEN-202603-0002-006__ORDER',
  'TASKGEN-202603-0002-002__ORDER',
  'TASKGEN-202603-0002-004__ORDER',
].map((taskId) => getRuntimeTaskById(taskId))
assert.equal(nonSewingTasks.every(Boolean), true, '固定非含车缝测试任务必须存在')
const firstNonSewingTask = nonSewingTasks[0]!
const secondNonSewingTask = nonSewingTasks[1]!
const renderNonSewingTask = nonSewingTasks[2]!
const manualAcceptanceSla = {
  ruleSource: 'GLOBAL_DEFAULT' as const,
  processCode: firstNonSewingTask.processCode,
  processName: firstNonSewingTask.processNameZh,
  craftCode: '',
  craftName: '',
  acceptTimeoutHours: 12,
  enabled: true,
  autoAccept: false,
}
clearSewingDeliverySlaSnapshotStore(firstNonSewingTask.taskId)
const pendingNonSewing = applyRuntimeDirectDispatchMeta({
  ...directDispatchBase,
  taskId: firstNonSewingTask.taskId,
  businessAssignedAt: '2026-07-04 08:00:00',
  operatedAt: '2026-07-04 08:00:00',
  acceptanceSla: manualAcceptanceSla,
  autoAccept: false,
})
assert.equal(pendingNonSewing?.acceptanceStatus, 'PENDING', '非含车缝任务应保留原待接单逻辑')
assert.equal(pendingNonSewing?.acceptedAt, undefined)
assert.equal(getSewingDeliverySlaSnapshot(firstNonSewingTask.taskId), null)

clearSewingDeliverySlaSnapshotStore(secondNonSewingTask.taskId)
const autoAcceptedNonSewing = applyRuntimeDirectDispatchMeta({
  ...directDispatchBase,
  taskId: secondNonSewingTask.taskId,
  businessAssignedAt: '2026-07-04 09:00:00',
  operatedAt: '2026-07-04 09:00:00',
  acceptanceSla: { ...manualAcceptanceSla, autoAccept: true },
})
assert.equal(autoAcceptedNonSewing?.acceptanceStatus, 'ACCEPTED', '非含车缝任务应保留原 SLA 自动接单逻辑')
assert.equal(autoAcceptedNonSewing?.acceptedAt, '2026-07-04 09:00:00')

openDispatchDialog([futureTask.taskId])
const sewingDialogHtml = renderDirectDispatchDialog(
  [getRuntimeTaskById(futureTask.taskId)!],
  [{ id: directDispatchBase.factoryId, name: directDispatchBase.factoryName }],
)
assert.match(sewingDialogHtml, /业务分配时间/, '含车缝直接派单弹窗应展示业务分配时间')
assert.match(sewingDialogHtml, /实际操作时间/, '含车缝直接派单弹窗应提示实际操作时间')
assert.match(sewingDialogHtml, /30% 节点/, '含车缝直接派单弹窗应预览 30% 节点')
assert.match(sewingDialogHtml, /70% 节点/, '含车缝直接派单弹窗应预览 70% 节点')
assert.match(sewingDialogHtml, /100% 节点/, '含车缝直接派单弹窗应预览 100% 节点')
assert.doesNotMatch(
  sewingDialogHtml,
  /data-dispatch-field="dispatch\.taskDeadline"/,
  '含车缝任务截止时间应只读自动计算',
)

openDispatchDialog([renderNonSewingTask.taskId])
const nonSewingDialogHtml = renderDirectDispatchDialog(
  [getRuntimeTaskById(renderNonSewingTask.taskId)!],
  [{ id: directDispatchBase.factoryId, name: directDispatchBase.factoryName }],
)
assert.match(
  nonSewingDialogHtml,
  /data-dispatch-field="dispatch\.taskDeadline"/,
  '非含车缝直接派单应保留人工任务截止时间输入',
)
} finally {
  restoreRuntimeDirectDispatchState(legacyRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(legacySnapshotState)
}

const continuousActionTarget = (
  action: string,
  taskId?: string,
  extra: Record<string, string> = {},
) => ({
  closest(selector: string) {
    if (selector === '[data-continuous-dispatch-action]') {
      return { dataset: { continuousDispatchAction: action, taskId, ...extra } }
    }
    return null
  },
}) as unknown as HTMLElement
const continuousFieldTarget = (field: string, value: string) => ({
  closest(selector: string) {
    if (selector === '[data-continuous-dispatch-field]') {
      return { dataset: { continuousDispatchField: field }, value }
    }
    return null
  },
}) as unknown as HTMLElement

const continuousTask = getRuntimeTaskById('TASKGEN-202603-082-002__ORDER')
assert.ok(continuousTask, '连续工序分配真实 handler 测试任务必须存在')
assert.equal(continuousTask.taskUnitType, 'COMBINED_PROCESS_TASK')
const continuousFactory = listBusinessFactoryMasterRecords({ includeTestFactories: false }).find((factory) =>
  factory.processAbilities.some((ability) => ability.processCode === 'SEW'),
)
assert.ok(continuousFactory, '连续工序分配真实 handler 测试必须有可用车缝工厂')

const continuousDirectRuntimeState = captureRuntimeDirectDispatchState()
const continuousDirectSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  handleContinuousDispatchEvent(continuousActionTarget('open-direct', continuousTask.taskId))
  assert.equal(isContinuousDispatchDialogOpen(), true, '直接派单必须真实打开轻量弹窗')
  let html = renderContinuousDispatchPage()
  assert.match(html, /业务分配时间/, '直接派单弹窗必须展示业务分配时间')
  assert.match(html, /分配数量/, '直接派单弹窗必须展示整任务数量')
  assert.match(html, /30% 节点[\s\S]*70% 节点[\s\S]*100% 节点/, '直接派单弹窗必须展示三个节点预览')
  assert.match(html, /当前主工厂/, '含车缝连续任务必须展示当前主工厂')
  handleContinuousDispatchEvent(continuousActionTarget('switch-dialog-mode', undefined, { mode: 'BIDDING' }))
  assert.match(renderContinuousDispatchPage(), /工厂确认接单后启动时效/, '分配方式切换必须在同一弹窗内局部更新')
  handleContinuousDispatchEvent(continuousActionTarget('switch-dialog-mode', undefined, { mode: 'DIRECT' }))
  assert.match(renderContinuousDispatchPage(), /当前主工厂/, '分配方式应可从竞价切回直接派单')

  handleContinuousDispatchEvent(continuousFieldTarget('factoryId', continuousFactory.id))
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2026-07-09T09:00'))
  handleContinuousDispatchEvent(continuousFieldTarget('mainFactoryChoice', 'SELECTED'))
  html = renderContinuousDispatchPage()
  assert.match(html, /2026-07-09T09:00/, '字段 change handler 必须保留用户回填值')
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))

  const assignedContinuousTask = getRuntimeTaskById(continuousTask.taskId)
  assert.equal(assignedContinuousTask?.assignmentMode, 'DIRECT', '直接派单必须写入统一运行时任务仓')
  assert.equal(assignedContinuousTask?.assignedFactoryId, continuousFactory.id)
  assert.equal(assignedContinuousTask?.scopeQty, continuousTask.scopeQty, '连续工序任务必须以 scopeQty 一次分配')
  assert.equal(assignedContinuousTask?.acceptanceStatus, 'ACCEPTED', '含车缝连续任务直接派单必须自动接单')
  assert.equal(assignedContinuousTask?.acceptedAt, '2026-07-09 09:00:00', '含车缝连续任务应以业务分配时间作为自动接单时间')
  assert.equal(
    listRuntimeProcessTasks().filter((task) => task.baseTaskId === continuousTask.baseTaskId && task.isSplitResult).length,
    0,
    '连续工序任务直接派单不得产生明细拆分结果',
  )
  const assignedOrder = productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId)
  assert.equal(assignedOrder?.mainFactoryId, continuousFactory.id, '选择承接工厂为主工厂后必须保持唯一主工厂')
} finally {
  restoreRuntimeDirectDispatchState(continuousDirectRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(continuousDirectSnapshotState)
}

const continuousBiddingRuntimeState = captureRuntimeDirectDispatchState()
const continuousBiddingSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  const orderBefore = productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId)
  const mainFactoryBefore = orderBefore?.mainFactoryId
  handleContinuousDispatchEvent(continuousActionTarget('open-bidding', continuousTask.taskId))
  assert.match(renderContinuousDispatchPage(), /工厂确认接单后启动时效/, '竞价弹窗必须说明 SLA 启动点')
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2026-07-09T10:00'))
  handleContinuousDispatchEvent(continuousFieldTarget('biddingDeadline', '2026-07-11T10:00'))
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))
  const biddingContinuousTask = getRuntimeTaskById(continuousTask.taskId)
  assert.equal(biddingContinuousTask?.assignmentMode, 'BIDDING', '发起竞价必须写入统一运行时任务仓')
  assert.equal(biddingContinuousTask?.assignmentStatus, 'BIDDING')
  assert.equal(biddingContinuousTask?.assignedFactoryId, undefined, '发起竞价时不得写入承接工厂')
  assert.equal(getSewingDeliverySlaSnapshot(continuousTask.taskId), null, '发起竞价时不得生成 SLA 快照')
  assert.equal(
    productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId)?.mainFactoryId,
    mainFactoryBefore,
    '发起竞价时不得改写主工厂',
  )
} finally {
  restoreRuntimeDirectDispatchState(continuousBiddingRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(continuousBiddingSnapshotState)
}

const continuousFutureRuntimeState = captureRuntimeDirectDispatchState()
const continuousFutureSnapshotState = captureSewingDeliverySlaSnapshotStore()
try {
  const before = getRuntimeTaskById(continuousTask.taskId)
  handleContinuousDispatchEvent(continuousActionTarget('open-direct', continuousTask.taskId))
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2026-07-09T11:00'))
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))
  assert.match(renderContinuousDispatchPage(), /请选择承接工厂/, '未选工厂必须在弹窗内阻断')
  assert.equal(getRuntimeTaskById(continuousTask.taskId)?.assignmentStatus, before?.assignmentStatus, '未选工厂不得部分更新任务')

  handleContinuousDispatchEvent(continuousActionTarget('open-bidding', continuousTask.taskId))
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2026-07-09T11:00'))
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))
  assert.match(renderContinuousDispatchPage(), /请填写竞价截止时间/, '未填竞价截止时间必须在弹窗内阻断')
  assert.equal(getRuntimeTaskById(continuousTask.taskId)?.assignmentStatus, before?.assignmentStatus, '未填竞价截止时间不得部分更新任务')

  handleContinuousDispatchEvent(continuousActionTarget('open-direct', continuousTask.taskId))
  handleContinuousDispatchEvent(continuousFieldTarget('factoryId', continuousFactory.id))
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2099-01-01T00:00'))
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))
  assert.match(renderContinuousDispatchPage(), /业务分配时间不能晚于当前操作时间/, '未来业务时间必须在弹窗内阻断')
  const after = getRuntimeTaskById(continuousTask.taskId)
  assert.equal(after?.assignmentStatus, before?.assignmentStatus, '未来业务时间失败不得部分更新任务')
  assert.equal(after?.assignedFactoryId, before?.assignedFactoryId, '未来业务时间失败不得部分写入工厂')
} finally {
  restoreRuntimeDirectDispatchState(continuousFutureRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(continuousFutureSnapshotState)
}

const dispatchDomainSource = readFileSync(new URL('../src/pages/dispatch-board/dispatch-domain.ts', import.meta.url), 'utf8')
const continuousDispatchSource = readFileSync(new URL('../src/pages/continuous-dispatch.ts', import.meta.url), 'utf8')
assert.match(continuousDispatchSource, /data-skip-page-rerender="true"[^>]*data-continuous-dispatch-action="open-direct"/, '打开直接派单弹窗不得触发整页重绘')
assert.match(continuousDispatchSource, /data-skip-page-rerender="true"[^>]*data-continuous-dispatch-action="open-bidding"/, '打开竞价弹窗不得触发整页重绘')
assert.match(continuousDispatchSource, /data-skip-page-rerender="true"[^>]*data-continuous-dispatch-action="switch-dialog-mode"/, '分配方式切换不得触发整页重绘')
assert.match(continuousDispatchSource, /data-skip-page-rerender="true"[^>]*data-continuous-dispatch-field="businessAssignedAt"/, '业务分配时间 change 不得触发整页重绘')
assert.match(continuousDispatchSource, /host\.innerHTML = renderDispatchDialog\(\)/, '弹窗交互必须只更新弹窗 host')
assert.doesNotMatch(continuousDispatchSource, /root\.innerHTML/, '连续工序分配弹窗不得直接整页重绘')
assert.match(dispatchDomainSource, /data-dispatch-field="dispatch\.businessAssignedAt"/, '页面源码应接入业务分配时间字段')
assert.match(dispatchDomainSource, /data-skip-page-rerender="true"/, '业务分配时间输入时不得触发整页重绘')
const dispatchEventSource = readFileSync(new URL('../src/pages/dispatch-board/events.ts', import.meta.url), 'utf8')
assert.match(dispatchEventSource, /dispatch\.businessAssignedAt/, '事件层应接收业务分配时间变更')
const tenderDomainSource = readFileSync(new URL('../src/pages/dispatch-board/tender-domain.ts', import.meta.url), 'utf8')
assert.match(tenderDomainSource, /tender\.businessAssignedAt/, '创建竞价页应接入业务分配时间')
assert.match(tenderDomainSource, /data-dispatch-field="tender\.businessAssignedAt"[^>]*data-skip-page-rerender="true"/, '竞价业务分配时间输入不得触发整页重绘')
assert.match(dispatchEventSource, /refreshTenderBusinessAssignedAtFeedback\(fieldNode\)/, '竞价业务时间变更应走局部反馈')
assert.match(tenderDomainSource, /实际操作时间/, '创建竞价页应提示实际操作时间')
assert.doesNotMatch(tenderDomainSource, /data-dispatch-field="tender\.mainFactoryId"/, '创建含车缝竞价不得预选主工厂')
assert.doesNotMatch(tenderDomainSource, /创建招标单时必须从工厂池中指定生产单主工厂/, '创建竞价不得保留预选主工厂校验')
const dispatchTendersSource = readFileSync(new URL('../src/pages/dispatch-tenders.ts', import.meta.url), 'utf8')
assert.match(dispatchTendersSource, /awardRuntimeTaskTender/, '竞价列表定标必须写入统一运行时任务仓')
assert.match(dispatchTendersSource, /captureRuntimeDirectDispatchState/, '多任务定标必须捕获运行时状态以支持回滚')
const pdaTaskReceiveSource = readFileSync(new URL('../src/pages/pda-task-receive.ts', import.meta.url), 'utf8')
const pdaTaskReceiveDetailSource = readFileSync(new URL('../src/pages/pda-task-receive-detail.ts', import.meta.url), 'utf8')
assert.match(pdaTaskReceiveSource, /return acceptRuntimeTaskAssignment\(taskId, \{ factoryId, acceptedAt, acceptedBy: by \}\)/, 'PDA 共享接单入口必须把当前工厂 ID 和确认时间传给统一运行时函数')
assert.match(pdaTaskReceiveSource, /classifySewingDeliverySla\(task\) !== null[\s\S]*?统一运行时任务仓/, '含车缝 SLA 任务不得误走旧 Mock 回退')
assert.match(pdaTaskReceiveDetailSource, /acceptPdaTaskWithRuntimeFallback\(taskId, factoryId, factoryName\)/, 'PDA 详情应复用共享接单入口')
for (const [sourceName, source] of [['PDA 接单列表', pdaTaskReceiveSource], ['PDA 接单详情', pdaTaskReceiveDetailSource]] as const) {
  assert.match(source, /getCurrentFactoryId\(\)/, `${sourceName}必须从当前登录身份读取工厂 ID`)
  assert.match(source, /确认接单/, `${sourceName}应向待确认的中标任务展示“确认接单”`)
  assert.doesNotMatch(source, /无需二次确认/, `${sourceName}不得再宣称中标任务无需二次确认`)
}
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
assert.match(
  mainSource,
  /function shouldSkipChangeRerender[\s\S]*?data-skip-page-rerender="true"/,
  '全局 change 路径必须尊重局部更新控件的跳过整页重绘标记',
)

console.log('含车缝任务交付与回货时效规则检查通过')
