import { expect, test, type Page } from '@playwright/test'

// Functional evidence for A12/A14/A20; performance is measured independently.
const action = (name: string, id?: string) => `[data-wool-work-orders-action="${name}"]${id ? `[data-wool-order-id="${id}"]` : ''}`
const knit = 'WOOL-STAGE-004:KNITTING'
const link = 'WOOL-STAGE-004:LINKING'
async function open(page: Page, stage = 'knitting') {
  await page.goto(`/fcs/craft/wool/${stage}-orders`)
  await expect(page.locator('[data-wool-work-orders-root]')).toBeVisible()
}
async function facts(page: Page) {
  return page.evaluate(async () => (await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore())
}
async function setSession(page: Page, factoryId = 'OWN_WOOL_FACTORY') {
  await page.evaluate(async (factoryId) => {
    const { setPdaSession, listFactoryPdaUsers, createPdaSessionFromUser } = await import('/src/data/fcs/store-domain-pda.ts')
    const users = listFactoryPdaUsers(factoryId)
    const user = users.find((user: any) => user.roleId === 'ROLE_MANAGER') || users[0]
    if (!user) throw Error(`没有验收工厂用户 ${factoryId}`)
    setPdaSession(createPdaSessionFromUser(user))
  }, factoryId)
}
async function handover(page: Page, id: string, qty: number) {
  await page.locator(action('open-handover', id)).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(qty))
  await page.locator(action('save-handover')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
}
async function confirmFixtureDownstream(page: Page, id: string) {
  // Prepare a closed existing demo via its normal receipt command; completion itself uses real UI.
  await page.evaluate(async (id) => {
    const { readWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const { confirmWoolDownstreamReceipt } = await import('/src/data/fcs/wool-domain/commands.ts')
    const record = readWoolStore().handovers.find((row: any) => row.woolOrderId === id && !row.automatic)
    if (!record) throw Error('没有真实最终交出记录')
    confirmWoolDownstreamReceipt(record.handoverId, { commandId: `stage-ui:${id}:receipt`, actualReceivedQty: record.handoverQty, receivedAt: '2026-09-18 12:00:00', receivedBy: '隔离验收接收人' })
  }, id)
}
async function csvDownload(page: Page, selector: string) {
  const download = page.waitForEvent('download')
  await page.locator(selector).click()
  const stream = (await (await download).createReadStream())!
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)
}

test('Web 完单先核对再确认：未交出、未实收均阻断，闭合后刷新持久化', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 'linking')
  await expect(page.locator(action('open-complete', link))).toHaveCount(0)
  await handover(page, link, 100)
  await expect(page.locator(action('open-complete', link))).toHaveCount(0)
  expect((await facts(page)).completions.some((row: any) => row.woolOrderId === link)).toBe(false)
  await confirmFixtureDownstream(page, link)
  await page.reload()
  await page.locator(action('open-complete', link)).click()
  await expect(page.locator('[data-wool-business-dialog]')).toContainText('缝盘加工单完单确认')
  expect((await facts(page)).completions.some((row: any) => row.woolOrderId === link)).toBe(false)
  await page.locator(action('close-overlay')).first().click()
  expect((await facts(page)).completions.some((row: any) => row.woolOrderId === link)).toBe(false)
  await page.locator(action('open-complete', link)).click()
  await page.locator('[data-wool-dialog-field="remark"]').fill('Web 复核交出与实收闭合')
  await page.locator(action('save-complete')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  await page.reload()
  const actual = (await facts(page)).completions.filter((row: any) => row.woolOrderId === link)
  expect(actual).toHaveLength(1)
  expect(actual[0].remark).toBe('Web 复核交出与实收闭合')
  await expect(page.locator(action('open-complete', link))).toHaveCount(0)
})

