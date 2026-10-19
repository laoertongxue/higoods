# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-consumers.spec.ts >> A22: restored new facts reject overquantity, duplicate intent and forged recheck reservation
- Location: tests/post-finishing-consumers.spec.ts:177:1

# Error details

```
Error: expect(received).not.toEqual(expected) // deep equality

Expected: not ArrayContaining [StringContaining "UNEXPECTED_SUCCESS"]
Received:     ["outbound-overquantity:UNEXPECTED_SUCCESS", "duplicate-outbound-recheck:UNEXPECTED_SUCCESS", "outbound-foreign-parent:UNEXPECTED_SUCCESS", "outbound-foreign-sku:UNEXPECTED_SUCCESS", "outbound-foreign-delivery:UNEXPECTED_SUCCESS", "outbound-foreign-qc:UNEXPECTED_SUCCESS", "handover-overquantity:UNEXPECTED_SUCCESS", "receipt-overquantity:UNEXPECTED_SUCCESS", "duplicate-receipt-outbound:UNEXPECTED_SUCCESS", "correction-foreign-responsible:UNEXPECTED_SUCCESS", …]
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
          - button "后道加工单" [ref=e483]
          - button [ref=e484]:
            - img [ref=e485]
        - button "全部关闭" [ref=e490]
      - generic [ref=e493]:
        - generic [ref=e494]:
          - heading "后道加工单" [level=1] [ref=e495]
          - button "登记加工" [ref=e496]
        - generic [ref=e498]:
          - generic [ref=e499]:
            - text: 关键词
            - textbox "关键词" [ref=e500]:
              - /placeholder: 后道加工单/质检单/生产单/款式/后道项目
          - generic [ref=e501]:
            - text: 当前状态
            - combobox "当前状态" [ref=e502]:
              - option "全部" [selected]
              - option "待后道"
              - option "后道中"
              - option "后道完成"
          - generic [ref=e503]:
            - text: 后道项目
            - combobox "后道项目" [ref=e504]:
              - option "全部" [selected]
              - option "开扣眼"
              - option "装扣子"
              - option "熨烫"
              - option "包装"
          - generic [ref=e505]:
            - text: 工厂
            - combobox "工厂" [ref=e506]:
              - option "全部" [selected]
              - option "PT Prima Printing Center"
          - generic [ref=e507]:
            - generic [ref=e508]: 重置
            - button "查询" [ref=e509]
        - generic [ref=e510]:
          - generic [ref=e511]:
            - generic [ref=e512]: 后道加工单
            - strong [ref=e513]: 3 张
          - generic [ref=e514]:
            - generic [ref=e515]: 等待后道
            - strong [ref=e516]: 1 张
          - generic [ref=e517]:
            - generic [ref=e518]: 后道中
            - strong [ref=e519]: 0 张
          - generic [ref=e520]:
            - generic [ref=e521]: 尚未完成后道
            - strong [ref=e522]: 84 件
        - generic [ref=e523]:
          - table [ref=e526]:
            - rowgroup [ref=e545]:
              - row "单据 工厂 SKU 明细 任务范围 / 后道项目 辅料到位 总数量 开扣眼完成 装扣子完成 熨烫完成 包装完成 全部后道完成 尚未完成后道 可交复检 复检 / 出货进度 后道状态 时间 操作" [ref=e546]:
                - columnheader "单据" [ref=e547]
                - columnheader "工厂" [ref=e548]
                - columnheader "SKU 明细" [ref=e549]
                - columnheader "任务范围 / 后道项目" [ref=e550]
                - columnheader "辅料到位" [ref=e551]
                - columnheader "总数量" [ref=e552]
                - columnheader "开扣眼完成" [ref=e553]
                - columnheader "装扣子完成" [ref=e554]
                - columnheader "熨烫完成" [ref=e555]
                - columnheader "包装完成" [ref=e556]
                - columnheader "全部后道完成" [ref=e557]
                - columnheader "尚未完成后道" [ref=e558]
                - columnheader "可交复检" [ref=e559]
                - columnheader "复检 / 出货进度" [ref=e560]
                - columnheader "后道状态" [ref=e561]
                - columnheader "时间" [ref=e562]
                - columnheader "操作" [ref=e563]
            - rowgroup [ref=e564]:
              - row "加工单：PO-QC-202608-001-5-ZJ-HD 质检：PO-QC-202608-001-5-ZJ 生产：PO-QC-202608-001 第 5 次回货 · PO-QC-202608-001-5 来源：CV Micro Sewing Jakarta Pusat 后道：PT Prima Printing Center 后道验收衬衫 黑色 S SPU-QC-001-01 黑色 / S · 10 件 后道验收衬衫 白色 M SPU-QC-001-02 白色 / M · 14 件 后道验收衬衫 雾蓝 L SPU-QC-001-03 雾蓝 / L · 20 件 后道验收衬衫 卡其 XL SPU-QC-001-04 卡其 / XL · 20 件 后道验收衬衫 酒红 2XL SPU-QC-001-05 酒红 / 2XL · 20 件 仅车缝 · 后道工厂负责 来源：任务后道 开扣眼 装扣子 熨烫 包装 待入库 仅提示，不阻断开工 DB-PF-202608-001 84 件 0 / 84 0 / 84 0 / 84 0 / 84 0 件 84 件 0 件 已交复检 0 件 · 0 张 待复检 0 件 待接收 0 / 已接收 0 件 · 0 张 待后道 创建：2026/8/25 14:40:00 开始：— 完成：— 登记加工 查看记录 打印加工单 查看全流程" [ref=e565]:
                - cell "加工单：PO-QC-202608-001-5-ZJ-HD 质检：PO-QC-202608-001-5-ZJ 生产：PO-QC-202608-001 第 5 次回货 · PO-QC-202608-001-5" [ref=e566]:
                  - generic [ref=e567]:
                    - text: 加工单：
                    - strong [ref=e568]: PO-QC-202608-001-5-ZJ-HD
                  - generic [ref=e569]: 质检：PO-QC-202608-001-5-ZJ
                  - generic [ref=e570]: 生产：PO-QC-202608-001
                  - generic [ref=e571]: 第 5 次回货 · PO-QC-202608-001-5
                - cell "来源：CV Micro Sewing Jakarta Pusat 后道：PT Prima Printing Center" [ref=e572]:
                  - generic [ref=e573]: 来源：CV Micro Sewing Jakarta Pusat
                  - generic [ref=e574]: 后道：PT Prima Printing Center
                - cell "后道验收衬衫 黑色 S SPU-QC-001-01 黑色 / S · 10 件 后道验收衬衫 白色 M SPU-QC-001-02 白色 / M · 14 件 后道验收衬衫 雾蓝 L SPU-QC-001-03 雾蓝 / L · 20 件 后道验收衬衫 卡其 XL SPU-QC-001-04 卡其 / XL · 20 件 后道验收衬衫 酒红 2XL SPU-QC-001-05 酒红 / 2XL · 20 件" [ref=e575]:
                  - generic [ref=e576]:
                    - generic [ref=e577]:
                      - button "后道验收衬衫 黑色 S" [ref=e578]:
                        - img "后道验收衬衫 黑色 S" [ref=e579]
                      - generic [ref=e580]:
                        - generic [ref=e581]: SPU-QC-001-01
                        - text: 黑色 / S · 10 件
                    - generic [ref=e582]:
                      - button "后道验收衬衫 白色 M" [ref=e583]:
                        - img "后道验收衬衫 白色 M" [ref=e584]
                      - generic [ref=e585]:
                        - generic [ref=e586]: SPU-QC-001-02
                        - text: 白色 / M · 14 件
                    - generic [ref=e587]:
                      - button "后道验收衬衫 雾蓝 L" [ref=e588]:
                        - img "后道验收衬衫 雾蓝 L" [ref=e589]
                      - generic [ref=e590]:
                        - generic [ref=e591]: SPU-QC-001-03
                        - text: 雾蓝 / L · 20 件
                    - generic [ref=e592]:
                      - button "后道验收衬衫 卡其 XL" [ref=e593]:
                        - img "后道验收衬衫 卡其 XL" [ref=e594]
                      - generic [ref=e595]:
                        - generic [ref=e596]: SPU-QC-001-04
                        - text: 卡其 / XL · 20 件
                    - generic [ref=e597]:
                      - button "后道验收衬衫 酒红 2XL" [ref=e598]:
                        - img "后道验收衬衫 酒红 2XL" [ref=e599]
                      - generic [ref=e600]:
                        - generic [ref=e601]: SPU-QC-001-05
                        - text: 酒红 / 2XL · 20 件
                - cell "仅车缝 · 后道工厂负责 来源：任务后道 开扣眼 装扣子 熨烫 包装" [ref=e602]:
                  - generic [ref=e603]: 仅车缝 · 后道工厂负责
                  - generic [ref=e604]: 来源：任务后道
                  - generic [ref=e605]:
                    - generic [ref=e606]: 开扣眼
                    - generic [ref=e607]: 装扣子
                    - generic [ref=e608]: 熨烫
                    - generic [ref=e609]: 包装
                - cell "待入库 仅提示，不阻断开工 DB-PF-202608-001" [ref=e610]:
                  - generic [ref=e611]: 待入库
                  - generic [ref=e612]: 仅提示，不阻断开工
                  - generic [ref=e613]: DB-PF-202608-001
                - cell "84 件" [ref=e614]
                - cell "0 / 84" [ref=e615]
                - cell "0 / 84" [ref=e616]
                - cell "0 / 84" [ref=e617]
                - cell "0 / 84" [ref=e618]
                - cell "0 件" [ref=e619]
                - cell "84 件" [ref=e620]
                - cell "0 件" [ref=e621]
                - cell "已交复检 0 件 · 0 张 待复检 0 件 待接收 0 / 已接收 0 件 · 0 张" [ref=e622]:
                  - generic [ref=e623]: 已交复检 0 件 · 0 张
                  - generic [ref=e624]: 待复检 0 件
                  - generic [ref=e625]: 待接收 0 / 已接收 0 件 · 0 张
                - cell "待后道" [ref=e626]:
                  - generic [ref=e627]: 待后道
                - cell "创建：2026/8/25 14:40:00 开始：— 完成：—" [ref=e628]:
                  - generic [ref=e629]: 创建：2026/8/25 14:40:00
                  - generic [ref=e630]: 开始：—
                  - generic [ref=e631]: 完成：—
                - cell "登记加工 查看记录 打印加工单 查看全流程" [ref=e632]:
                  - generic [ref=e633]:
                    - generic [ref=e634]: 登记加工
                    - generic [ref=e635]: 查看记录
                    - generic [ref=e636]: 打印加工单
                    - generic [ref=e637]: 查看全流程
              - row "加工单：PO-QC-202608-003-4-ZJ-HD 质检：PO-QC-202608-003-4-ZJ 生产：PO-QC-202608-003 第 4 次回货 · PO-QC-202608-003-4 来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center 后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件 裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装 质检补加工不读取主调拨状态 100 件 不涉及 不涉及 100 / 100 100 / 100 100 件 0 件 0 件 已交复检 100 件 · 1 张 待复检 100 件 待接收 0 / 已接收 0 件 · 0 张 后道完成 创建：2026/8/25 23:40:00 开始：2026/8/26 00:00:00 完成：2026/8/26 00:00:00 查看加工单 查看记录 打印加工单 查看全流程" [ref=e638]:
                - cell "加工单：PO-QC-202608-003-4-ZJ-HD 质检：PO-QC-202608-003-4-ZJ 生产：PO-QC-202608-003 第 4 次回货 · PO-QC-202608-003-4" [ref=e639]:
                  - generic [ref=e640]:
                    - text: 加工单：
                    - strong [ref=e641]: PO-QC-202608-003-4-ZJ-HD
                  - generic [ref=e642]: 质检：PO-QC-202608-003-4-ZJ
                  - generic [ref=e643]: 生产：PO-QC-202608-003
                  - generic [ref=e644]: 第 4 次回货 · PO-QC-202608-003-4
                - cell "来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center" [ref=e645]:
                  - generic [ref=e646]: 来源：CV Micro Sewing Semarang Timur
                  - generic [ref=e647]: 后道：PT Prima Printing Center
                - cell "后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件" [ref=e648]:
                  - generic [ref=e649]:
                    - generic [ref=e650]:
                      - button "后道验收外套 黑色 S" [ref=e651]:
                        - img "后道验收外套 黑色 S" [ref=e652]
                      - generic [ref=e653]:
                        - generic [ref=e654]: SPU-QC-003-01
                        - text: 黑色 / S · 20 件
                    - generic [ref=e655]:
                      - button "后道验收外套 白色 M" [ref=e656]:
                        - img "后道验收外套 白色 M" [ref=e657]
                      - generic [ref=e658]:
                        - generic [ref=e659]: SPU-QC-003-02
                        - text: 白色 / M · 20 件
                    - generic [ref=e660]:
                      - button "后道验收外套 雾蓝 L" [ref=e661]:
                        - img "后道验收外套 雾蓝 L" [ref=e662]
                      - generic [ref=e663]:
                        - generic [ref=e664]: SPU-QC-003-03
                        - text: 雾蓝 / L · 20 件
                    - generic [ref=e665]:
                      - button "后道验收外套 卡其 XL" [ref=e666]:
                        - img "后道验收外套 卡其 XL" [ref=e667]
                      - generic [ref=e668]:
                        - generic [ref=e669]: SPU-QC-003-04
                        - text: 卡其 / XL · 20 件
                    - generic [ref=e670]:
                      - button "后道验收外套 酒红 2XL" [ref=e671]:
                        - img "后道验收外套 酒红 2XL" [ref=e672]
                      - generic [ref=e673]:
                        - generic [ref=e674]: SPU-QC-003-05
                        - text: 酒红 / 2XL · 20 件
                - cell "裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装" [ref=e675]:
                  - generic [ref=e676]: 裁剪＋车缝＋烫包 · 三方工厂负责
                  - generic [ref=e677]: 来源：质检补加工
                  - generic [ref=e678]:
                    - generic [ref=e679]: 熨烫
                    - generic [ref=e680]: 包装
                - cell "质检补加工不读取主调拨状态" [ref=e681]
                - cell "100 件" [ref=e682]
                - cell "不涉及" [ref=e683]
                - cell "不涉及" [ref=e684]
                - cell "100 / 100" [ref=e685]
                - cell "100 / 100" [ref=e686]
                - cell "100 件" [ref=e687]
                - cell "0 件" [ref=e688]
                - cell "0 件" [ref=e689]
                - cell "已交复检 100 件 · 1 张 待复检 100 件 待接收 0 / 已接收 0 件 · 0 张" [ref=e690]:
                  - generic [ref=e691]: 已交复检 100 件 · 1 张
                  - generic [ref=e692]: 待复检 100 件
                  - generic [ref=e693]: 待接收 0 / 已接收 0 件 · 0 张
                - cell "后道完成" [ref=e694]:
                  - generic [ref=e695]: 后道完成
                - cell "创建：2026/8/25 23:40:00 开始：2026/8/26 00:00:00 完成：2026/8/26 00:00:00" [ref=e696]:
                  - generic [ref=e697]: 创建：2026/8/25 23:40:00
                  - generic [ref=e698]: 开始：2026/8/26 00:00:00
                  - generic [ref=e699]: 完成：2026/8/26 00:00:00
                - cell "查看加工单 查看记录 打印加工单 查看全流程" [ref=e700]:
                  - generic [ref=e701]:
                    - generic [ref=e702]: 查看加工单
                    - generic [ref=e703]: 查看记录
                    - generic [ref=e704]: 打印加工单
                    - generic [ref=e705]: 查看全流程
              - row "加工单：PO-QC-202608-003-5-ZJ-HD 质检：PO-QC-202608-003-5-ZJ 生产：PO-QC-202608-003 第 5 次回货 · PO-QC-202608-003-5 来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center 后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件 裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装 质检补加工不读取主调拨状态 100 件 不涉及 不涉及 100 / 100 100 / 100 100 件 0 件 0 件 已交复检 100 件 · 1 张 待复检 0 件 待接收 100 / 已接收 0 件 · 1 张 后道完成 创建：2026/8/26 00:40:00 开始：2026/8/26 01:00:00 完成：2026/8/26 01:00:00 查看加工单 查看记录 打印加工单 查看全流程" [ref=e706]:
                - cell "加工单：PO-QC-202608-003-5-ZJ-HD 质检：PO-QC-202608-003-5-ZJ 生产：PO-QC-202608-003 第 5 次回货 · PO-QC-202608-003-5" [ref=e707]:
                  - generic [ref=e708]:
                    - text: 加工单：
                    - strong [ref=e709]: PO-QC-202608-003-5-ZJ-HD
                  - generic [ref=e710]: 质检：PO-QC-202608-003-5-ZJ
                  - generic [ref=e711]: 生产：PO-QC-202608-003
                  - generic [ref=e712]: 第 5 次回货 · PO-QC-202608-003-5
                - cell "来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center" [ref=e713]:
                  - generic [ref=e714]: 来源：CV Micro Sewing Semarang Timur
                  - generic [ref=e715]: 后道：PT Prima Printing Center
                - cell "后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件" [ref=e716]:
                  - generic [ref=e717]:
                    - generic [ref=e718]:
                      - button "后道验收外套 黑色 S" [ref=e719]:
                        - img "后道验收外套 黑色 S" [ref=e720]
                      - generic [ref=e721]:
                        - generic [ref=e722]: SPU-QC-003-01
                        - text: 黑色 / S · 20 件
                    - generic [ref=e723]:
                      - button "后道验收外套 白色 M" [ref=e724]:
                        - img "后道验收外套 白色 M" [ref=e725]
                      - generic [ref=e726]:
                        - generic [ref=e727]: SPU-QC-003-02
                        - text: 白色 / M · 20 件
                    - generic [ref=e728]:
                      - button "后道验收外套 雾蓝 L" [ref=e729]:
                        - img "后道验收外套 雾蓝 L" [ref=e730]
                      - generic [ref=e731]:
                        - generic [ref=e732]: SPU-QC-003-03
                        - text: 雾蓝 / L · 20 件
                    - generic [ref=e733]:
                      - button "后道验收外套 卡其 XL" [ref=e734]:
                        - img "后道验收外套 卡其 XL" [ref=e735]
                      - generic [ref=e736]:
                        - generic [ref=e737]: SPU-QC-003-04
                        - text: 卡其 / XL · 20 件
                    - generic [ref=e738]:
                      - button "后道验收外套 酒红 2XL" [ref=e739]:
                        - img "后道验收外套 酒红 2XL" [ref=e740]
                      - generic [ref=e741]:
                        - generic [ref=e742]: SPU-QC-003-05
                        - text: 酒红 / 2XL · 20 件
                - cell "裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装" [ref=e743]:
                  - generic [ref=e744]: 裁剪＋车缝＋烫包 · 三方工厂负责
                  - generic [ref=e745]: 来源：质检补加工
                  - generic [ref=e746]:
                    - generic [ref=e747]: 熨烫
                    - generic [ref=e748]: 包装
                - cell "质检补加工不读取主调拨状态" [ref=e749]
                - cell "100 件" [ref=e750]
                - cell "不涉及" [ref=e751]
                - cell "不涉及" [ref=e752]
                - cell "100 / 100" [ref=e753]
                - cell "100 / 100" [ref=e754]
                - cell "100 件" [ref=e755]
                - cell "0 件" [ref=e756]
                - cell "0 件" [ref=e757]
                - cell "已交复检 100 件 · 1 张 待复检 0 件 待接收 100 / 已接收 0 件 · 1 张" [ref=e758]:
                  - generic [ref=e759]: 已交复检 100 件 · 1 张
                  - generic [ref=e760]: 待复检 0 件
                  - generic [ref=e761]: 待接收 100 / 已接收 0 件 · 1 张
                - cell "后道完成" [ref=e762]:
                  - generic [ref=e763]: 后道完成
                - cell "创建：2026/8/26 00:40:00 开始：2026/8/26 01:00:00 完成：2026/8/26 01:00:00" [ref=e764]:
                  - generic [ref=e765]: 创建：2026/8/26 00:40:00
                  - generic [ref=e766]: 开始：2026/8/26 01:00:00
                  - generic [ref=e767]: 完成：2026/8/26 01:00:00
                - cell "查看加工单 查看记录 打印加工单 查看全流程" [ref=e768]:
                  - generic [ref=e769]:
                    - generic [ref=e770]: 查看加工单
                    - generic [ref=e771]: 查看记录
                    - generic [ref=e772]: 打印加工单
                    - generic [ref=e773]: 查看全流程
          - generic [ref=e775]:
            - paragraph [ref=e776]: 共 3 条，当前 1-3
            - generic [ref=e777]:
              - combobox [ref=e778]:
                - option "10 条/页"
                - option "20 条/页" [selected]
                - option "50 条/页"
              - button "上一页" [disabled] [ref=e779]
              - generic [ref=e780]: 1 / 1
              - button "下一页" [disabled] [ref=e781]
  - button "查生产" [ref=e782]:
    - img [ref=e783]
```

