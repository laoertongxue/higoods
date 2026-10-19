# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-migration.spec.ts >> A20: schema2 IndexedDB marker upgrade writes no static seeds or invented completion records
- Location: tests/post-finishing-migration.spec.ts:121:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-post-finishing-action="storage-migrate"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-post-finishing-action="storage-migrate"]')

```

```yaml
- banner:
  - text: HG HiGood
  - button "商品中心系统 (PCS)"
  - button "采购管理系统 (PMS)"
  - button "工厂生产协同系统 (FCS)"
  - button "工艺工厂运营系统 (PFOS)"
  - button "仓储物流系统 (WLS)"
  - button "直播运营系统 (LOS)"
  - button "订单管理系统 (OMS)"
  - button "业财一体化系统 (BFIS)"
  - button "数据决策系统 (DDS)"
  - button "通知":
    - img
  - button "管理员":
    - img
    - text: 管理员
    - img
- complementary:
  - heading "工艺工厂运营系统" [level=2]
  - paragraph: PFOS
  - button "收起菜单":
    - img
  - button "裁床厂管理" [expanded]:
    - img
    - text: 裁床厂管理
    - img
  - button "裁床总览":
    - img
    - text: 裁床总览
    - img
  - button "裁前准备":
    - img
    - text: 裁前准备
    - img
  - button "接收管理":
    - img
    - text: 接收管理
    - img
  - button "铺布执行":
    - img
    - text: 铺布执行
    - img
  - button "裁后处理":
    - img
    - text: 裁后处理
    - img
  - button "裁床仓库管理":
    - img
    - text: 裁床仓库管理
    - img
  - button "裁床统计":
    - img
    - text: 裁床统计
    - img
  - button "印花厂管理" [expanded]:
    - img
    - text: 印花厂管理
    - img
  - button "印花管理":
    - img
    - text: 印花管理
    - img
  - button "染厂管理" [expanded]:
    - img
    - text: 染厂管理
    - img
  - button "染厂管理":
    - img
    - text: 染厂管理
    - img
  - button "毛织厂管理" [expanded]:
    - img
    - text: 毛织厂管理
    - img
  - button "毛织管理":
    - img
    - text: 毛织管理
    - img
  - button "辅料工厂管理" [expanded]:
    - img
    - text: 辅料工厂管理
    - img
  - button "花边厂管理":
    - text: 花边厂管理
    - img
  - button "织带厂管理":
    - img
    - text: 织带厂管理
    - img
  - button "后道工厂管理" [expanded]:
    - img
    - text: 后道工厂管理
    - img
  - button "后道工厂管理":
    - img
    - text: 后道工厂管理
    - img
  - button "后道生产任务":
    - img
    - text: 后道生产任务
  - button "后道辅料调拨单":
    - img
    - text: 后道辅料调拨单
  - button "执行质检":
    - img
    - text: 执行质检
  - button "质检清单":
    - img
    - text: 质检清单
  - button "后道加工单":
    - img
    - text: 后道加工单
  - button "复检单":
    - img
    - text: 复检单
  - button "后道待加工仓":
    - img
    - text: 后道待加工仓
  - button "后道待交出仓":
    - img
    - text: 后道待交出仓
  - button "后道出货单":
    - img
    - text: 后道出货单
  - button "差异与操作日志":
    - img
    - text: 差异与操作日志
  - button "我的动态授权码":
    - img
    - text: 我的动态授权码
  - button "成衣 SPU 替换":
    - img
    - text: 成衣 SPU 替换
  - button "辅助工艺工厂管理" [expanded]:
    - img
    - text: 辅助工艺工厂管理
    - img
  - button "打揽加工单":
    - img
    - text: 打揽加工单
  - button "打条加工单":
    - img
    - text: 打条加工单
  - button "烫画加工单":
    - img
    - text: 烫画加工单
  - button "直喷加工单":
    - img
    - text: 直喷加工单
  - button "布包扣加工单":
    - img
    - text: 布包扣加工单
  - button "绣花加工单":
    - img
    - text: 绣花加工单
  - button "压褶加工单":
    - img
    - text: 压褶加工单
  - button "缝边绣加工单":
    - img
    - text: 缝边绣加工单
  - button "盘扣加工单":
    - img
    - text: 盘扣加工单
  - button "花朵加工单":
    - img
    - text: 花朵加工单
  - button "打褶加工单":
    - img
    - text: 打褶加工单
  - button "烫钻加工单":
    - img
    - text: 烫钻加工单
  - button "辅助工艺待加工仓":
    - img
    - text: 辅助工艺待加工仓
  - button "辅助工艺待交出仓":
    - img
    - text: 辅助工艺待交出仓
  - button "特种工艺工厂管理" [expanded]:
    - img
    - text: 特种工艺工厂管理
    - img
  - button "模板工序加工单":
    - img
    - text: 模板工序加工单
  - button "激光开袋加工单":
    - img
    - text: 激光开袋加工单
  - button "特种车缝（花样机）加工单":
    - img
    - text: 特种车缝（花样机）加工单
  - button "橡筋定长切割加工单":
    - img
    - text: 橡筋定长切割加工单
  - button "特种工艺待加工仓":
    - img
    - text: 特种工艺待加工仓
  - button "特种工艺待交出仓":
    - img
    - text: 特种工艺待交出仓
