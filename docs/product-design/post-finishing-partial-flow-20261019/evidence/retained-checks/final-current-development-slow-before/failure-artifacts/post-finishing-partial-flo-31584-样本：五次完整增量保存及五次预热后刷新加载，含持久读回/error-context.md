# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-partial-flow.spec.ts >> PFN-067样本：五次完整增量保存及五次预热后刷新加载，含持久读回
- Location: tests/post-finishing-partial-flow.spec.ts:474:1

# Error details

```
Error: 预热后详情刷新样本 1138.5, 1152.6000000238419, 1133.5, 698.5, 1122.8999999761581

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
            - button "后道工厂管理" [ref=e249]:
              - img [ref=e251]
              - generic [ref=e256]: 后道工厂管理
              - img [ref=e257]
          - generic [ref=e259]:
            - button "辅助工艺工厂管理" [expanded] [ref=e260]:
              - img [ref=e262]
              - generic [ref=e264]: 辅助工艺工厂管理
              - img [ref=e265]
            - generic [ref=e267]:
              - button "打揽加工单" [ref=e269]:
                - img [ref=e271]
                - generic [ref=e273]: 打揽加工单
              - button "打条加工单" [ref=e275]:
                - img [ref=e277]
                - generic [ref=e279]: 打条加工单
              - button "烫画加工单" [ref=e281]:
                - img [ref=e283]
                - generic [ref=e285]: 烫画加工单
              - button "直喷加工单" [ref=e287]:
                - img [ref=e289]
                - generic [ref=e291]: 直喷加工单
              - button "布包扣加工单" [ref=e293]:
                - img [ref=e295]
                - generic [ref=e297]: 布包扣加工单
              - button "绣花加工单" [ref=e299]:
                - img [ref=e301]
                - generic [ref=e303]: 绣花加工单
              - button "压褶加工单" [ref=e305]:
                - img [ref=e307]
                - generic [ref=e309]: 压褶加工单
              - button "缝边绣加工单" [ref=e311]:
                - img [ref=e313]
                - generic [ref=e315]: 缝边绣加工单
              - button "盘扣加工单" [ref=e317]:
                - img [ref=e319]
                - generic [ref=e321]: 盘扣加工单
              - button "花朵加工单" [ref=e323]:
                - img [ref=e325]
                - generic [ref=e327]: 花朵加工单
              - button "打褶加工单" [ref=e329]:
                - img [ref=e331]
                - generic [ref=e333]: 打褶加工单
              - button "烫钻加工单" [ref=e335]:
                - img [ref=e337]
                - generic [ref=e339]: 烫钻加工单
              - button "辅助工艺待加工仓" [ref=e341]:
                - img [ref=e343]
                - generic [ref=e346]: 辅助工艺待加工仓
              - button "辅助工艺待交出仓" [ref=e348]:
                - img [ref=e350]
                - generic [ref=e355]: 辅助工艺待交出仓
          - generic [ref=e356]:
            - button "特种工艺工厂管理" [expanded] [ref=e357]:
              - img [ref=e359]
              - generic [ref=e361]: 特种工艺工厂管理
              - img [ref=e362]
            - generic [ref=e364]:
              - button "模板工序加工单" [ref=e366]:
                - img [ref=e368]
                - generic [ref=e370]: 模板工序加工单
              - button "激光开袋加工单" [ref=e372]:
                - img [ref=e374]
                - generic [ref=e376]: 激光开袋加工单
              - button "特种车缝（花样机）加工单" [ref=e378]:
                - img [ref=e380]
                - generic [ref=e382]: 特种车缝（花样机）加工单
              - button "橡筋定长切割加工单" [ref=e384]:
                - img [ref=e386]
                - generic [ref=e388]: 橡筋定长切割加工单
              - button "特种工艺待加工仓" [ref=e390]:
                - img [ref=e392]
                - generic [ref=e395]: 特种工艺待加工仓
              - button "特种工艺待交出仓" [ref=e397]:
                - img [ref=e399]
                - generic [ref=e404]: 特种工艺待交出仓
    - main [ref=e405]:
      - generic [ref=e407]:
        - generic [ref=e409]:
          - button "后道加工单" [ref=e410]
          - button [ref=e411]:
            - img [ref=e412]
        - button "全部关闭" [ref=e417]
      - generic [ref=e420]:
        - generic [ref=e421]:
          - generic [ref=e422]:
            - heading "后道加工单详情" [level=1] [ref=e423]
            - paragraph [ref=e424]: PO-QC-202608-001-1-ZJ-HD / PO-QC-202608-001
          - generic [ref=e426]: 返回列表
        - generic [ref=e427]:
          - strong [ref=e428]: 后道辅料未到齐。
          - text: 后道辅料已由辅料仓备妥，请领料并完成入库。现场核对后仍可登记加工。
        - generic [ref=e429]:
          - generic [ref=e430]:
            - generic [ref=e431]:
              - heading "PO-QC-202608-001-1-ZJ-HD" [level=2] [ref=e432]
              - generic [ref=e433]: 质检单 PO-QC-202608-001-1-ZJ · 回货单 PO-QC-202608-001-1
              - generic [ref=e434]: 实际加工链：开扣眼
            - generic [ref=e435]:
              - generic [ref=e436]: 后道中
              - generic [ref=e437]: 当前录入人：周后道操作员
          - generic [ref=e438]:
            - generic [ref=e439]:
              - generic [ref=e440]: 应加工
              - generic [ref=e441]: 1000 件
            - generic [ref=e442]:
              - generic [ref=e443]: 全部后道完成
              - generic [ref=e444]: 5 件
            - generic [ref=e445]:
              - generic [ref=e446]: 已交复检
              - generic [ref=e447]: 0 件
            - generic [ref=e448]:
              - generic [ref=e449]: 可交复检
              - generic [ref=e450]: 5 件
          - button "交复检 · 可交 5 件" [ref=e451]
        - region "各加工项进度" [ref=e452]:
          - article [ref=e453]:
            - generic [ref=e454]:
              - heading "开扣眼" [level=3] [ref=e455]
              - generic [ref=e456]: 部分完成
            - generic [ref=e457]: 5 / 1000 件
            - generic [ref=e458]: 本项可登记 995 件
            - button "登记开扣眼" [ref=e459]
          - article [ref=e460]:
            - generic [ref=e461]:
              - heading "装扣子" [level=3] [ref=e462]
              - generic [ref=e463]: 不涉及
            - generic [ref=e464]: 本单无需加工此项
          - article [ref=e465]:
            - generic [ref=e466]:
              - heading "熨烫" [level=3] [ref=e467]
              - generic [ref=e468]: 不涉及
            - generic [ref=e469]: 本单无需加工此项
          - article [ref=e470]:
            - generic [ref=e471]:
              - heading "包装" [level=3] [ref=e472]
              - generic [ref=e473]: 不涉及
            - generic [ref=e474]: 本单无需加工此项
        - generic [ref=e475]:
          - heading "SKU加工进度 数量单位：件" [level=3] [ref=e476]
          - generic [ref=e477]:
            - article [ref=e478]:
              - generic [ref=e479]:
                - button "后道验收衬衫 SPU-QC-001-01 黑色 S" [ref=e480]:
                  - img "后道验收衬衫 SPU-QC-001-01 黑色 S" [ref=e481]
                - generic [ref=e482]:
                  - generic [ref=e483]: SPU-QC-001-01
                  - generic [ref=e484]: 后道验收衬衫 · 黑色 / S
                  - generic [ref=e485]: 应加工 1000 · 全部后道完成 5
              - generic [ref=e486]:
                - generic [ref=e487]:
                  - term [ref=e488]: 开扣眼
                  - definition [ref=e489]: 5 / 1000
                - generic [ref=e490]:
                  - term [ref=e491]: 装扣子
                  - definition [ref=e492]: 不涉及
                - generic [ref=e493]:
                  - term [ref=e494]: 熨烫
                  - definition [ref=e495]: 不涉及
                - generic [ref=e496]:
                  - term [ref=e497]: 包装
                  - definition [ref=e498]: 不涉及
                - generic [ref=e499]:
                  - term [ref=e500]: 已交复检
                  - definition [ref=e501]: "0"
                - generic [ref=e502]:
                  - term [ref=e503]: 可交复检
                  - definition [ref=e504]: "5"
            - article [ref=e505]:
              - generic [ref=e506]:
                - button "后道验收衬衫 SPU-QC-001-02 白色 M" [ref=e507]:
                  - img "后道验收衬衫 SPU-QC-001-02 白色 M" [ref=e508]
                - generic [ref=e509]:
                  - generic [ref=e510]: SPU-QC-001-02
                  - generic [ref=e511]: 后道验收衬衫 · 白色 / M
                  - generic [ref=e512]: 应加工 0 · 全部后道完成 0
              - generic [ref=e513]:
                - generic [ref=e514]:
                  - term [ref=e515]: 开扣眼
                  - definition [ref=e516]: 0 / 0
                - generic [ref=e517]:
                  - term [ref=e518]: 装扣子
                  - definition [ref=e519]: 不涉及
                - generic [ref=e520]:
                  - term [ref=e521]: 熨烫
                  - definition [ref=e522]: 不涉及
                - generic [ref=e523]:
                  - term [ref=e524]: 包装
                  - definition [ref=e525]: 不涉及
                - generic [ref=e526]:
                  - term [ref=e527]: 已交复检
                  - definition [ref=e528]: "0"
                - generic [ref=e529]:
                  - term [ref=e530]: 可交复检
                  - definition [ref=e531]: "0"
            - article [ref=e532]:
              - generic [ref=e533]:
                - button "后道验收衬衫 SPU-QC-001-03 雾蓝 L" [ref=e534]:
                  - img "后道验收衬衫 SPU-QC-001-03 雾蓝 L" [ref=e535]
                - generic [ref=e536]:
                  - generic [ref=e537]: SPU-QC-001-03
                  - generic [ref=e538]: 后道验收衬衫 · 雾蓝 / L
                  - generic [ref=e539]: 应加工 0 · 全部后道完成 0
              - generic [ref=e540]:
                - generic [ref=e541]:
                  - term [ref=e542]: 开扣眼
                  - definition [ref=e543]: 0 / 0
                - generic [ref=e544]:
                  - term [ref=e545]: 装扣子
                  - definition [ref=e546]: 不涉及
                - generic [ref=e547]:
                  - term [ref=e548]: 熨烫
                  - definition [ref=e549]: 不涉及
                - generic [ref=e550]:
                  - term [ref=e551]: 包装
                  - definition [ref=e552]: 不涉及
                - generic [ref=e553]:
                  - term [ref=e554]: 已交复检
                  - definition [ref=e555]: "0"
                - generic [ref=e556]:
                  - term [ref=e557]: 可交复检
                  - definition [ref=e558]: "0"
            - article [ref=e559]:
              - generic [ref=e560]:
                - button "后道验收衬衫 SPU-QC-001-04 卡其 XL" [ref=e561]:
                  - img "后道验收衬衫 SPU-QC-001-04 卡其 XL" [ref=e562]
                - generic [ref=e563]:
                  - generic [ref=e564]: SPU-QC-001-04
                  - generic [ref=e565]: 后道验收衬衫 · 卡其 / XL
                  - generic [ref=e566]: 应加工 0 · 全部后道完成 0
              - generic [ref=e567]:
                - generic [ref=e568]:
                  - term [ref=e569]: 开扣眼
                  - definition [ref=e570]: 0 / 0
                - generic [ref=e571]:
                  - term [ref=e572]: 装扣子
                  - definition [ref=e573]: 不涉及
                - generic [ref=e574]:
                  - term [ref=e575]: 熨烫
                  - definition [ref=e576]: 不涉及
                - generic [ref=e577]:
                  - term [ref=e578]: 包装
                  - definition [ref=e579]: 不涉及
                - generic [ref=e580]:
                  - term [ref=e581]: 已交复检
                  - definition [ref=e582]: "0"
                - generic [ref=e583]:
                  - term [ref=e584]: 可交复检
                  - definition [ref=e585]: "0"
            - article [ref=e586]:
              - generic [ref=e587]:
                - button "后道验收衬衫 SPU-QC-001-05 酒红 2XL" [ref=e588]:
                  - img "后道验收衬衫 SPU-QC-001-05 酒红 2XL" [ref=e589]
                - generic [ref=e590]:
                  - generic [ref=e591]: SPU-QC-001-05
                  - generic [ref=e592]: 后道验收衬衫 · 酒红 / 2XL
                  - generic [ref=e593]: 应加工 0 · 全部后道完成 0
              - generic [ref=e594]:
                - generic [ref=e595]:
                  - term [ref=e596]: 开扣眼
                  - definition [ref=e597]: 0 / 0
                - generic [ref=e598]:
                  - term [ref=e599]: 装扣子
                  - definition [ref=e600]: 不涉及
                - generic [ref=e601]:
                  - term [ref=e602]: 熨烫
                  - definition [ref=e603]: 不涉及
                - generic [ref=e604]:
                  - term [ref=e605]: 包装
                  - definition [ref=e606]: 不涉及
                - generic [ref=e607]:
                  - term [ref=e608]: 已交复检
                  - definition [ref=e609]: "0"
                - generic [ref=e610]:
                  - term [ref=e611]: 可交复检
                  - definition [ref=e612]: "0"
        - generic [ref=e613]:
          - heading "复检与出货记录" [level=3] [ref=e614]
          - paragraph [ref=e616]: 尚未交复检。
        - generic [ref=e617]:
          - heading "加工登记记录 5 次" [level=3] [ref=e618]
          - generic [ref=e619]:
            - article [ref=e620]:
              - generic [ref=e621]:
                - generic [ref=e622]: 开扣眼
                - generic [ref=e623]: 2026/10/20 04:33:01
              - generic [ref=e624]: SPU-QC-001-01：1 件
              - generic [ref=e625]: 加工责任：周后道操作员 · 录入：周后道操作员
              - button "订正本次登记" [ref=e626]
            - article [ref=e627]:
              - generic [ref=e628]:
                - generic [ref=e629]: 开扣眼
                - generic [ref=e630]: 2026/10/20 04:33:01
              - generic [ref=e631]: SPU-QC-001-01：1 件
              - generic [ref=e632]: 加工责任：周后道操作员 · 录入：周后道操作员
              - button "订正本次登记" [ref=e633]
            - article [ref=e634]:
              - generic [ref=e635]:
                - generic [ref=e636]: 开扣眼
                - generic [ref=e637]: 2026/10/20 04:33:01
              - generic [ref=e638]: SPU-QC-001-01：1 件
              - generic [ref=e639]: 加工责任：周后道操作员 · 录入：周后道操作员
              - button "订正本次登记" [ref=e640]
            - article [ref=e641]:
              - generic [ref=e642]:
                - generic [ref=e643]: 开扣眼
                - generic [ref=e644]: 2026/10/20 04:33:01
              - generic [ref=e645]: SPU-QC-001-01：1 件
              - generic [ref=e646]: 加工责任：周后道操作员 · 录入：周后道操作员
              - button "订正本次登记" [ref=e647]
            - article [ref=e648]:
              - generic [ref=e649]:
                - generic [ref=e650]: 开扣眼
                - generic [ref=e651]: 2026/10/20 04:33:01
              - generic [ref=e652]: SPU-QC-001-01：1 件
              - generic [ref=e653]: 加工责任：周后道操作员 · 录入：周后道操作员
              - button "订正本次登记" [ref=e654]
  - button "查生产" [ref=e655]:
    - img [ref=e656]
```