# Test source

```ts
  188 |       const extra = structuredClone(kind.includes('recheck') || kind === 'foreign-sku' ? recheck : original)
  189 |       const id = `INVALID-${kind}`
  190 |       extra.id = extra.id.replace(/[^/]+$/, id)
  191 |       if (extra.collection === 'flow/processCompletions') {
  192 |         extra.value.recordId = id
  193 |         if (kind === 'overquantity') { extra.value.operationId=id; extra.value.quantities[0].quantity=1001 }
  194 |       } else {
  195 |         extra.value.recheckOrderId=id; extra.value.recheckOrderNo=id; extra.value.operationId=id
  196 |         if (kind === 'negative-recheck') extra.value.lines[0].expectedQty=-100
  197 |         else extra.value.lines[0].sku.skuId='FOREIGN'
  198 |       }
  199 |       try { await r.importPostFinishingBackup(new File([JSON.stringify({ ...backup, records: [...backup.records, extra] })], 'bad.json')); errors.push('UNEXPECTED_SUCCESS') }
  200 |       catch(e) { errors.push(String(e)) }
  201 |     }
  202 |     const actorErrors: string[] = []
  203 |     for (const field of ['responsible', 'recordedBy'] as const) {
  204 |       for (const variant of ['empty-name', 'whitespace-name', 'qc-role']) {
  205 |         const forged = structuredClone(backup)
  206 |         const completion = forged.records.find((row: any) => row.id === original.id)
  207 |         if (variant === 'qc-role') completion.value[field].roleName = '后道质检员'
  208 |         else completion.value[field].actorName = variant === 'empty-name' ? '' : '   '
  209 |         try { await r.importPostFinishingBackup(new File([JSON.stringify(forged)], `bad-${field}-${variant}.json`)); actorErrors.push('UNEXPECTED_SUCCESS') }
  210 |         catch(error) { actorErrors.push(`${field}:${variant}:${String(error)}`) }
  211 |       }
  212 |     }
  213 |     return { errors, actorErrors, unchanged: before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  214 |   }, namespace)
  215 |   expect(results.errors).toHaveLength(4)
  216 |   expect(results.errors).not.toContain('UNEXPECTED_SUCCESS')
  217 |   expect(results.actorErrors).toHaveLength(6)
  218 |   expect(results.actorErrors.every(error => error.includes('身份不完整'))).toBe(true)
  219 |   expect(results.unchanged).toBe(true)
  220 |   // Use a fresh target for each otherwise-valid full D1 backup. Changing an
  221 |   // existing target would only prove conflict rejection and hide a missing
  222 |   // candidate relationship/quantity validator.
  223 |   const relationResults: Array<{ kind: string; error: string; unchanged: boolean }> = []
  224 |   for (const kind of [
  225 |     'outbound-overquantity', 'duplicate-outbound-recheck', 'outbound-foreign-parent', 'outbound-foreign-sku',
  226 |     'outbound-foreign-delivery', 'outbound-foreign-qc', 'handover-overquantity', 'receipt-overquantity',
  227 |     'duplicate-receipt-outbound', 'correction-foreign-responsible', 'correction-foreign-original-sku',
  228 |   ]) {
  229 |     const isolated = await page.context().browser()!.newContext()
  230 |     try {
  231 |       const candidate = await isolated.newPage()
  232 |       await candidate.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
  233 |       await expect(candidate.locator('main h1')).toHaveText('后道加工单')
  234 |       relationResults.push(await candidate.evaluate(async ({ ns, rows, kind }) => {
  235 |         const r = await import('/src/data/fcs/post-finishing-records.ts')
  236 |         const db = await import('/src/data/pcs-record-db.ts')
  237 |         const forged = { format: ns, version: 2, records: structuredClone(rows), files: [] }
  238 |         const id = `INVALID-${kind}`
  239 |         if (kind.startsWith('correction-')) {
  240 |           const correction = forged.records.find((row: any) => row.collection === 'flow/processCompletions' && !row.deleted && row.value.correctionOf)!
  241 |           const original = forged.records.find((row: any) => row.collection === 'flow/processCompletions' && !row.deleted && row.value.recordId === correction.value.correctionOf)!
  242 |           if (kind === 'correction-foreign-responsible') correction.value.responsible = structuredClone(original.value.recordedBy)
  243 |           else {
  244 |             const parent = forged.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted && row.value.postTaskId === original.value.postTaskId)!
  245 |             const foreign = parent.value.lines.find((line: any) => !original.value.quantities.some((source: any) => source.skuId === line.sku.skuId))!
  246 |             // A zero delta keeps every aggregate unchanged but is outside the
  247 |             // original record's SKU set, which the live correction API rejects.
  248 |             correction.value.quantities.push({ skuId: foreign.sku.skuId, quantity: 0 })
  249 |           }
  250 |         } else {
  251 |           const out = forged.records.find((row: any) => row.collection === 'flow/outboundOrders' && !row.deleted && row.value.lines.some((line: any) => line.outboundQty === 800))!
  252 |           if (kind === 'outbound-overquantity') out.value.lines[0].outboundQty = 801
  253 |           else if (kind === 'duplicate-outbound-recheck') {
  254 |             const duplicate = structuredClone(out)
  255 |             duplicate.id = duplicate.id.replace(/[^/]+$/, id)
  256 |             duplicate.value.outboundOrderId = id
  257 |             duplicate.value.outboundOrderNo = id
  258 |             forged.records.push(duplicate)
  259 |           } else if (kind === 'outbound-foreign-parent') out.value.postTaskId = 'FOREIGN-POST'
  260 |           else if (kind === 'outbound-foreign-sku') out.value.lines[0].sku.skuId = 'FOREIGN-SKU'
  261 |           else if (kind === 'outbound-foreign-delivery') out.value.deliveryId = 'FOREIGN-DELIVERY'
  262 |           else if (kind === 'outbound-foreign-qc') out.value.qcTaskId = 'FOREIGN-QC'
  263 |           else if (kind === 'handover-overquantity') {
  264 |             const handover = forged.records.find((row: any) => row.collection === 'flow/waitHandoverWarehouseRecords' && !row.deleted && row.value.outboundOrderId === out.value.outboundOrderId)!
  265 |             handover.value.lines[0].inboundQty = 801
  266 |           } else {
  267 |             const receipt = forged.records.find((row: any) => row.collection === 'flow/warehouseReceipts' && !row.deleted && row.value.outboundOrderId === out.value.outboundOrderId)!
  268 |             if (kind === 'receipt-overquantity') receipt.value.lines[0].receivedQty = 801
  269 |             else {
  270 |               const duplicate = structuredClone(receipt)
  271 |               duplicate.id = duplicate.id.replace(/[^/]+$/, id)
  272 |               duplicate.value.receiptId = id
  273 |               forged.records.push(duplicate)
  274 |             }
  275 |           }
  276 |         }
  277 |         const before = JSON.stringify((await db.readPcsRecords([ns])).records)
  278 |         let error = 'UNEXPECTED_SUCCESS'
  279 |         try { await r.importPostFinishingBackup(new File([JSON.stringify(forged)], `bad-${kind}.json`)) }
  280 |         catch (failure) { error = String(failure) }
  281 |         return { kind, error, unchanged: before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  282 |       }, { ns: namespace, rows: kind.startsWith('correction-') ? actualCorrection.stored : actual.stored, kind }))
  283 |     } finally { await isolated.close() }
  284 |   }
  285 |   // Save the red/green evidence before assertions so a forged restore that was
  286 |   // accepted is retained as a real failure instead of lost at the first check.
  287 |   writeFileSync(`${evidence}/restore-adversarial.json`, JSON.stringify({ ...results, relationResults }, null, 2))
> 288 |   expect(relationResults.map(row => `${row.kind}:${row.error}`)).not.toEqual(expect.arrayContaining([expect.stringContaining('UNEXPECTED_SUCCESS')]))
      |                                                                      ^ Error: expect(received).not.toEqual(expected) // deep equality
  289 |   expect(relationResults.every(row => row.unchanged)).toBe(true)
  290 | })
  291 | 
```