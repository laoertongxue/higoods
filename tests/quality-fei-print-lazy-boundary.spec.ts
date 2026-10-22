import { expect, test, type Page } from '@playwright/test'

// Adjacent contract for the cutting imports moved behind the actual FEI path.
// Preparation invokes the existing manual-ticket command with a declared isolated
// marker fixture resolved against the unchanged formal order and technical parts.
// The measured preview actions use real UI/native transactions; no provider is replaced.
test.use({ viewport: { width: 1366, height: 768 } })

async function cuttingState(page: Page) {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(row => row.name === 'higood-cutting-records-v1')) throw Error('原业务尚未创建裁床记录库')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-cutting-records-v1')
      request.onupgradeneeded = () => { request.transaction!.abort(); reject(Error('只读取证不得创建库')) }
      request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result)
    })
    try {
      const names = [...db.objectStoreNames].sort()
      const stores = await new Promise<Array<{ name: string; rows: any[] }>>((resolve, reject) => {
        const tx = db.transaction(names, 'readonly'), requests = names.map(name => ({ name, request: tx.objectStore(name).getAll() }))
        tx.oncomplete = () => resolve(requests.map(row => ({ name: row.name, rows: row.request.result })))
        tx.onabort = () => reject(tx.error)
      })
      const hash = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('')
      const normalize = async (value: any): Promise<any> => {
        if (value instanceof Blob) return { size: value.size, type: value.type, sha256: await hash(await value.arrayBuffer()) }
        if (Array.isArray(value)) return Promise.all(value.map(normalize))
        if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.keys(value).sort().map(async key => [key, await normalize(value[key])])))
        return value
      }
      return { records: stores.find(row => row.name === 'records')!.rows, fingerprint: await hash(new TextEncoder().encode(JSON.stringify(await normalize(stores))).buffer) }
    } finally { db.close() }
  })
}

