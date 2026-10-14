# WLS 仓储物流系统全量对齐测试环境

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：WLS 全量对齐（46 个 /wls/online/* 占位页实现 + 单据 mock 恰好两页）+ 差距修复（测试环境 103 页逐页实点对齐，L1/L2/L3a/L3b/L3c 五泳道）
- 验证人：主代理（技术验证，不代替产品接受）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增 46 个 WLS 业务页面（仓储物流系统与测试环境 test_manage.higood.ai 对齐），含列表、筛选、分页、事件交互；修改路由注册、事件分发、演示种子数据量；修改主路由懒加载前缀判断（src/router/routes.ts）使 /wls/online/* 进入 WLS 路由模块。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 路由注册与页面可达 | 通过 | src/router/routes-wls.ts 合并 6 个泳道路由片段（onlineRouteEntries）；src/router/routes.ts:253 增加 /wls/online 前缀；浏览器批量验证 46/46 路由渲染真实页面，无「页面开发中」占位 |
| 列表页结构（LIST-01） | 通过 | 43 个列表页均为标准列表结构（查询/统计/表格/分页），10 行/页 + 「1 / 2」两页分页；scan-pick、order-scan-ship 为扫码作业页（按测试环境规格无表格列表）；capacity-return 等 6 页为员工产能统计页（统计表单页，16 行不分页，同测试环境）；warehouse-stock 18 条库存记录（2 页） |
| 单据 mock 恰好两页 | 通过 | 用户确认口径 11–20 条（默认 10/页）；预入库 raw-seed preInboundSeed 48→16；共享中转调拨 materialTransferOrder 84→16、materialTransferDetail 168→32；成衣种子 returnOrder/preOutbound 等裁剪至 16；新增 6 个域种子均 16 条/组 |
| 事件交互 | 通过 | wls-page-handlers.ts 合并 6 域处理器映射；浏览器抽查列表筛选、分页切换、列设置无控制台错误 |
| 图片硬门禁（IMAGE-01） | 通过 | garment-inventory 页 10 张真实面料图（/materials/fabric-*.jpg）全部加载成功，alt 含 SPU 名称与编号；L1 页使用 public 根目录真实成衣图；无占位色块 |
| 性能（PERF-01 ≤1000ms） | 通过 | 6 个域最重代表页 × 5 个 SPA 站内切换样本：最大值 kol-print 26ms、warehouse-stock 24ms、capacity-return 22ms、mahameru-cutting-all 26ms、stock-monitor 24ms、garment-inventory 28ms；全部 ≤1000ms |
| 类型检查 | 通过 | `npx tsc --noEmit`：仅剩 13 个既有 pcs/tech-pack 错误（src/data/pcs-*、src/pages/tech-pack/events.ts），与本任务无关 |
| 构建 | 通过 | `npm run build` 成功（dist 更新） |
| 控制台错误 | 通过 | 46 页批量导航后浏览器控制台无 error/warn |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

首轮（46 页实现）：

- `src/router/routes-wls.ts`
- `src/router/routes.ts`
- `src/main-handlers/wls-page-handlers.ts`
- `src/data/wls/seed/finished-seed.ts`
- `src/data/wls/seed/raw-seed.ts`
- `src/data/wls/seed/shared-seed.ts`
- `src/data/wls/seed/stock-seed.ts`
- `src/pages/wls/finished-online/scan-pick.ts`
- `src/pages/wls/finished-online/print-collect.ts`
- `src/pages/wls/finished-online/kol-print.ts`
- `src/pages/wls/finished-online/order-scan-ship.ts`
- `src/pages/wls/finished-online/loan.ts`
- `src/pages/wls/finished-online/shopee.ts`
- `src/pages/wls/finished-online/promo.ts`
- `src/pages/wls/finished-online/routes.ts`
- `src/pages/wls/finished-online/seed.ts`
- `src/pages/wls/finished-online/shared.ts`
- `src/pages/wls/stock-online/warehouse-stock.ts`
- `src/pages/wls/stock-online/transit-flow.ts`
- `src/pages/wls/stock-online/transit-move.ts`
- `src/pages/wls/stock-online/garment-transfer.ts`
- `src/pages/wls/stock-online/transit-count.ts`
- `src/pages/wls/stock-online/kol-move.ts`
- `src/pages/wls/stock-online/routes.ts`
- `src/pages/wls/stock-online/seed.ts`
- `src/pages/wls/capacity-online/capacity-page.ts`
- `src/pages/wls/capacity-online/routes.ts`
- `src/pages/wls/capacity-online/seed.ts`
- `src/pages/wls/transit-online/hilon-cutting-factory.ts`
- `src/pages/wls/transit-online/hilon-cutting-all.ts`
- `src/pages/wls/transit-online/mahameru-cutting.ts`
- `src/pages/wls/transit-online/mahameru-received.ts`
- `src/pages/wls/transit-online/mahameru-inbound.ts`
- `src/pages/wls/transit-online/mahameru-putaway.ts`
- `src/pages/wls/transit-online/mahameru-inventory.ts`
- `src/pages/wls/transit-online/mahameru-location.ts`
- `src/pages/wls/transit-online/mahameru-kit.ts`
- `src/pages/wls/transit-online/mahameru-allocation.ts`
- `src/pages/wls/transit-online/mahameru-outbound.ts`
- `src/pages/wls/transit-online/mahameru-work.ts`
- `src/pages/wls/transit-online/mahameru-cutting-factory.ts`
- `src/pages/wls/transit-online/list-factory.ts`
- `src/pages/wls/transit-online/routes.ts`
- `src/pages/wls/transit-online/seed.ts`
- `src/pages/wls/raw-online/arrival-page.ts`
- `src/pages/wls/raw-online/barcode-pages.ts`
- `src/pages/wls/raw-online/transfer-pages.ts`
- `src/pages/wls/raw-online/consumable-outbound.ts`
- `src/pages/wls/raw-online/raw-move.ts`
- `src/pages/wls/raw-online/barcode-exception.ts`
- `src/pages/wls/raw-online/stock-monitor.ts`
- `src/pages/wls/raw-online/shared.ts`
- `src/pages/wls/raw-online/routes.ts`
- `src/pages/wls/raw-online/seed.ts`
- `src/pages/wls/garment-inventory/page.ts`
- `src/pages/wls/garment-inventory/routes.ts`
- `src/pages/wls/garment-inventory/seed.ts`

差距修复轮新增/修改：

- `src/components/ui/list-page.ts`
- `src/data/app-shell-config.ts`
- `src/pages/wls-fabric-demand-board.ts`
- `src/pages/wls-garment-relabel-tasks.ts`
- `src/pages/wls/production-prep/allocation.ts`
- `src/pages/wls/finished/basic-warehouse.ts`
- `src/pages/wls/finished/basic-zone-location.ts`
- `src/pages/wls/finished/basic-subject.ts`
- `src/pages/wls/finished/basic-barcode-rule.ts`
- `src/pages/wls/finished/basic-basket.ts`
- `src/pages/wls/finished/pre-inbound.ts`
- `src/pages/wls/finished/putaway.ts`
- `src/pages/wls/finished/return-inbound.ts`
- `src/pages/wls/finished/pre-outbound.ts`
- `src/pages/wls/transit/receive-manage.ts`
- `src/pages/wls/transit/inbound-manage.ts`
- `src/pages/wls/transit/putaway-manage.ts`
- `src/pages/wls/transit/inventory-manage.ts`
- `src/pages/wls/transit/location.ts`
- `src/pages/wls/transit/kit-center.ts`
- `src/pages/wls/transit/allocation-manage.ts`
- `src/pages/wls/transit/outbound-manage.ts`
- `src/pages/wls/transit/work-area-manage.ts`
- `src/pages/wls/transit-online/hilon-cutting-all.ts`（修改）
- `src/pages/wls/transit-online/hilon-cutting-factory.ts`（修改）
- `src/pages/wls/transit-online/mahameru-cutting.ts`（修改）
- `src/pages/wls/transit-online/mahameru-inbound.ts`（修改）
- `src/pages/wls/transit-online/mahameru-received.ts`（修改）
- `src/pages/wls/transit-online/mahameru-putaway.ts`（修改）
- `src/pages/wls/transit-online/mahameru-work.ts`（修改）
- `src/pages/wls/transit-online/mahameru-cutting-factory.ts`（修改）
- `src/pages/wls/transit-online/list-factory.ts`（修改）
- `src/pages/wls/transit-online/seed.ts`（修改）
- `src/pages/wls/raw-online/seed.ts`（修改）
- `src/pages/wls/stock-online/seed.ts`（修改）
- `src/pages/wls/capacity-online/seed.ts`（修改）
- `src/pages/wls/capacity-online/capacity-page.ts`（修改）
- `src/pages/wls/stock-online/warehouse-stock.ts`（修改）
- `src/pages/wls/stock-online/transit-flow.ts`（修改）
- `src/pages/wls/stock-online/transit-move.ts`（修改）
- `src/pages/wls/stock-online/garment-transfer.ts`（修改）
- `src/pages/wls/stock-online/kol-move.ts`（修改）
- `src/pages/wls/garment-inventory/page.ts`（修改）
- `src/pages/wls/garment-inventory/seed.ts`（修改）
- `docs/prototype-review-records/2026-10-14-wls-full-alignment.md`

### 页面证据

- 版本：工作树未提交（含 2026-10-14 路由前缀修复）；本地 preview `http://127.0.0.1:4173`（vite preview 服务 dist）；Chrome DevTools 桌面视口
- 证据：浏览器批量导航 46 条 /wls/online/* 路由，全部渲染真实页面标题与内容；43 个列表页表格 10 行 + 「1 / 2」分页 + 「共 16 条」；garment-inventory 图片 10/10 加载；抽查 scan-pick（扫码输入 + 任务卡）、order-scan-ship（扫码 + 打印机选择）、capacity-return（统计表 16 行）与测试环境规格一致

### 性能结论

- 结论：通过
- 依据：SPA 站内切换（popstate 起点 → 表格行/内容就绪终点），6 个域代表页各 5 样本共 30 个有效样本，最大值 28ms（garment-inventory），全部远低于 1000ms 门槛；环境为本地 vite preview 生产构建、Chrome 桌面、默认网络

### 验证命令

- `npx tsc --noEmit`：通过
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --scope worktree`：通过
- `npm run check:list-page-governance -- --scope worktree`：通过
- `浏览器批量导航 46 条 /wls/online/* 路由 + 控制台检查`：通过

### 差距修复轮（2026-10-14 五泳道）

测试环境 103 页逐页实点后，对 46 页原型做差距修复，分五泳道并行完成：

| 泳道 | 范围 | 主要修复 |
| --- | --- | --- |
| L1 | raw-online 12 页 | 公共组件 `renderStandardListPage` 加可选 `description`；页头文案、状态 Tab、仓库下拉、行内动作、勾选列、分页档位 |
| L2 | production-prep 5 页 + 基础数据 5 页 + stock-online 6 页 + capacity 6 页 | 售卖类型/染印需求多选、5 组时间筛选、配料弹窗 13 列、基础数据筛选与主操作、KOL 移货主操作、产能统计三卡与业务日逻辑 |
| L3a | transit/ 旧域 9 页 | 状态 Tab、列结构重构、主操作与行内动作（创建入库单/收货单/生成配料单/一键上架等） |
| L3b | transit-online/ 9 文件 | seed 承接工厂参数化（sea-PPIC/sea2-PPIC）、工厂×2 + 5 组时间筛选、Hilon/Mahameru 列差异、单位口径「卷/Yard」 |
| L3c | finished 入库/出库 4 页 + 换码 + garment-inventory | 状态 Tab、批量操作与勾选、筛选补齐、海运入库时间、30 行/页 |

### 差距修复轮验证证据

- 版本：工作树未提交；本地 preview `http://127.0.0.1:4173`；Chrome DevTools 桌面视口
- `npx tsc --noEmit`：通过（仅 13 个既有 pcs/tech-pack 错误）
- `npm run build`：通过（13.96s）
- 浏览器抽样 6/6：`receive-manage`（创建入库单/调拨入库+规格列）、`hilon-cutting-all`（无物料类型列+图片列+打印配料+工厂×2）、`kol-move`（发起移货/退还申请）、`raw-move`（新建移货单+12 列）、`pre-outbound`（勾选列+toggle-select+状态 Tab）、`warehouse-stock`（勾选+15天未盘点筛选+6 统计卡+13 列）
- 图片门禁：`hilon-cutting-all` 图片列真实素材加载；garment-inventory 10 张面料图沿用

### 已知限制

- 无数据支撑的筛选（售卖类型/部分时间组/工序等）仅呈现 UI，不做实际过滤（数据模型未提供对应字段）
- 预入库「生产单」为原型推导值（PO + 关联单号），非真实字段
- capacity `limit=15` URL 默认参数未加（避免隐藏演示数据），已在页面内实现等价默认业务日范围

### 例外

- 无
