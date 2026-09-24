import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test('目标物料 SKU 决定染色与印花，工作预览只含纸样和样衣', async ({ page }) => {
  await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer')

  const row = page.locator('[data-independent-bom-line]').first()
  const sku = row.locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]')
  const dyeRequirement = row.locator('[data-pcs-independent-sampling-field="bomDyeRequirement"]')
  const printRequirement = row.locator('[data-pcs-independent-sampling-field="bomPrintRequirement"]')
  const workPreview = page.locator('[data-design-revision-work-preview]')

  await expect(dyeRequirement).toBeDisabled()
  await expect(printRequirement).toBeDisabled()
  for (const [skuId, needsDye, needsPrint] of [
    ['dr_cotton_raw', false, false],
    ['dr_cotton_dyed', true, false],
    ['dr_cotton_print', false, true],
    ['dr_cotton_dye_print', false, true],
  ] as const) {
    await row.locator('summary').click()
    await sku.selectOption(skuId)
    await expect(dyeRequirement).toHaveValue(needsDye ? '是' : '否')
    await expect(printRequirement).toHaveValue(needsPrint ? '是' : '否')
    await expect(workPreview).toContainText('销售展示样衣')
    await expect(workPreview).not.toContainText('花型任务')
    await expect(workPreview).not.toContainText('调色任务')
    if (needsDye) await expect(row).toContainText('潘通')
    if (needsPrint) await expect(row.getByRole('button', { name: '查看花型图' })).toBeVisible()
    if (needsDye && needsPrint) await expect(row).toContainText('无需染色；印花')
  }
})

test('同一设计改款 BOM 的面料 Yard 与辅料 PCS 在买手页面分别计算', async ({ page }) => {
  await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer')
  const rows = page.locator('[data-independent-bom-line]')
  await expect(rows.first()).toBeVisible()
  while(await rows.count()>1)await rows.last().locator('[data-pcs-independent-sampling-action="remove-bom-line"]').click()
  await page.locator('[data-pcs-independent-sampling-action="add-bom-line"]').click()
  await expect(rows).toHaveCount(2)

  await rows.nth(0).locator('summary').click()
  await rows.nth(0).locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('material_accessory_001_sku_001')
  await rows.nth(0).locator('[data-pcs-independent-sampling-field="bomUsage"]').fill('3')
  await rows.nth(1).locator('summary').click()
  await rows.nth(1).locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('dr_cotton_dye_print')
  await rows.nth(1).locator('[data-pcs-independent-sampling-field="bomUsage"]').fill('2')
  await page.locator('[data-pcs-independent-sampling-field="sampleRequirementQuantity"]').fill('2')

  await expect(rows.nth(0).locator('[data-design-revision-bom-subtotal]')).toContainText('计划用量 6.0000 PCS')
  await expect(rows.nth(1).locator('[data-design-revision-bom-subtotal]')).toContainText('计划用量 4.0000 Yard')
  await expect(rows.nth(0)).toContainText('无需染色；无需印花')
  await expect(rows.nth(1)).toContainText('无需染色；印花')
  await page.locator('[data-pcs-independent-sampling-action="confirm-scheme"]').click()
  await expect(page.getByText('任务已提交，基码纸样和印染加工单已按需求生成。')).toBeVisible()
})

