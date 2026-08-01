import { expect, test, type Page } from '@playwright/test'
import { buildWoolFactWorkflowMockStore } from '../src/data/fcs/wool-domain/mock-data'

const WOOL_STORE_KEY = 'higood-fcs-wool-domain-store-v2'
const PDA_SESSION_KEY = 'fcs_pda_session'
const BASE_WOOL_STORE = buildWoolFactWorkflowMockStore('PLAYWRIGHT_WOOL_FACT_WORKFLOW')

test.setTimeout(180_000)

// 依赖共享浏览器上下文与每例独立重置 Mock Store，必须串行执行且失败即停
test.describe.configure({ mode: 'serial' })

type ScenarioOrder = {
  woolOrderId: string
  woolOrderNo: string
  taskId: string
  kind: 'WHOLE_GARMENT' | 'PART_PANEL'
  mockScenarioCode?: string
  outputPlanLines: Array<{
    outputSkuCode: string
    plannedQty: number
    qtyUnit: string
    outputObjectType: 'GARMENT' | 'WOOL_PANEL'
  }>
}

type WoolStoreSnapshot = {
  workOrders: Record<string, ScenarioOrder>
  yarnReceipts: Array<Record<string, unknown>>
  processReports: Array<Record<string, unknown> & {
    reportId: string
    woolOrderId: string
    outputSkuCode: string
    reportedQty: number
    warehouseInboundFlowId: string
  }>
  handovers: Array<Record<string, unknown> & {
    handoverId: string
    woolOrderId: string
    outputSkuCode: string
    handoverQty: number
    receiverId: string
    receiverName: string
    warehouseOutboundFlowId: string
    downstreamReceipt?: {
      receiptConfirmationId: string
      status: string
      actualReceivedQty?: number
      differenceQty?: number
      receivedAt?: string
      receivedBy?: string
    }
  }>
  warehouseFlows: Array<Record<string, unknown> & {
    flowId: string
    woolOrderId: string
    flowType: string
    businessType: string
    objectSkuCode: string
    defaultLocationId: string
    qty: number
    sourceRecordId: string
  }>
  machineAssociations: Array<Record<string, unknown> & {
    machineId: string
    woolOrderId: string
    associatedAt: string
  }>
  machines: Array<Record<string, unknown> & {
    machineId: string
    machineNo: string
    machineName: string
    status: string
  }>
  completions: Array<Record<string, unknown> & {
    woolOrderId: string
    confirmationSnapshot: {
      yarnReceiptSummary: Array<Record<string, unknown>>
      processReportSummary: Array<Record<string, unknown>>
      handoverSummary: Array<Record<string, unknown>>
      waitHandoverStockSummary: Array<Record<string, unknown>>
      releasedMachineIds: string[]
      releasedMachines?: Array<Record<string, unknown>>
    }
  }>
  operationLogs: Array<Record<string, unknown>>
}

async function clearWoolMemoryCache(page: Page): Promise<void> {
  await page.evaluate(async (storeModulePath) => {
    const storeModule = await import(/* @vite-ignore */ storeModulePath) as {
      clearWoolStoreMemoryCache: () => void
    }
    storeModule.clearWoolStoreMemoryCache()
  }, '/src/data/fcs/wool-domain/store.ts')
}

async function replaceWoolStoreFromStorage(page: Page): Promise<void> {
  await page.evaluate(
    async ({ key, storeModulePath }) => {
      const storeModule = await import(/* @vite-ignore */ storeModulePath) as {
        replaceWoolStore: (nextStore: unknown) => unknown
      }
      const raw = window.localStorage.getItem(key)
      if (!raw) throw new Error('毛织测试事实存储不存在')
      storeModule.replaceWoolStore(JSON.parse(raw))
    },
    {
      key: WOOL_STORE_KEY,
      storeModulePath: '/src/data/fcs/wool-domain/store.ts',
    },
  )
}

async function resetScenario(page: Page): Promise<void> {
  page.setDefaultTimeout(12_000)
  page.setDefaultNavigationTimeout(90_000)
  await page.goto('/placeholder.svg')
  await page.evaluate(
    ({ woolStoreKey, pdaSessionKey, baseStore }) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      window.localStorage.setItem(woolStoreKey, JSON.stringify(baseStore))
      window.localStorage.removeItem(pdaSessionKey)
    },
    {
      woolStoreKey: WOOL_STORE_KEY,
      pdaSessionKey: PDA_SESSION_KEY,
      baseStore: BASE_WOOL_STORE,
    },
  )
  await clearWoolMemoryCache(page)
}

