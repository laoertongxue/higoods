import { expect, test } from '@playwright/test'

test('四颜色矩阵的十版历史可追溯且卡片交互只刷新抽屉', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-piece-release?productionOrderId=po-14671&productionOrderNo=PO14671', { waitUntil: 'domcontentloaded' })

  const detailPage = page.locator('[data-cut-piece-release-detail-page]')
  const matrixPanel = page.locator('[data-cut-piece-release-matrix-panel]')
  await expect(detailPage).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()
  await expect(matrixPanel).toContainText('当前版本 V10')
  for (const color of ['Black', 'White', 'Navy', 'Red']) {
    await expect(matrixPanel.getByRole('heading', { name: color, exact: true })).toBeVisible()
  }

  await page.evaluate(() => {
    const detail = document.querySelector<HTMLElement>('[data-cut-piece-release-detail-page]')
    const matrix = document.querySelector<HTMLElement>('[data-cut-piece-release-matrix-panel]')
    if (detail) detail.dataset.historyStableReference = 'detail-root'
    if (matrix) matrix.dataset.historyStableReference = 'matrix-panel'
    window.scrollTo(0, 360)
  })
  const pageScrollBefore = await page.evaluate(() => window.scrollY)

  await page.getByTestId('cut-piece-release-open-history').click()
  const drawer = page.getByTestId('cut-piece-release-history-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('第 1 / 2 页 · 每页 5 条 · 共 10 条')
  await expect(drawer).toContainText('V10 · 目标确认')
  await expect(drawer).toContainText('V9 · 铺布完成')

  const v9 = drawer.locator('[data-cut-piece-release-history-version="9"]')
  await expect(v9).toContainText('来源裁片单：CUT14671-RED-02')
  await expect(v9).toContainText('铺布单：PB-14671-RED-02')
  await expect(v9).toContainText('受影响颜色：Red')
  await expect(v9).toContainText('齐套变化：M 80 件 → 150 件；L 120 件 → 235 件；XL 150 件 → 300 件')
  await expect(v9).toContainText('变化物料点：9 个')
  await expect(v9).not.toContainText('裁片部位')
  await expect(v9).not.toContainText('片/件')

  await v9.getByRole('button', { name: '展开详情' }).click()
  await expect(v9.getByRole('button', { name: '收起详情' })).toBeVisible()
  for (const summary of [
    'Red / M：80 件 → 150 件（+70 件）',
    'Red / L：120 件 → 235 件（+115 件）',
    'Red / XL：150 件 → 300 件（+150 件）',
    'Red / M / 物料 A：80 件 → 160 件（+80 件）',
    'Red / M / 物料 C：80 件 → 165 件（+85 件）',
    'Red / M / 物料 D：80 件 → 155 件（+75 件）',
    'Red / L / 物料 A：120 件 → 240 件（+120 件）',
    'Red / L / 物料 C：120 件 → 250 件（+130 件）',
    'Red / L / 物料 D：120 件 → 238 件（+118 件）',
    'Red / XL / 物料 A：150 件 → 315 件（+165 件）',
    'Red / XL / 物料 C：150 件 → 320 件（+170 件）',
    'Red / XL / 物料 D：150 件 → 305 件（+155 件）',
  ]) {
    await expect(v9).toContainText(summary)
  }
  await expect(detailPage).toHaveAttribute('data-history-stable-reference', 'detail-root')
  await expect(matrixPanel).toHaveAttribute('data-history-stable-reference', 'matrix-panel')
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore)

  const v10 = drawer.locator('[data-cut-piece-release-history-version="10"]')
  await v10.getByRole('button', { name: '展开详情' }).click()
  await expect(v10).toContainText('已确认目标（12 个颜色尺码）')
  await expect(v10).toContainText('Black / M：208 件')
  await expect(v10).toContainText('Red / XL：320 件')
  await expect(v10).toContainText('需补 19 个物料点')
  await expect(v10).toContainText('刚好 13 个物料点')
  await expect(v10).toContainText('多余 16 个物料点')

  const v8 = drawer.locator('[data-cut-piece-release-history-version="8"]')
  await v8.getByRole('button', { name: '展开详情' }).click()
  await expect(v8).toContainText('已冻结，不再更新；最后有效数量继续参与计算')
  await expect(v8).toContainText('变化物料点：0 个')

  await drawer.getByRole('button', { name: '下一页' }).click()
  await expect(drawer).toContainText('第 2 / 2 页 · 每页 5 条 · 共 10 条')
  for (const version of [5, 4, 3, 2, 1]) {
    await expect(drawer.locator(`[data-cut-piece-release-history-version="${version}"]`)).toBeVisible()
  }
  const v1 = drawer.locator('[data-cut-piece-release-history-version="1"]')
  await expect(v1).toContainText('来源裁片单：CUT14671-A、CUT14671-B')
  await expect(detailPage).toHaveAttribute('data-history-stable-reference', 'detail-root')
  await expect(matrixPanel).toHaveAttribute('data-history-stable-reference', 'matrix-panel')
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore)
})
