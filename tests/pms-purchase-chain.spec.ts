import { expect, test, type Page } from '@playwright/test'
import type { PmsProductPurchaseOrder, PmsProductPurchaseType } from '../src/data/pms/product-purchase-orders.ts'
import type { PmsKolDemand, PmsPurchaseSuggestion } from '../src/data/pms/purchase-suggestions.ts'

const SUGGESTIONS = '/pms/purchase-suggestions'
const KOL = '/pms/kol-demands'
const PPO = '/pms/product-purchase-orders'
const PERF_THRESHOLD = 1000 // 当前 AGENTS.md PERF-01；保留每个原始样本，任一超时即失败。
const PPO_DIALOG = '[data-pms-ppo-overlays] [role="dialog"]'
const PPO_STORE = 'pmsProductPurchaseOrders'

// 写入只通过真实页面动作；此辅助方法只读现有数据库，不创建/清空/修改任何记录。
async function readRecords<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(async (storeName) => new Promise<T[]>((resolve, reject) => {
    const request = indexedDB.open('higood-pms')
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('页面未打开现有 PMS 数据库')) }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) { db.close(); reject(new Error(`缺少业务仓库 ${storeName}`)); return }
      const tx = db.transaction(storeName, 'readonly')
      const query = tx.objectStore(storeName).getAll()
      let rows: T[] = []
      query.onsuccess = () => { rows = query.result as T[] }
      tx.oncomplete = () => { db.close(); resolve(rows) }
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('只读回查中止')) }
    }
  }), store)
}

async function readOrder(page: Page, orderNo: string): Promise<PmsProductPurchaseOrder> {
  const row = (await readRecords<PmsProductPurchaseOrder>(page, PPO_STORE)).find(item => item.purchaseOrderNo === orderNo)
  expect(row, `持久回读采购单 ${orderNo}`).toBeDefined()
  return row!
}

async function queryOrder(page: Page, orderNo: string): Promise<void> {
  await page.locator('[data-pms-ppo-action="reset"]').click()
  await page.locator('[data-pms-ppo-field="keyword"]').fill(orderNo)
  await page.locator('[data-pms-ppo-action="query"]').click()
  await expect(page.locator(`[data-pms-ppo-field="select-row"][data-order-no="${orderNo}"]`)).toBeVisible()
}

async function openOrderAction(page: Page, orderNo: string, action: string): Promise<void> {
  await queryOrder(page, orderNo)
  const button = page.locator(`[data-pms-ppo-action="${action}"][data-order-no="${orderNo}"]`).first()
  const disclosure = button.locator('xpath=ancestor::details[1]')
  if (await disclosure.count()) await disclosure.locator('summary').click()
  await button.click()
  await expect(page.locator(PPO_DIALOG)).toBeVisible()
}

async function submitOrderAction(page: Page, action: string): Promise<void> {
  await page.locator('[data-pms-ppo-action="submit-action"]').click()
  await expect(page.locator(PPO_DIALOG)).toHaveCount(0)
  await expect(page.locator('[data-pms-ppo-feedback]')).toContainText(`${action}已保存`)
}

async function selectOrders(page: Page, orderNos: string[]): Promise<void> {
  await page.locator('[data-pms-ppo-action="reset"]').click()
  await page.locator('[data-pms-ppo-field="pageSize"]').selectOption('50')
  for (const no of orderNos) await page.locator(`[data-pms-ppo-field="select-row"][data-order-no="${no}"]`).check()
}

async function openBulkAction(page: Page, orderNos: string[], action: string): Promise<void> {
  await selectOrders(page, orderNos)
  const button = page.locator(`[data-pms-ppo-action="bulk"][data-business-action="${action}"]`)
  const menu = button.locator('xpath=ancestor::details[1]')
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click()
  await expect(button).toBeVisible()
  await button.click()
  await expect(page.locator(PPO_DIALOG)).toContainText(`${orderNos.length} 张`)
}

