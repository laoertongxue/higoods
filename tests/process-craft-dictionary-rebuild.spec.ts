import { expect, test } from '@playwright/test'

test('工序工艺字典展示准备阶段、特殊工艺分类和裁床工艺新口径', async ({ page }) => {
  await page.goto('/fcs/production/craft-dict')

  await expect(page.getByRole('heading', { name: '工序工艺字典' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).toBeVisible()

  const body = page.locator('body')
  await expect(body).toContainText('准备阶段')
  await expect(body).toContainText('缩水')
  await expect(body).toContainText('洗水')

  await expect(body).toContainText('辅助工艺')
  for (const craft of ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣花', '捆条']) {
    await expect(body).toContainText(craft)
  }

  await expect(body).toContainText('特种工艺')
  for (const craft of ['模板工序', '激光开袋', '特种车缝（花样机）', '橡筋定长切割']) {
    await expect(body).toContainText(craft)
  }

  await expect(body).toContainText('捆条（面料）')
  await expect(body).toContainText('橡筋定长切割（辅料）')

  await expect(body).toContainText('裁床工序')
  for (const craft of ['普通裁', '激光定位裁', '定向裁']) {
    await expect(body).toContainText(craft)
  }

  await expect(body).not.toContainText('AUXILIARY')
  await expect(body).not.toContainText('CUT_PIECE_PART')
  await expect(body).not.toContainText('ACCESSORY')
  await expect(page.getByTestId('craft-dict-table-section')).toBeVisible()
})
