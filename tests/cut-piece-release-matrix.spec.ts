import { expect, test, type Page } from '@playwright/test'

const listRoute = '/fcs/craft/cutting/cut-piece-release'
const detailRoute = `${listRoute}?productionOrderId=po-14671&productionOrderNo=PO14671`
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  if (testInfo.title.includes('1366×768')) await page.setViewportSize({ width: 1366, height: 768 })
  if (testInfo.title.includes('1280×720')) await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(detailRoute, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
  await page.goto(detailRoute, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  await expect(page.locator('[data-testid="cut-piece-release-color-matrix"]')).toHaveCount(4)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function rememberPageRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const acceptanceWindow = window as typeof window & { __cutPieceReleaseMatrixRoot?: Element }
    acceptanceWindow.__cutPieceReleaseMatrixRoot = document.querySelector('[data-cut-piece-release-detail-page]') ?? undefined
  })
}

async function expectPageRootStable(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const acceptanceWindow = window as typeof window & { __cutPieceReleaseMatrixRoot?: Element }
    return document.querySelector('[data-cut-piece-release-detail-page]') === acceptanceWindow.__cutPieceReleaseMatrixRoot
  })).toBe(true)
}

async function selectBlackTarget(page: Page): Promise<void> {
  await page.getByRole('button', { name: '重新选择目标' }).click()
  await page.locator('[data-testid="candidate-Black-M-C"]').click()
  await page.locator('[data-testid="candidate-Black-L-B"]').click()
  await page.locator('[data-testid="candidate-Black-XL-C"]').click()
}

async function getCurrentMatrixVersion(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)?.version ?? 0
  })
}

async function rerenderDetailPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const detail = document.querySelector<HTMLElement>('[data-cut-piece-release-detail-page]')
    const host = detail?.parentElement
    if (!host) throw new Error('未找到裁片矩阵详情容器')
    const pageModule = await import('/src/pages/process-factory/cutting/cut-piece-release.ts')
    host.innerHTML = pageModule.renderCraftCuttingCutPieceReleasePage()
  })
  await expect(page.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
}

test('按颜色展示物料尺码矩阵、当前齐套与受限目标候选', async ({ page }) => {
  const matrices = page.locator('[data-testid="cut-piece-release-color-matrix"]')
  await expect(matrices).toHaveCount(4)
  for (const color of ['Black', 'White', 'Navy', 'Red']) {
    await expect(page.getByRole('heading', { name: color, exact: true })).toBeVisible()
  }
  const blackMatrix = matrices.filter({ has: page.getByRole('heading', { name: 'Black', exact: true }) })
  await expect(blackMatrix).toHaveCount(1)
  await expect(blackMatrix).toContainText('面料 A · 净色')
  await expect(blackMatrix).toContainText('面料 B · 白色条')
  await expect(blackMatrix).toContainText('面料 C · 兰色条')
  await expect(blackMatrix).toContainText('面料 D · 灰色条')
  await expect(blackMatrix).toContainText('当前齐套数量')
  await expect(page.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await expect(page.locator('[data-testid="complete-kit-Black-L"]')).toContainText('350')
  await expect(page.locator('[data-testid="complete-kit-Black-XL"]')).toContainText('500')
  await selectBlackTarget(page)

  await expect(page.locator('[data-testid="cell-Black-M-B"]')).toContainText('需补 8 件')
  await expect(page.locator('[data-testid="cell-Black-L-D"]')).toContainText('刚好')
  await expect(page.locator('[data-testid="cell-Black-L-B"]')).toContainText('刚好')
  await expect(page.locator('[data-testid="cell-Black-XL-A"]')).toContainText('多 12 件')
  await expect(page.locator('[data-testid="cell-Black-M-B"]')).toHaveClass(/text-rose-600/)
  await expect(page.locator('[data-testid="cell-Black-L-D"]')).toHaveClass(/border-yellow-400/)
  await expect(page.locator('[data-testid="cell-Black-XL-A"]')).toHaveClass(/text-emerald-600/)
  await expect(page.locator('[data-cut-piece-release-region="matrix"] input[type="number"]')).toHaveCount(0)

  const lCandidates = page.locator('[data-target-candidate-color="Black"][data-target-candidate-size="L"]')
  await expect(lCandidates).toHaveCount(3)
})

test('确认摘要保存目标并保持同版本幂等、冲突和版本历史', async ({ page }) => {
  await rememberPageRoot(page)
  const basisVersion = await getCurrentMatrixVersion(page)
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  const summary = page.locator('[data-testid="cut-piece-release-target-summary"]')
  await expect(summary).toContainText('Black / M：208 件')
  await expect(summary).toContainText('Black / L：350 件')
  await expect(summary).toContainText('Black / XL：520 件')
  await expect(summary).toContainText('需补')
  await expect(summary).toContainText('刚好')
  await expect(summary).toContainText('多余')
  await expect(summary).toContainText(`目标依据版本 V${basisVersion}`)

  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('目标已按当前矩阵版本保存')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()
  await expect(page.getByText(`当前版本 V${basisVersion + 1}`)).toBeVisible()
  await expect(summary).toContainText(`目标依据版本 V${basisVersion}`)
  await expect(summary).toContainText('目标已保存')
  await page.getByRole('button', { name: '查看更新历史' }).click()
  await expect(page.locator('[data-testid="cut-piece-release-history-drawer"]')).toContainText(`V${basisVersion + 1} · 目标确认`)
  await page.getByRole('button', { name: '关闭更新历史' }).click()

  const retryResults = await page.evaluate(async (matrixVersion) => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const snapshot = repository.listCutPieceReleaseTargetSnapshots('po-14671').find((item) => item.matrixVersion === matrixVersion)
    if (!snapshot) throw new Error(`未找到 V${matrixVersion} 的目标快照`)
    const same = repository.confirmCutPieceReleaseTarget({
      productionOrderId: 'po-14671',
      matrixVersion,
      colorSizeTargets: { ...snapshot.targetPreview.colorSizeTargets },
      confirmedBy: snapshot.confirmedBy,
    })
    const conflict = repository.confirmCutPieceReleaseTarget({
      productionOrderId: 'po-14671',
      matrixVersion,
      colorSizeTargets: { ...snapshot.targetPreview.colorSizeTargets, 'Black::M': snapshot.targetPreview.colorSizeTargets['Black::M'] + 1 },
      confirmedBy: snapshot.confirmedBy,
    })
    return {
      same: { ok: same.ok, message: same.message, snapshotId: same.snapshot?.snapshotId },
      conflict: { ok: conflict.ok, message: conflict.message, snapshot: conflict.snapshot },
    }
  }, basisVersion)
  expect(retryResults.same).toEqual({
    ok: true,
    message: '裁片目标已确认，返回原目标快照。',
    snapshotId: `cpr-target-po-14671-v${basisVersion}`,
  })
  expect(retryResults.conflict).toEqual({
    ok: false,
    message: '该裁片矩阵版本的目标确认内容冲突。',
    snapshot: null,
  })
  await expectPageRootStable(page)
})

