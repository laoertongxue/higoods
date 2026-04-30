import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCurrentTechPack(page: Page): Promise<void> {
  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()
  await page.locator('[data-prod-action="open-current-tech-pack"][data-spu-code="SPU-2024-001"]').first().click()
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30_000 })
}

async function openPatternDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: '添加纸样', exact: true }).click()
  await expect(page.getByTestId('pattern-two-step-dialog')).toBeVisible()
}

async function chooseFile(page: Page, buttonName: string, name: string, mimeType: string, fileSize = 128): Promise<void> {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: buttonName, exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name,
    mimeType,
    buffer: Buffer.alloc(fileSize, 'a'),
  })
}

async function fillMerchandiserStep(page: Page, patternName: string, materialIndex = 1): Promise<void> {
  const dialog = page.getByTestId('pattern-two-step-dialog')
  await dialog.locator('[data-tech-field="new-pattern-name"]').fill(patternName)
  await dialog.locator('[data-tech-field="new-pattern-width-cm"]').fill('142')
  await dialog.locator('[data-tech-field="new-pattern-linked-bom-item"]').selectOption({ index: materialIndex })
  await dialog.getByRole('button', { name: '保存并进入版师技术信息', exact: true }).click()
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toBeVisible()
}

async function fillRequiredMakerFiles(page: Page, seed: string): Promise<void> {
  const dialog = page.getByTestId('pattern-two-step-dialog')
  await dialog.locator('[data-tech-field="new-pattern-marker-length-m"]').fill('2.68')
  await chooseFile(page, '选择 PRJ 文件', `${seed}.prj`, 'application/octet-stream', 12101)
  await chooseFile(page, '选择唛架图片', `${seed}-marker.png`, 'image/png', 12102)
  await chooseFile(page, '选择 DXF 文件', `${seed}.dxf`, 'application/dxf', 12103)
  await chooseFile(page, '选择 RUL 文件', `${seed}.rul`, 'application/octet-stream', 12104)
}

test('纸样版师技术信息可维护多个捆条并保存到详情', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)
  const patternName = `捆条测试纸样${Date.now()}`

  await openCurrentTechPack(page)
  await openPatternDialog(page)
  await fillMerchandiserStep(page, patternName)

  const dialog = page.getByTestId('pattern-two-step-dialog')
  await expect(dialog.getByTestId('pattern-binding-strip-section')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '添加捆条', exact: true })).toBeVisible()
  await expect(dialog).toContainText('暂无捆条，可点击添加捆条')

  await fillRequiredMakerFiles(page, `binding-${Date.now()}`)
  await dialog.getByRole('button', { name: '添加捆条', exact: true }).click()
  await expect(dialog.getByTestId('binding-strip-row')).toHaveCount(1)

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请填写捆条名称')

  const firstStrip = dialog.getByTestId('binding-strip-row').first()
  await firstStrip.locator('[data-tech-field="new-pattern-binding-strip-name"]').fill('领口捆条')
  await firstStrip.locator('[data-tech-field="new-pattern-binding-strip-length-cm"]').fill('0')
  await firstStrip.locator('[data-tech-field="new-pattern-binding-strip-width-cm"]').fill('3.2')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('捆条长度必须大于 0')

  await firstStrip.locator('[data-tech-field="new-pattern-binding-strip-length-cm"]').fill('58')
  await firstStrip.locator('[data-tech-field="new-pattern-binding-strip-width-cm"]').fill('0')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('捆条宽度必须大于 0')

  await firstStrip.locator('[data-tech-field="new-pattern-binding-strip-width-cm"]').fill('3.2')
  await dialog.getByRole('button', { name: '添加捆条', exact: true }).click()
  await expect(dialog.getByTestId('binding-strip-row')).toHaveCount(2)
  const secondStrip = dialog.getByTestId('binding-strip-row').nth(1)
  await secondStrip.locator('[data-tech-field="new-pattern-binding-strip-name"]').fill('袖口捆条')
  await secondStrip.locator('[data-tech-field="new-pattern-binding-strip-length-cm"]').fill('42')
  await secondStrip.locator('[data-tech-field="new-pattern-binding-strip-width-cm"]').fill('2.8')

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toContain('确认删除该捆条？')
    await confirmDialog.dismiss()
  })
  await secondStrip.locator('[data-tech-action="delete-pattern-binding-strip"]').click()
  await expect(dialog.getByTestId('binding-strip-row')).toHaveCount(2)

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toContain('确认删除该捆条？')
    await confirmDialog.accept()
  })
  await secondStrip.locator('[data-tech-action="delete-pattern-binding-strip"]').click()
  await expect(dialog.getByTestId('binding-strip-row')).toHaveCount(1)

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  if (await dialog.getByTestId('pattern-duplicate-warning').isVisible()) {
    await dialog.getByRole('button', { name: '继续保存为新纸样', exact: true }).click()
  }
  await expect(page.getByTestId('pattern-two-step-dialog')).toHaveCount(0)

  const savedRow = page.locator('tbody tr').filter({ hasText: patternName }).first()
  await expect(savedRow).toContainText('1 条')
  await savedRow.locator('[data-tech-action="open-pattern-detail"]').last().click()
  await expect(page.locator('body')).toContainText('捆条')
  await expect(page.locator('body')).toContainText('领口捆条')
  await expect(page.locator('body')).toContainText('长度（cm）')
  await expect(page.locator('body')).toContainText('宽度（cm）')

  await expectNoPageErrors(errors)
})

