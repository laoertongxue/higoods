import { expect, test } from '@playwright/test'

import {
  buildCapacityBottleneckData,
  buildCapacityRiskData,
  filterCapacityRiskTaskRows,
} from '../src/data/fcs/capacity-calendar'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('任务工时风险页已切到标准工时主线并覆盖 6 类风险', async ({ page }) => {
  const errors = collectPageErrors(page)
  const riskData = buildCapacityRiskData()
  const visibleTaskRows = filterCapacityRiskTaskRows({
    rows: riskData.taskRows,
    windowDays: 30,
  })
  const getVisibleSample = (conclusion: typeof visibleTaskRows[number]['conclusion']) =>
    visibleTaskRows.find((row) => row.conclusion === conclusion)
  const mixedOrder = riskData.orderRows.find(
    (row) =>
      [row.allocatedStandardTime, row.frozenPendingStandardTime, row.unallocatedStandardTime, row.unscheduledStandardTime]
        .filter((value) => value > 0).length >= 2,
  )

  await page.goto('/fcs/capacity/risk')

  const riskPage = page.locator('[data-capacity-risk-page]')
  const riskTaskTable = page.locator('[data-capacity-risk-task-table]')
  const riskOrderTable = page.locator('[data-capacity-risk-order-table]')

  await expect(riskPage).toBeVisible()
  await expect(page.getByRole('heading', { name: '任务工时风险', exact: true })).toBeVisible()
  await expect(riskPage).toContainText('已冻结待确认')

  await page.locator('[data-capacity-filter="risk-window-days"]').selectOption('30')
  await expect(riskTaskTable).toBeVisible()

  for (const conclusion of ['CAPABLE', 'TIGHT', 'EXCEEDS_WINDOW', 'FROZEN_PENDING', 'UNALLOCATED', 'UNSCHEDULED'] as const) {
    const row = getVisibleSample(conclusion)
    expect(row, `缺少 ${conclusion} 风险样本`).toBeTruthy()
    await expect(riskTaskTable).toContainText(row!.taskId)
  }

  await expect(riskTaskTable).toContainText('当前工厂 / 当前承接对象')
  await expect(riskTaskTable).toContainText('窗口供给标准工时')
  await expect(riskTaskTable).toContainText('其他已冻结标准工时')
  await expect(riskTaskTable).toContainText('当前任务计入后剩余标准工时')

  await page.getByRole('button', { name: '生产单风险' }).click()
  await expect(riskOrderTable).toBeVisible()
  await expect(riskOrderTable).toContainText('已冻结待确认标准工时')
  await expect(riskOrderTable).toContainText('未落厂标准工时')
  await expect(riskOrderTable).toContainText('未排期标准工时')
  if (mixedOrder) {
    await expect(riskOrderTable).toContainText(mixedOrder.productionOrderId)
  }

  await expectNoPageErrors(errors)
})

test('工艺瓶颈与待分配页已切到工艺 / 日期 / 待分配未排期三条标准工时主线', async ({ page }) => {
  const errors = collectPageErrors(page)
  const bottleneckData = buildCapacityBottleneckData()
  const craftWithGap = bottleneckData.craftRows.find((row) => row.maxGapSam > 0)
  const craftWithFrozen = bottleneckData.craftRows.find((row) => row.windowFrozenSam > 0)
  const craftWithUnallocated = bottleneckData.craftRows.find((row) => row.unallocatedSam > 0)
  const dateWithGap = bottleneckData.dateRows.find((row) => row.overloadedFactoryCount > 0)
  const dateWithUnallocated = bottleneckData.dateRows.find((row) => row.unallocatedSam > 0)
  const frozenPendingTask = bottleneckData.unallocatedRows.find(
    (row) => row.assignmentStatusLabel === '已冻结待确认' && row.frozenFactoryCount > 0,
  )
  const unscheduledTask = bottleneckData.unscheduledRows[0]

  await page.goto('/fcs/capacity/bottleneck')

  const bottleneckPage = page.locator('[data-capacity-bottleneck-page]')
  const craftTable = page.locator('[data-bottleneck-craft-table]')
  const dateTable = page.locator('[data-bottleneck-date-table]')
  const unallocatedSection = page.getByTestId('bottleneck-unallocated-section')
  const unscheduledSection = page.getByTestId('bottleneck-unscheduled-section')

  await expect(bottleneckPage).toBeVisible()
  await expect(page.getByRole('heading', { name: '工艺瓶颈与待分配', exact: true })).toBeVisible()
  await expect(craftTable).toBeVisible()
  if (craftWithGap) {
    await expect(craftTable).toContainText(craftWithGap.craftName)
  }
  if (craftWithFrozen) {
    await expect(craftTable).toContainText(craftWithFrozen.craftName)
  }
  if (craftWithUnallocated) {
    await expect(craftTable).toContainText(craftWithUnallocated.craftName)
  }
  await expect(craftTable).toContainText('待分配标准工时')
  await expect(craftTable).toContainText('未排期标准工时')

  if (craftWithGap) {
    await page.locator(`[data-bottleneck-craft-row="${craftWithGap.rowKey}"] button`).click()
    await expect(page.locator('[data-bottleneck-craft-detail]')).toContainText(craftWithGap.craftName)
  }

  await page.getByRole('button', { name: '日期瓶颈榜' }).click()
  await expect(dateTable).toBeVisible()
  await expect(dateTable).toContainText('当日待分配标准工时')
  if (dateWithGap) {
    await expect(dateTable).toContainText(dateWithGap.date)
  }
  if (dateWithUnallocated) {
    await expect(dateTable).toContainText(dateWithUnallocated.date)
  }

  await page.getByRole('button', { name: '待分配 / 未排期' }).click()
  await expect(unallocatedSection).toBeVisible()
  await expect(unscheduledSection).toBeVisible()
  await expect(unallocatedSection).toContainText('待分配需求')
  await expect(unscheduledSection).toContainText('未排期需求')
  if (frozenPendingTask) {
    await expect(unallocatedSection).toContainText(frozenPendingTask.taskId)
    await expect(unallocatedSection).toContainText('已冻结待确认')
  }
  if (unscheduledTask) {
    await expect(unscheduledSection).toContainText(unscheduledTask.taskId)
  }

  await expectNoPageErrors(errors)
})
