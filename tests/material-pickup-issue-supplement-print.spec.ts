import { expect, test } from '@playwright/test'

async function expectStandalonePrintPage(page: import('@playwright/test').Page, title: string) {
  await expect(page.getByText(title).first()).toBeVisible()
  await expect(page.getByText('商品中心系统')).toHaveCount(0)
  await expect(page.getByText('采购管理系统')).toHaveCount(0)
  await expect(page.getByText('工厂生产协同')).toHaveCount(0)
  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
  await expect(page.getByText('系统占位图')).toHaveCount(0)
  await expect(page.getByText('签字区').first()).toBeVisible()
  await expect(page.locator('.print-qr-box')).toBeVisible()
}

test('裁床配料单从页面入口进入统一打印预览', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/material-prep')
  await page.getByRole('button', { name: '打印配料单' }).first().click()

  await expectStandalonePrintPage(page, '配料单')
  for (const token of ['来源生产单', '原始裁片单', '面料 SKU', '应配面料米数', '已配面料米数', '缺口面料米数', '配置卷数', '裁片单二维码']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('扫码查看裁片单配料与领料信息').first()).toBeVisible()
})

test('工厂领料单从 PDA 领料页面进入统一打印预览', async ({ page }) => {
  await page.goto('/fcs/pda/cutting/pickup/TASK-CUT-000087?executionOrderNo=CPO-20260319-A')
  await page.getByRole('button', { name: '打印领料单' }).click()

  await expect(page).toHaveURL(/\/fcs\/print\/preview/)
  await expectStandalonePrintPage(page, '领料单')
  for (const token of ['领料单号', '领料工厂', '发料仓库', '应领对象数量', '实领对象数量', '差异对象数量', '打印版本']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('扫码确认领料').first()).toBeVisible()
})

test('仓库发料单从裁片发料页面进入统一打印预览', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/sewing-dispatch')
  await page.getByRole('button', { name: '打印发料单' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/print\/preview/)
  await expectStandalonePrintPage(page, '发料单')
  for (const token of ['发料单号', '发料仓库', '接收工厂', '应发对象数量', '实发对象数量', '差异对象数量']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('扫码查看发料记录').first()).toBeVisible()
})

test('补料单从补料管理页面进入统一打印预览', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/replenishment')
  await page.getByRole('button', { name: '打印补料单' }).first().click()

  await expect(page).toHaveURL(/\/fcs\/print\/preview/)
  await expectStandalonePrintPage(page, '补料单')
  for (const token of ['补料原因', '原需求对象数量', '缺口对象数量', '申请补料对象数量', '审核通过对象数量', '实发补料对象数量']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('扫码查看补料申请与发料记录').first()).toBeVisible()
})

test('配料领料类打印页共同规则和前三步能力不回退', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=MATERIAL_PREP_SLIP&sourceId=material-prep%3ACUT-260302-001-01')
  await expectStandalonePrintPage(page, '配料单')
  const materialQrBox = page.locator('.print-qr-box .print-qr-inner')
  await expect(materialQrBox).toBeVisible()
  const materialQrBounds = await materialQrBox.boundingBox()
  expect(materialQrBounds?.width || 0).toBeLessThan(180)
  expect(materialQrBounds?.height || 0).toBeLessThan(180)

  await page.goto('/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001')
  await expectStandalonePrintPage(page, '印花任务流转卡')

  await page.goto('/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOH-MOCK-PRINT-410-001')
  await expectStandalonePrintPage(page, '印花任务交货卡')

  await page.goto('/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=POST_FINISHING_WORK_ORDER&sourceId=POST-WO-001')
  await expectStandalonePrintPage(page, '后道任务流转卡')
  await expect(page.getByText('接收领料 -> 质检 -> 后道 -> 复检 -> 交出').first()).toBeVisible()
})
