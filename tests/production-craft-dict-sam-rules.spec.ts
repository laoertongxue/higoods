import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

async function openCraftDetail(page: Page, craftName: string): Promise<Locator> {
  const search = page.locator('[data-craft-dict-field="keyword"]')
  await search.fill(craftName)

  const row = page.locator('tbody tr').filter({ hasText: craftName }).first()
  await expect(row).toBeVisible()
  await row.locator('[data-craft-dict-action="open-detail"]').click()

  const sheet = page.getByTestId('craft-dict-detail-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('工艺详情')
  await expect(sheet).toContainText(craftName)
  return sheet
}

async function assertCurrentStageSection(sheet: Locator): Promise<Locator> {
  await sheet.getByRole('button', { name: '当前阶段口径', exact: true }).click()
  const currentSection = sheet.getByTestId('craft-current-section')
  await expect(currentSection).toBeVisible()
  await expect(currentSection).toContainText('当前阶段最小必要字段')
  await expect(currentSection).toContainText('当前阶段公式')
  await expect(currentSection).toContainText('当前阶段说明')
  await expect(currentSection).toContainText('当前阶段示例')
  await expect(currentSection).toContainText('默认日可供给发布工时 SAM')
  await expect(currentSection.locator('[data-testid="sam-field-item"]')).not.toHaveCount(0)
  await expect(currentSection).not.toContainText('undefined')
  return currentSection
}

async function closeCraftDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByTestId('craft-dict-detail-sheet')).toBeHidden()
}

test('工艺详情弹窗展示标准完整口径与当前阶段口径，并覆盖关键工艺差异', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  const coveredCrafts = ['丝网印', '匹染', '定位裁', '绣花', '曲牙', '打条', '洗水', '手缝扣', '鸡眼扣', '包装']

  for (const craftName of coveredCrafts) {
    const sheet = await openCraftDetail(page, craftName)
    await expect(sheet).toContainText('标准完整口径')
    await assertCurrentStageSection(sheet)
    await closeCraftDetail(page)
  }

  const specialDiscrete = await openCraftDetail(page, '打揽')
  let currentSection = await assertCurrentStageSection(specialDiscrete)
  await expect(currentSection).toContainText('设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue')
  await closeCraftDetail(page)

  const specialContinuous = await openCraftDetail(page, '打条')
  currentSection = await assertCurrentStageSection(specialContinuous)
  await expect(currentSection).toContainText('设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue')
  await expect(currentSection).toContainText('连续型')
  await closeCraftDetail(page)

  const handButton = await openCraftDetail(page, '手缝扣')
  currentSection = await assertCurrentStageSection(handButton)
  await expect(currentSection).toContainText('基础日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue')
  await closeCraftDetail(page)

  const machineButton = await openCraftDetail(page, '机打扣')
  currentSection = await assertCurrentStageSection(machineButton)
  await expect(currentSection).toContainText('设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue')
  await expect(currentSection).toContainText('默认日可供给发布工时 SAM')
  await closeCraftDetail(page)

  await expectNoPageErrors(errors)
})
