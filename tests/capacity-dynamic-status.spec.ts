import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  buildFactoryCalendarData,
  buildCapacityRiskData,
  buildCapacityBottleneckData,
  summarizeProductionOrderRisk,
  type FactoryCalendarRow,
  type TaskSamRiskConclusion,
} from '../src/data/fcs/capacity-calendar.ts'
import {
  candidateFactories,
  createDispatchCapacityEvaluationContext,
  hasTender,
  resolveTaskFactoryCapacityConstraint,
  resolveAllocatableGroupFactoryCapacityConstraint,
  resolveTenderFactoryCapacityConstraint,
  type DispatchTask,
} from '../src/pages/dispatch-board/context.ts'
import {
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  listRuntimeTaskAllocatableGroups,
  type RuntimeTaskAllocatableGroup,
} from '../src/data/fcs/runtime-process-tasks.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

type CalendarStatus = 'NORMAL' | 'TIGHT' | 'OVERLOADED' | 'PAUSED'

interface FactoryCalendarStatusSample {
  row: FactoryCalendarRow
}

interface CandidateStatusScenario {
  task: DispatchTask
  byStatus: Partial<Record<'NORMAL' | 'TIGHT' | 'OVERLOADED' | 'PAUSED' | 'DATE_INCOMPLETE', { id: string; name: string }>>
}

interface DetailCandidateStatusScenario extends CandidateStatusScenario {
  group: RuntimeTaskAllocatableGroup
}

const executionTasks = listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))
const capacityContext = createDispatchCapacityEvaluationContext()