async function installLegalPdaSession(page: Page, factoryId: string): Promise<void> {
  await page.evaluate(
    async ({ factoryId, pdaSessionKey, pdaModulePath }) => {
      const pda = await import(/* @vite-ignore */ pdaModulePath) as {
        listFactoryPdaUsers: (id: string) => Array<{
          status: string
          roleId: string
          userId: string
          loginId: string
          name: string
          factoryId: string
        }>
        createPdaSessionFromUser: (user: unknown) => unknown
      }
      const user = pda.listFactoryPdaUsers(factoryId)
        .find((item) => item.status === 'ACTIVE' && item.roleId === 'ROLE_OPERATOR')
      if (!user) throw new Error(`找不到工厂 ${factoryId} 的有效 PDA 操作员`)
      window.localStorage.setItem(pdaSessionKey, JSON.stringify(pda.createPdaSessionFromUser(user)))
    },
    {
      factoryId,
      pdaSessionKey: PDA_SESSION_KEY,
      pdaModulePath: '/src/data/fcs/store-domain-pda.ts',
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
  await page.goto('/fcs/craft/wool/work-orders')
  await expect(woolOrdersRoot(page)).toHaveCount(1, { timeout: 90_000 })
}

function woolOrdersRoot(page: Page) {
  return page.locator('[data-wool-work-orders-root]').filter({ visible: true })
}

async function findScenarios(page: Page, scenarioCode: string): Promise<ScenarioOrder[]> {
  return page.evaluate(
    ({ woolStoreKey, scenarioCode }) => {
      const store = JSON.parse(window.localStorage.getItem(woolStoreKey) || '{}') as {
        workOrders: Record<string, ScenarioOrder>
      }
      return Object.values(store.workOrders)
        .filter((item) => item.mockScenarioCode === scenarioCode)
    },
    { woolStoreKey: WOOL_STORE_KEY, scenarioCode },
  )
}

async function findScenario(page: Page, scenarioCode: string): Promise<ScenarioOrder> {
  const matches = await findScenarios(page, scenarioCode)
  if (!matches[0]) throw new Error(`找不到毛织 Mock 场景 ${scenarioCode}`)
  return matches[0]
}

async function filterOrder(page: Page, orderNo: string): Promise<void> {
  const keyword = page.getByRole('textbox', {
    name: '加工单号 / 任务号 / 款号 / 款名 / 内部货号',
    exact: true,
  })
  await expect(keyword).toBeVisible({ timeout: 90_000 })
  await keyword.fill(orderNo)
  await expect(page.getByRole('button', { name: /^可以开工\s+\d+$/ })).toBeVisible()
}

async function selectTab(page: Page, label: '可以开工' | '不可以开工' | '已完成'): Promise<void> {
  await page.locator('[data-wool-work-orders-tabs]').filter({ visible: true })
    .getByRole('button', { name: new RegExp(`^${label}\\s+\\d+$`) })
    .click()
}

function rowFor(page: Page, order: ScenarioOrder) {
  return page.getByRole('row').filter({ hasText: order.woolOrderNo })
}

async function openRowAction(page: Page, order: ScenarioOrder, action: string): Promise<void> {
  const actionCode: Record<string, string> = {
    确认接收: 'open-receipt',
    加工填报: 'open-report',
    发起交出: 'open-handover',
    完成加工单: 'open-complete',
    修改记录数量: 'open-qty-list',
  }
  const selector = actionCode[action]
    ? `[data-wool-work-orders-action="${actionCode[action]}"][data-wool-order-id="${order.woolOrderId}"]`
    : ''
  const button = selector
    ? page.locator(selector).filter({ visible: true })
    : rowFor(page, order).getByRole('button', { name: action, exact: true })
  await expect(button).toBeVisible()
  await button.click()
}

async function openMachineAssociationFromWorkOrder(page: Page, order: ScenarioOrder) {
  await openWoolOrders(page)
  await filterOrder(page, order.woolOrderNo)
  const entry = rowFor(page, order).locator(
    `[data-nav="/fcs/process-factory/wool/machine-associations?woolOrderId=${order.woolOrderId}"]`,
  )
  await expect(entry).toBeVisible()
  await entry.click()
  const dialog = page.locator('[data-wool-machine-association-dialog]').filter({ visible: true })
  await expect(dialog).toHaveCount(1)
  return dialog
}

async function readWoolStore(page: Page): Promise<WoolStoreSnapshot> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), WOOL_STORE_KEY)
}

function signedFlowQty(flow: WoolStoreSnapshot['warehouseFlows'][number]): number {
  return flow.flowType === 'OUTBOUND' ? -Math.abs(flow.qty) : flow.qty
}

function stockAt(
  store: WoolStoreSnapshot,
  orderId: string,
  sku: string,
  locationId: string,
): number {
  return store.warehouseFlows
    .filter((flow) =>
      flow.woolOrderId === orderId
      && flow.objectSkuCode === sku
      && flow.defaultLocationId === locationId,
    )
    .reduce((sum, flow) => sum + signedFlowQty(flow), 0)
}

async function reportAndHandoverFromUi(
  page: Page,
  order: ScenarioOrder,
  reportQty: number,
  handoverQty: number,
): Promise<void> {
  if (await page.locator('[data-wool-work-orders-root]').count() === 0) {
    await openWoolOrders(page)
  }
  await filterOrder(page, order.woolOrderNo)
  await openRowAction(page, order, '加工填报')
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(reportQty))
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  await openRowAction(page, order, '发起交出')
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(handoverQty))
  await page.getByRole('button', { name: '保存发起交出', exact: true }).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
}

async function expectWoolListLayoutUsable(page: Page, order: ScenarioOrder): Promise<void> {
  await openWoolOrders(page)
  await filterOrder(page, order.woolOrderNo)
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    tableOverflow: document.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollWidth ?? 0,
    tableClient: document.querySelector<HTMLElement>('[data-standard-list-scroll]')?.clientWidth ?? 0,
  }))
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.tableOverflow).toBeGreaterThanOrEqual(layout.tableClient)
  await expect(rowFor(page, order).getByRole('button', { name: '加工填报', exact: true })).toBeInViewport()
  await openRowAction(page, order, '加工填报')
  await expect(page.getByRole('button', { name: '保存加工填报', exact: true })).toBeInViewport()
}

test.beforeEach(async ({ page }) => {
  await resetScenario(page)
})

test('每例独立清理路由、筛选、Tab、分页、弹窗、PDA 会话与持久列偏好，搜索联动三个 Tab', async ({ page }) => {
  await page.evaluate((pdaSessionKey) => {
    localStorage.setItem('wool-stale-column-preference', 'stale')
    localStorage.setItem(pdaSessionKey, 'stale')
  }, PDA_SESSION_KEY)
  await resetScenario(page)
  expect(await page.evaluate(() => localStorage.getItem('wool-stale-column-preference'))).toBeNull()
  expect(await page.evaluate((key) => localStorage.getItem(key), PDA_SESSION_KEY)).toBeNull()

  await openWoolOrders(page)
  const keyword = page.getByRole('textbox', {
    name: '加工单号 / 任务号 / 款号 / 款名 / 内部货号',
    exact: true,
  })
  await expect(keyword).toBeVisible()
  await keyword.evaluate((element) => element.setAttribute('data-e2e-identity', 'isolated-keyword'))
  await keyword.fill('WMO-CHECK')
  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^可以开工\s+1$/ })).toBeVisible()
  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^不可以开工\s+0$/ })).toBeVisible()
  await expect(page.locator('[data-wool-work-orders-tabs]').getByRole('button', { name: /^已完成\s+0$/ })).toBeVisible()
  await expect(page.locator('[data-summary-card]')).toHaveCount(0)
  await expect(keyword).toHaveAttribute('data-e2e-identity', 'isolated-keyword')
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
})

