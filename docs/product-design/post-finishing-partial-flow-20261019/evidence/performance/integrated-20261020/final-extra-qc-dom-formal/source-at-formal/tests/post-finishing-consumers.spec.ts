import { test, expect, type Page } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const root = process.env.POST_FINISHING_EVIDENCE_ROOT || 'docs/product-design/post-finishing-partial-flow-20261019/evidence'
const evidence = `${root}/consumers`
// Reuse the persisted result of the public-command + actual-UI D1 acceptance.
// No synthetic downstream facts are made by this consumer/printing suite.
const actual = JSON.parse(readFileSync(`${root}/partial-flow-e2e/d1-final-persistent-readback.json`, 'utf8'))
const actualCorrection = JSON.parse(readFileSync(`${root}/partial-flow-e2e/web-delegation-correction-readback.json`, 'utf8'))
const namespace = 'higood-fcs-post-finishing-records'
async function restoreActual(page: Page) {
  await page.goto('/fcs/craft/post-finishing/work-orders')
  await expect(page.locator('main h1')).toHaveText('后道加工单')
  await page.evaluate(async ({ rows, ns }) => {
    const records = await import('/src/data/fcs/post-finishing-records.ts')
    await records.importPostFinishingBackup(new File([JSON.stringify({ format: ns, version: 2, records: rows, files: [] })], 'D1-actual-ui-result.json'))
  }, { rows: actual.stored, ns: namespace })
}
async function imagesReady(page: Page) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('main img,.print-preview-root img')).every(img => img.complete))
}
test.beforeAll(() => mkdirSync(evidence, { recursive: true }))

