import { getTaskProcessDisplayName } from '../src/data/fcs/page-adapters/task-execution-adapter.ts'
import {
  listPdaCuttingTaskScenarios,
} from '../src/data/fcs/cutting/pda-cutting-task-scenarios.ts'
import {
  listPdaGenericProcessTasks,
} from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
  listPdaAwardedTenderNoticesByFactoryId,
  listPdaBiddingTendersByFactoryId,
  listPdaQuotedTendersByFactoryId,
} from '../src/data/fcs/pda-mobile-mock.ts'
import type { ProcessTask } from '../src/data/fcs/process-tasks.ts'
import {
  PDA_RECEIVE_EXCLUDED_PROCESS_NAMES,
  createInitialPdaReceiveSubmittedTenderIds,
  filterReceiveActiveBiddingTenders,
  filterReceiveAwardedTaskFacts,
  filterReceivePendingAcceptTasks,
  filterReceiveQuotedTenders,
  isReceiveEligibleProcessName,
} from '../src/data/fcs/pda-receive-scope.ts'

function fail(message: string): never {
  throw new Error(`[check-pda-task-receive-scope] ${message}`)
}

function assertNoExcludedProcess(values: string[], label: string): void {
  values.forEach((value) => {
    if (!isReceiveEligibleProcessName(value)) {
      fail(`${label} 仍包含已冻结排除的工序：${value}`)
    }
  })
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
    updatedAt: scenario.finishedAt || scenario.blockedAt || scenario.startedAt || scenario.acceptedAt || scenario.dispatchedAt,
    auditLogs: [],
  }))
}

function getTaskFactById(taskFacts: ProcessTask[], taskId: string): ProcessTask | null {
  return taskFacts.find((task) => task.taskId === taskId) ?? null
}

const taskFacts = [
  ...listPdaGenericProcessTasks(),
  ...buildCuttingReceiveTaskFacts(),
]
const submittedTenderIds = createInitialPdaReceiveSubmittedTenderIds()
const factoryIds = Array.from(
  new Set([
    ...taskFacts.map((task) => task.assignedFactoryId).filter((factoryId): factoryId is string => Boolean(factoryId)),
    ...PDA_MOCK_BIDDING_TENDERS.map((item) => item.factoryId),
    ...PDA_MOCK_QUOTED_TENDERS.map((item) => item.factoryId),
  ]),
).sort()

if (factoryIds.length === 0) {
  fail('未识别到任何工厂维度，无法校验接单模块范围过滤')
}

const factorySummary = factoryIds.map((factoryId) => {
  const pendingAcceptTasks = filterReceivePendingAcceptTasks(taskFacts, factoryId)
  const activeBiddingTenders = filterReceiveActiveBiddingTenders(
    listPdaBiddingTendersByFactoryId(factoryId),
    submittedTenderIds,
    (taskId) => getTaskFactById(taskFacts, taskId),
  )
  const quotedTenders = filterReceiveQuotedTenders(
    listPdaQuotedTendersByFactoryId(factoryId),
    submittedTenderIds,
    (taskId) => getTaskFactById(taskFacts, taskId),
  )
  const awardedTasks = filterReceiveAwardedTaskFacts(taskFacts, factoryId)
    .filter((task) =>
      new Set(listPdaAwardedTenderNoticesByFactoryId(factoryId).map((item) => item.taskId)).has(task.taskId),
    )

  assertNoExcludedProcess(
    pendingAcceptTasks.map((task) => getTaskProcessDisplayName(task)),
    `${factoryId} 的待接单任务`,
  )
  assertNoExcludedProcess(
    activeBiddingTenders.map((item) => item.processName),
    `${factoryId} 的待报价招标单`,
  )
  assertNoExcludedProcess(
    quotedTenders.map((item) => item.processName),
    `${factoryId} 的已报价招标单`,
  )
  assertNoExcludedProcess(
    awardedTasks.map((task) => getTaskProcessDisplayName(task)),
    `${factoryId} 的已中标任务`,
  )

  const processOptions = Array.from(
    new Set(pendingAcceptTasks.map((task) => getTaskProcessDisplayName(task))),
  )
  assertNoExcludedProcess(processOptions, `${factoryId} 的接单页工序筛选项`)

  return {
    factoryId,
    pendingAccept: pendingAcceptTasks.length,
    pendingQuote: activeBiddingTenders.length,
    quoted: quotedTenders.length,
    awarded: awardedTasks.length,
    processOptions,
  }
})

const genericExecutionProcessNames = new Set(
  listPdaGenericProcessTasks()
    .filter((task) => task.acceptanceStatus === 'ACCEPTED')
    .map((task) => getTaskProcessDisplayName(task)),
)

PDA_RECEIVE_EXCLUDED_PROCESS_NAMES.forEach((processName) => {
  if (!genericExecutionProcessNames.has(processName)) {
    fail(`执行链已找不到 ${processName} 任务，说明接单范围过滤误伤了其他 PDA 模块`)
  }
})

console.log('[check-pda-task-receive-scope] 接单模块范围过滤通过')
console.table(
  factorySummary.map((item) => ({
    工厂: item.factoryId,
    待接单: item.pendingAccept,
    待报价: item.pendingQuote,
    已报价: item.quoted,
    已中标: item.awarded,
    工序筛选项: item.processOptions.join(' / ') || '-',
  })),
)
