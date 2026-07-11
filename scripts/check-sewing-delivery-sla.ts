import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import * as sewingDeliverySlaDomain from '../src/data/fcs/sewing-delivery-sla.ts'
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
  upsertRuntimeTaskTender,
} from '../src/data/fcs/runtime-process-tasks.ts'
import { reassignRuntimeSewingTask } from '../src/data/fcs/runtime-sewing-reassignment.ts'
import { sumSewingDeliveryConfirmedReceiptQty } from '../src/data/fcs/sewing-delivery-receipt-facts.ts'
import { listSewingFactoryOptions } from '../src/data/fcs/sewing-dispatch-workbench.ts'
import { installRuntimeTaskReadResolver, readRuntimeTaskById } from '../src/data/fcs/runtime-task-read-bridge.ts'
import { parseFcsQrValue } from '../src/data/fcs/task-qr.ts'
import {
  confirmDirectDispatch,
  openDispatchDialog,
  renderDirectDispatchDialog,
} from '../src/pages/dispatch-board/dispatch-domain.ts'
import { state } from '../src/pages/dispatch-board/context.ts'
import { handleDispatchBoardEvent } from '../src/pages/dispatch-board/events.ts'
import {
  captureContinuousDispatchPageState,
  closeContinuousDispatchDialog,
  handleContinuousDispatchEvent,
  isContinuousDispatchDialogOpen,
  renderContinuousDispatchPage,
  restoreContinuousDispatchPageState,
} from '../src/pages/continuous-dispatch.ts'
import {
  captureSewingDispatchWorkbenchPageState,
  handleSewingDispatchWorkbenchEvent,
  renderSewingDispatchWorkbenchPage,
  restoreSewingDispatchWorkbenchPageState,
} from '../src/pages/sewing-dispatch-workbench.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { productionOrders, listProductionOrderSewingFactories, registerProductionOrderSewingFactory, selectProductionOrderMainFactory, withdrawProductionOrderSewingFactory } from '../src/data/fcs/production-orders.ts'
import {
  getSewingDeliverySlaView,
  listSewingDeliverySlaViews,
} from '../src/data/fcs/sewing-delivery-sla-view.ts'
import {
  capturePdaHandoverState,
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
  restorePdaHandoverState,
  upsertPdaHandoverHeadMock,
  upsertPdaHandoutRecordMock,
  writeBackHandoverRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
} from '../src/data/fcs/pda-handover-events.ts'
import { getProgressFactByTaskId } from '../src/data/fcs/store-domain-progress.ts'

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

// Task9 业务验收矩阵：用具名场景把产品口径和底层边界集中呈现，避免验收只依赖零散回归断言。
const businessAcceptanceMatrix = [
  {
    name: '独立车缝｜30%、70%、100% 三节点均按时',
    slaKind: 'INDEPENDENT_SEWING' as const,
    assignedQty: 100,
    receipts: [
      { recordId: 'MATRIX-INDEPENDENT-30', submittedQty: 30, submittedAt: '2026-07-05 08:30:00', receivedQty: 30, receivedAt: '2026-07-05 09:00:00' },
      { recordId: 'MATRIX-INDEPENDENT-70', submittedQty: 40, submittedAt: '2026-07-09 08:30:00', receivedQty: 40, receivedAt: '2026-07-09 09:00:00' },
      { recordId: 'MATRIX-INDEPENDENT-100', submittedQty: 30, submittedAt: '2026-07-10 08:30:00', receivedQty: 30, receivedAt: '2026-07-10 09:00:00' },
    ],
    now: '2026-07-10 09:00:00',
    expectedResults: ['ON_TIME', 'ON_TIME', 'ON_TIME'],
    expectedConfirmedQty: 100,
    expectedCompleted: true,
  },
  {
    name: '车缝到包装｜30%逾期、70%追上、最终按时',
    slaKind: 'SEWING_TO_PACKAGING' as const,
    assignedQty: 100,
    receipts: [
      { recordId: 'MATRIX-SEW-PACK-30', submittedQty: 30, submittedAt: '2026-07-06 10:30:00', receivedQty: 30, receivedAt: '2026-07-06 11:00:00' },
      { recordId: 'MATRIX-SEW-PACK-70', submittedQty: 40, submittedAt: '2026-07-09 08:30:00', receivedQty: 40, receivedAt: '2026-07-09 09:00:00' },
      { recordId: 'MATRIX-SEW-PACK-100', submittedQty: 30, submittedAt: '2026-07-10 08:30:00', receivedQty: 30, receivedAt: '2026-07-10 09:00:00' },
    ],
    now: '2026-07-10 09:00:00',
    expectedResults: ['OVERDUE_REACHED', 'ON_TIME', 'ON_TIME'],
    expectedConfirmedQty: 100,
    expectedCompleted: true,
  },
  {
    name: '裁片到包装｜30%按时、70%逾期、最终逾期完成',
    slaKind: 'CUTTING_TO_PACKAGING' as const,
    assignedQty: 100,
    receipts: [
      { recordId: 'MATRIX-CUT-PACK-30', submittedQty: 30, submittedAt: '2026-07-07 08:30:00', receivedQty: 30, receivedAt: '2026-07-07 09:00:00' },
      { recordId: 'MATRIX-CUT-PACK-70', submittedQty: 40, submittedAt: '2026-07-10 10:30:00', receivedQty: 40, receivedAt: '2026-07-10 11:00:00' },
      { recordId: 'MATRIX-CUT-PACK-100', submittedQty: 30, submittedAt: '2026-07-13 10:30:00', receivedQty: 30, receivedAt: '2026-07-13 11:00:00' },
    ],
    now: '2026-07-13 11:00:00',
    expectedResults: ['ON_TIME', 'OVERDUE_REACHED', 'OVERDUE_REACHED'],
    expectedConfirmedQty: 100,
    expectedCompleted: true,
  },
  {
    name: '独立车缝｜最终截止后仍未完成',
    slaKind: 'INDEPENDENT_SEWING' as const,
    assignedQty: 100,
    receipts: [
      { recordId: 'MATRIX-INCOMPLETE-30', submittedQty: 30, submittedAt: '2026-07-05 08:30:00', receivedQty: 30, receivedAt: '2026-07-05 09:00:00' },
      { recordId: 'MATRIX-INCOMPLETE-70', submittedQty: 40, submittedAt: '2026-07-09 08:30:00', receivedQty: 40, receivedAt: '2026-07-09 09:00:00' },
      { recordId: 'MATRIX-INCOMPLETE-99', submittedQty: 29, submittedAt: '2026-07-10 08:30:00', receivedQty: 29, receivedAt: '2026-07-10 09:00:00' },
    ],
    now: '2026-07-10 11:00:00',
    expectedResults: ['ON_TIME', 'ON_TIME', 'OVERDUE_PENDING'],
    expectedConfirmedQty: 99,
    expectedCompleted: false,
  },
  {
    name: '独立车缝｜截止前交出、截止后确认形成接收延迟',
    slaKind: 'INDEPENDENT_SEWING' as const,
    assignedQty: 100,
    receipts: [
      { recordId: 'MATRIX-RECEIVER-DELAY', submittedQty: 30, submittedAt: '2026-07-05 09:00:00', receivedQty: 30, receivedAt: '2026-07-05 11:00:00' },
    ],
    now: '2026-07-05 11:00:00',
    expectedResults: ['OVERDUE_REACHED', 'UPCOMING', 'UPCOMING'],
    expectedConfirmedQty: 30,
    expectedCompleted: false,
    expectedReceiverDelayRecordIds: ['MATRIX-RECEIVER-DELAY'],
  },
  {
    name: '独立车缝｜超量实收正常完成且比例超过100%',
    slaKind: 'INDEPENDENT_SEWING' as const,
    assignedQty: 100,
    receipts: [
      { recordId: 'MATRIX-OVER-RECEIVED', submittedQty: 120, submittedAt: '2026-07-02 08:30:00', receivedQty: 120, receivedAt: '2026-07-02 09:00:00' },
    ],
    now: '2026-07-02 09:00:00',
    expectedResults: ['ON_TIME', 'ON_TIME', 'ON_TIME'],
    expectedConfirmedQty: 120,
    expectedCompleted: true,
    expectedProgressRatio: 1.2,
  },
]

for (const scenario of businessAcceptanceMatrix) {
  const scenarioSnapshot = createSewingDeliverySlaSnapshot({
    assignmentId: `MATRIX-${scenario.slaKind}-${scenario.assignedQty}-${scenario.name}`,
    runtimeTaskId: `TASK-${scenario.name}`,
    productionOrderId: 'PO-MATRIX',
    factoryId: 'F-MATRIX',
    factoryName: '验收矩阵工厂',
    assignedQty: scenario.assignedQty,
    acceptedAt: '2026-07-01 10:00:00',
    slaKind: scenario.slaKind,
  })
  const scenarioProjection = projectSewingDeliverySla(scenarioSnapshot, scenario.receipts, scenario.now)
  assert.deepEqual(
    scenarioProjection.milestones.map((milestone) => milestone.result),
    scenario.expectedResults,
    `${scenario.name}：节点结论不符`,
  )
  assert.equal(scenarioProjection.confirmedReceivedQty, scenario.expectedConfirmedQty, `${scenario.name}：累计实收不符`)
  assert.equal(scenarioProjection.completed, scenario.expectedCompleted, `${scenario.name}：完成结论不符`)
  if (scenario.expectedReceiverDelayRecordIds) {
    assert.deepEqual(scenarioProjection.milestones[0]?.receiverDelayRecordIds, scenario.expectedReceiverDelayRecordIds, `${scenario.name}：接收延迟归因不符`)
  }
  if (scenario.expectedProgressRatio !== undefined) {
    assert.equal(scenarioProjection.progressRatio, scenario.expectedProgressRatio, `${scenario.name}：超收比例不得封顶`)
  }
}

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
assert.deepEqual(
  projection.milestones[0]?.receiverDelayRecords,
  [{ recordId: 'R1', submittedAt: '2026-07-05 14:00:00', receivedAt: '2026-07-05 16:00:00', affectedQty: 31, delayHours: 0.5 }],
  '接收延迟归因必须携带管理端复核所需的交出、确认、数量和延迟时长明细',
)
const sameBatchGapProjection = projectSewingDeliverySla(
  createSewingDeliverySlaSnapshot({ assignmentId: 'ASSIGN-GAP', runtimeTaskId: 'TASK-GAP', productionOrderId: 'PO-GAP', factoryId: 'F-GAP', factoryName: '缺口分摊测试厂', assignedQty: 100, acceptedAt: '2026-07-01 10:00:00', slaKind: 'INDEPENDENT_SEWING' }),
  [
    { recordId: 'GAP-BASE', submittedQty: 20, submittedAt: '2026-07-02 09:00:00', receivedQty: 20, receivedAt: '2026-07-02 10:00:00' },
    { recordId: 'GAP-A', submittedQty: 6, submittedAt: '2026-07-05 09:00:00', receivedQty: 6, receivedAt: '2026-07-05 11:00:00' },
    { recordId: 'GAP-B', submittedQty: 100, submittedAt: '2026-07-05 09:30:00', receivedQty: 100, receivedAt: '2026-07-05 11:00:00' },
  ],
  '2026-07-05 11:00:00',
)
assert.deepEqual(
  sameBatchGapProjection.milestones[0]?.receiverDelayRecords.map((record) => [record.recordId, record.affectedQty]),
  [['GAP-A', 6], ['GAP-B', 4]],
  '同一迟确认批次的受影响数量必须按节点剩余缺口确定性分摊',
)
assert.equal(
  sameBatchGapProjection.milestones[0]?.receiverDelayRecords.reduce((sum, record) => sum + record.affectedQty, 0),
  10,
  '同一批次受影响数量合计不得超过迟确认前节点缺口',
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
assert.equal(
  projection.milestones.every((milestone) => Object.isFrozen(milestone.receiverDelayRecords) && milestone.receiverDelayRecords.every(Object.isFrozen)),
  true,
  '接收延迟归因明细数组及每条记录必须冻结',
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

const continuousInputPageState = captureContinuousDispatchPageState()
const originalDocument = globalThis.document
let continuousDialogHostWrites = 0
const continuousDialogHost = {
  set innerHTML(_value: string) {
    continuousDialogHostWrites += 1
  },
}
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector(selector: string) {
      return selector === '[data-continuous-dispatch-dialog-host]' ? continuousDialogHost : null
    },
  },
})
try {
  handleContinuousDispatchEvent(continuousActionTarget('open-direct', continuousTask.taskId), { type: 'click' } as Event)
  const writesAfterOpen = continuousDialogHostWrites
  const stateAfterOpen = captureContinuousDispatchPageState()
  const nativeClickHandled = handleContinuousDispatchEvent(
    continuousFieldTarget('mainFactoryChoice', 'SELECTED'),
    { type: 'click' } as Event,
  )
  assert.equal(nativeClickHandled, false, '弹窗单选框 click 必须交还浏览器原生激活，不得触发 preventDefault')
  assert.equal(continuousDialogHostWrites, writesAfterOpen, '弹窗字段 click 不得替换弹窗 host')
  assert.equal(
    captureContinuousDispatchPageState().dialog?.mainFactoryChoice,
    stateAfterOpen.dialog?.mainFactoryChoice,
    '弹窗字段 click 阶段不得提前写入状态',
  )
  handleContinuousDispatchEvent(
    continuousFieldTarget('businessAssignedAt', '2026-07-09T08:30'),
    { type: 'input' } as Event,
  )
  assert.equal(continuousDialogHostWrites, writesAfterOpen, 'datetime-local input 阶段不得替换弹窗 host 或导致焦点丢失')
  assert.equal(
    captureContinuousDispatchPageState().dialog?.businessAssignedAt,
    stateAfterOpen.dialog?.businessAssignedAt,
    'datetime-local input 阶段不得提前更新预览状态',
  )
  handleContinuousDispatchEvent(
    continuousFieldTarget('businessAssignedAt', '2026-07-09T08:30'),
    { type: 'change' } as Event,
  )
  assert.equal(continuousDialogHostWrites, writesAfterOpen + 1, 'datetime-local change 应局部更新弹窗预览')
  assert.equal(
    captureContinuousDispatchPageState().dialog?.businessAssignedAt,
    '2026-07-09T08:30',
    'datetime-local change 应写入业务分配时间状态',
  )
  closeContinuousDispatchDialog()
  assert.equal(isContinuousDispatchDialogOpen(), false, '页内应提供显式关闭弹窗的测试隔离入口')
} finally {
  restoreContinuousDispatchPageState(continuousInputPageState)
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  })
}

