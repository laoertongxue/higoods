import { expect, test, type Page } from '@playwright/test'

const closePath = '/fcs/craft/cutting/cut-order-close?cutOrderNo=CUT14671-B'
const releasePath = '/fcs/craft/cutting/cut-piece-release'

async function navigateSpa(page: Page, path: string): Promise<void> {
  await page.evaluate(async (nextPath) => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate(nextPath)
  }, path)
  await page.waitForFunction((nextPath) => `${window.location.pathname}${window.location.search}` === nextPath, path)
  if (path.startsWith('/fcs/craft/cutting/cut-order-close')) {
    await page.waitForSelector('[data-testid="cut-order-close-page"]')
  } else if (path.startsWith('/fcs/craft/cutting/cut-piece-release')) {
    await page.waitForSelector('[data-cut-piece-release-page]')
  }
}

async function versionAndStatus(page: Page): Promise<{ version: number; status: string }> {
  return page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const record = repository.getCutPieceReleaseRecord('cpr-po-14671')!
    return {
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: record.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
}

async function waitForState(page: Page, version: number, status: string): Promise<void> {
  await expect.poll(() => versionAndStatus(page), { timeout: 15_000 }).toEqual({ version, status })
}

async function removeReleaseDemoProgressProjection(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    return progress.removeCuttingOrderProgressProjectionForTesting('cut-14671-b')
  })
}

async function restoreReleaseDemoProgressProjection(page: Page, snapshot: unknown): Promise<void> {
  await page.evaluate(async (value) => {
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    progress.restoreCuttingOrderProgressSnapshotForTesting(value)
  }, snapshot)
}

async function releaseDemoProgressStage(page: Page): Promise<{ stage: string; closedAt: string }> {
  return page.evaluate(async () => {
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    const record = progress.cuttingOrderProgressRecords.find((item) => item.materialLines.some((line) => line.cutOrderId === 'cut-14671-b'))!
    return { stage: record.cuttingStage, closedAt: record.closedAt || '' }
  })
}

async function assertVisibleMatrixState(page: Page, expectedSourceText: string, expectedReason = ''): Promise<void> {
  await navigateSpa(page, releasePath)
  if (!(await page.locator('[data-testid="cut-piece-release-color-matrix"]').isVisible())) {
    await page.getByRole('button', { name: '查看矩阵' }).click()
  }
  const materialBRow = page.locator('[data-testid="cell-Black-M-B"]').locator('xpath=ancestor::tr')
  await expect(materialBRow).toContainText(expectedSourceText)
  if (expectedReason) {
    await expect(materialBRow).toContainText(expectedReason)
    await expect(materialBRow).toContainText('CUT14671-B')
  }
  await expect(page.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await expect(page.locator('[data-testid="complete-kit-Black-L"]')).toContainText('350')
  await expect(page.locator('[data-testid="complete-kit-Black-XL"]')).toContainText('500')
}

async function reopenFromPage(page: Page, expectedVersion: number): Promise<void> {
  await page.getByRole('button', { name: '重新打开裁片单' }).click()
  await waitForState(page, expectedVersion, '持续更新')
}

async function closeFromPage(page: Page, expectedVersion: number, description: string): Promise<void> {
  await expect(page.getByRole('heading', { name: '放行矩阵影响' })).toBeVisible()
  await page.locator('[data-cutting-piece-close-field="closeDescription"]').fill(description)
  await page.getByRole('button', { name: '确认关闭裁片单' }).click()
  await waitForState(page, expectedVersion, '已冻结')
}

async function measureCloseLifecycleClick(page: Page, buttonName: string, feedbackText: string, stageText: string): Promise<{ elapsed: number; scrollBefore: number; scrollAfter: number; focusBefore: string; focusAfter: string }> {
  return page.evaluate(({ buttonName, feedbackText, stageText }) => new Promise((resolve) => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === buttonName)
    if (!button) throw new Error(`未找到按钮：${buttonName}`)
    const stableFocus = document.querySelector<HTMLElement>('[data-cut-order-close-stable-focus="true"]')
    stableFocus?.focus()
    const focusBefore = (document.activeElement as HTMLElement | null)?.dataset.cutOrderCloseStableFocus || ''
    const scrollBefore = window.scrollY
    const startedAt = performance.now()
    const finish = () => {
      const feedback = document.querySelector<HTMLElement>('[data-cut-order-close-region="feedback"]')?.textContent || ''
      const stage = document.querySelector<HTMLElement>('[data-cut-order-close-region="stage"]')?.textContent || ''
      if (!feedback.includes(feedbackText) || !stage.includes(stageText)) return false
      observer.disconnect()
      resolve({ elapsed: performance.now() - startedAt, scrollBefore, scrollAfter: window.scrollY, focusBefore, focusAfter: (document.activeElement as HTMLElement | null)?.dataset.cutOrderCloseStableFocus || '' })
      return true
    }
    const observer = new MutationObserver(finish)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    button.click()
    if (finish()) return
    window.setTimeout(() => {
      observer.disconnect()
      resolve({ elapsed: Number.POSITIVE_INFINITY, scrollBefore, scrollAfter: window.scrollY, focusBefore, focusAfter: (document.activeElement as HTMLElement | null)?.dataset.cutOrderCloseStableFocus || '' })
    }, 2_000)
  }), { buttonName, feedbackText, stageText })
}