test('任一款色全部必需纱线有有效接收才可加工填报，且不按重量换算', async ({ page }) => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'NO_YARN_RECEIPT')
  await filterOrder(page, order.woolOrderNo)
  await selectTab(page, '不可以开工')

  await openRowAction(page, order, '确认接收')
  await page.locator('[data-wool-receipt-yarn="YARN-A"]').check()
  await page.locator('[data-wool-receipt-qty="YARN-A"]').fill('20')
  await page.locator('[data-wool-dialog-field="batchNo"]').fill('E2E-A')
  await page.getByRole('button', { name: '保存确认接收', exact: true }).click()
  await expect(rowFor(page, order)).not.toContainText('加工填报')

  await openRowAction(page, order, '确认接收')
  await page.locator('[data-wool-receipt-yarn="YARN-B"]').check()
  await page.locator('[data-wool-receipt-qty="YARN-B"]').fill('0.01')
  await page.locator('[data-wool-dialog-field="batchNo"]').fill('E2E-B')
  await page.getByRole('button', { name: '保存确认接收', exact: true }).click()

  await selectTab(page, '可以开工')
  await expect(rowFor(page, order).getByRole('button', { name: '加工填报', exact: true })).toBeVisible()
})

test('每个加工后 SKU 累计加工填报不超过计划数量的 150%', async ({ page }) => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await filterOrder(page, order.woolOrderNo)
  await openRowAction(page, order, '加工填报')
  const outputSkuCode = await page.locator('[data-wool-dialog-field="outputSkuCode"]').inputValue()
  const plan = order.outputPlanLines.find((line) => line.outputSkuCode === outputSkuCode)!
  const limit = Math.floor(plan.plannedQty * 1.5)
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(limit + 1))
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  await expect(page.locator('[data-wool-overlay-error]')).toContainText(`最多还可填报 ${limit}`)
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(limit))
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
})

test('至少一次加工填报才可交出，至少一次交出才显示完成加工单', async ({ page }) => {
  await openWoolOrders(page)
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await filterOrder(page, order.woolOrderNo)
  let row = rowFor(page, order)
  await expect(row.getByRole('button', { name: '发起交出', exact: true })).toHaveCount(0)
  await expect(row.getByRole('button', { name: '完成加工单', exact: true })).toHaveCount(0)
  await openRowAction(page, order, '加工填报')
  await page.locator('[data-wool-dialog-field="qty"]').fill('10')
  await page.getByRole('button', { name: '保存加工填报', exact: true }).click()
  row = rowFor(page, order)
  await expect(row.getByRole('button', { name: '发起交出', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: '完成加工单', exact: true })).toHaveCount(0)
  await openRowAction(page, order, '发起交出')
  await page.locator('[data-wool-dialog-field="qty"]').fill('5')
  await page.getByRole('button', { name: '保存发起交出', exact: true }).click()
  await expect(rowFor(page, order).getByRole('button', { name: '完成加工单', exact: true })).toBeVisible()
})

test('干净成衣和裁片场景经 UI 填报入固定库位、交出从同一库位扣减且 SKU 不跨库位', async ({ page }) => {
  await page.evaluate((key) => {
    const store = JSON.parse(localStorage.getItem(key) || '{}')
    const orders = Object.values(store.workOrders) as ScenarioOrder[]
    const targets = orders.filter((order) => order.mockScenarioCode === 'FIXED_LOCATION_UI')
    const ids = new Set(targets.map((order) => order.woolOrderId))
    store.processReports = store.processReports.filter((item: { woolOrderId: string }) => !ids.has(item.woolOrderId))
    store.handovers = store.handovers.filter((item: { woolOrderId: string }) => !ids.has(item.woolOrderId))
    store.completions = store.completions.filter((item: { woolOrderId: string }) => !ids.has(item.woolOrderId))
    store.warehouseFlows = store.warehouseFlows.filter((item: { woolOrderId: string; businessType: string }) =>
      !ids.has(item.woolOrderId) || item.businessType === 'YARN_RECEIPT')
    localStorage.setItem(key, JSON.stringify(store))
  }, WOOL_STORE_KEY)
  await clearWoolMemoryCache(page)
  const orders = await findScenarios(page, 'FIXED_LOCATION_UI')
  expect(orders).toHaveLength(2)

  for (const order of orders) {
    const line = order.outputPlanLines[0]
    const expectedLocation = line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-GARMENT-DEFAULT'
      : 'WOOL-WH-CUT-DEFAULT'
    const forbiddenLocation = line.outputObjectType === 'GARMENT'
      ? 'WOOL-WH-CUT-DEFAULT'
      : 'WOOL-WH-GARMENT-DEFAULT'
    const before = await readWoolStore(page)
    const reportsBefore = before.processReports.length
    const handoversBefore = before.handovers.length
    const stockBefore = stockAt(before, order.woolOrderId, line.outputSkuCode, expectedLocation)
    await reportAndHandoverFromUi(page, order, 7, 3)
    const after = await readWoolStore(page)
    const report = after.processReports.slice(reportsBefore)
      .find((item) => item.woolOrderId === order.woolOrderId)!
    const handover = after.handovers.slice(handoversBefore)
      .find((item) => item.woolOrderId === order.woolOrderId)!
    const inbound = after.warehouseFlows.find((flow) => flow.sourceRecordId === report.reportId)!
    const outbound = after.warehouseFlows.find((flow) => flow.sourceRecordId === handover.handoverId)!
    expect(report).toMatchObject({
      outputSkuCode: line.outputSkuCode,
      reportedQty: 7,
    })
    expect(handover).toMatchObject({
      outputSkuCode: line.outputSkuCode,
      handoverQty: 3,
    })
    expect(inbound).toMatchObject({
      flowType: 'INBOUND',
      businessType: 'PROCESS_REPORT',
      defaultLocationId: expectedLocation,
      objectSkuCode: line.outputSkuCode,
      qty: 7,
    })
    expect(outbound).toMatchObject({
      flowType: 'OUTBOUND',
      businessType: 'HANDOVER',
      defaultLocationId: expectedLocation,
      objectSkuCode: line.outputSkuCode,
      qty: 3,
    })
    expect(stockAt(after, order.woolOrderId, line.outputSkuCode, expectedLocation) - stockBefore).toBe(4)
    expect(after.warehouseFlows.some((flow) =>
      flow.woolOrderId === order.woolOrderId
      && flow.objectSkuCode === line.outputSkuCode
      && flow.defaultLocationId === forbiddenLocation,
    )).toBe(false)
  }
})

