import { chromium, expect, test } from '@playwright/test'
import { loadavg } from 'node:os'

const PERF_THRESHOLD = 1000
const routes: Array<[string, string]> = [
  ['/pms/purchase-suggestions', '[data-pms-psk-root]'],
  ['/pms/kol-demands', '[data-pms-kol-root]'],
  ['/pms/product-purchase-orders', '[data-pms-ppo-root]'],
  ['/pms/reorder', '[data-pms-ros-root]'],
  ['/pms/product-purchase-order-aftersales', '[data-pms-posa-root]'],
  ['/pms/material-requirements', '[data-pms-mreq-root]'],
  ['/pms/material-purchase-orders', '[data-pms-mpo-root]'],
  ['/pms/material-purchase-tracking', '[data-pms-mtrk-root]'],
  ['/pms/fitting-timeliness', '[data-pms-fit-root]'],
  ['/pms/material-supplier-confirmations', '[data-pms-conf-root]'],
  ['/pms/first-leg-shipments', '[data-pms-fls-root]'],
  ['/pms/first-leg-carriers', '[data-pms-flc-root]'],
  ['/pms/material-inventory', '[data-pms-inv-root]'],
  ['/pms/material-payment-requests', '[data-pms-pay-root]'],
  ['/pms/logistics-payment-requests', '[data-pms-pay-root]'],
  ['/pms/kol-sample-stock', '[data-pms-kst-root]'],
  ['/pms/kol-sample-apply', '[data-pms-kap-root]'],
  ['/pms/kol-sample-link', '[data-pms-kln-root]'],
  ['/pms/kol-sample-stock/lock-log', '[data-pms-klk-root]'],
  ['/pms/suppliers', '[data-pms-sup-root]'],
  ['/pms/supplier-supply-archives', '[data-pms-arc-root]'],
]

test.describe('PMS 隔离 context 首次访问性能专项', () => {
  test('PMS 21路由隔离context首次访问完整响应均不超过1000ms', async ({ baseURL }) => {
    test.setTimeout(300_000)
    if (!baseURL) throw new Error('缺少本机验收 baseURL，未启动采集')
    const origin = new URL(baseURL)
    if (!['http:', 'https:'].includes(origin.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) {
      throw new Error('此测试只允许本机隔离验收 origin，不能操作线上环境')
    }
    const hostLoadBefore = loadavg()
    const samples: Record<string, number[]> = {}
    const hostLoads: Record<string, number[][]> = {}
    const failures: Array<{ route: string; index: number; reason: string; status: '采集无效' }> = []
    // 同一专用浏览器内每个样本新 context；不称为每次新浏览器进程冷启动。
    // 不等待“低负载窗口”或丢弃真实慢样本，现场主机负载只作为证据记录。
    const browser = await chromium.launch()
    try {
      for (const [route, readySelector] of routes) {
        const list = samples[route] = []
        const loads = hostLoads[route] = []
        for (let index = 0; index < 5; index += 1) {
          const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } })
          try {
            const cold = await context.newPage()
            loads.push(loadavg())
            await cold.goto(route, { waitUntil: 'domcontentloaded' })
            const elapsed = await cold.evaluate(async ({ route, readySelector }) => {
              const complete = async (): Promise<number> => {
                while (true) {
                  const root = document.querySelector<HTMLElement>(readySelector)
                  const row = root?.querySelector<HTMLElement>('tbody tr')
                  if (location.pathname !== route || !root || !row?.textContent?.trim() || !root.getClientRects().length) {
                    await new Promise(resolve => requestAnimationFrame(resolve)); continue
                  }
                  const visible = (element: Element): boolean => {
                    const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
                  }
                  if ([...root.querySelectorAll('[data-pms-image-error]')].some(visible)) throw new Error('首屏必要图片加载失败')
                  const images = [...root.querySelectorAll<HTMLImageElement>('img')].filter(visible)
                  if (images.some(image => image.complete && image.naturalWidth === 0)) throw new Error('首屏必要图片加载失败')
                  if (images.some(image => !image.complete)) { await new Promise(resolve => requestAnimationFrame(resolve)); continue }
                  await document.fonts.ready
                  await Promise.all(images.map(image => image.decode()))
                  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
                  if (!root.isConnected || document.querySelector(readySelector) !== root) continue
                  return performance.now() // timeOrigin/navigationStart 起点，包含 Document 与模块等待。
                }
              }
              return Promise.race([
                complete(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`采集无效：等待 ${route} 完整内容/图片超时`)), 10_000)),
              ])
            }, { route, readySelector })
            list.push(elapsed) // 不 round，不丢弃超过 1000ms 的有效值。
          } catch (error) {
            failures.push({ route, index, reason: error instanceof Error ? error.message : String(error), status: '采集无效' })
            throw error
          } finally { await context.close() }
        }
      }
    } finally {
      const artifact = {
        identity: '专用Chromium内隔离context页面首次访问；非每样本新进程冷启动',
        baseURL, browserVersion: browser.version(), viewport: { width: 1366, height: 768 }, thresholdMs: PERF_THRESHOLD,
        completion: '目标路由真实表格内容、可见图片decode、字体就绪、2rAF；不清库、不预热、不等待quiet窗口',
        hostLoadBefore, hostLoadAfter: loadavg(), hostLoads, samples, failures,
        maxima: Object.fromEntries(Object.entries(samples).map(([route, values]) => [route, values.length ? Math.max(...values) : null])),
      }
      await test.info().attach('pms-context-first-visit-raw.json', { body: Buffer.from(JSON.stringify(artifact, null, 2)), contentType: 'application/json' })
      console.log(JSON.stringify({ pmsContextFirstVisitPerf: artifact }))
      await browser.close()
    }
    for (const [route, list] of Object.entries(samples)) {
      expect(list, `${route} 有效原始样本数`).toHaveLength(5)
      for (const value of list) {
        expect(value, `${route} 隔离context首次访问样本`).toBeGreaterThan(0)
        expect(value, `${route} 完整响应`).toBeLessThanOrEqual(PERF_THRESHOLD)
      }
    }
  })
})
