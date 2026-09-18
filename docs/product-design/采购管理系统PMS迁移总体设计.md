# 采购管理系统（PMS）迁移总体设计

- 版本：2026-09-18
- 状态：现行
- 来源：`docs/product-requirements/采购管理系统PMS产品需求说明文档.md`
- 替代：无（SRM 源项目不在本仓库，仅有迁移决策记录）
- 当前阶段：P1–P4 全部已实现待验证，等待产品确认转“已验证”
- 实施工作树：`/Users/laoer/Documents/higoods/.worktrees/pms`，分支 `codex/pms-srm-migration`
- 最终代码版本：`codex/pms-srm-migration`（基线 `4804328a` + P1–P4 未提交改动）
- 验证证据：`docs/prototype-review-records/2026-09-18-pms-procurement-migration-p1..p4.md`、`docs/product-design/采购管理系统PMS迁移逐页功能验证清单.md`、`/private/tmp/pms-p4-task-receipt.json` 与 `/private/tmp/pms-audit-task-receipt.json`、`tests/pms-*.spec.ts`

## 1. 背景与迁移原则

SRM 是一个 React 19 单页原型，使用 `App.tsx` 集中管理 15 组跨页状态与页签，页面内大量 `useState/useEffect`，无持久化与路由库。目标仓库 higoods 使用 Vanilla TypeScript 字符串模板、路由 registry、模块级 domain runtime 和统一组件库。

迁移原则：

1. **业务保真**：对象、状态、数量公式、阻断规则、Mock 数据规模保持与 SRM 一致；已确认业务事实优先。
2. **架构对齐**：页面改为 higoods 页面契约（渲染函数 + 事件入口 + 模块级 state），数据改为 `src/data/pms/` 独立域。
3. **视觉统一**：复用 `src/components/ui` 与现有页面模式，不还原 SRM 的 React 视觉。
4. **边界稳定**：现有 `/pms/purchase-order`（花边辅料采购订单）及其 FCS/WLS 联动不改动；迁移页面使用独立路由前缀。
5. **治理合规**：列表页走标准列表契约，图片满足硬门禁，性能低于 200ms，每批留审查记录与收据。

## 2. 范围与非范围

### 2.1 范围

- SRM 侧栏 11 组 30 个有入口页面，全部迁移到 `/pms/*`。
- 中转看板可达的 2 个子页（生产单校验、配料任务）。
- BOM/样板管理的整页详情（SPU 维度）。
- 每页所需的 Mock 数据、状态规则、图片素材映射、页面事件与跨页导航。
- 菜单、路由、事件处理、默认页、治理脚本接入。

### 2.2 非范围

| 排除项 | 原因 |
| --- | --- |
| 21 个无入口页面（warehouse/、supplier-collaboration/、reports/、procurement-plan/、purchase/ 等） | 无菜单入口，不构成用户可见能力 |
| 3 个不可达 staticViews 包装页（做货/成衣/样衣采购单）、商品采购对账 | 被统一视图替代或无入口 |
| 通用对账死视图（应付明细池、对账单管理、付款记录） | 仅物流费用对账可达，其余无入口 |
| `MaterialPreparation` 备货单模块（1836 行） | 未挂菜单，不属于本次确认的 30 页范围 |
| SRM 壳层（Layout/Header/Sidebar/TabsNav、角色切换、主体切换、菜单搜索框） | higoods 壳层已提供系统切换与多页签 |
| `src/assets/hero.png` 等未引用资源 | 无用户可见用途 |
| 真实后端、权限、离线、打印驱动 | 项目技术边界 |

### 2.3 保留不动的现有资产

- `/pms/purchase-order` 页面、偏好键 `higood:list:/pms/purchase-order`、FCS handler 认领逻辑、4 个打印测试与生产对象总览的“查生产”入口。
- PCS 档案、FCS 花边域、WLS 事实源；PMS 新页面通过单号弱关联，不做跨域写入。
- 删除旧占位菜单 `/pms/supplier`、`/pms/contract`（从未实现），不留兼容跳转。