test('菲票延迟入口：原命令建票、首打事务失败不打印、重试一次保存、补打原因与原生回读', async ({ context, page }, info) => {
  test.setTimeout(180000)
  await context.addInitScript(() => {
    ;(window as any).__name = (value: unknown) => value
    const probe = { failId: '', injected: false, transactions: [] as any[], printCalls: [] as any[] }
    ;(window as any).__qualityFeiProbe = probe
    const transaction = IDBDatabase.prototype.transaction, put = IDBObjectStore.prototype.put
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof transaction>) {
      const tx = transaction.apply(this, args)
      if (this.name === 'higood-cutting-records-v1' && tx.mode === 'readwrite') {
        const row = { stores: [...tx.objectStoreNames], status: 'pending', at: performance.now(), end: 0 }
        probe.transactions.push(row)
        tx.addEventListener('complete', () => { row.status = 'complete'; row.end = performance.now() })
        tx.addEventListener('abort', () => { row.status = 'abort'; row.end = performance.now() })
      }
      return tx
    }
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const request = put.apply(this, args)
      if (this.transaction.db.name === 'higood-cutting-records-v1' && this.name === 'records' && probe.failId && args[0]?.id === probe.failId) {
        probe.injected = true; probe.failId = ''
        const tx = this.transaction
        request.addEventListener('success', () => tx.abort(), { once: true })
      }
      return request
    }
    window.print = () => probe.printCalls.push({ at: performance.now(), transactions: structuredClone(probe.transactions) })
  })
  const errors: string[] = []
  context.on('page', current => current.on('pageerror', error => errors.push(error.message)))
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('button', { name: '手动增加打印菲票', exact: true })).toBeVisible()
  // The old catalog's 008 marker has no formal source order; 001 has no
  // eligible part rows. Do not weaken either original creation gate. The
  // adjacent printing contract instead prepares this explicit fixture using
  // the normal command and its unchanged formal-source validation.
  await page.evaluate(async () => {
    // Native Vite module identity includes its actual source-version query.
    // Reuse the same owner as the real page, including its transaction stage.
    const loaded=(path:string)=>performance.getEntriesByType('resource').map(row=>row.name).filter(url=>new URL(url).pathname===path).at(-1) || path
    const { savePartTicketAction } = await import(loaded('/src/data/fcs/cutting/part-ticket-records.ts'))
    const { createManualFeiTicketBatch } = await import(loaded('/src/data/fcs/cutting/manual-fei-tickets.ts'))
    const { productionOrders } = await import('/src/data/fcs/production-orders.ts')
    const order = productionOrders.find(row => row.productionOrderId === 'PO-202603-0004')!
    if (!order) throw Error('隔离票据仍须具有现有正式生产单')
    const markerPlan: any = {
      id: 'QUALITY-FEI-ADJACENT-MARKER', markerPlanId: 'QUALITY-FEI-ADJACENT-MARKER',
      markerPlanNo: 'QUALITY-FEI-ADJACENT-MARKER', markerNo: 'QUALITY-FEI-ADJACENT-MARKER',
      spuCode: order.demandSnapshot.spuCode, styleName: order.demandSnapshot.spuName,
      techPackSpu: order.demandSnapshot.spuCode, techPackVersion: 'V1',
      cutOrderIds: ['QUALITY-FEI-ADJACENT-CUT'], cutOrderNos: ['QUALITY-FEI-ADJACENT-CUT'],
      productionOrderIds: [order.productionOrderId], productionOrderNos: [order.productionOrderNo],
      selectedSourceCutOrderRows: [],
      pieceExplosionRows: [{ id: 'QUALITY-FEI-ADJACENT-M-FRONT',
        sourceProductionOrderId: order.productionOrderId, sourceProductionOrderNo: order.productionOrderNo,
        sourceCutOrderId: 'QUALITY-FEI-ADJACENT-CUT', sourceCutOrderNo: 'QUALITY-FEI-ADJACENT-CUT',
        colorCode: 'Black', sizeCode: 'M', skuCode: 'SKU-010-M-BLK',
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
        partCode: '前片', partNameCn: '前片', piecePerGarment: 1 }],
    }
    await savePartTicketAction({ intent: 'QUALITY-FEI-ADJACENT-PREPARATION', action: () =>
      createManualFeiTicketBatch({ markerPlan, markerMember: { bedId: 'QUALITY-FEI-ADJACENT-MEMBER', bedNo: 'A-1', colorCode: 'Black', materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill' } as any,
        layerCount: 2, sizePiecePerLayer: { M: 1 }, createdBy: '隔离相邻打印验收' }) })
  })
  const created = await cuttingState(page)
  const sourceRow = created.records.find(row => row.collection === 'part-ticket:manual-records' && row.value.sourceBasisType === 'MANUAL_MARKER_PLAN')
  expect(sourceRow, '原命令必须保存有正式生产单及技术部位依据的手动票').toBeTruthy()
  const ticket = sourceRow.value
  expect(['PO-202603-0004', 'PO-202603-0102']).toContain(ticket.productionOrderNo)
  expect(ticket.qrPayload.productionOrderNo).toBe(ticket.productionOrderNo)
  expect(ticket.manualPrintHistory || []).toHaveLength(0)
  const paperColor = ticket.hasSpecialCraft ? 'YELLOW' : 'WHITE'
  const templateCode = ticket.hasSpecialCraft ? 'FEI_TICKET_YELLOW_THERMAL' : 'FEI_TICKET_WHITE_THERMAL'
  const path = `/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(ticket.feiTicketId)}&paperColor=${paperColor}`
  const preview = await context.newPage()
  await page.close()
  await preview.goto(path)
  await expect(preview.locator('.print-label-paper').first()).toBeVisible()
  await expect(preview.locator('body')).toContainText(ticket.hasSpecialCraft ? '黄色热敏纸' : '白色热敏纸')
  expect((await cuttingState(preview)).fingerprint).toBe(created.fingerprint)
  const beforeFailure = await cuttingState(preview)
  await preview.evaluate(id => { (window as any).__qualityFeiProbe.failId = id }, sourceRow.id)
  const print = preview.locator('.print-preview-toolbar [data-print-preview-action="print"]')
  await print.click()
  await expect.poll(async () => ({
    injected: await preview.evaluate(() => (window as any).__qualityFeiProbe.injected),
    printCalls: await preview.evaluate(() => (window as any).__qualityFeiProbe.printCalls.length),
    errors,
  })).toEqual({ injected: true, printCalls: 0, errors: [] })
  await expect(preview.locator('[data-print-ready-feedback]')).toContainText('尚未保存打印记录')
  let probe = await preview.evaluate(() => (window as any).__qualityFeiProbe)
  expect(probe.injected).toBe(true)
  expect(probe.transactions.some((row: any) => row.status === 'abort')).toBe(true)
  expect(probe.printCalls).toEqual([])
  expect((await cuttingState(preview)).fingerprint).toBe(beforeFailure.fingerprint)
  await print.click()
  await expect.poll(() => preview.evaluate(() => (window as any).__qualityFeiProbe.printCalls.length)).toBe(1)
  probe = await preview.evaluate(() => (window as any).__qualityFeiProbe)
  expect(probe.printCalls[0].transactions.at(-1).status).toBe('complete')
  expect(probe.printCalls[0].transactions.at(-1).end).toBeLessThanOrEqual(probe.printCalls[0].at)
  const firstPrint = await cuttingState(preview)
  const firstSaved = firstPrint.records.find(row => row.id === sourceRow.id)!.value
  expect(firstSaved.manualPrintHistory).toHaveLength(1)
  expect(firstSaved.manualPrintHistory[0]).toEqual(expect.objectContaining({ action: 'PRINT', paperColor, templateCode }))
  await info.attach('native-first-print-rollback-retry', { body: JSON.stringify({ ticketId: ticket.feiTicketId, sourceRowId: sourceRow.id, fingerprintBefore: beforeFailure.fingerprint, firstSaved, probe }, null, 2), contentType: 'application/json' })
  const reprintBase = `/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(ticket.feiTicketId)}&paperColor=${paperColor}`
  await preview.goto(reprintBase)
  await expect(preview.locator('body')).toContainText('手动菲票补打必须填写补打原因')
  expect((await cuttingState(preview)).fingerprint).toBe(firstPrint.fingerprint)
  const reason = '隔离原菲票破损，核对后补打'
  await preview.goto(reprintBase + '&reason=' + encodeURIComponent(reason))
  await expect(preview.locator('.print-label-paper').first()).toBeVisible()
  await expect(preview.locator('body')).toContainText('补打原因：' + reason)
  await preview.locator('.print-preview-toolbar [data-print-preview-action="print"]').click()
  await expect.poll(() => preview.evaluate(() => (window as any).__qualityFeiProbe.printCalls.length)).toBe(1)
  const reprinted = await cuttingState(preview)
  const lastSaved = reprinted.records.find(row => row.id === sourceRow.id)!.value
  expect(lastSaved.manualPrintHistory).toHaveLength(2)
  expect(lastSaved.manualPrintHistory[1]).toEqual(expect.objectContaining({ action: 'REPRINT', reason, paperColor, templateCode }))
  await preview.reload()
  await expect(preview.locator('.print-label-paper').first()).toBeVisible()
  expect((await cuttingState(preview)).fingerprint).toBe(reprinted.fingerprint)
  expect((await preview.evaluate(() => (window as any).__qualityFeiProbe)).printCalls).toEqual([])
  expect(errors).toEqual([])
  await info.attach('native-reprint-cold-refresh', { body: JSON.stringify({ reprintBase, reason, lastSaved, nativeFingerprint: reprinted.fingerprint, errors }, null, 2), contentType: 'application/json' })
})
