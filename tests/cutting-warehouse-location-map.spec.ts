import { expect, test, type Locator, type Page } from '@playwright/test'

const WAIT_PROCESS_PATH = '/fcs/craft/cutting/warehouse-management/wait-process'
const WAIT_HANDOVER_PATH = '/fcs/craft/cutting/warehouse-management/wait-handover'
const PDA_CUTTING_TASK_ID = 'TASK-CUT-PDA-NO-PICKUP-0301'

test.setTimeout(600_000)

async function resetWarehouseMapStores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('warehouse-map-e2e-initialized') === '1') return
    Object.keys(localStorage)
      .filter((key) => key.startsWith('higood:cutting-warehouse-layout:'))
      .forEach((key) => localStorage.removeItem(key))
    localStorage.removeItem('productionMaterialPrepWorkflow')
    localStorage.removeItem('cuttingRuntimeEventLedger')
    localStorage.setItem('fcs_pda_session', JSON.stringify({
      userId: 'F090_operator',
      loginId: 'F090_operator',
      userName: '裁床仓管',
      roleId: 'ROLE_OPERATOR',
      factoryId: 'FACTORY-ONBOARD-0035',
      factoryName: '定位裁演示工厂35',
      loggedAt: '2026-07-30 10:00:00',
    }))
    sessionStorage.setItem('warehouse-map-e2e-initialized', '1')
  })
}

