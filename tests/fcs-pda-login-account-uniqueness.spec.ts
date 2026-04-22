import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('FCS PDA 账号全局唯一且登录后自动归厂', async ({ page }) => {
  const errors = collectPageErrors(page)
  const uniqueLoginId = `autopda${Date.now()}`
  const password = 'pass1234'

  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()

  const firstEditButton = page.locator('[data-factory-action="edit"][data-factory-id="ID-F001"]')
  await firstEditButton.scrollIntoViewIfNeeded()
  await firstEditButton.click({ force: true })
  const firstFactoryDialog = page.locator('[data-factory-form="true"]').last()
  await firstFactoryDialog.waitFor({ state: 'visible', timeout: 15000 })
  await expect(firstFactoryDialog).toBeVisible()
  await expect(firstFactoryDialog.locator('[data-factory-action="toggle-add-user"]')).toBeVisible()
  await firstFactoryDialog.locator('[data-factory-action="toggle-add-user"]').click()
  await firstFactoryDialog.locator('[data-pda-field="new-user-name"]').fill('自动化账号A')
  await firstFactoryDialog.locator('[data-pda-field="new-user-login"]').fill(uniqueLoginId)
  await firstFactoryDialog.locator('[data-pda-field="new-user-password"]').fill(password)
  await firstFactoryDialog.locator('[data-pda-field="new-user-password-confirm"]').fill(password)
  await firstFactoryDialog.locator('[data-factory-action="create-pda-user"]').click()
  await expect(firstFactoryDialog.getByText(uniqueLoginId)).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('[data-factory-form="true"]')).toHaveCount(0)

  const secondEditButton = page.locator('[data-factory-action="edit"][data-factory-id="ID-F002"]')
  await secondEditButton.scrollIntoViewIfNeeded()
  await secondEditButton.click({ force: true })
  const secondFactoryDialog = page.locator('[data-factory-form="true"]').last()
  await secondFactoryDialog.waitFor({ state: 'visible', timeout: 15000 })
  await expect(secondFactoryDialog).toBeVisible()
  await expect(secondFactoryDialog.locator('[data-factory-action="toggle-add-user"]')).toBeVisible()
  await secondFactoryDialog.locator('[data-factory-action="toggle-add-user"]').click()
  await secondFactoryDialog.locator('[data-pda-field="new-user-name"]').fill('自动化账号B')
  await secondFactoryDialog.locator('[data-pda-field="new-user-login"]').fill(` ${uniqueLoginId.toUpperCase()} `)
  await secondFactoryDialog.locator('[data-pda-field="new-user-password"]').fill(password)
  await secondFactoryDialog.locator('[data-pda-field="new-user-password-confirm"]').fill(password)
  await secondFactoryDialog.locator('[data-factory-action="create-pda-user"]').click()
  await expect(secondFactoryDialog.getByText('登录账户已存在，必须在所有工厂中唯一')).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('[data-factory-form="true"]')).toHaveCount(0)

  await page.goto('/fcs/pda')
  await expect(page).toHaveURL(/\/fcs\/pda\/login$/)
  await expect(page.getByRole('heading', { name: '工厂端移动应用登录', exact: true })).toBeVisible()

  await page.locator('[data-pda-login-field="loginId"]').fill(uniqueLoginId.toUpperCase())
  await page.locator('[data-pda-login-field="password"]').fill(password)
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/notify$/)

  const session = await page.evaluate(() => {
    const raw = window.localStorage.getItem('fcs_pda_session')
    return raw ? JSON.parse(raw) : null
  })

  expect(session).toBeTruthy()
  expect(session.loginId).toBe(uniqueLoginId)
  expect(session.factoryId).toBe('ID-F001')

  await page.goto('/fcs/pda/exec')
  await expect(page).toHaveURL(/\/fcs\/pda\/exec$/)
  await expect(page.getByText('当前工厂:')).toBeVisible()
  await expect(page.locator('[data-pda-exec-field="factoryId"]')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
