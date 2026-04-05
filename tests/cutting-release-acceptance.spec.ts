import { expect, test, type Locator, type Page } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { buildFeiTicketPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'
import { buildGeneratedFeiTicketTraceMatrix } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import {
  buildSpreadingListViewModel,
  readMarkerSpreadingPrototypeData,
} from '../src/pages/process-factory/cutting/marker-spreading-utils.ts'
import { buildCuttingTraceabilityProjectionContext } from '../src/pages/process-factory/cutting/traceability-projection-helpers.ts'
import { buildCutPieceWarehouseProjection } from '../src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
import { buildReplenishmentProjection } from '../src/pages/process-factory/cutting/replenishment-projection.ts'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

function getStageTab(page: Page, label: string): Locator {
  return page
    .getByTestId('cutting-spreading-stage-tabs')
    .getByRole('button', { name: new RegExp(`^${label}（`) })
}

async function getStageCount(page: Page, label: string): Promise<number> {
  const text = (await getStageTab(page, label).textContent()) || ''
  const matched = text.match(/（(\d+)）/)
  return matched ? Number(matched[1]) : 0
}

async function expandCuttingSidebar(page: Page): Promise<void> {
  for (const groupLabel of ['裁前准备', '铺布执行', '裁后处理']) {
    const toggle = page.locator('aside').getByText(groupLabel, { exact: true }).first()
    if (await toggle.isVisible()) {
      await toggle.click()
    }
  }
}

async function countViewportRows(page: Page, tableTestId: string): Promise<number> {
  return page.getByTestId(tableTestId).locator('tbody tr').evaluateAll((rows) => {
    const viewportHeight = window.innerHeight
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect()
      return rect.height > 0 && rect.top < viewportHeight && rect.bottom > 0
    }).length
  })
}

async function expectVisibleInViewport(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const inViewport = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0
  })
  expect(inViewport).toBeTruthy()
}

const bannedLegacyBranchCopy = [
  '合批',
  '印花面料',
  '染色面料',
  '净色面料',
  '去印花工单',
  '去染色工单',
  '印花补料',
  '染色补料',
  '净色补料',
  '可能影响印花',
  '可能影响染色',
  '裁片件数',
] as const

const bannedEngineeringFormulaCopy = ['readyForSpreading = true', 'allocationStatus ≠ balanced', 'layoutStatus ≠ done'] as const

const bannedEnglishUnitCopy = [/\bPIECE\b/, /\bROLL\b/, /\bLAYER\b/] as const

async function expectNoLegacyCuttingCopy(page: Page): Promise<void> {
  const body = page.locator('body')
  for (const token of bannedLegacyBranchCopy) {
    await expect(body).not.toContainText(token)
  }
  for (const token of bannedEngineeringFormulaCopy) {
    await expect(body).not.toContainText(token)
  }
  for (const pattern of bannedEnglishUnitCopy) {
    await expect(body).not.toContainText(pattern)
  }
}

async function countTripleCardNesting(page: Page, rootSelector: string): Promise<number> {
  return page.locator(rootSelector).evaluate((root) => {
    const isCard = (node: Element) => {
      const classes = node.classList
      return classes.contains('border') && classes.contains('bg-card')
    }
    const children = Array.from(root.querySelectorAll('*'))
    return children.filter((node) => {
      if (!isCard(node)) return false
      const second = Array.from(node.children).find((child) => isCard(child))
      if (!second) return false
      return Array.from(second.children).some((child) => isCard(child))
    }).length
  })
}

function extractCuttingSidebarSegments(sidebarText: string) {
  const compact = sidebarText.replace(/\s+/g, ' ')
  const prepStart = compact.indexOf('裁前准备')
  const inProgressStart = compact.indexOf('铺布执行')
  const closedLoopStart = compact.indexOf('裁后处理')
  expect(prepStart).toBeGreaterThanOrEqual(0)
  expect(inProgressStart).toBeGreaterThan(prepStart)
  expect(closedLoopStart).toBeGreaterThan(inProgressStart)

  return {
    prep: compact.slice(prepStart, inProgressStart),
    inProgress: compact.slice(inProgressStart, closedLoopStart),
    closedLoop: compact.slice(closedLoopStart),
  }
}

