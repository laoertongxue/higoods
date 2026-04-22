import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function clearPdaSession(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => window.localStorage.removeItem('fcs_pda_session'))
}

async function openFactoryDialog(page: import('@playwright/test').Page, factoryId: string): Promise<import('@playwright/test').Locator> {
  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()
  const editButton = page.locator(`[data-factory-action="edit"][data-factory-id="${factoryId}"]`)
  await editButton.scrollIntoViewIfNeeded()
  await editButton.click({ force: true })
  const dialog = page.locator('[data-factory-form="true"]').last()
  await dialog.waitFor({ state: 'visible', timeout: 15000 })
  await expect(dialog).toBeVisible()
  return dialog
}

test('FCS PDA 账户密码登录、旧账号迁移和重置密码生效', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectPageErrors(page)
  const uniqueLoginId = `pwdpda${Date.now()}`
  const initialPassword = 'pass1234'
  const nextPassword = 'pass5678'

  await page.goto('/fcs/pda/login')
  await expect(page.getByRole('heading', { name: '工厂端移动应用登录', exact: true })).toBeVisible()
  await page.locator('[data-pda-login-field="loginId"]').fill('ID-F001_operator')
  await page.locator('[data-pda-login-field="password"]').fill('123456')
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/notify$/)
  await clearPdaSession(page)

  const factoryDialog = await openFactoryDialog(page, 'ID-F001')
  await factoryDialog.locator('[data-factory-action="toggle-add-user"]').click()
  await factoryDialog.locator('[data-pda-field="new-user-name"]').fill('密码校验账号')
  await factoryDialog.locator('[data-pda-field="new-user-login"]').fill(uniqueLoginId)
  await factoryDialog.locator('[data-pda-field="new-user-password"]').fill('123456')
  await factoryDialog.locator('[data-pda-field="new-user-password-confirm"]').fill('654321')
  await factoryDialog.locator('[data-factory-action="create-pda-user"]').click()
  await expect(factoryDialog.getByText('两次输入的密码不一致')).toBeVisible()

  await factoryDialog.locator('[data-pda-field="new-user-password"]').fill('12345')
  await factoryDialog.locator('[data-pda-field="new-user-password-confirm"]').fill('12345')
  await factoryDialog.locator('[data-factory-action="create-pda-user"]').click()
  await expect(factoryDialog.getByText('登录密码至少 6 位')).toBeVisible()

  await factoryDialog.locator('[data-pda-field="new-user-password"]').fill(initialPassword)
  await factoryDialog.locator('[data-pda-field="new-user-password-confirm"]').fill(initialPassword)
  await factoryDialog.locator('[data-factory-action="create-pda-user"]').click()
  await expect(factoryDialog.getByText(uniqueLoginId)).toBeVisible()

  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('[data-factory-form="true"]')).toHaveCount(0)

  await page.goto('/fcs/pda/login')
  await page.locator('[data-pda-login-field="loginId"]').fill(uniqueLoginId)
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page.getByText('请输入登录密码')).toBeVisible()

  await page.locator('[data-pda-login-field="password"]').fill('wrong-password')
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page.getByText('账户或密码错误')).toBeVisible()

  await page.locator('[data-pda-login-field="password"]').fill(initialPassword)
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/notify$/)
  await clearPdaSession(page)

  const resetDialog = await openFactoryDialog(page, 'ID-F001')
  await resetDialog
    .locator('tr')
    .filter({ hasText: uniqueLoginId })
    .locator('[data-factory-action="open-reset-user-password"]')
    .click()
  await resetDialog.locator('[data-pda-field="reset-user-password"]').fill(nextPassword)
  await resetDialog.locator('[data-pda-field="reset-user-password-confirm"]').fill(nextPassword)
  await resetDialog.locator('[data-factory-action="confirm-reset-user-password"]').click()
  await expect(resetDialog.locator('[data-pda-field="reset-user-password"]')).toHaveCount(0)

  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('[data-factory-form="true"]')).toHaveCount(0)

  await page.goto('/fcs/pda/login')
  await page.locator('[data-pda-login-field="loginId"]').fill(uniqueLoginId)
  await page.locator('[data-pda-login-field="password"]').fill(initialPassword)
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page.getByText('账户或密码错误')).toBeVisible()

  await page.locator('[data-pda-login-field="password"]').fill(nextPassword)
  await page.locator('[data-pda-login-action="submit"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/notify$/)

  await expectNoPageErrors(errors)
})
