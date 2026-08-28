import path from 'node:path'

import { expect, test } from '@playwright/test'

const REAL_DESIGN_IMAGE = path.resolve('public/dress-sample-1.jpg')

test('设计改款新建页阻断非图片且保留表单，真实设计稿保存后可以建单', async ({ page }) => {
  await page.goto('/pcs/engineering/design-revision')
  await page.locator('[data-pcs-independent-sampling-action="open-create"]').click()

  const source = page.locator('[data-pcs-independent-sampling-field="sourceStyleId"]')
  const target = page.locator('[data-pcs-independent-sampling-field="targetStyleId"]')
  const reason = page.locator('[data-pcs-independent-sampling-field="creationReason"]')
  await source.selectOption({ index: 1 })
  await target.selectOption({ index: 2 })
  await reason.fill('验证设计稿上传失败后不丢失已填资料')

  await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles({
    name: 'wrong-design.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not-an-image'),
  })
  await expect(page.getByText(/设计稿仅支持/)).toBeVisible()
  await expect(source).not.toHaveValue('')
  await expect(target).not.toHaveValue('')
  await expect(reason).toHaveValue('验证设计稿上传失败后不丢失已填资料')

  await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(REAL_DESIGN_IMAGE)
  await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible()
  await page.locator('[data-pcs-independent-sampling-action="create"]').click()

  await expect(page).toHaveURL(/\/pcs\/engineering\/design-revision\/ES-ID-DR-/)
  await expect(page.getByText('新款资料准备', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('买手', { exact: true }).first()).toBeVisible()
})
