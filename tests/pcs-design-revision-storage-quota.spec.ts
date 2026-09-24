import { expect, test } from '@playwright/test'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'

const root = '/pcs/production-preparation/design-revision'
const field = (name: string) => `[data-pcs-independent-sampling-field="${name}"]`
const action = (name: string) => `[data-pcs-independent-sampling-action="${name}"]`

test('uploaded design + dye then print submits within storage budget and survives reload', async ({ browser, baseURL }, testInfo) => {
  const evidence: object[] = []
  for (let round = 0; round < 5; round++) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const page = await context.newPage()
    await page.goto(baseURL + root + '/new')
    await page.locator('[data-design-style-picker="targetStyleId"] summary').click(); await page.locator(field('targetStyleId')).selectOption({ index: 2 })
    await page.locator(field('creationReason')).fill('存储容量回归：上传设计稿，双属性仅印花')
    await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles(path.resolve('public/dress-sample-1.jpg'))
    await expect(page.getByText('dress-sample-1.jpg', { exact: true })).toBeVisible()
    await page.locator(action('add-bom-line')).click()
    await page.locator('[data-design-style-picker="material"] summary').click()
    await page.locator(field('bomMaterialSkuId')).selectOption('dr_cotton_dye_print')
    await page.locator(action('save-draft')).click()
    await expect(page.getByText('设计改款草稿已保存。')).toBeVisible()
    const url = page.url()
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) {
        // Simulate the remaining origin budget at the failing ledger write.
        if (key === 'higoods.formal-print-execution.v1' && (value.length > 560000 || sessionStorage.getItem('quota-block') === 'yes')) throw new DOMException('quota exceeded', 'QuotaExceededError')
        return original.call(this, key, value)
      }
      document.addEventListener('click', e => {
        if ((e.target as Element).closest('[data-pcs-independent-sampling-action="confirm-scheme"]')) sessionStorage.setItem('quota-start', String(performance.timeOrigin + e.timeStamp))
      }, true)
    })
    if (round === 0) {
      await page.evaluate(() => sessionStorage.setItem('quota-block', 'yes'))
      await page.locator(action('confirm-scheme')).click()
      await expect(page.getByText(/印花操作未保存，原动作已撤回/)).toBeVisible()
      await expect(page.locator(field('bomMaterialSkuId'))).toHaveValue('dr_cotton_dye_print')
      const failed = await page.evaluate(id => JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).find((record: any) => record.samplingTaskId === id), url.split('/').at(-1))
      expect(failed.status).toBe('DRAFT')
      expect(failed.confirmedAt || '').toBe('')
      await page.evaluate(() => sessionStorage.removeItem('quota-block'))
    }
    await page.locator(action('confirm-scheme')).click()
    await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible()
    const metrics = await page.evaluate(async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const elapsed = performance.timeOrigin + performance.now() - Number(sessionStorage.getItem('quota-start'))
      const raw = localStorage.getItem('higoods.formal-print-execution.v1')!
      const data = JSON.parse(raw)
      const expanded = JSON.stringify(data, (key, value) => ['imageUrl', 'targetSpuImageUrl', 'dataUrl'].includes(key) && typeof value === 'string' && value.startsWith('higoods-print-image:v1:') ? data.imageDataUrls[Number(value.split(':').at(-1))] : key === 'imageDataUrls' ? undefined : value)
      return { elapsed, storedChars: raw.length, previousFormatChars: expanded.length }
    })
    expect(metrics.storedChars).toBeLessThan(560000)
    expect(metrics.previousFormatChars).toBeGreaterThan(560000)
    await page.reload()
    await expect(page.getByRole('heading', { name: '本次需要完成的工作' })).toBeVisible()
    await expect(page.locator('[data-design-revision-design-files] img')).toBeVisible()
    expect(await page.locator('[data-design-revision-design-files] img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await page.goto(baseURL + root)
    await page.locator(field('listKeyword')).fill(url.split('/').at(-1)!.replace('ES-ID-', 'ES-'))
    await page.locator(action('query')).click()
    const row = page.locator('tbody tr').filter({ has: page.getByRole('link', { name: url.split('/').at(-1)!.replace('ES-ID-', 'ES-'), exact: true }) })
    await expect(row.locator('[data-design-revision-process-order]')).toHaveCount(1)
    evidence.push(metrics)
    if (round === 0) await page.screenshot({ path: testInfo.outputPath('quota-submitted.png') })
    await context.close()
  }
  await writeFile(testInfo.outputPath('quota-evidence.json'), JSON.stringify(evidence, null, 2))
  for (const item of evidence as { elapsed: number }[]) expect(item.elapsed).toBeLessThan(500)
})
