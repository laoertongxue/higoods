import { expect, test } from '@playwright/test'

async function expectUnifiedPrintPage(page: import('@playwright/test').Page, title: string) {
  await expect(page.locator('.print-preview-root')).toBeVisible()
  await expect(page.getByText(title).first()).toBeVisible()
  await expect(page.getByText('商品中心系统')).toHaveCount(0)
  await expect(page.getByText('采购管理系统')).toHaveCount(0)
  await expect(page.getByText('工厂生产协同')).toHaveCount(0)
  await expect(page.getByText('工作台')).toHaveCount(0)
  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
  await expect(page.getByText('系统占位图')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '打印' })).toBeVisible()
  await expect(page.getByText('打印记录：').first()).toBeVisible()
}

test('结算信息变更申请单从旧入口进入统一打印预览', async ({ page }) => {
  await page.goto('/fcs/factories/settlement')
  await page.getByRole('button', { name: '变更申请' }).click()
  await page.getByRole('button', { name: '打印申请单' }).first().click()

  await expect(page).toHaveURL(/documentType=SETTLEMENT_CHANGE_REQUEST/)
  await expectUnifiedPrintPage(page, '结算信息变更申请单')
  for (const token of ['申请单号', '工厂名称', '提交人', '变更前信息区', '变更后信息区', '工厂负责人签字']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
})

test('差异处理申请单读取统一差异记录且不生成扣款或结算流水', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=HANDOVER_DIFFERENCE_REQUEST&sourceType=HANDOVER_DIFFERENCE_RECORD&sourceId=PHD-0001')

  await expectUnifiedPrintPage(page, '差异处理申请单')
  for (const token of ['来源交出记录号', '差异类型', '应收', '实收', '差异', '平台处理区', '交出方签字']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('不直接生成质量扣款流水').first()).toBeVisible()
  await expect(page.getByText(/对账流水或结算流水/).first()).toBeVisible()
})

test('质量扣款确认单展示待确认口径和完整价格单位', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=QUALITY_DEDUCTION_CONFIRMATION&sourceType=QUALITY_DEDUCTION_PENDING_RECORD&sourceId=demo')

  await expectUnifiedPrintPage(page, '质量扣款确认单')
  for (const token of ['来源质检记录号', '待确认质量扣款记录号', '建议扣款金额', '币种', '计价单位', '工厂处理区']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText(/(?:IDR|CNY|RMB)\/件/).first()).toBeVisible()
  await expect(page.getByText('不是正式质量扣款流水').first()).toBeVisible()
})

test('质量异议处理单展示异议和裁决且不触发结算', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=QUALITY_DISPUTE_PROCESSING&sourceType=QUALITY_DISPUTE_RECORD&sourceId=demo')

  await expectUnifiedPrintPage(page, '质量异议处理单')
  for (const token of ['异议原因', '工厂证据', '平台裁决区', '后续处理区', '工厂代表签字']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
  await expect(page.getByText('质检记录不能直接当作质量异议单').first()).toBeVisible()
  await expect(page.getByText('不在打印时触发生成流水或结算').first()).toBeVisible()
})

test('资料变更申请单具备通用申请单结构', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=MASTER_DATA_CHANGE_REQUEST&sourceType=MASTER_DATA_CHANGE_REQUEST_RECORD&sourceId=MDCR-202604-001')

  await expectUnifiedPrintPage(page, '资料变更申请单')
  for (const token of ['资料变更申请单号', '申请对象', '变更前后对比区', '附件区', '审核区', '申请人签字']) {
    await expect(page.getByText(token).first()).toBeVisible()
  }
})

test('统一打印记录和打印按钮可用', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=SETTLEMENT_CHANGE_REQUEST&sourceType=SETTLEMENT_CHANGE_REQUEST_RECORD&sourceId=SR202603160001')

  await expectUnifiedPrintPage(page, '结算信息变更申请单')
  await expect(page.getByText('SETTLEMENT_CHANGE_REQUEST').first()).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })
  await page.getByRole('button', { name: '打印' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled)).toBe(true)
})

test('打印治理共同规则和前六步能力不回退', async ({ page }) => {
  const urls = [
    ['/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001', '印花任务流转卡'],
    ['/fcs/print/preview?documentType=TASK_DELIVERY_CARD&handoverRecordId=HOH-MOCK-PRINT-410-001', '印花任务交货卡'],
    ['/fcs/print/preview?documentType=MATERIAL_PREP_SLIP&sourceId=material-prep%3ACUT-260302-001-01', '配料单'],
    ['/fcs/print/preview?documentType=PICKUP_SLIP&sourceId=pickup%3ATASK-CUT-000087', '领料单'],
    ['/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=CUT-260226-014-01%3A%3A001', '菲票'],
    ['/fcs/print/preview?documentType=PRODUCTION_CONFIRMATION&sourceType=PRODUCTION_ORDER&sourceId=PO-202603-0004', '生产确认单'],
    ['/fcs/print/preview?documentType=MAKE_GOODS_CONFIRMATION&sourceType=PRODUCTION_ORDER&sourceId=PO-202603-0004', '做货确认单'],
    ['/fcs/print/preview?documentType=QUALITY_DEDUCTION_CONFIRMATION&sourceType=QUALITY_DEDUCTION_PENDING_RECORD&sourceId=demo', '质量扣款确认单'],
  ] as const

  for (const [url, title] of urls) {
    await page.goto(url)
    await expectUnifiedPrintPage(page, title)
    await expect(page.getByText('数量：')).toHaveCount(0)
    await expect(page.getByText('金额：')).toHaveCount(0)
    await expect(page.getByText('单价：')).toHaveCount(0)
  }
})