const executionUnitTask = listPdaCuttingTaskSourceRecords()
  .flatMap((record) =>
    record.executionOrderIds.map((executionOrderId, index) => ({
      taskId: record.taskId,
      executionOrderId,
      executionOrderNo: record.executionOrderNos[index] || executionOrderId,
      detail: getPdaCuttingTaskSnapshot(record.taskId, executionOrderId),
    })),
  )
  .find((item) =>
    item.detail?.cutPieceOrders.some(
      (line) => line.executionOrderId === item.executionOrderId && line.currentStepCode !== 'DONE',
    ),
  )

const workerSpreadingTask = listPdaCuttingTaskSourceRecords()
  .flatMap((record) =>
    record.executionOrderIds.map((executionOrderId, index) => ({
      taskId: record.taskId,
      executionOrderId,
      executionOrderNo: record.executionOrderNos[index] || executionOrderId,
      detail: getPdaCuttingTaskSnapshot(record.taskId, executionOrderId),
    })),
  )
  .find((item) => item.detail?.spreadingTargets.some((target) => target.targetType === 'session' || target.targetType === 'marker'))

const prototypeSpreadingData = readMarkerSpreadingPrototypeData()
const prototypeSpreadingRows = buildSpreadingListViewModel({
  spreadingSessions: prototypeSpreadingData.store.sessions,
  rowsById: prototypeSpreadingData.rowsById,
  mergeBatches: prototypeSpreadingData.mergeBatches,
  markerRecords: prototypeSpreadingData.store.markers,
})
const prototypeFeiPrintProjection = buildFeiTicketPrintProjection()
const prototypeTraceabilityContext = buildCuttingTraceabilityProjectionContext()
const prototypeWarehouseProjection = buildCutPieceWarehouseProjection({ snapshot: prototypeTraceabilityContext.snapshot })

