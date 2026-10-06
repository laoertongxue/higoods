import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { chromium, type Page } from '@playwright/test'
const base = process.env.SAMPLE_PERF_URL || 'http://127.0.0.1:4207'
const routes = ['inventory','application','transfer','return','ledger','ledger/stocktake','view','detail/smp-001'].map(s => '/pcs/samples/' + s).concat(['/pcs/testing/orders', '/pcs/testing/orders/to_seed_normal', '/pcs/testing/orders/create'])

test('SAMP-014 current bundle: every named route cold/reload/SPA and interactive surface <=1s, five samples', { timeout: 300000 }, async () => {
  const browser = await chromium.launch({ headless: true }), samples: Array<{ name: string; ms: number }> = [], errors: string[] = []
  const init = () => { (globalThis as any).__name = (v: unknown) => v; for (const name of ['pointerdown','input','change']) document.addEventListener(name, () => { (globalThis as any).__sampleStart = performance.now() }, true) }
  const ready = async (page: Page) => {
    await page.waitForSelector('[data-pcs-sample-page-root], [data-pcs-testing-order-list], [data-pcs-testing-action], [data-testing-create-page]')
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img, [data-pda-image-preview-root] img')].every(i => i.complete && i.naturalWidth > 0))
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
    assert.ok(!/资料暂时无法读取|本机资料暂时无法读取/.test(await page.locator('main').innerText()))
  }
  const save = async (page: Page, name: string, navigation = false) => { await ready(page); const ms = await page.evaluate(nav => nav ? performance.now() : performance.now() - (globalThis as any).__sampleStart, navigation); samples.push({ name, ms }); assert.ok(ms <= 1000, `${name}: ${ms}ms > 1000ms`) }
  const act = async (page: Page, name: string, action: () => Promise<unknown>, done?: () => Promise<unknown>) => { await action(); if (done) await done(); await save(page, name) }
  const newPage = async () => { const c = await browser.newContext({ viewport: { width: 1366, height: 768 } }); await c.addInitScript(init); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); return { c, p } }
  await mkdir('output/playwright/sample-wp05', { recursive: true })
  try {
    for (const route of routes) for (let repeat = 0; repeat < 5; repeat++) {
      const { c, p } = await newPage(); const cd = await c.newCDPSession(p); await cd.send('Network.enable'); await cd.send('Network.setCacheDisabled', { cacheDisabled: true })
      await p.goto(base + route); await save(p, route + ':cold', true)
      await p.reload(); await save(p, route + ':reload', true)
      await p.goto(base + (route === '/pcs/samples/inventory' ? '/pcs/samples/ledger' : '/pcs/samples/inventory')); await ready(p)
      await act(p, route + ':SPA', () => p.evaluate(route => { const b = document.createElement('button'); b.dataset.nav = route; document.querySelector('#app')!.append(b); (globalThis as any).__sampleOldRoot = document.querySelector('[data-pcs-sample-page-root]'); (globalThis as any).__sampleStart = performance.now(); b.click(); b.remove() }, route), async () => { await p.waitForURL(base + route); await p.waitForFunction(() => !(globalThis as any).__sampleOldRoot?.isConnected) })
      await c.close()
      if (repeat === 4) console.log('PASS loads', route)
    }
    const { c, p } = await newPage()
    for (const route of routes.filter(r => r.startsWith('/pcs/samples'))) {
      await p.goto(base + route); await ready(p)
      const fields = await p.locator('[data-pcs-sample-field]').evaluateAll(nodes => nodes.map(n => ({ field: n.getAttribute('data-pcs-sample-field')!, select: n.tagName === 'SELECT', options: n.tagName === 'SELECT' ? [...(n as HTMLSelectElement).options].map(o => o.value) : [] })))
      for (const field of fields) for (let repeat = 0; repeat < 5; repeat++) {
        const node = () => p.locator(`[data-pcs-sample-field="${field.field}"]`).first()
        if (field.select) for (const value of field.options) await act(p, `${route}:field-${field.field}-${value}`, () => node().selectOption(value))
        else { await act(p, `${route}:field-${field.field}-empty-result`, () => node().fill('不存在的样衣')); await act(p, `${route}:field-${field.field}-clear`, () => node().fill('')) }
      }
      for (let repeat = 0; repeat < 5; repeat++) for (const field of fields) {
        const node = p.locator(`[data-pcs-sample-field="${field.field}"]`).first()
        await act(p, `${route}:reset-field-${field.field}`, () => field.select ? node.selectOption('全部') : node.fill(''))
      }
      const actions = await p.locator('[data-pcs-sample-action]').evaluateAll(nodes => [...new Set(nodes.filter(n => !(n as HTMLButtonElement).disabled).map(n => n.getAttribute('data-pcs-sample-action')!))])
      for (const action of actions.filter(a => !['convert-type','open-flow','close-notice'].includes(a))) for (let repeat = 0; repeat < 5; repeat++) {
        const node = p.locator(`[data-pcs-sample-action="${action}"]`).first()
        if (await node.count() === 0) throw Error(route + ': missing action ' + action)
        await act(p, `${route}:action-${action}`, () => node.click())
        if (action.startsWith('select-') || action === 'open-create-request') {
          assert.equal(await p.locator('main aside').count(), 1)
          if (repeat === 0) await p.screenshot({ path: `output/playwright/sample-wp05/${route.split('/').at(-1)}-drawer.png`, fullPage: true })
          if (await p.locator('main aside [data-pda-image-preview-url]').count()) {
            await act(p, `${route}:drawer-image-open`, () => p.locator('main aside [data-pda-image-preview-url]').first().click(), () => p.waitForSelector('[data-pda-image-preview-root] img'))
            await act(p, `${route}:drawer-image-close`, () => p.locator('[data-pda-image-preview-close]').last().click(), () => p.waitForSelector('[data-pda-image-preview-root]', { state: 'detached' }))
          }
          if (action === 'open-create-request') await act(p, `${route}:save-existing-demo-draft`, () => p.locator('[data-pcs-sample-action="submit-create-request"]').click(), () => p.waitForSelector('main aside', { state: 'detached' }))
          else await act(p, `${route}:drawer-close`, () => p.locator('main aside [data-pcs-sample-action="close-drawers"]').last().click(), () => p.waitForSelector('main aside', { state: 'detached' }))
        }
        const notice = p.locator('[data-pcs-sample-action="close-notice"]')
        if (await notice.count()) await act(p, `${route}:notice-close`, () => notice.click())
      }
      if (route.endsWith('/view')) for (let repeat = 0; repeat < 5; repeat++) for (const mode of ['table','card']) await act(p, `${route}:view-${mode}`, () => p.locator(`[data-view-mode="${mode}"]`).click())
      if (await p.locator('[data-pda-image-preview-url]').count()) for (let repeat = 0; repeat < 5; repeat++) {
        await act(p, `${route}:image-open`, () => p.locator('[data-pda-image-preview-url]').first().click(), () => p.waitForSelector('[data-pda-image-preview-root] img'))
        if (repeat === 0) await p.screenshot({ path: `output/playwright/sample-wp05/${route.split('/').at(-1)}-image.png` })
        await act(p, `${route}:image-close`, () => p.locator('[data-pda-image-preview-close]').last().click(), () => p.waitForSelector('[data-pda-image-preview-root]', { state: 'detached' }))
      }
      const quickStatuses = await p.locator('[data-pcs-sample-action="quick-filter-status"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-status')!))
      for (const status of quickStatuses) for (let repeat = 0; repeat < 5; repeat++) { await act(p, `${route}:quick-status-${status}`, () => p.locator(`[data-pcs-sample-action="quick-filter-status"][data-status="${status}"]`).click()); await act(p, `${route}:quick-status-reset`, () => p.locator('[data-pcs-sample-action="reset-filters"]').click()) }
      await p.screenshot({ path: `output/playwright/sample-wp05/${route.split('/').at(-1)}-1366.png`, fullPage: true }); console.log('PASS controls', route)
    }
    await p.goto(base + '/pcs/samples/detail/smp-001'); await ready(p)
    for (let repeat = 0; repeat < 5; repeat++) {
      await act(p, 'detail:flow-open', () => p.locator('[data-pcs-sample-action="open-flow"]').click(), () => p.waitForSelector('[aria-label="确认流转签收"]'))
      await act(p, 'detail:flow-cancel', () => p.locator('[data-pcs-sample-action="close-flow"]').click(), () => p.waitForSelector('[aria-label="确认流转签收"]', { state: 'detached' }))
    }
    // The list and create pages share the same testing repository as the modified ④⑤ detail.
    await p.goto(base + '/pcs/testing/orders'); await ready(p)
    for (let repeat = 0; repeat < 5; repeat++) {
      for (const action of ['query','reset','export','open-column-settings']) await act(p, 'testing-list:' + action, () => p.locator(`[data-pcs-testing-action="${action}"]`).click())
      for (const action of ['toggle-column-visibility','toggle-column-freeze','restore-column-settings','close-column-settings']) { const node = p.locator(`[data-pcs-testing-action="${action}"]`).last(); if (await node.count()) await act(p, 'testing-list:' + action, () => node.click()) }
      for (const field of ['search','status','page-size']) { const node = p.locator(`[data-pcs-testing-field="${field}"]`); if (await node.count()) await act(p, 'testing-list:field-' + field, () => field === 'search' ? node.first().fill('TO') : node.first().selectOption({ index: 1 })) }
      const sort = p.locator('[data-pcs-testing-action="sort"]'); if (await sort.count()) await act(p, 'testing-list:sort', () => sort.first().click())
    }
    await p.goto(base + '/pcs/testing/orders/create'); await ready(p)
    const style = p.locator('[data-testing-create-field="style"]')
    const values = await style.locator('option:not([disabled])').evaluateAll(nodes => (nodes as HTMLOptionElement[]).filter(n => n.value).map(n => n.value))
    const value = values[0]
    assert.ok(value)
    for (let repeat = 0; repeat < 5; repeat++) {
      await act(p, 'testing-create:style-select', () => style.selectOption(value))
      await act(p, 'testing-create:SKU-toggle', () => p.locator('[data-testing-create-field="sku"]').first().click())
      await act(p, 'testing-create:SKU-toggle-back', () => p.locator('[data-testing-create-field="sku"]').first().click())
      await act(p, 'testing-create:image-open', () => p.locator('[data-testing-create-product] [data-pda-image-preview-url]').first().click(), () => p.waitForSelector('[data-pda-image-preview-root] img'))
      await act(p, 'testing-create:image-close', () => p.locator('[data-pda-image-preview-close]').last().click(), () => p.waitForSelector('[data-pda-image-preview-root]', { state: 'detached' }))
      await act(p, 'testing-create:style-change', () => style.selectOption(values[1]))
    }
    for (const route of routes) { await p.setViewportSize({ width: 1280, height: 720 }); await p.goto(base + route); await ready(p); await p.screenshot({ path: `output/playwright/sample-wp05/${route.split('/').at(-1)}-1280.png`, fullPage: true }) }
    await c.close()
    assert.deepEqual(errors, [])
    const groups = [...new Set(samples.map(s => s.name))].map(name => ({ name, values: samples.filter(s => s.name === name).map(s => s.ms), max: Math.max(...samples.filter(s => s.name === name).map(s => s.ms)) }))
    for (const group of groups) assert.ok(group.values.length >= 5, group.name + ': fewer than five samples')
    await writeFile('output/playwright/sample-wp05/performance.json', JSON.stringify({ passed: true, base, browser: browser.version(), head: execFileSync('git',['rev-parse','HEAD']).toString().trim(), branch: execFileSync('git',['branch','--show-current']).toString().trim(), worktree: process.cwd(), viewport: '1366x768; visual 1280x720', cache: 'cold/reload: new context and cache disabled; SPA/interactions: ordinary cache', data: '8 default samples, 10 transfer events; full Mock test uses additional two-SKU receipt per isolated context', errors, groups }, null, 2))
  } catch (error) { await writeFile('output/playwright/sample-wp05/performance-failed-' + Date.now() + '.json', JSON.stringify({ passed: false, error: String(error), samples, errors }, null, 2)); throw error } finally { await browser.close() }
})
