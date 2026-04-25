import { expect, test } from '@playwright/test'

const deliveryCards = [
  {
    name: '通用任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOH-MOCK-QC-404-001',
    title: '任务交货卡',
    tokens: ['交出方与接收方', '本次交出信息区', '交出成衣件数', '实收成衣件数', '差异成衣件数'],
  },
  {
    name: '印花任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&sourceType=HANDOVER_RECORD&sourceId=HOH-MOCK-PRINT-410-001&handoverRecordId=HOH-MOCK-PRINT-410-001',
    title: '印花任务交货卡',
    tokens: ['印花', '交出面料', '实收面料', '差异面料', '交出明细表'],
  },
  {
    name: '染色任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HDR-HOTASKDYE000728-001',
    title: '染色任务交货卡',
    tokens: ['染色', '交出面料', '实收面料', '差异面料', '交出明细表'],
  },
  {
    name: '特殊工艺任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=PHR-PWH-WAIT_HANDOVER-SPECIAL_CRAFT-2',
    title: '特殊工艺任务交货卡',
    tokens: ['关联菲票', '交出裁片数量', '实收裁片数量', '差异裁片数量'],
  },
  {
    name: '后道任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=PHR-PFP-WH-005',
    title: '后道任务交货卡',
    tokens: ['后道工厂', '复检确认成衣件数', '交出成衣件数', '实收成衣件数', '差异成衣件数'],
  },
  {
    name: '裁片任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOR-MOCK-CUT103-OPEN-001',
    title: '裁片任务交货卡',
    tokens: ['菲票号', '交出裁片数量', '实收裁片数量', '差异裁片数量'],
  },
  {
    name: '车缝任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOH-MOCK-SEW-401-001',
    title: '车缝任务交货卡',
    tokens: ['车缝', '交出成衣件数', '实收成衣件数', '是否本厂完成后道'],
  },
]

for (const card of deliveryCards) {
  test(`${card.name} 使用统一打印预览`, async ({ page }) => {
    await page.goto(card.url)

    await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
    await expect(page.getByText(card.title).first()).toBeVisible()
    for (const token of card.tokens) {
      await expect(page.getByText(token).first()).toBeVisible()
    }
    await expect(page.getByText('交出方与接收方').first()).toBeVisible()
    await expect(page.getByText('回写信息区').first()).toBeVisible()
    await expect(page.getByText('差异记录区').first()).toBeVisible()
    await expect(page.getByText('签字区').first()).toBeVisible()
    await expect(page.getByText('扫码查看交出记录').first()).toBeVisible()
    await expect(page.locator('.print-qr-box')).toBeVisible()
    await expect(page.getByText('商品中心系统')).toHaveCount(0)
    await expect(page.getByText('采购管理系统')).toHaveCount(0)
    await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
    await expect(page.getByText('系统占位图')).toHaveCount(0)
  })
}

test('旧任务交货卡路由继续渲染统一模板', async ({ page }) => {
  await page.goto('/fcs/print/task-delivery-card?handoverRecordId=HOH-MOCK-PRINT-410-001')
  await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
  await expect(page.getByText('印花任务交货卡').first()).toBeVisible()
  await expect(page.getByText('交出方与接收方').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '打印' })).toBeVisible()

  await page.goto('/fcs/task-print/delivery-card/HOH-MOCK-DYE-413/HOH-MOCK-DYE-413-001')
  await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
  await expect(page.getByText('染色任务交货卡').first()).toBeVisible()
  await expect(page.getByText('交出明细表').first()).toBeVisible()
})

test('任务交货卡共同打印规则', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=PHR-PFP-WH-005')

  const qrBox = page.locator('.print-qr-box .print-qr-inner')
  await expect(qrBox).toBeVisible()
  const qrBounds = await qrBox.boundingBox()
  expect(qrBounds?.width || 0).toBeLessThan(180)
  expect(qrBounds?.height || 0).toBeLessThan(180)

  await expect(page.getByText('暂无商品图').first()).toBeVisible()
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('熨烫')).toHaveCount(0)

  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })
  await page.getByRole('button', { name: '打印' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled)).toBe(true)
})
