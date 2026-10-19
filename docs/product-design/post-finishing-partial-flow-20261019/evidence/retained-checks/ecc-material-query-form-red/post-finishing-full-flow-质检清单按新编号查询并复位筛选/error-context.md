# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-full-flow.spec.ts >> 质检清单按新编号查询并复位筛选
- Location: tests/post-finishing-full-flow.spec.ts:1066:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('form[action="/fcs/craft/post-finishing/material-transfers"]').locator('input[name="keyword"]')

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
        - generic [ref=e481]:
          - button "质检清单" [ref=e483]
          - button "后道加工单" [ref=e485]
          - button "复检单" [ref=e487]
          - button "后道出货单" [ref=e489]
          - generic [ref=e490]:
            - button "后道辅料调拨单" [ref=e491]
            - button [ref=e492]:
              - img [ref=e493]
        - button "全部关闭" [ref=e498]
      - generic [ref=e503]:
        - heading "后道辅料调拨单" [level=1] [ref=e505]
        - generic [ref=e507]:
          - generic [ref=e508]:
            - text: 调拨单 / 生产单 / 款式 / 物料
            - textbox "调拨单 / 生产单 / 款式 / 物料" [ref=e509]
          - generic [ref=e510]:
            - text: 来源仓
            - combobox "来源仓" [ref=e511]:
              - option "全部" [selected]
              - option "辅料仓"
          - generic [ref=e512]:
            - text: 当前状态
            - combobox "当前状态" [ref=e513]:
              - option "全部" [selected]
              - option "申请调拨"
              - option "待调拨"
              - option "待入库"
              - option "已入库"
          - generic [ref=e514]:
            - text: 创建开始
            - textbox "创建开始" [ref=e515]
          - generic [ref=e516]:
            - text: 创建结束
            - textbox "创建结束" [ref=e517]
          - generic [ref=e518]:
            - button "查询" [ref=e519]
            - button "重置" [ref=e520]
        - generic [ref=e521]:
          - generic [ref=e522]:
            - generic [ref=e523]: 筛选调拨单
            - strong [ref=e524]: "5"
          - generic [ref=e525]:
            - generic [ref=e526]: 待调拨
            - strong [ref=e527]: "0"
          - generic [ref=e528]:
            - generic [ref=e529]: 待入库
            - strong [ref=e530]: "5"
          - generic [ref=e531]:
            - generic [ref=e532]: 已入库
            - strong [ref=e533]: "0"
        - generic [ref=e534]:
          - heading "调拨单列表" [level=2] [ref=e536]
          - table [ref=e539]:
            - rowgroup [ref=e547]:
              - row "调拨单 款式 来源 → 去向 整单数量 当前状态 操作" [ref=e548]:
                - columnheader "调拨单" [ref=e549]
                - columnheader "款式" [ref=e550]
                - columnheader "来源 → 去向" [ref=e551]
                - columnheader "整单数量" [ref=e552]
                - columnheader "当前状态" [ref=e553]
                - columnheader "操作" [ref=e554]
            - rowgroup [ref=e555]:
              - row "DB-PF-202608-005 PO-QC-202609-014 查看后道验收短款夹克大图 后道验收短款夹克 后道工厂负责 辅料仓 → 后道待加工仓 PF-MAT-B01-02 1,913 PCS 待入库 查看详情" [ref=e556]:
                - cell "DB-PF-202608-005 PO-QC-202609-014" [ref=e557]:
                  - strong [ref=e558]: DB-PF-202608-005
                  - paragraph [ref=e559]: PO-QC-202609-014
                - cell "查看后道验收短款夹克大图 后道验收短款夹克 后道工厂负责" [ref=e560]:
                  - generic [ref=e561]:
                    - button "查看后道验收短款夹克大图" [ref=e562]:
                      - img "后道验收短款夹克" [ref=e563]
                    - generic [ref=e564]:
                      - text: 后道验收短款夹克
                      - paragraph [ref=e565]: 后道工厂负责
                - cell "辅料仓 → 后道待加工仓 PF-MAT-B01-02" [ref=e566]:
                  - paragraph [ref=e567]: 辅料仓 → 后道待加工仓
                  - paragraph [ref=e568]: PF-MAT-B01-02
                - cell "1,913 PCS" [ref=e569]
                - cell "待入库" [ref=e570]:
                  - strong [ref=e571]: 待入库
                - cell "查看详情" [ref=e572]:
                  - button "查看详情" [ref=e573]
              - row "DB-PF-202608-004 PO-QC-202609-013 查看后道验收男士休闲衬衫大图 后道验收男士休闲衬衫 后道工厂负责 辅料仓 → 后道待加工仓 PF-MAT-B01-01 3,766 PCS 待入库 查看详情" [ref=e574]:
                - cell "DB-PF-202608-004 PO-QC-202609-013" [ref=e575]:
                  - strong [ref=e576]: DB-PF-202608-004
                  - paragraph [ref=e577]: PO-QC-202609-013
                - cell "查看后道验收男士休闲衬衫大图 后道验收男士休闲衬衫 后道工厂负责" [ref=e578]:
                  - generic [ref=e579]:
                    - button "查看后道验收男士休闲衬衫大图" [ref=e580]:
                      - img "后道验收男士休闲衬衫" [ref=e581]
                    - generic [ref=e582]:
                      - text: 后道验收男士休闲衬衫
                      - paragraph [ref=e583]: 后道工厂负责
                - cell "辅料仓 → 后道待加工仓 PF-MAT-B01-01" [ref=e584]:
                  - paragraph [ref=e585]: 辅料仓 → 后道待加工仓
                  - paragraph [ref=e586]: PF-MAT-B01-01
                - cell "3,766 PCS" [ref=e587]
                - cell "待入库" [ref=e588]:
                  - strong [ref=e589]: 待入库
                - cell "查看详情" [ref=e590]:
                  - button "查看详情" [ref=e591]
              - row "DB-PF-202608-003 PO-QC-202609-012 查看后道验收休闲连衣裙大图 后道验收休闲连衣裙 后道工厂负责 辅料仓 → 后道待加工仓 PF-MAT-A01-03 1,436 PCS 待入库 查看详情" [ref=e592]:
                - cell "DB-PF-202608-003 PO-QC-202609-012" [ref=e593]:
                  - strong [ref=e594]: DB-PF-202608-003
                  - paragraph [ref=e595]: PO-QC-202609-012
                - cell "查看后道验收休闲连衣裙大图 后道验收休闲连衣裙 后道工厂负责" [ref=e596]:
                  - generic [ref=e597]:
                    - button "查看后道验收休闲连衣裙大图" [ref=e598]:
                      - img "后道验收休闲连衣裙" [ref=e599]
                    - generic [ref=e600]:
                      - text: 后道验收休闲连衣裙
                      - paragraph [ref=e601]: 后道工厂负责
                - cell "辅料仓 → 后道待加工仓 PF-MAT-A01-03" [ref=e602]:
                  - paragraph [ref=e603]: 辅料仓 → 后道待加工仓
                  - paragraph [ref=e604]: PF-MAT-A01-03
                - cell "1,436 PCS" [ref=e605]
                - cell "待入库" [ref=e606]:
                  - strong [ref=e607]: 待入库
                - cell "查看详情" [ref=e608]:
                  - button "查看详情" [ref=e609]
              - row "DB-PF-202608-002 PO-QC-202609-011 查看后道验收针织开衫大图 后道验收针织开衫 后道工厂负责 辅料仓 → 后道待加工仓 PF-MAT-A01-02 1,674 PCS 待入库 查看详情" [ref=e610]:
                - cell "DB-PF-202608-002 PO-QC-202609-011" [ref=e611]:
                  - strong [ref=e612]: DB-PF-202608-002
                  - paragraph [ref=e613]: PO-QC-202609-011
                - cell "查看后道验收针织开衫大图 后道验收针织开衫 后道工厂负责" [ref=e614]:
                  - generic [ref=e615]:
                    - button "查看后道验收针织开衫大图" [ref=e616]:
                      - img "后道验收针织开衫" [ref=e617]
                    - generic [ref=e618]:
                      - text: 后道验收针织开衫
                      - paragraph [ref=e619]: 后道工厂负责
                - cell "辅料仓 → 后道待加工仓 PF-MAT-A01-02" [ref=e620]:
                  - paragraph [ref=e621]: 辅料仓 → 后道待加工仓
                  - paragraph [ref=e622]: PF-MAT-A01-02
                - cell "1,674 PCS" [ref=e623]
                - cell "待入库" [ref=e624]:
                  - strong [ref=e625]: 待入库
                - cell "查看详情" [ref=e626]:
                  - button "查看详情" [ref=e627]
              - row "DB-PF-202608-001 PO-QC-202608-001 查看后道验收衬衫大图 后道验收衬衫 后道工厂负责 辅料仓 → 后道待加工仓 PF-MAT-A01-01 2,995 PCS 待入库 查看详情" [ref=e628]:
                - cell "DB-PF-202608-001 PO-QC-202608-001" [ref=e629]:
                  - strong [ref=e630]: DB-PF-202608-001
                  - paragraph [ref=e631]: PO-QC-202608-001
                - cell "查看后道验收衬衫大图 后道验收衬衫 后道工厂负责" [ref=e632]:
                  - generic [ref=e633]:
                    - button "查看后道验收衬衫大图" [ref=e634]:
                      - img "后道验收衬衫" [ref=e635]
                    - generic [ref=e636]:
                      - text: 后道验收衬衫
                      - paragraph [ref=e637]: 后道工厂负责
                - cell "辅料仓 → 后道待加工仓 PF-MAT-A01-01" [ref=e638]:
                  - paragraph [ref=e639]: 辅料仓 → 后道待加工仓
                  - paragraph [ref=e640]: PF-MAT-A01-01
                - cell "2,995 PCS" [ref=e641]
                - cell "待入库" [ref=e642]:
                  - strong [ref=e643]: 待入库
                - cell "查看详情" [ref=e644]:
                  - button "查看详情" [ref=e645]
          - generic [ref=e647]:
            - paragraph [ref=e648]: 共 5 条，当前 1-5
            - generic [ref=e649]:
              - combobox [ref=e650]:
                - option "10 条/页" [selected]
                - option "20 条/页"
                - option "50 条/页"
              - button "上一页" [disabled] [ref=e651]
              - generic [ref=e652]: 1 / 1
              - button "下一页" [disabled] [ref=e653]
  - button "查生产" [ref=e654]:
    - img [ref=e655]
