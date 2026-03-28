import { expect, test, type Locator, type Page } from '@playwright/test'

import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const genericPendingReceiveTask = listPdaGenericProcessTasks().find(
  (task) => !task.acceptanceStatus || task.acceptanceStatus === 'PENDING',
)

if (!genericPendingReceiveTask) {
  throw new Error('未找到可用于接单详情页可见性回归的通用待接单任务')
}

async function expectReadableDestructiveButton(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const styles = await locator.evaluate((element) => {
    const computed = window.getComputedStyle(element as HTMLElement)
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      opacity: computed.opacity,
    }
  })

  expect(styles.opacity).not.toBe('0')
  expect(styles.color).not.toBe(styles.backgroundColor)
}

async function openReceivePage(page: Page): Promise<void> {
  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001' })
  await page.goto('/fcs/pda/task-receive?tab=pending-accept')
  await expect(page.getByRole('heading', { name: '接单与报价', exact: true })).toBeVisible()
}

test('接单页拒单按钮和拒单弹窗确认按钮文字可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openReceivePage(page)

  const rejectButton = page.locator('[data-pda-tr-action="open-reject"]').first()
  await expect(rejectButton).toContainText('拒单')
  await expectReadableDestructiveButton(rejectButton)

  await rejectButton.click()
  const rejectReason = page.locator('[data-pda-tr-field="rejectReason"]')
  await rejectReason.fill('当前产能冲突，无法承接')

  const confirmRejectButton = page.locator('[data-pda-tr-action="confirm-reject"]')
  await expect(confirmRejectButton).toContainText('确认拒单')
  await expectReadableDestructiveButton(confirmRejectButton)

  await page.locator('[data-pda-tr-action="close-reject"]').last().click()
  await expect(page.locator('[data-pda-tr-action="confirm-reject"]')).toHaveCount(0)
  await expectNoPageErrors(errors)
})

test('接单详情页拒单弹窗确认按钮文字可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, { fcs_pda_factory_id: genericPendingReceiveTask.assignedFactoryId || 'ID-F001' })
  await page.goto(`/fcs/pda/task-receive/${genericPendingReceiveTask.taskId}`)
  await expect(page.getByRole('heading', { name: '任务详情', exact: true })).toBeVisible()

  await page.locator('[data-pda-trd-action="open-reject"]').click()
  await page.locator('[data-pda-trd-field="rejectReason"]').fill('工艺冲突，当前无法接单')

  const confirmRejectButton = page.locator('[data-pda-trd-action="confirm-reject"]')
  await expect(confirmRejectButton).toContainText('确认拒单')
  await expectReadableDestructiveButton(confirmRejectButton)

  await page.locator('[data-pda-trd-action="close-reject"]').last().click()
  await expect(page.locator('[data-pda-trd-action="confirm-reject"]')).toHaveCount(0)
  await expectNoPageErrors(errors)
})
