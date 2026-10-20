import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const base = process.env.PROGRESS_MATERIAL_LIST_TEST_URL || 'http://127.0.0.1:43270'
const output = resolve(process.env.PROGRESS_MATERIAL_LIST_TEST_OUTPUT || 'output/verification/prototype-full-function-cleanup/progress-list-tests')
let browser: Browser
const evidence: Record<string, unknown> = {}
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close(); await writeFile(resolve(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base, evidence }, null, 2)) })
async function run(name: string, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }), page = await context.newPage(), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => { (globalThis as any).__name = (value: unknown) => value })
  try { await page.goto(base + '/fcs/progress/material'); await expect(page.locator('[data-material-list-view]')).toBeVisible(); await fn(page); assert.deepEqual(errors, []) }
  catch (error) { await writeFile(resolve(output, `${name}-failure.json`), JSON.stringify({ error: String(error), errors }, null, 2)); await page.screenshot({ path: resolve(output, `${name}-failure.png`), fullPage: true }).catch(() => {}); throw error }
  finally { await context.close() }
}
function mainTable(page: Page) { return page.locator('[data-material-list-view] > [data-standard-list-page] [data-standard-list-table-section]') }
async function expected(page: Page, filters: { keyword?: string; status?: string; shortage?: string; from?: string; to?: string } = {}) {
  return page.evaluate(async filters => {
    const { productionOrders } = await import('/src/data/fcs/production-orders.ts')
    const api = await import('/src/data/fcs/warehouse-material-execution.ts')
    const rows = productionOrders.map(order => ({ id: order.productionOrderId, legacyOrderNo: order.legacyOrderNo, spu: order.demandSnapshot.spuCode, name: order.demandSnapshot.spuName, factory: order.mainFactorySnapshot.name, date: order.demandSnapshot.requiredDeliveryDate ?? '-', docs: api.listWarehouseExecutionDocsByOrder(order.productionOrderId), summary: api.getWarehouseExecutionSummaryByOrder(order.productionOrderId) }))
    const matches = rows.filter(row => (!filters.keyword || `${row.id} ${row.legacyOrderNo} ${row.spu} ${row.name} ${row.factory}`.toLowerCase().includes(filters.keyword.toLowerCase())) && (!filters.status || (filters.status === 'NO_DOC' ? !row.docs[0] : row.docs[0]?.status === filters.status)) && (!filters.shortage || (filters.shortage === 'YES' ? row.summary.shortLineCount > 0 : row.summary.shortLineCount === 0)) && (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to))
    return { all: rows.length, count: matches.length, ids: matches.map(row => row.id), rows: matches.map(({ id, date, summary }) => ({ id, date, summary })), requests: matches.reduce((sum, row) => sum + row.summary.requestCount, 0), issues: matches.reduce((sum, row) => sum + row.summary.issueOrderCount, 0), returns: matches.reduce((sum, row) => sum + row.summary.returnOrderCount, 0), transfers: matches.reduce((sum, row) => sum + row.summary.internalTransferCount, 0), shortages: matches.reduce((sum, row) => sum + row.summary.shortLineCount, 0) }
  }, filters)
}
async function assertRange(page: Page, count: number, size: number, pageNo = 1) {
  const table = mainTable(page)
  await expect(table.locator('footer > p')).toHaveText(count ? `共 ${count} 条，当前 ${(pageNo - 1) * size + 1}-${Math.min(pageNo * size, count)}` : '共 0 条')
  await expect(table.locator('tbody > tr')).toHaveCount(count ? Math.min(size, count - (pageNo - 1) * size) : 1)
}

