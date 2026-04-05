import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const taskWithSpreadingStep = listPdaCuttingTaskSourceRecords()
  .flatMap((record) =>
    record.executionOrderIds.map((executionOrderId, index) => ({
      taskId: record.taskId,
      executionOrderId,
      executionOrderNo: record.executionOrderNos[index] || executionOrderId,
      detail: getPdaCuttingTaskSnapshot(record.taskId, executionOrderId),
    })),
  )
  .find((item) =>
    item.detail?.cutPieceOrders.some(
      (line) => line.executionOrderId === item.executionOrderId && line.currentStepCode === 'SPREADING',
    ),
  )

test.skip(!taskWithSpreadingStep, '缺少当前步骤为铺布的 PDA 任务')

test('PDA 裁片任务详情主流程进入执行单元，不再把铺布录入作为直接主按钮', async ({ page }) => {
  const errors = collectPageErrors(page)
  const task = taskWithSpreadingStep!
  const targetLine = task.detail?.cutPieceOrders.find((line) => line.executionOrderId === task.executionOrderId) || null

  await page.goto(
    `/fcs/pda/cutting/task/${task.taskId}?executionOrderId=${encodeURIComponent(task.executionOrderId)}&executionOrderNo=${encodeURIComponent(task.executionOrderNo)}`,
  )

  const orderCard = page.locator(`[data-pda-cutting-order-card-id="${task.executionOrderId}"]`)
  await expect(orderCard).toBeVisible()
  await expect(orderCard.getByRole('button', { name: '进入执行单元' })).toBeVisible()
  await expect(orderCard.getByRole('button', { name: '继续处理' })).toHaveCount(0)
  await expect(orderCard).toContainText('当前步骤')
  await expect(orderCard).toContainText('铺布')
  if (targetLine?.nextActionLabel && targetLine.nextActionLabel !== '进入执行单元') {
    await expect(orderCard.getByRole('button', { name: targetLine.nextActionLabel })).toHaveCount(0)
  }

  await orderCard.getByRole('button', { name: '进入执行单元' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/unit/${task.taskId}/${task.executionOrderId}`))
  await expect(page.locator('h1', { hasText: '当前任务' })).toBeVisible()

  await expectNoPageErrors(errors)
})
