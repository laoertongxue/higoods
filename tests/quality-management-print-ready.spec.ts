import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { LEGACY_QC_MATERIAL_BINDINGS } from '../src/data/pcs-legacy-qc-demo-materials.ts'

// Only the browser's output boundary is observed. No product handler, print
// readiness helper, image decoder or business command is replaced by a test API.
// Each Playwright context is isolated. The fixture reads current formal demo
// facts from the actual loaded bridge; native IndexedDB is checked before/after.
// DOM removal below injects missing graphical output, never replacement codes.
interface PrintFixture {
  qcId: string
  qcNo: string
  productionOrderNo: string
  postId: string
  outboundId: string
  outboundNo: string
  outboundQuantities: Array<{ skuId: string; quantity: number }>
  moduleUrl: string
  fixture?: unknown
}
type ButtonKind = 'dedicated' | 'inner' | 'outer-print' | 'outer-pdf'
interface OutputCase {
  name: string
  path: (fixture: PrintFixture) => string
  selector: string
  button: ButtonKind
  labels?: boolean
}
const dedicated = (type: string, id: string) => `/fcs/craft/post-finishing/print?type=${type}&id=${encodeURIComponent(id)}`
const generic = (documentType: string, sourceType: string, sourceId: string) =>
  `/fcs/print/preview?documentType=${documentType}&sourceType=${sourceType}&sourceId=${encodeURIComponent(sourceId)}`
const outputs: OutputCase[] = [
  { name: '专用QC主单', path: f => dedicated('QC_ORDER', f.qcId), selector: '[data-testid="post-finishing-qc-master-print"]', button: 'dedicated' },
  { name: '专用QC详情单', path: f => dedicated('QC_DETAIL', f.qcId), selector: '[data-testid="post-finishing-qc-detail-print"]', button: 'dedicated' },
  ...(['inner', 'outer-print', 'outer-pdf'] as const).map(button => ({ name: `通用QC主单${button}`, path: (f: PrintFixture) => generic('PRODUCTION_QC_MASTER', 'POST_FINISHING_TASK', f.productionOrderNo), selector: '[data-testid="post-finishing-qc-master-print"]', button })),
  ...(['inner', 'outer-print', 'outer-pdf'] as const).map(button => ({ name: `通用QC详情单${button}`, path: (f: PrintFixture) => generic('POST_FINISHING_QC_ORDER', 'POST_FINISHING_QC_ORDER', f.qcId), selector: '[data-testid="post-finishing-qc-detail-print"]', button })),
  { name: '专用出货整单', path: f => dedicated('OUTBOUND', f.outboundId), selector: '[data-testid="post-finishing-full-flow-print"]', button: 'dedicated' },
  { name: '专用出货SKU条码', path: f => dedicated('OUTBOUND_BARCODE', f.outboundId), selector: '[data-testid="post-finishing-outbound-label-print"]', button: 'dedicated', labels: true },
  { name: '专用出货吊牌', path: f => dedicated('OUTBOUND_HANGTAG', f.outboundId), selector: '[data-testid="post-finishing-outbound-label-print"]', button: 'dedicated', labels: true },
  { name: '通用后道流转卡', path: f => generic('TASK_ROUTE_CARD', 'POST_FINISHING_WORK_ORDER', f.postId), selector: '.print-preview-root', button: 'outer-print' },
  { name: '通用后道出货整单', path: f => generic('POST_FINISHING_OUTBOUND_ORDER', 'POST_FINISHING_OUTBOUND_ORDER', f.outboundId), selector: '.print-preview-root', button: 'outer-print' },
  { name: '通用后道出货条码PDF按钮', path: f => generic('POST_FINISHING_OUTBOUND_BARCODE', 'POST_FINISHING_OUTBOUND_ORDER', f.outboundId), selector: '.print-preview-root', button: 'outer-pdf' },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(5000)
    const probe = { session: crypto.randomUUID(), calls: [] as unknown[] }
    ;(window as any).__printReadyProbe = probe
    window.print = () => {
      const root = document.querySelector('.print-preview-root, [data-post-print-ready-root]')!
      probe.calls.push({
        pathname: location.pathname + location.search,
        at: performance.now(),
        images: [...root.querySelectorAll<HTMLImageElement>('img')].map(img => ({ src: img.currentSrc || img.src, complete: img.complete, width: img.naturalWidth, height: img.naturalHeight, hidden: img.hidden, display: getComputedStyle(img).display })),
        barcodes: [...root.querySelectorAll('[data-real-barcode]')].map(node => ({ value: node.getAttribute('data-barcode-value'), rects: node.querySelectorAll('rect').length })),
        qrs: [...root.querySelectorAll('[data-real-qr]')].map(node => ({ value: node.getAttribute('data-qr-value'), svg: !!node.querySelector('svg') })),
      })
    }
  })
})

