import { expect, test } from '@playwright/test'

test.setTimeout(120_000)

async function loginPda(page: import('@playwright/test').Page, returnTo: string): Promise<void> {
  await page.goto(`/fcs/pda/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
  await page.locator('[data-pda-login-field="loginId"]').fill('F090_operator')
  await page.locator('[data-pda-login-field="password"]').fill('123456')
  await page.locator('[data-pda-login-action="submit"]').click()
  await page.waitForURL((url) => url.pathname === returnTo.split('?')[0])
  await page.reload()
}

test('领料管理列表页展示待领节点', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const list = page.locator('[data-standard-list-page]')
  await expect(list).toBeVisible()

  await expect(page.getByRole('heading', { name: '领料管理', exact: true })).toBeVisible()
  await expect(list.getByText('未配齐清单', { exact: true }).first()).toBeVisible()
  await expect(list.getByText('已配齐待领', { exact: true }).first()).toBeVisible()
  await expect(list.getByRole('columnheader', { name: /历史有效已领/ })).toBeVisible()
  await expect(list.getByRole('columnheader', { name: /领后剩余缺口/ })).toBeVisible()
  await expect(list.locator('[data-pickup-action="confirm-pickup"]').first()).toBeVisible()
})

test('领料管理详情页展示节点物料', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const detailBtn = page.locator('[data-nav*="/fcs/craft/cutting/pickup-management-detail"]').first()
  await expect(detailBtn).toBeVisible()
  await detailBtn.click()

  await expect(page.locator('text=当前节点全部物料')).toBeVisible()
  await expect(page.locator('text=物料明细')).toBeVisible()
  await expect(page.locator('text=需求数量')).toBeVisible()
  await expect(page.locator('text=本轮全部领取')).toBeVisible()
})

test('同一物料多配料批次只计算一次需求与缺口', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const summary = await page.evaluate(async () => {
    const { listActivePickupNodes } = await import('/src/data/fcs/cutting/production-material-prep.ts')
    const { summarizePickupNodeLines } = await import('/src/pages/process-factory/cutting/pickup-management.ts')
    const node = listActivePickupNodes().find((item) => item.productionOrderNo === 'PO-202603-0101')
    const line = node && summarizePickupNodeLines(node).find((item) => item.prepLineId === 'prep-line-po-0101-black')
    return line && {
      requiredQty: line.requiredQty,
      effectivePickedQty: line.effectivePickedQty,
      currentAvailableQty: line.currentAvailableQty,
      remainingShortageQty: line.remainingShortageQty,
      batchCount: line.batches.length,
    }
  })
  expect(summary).toEqual({
    requiredQty: 1386,
    effectivePickedQty: 835,
    currentAvailableQty: 165,
    remainingShortageQty: 386,
    batchCount: 2,
  })
})

test('办理领料入库后节点关闭', async ({ page }) => {
  let errorDialog = ''
  page.on('dialog', async (dialog) => {
    errorDialog = dialog.message()
    await dialog.dismiss()
  })
  await page.goto('/fcs/craft/cutting/pickup-management')

  const activeList = page.locator('[data-standard-list-page]:visible')
  const readyRow = activeList.getByRole('row').filter({ hasText: '已配齐待领' }).first()
  const confirmBtn = readyRow.locator('[data-pickup-action="confirm-pickup"]')
  const nodeCountHeading = page.getByRole('heading', { name: /^待领节点（\d+）$/ }).first()
  await expect(confirmBtn).toBeVisible()
  await page.waitForTimeout(300)
  const initialHeading = await nodeCountHeading.textContent()
  const activeNodeCount = Number(initialHeading?.match(/\d+/)?.[0] || 0)
  const pickupNodeId = await confirmBtn.getAttribute('data-pickup-node-id')
  expect(pickupNodeId).toBeTruthy()
  expect(activeNodeCount).toBeGreaterThan(0)
  await confirmBtn.click()
  expect(errorDialog).toBe('')

  await expect.poll(async () => page.evaluate(async (nodeId) => {
    const { listActivePickupNodes } = await import('/src/data/fcs/cutting/production-material-prep.ts')
    return listActivePickupNodes().some((node) => node.nodeId === nodeId)
  }, pickupNodeId)).toBe(false)
  await expect(activeList).toBeVisible()
  await expect(nodeCountHeading).toHaveText(`待领节点（${activeNodeCount - 1}）`)
})

test('领料管理分页控件可见', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const pagination = page.locator('[data-pickup-region="pagination"]')
  await expect(pagination.getByText(/共 \d+ 条/)).toBeVisible()
  await expect(pagination.locator('select')).toBeVisible()
})

test('领料管理排序、每页条数和列冻结均局部生效并持久化', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/pickup-management')

  const sortButton = page.locator('[data-pickup-list-action="sort-column"][data-column-key="productionOrder"]')
  await expect(sortButton).toHaveAttribute('data-skip-page-rerender', 'true')
  await sortButton.click()
  await expect(page.locator('th[data-column-key="productionOrder"]')).toHaveAttribute('aria-sort', 'ascending')
  await sortButton.click()
  await expect(page.locator('th[data-column-key="productionOrder"]')).toHaveAttribute('aria-sort', 'descending')
  await sortButton.click()
  await expect(page.locator('th[data-column-key="productionOrder"]')).toHaveAttribute('aria-sort', 'none')

  await page.locator('[data-pickup-list-field="pageSize"]').selectOption('20')

  await page.locator('[data-pickup-list-action="open-column-settings"]').click()
  const productionOrderSetting = page.locator('[data-pickup-list-column-key="productionOrder"]').filter({ hasText: '生产单' })
  const freezeToggle = productionOrderSetting.locator('[data-pickup-list-action="toggle-column-freeze"]')
  await freezeToggle.check()
  await expect(freezeToggle).toBeChecked()
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    window.localStorage.getItem('standard-list:/fcs/craft/cutting/pickup-management') || '{}',
  ).frozenKeys || [])).toContain('productionOrder')

  const storedPreference = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('standard-list:/fcs/craft/cutting/pickup-management') || '{}',
  ))
  expect(storedPreference.pageSize).toBe(20)
  expect(storedPreference.frozenKeys).toContain('productionOrder')

  const materialsSetting = page.locator('[data-pickup-list-column-key="materials"]').filter({ hasText: '当前节点全部物料' })
  await materialsSetting.dragTo(productionOrderSetting)
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    window.localStorage.getItem('standard-list:/fcs/craft/cutting/pickup-management') || '{}',
  ).order || [])).toEqual(expect.arrayContaining(['materials', 'productionOrder']))
  const reorderedPreference = await page.evaluate(() => JSON.parse(
    window.localStorage.getItem('standard-list:/fcs/craft/cutting/pickup-management') || '{}',
  ))
  expect(reorderedPreference.order.indexOf('materials')).toBeLessThan(reorderedPreference.order.indexOf('productionOrder'))

  await page.reload()
  await expect(page.locator('[data-pickup-list-field="pageSize"]')).toHaveValue('20')
  await page.locator('[data-pickup-list-action="open-column-settings"]').click()
  await expect(
    page.locator('[data-pickup-list-column-key="productionOrder"] [data-pickup-list-action="toggle-column-freeze"]'),
  ).toBeChecked()
})

test('PDA 中转仓领料展示节点列表', async ({ page }) => {
  const target = '/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup'
  await loginPda(page, target)

  const pickupCard = page.getByRole('button', { name: /PO-202603-/ }).first()
  await expect(pickupCard).toBeVisible({ timeout: 30_000 })
  await expect(pickupCard).toContainText(/未配齐清单|已配齐待领/)
})

test('PDA 完成节点领料后按物料与单位分别写入流水', async ({ page }) => {
  const target = '/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup'
  await loginPda(page, target)

  const pickupButton = page.getByRole('button', { name: /PO-202603-0007/ }).first()
  await expect(pickupButton).toBeVisible({ timeout: 30_000 })
  const selectedNode = await pickupButton.getAttribute('data-pickup-node-id')
  const expectedItems = await page.evaluate(async (nodeId) => {
    const { listActivePickupNodes } = await import('/src/data/fcs/cutting/production-material-prep.ts')
    return listActivePickupNodes().find((node) => node.nodeId === nodeId)?.items.map((item) => ({
      materialSku: item.materialSku,
      unit: item.unit,
      qty: item.currentAvailableQty,
    })) || []
  }, selectedNode)
  await pickupButton.click()
  const confirmButton = page.getByRole('button', { name: '确认全部领料' })
  await expect(confirmButton).toBeVisible()
  await confirmButton.click()

  const events = await page.evaluate(async () => {
    const { listCuttingRuntimeEvents } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    return listCuttingRuntimeEvents()
      .filter((item) => item.eventType === '中转仓领料')
      .map((item) => ({
        pickupNodeId: (item.payload as Record<string, unknown>).pickupNodeId,
        pickupRecordId: item.refs.pickupRecordId,
        materialSku: item.material?.materialSku,
        unit: item.inventoryEffect?.unit,
        qty: item.inventoryEffect?.qty,
      }))
  })
  const nodeEvents = events.filter((event) => event.pickupNodeId === selectedNode)
  expect(nodeEvents).toHaveLength(expectedItems.length)
  expect(nodeEvents.every((event) => Boolean(event.pickupRecordId))).toBe(true)
  expect(nodeEvents.map(({ materialSku, unit, qty }) => ({ materialSku, unit, qty })))
    .toEqual(expect.arrayContaining(expectedItems))
  expect(expectedItems.filter((item) => item.unit === '套')).toHaveLength(2)
  expect(nodeEvents.filter((event) => event.unit === '套')).toHaveLength(2)
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]) {
  test(`${viewport.width}×${viewport.height} 下页面主体无横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/fcs/craft/cutting/pickup-management')

    const listPage = page.locator('[data-standard-list-page]')
    await expect(listPage).toBeVisible()
    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      listRight: document.querySelector('[data-standard-list-page]')?.getBoundingClientRect().right ?? 0,
    }))
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth)
    expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth)
    expect(overflow.listRight).toBeLessThanOrEqual(overflow.viewportWidth)
  })
}
