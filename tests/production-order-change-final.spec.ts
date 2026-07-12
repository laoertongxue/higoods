import { expect, test, type Locator, type Page } from '@playwright/test'

const newChangePath = '/fcs/production/changes/new'
// Stable IDs come from the production-change current-facts seed and PCS material archive seed.
const productionOrderId = 'PO-202603-0004'
const originalMaterialId = 'MAT-PO-202603-0004-FAB-A01'
const replacementMaterialId = 'material_fabric_001'
const forbiddenCopy = [
  '已分发委托',
  '主管确认',
  '相关负责人',
  '需要谁处理',
  '客户要求',
  '适用批次',
  '异步任务',
  '后台任务',
]

function productionChangeBody(page: Page): Locator {
  return page.locator('[data-production-change-form-body]')
}

function productionChangeListRows(page: Page): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { name: '变更单列表', exact: true }),
  }).locator('tbody tr')
}

async function readProductionChangeRecordIds(page: Page): Promise<Set<string>> {
  await expect(page.getByRole('heading', { name: '变更单列表', exact: true })).toBeVisible()
  const ids = await productionChangeListRows(page).locator('td:first-child').evaluateAll((cells) =>
    cells.map((cell) => cell.textContent?.trim() ?? '').filter(Boolean),
  )
  return new Set(ids)
}

function getOnlyNewRecordId(before: Set<string>, after: Set<string>): string {
  const addedIds = [...after].filter((id) => !before.has(id))
  expect(addedIds).toHaveLength(1)
  return addedIds[0]
}

async function selectProductionOrderAndOpenContent(
  page: Page,
  changeType: 'quantity' | 'material',
): Promise<void> {
  await page.getByLabel('选择生产单').selectOption(productionOrderId)
  await expect(page.getByLabel('选择生产单')).toHaveValue(productionOrderId)
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'content')
  await page.getByRole('button', {
    name: changeType === 'quantity' ? '修改生产单需求数量' : '替换物料',
    exact: true,
  }).click()
}

async function openContent(page: Page, changeType: 'quantity' | 'material'): Promise<void> {
  await page.goto(newChangePath)
  await selectProductionOrderAndOpenContent(page, changeType)
}

async function fillQuantityChange(page: Page, reason: string, addLine: boolean): Promise<void> {
  const rows = productionChangeBody(page).locator('[data-production-change-quantity-row]')
  const lineIds = await rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-line-id') ?? ''))
  expect(lineIds.length).toBeGreaterThan(1)

  for (const [index, lineId] of lineIds.entries()) {
    const input = productionChangeBody(page).locator(
      `[data-prod-field="productionChangeQuantityTargetQty"][data-line-id="${lineId}"]`,
    )
    const current = Number(await input.inputValue())
    await input.fill(String(index === 0 ? 0 : current + 1))
  }

  if (addLine) {
    await page.getByRole('button', { name: '新增明细' }).click()
    const newRow = productionChangeBody(page).locator('[data-production-change-quantity-row]').filter({
      has: page.getByPlaceholder('商品编码'),
    })
    await newRow.getByPlaceholder('商品编码').fill('SKU-E2E-NEW')
    await newRow.getByPlaceholder('颜色').fill('测试红')
    await newRow.getByPlaceholder('尺码').fill('XXL')
    await newRow.locator('[data-prod-field="productionChangeQuantityTargetQty"]').fill('12')
  }

  await page.getByLabel('变更原因').fill(reason)
}

async function selectMaterialFacts(page: Page): Promise<void> {
  await page.getByLabel('原面料').selectOption(originalMaterialId)
  await page.getByLabel('新面料').selectOption(replacementMaterialId)
  await expect(page.getByLabel('原面料')).toHaveValue(originalMaterialId)
  await expect(page.getByLabel('新面料')).toHaveValue(replacementMaterialId)
}

async function readSuggestedProductionQty(page: Page): Promise<number> {
  return Number((await page.getByText('建议替换生产数量').locator('..').textContent())?.match(/\d+/)?.[0])
}

