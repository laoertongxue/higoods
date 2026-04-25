import { expect, test } from '@playwright/test'

async function expectStandaloneLabelPage(page: import('@playwright/test').Page, title: string) {
  await expect(page.locator('.print-preview-root')).toBeVisible()
  await expect(page.getByText(title).first()).toBeVisible()
  await expect(page.getByText('商品中心系统')).toHaveCount(0)
  await expect(page.getByText('采购管理系统')).toHaveCount(0)
  await expect(page.getByText('工厂生产协同')).toHaveCount(0)
  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
  await expect(page.getByText('系统占位图')).toHaveCount(0)
  await expect(page.locator('.print-label-qr').first()).toBeVisible()
}

test('菲票首次打印进入统一标签打印预览', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=CUT-260226-014-01%3A%3A001')

  await expectStandaloneLabelPage(page, '菲票')
  for (const token of ['菲票号', '原始裁片单', '生产单', 'SKU / 颜色 / 尺码', '裁片部位', '裁片数量', '菲票归属原始裁片单']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('菲票归属合并裁剪批次')).toHaveCount(0)
  await expect(page.getByText('扫码查看菲票').first()).toBeVisible()
})

test('菲票补打保留原菲票号和原始裁片单', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=CUT-260226-014-01%3A%3A001')

  await expectStandaloneLabelPage(page, '菲票补打标签')
  for (const token of ['补打', '第 1 次补打', '原菲票号', '原始裁片单', '裁片数量', '补打不改变菲票归属']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('菲票归属合并裁剪批次')).toHaveCount(0)
})

test('菲票作废标识不可作为有效流转凭证', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=FEI_TICKET_VOID_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=CUT-260301-005-01%3A%3A001')

  await expectStandaloneLabelPage(page, '菲票作废标识')
  for (const token of ['已作废', '不可流转', '作废原因', '作废人', '作废时间', '扫码查看作废记录']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('开始执行')).toHaveCount(0)
})

test('中转袋二维码展示载具与菲票绑定关系', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=TRANSFER_BAG_LABEL&sourceType=TRANSFER_BAG_RECORD&sourceId=traceability-usage-spreading-session-original-order-cut-260308-081-02-done-pda-a')

  await expectStandaloneLabelPage(page, '中转袋二维码')
  for (const token of ['载具类型', '载具编码', '当前使用周期', '当前归属任务', '当前归属工厂', '绑定菲票数量', '绑定裁片数量', '当前状态']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('扫码查看载具与菲票绑定').first()).toBeVisible()
})

test('裁片单二维码对应原始裁片单且不作为菲票归属主体', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=CUTTING_ORDER_QR_LABEL&sourceType=CUTTING_ORDER_RECORD&sourceId=CUT-260226-014-01')

  await expectStandaloneLabelPage(page, '裁片单二维码')
  for (const token of ['原始裁片单号', '生产单', '面料 SKU', '面料颜色', '计划裁片数量', '配料状态', '领料状态', '裁片单二维码对应原始裁片单']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('菲票归属合并裁剪批次')).toHaveCount(0)
})

test('交出记录二维码关联统一交出记录', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=HANDOVER_QR_LABEL&sourceType=HANDOVER_RECORD&sourceId=HOH-MOCK-PRINT-410-001')

  await expectStandaloneLabelPage(page, '交出记录二维码')
  for (const token of ['交出记录号', '来源单据号', '生产单', '交出方', '接收方', '交出对象类型', '交出面料米数', '实收面料米数', '差异面料米数', '当前状态']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('扫码查看交出记录').first()).toBeVisible()
})

test('菲票 A4 多标签排版边界清晰且二维码不被切断', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=cut-order%3ACUT-260226-014-01')

  await expect(page.locator('.print-label-grid-a4')).toBeVisible()
  await expect(page.locator('.print-label-card').first()).toBeVisible()
  expect(await page.locator('.print-label-card').count()).toBeGreaterThan(1)
  await expect(page.getByText('菲票归属原始裁片单').first()).toBeVisible()
  const qrBoxes = page.locator('.print-label-qr svg')
  await expect(qrBoxes.first()).toBeVisible()
  const firstQr = await qrBoxes.first().boundingBox()
  expect(firstQr?.width || 0).toBeLessThan(140)
  expect(firstQr?.height || 0).toBeLessThan(140)
})

test('标签打印入口和前四步打印能力不回退', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/fei-tickets')
  await page.locator('main [data-nav*="documentType=FEI_TICKET_LABEL"]').first().click()
  await expectStandaloneLabelPage(page, '菲票')

  await page.goto('/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001')
  await expect(page.getByText('印花任务流转卡').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOH-MOCK-PRINT-410-001')
  await expect(page.getByText('印花任务交货卡').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=MATERIAL_PREP_SLIP&sourceId=material-prep%3ACUT-260302-001-01')
  await expect(page.getByText('配料单').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=PICKUP_SLIP&sourceId=pickup%3ATASK-CUT-000087')
  await expect(page.getByText('领料单').first()).toBeVisible()
})
