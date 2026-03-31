import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  listRuntimeTaskAllocatableGroups,
} from '../src/data/fcs/runtime-process-tasks.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const executionTasks = listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))

const detailCapableTasks = executionTasks
  .filter((task) => {
    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    const isHold = lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配'
    return task.assignmentStatus === 'UNASSIGNED' && !isHold && listRuntimeTaskAllocatableGroups(task.taskId).length > 1
  })

const singleScopeTasks = executionTasks.filter((task) => listRuntimeTaskAllocatableGroups(task.taskId).length === 1)

const detailDirectTask = detailCapableTasks[0]
const detailTenderTask = detailCapableTasks[1]
const wholeDirectTask = singleScopeTasks.find((task) => task.assignmentMode === 'DIRECT')
const wholeTenderTask = singleScopeTasks.find(
  (task) =>
    task.taskId !== wholeDirectTask?.taskId &&
    task.assignmentMode !== 'BIDDING',
)

if (!detailDirectTask || !detailTenderTask || !wholeDirectTask || !wholeTenderTask) {
  throw new Error('任务分配验收缺少所需的整任务/按明细测试种子')
}

function getVisibleTaskRef(task: { taskNo?: string | null; taskId: string }): string {
  return task.taskNo ?? task.taskId
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const STATUS_KEYS = [
  'UNASSIGNED',
  'DIRECT_ASSIGNED',
  'BIDDING',
  'AWAIT_AWARD',
  'AWARDED',
  'HOLD',
  'EXCEPTION',
] as const

function getSearch(page: Page): Locator {
  return page.locator('[data-dispatch-field="filter.keyword"]')
}

async function searchTask(page: Page, taskRef: string): Promise<void> {
  await getSearch(page).fill(taskRef)
}

async function clearSearch(page: Page): Promise<void> {
  await getSearch(page).fill('')
}

async function switchToListView(page: Page): Promise<void> {
  await page.locator('[data-dispatch-action="switch-view"][data-view="list"]').click()
}

async function getRowByTaskRef(page: Page, taskRef: string): Promise<Locator> {
  const row = page.locator('tbody tr').filter({ hasText: taskRef }).first()
  await expect(row).toBeVisible()
  return row
}

async function openRowMenu(page: Page, taskRef: string): Promise<Locator> {
  await searchTask(page, taskRef)
  const row = await getRowByTaskRef(page, taskRef)
  await row.locator('[data-dispatch-action="toggle-row-menu"]').click()
  const menu = row.locator('div.absolute').first()
  await expect(menu).toBeVisible()
  return menu
}

async function fillDispatchCommonFields(dialog: Locator): Promise<void> {
  const priceInput = dialog.locator('[data-dispatch-field="dispatch.dispatchPrice"]')
  const pricePlaceholder = (await priceInput.getAttribute('placeholder')) ?? '10000'
  await dialog.locator('[data-dispatch-field="dispatch.acceptDeadline"]').fill('2026-04-20T12:00')
  await dialog.locator('[data-dispatch-field="dispatch.taskDeadline"]').fill('2026-04-28T18:00')
  await priceInput.fill(pricePlaceholder)
}

async function selectFirstAvailableOption(select: Locator): Promise<void> {
  const options = await listSelectableValues(select)
  expect(options.length).toBeGreaterThan(0)
  await select.selectOption(options[0]!)
}

async function listSelectableValues(select: Locator): Promise<string[]> {
  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes
      .map((node) => (node as HTMLOptionElement).value)
      .filter((value) => value && value !== ''),
  )
  return options
}

async function fillTenderCommonFields(sheet: Locator): Promise<void> {
  await sheet.locator('[data-dispatch-action="select-all-pool"]').click()
  await sheet.locator('[data-dispatch-field="tender.minPrice"]').fill('12000')
  await sheet.locator('[data-dispatch-field="tender.maxPrice"]').fill('16000')
  await sheet.locator('[data-dispatch-field="tender.biddingDeadline"]').fill('2026-04-18T18:00')
  await sheet.locator('[data-dispatch-field="tender.taskDeadline"]').fill('2026-04-26T18:00')
}

test('任务分配页面的 7 个状态都有真实数据，异常不会吞掉全部任务，独立按明细入口已移除', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/dispatch/board')
  await expect(page.getByRole('heading', { name: '任务分配', exact: true })).toBeVisible()

  for (const statusKey of STATUS_KEYS) {
    const statCard = page.locator(`[data-dispatch-stat-card="${statusKey}"]`)
    await expect(statCard).toBeVisible()
    const countText = (await statCard.locator('p').first().textContent())?.trim() ?? '0'
    expect(Number(countText)).toBeGreaterThan(0)

    const column = page.locator(`[data-dispatch-kanban-column="${statusKey}"]`)
    await expect(column).toBeVisible()
    await expect(column.locator('article')).toHaveCount(Number(countText))
  }

  await expect(page.getByRole('button', { name: '按明细分配', exact: true })).toHaveCount(0)

  await switchToListView(page)
  const menu = await openRowMenu(page, getVisibleTaskRef(detailDirectTask))
  await expect(menu).not.toContainText('按明细分配')
  await expectNoPageErrors(errors)
})

