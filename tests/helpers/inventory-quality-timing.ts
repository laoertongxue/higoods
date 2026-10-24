import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const samples = new WeakMap<Page, Array<{ operation: string; durationMs: number; route: string }>>()
async function finish(page: Page, operation: string, navigation = false): Promise<void> {
  const result = await page.evaluate(async ({ operation, navigation }) => {
    // Re-read the same local record store before ending a save sample.
    const request = indexedDB.open('higood-pcs-records')
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try { await new Promise<void>((resolve, reject) => {
      const read = database.transaction('records').objectStore('records').getAll()
      read.onerror = () => reject(read.error)
      read.onsuccess = () => {
        const taskId = document.querySelector<HTMLElement>('[data-qc-workbench-task]')?.dataset.qcWorkbenchTask
        if (taskId && !read.result.some(row => !row.deleted && row.value?.qcTaskId === taskId)) { reject(new Error('目标质检单未持久回读')); return }
        resolve()
      }
    }) } finally { database.close() }
    await document.fonts.ready
    await Promise.all([...document.images].filter(image => image.getClientRects().length > 0).map(async image => {
      if (!image.complete) await new Promise<void>((resolve, reject) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => reject(new Error(`对应图片加载失败：${image.alt}`)), { once: true }) })
      if (!image.naturalWidth) throw new Error(`对应图片加载失败：${image.alt}`)
      if (image.decode) await image.decode()
    }))
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const start = navigation ? 0 : (window as any).__inventoryQcEventStart
    if (!Number.isFinite(start)) throw new Error('没有捕获真实操作事件，性能样本无效')
    return { operation, durationMs: performance.now() - start, route: location.pathname, navigation: navigation ? performance.getEntriesByType('navigation').map(entry=>entry.toJSON()) : undefined, resources: navigation ? performance.getEntriesByType('resource').map(entry=>({name:entry.name.split('/').at(-1),duration:entry.duration})).sort((a,b)=>b.duration-a.duration).slice(0,10) : undefined }
  }, { operation, navigation })
  const rows = samples.get(page) || []; rows.push(result); samples.set(page, rows)
}
export async function inventoryClick(page: Page, operation: string, button: Locator, ready: () => Promise<unknown>): Promise<void> {
  if (!process.env.INVENTORY_QC_PERF) { await button.click(); await ready(); return }
  await page.evaluate(() => document.addEventListener('click', () => { (window as any).__inventoryQcEventStart = performance.now() }, { capture: true, once: true }))
  await button.click(); await ready(); await finish(page, operation)
}
export async function inventoryNavigation(page: Page, operation: string, path: string, ready: () => Promise<unknown>): Promise<void> {
  await page.goto(path); await ready()
  if (process.env.INVENTORY_QC_PERF) await finish(page, operation, true)
}
export async function saveInventoryTimings(page: Page, info: TestInfo): Promise<void> {
  const rows = samples.get(page) || []
  if (!rows.length) return
  const result = { baseURL: info.project.use.baseURL, browser: info.project.use.browserName || 'chromium', browserVersion: page.context().browser()?.version(), viewport: page.viewportSize(), timeZone: await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone), version: process.env.INVENTORY_QC_VERSION || 'diagnostic', boundary: '真实click/navigation开始，目标内容/数量/状态和必要图片实际绘制且可交互；保存动作的ready包含持久回读', samples: rows }
  await writeFile(info.outputPath('inventory-performance.json'), JSON.stringify(result, null, 2))
  await info.attach('inventory-performance', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  if (process.env.INVENTORY_QC_PERF === 'formal') for (const row of rows) expect(row.durationMs, row.operation).toBeLessThanOrEqual(1000)
}
