import { chromium, expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Sample = { surface: string; scenario: string; run: number; milliseconds: number; passed: boolean }
const samples: Sample[] = []
const limit = 500
const workOrderId = 'TMF-WO-MOCK-003-CUT-SNAPSHOT-V1'
const printPath = `/fcs/print/preview?documentType=TMF_PROCESS_SHEET&sourceType=TMF_WORK_ORDER&sourceId=${workOrderId}`
const routes = [
  { name: '采购需求', path: '/fcs/craft/accessory/webbing/purchase-demands', root: '[data-tmf-base-page="purchase-demands"]', prefix: 'tmf-purchase-demands' },
  { name: '半成品加工单', path: '/fcs/craft/accessory/webbing/semi-finished-orders', root: '[data-tmf-base-page="semi-finished-orders"]', prefix: 'tmf-semi-finished-orders' },
  { name: '织带加工单', path: '/fcs/craft/accessory/webbing/work-orders', root: '[data-tmf-work-orders]', prefix: 'tmf-work-orders' },
  { name: '待接收', path: '/fcs/craft/accessory/webbing/pending-receipts', root: '[data-tmf-pending-receipts]', prefix: 'tmf-pending-receipts' },
  { name: '交出记录', path: '/fcs/craft/accessory/webbing/handover-records', root: '[data-tmf-handover-records]', prefix: 'tmf-handover-records' },
] as const

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const perfTest = test.extend<{ isolatedBrowser: Browser }>({
  isolatedBrowser: async ({}, use) => {
    const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] })
    try { await use(browser) } finally { await browser.close() }
  },
})

async function settle(page: Page) {
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
}

async function ready(page: Page, selector: string) {
  await page.locator(selector).waitFor({ state: 'visible' })
  await settle(page)
}

async function clickInBrowser(locator: Locator) {
  await locator.waitFor({ state: 'visible' })
  await locator.evaluate((element) => (element as HTMLElement).click())
}

async function record(page: Page, surface: string, scenario: string, run: number, action: () => Promise<void>, navigation = false) {
  if (!navigation) {
    await page.evaluate(() => {
      const marker = window as typeof window & { __tmfActionStartedAt?: number }
      delete marker.__tmfActionStartedAt
      document.addEventListener('click', () => { marker.__tmfActionStartedAt = performance.now() }, { capture: true, once: true })
    })
  }
  await action()
  const milliseconds = await page.evaluate((isNavigation) => {
    const marker = window as typeof window & { __tmfActionStartedAt?: number }
    const started = isNavigation ? 0 : marker.__tmfActionStartedAt
    if (typeof started !== 'number') throw new Error('性能计时没有捕获到真实交互事件。')
    return Number((performance.now() - started).toFixed(2))
  }, navigation)
  samples.push({ surface, scenario, run, milliseconds, passed: milliseconds < limit })
}

async function fresh(browser: Browser, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(() => { try { localStorage.clear() } catch { /* about:blank has no storage origin */ } })
  return { context, page: await context.newPage() }
}

async function open(page: Page, path: string, root: string) {
  await page.goto(path)
  await ready(page, root)
}

async function measureListAction(
  browser: Browser,
  route: typeof routes[number],
  scenario: string,
  action: (page: Page) => Promise<void>,
  prepare?: (page: Page) => Promise<void>,
) {
  for (let run = 1; run <= 5; run += 1) {
    const { context, page } = await fresh(browser)
    try {
      await open(page, route.path, route.root)
      if (prepare) { await prepare(page); await settle(page) }
      await record(page, route.name, scenario, run, async () => { await action(page); await settle(page) })
    } finally { await context.close() }
  }
}

function assertNewSamples(start: number) {
  const failures = samples.slice(start).filter((item) => !item.passed)
  expect(failures, failures.map((item) => `${item.surface}/${item.scenario}#${item.run}=${item.milliseconds}ms`).join('；')).toEqual([])
}