async function fixture(page: Page, completeMaterials: boolean | string = true): Promise<PrintFixture> {
  await page.goto('/fcs/craft/post-finishing/qc-orders')
  await expect(page.getByRole('heading', { name: '质检清单', exact: true })).toBeVisible()
  const source: PrintFixture = await page.evaluate(async completeMaterials => {
    const path = '/src/data/fcs/post-finishing-inventory-bridge.ts'
    const loaded = performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname === path)
    const moduleUrl = loaded.at(-1)?.name || path
    const bridge = await import(moduleUrl)
    const outbounds = bridge.listPostFinishingFullFlowOutboundOrders()
    const validOutbound = (row: any) => row.postTaskId && row.lines.length && row.lines.every((line: any) => line.sku.imageUrl && line.sku.barcode)
    const outbound = outbounds.find((row: any) => validOutbound(row) && (typeof completeMaterials !== 'string' || row.productionOrderNo === completeMaterials)) || (typeof completeMaterials === 'string' ? outbounds.find(validOutbound) : undefined)
    if (!outbound) throw Error('现有正式后道示例缺少关联加工、实际SKU图片及条码的出货；不制造替代对象。')
    const qc = typeof completeMaterials === 'string' ? bridge.listPostFinishingFullFlowQcTasks().find((row: any) => row.productionOrderNo === completeMaterials && row.sourceKind !== 'WAREHOUSE_STOCK') : bridge.getPostFinishingFullFlowQcTask(outbound.qcTaskId)
    if (!qc || qc.sourceKind === 'WAREHOUSE_STOCK' || !qc.productionOrderNo || !qc.lines.length) throw Error('正式出货缺少原生产QC关联，不能伪造生产身份。')
    const original = { qcId: qc.qcTaskId, qcNo: qc.qcTaskNo, productionOrderNo: qc.productionOrderNo, postId: outbound.postTaskId,
      outboundId: outbound.outboundOrderId, outboundNo: outbound.outboundOrderNo,
      outboundQuantities: outbound.lines.map((line: any) => ({ skuId: line.sku.skuId, quantity: line.outboundQty })), moduleUrl }
    if (completeMaterials !== true) return original
    // Additional formal four-SKU coverage remains separate from the three
    // original SPU-QC sources, each of which is positively checked below.
    const orderModule = await import('/src/data/fcs/production-orders.ts')
    const confirmation = await import('/src/data/fcs/production-confirmation.ts')
    const skuModule = await import('/src/data/pcs-sku-archive-repository.ts')
    const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
    const order = orderModule.productionOrders.find((row: any) => row.productionOrderId === 'PO-202603-082')
    if (!order) throw Error('缺少已核对正式卫衣生产单，不猜测资料。')
    const snapshot = confirmation.buildProductionConfirmationSnapshot(order.productionOrderId)
    if (!snapshot.bomSnapshot.length || snapshot.bomSnapshot.some((row: any) => !row.materialImageUrl)) throw Error('该正式生产单的原BOM仍缺图片，不能用fallback替代。')
    const archives = skuModule.listSkuArchives()
    const skus = order.demandSnapshot.skuLines.map((line: any) => {
      const archive = archives.find((row: any) => row.skuCode === line.skuCode && row.styleCode === order.demandSnapshot.spuCode && row.colorName === line.color && row.sizeName === line.size)
      if (!archive?.barcode || !archive.skuImageUrl) throw Error('正式SKU及款图/条码精确关联缺失。')
      return { skuId: archive.skuId, skuCode: archive.skuCode, spuCode: archive.styleCode, spuName: archive.styleName,
        colorName: archive.colorName, sizeName: archive.sizeName, barcode: archive.barcode, imageUrl: archive.skuImageUrl,
        plannedQty: line.qty, qtyUnit: '件' }
    })
    const originalDelivery = flow.getPostFinishingFactoryReturn(qc.deliveryId), originalPost = flow.getPostFinishingFullFlowPostTask(outbound.postTaskId)
    if (!originalDelivery || !originalPost || skus.length !== 4) throw Error('隔离记录缺少原格式模板或正式四SKU。')
    const now = '2026-10-22T01:00:00.000Z', quantity = 3, ns = 'higood-fcs-post-finishing-records'
    const deliveryId = 'QPRINT-DELIVERY', deliveryNo = 'QPRINT-RETURN-001', qcId = 'QPRINT-QC', qcNo = 'QPRINT-QC-001', postId = 'QPRINT-POST', postNo = 'QPRINT-POST-001', outId = 'QPRINT-OUT', outNo = 'QPRINT-OUT-001'
    const delivery = { ...structuredClone(originalDelivery), deliveryId, deliveryOrderNo: deliveryNo, productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo, returnIndex: 1, idempotencyKey: 'QPRINT-ISOLATED-RETURN', status: '已送检', qcTaskId: qcId, qcTaskNo: qcNo,
      sewingTaskNo: 'QPRINT-ISOLATED-SEW', executionTaskId: 'QPRINT-ISOLATED-EXECUTION',
      lines: skus.map((sku: any) => ({ sku, registeredQty: quantity, firstCountQty: quantity, confirmedQty: quantity, differenceQty: 0, differenceRate: 0 })),
      evidenceImageUrls: [skus[0].imageUrl], registeredAt: now, confirmedAt: now }
    const task = { ...structuredClone(qc), qcTaskId: qcId, qcTaskNo: qcNo, deliveryId, deliveryOrderNo: deliveryNo,
      productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, styleId: order.techPackSnapshot.styleId,
      sourceKind: 'PRODUCTION_RETURN', returnIndex: 1, status: '质检完成', createdAt: now, completedAt: now,
      inspection: undefined, referenceIds: [], independentChecks: [], postTaskId: postId, postTaskNo: postNo, outboundOrderId: undefined, outboundOrderNo: undefined,
      recheckOrderId: undefined, recheckOrderNo: undefined, frozenProcessItems: ['熨烫', '包装'],
      lines: skus.map((sku: any) => ({ sku, expectedQty: quantity })),
      results: skus.map((sku: any) => ({ sku, expectedQty: quantity, passedQty: quantity, defectQty: 0, returnQty: 0, uninspectedQty: 0, releasedQty: quantity })) }
    const post = { ...structuredClone(originalPost), postTaskId: postId, postTaskNo: postNo, deliveryId, deliveryOrderNo: deliveryNo,
      productionOrderNo: order.productionOrderNo, qcTaskId: qcId, qcTaskNo: qcNo, returnIndex: 1, executionModel: 'ITEMS_V1',
      processItems: ['熨烫', '包装'], status: '后道完成', startedAt: now, completedAt: now, lines: skus.map((sku: any) => ({ sku, expectedQty: quantity })),
      draftLines: undefined, results: undefined, legacyCarryover: undefined, recheckOrderId: undefined, recheckOrderNo: undefined }
    const prepared = { ...structuredClone(outbound), outboundOrderId: outId, outboundOrderNo: outNo, deliveryId, deliveryOrderNo: deliveryNo,
      productionOrderNo: order.productionOrderNo, qcTaskId: qcId, qcTaskNo: qcNo, postTaskId: postId, postTaskNo: postNo, returnIndex: 1,
      executionModel: 'DIRECT_V2', operationId: 'QPRINT-ISOLATED-PREPARED', status: '待出货', createdAt: now, dispatchedAt: undefined,
      dispatchedBy: undefined, receivedAt: undefined, receivedBy: undefined, recheckOrderId: undefined, recheckOrderNo: undefined,
      lines: skus.map((sku: any) => ({ sku, outboundQty: quantity })) }
    const stock = { warehouseRecordId: 'QPRINT-STOCK', deliveryId, deliveryOrderNo: deliveryNo, productionOrderNo: order.productionOrderNo,
      returnIndex: 1, qcTaskId: qcId, qcTaskNo: qcNo, postTaskId: postId, postTaskNo: postNo, responsibility: structuredClone(post.responsibility),
      sourceType: prepared.sourceType, outboundOrderId: outId, outboundOrderNo: outNo, areaName: '隔离打印待出货区', locationCode: 'QPRINT-01', status: '待交出',
      createdAt: now, createdBy: flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
      lines: skus.map((sku: any) => ({ sku, inboundQty: quantity, availableQty: quantity, handedOverQty: 0 })) }
    const rows = [
      { col: 'deliveries', id: deliveryId, value: delivery }, { col: 'qcTasks', id: qcId, value: task },
      { col: 'postTasks', id: postId, value: post }, { col: 'outboundOrders', id: outId, value: prepared },
      { col: 'waitHandoverWarehouseRecords', id: stock.warehouseRecordId, value: stock },
      ...post.processItems.map((processItem: string, index: number) => ({ col: 'processCompletions', id: `QPRINT-PC-${index}`, value: {
        recordId: `QPRINT-PC-${index}`, operationId: `QPRINT-PC-${index}`, intent: `declared isolated print stage ${processItem}`,
        postTaskId: postId, processItem, quantities: skus.map((sku: any) => ({ skuId: sku.skuId, quantity })),
        responsible: flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, recordedBy: flow.POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, recordedAt: now,
      } })),
    ]
    // Explicit native fixture transaction, before measured/observed UI actions.
    // Add unique QPRINT identities only; no delete/clear or old-row overwrite.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records')
        tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('隔离打印夹具事务中止'))
        tx.oncomplete = () => { db.close(); resolve() }
        for (const row of rows) store.add({ id: `${ns}/flow/${row.col}/${encodeURIComponent(row.id)}`, collection: `flow/${row.col}`, value: row.value, version: 1 })
        const schema = store.get(`${ns}/flow/schemaVersion/value`)
        schema.onsuccess = () => {
          if (schema.result && schema.result.value !== 4) { tx.abort(); return }
          if (!schema.result) store.add({ id: `${ns}/flow/schemaVersion/value`, collection: 'flow/schemaVersion', value: 4, version: 1 })
        }
      }
    })
    return { qcId, qcNo, productionOrderNo: order.productionOrderNo, postId, outboundId: outId, outboundNo: outNo, moduleUrl,
      outboundQuantities: skus.map((sku: any) => ({ skuId: sku.skuId, quantity })), fixture: {
        meaning: '声明的隔离历史格式QC/逐项加工/待出货事实；不代表该生产单真实发生质检或出货，不证明标准和物流业务验收',
        sourceProductionOrderId: order.productionOrderId, sourceStyleId: order.techPackSnapshot.styleId, sourceVersionId: order.techPackSnapshot.sourceTechPackVersionId,
        originalTemplateQc: original, skuIds: skus.map((sku: any) => sku.skuId), rows: rows.map(row => `${row.col}/${row.id}`),
        materialBindings: snapshot.bomSnapshot.map((row: any) => ({ material: row.materialSku, name: row.materialName, image: row.materialImageUrl })),
      } }
  }, completeMaterials)
  // New page restores through the original native repository/validator. The
  // fixture is never patched into app memory or installed by a product hook.
  if (completeMaterials === true) await page.reload()
  return source
}

