# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pcs-design-revision-work-preview.spec.ts >> 设计改款生成的染印单展示可加载的款式与物料图片
- Location: tests/pcs-design-revision-work-preview.spec.ts:54:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: locator('img[alt*="STYLE-PRJ-202603-012"]').first()
Expected pattern: /\/materials\/archive\/c74d884c23376156c8dc13a5ff39d3fa\.jpg$/
Received string:  "/materials/pcs-reviewed/tee-black.jpg"
Timeout: 10000ms

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for locator('img[alt*="STYLE-PRJ-202603-012"]').first()
    20 × locator resolved to <img class="h-full w-full object-cover" src="/materials/pcs-reviewed/tee-black.jpg" onload="this.nextElementSibling.hidden=true" alt="STYLE-PRJ-202603-012 Kaos Polos Premium 高端纯色T恤" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/>
       - unexpected value "/materials/pcs-reviewed/tee-black.jpg"

```

```yaml
- img "STYLE-PRJ-202603-012 Kaos Polos Premium 高端纯色T恤"
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test'
  2   | import { writeFile } from 'node:fs/promises'
  3   |
  4   | test('目标物料 SKU 决定染色与印花，工作预览只含纸样和样衣', async ({ page }) => {
  5   |   await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer')
  6   |
  7   |   const row = page.locator('[data-independent-bom-line]').first()
  8   |   const sku = row.locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]')
  9   |   const dyeRequirement = row.locator('[data-pcs-independent-sampling-field="bomDyeRequirement"]')
  10  |   const printRequirement = row.locator('[data-pcs-independent-sampling-field="bomPrintRequirement"]')
  11  |   const workPreview = page.locator('[data-design-revision-work-preview]')
  12  |
  13  |   await expect(dyeRequirement).toBeDisabled()
  14  |   await expect(printRequirement).toBeDisabled()
  15  |   for (const [skuId, needsDye, needsPrint] of [
  16  |     ['dr_cotton_raw', false, false],
  17  |     ['dr_cotton_dyed', true, false],
  18  |     ['dr_cotton_print', false, true],
  19  |     ['dr_cotton_dye_print', true, true],
  20  |   ] as const) {
  21  |     await sku.selectOption(skuId)
  22  |     await expect(dyeRequirement).toHaveValue(needsDye ? '是' : '否')
  23  |     await expect(printRequirement).toHaveValue(needsPrint ? '是' : '否')
  24  |     await expect(workPreview).toContainText('销售展示样衣')
  25  |     await expect(workPreview).not.toContainText('花型任务')
  26  |     await expect(workPreview).not.toContainText('调色任务')
  27  |     if (needsDye) await expect(row).toContainText('潘通')
  28  |     if (needsPrint) await expect(row.getByRole('button', { name: '查看花型图' })).toBeVisible()
  29  |     if (needsDye && needsPrint) await expect(row).toContainText('先染后印')
  30  |   }
  31  | })
  32  |
  33  | test('同一设计改款 BOM 的面料 Yard 与辅料 PCS 在买手页面分别计算', async ({ page }) => {
  34  |   await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer')
  35  |   const rows = page.locator('[data-independent-bom-line]')
  36  |   await expect(rows).toHaveCount(1)
  37  |   await page.locator('[data-pcs-independent-sampling-action="add-bom-line"]').click()
  38  |   await expect(rows).toHaveCount(2)
  39  |
  40  |   await rows.nth(0).locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('material_accessory_001_sku_001')
  41  |   await rows.nth(0).locator('[data-pcs-independent-sampling-field="bomUsage"]').fill('3')
  42  |   await rows.nth(1).locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('dr_cotton_dye_print')
  43  |   await rows.nth(1).locator('[data-pcs-independent-sampling-field="bomUsage"]').fill('2')
  44  |   await page.locator('[data-pcs-independent-sampling-field="sampleRequirementQuantity"]').fill('2')
  45  |
  46  |   await expect(rows.nth(0).locator('[data-design-revision-bom-subtotal]')).toContainText('计划用量 6.0000 PCS')
  47  |   await expect(rows.nth(1).locator('[data-design-revision-bom-subtotal]')).toContainText('计划用量 4.0000 Yard')
  48  |   await expect(rows.nth(0)).toContainText('无需染色；无需印花')
  49  |   await expect(rows.nth(1)).toContainText('先染后印')
  50  |   await page.locator('[data-pcs-independent-sampling-action="confirm-scheme"]').click()
  51  |   await expect(page.getByText('任务已提交，基码纸样和印染加工单已按需求生成。')).toBeVisible()
  52  | })
  53  |
  54  | test('设计改款生成的染印单展示可加载的款式与物料图片', async ({ page }, testInfo) => {
  55  |   await page.goto('/pcs/production-preparation/design-revision/ES-ID-DR-001?step=buyer')
  56  |   await page.locator('[data-independent-bom-line]').first().locator('[data-pcs-independent-sampling-field="bomMaterialSkuId"]').selectOption('dr_cotton_dye_print')
  57  |   await page.locator('[data-pcs-independent-sampling-action="confirm-scheme"]').click()
  58  |   await expect(page.getByText('任务已提交，基码纸样和印染加工单已按需求生成。')).toBeVisible()
  59  |
  60  |   const links = page.locator('a[href*="/fcs/craft/"]')
  61  |   const hrefs = await links.evaluateAll((items) => items.map((item) => item.getAttribute('href') || ''))
  62  |   const dyeHref = hrefs.find((href) => href.includes('/dyeing/'))
  63  |   const printHref = hrefs.find((href) => href.includes('/printing/'))
  64  |   expect(dyeHref).toBeTruthy()
  65  |   expect(printHref).toBeTruthy()
  66  |
  67  |   await page.goto(dyeHref!)
  68  |   const dyeStyle = page.locator('img[alt*="STYLE-PRJ-202603-012"]').first()
> 69  |   await expect(dyeStyle).toHaveAttribute('src', /\/materials\/archive\/c74d884c23376156c8dc13a5ff39d3fa\.jpg$/)
      |                          ^ Error: expect(locator).toHaveAttribute(expected) failed
  70  |   await expect.poll(() => dyeStyle.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  71  |   await dyeStyle.locator('..').click()
  72  |   await expect(page.locator('[data-pda-image-preview-root] img')).toHaveAttribute('src', /\/materials\/archive\/c74d884c23376156c8dc13a5ff39d3fa\.jpg$/)
  73  |   await page.keyboard.press('Escape')
  74  |   await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)
  75  |   await page.route('**/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg', (route) => route.abort())
  76  |   await page.reload()
  77  |   await expect(page.locator('button[data-pda-image-preview-url$="c74d884c23376156c8dc13a5ff39d3fa.jpg"]').last()).toContainText('图片加载失败')
  78  |   await page.unroute('**/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg')
  79  |
  80  |   const dyeOrderId = new URL(dyeHref!, 'http://localhost').searchParams.get('dyeOrderId')
  81  |   expect(dyeOrderId).toBeTruthy()
  82  |   await page.goto(`/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=${encodeURIComponent(dyeOrderId!)}`)
  83  |   const dyeFlowCard = page.locator('[data-dye-flow-source]')
  84  |   await expect(dyeFlowCard).toContainText('设计改款任务')
  85  |   await expect(dyeFlowCard).toContainText('设计改款任务号')
  86  |   await expect(dyeFlowCard).toContainText('ES-DR-001')
  87  |   await expect(dyeFlowCard).not.toContainText('备货创建')
  88  |   const flowStyle = dyeFlowCard.locator('img[alt*="STYLE-PRJ-202603-012"]').first()
  89  |   await expect.poll(() => flowStyle.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  90  |   const flowMaterial = dyeFlowCard.locator('img[alt*="设计改款白底蓝花棉布"]').first()
  91  |   await expect.poll(() => flowMaterial.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  92  |   await page.emulateMedia({ media: 'print' })
  93  |   expect((await page.pdf({ format: 'A4', printBackground: true })).byteLength).toBeGreaterThan(10_000)
  94  |   await page.emulateMedia({ media: 'screen' })
  95  |
  96  |   await page.goto(printHref!)
  97  |   const printStyle = page.locator('img[alt*="STYLE-PRJ-202603-012"]').first()
  98  |   await expect(printStyle).toHaveAttribute('src', /\/materials\/archive\/c74d884c23376156c8dc13a5ff39d3fa\.jpg$/)
  99  |   await expect.poll(() => printStyle.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  100 |   await printStyle.locator('..').click()
  101 |   await expect(page.locator('[data-printing-image-preview] img')).toHaveAttribute('src', /\/materials\/archive\/c74d884c23376156c8dc13a5ff39d3fa\.jpg$/)
  102 |   await page.keyboard.press('Escape')
  103 |   await expect(page.locator('[data-printing-image-preview]')).toHaveCount(0)
  104 |   const pattern = page.locator('img[alt*="花型"]').first()
  105 |   await expect.poll(() => pattern.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  106 |
  107 |   const printOrderId = new URL(printHref!, 'http://localhost').pathname.split('/').at(-1)
  108 |   expect(printOrderId).toBeTruthy()
  109 |   for (const [documentType, selector] of [
  110 |     ['PRINTING_INFO_SHEET', '[data-printing-info]'],
  111 |     ['PRINTING_CONFIRMATION', '[data-printing-confirmation]'],
  112 |   ] as const) {
  113 |     await page.goto(`/fcs/print/preview?documentType=${documentType}&sourceType=PRINTING_WORK_ORDER&sourceId=${encodeURIComponent(printOrderId!)}`)
  114 |     const sheet = page.locator(selector)
  115 |     await expect(sheet).toContainText('设计改款任务')
  116 |     await expect(sheet).toContainText('ES-DR-001')
  117 |     await expect(sheet).not.toContainText('Purchase Order (PO)')
  118 |     await expect(sheet).not.toContainText('需求单号：—')
  119 |     if (documentType === 'PRINTING_CONFIRMATION') {
  120 |       await expect(sheet).toContainText('目标花型由 SKU 确定')
  121 |       await expect(sheet).toContainText('计划接收方')
  122 |       await expect(sheet).toContainText('goto_global')
  123 |       await expect(sheet).not.toContainText('Edit confirmation')
  124 |       await expect(sheet.locator('img[alt*="正面花型图"]')).toHaveAttribute('src', /\/materials\/fei-ticket\/blue-white-print-cotton\.png$/)
  125 |     }
  126 |     const sheetImage = sheet.locator('img').first()
  127 |     await expect.poll(() => sheetImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  128 |     await page.emulateMedia({ media: 'print' })
  129 |     const pdf = await page.pdf({ format: 'A4', printBackground: true })
  130 |     expect(pdf.byteLength).toBeGreaterThan(10_000)
  131 |     if (documentType === 'PRINTING_CONFIRMATION') await writeFile(testInfo.outputPath('design-revision-printing-confirmation.pdf'), pdf)
  132 |     await page.emulateMedia({ media: 'screen' })
  133 |   }
  134 | })
  135 |
  136 | test('普通生产来源印花信息单仍展示原生产单号', async ({ page }) => {
  137 |   await page.goto('/fcs/print/preview?documentType=PRINTING_INFO_SHEET&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-002')
  138 |   const sheet = page.locator('[data-printing-info="PWO-PRINT-002"]')
  139 |   await expect(sheet).toContainText('Purchase Order (PO)')
  140 |   await expect(sheet).toContainText('PO14673')
  141 |   await expect(sheet).not.toContainText('设计改款任务号')
  142 | })
  143 |
  144 | test('已完成 Mock 样衣成果逐条说明图片性质并可打开本地大图', async ({ page }) => {
  145 |   await page.setViewportSize({ width: 1024, height: 768 })
  146 |   await page.goto('/pcs/production-preparation/display-sample/ES-ID-DR-002-DISPLAY_SAMPLE')
  147 |   await expect(page.locator('[data-sample-demo-notice]')).toContainText('未核验为本次实际制作样衣的实拍照片')
  148 |   const imageRoute = '**/materials/archive/4b45b816574f99080d0b06f30c9464af.jpg'
  149 |   let releaseImage!: () => void
  150 |   const imageReady = new Promise<void>((resolve) => { releaseImage = resolve })
  151 |   await page.route(imageRoute, async (route) => { await imageReady; await route.continue() })
  152 |   const button = page.getByRole('button', { name: '查看大图' }).first()
  153 |   await button.click()
  154 |   const dialog = page.getByRole('dialog')
  155 |   await expect(dialog).toContainText('未核验为本次实际制作样衣的实拍照片')
  156 |   await expect(dialog.getByRole('status')).toHaveText('图片加载中…')
  157 |   releaseImage()
  158 |   const image = dialog.locator('img')
  159 |   await expect(image).toHaveAttribute('src', '/materials/archive/4b45b816574f99080d0b06f30c9464af.jpg')
  160 |   await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
  161 |   await expect(dialog.getByRole('status')).toBeHidden()
  162 |   await page.keyboard.press('Escape')
  163 |   await expect(dialog).toHaveCount(0)
  164 |   await page.unroute(imageRoute)
  165 |   await page.route(imageRoute, (route) => route.abort())
  166 |   await button.click()
  167 |   await expect(dialog.getByText('图片加载失败，请重新上传原文件。')).toBeVisible()
  168 |   await expect(dialog.getByRole('status')).toBeHidden()
  169 |   await dialog.getByRole('button', { name: '关闭', exact: true }).click()
```
