import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const executionUnitTask = listPdaCuttingTaskSourceRecords()
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
      (line) => line.executionOrderId === item.executionOrderId && line.currentStepCode !== 'DONE',
    ),
  )

test.skip(!executionUnitTask, '缺少可进入当前任务的 PDA 任务')

test('PDA 当前任务页渲染 5 张步骤卡，术语已简化且铺布入口显式可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  const task = executionUnitTask!
  await page.setViewportSize({ width: 360, height: 800 })

  await page.goto(`/fcs/pda/cutting/unit/${task.taskId}/${task.executionOrderId}`)

  await expect(page.locator('h1', { hasText: '当前任务' })).toBeVisible()
  await expect(page.locator('[data-pda-cutting-execution-unit-card="object"]')).toBeVisible()
  await expect(page.locator('[data-pda-cutting-unit-current-step]')).toBeVisible()
  await expect(page.locator('body')).toContainText('当前任务号')
  await expect(page.locator('body')).toContainText('裁片单')
  await expect(page.locator('body')).toContainText('当前状态')
  await expect(page.locator('body')).toContainText('当前步骤')
  await expect(page.locator('body')).toContainText('合并裁剪批次')
  await expect(page.locator('body')).toContainText('参考唛架')
  await expect(page.locator('body')).toContainText('最近交接结果')
  await expect(page.locator('body')).not.toContainText('执行单元')
  await expect(page.locator('body')).not.toContainText('来源唛架')
  await expect(page.locator('body')).not.toContainText('当前主状态')
  await expect(page.locator('body')).not.toContainText('当前应执行步骤')
  await expect(page.locator('body')).not.toContainText('拆分组')
  await expect(page.locator('body')).not.toContainText('sourceWritebackId')
  await expect(page.locator('body')).not.toContainText('operatorAccountId')

  const stepCodes = ['PICKUP', 'SPREADING', 'REPLENISHMENT', 'HANDOVER', 'INBOUND']
  await expect(page.locator('[data-pda-cutting-unit-step]')).toHaveCount(5)
  for (const code of stepCodes) {
    await expect(page.locator(`[data-pda-cutting-unit-step="${code}"]`)).toBeVisible()
  }

  const spreadingButton = page.locator('[data-pda-cutting-unit-step="SPREADING"]')
  const inViewport = await spreadingButton.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= window.innerHeight
  })
  expect(inViewport).toBeTruthy()
  const spreadingButtonBox = await spreadingButton.boundingBox()
  expect(spreadingButtonBox?.height ?? 0).toBeLessThan(54)
  await expect(page.locator('[data-pda-cutting-unit-step="SPREADING"]')).toContainText('去铺布')
  await expect(page.locator('[data-step-status="current"]')).toHaveCount(1)
  await expect(page.locator('[data-pda-cutting-unit-current-step]')).toContainText(/去领料|去铺布|去补料|去交接|去入仓|已完成/)
  const tripleCardNestCount = await page.locator('[data-pda-cutting-execution-unit-root]').evaluate((root) => {
    const isCard = (node: Element) => node.classList.contains('border') && node.classList.contains('bg-card')
    return Array.from(root.querySelectorAll('*')).filter((node) => {
      if (!isCard(node)) return false
      const second = Array.from(node.children).find((child) => isCard(child))
      if (!second) return false
      return Array.from(second.children).some((child) => isCard(child))
    }).length
  })
  expect(tripleCardNestCount).toBe(0)

  await page.locator('[data-pda-cutting-unit-step="SPREADING"]').click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/spreading/${task.taskId}\\?`))
  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()

  await expectNoPageErrors(errors)
})
