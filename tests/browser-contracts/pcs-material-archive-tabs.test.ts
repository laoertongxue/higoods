import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const base = process.env.MATERIAL_TEST_URL || 'http://127.0.0.1:43222'
const out = process.env.MATERIAL_TABS_OUTPUT || 'output/playwright/material-archive-tabs'
const rounds = Number(process.env.MATERIAL_TEST_ROUNDS || 5)
const formal = process.env.MATERIAL_CALIBRATION !== 'true'
const A = (key: string) => `[data-pcs-material-archive-action="${key}"]`
const F = (key: string) => `[data-pcs-material-archive-field="${key}"]`
const samples: { name: string; round: number; ms: number }[] = [], errors: string[] = [], checks: string[] = []
const roots = [['fabric', 'material-r1-MAT-FB-00000001', 'material-r1-MAT-FB-00000001-B01'], ['accessory', 'tmf-webbing-reference', 'tmf-webbing-reference-white'], ['yarn', 'material-r1-MAT-YN-00000001', 'material-r1-MAT-YN-00000001-B01']] as const
const root = roots[0][1]
const init = () => {
  ;(globalThis as any).__name = (v: unknown) => v
  for (const e of ['pointerdown', 'input', 'change']) document.addEventListener(e, () => { (globalThis as any).__start = performance.now() }, true)
  const put = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (...args: any[]) {
    if (this.name === 'records' && (globalThis as any).__failWrite) throw new DOMException('Injected quota failure', 'QuotaExceededError')
    return put.apply(this, args as any)
  }
}
async function ready(p: Page) {
  await p.waitForSelector('main')
  await p.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img')].filter(i => { const r = i.getBoundingClientRect(); return i.checkVisibility() && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 }).every(i => i.complete && i.naturalWidth > 0))
  await p.evaluate(async () => { await document.fonts.ready; await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))) })
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no body horizontal overflow')
}
async function end(p: Page, name: string, round: number, nav = false) {
  await ready(p)
  const ms = await p.evaluate(nav => nav ? performance.now() : performance.now() - (globalThis as any).__start, nav)
  samples.push({ name, round, ms }); if (formal) assert.ok(ms <= 1000, `${name}: ${ms} ms`)
}
async function action(p: Page, name: string, round: number, run: () => Promise<unknown>, done?: () => Promise<unknown>) { await run(); if (done) await done(); await end(p, name, round) }
async function go(p: Page, path: string, name: string, round: number, selector: string) { await p.goto(base + path, { waitUntil: 'domcontentloaded' }); await p.waitForSelector(selector); await end(p, name, round, true) }
async function rows(p: Page, store = 'records') {
  return p.evaluate(async store => {
    const db = await new Promise<IDBDatabase>((r, j) => { const q = indexedDB.open('higood-pcs-records'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) })
    const result = await new Promise<any[]>((r, j) => { const q = db.transaction(store, 'readonly').objectStore(store).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) }); db.close()
    return store === 'files' ? result.map(v => ({ id: v.id, size: v.blob.size, type: v.blob.type })) : result.sort((a, b) => a.id.localeCompare(b.id))
  }, store)
}
async function openFiles(p: Page, section: string) { const detail = p.locator(`[data-material-attachments="${section}"]`); if (!await detail.evaluate(e => (e as HTMLDetailsElement).open)) await detail.locator('summary').first().click() }
async function upload(p: Page, section: string, role: string, name: string, round: number, family: string) {
  await openFiles(p, section)
  if (await p.locator(F('assetRole')).count()) { await action(p, family + ':role', round, () => p.locator(F('assetRole')).selectOption(role)); await openFiles(p, section) }
  const photo = role === 'IDENTIFICATION' || role === 'COLOR_SAMPLE'
  await action(p, family + ':file', round, () => photo ? p.locator(F('assetFile')).setInputFiles('public/materials/process-orders/white-black-cotton-jersey.jpg') : p.locator(F('assetFile')).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('规格及工艺说明_' + name) }))
}
async function save(p: Page, name: string, round: number, family: string) {
  await action(p, family + ':save', round, () => p.locator(A('save-asset')).click(), async () => {
    await p.waitForFunction(async name => {
      const db = await new Promise<IDBDatabase>((r, j) => { const q = indexedDB.open('higood-pcs-records'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) })
      const all = await new Promise<any[]>((r, j) => { const q = db.transaction('records', 'readonly').objectStore('records').getAll(); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) }); db.close()
      return all.some(v => v.collection.endsWith('/assets') && v.value?.data?.name === name) && [...document.querySelectorAll('[data-material-attachments]')].some(e => e.textContent?.includes(name))
    }, name)
    await p.getByRole('status').filter({ hasText: '附件已保存。' }).waitFor()
    assert.ok((await rows(p)).some(v => v.collection.endsWith('/assets') && v.value?.data?.name === name), name)
    assert.ok((await rows(p, 'files')).length > 0)
  })
}
test('TAB-01..12: archive-only tabs, contextual attachments, atomic save, retained history and visible pages', { timeout: 240000 }, async () => {
  await mkdir(out, { recursive: true }); const b = await chromium.launch(); let p: Page | undefined
  try {
    for (let r = 0; r < rounds; r++) {
      const c = await b.newContext({ viewport: r === 4 ? { width: 1280, height: 720 } : { width: 1366, height: 768 }, timezoneId: 'Asia/Shanghai' })
      await c.addInitScript(init); p = await c.newPage(); p.setDefaultTimeout(6000); p.on('pageerror', e => errors.push(e.message))
      const cd = await c.newCDPSession(p); await cd.send('Network.enable'); await cd.send('Network.setCacheDisabled', { cacheDisabled: true })
      for (const [kind, id, sku] of roots) {
        const path = `/pcs/materials/${kind}/${id}`
        await go(p, path, kind + ':root-cold', r, '[data-pcs-material-detail]')
        assert.equal(await p.locator(A('root-tab') + '[data-value="assets"]').count(), 0)
        if (kind === 'fabric') { const initial = await rows(p); assert.equal(initial.filter(v => v.collection.includes('material-archive')).length, 0, 'first material read does not copy static seeds') }
        await openFiles(p, 'spec'); assert.deepEqual(await p.locator(F('assetRole') + ' option:not([value=""])').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value)), ['IDENTIFICATION', 'SPECIFICATION'])
        const rootFile = kind + '-通用说明-' + r + '.txt'; await upload(p, 'spec', 'SPECIFICATION', rootFile, r, kind + ':root'); await save(p, rootFile, r, kind + ':root')
        await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-pcs-material-detail]'); await end(p, kind + ':root-refresh', r, true); await openFiles(p, 'spec'); assert.ok((await p.locator('main').innerText()).includes(rootFile))
        await go(p, path + '/skus/' + sku, kind + ':sku-cold', r, '[data-pcs-material-sku-detail]')
        assert.equal(await p.locator(A('sku-tab') + '[data-value="plans"], ' + A('sku-tab') + '[data-value="assets"], ' + A('process-order')).count(), 0)
        const file = kind + '-规格-' + r + '.txt'
        await upload(p, 'spec', 'SPECIFICATION', file, r, kind + ':spec'); await save(p, file, r, kind + ':spec')
        await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-pcs-material-sku-detail]'); await end(p, kind + ':saved-refresh', r, true); await openFiles(p, 'spec')
        const link = p.locator('tr').filter({ hasText: file }).getByRole('link', { name: '查看文件' }); const href = await link.getAttribute('href'); const bytes = await p.evaluate(async href => await (await fetch(href!)).text(), href); assert.equal(bytes, '规格及工艺说明_' + file)
        for (const tab of ['units', 'cost', 'pack']) await action(p, kind + ':' + tab + '-tab', r, () => p!.locator(A('sku-tab') + `[data-value="${tab}"]`).click())
        if (r === 0 || r === 4) { await p.locator(A('sku-tab') + '[data-value="spec"]').click(); await openFiles(p, 'spec'); await p.screenshot({ path: `${out}/${kind}-spec-${r === 4 ? 1280 : 1366}.png`, fullPage: true }) }
      }
      for (const [kind, id] of roots) {
        await go(p, `/pcs/materials/${kind}/${id}`, kind + ':root-return', r, '[data-pcs-material-detail]'); await openFiles(p, 'spec')
        assert.ok(!(await p.locator('[data-material-attachments="spec"]').innerText()).includes(kind + '-规格-' + r + '.txt'), 'SKU attachments not mixed into root')
      }
      for (const [proc, role] of [['dye', 'SPECIFICATION'], ['print', 'PRINT_FILE'], ['embroidery', 'EMBROIDERY_FILE'], ['heat', 'HEAT_TRANSFER_FILE']] as const) {
        const id = 'material-r1-process-' + proc, path = `/pcs/materials/fabric/${root}/skus/${id}`
        await go(p, path, proc + ':sku-cold', r, '[data-pcs-material-sku-detail]'); await action(p, proc + ':process-tab', r, () => p!.locator(A('sku-tab') + '[data-value="process"]').click()); await openFiles(p, 'process')
        assert.equal(await p.locator(F('assetProcessVersion')).count(), 0)
        if (proc === 'dye') assert.deepEqual(await p.locator(F('assetRole') + ' option:not([value=""])').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value)), ['COLOR_SAMPLE', 'SPECIFICATION'])
        else assert.equal(await p.locator(F('assetRole')).count(), 0, 'single execution role needs no picker')
        const before = await rows(p), previousFiles = await rows(p, 'files')
        const file = proc + '-标准-' + r + '.txt'
        await upload(p, 'process', role, file, r, proc)
        if (proc === 'dye') {
          await p.evaluate(() => { (globalThis as any).__failWrite = true })
          await action(p, 'failure:save', r, () => p!.locator(A('save-asset')).click(), () => p!.getByRole('status').filter({ hasText: /未保存/ }).waitFor())
          assert.deepEqual(await rows(p), before); assert.deepEqual(await rows(p, 'files'), previousFiles)
          await openFiles(p, 'process'); assert.ok((await p.locator('main').innerText()).includes(file), 'failed file remains selected')
          await p.evaluate(() => { (globalThis as any).__failWrite = false })
        }
        await save(p, file, r, proc)
        const firstRows = await rows(p), d1 = firstRows.find(v => v.collection.endsWith('/processDefinitions') && v.value?.data?.outputSkuId === id)?.value.data
        assert.ok(d1?.executionAssetIds.length); const oldIds = d1.executionAssetIds
        const revisionFile = proc + '-补充-' + r + '.txt'; await upload(p, 'process', role, revisionFile, r, proc + ':revision'); await save(p, revisionFile, r, proc + ':revision')
        const d2 = (await rows(p)).find(v => v.collection.endsWith('/processDefinitions') && v.value?.data?.outputSkuId === id)?.value.data
        assert.notEqual(d2.processVersionId, d1.processVersionId); assert.ok(d2.documentHistory.some((v: any) => v.processVersionId === d1.processVersionId && JSON.stringify(v.executionAssetIds) === JSON.stringify(oldIds)))
        for (const oldAsset of firstRows.filter(v => v.collection.endsWith('/assets') && oldIds.includes(v.value?.data?.assetId))) assert.ok((await rows(p)).some(v => v.id === oldAsset.id && JSON.stringify(v.value) === JSON.stringify(oldAsset.value)), 'older asset records retained unchanged')
        await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-pcs-material-sku-detail]'); await end(p, proc + ':saved-refresh', r, true); await p.locator(A('sku-tab') + '[data-value="process"]').click(); await openFiles(p, 'process')
        assert.ok((await p.locator('main').innerText()).includes(revisionFile)); assert.ok(await p.getByText('历史执行文件', { exact: true }).count())
        if (r === 0 || r === 4) await p.screenshot({ path: `${out}/${proc}-process-${r === 4 ? 1280 : 1366}.png`, fullPage: true })
        if (proc === 'dye') {
          await upload(p, 'process', 'COLOR_SAMPLE', '', r, 'dye:sample')
          await p.locator(A('sku-tab') + '[data-value="spec"]').click(); await p.locator('[data-dialog-cancel]').click(); await end(p, 'unsaved:cancel-tab', r); assert.ok(await p.locator('[data-material-attachments="process"]').count())
          await p.locator(A('sku-tab') + '[data-value="spec"]').click(); await p.locator('[data-dialog-confirm]').click(); await end(p, 'unsaved:confirm-tab', r); await openFiles(p, 'spec'); assert.equal(await p.locator(F('assetFile')).evaluate(e => (e as HTMLInputElement).files?.length), 0)
          await p.locator(A('sku-tab') + '[data-value="process"]').click(); await upload(p, 'process', 'COLOR_SAMPLE', '', r, 'dye:sample'); await save(p, 'white-black-cotton-jersey.jpg', r, 'dye:sample')
          await openFiles(p, 'process'); await action(p, 'sample:image-open', r, () => p!.locator('tr').filter({ hasText: 'white-black-cotton-jersey.jpg' }).locator(A('image')).click())
          await action(p, 'sample:image-close', r, () => p!.locator(A('close-overlay')).click())
        }
      }
      for (const kind of ['parts', 'consumable']) { await go(p, '/pcs/materials/' + kind, kind + ':adjacent-list', r, '[data-pcs-material-archive-page]'); assert.ok(await p.getByRole('columnheader', { name: '规格 SKU', exact: false }).count()) }
      checks.push(`round ${r}: three roots and base SKUs, four process attachment forms, quota rollback, Blob readback, revisions and pending-file confirmation passed`)
      await c.close()
    }
  } catch (e) { if (p && !p.isClosed()) { await p.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {}); await writeFile(out + '/failure.txt', await p.locator('body').innerText().catch(() => '')) }; throw e }
  finally {
    const sourceSha = createHash('sha256').update(await readFile('src/pages/pcs-material-archives.ts')).digest('hex'), testSha = createHash('sha256').update(await readFile('tests/browser-contracts/pcs-material-archive-tabs.test.ts')).digest('hex')
    await writeFile(out + '/evidence.json', JSON.stringify({ base, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), sourceSha, testSha, assetsSha: createHash('sha256').update(await readFile('dist/index.html')).digest('hex'), browser: b.version(), formal, rounds, samples, checks, errors }, null, 2)); await b.close()
  }
  assert.deepEqual(errors, [])
})
