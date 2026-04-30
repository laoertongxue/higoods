import { expect, test, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCurrentTechPack(page: Page): Promise<void> {
  await page.goto('/fcs/production/demand-inbox')
  await expect(page.getByRole('heading', { name: '生产需求接收', exact: true })).toBeVisible()
  await page.locator('[data-prod-action="open-current-tech-pack"][data-spu-code="SPU-2024-001"]').first().click()
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30_000 })
}

async function openBomTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: '物料清单', exact: true }).click()
  await expect(page.getByRole('heading', { name: '物料清单', exact: true })).toBeVisible()
}

async function openProcessTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: '工序工艺', exact: true }).click()
  await expect(page.getByRole('heading', { name: '工序工艺', exact: true })).toBeVisible()
}

async function setAllBomRequirement(page: Page, field: 'bom-shrink' | 'bom-wash', value: '是' | '否'): Promise<void> {
  const selector = `[data-tech-field="${field}"]`
  const count = await page.locator(selector).count()
  for (let index = 0; index < count; index += 1) {
    await page.locator(selector).nth(index).selectOption(value)
  }
}

test('BOM 缩水/洗水需求联动准备阶段工序和版本快照展示', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await openBomTab(page)

  await expect(page.getByRole('columnheader', { name: '缩水需求', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '洗水需求', exact: true })).toBeVisible()
  await expect(page.getByTestId('bom-shrink-requirement-select').first()).toContainText('是')
  await expect(page.getByTestId('bom-shrink-requirement-select').first()).toContainText('否')
  await expect(page.getByTestId('bom-wash-requirement-select').first()).toContainText('是')
  await expect(page.getByTestId('bom-wash-requirement-select').first()).toContainText('否')

  await page.locator('[data-tech-action="open-add-bom"]').click()
  const bomDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '添加物料' })
  await expect(bomDialog).toBeVisible()
  await expect(bomDialog.getByTestId('new-bom-shrink-requirement')).toHaveValue('否')
  await expect(bomDialog.getByTestId('new-bom-wash-requirement')).toHaveValue('否')
  await bomDialog.locator('[data-tech-action="close-add-bom"]').click()
  await expect(bomDialog).toHaveCount(0)

  await openProcessTab(page)
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toContainText('缩水')
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toContainText('物料清单自动生成')
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toContainText('触发字段：缩水需求')
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toContainText('洗水')
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toContainText('物料清单自动生成')
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toContainText('触发字段：洗水需求')

  await openBomTab(page)
  await setAllBomRequirement(page, 'bom-shrink', '否')
  await setAllBomRequirement(page, 'bom-wash', '否')
  await openProcessTab(page)
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toHaveCount(0)
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toHaveCount(0)

  await openBomTab(page)
  await page.locator('[data-tech-field="bom-shrink"]').first().selectOption('是')
  await page.locator('[data-tech-field="bom-wash"]').nth(1).selectOption('是')
  await openProcessTab(page)
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toContainText('缩水')
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toContainText('洗水')
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toContainText('状态：已生成')
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toContainText('状态：已生成')

  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典' })).toBeVisible()
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).toContainText('洗水')
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).not.toContainText('裁片部位可选：洗水')
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).not.toContainText('裁片部位可选：缩水')

  await expectNoPageErrors(errors)
})