test('物料进度标准主表保留11字段及补充区，无角色门槛；统计和分页总数按完整结果', { timeout: 90000 }, async () => run('list-direct', async page => {
  const data = await expected(page), table = mainTable(page)
  assert.ok(data.all > 10, '分页代表范围须超过一页')
  await expect(table.locator('thead th')).toHaveCount(11)
  await expect(table.locator('thead')).toContainText('旧单号'); await expect(table.locator('thead')).toContainText('SPU'); await expect(table.locator('thead')).toContainText('主工厂'); await expect(table.locator('thead')).toContainText('交付期'); await expect(table.locator('thead')).toContainText('需求数'); await expect(table.locator('thead')).toContainText('发料/回货/流转'); await expect(table.locator('thead')).toContainText('齐套率'); await expect(table.locator('thead')).toContainText('完成率'); await expect(table.locator('thead')).toContainText('最新执行状态')
  await assertRange(page, data.count, 10)
  const statValues = await page.locator('[data-material-list-view] > [data-standard-list-page] > [data-standard-list-stats] strong').allTextContents()
  assert.deepEqual(statValues.slice(0, 5), [data.requests, data.issues, data.returns, data.transfers, data.shortages].map(String))
  for (const title of ['配料进度', '正式接收需求跟踪', '仓库执行单']) await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.locator('[data-material-field="warehouseActor"]')).toHaveCount(0)
  await table.locator('[data-material-action="next-page"]').click(); await assertRange(page, data.count, 10, 2)
  const visibleIds = await table.locator('tbody button[data-material-action="select-po"]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.poId))
  assert.deepEqual(visibleIds, data.ids.slice(10, 20))
  for (const width of [1280, 1024]) { await page.setViewportSize({ width, height: 768 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `页面主体不能在${width}px溢出`) }
  evidence['list-direct'] = { passed: true, records: data.count, firstPage: 10, nextPageIds: visibleIds, statValues, viewports: [1366, 1280, 1024] }
}))

test('主表所有筛选与统计同范围，筛选重置页码；每页条数按路由保存且刷新有效', { timeout: 90000 }, async () => run('filters-pages', async page => {
  const table = mainTable(page), all = await expected(page)
  await table.locator('[data-material-field="pageSize"]').selectOption('20'); await assertRange(page, all.count, 20)
  await page.reload(); await expect(page.locator('[data-material-list-view]')).toBeVisible(); await expect(table.locator('[data-material-field="pageSize"]')).toHaveValue('20'); await assertRange(page, all.count, 20)
  await table.locator('[data-material-action="next-page"]').click()
  const keyword = all.ids[0]
  await page.locator('[data-material-field="keyword"]').fill(keyword)
  const byKeyword = await expected(page, { keyword }); await assertRange(page, byKeyword.count, 20)
  await page.locator('[data-material-action="reset-filters"]').click(); await assertRange(page, all.count, 20)
  await page.locator('[data-material-field="executionStatus"]').selectOption('NO_DOC')
  const noDoc = await expected(page, { status: 'NO_DOC' }); await assertRange(page, noDoc.count, 20)
  await page.locator('[data-material-action="reset-filters"]').click()
  await page.locator('[data-material-field="hasShortage"]').selectOption('YES')
  const shortage = await expected(page, { shortage: 'YES' }); await assertRange(page, shortage.count, 20)
  const requests = await page.locator('[data-material-list-view] > [data-standard-list-page] > [data-standard-list-stats] strong').first().textContent(); assert.equal(requests, String(shortage.requests))
  await page.locator('[data-material-action="reset-filters"]').click()
  const date = all.rows.find(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date))!.date
  await page.locator('[data-material-field="deliveryDateFrom"]').fill(date)
  await page.locator('[data-material-field="deliveryDateTo"]').fill(date)
  const onDate = await expected(page, { from: date, to: date }); await assertRange(page, onDate.count, 20)
  await page.locator('[data-material-action="reset-filters"]').click()
  await page.locator('[data-material-field="keyword"]').fill('NO-SUCH-ORDER-CLEANUP')
  await assertRange(page, 0, 20); await expect(table.locator('tbody')).toContainText('暂无数据'); await expect(table.locator('[data-material-action="next-page"]')).toBeDisabled()
  await page.locator('[data-material-action="reset-filters"]').click(); await assertRange(page, all.count, 20)
  evidence['filters-pages'] = { passed: true, all: all.count, keyword: byKeyword.count, noDoc: noDoc.count, shortage: shortage.count, date: onDate.count, persistedPageSize: 20, noResult: true }
}))

test('标准主表仍可进入原生产单详情并返回，无新增演示身份选择', { timeout: 90000 }, async () => run('detail-navigation', async page => {
  const first = mainTable(page).locator('tbody button[data-material-action="select-po"]').first(), id = await first.getAttribute('data-po-id')
  await first.click(); await expect(page).toHaveURL(new RegExp('[?&]po=' + encodeURIComponent(id!)))
  await expect(page.getByRole('button', { name: '返回列表', exact: true })).toBeVisible()
  await expect(page.locator('[data-material-field="warehouseActor"]')).toHaveCount(0)
  await page.getByRole('button', { name: '返回列表', exact: true }).click(); await expect(page.locator('[data-material-list-view]')).toBeVisible()
  await page.reload(); await expect(page.locator('[data-material-list-view]')).toBeVisible()
  const code = await readFile('src/pages/progress-material.ts', 'utf8')
  assert.doesNotMatch(code, /warehouseActor|演示角色|演示模式/)
  evidence['detail-navigation'] = { passed: true, productionOrderId: id, reload: true }
}))
