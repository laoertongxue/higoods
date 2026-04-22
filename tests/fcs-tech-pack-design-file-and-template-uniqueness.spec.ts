import { expect, test } from '@playwright/test'

import { getDemandCurrentTechPackInfo } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
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

async function openCurrentTechPack(page: import('@playwright/test').Page): Promise<string> {
  const info = getDemandCurrentTechPackInfo({ spuCode: 'SPU-2024-001' })
  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()
  await page.locator('[data-prod-action="open-current-tech-pack"][data-spu-code="SPU-2024-001"]').first().click()
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: '纸样管理', exact: true })).toBeVisible()
  if (!info.currentTechPackVersionId) {
    throw new Error('未匹配到技术包版本 ID')
  }
  return info.currentTechPackVersionId
}

async function injectConflictingTemplateBinding(
  page: import('@playwright/test').Page,
  technicalVersionId: string,
  patternName: string,
): Promise<void> {
  await page.evaluate(
    ({ technicalVersionId, patternName: currentPatternName }) => {
      const key = 'higood-pcs-technical-data-version-store-v2'
      const raw = window.localStorage.getItem(key)
      if (!raw) throw new Error('技术包存储不存在')
      const snapshot = JSON.parse(raw)
      const content = (snapshot.contents ?? []).find(
        (item: { technicalVersionId?: string }) => item.technicalVersionId === technicalVersionId,
      )
      if (!content) throw new Error('未找到技术包内容')
      const pattern = (content.patternFiles ?? []).find(
        (item: { patternName?: string; name?: string; fileName?: string }) =>
          item.patternName === currentPatternName
          || item.name === currentPatternName
          || item.fileName === currentPatternName,
      )
      if (!pattern || !Array.isArray(pattern.pieceRows) || pattern.pieceRows.length < 2) {
        throw new Error('未找到目标纸样或裁片明细不足')
      }
      pattern.pieceRows[0].isTemplate = true
      pattern.pieceRows[0].partTemplateId = 'PT-001'
      pattern.pieceRows[1].isTemplate = true
      pattern.pieceRows[1].partTemplateId = 'PT-002'
      window.localStorage.setItem(key, JSON.stringify(snapshot))
    },
    { technicalVersionId, patternName },
  )
}

