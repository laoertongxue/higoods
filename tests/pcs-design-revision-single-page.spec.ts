import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
const root = '/pcs/production-preparation/design-revision'
const field = (name: string) => `[data-pcs-independent-sampling-field="${name}"]`
const act = (name: string) => `[data-pcs-independent-sampling-action="${name}"]`
async function timed(page: Page, action: () => Promise<void>, event = 'click') {
  await page.evaluate(event => {
    sessionStorage.removeItem('single-step-start')
    document.addEventListener(event, e => sessionStorage.setItem('single-step-start', String(performance.timeOrigin + e.timeStamp)), { once: true, capture: true })
  }, event)
  await action()
  return page.evaluate(async () => {
    const start = Number(sessionStorage.getItem('single-step-start'))
    if (!start) throw new Error('没有捕获操作起点')
    await Promise.all([...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 }).map(img => img.decode()))
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return performance.timeOrigin + performance.now() - start
  })
}

test('新建直接填写全部内容，保存和直接提交全流程及五次性能', async ({ browser, baseURL }, testInfo) => {
  const samples: Record<string, number[]> = {}
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({ viewport: { width: i === 4 ? 1280 : 1366, height: 768 } })
    const page = await context.newPage()
    const measure = async (key: string, action: () => Promise<void>, event = 'click') => { (samples[key] ||= []).push(await timed(page, action, event)) }
    await page.goto(baseURL + root + '/new')
    await expect(page.locator('[data-design-revision-create-page]')).toBeVisible()
    const ready = () => page.evaluate(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); return performance.now() })
    ;(samples.coldNew ||= []).push(await ready())
    await page.reload()
    await expect(page.locator('[data-design-revision-create-page]')).toBeVisible()
    ;(samples.reloadNew ||= []).push(await ready())
    await page.goto(baseURL + root)
    const initialCount = await page.getByText(/^共 \d+ 条$/).first().textContent()
    await measure('openNew', async () => { await page.locator(act('open-create')).click(); await expect(page).toHaveURL(root + '/new'); await expect(page.locator('[data-design-revision-create-page]')).toBeVisible() })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '第一步：确认本次方案' })).toHaveCount(0)
    await expect(page.locator(act('add-bom-line'))).toBeVisible()
    await measure('cancelNew', async () => { await page.locator(act('close-create')).click(); await expect(page.getByText(/^共 \d+ 条$/).first()).toHaveText(initialCount!) })
    await page.locator(act('open-create')).click()
    await measure('missingTarget', async () => { await page.locator(act('save-draft')).click(); await expect(page.getByText('请选择新款式（SPU）。')).toBeVisible() })
    await measure('targetStyle', async () => { await page.locator('[data-design-style-picker="targetStyleId"] summary').click(); await page.locator(field('targetStyleId')).selectOption({ index: 2 }); await expect(page.locator('[data-design-revision-creation-fields] img')).toHaveCount(1) }, 'change')
    await measure('reason', async () => { await page.locator(field('creationReason')).fill('同页填写并提交'); await expect(page.locator(field('creationReason'))).toHaveValue('同页填写并提交') }, 'input')
    await measure('designUpload', async () => { await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(path.resolve('public/dress-sample-1.jpg')); await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible() }, 'change')
    await measure('previewDesign', async () => { await page.locator('[data-design-revision-creation-fields] [data-pcs-independent-sampling-upload-preview]').click(); await expect(page.getByRole('dialog')).toBeVisible() })
    await measure('closeDesignPreview', async () => { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page).toHaveURL(root + '/new') }, 'keydown')
    await measure('removeDesign', async () => { await page.locator(act('remove-create-design')).click(); await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toHaveCount(0) })
    await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(path.resolve('public/dress-sample-1.jpg'))
    await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible()
    await measure('reusePattern', async () => { await page.locator(field('patternHandling')).selectOption('REUSE'); await expect(page.locator(field('reusedPatternFileId'))).toBeVisible() }, 'change')
    await measure('remakePattern', async () => { await page.locator(field('patternHandling')).selectOption('REMAKE'); await expect(page.locator(field('reusedPatternFileId'))).toHaveCount(0) }, 'change')
    await measure('addMaterial', async () => { await page.locator(act('add-bom-line')).click(); await expect(page.locator('[data-independent-bom-line]')).toHaveCount(1) })
    await measure('removeMaterial', async () => { await page.locator(act('remove-bom-line')).click(); await expect(page.locator('[data-independent-bom-line]')).toHaveCount(0) })
    await page.locator(act('add-bom-line')).click()
    await page.locator('[data-design-style-picker="material"] summary').click()
    await measure('targetSku', async () => { await page.locator(field('bomMaterialSkuId')).selectOption('dr_cotton_dye_print'); await expect(page.locator('[data-independent-bom-line]')).toContainText('无需染色；印花') }, 'change')
    await measure('usage', async () => { await page.locator(field('bomUsage')).fill('2'); await expect(page.locator('[data-design-revision-bom-subtotal]')).toContainText('计划用量 2.0000') }, 'input')
    await measure('addCost', async () => { await page.locator(act('add-custom-cost')).click(); await expect(page.locator(field('customCostTitle'))).toBeVisible() })
    await measure('removeCost', async () => { await page.locator(act('remove-custom-cost')).click(); await expect(page.locator(field('customCostTitle'))).toHaveCount(0) })
    await page.locator(act('add-custom-cost')).click()
    await measure('costTitle', async () => { await page.locator(field('customCostTitle')).fill('车位费'); await expect(page.locator(field('customCostTitle'))).toHaveValue('车位费') }, 'input')
    await measure('costAmount', async () => { await page.locator(field('customCostAmount')).fill('12000'); await expect(page.locator('[data-design-revision-cost-summary]')).toContainText('12.000') }, 'input')
    await measure('sampleQuantity', async () => { await page.locator(field('sampleRequirementQuantity')).fill('3'); await expect(page.locator('[data-design-revision-bom-subtotal]')).toContainText('计划用量 6.0000') }, 'input')
    await measure('addSample', async () => { await page.locator(act('add-sample-requirement')).click(); await expect(page.locator('[data-sample-requirement-row]')).toHaveCount(2) })
    await measure('removeSample', async () => { await page.locator(act('remove-sample-requirement')).last().click(); await expect(page.locator('[data-sample-requirement-row]')).toHaveCount(1) })
    await page.locator('[data-design-revision-display-sample-arrangement]').scrollIntoViewIfNeeded()
    if (i === 0 || i === 4) await page.screenshot({ path: testInfo.outputPath(`single-page-bottom-${i}.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (i === 0 || i === 4) { await page.locator('[data-design-revision-creation-fields]').scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath(`single-page-${i}.png`), fullPage: true }) }
    await measure('saveAll', async () => { await page.locator(act('save-draft')).click(); await expect(page.getByText('设计改款草稿已保存。')).toBeVisible(); await expect(page).toHaveURL(/ES-ID-DR-/) })
    await page.reload()
    await expect(page.locator(field('bomUsage'))).toHaveValue('2')
    await expect(page.locator(field('customCostAmount'))).toHaveValue('12000')
    await expect(page.locator(field('sampleRequirementQuantity'))).toHaveValue('3')
    await measure('submitSaved', async () => { await page.locator(act('confirm-scheme')).click(); await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible() })
    await page.goto(baseURL + root)
    await page.locator(act('open-create')).click()
    await page.locator('[data-design-style-picker="targetStyleId"] summary').click(); await page.locator(field('targetStyleId')).selectOption({ index: 2 })
    await page.locator(field('creationReason')).fill('不预先保存，直接提交')
    await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(path.resolve('public/dress-sample-1.jpg'))
    await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible()
    await measure('submitIncompleteKeepsDraft', async () => { await page.locator(act('confirm-scheme')).click(); await expect(page.getByText(/草稿已保存，尚未提交：/)).toBeVisible(); await expect(page).not.toHaveURL(root + '/new') })
    await page.locator(act('add-bom-line')).click()
    await measure('submitRecoveredDraft', async () => { await page.locator(act('confirm-scheme')).click(); await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible() })
    await page.goto(baseURL + root)
    await page.locator(act('open-create')).click()
    await page.locator('[data-design-style-picker="targetStyleId"] summary').click(); await page.locator(field('targetStyleId')).selectOption({ index: 2 })
    await page.locator(field('creationReason')).fill('直接提交完整方案')
    await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(path.resolve('public/dress-sample-1.jpg'))
    await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible()
    await page.locator(act('add-bom-line')).click()
    await measure('directSubmit', async () => { await page.locator(act('confirm-scheme')).click(); await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible() })
    await context.close()
  }
  await writeFile(testInfo.outputPath('single-page-performance.json'), JSON.stringify({ baseURL, measuredAt: new Date().toISOString(), samples }, null, 2))
  for (const [key, values] of Object.entries(samples)) { expect(values, key).toHaveLength(5); for (const value of values) expect(value, `${key}: ${value}ms`).toBeLessThan(500) }
})
