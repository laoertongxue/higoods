import { expect, test, type Page } from '@playwright/test'

import { hydratePdaExecutionWritebackStore } from '../src/data/fcs/cutting/pda-execution-writeback-ledger.ts'
import { listPdaCuttingTaskScenarios } from '../src/data/fcs/cutting/pda-cutting-task-scenarios.ts'
import {
  PDA_MOCK_AWARDED_TENDER_NOTICES,
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
} from '../src/data/fcs/pda-mobile-mock.ts'
import { listPdaGenericHandoverHeadSeeds, listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  PDA_MOBILE_PROCESS_DEFINITIONS,
  PDA_MOBILE_TASK_STAGE_MINIMUMS,
} from '../src/data/fcs/pda-task-scenario-matrix.ts'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const CUTTING_STATIC_HANDOVER_HEADS = [
  { handoverId: 'PKH-MOCK-CUT-089', factoryId: 'ID-F001', processName: '裁片', headType: 'PICKUP' },
  { handoverId: 'HOH-MOCK-CUT-094', factoryId: 'ID-F001', processName: '裁片', headType: 'DONE' },
  { handoverId: 'PKH-MOCK-CUT-020-F004', factoryId: 'ID-F004', processName: '裁片', headType: 'PICKUP' },
  { handoverId: 'HOH-MOCK-CUT-103-F004-OPEN', factoryId: 'ID-F004', processName: '裁片', headType: 'HANDOUT' },
  { handoverId: 'HOH-MOCK-CUT-103-F004-DONE', factoryId: 'ID-F004', processName: '裁片', headType: 'DONE' },
] as const

const genericHandoverHeadSeeds = listPdaGenericHandoverHeadSeeds()
const cuttingScenarios = listPdaCuttingTaskScenarios()
const tasks = [
  ...listPdaGenericProcessTasks(),
  ...cuttingScenarios.map((scenario) => ({
    processNameZh: '裁片',
    acceptanceStatus: scenario.acceptanceStatus,
    status: scenario.taskStatus,
    assignedFactoryId: scenario.assignedFactoryId,
  })),
]

function countReceiveStage(processName: string): number {
  return (
    tasks.filter(
      (task) =>
        task.processNameZh === processName &&
        (task.acceptanceStatus === 'PENDING' ||
          task.acceptanceStatus === 'REJECTED' ||
          (task.acceptanceStatus === 'ACCEPTED' && task.status === 'NOT_STARTED')),
    ).length +
    PDA_MOCK_BIDDING_TENDERS.filter((item) => item.processName === processName).length +
    PDA_MOCK_QUOTED_TENDERS.filter((item) => item.processName === processName).length +
    PDA_MOCK_AWARDED_TENDER_NOTICES.filter((item) => item.processName === processName).length
  )
}

function countExecStage(processName: string): number {
  return tasks.filter(
    (task) => task.processNameZh === processName && task.acceptanceStatus === 'ACCEPTED',
  ).length
}

function countHandoverStage(processName: string): number {
  return (
    genericHandoverHeadSeeds.filter((head) => head.processName === processName).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter((head) => head.processName === processName).length
  )
}

function countTodoStage(processName: string): number {
  return (
    tasks.filter(
      (task) =>
        task.processNameZh === processName &&
        (task.acceptanceStatus === 'PENDING' ||
          task.acceptanceStatus === 'REJECTED' ||
          task.status === 'BLOCKED'),
    ).length +
    genericHandoverHeadSeeds.filter(
      (head) => head.processName === processName && head.completionStatus === 'OPEN',
    ).length +
    CUTTING_STATIC_HANDOVER_HEADS.filter(
      (head) => head.processName === processName && head.headType !== 'DONE',
    ).length
  )
}

async function switchFactory(page: Page, factoryId: string): Promise<void> {
  await seedLocalStorage(page, { fcs_pda_factory_id: factoryId })
  await page.goto('/')
  await page.evaluate((value) => {
    window.localStorage.setItem('fcs_pda_factory_id', value)
  }, factoryId)
}

