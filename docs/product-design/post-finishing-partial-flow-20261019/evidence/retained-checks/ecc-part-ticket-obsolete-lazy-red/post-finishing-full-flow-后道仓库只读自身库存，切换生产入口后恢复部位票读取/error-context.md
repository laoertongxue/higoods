# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> 后道仓库只读自身库存，切换生产入口后恢复部位票读取
- Location: tests/post-finishing-full-flow.spec.ts:993:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
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
          - button "后道待交出仓" [ref=e483]
          - button [ref=e484]:
            - img [ref=e485]
        - button "全部关闭" [ref=e490]
      - generic [ref=e494]:
        - heading "后道待交出仓" [level=1] [ref=e496]
        - generic [ref=e498]:
          - generic [ref=e499]:
            - generic [ref=e500]:
              - generic [ref=e501]: 待交出在仓
              - strong [ref=e502]: 5 条
            - generic [ref=e503]:
              - generic [ref=e504]: SKU 种数
              - strong [ref=e505]: 5 种
            - generic [ref=e506]:
              - generic [ref=e507]: 库区库位
              - strong [ref=e508]: 1 / 1
            - generic [ref=e509]:
              - generic [ref=e510]: 流转记录
              - strong [ref=e511]: 1 条
          - navigation "后道待交出仓页签" [ref=e512]:
            - generic [ref=e513]: 库存
            - generic [ref=e514]: 流水记录
            - generic [ref=e515]: 库区库位
          - generic [ref=e516]:
            - generic [ref=e517]:
              - text: 关键词
              - textbox "关键词" [ref=e518]:
                - /placeholder: SKU/款式名称/颜色/尺码
            - generic [ref=e519]:
              - text: 可出库
              - combobox "可出库" [ref=e520]:
                - option "可出库" [selected]
                - option "全部"
                - option "不可出库"
            - button "重置" [ref=e521]
            - button "查询" [ref=e522]
        - generic [ref=e523]:
          - generic [ref=e524]:
            - heading "库存" [level=2] [ref=e525]
            - generic [ref=e526]: 当前库存 100 件
          - table [ref=e529]:
            - rowgroup [ref=e535]:
              - row "SKU 款式名称/规格 当前库存 操作" [ref=e536]:
                - columnheader "SKU" [ref=e537]
                - columnheader "款式名称/规格" [ref=e538]
                - columnheader "当前库存" [ref=e539]
                - columnheader "操作" [ref=e540]
            - rowgroup [ref=e541]:
              - row "SPU-QC-003-01 后道验收外套 黑色 S 后道验收外套 黑色 / S 20 件 库存明细 查看库存流水" [ref=e542]:
                - cell "SPU-QC-003-01" [ref=e543]:
                  - generic [ref=e545]: SPU-QC-003-01
                - cell "后道验收外套 黑色 S 后道验收外套 黑色 / S" [ref=e546]:
                  - generic [ref=e547]:
                    - button "后道验收外套 黑色 S" [ref=e548]:
                      - img "后道验收外套 黑色 S" [ref=e549]
                    - generic [ref=e550]:
                      - generic [ref=e551]: 后道验收外套
                      - generic [ref=e552]: 黑色 / S
                - cell "20 件" [ref=e553]:
                  - strong [ref=e554]: 20 件
                - cell "库存明细 查看库存流水" [ref=e555]:
                  - generic [ref=e556]:
                    - button "库存明细" [ref=e557]
                    - button "查看库存流水" [ref=e558]
              - row "SPU-QC-003-02 后道验收外套 白色 M 后道验收外套 白色 / M 20 件 库存明细 查看库存流水" [ref=e559]:
                - cell "SPU-QC-003-02" [ref=e560]:
                  - generic [ref=e562]: SPU-QC-003-02
                - cell "后道验收外套 白色 M 后道验收外套 白色 / M" [ref=e563]:
                  - generic [ref=e564]:
                    - button "后道验收外套 白色 M" [ref=e565]:
                      - img "后道验收外套 白色 M" [ref=e566]
                    - generic [ref=e567]:
                      - generic [ref=e568]: 后道验收外套
                      - generic [ref=e569]: 白色 / M
                - cell "20 件" [ref=e570]:
                  - strong [ref=e571]: 20 件
                - cell "库存明细 查看库存流水" [ref=e572]:
                  - generic [ref=e573]:
                    - button "库存明细" [ref=e574]
                    - button "查看库存流水" [ref=e575]
              - row "SPU-QC-003-03 后道验收外套 雾蓝 L 后道验收外套 雾蓝 / L 20 件 库存明细 查看库存流水" [ref=e576]:
                - cell "SPU-QC-003-03" [ref=e577]:
                  - generic [ref=e579]: SPU-QC-003-03
                - cell "后道验收外套 雾蓝 L 后道验收外套 雾蓝 / L" [ref=e580]:
                  - generic [ref=e581]:
                    - button "后道验收外套 雾蓝 L" [ref=e582]:
                      - img "后道验收外套 雾蓝 L" [ref=e583]
                    - generic [ref=e584]:
                      - generic [ref=e585]: 后道验收外套
                      - generic [ref=e586]: 雾蓝 / L
                - cell "20 件" [ref=e587]:
                  - strong [ref=e588]: 20 件
                - cell "库存明细 查看库存流水" [ref=e589]:
                  - generic [ref=e590]:
                    - button "库存明细" [ref=e591]
                    - button "查看库存流水" [ref=e592]
              - row "SPU-QC-003-04 后道验收外套 卡其 XL 后道验收外套 卡其 / XL 20 件 库存明细 查看库存流水" [ref=e593]:
                - cell "SPU-QC-003-04" [ref=e594]:
                  - generic [ref=e596]: SPU-QC-003-04
                - cell "后道验收外套 卡其 XL 后道验收外套 卡其 / XL" [ref=e597]:
                  - generic [ref=e598]:
                    - button "后道验收外套 卡其 XL" [ref=e599]:
                      - img "后道验收外套 卡其 XL" [ref=e600]
                    - generic [ref=e601]:
                      - generic [ref=e602]: 后道验收外套
                      - generic [ref=e603]: 卡其 / XL
                - cell "20 件" [ref=e604]:
                  - strong [ref=e605]: 20 件
                - cell "库存明细 查看库存流水" [ref=e606]:
                  - generic [ref=e607]:
                    - button "库存明细" [ref=e608]
                    - button "查看库存流水" [ref=e609]
              - row "SPU-QC-003-05 后道验收外套 酒红 2XL 后道验收外套 酒红 / 2XL 20 件 库存明细 查看库存流水" [ref=e610]:
                - cell "SPU-QC-003-05" [ref=e611]:
                  - generic [ref=e613]: SPU-QC-003-05
                - cell "后道验收外套 酒红 2XL 后道验收外套 酒红 / 2XL" [ref=e614]:
                  - generic [ref=e615]:
                    - button "后道验收外套 酒红 2XL" [ref=e616]:
                      - img "后道验收外套 酒红 2XL" [ref=e617]
                    - generic [ref=e618]:
                      - generic [ref=e619]: 后道验收外套
                      - generic [ref=e620]: 酒红 / 2XL
                - cell "20 件" [ref=e621]:
                  - strong [ref=e622]: 20 件
                - cell "库存明细 查看库存流水" [ref=e623]:
                  - generic [ref=e624]:
                    - button "库存明细" [ref=e625]
                    - button "查看库存流水" [ref=e626]
          - generic [ref=e628]:
            - paragraph [ref=e629]: 共 5 条，当前 1-5
            - generic [ref=e630]:
              - combobox [ref=e631]:
                - option "10 条/页"
                - option "20 条/页" [selected]
                - option "50 条/页"
              - button "上一页" [disabled] [ref=e632]
              - generic [ref=e633]: 1 / 1
              - button "下一页" [disabled] [ref=e634]
  - button "查生产" [ref=e635]:
    - img [ref=e636]
