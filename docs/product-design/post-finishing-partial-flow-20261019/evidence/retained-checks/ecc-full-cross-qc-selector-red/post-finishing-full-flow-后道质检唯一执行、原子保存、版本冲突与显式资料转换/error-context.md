# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> 后道质检唯一执行、原子保存、版本冲突与显式资料转换
- Location: tests/post-finishing-full-flow.spec.ts:894:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "passed"
Received: "failed"
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
      - generic [ref=e493]:
        - generic [ref=e494]:
          - generic [ref=e495]:
            - heading "执行质检" [level=1] [ref=e496]
            - paragraph [ref=e497]: 每人同时执行一张质检单；完成后再领取下一张
          - generic [ref=e498]:
            - generic [ref=e499]: 打印质检单
            - generic [ref=e500]: 打印质检单详情
        - generic [ref=e501]:
          - generic [ref=e503]:
            - generic [ref=e504]:
              - text: ← 质检清单
              - heading "PO-QC-202608-001-4-ZJ" [level=2] [ref=e505]
              - paragraph [ref=e506]: PO-QC-202608-001-4 · PO-QC-202608-001 · 第 4 次回货
              - generic [ref=e507]:
                - generic [ref=e508]: 仅车缝
                - generic [ref=e509]: 后道工厂负责
              - paragraph [ref=e510]: 送货登记：2026/8/25 13:00:00 · 质检单生成：2026/8/25 13:10:00 · 送检：2026/8/25 13:20:00
            - generic [ref=e511]:
              - generic [ref=e512]: 质检中
              - generic [ref=e513]:
                - text: 质检员：李质检员
                - text: 领取：2026/8/25 13:30:00
          - generic [ref=e514]:
            - generic [ref=e515]:
              - generic [ref=e516]:
                - heading "逐 SKU 质检结果" [level=3] [ref=e517]
                - paragraph [ref=e518]: 合格 + 瑕疵 + 返工应等于送检数；瑕疵数量由各原因自动汇总，数量存在差异时必须授权。
              - generic [ref=e519]: 送检 100 件 · 当前分类合计 100 件 · 整单差异 0 件 · 0 个 SKU 有差异
              - generic [ref=e520]:
                - article [ref=e521]:
                  - generic [ref=e522]:
                    - button "后道验收衬衫 黑色 S" [ref=e523]:
                      - img "后道验收衬衫 黑色 S" [ref=e524]
                    - generic [ref=e525]:
                      - generic [ref=e526]: SPU-QC-001-01
                      - generic [ref=e527]: SPU-QC-001 · 黑色 / S · 送检 20 件
                  - generic [ref=e528]:
                    - generic [ref=e529]:
                      - heading "质检与返工" [level=4] [ref=e530]
                      - generic [ref=e531]:
                        - generic [ref=e532]:
                          - text: 待质检数量
                          - textbox "待质检数量" [disabled] [ref=e533]: 20 件
                        - generic [ref=e534]:
                          - text: 合格数量
                          - spinbutton "合格数量" [ref=e535]: "20"
                        - generic [ref=e536]:
                          - text: 返工数量
                          - spinbutton "返工数量" [ref=e537]: "0"
                    - generic [ref=e538]:
                      - generic [ref=e539]:
                        - generic [ref=e540]:
                          - heading "瑕疵" [level=4] [ref=e541]
                          - paragraph [ref=e542]: 分别填写各瑕疵原因数量，瑕疵数量由系统自动汇总。
                        - generic [ref=e543]:
                          - text: 瑕疵数量
                          - spinbutton "瑕疵数量" [ref=e544]: "0"
                      - generic [ref=e545]:
                        - generic [ref=e546]:
                          - text: 做工原因
                          - spinbutton "做工原因" [ref=e547]: "0"
                        - generic [ref=e548]:
                          - text: 脏污
                          - spinbutton "脏污" [ref=e549]: "0"
                        - generic [ref=e550]:
                          - text: 抽纱
                          - spinbutton "抽纱" [ref=e551]: "0"
                        - generic [ref=e552]:
                          - text: 做错
                          - spinbutton "做错" [ref=e553]: "0"
                        - generic [ref=e554]:
                          - text: 布料原因
                          - spinbutton "布料原因" [ref=e555]: "0"
                        - generic [ref=e556]:
                          - text: 缺辅料
                          - spinbutton "缺辅料" [ref=e557]: "0"
                        - generic [ref=e558]:
                          - text: 做毁
                          - spinbutton "做毁" [ref=e559]: "0"
                        - generic [ref=e560]:
                          - text: 印花
                          - spinbutton "印花" [ref=e561]: "0"
                        - generic [ref=e562]:
                          - text: 色差
                          - spinbutton "色差" [ref=e563]: "0"
                        - generic [ref=e564]:
                          - text: 半套
                          - spinbutton "半套" [ref=e565]: "0"
                        - generic [ref=e566]:
                          - text: 破洞
                          - spinbutton "破洞" [ref=e567]: "0"
                        - generic [ref=e568]:
                          - text: 缺辅料不补
                          - spinbutton "缺辅料不补" [ref=e569]: "0"
                - article [ref=e570]:
                  - generic [ref=e571]:
                    - button "后道验收衬衫 白色 M" [ref=e572]:
                      - img "后道验收衬衫 白色 M" [ref=e573]
                    - generic [ref=e574]:
                      - generic [ref=e575]: SPU-QC-001-02
                      - generic [ref=e576]: SPU-QC-001 · 白色 / M · 送检 20 件
                  - generic [ref=e577]:
                    - generic [ref=e578]:
                      - heading "质检与返工" [level=4] [ref=e579]
                      - generic [ref=e580]:
                        - generic [ref=e581]:
                          - text: 待质检数量
                          - textbox "待质检数量" [disabled] [ref=e582]: 20 件
                        - generic [ref=e583]:
                          - text: 合格数量
                          - spinbutton "合格数量" [ref=e584]: "20"
                        - generic [ref=e585]:
                          - text: 返工数量
                          - spinbutton "返工数量" [ref=e586]: "0"
                    - generic [ref=e587]:
                      - generic [ref=e588]:
                        - generic [ref=e589]:
                          - heading "瑕疵" [level=4] [ref=e590]
                          - paragraph [ref=e591]: 分别填写各瑕疵原因数量，瑕疵数量由系统自动汇总。
                        - generic [ref=e592]:
                          - text: 瑕疵数量
                          - spinbutton "瑕疵数量" [ref=e593]: "0"
                      - generic [ref=e594]:
                        - generic [ref=e595]:
                          - text: 做工原因
                          - spinbutton "做工原因" [ref=e596]: "0"
                        - generic [ref=e597]:
                          - text: 脏污
                          - spinbutton "脏污" [ref=e598]: "0"
                        - generic [ref=e599]:
                          - text: 抽纱
                          - spinbutton "抽纱" [ref=e600]: "0"
                        - generic [ref=e601]:
                          - text: 做错
                          - spinbutton "做错" [ref=e602]: "0"
                        - generic [ref=e603]:
                          - text: 布料原因
                          - spinbutton "布料原因" [ref=e604]: "0"
                        - generic [ref=e605]:
                          - text: 缺辅料
                          - spinbutton "缺辅料" [ref=e606]: "0"
                        - generic [ref=e607]:
                          - text: 做毁
                          - spinbutton "做毁" [ref=e608]: "0"
                        - generic [ref=e609]:
                          - text: 印花
                          - spinbutton "印花" [ref=e610]: "0"
                        - generic [ref=e611]:
                          - text: 色差
                          - spinbutton "色差" [ref=e612]: "0"
                        - generic [ref=e613]:
                          - text: 半套
                          - spinbutton "半套" [ref=e614]: "0"
                        - generic [ref=e615]:
                          - text: 破洞
                          - spinbutton "破洞" [ref=e616]: "0"
                        - generic [ref=e617]:
                          - text: 缺辅料不补
                          - spinbutton "缺辅料不补" [ref=e618]: "0"
                - article [ref=e619]:
                  - generic [ref=e620]:
                    - button "后道验收衬衫 雾蓝 L" [ref=e621]:
                      - img "后道验收衬衫 雾蓝 L" [ref=e622]
                    - generic [ref=e623]:
                      - generic [ref=e624]: SPU-QC-001-03
                      - generic [ref=e625]: SPU-QC-001 · 雾蓝 / L · 送检 20 件
                  - generic [ref=e626]:
                    - generic [ref=e627]:
                      - heading "质检与返工" [level=4] [ref=e628]
                      - generic [ref=e629]:
                        - generic [ref=e630]:
                          - text: 待质检数量
                          - textbox "待质检数量" [disabled] [ref=e631]: 20 件
                        - generic [ref=e632]:
                          - text: 合格数量
                          - spinbutton "合格数量" [ref=e633]: "20"
                        - generic [ref=e634]:
                          - text: 返工数量
                          - spinbutton "返工数量" [ref=e635]: "0"
                    - generic [ref=e636]:
                      - generic [ref=e637]:
                        - generic [ref=e638]:
                          - heading "瑕疵" [level=4] [ref=e639]
                          - paragraph [ref=e640]: 分别填写各瑕疵原因数量，瑕疵数量由系统自动汇总。
                        - generic [ref=e641]:
                          - text: 瑕疵数量
                          - spinbutton "瑕疵数量" [ref=e642]: "0"
                      - generic [ref=e643]:
                        - generic [ref=e644]:
                          - text: 做工原因
                          - spinbutton "做工原因" [ref=e645]: "0"
                        - generic [ref=e646]:
                          - text: 脏污
                          - spinbutton "脏污" [ref=e647]: "0"
                        - generic [ref=e648]:
                          - text: 抽纱
                          - spinbutton "抽纱" [ref=e649]: "0"
                        - generic [ref=e650]:
                          - text: 做错
                          - spinbutton "做错" [ref=e651]: "0"
                        - generic [ref=e652]:
                          - text: 布料原因
                          - spinbutton "布料原因" [ref=e653]: "0"
                        - generic [ref=e654]:
                          - text: 缺辅料
                          - spinbutton "缺辅料" [ref=e655]: "0"
                        - generic [ref=e656]:
                          - text: 做毁
                          - spinbutton "做毁" [ref=e657]: "0"
                        - generic [ref=e658]:
                          - text: 印花
                          - spinbutton "印花" [ref=e659]: "0"
                        - generic [ref=e660]:
                          - text: 色差
                          - spinbutton "色差" [ref=e661]: "0"
                        - generic [ref=e662]:
                          - text: 半套
                          - spinbutton "半套" [ref=e663]: "0"
                        - generic [ref=e664]:
                          - text: 破洞
                          - spinbutton "破洞" [ref=e665]: "0"
                        - generic [ref=e666]:
                          - text: 缺辅料不补
                          - spinbutton "缺辅料不补" [ref=e667]: "0"
                - article [ref=e668]:
                  - generic [ref=e669]:
                    - button "后道验收衬衫 卡其 XL" [ref=e670]:
                      - img "后道验收衬衫 卡其 XL" [ref=e671]
                    - generic [ref=e672]:
                      - generic [ref=e673]: SPU-QC-001-04
                      - generic [ref=e674]: SPU-QC-001 · 卡其 / XL · 送检 20 件
                  - generic [ref=e675]:
                    - generic [ref=e676]:
                      - heading "质检与返工" [level=4] [ref=e677]
                      - generic [ref=e678]:
                        - generic [ref=e679]:
                          - text: 待质检数量
                          - textbox "待质检数量" [disabled] [ref=e680]: 20 件
                        - generic [ref=e681]:
                          - text: 合格数量
                          - spinbutton "合格数量" [ref=e682]: "20"
                        - generic [ref=e683]:
                          - text: 返工数量
                          - spinbutton "返工数量" [ref=e684]: "0"
                    - generic [ref=e685]:
                      - generic [ref=e686]:
                        - generic [ref=e687]:
                          - heading "瑕疵" [level=4] [ref=e688]
                          - paragraph [ref=e689]: 分别填写各瑕疵原因数量，瑕疵数量由系统自动汇总。
                        - generic [ref=e690]:
                          - text: 瑕疵数量
                          - spinbutton "瑕疵数量" [ref=e691]: "0"
                      - generic [ref=e692]:
                        - generic [ref=e693]:
                          - text: 做工原因
                          - spinbutton "做工原因" [ref=e694]: "0"
                        - generic [ref=e695]:
                          - text: 脏污
                          - spinbutton "脏污" [ref=e696]: "0"
                        - generic [ref=e697]:
                          - text: 抽纱
                          - spinbutton "抽纱" [ref=e698]: "0"
                        - generic [ref=e699]:
                          - text: 做错
                          - spinbutton "做错" [ref=e700]: "0"
                        - generic [ref=e701]:
                          - text: 布料原因
                          - spinbutton "布料原因" [ref=e702]: "0"
                        - generic [ref=e703]:
                          - text: 缺辅料
                          - spinbutton "缺辅料" [ref=e704]: "0"
                        - generic [ref=e705]:
                          - text: 做毁
                          - spinbutton "做毁" [ref=e706]: "0"
                        - generic [ref=e707]:
                          - text: 印花
                          - spinbutton "印花" [ref=e708]: "0"
                        - generic [ref=e709]:
                          - text: 色差
                          - spinbutton "色差" [ref=e710]: "0"
                        - generic [ref=e711]:
                          - text: 半套
                          - spinbutton "半套" [ref=e712]: "0"
                        - generic [ref=e713]:
                          - text: 破洞
                          - spinbutton "破洞" [ref=e714]: "0"
                        - generic [ref=e715]:
                          - text: 缺辅料不补
                          - spinbutton "缺辅料不补" [ref=e716]: "0"
                - article [ref=e717]:
                  - generic [ref=e718]:
                    - button "后道验收衬衫 酒红 2XL" [ref=e719]:
                      - img "后道验收衬衫 酒红 2XL" [ref=e720]
                    - generic [ref=e721]:
                      - generic [ref=e722]: SPU-QC-001-05
                      - generic [ref=e723]: SPU-QC-001 · 酒红 / 2XL · 送检 20 件
                  - generic [ref=e724]:
                    - generic [ref=e725]:
                      - heading "质检与返工" [level=4] [ref=e726]
                      - generic [ref=e727]:
                        - generic [ref=e728]:
                          - text: 待质检数量
                          - textbox "待质检数量" [disabled] [ref=e729]: 20 件
                        - generic [ref=e730]:
                          - text: 合格数量
                          - spinbutton "合格数量" [ref=e731]: "20"
                        - generic [ref=e732]:
                          - text: 返工数量
                          - spinbutton "返工数量" [ref=e733]: "0"
                    - generic [ref=e734]:
                      - generic [ref=e735]:
                        - generic [ref=e736]:
                          - heading "瑕疵" [level=4] [ref=e737]
                          - paragraph [ref=e738]: 分别填写各瑕疵原因数量，瑕疵数量由系统自动汇总。
                        - generic [ref=e739]:
                          - text: 瑕疵数量
                          - spinbutton "瑕疵数量" [ref=e740]: "0"
                      - generic [ref=e741]:
                        - generic [ref=e742]:
                          - text: 做工原因
                          - spinbutton "做工原因" [ref=e743]: "0"
                        - generic [ref=e744]:
                          - text: 脏污
                          - spinbutton "脏污" [ref=e745]: "0"
                        - generic [ref=e746]:
                          - text: 抽纱
                          - spinbutton "抽纱" [ref=e747]: "0"
                        - generic [ref=e748]:
                          - text: 做错
                          - spinbutton "做错" [ref=e749]: "0"
                        - generic [ref=e750]:
                          - text: 布料原因
                          - spinbutton "布料原因" [ref=e751]: "0"
                        - generic [ref=e752]:
                          - text: 缺辅料
                          - spinbutton "缺辅料" [ref=e753]: "0"
                        - generic [ref=e754]:
                          - text: 做毁
                          - spinbutton "做毁" [ref=e755]: "0"
                        - generic [ref=e756]:
                          - text: 印花
                          - spinbutton "印花" [ref=e757]: "0"
                        - generic [ref=e758]:
                          - text: 色差
                          - spinbutton "色差" [ref=e759]: "0"
                        - generic [ref=e760]:
                          - text: 半套
                          - spinbutton "半套" [ref=e761]: "0"
                        - generic [ref=e762]:
                          - text: 破洞
                          - spinbutton "破洞" [ref=e763]: "0"
                        - generic [ref=e764]:
                          - text: 缺辅料不补
                          - spinbutton "缺辅料不补" [ref=e765]: "0"
              - generic [ref=e766]:
                - group "后道加工项目" [ref=e767]:
                  - generic [ref=e768]: 后道加工项目
                  - generic [ref=e769]: 按实物勾选需要加工的项目，按展示顺序执行；未勾选项目不参与后道。无项目时，合格量直接交成衣仓。
                  - generic [ref=e770]:
                    - generic [ref=e771]:
                      - checkbox "开扣眼" [checked] [ref=e772]
                      - text: 开扣眼
                    - generic [ref=e773]:
                      - checkbox "装扣子" [checked] [ref=e774]
                      - text: 装扣子
                    - generic [ref=e775]:
                      - checkbox "熨烫" [checked] [ref=e776]
                      - text: 熨烫
                    - generic [ref=e777]:
                      - checkbox "包装" [checked] [ref=e778]
                      - text: 包装
                - button "完成质检并生成后道加工单" [ref=e779]
            - complementary [ref=e780]:
              - generic [ref=e781]:
                - heading "款式颜色图片" [level=3] [ref=e782]
                - paragraph [ref=e783]: 展示本次质检款式的颜色图片，无需额外维护。
              - generic [ref=e784]:
                - heading "后道验收衬衫" [level=4] [ref=e785]
                - generic [ref=e786]: SPU-QC-001
                - generic [ref=e787]:
                  - figure "黑色" [ref=e788]:
                    - button "后道验收衬衫 黑色" [ref=e789]:
                      - img "后道验收衬衫 黑色" [ref=e790]
                    - generic [ref=e791]: 黑色
                  - figure "白色" [ref=e792]:
                    - button "后道验收衬衫 白色" [ref=e793]:
                      - img "后道验收衬衫 白色" [ref=e794]
                    - generic [ref=e795]: 白色
                  - figure "雾蓝" [ref=e796]:
                    - button "后道验收衬衫 雾蓝" [ref=e797]:
                      - img "后道验收衬衫 雾蓝" [ref=e798]
                    - generic [ref=e799]: 雾蓝
                  - figure "卡其" [ref=e800]:
                    - button "后道验收衬衫 卡其" [ref=e801]:
                      - img "后道验收衬衫 卡其" [ref=e802]
                    - generic [ref=e803]: 卡其
                  - figure "酒红" [ref=e804]:
                    - button "后道验收衬衫 酒红" [ref=e805]:
                      - img "后道验收衬衫 酒红" [ref=e806]
                    - generic [ref=e807]: 酒红
  - button "查生产" [ref=e808]:
    - img [ref=e809]
