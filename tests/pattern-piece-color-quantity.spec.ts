import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCurrentTechPack(page: Page): Promise<void> {
  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()
  await page.locator('[data-prod-action="open-current-tech-pack"][data-spu-code="SPU-2024-001"]').first().click()
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

async function setFirstRowColorPieces(dialog: Locator, firstQty: string, secondQty: string): Promise<Locator> {
  const firstRow = dialog.getByTestId('pattern-piece-row').first()
  const colorRows = firstRow.getByTestId('pattern-color-piece-qty')
  await expect(colorRows.first()).toBeVisible()

  const colorCount = await colorRows.count()
  for (let index = 0; index < colorCount; index += 1) {
    const colorRow = colorRows.nth(index)
    const checkbox = colorRow.locator('input[type="checkbox"]')
    if (index < 2) {
      await checkbox.check()
      await colorRow.locator('input[type="number"]').fill(index === 0 ? firstQty : secondQty)
    } else {
      await checkbox.uncheck()
    }
  }

  return firstRow
}

async function savePatternAndConfirmWarnings(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  const duplicateWarning = dialog.getByText('疑似重复纸样')
  if (await duplicateWarning.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: '继续保存为新纸样', exact: true }).click()
  }
  await expect(page.getByTestId('pattern-two-step-dialog')).toHaveCount(0)
}

test('裁片明细按适用颜色维护颜色片数并实时计算总片数', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  const dialog = await openParsedPatternForEdit(page)
  const pieceTable = dialog.getByTestId('pattern-piece-table')

  await expect(pieceTable).toContainText('适用颜色与颜色片数')
  await expect(pieceTable).toContainText('当前部位总片数')
  await expect(pieceTable).toContainText('当前总片数')
  await expect(pieceTable).toContainText('解析参考片数')
  await expect(pieceTable.locator('th', { hasText: /^片数$/ })).toHaveCount(0)

  let firstRow = await setFirstRowColorPieces(dialog, '2', '2')
  await expect(firstRow.getByTestId('pattern-piece-total-qty')).toContainText('4 片')
  await expect(pieceTable.getByTestId('pattern-piece-total')).toContainText(/当前总片数：\d+ 片/)

  const secondColor = firstRow.getByTestId('pattern-color-piece-qty').nth(1)
  await secondColor.locator('input[type="checkbox"]').uncheck()
  await expect(firstRow.getByTestId('pattern-piece-total-qty')).toContainText('2 片')

  const firstColorInput = firstRow.getByTestId('pattern-color-piece-qty').first().locator('input[type="number"]')
  await firstColorInput.fill('-1')
  await expect(firstRow).toContainText('颜色片数必须为非负整数')
  await firstColorInput.fill('1.5')
  await expect(firstRow).toContainText('颜色片数必须为非负整数')

  const colorRows = firstRow.getByTestId('pattern-color-piece-qty')
  const colorCount = await colorRows.count()
  for (let index = 0; index < colorCount; index += 1) {
    const colorRow = colorRows.nth(index)
    await colorRow.locator('input[type="checkbox"]').check()
    await colorRow.locator('input[type="number"]').fill('0')
  }
  await expect(firstRow).toContainText('当前总片数为 0，请维护颜色片数')
  await expect(firstRow).toContainText('解析参考片数与颜色片数合计不一致，请确认')

  firstRow = await setFirstRowColorPieces(dialog, '2', '2')
  await savePatternAndConfirmWarnings(page, dialog)

  await openParsedPatternForEdit(page)
  const reopenedDialog = page.getByTestId('pattern-two-step-dialog')
  await expect(reopenedDialog.getByTestId('pattern-piece-row').first()).toContainText('4 片')

  await expectNoPageErrors(errors)
})