# Test source

```ts
  406 |   expect(state.rechecks.map(row => row.lines.reduce((sum, line) => sum + line.expectedQty, 0))).toEqual([100, 100, 800])
  407 |   expect(state.outbounds).toHaveLength(3)
  408 |   expect(state.receipts).toHaveLength(3)
  409 |   expect(state.delivery?.status).toBe('已完成')
  410 |   expect(state.progress.totalReservedQty).toBe(1000)
  411 |   expect(state.progress.availableForRecheckQty).toBe(0)
  412 |   await page.goto(`/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(thirdOutbound.outboundOrderId)}`)
  413 |   await expect(page.locator('main')).toContainText(thirdOutbound.outboundOrderNo)
  414 |   await page.reload()
  415 |   await expect(page.locator('main')).toContainText(thirdOutbound.outboundOrderNo)
  416 |   expect((await snapshot(page, seed)).outbounds.find(row => row.outboundOrderId === thirdOutbound.outboundOrderId)?.lines[0].outboundQty).toBe(800)
  417 |   await evidence(page, info, 'd1-third-outbound-direct-reload-800')
  418 |   mkdirSync(evidenceDirectory, { recursive: true })
  419 |   writeFileSync(resolve(evidenceDirectory, 'd1-final-persistent-readback.json'), JSON.stringify(state, null, 2))
  420 | })
  421 | 
  422 | for (const failureKind of ['QuotaExceededError', 'AbortError'] as const) test(`PFN-A19：${failureKind}时本次加工不落半套、输入保留且恢复后同意图只保存一次`, async ({ page }, info) => {
  423 |   const seed = await seedUpstream(page, ['开扣眼'])
  424 |   await detail(page, seed)
  425 |   await openEntry(page, seed, '开扣眼', 7)
  426 |   const before = (await snapshot(page, seed)).stored
  427 |   await page.evaluate(kind => {
  428 |     const original = IDBObjectStore.prototype.put
  429 |     ;(window as any).__partialOriginalPut = original
  430 |     IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
  431 |       if (value.collection === 'flow/processCompletions') throw new DOMException('验收加工保存故障', kind)
  432 |       return original.call(this, value, ...args)
  433 |     }
  434 |   }, failureKind)
  435 |   await page.locator(webPostAction('save-entry')).click()
  436 |   await expect(page.locator('[data-post-finishing-action-error]')).toBeVisible()
  437 |   await expect(page.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)).toHaveValue('7')
  438 |   const failed = await snapshot(page, seed)
  439 |   expect(failed.stored).toEqual(before)
  440 |   expect(failed.progress.records).toHaveLength(0)
  441 |   expect(failed.progress.totalCompletedQty).toBe(0)
  442 |   await evidence(page, info, `save-failure-${failureKind}-input-retained`)
  443 |   await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__partialOriginalPut; delete (window as any).__partialOriginalPut })
  444 |   await page.locator(webPostAction('save-entry')).click()
  445 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  446 |   await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  447 |   await page.reload()
  448 |   await expect(page.locator('[data-web-post-task]')).toBeVisible()
  449 |   const recovered = await snapshot(page, seed)
  450 |   expect(recovered.progress.records).toHaveLength(1)
  451 |   expect(recovered.progress.totalCompletedQty).toBe(7)
  452 | })
  453 | 
  454 | test('PFN-A19：两个标签同revision竞争时第二次拒绝，保留输入且不超实物量', async ({ page, context }, info) => {
  455 |   const seed = await seedUpstream(page, ['包装'])
  456 |   await detail(page, seed)
  457 |   const second = await context.newPage()
  458 |   second.on('dialog', dialog => dialog.accept())
  459 |   await detail(second, seed)
  460 |   await openEntry(page, seed, '包装', 600)
  461 |   await openEntry(second, seed, '包装', 600)
  462 |   await page.locator(webPostAction('save-entry')).click()
  463 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  464 |   await second.locator(webPostAction('save-entry')).click()
  465 |   await expect(second.locator('[data-post-finishing-action-error]')).toContainText(/变化|重新读取|冲突/)
  466 |   await expect(second.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)).toHaveValue('600')
  467 |   const state = await snapshot(page, seed)
  468 |   expect(state.progress.totalCompletedQty).toBe(600)
  469 |   expect(state.progress.records).toHaveLength(1)
  470 |   await evidence(second, info, 'two-tab-revision-conflict-input-retained')
  471 |   await second.close()
  472 | })
  473 | 
  474 | test('PFN-067样本：五次完整增量保存及五次预热后刷新加载，含持久读回', async ({ page }, info) => {
  475 |   test.setTimeout(120000)
  476 |   const seed = await seedUpstream(page, ['开扣眼'])
  477 |   await detail(page, seed)
  478 |   const saves: number[] = []
  479 |   for (let index = 0; index < 5; index += 1) {
  480 |     await openEntry(page, seed, '开扣眼', 1)
  481 |     await page.evaluate(() => { (window as any).__partialStart = performance.now() })
  482 |     await page.locator(webPostAction('save-entry')).click()
  483 |     await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  484 |     const result = await snapshot(page, seed)
  485 |     expect(result.progress.totalCompletedQty).toBe(index + 1)
  486 |     expect(result.progress.records).toHaveLength(index + 1)
  487 |     saves.push(await page.evaluate(() => performance.now() - (window as any).__partialStart))
  488 |   }
  489 |   const reloads: number[] = []
  490 |   await page.reload()
  491 |   await expect(page.locator('[data-web-post-task]')).toBeVisible()
  492 |   for (let index = 0; index < 5; index += 1) {
  493 |     await page.reload()
  494 |     await expect(page.locator('[data-web-post-task]')).toBeVisible()
  495 |     expect((await snapshot(page, seed)).progress.totalCompletedQty).toBe(5)
  496 |     reloads.push(await page.evaluate(() => performance.now()))
  497 |   }
  498 |   const result = { capturedAt: new Date().toISOString(), baseURL: test.info().project.use.baseURL,
  499 |     environment: 'this worktree Vite dev server; warmed D1 1-SKU source; not D10 or production/physical-device acceptance',
  500 |     completion: 'UI success and persisted record readback', samples: { processCompletionSaveMs: saves, warmedDetailReloadMs: reloads } }
  501 |   mkdirSync(evidenceDirectory, { recursive: true })
  502 |   const path = resolve(evidenceDirectory, 'performance-samples.json')
  503 |   writeFileSync(path, JSON.stringify(result, null, 2))
  504 |   await info.attach('performance-samples', { path, contentType: 'application/json' })
  505 |   expect(saves.every(value => value <= 1000), `完整加工保存样本 ${saves.join(', ')}`).toBe(true)
> 506 |   expect(reloads.every(value => value <= 1000), `预热后详情刷新样本 ${reloads.join(', ')}`).toBe(true)
      |                                                                                    ^ Error: 预热后详情刷新样本 1138.5, 1152.6000000238419, 1133.5, 698.5, 1122.8999999761581
  507 | })
  508 | 
```