const continuousDirectRuntimeState = captureRuntimeDirectDispatchState()
const continuousDirectSnapshotState = captureSewingDeliverySlaSnapshotStore()
const continuousDirectPageState = captureContinuousDispatchPageState()
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

  const assignedContinuousRuntimeState = captureRuntimeDirectDispatchState()
  const assignedContinuousSnapshotState = captureSewingDeliverySlaSnapshotStore()
  const assignedContinuousTaskState = assignedContinuousRuntimeState.taskOverrides.find(([taskId]) => taskId === continuousTask.taskId)
  const assignedContinuousOrderState = assignedContinuousRuntimeState.productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId)
  const repeatedContinuousDirectInput = {
    taskId: continuousTask.taskId,
    factoryId: continuousFactory.id,
    factoryName: continuousFactory.name,
    acceptDeadline: '',
    taskDeadline: '2026-07-20 12:00:00',
    businessAssignedAt: '2026-07-09 12:00:00',
    operatedAt: '2026-07-10 12:00:00',
    remark: '普通入口不得将已直接派单的连续任务再次直派',
    by: '生产计划员',
    dispatchPrice: continuousTask.standardPrice ?? 0,
    dispatchPriceCurrency: continuousTask.standardPriceCurrency ?? 'IDR',
    dispatchPriceUnit: continuousTask.standardPriceUnit ?? continuousTask.qtyUnit,
    priceDiffReason: '',
  }
  assert.throws(
    () => prepareRuntimeDirectDispatchMeta(repeatedContinuousDirectInput),
    /已有有效分配结果/,
    '直接派单 prepare 必须拒绝连续任务 DIRECT 到 DIRECT 覆盖',
  )
  assert.throws(
    () => applyRuntimeDirectDispatchMeta(repeatedContinuousDirectInput),
    /已有有效分配结果/,
    '统一直接派单入口必须拒绝连续任务重复直派',
  )
  const runtimeAfterRepeatedDirect = captureRuntimeDirectDispatchState()
  assert.deepEqual(
    runtimeAfterRepeatedDirect.taskOverrides.find(([taskId]) => taskId === continuousTask.taskId),
    assignedContinuousTaskState,
    '连续任务重复直派阻断后工厂、acceptedAt 及任务状态必须不变',
  )
  assert.deepEqual(
    runtimeAfterRepeatedDirect.productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId),
    assignedContinuousOrderState,
    '连续任务重复直派阻断后生产单必须不变',
  )
  assert.deepEqual(
    captureSewingDeliverySlaSnapshotStore(),
    assignedContinuousSnapshotState,
    '连续任务重复直派阻断后 SLA 快照必须不变',
  )
} finally {
  restoreRuntimeDirectDispatchState(continuousDirectRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(continuousDirectSnapshotState)
  restoreContinuousDispatchPageState(continuousDirectPageState)
}

const continuousBiddingRuntimeState = captureRuntimeDirectDispatchState()
const continuousBiddingSnapshotState = captureSewingDeliverySlaSnapshotStore()
const continuousBiddingPageState = captureContinuousDispatchPageState()
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
  handleContinuousDispatchEvent(continuousActionTarget('switch-tab', undefined, { tab: 'OTHER' }))
  const biddingListHtml = renderContinuousDispatchPage()
  const biddingRowStart = biddingListHtml.indexOf(continuousTask.taskNo || continuousTask.taskId)
  const biddingRowEnd = biddingListHtml.indexOf('</tr>', biddingRowStart)
  const biddingRowHtml = biddingListHtml.slice(biddingRowStart, biddingRowEnd)
  assert.doesNotMatch(biddingRowHtml, />直接派单<|>发起竞价</, '已有效竞价的连续任务行不得继续展示直接派单或发起竞价')

  const awardedTenderRuntimeState = captureRuntimeDirectDispatchState()
  const awardedTenderSnapshotState = captureSewingDeliverySlaSnapshotStore()
  const awardedTenderTaskState = awardedTenderRuntimeState.taskOverrides.find(([taskId]) => taskId === continuousTask.taskId)
  const awardedTenderOrderState = awardedTenderRuntimeState.productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId)
  const blockedContinuousDirectInput = {
    taskId: continuousTask.taskId,
    factoryId: continuousFactory.id,
    factoryName: continuousFactory.name,
    acceptDeadline: '',
    taskDeadline: '2026-07-20 10:00:00',
    remark: '竞价中连续任务不得绕过页面改直接派单',
    by: '生产计划员',
    dispatchPrice: continuousTask.standardPrice ?? 0,
    dispatchPriceCurrency: continuousTask.standardPriceCurrency ?? 'IDR',
    dispatchPriceUnit: continuousTask.standardPriceUnit ?? continuousTask.qtyUnit,
    priceDiffReason: '',
    businessAssignedAt: '2026-07-09 10:00:00',
    operatedAt: '2026-07-10 10:00:00',
  }
  assert.throws(
    () => prepareRuntimeDirectDispatchMeta(blockedContinuousDirectInput),
    /已有有效分配结果/,
    '直接派单 prepare 阶段必须拒绝已有 tender 的连续任务',
  )
  assert.throws(
    () => applyRuntimeDirectDispatchMeta(blockedContinuousDirectInput),
    /已有有效分配结果/,
    '统一直接派单入口必须拒绝将竞价中连续任务改为 DIRECT',
  )
  const runtimeAfterBlockedDirect = captureRuntimeDirectDispatchState()
  assert.deepEqual(
    runtimeAfterBlockedDirect.taskOverrides.find(([taskId]) => taskId === continuousTask.taskId),
    awardedTenderTaskState,
    '统一直接派单入口阻断后任务及 tender 字段必须保持不变',
  )
  assert.deepEqual(
    runtimeAfterBlockedDirect.productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId),
    awardedTenderOrderState,
    '统一直接派单入口阻断后生产单必须保持不变',
  )
  assert.deepEqual(
    captureSewingDeliverySlaSnapshotStore(),
    awardedTenderSnapshotState,
    '统一直接派单入口阻断后 SLA 仓必须保持不变',
  )
  assert.throws(
    () => upsertRuntimeTaskTender(
      continuousTask.taskId,
      {
        tenderId: 'TENDER-REPEAT-SHOULD-BLOCK',
        biddingDeadline: '2026-07-12 10:00:00',
        taskDeadline: '2026-07-20 10:00:00',
        businessAssignedAt: '2026-07-09 10:00:00',
        assignmentOperatedAt: '2026-07-10 10:00:00',
      },
      '生产计划员',
    ),
    /已有有效分配结果/,
    '运行时入口必须拒绝覆盖连续任务已有 tender',
  )
  handleContinuousDispatchEvent(continuousActionTarget('open-bidding', continuousTask.taskId))
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2026-07-09T11:00'))
  handleContinuousDispatchEvent(continuousFieldTarget('biddingDeadline', '2026-07-12T11:00'))
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))
  const repeatedTenderRuntimeState = captureRuntimeDirectDispatchState()
  assert.deepEqual(
    repeatedTenderRuntimeState.taskOverrides.find(([taskId]) => taskId === continuousTask.taskId),
    awardedTenderTaskState,
    '已有效竞价的连续任务不得重复竞价覆盖 tender 或生产单状态',
  )
  assert.deepEqual(
    repeatedTenderRuntimeState.productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId),
    awardedTenderOrderState,
    '重复竞价阻断后生产单必须保持不变',
  )
  assert.deepEqual(
    captureSewingDeliverySlaSnapshotStore(),
    awardedTenderSnapshotState,
    '重复竞价阻断后 SLA 仓必须保持不变',
  )

  handleContinuousDispatchEvent(continuousActionTarget('open-direct', continuousTask.taskId))
  handleContinuousDispatchEvent(continuousFieldTarget('factoryId', continuousFactory.id))
  handleContinuousDispatchEvent(continuousFieldTarget('businessAssignedAt', '2026-07-09T11:00'))
  handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousTask.taskId))
  const redirectedTenderRuntimeState = captureRuntimeDirectDispatchState()
  assert.deepEqual(
    redirectedTenderRuntimeState.taskOverrides.find(([taskId]) => taskId === continuousTask.taskId),
    awardedTenderTaskState,
    '已有效竞价的连续任务不得改为直接派单并遗留 tender 字段',
  )
  assert.deepEqual(
    redirectedTenderRuntimeState.productionOrders.find((order) => order.productionOrderId === continuousTask.productionOrderId),
    awardedTenderOrderState,
    '竞价中改直接派单被阻断后生产单必须保持不变',
  )
  assert.deepEqual(
    captureSewingDeliverySlaSnapshotStore(),
    awardedTenderSnapshotState,
    '竞价中改直接派单被阻断后 SLA 仓必须保持不变',
  )
} finally {
  restoreRuntimeDirectDispatchState(continuousBiddingRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(continuousBiddingSnapshotState)
  restoreContinuousDispatchPageState(continuousBiddingPageState)
}

const continuousFutureRuntimeState = captureRuntimeDirectDispatchState()
const continuousFutureSnapshotState = captureSewingDeliverySlaSnapshotStore()
const continuousFuturePageState = captureContinuousDispatchPageState()
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
  restoreContinuousDispatchPageState(continuousFuturePageState)
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
const progressTaskPageSource = readFileSync(new URL('../src/pages/progress-board/task-domain.ts', import.meta.url), 'utf8')
const pdaExecDetailSource = readFileSync(new URL('../src/pages/pda-exec-detail.ts', import.meta.url), 'utf8')
const pdaHandoverDetailSource = readFileSync(new URL('../src/pages/pda-handover-detail.ts', import.meta.url), 'utf8')
const progressEventsSource = readFileSync(new URL('../src/pages/progress-board/events.ts', import.meta.url), 'utf8')
assert.match(progressTaskPageSource, /<th[^>]*>交付时效<\/th>/, 'FCS 任务列表必须增加交付时效列')
assert.match(progressTaskPageSource, /renderSewingDeliverySlaListCell\(sewingDeliverySlaByTaskId\.get\(task\.taskId\)/, 'FCS 列表必须读取统一履约事实')
assert.match(progressTaskPageSource, /listSewingDeliverySlaViews\([^)]*visibleTasks\.map/, 'FCS 列表只能为当前可见任务批量构建履约视图')
assert.match(progressTaskPageSource, /renderSewingDeliverySlaDetail\(getSewingDeliverySlaView\(task\.taskId\)/, 'FCS 详情必须读取同一履约事实')
assert.match(progressTaskPageSource, /主管复核责任/, 'FCS 延迟节点必须提供主管复核入口')
assert.match(progressTaskPageSource, /renderSewingDeliveryResponsibilityReviewDialog/, 'FCS 详情必须渲染责任复核局部弹窗 host')
assert.match(progressEventsSource, /openSewingDeliveryResponsibilityReview/, '主管复核入口必须接入真实打开 handler')
assert.match(progressEventsSource, /submitSewingDeliveryResponsibilityReview/, '主管复核入口必须接入真实保存 handler')
assert.match(progressEventsSource, /refreshSewingDeliveryResponsibilityReviewDialog/, '复核字段和动作必须只刷新局部弹窗')
assert.match(pdaExecDetailSource, /renderPdaSewingDeliveryProgress\(getSewingDeliverySlaView\(task\.taskId\)/, 'PDA 执行详情必须读取同一履约事实')
for (const term of ['快照ID', '规则码', '完整责任日志']) {
  assert.doesNotMatch(pdaExecDetailSource, new RegExp(term), `PDA 执行详情不得出现管理术语：${term}`)
}
assert.match(pdaHandoverDetailSource, /data-sewing-sla-writeback-preview/, '接收数量输入区域必须预留履约预览局部刷新 host')
assert.match(pdaHandoverDetailSource, /data-skip-page-rerender="true"[^>]*data-pda-handoverd-field="writebackQty"/, '实收数量输入不得触发整页重绘')
assert.match(pdaHandoverDetailSource, /refreshReceiverWritebackSlaPreview\(record\.recordId\)/, '实收数量输入必须局部刷新履约预览')
assert.match(pdaHandoverDetailSource, /refreshHandoutRecordAndSlaSummary\(updated\)/, '确认收货后必须只刷新当前记录和履约摘要')
assert.match(pdaHandoverDetailSource, /writebackPreviewConfirmedAt/, '接收确认草稿必须固定预览确认时间')
assert.match(pdaHandoverDetailSource, /预估确认时间/, '输入预览必须明确标注为预估确认时间')
assert.match(pdaHandoverDetailSource, /提交时按实际时间重新计算/, '输入预览必须提示提交时会按实际时间重新计算')
assert.doesNotMatch(pdaHandoverDetailSource, /本次确认时间：/, '输入预览不得把预估时间误写成实际确认时间')
assert.match(pdaHandoverDetailSource, /const confirmedAt = receiverWritebackNowProvider\(\)/, '点击确认时必须重新获取实际本地墙钟')
assert.match(pdaHandoverDetailSource, /receiverWrittenAt:\s*confirmedAt/, '真实确认必须使用点击时的同一实际确认时间')

assert.doesNotThrow(() => {
  execFileSync('./node_modules/.bin/tsx', ['-e', `
    import assert from 'node:assert/strict'
    import { renderSewingDeliverySlaListCell, renderSewingDeliverySlaDetail } from './src/pages/progress-board/task-domain.ts'
    import { renderPdaSewingDeliveryProgress } from './src/pages/pda-exec-detail.ts'
    const milestones = [
      { ratio: 0.3, hoursAfterAcceptance: 96, targetQty: 30, deadlineAt: '2026-07-05 10:00:00', firstReachedAt: '2026-07-05 12:00:00', result: 'OVERDUE_REACHED', receiverDelayRecordIds: ['R1', 'R2'], receiverDelayRecords: [{ recordId: 'R1', submittedAt: '2026-07-05 09:00:00', receivedAt: '2026-07-05 12:00:00', affectedQty: 20, delayHours: 2 }, { recordId: 'R2', submittedAt: '2026-07-05 09:30:00', receivedAt: '2026-07-05 12:00:00', affectedQty: 10, delayHours: 2 }] },
      { ratio: 0.7, hoursAfterAcceptance: 192, targetQty: 70, deadlineAt: '2026-07-09 10:00:00', firstReachedAt: '2026-07-08 09:00:00', result: 'ON_TIME', receiverDelayRecordIds: [], receiverDelayRecords: [] },
      { ratio: 1, hoursAfterAcceptance: 216, targetQty: 100, deadlineAt: '2026-07-10 10:00:00', firstReachedAt: '2026-07-08 10:00:00', result: 'ON_TIME', receiverDelayRecordIds: [], receiverDelayRecords: [] },
    ]
    const view = { runtimeTaskId: 'T1', submittedQty: 140, confirmedReceivedQty: 130, projection: { snapshot: { assignedQty: 100 }, progressRatio: 1.3, remainingQty: 0, completed: true, milestones } }
    const list = renderSewingDeliverySlaListCell(view as any, '件')
    assert.match(list, /130\\s*\\/\\s*100\\s*件/)
    assert.match(list, /130%/)
    const detail = renderSewingDeliverySlaDetail(view as any, '件')
    for (const text of ['累计交出', '累计已确认实收', '30% 节点', '受影响记录 2 条', 'R1', '2026-07-05 09:00:00', '2026-07-05 12:00:00', '20 件', '延迟 2 小时', '主管复核责任']) assert.match(detail, new RegExp(text))
    const pda = renderPdaSewingDeliveryProgress(view as any, '件', '2026-07-08 12:00:00')
    for (const text of ['分配量', '已交', '已实收', '还差', '下一节点', '剩余时间', '已超收 30 件']) assert.match(pda, new RegExp(text))
  `], { stdio: 'pipe' })
}, '履约三端渲染 helper 必须执行真实 HTML 行为断言')
assert.doesNotThrow(() => {
  execFileSync('./node_modules/.bin/tsx', ['-e', `
    import assert from 'node:assert/strict'
    class InputNode { value = '30'; dataset = { pdaHandoverdField: 'writebackQty' }; closest(selector) { return selector === '[data-pda-handoverd-field]' || selector === '[data-progress-field]' ? this : null } }
    class SelectNode extends InputNode {}
    class TextareaNode extends InputNode {}
    globalThis.HTMLInputElement = InputNode as any
    globalThis.HTMLTextAreaElement = TextareaNode as any
    globalThis.HTMLSelectElement = SelectNode as any
    globalThis.HTMLElement = class {} as any
    let previewWrites = 0
    let previewHtml = ''
    let reviewDialogWrites = 0
    let recordRefreshes = 0
    let summaryRefreshes = 0
    let headSummaryRefreshes = 0
    const previewSelectors = []
    const previewHost = { set innerHTML(value) { previewWrites += 1; previewHtml = value } }
    const reviewDialogHost = { set innerHTML(value) { reviewDialogWrites += 1 } }
    const recordHost = { set outerHTML(value) { recordRefreshes += 1 } }
    const summaryHost = { set outerHTML(value) { summaryRefreshes += 1 } }
    const headSummaryHost = { set outerHTML(value) { headSummaryRefreshes += 1 } }
    globalThis.document = { querySelector(selector) { if (selector.includes('data-sewing-sla-writeback-preview')) { previewSelectors.push(selector); return previewHost }; if (selector.includes('data-sewing-sla-review-dialog-host')) return reviewDialogHost; if (selector.includes('data-handout-record-id')) return recordHost; if (selector.includes('data-sewing-sla-handover-summary')) return summaryHost; if (selector.includes('data-handout-head-live-summary')) return headSummaryHost; return null } } as any
    ;(async () => {
    const runtime = await import('./src/data/fcs/runtime-process-tasks.ts')
    const sla = await import('./src/data/fcs/sewing-delivery-sla.ts')
    const handover = await import('./src/data/fcs/pda-handover-events.ts')
    const page = await import('./src/pages/pda-handover-detail.ts')
    const viewDomain = await import('./src/data/fcs/sewing-delivery-sla-view.ts')
    const progressEvents = await import('./src/pages/progress-board/events.ts')
    const progressTaskPage = await import('./src/pages/progress-board/task-domain.ts')
    const task = runtime.listRuntimeProcessTasks().find((item) => sla.classifySewingDeliverySla(item) !== null)
    assert(task)
    const snapshotState = sla.captureSewingDeliverySlaSnapshotStore()
    const handoverState = handover.capturePdaHandoverState()
    let currentNow = '2026-07-05 09:30:00'
    const restoreNowProvider = page.setReceiverWritebackNowProvider(() => currentNow)
    try {
      sla.saveSewingDeliverySlaSnapshot(sla.createSewingDeliverySlaSnapshot({ assignmentId: 'ASSIGN-PREVIEW', runtimeTaskId: task.taskId, productionOrderId: task.productionOrderId, factoryId: 'F1', factoryName: '测试厂', assignedQty: 100, acceptedAt: '2026-07-01 10:00:00', slaKind: sla.classifySewingDeliverySla(task) }))
      handover.upsertPdaHandoverHeadMock({ handoverId: 'HEAD-PREVIEW', handoverOrderId: 'HEAD-PREVIEW', handoverOrderNo: 'HDO-PREVIEW', headType: 'HANDOUT', qrCodeValue: 'QR', taskId: task.taskId, taskNo: task.taskNo || task.taskId, productionOrderNo: task.productionOrderId, processName: task.processNameZh, sourceFactoryName: '测试厂', sourceFactoryId: 'F1', targetName: '成衣仓', targetKind: 'WAREHOUSE', receiverKind: 'WAREHOUSE', receiverId: 'WH1', receiverName: '成衣仓', qtyUnit: '件', factoryId: 'F1', taskStatus: 'IN_PROGRESS', summaryStatus: 'SUBMITTED', recordCount: 0, pendingWritebackCount: 0, submittedQtyTotal: 0, writtenBackQtyTotal: 0, objectionCount: 0, plannedQty: 100, completionStatus: 'OPEN', qtyExpectedTotal: 100, qtyActualTotal: 0, qtyDiffTotal: -100 })
      const specialRecordId = 'REC-"\\\\PREVIEW'
      handover.upsertPdaHandoutRecordMock({ recordId: specialRecordId, handoverRecordId: specialRecordId, handoverId: 'HEAD-PREVIEW', handoverOrderId: 'HEAD-PREVIEW', taskId: task.taskId, sourceTaskId: task.taskId, sequenceNo: 1, submittedQty: 30, plannedQty: 30, qtyUnit: '件', factorySubmittedAt: '2026-07-05 09:00:00', factorySubmittedBy: '工厂操作员', factoryProofFiles: [], status: 'PENDING_WRITEBACK', handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK' })
      const openTarget = { closest(selector) { if (selector === '[data-pda-handoverd-field]') return null; if (selector === '[data-pda-handoverd-action]') return { dataset: { pdaHandoverdAction: 'open-receiver-writeback', recordId: specialRecordId } }; return null } }
      page.handlePdaHandoverDetailEvent(openTarget as any)
      const scrollBefore = 120
      page.handlePdaHandoverDetailEvent(new InputNode() as any)
      assert.equal(previewWrites, 1, '实收数量输入只应更新预览 host')
      assert.match(previewHtml, /预估确认时间：2026-07-05 09:30:00/, '局部预览必须把输入时刻标成预估确认时间')
      assert.match(previewHtml, /提交时按实际时间重新计算/, '局部预览必须说明提交时按实际时间重新计算')
      const escapedRecordId = specialRecordId.replace(/[\\\\"]/g, (character) => '\\\\' + character)
      assert.equal(previewSelectors.at(-1), '[data-sewing-sla-writeback-preview][data-record-id="' + escapedRecordId + '"]', '特殊字符记录号必须安全转义后再拼入动态选择器')
      assert.equal(scrollBefore, 120, '局部输入不得改变滚动位置')
      const draft = page.captureReceiverWritebackDraftState()
      assert.equal(draft.writebackPreviewConfirmedAt, '2026-07-05 09:30:00', '有效数量输入必须固定输入当时的预览确认时间')
      const preview = page.buildReceiverWritebackSlaPreview(specialRecordId, 30, draft.writebackPreviewConfirmedAt)
      assert(preview)
      assert.equal(preview.projection.milestones[0]?.firstReachedAt, '2026-07-05 09:30:00', '输入预览必须按输入当时确认时间首次达标')
      currentNow = '2026-07-05 11:30:00'
      const finalPreview = page.buildReceiverWritebackSlaPreview(specialRecordId, 30, currentNow)
      assert(finalPreview)
      const submitTarget = { closest(selector) { if (selector === '[data-pda-handoverd-field]') return null; if (selector === '[data-pda-handoverd-action]') return { dataset: { pdaHandoverdAction: 'submit-receiver-writeback', recordId: specialRecordId } }; return null } }
      page.handlePdaHandoverDetailEvent(submitTarget as any)
      const writtenRecord = handover.findPdaHandoverRecord(specialRecordId)
      assert.equal(writtenRecord?.receiverWrittenAt, '2026-07-05 11:30:00', '真实提交 handler 必须使用点击时实际确认时间')
      const confirmed = viewDomain.getSewingDeliverySlaView(task.taskId, currentNow)
      assert.notEqual(preview.projection.milestones[0]?.firstReachedAt, finalPreview.projection.milestones[0]?.firstReachedAt, '输入预估与点击确认跨时间后应允许变化')
      assert.deepEqual(confirmed?.projection, finalPreview.projection, '真实提交后的完整投影必须与点击时最终临时投影一致')
      assert.equal(confirmed?.projection.milestones[0]?.firstReachedAt, '2026-07-05 11:30:00', '真实提交后的首次达标时间必须取点击确认时间')
      assert.equal(recordRefreshes, 1, '真实提交 handler 必须局部刷新当前记录')
      assert.equal(summaryRefreshes, 1, '真实提交 handler 必须局部刷新履约摘要')
      assert.equal(headSummaryRefreshes, 1, '真实提交 handler 必须局部刷新交出单累计实收、待收和差异汇总')
      handover.upsertPdaHandoutRecordMock({ recordId: 'REC-SYNC-WARNING', handoverRecordId: 'REC-SYNC-WARNING', handoverId: 'HEAD-PREVIEW', handoverOrderId: 'HEAD-PREVIEW', taskId: task.taskId, sourceTaskId: task.taskId, sequenceNo: 2, submittedQty: 10, plannedQty: 10, qtyUnit: '件', factorySubmittedAt: '2026-07-05 10:00:00', factorySubmittedBy: '工厂操作员', factoryProofFiles: [], status: 'PENDING_WRITEBACK', handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK' })
      currentNow = '2026-07-05 12:00:00'
      page.handlePdaHandoverDetailEvent({ closest(selector) { if (selector === '[data-pda-handoverd-field]') return null; if (selector === '[data-pda-handoverd-action]') return { dataset: { pdaHandoverdAction: 'open-receiver-writeback', recordId: 'REC-SYNC-WARNING' } }; return null } } as any)
      const warningInput = new InputNode(); warningInput.value = '10'
      page.handlePdaHandoverDetailEvent(warningInput as any)
      const restoreLinkageProbe = page.setReceiverWritebackLinkageProbe(() => { throw new Error('模拟仓库同步失败') })
      try {
        page.handlePdaHandoverDetailEvent({ closest(selector) { if (selector === '[data-pda-handoverd-field]') return null; if (selector === '[data-pda-handoverd-action]') return { dataset: { pdaHandoverdAction: 'submit-receiver-writeback', recordId: 'REC-SYNC-WARNING' } }; return null } } as any)
      } finally {
        restoreLinkageProbe()
      }
      assert.equal(handover.findPdaHandoverRecord('REC-SYNC-WARNING')?.receiverWrittenAt, '2026-07-05 12:00:00', '仓库联动失败不得回滚已成功的实收事实')
      const warningDraft = page.captureReceiverWritebackDraftState()
      assert.equal(warningDraft.writebackRecordId, '', '联动失败后不得回开确认表单')
      assert.match(warningDraft.writebackSyncWarning, /确认成功.*仓库同步待处理/, '联动失败必须保留成功事实并给主管兜底警示')
      handover.upsertPdaHandoutRecordMock({ recordId: 'REC-REVIEW-LATE', handoverRecordId: 'REC-REVIEW-LATE', handoverId: 'HEAD-PREVIEW', handoverOrderId: 'HEAD-PREVIEW', taskId: task.taskId, sourceTaskId: task.taskId, sequenceNo: 2, submittedQty: 30, plannedQty: 30, qtyUnit: '件', factorySubmittedAt: '2026-07-04 09:00:00', factorySubmittedBy: '工厂操作员', factoryProofFiles: [], status: 'PENDING_WRITEBACK', handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK' })
      handover.writeBackHandoverRecord({ handoverRecordId: 'REC-REVIEW-LATE', receiverWrittenQty: 30, receiverWrittenAt: '2026-07-06 10:00:00', receiverWrittenBy: '接收员' })
      const projectionBeforeReview = viewDomain.getSewingDeliverySlaView(task.taskId, '2026-07-06 10:00:00')?.projection
      const reviewDraftBefore = progressTaskPage.captureSewingDeliveryResponsibilityReviewDraft()
      const actionTarget = (action, extras = {}) => ({ closest(selector) { if (selector === '[data-progress-field]') return null; if (selector === '[data-progress-action]') return { dataset: { progressAction: action, ...extras } }; return null } })
      progressEvents.handleProgressBoardEvent(actionTarget('review-sewing-sla-responsibility', { taskId: task.taskId, ratio: '0.3' }) as any)
      assert.equal(reviewDialogWrites, 1, '打开主管复核只应刷新局部弹窗 host')
      const updateReviewField = (NodeType, field, value) => { const node = new NodeType(); node.value = value; node.dataset = { progressField: 'sewingSlaReview.' + field }; progressEvents.handleProgressBoardEvent(node as any) }
      updateReviewField(SelectNode, 'conclusion', 'SHARED')
      updateReviewField(TextareaNode, 'remark', '工厂交出及时，接收确认也有现场延迟')
      updateReviewField(InputNode, 'reviewedBy', '跟单主管')
      updateReviewField(InputNode, 'reviewedAt', '2026-07-06T11:00')
      assert.equal(reviewDialogWrites, 1, '复核字段输入不得替换弹窗导致焦点或滚动位置丢失')
      progressEvents.handleProgressBoardEvent(actionTarget('submit-sewing-sla-review') as any)
      assert.equal(sla.getSewingDeliveryResponsibilityReview(task.taskId, 0.3)?.conclusion, 'SHARED', '真实 handler 必须保存责任结论')
      assert.deepEqual(viewDomain.getSewingDeliverySlaView(task.taskId, '2026-07-06 10:00:00')?.projection, projectionBeforeReview, '真实复核 handler 不得改变投影和首次达标时间')
      sla.recordSewingDeliveryResponsibilityReview({ runtimeTaskId: task.taskId, milestoneRatio: 0.3, conclusion: 'RECEIVER', remark: '第二次复核：接收方责任', reviewedBy: '生产主管', reviewedAt: '2026-07-06 12:00:00', projection: viewDomain.getSewingDeliverySlaView(task.taskId, '2026-07-06 12:00:00').projection })
      progressTaskPage.openSewingDeliveryResponsibilityReview(task.taskId, 0.3)
      const reviewDialogHtml = progressTaskPage.renderSewingDeliveryResponsibilityReviewDialog()
      for (const text of ['当前结论', '接收方责任', '复核历史', '工厂交出及时，接收确认也有现场延迟', '第二次复核：接收方责任', '跟单主管', '生产主管', '2026-07-06 11:00:00', '2026-07-06 12:00:00']) assert.match(reviewDialogHtml, new RegExp(text))
      progressTaskPage.restoreSewingDeliveryResponsibilityReviewDraft(reviewDraftBefore)
    } finally {
      restoreNowProvider()
      handover.restorePdaHandoverState(handoverState)
      sla.restoreSewingDeliverySlaSnapshotStore(snapshotState)
    }
    })()
  `], { stdio: 'pipe' })
}, '接收确认预览、局部输入 handler 与确认后事实必须一致')
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
assert.match(
  mainSource,
  /function shouldSkipChangeRerender[\s\S]*?data-skip-page-rerender="true"/,
  '全局 change 路径必须尊重局部更新控件的跳过整页重绘标记',
)
const sewingDeliverySlaViewSource = readFileSync(new URL('../src/data/fcs/sewing-delivery-sla-view.ts', import.meta.url), 'utf8')
const progressDomainSource = readFileSync(new URL('../src/data/fcs/store-domain-progress.ts', import.meta.url), 'utf8')
assert.match(
  sewingDeliverySlaViewSource,
  /listHandoverOrdersByTaskId\(runtimeTaskId\)/,
  '单任务履约视图必须严格复用交出域 taskId 查询入口',
)
assert.match(
  sewingDeliverySlaViewSource,
  /const recordsByTaskId = new Map[\s\S]*?listPdaHandoverHeads\(\)\.forEach/,
  '批量履约视图必须一次读取交出单并按 taskId 预索引',
)
assert.doesNotMatch(
  sewingDeliverySlaViewSource,
  /listRuntimeExecutionTasks\(\)[\s\S]{0,500}getSewingDeliverySlaView\(task\.taskId/,
  '批量履约视图不得逐任务调用单查入口形成 N+1',
)
assert.match(
  progressDomainSource,
  /const sewingDeliverySlaByTaskId = new Map\([\s\S]*?listSewingDeliverySlaViews\(\)/,
  '统一进度事实必须一次生成履约视图 Map 后按任务挂接',
)
assert.doesNotMatch(
  progressDomainSource,
  /getSewingDeliverySlaView\(task\.taskId\)/,
  '统一进度事实不得对全部运行时任务逐条重建履约视图',
)

const viewSnapshotStoreState = captureSewingDeliverySlaSnapshotStore()
const viewHandoverState = capturePdaHandoverState()
try {
  const viewTask = listRuntimeProcessTasks().find((task) => classifySewingDeliverySla(task) !== null)
  assert(viewTask, '履约视图测试需要至少一个适用含车缝时效的运行时任务')
  const viewTaskId = viewTask.taskId
  const conflictTask = listRuntimeProcessTasks().find(
    (task) => task.taskId !== viewTaskId && classifySewingDeliverySla(task) !== null,
  )
  assert(conflictTask, '字段冲突测试需要另一个适用含车缝时效的运行时任务')
  const viewHeadId = `HOH-SLA-VIEW-${viewTaskId}`
  const viewSnapshot = createSewingDeliverySlaSnapshot({
    assignmentId: 'ASSIGN-SLA-VIEW',
    runtimeTaskId: viewTaskId,
    productionOrderId: viewTask.productionOrderId,
    factoryId: 'F-SLA-VIEW',
    factoryName: '履约视图测试车缝厂',
    assignedQty: 100,
    acceptedAt: '2026-07-01 10:00:00',
    slaKind: classifySewingDeliverySla(viewTask)!,
  })
  saveSewingDeliverySlaSnapshot(viewSnapshot)
  saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({
    assignmentId: 'ASSIGN-SLA-VIEW-CONFLICT',
    runtimeTaskId: conflictTask.taskId,
    productionOrderId: conflictTask.productionOrderId,
    factoryId: 'F-SLA-VIEW-CONFLICT',
    factoryName: '字段冲突测试车缝厂',
    assignedQty: 100,
    acceptedAt: '2026-07-01 10:00:00',
    slaKind: classifySewingDeliverySla(conflictTask)!,
  }))

  const viewHead: PdaHandoverHead = {
    handoverId: viewHeadId,
    handoverOrderId: viewHeadId,
    handoverOrderNo: 'HDO-SLA-VIEW',
    headType: 'HANDOUT',
    qrCodeValue: 'QR-SLA-VIEW',
    taskId: viewTaskId,
    runtimeTaskId: conflictTask.taskId,
    taskNo: viewTask.taskNo || viewTaskId,
    productionOrderNo: viewTask.productionOrderId,
    processName: viewTask.processNameZh,
    sourceFactoryName: '履约视图测试车缝厂',
    sourceFactoryId: 'F-SLA-VIEW',
    targetName: '成衣仓',
    targetKind: 'WAREHOUSE',
    receiverKind: 'WAREHOUSE',
    receiverId: 'WH-SLA-VIEW',
    receiverName: '履约视图测试成衣仓',
    qtyUnit: '件',
    factoryId: 'F-SLA-VIEW',
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'SUBMITTED',
    recordCount: 0,
    pendingWritebackCount: 0,
    submittedQtyTotal: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    plannedQty: 100,
    completionStatus: 'OPEN',
    qtyExpectedTotal: 100,
    qtyActualTotal: 0,
    qtyDiffTotal: -100,
  }
  upsertPdaHandoverHeadMock(viewHead)
  const capturedFixtureState = capturePdaHandoverState()
  const fixtureStateBeforeProbe = capturePdaHandoverState()
  const capturedViewHead = capturedFixtureState.handoverHeadAdditions.find(([headId]) => headId === viewHeadId)?.[1]
  assert(capturedViewHead, '防御复制测试应捕获刚新增的交出单')
  capturedViewHead.taskNo = 'MUTATED-CAPTURE-ONLY'
  assert.deepEqual(
    capturePdaHandoverState(),
    fixtureStateBeforeProbe,
    '修改 capture 返回值不得反向污染交出域 singleton',
  )

  const record = (
    recordId: string,
    submittedQty: number,
    factorySubmittedAt: string,
    extras: Partial<PdaHandoverRecord> = {},
  ): PdaHandoverRecord => ({
    recordId,
    handoverRecordId: recordId,
    handoverId: viewHeadId,
    handoverOrderId: viewHeadId,
    taskId: viewTaskId,
    sourceTaskId: viewTaskId,
    sequenceNo: 1,
    submittedQty,
    plannedQty: submittedQty,
    qtyUnit: '件',
    factorySubmittedAt,
    factorySubmittedBy: '工厂操作员',
    factoryProofFiles: [],
    status: 'PENDING_WRITEBACK',
    handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK',
    ...extras,
  })

  upsertPdaHandoutRecordMock(record('SLA-VIEW-PENDING', 10, '2026-07-02 09:00:00'))
  const handoverBeforeInvalidWriteback = capturePdaHandoverState()
  for (const invalidReceiverQty of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.throws(
      () => writeBackHandoverRecord({
        handoverRecordId: 'SLA-VIEW-PENDING',
        receiverWrittenQty: invalidReceiverQty,
        receiverWrittenAt: '2026-07-02 10:00:00',
        receiverWrittenBy: '非法数量测试员',
      }),
      /实收数量必须为非负有限数/,
      `非法实收数量 ${String(invalidReceiverQty)} 必须在 mutation 前拒绝`,
    )
    assert.deepEqual(
      capturePdaHandoverState(),
      handoverBeforeInvalidWriteback,
      '非法实收数量被拒绝后交出域状态必须保持不变',
    )
  }
  upsertPdaHandoutRecordMock(record('SLA-VIEW-LATE-Z', 20, '2026-07-05 09:00:00'))
  writeBackHandoverRecord({
    handoverRecordId: 'SLA-VIEW-LATE-Z',
    receiverWrittenQty: 20,
    receiverWrittenAt: '2026-07-05 12:00:00',
    receiverWrittenBy: '仓库收货员',
  })
  upsertPdaHandoutRecordMock(record('SLA-VIEW-EARLY', 15, '2026-07-03 09:00:00'))
  writeBackHandoverRecord({
    handoverRecordId: 'SLA-VIEW-EARLY',
    receiverWrittenQty: 15,
    receiverWrittenAt: '2026-07-03 10:00:00',
    receiverWrittenBy: '仓库收货员',
  })
  upsertPdaHandoutRecordMock(record('SLA-VIEW-LATE-A', 5, '2026-07-05 09:30:00'))
  writeBackHandoverRecord({
    handoverRecordId: 'SLA-VIEW-LATE-A',
    receiverWrittenQty: 5,
    receiverWrittenAt: '2026-07-05 12:00:00',
    receiverWrittenBy: '仓库收货员',
  })
  const voidedRecord = upsertPdaHandoutRecordMock(record('SLA-VIEW-VOID', 30, '2026-07-04 09:00:00', {
    receiverWrittenQty: 30,
    receiverWrittenAt: '2026-07-04 10:00:00',
    handoverRecordStatus: 'VOIDED',
    status: 'WRITTEN_BACK',
  }))
  assert.equal(voidedRecord.handoverRecordStatus, 'VOIDED', '交出域 hydrate 不得把作废记录重新激活')
  assert.equal(voidedRecord.status, 'WRITTEN_BACK', '作废修正不得破坏既有 legacy status 映射兼容')
  upsertPdaHandoutRecordMock(record('SLA-VIEW-DIRTY-SUBMITTED', Number.NaN, '2026-07-04 11:00:00', {
    receiverWrittenQty: 99,
    receiverWrittenAt: '2026-07-04 12:00:00',
    status: 'WRITTEN_BACK',
  }))
  upsertPdaHandoutRecordMock(record('SLA-VIEW-DIRTY-NEGATIVE', 9, '2026-07-04 13:00:00', {
    receiverWrittenQty: -1,
    receiverWrittenAt: '2026-07-04 14:00:00',
    status: 'WRITTEN_BACK',
  }))
  upsertPdaHandoutRecordMock(record('SLA-VIEW-DIRTY-INFINITE', 9, '2026-07-04 15:00:00', {
    receiverWrittenQty: Number.POSITIVE_INFINITY,
    receiverWrittenAt: '2026-07-04 16:00:00',
    status: 'WRITTEN_BACK',
  }))

  const initialView = getSewingDeliverySlaView(viewTaskId, '2026-07-06 10:00:00')
  assert(initialView, '有有效快照的任务应生成履约视图')
  assert.equal(initialView.runtimeTaskId, viewTaskId)
  assert.equal(initialView.submittedQty, 68, '已交出应汇总有效提交数量，作废与非法提交数量不计入')
  assert.equal(initialView.confirmedReceivedQty, 40, '待确认与作废记录不得计入确认实收')
  assert.equal(initialView.projection.milestones[0]?.firstReachedAt, '2026-07-05 12:00:00', '首次达标时间必须按接收方确认时间稳定排序累计')
  assert.deepEqual(
    initialView.projection.milestones[0]?.receiverDelayRecordIds,
    ['SLA-VIEW-LATE-A', 'SLA-VIEW-LATE-Z'],
    '同一确认时间的接收延迟责任记录应确定性排序，并复用纯投影规则',
  )
  const conflictView = getSewingDeliverySlaView(conflictTask.taskId, '2026-07-06 10:00:00')
  assert(conflictView, '字段冲突任务有有效快照时应生成空履约视图')
  assert.equal(conflictView.submittedQty, 0, '交出单只能按严格 taskId 归属，runtimeTaskId 冲突不得双计')
  assert.equal(conflictView.confirmedReceivedQty, 0, '脏记录与冲突字段不得推进其他任务履约')

  upsertPdaHandoutRecordMock(record('SLA-VIEW-REVERSED', 50, '2026-07-06 09:00:00'))
  writeBackHandoverRecord({
    handoverRecordId: 'SLA-VIEW-REVERSED',
    receiverWrittenQty: 50,
    receiverWrittenAt: '2026-07-07 10:00:00',
    receiverWrittenBy: '仓库收货员',
  })
  assert.equal(getSewingDeliverySlaView(viewTaskId, '2026-07-07 10:00:00')?.confirmedReceivedQty, 90)
  writeBackHandoverRecord({
    handoverRecordId: 'SLA-VIEW-REVERSED',
    receiverWrittenQty: 10,
    receiverWrittenAt: '2026-07-07 11:00:00',
    receiverWrittenBy: '仓库主管',
    receiverRemark: '复核冲销 40 件，实收修正为 10 件',
  })
  assert.equal(
    getSewingDeliverySlaView(viewTaskId, '2026-07-07 11:00:00')?.confirmedReceivedQty,
    50,
    '冲销应沿用交出域当前有效回写数量，不得在履约视图另造冲销状态',
  )

  upsertPdaHandoutRecordMock(record('SLA-VIEW-OVER', 80, '2026-07-07 12:00:00'))
  writeBackHandoverRecord({
    handoverRecordId: 'SLA-VIEW-OVER',
    receiverWrittenQty: 80,
    receiverWrittenAt: '2026-07-08 10:00:00',
    receiverWrittenBy: '仓库收货员',
  })
  const overView = getSewingDeliverySlaView(viewTaskId, '2026-07-08 10:00:00')
  assert(overView)
  assert.equal(overView.confirmedReceivedQty, 130, '超量实收应正常计入')
  assert.equal(overView.projection.progressRatio, 1.3, '履约比例不得封顶为 100%')
  assert.equal(overView.projection.completedAt, '2026-07-08 10:00:00')
  assert.equal(Object.isFrozen(overView), true, '履约视图必须是防御冻结的只读结果')
  assert.equal(Object.isFrozen(overView.projection), true, '履约视图不得暴露可变投影状态')
  assert.notEqual(getSewingDeliverySlaView(viewTaskId, '2026-07-08 10:00:00'), overView, '每次查询应返回独立只读视图，不缓存复制履约状态')

  const listViews = listSewingDeliverySlaViews('2026-07-08 10:00:00')
  assert(listViews.some((item) => item.runtimeTaskId === viewTaskId), '履约视图列表应包含当前有效快照任务')
  assert.equal(
    listViews.find((item) => item.runtimeTaskId === conflictTask.taskId)?.confirmedReceivedQty,
    0,
    '批量视图必须按严格 taskId 预索引，字段冲突不得双计或被脏记录毒化',
  )
  assert.equal(Object.isFrozen(listViews), true, '履约视图列表也必须防御冻结')
  const visibleOnlyViews = listSewingDeliverySlaViews('2026-07-08 10:00:00', [viewTaskId])
  assert.deepEqual(visibleOnlyViews.map((item) => item.runtimeTaskId), [viewTaskId], '批量履约视图必须支持只投影当前可见任务')

  const progressFact = getProgressFactByTaskId(viewTaskId)
  assert(progressFact?.sewingDeliverySla, '统一进度事实应按需挂接含车缝履约视图')
  assert.equal(progressFact.sewingDeliverySla.confirmedReceivedQty, 130, '统一进度事实必须实时读取接收方确认实收')

  const responsibilityApi = sewingDeliverySlaDomain as typeof sewingDeliverySlaDomain & {
    recordSewingDeliveryResponsibilityReview: (input: {
      runtimeTaskId: string
      milestoneRatio: 0.3 | 0.7 | 1
      conclusion: 'FACTORY' | 'RECEIVER' | 'SHARED'
      remark: string
      reviewedBy: string
      reviewedAt: string
      projection: typeof projectionBeforeReview
    }) => { reviewId: string; conclusion: string; snapshotId: string }
    getSewingDeliveryResponsibilityReview: (runtimeTaskId: string, milestoneRatio: number) => { conclusion: string; snapshotId: string } | null
    listSewingDeliveryResponsibilityReviews: (runtimeTaskId: string, milestoneRatio?: number) => readonly Array<{ snapshotId: string }>
  }
  assert.equal(typeof responsibilityApi.recordSewingDeliveryResponsibilityReview, 'function', '领域层应提供接收延迟责任复核保存入口')
  const projectionBeforeReview = getSewingDeliverySlaView(viewTaskId, '2026-07-08 10:00:00')?.projection
  const firstReview = responsibilityApi.recordSewingDeliveryResponsibilityReview({
    runtimeTaskId: viewTaskId,
    milestoneRatio: 0.3,
    conclusion: 'RECEIVER',
    remark: '交出及时，接收方次日才确认',
    reviewedBy: '跟单主管',
    reviewedAt: '2026-07-08 10:30:00',
    projection: projectionBeforeReview,
  })
  assert.equal(firstReview.conclusion, 'RECEIVER')
  assert.equal(firstReview.snapshotId, projectionBeforeReview?.snapshot.snapshotId, '责任复核必须绑定当前履约快照')
  responsibilityApi.recordSewingDeliveryResponsibilityReview({
    runtimeTaskId: viewTaskId,
    milestoneRatio: 0.3,
    conclusion: 'SHARED',
    remark: '复核后确认双方均有延迟',
    reviewedBy: '生产主管',
    reviewedAt: '2026-07-08 11:00:00',
    projection: projectionBeforeReview,
  })
  assert.equal(responsibilityApi.getSewingDeliveryResponsibilityReview(viewTaskId, 0.3)?.conclusion, 'SHARED', '单查应返回最近一次责任结论')
  assert.equal(responsibilityApi.listSewingDeliveryResponsibilityReviews(viewTaskId, 0.3).length, 2, '重复复核必须保留历史')
  assert.deepEqual(
    getSewingDeliverySlaView(viewTaskId, '2026-07-08 10:00:00')?.projection,
    projectionBeforeReview,
    '责任复核不得改动实收、里程碑或首次达标时间',
  )
  assert.throws(
    () => responsibilityApi.recordSewingDeliveryResponsibilityReview({
      runtimeTaskId: viewTaskId,
      milestoneRatio: 0.5 as 0.3,
      conclusion: 'FACTORY',
      remark: '非法节点',
      reviewedBy: '测试员',
      reviewedAt: '2026-07-08 11:30:00',
      projection: projectionBeforeReview,
    }),
    /复核节点比例/,
  )
  const reviewHistoryCount = responsibilityApi.listSewingDeliveryResponsibilityReviews(viewTaskId).length
  for (const invalid of [
    { runtimeTaskId: 'TASK-NOT-FOUND', milestoneRatio: 0.3, conclusion: 'FACTORY', reviewedAt: '2026-07-08 11:30:00', expected: /有效履约快照/ },
    { runtimeTaskId: viewTaskId, milestoneRatio: 0.3, conclusion: 'UNKNOWN', reviewedAt: '2026-07-08 11:30:00', expected: /责任结论/ },
    { runtimeTaskId: viewTaskId, milestoneRatio: 0.3, conclusion: 'FACTORY', reviewedAt: '非法时间', expected: /责任复核时间/ },
  ] as const) {
    assert.throws(
      () => responsibilityApi.recordSewingDeliveryResponsibilityReview({
        runtimeTaskId: invalid.runtimeTaskId,
        milestoneRatio: invalid.milestoneRatio,
        conclusion: invalid.conclusion as 'FACTORY',
        remark: '非法输入不得保存',
        reviewedBy: '测试员',
        reviewedAt: invalid.reviewedAt,
        projection: projectionBeforeReview,
      }),
      invalid.expected,
    )
  }
  assert.equal(responsibilityApi.listSewingDeliveryResponsibilityReviews(viewTaskId).length, reviewHistoryCount, '非法责任复核不得留下部分历史')
  assert.equal(Object.isFrozen(responsibilityApi.listSewingDeliveryResponsibilityReviews(viewTaskId)), true, '责任复核历史列表必须防御冻结')
  const projectionWithoutReceiverDelay = projectSewingDeliverySla(viewSnapshot, [], '2026-07-08 12:00:00')
  assert.throws(
    () => responsibilityApi.recordSewingDeliveryResponsibilityReview({ runtimeTaskId: viewTaskId, milestoneRatio: 0.3, conclusion: 'FACTORY', remark: '无接收延迟', reviewedBy: '测试员', reviewedAt: '2026-07-08 12:00:00', projection: projectionWithoutReceiverDelay }),
    /没有接收确认延迟/,
    '当前节点没有接收确认延迟时不得记录责任结论',
  )
  const replacementSnapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'ASSIGN-SLA-VIEW-REPLACED', runtimeTaskId: viewTaskId, productionOrderId: viewTask.productionOrderId, factoryId: 'F-SLA-VIEW-2', factoryName: '改派后测试厂', assignedQty: 100, acceptedAt: '2026-07-01 10:00:00', slaKind: classifySewingDeliverySla(viewTask)! })
  saveSewingDeliverySlaSnapshot(replacementSnapshot)
  assert.equal(responsibilityApi.getSewingDeliveryResponsibilityReview(viewTaskId, 0.3), null, '切换当前快照后不得串用旧快照当前结论')
  const crossSnapshotHistory = responsibilityApi.listSewingDeliveryResponsibilityReviews(viewTaskId, 0.3)
  assert.equal(crossSnapshotHistory.length, 2, '跨快照历史必须保留')
  assert(crossSnapshotHistory.every((review) => review.snapshotId === viewSnapshot.snapshotId), '旧复核历史必须标识原快照')
  const replacementProjection = getSewingDeliverySlaView(viewTaskId, '2026-07-08 12:00:00')?.projection
  assert(replacementProjection)
  const replacementReview = responsibilityApi.recordSewingDeliveryResponsibilityReview({ runtimeTaskId: viewTaskId, milestoneRatio: 0.3, conclusion: 'RECEIVER', remark: '新快照重新复核', reviewedBy: '跟单主管', reviewedAt: '2026-07-08 12:30:00', projection: replacementProjection })
  assert.equal(replacementReview.snapshotId, replacementSnapshot.snapshotId)
  assert.equal(responsibilityApi.getSewingDeliveryResponsibilityReview(viewTaskId, 0.3)?.snapshotId, replacementSnapshot.snapshotId, '当前查询只能返回当前 active 快照结论')
  assert.equal(responsibilityApi.listSewingDeliveryResponsibilityReviews(viewTaskId, 0.3).length, 3, '历史查询必须跨快照保留并新增当前复核')

  const noSnapshotTask = listRuntimeProcessTasks().find((task) => task.taskId !== viewTaskId && !getSewingDeliverySlaSnapshot(task.taskId))
  assert(noSnapshotTask, '无快照回归测试需要另一个运行时任务')
  assert.equal(getSewingDeliverySlaView(noSnapshotTask.taskId, '2026-07-08 10:00:00'), null, '无有效快照不得生成履约视图')
  assert.equal(getProgressFactByTaskId(noSnapshotTask.taskId)?.sewingDeliverySla, undefined, '无快照或不适用任务不得挂接履约事实')

  const nonSlaTask = listRuntimeProcessTasks().find((task) => classifySewingDeliverySla(task) === null)
  assert(nonSlaTask, '不适用任务回归测试需要一个非含车缝时效任务')
  saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({
    assignmentId: 'ASSIGN-SLA-VIEW-NON-SLA',
    runtimeTaskId: nonSlaTask.taskId,
    productionOrderId: nonSlaTask.productionOrderId,
    factoryId: 'F-SLA-VIEW',
    factoryName: '错误快照测试厂',
    assignedQty: 100,
    acceptedAt: '2026-07-01 10:00:00',
    slaKind: 'INDEPENDENT_SEWING',
  }))
  assert.equal(getSewingDeliverySlaView(nonSlaTask.taskId, '2026-07-08 10:00:00'), null, '不适用任务即使误挂快照也不得生成履约视图')
  assert.equal(getProgressFactByTaskId(nonSlaTask.taskId)?.sewingDeliverySla, undefined, '统一进度事实必须同时校验任务适用性')
  assert.equal(
    listSewingDeliverySlaViews('2026-07-08 10:00:00').some((item) => item.runtimeTaskId === nonSlaTask.taskId),
    false,
    '履约视图列表不得包含不适用任务的错误快照',
  )
} finally {
  try {
    restorePdaHandoverState(viewHandoverState)
  } finally {
    restoreSewingDeliverySlaSnapshotStore(viewSnapshotStoreState)
  }
}
assert.deepEqual(
  capturePdaHandoverState(),
  viewHandoverState,
  '履约视图测试结束后必须完整恢复交出域 singleton，避免 fixture 污染后续检查',
)
assert.deepEqual(
  captureSewingDeliverySlaSnapshotStore(),
  viewSnapshotStoreState,
  '履约视图测试结束后必须恢复快照仓，避免污染后续检查',
)

const seedParitySlaState = captureSewingDeliverySlaSnapshotStore()
const seedParityRuntimeState = captureRuntimeDirectDispatchState()
const seedParityHandoverState = capturePdaHandoverState()
try {
  const additionHeadIds = new Set(capturePdaHandoverState().handoverHeadAdditions.map(([headId]) => headId))
  const seedHead = listPdaHandoverHeads().find((head) => {
    if (head.headType !== 'HANDOUT' || additionHeadIds.has(head.handoverId)) return false
    const receivedRecords = getPdaHandoverRecordsByHead(head.handoverId).filter((record) => typeof record.receiverWrittenQty === 'number' && record.receiverWrittenAt)
    return receivedRecords.length > 0 && receivedRecords.every((record) => record.taskId === head.taskId && (record.handoverRecordStatus === 'WRITTEN_BACK_MATCHED' || record.handoverRecordStatus === 'DIFF_ACCEPTED') && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(record.factorySubmittedAt) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(record.receiverWrittenAt ?? ''))
  })
  assert(seedHead, '完整只读registry回归需要一个非addition来源的已确认seed交出记录')
  {
    let seedTask = getRuntimeTaskById(seedHead.taskId)
    if (!seedTask || classifySewingDeliverySla(seedTask) === null) {
      const base = listRuntimeProcessTasks().find((task) => classifySewingDeliverySla(task) === 'INDEPENDENT_SEWING')!
      const fixture = captureRuntimeDirectDispatchState()
      fixture.reassignedTasks.push([seedHead.taskId, { ...structuredClone(base), taskId: seedHead.taskId, taskNo: seedHead.taskNo || seedHead.taskId, productionOrderId: seedHead.productionOrderNo, assignedFactoryId: seedHead.factoryId, assignedFactoryName: seedHead.sourceFactoryName, acceptanceStatus: 'ACCEPTED', executionEnabled: true }])
      restoreRuntimeDirectDispatchState(fixture)
      seedTask = getRuntimeTaskById(seedHead.taskId)
    }
    assert(seedTask)
    upsertPdaHandoutRecordMock({ recordId: 'SEED-PLUS-ADDITION', handoverRecordId: 'SEED-PLUS-ADDITION', handoverId: seedHead.handoverId, handoverOrderId: seedHead.handoverId, taskId: seedTask.taskId, sourceTaskId: seedTask.taskId, sequenceNo: 999, submittedQty: 7, plannedQty: 7, qtyUnit: '件', factorySubmittedAt: '2026-07-02 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'WRITTEN_BACK_MATCHED', receiverWrittenQty: 7, receiverWrittenAt: '2026-07-02 09:00:00', receiverWrittenBy: '仓库' })
    clearSewingDeliverySlaSnapshotStore(seedTask.taskId)
    saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({ assignmentId: `SEED-PARITY-${seedTask.taskId}`, runtimeTaskId: seedTask.taskId, productionOrderId: seedTask.productionOrderId, factoryId: seedTask.assignedFactoryId ?? 'SEED-F', factoryName: seedTask.assignedFactoryName ?? 'Seed工厂', assignedQty: seedTask.scopeQty, acceptedAt: '2026-07-01 08:00:00', slaKind: classifySewingDeliverySla(seedTask)! }))
    assert.equal(sumSewingDeliveryConfirmedReceiptQty(seedTask.taskId), getSewingDeliverySlaView(seedTask.taskId, '2026-07-10 10:00:00')?.confirmedReceivedQty, '现有seed完整交出事实必须在改派adapter与Task6视图中一致')
    const directExpectedQty = listPdaHandoverHeads()
      .filter((head) => head.headType === 'HANDOUT' && head.taskId === seedTask.taskId)
      .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
      .filter((record) => record.taskId === seedTask.taskId && record.handoverRecordStatus !== 'VOIDED' && record.handoverRecordStatus !== 'SUBMITTED_WAIT_WRITEBACK')
      .reduce((sum, record) => sum + (typeof record.receiverWrittenQty === 'number' && Number.isFinite(record.receiverWrittenQty) && record.receiverWrittenQty >= 0 && record.receiverWrittenAt ? record.receiverWrittenQty : 0), 0)
    assert.equal(sumSewingDeliveryConfirmedReceiptQty(seedTask.taskId), directExpectedQty, 'registry必须合并完整reader seed与新增addition，且与pda完整读取链合法实收一致')
  }
} finally {
  restorePdaHandoverState(seedParityHandoverState)
  restoreRuntimeDirectDispatchState(seedParityRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(seedParitySlaState)
}

const reassignmentRuntimeState = captureRuntimeDirectDispatchState()
const reassignmentSlaState = captureSewingDeliverySlaSnapshotStore()
const reassignmentHandoverState = capturePdaHandoverState()
try {
  const sourceBase = getRuntimeTaskById('TASKGEN-202603-0015-001__ORDER')
  assert(sourceBase, '改派测试需要固定独立车缝任务')
  clearSewingDeliverySlaSnapshotStore(sourceBase.taskId)
  assert(applyRuntimeDirectDispatchMeta({ taskId: sourceBase.taskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', acceptDeadline: '', taskDeadline: '2026-07-20 18:00:00', remark: '改派测试前派单', by: '跟单A', dispatchPrice: 12000, dispatchPriceCurrency: 'IDR', dispatchPriceUnit: '件', priceDiffReason: '', businessAssignedAt: '2026-07-01 08:00:00', operatedAt: '2026-07-01 10:00:00', writeBackMainFactory: false }))
  const executionFixtureState = captureRuntimeDirectDispatchState()
  const sourceOverrideIndex = executionFixtureState.taskOverrides.findIndex(([taskId]) => taskId === sourceBase.taskId)
  executionFixtureState.taskOverrides[sourceOverrideIndex][1] = { ...executionFixtureState.taskOverrides[sourceOverrideIndex][1], status: 'BLOCKED', startedAt: '2026-07-02 08:00:00', finishedAt: '2026-07-03 18:00:00', blockReason: 'MATERIAL', blockRemark: '旧任务暂停结果', blockedAt: '2026-07-02 12:00:00', startHeadcount: 12, milestoneStatus: 'REPORTED', milestoneReportedQty: 99, handoverStatus: 'COMPLETED' }
  const downstreamBase = listRuntimeProcessTasks().find((task) => task.taskId !== sourceBase.taskId)!
  const downstreamFixture = { ...structuredClone(downstreamBase), taskId: 'TEST-REASSIGN-DOWNSTREAM', taskNo: 'TEST-REASSIGN-DOWNSTREAM', productionOrderId: sourceBase.productionOrderId, dependsOnTaskIds: [sourceBase.taskId, 'OTHER-UPSTREAM', sourceBase.taskId], baseDependsOnTaskIds: [], executionEnabled: true }
  executionFixtureState.reassignedTasks.push([downstreamFixture.taskId, downstreamFixture])
  const excludedCandidates = [
    { id: 'TEST-CANCELLED-CANDIDATE', factoryId: 'ID-F024', factoryName: '取消任务工厂', status: 'CANCELLED' as const, acceptanceStatus: 'ACCEPTED' as const, withSnapshot: true },
    { id: 'TEST-PENDING-CANDIDATE', factoryId: 'ID-F013', factoryName: '未接单工厂', status: 'NOT_STARTED' as const, acceptanceStatus: 'PENDING' as const, withSnapshot: true },
    { id: 'TEST-NO-SNAPSHOT-CANDIDATE', factoryId: 'KOL-GOTO-001', factoryName: '无快照工厂', status: 'NOT_STARTED' as const, acceptanceStatus: 'ACCEPTED' as const, withSnapshot: false },
  ]
  excludedCandidates.forEach((candidate) => executionFixtureState.reassignedTasks.push([candidate.id, { ...structuredClone(sourceBase), taskId: candidate.id, taskNo: candidate.id, productionOrderId: sourceBase.productionOrderId, assignedFactoryId: candidate.factoryId, assignedFactoryName: candidate.factoryName, status: candidate.status, acceptanceStatus: candidate.acceptanceStatus, executionEnabled: true }]))
  restoreRuntimeDirectDispatchState(executionFixtureState)
  excludedCandidates.forEach((candidate) => {
    registerProductionOrderSewingFactory({ productionOrderId: sourceBase.productionOrderId, factoryId: candidate.factoryId, factoryName: candidate.factoryName, by: '测试员', at: '2026-07-07 10:00:00' })
    if (candidate.withSnapshot) saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({ assignmentId: `CANDIDATE-${candidate.id}`, runtimeTaskId: candidate.id, productionOrderId: sourceBase.productionOrderId, factoryId: candidate.factoryId, factoryName: candidate.factoryName, assignedQty: sourceBase.scopeQty, acceptedAt: '2026-07-01 08:00:00', slaKind: 'INDEPENDENT_SEWING' }))
  })
  const source = getRuntimeTaskById(sourceBase.taskId)
  assert(source?.assignedFactoryId, '改派测试需要已派单的独立车缝任务')
  const sourceSnapshot = getSewingDeliverySlaSnapshot(source.taskId)
  assert(sourceSnapshot)
  const reassignmentHeadId = `HOH-REASSIGN-${source.taskId}`
  upsertPdaHandoverHeadMock({
    handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, handoverOrderNo: 'HDO-REASSIGN', headType: 'HANDOUT', qrCodeValue: 'QR-REASSIGN', taskId: source.taskId, taskNo: source.taskNo || source.taskId, productionOrderNo: source.productionOrderId, processName: source.processNameZh, sourceFactoryName: source.assignedFactoryName!, sourceFactoryId: source.assignedFactoryId, targetName: '成衣仓', targetKind: 'WAREHOUSE', receiverKind: 'WAREHOUSE', receiverId: 'WH-REASSIGN', receiverName: '成衣仓', qtyUnit: '件', factoryId: source.assignedFactoryId, taskStatus: 'IN_PROGRESS', summaryStatus: 'WRITTEN_BACK', recordCount: 1, pendingWritebackCount: 0, submittedQtyTotal: 30, writtenBackQtyTotal: 30, objectionCount: 0, plannedQty: source.scopeQty, completionStatus: 'OPEN', qtyExpectedTotal: source.scopeQty, qtyActualTotal: 30, qtyDiffTotal: 30 - source.scopeQty,
  })
  upsertPdaHandoutRecordMock({ recordId: 'REC-REASSIGN-30', handoverRecordId: 'REC-REASSIGN-30', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: source.taskId, sourceTaskId: source.taskId, sequenceNo: 1, submittedQty: 30, plannedQty: 30, qtyUnit: '件', factorySubmittedAt: '2026-07-07 08:00:00', factorySubmittedBy: '工厂操作员', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'WRITTEN_BACK_MATCHED', receiverWrittenQty: 30, receiverWrittenAt: '2026-07-07 09:00:00', receiverWrittenBy: '仓库收货员' })
  upsertPdaHandoutRecordMock({ recordId: 'REC-WRONG-TASK', handoverRecordId: 'REC-WRONG-TASK', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: 'WRONG-TASK', sourceTaskId: source.taskId, sequenceNo: 8, submittedQty: 99, plannedQty: 99, qtyUnit: '件', factorySubmittedAt: '2026-07-07 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'WRITTEN_BACK_MATCHED', receiverWrittenQty: 99, receiverWrittenAt: '2026-07-07 09:00:00', receiverWrittenBy: '仓库' })
  upsertPdaHandoutRecordMock({ recordId: 'REC-WRITTEN-DIFF', handoverRecordId: 'REC-WRITTEN-DIFF', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: source.taskId, sourceTaskId: source.taskId, sequenceNo: 9, submittedQty: 88, plannedQty: 88, qtyUnit: '件', factorySubmittedAt: '2026-07-07 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'WRITTEN_BACK_DIFF', receiverWrittenQty: 88, receiverWrittenAt: '2026-07-07 09:00:00', receiverWrittenBy: '仓库' })
  upsertPdaHandoutRecordMock({ recordId: 'REC-DIFF-ACCEPTED', handoverRecordId: 'REC-DIFF-ACCEPTED', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: source.taskId, sourceTaskId: source.taskId, sequenceNo: 10, submittedQty: 5, plannedQty: 5, qtyUnit: '件', factorySubmittedAt: '2026-07-07 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'DIFF_ACCEPTED', receiverWrittenQty: 5, receiverWrittenAt: '2026-07-07 09:00:00', receiverWrittenBy: '仓库' })
  upsertPdaHandoutRecordMock({ recordId: 'REC-WAIT', handoverRecordId: 'REC-WAIT', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: source.taskId, sourceTaskId: source.taskId, sequenceNo: 11, submittedQty: 77, plannedQty: 77, qtyUnit: '件', factorySubmittedAt: '2026-07-07 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'PENDING_WRITEBACK', handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK', receiverWrittenQty: 77, receiverWrittenAt: '2026-07-07 09:00:00', receiverWrittenBy: '残留字段' })
  upsertPdaHandoutRecordMock({ recordId: 'REC-VOIDED', handoverRecordId: 'REC-VOIDED', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: source.taskId, sourceTaskId: source.taskId, sequenceNo: 12, submittedQty: 66, plannedQty: 66, qtyUnit: '件', factorySubmittedAt: '2026-07-07 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'VOIDED', receiverWrittenQty: 66, receiverWrittenAt: '2026-07-07 09:00:00', receiverWrittenBy: '仓库' })
  assert.equal(sumSewingDeliveryConfirmedReceiptQty(source.taskId), 123, 'MATCHED、WRITTEN_BACK_DIFF、DIFF_ACCEPTED应计入；错挂、WAIT残留字段、VOIDED不得计入')
  const beforeFuture = captureRuntimeDirectDispatchState()
  assert.equal(reassignRuntimeSewingTask({ sourceTaskId: source.taskId, targetFactoryId: source.assignedFactoryId, targetFactoryName: source.assignedFactoryName!, businessAssignedAt: '2026-07-08 09:00:00', operatedAt: '2026-07-08 10:00:00', reason: '同厂测试', by: '跟单A' }).ok, false, '同工厂改派必须阻断')
  assert.deepEqual(captureRuntimeDirectDispatchState(), beforeFuture, '同工厂改派失败不得产生状态')
  assert.equal(reassignRuntimeSewingTask({ sourceTaskId: source.taskId, targetFactoryId: 'ID-F007', targetFactoryName: '玛琅精工车缝', businessAssignedAt: '2026-07-09 11:00:00', operatedAt: '2026-07-09 10:00:00', reason: '原工厂产能异常', by: '跟单A' }).ok, false)
  assert.deepEqual(captureRuntimeDirectDispatchState(), beforeFuture, '未来业务分配时间被拒绝后不得改变运行时状态')
  const slaBeforeMidFailure = captureSewingDeliverySlaSnapshotStore()
  assert.equal(reassignRuntimeSewingTask({ sourceTaskId: source.taskId, targetFactoryId: 'NO-SUCH-FACTORY', targetFactoryName: '不存在工厂', businessAssignedAt: '2026-07-08 09:00:00', operatedAt: '2026-07-08 10:00:00', reason: '中段回滚测试', by: '跟单A' }).ok, false)
  assert.deepEqual(captureRuntimeDirectDispatchState(), beforeFuture, '登记目标工厂中段失败必须回滚 runtime/newtask/audit/production order')
  assert.deepEqual(captureSewingDeliverySlaSnapshotStore(), slaBeforeMidFailure, '登记目标工厂中段失败必须回滚 SLA 仓')

  const result = reassignRuntimeSewingTask({
    sourceTaskId: source.taskId,
    targetFactoryId: 'ID-F007',
    targetFactoryName: '玛琅精工车缝',
    businessAssignedAt: '2026-07-08 09:00:00',
    operatedAt: '2026-07-08 10:00:00',
    reason: '原工厂产能异常',
    by: '跟单A',
    mainFactoryId: 'ID-F007',
  })
  assert.equal(result.ok, true, result.message)
  assert.equal(result.assignedQty, sourceSnapshot.assignedQty - 123, '改派数量只扣减接收方已确认实收')
  assert(result.taskId && result.assignmentId)
  assert.equal(getSewingDeliverySlaSnapshot(source.taskId), null, '旧任务不再保有 active 快照')
  const oldHistory = listSewingDeliverySlaSnapshotHistory(source.taskId)
  assert.equal(oldHistory.at(-1)?.active, false)
  assert.equal(oldHistory.at(-1)?.replacedByAssignmentId, result.assignmentId)
  const replacement = getSewingDeliverySlaSnapshot(result.taskId)
  assert.equal(replacement?.acceptedAt, '2026-07-08 09:00:00', '直接改派按业务分配时间自动接单并重启时钟')
  assert.equal(replacement?.assignedQty, result.assignedQty)
  assert.equal(getRuntimeTaskById(source.taskId)?.executionEnabled, false, '旧任务保留历史但退出有效执行')
  assert.equal(getRuntimeTaskById(result.taskId)?.assignedFactoryId, 'ID-F007')
  const resetTask = getRuntimeTaskById(result.taskId)!
  assert.equal(resetTask.status, 'NOT_STARTED')
  assert.equal(resetTask.startedAt, undefined)
  assert.equal(resetTask.finishedAt, undefined)
  assert.equal(resetTask.blockReason, undefined)
  assert.equal(resetTask.blockedAt, undefined)
  assert.equal(resetTask.milestoneReportedQty, undefined)
  assert.equal(resetTask.handoverStatus, 'NOT_CREATED')
  assert.notEqual(resetTask.taskQrValue, source.taskQrValue, '新任务不得继承旧task二维码')
  assert.equal(parseFcsQrValue(resetTask.taskQrValue ?? '').id, result.taskId, '新任务二维码必须解析到newTaskId')
  assert.equal(resetTask.taskQrStatus, 'ACTIVE')
  assert.deepEqual(getRuntimeTaskById(downstreamFixture.taskId)?.dependsOnTaskIds, [result.taskId, 'OTHER-UPSTREAM'], '下游依赖应将旧taskId替换为新taskId并去重保序')
  const remainingFactoryIds = listProductionOrderSewingFactories(source.productionOrderId).map((factory) => factory.id)
  excludedCandidates.forEach((candidate) => assert.equal(remainingFactoryIds.includes(candidate.factoryId), false, `${candidate.id} 不得保留为active承接候选`))
  const replacementAssignedQty = replacement?.assignedQty
  upsertPdaHandoutRecordMock({ recordId: 'REC-REASSIGN-LATE-10', handoverRecordId: 'REC-REASSIGN-LATE-10', handoverId: reassignmentHeadId, handoverOrderId: reassignmentHeadId, taskId: source.taskId, sourceTaskId: source.taskId, sequenceNo: 2, submittedQty: 10, plannedQty: 10, qtyUnit: '件', factorySubmittedAt: '2026-07-08 11:00:00', factorySubmittedBy: '原工厂操作员', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'WRITTEN_BACK_MATCHED', receiverWrittenQty: 10, receiverWrittenAt: '2026-07-08 12:00:00', receiverWrittenBy: '仓库收货员' })
  assert.equal(getSewingDeliverySlaSnapshot(result.taskId)?.assignedQty, replacementAssignedQty, '原任务改派后新增实收不得污染新快照分配量')
  assert.equal(sumSewingDeliveryConfirmedReceiptQty(result.taskId), 0, '原任务后续实收不得计入新 taskId')
  assert.equal(reassignRuntimeSewingTask({ sourceTaskId: source.taskId, targetFactoryId: 'ID-F007', targetFactoryName: '玛琅精工车缝', businessAssignedAt: '2026-07-08 09:00:00', operatedAt: '2026-07-08 10:00:00', reason: '重复', by: '跟单A' }).ok, false, '旧任务不得重复改派')
} finally {
  try { restorePdaHandoverState(reassignmentHandoverState) } finally {
    restoreRuntimeDirectDispatchState(reassignmentRuntimeState)
    restoreSewingDeliverySlaSnapshotStore(reassignmentSlaState)
  }
}

const progressExceptionEventsSource = readFileSync('src/pages/progress-exceptions/events.ts', 'utf8')
assert.match(progressExceptionEventsSource, /task\?\.taskUnitType === 'COMBINED_PROCESS_TASK'/, '异常页应按任务单元类型分流连续/独立改派入口')
assert.match(progressExceptionEventsSource, /\/fcs\/dispatch\/continuous\?taskId=/, '连续任务异常应跳转连续工序分配页')
assert.match(progressExceptionEventsSource, /action=reassign/, '异常页改派链接应携带明确动作')
const continuousReassignmentSource = readFileSync('src/pages/continuous-dispatch.ts', 'utf8')
assert.match(continuousReassignmentSource, /openContinuousReassignmentDialog/, '连续工序页应读取查询并自动打开改派弹窗')
assert.match(continuousReassignmentSource, /reassignRuntimeSewingTask\(/, '连续工序页确认改派必须调用真实运行时领域函数')
assert.match(continuousReassignmentSource, /mainFactoryId: dialog\.mainFactoryId \|\| undefined/, '连续工序改派 handler 必须提交页面选择的主工厂')
const sewingWorkbenchReassignmentSource = readFileSync('src/pages/sewing-dispatch-workbench.ts', 'utf8')
assert.match(sewingWorkbenchReassignmentSource, /query\.get\('action'\) === 'reassign'/, '独立车缝工作台应读取查询并自动打开改派弹窗')
assert.match(sewingWorkbenchReassignmentSource, /reassignRuntimeSewingTask\(/, '独立车缝工作台确认改派必须调用统一编排函数')
assert.match(sewingWorkbenchReassignmentSource, /mainFactoryId: state\.reassignMainFactoryId \|\| undefined/, '独立车缝改派 handler 必须提交页面选择的主工厂')
assert.equal((sewingWorkbenchReassignmentSource.match(/data-skip-page-rerender="true" data-sewing-dispatch-field="reassign/g) ?? []).length, 4, '独立页改派四个高频字段必须跳过整页重绘以保留输入焦点')
assert.doesNotMatch(sewingWorkbenchReassignmentSource, /preventDefault\(\)/, '改派字段与点击 handler 不得阻断原生输入/焦点行为')
assert.match(sewingWorkbenchReassignmentSource, /refreshSewingReassignmentDialog\(\)/, '改派失败只局部刷新弹窗错误区')
const runtimeProcessTaskSource = readFileSync('src/data/fcs/runtime-process-tasks.ts', 'utf8')
assert.match(runtimeProcessTaskSource, /export function reassignRuntimeSewingTask/, 'runtime 只公开统一改派入口')
assert.doesNotMatch(`${continuousReassignmentSource}\n${sewingWorkbenchReassignmentSource}`, /confirmedReceivedQty/, '页面不得传入可伪造的确认实收数量')
const reassignmentWrapperSource = readFileSync('src/data/fcs/runtime-sewing-reassignment.ts', 'utf8')
const runtimeReadBridgeSource = readFileSync('src/data/fcs/runtime-task-read-bridge.ts', 'utf8')
assert.match(reassignmentWrapperSource, /export \{ reassignRuntimeSewingTask \} from '.\/runtime-process-tasks\.ts'/, '兼容模块只允许重导出统一改派入口')
assert.match(runtimeProcessTaskSource, /installRuntimeTaskReadResolver/, '仅 runtime 模块安装只读任务解析器')
assert.match(runtimeReadBridgeSource, /运行时任务只读解析器已安装，不可重复覆盖/, '只读解析器必须拒绝不同实现覆盖')
assert.doesNotMatch(`${continuousReassignmentSource}\n${sewingWorkbenchReassignmentSource}`, /installRuntimeTaskReadResolver|readRuntimeTaskById/, '业务页面不得接触只读桥')
assert.equal((readRuntimeTaskById<{ taskId: string }>('TASKGEN-202603-0015-001__ORDER'))?.taskId, 'TASKGEN-202603-0015-001__ORDER', 'runtime初始化后只读桥应返回真实任务')
assert.throws(() => installRuntimeTaskReadResolver(() => null), /不可重复覆盖/, '只读桥不得被不同resolver重装')

const mainFactoryRuntimeState = captureRuntimeDirectDispatchState()
try {
  const orderId = getRuntimeTaskById('TASKGEN-202603-0015-001__ORDER')!.productionOrderId
  for (const [factoryId, factoryName] of [['ID-F003', '万隆车缝厂'], ['ID-F007', '玛琅精工车缝'], ['ID-F024', '三宝垄微型车缝厂']] as const) {
    assert(registerProductionOrderSewingFactory({ productionOrderId: orderId, factoryId, factoryName, by: '测试员', at: '2026-07-08 10:00:00' }))
  }
  assert(selectProductionOrderMainFactory({ productionOrderId: orderId, factoryId: 'ID-F003', reason: '改派前主工厂', by: '测试员', at: '2026-07-08 10:00:00' }))
  const beforeMultiMissing = structuredClone(productionOrders.find((order) => order.productionOrderId === orderId))
  assert.equal(withdrawProductionOrderSewingFactory({ productionOrderId: orderId, factoryId: 'ID-F003', remainingActiveFactoryIds: ['ID-F007', 'ID-F024'], reason: '产能异常', by: '测试员', at: '2026-07-08 11:00:00' }), null, '原主工厂失效且仍有多候选时必须显式选择')
  assert.deepEqual(productionOrders.find((order) => order.productionOrderId === orderId), beforeMultiMissing, '多候选未选择时不得产生半状态')
  assert.equal(withdrawProductionOrderSewingFactory({ productionOrderId: orderId, factoryId: 'ID-F003', remainingActiveFactoryIds: ['ID-F007'], reason: '产能异常', by: '测试员', at: '2026-07-08 11:00:00' })?.mainFactoryId, 'ID-F007', '仅剩一家候选时应自动切换主工厂')
  const switchedOrder = productionOrders.find((order) => order.productionOrderId === orderId)!
  assert.equal(switchedOrder.mainFactorySource, 'SEWING_TASK_ASSIGNMENT')
  assert.equal(switchedOrder.mainFactoryConfirmedAt, '2026-07-08 11:00:00')
  assert.equal(switchedOrder.mainFactoryConfirmedBy, '测试员')
  assert.equal(switchedOrder.ownerReason, '产能异常')
  assert.match(switchedOrder.auditLogs.at(-1)?.detail ?? '', /（ID-F003） → .+（ID-F007）/)
  const pendingOrder = withdrawProductionOrderSewingFactory({ productionOrderId: orderId, factoryId: 'ID-F007', remainingActiveFactoryIds: [], reason: '再次改派', by: '测试员', at: '2026-07-08 12:00:00' })
  assert.equal(pendingOrder?.mainFactoryStatus, 'PENDING_SEWING_ASSIGNMENT', '没有候选时主工厂应回到待确认')
  assert.equal(pendingOrder?.mainFactoryConfirmedAt, undefined)
  assert.equal(pendingOrder?.mainFactoryConfirmedBy, undefined)
  assert.match(pendingOrder?.ownerReason ?? '', /暂无有效承接工厂/)
  assert.match(pendingOrder?.auditLogs.at(-1)?.detail ?? '', /（ID-F007） → 待确认/)
} finally {
  restoreRuntimeDirectDispatchState(mainFactoryRuntimeState)
}

const independentHandlerRuntimeState = captureRuntimeDirectDispatchState()
const independentHandlerSlaState = captureSewingDeliverySlaSnapshotStore()
const independentHandlerPageState = captureSewingDispatchWorkbenchPageState()
const independentHandlerOriginalWindow = globalThis.window
try {
  const handlerSource = getRuntimeTaskById('TASKGEN-202603-083-002__ORDER')!
  clearSewingDeliverySlaSnapshotStore(handlerSource.taskId)
  assert(applyRuntimeDirectDispatchMeta({ taskId: handlerSource.taskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', acceptDeadline: '', taskDeadline: '', remark: 'handler测试', by: '跟单A', dispatchPrice: 12000, dispatchPriceCurrency: 'IDR', dispatchPriceUnit: '件', priceDiffReason: '', businessAssignedAt: '2026-07-01 08:00:00', operatedAt: '2026-07-01 10:00:00' }))
  const handlerTargetFactory = listSewingFactoryOptions().find((factory) => factory.id !== 'ID-F003')
  assert(handlerTargetFactory, '独立页 handler 测试需要另一个可选车缝工厂')
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { location: { search: `?taskId=${handlerSource.taskId}&po=${handlerSource.productionOrderId}&action=reassign` } } })
  restoreSewingDispatchWorkbenchPageState({ ...independentHandlerPageState, reassignQueryHandled: false })
  renderSewingDispatchWorkbenchPage()
  assert.equal(captureSewingDispatchWorkbenchPageState().reassignTaskId, handlerSource.taskId, '独立页应从 query 自动定位任务并打开改派弹窗')
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: independentHandlerOriginalWindow })
  restoreSewingDispatchWorkbenchPageState({ ...independentHandlerPageState, reassignTaskId: handlerSource.taskId, reassignFactoryId: handlerTargetFactory.id, reassignBusinessAssignedAt: '2026-07-08T09:00', reassignOperatedAt: '2026-07-08 10:00:00', reassignReason: '页面改派测试', reassignError: '', reassignMainFactoryId: handlerTargetFactory.id, reassignQueryHandled: true })
  const actionTarget = (action: string) => ({ closest: (selector: string) => selector.includes('[data-sewing-dispatch-action]') ? { dataset: { sewingDispatchAction: action } } : null }) as unknown as HTMLElement
  assert.equal(handleSewingDispatchWorkbenchEvent(actionTarget('confirm-reassign')), true)
  const independentAfterSuccess = captureSewingDispatchWorkbenchPageState()
  assert.equal(independentAfterSuccess.reassignTaskId, null, `独立页 handler 成功后应局部关闭改派弹窗：${independentAfterSuccess.reassignError}`)
  assert.match(independentAfterSuccess.feedbackMessage, /已改派给/)
  assert(listRuntimeProcessTasks().some((task) => task.taskId.startsWith(`${handlerSource.taskId}__R`) && task.assignedFactoryId === handlerTargetFactory.id))

  const failedRuntimeState = captureRuntimeDirectDispatchState()
  restoreSewingDispatchWorkbenchPageState({ ...independentHandlerPageState, reassignTaskId: handlerSource.taskId, reassignFactoryId: 'ID-F003', reassignBusinessAssignedAt: '2026-07-08T09:00', reassignOperatedAt: '2026-07-08 10:00:00', reassignReason: '失败测试', reassignError: '', reassignMainFactoryId: 'ID-F003', reassignQueryHandled: true })
  assert.equal(handleSewingDispatchWorkbenchEvent(actionTarget('confirm-reassign')), true)
  assert(captureSewingDispatchWorkbenchPageState().reassignError, '独立页 handler 失败后应在弹窗内保留错误')
  const failedRuntimeAfter = captureRuntimeDirectDispatchState()
  assert.deepEqual({ ...failedRuntimeAfter, auditSeq: failedRuntimeState.auditSeq }, failedRuntimeState, '独立页 handler 失败不得改变任务、新任务、审计日志或生产单状态')
} finally {
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: independentHandlerOriginalWindow })
  restoreSewingDispatchWorkbenchPageState(independentHandlerPageState)
  restoreRuntimeDirectDispatchState(independentHandlerRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(independentHandlerSlaState)
}

const continuousHandlerRuntimeState = captureRuntimeDirectDispatchState()
const continuousHandlerSlaState = captureSewingDeliverySlaSnapshotStore()
const continuousHandlerPageState = captureContinuousDispatchPageState()
const continuousHandlerOriginalWindow = globalThis.window
try {
  const fixtureRuntimeState = captureRuntimeDirectDispatchState()
  const continuousBase = listRuntimeProcessTasks().find((task) => classifySewingDeliverySla(task) === 'INDEPENDENT_SEWING')!
  const continuousSeed = { ...structuredClone(continuousBase), taskId: 'TEST-CONTINUOUS-SEW-POST', taskNo: 'TEST-CONTINUOUS-SEW-POST', taskUnitType: 'COMBINED_PROCESS_TASK' as const, acceptanceMode: 'CONTINUOUS_PROCESS' as const, processCode: 'POST', processNameZh: '车缝到包装', coveredProcesses: [coveredProcess('SEW', '车缝'), coveredProcess('POST', '包装')], assignmentStatus: 'UNASSIGNED' as const, assignedFactoryId: undefined, assignedFactoryName: undefined, tenderId: undefined, acceptanceStatus: 'PENDING' as const, deliverySlaSnapshotId: undefined, executionEnabled: true }
  fixtureRuntimeState.reassignedTasks.push([continuousSeed.taskId, continuousSeed])
  restoreRuntimeDirectDispatchState(fixtureRuntimeState)
  assert(applyRuntimeDirectDispatchMeta({ taskId: continuousSeed.taskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', acceptDeadline: '', taskDeadline: '', remark: '连续handler测试', by: '生产计划员', dispatchPrice: continuousSeed.standardPrice ?? 12000, dispatchPriceCurrency: continuousSeed.standardPriceCurrency ?? 'IDR', dispatchPriceUnit: continuousSeed.standardPriceUnit ?? continuousSeed.qtyUnit, priceDiffReason: '', businessAssignedAt: '2026-07-01 08:00:00', operatedAt: '2026-07-01 10:00:00' }))
  const continuousSource = getRuntimeTaskById(continuousSeed.taskId)!
  const continuousTargetFactory = listBusinessFactoryMasterRecords({ includeTestFactories: false }).find((factory) => factory.id !== continuousSource.assignedFactoryId)
  assert(continuousTargetFactory, '连续页 handler 测试需要另一个可选工厂')
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { location: { search: `?taskId=${continuousSource.taskId}&po=${continuousSource.productionOrderId}&action=reassign` } } })
  restoreContinuousDispatchPageState({ ...continuousHandlerPageState, dialog: null })
  renderContinuousDispatchPage()
  assert.equal(captureContinuousDispatchPageState().dialog?.taskId, continuousSource.taskId, '连续页应从 query 自动定位任务并打开改派弹窗')
  const handledQueryKey = captureContinuousDispatchPageState().handledReassignmentQueryKey
  closeContinuousDispatchDialog()
  renderContinuousDispatchPage()
  assert.equal(captureContinuousDispatchPageState().dialog, null, '连续页关闭后再次 render 不得因同一 query 重开')
  restoreContinuousDispatchPageState({ ...continuousHandlerPageState, handledReassignmentQueryKey: handledQueryKey, dialog: { mode: 'REASSIGN', taskId: continuousSource.taskId, factoryId: continuousTargetFactory.id, businessAssignedAt: '2026-07-08T09:00', operatedAt: '2026-07-08 10:00:00', biddingDeadline: '', mainFactoryChoice: 'SELECTED', error: '', reason: '连续页面改派测试', mainFactoryId: continuousTargetFactory.id } })
  assert.equal(handleContinuousDispatchEvent(continuousActionTarget('confirm-dialog', continuousSource.taskId)), true)
  assert.equal(captureContinuousDispatchPageState().dialog, null, '连续页 handler 成功后应局部关闭改派弹窗')
  assert.match(captureContinuousDispatchPageState().feedback, /已改派给/)
  assert(listRuntimeProcessTasks().some((task) => task.taskId.startsWith(`${continuousSource.taskId}__R`) && task.assignedFactoryId === continuousTargetFactory.id))
  renderContinuousDispatchPage()
  assert.equal(captureContinuousDispatchPageState().dialog, null, '连续页改派成功后再次 render 不得重开已消费 query')
} finally {
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: continuousHandlerOriginalWindow })
  restoreContinuousDispatchPageState(continuousHandlerPageState)
  restoreRuntimeDirectDispatchState(continuousHandlerRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(continuousHandlerSlaState)
}

const completedReassignRuntimeState = captureRuntimeDirectDispatchState()
const completedReassignSlaState = captureSewingDeliverySlaSnapshotStore()
const completedReassignHandoverState = capturePdaHandoverState()
try {
  const base = listRuntimeProcessTasks().find((task) => classifySewingDeliverySla(task) === 'INDEPENDENT_SEWING')!
  const completedTask = { ...structuredClone(base), taskId: 'TEST-SEWING-OVER-RECEIVED', taskNo: 'TEST-SEWING-OVER-RECEIVED', scopeQty: 10, assignedFactoryId: 'ID-F003', assignedFactoryName: '万隆车缝厂', assignmentStatus: 'ASSIGNED' as const, acceptanceStatus: 'ACCEPTED' as const, executionEnabled: true }
  const fixture = captureRuntimeDirectDispatchState()
  fixture.reassignedTasks.push([completedTask.taskId, completedTask])
  restoreRuntimeDirectDispatchState(fixture)
  saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({ assignmentId: 'OVER-RECEIVED', runtimeTaskId: completedTask.taskId, productionOrderId: completedTask.productionOrderId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', assignedQty: 10, acceptedAt: '2026-07-01 08:00:00', slaKind: 'INDEPENDENT_SEWING' }))
  upsertPdaHandoverHeadMock({ handoverId: 'HEAD-OVER-RECEIVED', handoverOrderId: 'HEAD-OVER-RECEIVED', handoverOrderNo: 'HDO-OVER', headType: 'HANDOUT', qrCodeValue: 'QR', taskId: completedTask.taskId, taskNo: completedTask.taskNo!, productionOrderNo: completedTask.productionOrderId, processName: completedTask.processNameZh, sourceFactoryName: '万隆车缝厂', sourceFactoryId: 'ID-F003', targetName: '成衣仓', targetKind: 'WAREHOUSE', receiverKind: 'WAREHOUSE', receiverId: 'WH', receiverName: '成衣仓', qtyUnit: '件', factoryId: 'ID-F003', taskStatus: 'IN_PROGRESS', summaryStatus: 'WRITTEN_BACK', recordCount: 1, pendingWritebackCount: 0, submittedQtyTotal: 12, writtenBackQtyTotal: 12, objectionCount: 0, plannedQty: 10, completionStatus: 'COMPLETED', qtyExpectedTotal: 10, qtyActualTotal: 12, qtyDiffTotal: 2 })
  upsertPdaHandoutRecordMock({ recordId: 'REC-OVER-12', handoverRecordId: 'REC-OVER-12', handoverId: 'HEAD-OVER-RECEIVED', handoverOrderId: 'HEAD-OVER-RECEIVED', taskId: completedTask.taskId, sourceTaskId: completedTask.taskId, sequenceNo: 1, submittedQty: 12, plannedQty: 12, qtyUnit: '件', factorySubmittedAt: '2026-07-02 08:00:00', factorySubmittedBy: '工厂', factoryProofFiles: [], status: 'WRITTEN_BACK', handoverRecordStatus: 'WRITTEN_BACK_MATCHED', receiverWrittenQty: 12, receiverWrittenAt: '2026-07-02 09:00:00', receiverWrittenBy: '仓库' })
  const beforeCompletedReassign = captureRuntimeDirectDispatchState()
  const completedResult = reassignRuntimeSewingTask({ sourceTaskId: completedTask.taskId, targetFactoryId: 'ID-F007', targetFactoryName: '目标工厂', businessAssignedAt: '2026-07-08 09:00:00', operatedAt: '2026-07-08 10:00:00', reason: '超收后改派测试', by: '跟单A' })
  assert.equal(completedResult.ok, false)
  assert.match(completedResult.message, /已全部实收/)
  assert.deepEqual(captureRuntimeDirectDispatchState(), beforeCompletedReassign, '超收导致剩余0时不得创建新任务或改变状态')
} finally {
  restorePdaHandoverState(completedReassignHandoverState)
  restoreRuntimeDirectDispatchState(completedReassignRuntimeState)
  restoreSewingDeliverySlaSnapshotStore(completedReassignSlaState)
}

for (const executionStatus of ['IN_PROGRESS', 'BLOCKED', 'DONE'] as const) {
  const statusRuntimeState = captureRuntimeDirectDispatchState()
  const statusSlaState = captureSewingDeliverySlaSnapshotStore()
  try {
    const base = listRuntimeProcessTasks().find((task) => classifySewingDeliverySla(task) === 'INDEPENDENT_SEWING')!
    const taskId = `TEST-REASSIGN-RESET-${executionStatus}`
    const fixture = captureRuntimeDirectDispatchState()
    fixture.reassignedTasks.push([taskId, { ...structuredClone(base), taskId, taskNo: taskId, status: executionStatus, assignedFactoryId: 'ID-F003', assignedFactoryName: '万隆车缝厂', assignmentStatus: 'ASSIGNED', acceptanceStatus: 'ACCEPTED', executionEnabled: true, startedAt: '2026-07-02 08:00:00', finishedAt: '2026-07-03 18:00:00', blockReason: 'MATERIAL', blockedAt: '2026-07-02 12:00:00', milestoneReportedQty: 9, handoverStatus: 'COMPLETED' }])
    restoreRuntimeDirectDispatchState(fixture)
    saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({ assignmentId: `RESET-${executionStatus}`, runtimeTaskId: taskId, productionOrderId: base.productionOrderId, factoryId: 'ID-F003', factoryName: '万隆车缝厂', assignedQty: base.scopeQty, acceptedAt: '2026-07-01 08:00:00', slaKind: 'INDEPENDENT_SEWING' }))
    const result = reassignRuntimeSewingTask({ sourceTaskId: taskId, targetFactoryId: 'ID-F007', targetFactoryName: '目标工厂', businessAssignedAt: '2026-07-08 09:00:00', operatedAt: '2026-07-08 10:00:00', reason: `${executionStatus}重置测试`, by: '跟单A', mainFactoryId: 'ID-F007' })
    assert.equal(result.ok, true, result.message)
    const reset = getRuntimeTaskById(result.taskId!)!
    assert.equal(reset.status, 'NOT_STARTED', `${executionStatus}克隆改派后必须回未开工`)
    assert.equal(reset.startedAt, undefined)
    assert.equal(reset.finishedAt, undefined)
    assert.equal(reset.blockReason, undefined)
    assert.equal(reset.blockedAt, undefined)
    assert.equal(reset.milestoneReportedQty, undefined)
    assert.equal(reset.handoverStatus, 'NOT_CREATED')
  } finally {
    restoreRuntimeDirectDispatchState(statusRuntimeState)
    restoreSewingDeliverySlaSnapshotStore(statusSlaState)
  }
}

console.log('含车缝任务交付与回货时效规则检查通过')
