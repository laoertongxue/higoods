import { expect, test, type Page } from '@playwright/test'

const route = '/fcs/craft/cutting/cut-piece-release'
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
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-cut-piece-release-page]')).toBeVisible()
  const search = page.getByRole('searchbox', { name: '生产单 / SPU / 颜色尺码 / 裁片单' })
  await search.fill('__矩阵交互就绪检查__')
  await search.press('Enter')
  await expect(page.getByText('当前筛选范围暂无裁片放行生产单。')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '重置' }).click()
  await page.getByRole('button', { name: '查看矩阵' }).click()
  await expect(page.locator('[data-testid="cut-piece-release-color-matrix"]')).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function rememberPageRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const acceptanceWindow = window as typeof window & { __cutPieceReleaseMatrixRoot?: Element }
    acceptanceWindow.__cutPieceReleaseMatrixRoot = document.querySelector('[data-cut-piece-release-page]') ?? undefined
  })
}

async function expectPageRootStable(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const acceptanceWindow = window as typeof window & { __cutPieceReleaseMatrixRoot?: Element }
    return document.querySelector('[data-cut-piece-release-page]') === acceptanceWindow.__cutPieceReleaseMatrixRoot
  })).toBe(true)
}

async function selectBlackTarget(page: Page): Promise<void> {
  await page.getByRole('button', { name: '选择目标' }).click()
  await page.locator('[data-testid="candidate-Black-M-C"]').click()
  await page.locator('[data-testid="candidate-Black-L-B"]').click()
  await page.locator('[data-testid="candidate-Black-XL-C"]').click()
}

test('按颜色展示物料尺码矩阵、当前齐套与受限目标候选', async ({ page }) => {
  const matrix = page.locator('[data-testid="cut-piece-release-color-matrix"]')
  await expect(matrix).toBeVisible()
  await expect(matrix).toContainText('Black')
  await expect(matrix).toContainText('面料 A · 净色')
  await expect(matrix).toContainText('面料 B · 白色条')
  await expect(matrix).toContainText('面料 C · 兰色条')
  await expect(matrix).toContainText('面料 D · 灰色条')
  await expect(matrix).toContainText('当前齐套数量')
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

test('确认摘要保存目标并呈现幂等、冲突和版本变化反馈', async ({ page }) => {
  await rememberPageRoot(page)
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  const summary = page.locator('[data-testid="cut-piece-release-target-summary"]')
  await expect(summary).toContainText('Black / M：208 件')
  await expect(summary).toContainText('Black / L：350 件')
  await expect(summary).toContainText('Black / XL：520 件')
  await expect(summary).toContainText('需补')
  await expect(summary).toContainText('刚好')
  await expect(summary).toContainText('多余')
  await expect(summary).toContainText('目标依据版本 V1')

  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('目标已按当前矩阵版本保存')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PO14671 裁片放行矩阵' })).toBeVisible()
  await expect(page.getByText('当前版本 V2')).toBeVisible()
  await expect(summary).toContainText('目标依据版本 V1')
  const row = page.locator('tbody tr').filter({ hasText: 'PO14671' }).first()
  await expect(row).toContainText('已确认')
  await expect(row).toContainText('2026-06-03 16:00')
  await page.getByRole('button', { name: '查看更新历史' }).click()
  await expect(page.locator('[data-testid="cut-piece-release-history-drawer"]')).toContainText('V2 · 目标确认')
  await page.getByRole('button', { name: '关闭更新历史' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('目标已按当前矩阵版本保存，可安全重复提交')).toBeVisible()

  await page.getByRole('button', { name: '返回修改' }).click()
  await page.locator('[data-testid="candidate-Black-M-A"]').click()
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('该裁片矩阵版本的目标确认内容冲突。')).toBeVisible()
  await expectPageRootStable(page)
})

test('保存存在缺口的目标后可携带不可变快照进入补料管理', async ({ page }) => {
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()

  const supplementButton = page.getByRole('button', { name: '去补料管理' })
  await expect(supplementButton).toBeVisible()
  await supplementButton.click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/supplement-management\?mode=create&releaseSnapshotId=cpr-target-po-14671-v1$/)
})

test('已保存快照只匹配当前未修改目标，返回修改后旧补料入口立即失效', async ({ page }) => {
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toBeVisible()

  await page.getByRole('button', { name: '返回修改' }).click()
  await page.locator('[data-testid="candidate-Black-M-A"]').click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
  await page.getByRole('button', { name: '确认目标' }).click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('该裁片矩阵版本的目标确认内容冲突。')).toBeVisible()
  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)

  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'e2e-new-target-version',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      status: '持续更新',
      occurredAt: '2026-06-03 17:10:00',
      operator: '裁床主管 Dewi',
      reason: '形成新矩阵版本后保存新目标',
    })
  })
  await page.getByRole('button', { name: '查看矩阵' }).click()
  await page.getByRole('button', { name: '选择目标' }).click()
  await page.locator('[data-testid="candidate-Black-M-A"]').click()
  await page.locator('[data-testid="candidate-Black-L-B"]').click()
  await page.locator('[data-testid="candidate-Black-XL-A"]').click()
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByRole('button', { name: '去补料管理' })).toBeVisible()
  await page.getByRole('button', { name: '去补料管理' }).click()
  await expect(page).toHaveURL(/releaseSnapshotId=cpr-target-po-14671-v3$/)
})

