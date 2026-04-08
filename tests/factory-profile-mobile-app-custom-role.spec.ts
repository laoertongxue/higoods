import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('工厂档案保留新增、复制、编辑、启用禁用自定义角色能力', async ({ page }) => {
  const errors = collectPageErrors(page)
  const roleName = `巡检协作角色-${Date.now()}`
  const updatedRoleName = `${roleName}-二次配置`

  await page.goto('/fcs/factories/profile')
  await page.locator('[data-factory-id="ID-F001"] [data-factory-action="edit"]').click()

  const form = page.locator('form[data-factory-form="true"]')
  await expect(form).toBeVisible()

  await form.getByRole('button', { name: '角色管理' }).click()
  await form.getByRole('button', { name: '新建角色' }).click()

  await form.locator('[data-pda-field="role-form-name"]').fill(roleName)
  const copyFrom = form.locator('[data-pda-field="role-copy-from"]')
  await expect(copyFrom).toContainText('管理员')
  await expect(copyFrom).toContainText('操作工')
  await form.locator('[data-pda-field="role-copy-from"]').selectOption({ label: '操作工' })
  await expect(form.locator('input[data-pda-role-perm="TASK_START"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="CUTTING_SPREADING_SAVE"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="HANDOUT_CREATE"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="SETTLEMENT_VIEW"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="QUOTE_SUBMIT"]')).not.toBeChecked()

  await form.locator('[data-factory-action="save-role-form"]').click()

  const rolesTable = form.locator('table').first()
  const createdRow = rolesTable.locator('tbody tr').filter({ hasText: roleName })
  await expect(createdRow).toBeVisible()
  await expect(createdRow).toContainText('自定义')

  await createdRow.getByRole('button', { name: '编辑' }).click()
  await form.locator('[data-pda-field="role-form-name"]').fill(updatedRoleName)
  await form.locator('input[data-pda-role-perm="TASK_ACCEPT"]').check()
  await form.locator('input[data-pda-role-perm="QUOTE_VIEW"]').check()
  await form.locator('input[data-pda-role-perm="SETTLEMENT_CHANGE_REQUEST"]').check()
  await form.locator('[data-factory-action="save-role-form"]').click()

  const updatedRow = rolesTable.locator('tbody tr').filter({ hasText: updatedRoleName })
  await expect(updatedRow).toBeVisible()
  await expect(updatedRow.locator('td').nth(2)).toHaveText('20')

  await updatedRow.getByRole('button', { name: '禁用' }).click()
  await expect(updatedRow).toContainText('禁用')
  await updatedRow.getByRole('button', { name: '启用' }).click()
  await expect(updatedRow).toContainText('启用')

  await expectNoPageErrors(errors)
})