for (const viewport of [{ width: 360, height: 800 }, { width: 400, height: 806 }]) {
  test(`PDA ${viewport.width}x${viewport.height} 完单二次确认与未闭合阻断`, async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    await page.setViewportSize(viewport)
    await open(page)
    await setSession(page)
    await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-004%3ALINKING')
    await expect(page.locator('[data-pda-wool-root]')).toBeVisible()
    await expect(page.locator('[data-wool-fact-action="COMPLETE"]')).toHaveCount(0)
    await expect(page.locator('[data-wool-fact-action="ASSOCIATE_MACHINE"]')).toHaveCount(0)
    await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-004%3AKNITTING')
    await page.locator('[data-wool-fact-action="COMPLETE"]').click()
    await expect(page.getByRole('heading', { name: '完成加工单二次确认' })).toBeVisible()
    expect((await facts(page)).completions.some((row: any) => row.woolOrderId === knit)).toBe(false)
    await page.locator('[data-pda-wool-action="close-overlay"]').first().click()
    expect((await facts(page)).completions.some((row: any) => row.woolOrderId === knit)).toBe(false)
    await page.locator('[data-wool-fact-action="COMPLETE"]').click()
    await page.locator('[data-draft-field="remark"]').fill(`PDA ${viewport.width} 二次确认`)
    await page.screenshot({ path: testInfo.outputPath('completion-confirmation.png'), fullPage: true })
    await page.locator('[data-pda-wool-action="save-fact"]').click()
    await expect(page.locator('[data-pda-wool-action="save-fact"]')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('[data-pda-wool-root]')).toContainText('已完成')
    expect((await facts(page)).completions.filter((row: any) => row.woolOrderId === knit)).toHaveLength(1)
    await expect(page.locator('[data-wool-fact-action="COMPLETE"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await open(page, 'linking')
    await handover(page, link, 100)
    await confirmFixtureDownstream(page, link)
    await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-004%3ALINKING')
    await page.locator('[data-wool-fact-action="COMPLETE"]').click()
    await expect(page.getByRole('heading', { name: '完成加工单二次确认' })).toBeVisible()
    expect((await facts(page)).completions.some((row: any) => row.woolOrderId === link)).toBe(false)
    await page.locator('[data-pda-wool-action="save-fact"]').click()
    await expect(page.locator('[data-pda-wool-action="save-fact"]')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('[data-pda-wool-root]')).toContainText('已完成')
    expect((await facts(page)).completions.filter((row: any) => row.woolOrderId === link)).toHaveLength(1)
  })
}

test('横机设备关联通过真实入口保存刷新，缝盘无设备入口', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page)
  const row = page.locator('tbody tr').filter({ hasText: 'HJ260918-002' })
  await row.getByRole('button', { name: '关联横机设备', exact: true }).click()
  await expect(page.locator('[data-wool-machine-associations-root]')).toBeVisible()
  await expect(page.locator('[data-wool-machine-association-dialog]')).toBeVisible()
  await expect(page.locator('[data-wool-machine-associations-dialog-field="woolOrderId"]')).toHaveValue('WOOL-STAGE-002:KNITTING')
  await page.locator('[data-wool-machine-associations-machine-id="WM-003"]').check()
  await expect(page.locator('[data-wool-machine-associations-machine-id="WM-007"]')).toBeDisabled()
  await page.locator('[data-wool-machine-associations-action="save-association"]').click()
  await expect(page.locator('[data-wool-machine-association-dialog]')).toHaveCount(0)
  await page.reload()
  expect((await facts(page)).machineAssociations.some((row: any) => row.woolOrderId === 'WOOL-STAGE-002:KNITTING' && row.machineId === 'WM-003')).toBe(true)
  await open(page, 'linking')
  await expect(page.locator('[data-wool-work-orders-root]')).not.toContainText('关联横机设备')
})

