import { chromium, expect, test } from '@playwright/test'
import { loadavg } from 'node:os'

const PERF_THRESHOLD = 200

test.describe('PMS 冷启动性能专项', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('PMS 全部路由首次进入（冷启动）均低于 200ms', async () => {
    test.setTimeout(300_000)
    const quietDeadline = Date.now() + 90_000
    while (loadavg()[0] > 3 && Date.now() < quietDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    const hostLoad = loadavg()[0]
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const routes: Array<[string, string]> = [
      ['/pms/workbench/overview', '[data-pms-workbench-root]'],
      ['/pms/purchase-suggestions', '[data-pms-psk-root]'],
      ['/pms/kol-demands', '[data-pms-kol-root]'],
      ['/pms/product-purchase-orders', '[data-pms-ppo-root]'],
      ['/pms/material-requirements', '[data-pms-mreq-root]'],
      ['/pms/material-purchase-orders', '[data-pms-mpo-root]'],
      ['/pms/material-purchase-tracking', '[data-pms-mtrk-root]'],
      ['/pms/material-supplier-confirmations', '[data-pms-conf-root]'],
      ['/pms/first-leg-shipments', '[data-pms-fls-root]'],
      ['/pms/first-leg-carriers', '[data-pms-flc-root]'],
      ['/pms/trade-subjects', '[data-pms-ts-root]'],
      ['/pms/suppliers', '[data-pms-sup-root]'],
      ['/pms/supplier-supply-archives', '[data-pms-arc-root]'],
      ['/pms/material-archives', '[data-pms-mat-root]'],
      ['/pms/garment-skus', '[data-pms-sku-root]'],
      ['/pms/sample-skus', '[data-pms-sku-root]'],
      ['/pms/warehouses', '[data-pms-wh-root]'],
      ['/pms/units', '[data-pms-unit-root]'],
      ['/pms/bom-templates', '[data-pms-bom-root]'],
      ['/pms/bom-templates/HG-TS-2601', '[data-pms-bomd-root]'],
      ['/pms/subject-operations', '[data-pms-so-root]'],
      ['/pms/material-reconciliations', '[data-pms-mrec-root]'],
      ['/pms/logistics-reconciliations', '[data-pms-lrec-root]'],
      ['/pms/material-payment-requests', '[data-pms-pay-root]'],
      ['/pms/logistics-payment-requests', '[data-pms-pay-root]'],
      ['/pms/material-inventory', '[data-pms-inv-root]'],
      ['/pms/transit/dashboard', '[data-pms-trn-dash-root]'],
      ['/pms/transit/receipts', '[data-pms-trnr-root]'],
      ['/pms/transit/order-checks', '[data-pms-trno-root]'],
      ['/pms/transit/preparation-tasks', '[data-pms-trnp-root]'],
      ['/pms/users', '[data-pms-usr-root]'],
      ['/pms/roles', '[data-pms-role-root]'],
      ['/pms/dictionaries', '[data-pms-dict-root]'],
      ['/pms/purchase-order', '[data-pms-lace-purchase-root]'],
    ]
    const browser = await chromium.launch()
    const samples: Record<string, number[]> = {}
    try {
    for (const [route, readySelector] of routes) {
      const list: number[] = []
      for (let index = 0; index < 5; index += 1) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
        const cold = await context.newPage()
        await cold.goto(route)
        await cold.waitForSelector(readySelector)
        const elapsed = await cold.evaluate(() => performance.now())
        list.push(elapsed)
        await context.close()
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      samples[route] = list.map((value) => Math.round(value))
    }
    } finally {
      await browser.close()
    }
    console.log(JSON.stringify({ pmsColdLoadPerf: { hostLoad1: Number(hostLoad.toFixed(2)), samples } }))
    for (const [route, list] of Object.entries(samples)) {
      for (const value of list) {
        expect(value, `${route} 冷启动样本`).toBeGreaterThanOrEqual(0)
        expect(value, `${route} 冷启动样本`).toBeLessThan(PERF_THRESHOLD)
      }
    }
  })

})

