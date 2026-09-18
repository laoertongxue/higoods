# 采购管理系统（PMS）迁移需求追踪与交付矩阵

- 版本：2026-09-18 v1.0
- 来源文档：`docs/product-requirements/采购管理系统PMS产品需求说明文档.md`（下称 PRD）、`docs/product-design/采购管理系统PMS迁移总体设计.md`（下称 设计）、`docs/implementation-plans/采购管理系统PMS迁移实施计划.md`（下称 计划）
- 当前阶段：P1–P4 与第三轮独立复核对齐全部“已验证”（本地证据闭环），等待产品确认转 `accepted`
- 状态口径：仅使用 `待实施`、`实施中`、`已实现待验证`、`已验证`、`已阻塞`、`不适用`
- 证据位置约定：专项检查 `scripts/check-pms-*.ts`；单测 `tests/unit/pms-*.test.ts`；页面验收 `tests/pms-*.spec.ts` + 浏览器证据；治理记录 `docs/prototype-review-records/`；收据 `<临时目录>/task-receipt.json`
- 确认人：产品确认前状态最高为 `已验证`；确认后记录 `accepted` 与确认版本

## 1. 范围与边界

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-SCOPE-001 | PRD§1.2/设计§2.1 | 迁移 SRM 30 个有菜单入口页面 + 2 个中转子页 + BOM SPU 整页详情 | WP0-WP4 | `src/pages/pms/*`、`routes-pms.ts` | `check-pms-purchase-chain.ts` | 30+3 命名路由可达 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |
| PMS-SCOPE-002 | 设计§2.2 | 21 个无入口页面、3 个不可达包装页、通用对账死视图、备货单模块不迁移 | WP0 | 不存在对应路由/文件 | `check-menu-routes` | 菜单无对应入口 | 不适用 | 设计§2.2 | 待产品确认 v1.0 |
| PMS-SCOPE-003 | 用户确认 | 现有 `/pms/purchase-order` 页面、偏好键与 FCS 联动保持不动 | WP0.1 | `src/pages/pms-purchase-orders.ts` | 既有 lace 检查、打印边界测试 | `/pms/purchase-order` 回归 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-SCOPE-004 | 设计§3.3 | 删除旧占位菜单 `/pms/supplier`、`/pms/contract`，不留兼容跳转 | WP0.1 | `app-shell-config.ts` | `check-menu-routes` | 菜单中不存在两项 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-SCOPE-005 | 设计§3.1 | PMS 使用独立数据域，不写入 FCS/PCS/WLS 事实源 | WP0.3 | `src/data/pms/*` | `tests/unit/pms-runtime.test.ts` | 跨系统页面无回归 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |

## 2. 菜单、路由与事件

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-MENU-001 | 设计§3.3/§4 | PMS 菜单按 11 组重建，每个 href 有精确路由 | WP0.1 | `app-shell-config.ts` `menusBySystem.pms` | `check-menu-routes`（含 pms） | 菜单逐项点击可达 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |
| PMS-MENU-002 | 设计§3.3 | PMS 默认页改为 `/pms/workbench/overview` | WP0.1 | `app-shell-config.ts` `systems` | `check-menu-routes` | 系统切换落在工作台 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-MENU-003 | PRD§12.1 | 每个迁移页面可开 Tab、标题与高亮正确、无占位文案 | WP1-WP4 | `appStore` 菜单同步 | 页面 spec | 浏览器 Tab 验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |
| PMS-ROUTE-001 | 设计§3.2 | 新建 PMS registry 与懒加载 renderer，按前缀分发 | WP0.1 | `routes-pms.ts`、`route-renderers-pms.ts`、`routes.ts` | `build`、`check-menu-routes` | 冷启动直达页面 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-ROUTE-002 | 设计§3.2 | `/pms` 与 `/pms/` 重定向到工作台 | WP0.1 | `routes.ts` | 路由冒烟 | 地址栏重定向正确 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-ROUTE-003 | 设计§4 | BOM 详情使用动态路由 `/pms/bom-templates/:spu` | WP3a | `routes-pms.ts` dynamicRoutes | 页面 spec | 详情直达与返回 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |
| PMS-EVT-001 | 设计§3.5 | PMS 事件由 `pms-handlers` 表驱动分发，main.ts 接线 | WP0.2 | `pms-handlers.ts`、`main.ts` | `build`、页面 spec | 点击/输入/change 生效 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-EVT-002 | 设计§3.5 | `/pms/purchase-order` 仍由 FCS handler 认领，不被 PMS 接管 | WP0.2 | `fcs-handlers.ts` 不变 | 既有 lace 检查 | 花边页交互回归 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |

## 3. 列表、图片、性能与治理

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-LIST-001 | 设计§3.4 | 全部标准列表页声明 `@page-pattern: list` 并满足标准契约 | 各 WP | `src/pages/pms/*` | `check:list-page-governance` | 列表结构逐页验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |
| PMS-LIST-002 | PRD§12.3 | 查询卡片含可用查询/重置/导出；导出为当前条件下全量且不含操作列 | 各 WP | 页面查询卡片与导出函数 | 页面 spec | 浏览器导出结果 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-LIST-003 | PRD§12.3 | 统计卡与查询结果同数据范围，状态卡可作快捷筛选 | 各 WP | 页面统计渲染 | 页面 spec | 查询后统计一致 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-LIST-004 | 设计§3.4 | 列设置/排序/冻结/每页条数按路由持久化，当前页与排序不持久化 | 各 WP | `process-order-list-controller` | 页面 spec | 刷新后偏好保留 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-IMG-001 | PRD§9/设计§7 | 每个款式/物料有对应真实图片，缩略图与名称/编码同单元格或同信息块 | 各 WP | `src/data/pms/images.ts` | `check-pms-images.ts` | 逐页图片验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |
| PMS-IMG-002 | PRD§9 | 缩略图可点击查看大图，支持关闭/遮罩/Esc，加载与失败态可见 | 各 WP | `src/pages/pms/shared.ts` | 页面 spec | 大图弹窗与失败态 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-IMG-003 | 设计§7.2 | 缺图对象登记且相关页面不标完成 | 各 WP | 矩阵本行 | 人工核查 | 缺图清单 | 不适用 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`（已完成素材替换，无缺图对象） | 待产品确认 v1.0 |
| PMS-PERF-001 | 计划§WP5/用户确认 | 每个页面首次进入与站内切换严格 `<200ms` | 各 WP | 页面懒加载与首屏数据 | `check-pms-performance.ts` | 浏览器原始耗时 | 已验证 | `/private/tmp/pms-p1-task-receipt.json`（state=verified） | 待产品确认 v1.0 |
| PMS-PERF-002 | 计划§WP5 | 每个可交互入口每项 ≥5 次实测严格 `<200ms` | 各 WP | 局部 DOM 更新 | `check-pms-performance.ts` | 浏览器原始耗时 | 已验证 | `/private/tmp/pms-p1-task-receipt.json`（state=verified） | 待产品确认 v1.0 |
| PMS-GOV-001 | 计划§0 | 每批交付完整原型审查记录 | 各 WP | `docs/prototype-review-records/` | `check-prototype-design-governance -- --all` | 不适用 | 已验证 | `/private/tmp/pms-p1-task-receipt.json`（state=verified） | 待产品确认 v1.0 |
| PMS-GOV-002 | 设计§9 | PMS 变更接入菜单路由与受影响检查门禁 | WP0.4 | `check-menu-routes.mjs`、`affected-checks.ts` | `check:menu-routes`、`check:affected` | 不适用 | 已验证 | `/private/tmp/pms-p1-task-receipt.json`（state=verified） | 待产品确认 v1.0 |
| PMS-GOV-003 | 计划§0 | 每批任务收据 `verified` | 各 WP | `workflow:verify` | `workflow:verify` | 不适用 | 已验证 | `/private/tmp/pms-p1..p4-task-receipt.json` 全部 state=verified | 待产品确认 v1.0 |

## 4. 工作台

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-WORK-001 | PRD§7 | 工作台统计（待采购、待确认、待下推、待请款、异常）与各业务域实时一致 | WP1.1 | `workbench.ts`、`data/pms/workbench.ts` | `tests/unit/pms-workbench.test.ts` | `/pms/workbench/overview` | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-WORK-002 | PRD§7 | 风险提醒与快捷入口可跳转到对应业务页并携带必要筛选 | WP1.1 | `workbench.ts` | 页面 spec | 跳转后筛选正确 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |

## 5. 采购建议与 KOL

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-SUG-001 | PRD§4/设计§6.1 | 采购缺口 = `max(0, 待发货 + KOL 申请 − 采购中 − 实时库存)` | WP1.2 | `data/pms/purchase-suggestions.ts` | `tests/unit/pms-purchase-suggestion.test.ts` | 建议页数值核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-SUG-002 | 设计§6.1 | 建议量 = `ceil(缺口 × 折扣)`，爆款 0.7、热销 0.6、其余 1.0 | WP1.2 | 同上 | 同上 | 建议页数值核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-SUG-003 | PRD§4 | KOL 草稿与已驳回不计入需求，入库/驳回后建议实时变化 | WP1.2/WP1.3 | 同上 | 单测 | 联动验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-SUG-004 | PRD§5.1 | 勾选 SKU 可生成商品采购单，供应商/区域/仓库/SKU 数量可编辑 | WP1.2 | `purchase-suggestions.ts` | 页面 spec | 生成后单据一致 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-SUG-005 | PRD§5.3 | 缺口 ≤0、非做货、数量非法时阻断并说明修正方式 | WP1.2 | 同上 | 单测 | 阻断提示 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-KOL-001 | PRD§6 | KOL 状态机：草稿→待入库→部分入库→全部入库；草稿可驳回 | WP1.3 | `kol-demands.ts`、`data/pms/purchase-suggestions.ts` | 单测 | 状态推进验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-KOL-002 | PRD§5.1 | 每次入库累加实际可得次数/入库次数并写入入库记录与日志 | WP1.3 | 同上 | 单测 | 详情记录验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-KOL-003 | PRD§5.3 | 单条超量需二次确认，批量入库禁止超量 | WP1.3 | 同上 | 单测 | 超量交互验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-KOL-004 | PRD§7 | 驳回、备注操作保留操作人与时间 | WP1.3 | 同上 | 单测 | 操作日志验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |

## 6. 商品采购单

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-PPO-001 | PRD§6 | 商品采购单状态：草稿→待采购→待确认→已确认→已发货→已到货→已入库→已完成→已关闭 | WP1.4 | `product-purchase-orders.ts`、`data/pms/product-purchase-orders.ts` | 单测 | 状态列展示 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-PPO-002 | PRD§5.3 | 新建/编辑校验必填、价格与数量合法，保存后列表与统计同步 | WP1.4 | 同上 | 单测 | 表单交互验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-PPO-003 | PRD§5.3 | 仅“做货”类、非草稿、SKU 数量>0、BOM 已匹配的采购单可生成面辅料需求 | WP1.4 | 同上 | 单测 | 阻断提示验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-PPO-004 | 设计§6.1 | 面辅料需求量 = `SKU 数量 × 单件用量 × (1 + 损耗)`，按物料+仓库+供应商聚合 | WP1.4 | `data/pms/material-requirements.ts` | 单测 | 生成结果核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-PPO-005 | PRD§7 | 生成后面辅料状态回写：不需要/未生成/已生成/已下推 | WP1.4 | 同上 | 单测 | 列表状态展示 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-PPO-006 | PRD§10 | 关闭采购单需二次确认并记录原因 | WP1.4 | 同上 | 单测 | 确认弹窗验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |

## 7. 面辅料需求、采购与跟踪（P2）

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-MREQ-001 | 设计§6.1 | 明细建议量 = `max(0, BOM 需求 − 库存 − 采购中)` | WP2.1 | `material-requirements.ts`、`data/pms/material-requirements.ts` | 单测 | 明细数值核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MREQ-002 | PRD§5.1 | 批量下推可修改实际采购数量并生成面辅料采购单 | WP2.1 | 同上 | 单测 | 下推后列表一致 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MREQ-003 | PRD§5.3 | 已下推、建议量 0、缺供应商阻断下推 | WP2.1 | 同上 | 单测 | 阻断提示 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MREQ-004 | PRD§6 | 部分下推显示“部分下推”，全部下推显示“已下推” | WP2.1 | 同上 | 单测 | 状态列验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MPO-001 | PRD§7 | 面辅料采购单支持筛选、批量状态推进与统计 | WP2.2 | `material-purchase-orders.ts`、`data/pms/material-purchase-orders.ts` | 单测 | 批量动作验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MPO-002 | PRD§5.1 | 提供快递信息导入模板下载 | WP2.2 | `utils/pms-excel-import.ts` | 单测 | 模板可下载可打开 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MPO-003 | PRD§5.3 | 导入解析后校验采购单存在、单号唯一、日期/费用合法，错误逐行提示 | WP2.2 | 同上 | 单测 | 导入预览与错误态 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MPO-004 | PRD§7 | 导入确认后回写物流字段并同步到采购跟踪 | WP2.2 | 同上 | 单测 | 跟踪页数据一致 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MPO-005 | PRD§5.3 | 快递单号重复阻断，不产生重复导入 | WP2.2 | 同上 | 单测 | 重复导入提示 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MTRK-001 | PRD§7 | 国内物流与头程物流分列展示，状态使用“已签收” | WP2.3 | `material-purchase-tracking.ts` | 单测 | 分列展示验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MTRK-002 | PRD§7 | 批量签收更新状态并记录操作事实 | WP2.3 | 同上 | 单测 | 签收交互验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-MTRK-003 | PRD§5.3 | 加入头程的加入量在 1..待头程之间、卷数为非负整数、头程单号不可重复 | WP2.3 | 同上 | 单测 | 校验提示验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |

## 8. 供应商确认与头程物流（P2）

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-CONF-001 | PRD§7 | 确认单支持卷号/包装明细编辑与生成 | WP2.4 | `supplier-confirmations.ts`、`data/pms/supplier-confirmations.ts` | 单测 | 明细编辑验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-CONF-002 | PRD§6 | 标签状态由卷/包装明细与打印次数推导（未生成/已生成/部分打印/已打印/已重打/异常） | WP2.4 | 同上 | 单测 | 状态列验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-CONF-003 | PRD§8 | 标签二维码内容包含 SKU/采购单号/单位/包装号/数量/供应商/打印日期，可预览与重新打印 | WP2.4 | 同上 + `renderRealQrPlaceholder` | 单测 | 打印预览验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-CONF-004 | PRD§5.3 | 已确认核心字段只读；修改需解锁并置“已变更”，需重新确认 | WP2.4 | 同上 | 单测 | 锁定/解锁验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-CONF-005 | PRD§5.1 | 供应商确认后同步回写采购单 | WP2.4 | 同上 | 单测 | 采购单回写核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-001 | PRD§6 | 头程批次状态机：待起运→已装柜→头程中→已到仓→已完成 | WP2.5 | `first-leg-shipments.ts`、`data/pms/first-leg-logistics.ts` | 单测 | 状态推进验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-002 | PRD§7 | 装柜/出运/确认到仓动作记录时间与备注 | WP2.5 | 同上 | 单测 | 时间线验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-003 | PRD§7 | 物流商与渠道新增/编辑/查看，编码自动生成，启停二次确认 | WP2.6 | `first-leg-carriers.ts`、`data/pms/first-leg-logistics.ts` | 单测 | 渠道维护验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-004 | PRD§7 | 渠道计费支持整柜及 20/40GP/40HQ/45HQ 规格价格配置 | WP2.6 | 同上 | 单测 | 整柜配置验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-005 | PRD§5.3 | 停用物流商/渠道不影响历史单与快照 | WP2.6 | 同上 | 单测 | 历史单回归 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-006 | PRD§5.1 | 物流费用对账可跳转头程物流并定位单号 | WP2.5 | 同上 + `payment-requests` 瞬时筛选 | 单测 | 跳转定位验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-LOG-007 | PRD§5.3 | 批次费用字段非负校验 | WP2.5 | 同上 | 单测 | 表单校验验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p2.md`；spec `tests/pms-material-flow.spec.ts` | 待产品确认 v1.0 |

