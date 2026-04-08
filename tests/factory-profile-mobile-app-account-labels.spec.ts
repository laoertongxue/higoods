import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('工厂档案统一显示工厂端移动应用账号与权限口径', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()

  await page.locator('[data-factory-id="ID-F001"] [data-factory-action="edit"]').click()

  const form = page.locator('form[data-factory-form="true"]')
  await expect(form).toBeVisible()

  await expect(form.getByRole('heading', { name: '工厂端移动应用配置（主数据）' })).toBeVisible()
  await expect(form.getByRole('heading', { name: '工厂端移动应用账号与权限' })).toBeVisible()
  await expect(form.getByText('工厂端移动应用 Tenant ID')).toBeVisible()
  await expect(form.getByText('新增工厂端移动应用账号')).toBeVisible()
  await expect(form.getByText('账号与权限在“工厂端移动应用账号与权限”模块维护。')).toBeVisible()

  const text = await form.textContent()
  expect(text).not.toContain('PDA账号与权限')
  expect(text).not.toContain('PDA 账号与权限')
  expect(text).not.toContain('PDA身份与权限')
  expect(text).not.toContain('PDA 配置')
  expect(text).not.toContain('PDA Tenant ID')

  await expectNoPageErrors(errors)
})
