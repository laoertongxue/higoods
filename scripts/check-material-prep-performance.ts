#!/usr/bin/env node

import { chromium, type Page } from '@playwright/test'

const baseUrl = process.argv[2] || process.env.HIGOOD_BASE_URL || 'http://127.0.0.1:5174'
const routeThresholdMs = Number(process.env.HIGOOD_MATERIAL_PREP_ROUTE_THRESHOLD_MS || 800)
const actionThresholdMs = Number(process.env.HIGOOD_MATERIAL_PREP_ACTION_THRESHOLD_MS || 250)

const routes: Array<{ path: string; label: string }> = [
  { path: '/fcs/material-prep/list', label: '配料列表' },
  { path: '/fcs/material-prep/dyeing', label: '染色配料' },
  { path: '/fcs/material-prep/printing', label: '印花配料' },
  { path: '/fcs/material-prep/cutting', label: '裁片配料' },
  { path: '/fcs/material-prep/sewing', label: '车缝配料' },
  { path: '/fcs/material-prep/other', label: '其他配料' },
]

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

async function assertServerReady(): Promise<void> {
  try {
    const response = await fetch(baseUrl)
    assert(response.ok, `本地服务不可达：${baseUrl} 返回 ${response.status}`)
  } catch (error) {
    throw new Error(`本地服务不可达：${baseUrl}。请先启动 npm run dev -- --host 0.0.0.0 --port 5174。${String(error)}`)
  }
}

async function waitForMaterialPrepPage(page: Page, path: string, label: string): Promise<void> {
  await page.waitForFunction(
    ({ expectedPath, expectedLabel }) =>
      location.pathname === expectedPath &&
      document.body.innerText.includes(expectedLabel) &&
      document.body.innerText.length > 1000,
    { expectedPath: path, expectedLabel: label },
    { timeout: 10_000 },
  )
}

async function measure(name: string, action: () => Promise<void>): Promise<number> {
  const startedAt = performance.now()
  await action()
  return performance.now() - startedAt
}

async function assertNoPageErrors(pageErrors: string[], context: string): Promise<void> {
  assert(pageErrors.length === 0, `${context} 出现页面错误：${pageErrors.join('；')}`)
}

