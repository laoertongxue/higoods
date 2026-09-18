# PMS 采购管理系统迁移（P4：库存监控、中转仓与系统设置）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 采购管理系统 PMS 迁移 P4：面辅料库存监控、中转数据总览、中转收货单列表、生产单校验、配料任务、用户管理、角色权限、字典配置；需求矩阵 PMS-INV/TRN/SET 共 10 条；同时收口 PMS-MENU-001/003、PMS-SCOPE-001、PMS-LIST-001、PMS-IMG-001、PMS-ROUTE-003、PMS-DATA-004 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/material-inventory`、`/pms/transit/dashboard`、`/pms/transit/receipts`、`/pms/transit/order-checks`、`/pms/transit/preparation-tasks`、`/pms/users`、`/pms/roles`、`/pms/dictionaries` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 采购/仓管：处理补货规则与建单、看中转收货与异常；管理员：查看用户/角色/字典结果 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PMS 新增“原料管理”“中转仓”“系统设置”3 个菜单组 8 个菜单项与 8 个页面路由；新增补货规则设置、按建议量生成调拨/采购单、看板指标携带筛选跳转收货单、收货卡片筛选、收货异常展示等可见交互；新增 5 条库存监控、7 条中转收货单、6 条生产单校验、5 条配料任务、8 个用户、6 个角色、10 项字典演示数据。至此 PMS 菜单共 12 组 33 项，全部有精确路由与实现。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 库存监控与收货单为标准列表；中转看板为 dashboard；生产单校验/配料任务/系统设置为只读结果列表，使用统一结果页工厂 |
| 文案、状态、数量与单位 | 通过 | 触发线、建议量、差异、收货数量由系统计算；数量带单位；规则异常、待补货、待收货、异常等中文状态 |
| 扫码、真实图片与对象识别 | 通过 | 库存监控行的物料图片与名称/编码同单元格，全部使用真实素材；中转与设置页不展示款式/物料对象 |
| 防错、危险确认与主管兜底 | 通过 | 规则异常阻断建单；建单数量不得超过建议量；调拨/采购资格分别阻断；只读页面无新增/删除入口 |
| 交接、跨端事实与异常追溯 | 通过 | 收货差异直接表达“少 20 件”，异常卡片可定位；生产单校验明确只读读取现有结果，不由配料任务反推状态 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768/1280×720 验收通过；宽表容器内滚动；本批无 PDA 与上传 |
| 命名路由、交互、图片大图与打印 | 通过 | 8 个命名路由可直达；看板筛选跳转收货单；本批无打印 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 库存演示数据无法同时体现正常/待补货/规则异常三种状态 | 无 | 采购员 | 调整两条种子库存，使触发线、建议量、调拨/采购资格三种状态都能在页面直接看到 | 否 |
| 五个只读结果页若各自复制列表实现会造成重复 | 组件误用 | 管理员 | 抽取最小结果页工厂 `result-list.ts`（仅只读查询、导出、列设置），供生产单校验、配料任务、用户、角色、字典复用 | 否 |

## 6. 最终结论

结论：通过（P4 批次）

说明：

- P4 负责的 10 条原子需求达到 `已实现待验证`；PMS 迁移全部 4 个批次完成。
- 矩阵共 105 条需求：103 条为 `已实现待验证`，2 条为 `不适用`（明确排除的非范围项与已通过素材替换解决的缺图登记）；不存在 `待实施`、`实施中` 或 `已阻塞` 条目，产品确认后统一转 `已验证`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pms/inventory-monitor.ts`
- `src/data/pms/transit-warehouse.ts`
- `src/data/pms/settings.ts`
- `src/main-handlers/pms-handlers.ts`
- `src/pages/pms/material-inventory.ts`
- `src/pages/pms/transit-dashboard.ts`
- `src/pages/pms/transit-receipts.ts`
- `src/pages/pms/transit-simple-lists.ts`
- `src/pages/pms/settings.ts`
- `src/pages/pms/result-list.ts`
- `src/router/route-renderers-pms.ts`
- `src/router/routes-pms.ts`

### 页面路由

- `/pms/material-inventory`
- `/pms/transit/dashboard`
- `/pms/transit/receipts`
- `/pms/transit/order-checks`
- `/pms/transit/preparation-tasks`
- `/pms/users`
- `/pms/roles`
- `/pms/dictionaries`

### 验证命令

- `npm run build`：通过
- `npm run check:pms-purchase-chain`：通过
- `npm run check:menu-routes`：通过（PMS 菜单 33 条全部精确路由覆盖）
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm test`：通过（含 `tests/unit/pms-peripheral.test.ts` 4 项）
- `CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_PORT=43271 npx playwright test tests/pms-purchase-chain.spec.ts tests/pms-material-flow.spec.ts tests/pms-master-data.spec.ts tests/pms-settlement-flow.spec.ts tests/pms-peripheral.spec.ts --workers=1`：通过（33 项）
- `npm run workflow:verify -- --output /private/tmp/pms-p4-task-receipt.json --task-boundary "PMS 迁移 P4：库存监控、中转仓与系统设置（矩阵 10 条，含 P1–P3b 回归与整体收口）"`：通过（收据见 `/private/tmp/pms-p4-task-receipt.json`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18）

- P4 八个页面站内切换（40 次）：23–29ms，最大 29ms，均 < 200ms。
- 库存监控交互（规则/建单/日志，15 次）：23–36ms。
- 收货单交互（卡片筛选/详情，15 次）：20–30ms。
- 系统设置交互（查询/列设置，10 次）：18–30ms。
- 原始样本见测试输出 `pmsPeripheralPerf.*`；P1 冷启动 72–84ms、P2/P3a/P3b 交互最大 50ms 回归通过。

### 真实图片验证

- 库存监控展示 5 条物料的真实实拍缩略图，与物料名称/编码同单元格；中转与设置页面不出现款式/物料对象，无图片硬门禁适用项。
- 全系统款式与物料图片在 P1–P3a 已全部映射到 `public/` 真实素材，无缺图对象。

### 例外

- 无