- main:
  - button "后道加工单"
  - button:
    - img
  - button "全部关闭"
  - status:
    - paragraph: 后道用户资料无法读取或保存。加工单与原回货或质检身份不一致，资料未恢复。
    - button "重新读取"
  - heading "后道加工单" [level=1]
  - button "登记加工"
  - text: 关键词
  - textbox "关键词":
    - /placeholder: 后道加工单/质检单/生产单/款式/后道项目
  - text: 当前状态
  - combobox "当前状态":
    - option "全部" [selected]
    - option "待后道"
    - option "后道中"
    - option "后道完成"
  - text: 后道项目
  - combobox "后道项目":
    - option "全部" [selected]
    - option "开扣眼"
    - option "装扣子"
    - option "熨烫"
    - option "包装"
  - text: 工厂
  - combobox "工厂":
    - option "全部" [selected]
    - option "PT Prima Printing Center"
  - text: 重置
  - button "查询"
  - text: 后道加工单
  - strong: 3 张
  - text: 等待后道
  - strong: 1 张
  - text: 后道中
  - strong: 0 张
  - text: 尚未完成后道
  - strong: 84 件
  - table:
    - rowgroup:
      - row "单据 工厂 SKU 明细 任务范围 / 后道项目 辅料到位 总数量 开扣眼完成 装扣子完成 熨烫完成 包装完成 全部后道完成 尚未完成后道 可交复检 复检 / 出货进度 后道状态 时间 操作":
        - columnheader "单据"
        - columnheader "工厂"
        - columnheader "SKU 明细"
        - columnheader "任务范围 / 后道项目"
        - columnheader "辅料到位"
        - columnheader "总数量"
        - columnheader "开扣眼完成"
        - columnheader "装扣子完成"
        - columnheader "熨烫完成"
        - columnheader "包装完成"
        - columnheader "全部后道完成"
        - columnheader "尚未完成后道"
        - columnheader "可交复检"
        - columnheader "复检 / 出货进度"
        - columnheader "后道状态"
        - columnheader "时间"
        - columnheader "操作"
    - rowgroup:
      - row "加工单：PO-QC-202608-001-5-ZJ-HD 质检：PO-QC-202608-001-5-ZJ 生产：PO-QC-202608-001 第 5 次回货 · PO-QC-202608-001-5 来源：CV Micro Sewing Jakarta Pusat 后道：PT Prima Printing Center 后道验收衬衫 黑色 S SPU-QC-001-01 黑色 / S · 10 件 后道验收衬衫 白色 M SPU-QC-001-02 白色 / M · 14 件 后道验收衬衫 雾蓝 L SPU-QC-001-03 雾蓝 / L · 20 件 后道验收衬衫 卡其 XL SPU-QC-001-04 卡其 / XL · 20 件 后道验收衬衫 酒红 2XL SPU-QC-001-05 酒红 / 2XL · 20 件 仅车缝 · 后道工厂负责 来源：任务后道 开扣眼 装扣子 熨烫 包装 待入库 仅提示，不阻断开工 DB-PF-202608-001 84 件 0 / 84 0 / 84 0 / 84 0 / 84 0 件 84 件 0 件 已交复检 0 件 · 0 张 待复检 0 件 待接收 0 / 已接收 0 件 · 0 张 待后道 创建：2026/8/25 14:40:00 开始：— 完成：— 登记加工 查看记录 打印加工单 查看全流程":
        - cell "加工单：PO-QC-202608-001-5-ZJ-HD 质检：PO-QC-202608-001-5-ZJ 生产：PO-QC-202608-001 第 5 次回货 · PO-QC-202608-001-5":
          - text: 加工单：
          - strong: PO-QC-202608-001-5-ZJ-HD
          - text: 质检：PO-QC-202608-001-5-ZJ 生产：PO-QC-202608-001 第 5 次回货 · PO-QC-202608-001-5
        - cell "来源：CV Micro Sewing Jakarta Pusat 后道：PT Prima Printing Center"
        - cell "后道验收衬衫 黑色 S SPU-QC-001-01 黑色 / S · 10 件 后道验收衬衫 白色 M SPU-QC-001-02 白色 / M · 14 件 后道验收衬衫 雾蓝 L SPU-QC-001-03 雾蓝 / L · 20 件 后道验收衬衫 卡其 XL SPU-QC-001-04 卡其 / XL · 20 件 后道验收衬衫 酒红 2XL SPU-QC-001-05 酒红 / 2XL · 20 件":
          - button "后道验收衬衫 黑色 S":
            - img "后道验收衬衫 黑色 S"
          - text: SPU-QC-001-01 黑色 / S · 10 件
          - button "后道验收衬衫 白色 M":
            - img "后道验收衬衫 白色 M"
          - text: SPU-QC-001-02 白色 / M · 14 件
          - button "后道验收衬衫 雾蓝 L":
            - img "后道验收衬衫 雾蓝 L"
          - text: SPU-QC-001-03 雾蓝 / L · 20 件
          - button "后道验收衬衫 卡其 XL":
            - img "后道验收衬衫 卡其 XL"
          - text: SPU-QC-001-04 卡其 / XL · 20 件
          - button "后道验收衬衫 酒红 2XL":
            - img "后道验收衬衫 酒红 2XL"
          - text: SPU-QC-001-05 酒红 / 2XL · 20 件
        - cell "仅车缝 · 后道工厂负责 来源：任务后道 开扣眼 装扣子 熨烫 包装"
        - cell "待入库 仅提示，不阻断开工 DB-PF-202608-001"
        - cell "84 件"
        - cell "0 / 84"
        - cell "0 / 84"
        - cell "0 / 84"
        - cell "0 / 84"
        - cell "0 件"
        - cell "84 件"
        - cell "0 件"
        - cell "已交复检 0 件 · 0 张 待复检 0 件 待接收 0 / 已接收 0 件 · 0 张"
        - cell "待后道"
        - cell "创建：2026/8/25 14:40:00 开始：— 完成：—"
        - cell "登记加工 查看记录 打印加工单 查看全流程"
      - row "加工单：PO-QC-202608-003-4-ZJ-HD 质检：PO-QC-202608-003-4-ZJ 生产：PO-QC-202608-003 第 4 次回货 · PO-QC-202608-003-4 来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center 后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件 裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装 质检补加工不读取主调拨状态 100 件 不涉及 不涉及 100 / 100 100 / 100 100 件 0 件 0 件 已交复检 100 件 · 1 张 待复检 100 件 待接收 0 / 已接收 0 件 · 0 张 后道完成 创建：2026/8/25 23:40:00 开始：2026/8/26 00:00:00 完成：2026/8/26 00:00:00 查看加工单 查看记录 打印加工单 查看全流程":
        - cell "加工单：PO-QC-202608-003-4-ZJ-HD 质检：PO-QC-202608-003-4-ZJ 生产：PO-QC-202608-003 第 4 次回货 · PO-QC-202608-003-4":
          - text: 加工单：
          - strong: PO-QC-202608-003-4-ZJ-HD
          - text: 质检：PO-QC-202608-003-4-ZJ 生产：PO-QC-202608-003 第 4 次回货 · PO-QC-202608-003-4
        - cell "来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center"
        - cell "后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件":
          - button "后道验收外套 黑色 S":
            - img "后道验收外套 黑色 S"
          - text: SPU-QC-003-01 黑色 / S · 20 件
          - button "后道验收外套 白色 M":
            - img "后道验收外套 白色 M"
          - text: SPU-QC-003-02 白色 / M · 20 件
          - button "后道验收外套 雾蓝 L":
            - img "后道验收外套 雾蓝 L"
          - text: SPU-QC-003-03 雾蓝 / L · 20 件
          - button "后道验收外套 卡其 XL":
            - img "后道验收外套 卡其 XL"
          - text: SPU-QC-003-04 卡其 / XL · 20 件
          - button "后道验收外套 酒红 2XL":
            - img "后道验收外套 酒红 2XL"
          - text: SPU-QC-003-05 酒红 / 2XL · 20 件
        - cell "裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装"
        - cell "质检补加工不读取主调拨状态"
        - cell "100 件"
        - cell "不涉及"
        - cell "不涉及"
        - cell "100 / 100"
        - cell "100 / 100"
        - cell "100 件"
        - cell "0 件"
        - cell "0 件"
        - cell "已交复检 100 件 · 1 张 待复检 100 件 待接收 0 / 已接收 0 件 · 0 张"
        - cell "后道完成"
        - cell "创建：2026/8/25 23:40:00 开始：2026/8/26 00:00:00 完成：2026/8/26 00:00:00"
        - cell "查看加工单 查看记录 打印加工单 查看全流程"
      - row "加工单：PO-QC-202608-003-5-ZJ-HD 质检：PO-QC-202608-003-5-ZJ 生产：PO-QC-202608-003 第 5 次回货 · PO-QC-202608-003-5 来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center 后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件 裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装 质检补加工不读取主调拨状态 100 件 不涉及 不涉及 100 / 100 100 / 100 100 件 0 件 0 件 已交复检 100 件 · 1 张 待复检 0 件 待接收 100 / 已接收 0 件 · 1 张 后道完成 创建：2026/8/26 00:40:00 开始：2026/8/26 01:00:00 完成：2026/8/26 01:00:00 查看加工单 查看记录 打印加工单 查看全流程":
        - cell "加工单：PO-QC-202608-003-5-ZJ-HD 质检：PO-QC-202608-003-5-ZJ 生产：PO-QC-202608-003 第 5 次回货 · PO-QC-202608-003-5":
          - text: 加工单：
          - strong: PO-QC-202608-003-5-ZJ-HD
          - text: 质检：PO-QC-202608-003-5-ZJ 生产：PO-QC-202608-003 第 5 次回货 · PO-QC-202608-003-5
        - cell "来源：CV Micro Sewing Semarang Timur 后道：PT Prima Printing Center"
        - cell "后道验收外套 黑色 S SPU-QC-003-01 黑色 / S · 20 件 后道验收外套 白色 M SPU-QC-003-02 白色 / M · 20 件 后道验收外套 雾蓝 L SPU-QC-003-03 雾蓝 / L · 20 件 后道验收外套 卡其 XL SPU-QC-003-04 卡其 / XL · 20 件 后道验收外套 酒红 2XL SPU-QC-003-05 酒红 / 2XL · 20 件":
          - button "后道验收外套 黑色 S":
            - img "后道验收外套 黑色 S"
          - text: SPU-QC-003-01 黑色 / S · 20 件
          - button "后道验收外套 白色 M":
            - img "后道验收外套 白色 M"
          - text: SPU-QC-003-02 白色 / M · 20 件
          - button "后道验收外套 雾蓝 L":
            - img "后道验收外套 雾蓝 L"
          - text: SPU-QC-003-03 雾蓝 / L · 20 件
          - button "后道验收外套 卡其 XL":
            - img "后道验收外套 卡其 XL"
          - text: SPU-QC-003-04 卡其 / XL · 20 件
          - button "后道验收外套 酒红 2XL":
            - img "后道验收外套 酒红 2XL"
          - text: SPU-QC-003-05 酒红 / 2XL · 20 件
        - cell "裁剪＋车缝＋烫包 · 三方工厂负责 来源：质检补加工 熨烫 包装"
        - cell "质检补加工不读取主调拨状态"
        - cell "100 件"
        - cell "不涉及"
        - cell "不涉及"
        - cell "100 / 100"
        - cell "100 / 100"
        - cell "100 件"
        - cell "0 件"
        - cell "0 件"
        - cell "已交复检 100 件 · 1 张 待复检 0 件 待接收 100 / 已接收 0 件 · 1 张"
        - cell "后道完成"
        - cell "创建：2026/8/26 00:40:00 开始：2026/8/26 01:00:00 完成：2026/8/26 01:00:00"
        - cell "查看加工单 查看记录 打印加工单 查看全流程"
  - paragraph: 共 3 条，当前 1-3
  - combobox:
    - option "10 条/页"
    - option "20 条/页" [selected]
    - option "50 条/页"
  - button "上一页" [disabled]
  - text: 1 / 1
  - button "下一页" [disabled]
