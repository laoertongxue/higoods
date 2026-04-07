import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

function getTaskRow(page: import('@playwright/test').Page, taskId: string) {
  return page.locator('[data-progress-task-list="true"] tbody tr').filter({ hasText: taskId }).first()
}

async function openProgressBoard(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/fcs/progress/board', { waitUntil: 'commit' })
  await expect(page.getByRole('heading', { name: '任务进度看板' })).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('[data-progress-task-list="true"]')).toBeVisible({ timeout: 120_000 })
}

test('点击领料情况或交出情况列会复用现有任务详情抽屉并切到对应 tab', async ({ page }) => {
  test.slow()
  const errors = collectPageErrors(page)

  await openProgressBoard(page)

  const pickupRow = getTaskRow(page, 'TASKGEN-202603-0004-001__ORDER')
  await expect(pickupRow).toBeVisible({ timeout: 120_000 })
  await pickupRow.locator('[data-progress-task-cell="pickup"] button').click()

  const drawer = page.locator('[data-progress-task-drawer="true"]')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('[data-progress-task-tab-panel="pickup"]')).toBeVisible()
  await expect(drawer.getByRole('button', { name: '基本信息' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: '分配信息' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: '进度操作' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: '审计日志' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: '领料情况' })).toHaveClass(/bg-primary/)

  await drawer.getByLabel('关闭').click()
  await expect(drawer).toHaveCount(0)

  const handoverRow = getTaskRow(page, 'TASKGEN-202603-0002-005__ORDER')
  await expect(handoverRow).toBeVisible({ timeout: 120_000 })
  await handoverRow.locator('[data-progress-task-cell="handover"] button').click()

  const reopenedDrawer = page.locator('[data-progress-task-drawer="true"]')
  await expect(reopenedDrawer.locator('[data-progress-task-tab-panel="handover"]')).toBeVisible()
  await expect(reopenedDrawer.getByRole('button', { name: '交出情况' })).toHaveClass(/bg-primary/)
  await expect(reopenedDrawer.locator('[data-progress-task-tab-panel="pickup"]')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
