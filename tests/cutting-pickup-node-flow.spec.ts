import { expect, test, type Page } from '@playwright/test'

const readyPath = '/fcs/craft/cutting/pickup-management/ready'
const incompletePath = '/fcs/craft/cutting/pickup-management/incomplete'

test.setTimeout(300_000)

async function resetStores(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('productionMaterialPrepWorkflow')
    localStorage.removeItem('cuttingRuntimeEventLedger')
    localStorage.removeItem('higood.fcs.cutting.pickup-discrepancies.v1')
    localStorage.removeItem('standard-list:/fcs/craft/cutting/pickup-management/ready')
    localStorage.removeItem('standard-list:/fcs/craft/cutting/pickup-management/incomplete')
    localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'PDAU-FACTORY-ONBOARD-0034-ADMIN',
      loginId: 'onboarding_34',
      userName: '裁床仓管',
      roleId: 'ROLE_ADMIN',
      factoryId: 'FACTORY-ONBOARD-0034',
      factoryName: '定向裁演示工厂34',
      loggedAt: '2026-07-23 10:00:00',
    }))
  })
}

test.beforeEach(async ({ page }) => {
  await resetStores(page)
})

async function warmPickupExecutionModule(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await import('/src/pages/pda-warehouse-wait-process.ts')
  })
}

async function navigateWithinApp(page: Page, path: string): Promise<void> {
  await page.evaluate((targetPath) => {
    window.history.pushState({}, '', targetPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

async function chooseFirstAvailableWebReceiptLocation(page: Page): Promise<void> {
  const receipt = page.locator('[data-pickup-receipt-modal]')
  const warehouseSelect = receipt.locator('select[data-pickup-receive-field="warehouseId"]')
  const warehouseIds = await warehouseSelect.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
  )
  for (const warehouseId of warehouseIds) {
    await warehouseSelect.selectOption(warehouseId)
    const location = receipt.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').first()
    if (await location.count()) {
      await location.click()
      await expect(receipt.locator('[data-warehouse-map-selected-item]')).toHaveCount(1)
      return
    }
  }
  throw new Error('没有可用于 Web 接收验收的空闲待加工仓库位')
}

test('Web 接收核对 READY 托盘与 INCOMPLETE 库位，差异阻断并可由主管恢复', async ({ page }, testInfo) => {
  testInfo.setTimeout(300_000)
  await page.goto(readyPath)
  await page.getByRole('button', { name: '接收', exact: true }).first().click()
  let receipt = page.locator('[data-pickup-receipt-modal]')
  await expect(receipt).toBeVisible({ timeout: 60_000 })
  await expect(receipt).toContainText('待接收托盘（暂未编号）')
  await expect(receipt.locator('[data-pickup-receipt-readonly-items]')).toBeVisible()
  await expect(receipt.locator('select[data-pickup-receive-field="warehouseId"]')).toHaveValue('')
  await expect(receipt.locator('input[type="checkbox"]')).toHaveCount(0)
  await expect(receipt.locator('input[type="number"]')).toHaveCount(0)
  await receipt.getByRole('button', { name: '关闭', exact: true }).click()

  await page.goto(incompletePath)
  const sourceCard = page.locator('[data-pickup-order-card]').filter({ hasText: 'TR-A-' }).first()
  await sourceCard.getByRole('button', { name: '接收', exact: true }).first().click()
  receipt = page.locator('[data-pickup-receipt-modal]')
  await expect(receipt).toContainText('中转仓', { timeout: 60_000 })
  await receipt.locator('button[data-pickup-list-action="toggle-web-receipt-difference"]').click()
  await receipt.locator('[data-pickup-receive-field="differenceQty"]').fill('2')
  await receipt.locator('[data-pickup-receive-field="differenceNote"]').fill('实物少 2 yard')
  const differencePhotoInput = receipt.locator('[data-pickup-receive-field="differencePhoto"]')
  await differencePhotoInput.evaluate((input) => {
    const state = window as typeof window & {
      __pickupPhotoFeedbackStartedAt?: number
      __pickupPhotoFeedbackDuration?: number
    }
    input.addEventListener('change', () => {
      state.__pickupPhotoFeedbackStartedAt = performance.now()
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-pickup-receive-photo-name]')?.textContent?.includes('现场差异.jpg')) {
          state.__pickupPhotoFeedbackDuration = performance.now() - (state.__pickupPhotoFeedbackStartedAt || performance.now())
          observer.disconnect()
        }
      })
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    }, { once: true })
  })
  await differencePhotoInput.setInputFiles({
    name: '现场差异.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('prototype-photo'),
  })
  await expect(receipt).toContainText('现场差异.jpg')
  const photoFeedbackDuration = await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __pickupPhotoFeedbackDuration?: number }).__pickupPhotoFeedbackDuration || 0
  ))).toBeGreaterThan(0).then(() => page.evaluate(() => (
    (window as typeof window & { __pickupPhotoFeedbackDuration?: number }).__pickupPhotoFeedbackDuration || 0
  )))
  console.log(`Web 接收差异照片反馈耗时：${photoFeedbackDuration.toFixed(1)}ms`)
  expect(photoFeedbackDuration).toBeLessThan(200)
  await receipt.locator('button[data-pickup-list-action="report-web-receipt-difference"]').click()
  await expect(receipt).toContainText('当前节点已阻断接收')
  await expect(receipt.locator('button[data-pickup-list-action="confirm-web-receipt"]')).toBeDisabled()
  const evidence = await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('higood.fcs.cutting.pickup-discrepancies.v1') || '[]')
    return records[0]
  })
  expect(evidence).toMatchObject({
    differenceQty: 2,
    operatorName: '裁床仓管',
    photoName: '现场差异.jpg',
    note: '实物少 2 yard',
    status: '待主管处理',
  })
  expect(evidence.pickupNodeVersion).toBeGreaterThan(0)
  expect(evidence.carrierLabel).toBeTruthy()

  await receipt.getByRole('button', { name: '关闭', exact: true }).click()
  await sourceCard.getByRole('button', { name: '接收记录', exact: true }).click()
  await expect(page.getByText('接收差异与主管处理', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept('已现场复核并处理差异'))
  await page.getByRole('button', { name: '主管处理完成', exact: true }).click()
  await expect(page.getByText(/已处理：/).first()).toBeVisible()
})