async function createOrder(page: Page, remark: string, options: { type?: PmsProductPurchaseType; draft?: boolean; qty?: [number, number] } = {}): Promise<PmsProductPurchaseOrder> {
  const type = options.type ?? '样衣', qty = options.qty ?? [8, 3]
  await page.locator(`[data-pms-ppo-action="open-create"][data-type="${type}"]`).click()
  await expect(page.locator(PPO_DIALOG)).toBeVisible()
  const firstSpu = await page.locator('[data-pms-ppo-input="spu"] option').nth(1).getAttribute('value')
  expect(firstSpu, '商品中心有效 SPU 候选').toBeTruthy()
  await page.locator('[data-pms-ppo-input="spu"]').selectOption(firstSpu!)
  const checks = page.locator('[data-pms-ppo-sku-check]')
  expect(await checks.count(), '所选款式至少两个真实 SKU').toBeGreaterThanOrEqual(2)
  await page.locator('[data-pms-ppo-action="sku-none"]').click()
  const skus: string[] = []
  for (let index = 0; index < 2; index += 1) {
    const sku = (await checks.nth(index).getAttribute('data-pms-ppo-sku-check'))!
    skus.push(sku)
    await checks.nth(index).check()
    await page.locator(`[data-pms-ppo-sku-qty="${sku}"]`).fill(String(qty[index]))
    await page.locator(`[data-pms-ppo-sku-price="${sku}"]`).fill('12.5')
    await page.locator(`[data-pms-ppo-sku-weight="${sku}"]`).fill('0.35')
  }
  await page.locator('[data-pms-ppo-input="expectedDeliveryDate"]').fill('2026-12-31')
  await page.locator('[data-pms-ppo-input="purchaser"]').fill('P1采购员')
  await page.locator('[data-pms-ppo-input="currency"]').selectOption('CNY')
  await page.locator('[data-pms-ppo-input="exchangeRate"]').fill('1')
  await page.locator('[data-pms-ppo-input="remark"]').fill(remark)
  await page.locator(`[data-pms-ppo-action="${options.draft ? 'submit-draft' : 'submit-create'}"]`).click()
  await expect(page.locator(PPO_DIALOG)).toHaveCount(0)
  const matches = (await readRecords<PmsProductPurchaseOrder>(page, PPO_STORE)).filter(row => row.remark === remark)
  expect(matches, '一个真实表单创建一个持久采购对象').toHaveLength(1)
  const row = matches[0]
  expect(row).toMatchObject({ spu: firstSpu, purchaseType: type, status: options.draft ? '草稿' : '待采购', currency: 'CNY', exchangeRate: 1, purchaser: 'P1采购员', expectedDeliveryDate: '2026-12-31' })
  expect(row.lines.map(line => line.sku)).toEqual(skus)
  expect(row.lines.map(line => line.qty)).toEqual(qty)
  expect(row.lines.every(line => line.actualPrice === 12.5 && line.deliveredQty === 0 && Boolean(line.imageUrl))).toBe(true)
  expect(row.supplierName).toBeTruthy()
  expect(row.warehouse).toBeTruthy()
  return row
}

async function newOrderSince(page: Page, previousNos: string[]): Promise<PmsProductPurchaseOrder> {
  const created = (await readRecords<PmsProductPurchaseOrder>(page, PPO_STORE)).filter(row => !previousNos.includes(row.purchaseOrderNo))
  expect(created, '此次操作只新增一张采购单').toHaveLength(1)
  return created[0]
}

async function expectFreshDetail(page: Page, order: PmsProductPurchaseOrder): Promise<void> {
  await page.reload()
  await expect(page.locator('[data-pms-ppo-root]')).toBeVisible()
  await openOrderAction(page, order.purchaseOrderNo, 'view-detail')
  const dialog = page.locator(PPO_DIALOG)
  await expect(dialog).toContainText(order.purchaseOrderNo)
  await expect(dialog).toContainText(order.supplierName)
  await expect(dialog).toContainText(order.warehouse)
  for (const line of order.lines) {
    const row = dialog.locator('tbody tr').filter({ hasText: line.sku })
    await expect(row.locator('td').nth(1)).toHaveText(String(line.qty))
    await expect(row.locator('td').nth(2)).toHaveText(String(line.deliveredQty))
    await expect(row.locator('td').nth(4)).toHaveText(line.actualPrice.toFixed(2))
    await expect(row.locator('td').nth(5)).toHaveText(line.materialStatus)
  }
  await page.keyboard.press('Escape')
  await expect(page.locator(PPO_DIALOG)).toHaveCount(0)
  expect(await readOrder(page, order.purchaseOrderNo)).toEqual(order)
}

function quantityMap(order: PmsProductPurchaseOrder): Record<string, number> {
  return Object.fromEntries(order.lines.map(line => [line.sku, line.qty]))
}
const amount = (row: PmsProductPurchaseOrder): number => row.lines.reduce((sum, line) => sum + line.qty * line.actualPrice, 0)

interface PerfResult { start: number | null; elapsed: number | null; error: string | null }