test('加工单先完成后，真实合法下游 PDA 会话仍可确认收货且只追加接收结果并锁定来源', async ({ page }) => {
  const order = await findScenario(page, 'FIXED_LOCATION_UI')
  await page.evaluate(
    ({ key, woolOrderId }) => {
      const store = JSON.parse(localStorage.getItem(key) || '{}')
      store.workOrders[woolOrderId].downstreamTarget = {
        receiverType: 'DOWNSTREAM_FACTORY',
        receiverId: 'PF-DEDICATED-001',
        receiverName: '后道专厂',
      }
      localStorage.setItem(key, JSON.stringify(store))
    },
    { key: WOOL_STORE_KEY, woolOrderId: order.woolOrderId },
  )
  await clearWoolMemoryCache(page)
  await openWoolOrders(page)
  await filterOrder(page, order.woolOrderNo)
  const existingHandoverIds = new Set(
    (await readWoolStore(page)).handovers
      .filter((item) => item.woolOrderId === order.woolOrderId)
      .map((item) => item.handoverId),
  )
  await reportAndHandoverFromUi(page, order, 7, 4)
  const afterHandover = await readWoolStore(page)
  const generatedHandovers = afterHandover.handovers.filter((item) =>
    item.woolOrderId === order.woolOrderId && !existingHandoverIds.has(item.handoverId),
  )
  expect(generatedHandovers).toHaveLength(1)
  const generatedHandover = generatedHandovers[0]
  expect(generatedHandover).toMatchObject({
    receiverId: 'PF-DEDICATED-001',
    receiverName: '后道专厂',
    handoverQty: 4,
    outputSkuCode: order.outputPlanLines[0].outputSkuCode,
    downstreamReceipt: {
      receiptConfirmationId: `DRC-${generatedHandover.handoverId}`,
      status: 'PENDING',
    },
  })
  await openRowAction(page, order, '完成加工单')
  await page.locator('[data-wool-business-dialog]:visible')
    .getByRole('button', { name: '确认完成加工单', exact: true })
    .click()

  const before = await readWoolStore(page)
  const sourceBefore = before.handovers.find((item) => item.handoverId === generatedHandover.handoverId)!
  const flowsBefore = before.warehouseFlows.filter((flow) => flow.woolOrderId === order.woolOrderId)
  expect(sourceBefore.downstreamReceipt).toMatchObject({
    receiptConfirmationId: `DRC-${sourceBefore.handoverId}`,
    status: 'PENDING',
  })
  const { downstreamReceipt: pendingReceipt } = sourceBefore
  expect(pendingReceipt?.actualReceivedQty).toBeUndefined()
  await installLegalPdaSession(page, 'PF-DEDICATED-001')
  const handoverHeadId = await page.evaluate(
    async ({ sourceHandoverId, modulePath }) => {
      const handoverModule = await import(/* @vite-ignore */ modulePath) as {
        listPdaHandoverHeads: () => Array<{ handoverId: string; sourceDocId?: string }>
      }
      const head = handoverModule.listPdaHandoverHeads()
        .find((item) => item.sourceDocId === sourceHandoverId)
      if (!head) throw new Error('找不到毛织交出对应的 PDA 交接头')
      return head.handoverId
    },
    {
      sourceHandoverId: sourceBefore.handoverId,
      modulePath: '/src/data/fcs/pda-handover-events.ts',
    },
  )
  await page.goto(`/fcs/pda/handover/${encodeURIComponent(handoverHeadId)}`)
  const receiverAccess = await page.evaluate(
    async ({ handoverHeadId, eventModulePath, runtimeModulePath, domainModulePath, permissionModulePath, pageModulePath }) => {
      const events = await import(/* @vite-ignore */ eventModulePath) as {
        findPdaHandoverHead: (id: string) => { factoryId: string; processBusinessCode?: string } | undefined
        getPdaHandoverRecordsByHead: (id: string) => Array<{ handoverRecordStatus?: string; status: string }>
      }
      const runtimeModule = await import(/* @vite-ignore */ runtimeModulePath) as {
        getPdaRuntimeContext: () => { factoryId: string } | null
      }
      const domain = await import(/* @vite-ignore */ domainModulePath) as {
        canReceiverWriteback: (record: { handoverRecordStatus?: string; status: string }) => boolean
      }
      const permissions = await import(/* @vite-ignore */ permissionModulePath) as {
        canReceiverWritebackAction: (role: string) => boolean
      }
      const detailPage = await import(/* @vite-ignore */ pageModulePath) as {
        renderPdaHandoverDetailPage: (id: string) => string
      }
      const head = events.findPdaHandoverHead(handoverHeadId)
      const record = events.getPdaHandoverRecordsByHead(handoverHeadId)[0]
      const runtime = runtimeModule.getPdaRuntimeContext()
      return {
        headFactoryId: head?.factoryId,
        runtimeFactoryId: runtime?.factoryId,
        handoverRecordStatus: record?.handoverRecordStatus,
        recordStatus: record?.status,
        domainAllowed: record ? domain.canReceiverWriteback(record) : false,
        roleAllowed: permissions.canReceiverWritebackAction('RECEIVER'),
        directRenderedAction: detailPage.renderPdaHandoverDetailPage(handoverHeadId)
          .includes('data-pda-handoverd-action="open-receiver-writeback"'),
      }
    },
    {
      handoverHeadId,
      eventModulePath: '/src/data/fcs/pda-handover-events.ts',
      runtimeModulePath: '/src/pages/pda-runtime.ts',
      domainModulePath: '/src/data/fcs/task-handover-domain.ts',
      permissionModulePath: '/src/data/fcs/action-permissions.ts',
      pageModulePath: '/src/pages/pda-handover-detail.ts',
    },
  )
  expect(receiverAccess).toMatchObject({
    headFactoryId: 'PF-DEDICATED-001',
    runtimeFactoryId: 'PF-DEDICATED-001',
    handoverRecordStatus: 'SUBMITTED_WAIT_WRITEBACK',
    recordStatus: 'PENDING_WRITEBACK',
    domainAllowed: true,
    roleAllowed: true,
    directRenderedAction: true,
  })
  const openWriteback = page.locator('[data-pda-handoverd-action="open-receiver-writeback"]')
  await expect(openWriteback).toBeVisible()
  await openWriteback.click()
  await page.locator('[data-pda-handoverd-field="writebackQty"]').fill(String(sourceBefore.handoverQty - 1))
  await page.locator('[data-pda-handoverd-field="writebackReason"]').fill('现场清点少 1 件')
  await page.locator('[data-pda-handoverd-action="submit-receiver-writeback"]').click()
  await expect(openWriteback).toHaveCount(0)

  const after = await readWoolStore(page)
  const sourceAfter = after.handovers.find((item) => item.handoverId === sourceBefore.handoverId)!
  const { downstreamReceipt: confirmedReceipt } = sourceAfter
  expect(after.handovers.filter((item) => item.woolOrderId === order.woolOrderId)).toHaveLength(
    before.handovers.filter((item) => item.woolOrderId === order.woolOrderId).length,
  )
  expect(sourceAfter.handoverQty).toBe(sourceBefore.handoverQty)
  expect(sourceAfter.outputSkuCode).toBe(sourceBefore.outputSkuCode)
  expect(sourceAfter.warehouseOutboundFlowId).toBe(sourceBefore.warehouseOutboundFlowId)
  expect(sourceAfter.receiverId).toBe(sourceBefore.receiverId)
  expect(sourceAfter.receiverName).toBe(sourceBefore.receiverName)
  expect(sourceAfter.downstreamReceipt).toMatchObject({
    receiptConfirmationId: sourceBefore.downstreamReceipt?.receiptConfirmationId
      || `DRC-${sourceBefore.handoverId}`,
    status: 'CONFIRMED',
    actualReceivedQty: sourceBefore.handoverQty - 1,
    differenceQty: -1,
    receivedBy: '接收方扫码员',
  })
  expect(sourceAfter.downstreamReceipt?.receivedAt).toBeTruthy()
  expect(after.warehouseFlows.filter((flow) => flow.woolOrderId === order.woolOrderId)).toEqual(flowsBefore)
  expect(confirmedReceipt?.status).toBe('CONFIRMED')

  await openWoolOrders(page)
  await filterOrder(page, order.woolOrderNo)
  await selectTab(page, '已完成')
  await expect(rowFor(page, order).getByRole('button', { name: '修改记录数量', exact: true })).toHaveCount(0)
})

