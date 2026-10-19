# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow-cross-terminal.spec.ts >> 15条链按责任逐条跨公共PDA、唯一Web质检、可选后道处理与成衣仓交接
- Location: tests/post-finishing-full-flow-cross-terminal.spec.ts:839:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-post-entry-form]')
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('[data-post-entry-form]')
    24 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e2]:
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
        - alert [ref=e406]: 至少一个SKU的本次数量大于0。 本次输入已保留。
        - generic [ref=e408]:
          - generic [ref=e409]:
            - button "后道待加工仓" [ref=e411]
            - button "质检清单" [ref=e413]
            - button "执行质检" [ref=e415]
            - generic [ref=e416]:
              - button "后道加工单" [ref=e417]
              - button [ref=e418]:
                - img [ref=e419]
            - button "复检单" [ref=e424]
            - button "后道待交出仓" [ref=e426]
            - button "后道出货单" [ref=e428]
          - button "全部关闭" [ref=e430]
        - generic [ref=e433]:
          - generic [ref=e434]:
            - generic [ref=e435]:
              - heading "后道加工单详情" [level=1] [ref=e436]
              - paragraph [ref=e437]: PO-QC-202608-002-3-ZJ-HD / PO-QC-202608-002
            - generic [ref=e438]:
              - generic [ref=e439]:
                - text: 原型操作身份
                - combobox "原型操作身份" [ref=e440]:
                  - option "周后道操作员 · 后道操作员" [selected]
                  - option "吴后道主管 · 后道主管"
              - button "切换身份" [ref=e441]
              - generic [ref=e442]: 返回列表
          - generic [ref=e443]:
            - generic [ref=e444]:
              - generic [ref=e445]:
                - heading "PO-QC-202608-002-3-ZJ-HD" [level=2] [ref=e446]
                - generic [ref=e447]: 质检单 PO-QC-202608-002-3-ZJ · 回货单 PO-QC-202608-002-3
                - generic [ref=e448]: 实际加工链：熨烫 → 包装
              - generic [ref=e449]:
                - generic [ref=e450]: 后道中
                - generic [ref=e451]: 当前录入人：周后道操作员
            - generic [ref=e452]:
              - generic [ref=e453]:
                - generic [ref=e454]: 应加工
                - generic [ref=e455]: 100 件
              - generic [ref=e456]:
                - generic [ref=e457]: 全部后道完成
                - generic [ref=e458]: 0 件
              - generic [ref=e459]:
                - generic [ref=e460]: 已交复检
                - generic [ref=e461]: 0 件
              - generic [ref=e462]:
                - generic [ref=e463]: 可交复检
                - generic [ref=e464]: 0 件
          - region "各加工项进度" [ref=e465]:
            - article [ref=e466]:
              - generic [ref=e467]:
                - heading "开扣眼" [level=3] [ref=e468]
                - generic [ref=e469]: 不涉及
              - generic [ref=e470]: 本单无需加工此项
            - article [ref=e471]:
              - generic [ref=e472]:
                - heading "装扣子" [level=3] [ref=e473]
                - generic [ref=e474]: 不涉及
              - generic [ref=e475]: 本单无需加工此项
            - article [ref=e476]:
              - generic [ref=e477]:
                - heading "熨烫" [level=3] [ref=e478]
                - generic [ref=e479]: 已完成
              - generic [ref=e480]: 100 / 100 件
              - generic [ref=e481]: 本项可登记 0 件
            - article [ref=e482]:
              - generic [ref=e483]:
                - heading "包装" [level=3] [ref=e484]
                - generic [ref=e485]: 待加工
              - generic [ref=e486]: 0 / 100 件
              - generic [ref=e487]: 本项可登记 100 件
              - button "登记包装" [ref=e488]
          - generic [ref=e489]:
            - heading "SKU加工进度 数量单位：件" [level=3] [ref=e490]
            - generic [ref=e491]:
              - article [ref=e492]:
                - generic [ref=e493]:
                  - button "后道验收连衣裙 SPU-QC-002-01 黑色 S" [ref=e494]:
                    - img "后道验收连衣裙 SPU-QC-002-01 黑色 S" [ref=e495]
                  - generic [ref=e496]:
                    - generic [ref=e497]: SPU-QC-002-01
                    - generic [ref=e498]: 后道验收连衣裙 · 黑色 / S
                    - generic [ref=e499]: 应加工 20 · 全部后道完成 0
                - generic [ref=e500]:
                  - generic [ref=e501]:
                    - term [ref=e502]: 开扣眼
                    - definition [ref=e503]: 不涉及
                  - generic [ref=e504]:
                    - term [ref=e505]: 装扣子
                    - definition [ref=e506]: 不涉及
                  - generic [ref=e507]:
                    - term [ref=e508]: 熨烫
                    - definition [ref=e509]: 20 / 20
                  - generic [ref=e510]:
                    - term [ref=e511]: 包装
                    - definition [ref=e512]: 0 / 20
                  - generic [ref=e513]:
                    - term [ref=e514]: 已交复检
                    - definition [ref=e515]: "0"
                  - generic [ref=e516]:
                    - term [ref=e517]: 可交复检
                    - definition [ref=e518]: "0"
              - article [ref=e519]:
                - generic [ref=e520]:
                  - button "后道验收连衣裙 SPU-QC-002-02 白色 M" [ref=e521]:
                    - img "后道验收连衣裙 SPU-QC-002-02 白色 M" [ref=e522]
                  - generic [ref=e523]:
                    - generic [ref=e524]: SPU-QC-002-02
                    - generic [ref=e525]: 后道验收连衣裙 · 白色 / M
                    - generic [ref=e526]: 应加工 20 · 全部后道完成 0
                - generic [ref=e527]:
                  - generic [ref=e528]:
                    - term [ref=e529]: 开扣眼
                    - definition [ref=e530]: 不涉及
                  - generic [ref=e531]:
                    - term [ref=e532]: 装扣子
                    - definition [ref=e533]: 不涉及
                  - generic [ref=e534]:
                    - term [ref=e535]: 熨烫
                    - definition [ref=e536]: 20 / 20
                  - generic [ref=e537]:
                    - term [ref=e538]: 包装
                    - definition [ref=e539]: 0 / 20
                  - generic [ref=e540]:
                    - term [ref=e541]: 已交复检
                    - definition [ref=e542]: "0"
                  - generic [ref=e543]:
                    - term [ref=e544]: 可交复检
                    - definition [ref=e545]: "0"
              - article [ref=e546]:
                - generic [ref=e547]:
                  - button "后道验收连衣裙 SPU-QC-002-03 雾蓝 L" [ref=e548]:
                    - img "后道验收连衣裙 SPU-QC-002-03 雾蓝 L" [ref=e549]
                  - generic [ref=e550]:
                    - generic [ref=e551]: SPU-QC-002-03
                    - generic [ref=e552]: 后道验收连衣裙 · 雾蓝 / L
                    - generic [ref=e553]: 应加工 20 · 全部后道完成 0
                - generic [ref=e554]:
                  - generic [ref=e555]:
                    - term [ref=e556]: 开扣眼
                    - definition [ref=e557]: 不涉及
                  - generic [ref=e558]:
                    - term [ref=e559]: 装扣子
                    - definition [ref=e560]: 不涉及
                  - generic [ref=e561]:
                    - term [ref=e562]: 熨烫
                    - definition [ref=e563]: 20 / 20
                  - generic [ref=e564]:
                    - term [ref=e565]: 包装
                    - definition [ref=e566]: 0 / 20
                  - generic [ref=e567]:
                    - term [ref=e568]: 已交复检
                    - definition [ref=e569]: "0"
                  - generic [ref=e570]:
                    - term [ref=e571]: 可交复检
                    - definition [ref=e572]: "0"
              - article [ref=e573]:
                - generic [ref=e574]:
                  - button "后道验收连衣裙 SPU-QC-002-04 卡其 XL" [ref=e575]:
                    - img "后道验收连衣裙 SPU-QC-002-04 卡其 XL" [ref=e576]
                  - generic [ref=e577]:
                    - generic [ref=e578]: SPU-QC-002-04
                    - generic [ref=e579]: 后道验收连衣裙 · 卡其 / XL
                    - generic [ref=e580]: 应加工 20 · 全部后道完成 0
                - generic [ref=e581]:
                  - generic [ref=e582]:
                    - term [ref=e583]: 开扣眼
                    - definition [ref=e584]: 不涉及
                  - generic [ref=e585]:
                    - term [ref=e586]: 装扣子
                    - definition [ref=e587]: 不涉及
                  - generic [ref=e588]:
                    - term [ref=e589]: 熨烫
                    - definition [ref=e590]: 20 / 20
                  - generic [ref=e591]:
                    - term [ref=e592]: 包装
                    - definition [ref=e593]: 0 / 20
                  - generic [ref=e594]:
                    - term [ref=e595]: 已交复检
                    - definition [ref=e596]: "0"
                  - generic [ref=e597]:
                    - term [ref=e598]: 可交复检
                    - definition [ref=e599]: "0"
              - article [ref=e600]:
                - generic [ref=e601]:
                  - button "后道验收连衣裙 SPU-QC-002-05 酒红 2XL" [ref=e602]:
                    - img "后道验收连衣裙 SPU-QC-002-05 酒红 2XL" [ref=e603]
                  - generic [ref=e604]:
                    - generic [ref=e605]: SPU-QC-002-05
                    - generic [ref=e606]: 后道验收连衣裙 · 酒红 / 2XL
                    - generic [ref=e607]: 应加工 20 · 全部后道完成 0
                - generic [ref=e608]:
                  - generic [ref=e609]:
                    - term [ref=e610]: 开扣眼
                    - definition [ref=e611]: 不涉及
                  - generic [ref=e612]:
                    - term [ref=e613]: 装扣子
                    - definition [ref=e614]: 不涉及
                  - generic [ref=e615]:
                    - term [ref=e616]: 熨烫
                    - definition [ref=e617]: 20 / 20
                  - generic [ref=e618]:
                    - term [ref=e619]: 包装
                    - definition [ref=e620]: 0 / 20
                  - generic [ref=e621]:
                    - term [ref=e622]: 已交复检
                    - definition [ref=e623]: "0"
                  - generic [ref=e624]:
                    - term [ref=e625]: 可交复检
                    - definition [ref=e626]: "0"
          - generic [ref=e627]:
            - heading "复检与出货记录" [level=3] [ref=e628]
            - paragraph [ref=e630]: 尚未交复检。
          - generic [ref=e631]:
            - heading "加工登记记录 1 次" [level=3] [ref=e632]
            - article [ref=e634]:
              - generic [ref=e635]:
                - generic [ref=e636]: 熨烫
                - generic [ref=e637]: 2026/10/20 01:18:31
              - generic [ref=e638]: SPU-QC-002-05：20 件；SPU-QC-002-03：20 件；SPU-QC-002-02：20 件；SPU-QC-002-01：20 件；SPU-QC-002-04：20 件
              - generic [ref=e639]: 加工责任：全能力测试工厂_操作工 · 录入：全能力测试工厂_操作工
    - button "查生产" [ref=e640]:
      - img [ref=e641]
  - dialog "登记包装" [ref=e645]:
    - banner [ref=e646]:
      - heading "登记包装" [level=2] [ref=e647]
      - button "关闭" [ref=e648]
    - generic [ref=e649]:
      - paragraph [ref=e650]: PO-QC-202608-002-3-ZJ-HD
      - paragraph [ref=e651]: 填写本次实际完成量，系统自动累计；本次未加工的SKU保留0。
      - generic [ref=e652]:
        - text: 本次加工责任人
        - combobox "本次加工责任人" [ref=e653]:
          - option "周后道操作员 · 后道操作员" [selected]
          - option "吴后道主管 · 后道主管"
      - generic [ref=e654]:
        - article [ref=e655]:
          - generic [ref=e656]:
            - button "后道验收连衣裙 SPU-QC-002-01 黑色 S" [ref=e657]:
              - img "后道验收连衣裙 SPU-QC-002-01 黑色 S" [ref=e658]
            - generic [ref=e659]:
              - generic [ref=e660]: SPU-QC-002-01
              - generic [ref=e661]: 黑色 / S
              - generic [ref=e662]: 本项累计 0 · 本次可登记 20 件
          - generic [ref=e663]:
            - text: 本次完成数量
            - spinbutton "本次完成数量" [ref=e664]: "0"
        - article [ref=e665]:
          - generic [ref=e666]:
            - button "后道验收连衣裙 SPU-QC-002-02 白色 M" [ref=e667]:
              - img "后道验收连衣裙 SPU-QC-002-02 白色 M" [ref=e668]
            - generic [ref=e669]:
              - generic [ref=e670]: SPU-QC-002-02
              - generic [ref=e671]: 白色 / M
              - generic [ref=e672]: 本项累计 0 · 本次可登记 20 件
          - generic [ref=e673]:
            - text: 本次完成数量
            - spinbutton "本次完成数量" [ref=e674]: "0"
        - article [ref=e675]:
          - generic [ref=e676]:
            - button "后道验收连衣裙 SPU-QC-002-03 雾蓝 L" [ref=e677]:
              - img "后道验收连衣裙 SPU-QC-002-03 雾蓝 L" [ref=e678]
            - generic [ref=e679]:
              - generic [ref=e680]: SPU-QC-002-03
              - generic [ref=e681]: 雾蓝 / L
              - generic [ref=e682]: 本项累计 0 · 本次可登记 20 件
          - generic [ref=e683]:
            - text: 本次完成数量
            - spinbutton "本次完成数量" [ref=e684]: "0"
        - article [ref=e685]:
          - generic [ref=e686]:
            - button "后道验收连衣裙 SPU-QC-002-04 卡其 XL" [ref=e687]:
              - img "后道验收连衣裙 SPU-QC-002-04 卡其 XL" [ref=e688]
            - generic [ref=e689]:
              - generic [ref=e690]: SPU-QC-002-04
              - generic [ref=e691]: 卡其 / XL
              - generic [ref=e692]: 本项累计 0 · 本次可登记 20 件
          - generic [ref=e693]:
            - text: 本次完成数量
            - spinbutton "本次完成数量" [ref=e694]: "0"
        - article [ref=e695]:
          - generic [ref=e696]:
            - button "后道验收连衣裙 SPU-QC-002-05 酒红 2XL" [ref=e697]:
              - img "后道验收连衣裙 SPU-QC-002-05 酒红 2XL" [ref=e698]
            - generic [ref=e699]:
              - generic [ref=e700]: SPU-QC-002-05
              - generic [ref=e701]: 酒红 / 2XL
              - generic [ref=e702]: 本项累计 0 · 本次可登记 20 件
          - generic [ref=e703]:
            - text: 本次完成数量
            - spinbutton "本次完成数量" [ref=e704]: "0"
      - generic [ref=e705]:
        - button "取消" [ref=e706]
        - button "保存本次完成" [active] [ref=e707]
