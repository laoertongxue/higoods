import { expect, test, type Page } from '@playwright/test'

const purchase = '/fcs/craft/accessory/webbing/purchase-demands'
const semi = '/fcs/craft/accessory/webbing/semi-finished-orders'
const work = '/fcs/craft/accessory/webbing/work-orders'
const pending = '/fcs/craft/accessory/webbing/pending-receipts'
const handover = '/fcs/craft/accessory/webbing/handover-records'

async function resetAndOpen(page: Page, path: string) {
  await page.goto(purchase)
  await page.evaluate(() => localStorage.clear())
  await page.goto(path)
  await expect(page.locator('main')).toBeVisible()
}

async function expectHeaders(page: Page, headers: string[]) {
  const actual = (await page.locator('thead th').allTextContents()).map((value) => value.trim()).filter(Boolean)
  for (const header of headers) expect(actual.some((value) => value.includes(header)), `缺少表头：${header}`).toBeTruthy()
}

test('采购需求使用采购模型，内建 Mock 自动出现并关联半成品加工单', async ({ page }) => {
  await resetAndOpen(page, purchase)
  await expect(page.getByRole('heading', { name: '织带采购需求' })).toBeVisible()
  await expect(page.getByText('载入演示采购')).toHaveCount(0)
  await expectHeaders(page, ['采购需求', '款式', '织带／绳子 SKU', '采购数量', '交期／目标仓库', '供应商／承接工厂', '采购变更', '半成品加工单／生成结果'])
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-MOCK-PO-009')
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-BASE-TMF-MOCK-PO-009')
  await expect(page.locator('[data-tmf-table] img').first()).toBeVisible()
  await page.locator('[data-tmf-purchase-demands-action="image"]').first().click()
  await expect(page.getByRole('dialog', { name: '半成品实物图' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '半成品实物图' })).toHaveCount(0)
})

test('半成品加工单与织带加工单统一染色加工单七组数据模型，且无接单开工动作', async ({ page }) => {
  await resetAndOpen(page, semi)
  await expect(page.getByRole('heading', { name: '半成品加工单' })).toBeVisible()
  const unified = ['加工单／商品', '加工投入／上游', '加工要求', '处理进度', '加工产出／下游', '时间', '数量']
  await expectHeaders(page, unified)
  await expect(page.locator('[data-tmf-table]')).toContainText('确认接收')
  await expect(page.locator('[data-tmf-table]')).toContainText('加工填报')
  await expect(page.locator('[data-tmf-table]')).toContainText('发起交出')
  await expect(page.locator('[data-tmf-table]')).not.toContainText(/接单|开工/)

  await page.goto(work)
  await expect(page.getByRole('heading', { name: '织带加工单', exact: true })).toBeVisible()
  await expectHeaders(page, unified)
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-WO-MOCK-001')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-MOCK-PO-009:batch')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('确认接收')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('加工填报')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('发起交出')
  await expect(page.locator('[data-tmf-work-table]')).not.toContainText(/接单|开工/)
})

test('采购、半成品、织带加工、待接收、交出记录使用同一事实链', async ({ page }) => {
  await resetAndOpen(page, purchase)
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-MOCK-PO-009')
  await page.goto(semi)
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-BASE-TMF-MOCK-PO-009')
  await page.goto(work)
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-WO-MOCK-001')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-WO-MOCK-003:handover')
  await page.goto(pending)
  await expect(page.getByRole('heading', { name: '织带／绳子待接收' })).toBeVisible()
  await expect(page.locator('[data-tmf-pending-table]')).toContainText('TMF-WO-MOCK-001:issue')
  await expect(page.locator('[data-tmf-pending-table]')).toContainText('TMF-WO-MOCK-002:issue')
  await page.goto(handover)
  await expect(page.getByRole('heading', { name: '织带／绳子交出记录' })).toBeVisible()
  await expect(page.locator('[data-tmf-handover-table]')).toContainText('TMF-MOCK-PO-009:handover')
  await expect(page.locator('[data-tmf-handover-table]')).toContainText('TMF-WO-MOCK-003:handover')
})

test('查询、重置和列设置保持局部交互，1024宽度下页面主体不横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await resetAndOpen(page, work)
  await page.locator('[data-tmf-work-orders] [name="keyword"]').fill('TMF-WO-MOCK-002')
  await page.locator('[data-tmf-work-orders-action="query"]').click()
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-WO-MOCK-002')
  await expect(page.locator('[data-tmf-work-table]')).not.toContainText('TMF-WO-MOCK-001')
  await page.locator('[data-tmf-work-orders-action="reset"]').click()
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-WO-MOCK-001')
  await page.locator('[data-tmf-work-orders-action="open-column-settings"]').click()
  await expect(page.getByText('织带加工单列设置')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBeFalsy()
})