async function nativeSnapshot(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const known = (await indexedDB.databases()).find(row => row.name === 'higood-pcs-records')
    if (!known) return { exists: false }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(known.name!, known.version)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result, stores = [...db.objectStoreNames], tx = db.transaction(stores, 'readonly'), facts: Record<string, unknown[]> = {}
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error || Error('原生只读核对中止'))
        tx.oncomplete = () => { db.close(); resolve({ exists: true, facts }) }
        for (const store of stores) {
          facts[store] = []
          const cursor = tx.objectStore(store).openCursor()
          cursor.onsuccess = () => { const c = cursor.result; if (c) { const row = c.value; facts[store].push(store === 'files' ? { id: row.id, size: row.blob?.size, type: row.blob?.type } : row); c.continue() } }
        }
      }
    })
  })
}
function button(page: Page, item: OutputCase): Locator {
  if (item.button === 'outer-print') return page.locator('.print-preview-toolbar [data-print-preview-action="print"]')
  if (item.button === 'outer-pdf') return page.locator('.print-preview-toolbar [data-print-preview-action="download-pdf"]')
  return page.locator(item.selector).locator('[data-post-verified-print]').first()
}
const printCalls = (page: Page) => page.evaluate(() => (window as any).__printReadyProbe.calls)
const printCount = async (page: Page) => (await printCalls(page)).length
const master = outputs[0]
const genericMaster = outputs.find(row => row.name === '通用QC主单outer-print')!