## 9. 对账与请款（P3b）

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-FIN-001 | 设计§6.1 | 主体经营明细：总成本、毛利、毛利率计算正确 | WP3b.1 | `subject-operations.ts`、`data/pms/reconciliations.ts` | 单测 | 明细数值核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-002 | PRD§4/设计§6.1 | 最终应付 = 采购货款 + 国内物流费 + 调整金额 | WP3b.2 | 同上 | 单测 | 对账行核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-003 | 设计§6.1 | 差异 = 供应商账单 − 最终应付；差异确认后才能确认对账 | WP3b.2 | 同上 | 单测 | 差异交互验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-004 | PRD§5.2 | 仅“已确认”记录可生成请款单 | WP3b.2 | 同上 | 单测 | 生成请款验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-005 | PRD§6 | 请款状态机：未请款→部分请款→已请款→已完成；支持作废 | WP3b.3 | `material-payment-requests.ts`、`data/pms/payment-requests.ts` | 单测 | 状态推进验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-006 | PRD§5.3 | 未请款可全改，部分/已请款仅附件备注，已完成/作废禁改 | WP3b.3 | 同上 | 单测 | 编辑范围验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-007 | PRD§5.3 | 付款金额不得超过未付金额；付款登记回写付款状态 | WP3b.3 | 同上 | 单测 | 付款登记验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-008 | PRD§7 | 物流费用对账支持预计/实际 7 项费用合计与分项确认 | WP3b.4 | `logistics-reconciliations.ts` | 单测 | 费用行验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts`；审查缺口修复记录 `2026-09-18-pms-migration-audit-gap-fixes.md` | 待产品确认 v1.0 |
| PMS-FIN-009 | PRD§5.1 | 物流实际费用 Excel 导入，覆盖实际层且不自动确认 | WP3b.4 | `utils/pms-excel-import.ts` | 单测 | 导入验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-010 | PRD§5.2 | 物流费用对账生成物流请款单（仅已确认可选） | WP3b.4 | 同上 | 单测 | 生成请款验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-011 | PRD§7 | 物流请款与面辅料请款结构一致，按状态限制编辑与付款登记 | WP3b.5 | `logistics-payment-requests.ts` | 单测 | 请款页验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-012 | PRD§5.2 | 对账明细池生成对账单要求同对象、同币种、仅未对账 | WP3b.2 | `data/pms/reconciliations.ts` | 单测 | 选择校验验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |
| PMS-FIN-013 | PRD§5.2 | 对账页生成的请款草稿跨页传递到请款页新建态 | WP3b.3/WP3b.5 | `data/pms/payment-requests.ts` | 单测 | 跳转后草稿正确 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3b.md`；spec `tests/pms-settlement-flow.spec.ts` | 待产品确认 v1.0 |

