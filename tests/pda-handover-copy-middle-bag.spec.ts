import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('用户可见文案统一改成中转袋且不误改周转箱/周转包', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bags', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('中转袋流转'), undefined, { timeout: 30_000 })
  let html = await page.content()
  expect(html).toContain('中转袋流转')
  expect(html).not.toContain('周转口袋')
  expect(html).not.toContain('中转箱')
  expect(html).not.toContain('中转包')

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-001', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('中转袋详情'), undefined, { timeout: 30_000 })
  await expect(page.getByText('中转袋二维码', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '中转袋回收', exact: true })).toBeVisible()
  html = await page.content()
  expect(html).toContain('中转袋详情')
  expect(html).toContain('中转袋二维码')
  expect(html).toContain('中转袋回收')
  expect(html).not.toContain('周转口袋')
  expect(html).not.toContain('中转箱')
  expect(html).not.toContain('中转包')

  await expectNoPageErrors(errors)
})
