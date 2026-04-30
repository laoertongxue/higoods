import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCurrentTechPack(page: Page): Promise<void> {
  await page.goto('/pcs/products/styles/style_seed_001/technical-data/tdv_seed_001')
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30_000 })
}

async function openParsedPatternForEdit(page: Page): Promise<Locator> {
  const targetRow = page.locator('tbody tr').filter({ hasText: '已解析待确认纸样2' }).first()
  await expect(targetRow).toBeVisible()
  await targetRow.locator('[data-tech-action="edit-pattern"]').click()
  const dialog = page.getByTestId('pattern-two-step-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('pattern-step-maker').click()
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toBeVisible()
  return dialog
}

async function acceptConfiguredInstanceRemovalDuring(page: Page, action: () => Promise<void>): Promise<void> {
  const handler = async (dialog: import('@playwright/test').Dialog) => {
    if (dialog.message().includes('当前减少片数会删除已配置特殊工艺的裁片实例')) {
      await dialog.accept()
      return
    }
    await dialog.dismiss()
  }
  page.on('dialog', handler)
  try {
    await action()
  } finally {
    page.off('dialog', handler)
  }
}

async function configureFirstPieceRowAsThreeInstances(page: Page, dialog: Locator): Promise<Locator> {
  const firstRow = dialog.getByTestId('pattern-piece-row').first()
  const colorRows = firstRow.getByTestId('pattern-color-piece-qty')
  await expect(colorRows.first()).toBeVisible()

  await acceptConfiguredInstanceRemovalDuring(page, async () => {
    const colorCount = await colorRows.count()
    for (let index = 0; index < colorCount; index += 1) {
      const colorRow = colorRows.nth(index)
      const checkbox = colorRow.locator('input[type="checkbox"]')
      if (index === 0) {
        await checkbox.check()
        await colorRow.locator('input[type="number"]').fill('2')
      } else if (index === 1) {
        await checkbox.check()
        await colorRow.locator('input[type="number"]').fill('1')
      } else {
        await checkbox.uncheck()
      }
    }
  })

  await expect(firstRow.getByTestId('pattern-piece-total-qty')).toContainText('3 片')
  return firstRow
}

async function openPieceInstanceCraftDialog(firstRow: Locator): Promise<Locator> {
  const actionButton = firstRow.locator('[data-tech-action="open-piece-instance-special-craft-dialog"]')
  await actionButton.scrollIntoViewIfNeeded()
  await actionButton.click({ force: true })
  const craftDialog = firstRow.page().getByTestId('piece-instance-special-craft-dialog')
  await expect(craftDialog).toBeVisible()
  return craftDialog
}

async function addCraft(craftDialog: Locator, craftName: string, positionName: string): Promise<void> {
  await craftDialog.getByTestId('piece-instance-special-craft-select').selectOption({ label: craftName })
  await craftDialog.getByTestId('piece-instance-position-select').selectOption({ label: positionName })
  await craftDialog.getByRole('button', { name: '添加特殊工艺', exact: true }).click()
}

async function savePatternAndConfirmWarnings(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  const duplicateWarning = dialog.getByTestId('pattern-duplicate-warning')
  if (await duplicateWarning.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: '继续保存为新纸样', exact: true }).click()
  }
  await expect(page.getByTestId('pattern-two-step-dialog')).toHaveCount(0)
}

