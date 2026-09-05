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
    const associationPageSize = page.locator(
      '[data-wool-machine-associations-field="pageSize"]',
    )
    await associationPageSize.selectOption('20')
    await expectText(page, '[data-wool-machine-associations-pagination-surface]', '1 / 1')
    await associationPageSize.selectOption('10')
    await expectText(page, '[data-wool-machine-associations-pagination-surface]', '1 / 2')
    assert(await rootIsStable(page), '每页条数变化不得替换横机生产关联页根节点')

    await page.getByRole('button', { name: '列设置' }).click()
    await expectText(page, '[data-wool-machine-associations-column-overlays]', '列设置')
    assert(await rootIsStable(page), '打开列设置不得替换横机生产关联页根节点')
    await page.locator(
      '[data-wool-machine-associations-action="toggle-column-visibility"]:not(:disabled)',
    ).first().uncheck()
    assert(await rootIsStable(page), '切换列显示不得替换横机生产关联页根节点')
    await page.locator(
      '[data-standard-list-column-key="status"]',
    ).dragTo(page.locator('[data-standard-list-column-key="specification"]'))
    assert(await rootIsStable(page), '拖拽列顺序不得替换横机生产关联页根节点')
    await page.getByRole('button', { name: '恢复默认', exact: true }).click()
    assert(await rootIsStable(page), '恢复列设置不得替换横机生产关联页根节点')
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
    const machinePageSize = page.locator('[data-wool-machines-field="pageSize"]')
    await machinePageSize.selectOption('20')
    await expectText(page, '[data-wool-machines-pagination-surface]', '1 / 1')
    await machinePageSize.selectOption('10')
    await expectText(page, '[data-wool-machines-pagination-surface]', '1 / 2')
    assert(await rootIsStable(page), '设备每页条数变化不得替换页面根节点')

    await page.getByRole('button', { name: '列设置' }).click()
    await expectText(page, '[data-wool-machines-column-overlays]', '横机设备列设置')
    await page.locator(
      '[data-wool-machines-action="toggle-column-freeze"]:not(:disabled)',
    ).first().check()
    assert(await rootIsStable(page), '设备列冻结不得替换页面根节点')
    await page.locator(
      '[data-standard-list-column-key="status"]',
    ).dragTo(page.locator('[data-standard-list-column-key="specification"]'))
    assert(await rootIsStable(page), '设备拖拽列顺序不得替换页面根节点')
    await page.getByRole('button', { name: '恢复默认', exact: true }).click()
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    assert(await rootIsStable(page), '设备列设置开关与恢复不得替换页面根节点')

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

async function assertPdaWoolStateCleanup(localUrl: string): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    await page.goto(new URL(
      '/scripts/fixtures/wool-pda-fact-execution.html?taskId=TASK-WOOL-MOCK-03',
      localUrl,
    ).toString())
    const openProcessReport = async (): Promise<void> => {
      const action = page.locator(
        '[data-pda-wool-action="open-fact"][data-wool-fact-action="REPORT_PROCESS"]',
      )
      if (!(await action.isVisible())) {
        await page.getByText('其他可操作', { exact: true }).click()
      }
      await action.click()
    }
    assert.equal(
      await page.locator('[data-pda-wool-action]:not([data-skip-page-rerender="true"])').count(),
      0,
      '所有由毛织处理器局部更新的按钮都必须显式跳过主入口整页重绘',
    )
    await openProcessReport()
    assert.equal(
      await page.locator('[data-pda-wool-draft]:not([data-skip-page-rerender="true"])').count(),
      0,
      '所有毛织弹窗字段都必须显式跳过主入口整页重绘',
    )
    const stateBeforeFailure = await page.evaluate(() => (
      window as typeof window & { getTask12UiState(): { commandId: string } }
    ).getTask12UiState())
    await page.locator('[data-pda-wool-action="save-fact"]').click()
    const stateAfterFailure = await page.evaluate(() => (
      window as typeof window & { getTask12UiState(): { commandId: string } }
    ).getTask12UiState())
    assert(stateBeforeFailure.commandId, '打开毛织事实弹窗必须生成命令号')
    assert.equal(
      stateAfterFailure.commandId,
      stateBeforeFailure.commandId,
      '同一已打开弹窗保存失败重试必须保留命令号',
    )

    const stateAfterReentry = await page.evaluate(() => (
      window as typeof window & {
        leaveAndReenterTask12(): { overlayAction: string | null; commandId: string; draftActions: string[] }
      }
    ).leaveAndReenterTask12())
    assert.equal(stateAfterReentry.overlayAction, null, '离开再进入同一详情必须清空弹窗')
    assert.equal(stateAfterReentry.commandId, '', '离开再进入同一详情必须清空命令号')
    assert.deepEqual(stateAfterReentry.draftActions, [], '离开再进入同一详情必须清空草稿')

    await openProcessReport()
    const stateAfterUserSwitch = await page.evaluate(() => (
      window as typeof window & {
        switchTask12User(): null | { overlayAction: string | null; commandId: string; draftActions: string[] }
      }
    ).switchTask12User())
    assert(stateAfterUserSwitch, '同工厂用户切换探针必须找到另一位有效用户')
    assert.equal(stateAfterUserSwitch?.overlayAction, null, '同工厂换用户必须清空弹窗')
    assert.equal(stateAfterUserSwitch?.commandId, '', '同工厂换用户必须清空命令号')
    assert.deepEqual(stateAfterUserSwitch?.draftActions, [], '同工厂换用户必须清空草稿')

    const factDetails = page.locator('[data-pda-wool-fact-list-root] details')
    await factDetails.evaluate((node: HTMLDetailsElement) => { node.open = true })
    const nextFactPage = page.locator('[data-pda-wool-action="fact-page"]').last()
    if (await nextFactPage.isEnabled()) {
      await nextFactPage.click()
      assert.equal(await factDetails.getAttribute('open'), '', '事实分页局部刷新后必须保持详情展开')
    }
    assert.deepEqual(pageErrors, [], `毛织 PDA 状态清理真实 DOM 不得抛错：${pageErrors.join('；')}`)
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
  await assertPdaWoolStateCleanup(localUrl)
} finally {
  await server.close()
}

console.log('PASS task 10/12 browser: real DOM handlers keep roots, retry command IDs, and clear PDA drafts by route/user')
