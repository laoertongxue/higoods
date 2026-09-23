import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

type SampleTimingWindow = Window & {
  __sampleNavigationMs?: number
  __sampleActionMs?: number
}

// PERF-001: measure in the browser, including image readiness and two paint frames.
async function measurePreviewAction(page: Page, closing: boolean, action: () => Promise<unknown>, escape = false): Promise<number> {
  await page.evaluate(({ closing, escape }) => {
    const scope = window as SampleTimingWindow
    delete scope.__sampleActionMs
    document.addEventListener(escape ? 'keydown' : 'click', (event) => {
      const startedAt = event.timeStamp
      const probe = () => {
        const dialog = document.querySelector('[data-independent-sampling-dialogs] [role="dialog"]')
        const ready = closing ? !dialog : Boolean(dialog && Array.from(dialog.querySelectorAll('img')).every((image) => image.complete && image.naturalWidth > 0))
        if (!ready) { requestAnimationFrame(probe); return }
        requestAnimationFrame(() => requestAnimationFrame(() => { scope.__sampleActionMs = performance.now() - startedAt }))
      }
      requestAnimationFrame(probe)
    }, { capture: true, once: true })
  }, { closing, escape })
  await action()
  await page.waitForFunction(() => (window as SampleTimingWindow).__sampleActionMs !== undefined)
  return page.evaluate(() => (window as SampleTimingWindow).__sampleActionMs!)
}

test('Mock 样衣图片的冷进入、刷新和预览操作各五次均低于 500ms', async ({ browser, baseURL }, testInfo) => {
  const samples: Record<string, number[]> = {
    coldNavigation: [], reload: [], firstPreview: [], closeButton: [],
    reopenForMask: [], closeMask: [], reopenForEscape: [], closeEscape: [],
  }
  for (let index = 0; index < 5; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } })
    await context.addInitScript(() => {
      const probe = () => {
        const marker = document.querySelector('[data-sample-demo-notice]')
        const images = Array.from(document.querySelectorAll('img')).filter((image) => {
          const rect = image.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
        })
        if (!marker || !images.length || images.some((image) => !image.complete || image.naturalWidth === 0)) {
          requestAnimationFrame(probe)
          return
        }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          (window as SampleTimingWindow).__sampleNavigationMs = performance.now()
        }))
      }
      requestAnimationFrame(probe)
    })
    const page = await context.newPage()
    await page.goto(`${baseURL}/pcs/production-preparation/display-sample/ES-ID-DR-002-DISPLAY_SAMPLE`)
    await page.waitForFunction(() => (window as SampleTimingWindow).__sampleNavigationMs !== undefined)
    samples.coldNavigation.push(await page.evaluate(() => (window as SampleTimingWindow).__sampleNavigationMs!))
    await page.reload()
    await page.waitForFunction(() => (window as SampleTimingWindow).__sampleNavigationMs !== undefined)
    samples.reload.push(await page.evaluate(() => (window as SampleTimingWindow).__sampleNavigationMs!))
    const open = () => page.getByRole('button', { name: '查看大图' }).first().click()
    samples.firstPreview.push(await measurePreviewAction(page, false, open))
    await expect(page.getByRole('dialog')).toContainText('未核验为本次实际制作样衣的实拍照片')
    samples.closeButton.push(await measurePreviewAction(page, true, () => page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()))
    samples.reopenForMask.push(await measurePreviewAction(page, false, open))
    samples.closeMask.push(await measurePreviewAction(page, true, () => page.getByRole('button', { name: '关闭大图', exact: true }).click({ position: { x: 5, y: 5 } })))
    samples.reopenForEscape.push(await measurePreviewAction(page, false, open))
    samples.closeEscape.push(await measurePreviewAction(page, true, () => page.keyboard.press('Escape'), true))
    await context.close()
  }
  const receipt = {
    measuredAt: new Date().toISOString(), baseURL, viewport: '1024x768', browser: browser.version(),
    cache: 'coldNavigation uses a new empty context; reload and actions use that same context',
    endCondition: 'target results and visible images ready, then two animation frames; event.timeStamp for actions',
    distIndexSha256: createHash('sha256').update(await readFile('dist/index.html')).digest('hex'),
    samples,
  }
  await writeFile(testInfo.outputPath('sample-preview-performance.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
  for (const [name, values] of Object.entries(samples)) {
    expect(values, name).toHaveLength(5)
    for (const value of values) expect(value, `${name}: ${value}ms`).toBeLessThan(500)
  }
})
