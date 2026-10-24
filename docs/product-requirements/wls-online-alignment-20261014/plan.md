# WLS 全量功能对齐计划（工作稿）

- 日期：2026-10-14
- 目标：原型仓储物流系统（WLS）与测试环境 `http://test_manage.higood.ai`「仓储管理」在功能上保持一致；单据类列表 mock 数据恰好两页（每页 10 条 → 11-20 条）。
- 用户已确认口径：① mock 恰好两页 11-20 条（超出裁剪、不足补齐）；② 46 个占位菜单项全部补齐。
- 基线证据：
  - 测试环境完整菜单 103 项：`output/wls-alignment-20261014/test-env-wls-menu.md`
  - 46 个占位页结构规格：`output/wls-alignment-20261014/test-env-page-specs.json`
  - 原型菜单 JSON：待 exp-1 产出（下文「菜单 diff」节待填）

## 1. 范围与非范围

### 范围
1. 46 个 `/wls/online/*` 占位菜单项 → 全部实现为真实页面（列表/工作台按测试环境结构）。
2. 测试环境有、原型菜单可能缺失的条目（原料管理组：所有调拨单、等待调拨、手动出库列表、领料出库列表、库存查询/流水/仓位列表、库存盘点列表、织带/织带半成品/采购到货等）→ 菜单 diff 确认后补齐。
3. 原型多出项：Mahameru 组「裁片配料单All」（测试环境无）→ 按 NAME-01 删除多余菜单项（用户确认删除或改指 All 页）。
4. 单据类列表 mock 数据调整为恰好两页（11-20 条）；新页面单据列表同样 11-20 条。
5. 新页面路由注册（routes-wls.ts）+ 菜单 href 从 `/wls/online/*` 换成真实原型路由。

### 非范围
- 不改测试环境、不写测试站数据（SAFE-01）。
- 不动 PDA 管理组（2026-10-13 已对齐）。
- 不引入新框架/依赖；不迁移 React。
- 生产配料 5 页、面料需求看板、基础数据 5 页等已有真实路由的页面结构微调不在本次（除非 diff 发现缺路由）。
- 图片硬门禁（IMAGE-01）：新页面如列含商品/物料图片，用原型已有图片资产；无资产的对象登记阻塞，不放占位图。

## 2. 测试环境关键发现

1. 分页统一 pagerLimitSelect，默认 10/页；状态页签为「全部(n) 待收货(n)」按钮组。
2. 调拨待交出列表 / 调拨交出单据：菜单在、后端方法不存在（跳控制面板）→ 原型按同模块兄弟页（所有调拨单/等待调拨/等待入库）模式实现。
3. 新中转仓 Mahameru 共 12 项（含裁片配料单），无「裁片配料单All」；老中转仓 Hilon 12 项含「裁片配料单All」。
4. 成衣管理组：入库管理复用 `/wls/inbound_manage/index`（与入库管理组同页）；预出库管理 `/wls/outbound_manage/index`；库存管理 `/wls/inventory/index`（面料库存总览，SPU 聚合 + SKU 明细弹层）。
5. 产能统计 6 页完全同构：仓库/账号筛选 + {时间}列 + 产能列。
6. 原料到货 3 页（染色/印花/绣花）同构，仅来源类型不同。
7. 借出单管理含创建弹窗（添加商品行）+ 批量打单/发货；Shopee/推广任务单含批量面单操作。
8. 扫码拣货、扫码打单为工作台页（扫码输入 + 结果区），非标准列表。

## 3. 实施分组（泳道）

按种子文件与页面域切分，避免并行写冲突。每泳道：新建页面文件 + 注册路由 + mock 两页。

| 泳道 | 组 | 页面（占位 id） | 种子文件归属 |
| --- | --- | --- | --- |
| L1 成衣出库 | 出库管理占位 7 页 | scan-pick, print-collect, kol-print, order-scan-ship, loan, shopee, promo | finished-seed.ts（preOutbound* 109/30/24 裁剪、returnOrder 24 裁剪） |
| L2 库存与转移 | 库存管理占位 5 + KOL 1 | warehouse-stock, transit-flow, transit-move, garment-transfer, transit-count, kol-move | stock-seed.ts（stockFlow 8→补）、shared-seed.ts（materialTransfer 84 裁剪、putaway 19 保持） |
| L3 产能统计 | 产能统计 6 页 | capacity-*（同构，可一个 renderXxx 参数化） | 新增小 seed（10-20 行） |
| L4 中转两组 | Hilon 2 + Mahameru 12 | hilon-cutting-factory, hilon-cutting-all, mahameru-*12 | transit-seed.ts（transitProcess 16 保持）+ 新增 Mahameru seed |
| L5 原料管理 | 原料 12 + 菜单 diff 新增项 | dye/print/embroidery-arrival, transfer-handover×2, transfer-wait-inbound, raw-putaway, raw-barcode, consumable-outbound, raw-move, barcode-exception, stock-monitor（+diff 新增） | raw-seed.ts（preInbound 48 裁剪） |
| L6 成衣管理 | 库存管理 1 页 | garment-inventory（面料库存总览 + SKU 明细弹层） | 复用 stock/raw seed 派生 |