async function open(page: Page, item: OutputCase, source: PrintFixture): Promise<void> {
  await page.goto(item.path(source), { waitUntil: 'domcontentloaded' })
  await expect(page.locator(item.selector)).toBeVisible()
  await expect(button(page, item)).toBeVisible()
  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
}
async function assertOutput(page: Page, count = 1): Promise<void> {
  await expect.poll(() => printCount(page)).toBe(count)
  const calls = await printCalls(page)
  for (const call of calls) {
    expect(call.images.every((img: any) => img.complete && img.width > 0 && img.height > 0)).toBe(true)
    expect(call.barcodes.length + call.qrs.length).toBeGreaterThan(0)
    expect(call.barcodes.every((code: any) => code.rects > 0)).toBe(true)
    expect(call.qrs.every((code: any) => code.svg)).toBe(true)
  }
}
async function evidence(page: Page, info: TestInfo, data: unknown): Promise<void> {
  await info.attach('print-ready-observed-output', { body: JSON.stringify({ boundary: '隔离原型真实打印按钮，window.print观察点；不代表实体打印机', data, calls: await printCalls(page) }, null, 2), contentType: 'application/json' })
  await info.attach('print-ready-page', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
}

for (const item of outputs) {
  test(`原打印按钮就绪门禁：${item.name}正常输出且不写业务`, async ({ page }, info) => {
    const source = await fixture(page)
    await open(page, item, source)
    const before = await nativeSnapshot(page)
    const codeSelector = await page.locator('[data-real-barcode]').count() ? '[data-real-barcode]' : '[data-real-qr]'
    if (codeSelector === '[data-real-qr]') await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()
    const originalCode = await page.locator(codeSelector).first().evaluate((node, isBarcode) => {
      const html = node.innerHTML
      if (isBarcode) node.querySelectorAll('rect').forEach(rect => rect.remove())
      else node.replaceChildren()
      return html
    }, codeSelector === '[data-real-barcode]')
    // Every entry/button must prove it reaches the gate, rather than merely
    // printing successfully after an externally awaited image has loaded.
    await button(page, item).click()
    await expect(page.locator('[data-print-ready-feedback]').first()).toContainText(codeSelector === '[data-real-barcode]' ? '条码尚未生成' : '二维码尚未生成', { timeout: 12000 })
    expect(await printCount(page)).toBe(0)
    await expect(button(page, item)).toBeEnabled()
    await page.locator(codeSelector).first().evaluate((node, html) => { node.innerHTML = html }, originalCode)
    // No image decode/QR wait precedes this real button click: the application
    // itself must await every necessary asset before reaching window.print.
    await button(page, item).click()
    await assertOutput(page)
    if (item.labels) {
      expect(await page.locator('[data-outbound-unit-label]').count()).toBe(source.outboundQuantities.reduce((n, row) => n + row.quantity, 0))
      const actualCounts = await page.locator('[data-outbound-unit-label]').evaluateAll(nodes => nodes.reduce<Record<string, number>>((counts, node) => { const id = (node as HTMLElement).dataset.skuId!; counts[id] = (counts[id] || 0) + 1; return counts }, {}))
      expect(actualCounts).toEqual(Object.fromEntries(source.outboundQuantities.map(row => [row.skuId, row.quantity])))
    }
    expect(await nativeSnapshot(page)).toEqual(before)
    await evidence(page, info, { item: item.name, source, nativeBeforeEqualsAfter: true })
  })
}

async function originalImageUrl(page: Page): Promise<string> {
  const image = page.locator('.print-preview-root img, [data-post-print-ready-root] img').first()
  await expect(image).toHaveCount(1)
  return image.evaluate(img => {
    const url = new URL((img as HTMLImageElement).src)
    // Same actual file and image identity; query only prevents the prior HTTP
    // cache from bypassing this isolated request failure/delay injection.
    url.searchParams.set('quality-print-ready-probe', crypto.randomUUID())
    img.setAttribute('data-print-ready-original-src', (img as HTMLImageElement).src)
    return url.href
  })
}
async function resetFirstImage(page: Page, url: string): Promise<void> {
  await page.locator('.print-preview-root img, [data-post-print-ready-root] img').first().evaluate((img, src) => { (img as HTMLImageElement).src = src }, url)
}
async function delayOriginalImage(page: Page) {
  const url = await originalImageUrl(page)
  let release!: () => void, arrived!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve }), requested = new Promise<void>(resolve => { arrived = resolve })
  await page.route(url, async route => { arrived(); await blocked; await route.continue().catch(() => {}) })
  await resetFirstImage(page, url)
  await requested
  return { url, release }
}

