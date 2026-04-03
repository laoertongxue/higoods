import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const singleExecutionTask = listPdaCuttingTaskSourceRecords().find((record) => record.executionOrderIds.length === 1)

test.skip(!singleExecutionTask, '缺少可直接进入铺布录入的 PDA 任务')

test('PDA 铺布页支持记录类型与交接说明写回', async ({ page }) => {
  const errors = collectPageErrors(page)
  const task = singleExecutionTask!
  const executionOrderId = task.executionOrderIds[0]
  const executionOrderNo = task.executionOrderNos[0]

  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(executionOrderId)}&executionOrderNo=${encodeURIComponent(executionOrderNo)}`,
  )

  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()
  await page.locator('[data-pda-cut-spreading-field="recordType"]').selectOption('中途交接')
  await page.locator('[data-pda-cut-spreading-field="spreadingMode"]').selectOption('HIGH_LOW')
  await page.locator('[data-pda-cut-spreading-field="handoverNote"]').fill('A 班交接给 B 班')
  await page.locator('[data-pda-cut-spreading-field="fabricRollNo"]').fill('ROLL-HANDOVER-01')

  await page.getByRole('button', { name: '保存铺布记录' }).click()

  await expect(page.getByText('铺布记录已保存')).toBeVisible()
  await expect(page.getByText('动作：中途交接')).toBeVisible()

  await expectNoPageErrors(errors)
})
