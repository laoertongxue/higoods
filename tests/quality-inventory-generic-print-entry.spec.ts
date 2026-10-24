import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PostFinishingQcTask } from '../src/data/fcs/post-finishing-full-flow.ts'
import type { FinishedInventoryApplication } from '../src/data/wls/finished-inventory-quality-types.ts'

let barcodeDecoderPath = ''

// Native compiler preparation has its own budget. Browser assertions below still
// decode each actual rendered barcode independently, including after refresh.
test.beforeAll(async ({}, info) => {
  test.setTimeout(240000)
  const swiftPath = info.outputPath('decode-inventory-qc-code.swift')
  const swiftCache = join(tmpdir(), 'higoods-quality-swift-module-cache')
  barcodeDecoderPath = info.outputPath('decode-inventory-qc-code')
  await mkdir(info.outputDir, { recursive: true })
  await mkdir(swiftCache, { recursive: true })
  await writeFile(swiftPath, 'import Foundation\nimport Vision\nimport AppKit\nlet request=VNDetectBarcodesRequest()\nrequest.symbologies=[.code128]\ntry VNImageRequestHandler(url:URL(fileURLWithPath:CommandLine.arguments[1])).perform([request])\nlet results=(request.results ?? []).map { $0.payloadStringValue ?? "" }\nlet data=try JSONSerialization.data(withJSONObject:results)\nprint(String(data:data,encoding:.utf8)!)\n')
  const started = Date.now()
  execFileSync('swiftc', ['-module-cache-path', swiftCache, swiftPath, '-o', barcodeDecoderPath], { encoding: 'utf8', timeout: 180000 })
  await info.attach('independent-barcode-decoder-preparation', { body: JSON.stringify({ compiler: 'swiftc', durationMs: Date.now() - started, source: swiftPath, executable: barcodeDecoderPath }), contentType: 'application/json' })
})

// Each case uses Playwright's fresh context. The application, physical receipt,
// claim, inspection round and completion below use the original inventory/QC UI.
// Native IndexedDB helpers only read persisted facts. No production order, QC
// source, cutting readiness or PPIC state is inserted/prepared by this spec.
// This existing detail output is SKU text + fixed requirements + document code.
// Actual reference images, if present in its frozen snapshot, are checked here;
// garment/master-sheet pictures and PDF layout belong to their print contracts.
test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 3 })

interface NativeRow { id: string; collection: string; value: unknown; deleted?: boolean }
interface PrintProbe {
  writes: Array<{ database: string; stores: string[]; mode: string }>
  cuttingTransactions: Array<{ stores: string[]; mode: string }>
  calls: Array<{
    path: string
    text: string
    images: Array<{ src: string; complete: boolean; width: number; height: number }>
    codes: Array<{ value: string | null; bars: number }>
  }>
}

async function pcsRows(page: Page): Promise<NativeRow[]> {
  return page.evaluate(async () => {
    const existing = await indexedDB.databases()
    if (!existing.some(db => db.name === 'higood-pcs-records')) throw Error('原业务尚未保存 PCS 记录，不能由测试读取创建替代库。')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('higood-pcs-records')
      request.onupgradeneeded = () => { request.transaction!.abort(); reject(Error('只读取证不得创建或升级数据库。')) }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      return await new Promise<NativeRow[]>((resolve, reject) => {
        const transaction = db.transaction('records', 'readonly')
        const request = transaction.objectStore('records').getAll()
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('原生记录读取失败。'))
      })
    } finally { db.close() }
  })
}

