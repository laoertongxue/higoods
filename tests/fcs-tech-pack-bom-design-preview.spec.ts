import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCurrentTechPack(page: Page): Promise<void> {
  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()
  await page.locator('[data-prod-action="open-current-tech-pack"][data-spu-code="SPU-2024-001"]').first().click()
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30000 })
}

async function openBomTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: '物料清单', exact: true }).click()
  await expect(page.getByRole('heading', { name: '物料清单', exact: true })).toBeVisible()
}

function getDesignPreviewDialog(page: Page): Locator {
  return page.locator('[data-tech-preview-dialog="design-thumbnail"]')
}

async function expectDialogPreviewContent(page: Page): Promise<void> {
  const dialog = getDesignPreviewDialog(page)
  await expect(dialog).toBeVisible()

  const previewImage = dialog.locator('[data-tech-preview-image="true"]')
  const emptyState = dialog.locator('[data-tech-preview-empty="true"]')
  const imageCount = await previewImage.count()

  if (imageCount > 0) {
    await expect(previewImage.first()).toBeVisible()
    return
  }

  await expect(emptyState).toHaveText('暂无缩略图')
}

test('技术包 BOM 中点击正面花型和里面花型可预览缩略图，空值不弹窗', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await openBomTab(page)

  await page.locator('[data-tech-preview-trigger="front"][data-bom-id="b-3"]').click()
  await expect(getDesignPreviewDialog(page)).toBeVisible()
  await expect(getDesignPreviewDialog(page)).toContainText('花型缩略图预览')
  await expect(getDesignPreviewDialog(page)).toContainText('正面花型')
  await expectDialogPreviewContent(page)
  await getDesignPreviewDialog(page).locator('[data-tech-preview-close="true"]').click()
  await expect(getDesignPreviewDialog(page)).toHaveCount(0)

  await page.locator('[data-tech-preview-trigger="inside"][data-bom-id="b-3"]').click()
  await expect(getDesignPreviewDialog(page)).toBeVisible()
  await expect(getDesignPreviewDialog(page)).toContainText('里面花型')
  await expectDialogPreviewContent(page)
  await page.locator('[data-tech-preview-backdrop="true"]').click({ position: { x: 10, y: 10 } })
  await expect(getDesignPreviewDialog(page)).toHaveCount(0)

  await page.locator('[data-tech-preview-cell="front"][data-bom-id="b-2"]').click()
  await expect(getDesignPreviewDialog(page)).toHaveCount(0)

  await expectNoPageErrors(errors)
})
