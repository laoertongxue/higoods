import { test, expect, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

for (const factory of ['F090', 'FAC-FLOWER']) test(`${factory} PDA 列表筛选、四个状态与底部跨页导航五次`, async ({ browser, baseURL }, info) => {
  const samples: Record<string, number[]> = {}, errors: string[] = []
  for (let round = 0; round < 5; round++) {
    const values = JSON.parse(await readFile('output/playwright/design-revision-gap/fixtures/completed.json', 'utf8'))
    values.fcs_pda_session = JSON.stringify({ userId: `${factory}_operator`, loginId: `${factory}_operator`, userName: '验收', roleId: 'ROLE_OPERATOR', factoryId: factory, factoryName: factory, loggedAt: '2026-09-24 09:00:00' })
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: Object.entries(values).map(([name, value]) => ({ name, value: String(value) })) }] } })
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
    const measure = async (name: string, run: () => Promise<void>, event = 'click') => {
      await page.evaluate(event => document.addEventListener(event, e => sessionStorage.setItem('navigation-probe-start', String(performance.timeOrigin + e.timeStamp)), { capture: true, once: true }), event)
      await run()
      const ms = await page.evaluate(async () => {
        await Promise.all([...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 }).map(i => i.decode()))
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        return performance.timeOrigin + performance.now() - Number(sessionStorage.getItem('navigation-probe-start'))
      }); (samples[name] ??= []).push(ms)
      await writeFile(info.outputPath('performance.json'), JSON.stringify({ factory, samples, errors, distSha: createHash('sha256').update(await readFile('dist/index.html')).digest('hex') }, null, 2))
    }
    await page.goto(`${baseURL}/fcs/pda/task-receive`)
    for (const tab of await page.locator('[data-pda-tr-action="switch-tab"]').evaluateAll(ns => ns.map(n => n.getAttribute('data-tab')!))) {
      await measure(`task-receive:tab:${tab}`, async () => { const b = page.locator(`[data-pda-tr-action="switch-tab"][data-tab="${tab}"]`); await b.click(); await expect(b).toHaveClass(/border-primary/) })
    }
    const keyword = page.locator('[data-pda-tr-field="keyword"]')
    for (const value of ['NO-MATCH-DR-PERF', '']) await measure(`task-receive:search:${value || 'clear'}`, async () => { await keyword.fill(value); await expect(keyword).toHaveValue(value); if (value) await expect(page.getByText(/暂无.*任务/).first()).toBeVisible() }, 'input')
    for (const key of ['exec', 'handover', 'task-receive', 'exec']) {
      await measure(`navigate:${key}`, async () => { await page.locator(`[data-pda-tab="${key}"]`).click(); await expect(page).toHaveURL(new RegExp(`/fcs/pda/${key}(?:\\?|$)`)); await expect(page.locator(`[data-pda-tab="${key}"]`)).toHaveClass(/text-primary/); await expect(page.getByText('正在加载页面', { exact: false })).toHaveCount(0) })
      if (key === 'handover') for (const tab of await page.locator('[data-pda-handover-action="switch-tab"]').evaluateAll(ns => ns.map(n => n.getAttribute('data-tab')!))) {
        await measure(`handover:tab:${tab}`, async () => { const button = page.locator(`[data-pda-handover-action="switch-tab"][data-tab="${tab}"]`); await button.click(); await expect(button).toHaveClass(/border-primary/) })
      }
    }
    for (const tab of ['IN_PROGRESS', 'BLOCKED', 'DONE', 'NOT_STARTED']) await measure(`exec:tab:${tab}`, async () => { const b = page.locator(`[data-pda-exec-action="switch-tab"][data-tab="${tab}"]`); await b.click(); await expect(b).toHaveClass(/border-primary/) })
    const search = page.locator('[data-pda-exec-field="searchKeyword"]')
    for (const value of ['NO-MATCH-DR-PERF', '']) await measure(`exec:search:${value || 'clear'}`, async () => { await search.fill(value); await expect(search).toHaveValue(value); if (value) await expect(page.locator('[data-pda-general-task-list]')).toContainText('当前关键词未找到任务') }, 'input')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await context.close()
  }
  expect(errors).toEqual([])
  for (const [name, values] of Object.entries(samples)) for (const ms of values) expect(ms, name).toBeLessThan(500)
})
