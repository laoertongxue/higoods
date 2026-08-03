import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

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

test('PDA 裁片任务详情按铺布单展示当前主动作并进入对应工序', async ({ page }) => {
  const errors = collectPageErrors(page)
  const task = taskWithSpreadingStep!
  const targetLine = task.detail?.cutPieceOrders.find((line) => line.executionOrderId === task.executionOrderId) || null

  await seedLocalStorage(page, {
    fcs_pda_session: {
      userId: 'F090_operator',
      loginId: 'F090_operator',
      userName: '全能力测试工厂_操作工',
      roleId: 'ROLE_OPERATOR',
      factoryId: 'F090',
      factoryName: '全能力测试工厂',
      loggedAt: '2026-08-02 10:00:00',
    },
  })

  await page.goto(
    `/fcs/pda/cutting/task/${task.taskId}?executionOrderId=${encodeURIComponent(task.executionOrderId)}&executionOrderNo=${encodeURIComponent(task.executionOrderNo)}`,
  )

  const orderCard = page.locator(`[data-pda-cutting-order-line="${task.executionOrderId}"]`)
  await expect(orderCard).toBeVisible()
  await expect(orderCard).toContainText(task.executionOrderNo)
  await expect(orderCard).toContainText(targetLine?.currentStateLabel || '')
  await expect(orderCard.getByRole('button', { name: targetLine?.nextActionLabel || '开始铺布' })).toBeVisible()
  await expect(orderCard.getByRole('button', { name: '继续处理' })).toHaveCount(0)

  await orderCard.getByRole('button', { name: targetLine?.nextActionLabel || '开始铺布' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/spreading/${task.taskId}\\?.*executionOrderId=${task.executionOrderId}`))
  await expect(page.locator('h1', { hasText: '铺布录入' })).toBeVisible()

  await expectNoPageErrors(errors)
})