// 实际 Playwright click 的捕获阶段计时；不把已有表格节点或 Loading 当完成。
async function measureAction(page: Page, clickSelector: string, readySelector: string, replaced = false, route?: string): Promise<number> {
  await page.evaluate(({ clickSelector, readySelector, replaced, route }) => {
    const perfWindow = window as unknown as { __pmsP1Perf: PerfResult }
    perfWindow.__pmsP1Perf = { start: null, elapsed: null, error: null }
    const previous = document.querySelector(readySelector)
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(clickSelector)) return
      document.removeEventListener('click', onClick, true)
      const sample = perfWindow.__pmsP1Perf
      if (!event.isTrusted) { sample.error = '采集无效：没有真实点击事件'; return }
      sample.start = performance.now()
      const finish = async () => {
        try {
          while (true) {
            if (performance.now() - sample.start! > 5000) throw new Error(`等待完整结果超时：${readySelector}`)
            const node = document.querySelector<HTMLElement>(readySelector)
            if (!node || !node.getClientRects().length || replaced && node === previous || route && location.pathname !== route) {
              await new Promise(resolve => setTimeout(resolve, 4)); continue
            }
            const scope = node.closest('[role="dialog"]') ?? node.closest('[data-page-content-root]') ?? node
            const images = [...scope.querySelectorAll<HTMLImageElement>('img')]
            if (images.some(image => image.complete && image.naturalWidth === 0)) throw new Error('必要图片加载失败，不能记作完整响应')
            if (images.some(image => !image.complete)) { await new Promise(resolve => setTimeout(resolve, 4)); continue }
            await document.fonts.ready
            await Promise.all(images.map(image => image.decode()))
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
            if (!node.isConnected || document.querySelector(readySelector) !== node) continue
            sample.elapsed = performance.now() - sample.start!
            return
          }
        } catch (error) { sample.error = error instanceof Error ? error.message : String(error) }
      }
      void finish()
    }
    document.addEventListener('click', onClick, true)
  }, { clickSelector, readySelector, replaced, route })
  await page.locator(clickSelector).first().click()
  await page.waitForFunction(() => {
    const value = (window as unknown as { __pmsP1Perf: PerfResult }).__pmsP1Perf
    return value.elapsed !== null || value.error !== null
  }, undefined, { timeout: 7000 })
  const result = await page.evaluate(() => (window as unknown as { __pmsP1Perf: PerfResult }).__pmsP1Perf)
  if (result.error || result.elapsed === null) throw new Error(result.error ?? '采集无效：完整结果未计时')
  return result.elapsed
}

async function measureRouteSwitch(page: Page, toHref: string, readySelector: string): Promise<number> {
  const selector = `[data-tab-href="${toHref}"]`
  if (await page.locator(selector).count() === 0) {
    const group = toHref === PPO ? '商品采购' : '采购建议'
    await page.locator('[data-action="toggle-menu-item"]').filter({ hasText: group }).click()
  }
  return measureAction(page, selector, readySelector, false, toHref)
}

async function measureFirstVisit(page: Page, route: string, rootSelector: string): Promise<number> {
  await page.addInitScript(({ route, rootSelector }) => {
    const perfWindow = window as unknown as { __pmsColdReady: number | null; __pmsColdError: string | null }
    perfWindow.__pmsColdReady = null; perfWindow.__pmsColdError = null
    const check = async () => {
      try {
        while (true) {
          if (performance.now() > 5000) throw new Error(`首次访问完整内容超时：${route}`)
          const root = document.querySelector<HTMLElement>(rootSelector)
          if (!root || location.pathname !== route || !root.querySelector('tbody tr')) { await new Promise(resolve => setTimeout(resolve, 4)); continue }
          const images = [...root.querySelectorAll<HTMLImageElement>('img')]
          if (images.some(image => image.complete && image.naturalWidth === 0)) throw new Error('首次访问必要图片加载失败')
          if (images.some(image => !image.complete)) { await new Promise(resolve => setTimeout(resolve, 4)); continue }
          await document.fonts.ready
          await Promise.all(images.map(image => image.decode()))
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
          if (!root.isConnected) continue
          perfWindow.__pmsColdReady = performance.now() // navigationStart/timeOrigin 为起点，含 Document 等待。
          return
        }
      } catch (error) { perfWindow.__pmsColdError = error instanceof Error ? error.message : String(error) }
    }
    void check()
  }, { route, rootSelector })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const value = window as unknown as { __pmsColdReady: number | null; __pmsColdError: string | null }
    return value.__pmsColdReady !== null || value.__pmsColdError !== null
  }, undefined, { timeout: 7000 })
  const result = await page.evaluate(() => {
    const value = window as unknown as { __pmsColdReady: number | null; __pmsColdError: string | null }
    return { elapsed: value.__pmsColdReady, error: value.__pmsColdError }
  })
  if (result.error || result.elapsed === null) throw new Error(result.error ?? '首次访问采集无效')
  return result.elapsed
}