test('真实 SPA 两轮关闭重开保留多周期账本、版本与迟到事实', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(closePath, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
  await navigateSpa(page, releasePath)
  await navigateSpa(page, closePath)
  await waitForState(page, 1, '已冻结')
  await expect.poll(() => releaseDemoProgressStage(page)).toEqual({ stage: '已关闭', closedAt: '2026-06-03 14:00:00' })

  await reopenFromPage(page, 2)
  await expect.poll(() => releaseDemoProgressStage(page)).toEqual({ stage: '已开工', closedAt: '' })
  await assertVisibleMatrixState(page, '持续更新')

  await navigateSpa(page, closePath)
  await closeFromPage(page, 3, '第一轮业务关闭')
  const firstClosedProgress = await releaseDemoProgressStage(page)
  expect(firstClosedProgress.stage).toBe('已关闭')
  expect(firstClosedProgress.closedAt).not.toBe('')
  await assertVisibleMatrixState(page, '已冻结，不再更新', '业务决定不再继续裁剪')
  await navigateSpa(page, closePath)
  const firstCycle = await page.evaluate(async () => {
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    return {
      closeIds: lifecycle.listStoredCutOrderCloseRecords().map((record) => record.closeRecordId),
      reopenIds: lifecycle.listStoredCutOrderReopenRecords().map((record) => record.reopenRecordId),
    }
  })
  expect(firstCycle.closeIds).toHaveLength(1)
  expect(firstCycle.reopenIds).toHaveLength(1)

  const beforeLate = await versionAndStatus(page)
  await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.recordLateCutPieceReleaseEvent({
      eventId: 'late-after-real-close-cycle-1', productionOrderId: 'po-14671', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B',
      spreadingOrderNo: 'PB-LATE-REAL-01', arrivedAt: '2026-06-07 10:00:00', reason: '裁片单关闭后收到，未批准计入',
      facts: [{ garmentColor: 'Black', size: 'M', materialId: 'B', actualPieceQty: 20 }],
    })
  })
  expect(await versionAndStatus(page)).toEqual(beforeLate)

  await reopenFromPage(page, 4)
  await expect.poll(() => releaseDemoProgressStage(page)).toEqual({ stage: '已开工', closedAt: '' })
  await assertVisibleMatrixState(page, '持续更新')
  await navigateSpa(page, closePath)
  await closeFromPage(page, 5, '第二轮业务关闭')
  const secondClosedProgress = await releaseDemoProgressStage(page)
  expect(secondClosedProgress.stage).toBe('已关闭')
  expect(secondClosedProgress.closedAt).not.toBe('')
  await assertVisibleMatrixState(page, '已冻结，不再更新', '业务决定不再继续裁剪')
  await navigateSpa(page, closePath)
  const finalAudit = await page.evaluate(async () => {
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const closes = lifecycle.listStoredCutOrderCloseRecords()
    const reopens = lifecycle.listStoredCutOrderReopenRecords()
    const versionBeforeReplay = repository.listCutPieceReleaseMatrixVersions('po-14671').length
    const latestClose = closes.at(-1)!
    repository.recordCutOrderReleaseStatusChange({
      eventId: latestClose.closeRecordId, cutOrderId: latestClose.cutOrderId, cutOrderNo: latestClose.cutOrderNo, status: '已冻结',
      occurredAt: latestClose.closedAt, operator: latestClose.closedBy, reason: `${latestClose.closeReasonText}，数据已冻结`,
    })
    return {
      closeIds: closes.map((record) => record.closeRecordId), reopenIds: reopens.map((record) => record.reopenRecordId),
      versionBeforeReplay, versionAfterReplay: repository.listCutPieceReleaseMatrixVersions('po-14671').length,
      lateCount: repository.listLateCutPieceReleaseEvents('po-14671').length,
      quantities: repository.getCutPieceReleaseMatrix('po-14671')!.colorGroups[0].completeKitBySize,
    }
  })
  expect(new Set(finalAudit.closeIds).size).toBe(2)
  expect(new Set(finalAudit.reopenIds).size).toBe(2)
  expect(finalAudit.versionAfterReplay).toBe(finalAudit.versionBeforeReplay)
  expect(finalAudit.lateCount).toBe(1)
  expect(finalAudit.quantities).toEqual({ M: 200, L: 350, XL: 500 })
})