async function chooseMaterialPlan(
  page: Page,
  mode: 'REMAINING' | 'FULL',
  scope: 'CURRENT_ONLY' | 'CURRENT_AND_FOLLOWING',
): Promise<void> {
  const modeLabel = mode === 'REMAINING' ? '剩余数量替换' : '全部数量替换'
  const otherModeLabel = mode === 'REMAINING' ? '全部数量替换' : '剩余数量替换'
  const scopeLabel = scope === 'CURRENT_ONLY' ? '只处理当前生产单' : '后续生产单也替换'
  const otherScopeLabel = scope === 'CURRENT_ONLY' ? '后续生产单也替换' : '只处理当前生产单'

  await page.getByRole('button', { name: modeLabel, exact: true }).click()
  await expect(page.getByRole('button', { name: modeLabel, exact: true })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: otherModeLabel, exact: true })).not.toHaveClass(/bg-primary/)

  const suggestedQty = await readSuggestedProductionQty(page)
  const demandTotal = Number(await page.getByLabel('跟单确认用于生产的数量').getAttribute('max'))
  expect(suggestedQty).toBeGreaterThan(0)
  if (mode === 'FULL') {
    expect(suggestedQty).toBe(demandTotal)
  } else {
    expect(suggestedQty).toBeLessThan(demandTotal)
  }

  await page.getByRole('button', { name: scopeLabel, exact: true }).click()
  await expect(page.getByRole('button', { name: scopeLabel, exact: true })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: otherScopeLabel, exact: true })).not.toHaveClass(/bg-primary/)
}

async function completeVisibleDecisions(page: Page, preferredValue?: string): Promise<void> {
  const decisionSelector = 'select[data-prod-field="productionChangeDecisionValue"]'
  while (await page.locator(`${decisionSelector} option:checked[value=""]`).count()) {
    const blankDecision = page.locator(decisionSelector).filter({
      has: page.locator('option:checked[value=""]'),
    }).first()
    const availableValues = await blankDecision.locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    )
    await blankDecision.selectOption(
      preferredValue && availableValues.includes(preferredValue) ? preferredValue : availableValues[0],
    )
  }
  const reasons = page.locator('textarea[data-prod-field="productionChangeDecisionReason"]')
  for (const reason of await reasons.all()) {
    await reason.fill('按当前现场实物状态处理。')
  }
}

async function moveToExecution(page: Page): Promise<void> {
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'handling')
  await completeVisibleDecisions(page)
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'execution')
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }))
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth)
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth)
}

async function expectProductionChangeStepsToFit(page: Page): Promise<void> {
  const container = page.locator('[data-production-change-form-steps]')
  await expect(container).toBeVisible()
  const metrics = await container.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)

  for (const text of [
    '选择生产单',
    '系统获取当前事实',
    '填写变更内容',
    '唯一核心数据节点',
    '确认处理方案',
    '只判断必要事项',
    '同步执行',
    '全部提交或全部回滚',
  ]) {
    const item = container.getByText(text, { exact: true })
    await expect(item).toBeVisible()
    const [containerBox, itemBox] = await Promise.all([container.boundingBox(), item.boundingBox()])
    expect(containerBox).not.toBeNull()
    expect(itemBox).not.toBeNull()
    expect(itemBox!.x).toBeGreaterThanOrEqual(containerBox!.x)
    expect(itemBox!.x + itemBox!.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width)
  }
}

async function expectControlInViewport(control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded()
  await expect(control).toBeVisible()
  await expect(control).toBeInViewport()
}

async function expectNoUnexpectedClipping(container: Locator): Promise<void> {
  await container.scrollIntoViewIfNeeded()
  await expect(container).toBeVisible()
  await expect(container).toBeInViewport()
  const metrics = await container.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
    }
  })
  expect(
    metrics.scrollWidth > metrics.clientWidth + 1 && ['hidden', 'clip'].includes(metrics.overflowX),
  ).toBe(false)
  expect(
    metrics.scrollHeight > metrics.clientHeight + 1 && ['hidden', 'clip'].includes(metrics.overflowY),
  ).toBe(false)
}