```

# Test source

```ts
  476 |     await expect(page.locator('[data-qc-result-line]')).toHaveCount(5)
  477 |   }
  478 | 
  479 |   const lines = page.locator('[data-qc-result-line]')
  480 |   for (let index = 0; index < 5; index += 1) {
  481 |     const line = lines.nth(index)
  482 |     await line.locator('[data-qc-result-field="passedQty"]').fill(await line.locator('[data-qc-result-field="passedQty"]').inputValue())
  483 |     await line.locator('[data-qc-result-field="returnQty"]').fill('0')
  484 |   }
  485 | 
  486 |   const firstLine = lines.first()
  487 |   const firstPassed = firstLine.locator('[data-qc-result-field="passedQty"]')
  488 |   const firstExpected = Number(await firstPassed.inputValue())
  489 |   if (scenario.qcScenario === 'balanced-defect') {
  490 |     await firstPassed.fill(String(firstExpected - 1))
  491 |     await firstLine.locator('[data-qc-defect-reason="色差"]').fill('1')
  492 |     await expect(firstLine.locator('[data-qc-result-field="defectQty"]')).toHaveValue('1')
  493 |   }
  494 |   if (scenario.qcScenario === 'balanced-return') {
  495 |     await firstPassed.fill(String(firstExpected - 1))
  496 |     await firstLine.locator('[data-qc-result-field="returnQty"]').fill('1')
  497 |     await expect(firstLine.locator('[data-qc-rework-factory-block]')).toBeVisible()
  498 |     await firstLine.locator('[data-qc-result-field="returnReceiver"]').fill('CV Micro Sewing Jakarta Pusat')
  499 |   }
  500 |   if (scenario.qcScenario === 'difference') {
  501 |     const payload = await freshAuthorizationPayload(context, 'AUTH-POST-001')
  502 |     await firstPassed.fill(String(firstExpected - 1))
  503 |     await expect(page.locator('[data-qc-difference-authorization]')).toBeVisible()
  504 |     await page.locator('[data-qc-difference-reason]').fill('全量跨端UI验收：质检首个SKU少1件')
  505 |     await page.locator('[data-qc-authorization]').fill(payload)
  506 |     chain.authorizationStages.push('Web质检')
  507 |     await saveScreenshot(page, chain, 'qc-authorization')
  508 |   }
  509 | 
  510 |   const processItems = page.locator('[data-qc-process-item]')
  511 |   await expect(processItems).toHaveCount(4)
  512 |   for (const input of await processItems.all()) { await expect(input).toBeEnabled(); await input.uncheck() }
  513 |   if (scenario.needPost) {
  514 |     const selected = scenario.orderIndex === 0 ? ['开扣眼', '装扣子', '熨烫', '包装'] : ['熨烫', '包装']
  515 |     for (const item of selected) await page.locator(`[data-qc-process-item][value="${item}"]`).check()
  516 |     await expect(page.locator('[data-qc-process-item]:checked')).toHaveCount(selected.length)
  517 |   } else await expect(page.locator('[data-qc-process-item]:checked')).toHaveCount(0)
  518 |   page.once('dialog', dialog => dialog.accept())
  519 | 
  520 |   await page.getByRole('button', { name: scenario.needPost ? '完成质检并生成后道加工单' : '完成质检并交接成衣仓' }).click()
  521 |   await expect(page.getByRole('status')).toContainText('质检完成')
  522 |   const status = await statusText(page)
  523 |   await expect(page.locator('body')).toContainText('质检完成')
  524 |   const postTaskNo = scenario.needPost ? extractNumber(status, /后道加工单 ([A-Z0-9-]+)/, '后道加工单号') : undefined
  525 |   const outboundOrderNo = scenario.needPost ? undefined : extractNumber(status, /待接收交接单 (PO-[A-Z0-9-]+-CH)/, '成衣仓待接收交接单号')
  526 |   addStage(chain, page, 'Web质检完成', status, {
  527 |     qcScenario: scenario.qcScenario,
  528 |     needPost: scenario.needPost,
  529 |     selectedProcessItems: scenario.needPost ? (scenario.orderIndex === 0 ? 4 : 2) : 0,
  530 |     downstreamNo: postTaskNo || outboundOrderNo || '',
  531 |   })
  532 |   if (scenario.qcScenario !== 'normal' || scenario.qcClaimConflictAndRelease) await saveScreenshot(page, chain, 'web-qc-completed')
  533 |   return { postTaskNo, outboundOrderNo }
  534 | }
  535 | 
  536 | async function completePostThroughPda(
  537 |   page: Page,
  538 |   scenario: CrossTerminalScenario,
  539 |   chain: ChainEvidence,
  540 |   postTaskNo: string,
  541 | ): Promise<string> {
  542 |   await page.setViewportSize({ width: 1366, height: 768 })
  543 |   await page.goto(`/fcs/craft/post-finishing/work-orders?keyword=${encodeURIComponent(postTaskNo)}`)
  544 |   const taskRow = page.locator('tbody tr').filter({ hasText: postTaskNo })
  545 |   await expect(taskRow).toHaveCount(1)
  546 |   await taskRow.locator('[data-nav]').filter({ hasText: /^打印加工单$/ }).click({ noWaitAfter: true })
  547 |   await expect(page.getByRole('heading', { name: '后道加工单流转卡' })).toBeVisible()
  548 |   await expect(page.locator('[data-business-document-barcode]')).toHaveAttribute('data-business-document-barcode', postTaskNo)
  549 |   await expect(page.locator('tbody tr')).toHaveCount(5)
  550 |   addStage(chain, page, 'Web后道加工单打印', undefined, { postTaskNo, printedSkuLines: 5 })
  551 | 
  552 |   await page.setViewportSize({ width: 360, height: 800 })
  553 |   await page.goto('/fcs/pda/post-finishing/execute')
  554 |   const selected = scenario.orderIndex === 0 ? ['开扣眼', '装扣子', '熨烫', '包装'] : ['熨烫', '包装']
  555 |   await fillScanAndWaitForRefresh(page, page.locator('[data-pda-post-field="postScan"]'), postTaskNo, {
  556 |     queryKey: 'id',
  557 |     queryValue: postTaskNo,
  558 |     resultSelector: '[data-post-process]',
  559 |     resultCount: selected.length,
  560 |   })
  561 |   await expect(page.locator('[data-post-process]')).toHaveCount(selected.length)
  562 |   expect(await page.locator('[data-post-process]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-post-process')))).toEqual(selected)
  563 |   let webContinuation = false
  564 |   for (const processItem of selected) {
  565 |     if (scenario.postScenario === 'web-fallback' && processItem !== selected[0]) {
  566 |       if (!webContinuation) {
  567 |         await setCurrentWebActor(page, 'PF-USER-POST')
  568 |         await page.setViewportSize({ width: 1366, height: 768 })
  569 |         await page.goto(`/fcs/craft/post-finishing/work-orders/${encodeURIComponent(postTaskNo)}`)
  570 |         await expect(page.locator('[data-web-post-takeover-reason]')).toHaveCount(0)
  571 |         webContinuation = true
  572 |       }
  573 |       await page.locator(`[data-post-finishing-work-order-detail-action="open-register"][data-process-item="${processItem}"]`).click()
  574 |       for (const input of await page.locator('[data-post-entry-quantity]').all()) await input.fill(await input.getAttribute('max') || '0')
  575 |       await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
> 576 |       await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
      |                                                            ^ Error: expect(locator).toHaveCount(expected) failed
  577 |     } else {
  578 |       const card = page.locator(`[data-post-process="${processItem}"]`)
  579 |       if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  580 |       const inputs = card.locator('[data-post-process-qty]')
  581 |       for (let index = 0; index < await inputs.count(); index++) {
  582 |         const input = inputs.nth(index)
  583 |         if (await input.isDisabled()) continue
  584 |         const maximum = Number(await input.getAttribute('max') || '0')
  585 |         await input.fill(String(scenario.postScenario === 'partial-then-continue' && processItem === selected[0] && index === 0 ? Math.max(0, maximum - 1) : maximum))
  586 |       }
  587 |       await card.locator('[data-pda-post-action="save-process-completion"]').click()
  588 |       await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
  589 |     }
  590 |   }
  591 |   if (scenario.postScenario === 'partial-then-continue') {
  592 |     const partial = await page.evaluate(async no => {
  593 |       const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  594 |       return { task: flow.getPostFinishingFullFlowPostTask(no), progress: flow.getPostFinishingProcessProgress(no) }
  595 |     }, postTaskNo)
  596 |     expect(partial.task?.status).toBe('后道中')
  597 |     expect(partial.progress.totalExpectedQty - partial.progress.totalCompletedQty).toBe(1)
  598 |     for (const processItem of selected) {
  599 |       const card = page.locator(`[data-post-process="${processItem}"]`)
  600 |       if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  601 |       await card.locator('[data-post-process-qty]').first().fill('1')
  602 |       await card.locator('[data-pda-post-action="save-process-completion"]').click()
  603 |       await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText(`${processItem}本次已保存`)
  604 |     }
  605 |   }
  606 |   if (webContinuation) {
  607 |     await page.locator('[data-post-finishing-work-order-detail-action="open-recheck"]').click()
  608 |     for (const input of await page.locator('[data-post-entry-quantity]').all()) await input.fill(await input.getAttribute('max') || '0')
  609 |     page.once('dialog', dialog => dialog.accept())
  610 |     await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  611 |     await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  612 |   } else {
  613 |     const form = page.locator('[data-post-recheck-form]')
  614 |     if ((await form.getAttribute('open')) === null) await form.locator(':scope > summary').click()
  615 |     for (const input of await form.locator('[data-post-recheck-qty]:not([disabled])').all()) await input.fill(await input.getAttribute('max') || '0')
  616 |     page.once('dialog', dialog => dialog.accept())
  617 |     await page.locator('[data-pda-post-action="submit-for-recheck"]').click()
  618 |     await expect(page.locator('[data-pda-post-task] [role="status"]')).toContainText('已交复检')
  619 |   }
  620 |   const child = await page.evaluate(async no => {
  621 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  622 |     const task = flow.getPostFinishingFullFlowPostTask(no)!
  623 |     return flow.listPostFinishingFullFlowRecheckOrders().find(row => row.postTaskId === task.postTaskId)!
  624 |   }, postTaskNo)
  625 |   const recheckOrderNo = child.recheckOrderNo
  626 |   const status = `按已完成可用量交复检 ${recheckOrderNo}`
  627 |   addStage(chain, page, webContinuation ? 'Web接续分项后交复检' : 'PDA分项完成后交复检', status, { postScenario: scenario.postScenario, recheckOrderNo })
  628 |   if (scenario.postScenario !== 'normal') await saveScreenshot(page, chain, 'pda-post-completed')
  629 |   return recheckOrderNo
  630 | }
  631 | 
  632 | async function completeRecheckThroughWeb(
  633 |   page: Page,
  634 |   context: BrowserContext,
  635 |   scenario: CrossTerminalScenario,
  636 |   chain: ChainEvidence,
  637 |   recheckOrderNo: string,
  638 | ): Promise<string> {
  639 |   await page.setViewportSize({ width: 1366, height: 768 })
  640 |   await setCurrentWebActor(page, 'PF-USER-RC-A')
  641 |   await page.goto('/fcs/craft/post-finishing/recheck-orders')
  642 |   await page.getByRole('button', { name: '领取复检单' }).click()
  643 |   await page.locator('[data-recheck-claim-task-no]').fill(recheckOrderNo)
  644 |   await page.getByRole('button', { name: '确认领取', exact: true }).click()
  645 |   await expect(page).toHaveURL(/\/fcs\/craft\/post-finishing\/recheck-orders\?id=/)
  646 |   await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
  647 | 
  648 |   if (scenario.recheckRelease) {
  649 |     page.once('dialog', (dialog) => dialog.accept())
  650 |     await page.getByRole('button', { name: '退领复检单' }).click()
  651 |     await expect(page.getByRole('status')).toContainText('已退回待复检')
  652 |     await page.goto('/fcs/craft/post-finishing/recheck-orders')
  653 |     await page.getByRole('button', { name: '领取复检单' }).click()
  654 |     await page.locator('[data-recheck-claim-task-no]').fill(recheckOrderNo)
  655 |     await page.getByRole('button', { name: '确认领取', exact: true }).click()
  656 |     await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
  657 |   }
  658 | 
  659 |   if (scenario.barcodeError) {
  660 |     await page.locator('[data-recheck-result-line]').first().locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('no')
  661 |     for (let index = 1; index < 5; index += 1) {
  662 |       await page.locator('[data-recheck-result-line]').nth(index).locator('[data-recheck-result-field="barcodeCorrect"]').selectOption('yes')
  663 |     }
  664 |     await page.getByRole('button', { name: '确认数量条码并生成后道出货单' }).click()
  665 |     await expect(page.getByRole('status')).toContainText('条码错误，已阻断出货')
  666 |     await page.locator('[data-recheck-result-line]').first().locator('[data-nav]').filter({ hasText: '打印重贴条码' }).click({ noWaitAfter: true })
  667 |     await expect(page.locator('[data-testid="post-finishing-sku-label-print"]')).toBeVisible()
  668 |     await expect(page.locator('[data-sku-label-barcode]')).toHaveAttribute('data-sku-label-barcode', await page.evaluate(async no => { const f = await import('/src/data/fcs/post-finishing-full-flow.ts'); return f.getPostFinishingFullFlowRecheckOrder(no)!.lines[0].sku.barcode }, recheckOrderNo))
  669 |     await page.goBack()
  670 |     await expect(page.locator('[data-recheck-result-line]')).toHaveCount(5)
  671 |     await page.locator('[data-recheck-result-line]').first().getByRole('button', { name: '已重新贴码' }).click()
  672 |     await expect(page.locator('body')).toContainText('已重贴待复扫')
  673 |     await saveScreenshot(page, chain, 'barcode-relabel-block')
  674 |   }
  675 | 
  676 |   for (let index = 0; index < 5; index += 1) {
```