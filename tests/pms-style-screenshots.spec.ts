import { chromium, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'docs/verification-evidence/2026-09-18-style-alignment')

const ROUTES: Array<[string, string]> = [
  ['dye-work-orders(fcs-reference)', '/fcs/craft/dyeing/work-orders'],
  ['pms-purchase-suggestions', '/pms/purchase-suggestions'],
  ['pms-kol-demands', '/pms/kol-demands'],
  ['pms-product-purchase-orders', '/pms/product-purchase-orders'],
  ['pms-material-requirements', '/pms/material-requirements'],
  ['pms-material-purchase-orders', '/pms/material-purchase-orders'],
  ['pms-material-purchase-tracking', '/pms/material-purchase-tracking'],
  ['pms-material-supplier-confirmations', '/pms/material-supplier-confirmations'],
  ['pms-first-leg-shipments', '/pms/first-leg-shipments'],
  ['pms-first-leg-carriers', '/pms/first-leg-carriers'],
  ['pms-suppliers', '/pms/suppliers'],
  ['pms-supplier-supply-archives', '/pms/supplier-supply-archives'],
  ['pms-material-payment-requests', '/pms/material-payment-requests'],
  ['pms-logistics-payment-requests', '/pms/logistics-payment-requests'],
  ['pms-material-inventory', '/pms/material-inventory'],
]

test('capture style alignment screenshots', async () => {
  test.setTimeout(300_000)
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  for (const [name, route] of ROUTES) {
    await page.goto(route)
    await page.waitForSelector('[data-page-content-root]')
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false })
    await page.screenshot({ path: join(OUT, `${name}--full.png`), fullPage: true })
  }
  await context.close()
  await browser.close()
})
