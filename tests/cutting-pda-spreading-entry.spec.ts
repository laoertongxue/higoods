import { expect, test } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const taskWithWorkerTargets = listPdaCuttingTaskSourceRecords()
  .flatMap((record) =>
    record.executionOrderIds.map((executionOrderId, index) => ({
      taskId: record.taskId,
      executionOrderId,
      executionOrderNo: record.executionOrderNos[index] || executionOrderId,
      detail: getPdaCuttingTaskSnapshot(record.taskId, executionOrderId),
    })),
  )
  .find((item) =>
    item.detail?.spreadingRecords.length
    && item.detail.spreadingTargets.some((target) => target.targetType === 'session' || target.targetType === 'marker'),
  )
  || listPdaCuttingTaskSourceRecords()
    .flatMap((record) =>
      record.executionOrderIds.map((executionOrderId, index) => ({
        taskId: record.taskId,
        executionOrderId,
        executionOrderNo: record.executionOrderNos[index] || executionOrderId,
        detail: getPdaCuttingTaskSnapshot(record.taskId, executionOrderId),
      })),
    )
    .find((item) => item.detail?.spreadingTargets.some((target) => target.targetType === 'session' || target.targetType === 'marker'))

const allSpreadingModes = new Set(
  listPdaCuttingTaskSourceRecords()
    .flatMap((record) =>
      record.executionOrderIds.flatMap((executionOrderId) => getPdaCuttingTaskSnapshot(record.taskId, executionOrderId)?.spreadingTargets || []),
    )
    .map((target) => target.spreadingMode),
)

test.skip(!taskWithWorkerTargets, '缺少可展示 session / marker 铺布对象的 PDA 任务')

test('普通工人只看到 session / marker 铺布对象，当前排版项必选且公式可见', async ({ page }) => {
  const errors = collectPageErrors(page)
  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })

  expect([...allSpreadingModes].sort()).toEqual(['FOLD_HIGH_LOW', 'FOLD_NORMAL', 'HIGH_LOW', 'NORMAL'])

  const task = taskWithWorkerTargets!
  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(task.executionOrderId)}&executionOrderNo=${encodeURIComponent(task.executionOrderNo)}`,
  )

  const optionValues = await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"] option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value),
  )
  const optionLabels = await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"] option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).textContent || ''),
  )
  expect(optionValues.length).toBeGreaterThan(0)
  expect(
    optionValues.every(
      (value) =>
        (value.startsWith('session:') || value.startsWith('marker:'))
        && !value.startsWith('manual-entry:')
        && !value.startsWith('context:'),
    ),
  ).toBeTruthy()
  expect(
    optionLabels.every((label) => label.includes('继续当前铺布') || label.includes('按唛架开始铺布')),
  ).toBeTruthy()
  expect(optionLabels.every((label) => !label.includes('异常补录'))).toBeTruthy()
  expect(optionLabels.every((label) => !label.includes('当前上下文'))).toBeTruthy()
  await expect(page.locator('body')).toContainText('参考唛架')
  await expect(page.locator('body')).toContainText('当前排版项')
  await expect(page.locator('body')).not.toContainText('来源唛架')
  await expect(page.locator('body')).not.toContainText('计划单元')
  await expect(page.locator('body')).not.toContainText('数据来源')
  await expect(page.locator('body')).not.toContainText('录入来源')
  await expect(page.locator('body')).not.toContainText('sourceWritebackId')
  await expect(page.locator('body')).not.toContainText('enteredByAccountId')
  await expect(page.locator('body')).not.toContainText('operatorAccountId')
  await expect(page.locator('body')).not.toContainText('拆分组')

  await expect(page.locator('[data-pda-cut-spreading-field="planUnitId"]')).toBeVisible()
  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption('')
  await page.locator('[data-pda-cut-spreading-field="fabricRollNo"]').fill('ROLL-ENTRY-01')
  await page.locator('[data-pda-cut-spreading-field="layerCount"]').fill('6')
  await page.locator('[data-pda-cut-spreading-field="actualLength"]').fill('24')
  await page.locator('[data-pda-cut-spreading-field="headLength"]').fill('0.3')
  await page.locator('[data-pda-cut-spreading-field="tailLength"]').fill('0.2')
  await page.getByRole('button', { name: '保存铺布记录' }).click()

  await expect(page.getByText('请先选择当前排版项。')).toBeVisible()

  await page.locator('[data-pda-cut-spreading-field="planUnitId"]').selectOption({ index: 1 })
  await expect(page.locator('[data-pda-cut-spreading-field="spreadingMode"]')).toBeVisible()
  await expect(page.getByTestId('pda-cutting-spreading-plan-summary')).toContainText(/[^/]+ \/ [^/]+ \/ [\d,]+件/)
  await expect(page.getByText('23.50 米 = 24.00 米 - 0.30 米 - 0.20 米')).toBeVisible()
  await expect(page.getByText(/件 = 6 层 × \d+ 件/)).toBeVisible()
  await expect(page.locator('body')).toContainText('当前步骤')
  await expect(page.locator('body')).toContainText('交接结果')
  await expect(page.locator('body')).toContainText(/无换班|交接给：|接手自：/)
  await expect(page.locator('body')).not.toContainText('换班：')

  await expectNoPageErrors(errors)
})