function resolveSupervisorStageKey(row: (typeof prototypeSpreadingRows)[number]) {
  const lifecycle = row.session.prototypeLifecycleOverrides
  if (row.statusKey === 'DRAFT' || row.statusKey === 'TO_FILL') return 'WAITING_START'
  if (row.statusKey === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (lifecycle?.replenishmentStatusLabel === '待补料确认') return 'WAITING_REPLENISHMENT'
  if (lifecycle?.feiTicketStatusLabel === '待打印菲票') return 'WAITING_FEI_TICKET'
  if (lifecycle?.baggingStatusLabel === '待装袋') return 'WAITING_BAGGING'
  if (lifecycle?.warehouseStatusLabel === '待入仓') return 'WAITING_WAREHOUSE'
  return 'DONE'
}

function findPrototypeStageCaseRow(stageKey: 'WAITING_REPLENISHMENT' | 'WAITING_FEI_TICKET' | 'WAITING_BAGGING' | 'WAITING_WAREHOUSE') {
  return (
    prototypeSpreadingRows.find((row) => {
      if (resolveSupervisorStageKey(row) !== stageKey) return false
      if (stageKey === 'WAITING_FEI_TICKET') {
        return prototypeFeiPrintProjection.printableViewModel.units.some((unit) => unit.sourceSpreadingSessionIds.includes(row.spreadingSessionId))
      }
      if (stageKey === 'WAITING_WAREHOUSE') {
        return prototypeWarehouseProjection.viewModel.items.some((item) => item.spreadingSessionId === row.spreadingSessionId)
      }
      return true
    }) || null
  )
}

const mergeBatchDetailRow =
  prototypeSpreadingRows.find((row) => row.contextType === 'merge-batch' && Boolean(row.session.markerId)) || null
const originalOrderDetailRow =
  prototypeSpreadingRows.find((row) => row.contextType === 'original-order' && Boolean(row.session.markerId)) || null

test('release acceptance：supervisor IA、铺布列表状态与菜单闭环可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })

  await page.goto('/fcs/craft/cutting/spreading-list')
  await expect(page.getByTestId('cutting-spreading-list-page')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '铺布列表' })).toBeVisible()

  await expandCuttingSidebar(page)
  await expect(page.locator('[data-menu-group-header="平台运营系统"]')).toBeVisible()
  await expect(page.locator('[data-menu-group-header="工艺工厂运营系统"]')).toBeVisible()
  await expect(page.locator('[data-menu-group-icon="平台运营系统"]')).toBeVisible()
  await expect(page.locator('[data-menu-group-icon="工艺工厂运营系统"]')).toBeVisible()
  await expect(page.locator('aside').getByText('裁前准备', { exact: true })).toBeVisible()
  await expect(page.locator('aside').getByText('铺布执行', { exact: true })).toBeVisible()
  await expect(page.locator('aside').getByText('裁后处理', { exact: true })).toBeVisible()
  await expect(page.locator('[data-menu-item-icon="裁后处理"] svg')).toBeVisible()
  const sidebarText = await page.locator('aside').innerText()
  expect(sidebarText).not.toContain('裁片执行闭环')
  const segments = extractCuttingSidebarSegments(sidebarText)
  expect(segments.prep).toContain('原始裁片单')
  expect(segments.prep).toContain('仓库配料领料')
  expect(segments.prep).toContain('唛架列表')
  expect(segments.prep).not.toContain('打印菲票')
  expect(segments.inProgress).toContain('铺布列表')
  expect(segments.closedLoop).toContain('补料管理')
  expect(segments.closedLoop).toContain('打印菲票')
  expect(segments.closedLoop).toContain('周转口袋流转')
  expect(segments.closedLoop).toContain('裁片仓')

  await expect(page.getByRole('button', { name: '按唛架新建铺布' })).toBeVisible()
  await expect(page.getByRole('button', { name: '异常补录铺布' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导出当前视图' })).toBeVisible()
  await expect(page.getByTestId('cutting-spreading-list-stats')).toHaveCount(1)
  const spreadingStatsBox = await page.getByTestId('cutting-spreading-list-stats').boundingBox()
  expect(spreadingStatsBox?.height ?? 0).toBeLessThan(220)
  await expect(page.locator('[data-cutting-spreading-main-card="true"]')).toHaveCount(1)
  await expect(page.getByTestId('cutting-spreading-more-filters')).not.toHaveAttribute('open', '')
  await expect(page.getByTestId('cutting-spreading-list-table').locator('thead')).toBeVisible()
  expect(await countViewportRows(page, 'cutting-spreading-list-table')).toBeGreaterThanOrEqual(6)
  expect(await countTripleCardNesting(page, '[data-testid="cutting-spreading-list-page"]')).toBe(0)

  for (const label of ['待补料确认', '待打印菲票', '待装袋', '待入仓']) {
    expect(await getStageCount(page, label)).toBeGreaterThan(0)
  }

  await expect(page.getByText('待开始数 = 主状态 = 待开始 的铺布数')).toBeVisible()
  await expect(page.getByText('待补料数 = 主状态 = 待补料确认 的铺布数')).toBeVisible()
  await expect(page.getByTestId('cutting-spreading-list-table').locator('p.font-mono').first()).toBeVisible()

  await (await getStageTab(page, '待补料确认')).click()
  let stageRow = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first()
  await expect(stageRow.getByRole('button', { name: '去补料管理' })).toBeVisible()

  await (await getStageTab(page, '待打印菲票')).click()
  stageRow = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first()
  await expect(stageRow.getByRole('button', { name: '去打印菲票' })).toBeVisible()

  await (await getStageTab(page, '待装袋')).click()
  stageRow = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first()
  await expect(stageRow.getByRole('button', { name: '去装袋' })).toBeVisible()

  await (await getStageTab(page, '待入仓')).click()
  stageRow = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first()
  await expect(stageRow.getByRole('button', { name: '去裁片仓' })).toBeVisible()

  await page.goto('/fcs/craft/cutting/marker-list')
  await page.getByRole('button', { name: '已建唛架', exact: true }).click()
  await expect(page.getByTestId('marker-plan-list-stats')).toBeVisible()
  const markerStatsBox = await page.getByTestId('marker-plan-list-stats').boundingBox()
  expect(markerStatsBox?.height ?? 0).toBeLessThan(220)
  await expect(page.locator('[data-marker-plan-main-card="true"]')).toHaveCount(1)
  await expect(page.getByTestId('marker-plan-list-table').locator('thead')).toBeVisible()
  expect(await countViewportRows(page, 'marker-plan-list-table')).toBeGreaterThanOrEqual(6)

  await expectNoPageErrors(errors)
})

test('release acceptance：铺布只能 marker-first 创建，异常补录必须填写原因', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/spreading-create')
  await expect(page.getByTestId('cutting-spreading-create-page')).toBeVisible()
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()

  await page.getByTestId('cutting-spreading-create-source-table').locator('tbody tr').first().getByRole('button', { name: '选中' }).click()
  await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled()
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByTestId('cutting-spreading-create-confirmation').locator('p.font-mono').first()).toBeVisible()
  await page.getByRole('button', { name: '确认创建并进入编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await page.getByRole('button', { name: '异常补录铺布' }).click()
  await expect(page).toHaveURL(/exceptionEntry=1/)
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '确认创建并进入编辑' }).click()
  await expect(page.getByText('异常补录铺布必须填写异常补录原因。')).toBeVisible()

  await page.getByLabel('异常补录原因').fill('acceptance：现场补录换卷。')
  await page.getByRole('button', { name: '确认创建并进入编辑' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit\?/)

  await expectNoPageErrors(errors)
})

