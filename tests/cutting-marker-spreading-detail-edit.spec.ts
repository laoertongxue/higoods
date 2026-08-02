import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('铺布详情展示当前事实分区，编辑页 5 个 tabs 支持卷记录绑定和保存闭环', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.locator('table tbody tr').first().getByRole('button', { name: '查看详情' }).click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-detail\?/)
  await expect(page.getByRole('heading', { name: '基本信息' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '计划信息' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '实际信息' })).toBeVisible()
  await expect(page.getByText('实际铺布长度', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('实际用量', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('实际裁剪数量', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('卷布料长度', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.font-mono').filter({ hasText: '=' }).first()).toBeVisible()

  await page.getByRole('button', { name: '编辑铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await expect(page.getByTestId('cutting-spreading-edit-page')).toBeVisible()

  const tabShell = page.locator('[data-cutting-spreading-edit-tab-shell]')
  await expect(tabShell).toBeVisible()
  await expect(tabShell.getByRole('button')).toHaveText([
    '执行摘要',
    '卷记录',
    '换班与人员',
    '差异处理',
    '操作日志',
  ])

  await tabShell.getByRole('button', { name: '卷记录' }).click()
  await expect(page.locator('body')).toContainText('唛架项')
  await expect(page.locator('body')).not.toContainText('计划单元')
  await expect(page.locator('[data-cutting-spreading-roll-field="planUnitId"]')).toHaveCount(0)
  const rollNoInputs = page.locator('[data-cutting-spreading-roll-field="rollNo"]')
  const beforeCount = await rollNoInputs.count()
  await page.getByRole('button', { name: '新增卷记录' }).click()
  await expect(page.locator('[data-cutting-spreading-roll-field="rollNo"]')).toHaveCount(beforeCount + 1)
  await expect(page.locator('[data-cutting-spreading-roll-field="rollNo"]').last()).not.toHaveValue('')
  await expect(page.getByText('唛架项', { exact: true }).last()).toBeVisible()

  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)
  await expect(page.getByText(/已保存。/)).toBeVisible()

  await tabShell.getByRole('button', { name: '换班与人员' }).click()
  await expect(page.getByTestId('cutting-spreading-edit-operators-fold')).toHaveAttribute('open', '')
  await expect(page.getByTestId('cutting-spreading-edit-operators-fold')).toHaveAttribute('data-default-open', 'open')
  await tabShell.getByRole('button', { name: '差异处理' }).click()
  await expect(page.getByTestId('cutting-spreading-edit-variance-fold')).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('cutting-spreading-edit-variance-fold')).toHaveAttribute('data-default-open', 'collapsed')
  await tabShell.getByRole('button', { name: '操作日志' }).click()
  await expect(page.getByRole('heading', { name: '操作日志' })).toBeVisible()

  await expectNoPageErrors(errors)
})
