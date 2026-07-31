import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('中转袋详情只读展示已形成的使用事实，不再承担装袋写入', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001')
  await expect(page.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible({
    timeout: 120_000,
  })

  const body = page.locator('body')
  await expect(body).not.toContainText('绑定任务')
  await expect(page.locator('select[data-transfer-bags-workbench-field="sewingTaskId"]')).toHaveCount(0)
  await expect(page.locator('input[data-transfer-bags-workbench-field="ticketInput"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '加入本袋', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开始装袋', exact: true })).toHaveCount(0)

  await expect(page.getByRole('tab', { name: '当前使用', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '袋内菲票', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '当前使用', exact: true }).click()
  await expect(page.locator('#transfer-bag-tabpanel-current')).toBeVisible()
  await expect(page.locator('#transfer-bag-tabpanel-current')).toContainText('使用周期')

  await page.getByRole('tab', { name: '袋内菲票', exact: true }).click()
  await expect(page.locator('#transfer-bag-tabpanel-items')).toBeVisible()
  await expect(page.getByText(/每页 10 条/)).toBeVisible()
  await expect(body).not.toContainText('待首张菲票锁定')

  await expectNoPageErrors(errors)
})