## 3. 目标架构

### 3.1 目录与文件

```text
src/pages/pms/                      # 新 PMS 页面目录（kebab-case 文件）
  shared.ts                         # 状态徽章/数量/图片/反馈/字段读取等页面共享工具
  workbench.ts                      # 工作台
  purchase-suggestions.ts           # 商品采购建议
  kol-demands.ts                    # KOL 采购需求
  product-purchase-orders.ts        # 商品采购单
  ...（按批次补齐）
src/data/pms/                       # PMS 独立业务域
  runtime.ts                        # 序号、actionId、审计日志、数量取整、领域错误
  suppliers.ts / trade-subjects.ts / units.ts / warehouses.ts
  materials.ts / product-skus.ts / bom-templates.ts
  purchase-suggestions.ts
  product-purchase-orders.ts
  material-requirements.ts
  material-purchase-orders.ts
  first-leg-logistics.ts
  supplier-confirmations.ts
  reconciliations.ts / payment-requests.ts
  inventory-monitor.ts / transit-warehouse.ts / settings.ts
  images.ts                         # 图片路径常量与对象映射
src/router/routes-pms.ts            # PMS RouteRegistry（exact + dynamic）
src/router/route-renderers-pms.ts   # 懒加载 renderer 包装
src/main-handlers/pms-handlers.ts   # 表驱动 PMS 事件分发
```

### 3.2 路由注册

- `src/router/routes.ts` 增加 `pmsRoutesPromise`、`getPmsRoutes()`，并在 `getRoutesByPathname` 增加 `pathname.startsWith('/pms')` 分支（与 `/pcs` 对齐，不采用 `resolvePage` 硬编码正则）。
- `/pms` 与 `/pms/` 根路径使用 `renderRouteRedirect('/pms/workbench/overview')`。
- 动态路由：`/pms/bom-templates/:spu`（`decodeURIComponent`），其余页面为 exact。
- `/pms/purchase-order` 继续保留在 `exactBaseRoutes`，由 `routes-pms` 之外的现有实现承载；PMS registry 不重复注册该路径。

### 3.3 菜单与壳层

- `src/data/app-shell-config.ts` 的 `systems.pms.defaultPage` 改为 `/pms/workbench/overview`。
- `menusBySystem.pms` 重建为与 SRM 一致的 11 组菜单，href 全部指向 `/pms/*`；每个 href 必须有精确路由。
- 多页签、菜单高亮、Tab 恢复由现有 `appStore` 自动处理，页面无需自建页签。
- 旧菜单项 `supplier`（`/pms/supplier`）、`contract`（`/pms/contract`）删除；`purchase-order` 保留。

### 3.4 页面契约

每个页面遵循现有约定：

```ts
// @page-pattern: list | detail | form | dashboard
export function renderPmsXxxPage(): string
export function handlePmsXxxEvent(target: HTMLElement, event?: Event): boolean
const ROOT_SELECTOR = '[data-pms-xxx-root]'
const EVENT_PREFIX = 'pms-xxx'
```

- 根节点带 `data-skip-page-rerender="true"`；本地交互只在 `root.innerHTML` 局部刷新，不做整页重绘。
- 列表页使用 `createProcessOrderListController` + `renderStandardListPage` + `renderStandardListTable` + `renderTablePagination`，偏好键 `higood:list:<route>`。
- overlay 使用判别联合 state；关闭走 `close-overlay`；`Esc` 在事件入口处理。
- 业务命令在 `src/data/pms/*` 内以函数 + `PmsDomainError` 实现，页面捕获后写入 `overlayError` 或页内 feedback。

### 3.5 事件接线

- 新建 `src/main-handlers/pms-handlers.ts`，采用 `PcsHandlerSpec` 风格的表驱动：`matches(pathname)` + `importModule` + `eventExport`。
- `src/main.ts`：新增 `pmsHandlers` loader、`getCurrentHandlerSystem` 返回 `'pms'`、`dispatchPageEvent` 调用 `dispatchPmsPageEvent`。
- 现有 `/pms/purchase-order` 的 FCS 认领路径保持不变（`pms` 分支只处理 `routes-pms` 注册的路径）。

