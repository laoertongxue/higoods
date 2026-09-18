import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const REQUIREMENTS = '/pms/material-requirements'
const MATERIAL_ORDERS = '/pms/material-purchase-orders'
const TRACKING = '/pms/material-purchase-tracking'
const CONFIRMATIONS = '/pms/material-supplier-confirmations'
const FIRST_LEG = '/pms/first-leg-shipments'
const CARRIERS = '/pms/first-leg-carriers'
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

test.describe('PMS 采购链路 P2 页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('六个 P2 路由可访问且不是占位页', async ({ page }) => {
    for (const [route, rootSelector, title] of [
      [REQUIREMENTS, '[data-pms-mreq-root]', '面辅料需求分析'],
      [MATERIAL_ORDERS, '[data-pms-mpo-root]', '面辅料采购单'],
      [TRACKING, '[data-pms-mtrk-root]', '面辅料采购跟踪'],
      [CONFIRMATIONS, '[data-pms-conf-root]', '面辅料供应商确认单'],
      [FIRST_LEG, '[data-pms-fls-root]', '头程物流'],
      [CARRIERS, '[data-pms-flc-root]', '头程物流商管理'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(rootSelector)).toBeVisible()
      await expect(page.locator('[data-page-content-root]')).not.toContainText('待迁移完整 UI')
    }
  })

  test('面辅料需求可下推生成采购单并回写状态', async ({ page }) => {
    await page.goto(REQUIREMENTS)
    await page.locator('[data-pms-mreq-action="open-push"][data-requirement-no="MREQ-0001"]').click()
    await expect(page.locator('[data-pms-mreq-push-root]')).toBeVisible()
    await expect(page.locator('[data-pms-mreq-push-root]')).toContainText('历史库存')
    await page.locator('[data-pms-mreq-action="submit-push"]').click()
    await expect(page.locator('[data-pms-mreq-root]')).toContainText(/已下推生成 \d 张面辅料采购单：CGF-2026-\d+/)
  })

  test('快递信息导入模板解析、校验与单号唯一阻断', async ({ page }) => {
    await page.goto(MATERIAL_ORDERS)
    const csvPath = test.info().outputPath('pms-logistics-import.csv')
    writeFileSync(
      csvPath,
      ['采购单号,物流公司,物流单号,发货日期,预计到达日期,箱数,卷数,数量,运费,备注', 'CGF-2026-0007,顺丰速运,SFTEST-E2E-001,2026-06-12,2026-06-15,2,2,300,120,端到端导入'].join('\n'),
    )
    await page.locator('[data-pms-mpo-action="open-import"]').click()
    await expect(page.locator('[data-pms-mpo-import-root]')).toBeVisible()
    await page.locator('[data-pms-mpo-field="import-file"]').setInputFiles(csvPath)
    await expect(page.locator('[data-pms-mpo-import-root]')).toContainText('SFTEST-E2E-001')
    await expect(page.locator('[data-pms-mpo-import-root]')).toContainText('校验通过')
    await page.locator('[data-pms-mpo-action="submit-import"]').click()
    await expect(page.locator('[data-pms-mpo-root]')).toContainText('已导入 1 条快递信息')

    await page.locator('[data-pms-mpo-action="open-import"]').click()
    await page.locator('[data-pms-mpo-field="import-file"]').setInputFiles(csvPath)
    await expect(page.locator('[data-pms-mpo-import-root]')).toContainText('已存在')
    await expect(page.locator('[data-pms-mpo-action="submit-import"]')).toBeDisabled()
    await page.keyboard.press('Escape')
  })

  test('采购跟踪可签收国内物流并加入头程', async ({ page }) => {
    await page.goto(TRACKING)
    const signButton = page.locator('[data-pms-mtrk-action="sign-domestic"]:not([disabled])').first()
    await signButton.click()
    await expect(page.locator('[data-pms-mtrk-root]')).toContainText('已国内签收')

    const joinButton = page.locator('[data-pms-mtrk-action="join-head"]:not([disabled])').first()
    await joinButton.click()
    await expect(page.locator('[data-pms-mtrk-join-root]')).toBeVisible()
    await page.locator('[data-pms-mtrk-action="submit-join"]').click()
    await expect(page.locator('[data-pms-mtrk-root]')).toContainText(/已创建头程物流单 FL-2026-\d+/)
  })

  test('供应商确认单生成标签后确认并回写采购单', async ({ page }) => {
    await page.goto(CONFIRMATIONS)
    await page.locator('[data-pms-conf-action="open-rolls"][data-confirmation-no="CONF-2026-0001"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toBeVisible()
    await page.locator('[data-pms-conf-action="generate-labels"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('已生成')
    await page.locator('[data-pms-conf-action="confirm-supplier"]').click()
    await page.locator('[data-pms-conf-action="confirm-supplier"]').click()
    await expect(page.locator('[data-pms-conf-root]')).toContainText('已确认并回写采购单')
  })

  test('头程物流可装柜推进且双表物流商页可打开渠道表单', async ({ page }) => {
    await page.goto(FIRST_LEG)
    await page.locator('[data-pms-fls-action="open-detail"][data-batch-no="FL-2026-0001"]').click()
    await expect(page.locator('[data-pms-fls-root] [role="dialog"]')).toBeVisible()
    await page.locator('[data-pms-fls-action="advance-status"][data-next-status="已装柜"]').click()
    await expect(page.locator('[data-pms-fls-root]')).toContainText('FL-2026-0001 已推进为已装柜')
    await page.keyboard.press('Escape')

    await page.goto(CARRIERS)
    await page.locator('[data-pms-flc-action="open-channels"][data-carrier-code="FL-CN-001"]').click()
    await expect(page.locator('[data-pms-flc-channels-root]')).toBeVisible()
    await page.locator('[data-pms-flc-action="open-channel-create"]').click()
    await expect(page.locator('[data-pms-flc-channel-form-root]')).toBeVisible()
    await expect(page.locator('[data-pms-flc-channel-form-root]')).toContainText('整柜价格配置')
    await expect(page.locator('[data-pms-flc-channel-form-root]')).toContainText('计费重系数')
    await expect(page.locator('[data-pms-flc-channel-form-root]')).toContainText('包清关')
    await page.goto(CARRIERS)
    await page.locator('[data-pms-flc-action="open-carrier-create"]').click()
    await expect(page.locator('[data-pms-flc-carrier-form-root]')).toContainText('微信')
    await expect(page.locator('[data-pms-flc-carrier-form-root]')).toContainText('账期天数')
  })

  test('面辅料采购单可带原因关闭', async ({ page }) => {
    await page.goto(MATERIAL_ORDERS)
    await page.locator('[data-pms-mpo-action="open-detail"][data-order-no="CGF-2026-0007"]').click()
    await expect(page.locator('[data-pms-mpo-detail-root]')).toBeVisible()
    await page.locator('[data-pms-mpo-action="open-close"]').click()
    await expect(page.locator('[data-pms-mpo-close-root]')).toBeVisible()
    await page.locator('[data-pms-mpo-close-reason]').fill('端到端关闭验证：供应商无法交付')
    await page.locator('[data-pms-mpo-action="submit-close"]').click()
    await expect(page.locator('[data-pms-mpo-root]')).toContainText('已关闭 CGF-2026-0007')
    await expect(page.locator('[data-pms-mpo-table-surface] tbody tr').filter({ hasText: 'CGF-2026-0007' })).toContainText('已关闭')
  })

  test('头程单可保存提货税费字段并批量装柜出运', async ({ page }) => {
    await page.goto(FIRST_LEG)
    await page.locator('[data-pms-fls-action="open-create"]').click()
    await expect(page.locator('[data-pms-fls-create-root]')).toBeVisible()
    await page.locator('[data-pms-fls-create-field="billOfLadingNo"]').fill('BL-E2E-0001')
    await page.locator('[data-pms-fls-create-field="shippingLineName"]').fill('E2E 船司')
    await page.locator('[data-pms-fls-create-field="cargoType"]').selectOption('空运')
    await page.locator('[data-pms-fls-create-field="inboundStatus"]').selectOption('已交货')
    await page.locator('[data-pms-fls-create-field="estimatedArrivalAt"]').fill('2026-07-01')
    await page.locator('[data-pms-fls-create-fee="logisticsFeeRmb"]').fill('1234')
    await page.locator('[data-pms-fls-create-check]').first().check()
    await page.locator('[data-pms-fls-action="submit-create"]').click()
    await expect(page.locator('[data-pms-fls-root]')).toContainText(/已创建头程单 FL-2026-\d+/)

    const createdRow = page.locator('[data-pms-fls-table-surface] tbody tr').filter({ hasText: 'BL-E2E-0001' })
    await createdRow.locator('[data-pms-fls-action="open-detail"]').click()
    await expect(page.locator('[data-pms-fls-root] [role="dialog"]')).toContainText('E2E 船司')
    await expect(page.locator('[data-pms-fls-root] [role="dialog"]')).toContainText('已交货')
    await expect(page.locator('[data-pms-fls-root] [role="dialog"]')).toContainText('1,234.00')
    await page.locator('[data-pms-fls-root] [role="dialog"] [data-pms-common-action="open-image"]').first().click()
    await expect(page.locator('[data-pms-fls-overlays] [data-pms-common-action="close-image"]').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')

    await createdRow.locator('input[data-pms-fls-field="select-row"]').check()
    await page.locator('[data-pms-fls-action="reset"]').click()
    await expect(page.locator('[data-pms-fls-action="batch-load"]')).toBeDisabled()
    await createdRow.locator('input[data-pms-fls-field="select-row"]').check()
    await page.locator('[data-pms-fls-action="batch-load"]').click()
    await expect(page.locator('[data-pms-fls-root]')).toContainText('已批量装柜 1 张头程单')
    const loadedRow = page.locator('[data-pms-fls-table-surface] tbody tr').filter({ hasText: 'BL-E2E-0001' })
    await loadedRow.locator('input[data-pms-fls-field="select-row"]').check()
    await page.locator('[data-pms-fls-action="batch-ship"]').click()
    await expect(page.locator('[data-pms-fls-root]')).toContainText('已批量确认出运 1 张头程单')
  })

  test('供应商确认可生成卷号、维护箱规包装明细并切换上下张', async ({ page }) => {
    await page.goto(CONFIRMATIONS)
    await page.locator('[data-pms-conf-action="open-rolls"][data-confirmation-no="CONF-2026-0004"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toBeVisible()
    await page.locator('[data-pms-conf-rolls-prefix]').fill('ROLL-E2E')
    await page.locator('[data-pms-conf-rolls-meters]').fill('200')
    await expect(page.locator('[data-pms-conf-rolls-count]')).toHaveValue('4')
    await page.locator('[data-pms-conf-rolls-start]').fill('5')
    await page.locator('[data-pms-conf-action="generate-rolls"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('ROLL-E2E-5')

    await page.locator('[data-pms-conf-box-no]').fill('BOX-E2E-1')
    await page.locator('[data-pms-conf-box-length]').fill('60')
    await page.locator('[data-pms-conf-box-width]').fill('40')
    await page.locator('[data-pms-conf-box-height]').fill('30')
    await page.locator('[data-pms-conf-action="add-box-spec"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('BOX-E2E-1')
    await page.locator('[data-pms-conf-action="delete-box-spec"][data-box-no="BOX-E2E-1"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('确认删除箱规')
    await page.locator('[data-pms-conf-action="delete-box-spec"][data-box-no="BOX-E2E-1"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).not.toContainText('BOX-E2E-1')

    await page.locator('[data-pms-conf-package-method]').selectOption('袋装')
    await page.locator('[data-pms-conf-package-qty]').fill('10')
    await page.locator('[data-pms-conf-package-unit]').fill('卷')
    await page.locator('[data-pms-conf-action="add-package-detail"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('袋装')

    await page.locator('[data-pms-conf-action="prev-confirmation"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('第 3 /')
    await page.locator('[data-pms-conf-action="next-confirmation"]').click()
    await expect(page.locator('[data-pms-conf-rolls-root]')).toContainText('第 4 /')
  })

  test('P2 页面站内切换与关键交互均低于 200ms', async ({ page }) => {
    await page.goto(REQUIREMENTS)
    await expect(page.locator('[data-pms-mreq-root]')).toBeVisible()

    const routes: Array<[string, string]> = [
      [MATERIAL_ORDERS, '[data-pms-mpo-root]'],
      [TRACKING, '[data-pms-mtrk-root]'],
      [CONFIRMATIONS, '[data-pms-conf-root]'],
      [FIRST_LEG, '[data-pms-fls-root]'],
      [CARRIERS, '[data-pms-flc-root]'],
      [REQUIREMENTS, '[data-pms-mreq-root]'],
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

    await measureRouteSwitch(page, REQUIREMENTS, '[data-pms-mreq-root]')
    const requirementInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      requirementInteractions.push(await measureAction(page, '[data-pms-mreq-action="query"]', '[data-pms-mreq-table-surface] tbody tr'))
      requirementInteractions.push(await measureAction(page, '[data-pms-mreq-action="open-push"]:not([disabled])', '[data-pms-mreq-push-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of requirementInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, MATERIAL_ORDERS, '[data-pms-mpo-root]')
    const orderInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      orderInteractions.push(await measureAction(page, '[data-pms-mpo-action="open-import"]', '[data-pms-mpo-import-root]'))
      await page.keyboard.press('Escape')
      orderInteractions.push(await measureAction(page, '[data-pms-mpo-action="open-detail"]', '[data-pms-mpo-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of orderInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, TRACKING, '[data-pms-mtrk-root]')
    const trackingInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      trackingInteractions.push(await measureAction(page, '[data-pms-mtrk-action="query"]', '[data-pms-mtrk-table-surface] tbody tr'))
      trackingInteractions.push(await measureAction(page, '[data-pms-common-action="open-image"]', '[data-pms-mtrk-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of trackingInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, CONFIRMATIONS, '[data-pms-conf-root]')
    const confirmationInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      confirmationInteractions.push(await measureAction(page, '[data-pms-conf-action="open-rolls"]', '[data-pms-conf-rolls-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of confirmationInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, FIRST_LEG, '[data-pms-fls-root]')
    const firstLegInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      firstLegInteractions.push(await measureAction(page, '[data-pms-fls-action="open-detail"]', '[data-pms-fls-root] [role="dialog"]'))
      await page.keyboard.press('Escape')
      firstLegInteractions.push(await measureAction(page, '[data-pms-fls-action="open-create"]', '[data-pms-fls-create-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of firstLegInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, CARRIERS, '[data-pms-flc-root]')
    const carrierInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      carrierInteractions.push(await measureAction(page, '[data-pms-flc-action="open-channels"]', '[data-pms-flc-channels-root]'))
      await page.keyboard.press('Escape')
      carrierInteractions.push(await measureAction(page, '[data-pms-flc-action="open-carrier-create"]', '[data-pms-flc-carrier-form-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of carrierInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    console.log(
      JSON.stringify({
        pmsMaterialPerf: {
          routeSwitch: switchSamples.map((value) => Math.round(value)),
          requirements: requirementInteractions.map((value) => Math.round(value)),
          materialOrders: orderInteractions.map((value) => Math.round(value)),
          tracking: trackingInteractions.map((value) => Math.round(value)),
          confirmations: confirmationInteractions.map((value) => Math.round(value)),
          firstLeg: firstLegInteractions.map((value) => Math.round(value)),
          carriers: carrierInteractions.map((value) => Math.round(value)),
        },
      }),
    )
  })
})
