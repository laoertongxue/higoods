import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const singleExecutionTask = listPdaCuttingTaskSourceRecords().find((record) => {
  if (record.executionOrderIds.length !== 1) return false
  const detail = getPdaCuttingTaskSnapshot(record.taskId, record.executionOrderIds[0])
  return Boolean(detail?.spreadingTargets.length)
})

const taskWithSpreadingCurrentStep = listPdaCuttingTaskSourceRecords()
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

test.skip(!singleExecutionTask, '缺少可直接进入铺布录入的 PDA 任务')
test.skip(!taskWithSpreadingCurrentStep, '缺少当前步骤为铺布的 PDA 任务')

test('PDA 铺布页支持记录类型与交接说明写回', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })
  const task = singleExecutionTask!
  const executionOrderId = task.executionOrderIds[0]
  const executionOrderNo = task.executionOrderNos[0]

  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(executionOrderId)}&executionOrderNo=${encodeURIComponent(executionOrderNo)}`,
  )

  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="enteredBy"]')).toHaveCount(0)
  await page.locator('[data-pda-cut-spreading-field="recordType"]').selectOption('中途交接')
  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption({ index: 1 })
  await page.locator('[data-pda-cut-spreading-field="handoverToAccountId"]').selectOption({ index: 1 })
  await page.locator('[data-pda-cut-spreading-field="handoverNote"]').fill('A 班交接给 B 班')
  await page.locator('[data-pda-cut-spreading-field="fabricRollNo"]').fill('ROLL-HANDOVER-01')
  await page.locator('[data-pda-cut-spreading-field="layerCount"]').fill('8')
  await page.locator('[data-pda-cut-spreading-field="actualLength"]').fill('42')
  await page.locator('[data-pda-cut-spreading-field="headLength"]').fill('0.8')
  await page.locator('[data-pda-cut-spreading-field="tailLength"]').fill('0.6')

  await page.getByRole('button', { name: '保存铺布记录' }).click()

  await expect(page.getByText('铺布记录已保存')).toBeVisible()
  await expect(page.getByText('换班：是')).toBeVisible()
  await expect(page.locator(`[data-pda-cut-spreading-root="${task.taskId}"]`).getByText('ID-F004_prod').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

test('PDA 裁片任务详情页主流程先进入执行单元，再显式进入铺布录入', async ({ page }) => {
  const errors = collectPageErrors(page)

  const task = taskWithSpreadingCurrentStep!
  await page.goto(
    `/fcs/pda/cutting/task/${task.taskId}?executionOrderId=${encodeURIComponent(task.executionOrderId)}&executionOrderNo=${encodeURIComponent(task.executionOrderNo)}`,
  )

  const orderCard = page.locator(`[data-pda-cutting-order-card-id="${task.executionOrderId}"]`)
  await expect(orderCard).toBeVisible()
  await orderCard.getByRole('button', { name: '进入执行单元' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/unit/${task.taskId}/${task.executionOrderId}\\?`))
  await expect(page.locator('h1', { hasText: '执行单元' })).toBeVisible()
  await page.locator('[data-pda-cutting-unit-step="SPREADING"]').click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/spreading/${task.taskId}\\?`))
  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()

  await expectNoPageErrors(errors)
})
