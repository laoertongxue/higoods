import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCreatePageFromContext(page: Page, buttonName: string): Promise<void> {
  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: buttonName }).click()
  const drawer = page.getByTestId('marker-plan-context-drawer')
  await expect(drawer).toBeVisible()
  await drawer.locator('tbody input[type="radio"]').first().check()
  await page.getByRole('button', { name: '进入新增' }).click()
  await expect(page.getByTestId('cutting-marker-plan-create-page')).toBeVisible()
}

async function fillSizeRatio(page: Page, sizeCode: string, qty: number): Promise<void> {
  await page.locator(`[data-marker-plan-action="change-size-ratio"][data-size-code="${sizeCode}"]`).fill(String(qty))
}

test('新增唛架页支持上下文新建、公式联动、修正映射、模式切换、图片操作与完成计划', async ({ page }) => {
  const errors = collectPageErrors(page)

  await openCreatePageFromContext(page, '从原始裁片单新建')
  const basicTab = page.getByTestId('marker-plan-basic-tab')
  const initialSizeRatioEntries = await Promise.all(
    ['S', 'M', 'L', 'XL', '2XL', 'onesize', 'onesizeplus'].map(async (sizeCode) => {
      const input = page.locator(`[data-marker-plan-action="change-size-ratio"][data-size-code="${sizeCode}"]`)
      return [sizeCode, Number.parseInt((await input.inputValue()) || '0', 10) || 0] as const
    }),
  )
  const initialSizeRatioMap = Object.fromEntries(initialSizeRatioEntries)
  for (const sizeCode of ['S', 'M', 'L', 'XL', '2XL', 'onesize', 'onesizeplus']) {
    await fillSizeRatio(page, sizeCode, 0)
  }
  await fillSizeRatio(page, 'S', 3)
  await fillSizeRatio(page, 'M', 5)
  await page.locator('[data-marker-plan-basic-field="netLength"]').fill('4')
  await expect(basicTab).toContainText('8')
  await expect(basicTab).toContainText('0.500')
  await expect(basicTab.getByText('8 件 = 3 件 + 5 件 + 0 件 + 0 件 + 0 件 + 0 件 + 0 件')).toBeVisible()
  await expect(basicTab.getByText('0.500 m/件 = 4.00 m ÷ 8 件')).toBeVisible()
  for (const [sizeCode, qty] of Object.entries(initialSizeRatioMap)) {
    await fillSizeRatio(page, sizeCode, qty)
  }

  await page.locator('[data-marker-plan-tab-trigger="allocation"]').click({ force: true })
  const allocationTab = page.getByTestId('marker-plan-allocation-tab')
  await page.getByRole('button', { name: '一键按尺码配比生成' }).click()
  await expect(allocationTab.getByText('已配平', { exact: true }).first()).toBeVisible()

  await page.locator('[data-marker-plan-tab-trigger="images"]').click({ force: true })
  await page.getByRole('button', { name: '上传图片' }).click()
  await page.getByRole('button', { name: '上传图片' }).click()
  const imageCards = page.getByTestId('marker-plan-images-tab').locator('article')
  await expect(imageCards).toHaveCount(2)
  const secondImage = imageCards.nth(1)
  await secondImage.getByRole('button', { name: '设为主图' }).click()
  await expect(secondImage).toContainText('主图')

  const secondFileNameBefore = await secondImage.getByText(/\.svg$/).textContent()
  await secondImage.getByRole('button', { name: '替换' }).click()
  await expect(secondImage.getByText(/\.svg$/)).not.toHaveText(secondFileNameBefore || '')

  await secondImage.getByRole('button', { name: '删除' }).click()
  await expect(imageCards).toHaveCount(1)

  await page.getByRole('button', { name: '完成计划' }).click()
  await expect(page.getByText(/已完成唛架计划/)).toBeVisible()
  await page.getByRole('button', { name: '保存并查看详情' }).click()
  await expect(page.getByTestId('cutting-marker-plan-detail-page')).toBeVisible()

  await openCreatePageFromContext(page, '从合并批次新建')
  await expect(page.getByTestId('marker-plan-top-info')).toContainText('合并裁剪批次')

  await page.locator('[data-marker-plan-tab-trigger="explosion"]').click({ force: true })
  const explosionTab = page.getByTestId('marker-plan-explosion-tab')
  const repairButton = explosionTab.getByRole('button', { name: '修正映射' }).first()
  await expect(repairButton).toBeVisible()
  await repairButton.click()
  const mappingDrawer = page.getByTestId('marker-plan-mapping-drawer')
  await expect(mappingDrawer).toBeVisible()
  await page.getByRole('button', { name: '恢复自动映射' }).click()
  await expect(mappingDrawer).not.toBeVisible()
  await repairButton.click()
  await expect(mappingDrawer).toBeVisible()
  await page.getByRole('button', { name: '保存映射' }).click()
  await expect(mappingDrawer).not.toBeVisible()

  await page.locator('[data-marker-plan-tab-trigger="basic"]').click({ force: true })
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('[data-marker-plan-basic-field="markerMode"]').selectOption('fold_high_low')
  await page.locator('[data-marker-plan-tab-trigger="layout"]').click({ force: true })
  await expect(page.getByTestId('marker-plan-fold-config')).toBeVisible()
  await expect(page.getByTestId('marker-plan-high-low-matrix')).toBeVisible()
  await expect(page.getByTestId('marker-plan-mode-detail-lines')).toBeVisible()

  const matrixInput = page.getByTestId('marker-plan-high-low-matrix').locator('tbody tr').first().locator('input[type="number"]').first()
  await matrixInput.fill('4')
  await expect(matrixInput).toHaveValue('4')

  await expectNoPageErrors(errors)
})
