import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium, type Page } from '@playwright/test'
import { listStyleArchives } from '../../src/data/pcs-style-archive-repository.ts'
import { listSkuArchivesByStyleId } from '../../src/data/pcs-sku-archive-repository.ts'
import { listTechnicalDataVersionsByStyleId } from '../../src/data/pcs-technical-data-version-repository.ts'

const base = process.env.PRODUCT_REFERENCE_URL || 'http://127.0.0.1:43222'
const out = process.env.PRODUCT_REFERENCE_OUTPUT || 'output/playwright/product-reference-removal'
const rounds = Number(process.env.PRODUCT_REFERENCE_ROUNDS || 5), formal = process.env.PRODUCT_REFERENCE_CALIBRATION !== 'true'
const style = listStyleArchives().find(s => s.currentTechPackVersionId && listSkuArchivesByStyleId(s.styleId).length && listTechnicalDataVersionsByStyleId(s.styleId).length)!
assert.ok(style, 'linked source archive exists')
const sku = listSkuArchivesByStyleId(style.styleId)[0], version = listTechnicalDataVersionsByStyleId(style.styleId)[0]
const routes = [['style', `/pcs/products/styles/${style.styleId}`, ['basic', 'translations', 'sales', 'skus', 'relations', 'records']], ['sku', `/pcs/products/specifications/${sku.skuId}`, ['basic', 'translations', 'packaging', 'channels', 'records']]] as const
const A = (a: string) => `[data-pcs-product-archive-action="${a}"]`
const samples: Array<{ name: string; round: number; ms: number }> = [], errors: string[] = []
const init = () => { (globalThis as any).__name = (v: unknown) => v; document.addEventListener('pointerdown', () => { (globalThis as any).__start = performance.now() }, true) }
async function ready(p: Page) {
  await p.waitForSelector('[data-pcs-product-archive-root] [data-product-detail-body]')
  await p.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img')].filter(i => { const r = i.getBoundingClientRect(); return i.checkVisibility() && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 }).every(i => i.complete && i.naturalWidth > 0))
  await p.evaluate(async () => { await document.fonts.ready; await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))) })
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.doesNotMatch(await p.locator('main').innerText(), /技术引用|技术包引用|核价引用/)
  assert.equal(await p.locator(A('tab') + '[data-tab="technical"]').count(), 0)
}
async function end(p: Page, name: string, round: number, nav = false) {
  await ready(p); const ms = await p.evaluate(nav => nav ? performance.now() : performance.now() - (globalThis as any).__start, nav)
  samples.push({ name, round, ms }); if (formal) assert.ok(ms <= 1000, `${name}: ${ms}ms`)
}
test('REF-01..08 style/SKU reference removal, retained tabs, refresh and independent technical package', { timeout: 120000 }, async () => {
  await mkdir(out, { recursive: true }); const browser = await chromium.launch(); let p: Page | undefined
  try {
    for (let r = 0; r < rounds; r++) {
      const c = await browser.newContext({ viewport: r === 4 ? { width: 1280, height: 720 } : { width: 1366, height: 768 }, timezoneId: 'Asia/Shanghai' }); await c.addInitScript(init); p = await c.newPage(); p.setDefaultTimeout(6000); p.on('pageerror', e => errors.push(e.message))
      const cd = await c.newCDPSession(p); await cd.send('Network.enable'); await cd.send('Network.setCacheDisabled', { cacheDisabled: true })
      for (const [kind, path, tabs] of routes) {
        await p.goto(base + path, { waitUntil: 'domcontentloaded' }); await end(p, kind + ':cold', r, true)
        assert.deepEqual(await p.locator(A('tab')).evaluateAll(nodes => nodes.map(n => (n as HTMLElement).dataset.tab)), [...tabs])
        await p.reload({ waitUntil: 'domcontentloaded' }); await end(p, kind + ':refresh', r, true)
        for (const key of tabs) {
          await p.locator(A('tab') + `[data-tab="${key}"]`).click(); await p.locator(A('tab') + `[data-tab="${key}"][aria-selected="true"]`).waitFor(); await end(p, kind + ':tab-' + key, r)
          assert.equal(await p.locator('[data-product-detail-body]').count(), 1)
        }
        // Simulate a stale page button: it must not reactivate an obsolete tab.
        const before = await p.locator('[data-product-detail-body]').innerHTML()
        await p.evaluate(() => { const button = document.createElement('button'); button.dataset.pcsProductArchiveAction = 'tab'; button.dataset.tab = 'technical'; button.textContent = 'stale-event'; document.querySelector('main')!.append(button); button.click(); button.remove() })
        await ready(p); assert.equal(await p.locator('[data-product-detail-body]').innerHTML(), before); assert.ok(await p.locator(A('tab') + '[aria-selected="true"]').count())
        if (r === 0 || r === 4) { await p.locator(A('tab') + '[data-tab="basic"]').click(); await ready(p); await p.screenshot({ path: `${out}/${kind}-${r === 4 ? 1280 : 1366}.png`, fullPage: true }) }
      }
      if (r === 0) {
        await p.goto(`${base}/pcs/products/styles/${style.styleId}/technical-data/${version.technicalVersionId}`, { waitUntil: 'domcontentloaded' })
        await p.getByText(version.technicalVersionCode, { exact: false }).first().waitFor()
        assert.match(await p.locator('main').innerText(), /技术包/)
      }
      await c.close()
    }
    assert.deepEqual(errors, [])
  } catch (error) { if (p && !p.isClosed()) { await p.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {}); await writeFile(out + '/failure.txt', await p.locator('body').innerText().catch(() => '')) }; throw error }
  finally {
    const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
    await writeFile(out + '/evidence.json', JSON.stringify({ base, formal, rounds, routes, linkedStyleId: style.styleId, linkedSkuId: sku.skuId, technicalVersionId: version.technicalVersionId, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), sourceSha: sha(await readFile('src/pages/pcs-product-archives.ts')), testSha: sha(await readFile('tests/browser-contracts/pcs-product-reference-removal.test.ts')), assetsSha: sha(await readFile('dist/index.html')), browser: browser.version(), samples, errors }, null, 2)); await browser.close()
  }
})