test('重新打开时阶段投影不存在必须回滚账本且不改变放行矩阵', async ({ page }) => {
  await page.goto(closePath, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
  const progressSnapshot = await removeReleaseDemoProgressProjection(page)

  const reopenButton = page.getByRole('button', { name: '重新打开裁片单' })
  expect(await reopenButton.getAttribute('data-action-token')).toBeTruthy()
  await reopenButton.click()

  const audit = await page.evaluate(async () => {
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const record = repository.getCutPieceReleaseRecord('cpr-po-14671')!
    return {
      reopenCount: lifecycle.listStoredCutOrderReopenRecords().length,
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: record.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
  expect(audit).toEqual({ reopenCount: 0, version: 1, status: '已冻结' })
  await expect(page.getByText('阶段投影不存在，重新打开失败', { exact: true })).toBeVisible()
  await restoreReleaseDemoProgressProjection(page, progressSnapshot)
})

test('关闭时阶段投影不存在必须回滚账本且不改变放行矩阵', async ({ page }) => {
  await page.goto(closePath, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'prepare-missing-progress-close', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新',
      occurredAt: '2026-06-07 09:00:00', operator: '测试员', reason: '准备关闭失败测试',
    })
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    progress.updateCuttingOrderProgressWebStage('cut-14671-b', { cuttingStage: '已开工', operatedAt: '2026-06-07 09:00:00' })
  })
  await navigateSpa(page, releasePath)
  await navigateSpa(page, closePath)
  await expect(page.locator('[data-cutting-piece-close-field="closeDescription"]')).toBeVisible()
  const progressSnapshot = await removeReleaseDemoProgressProjection(page)
  await page.locator('[data-cutting-piece-close-field="closeDescription"]').fill('投影不存在时不得关闭')
  await page.getByRole('button', { name: '确认关闭裁片单' }).click()

  const audit = await page.evaluate(async () => {
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const record = repository.getCutPieceReleaseRecord('cpr-po-14671')!
    return {
      closeCount: lifecycle.listStoredCutOrderCloseRecords().length,
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: record.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
  expect(audit).toEqual({ closeCount: 0, version: 2, status: '持续更新' })
  await expect(page.getByText('阶段投影不存在，关闭失败', { exact: true })).toBeVisible()
  await restoreReleaseDemoProgressProjection(page, progressSnapshot)
})

test('关闭与重开在预热后局部刷新反馈和阶段均小于 200ms', async ({ page }) => {
  await page.goto(closePath, { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(() => document.readyState === 'complete' && Boolean(document.querySelector('[data-testid="cut-order-close-page"]')))
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
    await import('/src/pages/process-factory/cutting/cut-orders.ts')
    await import('/src/main-handlers/fcs-handlers.ts')
    window.scrollTo(0, 480)
  })

  const reopenPerformance = await measureCloseLifecycleClick(page, '重新打开裁片单', '已重新打开裁片单', '已开工')
  console.info(`cut-order reopen local refresh: ${reopenPerformance.elapsed.toFixed(2)}ms`)
  expect(reopenPerformance.elapsed).toBeLessThan(200)
  expect(Math.abs(reopenPerformance.scrollAfter - reopenPerformance.scrollBefore)).toBeLessThanOrEqual(1)
  expect(reopenPerformance.focusAfter).toBe(reopenPerformance.focusBefore)

  await page.locator('[data-cutting-piece-close-field="closeDescription"]').fill('性能测试关闭')
  const closePerformance = await measureCloseLifecycleClick(page, '确认关闭裁片单', '已关闭裁片单并保留历史记录', '已关闭')
  console.info(`cut-order close local refresh: ${closePerformance.elapsed.toFixed(2)}ms`)
  expect(closePerformance.elapsed).toBeLessThan(200)
  expect(Math.abs(closePerformance.scrollAfter - closePerformance.scrollBefore)).toBeLessThanOrEqual(1)
  expect(closePerformance.focusAfter).toBe(closePerformance.focusBefore)
})

test('关闭动作快速重复点击只写入一条关闭记录和一个矩阵版本', async ({ page }) => {
  await page.goto(closePath, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
  })
  await page.getByRole('button', { name: '重新打开裁片单' }).click()
  await waitForState(page, 2, '持续更新')
  await page.locator('[data-cutting-piece-close-field="closeDescription"]').fill('快速重复点击关闭')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === '确认关闭裁片单')!
    button.click()
    button.click()
  })
  const readAudit = () => page.evaluate(async () => {
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    return {
      closeCount: lifecycle.listStoredCutOrderCloseRecords().length,
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: repository.getCutPieceReleaseRecord('cpr-po-14671')!.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
  await expect.poll(async () => (await readAudit()).closeCount).toBe(1)
  const audit = await readAudit()
  console.info(`double-close audit: ${JSON.stringify(audit)}`)
  expect(audit.closeCount).toBe(1)
  expect(audit.status).toBe('已冻结')
  expect(audit.version).toBe(3)
})

test('阶段成功后放行写入拒绝或抛错必须完整回滚阶段、账本和矩阵', async ({ page }) => {
  await page.goto(closePath, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '关闭裁片单：CUT14671-B' })).toBeVisible({ timeout: 30_000 })
  const before = await page.evaluate(async () => {
    localStorage.removeItem('cuttingCutOrderCloseRecords')
    localStorage.removeItem('cuttingCutOrderReopenRecords')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    const pageModule = await import('/src/pages/process-factory/cutting/cut-orders.ts')
    repository.resetCutPieceReleasePrototypeStoreForTesting()
    repository.recordCutOrderReleaseStatusChange({
      eventId: 'prepare-release-writer-fault', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新',
      occurredAt: '2026-06-10 08:00:00', operator: '测试员', reason: '准备跨写回滚测试',
    })
    progress.updateCuttingOrderProgressWebStage('cut-14671-b', { cuttingStage: '已开工', operatedAt: '2026-06-10 08:00:00' })
    pageModule.setCutOrderReleaseStatusWriterForTesting(() => ({ status: 'rejected', reason: '故障注入：拒绝放行写入' }))
    return {
      progress: progress.createCuttingOrderProgressSnapshot('cut-14671-b'),
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: repository.getCutPieceReleaseRecord('cpr-po-14671')!.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
  await navigateSpa(page, releasePath)
  await navigateSpa(page, closePath)
  await page.locator('[data-cutting-piece-close-field="closeDescription"]').fill('放行拒绝回滚')
  await page.getByRole('button', { name: '确认关闭裁片单' }).click()

  const rejectedAudit = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    return {
      progress: progress.createCuttingOrderProgressSnapshot('cut-14671-b'),
      closeCount: lifecycle.listStoredCutOrderCloseRecords().length,
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: repository.getCutPieceReleaseRecord('cpr-po-14671')!.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
  expect(rejectedAudit).toEqual({ progress: before.progress, closeCount: 0, version: before.version, status: before.status })
  await expect(page.getByTestId('cut-order-close-feedback')).toContainText('故障注入：拒绝放行写入')

  await page.evaluate(async () => {
    const pageModule = await import('/src/pages/process-factory/cutting/cut-orders.ts')
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    pageModule.setCutOrderReleaseStatusWriterForTesting((input) => {
      repository.recordCutOrderReleaseStatusChange(input)
      throw new Error('故障注入：放行写入异常')
    })
  })
  await page.locator('[data-cutting-piece-close-field="closeDescription"]').fill('放行异常回滚')
  await page.getByRole('button', { name: '确认关闭裁片单' }).click()
  const thrownAudit = await page.evaluate(async () => {
    const repository = await import('/src/data/fcs/cut-piece-release.ts')
    const lifecycle = await import('/src/data/fcs/cutting/cut-order-close-records.ts')
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    const pageModule = await import('/src/pages/process-factory/cutting/cut-orders.ts')
    pageModule.setCutOrderReleaseStatusWriterForTesting(null)
    return {
      progress: progress.createCuttingOrderProgressSnapshot('cut-14671-b'), closeCount: lifecycle.listStoredCutOrderCloseRecords().length,
      version: repository.listCutPieceReleaseMatrixVersions('po-14671').at(-1)!.version,
      status: repository.getCutPieceReleaseRecord('cpr-po-14671')!.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')!.status,
    }
  })
  expect(thrownAudit).toEqual({ progress: before.progress, closeCount: 0, version: before.version, status: before.status })
  await expect(page.getByTestId('cut-order-close-feedback')).toContainText('故障注入：放行写入异常')
})