// Snapshot every existing native store, including operations/meta and Blob bytes.
// Do not open missing databases: a print must not initialize an unrelated source.
async function nativeFingerprint(page: Page) {
  return page.evaluate(async () => {
    const digest = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
    const canonical = async (value: unknown): Promise<unknown> => {
      if (value instanceof Blob) return { blobSize: value.size, blobType: value.type, sha256: await digest(await value.arrayBuffer()) }
      if (value instanceof Date) return { date: value.toISOString() }
      if (value instanceof ArrayBuffer) return { byteLength: value.byteLength, sha256: await digest(value) }
      if (Array.isArray(value)) return Promise.all(value.map(canonical))
      if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.keys(value).sort().map(async key => [key, await canonical((value as Record<string, unknown>)[key])])))
      return value
    }
    const databases = (await indexedDB.databases()).filter(db => db.name).sort((a, b) => a.name!.localeCompare(b.name!))
    const result = []
    for (const database of databases) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(database.name!)
        request.onupgradeneeded = () => { request.transaction!.abort(); reject(Error('只读指纹不得创建或升级数据库。')) }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
      try {
        const names = [...db.objectStoreNames].sort()
        const stores = names.length ? await new Promise<Array<{ name: string; records: unknown[] }>>((resolve, reject) => {
          const transaction = db.transaction(names, 'readonly')
          const requests = names.map(name => ({ name, request: transaction.objectStore(name).getAll() }))
          transaction.oncomplete = () => resolve(requests.map(({ name, request }) => ({ name, records: request.result })))
          transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('原生全库指纹读取失败。'))
        }) : []
        const normalized = await canonical(stores)
        result.push({ name: db.name, version: db.version, stores: names, sha256: await digest(new TextEncoder().encode(JSON.stringify(normalized)).buffer) })
      } finally { db.close() }
    }
    return result
  })
}