test('当前支持的每一种工序类型都覆盖待办、接单、执行、交接和关键状态', async () => {
  const supportedProcesses = PDA_MOBILE_PROCESS_DEFINITIONS.filter((item) => item.supportsTaskMatrix)
  const cuttingExecutions = cuttingScenarios.flatMap((scenario) => scenario.executions)
  const ledger = hydratePdaExecutionWritebackStore()

  expect(supportedProcesses.map((item) => item.processNameZh)).toEqual([
    '裁片',
    '车缝',
    '印花',
    '染色',
    '整烫',
    '包装',
    '质检',
    '后整理',
  ])

  supportedProcesses.forEach((processDef) => {
    const processName = processDef.processNameZh
    expect(countTodoStage(processName)).toBeGreaterThanOrEqual(PDA_MOBILE_TASK_STAGE_MINIMUMS.TODO)
    expect(countReceiveStage(processName)).toBeGreaterThanOrEqual(PDA_MOBILE_TASK_STAGE_MINIMUMS.RECEIVE)
    expect(countExecStage(processName)).toBeGreaterThanOrEqual(PDA_MOBILE_TASK_STAGE_MINIMUMS.EXEC)
    expect(countHandoverStage(processName)).toBeGreaterThanOrEqual(PDA_MOBILE_TASK_STAGE_MINIMUMS.HANDOVER)
  })

  const acceptanceStatuses = new Set(tasks.map((task) => task.acceptanceStatus).filter(Boolean))
  const taskStatuses = new Set(tasks.map((task) => task.status))
  expect(acceptanceStatuses.has('PENDING')).toBeTruthy()
  expect(acceptanceStatuses.has('ACCEPTED')).toBeTruthy()
  expect(acceptanceStatuses.has('REJECTED')).toBeTruthy()
  expect(taskStatuses.has('NOT_STARTED')).toBeTruthy()
  expect(taskStatuses.has('IN_PROGRESS')).toBeTruthy()
  expect(taskStatuses.has('BLOCKED')).toBeTruthy()
  expect(taskStatuses.has('DONE')).toBeTruthy()
  expect(taskStatuses.has('CANCELLED')).toBeTruthy()

  const ordinaryAccepted = tasks.filter(
    (task) => task.assignedFactoryId === 'ID-F001' && task.acceptanceStatus === 'ACCEPTED',
  )
  expect(ordinaryAccepted.filter((task) => task.processNameZh !== '裁片').length).toBeGreaterThan(
    ordinaryAccepted.filter((task) => task.processNameZh === '裁片').length,
  )
  expect(
    tasks
      .filter((task) => task.assignedFactoryId === 'ID-F002' && task.acceptanceStatus === 'ACCEPTED')
      .every((task) => task.processNameZh === '印花'),
  ).toBeTruthy()
  expect(
    tasks
      .filter((task) => task.assignedFactoryId === 'ID-F003' && task.acceptanceStatus === 'ACCEPTED')
      .every((task) => task.processNameZh === '染色'),
  ).toBeTruthy()
  expect(
    tasks
      .filter((task) => task.assignedFactoryId === 'ID-F004' && task.acceptanceStatus === 'ACCEPTED')
      .every((task) => task.processNameZh === '裁片'),
  ).toBeTruthy()

  expect(cuttingExecutions.some((execution) => execution.bindingState === 'UNBOUND')).toBeTruthy()
  expect(cuttingScenarios.some((scenario) => scenario.executions.length > 1)).toBeTruthy()
  expect(cuttingExecutions.some((execution) => Boolean(execution.mergeBatchNo))).toBeTruthy()
  expect(CUTTING_STATIC_HANDOVER_HEADS.filter((head) => head.factoryId === 'ID-F004')).toHaveLength(3)
  expect(ledger.pickupWritebacks.some((item) => item.resultLabel.includes('领取成功'))).toBeTruthy()
  expect(ledger.pickupWritebacks.some((item) => item.resultLabel.includes('部分领取'))).toBeTruthy()
  expect(ledger.pickupWritebacks.some((item) => Boolean(item.claimDisputeNo))).toBeTruthy()
  expect(ledger.inboundWritebacks.length).toBeGreaterThanOrEqual(3)
  expect(ledger.handoverWritebacks.length).toBeGreaterThanOrEqual(3)
  expect(ledger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'SUBMITTED')).toBeTruthy()
  expect(ledger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'PENDING')).toBeTruthy()
  expect(ledger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'CLOSED')).toBeTruthy()
})

