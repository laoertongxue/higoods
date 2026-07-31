import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('裁片仓上下文通过规范路由进入中转袋流转并正确落点', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bags?sourcePageKey=cut-piece-warehouse&warehouseStatus=WAITING_HANDOVER&autoOpenDetail=1')
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/transfer-bags(?:\?|$)/)
  await expect(page.getByRole('heading', { name: '中转袋流转', exact: true })).toBeVisible({
    timeout: 120_000,
  })
  const body = page.locator('body')
  await expect(body).toContainText('已从裁片仓带入上下文')
  await expect(body).toContainText('仓状态：待交接')
  await expect(body).not.toContainText('去 transfer-bags 入口')
  await expect(body).not.toContainText('本步只保留入口')

  await expectNoPageErrors(errors)
})
