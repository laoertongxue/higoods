# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wool-management-fact-workflow.spec.ts >> 混合片Q1回80与Q2回100时最多缝盘80，不能二次放大
- Location: tests/wool-management-fact-workflow.spec.ts:19:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-wool-dialog-field="qty"]')

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
            - generic [ref=e202]:
              - button "毛织管理" [ref=e203]:
                - img [ref=e205]
                - generic [ref=e207]: 毛织管理
                - img [ref=e208]
              - generic [ref=e210]:
                - button "毛织待接收" [ref=e211]:
                  - img [ref=e213]
                  - text: 毛织待接收
                - button "横机加工单" [ref=e218]:
                  - img [ref=e220]
                  - text: 横机加工单
                - button "缝盘加工单" [ref=e223]:
                  - img [ref=e225]
                  - text: 缝盘加工单
                - button "横机生产关联" [ref=e228]:
                  - img [ref=e230]
                  - text: 横机生产关联
                - button "横机设备" [ref=e233]:
                  - img [ref=e235]
                  - text: 横机设备
                - button "毛织待加工仓" [ref=e238]:
                  - img [ref=e240]
                  - text: 毛织待加工仓
                - button "毛织待交出仓" [ref=e243]:
                  - img [ref=e245]
                  - text: 毛织待交出仓
          - generic [ref=e250]:
            - button "辅料工厂管理" [expanded] [ref=e251]:
              - img [ref=e253]
              - generic [ref=e256]: 辅料工厂管理
              - img [ref=e257]
            - generic [ref=e259]:
              - button "花边厂管理" [ref=e261]:
                - generic [ref=e264]: 花边厂管理
                - img [ref=e265]
              - button "织带厂管理" [ref=e268]:
                - img [ref=e270]
                - generic [ref=e273]: 织带厂管理
                - img [ref=e274]
          - generic [ref=e276]:
            - button "后道工厂管理" [expanded] [ref=e277]:
              - img [ref=e279]
              - generic [ref=e284]: 后道工厂管理
              - img [ref=e285]
            - button "后道工厂管理" [ref=e289]:
              - img [ref=e291]
              - generic [ref=e296]: 后道工厂管理
              - img [ref=e297]
          - generic [ref=e299]:
            - button "辅助工艺工厂管理" [expanded] [ref=e300]:
              - img [ref=e302]
              - generic [ref=e304]: 辅助工艺工厂管理
              - img [ref=e305]
            - generic [ref=e307]:
              - button "打揽加工单" [ref=e309]:
                - img [ref=e311]
                - generic [ref=e313]: 打揽加工单
              - button "打条加工单" [ref=e315]:
                - img [ref=e317]
                - generic [ref=e319]: 打条加工单
              - button "烫画加工单" [ref=e321]:
                - img [ref=e323]
                - generic [ref=e325]: 烫画加工单
              - button "直喷加工单" [ref=e327]:
                - img [ref=e329]
                - generic [ref=e331]: 直喷加工单
              - button "布包扣加工单" [ref=e333]:
                - img [ref=e335]
                - generic [ref=e337]: 布包扣加工单
              - button "绣花加工单" [ref=e339]:
                - img [ref=e341]
                - generic [ref=e343]: 绣花加工单
              - button "压褶加工单" [ref=e345]:
                - img [ref=e347]
                - generic [ref=e349]: 压褶加工单
              - button "贝壳绣加工单" [ref=e351]:
                - img [ref=e353]
                - generic [ref=e355]: 贝壳绣加工单
              - button "曲牙绣加工单" [ref=e357]:
                - img [ref=e359]
                - generic [ref=e361]: 曲牙绣加工单
              - button "一字贝绣花加工单" [ref=e363]:
                - img [ref=e365]
                - generic [ref=e367]: 一字贝绣花加工单
              - button "盘扣加工单" [ref=e369]:
                - img [ref=e371]
                - generic [ref=e373]: 盘扣加工单
              - button "花朵加工单" [ref=e375]:
                - img [ref=e377]
                - generic [ref=e379]: 花朵加工单
              - button "打褶加工单" [ref=e381]:
                - img [ref=e383]
                - generic [ref=e385]: 打褶加工单
              - button "烫钻加工单" [ref=e387]:
                - img [ref=e389]
                - generic [ref=e391]: 烫钻加工单
              - button "辅助工艺待加工仓" [ref=e393]:
                - img [ref=e395]
                - generic [ref=e398]: 辅助工艺待加工仓
              - button "辅助工艺待交出仓" [ref=e400]:
                - img [ref=e402]
                - generic [ref=e407]: 辅助工艺待交出仓
          - generic [ref=e408]:
            - button "特种工艺工厂管理" [expanded] [ref=e409]:
              - img [ref=e411]
              - generic [ref=e413]: 特种工艺工厂管理
              - img [ref=e414]
            - generic [ref=e416]:
              - button "模板工序加工单" [ref=e418]:
                - img [ref=e420]
                - generic [ref=e422]: 模板工序加工单
              - button "激光开袋加工单" [ref=e424]:
                - img [ref=e426]
                - generic [ref=e428]: 激光开袋加工单
              - button "特种车缝（花样机）加工单" [ref=e430]:
                - img [ref=e432]
                - generic [ref=e434]: 特种车缝（花样机）加工单
              - button "橡筋定长切割加工单" [ref=e436]:
                - img [ref=e438]
                - generic [ref=e440]: 橡筋定长切割加工单
              - button "特种工艺待加工仓" [ref=e442]:
                - img [ref=e444]
                - generic [ref=e447]: 特种工艺待加工仓
              - button "特种工艺待交出仓" [ref=e449]:
                - img [ref=e451]
                - generic [ref=e456]: 特种工艺待交出仓
    - main [ref=e457]:
      - generic [ref=e459]:
        - generic [ref=e461]:
          - button "缝盘加工单" [ref=e462]
          - button [ref=e463]:
            - img [ref=e464]
        - button "全部关闭" [ref=e469]
      - generic [ref=e473]:
        - heading "缝盘加工单" [level=1] [ref=e475]
        - generic [ref=e478]:
          - generic [ref=e479]:
            - generic [ref=e480]:
              - generic [ref=e481]: 加工单号 / 任务号 / 款号 / 款名 / 内部货号
              - textbox "加工单号 / 任务号 / 款号 / 款名 / 内部货号" [ref=e482]:
                - /placeholder: 输入关键字
                - text: FP260918-010
            - generic [ref=e483]:
              - generic [ref=e484]: 承接工厂
              - textbox "承接工厂" [ref=e485]:
                - /placeholder: 输入工厂名称
            - generic [ref=e486]:
              - generic [ref=e487]: 类型
              - combobox "类型" [ref=e488]:
                - option "全部类型" [selected]
                - option "整件毛织"
                - option "部位毛织"
            - generic [ref=e489]:
              - generic [ref=e490]: 加工状态
              - combobox "加工状态" [ref=e491]:
                - option "全部状态" [selected]
                - option "未加工"
                - option "待开工"
                - option "加工中"
                - option "加工完成"
                - option "已完成"
          - generic [ref=e492]:
            - button "查询" [ref=e493]:
              - img [ref=e494]
              - text: 查询
            - button "重置" [ref=e497]:
              - img [ref=e498]
              - text: 重置
            - button "导出" [ref=e501]:
              - img [ref=e502]
              - text: 导出
          - group [ref=e505]:
            - generic "更多筛选" [ref=e506] [cursor=pointer]
            - option "全部" [selected]
            - option "需要外加工"
            - option "无外加工"
            - option "全部" [selected]
            - option "尚未接收"
            - option "已部分接收"
            - option "回货可支撑计划数量"
            - option "单据创建"
            - option "计划开始"
            - option "计划完成" [selected]
            - option "最近加工"
            - option "最近接收"
            - option "最近交出"
        - tablist [ref=e508]:
          - generic [ref=e509]:
            - button "全部加工单 1" [ref=e510]:
              - text: 全部加工单
              - generic [ref=e511]: "1"
            - button "未加工 0" [ref=e512]:
              - text: 未加工
              - generic [ref=e513]: "0"
            - button "待开工 1" [ref=e514]:
              - text: 待开工
              - generic [ref=e515]: "1"
            - button "加工中 0" [ref=e516]:
              - text: 加工中
              - generic [ref=e517]: "0"
            - button "加工完成 0" [ref=e518]:
              - text: 加工完成
              - generic [ref=e519]: "0"
            - button "已完成 0" [ref=e520]:
              - text: 已完成
              - generic [ref=e521]: "0"
        - generic [ref=e522]:
          - generic [ref=e523]:
            - heading "缝盘加工单" [level=2] [ref=e524]
            - generic [ref=e525]: 共 1 条
            - button "列设置" [ref=e526]:
              - img [ref=e527]
              - text: 列设置
          - table [ref=e533]:
            - rowgroup [ref=e543]:
              - row "按加工单／商品与需求来源升序排列 加工投入／上游 加工要求 按处理进度升序排列 加工产出／下游 按时间升序排列 按数量升序排列 操作" [ref=e544]:
                - columnheader "按加工单／商品与需求来源升序排列" [ref=e545]:
                  - button "按加工单／商品与需求来源升序排列" [ref=e546]:
                    - generic [ref=e547]: 加工单／商品与需求来源
                    - img [ref=e549]
                - columnheader "加工投入／上游" [ref=e552]
                - columnheader "加工要求" [ref=e553]
                - columnheader "按处理进度升序排列" [ref=e554]:
                  - button "按处理进度升序排列" [ref=e555]:
                    - generic [ref=e556]: 处理进度
                    - img [ref=e558]
                - columnheader "加工产出／下游" [ref=e561]
                - columnheader "按时间升序排列" [ref=e562]:
                  - button "按时间升序排列" [ref=e563]:
                    - generic [ref=e564]: 时间
                    - img [ref=e566]
                - columnheader "按数量升序排列" [ref=e569]:
                  - button "按数量升序排列" [ref=e570]:
                    - generic [ref=e571]: 数量
                    - img [ref=e573]
                - columnheader "操作" [ref=e576]
            - rowgroup [ref=e577]:
              - row "FP260918-010配对 HJ260918-010 查看CARDIGAN-CREAM 款式图大图 奶油色针织开衫 CARDIGAN-CREAM 内部款号 MZ2609 部位毛织 · 周哥毛织厂 演示需求 DEMO-MZ-260918-010 部位多厂／部分回货可缝盘 PO-MZ-010 · TK-MZ-010 不外发片 内部进度：对应 100 件 来源：HJ260918-010 外加工片 片：Q / 第1片 / CARDIGAN-CREAM-M 末工艺厂：全能力测试工厂 实际回货：80 片 片：Q / 第2片 / CARDIGAN-CREAM-M 末工艺厂：全能力测试工厂 实际回货：100 片 绑定技术包 演示冻结版本：v1.0 查看本单冻结资料及片路线 SKU 计划 奶油色 / M：100 件 工艺要求 Q / 第1片：绣花 → 曲牙绣 Q / 第2片：曲牙绣 待开工 当前可人工缝盘：1/1 个 SKU CARDIGAN-CREAM-M：已加工 0 件；还可填报 80 件 实际交出批次：0 笔 直接下游确认：0/0 笔；差异 0 笔 产出：缝盘后毛织部件 最终下游：裁床待交出仓 单据创建：2026-09-18 08:00:00 上游接收：最近 2026-09-18 12:00:00 · 3 笔 加工生产：尚未填报 下游交出：尚未交出 查看完整时间明细 需求计划：100 件 累计加工：0 件 当前可人工缝盘：80 件 待最终交出：0 件 外加工片实收：180 片 下游实际接收：0 件 已交出：尚未交出 查看详情 确认外加工片回货 加工填报" [ref=e578]:
                - cell "FP260918-010配对 HJ260918-010 查看CARDIGAN-CREAM 款式图大图 奶油色针织开衫 CARDIGAN-CREAM 内部款号 MZ2609 部位毛织 · 周哥毛织厂 演示需求 DEMO-MZ-260918-010 部位多厂／部分回货可缝盘 PO-MZ-010 · TK-MZ-010" [ref=e579]:
                  - generic [ref=e580]:
                    - generic [ref=e581]:
                      - link "FP260918-010" [ref=e582] [cursor=pointer]:
                        - /url: /fcs/craft/wool/linking-orders/WOOL-STAGE-010%3ALINKING
                      - link "配对 HJ260918-010" [ref=e583] [cursor=pointer]:
                        - /url: /fcs/craft/wool/knitting-orders/WOOL-STAGE-010%3AKNITTING
                    - generic [ref=e584]:
                      - button "查看CARDIGAN-CREAM 款式图大图" [ref=e585]:
                        - img "CARDIGAN-CREAM 款式图" [ref=e586]
                      - generic [ref=e587]:
                        - generic [ref=e588]: 奶油色针织开衫
                        - generic [ref=e589]: CARDIGAN-CREAM
                        - generic [ref=e590]: 内部款号 MZ2609
                    - generic [ref=e591]:
                      - generic [ref=e592]: 部位毛织
                      - text: · 周哥毛织厂
                    - generic [ref=e593]: 演示需求 DEMO-MZ-260918-010
                    - generic [ref=e594]: 部位多厂／部分回货可缝盘
                    - generic [ref=e595]: PO-MZ-010 · TK-MZ-010
                - cell "不外发片 内部进度：对应 100 件 来源：HJ260918-010 外加工片 片：Q / 第1片 / CARDIGAN-CREAM-M 末工艺厂：全能力测试工厂 实际回货：80 片 片：Q / 第2片 / CARDIGAN-CREAM-M 末工艺厂：全能力测试工厂 实际回货：100 片" [ref=e596]:
                  - generic [ref=e597]:
                    - generic [ref=e598]:
                      - generic [ref=e599]: 不外发片
                      - generic [ref=e600]: 内部进度：对应 100 件
                      - generic [ref=e601]: 来源：HJ260918-010
                    - generic [ref=e602]:
                      - generic [ref=e603]: 外加工片
                      - generic [ref=e604]:
                        - generic [ref=e605]: 片：Q / 第1片 / CARDIGAN-CREAM-M
                        - generic [ref=e606]: 末工艺厂：全能力测试工厂
                        - generic [ref=e607]: 实际回货：80 片
                      - generic [ref=e608]:
                        - generic [ref=e609]: 片：Q / 第2片 / CARDIGAN-CREAM-M
                        - generic [ref=e610]: 末工艺厂：全能力测试工厂
                        - generic [ref=e611]: 实际回货：100 片
                - cell "绑定技术包 演示冻结版本：v1.0 查看本单冻结资料及片路线 SKU 计划 奶油色 / M：100 件 工艺要求 Q / 第1片：绣花 → 曲牙绣 Q / 第2片：曲牙绣" [ref=e612]:
                  - generic [ref=e613]:
                    - generic [ref=e614]:
                      - generic [ref=e615]: 绑定技术包
                      - generic [ref=e616]: 演示冻结版本：v1.0
                      - link "查看本单冻结资料及片路线" [ref=e617] [cursor=pointer]:
                        - /url: /fcs/craft/wool/linking-orders/WOOL-STAGE-010%3ALINKING
                    - generic [ref=e618]:
                      - generic [ref=e619]: SKU 计划
                      - generic [ref=e620]: 奶油色 / M：100 件
                    - generic [ref=e621]:
                      - generic [ref=e622]: 工艺要求
                      - generic [ref=e624]: Q / 第1片：绣花 → 曲牙绣
                      - generic [ref=e626]: Q / 第2片：曲牙绣
                - cell "待开工 当前可人工缝盘：1/1 个 SKU CARDIGAN-CREAM-M：已加工 0 件；还可填报 80 件 实际交出批次：0 笔 直接下游确认：0/0 笔；差异 0 笔" [ref=e627]:
                  - generic [ref=e628]:
                    - generic [ref=e629]: 待开工
                    - generic [ref=e630]: 当前可人工缝盘：1/1 个 SKU
                    - generic [ref=e631]: CARDIGAN-CREAM-M：已加工 0 件；还可填报 80 件
                    - generic [ref=e632]: 实际交出批次：0 笔
                    - generic [ref=e633]: 直接下游确认：0/0 笔；差异 0 笔
                - cell "产出：缝盘后毛织部件 最终下游：裁床待交出仓" [ref=e634]:
                  - generic [ref=e635]:
                    - generic [ref=e636]: 产出：缝盘后毛织部件
                    - generic [ref=e637]: 最终下游：裁床待交出仓
                - cell "单据创建：2026-09-18 08:00:00 上游接收：最近 2026-09-18 12:00:00 · 3 笔 加工生产：尚未填报 下游交出：尚未交出 查看完整时间明细" [ref=e638]:
                  - generic [ref=e639]:
                    - generic [ref=e640]: 单据创建：2026-09-18 08:00:00
                    - generic [ref=e641]: 上游接收：最近 2026-09-18 12:00:00 · 3 笔
                    - generic [ref=e642]: 加工生产：尚未填报
                    - generic [ref=e643]: 下游交出：尚未交出
                    - link "查看完整时间明细" [ref=e644] [cursor=pointer]:
                      - /url: /fcs/craft/wool/linking-orders/WOOL-STAGE-010%3ALINKING
                - cell "需求计划：100 件 累计加工：0 件 当前可人工缝盘：80 件 待最终交出：0 件 外加工片实收：180 片 下游实际接收：0 件 已交出：尚未交出" [ref=e645]:
                  - generic [ref=e646]:
                    - generic [ref=e647]: 需求计划：100 件
                    - generic [ref=e648]: 累计加工：0 件
                    - generic [ref=e649]: 当前可人工缝盘：80 件
                    - generic [ref=e650]: 待最终交出：0 件
                    - generic [ref=e651]: 外加工片实收：180 片
                    - generic [ref=e652]: 下游实际接收：0 件
                    - generic [ref=e653]: 已交出：尚未交出
                - cell "查看详情 确认外加工片回货 加工填报" [ref=e654]:
                  - generic [ref=e655]:
                    - button "查看详情" [ref=e656]
                    - button "确认外加工片回货" [ref=e657]
                    - button "加工填报" [ref=e658]
          - generic [ref=e661]:
            - paragraph [ref=e662]: 共 1 条，当前 1-1
            - generic [ref=e663]:
              - combobox [ref=e664]:
                - option "10 条/页" [selected]
                - option "20 条/页"
                - option "50 条/页"
              - button "上一页" [disabled] [ref=e665]
              - generic [ref=e666]: 1 / 1
              - button "下一页" [disabled] [ref=e667]
  - button "查生产" [ref=e668]:
    - img [ref=e669]
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test'
  2   | // Functional UI regression. Full cold/refresh/action performance is measured separately.
  3   | const root='[data-wool-work-orders-root]', storeKey='higood-fcs-wool-stage-store-v3'
  4   | const action=(name:string,id?:string)=>`[data-wool-work-orders-action="${name}"]${id?`[data-wool-order-id="${id}"]`:''}`
  5   | async function open(page:Page,stage='knitting'){await page.goto(`/fcs/craft/wool/${stage}-orders`);await expect(page.locator(root)).toBeVisible()}
  6   | async function facts(page:Page){return page.evaluate(async()=>{const modulePath='/src/data/fcs/wool-domain/store.ts';const {readWoolStore}=await import(/* @vite-ignore */ modulePath);return readWoolStore()})}
  7   | async function stageTotal(page:Page,stage='knitting'){return page.evaluate(async stage=>{const modulePath='/src/data/fcs/wool-domain/queries.ts';const domain=await import(/* @vite-ignore */ modulePath);return domain.listWoolWorkOrders({stage:stage==='knitting'?'KNITTING':'LINKING'}).length},stage)}
