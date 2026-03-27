import { expect, test } from '@playwright/test'

test('平台端质检记录列表可渲染四层链路入口', async ({ page }) => {
  await page.goto('/fcs/quality/qc-records')
  await expect(page.locator('body')).toContainText('质检记录')
  await expect(page.locator('body')).toContainText('待工厂处理')
  await expect(page.locator('body')).toContainText('待平台处理')
  await expect(page.locator('body')).toContainText('查看详情')
})

test('平台端质检记录详情按待确认 / 异议 / 正式流水展示', async ({ page }) => {
  await page.goto('/fcs/quality/qc-records/QC-NEW-005')
  await expect(page.locator('body')).toContainText('待确认质量扣款记录')
  await expect(page.locator('body')).toContainText('待工厂处理')
  await expect(page.locator('body')).toContainText('是否已形成正式流水')

  await page.goto('/fcs/quality/qc-records/QC-NEW-006')
  await expect(page.locator('body')).toContainText('工厂响应与异议')
  await expect(page.locator('body')).toContainText('待平台处理')
  await expect(page.locator('body')).toContainText('质量异议')

  await page.goto('/fcs/quality/qc-records/QC-RIB-202603-0003')
  await expect(page.locator('body')).toContainText('正式质量扣款流水与预结算衔接')
  await expect(page.locator('body')).toContainText('已生成正式质量扣款流水')
})

test('工厂端质量页与结算页可感知正式质量扣款流水', async ({ page }) => {
  await page.goto('/fcs/pda/quality')
  await expect(page.locator('body')).toContainText('待处理')
  await expect(page.locator('body')).toContainText('异议中')
  await expect(page.locator('body')).toContainText('已处理')
  await expect(page.locator('body')).toContainText('确认处理')

  await page.goto('/fcs/pda/settlement')
  await expect(page.locator('body')).toContainText('结算')
  await expect(page.locator('body')).toContainText('结算周期')
  await expect(page.locator('body')).toContainText('质量扣款正式流水金额')
  await expect(page.locator('body')).toContainText('预付净额')
})
