import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('生产单进度详情抽屉按简化结构展示', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/production-progress')

  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()
  await table.locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click()

  const drawer = page.locator('.fixed.inset-0.z-50').filter({
    has: page.getByRole('heading', { name: '生产单详情' }),
  })
  await expect(drawer).toBeVisible()

  await expect(drawer).toContainText('面料进度')
  await expect(drawer).toContainText('当前进展')
  await expect(drawer).toContainText('部位差异')
  await expect(drawer).toContainText('来源裁片单')
  await expect(drawer).toContainText('风险提示')

  await expect(drawer.getByText('面料审核', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('结论与状态', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('后续入口', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('当前下一步动作', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('当前最主要差异对象', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('技术包', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('映射异常数', { exact: true })).toHaveCount(0)
  await expect(drawer.getByText('数据待补数', { exact: true })).toHaveCount(0)

  const currentProgressSection = drawer.locator('section').filter({ hasText: '当前进展' }).first()
  await expect(currentProgressSection.getByText('颜色', { exact: true })).toHaveCount(0)
  await expect(currentProgressSection.getByText('尺码', { exact: true })).toHaveCount(0)
  await expect(currentProgressSection.getByText('下一步动作', { exact: true })).toHaveCount(0)

  const partGapSection = drawer.locator('section').filter({ hasText: '部位差异' }).first()
  await expect(partGapSection.getByText('下一步动作', { exact: true })).toHaveCount(0)

  const sourceOrderSection = drawer.locator('section').filter({ hasText: '来源裁片单' }).first()
  const sourceButtonLabels = await sourceOrderSection.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => button.textContent?.trim() ?? '').filter(Boolean),
  )
  expect(new Set(sourceButtonLabels)).toEqual(new Set(sourceButtonLabels.length ? ['查看原始裁片单'] : []))
  await expect(sourceOrderSection.getByText('去配料 / 领料', { exact: true })).toHaveCount(0)
  await expect(sourceOrderSection.getByText('去唛架铺布', { exact: true })).toHaveCount(0)
  await expect(sourceOrderSection.getByText('去打印菲票', { exact: true })).toHaveCount(0)

  const footer = drawer.locator('.sticky.bottom-0')
  await expect(footer.getByRole('button', { name: '关闭' })).toHaveCount(1)
  await expect(footer.getByText('查看配料', { exact: true })).toHaveCount(0)
  await expect(footer.getByText('打印菲票', { exact: true })).toHaveCount(0)
  await expect(footer.getByText('去唛架铺布', { exact: true })).toHaveCount(0)
  await expect(footer.getByText('去裁剪总表', { exact: true })).toHaveCount(0)

  await expectNoPageErrors(errors)
})
