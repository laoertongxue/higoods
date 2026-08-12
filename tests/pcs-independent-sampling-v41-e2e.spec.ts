import { expect, test } from '@playwright/test'

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
  await page.getByRole('button', { name: '确认目标颜色并建立 BOM' }).click()
  await expect(page.getByText('目标颜色已确认，并按颜色建立 BOM 与价格草稿。')).toBeVisible()
  await expect(page.getByText('浏览器验收藏青', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: '维护该颜色 BOM' })).toBeVisible()

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

  await page.getByRole('button', { name: '确认并生成工作' }).click()
  await expect(page.getByRole('heading', { name: '第三步：专业工作' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible()

  await page.locator('a[href$="-BASE_PATTERN"]').click()
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
  await page.getByRole('button', { name: '开始任务' }).click()
  await page.locator('input[type="file"][accept*=".jpg"]').setInputFiles({
    name: 'browser-acceptance-sample.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  })
  await expect(page.getByText('文件已真实读取并保存。')).toBeVisible()
  await page.getByLabel('成果名称').fill('浏览器验收销售展示样衣')
  await page.getByLabel('制作数量').fill('1')
  await page.getByLabel('颜色').fill('浏览器验收藏青')
  await page.getByLabel('尺码').fill('M')
  await page.getByLabel('使用的纸样版本').fill('v1.0')
  await page.getByLabel('制作说明').fill('真实样衣图已上传')
  await page.getByRole('button', { name: '提交本次工作' }).click()
  await expect(page.getByText('本项工作已完成')).toBeVisible()
  await page.getByRole('button', { name: '查看大图' }).click()
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

test('设计打样保留相同列表和四步骨架且不展示旧款参考关系', async ({ page }) => {
  await page.goto('/pcs/engineering/design-sampling')
  await expect(page.getByRole('heading', { name: '设计打样任务' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expect(page.locator('[data-standard-list-table-section]').getByRole('button', { name: '列设置' })).toBeVisible()
  await expect(page.getByLabel('当前需处理的团队')).toHaveCount(1)

  await page.getByRole('link', { name: '查看详情' }).first().click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const stepNavigation = page.getByRole('navigation', { name: '打样任务步骤' })
  await expect(stepNavigation.getByRole('button')).toHaveCount(4)
  await expect(page.getByText('目标款式', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('A 款：基于款式（参考）')).toHaveCount(0)
  await stepNavigation.getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: '第一步：新款资料准备' })).toBeVisible()
})
