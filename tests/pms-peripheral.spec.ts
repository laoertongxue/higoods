import { chromium, expect, test, type Page } from '@playwright/test'

const INVENTORY = '/pms/material-inventory'
const TRANSIT_DASHBOARD = '/pms/transit/dashboard'
const TRANSIT_RECEIPTS = '/pms/transit/receipts'
const TRANSIT_CHECKS = '/pms/transit/order-checks'
const TRANSIT_TASKS = '/pms/transit/preparation-tasks'
const USERS = '/pms/users'
const ROLES = '/pms/roles'
const DICTIONARIES = '/pms/dictionaries'
const PERF_THRESHOLD = 200

async function measureAction(page: Page, clickSelector: string, readySelector: string): Promise<number> {
  return page.evaluate(
    async ({ clickSelector, readySelector }) => {
      const node = document.querySelector<HTMLElement>(clickSelector)
      if (!node) return -1
      const start = performance.now()
      node.click()
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000
        const check = () => {
          if (document.querySelector(readySelector)) requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          else if (performance.now() > deadline) reject(new Error(`等待 ${readySelector} 超时（点击 ${clickSelector}）`))
          else window.setTimeout(check, 4)
        }
        check()
      })
      return performance.now() - start
    },
    { clickSelector, readySelector },
  )
}

async function measureRouteSwitch(page: Page, toHref: string, toReadySelector: string): Promise<number> {
  return page.evaluate(
    async ({ toHref, toReadySelector }) => {
      const start = performance.now()
      document.querySelector<HTMLElement>(`[data-tab-href="${toHref}"]`)?.click()
      await new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000
        const check = () => {
          if (document.querySelector(toReadySelector)) requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          else if (performance.now() > deadline) reject(new Error(`等待 ${toReadySelector} 超时`))
          else window.setTimeout(check, 4)
        }
        check()
      })
      return performance.now() - start
    },
    { toHref, toReadySelector },
  )
}

