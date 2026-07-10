import assert from 'node:assert/strict'
import {
  classifySewingDeliverySla,
  createSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
} from '../src/data/fcs/sewing-delivery-sla.ts'

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

assert.equal(snapshot.snapshotId, 'SEWING-DELIVERY-SLA-ASSIGN-1', '快照编号应绑定分配结果')
assert.equal(snapshot.active, true, '新建履约快照应处于生效状态')
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

console.log('含车缝任务交付与回货时效规则检查通过')
