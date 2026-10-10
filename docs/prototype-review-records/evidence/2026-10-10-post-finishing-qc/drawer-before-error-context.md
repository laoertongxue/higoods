# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> 仓库弹层跟随关联单据后关闭，返回列表可继续操作
- Location: tests/post-finishing-full-flow.spec.ts:1059:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=movements"]')
    - locator resolved to <a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=movements" class="border-b-2 px-1 py-3 text-sm border-transparent text-slate-600 hover:text-slate-900">流水记录</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="fixed inset-0 z-[150] bg-black/30" data-post-finishing-action="full-flow-close-overlay"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="fixed inset-0 z-[150] bg-black/30" data-post-finishing-action="full-flow-close-overlay"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    111 × waiting for element to be visible, enabled and stable
        - element is visible, enabled and stable
        - scrolling into view if needed
        - done scrolling
        - <div class="fixed inset-0 z-[150] bg-black/30" data-post-finishing-action="full-flow-close-overlay"></div> intercepts pointer events
      - retrying click action
        - waiting 500ms

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
              - button "贝壳绣加工单" [ref=e384]:
                - img [ref=e386]
                - generic [ref=e388]: 贝壳绣加工单
              - button "曲牙绣加工单" [ref=e390]:
                - img [ref=e392]
                - generic [ref=e394]: 曲牙绣加工单
              - button "一字贝绣花加工单" [ref=e396]:
                - img [ref=e398]
                - generic [ref=e400]: 一字贝绣花加工单
              - button "盘扣加工单" [ref=e402]:
                - img [ref=e404]
                - generic [ref=e406]: 盘扣加工单
              - button "花朵加工单" [ref=e408]:
                - img [ref=e410]
                - generic [ref=e412]: 花朵加工单
              - button "打褶加工单" [ref=e414]:
                - img [ref=e416]
                - generic [ref=e418]: 打褶加工单
              - button "烫钻加工单" [ref=e420]:
                - img [ref=e422]
                - generic [ref=e424]: 烫钻加工单
              - button "辅助工艺待加工仓" [ref=e426]:
                - img [ref=e428]
                - generic [ref=e431]: 辅助工艺待加工仓
              - button "辅助工艺待交出仓" [ref=e433]:
                - img [ref=e435]
                - generic [ref=e440]: 辅助工艺待交出仓
          - generic [ref=e441]:
            - button "特种工艺工厂管理" [expanded] [ref=e442]:
              - img [ref=e444]
              - generic [ref=e446]: 特种工艺工厂管理
              - img [ref=e447]
            - generic [ref=e449]:
              - button "模板工序加工单" [ref=e451]:
                - img [ref=e453]
                - generic [ref=e455]: 模板工序加工单
              - button "激光开袋加工单" [ref=e457]:
                - img [ref=e459]
                - generic [ref=e461]: 激光开袋加工单
              - button "特种车缝（花样机）加工单" [ref=e463]:
                - img [ref=e465]
                - generic [ref=e467]: 特种车缝（花样机）加工单
              - button "橡筋定长切割加工单" [ref=e469]:
                - img [ref=e471]
                - generic [ref=e473]: 橡筋定长切割加工单
              - button "特种工艺待加工仓" [ref=e475]:
                - img [ref=e477]
                - generic [ref=e480]: 特种工艺待加工仓
              - button "特种工艺待交出仓" [ref=e482]:
                - img [ref=e484]
                - generic [ref=e489]: 特种工艺待交出仓
    - main [ref=e490]:
      - generic [ref=e492]:
        - generic [ref=e494]:
          - button "后道待加工仓" [ref=e495]
          - button [ref=e496]:
            - img [ref=e497]
        - button "全部关闭" [ref=e502]
      - generic [ref=e506]:
        - generic [ref=e507]:
          - heading "后道待加工仓" [level=1] [ref=e508]
          - button "回货确认" [ref=e509]
        - generic [ref=e511]:
          - generic [ref=e512]:
            - generic [ref=e513]:
              - generic [ref=e514]: 待加工在仓
              - strong [ref=e515]: 15 条
            - generic [ref=e516]:
              - generic [ref=e517]: SKU 种数
              - strong [ref=e518]: 15 种
            - generic [ref=e519]:
              - generic [ref=e520]: 库区库位
              - strong [ref=e521]: 1 / 15
            - generic [ref=e522]:
              - generic [ref=e523]: 流转记录
              - strong [ref=e524]: 21 条
          - navigation "后道待加工仓页签" [ref=e525]:
            - generic [ref=e526]: 库存
            - generic [ref=e527]: 流水记录
            - generic [ref=e528]: 库区库位
            - generic [ref=e529]: 车缝登记回货
            - generic [ref=e530]: 辅料库存
          - generic [ref=e531]:
            - generic [ref=e532]:
              - text: 关键词
              - textbox "关键词" [ref=e533]:
                - /placeholder: SKU/款式名称/颜色/尺码
            - button "重置" [ref=e534]
            - button "查询" [ref=e535]
        - generic [ref=e536]:
          - generic [ref=e537]:
            - heading "车缝登记回货" [level=2] [ref=e538]
            - generic [ref=e539]: 当前库存 297 件
          - table [ref=e542]:
            - rowgroup [ref=e549]:
              - row "送货单 / 生产单 车缝工厂 / 任务 登记 / 确认 状态 操作" [ref=e550]:
                - columnheader "送货单 / 生产单" [ref=e551]
                - columnheader "车缝工厂 / 任务" [ref=e552]
                - columnheader "登记 / 确认" [ref=e553]
                - columnheader "状态" [ref=e554]
                - columnheader "操作" [ref=e555]
            - rowgroup [ref=e556]:
              - row "PO-QC-202608-003-5 PO-QC-202608-003 · 第 5 次回货 CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包 100 件 / 100 件 已送检 查看回货明细" [ref=e557]:
                - cell "PO-QC-202608-003-5 PO-QC-202608-003 · 第 5 次回货" [ref=e558]:
                  - generic [ref=e559]:
                    - button "PO-QC-202608-003-5" [ref=e560]
                    - generic [ref=e561]: PO-QC-202608-003 · 第 5 次回货
                - cell "CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包" [ref=e562]:
                  - generic [ref=e563]: CV Micro Sewing Semarang Timur
                  - generic [ref=e564]: SEW-TASK-QC-003 · 裁剪＋车缝＋烫包
                - cell "100 件 / 100 件" [ref=e565]
                - cell "已送检" [ref=e566]:
                  - generic [ref=e567]: 已送检
                - cell "查看回货明细" [ref=e568]:
                  - generic [ref=e570]: 查看回货明细
              - row "PO-QC-202608-003-4 PO-QC-202608-003 · 第 4 次回货 CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包 100 件 / 100 件 已送检 查看回货明细" [ref=e571]:
                - cell "PO-QC-202608-003-4 PO-QC-202608-003 · 第 4 次回货" [ref=e572]:
                  - generic [ref=e573]:
                    - button "PO-QC-202608-003-4" [ref=e574]
                    - generic [ref=e575]: PO-QC-202608-003 · 第 4 次回货
                - cell "CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包" [ref=e576]:
                  - generic [ref=e577]: CV Micro Sewing Semarang Timur
                  - generic [ref=e578]: SEW-TASK-QC-003 · 裁剪＋车缝＋烫包
                - cell "100 件 / 100 件" [ref=e579]
                - cell "已送检" [ref=e580]:
                  - generic [ref=e581]: 已送检
                - cell "查看回货明细" [ref=e582]:
                  - generic [ref=e584]: 查看回货明细
              - row "PO-QC-202608-003-3 PO-QC-202608-003 · 第 3 次回货 CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包 100 件 / 100 件 已送检 查看回货明细" [ref=e585]:
                - cell "PO-QC-202608-003-3 PO-QC-202608-003 · 第 3 次回货" [ref=e586]:
                  - generic [ref=e587]:
                    - button "PO-QC-202608-003-3" [ref=e588]
                    - generic [ref=e589]: PO-QC-202608-003 · 第 3 次回货
                - cell "CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包" [ref=e590]:
                  - generic [ref=e591]: CV Micro Sewing Semarang Timur
                  - generic [ref=e592]: SEW-TASK-QC-003 · 裁剪＋车缝＋烫包
                - cell "100 件 / 100 件" [ref=e593]
                - cell "已送检" [ref=e594]:
                  - generic [ref=e595]: 已送检
                - cell "查看回货明细" [ref=e596]:
                  - generic [ref=e598]: 查看回货明细
              - row "PO-QC-202608-003-2 PO-QC-202608-003 · 第 2 次回货 CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包 100 件 / 99 件 已确认待送检 查看并送检" [ref=e599]:
                - cell "PO-QC-202608-003-2 PO-QC-202608-003 · 第 2 次回货" [ref=e600]:
                  - generic [ref=e601]:
                    - button "PO-QC-202608-003-2" [ref=e602]
                    - generic [ref=e603]: PO-QC-202608-003 · 第 2 次回货
                - cell "CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包" [ref=e604]:
                  - generic [ref=e605]: CV Micro Sewing Semarang Timur
                  - generic [ref=e606]: SEW-TASK-QC-003 · 裁剪＋车缝＋烫包
                - cell "100 件 / 99 件" [ref=e607]
                - cell "已确认待送检" [ref=e608]:
                  - generic [ref=e609]: 已确认待送检
                - cell "查看并送检" [ref=e610]:
                  - generic [ref=e612]: 查看并送检
              - row "PO-QC-202608-003-1 PO-QC-202608-003 · 第 1 次回货 CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包 100 件 / 待点数 待后道确认 查看回货明细 废弃" [ref=e613]:
                - cell "PO-QC-202608-003-1 PO-QC-202608-003 · 第 1 次回货" [ref=e614]:
                  - generic [ref=e615]:
                    - button "PO-QC-202608-003-1" [ref=e616]
                    - generic [ref=e617]: PO-QC-202608-003 · 第 1 次回货
                - cell "CV Micro Sewing Semarang Timur SEW-TASK-QC-003 · 裁剪＋车缝＋烫包" [ref=e618]:
                  - generic [ref=e619]: CV Micro Sewing Semarang Timur
                  - generic [ref=e620]: SEW-TASK-QC-003 · 裁剪＋车缝＋烫包
                - cell "100 件 / 待点数" [ref=e621]
                - cell "待后道确认" [ref=e622]:
                  - generic [ref=e623]: 待后道确认
                - cell "查看回货明细 废弃" [ref=e624]:
                  - generic [ref=e625]:
                    - generic [ref=e626]: 查看回货明细
                    - button "废弃" [ref=e627]
              - row "PO-QC-202608-002-5 PO-QC-202608-002 · 第 5 次回货 CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包 100 件 / 100 件 已完成 查看回货明细" [ref=e628]:
                - cell "PO-QC-202608-002-5 PO-QC-202608-002 · 第 5 次回货" [ref=e629]:
                  - generic [ref=e630]:
                    - button "PO-QC-202608-002-5" [ref=e631]
                    - generic [ref=e632]: PO-QC-202608-002 · 第 5 次回货
                - cell "CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包" [ref=e633]:
                  - generic [ref=e634]: CV Micro Sewing Bandung Utara
                  - generic [ref=e635]: SEW-TASK-QC-002 · 车缝＋烫包
                - cell "100 件 / 100 件" [ref=e636]
                - cell "已完成" [ref=e637]:
                  - generic [ref=e638]: 已完成
                - cell "查看回货明细" [ref=e639]:
                  - generic [ref=e641]: 查看回货明细
              - row "PO-QC-202608-002-4 PO-QC-202608-002 · 第 4 次回货 CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包 100 件 / 100 件 已送检 查看回货明细" [ref=e642]:
                - cell "PO-QC-202608-002-4 PO-QC-202608-002 · 第 4 次回货" [ref=e643]:
                  - generic [ref=e644]:
                    - button "PO-QC-202608-002-4" [ref=e645]
                    - generic [ref=e646]: PO-QC-202608-002 · 第 4 次回货
                - cell "CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包" [ref=e647]:
                  - generic [ref=e648]: CV Micro Sewing Bandung Utara
                  - generic [ref=e649]: SEW-TASK-QC-002 · 车缝＋烫包
                - cell "100 件 / 100 件" [ref=e650]
                - cell "已送检" [ref=e651]:
                  - generic [ref=e652]: 已送检
                - cell "查看回货明细" [ref=e653]:
                  - generic [ref=e655]: 查看回货明细
              - row "PO-QC-202608-002-3 PO-QC-202608-002 · 第 3 次回货 CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包 100 件 / 100 件 已送检 查看回货明细" [ref=e656]:
                - cell "PO-QC-202608-002-3 PO-QC-202608-002 · 第 3 次回货" [ref=e657]:
                  - generic [ref=e658]:
                    - button "PO-QC-202608-002-3" [ref=e659]
                    - generic [ref=e660]: PO-QC-202608-002 · 第 3 次回货
                - cell "CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包" [ref=e661]:
                  - generic [ref=e662]: CV Micro Sewing Bandung Utara
                  - generic [ref=e663]: SEW-TASK-QC-002 · 车缝＋烫包
                - cell "100 件 / 100 件" [ref=e664]
                - cell "已送检" [ref=e665]:
                  - generic [ref=e666]: 已送检
                - cell "查看回货明细" [ref=e667]:
                  - generic [ref=e669]: 查看回货明细
              - row "PO-QC-202608-002-2 PO-QC-202608-002 · 第 2 次回货 CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包 100 件 / 99 件 已确认待送检 查看并送检" [ref=e670]:
                - cell "PO-QC-202608-002-2 PO-QC-202608-002 · 第 2 次回货" [ref=e671]:
                  - generic [ref=e672]:
                    - button "PO-QC-202608-002-2" [ref=e673]
                    - generic [ref=e674]: PO-QC-202608-002 · 第 2 次回货
                - cell "CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包" [ref=e675]:
                  - generic [ref=e676]: CV Micro Sewing Bandung Utara
                  - generic [ref=e677]: SEW-TASK-QC-002 · 车缝＋烫包
                - cell "100 件 / 99 件" [ref=e678]
                - cell "已确认待送检" [ref=e679]:
                  - generic [ref=e680]: 已确认待送检
                - cell "查看并送检" [ref=e681]:
                  - generic [ref=e683]: 查看并送检
              - row "PO-QC-202608-002-1 PO-QC-202608-002 · 第 1 次回货 CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包 100 件 / 待点数 待后道确认 查看回货明细 废弃" [ref=e684]:
                - cell "PO-QC-202608-002-1 PO-QC-202608-002 · 第 1 次回货" [ref=e685]:
                  - generic [ref=e686]:
                    - button "PO-QC-202608-002-1" [ref=e687]
                    - generic [ref=e688]: PO-QC-202608-002 · 第 1 次回货
                - cell "CV Micro Sewing Bandung Utara SEW-TASK-QC-002 · 车缝＋烫包" [ref=e689]:
                  - generic [ref=e690]: CV Micro Sewing Bandung Utara
                  - generic [ref=e691]: SEW-TASK-QC-002 · 车缝＋烫包
                - cell "100 件 / 待点数" [ref=e692]
                - cell "待后道确认" [ref=e693]:
                  - generic [ref=e694]: 待后道确认
                - cell "查看回货明细 废弃" [ref=e695]:
                  - generic [ref=e696]:
                    - generic [ref=e697]: 查看回货明细
                    - button "废弃" [ref=e698]
              - row "PO-QC-202608-001-5 PO-QC-202608-001 · 第 5 次回货 CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝 100 件 / 100 件 已送检 查看回货明细" [ref=e699]:
                - cell "PO-QC-202608-001-5 PO-QC-202608-001 · 第 5 次回货" [ref=e700]:
                  - generic [ref=e701]:
                    - button "PO-QC-202608-001-5" [ref=e702]
                    - generic [ref=e703]: PO-QC-202608-001 · 第 5 次回货
                - cell "CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝" [ref=e704]:
                  - generic [ref=e705]: CV Micro Sewing Jakarta Pusat
                  - generic [ref=e706]: SEW-TASK-QC-001 · 仅车缝
                - cell "100 件 / 100 件" [ref=e707]
                - cell "已送检" [ref=e708]:
                  - generic [ref=e709]: 已送检
                - cell "查看回货明细" [ref=e710]:
                  - generic [ref=e712]: 查看回货明细
              - row "PO-QC-202608-001-4 PO-QC-202608-001 · 第 4 次回货 CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝 100 件 / 100 件 已送检 查看回货明细" [ref=e713]:
                - cell "PO-QC-202608-001-4 PO-QC-202608-001 · 第 4 次回货" [ref=e714]:
                  - generic [ref=e715]:
                    - button "PO-QC-202608-001-4" [ref=e716]
                    - generic [ref=e717]: PO-QC-202608-001 · 第 4 次回货
                - cell "CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝" [ref=e718]:
                  - generic [ref=e719]: CV Micro Sewing Jakarta Pusat
                  - generic [ref=e720]: SEW-TASK-QC-001 · 仅车缝
                - cell "100 件 / 100 件" [ref=e721]
                - cell "已送检" [ref=e722]:
                  - generic [ref=e723]: 已送检
                - cell "查看回货明细" [ref=e724]:
                  - generic [ref=e726]: 查看回货明细
              - row "PO-QC-202608-001-3 PO-QC-202608-001 · 第 3 次回货 CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝 100 件 / 100 件 已送检 查看回货明细" [ref=e727]:
                - cell "PO-QC-202608-001-3 PO-QC-202608-001 · 第 3 次回货" [ref=e728]:
                  - generic [ref=e729]:
                    - button "PO-QC-202608-001-3" [ref=e730]
                    - generic [ref=e731]: PO-QC-202608-001 · 第 3 次回货
                - cell "CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝" [ref=e732]:
                  - generic [ref=e733]: CV Micro Sewing Jakarta Pusat
                  - generic [ref=e734]: SEW-TASK-QC-001 · 仅车缝
                - cell "100 件 / 100 件" [ref=e735]
                - cell "已送检" [ref=e736]:
                  - generic [ref=e737]: 已送检
                - cell "查看回货明细" [ref=e738]:
                  - generic [ref=e740]: 查看回货明细
              - row "PO-QC-202608-001-2 PO-QC-202608-001 · 第 2 次回货 CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝 100 件 / 99 件 已确认待送检 查看并送检" [ref=e741]:
                - cell "PO-QC-202608-001-2 PO-QC-202608-001 · 第 2 次回货" [ref=e742]:
                  - generic [ref=e743]:
                    - button "PO-QC-202608-001-2" [ref=e744]
                    - generic [ref=e745]: PO-QC-202608-001 · 第 2 次回货
                - cell "CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝" [ref=e746]:
                  - generic [ref=e747]: CV Micro Sewing Jakarta Pusat
                  - generic [ref=e748]: SEW-TASK-QC-001 · 仅车缝
                - cell "100 件 / 99 件" [ref=e749]
                - cell "已确认待送检" [ref=e750]:
                  - generic [ref=e751]: 已确认待送检
                - cell "查看并送检" [ref=e752]:
                  - generic [ref=e754]: 查看并送检
              - row "PO-QC-202608-001-1 PO-QC-202608-001 · 第 1 次回货 CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝 100 件 / 待点数 待后道确认 查看回货明细 废弃" [ref=e755]:
                - cell "PO-QC-202608-001-1 PO-QC-202608-001 · 第 1 次回货" [ref=e756]:
                  - generic [ref=e757]:
                    - button "PO-QC-202608-001-1" [ref=e758]
                    - generic [ref=e759]: PO-QC-202608-001 · 第 1 次回货
                - cell "CV Micro Sewing Jakarta Pusat SEW-TASK-QC-001 · 仅车缝" [ref=e760]:
                  - generic [ref=e761]: CV Micro Sewing Jakarta Pusat
                  - generic [ref=e762]: SEW-TASK-QC-001 · 仅车缝
                - cell "100 件 / 待点数" [ref=e763]
                - cell "待后道确认" [ref=e764]:
                  - generic [ref=e765]: 待后道确认
                - cell "查看回货明细 废弃" [ref=e766]:
                  - generic [ref=e767]:
                    - generic [ref=e768]: 查看回货明细
                    - button "废弃" [ref=e769]
          - generic [ref=e771]:
            - paragraph [ref=e772]: 共 15 条，当前 1-15
            - generic [ref=e773]:
              - combobox [ref=e774]:
                - option "10 条/页"
                - option "20 条/页" [selected]
                - option "50 条/页"
              - button "上一页" [disabled] [ref=e775]
              - generic [ref=e776]: 1 / 1
              - button "下一页" [disabled] [ref=e777]
        - dialog [ref=e779]:
          - generic [ref=e780]:
            - generic [ref=e781]:
              - button "后道验收衬衫 黑色 S" [ref=e782]:
                - img "后道验收衬衫 黑色 S" [ref=e783]
              - generic [ref=e784]:
                - heading "SPU-QC-001-01" [level=2] [ref=e785]
                - paragraph [ref=e786]: 后道验收衬衫 · 黑色 / S
            - button "关闭" [ref=e787]
          - generic [ref=e788]:
            - generic [ref=e789]:
              - text: 累计入仓
              - strong [ref=e790]: 79 件
            - generic [ref=e791]:
              - text: 当前库存
              - strong [ref=e792]: 19 件
            - generic [ref=e793]:
              - text: 累计出仓
              - strong [ref=e794]: 60 件
          - heading "按送货批次拆分" [level=3] [ref=e795]
          - generic [ref=e796]:
            - article [ref=e797]:
              - generic [ref=e798]:
                - generic [ref=e799]:
                  - generic [ref=e800]: PO-QC-202608-001-5
                  - generic [ref=e801]: PO-QC-202608-001 · 第 5 次回货 · WP-PF-ACCEPT-PO-1-5
                - generic [ref=e802]: 已送检
              - generic [ref=e803]:
                - generic [ref=e804]:
                  - text: 入仓
                  - strong [ref=e805]: 20 件
                - generic [ref=e806]:
                  - text: 可用
                  - strong [ref=e807]: 0 件
                - generic [ref=e808]:
                  - text: 出仓
                  - strong [ref=e809]: 20 件
              - generic [ref=e810]:
                - generic [ref=e811]: 查看批次
                - generic [ref=e812]: 查看全流程
            - article [ref=e813]:
              - generic [ref=e814]:
                - generic [ref=e815]:
                  - generic [ref=e816]: PO-QC-202608-001-4
                  - generic [ref=e817]: PO-QC-202608-001 · 第 4 次回货 · WP-PF-ACCEPT-PO-1-4
                - generic [ref=e818]: 已送检
              - generic [ref=e819]:
                - generic [ref=e820]:
                  - text: 入仓
                  - strong [ref=e821]: 20 件
                - generic [ref=e822]:
                  - text: 可用
                  - strong [ref=e823]: 0 件
                - generic [ref=e824]:
                  - text: 出仓
                  - strong [ref=e825]: 20 件
              - generic [ref=e826]:
                - generic [ref=e827]: 查看批次
                - generic [ref=e828]: 查看全流程
            - article [ref=e829]:
              - generic [ref=e830]:
                - generic [ref=e831]:
                  - generic [ref=e832]: PO-QC-202608-001-3
                  - generic [ref=e833]: PO-QC-202608-001 · 第 3 次回货 · WP-PF-ACCEPT-PO-1-3
                - generic [ref=e834]: 已送检
              - generic [ref=e835]:
                - generic [ref=e836]:
                  - text: 入仓
                  - strong [ref=e837]: 20 件
                - generic [ref=e838]:
                  - text: 可用
                  - strong [ref=e839]: 0 件
                - generic [ref=e840]:
                  - text: 出仓
                  - strong [ref=e841]: 20 件
              - generic [ref=e842]:
                - generic [ref=e843]: 查看批次
                - generic [ref=e844]: 查看全流程
            - article [ref=e845]:
              - generic [ref=e846]:
                - generic [ref=e847]:
                  - generic [ref=e848]: PO-QC-202608-001-2
                  - generic [ref=e849]: PO-QC-202608-001 · 第 2 次回货 · WP-PF-ACCEPT-PO-1-2
                - generic [ref=e850]: 待送检
              - generic [ref=e851]:
                - generic [ref=e852]:
                  - text: 入仓
                  - strong [ref=e853]: 19 件
                - generic [ref=e854]:
                  - text: 可用
                  - strong [ref=e855]: 19 件
                - generic [ref=e856]:
                  - text: 出仓
                  - strong [ref=e857]: 0 件
              - generic [ref=e858]:
                - generic [ref=e859]: 查看批次并送检
                - generic [ref=e860]: 查看全流程
            - article [ref=e861]:
              - generic [ref=e862]:
                - generic [ref=e863]:
                  - generic [ref=e864]: PO-QC-202608-001-1
                  - generic [ref=e865]: PO-QC-202608-001 · 第 1 次回货 · WP-PF-ACCEPT-PO-1-1
                - generic [ref=e866]: 待确认
              - generic [ref=e867]:
                - generic [ref=e868]:
                  - text: 入仓
                  - strong [ref=e869]: 0 件
                - generic [ref=e870]:
                  - text: 可用
                  - strong [ref=e871]: 0 件
                - generic [ref=e872]:
                  - text: 出仓
                  - strong [ref=e873]: 0 件
              - generic [ref=e874]:
                - generic [ref=e875]: 查看批次
                - generic [ref=e876]: 查看全流程
  - button "查生产" [ref=e877]:
    - img [ref=e878]
