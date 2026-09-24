import path from 'node:path'

import { expect, test } from '@playwright/test'

const REAL_DESIGN_IMAGE = path.resolve('public/dress-sample-1.jpg')

test('设计改款新建页阻断非图片且保留表单，真实设计稿保存后可以建单', async ({ page }) => {
  await page.goto('/pcs/production-preparation/design-revision')
  await page.locator('[data-pcs-independent-sampling-action="open-create"]').click()

  const source = page.locator('[data-pcs-independent-sampling-field="sourceStyleId"]')
  const target = page.locator('[data-pcs-independent-sampling-field="targetStyleId"]')
  const reason = page.locator('[data-pcs-independent-sampling-field="creationReason"]')
  await source.selectOption({ index: 1 })
  await target.selectOption({ index: 2 })
  await reason.fill('验证设计稿上传失败后不丢失已填资料')

  const chooseDesignFile = page.getByText('选择本地设计稿', { exact: true })
  const invalidFileChooserPromise = page.waitForEvent('filechooser', { timeout: 2_000 })
  await chooseDesignFile.click()
  const invalidFileChooser = await invalidFileChooserPromise
  await invalidFileChooser.setFiles({
    name: 'wrong-design.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not-an-image'),
  })
  await expect(page.getByText(/设计稿仅支持/)).toBeVisible()
  await expect(source).not.toHaveValue('')
  await expect(target).not.toHaveValue('')
  await expect(reason).toHaveValue('验证设计稿上传失败后不丢失已填资料')

  const realFileChooserPromise = page.waitForEvent('filechooser', { timeout: 2_000 })
  await chooseDesignFile.click()
  const realFileChooser = await realFileChooserPromise
  await realFileChooser.setFiles(REAL_DESIGN_IMAGE)
  await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible()
  await page.locator('[data-pcs-independent-sampling-action="save-draft"]').click()

  await expect(page).toHaveURL(/\/pcs\/production-preparation\/design-revision\/ES-ID-DR-/)
  await expect(page.getByRole('heading', { name: /^ES-DR-/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: '第一步：确认本次方案' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /dress-sample-1\.jpg设计稿/ })).toBeVisible()
  await expect(page.getByText('设计改款草稿已保存。')).toBeVisible()
})
