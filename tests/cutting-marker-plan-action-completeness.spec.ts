import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function clickMarkerPlanTab(page: import('@playwright/test').Page, tabKey: string) {
  await page.locator(`[data-marker-plan-tab-trigger="${tabKey}"]`).evaluate((node: HTMLElement) => node.click())
}

test('唛架页面关键按钮与交互完整可用', async ({ page, context }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const firstBuiltRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').first()
  await expect(firstBuiltRow).toBeVisible()
  await firstBuiltRow.getByRole('button', { name: '查看' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-detail\//)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const editRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').first()
  await expect(editRow).toBeVisible()
  await editRow.getByRole('button', { name: '编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-edit\//)

  await page.goto('/fcs/craft/cutting/marker-list')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('唛架')

  await page.getByRole('button', { name: '从原始裁片单新建' }).click()
  const drawer = page.getByTestId('marker-plan-context-drawer')
  await expect(drawer).toBeVisible()
  const firstContextNo = (await drawer.locator('tbody tr').first().locator('td').nth(2).textContent())?.trim() || ''
  await drawer.locator('[data-marker-plan-context-field="contextKeyword"]').fill(firstContextNo.slice(0, 8))
  await drawer.locator('tbody input[type="radio"]').first().check()
  await page.getByRole('button', { name: '进入新增' }).click()
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('[data-marker-plan-basic-field="markerMode"]').selectOption('high_low')
  await clickMarkerPlanTab(page, 'layout')
  const modeDetailRows = page.getByTestId('marker-plan-mode-detail-lines').locator('tbody tr')
  const modeDetailBefore = await modeDetailRows.count()
  await modeDetailRows.first().getByRole('button', { name: '复制' }).click()
  await expect(modeDetailRows).toHaveCount(modeDetailBefore + 1)

  await clickMarkerPlanTab(page, 'images')
  await page.getByRole('button', { name: '上传图片' }).click()
  await page.getByRole('button', { name: '上传图片' }).click()
  const imageCards = page.getByTestId('marker-plan-images-tab').locator('article')
  await expect(imageCards).toHaveCount(2)

  const secondCard = imageCards.nth(1)
  await secondCard.getByRole('button', { name: '设为主图' }).click()
  await expect(secondCard).toContainText('主图')

  const secondFileNameBefore = await secondCard.getByText(/\.svg$/).textContent()
  await secondCard.getByRole('button', { name: '替换' }).click()
  await expect(secondCard.getByText(/\.svg$/)).not.toHaveText(secondFileNameBefore || '')

  const popupPromise = context.waitForEvent('page')
  await secondCard.getByRole('button', { name: '预览' }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  await popup.close()

  await secondCard.getByRole('button', { name: '删除' }).click()
  await expect(imageCards).toHaveCount(1)

  await page.getByRole('button', { name: '保存并查看详情' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()
  await page.getByRole('button', { name: '复制为新唛架' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-create\?copyFrom=/)

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架' }).click()
  const readyRow = page.getByTestId('marker-plan-list-table').locator('tbody tr').filter({ hasText: '可交接铺布' }).first()
  await expect(readyRow).toBeVisible()
  await readyRow.getByRole('button', { name: '交给铺布' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-list/)
  await expect(page.getByRole('heading', { name: '铺布列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建唛架' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '唛架记录' })).toHaveCount(0)
  await expect(page.getByText('当前筛选范围内暂无唛架记录')).toHaveCount(0)

  await expectNoPageErrors(errors)
})
