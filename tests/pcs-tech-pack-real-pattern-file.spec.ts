import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('技术包毛织纸样保存并下载真实 Zip 原文件', async ({ page }) => {
  const stamp = Date.now()
  const patternName = `真实纸样包-${stamp}`
  const fileName = `real-pattern-${stamp}.zip`
  const originalBuffer = Buffer.from(`HiGood real pattern package ${stamp}`)

  await page.goto('/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo')
  await expect(page.getByRole('button', { name: '纸样管理', exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '纸样管理', exact: true }).click()
  await page.getByRole('button', { name: '添加纸样包', exact: true }).click()

  const dialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '添加纸样包' })
  await expect(dialog).toBeVisible()
  await dialog.locator('[data-tech-field="new-pattern-name"]').fill(patternName)
  await dialog.locator('[data-tech-field="new-pattern-material-type"]').selectOption('WOOL')
  await dialog.locator('[data-tech-field="new-pattern-width-cm"]').fill('142')
  await dialog.locator('[data-tech-field="new-pattern-marker-length-m"]').fill('2.1')
  await dialog.locator('#tech-pack-pattern-single-input').setInputFiles({
    name: fileName,
    mimeType: 'application/zip',
    buffer: originalBuffer,
  })
  await expect(dialog.getByText(fileName, { exact: true })).toBeVisible()
  await dialog.locator('[data-tech-action="add-new-pattern-piece-row"]').click()
  await dialog.locator('[data-tech-field="new-pattern-piece-name"]').fill('前片')
  await dialog.locator('[data-tech-field="new-pattern-piece-count"]').fill('2')
  await dialog.locator('[data-tech-action="save-pattern-package"]').click()

  await expect(dialog).toBeHidden()
  const card = page.locator('article').filter({ hasText: patternName }).first()
  await expect(card).toBeVisible()
  await card.locator('[data-tech-action="open-pattern-detail"]').click()

  const detail = page.locator('[data-dialog-panel="true"]').filter({ hasText: '纸样详情' })
  await expect(detail).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await detail.locator('[data-testid="pattern-file-download"]').filter({ hasText: '纸样文件' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(fileName)
  const path = await download.path()
  expect(path).not.toBeNull()
  expect(await readFile(path!)).toEqual(originalBuffer)
})
