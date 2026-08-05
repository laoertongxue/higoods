# FCS 任务分配列表字段与筛选实施追踪矩阵

## 1. 目标与完成标准

在统一任务分配工作台补齐线上已有且业务有效的列表信息，并增加能够支持生产计划员日常定位任务的高频与高级筛选。所有字段、筛选和结果都只面向生产阶段、后道阶段的可分配生产任务；生产准备加工单不进入该列表。

完成标准：字段完整、筛选可组合、阶段与工序工艺联动、已选条件可见、可单项清除和全部重置；准备阶段、质检/复检流程节点、任意连续工序和错误“工艺组”口径均不出现。

## 2. 原子需求追踪矩阵

| 编号 | 原子需求 | 实现位置 | 自动化证据 | 页面证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| LIST-001 | 列表展示款式图片、SPU 与款式名 | `unified-dispatch-workbench.ts` `columns.style` | `check:fcs-dispatch-list-filters` | `/fcs/dispatch/workbench` | 已验证 |
| LIST-002 | 列表展示生产单号与任务号 | `columns.identity` | 同上 | 同上 | 已验证 |
| LIST-003 | 阶段只显示生产阶段或后道阶段 | `taskListContext`、`columns.stage` | 同上 | 同上 | 已验证 |
| LIST-004 | 任务类型、工序、工艺同列展示，合并任务说明固定责任范围 | `columns.type` | 同上 | 同上 | 已验证 |
| LIST-005 | 数量、SKU 数和不可拆数量颗粒度同列展示 | `columns.scope` | 同上 | 同上 | 已验证 |
| LIST-006 | 车缝相关任务保留生产准备风险入口，非车缝明确不适用 | `columns.readiness` | `check:fcs-dispatch-bagging` | 同上 | 已验证 |
| LIST-007 | 展示国内跟单与印尼跟单，含未分配场景 | `columns.tracking`、`taskListContext` | `check:fcs-dispatch-list-filters` | 同上 | 已验证 |
| LIST-008 | 展示人工直接派单、竞价或自动分配来源 | `columns.assignmentMode` | 同上 | 同上 | 已验证 |
| LIST-009 | 展示承接工厂及接单状态 | `columns.factory` | 同上 | 同上 | 已验证 |
| LIST-010 | 同时展示标准价、派单价、币种、单位、偏差状态和冻结状态 | `columns.price` | 同上 | 同上 | 已验证 |
| LIST-011 | 展示分配状态与合同状态 | `columns.status` | 同上 | 同上 | 已验证 |
| FILTER-001 | 综合搜索覆盖 SPU、款式、生产单、任务、工序、工艺、工厂和跟单 | `taskRows`、`renderTaskFilters` | 同上 | 同上 | 已验证 |
| FILTER-002 | 首屏提供分配进度、分配方式、阶段、工序、工艺、工厂、价格、跟单和派单日期筛选 | `renderTaskFilters` | 同上 | 同上 | 已验证 |
| FILTER-003 | 更多筛选提供接单、自动分配、准备风险、装袋、合并、合同、数量、SKU、截止日期、币种和单位 | `renderTaskFilters` | 同上 | 同上 | 已验证 |
| FILTER-004 | 阶段变化清空工序与工艺，工序变化清空工艺 | `handleUnifiedDispatchWorkbenchEvent` | 同上 | 同上 | 已验证 |
| FILTER-005 | 已选条件形成标签，支持逐项清除和全部重置 | `renderActiveFilters`、事件处理 | 同上 | 同上 | 已验证 |
| FILTER-006 | 多个条件组合后列表计数、分页和空态同步变化 | `taskRows`、标准列表分页 | 同上 | 同上 | 已验证 |
| BOUNDARY-001 | 生产准备阶段对象不进入列表及阶段筛选 | `isAssignableProductionExecutionTask`、阶段选项 | 同上 | 同上 | 已验证 |
| BOUNDARY-002 | 质检、复检不作为工序；不出现工艺组、后道任务或任意连续工序筛选 | 列表列名、筛选选项 | 同上 | 同上 | 已验证 |

## 3. 验证与确认

- 自动化：`npm run check:fcs-dispatch-list-filters`。
- 相邻契约：统一分配、自动分配、菲票装袋、列表治理、原型治理和构建。
- 页面：1366×768 已验收默认列表、更多筛选、阶段联动、组合筛选、条件标签、逐项清除、全部重置和空结果；证据 `output/playwright/fcs-dispatch-list-filters-advanced.png`。
- 图片：款式缩略图与 SPU 同列，点击可查看高清图，并已验证按钮与 `Esc` 关闭；加载失败态沿用标准列表既有能力。
- 产品确认人：待产品确认。
- 确认版本：当前工作分支最终验证版本。
