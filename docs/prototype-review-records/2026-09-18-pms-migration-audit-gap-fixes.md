# PMS 迁移审查缺口修复（逐页功能核对后 7 项）原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-18 |
| 相关需求 / 任务 | 对 PMS 迁移做逐页、逐功能、逐交互核对后修复 7 项真实缺口；核对清单见 `docs/product-design/采购管理系统PMS迁移逐页功能验证清单.md`；覆盖矩阵 PMS-FIN-008、PMS-MD-005 及 SRM 存在真实行为但未迁移的功能 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PMS |
| 涉及页面路径 | `/pms/logistics-reconciliations`、`/pms/material-reconciliations`、`/pms/material-purchase-orders`、`/pms/material-archives`、`/pms/kol-demands`、`/pms/bom-templates/:spu` |
| 端类型 | 管理端（1366×768 验收，1280×720 兜底） |
| 主要角色与任务 | 财务：物流费用分项确认与账单调整、供应商账单导入；采购员：申报/报关信息补充、关闭采购单、批量驳回 KOL 需求；采购主管：BOM 工厂与报价维护 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：本次修复新增可见交互——物流对账逐项费用确认/确认全部费用/供应商账单金额编辑；面辅料对账“导入供应商账单”（模板、解析、校验、覆盖且不自动确认）；物料档案编辑弹窗新增申报 5 字段与报关 6 字段；KOL 需求新增“批量驳回”；面辅料采购单详情新增“关闭采购单”（原因必填、关闭后阻断到货）；BOM 详情工厂/生产周期/报价可编辑；同时申报信息在详情中随保存更新。

完整产品审查的当前基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 新增交互均在既有标准列表/抽屉模式内，未引入新页面结构 |
| 文案、状态、数量与单位 | 通过 | 新增按钮与提示均为中文业务文案；费用与账单带币种，差异由系统重算 |
| 扫码、真实图片与对象识别 | 通过 | 本次不新增图片对象；物料档案图片上传校验保持 png/jpg ≤5MB |
| 防错、危险确认与主管兜底 | 通过 | 关闭采购单原因必填且二次确认；确认全部费用/确认差异/确认对账门禁链完整；导入存在错误行时禁止确认 |
| 交接、跨端事实与异常追溯 | 通过 | 账单导入/费用确认/关闭/批量驳回均写操作日志（操作人、时间、前后值、原因） |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768 验收；导入失败可重新选择文件；无 PDA |
| 命名路由、交互、图片大图与打印 | 通过 | 路由与既有页面不变；新增导入/确认交互均在命名路由内验证 |

## 4. 问题标签

- `点错风险`（已处理：确认对账前必须完成分项确认与差异确认）
- `算不准`（已处理：账单导入后差异与最终应付即时重算）

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 物流对账缺少分项确认，与矩阵 PMS-FIN-008 不一致 | 点错风险 | 财务 | 费用项增加确认状态；逐项确认与“确认全部费用”；未全部确认不能确认对账 | 否 |
| 面辅料对账缺少供应商账单导入（SRM 有真实导入） | 算不准 | 财务 | 新增模板下载/解析/逐行校验/覆盖账单金额/不自动确认 | 否 |
| 物料档案申报/报关信息只读，与矩阵 PMS-MD-005 不一致 | 无 | 采购员 | 编辑弹窗新增申报与报关关键字段并校验必填 | 否 |
| KOL 需求缺少批量驳回（SRM 有真实批量驳回） | 无 | 采购员 | 新增批量驳回，自动跳过不可驳回项并逐条落日志 | 否 |
| 面辅料采购单关闭命令无 UI 入口 | 无 | 采购主管 | 详情新增关闭采购单，原因必填、关闭后阻断到货登记 | 否 |
| BOM 详情工厂/周期/报价无编辑入口 | 无 | 采购主管 | 信息区改为可编辑并随保存写入样板详情 | 否 |
| 物流对账供应商账单金额无编辑入口 | 算不准 | 财务 | 汇总区新增账单金额输入与“保存供应商账单”，差异重算 | 否 |

## 6. 最终结论

结论：通过（审查缺口修复批次）

说明：

- 7 项缺口全部修复并补充自动化断言；逐页核对清单（33 条路由）无未登记缺失。
- 矩阵 PMS-FIN-008、PMS-MD-005 的实现与证据随本次修复更新说明。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pms/reconciliations.ts`
- `src/data/pms/materials.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/pages/pms/logistics-reconciliations.ts`
- `src/pages/pms/material-reconciliations.ts`
- `src/pages/pms/material-purchase-orders.ts`
- `src/pages/pms/material-archives.ts`
- `src/pages/pms/kol-demands.ts`
- `src/pages/pms/bom-detail.ts`

### 页面路由

- `/pms/logistics-reconciliations`、`/pms/material-reconciliations`
- `/pms/material-purchase-orders`、`/pms/material-archives`
- `/pms/kol-demands`、`/pms/bom-templates/:spu`

### 验证命令

- `npm run build`：通过
- `npm run check:pms-purchase-chain`：通过（新增分项确认门禁、账单导入、关闭采购单、申报/报关补充断言）
- `npm test`：通过（含新增 3 项单测断言）
- `CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pms-*.spec.ts`：通过（35 项，含 P2/P3a/P3b 新增 4 个用例）
- `npm run check:menu-routes`、`npm run check:list-page-governance`、`npm run check:prototype-design-governance -- --all`：通过
- `npm run workflow:verify -- --output /private/tmp/pms-audit-task-receipt.json --task-boundary "PMS 迁移逐页功能核对与 7 项缺口修复"`：通过（收据见 `/private/tmp/pms-audit-task-receipt.json`）

### 性能证据（生产预览，Chromium，1366×768，2026-09-18）

- 本次受影响交互在 35 项验收中复测：物流对账（对账处理/导入，10 次）27–38ms；面辅料对账（对账处理抽屉，5 次）28–36ms；其余回归最大 50ms，全部 `<200ms`。
- 原始样本见测试输出 `pmsSettlementPerf.*` 等。

### 真实图片验证

- 本次不新增款式/物料对象；物料档案图片上传仍执行 png/jpg 与 5MB 校验，缩略图与大图能力未变。

### 例外

- 无
