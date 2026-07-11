import { expect, test, type Page } from '@playwright/test'

const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || []).toEqual([])
})

async function rememberMain(page: Page): Promise<void> {
  await page.locator('main').evaluate((node) => {
    ;(window as typeof window & { __waterMain?: Element }).__waterMain = node
  })
}

async function expectSameMain(page: Page): Promise<void> {
  await expect.poll(() => page.locator('main').evaluate((node) => {
    const remembered = (window as typeof window & { __waterMain?: Element }).__waterMain
    return remembered === node && remembered?.isConnected === true
  })).toBe(true)
}

async function openPausedSupervisor(page: Page): Promise<void> {
  await page.goto('/fcs/craft/dyeing/water-soluble-orders?factoryId=F090')
  await expect(page.getByTestId('factory-water-soluble-orders-page')).toBeVisible()
  await page.getByRole('button', { name: '主管处理' }).click()
}

async function confirmSupervisorDecision(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label }).click()
  await expect(page.getByRole('heading', { name: `确认${label}` })).toBeVisible()
  await page.getByRole('button', { name: label }).click()
}

test('FCS 展示款式及完整事实详情', async ({ page }) => {
  await page.goto('/fcs/process/water-soluble-orders')
  await expect(page.getByTestId('water-soluble-orders-page')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '款号或款式' })).toBeVisible()
  await expect(page.getByText(/SPU-|未记录/).first()).toBeVisible()
  await page.getByRole('button', { name: '查看详情' }).first().click()
  const overlay = page.locator('[data-water-soluble-overlay]')
  await expect(overlay).toContainText('工艺要求')
  await expect(overlay).toContainText('PDA 执行记录')
  await expect(overlay).toContainText('交接与收货结果')
  await expect(overlay).toContainText('主管处理记录')
})

test('FCS input、select、分页和抽屉保持 main 节点及输入焦点', async ({ page }) => {
  await page.goto('/fcs/process/water-soluble-orders')
  await expect(page.getByTestId('water-soluble-orders-page')).toBeVisible()
  await rememberMain(page)
  const keyword = page.getByPlaceholder('加工单号 / 生产单号 / 物料')
  await keyword.fill('PO-202603-081')
  await expect(keyword).toBeFocused()
  await expect(keyword).toHaveValue('PO-202603-081')
  await expectSameMain(page)
  await page.locator('[data-water-soluble-field="status"]').selectOption('WAIT_FACTORY_ASSIGNMENT')
  await expectSameMain(page)
  await page.locator('[data-testid="water-soluble-pagination"] select').selectOption('20')
  await expectSameMain(page)
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expectSameMain(page)
})

test('PFOS 主管选择继续补做并局部刷新', async ({ page }) => {
  await openPausedSupervisor(page)
  await rememberMain(page)
  await confirmSupervisorDecision(page, '继续补做')
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始水溶' })).toBeVisible()
  await expectSameMain(page)
})

test('PFOS 主管选择按实际数量继续交出', async ({ page }) => {
  await openPausedSupervisor(page)
  const pausedCard = page.getByTestId('factory-water-soluble-card').filter({ hasText: '生产暂停' })
  const orderId = await pausedCard.getAttribute('data-order-id')
  expect(orderId).toBeTruthy()
  await confirmSupervisorDecision(page, '按实际数量继续交出')
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待交出' })).toBeVisible()
  await expect(page.getByRole('button', { name: '现在交出' })).toBeVisible()
  await page.evaluate((id) => {
    const button = document.createElement('button')
    button.dataset.factoryWaterSolubleAction = 'confirm-supervisor-decision'
    button.dataset.orderId = id || ''
    button.dataset.decision = 'CONTINUE_WITH_ACTUAL_QTY'
    button.dataset.skipPageRerender = 'true'
    document.querySelector('[data-testid="factory-water-soluble-orders-page"]')?.appendChild(button)
    button.click()
    button.remove()
  }, orderId)
  await expect(page.getByText(/不能处理生产暂停/)).toBeVisible()
})

test('PFOS 主管选择退回重做', async ({ page }) => {
  await openPausedSupervisor(page)
  await confirmSupervisorDecision(page, '退回重做')
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' })).toBeVisible()
  await expect(page.getByTestId('factory-water-soluble-card').filter({ hasText: '待水溶' }).getByText('0 米', { exact: true })).toBeVisible()
})
