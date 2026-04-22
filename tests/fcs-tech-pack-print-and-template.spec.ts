import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

function createTinyPngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
    'base64',
  )
}

function createPdfBuffer(label: string): Buffer {
  return Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF`)
}

async function openCurrentTechPack(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()
  await page.locator('[data-prod-action="open-current-tech-pack"][data-spu-code="SPU-2024-001"]').first().click()
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: '纸样管理', exact: true })).toBeVisible()
}

test('FCS 技术包支持双面印绑定与纸样模板选择', async ({ page }) => {
  test.setTimeout(90000)
  const errors = collectPageErrors(page)
  const timestamp = Date.now()
  const frontDesignName = `正面花型-${timestamp}`
  const insideDesignName = `里面花型-${timestamp}`
  const patternName = `模板纸样-${timestamp}`

  await openCurrentTechPack(page)

  await page.getByRole('button', { name: '花型设计', exact: true }).click()
  await expect(page.getByRole('heading', { name: '花型设计', exact: true })).toBeVisible()

  await page.locator('[data-tech-action="open-add-design"]').click()
  await expect(page.getByRole('heading', { name: '上传设计稿', exact: true })).toBeVisible()
  await page.locator('[data-tech-field="new-design-name"]').fill(frontDesignName)
  await page.locator('#tech-pack-design-file-input').setInputFiles({
    name: `front-${timestamp}.png`,
    mimeType: 'image/png',
    buffer: createTinyPngBuffer(),
  })
  await expect(page.getByText(`原文件：front-${timestamp}.png`)).toBeVisible()
  await page.locator('[data-tech-action="save-design"]').click()
  await expect(page.getByText(frontDesignName)).toBeVisible()

  await page.locator('[data-tech-action="open-add-design"]').click()
  await expect(page.getByRole('heading', { name: '上传设计稿', exact: true })).toBeVisible()
  await page.locator('[data-tech-field="new-design-name"]').fill(insideDesignName)
  await page.locator('[data-tech-field="new-design-side-type"]').selectOption('INSIDE')
  await page.locator('#tech-pack-design-file-input').setInputFiles({
    name: `inside-${timestamp}.png`,
    mimeType: 'image/png',
    buffer: createTinyPngBuffer(),
  })
  await expect(page.getByText(`原文件：inside-${timestamp}.png`)).toBeVisible()
  await page.locator('[data-tech-action="save-design"]').click()
  await expect(page.getByText(insideDesignName)).toBeVisible()

  await page.getByRole('button', { name: '物料清单', exact: true }).click()
  await page.locator('[data-tech-action="edit-bom"][data-bom-id="b-3"]').click()
  const bomDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '编辑物料' })
  await expect(bomDialog).toBeVisible()
  await bomDialog.locator('[data-tech-field="new-bom-print-requirement"]').selectOption('数码印')
  await bomDialog.locator('[data-tech-field="new-bom-print-side-mode"]').selectOption('DOUBLE')
  await bomDialog.locator('[data-tech-field="new-bom-front-pattern-design-id"]').selectOption({ label: frontDesignName })
  await bomDialog.locator('[data-tech-field="new-bom-inside-pattern-design-id"]').selectOption({ label: insideDesignName })
  await bomDialog.locator('[data-tech-action="save-bom"]').scrollIntoViewIfNeeded()
  await bomDialog.locator('[data-tech-action="save-bom"]').click({ force: true })
  await expect(page.getByText(frontDesignName)).toBeVisible()
  await expect(page.getByText(insideDesignName)).toBeVisible()

  await page.getByRole('button', { name: '花型设计', exact: true }).click()
  let blockedDeleteMessage = ''
  page.once('dialog', async (dialog) => {
    blockedDeleteMessage = dialog.message()
    await dialog.accept()
  })
  await page
    .locator('div.rounded-lg.border.p-3')
    .filter({ hasText: frontDesignName })
    .locator('[data-tech-action="delete-design"]')
    .click()
  await expect.poll(() => blockedDeleteMessage).toBe('该花型已被物料清单引用，请先解除引用后再删除')
  await expect(page.getByText(frontDesignName)).toBeVisible()

  await page.getByRole('button', { name: '纸样管理', exact: true }).click()
  await page.locator('[data-tech-action="open-add-pattern"]').click()
  const patternDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '新增纸样' })
  await expect(patternDialog).toBeVisible()

  await patternDialog.locator('[data-tech-field="new-pattern-name"]').fill(patternName)
  await expect(patternDialog.locator('[data-tech-field="new-pattern-name"]')).toHaveValue(patternName)
  await expect(patternDialog).toBeVisible()

  await patternDialog.locator('[data-tech-field="new-pattern-material-type"]').selectOption('KNIT')
  await expect(patternDialog.locator('[data-tech-field="new-pattern-name"]')).toHaveValue(patternName)
  await expect(patternDialog).toBeVisible()

  await patternDialog.locator('[data-tech-field="new-pattern-type"]').selectOption('主体片')
  await expect(patternDialog.locator('[data-tech-field="new-pattern-name"]')).toHaveValue(patternName)

  await patternDialog.locator('[data-tech-field="new-pattern-linked-bom-item"]').selectOption('b-1')
  await expect(patternDialog.locator('[data-tech-field="new-pattern-linked-bom-item"]')).toHaveValue('b-1')
  await expect(patternDialog.locator('[data-tech-field="new-pattern-name"]')).toHaveValue(patternName)

  await patternDialog.locator('#tech-pack-pattern-single-input').setInputFiles({
    name: `pattern-${timestamp}.pdf`,
    mimeType: 'application/pdf',
    buffer: createPdfBuffer(patternName),
  })

  await patternDialog.locator('[data-tech-action="toggle-pattern-size-code"][data-size-code="S"]').click()
  await patternDialog.locator('[data-tech-action="add-new-pattern-piece-row"]').click()
  await patternDialog.locator('[data-tech-field="new-pattern-piece-name"]').fill('前片模板裁片')
  await patternDialog.locator('[data-tech-field="new-pattern-piece-count"]').fill('2')
  await expect(patternDialog).toBeVisible()

  await patternDialog.locator('[data-tech-action="toggle-pattern-piece-color"][data-color-name="White"]').click()
  await expect(patternDialog.locator('[data-tech-field="new-pattern-piece-color-count"][data-color-name="White"]')).toHaveValue('2')

  await patternDialog.locator('[data-tech-field="new-pattern-piece-is-template"]').selectOption('true')
  const templateDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '选择部位模板' })
  await expect(templateDialog).toBeVisible()
  await templateDialog.locator('[data-tech-field="pattern-template-search-keyword"]').fill('PT-001')
  await templateDialog
    .locator('tr')
    .filter({ hasText: 'PT-001' })
    .locator('[data-tech-action="select-pattern-template"]')
    .click()

  await expect(patternDialog).toBeVisible()
  await expect(patternDialog.locator('[data-tech-field="new-pattern-name"]')).toHaveValue(patternName)
  await expect(patternDialog.getByText('PT-001')).toBeVisible()

  await patternDialog.locator('[data-tech-action="save-pattern"]').scrollIntoViewIfNeeded()
  await patternDialog.locator('[data-tech-action="save-pattern"]').click({ force: true })
  await expect(page.locator('tr').filter({ hasText: patternName })).toBeVisible()

  const patternRow = page.locator('tr').filter({ hasText: patternName })
  await patternRow.locator('[data-tech-action="open-pattern-detail"]').first().click()
  const patternDetail = page.locator('[data-dialog-panel="true"]').filter({ hasText: '纸样详情' })
  await expect(patternDetail).toBeVisible()
  await expect(patternDetail.getByText('PT-001')).toBeVisible()
  await expect(patternDetail.locator('svg')).toHaveCount(1)

  await expectNoPageErrors(errors)
})