test('专用QC图片真实请求延迟时先阻断，双击不重复，恢复原图后仅输出一次', async ({ page }, info) => {
  const source = await fixture(page); await open(page, master, source)
  const pending = await delayOriginalImage(page), before = await nativeSnapshot(page)
  try {
    await button(page, master).dblclick()
    await expect(page.locator('[data-print-ready-feedback]')).toContainText('正在准备')
    await expect(button(page, master)).toBeDisabled()
    expect(await printCount(page)).toBe(0)
    pending.release(); await assertOutput(page)
    await expect(button(page, master)).toBeEnabled()
    expect(await nativeSnapshot(page)).toEqual(before)
    await evidence(page, info, { source, delayedOriginalImage: pending.url, outputAfterRelease: 1, nativeUnchanged: true })
  } finally { pending.release() }
})

test('通用QC内层先打印时外层打印和PDF共用等待锁，不并发输出两次', async ({ page }, info) => {
  const source = await fixture(page); await open(page, genericMaster, source)
  const pending = await delayOriginalImage(page)
  try {
    await page.locator('[data-post-verified-print]').click()
    await expect(page.locator('.print-preview-root')).toHaveAttribute('data-preparing-print', 'true')
    await expect(page.locator('.print-preview-toolbar [data-print-preview-action="print"]')).toBeDisabled()
    await expect(page.locator('.print-preview-toolbar [data-print-preview-action="download-pdf"]')).toBeDisabled()
    expect(await printCount(page)).toBe(0)
    pending.release(); await assertOutput(page)
    await expect(page.locator('.print-preview-toolbar [data-print-preview-action="download-pdf"]')).toBeEnabled()
    await evidence(page, info, { source, delayedOriginalImage: pending.url, sharedInnerOuterLock: true })
  } finally { pending.release() }
})

