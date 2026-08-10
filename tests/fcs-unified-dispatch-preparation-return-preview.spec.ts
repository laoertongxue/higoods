import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const evidenceDir = '/private/tmp/higoods-fcs-prep-return-evidence'

async function searchTask(page: Page, keyword: string) {
  const input = page.locator('[data-unified-field="keyword"]')
  await input.fill(keyword)
  await expect(input).toHaveValue(keyword)
}

async function openTaskAction(page: Page, taskNo: string, action: 'open-direct' | 'open-bidding' | 'open-reassign') {
  const row = page.locator('tbody tr').filter({ hasText: taskNo }).first()
  await expect(row).toBeVisible()
  await row.locator(`[data-unified-action="${action}"]`).click()
}

function dispatchDialog(page: Page) {
  return page.locator('[data-unified-action="close-dispatch"]').first().locator('xpath=following-sibling::section[1]')
}

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true })
})

test('独立车缝派单按 SKU 展示裁片、辅料事实并实时预览 30/70/100 回货节点', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/dispatch/workbench')
  await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()

  await searchTask(page, 'PO-202603-0002')
  await openTaskAction(page, 'TASKGEN-202603-0002-002', 'open-direct')
  let dialog = dispatchDialog(page)
  await expect(dialog.getByRole('heading', { name: /直接派单/ })).toContainText('TASKGEN-202603-0002-002')

  const cutPanel = dialog.locator('[data-unified-cut-piece-readiness]')
  await expect(cutPanel.getByRole('heading', { name: '裁片齐套、放行及目标（SKU 维度）' })).toBeVisible()
  await expect(cutPanel.locator('tbody tr')).toHaveCount(4)
  await expect(cutPanel).toContainText('SKU-005-S-GRY')
  await expect(cutPanel).toContainText('Grey / S')
  await expect(cutPanel).toContainText('SKU-005-M-GRY')
  await expect(cutPanel).toContainText('风险放行')
  await expect(cutPanel).toContainText('20件')
  await expect(cutPanel).toContainText('CPR-202603-0002 · 更新 2026-08-10 09:15:00')

  const materialPanel = dialog.locator('[data-unified-material-prep-readiness]')
  await expect(materialPanel.getByRole('heading', { name: '本生产单车缝所需辅料的库存与配料情况' })).toBeVisible()
  await expect(materialPanel.locator('tbody tr')).toHaveCount(4)
  for (const expectedText of ['前中拉链', '2,500条', '3,100条', '主唛', '2,800套', '洗水唛', '2,600套', '缝纫线', '30公斤', '42公斤']) {
    await expect(materialPanel).toContainText(expectedText)
  }
  const materialImages = materialPanel.locator('img')
  await expect(materialImages).toHaveCount(4)
  for (let index = 0; index < 4; index += 1) {
    await expect.poll(() => materialImages.nth(index).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  }

  await materialPanel.getByRole('button', { name: '查看前中拉链高清物料图' }).click()
  await expect(page.locator('[data-unified-image-preview] img')).toBeVisible()
  await expect.poll(() => page.locator('[data-unified-image-preview] img').evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-unified-image-preview] img')).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: /直接派单/ })).toBeVisible()

  await dialog.locator('[data-unified-field="businessAssignedAt"]').fill('2026-08-11T09:22')
  dialog = dispatchDialog(page)
  let returnPreview = dialog.locator('[data-unified-return-rule-preview]').last()
  await expect(returnPreview).toContainText('当前计算数量：2,500件')
  await expect(returnPreview.locator('[data-return-ratio="0.3"]')).toContainText('第 4 个自然日 · 2026-08-14')
  await expect(returnPreview.locator('[data-return-ratio="0.3"]')).toContainText('累计≥ 750件')
  await expect(returnPreview.locator('[data-return-ratio="0.7"]')).toContainText('第 8 个自然日 · 2026-08-18')
  await expect(returnPreview.locator('[data-return-ratio="0.7"]')).toContainText('累计≥ 1,750件')
  await expect(returnPreview.locator('[data-return-ratio="1"]')).toContainText('第 9 个自然日 · 2026-08-19')
  await expect(returnPreview.locator('[data-return-ratio="1"]')).toContainText('累计≥ 2,500件')

  await dialog.locator('[data-unified-field="distributionMode"][value="FREE"]').check()
  for (const skuCode of ['SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY']) {
    await dispatchDialog(page).locator(`[data-unified-sku="${skuCode}"]`).uncheck()
  }
  dialog = dispatchDialog(page)
  await expect(dialog).toContainText('已选 1 个SKU，共 500件')
  await expect(dialog.locator('[data-unified-cut-piece-readiness] tbody tr')).toHaveCount(1)
  await expect(dialog.locator('[data-unified-cut-piece-readiness]')).toContainText('SKU-005-S-GRY')
  await expect(dialog.locator('[data-unified-material-prep-readiness] tbody tr')).toHaveCount(4)
  returnPreview = dialog.locator('[data-unified-return-rule-preview]').last()
  await expect(returnPreview).toContainText('当前计算数量：500件')
  await expect(returnPreview.locator('[data-return-ratio="0.3"]')).toContainText('累计≥ 150件')
  await expect(returnPreview.locator('[data-return-ratio="0.7"]')).toContainText('累计≥ 350件')
  await expect(returnPreview.locator('[data-return-ratio="1"]')).toContainText('累计≥ 500件')

  await dialog.locator('[data-unified-field="factoryId"]').selectOption({ index: 1 })
  await dialog.getByRole('button', { name: '下一步：二次确认价格' }).click()
  dialog = dispatchDialog(page)
  await expect(dialog.getByRole('heading', { name: '二次确认派单价格' })).toBeVisible()
  await expect(dialog).toContainText('谨慎确认价格，一经提交确认不得修改。')
  await expect(dialog).toContainText('数量：500件')
  await expect(dialog.locator('[data-unified-return-rule-preview]').last()).toContainText('当前计算数量：500件')
  await dialog.screenshot({ path: path.join(evidenceDir, 'direct-second-confirm.png') })

  const overflow = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1)
  await dialog.getByRole('button', { name: '返回修改' }).click()
  await dispatchDialog(page).getByRole('button', { name: '取消' }).click()
})

