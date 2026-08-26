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

async function confirmTenderLaunch(page: Page, minPrice = '1200') {
  let dialog = dispatchDialog(page)
  const minPriceInput = dialog.locator('[data-unified-field="tenderMinPrice"]')
  if (!(await minPriceInput.inputValue())) await minPriceInput.fill(minPrice)
  dialog = dispatchDialog(page)
  await dialog.getByRole('button', { name: '下一步：二次确认竞价' }).click()
  dialog = dispatchDialog(page)
  await expect(dialog.getByRole('heading', { name: '二次确认发起竞价' })).toBeVisible()
  await dialog.getByRole('button', { name: '确认发起竞价并冻结工厂池与最低价' }).click()
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

test('只有三类含车缝任务允许按完整 SKU 分配，其他任务强制整任务派单', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/dispatch/workbench')
  await expect(page.getByRole('heading', { name: '任务分配工作台' })).toBeVisible()

  await searchTask(page, 'TASKGEN-202603-0004-001')
  await openTaskAction(page, 'TASKGEN-202603-0004-001', 'open-direct')
  let dialog = dispatchDialog(page)
  await expect(dialog).toContainText('非车缝独立生产任务')
  await expect(dialog.locator('[data-unified-whole-task-direct-scope]')).toContainText('本次派单为整个任务')
  await expect(dialog.locator('[data-unified-whole-task-direct-scope]')).toContainText('该任务不按 SKU 拆分')
  await expect(dialog.locator('[data-unified-sku]')).toHaveCount(0)
  await expect(dialog).toContainText('本次整任务分配 4 个SKU，共 3,500件；不允许拆分')
  await dialog.locator('[data-unified-field="factoryId"]').selectOption({ index: 1 })
  await dialog.getByRole('button', { name: '下一步：二次确认价格' }).click()
  dialog = dispatchDialog(page)
  await expect(dialog).toContainText('数量：3,500件')
  await dialog.getByRole('button', { name: '确认提交并冻结价格' }).click()
  await expect(page.locator('[data-unified-action="close-dispatch"]')).toHaveCount(0)
  const wholeTaskAssignment = await page.evaluate(async () => {
    const runtimeModule = await import('/src/data/fcs/runtime-process-tasks.ts')
    const assignmentModule = await import('/src/data/fcs/effective-task-assignments.ts')
    const task = runtimeModule.listRuntimeProcessTasks().find((item) => item.taskNo === 'TASKGEN-202603-0004-001')
    if (!task) throw new Error('未找到非车缝任务运行时事实')
    const assignment = assignmentModule.listCurrentEffectiveTaskAssignments(task.taskId)[0]
    return assignment ? { assignedQty: assignment.assignedQty, skuCount: assignment.skuLines.length } : null
  })
  expect(wholeTaskAssignment).toEqual({ assignedQty: 3500, skuCount: 4 })

  await searchTask(page, 'MERGED-CUT-SEW-IRON-PACK-DEMO-001')
  await openTaskAction(page, 'MERGED-CUT-SEW-IRON-PACK-DEMO-001', 'open-direct')
  dialog = dispatchDialog(page)
  await expect(dialog).toContainText('裁剪+车缝+烫包')
  const skuInputs = dialog.locator('[data-unified-sku]')
  await expect(skuInputs).toHaveCount(4)
  for (let index = 1; index < 4; index += 1) await skuInputs.nth(index).uncheck()
  dialog = dispatchDialog(page)
  await expect(dialog).toContainText('已选 1 个SKU')
  await dialog.getByRole('button', { name: '取消' }).click()
})