async function expectNoForbiddenCopy(page: Page): Promise<void> {
  for (const copy of forbiddenCopy) {
    await expect(page.getByText(copy, { exact: false })).toHaveCount(0)
  }
}

async function expectNoOverlap(left: Locator, right: Locator): Promise<void> {
  await left.scrollIntoViewIfNeeded()
  await right.scrollIntoViewIfNeeded()
  await expect(left).toBeVisible()
  await expect(right).toBeVisible()
  await expect(left).toBeInViewport()
  await expect(right).toBeInViewport()
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()])
  expect(leftBox).not.toBeNull()
  expect(rightBox).not.toBeNull()
  const overlaps = !(
    leftBox!.x + leftBox!.width <= rightBox!.x ||
    rightBox!.x + rightBox!.width <= leftBox!.x ||
    leftBox!.y + leftBox!.height <= rightBox!.y ||
    rightBox!.y + rightBox!.height <= leftBox!.y
  )
  expect(overlaps).toBe(false)
}

test('数量变更完成四步闭环并进入同一记录的五模块详情', async ({ page }) => {
  const reason = 'E2E 数量调整：取消一条、逐条调整并新增 XXL 明细。'
  await page.goto('/fcs/production/changes')
  const recordIdsBefore = await readProductionChangeRecordIds(page)
  await page.getByRole('button', { name: '新增变更' }).click()
  await selectProductionOrderAndOpenContent(page, 'quantity')
  await fillQuantityChange(page, reason, true)
  await expectNoForbiddenCopy(page)

  const inputs = productionChangeBody(page).locator('[data-prod-field="productionChangeQuantityTargetQty"]')
  const expectedTotal = (await inputs.evaluateAll((elements) =>
    elements.map((element) => (element as HTMLInputElement).value),
  )).reduce((sum, value) => sum + Number(value), 0)
  await expect(productionChangeBody(page).getByText('已取消', { exact: true })).toBeVisible()
  await expect(productionChangeBody(page).locator('[data-production-change-quantity-target-total]')).toHaveText(`${expectedTotal} 件`)

  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'handling')
  await expectNoForbiddenCopy(page)
  await expect(page.getByRole('heading', { name: '系统自动处理' })).toBeVisible()
  await expect(page.getByText('跟单只读查看，不需要逐项操作。')).toBeVisible()
  await expect(page.getByText(/已完成数量比变更后需求多 \d+ 件/)).toBeVisible()
  await completeVisibleDecisions(page, 'KEEP_AS_STOCK')
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'execution')
  await expectNoForbiddenCopy(page)
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.getByText('全部处理成功并已统一生效。')).toBeVisible()

  await page.getByRole('button', { name: '返回列表' }).click()
  await expectNoForbiddenCopy(page)
  const recordIdsAfter = await readProductionChangeRecordIds(page)
  const recordId = getOnlyNewRecordId(recordIdsBefore, recordIdsAfter)
  const recordRow = page.getByRole('row').filter({ has: page.getByText(recordId, { exact: true }) })
  await expect(recordRow).toContainText('修改生产单需求数量')
  await expect(recordRow).toContainText('已完成')
  await recordRow.getByRole('button', { name: '查看详情' }).click()

  await expect(page.getByRole('heading', { name: recordId })).toBeVisible()
  await expectNoForbiddenCopy(page)
  await expect(page.getByText(reason, { exact: true })).toBeVisible()
  for (const moduleName of ['变更内容', '当前事实', '处理方案', '执行结果', '相关单据留痕']) {
    await expect(page.getByRole('heading', { name: moduleName, exact: true })).toBeVisible()
  }

  await page.getByRole('button', { name: '返回列表' }).click()
  await page.getByRole('button', { name: '新增变更' }).click()
  await expect(page.locator('[data-production-change-form-body]')).toHaveAttribute('data-production-change-form-body', 'order')
  await expect(page.getByLabel('选择生产单')).toHaveValue('')
  await expect(page.getByLabel('变更原因')).toHaveCount(0)
  await expect(page.locator('[data-production-change-form-error]')).toBeHidden()

  await page.getByRole('button', { name: '返回列表' }).click()
  const quantityScenario = page.locator('article').filter({
    has: page.getByRole('heading', { name: '修改生产单需求数量', exact: true }),
  })
  await quantityScenario.getByRole('button', { name: '填写变更内容', exact: true }).click()
  await expect(page.locator('[data-production-change-form-body]')).toHaveAttribute('data-production-change-form-body', 'order')
  await expect(page.getByLabel('选择生产单')).toHaveValue('')
  await expect(page.getByLabel('变更原因')).toHaveCount(0)
})