### 3.6 跨页状态

SRM 的 App 级状态改为 PMS runtime + 路由导航，保持“刷新丢失”语义：

| SRM 状态 | 目标 |
| --- | --- |
| suggestions / kolDemands | `purchase-suggestions.ts` runtime |
| materialOrders / importedLogistics | `material-purchase-orders.ts` runtime |
| transferBatches | `first-leg-logistics.ts` runtime |
| firstLegCarriers / Channels | `first-leg-logistics.ts` runtime |
| payables / reconciliationOrders / paymentRecords | `reconciliations.ts` runtime |
| logistics/materialPaymentDraft | `payment-requests.ts` runtime 草稿槽位 |
| targetFirstLegNo / transitFilter | 跳转时写入 runtime 瞬时筛选，页面消费后清空 |

跨页动作通过 `appStore.navigate('/pms/...')`；目标页面在渲染入口读取并消费瞬时筛选。

## 4. 路由与菜单全表

| 批次 | 菜单 | 路由 | 模式 | 页面文件 |
| --- | --- | --- | --- | --- |
| P1 | 工作台 / PMS 首页 | `/pms/workbench/overview` | dashboard | `workbench.ts` |
| P1 | 商品采购建议 | `/pms/purchase-suggestions` | list | `purchase-suggestions.ts` |
| P1 | KOL 采购需求 | `/pms/kol-demands` | list | `kol-demands.ts` |
| P1 | 商品采购单 | `/pms/product-purchase-orders` | list | `product-purchase-orders.ts` |
| P2 | 面辅料需求分析 | `/pms/material-requirements` | list | `material-requirements.ts` |
| P2 | 面辅料采购单 | `/pms/material-purchase-orders` | list | `material-purchase-orders.ts` |
| P2 | 面辅料采购跟踪 | `/pms/material-purchase-tracking` | list | `material-purchase-tracking.ts` |
| P2 | 面辅料供应商确认单 | `/pms/material-supplier-confirmations` | list | `supplier-confirmations.ts` |
| P2 | 头程物流 | `/pms/first-leg-shipments` | list | `first-leg-shipments.ts` |
| P2 | 头程物流商管理 | `/pms/first-leg-carriers` | list | `first-leg-carriers.ts` |
| P3a | 贸易主体管理 | `/pms/trade-subjects` | list | `trade-subjects.ts` |
| P3a | 商品供应商管理 | `/pms/suppliers` | list | `suppliers.ts` |
| P3a | 供应商供货档案 | `/pms/supplier-supply-archives` | list | `supplier-supply-archives.ts` |
| P3a | 面辅料列表 | `/pms/material-archives` | list | `material-archives.ts` |
| P3a | 成衣列表 / 样衣列表 | `/pms/garment-skus`、`/pms/sample-skus` | list | `product-skus.ts` |
| P3a | 仓库管理 / 单位管理 | `/pms/warehouses`、`/pms/units` | list | `warehouses.ts`、`units.ts` |
| P3a | BOM/样板管理 | `/pms/bom-templates`、`/pms/bom-templates/:spu` | list + detail | `bom-templates.ts`、`bom-detail.ts` |
| P3b | 主体经营明细 | `/pms/subject-operations` | list | `subject-operations.ts` |
| P3b | 面辅料采购对账 | `/pms/material-reconciliations` | list | `material-reconciliations.ts` |
| P3b | 面辅料采购请款 | `/pms/material-payment-requests` | list + 抽屉 | `material-payment-requests.ts` |
| P3b | 物流费用对账 | `/pms/logistics-reconciliations` | list | `logistics-reconciliations.ts` |
| P3b | 物流费用请款 | `/pms/logistics-payment-requests` | list + 抽屉 | `logistics-payment-requests.ts` |
| P4 | 面辅料库存监控 | `/pms/material-inventory` | dashboard + list | `material-inventory.ts` |
| P4 | 中转数据总览 | `/pms/transit/dashboard` | dashboard | `transit-dashboard.ts` |
| P4 | 中转收货单列表 | `/pms/transit/receipts` | list | `transit-receipts.ts` |
| P4 | 生产单校验 / 配料任务 | `/pms/transit/order-checks`、`/pms/transit/preparation-tasks` | list | `transit-simple-lists.ts` |
| P4 | 用户 / 角色 / 字典 | `/pms/users`、`/pms/roles`、`/pms/dictionaries` | list（结果页） | `settings-users.ts`、`settings-roles.ts`、`settings-dictionaries.ts` |
| 保留 | 采购订单（花边辅料） | `/pms/purchase-order` | list | `src/pages/pms-purchase-orders.ts`（不动） |

