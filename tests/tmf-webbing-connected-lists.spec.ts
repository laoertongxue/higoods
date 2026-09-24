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
  await expectHeaders(page, ['采购需求', '款式', '织带／绳子 SKU', '采购数量', '交期／目标仓库', '采购供应方／生产责任', '采购变更', '半成品加工单／生成结果'])
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-MOCK-PO-009')
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-SEMI-TMF-MOCK-PO-009-L1')
  await expect(page.locator('[data-tmf-table] img').first()).toBeVisible()
  await page.locator('[data-tmf-purchase-demands-action="image"]').first().click()
  await expect(page.getByRole('dialog', { name: '半成品实物图' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '半成品实物图' })).toHaveCount(0)
})

test('织带厂演示数据遇到浏览器容量限制时页面仍可访问且同次运行不重复初始化', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    let tmfWriteAttempts = 0
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'higood-tmf-material-purchases-v1') {
        tmfWriteAttempts += 1
        ;(window as Window & { __tmfWriteAttempts?: number }).__tmfWriteAttempts = tmfWriteAttempts
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
  })
  await page.goto(semi)
  await expect(page.getByRole('heading', { name: '半成品加工单' })).toBeVisible()
  await expect(page.locator('section[role="status"]')).toContainText('演示数据未能全部保存')
  const attemptsAfterEntry = await page.evaluate(() => (window as Window & { __tmfWriteAttempts?: number }).__tmfWriteAttempts)
  expect(attemptsAfterEntry).toBeGreaterThan(0)

  await page.getByRole('button', { name: '织带加工单', exact: true }).click()
  await expect(page.getByRole('heading', { name: '织带加工单', exact: true })).toBeVisible()
  await expect(page.locator('section[role="status"]')).toContainText('当前页面仍可查看已保存记录')
  for (const [label, heading] of [
    ['采购需求', '织带采购需求'],
    ['待接收', '织带／绳子待接收'],
    ['交出记录', '织带／绳子交出记录'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.locator('section[role="status"]')).toContainText('当前页面仍可查看已保存记录')
  }
  const attemptsAfterNavigation = await page.evaluate(() => (window as Window & { __tmfWriteAttempts?: number }).__tmfWriteAttempts)
  expect(attemptsAfterNavigation).toBe(attemptsAfterEntry)

  await page.goto('/fcs/craft/accessory/webbing/pda')
  await expect(page.getByRole('heading', { name: '织带厂执行' })).toBeVisible()
  await expect(page.locator('section[role="status"]')).toContainText('当前页面仍可查看已保存记录')
})

test('半成品加工单与织带加工单统一染色加工单七组数据模型，且无接单开工动作', async ({ page }) => {
  await resetAndOpen(page, semi)
  await expect(page.getByRole('heading', { name: '半成品加工单' })).toBeVisible()
  const unified = ['加工单／商品', '加工投入／上游', '加工要求', '处理进度', '加工产出／下游', '时间', '数量']
  await expectHeaders(page, unified)
  const semiRequirement = page.locator('[data-tmf-table] tbody tr').first().locator('td').nth(2)
  await expect(semiRequirement).toContainText('类型')
  await expect(semiRequirement).toContainText('品质要求')
  await expect(semiRequirement).not.toContainText(/生产标准|原料配方|配方说明|目标仓/)
  await expect(page.locator('[data-tmf-table]')).toContainText('确认接受')
  await expect(page.locator('[data-tmf-table]')).toContainText('加工填报')
  await expect(page.locator('[data-tmf-table]')).toContainText('发起交出')
  await expect(page.locator('[data-tmf-table]')).not.toContainText(/接单|开工/)

  await page.goto(work)
  await expect(page.getByRole('heading', { name: '织带加工单', exact: true })).toBeVisible()
  await expectHeaders(page, unified)
  const workRequirement = page.locator('[data-tmf-work-table] tbody tr').first().locator('td').nth(3)
  await expect(workRequirement).toContainText('截断／成品')
  await expect(workRequirement).toContainText('公差')
  await expect(workRequirement).toContainText('端头')
  await expect(workRequirement).not.toContainText(/用途／尺码|切割方式/)
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-WO-MOCK-001-CUT-SNAPSHOT-V1')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('TMF-MOCK-PO-009:batch')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('确认接受')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('加工填报')
  await expect(page.locator('[data-tmf-work-table]')).toContainText('发起交出')
  await expect(page.locator('[data-tmf-work-table]')).not.toContainText(/接单|开工/)
})

