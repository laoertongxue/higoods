import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('工厂档案默认只显示管理员与操作工，并按真实移动应用模块整理权限矩阵', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/factories/profile')
  await page.locator('[data-factory-id="ID-F001"] [data-factory-action="edit"]').click()

  const form = page.locator('form[data-factory-form="true"]')
  await expect(form).toBeVisible()

  await expect(form.getByRole('button', { name: '账号列表' })).toBeVisible()
  await expect(form.getByText('PT_Sinar_操作工')).toBeVisible()
  await expect(form.getByText('PT_Sinar_管理员')).toBeVisible()
  await expect(form.getByText('ID-F001_operator')).toBeVisible()
  await expect(form.getByText('ID-F001_admin')).toBeVisible()

  const usersTable = form.locator('table').first()
  await expect(usersTable.locator('tbody tr')).toHaveCount(2)
  await expect(usersTable).not.toContainText('调度员')
  await expect(usersTable).not.toContainText('生产员')
  await expect(usersTable).not.toContainText('质检员')
  await expect(usersTable).not.toContainText('财务')
  await expect(usersTable).not.toContainText('只读')

  await form.getByRole('button', { name: '角色管理' }).click()

  const rolesTable = form.locator('table').first()
  await expect(rolesTable).toContainText('管理员')
  await expect(rolesTable).toContainText('操作工')
  await expect(rolesTable).not.toContainText('调度员')
  await expect(rolesTable).not.toContainText('生产员')
  await expect(rolesTable).not.toContainText('交接员')
  await expect(rolesTable).not.toContainText('质检员')
  await expect(rolesTable).not.toContainText('财务')
  await expect(rolesTable).not.toContainText('只读')

  const adminRow = rolesTable.locator('tbody tr').filter({ hasText: '管理员' })
  const operatorRow = rolesTable.locator('tbody tr').filter({ hasText: '操作工' })
  await expect(adminRow.locator('td').nth(2)).toHaveText('25')
  await expect(operatorRow.locator('td').nth(2)).toHaveText('17')

  await operatorRow.getByRole('button', { name: '编辑' }).click()

  await expect(form.locator('input[data-pda-role-perm="TASK_ACCEPT"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="TASK_REJECT"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="QUOTE_SUBMIT"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="QUOTE_VIEW"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="SETTLEMENT_VIEW"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="SETTLEMENT_CONFIRM"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="SETTLEMENT_DISPUTE"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="SETTLEMENT_CHANGE_REQUEST"]')).not.toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="TASK_START"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="TASK_MILESTONE_REPORT"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="TASK_FINISH"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="CUTTING_SPREADING_SAVE"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="HANDOUT_QTY_DISPUTE"]')).toBeChecked()
  await expect(form.locator('input[data-pda-role-perm="QC_CONFIRM_DEDUCTION"]')).toBeChecked()

  await form.locator('[data-factory-action="cancel-role-form"]').click()

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
  await expect(form.getByRole('cell', { name: '提交领料长度异议', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '提交交出数量异议', exact: true })).toBeVisible()
  await expect(form.getByRole('cell', { name: '申请修改结算资料', exact: true })).toBeVisible()
  await expect(form.getByText('创建质检')).toHaveCount(0)
  await expect(form.getByText('提交质检')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
