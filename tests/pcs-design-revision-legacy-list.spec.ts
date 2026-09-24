import { expect, test } from '@playwright/test'

test('旧浏览器工作项刷新后清除线下任务，合并列且图片可预览', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/pcs/production-preparation/design-revision')
  await expect(page.locator('[data-independent-sampling-table] tbody tr')).toHaveCount(10)
  const taskCode = await page.evaluate(() => {
    const key = 'higood-pcs-design-revision-v1'
    const records = JSON.parse(localStorage.getItem(key)!)
    const row = records.find((row: any) => row.professionalTasks.some((task: any) => task.taskType === 'DISPLAY_SAMPLE'))
    const sample = row.professionalTasks.find((task: any) => task.taskType === 'DISPLAY_SAMPLE')
    row.professionalTasks.push({ ...sample, taskId: 'old-flower', taskType: 'PATTERN_ARTWORK', taskName: '花型任务', results: [], processWorkOrderRefs: [] }, { ...sample, taskId: 'old-color', taskType: 'COLOR_FABRIC', taskName: '调色任务', results: [], processWorkOrderRefs: [] })
    sample.dependsOnTaskIds.push('old-flower', 'old-color')
    const historical = records[0]
    historical.status = 'COMPLETED'
    historical.professionalTasks = [{ ...sample, taskId: 'retired-only', taskType: 'PATTERN_ARTWORK', taskName: '花型任务', results: [], processWorkOrderRefs: [] }]
    localStorage.setItem(key, JSON.stringify(records))
    return row.samplingTaskCode
  })
  await page.reload()
  const table = page.locator('[data-independent-sampling-table]')
  await expect(table).not.toContainText('花型任务')
  await expect(table).not.toContainText('调色任务')
  await expect(table.locator('thead th')).toHaveCount(9)
  await expect(table).toContainText('原款式买手')
  await expect(table).toContainText('新款式买手')
  await expect(table).toContainText('添加人')
  await expect(table).toContainText('历史未记录样衣任务')
  await expect(table).toContainText('历史未记录纸样任务')
  await expect(table.locator('[data-design-revision-material-costs]').first()).toContainText('需要')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await table.locator('[data-design-revision-material-costs] [data-pcs-independent-sampling-action="open-image"]').first().click()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('list-1280.png') })
  await table.getByRole('link', { name: taskCode, exact: true }).click()
  await expect(page.getByRole('heading', { name: taskCode })).toBeVisible()
  await expect(page.locator('#app main')).not.toContainText('花型任务')
  await expect(page.locator('#app main')).not.toContainText('调色任务')
})