```

# Test source

```ts
  970  |   await expect(page.locator('main [data-object-type="QC_ORDER"],main [data-object-type="PRODUCTION_ORDER"]')).toHaveCount(0)
  971  |   await expect(page.locator('main')).toContainText('生产主线关联待补')
  972  |   await expect(page.locator('main')).toContainText('MISSING-PRODUCTION-SOURCE')
  973  | })
  974  | 
  975  | test('后道仓库只读自身库存，切换生产入口后恢复部位票读取', async ({ page }) => {
  976  |   const requests: string[] = []
  977  |   page.on('request', request => requests.push(request.url()))
  978  |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  979  |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  980  |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(false)
  981  |   // 触发同一页面会话的原站内路由事件，验证一次性来源读取没有漏掉后续入口。
  982  |   await page.evaluate(() => {
  983  |     history.pushState({}, '', '/fcs/craft/post-finishing/work-orders')
  984  |     window.dispatchEvent(new PopStateEvent('popstate'))
  985  |   })
  986  |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  987  |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  988  |   await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  989  | })
  990  | 
  991  | test('执行质检延后部位票，打开生产关联入口时恢复读取', async ({ page }) => {
  992  |   const requests: string[] = []
  993  |   page.on('request', request => requests.push(request.url()))
  994  |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  995  |   await expect(page.locator('main h1')).toHaveText('执行质检')
  996  |   await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  997  |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(false)
  998  |   const task = await page.locator('[data-qc-workbench-task]').getAttribute('data-qc-workbench-task')
  999  |   await page.locator('[data-production-object-action]').first().click()
  1000 |   await expect.poll(() => requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1001 |   await expect(page.locator('[data-production-object-surface="search"]')).toBeVisible()
  1002 |   await expect(page.locator('[data-qc-workbench-task]')).toHaveAttribute('data-qc-workbench-task', task!)
  1003 | })
  1004 | 
  1005 | test('后道命名页复用现有渲染器，其他生产入口按原方式读取', async ({ page }) => {
  1006 |   const requests: string[] = []
  1007 |   page.on('request', request => requests.push(request.url()))
  1008 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  1009 |   await expect(page.locator('main h1')).toHaveText('执行质检')
  1010 |   await expect(page.locator('[data-qc-spu-color-images] img')).toHaveCount(5)
  1011 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1012 |   await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  1013 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1014 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1015 |   await page.goto('/fcs/craft/post-finishing/work-orders/%50F-POST-PF-ACCEPT-PO-1-5')
  1016 |   await expect(page.locator('main h1')).toHaveText('执行后道加工单')
  1017 |   await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  1018 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1019 |   await page.goto('/fcs/production/orders')
  1020 |   await expect(page.locator('main h1')).toHaveText('生产单管理')
  1021 |   expect(requests.some(url => url.includes('/src/pages/production/orders-domain'))).toBe(true)
  1022 |   for (const suffix of ['constructor', 'toString', '__proto__']) {
  1023 |     await page.goto(`/fcs/craft/post-finishing/${suffix}`)
  1024 |     await expect(page.locator('main h1')).toHaveText('页面未找到', { timeout: 5000 })
  1025 |   }
  1026 | })
  1027 | 
  1028 | test('质检清单按新编号查询并复位筛选', async ({ page }) => {
  1029 |   await page.goto('/fcs/craft/post-finishing/qc-orders')
  1030 |   await expect(page.locator('main h1')).toHaveText('质检清单')
  1031 |   const filters = page.locator('form[action="/fcs/craft/post-finishing/qc-orders"]')
  1032 |   await filters.locator('input[name="keyword"]').fill('NO-QC-MATCH-20261010')
  1033 |   await filters.getByRole('button', { name: '查询', exact: true }).click()
  1034 |   await expect(page).toHaveURL(/keyword=NO-QC-MATCH-20261010/, { timeout: 5000 })
  1035 |   await expect(page.locator('main')).toContainText('暂无符合条件的质检单')
  1036 |   await page.locator('form[action="/fcs/craft/post-finishing/qc-orders"] a[data-nav="/fcs/craft/post-finishing/qc-orders"]').click()
  1037 |   await expect(page).toHaveURL(/\/qc-orders$/)
  1038 |   await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  1039 |   await page.locator('input[name="keyword"]').fill('PO-QC-202608-001-4-ZJ')
  1040 |   await page.locator('main').getByRole('button', { name: '查询', exact: true }).click()
  1041 |   await expect(page).toHaveURL(/keyword=PO-QC-202608-001-4-ZJ/)
  1042 |   await expect(page.locator('main tbody tr')).toHaveCount(1)
  1043 |   await expect(page.locator('main tbody')).toContainText('PO-QC-202608-001-4-ZJ')
  1044 |   for (const list of ['work-orders', 'recheck-orders', 'outbound-orders', 'material-transfers']) {
  1045 |     const path = `/fcs/craft/post-finishing/${list}`
  1046 |     await page.goto(path)
  1047 |     await expect(page.locator('main h1')).toBeVisible()
  1048 |     const form = page.locator(`form[action="${path}"]`)
  1049 |     await form.locator('input[name="keyword"]').fill('NO-POST-MATCH-20261010')
  1050 |     await form.getByRole('button', { name: '查询', exact: true }).click()
  1051 |     await expect(page).toHaveURL(/keyword=NO-POST-MATCH-20261010/)
  1052 |     await expect(page.locator('main tbody')).not.toContainText('PO-QC-')
  1053 |     await page.locator(`form[action="${path}"] a[data-nav="${path}"]`).click()
  1054 |     await expect(page).toHaveURL(new RegExp(`${list}$`))
  1055 |     await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  1056 |   }
  1057 | })
  1058 | 
  1059 | test('仓库弹层跟随关联单据后关闭，返回列表可继续操作', async ({ page }) => {
  1060 |   const warehouse = '/fcs/craft/post-finishing/wait-process-warehouse'
  1061 |   await page.goto(warehouse)
  1062 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1063 |   await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  1064 |   const drawer = page.locator('[data-warehouse-inventory-drawer]')
  1065 |   await expect(drawer).toBeVisible()
  1066 |   await drawer.locator('a[data-nav*="deliveryId="]').first().click()
  1067 |   await expect(page.locator('[data-return-confirm-root]')).toBeVisible()
  1068 |   await page.locator('button[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns"]').click()
  1069 |   await expect(page.locator('[data-warehouse-inventory-drawer]')).toHaveCount(0, { timeout: 5000 })
> 1070 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=movements"]').click()
       |                                                                                                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  1071 |   await expect(page.locator('main')).toContainText('库存流水')
  1072 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=materials"]').click()
  1073 |   await page.locator('[data-post-finishing-action="full-flow-open-material-stock"]').first().click()
  1074 |   await expect(page.locator('[data-material-stock-drawer]')).toBeVisible()
  1075 |   await page.locator('[data-material-stock-drawer] a[data-nav]').click()
  1076 |   await expect(page).toHaveURL(/material-transfers\?transferId=/)
  1077 |   await page.evaluate((path) => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, `${warehouse}?tab=materials`)
  1078 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1079 |   await expect(page.locator('[data-material-stock-drawer]')).toHaveCount(0)
  1080 |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  1081 |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  1082 |   await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  1083 |   await expect(drawer).toBeVisible()
  1084 |   await drawer.locator('a[data-nav*="recheck-orders"]').first().click()
  1085 |   await expect(page.locator('main h1')).toHaveText('复检单')
  1086 |   await page.evaluate(() => { history.pushState({}, '', '/fcs/craft/post-finishing/wait-handover-warehouse'); window.dispatchEvent(new PopStateEvent('popstate')) })
  1087 |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  1088 |   await expect(drawer).toHaveCount(0)
  1089 | })
  1090 | 
```