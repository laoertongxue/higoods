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

  await reopenFromPage(page, 2)
  await navigateSpa(page, releasePath)
  await page.getByRole('button', { name: '查看矩阵' }).click()
  await expect(page.locator('[data-testid="complete-kit-Black-M"]')).toContainText('200')
  await expect(page.locator('[data-testid="complete-kit-Black-L"]')).toContainText('350')
  await expect(page.locator('[data-testid="complete-kit-Black-XL"]')).toContainText('500')

  await navigateSpa(page, closePath)
  await closeFromPage(page, 3, '第一轮业务关闭')
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
  await navigateSpa(page, closePath)
  await closeFromPage(page, 5, '第二轮业务关闭')
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