for (const kind of ['inner', 'outer-print', 'outer-pdf'] as const) {
  test(`通用QC主单${kind}遇真实图片失败不输出，原按钮重试读取原图后成功`, async ({ page }, info) => {
    const item = outputs.find(row => row.name === `通用QC主单${kind}`)!, source = await fixture(page)
    await open(page, item, source)
    const url = await originalImageUrl(page), before = await nativeSnapshot(page)
    let fail = true
    await page.route(url, route => fail ? route.abort('failed') : route.continue())
    await resetFirstImage(page, url)
    await button(page, item).click()
    await expect(page.locator('.print-preview-root [data-print-ready-feedback]').first()).toContainText('打印未开始')
    expect(await printCount(page)).toBe(0)
    await expect(button(page, item)).toBeEnabled()
    fail = false
    await button(page, item).click(); await assertOutput(page)
    await expect(page.locator('.print-preview-root img').first()).toBeVisible()
    expect(await nativeSnapshot(page)).toEqual(before)
    await evidence(page, info, { source, failedOriginalImage: url, button: kind, retryOutput: 1, nativeUnchanged: true })
  })
}

test('专用出货条码缺少真实rect时阻断，恢复原有码图后原按钮可重试', async ({ page }, info) => {
  const source = await fixture(page), item = outputs.find(row => row.name === '专用出货SKU条码')!
  await open(page, item, source)
  const original = await page.locator('[data-real-barcode]').first().evaluate(node => { const html = node.innerHTML; node.querySelectorAll('rect').forEach(rect => rect.remove()); return html })
  await button(page, item).click()
  await expect(page.locator('[data-print-ready-feedback]')).toContainText('条码尚未生成')
  expect(await printCount(page)).toBe(0); await expect(button(page, item)).toBeEnabled()
  await page.locator('[data-real-barcode]').first().evaluate((node, html) => { node.innerHTML = html }, original)
  await button(page, item).click(); await assertOutput(page)
  await evidence(page, info, { source, fault: '移除一个原条码的rect；恢复相同原SVG内容，未生成替代码' })
})

