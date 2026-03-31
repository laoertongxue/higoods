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

async function assertSamSection(sheet: Locator): Promise<Locator> {
  const samSection = sheet.getByTestId('sam-prereq-section')
  await expect(samSection).toBeVisible()
  await expect(samSection).toContainText('SAM 核算前置要求')
  await expect(samSection).toContainText('是否纳入产能管理')
  await expect(samSection).toContainText('SAM 核算方式')
  await expect(samSection).toContainText('默认录入口径')
  await expect(samSection).toContainText('能力约束来源')
  await expect(samSection).toContainText('工厂产能档案必填字段')
  await expect(samSection).toContainText('规则说明')
  await expect(samSection.locator('[data-testid="sam-field-item"]')).not.toHaveCount(0)
  await expect(samSection).not.toContainText('undefined')
  return samSection
}

async function closeCraftDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByTestId('craft-dict-detail-sheet')).toBeHidden()
}

test('工艺详情弹窗展示最终合并后的 SAM 核算前置要求，并覆盖关键工艺差异', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  const coveredCrafts = ['丝网印', '匹染', '定位裁', '绣花', '曲牙', '打条', '洗水', '手缝扣', '鸡眼扣', '包装']

  for (const craftName of coveredCrafts) {
    const sheet = await openCraftDetail(page, craftName)
    await assertSamSection(sheet)
    await closeCraftDetail(page)
  }

  const specialDiscrete = await openCraftDetail(page, '打揽')
  let samSection = await assertSamSection(specialDiscrete)
  await expect(samSection).toContainText('离散型')
  await expect(samSection).toContainText('按件录入')
  await expect(samSection).toContainText('设备+人员共同约束')
  await closeCraftDetail(page)

  const specialContinuous = await openCraftDetail(page, '打条')
  samSection = await assertSamSection(specialContinuous)
  await expect(samSection).toContainText('连续型')
  await expect(samSection).toContainText('按米录入')
  await expect(samSection).toContainText('打条能力按连续长度推进')
  await closeCraftDetail(page)

  const handButton = await openCraftDetail(page, '手缝扣')
  samSection = await assertSamSection(handButton)
  await expect(samSection).toContainText('人员约束')
  await closeCraftDetail(page)

  const machineButton = await openCraftDetail(page, '机打扣')
  samSection = await assertSamSection(machineButton)
  await expect(samSection).toContainText('设备+人员共同约束')
  await expect(samSection).toContainText('机打扣依赖专机与操作人共同产出')
  await closeCraftDetail(page)

  await expectNoPageErrors(errors)
})
