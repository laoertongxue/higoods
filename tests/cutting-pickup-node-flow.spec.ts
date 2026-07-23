import { expect, test, type Page } from '@playwright/test'

const pcPath = '/fcs/craft/cutting/pickup-management'

test.setTimeout(180_000)

async function resetStores(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('productionMaterialPrepWorkflow')
    localStorage.removeItem('cuttingRuntimeEventLedger')
    localStorage.removeItem('standard-list:/fcs/craft/cutting/pickup-management')
    localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'F090_operator',
      loginId: 'F090_operator',
      userName: '裁床仓管',
      roleId: 'ROLE_OPERATOR',
      factoryId: 'F090',
      factoryName: '全能力测试工厂',
      loggedAt: '2026-07-23 10:00:00',
    }))
  })
}

test.beforeEach(async ({ page }) => {
  await resetStores(page)
})

async function clickPickupTabAndMeasure(page: Page, tab: string): Promise<number> {
  return page.evaluate((tabKey) => new Promise<number>((resolve, reject) => {
    const button = document.querySelector<HTMLElement>(`[data-pickup-tab="${tabKey}"]`)
    if (!button) {
      reject(new Error(`页签不存在：${tabKey}`))
      return
    }
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      const active = document.querySelector(`[data-pickup-tab="${tabKey}"].bg-blue-600`)
      if (!active) return
      observer.disconnect()
      resolve(performance.now() - startedAt)
    })
    observer.observe(document.querySelector('[data-standard-list-page]')!, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    button.click()
    window.setTimeout(() => {
      observer.disconnect()
      reject(new Error(`页签局部刷新超时：${tabKey}`))
    }, 1000)
  }), tab)
}

test('四页签使用各自事实且局部刷新保持页面根节点', async ({ page }) => {
  await page.goto(pcPath)
  const root = page.locator('[data-standard-list-page]')
  await expect(root).toBeVisible()
  const rootIdentity = await root.evaluate((element) => {
    ;(window as typeof window & { __pickupRoot?: Element }).__pickupRoot = element
    return true
  })
  expect(rootIdentity).toBe(true)

  // 首次点击用于加载统一事件处理模块；后续业务交互必须局部完成。
  await page.locator('[data-pickup-tab="REJECTED_WAIT_WLS"]').click()
  for (const [tab, expectedKind] of [
    ['REJECTED_WAIT_WLS', 'REJECTED_ORDER'],
    ['PICKUP_DONE', 'PICKUP_SESSION'],
    ['ACTUAL_CLOSED', 'CLOSED_ORDER'],
    ['WAIT_PICKUP', ''],
  ] as const) {
    const elapsed = await clickPickupTabAndMeasure(page, tab)
    await expect(page.locator(`[data-pickup-tab="${tab}"].bg-blue-600`)).toBeVisible()
    expect(elapsed).toBeLessThan(200)
    expect(await page.evaluate(() =>
      (window as typeof window & { __pickupRoot?: Element }).__pickupRoot === document.querySelector('[data-standard-list-page]')
    )).toBe(true)
    await expect(page.getByText('办理领料入库', { exact: true })).toHaveCount(tab === 'WAIT_PICKUP' ? 3 : 0)
    if (expectedKind) await expect(page.locator(`[data-pickup-row-kind="${expectedKind}"]`).first()).toBeVisible()
  }
})

test('节点详情展示版本、全部来源货位，PC 只进入 PDA', async ({ page }) => {
  await page.goto(pcPath)
  const pdaLink = page.getByText('办理领料入库', { exact: true }).first()
  await expect(pdaLink).toHaveAttribute('href', /pickupNodeId=.*version=/)
  await page.getByText('查看当前节点', { exact: true }).first().click()
  await expect(page.getByRole('heading', { name: '领料详情' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('节点版本', { exact: true })).toBeVisible()
  await expect(page.getByText('去 PDA 办理领料入库', { exact: true })).toBeVisible()
  await expect(page.locator('body')).toContainText('卷件')
  await expect(page.locator('body')).not.toContainText('本轮全部领取')
})

test('列设置支持排序、显隐、冻结、拖拽、pageSize 并持久化', async ({ page }) => {
  await page.goto(pcPath)
  await page.getByRole('button', { name: '列设置' }).click()
  const sourceRow = page.locator('[data-standard-list-column-key="sourceLocation"]')
  await expect(sourceRow).toBeVisible()
  const visibility = sourceRow.getByLabel('显示')
  await visibility.uncheck()
  await expect(page.getByRole('columnheader', { name: '中转仓承载位置' })).toHaveCount(0)
  const productionRow = page.locator('[data-standard-list-column-key="productionOrder"]')
  await productionRow.getByLabel('冻结').check()
  await sourceRow.dragTo(productionRow)
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  const sortButton = page.getByRole('button', { name: /按当前领料节点升序排列/ })
  await sortButton.click()
  await expect(page.locator('[data-standard-list-sort-icon="asc"]').first()).toBeVisible()
  await page.locator('[data-pickup-field="pageSize"]').selectOption('20')
  await page.reload()
  await expect(page.locator('[data-pickup-field="pageSize"]')).toHaveValue('20')
  await expect(page.getByRole('columnheader', { name: '中转仓承载位置' })).toHaveCount(0)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('standard-list:/fcs/craft/cutting/pickup-management') || '{}'))
  expect(stored.pageSize).toBe(20)
  expect(stored.frozenKeys).toContain('productionOrder')
})

