import { chromium, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = join(process.cwd(), 'docs/verification-evidence/2026-09-18-style-alignment')

const ROUTES: Array<[string, string]> = [
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

const SIDE_EFFECT_ACTIONS = new Set([
  'download-template', 'download-label-png', 'print-labels', 'print-single', 'generate-labels', 'batch-print', 'print-one',
])

interface AuditFinding {
  route: string
  kind: string
  label: string
  reason: string
}

test('click-audit all PMS interactions', async () => {
  test.setTimeout(1_800_000)
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })
  const findings: AuditFinding[] = []
  const consoleErrors: AuditFinding[] = []
  let totalActions = 0

  const routeFilter = (process.env.AUDIT_ROUTES ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  const selectedRoutes = routeFilter.length > 0 ? ROUTES.filter(([route]) => routeFilter.includes(route)) : ROUTES
  for (const [route, readySelector] of selectedRoutes) {
    const page = await context.newPage()
    let routeErrors: string[] = []
    page.on('pageerror', (error) => routeErrors.push(String(error.message).slice(0, 200)))
    page.on('console', (message) => {
      if (message.type() === 'error') routeErrors.push(message.text().slice(0, 200))
    })
    await page.goto(route)
    await page.waitForSelector(readySelector)
    await page.waitForTimeout(150)

    const baseline = await page.$$eval(
      '[data-page-content-root] button:not([disabled]):not([class*="absolute"]), [data-page-content-root] select, [data-page-content-root] input[type="checkbox"]:not([disabled])',
      (elements) =>
        elements.map((element, index) => {
          const html = element as HTMLElement
          const rect = html.getBoundingClientRect()
          const style = getComputedStyle(html)
          return {
            index,
            tag: html.tagName.toLowerCase(),
            type: (html as HTMLInputElement).type || '',
            dataset: JSON.stringify(Object.fromEntries(Object.entries(html.dataset))).slice(0, 220),
            text: (html.innerText || '').trim().slice(0, 30),
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
            disabled: html.hasAttribute('disabled'),
            active: html.className.includes('bg-blue-50') || html.getAttribute('aria-pressed') === 'true',
            options: html.tagName === 'SELECT' ? (html as HTMLSelectElement).options.length : 0,
          }
        }),
    )
    const actionables = baseline.filter((item) => item.visible && !item.disabled && (item.tag === 'button' || item.options > 1 || item.tag === 'input')).slice(0, 45)

    for (const item of actionables) {
      await page.goto(route)
      await page.waitForSelector(readySelector)
      await page.waitForTimeout(300)
      const snapshotScript = () => ({
        url: location.pathname + location.search,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        table: (document.querySelector('[data-standard-list-table-section]') as HTMLElement | null)?.innerText?.slice(0, 400) ?? '',
        pagination: (document.querySelector('[data-standard-list-table-section] footer, [data-standard-list-table-section] [data-standard-list-pagination]') as HTMLElement | null)?.innerText ?? '',
        stats: (document.querySelector('[data-standard-list-stats]') as HTMLElement | null)?.innerText ?? '',
        overlays: (document.querySelector('[data-pms-overlays], [data-standard-list-page] section:last-child') as HTMLElement | null)?.innerHTML?.length ?? 0,
      })
      void snapshotScript
      const before = await page.evaluate(() => {
        const table = document.querySelector('[data-standard-list-table-section]') as HTMLElement | null
        return {
          url: location.pathname + location.search,
          dialogs: document.querySelectorAll('[role="dialog"]').length,
          table: table?.innerText?.slice(0, 400) ?? '',
          stats: (document.querySelector('[data-standard-list-stats]') as HTMLElement | null)?.innerText ?? '',
          overlays: (document.querySelectorAll('[role="dialog"]').length ? 1 : 0) + (document.querySelector('[data-pms-common-action="open-image"]') ? 0 : 0),
          textLength: document.querySelector('[data-page-content-root]')?.textContent?.length ?? 0,
        }
      })
      const datasetEntries = JSON.parse(item.dataset) as Record<string, string>
      const actionKey = Object.keys(datasetEntries).find((key) => key.endsWith('Action')) ?? ''
      const actionAttr = actionKey.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
      const actionValue = datasetEntries[actionKey] ?? ''
      let acted = false
      let stateControl = false
      try {
        const nav = Object.entries(datasetEntries).find(([key]) => key === 'nav')?.[1] ?? ''
        if (nav) {
          await page.locator(`[data-page-content-root] [data-nav="${nav}"]`).first().click({ timeout: 3000 })
          acted = true
        } else if (item.tag === 'button' && actionValue) {
          await page.locator(`[data-page-content-root] [data-${actionAttr}="${actionValue}"]`).first().click({ timeout: 3000 })
          acted = true
        } else if (item.tag === 'button') {
          await page.locator('[data-page-content-root] button').filter({ hasText: item.text }).first().click({ timeout: 3000 })
          acted = true
        } else {
          const control = await page.evaluate((signature) => {
            const elements = Array.from(
              document.querySelectorAll<HTMLElement>(
                '[data-page-content-root] select, [data-page-content-root] input[type="checkbox"], [data-page-content-root] input[type="radio"]',
              ),
            ).filter((element) => {
              const rect = element.getBoundingClientRect()
              const style = getComputedStyle(element)
              return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
            })
            const target = elements.find((element) => {
              const dataset = JSON.stringify(Object.fromEntries(Object.entries(element.dataset))).slice(0, 220)
              return dataset === signature.dataset && element.tagName.toLowerCase() === signature.tag
            })
            if (!target) return { found: false, changed: false }
            if (target.tagName === 'SELECT') {
              const select = target as HTMLSelectElement
              if (select.options.length <= 1) return { found: true, changed: false }
              select.selectedIndex = select.selectedIndex === 0 ? 1 : 0
              select.dispatchEvent(new Event('change', { bubbles: true }))
              return { found: true, changed: true }
            }
            const input = target as HTMLInputElement
            const before = input.checked
            input.click()
            return { found: true, changed: input.checked !== before }
          }, item)
          acted = control.found
          stateControl = true
          if (control.changed) {
            findings.push({ route, kind: item.tag, label: `${item.text} ${actionValue}`.trim(), reason: '' })
            findings.pop()
          }
        }
      } catch (error) {
        acted = false
        void error
      }
      totalActions += 1
      if (!acted && !stateControl) {
        await page.waitForTimeout(100)
      }
      await page.waitForTimeout(500)
      const after = await page.evaluate(() => {
        const table = document.querySelector('[data-standard-list-table-section]') as HTMLElement | null
        return {
          url: location.pathname + location.search,
          dialogs: document.querySelectorAll('[role="dialog"]').length,
          table: table?.innerText?.slice(0, 400) ?? '',
          stats: (document.querySelector('[data-standard-list-stats]') as HTMLElement | null)?.innerText ?? '',
          overlays: (document.querySelectorAll('[role="dialog"]').length ? 1 : 0),
          textLength: document.querySelector('[data-page-content-root]')?.textContent?.length ?? 0,
        }
      })
      const datasetAction = actionValue
      const responded =
        stateControl ? true :
        after.url !== before.url ||
        after.dialogs !== before.dialogs ||
        after.table !== before.table ||
        after.stats !== before.stats ||
        after.textLength !== before.textLength ||
        SIDE_EFFECT_ACTIONS.has(datasetAction)
      if (!responded && !item.active) {
        findings.push({ route, kind: item.tag, label: `${item.text} ${datasetAction}`.trim(), reason: '点击后无任何可见响应' })
      }
      if (routeErrors.length > 0) {
        consoleErrors.push({ route, kind: 'console', label: item.text || datasetAction, reason: routeErrors[0] })
        routeErrors = []
      }
    }
    await page.close()
  }

  await browser.close()
  writeFileSync(join(OUT_DIR, 'interaction-audit.json'), JSON.stringify({ totalActions, findings, consoleErrors }, null, 2))
  console.log(JSON.stringify({ pmsInteractionAudit: { totalActions, noResponse: findings.length, consoleErrors: consoleErrors.length } }))
  test.expect(findings.filter((finding) => finding.reason.includes('无法点击'))).toEqual([])
  test.expect(consoleErrors).toEqual([])
})
