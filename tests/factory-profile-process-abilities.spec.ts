import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('编辑工厂弹层已用工序工艺能力替换旧能力标签，并回显迁移后的能力', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()

  await page.locator('[data-factory-id="ID-F001"] [data-factory-action="edit"]').click()

  const form = page.locator('form[data-factory-form="true"]')
  await expect(form).toBeVisible()
  await expect(form.getByTestId('factory-process-abilities')).toBeVisible()
  await expect(form.getByRole('heading', { name: '工序工艺能力' })).toBeVisible()

  const formText = await form.textContent()
  expect(formText).not.toContain('能力标签')
  expect(formText).not.toContain('生产类别')
  expect(formText).not.toContain('工艺能力材料加工')

  await expect(form.locator('input[data-factory-process-toggle="SEW"]')).toBeChecked()
  await expect(form.locator('input[data-factory-process-toggle="PRINT"]')).not.toBeChecked()
  await expect(form.getByLabel('曲牙')).toBeChecked()

  await expectNoPageErrors(errors)
})

test('新建工厂时工序与工艺联动正确，保存后重新打开仍能正确回显', async ({ page }) => {
  const errors = collectPageErrors(page)
  const factoryName = `工序工艺能力联动工厂-${Date.now()}`

  await page.goto('/fcs/factories/profile')
  await expect(page.getByRole('heading', { name: '工厂档案', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '新增工厂' }).click()

  const form = page.locator('form[data-factory-form="true"]')
  await expect(form).toBeVisible()

  await form.locator('[data-factory-field="name"]').fill(factoryName)
  await form.locator('[data-factory-field="contact"]').fill('张测试')
  await form.locator('[data-factory-field="phone"]').fill('13800138000')
  await form.locator('[data-factory-field="address"]').fill('Jakarta Test Road 99')
  await form.locator('[data-factory-field="pdaTenantId"]').fill(`tenant-${Date.now()}`)

  const printProcess = form.locator('input[data-factory-process-toggle="PRINT"]')
  const screenPrintCraft = form.getByLabel('丝网印')
  const digitalPrintCraft = form.getByLabel('数码印')

  await printProcess.check()
  await expect(screenPrintCraft).toBeChecked()
  await expect(digitalPrintCraft).toBeChecked()

  await printProcess.uncheck()
  await expect(screenPrintCraft).not.toBeChecked()
  await expect(digitalPrintCraft).not.toBeChecked()

  await screenPrintCraft.check()
  await expect(screenPrintCraft).toBeChecked()
  await expect(printProcess).not.toBeChecked()

  await digitalPrintCraft.check()
  await expect(printProcess).toBeChecked()

  await form.getByRole('button', { name: '创建工厂' }).click()
  await expect(form).toBeHidden()

  const search = page.locator('[data-factory-filter="search"]')
  await search.fill(factoryName)

  const factoryRow = page.locator('tr').filter({ hasText: factoryName }).first()
  await expect(factoryRow).toBeVisible()
  await factoryRow.locator('[data-factory-action="edit"]').click()

  const reopenedForm = page.locator('form[data-factory-form="true"]')
  await expect(reopenedForm).toBeVisible()
  await expect(reopenedForm.locator('input[data-factory-process-toggle="PRINT"]')).toBeChecked()
  await expect(reopenedForm.getByLabel('丝网印')).toBeChecked()
  await expect(reopenedForm.getByLabel('数码印')).toBeChecked()

  await reopenedForm.getByLabel('丝网印').uncheck()
  await expect(reopenedForm.locator('input[data-factory-process-toggle="PRINT"]')).not.toBeChecked()
  await reopenedForm.getByLabel('数码印').uncheck()
  await expect(reopenedForm.locator('input[data-factory-process-toggle="PRINT"]')).not.toBeChecked()

  await reopenedForm.getByRole('button', { name: '保存' }).click()
  await expect(reopenedForm).toBeHidden()

  await factoryRow.locator('[data-factory-action="edit"]').click()
  const savedForm = page.locator('form[data-factory-form="true"]')
  await expect(savedForm).toBeVisible()
  await expect(savedForm.locator('input[data-factory-process-toggle="PRINT"]')).not.toBeChecked()
  await expect(savedForm.getByLabel('丝网印')).not.toBeChecked()
  await expect(savedForm.getByLabel('数码印')).not.toBeChecked()

  await expectNoPageErrors(errors)
})
