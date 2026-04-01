import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('裁片仓入口会带上下文进入周转口袋流转，并在列表或详情正确落点', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/cut-piece-warehouse')

  const body = page.locator('body')
  await expect(body).not.toContainText('去交接入口')
  await expect(body).not.toContainText('去 transfer-bags 入口')
  await expect(body).not.toContainText('本步只保留入口')

  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible()
  await firstRow.getByRole('button', { name: '去周转口袋流转', exact: true }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/transfer-bags|\/fcs\/craft\/cutting\/transfer-bag-detail/)

  const landedPath = new URL(page.url()).pathname
  if (landedPath.endsWith('/transfer-bag-detail')) {
    await expect(page.getByRole('heading', { name: '周转口袋详情', exact: true })).toBeVisible()
    await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: '周转口袋流转', exact: true })).toBeVisible()
    await expect(body).toContainText('已从裁片仓带入上下文')
  }

  await page.goto('/fcs/craft/cutting/transfer-bags?sourcePageKey=cut-piece-warehouse&warehouseStatus=WAITING_HANDOVER&autoOpenDetail=1')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/transfer-bags(?:\?|$)/)
  await expect(page.getByRole('heading', { name: '周转口袋流转', exact: true })).toBeVisible()
  await expect(body).toContainText('已从裁片仓带入上下文')
  await expect(body).toContainText('仓状态：待交接')

  await expectNoPageErrors(errors)
})