test('重复 PRJ、DXF、RUL 文件会阻止保存', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await openPatternDialog(page)
  await fillMerchandiserStep(page, `重复文件测试纸样${Date.now()}`, 3)

  const dialog = page.getByTestId('pattern-two-step-dialog')
  await dialog.locator('[data-tech-field="new-pattern-marker-length-m"]').fill('2.72')
  await chooseFile(page, '选择 PRJ 文件', '待解析-纸样-1.prj', 'application/octet-stream', 24_576)
  await chooseFile(page, '选择唛架图片', `duplicate-file-${Date.now()}.png`, 'image/png', 33_001)
  await chooseFile(page, '选择 DXF 文件', `duplicate-file-${Date.now()}.dxf`, 'application/dxf', 33_002)
  await chooseFile(page, '选择 RUL 文件', `duplicate-file-${Date.now()}.rul`, 'application/octet-stream', 33_003)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('当前技术包已上传相同 PRJ 文件，请勿重复上传同一纸样')

  await chooseFile(page, '选择 PRJ 文件', `unique-${Date.now()}.prj`, 'application/octet-stream', 33_004)
  await chooseFile(page, '选择 DXF 文件', '待解析-纸样-1.dxf', 'application/dxf', 32_768)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('当前技术包已上传相同 DXF 文件，请勿重复上传同一纸样')

  await chooseFile(page, '选择 DXF 文件', `unique-${Date.now()}.dxf`, 'application/dxf', 33_005)
  await chooseFile(page, '选择 RUL 文件', '待解析-纸样-1.rul', 'application/octet-stream', 8_192)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('当前技术包已上传相同 RUL 文件，请勿重复上传同一纸样')

  await expectNoPageErrors(errors)
})

test('同名纸样阻止保存，疑似重复可返回修改或确认保存', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await openPatternDialog(page)
  await fillMerchandiserStep(page, '待解析纸样1', 3)
  await fillRequiredMakerFiles(page, `same-name-${Date.now()}`)
  let dialog = page.getByTestId('pattern-two-step-dialog')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('当前技术包已存在同名纸样，请修改纸样名称')

  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await openPatternDialog(page)
  const warningPatternName = `疑似重复确认纸样${Date.now()}`
  await fillMerchandiserStep(page, warningPatternName, 1)
  await fillRequiredMakerFiles(page, `warning-${Date.now()}`)
  dialog = page.getByTestId('pattern-two-step-dialog')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByTestId('pattern-duplicate-warning')).toBeVisible()
  await expect(dialog).toContainText('疑似重复纸样')
  await expect(dialog).toContainText('当前技术包中该物料已关联相同类型纸样')

  await dialog.getByRole('button', { name: '返回修改', exact: true }).click()
  await expect(dialog.getByTestId('pattern-duplicate-warning')).toHaveCount(0)
  await expect(dialog.locator('[data-tech-field="new-pattern-marker-length-m"]')).toHaveValue('2.68')

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByTestId('pattern-duplicate-warning')).toBeVisible()
  await dialog.getByRole('button', { name: '继续保存为新纸样', exact: true }).click()
  await expect(page.getByTestId('pattern-two-step-dialog')).toHaveCount(0)
  await expect(page.locator('body')).toContainText(warningPatternName)

  await expectNoPageErrors(errors)
})

test('反向校验：裁片逐片特殊工艺不出现捆条，字典仍显示捆条适用面料', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await openPatternDialog(page)
  await fillMerchandiserStep(page, `反向校验纸样${Date.now()}`, 2)
  await fillRequiredMakerFiles(page, `reverse-${Date.now()}`)

  const dialog = page.getByTestId('pattern-two-step-dialog')
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toContainText('捆条')
  await expect(dialog.locator('[data-tech-field="new-pattern-piece-special-craft"] option', { hasText: '捆条' })).toHaveCount(0)

  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('捆条')
  await expect(page.locator('body')).toContainText('面料')

  await expectNoPageErrors(errors)
})