test('设计改款生成的染印单展示可加载的款式与物料图片', async ({ page }, testInfo) => {
  await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer')
  await page.locator('[data-independent-bom-line]').first().locator('summary').click()
  await page.locator('[data-independent-bom-line]').first().locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('dr_cotton_dye_print')
  await page.locator('[data-pcs-independent-sampling-action="add-bom-line"]').click()
  await page.locator('[data-independent-bom-line]').last().locator('summary').click()
  await page.locator('[data-independent-bom-line]').last().locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('dr_cotton_dyed')
  await page.locator('[data-pcs-independent-sampling-action="confirm-scheme"]').click()
  await expect(page.getByText('任务已提交，基码纸样和印染加工单已按需求生成。')).toBeVisible()

  const links = page.locator('a[href*="/fcs/craft/"]')
  const hrefs = await links.evaluateAll((items) => items.map((item) => item.getAttribute('href') || ''))
  const dyeHref = hrefs.find((href) => href.includes('/dyeing/'))
  const printHref = hrefs.find((href) => href.includes('/printing/'))
  expect(dyeHref).toBeTruthy()
  expect(printHref).toBeTruthy()

  await page.goto(dyeHref!)
  const dyeStyle = page.locator('img[alt*="STYLE-PRJ-202603-012"]').first()
  await expect(dyeStyle).toHaveAttribute('src', /\/materials\/pcs-reviewed\/tee-black\.jpg$/)
  await expect.poll(() => dyeStyle.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await dyeStyle.locator('..').click()
  await expect(page.locator('[data-pda-image-preview-root] img')).toHaveAttribute('src', /\/materials\/pcs-reviewed\/tee-black\.jpg$/)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)
  await page.route('**/materials/pcs-reviewed/tee-black.jpg', (route) => route.abort())
  await page.reload()
  await expect(page.locator('button[data-pda-image-preview-url$="tee-black.jpg"]').last()).toContainText('图片加载失败')
  await page.unroute('**/materials/pcs-reviewed/tee-black.jpg')

  const dyeOrderId = new URL(dyeHref!, 'http://localhost').searchParams.get('dyeOrderId')
  expect(dyeOrderId).toBeTruthy()
  await page.goto(`/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=${encodeURIComponent(dyeOrderId!)}`)
  const dyeFlowCard = page.locator('[data-dye-flow-source]')
  await expect(dyeFlowCard).toContainText('设计改款任务')
  await expect(dyeFlowCard).toContainText('设计改款任务号')
  await expect(dyeFlowCard).toContainText('ES-DR-001')
  await expect(dyeFlowCard).not.toContainText('备货创建')
  const flowStyle = dyeFlowCard.locator('img[alt*="STYLE-PRJ-202603-012"]').first()
  await expect.poll(() => flowStyle.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  const flowMaterial = dyeFlowCard.locator('img[alt*="设计改款白底蓝花棉布"]').first()
  await expect.poll(() => flowMaterial.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await page.emulateMedia({ media: 'print' })
  expect((await page.pdf({ format: 'A4', printBackground: true })).byteLength).toBeGreaterThan(10_000)
  await page.emulateMedia({ media: 'screen' })

  await page.goto(printHref!)
  const printStyle = page.locator('img[alt*="STYLE-PRJ-202603-012"]').first()
  await expect(printStyle).toHaveAttribute('src', /\/materials\/pcs-reviewed\/tee-black\.jpg$/)
  await expect.poll(() => printStyle.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await printStyle.locator('..').click()
  await expect(page.locator('[data-printing-image-preview] img')).toHaveAttribute('src', /\/materials\/pcs-reviewed\/tee-black\.jpg$/)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-printing-image-preview]')).toHaveCount(0)
  const pattern = page.locator('img[alt*="花型"]').first()
  await expect.poll(() => pattern.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)

  const printOrderId = new URL(printHref!, 'http://localhost').pathname.split('/').at(-1)
  expect(printOrderId).toBeTruthy()
  for (const [documentType, selector] of [
    ['PRINTING_INFO_SHEET', '[data-printing-info]'],
    ['PRINTING_CONFIRMATION', '[data-printing-confirmation]'],
  ] as const) {
    await page.goto(`/fcs/print/preview?documentType=${documentType}&sourceType=PRINTING_WORK_ORDER&sourceId=${encodeURIComponent(printOrderId!)}`)
    const sheet = page.locator(selector)
    await expect(sheet).toContainText('设计改款任务')
    await expect(sheet).toContainText('ES-DR-001')
    await expect(sheet).not.toContainText('Purchase Order (PO)')
    await expect(sheet).not.toContainText('需求单号：—')
    if (documentType === 'PRINTING_CONFIRMATION') {
      await expect(sheet).toContainText('目标花型由 SKU 确定')
      await expect(sheet).toContainText('计划接收方')
      await expect(sheet).toContainText('goto_global')
      await expect(sheet).not.toContainText('Edit confirmation')
      await expect(sheet.locator('img[alt*="正面花型图"]')).toHaveAttribute('src', /\/materials\/fei-ticket\/blue-white-print-cotton\.png$/)
    }
    const sheetImage = sheet.locator('img').first()
    await expect.poll(() => sheetImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    expect(pdf.byteLength).toBeGreaterThan(10_000)
    if (documentType === 'PRINTING_CONFIRMATION') await writeFile(testInfo.outputPath('design-revision-printing-confirmation.pdf'), pdf)
    await page.emulateMedia({ media: 'screen' })
  }
})

test('普通生产来源印花信息单仍展示原生产单号', async ({ page }) => {
  await page.goto('/fcs/print/preview?documentType=PRINTING_INFO_SHEET&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-002')
  const sheet = page.locator('[data-printing-info="PWO-PRINT-002"]')
  await expect(sheet).toContainText('Purchase Order (PO)')
  await expect(sheet).toContainText('PO14673')
  await expect(sheet).not.toContainText('设计改款任务号')
})

test('已完成 Mock 样衣成果逐条说明图片性质并可打开本地大图', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/pcs/production-preparation/display-sample/ES-ID-DR-002-DISPLAY_SAMPLE')
  await expect(page.locator('[data-sample-demo-notice]')).toContainText('未核验为本次实际制作样衣的实拍照片')
  const button = page.getByRole('button', { name: '查看大图' }).first()
  const sampleImageUrl = await button.getAttribute('data-file-url')
  expect(sampleImageUrl).toMatch(/^\/materials\/pcs-reviewed\/.+\.jpg$/)
  const imageRoute = `**${sampleImageUrl}`
  let releaseImage!: () => void
  const imageReady = new Promise<void>((resolve) => { releaseImage = resolve })
  await page.route(imageRoute, async (route) => { await imageReady; await route.continue() })
  await button.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('未核验为本次实际制作样衣的实拍照片')
  await expect(dialog.getByRole('status')).toHaveText('图片加载中…')
  releaseImage()
  const image = dialog.locator('img')
  await expect(image).toHaveAttribute('src', sampleImageUrl!)
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
  await expect(dialog.getByRole('status')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.unroute(imageRoute)
  await page.route(imageRoute, (route) => route.abort())
  await button.click()
  await expect(dialog.getByText('图片加载失败，请重新上传原文件。')).toBeVisible()
  await expect(dialog.getByRole('status')).toBeHidden()
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('样衣提交关联存储失败时页面保留成果，重试完成且刷新不重复', async ({ page }) => {
  await page.goto('/pcs/production-preparation/display-sample/ES-ID-DR-002-DISPLAY_SAMPLE')
  await expect(page.getByRole('heading', { name: '成果记录', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const key = 'higood-pcs-design-revision-v1'
    const records = JSON.parse(localStorage.getItem(key)!)
    const record = records.find((item: { samplingTaskId: string }) => item.samplingTaskId === 'ES-ID-DR-002')
    record.status = 'IN_PROGRESS'
    record.confirmedAt = ''
    const sample = record.professionalTasks.find((item: { taskType: string }) => item.taskType === 'DISPLAY_SAMPLE')
    sample.status = 'WAIT_START'
    sample.results = []
    sample.submittedAt = ''
    localStorage.setItem(key, JSON.stringify(records))
  })
  await page.reload()
  const row = page.locator('[data-sample-result-row]').first()
  await row.locator('[data-pcs-independent-sampling-field="sampleResultPattern"]').selectOption({ index: 1 })
  await row.locator('[data-pcs-independent-sampling-field="sampleResultNote"]').fill('概念效果图，仅供 Mock 演示')
  const chooser = page.waitForEvent('filechooser')
  await row.getByText('选择本地文件', { exact: true }).click()
  await (await chooser).setFiles('public/design-revision-demo/style-prj-202603-012-blue-floral-polo-effect.jpg')
  await expect(row.locator('[data-sample-concept-notice]')).toBeVisible()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    let broken = false
    Storage.prototype.setItem = function (key, value) {
      if (key === 'higood-pcs-project-relation-store-v2') {
        if (JSON.parse(value).relations.some((item: { sourceObjectId: string; sourceStatus: string }) =>
          item.sourceObjectId === 'ES-ID-DR-002' && item.sourceStatus === 'COMPLETED')) broken = true
        if (broken) throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
    ;(window as unknown as { restoreSubmissionStorage: () => void }).restoreSubmissionStorage = () => { Storage.prototype.setItem = original }
  })
  const submit = page.locator('[data-pcs-independent-sampling-action="submit-task"]')
  await submit.click()
  await expect(page.getByText(/样衣成果未提交，任务已恢复/)).toBeVisible()
  await expect(row.locator('[data-pcs-independent-sampling-field="sampleResultNote"]')).toHaveValue('概念效果图，仅供 Mock 演示')
  const failed = await page.evaluate(() => JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).find((item: { samplingTaskId: string }) => item.samplingTaskId === 'ES-ID-DR-002'))
  expect(failed.status).not.toBe('COMPLETED')
  expect(failed.professionalTasks.find((item: { taskType: string }) => item.taskType === 'DISPLAY_SAMPLE').results).toHaveLength(0)
  await page.evaluate(() => (window as unknown as { restoreSubmissionStorage: () => void }).restoreSubmissionStorage())
  await submit.click()
  await expect(page.getByText('本次工作已提交。')).toBeVisible()
  await page.reload()
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).find((item: { samplingTaskId: string }) => item.samplingTaskId === 'ES-ID-DR-002'))
  expect(completed.status).toBe('COMPLETED')
  expect(completed.professionalTasks.find((item: { taskType: string }) => item.taskType === 'DISPLAY_SAMPLE').results).toHaveLength(1)
  await expect(page.locator('[data-sample-concept-notice]')).toBeVisible()
})