共享文件冲突控制：
- `src/router/routes-wls.ts`：各泳道只在自己的 exactRoutes 区段追加（按组分段追加，冲突时按序合并——由调和阶段统一检查）。
- `src/data/app-shell-config.ts`：菜单 href 替换集中放到调和阶段（避免并行写）。
- 公共组件只读复用（renderStandardListPage 等）；不足时最小扩展 `src/components/ui/`。

## 4. 单据 mock 审计（当前 → 目标）

| 种子 | 当前 | 用于列表 | 目标动作 |
| --- | --- | --- | --- |
| preInboundSeed | 48 | 预入库管理等 | 裁到 11-20 |
| preOutboundSeed | 109 | 预出库/出库单管理 | 裁到 11-20 |
| preOutboundTestSeed | 30 | 预出库（测试单） | 裁到 11-20 |
| preOutboundAutoSeed | 24 | 自动预出库 | 裁到 11-20 |
| returnOrderSeed | 24 | 退货入库列表 | 裁到 11-20 |
| materialTransferOrderSeed | 84 | 原料调拨单 | 裁到 11-20 |
| materialCategoryOutboundDemoSeed | 25 | 类目出库 | 裁到 11-20 |
| stockFlowSeed | 8 | 库存流水查询 | 补到 11-20 |
| preOutboundOutboundListSeed | 12 | 出库单列表 | 保持 ✓ |
| preOutboundMaterialRequisitionSeed | 18 | 领料 | 保持 ✓ |
| transitProcessSeed | 16 | 中转加工单 | 保持 ✓ |
| putawaySeed | 19 | 上架单 | 保持 ✓ |
| fabricScoreSeed | 20 | 面料评分 | 保持 ✓ |
| transitLocationSeed | 6 | 仓位绑定（非单据） | 不强制 |

注：裁剪时保持状态分布可演示（各状态至少 1 条）；裁剪不破坏引用完整性（明细/引用同步）。每页种子最终条数以页面实际消费为准，逐页核对（T3 验证）。

## 5. 验证策略

1. 治理：`npm run check:prototype-design-governance` + `npm run check:list-page-governance`（新列表页 `// @page-pattern: list` 声明）。
2. 构建：`npm run build`。
3. 浏览器验收：每个新页面打开 → 页签/筛选/列/操作可见、分页恰好 2 页、无控制台错误；抽查操作交互（创建弹窗打开、批量按钮可用）。
4. PERF-01：新列表页加载 ≤1000ms（本地生产预览或 dev，登记环境）；每家族≥5 样本按 EFFICIENCY-02（新页面按同构家族采样：产能统计 1 代表、原料到货 1 代表、单据列表抽 3 代表）。
5. 审查记录：REVIEW-01 完整产品审查 → `docs/prototype-review-records/2026-10-14-wls-full-alignment.md`。

## 6. 菜单 diff 结论（exp-1，2026-10-14）

- 原型 WLS 叶子菜单 106 条：已注册 60、占位 46。46 占位与本计划分组一一对应。
- 原料管理 24 项全部存在、无缺失（12 已注册 + 12 占位）。测试环境「列表」后缀与原型命名差异仅为显示层。
- 多出项 1：Mahameru 组「裁片配料单All」（/wls/online/mahameru-cutting-all）——测试环境无对应页；按用户「46 全部补齐」确认，实现为限定新中转仓（新裁床）的配料 All 变体页（参照老中转仓 All 页）。
- 多出项 2（登记不改）：成衣管理组「拣货单管理」指向 wave-manage（已注册），测试环境该组无此项；保留（不影响占位对齐）。
- 老中转仓「裁片配料单」指向 FCS `/fcs/material-prep/cutting`（2026-10-13 既有对齐决定），保留。
- 调拨待交出/调拨交出：测试环境后端方法不存在；原型按同模块兄弟页模式实现。

## 7. 泳道写范围契约（防并行冲突）

- 各泳道**只写**：自己域的 `src/pages/wls/<domain>/**` 新页面文件 + 自己域的种子（见分组表）+ 各自 `src/pages/wls/<domain>/routes.ts` 路由片段导出（形状抄 routes-wls.ts exactRoutes 条目：`{ path, render }`）。
- **任何泳道不得写** `src/router/routes-wls.ts`、`src/router/routes.ts`、`src/data/app-shell-config.ts`——由调和阶段统一合并。
- 种子文件归属：finished-seed.ts→L1；stock-seed.ts + shared-seed.ts→L2；transit-seed.ts→L4；raw-seed.ts→L5；新页面种子放各自域目录。
- 裁剪种子时保持明细/引用同步与状态分布；目标 11-20 条（取 ~16）。
- 不运行 `npm run build`（调和后统一构建）；可运行 `npx tsc --noEmit` 自查类型。