test('Web 修正未消费横机数量同步自动衔接，最终交出后修正阻断且无写入', async ({ page }) => {
  test.setTimeout(90_000)
  const id = 'WOOL-STAGE-003:KNITTING'
  async function edit(qty: number) {
    await page.locator(action('open-qty-list', id)).click()
    await page.locator(action('open-qty-edit') + '[data-record-type="PROCESS_REPORT"]').first().click()
    await page.locator('[data-wool-dialog-field="qty"]').fill(String(qty))
    await page.locator('[data-wool-dialog-field="reason"]').fill('核对实际件数')
    await page.locator(action('save-qty')).click()
  }
  await open(page)
  await edit(35)
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  await page.reload()
  const quantities = await page.evaluate(async () => {
    const { readWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const { getWoolProcessReportEffectiveQty, getWoolHandoverEffectiveQty } = await import('/src/data/fcs/wool-domain/queries.ts')
    const store = readWoolStore()
    return {
      reports: store.processReports.filter((row: any) => row.woolOrderId.startsWith('WOOL-STAGE-003:')).map((row: any) => getWoolProcessReportEffectiveQty(store, row)),
      internal: store.internalReceipts.filter((row: any) => row.woolOrderId === 'WOOL-STAGE-003:LINKING').map((row: any) => row.qty),
      handover: store.handovers.filter((row: any) => row.woolOrderId === 'WOOL-STAGE-003:KNITTING').map((row: any) => getWoolHandoverEffectiveQty(store, row)),
    }
  })
  expect(quantities).toEqual({ reports: [35, 35], internal: [35], handover: [35] })
  await open(page, 'linking')
  await handover(page, 'WOOL-STAGE-003:LINKING', 5)
  await open(page)
  const before = await facts(page)
  await edit(36)
  await expect(page.locator('[data-wool-overlay-error]')).toContainText(/下游|交出|消费/)
  expect(await facts(page)).toEqual(before)
  await page.reload()
  expect(await facts(page)).toEqual(before)
})

test('PDA 加工单扫码直达、生产单双阶段候选以及错厂阻断', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 360, height: 800 })
  await open(page)
  await setSession(page)
  await page.goto('/fcs/pda/exec')
  const field = page.locator('[data-pda-exec-wool-scan] [data-pda-exec-field="searchKeyword"]')
  await field.fill('HJ260918-002')
  await page.locator('[data-pda-exec-action="scan-wool-order"]').click()
  await expect(page).toHaveURL(/\/fcs\/pda\/exec\/TASK-WOOL-STAGE-002(?::|%3A)KNITTING(?:\?|$)/)
  await expect(page.locator('[data-pda-wool-root]')).toContainText('HJ260918-002')
  // Both stages must currently have an execution action to become two candidates.
  await open(page, 'linking')
  await handover(page, link, 100)
  await confirmFixtureDownstream(page, link)
  await page.goto('/fcs/pda/exec')
  await field.fill('PO-MZ-004')
  await page.locator('[data-pda-exec-action="scan-wool-order"]').click()
  await expect(page.locator('[data-pda-wool-scan-candidate]')).toHaveCount(2)
  await expect(page.locator('[data-pda-exec-wool-scan-feedback]')).toContainText('HJ260918-004')
  await expect(page.locator('[data-pda-exec-wool-scan-feedback]')).toContainText('FP260918-004')
  await page.locator('[data-pda-wool-scan-candidate]').filter({ hasText: 'FP260918-004' }).getByRole('button', { name: '选择此加工单' }).click()
  await expect(page).toHaveURL(/TASK-WOOL-STAGE-004(?::|%3A)LINKING(?:\?|$)/)
  const before = await facts(page)
  await setSession(page, 'FAC-APF')
  await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-002%3AKNITTING')
  await expect(page.locator('[data-pda-wool-access-blocked]')).toBeVisible()
  await expect(page.locator('[data-pda-wool-action="open-fact"]')).toHaveCount(0)
  expect(await facts(page)).toEqual(before)
})

test('待接收和备料导出全部匹配记录，列偏好按各自路由保存', async ({ page }) => {
  test.setTimeout(120_000)
  for (const stock of [false, true]) {
    const route = '/fcs/craft/wool/pending-receipts' + (stock ? '?view=stock' : '')
    const prefix = stock ? 'wool-stock' : 'wool-receiving'
    const button = (name: string) => `[data-${prefix}-action="${name}"]`
    const field = (name: string) => `[data-${prefix}-field="${name}"]`
    await page.goto(route)
    await expect(page.locator(`[data-${prefix}-page]`)).toBeVisible()
    if (!stock) {
      await page.locator(field('registration')).selectOption('all')
      await page.locator(button('query')).click()
    }
    const expected = await page.evaluate(async (stock) => stock
      ? (await import('/src/pages/process-factory/wool/stock-allocations.ts')).listWoolStockAllocationRows().filter((row: any) => row.remainingQty > 0).map((row: any) => ({ source: row.line.sourceDocumentNo, sku: row.line.material.sku, quantities: [row.line.qty, row.line.qty - row.remainingQty, row.remainingQty] }))
      : (await import('/src/pages/process-factory/wool/pending-receipts.ts')).listWoolPendingReceiptRows().filter((row: any) => row.line.material.kind === 'YARN').map((row: any) => ({ source: row.source.documentNo, sku: row.line.material.sku, quantities: [row.line.yarn ? row.line.yarn.netGrams / 1000 : row.line.sentQty, row.receivedQty, row.remainingQty] })), stock)
    const csv = await csvDownload(page, button('export'))
    expect(csv).toHaveLength(expected.length + 1)
    expect(csv[0]).not.toContain('操作')
    for (const row of expected) {
      const text = csv.slice(1).find(line => line.includes(`"${row.source}"`) && line.includes(`"${row.sku}"`))
      expect(text).toBeTruthy()
      const cells = Array.from(text!.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g), match => match[1].replaceAll('""', '"'))
      expect(cells.slice(stock ? 5 : 6, stock ? 8 : 9)).toEqual(row.quantities.map(String))
    }
    if (!stock) expect(expected.length).toBeGreaterThan(10)
    const hiddenKey = stock ? 'allocations' : 'order'
    const frozenKey = stock ? 'source' : 'material'
    await page.locator(button('open-column-settings')).click()
    await page.locator(button('toggle-column-visibility') + `[data-${prefix}-column-key="${hiddenKey}"]`).uncheck()
    // The shared table caps frozen width; replace the default frozen stock column.
    if (stock) await page.locator(button('toggle-column-freeze') + '[data-wool-stock-column-key="material"]').uncheck()
    await page.locator(button('toggle-column-freeze') + `[data-${prefix}-column-key="${frozenKey}"]`).check()
    await page.locator('[data-drag-source="time"]').dragTo(page.locator('[data-drop-target="quantity"]'))
    await page.locator(button('close-column-settings')).first().click()
    await page.locator(field('pageSize')).selectOption('20')
    await expect.poll(() => page.evaluate((route) => JSON.parse(localStorage.getItem(route) || '{}').pageSize, route)).toBe(20)
    await page.reload()
    await expect(page.locator(`th[data-column-key="${hiddenKey}"]`)).toHaveCount(0)
    await expect(page.locator(field('pageSize'))).toHaveValue('20')
    const prefs = await page.evaluate((route) => JSON.parse(localStorage.getItem(route)! ), route)
    expect(prefs.visibleKeys).not.toContain(hiddenKey)
    expect(prefs.frozenKeys).toContain(frozenKey)
    expect(prefs.order.indexOf('time')).toBeLessThan(prefs.order.indexOf('quantity'))
    await page.locator(field('keyword')).fill('不存在的隔离验收记录')
    await page.locator(button('query')).click()
    await page.locator(button('export')).click()
    await expect(page.locator(`[data-${prefix}-page]`)).toContainText(/没有可导出/)
  }
  await page.goto('/fcs/craft/wool/pending-receipts')
  await expect(page.locator('th[data-column-key="order"]')).toHaveCount(0)
  await expect(page.locator('[data-wool-receiving-field="pageSize"]')).toHaveValue('20')
})


