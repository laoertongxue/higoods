import { expect, test } from '@playwright/test'

import { hydratePdaExecutionWritebackStore } from '../src/data/fcs/cutting/pda-execution-writeback-ledger.ts'
import { listPdaCuttingTaskScenarios } from '../src/data/fcs/cutting/pda-cutting-task-scenarios.ts'
import {
  PDA_MOCK_AWARDED_TENDER_NOTICES,
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
} from '../src/data/fcs/pda-mobile-mock.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('裁片 PDA mock 覆盖矩阵满足数量、状态、execution 与写回库存下限', async () => {
  const scenarios = listPdaCuttingTaskScenarios()
  const executions = scenarios.flatMap((scenario) => scenario.executions)
  const acceptanceStatuses = new Set(scenarios.map((scenario) => scenario.acceptanceStatus).filter(Boolean))
  const taskStatuses = new Set(scenarios.map((scenario) => scenario.taskStatus))
  const ledger = hydratePdaExecutionWritebackStore()

  expect(scenarios.filter((scenario) => scenario.origin === 'DIRECT')).toHaveLength(11)
  expect(scenarios.filter((scenario) => scenario.origin === 'BIDDING_PENDING')).toHaveLength(5)
  expect(scenarios.filter((scenario) => scenario.origin === 'BIDDING_QUOTED')).toHaveLength(5)
  expect(scenarios.filter((scenario) => scenario.origin === 'BIDDING_AWARDED')).toHaveLength(6)

  expect(acceptanceStatuses.has('PENDING')).toBeTruthy()
  expect(acceptanceStatuses.has('ACCEPTED')).toBeTruthy()
  expect(acceptanceStatuses.has('REJECTED')).toBeTruthy()

  expect(taskStatuses.has('NOT_STARTED')).toBeTruthy()
  expect(taskStatuses.has('IN_PROGRESS')).toBeTruthy()
  expect(taskStatuses.has('BLOCKED')).toBeTruthy()
  expect(taskStatuses.has('DONE')).toBeTruthy()
  expect(taskStatuses.has('CANCELLED')).toBeTruthy()

  expect(executions.filter((execution) => execution.bindingState === 'UNBOUND')).toHaveLength(3)
  expect(scenarios.filter((scenario) => scenario.executions.length > 1)).toHaveLength(5)
  expect(executions.filter((execution) => Boolean(execution.mergeBatchNo))).toHaveLength(5)
  expect(executions.filter((execution) => Boolean(execution.spreadingPreset)).length).toBeGreaterThanOrEqual(5)

  expect(PDA_MOCK_BIDDING_TENDERS.filter((item) => item.processName === '裁片')).toHaveLength(5)
  expect(PDA_MOCK_QUOTED_TENDERS.filter((item) => item.processName === '裁片')).toHaveLength(5)
  expect(PDA_MOCK_AWARDED_TENDER_NOTICES.filter((item) => item.processName === '裁片')).toHaveLength(6)

  expect(ledger.pickupWritebacks.length).toBeGreaterThanOrEqual(4)
  expect(ledger.inboundWritebacks.length).toBeGreaterThanOrEqual(3)
  expect(ledger.handoverWritebacks.length).toBeGreaterThanOrEqual(3)
  expect(ledger.replenishmentFeedbackWritebacks.length).toBeGreaterThanOrEqual(4)
  expect(ledger.pickupWritebacks.some((item) => item.resultLabel.includes('领取成功'))).toBeTruthy()
  expect(ledger.pickupWritebacks.some((item) => item.resultLabel.includes('部分领取'))).toBeTruthy()
  expect(ledger.pickupWritebacks.some((item) => Boolean(item.claimDisputeNo))).toBeTruthy()
  expect(ledger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'SUBMITTED')).toBeTruthy()
  expect(ledger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'PENDING')).toBeTruthy()
  expect(ledger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'CLOSED')).toBeTruthy()
})

test('接单页与执行页能真实展示更丰富的裁片任务来源和状态分布', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('TASK-CUT-000087')
  await expect(page.locator('body')).toContainText('TASK-CUT-000096')

  await page.goto('/fcs/pda/task-receive?tab=pending-quote')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-201')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-202')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-204')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-205')

  await page.goto('/fcs/pda/task-receive?tab=quoted')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-017')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-018')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-019')
  await expect(page.locator('body')).toContainText('TASK-CUT-BID-020')

  await page.goto('/fcs/pda/task-receive?tab=awarded')
  await expect(page.locator('body')).toContainText('TASK-CUT-000098')
  await expect(page.locator('body')).toContainText('TASK-CUT-000099')
  await expect(page.locator('body')).toContainText('TASK-CUT-000100')
  await expect(page.locator('body')).toContainText('TASK-CUT-000101')
  await expect(page.locator('body')).toContainText('TASK-CUT-000102')
  await expect(page.locator('body')).toContainText('生产暂停')
  await expect(page.locator('body')).toContainText('已中止')

  await page.goto('/fcs/pda/exec?tab=NOT_STARTED')
  await expect(page.locator('body')).toContainText('TASK-CUT-000097')
  await expect(page.locator('body')).toContainText('TASK-CUT-000099')

  await page.goto('/fcs/pda/exec?tab=IN_PROGRESS')
  await expect(page.locator('body')).toContainText('TASK-CUT-000088')
  await expect(page.locator('body')).toContainText('TASK-CUT-000100')

  await page.goto('/fcs/pda/exec?tab=BLOCKED')
  await expect(page.locator('body')).toContainText('TASK-CUT-000090')
  await expect(page.locator('body')).toContainText('TASK-CUT-000095')
  await expect(page.locator('body')).toContainText('TASK-CUT-000101')

  await page.goto('/fcs/pda/exec?tab=DONE')
  await expect(page.locator('body')).toContainText('TASK-CUT-000089')
  await expect(page.locator('body')).toContainText('TASK-CUT-000102')

  await expectNoPageErrors(errors)
})

test('裁片任务详情页能展示多 execution、UNBOUND、merge batch 和写回后状态库存', async ({ page }) => {
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
