import path from 'node:path'

import { expect, test } from '@playwright/test'

const SAMPLE_IMAGE = path.resolve('public/dress-sample-1.jpg')

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
})

test('改款打样从目标颜色到整单确认按团队自动接力并保存真实成果文件', async ({ page }) => {
  await page.goto('/pcs/engineering/revision-sampling')
  await expect(page.getByRole('heading', { name: '改款打样任务' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  const listSection = page.locator('[data-standard-list-table-section]')
  await expect(page.getByRole('button', { name: '列设置' })).toHaveCount(1)
  await expect(listSection.getByRole('button', { name: '列设置' })).toBeVisible()
  await expect(page.getByLabel('当前需处理的团队')).toHaveCount(1)
  await page.getByRole('button', { name: '列设置' }).click()
  await expect(page.getByRole('heading', { name: '改款打样列表列设置' })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  await page.getByRole('button', { name: '新建改款打样' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('基于款式（SPU）').selectOption({ index: 1 })
  await dialog.getByLabel('做成款式（SPU）').selectOption({ index: 2 })
  await dialog.getByLabel('本次打样原因').fill('浏览器验收：调整颜色并制作销售展示样衣')
  await dialog.getByRole('button', { name: '创建草稿' }).click()

  await expect(page).toHaveURL(/\/pcs\/engineering\/revision-sampling\/ES-/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expect(page.getByText('当前需处理的团队').locator('..').getByText('买手')).toBeVisible()
  await expect(page.getByText('本次目标颜色待买手定义')).toBeVisible()
  await expect(page.getByRole('button', { name: 'BOM 与价格（待确认颜色）' })).toBeDisabled()
  await expect(page.getByText('本次需要完成的工作')).toHaveCount(0)

  await page.getByPlaceholder('输入或选择新款颜色').fill('浏览器验收藏青')
  await page.locator('[data-pcs-independent-sampling-field="sourceColor"]').selectOption('Black')
  await page.getByRole('button', { name: '新增颜色' }).click()
  await page.getByPlaceholder('输入或选择新款颜色').nth(1).fill('浏览器验收米白')
  await page.locator('[data-pcs-independent-sampling-field="sourceColor"]').nth(1).selectOption('White')
  await page.getByRole('button', { name: '确认目标颜色并建立 BOM' }).click()
  await expect(page.getByText('目标颜色已确认，并按颜色建立 BOM 与价格草稿。')).toBeVisible()
  await expect(page.getByText('浏览器验收藏青', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: '维护该颜色 BOM' })).toHaveCount(2)

  const applyConversion = page.getByRole('button', { name: '应用参考物料处理结果' })
  if (await applyConversion.count()) {
    await applyConversion.click()
    await expect(page.getByText('B 款用料已确认并归入 B 款 BOM。')).toBeVisible()
  }
  await page.getByRole('button', { name: '完成新款资料准备，交给跟单' }).click()
  await expect(page.getByRole('heading', { name: '第二步：工作安排' })).toBeVisible()
  await expect(page.getByText('当前由跟单处理')).toBeVisible()

  await page.getByPlaceholder('填写退回原因').fill('浏览器验收：补充颜色说明')
  await page.getByRole('button', { name: '退回买手修改' }).click()
  await expect(page.getByRole('heading', { name: '第一步：新款资料准备' })).toBeVisible()
  await expect(page.getByText('退回修改：浏览器验收：补充颜色说明')).toBeVisible()
  await page.getByRole('button', { name: 'BOM 与价格' }).click()
  await page.getByRole('button', { name: '完成新款资料准备，交给跟单' }).click()
  await expect(page.getByRole('heading', { name: '第二步：工作安排' })).toBeVisible()

  await page.locator('[data-pcs-independent-sampling-field="planTaskType"][value="BASE_PATTERN"]').setChecked(true)
  await page.locator('[data-pcs-independent-sampling-field="planTaskType"][value="DISPLAY_SAMPLE"]').setChecked(true)
  await page.locator('[data-pcs-independent-sampling-field="planTaskType"][value="PATTERN_ARTWORK"]').setChecked(false)
  await page.locator('[data-pcs-independent-sampling-field="planTaskType"][value="COLOR_YARN"]').setChecked(false)
  await page.locator('[data-pcs-independent-sampling-field="planTaskType"][value="COLOR_FABRIC"]').setChecked(false)
  const requirementRows = page.locator('[data-sample-requirement-row]')
  const requirementCount = await requirementRows.count()
  expect(requirementCount).toBeGreaterThanOrEqual(2)
  await requirementRows.first().locator('[data-pcs-independent-sampling-field="sampleRequirementQuantity"]').fill('2')
  await requirementRows.first().locator('[data-pcs-independent-sampling-field="sampleRequirementNote"]').fill('首行制作两件，用于数量差异验收')
  await page.getByRole('button', { name: '确认并生成工作' }).click()
  await expect(page.getByRole('heading', { name: '第三步：专业工作' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '销售展示样衣制作要求' })).toBeVisible()

  await page.locator('a[href$="-BASE_PATTERN"]').click()
  await expect(page).toHaveURL(/\/pcs\/patterns\/plate-making\/.+-BASE_PATTERN$/)
  await page.getByRole('button', { name: '开始任务' }).click()

  const patternUpload = page.locator('input[type="file"][accept*=".prj"]')
  await patternUpload.setInputFiles({
    name: 'empty-pattern.prj',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(0),
  })
  await expect(page.getByText('empty-pattern.prj 为空文件，无法上传。')).toBeVisible()
  await patternUpload.setInputFiles({
    name: 'browser-acceptance-pattern.prj',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('HIGOOD-REAL-PRJ-CONTENT'),
  })
  await expect(page.getByText('文件已真实读取并保存。')).toBeVisible()
  await page.getByLabel('成果名称').fill('浏览器验收基码纸样')
  await page.getByLabel('纸样版本').fill('v1.0')
  await page.getByLabel('适用部位／尺码').fill('基码 / M 码')
  await page.getByLabel('纸样说明').fill('用于浏览器全流程验收')
  await page.getByRole('button', { name: '提交本次工作' }).click()
  await expect(page.getByText('本项工作已完成')).toBeVisible()
  await expect(page.getByRole('link', { name: '下载' })).toHaveAttribute('download', 'browser-acceptance-pattern.prj')
  await page.getByRole('link', { name: '返回主任务' }).click()

  const sampleRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '销售展示样衣任务', exact: true }) })
  await sampleRow.getByRole('link', { name: '进入任务' }).click()
  await expect(page).toHaveURL(/\/pcs\/samples\/display-sample\/.+-DISPLAY_SAMPLE$/)
  await page.getByRole('button', { name: '开始任务' }).click()
  await expect(page.getByRole('heading', { name: '跟单下达的制作要求' })).toBeVisible()
  const resultRows = page.locator('[data-sample-result-row]')
  await expect(resultRows).toHaveCount(requirementCount)
  for (let index = 0; index < requirementCount; index += 1) {
    const row = resultRows.nth(index)
    await row.locator('[data-pcs-independent-sampling-upload-input]').setInputFiles(SAMPLE_IMAGE)
    await row.locator('[data-pcs-independent-sampling-field="sampleResultPattern"]').selectOption('v1.0')
    await row.locator('[data-pcs-independent-sampling-field="sampleResultNote"]').fill('真实样衣图已上传')
  }
  await expect(page.getByText('文件已真实读取并保存。')).toBeVisible()
  await resultRows.first().locator('[data-pcs-independent-sampling-field="sampleResultQuantity"]').fill('1')
  await page.getByRole('button', { name: '提交本次工作' }).click()
  await expect(page.getByText('实际交付与制作要求不一致，请填写差异说明', { exact: false })).toBeVisible()
  await resultRows.first().locator('[data-pcs-independent-sampling-field="sampleResultDifference"]').fill('本次先交付 1 件，其余后补')
  await page.getByRole('button', { name: '提交本次工作' }).click()
  await expect(page.getByText('本项工作已完成')).toBeVisible()
  await page.getByRole('button', { name: '查看大图' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: '返回主任务' }).click()

  await expect(page.getByRole('heading', { name: '第四步：整单确认' })).toBeVisible()
  await expect(page.getByText('当前由跟单处理')).toBeVisible()
  await page.getByPlaceholder('成果版本，如 v1.0').fill('v1.0')
  await page.getByPlaceholder('本次实际完成的样衣和成果说明').fill('浏览器验收全流程完成')
  await page.getByRole('button', { name: '确认整张任务成果' }).click()
  await expect(page.getByText('本项工作已完成')).toHaveCount(0)
  await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible()
})

test('设计打样使用相同四步骨架并由跟单下达销售展示样衣制作要求', async ({ page }) => {
  await page.goto('/pcs/engineering/design-sampling')
  await expect(page.getByRole('heading', { name: '设计打样任务' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expect(page.locator('[data-standard-list-table-section]').getByRole('button', { name: '列设置' })).toBeVisible()
  await expect(page.getByLabel('当前需处理的团队')).toHaveCount(1)

  await page.getByRole('button', { name: '新建设计打样' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('目标款式（SPU）').selectOption({ index: 3 })
  await dialog.getByLabel('本次打样原因').fill('浏览器验收：设计款销售展示样衣')
  await dialog.getByRole('button', { name: '创建草稿' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const stepNavigation = page.getByRole('navigation', { name: '打样任务步骤' })
  await expect(stepNavigation.getByRole('button')).toHaveCount(4)
  await expect(page.getByText('目标款式', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('A 款：基于款式（参考）')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '第一步：新款资料准备' })).toBeVisible()

  await page.getByPlaceholder('输入或选择新款颜色').fill('设计验收粉')
  await page.getByRole('button', { name: '确认目标颜色并建立 BOM' }).click()
  const designTaskUrl = page.url()
  await page.getByRole('link', { name: '维护该颜色 BOM' }).click()
  await expect(page).toHaveURL(/\/pcs\/technical-data\/bom-pricing\//)
  await page.locator('[data-tech-data-field="bom-material-sku"]').selectOption({ index: 1 })
  await page.getByRole('button', { name: '加入物料' }).click()
  await expect(page.getByText('物料已加入并保存。')).toBeVisible()
  await page.goto(designTaskUrl)
  await page.getByRole('button', { name: 'BOM 与价格' }).click()
  await page.getByRole('button', { name: '完成新款资料准备，交给跟单' }).click()
  await expect(page.getByRole('heading', { name: '第二步：工作安排' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '销售展示样衣制作要求' })).toBeVisible()
  await expect(page.locator('[data-sample-requirement-row]')).not.toHaveCount(0)
  await expect(page.locator('[data-pcs-independent-sampling-field="planTaskType"][value="DISPLAY_SAMPLE"]')).toBeChecked()
})