test('保存存在缺口的目标后可携带不可变快照进入补料管理', async ({ page }) => {
  const basisVersion = await getCurrentMatrixVersion(page)
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()

  const supplementButton = page.getByRole('button', { name: '去补料管理' })
  await expect(supplementButton).toBeVisible()
  await supplementButton.click()
  await expect(page).toHaveURL(new RegExp(`/fcs/craft/cutting/supplement-management\\?mode=create&releaseSnapshotId=cpr-target-po-14671-v${basisVersion}$`))
})

test('已保存快照只匹配当前未修改目标，重新选择后生成替代快照', async ({ page }) => {
  const firstBasisVersion = await getCurrentMatrixVersion(page)
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toBeVisible()

  await page.getByRole('button', { name: '重新选择目标' }).click()
  await page.locator('[data-testid="candidate-Black-M-A"]').click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
  await page.getByRole('button', { name: '确认目标' }).click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
  const replacementBasisVersion = await getCurrentMatrixVersion(page)
  expect(replacementBasisVersion).toBe(firstBasisVersion + 1)
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('目标已按当前矩阵版本保存')).toBeVisible()
  await expect(page.getByText(`当前版本 V${replacementBasisVersion + 1}`)).toBeVisible()
  await expect(page.getByRole('button', { name: '去补料管理' })).toBeVisible()
  await page.getByRole('button', { name: '去补料管理' }).click()
  await expect(page).toHaveURL(new RegExp(`releaseSnapshotId=cpr-target-po-14671-v${replacementBasisVersion}$`))
})

test('保存无缺口目标时不显示去补料管理主操作', async ({ page }) => {
  await page.getByRole('button', { name: '重新选择目标' }).click()
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()

  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
})