test('FCS 技术包设计稿原文件与缩略图分离，并拦截同部位多模板', async ({ page }) => {
  test.setTimeout(120000)
  const errors = collectPageErrors(page)
  const timestamp = Date.now()
  const technicalVersionId = await openCurrentTechPack(page)
  const frontDesignName = `正面设计-${timestamp}`
  const insideDesignName = `里面设计-${timestamp}`
  const frontFileName = `front-${timestamp}.png`
  const insideFileName = `inside-${timestamp}.png`
  const patternName = `模板唯一纸样-${timestamp}`

  await page.getByRole('button', { name: '花型设计', exact: true }).click()
  await expect(page.getByRole('heading', { name: '花型设计', exact: true })).toBeVisible()

  await page.locator('[data-tech-action="open-add-design"]').click()
  await page.locator('[data-tech-field="new-design-name"]').fill(frontDesignName)
  await page.locator('#tech-pack-design-file-input').setInputFiles({
    name: frontFileName,
    mimeType: 'image/png',
    buffer: createTinyPngBuffer(),
  })
  await expect(page.getByText(`原文件：${frontFileName}`)).toBeVisible()
  await expect(page.getByText('缩略图：已生成')).toBeVisible()
  await page.locator('[data-tech-action="save-design"]').click()
  const frontCard = page.locator('div.rounded-lg.border.p-3').filter({ hasText: frontDesignName }).first()
  await expect(frontCard).toBeVisible()
  await expect(frontCard.locator('img')).toHaveCount(1)

  await page.locator('[data-tech-action="open-add-design"]').click()
  await page.locator('[data-tech-field="new-design-name"]').fill(insideDesignName)
  await page.locator('[data-tech-field="new-design-side-type"]').selectOption('INSIDE')
  await page.locator('#tech-pack-design-file-input').setInputFiles({
    name: insideFileName,
    mimeType: 'image/png',
    buffer: createTinyPngBuffer(),
  })
  await expect(page.getByText(`原文件：${insideFileName}`)).toBeVisible()
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
  await bomDialog.locator('[data-tech-action="save-bom"]').click({ force: true })
  await expect(page.getByText(frontDesignName)).toBeVisible()
  await expect(page.getByText(insideDesignName)).toBeVisible()

  await page.getByRole('button', { name: '花型设计', exact: true }).click()
  const firstDownload = page.waitForEvent('download')
  await frontCard.locator('[data-tech-action="download-design-original-file"]').click()
  const frontDownload = await firstDownload
  expect(frontDownload.suggestedFilename()).toBe(frontFileName)

  let blockedDeleteMessage = ''
  page.once('dialog', async (dialog) => {
    blockedDeleteMessage = dialog.message()
    await dialog.accept()
  })
  await frontCard.locator('[data-tech-action="delete-design"]').click()
  await expect.poll(() => blockedDeleteMessage).toBe('该花型已被物料清单引用，请先解除引用后再删除')

  await page.reload()
  await expect(page.getByRole('button', { name: '花型设计', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '花型设计', exact: true }).click()
  const reloadedFrontCard = page.locator('div.rounded-lg.border.p-3').filter({ hasText: frontDesignName }).first()
  await expect(reloadedFrontCard).toBeVisible()
  await expect(reloadedFrontCard.locator('img')).toHaveCount(1)
  const secondDownload = page.waitForEvent('download')
  await reloadedFrontCard.locator('[data-tech-action="download-design-original-file"]').click()
  const reloadedDownload = await secondDownload
  expect(reloadedDownload.suggestedFilename()).toBe(frontFileName)

  await page.getByRole('button', { name: '纸样管理', exact: true }).click()
  await page.locator('[data-tech-action="open-add-pattern"]').click()
  const patternDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '新增纸样' })
  await expect(patternDialog).toBeVisible()
  await patternDialog.locator('[data-tech-field="new-pattern-name"]').fill(patternName)
  await patternDialog.locator('[data-tech-field="new-pattern-material-type"]').selectOption('KNIT')
  await patternDialog.locator('[data-tech-field="new-pattern-type"]').selectOption('主体片')
  await patternDialog.locator('[data-tech-field="new-pattern-linked-bom-item"]').selectOption('b-1')
  await patternDialog.locator('#tech-pack-pattern-single-input').setInputFiles({
    name: `pattern-${timestamp}.pdf`,
    mimeType: 'application/pdf',
    buffer: createPdfBuffer(patternName),
  })
  await patternDialog.locator('[data-tech-action="toggle-pattern-size-code"][data-size-code="S"]').click()
  await patternDialog.locator('[data-tech-action="toggle-pattern-size-code"][data-size-code="M"]').click()

  const pieceNames = ['前片-S', '前片-M']
  for (const [index, pieceName] of pieceNames.entries()) {
    await patternDialog.locator('[data-tech-action="add-new-pattern-piece-row"]').click()
    await expect(patternDialog.locator('[data-tech-field="new-pattern-piece-name"]')).toHaveCount(index + 1, {
      timeout: 15000,
    })
    await patternDialog.locator('[data-tech-field="new-pattern-piece-name"]').nth(index).fill(pieceName)
    await patternDialog.locator('[data-tech-field="new-pattern-piece-count"]').nth(index).fill('2')
    await patternDialog
      .locator(`[data-tech-action="toggle-pattern-piece-color"][data-color-name="White"]`)
      .nth(index)
      .click()
    await expect(
      patternDialog.locator(`[data-tech-field="new-pattern-piece-color-count"][data-color-name="White"]`).nth(index),
    ).toHaveValue('2')
  }

  await patternDialog.locator('[data-tech-field="new-pattern-piece-is-template"]').nth(0).selectOption('true')
  let templateDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '选择部位模板' })
  await expect(templateDialog).toBeVisible()
  await templateDialog.locator('[data-tech-field="pattern-template-search-keyword"]').fill('PT-001')
  await templateDialog
    .locator('tr')
    .filter({ hasText: 'PT-001' })
    .locator('[data-tech-action="select-pattern-template"]')
    .click()
  await expect(patternDialog.getByText('PT-001')).toBeVisible()

  await patternDialog.locator('[data-tech-field="new-pattern-piece-is-template"]').nth(1).selectOption('true')
  templateDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '选择部位模板' })
  await expect(templateDialog).toBeVisible()
  await templateDialog.locator('[data-tech-field="pattern-template-search-keyword"]').fill('PT-002')
  await templateDialog
    .locator('tr')
    .filter({ hasText: 'PT-002' })
    .locator('[data-tech-action="select-pattern-template"]')
    .click()
  await expect(patternDialog.getByText('同一部位只能绑定一个模板，请与同部位裁片保持一致')).toBeVisible()
  await templateDialog.locator('[data-tech-action="close-pattern-template-dialog"]').click()
  await expect(templateDialog).toHaveCount(0)
  await patternDialog.locator('[data-tech-field="new-pattern-piece-is-template"]').nth(1).selectOption('false')
  await patternDialog.locator('[data-tech-action="save-pattern"]').click({ force: true })
  await expect(page.locator('tr').filter({ hasText: patternName })).toBeVisible()

  await injectConflictingTemplateBinding(page, technicalVersionId, patternName)
  await page.reload()
  await page.getByRole('button', { name: '纸样管理', exact: true }).click()
  await page.locator('tr').filter({ hasText: patternName }).locator('[data-tech-action="edit-pattern"]').click()
  const editPatternDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '编辑纸样' })
  await expect(editPatternDialog).toBeVisible()
  await editPatternDialog.locator('[data-tech-action="save-pattern"]').click({ force: true })
  await expect(editPatternDialog.getByText('同一部位只能绑定一个模板，请统一模板绑定后再保存')).toBeVisible()

  await expectNoPageErrors(errors)
})
