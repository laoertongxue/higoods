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
      __woolMachineFixture?: { root: Element | null }
    }).__woolMachineFixture
    return Boolean(fixture?.root && fixture.root.isConnected)
  })
}

async function assertAssociationPage(localUrl: string): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    await page.goto(new URL(
      '/scripts/fixtures/wool-machine-local-interactions.html?page=associations',
      localUrl,
    ).toString())
    await page.waitForFunction(() => Boolean(
      (window as typeof window & { __woolMachineFixture?: unknown }).__woolMachineFixture,
    ))
    const root = page.locator('[data-wool-machine-associations-root]')
    assert.equal(await root.count(), 1)

    const tableBeforeSort = await page.locator(
      '[data-wool-machine-associations-table-surface]',
    ).innerHTML()
    await page.locator(
      '[data-wool-machine-associations-action="sort-column"][data-column-key="machine"]',
    ).click()
    assert(await rootIsStable(page), '排序后不得替换横机生产关联页根节点')
    assert.notEqual(
      await page.locator('[data-wool-machine-associations-table-surface]').innerHTML(),
      tableBeforeSort,
      '排序必须局部刷新表格',
    )

    await page.locator('[data-wool-machine-associations-action="next-page"]').click()
    assert(await rootIsStable(page), '分页后不得替换横机生产关联页根节点')
    await expectText(page, '[data-wool-machine-associations-pagination-surface]', '2 / 2')
    await page.locator('[data-wool-machine-associations-action="prev-page"]').click()

    await page.getByRole('button', { name: '列设置' }).click()
    await expectText(page, '[data-wool-machine-associations-column-overlays]', '列设置')
    assert(await rootIsStable(page), '打开列设置不得替换横机生产关联页根节点')
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    assert.equal(
      await page.locator('[data-wool-machine-associations-column-overlays]').innerHTML(),
      '',
      '关闭列设置必须只清空覆盖层',
    )

    await page.locator(
      '[data-wool-machine-associations-action="open-association"]',
    ).first().click()
    await expectText(page, '[data-wool-machine-associations-business-overlay]', '选择横机设备')
    const productionSelect = page.locator(
      '[data-wool-machine-associations-dialog-field="productionOrderId"]',
    )
    await productionSelect.selectOption({ index: 1 })
    const orderSelect = page.locator(
      '[data-wool-machine-associations-dialog-field="woolOrderId"]',
    )
    if (await orderSelect.locator('option').count() > 1 && await orderSelect.isEnabled()) {
      await orderSelect.selectOption({ index: 1 })
    }
    assert(await rootIsStable(page), '加工单级联选择不得替换横机生产关联页根节点')
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(
      await page.locator('[data-wool-machine-associations-business-overlay]').innerHTML(),
      '',
      '关闭关联弹窗必须只清空业务覆盖层',
    )

    await page.locator(
      '[data-wool-machine-associations-action="open-association"][data-machine-id="WM-001"]',
    ).click()
    const transferredMachine = page.locator(
      '[data-wool-machine-associations-machine-id="WM-002"]',
    )
    await transferredMachine.check()
    await page.getByRole('button', { name: '保存整组关联', exact: true }).click()
    await expectText(
      page,
      '[data-wool-machine-associations-business-overlay]',
      '请再次点击“确认跨单转移并保存”',
    )
    await page.evaluate(() => {
      const fixture = (window as typeof window & {
        __woolMachineFixture?: { changeAssociation(machineId: string): void }
      }).__woolMachineFixture
      fixture?.changeAssociation('WM-002')
    })
    await page.getByRole('button', { name: '确认跨单转移并保存', exact: true }).click()
    await expectText(
      page,
      '[data-wool-machine-associations-business-overlay]',
      '关联已变化，请重新确认',
    )
    assert(await rootIsStable(page), '陈旧关联确认被拒绝时不得替换页面根节点')

    await page.getByRole('button', { name: '保存整组关联', exact: true }).click()
    await expectText(
      page,
      '[data-wool-machine-associations-business-overlay]',
      '请再次点击“确认跨单转移并保存”',
    )
    await transferredMachine.uncheck()
    assert.equal(
      await page.getByText('请再次点击“确认跨单转移并保存”。', { exact: true }).count(),
      0,
      '设备选择变化后必须使二次确认立即失效',
    )
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.deepEqual(pageErrors, [], `关联页真实 DOM 不得抛错：${pageErrors.join('；')}`)
  } finally {
    await browser.close()
  }
}