test('A15/A23: second and third children retain identities through search, details and both print entries', async ({ page }) => {
  await restoreActual(page)
  const siblings = actual.rechecks.sort((a: any,b: any) => a.sequence-b.sequence)
  const second = siblings[1]
  const third = actual.outbounds.find((row: any) => row.recheckOrderId === siblings[2].recheckOrderId)
  await page.goto(`/fcs/craft/post-finishing/audit-records?keyword=${encodeURIComponent(second.recheckOrderNo)}`)
  await page.getByText('查看详情', { exact: true }).click()
  await expect(page.locator('[data-audit-selected-child]')).toContainText(second.recheckOrderNo)
  for (const row of siblings) await expect(page.locator('[data-audit-chain-detail]')).toContainText(row.recheckOrderNo)
  await page.getByRole('link', { name: '操作时间线', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('keyword')).toBe(second.recheckOrderNo)
  await page.getByRole('link', { name: '业务链总览', exact: true }).click()
  await page.locator('[data-audit-selected-child] a').click()
  await expect(page.locator('body')).toContainText(second.recheckOrderNo)
  await page.goto(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(third.outboundOrderId)}`)
  await expect(page.locator('body')).toContainText(third.outboundOrderNo)
  await expect(page.locator('body')).toContainText('800')
  await page.goto(`/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(third.outboundOrderId)}`)
  await expect(page.locator('[data-print-document-no]')).toHaveAttribute('data-print-document-no', third.outboundOrderNo)
  await imagesReady(page)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: `${evidence}/third-outbound-specialized.pdf`, format: 'A4', printBackground: true })
  for (const documentType of ['POST_FINISHING_OUTBOUND_ORDER','POST_FINISHING_OUTBOUND_BARCODE']) {
    await page.goto(`/fcs/print/preview?documentType=${documentType}&sourceType=POST_FINISHING_OUTBOUND_ORDER&sourceId=${encodeURIComponent(third.outboundOrderId)}`)
    await expect(page.locator('.print-preview-root')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('未找到后道出货单')
    if (documentType.endsWith('BARCODE')) {
      await expect(page.locator('.online-sku-barcode')).toHaveCount(800)
      const count = await page.locator('.online-sku-barcode').count()
      const content = await page.locator('body').innerText()
      writeFileSync(`${evidence}/generic-label-content.json`, JSON.stringify({ count, text: content.slice(0, 800) }))
      const result = await page.evaluate(async id => {
        const t = await import('/src/pages/print/templates/post-finishing-outbound-template.ts')
        const d = t.buildPostFinishingOutboundBarcodePrintDocument({ documentType: 'POST_FINISHING_OUTBOUND_BARCODE', sourceType: 'POST_FINISHING_OUTBOUND_ORDER', sourceId: id })
        return { count: d.totalCopies, values: [...new Set(d.labelItems!.map(row => row.barcode!.value))] }
      }, third.outboundOrderId)
      expect(result.count).toBe(800)
      expect(result.values).toEqual(third.lines.map((row: any) => row.sku.barcode))
    } else {
      await expect(page.locator('body')).toContainText(third.outboundOrderNo)
      await expect(page.locator('body')).toContainText(actual.delivery.managedPostFactoryName)
      await imagesReady(page)
      await page.pdf({ path: `${evidence}/third-outbound-generic.pdf`, format: 'A4', printBackground: true })
    }
  }
  for (const type of ['OUTBOUND_BARCODE','OUTBOUND_HANGTAG']) {
    await page.goto(`/fcs/craft/post-finishing/print?type=${type}&id=${encodeURIComponent(actual.outbounds.find((row: any) => row.recheckOrderId === second.recheckOrderId).outboundOrderId)}`)
    await expect(page.locator('[data-outbound-unit-label]')).toHaveCount(100)
    if (type === 'OUTBOUND_BARCODE') {
      const clipped = await page.locator('[data-outbound-unit-label]').first().evaluate(el => {
        const parent=el.getBoundingClientRect(), text=el.lastElementChild!.getBoundingClientRect()
        return text.bottom > parent.bottom || text.top < el.querySelector('svg')!.getBoundingClientRect().bottom
      })
      expect(clipped).toBe(false)
    }
    await imagesReady(page)
    await page.pdf({ path: `${evidence}/second-${type.toLowerCase()}.pdf`, format: 'A4', printBackground: true })
  }
  await page.goto(`/fcs/craft/post-finishing/print?type=POST_ORDER&id=${encodeURIComponent(actual.task.postTaskId)}`)
  for (const row of siblings) await expect(page.locator('body')).toContainText(row.recheckOrderNo)
  await imagesReady(page)
  await page.pdf({ path: `${evidence}/parent-specialized.pdf`, format: 'A4', printBackground: true })
  await page.goto(`/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=POST_FINISHING_WORK_ORDER&sourceId=${encodeURIComponent(actual.task.postTaskId)}`)
  await expect(page.locator('.print-preview-root')).toBeVisible()
  for (const row of siblings) await expect(page.locator('body')).toContainText(row.recheckOrderNo)
  const amounts = await page.evaluate(async id => {
    const t = await import('/src/pages/print/templates/post-finishing-route-card-template.ts')
    const document=t.buildPostFinishingRouteCardPrintDocument({ documentType:'TASK_ROUTE_CARD', sourceType:'POST_FINISHING_WORK_ORDER', sourceId:id })
    const fields=document.sections.flatMap(section=>section.fields || [])
    return Object.fromEntries(fields.filter(row=>['待处理后交出复核成衣件数','待交出成衣件数','实收成衣件数'].includes(row.label)).map(row=>[row.label,Number(row.value.replace(/[^0-9]/g,''))]))
  },actual.task.postTaskId)
  expect(amounts).toEqual({ '待处理后交出复核成衣件数':0, '待交出成衣件数':0, '实收成衣件数':1000 })
  await imagesReady(page)
  await page.pdf({ path: `${evidence}/parent-generic.pdf`, format: 'A4', printBackground: true })
  // A separate layout-only fixture expands the reviewed 5 SKU rows to force
  // a real multi-page A4 table. It never saves or claims extra business facts.
  await page.goto(`/fcs/craft/post-finishing/print?type=POST_ORDER&id=${encodeURIComponent(actual.task.postTaskId)}`)
  await expect(page.locator('[data-print-sheet] table tbody')).toBeVisible()
  await page.evaluate(() => {
    const body=document.querySelector('table tbody')!, originals=[...body.children]
    for(let i=0;i<35;i++)body.appendChild(originals[i%originals.length].cloneNode(true))
  })
  await imagesReady(page)
  await page.pdf({ path: `${evidence}/multi-sku-pagination-layout-only.pdf`, format: 'A4', printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  await page.goto('/fcs/craft/post-finishing/statistics')
  await expect(page.locator('main h1')).toHaveText('后道统计')
  const source = await page.evaluate(async () => {
    const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
    return { parents: f.listPostFinishingFullFlowPostTasks().map(row => row.postTaskId),
      outbounds: f.listPostFinishingFullFlowOutboundOrders().map(row => ({ id: row.outboundOrderId, qty: row.lines.reduce((sum, line) => sum + line.outboundQty, 0), received: row.lines.reduce((sum, line) => sum + (line.receivedQty || 0), 0) })) }
  })
  expect(source.parents).toEqual([actual.task.postTaskId])
  expect(source.outbounds.map(row => row.id).sort()).toEqual(actual.outbounds.map((row: any) => row.outboundOrderId).sort())
  expect(source.outbounds.reduce((sum, row) => sum + row.qty, 0)).toBe(1000)
  expect(source.outbounds.reduce((sum, row) => sum + row.received, 0)).toBe(1000)
  const metricValues: Record<string, number> = {}
  for (const [label, expected] of [
    ['后道完成成衣件数', 1000], ['处理后复核确认成衣件数', 1000],
    ['已生成出货件数', 1000], ['成衣仓实收件数', 1000], ['待成衣仓接收件数', 0],
    ['已完成实收出货单数', 3], ['待实收出货单数', 0],
  ] as const) {
    const card = page.locator('article').filter({ has: page.getByText(label, { exact: true }) })
    await expect(card).toHaveCount(1)
    const value = card.locator(':scope > div').nth(1)
    if (label.endsWith('件数')) await expect(value).toContainText('件')
    metricValues[label] = Number((await value.innerText()).replace(/[^0-9-]/g, ''))
    expect(metricValues[label], label).toBe(expected)
  }
  writeFileSync(`${evidence}/statistics-d1-100-100-800.json`, JSON.stringify({ source, metrics: metricValues }, null, 2))
  await page.screenshot({ path: `${evidence}/statistics-d1-100-100-800.png`, fullPage: true })
})

test('A16/A18/A24/A26: direct consumer routes, viewports and object images retain actual multi-child results', async ({ page }) => {
  await restoreActual(page)
  // The three actual D1 outbounds share one SKU and location. Check the
  // displayed aggregate and every source, rather than only the stored rows.
  const batches = actual.stored.filter((row: any) => row.collection === 'flow/waitHandoverWarehouseRecords').map((row: any) => row.value)
  expect(batches).toHaveLength(3)
  expect(batches.map((row: any) => row.lines[0].inboundQty).sort((a: number,b: number) => a-b)).toEqual([100,100,800])
  const location = batches[0].locationCode, sku = batches[0].lines[0].sku
  expect(batches.every((row: any) => row.locationCode === location && row.lines.length === 1 && row.lines[0].sku.skuId === sku.skuId)).toBe(true)
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=locations')
  const locationRow = page.locator('tbody tr').filter({ has: page.getByText(location, { exact: true }) })
  await expect(locationRow).toHaveCount(1)
  const sourceNos = await locationRow.locator('td').nth(2).locator('div.font-mono').allTextContents()
  expect(sourceNos.sort()).toEqual(batches.map((row: any) => row.outboundOrderNo).sort())
  await expect(locationRow.locator('td').nth(3)).toHaveText('1000 / 0 / 1000')
  await page.screenshot({ path: `${evidence}/same-location-three-sources.png`, fullPage: true })
  await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory')
  await page.locator('[data-post-finishing-field="warehouse-availability"]').selectOption('all')
  await page.locator('[data-post-finishing-field="warehouse-keyword"]').fill(sku.skuCode)
  await page.locator('[data-post-finishing-action="full-flow-query"]').click()
  const inventoryRow = page.locator('tbody tr').filter({ hasText: sku.skuCode })
  await expect(inventoryRow).toHaveCount(1)
  await inventoryRow.getByRole('button', { name: '库存明细' }).click()
  const drawer = page.locator(`[data-warehouse-inventory-drawer="${sku.skuId}"]`)
  await expect(drawer).toBeVisible()
  await expect(drawer.locator(':scope > div').nth(1).locator('strong')).toHaveText(['1000 件','0 件','1000 件'])
  await expect(drawer.locator('[data-warehouse-batch]')).toHaveCount(3)
  expect((await drawer.locator('[data-warehouse-batch]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-warehouse-batch')))).sort()).toEqual(batches.map((row: any) => row.warehouseRecordId).sort())
  for (const batch of batches) {
    const card = drawer.locator(`[data-warehouse-batch="${batch.warehouseRecordId}"]`)
    await expect(card).toContainText(location)
    await expect(card).toContainText(batch.outboundOrderNo)
    await expect(card).toContainText('已交出')
    await expect(card.locator(':scope > div').nth(1).locator('strong')).toHaveText([`${batch.lines[0].inboundQty} 件`,'0 件',`${batch.lines[0].handedOverQty} 件`])
  }
  writeFileSync(`${evidence}/same-location-three-sources-dom.json`, JSON.stringify({ sourceNos, location, expected: batches, actualDrawerText: await drawer.innerText() }, null, 2))
  await page.screenshot({ path: `${evidence}/same-location-three-source-details.png`, fullPage: true })
  const paths = ['qc-orders','work-orders','recheck-orders','outbound-orders','warehouse','tasks','audit-records']
  for (const width of [1366,1280,1024]) {
    await page.setViewportSize({ width, height: width===1024 ? 768 : 720 })
    for (const path of paths) {
      await page.goto(`/fcs/craft/post-finishing/${path}`)
      await expect(page.locator('main h1')).toBeVisible()
      await expect(page.locator('main')).not.toContainText('后道用户资料无法读取')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await imagesReady(page)
    }
  }
  await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(actual.task.postTaskId)}`)
  await expect(page.locator('[data-web-post-task]')).toContainText('1000')
  const image = page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first()
  const url = await image.getAttribute('data-image-url')
  expect(actual.task.lines.some((line: any) => line.sku.imageUrl === url)).toBe(true)
  await image.click()
  await expect(page.locator('[data-post-image-overlay]')).toBeVisible()
  await expect(page.locator('[data-post-image-overlay] img')).toHaveJSProperty('naturalWidth', await image.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth))
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-post-image-overlay]')).toHaveCount(0)
  await page.route(url!, route => route.abort('failed'))
  // A cache-bypassed URL is used only as the broken image test input.
  await image.evaluate(el => el.setAttribute('data-image-url', `${el.getAttribute('data-image-url')}?acceptance-broken=1`))
  await page.route(`${url}?acceptance-broken=1`, route => route.abort('failed'))
  await image.click()
  await expect(page.locator('[data-post-image-status]')).toContainText('图片加载失败')
  await page.unroute(`${url}?acceptance-broken=1`)
  await page.unroute(url!)
  await page.locator('[data-post-image-retry]').click()
  await expect(page.locator('[data-post-image-status]')).toBeHidden()
  await page.getByRole('button', { name: '关闭图片', exact: true }).click()
  await image.click()
  await page.locator('[data-post-image-overlay]').click({ position: { x: 2, y: 2 } })
  await expect(page.locator('[data-post-image-overlay]')).toHaveCount(0)
  await page.screenshot({ path: `${evidence}/completed-parent-1024.png`, fullPage: true })
})