test('通用后道流转卡等待原QR图形，超时不输出且恢复原SVG后可重试', async ({ page }, info) => {
  test.setTimeout(60000)
  const source = await fixture(page), item = outputs.find(row => row.name === '通用后道流转卡')!
  await open(page, item, source)
  // Capture the app-generated original SVG, then inject an unfinished QR DOM.
  // This does not replace the product QR module or fabricate a QR graphic.
  await expect(page.locator('[data-real-qr] svg').first()).toBeVisible()
  const original = await page.locator('[data-real-qr]').first().evaluate(node => { const html = node.innerHTML; node.replaceChildren(); return html })
  await button(page, item).click()
  await expect(button(page, item)).toBeDisabled(); expect(await printCount(page)).toBe(0)
  await expect(page.locator('[data-print-ready-feedback]').first()).toContainText('二维码尚未生成', { timeout: 12000 })
  expect(await printCount(page)).toBe(0); await expect(button(page, item)).toBeEnabled()
  await page.locator('[data-real-qr]').first().evaluate((node, html) => { node.innerHTML = html }, original)
  await button(page, item).click(); await assertOutput(page)
  await evidence(page, info, { source, fault: '原QR容器暂未生成svg，5秒后真实阻断；恢复其原图形后重试' })
})

test('通用QC等待图片时从真实返回按钮离开SPA，旧root恢复后不得输出新页面', async ({ page }, info) => {
  const source = await fixture(page); await open(page, genericMaster, source)
  const pending = await delayOriginalImage(page), session = await page.evaluate(() => (window as any).__printReadyProbe.session)
  const oldRoot = await page.locator('.print-preview-root').elementHandle()
  try {
    await button(page, genericMaster).click()
    await expect(button(page, genericMaster)).toBeDisabled(); expect(await printCount(page)).toBe(0)
    await page.getByRole('button', { name: '返回业务单据', exact: true }).click()
    await expect(page).not.toHaveURL(/\/fcs\/print\/preview/)
    await expect(page.locator('.print-preview-root')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__printReadyProbe.session)).toBe(session)
    pending.release()
    // Wait for the detached original helper to finish, rather than accepting
    // a zero count while its network/decode continuation has not run yet.
    await expect.poll(() => oldRoot!.evaluate(node => ({ connected: node.isConnected, busy: (node as HTMLElement).dataset.preparingPrint }))).toEqual({ connected: false, busy: undefined })
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    expect(await printCount(page)).toBe(0)
    await evidence(page, info, { source, sameWindowSession: session, actualDestination: page.url(), oldRootDetached: true, outputCount: 0 })
  } finally { pending.release() }
})

