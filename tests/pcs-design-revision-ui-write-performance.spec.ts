import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, type Page } from '@playwright/test'

// Standalone real UI contract: npx tsx tests/pcs-design-revision-ui-write-performance.spec.ts
// Fresh isolated browser context per flow; no repository API writes or seeded state.
const baseURL = process.env.PCS_CHECK_URL || 'http://127.0.0.1:4173'
const out = path.resolve('output/playwright/pcs-consistency/design-revision-ui-write')
fs.mkdirSync(out, { recursive: true })
const results: any[] = [], verification: any[] = [], failures: any[] = [], errors: string[] = []
const image = path.resolve('public/design-revision-demo/style-prj-202603-012-blue-floral-polo-effect.jpg')
const pattern = path.resolve('public/design-revision-demo/style-prj-202603-012-polo-m.prj')
const route = '/pcs/production-preparation/design-revision'
const A = (v: string) => `[data-pcs-independent-sampling-action="${v}"]`
const F = (v: string) => `[data-pcs-independent-sampling-field="${v}"]`
function persist() { fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify({ baseURL, viewport: '1366x768', results, verification, failures, errors }, null, 2)) }

async function measure(page: Page, index: number, name: string, event: string, text: string, action: () => Promise<unknown>) {
  await page.evaluate(({ event, text }) => {
    const w = window as any; w.__uiWrite = null
    document.addEventListener(event, () => {
      const start = performance.now(), old = document.querySelector('[data-pcs-sampling-feedback]'); let frames = 0
      function tick() {
        const current = document.querySelector('[data-pcs-sampling-feedback]')
        const images = [...document.querySelectorAll('img')].filter(i => { const r = i.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 })
        const ready = current !== old && current?.textContent?.includes(text) && images.every(i => i.complete && i.naturalWidth > 0)
        frames = ready ? frames + 1 : 0
        if (frames >= 2) w.__uiWrite = { ms: performance.now() - start, images: images.length }
        else if (performance.now() - start > 8000) w.__uiWrite = { ms: performance.now() - start, error: current?.textContent || 'Expected completion not observed' }
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { once: true, capture: true })
  }, { event, text })
  await action()
  await page.waitForFunction(() => (window as any).__uiWrite !== null, null, { timeout: 10000 })
  const measurement = await page.evaluate(() => (window as any).__uiWrite)
  results.push({ index, name, ...measurement }); persist()
  assert.equal(measurement.error, undefined, `${name}: ${measurement.error}`)
}
async function saved(page: Page, id: string) {
  return page.evaluate(async id => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('higood-pcs-records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction(['records', 'files'], 'readonly')
    const read = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const [records, files] = await Promise.all([read(tx.objectStore('records').getAll()), read(tx.objectStore('files').getAll())])
    db.close()
    const row = records.find(r => r.collection.startsWith('higood-pcs-design-revision-v1/') && r.value?.data?.samplingTaskId === id)
    return { record: row?.value.data, fileCount: files.length, files: await Promise.all(files.map(async f => ({ id: f.id, size: f.blob.size, type: f.blob.type }))) }
  }, id)
}
const browser = await chromium.launch({ headless: true })
try {
  for (let index = 1; index <= 5; index++) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    await context.addInitScript('globalThis.__name = (value) => value')
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(`${index}: ${error.message}`))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`${index}: ${msg.text()}`) })
    try {
      await page.goto(`${baseURL}${route}`)
      await page.locator(A('open-create')).click()
      await page.locator('[data-design-style-picker="targetStyleId"] summary').click()
      await page.locator(F('targetStyleId')).selectOption('style_demand_PRJ_202603_012')
      await page.locator(F('creationReason')).fill(`QA隔离UI流程${index}，非真实生产成果`)
      await measure(page, index, 'read-design-file', 'input', '设计稿已读取', () => page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(image))
      await page.locator(A('add-bom-line')).click()
      await page.locator(F('sampleRequirementColor')).fill('蓝色')
      await page.locator(F('sampleRequirementNote')).fill('隔离Mock样衣要求')
      await measure(page, index, 'create-save-draft', 'click', '设计改款草稿已保存', () => page.locator(A('save-draft')).click())
      const id = new URL(page.url()).pathname.split('/').at(-1)!
      assert.notEqual(id, 'new')
      let state = await saved(page, id); assert.equal(state.record.status, 'DRAFT'); assert.equal(state.fileCount, 1)
      await page.reload(); await page.locator(A('save-draft')).waitFor()
      assert.equal(await page.locator(F('sampleRequirementNote')).inputValue(), '隔离Mock样衣要求')
      await page.locator(F('sampleRequirementNote')).fill(`修改保存${index}`)
      await measure(page, index, 'update-save-draft', 'click', '设计改款草稿已保存', () => page.locator(A('save-draft')).click())
      await page.reload(); await page.locator(A('save-draft')).waitFor()
      assert.equal(await page.locator(F('sampleRequirementNote')).inputValue(), `修改保存${index}`)
      await measure(page, index, 'replace-design-file', 'input', '新设计稿已保存', () => page.locator('[data-pcs-independent-sampling-replace-design-upload]').setInputFiles(image))
      state = await saved(page, id); assert.equal(state.record.designFiles.length, 2)
      await page.reload(); await page.locator(A('confirm-scheme')).waitFor()
      assert.equal(await page.locator('[data-design-revision-design-files] article').count(), 2)
      await measure(page, index, 'submit-scheme', 'click', '任务已提交', () => page.locator(A('confirm-scheme')).click())
      state = await saved(page, id); assert.ok(state.record.taskPlanConfirmedAt)
      const base = state.record.professionalTasks.find((t: any) => t.taskType === 'BASE_PATTERN')
      const sample = state.record.professionalTasks.find((t: any) => t.taskType === 'DISPLAY_SAMPLE')
      assert.ok(base && sample); assert.equal(sample.processWorkOrderRefs.length, 0)
      await page.reload(); await page.getByRole('heading', { name: '第二步：专业工作' }).waitFor()
      await page.goto(`${baseURL}/pcs/production-preparation/plate-making/${base.taskId}`)
      await measure(page, index, 'start-base-pattern', 'click', '任务已开始', () => page.locator(A('start-task')).click())
      await page.reload(); await page.locator(F('resultTitle')).waitFor()
      await measure(page, index, 'upload-base-pattern', 'input', '文件已真实读取并保存', () => page.locator('[data-pcs-independent-sampling-upload-input]').setInputFiles(pattern))
      await page.reload(); await page.locator(F('resultTitle')).waitFor()
      assert.ok((await page.locator('main').innerText()).includes(path.basename(pattern)))
      for (const [field, value] of [['resultTitle', `QA纸样${index}`], ['resultVersion', 'v1.0'], ['applicablePartOrSize', 'M码'], ['resultDescription', '本地演示PRJ，只验证原型提交流程']]) await page.locator(F(field)).fill(value)
      await measure(page, index, 'submit-base-pattern', 'click', '本次工作已提交', () => page.locator(A('submit-task')).click())
      await page.reload(); await page.getByText(`QA纸样${index}`, { exact: true }).waitFor()
      state = await saved(page, id); assert.equal(state.record.professionalTasks.find((t: any) => t.taskId === base.taskId).status, 'COMPLETED')
      await page.goto(`${baseURL}/pcs/production-preparation/display-sample/${sample.taskId}`)
      await measure(page, index, 'upload-display-sample', 'input', '文件已真实读取并保存', () => page.locator('[data-pcs-independent-sampling-upload-input]').setInputFiles(image))
      await page.reload(); await page.locator(F('sampleResultPattern')).waitFor()
      assert.ok((await page.locator('main').innerText()).includes(path.basename(image)))
      await page.locator(F('sampleResultPattern')).selectOption({ index: 1 })
      await page.locator(F('sampleResultNote')).fill('概念效果图仅用于隔离Mock流程，不代表真实样衣')
      await measure(page, index, 'submit-display-sample', 'click', '本次工作已提交', () => page.locator(A('submit-task')).click())
      await page.reload(); await page.getByText('本项工作已完成', { exact: true }).waitFor()
      state = await saved(page, id); assert.equal(state.record.status, 'COMPLETED'); assert.equal(state.record.professionalTasks.find((t: any) => t.taskId === sample.taskId).results.length, 1)
      verification.push({ index, id, completedAfterReload: true, status: state.record.status, fileCount: state.fileCount, files: state.files })
      await page.screenshot({ path: path.join(out, `completed-${index}.png`) })
    } catch (error) {
      failures.push({ index, url: page.url(), error: String(error), text: await page.locator('main').innerText().catch(() => '') })
      await page.screenshot({ path: path.join(out, `failure-${index}.png`) })
      persist(); break
    } finally { await context.close(); persist() }
  }
} finally { await browser.close(); persist() }
console.log(JSON.stringify({ samples: results.length, max: Math.max(...results.map(r => r.ms)), slow: results.filter(r => r.ms >= 500), failures, errors, completed: verification.length }, null, 2))
assert.equal(failures.length, 0)
assert.equal(verification.length, 5)
assert.equal(errors.length, 0)
assert.equal(results.filter(r => r.ms >= 500).length, 0)