async function originalStockQcFromUi(page: Page) {
  await page.goto('/wls/finished/stock/realtime')
  await expect(page.getByRole('heading', { name: '即时库存查询 — 成衣', exact: true })).toBeVisible()
  await page.locator('tr').filter({ hasText: 'SKU-GC-20001' }).first().getByRole('link', { name: '本仓本款全部送检' }).click()
  await expect(page.getByRole('heading', { name: '确认整批库存送检', exact: true })).toBeVisible()
  await page.locator('[data-fiq-form="apply"] input[name="operator"]').fill('隔离打印回归仓管')
  await page.getByRole('button', { name: '确认下架出库 80 件', exact: true }).click()
  await expect(page.getByRole('heading', { name: '库存送检流转详情', exact: true })).toBeVisible()
  const applications = (await pcsRows(page)).filter(row => !row.deleted && row.collection === 'higood-finished-inventory/applications')
  expect(applications).toHaveLength(1)
  let application = applications[0].value as FinishedInventoryApplication
  expect(application.lines.reduce((n, line) => n + line.outboundQty, 0)).toBe(80)
  expect(application.lines).toHaveLength(2)
  const receive = page.locator('[data-fiq-form="receive"]')
  for (const line of application.lines) await receive.locator(`input[name="quantity"][data-sku-id="${line.skuId}"]`).fill(String(line.outboundQty))
  await receive.locator('input[name="operator"]').fill('隔离打印回归后道实收员')
  await receive.getByRole('button', { name: '确认整批实收并形成库存QC', exact: true }).click()
  await expect(page.getByRole('link', { name: '进入后道原质检工作台', exact: true })).toBeVisible()
  application = (await pcsRows(page)).find(row => !row.deleted && row.id === applications[0].id)!.value as FinishedInventoryApplication
  expect(application.qcTaskId).toBeTruthy()
  expect(application.lines.reduce((n, line) => n + (line.receivedQty || 0), 0)).toBe(80)
  await page.getByRole('link', { name: '进入后道原质检工作台', exact: true }).click()
  await page.getByRole('button', { name: '领取并固定本次检查要求', exact: true }).click()
  const workbench = page.locator('[data-qc-workbench-task]')
  await expect(workbench).toContainText('实际接收80件')
  await expect(workbench).toContainText('当前比例 30%')
  await expect(workbench).toContainText('尚需检查 24')
  const cards = page.locator('[data-qc-result-line]')
  await expect(cards).toHaveCount(application.lines.length)
  const capacities = await cards.evaluateAll(nodes => nodes.map(node => Number((node as HTMLElement).dataset.remaining)))
  let remaining = 24
  for (let index = 0; index < capacities.length; index++) {
    expect(Number.isSafeInteger(capacities[index]) && capacities[index] >= 0).toBe(true)
    const passed = Math.min(remaining, capacities[index])
    remaining -= passed
    await cards.nth(index).locator('[data-qc-result-field="passedQty"]').fill(String(passed))
    await cards.nth(index).locator('[data-qc-result-field="defectQty"]').fill('0')
    await cards.nth(index).locator('[data-qc-result-field="returnQty"]').fill('0')
  }
  expect(remaining).toBe(0)
  await page.getByRole('button', { name: '提交第1轮检查', exact: true }).click()
  await expect(page.getByRole('heading', { name: '完成本批QC并按去向办理', exact: true })).toBeVisible()
  await expect(workbench).toContainText('库存不额外要求纸面双签')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '确认完成QC并生成对应去向', exact: true }).click()
  await expect(workbench).toHaveCount(0)
  const rows = await pcsRows(page)
  const qcs = rows.filter(row => !row.deleted && row.collection === 'flow/qcTasks' && (row.value as PostFinishingQcTask).inventoryApplicationId === application.id)
  expect(qcs).toHaveLength(1)
  const qc = qcs[0].value as PostFinishingQcTask
  expect(qc.qcTaskId).toBe(application.qcTaskId)
  expect(qc.sourceKind).toBe('WAREHOUSE_STOCK')
  expect(qc.productionOrderId).toBe('')
  expect(qc.productionOrderNo).toBe('')
  expect(qc.status).toBe('质检完成')
  expect(qc.lines.map(line => line.sku.skuCode).sort()).toEqual(application.lines.map(line => line.skuCode).sort())
  expect(qc.inspection!.snapshot.context.sourceKind).toBe('WAREHOUSE_STOCK')
  expect(qc.inspection!.snapshot.items.length).toBeGreaterThan(0)
  expect(qc.inspection!.rounds).toHaveLength(1)
  expect(qc.inspection!.rounds[0].percent).toBe(30)
  expect(qc.inspection!.rounds[0].target).toBe(24)
  expect(qc.inspection!.rounds[0].lines.reduce((n, line) => n + line.passedQty, 0)).toBe(24)
  expect(qc.inspection!.rounds[0].lines.every(line => line.defectQty === 0 && line.returnQty === 0)).toBe(true)
  expect(qc.results!.reduce((n, line) => n + (line.uninspectedQty || 0), 0)).toBe(56)
  expect(qc.results!.reduce((n, line) => n + (line.releasedQty || 0), 0)).toBe(80)
  expect(qc.inspection!.papers).toEqual([])
  return { application, qc }
}