## 5. 组件与模式映射

| SRM 组件 | higoods 目标 |
| --- | --- |
| DataTable | `renderStandardListTable`（controller 组合） |
| FormModal / DetailModal | `renderFormDrawer` / `renderDetailDrawer` |
| ConfirmModal | `renderConfirmDialog` / `renderSimpleConfirmDialog` |
| StatusBadge | `renderStatusBadge` + 页面状态映射 |
| StatCard | `renderStandardListStats` / `renderStatCards` |
| SearchBar / 筛选 | 页面查询卡片 + `renderSearchInput` / `renderSelect` |
| ProgressSteps | `renderSteps` |
| Toast | 页内 feedback banner（沿用 `renderLaceFeedback` 模式）+ `renderToast`（跳转型提示） |
| DesignLogicCard | `renderCollapse` + `renderTable` |
| TabsNav | higoods `appStore` 多页签 |
| lucide-react | `<i data-lucide="...">` + `hydrateIcons`（只扫描新插入子树） |
| qrcode 包 | `renderRealQrPlaceholder`（React 隔离挂载，合规） |
| `utils/excelImport.ts` | 移植为 `src/utils/pms-excel-import.ts`（自研、无新依赖） |
| CSV/伪 xls 导出 | 提取 `src/utils/pms-export.ts` |
| contentEditable 富文本 | 受控 textarea（有意简化，登记例外） |
| `window.confirm` | 统一确认弹窗，保留二次确认事实 |

## 6. 数据域设计

`src/data/pms/runtime.ts` 提供：`nextPmsSequence(prefix)`、`nextPmsActionId()`、`appendPmsLog(entry)`、`roundPmsQty(value)`、`PmsDomainError`、`normalizePmsEventTime`。日志字段与 `LaceOperationLog` 对齐（`objectType/action/beforeValue/afterValue/reason/actorId/actorName/actorRole/occurredAt/timeZone/source: 'PMS'/relatedObject*/secondConfirmation`）。

各域文件职责：

- 静态 Mock 保持 SRM 规模（供应商 10、物料 14、单位 20、BOM 8、商品采购单 12、KOL 6、建议 8 SPU、面辅料采购单 8、对账 10、应付 22 等），确保字段组合、多状态、差异、异常、图片与操作记录充足。
- 每个业务命令写日志并返回新视图，UI 只读投影；不允许页面直接改写域数组。
- 时间统一 ISO 带时区（`+07:00`），展示用 `formatJakartaTime` 同类格式化；数量统一 `roundPmsQty`。
- 不引入 localStorage 业务台账；列偏好除外（沿用 `higood:list:<route>`）。

### 6.1 核心数量与金额公式

| 公式 | 定义 |
| --- | --- |
| 采购缺口 | `max(0, 待发货 + KOL 申请 − 采购中 − 实时库存)` |
| 建议采购量 | `ceil(缺口 × 折扣)`，爆款 0.7、热销 0.6，其余 1.0 |
| BOM 需求 | `SKU 数量 × 单件用量 × (1 + 损耗)` |
| 面辅料建议采购量 | `max(0, BOM 需求 − 库存 − 采购中)`，按物料 + 仓库 + 供应商聚合 |
| 包装换算 | 基础单位 ↔ 包装数 ↔ 箱数；成衣箱数向上取整 |
| 对账最终应付 | `采购货款 + 国内物流费 + 调整金额` |
| 对账差异 | `供应商账单 − 最终应付` |
| 物流费用合计 | 7 项费用之和（预计/实际两层） |

