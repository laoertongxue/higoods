# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pcs-design-revision-work-preview.spec.ts >> 样衣提交关联存储失败时页面保留成果，重试完成且刷新不重复
- Location: tests/pcs-design-revision-work-preview.spec.ts:173:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sample-result-row]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sample-result-row]').first()

```

```yaml
- banner:
  - text: HG HiGood
  - button "商品中心系统 (PCS)"
  - button "采购管理系统 (PMS)"
  - button "工厂生产协同系统 (FCS)"
  - button "工艺工厂运营系统 (PFOS)"
  - button "仓储物流系统 (WLS)"
  - button "直播运营系统 (LOS)"
  - button "订单管理系统 (OMS)"
  - button "业财一体化系统 (BFIS)"
  - button "数据决策系统 (DDS)"
  - button "通知":
    - img
  - button "管理员":
    - img
    - text: 管理员
    - img
- complementary:
  - heading "商品中心系统" [level=2]
  - paragraph: PCS
  - button "收起菜单":
    - img
  - button "商品中心系统":
    - text: 商品中心系统
    - img
  - button "商品测款":
    - img
    - text: 商品测款
    - img
  - button "生产准备管理":
    - img
    - text: 生产准备管理
    - img
  - button "技术资料":
    - img
    - text: 技术资料
    - img
  - button "样衣管理":
    - img
    - text: 样衣管理
    - img
  - button "商品&物料档案":
    - img
    - text: 商品&物料档案
    - img
  - button "系统设置":
    - img
    - text: 系统设置
    - img
- main:
  - heading "销售展示样衣任务" [level=1]
  - text: 已完成
  - paragraph: ES-DR-002 · 目标款式 STYLE-PRJ-202603-011 · 来源：设计改款
  - link "返回主任务":
    - /url: /pcs/production-preparation/design-revision/ES-ID-DR-002
  - button "Jaket Hoodie Unisex 连帽夹克":
    - img "Jaket Hoodie Unisex 连帽夹克"
  - paragraph: Jaket Hoodie Unisex 连帽夹克
  - paragraph: STYLE-PRJ-202603-011
  - paragraph: 当前需处理的团队
  - paragraph: "-"
  - paragraph: 需要先完成
  - paragraph: 基码纸样
  - paragraph: 完成后去向
  - paragraph: 设计改款任务自动完成
  - paragraph: 当前动作
  - paragraph: 本项工作已完成
  - heading "买手确认的制作要求" [level=2]
  - paragraph: 要求合计 1 件
  - text: 实际 1 件 · 数量一致
  - table:
    - rowgroup:
      - row "颜色 尺码 要求数量 制作要求 确认人":
        - columnheader "颜色"
        - columnheader "尺码"
        - columnheader "要求数量"
        - columnheader "制作要求"
        - columnheader "确认人"
    - rowgroup:
      - row "整款 M 1 件 历史演示样衣要求 买手-阿乐 2026-07-02 09:00:00":
        - cell "整款"
        - cell "M"
        - cell "1 件"
        - cell "历史演示样衣要求"
        - cell "买手-阿乐 2026-07-02 09:00:00"
  - heading "成果记录" [level=2]
  - paragraph: Mock 演示：概念效果图仅用于展示提交流程，不代表实物样衣照片或真实生产成果。
  - article:
    - strong: 整款 / M 销售展示样衣
    - text: 已通过
    - term: 版本
    - definition: v1.0
    - term: 制作数量
    - definition: 1 件
    - term: 颜色
    - definition: 整款
    - term: 尺码
    - definition: M
    - term: 使用纸样
    - definition: 基码纸样 v1.0
    - term: 对应制作要求
    - definition: 整款 / M / 1 件
    - term: 说明
    - definition: 已按买手确认的颜色、尺码和数量完成销售展示样衣。
    - paragraph: Mock 演示图片 · 未核验为本次实际制作样衣的实拍照片。
    - text: es-id-dr-002-display_sample-1-1.jpg · 281 KB · 第 1 轮
    - button "查看大图"
    - link "下载":
      - /url: /materials/archive/4b45b816574f99080d0b06f30c9464af.jpg
  - heading "操作记录" [level=2]
  - paragraph: 2026-07-02 09:00:00 · 买手-阿乐 · 创建任务 · 设计改款任务已创建，并上传设计稿：es-dr-002-design-1.jpg。本次需要重新制版。基于参照款和设计稿完成目标款式的设计改款。
