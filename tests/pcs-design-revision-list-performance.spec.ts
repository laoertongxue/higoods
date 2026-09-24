import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

type TimedWindow = Window & { __listActionStart?: number; __listNavigationMs?: number }
const prefix = 'pcs-independent-sampling'
const actionSelector = (name: string) => `[data-${prefix}-action="${name}"]`

// Includes browser event dispatch, the verified business result, visible images and two paint frames.
// Playwright assertion latency is retained, so these are conservative upper bounds.
async function measure(page: Page, action: () => Promise<void>, event = 'click'): Promise<number> {
  await page.evaluate((event) => {
    delete (window as TimedWindow).__listActionStart
    sessionStorage.removeItem('dr-performance-event-start')
    document.addEventListener(event, (e) => { (window as TimedWindow).__listActionStart = e.timeStamp; sessionStorage.setItem('dr-performance-event-start', String(performance.timeOrigin + e.timeStamp)) }, { once: true, capture: true })
  }, event)
  await action()
  return page.evaluate(async () => {
    const started = Number(sessionStorage.getItem('dr-performance-event-start'))
    if (!started) throw new Error('未捕获操作事件，不能使用空样本')
    const images = Array.from(document.querySelectorAll('img')).filter((image) => {
      const rect = image.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
    })
    await Promise.all(images.map((image) => image.decode()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return performance.timeOrigin + performance.now() - started
  })
}

test('设计改款列表冷进入、刷新和核心列表操作五次性能', async ({ browser, baseURL }, testInfo) => {
  const samples: Record<string, number[]> = {}
  const record = (key: string, value: number) => { (samples[key] ||= []).push(value) }
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    await context.addInitScript(() => {
      const probe = () => {
        const table = document.querySelector('[data-independent-sampling-table]')
        const images = Array.from(table?.querySelectorAll('img') || []).filter((image) => image.getBoundingClientRect().top < innerHeight)
        if (!table?.querySelector('tbody tr') || !images.length || images.some((image) => !image.complete || !image.naturalWidth)) {
          requestAnimationFrame(probe); return
        }
        requestAnimationFrame(() => requestAnimationFrame(() => { (window as TimedWindow).__listNavigationMs = performance.now() }))
      }
      requestAnimationFrame(probe)
    })
    const page = await context.newPage()
    await page.goto(`${baseURL}/pcs/production-preparation/design-revision`)
    await page.waitForFunction(() => (window as TimedWindow).__listNavigationMs !== undefined)
    record('coldNavigation', await page.evaluate(() => (window as TimedWindow).__listNavigationMs!))
    await page.reload()
    await page.waitForFunction(() => (window as TimedWindow).__listNavigationMs !== undefined)
    record('reload', await page.evaluate(() => (window as TimedWindow).__listNavigationMs!))
    const table = page.locator('[data-independent-sampling-table]')
    await expect(table.locator('thead th').first()).toHaveText('勾选')
    await expect(table.locator('thead th')).toHaveCount(9)
    await expect(table).not.toContainText('花型任务')
    await expect(table).not.toContainText('调色任务')
    await expect(table.locator('[data-design-revision-material-costs]').first()).toContainText('综合')
    if (iteration === 0) await page.screenshot({ path: testInfo.outputPath('consolidated-list.png'), fullPage: false })
    const boxes = table.locator(`[data-${prefix}-select-task]`)
    const keyword = page.locator(`[data-${prefix}-field="listKeyword"]`)
    record('keywordInput', await measure(page, async () => { await keyword.fill('ES-DR-001'); await expect(keyword).toHaveValue('ES-DR-001') }, 'input'))
    record('query', await measure(page, async () => { await page.locator(actionSelector('query')).click(); await expect(boxes).toHaveCount(1); await expect(table).toContainText('ES-DR-001') }))
    record('reset', await measure(page, async () => { await page.locator(actionSelector('reset')).click(); await expect(boxes).toHaveCount(10); await expect(keyword).toHaveValue('') }))
    record('moreFilters', await measure(page, async () => { await page.getByText('更多筛选', { exact: true }).click(); await expect(page.locator(`[data-${prefix}-field="listPattern"]`)).toBeVisible() }))
    if (iteration === 0) await page.screenshot({ path: testInfo.outputPath('expanded-filters.png') })
    record('collapseFilters', await measure(page, async () => { await page.getByRole('button', { name: '收起更多', exact: true }).click(); await expect(page.locator('[data-process-advanced]')).toBeHidden() }))
    await page.getByRole('button', { name: '更多筛选', exact: true }).click()
    const pattern = page.locator(`[data-${prefix}-field="listPattern"]`)
    record('patternFilter', await measure(page, async () => { await pattern.selectOption('REUSE'); await expect(pattern).toHaveValue('REUSE') }, 'change'))
    record('emptyQuery', await measure(page, async () => { await page.locator(actionSelector('query')).click(); await expect(boxes).toHaveCount(0) }))
    await page.locator(actionSelector('reset')).click()
    record('export', await measure(page, async () => {
      const download = page.waitForEvent('download')
      await page.locator(actionSelector('export')).click()
      expect(await readFile(await (await download).path(), 'utf8')).toContain('ES-DR-024')
    }))
    const sort = page.locator(`${actionSelector('sort-column')}[data-column-key="code"]`)
    record('sortAscending', await measure(page, async () => { await sort.click(); await expect(boxes.first()).toHaveAttribute(`data-${prefix}-select-task`, 'ES-ID-DR-001') }))
    record('sortDescending', await measure(page, async () => { await sort.click(); await expect(boxes.first()).toHaveAttribute(`data-${prefix}-select-task`, 'ES-ID-DR-024') }))
    record('sortReset', await measure(page, async () => { await sort.click(); await expect(boxes.first()).toHaveAttribute(`data-${prefix}-select-task`, 'ES-ID-DR-001') }))
    const pageSize = page.locator(`[data-${prefix}-field="pageSize"]`)
    record('pageSize20', await measure(page, async () => { await pageSize.selectOption('20'); await expect(boxes).toHaveCount(20) }, 'change'))
    record('pageSize10', await measure(page, async () => { await pageSize.selectOption('10'); await expect(boxes).toHaveCount(10) }, 'change'))
    record('openCreate', await measure(page, async () => { await page.locator(actionSelector('open-create')).click(); await expect(page.locator(`[data-${prefix}-field="targetStyleId"]`)).toBeVisible() }))
    record('closeCreate', await measure(page, async () => { await page.locator(actionSelector('close-create')).last().click(); await expect(page.locator(`[data-${prefix}-field="targetStyleId"]`)).toHaveCount(0) }))
    record('openStyleImage', await measure(page, async () => { await table.locator(actionSelector('open-image')).first().click(); await expect(page.getByRole('dialog').locator('img')).toBeVisible() }))
    record('closeStyleImage', await measure(page, async () => { await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }))
    record('openMaterialImage', await measure(page, async () => { await table.locator('[data-design-revision-material-costs]').locator(actionSelector('open-image')).first().click(); await expect(page.getByRole('dialog').locator('img')).toBeVisible() }))
    record('closeMaterialImage', await measure(page, async () => { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0) }, 'keydown'))
    record('openDesignImage', await measure(page, async () => { await table.locator('[data-design-revision-design-thumbnail]').first().click(); await expect(page.getByRole('dialog').locator('img')).toBeVisible() }))
    record('closeDesignImage', await measure(page, async () => { await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }))
    const firstId = await boxes.first().getAttribute(`data-${prefix}-select-task`)
    record('nextPage', await measure(page, async () => { await page.locator(actionSelector('next-page')).click(); await expect(boxes.first()).not.toHaveAttribute(`data-${prefix}-select-task`, firstId!) }))
    record('previousPage', await measure(page, async () => { await page.locator(actionSelector('prev-page')).click(); await expect(boxes.first()).toHaveAttribute(`data-${prefix}-select-task`, firstId!) }))
    record('selectPage', await measure(page, async () => { await page.locator(actionSelector('select-page')).click(); await expect(page.locator('[data-design-revision-selected-count]')).toHaveText('已选 10 条') }))
    record('clearSelection', await measure(page, async () => { await page.locator(actionSelector('clear-selection')).click(); await expect(page.locator('[data-design-revision-selected-count]')).toHaveText('已选 0 条') }))
    record('openColumns', await measure(page, async () => { await page.locator(actionSelector('open-column-settings')).click(); await expect(page.locator(actionSelector('restore-column-settings'))).toBeVisible() }))
    const freezeCode = page.locator(`[data-standard-list-column-key="code"] input${actionSelector('toggle-column-freeze')}`)
    record('unfreezeCode', await measure(page, async () => { await freezeCode.uncheck(); await expect(freezeCode).not.toBeChecked(); await expect(table.locator('th').filter({ hasText: '任务号' })).not.toHaveClass(/sticky/) }))
    record('freezeCode', await measure(page, async () => { await freezeCode.check(); await expect(freezeCode).toBeChecked(); await expect(table.locator('th').filter({ hasText: '任务号' })).toHaveClass(/sticky/) }))
    record('hideColumn', await measure(page, async () => { await page.locator(`[data-standard-list-column-key="bom"] input${actionSelector('toggle-column-visibility')}`).uncheck(); await expect(table.locator('th').getByText('物料与费用', { exact: true })).toHaveCount(0) }))
    record('restoreColumns', await measure(page, async () => { await page.locator(actionSelector('restore-column-settings')).click(); await expect(table.locator('th').getByText('物料与费用', { exact: true })).toHaveCount(1) }))
    record('closeColumns', await measure(page, async () => { await page.locator(actionSelector('close-column-settings')).last().click(); await expect(page.locator(actionSelector('restore-column-settings'))).toHaveCount(0) }))
    for (const [field, value] of [['listStatus', 'DRAFT'], ['listStatus', 'IN_PROGRESS'], ['listStatus', 'COMPLETED'], ['teamFilter', 'goto_global 中央车缝工厂'], ['listProcessing', 'NONE'], ['listProcessing', 'DYE_ONLY'], ['listProcessing', 'PRINT_ONLY'], ['listProcessing', 'BOTH']] as const) {
      await page.locator(actionSelector('reset')).click()
      if (field === 'listProcessing') await page.getByText('更多筛选', { exact: true }).click()
      const control = page.locator(`[data-${prefix}-field="${field}"]`)
      const selected = field === 'teamFilter' ? await control.locator('option').nth(1).getAttribute('value') : value
      record(`${field}:${selected}`, await measure(page, async () => { await control.selectOption(selected!); await expect(control).toHaveValue(selected!) }, 'change'))
      record(`query:${field}:${selected}`, await measure(page, async () => {
        await page.locator(actionSelector('query')).click()
        await expect(page.locator('[data-independent-sampling-pagination]')).toBeVisible()
        const state = await page.locator(`[data-${prefix}-field="${field}"]`).inputValue()
        expect(state).toBe(selected)
        if (field === 'listStatus' && await boxes.count()) await expect(table.locator('tbody')).toContainText({ DRAFT: '草稿', IN_PROGRESS: '进行中', COMPLETED: '已完成' }[value])
      }))
    }
    for (const [key, typed] of [['originalSpu', 'STYLE'], ['newSpu', 'STYLE'], ['originalBuyer', '不存在的买手'], ['newBuyer', '买手'], ['creator', '买手'], ['patternMaker', '周'], ['brand', ''], ['category', ''], ['patternUploaded', 'YES'], ['hasDyeOrder', 'YES'], ['hasPrintOrder', 'NO'], ['timeType', 'completed'], ['timeType', 'patternUploadedAt']] as const) {
      await page.locator(actionSelector('reset')).click()
      await page.getByText('更多筛选', { exact: true }).click()
      const control = page.locator(`[data-${prefix}-field="extra:${key}"]`)
      const isSelect = await control.evaluate(node => node.tagName === 'SELECT')
      const value = typed || await control.locator('option').nth(1).getAttribute('value') || ''
      record(`extraInput:${key}:${value}`, await measure(page, async () => { if (isSelect) await control.selectOption(value); else await control.fill(value); await expect(control).toHaveValue(value) }, isSelect ? 'change' : 'input'))
      record(`extraQuery:${key}:${value}`, await measure(page, async () => { await page.locator(actionSelector('query')).click(); await expect(control).toHaveValue(value); await expect(page.locator('[data-independent-sampling-pagination]')).toBeVisible(); if (key === 'originalBuyer') await expect(boxes).toHaveCount(0) }))
    }
    await page.locator(actionSelector('reset')).click()
    await page.getByText('更多筛选', { exact: true }).click()
    for (const [field, value] of [['listStartDate', '2026-01-01'], ['listEndDate', '2026-12-31']] as const) {
      const control = page.locator(`[data-${prefix}-field="${field}"]`)
      record(field, await measure(page, async () => { await control.fill(value); await expect(control).toHaveValue(value) }, 'input'))
    }
    record('dateQuery', await measure(page, async () => { await page.locator(actionSelector('query')).click(); await expect(boxes).toHaveCount(10) }))
    await expect(page.getByRole('button', { name: '收起更多', exact: true })).toBeVisible()
    await page.locator(`[data-${prefix}-field="listStartDate"]`).fill('2027-01-01')
    record('invalidDateQuery', await measure(page, async () => { await page.locator(actionSelector('query')).click(); await expect(page.getByText('创建开始日期不能晚于结束日期。')).toBeVisible(); await expect(boxes).toHaveCount(10) }))
    await page.locator(actionSelector('reset')).click()
    await page.locator(actionSelector('open-column-settings')).click()
    record('dragColumn', await measure(page, async () => {
      await page.locator('[data-drag-source="bom"]').dragTo(page.locator('[data-drop-target="basePattern"]'))
      const keys = await table.locator('thead th').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()))
      expect(keys.indexOf('物料与费用')).toBeLessThan(keys.indexOf('基码纸样'))
    }, 'dragstart'))
    await page.locator(actionSelector('restore-column-settings')).click()
    await page.locator(actionSelector('close-column-settings')).last().click()
    record('navigateTaskDetail', await measure(page, async () => { await table.getByRole('link', { name: 'ES-DR-001', exact: true }).click(); await expect(page.getByRole('heading', { name: /ES-DR-001/ })).toBeVisible() }))
    const back = page.getByRole('link', { name: /返回.*列表/ }).first()
    record('navigateBackToList', await measure(page, async () => { await back.click(); await expect(boxes).toHaveCount(10) }))
    await boxes.first().check()
    record('copyDraft', await measure(page, async () => { await page.locator(actionSelector('copy-selected')).click(); await expect(page.getByText('已批量生成独立的设计改款草稿。')).toBeVisible(); await expect(page.locator('[data-design-revision-selected-count]')).toHaveText('已选 0 条') }))
    await context.close()
  }
  const receipt = { measuredAt: new Date().toISOString(), baseURL, viewport: '1366x768', browser: browser.version(),
    cache: 'five new empty contexts; reload and actions retain cache',
    timing: 'event.timeStamp to asserted result + visible image decode + two frames, including assertion overhead',
    distIndexSha256: createHash('sha256').update(await readFile('dist/index.html')).digest('hex'), samples }
  await writeFile(testInfo.outputPath('list-performance.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
  for (const [name, values] of Object.entries(samples)) {
    expect(values, name).toHaveLength(5)
    for (const value of values) expect(value, `${name} ${value}ms`).toBeLessThan(500)
  }
})