test.describe('PMS 采购链路 P1 页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
  })

  test('三个 P1 路由可直接进入且不是占位页', async ({ page }) => {
    for (const [route, rootSelector, title] of [
      [SUGGESTIONS, '[data-pms-psk-root]', '商品采购建议'],
      [KOL, '[data-pms-kol-root]', 'KOL 采购需求'],
      [PPO, '[data-pms-ppo-root]', '商品采购单'],
    ] as const) {
      await page.goto(route)
      await expect(page.locator(rootSelector)).toBeVisible()
      await expect(page.locator(rootSelector)).toContainText(title)
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

    const checkbox = page.locator('input[data-pms-psk-field="select-row"]:not([disabled])').first()
    const suggestionNo = (await checkbox.getAttribute('data-suggestion-no'))!
    await checkbox.check()
    await page.locator('[data-pms-psk-action="open-generate-selected"]').click()
    await expect(page.locator('[data-pms-psk-generate]')).toBeVisible()
    const supplier = page.locator('[data-pms-psk-gen-field="supplierName"]')
    await supplier.selectOption((await supplier.locator('option').nth(1).getAttribute('value'))!)
    const expectedLines = await page.locator('[data-pms-psk-gen-qty]').evaluateAll(inputs => inputs.map(element => {
      const input = element as HTMLInputElement
      return { sku: input.getAttribute('data-pms-psk-gen-qty')!, qty: Number(input.value) }
    }))
    await page.locator('[data-pms-psk-action="submit-generate"]').click()
    await expect(page.locator('[data-pms-psk-root]')).toContainText(/已生成 1 张商品采购单：CG-2026-[A-Z0-9]+/)
    const savedSuggestion = (await readRecords<PmsPurchaseSuggestion>(page, 'pmsPurchaseSuggestions')).find(row => row.suggestionNo === suggestionNo)!
    expect(savedSuggestion).toBeDefined()
    expect(savedSuggestion.convertedOrderNos).toHaveLength(1)
    const order = await readOrder(page, savedSuggestion.convertedOrderNos[0])
    expect(order.sourceSuggestionNo).toBe(suggestionNo)
    expect(quantityMap(order)).toEqual(Object.fromEntries(expectedLines.map(line => [line.sku, line.qty])))
    await page.reload()
    expect((await readRecords<PmsPurchaseSuggestion>(page, 'pmsPurchaseSuggestions')).find(row => row.suggestionNo === suggestionNo)).toEqual(savedSuggestion)
    await page.goto(PPO)
    await expectFreshDetail(page, order)
  })

  test('KOL 需求可入库并记录操作事实', async ({ page }) => {
    await page.goto(KOL)
    const inboundButton = page.locator('[data-pms-kol-action="open-inbound"]:not([disabled])').first()
    const demandNo = (await inboundButton.getAttribute('data-demand-no'))!
    await inboundButton.click()
    await expect(page.locator('[data-pms-kol-inbound-root]')).toBeVisible()
    const expectedQty = await page.locator('[data-pms-kol-inbound-sku]').evaluateAll(inputs => inputs.reduce((sum, input) => sum + Number((input as HTMLInputElement).value), 0))
    const expectedSkus = await page.locator('[data-pms-kol-inbound-sku]').evaluateAll(inputs => inputs.map(input => input.getAttribute('data-pms-kol-inbound-sku')))
    const note = 'P1实际到货回读'
    await page.locator('[data-pms-kol-inbound-note]').fill(note)
    await page.locator('[data-pms-kol-action="submit-inbound"]').click()
    await expect(page.locator('[data-pms-kol-root]')).toContainText(/已完成 1 张 KOL 需求入库，合计 [\d,]+ 件/)
    const received = (await readRecords<PmsKolDemand>(page, 'pmsKolDemands')).find(row => row.demandNo === demandNo)!
    expect(received).toMatchObject({ status: '全部入库', inboundQty: received.applyQty })
    expect(received.inboundRecords[0]).toMatchObject({ qty: expectedQty, note })
    // 既有单 SKU 需求保留 aggregate 字段；多 SKU 需求使用 skuLines，二者均须数量一致。
    const receivedLines = received.skuLines ?? [{ sku: received.sku, applyQty: received.applyQty, inboundQty: received.inboundQty }]
    expect(receivedLines.map(line => line.sku)).toEqual(expectedSkus)
    expect(receivedLines.every(line => line.inboundQty === line.applyQty)).toBe(true)
    expect(receivedLines.reduce((sum, line) => sum + line.applyQty, 0)).toBe(received.applyQty)
    expect(receivedLines.reduce((sum, line) => sum + line.inboundQty, 0)).toBe(received.inboundQty)

    const rejectButton = page.locator('[data-pms-kol-action="open-reject"]:not([disabled])').first()
    const rejectNo = (await rejectButton.getAttribute('data-demand-no'))!
    await page.locator(`[data-pms-kol-field="select-row"][data-demand-no="${rejectNo}"]`).first().check()
    await page.locator('[data-pms-kol-action="open-batch-reject"]').click()
    await expect(page.locator('[data-pms-kol-reject-root]')).toBeVisible()
    const reason = '端到端批量驳回验证'
    await page.locator('[data-pms-kol-reject-reason]').fill(reason)
    await page.locator('[data-pms-kol-action="submit-reject"]').click()
    await expect(page.locator('[data-pms-kol-root]')).toContainText('已驳回1张需求')
    const rejected = (await readRecords<PmsKolDemand>(page, 'pmsKolDemands')).find(row => row.demandNo === rejectNo)!
    expect(rejected).toMatchObject({ status: '已驳回', rejectReason: reason })
    await page.reload()
    await expect(page.locator('[data-pms-kol-root]')).toBeVisible()
    const fresh = await readRecords<PmsKolDemand>(page, 'pmsKolDemands')
    expect(fresh.find(row => row.demandNo === demandNo)).toEqual(received)
    expect(fresh.find(row => row.demandNo === rejectNo)).toEqual(rejected)
    await page.locator(`[data-pms-kol-action="open-detail"][data-demand-no="${rejectNo}"]`).first().click()
    await expect(page.locator('[data-pms-kol-overlays] [role="dialog"]')).toContainText(reason)
  })

  test('商品采购单可生成面辅料需求并回写状态', async ({ page }) => {
    await page.goto(PPO)
    await openOrderAction(page, 'CG-2026-0016', 'generate')
    await expect(page.locator(PPO_DIALOG)).toHaveAttribute('aria-label', '生成面辅料需求')
    await page.locator('[data-pms-ppo-action="submit-action"]').click()
    await expect(page.locator('[data-pms-ppo-feedback]')).toContainText(/需求 .+ 已生成，共 \d+ 条物料/)
    const order = await readOrder(page, 'CG-2026-0016')
    expect(order.lines.filter(line => line.needBom).every(line => line.materialStatus === '已生成')).toBe(true)
    const requests = await readRecords<{ requirementNo: string; sourcePurchaseOrderNo: string; lines: unknown[] }>(page, 'pmsMaterialRequirements')
    const linked = requests.filter(row => row.sourcePurchaseOrderNo === order.purchaseOrderNo)
    expect(linked).toHaveLength(1)
    expect(linked[0].lines.length).toBeGreaterThan(0)
    await expectFreshDetail(page, order)
    await openOrderAction(page, order.purchaseOrderNo, 'view-material')
    await expect(page.locator(PPO_DIALOG)).toHaveAttribute('aria-label', '关联面辅料需求')
    await expect(page.locator(PPO_DIALOG).locator('tbody tr').first()).toBeVisible()
  })

  test('款式缩略图支持大图预览与 Esc 关闭', async ({ page }) => {
    await page.goto(PPO)
    const thumbnail = page.locator('[data-pms-common-action="open-image"]').first()
    const source = await thumbnail.getAttribute('data-image-src')
    await thumbnail.click()
    const dialog = page.locator('[role="dialog"]').last()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('img')).toHaveAttribute('src', source!)
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  })

  test('商品采购单详情展示采购员、金额、SKU与关联用料入口', async ({ page }) => {
    await page.goto(PPO)
    await openOrderAction(page, 'CG-2026-0016', 'view-detail')
    const dialog = page.locator(PPO_DIALOG)
    await expect(dialog).toContainText('采购员：')
    await expect(dialog).toContainText('采购金额：')
    await expect(dialog).toContainText('汇率')
    await expect(dialog).toContainText('SKU / 颜色 / 尺码')
    await expect(dialog).toContainText('物料状态')
    await expect(dialog.locator('[data-pms-ppo-action="view-material"]')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('正常拆分与合并保持SKU数量金额守恒并持久追溯原单', async ({ page }) => {
    await page.goto(PPO)
    const original = await createOrder(page, `P1拆合-${Date.now()}`)
    const previousNos = (await readRecords<PmsProductPurchaseOrder>(page, PPO_STORE)).map(row => row.purchaseOrderNo)
    await openOrderAction(page, original.purchaseOrderNo, '拆分采购单')
    for (const [index, line] of original.lines.entries()) await page.locator(`[data-pms-ppo-action-qty="${line.sku}"]`).fill(String(index === 0 ? 2 : 1))
    await submitOrderAction(page, '拆分采购单')
    const parent = await readOrder(page, original.purchaseOrderNo), child = await newOrderSince(page, previousNos)
    expect(quantityMap(parent)).toEqual({ [original.lines[0].sku]: 6, [original.lines[1].sku]: 2 })
    expect(quantityMap(child)).toEqual({ [original.lines[0].sku]: 2, [original.lines[1].sku]: 1 })
    expect(child.sourceOrderNos).toEqual([original.purchaseOrderNo])
    expect(amount(parent) + amount(child)).toBe(amount(original))
    expect(parent.operationHistory?.[0].action).toBe('拆分采购单')
    expect(child.operationHistory?.[0].actionId).toBe(parent.operationHistory?.[0].actionId)
    await expectFreshDetail(page, parent)
    await expectFreshDetail(page, child)

    const beforeMerge = (await readRecords<PmsProductPurchaseOrder>(page, PPO_STORE)).map(row => row.purchaseOrderNo)
    await openBulkAction(page, [parent.purchaseOrderNo, child.purchaseOrderNo], '合并采购单')
    await submitOrderAction(page, '合并采购单')
    const merged = await newOrderSince(page, beforeMerge)
    expect(quantityMap(merged)).toEqual(quantityMap(original))
    expect(amount(merged)).toBe(amount(original))
    expect(merged).toMatchObject({ status: '待采购', currency: 'CNY', exchangeRate: 1 })
    expect([...(merged.sourceOrderNos ?? [])].sort()).toEqual([parent.purchaseOrderNo, child.purchaseOrderNo].sort())
    expect(merged.lines.every(line => line.deliveredQty === 0)).toBe(true)
    for (const no of [parent.purchaseOrderNo, child.purchaseOrderNo]) {
      const closed = await readOrder(page, no)
      expect(closed).toMatchObject({ status: '已关闭', mergedInto: merged.purchaseOrderNo, closedReason: `已合并至 ${merged.purchaseOrderNo}` })
      expect(closed.operationHistory?.[0].action).toBe('合并采购单')
      await expectFreshDetail(page, closed)
    }
    await expectFreshDetail(page, merged)
  })

  test('两选批量字段、审核和驳回均直接回读；禁止状态保持原对象', async ({ page }) => {
    await page.goto(PPO)
    const first = await createOrder(page, `P1字段-A-${Date.now()}`)
    const second = await createOrder(page, `P1字段-B-${Date.now()}`, { draft: true, qty: [4, 2] })
    const nos = [first.purchaseOrderNo, second.purchaseOrderNo]
    await openBulkAction(page, nos, '设置采购员')
    await page.locator('[data-pms-ppo-input="purchaser"]').fill('P1批量采购员')
    await submitOrderAction(page, '设置采购员')
    const buyerRows = await Promise.all(nos.map(no => readOrder(page, no)))
    expect(buyerRows.every(row => row.purchaser === 'P1批量采购员')).toBe(true)
    expect(buyerRows[0].operationHistory?.[0].actionId).toBe(buyerRows[1].operationHistory?.[0].actionId)
    await openBulkAction(page, nos, '更改采购类型')
    await page.locator('[data-pms-ppo-input="purchaseType"]').selectOption('烫画')
    await submitOrderAction(page, '更改采购类型')
    for (const no of nos) {
      const changed = await readOrder(page, no)
      expect(changed.purchaseType).toBe('烫画')
      expect(changed.lines.every(line => line.needBom && line.materialStatus === '未生成')).toBe(true)
      await expectFreshDetail(page, changed)
    }
    await openOrderAction(page, first.purchaseOrderNo, '审核采购')
    await submitOrderAction(page, '审核采购')
    const approved = await readOrder(page, first.purchaseOrderNo)
    expect(approved).toMatchObject({ status: '已确认', reviewOutcome: '已通过' })
    expect(approved.auditedAt).toBeTruthy()
    await openOrderAction(page, first.purchaseOrderNo, '驳回采购')
    await page.locator('[data-pms-ppo-input="remark"]').fill('P1供应商无法按期交付')
    await submitOrderAction(page, '驳回采购')
    const rejected = await readOrder(page, first.purchaseOrderNo)
    expect(rejected).toMatchObject({ status: '已关闭', reviewOutcome: '采购驳回', closedReason: 'P1供应商无法按期交付' })
    await expectFreshDetail(page, rejected)
    const logsBefore = await readRecords(page, 'pmsOperationLogs')
    await openOrderAction(page, first.purchaseOrderNo, '审核采购')
    await page.locator('[data-pms-ppo-action="submit-action"]').click()
    await expect(page.locator(PPO_DIALOG)).toContainText('已关闭，不能审核采购')
    expect(await readOrder(page, first.purchaseOrderNo)).toEqual(rejected)
    expect(await readRecords(page, 'pmsOperationLogs')).toEqual(logsBefore)
    await page.keyboard.press('Escape')
    const batchLogs = (await readRecords<{ action: string; objectId: string; afterValue: string }>(page, 'pmsOperationLogs')).filter(log => nos.includes(log.objectId))
    expect(batchLogs.some(log => log.action === '设置采购员' && log.afterValue === '2张采购单')).toBe(true)
    expect(batchLogs.some(log => log.action === '更改采购类型' && log.afterValue === '2张采购单')).toBe(true)
  })

  test('样衣质检与重开保留实收，复制及两种转类清除旧执行事实', async ({ page }) => {
    await page.goto(PPO)
    const original = await createOrder(page, `P1样衣事实-${Date.now()}`, { qty: [3, 2] })
    await openOrderAction(page, original.purchaseOrderNo, '审核采购')
    await submitOrderAction(page, '审核采购')
    await openOrderAction(page, original.purchaseOrderNo, '样衣质检')
    for (const line of original.lines) await page.locator(`[data-pms-ppo-action-qty="${line.sku}"]`).fill(String(line.qty))
    await page.locator('[data-pms-ppo-input="weight"]').fill('0.45')
    await page.locator('[data-pms-ppo-input="remark"]').fill('P1样衣质检合格')
    await submitOrderAction(page, '样衣质检')
    const received = await readOrder(page, original.purchaseOrderNo)
    expect(received).toMatchObject({ status: '已入库', qualityResult: 'P1样衣质检合格' })
    expect(received.lines.map(line => line.deliveredQty)).toEqual([3, 2])
    expect(received.lines.every(line => line.weight === 0.45)).toBe(true)
    expect(received.receivedAt).toBeTruthy()
    expect(received.stockMovements?.reduce((sum, move) => sum + move.qty, 0)).toBe(5)
    await expectFreshDetail(page, received)
    const stockBefore = await readRecords(page, 'pmsProductStockBalances')
    await openOrderAction(page, original.purchaseOrderNo, '开启入库')
    await submitOrderAction(page, '开启入库')
    const reopened = await readOrder(page, original.purchaseOrderNo)
    expect(reopened).toMatchObject({ status: '已确认', inboundReopened: true })
    expect(reopened.lines.map(line => line.deliveredQty)).toEqual([3, 2])
    expect(await readRecords(page, 'pmsProductStockBalances')).toEqual(stockBefore)
    await expectFreshDetail(page, reopened)

    for (const [action, type] of [['复制采购单', '样衣'], ['现货采购', '成衣'], ['样衣转做货', '做货']] as const) {
      const beforeNos = (await readRecords<PmsProductPurchaseOrder>(page, PPO_STORE)).map(row => row.purchaseOrderNo)
      await openOrderAction(page, original.purchaseOrderNo, action)
      await submitOrderAction(page, action)
      const copy = await newOrderSince(page, beforeNos)
      expect(copy).toMatchObject({ status: '待采购', purchaseType: type, closedReason: '', reviewOutcome: '', receivedAt: '', inboundBy: '', qualityResult: '', auditedAt: '', inboundReopened: false })
      expect(copy.sourceOrderNos).toEqual([original.purchaseOrderNo])
      expect(quantityMap(copy)).toEqual(quantityMap(original))
      expect(amount(copy)).toBe(amount(original))
      expect(copy.lines.every(line => line.deliveredQty === 0 && line.needBom === (type === '做货') && line.materialStatus === (type === '做货' ? '未生成' : '不需要'))).toBe(true)
      for (const key of ['expressRecords', 'outboundRecords', 'stockMovements', 'aftersaleIds'] as const) expect(copy[key]).toEqual([])
      expect(copy.operationHistory).toHaveLength(1)
      expect(copy.operationHistory?.[0].action).toBe(action)
      expect(await readOrder(page, original.purchaseOrderNo)).toEqual(reopened)
      expect(await readRecords(page, 'pmsProductStockBalances')).toEqual(stockBefore)
      await expectFreshDetail(page, copy)
    }
  })

  test('P1 页面首次访问与关键交互完整响应不超过1000ms', async ({ page }) => {
    test.setTimeout(180000)
    const browser = page.context().browser()
    if (!browser) throw new Error('浏览器实例不可用')
    const coldSamples: Record<string, number[]> = {}, samples: Record<string, number[]> = {}
    // 每路由五个独立 context 的页面首次访问；不清用户 origin，不预热正式样本。
    // 这是自动化隔离 context 页面首次访问，不冒称新浏览器进程冷启动。
    for (const [route, rootSelector] of [[SUGGESTIONS, '[data-pms-psk-root]'], [KOL, '[data-pms-kol-root]'], [PPO, '[data-pms-ppo-root]']] as const) {
      coldSamples[route] = []
      for (let index = 0; index < 5; index += 1) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, baseURL: test.info().project.use.baseURL })
        try { coldSamples[route].push(await measureFirstVisit(await context.newPage(), route, rootSelector)) }
        finally { await context.close() }
      }
    }
    await page.goto(SUGGESTIONS)
    await expect(page.locator('[data-pms-psk-root]')).toBeVisible()
    const record = (family: string, value: number) => { (samples[family] ??= []).push(value) }
    for (let index = 0; index < 5; index += 1) {
      record('suggestions-to-kol', await measureRouteSwitch(page, KOL, '[data-pms-kol-root]'))
      record('kol-to-suggestions', await measureRouteSwitch(page, SUGGESTIONS, '[data-pms-psk-root]'))
    }
    for (let index = 0; index < 5; index += 1) {
      record('suggestions-query', await measureAction(page, '[data-pms-psk-action="query"]', '[data-pms-psk-table-surface] tbody tr', true))
      record('suggestions-columns', await measureAction(page, '[data-pms-psk-action="open-column-settings"]', '[data-pms-psk-column-overlays] .fixed'))
      await page.keyboard.press('Escape')
      record('suggestions-detail', await measureAction(page, '[data-pms-psk-action="open-detail"]', '[data-pms-psk-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    await measureRouteSwitch(page, KOL, '[data-pms-kol-root]')
    for (let index = 0; index < 5; index += 1) {
      record('kol-query', await measureAction(page, '[data-pms-kol-action="query"]', '[data-pms-kol-table-surface] tbody tr', true))
      record('kol-detail', await measureAction(page, '[data-pms-kol-action="open-detail"]', '[data-pms-kol-overlays] [role="dialog"]'))
      await page.keyboard.press('Escape')
    }
    await measureRouteSwitch(page, PPO, '[data-pms-ppo-root]')
    for (let index = 0; index < 5; index += 1) {
      record('ppo-detail', await measureAction(page, '[data-pms-ppo-action="view-detail"]', PPO_DIALOG))
      await page.keyboard.press('Escape')
      record('ppo-create', await measureAction(page, '[data-pms-ppo-action="open-create"]', PPO_DIALOG))
      await page.keyboard.press('Escape')
    }
    const environment = await page.evaluate(() => ({ origin: location.origin, userAgent: navigator.userAgent, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, viewport: { width: innerWidth, height: innerHeight }, navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()) }))
    const artifact = { thresholdMs: PERF_THRESHOLD, identity: '隔离context首次访问/真实SPA点击/查询和局部弹窗', completion: '完整目标DOM、必要图片decode、字体、2rAF；不覆盖业务保存性能或新浏览器进程冷启动', environment, coldSamples, samples, maxima: Object.fromEntries(Object.entries({ ...coldSamples, ...samples }).map(([family, values]) => [family, Math.max(...values)])) }
    await test.info().attach('pms-p1-complete-response-raw.json', { body: Buffer.from(JSON.stringify(artifact, null, 2)), contentType: 'application/json' })
    console.log(JSON.stringify({ pmsPerf: artifact }))
    for (const values of Object.values({ ...coldSamples, ...samples })) for (const sample of values) {
      expect(sample).toBeGreaterThan(0)
      expect(sample).toBeLessThanOrEqual(PERF_THRESHOLD)
    }
  })
})
