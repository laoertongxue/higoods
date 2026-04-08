import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('工厂档案权限矩阵按真实工厂端移动应用功能分组展示', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/factories/profile')
  await page.locator('[data-factory-id="ID-F001"] [data-factory-action="edit"]').click()

  const form = page.locator('form[data-factory-form="true"]')
  await expect(form).toBeVisible()

  await form.getByRole('button', { name: '权限矩阵' }).click()

  await expect(form.getByText('接单', { exact: true })).toBeVisible()
  await expect(form.getByText('报价', { exact: true })).toBeVisible()
  await expect(form.getByText('执行', { exact: true })).toBeVisible()
  await expect(form.getByText('裁片执行', { exact: true })).toBeVisible()
  await expect(form.getByText('交接', { exact: true })).toBeVisible()
  await expect(form.getByText('质检', { exact: true })).toBeVisible()
  await expect(form.getByText('结算', { exact: true })).toBeVisible()
  await expect(form.getByText('待办', { exact: true })).toHaveCount(0)

  await expect(form.getByRole('cell', { name: '关键节点上报', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '提交报价', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '查看报价结果', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '提交领料长度异议', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '保存铺布记录', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '提交交出数量异议', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '确认处理质量扣款', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '申请修改结算资料', exact: true })).toBeVisible()

  const matrixText = await form.textContent()
  expect(matrixText).not.toContain('创建质检')
  expect(matrixText).not.toContain('提交质检')
  expect(matrixText).not.toContain('申请结算复议')

  await expectNoPageErrors(errors)
})
