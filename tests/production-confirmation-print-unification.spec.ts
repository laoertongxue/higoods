import { expect, test } from '@playwright/test'

const productionOrderId = 'PO-202603-0004'

async function expectStandalonePrintPage(page: import('@playwright/test').Page, title: string) {
  await expect(page.locator('.print-preview-root')).toBeVisible()
  await expect(page.getByText(title).first()).toBeVisible()
  await expect(page.getByText('商品中心系统')).toHaveCount(0)
  await expect(page.getByText('采购管理系统')).toHaveCount(0)
  await expect(page.getByText('工厂生产协同')).toHaveCount(0)
  await expect(page.getByText('工作台')).toHaveCount(0)
  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
  await expect(page.getByText('系统占位图')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '打印' })).toBeVisible()
}

test('旧生产确认单入口接入统一打印预览', async ({ page }) => {
  await page.goto(`/fcs/production/orders/${productionOrderId}/confirmation-print`)

  await expectStandalonePrintPage(page, '生产确认单')
  for (const token of ['生产确认单号', '生产单号', '来源需求单号', '款号', 'SPU', '要求交期', '生产备注']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.locator('.print-qr-inner').first()).toBeVisible()
})

test('生产确认单统一打印预览包含核心生产资料', async ({ page }) => {
  await page.goto(`/fcs/print/preview?documentType=PRODUCTION_CONFIRMATION&sourceType=PRODUCTION_ORDER&sourceId=${productionOrderId}`)

  await expectStandalonePrintPage(page, '生产确认单')
  for (const token of [
    '商品主图',
    'SKU / 颜色 / 尺码数量矩阵',
    '面辅料信息区',
    '工序工艺区',
    '质检标准区',
    '确认与签字区',
    '计划生产成衣件数',
    '单件面料用量',
    '计划面料米数',
    '计划辅料数量',
  ]) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('数量：')).toHaveCount(0)
})

test('生产单详情可打印做货确认单且内容偏现场执行', async ({ page }) => {
  await page.goto(`/fcs/production/orders/${productionOrderId}`)
  await page.getByRole('button', { name: '打印做货确认单' }).click()

  await expect(page).toHaveURL(/documentType=MAKE_GOODS_CONFIRMATION/)
  await expectStandalonePrintPage(page, '做货确认单')
  for (const token of [
    '做货数量区',
    '面料区',
    '辅料区',
    '工艺要求区',
    '纸样 / 尺寸 / 唛架说明区',
    '工厂确认区',
    '工厂现场做货',
  ]) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('确认与签字区')).toHaveCount(0)
})

test('生产资料图片和 A4 多页规则可见且不撑破页面', async ({ page }) => {
  await page.goto(`/fcs/print/preview?documentType=PRODUCTION_CONFIRMATION&sourceType=PRODUCTION_ORDER&sourceId=${productionOrderId}`)

  for (const token of ['商品主图', '款式图', '样衣图', '面料图', '辅料图', '纸样图', '唛架图', '花型图']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('暂无图片').first()).toBeVisible()
  await expect(page.getByText('第 1 页 / 共 N 页').first()).toBeVisible()
  const paper = await page.locator('.print-paper-a4').first().boundingBox()
  expect(paper?.width || 0).toBeLessThan(900)
})

test('前五步打印能力不回退', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001')
  await expect(page.getByText('印花任务流转卡').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOH-MOCK-PRINT-410-001')
  await expect(page.getByText('印花任务交货卡').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=MATERIAL_PREP_SLIP&sourceId=material-prep%3ACUT-260302-001-01')
  await expect(page.getByText('配料单').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=CUT-260226-014-01%3A%3A001')
  await expect(page.getByText('菲票').first()).toBeVisible()

  await page.goto('/fcs/print/preview?documentType=TRANSFER_BAG_LABEL&sourceType=TRANSFER_BAG_RECORD&sourceId=carrier-bag-005')
  await expect(page.getByText('中转袋二维码').first()).toBeVisible()
})