async function expectText(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).getByText(text, { exact: false }).first().waitFor()
}

async function assertMachinesPage(localUrl: string): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    await page.goto(new URL(
      '/scripts/fixtures/wool-machine-local-interactions.html?page=machines',
      localUrl,
    ).toString())
    await page.waitForFunction(() => Boolean(
      (window as typeof window & { __woolMachineFixture?: unknown }).__woolMachineFixture,
    ))
    const root = page.locator('[data-wool-machines-root]')
    assert.equal(await root.count(), 1)
    await page.locator(
      '[data-wool-machines-action="sort-column"][data-column-key="machine"]',
    ).click()
    await page.locator('[data-wool-machines-action="next-page"]').click()
    await expectText(page, '[data-wool-machines-pagination-surface]', '2 / 2')
    assert(await rootIsStable(page), '设备排序和分页不得替换页面根节点')
    await page.locator('[data-wool-machines-action="prev-page"]').click()

    await page.locator(
      '[data-wool-machines-action="open-status"][data-machine-id="WM-002"]',
    ).click()
    await expectText(page, '[data-wool-machines-business-overlay]', '修改横机状态')
    assert(await rootIsStable(page), '打开设备状态弹窗不得替换页面根节点')
    await page.locator('[data-wool-machines-dialog-field="reason"]').fill('机针故障')
    await page.getByRole('button', { name: '保存状态', exact: true }).click()
    await expectText(
      page,
      '[data-wool-machines-business-overlay]',
      '请再次点击“确认影响并修改状态”',
    )
    await page.evaluate(() => {
      const fixture = (window as typeof window & {
        __woolMachineFixture?: { changeAssociation(machineId: string): void }
      }).__woolMachineFixture
      fixture?.changeAssociation('WM-002')
    })
    await page.getByRole('button', { name: '确认影响并修改状态', exact: true }).click()
    await expectText(
      page,
      '[data-wool-machines-business-overlay]',
      '关联已变化，请重新确认',
    )
    assert(await rootIsStable(page), '陈旧设备影响确认被拒绝时不得替换页面根节点')

    await page.getByRole('button', { name: '保存状态', exact: true }).click()
    await expectText(
      page,
      '[data-wool-machines-business-overlay]',
      '请再次点击“确认影响并修改状态”',
    )
    await page.locator('[data-wool-machines-dialog-field="nextStatus"]').selectOption('DISABLED')
    assert.equal(
      await page.getByText('请再次点击“确认影响并修改状态”。', { exact: true }).count(),
      0,
      '目标状态变化后必须使二次确认立即失效',
    )
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    assert.equal(
      await page.locator('[data-wool-machines-business-overlay]').innerHTML(),
      '',
      '关闭状态弹窗必须只清空业务覆盖层',
    )
    assert.deepEqual(pageErrors, [], `设备页真实 DOM 不得抛错：${pageErrors.join('；')}`)
  } finally {
    await browser.close()
  }
}

const browserPort = await findFreeLoopbackPort()
const server = await createServer({
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { host: '127.0.0.1', port: browserPort, strictPort: true },
})
await server.listen()
const localUrl = server.resolvedUrls?.local[0]
if (!localUrl) throw new Error('Vite 未返回本地检查地址')
try {
  await assertAssociationPage(localUrl)
  await assertMachinesPage(localUrl)
} finally {
  await server.close()
}

console.log('PASS task 10 browser: real DOM handlers keep roots and refresh local surfaces')
