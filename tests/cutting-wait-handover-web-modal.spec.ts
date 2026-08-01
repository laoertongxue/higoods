import { expect, test, type Page } from '@playwright/test'

async function openControlledWaitHandover(page: Page): Promise<void> {
  await page.goto('/src/pages/process-factory/cutting/wait-handover-runtime.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingRuntimeEventLedger')
    const pda = await import('/src/data/fcs/store-domain-pda.ts')
    const user = pda.listFactoryPdaUsers('FACTORY-ONBOARD-0035')[0] || await pda.createFactoryPdaUser({ factoryId: 'FACTORY-ONBOARD-0035', name: '裁床仓管', loginId: 'wait_handover_e2e', password: '123456', roleId: 'ROLE_OPERATOR' })
    pda.setPdaSession(pda.createPdaSessionFromUser(user))
    const runtime = await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts')
    const warehouseMap = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const component = await import('/src/components/ui/warehouse-location-map.ts')
    const model = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
    let selected: string[] = []
    const bagCode = 'BAG-B-003'
    const tickets = [
      { feiTicketId: 'demo-front', feiTicketNo: 'FT-CUT-260307-102-02-DEMO-FRONT', productionOrderId: 'PO-102', productionOrderNo: 'PO-202603-0102', cutOrderId: 'CUT-102', cutOrderNo: 'CUT-102', spreadingOrderId: 'SP-102', spreadingOrderNo: 'SP-102', color: '卡其色', size: 'L', partCode: '前片', partName: '前片', pieceSequenceLabel: '1-128', pieceQty: 128 },
      { feiTicketId: 'demo-back', feiTicketNo: 'FT-CUT-260307-102-02-DEMO-BACK', productionOrderId: 'PO-102', productionOrderNo: 'PO-202603-0102', cutOrderId: 'CUT-102', cutOrderNo: 'CUT-102', spreadingOrderId: 'SP-102', spreadingOrderNo: 'SP-102', color: '卡其色', size: 'L', partCode: '后片', partName: '后片', pieceSequenceLabel: '1-128', pieceQty: 128 },
    ]
    const render = () => {
      const current = warehouseMap.buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
      if (!current) throw new Error('缺少待交出仓投影')
      document.body.innerHTML = `<main data-controlled-wait-handover><div class="actions"><button data-action="bagging">确认菲票装袋</button><button data-action="inbound">确认中转袋入仓</button><button data-action="handover">确认整袋交出</button></div>${component.renderWarehouseLocationMap({ projection: current.projection, mode: 'SELECT', factoryName: current.warehouse.factoryName, selectedLocationIds: selected })}${component.renderWarehouseLocationMapSummarySection(current.projection)}</main>`
    }
    render()
    document.body.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target) return
      const current = warehouseMap.buildCurrentCuttingWarehouseMapProjection('WAIT_HANDOVER')
      if (!current) return
      const location = target.closest<HTMLElement>('[data-warehouse-map-action="toggle-location"]')
      if (location) {
        const result = model.toggleWarehouseLocationSelection(current.projection, selected, location.dataset.locationId || '')
        if (result.ok) selected = result.selectedLocationIds
        else window.alert(result.message)
        render(); return
      }
      const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
      const operator = { operatorId: 'E2E', operatorName: '浏览器仓管', operatorRole: '裁片仓管' }
      if (action === 'bagging') runtime.appendWaitHandoverBaggingEvent({ source: 'WEB', operator, bagCode, tickets, occurredAt: '2026-08-02 10:00' })
      if (action === 'inbound') {
        const validation = model.revalidateWarehouseLocationSelection(current.projection, selected)
        if (!validation.ok) { window.alert(validation.message); return }
        const refs = model.listWarehouseLocationMapCells(current.projection).filter((cell) => selected.includes(cell.locationId))
        runtime.appendWaitHandoverInboundEvent({ source: 'WEB', operator, bagCode, warehouseArea: refs[0].areaName, locationCode: refs[0].locationNo, warehouseLocations: refs, occurredAt: '2026-08-02 10:01' })
      }
      if (action === 'handover') runtime.appendWaitHandoverHandoverRecordEvent({ source: 'WEB', operator, fromWarehouseArea: '待交出仓', fromLocationCode: selected[0] || '', occurredAt: '2026-08-02 10:02', payload: { handoverOrderId: 'HO-E2E', handoverOrderNo: 'HO-E2E', handoverRecordId: 'HR-E2E', handoverRecordNo: 'HR-E2E', receiverType: '车缝厂', receiverId: 'SEW-E2E', receiverName: '车缝厂', transferBagUses: [{ bagUseId: 'BAG-USE-E2E', bagCode, containedFeiTicketIds: tickets.map((item) => item.feiTicketId), totalPieceQty: 256 }], feiTicketItems: tickets.map((item) => ({ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, pieceQty: item.pieceQty, unit: '片' })), currentHandedOverQty: 256, submittedAt: '2026-08-02 10:02', submittedBy: '浏览器仓管' } })
      render()
    })
  })
}