for (const [label, path] of [
  ['已配齐', readyPath],
  ['未配齐', incompletePath],
] as const) {
  test(`${label}列表与 Web 接收弹窗消费同一节点 ID 和版本，并只读展示全部物料`, async ({ page }) => {
    await page.goto(path)
    const card = page.locator('[data-pickup-order-card]').filter({ has: page.getByRole('button', { name: '接收', exact: true }) }).first()
    await expect(card).toBeVisible({ timeout: 60_000 })
    const productionOrderNo = await card.getAttribute('data-production-order-no')
    expect(productionOrderNo).toBeTruthy()
    await card.getByRole('button', { name: '接收', exact: true }).first().click()
    const receipt = page.locator('[data-pickup-receipt-modal]')
    await expect(receipt).toBeVisible()
    const linkedNode = {
      nodeId: await receipt.getAttribute('data-pickup-node-id'),
      version: Number(await receipt.getAttribute('data-pickup-node-version')),
    }
    const activeNode = await page.evaluate(async (orderNo) => {
      const pickup = await import('/src/runtime/fcs/cutting/pickup-management-runtime.ts')
      const node = pickup.listActivePickupNodesRuntime().find((candidate) => candidate.productionOrderNo === orderNo)
      return node ? { nodeId: node.nodeId, version: node.version, itemCount: node.itemCount } : null
    }, productionOrderNo)
    expect(linkedNode).toEqual({ nodeId: activeNode?.nodeId, version: activeNode?.version })
    await expect(receipt.locator('[data-pickup-receipt-item]')).toHaveCount(activeNode!.itemCount)
    await expect(receipt.locator('input[type="checkbox"]')).toHaveCount(0)
    await expect(receipt.locator('input[type="number"]')).toHaveCount(0)
  })
}

test('Web 混合单位确认形成 1 Session + N Detail + N 入仓事件，跨端幂等不重复', async ({ page }) => {
  await page.goto(incompletePath)
  const card = page.locator('[data-pickup-order-card][data-production-order-no="PO-202603-0101"]')
  await expect(card).toBeVisible({ timeout: 60_000 })
  await card.getByRole('button', { name: '接收', exact: true }).first().click()
  const receipt = page.locator('[data-pickup-receipt-modal]')
  await expect(receipt).toContainText('yard')
  await expect(receipt).toContainText('粒')
  const nodeId = await receipt.getAttribute('data-pickup-node-id')
  expect(nodeId).toBeTruthy()
  await chooseFirstAvailableWebReceiptLocation(page)
  page.once('dialog', (dialog) => dialog.accept())
  await receipt.locator('button[data-pickup-list-action="confirm-web-receipt"]').click()
  await expect(receipt).toHaveCount(0)
  await expect(page).toHaveURL(incompletePath)

  const facts = await page.evaluate(async (confirmedNodeId) => {
    const prep = await import('/src/data/fcs/cutting/production-material-prep.ts')
    const pickup = await import('/src/runtime/fcs/cutting/pickup-management-runtime.ts')
    const runtime = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const projections = prep.listMaterialPrepOrderProjections()
    const session = projections.flatMap((item) => item.pickupSessions).find((item) => item.pickupNodeId === confirmedNodeId)!
    const details = projections.flatMap((item) => item.pickupRecords).filter((item) => item.pickupSessionId === session.pickupSessionId)
    const beforeEvents = runtime.listCuttingRuntimeEventsByType('中转仓接收').filter((event) =>
      (event.payload as Record<string, unknown>).pickupSessionId === session.pickupSessionId
    )
    const duplicate = pickup.confirmPickupNodeReceiptRuntime({
      pickupNodeId: session.pickupNodeId,
      pickupNodeVersion: session.pickupNodeVersion,
      receiverName: session.receiverName,
      eventSource: 'PDA',
      operatorRole: 'PDA 仓管',
      toLocationRefs: session.toLocationRefs || [],
    })
    const events = runtime.listCuttingRuntimeEventsByType('中转仓接收').filter((event) =>
      (event.payload as Record<string, unknown>).pickupSessionId === session.pickupSessionId
    )
    return {
      sessionId: session.pickupSessionId,
      duplicateId: duplicate.pickupSessionId,
      detailCount: details.length,
      snapshotCount: session.pickupNodeSnapshot?.items.length,
      beforeEventCount: beforeEvents.length,
      events: events.map((event) => ({ qty: event.inventoryEffect?.qty, unit: event.inventoryEffect?.unit, source: event.eventSource, role: event.operatorRole })),
      activeUnique: new Set(pickup.listActivePickupNodesRuntime().map((node) => node.prepOrderId)).size === pickup.listActivePickupNodesRuntime().length,
      nodeTypes: Array.from(new Set(projections.flatMap((item) => item.pickupSessions).map((item) => item.nodeType))),
    }
  }, nodeId)
  expect(facts.duplicateId).toBe(facts.sessionId)
  expect(facts.detailCount).toBe(facts.snapshotCount)
  expect(facts.events).toHaveLength(facts.beforeEventCount)
  expect(facts.events.every((event) => Number(event.qty) > 0)).toBe(true)
  expect(facts.events.every((event) => event.source === 'WEB' && event.role === 'Web 裁床仓管')).toBe(true)
  expect(new Set(facts.events.map((event) => event.unit))).toEqual(new Set(['yard', '粒']))
  expect(facts.activeUnique).toBe(true)
  expect(facts.nodeTypes).toEqual(expect.arrayContaining(['INCOMPLETE_PICKABLE', 'READY_TO_PICKUP']))
})