- button "查生产":
  - img
```

# Test source

```ts
  32  |   const snapshot = { schemaVersion: 2, deliveries: [flow.getPostFinishingFactoryReturn(delivery.deliveryId)], qcTasks: [flow.getPostFinishingFullFlowQcTask(qc.qcTaskId)], postTasks: [oldTask],
  33  |     recheckOrders: [recheck], outboundOrders: [], warehouseReceipts: [], waitProcessWarehouseRecords: flow.listPostFinishingWaitProcessWarehouseRecords(), waitProcessWarehouseMovements: flow.listPostFinishingWaitProcessWarehouseMovements(),
  34  |     waitHandoverWarehouseRecords: [], waitHandoverWarehouseMovements: [], returnConfirmationVersions: flow.listPostFinishingReturnConfirmationVersions(), defects: [], materialTransferOrders: [], materialStocks: [] }
  35  |   source.skus[0].plannedQty = before
  36  |   return { snapshot, taskId: task.postTaskId, skuId: source.skus[0].skuId, recheckNo: recheck.recheckOrderNo }
  37  | }
  38  | 
  39  | async function openLegacy(page: Page, fixture: ReturnType<typeof legacyFixture>) {
  40  |   await page.goto('/fcs/craft/post-finishing/work-orders')
  41  |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  42  |   await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw: JSON.stringify(fixture.snapshot) })
  43  |   await page.reload()
  44  |   await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
  45  | }
  46  | 
  47  | async function migrate(page: Page) {
  48  |   page.once('dialog', dialog => dialog.accept())
  49  |   await page.locator('[data-post-finishing-action="storage-migrate"]').click()
  50  |   await expect(page.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
  51  | }
  52  | 
  53  | test('A20/A21/A30: explicit old-source conversion and supervised carryover preserve H/N, old child and unknown item history', async ({ page }) => {
  54  |   const fixture = legacyFixture()
  55  |   await openLegacy(page, fixture)
  56  |   expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBe(JSON.stringify(fixture.snapshot))
  57  |   const before = await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records.length, namespace)
  58  |   expect(before).toBe(0)
  59  |   await migrate(page)
  60  |   expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBeNull()
  61  |   await page.goto(`/fcs/craft/post-finishing/work-orders/${fixture.taskId}`)
  62  |   await expect(page.locator('[data-post-process-card]').first()).toContainText('历史未分项')
  63  |   await page.locator('[data-post-prototype-actor]').selectOption('PF-USER-POST-MGR')
  64  |   await page.locator('[data-post-finishing-work-order-detail-action="switch-actor"]').click()
  65  |   await page.locator('[data-post-finishing-work-order-detail-action="open-legacy"]').click()
  66  |   for (const item of ['装扣子','包装']) await page.locator(`[data-post-legacy-process-item][value="${item}"]`).check()
  67  |   const skuRows = page.locator('[data-post-legacy-sku]')
  68  |   for (let i=0; i<await skuRows.count(); i++) for (const item of ['装扣子','包装']) await skuRows.nth(i).locator(`[data-post-legacy-baseline="${item}"]`).fill(i === 0 ? item === '装扣子' ? '200' : '100' : '0')
  69  |   await page.locator('[data-post-entry-reason]').fill('根据保留的历史合并结果及现场分项核对承接，确认人不冒充加工人')
  70  |   page.once('dialog', dialog => dialog.accept())
  71  |   await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  72  |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  73  |   const result = await page.evaluate(async id => {
  74  |     const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
  75  |     const v = await import('/src/data/fcs/post-finishing-current-read-model.ts')
  76  |     return { progress: f.getPostFinishingProcessProgress(id), rechecks: f.listPostFinishingFullFlowRecheckOrders(), order: v.getPostFinishingWorkOrderById(id) }
  77  |   }, fixture.taskId)
  78  |   expect(result.progress.totalCompletedQty).toBe(500)
  79  |   expect(result.progress.availableForRecheckQty).toBe(100)
  80  |   expect(result.progress.processes.find(p => p.processItem === '包装')?.expectedQty).toBe(600)
  81  |   expect(result.order?.postProjectLines.find(row => row.projectName === '包装')?.plannedQty).toBe(600)
  82  |   expect(result.rechecks).toHaveLength(1)
  83  |   expect(result.rechecks[0].recheckOrderNo).toBe(fixture.recheckNo)
  84  |   expect(result.progress.records).toHaveLength(0)
  85  |   await page.reload()
  86  |   await expect(page.locator('[data-web-post-task]')).toContainText('历史整套后道完成 400 件')
  87  |   mkdirSync(evidence, { recursive: true })
  88  |   await page.screenshot({ path: `${evidence}/legacy-carryover.png`, fullPage: true })
  89  |   const forged = await page.evaluate(async ns => {
  90  |     const r = await import('/src/data/fcs/post-finishing-records.ts')
  91  |     const db = await import('/src/data/pcs-record-db.ts')
  92  |     const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
  93  |     const before = JSON.stringify((await db.readPcsRecords([ns])).records)
  94  |     const parent = backup.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted)
  95  |     parent.value.legacyCarryover.history[0].completedQty = 800
  96  |     // Remove the old value in a second isolated target below; here a conflict
  97  |     // must already refuse to overwrite the valid existing parent.
  98  |     try { await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'forged-H.json')); return false } catch { return before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  99  |   }, namespace)
  100 |   expect(forged).toBe(true)
  101 |   const forgedBackup = await page.evaluate(async () => {
  102 |     const r = await import('/src/data/fcs/post-finishing-records.ts')
  103 |     const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
  104 |     backup.records.find((row: any) => row.collection === 'flow/postTasks' && !row.deleted).value.legacyCarryover.history[0].completedQty=800
  105 |     return backup
  106 |   })
  107 |   const isolated = await page.context().browser()!.newContext()
  108 |   const isolatedPage = await isolated.newPage()
  109 |   await isolatedPage.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
  110 |   await expect(isolatedPage.locator('main h1')).toHaveText('后道加工单')
  111 |   const rejected = await isolatedPage.evaluate(async backup => {
  112 |     const r = await import('/src/data/fcs/post-finishing-records.ts')
  113 |     const db = await import('/src/data/pcs-record-db.ts')
  114 |     await r.ensurePostFinishingRecordState()
  115 |     try { await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'forged-history.json')); return false } catch(e) { return String(e).includes('历史承接') && !(await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records.length }
  116 |   }, forgedBackup)
  117 |   expect(rejected).toBe(true)
  118 |   await isolated.close()
  119 | })
  120 | 
  121 | test('A20: schema2 IndexedDB marker upgrade writes no static seeds or invented completion records', async ({ page }) => {
  122 |   const fixture = legacyFixture()
  123 |   await page.goto('/fcs/craft/post-finishing/work-orders')
  124 |   await page.evaluate(async ({ snapshot, ns }) => {
  125 |     const db = await import('/src/data/pcs-record-db.ts')
  126 |     await db.commitPcsRecords({ puts: [
  127 |       { id: `${ns}/flow/schemaVersion/value`, collection: 'flow/schemaVersion', value: 2, expectedVersion: 0 },
  128 |       { id: `${ns}/flow/postTasks/${encodeURIComponent(snapshot.postTasks[0].postTaskId)}`, collection: 'flow/postTasks', value: snapshot.postTasks[0], expectedVersion: 0 },
  129 |     ], deletes: [], operationId: 'OLD-INDEXEDDB-INPUT', intent: 'isolated old version overlay fixture' })
  130 |   }, { snapshot: fixture.snapshot, ns: namespace })
  131 |   await page.reload()
> 132 |   await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
      |                                                                                ^ Error: expect(locator).toBeVisible() failed
  133 |   await migrate(page)
  134 |   const records = await page.evaluate(async ns => (await (await import('/src/data/pcs-record-db.ts')).readPcsRecords([ns])).records, namespace)
  135 |   expect(records.filter(row => row.collection === 'flow/processCompletions')).toHaveLength(0)
  136 |   expect(records.filter(row => row.id !== `${namespace}/revision`)).toHaveLength(2)
  137 |   expect(records.find(row => row.collection === 'flow/schemaVersion')?.value).toBe(3)
  138 | })
  139 | 
  140 | test('A30: H600 plus the remaining N400 completes only Q1000 and releases exactly 400 new supply', async ({ page }) => {
  141 |   const fixture = legacyFixture(600)
  142 |   await openLegacy(page, fixture)
  143 |   await migrate(page)
  144 |   const result = await page.evaluate(async ({ id, skuId }) => {
  145 |     const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
  146 |     const r = await import('/src/data/fcs/post-finishing-records.ts')
  147 |     const task=f.getPostFinishingFullFlowPostTask(id)!
  148 |     await r.runPostFinishingCommand(() => f.confirmPostFinishingLegacyCarryover({ postTaskId:id, processItems:['装扣子','包装'],
  149 |       history:task.lines.map(line=>({skuId:line.sku.skuId,completedQty:line.sku.skuId===skuId?600:0})),
  150 |       baselines:['装扣子','包装'].map(processItem=>({processItem:processItem as '装扣子'|'包装',quantities:task.lines.map(line=>({skuId:line.sku.skuId,quantity:line.sku.skuId===skuId?400:0}))})),
  151 |       actor:Object.values(f.POST_FINISHING_ACCEPTANCE_ACTORS).find(actor=>actor.roleName==='后道主管')!, reason:'验收核对历史600与剩余400分离，不重复累计历史' }))
  152 |     const progress=f.getPostFinishingProcessProgress(id)
  153 |     return { expected:progress.totalExpectedQty, completed:progress.totalCompletedQty, reserved:progress.totalReservedQty, available:progress.availableForRecheckQty,
  154 |       remaining:progress.processes.find(row=>row.processItem==='包装')?.expectedQty, invented:progress.records.length }
  155 |   }, {id:fixture.taskId,skuId:fixture.skuId})
  156 |   expect(result).toEqual({expected:1000,completed:1000,reserved:600,available:400,remaining:400,invented:0})
  157 |   await page.reload()
  158 |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  159 | })
  160 | 
  161 | test('A22: complete restore retains records, while future/duplicate/orphan/overquantity backup leaves database unchanged', async ({ page }) => {
  162 |   const fixture = legacyFixture()
  163 |   await openLegacy(page, fixture)
  164 |   await migrate(page)
  165 |   const result = await page.evaluate(async ns => {
  166 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  167 |     const db = await import('/src/data/pcs-record-db.ts')
  168 |     const backup = JSON.parse(await (await records.exportPostFinishingBackup()).text())
  169 |     const before = JSON.stringify((await db.readPcsRecords([ns])).records)
  170 |     await records.importPostFinishingBackup(new File([JSON.stringify(backup)], 'valid.json'))
  171 |     const errors: string[] = []
  172 |     for (const bad of [{ ...backup, version: 99 }, { ...backup, records: [...backup.records, backup.records[0]] }]) {
  173 |       try { await records.importPostFinishingBackup(new File([JSON.stringify(bad)], 'bad.json')); errors.push('UNEXPECTED_SUCCESS') } catch (e) { errors.push(String(e)) }
  174 |     }
  175 |     const badRecord = { id: `${ns}/flow/processCompletions/ORPHAN`, collection: 'flow/processCompletions', version: 1, value: {
  176 |       recordId: 'ORPHAN', operationId: 'ORPHAN', intent: 'orphan fixture', postTaskId: 'MISSING', processItem: '包装', quantities: [{ skuId: 'MISSING', quantity: 1001 }],
  177 |       responsible: { actorId: 'PF-USER-POST', actorName: '操作员', roleName: '后道操作员' }, recordedBy: { actorId: 'PF-USER-POST', actorName: '操作员', roleName: '后道操作员' }, recordedAt: '2026-10-19T08:00:00+08:00' } }
  178 |     try { await records.importPostFinishingBackup(new File([JSON.stringify({ ...backup, records: [...backup.records, badRecord] })], 'orphan.json')); errors.push('UNEXPECTED_SUCCESS') } catch (e) { errors.push(String(e)) }
  179 |     return { errors, backup, unchanged: before === JSON.stringify((await db.readPcsRecords([ns])).records) }
  180 |   }, namespace)
  181 |   expect(result.errors).toHaveLength(3)
  182 |   expect(result.errors.every(error => !error.includes('UNEXPECTED_SUCCESS'))).toBe(true)
  183 |   expect(result.unchanged).toBe(true)
  184 |   // Regression: retry through the very same file input after a format failure.
  185 |   // Successful hydration must replace the page rather than preserve stale input.
  186 |   const retryContext = await page.context().browser()!.newContext()
  187 |   try {
  188 |     const retry = await retryContext.newPage()
  189 |     await retry.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/audit-records`)
  190 |     await expect(retry.locator('main h1')).toHaveText('差异与操作日志')
  191 |     const input = retry.locator('[data-post-finishing-field="storage-import"]')
  192 |     await expect(input).toHaveCount(1)
  193 |     const originalInput = await input.elementHandle()
  194 |     await input.setInputFiles({ name: 'invalid-format.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  195 |     await expect(retry.locator('[data-post-finishing-action-error]')).toContainText('后道备份格式或版本无效')
  196 |     expect(await input.evaluate(node => (node as HTMLInputElement).files?.[0]?.name)).toBe('invalid-format.json')
  197 |     expect(await originalInput!.evaluate(node => node.isConnected)).toBe(true)
  198 |     await input.setInputFiles({ name: 'verified-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(result.backup)) })
  199 |     await expect(retry.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  200 |     await expect(retry.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
  201 |     await expect.poll(() => originalInput!.evaluate(node => node.isConnected)).toBe(false)
  202 |     const taskNo = fixture.snapshot.postTasks[0].postTaskNo
  203 |     await retry.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
  204 |     await expect(retry.locator('main h1')).toHaveText('后道加工单')
  205 |     await expect(retry.locator('tbody tr').filter({ hasText: taskNo })).toHaveCount(1)
  206 |     const restored = await retry.evaluate(async id => {
  207 |       const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
  208 |       const task = f.getPostFinishingFullFlowPostTask(id)!
  209 |       return { no: task.postTaskNo, expected: task.lines.reduce((sum, line) => sum + line.expectedQty, 0) }
  210 |     }, fixture.taskId)
  211 |     expect(restored).toEqual({ no: taskNo, expected: 1000 })
  212 |     mkdirSync(evidence, { recursive: true })
  213 |     await retry.screenshot({ path: `${evidence}/backup-ui-failure-retry-restored.png`, fullPage: true })
  214 |   } finally { await retryContext.close() }
  215 | 
  216 |   // Old HEAD upsertOutboundFromRecheck used record.lines.map, preserving zero
  217 |   // lines. Build the positive facts through public commands, then encode that
  218 |   // explicit schema-2 representation; omitted historical WH/receipt is unknown,
  219 |   // not permission to invent a current warehouse fact or historical person.
  220 |   const old = legacyFixture()
  221 |   const actor = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  222 |   const active = flow.getPostFinishingFullFlowRecheckOrder(old.snapshot.recheckOrders[0].recheckOrderId)!
  223 |   flow.claimPostFinishingRecheckOrder({ recheckOrderNo: active.recheckOrderNo, actor: actor.recheckerA })
  224 |   for (const line of active.lines) flow.scanPostFinishingRecheckSkuBarcode({ recheckOrderId: active.recheckOrderId, skuId: line.sku.skuId, scannedBarcode: line.sku.barcode, actor: actor.recheckerA })
  225 |   const completed = flow.completePostFinishingRecheckOrderFullFlow({ recheckOrderId: active.recheckOrderId, actor: actor.recheckerA,
  226 |     results: active.lines.map(line => ({ skuId: line.sku.skuId, handoverQty: line.expectedQty })) })
  227 |   const generated = flow.getPostFinishingFullFlowOutboundOrder(completed.outboundOrderId!)!
  228 |   flow.receivePostFinishingOutboundOrder({ outboundOrderNo: generated.outboundOrderNo, actor: actor.warehouseReceiver,
  229 |     receivedQuantities: generated.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })) })
  230 |   const historical: any = structuredClone(completed)
  231 |   delete historical.operationId; delete historical.operationIntent; delete historical.sequence
  232 |   historical.lines = old.snapshot.postTasks[0].lines.map(line => ({ ...structuredClone(completed.lines.find(source => source.sku.skuId === line.sku.skuId) || { sku: line.sku, expectedQty: 0, barcodeStatus: '未扫描', barcodeEvents: [] }),
```