## 7. 图片素材方案

### 7.1 映射

| SRM 对象 | 目标素材 |
| --- | --- |
| 男款圆领T恤 HG-TS-2601 | `/tshirt-sample.jpg` |
| 女款休闲裤 HG-PT-2602 | `/pants-sample.jpg` |
| 轻薄夹克 HG-JK-2605 | `/jacket-sample.jpg` |
| 商务衬衫 HG-SH-2607 | `/shirt-sample.jpg` |
| 180g 纯棉针织布 | `/materials/fabric-main.jpg` |
| 220g 涤棉卫衣布 | `/materials/fabric-contrast.jpg` |
| 里布类物料 | `/materials/fabric-lining.jpg` |
| 32S 棉纱 / 涤纶缝纫线 | `/materials/yarn-stitching.jpg` |
| YKK 拉链 | `/materials/accessory-zipper.jpg` |
| 四眼纽扣 | `/materials/accessory-button.jpg` |
| 织唛 | `/materials/accessory-label.jpg` |
| 松紧带类 | `/materials/accessory-elastic-band.jpg` |

### 7.2 缺图登记（已解决）

原 SRM 演示对象中的连帽卫衣、包材 4 类（牛皮纸吊牌、透明胶袋、五层纸箱、印花贴纸）、防潮珠、成衣/样衣等缺图对象，已通过复用仓库真实素材或替换为有实拍图的演示对象解决：连帽卫衣使用 `production-confirmation-demo/grey-zip-hoodie.png`，女款半身裙调整为女款连衣裙（`dress-sample-1.jpg`），牛皮纸吊牌/五层纸箱/印花贴纸/防潮珠替换为白色府绸、涤棉里布、灰色罗纹布、弹力松紧带 4 个有真实素材的物料。P3a 完成后全部 14 个物料与全部款式均有真实素材，无缺图阻塞对象。

## 8. 批次与依赖

| 批次 | 内容 | 依赖 |
| --- | --- | --- |
| P0（随 P1） | 文档、路由/事件/数据基建、菜单、脚本接入 | 无 |
| P1 | 工作台、采购建议、KOL 需求、商品采购单 | P0 |
| P2 | 面辅料需求、采购单、跟踪、确认、头程物流、物流商 | P1（商品采购单生成需求） |
| P3a | 基础资料 + BOM 详情 | 可并行于 P2 后半 |
| P3b | 对账与请款 | P2（采购单/物流事实） |
| P4 | 库存监控、中转仓、系统设置 | 可与 P3 并行，收尾统一验收 |

## 9. 治理接入

- `scripts/check-menu-routes.mjs`：把 `pms` 加入 `EXACT_ROUTE_SYSTEMS`，把 `routes-pms.ts` 加入 `routeModulePaths` 与 `DEFAULT_SYSTEMS`，使 PMS 菜单/路由一致性进入门禁。
- `scripts/workflow-governance/affected-checks.ts`：`src/pages/pms`、`src/data/pms`、`routes-pms`、`pms-handlers` 命中时路由到 `check:list-page-governance`、`check:menu-routes`、PMS 专项检查与 `build`。
- 新增 `scripts/check-pms-purchase-chain.ts`：P1 起验证建议→采购单链路、路由可达、图片字段与状态口径。
- 性能：每页在 `scripts/check-pms-performance.ts` 逐交互入口测量，输出原始耗时；阈值严格 `< 200ms`。
- 测试：每页 `tests/pms-<module>.spec.ts`；公式单测 `tests/unit/pms-*.test.ts`。