```

# Test source

```ts
  800  |   await expect(page.locator('[data-authorization-code]')).toHaveCount(0)
  801  | 
  802  |   await page.goto(`/fcs/craft/post-finishing/audit-records?keyword=${encodeURIComponent(seed.authorizedOutboundNo)}`)
  803  |   await expect(page.getByRole('heading', { name: '差异与操作日志' })).toBeVisible()
  804  |   await expect(page.getByRole('heading', { name: '回货全链路总览' })).toBeVisible()
  805  |   await page.getByRole('link', { name: '查看详情' }).click()
  806  |   await expect(page.locator('[data-audit-chain-detail]')).toBeVisible()
  807  |   await expect(page.locator('form[action="/fcs/craft/post-finishing/audit-records"]')).toHaveCount(0)
  808  |   await expect(page.getByRole('heading', { name: '回货全链路总览' })).toHaveCount(0)
  809  |   await expect(page.getByRole('link', { name: '业务链总览' })).toBeVisible()
  810  |   await expect(page.getByRole('heading', { name: '1. 回货与质检' })).toBeVisible()
  811  |   await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  812  |   await page.getByRole('link', { name: '差异与质检' }).click()
  813  |   await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toBeVisible()
  814  |   await expect(page.getByRole('heading', { name: '质检瑕疵记录' })).toBeVisible()
  815  |   await page.getByRole('link', { name: '操作时间线' }).click()
  816  |   await expect(page.getByRole('heading', { name: '按环节归组的操作记录' })).toBeVisible()
  817  |   await expect(page.getByRole('heading', { name: '逐 SKU 数量差异' })).toHaveCount(0)
  818  |   await expect(page.locator('[data-audit-chain-detail]')).toContainText('陈仓库主管')
  819  |   await page.goto(`/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(seed.authorizedOutboundNo)}&receiver=${encodeURIComponent('孙仓库收货员')}&authorizer=${encodeURIComponent('陈仓库主管')}`)
  820  |   await expect(page.locator('tbody tr')).toHaveCount(1)
  821  |   await expect(page.locator('tbody')).toContainText(seed.authorizedOutboundNo)
  822  |   await page.locator('[data-nav*="/fcs/craft/post-finishing/outbound-orders/"]').click()
  823  |   await expect(page.locator('body')).toContainText('追溯链路')
  824  |   await expect(page.locator('body')).toContainText('后道加工单')
  825  |   await expect(page.locator('body')).toContainText('复检单')
  826  | 
  827  |   const prints: Array<{ url: string; title: string; documentNo: string; target?: string }> = [
  828  |     { url: `/fcs/craft/post-finishing/print?type=SEND_QC&id=${encodeURIComponent(seed.qcDeliveryId)}`, title: '后道送检单', documentNo: seed.qcTaskNo, target: '/fcs/craft/post-finishing/qc-workbench' },
  829  |     { url: `/fcs/craft/post-finishing/print?type=POST_ORDER&id=${encodeURIComponent(seed.postTaskId)}`, title: '后道加工单流转卡', documentNo: seed.postTaskNo, target: '/fcs/pda/post-finishing/execute' },
  830  |     { url: `/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(seed.outboundOrderId)}`, title: '后道出货单', documentNo: seed.outboundOrderNo },
  831  |   ]
  832  |   for (const item of prints) {
  833  |     await page.goto(item.url)
  834  |     await expect(page.getByRole('heading', { name: item.title })).toBeVisible()
  835  |     await expect(page.locator('[data-print-document-no]')).toHaveAttribute('data-print-document-no', item.documentNo)
  836  |     if (item.target) await expect(page.locator('[data-scan-target]')).toHaveAttribute('data-scan-target', new RegExp(item.target))
  837  |     else await expect(page.locator('[data-scan-target]')).toHaveCount(0)
  838  |     if (item.title === '后道出货单') await expect(page.getByRole('heading', { name: '出货明细' }).locator('xpath=following-sibling::table[1]//tbody/tr')).toHaveCount(5)
  839  |     else await expect(page.locator('tbody tr')).toHaveCount(5)
  840  |     await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', item.documentNo)
  841  |     if (item.title === '后道出货单') {
  842  |       await expect(page.locator('body')).toContainText('来源动作')
  843  |       await expect(page.locator('body')).toContainText('交出位置')
  844  |       await expect(page.locator('body')).toContainText('接收仓')
  845  |     } else if (item.title === '后道加工单流转卡') {
  846  |       for (const label of ['送货单 / 质检单', '生产单 / 第几次回货', '后道工序', '质检交接时间']) await expect(page.locator('dt').filter({ hasText: label })).toBeVisible()
  847  |       for (const processItem of ['开扣眼', '装扣子', '熨烫', '包装']) {
  848  |         await expect(page.getByText(`${processItem}完成量`, { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('0 / 100 件')
  849  |       }
  850  |       await expect(page.getByText('全部后道完成 / 可交复检', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('0 / 0 件')
  851  |       await expect(page.getByText('全部复检单', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('尚未交复检')
  852  |       await expect(page.getByText('全部出货单', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('尚未出货')
  853  |     } else await expect(page.locator('dl > div')).toHaveCount(4)
  854  |     await expectImagesLoaded(page)
  855  |     const sheetSize = await page.locator('[data-print-sheet="a4"]').evaluate((node) => {
  856  |       const rect = node.getBoundingClientRect()
  857  |       return { width: rect.width, height: rect.height }
  858  |     })
  859  |     expect(sheetSize.width).toBeLessThanOrEqual(795)
  860  |     expect(sheetSize.height).toBeLessThan(1123)
  861  |     if (item.title === '后道出货单') await attachPageEvidence(page, testInfo, 'a4-outbound-print')
  862  |   }
  863  | 
  864  |   const outboundLabelCount = await page.evaluate(async (id) => {
  865  |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  866  |     return flow.getPostFinishingFullFlowOutboundOrder(id)?.lines.reduce((sum, line) => sum + line.outboundQty, 0) || 0
  867  |   }, seed.outboundOrderId)
  868  |   for (const [type, kind] of [['OUTBOUND_BARCODE', 'BARCODE'], ['OUTBOUND_HANGTAG', 'HANGTAG']] as const) {
  869  |     await page.goto(`/fcs/craft/post-finishing/print?type=${type}&id=${encodeURIComponent(seed.outboundOrderId)}`)
  870  |     await expect(page.locator('[data-testid="post-finishing-outbound-label-print"]')).toHaveAttribute('data-label-kind', kind)
  871  |     await expect(page.locator('[data-testid="post-finishing-outbound-label-print"]')).toHaveAttribute('data-label-count', String(outboundLabelCount))
  872  |     await expect(page.locator('[data-outbound-unit-label]')).toHaveCount(outboundLabelCount)
  873  |     await expect(page.getByRole('button', { name: '打印全部' })).toBeVisible()
  874  |   }
  875  | 
  876  |   await page.locator('img').first().evaluate((image) => { image.src = '/__missing-post-finishing-image__.jpg' })
  877  |   await expect(page.getByText('图片加载失败').first()).toBeVisible()
  878  | 
  879  |   await page.goto(`/fcs/craft/post-finishing/print?type=SKU_LABEL&id=${encodeURIComponent(seed.outboundRecheckId)}&skuId=${encodeURIComponent(seed.outboundSkuId)}`)
  880  |   await expect(page.locator('[data-testid="post-finishing-sku-label-print"]')).toBeVisible()
  881  |   await expect(page.locator('[data-sku-label-barcode]')).toBeVisible()
  882  |   await expect(page.getByRole('button', { name: '打印 40×30 SKU 贴标' })).toBeVisible()
  883  |   const labelSize = await page.locator('[data-testid="post-finishing-sku-label-print"] > div').first().evaluate((node) => {
  884  |     const rect = node.getBoundingClientRect()
  885  |     return { width: rect.width, height: rect.height }
  886  |   })
  887  |   expect(labelSize.width).toBeGreaterThan(140)
  888  |   expect(labelSize.width).toBeLessThan(165)
  889  |   expect(labelSize.height).toBeGreaterThan(105)
  890  |   expect(labelSize.height).toBeLessThan(125)
  891  | })
  892  | 
  893  | // Current requirements replace automatic localStorage conversion and the SPU editor.
  894  | test('后道质检唯一执行、原子保存、版本冲突与显式资料转换', async ({ page }, testInfo) => {
  895  |   test.setTimeout(180_000)
  896  |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  897  |   const verify = new Function(`return (${readFileSync('scripts/verification/post-finishing-qc-browser.js', 'utf8')})`)()
  898  |   const result = await verify(page)
  899  |   await testInfo.attach('post-finishing-browser-contract', { body: Buffer.from(JSON.stringify(result, null, 2)), contentType: 'application/json' })
> 900  |   expect(result.status).toBe('passed')
       |                         ^ Error: expect(received).toBe(expected) // Object.is equality
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
  998  |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(false)
  999  |   // 触发同一页面会话的原站内路由事件，验证一次性来源读取没有漏掉后续入口。
  1000 |   await page.evaluate(() => {
```