test('PDA 混合单位确认形成 1 Session + N Detail，重复 API 幂等', async ({ page }) => {
  await page.goto(pcPath)
  const href = await page.getByText('办理领料入库', { exact: true }).first().getAttribute('href')
  expect(href).toBeTruthy()
  await page.goto(href!)
  const confirmButton = page.locator('button[data-pda-warehouse-action="confirm-cutting-wp-pickup"]')
  await expect(confirmButton).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('body')).toContainText('yard')
  await expect(page.locator('body')).toContainText('粒')
  await confirmButton.click()
  await expect(page).toHaveURL(/scope=cutting&action=pickup$/)

  const facts = await page.evaluate(async () => {
    const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
    const runtime = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const projections = prep.listMaterialPrepOrderProjections()
    const session = projections.flatMap((item) => item.pickupSessions).find((item) => item.receiverName === '裁床仓管')!
    const details = projections.flatMap((item) => item.pickupRecords).filter((item) => item.pickupSessionId === session.pickupSessionId)
    const duplicate = prep.appendPickupSessionFromNode({
      pickupNodeId: session.pickupNodeId,
      pickupNodeVersion: 0,
      receiverName: '重复提交',
      warehouseArea: '错误库区',
      locationCode: 'ERROR',
      waitProcessLedgerEventId: 'duplicate',
      idempotencyKey: session.idempotencyKey,
    })
    const events = runtime.listCuttingRuntimeEventsByType('中转仓领料').filter((event) =>
      (event.payload as Record<string, unknown>).pickupSessionId === session.pickupSessionId
    )
    return {
      sessionId: session.pickupSessionId,
      duplicateId: duplicate.pickupSessionId,
      detailCount: details.length,
      snapshotCount: session.pickupNodeSnapshot?.items.length,
      events: events.map((event) => ({ qty: event.inventoryEffect?.qty, unit: event.inventoryEffect?.unit })),
      activeUnique: new Set(prep.listActivePickupNodes().map((node) => node.prepOrderId)).size === prep.listActivePickupNodes().length,
      nodeTypes: Array.from(new Set(projections.flatMap((item) => item.pickupSessions).map((item) => item.nodeType))),
    }
  })
  expect(facts.duplicateId).toBe(facts.sessionId)
  expect(facts.detailCount).toBe(facts.snapshotCount)
  expect(facts.events.every((event) => Number(event.qty) > 0)).toBe(true)
  expect(new Set(facts.events.map((event) => event.unit))).toEqual(new Set(['yard', '粒']))
  expect(facts.activeUnique).toBe(true)
  expect(facts.nodeTypes).toEqual(expect.arrayContaining(['INCOMPLETE_PICKABLE', 'READY_TO_PICKUP']))
})

test('同步失败 Session 可从 PDA 补写且不重复主明细和流水', async ({ page }) => {
  await page.goto(pcPath)
  const seeded = await page.evaluate(async () => {
    const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
    const node = prep.listActivePickupNodes()[0]
    const session = prep.appendPickupSessionFromNode({
      pickupNodeId: node.nodeId,
      pickupNodeVersion: node.version,
      receiverName: '裁床仓管',
      warehouseArea: '待加工仓 A 区',
      locationCode: 'FAB-A-01',
      waitProcessLedgerEventId: `failed:${node.nodeId}`,
      idempotencyKey: `failed:${node.nodeId}:v${node.version}`,
      warehouseSyncDeferred: true,
    })
    return { sessionId: session.pickupSessionId, detailCount: session.pickupRecordIds.length }
  })
  await page.goto('/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup')
  const retry = page.locator('button[data-pda-warehouse-action="retry-cutting-pickup-sync"]')
  await expect(retry).toBeVisible({ timeout: 60_000 })
  await expect(retry).toHaveAttribute('data-pickup-session-id', seeded.sessionId)
  await retry.click()
  await expect(page.locator('button[data-pda-warehouse-action="retry-cutting-pickup-sync"]')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('同步状态：已回写')
  const after = await page.evaluate(async (sessionId) => {
    const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
    const runtime = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const projection = prep.listMaterialPrepOrderProjections().find((item) => item.pickupSessions.some((session) => session.pickupSessionId === sessionId))!
    const session = projection.pickupSessions.find((item) => item.pickupSessionId === sessionId)!
    return {
      status: session.warehouseSyncStatus,
      sessions: projection.pickupSessions.filter((item) => item.pickupSessionId === sessionId).length,
      details: projection.pickupRecords.filter((item) => item.pickupSessionId === sessionId).length,
      events: runtime.listCuttingRuntimeEventsByType('中转仓领料').filter((event) =>
        (event.payload as Record<string, unknown>).pickupSessionId === sessionId
      ).length,
    }
  }, seeded.sessionId)
  expect(after).toEqual({ status: '已回写', sessions: 1, details: seeded.detailCount, events: seeded.detailCount })
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}×${viewport.height} 页面主体无横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(pcPath)
    await expect(page.locator('[data-standard-list-page]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  })
}
