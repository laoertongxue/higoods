# PCS 辅料采购单绑定审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-02 |
| 相关需求 / 任务 | Task 9：多个辅料采购单绑定与覆盖门禁 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/engineering/purchase`、`/pcs/engineering/purchase/:taskId`、`/pcs/engineering/masters/:masterOrderId` |
| 端类型 | 管理端 |
| 主要角色 | 采购人员、跟单 |
| 主要任务 | 采购人员输入采购单号，读取采购事实并覆盖工程采购任务所需辅料 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 本次业务事实

- 采购人员仍在采购管理系统完成下单；PCS 不新增、编辑、审核或取消采购单。
- PCS 只保存采购单号引用；供应商、物料、数量、状态和实际下单时间来自采购事实 Mock 适配器，并只读展示。
- 工程采购任务所需物料来自 BOM 同步到该任务的有效辅料行，不在采购页面重复填写。
- 一张任务允许绑定多个采购单；采购单须属于当前款式并至少包含一项任务所需辅料，重复、无权、跨款和作废采购单明确阻断。
- 全部所需辅料由有效采购单覆盖且每张单具有实际下单时间时，任务自动完成；完成时间取最晚实际下单时间。
- 解除绑定后立即重新计算覆盖，条件不再满足时恢复未完成，不提供人工完成、审批和取消入口。
- 生产准备时效只在后续任务读取本任务完成事实，本切片不增加时效编辑或投影逻辑。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 采购人员只做采购单引用绑定，跟单读取工程结果。 |
| 任务清晰度 | 通过 | 详情页仅保留采购单号输入、绑定动作、覆盖进度和绑定结果。 |
| 信息架构与导航 | 通过 | 从工程主单采购任务进入唯一采购任务详情，不复制采购系统。 |
| 页面模式 | 通过 | 管理端详情使用简洁表格承载跨系统只读事实。 |
| 信息负荷 | 通过 | 不重复展示采购编辑字段，不增加说明区和异常中心。 |
| 文案 | 通过 | 动作、状态和错误均使用简短中文业务文案。 |
| 数量与状态 | 通过 | 采购数量均带单位；覆盖数量和缺少 SKU 由系统计算。 |
| 扫码与识别 | 通过 | 当前管理端按采购单号绑定，不涉及现场扫码。 |
| 防错 | 通过 | 无效、无权、跨款、无关、重复采购单均阻断；缺料和缺实际时间禁止完成。 |
| UI 样式 | 通过 | 沿用 PCS 企业后台卡片、表格、按钮和状态色。 |
| 组件交互 | 通过 | 输入不触发整页重绘；绑定、解绑和分页只刷新采购联动区域。 |
| 协作关系 | 通过 | 采购系统提供采购事实，BOM 提供应采购辅料，工程任务保存覆盖结果和完成时间。 |
| 异常与追溯 | 通过 | 只展示必要阻断原因；按需求不实现异常模块。 |
| 现场设备可用性 | 通过 | 管理端宽表在容器内横向滚动，操作列保持在表格末端。 |

## 4. 问题标签

- 无命中标签。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 让采购人员在 PCS 重复录入供应商、物料、数量和时间 | 字段过载 | 采购人员 | 只输入采购单号，其余字段从采购事实只读展示 | 否 |
| 单张采购单不能覆盖全部辅料时误判任务完成 | 算不准 | 采购人员、跟单 | 支持多单并按所需 SKU 合并覆盖，展示缺少 SKU | 否 |
| 通用“提交成果”可绕过采购覆盖门禁 | 点错风险 | 采购人员 | 仓储层禁止采购任务通用提交，工程主单入口跳转绑定页 | 否 |

## 6. 最终结论

结论：通过。

- 页面仅承担绑定与读取，采购事实和工程任务边界清楚。
- 无产品设计规范例外。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-purchase-linkage.ts`
- `src/pages/pcs-engineering-tasks/purchase-task.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `tests/pcs-engineering-purchase-linkage.spec.ts`
- `tests/pcs-engineering-task-submit.spec.ts`

### 页面路由

- `/pcs/engineering/purchase`
- `/pcs/engineering/purchase/:taskId`
- `/pcs/engineering/masters/:masterOrderId`

### 验证命令

- `npm test -- tests/pcs-engineering-purchase-linkage.spec.ts`：通过。
- `npm test -- tests/pcs-engineering-task-submit.spec.ts`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:menu-routes`：通过。
- `npm run build`：通过。

### 例外

- 无。