for (const binding of LEGACY_QC_MATERIAL_BINDINGS) {
  test(`原旧样本${binding.styleCode}两套QC主单使用其自身BOM原料图并正常输出`, async ({ page }, info) => {
    const orderNo = 'PO-QC-202608-' + binding.productionOrderId.slice(-1).padStart(3, '0')
    const source = await fixture(page, orderNo), observations = []
    for (const item of [master, genericMaster]) {
      await open(page, item, source)
      const before = await nativeSnapshot(page), rows = page.locator('.pf-qc-material tbody tr')
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText(binding.materialName)
      await expect(rows.first()).toContainText(binding.materialSkuCode)
      await expect(rows.first()).toContainText(binding.imageLabel)
      await expect(rows.first().locator('img')).toHaveAttribute('src', binding.imageUrl)
      await expect(page.locator('[data-print-image-missing]')).toHaveCount(0)
      await button(page, item).click(); await assertOutput(page)
      expect(await nativeSnapshot(page)).toEqual(before)
      await page.emulateMedia({ media: 'print' })
      const pdfPath = info.outputPath(`${binding.styleCode}-${item.button}.pdf`)
      await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
      await info.attach(`${binding.styleCode}-${item.button}-pdf`, { path: pdfPath, contentType: 'application/pdf' })
      await page.emulateMedia({ media: 'screen' })
      observations.push({ entry: item.name, exactMaterialSku: binding.materialSkuCode, image: binding.imageUrl, caption: binding.imageLabel, pdfPath, nativeBeforeEqualsAfter: true })
    }
    await evidence(page, info, { source, observations, boundary: '静态演示资料补全；原保存的生产/质检依据保持原版本；不是实际工厂用料证明' })
  })
}

test('隔离单行BOM缺图时两套QC主单明确阻断，不借同单其他图片通过', async ({ page }, info) => {
  // Explicit source-data fault in an isolated context, before the actual app
  // imports the static JSON. No product renderer/handler/readiness API changes.
  const fault = JSON.parse(readFileSync(new URL('../src/data/fcs/production-order-demo-tech-packs.json', import.meta.url), 'utf8'))
  const original = structuredClone(fault['PF-ACCEPT-PO-1'])
  fault['PF-ACCEPT-PO-1'].bomItems[0].materialImageUrl = ''
  fault['PF-ACCEPT-PO-1'].imageSnapshot.materialImages = []
  let injections = 0
  await page.route('**/src/data/fcs/production-order-demo-tech-packs.json*', async route => {
    injections++
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default ' + JSON.stringify(fault) + ';' })
  })
  const source = await fixture(page, 'PO-QC-202608-001'), observations = []
  for (const item of [master, genericMaster]) {
    await open(page, item, source)
    const before = await nativeSnapshot(page)
    await expect(page.locator('[data-print-image-missing]').first()).toBeVisible()
    await button(page, item).click()
    await expect(page.locator('[data-print-ready-feedback]').first()).toContainText('资料图片尚未维护')
    expect(await printCount(page)).toBe(0); await expect(button(page, item)).toBeEnabled()
    expect(await nativeSnapshot(page)).toEqual(before)
    observations.push({ entry: item.name, qc: source.qcNo, production: source.productionOrderNo, missingMarkerRemains: true, outputCount: 0 })
  }
  expect(injections).toBeGreaterThan(0)
  expect(original.bomItems[0].materialImageUrl).toBe(LEGACY_QC_MATERIAL_BINDINGS[0].imageUrl)
  await evidence(page, info, { source, observations, injections, fault: '仅隔离页面交付的PF-ACCEPT-PO-1静态BOM移除该行图片；仓库文件及原生业务数据均未改写' })
})
