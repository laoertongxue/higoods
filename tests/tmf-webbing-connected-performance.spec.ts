import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Sample = { route: string; scenario: string; run: number; milliseconds: number }
const samples: Sample[] = []
test.use({
  trace: 'off', screenshot: 'off', video: 'off',
  launchOptions: { args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] },
})
const routes = [
  ['/fcs/craft/accessory/webbing/purchase-demands', '[data-tmf-base-page="purchase-demands"]'],
  ['/fcs/craft/accessory/webbing/semi-finished-orders', '[data-tmf-base-page="semi-finished-orders"]'],
  ['/fcs/craft/accessory/webbing/work-orders', '[data-tmf-work-orders]'],
  ['/fcs/craft/accessory/webbing/pending-receipts', '[data-tmf-pending-receipts]'],
  ['/fcs/craft/accessory/webbing/handover-records', '[data-tmf-handover-records]'],
] as const

async function painted(page: Page) {
  await page.evaluate(() => new Promise<void>((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(() => resolvePaint()))))
}

async function timed(route: string, scenario: string, run: number, action: () => Promise<void | number>) {
  const started = performance.now()
  const browserMilliseconds = await action()
  const milliseconds = Number((typeof browserMilliseconds === 'number' ? browserMilliseconds : performance.now() - started).toFixed(2))
  samples.push({ route, scenario, run, milliseconds })
}

async function clickPainted(page: Page, selector: string, last = false): Promise<number> {
  await page.bringToFront()
  return page.locator(selector).evaluateAll(async (elements, useLast) => {
    const element = elements[useLast ? elements.length - 1 : 0] as HTMLElement | undefined
    if (!element) throw new Error(`交互入口不存在：${location.pathname}`)
    const started = performance.now()
    element.click()
    await new Promise<void>((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(() => resolvePaint())))
    return performance.now() - started
  }, last)
}

async function cold(browser: Browser, route: string, root: string, run: number) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await context.addInitScript(() => localStorage.clear())
  const page = await context.newPage()
  await timed(route, '独立上下文首次进入', run, async () => {
    await page.goto(route)
    await page.locator(root).waitFor({ state: 'visible' })
    await page.locator(`${root}[data-bound="true"]`).waitFor({ state: 'attached' })
    await page.locator(`${root} tbody tr`).first().waitFor({ state: 'visible' })
    await painted(page)
  })
  await context.close()
}

async function interaction(page: Page, route: string, root: string, prefix: string, run: number) {
  const keyword = page.locator(`${root} [name="keyword"]`)
  await keyword.fill('TMF-MOCK')
  await timed(route, '查询', run, () => clickPainted(page, `${root} [data-${prefix}-action="query"]`))
  await timed(route, '重置', run, () => clickPainted(page, `${root} [data-${prefix}-action="reset"]`))
  await expect(keyword).toHaveValue('')
  await timed(route, '列设置打开', run, () => clickPainted(page, `${root} [data-${prefix}-action="open-column-settings"]`))
  await page.locator(`${root} [data-${prefix}-action="close-column-settings"]`).last().waitFor({ state: 'visible' })
  await timed(route, '列设置关闭', run, () => clickPainted(page, `${root} [data-${prefix}-action="close-column-settings"]`, true))
}