test('横机覆盖一单多设备、跨单转移、最后解除为空闲、维修停用影响确认与自动解链', async ({ page }, testInfo) => {
  testInfo.setTimeout(420_000)
  const orderA = await findScenario(page, 'ONE_COLOR_READY')
  const orderB = await findScenario(page, 'MULTI_YARN_SINGLE_RECEIPT')
  let dialog = await openMachineAssociationFromWorkOrder(page, orderA)
  await expect(dialog.locator('[data-wool-machine-associations-machine-id="WM-006"]')).toBeDisabled()
  await expect(dialog.locator('[data-wool-machine-associations-machine-id="WM-007"]')).toBeDisabled()
  await dialog.locator('[data-wool-machine-associations-machine-id="WM-003"]').check()
  await dialog.locator('[data-wool-machine-associations-machine-id="WM-005"]').check()
  await dialog.getByRole('button', { name: '保存整组关联', exact: true }).click()
  expect((await readWoolStore(page)).machineAssociations
    .filter((item) => item.woolOrderId === orderA.woolOrderId)
    .map((item) => item.machineId).sort()).toEqual(['WM-003', 'WM-005'])

  dialog = await openMachineAssociationFromWorkOrder(page, orderB)
  await dialog.locator('[data-wool-machine-associations-machine-id="WM-003"]').check()
  await dialog.getByRole('button', { name: '保存整组关联', exact: true }).click()
  await expect(dialog).toContainText(orderA.woolOrderNo)
  await dialog.getByRole('button', { name: '确认跨单转移并保存', exact: true }).click()
  expect((await readWoolStore(page)).machineAssociations.filter((item) => item.machineId === 'WM-003'))
    .toEqual([expect.objectContaining({ woolOrderId: orderB.woolOrderId })])

  dialog = await openMachineAssociationFromWorkOrder(page, orderB)
  await dialog.locator('[data-wool-machine-associations-machine-id="WM-003"]').uncheck()
  await dialog.getByRole('button', { name: '保存整组关联', exact: true }).click()
  let store = await readWoolStore(page)
  expect(store.machineAssociations.some((item) => item.machineId === 'WM-003')).toBe(false)
  expect(store.machines.find((item) => item.machineId === 'WM-003')?.status).toBe('IDLE')

  dialog = await openMachineAssociationFromWorkOrder(page, orderB)
  await dialog.locator('[data-wool-machine-associations-machine-id="WM-003"]').check()
  await dialog.locator('[data-wool-machine-associations-machine-id="WM-005"]').check()
  await dialog.getByRole('button', { name: '保存整组关联', exact: true }).click()
  await expect(dialog).toContainText(orderA.woolOrderNo)
  await dialog.getByRole('button', { name: '确认跨单转移并保存', exact: true }).click()

  await page.goto('/fcs/craft/wool/machines')
  const machineKeyword = page.getByRole('textbox', {
    name: '设备 / 加工单 / 生产单 / 款号',
    exact: true,
  })
  await expect(machineKeyword).toBeVisible({ timeout: 90_000 })
  for (const [machineId, machineNo, nextStatus, nextLabel] of [
    ['WM-003', '横机-003', 'REPAIR', '维修'],
    ['WM-005', '横机-005', 'DISABLED', '停用'],
  ] as const) {
    await machineKeyword.fill(machineNo)
    const machineRow = page.getByRole('row').filter({ hasText: machineNo })
    await expect(machineRow).toContainText('生产中')
    await machineRow.getByRole('button', { name: '修改状态', exact: true }).click()
    const statusDialog = page.locator('[data-wool-machine-status-dialog]')
    await statusDialog.locator('[data-wool-machines-dialog-field="nextStatus"]').selectOption(nextStatus)
    await statusDialog.locator('[data-wool-machines-dialog-field="reason"]').fill(`E2E ${nextLabel}原因`)
    await statusDialog.getByRole('button', { name: '保存状态', exact: true }).click()
    await expect(statusDialog).toContainText('生产中设备影响确认')
    await expect(statusDialog).toContainText(orderB.woolOrderNo)
    await statusDialog.getByRole('button', { name: '确认影响并修改状态', exact: true }).click()
    store = await readWoolStore(page)
    expect(store.machineAssociations.some((item) => item.machineId === machineId)).toBe(false)
    expect(store.machines.find((item) => item.machineId === machineId)?.status).toBe(nextStatus)
  }
})

