import assert from 'node:assert/strict'
import test from 'node:test'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

const base = process.env.ACCESSORY_STAGE1_UI_URL || 'http://127.0.0.1:43241'
const output = resolve('output/verification/accessory-retired-module')

test('五个旧WLS配料地址失效，保留面料看板仍从库存管理可达并保持原实现', { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true })
  await assert.rejects(access('src/pages/wls/production-prep/allocation.ts'))
  const files = ['src/router/routes.ts', 'src/router/routes-wls.ts', 'src/main-handlers/wls-page-handlers.ts', 'src/data/app-shell-config.ts']
  for (const path of files) assert.doesNotMatch(await readFile(path, 'utf8'), /production-prep\/|handleWlsProductionPrepEvent|renderWls(?:Dyeing|Printing|Sewing|Other|Knitting)PrepPage/, path)
  const preserved = ['src/pages/wls-fabric-demand-board.ts', 'src/data/wls/fabric-demand-board.ts']
  for (const path of preserved) {
    const before = execFileSync('git', ['show', `4a0ce9ef5a30e8dec4537de1ff59159543902a25:${path}`], { encoding: 'utf8' })
    assert.equal(await readFile(path, 'utf8'), before, `${path}仅迁菜单，保留原字节与能力`)
  }
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage(), errors: string[] = [], evidence: Record<string, unknown> = {}
  page.on('pageerror', error => errors.push(error.message))
  await context.addInitScript(() => { (globalThis as any).__name = (x: unknown) => x })
  try {
    for (const kind of ['dyeing', 'printing', 'sewing', 'other', 'knitting']) {
      const path = `/wls/production-prep/${kind}`
      await page.goto(base + path)
      await expect(page.getByRole('heading', { name: '页面未找到', exact: true })).toBeVisible()
      await expect(page.locator('[data-wls-production-prep-action]')).toHaveCount(0)
      evidence[path] = { notFound: true, writableOldControls: 0 }
    }
    await page.goto(base + '/wls/accessory-warehouses/gtp/locations')
    const inventory = page.locator('[data-menu-group-header="库存管理"]')
    if (await inventory.getAttribute('aria-expanded') !== 'true') await inventory.click()
    const board = page.locator('[data-tab-href="/wls/fabric-demand-board"]').first()
    await expect(board).toBeVisible(); await board.click()
    await expect(page.getByRole('heading', { name: '面料需求看板', exact: true })).toBeVisible()
    const filters = page.locator('[data-fabric-demand-filter="keyword"]')
    await filters.fill('没有这个面料-验收')
    await page.locator('[data-fabric-demand-action="filter"]').click()
    await expect(page.getByText('当前筛选下暂无面料需求', { exact: false })).toBeVisible()
    await page.locator('[data-fabric-demand-action="reset"]').click()
    await expect(page.locator('[data-fabric-demand-action="preview-image"]').first()).toBeVisible()
    await page.locator('[data-fabric-demand-action="preview-image"]').first().click()
    await expect(page.locator('[data-wls-fabric-demand-board-image-overlay] img')).toBeVisible()
    await page.locator('[data-wls-fabric-demand-board-image-overlay] button[aria-label="关闭大图预览"]').last().click()
    await expect(page.locator('[data-wls-fabric-demand-board-image-overlay] img')).toHaveCount(0)
    await page.screenshot({ path: resolve(output, 'board-retained.png'), fullPage: true })
    await page.reload()
    await expect(page.getByRole('heading', { name: '面料需求看板', exact: true })).toBeVisible()
    evidence.board = { originalImplementationByteIdentical: preserved, relocatedMenuClick: true, filterAndReset: true, image: true, refreshDirect: true }
    assert.deepEqual(errors, [])
    await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, environment: 'development diagnostic', evidence, pageErrors: errors }, null, 2))
  } finally { await browser.close() }
})