const materialCases = [
  {
    mode: 'REMAINING',
    scope: 'CURRENT_ONLY',
    label: '剩余数量替换 / 只处理当前生产单',
    affectedOrderCount: 1,
    expectedResult: '生产单打补丁',
    preferredDecision: 'REMAINING',
    requiresDecision: false,
  },
  {
    mode: 'FULL',
    scope: 'CURRENT_ONLY',
    label: '全部数量替换 / 只处理当前生产单',
    affectedOrderCount: 1,
    expectedResult: '生产单打补丁',
    preferredDecision: 'FULL',
    requiresDecision: true,
  },
  {
    mode: 'REMAINING',
    scope: 'CURRENT_AND_FOLLOWING',
    label: '剩余数量替换 / 后续生产单也替换',
    affectedOrderCount: 3,
    expectedResult: '生产单打补丁 + 正式版本绑定调整',
    preferredDecision: 'REMAINING',
    requiresDecision: true,
  },
  {
    mode: 'FULL',
    scope: 'CURRENT_AND_FOLLOWING',
    label: '全部数量替换 / 后续生产单也替换',
    affectedOrderCount: 3,
    expectedResult: '正式版本绑定调整',
    preferredDecision: 'FULL',
    requiresDecision: true,
  },
] as const

for (const materialCase of materialCases) {
  test(`物料组合生效：${materialCase.label}`, async ({ page }) => {
    const verifiesSavedRecord = materialCase.mode === 'FULL' && materialCase.scope === 'CURRENT_AND_FOLLOWING'
    let recordIdsBefore = new Set<string>()
    if (verifiesSavedRecord) {
      await page.goto('/fcs/production/changes')
      recordIdsBefore = await readProductionChangeRecordIds(page)
      await page.getByRole('button', { name: '新增变更' }).click()
      await selectProductionOrderAndOpenContent(page, 'material')
    } else {
      await openContent(page, 'material')
    }
    await selectMaterialFacts(page)
    await chooseMaterialPlan(page, materialCase.mode, materialCase.scope)
    await page.getByLabel('变更原因').fill(`E2E ${materialCase.label}`)
    await expectNoForbiddenCopy(page)

    await page.getByRole('button', { name: '下一步' }).click()
    await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'handling')
    await expect(page.getByRole('heading', { name: '待跟单判断' })).toBeVisible()
    await expectNoForbiddenCopy(page)
    await expect(page.getByLabel('处理方案摘要')).toContainText(
      `影响 ${materialCase.affectedOrderCount} 张生产单`,
    )

    const decisionItems = page.locator('[data-production-change-decision]')
    if (materialCase.requiresDecision) {
      expect(await decisionItems.count()).toBeGreaterThan(0)
      await page.getByRole('button', { name: '下一步' }).click()
      await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'handling')
      await expect(page.locator('[data-production-change-form-error]')).toContainText(/请先完成 \d+ 项待跟单判断/)
      await completeVisibleDecisions(page, materialCase.preferredDecision)
    } else {
      await expect(decisionItems).toHaveCount(0)
    }

    await expect(page.getByRole('heading', { name: materialCase.expectedResult, exact: true })).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'execution')
    await expect(page.getByLabel('执行前核对')).toContainText(materialCase.expectedResult)
    await expectNoForbiddenCopy(page)

    if (verifiesSavedRecord) {
      await page.getByRole('button', { name: '确认执行' }).click()
      await expect(page.getByText('全部处理成功并已统一生效。')).toBeVisible()
      await page.getByRole('button', { name: '返回列表' }).click()
      const recordIdsAfter = await readProductionChangeRecordIds(page)
      const recordId = getOnlyNewRecordId(recordIdsBefore, recordIdsAfter)
      const createdRow = page.getByRole('row').filter({ has: page.getByText(recordId, { exact: true }) })
      await expect(createdRow).toContainText('替换物料')
      await expect(createdRow).toContainText('正式版本绑定调整')
      await createdRow.getByRole('button', { name: '查看详情' }).click()
      await expect(page.getByRole('heading', { name: recordId })).toBeVisible()
      const traceSection = page.locator('section').filter({
        has: page.getByRole('heading', { name: '相关单据留痕', exact: true }),
      })
      for (const documentNo of ['PO-202603-0101', 'WLS-PL-260306-101', 'CUT-260306-101-01']) {
        await expect(traceSection.getByText(documentNo, { exact: true })).toBeVisible()
      }
      for (const traceColumn of ['来源变更单号', '变更前', '变更后', '处理方式 / 跟单决定', '执行时间']) {
        await expect(page.getByText(traceColumn, { exact: true })).toBeVisible()
      }
    }
  })
}

