import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors, GENERIC_PDA_SESSION, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

test('交接移除已完成 Tab，旧 tab=done 地址不再展示历史交出单', async ({ page }) => {
  const errors = collectPageErrors(page)

  await seedLocalStorage(page, { fcs_pda_factory_id: 'ID-F001', fcs_pda_session: GENERIC_PDA_SESSION })
  await page.goto('/fcs/pda/handover?tab=done', { waitUntil: 'commit' })
  await page.waitForFunction(() => document.body.innerText.includes('交接'), undefined, { timeout: 30_000 })

  const tabs = page.getByTestId('pda-handover-tabs')
  await expect(tabs.getByRole('button')).toHaveCount(2)
  await expect(tabs.getByRole('button', { name: /^待接收/ })).toBeVisible()
  await expect(tabs.getByRole('button', { name: /^待交出/ })).toBeVisible()
  await expect(tabs).not.toContainText('已完成')
  await expect(page.locator('[data-pda-handover-action="open-detail"]').filter({ hasText: '已完成' })).toHaveCount(0)

  await expectNoPageErrors(errors)
})