test('共享确认入口阻断空库位、跨仓库位和过期节点版本', async ({ page }) => {
  await page.goto(readyPath)
  const failures = await page.evaluate(async () => {
    const pickup = await import('/src/runtime/fcs/cutting/pickup-management-runtime.ts')
    const node = pickup.listActivePickupNodesRuntime()[0]
    if (!node) throw new Error('缺少待接收节点')
    const baseRef = {
      factoryId: 'ID-F004',
      warehouseId: 'FIW-ID-F004-WAIT_PROCESS-A',
      warehouseKind: 'WAIT_PROCESS' as const,
      areaId: 'AREA-A',
      areaName: 'A 区',
      shelfId: 'SHELF-A-01',
      shelfNo: 'A-01',
      locationId: 'LOC-A-01-01',
      locationNo: 'A-01-01',
    }
    const capture = (run: () => unknown): string => {
      try {
        run()
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    }
    const common = {
      pickupNodeId: node.nodeId,
      pickupNodeVersion: node.version,
      receiverName: 'Web 裁床仓管',
      eventSource: 'WEB' as const,
      operatorRole: 'Web 裁床仓管',
    }
    return {
      empty: capture(() => pickup.confirmPickupNodeReceiptRuntime({ ...common, toLocationRefs: [] })),
      crossWarehouse: capture(() => pickup.confirmPickupNodeReceiptRuntime({
        ...common,
        toLocationRefs: [
          baseRef,
          {
            ...baseRef,
            warehouseId: 'FIW-ID-F004-WAIT_PROCESS-B',
            locationId: 'LOC-B-01-01',
            locationNo: 'B-01-01',
          },
        ],
      })),
      staleVersion: capture(() => pickup.confirmPickupNodeReceiptRuntime({
        ...common,
        pickupNodeVersion: node.version + 1,
        toLocationRefs: [baseRef],
      })),
    }
  })
  expect(failures.empty).toContain('请选择裁床待加工仓库位')
  expect(failures.crossWarehouse).toContain('同一个裁床待加工仓')
  expect(failures.staleVersion).toContain('已更新')
})

test('同步失败 Session 可从 PDA 补写且不重复主明细和流水', async ({ page }) => {
  await page.goto(incompletePath)
  const seeded = await page.evaluate(async () => {
    const pickup = await import('/src/runtime/fcs/cutting/pickup-management-runtime.ts')
    const node = pickup.listActivePickupNodesRuntime()[0]
    const session = pickup.appendPickupSessionFromNodeRuntime({
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
      events: runtime.listCuttingRuntimeEventsByType('中转仓接收').filter((event) =>
        (event.payload as Record<string, unknown>).pickupSessionId === sessionId
      ).length,
    }
  }, seeded.sessionId)
  expect(after).toEqual({ status: '已回写', sessions: 1, details: seeded.detailCount, events: seeded.detailCount })
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}×${viewport.height} 页面主体无横向溢出`, async ({ page }, testInfo) => {
    testInfo.setTimeout(300_000)
    await page.setViewportSize(viewport)
    await page.goto(incompletePath)
    await expect(page.locator('[data-standard-list-page]')).toBeVisible({ timeout: 120_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  })
}
