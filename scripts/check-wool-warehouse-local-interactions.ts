import assert from 'node:assert/strict'
import { createServer as createNetServer } from 'node:net'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'

async function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function rootIsStable(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const fixture = (window as typeof window & {
      __woolWarehouseFixture?: { root: Element | null }
    }).__woolWarehouseFixture
    return Boolean(fixture?.root && fixture.root.isConnected)
  })
}

async function fixtureSnapshot(page: Page, storage = false): Promise<string | null> {
  return page.evaluate((useStorage) => {
    const fixture = (window as typeof window & {
      __woolWarehouseFixture?: {
        snapshot(): string
        storageSnapshot(): string | null
      }
    }).__woolWarehouseFixture
    return useStorage ? fixture?.storageSnapshot() ?? null : fixture?.snapshot() ?? null
  }, storage)
}

async function clickWithinBudget(
  page: Page,
  selector: string,
  label: string,
  index = 0,
): Promise<void> {
  const elapsed = await page.evaluate(({ targetSelector, targetIndex }) => {
    const target = document.querySelectorAll<HTMLElement>(targetSelector)[targetIndex]
    if (!target) throw new Error(`缺少交互节点：${targetSelector}#${targetIndex}`)
    const startedAt = performance.now()
    target.click()
    return performance.now() - startedAt
  }, { targetSelector: selector, targetIndex: index })
  assert(elapsed < 200, `${label}必须低于 200ms，实际 ${elapsed.toFixed(1)}ms`)
}

async function clickRowActionWithinBudget(
  page: Page,
  rowText: string,
  action: string,
  label: string,
): Promise<void> {
  const target = page
    .locator('tr', { hasText: rowText })
    .locator(`[data-wool-warehouse-action="${action}"]`)
  assert.equal(await target.count(), 1, `${label}必须唯一定位业务记录`)
  const elapsed = await target.evaluate((node) => {
    const startedAt = performance.now()
    ;(node as HTMLElement).click()
    return performance.now() - startedAt
  })
  assert(elapsed < 200, `${label}必须低于 200ms，实际 ${elapsed.toFixed(1)}ms`)
}

async function changeSelectWithinBudget(
  page: Page,
  selector: string,
  value: string,
  label: string,
): Promise<void> {
  const elapsed = await page.evaluate(({ targetSelector, nextValue }) => {
    const target = document.querySelector<HTMLSelectElement>(targetSelector)
    if (!target) throw new Error(`缺少选择节点：${targetSelector}`)
    const startedAt = performance.now()
    target.value = nextValue
    target.dispatchEvent(new Event('change', { bubbles: true }))
    return performance.now() - startedAt
  }, { targetSelector: selector, nextValue: value })
  assert(elapsed < 200, `${label}必须低于 200ms，实际 ${elapsed.toFixed(1)}ms`)
}

async function assertRootStable(page: Page, label: string): Promise<void> {
  assert(await rootIsStable(page), `${label}不得替换毛织仓库页根节点`)
}