test('目标保存后铺布冲销形成新业务版本会阻断旧依据重试', async ({ page }) => {
  const firstBasisVersion = await getCurrentMatrixVersion(page)
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText(`当前版本 V${firstBasisVersion + 1}`)).toBeVisible()

  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await expect(page.locator('[data-testid="cut-piece-release-target-summary"]')).toContainText(`目标依据版本 V${firstBasisVersion + 1}`)
  const adjustment = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return repository.recordSpreadingReleaseAdjustment({
      adjustmentEventId: 'e2e-reverse-red-spreading',
      spreadingOrderNo: 'PB-14671-RED-02',
      productionOrderId: 'po-14671',
      direction: -1,
      occurredAt: '2026-06-03 16:30:00',
      operator: '裁床主管 Dewi',
      reason: '测试目标确认后冲销错误铺布事实',
      sourceCutOrderIds: ['cut-14671-red-02'],
      sourceCutOrderNos: ['CUT14671-RED-02'],
    })
  })
  expect(adjustment.status).toBe('applied')
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('当前裁片矩阵版本已变化，请刷新后重新确认目标。')).toBeVisible()
  await expect(page.getByText(`当前版本 V${firstBasisVersion + 2}`)).toBeVisible()
  await page.getByRole('button', { name: '查看更新历史' }).click()
  await expect(page.locator('[data-testid="cut-piece-release-history-drawer"]')).toContainText(`V${firstBasisVersion + 2} · 铺布冲销`)
  await expect(page.locator('[data-testid="cut-piece-release-history-drawer"]')).toContainText('PB-14671-RED-02')
})

test('部位与历史抽屉具备键盘焦点、ESC恢复和分页追溯', async ({ page }) => {
  await rememberPageRoot(page)
  const matrixScroll = page.locator('[data-cut-piece-release-matrix-scroll]').first()
  await matrixScroll.evaluate((element) => { element.scrollLeft = 80 })
  const before = await matrixScroll.evaluate((element) => element.scrollLeft)

  const cell = page.locator('[data-testid="cell-Black-M-B"]')
  await cell.focus()
  await cell.press('Enter')
  const drawer = page.locator('[data-testid="cut-piece-release-cell-drawer"]')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('aside')).toHaveAttribute('role', 'dialog')
  await expect(drawer.locator('aside')).toHaveAttribute('aria-modal', 'true')
  await expect(page.getByRole('button', { name: '关闭部位详情' })).toBeFocused()
  await expect(drawer).toContainText('400 片 ÷ 2 片/件 = 200 件')
  await expect(drawer).toContainText('CUT14671-B')
  await expect(page.locator('[data-cut-piece-release-part-row]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(cell).toBeFocused()
  expect(await matrixScroll.evaluate((element) => element.scrollLeft)).toBe(before)
  await expectPageRootStable(page)
  const historyTrigger = page.getByRole('button', { name: '查看更新历史' })
  await historyTrigger.click()
  const history = page.locator('[data-testid="cut-piece-release-history-drawer"]')
  await expect(history).toBeVisible()
  await expect(history.locator('aside')).toHaveAttribute('role', 'dialog')
  await expect(history.locator('aside')).toHaveAttribute('aria-modal', 'true')
  await expect(page.getByRole('button', { name: '关闭更新历史' })).toBeFocused()
  await expect(history).toContainText('V10 · 目标确认')
  await expect(history).toContainText('V9 · 铺布完成')
  await expect(history).toContainText('铺布操作员 Lestari')
  await expect(history).toContainText('2026')
  await expect(history).toContainText('第 1 / 2 页')
  await expect(history).toContainText('每页 5 条')
  await expect(history).toContainText('共 10 条')
  await history.getByRole('button', { name: '下一页' }).click()
  await expect(history).toContainText('第 2 / 2 页')
  await expect(history.locator('[data-cut-piece-release-history-version="1"]')).toContainText('CUT14671-A、CUT14671-B')
  await page.keyboard.press('Escape')
  await expect(history).toHaveCount(0)
  await expect(historyTrigger).toBeFocused()
})

test('关闭详情新窗口后列表保持默认态，重开详情会清空未保存瞬态', async ({ page }) => {
  await selectBlackTarget(page)
  await page.locator('[data-testid="cell-Black-M-B"]').click()
  await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toBeVisible()
  await page.goto(listRoute, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(listRoute)
  await expect(page.locator('[data-cut-piece-release-page]')).toBeVisible()
  await expect(page.locator('[data-cut-piece-release-detail-page]')).toHaveCount(0)
  await expect(page.locator('[data-cut-piece-release-matrix-panel]')).toHaveCount(0)
  await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="cut-piece-release-history-drawer"]')).toHaveCount(0)
  await expect(page.getByText('已选中生产单 PO14671 的裁片矩阵。')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: '生产单 / SPU / 颜色尺码 / 裁片单' })).toHaveValue('')

  await page.goto(detailRoute, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-cut-piece-release-detail-page]')).toBeVisible()
  await expect(page.locator('[data-testid="cut-piece-release-color-matrix"]')).toHaveCount(4)
  await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '重新选择目标' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认目标' })).toHaveCount(0)
})

