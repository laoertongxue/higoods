import { expect, test, type Page } from '@playwright/test'

import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source'
import {
  buildSpreadingListViewModel,
  readMarkerSpreadingPrototypeData,
} from '../src/pages/process-factory/cutting/marker-spreading-utils'
import { collectPageErrors, expectNoPageErrors, seedLocalStorage } from './helpers/seed-cutting-runtime-state'

const bannedLegacyBranchCopy = [
  '合批',
  '关联批次',
  '查看批次',
  '未入批次',
  '已入批次',
  '裁片批次',
  '当前 next step',
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

async function expectNoLegacyCopy(page: Page): Promise<void> {
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

const prototypeData = readMarkerSpreadingPrototypeData()
const prototypeRows = buildSpreadingListViewModel({
  spreadingSessions: prototypeData.store.sessions,
  rowsById: prototypeData.rowsById,
  mergeBatches: prototypeData.mergeBatches,
  markerRecords: prototypeData.store.markers,
})

const mergeBatchDetailRow = prototypeRows.find((row) => row.contextType === 'merge-batch' && Boolean(row.session.markerId)) || null

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

test('裁片域 supervisor 页面不再出现旧补料分支、工程变量公式和英文单位', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/replenishment')
  await expect(page.getByRole('heading', { level: 1, name: '补料管理' })).toBeVisible()
  await expectNoLegacyCopy(page)

  await page.goto('/fcs/craft/cutting/spreading-list')
  await expect(page.getByRole('heading', { level: 1, name: '铺布列表' })).toBeVisible()
  await expectNoLegacyCopy(page)
  await expect(page.locator('body')).toContainText('合并裁剪批次')

  await page.goto('/fcs/craft/cutting/marker-list')
  await expect(page.getByRole('heading', { level: 1, name: '唛架列表' })).toBeVisible()
  await expectNoLegacyCopy(page)
  await expect(page.locator('body')).toContainText('合并裁剪批次')

  if (mergeBatchDetailRow) {
    await page.goto(`/fcs/craft/cutting/spreading-detail?sessionId=${encodeURIComponent(mergeBatchDetailRow.spreadingSessionId)}`)
    await expect(page.getByRole('button', { name: '去合并裁剪批次' })).toBeVisible()
    await expect(page.locator('body')).toContainText('合并裁剪批次')
    await expectNoLegacyCopy(page)
  }

  await expectNoPageErrors(errors)
})

test.skip(!workerSpreadingTask, '缺少可覆盖 PDA 铺布文案的任务')
test('裁片域 PDA 页面单位与对象文案已中文化，普通工人路径不再暴露旧入口', async ({ page }) => {
  const errors = collectPageErrors(page)

  await seedLocalStorage(page, {
    fcs_pda_session: { userId: 'ID-F004_prod', factoryId: 'ID-F004' },
  })

  await page.goto('/fcs/pda/exec')
  await expect(page.getByRole('heading', { level: 1, name: '执行' })).toBeVisible()
  await expectNoLegacyCopy(page)

  const task = workerSpreadingTask!
  await page.goto(
    `/fcs/pda/cutting/spreading/${task.taskId}?executionOrderId=${encodeURIComponent(task.executionOrderId)}&executionOrderNo=${encodeURIComponent(task.executionOrderNo)}`,
  )
  await expect(page.getByRole('heading', { level: 1, name: '铺布录入' })).toBeVisible()
  const optionValues = await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"] option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value),
  )
  const optionLabels = await page.locator('[data-pda-cut-spreading-field="selectedTargetKey"] option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).textContent || ''),
  )
  expect(optionValues.every((value) => value.startsWith('session:') || value.startsWith('marker:'))).toBeTruthy()
  expect(optionLabels.some((label) => label.includes('按唛架开始铺布') || label.includes('继续当前铺布'))).toBeTruthy()
  expect(optionLabels.every((label) => label.includes('按唛架开始铺布') || label.includes('继续当前铺布'))).toBeTruthy()
  await expect(page.locator('body')).toContainText('当前排版')
  await expect(page.locator('body')).toContainText('颜色')
  await expect(page.locator('body')).toContainText('面料 SKU')
  await expect(page.locator('body')).toContainText('参考唛架')
  await expect(page.locator('body')).not.toContainText('manual-entry')
  await expect(page.locator('body')).not.toContainText('context')
  await expect(page.locator('body')).not.toContainText('sourceWritebackId')
  await expectNoLegacyCopy(page)

  await expectNoPageErrors(errors)
})