test('五个 TMF 页面首次进入、刷新、站内切换和适用交互各 5 次严格低于 500ms', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  for (const [route, root] of routes) for (let run = 1; run <= 5; run += 1) await cold(browser, route, root, run)

  const navigationContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await navigationContext.newPage()
  await page.goto(routes[0][0])
  await page.locator(`${routes[0][1]}[data-bound="true"]`).waitFor({ state: 'attached' })
  await painted(page)
  for (const [route, root] of routes) {
    for (let run = 1; run <= 5; run += 1) {
      await timed(route, '站内路由切换', run, async () => {
        await page.goto(route)
        await page.locator(root).waitFor({ state: 'visible' })
        await page.locator(`${root}[data-bound="true"]`).waitFor({ state: 'attached' })
        await painted(page)
      })
      await timed(route, '整页刷新', run, async () => {
        await page.reload()
        await page.locator(root).waitFor({ state: 'visible' })
        await page.locator(`${root}[data-bound="true"]`).waitFor({ state: 'attached' })
        await painted(page)
      })
    }
  }
  await navigationContext.close()

  const interactionPages = [
    [routes[0][0], routes[0][1], 'tmf-purchase-demands'],
    [routes[1][0], routes[1][1], 'tmf-semi-finished-orders'],
    [routes[2][0], routes[2][1], 'tmf-work-orders'],
    [routes[3][0], routes[3][1], 'tmf-pending-receipts'],
    [routes[4][0], routes[4][1], 'tmf-handover-records'],
  ] as const
  for (const [route, root, prefix] of interactionPages) {
    for (let run = 1; run <= 5; run += 1) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
      const interactionPage = await context.newPage()
      await interactionPage.goto(route)
      await interactionPage.locator(`${root}[data-bound="true"]`).waitFor({ state: 'attached' })
      await painted(interactionPage)
      await interaction(interactionPage, route, root, prefix, run)
      await context.close()
    }
  }

  for (let run = 1; run <= 5; run += 1) {
    const imageContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const imagePage = await imageContext.newPage()
    await imagePage.goto(routes[0][0])
    await imagePage.locator(`${routes[0][1]}[data-bound="true"]`).waitFor({ state: 'attached' })
    await painted(imagePage)
    await timed(routes[0][0], '图片大图打开', run, async () => {
      const milliseconds = await clickPainted(imagePage, '[data-tmf-purchase-demands-action="image"]')
      await imagePage.getByRole('dialog', { name: '半成品实物图' }).waitFor({ state: 'visible' })
      return milliseconds
    })
    await timed(routes[0][0], '图片大图关闭', run, async () => {
      const milliseconds = await clickPainted(imagePage, '[data-tmf-purchase-demands-action="close-image"]', true)
      await imagePage.getByRole('dialog', { name: '半成品实物图' }).waitFor({ state: 'detached' })
      return milliseconds
    })
    await imageContext.close()
  }

  for (let run = 1; run <= 5; run += 1) {
    const dialogContext = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const dialogPage = await dialogContext.newPage()
    await dialogPage.goto(routes[1][0])
    await dialogPage.locator(`${routes[1][1]}[data-bound="true"]`).waitFor({ state: 'attached' })
    await painted(dialogPage)
    await timed(routes[1][0], '确认接收弹窗打开', run, async () => {
      const milliseconds = await clickPainted(dialogPage, '[data-tmf-semi-finished-orders-action="accept"]')
      await dialogPage.locator('[data-tmf-dialog] .fixed').first().waitFor({ state: 'visible', timeout: 1_000 })
      return milliseconds
    })
    await timed(routes[1][0], '确认接收弹窗关闭', run, async () => {
      const milliseconds = await clickPainted(dialogPage, '[data-tmf-semi-finished-orders-action="close-dialog"]', true)
      await dialogPage.locator('[data-tmf-dialog] .fixed').first().waitFor({ state: 'detached', timeout: 1_000 })
      return milliseconds
    })
    await dialogContext.close()
  }

  const max = Math.max(...samples.map((sample) => sample.milliseconds))
  const evidence = { generatedAt: new Date().toISOString(), branch: 'main', viewport: '1366x768', browser: 'Chromium', threshold: '<500ms', sampleCount: samples.length, maxMilliseconds: max, passed: samples.every((sample) => sample.milliseconds < 500), samples }
  const output = resolve('docs/product-design/tmf-webbing/evidence/2026-09-23-connected-lists-performance.json')
  mkdirSync(resolve('docs/product-design/tmf-webbing/evidence'), { recursive: true })
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`)
  await testInfo.attach('tmf-connected-list-performance', { path: output, contentType: 'application/json' })
  const failures = samples.filter((sample) => sample.milliseconds >= 500)
  expect(failures, `性能失败：${failures.map((sample) => `${sample.route} ${sample.scenario} #${sample.run}=${sample.milliseconds}ms`).join('；')}`).toEqual([])
})