test('重开裁片单在同一浏览器仓储实例恢复放行来源', async ({ page }) => {
  const frozenStatus = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return repository.getCutPieceReleaseRecord('cpr-po-14671')?.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')?.status
  })
  expect(frozenStatus).toBe('已冻结')
  await page.goto('/fcs/craft/cutting/cut-order-close?cutOrderNo=CUT14671-B')
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '重新打开裁片单' }).click()
  await expect.poll(() => page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return repository.getCutPieceReleaseRecord('cpr-po-14671')?.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')?.status
  }), { timeout: 20_000 }).toBe('持续更新')
})

test('有进行中铺布时关闭被阻断并列出铺布单号', async ({ page }) => {
  const precondition = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return repository.getCutOrderReleaseImpactSummary('cut-14671-a')
  })
  expect(precondition?.activeSpreadingOrderNos).toEqual(['PB-14671-A-进行中'])
  await page.goto('/fcs/craft/cutting/cut-order-close?cutOrderNo=CUT14671-A')
  await expect(page.getByText(/请先处理进行中的铺布单：PB-14671-A-进行中/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: '确认关闭裁片单' })).toBeDisabled()
})

test('关闭后迟到铺布仅进入待处理异常且不改变矩阵数量', async ({ page }) => {
  const recorded = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const sourceStatus = repository.getCutPieceReleaseRecord('cpr-po-14671')?.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')?.status
    repository.recordLateCutPieceReleaseEvent({
      eventId: 'e2e-late-spreading-1',
      productionOrderId: 'po-14671',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      spreadingOrderNo: 'PB-LATE-14671-01',
      arrivedAt: '2026-06-06 10:00:00',
      reason: '裁片单已关闭，铺布完成数据未计入当前矩阵',
      facts: [{ garmentColor: 'Black', size: 'M', materialId: 'B', actualPieceQty: 20 }],
    })
    return {
      sourceStatus,
      eventCount: repository.listLateCutPieceReleaseEvents('po-14671').length,
    }
  })
  expect(recorded).toEqual({ sourceStatus: '已冻结', eventCount: 1 })
  await rerenderDetailPage(page)
  await expect(page.locator('[data-testid="cut-piece-release-late-events-alert"]')).toContainText('关闭后收到 1 条待处理铺布数据')
  await expect(page.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await page.locator('[data-testid="cut-piece-release-late-events-alert"]').click()
  const lateList = page.locator('[data-testid="cut-piece-release-late-events-list"]')
  await expect(lateList).toContainText('PB-LATE-14671-01')
  await expect(lateList).toContainText('CUT14671-B')
  await expect(lateList).toContainText('未计入原因')
})

test('裁片交接显示最低应回与多余裁片，车缝摘要只显示当前齐套', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/handover-orders/HO-CUT-SEW-260324-001')
  await expect(page.getByRole('heading', { name: /交出单详情 JCD-260324-001/ })).toBeVisible({ timeout: 30_000 })
  const snapshot = page.locator('[data-testid="cut-piece-release-handover-snapshot"]')
  await expect(snapshot).toContainText('裁片放行依据')
  await expect(snapshot).toContainText('最低应回数量')
  await expect(snapshot).toContainText('Black / M')
  await expect(snapshot).toContainText('200 件')
  await expect(snapshot).toContainText('多余裁片')
  await expect(snapshot).toContainText('多 24 片')
  await page.reload()
  await expect(page.locator('[data-testid="cut-piece-release-handover-snapshot"]')).toContainText('最低应回数量')
  await page.goto('/fcs/dispatch/sewing')
  await expect(page.getByText('车缝任务齐套列表')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('当前齐套').first()).toBeVisible()
  await expect(page.getByText('可以做', { exact: true })).toHaveCount(0)
  await expect(page.getByText('部分可以做', { exact: true })).toHaveCount(0)
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`矩阵在 ${viewport.width}×${viewport.height} 内部横向滚动且局部交互稳定`, async ({ page }) => {
    await expect(page.getByRole('button', { name: '重新选择目标' })).toBeVisible()
    const overflow = await page.evaluate(() => ({
      body: [document.body.scrollWidth, document.body.clientWidth],
      document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    }))
    expect(overflow.body[0]).toBe(overflow.body[1])
    expect(overflow.document[0]).toBe(overflow.document[1])
    const matrixScrolls = page.locator('[data-cut-piece-release-matrix-scroll]')
    await expect(matrixScrolls).toHaveCount(4)
    for (let index = 0; index < 4; index += 1) {
      const matrixOverflow = await matrixScrolls.nth(index).evaluate((element) => [element.scrollWidth, element.clientWidth])
      expect(matrixOverflow[0]).toBeGreaterThan(matrixOverflow[1])
    }
    await selectBlackTarget(page)
    await page.locator('[data-testid="cell-Black-M-B"]').click()
    await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toBeVisible()
  })
}