test('PDA 完成二次确认五类事实均可分页，且只更新对应区块并保留根节点和未提交草稿', async ({ page }) => {
  const order = await findScenario(page, 'READY_TO_COMPLETE')
  await page.evaluate(
    ({ key, woolOrderId }) => {
      const store = JSON.parse(localStorage.getItem(key) || '{}')
      const order = store.workOrders[woolOrderId]
      const baseLine = order.outputPlanLines[1]
      const thirdLine = {
        ...baseLine,
        outputSkuCode: `${baseLine.outputSkuCode}-L`,
        sizeCode: 'L',
      }
      order.outputPlanLines.push(thirdLine)
      const receipt = store.yarnReceipts.find((item: { woolOrderId: string }) => item.woolOrderId === woolOrderId)
      receipt.lines.push({
        ...receipt.lines[0],
        lineId: `${receipt.receiptId}-LINE-C`,
        yarnSkuCode: 'YARN-C',
        yarnName: 'YARN-C 纱线',
        warehouseInboundFlowId: `${receipt.receiptId}-FLOW-C`,
      })
      store.warehouseFlows.push({
        ...store.warehouseFlows.find((item: { woolOrderId: string; businessType: string }) =>
          item.woolOrderId === woolOrderId && item.businessType === 'YARN_RECEIPT'),
        flowId: `${receipt.receiptId}-FLOW-C`,
        objectSkuCode: 'YARN-C',
        sourceRecordId: `${receipt.receiptId}-LINE-C`,
      })
      for (const [line, suffix] of [[baseLine, 'WHITE'], [thirdLine, 'L']] as const) {
        const reportId = `WPR-PAGE-${suffix}`
        store.processReports.push({
          ...store.processReports.find((item: { woolOrderId: string }) => item.woolOrderId === woolOrderId),
          reportId,
          outputSkuCode: line.outputSkuCode,
          reportedQty: 12,
          warehouseInboundFlowId: `WF-${reportId}`,
        })
        store.warehouseFlows.push({
          ...store.warehouseFlows.find((item: { woolOrderId: string; businessType: string }) =>
            item.woolOrderId === woolOrderId && item.businessType === 'PROCESS_REPORT'),
          flowId: `WF-${reportId}`,
          objectSkuCode: line.outputSkuCode,
          qty: 12,
          sourceRecordId: reportId,
        })
      }
      const baseHandover = store.handovers.find((item: { woolOrderId: string }) => item.woolOrderId === woolOrderId)
      for (const suffix of ['PAGE-2', 'PAGE-3']) {
        const handoverId = `WHO-${suffix}`
        store.handovers.push({
          ...baseHandover,
          handoverId,
          handoverQty: 2,
          warehouseOutboundFlowId: `WF-${handoverId}`,
          downstreamReceipt: {
            receiptConfirmationId: `DRC-${handoverId}`,
            status: 'PENDING',
          },
        })
        store.warehouseFlows.push({
          ...store.warehouseFlows.find((item: { sourceRecordId: string }) =>
            item.sourceRecordId === baseHandover.handoverId),
          flowId: `WF-${handoverId}`,
          qty: 2,
          sourceRecordId: handoverId,
        })
      }
      store.machineAssociations.push(...['WM-003', 'WM-005', 'WM-008'].map((machineId, index) => ({
        machineId,
        woolOrderId,
        associatedAt: `2026-07-31 09:0${index}:00`,
        associatedBy: 'E2E 毛织主管',
      })))
      localStorage.setItem(key, JSON.stringify(store))
    },
    { key: WOOL_STORE_KEY, woolOrderId: order.woolOrderId },
  )
  await clearWoolMemoryCache(page)
  const seeded = await readWoolStore(page)
  expect(seeded.workOrders[order.woolOrderId].outputPlanLines).toHaveLength(3)
  expect(seeded.processReports.filter((item) => item.woolOrderId === order.woolOrderId)).toHaveLength(3)
  expect(seeded.handovers.filter((item) => item.woolOrderId === order.woolOrderId)).toHaveLength(3)
  expect(seeded.machineAssociations.filter((item) => item.woolOrderId === order.woolOrderId)).toHaveLength(3)
  await installLegalPdaSession(page, 'OWN_WOOL_FACTORY')
  await page.goto(`/fcs/pda/exec/${encodeURIComponent(order.taskId)}`)
  await replaceWoolStoreFromStorage(page)
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')))
  await expect(page.locator('[data-pda-wool-root]')).toBeVisible()
  const loaded = await readWoolStore(page)
  expect(loaded.workOrders[order.woolOrderId].outputPlanLines).toHaveLength(3)
  const loadedFactCounts = await page.evaluate(
    async ({ woolOrderId, modulePath }) => {
      const mobile = await import(/* @vite-ignore */ modulePath) as {
        buildWoolMobileTaskProjection: (id: string) => {
          completionFacts: Record<string, unknown[]>
        }
      }
      const facts = mobile.buildWoolMobileTaskProjection(woolOrderId).completionFacts
      return Object.fromEntries(
        ['yarnReceipts', 'processReports', 'handovers', 'waitHandoverStocks', 'currentMachines']
          .map((key) => [key, facts[key].length]),
      )
    },
    {
      woolOrderId: order.woolOrderId,
      modulePath: '/src/data/fcs/wool-domain/mobile.ts',
    },
  )
  expect(loadedFactCounts).toMatchObject({
    yarnReceipts: 3,
    processReports: 3,
    handovers: 3,
    waitHandoverStocks: 3,
    currentMachines: 3,
  })
  const root = page.locator('[data-pda-wool-root]')
  await expect(root).toBeVisible()
  await expect(root.locator('[data-pda-wool-action="open-fact"].bg-primary')).toHaveCount(1)
  await expect(root.locator('[data-pda-wool-action="open-fact"].bg-primary')).toHaveAttribute('data-wool-fact-action', 'COMPLETE')
  await root.locator('[data-pda-wool-action="open-fact"].bg-primary').click()
  await root.evaluate((element) => element.setAttribute('data-e2e-identity', 'stable-pda-root'))
  const remark = page.locator('[data-pda-wool-draft][data-draft-field="remark"]')
  await remark.fill('分页过程中保留的完成备注')

  const sections = ['yarnReceipts', 'processReports', 'handovers', 'waitHandoverStocks', 'currentMachines']
  for (const sectionKey of sections) {
    const section = page.locator(`[data-completion-section="${sectionKey}"]`)
    await expect(section.getByRole('button', { name: '下一页', exact: true })).toBeVisible()
    const beforeText = await section.innerText()
    for (const otherKey of sections.filter((key) => key !== sectionKey)) {
      await page.locator(`[data-completion-section="${otherKey}"]`)
        .evaluate((element, marker) => element.setAttribute('data-e2e-stable', marker), otherKey)
    }
    await section.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(section).not.toHaveText(beforeText)
    await expect(root).toHaveAttribute('data-e2e-identity', 'stable-pda-root')
    await expect(remark).toHaveValue('分页过程中保留的完成备注')
    for (const otherKey of sections.filter((key) => key !== sectionKey)) {
      await expect(page.locator(`[data-completion-section="${otherKey}"]`))
        .toHaveAttribute('data-e2e-stable', otherKey)
    }
  }
})

