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

async function chooseFile(page: Page, buttonName: string, name: string, mimeType: string): Promise<void> {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: buttonName, exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name,
    mimeType,
    buffer: Buffer.from(`pattern two step test file: ${name}`),
  })
}

test('纸样管理两步维护、文件校验、关联物料和保存状态', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await openPatternDialog(page)

  const dialog = page.getByTestId('pattern-two-step-dialog')
  await expect(dialog.getByTestId('pattern-step-merchandiser')).toBeVisible()
  await expect(dialog.getByTestId('pattern-step-maker')).toBeVisible()
  await expect(dialog.getByTestId('pattern-step-merchandiser-panel')).toBeVisible()

  const merchandiserPanel = dialog.getByTestId('pattern-step-merchandiser-panel')
  await expect(merchandiserPanel).toContainText('纸样名称')
  await expect(merchandiserPanel).toContainText('纸样类型')
  await expect(merchandiserPanel).toContainText('是否针织')
  await expect(merchandiserPanel).toContainText('门幅（cm）')
  await expect(merchandiserPanel).toContainText('关联物料')
  await expect(dialog.getByText('纸样 PRJ 文件', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('唛架图片', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('DXF 文件', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('RUL 文件', { exact: true })).toHaveCount(0)

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请填写纸样名称')

  await dialog.locator('[data-tech-field="new-pattern-name"]').fill('两步维护测试纸样')
  await dialog.locator('[data-tech-field="new-pattern-width-cm"]').fill('0')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('门幅必须大于 0')

  await dialog.locator('[data-tech-field="new-pattern-width-cm"]').fill('142')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请选择关联物料')

  const materialSelect = dialog.locator('[data-tech-field="new-pattern-linked-bom-item"]')
  await materialSelect.selectOption({ index: 1 })
  await expect(materialSelect).not.toHaveValue('')
  await expect(materialSelect).toContainText('· b-')

  await dialog.getByRole('button', { name: '保存并进入版师技术信息', exact: true }).click()
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toBeVisible()
  const makerPanel = dialog.getByTestId('pattern-step-maker-panel')
  await expect(makerPanel).toContainText('排料长度（m）')
  await expect(makerPanel).toContainText('纸样 PRJ 文件')
  await expect(makerPanel).toContainText('唛架图片')
  await expect(makerPanel).toContainText('DXF 文件')
  await expect(makerPanel).toContainText('RUL 文件')
  await expect(makerPanel).toContainText('裁片明细')
  await expect(dialog.locator('[data-testid="pattern-step-maker-panel"] [data-tech-field="new-pattern-name"]')).toHaveCount(0)

  await dialog.locator('[data-tech-field="new-pattern-marker-length-m"]').fill('2.65')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请上传纸样 PRJ 文件')

  await chooseFile(page, '选择 PRJ 文件', 'test-pattern.prj', 'application/octet-stream')

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请上传唛架图片')
  await chooseFile(page, '选择唛架图片', 'test-marker.png', 'image/png')

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请上传 DXF 文件')
  await chooseFile(page, '选择 DXF 文件', 'test-pattern.dxf', 'application/dxf')

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toContainText('请上传 RUL 文件')
  await chooseFile(page, '选择 RUL 文件', 'test-pattern.rul', 'application/octet-stream')

  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByTestId('pattern-two-step-dialog')).toHaveCount(0)
  await expect(page.locator('body')).toContainText('两步维护测试纸样')
  await expect(page.locator('body')).toContainText('待解析')
  await expect(page.locator('body')).toContainText('test-pattern.prj')
  await expect(page.locator('body')).toContainText('test-marker.png')
  await expect(page.locator('body')).not.toContainText(['纸样', '图片'].join(''))

  await expectNoPageErrors(errors)
})
