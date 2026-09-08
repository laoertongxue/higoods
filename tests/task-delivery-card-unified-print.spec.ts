import { expect, test, type Page } from '@playwright/test'

async function prepareCurrentDeliveryCardSources(page: Page): Promise<void> {
  await page.goto('/fcs/progress/handover')
  await page.evaluate(async () => {
    await Promise.all([
      import('/src/data/fcs/printing-task-domain.ts'),
      import('/src/data/fcs/dyeing-task-domain.ts'),
      import('/src/data/fcs/special-craft-task-orders.ts'),
    ])
  })
}

const deliveryCards = [
  {
    name: '毛织任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOR-WOOL-WHOWOOLMOCK081',
    title: '毛织任务交货卡',
    tokens: ['毛织', '交出成衣件数', '实收成衣件数', '差异成衣件数'],
  },
  {
    name: '印花任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&sourceType=HANDOVER_RECORD&sourceId=PHR-DEMO-PWH-WAIT_HANDOVER-PRINT-11-%E4%BA%A4%E5%87%BA%E5%BE%85%E6%94%B6%E8%B4%A7-1&handoverRecordId=PHR-DEMO-PWH-WAIT_HANDOVER-PRINT-11-%E4%BA%A4%E5%87%BA%E5%BE%85%E6%94%B6%E8%B4%A7-1',
    title: '印花任务交货卡',
    tokens: ['印花', '交出辅料数量', '实收辅料数量', '差异辅料数量', '交出明细表'],
  },
  {
    name: '染色任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HDR-HOTASKDYE000728-001',
    title: '染色任务交货卡',
    tokens: ['染色', '交出面料', '实收面料', '差异面料', '交出明细表'],
  },
  {
    name: '特殊工艺任务交货卡',
    url: '/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=PHR-PWH-WAIT_HANDOVER-SPECIAL_CRAFT-5',
    title: '特殊工艺加工单交货卡',
    tokens: ['关联菲票', '交出裁片数量', '实收裁片数量', '差异裁片数量'],
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
    tokens: ['车缝', '交出成衣件数', '实收成衣件数', '是否本厂完成实际工序'],
  },
]

for (const card of deliveryCards) {
  test(`${card.name} 使用统一打印预览`, async ({ page }) => {
    await prepareCurrentDeliveryCardSources(page)
    await page.goto(card.url)

    await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
    await expect(page.getByText(card.title).first()).toBeVisible()
    for (const token of card.tokens) {
      await expect(page.getByText(token).first()).toBeVisible()
    }
    await expect(page.getByText('交出方与接收方').first()).toBeVisible()
    await expect(page.getByText('收货确认信息区').first()).toBeVisible()
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
  await prepareCurrentDeliveryCardSources(page)
  await page.goto('/fcs/print/task-delivery-card?handoverRecordId=PHR-DEMO-PWH-WAIT_HANDOVER-PRINT-11-%E4%BA%A4%E5%87%BA%E5%BE%85%E6%94%B6%E8%B4%A7-1')
  await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
  await expect(page.getByText('印花任务交货卡').first()).toBeVisible()
  await expect(page.getByText('交出方与接收方').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '打印' })).toBeVisible()

  await page.goto('/fcs/task-print/delivery-card/HOTASKDYE000728/HDR-HOTASKDYE000728-001')
  await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
  await expect(page.getByText('染色任务交货卡').first()).toBeVisible()
  await expect(page.getByText('交出明细表').first()).toBeVisible()
})

test('任务交货卡共同打印规则', async ({ page }) => {
  await prepareCurrentDeliveryCardSources(page)
  await page.goto('/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=PHR-PWH-WAIT_HANDOVER-SPECIAL_CRAFT-5')

  const qrBox = page.locator('.print-qr-box .print-qr-inner')
  await expect(qrBox).toBeVisible()
  const qrBounds = await qrBox.boundingBox()
  expect(qrBounds?.width || 0).toBeLessThan(180)
  expect(qrBounds?.height || 0).toBeLessThan(180)

  await expect(page.locator('img[alt="商品图片"]').first()).toBeVisible()
  await expect(page.getByText('开扣眼')).toHaveCount(0)
  await expect(page.getByText('装扣子')).toHaveCount(0)
  await expect(page.getByText('烫包')).toHaveCount(0)

  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })
  await page.getByRole('button', { name: '打印' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled)).toBe(true)
})
