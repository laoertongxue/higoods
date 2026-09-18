# PMS 采购管理系统迁移交付说明

- 版本：2026-09-18
- 分支 / 工作树：`codex/pms-srm-migration`（`/Users/laoer/Documents/higoods/.worktrees/pms`），基线 `4804328a`
- 交付状态：本地 `verified`（构建、自动化、浏览器、性能、治理与任务收据全部通过）；矩阵 103 条为 `已实现待验证`，等待产品确认后转 `已验证`；未提交、未推送
- 范围：SRM 原型侧栏 30 个有入口页面全量迁移为 PMS，另含 2 个中转子页、2 个请款新建视图、1 个 BOM 整页详情

## 1. 交付路由（33 条精确路由 + 1 条动态路由）

| 分组 | 路由 |
| --- | --- |
| 工作台 | `/pms/workbench/overview` |
| 采购订单（保留） | `/pms/purchase-order` |
| 基础资料 | `/pms/trade-subjects`、`/pms/suppliers`、`/pms/supplier-supply-archives`、`/pms/material-archives`、`/pms/garment-skus`、`/pms/sample-skus`、`/pms/warehouses`、`/pms/units`、`/pms/bom-templates`（+ 动态 `/pms/bom-templates/:spu`） |
| 原料管理 | `/pms/material-inventory` |
| 中转仓 | `/pms/transit/dashboard`、`/pms/transit/receipts`、`/pms/transit/order-checks`、`/pms/transit/preparation-tasks` |
| 采购建议 | `/pms/purchase-suggestions`、`/pms/kol-demands` |
| 商品采购 | `/pms/product-purchase-orders` |
| 面辅料采购 | `/pms/material-requirements`、`/pms/material-purchase-orders`、`/pms/material-purchase-tracking` |
| 供应商确认 | `/pms/material-supplier-confirmations` |
| 头程物流 | `/pms/first-leg-shipments`、`/pms/first-leg-carriers` |
| 采购对账 | `/pms/subject-operations`、`/pms/material-reconciliations`、`/pms/material-payment-requests`、`/pms/logistics-reconciliations`、`/pms/logistics-payment-requests` |
| 系统设置 | `/pms/users`、`/pms/roles`、`/pms/dictionaries` |

## 2. 证据索引

| 类别 | 位置 |
| --- | --- |
| 产品需求 | `docs/product-requirements/采购管理系统PMS产品需求说明文档.md` |
| 总体设计 | `docs/product-design/采购管理系统PMS迁移总体设计.md` |
| 实施计划 | `docs/implementation-plans/采购管理系统PMS迁移实施计划.md` |
| 需求追踪矩阵 | `docs/requirement-traceability/采购管理系统PMS迁移需求追踪与交付矩阵.md`（105 条：103 已实现待验证 + 2 不适用） |
| 逐页功能验证清单 | `docs/product-design/采购管理系统PMS迁移逐页功能验证清单.md`（33 条路由逐交互比对，7 项缺口修复记录） |
| 原型审查记录 | `docs/prototype-review-records/2026-09-18-pms-procurement-migration-p1.md`、`p2`、`p3a`、`p3b`、`p4`、`2026-09-18-pms-migration-audit-gap-fixes.md`（共 6 份） |
| 领域专项检查 | `npm run check:pms-purchase-chain`（`scripts/check-pms-purchase-chain.ts`） |
| 浏览器验收 | `tests/pms-purchase-chain.spec.ts`、`tests/pms-material-flow.spec.ts`、`tests/pms-master-data.spec.ts`、`tests/pms-settlement-flow.spec.ts`、`tests/pms-peripheral.spec.ts`（35 项） |
| 单元测试 | `tests/unit/pms-runtime.test.ts`、`pms-purchase-chain.test.ts`、`pms-material-flow.test.ts`、`pms-master-data.test.ts`、`pms-settlement-flow.test.ts`、`pms-peripheral.test.ts` |
| 任务收据 | `/private/tmp/pms-p1-task-receipt.json`、`pms-p2-`、`pms-p3a-`、`pms-p3b-`、`pms-p4-`、`pms-audit-task-receipt.json`（全部 `state=verified`、`blockers=[]`） |

## 3. 验证结果汇总（当前版本）

| 项 | 结果 |
| --- | --- |
| 构建 | `npm run build` 通过 |
| 单元测试 | `npm test` 通过（153 项） |
| 领域检查 | `check:pms-purchase-chain` 通过（含链路、公式、门禁、导入、状态机断言） |
| 浏览器验收 | 35 项通过（P1 6 + P2 7 + P3a 7 + P3b 6 + P4 7 + 缺口修复 2） |
| 性能（生产预览 1366×768） | 冷启动 70–84ms；站内切换 17–50ms；各交互 16–40ms；全部 `<200ms` |
| 治理 | `check:menu-routes`（33 条全覆盖）、`check:list-page-governance`、`check:prototype-design-governance -- --all`（60 个受管文件、6 份记录）通过 |
| CodeGraph | `codegraph sync`/`status` 完成，`pendingChanges` 0 |

## 4. 交付边界与已登记简化

- 保留：`/pms/purchase-order`（花边辅料采购订单）及其 FCS/WLS 联动、偏好键与打印边界不变。
- 有意简化（详见逐页清单第 13 节）：富文本降级为纯文本；头程 13 节点轨迹简化为 4 状态节点与批量动作收敛；BOM 业务选项由 5 组简化为 3 组；供货档案 8 个静态 Tab 与中转看板日期筛选未迁移；部分 SRM 静态字段与演示壳动作不迁移；筛选条件按 PMS 标准列表治理收敛。
- 有意排除：21 个无菜单入口孤立页、通用对账死视图、SRM 壳层、登录与权限控制。

## 5. 待产品确认

1. 接受本交付版本（矩阵 103 条转 `已验证`，确认人写入矩阵）。
2. 是否提交并推送分支（当前未提交，`delivered` 需 GitHub 回执）。
3. 是否需要补齐第 4 节中的简化项作为后续批次（需先更新总体设计与矩阵）。