## 10. 风险与待确认

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 缺真实素材 | 图片硬门禁阻塞 | 7.2 登记 + 批次内补素材；未补齐不标完成 |
| 30 页体量大 | 交付周期长 | 4 批交付，每批独立验收与收据 |
| 与现有 lace 采购页同名概念 | 用户误解 | 菜单分组区分“商品/面辅料采购单”与“采购订单（花边）” |
| 性能证据工作量大 | 每批验收慢 | 性能脚本统一采集、逐页输出 |
| 角色/权限页面无全局模型 | 演示不真实 | 结果展示页 + 审查记录登记 |
| 富文本降级 | 功能缩水 | 文档与审查记录登记 |

---

## 11. 第二轮字段级补全（G1–G11，批次 A–F）

事实来源：2026-09-18 直接读取 SRM 页面/类型/mocks 的第二轮核对；缺口编号见《采购管理系统PMS迁移逐页功能验证清单》第 15 节。所有新增命令沿用 `src/data/pms/` 域 + `appendPmsLog` + `PmsDomainError` 模式，页面继续保持标准列表/抽屉模式。

### 11.1 批次 A：头程物流字段与批量动作（G1、G2）

- 提货信息字段：提单号、提单号备注、船司名（均选填文本）；货源地区（中国/印尼/美国/其他）；仓库、区域、货运公司（选填文本）；货运类型（空运/海运/陆运/快递）。
- 费用明细字段：物流费 RMB、物流费 USD、所得税 IDR、增值税 IDR、关税 IDR、罚款 IDR、清关费 IDR；必须为非负有限数字，默认 0，非法输入阻断保存。
- 入库状态：待交货/已交货/已发货/已入库，默认待交货；与头程流转状态（待起运→已装柜→头程中→已到仓→已完成）相互独立。
- 预计送达万隆时间：日期，选填，格式 YYYY-MM-DD。
- 列表、详情、导出展示提单号、船司、货运类型、入库状态、预计送达与费用明细合计。
- 批量动作：列表勾选多张头程单可批量装柜（仅待起运）与批量确认出运（仅已装柜），逐条写入节点时间并落日志；不满足条件行自动跳过并返回条数反馈。

### 11.2 批次 B：对账双层费用与部分确认（G3–G5）

- 面辅料对账增加实际层字段：实际单价、实际采购货款、实际国内物流费（未填时按预计层显示与计算）；预计/实际两层同时展示，最终应付与差异由系统重算。
- 行编辑：实际单价、实际采购货款、实际国内物流费、供应商账单、调整金额、发票号在同一编辑入口保存；实际采购货款可由实际单价 × 采购数量一键回填；已确认记录锁定。
- 分项确认：采购货款、国内物流费、供应商账单、调整金额四项可逐项确认（confirmedFeeKeys）；未全部确认时状态展示“部分确认”，全部确认后仍须差异确认为 0 或已确认差异才能“确认对账”。
- 批量确认/批量部分确认：勾选多条记录，批量确认全部费用项或指定费用项；已确认记录自动跳过。
- 供应商账单导入升级为 9 列：采购单号、物料编码、实际单价、实际采购货款、实际国内物流费、供应商账单、调整金额、备注、对账编号（对账编号选填）；按“采购单号 + 物料编码”匹配记录，覆盖实际层字段并重算；存在无法匹配或非法值行时整体阻断并列出错误行号；导入不自动确认。
- 物流对账口径修正：行差异 = 实际合计 − 预计合计对应结算口径（账单金额 − 实际合计不变用于对账单差异），新增“部分确认”状态（任一分项已确认且未全部确认）；新增物流商、运输方式筛选；新增运单号/货件号/签收数量/发出数量/签收数量列（取回头程关联物流记录）；导入模板 12 列（头程单号 + 物流商 + 运单号 + 货件号 + 7 项实际费用 + 备注）。

### 11.3 批次 C：请款单字段与记录（G6）

