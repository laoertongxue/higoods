# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-main-integration.spec.ts >> main integration: mixed legacy post-first-inline, atomic retry, original files and H/N continue
- Location: tests/post-finishing-main-integration.spec.ts:116:3

# Error details

```
Error: dialog.accept: Cannot accept dialog which is already handled!
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
          - button "后道加工单" [ref=e410]
          - generic [ref=e411]:
            - button "后道辅料调拨单" [ref=e412]
            - button [ref=e413]:
              - img [ref=e414]
        - button "全部关闭" [ref=e419]
      - generic [ref=e422]:
        - generic [ref=e423]:
          - generic [ref=e424]:
            - heading "后道加工单详情" [level=1] [ref=e425]
            - paragraph [ref=e426]: PO-QC-202608-001-1-ZJ-HD / PO-QC-202608-001
          - generic [ref=e427]:
            - generic [ref=e428]:
              - text: 原型操作身份
              - combobox "原型操作身份" [ref=e429]:
                - option "周后道操作员 · 后道操作员"
                - option "吴后道主管 · 后道主管" [selected]
            - button "切换身份" [active] [ref=e430]
            - generic [ref=e431]: 返回列表
        - status [ref=e432]: 历史承接已保存；原记录和已有复检占用保留，可继续剩余分项加工。
        - generic [ref=e433]:
          - strong [ref=e434]: 后道辅料未到齐。
          - text: 后道辅料尚未形成调拨单。现场核对后仍可登记加工。
        - generic [ref=e435]:
          - generic [ref=e436]:
            - generic [ref=e437]:
              - heading "PO-QC-202608-001-1-ZJ-HD" [level=2] [ref=e438]
              - generic [ref=e439]: 质检单 PO-QC-202608-001-1-ZJ · 回货单 PO-QC-202608-001-1
              - generic [ref=e440]: 实际加工链：开扣眼 → 装扣子 → 熨烫 → 包装
            - generic [ref=e441]:
              - generic [ref=e442]: 后道中
              - generic [ref=e443]: 当前录入人：吴后道主管
          - generic [ref=e444]:
            - generic [ref=e445]:
              - generic [ref=e446]: 应加工
              - generic [ref=e447]: 1000 件
            - generic [ref=e448]:
              - generic [ref=e449]: 全部后道完成
              - generic [ref=e450]: 400 件
            - generic [ref=e451]:
              - generic [ref=e452]: 已交复检
              - generic [ref=e453]: 400 件
            - generic [ref=e454]:
              - generic [ref=e455]: 可交复检
              - generic [ref=e456]: 0 件
          - paragraph [ref=e457]: 历史整套后道完成 400 件，未拆分为各项实际登记；新增分项仅记录剩余加工。
          - paragraph [ref=e458]: 历史承接核对：吴后道主管 · 2026/10/20 00:48:28；核对人不代表历史加工责任人。混合旧资料承接，H400明确，剩余各项从0继续
        - generic [ref=e459]:
          - heading "原合并加工记录" [level=3] [ref=e460]
          - paragraph [ref=e461]: 保留原结果与草稿，仅作历史依据；草稿不自动计入整套已完成量。
          - generic [ref=e462]:
            - generic [ref=e463]:
              - strong [ref=e464]: SPU-QC-001-01
              - text: · 原结果：已处理 400 件，未处理 600 件
              - generic [ref=e465]: 原未处理说明：明确旧合并表示
            - generic [ref=e466]:
              - strong [ref=e467]: SPU-QC-001-02
              - text: · 原结果：已处理 0 件，未处理 0 件
            - generic [ref=e468]:
              - strong [ref=e469]: SPU-QC-001-03
              - text: · 原结果：已处理 0 件，未处理 0 件
            - generic [ref=e470]:
              - strong [ref=e471]: SPU-QC-001-04
              - text: · 原结果：已处理 0 件，未处理 0 件
            - generic [ref=e472]:
              - strong [ref=e473]: SPU-QC-001-05
              - text: · 原结果：已处理 0 件，未处理 0 件
        - region "各加工项进度" [ref=e474]:
          - article [ref=e475]:
            - generic [ref=e476]:
              - heading "开扣眼" [level=3] [ref=e477]
              - generic [ref=e478]: 待加工
            - generic [ref=e479]: 新增 0 / 600 件
            - generic [ref=e480]: 本项可登记 600 件
            - button "登记开扣眼" [ref=e481]
          - article [ref=e482]:
            - generic [ref=e483]:
              - heading "装扣子" [level=3] [ref=e484]
              - generic [ref=e485]: 待加工
            - generic [ref=e486]: 新增 0 / 600 件
            - generic [ref=e487]: 本项可登记 0 件
            - paragraph [ref=e488]: 前序尚未有可登记数量
          - article [ref=e489]:
            - generic [ref=e490]:
              - heading "熨烫" [level=3] [ref=e491]
              - generic [ref=e492]: 待加工
            - generic [ref=e493]: 新增 0 / 600 件
            - generic [ref=e494]: 本项可登记 0 件
            - paragraph [ref=e495]: 前序尚未有可登记数量
          - article [ref=e496]:
            - generic [ref=e497]:
              - heading "包装" [level=3] [ref=e498]
              - generic [ref=e499]: 待加工
            - generic [ref=e500]: 新增 0 / 600 件
            - generic [ref=e501]: 本项可登记 0 件
            - paragraph [ref=e502]: 前序尚未有可登记数量
        - generic [ref=e503]:
          - heading "SKU加工进度 数量单位：件" [level=3] [ref=e504]
          - generic [ref=e505]:
            - article [ref=e506]:
              - generic [ref=e507]:
                - button "后道验收衬衫 SPU-QC-001-01 黑色 S" [ref=e508]:
                  - img "后道验收衬衫 SPU-QC-001-01 黑色 S" [ref=e509]
                - generic [ref=e510]:
                  - generic [ref=e511]: SPU-QC-001-01
                  - generic [ref=e512]: 后道验收衬衫 · 黑色 / S
                  - generic [ref=e513]: 应加工 1000 · 全部后道完成 400
              - generic [ref=e514]:
                - generic [ref=e515]:
                  - term [ref=e516]: 开扣眼
                  - definition [ref=e517]: 新增 0 / 600
                - generic [ref=e518]:
                  - term [ref=e519]: 装扣子
                  - definition [ref=e520]: 新增 0 / 600
                - generic [ref=e521]:
                  - term [ref=e522]: 熨烫
                  - definition [ref=e523]: 新增 0 / 600
                - generic [ref=e524]:
                  - term [ref=e525]: 包装
                  - definition [ref=e526]: 新增 0 / 600
                - generic [ref=e527]:
                  - term [ref=e528]: 已交复检
                  - definition [ref=e529]: "400"
                - generic [ref=e530]:
                  - term [ref=e531]: 可交复检
                  - definition [ref=e532]: "0"
            - article [ref=e533]:
              - generic [ref=e534]:
                - button "后道验收衬衫 SPU-QC-001-02 白色 M" [ref=e535]:
                  - img "后道验收衬衫 SPU-QC-001-02 白色 M" [ref=e536]
                - generic [ref=e537]:
                  - generic [ref=e538]: SPU-QC-001-02
                  - generic [ref=e539]: 后道验收衬衫 · 白色 / M
                  - generic [ref=e540]: 应加工 0 · 全部后道完成 0
              - generic [ref=e541]:
                - generic [ref=e542]:
                  - term [ref=e543]: 开扣眼
                  - definition [ref=e544]: 0 / 0
                - generic [ref=e545]:
                  - term [ref=e546]: 装扣子
                  - definition [ref=e547]: 0 / 0
                - generic [ref=e548]:
                  - term [ref=e549]: 熨烫
                  - definition [ref=e550]: 0 / 0
                - generic [ref=e551]:
                  - term [ref=e552]: 包装
                  - definition [ref=e553]: 0 / 0
                - generic [ref=e554]:
                  - term [ref=e555]: 已交复检
                  - definition [ref=e556]: "0"
                - generic [ref=e557]:
                  - term [ref=e558]: 可交复检
                  - definition [ref=e559]: "0"
            - article [ref=e560]:
              - generic [ref=e561]:
                - button "后道验收衬衫 SPU-QC-001-03 雾蓝 L" [ref=e562]:
                  - img "后道验收衬衫 SPU-QC-001-03 雾蓝 L" [ref=e563]
                - generic [ref=e564]:
                  - generic [ref=e565]: SPU-QC-001-03
                  - generic [ref=e566]: 后道验收衬衫 · 雾蓝 / L
                  - generic [ref=e567]: 应加工 0 · 全部后道完成 0
              - generic [ref=e568]:
                - generic [ref=e569]:
                  - term [ref=e570]: 开扣眼
                  - definition [ref=e571]: 0 / 0
                - generic [ref=e572]:
                  - term [ref=e573]: 装扣子
                  - definition [ref=e574]: 0 / 0
                - generic [ref=e575]:
                  - term [ref=e576]: 熨烫
                  - definition [ref=e577]: 0 / 0
                - generic [ref=e578]:
                  - term [ref=e579]: 包装
                  - definition [ref=e580]: 0 / 0
                - generic [ref=e581]:
                  - term [ref=e582]: 已交复检
                  - definition [ref=e583]: "0"
                - generic [ref=e584]:
                  - term [ref=e585]: 可交复检
                  - definition [ref=e586]: "0"
            - article [ref=e587]:
              - generic [ref=e588]:
                - button "后道验收衬衫 SPU-QC-001-04 卡其 XL" [ref=e589]:
                  - img "后道验收衬衫 SPU-QC-001-04 卡其 XL" [ref=e590]
                - generic [ref=e591]:
                  - generic [ref=e592]: SPU-QC-001-04
                  - generic [ref=e593]: 后道验收衬衫 · 卡其 / XL
                  - generic [ref=e594]: 应加工 0 · 全部后道完成 0
              - generic [ref=e595]:
                - generic [ref=e596]:
                  - term [ref=e597]: 开扣眼
                  - definition [ref=e598]: 0 / 0
                - generic [ref=e599]:
                  - term [ref=e600]: 装扣子
                  - definition [ref=e601]: 0 / 0
                - generic [ref=e602]:
                  - term [ref=e603]: 熨烫
                  - definition [ref=e604]: 0 / 0
                - generic [ref=e605]:
                  - term [ref=e606]: 包装
                  - definition [ref=e607]: 0 / 0
                - generic [ref=e608]:
                  - term [ref=e609]: 已交复检
                  - definition [ref=e610]: "0"
                - generic [ref=e611]:
                  - term [ref=e612]: 可交复检
                  - definition [ref=e613]: "0"
            - article [ref=e614]:
              - generic [ref=e615]:
                - button "后道验收衬衫 SPU-QC-001-05 酒红 2XL" [ref=e616]:
                  - img "后道验收衬衫 SPU-QC-001-05 酒红 2XL" [ref=e617]
                - generic [ref=e618]:
                  - generic [ref=e619]: SPU-QC-001-05
                  - generic [ref=e620]: 后道验收衬衫 · 酒红 / 2XL
                  - generic [ref=e621]: 应加工 0 · 全部后道完成 0
              - generic [ref=e622]:
                - generic [ref=e623]:
                  - term [ref=e624]: 开扣眼
                  - definition [ref=e625]: 0 / 0
                - generic [ref=e626]:
                  - term [ref=e627]: 装扣子
                  - definition [ref=e628]: 0 / 0
                - generic [ref=e629]:
                  - term [ref=e630]: 熨烫
                  - definition [ref=e631]: 0 / 0
                - generic [ref=e632]:
                  - term [ref=e633]: 包装
                  - definition [ref=e634]: 0 / 0
                - generic [ref=e635]:
                  - term [ref=e636]: 已交复检
                  - definition [ref=e637]: "0"
                - generic [ref=e638]:
                  - term [ref=e639]: 可交复检
                  - definition [ref=e640]: "0"
        - generic [ref=e641]:
          - heading "复检与出货记录" [level=3] [ref=e642]
          - article [ref=e644]:
            - generic [ref=e645]:
              - generic [ref=e646]: PO-QC-202608-001-1-ZJ-HD-FJ-001
              - generic [ref=e647]: 待复检
            - generic [ref=e648]: 本次交复检 400 件
            - generic [ref=e649]: 复检完成后生成本次出货单
        - generic [ref=e650]:
          - heading "加工登记记录 0 次" [level=3] [ref=e651]
          - paragraph [ref=e653]: 尚无逐项登记记录。
  - button "查生产" [ref=e654]:
    - img [ref=e655]
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test'
  2   | import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
  3   | import { resolve } from 'node:path'
  4   | import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'
  5   | 
  6   | const namespace = 'higood-fcs-post-finishing-records'
  7   | const oldKey = 'higood-fcs-post-finishing-full-flow-v1'
  8   | const evidence = `${process.env.POST_FINISHING_EVIDENCE_ROOT || 'docs/product-design/post-finishing-partial-flow-20261019/evidence'}/main-integration-browser`
  9   | const postFixture = JSON.parse(readFileSync('tests/fixtures/accessory-warehouse/post.json', 'utf8'))
  10  | const legacyMaterials = JSON.parse(readFileSync('tests/fixtures/accessory-warehouse/postLegacy.json', 'utf8'))
  11  | const legacyMaterialRows = legacyMaterials.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((s: any) => s.name === 'records').rows.filter((row: any) => /flow\/material(TransferOrders|Stocks)$/.test(row.value.collection))
  12  | const legacyFile = legacyMaterials.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((s: any) => s.name === 'files').rows[0].value
  13  | 
  14  | // Frozen AW initial states are main's isolated input fixtures, not upstream
  15  | // factory operation evidence. All garment facts below use public commands.
  16  | async function installFixture(page: Page, fixture: any): Promise<void> {
  17  |   await page.route('**/__post-main-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  18  |   await page.goto('/__post-main-fixture')
  19  |   await page.evaluate(async fixture => {
  20  |     function decode(value: any): any {
  21  |       if (value?.__fixtureType === 'Blob') return new Blob([new Uint8Array(value.bytes)], { type: value.type })
  22  |       if (Array.isArray(value)) return value.map(decode)
  23  |       if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]))
  24  |       return value
  25  |     }
  26  |     if ((await indexedDB.databases()).length) throw new Error('integration input requires an isolated empty context')
  27  |     for (const info of fixture.databases) {
  28  |       const db = await new Promise<IDBDatabase>((ok, fail) => {
  29  |         const request = indexedDB.open(info.name, info.version)
  30  |         request.onupgradeneeded = () => { for (const s of info.stores) { const store = request.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const index of s.indexes || []) store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry }) } }
  31  |         request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error)
  32  |       })
  33  |       const tx = db.transaction(info.stores.map((s: any) => s.name), 'readwrite')
  34  |       const done = new Promise<void>((ok, fail) => { tx.oncomplete = () => ok(); tx.onabort = () => fail(tx.error) })
  35  |       for (const s of info.stores) for (const row of s.rows) { const store = tx.objectStore(s.name); store.keyPath === null ? store.put(decode(row.value), decode(row.key)) : store.put(decode(row.value)) }
  36  |       await done; db.close()
  37  |     }
  38  |     for (const [key, value] of Object.entries(fixture.localStorage || {})) localStorage.setItem(key, String(value))
  39  |   }, fixture)
  40  | }
  41  | 
  42  | function legacyGarment() {
  43  |   flow.resetPostFinishingFullFlow()
  44  |   const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0], original = source.skus[0].plannedQty, actor = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  45  |   try {
  46  |     source.skus[0].plannedQty = 1000
  47  |     const delivery = flow.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 1, triggerSource: '车缝正常交出', idempotencyKey: 'MIXED-LEGACY-INPUT', quantities: source.skus.map((sku, i) => ({ skuId: sku.skuId, registeredQty: i ? 0 : 1000 })), deliveryPersonName: '混合迁移隔离送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: actor.factoryCourier })
  48  |     flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: actor.returnConfirmer })
  49  |     const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actor.sender })
  50  |     flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actor.qcA })
  51  |     const complete = flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: actor.qcA, processItems: [...flow.POST_FINISHING_PROCESS_ITEMS], results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })) })
  52  |     const parent = flow.getPostFinishingFullFlowPostTask(complete.postTaskId!)!
  53  |     for (const processItem of flow.POST_FINISHING_PROCESS_ITEMS) flow.appendPostFinishingProcessCompletion({ postTaskId: parent.postTaskId, processItem, quantities: [{ skuId: source.skus[0].skuId, quantity: 400 }], responsible: actor.postOperator, actor: actor.postOperator, operationId: `MIXED-OLD-${processItem}` })
  54  |     const rc: any = flow.submitPostFinishingForRecheck({ postTaskId: parent.postTaskId, quantities: [{ skuId: source.skus[0].skuId, quantity: 400 }], actor: actor.postOperator, operationId: 'MIXED-OLD-RC' })
  55  |     delete rc.operationId; delete rc.operationIntent; delete rc.sequence
  56  |     const oldParent: any = { ...parent, executionModel: undefined, processItems: ['烫包'], status: '后道完成', recheckOrderId: rc.recheckOrderId, recheckOrderNo: rc.recheckOrderNo, results: parent.lines.map((line, i) => ({ ...line, processedQty: i ? 0 : 400, unprocessedQty: i ? 0 : 600, unprocessedReason: i ? undefined : '明确旧合并表示' })) }
  57  |     const snapshot: any = { schemaVersion: 2, deliveries: [flow.getPostFinishingFactoryReturn(delivery.deliveryId)], qcTasks: [flow.getPostFinishingFullFlowQcTask(qc.qcTaskId)], postTasks: [oldParent], recheckOrders: [rc], outboundOrders: [], warehouseReceipts: [], waitProcessWarehouseRecords: flow.listPostFinishingWaitProcessWarehouseRecords(), waitProcessWarehouseMovements: flow.listPostFinishingWaitProcessWarehouseMovements(), waitHandoverWarehouseRecords: [], waitHandoverWarehouseMovements: [], returnConfirmationVersions: flow.listPostFinishingReturnConfirmationVersions(), defects: [], materialTransferOrders: [], materialStocks: [] }
  58  |     return { snapshot, parentId: parent.postTaskId, skuId: source.skus[0].skuId, oldRecheckId: rc.recheckOrderId }
  59  |   } finally { source.skus[0].plannedQty = original }
  60  | }
  61  | 
  62  | async function durable(page: Page) {
  63  |   return page.evaluate(async () => {
  64  |     const pcs = await (await import('/src/data/pcs-record-db.ts')).readPcsRecords(['higood-fcs-post-finishing-records'])
  65  |     const accessory = await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()
  66  |     const cutting = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
  67  |     const files = async (rows: any[]) => Promise.all(rows.map(async row => ({ id: row.id, type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) })))
  68  |     return { pcs: { records: pcs.records, files: await files(pcs.files) }, accessory: { records: accessory.records, files: await files(cutting.files) } }
  69  |   })
  70  | }
  71  | async function migrateGarment(page: Page) {
  72  |   page.once('dialog', dialog => dialog.accept())
  73  |   await page.locator('[data-post-finishing-action="storage-migrate"]').click()
  74  | }
  75  | async function archiveAccessory(page: Page) {
  76  |   await page.goto('/fcs/craft/post-finishing/material-transfers')
  77  |   await expect(page.locator('[data-post-material-root]')).toBeVisible()
  78  |   const button = page.locator('[data-post-finishing-material-transfers-action="migrate"]')
  79  |   if (await button.count()) { page.once('dialog', dialog => dialog.accept()); await button.click() }
  80  |   await expect(page.locator('[data-post-material-migration]')).toContainText('已完成')
  81  | }
  82  | async function materialReadback(page: Page) {
  83  |   return page.evaluate(async () => {
  84  |     const auxiliary = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
  85  |     await auxiliary.prepareAccessoryPostFinishing()
  86  |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  87  |     const backup = auxiliary.readLegacyAccessoryPostBackup()
  88  |     return { inspection: auxiliary.inspectLegacyAccessoryPostMigration(), sourceKeys: backup.sources.map(row => ({ key: row.key, fingerprint: row.fingerprint })), stocks: flow.listPostFinishingMaterialStocks().filter(row => row.transferOrderId === 'OLD-POST-1'), transfer: flow.getPostFinishingMaterialTransferOrder('OLD-POST-1') }
  89  |   })
  90  | }
  91  | async function carryAndContinue(page: Page, input: ReturnType<typeof legacyGarment>) {
  92  |   await page.goto(`/fcs/craft/post-finishing/work-orders/${input.parentId}`)
  93  |   await page.locator('[data-post-prototype-actor]').selectOption('PF-USER-POST-MGR')
  94  |   await page.locator('[data-post-finishing-work-order-detail-action="switch-actor"]').click()
  95  |   await page.locator('[data-post-finishing-work-order-detail-action="open-legacy"]').click()
  96  |   for (const item of flow.POST_FINISHING_PROCESS_ITEMS) await page.locator(`[data-post-legacy-process-item][value="${item}"]`).check()
  97  |   for (const item of flow.POST_FINISHING_PROCESS_ITEMS) for (const field of await page.locator(`[data-post-legacy-baseline="${item}"]`).all()) await field.fill('0')
  98  |   await page.locator('[data-post-entry-reason]').fill('混合旧资料承接，H400明确，剩余各项从0继续')
> 99  |   page.once('dialog', dialog => dialog.accept())
      |                                        ^ Error: dialog.accept: Cannot accept dialog which is already handled!
  100 |   await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  101 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  102 |   return page.evaluate(async ({ parentId, skuId }) => {
  103 |     const r = await import('/src/data/fcs/post-finishing-records.ts'), f = await import('/src/data/fcs/post-finishing-full-flow.ts'), a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  104 |     for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: parentId, processItem: item, quantities: [{ skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `MIXED-CONTINUE-${item}` }))
  105 |     const child = await r.runPostFinishingCommand(() => f.submitPostFinishingForRecheck({ postTaskId: parentId, quantities: [{ skuId, quantity: 100 }], actor: a.postOperator, operationId: 'MIXED-CONTINUE-RC' }))
  106 |     return { progress: f.getPostFinishingProcessProgress(parentId), child, children: f.listPostFinishingFullFlowRecheckOrders().filter(row => row.postTaskId === parentId) }
  107 |   }, input)
  108 | }
  109 | async function artifact(page: Page, name: string, value: unknown) {
  110 |   mkdirSync(evidence, { recursive: true })
  111 |   writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(value, null, 2))
  112 |   await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true })
  113 | }
  114 | 
  115 | for (const order of ['post-first-inline', 'accessory-first-existing-pcs'] as const) {
  116 |   test(`main integration: mixed legacy ${order}, atomic retry, original files and H/N continue`, async ({ page }) => {
  117 |     test.setTimeout(90000)
  118 |     const input = legacyGarment(), fixture = structuredClone(legacyMaterials)
  119 |     const originals = structuredClone(legacyMaterialRows.map((row: any) => row.value))
  120 |     for (const row of originals) input.snapshot[row.collection.split('/')[1]].push(row.value)
  121 |     if (order === 'post-first-inline') {
  122 |       const inline = `data:image/jpeg;base64,${readFileSync('public/materials/accessory-zipper.jpg').toString('base64')}`
  123 |       input.snapshot.materialTransferOrders[0].lines[0].imageUrl = inline
  124 |       input.snapshot.materialStocks[0].material.imageUrl = inline
  125 |       fixture.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((store: any) => store.name === 'records').rows = fixture.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((store: any) => store.name === 'records').rows.filter((row: any) => !/flow\/material(TransferOrders|Stocks)$/.test(row.value.collection))
  126 |     }
  127 |     await installFixture(page, fixture)
  128 |     const raw = JSON.stringify(input.snapshot)
  129 |     await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw })
  130 |     if (order === 'accessory-first-existing-pcs') await archiveAccessory(page)
  131 |     await page.goto('/fcs/craft/post-finishing/work-orders')
  132 |     await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
  133 |     const before = await durable(page)
  134 |     await page.evaluate(() => { (window as any).__mixedOriginalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value: any, ...args: any[]) { if (this.name === 'records' && String(value?.id).startsWith('higood-fcs-post-finishing-records/')) throw new DOMException('mixed migration abort', 'QuotaExceededError'); return (window as any).__mixedOriginalPut.call(this, value, ...args) } })
  135 |     await migrateGarment(page)
  136 |     await expect(page.locator('[data-post-finishing-storage-notice]')).toContainText('本次未保存')
  137 |     expect(await durable(page)).toEqual(before)
  138 |     expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBe(raw)
  139 |     await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__mixedOriginalPut })
  140 |     await migrateGarment(page)
  141 |     await expect(page.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
  142 |     expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBeNull()
  143 |     const migrated = await durable(page)
  144 |     const originalPcs = (value: typeof migrated) => value.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection))
  145 |     expect(originalPcs(migrated)).toEqual(originalPcs(before))
  146 |     expect(migrated.accessory).toEqual(before.accessory)
  147 |     expect(migrated.pcs.records.some(row => row.collection === 'archive' && String(row.id).includes(encodeURIComponent(oldKey)))).toBe(true)
  148 |     await archiveAccessory(page)
  149 |     const material = await materialReadback(page)
  150 |     expect(material.inspection.state).toBe('已完成')
  151 |     expect(material.stocks).toHaveLength(1)
  152 |     expect(material.stocks[0].currentQty).toBe(7)
  153 |     expect(material.stocks[0].inboundQty).toBe(10)
  154 |     const afterArchive = await durable(page)
  155 |     await page.reload(); await expect(page.locator('[data-post-material-root]')).toBeVisible()
  156 |     expect(await materialReadback(page)).toEqual(material)
  157 |     expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  158 |     if (order === 'post-first-inline') {
  159 |       // Same LS source version plus its converted archive must deduplicate.
  160 |       await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw })
  161 |       expect((await materialReadback(page)).sourceKeys).toEqual(material.sourceKeys)
  162 |       const altered = JSON.parse(raw); altered.materialStocks[0].currentQty = 6
  163 |       await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw: JSON.stringify(altered) })
  164 |       const blocked = await page.evaluate(async () => { try { await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing(); return '' } catch (error) { return String(error) } })
  165 |       expect(blocked).toContain('不一致')
  166 |       expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  167 |       await page.evaluate(key => localStorage.removeItem(key), oldKey)
  168 |       await materialReadback(page)
  169 |     }
  170 |     const continued = await carryAndContinue(page, input)
  171 |     expect(continued.progress.totalCompletedQty).toBe(500)
  172 |     expect(continued.children).toHaveLength(2)
  173 |     expect(continued.children.some(child => child.recheckOrderId === input.oldRecheckId)).toBe(true)
  174 |     expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  175 |     await artifact(page, order, { inputBoundary: 'public garment source encoded schema2 plus main frozen AW fixture; isolated prototype only', material, continued, durable: await durable(page) })
  176 |   })
  177 | }
  178 | 
  179 | async function publicPostTask(page: Page) {
  180 |   return page.evaluate(async () => {
  181 |     const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts')
  182 |     const source = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0], prior = source.skus[0].plannedQty, a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  183 |     source.skus[0].plannedQty = prior + 1000
  184 |     try {
  185 |       const d = await r.runPostFinishingCommand(() => f.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 77, triggerSource: '车缝正常交出', idempotencyKey: 'INTEGRATED-BACKUP-SOURCE', quantities: source.skus.map((sku, i) => ({ skuId: sku.skuId, registeredQty: i ? 0 : 1000 })), deliveryPersonName: '整合备份隔离送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: a.factoryCourier }))
  186 |       await r.runPostFinishingCommand(() => f.confirmPostFinishingFactoryReturn({ deliveryId: d.deliveryId, firstCounts: d.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: a.returnConfirmer }))
  187 |       const qc = await r.runPostFinishingCommand(() => f.sendPostFinishingFactoryReturnToQc({ deliveryId: d.deliveryId, actor: a.sender }))
  188 |       await r.runPostFinishingCommand(() => f.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: a.qcA }))
  189 |       const result = await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: a.qcA, processItems: [...f.POST_FINISHING_PROCESS_ITEMS], results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })) }))
  190 |       for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: result.postTaskId!, processItem: item, quantities: [{ skuId: source.skus[0].skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `INTEGRATED-BACKUP-${item}` }))
  191 |       return { parentId: result.postTaskId!, skuId: source.skus[0].skuId }
  192 |     } finally { source.skus[0].plannedQty = prior }
  193 |   })
  194 | }
  195 | 
  196 | async function importBackup(page: Page, value: unknown, name = '混合旧备份.json') {
  197 |   await page.locator('[data-post-finishing-field="storage-import"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  198 | }
  199 | 
```