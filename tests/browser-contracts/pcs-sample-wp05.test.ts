import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.env.SAMPLE_TEST_URL || 'http://127.0.0.1:4206'

for (let iteration = 1; iteration <= 5; iteration++) test(`SAMP browser Mock full flow ${iteration}: refreshed persistence, rollback and conflict`, { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage()
  await page.addInitScript(() => { (globalThis as any).__name = (v: unknown) => v; for (const name of ['pointerdown','input','change']) document.addEventListener(name, () => { (globalThis as any).__sampleEventStart = performance.now() }, true) })
  const errors: string[] = [], checks: string[] = [], performanceSamples: Array<{ name: string; ms: number }> = []
  page.on('pageerror', e => errors.push(e.message))
  const check = (ok: boolean, name: string) => { assert.ok(ok, name); checks.push(name) }
  const ready = async () => { await page.waitForSelector('[data-pcs-sample-page-root], [data-pcs-testing-action]'); await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img')].every(img => img.complete && img.naturalWidth > 0)) }
  try {
    const finishMeasure = async (name: string) => { await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))); const ms = await page.evaluate(() => performance.now() - (globalThis as any).__sampleEventStart); performanceSamples.push({ name, ms }); assert.ok(ms <= 1000, `${name}: ${ms}ms exceeds 1s`) }
    await page.goto(base + '/pcs/samples/inventory'); await ready()
    const seeded = await page.evaluate(async () => {
      const db = await import('/src/data/pcs-record-db.ts')
      return (await db.readPcsRecords()).records.filter(r => r.id.startsWith('higood-pcs-sample-management-v1/')).length
    })
    check(seeded === 0, 'fresh reads never persist sample seeds')
    const data = await page.evaluate(async () => {
      const rt = await import('/src/data/pcs-record-runtime.ts'); await rt.ensurePcsRecordState()
      const style = await import('/src/data/pcs-style-archive-repository.ts'), sku = await import('/src/data/pcs-sku-archive-repository.ts'), testing = await import('/src/data/pcs-testing-order-repository.ts')
      const active = new Set(testing.listTestingOrders().filter(o => o.status === '进行中').map(o => o.styleId))
      const s = style.listStyleArchives().find(s => !active.has(s.styleId) && s.mainImageUrl && sku.listSkuArchives().filter(k => k.styleId === s.styleId).length >= 2)!
      const codes = sku.listSkuArchives().filter(k => k.styleId === s.styleId).slice(0, 2).map(k => k.skuCode)
      const r = await rt.runPcsRecordCommand(() => testing.createTestingOrder({ styleId: s.styleId, skuCodes: codes }))
      if (!r.ok) throw Error(r.message)
      return { id: r.order!.testingOrderId, codes }
    })
    await page.goto(base + '/pcs/testing/orders/' + data.id); await ready()
    await page.locator('[data-pcs-testing-action="advance"][data-step="purchase-link"]').click()
    await page.waitForSelector('[data-pcs-testing-field="purchase-link"]')
    await page.locator('[data-pcs-testing-field="purchase-link"]').fill('https://example.com/mock-sample')
    await page.locator('[data-pcs-testing-action="save-purchase-link"]').click()
    await page.waitForSelector('[data-pcs-testing-field="carrier"]')
    await page.locator('[data-pcs-testing-field="carrier"]').fill('Mock 快递')
    await page.locator('[data-pcs-testing-field="tracking"]').fill('MOCK-FULL-001')
    await page.locator('[data-pcs-testing-action="save-logistics"]').click()
    await page.waitForSelector('[data-pcs-testing-action="complete-sample-inbound"]')
    const failMidAction = async (action: 'receipt' | 'label') => {
      const result = await page.evaluate(async ({ action, orderId, code }) => {
        const rt = await import('/src/data/pcs-record-runtime.ts'), db = await import('/src/data/pcs-record-db.ts'), testing = await import('/src/data/pcs-testing-order-repository.ts'), sample = await import('/src/data/pcs-sample-management.ts')
        const before = JSON.stringify((await db.readPcsRecords()).records), state = JSON.stringify(testing.getTestingOrderById(orderId)), samples = JSON.stringify(sample.listPcsSampleRecords())
        const put = IDBObjectStore.prototype.put; let writes = 0; let failed = false
        IDBObjectStore.prototype.put = function (...args: any[]) { if (this.name === 'records' && ++writes === 2) throw new DOMException('injected halfway', 'AbortError'); return put.apply(this, args as any) }
        try { await rt.runPcsRecordCommand(() => action === 'receipt' ? testing.completeSampleInbound(orderId, '中途故障到样') : testing.completeLabelStep(orderId, sample.buildPcsSampleTagCode(code))) } catch { failed = true } finally { IDBObjectStore.prototype.put = put }
        return { failed, writes, same: before === JSON.stringify((await db.readPcsRecords()).records) && state === JSON.stringify(testing.getTestingOrderById(orderId)) && samples === JSON.stringify(sample.listPcsSampleRecords()) }
      }, { action, orderId: data.id, code: data.codes[0] })
      check(result.failed && result.writes === 2 && result.same, action + ': midway failure rolls back order, sample, tag and ledger together')
      await page.reload(); await ready()
    }
    await failMidAction('receipt')
    await page.locator('[data-pcs-testing-action="complete-sample-inbound"]').click()
    await page.waitForSelector('[data-pcs-testing-action="complete-label"]')
    await finishMeasure('④receipt-save')
    const hgCodes = await page.evaluate(async codes => { const sample = await import('/src/data/pcs-sample-management.ts'); return codes.map(code => sample.buildPcsSampleTagCode(code)) }, data.codes)
    await failMidAction('label')
    for (const invalidCode of ['', 'WRONG', data.codes[0]]) {
      await page.locator('[data-pcs-testing-field="label-sku"]').fill(invalidCode)
      await finishMeasure('⑤invalid-code-input-' + (invalidCode || 'empty'))
      await page.locator('[data-pcs-testing-action="complete-label"]').click()
      await page.waitForFunction(() => document.querySelector('[data-testing-action-feedback]')?.textContent?.includes('SKU'))
      await finishMeasure('⑤invalid-code-confirm-' + (invalidCode || 'empty'))
      check(await page.locator('[data-pcs-testing-field="label-sku"]').inputValue() === invalidCode, 'invalid SKU stays editable with visible reason')
    }
    await page.locator('[data-pcs-testing-field="label-sku"]').fill(hgCodes[0])
    await finishMeasure('⑤SKU-code-input')
    await page.evaluate(() => { (globalThis as any).__putBeforeFault = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args: any[]) { if (this.name === 'records') throw new DOMException('full', 'QuotaExceededError'); return (globalThis as any).__putBeforeFault.apply(this, args) } })
    await page.locator('[data-pcs-testing-action="complete-label"]').click()
    await page.waitForFunction(() => document.querySelector('[data-testing-action-feedback]')?.textContent?.includes('未保存'))
    await finishMeasure('⑤failed-save-feedback')
    check(await page.locator('[data-pcs-testing-field="label-sku"]').inputValue() === hgCodes[0], 'UI failed save preserves entered SKU for retry')
    await page.evaluate(() => { IDBObjectStore.prototype.put = (globalThis as any).__putBeforeFault })
    await page.locator('[data-pcs-testing-action="complete-label"]').click()
    await page.waitForFunction(code => document.querySelector('[data-pcs-testing-field="label-sku"]')?.getAttribute('value') !== code, hgCodes[0])
    await finishMeasure('⑤first-SKU-tag-save')
    check(await page.locator('[data-pcs-testing-action="complete-label"]').count() === 1, 'two SKU order remains at step ⑤ after first tag')
    await page.locator('[data-pcs-testing-field="label-sku"]').fill(hgCodes[1])
    await page.locator('[data-pcs-testing-action="complete-label"]').click()
    await page.waitForSelector('[data-pcs-testing-action="buyer-kill"]')
    await finishMeasure('⑤last-SKU-tag-save')
    check(true, '④⑤ executed using page controls; both SKU labels complete')
    const id = `testing-${data.id}-${data.codes[0]}`
    await page.goto(base + '/pcs/samples/detail/' + encodeURIComponent(id)); await ready()
    await page.locator('[data-pcs-sample-action="open-flow"]').click()
    await page.locator('[data-pcs-sample-action="save-flow"]').click()
    await page.waitForFunction(() => document.querySelector('[aria-label="确认流转签收"] [role="alert"]')?.textContent?.includes('不存在'))
    await finishMeasure('flow-missing-target-block')
    await page.locator('[data-pcs-sample-field="flow-target"]').selectOption('loc-live-01')
    await page.locator('[data-pcs-sample-action="save-flow"]').click()
    await page.waitForFunction(() => document.querySelector('[aria-label="确认流转签收"] [role="alert"]')?.textContent?.includes('必须'))
    await finishMeasure('flow-missing-reason-block')
    check(await page.locator('[data-pcs-sample-field="flow-target"]').inputValue() === 'loc-live-01', 'blocked flow preserves selected destination for correction')
    await page.locator('[data-pcs-sample-action="close-flow"]').click()
    await finishMeasure('flow-cancel')
    const move = async (destination: string, note: string) => {
      await page.locator('[data-pcs-sample-action="open-flow"]').click()
      await finishMeasure('flow-open')
      await page.locator('[data-pcs-sample-field="flow-target"]').selectOption(destination)
      await finishMeasure('flow-target-input')
      await page.locator('[data-pcs-sample-field="flow-reason"]').fill(note)
      await finishMeasure('flow-reason-input')
      await page.locator('[data-pcs-sample-action="save-flow"]').click()
      await page.waitForSelector('[role="dialog"][aria-label="确认流转签收"]', { state: 'detached' })
      await finishMeasure('flow-save-' + destination)
      check((await page.locator('[data-pcs-sample-page-root]').innerText()).includes(note), 'UI flow saved: ' + destination)
    }
    await move('loc-live-01', 'Mock 营销直播')
    await move('loc-home-01', 'Mock 达人家播')
    const convert = async (type: string, note: string) => {
      page.once('dialog', dialog => dialog.accept(note))
      await page.locator(`[data-pcs-sample-action="convert-type"][data-to-type="${type}"]`).click()
      await page.waitForSelector(`[data-pcs-sample-action="convert-type"][data-to-type="${type}"][disabled]`)
      await finishMeasure('convert-' + type)
    }
    await convert('production', 'Mock 转为生产跟版')
    await move('loc-factory-01', 'Mock 工厂接收')
    await move('loc-dept-01', 'Mock 部门接收')
    await move('loc-wh-01', 'Mock 归仓')
    await convert('marketing', 'Mock 回到营销')
    await page.reload(); await ready()
    check((await page.locator('[data-pcs-sample-page-root]').innerText()).includes('Mock 回到营销'), 'conversion logs survive refresh and direct detail navigation')
    await page.locator('[data-pda-image-preview-url]').first().click()
    await page.waitForSelector('[role="dialog"]')
    check(true, 'real sample image preview opens')
    await page.keyboard.press('Escape')
    await page.screenshot({ path: `output/playwright/sample-wp05/full-flow-detail-${iteration}.png`, fullPage: true })
    const adversarial = await page.evaluate(async ({ id, orderId, codes }) => {
      const rt = await import('/src/data/pcs-record-runtime.ts'), sample = await import('/src/data/pcs-sample-management.ts'), testing = await import('/src/data/pcs-testing-order-repository.ts'), db = await import('/src/data/pcs-record-db.ts')
      const passed: string[] = []
      function check(v: boolean, name: string) { if (!v) throw Error(name); passed.push(name) }
      const run = (fn: () => unknown) => rt.runPcsRecordCommand(fn, crypto.randomUUID(), [sample.PCS_SAMPLE_STORAGE_KEY])
      const before = JSON.stringify((await db.readPcsRecords()).records)
      check(!(await run(() => sample.transferPcsSample(id, 'missing', '管理员', '无效位置')) as any).ok, 'invalid destination blocked')
      check(!(await run(() => sample.convertPcsSampleType(id, 'production', '管理员', '')) as any).ok, 'empty reason blocked')
      check(!(await run(() => sample.transferPcsSample(id, 'loc-wh-01', '管理员', '重复签收')) as any).ok, 'duplicate receipt blocked')
      try { testing.updateTestingOrder(orderId, { currentStepKey: 'pricing' }); throw Error('must reject bypass') } catch (e) { check(String(e).includes('对应业务动作'), 'generic update cannot forge step facts') }
      check(JSON.stringify((await db.readPcsRecords()).records) === before, 'invalid operations do not persist anything')
      const oldPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args: any[]) { if (this.name === 'records') throw new DOMException('full', 'QuotaExceededError'); return oldPut.apply(this, args as any) }
      try { await run(() => sample.convertPcsSampleType(id, 'production', '管理员', '故障注入')); throw Error('must fail') } catch (e) { check(String(e).includes('空间不足'), 'quota failure reported') } finally { IDBObjectStore.prototype.put = oldPut }
      check(sample.getPcsSampleById(id)!.sampleType === 'marketing', 'failed type conversion rolls back memory')
      check(JSON.stringify((await db.readPcsRecords()).records) === before, 'failed save preserves persistent sample and logs')
      // Original files are reused; the command never copies them into JSON.
      check(!(rt.pcsRecordStore.getItem(sample.PCS_SAMPLE_STORAGE_KEY) || '').includes('data:'), 'no business Base64 or localStorage fallback')
      check(codes.every(code => sample.canCompletePcsSampleTagging(sample.getPcsSampleById(`testing-${orderId}-${code}`)!)), 'all persisted SKU labels match their SKU code')
      return passed
    }, { id, orderId: data.id, codes: data.codes })
    checks.push(...adversarial)
    const other = await context.newPage()
    await other.addInitScript('globalThis.__name = (v) => v; globalThis.BroadcastChannel = undefined')
    await other.goto(base + '/pcs/samples/detail/' + encodeURIComponent(id))
    await other.waitForSelector('[data-pcs-sample-page-root]')
    await page.evaluate(async id => {
      const rt = await import('/src/data/pcs-record-runtime.ts'), sample = await import('/src/data/pcs-sample-management.ts')
      await rt.runPcsRecordCommand(() => sample.transferPcsSample(id, 'loc-home-01', '管理员', '另一标签签收'), crypto.randomUUID(), [sample.PCS_SAMPLE_STORAGE_KEY])
    }, id)
    const conflict = await other.evaluate(async id => {
      const rt = await import('/src/data/pcs-record-runtime.ts'), sample = await import('/src/data/pcs-sample-management.ts')
      try { await rt.runPcsRecordCommand(() => sample.transferPcsSample(id, 'loc-live-01', '管理员', '旧标签覆盖'), crypto.randomUUID(), [sample.PCS_SAMPLE_STORAGE_KEY]); return false } catch (e) { return String(e).includes('其他页面修改') }
    }, id)
    check(conflict, 'transaction version guard rejects stale tab even without broadcast notifications')
    await other.reload(); await other.waitForSelector('[data-pcs-sample-page-root]')
    check((await other.locator('[data-pcs-sample-page-root]').innerText()).includes('另一标签签收'), 'reloaded stale tab reads winner and never overwrites it')
    await other.close()
    await page.goto(base + '/pcs/samples/transfer'); await ready()
    await page.locator('[data-pcs-sample-field="location-type"]').selectOption('家播')
    check((await page.locator('[data-pcs-sample-page-root]').innerText()).includes('达人小美'), 'home location filter resolves master name')
    check(errors.length === 0, 'no uncaught page errors')
    await writeFile(`output/playwright/sample-wp05/full-flow-${iteration}.json`, JSON.stringify({ passed: true, iteration, checks, errors, performanceSamples, viewport: '1366x768', base }, null, 2))
  } finally { await browser.close() }
})