- 创建页字段：收款人（名称、简称、币种、开户行、账号、SWIFT、地址、联系人、电话）；付款信息（付款类型、付款主体、付款方式、款项性质、申请人、申请部门、付款备注）；金额信息（请款金额、币种、汇率、折算本位币金额、金额大写）；付款说明（用途说明、费用明细说明、补充说明）。
- 附件：支持添加附件（名称 + 说明）与删除；展示在请款记录中。
- 付款动作：申请付款弹窗支持全款/部分付款、付款日期、财务备注；付款登记记录付款方式、凭证号、备注；付款记录与请款记录在详情中分行展示。
- 校验：请款金额必须大于 0 且不超过来源对账可请款金额；已作废不可再付款；部分付款后可继续付款直至付清。

### 11.4 批次 D：库存监控加工工序链与生成记录（G7）

- 规则字段扩展：加工工序链（染色/印花/绣花/花边，可勾选并排序）；坯布匹配（坯布 SPU/SKU、坯布名称）；调拨资格要求坯布库存 > 0。
- 生成采购单弹窗字段：供应商、采购地区（国内/印尼）、使用类型（成衣破货/样衣破货/成衣破货补采/成衣破货备货/kol样品小单，与 SRM 一致）、SKU 勾选、每 SKU 数量。
- 生成调拨单弹窗字段：调出仓库、调入目标（区域/仓库）、是否同步生成加工单。
- 生成记录：记录类型、生成单号（采购单/调拨单）、加工单号链（同步生成时）、操作人、时间；支持展开查看明细。
- 维护动作：批量刷新库存（写日志并更新时间）、手动添加监控 SKU、启停监控规则；筛选支持关键词/物料/状态/仓库/工序/调拨资格。

### 11.5 批次 E：供应商确认单打印与箱规（G8）

- 生成卷号弹窗字段：卷号前缀、每卷米数、每卷重量、起始序号；生成结果写入包装明细并参与打印。
- 箱规表：可为确认单添加箱号、长、宽、高、体积与备注。
- 包模式：可在确认单内新增包装明细行（包装方式、数量、单位）。
- 标签：下载 PNG（生成标签图片文件）；打印记录保留打印次数与重打。
- 详情操作：上一张/下一张按当前查询结果顺序切换。

### 11.6 批次 F：基础资料字段扩展（G9–G11）

- 物料档案申报扩展：品牌类型（无品牌/自有品牌/授权品牌）、申报品牌名称、申报品牌英文名、产品型号、特殊属性（26 项复选，值集与 SRM 完全一致：普货/带电带磁/带电/带磁/弱磁/纯电池/低功率电池/高功率电池/木制品/纺织品/皮具/粉末/食品/纯液体/带液体/少量液体/带游离液体/危险品/膏体/管制刀具/防疫用品/仿牌/敏感货/车载产品/充电设备/金属）、其他申报要素；报关扩展：是否报关、法定第二计量单位与数值、其他申报要素；扩展：是否需质检、库存单位、单位换算关系（选填）、采购区域（国内/印尼/其他）、币种（RMB/USD/IDR）。
- BOM 业务选项 8 项：是否打样、是否开版（2 组 radio）；需要印花、需要绣花（2 项 checkbox）；开发状态（待打板/打板中/已完成）、审核状态（待审核/已通过/已驳回）、生产方式（工厂生产/外采成衣/样衣开发）、运输方式（国内快递/物流专线/工厂送货，4 个枚举 radio，取值与 SRM 一致）；价格/成本 8 字段（建议售价、单件重量、单位成本、总成本、采购价、运费、包装费、目标毛利率）；工厂 6 字段；布料/辅料/工艺 6 字段；4 个说明 textarea；分类过滤 5 项。
- 主体经营明细：成本明细 9 项（采购成本、国内段运费、头程海运费、目的港费、末端配送费、关税、增值税、清关费、其他费用）加调整金额；展示收入状态、已确认收入与数据缺失提醒。

## 12. 第二轮批次与依赖

| 批次 | 内容 | 依赖 |
| --- | --- | --- |
| A | 头程字段与批量动作 | P2/P3b（对账引用头程） |
| B | 对账双层与部分确认、账单导入 9 列、物流对账口径 | P3b |
| C | 请款单字段与记录 | B（金额校验依赖对账） |
| D | 库存监控加工链 | P4 |
| E | 供应商确认打印与箱规 | P2 |
| F | 基础资料字段扩展 | P3a |