## 10. 基础资料（P3a）

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-MD-001 | PRD§7 | 贸易主体列表只读展示，含编码、名称、币种、状态 | WP3a.1 | `trade-subjects.ts`、`data/pms/trade-subjects.ts` | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-002 | PRD§5.3 | 供应商新增/编辑校验必填与编码唯一；启停二次确认；状态机草稿/待审核/已启用/已驳回/已停用 | WP3a.1 | `suppliers.ts`、`data/pms/suppliers.ts` | 单测 | CRUD 验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-003 | 设计§6.1 | 包装换算：基础单位 ↔ 包装数 ↔ 箱数；成衣箱数向上取整 | WP3a.1 | `supplier-supply-archives.ts` | 单测 | 换算面板核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-004 | PRD§4 | 采购单保存包装快照，档案变化不影响历史 | WP3a.1 | 同上 | 单测 | 历史单核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-005 | PRD§7 | 面辅料列表为 PCS 同步只读，PMS 仅补充采购/申报/报关信息；图片上传校验格式与大小 | WP3a.2 | `material-archives.ts`、`data/pms/materials.ts` | 单测 | 补充信息验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts`；审查缺口修复记录 `2026-09-18-pms-migration-audit-gap-fixes.md` | 待产品确认 v1.0 |
| PMS-MD-006 | PRD§7 | 成衣列表展示款式、SKU、颜色尺码、价格与图片 | WP3a.2 | `product-skus.ts` | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-007 | PRD§7 | 样衣列表展示样衣对象信息与图片 | WP3a.2 | 同上 | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-008 | PRD§7 | 仓库管理只读引用 WMS，支持同步刷新反馈 | WP3a.3 | `warehouses.ts` | 页面 spec | 同步反馈验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-009 | PRD§7 | 单位字典支持新增/编辑与唯一性校验，禁止删除，编码自动生成 | WP3a.3 | `units.ts` | 单测 | CRUD 验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-010 | PRD§7 | BOM/样板列表可进入 SPU 整页详情 | WP3a.4 | `bom-templates.ts`、`bom-detail.ts`、`data/pms/bom-templates.ts` | 页面 spec | 详情直达验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-011 | 设计§6.1 | 单件计划用量 = 用量 × (1 + 损耗) | WP3a.4 | `data/pms/bom-templates.ts` | 单测 | 详情表格核对 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |
| PMS-MD-012 | PRD§10 | 样板详情保存/提交有明确成功反馈与必填阻断 | WP3a.4 | `bom-detail.ts` | 页面 spec | 表单验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p3a.md`；spec `tests/pms-master-data.spec.ts` | 待产品确认 v1.0 |

