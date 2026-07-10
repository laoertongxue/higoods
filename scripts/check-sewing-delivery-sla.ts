import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  classifySewingDeliverySla,
  createSewingDeliverySlaSnapshot,
  getSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
  saveSewingDeliverySlaSnapshot,
} from '../src/data/fcs/sewing-delivery-sla.ts'
import {
  applyRuntimeDirectDispatchMeta,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  confirmDirectDispatch,
  openDispatchDialog,
  renderDirectDispatchDialog,
} from '../src/pages/dispatch-board/dispatch-domain.ts'
import { state } from '../src/pages/dispatch-board/context.ts'

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

const runtimeTasks = listRuntimeProcessTasks()
const independentSewingTasks = runtimeTasks.filter(
  (task) => classifySewingDeliverySla(task) === 'INDEPENDENT_SEWING',
)
assert.ok(independentSewingTasks.length >= 3, '运行时数据至少需要三个独立车缝任务覆盖直接派单场景')

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

const backfilledTask = independentSewingTasks[0]
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
assert.equal(backfilledSnapshot.assignmentId, backfilledTask.taskId, '首期快照可稳定使用任务编号作为分配编号')
assert.equal(backfilledSnapshot.assignedQty, backfilledTask.scopeQty, '快照数量应使用实际运行时任务范围数量')
assert.equal(backfilledSnapshot.factoryId, directDispatchBase.factoryId)
assert.equal(backfilledSnapshot.factoryName, directDispatchBase.factoryName)
assert.deepEqual(
  backfilledSnapshot.milestones.map((milestone) => milestone.deadlineAt),
  ['2026-07-05 08:00:00', '2026-07-09 08:00:00', '2026-07-10 08:00:00'],
  '回填业务分配时间后应从该时间计算 30%、70%、100% 节点',
)

const defaultedTask = independentSewingTasks[1]
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

const futureTask = independentSewingTasks[2]
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

const nonSewingTasks = runtimeTasks.filter(
  (task) => classifySewingDeliverySla(task) === null && !task.assignedFactoryId,
)
assert.ok(nonSewingTasks.length >= 3, '运行时数据至少需要三个非含车缝任务覆盖原接单逻辑与页面')
const manualAcceptanceSla = {
  ruleSource: 'GLOBAL_DEFAULT' as const,
  processCode: nonSewingTasks[0].processCode,
  processName: nonSewingTasks[0].processNameZh,
  craftCode: '',
  craftName: '',
  acceptTimeoutHours: 12,
  enabled: true,
  autoAccept: false,
}
const pendingNonSewing = applyRuntimeDirectDispatchMeta({
  ...directDispatchBase,
  taskId: nonSewingTasks[0].taskId,
  businessAssignedAt: '2026-07-04 08:00:00',
  operatedAt: '2026-07-04 08:00:00',
  acceptanceSla: manualAcceptanceSla,
  autoAccept: false,
})
assert.equal(pendingNonSewing?.acceptanceStatus, 'PENDING', '非含车缝任务应保留原待接单逻辑')
assert.equal(pendingNonSewing?.acceptedAt, undefined)
assert.equal(getSewingDeliverySlaSnapshot(nonSewingTasks[0].taskId), null)

const autoAcceptedNonSewing = applyRuntimeDirectDispatchMeta({
  ...directDispatchBase,
  taskId: nonSewingTasks[1].taskId,
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

openDispatchDialog([nonSewingTasks[2].taskId])
const nonSewingDialogHtml = renderDirectDispatchDialog(
  [getRuntimeTaskById(nonSewingTasks[2].taskId)!],
  [{ id: directDispatchBase.factoryId, name: directDispatchBase.factoryName }],
)
assert.match(
  nonSewingDialogHtml,
  /data-dispatch-field="dispatch\.taskDeadline"/,
  '非含车缝直接派单应保留人工任务截止时间输入',
)

const dispatchDomainSource = readFileSync(new URL('../src/pages/dispatch-board/dispatch-domain.ts', import.meta.url), 'utf8')
assert.match(dispatchDomainSource, /data-dispatch-field="dispatch\.businessAssignedAt"/, '页面源码应接入业务分配时间字段')
assert.match(dispatchDomainSource, /data-skip-page-rerender="true"/, '业务分配时间输入时不得触发整页重绘')
const dispatchEventSource = readFileSync(new URL('../src/pages/dispatch-board/events.ts', import.meta.url), 'utf8')
assert.match(dispatchEventSource, /dispatch\.businessAssignedAt/, '事件层应接收业务分配时间变更')

console.log('含车缝任务交付与回货时效规则检查通过')