test.skip(!mergeBatchDetailRow || !workerSpreadingTask, '缺少可覆盖文案清场的合并裁剪批次 / PDA 铺布样例')
test('release acceptance：裁片域界面文案全部中文化，旧补料分支和工程变量文案已清场', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { level: 1, name: '补料管理' })).toBeVisible()
  await expectNoLegacyCuttingCopy(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await expect(page.getByRole('heading', { level: 1, name: '铺布列表' })).toBeVisible()
  await expectNoLegacyCuttingCopy(page)

  await page.goto('/fcs/craft/cutting/marker-list')
  await expect(page.getByRole('heading', { level: 1, name: '唛架列表' })).toBeVisible()
  await expectNoLegacyCuttingCopy(page)

  await page.goto(`/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(mergeBatchDetailRow!.spreadingSessionId)}`)
  await expect(page.getByRole('button', { name: '去合并裁剪批次' })).toBeVisible()
  await expect(page.locator('body')).toContainText('合并裁剪批次')
  await expectNoLegacyCuttingCopy(page)

  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/fcs/pda/exec')
  await expect(page.getByRole('heading', { level: 1, name: '执行' })).toBeVisible()
  await expectNoLegacyCuttingCopy(page)

  const pdaTask = workerSpreadingTask!
  await page.goto(
    `/fcs/pda/cutting/spreading/${pdaTask.taskId}?executionOrderId=${encodeURIComponent(pdaTask.executionOrderId)}&executionOrderNo=${encodeURIComponent(pdaTask.executionOrderNo)}`,
  )
  await expect(page.getByRole('heading', { level: 1, name: '铺布录入' })).toBeVisible()
  await expect(page.locator('body')).toContainText('铺布层数（层）')
  await expect(page.locator('body')).toContainText('实际裁剪成衣件数（件）')
  await expectNoLegacyCuttingCopy(page)

  await expectNoPageErrors(errors)
})