test.describe('PMS 采购链路 P4 外围页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('八个外围路由可访问且不是占位页', async ({ page }) => {
    for (const [route, rootSelector, title] of [
      [INVENTORY, '[data-pms-inv-root]', '面辅料库存监控'],
      [TRANSIT_DASHBOARD, '[data-pms-trn-dash-root]', '中转仓数据总览'],
      [TRANSIT_RECEIPTS, '[data-pms-trnr-root]', '中转收货单列表'],
      [TRANSIT_CHECKS, '[data-pms-trno-root]', '生产单校验'],
      [TRANSIT_TASKS, '[data-pms-trnp-root]', '配料任务'],
      [USERS, '[data-pms-usr-root]', '用户管理'],
      [ROLES, '[data-pms-role-root]', '角色权限'],
      [DICTIONARIES, '[data-pms-dict-root]', '字典配置'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(rootSelector)).toBeVisible()
      await expect(page.locator('[data-page-content-root]')).not.toContainText('待迁移完整 UI')
    }
  })

  test('库存监控可修复规则异常并按建议量建单', async ({ page }) => {
    await page.goto(INVENTORY)
    await page.locator('[data-pms-inv-action="open-rule"][data-monitor-id="INV-2026-0005"]').click()
    await expect(page.locator('[data-pms-inv-rule-root]')).toBeVisible()
    await page.locator('[data-pms-inv-rule-field="triggerRatio"]').fill('0.5')
    await page.locator('[data-pms-inv-action="submit-rule"]').click()
    await expect(page.locator('[data-pms-inv-root]')).toContainText(/规则已保存：触发线 [\d,.]+，建议量 [\d,.]+，.*状态 正常/)

    await page.locator('[data-pms-inv-action="open-order"][data-monitor-id="INV-2026-0003"]').click()
    await expect(page.locator('[data-pms-inv-order-root]')).toBeVisible()
    await page.locator('[data-pms-inv-action="submit-order"]').click()
    await expect(page.locator('[data-pms-inv-root]')).toContainText(/已创建采购单 IPR-2026-\d+/)

    await page.locator('[data-pms-inv-action="open-logs"][data-monitor-id="INV-2026-0003"]').click()
    await expect(page.locator('[data-pms-inv-logs-root]')).toContainText('创建采购单')
    await page.keyboard.press('Escape')
  })

  test('中转看板指标跳转收货单并携带筛选', async ({ page }) => {
    await page.goto(TRANSIT_DASHBOARD)
    await page.locator('[data-pms-trnd-action="open-receipts"][data-filter="pending"]').first().click()
    await expect(page).toHaveURL(/\/pms\/transit\/receipts/)
    await expect(page.locator('[data-pms-trnr-root]')).toContainText('已按看板筛选：')
    await expect(page.locator('[data-pms-trnr-root]')).toContainText('待收货')
    await expect(page.locator('[data-pms-trnr-table-surface] tbody tr')).toHaveCount(3)
  })

  test('收货单卡片筛选与详情展示收货事实', async ({ page }) => {
    await page.goto(TRANSIT_RECEIPTS)
    await page.locator('[data-pms-trnr-action="apply-card"][data-card-filter="exception"]').click()
    await expect(page.locator('[data-pms-trnr-table-surface] tbody tr')).toHaveCount(1)
    await page.locator('[data-pms-trnr-action="open-detail"]').click()
    await expect(page.locator('[data-pms-trnr-root] [role="dialog"]')).toContainText('少 20 件')
    await page.locator('[data-pms-trnr-root] [role="dialog"] [data-pms-common-action="open-image"]').first().click()
    await expect(page.locator('[data-pms-trnr-overlays] [data-pms-common-action="close-image"]').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')

    await page.locator('[data-pms-trnr-action="apply-card"][data-card-filter=""]').click()
    await expect(page.locator('[data-pms-trnr-table-surface] tbody tr')).toHaveCount(7)
  })

  test('生产单校验与配料任务只读列表展示现有结果', async ({ page }) => {
    await page.goto(TRANSIT_CHECKS)
    await expect(page.locator('[data-pms-trno-table-surface] tbody tr')).toHaveCount(6)
    await expect(page.locator('[data-pms-trno-root]')).toContainText('只读读取生产单现有校验结果')
    await expect(page.locator('[data-pms-trno-root]')).toContainText('缺货')

    await page.goto(TRANSIT_TASKS)
    await expect(page.locator('[data-pms-trnp-table-surface] tbody tr')).toHaveCount(5)
    await expect(page.locator('[data-pms-trnp-root]')).toContainText('配料类型不作为任务完成状态')
  })

  test('系统设置三页按结果展示且无新增入口', async ({ page }) => {
    await page.goto(USERS)
    await expect(page.locator('[data-pms-usr-table-surface] tbody tr')).toHaveCount(8)
    await expect(page.locator('[data-pms-usr-root]')).not.toContainText('新增用户')

    await page.goto(ROLES)
    await expect(page.locator('[data-pms-role-table-surface] tbody tr')).toHaveCount(6)
    await expect(page.locator('[data-pms-role-root]')).not.toContainText('新增角色')

    await page.goto(DICTIONARIES)
    await expect(page.locator('[data-pms-dict-table-surface] tbody tr')).toHaveCount(10)
    await expect(page.locator('[data-pms-dict-root]')).not.toContainText('新增字典')
  })

  test('库存监控可维护工序链、批量刷新并生成加工单记录', async ({ page }) => {
    await page.goto(INVENTORY)
    await page.locator('[data-pms-inv-action="open-rule"][data-monitor-id="INV-2026-0001"]').click()
    await expect(page.locator('[data-pms-inv-rule-root]')).toBeVisible()
    await page.locator('[data-pms-inv-rule-process="绣花"]').check()
    await page.locator('[data-pms-inv-rule-field="greigeSku"]').fill('GREIGE-E2E-01')
    await page.locator('[data-pms-inv-rule-field="greigeStock"]').fill('1200')
    await page.locator('[data-pms-inv-action="submit-rule"]').click()
    await expect(page.locator('[data-pms-inv-root]')).toContainText('绣花')

    await page.locator('[data-pms-inv-action="refresh-stocks"]').click()
    await expect(page.locator('[data-pms-inv-root]')).toContainText(/已批量刷新 \d 条监控 SKU/)

    await page.locator('[data-pms-inv-action="open-order"][data-monitor-id="INV-2026-0001"]').click()
    await expect(page.locator('[data-pms-inv-order-root]')).toBeVisible()
    await page.locator('[data-pms-inv-order-type]').selectOption('调拨单')
    await page.locator('[data-pms-inv-sync-process]').check()
    await page.locator('[data-pms-inv-action="submit-order"]').click()
    await expect(page.locator('[data-pms-inv-root]')).toContainText(/已创建调拨单 ITR-2026-\d+.*同步加工单 PO-2026-/)

    await page.locator('[data-pms-inv-action="open-records"]').click()
    await expect(page.locator('[data-pms-inv-records-root]')).toContainText('加工单号链')
    await expect(page.locator('[data-pms-inv-records-root]')).toContainText('PO-2026-')
  })

  test('P4 页面站内切换与关键交互均低于 200ms', async ({ page }) => {
    await page.goto(INVENTORY)
    await expect(page.locator('[data-pms-inv-root]')).toBeVisible()

    const routes: Array<[string, string]> = [
      [TRANSIT_DASHBOARD, '[data-pms-trn-dash-root]'],
      [TRANSIT_RECEIPTS, '[data-pms-trnr-root]'],
      [TRANSIT_CHECKS, '[data-pms-trno-root]'],
      [TRANSIT_TASKS, '[data-pms-trnp-root]'],
      [USERS, '[data-pms-usr-root]'],
      [ROLES, '[data-pms-role-root]'],
      [DICTIONARIES, '[data-pms-dict-root]'],
      [INVENTORY, '[data-pms-inv-root]'],
    ]
    const switchSamples: number[] = []
    for (let index = 0; index < 5; index += 1) {
      for (const [href, selector] of routes) {
        switchSamples.push(await measureRouteSwitch(page, href, selector))
        await expect(page.locator(selector)).toBeVisible()
      }
    }
    for (const sample of switchSamples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, INVENTORY, '[data-pms-inv-root]')
    const inventoryInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      inventoryInteractions.push(await measureAction(page, '[data-pms-inv-action="open-rule"]', '[data-pms-inv-rule-root]'))
      await page.keyboard.press('Escape')
      inventoryInteractions.push(await measureAction(page, '[data-pms-inv-action="open-order"]:not([disabled])', '[data-pms-inv-order-root]'))
      await page.keyboard.press('Escape')
      inventoryInteractions.push(await measureAction(page, '[data-pms-inv-action="open-logs"]', '[data-pms-inv-logs-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of inventoryInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, TRANSIT_RECEIPTS, '[data-pms-trnr-root]')
    const receiptInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      receiptInteractions.push(await measureAction(page, '[data-pms-trnr-action="apply-card"][data-card-filter="exception"]', '[data-pms-trnr-table-surface] tbody tr'))
      receiptInteractions.push(await measureAction(page, '[data-pms-trnr-action="open-detail"]', '[data-pms-trnr-root] [role="dialog"]'))
      await page.keyboard.press('Escape')
      receiptInteractions.push(await measureAction(page, '[data-pms-trnr-action="apply-card"][data-card-filter=""]', '[data-pms-trnr-table-surface] tbody tr'))
    }
    for (const sample of receiptInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, USERS, '[data-pms-usr-root]')
    const settingInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      settingInteractions.push(await measureAction(page, '[data-pms-usr-action="query"]', '[data-pms-usr-table-surface] tbody tr'))
      settingInteractions.push(await measureAction(page, '[data-pms-usr-action="open-column-settings"]', '[data-pms-usr-overlays] .fixed'))
      await page.keyboard.press('Escape')
    }
    for (const sample of settingInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    console.log(
      JSON.stringify({
        pmsPeripheralPerf: {
          routeSwitch: switchSamples.map((value) => Math.round(value)),
          inventory: inventoryInteractions.map((value) => Math.round(value)),
          receipts: receiptInteractions.map((value) => Math.round(value)),
          settings: settingInteractions.map((value) => Math.round(value)),
        },
      }),
    )
  })
})