test('采购、半成品、织带加工、待接收、交出记录使用同一事实链', async ({ page }) => {
  await resetAndOpen(page, purchase)
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-MOCK-PO-009')
  await page.goto(semi)
  await expect(page.locator('[data-tmf-table]')).toContainText('TMF-SEMI-TMF-MOCK-PO-009-L1')
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

test('同一 SKU 多长度与绳子三种端头按技术包规格展示，批量打印保留加工单边界', async ({ page }) => {
  await resetAndOpen(page, work)
  await page.locator('[data-tmf-work-orders] [name="keyword"]').fill('TMF-WO-MOCK-004')
  await page.locator('[data-tmf-work-orders-action="query"]').click()
  const multiLength = page.locator('[data-tmf-work-table]')
  await expect(multiLength).toContainText('WB20-WHT')
  await expect(multiLength).toContainText('500 / 500 mm')
  await expect(multiLength).toContainText('700 / 700 mm')
  await expect(multiLength).not.toContainText(/WB20-WHT-500|WB20-WHT-700/)

  await page.locator('[data-tmf-work-orders-action="reset"]').click()
  await page.locator('[data-tmf-work-orders] [name="keyword"]').fill('TMF-WO-MOCK-005')
  await page.locator('[data-tmf-work-orders-action="query"]').click()
  const rope = page.locator('[data-tmf-work-table]')
  await expect(rope).toContainText('CORD-WHT')
  await expect(rope).toContainText('金属头')
  await expect(rope).toContainText('塑料包头')
  await expect(rope).toContainText('硅胶浸头')
  await expect(rope).not.toContainText(/METAL|PLASTIC_WRAP|SILICONE_DIP/)

  await page.locator('[data-tmf-work-orders-action="reset"]').click()
  const choices = page.locator('[data-tmf-work-orders-action="toggle-selection"]')
  await choices.nth(0).check()
  await choices.nth(1).check()
  await page.locator('[data-tmf-work-orders-action="batch-print"]').click()
  await expect(page.locator('.print-preview-root')).toBeVisible()
  await expect(page.locator('[data-tmf-batch-print-source]')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: /加工明细单打印预览 · 2 单/ })).toBeVisible()
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

test('PDA 在 360×640 从同一织带加工单进入，超量接收被阻断且角色不能在页面自选', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await resetAndOpen(page, '/fcs/craft/accessory/webbing/pda')
  await expect(page.getByRole('heading', { name: '织带厂执行' })).toBeVisible()
  await page.getByLabel('生产单号').fill('TMF-WO-MOCK-001')
  await page.getByRole('button', { name: '进入任务卡' }).click()
  await expect(page.getByText('2 / 3 任务卡 · TMF-WO-MOCK-001')).toBeVisible()
  await page.getByRole('button', { name: '登记实收' }).click()
  await page.getByLabel('本次实际接收（米）').fill('999')
  await page.getByRole('button', { name: '确认保存' }).click()
  await expect(page.locator('[data-tmf-pda-exec-error]')).toContainText(/不能超过|超过|可接收/)
  await expect(page.locator('[data-tmf-pda-exec-root] select')).toHaveCount(0)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBeFalsy()
})

test('待接收页面使用登录身份且错误数量保留在弹窗内，不产生未处理异步错误', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await resetAndOpen(page, pending)
  await page.locator('[data-tmf-pending-receipts] [name="keyword"]').fill('TMF-WO-MOCK-001:issue')
  await page.locator('[data-tmf-pending-receipts-action="query"]').click()
  await page.locator('[data-tmf-pending-receipts-action="receive"]').click()
  await expect(page.locator('[data-tmf-pending-dialog] select')).toHaveCount(0)
  await page.locator('[data-tmf-pending-dialog] [name="quantity"]').fill('999')
  await page.locator('[data-tmf-pending-receipts-action="confirm"]').click()
  await expect(page.locator('[data-tmf-pending-error]')).toContainText(/须为|之间/)
  expect(pageErrors).toEqual([])
})