## 11. 库存监控与中转仓（P4）

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-INV-001 | PRD§7 | 补货触发线 = 阈值 × 比例或固定值，低于触发线进入待处理 | WP4.1 | `material-inventory.ts`、`data/pms/inventory-monitor.ts` | 单测 | 监控列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-INV-002 | 设计§6.1 | 建议量 = `max(0, 目标库存 − 库存)`，调拨/采购资格由规则判定 | WP4.1 | 同上 | 单测 | 建单资格验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-INV-003 | PRD§7 | 可从监控生成调拨或采购单据并保留日志 | WP4.1 | 同上 | 单测 | 建单验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-TRN-001 | PRD§7 | 中转数据总览展示收货指标、趋势与异常 | WP4.2 | `transit-dashboard.ts`、`data/pms/transit-warehouse.ts` | 页面 spec | 看板验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-TRN-002 | PRD§7 | 中转收货单列表支持卡片筛选与列表展示 | WP4.2 | `transit-receipts.ts` | 页面 spec | 筛选验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-TRN-003 | PRD§7 | 看板指标可跳转收货单列表并携带筛选条件 | WP4.2 | 同上 | 页面 spec | 跳转筛选验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-TRN-004 | PRD§7 | 生产单校验与配料任务只读展示，不反推状态 | WP4.2 | `transit-simple-lists.ts` | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |

## 12. 系统设置（P4）

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-SET-001 | PRD§7/AGENTS§6 | 用户管理按结果展示页，不做新增/批量/复杂编辑 | WP4.3 | `settings-users.ts`、`data/pms/settings.ts` | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-SET-002 | PRD§7 | 角色权限展示角色、范围与引用关系 | WP4.3 | `settings-roles.ts` | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |
| PMS-SET-003 | PRD§7/AGENTS§6 | 字典配置展示字典项与来源，不开放重维护 | WP4.3 | `settings-dictionaries.ts` | 页面 spec | 列表验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p4.md`；spec `tests/pms-peripheral.spec.ts` | 待产品确认 v1.0 |

## 13. 数据与跨页

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-DATA-001 | 设计§3.6/§6 | 业务数据集中在 `src/data/pms/`，页面不直接改写域数组 | 各 WP | `src/data/pms/*` | 单测 | 不适用 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-DATA-002 | 设计§6 | 每个业务命令写审计日志（操作人、时间、前后值、来源 PMS） | 各 WP | `data/pms/runtime.ts` | 单测 | 详情日志验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-DATA-003 | 设计§6 | 刷新回到演示初始状态，不实现业务持久化 | 各 WP | 域 runtime | 页面 spec | 刷新回归 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1.md`；spec `tests/pms-purchase-chain.spec.ts` | 待产品确认 v1.0 |
| PMS-DATA-004 | PRD§5 | 跨页链路（建议→采购单→需求→面辅料单→跟踪→头程→对账→请款）保持数据一致 | 各 WP | 各域命令 + `appStore.navigate` | 单测 + 链路 spec | 端到端浏览器验收 | 已验证 | 记录 `2026-09-18-pms-procurement-migration-p1..p4.md`；spec `tests/pms-*.spec.ts`（33 项浏览器验收） | 待产品确认 v1.0 |

## 14. 双向覆盖检查记录

- 正向：PRD 第 1～13 章与设计第 2～10 章每个规范性小节均映射到上表编号；P1 负责 PMS-SCOPE/MENU/ROUTE/EVT/LIST/IMG/PERF/GOV/WORK/SUG/KOL/PPO/DATA 共 40 条。
- 反向：上表每条需求均可回到 PRD 或设计原文；无超出原文范围的能力项。
- 排除项：设计§2.2 的非范围不建立“实现”需求，仅 PMS-SCOPE-002 一条作为删除边界控制。

---

## 15. 第二轮字段级补全（G1–G11，批次 A–F）

| 需求编号 | 来源文档和章节 | 原子需求 | 工作包 | 实现文件／符号 | 自动化验证 | 页面验证 | 当前状态 | 证据链接或位置 | 产品确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-FLG-004 | 设计§11.1/清单§15 G1 | 头程单保存提货信息字段（提单号、提单号备注、船司名、货源地区、仓库、区域、货运公司、货运类型） | WP6.A | `data/pms/first-leg-logistics.ts` 批次字段与校验 | 单测 | 头程表单验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-FLG-005 | 设计§11.1/清单§15 G1 | 头程单保存 7 项费用明细且全部非负有限数字，非法输入阻断 | WP6.A | 同上 | 单测 + 专项检查 | 头程表单验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-FLG-006 | 设计§11.1/清单§15 G1 | 头程单保存入库状态与预计送达万隆时间并校验证格式 | WP6.A | 同上 | 单测 | 头程表单验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-FLG-007 | 设计§11.1/清单§15 G1 | 头程列表、详情、导出展示新增字段与费用明细 | WP6.A | `pages/pms/first-leg-shipments.ts` | 页面 spec | 列表/详情/导出验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-FLG-008 | 设计§11.1/清单§15 G2 | 批量装柜与批量确认出运仅处理合法状态行并返回跳过条数 | WP6.A | 首程域批量命令 + 列表勾选 | 单测 + 页面 spec | 批量动作验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-REC-004 | 设计§11.2/清单§15 G3 | 面辅料对账预计/实际双层展示与行编辑，最终应付与差异重算 | WP6.B | `data/pms/reconciliations.ts`、`pages/pms/material-reconciliations.ts` | 单测 | 对账验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-REC-005 | 设计§11.2/清单§15 G3 | 费用项逐项确认、部分确认状态、批量确认/批量部分确认 | WP6.B | 同上 | 单测 + 页面 spec | 部分确认验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-REC-006 | 设计§11.2/清单§15 G4 | 供应商账单 9 列导入（采购单+物料编码匹配），错误行整体阻断且不自动确认 | WP6.B | 同上 | 单测 + 页面 spec | 导入验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-REC-007 | 设计§11.2/清单§15 G5 | 物流对账差异口径、部分确认状态、物流商/运输方式筛选、运单/货件/签收列与 12 列模板 | WP6.B | `data/pms/reconciliations.ts`、`pages/pms/logistics-reconciliations.ts` | 单测 + 页面 spec | 物流对账验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-PAY-008 | 设计§11.3/清单§15 G6 | 请款创建保存收款人/付款信息/金额信息/付款说明字段 | WP6.C | `data/pms/payment-requests.ts`、`pages/pms/payment-requests.ts` | 单测 | 创建页验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-PAY-009 | 设计§11.3/清单§15 G6 | 申请付款支持全款/部分与付款登记字段，超额阻断 | WP6.C | 同上 | 单测 + 页面 spec | 付款验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-PAY-010 | 设计§11.3/清单§15 G6 | 附件与请款/付款记录可见 | WP6.C | 同上 | 单测 | 详情验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-INV-004 | 设计§11.4/清单§15 G7 | 监控规则保存加工工序链与坯布匹配，调拨资格受坯布库存约束 | WP6.D | `data/pms/inventory-monitor.ts`、`pages/pms/material-inventory.ts` | 单测 | 规则弹窗验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-INV-005 | 设计§11.4/清单§15 G7 | 生成采购/调拨弹窗字段完整，调拨可同步生成加工单并写入生成记录 | WP6.D | 同上 | 单测 + 页面 spec | 建单与记录验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-INV-006 | 设计§11.4/清单§15 G7 | 批量刷新库存、手动添加监控 SKU、筛选 6 项 | WP6.D | 同上 | 页面 spec | 维护动作验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-SUP-005 | 设计§11.5/清单§15 G8 | 生成卷号按前缀/每卷米数/重量/起始序号生成并参与打印 | WP6.E | `data/pms/supplier-confirmations.ts`、`pages/pms/supplier-confirmations.ts` | 单测 | 卷号弹窗验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-SUP-006 | 设计§11.5/清单§15 G8 | 箱规表与包装明细可增删并随确认单保存 | WP6.E | 同上 | 单测 | 箱规/包装验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-SUP-007 | 设计§11.5/清单§15 G8 | 标签 PNG 下载与上一张/下一张切换 | WP6.E | 同上 | 页面 spec | 标签与切换验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-MD-006 | 设计§11.6/清单§15 G9 | 物料申报字段扩展（品牌类型、品牌中英文、产品型号、26 项特殊属性、其他申报要素） | WP6.F | `data/pms/materials.ts`、`pages/pms/material-archives.ts` | 单测 | 编辑弹窗验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-MD-007 | 设计§11.6/清单§15 G9 | 报关字段扩展（是否报关、法定第二计量单位与数值、其他申报要素）与质检/库存单位 | WP6.F | 同上 | 单测 | 编辑弹窗验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-BOM-006 | 设计§11.6/清单§15 G10 | BOM 业务选项 8 项（2 组是否 radio、2 项 checkbox、4 个枚举 radio）与分类过滤，保存后回显 | WP6.F | `pages/pms/bom-detail.ts` | 单测 + 页面 spec | BOM 验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-BOM-007 | 设计§11.6/清单§15 G10 | BOM 价格/成本 8 字段、工厂 6 字段、布料/辅料/工艺 6 字段与说明 | WP6.F | 同上 | 页面 spec | BOM 验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |
| PMS-SUB-002 | 设计§11.6/清单§15 G11 | 主体经营成本明细 9 项与调整、收入状态、已确认收入、数据缺失提醒 | WP6.F | `data/pms/subject-operations.ts`、`pages/pms/subject-operations.ts` | 单测 | 明细验收 | 已验证 | 记录 `2026-09-18-pms-second-phase-field-completion.md`；`check:pms-purchase-chain`、单测与 `tests/pms-*.spec.ts`（42 项） | 待产品确认 v1.1 |

| PMS-MD-010 | 设计§13.1/独立复核 M1 | 物料品牌类型枚举与 SRM 一致（无品牌/自有品牌/授权品牌） | 第三轮 | `data/pms/materials.ts` | 单测 + 专项检查 | 页面回显 | 已验证 | `check:pms-purchase-chain` §16、`pms-master-data-extensions.test.ts` | 待产品确认 v1.2 |
| PMS-MD-011 | 设计§13.1/独立复核 M2 | 26 项特殊属性值集与 SRM 完全一致 | 第三轮 | 同上 | 单测 + 专项检查 | 编辑弹窗复选 | 已验证 | 专项检查逐项比对断言 | 待产品确认 v1.2 |
| PMS-MD-012 | 设计§13.1/独立复核 P3-3 | 采购区域含“其他”、币种含 IDR 并加白名单校验 | 第三轮 | 同上 | 单测 + 专项检查 | 编辑弹窗 | 已验证 | 专项检查非法值阻断断言 | 待产品确认 v1.2 |
| PMS-BOM-008 | 设计§13.1/独立复核 M3 | BOM 开发/审核/生产/运输 4 组枚举与 SRM 一致 | 第三轮 | `data/pms/bom-detail.ts` | 单测 + 专项检查 | BOM 详情 | 已验证 | `pms-master-data-extensions.test.ts`、P3a spec | 待产品确认 v1.2 |
| PMS-INV-007 | 设计§13.1/独立复核 M4 | 库存使用类型 5 项与 SRM 一致 | 第三轮 | `data/pms/inventory-monitor.ts` | 单测 | 采购弹窗 | 已验证 | `pms-inventory-monitor.test.ts` | 待产品确认 v1.2 |
| PMS-FLG-009 | 设计§13.2/独立复核 M5 | 物流商 11 项字段补齐 | 第三轮 | `data/pms/first-leg-logistics.ts`、`pages/pms/first-leg-carriers.ts` | 单测 + 专项检查 | 表单/详情 | 已验证 | `pms-first-leg-carriers.test.ts`、P2 spec | 待产品确认 v1.2 |
| PMS-FLG-010 | 设计§13.2/独立复核 M5 | 渠道 22 项字段补齐（时效/计费/税务/路线/限制） | 第三轮 | 同上 | 单测 + 专项检查 | 表单/详情 | 已验证 | 同上 | 待产品确认 v1.2 |
| PMS-FLG-011 | 设计§13.2/独立复核 P3-5 | 批次聚合（箱数/重量/体积/转运天数）展示与导出 | 第三轮 | `data/pms/first-leg-logistics.ts`、`pages/pms/first-leg-shipments.ts` | 单测 + 专项检查 | 列表/详情/导出 | 已验证 | `pms-first-leg-carriers.test.ts`、专项检查聚合断言 | 待产品确认 v1.2 |
| PMS-PUR-001 | 设计§13.1/独立复核 M6 | 供应商类型/等级/付款方式/币种/交货方式枚举对齐 | 第三轮 | `data/pms/suppliers.ts`、`pages/pms/suppliers.ts` | 单测 | 表单/筛选 | 已验证 | `pms-suppliers.test.ts`、P3a spec | 待产品确认 v1.2 |
| PMS-PUR-002 | 设计§13.2/独立复核 M6 | 供应商商务字段（国家/省市/微信/开票/银行/交货方式） | 第三轮 | 同上 | 单测 | 表单/详情 | 已验证 | P3a spec 新增断言 | 待产品确认 v1.2 |
| PMS-PUR-003 | 设计§13.2/独立复核 M6 | 供应商协同指标只读展示 | 第三轮 | 同上 | 单测 | 详情 | 已验证 | `pms-suppliers.test.ts` | 待产品确认 v1.2 |
| PMS-PPO-001 | 设计§13.2/独立复核 M7 | 商品采购单采购属性与 BOM/金额/申请人字段 | 第三轮 | `data/pms/product-purchase-orders.ts`、`pages/pms/product-purchase-orders.ts` | 单测 + 专项检查 | 详情/表单 | 已验证 | `pms-product-purchase-orders.test.ts`、P1 spec 新增用例 | 待产品确认 v1.2 |
| PMS-MD-013 | 设计§13.1/13.2/独立复核 P3-1 | 仓库六类枚举与只读字段（属性/同步/可用开关/关联单量） | 第三轮 | `data/pms/warehouses.ts`、`pages/pms/warehouses.ts` | 专项检查 | 详情 | 已验证 | 专项检查六类覆盖断言、P3a spec 新增用例 | 待产品确认 v1.2 |
| PMS-MD-014 | 设计§13.1/独立复核 P3-2 | 单位六类枚举与 SRM 缺失单位补齐 | 第三轮 | `data/pms/units.ts`、`pages/pms/units.ts` | 单测 + 专项检查 | 表单/筛选 | 已验证 | 专项检查类别断言、P3a spec 包装选项断言 | 待产品确认 v1.2 |
| PMS-MAT-002 | 设计§13.2/独立复核 P3-4 | 面辅料需求历史库存与 ID 历史库存列 | 第三轮 | `data/pms/material-requirements.ts`、`pages/pms/material-requirements.ts` | 专项检查 | 需求明细 | 已验证 | 专项检查字段断言、P2 spec 列断言 | 待产品确认 v1.2 |
| PMS-TRN-005 | 设计§13.1/独立复核 P3-6 | 中转收货状态对齐（待收货/收货中/已收货，异常按差异独立） | 第三轮 | `data/pms/transit-warehouse.ts`、`pages/pms/transit-receipts.ts` | 单测 + 专项检查 | 列表/筛选/详情 | 已验证 | `pms-peripheral.test.ts`、P4 spec | 待产品确认 v1.2 |
| PMS-TRN-006 | 设计§13.1/独立复核 P3-7 | 生产单校验与配料任务状态口径对齐 | 第三轮 | `pages/pms/transit-simple-lists.ts` | 单测 + 专项检查 | 只读列表 | 已验证 | `pms-peripheral.test.ts`、P4 spec | 待产品确认 v1.2 |

## 17. 第三轮独立复核双向覆盖检查记录

- 正向：设计 §13 的 4 类（枚举、字段、聚合、口径）逐项映射到上表 17 条需求，均有实现位置与证据。
- 反向：`check:pms-purchase-chain` 第 16 节、新增单测与 P1–P4 spec 新增断言全部能回到本节编号；未发现越界实现。

## 18. 合规修复原子需求

| 需求编号 | 来源文档和章节 | 原子需求 | 工作包 | 实现文件／符号 | 自动化验证 | 页面验证 | 当前状态 | 证据链接或位置 | 产品确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-CMP-001 | AGENTS§5.2/合规审查 C1 | 标准列表契约声明覆盖（共享骨架声明 + 工厂页面） | 合规修复 | `pages/pms/result-list.ts`、`pages/pms/settings.ts`、`pages/pms/transit-simple-lists.ts` | 治理脚本 | 列表验收 | 已验证 | `check:list-page-governance` | 待产品确认 v1.2 |
| PMS-CMP-002 | AGENTS§5.1/合规审查 C2 | 行勾选局部更新，不触发整页重绘 | 合规修复 | 6 个列表页 | 页面 spec | 勾选/批量验收 | 已验证 | 全量扫描残留 0、P1–P4 spec | 待产品确认 v1.2 |
| PMS-CMP-003 | AGENTS§4.2/合规审查 C3 | 差异确认/结算推进/删除类操作二次确认 | 合规修复 | 对账/请款/确认单页面 | 页面 spec | 二次确认验收 | 已验证 | P2/P3b spec（armed 提示与两击） | 待产品确认 v1.2 |
| PMS-CMP-004 | AGENTS§5.3/合规审查 C4 | 物料/款式出现处均有缩略图、大图预览与失败态 | 合规修复 | 10 个页面 | 页面 spec | 图片大图验收 | 已验证 | P2/P3b/P4 spec（图片点击与大图关闭） | 待产品确认 v1.2 |
| PMS-CMP-005 | AGENTS§3.1.5/合规审查 C5 | 矩阵状态全部收口，无“已实现待验证” | 合规修复 | 矩阵文档 | 治理脚本 | 不适用 | 已验证 | 矩阵第 1–18 节 | 待产品确认 v1.2 |
| PMS-CMP-006 | AGENTS§7.2/合规审查 C6 | 全 34 路由冷启动 ≥5 样本且 <200ms | 合规修复 | `tests/pms-peripheral.spec.ts` | 页面 spec | 冷启动验收 | 已验证 | `pmsColdLoadPerf` 原始样本（最大 189ms） | 待产品确认 v1.2 |

## 19. 合规修复双向覆盖检查记录

- 正向：AGENTS.md §4.2/§5.1/§5.2/§5.3/§3.1.5/§7.2 的合规条目映射到上表 6 条与审查记录第 10 节，全部有实现位置与证据。
- 反向：新增/调整的交互、图片与性能断言都能回到对应条款；操作日志等例外已在记录 §10.3 说明。

## 20. 列表样式对齐（参照 FCS 染色加工单）

| 需求编号 | 来源文档和章节 | 原子需求 | 工作包 | 实现文件／符号 | 自动化验证 | 页面验证 | 当前状态 | 证据链接或位置 | 产品确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-STY-001 | 用户指令/AGENTS§5.2 | 所有 PMS 列表页统计卡、筛选卡（grid+更多筛选）、动作按钮、列表标题、页头与参照页一致 | 样式对齐 | `pages/pms/*`（25 个列表页）、`pages/pms/result-list.ts` | 页面 spec + 渲染扫描 + 截图比对 | 列表验收 | 已验证 | 记录 `2026-09-18-pms-list-style-alignment.md`；截图 `docs/verification-evidence/2026-09-18-style-alignment/`；44 项 spec 通过 | 待产品确认 v1.3 |
| PMS-STY-002 | 用户指令/AGENTS§5.1 | 表格单元顶部对齐、全选表头/选择范围、行内链接与全部可点击控件形态统一 | 样式对齐 | 各列表页根样式、`renderProcessSelectionHeader`、全页按钮形态 | 页面 spec + 截图比对 + 点击审计（816 次/0 错误） | 批量操作验收 | 已验证 | 记录 §11；`interaction-audit.json`；收据 `pms-style-alignment-task-receipt.json` | 待产品确认 v1.3 |
| PMS-STY-003 | AGENTS§7.2 | 全路由冷启动 ≥5 样本 <200ms | 样式对齐 | `tests/pms-cold-load.spec.ts` | 冷启动专项 | 冷启动验收 | 已验证 | 收据 `/private/tmp/pms-style-alignment-task-receipt.json`（state=verified）；34 路由 ×5，静默窗口最大 189ms | 待产品确认 v1.3 |