test('可见失败入口全部回滚，重试复用同一变更单', async ({ page }) => {
  await page.goto('/fcs/production/changes')
  const recordIdsBefore = await readProductionChangeRecordIds(page)
  await page.getByRole('button', { name: '新增变更' }).click()
  await selectProductionOrderAndOpenContent(page, 'quantity')
  await fillQuantityChange(page, 'E2E 原子回滚后重试。', false)
  await moveToExecution(page)

  await expect(page.getByText('全部成功才生效', { exact: true })).toBeVisible()
  await expect(page.getByText('锁定处理范围', { exact: true })).toBeVisible()
  await expect(page.getByText('生产单正在变更，请稍后再试', { exact: true })).toHaveCount(0)
  await page.getByText('失败回滚演示').click()
  await page.getByRole('button', { name: '演示全部回滚' }).click()
  await expect(page.getByText('已全部回滚，锁定已释放，本次没有生效')).toBeVisible()
  await expect(page.getByText('执行失败，本次没有修改任何单据。')).toBeVisible()
  await expect(page.getByText('全部回滚', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '返回列表' }).click()
  const recordIdsAfterFailure = await readProductionChangeRecordIds(page)
  const recordId = getOnlyNewRecordId(recordIdsBefore, recordIdsAfterFailure)
  const rolledBackRow = page.getByRole('row').filter({ has: page.getByText(recordId, { exact: true }) })
  await expect(rolledBackRow).toContainText('已回滚')
  await page.goBack()
  await expect(page.getByRole('button', { name: '重新执行' })).toBeVisible()
  await page.getByRole('button', { name: '重新执行' }).click()
  await expect(page.getByText('全部处理成功并已统一生效。')).toBeVisible()

  await page.getByRole('button', { name: '返回列表' }).click()
  const recordIdsAfterRetry = await readProductionChangeRecordIds(page)
  expect([...recordIdsAfterRetry].sort()).toEqual([...recordIdsAfterFailure].sort())
  await expect(page.getByText(recordId, { exact: true })).toHaveCount(1)
  const completedRow = page.getByRole('row').filter({ has: page.getByText(recordId, { exact: true }) })
  await expect(completedRow).toContainText('已完成')
})