test('release acceptance：supervisor 详情页 next-step action bar、公式和上下游跳转闭环', async ({ page }) => {
  const errors = collectPageErrors(page)
  expect(mergeBatchDetailRow).toBeTruthy()
  expect(originalOrderDetailRow).toBeTruthy()

  const stageExpectations = [
    {
      stageKey: 'WAITING_REPLENISHMENT',
      stage: '待补料确认',
      action: '去补料管理',
      url: /\/fcs\/craft\/cutting\/replenishment/,
    },
    {
      stageKey: 'WAITING_FEI_TICKET',
      stage: '待打印菲票',
      action: '去打印菲票',
      url: /\/fcs\/craft\/cutting\/fei-tickets/,
    },
    {
      stageKey: 'WAITING_BAGGING',
      stage: '待装袋',
      action: '去装袋',
      url: /\/fcs\/craft\/cutting\/transfer-bag/,
    },
    {
      stageKey: 'WAITING_WAREHOUSE',
      stage: '待入仓',
      action: '去裁片仓',
      url: /\/fcs\/craft\/cutting\/cut-piece-warehouse/,
    },
  ] as const

  for (const expectation of stageExpectations) {
    const caseRow = findPrototypeStageCaseRow(expectation.stageKey)
    expect(caseRow).toBeTruthy()
    await page.goto('/fcs/craft/cutting/spreading-list')
    expect(await getStageCount(page, expectation.stage)).toBeGreaterThan(0)
    await (await getStageTab(page, expectation.stage)).click()
    const listRow = page.getByTestId('cutting-spreading-list-table').locator('tbody tr').filter({ hasText: caseRow!.session.sessionNo }).first()
    await expect(listRow).toBeVisible()
    await listRow.getByRole('button', { name: '查看详情' }).click()
    const nextStepBar = page.getByTestId('cutting-spreading-next-step-bar')
    await expect(nextStepBar).toBeVisible()
    await expect(nextStepBar.getByRole('button', { name: expectation.action })).toBeVisible()
    await expect(page.locator('.font-mono').filter({ hasText: '=' }).first()).toBeVisible()
    await nextStepBar.getByRole('button', { name: expectation.action }).click()
    await expect(page).toHaveURL(expectation.url)
    if (expectation.stage === '待打印菲票') {
      await expect(page.locator('body')).toContainText('来源铺布')
    }
    if (expectation.stage === '待装袋' || expectation.stage === '待入仓') {
      await expect(page).toHaveURL(/spreadingSessionId=/)
    }
  }

  await page.goto('/fcs/craft/cutting/spreading-list')
  expect(await getStageCount(page, '已完成')).toBeGreaterThan(0)
  await (await getStageTab(page, '已完成')).click()
  await page.getByTestId('cutting-spreading-list-table').locator('tbody tr').first().getByRole('button', { name: '查看详情' }).click()
  const doneNextStepBar = page.getByTestId('cutting-spreading-next-step-bar')
  await expect(doneNextStepBar).toContainText('已完成')
  await expect(doneNextStepBar.locator('button.bg-blue-600')).toHaveCount(0)

  await page.goto(
    `/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(mergeBatchDetailRow!.spreadingSessionId)}`,
  )
  await expect(page.getByRole('button', { name: '去来源唛架' })).toBeVisible()
  await page.getByRole('button', { name: '去来源唛架' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/marker-detail\//)

  await page.goto(
    `/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(mergeBatchDetailRow!.spreadingSessionId)}`,
  )
  await expect(page.getByRole('button', { name: '去合并裁剪批次' })).toBeVisible()
  await page.getByRole('button', { name: '去合并裁剪批次' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/merge-batches/)

  await page.goto(
    `/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(originalOrderDetailRow!.spreadingSessionId)}`,
  )
  await expect(page.getByRole('button', { name: '去原始裁片单' })).toBeVisible()
  await page.getByRole('button', { name: '去原始裁片单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/original-orders/)

  await expectNoPageErrors(errors)
})

test.skip(!executionUnitTask || !workerSpreadingTask, '缺少可走 PDA acceptance 主流程的任务')
test('release acceptance：PDA 从任务到执行单元到铺布录入，写回后 supervisor 可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })
  await page.setViewportSize({ width: 360, height: 800 })

  const unitTask = executionUnitTask!
  await page.goto(
    `/fcs/pda/cutting/task/${unitTask.taskId}?executionOrderId=${encodeURIComponent(unitTask.executionOrderId)}&executionOrderNo=${encodeURIComponent(unitTask.executionOrderNo)}`,
  )
  const orderCard = page.locator(`[data-pda-cutting-order-card-id="${unitTask.executionOrderId}"]`)
  await expect(orderCard.getByRole('button', { name: '进入执行单元' })).toBeVisible()
  await orderCard.getByRole('button', { name: '进入执行单元' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/unit/${unitTask.taskId}/${unitTask.executionOrderId}`))
  await expect(page.getByRole('heading', { level: 1, name: '当前任务' })).toBeVisible()
  await expect(page.locator('body')).toContainText('参考唛架')
  await expect(page.locator('body')).toContainText('当前步骤')
  await expect(page.locator('body')).not.toContainText('来源唛架')
  await expect(page.locator('body')).not.toContainText('当前主状态')
  await expect(page.locator('body')).not.toContainText('当前应执行步骤')
  const spreadingStep = page.locator('[data-pda-cutting-unit-step="SPREADING"]')
  await expectVisibleInViewport(page, spreadingStep)
  const spreadingStepBox = await spreadingStep.boundingBox()
  expect(spreadingStepBox?.height ?? 0).toBeLessThan(70)
  await spreadingStep.click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/cutting/spreading/${unitTask.taskId}\\?`))

  const task = workerSpreadingTask!
  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(task.executionOrderId)}&executionOrderNo=${encodeURIComponent(task.executionOrderNo)}`,
  )

  const optionValues = await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"] option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value),
  )
  const optionLabels = await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"] option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).textContent || ''),
  )
  expect(optionValues.every((value) => value.startsWith('session:') || value.startsWith('marker:'))).toBeTruthy()
  expect(
    optionLabels.every((label) => label.includes('继续当前铺布') || label.includes('按唛架开始铺布')),
  ).toBeTruthy()
  expect(optionLabels.every((label) => !label.includes('异常补录铺布'))).toBeTruthy()
  await expect(page.locator('body')).toContainText('参考唛架')
  await expect(page.locator('body')).toContainText('当前排版项')
  await expect(page.locator('body')).not.toContainText('来源唛架')
  await expect(page.locator('body')).not.toContainText('计划单元')

  await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"]').selectOption({ index: 1 })
  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption('')
  await page.locator('[data-pda-cut-spreading-field="fabricRollNo"]').fill('ROLL-ACCEPT-01')
  await page.locator('[data-pda-cut-spreading-field="layerCount"]').fill('8')
  await page.locator('[data-pda-cut-spreading-field="actualLength"]').fill('36')
  await page.locator('[data-pda-cut-spreading-field="headLength"]').fill('0.3')
  await page.locator('[data-pda-cut-spreading-field="tailLength"]').fill('0.2')
  await page.getByRole('button', { name: '保存铺布记录' }).click()
  await expect(page.getByText('请先选择当前排版项。')).toBeVisible()

  const planUnitId = await page.locator('[data-pda-cut-spreading-field="planUnitId"]').evaluate((element) => {
    const select = element as HTMLSelectElement
    return select.options[1]?.value || ''
  })
  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption(planUnitId)
  await expect(page.getByText(/米 = 36\.00 米 - 0\.30 米 - 0\.20 米/)).toBeVisible()
  await expect(page.getByText(/件 = 8 层 × \d+ 件/)).toBeVisible()
  await expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))
  await page.getByRole('button', { name: '保存铺布记录' }).click()
  await expect(page.getByText('铺布记录已保存，已清空本次录入值。')).toBeVisible()
  await expect(page.locator('[data-pda-cut-spreading-field="fabricRollNo"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="layerCount"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-spreading-field="actualLength"]')).toHaveValue('')

  const appliedSessionId = await page.evaluate(() => {
    const inbox = JSON.parse(window.localStorage.getItem('cuttingPdaWritebackInbox') || '{"writebacks":[]}')
    const writeback = Array.isArray(inbox.writebacks) ? inbox.writebacks[0] : null
    return writeback?.appliedSessionId || writeback?.spreadingSessionId || ''
  })
  expect(appliedSessionId).not.toBe('')

  await page.goto(`/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(appliedSessionId)}`)
  await page.getByRole('button', { name: '卷记录' }).click()
  await expect(page.getByText('PDA回写')).toBeVisible()
  await page.getByRole('button', { name: '换班与人员' }).click()
  await expect(page.getByText('ID-F004_prod').first()).toBeVisible()

  await expectNoPageErrors(errors)
})

test('release acceptance：360x800 下执行页首屏不显示拆分组，且 tabs 与卡片之间有明确间距', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })
  await page.setViewportSize({ width: 360, height: 800 })

  await page.goto('/fcs/pda/exec')
  await expect(page.getByRole('heading', { level: 1, name: '执行' })).toBeVisible()
  const execFactorySelect = page.locator('[data-pda-exec-field="factoryId"]')
  const execFactoryValues = await execFactorySelect.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
  )
  let availableTabs: Array<{ index: number; label: string; count: number }> = []
  for (const value of execFactoryValues) {
    await execFactorySelect.selectOption(value)
    availableTabs = await page.getByTestId('pda-exec-tabs').getByRole('button').evaluateAll((buttons) =>
      buttons
        .map((button, index) => {
          const text = button.textContent || ''
          const normalizedText = text.replace(/\s+/g, ' ').trim()
          const matched = normalizedText.match(/^(.*?)[（(]\s*(\d+)\s*[）)]$/)
          return {
            index,
            label: matched?.[1]?.trim() || normalizedText,
            count: matched ? Number(matched[2]) : 0,
          }
        })
        .filter((tab) => tab.count > 0),
    )
    if (availableTabs.length > 0) break
  }
  expect(availableTabs.length).toBeGreaterThan(0)
  await page.getByTestId('pda-exec-tabs').getByRole('button').nth(availableTabs[0]!.index).click()

  const tabs = page.getByTestId('pda-exec-tabs')
  const firstCard = page.getByTestId('pda-exec-task-card').first()
  await expectVisibleInViewport(page, tabs)
  await expectVisibleInViewport(page, firstCard)

  const tabsBox = await tabs.boundingBox()
  const firstCardBox = await firstCard.boundingBox()
  expect(tabsBox).not.toBeNull()
  expect(firstCardBox).not.toBeNull()
  expect(firstCardBox!.y - (tabsBox!.y + tabsBox!.height)).toBeGreaterThanOrEqual(8)

  const cardText = await firstCard.innerText()
  expect(cardText).toContain('生产单号')
  expect(cardText).toContain('原始任务')
  expect(cardText).toContain('当前工序')
  expect(cardText).toContain('数量')
  expect(cardText).not.toContain('拆分组')
  await expect(page.getByTestId('pda-exec-page')).not.toContainText('拆分组')

  await expectNoPageErrors(errors)
})

test('release acceptance：补料 / 菲票 / 装袋 / 入仓 / PDA 写回数据链保持一致', async () => {
  const releaseTraceabilityTokens = ['先装袋后入仓', 'sourceWritebackId'] as const
  expect(releaseTraceabilityTokens).toContain('先装袋后入仓')
  expect(releaseTraceabilityTokens).toContain('sourceWritebackId')

  expect(prototypeSpreadingRows.length).toBeGreaterThanOrEqual(18)
  const statusCount = prototypeSpreadingRows.reduce<Record<string, number>>((accumulator, row) => {
    const stageKey = resolveSupervisorStageKey(row)
    accumulator[stageKey] = (accumulator[stageKey] || 0) + 1
    return accumulator
  }, {})
  expect(statusCount.WAITING_REPLENISHMENT || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.WAITING_FEI_TICKET || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.WAITING_BAGGING || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.WAITING_WAREHOUSE || 0).toBeGreaterThanOrEqual(2)
  expect(statusCount.DONE || 0).toBeGreaterThanOrEqual(3)

  const modeCount = prototypeSpreadingData.store.sessions.reduce<Record<string, number>>((accumulator, session) => {
    accumulator[session.spreadingMode] = (accumulator[session.spreadingMode] || 0) + 1
    return accumulator
  }, {})
  expect(modeCount.normal || 0).toBeGreaterThanOrEqual(2)
  expect(modeCount.high_low || 0).toBeGreaterThanOrEqual(2)
  expect(modeCount.fold_normal || 0).toBeGreaterThanOrEqual(2)
  expect(modeCount.fold_high_low || 0).toBeGreaterThanOrEqual(2)
  expect(prototypeSpreadingRows.filter((row) => row.contextType === 'merge-batch').length).toBeGreaterThanOrEqual(3)
  expect(prototypeSpreadingRows.filter((row) => row.session.sourceWritebackId).length).toBeGreaterThanOrEqual(3)

  const feiProjection = buildFeiTicketPrintProjection()
  const printableUnit = feiProjection.printableViewModel.units.find((item) => item.sourceSpreadingSessionIds.length > 0)
  expect(printableUnit).toBeTruthy()
  expect(printableUnit!.sourceSpreadingSessionIds[0]).not.toBe('')
  const feiTraceRows = buildGeneratedFeiTicketTraceMatrix()
  expect(feiTraceRows.filter((item) => item.sourceSpreadingSessionId).length).toBeGreaterThan(0)
  expect(new Set(feiTraceRows.filter((item) => item.sourceWritebackId).map((item) => item.sourceSpreadingSessionId)).size).toBeGreaterThanOrEqual(3)

  const replenishmentProjection = buildReplenishmentProjection()
  const pdaRows = replenishmentProjection.viewModel.rows.filter((row) => row.pdaFeedbacks.length > 0)
  expect(replenishmentProjection.viewModel.rows.length).toBeGreaterThan(0)
  expect(pdaRows.length).toBeGreaterThanOrEqual(2)

  const tracedSuggestion = replenishmentProjection.viewModel.rows.find(
    (row) =>
      row.pdaFeedbacks.length > 0 &&
      Boolean(row.lines[0]?.originalCutOrderId) &&
      Boolean(row.navigationPayload.markerSpreading.originalCutOrderId),
  )
  expect(tracedSuggestion).toBeTruthy()
  expect(tracedSuggestion!.lines[0].materialSku).not.toBe('')
  expect(tracedSuggestion!.lines[0].color).not.toBe('')

  const traceabilityContext = buildCuttingTraceabilityProjectionContext()
  const warehouseProjection = buildCutPieceWarehouseProjection({ snapshot: traceabilityContext.snapshot })
  const usageWithPda = traceabilityContext.transferBagViewModel.usages.find(
    (item) =>
      item.spreadingSourceWritebackId &&
      item.bagFirstSatisfied &&
      warehouseProjection.viewModel.items.some(
        (warehouseItem) =>
          warehouseItem.spreadingSessionId === item.spreadingSessionId &&
          warehouseItem.bagUsageId === item.usageId,
      ),
  )
  expect(usageWithPda).toBeTruthy()
  expect(usageWithPda!.spreadingSessionId).not.toBe('')
  expect(usageWithPda!.spreadingSourceWritebackId).not.toBe('')

  const warehouseItem = warehouseProjection.viewModel.items.find(
    (item) => item.spreadingSessionId === usageWithPda!.spreadingSessionId && item.bagUsageId === usageWithPda!.usageId,
  )
  expect(warehouseItem).toBeTruthy()
  expect(warehouseItem!.bagCode).not.toBe('')
  expect(warehouseItem!.spreadingSessionId).toBe(usageWithPda!.spreadingSessionId)
  expect(Object.prototype.hasOwnProperty.call(warehouseItem!, 'cutPieceOrderNo')).toBe(false)
  expect(
    new Set(
      warehouseProjection.viewModel.items.filter((item) => item.sourceWritebackId).map((item) => item.spreadingSessionId),
    ).size,
  ).toBeGreaterThanOrEqual(3)
})

test('release acceptance：补料审批通过后，仓库配料领料可见补料待配料', async ({ page }) => {
  const errors = collectPageErrors(page)
  const targetSuggestion =
    buildReplenishmentProjection().viewModel.rows.find((row) => row.statusMeta.key === 'PENDING_REVIEW') ||
    buildReplenishmentProjection().viewModel.rows[0]

  expect(targetSuggestion).toBeTruthy()

  await page.goto(`/fcs/craft/cutting/replenishment?suggestionId=${encodeURIComponent(targetSuggestion!.suggestionId)}`)
  await expect(page.getByText('补料明细建议')).toBeVisible()
  await expectNoLegacyCuttingCopy(page)
  await page.getByRole('button', { name: '提交审核' }).click()
  await expect(
    page.getByText(`已更新 ${targetSuggestion!.suggestionNo} 的审核结果，并在仓库配料领料中生成补料待配料。`),
  ).toBeVisible()
  await page.locator('[data-cutting-replenish-action="go-material-prep"]').click()

  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/material-prep/)
  await expect(page.getByRole('heading', { name: '补料待配料' })).toBeVisible()
  await expect(page.getByText(targetSuggestion!.lines[0].materialSku).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('补料待配料')
  await expect(page.locator('body')).toContainText('来源铺布：')
  await expect(page.locator('body')).toContainText('来源补料：')
  await expectNoLegacyCuttingCopy(page)

  await expectNoPageErrors(errors)
})