test('待办与接单页在不同工厂下真实展示多工序任务分布', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/notify')
  await expect(page.getByRole('heading', { name: '待办', exact: true }).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('车缝')
  await expect(page.locator('body')).toContainText('整烫')
  await expect(page.locator('body')).toContainText('待交出')

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-SEW-000511')
  await expect(page.locator('body')).toContainText('TASK-IRON-000521')
  await expect(page.locator('body')).toContainText('TASK-PACK-000531')
  await expect(page.locator('body')).toContainText('TASK-QC-000541')
  await expect(page.locator('body')).toContainText('TASK-FIN-000551')

  await switchFactory(page, 'ID-F002')
  await page.goto('/fcs/pda/task-receive?tab=pending-quote')
  await expect(page.locator('body')).toContainText('印花')
  await expect(page.locator('body')).toContainText('TASK-PRINT-000711')

  await page.goto('/fcs/pda/task-receive?tab=awarded')
  await expect(page.locator('body')).toContainText('印花')
  await expect(page.locator('body')).toContainText('TASK-PRINT-000718')
  await expect(page.locator('body')).toContainText('生产暂停')

  await switchFactory(page, 'ID-F003')
  await page.goto('/fcs/pda/task-receive?tab=pending-quote')
  await expect(page.locator('body')).toContainText('染色')
  await expect(page.locator('body')).toContainText('TASK-DYE-000721')

  await page.goto('/fcs/pda/task-receive?tab=awarded')
  await expect(page.locator('body')).toContainText('染色')
  await expect(page.locator('body')).toContainText('TASK-DYE-000725')
  await expect(page.locator('body')).toContainText('待接单')

  await expectNoPageErrors(errors)
})

test('执行页与交接页在不同工厂下保持明显工序差异分布', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })

  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')
  await expect(page.getByRole('heading', { name: '执行', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('车缝')
  await expect(page.locator('body')).toContainText('整烫')
  await expect(page.locator('body')).toContainText('包装')

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.getByRole('heading', { name: '交接', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('车缝')
  await expect(page.locator('body')).toContainText('后整理')
  await expect(page.locator('body')).toContainText('裁片')

  await switchFactory(page, 'ID-F002')
  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')
  await expect(page.locator('body')).toContainText('印花')
  await expect(page.locator('body')).toContainText('TASK-PRINT-000717')

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.locator('body')).toContainText('印花')
  await expect(page.locator('body')).toContainText('PKH-MOCK-PRINT-415')

  await switchFactory(page, 'ID-F003')
  await page.goto('/fcs/pda/exec?tab=BLOCKED')
  await expect(page.locator('body')).toContainText('染色')
  await expect(page.locator('body')).toContainText('TASK-DYE-000728')

  await page.goto('/fcs/pda/handover?tab=done')
  await expect(page.locator('body')).toContainText('染色')
  await expect(page.locator('body')).toContainText('HOH-MOCK-DYE-420')

  await switchFactory(page, 'ID-F004')
  await page.goto('/fcs/pda/exec?tab=DONE')
  await expect(page.locator('body')).toContainText('裁片')
  await expect(page.locator('body')).toContainText('TASK-CUT-000103')

  await page.goto('/fcs/pda/handover?tab=pickup')
  await expect(page.locator('body')).toContainText('裁片')
  await expect(page.locator('body')).toContainText('PKH-MOCK-CUT-020-F004')
  await page.goto('/fcs/pda/handover?tab=handout')
  await expect(page.locator('body')).toContainText('裁片')
  await expect(page.locator('body')).toContainText('HOH-MOCK-CUT-103-F004-OPEN')
  await page.goto('/fcs/pda/handover?tab=done')
  await expect(page.locator('body')).toContainText('裁片')
  await expect(page.locator('body')).toContainText('HOH-MOCK-CUT-103-F004-DONE')

  await expectNoPageErrors(errors)
})

test('裁片任务详情仍能展示复杂 execution 与写回后状态', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/pda/cutting/task/TASK-CUT-000087?executionOrderNo=CPO-20260319-A')
  await expect(page.locator('[data-pda-cutting-order-card-id]')).toHaveCount(3)

  await page.goto('/fcs/pda/cutting/task/TASK-CUT-BID-201?executionOrderNo=CPO-20260322-M')
  await expect(page.locator('body')).toContainText('待绑定原始裁片单')
  await expect(page.locator('body')).toContainText('UNBOUND')

  await page.goto('/fcs/pda/cutting/task/TASK-CUT-000099?executionOrderNo=CPO-20260324-A1')
  await expect(page.locator('body')).toContainText('关联裁剪批次')
  await expect(page.locator('body')).toContainText('MB-260329-03')

  await page.goto('/fcs/pda/cutting/task/TASK-CUT-000095?executionOrderNo=CPO-20260319-I')
  await expect(page.locator('body')).toContainText('差异举证已提交')
  await expect(page.locator('body')).toContainText('已提交补料反馈')

  await page.goto('/fcs/pda/cutting/task/TASK-CUT-000089?executionOrderNo=CPO-20260319-C')
  await expect(page.locator('body')).toContainText('已入仓')
  await expect(page.locator('body')).toContainText('已交接')

  await expectNoPageErrors(errors)
})
