import { chromium, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'docs/verification-evidence/2026-09-18-style-alignment')

const ROUTES: Array<[string, string]> = [
  ['dye-work-orders(fcs-reference)', '/fcs/craft/dyeing/work-orders'],
  ['pms-workbench', '/pms/workbench/overview'],
  ['pms-purchase-suggestions', '/pms/purchase-suggestions'],
  ['pms-kol-demands', '/pms/kol-demands'],
  ['pms-product-purchase-orders', '/pms/product-purchase-orders'],
  ['pms-material-requirements', '/pms/material-requirements'],
  ['pms-material-purchase-orders', '/pms/material-purchase-orders'],
  ['pms-material-purchase-tracking', '/pms/material-purchase-tracking'],
  ['pms-material-supplier-confirmations', '/pms/material-supplier-confirmations'],
  ['pms-first-leg-shipments', '/pms/first-leg-shipments'],
  ['pms-first-leg-carriers', '/pms/first-leg-carriers'],
  ['pms-trade-subjects', '/pms/trade-subjects'],
  ['pms-suppliers', '/pms/suppliers'],
  ['pms-supplier-supply-archives', '/pms/supplier-supply-archives'],
  ['pms-material-archives', '/pms/material-archives'],
  ['pms-garment-skus', '/pms/garment-skus'],
  ['pms-sample-skus', '/pms/sample-skus'],
  ['pms-warehouses', '/pms/warehouses'],
  ['pms-units', '/pms/units'],
  ['pms-bom-templates', '/pms/bom-templates'],
  ['pms-bom-detail', '/pms/bom-templates/HG-TS-2601'],
  ['pms-subject-operations', '/pms/subject-operations'],
  ['pms-material-reconciliations', '/pms/material-reconciliations'],
  ['pms-logistics-reconciliations', '/pms/logistics-reconciliations'],
  ['pms-material-payment-requests', '/pms/material-payment-requests'],
  ['pms-logistics-payment-requests', '/pms/logistics-payment-requests'],
  ['pms-material-inventory', '/pms/material-inventory'],
  ['pms-transit-dashboard', '/pms/transit/dashboard'],
  ['pms-transit-receipts', '/pms/transit/receipts'],
  ['pms-transit-order-checks', '/pms/transit/order-checks'],
  ['pms-transit-preparation-tasks', '/pms/transit/preparation-tasks'],
  ['pms-users', '/pms/users'],
  ['pms-roles', '/pms/roles'],
  ['pms-dictionaries', '/pms/dictionaries'],
  ['pms-purchase-order', '/pms/purchase-order'],
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
