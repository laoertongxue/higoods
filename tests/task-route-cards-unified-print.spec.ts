import { expect, test } from '@playwright/test'

const routeCards = [
  {
    name: '通用运行时任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=RUNTIME_TASK&sourceId=TASKGEN-202603-0001-001__ORDER',
    title: '任务流转卡',
    tokens: ['任务编号', '生产单号', '工序', '工艺', '工厂', '计划对象数量'],
  },
  {
    name: '印花任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001',
    title: '印花任务流转卡',
    tokens: ['花型号', '面料 SKU', '计划印花面料米数', '打印', '转印', '交出', '审核'],
  },
  {
    name: '染色任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=DYEING_WORK_ORDER&sourceId=DWO-001',
    title: '染色任务流转卡',
    tokens: ['原料面料 SKU', '目标颜色', '色号', '染缸', '染色', '包装', '交出', '审核'],
  },
  {
    name: '特殊工艺任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=SPECIAL_CRAFT_TASK_ORDER&sourceId=SC-TASK-SC-OP-008-01',
    title: '打揽任务流转卡',
    tokens: ['菲票', '裁片数量', '差异', '交出'],
  },
  {
    name: '后道任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=POST_FINISHING_WORK_ORDER&sourceId=POST-WO-001',
    title: '后道任务流转卡',
    tokens: ['接收领料', '质检', '后道', '复检', '交出', '成衣件数'],
  },
  {
    name: '原始裁片单任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=CUTTING_ORIGINAL_ORDER&sourceId=CUT-260302-001-01',
    title: '原始裁片单任务流转卡',
    tokens: ['原始裁片单号', '面料 SKU', '订单成衣件数', '计划裁片数量', '配料', '领料', '裁剪', '菲票'],
  },
  {
    name: '裁片批次任务流转卡',
    url: '/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=CUTTING_MERGE_BATCH&sourceId=merge-batch%3AMB-260323-01',
    title: '裁片批次任务流转卡',
    tokens: ['裁片批次号', '来源生产单数', '来源原始裁片单数', '计划裁床组', '计划裁剪日期', '菲票归属仍回落原始裁片单'],
  },
]

for (const card of routeCards) {
  test(`${card.name} 使用统一打印预览`, async ({ page }) => {
    await page.goto(card.url)

    await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
    await expect(page.getByText(card.title).first()).toBeVisible()
    for (const token of card.tokens) {
      await expect(page.getByText(token).first()).toBeVisible()
    }
    await expect(page.getByText('差异记录区').first()).toBeVisible()
    await expect(page.getByText('签字区').first()).toBeVisible()
    await expect(page.locator('.print-qr-box')).toBeVisible()
    await expect(page.getByText('商品中心系统')).toHaveCount(0)
    await expect(page.getByText('采购管理系统')).toHaveCount(0)
    await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
    await expect(page.getByText('系统占位图')).toHaveCount(0)
  })
}

test('旧任务流转卡路由继续渲染统一模板', async ({ page }) => {
  const legacyUrls = [
    '/fcs/print/task-route-card?sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001',
    '/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001',
    '/fcs/print/task-route-card?sourceType=POST_FINISHING_WORK_ORDER&sourceId=POST-WO-001',
  ]

  for (const url of legacyUrls) {
    await page.goto(url)
    await expect(page.locator('[data-standalone-print-root]')).toBeVisible()
    await expect(page.getByRole('button', { name: '打印' })).toBeVisible()
    await expect(page.getByText('商品中心系统')).toHaveCount(0)
  }
})

test('打印按钮触发浏览器打印且二维码区域紧凑', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001')

  const qrBox = page.locator('.print-qr-box .print-qr-inner')
  await expect(qrBox).toBeVisible()
  const qrBounds = await qrBox.boundingBox()
  expect(qrBounds?.width || 0).toBeLessThan(180)
  expect(qrBounds?.height || 0).toBeLessThan(180)

  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })
  await page.getByRole('button', { name: '打印' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled)).toBe(true)
})
