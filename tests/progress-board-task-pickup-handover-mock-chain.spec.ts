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

test('任务维度列表与抽屉中的领料/交出链路使用同一套上下游事实', async ({ page }) => {
  test.slow()
  const errors = collectPageErrors(page)

  await openProgressBoard(page)

  const receivedRow = getTaskRow(page, 'TASKGEN-202603-0004-001__ORDER')
  await expect(receivedRow.locator('[data-progress-task-cell="pickup"]')).toContainText('已领料')
  await receivedRow.locator('[data-progress-task-cell="pickup"] button').click()
  const drawer = page.locator('[data-progress-task-drawer="true"]')
  await expect(drawer.locator('[data-progress-task-tab-panel="pickup"]')).toBeVisible()
  await expect(drawer.locator('[data-progress-task-pickup-section="requests"]')).toContainText('LLXQ2026030004')
  await expect(drawer.locator('[data-progress-task-pickup-section="execution"]')).toContainText('WL-LLXQ2026030004')
  await expect(drawer.locator('[data-progress-task-pickup-section="records"]')).toContainText('PKH-ISSUE-LLXQ2026030004')
  await expect(drawer.locator('[data-progress-task-pickup-section="records"]')).toContainText('RECEIVED')

  await drawer.getByLabel('关闭').click()
  await expect(drawer).toHaveCount(0)

  const pendingWarehouseRow = getTaskRow(page, 'TASKGEN-202603-0002-005__ORDER')
  await expect(pendingWarehouseRow.locator('[data-progress-task-cell="handover"]')).toContainText('待仓库确认')
  await pendingWarehouseRow.locator('[data-progress-task-cell="handover"] button').click()
  const handoverDrawer = page.locator('[data-progress-task-drawer="true"]')
  await expect(handoverDrawer.locator('[data-progress-task-tab-panel="handover"]')).toBeVisible()
  await expect(handoverDrawer.locator('[data-progress-task-handover-section="heads"]')).toContainText('HOH-RETURN-TASKGEN-202603-0002-005__ORDER')
  await expect(handoverDrawer.locator('[data-progress-task-handover-section="records"]')).toContainText('HOR-SEED-TASKGEN0002005-002')

  await handoverDrawer.getByLabel('关闭').click()
  await expect(handoverDrawer).toHaveCount(0)

  const diffRow = getTaskRow(page, 'TASKGEN-202603-0005-001__ORDER')
  await expect(diffRow.locator('[data-progress-task-cell="pickup"]')).toContainText('领料差异')
  await diffRow.locator('[data-progress-task-cell="pickup"] button').click()
  const diffDrawer = page.locator('[data-progress-task-drawer="true"]')
  await expect(diffDrawer.locator('[data-progress-task-tab-panel="pickup"]')).toBeVisible()
  await expect(diffDrawer.locator('[data-progress-task-pickup-section="records"]')).toContainText('工厂复点数量少于仓库交付数量')

  await expectNoPageErrors(errors)
})
