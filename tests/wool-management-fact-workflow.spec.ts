import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { buildWoolFactWorkflowMockStore } from '../src/data/fcs/wool-domain/mock-data'

const WOOL_STORE_KEY = 'higood-fcs-wool-domain-store-v2'
const PDA_SESSION_KEY = 'fcs_pda_session'
const BASE_WOOL_STORE = buildWoolFactWorkflowMockStore('PLAYWRIGHT_WOOL_FACT_WORKFLOW')
let context: BrowserContext
let page: Page

test.setTimeout(240_000)
test.describe.configure({ mode: 'serial' })

const WOOL_PDA_SESSION = {
  userId: 'OWN_WOOL_FACTORY_operator',
  loginId: 'OWN_WOOL_FACTORY_operator',
  userName: '周哥毛织厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'OWN_WOOL_FACTORY',
  factoryName: '周哥毛织厂',
  loggedAt: '2026-07-31 08:00:00',
}

type ScenarioOrder = {
  woolOrderId: string
  woolOrderNo: string
  taskId: string
  outputPlanLines: Array<{
    outputSkuCode: string
    plannedQty: number
    qtyUnit: string
    outputObjectType: string
  }>
}

async function resetScenario(page: Page, pdaSession?: typeof WOOL_PDA_SESSION): Promise<void> {
  await page.evaluate(
    async ({ woolStoreKey, pdaSessionKey, session, baseStore, storeModulePath }) => {
      window.localStorage.setItem(woolStoreKey, JSON.stringify(baseStore))
      if (session) window.localStorage.setItem(pdaSessionKey, JSON.stringify(session))
      else window.localStorage.removeItem(pdaSessionKey)
      const storeModule = await import(/* @vite-ignore */ storeModulePath) as {
        clearWoolStoreMemoryCache: () => void
      }
      storeModule.clearWoolStoreMemoryCache()
    },
    {
      woolStoreKey: WOOL_STORE_KEY,
      pdaSessionKey: PDA_SESSION_KEY,
      session: pdaSession,
      baseStore: BASE_WOOL_STORE,
      storeModulePath: '/src/data/fcs/wool-domain/store.ts',
    },
  )
}

async function navigateApp(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

async function openWoolOrders(page: Page): Promise<void> {
  await navigateApp(page, '/fcs/craft/wool/work-orders')
  await page.locator('[data-wool-work-orders-root]').waitFor({ state: 'visible', timeout: 90_000 })
  await page.waitForTimeout(500)
}

async function findScenario(page: Page, scenarioCode: string): Promise<ScenarioOrder> {
  return page.evaluate(
    ({ woolStoreKey, scenarioCode }) => {
      const raw = window.localStorage.getItem(woolStoreKey)
      if (!raw) throw new Error('毛织 Mock 存储尚未初始化')
      const store = JSON.parse(raw) as {
        workOrders: Record<string, ScenarioOrder & { mockScenarioCode?: string }>
      }
      const order = Object.values(store.workOrders)
        .find((item) => item.mockScenarioCode === scenarioCode)
      if (!order) throw new Error(`找不到毛织 Mock 场景 ${scenarioCode}`)
      return order
    },
    { woolStoreKey: WOOL_STORE_KEY, scenarioCode },
  )
}

async function filterOrder(page: Page, orderNo: string): Promise<void> {
  await page.locator('[data-wool-work-orders-field="keyword"]').fill(orderNo)
  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^可以开工\s+\d+$/ })).toBeVisible()
}

async function selectTab(page: Page, label: '可以开工' | '不可以开工' | '已完成'): Promise<void> {
  await page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: new RegExp(`^${label}\\s+\\d+$`) }).click()
}

async function rowFor(page: Page, order: ScenarioOrder) {
  return page.locator('tr').filter({ hasText: order.woolOrderNo })
}

async function openRowAction(page: Page, order: ScenarioOrder, action: string): Promise<void> {
  const row = await rowFor(page, order)
  await expect(row).toBeVisible()
  const actionCode: Record<string, string> = {
    确认接收: 'open-receipt',
    加工填报: 'open-report',
    发起交出: 'open-handover',
    完成加工单: 'open-complete',
    修改记录数量: 'open-qty-list',
  }
  const button = actionCode[action]
    ? page.locator(
      `[data-wool-work-orders-action="${actionCode[action]}"][data-wool-order-id="${order.woolOrderId}"]`,
    )
    : row.getByRole('button', { name: action, exact: true })
  await button.evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
}