批次 A–F 完成后统一回归：专项检查、单测、5 个页面 spec、治理脚本、性能门禁与任务收据。

---

## 13. 第三轮独立复核对齐（M1–M7、P3）

事实来源：独立只读复核（SRM 全文 ↔ 迁移实现）后经主代理逐条核验；本轮只做“与 SRM 精确对齐 + 明细列补齐”，不改变页面结构与流程。

### 13.1 枚举对齐（逐字与 SRM 一致）

- 物料品牌类型：无品牌 / 自有品牌 / 授权品牌（替换自拟 OEM/ODM/白牌）。
- 物料特殊属性：26 项与 SRM 完全一致（普货、带电带磁、带电、带磁、弱磁、纯电池、低功率电池、高功率电池、木制品、纺织品、皮具、粉末、食品、纯液体、带液体、少量液体、带游离液体、危险品、膏体、管制刀具、防疫用品、仿牌、敏感货、车载产品、充电设备、金属）。
- 物料采购区域含“其他”，币种含 IDR，并在域命令加白名单校验。
- BOM 业务选项取值：开发状态 待打板/打板中/已完成；审核状态 待审核/已通过/已驳回；生产方式 工厂生产/外采成衣/样衣开发；运输方式 国内快递/物流专线/工厂送货。
- 库存监控使用类型：成衣破货 / 样衣破货 / 成衣破货补采 / 成衣破货备货 / kol样品小单。
- 供应商：类型（面料/辅料/纱线/包材供应商、成衣工厂、样衣工厂、综合供应商）、等级（A/B/C 级、临时供应商）、付款方式（预付/月结/到货后付款/对账后付款）、币种（RMB/USD/IDR）、交货方式（供应商直发海外仓/发至中国中转仓/采购方自提/货代上门提货）。
- 仓库类型：面辅料仓 / 加工仓 / 成衣仓 / 样衣仓 / 中转仓 / 退货仓。
- 单位类型：长度 / 重量 / 数量 / 包装 / 面积 / 体积（不再包含“时间”）。
- 中转收货状态：待收货 / 收货中 / 已收货；异常按差异数量独立呈现，不再作为收货状态。
- 生产单校验：缺货 / 未收齐 / 已收齐；配料任务类型：已收齐配料 / 未收齐配料。

### 13.2 字段补齐（按 SRM 字段集）

- 物流商：邮箱、微信、联系地址、账期天数、开票信息、银行账户、收款人、支持运输方式、支持目的地、是否支持报税/清关/派送。
- 渠道：最短/最长时效、截单时间、发车频率、计费重系数、体积重除数、最低计费重量、首重/续重价格、含税、包清关、包派送、报税说明、目的国家、适用区域、转运中心、带电/液体/敏感货/普货支持、最大单箱重量/体积。
- 头程批次：列表与详情展示总箱数、总重量、总体积、转运天数，并同步导出。
- 供应商：国家/地区、省市、微信、开票信息、银行账户、默认交货方式；只读协同指标（累计采购单数/金额、准时交付率、质量合格率）。
- 商品采购单：单据级采购专员、是否加急、是否首单、采购区域（含其他）；明细级 BOM 编号/版本/状态、申请人、添加人、单件重量、行金额与汇总。
- 仓库：属性、主体、时区、邮箱、邮编、WMS 来源编码、同步状态与备注、可采购申请/下单/发货开关、关联单量、最近使用。
- 面辅料需求：历史库存、ID 历史库存两列。

### 13.3 记录的接受项

- 头程新建批次未提供重量/体积输入，新批次聚合展示为空（“—”），种子批次完整展示。
- 物料币种允许 IDR，但种子无 IDR 物料示例（供应商种子含 IDR）。
- 中转任务/收货单筛选数量仍按 PMS 标准列表治理收敛（§13.1-13）。