```

# Test source

```ts
  987  |   await expect(page.locator('main h1')).toHaveText('质检清单')
  988  |   await expect(page.locator('main [data-object-type="QC_ORDER"],main [data-object-type="PRODUCTION_ORDER"]')).toHaveCount(0)
  989  |   await expect(page.locator('main')).toContainText('生产主线关联待补')
  990  |   await expect(page.locator('main')).toContainText('MISSING-PRODUCTION-SOURCE')
  991  | })
  992  | 
  993  | async function observeEntryBusinessWrites(page: Page): Promise<void> {
  994  |   await page.addInitScript(() => {
  995  |     const writes: Array<{ database: string; store: string; method: string }> = []
  996  |     ;(window as any).__postEntryBusinessWrites = writes
  997  |     for (const method of ['add', 'put', 'delete', 'clear'] as const) {
  998  |       const original = IDBObjectStore.prototype[method]
  999  |       ;(IDBObjectStore.prototype as any)[method] = function (...args: unknown[]) {
  1000 |         writes.push({ database: this.transaction.db.name, store: this.name, method })
  1001 |         return (original as any).apply(this, args)
  1002 |       }
  1003 |     }
  1004 |   })
  1005 | }
  1006 | 
  1007 | test('后道仓库只读恢复PPIC来源，站内切换后保持部位票来源且不写业务记录', async ({ page }) => {
  1008 |   await observeEntryBusinessWrites(page)
  1009 |   const requests: string[] = []
  1010 |   page.on('request', request => requests.push(request.url()))
  1011 |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  1012 |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  1013 |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1014 |   expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
  1015 |   // 触发同一页面会话的原站内路由事件，验证一次性来源读取没有漏掉后续入口。
  1016 |   await page.evaluate(() => {
  1017 |     history.pushState({}, '', '/fcs/craft/post-finishing/work-orders')
  1018 |     window.dispatchEvent(new PopStateEvent('popstate'))
  1019 |   })
  1020 |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  1021 |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1022 |   await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  1023 |   expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
  1024 | })
  1025 | 
  1026 | test('执行质检只读恢复PPIC来源，打开生产关联入口保持当前任务', async ({ page }) => {
  1027 |   await observeEntryBusinessWrites(page)
  1028 |   const requests: string[] = []
  1029 |   page.on('request', request => requests.push(request.url()))
  1030 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  1031 |   await expect(page.locator('main h1')).toHaveText('执行质检')
  1032 |   await expect(page.locator('[data-qc-workbench-task]')).toBeVisible()
  1033 |   expect(requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1034 |   expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
  1035 |   const task = await page.locator('[data-qc-workbench-task]').getAttribute('data-qc-workbench-task')
  1036 |   await page.locator('[data-production-object-action]').first().click()
  1037 |   await expect.poll(() => requests.some(url => url.includes('/src/data/fcs/cutting/part-ticket-records.ts'))).toBe(true)
  1038 |   await expect(page.locator('[data-production-object-surface="search"]')).toBeVisible()
  1039 |   await expect(page.locator('[data-qc-workbench-task]')).toHaveAttribute('data-qc-workbench-task', task!)
  1040 |   expect(await page.evaluate(() => (window as any).__postEntryBusinessWrites)).toEqual([])
  1041 | })
  1042 | 
  1043 | test('后道命名页复用现有渲染器，其他生产入口按原方式读取', async ({ page }) => {
  1044 |   const requests: string[] = []
  1045 |   page.on('request', request => requests.push(request.url()))
  1046 |   await page.goto('/fcs/craft/post-finishing/qc-workbench')
  1047 |   await expect(page.locator('main h1')).toHaveText('执行质检')
  1048 |   await expect(page.locator('[data-qc-spu-color-images] img')).toHaveCount(5)
  1049 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1050 |   await page.goto('/fcs/craft/post-finishing/wait-process-warehouse')
  1051 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1052 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1053 |   await page.goto('/fcs/craft/post-finishing/work-orders/%50F-POST-PF-ACCEPT-PO-1-5')
  1054 |   await expect(page.locator('main h1')).toHaveText('后道加工单详情')
  1055 |   await expect(page.locator('main')).toContainText('PO-QC-202608-001-5-ZJ-HD')
  1056 |   expect(requests.some(url => url.includes('/src/router/routes-fcs'))).toBe(false)
  1057 |   await page.goto('/fcs/production/orders')
  1058 |   await expect(page.locator('main h1')).toHaveText('生产单管理')
  1059 |   expect(requests.some(url => url.includes('/src/pages/production/orders-domain'))).toBe(true)
  1060 |   for (const suffix of ['constructor', 'toString', '__proto__']) {
  1061 |     await page.goto(`/fcs/craft/post-finishing/${suffix}`)
  1062 |     await expect(page.locator('main h1')).toHaveText('页面未找到', { timeout: 5000 })
  1063 |   }
  1064 | })
  1065 | 
  1066 | test('质检清单按新编号查询并复位筛选', async ({ page }) => {
  1067 |   await page.goto('/fcs/craft/post-finishing/qc-orders')
  1068 |   await expect(page.locator('main h1')).toHaveText('质检清单')
  1069 |   const filters = page.locator('form[action="/fcs/craft/post-finishing/qc-orders"]')
  1070 |   await filters.locator('input[name="keyword"]').fill('NO-QC-MATCH-20261010')
  1071 |   await filters.getByRole('button', { name: '查询', exact: true }).click()
  1072 |   await expect(page).toHaveURL(/keyword=NO-QC-MATCH-20261010/, { timeout: 5000 })
  1073 |   await expect(page.locator('main')).toContainText('暂无符合条件的质检单')
  1074 |   await page.locator('form[action="/fcs/craft/post-finishing/qc-orders"] a[data-nav="/fcs/craft/post-finishing/qc-orders"]').click()
  1075 |   await expect(page).toHaveURL(/\/qc-orders$/)
  1076 |   await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  1077 |   await page.locator('input[name="keyword"]').fill('PO-QC-202608-001-4-ZJ')
  1078 |   await page.locator('main').getByRole('button', { name: '查询', exact: true }).click()
  1079 |   await expect(page).toHaveURL(/keyword=PO-QC-202608-001-4-ZJ/)
  1080 |   await expect(page.locator('main tbody tr')).toHaveCount(1)
  1081 |   await expect(page.locator('main tbody')).toContainText('PO-QC-202608-001-4-ZJ')
  1082 |   for (const list of ['work-orders', 'recheck-orders', 'outbound-orders', 'material-transfers']) {
  1083 |     const path = `/fcs/craft/post-finishing/${list}`
  1084 |     await page.goto(path)
  1085 |     await expect(page.locator('main h1')).toBeVisible()
  1086 |     const form = page.locator(`form[action="${path}"]`)
> 1087 |     await form.locator('input[name="keyword"]').fill('NO-POST-MATCH-20261010')
       |                                                 ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  1088 |     await form.getByRole('button', { name: '查询', exact: true }).click()
  1089 |     await expect(page).toHaveURL(/keyword=NO-POST-MATCH-20261010/)
  1090 |     await expect(page.locator('main tbody')).not.toContainText('PO-QC-')
  1091 |     await page.locator(`form[action="${path}"] a[data-nav="${path}"]`).click()
  1092 |     await expect(page).toHaveURL(new RegExp(`${list}$`))
  1093 |     await expect(page.locator('input[name="keyword"]')).toHaveValue('')
  1094 |   }
  1095 | })
  1096 | 
  1097 | test('仓库弹层跟随关联单据后关闭，返回列表可继续操作', async ({ page }) => {
  1098 |   const warehouse = '/fcs/craft/post-finishing/wait-process-warehouse'
  1099 |   await page.goto(warehouse)
  1100 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1101 |   await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  1102 |   const drawer = page.locator('[data-warehouse-inventory-drawer]')
  1103 |   await expect(drawer).toBeVisible()
  1104 |   await drawer.locator('a[data-nav*="deliveryId="]').first().click()
  1105 |   await expect(page.locator('[data-return-confirm-root]')).toBeVisible()
  1106 |   await page.locator('button[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns"]').click()
  1107 |   await expect(page).toHaveURL(/wait-process-warehouse\?tab=returns$/)
  1108 |   await expect(page.locator('[data-return-confirm-root]')).toHaveCount(0)
  1109 |   await expect(page.locator('[data-warehouse-inventory-drawer]')).toHaveCount(0, { timeout: 5000 })
  1110 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=movements"]').click()
  1111 |   await expect(page.getByRole('heading', { name: '流水记录', exact: true })).toBeVisible()
  1112 |   await page.locator('a[data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=materials"]').click()
  1113 |   await expect(page).toHaveURL(/wait-process-warehouse\?tab=materials$/)
  1114 |   await page.evaluate(async () => {
  1115 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  1116 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  1117 |     await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({
  1118 |       transferOrderNo: flow.listPostFinishingMaterialTransferOrders()[0].transferOrderNo,
  1119 |       actor: flow.POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
  1120 |     }))
  1121 |   })
  1122 |   await page.reload()
  1123 |   await page.locator('[data-post-finishing-action="full-flow-open-material-stock"]').first().click()
  1124 |   await expect(page.locator('[data-material-stock-drawer]')).toBeVisible()
  1125 |   await page.locator('[data-material-stock-drawer] a[data-nav]').click()
  1126 |   await expect(page).toHaveURL(/material-transfers\?transferId=/)
  1127 |   await page.evaluate((path) => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, `${warehouse}?tab=materials`)
  1128 |   await expect(page.locator('main h1')).toHaveText('后道待加工仓')
  1129 |   await expect(page.locator('[data-material-stock-drawer]')).toHaveCount(0)
  1130 |   await page.goto('/fcs/craft/post-finishing/wait-handover-warehouse')
  1131 |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  1132 |   await page.locator('[data-post-finishing-action="full-flow-open-stock"]').first().click()
  1133 |   await expect(drawer).toBeVisible()
  1134 |   await drawer.locator('a[data-nav*="recheck-orders"]').first().click()
  1135 |   await expect(page.locator('main h1')).toHaveText('复检单')
  1136 |   await page.evaluate(() => { history.pushState({}, '', '/fcs/craft/post-finishing/wait-handover-warehouse'); window.dispatchEvent(new PopStateEvent('popstate')) })
  1137 |   await expect(page.locator('main h1')).toHaveText('后道待交出仓')
  1138 |   await expect(drawer).toHaveCount(0)
  1139 | })
  1140 | 
```