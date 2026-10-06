import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

test('WP05 adjacent testing: live record, pending and both final decisions via UI, five rounds each', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true })
  const samples: Array<{name:string;ms:number}> = [], errors: string[] = []
  try {
    for (const decision of ['是', '否']) for (let round = 1; round <= 5; round++) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
      await context.addInitScript(() => { (globalThis as any).__name = (v:unknown) => v; for(const name of ['pointerdown','input']) document.addEventListener(name, () => { (globalThis as any).__start = performance.now() }, true) })
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
      await page.goto('http://127.0.0.1:4207/pcs/testing/orders/to_seed_normal')
      await page.waitForSelector('[data-pcs-testing-action="save-live"]')
      const readOrder = async () => {
        const records = await page.evaluate(() => new Promise<any[]>((resolve,reject) => { const q = indexedDB.open('higood-pcs-records'); q.onsuccess = () => { const db = q.result; const r = db.transaction('records').objectStore('records').getAll(); r.onsuccess = () => { db.close(); resolve(r.result) }; r.onerror = () => reject(r.error) }; q.onerror = () => reject(q.error) }))
        return records.find(r => r.value?.data?.testingOrderId === 'to_seed_normal')?.value.data
      }
      const act = async (name:string, action:()=>Promise<unknown>, done?:()=>Promise<unknown>) => {
        await action(); if(done) await done()
        await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
        const ms = await page.evaluate(() => performance.now() - (globalThis as any).__start)
        samples.push({name, ms}); assert.ok(ms <= 1000, `${name}: ${ms}ms`)
      }
      await act('product-expand', () => page.locator('main details summary').first().click())
      const image = page.locator('main [data-pda-image-preview-url]').first()
      assert.equal(await image.count(), 1)
      await act('product-image-open', () => image.click(), async () => { await page.waitForSelector('[data-pda-image-preview-root] img'); await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[data-pda-image-preview-root] img')].every(i => i.complete && i.naturalWidth > 0)) })
      await act('product-image-close', () => page.locator('[data-pda-image-preview-close]').last().click(), () => page.waitForSelector('[data-pda-image-preview-root]', {state:'detached'}))
      await act('product-collapse', () => page.locator('main details summary').first().click())
      await act('live-note', () => page.locator('[data-pcs-testing-field="live-note"]').fill('样衣全流程回归：试穿及直播记录完整'))
      await act('save-live', () => page.locator('[data-pcs-testing-action="save-live"]').click(), () => page.waitForSelector('[data-pcs-testing-action="bulk"]'))
      await act('bulk-note', () => page.locator('[data-pcs-testing-field="bulk-note"]').fill('先待定，再确认最终结果'))
      await act('bulk-pending', () => page.locator('[data-pcs-testing-action="bulk"][data-value="待定"]').click(), () => page.getByText('大货判断：', {exact:false}).first().waitFor())
      assert.ok((await page.locator('main').innerText()).includes('进行中'))
      const pendingOrder = await readOrder()
      assert.equal(pendingOrder.bulkDecision, '待定')
      assert.equal(pendingOrder.status, '进行中')
      await act('bulk-' + decision, () => page.locator(`[data-pcs-testing-action="bulk"][data-value="${decision}"]`).click(), () => page.waitForSelector('[data-pcs-testing-action="bulk"]', {state:'detached'}))
      assert.ok((await page.locator('main').innerText()).includes('已结束'))
      await page.reload(); await page.waitForSelector('[data-pcs-testing-action]')
      const text = await page.locator('main').innerText()
      assert.ok(text.includes('已结束'))
      const finalOrder = await readOrder()
      assert.equal(finalOrder.bulkDecision, decision)
      assert.equal(finalOrder.status, '已结束')
      assert.equal(finalOrder.liveSessionNote, '样衣全流程回归：试穿及直播记录完整')
      await context.close()
    }
    assert.deepEqual(errors, [])
    await writeFile('output/playwright/sample-wp05/testing-regression.json', JSON.stringify({passed:true, rounds:10, browser:browser.version(), base:'http://127.0.0.1:4207', errors, samples}, null, 2))
  } finally { await browser.close() }
})