test('直接派单和创建招标单都已收口为整任务/按明细两种模式，并复用明细分组能力', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.goto('/fcs/dispatch/board')
  await switchToListView(page)

  const wholeDirectMenu = await openRowMenu(page, getVisibleTaskRef(wholeDirectTask))
  await wholeDirectMenu.getByRole('button', { name: '直接派单', exact: true }).click()
  const directDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '直接派单' }).first()
  await expect(directDialog).toBeVisible()
  await expect(directDialog.locator('[data-dispatch-mode="DETAIL"]')).toHaveCount(0)
  await expect(directDialog).toContainText('当前任务仅支持整任务派单')
  await fillDispatchCommonFields(directDialog)
  await selectFirstAvailableOption(directDialog.locator('[data-dispatch-field="dispatch.factoryId"]'))
  await directDialog.locator('[data-dispatch-action="confirm-direct-dispatch"]').click()
  await expect(directDialog).toBeHidden()

  const detailDirectMenu = await openRowMenu(page, getVisibleTaskRef(detailDirectTask))
  await detailDirectMenu.getByRole('button', { name: '直接派单', exact: true }).click()
  const detailDispatchDialog = page.locator('[data-dialog-panel="true"]').filter({ hasText: '直接派单' }).first()
  await expect(detailDispatchDialog.locator('[data-dispatch-mode="TASK"]')).toBeVisible()
  await expect(detailDispatchDialog.locator('[data-dispatch-mode="DETAIL"]')).toBeVisible()
  await detailDispatchDialog.locator('[data-dispatch-mode="DETAIL"]').click()
  await expect(detailDispatchDialog.locator('[data-dispatch-group]')).toHaveCount(listRuntimeTaskAllocatableGroups(detailDirectTask.taskId).length)
  await fillDispatchCommonFields(detailDispatchDialog)
  const groupSelects = detailDispatchDialog.locator('[data-dispatch-field="dispatch.groupFactoryId"]')
  const groupCount = await groupSelects.count()
  const primaryOptions = await listSelectableValues(groupSelects.first())
  expect(primaryOptions.length).toBeGreaterThan(1)
  const primaryFactoryId = primaryOptions[0]
  const secondaryFactoryId = primaryOptions[1] ?? primaryOptions[0]
  expect(primaryFactoryId).toBeTruthy()
  for (let index = 0; index < groupCount; index += 1) {
    const candidateValues = await listSelectableValues(groupSelects.nth(index))
    const selectedValue = index === 0 ? primaryFactoryId : (candidateValues.includes(secondaryFactoryId!) ? secondaryFactoryId : candidateValues[0])
    await groupSelects.nth(index).selectOption(selectedValue!)
  }
  await detailDispatchDialog.locator('[data-dispatch-action="confirm-direct-dispatch"]').click()
  await expect(detailDispatchDialog).toBeHidden()
  await searchTask(page, detailDirectTask.taskId)
  await expect(
    page.locator('tbody tr td.font-mono').filter({
      hasText: new RegExp(`^${escapeForRegex(getVisibleTaskRef(detailDirectTask))}$`),
    }),
  ).toHaveCount(0)

  const wholeTenderMenu = await openRowMenu(page, getVisibleTaskRef(wholeTenderTask))
  await wholeTenderMenu.getByRole('button', { name: '创建招标单', exact: true }).click()
  const tenderSheet = page.locator('[data-tender-sheet="true"]').first()
  await expect(tenderSheet).toBeVisible()
  await expect(tenderSheet.locator('[data-tender-mode="DETAIL"]')).toHaveCount(0)
  await fillTenderCommonFields(tenderSheet)
  await tenderSheet.locator('[data-dispatch-action="confirm-create-tender"]').click()
  await expect(tenderSheet).toBeHidden()

  const detailTenderMenu = await openRowMenu(page, getVisibleTaskRef(detailTenderTask))
  await detailTenderMenu.getByRole('button', { name: '创建招标单', exact: true }).click()
  const detailTenderSheet = page.locator('[data-tender-sheet="true"]').first()
  await expect(detailTenderSheet.locator('[data-tender-mode="TASK"]')).toBeVisible()
  await expect(detailTenderSheet.locator('[data-tender-mode="DETAIL"]')).toBeVisible()
  await detailTenderSheet.locator('[data-tender-mode="DETAIL"]').click()
  await expect(detailTenderSheet.locator('[data-tender-group]')).toHaveCount(listRuntimeTaskAllocatableGroups(detailTenderTask.taskId).length)
  await fillTenderCommonFields(detailTenderSheet)
  await detailTenderSheet.locator('[data-dispatch-action="confirm-create-tender"]').click()
  await expect(detailTenderSheet).toBeHidden()
  await searchTask(page, detailTenderTask.taskId)
  await expect(
    page.locator('tbody tr td.font-mono').filter({
      hasText: new RegExp(`^${escapeForRegex(getVisibleTaskRef(detailTenderTask))}$`),
    }),
  ).toHaveCount(0)

  await expectNoPageErrors(errors)
})
