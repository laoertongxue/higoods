import { expect, test, type Locator, type Page } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test.use({ viewport: { width: 1440, height: 900 } })

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
  await expect(sheet).toContainText('SAM 核算前置要求')
  await expect(sheet).toContainText('SAM 计算说明')
  await expect(sheet.getByTestId('sam-prereq-section')).toBeVisible()

  const groupCount = await sheet.getByTestId('sam-field-group').count()
  expect(groupCount).toBeGreaterThan(0)
  expect(groupCount).toBeLessThanOrEqual(3)

  const prereqMetrics = await sheet.evaluate((node) => ({
    width: Math.round(node.getBoundingClientRect().width),
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }))

  expect(prereqMetrics.width).toBeGreaterThanOrEqual(900)
  expect(prereqMetrics.scrollHeight).toBeLessThanOrEqual(prereqMetrics.clientHeight + 2)

  await sheet.getByRole('button', { name: 'SAM 计算说明', exact: true }).click()
  const formulaSection = sheet.getByTestId('sam-formula-section')
  await expect(formulaSection).toBeVisible()
  await expect(formulaSection).toContainText('公式')
  await expect(formulaSection).toContainText('说明')
  await expect(formulaSection).toContainText('示例')
  await expect(formulaSection).toContainText(expectedFormula)
  await expect(formulaSection).toContainText('为什么要维护这些字段')

  const formulaMetrics = await sheet.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }))
  expect(formulaMetrics.scrollHeight).toBeLessThanOrEqual(formulaMetrics.clientHeight + 2)
}

test('工艺详情侧边栏展示 SAM 计算说明，公式按核算方式切换，且桌面视口下无需纵向滚动', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典', exact: true })).toBeVisible()

  const craftCases: Array<[string, string]> = [
    ['丝网印', '总SAM = 总量 ÷ 每分钟速度 + 固定准备分钟 + 切换准备分钟'],
    ['匹染', '总SAM = 批次数 × 每批循环分钟 + 固定准备分钟 + 切换准备分钟'],
    ['定位裁', '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟'],
    ['绣花', '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟'],
    ['曲牙', '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟'],
    ['打条', '总SAM = 总量 ÷ 每分钟速度 + 固定准备分钟 + 切换准备分钟'],
    ['洗水', '总SAM = 批次数 × 每批循环分钟 + 固定准备分钟 + 切换准备分钟'],
    ['手缝扣', '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟'],
    ['鸡眼扣', '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟'],
    ['包装', '总SAM = 数量 × 每单位工时 + 固定准备分钟 + 切换准备分钟'],
  ]

  for (const [craftName, expectedFormula] of craftCases) {
    const sheet = await openCraftDetail(page, craftName)
    await assertSheetContent(sheet, expectedFormula)
    await closeCraftDetail(page)
  }

  await expectNoPageErrors(errors)
})