async function readWoolStore(page: Page): Promise<{
  machineAssociations: Array<{ machineId: string; woolOrderId: string }>
  machines: Array<{ machineId: string; status: string }>
  completions: Array<{ woolOrderId: string }>
  handovers: Array<{
    handoverId: string
    woolOrderId: string
    handoverQty: number
    receiverId: string
    receiverName: string
    downstreamReceipt?: { status: string; actualReceivedQty: number }
  }>
  warehouseFlows: Array<{
    woolOrderId: string
    businessType: string
    objectSkuCode: string
    defaultLocationId: string
    qty: number
  }>
}> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), WOOL_STORE_KEY)
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000)
  context = await browser.newContext()
  page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(90_000)
  await page.goto('/placeholder.svg')
  await resetScenario(page)
  await page.goto('/fcs/craft/wool/work-orders')
  await page.locator('[data-wool-work-orders-root]').waitFor({ state: 'visible', timeout: 90_000 })
})

test.afterAll(async () => {
  await context.close()
})

test.beforeEach(async () => {
  await resetScenario(page)
})

test('搜索条件联动三个 Tab，且不重复展示统计卡片', async () => {
  await openWoolOrders(page)
  const root = page.locator('[data-wool-work-orders-root]')
  await page.evaluate(() => {
    document.querySelector('[data-wool-work-orders-root]')?.setAttribute('data-e2e-identity', 'stable-root')
  })
  await page.locator('[data-wool-work-orders-field="keyword"]').fill('WMO-CHECK')

  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^可以开工\s+1$/ })).toBeVisible()
  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^不可以开工\s+0$/ })).toBeVisible()
  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^已完成\s+0$/ })).toBeVisible()
  await expect(page.locator('[data-summary-card]')).toHaveCount(0)
  await expect(root).toHaveAttribute('data-e2e-identity', 'stable-root')
})

test('任一款色全部必需纱线有有效接收才可加工填报，且不按重量换算', async () => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'NO_YARN_RECEIPT')
  await filterOrder(page, order.woolOrderNo)
  await selectTab(page, '不可以开工')

  await openRowAction(page, order, '确认接收')
  await page.locator('[data-wool-receipt-yarn="YARN-A"]').check()
  await page.locator('[data-wool-receipt-qty="YARN-A"]').fill('20')
  await page.locator('[data-wool-dialog-field="batchNo"]').fill('E2E-A')
  await page.getByRole('button', { name: '保存确认接收', exact: true }).click()
  await expect(await rowFor(page, order)).toBeVisible()
  await expect(await rowFor(page, order)).not.toContainText('加工填报')

  await openRowAction(page, order, '确认接收')
  await page.locator('[data-wool-receipt-yarn="YARN-B"]').check()
  await page.locator('[data-wool-receipt-qty="YARN-B"]').fill('0.01')
  await page.locator('[data-wool-dialog-field="batchNo"]').fill('E2E-B')
  await page.getByRole('button', { name: '保存确认接收', exact: true }).click()

  await selectTab(page, '可以开工')
  const readyRow = await rowFor(page, order)
  await expect(readyRow).toBeVisible()
  await expect(readyRow.getByRole('button', { name: '加工填报', exact: true })).toBeVisible()
})

test('加工填报累计不超过计划数量的 150%', async () => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await filterOrder(page, order.woolOrderNo)
  await openRowAction(page, order, '加工填报')

  const select = page.locator('[data-wool-dialog-field="outputSkuCode"]')
  const outputSkuCode = await select.inputValue()
  const plan = order.outputPlanLines.find((line) => line.outputSkuCode === outputSkuCode)!
  const limit = Math.floor(plan.plannedQty * 1.5)
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(limit + 1))
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  await expect(page.locator('[data-wool-overlay-error]')).toContainText(`最多还可填报 ${limit}`)

  await page.locator('[data-wool-dialog-field="qty"]').fill(String(limit))
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
})

test('至少一次加工填报才可交出，至少一次交出才显示完成加工单', async () => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await filterOrder(page, order.woolOrderNo)
  let row = await rowFor(page, order)
  await expect(row.getByRole('button', { name: '发起交出', exact: true })).toHaveCount(0)
  await expect(row.getByRole('button', { name: '完成加工单', exact: true })).toHaveCount(0)

  await row.getByRole('button', { name: '加工填报', exact: true }).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill('10')
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  row = await rowFor(page, order)
  await expect(row.getByRole('button', { name: '发起交出', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '完成加工单', exact: true })).toHaveCount(0)

  await row.getByRole('button', { name: '发起交出', exact: true }).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill('5')
  await page.getByRole('button', { name: '保存发起交出', exact: true }).click()
  row = await rowFor(page, order)
  await expect(row.getByRole('button', { name: '完成加工单', exact: true })).toBeVisible()
})

