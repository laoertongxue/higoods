# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> Web 质检精准领取、原因汇总、返工工厂与款式颜色图片
- Location: tests/post-finishing-full-flow.spec.ts:370:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-qc-result-line]')
Expected: 5
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('[data-qc-result-line]')
    24 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]: HG
      - generic [ref=e8]: HiGood
    - generic [ref=e10]:
      - button "商品中心系统 (PCS)" [ref=e11]:
        - generic [ref=e12]: 商品中心系统
        - generic [ref=e13]: (PCS)
      - button "采购管理系统 (PMS)" [ref=e14]:
        - generic [ref=e15]: 采购管理系统
        - generic [ref=e16]: (PMS)
      - button "工厂生产协同系统 (FCS)" [ref=e17]:
        - generic [ref=e18]: 工厂生产协同系统
        - generic [ref=e19]: (FCS)
      - button "工艺工厂运营系统 (PFOS)" [ref=e20]:
        - generic [ref=e21]: 工艺工厂运营系统
        - generic [ref=e22]: (PFOS)
      - button "仓储物流系统 (WLS)" [ref=e24]:
        - generic [ref=e25]: 仓储物流系统
        - generic [ref=e26]: (WLS)
      - button "直播运营系统 (LOS)" [ref=e27]:
        - generic [ref=e28]: 直播运营系统
        - generic [ref=e29]: (LOS)
      - button "订单管理系统 (OMS)" [ref=e30]:
        - generic [ref=e31]: 订单管理系统
        - generic [ref=e32]: (OMS)
      - button "业财一体化系统 (BFIS)" [ref=e33]:
        - generic [ref=e34]: 业财一体化系统
        - generic [ref=e35]: (BFIS)
      - button "数据决策系统 (DDS)" [ref=e36]:
        - generic [ref=e37]: 数据决策系统
        - generic [ref=e38]: (DDS)
    - generic [ref=e39]:
      - button "通知" [ref=e40]:
        - img [ref=e41]
      - button "管理员" [ref=e45]:
        - img [ref=e47]
        - generic [ref=e50]: 管理员
        - img [ref=e51]
  - generic [ref=e53]:
    - complementary [ref=e55]:
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]:
            - heading "工艺工厂运营系统" [level=2] [ref=e59]
            - paragraph [ref=e60]: PFOS
          - button "收起菜单" [ref=e61]:
            - img [ref=e62]
        - generic [ref=e66]:
          - generic [ref=e67]:
            - button "裁床厂管理" [expanded] [ref=e68]:
              - img [ref=e70]
              - generic [ref=e76]: 裁床厂管理
              - img [ref=e77]
            - generic [ref=e79]:
              - button "裁床总览" [ref=e81]:
                - img [ref=e83]
                - generic [ref=e89]: 裁床总览
                - img [ref=e90]
              - button "裁前准备" [ref=e93]:
                - img [ref=e95]
                - generic [ref=e101]: 裁前准备
                - img [ref=e102]
              - button "接收管理" [ref=e105]:
                - img [ref=e107]
                - generic [ref=e112]: 接收管理
                - img [ref=e113]
              - button "铺布执行" [ref=e116]:
                - img [ref=e118]
                - generic [ref=e120]: 铺布执行
                - img [ref=e121]
              - button "裁后处理" [ref=e124]:
                - img [ref=e126]
                - generic [ref=e131]: 裁后处理
                - img [ref=e132]
              - button "裁床仓库管理" [ref=e135]:
                - img [ref=e137]
                - generic [ref=e140]: 裁床仓库管理
                - img [ref=e141]
              - button "裁床统计" [ref=e144]:
                - img [ref=e146]
                - generic [ref=e148]: 裁床统计
                - img [ref=e149]
          - generic [ref=e151]:
            - button "印花厂管理" [expanded] [ref=e152]:
              - img [ref=e154]
              - generic [ref=e160]: 印花厂管理
              - img [ref=e161]
            - button "印花管理" [ref=e165]:
              - img [ref=e167]
              - generic [ref=e173]: 印花管理
              - img [ref=e174]
          - generic [ref=e176]:
            - button "染厂管理" [expanded] [ref=e177]:
              - img [ref=e179]
              - generic [ref=e181]: 染厂管理
              - img [ref=e182]
            - button "染厂管理" [ref=e186]:
              - img [ref=e188]
              - generic [ref=e190]: 染厂管理
              - img [ref=e191]
          - generic [ref=e193]:
            - button "毛织厂管理" [expanded] [ref=e194]:
              - img [ref=e196]
              - generic [ref=e198]: 毛织厂管理
              - img [ref=e199]
            - button "毛织管理" [ref=e203]:
              - img [ref=e205]
              - generic [ref=e207]: 毛织管理
              - img [ref=e208]
          - generic [ref=e210]:
            - button "辅料工厂管理" [expanded] [ref=e211]:
              - img [ref=e213]
              - generic [ref=e216]: 辅料工厂管理
              - img [ref=e217]
            - generic [ref=e219]:
              - button "花边厂管理" [ref=e221]:
                - generic [ref=e224]: 花边厂管理
                - img [ref=e225]
              - button "织带厂管理" [ref=e228]:
                - img [ref=e230]
                - generic [ref=e233]: 织带厂管理
                - img [ref=e234]
          - generic [ref=e236]:
            - button "后道工厂管理" [expanded] [ref=e237]:
              - img [ref=e239]
              - generic [ref=e244]: 后道工厂管理
              - img [ref=e245]
            - generic [ref=e248]:
              - button "后道工厂管理" [ref=e249]:
                - img [ref=e251]
                - generic [ref=e256]: 后道工厂管理
                - img [ref=e257]
              - generic [ref=e259]:
                - button "后道生产任务" [ref=e260]:
                  - img [ref=e262]
                  - text: 后道生产任务
                - button "后道辅料调拨单" [ref=e265]:
                  - img [ref=e267]
                  - text: 后道辅料调拨单
                - button "执行质检" [ref=e271]:
                  - img [ref=e273]
                  - text: 执行质检
                - button "质检清单" [ref=e277]:
                  - img [ref=e279]
                  - text: 质检清单
                - button "后道加工单" [ref=e283]:
                  - img [ref=e285]
                  - text: 后道加工单
                - button "复检单" [ref=e288]:
                  - img [ref=e290]
                  - text: 复检单
                - button "后道待加工仓" [ref=e295]:
                  - img [ref=e297]
                  - text: 后道待加工仓
                - button "后道待交出仓" [ref=e300]:
                  - img [ref=e302]
                  - text: 后道待交出仓
                - button "后道出货单" [ref=e307]:
                  - img [ref=e309]
                  - text: 后道出货单
                - button "差异与操作日志" [ref=e314]:
                  - img [ref=e316]
                  - text: 差异与操作日志
                - button "我的动态授权码" [ref=e320]:
                  - img [ref=e322]
                  - text: 我的动态授权码
                - button "成衣 SPU 替换" [ref=e325]:
                  - img [ref=e327]
                  - text: 成衣 SPU 替换
          - generic [ref=e332]:
            - button "辅助工艺工厂管理" [expanded] [ref=e333]:
              - img [ref=e335]
              - generic [ref=e337]: 辅助工艺工厂管理
              - img [ref=e338]
            - generic [ref=e340]:
              - button "打揽加工单" [ref=e342]:
                - img [ref=e344]
                - generic [ref=e346]: 打揽加工单
              - button "打条加工单" [ref=e348]:
                - img [ref=e350]
                - generic [ref=e352]: 打条加工单
              - button "烫画加工单" [ref=e354]:
                - img [ref=e356]
                - generic [ref=e358]: 烫画加工单
              - button "直喷加工单" [ref=e360]:
                - img [ref=e362]
                - generic [ref=e364]: 直喷加工单
              - button "布包扣加工单" [ref=e366]:
                - img [ref=e368]
                - generic [ref=e370]: 布包扣加工单
              - button "绣花加工单" [ref=e372]:
                - img [ref=e374]
                - generic [ref=e376]: 绣花加工单
              - button "压褶加工单" [ref=e378]:
                - img [ref=e380]
                - generic [ref=e382]: 压褶加工单
              - button "缝边绣加工单" [ref=e384]:
                - img [ref=e386]
                - generic [ref=e388]: 缝边绣加工单
              - button "盘扣加工单" [ref=e390]:
                - img [ref=e392]
                - generic [ref=e394]: 盘扣加工单
              - button "花朵加工单" [ref=e396]:
                - img [ref=e398]
                - generic [ref=e400]: 花朵加工单
              - button "打褶加工单" [ref=e402]:
                - img [ref=e404]
                - generic [ref=e406]: 打褶加工单
              - button "烫钻加工单" [ref=e408]:
                - img [ref=e410]
                - generic [ref=e412]: 烫钻加工单
              - button "辅助工艺待加工仓" [ref=e414]:
                - img [ref=e416]
                - generic [ref=e419]: 辅助工艺待加工仓
              - button "辅助工艺待交出仓" [ref=e421]:
                - img [ref=e423]
                - generic [ref=e428]: 辅助工艺待交出仓
          - generic [ref=e429]:
            - button "特种工艺工厂管理" [expanded] [ref=e430]:
              - img [ref=e432]
              - generic [ref=e434]: 特种工艺工厂管理
              - img [ref=e435]
            - generic [ref=e437]:
              - button "模板工序加工单" [ref=e439]:
                - img [ref=e441]
                - generic [ref=e443]: 模板工序加工单
              - button "激光开袋加工单" [ref=e445]:
                - img [ref=e447]
                - generic [ref=e449]: 激光开袋加工单
              - button "特种车缝（花样机）加工单" [ref=e451]:
                - img [ref=e453]
                - generic [ref=e455]: 特种车缝（花样机）加工单
              - button "橡筋定长切割加工单" [ref=e457]:
                - img [ref=e459]
                - generic [ref=e461]: 橡筋定长切割加工单
              - button "特种工艺待加工仓" [ref=e463]:
                - img [ref=e465]
                - generic [ref=e468]: 特种工艺待加工仓
              - button "特种工艺待交出仓" [ref=e470]:
                - img [ref=e472]
                - generic [ref=e477]: 特种工艺待交出仓
    - main [ref=e478]:
      - generic [ref=e480]:
        - generic [ref=e482]:
          - button "执行质检" [ref=e483]
          - button [ref=e484]:
            - img [ref=e485]
        - button "全部关闭" [ref=e490]
      - generic [ref=e493]: 页面内容加载失败，请稍后重试。
  - button "查生产" [ref=e494]:
    - img [ref=e495]
