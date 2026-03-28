import {
  listPdaCuttingTaskScenarios,
} from '../src/data/fcs/cutting/pda-cutting-task-scenarios.ts'
import {
  listPdaGenericProcessTasks,
} from '../src/data/fcs/pda-task-mock-factory.ts'
import type { ProcessTask } from '../src/data/fcs/process-tasks.ts'
import {
  filterReceivePendingAcceptTasks,
} from '../src/data/fcs/pda-receive-scope.ts'

function fail(message: string): never {
  throw new Error(`[check-pda-receive-mock-deadline-status] ${message}`)
}

function buildCuttingReceiveTaskFacts(): ProcessTask[] {
  return listPdaCuttingTaskScenarios().map((scenario, index) => ({
    taskId: scenario.taskId,
    taskNo: scenario.taskNo,
    productionOrderId: scenario.productionOrderId,
    seq: index + 1,
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    stage: 'CUTTING',
    qty: scenario.qty,
    qtyUnit: 'PIECE',
    assignmentMode: scenario.origin.startsWith('BIDDING') ? 'BIDDING' : 'DIRECT',
    assignmentStatus:
      scenario.origin === 'BIDDING_PENDING' || scenario.origin === 'BIDDING_QUOTED'
        ? 'BIDDING'
        : scenario.origin === 'BIDDING_AWARDED'
          ? 'AWARDED'
          : 'ASSIGNED',
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: scenario.assignedFactoryId,
    assignedFactoryName: scenario.assignedFactoryName,
    tenderId: scenario.tenderId,
    qcPoints: [],
    attachments: [],
    status: scenario.taskStatus,
    acceptDeadline: scenario.acceptDeadline,
    taskDeadline: scenario.taskDeadline,
    dispatchRemark: scenario.dispatchRemark,
    dispatchedAt: scenario.dispatchedAt,
    dispatchedBy: scenario.dispatchedBy,
    standardPrice: scenario.standardPrice,
    standardPriceCurrency: scenario.currency,
    standardPriceUnit: scenario.unit,
    dispatchPrice: scenario.dispatchPrice,
    dispatchPriceCurrency: scenario.currency,
    dispatchPriceUnit: scenario.unit,
    priceDiffReason: scenario.priceDiffReason,
    acceptanceStatus: scenario.acceptanceStatus,
    acceptedAt: scenario.acceptedAt,
    awardedAt: scenario.notifiedAt,
    acceptedBy: scenario.acceptedBy,
    startedAt: scenario.startedAt,
    finishedAt: scenario.finishedAt,
    blockReason: scenario.blockReason,
    blockRemark: scenario.blockRemark,
    blockedAt: scenario.blockedAt,
    createdAt: scenario.dispatchedAt,
    updatedAt:
      scenario.finishedAt ||
      scenario.blockedAt ||
      scenario.startedAt ||
      scenario.acceptedAt ||
      scenario.dispatchedAt,
    auditLogs: [],
  }))
}

function getDeadlineLabel(deadline: string): string {
  if (!deadline) return '正常'
  const diff = new Date(deadline.replace(' ', 'T')).getTime() - Date.now()
  const hours = diff / 3600000
  if (diff < 0) return '接单逾期'
  if (hours < 4) return '即将逾期'
  return '正常'
}

const selectedFactoryId = 'ID-F001'
const pendingAcceptTasks = filterReceivePendingAcceptTasks(
  [...listPdaGenericProcessTasks(), ...buildCuttingReceiveTaskFacts()],
  selectedFactoryId,
)

if (!pendingAcceptTasks.length) {
  fail(`工厂 ${selectedFactoryId} 当前没有待接单任务，无法校验 mock 截止时间分布`)
}

const rows = pendingAcceptTasks.map((task) => ({
  taskId: task.taskId,
  processName: task.processNameZh,
  acceptDeadline: task.acceptDeadline || '-',
  deadlineLabel: getDeadlineLabel(task.acceptDeadline || ''),
}))

if (!rows.some((item) => item.deadlineLabel === '正常')) {
  fail('待接单任务中缺少“正常”状态 mock')
}

if (!rows.some((item) => item.deadlineLabel === '即将逾期')) {
  fail('待接单任务中缺少“即将逾期”状态 mock')
}

console.log('[check-pda-receive-mock-deadline-status] 待接单 mock 截止时间状态通过')
console.table(
  rows.map((item) => ({
    任务: item.taskId,
    工序: item.processName,
    接单截止: item.acceptDeadline,
    状态: item.deadlineLabel,
  })),
)