test('A22: restored new facts reject overquantity, duplicate intent and forged recheck reservation', async ({ page }) => {
  await restoreActual(page)
  const results = await page.evaluate(async ns => {
    const r = await import('/src/data/fcs/post-finishing-records.ts')
    const db = await import('/src/data/pcs-record-db.ts')
    const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
    const before = JSON.stringify((await db.readPcsRecords([ns])).records)
    const original = backup.records.find((row: any) => row.collection === 'flow/processCompletions' && !row.deleted)
    const recheck = backup.records.find((row: any) => row.collection === 'flow/recheckOrders' && !row.deleted)
    const errors: string[] = []
    for (const kind of ['duplicate-operation','overquantity','negative-recheck','foreign-sku']) {
      const extra = structuredClone(kind.includes('recheck') || kind === 'foreign-sku' ? recheck : original)
      const id = `INVALID-${kind}`
      extra.id = extra.id.replace(/[^/]+$/, id)
      if (extra.collection === 'flow/processCompletions') {
        extra.value.recordId = id
        if (kind === 'overquantity') { extra.value.operationId=id; extra.value.quantities[0].quantity=1001 }
      } else {
        extra.value.recheckOrderId=id; extra.value.recheckOrderNo=id; extra.value.operationId=id
        if (kind === 'negative-recheck') extra.value.lines[0].expectedQty=-100
        else extra.value.lines[0].sku.skuId='FOREIGN'
      }
      try { await r.importPostFinishingBackup(new File([JSON.stringify({ ...backup, records: [...backup.records, extra] })], 'bad.json')); errors.push('UNEXPECTED_SUCCESS') }
      catch(e) { errors.push(String(e)) }
    }
    const actorErrors: string[] = []
    for (const field of ['responsible', 'recordedBy'] as const) {
      for (const variant of ['empty-name', 'whitespace-name', 'qc-role']) {
        const forged = structuredClone(backup)
        const completion = forged.records.find((row: any) => row.id === original.id)
        if (variant === 'qc-role') completion.value[field].roleName = '后道质检员'
        else completion.value[field].actorName = variant === 'empty-name' ? '' : '   '
        try { await r.importPostFinishingBackup(new File([JSON.stringify(forged)], `bad-${field}-${variant}.json`)); actorErrors.push('UNEXPECTED_SUCCESS') }
        catch(error) { actorErrors.push(`${field}:${variant}:${String(error)}`) }
      }
    }
    return { errors, actorErrors, unchanged: before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  }, namespace)
  expect(results.errors).toHaveLength(4)
  expect(results.errors).not.toContain('UNEXPECTED_SUCCESS')
  expect(results.actorErrors).toHaveLength(6)
  expect(results.actorErrors.every(error => error.includes('身份不完整'))).toBe(true)
  expect(results.unchanged).toBe(true)
  // Use a fresh target for each otherwise-valid full D1 backup. Changing an
  // existing target would only prove conflict rejection and hide a missing
  // candidate relationship/quantity validator.
  const relationResults: Array<{ kind: string; error: string; unchanged: boolean; inputRetained: boolean }> = []
  for (const kind of [
    'outbound-overquantity', 'duplicate-outbound-recheck', 'outbound-foreign-parent', 'outbound-foreign-sku',
    'outbound-foreign-delivery', 'outbound-foreign-qc', 'handover-overquantity', 'receipt-overquantity',
    'duplicate-receipt-outbound', 'correction-foreign-responsible', 'correction-foreign-original-sku',
    'post-over-qc', 'completed-recheck-unscanned', 'outbound-forged-barcode',
    'downstream-forged-barcode-chain',
  ]) {
    const isolated = await page.context().browser()!.newContext()
    try {
      const candidate = await isolated.newPage()
      await candidate.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/audit-records`)
      await expect(candidate.locator('main h1')).toHaveText('差异与操作日志')
      const prepared = await candidate.evaluate(async ({ ns, rows, kind }) => {
        const db = await import('/src/data/pcs-record-db.ts')
        const forged = { format: ns, version: 2, records: structuredClone(rows), files: [] }
        const id = `INVALID-${kind}`
        if (kind.startsWith('correction-')) {
          const correction = forged.records.find((row: any) => row.collection === 'flow/processCompletions' && !row.deleted && row.value.correctionOf)!
          const original = forged.records.find((row: any) => row.collection === 'flow/processCompletions' && !row.deleted && row.value.recordId === correction.value.correctionOf)!
          if (kind === 'correction-foreign-responsible') correction.value.responsible = structuredClone(original.value.recordedBy)
          else {
            const parent = forged.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted && row.value.postTaskId === original.value.postTaskId)!
            const foreign = parent.value.lines.find((line: any) => !original.value.quantities.some((source: any) => source.skuId === line.sku.skuId))!
            // A zero delta keeps every aggregate unchanged but is outside the
            // original record's SKU set, which the live correction API rejects.
            correction.value.quantities.push({ skuId: foreign.sku.skuId, quantity: 0 })
          }
        } else {
          const out = forged.records.find((row: any) => row.collection === 'flow/outboundOrders' && !row.deleted && row.value.lines.some((line: any) => line.outboundQty === 800))!
          if (kind === 'outbound-overquantity') out.value.lines[0].outboundQty = 801
          else if (kind === 'post-over-qc') {
            const parent = forged.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted && row.value.postTaskId === out.value.postTaskId)!
            parent.value.lines.find((line: any) => line.expectedQty === 1000).expectedQty = 1001
          } else if (kind === 'completed-recheck-unscanned') {
            const recheck = forged.records.find((row: any) => row.collection === 'flow/recheckOrders' && !row.deleted && row.value.recheckOrderId === out.value.recheckOrderId)!
            recheck.value.lines[0].barcodeStatus = '未扫描'
          } else if (kind === 'outbound-forged-barcode') out.value.lines[0].sku.barcode = 'FORGED-OUTBOUND-BARCODE'
          else if (kind === 'downstream-forged-barcode-chain') {
            // Keep every downstream copy equal while the frozen parent/QC SKU
            // remains unchanged: source identity must be checked at that edge.
            for (const row of forged.records.filter((row: any) => ['flow/recheckOrders', 'flow/outboundOrders', 'flow/waitHandoverWarehouseRecords', 'flow/warehouseReceipts'].includes(row.collection) && !row.deleted)) {
              for (const line of row.value.lines) if (line.sku.skuId === out.value.lines[0].sku.skuId) line.sku.barcode = 'FORGED-DOWNSTREAM-BARCODE'
            }
          }
          else if (kind === 'duplicate-outbound-recheck') {
            const duplicate = structuredClone(out)
            duplicate.id = duplicate.id.replace(/[^/]+$/, id)
            duplicate.value.outboundOrderId = id
            duplicate.value.outboundOrderNo = id
            forged.records.push(duplicate)
          } else if (kind === 'outbound-foreign-parent') out.value.postTaskId = 'FOREIGN-POST'
          else if (kind === 'outbound-foreign-sku') out.value.lines[0].sku.skuId = 'FOREIGN-SKU'
          else if (kind === 'outbound-foreign-delivery') out.value.deliveryId = 'FOREIGN-DELIVERY'
          else if (kind === 'outbound-foreign-qc') out.value.qcTaskId = 'FOREIGN-QC'
          else if (kind === 'handover-overquantity') {
            const handover = forged.records.find((row: any) => row.collection === 'flow/waitHandoverWarehouseRecords' && !row.deleted && row.value.outboundOrderId === out.value.outboundOrderId)!
            handover.value.lines[0].inboundQty = 801
          } else {
            const receipt = forged.records.find((row: any) => row.collection === 'flow/warehouseReceipts' && !row.deleted && row.value.outboundOrderId === out.value.outboundOrderId)!
            if (kind === 'receipt-overquantity') receipt.value.lines[0].receivedQty = 801
            else {
              const duplicate = structuredClone(receipt)
              duplicate.id = duplicate.id.replace(/[^/]+$/, id)
              duplicate.value.receiptId = id
              forged.records.push(duplicate)
            }
          }
        }
        return { forged, before: JSON.stringify((await db.readPcsRecords([ns])).records) }
      }, { ns: namespace, rows: kind.startsWith('correction-') ? actualCorrection.stored : actual.stored, kind })
      const input = candidate.locator('[data-post-finishing-field="storage-import"]')
      const originalInput = await input.elementHandle()
      expect(originalInput).not.toBeNull()
      await input.setInputFiles({ name: `bad-${kind}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(prepared.forged)) })
      const error = candidate.locator('[data-post-finishing-action-error]')
      // Either failure preserves the selected file, or an unexpected successful
      // restore replaces the input. The latter must fail the business assertion.
      await expect.poll(async () => await error.count() > 0 || await originalInput!.evaluate(node => !node.isConnected)).toBe(true)
      relationResults.push({ kind, error: await error.count() ? await error.innerText() : 'UNEXPECTED_SUCCESS',
        unchanged: prepared.before === await candidate.evaluate(async ns => JSON.stringify((await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records), namespace),
        inputRetained: await originalInput!.evaluate(node => node.isConnected && (node as HTMLInputElement).files?.length === 1) })
    } finally { await isolated.close() }
  }
  // Save the red/green evidence before assertions so a forged restore that was
  // accepted is retained as a real failure instead of lost at the first check.
  writeFileSync(`${evidence}/restore-adversarial.json`, JSON.stringify({ ...results, relationResults }, null, 2))
  expect(relationResults.map(row => `${row.kind}:${row.error}`)).not.toEqual(expect.arrayContaining([expect.stringContaining('UNEXPECTED_SUCCESS')]))
  expect(relationResults.every(row => row.unchanged)).toBe(true)
  expect(relationResults.every(row => row.inputRetained)).toBe(true)

  const control = await page.context().browser()!.newContext()
  try {
    const valid = await control.newPage()
    await valid.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/audit-records`)
    await expect(valid.locator('main h1')).toHaveText('差异与操作日志')
    const input = valid.locator('[data-post-finishing-field="storage-import"]')
    const originalInput = await input.elementHandle()
    await input.setInputFiles({ name: 'B1-actual-valid-correction.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: namespace, version: 2, records: actualCorrection.stored, files: [] })) })
    await expect.poll(async () => await originalInput!.evaluate(node => !node.isConnected)).toBe(true)
    // The input event may render before the async change action finishes. The
    // completion endpoint is both the committed record and published read view.
    await expect.poll(() => valid.evaluate(async ({ ns, id }) => {
      const db = await import('/src/data/pcs-record-db.ts')
      const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
      return { persisted: (await db.readPcsRecords([ns])).records.some(row => row.collection === 'flow/postTasks' && !row.deleted && (row.value as any).postTaskId === id),
        published: f.listPostFinishingFullFlowPostTasks().some(row => row.postTaskId === id) }
    }, { ns: namespace, id: actualCorrection.task.postTaskId })).toEqual({ persisted: true, published: true })
    await expect(valid.locator('[data-post-finishing-action-error]')).toHaveCount(0)
    const restored = await valid.evaluate(async id => (await import('/src/data/fcs/post-finishing-full-flow.ts')).getPostFinishingProcessProgress(id), actualCorrection.task.postTaskId)
    expect(restored.records).toEqual(actualCorrection.progress.records)
    expect(restored.totalCompletedQty).toBe(actualCorrection.progress.totalCompletedQty)
    writeFileSync(`${evidence}/restore-valid-correction-control.json`, JSON.stringify(restored, null, 2))
  } finally { await control.close() }
})
