import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const directSpreadingTask = listPdaCuttingTaskSourceRecords().find((record) => {
  if (record.executionOrderIds.length !== 1) return false
  const detail = getPdaCuttingTaskSnapshot(record.taskId, record.executionOrderIds[0])
  return Boolean(detail?.spreadingTargets.length)
})

test.skip(!directSpreadingTask, '缺少可直接进入铺布录入的 PDA 任务')

test('PDA 铺布页按四步流录入并在保存后清空输入', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })
  await page.setViewportSize({ width: 360, height: 800 })

  const task = directSpreadingTask!
  const executionOrderId = task.executionOrderIds[0]
  const executionOrderNo = task.executionOrderNos[0]

  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(executionOrderId)}&executionOrderNo=${encodeURIComponent(executionOrderNo)}`,
  )

  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-latest-summary')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-object-summary')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-form-card')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-plan-summary')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-submit-bar')).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="enteredBy"]')).toHaveCount(0)
  await expect(page.locator(`[data-pda-cut-spreading-root="${task.taskId}"]`).getByText('ID-F004_prod').first()).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-plan-summary').locator('.text-muted-foreground').filter({ hasText: '当前排版项' }).first()).toBeVisible()

  const saveButton = page.getByRole('button', { name: '保存铺布记录' })
  await expect(saveButton).toBeVisible()

  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption({ index: 1 })
  await page.locator('[data-pda-cut-spreading-field="fabricRollNo"]').fill('ROLL-FLOW-01')
  await page.locator('[data-pda-cut-spreading-field="layerCount"]').fill('12')
  await page.locator('[data-pda-cut-spreading-field="actualLength"]').fill('48')
  await page.locator('[data-pda-cut-spreading-field="headLength"]').fill('0.5')
  await page.locator('[data-pda-cut-spreading-field="tailLength"]').fill('0.5')
  await page.locator('[data-pda-cut-spreading-field="note"]').fill('首卷正常')

  await expect(page.getByText('49.00 米 = 48.00 米 + 0.50 米 + 0.50 米')).toBeVisible()
  await expect(page.getByText('47.00 米 = 48.00 米 - 0.50 米 - 0.50 米')).toBeVisible()
  await expect(page.getByText(/件 = 12 层 × \d+ 件/)).toBeVisible()
  const tripleCardNestCount = await page.locator(`[data-pda-cut-spreading-root="${task.taskId}"]`).evaluate((root) => {
    const isCard = (node: Element) => node.classList.contains('border') && node.classList.contains('bg-card')
    return Array.from(root.querySelectorAll('*')).filter((node) => {
      if (!isCard(node)) return false
      const second = Array.from(node.children).find((child) => isCard(child))
      if (!second) return false
      return Array.from(second.children).some((child) => isCard(child))
    }).length
  })
  expect(tripleCardNestCount).toBe(0)

  await page.getByRole('button', { name: '保存铺布记录' }).click()

  await expect(page.getByText('铺布记录已保存，已清空本次录入值。')).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="fabricRollNo"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="layerCount"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="actualLength"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="headLength"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="tailLength"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="note"]')).toHaveValue('')

  await page.getByRole('button', { name: '沿用上次层数' }).click()
  await expect(page.locator('[data-pda-cut-spreading-field="layerCount"]')).toHaveValue('12')
  await page.getByRole('button', { name: '沿用上次头尾' }).click()
  await expect(page.locator('[data-pda-cut-spreading-field="actualLength"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="headLength"]')).toHaveValue('0.5')
  await expect(page.locator('[data-pda-cut-spreading-field="tailLength"]')).toHaveValue('0.5')
  await expect(page.locator('[data-pda-cut-spreading-field="fabricRollNo"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="note"]')).toHaveValue('')

  await expectNoPageErrors(errors)
})