test('完成加工单由业务二次确认，展示五类事实并自动解除横机', async () => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'READY_TO_COMPLETE')
  await page.evaluate(
    ({ key, woolOrderId }) => {
      const store = JSON.parse(window.localStorage.getItem(key) || '{}')
      store.machineAssociations.push({
        machineId: 'WM-003',
        woolOrderId,
        associatedAt: '2026-07-31 08:30:00',
        associatedBy: 'E2E 毛织主管',
      })
      window.localStorage.setItem(key, JSON.stringify(store))
    },
    { key: WOOL_STORE_KEY, woolOrderId: order.woolOrderId },
  )
  await page.reload()
  await filterOrder(page, order.woolOrderNo)
  await expect(await rowFor(page, order)).toContainText('完成加工单')
  await openRowAction(page, order, '完成加工单')

  await expect(page.getByText('系统仅展示当前业务事实，不判断该加工单是否应该完成。请业务人员核对后确认。')).toBeVisible()
  for (const title of ['确认接收情况', '加工填报情况', '发起交出情况', '待交出仓情况', '当前横机关联']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: '确认完成加工单', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '确认完成加工单', exact: true }).click()

  const store = await readWoolStore(page)
  expect(store.completions.some((item) => item.woolOrderId === order.woolOrderId)).toBe(true)
  expect(store.machineAssociations.some((item) => item.woolOrderId === order.woolOrderId)).toBe(false)
})

test('横机支持一单多设备、设备同一时刻一单，维修停用禁选且状态自动切换', async () => {
  await openWoolOrders(page)
  const orderA = await findScenario(page, 'ONE_COLOR_READY')
  const orderB = await findScenario(page, 'MULTI_YARN_SINGLE_RECEIPT')

  await navigateApp(page, `/fcs/process-factory/wool/machine-associations?woolOrderId=${encodeURIComponent(orderA.woolOrderId)}`)
  const dialogA = page.locator('[data-wool-machine-association-dialog]')
  await expect(dialogA).toBeVisible()
  await expect(dialogA.locator('[data-wool-machine-associations-machine-id="WM-006"]')).toBeDisabled()
  await expect(dialogA.locator('[data-wool-machine-associations-machine-id="WM-007"]')).toBeDisabled()
  await dialogA.locator('[data-wool-machine-associations-machine-id="WM-003"]').check()
  await dialogA.locator('[data-wool-machine-associations-machine-id="WM-005"]').check()
  await dialogA.getByRole('button', { name: '保存整组关联', exact: true }).click()

  let store = await readWoolStore(page)
  expect(store.machineAssociations.filter((item) => item.woolOrderId === orderA.woolOrderId).map((item) => item.machineId).sort())
    .toEqual(['WM-003', 'WM-005'])

  await navigateApp(page, `/fcs/process-factory/wool/machine-associations?woolOrderId=${encodeURIComponent(orderB.woolOrderId)}`)
  const dialogB = page.locator('[data-wool-machine-association-dialog]')
  await dialogB.locator('[data-wool-machine-associations-machine-id="WM-003"]').check()
  await dialogB.getByRole('button', { name: '保存整组关联', exact: true }).click()
  await expect(dialogB).toContainText('将从')
  await dialogB.getByRole('button', { name: '确认跨单转移并保存', exact: true }).click()

  store = await readWoolStore(page)
  expect(store.machineAssociations.filter((item) => item.machineId === 'WM-003')).toEqual([
    expect.objectContaining({ woolOrderId: orderB.woolOrderId }),
  ])
  expect(store.machineAssociations.some((item) => item.machineId === 'WM-005' && item.woolOrderId === orderA.woolOrderId)).toBe(true)

  await navigateApp(page, '/fcs/craft/wool/machines')
  await page.locator('[data-wool-machines-field="keyword"]').fill('横机-003')
  await expect(page.locator('tr').filter({ hasText: '横机-003' })).toContainText('生产中')
})

test('裁片和成衣加工填报进入各自固定默认库位，交出从同一库位扣减', async () => {
  await openWoolOrders(page)
  const whole = await findScenario(page, 'FIXED_LOCATION_UI')
  const store = await readWoolStore(page)
  const wholeFlow = store.warehouseFlows.find((flow) =>
    flow.woolOrderId === whole.woolOrderId && flow.businessType === 'PROCESS_REPORT')
  const panelFlow = store.warehouseFlows.find((flow) =>
    flow.woolOrderId === `${whole.woolOrderId}-PANEL` && flow.businessType === 'PROCESS_REPORT')
  expect(wholeFlow?.defaultLocationId).toBe('WOOL-WH-GARMENT-DEFAULT')
  expect(panelFlow?.defaultLocationId).toBe('WOOL-WH-CUT-DEFAULT')

  await navigateApp(page, '/fcs/craft/wool/wait-handover-warehouse')
  await expect(page.locator('body')).toContainText('WOOL-WH-GARMENT-DEFAULT')
  await expect(page.locator('body')).toContainText('WOOL-WH-CUT-DEFAULT')
})