async function assertDetail(page: Page, application: FinishedInventoryApplication, qc: PostFinishingQcTask, stage: string, info: TestInfo) {
  const root = page.locator('[data-testid="post-finishing-qc-detail-print"]')
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-print-document-no', qc.qcTaskNo)
  await expect(root).toContainText('不适用（库存送检）')
  await expect(root).toContainText('成衣仓库存送检')
  await expect(root).toContainText(qc.sourceWarehouseName!)
  await expect(root).toContainText(`申请 ${application.id}`)
  const table = root.locator('.pf-qc-sku-table tbody tr')
  await expect(table).toHaveCount(qc.lines.length)
  for (const [index, line] of qc.lines.entries()) {
    const checked = qc.results!.find(result => result.sku.skuId === line.sku.skuId)!
    await expect(table.nth(index).locator('td').nth(0)).toHaveText(line.sku.skuCode)
    await expect(table.nth(index).locator('td').nth(1)).toHaveText('')
    await expect(table.nth(index).locator('td').nth(2)).toHaveText('')
    await expect(table.nth(index).locator('td').nth(3)).toHaveText(String(checked.passedQty + checked.defectQty + checked.returnQty))
  }
  const snapshot = qc.inspection!.snapshot
  const appendix = root.locator(`[data-qc-inspection-snapshot="${snapshot.id}"]`)
  await expect(appendix).toBeVisible()
  await expect(appendix).toContainText(`标准 ${snapshot.basicStandard.name} v${snapshot.basicStandard.version}`)
  for (const item of snapshot.items) {
    await expect(appendix).toContainText(item.name)
    await expect(appendix).toContainText(item.content)
    await expect(appendix).toContainText(item.criterion)
  }
  await expect(appendix).toContainText('应检 24 件 · 实检 24 件 · 实检合格 24 件 · 瑕疵 0 件 · 返工 0 件')
  await expect(appendix).toContainText('未抽随批放行 56 件；正常放行 80 件')
  await expect(root.locator('[data-qc-legacy-unknown]')).toHaveCount(0)
  await expect(page.locator('[data-shell-tab]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/裁床部位票[^。\n]*(?:未准备|尚未准备|迁移)|当前记录未能读取|未完成迁移|请先迁移|迁移尚未完成/)
  const snapshots = [snapshot, ...(snapshot.skuSnapshots || []).map(row => row.snapshot)]
  const referenceUrls = [...new Set(snapshots.flatMap(current => [...current.references, ...current.items.flatMap(item => item.references)]).map(ref => ref.imageUrl || (ref.value && /^(\/|https?:\/\/|blob:)/.test(ref.value) ? ref.value : '')).filter(Boolean))]
  const actualImages = await root.locator('img').evaluateAll(async nodes => {
    await Promise.all(nodes.map(async node => { await (node as HTMLImageElement).decode() }))
    return nodes.map(node => { const image = node as HTMLImageElement; return { src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight } })
  })
  for (const url of referenceUrls) expect(actualImages.some(image => image.src === new URL(url, page.url()).href), `本次固定参照图 ${url}`).toBe(true)
  expect(actualImages.length).toBeGreaterThanOrEqual(referenceUrls.length)
  for (const image of actualImages) {
    expect(image.complete && image.width > 0 && image.height > 0).toBe(true)
    expect(referenceUrls.some(url => new URL(url, page.url()).href === image.src), '详情图必须来自本次冻结参照；不能补用其他生产单图片').toBe(true)
  }
  const barcode = root.locator('[data-real-barcode]')
  await expect(barcode).toHaveCount(1)
  await expect(barcode).toHaveAttribute('data-barcode-value', qc.qcTaskNo)
  expect(await barcode.locator('rect').count()).toBeGreaterThan(0)
  const barcodePath = info.outputPath(`${stage}-inventory-qc-code.png`)
  await barcode.screenshot({ path: barcodePath })
  const decoded = JSON.parse(execFileSync(barcodeDecoderPath, [barcodePath], { encoding: 'utf8', timeout: 10000 })) as string[]
  expect(decoded, '独立 Vision 解码实际渲染图形，不只读条码 data 属性').toContain(qc.qcTaskNo)
  await info.attach(`${stage}-inventory-qc-code`, { path: barcodePath, contentType: 'image/png' })
  await info.attach(`${stage}-detail-content`, { body: JSON.stringify({ qcTaskId: qc.qcTaskId, sourceKind: qc.sourceKind, applicationId: application.id, referenceUrls, actualImages, imageScope: referenceUrls.length ? '只核本次冻结参照图' : '本次文本明细无图片，不作主单/款图验收', decoded }, null, 2), contentType: 'application/json' })
  return root
}

test('库存原页面完成QC后，通用详情打印冷直达及刷新读取原库存事实且零写入', async ({ context, page }, info) => {
  test.setTimeout(180000)
  await context.addInitScript(() => {
    ;(window as any).__name = (value: unknown) => value
    localStorage.setItem('higood-fcs-post-finishing-current-actor-v1', 'PF-USER-QC-MGR')
  })
  const { application, qc } = await originalStockQcFromUi(page)
  const before = await nativeFingerprint(page)
  await info.attach('actual-inventory-ui-source-and-native-before', { body: JSON.stringify({ fixture: '原库存申请→整批实收→原QC领取→实检24→原QC完成；无原生插入或生产单', application, qc, before }, null, 2), contentType: 'application/json' })
  await page.close()
  await context.addInitScript(() => {
    const probe: PrintProbe = { writes: [], cuttingTransactions: [], calls: [] }
    ;(window as any).__inventoryGenericPrintProbe = probe
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      const stores = typeof args[0] === 'string' ? [args[0]] : Array.from(args[0])
      const mode = args[1] || 'readonly'
      if (mode !== 'readonly') probe.writes.push({ database: this.name, stores, mode })
      if (this.name === 'higood-cutting-records-v1') probe.cuttingTransactions.push({ stores, mode })
      return original.apply(this, args)
    }
    // Observe only the actual browser print output boundary. The real product
    // button, readiness checks, images and barcode rendering remain untouched.
    window.print = () => {
      const root = document.querySelector('[data-testid="post-finishing-qc-detail-print"]')!
      probe.calls.push({ path: location.pathname + location.search, text: root?.textContent || '',
        images: [...root.querySelectorAll<HTMLImageElement>('img')].map(image => ({ src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight })),
        codes: [...root.querySelectorAll('[data-real-barcode]')].map(node => ({ value: node.getAttribute('data-barcode-value'), bars: node.querySelectorAll('rect').length })) })
    }
  })
  const printPage = await context.newPage()
  const errors: string[] = []
  printPage.on('pageerror', error => errors.push(error.message))
  printPage.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const path = `/fcs/print/preview?documentType=POST_FINISHING_QC_ORDER&sourceType=POST_FINISHING_QC_ORDER&sourceId=${encodeURIComponent(qc.qcTaskId)}`
  await printPage.goto(path)
  await assertDetail(printPage, application, qc, 'cold-direct-entry', info)
  expect(await nativeFingerprint(printPage)).toEqual(before)
  let probe = await printPage.evaluate(() => (window as any).__inventoryGenericPrintProbe as PrintProbe)
  expect(probe.writes).toEqual([])
  expect(probe.cuttingTransactions).toEqual([])
  expect(probe.calls).toEqual([])
  await printPage.reload()
  await assertDetail(printPage, application, qc, 'refresh', info)
  expect(await nativeFingerprint(printPage)).toEqual(before)
  await printPage.locator('.print-preview-toolbar [data-print-preview-action="print"]').click()
  await expect.poll(() => printPage.evaluate(() => (window as any).__inventoryGenericPrintProbe.calls.length)).toBe(1)
  probe = await printPage.evaluate(() => (window as any).__inventoryGenericPrintProbe as PrintProbe)
  expect(probe.calls[0].path).toBe(path)
  expect(probe.calls[0].text).toContain('成衣仓库存送检')
  expect(probe.calls[0].codes).toEqual([{ value: qc.qcTaskNo, bars: await printPage.locator('[data-testid="post-finishing-qc-detail-print"] [data-real-barcode] rect').count() }])
  expect(probe.calls[0].codes[0].bars).toBeGreaterThan(0)
  expect(probe.calls[0].images.every(image => image.complete && image.width > 0 && image.height > 0)).toBe(true)
  expect(probe.writes).toEqual([])
  expect(probe.cuttingTransactions).toEqual([])
  expect(await nativeFingerprint(printPage)).toEqual(before)
  const reopened = (await pcsRows(printPage)).filter(row => !row.deleted && row.collection === 'flow/qcTasks' && (row.value as PostFinishingQcTask).inventoryApplicationId === application.id)
  expect(reopened).toHaveLength(1)
  expect(reopened[0].value).toEqual(qc)
  expect(errors).toEqual([])
  await info.attach('cold-refresh-print-observation-and-native-after', { body: JSON.stringify({ path, probe, errors, after: await nativeFingerprint(printPage) }, null, 2), contentType: 'application/json' })
})