async function openControlledWaitProcess(page: Page): Promise<void> {
  await page.goto('/src/pages/process-factory/cutting/warehouse-location-map.ts', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingRuntimeEventLedger')
    const warehouseMap = await import('/src/pages/process-factory/cutting/warehouse-location-map.ts')
    const component = await import('/src/components/ui/warehouse-location-map.ts')
    const model = await import('/src/pages/process-factory/cutting/warehouse-location-map-model.ts')
    const ledger = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    let selected: string[] = []
    const render = () => {
      const current = warehouseMap.buildCurrentCuttingWarehouseMapProjection('WAIT_PROCESS')
      if (!current) throw new Error('缺少待加工仓投影')
      document.body.innerHTML = `<main data-controlled-wait-process>${component.renderWarehouseLocationMap({ projection: current.projection, mode: 'SELECT', factoryName: current.warehouse.factoryName, selectedLocationIds: selected })}<button data-action="confirm">确认领料</button></main>`
    }
    render()
    document.body.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target) return
      const current = warehouseMap.buildCurrentCuttingWarehouseMapProjection('WAIT_PROCESS')
      if (!current) return
      const cell = target.closest<HTMLElement>('[data-warehouse-map-action="toggle-location"]')
      if (cell) { const result = model.toggleWarehouseLocationSelection(current.projection, selected, cell.dataset.locationId || ''); if (result.ok) selected = result.selectedLocationIds; else window.alert(result.message); render(); return }
      if (target.closest('[data-action="confirm"]')) { const result = model.revalidateWarehouseLocationSelection(current.projection, selected); if (!result.ok) { window.alert(result.message); return } }
    })
    ;(window as typeof window & { __appendConflict?: (id: string) => number }).__appendConflict = (id) => {
      const current = warehouseMap.buildCurrentCuttingWarehouseMapProjection('WAIT_PROCESS')!
      const ref = model.listWarehouseLocationMapCells(current.projection).find((item) => item.locationId === id)!
      ledger.appendCuttingRuntimeEvent({ eventType: '中转仓领料', operatorName: '其他仓管', occurredAt: '2026-08-02 11:00', refs: { cutOrderNo: 'CUT-CONFLICT', productionOrderNo: 'PO-CONFLICT', handoverRecordId: 'CONFLICT:LINE' }, material: { materialSku: 'MAT-CONFLICT', materialName: '并发物料' }, inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: 1, unit: 'yard', rollCount: 1, toWarehouseArea: ref.areaName, toLocationCode: ref.locationNo }, payload: { pickupSessionId: 'CONFLICT', warehouseLocations: [ref] } })
      return ledger.listCuttingRuntimeEvents().length
    }
  })
}

async function selectCrossHierarchyLocations(map: ReturnType<Page['locator']>) {
  return map.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').evaluateAll((buttons) => {
    const rows = buttons.map((button) => { const no = (button as HTMLElement).dataset.locationNo || ''; const m = no.match(/^([A-Z])-R(\d+)-L(\d+)-P/); return m ? { id: (button as HTMLElement).dataset.locationId || '', no, area: m[1], shelf: `${m[1]}-${m[2]}`, level: m[3] } : null }).filter((row): row is NonNullable<typeof row> => Boolean(row))
    for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) for (let c = b + 1; c < rows.length; c++) { const group = [rows[a], rows[b], rows[c]]; if (new Set(group.map((x) => x.area)).size > 1 && new Set(group.map((x) => x.shelf)).size > 1 && new Set(group.map((x) => x.level)).size > 1) return group }
    return []
  })
}

test('WAIT_PROCESS 跨层级多选在最新占用冲突时原子阻断', async ({ page }) => {
  test.setTimeout(180_000)
  await openControlledWaitProcess(page)
  const map = page.locator('[data-warehouse-map-root]')
  const locations = await selectCrossHierarchyLocations(map)
  expect(locations).toHaveLength(3)
  for (const location of locations) await map.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`).click()
  await expect(map.locator('[data-warehouse-map-selection-summary]')).toContainText('已选 3 个库位')
  const before = await page.evaluate((id) => (window as typeof window & { __appendConflict: (id: string) => number }).__appendConflict(id), locations[2].id)
  let conflictMessage = ''
  page.once('dialog', async (dialog) => {
    conflictMessage = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: '确认领料' }).click()
  expect(conflictMessage).toContain(locations[2].no)
  expect(await page.evaluate(async () => (await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')).listCuttingRuntimeEvents().length)).toBe(before)
})

test('WAIT_HANDOVER 跨层级入仓、一次汇总和整袋释放形成浏览器 UI 闭环', async ({ page }) => {
  test.setTimeout(120_000)
  await openControlledWaitHandover(page)
  await page.getByRole('button', { name: '确认菲票装袋' }).click()
  const map = page.locator('[data-warehouse-map-root]')
  const locations = await selectCrossHierarchyLocations(map)
  expect(locations).toHaveLength(3)
  for (const location of locations) await map.locator(`[data-location-id="${location.id}"]`).click()
  await page.getByRole('button', { name: '确认中转袋入仓' }).click()
  for (const location of locations) await expect(page.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`)).toContainText('BAG-B-003')
  const summary = page.locator('[data-warehouse-map-summary-section]')
  await expect(summary).toContainText('1 袋')
  await expect(summary).toContainText('2 张菲票')
  await expect(summary).toContainText('256 片')
  await expect(summary).toContainText('3 个库位')
  await page.getByRole('button', { name: '确认整袋交出' }).click()
  for (const location of locations) await expect(page.locator(`[data-warehouse-map-shelf-viewport] [data-location-id="${location.id}"]`)).not.toContainText('BAG-B-003')
  await expect(page.locator('[data-warehouse-map-summary-section]')).toHaveCount(0)
})
