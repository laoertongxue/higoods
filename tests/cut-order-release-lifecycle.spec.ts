import { expect, test, type Page } from '@playwright/test'

const closePath = '/fcs/craft/cutting/cut-order-close?cutOrderNo=CUT14671-B'
const releasePath = '/fcs/craft/cutting/cut-piece-release'

async function navigateSpa(page: Page, path: string): Promise<void> {
  await page.evaluate(async (nextPath) => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate(nextPath)
  }, path)
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

async function removeReleaseDemoProgressProjection(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const progress = await import('/src/data/fcs/cutting/order-progress.ts')
    const index = progress.cuttingOrderProgressRecords.findIndex((record) => record.materialLines.some((line) => line.cutOrderId === 'cut-14671-b'))
    if (index >= 0) progress.cuttingOrderProgressRecords.splice(index, 1)
  })
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
  await removeReleaseDemoProgressProjection(page)

  await page.getByRole('button', { name: '重新打开裁片单' }).click()

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
  await expect(page.getByTestId('cut-order-close-feedback')).toContainText('阶段投影不存在，重新打开失败', { timeout: 20_000 })
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
  })
  await removeReleaseDemoProgressProjection(page)
  await navigateSpa(page, releasePath)
  await navigateSpa(page, closePath)
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
  await expect(page.getByTestId('cut-order-close-feedback')).toContainText('阶段投影不存在，关闭失败')
})