test('工艺厂毛织片待接收导出保留工艺单身份，不误写为纱线备料', async ({ page }) => {
  await page.goto('/fcs/craft/wool/knitting-orders')
  await expect(page.locator('[data-wool-work-orders-root]')).toBeVisible()
  const craftOrderId = await page.evaluate(async () => {
    const { listFactoryReceivingSources } = await import('/src/data/fcs/factory-receiving.ts')
    return listFactoryReceivingSources().flatMap(source => source.lines).find(line => line.woolCraftOrderId)?.woolCraftOrderId
  })
  expect(craftOrderId).toBeTruthy()
  await page.goto('/fcs/craft/wool/pending-receipts?craftOrderId=' + encodeURIComponent(craftOrderId!))
  await expect(page.locator('[data-wool-receiving-page]')).toBeVisible()
  await page.locator('[data-wool-receiving-field="registration"]').selectOption('all')
  await page.locator('[data-wool-receiving-action="query"]').click()
  const csv = await csvDownload(page, '[data-wool-receiving-action="export"]')
  expect(csv.length).toBeGreaterThan(1)
  for (const line of csv.slice(1)) {
    const cells = Array.from(line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g), match => match[1].replaceAll('""', '"'))
    expect(cells[3]).toBe(craftOrderId)
    expect(cells[9]).toBe('片')
  }
})

test('PDA待办将缺逐片资料的缝盘标为异常，不引导横机填报或接收纱线', async ({ page }) => {
  await open(page)
  await setSession(page)
  await page.evaluate(async () => {
    const { readWoolStore, replaceWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const store = readWoolStore(), order = store.workOrders['WOOL-STAGE-001:LINKING']
    order.generationIssues.push('技术包存在外工艺，但缺少逐片实例')
    // Put this actual blocked task in the shell's five-item urgent list.
    order.plannedCompletionAt = '2020-01-01 08:00:00'
    replaceWoolStore(store)
  })
  await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-001%3ALINKING')
  await page.locator('[data-pda-shell-action="open-todo-modal"]').click()
  const modal = page.locator('[data-pda-todo-modal]')
  await expect(modal).toContainText('缝盘加工单资料不完整，请核对技术包')
  const entry = modal.locator('[data-pda-shell-action="open-todo-route"]').filter({ hasText: '缝盘加工单资料不完整' })
  await expect(entry).toHaveAttribute('data-href', '/fcs/pda/exec/TASK-WOOL-STAGE-001:LINKING')
  await expect(entry).not.toContainText('纱线')
  await expect(entry).not.toContainText('等待横机填报同步')
})