```

# Test source

```ts
  898  |   const result = await verify(page)
  899  |   await testInfo.attach('post-finishing-browser-contract', { body: Buffer.from(JSON.stringify(result, null, 2)), contentType: 'application/json' })
  900  |   expect(result.status).toBe('passed')
  901  |   expect(result.checks.length).toBeGreaterThanOrEqual(39)
  902  | })
  903  | 
  904  | test('Web 复检提交存储失败时所有条码与出货事实一起回滚', async ({ page }) => {
  905  |   const seed = await seedBrowserFlow(page)
  906  |   await setCurrentWebActor(page, 'PF-USER-RC-A')
  907  |   await page.goto('/fcs/craft/post-finishing/recheck-orders')
  908  |   await page.getByRole('button', { name: '领取复检单' }).click()
  909  |   await page.locator('[data-recheck-claim-task-no]').fill(seed.recheckOrderNo)
  910  |   await page.getByRole('button', { name: '确认领取' }).click()
  911  |   await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
  912  |   for (const node of await page.locator('[data-recheck-result-field="barcodeCorrect"]').all()) await node.selectOption('yes')
  913  |   const before = await page.evaluate(async () => {
  914  |     const db = await import('/src/data/pcs-record-db.ts')
  915  |     return (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
  916  |   })
  917  |   await page.evaluate(() => {
  918  |     const put = IDBObjectStore.prototype.put
  919  |     IDBObjectStore.prototype.put = function(value: any, ...args: any[]) {
  920  |       if (value.collection === 'flow/outboundOrders') throw new DOMException('验收出货保存空间不足', 'QuotaExceededError')
  921  |       return put.call(this, value, ...args)
  922  |     }
  923  |   })
  924  |   await page.getByRole('button', { name: '确认数量条码并生成后道出货单' }).click()
  925  |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('空间不足')
  926  |   const after = await page.evaluate(async () => {
  927  |     const db = await import('/src/data/pcs-record-db.ts')
  928  |     return (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
  929  |   })
  930  |   expect(after).toEqual(before)
  931  |   await expect(page.locator('[data-recheck-result-field="barcodeCorrect"]').first()).toHaveValue('yes')
  932  | })
  933  | 
  934  | test('后道按需读取生产分配覆盖，其他生产入口仍恢复分配产物', async ({ page }) => {
  935  |   const requests: string[] = []
  936  |   page.on('request', request => requests.push(request.url()))
  937  |   await page.goto('/fcs/craft/post-finishing/work-orders')
  938  |   await expect(page.locator('main h1')).toBeVisible()
  939  |   expect(requests.some(url => url.includes('/src/data/fcs/production-context-actions.ts'))).toBe(false)
  940  |   requests.length = 0
  941  |   await page.goto('/fcs/craft/post-finishing/qc-orders')
  942  |   await expect(page.locator('main h1')).toHaveText('质检清单')
  943  |   expect(requests.some(url => url.includes('/src/data/fcs/production-object-overview.ts'))).toBe(false)
  944  |   await expect(page.locator('main [data-object-type="QC_ORDER"]')).toHaveText('PO-QC-202608-001-4-ZJ')
  945  |   await expect(page.locator('main [data-object-type="PRODUCTION_ORDER"]')).toHaveText('PO-QC-202608-001')
  946  |   await expect(page.locator('main')).toContainText('后道验收 Mock 来源；生产主线已关联')
  947  |   // 写入合法的上游覆盖记录作为验收前置，页面刷新必须恢复它。
  948  |   await page.evaluate(async () => {
  949  |     const records = await import('/src/data/fcs/cutting/cutting-record-repository.ts')
  950  |     const context = await import('/src/data/fcs/production-context-records.ts')
  951  |     const snapshot = await records.readCuttingRecords()
  952  |     const puts = context.decodeProductionContextRecords(context.PRODUCTION_CONTEXT_KEYS.effects,
  953  |       JSON.stringify({ version: 1, entries: [['material-sequence:value', 777]] }))
  954  |     await records.commitCuttingRecords({ revision: snapshot.revision, change: { puts },
  955  |       command: { id: 'POST-SOURCE-READ-TEST', intent: '合法分配覆盖验收', result: true, at: new Date().toISOString() } })
  956  |   })
  957  |   requests.length = 0
  958  |   await page.reload()
  959  |   await expect(page.locator('main h1')).toBeVisible()
  960  |   expect(requests.some(url => url.includes('/src/data/fcs/production-context-actions.ts'))).toBe(true)
  961  |   expect(await page.evaluate(async () => {
  962  |     const material = await import('/src/data/fcs/sewing-material-handover.ts')
  963  |     return material.captureSewingMaterialState().sequence
  964  |   })).toBe(777)
  965  |   await page.goto('/fcs/production/orders')
  966  |   await expect(page.locator('main h1')).toBeVisible()
  967  |   expect(await page.evaluate(async () => {
  968  |     const material = await import('/src/data/fcs/sewing-material-handover.ts')
  969  |     return material.captureSewingMaterialState().sequence
  970  |   })).toBe(777)
  971  | })
  972  | 
  973  | test('质检清单来源缺失时编号只读并提示关联待补', async ({ page }) => {
  974  |   await page.goto('/fcs/craft/post-finishing/qc-orders')
  975  |   await expect(page.locator('main h1')).toHaveText('质检清单')
  976  |   await page.evaluate(async () => {
  977  |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  978  |     const records = await import('/src/data/pcs-record-db.ts')
  979  |     const task = structuredClone(flow.getPostFinishingActiveQcTask(flow.getCurrentPostFinishingActor().actorId))
  980  |     task.productionOrderId = 'MISSING-PRODUCTION-SOURCE'
  981  |     task.productionOrderNo = 'MISSING-PRODUCTION-SOURCE'
  982  |     await records.commitPcsRecords({ puts: [{ id: `higood-fcs-post-finishing-records/flow/qcTasks/${encodeURIComponent(task.qcTaskId)}`,
  983  |       collection: 'flow/qcTasks', value: task, expectedVersion: 0 }], deletes: [],
  984  |       operationId: 'POST-MISSING-SOURCE-TEST', intent: '缺失来源边界验收' })
  985  |   })
  986  |   await page.reload()
  987  |   await expect(page.locator('main h1')).toHaveText('质检清单')
  988  |   await expect(page.locator('main [data-object-type="QC_ORDER"],main [data-object-type="PRODUCTION_ORDER"]')).toHaveCount(0)
  989  |   await expect(page.locator('main')).toContainText('生产主线关联待补')
  990  |   await expect(page.locator('main')).toContainText('MISSING-PRODUCTION-SOURCE')
  991  | })
  992  | 
  993  | test('后道仓库只读自身库存，切换生产入口后恢复部位票读取', async ({ page }) => {
  994  |   const requests: string[] = []
  995  |   page.on('request', request => requests.push(request.url()))
  996  |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  997  |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
> 998  |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(false)
       |                                                                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  999  |   // 触发同一页面会话的原站内路由事件，验证一次性来源读取没有漏掉后续入口。
  1000 |   await page.evaluate(() => {
  1001 |     history.pushState({}, '', '/fcs/craft/post-finishing/work-orders')
  1002 |     window.dispatchEvent(new PopStateEvent('popstate'))
  1003 |   })
  1004 |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  1005 |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1006 |   await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  1007 | })
  1008 | 
  1009 | test('执行质检延后部位票，打开生产关联入口时恢复读取', async ({ page }) => {
  1010 |   const requests: string[] = []
  1011 |   page.on('request', request => requests.push(request.url()))
  1012 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  1013 |   await expect(page.locator('main h1')).toHaveText('执行质检')
  1014 |   await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  1015 |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(false)
  1016 |   const task = await page.locator('[data-qc-workbench-task]').getAttribute('data-qc-workbench-task')
  1017 |   await page.locator('[data-production-object-action]').first().click()
  1018 |   await expect.poll(() => requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1019 |   await expect(page.locator('[data-production-object-surface="search"]')).toBeVisible()
  1020 |   await expect(page.locator('[data-qc-workbench-task]')).toHaveAttribute('data-qc-workbench-task', task!)
  1021 | })
  1022 | 
  1023 | test('后道命名页复用现有渲染器，其他生产入口按原方式读取', async ({ page }) => {
  1024 |   const requests: string[] = []
  1025 |   page.on('request', request => requests.push(request.url()))
  1026 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  1027 |   await expect(page.locator('main h1')).toHaveText('执行质检')
  1028 |   await expect(page.locator('[data-qc-spu-color-images] img')).toHaveCount(5)
  1029 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1030 |   await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  1031 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1032 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1033 |   await page.goto('/fcs/craft/post-finishing/work-orders/%50F-POST-PF-ACCEPT-PO-1-5')
  1034 |   await expect(page.locator('main h1')).toHaveText('后道加工单详情')
  1035 |   await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  1036 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1037 |   await page.goto('/fcs/production/orders')
  1038 |   await expect(page.locator('main h1')).toHaveText('生产单管理')
  1039 |   expect(requests.some(url => url.includes('/src/pages/production/orders-domain'))).toBe(true)
  1040 |   for (const suffix of ['constructor', 'toString', '__proto__']) {
  1041 |     await page.goto(`/fcs/craft/post-finishing/${suffix}`)
  1042 |     await expect(page.locator('main h1')).toHaveText('页面未找到', { timeout: 5000 })
  1043 |   }
  1044 | })
  1045 | 
  1046 | test('质检清单按新编号查询并复位筛选', async ({ page }) => {
  1047 |   await page.goto('/fcs/craft/post-finishing/qc-orders')
  1048 |   await expect(page.locator('main h1')).toHaveText('质检清单')
  1049 |   const filters = page.locator('form[action="/fcs/craft/post-finishing/qc-orders"]')
  1050 |   await filters.locator('input[name="keyword"]').fill('NO-QC-MATCH-20261010')
  1051 |   await filters.getByRole('button', { name: '查询', exact: true }).click()
  1052 |   await expect(page).toHaveURL(/keyword=NO-QC-MATCH-20261010/, { timeout: 5000 })
  1053 |   await expect(page.locator('main')).toContainText('暂无符合条件的质检单')
  1054 |   await page.locator('form[action="/fcs/craft/post-finishing/qc-orders"] a[data-nav="/fcs/craft/post-finishing/qc-orders"]').click()
  1055 |   await expect(page).toHaveURL(/\/qc-orders$/)
  1056 |   await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  1057 |   await page.locator('input[name="keyword"]').fill('PO-QC-202608-001-4-ZJ')
  1058 |   await page.locator('main').getByRole('button', { name: '查询', exact: true }).click()
  1059 |   await expect(page).toHaveURL(/keyword=PO-QC-202608-001-4-ZJ/)
  1060 |   await expect(page.locator('main tbody tr')).toHaveCount(1)
  1061 |   await expect(page.locator('main tbody')).toContainText('PO-QC-202608-001-4-ZJ')
  1062 |   for (const list of ['work-orders', 'recheck-orders', 'outbound-orders', 'material-transfers']) {
  1063 |     const path = `/fcs/craft/post-finishing/${list}`
  1064 |     await page.goto(path)
  1065 |     await expect(page.locator('main h1')).toBeVisible()
  1066 |     const form = page.locator(`form[action="${path}"]`)
  1067 |     await form.locator('input[name="keyword"]').fill('NO-POST-MATCH-20261010')
  1068 |     await form.getByRole('button', { name: '查询', exact: true }).click()
  1069 |     await expect(page).toHaveURL(/keyword=NO-POST-MATCH-20261010/)
  1070 |     await expect(page.locator('main tbody')).not.toContainText('PO-QC-')
  1071 |     await page.locator(`form[action="${path}"] a[data-nav="${path}"]`).click()
  1072 |     await expect(page).toHaveURL(new RegExp(`${list}$`))
  1073 |     await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  1074 |   }
  1075 | })
  1076 | 
  1077 | test('仓库弹层跟随关联单据后关闭，返回列表可继续操作', async ({ page }) => {
  1078 |   const warehouse = '/fcs/craft/post-finishing/wait-process-warehouse'
  1079 |   await page.goto(warehouse)
  1080 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1081 |   await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  1082 |   const drawer = page.locator('[data-warehouse-inventory-drawer]')
  1083 |   await expect(drawer).toBeVisible()
  1084 |   await drawer.locator('a[data-nav*="deliveryId="]').first().click()
  1085 |   await expect(page.locator('[data-return-confirm-root]')).toBeVisible()
  1086 |   await page.locator('button[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns"]').click()
  1087 |   await expect(page).toHaveURL(/wait-process-warehouse\?tab=returns$/)
  1088 |   await expect(page.locator('[data-return-confirm-root]')).toHaveCount(0)
  1089 |   await expect(page.locator('[data-warehouse-inventory-drawer]')).toHaveCount(0, { timeout: 5000 })
  1090 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=movements"]').click()
  1091 |   await expect(page.getByRole('heading', { name: '流水记录', exact: true })).toBeVisible()
  1092 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=materials"]').click()
  1093 |   await expect(page).toHaveURL(/wait-process-warehouse\?tab=materials$/)
  1094 |   await page.evaluate(async () => {
  1095 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  1096 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  1097 |     await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({
  1098 |       transferOrderNo: flow.listPostFinishingMaterialTransferOrders()[0].transferOrderNo,
```