```

# Test source

```ts
  276 |   await expect(page.getByRole('button', { name: '回货记录（5）' })).toHaveCount(3)
  277 |   await expect(page.locator('[data-standard-list-stats]')).toContainText('后道生产任务')
  278 |   await attachPageEvidence(page, testInfo, 'default-demo-post-finishing-tasks')
  279 | 
  280 |   await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=returns')
  281 |   await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  282 |   await expect(page.locator('[data-return-card]')).toHaveCount(15)
  283 |   await attachPageEvidence(page, testInfo, 'default-demo-wait-process-pending')
  284 | 
  285 |   await page.locator('[data-nav*="tab=inventory"]').click()
  286 |   await expect(page.locator('[data-warehouse-sku-row]')).toHaveCount(15)
  287 |   await attachPageEvidence(page, testInfo, 'default-demo-wait-process-inventory')
  288 | 
  289 |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  290 |   await expect(page.getByRole('heading', { name: '后道待交出仓' })).toBeVisible()
  291 |   await expect(page.locator('[data-warehouse-sku-row]')).toHaveCount(5)
  292 |   await attachPageEvidence(page, testInfo, 'default-demo-wait-handover-inventory')
  293 | 
  294 |   await setCurrentWebActor(page, 'PF-USER-QC-MGR')
  295 |   await page.goto('/fcs/craft/post-finishing/qc-orders')
  296 |   await expect(page.locator('tbody tr')).toHaveCount(12)
  297 |   await page.goto('/fcs/craft/post-finishing/audit-records')
  298 |   await expect(page.locator('body')).toContainText('业务链（每次回货一条）')
  299 |   await expect(page.locator('body')).toContainText('15')
  300 | })
  301 | 
  302 | test('三类任务责任、质检分流和后道辅料调拨均在现有页面骨架内展示', async ({ page }, testInfo) => {
  303 |   await page.setViewportSize({ width: 1280, height: 720 })
  304 |   await page.goto('/fcs/craft/post-finishing/tasks')
  305 |   await expect(page.locator('tbody tr').filter({ hasText: /PO-QC-202608-00[123]/ })).toHaveCount(3)
  306 |   await expect(page.locator('tbody')).toContainText('仅车缝')
  307 |   await expect(page.locator('tbody')).toContainText('车缝＋烫包')
  308 |   await expect(page.locator('tbody')).toContainText('裁剪＋车缝＋烫包')
  309 |   await expect(page.locator('tbody')).toContainText('后道项目由QC确认')
  310 |   await expect(page.locator('tbody')).toContainText('后道项目由QC确认')
  311 |   const statTops = await page.locator('[data-standard-list-stats] > div').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)))
  312 |   expect(new Set(statTops).size).toBe(1)
  313 |   await expectNoBodyOverflow(page)
  314 |   await attachPageEvidence(page, testInfo, 'web-post-production-task-responsibility')
  315 | 
  316 |   await page.goto('/fcs/craft/post-finishing/material-transfers')
  317 |   await expect(page.getByRole('heading', { name: '后道辅料调拨单', exact: true })).toBeVisible()
  318 |   await expect(page.getByRole('heading', { name: '调拨单列表', exact: true })).toBeVisible()
  319 |   const acceptanceTransfer = page.locator('tbody tr').filter({ hasText: 'DB-PF-202608-001' })
  320 |   await expect(acceptanceTransfer).toHaveCount(1)
  321 |   await expect(page.locator('[data-material-transfer-detail]')).toHaveCount(0)
  322 |   await acceptanceTransfer.locator('[data-nav*="material-transfers?transferId="]').click()
  323 |   const drawer = page.getByRole('dialog', { name: '后道辅料调拨单详情' })
  324 |   await expect(drawer).toBeVisible()
  325 |   await expect(page.locator('[data-standard-list-table-section]')).toHaveCount(1)
  326 |   await expect(drawer.locator('tbody tr')).toHaveCount(4)
  327 |   await expect(drawer).toContainText('不允许分批入库')
  328 |   await expect(drawer.locator('input[type="number"]')).toHaveCount(0)
  329 |   await expectImagesLoaded(page)
  330 |   await attachPageEvidence(page, testInfo, 'web-material-transfer-list-and-detail-drawer')
  331 |   await drawer.locator('[data-nav="/fcs/craft/post-finishing/material-transfers"]').click()
  332 |   await expect(drawer).toHaveCount(0)
  333 | 
  334 |   await setCurrentWebActor(page, 'PF-USER-QC-B')
  335 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  336 |   await page.evaluate(async (taskNo) => {
  337 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  338 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  339 |     await records.ensurePostFinishingRecordState()
  340 |     await records.runPostFinishingCommand(() => flow.claimPostFinishingQcTask({ qcTaskNo: taskNo, actor: flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcB, nowMs: Date.now() }))
  341 |   }, 'PO-QC-202608-001-3-ZJ')
  342 |   await page.reload()
  343 |   const fixedItems = page.locator('[data-qc-process-item]')
  344 |   await expect(fixedItems).toHaveCount(4)
  345 |   expect(await fixedItems.evaluateAll((nodes) => nodes.every((node) => (node as HTMLInputElement).checked && !(node as HTMLInputElement).disabled))).toBe(true)
  346 |   await expect(page.locator('[data-qc-complete-label]')).toHaveText('完成质检并生成后道加工单')
  347 |   await attachPageEvidence(page, testInfo, 'web-qc-only-sewing-editable-four-process-items')
  348 | 
  349 |   page.once('dialog', dialog => dialog.accept())
  350 |   await page.getByRole('button', { name: '完成质检并生成后道加工单' }).click()
  351 |   await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toBeVisible()
  352 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  353 |   await page.evaluate(async (taskNo) => {
  354 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  355 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  356 |     await records.ensurePostFinishingRecordState()
  357 |     await records.runPostFinishingCommand(() => flow.claimPostFinishingQcTask({ qcTaskNo: taskNo, actor: flow.POST_FINISHING_ACCEPTANCE_ACTORS.qcB, nowMs: Date.now() }))
  358 |   }, 'PO-QC-202608-003-3-ZJ')
  359 |   await page.reload()
  360 |   const optionalItems = page.locator('[data-qc-process-item]')
  361 |   await expect(optionalItems).toHaveCount(4)
  362 |   expect(await optionalItems.evaluateAll((nodes) => nodes.every((node) => !(node as HTMLInputElement).checked && !(node as HTMLInputElement).disabled))).toBe(true)
  363 |   await expect(page.locator('[data-qc-complete-label]')).toHaveText('完成质检并交接成衣仓')
  364 |   await page.locator('[data-qc-process-item][value="包装"]').check()
  365 |   await expect(page.locator('[data-qc-complete-label]')).toHaveText('完成质检并生成后道加工单')
  366 |   await expectNoBodyOverflow(page)
  367 |   await attachPageEvidence(page, testInfo, 'web-qc-third-party-optional-process-items')
  368 | })
  369 | 
  370 | test('Web 质检精准领取、原因汇总、返工工厂与款式颜色图片', async ({ page }, testInfo) => {
  371 |   const seed = await seedBrowserFlow(page)
  372 |   await setCurrentWebActor(page, 'PF-USER-QC-A')
  373 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  374 |   await page.locator('[data-post-finishing-field="qc-task-input"]').fill(seed.qcTaskNo)
  375 |   await page.getByRole('button', { name: '领取质检单', exact: true }).click()
> 376 |   await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
      |                                                       ^ Error: expect(locator).toHaveCount(expected) failed
  377 |   await expect(page.locator('[data-qc-spu-color-images]')).toContainText('SPU-QC-001')
  378 |   await expect(page.locator('[data-qc-spu-color-images] figure')).toHaveCount(5)
  379 |   await expect(page.getByRole('button', { name: '取消', exact: true })).toHaveCount(0)
  380 |   await expectImagesLoaded(page)
  381 |   const firstLine = page.locator('[data-qc-result-line]').first()
  382 |   const firstPassed = firstLine.locator('[data-qc-result-field="passedQty"]')
  383 |   const defectTotal = firstLine.locator('[data-qc-result-field="defectQty"]')
  384 |   const colorDifference = firstLine.locator('[data-qc-defect-reason="色差"]')
  385 |   await expect(defectTotal).toHaveAttribute('readonly', '')
  386 |   const authorizationBlock = page.locator('[data-qc-difference-authorization]')
  387 |   await expect(authorizationBlock).toBeHidden()
  388 |   await firstPassed.fill('19')
  389 |   await expect(page.locator('[data-qc-live-summary]')).toContainText('1 个 SKU 有差异')
  390 |   await expect(page.locator('[data-qc-live-summary]')).toContainText('整单差异 -1 件')
  391 |   await expect(authorizationBlock).toBeVisible()
  392 |   await colorDifference.fill('1')
  393 |   await expect(defectTotal).toHaveValue('1')
  394 |   await expect(page.locator('[data-qc-live-summary]')).toContainText('0 个 SKU 有差异')
  395 |   await expect(authorizationBlock).toBeHidden()
  396 |   await colorDifference.fill('2')
  397 |   await expect(defectTotal).toHaveValue('2')
  398 |   await expect(authorizationBlock).toBeVisible()
  399 |   await colorDifference.fill('0')
  400 |   await firstPassed.fill('20')
  401 |   await expect(defectTotal).toHaveValue('0')
  402 |   await expect(authorizationBlock).toBeHidden()
  403 | 
  404 |   const reworkQty = firstLine.locator('[data-qc-result-field="returnQty"]')
  405 |   const reworkBlock = firstLine.locator('[data-qc-rework-factory-block]')
  406 |   const reworkFactory = firstLine.locator('[data-qc-result-field="returnReceiver"]')
  407 |   await expect(reworkBlock).toBeHidden()
  408 |   await expect(reworkFactory).toBeDisabled()
  409 |   await reworkQty.fill('1')
  410 |   await expect(reworkBlock).toBeVisible()
  411 |   await expect(reworkFactory).toBeEnabled()
  412 |   await reworkFactory.fill('CV Micro Sewing Jakarta Pusat')
  413 |   await expect(authorizationBlock).toBeVisible()
  414 |   await attachPageEvidence(page, testInfo, 'web-qc-two-column-rework-and-color-images')
  415 |   await reworkQty.fill('0')
  416 |   await expect(reworkBlock).toBeHidden()
  417 |   await expect(reworkFactory).toBeDisabled()
  418 |   await expect(authorizationBlock).toBeHidden()
  419 | 
  420 |   await page.locator('[data-qc-spu-color-images] [data-post-finishing-action="full-flow-zoom-image"]').first().click()
  421 |   await expect(page.getByRole('dialog')).toBeVisible()
  422 |   await page.keyboard.press('Escape')
  423 |   await expect(page.getByRole('dialog')).toHaveCount(0)
  424 | 
  425 |   await setCurrentWebActor(page, 'PF-USER-QC-B')
  426 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  427 |   await page.locator('[data-post-finishing-field="qc-task-input"]').fill(seed.qcTaskNo)
  428 |   await page.getByRole('button', { name: '领取质检单', exact: true }).click()
  429 |   await expect(page.getByRole('alert')).toContainText('已由 李质检员 质检中')
  430 |   await expect(page.locator('[data-post-finishing-field="qc-task-input"]')).toHaveValue(seed.qcTaskNo)
  431 |   await setCurrentWebActor(page, 'PF-USER-QC-A')
  432 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  433 |   await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  434 |   await expect(page.getByRole('button', { name: '错误领取，退回待质检' })).toHaveCount(0)
  435 | })
  436 | 
  437 | test('公共 PDA 回货登记允许部分 SKU，阻断负数并展示真实图片', async ({ page }, testInfo) => {
  438 |   const seed = await seedBrowserFlow(page)
  439 |   await page.setViewportSize({ width: 360, height: 800 })
  440 |   await setSession(page)
  441 |   await page.goto('/fcs/pda/handover/sewing-self-return')
  442 |   await page.locator('[data-pda-sewing-self-return-field="scanValue"]').fill(seed.returnScan)
  443 |   await page.locator('[data-pda-sewing-self-return-field="scanValue"]').press('Enter')
  444 |   await expect(page.locator('[data-return-sku-card]')).toHaveCount(5)
  445 |   await expect(page.locator('body')).toContainText('来源任务')
  446 |   await expect(page.locator('body')).toContainText('暂存')
  447 |   await expect(page.locator('body')).toContainText('本来源可登记')
  448 |   await expect(page.getByRole('button', { name: '管理员退出' })).toBeVisible()
  449 |   await expectImagesLoaded(page)
  450 |   const quantities = page.locator('[data-pda-sewing-self-return-field="quantity"]')
  451 |   await quantities.first().fill('-1')
  452 |   await expect(page.locator('[data-return-quantity-error]')).toContainText('不小于 0')
  453 |   await expect(quantities.first()).toHaveAttribute('aria-invalid', 'true')
  454 |   for (let index = 0; index < 5; index += 1) await quantities.nth(index).fill('20')
  455 |   await quantities.first().fill('0')
  456 |   await expect(quantities.first()).toHaveAttribute('aria-invalid', 'false')
  457 |   await page.locator('[data-pda-sewing-self-return-field="deliveryPersonName"]').fill('苏车缝送货员')
  458 |   await page.locator('[data-pda-sewing-self-return-field="deliveryPersonPhone"]').fill('0812888888')
  459 |   await page.getByRole('button', { name: '加载原型验收凭证' }).click()
  460 |   await attachPageEvidence(page, testInfo, 'public-pda-return-registration')
  461 |   await page.getByRole('button', { name: '提交本次回货登记' }).click()
  462 |   await expect(page.getByRole('status')).toContainText('登记成功')
  463 |   const latestReturn = page.locator('[data-self-return-recent]').first()
  464 |   await expect(latestReturn.getByText('SKU 明细（5）')).toBeVisible()
  465 |   await expect(latestReturn.locator('img')).toHaveCount(5)
  466 |   await expect(latestReturn.getByRole('button', { name: '查看并确认' })).toBeVisible()
  467 |   let promptHandled = false
  468 |   page.on('dialog', async (dialog) => {
  469 |     if (dialog.type() === 'prompt') {
  470 |       promptHandled = true
  471 |       await dialog.accept('车缝工厂登记错了回货批次')
  472 |       return
  473 |     }
  474 |     await dialog.accept()
  475 |   })
  476 |   await latestReturn.getByRole('button', { name: '废弃本次回货' }).click()
```