async function main(): Promise<void> {
  await assertServerReady()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors: string[] = []
  const results: Array<[string, number, number]> = []

  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())

  for (const route of routes) {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' })
    await waitForMaterialPrepPage(page, route.path, route.label)
  }
  await assertNoPageErrors(pageErrors, '配料管理预热')

  await page.goto(`${baseUrl}/fcs/material-prep/list`, { waitUntil: 'domcontentloaded' })
  await waitForMaterialPrepPage(page, '/fcs/material-prep/list', '配料列表')

  for (const route of routes.slice(1)) {
    const duration = await measure(`菜单切换到${route.label}`, async () => {
      await page.getByRole('button', { name: route.label, exact: true }).first().click()
      await waitForMaterialPrepPage(page, route.path, route.label)
    })
    results.push([`菜单切换到${route.label}`, duration, routeThresholdMs])
    assert(duration <= routeThresholdMs, `菜单切换到${route.label}耗时 ${duration.toFixed(1)}ms，超过 ${routeThresholdMs}ms`)
  }

  await page.goto(`${baseUrl}/fcs/material-prep/list`, { waitUntil: 'domcontentloaded' })
  await waitForMaterialPrepPage(page, '/fcs/material-prep/list', '配料列表')

  const searchDuration = await measure('配料列表查询', async () => {
    await page.locator('[data-fcs-material-prep-action="search-apply"]').first().click()
    await waitForMaterialPrepPage(page, '/fcs/material-prep/list', '配料列表')
  })
  results.push(['配料列表查询', searchDuration, actionThresholdMs])
  assert(searchDuration <= actionThresholdMs, `配料列表查询耗时 ${searchDuration.toFixed(1)}ms，超过 ${actionThresholdMs}ms`)

  const viewDuration = await measure('配料列表查看详情', async () => {
    await page.locator('[data-nav^="/fcs/material-prep/"][data-nav*="prepOrderId"]').first().click()
    await page.waitForFunction(
      () => location.pathname.startsWith('/fcs/material-prep/') &&
        location.search.includes('prepOrderId=') &&
        document.body.innerText.length > 1000,
      undefined,
      { timeout: 10_000 },
    )
  })
  results.push(['配料列表查看详情', viewDuration, routeThresholdMs])
  assert(viewDuration <= routeThresholdMs, `配料列表查看详情耗时 ${viewDuration.toFixed(1)}ms，超过 ${routeThresholdMs}ms`)

  await page.goto(`${baseUrl}/fcs/material-prep/cutting`, { waitUntil: 'domcontentloaded' })
  await waitForMaterialPrepPage(page, '/fcs/material-prep/cutting', '裁片配料')
  const returnFilterDuration = await measure('裁片配料只看有退回', async () => {
    await page.getByRole('button', { name: '只看有退回', exact: true }).first().click()
    await page.waitForFunction(
      () =>
        location.pathname === '/fcs/material-prep/cutting' &&
        new URLSearchParams(location.search).get('hasReturn') === '1' &&
        document.body.innerText.includes('已退回'),
      undefined,
      { timeout: 10_000 },
    )
  })
  results.push(['裁片配料只看有退回', returnFilterDuration, actionThresholdMs])
  assert(returnFilterDuration <= actionThresholdMs, `裁片配料只看有退回耗时 ${returnFilterDuration.toFixed(1)}ms，超过 ${actionThresholdMs}ms`)

  const openModalDuration = await measure('裁片配料打开新增配料记录', async () => {
    await page.locator('[data-nav*="prepModal=1"]').first().click()
    await page.waitForSelector('[data-fcs-prep-line-card]', { timeout: 10_000 })
  })
  results.push(['裁片配料打开新增配料记录', openModalDuration, routeThresholdMs])
  assert(openModalDuration <= routeThresholdMs, `裁片配料打开新增配料记录耗时 ${openModalDuration.toFixed(1)}ms，超过 ${routeThresholdMs}ms`)

  const fillDuration = await measure('裁片配料填入本次可配', async () => {
    await page.locator('[data-fcs-material-prep-action="fill-current-prep"]').first().click()
  })
  results.push(['裁片配料填入本次可配', fillDuration, actionThresholdMs])
  assert(fillDuration <= actionThresholdMs, `裁片配料填入本次可配耗时 ${fillDuration.toFixed(1)}ms，超过 ${actionThresholdMs}ms`)

  await page.goto(`${baseUrl}/fcs/craft/cutting/pickup-management?tab=PICKUP_DONE`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('领料管理'), undefined, { timeout: 10_000 })
  await page.locator('[data-nav*="pickup-management-detail"]').first().waitFor({ timeout: 10_000 })

  const openReturnDuration = await measure('领料详情打开退回入口', async () => {
    await page.locator('[data-nav*="pickup-management-detail"]').first().click()
    await page.waitForFunction(() => location.pathname.includes('pickup-management-detail'), undefined, { timeout: 10_000 })
    await page.waitForTimeout(500)
    await assertNoPageErrors(pageErrors, '领料详情')
    await page.waitForFunction(() => document.body.innerText.includes('领料详情'), undefined, { timeout: 10_000 })
    await page.getByRole('button', { name: /待加工仓入库记录/ }).first().click()
    await page.getByRole('button', { name: '退回物料' }).first().click()
    await page.waitForFunction(() => {
      const text = document.body.innerText
      return text.includes('退回物料') && text.includes('退回到中转仓')
    }, undefined, { timeout: 10_000 })
  })
  results.push(['领料详情打开退回入口', openReturnDuration, routeThresholdMs])
  assert(openReturnDuration <= routeThresholdMs, `领料详情打开退回入口耗时 ${openReturnDuration.toFixed(1)}ms，超过 ${routeThresholdMs}ms`)

  await assertNoPageErrors(pageErrors, '配料管理性能检查')
  await browser.close()

  console.log(
    [
      `配料管理页面性能检查通过（菜单阈值 ${routeThresholdMs}ms，按钮阈值 ${actionThresholdMs}ms）`,
      ...results.map(([name, duration, threshold]) => `${name}: ${duration.toFixed(1)}ms / ${threshold}ms`),
    ].join('\n'),
  )
}

void main()