perfTest.describe.serial('TMF 完整性能门禁', () => {
  for (const route of routes) perfTest(`${route.name}：加载和标准列表交互每项 5 次均严格低于 500ms`, async ({ isolatedBrowser: browser }) => {
    test.setTimeout(300_000)
    const start = samples.length
    for (let run = 1; run <= 5; run += 1) {
      const { context, page } = await fresh(browser)
      try {
        await record(page, route.name, '冷启动首次进入', run, () => open(page, route.path, route.root), true)
        await record(page, route.name, '整页刷新', run, async () => { await page.reload(); await ready(page, route.root) }, true)
      } finally { await context.close() }
    }

    await measureListAction(browser, route, '查询', async (page) => {
      await page.locator(`${route.root} [name="keyword"]`).fill('TMF')
      await page.locator(`[data-${route.prefix}-action="query"]`).click({ noWaitAfter: true })
    })
    await measureListAction(browser, route, '重置', async (page) => {
      await page.locator(`[data-${route.prefix}-action="reset"]`).click({ noWaitAfter: true })
    }, async (page) => {
      await page.locator(`${route.root} [name="keyword"]`).fill('TMF')
      await page.locator(`[data-${route.prefix}-action="query"]`).click({ noWaitAfter: true })
    })
    await measureListAction(browser, route, '列设置打开', async (page) => {
      await page.locator(`[data-${route.prefix}-action="open-column-settings"]`).click({ noWaitAfter: true })
      await page.locator(`[data-${route.prefix}-action="close-column-settings"]`).last().waitFor({ state: 'visible' })
    })
    await measureListAction(browser, route, '列设置关闭', async (page) => {
      await page.locator(`[data-${route.prefix}-action="close-column-settings"]`).last().click({ noWaitAfter: true })
    }, async (page) => {
      await page.locator(`[data-${route.prefix}-action="open-column-settings"]`).click({ noWaitAfter: true })
      await page.locator(`[data-${route.prefix}-action="close-column-settings"]`).last().waitFor({ state: 'visible' })
    })
    await measureListAction(browser, route, '排序', async (page) => {
      await page.locator(`[data-${route.prefix}-action="sort-column"]`).first().click({ noWaitAfter: true })
    })
    await measureListAction(browser, route, '导出当前查询全部结果', async (page) => {
      const download = page.waitForEvent('download')
      await page.locator(`[data-${route.prefix}-action="export"]`).click({ noWaitAfter: true })
      await download
    })
    assertNewSamples(start)
  })

  perfTest('五个列表的站内切换每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
    test.setTimeout(180_000)
    const start = samples.length
  for (const route of routes.slice(1)) {
    for (let run = 1; run <= 5; run += 1) {
      const { context, page } = await fresh(browser)
      try {
        await open(page, routes[0].path, routes[0].root)
        await record(page, route.name, '站内路由切换', run, async () => {
          const link = page.locator(`[data-tab-href="${route.path}"], [data-nav="${route.path}"]`).first()
          expect(await link.count(), `${route.name} 应存在可点击的站内菜单入口`).toBeGreaterThan(0)
          await link.click({ noWaitAfter: true })
          await ready(page, route.root)
        })
      } finally { await context.close() }
    }
  }
    assertNewSamples(start)
  })

  perfTest('采购需求图片交互每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  const start = samples.length
  await measureListAction(browser, routes[0], '物料大图打开', async (page) => {
    await page.locator('[data-tmf-purchase-demands-action="image"]').first().click({ noWaitAfter: true })
    await page.getByRole('dialog', { name: '半成品实物图' }).waitFor({ state: 'visible' })
  })
  await measureListAction(browser, routes[0], '物料大图关闭', async (page) => {
    await page.locator('[data-tmf-purchase-demands-action="close-image"]').last().click({ noWaitAfter: true })
  }, async (page) => {
    await page.locator('[data-tmf-purchase-demands-action="image"]').first().click({ noWaitAfter: true })
    await page.getByRole('dialog', { name: '半成品实物图' }).waitFor({ state: 'visible' })
  })
  assertNewSamples(start)
  })

  perfTest('半成品确认接受弹窗每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  const start = samples.length
  await measureListAction(browser, routes[1], '确认接受弹窗打开', async (page) => {
    await page.locator('[data-tmf-semi-finished-orders-action="accept"]').first().click({ noWaitAfter: true })
    await page.locator('[data-tmf-dialog] .fixed').first().waitFor({ state: 'visible' })
  })
  await measureListAction(browser, routes[1], '确认接受弹窗关闭', async (page) => {
    await page.locator('[data-tmf-semi-finished-orders-action="close-dialog"]').last().click({ noWaitAfter: true })
  }, async (page) => {
    await page.locator('[data-tmf-semi-finished-orders-action="accept"]').first().click({ noWaitAfter: true })
    await page.locator('[data-tmf-dialog] .fixed').first().waitFor({ state: 'visible' })
  })
  assertNewSamples(start)
  })

  perfTest('织带加工单选择和批量打印每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  const start = samples.length
  await measureListAction(browser, routes[2], '行选择', async (page) => {
    await page.locator('[data-tmf-work-orders-action="toggle-selection"]').first().check()
  })
  const { context, page } = await fresh(browser)
  try {
    await open(page, routes[2].path, routes[2].root)
    for (let run = 1; run <= 5; run += 1) {
      const boxes = page.locator('[data-tmf-work-orders-action="toggle-selection"]')
      if (!await boxes.first().isChecked()) await boxes.first().check()
      if (!await boxes.nth(1).isChecked()) await boxes.nth(1).check()
      await record(page, routes[2].name, '批量打印进入预览', run, async () => {
        await page.locator('[data-tmf-work-orders-action="batch-print"]').click({ noWaitAfter: true })
        await page.locator('[data-tmf-batch-print-source]').first().waitFor({ state: 'visible' })
        await settle(page)
      })
      if (run < 5) {
        await page.getByRole('link', { name: '返回业务单据' }).click({ noWaitAfter: true })
        await ready(page, '[data-tmf-work-detail]')
        await page.getByRole('button', { name: '返回织带加工单' }).click({ noWaitAfter: true })
        await ready(page, routes[2].root)
      }
    }
  } finally { await context.close() }
  assertNewSamples(start)
  })

  perfTest('待接收弹窗和边界阻断每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  const start = samples.length
  await measureListAction(browser, routes[3], '接收弹窗打开', async (page) => {
    await page.locator('[data-tmf-pending-receipts-action="receive"]').first().click({ noWaitAfter: true })
    await page.locator('[data-tmf-pending-dialog] input[name="quantity"]').waitFor({ state: 'visible' })
  })
  await measureListAction(browser, routes[3], '接收边界阻断', async (page) => {
    await page.locator('[data-tmf-pending-receipts-action="confirm"]').click({ noWaitAfter: true })
    await page.locator('[data-tmf-pending-error]').filter({ hasText: /须为|之间/ }).waitFor({ state: 'visible' })
  }, async (page) => {
    await page.locator('[data-tmf-pending-receipts-action="receive"]').first().click({ noWaitAfter: true })
    await page.locator('[data-tmf-pending-dialog] input[name="quantity"]').fill('999')
  })
  assertNewSamples(start)
  })

  perfTest('织带加工单详情加载和全部页签每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  test.setTimeout(300_000)
  const start = samples.length
  const detailPath = `/fcs/craft/accessory/webbing/work-orders/${workOrderId}`
  for (let run = 1; run <= 5; run += 1) {
    const { context, page } = await fresh(browser)
    try {
      await record(page, '织带加工单详情', '冷启动首次进入', run, () => open(page, detailPath, '[data-tmf-work-detail]'), true)
      await record(page, '织带加工单详情', '整页刷新', run, async () => { await page.reload(); await ready(page, '[data-tmf-work-detail]') }, true)
    } finally { await context.close() }
  }
  {
    const { context, page } = await fresh(browser)
    try {
      await open(page, detailPath, '[data-tmf-work-detail]')
      for (const tab of ['requirements', 'upstream', 'inputs', 'merged', 'tipping', 'outputs', 'packages', 'returns', 'times', 'history']) {
        for (let run = 1; run <= 5; run += 1) {
          await record(page, '织带加工单详情', `切换页签:${tab}`, run, async () => {
            await clickInBrowser(page.locator(`[data-tmf-work-detail-action="tab"][data-id="${tab}"]`))
            await page.locator('[data-tmf-detail-content]').waitFor({ state: 'visible' })
            await settle(page)
          })
        }
      }
    } finally { await context.close() }
    }
  assertNewSamples(start)
  })

  perfTest('PDA 织带厂执行加载、进入任务和边界阻断每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  test.setTimeout(180_000)
  const start = samples.length
  for (let run = 1; run <= 5; run += 1) {
    const { context, page } = await fresh(browser, { width: 360, height: 640 })
    try {
      await record(page, 'PDA 织带厂执行', '冷启动首次进入', run, () => open(page, '/fcs/craft/accessory/webbing/pda', '[data-tmf-pda-exec-root]'), true)
      await page.getByLabel('生产单号').fill('TMF-WO-MOCK-001')
      await record(page, 'PDA 织带厂执行', '进入任务卡', run, async () => {
        await page.getByRole('button', { name: '进入任务卡' }).click({ noWaitAfter: true })
        await page.getByText('2 / 3 任务卡 · TMF-WO-MOCK-001').waitFor({ state: 'visible' })
      })
      await record(page, 'PDA 织带厂执行', '打开投入接收', run, async () => {
        await page.getByRole('button', { name: '登记实收' }).click({ noWaitAfter: true })
        await page.getByText('3 / 3 登记投入实收').waitFor({ state: 'visible' })
      })
      await page.getByLabel('本次实际接收（米）').fill('999')
      await record(page, 'PDA 织带厂执行', '超量接收阻断', run, async () => {
        await page.getByRole('button', { name: '确认保存' }).click({ noWaitAfter: true })
        await page.locator('[data-tmf-pda-exec-error]').filter({ hasText: /超过|可接收|不能/ }).waitFor({ state: 'visible' })
      })
    } finally { await context.close() }
  }
  assertNewSamples(start)
  })

  perfTest('织带加工明细打印加载和打印每项 5 次均严格低于 500ms', async ({ isolatedBrowser: browser }) => {
  test.setTimeout(180_000)
  const start = samples.length
  for (let run = 1; run <= 5; run += 1) {
    const { context, page } = await fresh(browser)
    try {
      await record(page, '织带加工明细打印', '冷启动首次进入', run, async () => {
        await open(page, printPath, '.print-preview-root')
        await page.locator('[data-tmf-print-signature]').waitFor({ state: 'visible' })
        await page.locator('[data-real-qr] svg').first().waitFor({ state: 'visible' })
        await page.locator('[data-real-barcode] rect').first().waitFor({ state: 'visible' })
      }, true)
      await page.evaluate(() => { window.print = () => { document.body.dataset.printCalled = 'true' } })
      await record(page, '织带加工明细打印', '打印', run, async () => {
        await page.locator('[data-print-preview-action="print"]').click({ noWaitAfter: true })
        await page.locator('[data-print-ready-feedback]').filter({ hasText: '图片和条码已就绪' }).waitFor({ state: 'visible' })
      })
      expect(await page.evaluate(() => document.body.dataset.printCalled)).toBe('true')
    } finally { await context.close() }
  }
  assertNewSamples(start)
  })

  perfTest.afterAll(async ({}, testInfo) => {
  const failures = samples.filter((item) => !item.passed)
  const diff = execFileSync('git', ['diff', '--binary'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  const evidence = {
    generatedAt: new Date().toISOString(), branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeDiffSha256: createHash('sha256').update(diff).digest('hex'),
    service: testInfo.project.use.baseURL ?? `http://127.0.0.1:${process.env.CUTTING_E2E_PORT ?? '4173'}`,
    browser: 'Chromium',
    viewports: ['1366x768', '360x640'],
    cacheConditions: '每个首次进入、刷新和列表动作样本均使用新建 browser context 并清空 localStorage；站内连续动作按同一真实会话计时',
    threshold: '<500ms，任一样本 >=500ms 即失败',
    dataVolume: '12 条采购/半成品链、5 张织带加工单、8 条规格需求；含待确认、加工中、已交出、生产实收、多长度和三种端头',
    sampleCount: samples.length, maxMilliseconds: Math.max(...samples.map((item) => item.milliseconds)), failed: failures.length, passed: failures.length === 0, samples,
  }
  const output = resolve('docs/product-design/tmf-webbing/evidence/2026-09-23-tmf-complete-performance.json')
  mkdirSync(resolve('docs/product-design/tmf-webbing/evidence'), { recursive: true })
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`)
  await testInfo.attach('tmf-complete-performance', { path: output, contentType: 'application/json' })
  expect(failures, failures.map((item) => `${item.surface}/${item.scenario}#${item.run}=${item.milliseconds}ms`).join('；')).toEqual([])
  })
})
