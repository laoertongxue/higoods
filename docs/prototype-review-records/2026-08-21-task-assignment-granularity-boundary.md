# 任务分配粒度白名单修复原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-21 |
| 相关需求 / 任务 | 仅车缝、车缝+烫包、裁剪+车缝+烫包允许按完整 SKU 分配；其他任务强制整任务分配 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/dispatch/workbench` |
| 端类型 | 管理端 |
| 主要角色与任务 | 生产计划员在任务分配工作台直接派单，确认任务范围、承接工厂、价格和业务分配时间 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：非车缝任务直接派单弹窗移除可操作的 SKU 复选框，改为只读整任务范围；摘要和二次确认统一使用整任务 SKU 数及总件数。车缝、车缝+烫包、裁剪+车缝+烫包仍显示完整 SKU 选择。路由、列表字段、款式图片、工厂和价格操作保持不变。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端直接派单仍使用标准任务工作台弹窗，只调整任务范围选择方式。 |
| 文案、状态、数量与单位 | 通过 | 非车缝任务明确显示“本次派单为整个任务”“不按 SKU 拆分”，并保留 SKU 数和件数。 |
| 扫码、真实图片与对象识别 | 通过 | 本页不涉及扫码；列表原有款式实拍图、款号、生产单号和任务号保持同一对象块展示。 |
| 防错、危险确认与主管兜底 | 通过 | 非白名单任务不再提供 SKU 复选框；提交层忽略旧弹窗状态或篡改的 SKU 选择，始终提交完整范围。 |
| 交接、跨端事实与异常追溯 | 通过 | 分配结果仍进入原有效任务分配事实和日志；未改变后续接单、执行及交接。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 本次为管理端派单粒度修复，不涉及 PDA、上传或弱网流程；1366×768 命名用例已验收。 |
| 命名路由、交互、图片大图与打印 | 通过 | `/fcs/dispatch/workbench` 的非车缝整任务弹窗与裁剪+车缝+烫包 SKU 弹窗均已在当前分支验收；不涉及打印。 |

## 4. 问题标签

- `选不对`
- `点错风险`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 非车缝任务错误显示 SKU 选择，界面选中范围与实际整任务提交范围不一致 | 选不对、点错风险 | 生产计划员 | 以统一履约策略的分配粒度为唯一判断；非白名单任务固定为整任务，并在渲染、二次确认、提交三层同时收口 | 否 |
| 上游遗留 `assignmentGranularity: SKU` 可能再次放开非车缝任务 | 点错风险 | 生产计划员 | 非车缝独立任务在统一策略中强制归一为 `ORDER`，不再采信遗留粒度字段 | 否 |

## 6. 最终结论

结论：通过

说明：

- 允许按完整 SKU 分配的任务严格限定为车缝、车缝+烫包、裁剪+车缝+烫包。
- 其他独立任务以及整单任务均按完整任务分配，不允许在直接派单弹窗拆 SKU。
- 非车缝任务的页面显示、二次确认数量和最终提交范围已保持一致。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/task-fulfillment-policy.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/pages/unified-dispatch-workbench.ts`

### 页面路由

- `/fcs/dispatch/workbench`

### 验证命令

- `npm run check:fcs-unified-assignment-foundation`：通过
- `npm run check:fcs-dispatch-bagging`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/fcs-unified-dispatch-preparation-return-preview.spec.ts --workers=1 --grep '只有三类含车缝任务' --reporter=line`：通过，1/1
- Playwright CLI 当前分支页面验收：通过；非车缝任务无 SKU 复选框且显示 4 个 SKU、3,500 件整任务范围，裁剪+车缝+烫包显示 4 个完整 SKU 复选框
- Playwright CLI 浏览器控制台：通过，0 error、0 warning
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过（最终记录补齐后复跑）
- `npm run check:list-page-governance`：通过（最终记录补齐后复跑）
- `git diff --check`：通过

### 真实图片验证

- 列表继续使用原有与款式对应的稳定本地图片资源；本次未增加或替换图片。
- 当前分支页面验收确认缩略图与款号、生产单号、任务号仍在同一对象块；图片大图能力未改动。

### 验收证据

- `output/playwright/task-assignment-granularity-20260821/non-sewing-whole-task-dialog.png`
- `output/playwright/task-assignment-granularity-20260821/cutting-sewing-iron-pack-sku-dialog.png`

### 例外

- 完整 Playwright 文件中两条历史用例仍把 `TASKGEN-202603-0002-002` 当作独立车缝任务并要求车缝回货预览，但当前 `main` 的任务事实已将其定义为特殊工艺；两条失败已在未修改的 `main@8a34260a` 独立复现，与本次修复无关。
- `check:fcs-sewing-preparation-return-preview` 的标准价断言 `1,200` 与当前事实 `1,600` 不一致，也已在未修改的 `main@8a34260a` 独立复现，本次不越界修改价格口径。