> 8   | async function report(page:Page,id:string,qty:number){const order=(await facts(page)).workOrders[id];await page.locator('[data-wool-work-orders-field="keyword"]').fill(order.woolOrderNo);await page.locator(action('query')).click();await expect(page.locator('[data-wool-work-orders-table-surface] tbody tr')).toHaveCount(1);await page.locator(action('open-report',id)).click();await page.locator('[data-wool-dialog-field="qty"]').fill(String(qty));await page.locator(action('save-report')).click()}
      |                                                                                                                                                                                                                                                                                                                                                                                                                                              ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  9   | async function receive(page:Page,id:string,qty:number,piece=false){await page.goto(`/fcs/craft/wool/pending-receipts?workOrderId=${encodeURIComponent(id)}`);await page.locator('[data-wool-receiving-action="receive"]').first().click();if(piece)await page.locator('[data-wool-receiving-field="pieceQty"]').fill(String(qty));else {await page.locator('[data-wool-receiving-field="pcs"]').fill('1');await page.locator('[data-wool-receiving-field="grossKg"]').fill(String(qty+.062));await page.locator('[data-wool-receiving-field="PAPER"]').fill('1')}await page.locator('[data-wool-receiving-action="review"]').click();await page.locator('[data-wool-receiving-action="save"]').click();await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')}
  10  | 
  11  | test('两阶段保留六状态、八列、分页与路由独立筛选',async({page})=>{for(const stage of ['knitting','linking']){await open(page,stage);const initialTotal=await stageTotal(page,stage);await expect(page.locator('[data-wool-work-orders-action^="tab:"]')).toHaveCount(6);for(const title of ['加工投入','加工要求','加工产出','时间','数量'])await expect(page.locator('th').filter({hasText:title}).first()).toBeVisible();await page.locator('[data-wool-work-orders-field="keyword"]').fill('不存在的单据');await page.locator(action('query')).click();await expect(page.locator('[data-wool-work-orders-table-surface]')).toContainText('暂无');await page.locator(action('reset-filters')).click();await expect(page.locator('[data-wool-work-orders-total]')).toHaveText(`共 ${initialTotal} 条`)}})
  12  | 
  13  | test('缺纱线不能填报，统一实收1kg后对应横机可开工',async({page})=>{await open(page);await expect(page.locator(action('open-report','WOOL-STAGE-001:KNITTING'))).toHaveCount(0);await receive(page,'WOOL-STAGE-001:KNITTING',1);await open(page);await expect(page.locator(action('open-report','WOOL-STAGE-001:KNITTING'))).toBeVisible()})
  14  | 
  15  | test('无外加工填报一次保存四事实，缝盘没有重复手工填报或横机设备',async({page})=>{await open(page);await report(page,'WOOL-STAGE-002:KNITTING',5);await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0);const s=await facts(page);expect(s.processReports.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-002:LINKING').reduce((n:number,r:any)=>n+r.reportedQty,0)).toBe(5);expect(s.internalReceipts.find((r:any)=>r.woolOrderId==='WOOL-STAGE-002:LINKING').qty).toBe(5);expect(s.handovers.some((r:any)=>r.woolOrderId==='WOOL-STAGE-002:KNITTING'&&r.automatic&&r.handoverQty===5)).toBe(true);await open(page,'linking');await expect(page.locator(action('open-report','WOOL-STAGE-002:LINKING'))).toHaveCount(0);await expect(page.locator(root)).not.toContainText('关联横机设备')})
  16  | 
  17  | test('横机150%超量保存被阻断且无任何事实增量',async({page})=>{await open(page);const before=await facts(page);await report(page,'WOOL-STAGE-002:KNITTING',151);await expect(page.locator('[data-wool-overlay-error]')).toContainText(/超过|上限|最多/);expect(await facts(page)).toEqual(before)})
  18  | 
  19  | test('混合片Q1回80与Q2回100时最多缝盘80，不能二次放大',async({page})=>{await open(page,'linking');await report(page,'WOOL-STAGE-010:LINKING',81);await expect(page.locator('[data-wool-overlay-error]')).toContainText(/超过|上限|可用|最多/);await page.locator('[data-wool-dialog-field="qty"]').fill('50');await page.locator(action('save-report')).click();await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0);const s=await facts(page);expect(s.processReports.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-010:LINKING').reduce((n:number,r:any)=>n+r.reportedQty,0)).toBe(50)})
  20  | 
  21  | test('横机仅交出选中外发片，固定首工艺厂并生成待接收来源',async({page})=>{await open(page);await page.locator(action('open-handover','WOOL-STAGE-008:KNITTING')).click();await expect(page.locator('[data-wool-business-dialog]')).toContainText('首工艺');await page.locator('[data-wool-dialog-field="qty"]').fill('5');await page.locator(action('save-handover')).click();await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0);const h=(await facts(page)).handovers.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-008:KNITTING'&&!r.automatic);expect(h).toHaveLength(1);expect(h[0]).toMatchObject({handoverQty:5,qtyUnit:'片',receiverId:'FAC-APF'});expect(h[0].downstreamReceipt.status).toBe('PENDING')})
  22  | 
  23  | test('最终工艺回货按片实收，刷新后仍保留同一记录',async({page})=>{await receive(page,'WOOL-STAGE-010:LINKING',5,true);const before=(await facts(page)).pieceReceipts.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-010:LINKING');await page.reload();await expect(page.locator('[data-wool-receiving-page]')).toBeVisible();expect((await facts(page)).pieceReceipts.filter((r:any)=>r.woolOrderId==='WOOL-STAGE-010:LINKING')).toEqual(before);expect(before.some((r:any)=>r.qty===5)).toBe(true)})
  24  | 
  25  | test('实收备料分配到横机，同一receipt保留且余量变化',async({page})=>{await page.goto('/fcs/craft/wool/pending-receipts?view=stock');await page.locator('[data-wool-stock-action="allocate"]').first().click();await page.locator('[data-wool-stock-field="target"]').selectOption('WOOL-STAGE-001:KNITTING');await page.locator('[data-wool-stock-field="qty"]').fill('2');await page.locator('[data-wool-stock-action="review"]').click();await page.locator('[data-wool-stock-action="save"]').click();await expect(page.locator('[data-wool-stock-feedback]')).toContainText(/已|成功/);await expect(page.locator('[data-wool-stock-table]')).toContainText('8 kg');await open(page);await expect(page.locator(action('open-report','WOOL-STAGE-001:KNITTING'))).toBeVisible()})
  26  | 
  27  | test('阶段错配详情和打印地址被拒绝',async({page})=>{for(const tail of ['', '/handover-print']){await page.goto('/fcs/craft/wool/linking-orders/WOOL-STAGE-008%3AKNITTING'+tail);await expect(page.getByText(/阶段|不存在|未找到/).first()).toBeVisible();await expect(page.locator('[data-wool-detail-root],[data-wool-handover-print-root]')).toHaveCount(0)}})
  28  | 
  29  | test('真实片交出打印必须等款式图及QR就绪；内部自动交出不打印',async({page})=>{await page.goto('/fcs/craft/wool/knitting-orders/WOOL-STAGE-009%3AKNITTING/handover-print');await expect(page.locator('[data-wool-handover-print-page]')).toHaveCount(2);await expect(page.locator('[data-wool-print-button]')).toBeEnabled();expect(await page.locator('[data-real-qr] svg').count()).toBe(2);await page.goto('/fcs/craft/wool/knitting-orders/WOOL-STAGE-004%3AKNITTING/handover-print');await expect(page.locator('[data-wool-handover-print-root]')).toContainText('内部自动衔接不生成外发纸单');await expect(page.locator('[data-wool-print-button]')).toBeDisabled()})
  30  | 
  31  | test('1280视口列表无主体横溢，操作与数量输入保持根节点',async({page})=>{await page.setViewportSize({width:1280,height:720});await open(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const initial=await page.locator(root).elementHandle();await page.locator(action('open-report','WOOL-STAGE-002:KNITTING')).click();await page.locator('[data-wool-dialog-field="qty"]').fill('2');expect(await initial!.evaluate(node=>node.isConnected)).toBe(true);await page.locator(action('close-overlay')).first().click();expect(await initial!.evaluate(node=>node.isConnected)).toBe(true)})
  32  | 
  33  | test('片工艺真实页面加工交出后下一厂才有待接收，实收前不虚增',async({page})=>{
  34  |  await open(page)
  35  |  const steps=await page.evaluate(async()=>{const cm='/src/data/fcs/wool-domain/craft-flow.ts',sm='/src/data/fcs/special-craft-operations.ts';const c=await import(/* @vite-ignore */cm),s=await import(/* @vite-ignore */sm);const tasks=c.listWoolCraftTaskOrders().filter((t:any)=>t.woolOrderId==='WOOL-STAGE-009:KNITTING');const first=tasks.find((t:any)=>t.receivedQty>0&&t.completedQty===0);const next=tasks.find((t:any)=>t.woolPieceKey===first.woolPieceKey&&t.taskOrderId!==first.taskOrderId);return [first,next].map((t:any)=>({id:t.taskOrderId,path:s.buildSpecialCraftTaskDetailPath(t,t.taskOrderId)}))})
  36  |  await page.goto(steps[0].path);await expect(page.locator('[data-wool-craft-detail]')).toBeVisible()
  37  |  for(const code of ['SPECIAL_CRAFT_PROCESS_REPORT','SPECIAL_CRAFT_SUBMIT_HANDOVER']){await page.locator(`[data-action-code="${code}"]`).click();await page.getByRole('spinbutton',{name:'本次数量（片）'}).fill('5');await page.locator('[data-wool-craft-save]').click();await expect(page.locator('#wool-craft-dialog')).toHaveCount(0)}
  38  |  await page.goto(steps[1].path);await expect(page.locator('[data-wool-craft-detail]')).toContainText('实际接收0 片')
  39  |  await page.locator('[data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click();await page.locator('[data-wool-receiving-action="receive"]').first().click();await page.locator('[data-wool-receiving-field="pieceQty"]').fill('5');await page.locator('[data-wool-receiving-action="review"]').click();await page.locator('[data-wool-receiving-action="save"]').click();await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')
  40  |  await page.goto(steps[1].path);await expect(page.locator('[data-wool-craft-detail]')).toContainText('实际接收5 片')
  41  | })
  42  | 
  43  | test('整件缝盘最终交出按真实批次在后续成衣工艺接收，未选批次仍待接收',async({page})=>{
  44  |  await open(page)
  45  |  const scenario=await page.evaluate(async()=>{const f=await import('/scripts/fixtures/wool-final-downstream-review.ts');const scene=await f.prepareWoolFinalDownstreamReviewScenario();const {appStore}=await import('/src/state/store.ts');appStore.navigate(scene.route);return scene})
  46  |  await page.reload()
  47  |  await expect(page.locator('[data-wool-final-craft-content]')).toBeVisible()
  48  |  await page.locator('[data-special-craft-web-action][data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click()
  49  |  const dialog=page.locator('#wool-final-receipt-dialog')
  50  |  await expect(dialog).toContainText('12 件')
  51  |  await dialog.locator(`[data-wool-final-select="${scenario.handovers[0].handoverId}"]`).check()
  52  |  await dialog.locator('[data-wool-final-action="receive"]').click()
  53  |  await expect(dialog).toHaveCount(0)
  54  |  await page.reload();await expect(page.locator('[data-wool-final-craft-content]')).toBeVisible()
  55  |  const actual=await page.evaluate(async({taskId,woolOrderId})=>{const craft=await import('/src/data/fcs/special-craft-task-orders.ts');const wool=await import('/src/data/fcs/wool-domain/store.ts');const task=craft.getSpecialCraftTaskOrderById(taskId);return{received:task.receivedQty,handovers:wool.readWoolStore().handovers.filter((h:any)=>h.woolOrderId===woolOrderId)}},scenario)
  56  |  expect(actual.received).toBe(12)
  57  |  expect(actual.handovers.find((h:any)=>h.handoverId===scenario.handovers[0].handoverId).downstreamReceipt.actualReceivedQty).toBe(12)
  58  |  expect(actual.handovers.find((h:any)=>h.handoverId===scenario.handovers[1].handoverId).downstreamReceipt.status).toBe('PENDING')
  59  |  await page.locator('[data-special-craft-web-action][data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click()
  60  |  await expect(dialog.locator('[data-wool-final-select]')).toHaveCount(1)
  61  |  await page.keyboard.press('Escape')
  62  |  await expect(dialog).toHaveCount(0)
  63  | })
  64  | 
  65  | test('管理端款式与纱线大图可按钮遮罩及Esc关闭，图片失败明确反馈',async({page})=>{
  66  |  test.setTimeout(90000)
  67  |  for(const route of ['/fcs/craft/wool/knitting-orders','/fcs/craft/wool/linking-orders','/fcs/craft/wool/knitting-orders/WOOL-STAGE-008%3AKNITTING','/fcs/craft/wool/linking-orders/WOOL-STAGE-010%3ALINKING','/fcs/craft/wool/pending-receipts','/fcs/craft/wool/pending-receipts?view=stock']){
  68  |   await page.goto(route)
  69  |   const opener=page.locator('[data-pda-image-preview-url]').first()
  70  |   await expect(opener).toBeVisible()
  71  |   await opener.locator('img').evaluate((img:HTMLImageElement)=>img.decode())
  72  |   for(const close of ['button','backdrop','escape']){
  73  |    await opener.click()
  74  |    const host=page.locator('[data-pda-image-preview-root]')
  75  |    await expect(host.getByRole('dialog')).toBeVisible()
  76  |    await host.locator('img').evaluate((img:HTMLImageElement)=>img.decode())
  77  |    if(close==='escape')await page.keyboard.press('Escape')
  78  |    else if(close==='backdrop')await host.locator('[aria-label="关闭大图预览"]').click({position:{x:3,y:3}})
  79  |    else await host.getByRole('button',{name:'关闭',exact:true}).click()
  80  |    await expect(host).toHaveCount(0)
  81  |   }
  82  |  }
  83  |  await page.route('**/cardigan-sample.jpg',route=>route.abort())
  84  |  await page.goto('/fcs/craft/wool/knitting-orders')
  85  |  await expect(page.locator('[data-pda-image-preview-url="/cardigan-sample.jpg"]').first()).toContainText('图片加载失败')
  86  | })
  87  | 
  88  | test('毛织PDA接收与仓储在两种小屏下无横溢且真实图片可读',async({page})=>{
  89  |  test.setTimeout(90000)
  90  |  await page.addInitScript(()=>localStorage.setItem('fcs_pda_session',JSON.stringify({userId:'OWN_WOOL_FACTORY_operator',loginId:'OWN_WOOL_FACTORY_operator',userName:'周哥毛织厂_操作工',roleId:'ROLE_OPERATOR',factoryId:'OWN_WOOL_FACTORY',factoryName:'周哥毛织厂',loggedAt:'2026-09-18 10:00:00'})))
  91  |  for(const viewport of [{width:360,height:800},{width:400,height:806}]){
  92  |   await page.setViewportSize(viewport)
  93  |   for(const route of ['/fcs/pda/wool/pending-receipts?workOrderId=WOOL-STAGE-001%3AKNITTING','/fcs/pda/wool/pending-receipts?workOrderId=WOOL-STAGE-010%3ALINKING','/fcs/pda/warehouse/inbound-records','/fcs/pda/warehouse/outbound-records']){
  94  |    await page.goto(route)
  95  |    await expect(page.locator('[data-wool-receiving-page],[data-wool-pda-warehouse-flows]')).toBeVisible()
  96  |    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  97  |    const image=page.locator('[data-pda-image-preview-url]').first()
  98  |    if(await image.count()){await image.click();await page.locator('[data-pda-image-preview-root] img').evaluate((img:HTMLImageElement)=>img.decode());await page.keyboard.press('Escape');await expect(page.locator('[data-pda-image-preview-root]')).toHaveCount(0)}
  99  |   }
  100 |  }
  101 | })
  102 | 
  103 | test('导出全部匹配行而非当前页，无操作列且空结果有明确反馈',async({page})=>{
  104 |  await open(page)
  105 |  await expect(page.locator('[data-wool-work-orders-table-surface] tbody tr')).toHaveCount(10)
  106 |  const download=page.waitForEvent('download');await page.locator(action('export')).click()
  107 |  const file=await download;const stream=(await file.createReadStream())!;const chunks=[];for await(const chunk of stream)chunks.push(chunk)
  108 |  const csv=Buffer.concat(chunks).toString('utf8')
```