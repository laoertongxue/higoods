import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => console.error(error.message))
  await page.addInitScript('globalThis.__name = (value) => value')
  const taskId = 'EM-DEMO-style_demand_PRJ_202603_011-SIZE_PATTERN_WOVEN'
  const legacyKey = 'higood:pcs:engineering-pattern-results:v1'
  await page.goto(`${process.env.PCS_CHECK_URL || 'http://127.0.0.1:5173'}/pcs/production-preparation/plate-making/${taskId}`)
  await page.locator('[data-plate-upload-input]').first().setInputFiles({ name: 'atomic.prj', mimeType: 'application/octet-stream', buffer: Buffer.from('isolated paper original') })
  await page.locator('[data-plate-upload-remove]').waitFor()
  const read = () => page.evaluate(async () => {
    // @ts-ignore Vite browser module.
    return (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records
  })
  const before = await read()
  console.log('upload saved')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (this.name === 'records' && value.collection?.startsWith('higood:pcs:engineering-pattern-results:v1')) {
        IDBObjectStore.prototype.put = original
        throw new DOMException('纸样成果配额不足验收', 'QuotaExceededError')
      }
      return original.call(this, value, ...args)
    }
  })
  await page.locator('[data-plate-action=submit-result]').click()
  console.log('submitted with fault')
  await page.locator('[data-plate-feedback]').filter({ hasText: '浏览器空间不足' }).waitFor()
  assert.deepEqual(await read(), before, 'pattern failure must also roll back task completion')
  assert.equal(await page.locator('[data-plate-upload-remove]').count(), 1, 'saved upload remains available for retry')
  await page.locator('[data-plate-action=submit-result]').click()
  await page.locator('[data-engineering-task-workbench]').filter({ hasText: '已完成' }).waitFor()
  const saved = await read()
  const version = saved.find((r: any) => r.id.endsWith(`${taskId}-PV-1`))
  assert.ok(version, 'result versions are individual IndexedDB records')
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), null)
  await page.reload()
  await page.locator('[data-plate-detail]').filter({ hasText: 'v1.0' }).waitFor()
  assert.deepEqual(await read(), saved, 'refresh must neither seed nor rewrite results')
  await page.locator('[data-plate-field=note]').fill('第二版')
  await page.locator('[data-plate-action=submit-result]').click()
  await page.locator('[data-plate-detail]').filter({ hasText: 'v2.0' }).waitFor()
  const updated = await read()
  assert.deepEqual(updated.find((r: any) => r.id === version.id), version, 'new version must not rewrite the first version')
  assert.equal(updated.filter((r: any) => r.collection === `${legacyKey}/items`).length, 2)
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), null)
  console.log('纸样成果与任务原子保存、失败回滚、刷新恢复、新版本不重写旧版本：通过')
} finally { await browser.close() }
