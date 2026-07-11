import { expect, test, type Locator, type Page } from '@playwright/test'

const newChangePath = '/fcs/production/changes/new'
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

async function selectFirstBusinessOption(select: Locator): Promise<string> {
  const value = await select.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).find(Boolean) ?? '',
  )
  expect(value).not.toBe('')
  await select.selectOption(value)
  return value
}

async function openContent(page: Page, changeType: 'quantity' | 'material'): Promise<void> {
  await page.goto(newChangePath)
  await page.getByLabel('选择生产单').selectOption({ index: 1 })
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'content')
  await page.getByRole('button', {
    name: changeType === 'quantity' ? '修改生产单需求数量' : '替换物料',
    exact: true,
  }).click()
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
  await selectFirstBusinessOption(page.getByLabel('原面料'))
  await selectFirstBusinessOption(page.getByLabel('新面料'))
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

async function expectNoForbiddenCopy(page: Page): Promise<void> {
  for (const copy of forbiddenCopy) {
    await expect(page.getByText(copy, { exact: false })).toHaveCount(0)
  }
}

async function expectNoOverlap(left: Locator, right: Locator): Promise<void> {
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
  await openContent(page, 'quantity')
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
  await expect(page.locator('[data-production-change-decision]')).toHaveCount(0)
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'execution')
  await expectNoForbiddenCopy(page)
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.getByText('全部处理成功并已统一生效。')).toBeVisible()

  await page.getByRole('button', { name: '返回列表' }).click()
  await expectNoForbiddenCopy(page)
  const recordCell = page.getByText(/^BG-\d{8}-\d{3}$/).filter({ hasNotText: 'BG-20260710' })
  await expect(recordCell).toHaveCount(1)
  const recordId = (await recordCell.textContent())!.trim()
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
    await openContent(page, 'material')
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

    if (materialCase.mode === 'FULL' && materialCase.scope === 'CURRENT_AND_FOLLOWING') {
      await page.getByRole('button', { name: '确认执行' }).click()
      await expect(page.getByText('全部处理成功并已统一生效。')).toBeVisible()
      await page.getByRole('button', { name: '返回列表' }).click()
      const createdRow = page.getByRole('row').filter({
        has: page.getByText(/^BG-\d{8}-\d{3}$/).filter({ hasNotText: 'BG-20260710' }),
      })
      await expect(createdRow).toHaveCount(1)
      await expect(createdRow).toContainText('替换物料')
      await expect(createdRow).toContainText('正式版本绑定调整')
    }
  })
}

test('可见失败入口全部回滚，重试复用同一变更单', async ({ page }) => {
  await page.goto('/fcs/production/changes')
  await expect(page.getByRole('heading', { name: '变更单列表', exact: true })).toBeVisible()
  const initialRows = await productionChangeListRows(page).count()
  expect(initialRows).toBeGreaterThan(0)
  await page.getByRole('button', { name: '新增变更' }).click()
  await page.getByLabel('选择生产单').selectOption({ index: 1 })
  await page.getByRole('button', { name: '下一步' }).click()
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
  await expect(productionChangeListRows(page)).toHaveCount(initialRows + 1)
  const createdCell = page.getByText(/^BG-\d{8}-\d{3}$/).filter({ hasNotText: 'BG-20260710' })
  await expect(createdCell).toHaveCount(1)
  const recordId = (await createdCell.textContent())!.trim()
  await page.goBack()
  await expect(page.getByRole('button', { name: '重新执行' })).toBeVisible()
  await page.getByRole('button', { name: '重新执行' }).click()
  await expect(page.getByText('全部处理成功并已统一生效。')).toBeVisible()

  await page.getByRole('button', { name: '返回列表' }).click()
  await expect(productionChangeListRows(page)).toHaveCount(initialRows + 1)
  await expect(page.getByText(recordId, { exact: true })).toHaveCount(1)
})

test('两张表单及第三第四步在双视口无页面溢出、关键控件不重叠且无旧文案', async ({ page }) => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await openContent(page, 'quantity')
    await expectNoDocumentOverflow(page)
    await expectNoForbiddenCopy(page)
    await expectNoOverlap(
      page.getByRole('button', { name: '修改生产单需求数量', exact: true }),
      page.getByRole('button', { name: '替换物料', exact: true }),
    )

    await openContent(page, 'material')
    await selectMaterialFacts(page)
    await chooseMaterialPlan(page, 'FULL', 'CURRENT_AND_FOLLOWING')
    await expectNoDocumentOverflow(page)
    await expectNoForbiddenCopy(page)
    await expectNoOverlap(page.getByLabel('原面料'), page.getByLabel('新面料'))
    await expectNoOverlap(
      page.getByRole('button', { name: '剩余数量替换', exact: true }),
      page.getByRole('button', { name: '全部数量替换', exact: true }),
    )
    await page.getByLabel('变更原因').fill(`E2E ${viewport.width} 视口布局验收。`)

    await page.getByRole('button', { name: '下一步' }).click()
    await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'handling')
    await expectNoDocumentOverflow(page)
    await expectNoForbiddenCopy(page)
    const firstDecision = page.locator('select[data-prod-field="productionChangeDecisionValue"]').first()
    await expect(firstDecision).toBeVisible()
    await expectNoOverlap(firstDecision, page.getByRole('button', { name: '下一步' }))

    await completeVisibleDecisions(page, 'FULL')
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(productionChangeBody(page)).toHaveAttribute('data-production-change-form-body', 'execution')
    await expectNoDocumentOverflow(page)
    await expectNoForbiddenCopy(page)
    await expect(page.getByRole('button', { name: '确认执行' })).toBeVisible()
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