test('整任务竞价冻结工厂池并贯通 PDA 报价、管理端定标，改派范围不可手工改数量', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.clock.setFixedTime(new Date(2026, 7, 6, 10, 0, 0))
  await page.goto('/fcs/dispatch/workbench')

  await searchTask(page, 'PO-202603-0002')
  await openTaskAction(page, 'TASKGEN-202603-0002-002', 'open-bidding')
  let dialog = dispatchDialog(page)
  await expect(dialog.getByRole('heading', { name: /发起竞价/ })).toBeVisible()
  await expect(dialog).toContainText('本次竞价为整个任务')
  await expect(dialog).toContainText('不选择、不拆分 SKU')
  await expect(dialog.locator('[data-unified-sku]')).toHaveCount(0)
  let tenderPool = dialog.locator('[data-unified-tender-pool]')
  await expect(tenderPool.getByRole('heading', { name: '本次竞价工厂池' })).toBeVisible()
  await expect(tenderPool).toContainText('全部符合竞价条件的工厂')
  await expect(tenderPool).toContainText('页面完整展示全部工厂，提交时不会截断本次工厂池')
  await tenderPool.screenshot({ path: path.join(evidenceDir, 'whole-task-tender-factory-pool.png') })
  await tenderPool.locator('[data-unified-field="tenderPoolMode"][value="MANUAL"]').check()
  dialog = dispatchDialog(page)
  tenderPool = dialog.locator('[data-unified-tender-pool]')
  await expect(tenderPool.locator('[data-unified-tender-transfer]')).toBeVisible()
  await expect(tenderPool.locator('[data-unified-tender-candidates]')).toContainText('候选工厂')
  await expect(tenderPool.locator('[data-unified-tender-selected-pool]')).toContainText('本次竞价工厂池')
  await expect(tenderPool.locator('[data-unified-field="tenderFactoryKeyword"]')).toBeVisible()
  await expect(tenderPool.locator('[data-unified-field="tenderFactoryType"]')).toBeVisible()
  const initialCandidateCount = await tenderPool.locator('[data-unified-tender-candidate]').count()
  expect(initialCandidateCount).toBeGreaterThan(0)
  await expect(tenderPool.locator('[data-unified-tender-pool-factory]')).toHaveCount(0)

  await tenderPool.locator('[data-unified-tender-candidate]').first().check()
  await expect(tenderPool.locator('[data-unified-tender-candidate]').first()).toBeChecked()
  await expect(tenderPool.locator('[data-unified-tender-pool-factory]')).toHaveCount(0)
  await tenderPool.locator('[data-unified-action="add-checked-tender-factories"]').click()
  tenderPool = dispatchDialog(page).locator('[data-unified-tender-pool]')
  await expect(tenderPool.locator('[data-unified-tender-candidate]')).toHaveCount(initialCandidateCount - 1)
  await expect(tenderPool.locator('[data-unified-tender-pool-factory]')).toHaveCount(1)

  const selectedFactoryName = (await tenderPool.locator('[data-unified-tender-pool-factory]').first().locator('xpath=following-sibling::span[1]//b').innerText()).trim()
  await tenderPool.locator('[data-unified-field="tenderFactoryKeyword"]').fill('__NO_MATCH__')
  tenderPool = dispatchDialog(page).locator('[data-unified-tender-pool]')
  await expect(tenderPool.locator('[data-unified-tender-candidate]')).toHaveCount(0)
  await expect(tenderPool.locator('[data-unified-tender-pool-factory]')).toHaveCount(1)
  await expect(tenderPool.locator('[data-unified-tender-selected-pool]')).toContainText(selectedFactoryName)
  await tenderPool.locator('[data-unified-field="tenderFactoryKeyword"]').fill('')
  tenderPool = dispatchDialog(page).locator('[data-unified-tender-pool]')
  await tenderPool.locator('[data-unified-tender-pool-factory]').check()
  await tenderPool.locator('[data-unified-action="remove-checked-tender-factories"]').click()
  tenderPool = dispatchDialog(page).locator('[data-unified-tender-pool]')
  await expect(tenderPool.locator('[data-unified-tender-candidate]')).toHaveCount(initialCandidateCount)
  await expect(tenderPool.locator('[data-unified-tender-pool-factory]')).toHaveCount(0)

  await tenderPool.locator('[data-unified-action="add-visible-tender-factories"]').click()
  tenderPool = dispatchDialog(page).locator('[data-unified-tender-pool]')
  await expect(tenderPool.locator('[data-unified-tender-candidate]')).toHaveCount(0)
  await expect(tenderPool.locator('[data-unified-tender-pool-factory]')).toHaveCount(initialCandidateCount)
  const selectedPoolNames = await tenderPool.locator('[data-unified-tender-pool-factory]').evaluateAll((inputs) => inputs.map((input) => input.parentElement?.innerText?.split('\n')[0] || ''))
  await tenderPool.screenshot({ path: path.join(evidenceDir, 'whole-task-tender-transfer-pool.png') })

  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="businessAssignedAt"]').fill('2026-08-05T09:22')
  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="tenderDeadline"]').fill('2026-08-06T18:00')
  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="tenderMinPrice"]').fill('1200')
  dialog = dispatchDialog(page)
  const biddingReturnPreview = dialog.locator('[data-unified-return-rule-preview]').last()
  await expect(biddingReturnPreview).toContainText('竞价阶段仅预览')
  await expect(dialog.locator('[data-return-ratio="0.3"]')).toContainText('2026-08-08')
  await expect(dialog.locator('[data-return-ratio="1"]')).toContainText('2026-08-13')
  await biddingReturnPreview.screenshot({ path: path.join(evidenceDir, 'bidding-return-preview.png') })
  await dialog.getByRole('button', { name: '下一步：二次确认竞价' }).click()
  dialog = dispatchDialog(page)
  await expect(dialog.getByRole('heading', { name: '二次确认发起竞价' })).toBeVisible()
  await expect(dialog).toContainText(`工厂池：手动选择部分工厂 · ${initialCandidateCount} 家`)
  await expect(dialog.locator('[data-unified-tender-confirmed-factories] > *')).toHaveText(selectedPoolNames)
  await expect(dialog).toContainText('最低允许报价：1200 IDR/件')
  await dialog.screenshot({ path: path.join(evidenceDir, 'whole-task-tender-second-confirm.png') })
  await dialog.getByRole('button', { name: '确认发起竞价并冻结工厂池与最低价' }).click()
  await expect(page.locator('[data-unified-action="close-dispatch"]')).toHaveCount(0)

  const tenderFact = await page.evaluate(async () => {
    const tenderModule = await import('/src/data/fcs/runtime-task-tenders.ts')
    const pdaModule = await import('/src/data/fcs/store-domain-pda.ts')
    const taskId = 'TASKGEN-202603-0002-002__ORDER'
    const record = tenderModule.getRuntimeTaskTenderRecord(taskId)
    if (!record) throw new Error('任务分配未生成共享招标事实')
    const factory = record.factoryPool[0]
    pdaModule.ensureFactoryPdaSeed(factory.factoryId, factory.factoryName)
    const user = pdaModule.listFactoryPdaUsers(factory.factoryId).find((item) => item.roleId === 'ROLE_ADMIN')
      || pdaModule.listFactoryPdaUsers(factory.factoryId)[0]
    if (!user) throw new Error('候选工厂缺少可用于 PDA 验收的账号')
    pdaModule.setPdaSession(pdaModule.createPdaSessionFromUser(user))
    return {
      tenderId: record.tenderId,
      taskId: record.taskId,
      businessAssignedAt: record.businessAssignedAt,
      factoryId: factory.factoryId,
      factoryPoolCount: record.factoryPool.length,
      skuCount: record.taskSnapshot.skuLines.length,
      qty: record.taskSnapshot.qty,
      standardPrice: record.standardPrice,
      minPrice: record.minPrice,
    }
  })
  expect(tenderFact.businessAssignedAt).toBe('2026-08-05 09:22:00')
  expect(tenderFact.skuCount).toBe(4)
  expect(tenderFact.qty).toBe(2500)
  expect(tenderFact.factoryPoolCount).toBeGreaterThan(0)

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/pda/notify')
  })
  await expect(page.getByText('待办汇总', { exact: true }).first()).toBeVisible()
  const tenderTodo = page.locator('[data-pda-todo-card-id]').filter({ hasText: '车缝任务竞价邀请' }).first()
  await expect(tenderTodo).toContainText('去报价')
  await expect(tenderTodo).toContainText('4 个 SKU')
  await tenderTodo.screenshot({ path: path.join(evidenceDir, 'whole-task-tender-pda-todo.png') })
  await tenderTodo.getByRole('button', { name: '去报价' }).click()
  const quoteDialog = page.getByRole('heading', { name: '立即报价' }).locator('xpath=ancestor::article[1]')
  await expect(quoteDialog).toContainText('本次报价覆盖整个任务：4 个 SKU，共 2500 件，不支持拆分报价。')
  await expect(quoteDialog).toContainText(`最低允许报价：${tenderFact.minPrice.toLocaleString()} IDR/件`)
  await expect(quoteDialog).toContainText('报价达到最低允许报价即可提交；提交后不可修改。')
  await quoteDialog.screenshot({ path: path.join(evidenceDir, 'whole-task-tender-pda-quote.png') })
  await quoteDialog.locator('[data-pda-tr-field="quoteAmount"]').fill(String(tenderFact.standardPrice))
  await quoteDialog.locator('[data-pda-tr-field="deliveryDays"]').fill('9')
  await quoteDialog.getByRole('button', { name: '确认提交报价' }).click()
  await expect(page.locator('#pda-task-receive-toast-root')).toContainText('报价提交成功')
  await page.getByRole('button', { name: /已报价招标单/ }).click()
  await expect(page.locator('article').filter({ hasText: tenderFact.tenderId }).first()).toContainText(`${tenderFact.standardPrice.toLocaleString()} IDR/件`)

  const sharedQuote = await page.evaluate(async ({ taskId, factoryId }) => {
    const tenderModule = await import('/src/data/fcs/runtime-task-tenders.ts')
    const record = tenderModule.getRuntimeTaskTenderRecord(taskId)
    return record?.quotes.find((quote) => quote.factoryId === factoryId) || null
  }, { taskId: tenderFact.taskId, factoryId: tenderFact.factoryId })
  expect(sharedQuote?.quotePrice).toBe(tenderFact.standardPrice)
  await page.clock.setFixedTime(new Date(2026, 7, 6, 19, 0, 0))

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/dispatch/tenders')
  })
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

