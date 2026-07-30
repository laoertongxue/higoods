import { expect, test, type Page } from '@playwright/test'

const readyPath = '/fcs/craft/cutting/pickup-management/ready'
const incompletePath = '/fcs/craft/cutting/pickup-management/incomplete'

test.setTimeout(120_000)

async function resetStores(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('productionMaterialPrepWorkflow')
    localStorage.removeItem('cuttingRuntimeEventLedger')
    localStorage.removeItem('standard-list:/fcs/craft/cutting/pickup-management/ready')
    localStorage.removeItem('standard-list:/fcs/craft/cutting/pickup-management/incomplete')
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

for (const [label, path] of [
  ['已配齐', readyPath],
  ['未配齐', incompletePath],
] as const) {
  test(`${label}列表与 PDA 实际消费同一节点 ID 和版本，并明确确认全部领料`, async ({ page }) => {
    await page.goto(path)
    const row = page.getByRole('row').filter({ hasText: '去领料' }).first()
    await expect(row).toBeVisible({ timeout: 60_000 })
    const productionOrderNo = (await row.textContent())?.match(/PO-\d{6}-\d{4}/)?.[0]
    expect(productionOrderNo).toBeTruthy()
    const href = await row.getByRole('link', { name: '去领料', exact: true }).getAttribute('href')
    expect(href).toBeTruthy()
    const target = new URL(href!, 'http://127.0.0.1')
    const linkedNode = {
      nodeId: target.searchParams.get('pickupNodeId'),
      version: Number(target.searchParams.get('version')),
    }
    const activeNode = await page.evaluate(async (orderNo) => {
      const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
      const node = prep.listActivePickupNodes().find((candidate) => candidate.productionOrderNo === orderNo)
      return node ? { nodeId: node.nodeId, version: node.version } : null
    }, productionOrderNo)
    expect(linkedNode).toEqual(activeNode)

    await page.goto(href!)
    const pdaTask = page.locator('[data-cutting-pickup-node-id]')
    await expect(pdaTask).toBeVisible({ timeout: 60_000 })
    await expect(pdaTask).toHaveAttribute('data-cutting-pickup-node-id', linkedNode.nodeId!)
    await expect(pdaTask).toHaveAttribute('data-cutting-pickup-node-version', String(linkedNode.version))
    await expect(pdaTask).toContainText(`节点版本：V${linkedNode.version}`)
    await expect(pdaTask.locator('button[data-pda-warehouse-action="confirm-cutting-wp-pickup"]')).toContainText(
      '确认全部领料',
    )
  })
}

test('PDA 混合单位确认形成 1 Session + N Detail，重复 API 幂等', async ({ page }) => {
  await page.goto(incompletePath)
  const href = await page.getByRole('row').filter({ hasText: 'PO-202603-0101' })
    .getByRole('link', { name: '去领料', exact: true }).getAttribute('href')
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
  await page.goto(incompletePath)
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
    await page.goto(incompletePath)
    await expect(page.locator('[data-standard-list-page]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  })
}
