import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test.use({ viewport: { width: 1440, height: 900 } })

const INTERNAL_FIELD_KEYS = [
  'deviceCount',
  'deviceShiftMinutes',
  'deviceEfficiencyValue',
  'deviceEfficiencyUnit',
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
  'setupMinutes',
  'switchMinutes',
  'efficiencyFactor',
  'batchLoadCapacity',
  'batchLoadUnit',
  'cycleMinutes',
]

async function openCraftDetail(page: Page, craftName: string): Promise<Locator> {
  await page.locator('[data-craft-dict-field="keyword"]').fill(craftName)

  const row = page.locator('tbody tr').filter({ hasText: craftName }).first()
  await expect(row).toBeVisible()
  await row.locator('[data-craft-dict-action="open-detail"]').click()

  const sheet = page.getByTestId('craft-dict-detail-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText(craftName)
  return sheet
}

async function closeCraftDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByTestId('craft-dict-detail-sheet')).toBeHidden()
}

async function assertSheetContent(sheet: Locator, expectedFormula: string): Promise<void> {
  await expect(sheet).toContainText('基础信息')
  await expect(sheet).toContainText('标准完整口径')
  await expect(sheet).toContainText('当前阶段口径')

  const panelMetrics = await sheet.evaluate((node) => ({
    width: Math.round(node.getBoundingClientRect().width),
  }))
  expect(panelMetrics.width).toBeGreaterThanOrEqual(900)

  await sheet.getByRole('button', { name: '标准完整口径', exact: true }).click()
  const idealSection = sheet.getByTestId('craft-ideal-section')
  await expect(idealSection).toBeVisible()
  await expect(idealSection).toContainText('工厂供给侧公式')
  await expect(idealSection).toContainText('理想完整字段')
  await expect(idealSection).toContainText('理想完整说明')
  await expect(idealSection).toContainText('当前阶段口径不是另一套独立规则')

  await sheet.getByRole('button', { name: '当前阶段口径', exact: true }).click()
  const currentSection = sheet.getByTestId('craft-current-section')
  await expect(currentSection).toBeVisible()
  await expect(currentSection).toContainText('当前阶段最小必要字段')
  await expect(currentSection).toContainText('当前阶段公式')
  await expect(currentSection).toContainText('当前阶段说明')
  await expect(currentSection).toContainText('当前阶段示例')
  await expect(currentSection).toContainText('默认日可供给发布工时 SAM 是系统根据当前阶段字段自动算出来的结果字段')
  await expect(currentSection).toContainText(expectedFormula)
  await expect(currentSection).toContainText('某工厂做')
  await expect(currentSection).not.toContainText('这批任务')
  await expect(currentSection).not.toContainText('任务总 SAM')
  for (const fieldKey of INTERNAL_FIELD_KEYS) {
    await expect(currentSection).not.toContainText(fieldKey)
  }

  const currentFieldGroups = await currentSection.getByTestId('sam-field-group').count()
  expect(currentFieldGroups).toBeGreaterThan(0)
  expect(currentFieldGroups).toBeLessThanOrEqual(3)
}

test('工艺详情侧边栏展示理想完整口径与当前阶段口径，代表工艺覆盖四套当前阶段模板', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  const craftCases: Array<[string, string]> = [
    ['基础连接', '基础日能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值'],
    ['曲牙', '设备侧日能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值'],
    ['丝网印', '设备侧日能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值'],
    ['匹染', '单台默认日可运行批数 = 单台默认日有效分钟 ÷ 单次循环分钟'],
    ['洗水', '单台默认日可运行批数 = 单台默认日有效分钟 ÷ 单次循环分钟'],
    ['手缝扣', '基础日能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值'],
    ['包装', '基础日能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值'],
    ['绣花', '设备侧日能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值'],
    ['打条', '设备侧日能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值'],
    ['捆条', '设备侧日能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值'],
    ['鸡眼扣', '设备侧日能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值'],
    ['缩水', '单台默认日可运行批数 = 单台默认日有效分钟 ÷ 单次循环分钟'],
  ]

  for (const [craftName, expectedFormula] of craftCases) {
    const sheet = await openCraftDetail(page, craftName)
    await assertSheetContent(sheet, expectedFormula)
    await closeCraftDetail(page)
  }

  await expectNoPageErrors(errors)
})