test('取消竞价必须二次确认，旧招标留痕且任务可重新发起整任务竞价', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.clock.setFixedTime(new Date(2026, 7, 7, 10, 0, 0))
  await page.goto('/fcs/dispatch/workbench')

  await searchTask(page, 'PO-202603-0002')
  await openTaskAction(page, 'TASKGEN-202603-0002-002', 'open-bidding')
  let dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="businessAssignedAt"]').fill('2026-08-07T09:00')
  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="tenderDeadline"]').fill('2026-08-07T18:00')
  await confirmTenderLaunch(page)

  const firstTender = await page.evaluate(async () => {
    const tenderModule = await import('/src/data/fcs/runtime-task-tenders.ts')
    const record = tenderModule.getRuntimeTaskTenderRecord('TASKGEN-202603-0002-002__ORDER')
    if (!record) throw new Error('未生成待取消的共享招标事实')
    return { tenderId: record.tenderId, taskId: record.taskId }
  })

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/dispatch/tenders')
  })
  const row = page.locator('tbody tr').filter({ hasText: firstTender.tenderId }).first()
  await expect(row).toContainText('招标中')
  await row.getByRole('button', { name: '查看', exact: true }).click()
  let drawer = page.getByRole('heading', { name: '招标单详情' }).locator('xpath=ancestor::section[1]')
  await drawer.locator('[data-tender-field="view.cancelReason"]').fill('工厂池范围需要重新确认')
  await drawer.getByRole('button', { name: '取消本次竞价' }).click()
  drawer = page.getByRole('heading', { name: '招标单详情' }).locator('xpath=ancestor::section[1]')
  await expect(drawer).toContainText('已提交报价仅作为历史留痕')
  await drawer.screenshot({ path: path.join(evidenceDir, 'whole-task-tender-cancel-second-confirm.png') })
  await drawer.getByRole('button', { name: '二次确认取消竞价' }).click()
  await expect(page.locator('#dispatch-tender-toast-root')).toContainText('任务已返回待分配')
  await expect(page.locator('tbody tr').filter({ hasText: firstTender.tenderId }).first()).toContainText('已取消')

  const cancelledFacts = await page.evaluate(async ({ tenderId, taskId }) => {
    const tenderModule = await import('/src/data/fcs/runtime-task-tenders.ts')
    const taskModule = await import('/src/data/fcs/runtime-process-tasks.ts')
    const record = tenderModule.getRuntimeTaskTenderRecordByTenderId(tenderId)
    const task = taskModule.getRuntimeTaskById(taskId)
    return {
      tenderStatus: record ? tenderModule.resolveRuntimeTaskTenderStatus(record, '2026-08-07 10:01:00') : null,
      taskAssignmentMode: task?.assignmentMode,
      taskAssignmentStatus: task?.assignmentStatus,
      activeTenderId: task?.tenderId || null,
    }
  }, firstTender)
  expect(cancelledFacts).toEqual({
    tenderStatus: 'CANCELLED',
    taskAssignmentMode: 'DIRECT',
    taskAssignmentStatus: 'UNASSIGNED',
    activeTenderId: null,
  })

  await page.evaluate(async () => {
    const { appStore } = await import('/src/state/store.ts')
    appStore.navigate('/fcs/dispatch/workbench')
  })
  await searchTask(page, 'PO-202603-0002')
  await openTaskAction(page, 'TASKGEN-202603-0002-002', 'open-bidding')
  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="businessAssignedAt"]').fill('2026-08-07T09:05')
  dialog = dispatchDialog(page)
  await dialog.locator('[data-unified-field="tenderDeadline"]').fill('2026-08-07T19:00')
  await confirmTenderLaunch(page)

  const relaunchedFacts = await page.evaluate(async ({ taskId, tenderId }) => {
    const tenderModule = await import('/src/data/fcs/runtime-task-tenders.ts')
    const records = tenderModule.listRuntimeTaskTenderRecords().filter((record) => record.taskId === taskId)
    const latest = tenderModule.getRuntimeTaskTenderRecord(taskId)
    const oldRecord = tenderModule.getRuntimeTaskTenderRecordByTenderId(tenderId)
    return {
      count: records.length,
      latestTenderId: latest?.tenderId,
      latestStatus: latest ? tenderModule.resolveRuntimeTaskTenderStatus(latest, '2026-08-07 10:01:00') : null,
      oldStatus: oldRecord ? tenderModule.resolveRuntimeTaskTenderStatus(oldRecord, '2026-08-07 10:01:00') : null,
    }
  }, firstTender)
  expect(relaunchedFacts.count).toBe(2)
  expect(relaunchedFacts.latestTenderId).not.toBe(firstTender.tenderId)
  expect(relaunchedFacts.latestStatus).toBe('BIDDING')
  expect(relaunchedFacts.oldStatus).toBe('CANCELLED')
})