async function assertMode(localUrl: string, mode: 'process' | 'handover'): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    await page.goto(new URL(
      `/scripts/fixtures/wool-warehouse-local-interactions.html?mode=${mode}`,
      localUrl,
    ).toString())
    await page.waitForFunction(() => Boolean(
      (window as typeof window & { __woolWarehouseFixture?: unknown }).__woolWarehouseFixture,
    ))
    const root = page.locator('[data-wool-warehouse-root]')
    assert.equal(await root.count(), 1)
    await clickWithinBudget(
      page,
      '[data-wool-warehouse-action="sort-column"][data-column-key="object"]',
      '仓库排序交互',
    )
    await assertRootStable(page, '排序')

    const tabAction = mode === 'process' ? 'tab:issues' : 'tab:inbounds'
    await clickWithinBudget(page, `[data-wool-warehouse-action="${tabAction}"]`, 'Tab 切换')
    await assertRootStable(page, 'Tab 切换')
    await clickWithinBudget(page, '[data-wool-warehouse-action="tab:inventory"]', '返回库存 Tab')

    const objectFilter = page.locator('[data-wool-warehouse-filter="objectSkuCode"]')
    let selectedTransferTarget = ''
    if (mode === 'process') {
      await page.locator('[data-wool-warehouse-filter="woolOrderNo"]').fill('WMO-024')
      await objectFilter.fill('YARN-A')
      await page.waitForTimeout(220)
      assert.equal(
        await page.locator('[data-wool-warehouse-filter="woolOrderNo"]').inputValue(),
        'WMO-024',
      )
      assert.equal(await objectFilter.inputValue(), 'YARN-A')
      const combinedFilterTableText = await page.locator('[data-wool-warehouse-table-surface]').innerText()
      assert(combinedFilterTableText.includes('WMO-024'), '快速跨字段输入必须同时保留加工单条件')
      assert(!combinedFilterTableText.includes('WMO-023'), '快速跨字段输入不得丢失先输入的加工单条件')
      await clickWithinBudget(page, '[data-wool-warehouse-action="reset-filters"]', '重置跨字段筛选')
    }
    const filterStartedAt = await page.evaluate(() => performance.now())
    await objectFilter.fill(mode === 'process' ? 'YARN-A' : 'HG-WOOL')
    const filterDispatchElapsed = await page.evaluate((startedAt) => performance.now() - startedAt, filterStartedAt)
    assert(filterDispatchElapsed < 200, `筛选输入派发必须低于 200ms，实际 ${filterDispatchElapsed.toFixed(1)}ms`)
    await page.waitForTimeout(220)
    await assertRootStable(page, '筛选输入')
    if (mode === 'process') {
      await page.locator('[data-wool-warehouse-filter="woolOrderNo"]').fill('WMO-024')
      await page.waitForTimeout(220)
      const batchCases = [
        {
          rowSelector: '[data-wool-warehouse-action="open-detail"][data-row-id*="|YARN-A||WOOL-WP-YARN-DEFAULT"]',
          expectedReceipt: 'BROWSER-DELIVERY-NO-BATCH',
          expectedChange: '浏览器无批次修改历史',
          expectedFlow: 'TRACE-NO-BATCH',
          excluded: ['BROWSER-DELIVERY-BATCH-X', 'BROWSER-DELIVERY-01', 'DN-AB', 'TRACE-BATCH-X'],
        },
        {
          rowSelector: '[data-wool-warehouse-action="open-detail"][data-row-id*="|YARN-A|BATCH-AB|WOOL-WP-YARN-DEFAULT"]',
          expectedReceipt: 'DN-AB',
          expectedChange: '',
          expectedFlow: 'WOOL-MOCK-24-AB',
          excluded: ['BROWSER-DELIVERY-NO-BATCH', 'BROWSER-DELIVERY-BATCH-X', 'BROWSER-DELIVERY-01'],
        },
        {
          rowSelector: '[data-wool-warehouse-action="open-detail"][data-row-id*="|YARN-A|BATCH-X|WOOL-WP-YARN-DEFAULT"]',
          expectedReceipt: 'BROWSER-DELIVERY-BATCH-X',
          expectedChange: '浏览器 BATCH-X 修改历史',
          expectedFlow: 'TRACE-BATCH-X',
          excluded: ['BROWSER-DELIVERY-NO-BATCH', 'BROWSER-DELIVERY-01', 'DN-AB', 'TRACE-NO-BATCH'],
        },
      ]
      for (const batchCase of batchCases) {
        await clickWithinBudget(page, batchCase.rowSelector, '打开批次隔离详情')
        const dialogText = await page.locator('[data-wool-warehouse-dialog]').innerText()
        const flowText = await page.locator('[data-wool-warehouse-detail-kind="flows"]').locator('xpath=..').innerText()
        assert.equal(
          await page.locator('[data-wool-warehouse-detail-kind="receipts"]').getAttribute('data-current-page'),
          '1',
          '切换批次详情后接收页码必须从第一页开始',
        )
        assert.equal(
          await page.locator('[data-wool-warehouse-detail-kind="flows"]').getAttribute('data-current-page'),
          '1',
          '切换批次详情后流水页码必须从第一页开始',
        )
        assert(dialogText.includes(batchCase.expectedReceipt))
        if (batchCase.expectedChange) assert(dialogText.includes(batchCase.expectedChange))
        assert(flowText.includes(batchCase.expectedFlow))
        for (const excluded of batchCase.excluded) {
          assert(!dialogText.includes(excluded), `批次详情不得串入 ${excluded}`)
          assert(!flowText.includes(excluded), `批次流水不得串入 ${excluded}`)
        }
        assert.equal(await page.locator('[data-wool-warehouse-dialog] b').count(), 0, '批次动态内容必须转义')
        await clickWithinBudget(page, '[data-wool-warehouse-action="close-overlay"]', '关闭批次隔离详情')
      }
      await page.locator('[data-wool-warehouse-filter="batchNo"]').fill('BATCH-TRACE')
      await page.waitForTimeout(220)
    }

    await changeSelectWithinBudget(
      page,
      '[data-wool-warehouse-field="pageSize"]',
      '20',
      '每页条数切换',
    )
    await assertRootStable(page, '每页条数切换')
    await changeSelectWithinBudget(
      page,
      '[data-wool-warehouse-field="pageSize"]',
      '10',
      '每页条数恢复',
    )

    await clickWithinBudget(page, '[data-wool-warehouse-action="open-column-settings"]', '打开列设置')
    await page.getByText('毛织仓库列设置', { exact: true }).waitFor()
    const columnVisibilityElapsed = await page.evaluate(() => {
      const checkbox = document.querySelector<HTMLInputElement>(
        '[data-wool-warehouse-action="toggle-column-visibility"]:not(:disabled)',
      )
      if (!checkbox) throw new Error('缺少可隐藏的毛织仓库列')
      const startedAt = performance.now()
      checkbox.click()
      return performance.now() - startedAt
    })
    assert(columnVisibilityElapsed < 200, `列显示切换必须低于 200ms，实际 ${columnVisibilityElapsed.toFixed(1)}ms`)
    await assertRootStable(page, '列显示切换')
    const columnDragElapsed = await page.evaluate(() => {
      const source = document.querySelector<HTMLElement>('[data-standard-list-column-key="reason"]')
      const target = document.querySelector<HTMLElement>('[data-standard-list-column-key="operator"]')
      if (!source || !target) throw new Error('缺少列顺序拖拽节点')
      const transfer = new DataTransfer()
      const startedAt = performance.now()
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }))
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      return performance.now() - startedAt
    })
    assert(columnDragElapsed < 200, `列顺序拖拽必须低于 200ms，实际 ${columnDragElapsed.toFixed(1)}ms`)
    await assertRootStable(page, '列顺序拖拽')
    await clickWithinBudget(page, '[data-wool-warehouse-action="restore-column-settings"]', '恢复列设置')
    await clickWithinBudget(page, '[data-wool-warehouse-action="close-column-settings"]', '关闭列设置')

    const detailSelector = mode === 'process'
      ? '[data-wool-warehouse-action="open-detail"][data-row-id*="BATCH-TRACE"]'
      : '[data-wool-warehouse-action="open-detail"]'
    await clickWithinBudget(page, detailSelector, '打开库存详情')
    await page.getByText('库存与流水明细', { exact: true }).waitFor()
    await assertRootStable(page, '库存详情')
    assert.equal(await page.locator('[data-wool-warehouse-dialog] script').count(), 0)
    assert.equal(await page.locator('[data-wool-warehouse-dialog] img').count(), 0)
    assert.equal(await page.locator('[data-wool-warehouse-dialog] svg').count(), 0)
    if (mode === 'process') {
      const receiptPager = page.locator('[data-wool-warehouse-detail-kind="receipts"]')
      const flowPager = page.locator('[data-wool-warehouse-detail-kind="flows"]')
      const changePager = page.locator('[data-wool-warehouse-detail-kind="changes"]').first()
      assert.equal(await receiptPager.getAttribute('data-current-page'), '1')
      assert.equal(await flowPager.getAttribute('data-current-page'), '1')
      assert.equal(await changePager.getAttribute('data-current-page'), '1')
      await clickWithinBudget(
        page,
        '[data-wool-warehouse-detail-kind="changes"] [data-wool-warehouse-detail-action="next-page"]',
        '接收修改历史分页',
      )
      assert.equal(await page.locator('[data-wool-warehouse-detail-kind="changes"]').first().getAttribute('data-current-page'), '2')
      assert.equal(await receiptPager.getAttribute('data-current-page'), '1')
      assert.equal(await flowPager.getAttribute('data-current-page'), '1')
      await clickWithinBudget(
        page,
        '[data-wool-warehouse-detail-kind="receipts"] [data-wool-warehouse-detail-action="next-page"]',
        '确认接收明细分页',
      )
      assert.equal(await page.locator('[data-wool-warehouse-detail-kind="receipts"]').getAttribute('data-current-page'), '2')
      assert.equal(await page.locator('[data-wool-warehouse-detail-kind="flows"]').getAttribute('data-current-page'), '1')
      await clickWithinBudget(
        page,
        '[data-wool-warehouse-detail-kind="flows"] [data-wool-warehouse-detail-action="next-page"]',
        '仓库流水分页',
      )
      assert.equal(await page.locator('[data-wool-warehouse-detail-kind="flows"]').getAttribute('data-current-page'), '2')
      assert.equal(await page.locator('[data-wool-warehouse-detail-kind="receipts"]').getAttribute('data-current-page'), '2')
    }
    await clickWithinBudget(page, '[data-wool-warehouse-action="close-overlay"]', '关闭库存详情')

    if (mode === 'process') {
      const traceRowAction = (action: string) =>
        `[data-wool-warehouse-action="${action}"][data-row-id*="BATCH-TRACE"]`
      await clickWithinBudget(page, traceRowAction('open-issue'), '打开纱线领用')
      const beforeEmptyIssue = await fixtureSnapshot(page)
      await page.locator('[data-wool-warehouse-dialog-field="operator"]').fill('领用人草稿')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-issue"]', '空数量领用校验')
      await page.locator('[data-wool-warehouse-field-error]').getByText('纱线领用数量不能为空', { exact: true }).waitFor()
      assert.equal(await page.locator('[data-wool-warehouse-dialog-field="operator"]').inputValue(), '领用人草稿')
      assert.equal(await fixtureSnapshot(page), beforeEmptyIssue, '空数量领用不得写 store')
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('0.001')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-issue"]', '保存纱线领用')
      await page.waitForTimeout(100)
      const issueError = await page.locator('[data-wool-warehouse-overlay-error]').textContent().catch(() => '')
      assert(!issueError, `保存纱线领用失败：${issueError}`)
      await page.getByText('已为', { exact: false }).first().waitFor({ timeout: 5_000 })
      await assertRootStable(page, '纱线领用成功')

      await clickWithinBudget(page, traceRowAction('open-return'), '打开纱线退回')
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('0.001')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-return"]', '保存纱线退回')

      await clickWithinBudget(page, traceRowAction('open-adjust'), '打开库存调整')
      const beforeEmptyAdjust = await fixtureSnapshot(page)
      const storageBeforeEmptyAdjust = await fixtureSnapshot(page, true)
      await page.locator('[data-wool-warehouse-dialog-field="afterQty"]').fill('')
      await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('盘点原因草稿不得清零')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-adjust"]', '空调整数量校验')
      await page.locator('[data-wool-warehouse-field-error]').getByText('调整后数量不能为空', { exact: true }).waitFor()
      assert.equal(await page.locator('[data-wool-warehouse-dialog-field="afterQty"]').inputValue(), '')
      assert.equal(
        await page.locator('[data-wool-warehouse-dialog-field="reason"]').inputValue(),
        '盘点原因草稿不得清零',
      )
      assert.equal(await fixtureSnapshot(page), beforeEmptyAdjust, '空调整数量不得写 store')
      assert.equal(await fixtureSnapshot(page, true), storageBeforeEmptyAdjust, '空调整数量不得写 storage')
      await page.locator('[data-wool-warehouse-dialog-field="afterQty"]').fill('1')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-adjust"]', '保存库存调整')

      await clickWithinBudget(page, traceRowAction('open-transfer-out'), '打开库存转出')
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('0.001')
      await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('浏览器转出')
      selectedTransferTarget = await page.locator('[data-wool-warehouse-dialog-field="target"]').inputValue()
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-transfer-out"]', '保存库存转出')
      await clickWithinBudget(page, '[data-wool-warehouse-action="tab:transfers"]', '打开转移 Tab')
      await clickRowActionWithinBudget(page, '浏览器转出', 'open-transfer-back', '打开本次库存转回')
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('0.001')
      await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('浏览器转回')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-transfer-back"]', '保存库存转回')
    } else {
      await clickWithinBudget(page, '[data-wool-warehouse-action="open-adjust"]', '打开待交出仓调整')
      await page.locator('[data-wool-warehouse-dialog-field="afterQty"]').fill('1')
      await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('待交出仓盘点')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-adjust"]', '保存待交出仓调整')
      await clickWithinBudget(page, '[data-wool-warehouse-action="open-transfer-out"]', '打开待交出仓转出')
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('1')
      await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('待交出仓转出')
      selectedTransferTarget = await page.locator('[data-wool-warehouse-dialog-field="target"]').inputValue()
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-transfer-out"]', '保存待交出仓转出')
      await clickWithinBudget(page, '[data-wool-warehouse-action="tab:transfers"]', '打开待交出仓转移 Tab')
      await clickRowActionWithinBudget(page, '待交出仓转出', 'open-transfer-back', '打开本次待交出仓转回')
      await page.locator('[data-wool-warehouse-dialog-field="qty"]').fill('1')
      await page.locator('[data-wool-warehouse-dialog-field="reason"]').fill('待交出仓转回')
      await clickWithinBudget(page, '[data-wool-warehouse-action="save-transfer-back"]', '保存待交出仓转回')
    }
    const transferTableText = await page.locator('[data-wool-warehouse-table-surface]').innerText()
    const [selectedTransferWarehouseId = '', selectedTransferLocationId = ''] = selectedTransferTarget.split('|')
    assert(selectedTransferWarehouseId && selectedTransferLocationId, '库存转移必须选择完整的公共仓库与库位')
    assert(
      transferTableText.includes(mode === 'process' ? 'WOOL-WAIT-PROCESS' : 'WOOL-WAIT-HANDOVER'),
      '转移列表必须展示固定默认仓库 ID',
    )
    assert(transferTableText.includes(selectedTransferWarehouseId), '转移列表必须展示实际选择的目标仓库 ID')
    assert(transferTableText.includes(selectedTransferLocationId), '转移列表必须展示实际选择的目标库位 ID')
    const transferBackReason = mode === 'process' ? '浏览器转回' : '待交出仓转回'
    await clickRowActionWithinBudget(page, transferBackReason, 'open-detail', '打开本次转回详情')
    let transferDetailText = await page.locator('[data-wool-warehouse-dialog]').innerText()
    assert(
      transferDetailText.includes(mode === 'process' ? 'WOOL-WAIT-PROCESS' : 'WOOL-WAIT-HANDOVER'),
      '转移详情必须展示固定默认仓库 ID',
    )
    const transferDetailHasSelectedTarget = () =>
      transferDetailText.includes(selectedTransferWarehouseId)
      && transferDetailText.includes(selectedTransferLocationId)
    const nextFlowPageSelector = '[data-wool-warehouse-detail-kind="flows"] [data-wool-warehouse-detail-action="next-page"]'
    while (!transferDetailHasSelectedTarget() && await page.locator(nextFlowPageSelector).isEnabled()) {
      await clickWithinBudget(
        page,
        nextFlowPageSelector,
        '转移详情流水分页',
      )
      transferDetailText = await page.locator('[data-wool-warehouse-dialog]').innerText()
    }
    assert(transferDetailText.includes(selectedTransferWarehouseId), '转移详情必须展示实际选择的目标仓库 ID')
    assert(transferDetailText.includes(selectedTransferLocationId), '转移详情必须展示实际选择的目标库位 ID')
    await clickWithinBudget(page, '[data-wool-warehouse-action="close-overlay"]', '关闭转移详情')
    await assertRootStable(page, '全部仓库关键交互')
    await page.locator('[data-wool-warehouse-filter="productionOrderNo"]').fill('LEAVE-PAGE-DEBOUNCE')
    await root.evaluate((node) => node.remove())
    await page.waitForTimeout(220)
    assert.equal(await page.locator('[data-wool-warehouse-root]').count(), 0, '离页后筛选防抖不得重新插入页面')
    assert.deepEqual(pageErrors, [], `毛织仓库真实 DOM 不得抛错：${pageErrors.join('；')}`)
  } finally {
    await browser.close()
  }
}

const browserPort = await findFreeLoopbackPort()
process.stdout.write('RUN task 11 browser: wool warehouse local interactions\n')
const server = await createServer({
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: browserPort, strictPort: true },
})
await server.listen()
const localUrl = server.resolvedUrls?.local[0]
if (!localUrl) throw new Error('Vite 未返回毛织仓库检查地址')
try {
  await assertMode(localUrl, 'process')
  process.stdout.write('PASS task 11 browser process mode\n')
  await assertMode(localUrl, 'handover')
  process.stdout.write('PASS task 11 browser: wool warehouse interactions keep roots and refresh local surfaces\n')
} finally {
  await server.close()
}