async function openWarehouseMap(page: Page, path: string): Promise<void> {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}tab=locations`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-warehouse-map-root]').first()).toBeVisible({ timeout: 300_000 })
}

async function openStandaloneShelfMaintenanceDialog(page: Page): Promise<void> {
  await page.goto('/src/pages/process-factory/cutting/warehouse-location-map.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    Object.keys(localStorage).filter((key) => key.startsWith('higood:cutting-warehouse-layout:')).forEach((key) => localStorage.removeItem(key))
    document.body.innerHTML = '<section data-cutting-warehouse-map-section data-warehouse-kind="WAIT_PROCESS"></section>'
    const module = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const current = module.buildCurrentCuttingWarehouseMapProjection('WAIT_PROCESS')
    if (!current) throw new Error('无法建立独立库位图维护上下文')
    module.openCuttingWarehouseLocationMapModal('WAIT_PROCESS', { type: 'create-shelf', areaId: current.snapshot.areaList[0].areaId })
  })
}

async function openStandaloneAreaMaintenanceDialog(page: Page): Promise<string> {
  await page.goto('/src/pages/process-factory/cutting/warehouse-location-map.ts', { waitUntil: 'domcontentloaded' })
  return page.evaluate(async () => {
    Object.keys(localStorage).filter((key) => key.startsWith('higood:cutting-warehouse-layout:')).forEach((key) => localStorage.removeItem(key))
    document.body.innerHTML = '<section data-cutting-warehouse-map-section data-warehouse-kind="WAIT_PROCESS"></section>'
    const module = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const current = module.buildCurrentCuttingWarehouseMapProjection('WAIT_PROCESS')
    if (!current) throw new Error('无法建立独立库位图维护上下文')
    module.openCuttingWarehouseLocationMapModal('WAIT_PROCESS', { type: 'create-area' })
    return current.snapshot.areaList[0].areaName
  })
}

async function openControlledPdaInbound(page: Page, taskId: string): Promise<void> {
  await page.goto('/src/pages/pda-cutting-inbound.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async ({ taskId }) => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const user = pda.listFactoryPdaUsers('FACTORY-ONBOARD-0035')[0] || await pda.createFactoryPdaUser({
      factoryId: 'FACTORY-ONBOARD-0035', name: '裁床仓管', loginId: 'location_e2e_operator', password: '123456', roleId: 'ROLE_OPERATOR',
    })
    pda.setPdaSession(pda.createPdaSessionFromUser(user))
    window.history.replaceState({}, '', `/fcs/pda/cutting/inbound/${taskId}?action=inbound-location`)
    const module = await import('/src/pages/pda-cutting-inbound.ts')
    const bagging = module.createPdaCuttingInboundFormState()
    bagging.carrierCode = 'BAG-E2E-MULTI'
    bagging.scannedTicketNos = ['FT-CUT-260307-102-01-001']
    bagging.inboundQty = '10'
    module.appendPdaCuttingInboundRuntimeEvent(bagging, 'bagging')
    const ledger = module.createPdaCuttingInboundMockLedger()
    ledger.bags[bagging.carrierCode] = {
      bagCode: bagging.carrierCode,
      status: 'BAGGED_WAIT_INBOUND',
      ticketNos: [...bagging.scannedTicketNos],
      productionOrderNo: 'PO-E2E-MULTI',
      locationLabel: '',
    }
    window.__higoodPdaCuttingInboundMockLedger = ledger
    const inbound = module.createPdaCuttingInboundFormState()
    inbound.carrierCode = bagging.carrierCode
    document.body.innerHTML = module.renderPdaCuttingInboundWorkflow('inbound-location', inbound, taskId)
    const dispatch = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target) module.handlePdaCuttingInboundEvent(target, event)
    }
    document.body.addEventListener('click', dispatch)
    document.body.addEventListener('input', dispatch)
    document.body.addEventListener('keydown', dispatch)
  }, { taskId })
}

async function openControlledPdaPickup(page: Page): Promise<void> {
  await page.goto('/src/pages/pda-warehouse-wait-process.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const user = pda.listFactoryPdaUsers('FACTORY-ONBOARD-0035')[0] || await pda.createFactoryPdaUser({
      factoryId: 'FACTORY-ONBOARD-0035', name: '裁床仓管', loginId: 'location_e2e_operator', password: '123456', roleId: 'ROLE_OPERATOR',
    })
    pda.setPdaSession(pda.createPdaSessionFromUser(user))
    const runtime = await import('/src/runtime/fcs/cutting/pickup-management-runtime.ts')
    const node = runtime.listActivePickupNodesRuntime()[0]
    if (!node) throw new Error('缺少受控领料节点')
    window.history.replaceState({}, '', `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(node.nodeId)}&version=${node.version}`)
    const module = await import('/src/pages/pda-warehouse-wait-process.ts')
    document.body.innerHTML = module.renderPdaWarehouseWaitProcessPage()
    document.body.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target) module.handlePdaWarehouseWaitProcessEvent(target)
    })
  })
}

async function openControlledPdaSpecialCraftReturn(page: Page, taskId: string): Promise<void> {
  await page.goto('/src/pages/pda-cutting-handover.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async ({ taskId }) => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const user = pda.listFactoryPdaUsers('FACTORY-ONBOARD-0035')[0] || await pda.createFactoryPdaUser({
      factoryId: 'FACTORY-ONBOARD-0035', name: '裁床仓管', loginId: 'location_e2e_operator', password: '123456', roleId: 'ROLE_OPERATOR',
    })
    pda.setPdaSession(pda.createPdaSessionFromUser(user))
    window.history.replaceState({}, '', `/fcs/pda/cutting/handover/${taskId}?action=special-craft-return`)
    const module = await import('/src/pages/pda-cutting-handover.ts')
    document.body.innerHTML = module.renderPdaCuttingHandoverPage(taskId)
    const dispatch = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target) module.handlePdaCuttingHandoverEvent(target, event)
    }
    document.body.addEventListener('click', dispatch)
    document.body.addEventListener('input', dispatch)
    document.body.addEventListener('keydown', dispatch)
  }, { taskId })
}

async function openControlledPdaIssueWithMultipleBatches(page: Page): Promise<void> {
  await page.goto('/src/pages/pda-warehouse-wait-process.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const user = pda.listFactoryPdaUsers('FACTORY-ONBOARD-0035')[0] || await pda.createFactoryPdaUser({
      factoryId: 'FACTORY-ONBOARD-0035', name: '裁床仓管', loginId: 'location_e2e_operator', password: '123456', roleId: 'ROLE_OPERATOR',
    })
    pda.setPdaSession(pda.createPdaSessionFromUser(user))
    const ledger = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const material = await import('/src/data/fcs/cutting/material-ledger.ts')
    const warehouse = await import('/src/pages/pda-warehouse-shared.ts')
    const layout = await import('/src/pages/process-factory/cutting/warehouse-location-layout-store.ts')
    const model = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
    const row = material.listMaterialLedgerProjections().find((item) => item.availableQty > 0)
      || material.listMaterialLedgerProjections().find((item) => item.cutOrderNo && item.materialIdentity.materialSku)
    const currentWarehouse = warehouse.getCurrentFactoryWarehouseByKind('WAIT_PROCESS')
    if (!row || !currentWarehouse) throw new Error('缺少多批次受控源数据')
    const refs = model.listStableWarehouseLocationRefs(
      currentWarehouse,
      layout.loadWarehouseLayoutSnapshot(currentWarehouse).snapshot,
    ).slice(0, 2)
    if (refs.length < 2) throw new Error('缺少多批次受控库位')
    refs.forEach((ref, index) => ledger.appendCuttingRuntimeEvent({
      eventType: '中转仓领料', operatorName: '浏览器验收仓管', occurredAt: `2026-08-02 10:0${index}`,
      refs: { cutOrderNo: row.cutOrderNo, productionOrderNo: row.productionOrderNo, handoverRecordId: `E2E-BATCH-${index + 1}:LINE` },
      material: { materialSku: row.materialIdentity.materialSku, materialName: row.materialIdentity.materialName, materialColor: row.materialIdentity.materialColor },
      inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 10 + index, unit: 'yard', rollCount: 1, toWarehouseArea: ref.areaName, toLocationCode: ref.locationNo },
      payload: { pickupSessionId: `E2E-BATCH-${index + 1}`, prepLineId: `E2E-BATCH-${index + 1}:LINE`, pickupQty: 10 + index, rollCount: 1, warehouseLocations: [ref], storageFootprint: model.buildWarehouseStorageFootprint([ref], [{ unit: 'yard', qty: 10 + index }]) },
    }))
    window.history.replaceState({}, '', '/fcs/pda/warehouse/wait-process?scope=cutting&action=issue')
    const module = await import('/src/pages/pda-warehouse-wait-process.ts')
    document.body.innerHTML = module.renderPdaWarehouseWaitProcessPage()
    document.body.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && module.handlePdaWarehouseWaitProcessEvent(target)) {
        document.body.innerHTML = module.renderPdaWarehouseWaitProcessPage()
      }
    })
  })
}

async function clickAndAcceptDialog(page: Page, selector: string): Promise<void> {
  const dialogPromise = page.waitForEvent('dialog')
  await page.locator(selector).evaluate((button) => {
    window.setTimeout(() => (button as HTMLButtonElement).click(), 0)
  })
  await (await dialogPromise).accept()
}

async function expectImageOrPlaceholder(scope: Locator, alt: string, placeholder: string): Promise<void> {
  const image = scope.getByAltText(alt)
  if (await image.count()) {
    await expect(image).toBeVisible()
    const loaded = await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)
    if (loaded) return
  }
  await expect(scope).toContainText(placeholder)
}

async function expectLoadedImage(scope: Locator, alt: string): Promise<void> {
  const image = scope.getByAltText(alt)
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
}

test.beforeEach(async ({ page }) => {
  await resetWarehouseMapStores(page)
})

for (const path of [WAIT_PROCESS_PATH, WAIT_HANDOVER_PATH]) {
  const warehouseName = path === WAIT_PROCESS_PATH ? '待加工仓' : '待交出仓'
  test(`PFOS ${warehouseName}通过单一入口维护空库区和分层货架`, async ({ page }) => {
    await openWarehouseMap(page, path)
    const root = page.locator('[data-warehouse-map-root]')
    await expect(root).toContainText('空闲')
    await expect(root).toContainText('占用')
    await expect(page.getByRole('button', { name: '维护库位图', exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: '新增库区', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增库位', exact: true })).toHaveCount(0)
    const elapsed = await page.evaluate(async () => {
      const button = document.querySelector<HTMLButtonElement>('[data-warehouse-map-action="enter-maintenance"]')
      if (!button) throw new Error('缺少维护入口')
      const startedAt = performance.now()
      button.click()
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('维护模式未及时打开')), 1_000)
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-warehouse-map-action="open-create-area"]')) return
          window.clearTimeout(timeout)
          observer.disconnect()
          resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })
      return performance.now() - startedAt
    })
    expect(elapsed).toBeLessThan(200)
    await page.locator('[data-warehouse-map-action="open-create-area"]').click()
    let modal = page.locator('[data-cutting-warehouse-modal]')
    await modal.locator('[name="areaCode"]').fill('Z')
    await modal.locator('[name="areaName"]').fill(`浏览器${warehouseName}扩展区`)
    await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
    await expect(modal).toHaveCount(0)
    expect(await page.evaluate(() => Object.values(localStorage).join('\n'))).toContain(`浏览器${warehouseName}扩展区`)
    await expect(root).toContainText(`浏览器${warehouseName}扩展区`)
    await expect(root).toContainText('暂无货架')

    await root.locator('[data-warehouse-map-action="open-create-shelf"]').last().click()
    modal = page.locator('[data-cutting-warehouse-modal]')
    await modal.locator('[name="shelfSequence"]').fill('9')
    await modal.locator('[name="levelCount"]').fill('2')
    await modal.locator('[name="defaultPositionCount"]').fill('2')
    await expect(modal.locator('[data-location-number-preview]')).toContainText('Z-R09-L02-P02')
    await modal.locator('[name="positionCount-2"]').fill('3')
    await expect(modal.locator('[data-location-number-preview]')).toContainText('Z-R09-L02-P03')
    await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
    await expect(modal).toHaveCount(0)
    await expect(root).toContainText('Z-R09-L02-P03')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-warehouse-map-root]')).toContainText('Z-R09-L02-P03', { timeout: 120_000 })
  })
}

test('维护表单冲突和占用保护保留输入并显示受影响编号', async ({ page }) => {
  await openWarehouseMap(page, `${WAIT_PROCESS_PATH}?demo=1`)
  await page.locator('[data-warehouse-map-action="enter-maintenance"]').click()
  await page.locator('[data-warehouse-map-action="open-create-shelf"]').first().click()
  let modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="shelfSequence"]').fill('3')
  await modal.locator('[name="levelCount"]').fill('2')
  await modal.locator('[name="positionCount-2"]').fill('0')
  await expect(modal.locator('[data-maintenance-preview-error]')).toContainText('第 2 层位置数必须是有限正整数')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(modal.locator('[role="alert"]')).toContainText('第 2 层位置数必须是有限正整数')
  await expect(modal.locator('[name="positionCount-2"]')).toHaveValue('0')
  await modal.locator('[name="levelCount"]').fill('1')
  await modal.locator('[name="shelfSequence"]').fill('1')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(modal.locator('[role="alert"]')).toContainText('货架序号 1 已存在')
  await expect(modal.locator('[name="shelfSequence"]')).toHaveValue('1')
  await modal.locator('[data-warehouse-map-action="close-maintenance-dialog"]').last().click()

  await page.locator('[data-warehouse-map-action="rename-area"]').first().click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await expect(modal.locator('[data-location-number-preview]')).toContainText('→')
  await expect(modal.locator('[name="areaCode"]')).toBeDisabled()
  await expect(modal.locator('[name="enabled"]')).toBeDisabled()
  await expect(modal).toContainText('占用库位')
  await expect(modal).toContainText(/A-R\d+-L\d+-P\d+/)
})

test('大规模分层维护分页可达并及时反馈预览与保存', async ({ page }) => {
  await openStandaloneShelfMaintenanceDialog(page)
  const modal = page.locator('[data-cutting-warehouse-modal]')
  await expect(modal.getByRole('dialog')).toBeVisible()
  await expect(modal.locator('form[data-cutting-warehouse-maintenance-form]')).toBeVisible()
  await modal.locator('[name="shelfSequence"]').fill('100')
  await modal.locator('[name="levelCount"]').fill('45')
  await modal.locator('[name="defaultPositionCount"]').fill('2')
  await expect(modal.locator('[data-level-position-editor]')).toContainText('共 45 层')
  expect(await modal.locator('[data-level-position-editor] input').count()).toBeLessThanOrEqual(20)
  await modal.locator('[data-level-editor-page="next"]').click()
  await expect(modal.locator('[name="positionCount-21"]')).toBeVisible()
  await modal.locator('[data-level-editor-page="last"]').click()
  await expect(modal.locator('[name="positionCount-45"]')).toBeVisible()
  await expect(modal.locator('[data-location-number-preview]')).toContainText('共 90 个完整编号')
  await modal.locator('[data-location-preview-page="last"]').click()
  await expect(modal.locator('[data-location-number-preview]')).toContainText(/-L45-P02/)
  expect(await modal.locator('[data-location-preview-row]').count()).toBeLessThanOrEqual(40)
  await expect(modal.locator('[data-maintenance-dialog-body]')).toHaveClass(/overflow-y-auto/)
  await expect(modal.locator('[data-warehouse-map-action="submit-maintenance"]')).toBeVisible()

  const previewElapsed = await modal.locator('[name="positionCount-45"]').evaluate(async (input) => {
    const preview = document.querySelector('[data-location-number-preview]')
    if (!preview) throw new Error('缺少完整编号预览')
    const startedAt = performance.now()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('实时预览未及时反馈')), 1_000)
      const observer = new MutationObserver(() => {
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve()
      })
      observer.observe(preview.parentElement || document.body, { childList: true, subtree: true })
      ;(input as HTMLInputElement).value = '3'
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    })
    return performance.now() - startedAt
  })
  expect(previewElapsed).toBeLessThan(200)
  await expect(modal.locator('[data-location-number-preview]')).toContainText('共 91 个完整编号')

  const saveFeedbackElapsed = await modal.locator('[data-warehouse-map-action="submit-maintenance"]').evaluate(async (button) => {
    const startedAt = performance.now()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('保存未及时显示处理中反馈')), 1_000)
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-maintenance-saving]')) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })
      ;(button as HTMLButtonElement).click()
    })
    return performance.now() - startedAt
  })
  expect(saveFeedbackElapsed).toBeLessThan(200)
  await expect(modal).toHaveCount(0)
  const persisted = await page.evaluate(() => {
    const layoutEntry = Object.entries(localStorage).find(([key]) => key.includes('warehouse-layout:v3'))
    const historyEntry = Object.entries(localStorage).find(([key]) => key.includes('warehouse-layout-history:v3'))
    return {
      raw: Object.values(localStorage).join('\n'),
      layoutVersion: layoutEntry ? JSON.parse(layoutEntry[1]).layoutVersion : -1,
      historyCount: historyEntry ? JSON.parse(historyEntry[1]).length : -1,
    }
  })
  expect(persisted.raw).toContain('-R100-L45-P03')
  expect(persisted.layoutVersion).toBe(1)
  expect(persisted.historyCount).toBe(1)
})

test('同仓名称重复与设备配额不足均保留维护输入', async ({ page }) => {
  const existingAreaName = await openStandaloneAreaMaintenanceDialog(page)
  const modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="areaCode"]').fill('Z')
  await modal.locator('[name="areaName"]').fill(`  ${existingAreaName}  `)
  await modal.locator('[name="areaName"]').press('Enter')
  await expect(modal.locator('[data-maintenance-error]')).toContainText(`库区名称 ${existingAreaName} 已存在`)
  await expect(modal.locator('[name="areaName"]')).toHaveValue(`  ${existingAreaName}  `)
  await modal.locator('[data-warehouse-map-action="close-maintenance-dialog"]').last().click()
  await page.evaluate(async () => {
    const module = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    module.openCuttingWarehouseLocationMapModal('WAIT_PROCESS', { type: 'create-area' })
  })
  await modal.locator('[name="areaCode"]').fill('Z')
  await modal.locator('[name="areaName"]').fill('设备容量保护区')
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem
    ;(window as typeof window & { __restoreStorageSetItem?: () => void }).__restoreStorageSetItem = () => { Storage.prototype.setItem = originalSetItem }
    Storage.prototype.setItem = () => { throw new DOMException('quota exceeded', 'QuotaExceededError') }
  })
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(modal.locator('[data-maintenance-error]')).toContainText('当前设备可用资源不足，建议拆分货架/减少单次生成')
  await expect(modal.locator('[name="areaName"]')).toHaveValue('设备容量保护区')
  await page.evaluate(() => (window as typeof window & { __restoreStorageSetItem?: () => void }).__restoreStorageSetItem?.())
})

test('分批生成取消后不写版本历史且旧任务不影响新弹窗', async ({ page }) => {
  await openStandaloneShelfMaintenanceDialog(page)
  await page.evaluate(async () => {
    const module = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    module.configureCuttingWarehouseMaintenanceRuntimeForTest({
      yieldDelayMs: 25,
      resourceEstimate: { storageAvailableBytes: 1_000_000_000, heapAvailableBytes: 1_000_000_000 },
    })
  })
  let modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="shelfSequence"]').fill('100')
  await modal.locator('[name="levelCount"]').fill('20')
  await modal.locator('[name="defaultPositionCount"]').fill('100')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(modal.locator('[data-maintenance-saving]')).toContainText('正在生成并保存')
  await expect(modal.locator('[data-warehouse-map-action="close-maintenance-dialog"]').last()).toContainText('取消生成')
  await modal.locator('[data-warehouse-map-action="close-maintenance-dialog"]').last().click()
  await expect(modal).toHaveCount(0)
  await page.evaluate(async () => {
    const module = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    module.openCuttingWarehouseLocationMapModal('WAIT_PROCESS', { type: 'create-area' })
  })
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="areaName"]').fill('新弹窗隔离区')
  await page.waitForTimeout(300)
  await expect(modal).toBeVisible()
  await expect(modal.locator('[name="areaName"]')).toHaveValue('新弹窗隔离区')
  await expect(modal.locator('[data-maintenance-error]')).toHaveText('')
  const persisted = await page.evaluate(() => {
    const layout = Object.entries(localStorage).find(([key]) => key.includes('warehouse-layout:v3'))
    const history = Object.entries(localStorage).find(([key]) => key.includes('warehouse-layout-history:v3'))
    return { version: layout ? JSON.parse(layout[1]).layoutVersion : -1, historyCount: history ? JSON.parse(history[1]).length : 0 }
  })
  expect(persisted).toEqual({ version: 0, historyCount: 0 })
})

test('动态资源预算不足时不按固定数量保存并保留输入', async ({ page }) => {
  await openStandaloneShelfMaintenanceDialog(page)
  await page.evaluate(async () => {
    const module = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    module.configureCuttingWarehouseMaintenanceRuntimeForTest({
      resourceEstimate: { storageAvailableBytes: 256, heapAvailableBytes: 512 },
    })
  })
  const modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="shelfSequence"]').fill('100')
  await modal.locator('[name="levelCount"]').fill('2')
  await modal.locator('[name="defaultPositionCount"]').fill('2')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(modal.locator('[data-maintenance-error]')).toContainText('当前设备可用资源不足，建议拆分货架/减少单次生成')
  await expect(modal.locator('[name="shelfSequence"]')).toHaveValue('100')
  const version = await page.evaluate(() => {
    const layout = Object.entries(localStorage).find(([key]) => key.includes('warehouse-layout:v3'))
    return layout ? JSON.parse(layout[1]).layoutVersion : -1
  })
  expect(version).toBe(0)
})

test('共享库位图大投影视窗末层末位置可达且保留选择与占用详情', async ({ page }) => {
  await page.goto('/src/components/ui/warehouse-location-map.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const module = await import('/src/components/ui/warehouse-location-map.ts')
    const levels = Array.from({ length: 100 }, (_, levelIndex) => ({
      levelNo: 100 - levelIndex,
      locations: Array.from({ length: 100 }, (_, positionIndex) => {
        const levelNo = 100 - levelIndex
        const positionNo = positionIndex + 1
        const locationId = `LOC-L${levelNo}-P${positionNo}`
        const occupied = levelNo === 1 && positionNo === 100
        return {
          factoryId: 'F090', warehouseId: 'WH-TEST', warehouseKind: 'WAIT_PROCESS', areaId: 'AREA-TEST', areaCode: 'Z', areaName: '大投影区',
          shelfId: 'SHELF-R100', shelfSequence: 100, shelfNo: 'R100', locationId, locationNo: `Z-R100-L${String(levelNo).padStart(2, '0')}-P${String(positionNo).padStart(2, '0')}`,
          locationName: locationId, levelNo, positionNo, areaStatus: 'AVAILABLE', shelfStatus: 'AVAILABLE', status: 'AVAILABLE', orderIndex: positionNo,
          businessStatus: occupied ? 'OCCUPIED' : 'EMPTY', occupancies: occupied ? [{ occupancyId: 'OCC-END', footprintId: 'FP-END', locationId, productionOrderNo: 'PO-END', objectNo: 'MAT-END', objectName: '末位物料', qty: 1, unit: '卷', inboundAt: '2026-08-01 10:00', inboundBy: '仓管' }] : [],
        }
      }),
    }))
    const projection = { factoryId: 'F090', warehouseId: 'WH-TEST', warehouseKind: 'WAIT_PROCESS', warehouseName: '大投影仓', totalLocationCount: 10000, emptyLocationCount: 9999, occupiedLocationCount: 1, areas: [{ areaId: 'AREA-TEST', areaName: '大投影区', shelves: [{ areaId: 'AREA-TEST', areaName: '大投影区', shelfId: 'SHELF-R100', shelfNo: 'R100', levels }] }], unlocatedOccupancies: [] }
    document.body.innerHTML = module.renderWarehouseLocationMap({ projection, mode: 'SELECT', factoryName: '测试工厂', selectedLocationIds: ['LOC-L100-P1'] })
    document.body.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target) module.handleWarehouseLocationMapOccupancyEvent(target, projection)
    })
    ;(window as typeof window & { __largeProjection?: unknown }).__largeProjection = projection
  })
  const root = page.locator('[data-warehouse-map-root]')
  expect(await root.locator('[data-warehouse-map-shelf-viewport] [data-location-id]').count()).toBeLessThanOrEqual(96)
  await expect(root).toContainText('Z-R100-L100-P01')
  const firstViewportCodes = await root.locator('[data-warehouse-map-shelf-viewport] [data-location-no]').evaluateAll((nodes) =>
    nodes.slice(0, 16).map((node) => (node as HTMLElement).dataset.locationNo || ''))
  expect(firstViewportCodes.slice(0, 12)).toEqual(Array.from({ length: 12 }, (_, index) => `Z-R100-L100-P${String(index + 1).padStart(2, '0')}`))
  expect(firstViewportCodes.slice(12, 16)).toEqual(Array.from({ length: 4 }, (_, index) => `Z-R100-L99-P${String(index + 1).padStart(2, '0')}`))
  await root.locator('[data-warehouse-map-action="viewport-level-page"][data-page-action="last"]').click()
  await root.locator('[data-warehouse-map-action="viewport-position-page"][data-page-action="last"]').click()
  await expect(root).toContainText('Z-R100-L01-P100')
  expect(await root.locator('[data-warehouse-map-shelf-viewport] [data-location-id]').count()).toBeLessThanOrEqual(96)
  await expect(root.locator('[data-warehouse-map-selected-item]')).toContainText('Z-R100-L100-P01')
  const viewportIdentity = await root.locator('[data-warehouse-map-shelf-viewport]').evaluate((node) => {
    ;(window as typeof window & { __viewportBefore?: Element }).__viewportBefore = node
    return true
  })
  expect(viewportIdentity).toBe(true)
  await root.locator('[data-location-id="LOC-L1-P100"]').click()
  await expect(root.locator('[data-warehouse-map-occupancy-drawer]')).toContainText('PO-END')
  expect(await page.evaluate(() => (window as typeof window & { __viewportBefore?: Element }).__viewportBefore?.isConnected)).toBe(true)
})

test('非占用三类维护保存编号和状态并保持滚动与页面外壳', async ({ page }) => {
  await openWarehouseMap(page, WAIT_PROCESS_PATH)
  const finishMaintenance = page.locator('[data-warehouse-map-action="finish-maintenance"]')
  if (await finishMaintenance.count()) await finishMaintenance.click()
  const maintenanceEntry = page.locator('[data-warehouse-map-action="enter-maintenance"]')
  await expect(maintenanceEntry).toBeVisible()
  await maintenanceEntry.click()
  await expect(page.locator('[data-warehouse-map-action="finish-maintenance"]')).toBeVisible()
  await expect(page.locator('[data-warehouse-map-action="open-create-area"]')).toBeVisible()
  await page.locator('[data-warehouse-map-action="open-create-area"]').click()
  let modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="areaCode"]').fill('Z')
  await modal.locator('[name="areaName"]').fill('局部刷新验证区')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  const root = page.locator('[data-warehouse-map-root]')
  await root.locator('[data-warehouse-map-action="open-create-shelf"]').last().click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="shelfSequence"]').fill('100')
  await modal.locator('[name="levelCount"]').fill('1')
  await modal.locator('[name="defaultPositionCount"]').fill('2')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(root).toContainText('Z-R100-L01-P02')

  await page.evaluate(() => {
    const tracked = window as typeof window & { __task6Section?: Element; __task6Shell?: Element }
    tracked.__task6Section = document.querySelector('[data-cutting-warehouse-map-section]') || undefined
    tracked.__task6Shell = document.body.firstElementChild || undefined
    document.body.style.minHeight = '2400px'
    window.scrollTo(0, 600)
  })
  await root.locator('[data-warehouse-map-action="rename-area"]').last().click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="areaCode"]').fill('Y')
  await modal.locator('[name="enabled"]').selectOption('false')
  await expect(modal.locator('[data-location-number-preview]')).toContainText('启用 → 停用')
  const beforeScroll = await page.evaluate(() => window.scrollY)
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(root).toContainText('Y-R100-L01-P02')
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeScroll)
  expect(await page.evaluate(() => {
    const tracked = window as typeof window & { __task6Section?: Element; __task6Shell?: Element }
    return tracked.__task6Section === document.querySelector('[data-cutting-warehouse-map-section]')
      && tracked.__task6Shell === document.body.firstElementChild
  })).toBe(true)

  await root.locator('[data-warehouse-map-action="rename-shelf"]').last().click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="shelfSequence"]').fill('101')
  await modal.locator('[name="enabled"]').selectOption('false')
  await expect(modal.locator('[data-location-number-preview]')).toContainText('启用 → 停用')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(root).toContainText('Y-R101-L01-P02')

  await root.locator('[data-warehouse-map-action="rename-location"]').last().click()
  modal = page.locator('[data-cutting-warehouse-modal]')
  await modal.locator('[name="levelNo"]').fill('2')
  await modal.locator('[name="positionNo"]').fill('1')
  await modal.locator('[name="enabled"]').selectOption('false')
  await expect(modal.locator('[data-location-number-preview]')).toContainText('Y-R101-L02-P01')
  await expect(modal.locator('[data-location-number-preview]')).toContainText('启用 → 停用')
  await modal.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(root).toContainText('Y-R101-L02-P01')
  const history = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.includes('warehouse-layout-history:v3'))?.[1] || '')
  expect(history).toContain('"status":"STOPPED"')
})

test('两张库位图占用详情分别展示物料卷和袋内菲票', async ({ page }) => {
  await openWarehouseMap(page, `${WAIT_PROCESS_PATH}?demo=1`)
  await page.locator('[data-warehouse-map-root]').evaluate((root) => {
    ;(window as typeof window & { __occupancyMapRoot?: Element }).__occupancyMapRoot = root
  })
  const drawerElapsed = await page.evaluate(async () => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-warehouse-map-action="open-occupancy"]'))
      .find((item) => item.textContent?.includes('PO-DEMO-CUTTING-001'))
    if (!button) throw new Error('缺少占用详情入口')
    const startedAt = performance.now()
    button.click()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('占用详情未及时打开')), 1_000)
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-warehouse-map-occupancy-drawer]')) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    return performance.now() - startedAt
  })
  expect(drawerElapsed).toBeLessThan(200)
  const processDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await expect(processDrawer).toBeVisible({ timeout: 120_000 })
  await expect(processDrawer).toContainText(/物料卷明细|演示卷明细/)
  await expectLoadedImage(processDrawer, '物料图')
  await expectLoadedImage(processDrawer, '款式图')
  expect(await page.evaluate(() =>
    (window as typeof window & { __occupancyMapRoot?: Element }).__occupancyMapRoot
      === document.querySelector('[data-warehouse-map-root]'),
  )).toBe(true)
  await page.locator('[data-warehouse-map-action="close-occupancy"]').first().click()
  await expect(processDrawer).toHaveCount(0)
  expect(await page.evaluate(() =>
    (window as typeof window & { __occupancyMapRoot?: Element }).__occupancyMapRoot
      === document.querySelector('[data-warehouse-map-root]'),
  )).toBe(true)

  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-warehouse-map-root]')
    const selector = document.querySelector<HTMLSelectElement>('[data-warehouse-map-action="change-factory"]')
    const factoryId = selector?.selectedOptions[0]?.dataset.factoryId || ''
    const cell = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-location-id]'))
      .find((button) => button.textContent?.includes('空闲'))
    if (!root || !factoryId || !cell) throw new Error('缺少分页测试所需的空闲库位')
    const locationId = cell.dataset.locationId || ''
    const locationNo = cell.dataset.locationNo || ''
    const warehouseId = root.dataset.warehouseId || ''
    const rollDetails = Array.from({ length: 12 }, (_, index) => ({
      rollNo: `ROLL-E2E-${String(index + 1).padStart(3, '0')}`,
      yard: 10,
      meter: 9.14,
      locationNo,
    }))
    localStorage.setItem('cuttingRuntimeEventLedger', JSON.stringify({ events: [{
      eventId: 'EVENT-E2E-ROLL-PAGE',
      eventNo: '领料-E2E-分页',
      eventType: '中转仓领料',
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: '2026-07-31 10:00',
      createdAt: '2026-07-31 10:00',
      operatorId: 'U-E2E',
      operatorName: '分页测试仓管',
      operatorRole: 'PDA 仓管',
      refs: { productionOrderNo: 'PO-E2E-PAGE', handoverRecordId: 'SESSION-E2E-PAGE:LINE-001' },
      material: { materialSku: 'MAT-E2E-PAGE', materialName: '分页测试面料', unit: 'yard' },
      inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 120, unit: 'yard', rollCount: 12 },
      payload: {
        pickupSessionId: 'SESSION-E2E-PAGE',
        prepLineId: 'LINE-001',
        pickupQty: 120,
        rollCount: 12,
        rollDetails,
        locationRefs: [{ factoryId, warehouseId, warehouseKind: 'WAIT_PROCESS', locationId, locationNo }],
      },
    }] }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const pagedCell = page.locator('[data-warehouse-map-action="open-occupancy"]').filter({ hasText: 'PO-E2E-PAGE' })
  await expect(pagedCell).toBeVisible({ timeout: 120_000 })
  await pagedCell.click()
  const pagedDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await pagedDrawer.locator('[data-warehouse-map-action="occupancy-detail-page"][data-page="2"]').click()
  await expect(page).toHaveURL(/occupancyDetailPage=2/)
  await expect(pagedDrawer).toContainText('ROLL-E2E-011')
  await expect(pagedDrawer).not.toContainText('ROLL-E2E-001')
  await pagedDrawer.locator('[data-warehouse-map-action="close-occupancy"]').click()

  await openWarehouseMap(page, `${WAIT_HANDOVER_PATH}?demo=1`)
  await page.locator('[data-warehouse-map-action="open-occupancy"]').first().click()
  const handoverDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await expect(handoverDrawer).toBeVisible({ timeout: 120_000 })
  await expect(handoverDrawer).toContainText('袋内菲票明细')
  await expect(handoverDrawer).toContainText('已装菲票')
  await expectImageOrPlaceholder(handoverDrawer, '款式图', '款式图待补充')
})

test('1366 真实待加工仓同场景完成排序占用维护并由生产 handler 原子拒绝并发冲突', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openWarehouseMap(page, `${WAIT_PROCESS_PATH}?demo=1`)
  let root = page.locator('[data-warehouse-map-root]')
  const firstShelfCodes = await root.locator('[data-warehouse-map-shelf-viewport] [data-location-no]').evaluateAll((nodes) =>
    nodes.slice(0, 8).map((node) => (node as HTMLElement).dataset.locationNo || ''))
  expect(firstShelfCodes).toEqual([
    'A-R01-L04-P01', 'A-R01-L04-P02', 'A-R01-L04-P03',
    'A-R01-L03-P01', 'A-R01-L03-P02', 'A-R01-L03-P03',
    'A-R01-L02-P01', 'A-R01-L02-P02',
  ])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  const occupiedCell = root.locator('[data-warehouse-map-action="open-occupancy"]').first()
  await expect(occupiedCell).toContainText(/A-R\d+-L\d+-P\d+/)
  await occupiedCell.click()
  const occupancyDrawer = page.locator('[data-warehouse-map-occupancy-drawer]')
  await expect(occupancyDrawer).toBeVisible()
  await expect(occupancyDrawer).toContainText(/物料卷明细|演示卷明细/)
  await occupancyDrawer.locator('[data-warehouse-map-action="close-occupancy"]').click()

  await page.getByRole('button', { name: '维护库位图', exact: true }).click()
  await page.locator('[data-warehouse-map-action="open-create-area"]').click()
  let maintenanceDialog = page.locator('[data-cutting-warehouse-modal]')
  await maintenanceDialog.locator('[name="areaCode"]').fill('Z')
  await maintenanceDialog.locator('[name="areaName"]').fill('真实处理器验收区')
  await maintenanceDialog.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  root = page.locator('[data-warehouse-map-root]')
  await root.locator('[data-warehouse-map-action="open-create-shelf"]').last().click()
  maintenanceDialog = page.locator('[data-cutting-warehouse-modal]')
  await maintenanceDialog.locator('[name="shelfSequence"]').fill('9')
  await maintenanceDialog.locator('[name="levelCount"]').fill('2')
  await maintenanceDialog.locator('[name="defaultPositionCount"]').fill('2')
  await maintenanceDialog.locator('[data-warehouse-map-action="submit-maintenance"]').click()
  await expect(root).toContainText('Z-R09-L02-P02')

  await page.goto(`${WAIT_PROCESS_PATH}?warehouseAction=claim`, { waitUntil: 'domcontentloaded' })
  const actionDialog = page.locator('[data-wait-process-modal][data-wait-process-action-type="claim"]')
  await expect(actionDialog).toBeVisible({ timeout: 120_000 })
  const material = actionDialog.locator('[data-wait-process-field="cutOrderId"]')
  const firstMaterialValue = await material.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).find(Boolean) || '')
  expect(firstMaterialValue).not.toBe('')
  await material.selectOption(firstMaterialValue)
  await actionDialog.locator('[data-wait-process-field="quantity"]').fill('30')
  await actionDialog.locator('[data-wait-process-field="rollCount"]').fill('3')
  await actionDialog.locator('[data-wait-process-field="operatorName"]').fill('真实处理器验收仓管')
  const selectionMap = actionDialog.locator('[data-wait-process-location-map] [data-warehouse-map-root]')
  const clearSelection = selectionMap.locator('[data-warehouse-map-action="clear-selection"]')
  if (await clearSelection.isEnabled()) await clearSelection.click()
  const selectedLocations = await selectionMap.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').evaluateAll((buttons) => {
    const candidates = Array.from(new Map(buttons.map((button) => {
      const element = button as HTMLElement
      const locationNo = element.dataset.locationNo || ''
      const match = locationNo.match(/^([A-Z])-R(\d+)-L(\d+)-P\d+$/)
      return [element.dataset.locationId || '', match ? {
        locationId: element.dataset.locationId || '', locationNo,
        area: match[1], shelf: `${match[1]}-R${match[2]}`, level: match[3],
      } : null] as const
    }).filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[0] && entry[1]))).values())
    for (let first = 0; first < candidates.length; first += 1) {
      for (let second = first + 1; second < candidates.length; second += 1) {
        for (let third = second + 1; third < candidates.length; third += 1) {
          const group = [candidates[first], candidates[second], candidates[third]]
          if (new Set(group.map((item) => item.area)).size > 1
            && new Set(group.map((item) => item.shelf)).size > 1
            && new Set(group.map((item) => item.level)).size > 1) return group
        }
      }
    }
    return []
  })
  expect(selectedLocations).toHaveLength(3)
  for (const [index, location] of selectedLocations.entries()) {
    await actionDialog.locator(`[data-wait-process-location-map] [data-location-id="${location.locationId}"]`).click()
    await expect(actionDialog.locator('[data-warehouse-map-selection-summary]')).toContainText(`已选 ${index + 1} 个库位`)
  }

  const eventCountBeforeConflict = await page.evaluate(() => {
    const value = localStorage.getItem('cuttingRuntimeEventLedger')
    return value ? JSON.parse(value).events.length : 0
  })
  await page.evaluate(async (locationId) => {
    const mapModule = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const mapModel = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
    const ledger = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const current = mapModule.buildCurrentCuttingWarehouseMapProjection('WAIT_PROCESS')
    const ref = current && mapModel.listWarehouseLocationMapCells(current.projection)
      .find((cell) => cell.locationId === locationId)
    if (!ref) throw new Error('缺少并发占用目标库位')
    ledger.appendCuttingRuntimeEvent({
      eventType: '中转仓领料', eventSource: 'PDA', eventStatus: '已同步',
      occurredAt: '2026-08-02 12:00:00', operatorName: '并发入仓仓管',
      refs: { productionOrderNo: 'PO-CONCURRENT-E2E', handoverRecordId: 'CONCURRENT-E2E:LINE' },
      material: { materialSku: 'MAT-CONCURRENT-E2E', materialName: '并发占用测试面料', unit: 'yard' },
      inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 1, unit: 'yard', rollCount: 1 },
      payload: {
        pickupSessionId: 'CONCURRENT-E2E', prepLineId: 'CONCURRENT-E2E:LINE', pickupQty: 1, rollCount: 1,
        warehouseLocations: [ref],
      },
    })
  }, selectedLocations[2].locationId)
  let conflictMessage = ''
  page.once('dialog', async (dialog) => {
    conflictMessage = dialog.message()
    await dialog.accept()
  })
  await actionDialog.locator('[data-wait-process-action="submit"]').click()
  expect(conflictMessage).toContain(selectedLocations[2].locationNo)
  expect(conflictMessage).toContain('已不可用')
  await expect(actionDialog).toBeVisible()
  await expect(actionDialog.locator('[data-warehouse-map-selection-summary]')).toContainText('已选 2 个库位')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}').events.length))
    .toBe(eventCountBeforeConflict + 1)
})

test('PDA 中转仓领料支持跨区货架层自由多选、任意取消、逐项摘要和清空', async ({ page }) => {
  await openControlledPdaPickup(page)
  const map = page.locator('[data-pda-cutting-pickup-location-map] [data-warehouse-map-root]')
  await expect(map).toBeVisible({ timeout: 300_000 })
  const crossHierarchyLocations = await map.locator(
    '[data-warehouse-map-action="toggle-location"]:not([disabled])',
  ).evaluateAll((buttons) => {
    const candidates = buttons.map((button) => {
      const element = button as HTMLButtonElement
      const locationNo = element.dataset.locationNo || ''
      const match = locationNo.match(/^([A-Z])-R(\d+)-L(\d+)-P\d+$/)
      return match ? {
        locationId: element.dataset.locationId || '',
        locationNo,
        area: match[1],
        shelf: `${match[1]}-R${match[2]}`,
        level: match[3],
      } : null
    }).filter((item): item is NonNullable<typeof item> => Boolean(item?.locationId))
    for (let first = 0; first < candidates.length; first += 1) {
      for (let second = first + 1; second < candidates.length; second += 1) {
        for (let third = second + 1; third < candidates.length; third += 1) {
          const group = [candidates[first], candidates[second], candidates[third]]
          if (new Set(group.map((item) => item.area)).size > 1
            && new Set(group.map((item) => item.shelf)).size > 1
            && new Set(group.map((item) => item.level)).size > 1) return group
        }
      }
    }
    return []
  })
  expect(crossHierarchyLocations).toHaveLength(3)
  const initialPageScrollY = await page.evaluate(() => {
    const tracked = window as typeof window & {
      __selectionRoot?: Element
      __selectionShell?: Element
      __selectionScroll?: Element
      __selectionPageScrollY?: number
    }
    tracked.__selectionRoot = document.querySelector('[data-warehouse-map-root]') || undefined
    tracked.__selectionShell = document.body.firstElementChild || undefined
    tracked.__selectionScroll = document.querySelector('[data-warehouse-shelf-scroll]') || undefined
    const scroll = tracked.__selectionScroll as HTMLElement | undefined
    if (scroll) scroll.scrollLeft = Math.min(24, scroll.scrollWidth - scroll.clientWidth)
    window.scrollTo(0, Math.min(160, document.documentElement.scrollHeight - window.innerHeight))
    tracked.__selectionPageScrollY = window.scrollY
    return window.scrollY
  })
  expect(initialPageScrollY).toBeGreaterThan(0)
  const firstSelectionElapsed = await page.evaluate(async (locationId) => {
    const button = document.querySelector<HTMLButtonElement>(`[data-pda-cutting-pickup-location-map] [data-location-id="${locationId}"]`)
    if (!button) throw new Error('缺少首次选位按钮')
    const startedAt = performance.now()
    const selectionFeedback = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('首次选位未及时反馈')), 1_000)
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-warehouse-map-selected-item]')) return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    button.click()
    await selectionFeedback
    return performance.now() - startedAt
  }, crossHierarchyLocations[0].locationId)
  console.info(`PDA 库位首次选位 DOM 反馈：${firstSelectionElapsed.toFixed(2)}ms`)
  expect(firstSelectionElapsed).toBeLessThan(200)
  expect(await page.evaluate(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    const tracked = window as typeof window & {
      __selectionRoot?: Element
      __selectionShell?: Element
      __selectionPageScrollY?: number
    }
    return {
      mapRootLocallyReplaced: tracked.__selectionRoot !== document.querySelector('[data-warehouse-map-root]')
        && tracked.__selectionRoot?.isConnected === false
        && Boolean(document.querySelector('[data-warehouse-map-root]')),
      pageShellPreserved: tracked.__selectionShell === document.body.firstElementChild,
      pageScrollPreserved: window.scrollY === tracked.__selectionPageScrollY,
    }
  })).toEqual({ mapRootLocallyReplaced: true, pageShellPreserved: true, pageScrollPreserved: true })
  for (const location of crossHierarchyLocations.slice(1)) await map.locator(`[data-location-id="${location.locationId}"]`).click()
  const selectionSummary = map.locator('[data-warehouse-map-selection-summary]')
  const selectedItems = selectionSummary.locator('[data-warehouse-map-selected-item]')
  await expect(selectionSummary).toContainText('已选 3 个库位')
  await expect(selectedItems).toHaveCount(3)
  for (const [index, location] of crossHierarchyLocations.entries()) {
    await expect(selectedItems.nth(index)).toContainText(location.locationNo)
  }
  await expect(selectionSummary).not.toContainText(/范围：|连续|相邻/)
  await selectedItems.nth(1).click()
  await expect(selectionSummary).toContainText('已选 2 个库位')
  await expect(selectionSummary).toContainText(crossHierarchyLocations[0].locationNo)
  await expect(selectionSummary).not.toContainText(crossHierarchyLocations[1].locationNo)
  await expect(selectionSummary).toContainText(crossHierarchyLocations[2].locationNo)
  await map.locator('[data-warehouse-map-action="clear-selection"]').click()
  await expect(selectionSummary).toContainText('已选 0 个库位')
})

test('PDA 扫码异常、特殊工艺回仓和多候选领料批次均走真实页面处理器', async ({ page }) => {
  await openControlledPdaSpecialCraftReturn(page, PDA_CUTTING_TASK_ID)
  const specialMap = page.locator('[data-pda-special-craft-return-location-map] [data-warehouse-map-root]')
  await expect(specialMap).toBeVisible()
  const available = await specialMap.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').evaluateAll((nodes) =>
    nodes.slice(0, 2).map((node) => ({ id: (node as HTMLElement).dataset.locationId || '', no: (node as HTMLElement).dataset.locationNo || '' })))
  expect(available).toHaveLength(2)
  const scan = page.locator('[data-pda-cut-handover-field="specialCraftReturnLocationScan"]')
  await scan.fill(available[0].no)
  await scan.press('Enter')
  await expect(specialMap.locator('[data-warehouse-map-selection-summary]')).toContainText(available[0].no)
  await scan.fill(available[1].no)
  await scan.press('Enter')
  await expect(specialMap.locator('[data-warehouse-map-selection-summary]')).toContainText('已选 2 个库位')
  await scan.fill('Z-R99-L99-P99')
  await scan.press('Enter')
  await expect(page.locator('[data-pda-special-craft-return-location-feedback]')).toContainText('不存在')
  await expect(specialMap.locator('[data-warehouse-map-selection-summary]')).toContainText('已选 2 个库位')

  await openControlledPdaIssueWithMultipleBatches(page)
  const batch = page.locator('[data-cutting-issue-batch]')
  await expect(batch).toBeVisible()
  await expect(batch).toHaveValue('')
  const labels = await batch.locator('option').allTextContents()
  expect(labels.filter((label) => label.includes('入仓')).length).toBeGreaterThanOrEqual(2)
  expect(labels.join(' ')).not.toMatch(/E2E-BATCH|EVENT-|pickupSessionId|sourceEventId/)
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('请选择本次领料批次。')
    await dialog.accept()
  })
  await page.locator('[data-pda-warehouse-action="cutting-wp-issue"]').click()
  await batch.selectOption({ index: 1 })
  await page.locator('[data-pda-warehouse-action="cutting-wp-issue"]').click()
  await expect(page.locator('[data-pda-warehouse-action="confirm-cutting-wp-issue"]')).toBeVisible()
})

test('PDA 中转袋入仓可点选多个库位、逐项取消并确认完整数组', async ({ page }) => {
  await openControlledPdaInbound(page, PDA_CUTTING_TASK_ID)
  const map = page.locator('[data-pda-inbound-location-map] [data-warehouse-map-root]')
  await expect(map).toBeVisible({ timeout: 300_000 })
  const availableLocations = await map.locator(
    '[data-warehouse-map-action="toggle-location"]:not([disabled])',
  ).evaluateAll((buttons) => buttons.slice(0, 2).map((button) => ({
    locationId: (button as HTMLButtonElement).dataset.locationId || '',
    locationNo: (button as HTMLButtonElement).dataset.locationNo || '',
  })))
  expect(availableLocations).toHaveLength(2)
  const [firstLocation, secondLocation] = availableLocations
  const selectionSummary = map.locator('[data-warehouse-map-selection-summary]')
  const selectedItems = selectionSummary.locator('[data-warehouse-map-selected-item]')

  await map.locator(`[data-location-id="${firstLocation.locationId}"]`).click()
  await expect(selectionSummary).toContainText('已选 1 个库位')
  await expect(selectedItems).toHaveCount(1)
  await expect(selectedItems).toContainText(firstLocation.locationNo)

  const secondButton = map.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${secondLocation.locationId}"]`)
  await expect(secondButton).toBeEnabled()
  await expect(secondButton).toHaveAttribute('aria-pressed', 'false')
  await secondButton.click()

  await expect(selectionSummary).toContainText('已选 2 个库位')
  await expect(selectedItems).toHaveCount(2)
  await expect(selectedItems.nth(0)).toContainText(firstLocation.locationNo)
  await expect(selectedItems.nth(1)).toContainText(secondLocation.locationNo)
  await expect(map.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${firstLocation.locationId}"]`)).toHaveAttribute('aria-pressed', 'true')
  await expect(secondButton).toHaveAttribute('aria-pressed', 'true')

  await selectedItems.nth(0).click()
  await expect(selectionSummary).toContainText('已选 1 个库位')
  await expect(selectedItems).toHaveCount(1)
  await expect(map.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${firstLocation.locationId}"]`)).toHaveAttribute('aria-pressed', 'false')
  await expect(secondButton).toHaveAttribute('aria-pressed', 'true')

  await map.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${firstLocation.locationId}"]`).click()
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()
  await expect(page.locator('[data-pda-cutting-inbound-workflow]')).toContainText('入仓成功')
  const savedLocationNos = await page.evaluate(() => {
    const raw = localStorage.getItem('cuttingRuntimeEventLedger') || '{"events":[]}'
    const events = JSON.parse(raw).events || []
    const inbound = [...events].reverse().find((event: any) => event.eventType === '中转袋入仓')
    return (inbound?.payload?.warehouseLocations || []).map((location: any) => location.locationNo)
  })
  expect(new Set(savedLocationNos)).toEqual(new Set([secondLocation.locationNo, firstLocation.locationNo]))
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}×${viewport.height} 库位图不产生页面级横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const path = viewport.width <= 390
      ? `/fcs/pda/cutting/inbound/${PDA_CUTTING_TASK_ID}?action=inbound-location`
      : WAIT_PROCESS_PATH
    if (viewport.width <= 390) {
      await openControlledPdaInbound(page, PDA_CUTTING_TASK_ID)
      await expect(page.locator('[data-warehouse-map-root]')).toBeVisible({ timeout: 300_000 })
      await expect(page.getByRole('button', { name: '维护库位图', exact: true })).toHaveCount(0)
    } else {
      await openWarehouseMap(page, path)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width)
    if (viewport.width === 1280) {
      const shelfScroll = page.locator('[data-warehouse-shelf-scroll]').first()
      await expect(shelfScroll).toBeVisible()
      await shelfScroll.evaluate((node) => {
        const section = node.closest<HTMLElement>('[data-cutting-warehouse-map-section]')
        if (section) section.style.maxWidth = '640px'
      })
      expect(await shelfScroll.evaluate((node) => node.scrollWidth)).toBeGreaterThan(await shelfScroll.evaluate((node) => node.clientWidth))
      await shelfScroll.evaluate((node) => { node.scrollLeft = node.scrollWidth })
      expect(await shelfScroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)
      await expect(page.locator('[data-warehouse-map-action="enter-maintenance"]')).toBeVisible()
      await expect(page.locator('[data-warehouse-map-action="enter-maintenance"]')).toBeEnabled()
    }
  })
}
