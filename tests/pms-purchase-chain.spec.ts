import { expect, test, type Page } from '@playwright/test'

const WORKBENCH = '/pms/workbench/overview'
const SUGGESTIONS = '/pms/purchase-suggestions'
const KOL = '/pms/kol-demands'
const PPO = '/pms/product-purchase-orders'
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
      await new Promise<void>((resolve) => {
        const check = () => {
          if (document.querySelector(toReadySelector)) requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          else window.setTimeout(check, 4)
        }
        check()
      })
      return performance.now() - start
    },
    { toHref, toReadySelector },
  )
}

test.describe('PMS 采购链路 P1 页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('四个 P1 路由可直接进入且不是占位页', async ({ page }) => {
    for (const [route, rootSelector, title] of [
      [WORKBENCH, '[data-pms-workbench-root]', '采购管理工作台'],
      [SUGGESTIONS, '[data-pms-psk-root]', '商品采购建议'],
      [KOL, '[data-pms-kol-root]', 'KOL 采购需求'],
      [PPO, '[data-pms-ppo-root]', '商品采购单'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(rootSelector)).toBeVisible()
      await expect(page.locator('[data-page-content-root]')).not.toContainText('待迁移完整 UI')
    }
  })

  test('商品采购建议可筛选、查看明细并生成商品采购单', async ({ page }) => {
    await page.goto(SUGGESTIONS)
    await expect(page.locator('[data-pms-psk-root]')).toBeVisible()

    await page.locator('[data-pms-psk-field="status"]').selectOption('待生成')
    await page.locator('[data-pms-psk-action="query"]').click()
    await expect(page.locator('[data-pms-psk-table-surface] tbody tr').first()).toBeVisible()

    await page.locator('[data-pms-psk-action="open-detail"]').first().click()
    await expect(page.locator('[data-pms-psk-overlays] [role="dialog"]')).toBeVisible()
    await expect(page.locator('[data-pms-psk-overlays]')).toContainText('缺口 = max(0, 待发货 + KOL 申请 − 采购中 − 实时库存)')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-pms-psk-overlays] [role="dialog"]')).toHaveCount(0)

    const firstRowCheckbox = page.locator('input[data-pms-psk-field="select-row"]').first()
    await firstRowCheckbox.check()
    await page.locator('[data-pms-psk-action="open-generate-selected"]').click()
    await expect(page.locator('[data-pms-psk-generate]')).toBeVisible()
    await page.locator('[data-pms-psk-action="submit-generate"]').click()
    await expect(page.locator('[data-pms-psk-root]')).toContainText(/已生成 1 张商品采购单：CG-2026-\d+/)
  })

  test('KOL 需求可入库并记录操作事实', async ({ page }) => {
    await page.goto(KOL)
    const inboundButton = page.locator('[data-pms-kol-action="open-inbound"]:not([disabled])').first()
    await inboundButton.click()
    await expect(page.locator('[data-pms-kol-inbound-root]')).toBeVisible()
    await page.locator('[data-pms-kol-action="submit-inbound"]').click()
    await expect(page.locator('[data-pms-kol-root]')).toContainText(/已完成 1 张 KOL 需求入库，合计 [\d,]+ 件/)
    await expect(page.locator('[data-pms-kol-table-surface]')).toContainText('已驳回')

    const rejectRow = page.locator('[data-pms-kol-table-surface] tbody tr').filter({ hasText: 'KOL-2026-0006' })
    await rejectRow.locator('input[data-pms-kol-field="select-row"]').check()
    await page.locator('[data-pms-kol-action="open-batch-reject"]').click()
    await expect(page.locator('[data-pms-kol-reject-root]')).toBeVisible()
    await page.locator('[data-pms-kol-reject-reason]').fill('端到端批量驳回验证')
    await page.locator('[data-pms-kol-action="submit-reject"]').click()
    await expect(page.locator('[data-pms-kol-root]')).toContainText('已批量驳回 1 张需求')
  })

  test('商品采购单可生成面辅料需求并回写状态', async ({ page }) => {
    await page.goto(PPO)
    await page.locator('[data-pms-ppo-action="open-generate"][data-order-no="CG-2026-0016"]').click()
    await expect(page.locator('[data-pms-ppo-generate-root]')).toBeVisible()
    await page.locator('[data-pms-ppo-action="submit-generate"]').click()
    await expect(page.locator('[data-pms-ppo-root]')).toContainText(/已生成面辅料需求 MREQ-\d+/)
    await expect(page.locator('[data-pms-ppo-table-surface]')).toContainText('已生成')
  })

  test('款式缩略图支持大图预览与 Esc 关闭', async ({ page }) => {
    await page.goto(PPO)
    const thumbnail = page.locator('[data-pms-common-action="open-image"]').first()
    await thumbnail.click()
    await expect(page.locator('[data-pms-root] [role="dialog"], [role="dialog"]').last()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  })

  test('商品采购单详情展示采购专员、金额与 BOM 信息', async ({ page }) => {
    await page.goto(PPO)
    await page.locator('[data-pms-ppo-action="open-detail"]').first().click()
    const dialog = page.locator('[data-pms-ppo-root] [role="dialog"]').last()
    await expect(dialog).toContainText('采购专员')
    await expect(dialog).toContainText('采购金额')
    await expect(dialog).toContainText('BOM 编号')
    await expect(dialog).toContainText('申请人')
    await page.keyboard.press('Escape')
  })

  test('P1 页面首次进入与关键交互均低于 200ms', async ({ page }) => {
    const coldSamples: number[] = []
    const browser = page.context().browser()
    if (!browser) throw new Error('浏览器实例不可用')
    for (const [route, rootSelector] of [
      [WORKBENCH, '[data-pms-workbench-root]'],
      [SUGGESTIONS, '[data-pms-psk-root]'],
      [KOL, '[data-pms-kol-root]'],
      [PPO, '[data-pms-ppo-root]'],
    ] as const) {
      const coldContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
      const coldPage = await coldContext.newPage()
      await coldPage.addInitScript((selector: string) => {
        const start = performance.now()
        ;(window as unknown as { __pmsColdReady: number | null }).__pmsColdReady = null
        const check = () => {
          if (document.querySelector(selector)) {
            ;(window as unknown as { __pmsColdReady: number | null }).__pmsColdReady = performance.now() - start
            return
          }
          requestAnimationFrame(check)
        }
        requestAnimationFrame(check)
      }, rootSelector)
      await coldPage.goto(route)
      await coldPage.waitForFunction(() => (window as unknown as { __pmsColdReady: number | null }).__pmsColdReady !== null)
      coldSamples.push(await coldPage.evaluate(() => (window as unknown as { __pmsColdReady: number | null }).__pmsColdReady ?? -1))
      await coldContext.close()
    }
    for (const sample of coldSamples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await page.goto(WORKBENCH)
    await expect(page.locator('[data-pms-workbench-root]')).toBeVisible()

    const switchSamples: number[] = []
    for (let index = 0; index < 5; index += 1) {
      const toSuggestions = await measureRouteSwitch(page, SUGGESTIONS, '[data-pms-psk-root]')
      await expect(page.locator('[data-pms-psk-root]')).toBeVisible()
      switchSamples.push(toSuggestions)
      const toWorkbench = await measureRouteSwitch(page, WORKBENCH, '[data-pms-workbench-root]')
      await expect(page.locator('[data-pms-workbench-root]')).toBeVisible()
      switchSamples.push(toWorkbench)
    }
    for (const sample of switchSamples) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, SUGGESTIONS, '[data-pms-psk-root]')
    await expect(page.locator('[data-pms-psk-root]')).toBeVisible()
    const suggestionInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      suggestionInteractions.push(await measureAction(page, '[data-pms-psk-action="query"]', '[data-pms-psk-table-surface] tbody tr'))
      suggestionInteractions.push(await measureAction(page, '[data-pms-psk-action="open-column-settings"]', '[data-pms-psk-column-overlays] .fixed'))
      await page.keyboard.press('Escape')
      suggestionInteractions.push(await measureAction(page, '[data-pms-psk-action="open-detail"]', '[data-pms-psk-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of suggestionInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, KOL, '[data-pms-kol-root]')
    await expect(page.locator('[data-pms-kol-root]')).toBeVisible()
    const kolInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      kolInteractions.push(await measureAction(page, '[data-pms-kol-action="query"]', '[data-pms-kol-table-surface] tbody tr'))
      kolInteractions.push(await measureAction(page, '[data-pms-kol-action="open-detail"]', '[data-pms-kol-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of kolInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    await measureRouteSwitch(page, PPO, '[data-pms-ppo-root]')
    await expect(page.locator('[data-pms-ppo-root]')).toBeVisible()
    const ppoInteractions: number[] = []
    for (let index = 0; index < 5; index += 1) {
      ppoInteractions.push(await measureAction(page, '[data-pms-ppo-action="open-detail"]', '[data-pms-ppo-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
      ppoInteractions.push(await measureAction(page, '[data-pms-ppo-action="open-create"]', '[data-pms-ppo-create-root]'))
      await page.keyboard.press('Escape')
    }
    for (const sample of ppoInteractions) {
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThan(PERF_THRESHOLD)
    }

    console.log(
      JSON.stringify({
        pmsPerf: {
          coldLoad: coldSamples.map((value) => Math.round(value)),
          routeSwitch: switchSamples.map((value) => Math.round(value)),
          suggestions: suggestionInteractions.map((value) => Math.round(value)),
          kol: kolInteractions.map((value) => Math.round(value)),
          ppo: ppoInteractions.map((value) => Math.round(value)),
        },
      }),
    )
  })
})