test('竞价预览保留业务分配日期，改派范围不可在页面手工改数量', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/dispatch/workbench')

  await searchTask(page, 'PO-202603-0002')
  await openTaskAction(page, 'TASKGEN-202603-0002-002', 'open-bidding')
  let dialog = dispatchDialog(page)
  await expect(dialog.getByRole('heading', { name: /发起竞价/ })).toBeVisible()
  await dialog.locator('[data-unified-field="businessAssignedAt"]').fill('2026-08-05T09:22')
  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="tenderDeadline"]').fill('2026-08-06T18:00')
  dialog = dispatchDialog(page)
  const biddingReturnPreview = dialog.locator('[data-unified-return-rule-preview]').last()
  await expect(biddingReturnPreview).toContainText('竞价阶段仅预览')
  await expect(dialog.locator('[data-return-ratio="0.3"]')).toContainText('2026-08-08')
  await expect(dialog.locator('[data-return-ratio="1"]')).toContainText('2026-08-13')
  await biddingReturnPreview.screenshot({ path: path.join(evidenceDir, 'bidding-return-preview.png') })
  await dialog.getByRole('button', { name: '确认发起竞价' }).click()
  await expect(page.locator('[data-unified-action="close-dispatch"]')).toHaveCount(0)

  const tenderFact = await page.evaluate(async () => {
    const tenderModule = await import('/src/data/fcs/runtime-task-tenders.ts')
    const taskId = 'TASKGEN-202603-0002-002__ORDER'
    const record = tenderModule.getRuntimeTaskTenderRecord(taskId)
    if (!record) throw new Error('任务分配未生成共享招标事实')
    const factory = record.factoryPool[0]
    tenderModule.recordRuntimeTaskTenderQuote(taskId, {
      factoryId: factory.factoryId,
      factoryName: factory.factoryName,
      quotePrice: record.standardPrice,
      quoteTime: '2026-08-06 10:00:00',
      deliveryDays: 9,
    })
    return {
      tenderId: record.tenderId,
      taskId: record.taskId,
      businessAssignedAt: record.businessAssignedAt,
      factoryId: factory.factoryId,
    }
  })
  expect(tenderFact.businessAssignedAt).toBe('2026-08-05 09:22:00')

  await page.getByRole('button', { name: '招标单管理' }).click()
  await expect(page.getByRole('heading', { name: '招标单管理' })).toBeVisible()
  const tenderRow = page.locator('tbody tr').filter({ hasText: tenderFact.tenderId }).first()
  await expect(tenderRow).toBeVisible()
  await tenderRow.getByRole('button', { name: '定标处理' }).click()
  const tenderDrawer = page.getByRole('heading', { name: '招标单详情' }).locator('xpath=ancestor::section[1]')
  await expect(tenderDrawer).toContainText('待定标')
  await tenderDrawer.locator(`[data-tender-action="select-award-factory"][data-factory-id="${tenderFact.factoryId}"]`).click()
  const riskConfirmation = tenderDrawer.locator('[data-tender-field="view.awardRiskConfirmed"]')
  if (await riskConfirmation.count()) await riskConfirmation.check()
  const supervisorConfirmation = tenderDrawer.locator('[data-tender-field="view.awardSupervisorAssigned"]')
  if (await supervisorConfirmation.count()) await supervisorConfirmation.check()
  await tenderDrawer.getByRole('button', { name: '确认定标' }).click()
  await expect(tenderDrawer).toContainText('谨慎确认价格，一经提交确认不得修改。')
  const awardReturnPreview = tenderDrawer.getByText('定标后的分阶段回货要求').locator('xpath=ancestor::div[contains(@class,"border-blue-200")][1]')
  await expect(awardReturnPreview).toContainText('业务分配日期 2026-08-05 为第 1 自然日')
  await expect(awardReturnPreview).toContainText('30% · 第 4 天')
  await expect(awardReturnPreview).toContainText('2026-08-08 前累计回货')
  await expect(awardReturnPreview).toContainText('750 件')
  await expect(awardReturnPreview).toContainText('70% · 第 8 天')
  await expect(awardReturnPreview).toContainText('2026-08-12 前累计回货')
  await expect(awardReturnPreview).toContainText('1,750 件')
  await expect(awardReturnPreview).toContainText('100% · 第 9 天')
  await expect(awardReturnPreview).toContainText('2026-08-13 前累计回货')
  await expect(awardReturnPreview).toContainText('2,500 件')
  await awardReturnPreview.screenshot({ path: path.join(evidenceDir, 'tender-award-second-confirm.png') })

  await tenderDrawer.getByRole('button', { name: '二次确认并冻结中标价' }).click()
  await expect(page.getByRole('heading', { name: '中标分配及合同已生成' })).toBeVisible()
  const awardFacts = await page.evaluate(async ({ taskId }) => {
    const contractModule = await import('/src/data/fcs/production-contracts.ts')
    const returnModule = await import('/src/data/fcs/production-return-fulfillment.ts')
    const contract = contractModule.listProductionContracts({ runtimeTaskId: taskId }).find((item) => item.status === 'EFFECTIVE')
    const snapshot = returnModule.listProductionReturnRuleSnapshots({ runtimeTaskId: taskId, activeOnly: true })[0]
    return contract && snapshot
      ? {
          contractAssignmentDate: contract.assignmentDate,
          contractAssignedQty: contract.assignedQty,
          snapshotAssignmentDate: snapshot.assignmentDate,
          snapshotAssignedQty: snapshot.assignedQty,
          milestones: snapshot.milestones.map((item) => [item.ratio, item.deadlineDate, item.targetQty]),
        }
      : null
  }, { taskId: tenderFact.taskId })
  expect(awardFacts).toEqual({
    contractAssignmentDate: '2026-08-05',
    contractAssignedQty: 2500,
    snapshotAssignmentDate: '2026-08-05',
    snapshotAssignedQty: 2500,
    milestones: [
      [0.3, '2026-08-08', 750],
      [0.7, '2026-08-12', 1750],
      [1, '2026-08-13', 2500],
    ],
  })
  await page.getByRole('button', { name: '稍后打印' }).click()

  await page.goto('/fcs/dispatch/workbench')

  await searchTask(page, 'TASKGEN-202603-0015-002')
  await openTaskAction(page, 'TASKGEN-202603-0015-002', 'open-reassign')
  dialog = dispatchDialog(page)
  const scope = dialog.locator('[data-unified-reassignment-scope]')
  await expect(scope).toContainText('原分配数量')
  await expect(scope).toContainText('已确认实收')
  await expect(scope).toContainText('本次改派数量')
  await expect(dialog.locator('[data-unified-sku]')).toHaveCount(0)
  await expect(dialog).toContainText('不在页面内另外勾选 SKU 或修改数量')
  await scope.screenshot({ path: path.join(evidenceDir, 'reassignment-readonly-scope.png') })
})