function getVisibleTaskRef(task: { taskNo?: string | null; taskId: string }): string {
  return task.taskNo ?? task.taskId
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildFactoryCalendarStatusSamples(): Record<CalendarStatus, FactoryCalendarStatusSample> {
  const samples = {} as Record<CalendarStatus, FactoryCalendarStatusSample>
  const remaining = new Set<CalendarStatus>(['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])

  for (const factory of listFactoryMasterRecords()) {
    const data = buildFactoryCalendarData({
      factoryId: factory.id,
    })
    for (const row of data.rows) {
      if (remaining.has(row.status)) {
        samples[row.status] = { row }
        remaining.delete(row.status)
      }
    }
  }

  if (remaining.size > 0) {
    for (const status of remaining) {
      throw new Error(`工厂日历缺少 ${status} 状态样例`)
    }
  }

  return samples
}

function collectTaskScenario(
  task: DispatchTask,
  resolver: (task: DispatchTask, factoryId: string, factoryName: string) => { status: string } | null,
): CandidateStatusScenario {
  const byStatus: CandidateStatusScenario['byStatus'] = {}

  for (const factory of candidateFactories) {
    const snapshot = resolver(task, factory.id, factory.name)
    if (!snapshot) continue
    if (!byStatus[snapshot.status as keyof typeof byStatus]) {
      byStatus[snapshot.status as keyof typeof byStatus] = { id: factory.id, name: factory.name }
    }
  }

  return { task, byStatus }
}

function hasRequiredStatuses(
  scenario: CandidateStatusScenario,
  statuses: Array<'NORMAL' | 'TIGHT' | 'OVERLOADED' | 'PAUSED'>,
): boolean {
  return statuses.every((status) => Boolean(scenario.byStatus[status]))
}

function findWholeDispatchScenario(): CandidateStatusScenario {
  const task = executionTasks.find((item) => {
    if (item.assignmentMode === 'BIDDING') return false
    const scenario = collectTaskScenario(item, (task, factoryId, factoryName) =>
      resolveTaskFactoryCapacityConstraint(task, factoryId, factoryName, capacityContext),
    )
    return hasRequiredStatuses(scenario, ['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])
  })

  if (!task) throw new Error('缺少整任务直接派单的动态状态样例')

  return collectTaskScenario(task, (currentTask, factoryId, factoryName) =>
    resolveTaskFactoryCapacityConstraint(currentTask, factoryId, factoryName, capacityContext),
  )
}

function findDateIncompleteDispatchScenario(): CandidateStatusScenario {
  const task = executionTasks.find((item) => {
    if (item.assignmentMode === 'BIDDING') return false
    const scenario = collectTaskScenario(item, (task, factoryId, factoryName) =>
      resolveTaskFactoryCapacityConstraint(task, factoryId, factoryName, capacityContext),
    )
    return Boolean(scenario.byStatus.DATE_INCOMPLETE)
  })

  if (!task) throw new Error('缺少日期不足的直接派单样例')

  return collectTaskScenario(task, (currentTask, factoryId, factoryName) =>
    resolveTaskFactoryCapacityConstraint(currentTask, factoryId, factoryName, capacityContext),
  )
}

function findWholeTenderScenario(): CandidateStatusScenario {
  const task = executionTasks.find((item) => {
    if (hasTender(item)) return false
    const scenario = collectTaskScenario(item, (task, factoryId, factoryName) =>
      resolveTenderFactoryCapacityConstraint(task, factoryId, factoryName, [], capacityContext),
    )
    return hasRequiredStatuses(scenario, ['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])
  })

  if (!task) throw new Error('缺少整任务创建招标单的动态状态样例')

  return collectTaskScenario(task, (currentTask, factoryId, factoryName) =>
    resolveTenderFactoryCapacityConstraint(currentTask, factoryId, factoryName, [], capacityContext),
  )
}

function findDateIncompleteTenderScenario(): CandidateStatusScenario {
  const task = executionTasks.find((item) => {
    if (hasTender(item)) return false
    const scenario = collectTaskScenario(item, (task, factoryId, factoryName) =>
      resolveTenderFactoryCapacityConstraint(task, factoryId, factoryName, [], capacityContext),
    )
    return Boolean(scenario.byStatus.DATE_INCOMPLETE)
  })

  if (!task) throw new Error('缺少日期不足的创建招标单样例')

  return collectTaskScenario(task, (currentTask, factoryId, factoryName) =>
    resolveTenderFactoryCapacityConstraint(currentTask, factoryId, factoryName, [], capacityContext),
  )
}

function findDetailScenario(): DetailCandidateStatusScenario {
  for (const task of executionTasks) {
    if (itemHasTenderOrBidding(task)) continue
    const groups = listRuntimeTaskAllocatableGroups(task.taskId)
    for (const group of groups) {
      const byStatus: DetailCandidateStatusScenario['byStatus'] = {}
      for (const factory of candidateFactories) {
        const snapshot = resolveAllocatableGroupFactoryCapacityConstraint(
          task,
          group,
          factory.id,
          factory.name,
          capacityContext,
        )
        if (!snapshot) continue
        if (!byStatus[snapshot.status as keyof typeof byStatus]) {
          byStatus[snapshot.status as keyof typeof byStatus] = { id: factory.id, name: factory.name }
        }
      }
      const scenario: DetailCandidateStatusScenario = { task, group, byStatus }
      if (hasRequiredStatuses(scenario, ['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])) {
        return scenario
      }
    }
  }

  throw new Error('缺少按明细逐组动态状态样例')
}

function itemHasTenderOrBidding(task: DispatchTask): boolean {
  return task.assignmentMode === 'BIDDING' || hasTender(task)
}

const calendarStatusSamples = buildFactoryCalendarStatusSamples()
const riskRows = buildCapacityRiskData().taskRows
const riskConclusionSamples = {
  CAPABLE: riskRows.find((row) => row.conclusion === 'CAPABLE'),
  TIGHT: riskRows.find((row) => row.conclusion === 'TIGHT'),
  EXCEEDS_WINDOW: riskRows.find((row) => row.conclusion === 'EXCEEDS_WINDOW'),
  PAUSED: riskRows.find((row) => row.conclusion === 'PAUSED'),
  FROZEN_PENDING: riskRows.find((row) => row.conclusion === 'FROZEN_PENDING'),
  UNALLOCATED: riskRows.find((row) => row.conclusion === 'UNALLOCATED'),
  UNSCHEDULED: riskRows.find((row) => row.conclusion === 'UNSCHEDULED'),
} satisfies Record<TaskSamRiskConclusion, (typeof riskRows)[number] | undefined>

for (const [conclusion, row] of Object.entries(riskConclusionSamples)) {
  if (!row) throw new Error(`缺少风险结论样例：${conclusion}`)
}

const riskOrderRows = summarizeProductionOrderRisk(riskRows)
const frozenPendingOrderRisk = riskOrderRows.find((row) => row.frozenPendingStandardTime > 0)
if (!frozenPendingOrderRisk) {
  throw new Error('缺少已冻结待确认生产单风险样例')
}

const bottleneck = buildCapacityBottleneckData()
const craftPausedRow = bottleneck.craftRows.find((row) => row.pausedDayCount > 0)
const craftTightRow = bottleneck.craftRows.find((row) => row.tightDayCount > 0)
const craftOverloadedRow = bottleneck.craftRows.find((row) => row.overloadDayCount > 0)
const craftUnallocatedRow = bottleneck.craftRows.find((row) => row.unallocatedSam > 0)
const datePausedRow = bottleneck.dateRows.find((row) => row.pausedFactoryCount > 0)
const dateTightRow = bottleneck.dateRows.find((row) => row.tightCraftCount > 0)
const dateOverloadedRow = bottleneck.dateRows.find((row) => row.overloadedFactoryCount > 0)
const unallocatedFrozenRow = bottleneck.unallocatedRows.find((row) => row.assignmentStatusLabel === '已冻结待确认')
const unscheduledRow = bottleneck.unscheduledRows[0]

if (!craftPausedRow || !craftTightRow || !craftOverloadedRow || !craftUnallocatedRow) {
  throw new Error('工艺瓶颈页缺少暂停/紧张/超载/待分配样例')
}
if (!datePausedRow || !dateTightRow || !dateOverloadedRow) {
  throw new Error('日期瓶颈页缺少暂停/紧张/超载样例')
}
if (!unallocatedFrozenRow || !unscheduledRow) {
  throw new Error('待分配 / 未排期页缺少样例')
}

const wholeDispatchScenario = findWholeDispatchScenario()
const dateIncompleteDispatchScenario = findDateIncompleteDispatchScenario()
const wholeTenderScenario = findWholeTenderScenario()
const dateIncompleteTenderScenario = findDateIncompleteTenderScenario()
const detailScenario = findDetailScenario()

async function switchToListView(page: Page): Promise<void> {
  await page.locator('[data-dispatch-action="switch-view"][data-view="list"]').click()
}

async function searchTask(page: Page, taskRef: string): Promise<void> {
  await page.locator('[data-dispatch-field="filter.keyword"]').fill(taskRef)
}

async function openRowMenu(page: Page, taskRef: string): Promise<Locator> {
  await searchTask(page, taskRef)
  const row = page.locator('tbody tr').filter({ hasText: taskRef }).first()
  await expect(row).toBeVisible()
  await row.locator('[data-dispatch-action="toggle-row-menu"]').click()
  const menu = row.locator('div.absolute').first()
  await expect(menu).toBeVisible()
  return menu
}

async function expectSelectOptionState(select: Locator, value: string, disabled: boolean): Promise<void> {
  const option = select.locator(`option[value="${value}"]`)
  await expect(option).toHaveCount(1)
  expect((await option.getAttribute('disabled')) != null).toBe(disabled)
}

async function getSelectOptionValueByStatus(select: Locator, statusLabel: string, disabled: boolean): Promise<string> {
  const options = await select.locator('option').evaluateAll(
    (nodes, input) =>
      nodes
        .map((node) => ({
          value: node.getAttribute('value') ?? '',
          text: node.textContent ?? '',
          disabled: Boolean((node as HTMLOptionElement).disabled),
        }))
        .filter((option) => option.value && option.text.includes(`（${input.statusLabel}）`) && option.disabled === input.disabled)
        .map((option) => option.value),
    { statusLabel, disabled },
  )

  expect(options.length, `未找到 ${disabled ? '禁用' : '可用'}的 ${statusLabel} 工厂选项`).toBeGreaterThan(0)
  return options[0]
}

test('产能日历页面已经接入正常/紧张/超载/暂停动态状态，并同步到风险与瓶颈视角', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/capacity/constraints')
  await expect(page.getByRole('heading', { name: '工厂日历', exact: true })).toBeVisible()

  const statusLabelMap: Record<CalendarStatus, string> = {
    NORMAL: '正常',
    TIGHT: '紧张',
    OVERLOADED: '超载',
    PAUSED: '暂停',
  }

  for (const [status, sample] of Object.entries(calendarStatusSamples) as Array<[CalendarStatus, FactoryCalendarStatusSample]>) {
    await page.locator('[data-capacity-filter="constraints-factory-id"]').selectOption(sample.row.factoryId)
    await page.locator('[data-capacity-filter="constraints-process-code"]').selectOption(sample.row.processCode)
    await page.locator('[data-capacity-filter="constraints-craft-code"]').selectOption(`${sample.row.processCode}::${sample.row.craftCode}`)
    const row = page.locator(`[data-row-key="${sample.row.rowKey}"]`)
    await expect(row).toBeVisible()
    await expect(row).toContainText(statusLabelMap[status])
    await row.click()
    await expect(page.locator('[data-testid="factory-calendar-detail-status"]')).toContainText(statusLabelMap[status])
  }

  await page.goto('/fcs/capacity/risk')
  await expect(page.getByRole('heading', { name: '任务工时风险', exact: true })).toBeVisible()
  await expect(page.locator('[data-capacity-risk-kpis]')).toContainText('暂停任务数')
  await page.locator('[data-capacity-filter="risk-window-days"]').selectOption('15')
  await page.locator('[data-capacity-filter="risk-process-code"]').selectOption('')
  await page.locator('[data-capacity-filter="risk-craft-code"]').selectOption('')

  for (const conclusion of ['TIGHT', 'EXCEEDS_WINDOW'] as const) {
    const sample = riskConclusionSamples[conclusion]!
    await page.locator('[data-capacity-filter="risk-process-code"]').selectOption('')
    await page.locator('[data-capacity-filter="risk-craft-code"]').selectOption('')
    await page.locator('[data-capacity-filter="risk-keyword"]').fill('')
    await page.locator('[data-capacity-filter="risk-conclusion"]').selectOption(conclusion)
    const row = page.locator('[data-capacity-risk-task-table] tbody tr').first()
    await expect(row).toBeVisible()
    await expect(row).toContainText(sample.conclusionLabel)
  }

  await page.locator('[data-capacity-filter="risk-keyword"]').fill(frozenPendingOrderRisk.productionOrderId)
  await page.locator('[data-capacity-filter="risk-conclusion"]').selectOption('')
  await page.locator('[data-page="risk"][data-tab="order"]').click()
  await expect(page.locator('[data-capacity-risk-order-table]')).toContainText('已冻结待确认标准工时')
  const orderRow = page.locator('[data-capacity-risk-order-table] tbody tr').filter({ hasText: frozenPendingOrderRisk.productionOrderId }).first()
  await expect(orderRow).toBeVisible()
  await expect(orderRow).toContainText('已冻结待确认')

  await page.goto('/fcs/capacity/bottleneck')
  await expect(page.getByRole('heading', { name: '工艺瓶颈与待分配', exact: true })).toBeVisible()
  await expect(page.locator('[data-bottleneck-craft-table]')).toContainText('暂停天数')
  await page.locator('[data-capacity-filter="bottleneck-keyword"]').fill(craftPausedRow.craftName)
  await expect(page.locator('[data-bottleneck-craft-table] tbody tr').filter({ hasText: craftPausedRow.craftName }).first()).toBeVisible()

  await page.locator('[data-page="bottleneck"][data-tab="date"]').click()
  await page.locator('[data-capacity-filter="bottleneck-keyword"]').fill(datePausedRow.date)
  const dateRow = page.locator('[data-bottleneck-date-table] tbody tr').filter({ hasText: datePausedRow.date }).first()
  await expect(dateRow).toBeVisible()
  await expect(page.locator('[data-bottleneck-date-table]')).toContainText('当日暂停工厂数')

  await page.locator('[data-page="bottleneck"][data-tab="demand"]').click()
  await page.locator('[data-capacity-filter="bottleneck-keyword"]').fill(unallocatedFrozenRow.taskId)
  await expect(page.locator('[data-testid="bottleneck-unallocated-section"]')).toContainText('已冻结待确认')
  await page.locator('[data-capacity-filter="bottleneck-keyword"]').fill(unscheduledRow.taskId)
  await expect(page.locator('[data-testid="bottleneck-unscheduled-section"]')).toContainText(unscheduledRow.taskId)

  await expectNoPageErrors(errors)
})

test('直接派单和创建招标单已经真正消费动态状态，并支持整任务与按明细逐组判断', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/dispatch/board')
  await switchToListView(page)

  const wholeDispatchTaskRef = getVisibleTaskRef(wholeDispatchScenario.task)
  const wholeDispatchMenu = await openRowMenu(page, wholeDispatchTaskRef)
  await wholeDispatchMenu.getByRole('button', { name: '直接派单', exact: true }).click()
  const dispatchDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '直接派单' }).first()
  await expect(dispatchDialog).toBeVisible()
  if (await dispatchDialog.locator('[data-dispatch-mode="TASK"]').count()) {
    await dispatchDialog.locator('[data-dispatch-mode="TASK"]').click()
  }
  const factorySelect = dispatchDialog.locator('[data-dispatch-field="dispatch.factoryId"]')
  await expectSelectOptionState(factorySelect, wholeDispatchScenario.byStatus.NORMAL!.id, false)
  await expectSelectOptionState(factorySelect, wholeDispatchScenario.byStatus.TIGHT!.id, false)
  await expectSelectOptionState(factorySelect, wholeDispatchScenario.byStatus.OVERLOADED!.id, true)
  await expectSelectOptionState(factorySelect, wholeDispatchScenario.byStatus.PAUSED!.id, true)
  await factorySelect.selectOption(wholeDispatchScenario.byStatus.TIGHT!.id)
  await expect(dispatchDialog.locator('[data-dispatch-task-constraint="selected-factory"]')).toContainText('当前窗口紧张，可选但需预警')
  await dispatchDialog.getByLabel('关闭').click()
  await expect(dispatchDialog).toBeHidden()

  const dateIncompleteTaskRef = getVisibleTaskRef(dateIncompleteDispatchScenario.task)
  const dateIncompleteMenu = await openRowMenu(page, dateIncompleteTaskRef)
  await dateIncompleteMenu.getByRole('button', { name: '直接派单', exact: true }).click()
  const dateIncompleteDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '直接派单' }).first()
  await expect(dateIncompleteDialog).toBeVisible()
  if (await dateIncompleteDialog.locator('[data-dispatch-mode="TASK"]').count()) {
    await dateIncompleteDialog.locator('[data-dispatch-mode="TASK"]').click()
  }
  await dateIncompleteDialog
    .locator('[data-dispatch-field="dispatch.factoryId"]')
    .selectOption(dateIncompleteDispatchScenario.byStatus.DATE_INCOMPLETE!.id)
  await expect(dateIncompleteDialog.locator('[data-dispatch-task-constraint="selected-factory"]')).toContainText('日期不足，仅提示无法完全校验')
  await dateIncompleteDialog.getByLabel('关闭').click()
  await expect(dateIncompleteDialog).toBeHidden()

  const detailTaskRef = getVisibleTaskRef(detailScenario.task)
  const detailMenu = await openRowMenu(page, detailTaskRef)
  await detailMenu.getByRole('button', { name: '直接派单', exact: true }).click()
  const detailDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '直接派单' }).first()
  await expect(detailDialog).toBeVisible()
  await detailDialog.locator('[data-dispatch-mode="DETAIL"]').click()
  const groupRow = detailDialog.locator(`[data-dispatch-group="${detailScenario.group.groupKey}"]`)
  await expect(groupRow).toBeVisible()
  const groupSelect = groupRow.locator('[data-dispatch-field="dispatch.groupFactoryId"]')
  await expectSelectOptionState(groupSelect, detailScenario.byStatus.NORMAL!.id, false)
  await expectSelectOptionState(groupSelect, detailScenario.byStatus.TIGHT!.id, false)
  await expectSelectOptionState(groupSelect, detailScenario.byStatus.OVERLOADED!.id, true)
  await expectSelectOptionState(groupSelect, detailScenario.byStatus.PAUSED!.id, true)
  await groupSelect.selectOption(detailScenario.byStatus.TIGHT!.id)
  await expect(detailDialog.locator(`[data-dispatch-group-constraint="${detailScenario.group.groupKey}"]`)).toContainText('当前窗口紧张，可选但需预警')
  await detailDialog.getByLabel('关闭').click()
  await expect(detailDialog).toBeHidden()

  const wholeTenderTaskRef = getVisibleTaskRef(wholeTenderScenario.task)
  const tenderMenu = await openRowMenu(page, wholeTenderTaskRef)
  await tenderMenu.getByRole('button', { name: '创建招标单', exact: true }).click()
  const tenderSheet = page.locator('[data-tender-sheet="true"]').first()
  await expect(tenderSheet).toBeVisible()
  if (await tenderSheet.locator('[data-tender-mode="TASK"]').count()) {
    await tenderSheet.locator('[data-tender-mode="TASK"]').click()
  }
  await expect(tenderSheet.locator('[data-tender-factory-status="NORMAL"]:not([disabled])').first()).toBeVisible()
  await expect(tenderSheet.locator('[data-tender-factory-status="TIGHT"]:not([disabled])').first()).toBeVisible()
  await expect(tenderSheet.locator('[data-tender-factory-status="OVERLOADED"][disabled]').first()).toBeVisible()
  await expect(tenderSheet.locator('[data-tender-factory-status="PAUSED"][disabled]').first()).toBeVisible()
  await expect(tenderSheet.locator('[data-tender-factory-status="TIGHT"]').first()).toContainText('当前窗口紧张，可选但需预警')
  await tenderSheet.locator('[data-dispatch-action="close-create-tender"]').first().click()
  await expect(tenderSheet).toBeHidden()

  const dateTenderTaskRef = getVisibleTaskRef(dateIncompleteTenderScenario.task)
  const dateTenderMenu = await openRowMenu(page, dateTenderTaskRef)
  await dateTenderMenu.getByRole('button', { name: '创建招标单', exact: true }).click()
  const dateTenderSheet = page.locator('[data-tender-sheet="true"]').first()
  await expect(dateTenderSheet).toBeVisible()
  if (await dateTenderSheet.locator('[data-tender-mode="TASK"]').count()) {
    await dateTenderSheet.locator('[data-tender-mode="TASK"]').click()
  }
  await expect(dateTenderSheet.locator('[data-tender-factory-status="DATE_INCOMPLETE"]:not([disabled])').first()).toBeVisible()
  await expect(dateTenderSheet.locator('[data-tender-factory-status="DATE_INCOMPLETE"]').first()).toContainText('日期不足，仅提示无法完全校验')
  await dateTenderSheet.locator('[data-dispatch-action="close-create-tender"]').first().click()
  await expect(dateTenderSheet).toBeHidden()

  const detailTenderMenu = await openRowMenu(page, detailTaskRef)
  await detailTenderMenu.getByRole('button', { name: '创建招标单', exact: true }).click()
  const detailTenderSheet = page.locator('[data-tender-sheet="true"]').first()
  await expect(detailTenderSheet).toBeVisible()
  await detailTenderSheet.locator('[data-tender-mode="DETAIL"]').click()
  const detailTenderGroupStatuses = detailTenderSheet.locator(`[data-tender-factory-group-status$=":${detailScenario.group.groupKey}"]`)
  await expect(detailTenderGroupStatuses.filter({ hasText: '当前窗口紧张，可选但需预警' }).first()).toBeVisible()
  await expect(detailTenderGroupStatuses.filter({ hasText: '当前窗口超载，不可选' }).first()).toBeVisible()
  await expect(detailTenderGroupStatuses.filter({ hasText: '当前窗口暂停，不可选' }).first()).toBeVisible()
  await detailTenderSheet.locator('[data-dispatch-action="close-create-tender"]').first().click()
  await expect(detailTenderSheet).toBeHidden()

  await expectNoPageErrors(errors)
})
