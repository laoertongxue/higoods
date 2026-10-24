# 原型 vs 测试环境 — 功能差距总清单（2026-10-14）

来源：4 个探索者并行对比（exp-2 raw-online / exp-3 stock+capacity / exp-4 transit+finished / exp-5 production+base-data）。
规格依据：`output/wls-alignment-20261014/func-specs/group{1-11}*.md`。

## 总量
- 规格页 103 项，原型全部有路由+菜单入口，**整页缺失 0**。
- **完整对齐 1 页**（Mahameru 中转仓库位）；**有差距 64+ 页**（多页共用模板差距相同）。
- **原型多出 1 页**：Mahameru「裁片配料单All」`/wls/online/mahameru-cutting-all`（规格明确不应有）。

## 高优先级共性问题（跨页）
1. **页头描述文案全缺**：`renderStandardListPage` 无 description 字段，所有页面仅传标题。
2. **状态 Tab 缺失**：原型普遍用状态下拉替代规格要求的状态页签（约 20+ 页）。
3. **勾选列缺失**：条码页/出库页/收货单/上架单/生产单校验/配料单/预出库/退货入库等约 10 页。
4. **主操作按钮缺失**：新增调拨单/新建移货单/创建异常单/手动添加监控SKU/创建入库单/创建收货单/创建任务单/新增调拨单/新增仓库/新增主体/新增规则/添加库区库位/批量添加打印/发起移货申请/发起退还申请/生成配料单/批量确认满足等。
5. **筛选维度大幅简化**：仓库下拉不完整、类型/品牌/平台/售卖类型/染印需求/配料状态/5 组时间等多缺失。
6. **裁剪厂分配承接工厂错误**：Hilon 与 Mahameru 共用 `恒盛制衣…`，应分别为 `sea cutting/sea-PPIC` 与 `sea cutting/sea2-PPIC`（seed.ts:469,513）。
7. **Hilon 裁片配料映射到 FCS 配料工作台**（含「配料」按钮），与规格「只读」冲突。

## 泳道划分
- **L1 raw-online**：exp-2 报告 → 12 页，文件 `src/pages/wls/raw-online/*.ts`
- **L2 production-prep + base-data + stock-online + capacity**：exp-5+exp-3 报告 → 23 页，文件 `src/pages/wls/production-prep/allocation.ts`、`src/pages/wls/finished/basic-*.ts`、`src/pages/wls-fabric-demand-board.ts`、`src/pages/wls/stock-online/*.ts`、`src/pages/wls/capacity-online/capacity-page.ts`
- **L3 transit(Hilon) + transit-online(Mahameru) + finished + garment-inventory**：exp-4 报告 → 29 页，文件 `src/pages/wls/transit/*.ts`、`src/pages/wls/transit-online/*.ts`、`src/pages/wls/finished/{pre-inbound,putaway,return-inbound,pre-outbound}.ts`、`src/pages/wls-garment-relabel-tasks.ts`、`src/pages/wls/garment-inventory/page.ts`、seed 文件

## 各泳道差距明细
见各泳道差距文件：
- `output/wls-alignment-20261014/func-specs/gap-l1-raw.md`
- `output/wls-alignment-20261014/func-specs/gap-l2-prod-stock.md`
- `output/wls-alignment-20261014/func-specs/gap-l3-transit-finished.md`