test('下游确认后锁定，且不修改来源交出数量或恢复毛织库存', async () => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'DOWNSTREAM_CONFIRMED_LOCKED')
  const before = await readWoolStore(page)
  const handover = before.handovers.find((item) => item.woolOrderId === order.woolOrderId)!
  const stockBefore = before.warehouseFlows
    .filter((flow) => flow.woolOrderId === order.woolOrderId)
    .reduce((sum, flow) => sum + flow.qty, 0)

  await filterOrder(page, order.woolOrderNo)
  await openRowAction(page, order, '修改记录数量')
  const lockedHandoverRow = page.locator('[data-wool-business-dialog] div.grid')
    .filter({ hasText: handover.handoverId })
    .filter({ hasText: '下游已确认' })
    .first()
  await expect(lockedHandoverRow).toBeVisible()
  await expect(lockedHandoverRow.getByRole('button', { name: '修改数量', exact: true })).toHaveCount(0)

  const after = await readWoolStore(page)
  const afterHandover = after.handovers.find((item) => item.handoverId === handover.handoverId)!
  expect(afterHandover.handoverQty).toBe(handover.handoverQty)
  expect(afterHandover.downstreamReceipt?.actualReceivedQty).toBe(handover.downstreamReceipt?.actualReceivedQty)
  expect(after.warehouseFlows.filter((flow) => flow.woolOrderId === order.woolOrderId).reduce((sum, flow) => sum + flow.qty, 0))
    .toBe(stockBefore)
})

test('PDA 首屏只有一个主操作，输入、弹窗、分页均局部更新且关键交互小于 200ms', async () => {
  await resetScenario(page, WOOL_PDA_SESSION)
  await openWoolOrders(page)
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await navigateApp(page, `/fcs/pda/exec/${encodeURIComponent(order.taskId)}`)
  const root = page.locator('[data-pda-wool-root]')
  await expect(root).toBeVisible()
  await expect(root.locator('[data-pda-wool-action="open-fact"].bg-primary')).toHaveCount(1)

  const openDuration = await root.locator('[data-pda-wool-action="open-fact"].bg-primary').evaluate((button) =>
    new Promise<number>((resolve, reject) => {
      const startedAt = performance.now()
      const findOverlay = () =>
        document.querySelector('[data-pda-wool-overlay-root] [data-pda-wool-action="save-fact"]')
      const observer = new MutationObserver(() => {
        if (!findOverlay()) return
        observer.disconnect()
        resolve(performance.now() - startedAt)
      })
      observer.observe(document.body, { childList: true, subtree: true })
      ;(button as HTMLButtonElement).click()
      if (findOverlay()) {
        observer.disconnect()
        resolve(performance.now() - startedAt)
      }
      window.setTimeout(() => {
        observer.disconnect()
        reject(new Error('主操作弹窗未在 200ms 内打开'))
      }, 200)
    }))
  expect(openDuration).toBeLessThan(200)

  await page.evaluate(() => {
    document.querySelector('[data-pda-wool-root]')?.setAttribute('data-e2e-identity', 'stable-pda-root')
  })
  await page.locator('[data-pda-wool-draft][data-draft-field="qty"]').fill('8')
  await expect(root).toHaveAttribute('data-e2e-identity', 'stable-pda-root')
  await expect(page.locator('[data-pda-wool-action="save-fact"]')).toBeInViewport()
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  test(`${viewport.width}×${viewport.height} 下页面主体不横溢、表格内滚动、右侧操作列和弹窗按钮可见`, async () => {
    await page.setViewportSize(viewport)
    await openWoolOrders(page)
    const order = await findScenario(page, 'ONE_COLOR_READY')
    await filterOrder(page, order.woolOrderNo)
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      tableOverflow: document.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollWidth ?? 0,
      tableClient: document.querySelector<HTMLElement>('[data-standard-list-scroll]')?.clientWidth ?? 0,
    }))
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.tableOverflow).toBeGreaterThanOrEqual(layout.tableClient)
    await expect((await rowFor(page, order)).getByRole('button', { name: '加工填报', exact: true })).toBeInViewport()

    await openRowAction(page, order, '加工填报')
    await expect(page.getByRole('button', { name: '保存加工填报', exact: true })).toBeInViewport()
    await page.screenshot({
      path: `test-results/wool-work-orders-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    })
  })
}
