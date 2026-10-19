# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-partial-flow.spec.ts >> PFN-A01/A02/A17/A26/071/072：QC四项独立勾选、四列数量、键盘与代登记订正
- Location: tests/post-finishing-partial-flow.spec.ts:153:1

# Error details

```
ReferenceError: registerUi is not defined
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
        - generic [ref=e408]:
          - generic [ref=e409]:
            - button "后道加工单" [ref=e410]
            - button [ref=e411]:
              - img [ref=e412]
          - button "执行质检" [ref=e417]
        - button "全部关闭" [ref=e419]
      - generic [ref=e422]:
        - generic [ref=e423]:
          - generic [ref=e424]:
            - heading "后道加工单详情" [level=1] [ref=e425]
            - paragraph [ref=e426]: PO-QC-202608-001-1-ZJ-HD / PO-QC-202608-001
          - generic [ref=e428]: 返回列表
        - status [ref=e429]: 本次订正已保存，原登记及订正原因均已保留。
        - generic [ref=e430]:
          - strong [ref=e431]: 后道辅料未到齐。
          - text: 后道辅料已由辅料仓备妥，请领料并完成入库。现场核对后仍可登记加工。
        - generic [ref=e432]:
          - generic [ref=e433]:
            - generic [ref=e434]:
              - heading "PO-QC-202608-001-1-ZJ-HD" [level=2] [ref=e435]
              - generic [ref=e436]: 质检单 PO-QC-202608-001-1-ZJ · 回货单 PO-QC-202608-001-1
              - generic [ref=e437]: 实际加工链：装扣子 → 包装
            - generic [ref=e438]:
              - generic [ref=e439]: 后道中
              - generic [ref=e440]: 当前录入人：周后道操作员
          - generic [ref=e441]:
            - generic [ref=e442]:
              - generic [ref=e443]: 应加工
              - generic [ref=e444]: 1000 件
            - generic [ref=e445]:
              - generic [ref=e446]: 全部后道完成
              - generic [ref=e447]: 0 件
            - generic [ref=e448]:
              - generic [ref=e449]: 已交复检
              - generic [ref=e450]: 0 件
            - generic [ref=e451]:
              - generic [ref=e452]: 可交复检
              - generic [ref=e453]: 0 件
        - region "各加工项进度" [ref=e454]:
          - article [ref=e455]:
            - generic [ref=e456]:
              - heading "开扣眼" [level=3] [ref=e457]
              - generic [ref=e458]: 不涉及
            - generic [ref=e459]: 本单无需加工此项
          - article [ref=e460]:
            - generic [ref=e461]:
              - heading "装扣子" [level=3] [ref=e462]
              - generic [ref=e463]: 部分完成
            - generic [ref=e464]: 1 / 1000 件
            - generic [ref=e465]: 本项可登记 999 件
            - button "登记装扣子" [ref=e466]
          - article [ref=e467]:
            - generic [ref=e468]:
              - heading "熨烫" [level=3] [ref=e469]
              - generic [ref=e470]: 不涉及
            - generic [ref=e471]: 本单无需加工此项
          - article [ref=e472]:
            - generic [ref=e473]:
              - heading "包装" [level=3] [ref=e474]
              - generic [ref=e475]: 待加工
            - generic [ref=e476]: 0 / 1000 件
            - generic [ref=e477]: 本项可登记 1 件
            - button "登记包装" [ref=e478]
        - generic [ref=e479]:
          - heading "SKU加工进度 数量单位：件" [level=3] [ref=e480]
          - generic [ref=e481]:
            - article [ref=e482]:
              - generic [ref=e483]:
                - button "后道验收衬衫 SPU-QC-001-01 黑色 S" [ref=e484]:
                  - img "后道验收衬衫 SPU-QC-001-01 黑色 S" [ref=e485]
                - generic [ref=e486]:
                  - generic [ref=e487]: SPU-QC-001-01
                  - generic [ref=e488]: 后道验收衬衫 · 黑色 / S
                  - generic [ref=e489]: 应加工 1000 · 全部后道完成 0
              - generic [ref=e490]:
                - generic [ref=e491]:
                  - term [ref=e492]: 开扣眼
                  - definition [ref=e493]: 不涉及
                - generic [ref=e494]:
                  - term [ref=e495]: 装扣子
                  - definition [ref=e496]: 1 / 1000
                - generic [ref=e497]:
                  - term [ref=e498]: 熨烫
                  - definition [ref=e499]: 不涉及
                - generic [ref=e500]:
                  - term [ref=e501]: 包装
                  - definition [ref=e502]: 0 / 1000
                - generic [ref=e503]:
                  - term [ref=e504]: 已交复检
                  - definition [ref=e505]: "0"
                - generic [ref=e506]:
                  - term [ref=e507]: 可交复检
                  - definition [ref=e508]: "0"
            - article [ref=e509]:
              - generic [ref=e510]:
                - button "后道验收衬衫 SPU-QC-001-02 白色 M" [ref=e511]:
                  - img "后道验收衬衫 SPU-QC-001-02 白色 M" [ref=e512]
                - generic [ref=e513]:
                  - generic [ref=e514]: SPU-QC-001-02
                  - generic [ref=e515]: 后道验收衬衫 · 白色 / M
                  - generic [ref=e516]: 应加工 0 · 全部后道完成 0
              - generic [ref=e517]:
                - generic [ref=e518]:
                  - term [ref=e519]: 开扣眼
                  - definition [ref=e520]: 不涉及
                - generic [ref=e521]:
                  - term [ref=e522]: 装扣子
                  - definition [ref=e523]: 0 / 0
                - generic [ref=e524]:
                  - term [ref=e525]: 熨烫
                  - definition [ref=e526]: 不涉及
                - generic [ref=e527]:
                  - term [ref=e528]: 包装
                  - definition [ref=e529]: 0 / 0
                - generic [ref=e530]:
                  - term [ref=e531]: 已交复检
                  - definition [ref=e532]: "0"
                - generic [ref=e533]:
                  - term [ref=e534]: 可交复检
                  - definition [ref=e535]: "0"
            - article [ref=e536]:
              - generic [ref=e537]:
                - button "后道验收衬衫 SPU-QC-001-03 雾蓝 L" [ref=e538]:
                  - img "后道验收衬衫 SPU-QC-001-03 雾蓝 L" [ref=e539]
                - generic [ref=e540]:
                  - generic [ref=e541]: SPU-QC-001-03
                  - generic [ref=e542]: 后道验收衬衫 · 雾蓝 / L
                  - generic [ref=e543]: 应加工 0 · 全部后道完成 0
              - generic [ref=e544]:
                - generic [ref=e545]:
                  - term [ref=e546]: 开扣眼
                  - definition [ref=e547]: 不涉及
                - generic [ref=e548]:
                  - term [ref=e549]: 装扣子
                  - definition [ref=e550]: 0 / 0
                - generic [ref=e551]:
                  - term [ref=e552]: 熨烫
                  - definition [ref=e553]: 不涉及
                - generic [ref=e554]:
                  - term [ref=e555]: 包装
                  - definition [ref=e556]: 0 / 0
                - generic [ref=e557]:
                  - term [ref=e558]: 已交复检
                  - definition [ref=e559]: "0"
                - generic [ref=e560]:
                  - term [ref=e561]: 可交复检
                  - definition [ref=e562]: "0"
            - article [ref=e563]:
              - generic [ref=e564]:
                - button "后道验收衬衫 SPU-QC-001-04 卡其 XL" [ref=e565]:
                  - img "后道验收衬衫 SPU-QC-001-04 卡其 XL" [ref=e566]
                - generic [ref=e567]:
                  - generic [ref=e568]: SPU-QC-001-04
                  - generic [ref=e569]: 后道验收衬衫 · 卡其 / XL
                  - generic [ref=e570]: 应加工 0 · 全部后道完成 0
              - generic [ref=e571]:
                - generic [ref=e572]:
                  - term [ref=e573]: 开扣眼
                  - definition [ref=e574]: 不涉及
                - generic [ref=e575]:
                  - term [ref=e576]: 装扣子
                  - definition [ref=e577]: 0 / 0
                - generic [ref=e578]:
                  - term [ref=e579]: 熨烫
                  - definition [ref=e580]: 不涉及
                - generic [ref=e581]:
                  - term [ref=e582]: 包装
                  - definition [ref=e583]: 0 / 0
                - generic [ref=e584]:
                  - term [ref=e585]: 已交复检
                  - definition [ref=e586]: "0"
                - generic [ref=e587]:
                  - term [ref=e588]: 可交复检
                  - definition [ref=e589]: "0"
            - article [ref=e590]:
              - generic [ref=e591]:
                - button "后道验收衬衫 SPU-QC-001-05 酒红 2XL" [ref=e592]:
                  - img "后道验收衬衫 SPU-QC-001-05 酒红 2XL" [ref=e593]
                - generic [ref=e594]:
                  - generic [ref=e595]: SPU-QC-001-05
                  - generic [ref=e596]: 后道验收衬衫 · 酒红 / 2XL
                  - generic [ref=e597]: 应加工 0 · 全部后道完成 0
              - generic [ref=e598]:
                - generic [ref=e599]:
                  - term [ref=e600]: 开扣眼
                  - definition [ref=e601]: 不涉及
                - generic [ref=e602]:
                  - term [ref=e603]: 装扣子
                  - definition [ref=e604]: 0 / 0
                - generic [ref=e605]:
                  - term [ref=e606]: 熨烫
                  - definition [ref=e607]: 不涉及
                - generic [ref=e608]:
                  - term [ref=e609]: 包装
                  - definition [ref=e610]: 0 / 0
                - generic [ref=e611]:
                  - term [ref=e612]: 已交复检
                  - definition [ref=e613]: "0"
                - generic [ref=e614]:
                  - term [ref=e615]: 可交复检
                  - definition [ref=e616]: "0"
        - generic [ref=e617]:
          - heading "复检与出货记录" [level=3] [ref=e618]
          - paragraph [ref=e620]: 尚未交复检。
        - generic [ref=e621]:
          - heading "加工登记记录 2 次" [level=3] [ref=e622]
          - generic [ref=e623]:
            - article [ref=e624]:
              - generic [ref=e625]:
                - generic [ref=e626]: 装扣子 · 订正调整
                - generic [ref=e627]: 2026/10/20 01:32:00
              - generic [ref=e628]: SPU-QC-001-01：-1 件
              - generic [ref=e629]: 加工责任：吴后道主管 · 录入：吴后道主管
              - paragraph [ref=e630]: 订正原因：主管复核代登记数量，原2件应为1件，保留原责任
            - article [ref=e631]:
              - generic [ref=e632]:
                - generic [ref=e633]: 装扣子
                - generic [ref=e634]: 2026/10/20 01:32:00
              - generic [ref=e635]: SPU-QC-001-01：2 件
              - generic [ref=e636]: 订正后有效量：SPU-QC-001-01：1 件
              - generic [ref=e637]: 加工责任：吴后道主管 · 录入：周后道操作员
              - button "订正本次登记" [ref=e638]
  - button "查生产" [ref=e639]:
    - img [ref=e640]
```