test('完成弹窗展示完整五类事实，完成快照冻结且自动解链不改来源交出与库存', async ({ page }) => {
  const order = await findScenario(page, 'READY_TO_COMPLETE')
  await page.evaluate(
    ({ key, woolOrderId }) => {
      const store = JSON.parse(localStorage.getItem(key) || '{}')
      store.machineAssociations.push({
        machineId: 'WM-003',
        woolOrderId,
        associatedAt: '2026-07-31 08:30:00',
        associatedBy: 'E2E 毛织主管',
      })
      localStorage.setItem(key, JSON.stringify(store))
    },
    { key: WOOL_STORE_KEY, woolOrderId: order.woolOrderId },
  )
  await clearWoolMemoryCache(page)
  const before = await readWoolStore(page)
  const sourceHandovers = before.handovers.filter((item) => item.woolOrderId === order.woolOrderId)
  const sourceFlows = before.warehouseFlows.filter((flow) => flow.woolOrderId === order.woolOrderId)
  await openWoolOrders(page)
  await filterOrder(page, order.woolOrderNo)
  await openRowAction(page, order, '完成加工单')
  const dialog = page.locator('[data-wool-business-dialog]')
  await expect(dialog).toContainText('系统仅展示当前业务事实，不判断该加工单是否应该完成')
  for (const title of ['确认接收情况', '加工填报情况', '发起交出情况', '待交出仓情况', '当前横机关联']) {
    await expect(dialog.getByText(title, { exact: true })).toBeVisible()
  }
  await expect(dialog).toContainText('YARN-A：已确认，累计 1 kg，批次 BATCH-AB')
  await expect(dialog).toContainText(`${order.outputPlanLines[0].outputSkuCode}：计划 100件 / 上限 150件 / 累计 60件`)
  await expect(dialog).toContainText(`${sourceHandovers[0].handoverId}：40件，下游待确认`)
  await expect(dialog).toContainText('固定库位 WOOL-WH-GARMENT-DEFAULT')
  await expect(dialog).toContainText('横机-003｜电脑横机 3 号｜生产中｜关联时间 2026-07-31 08:30:00')
  await dialog.getByRole('button', { name: '确认完成加工单', exact: true }).click()

  const after = await readWoolStore(page)
  const completion = after.completions.find((item) => item.woolOrderId === order.woolOrderId)!
  expect(completion.confirmationSnapshot.yarnReceiptSummary).toEqual(expect.arrayContaining([
    expect.objectContaining({ yarnSkuCode: 'YARN-A', receivedQty: 1 }),
  ]))
  expect(completion.confirmationSnapshot.processReportSummary).toEqual(expect.arrayContaining([
    expect.objectContaining({ outputSkuCode: order.outputPlanLines[0].outputSkuCode, reportedQty: 60 }),
  ]))
  expect(completion.confirmationSnapshot.handoverSummary).toEqual(expect.arrayContaining([
    expect.objectContaining({ handoverId: sourceHandovers[0].handoverId, handoverQty: 40 }),
  ]))
  expect(completion.confirmationSnapshot.waitHandoverStockSummary).toEqual(expect.arrayContaining([
    expect.objectContaining({ outputSkuCode: order.outputPlanLines[0].outputSkuCode, stockQty: 20 }),
  ]))
  expect(completion.confirmationSnapshot.releasedMachineIds).toEqual(['WM-003'])
  expect(completion.confirmationSnapshot.releasedMachines).toEqual([
    expect.objectContaining({ machineId: 'WM-003', machineNo: '横机-003', machineName: '电脑横机 3 号' }),
  ])
  expect(after.machineAssociations.some((item) => item.woolOrderId === order.woolOrderId)).toBe(false)
  expect(after.machines.find((item) => item.machineId === 'WM-003')?.status).toBe('IDLE')
  expect(after.handovers.filter((item) => item.woolOrderId === order.woolOrderId)).toEqual(sourceHandovers)
  expect(after.warehouseFlows.filter((flow) => flow.woolOrderId === order.woolOrderId)).toEqual(sourceFlows)
})