test('根据颜色片数生成裁片实例并维护逐片特殊工艺', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  const dialog = await openParsedPatternForEdit(page)
  const firstRow = await configureFirstPieceRowAsThreeInstances(page, dialog)

  await expect(firstRow).toContainText('已配置')
  await expect(firstRow).toContainText('共 3 片')

  const craftDialog = await openPieceInstanceCraftDialog(firstRow)
  await expect(craftDialog.getByTestId('piece-instance-row')).toHaveCount(3)
  await expect(craftDialog).toContainText('第1片')
  await expect(craftDialog).toContainText('第2片')

  const craftSelect = craftDialog.getByTestId('piece-instance-special-craft-select')
  for (const expected of ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣花', '模板工序', '激光开袋', '特种车缝（花样机）']) {
    await expect(craftSelect).toContainText(expected)
  }
  for (const forbidden of ['捆条', '橡筋定长切割', '缩水', '洗水']) {
    await expect(craftSelect.locator('option', { hasText: forbidden })).toHaveCount(0)
  }

  await addCraft(craftDialog, '打揽', '左')
  await expect(craftDialog).toContainText('打揽（左）')
  await expect(craftDialog.locator('[data-testid="piece-instance-assignment"]', { hasText: '打揽（左）' })).toHaveCount(1)

  await craftSelect.selectOption({ label: '打揽' })
  await craftDialog.getByTestId('piece-instance-position-select').selectOption({ label: '右' })
  await craftDialog.getByRole('button', { name: '添加特殊工艺', exact: true }).click()
  await expect(craftDialog).toContainText('该裁片已配置该特殊工艺，请勿重复添加。')

  await craftSelect.selectOption({ label: '绣花' })
  await craftDialog.getByTestId('piece-instance-position-select').selectOption({ index: 0 })
  await craftDialog.getByRole('button', { name: '添加特殊工艺', exact: true }).click()
  await expect(craftDialog).toContainText('请选择工艺位置。')

  await addCraft(craftDialog, '绣花', '面')
  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toContain('是否将当前片的特殊工艺应用到同颜色全部片？')
    await confirmDialog.accept()
  })
  await craftDialog.getByRole('button', { name: '应用到同颜色全部片', exact: true }).click()
  await craftDialog.getByTestId('piece-instance-row').filter({ hasText: '黑色 / 第2片' }).click()
  await expect(craftDialog).toContainText('绣花（面）')

  await craftDialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(firstRow).toContainText('共 3 片')
  await expect(firstRow).toContainText('已配置')
  await savePatternAndConfirmWarnings(page, dialog)

  await openParsedPatternForEdit(page)
  const reopenedDialog = page.getByTestId('pattern-two-step-dialog')
  const reopenedRow = reopenedDialog.getByTestId('pattern-piece-row').first()
  await expect(reopenedRow).toContainText('共 3 片')
  await expect(reopenedRow).toContainText('已配置')
  await reopenedDialog.getByRole('button', { name: '维护逐片工艺', exact: true }).first().click()
  const reopenedCraftDialog = page.getByTestId('piece-instance-special-craft-dialog')
  await expect(reopenedCraftDialog).toContainText('打揽（左）')
  await expect(reopenedCraftDialog).toContainText('绣花（面）')

  await expectNoPageErrors(errors)
})

test('减少颜色片数会保护已配置特殊工艺的裁片实例', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  const dialog = await openParsedPatternForEdit(page)
  const firstRow = await configureFirstPieceRowAsThreeInstances(page, dialog)
  const craftDialog = await openPieceInstanceCraftDialog(firstRow)
  await addCraft(craftDialog, '打揽', '左')
  await craftDialog.getByRole('button', { name: '关闭', exact: true }).click()

  const firstColorQtyInput = firstRow.getByTestId('pattern-color-piece-qty').first().locator('input[type="number"]')
  const summaryBeforeCancel = await firstRow.getByTestId('piece-instance-craft-summary').innerText()
  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toContain('当前减少片数会删除已配置特殊工艺的裁片实例，是否继续？')
    await confirmDialog.dismiss()
  })
  await firstColorQtyInput.fill('0')
  await expect(firstRow.getByTestId('piece-instance-craft-summary')).toHaveText(summaryBeforeCancel)

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toContain('当前减少片数会删除已配置特殊工艺的裁片实例，是否继续？')
    await confirmDialog.accept()
  })
  await firstColorQtyInput.fill('0')
  await expect(firstRow).toContainText('共 1 片')

  await expectNoPageErrors(errors)
})