test('两张表单及第三第四步在双视口无页面溢出、关键控件不重叠且无旧文案', async ({ page }) => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto(newChangePath)
    await expectProductionChangeStepsToFit(page)

    await openContent(page, 'quantity')
    await expectNoDocumentOverflow(page)
    await expectNoUnexpectedClipping(productionChangeBody(page))
    await expectNoForbiddenCopy(page)
    await expectNoOverlap(
      page.getByRole('button', { name: '修改生产单需求数量', exact: true }),
      page.getByRole('button', { name: '替换物料', exact: true }),
    )
    await expectControlInViewport(page.getByRole('button', { name: '新增明细' }))
    await expectControlInViewport(productionChangeBody(page).locator('[data-prod-field="productionChangeQuantityTargetQty"]').first())
    await expectControlInViewport(page.getByLabel('变更原因'))

    await openContent(page, 'material')
    await selectMaterialFacts(page)
    await chooseMaterialPlan(page, 'FULL', 'CURRENT_AND_FOLLOWING')
    await expectNoDocumentOverflow(page)
    await expectNoUnexpectedClipping(productionChangeBody(page))
    await expectNoForbiddenCopy(page)
    await expectNoOverlap(page.getByLabel('原面料'), page.getByLabel('新面料'))
    await expectNoOverlap(
      page.getByRole('button', { name: '剩余数量替换', exact: true }),
      page.getByRole('button', { name: '全部数量替换', exact: true }),
    )
    await expectNoOverlap(
      page.getByRole('button', { name: '只处理当前生产单', exact: true }),
      page.getByRole('button', { name: '后续生产单也替换', exact: true }),
    )
    await expectControlInViewport(page.getByLabel('跟单确认用于生产的数量'))
    await expectControlInViewport(page.getByLabel('变更原因'))
    await page.getByLabel('变更原因').fill(`E2E ${viewport.width} 视口布局验收。`)

    await page.getByRole('button', { name: '下一步' }).click()
    await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'handling')
    await expectNoDocumentOverflow(page)
    await expectNoUnexpectedClipping(productionChangeBody(page))
    await expectNoForbiddenCopy(page)
    const firstDecision = page.locator('select[data-prod-field="productionChangeDecisionValue"]').first()
    await expectControlInViewport(firstDecision)
    const handlingSummary = page.getByLabel('处理方案摘要')
    await expectNoOverlap(
      handlingSummary.locator(':scope > div').filter({ hasText: '最终变更类型' }),
      handlingSummary.locator(':scope > div').filter({ hasText: '数量与物料' }),
    )

    await completeVisibleDecisions(page, 'FULL')
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'execution')
    await expectNoDocumentOverflow(page)
    await expectNoUnexpectedClipping(productionChangeBody(page))
    await expectNoForbiddenCopy(page)
    const executionSummary = page.getByLabel('执行前核对')
    await expectNoOverlap(
      executionSummary.locator(':scope > div').filter({ hasText: '最终变更类型' }),
      executionSummary.locator(':scope > div').filter({ hasText: '变更原因' }),
    )
    await expectControlInViewport(page.getByRole('button', { name: '确认执行' }))
  }
})

test('高频数量和原因输入保持值、焦点与原 DOM 身份', async ({ page }) => {
  await openContent(page, 'quantity')
  const quantityInput = productionChangeBody(page).locator('[data-prod-field="productionChangeQuantityTargetQty"]').first()
  await quantityInput.evaluate((element) => ((element as HTMLInputElement & { e2eIdentity?: string }).e2eIdentity = 'qty-node'))
  await quantityInput.fill('123')
  await expect(quantityInput).toHaveValue('123')
  expect(await quantityInput.evaluate((element) => ({
    focused: document.activeElement === element,
    identity: (element as HTMLInputElement & { e2eIdentity?: string }).e2eIdentity,
  }))).toEqual({ focused: true, identity: 'qty-node' })

  const reasonInput = page.getByLabel('变更原因')
  await reasonInput.evaluate((element) => ((element as HTMLTextAreaElement & { e2eIdentity?: string }).e2eIdentity = 'reason-node'))
  await reasonInput.fill('连续输入原因 1，连续输入原因 2，连续输入原因 3。')
  await expect(reasonInput).toHaveValue('连续输入原因 1，连续输入原因 2，连续输入原因 3。')
  expect(await reasonInput.evaluate((element) => ({
    focused: document.activeElement === element,
    identity: (element as HTMLTextAreaElement & { e2eIdentity?: string }).e2eIdentity,
  }))).toEqual({ focused: true, identity: 'reason-node' })
})

test('生产单变更列表搜索框只承诺实际支持的字段', async ({ page }) => {
  await page.goto('/fcs/production/changes')
  await expect(page.locator('[data-prod-field="techPackChangeKeyword"]')).toHaveAttribute(
    'placeholder',
    '搜索变更单号 / 生产单号 / 变更场景 / 处理状态 / 变更原因',
  )
})