test('毛织交出单支持加工单批量打印和详情单条打印，SPU 仅一张真实款式图且二维码可扫描', async ({ page }) => {
  const order = await findScenario(page, 'MULTIPLE_HANDOVERS_WITH_STOCK')
  const store = await readWoolStore(page)
  const handovers = store.handovers.filter((item) => item.woolOrderId === order.woolOrderId)
  expect(handovers).toHaveLength(2)

  await openWoolOrders(page)
  await filterOrder(page, order.woolOrderNo)
  await rowFor(page, order).getByRole('button', { name: '打印交出单', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/craft/wool/work-orders/${order.woolOrderId}/handover-print$`))
  const batchPages = page.locator('[data-wool-handover-print-page]')
  await expect(batchPages).toHaveCount(2)
  for (let index = 0; index < handovers.length; index += 1) {
    const printPage = batchPages.nth(index)
    const spuInfo = printPage.locator('[data-wool-print-spu-info]')
    await expect(spuInfo).toContainText(order.styleNo)
    await expect(spuInfo.locator('[data-wool-print-style-image]')).toHaveCount(1)
    await expect(spuInfo.locator('[data-wool-print-style-image]')).toHaveAttribute('src', /\.jpg$/)
    await expect(printPage.locator('[data-wool-print-style-image]')).toHaveCount(1)
    await expect(printPage).toContainText(order.outputPlanLines[0].outputSkuCode)
    await expect(printPage).toContainText(order.outputPlanLines[0].colorName)
    await expect(printPage).toContainText(order.outputPlanLines[0].sizeCode)
    await expect(printPage).toContainText('下游接收工厂')
    await expect(printPage).not.toContainText('本次交出对应物料')
    await expect(printPage).not.toContainText('物料图')
    await expect(printPage.locator('[data-wool-print-materials], [data-wool-print-material-item], [data-material-sku], [data-testid^="wool-print-material-image"]')).toHaveCount(0)
    await expect(printPage.locator('[data-real-qr] svg[role="img"]')).toHaveCount(1)
    await expect(printPage.locator('[data-barcode], [data-qr-code]')).toHaveCount(0)
  }
  await expect(page.getByText('菲票')).toHaveCount(0)

  await page.goto(`/fcs/craft/wool/work-orders/${encodeURIComponent(order.woolOrderId)}`)
  await page.getByRole('button', { name: '发起交出记录', exact: true }).click()
  const singlePrint = page.getByRole('button', { name: '打印本次交出单', exact: true }).first()
  await expect(singlePrint).toBeVisible()
  await singlePrint.click()
  await expect(page).toHaveURL(new RegExp(
    `/fcs/craft/wool/work-orders/${order.woolOrderId}/handover-print/${handovers[0].handoverId}$`,
  ))
  await expect(page.locator('[data-wool-handover-print-page]')).toHaveCount(1)
  await expect(page.locator('[data-wool-handover-print-page]')).toHaveAttribute('data-handover-id', handovers[0].handoverId)
  await expect(page.locator('[data-wool-handover-print-root]')).not.toContainText(handovers[1].handoverId)
  await page.locator('[data-wool-handover-print-page]').screenshot({
    path: 'output/playwright/wool-handover-print-spu-integrated.png',
  })
})

test('1366×768 预热后唯一 PDA 主操作真实可见结果小于 200ms，输入与弹窗保持局部更新', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await installLegalPdaSession(page, 'OWN_WOOL_FACTORY')
  await page.goto(`/fcs/pda/exec/${encodeURIComponent(order.taskId)}`)
  const root = page.locator('[data-pda-wool-root]')
  const primary = root.locator('[data-pda-wool-action="open-fact"].bg-primary')
  await expect(primary).toHaveCount(1)
  await primary.click()
  await expect(page.locator('[data-pda-wool-action="save-fact"]')).toBeVisible()
  await page.locator('[data-pda-wool-action="close-overlay"]').first().click()
  await expect(page.locator('[data-pda-wool-action="save-fact"]')).toHaveCount(0)

  const duration = await primary.evaluate((button) =>
    new Promise<number>((resolve, reject) => {
      const startedAt = performance.now()
      let settled = false
      const finishWhenVisible = () => {
        const result = document.querySelector<HTMLElement>(
          '[data-pda-wool-overlay-root] [data-pda-wool-action="save-fact"]',
        )
        if (!result || result.getBoundingClientRect().height <= 0) return false
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (settled) return
            settled = true
            observer.disconnect()
            resolve(performance.now() - startedAt)
          })
        })
        return true
      }
      const observer = new MutationObserver(() => finishWhenVisible())
      observer.observe(document.body, { childList: true, subtree: true })
      ;(button as HTMLButtonElement).click()
      finishWhenVisible()
      window.setTimeout(() => {
        if (settled) return
        settled = true
        observer.disconnect()
        reject(new Error('预热后的主操作真实可见结果未在 200ms 内出现'))
      }, 200)
    }))
  expect(duration).toBeLessThan(200)
  await root.evaluate((element) => element.setAttribute('data-e2e-identity', 'stable-performance-root'))
  await page.locator('[data-pda-wool-draft][data-draft-field="qty"]').fill('8')
  await expect(root).toHaveAttribute('data-e2e-identity', 'stable-performance-root')
  await expect(page.locator('[data-pda-wool-action="save-fact"]')).toBeInViewport()
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  await expectWoolListLayoutUsable(page, order)
})

test('1280×720 下列表主体不横溢、宽表内部滚动、右侧操作列与弹窗按钮可见', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const order = await findScenario(page, 'ONE_COLOR_READY')
  await expectWoolListLayoutUsable(page, order)
})