# Test source

```ts
  176 |   const row = page.locator('tbody tr')
  177 |   await expect(row).toHaveCount(1)
  178 |   const headerKeys = await page.locator('thead th').evaluateAll(elements => elements.map(element => element.getAttribute('data-column-key')))
  179 |   for (const item of processItems) {
  180 |     const index = headerKeys.indexOf(`process-${item}`)
  181 |     expect(index).toBeGreaterThanOrEqual(0)
  182 |     await expect(row.locator('td').nth(index)).toContainText(['装扣子', '包装'].includes(item) ? '0 / 1000' : '不涉及')
  183 |   }
  184 |   await showProcessColumns(page)
  185 |   await evidence(page, info, 'list-zero-versus-not-applicable-1280')
  186 |   await page.locator('input[name="keyword"]').fill('不存在的加工单')
  187 |   await page.getByRole('button', { name: '查询', exact: true }).click()
  188 |   await expect(page.locator('main')).toContainText('质检确认需要后道加工后自动生成后道加工单')
  189 |   await expect(page.locator('main')).toContainText('0 张')
  190 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/work-orders"]').filter({ hasText: '重置' }).click()
  191 |   await expect(page.locator('tbody tr')).toHaveCount(1)
  192 |   await detail(page, seed)
  193 |   await expect(page.locator('[data-post-prototype-actor]')).toHaveCount(0)
  194 |   await expect(page.locator(webPostAction('switch-actor'))).toHaveCount(0)
  195 |   // QC's existing permission context is neither used as a finishing gate nor
  196 |   // silently rewritten by opening this complete-function detail page.
  197 |   expect(await page.evaluate(() => localStorage.getItem('higood-fcs-post-finishing-current-actor-v1'))).toBe('PF-USER-QC-A')
  198 |   await expect(page.locator(`${webPostAction('open-register')}[data-process-item="装扣子"]`)).toBeEnabled()
  199 |   await expect(page.locator('[data-post-process-card="开扣眼"]')).toContainText('不涉及')
  200 |   await expect(page.locator('[data-post-process-card="包装"]')).toContainText('前序尚未有可登记数量')
  201 |   await page.setViewportSize({ width: 1024, height: 768 })
  202 |   await openEntry(page, seed, '装扣子', 1)
  203 |   const form = page.locator('[data-post-entry-form]')
  204 |   await expect(form).toBeVisible()
  205 |   const quantity = form.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)
  206 |   await quantity.fill('')
  207 |   await form.locator(webPostAction('save-entry')).click()
  208 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('不能留空')
  209 |   await expect(quantity).toHaveValue('')
  210 |   expect((await snapshot(page, seed)).progress.records).toHaveLength(0)
  211 |   await quantity.fill('1')
  212 |   const save = form.locator(webPostAction('save-entry'))
  213 |   const close = form.getByRole('button', { name: '关闭', exact: true })
  214 |   await save.focus()
  215 |   await page.keyboard.press('Tab')
  216 |   await expect(close).toBeFocused()
  217 |   await page.keyboard.press('Shift+Tab')
  218 |   await expect(save).toBeFocused()
  219 |   await expect(form.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`)).toHaveValue('1')
  220 |   await evidence(page, info, 'web-keyboard-tab-keeps-entry-and-focus-1024')
  221 |   await page.keyboard.press('Escape')
  222 |   await expect(form).toHaveCount(0)
  223 |   await expect(page.locator(`${webPostAction('open-register')}[data-process-item="装扣子"]`)).toBeFocused()
  224 |   const image = page.locator('[data-post-finishing-action="full-flow-zoom-image"]').first()
  225 |   await image.focus()
  226 |   await page.keyboard.press('Enter')
  227 |   const imageDialog = page.locator('[data-post-image-overlay]')
  228 |   await expect(imageDialog).toBeVisible()
  229 |   await expect(imageDialog.getByRole('button', { name: '关闭图片', exact: true })).toBeFocused()
  230 |   await page.keyboard.press('Enter')
  231 |   await expect(imageDialog).toHaveCount(0)
  232 |   await expect(image).toBeFocused()
  233 |   await openEntry(page, seed, '装扣子', 2)
  234 |   await page.locator('[data-post-entry-responsible]').selectOption('PF-USER-POST-MGR')
  235 |   await page.locator(webPostAction('save-entry')).click()
  236 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  237 |   const delegated = await snapshot(page, seed)
  238 |   const original = delegated.progress.records[0]
  239 |   expect(original.responsible.actorId).toBe('PF-USER-POST-MGR')
  240 |   expect(original.recordedBy.actorId).toBe('PF-USER-POST')
  241 |   expect(original.quantities).toEqual([{ skuId: seed.skuId, quantity: 2 }])
  242 |   await expect(page.locator('[data-post-prototype-actor]')).toHaveCount(0)
  243 |   await expect(page.locator(webPostAction('switch-actor'))).toHaveCount(0)
  244 |   await expect(page.locator(`${webPostAction('open-correct')}[data-record-id="${original.recordId}"]`)).toBeEnabled()
  245 |   await page.locator(`${webPostAction('open-correct')}[data-record-id="${original.recordId}"]`).click()
  246 |   const correctionForm = page.locator('[data-post-entry-form]')
  247 |   await correctionForm.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`).fill('1')
  248 |   await expect(correctionForm.locator('[data-post-entry-supervisor]')).toHaveValue('')
  249 |   await correctionForm.locator(webPostAction('save-entry')).click()
  250 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('请选择本次实际核对主管')
  251 |   await expect(correctionForm.locator('[data-post-entry-quantity]')).toHaveValue('1')
  252 |   expect((await snapshot(page, seed)).progress.records).toEqual(delegated.progress.records)
  253 |   await correctionForm.locator('[data-post-entry-supervisor]').selectOption('PF-USER-POST-MGR')
  254 |   await correctionForm.locator(webPostAction('save-entry')).click()
  255 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('填写订正原因')
  256 |   await expect(correctionForm.locator('[data-post-entry-quantity]')).toHaveValue('1')
  257 |   expect((await snapshot(page, seed)).progress.records).toHaveLength(1)
  258 |   await correctionForm.locator('[data-post-entry-reason]').fill('主管复核代登记数量，原2件应为1件，保留原责任')
  259 |   await correctionForm.locator(webPostAction('save-entry')).click()
  260 |   await expect(correctionForm).toHaveCount(0)
  261 |   await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  262 |   const corrected = await snapshot(page, seed)
  263 |   expect(corrected.progress.processes.find(row => row.processItem === '装扣子')?.completedQty).toBe(1)
  264 |   expect(corrected.progress.records).toHaveLength(2)
  265 |   expect(corrected.progress.records.find(row => row.recordId === original.recordId)).toEqual(original)
  266 |   const amendment = corrected.progress.records.find(row => row.correctionOf === original.recordId)!
  267 |   expect(amendment.quantities).toEqual([{ skuId: seed.skuId, quantity: -1 }])
  268 |   expect(amendment.responsible.actorId).toBe('PF-USER-POST-MGR')
  269 |   expect(amendment.recordedBy.actorId).toBe('PF-USER-POST-MGR')
  270 |   expect(await page.evaluate(() => localStorage.getItem('higood-fcs-post-finishing-current-actor-v1'))).toBe('PF-USER-QC-A')
  271 |   writeFileSync(resolve(evidenceDirectory, 'web-delegation-correction-readback.json'), JSON.stringify(corrected, null, 2))
  272 |   await evidence(page, info, 'web-delegated-registration-and-supervisor-correction')
  273 | 
  274 |   // Direct access removes the prototype identity gate, while a real reserved
  275 |   // child still prevents a supervisor's amendment from taking its supply.
> 276 |   await registerUi(page, seed, '包装', 1)
      |   ^ ReferenceError: registerUi is not defined
  277 |   await expect(page.locator(webPostAction('open-recheck'))).toBeEnabled()
  278 |   await submitUi(page, seed, 1)
  279 |   const occupied = await snapshot(page, seed)
  280 |   const packing = occupied.progress.records.find(row => row.processItem === '包装' && !row.correctionOf)!
  281 |   await page.locator(`${webPostAction('open-correct')}[data-record-id="${packing.recordId}"]`).click()
  282 |   const blockedCorrection = page.locator('[data-post-entry-form]')
  283 |   await expect(blockedCorrection.locator('[data-post-entry-supervisor]')).toHaveValue('')
  284 |   await blockedCorrection.locator('[data-post-entry-supervisor]').selectOption('PF-USER-POST-MGR')
  285 |   await blockedCorrection.locator(`[data-post-entry-line="${seed.skuId}"] [data-post-entry-quantity]`).fill('0')
  286 |   await blockedCorrection.locator('[data-post-entry-reason]').fill('核对已交复检占用，尝试减少包装原记录必须阻断')
  287 |   await blockedCorrection.locator(webPostAction('save-entry')).click()
  288 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('订正会破坏前后序或已交复检数量')
  289 |   await expect(blockedCorrection.locator('[data-post-entry-supervisor]')).toHaveValue('PF-USER-POST-MGR')
  290 |   await expect(blockedCorrection.locator('[data-post-entry-quantity]')).toHaveValue('0')
  291 |   await expect(blockedCorrection.locator('[data-post-entry-reason]')).toHaveValue('核对已交复检占用，尝试减少包装原记录必须阻断')
  292 |   const refused = await snapshot(page, seed)
  293 |   expect(refused.progress.records).toEqual(occupied.progress.records)
  294 |   expect(refused.rechecks).toEqual(occupied.rechecks)
  295 |   expect(refused.stored).toEqual(occupied.stored)
  296 |   await evidence(page, info, 'web-direct-correction-reservation-protected')
  297 | })
  298 | 
  299 | test('PFN-A04/A08-A13/A17-A18/A29：D1实际Web/PDA分项登记及100/100/800多次复检出货闭环', async ({ page }, info) => {
  300 |   test.setTimeout(180000)
  301 |   await page.setViewportSize({ width: 1366, height: 768 })
  302 |   const seed = await seedUpstream(page)
  303 |   await detail(page, seed)
  304 |   for (const [index, quantity] of [500, 300, 200, 100].entries()) await saveEntry(page, seed, processItems[index], quantity)
  305 |   let state = await snapshot(page, seed)
  306 |   expect(state.progress.processes.map(row => row.completedQty)).toEqual([500, 300, 200, 100])
  307 |   expect(state.progress.totalCompletedQty).toBe(100)
  308 |   await evidence(page, info, 'd1-four-process-500-300-200-100')
  309 |   await page.goto('/fcs/craft/post-finishing/work-orders')
  310 |   for (const item of processItems) await expect(page.getByRole('columnheader', { name: `${item}完成`, exact: true })).toBeVisible()
  311 |   expect(await page.locator('tbody tr').count()).toBe(1)
  312 |   await showProcessColumns(page)
  313 |   await evidence(page, info, 'd1-parent-list-four-quantities')
  314 |   await detail(page, seed)
  315 |   const first = await submitUi(page, seed, 100)
  316 |   expect((await snapshot(page, seed)).progress.availableForRecheckQty).toBe(0)
  317 |   const firstOutbound = await recheckUi(page, seed, first)
  318 |   await receiveUi(page, seed, firstOutbound)
  319 |   expect((await snapshot(page, seed)).delivery?.status).not.toBe('已完成')
  320 | 
  321 |   await page.evaluate(() => window.localStorage.setItem('fcs_pda_session', JSON.stringify({
  322 |     userId: 'F090_operator', loginId: 'F090_operator', userName: '全能力测试工厂_操作工', roleId: 'ROLE_OPERATOR',
  323 |     factoryId: 'F090', factoryName: '全能力测试工厂', loggedAt: '2026-10-19 08:00:00',
  324 |   })))
  325 |   await page.setViewportSize({ width: 390, height: 844 })
  326 |   await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.taskNo)}`)
  327 |   await expect(page.locator('[data-pda-post-task]')).toBeVisible()
  328 |   await page.locator('[data-post-process="包装"] > summary').click()
  329 |   await page.locator(`[data-post-process="包装"] [data-post-process-line="${seed.skuId}"] [data-post-process-qty]`).fill('100')
  330 |   await page.locator('[data-pda-post-action="save-process-completion"][data-process-item="包装"]').click()
  331 |   await expect(page.locator('[data-post-process="包装"]')).toContainText('200')
  332 |   // Finish the remaining work before the second handover. This freezes the
  333 |   // exact A29 boundary: F=1000, only 100 reserved/received and 900 still available.
  334 |   await page.setViewportSize({ width: 1280, height: 720 })
  335 |   await detail(page, seed)
  336 |   for (const [index, quantity] of [500, 700, 800, 800].entries()) await saveEntry(page, seed, processItems[index], quantity)
  337 |   state = await snapshot(page, seed)
  338 |   expect(state.progress.processes.map(row => row.completedQty)).toEqual([1000, 1000, 1000, 1000])
  339 |   expect(state.task?.status).toBe('后道完成')
  340 |   expect(state.progress.totalReservedQty).toBe(100)
  341 |   expect(state.progress.availableForRecheckQty).toBe(900)
  342 |   expect(state.receipts.reduce((sum, receipt) => sum + receipt.lines.reduce((qty, line) => qty + line.receivedQty, 0), 0)).toBe(100)
  343 |   expect(state.delivery?.status).not.toBe('已完成')
  344 |   await evidence(page, info, 'd1-post-completed-with-900-unsubmitted-after-first-receipt')
  345 |   await page.goto(`/fcs/craft/post-finishing/tasks?keyword=${encodeURIComponent(state.delivery!.productionOrderNo)}`)
  346 |   await page.locator(`[data-post-finishing-tasks-action="view-return-records"][data-production-order-no="${state.delivery!.productionOrderNo}"]`).click()
  347 |   const parent = page.getByTestId('post-production-task-return-dialog').locator('tbody tr').filter({ hasText: state.delivery!.deliveryOrderNo })
  348 |   await expect(parent).toHaveCount(1)
  349 |   await expect(parent.locator('td').nth(4)).not.toHaveText('已完成')
  350 |   await evidence(page, info, 'd1-parent-return-remains-open-after-100-received')
  351 |   await page.setViewportSize({ width: 390, height: 844 })
  352 |   await page.goto(`/fcs/pda/post-finishing/execute?id=${encodeURIComponent(seed.taskNo)}`)
  353 |   await expect(page.locator('[data-pda-post-task]')).toBeVisible()
  354 |   const handover = page.locator('[data-post-recheck-form]')
  355 |   if ((await handover.getAttribute('open')) === null) await handover.locator(':scope > summary').click()
  356 |   await page.locator(`[data-post-recheck-line="${seed.skuId}"] [data-post-recheck-qty]`).fill('100')
  357 |   await page.locator('[data-pda-post-action="submit-for-recheck"]').click()
  358 |   await expect.poll(async () => (await snapshot(page, seed)).rechecks.length).toBe(2)
  359 |   state = await snapshot(page, seed)
  360 |   const second = state.rechecks[1]
  361 |   const pdaRecord = state.progress.records.find(row => row.recordedBy.actorId === 'F090_operator')
  362 |   expect(pdaRecord?.recordedBy.actorName).toBe('全能力测试工厂_操作工')
  363 |   expect(pdaRecord?.processItem).toBe('包装')
  364 |   expect(pdaRecord?.quantities).toEqual([{ skuId: seed.skuId, quantity: 100 }])
  365 |   await evidence(page, info, 'd1-pda-second-processing-and-recheck')
  366 |   await page.locator(`[data-pda-post-action="open-recheck"][data-recheck-no="${second.recheckOrderNo}"]`).click()
  367 |   await expect(page.locator(`[data-pda-recheck-task="${second.recheckOrderId}"]`)).toBeVisible()
  368 |   await page.locator('[data-pda-post-action="claim-recheck"]').click()
  369 |   await expect(page.locator('[data-recheck-barcode-input]')).toBeVisible()
  370 |   await page.locator('[data-recheck-barcode-input]').fill('WRONG-BARCODE')
  371 |   await page.locator('[data-pda-post-action="scan-recheck-barcode"]').click()
  372 |   await expect(page.locator('[data-pda-recheck-task]')).toContainText('错误待重贴')
  373 |   await page.locator('[data-pda-post-action="complete-recheck"]').click()
  374 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('条码')
  375 |   expect((await snapshot(page, seed)).outbounds).toHaveLength(1)
  376 |   await page.locator('[data-pda-post-action="mark-relabeled"]').click()
```