test('保存无缺口目标时不显示去补料管理主操作', async ({ page }) => {
  await page.getByRole('button', { name: '选择目标' }).click()
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()

  await expect(page.getByRole('button', { name: '去补料管理' })).toHaveCount(0)
})

test('目标保存为V2后上游形成V3会阻断旧依据重试', async ({ page }) => {
  await selectBlackTarget(page)
  await page.getByRole('button', { name: '确认目标' }).click()
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('当前版本 V2')).toBeVisible()
  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'e2e-restore-cut-14671-b',
      cutOrderId: 'cut-14671-b',
      cutOrderNo: 'CUT14671-B',
      status: '持续更新',
      occurredAt: '2026-06-03 16:30:00',
      operator: '裁床主管 Dewi',
      reason: '测试上游恢复后版本变化',
    })
  })
  await expect(page.locator('[data-testid="cut-piece-release-target-summary"]')).toContainText('目标依据版本 V1')
  await page.getByRole('button', { name: '保存目标' }).click()
  await expect(page.getByText('当前裁片矩阵版本已变化，请刷新后重新确认目标。')).toBeVisible()
  await expect(page.getByText('当前版本 V3')).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: 'PO14671' }).first()).toContainText('2026-06-03 16:30')
})

test('部位与历史抽屉具备键盘焦点、ESC恢复和分页追溯', async ({ page }) => {
  await rememberPageRoot(page)
  const matrixScroll = page.locator('[data-cut-piece-release-matrix-scroll]')
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
  await expect(history).toContainText('铺布完成')
  await expect(history).toContainText('铺布操作员 阿迪')
  await expect(history).toContainText('2026')
  await expect(history).toContainText('第 1 / 1 页')
  await expect(history).toContainText('每页 5 条')
  await expect(history).toContainText('共 1 条')
  await page.keyboard.press('Escape')
  await expect(history).toHaveCount(0)
  await expect(historyTrigger).toBeFocused()
})

test('离开裁片放行页面再返回会恢复列表默认态并清空瞬态矩阵', async ({ page }) => {
  await selectBlackTarget(page)
  await page.locator('[data-testid="cell-Black-M-B"]').click()
  await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toBeVisible()
  await page.getByRole('button', { name: '点击空白处返回' }).click()
  await page.getByRole('button', { name: '补料管理', exact: true }).click()
  await expect(page).toHaveURL(/supplement-management/)
  await page.getByRole('complementary').getByRole('button', { name: '裁片放行管理', exact: true }).click()
  await expect(page).toHaveURL(/cut-piece-release/)
  await expect(page.locator('[data-cut-piece-release-page]')).toBeVisible()
  await expect(page.locator('[data-cut-piece-release-matrix-panel]')).toHaveCount(0)
  await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="cut-piece-release-history-drawer"]')).toHaveCount(0)
  await expect(page.getByText('已选中生产单 PO14671 的裁片矩阵。')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: '生产单 / SPU / 颜色尺码 / 裁片单' })).toHaveValue('')
})

test('重开裁片单在同一浏览器仓储实例恢复放行来源', async ({ page }) => {
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
  await page.goto('/fcs/craft/cutting/cut-order-close?cutOrderNo=CUT14671-B')
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '重新打开裁片单' }).click()
  await expect.poll(() => page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return repository.getCutPieceReleaseRecord('cpr-po-14671')?.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')?.status
  }), { timeout: 20_000 }).toBe('持续更新')
})

test('有进行中铺布时关闭被阻断并列出铺布单号', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/cut-order-close?cutOrderNo=CUT14671-A')
  await expect(page.getByText(/请先处理进行中的铺布单：PB-14671-A-进行中/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: '确认关闭裁片单' })).toBeDisabled()
})

test('关闭后迟到铺布仅进入待处理异常且不改变矩阵数量', async ({ page }) => {
  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
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
  })
  await page.getByRole('button', { name: '查看矩阵' }).click()
  await expect(page.locator('[data-testid="cut-piece-release-late-events-alert"]')).toContainText('关闭后收到 1 条待处理铺布数据')
  await expect(page.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await page.locator('[data-testid="cut-piece-release-late-events-alert"]').click()
  const lateList = page.locator('[data-testid="cut-piece-release-late-events-list"]')
  await expect(lateList).toContainText('PB-LATE-14671-01')
  await expect(lateList).toContainText('CUT14671-B')
  await expect(lateList).toContainText('未计入原因')
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`矩阵在 ${viewport.width}×${viewport.height} 内部横向滚动且局部交互稳定`, async ({ page }) => {
    await expect(page.getByRole('button', { name: '选择目标' })).toBeVisible()
    const overflow = await page.evaluate(() => ({
      body: [document.body.scrollWidth, document.body.clientWidth],
      document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    }))
    expect(overflow.body[0]).toBe(overflow.body[1])
    expect(overflow.document[0]).toBe(overflow.document[1])
    const matrixScroll = page.locator('[data-cut-piece-release-matrix-scroll]')
    const matrixOverflow = await matrixScroll.evaluate((element) => [element.scrollWidth, element.clientWidth])
    expect(matrixOverflow[0]).toBeGreaterThan(matrixOverflow[1])
    await selectBlackTarget(page)
    await page.locator('[data-testid="cell-Black-M-B"]').click()
    await expect(page.locator('[data-testid="cut-piece-release-cell-drawer"]')).toBeVisible()
  })
}