- button "查生产":
  - img
```

# Test source

```ts
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
  170 |   await expect(dialog).toHaveCount(0)
  171 | })
  172 |
  173 | test('样衣提交关联存储失败时页面保留成果，重试完成且刷新不重复', async ({ page }) => {
  174 |   await page.goto('/pcs/production-preparation/display-sample/ES-ID-DR-002-DISPLAY_SAMPLE')
> 175 |   await expect(page.locator('[data-sample-result-row]').first()).toBeVisible()
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  176 |   await page.evaluate(() => {
  177 |     const key = 'higood-pcs-design-revision-v1'
  178 |     const records = JSON.parse(localStorage.getItem(key)!)
  179 |     const record = records.find((item: { samplingTaskId: string }) => item.samplingTaskId === 'ES-ID-DR-002')
  180 |     record.status = 'IN_PROGRESS'
  181 |     record.confirmedAt = ''
  182 |     const sample = record.professionalTasks.find((item: { taskType: string }) => item.taskType === 'DISPLAY_SAMPLE')
  183 |     sample.status = 'WAIT_START'
  184 |     sample.results = []
  185 |     sample.submittedAt = ''
  186 |     localStorage.setItem(key, JSON.stringify(records))
  187 |   })
  188 |   await page.reload()
  189 |   const row = page.locator('[data-sample-result-row]').first()
  190 |   await row.locator('[data-pcs-independent-sampling-field="sampleResultPattern"]').selectOption({ index: 1 })
  191 |   await row.locator('[data-pcs-independent-sampling-field="sampleResultNote"]').fill('概念效果图，仅供 Mock 演示')
  192 |   const chooser = page.waitForEvent('filechooser')
  193 |   await row.getByText('选择本地文件', { exact: true }).click()
  194 |   await (await chooser).setFiles('public/design-revision-demo/style-prj-202603-012-blue-floral-polo-effect.jpg')
  195 |   await expect(row.locator('[data-sample-concept-notice]')).toBeVisible()
  196 |   await page.evaluate(() => {
  197 |     const original = Storage.prototype.setItem
  198 |     let broken = false
  199 |     Storage.prototype.setItem = function (key, value) {
  200 |       if (key === 'higood-pcs-project-relation-store-v2') {
  201 |         if (JSON.parse(value).relations.some((item: { sourceObjectId: string; sourceStatus: string }) =>
  202 |           item.sourceObjectId === 'ES-ID-DR-002' && item.sourceStatus === 'COMPLETED')) broken = true
  203 |         if (broken) throw new DOMException('quota exceeded', 'QuotaExceededError')
  204 |       }
  205 |       return original.call(this, key, value)
  206 |     }
  207 |     ;(window as unknown as { restoreSubmissionStorage: () => void }).restoreSubmissionStorage = () => { Storage.prototype.setItem = original }
  208 |   })
  209 |   const submit = page.locator('[data-pcs-independent-sampling-action="submit-task"]')
  210 |   await submit.click()
  211 |   await expect(page.getByText(/样衣成果未提交，任务已恢复/)).toBeVisible()
  212 |   await expect(row.locator('[data-pcs-independent-sampling-field="sampleResultNote"]')).toHaveValue('概念效果图，仅供 Mock 演示')
  213 |   const failed = await page.evaluate(() => JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).find((item: { samplingTaskId: string }) => item.samplingTaskId === 'ES-ID-DR-002'))
  214 |   expect(failed.status).not.toBe('COMPLETED')
  215 |   expect(failed.professionalTasks.find((item: { taskType: string }) => item.taskType === 'DISPLAY_SAMPLE').results).toHaveLength(0)
  216 |   await page.evaluate(() => (window as unknown as { restoreSubmissionStorage: () => void }).restoreSubmissionStorage())
  217 |   await submit.click()
  218 |   await expect(page.getByText('本次工作已提交。')).toBeVisible()
  219 |   await page.reload()
  220 |   const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).find((item: { samplingTaskId: string }) => item.samplingTaskId === 'ES-ID-DR-002'))
  221 |   expect(completed.status).toBe('COMPLETED')
  222 |   expect(completed.professionalTasks.find((item: { taskType: string }) => item.taskType === 'DISPLAY_SAMPLE').results).toHaveLength(1)
  223 |   await expect(page.locator('[data-sample-concept-notice]')).toBeVisible()
  224 | })
  225 |
```
