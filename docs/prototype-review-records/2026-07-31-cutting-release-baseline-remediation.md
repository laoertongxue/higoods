# 裁床发布基线数据与检查契约修复审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-31 |
| 相关需求 / 任务 | 裁床库位图交付前全量门禁查漏补缺与发布基线修复 |
| 涉及系统 | PFOS |
| 涉及页面路径 | `/fcs/craft/cutting/production-progress`、裁片放行、菲票、交出记录、特殊工艺加工单相关页面 |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 裁床主管、生产跟单、特殊工艺主管、仓库主管 |
| 主要任务 | 保证生产总览可读、裁片身份可识别、菲票同时覆盖普通与特殊工艺、交出数量可追溯、特殊工艺成衣任务可回溯冻结 BOM |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 修复均服务于现有管理与追溯页面，不新增现场角色或越权动作。 |
| 任务清晰度 | 通过 | 页面仍按生产单、菲票、交出记录和特殊工艺加工单表达既有任务。 |
| 信息架构与导航 | 通过 | 未改路由、菜单和详情入口。 |
| 页面模式 | 通过 | 生产总览保持只读宽表；其余变更为 Mock 业务事实补全。 |
| 信息负荷 | 有条件通过 | 生产总览保留 12 列业务事实，使用表格容器内部横向滚动和冻结关键列。 |
| 文案 | 通过 | 表头统一为现行“工厂 / 接单 / 领取”，状态与数量均为中文业务语义。 |
| 数量与状态 | 通过 | 首次交出的“之前已交”明确记录为 0；菲票保留普通与特殊工艺两类场景。 |
| 扫码与识别 | 通过 | 面料样布图、菲票号、交出记录号和来源 BOM 身份可供识别与追溯。 |
| 防错 | 通过 | 特殊工艺成衣补充任务只允许从具有适用成衣 BOM 的冻结技术包生成。 |
| UI 样式 | 通过 | 未改变既有企业后台视觉体系；宽表不再使用重复的 2280px 最小撑宽。 |
| 组件交互 | 通过 | 未新增交互；保留宽表容器内部滚动、冻结列与原详情入口。 |
| 协作关系 | 通过 | 生产单、冻结技术包、成衣 BOM、特殊工艺任务、菲票和交出记录之间的来源关系保持一致。 |
| 异常与追溯 | 通过 | 普通菲票不再被特殊工艺场景覆盖；成衣任务能回溯 `sourceBomItemId`。 |
| 现场设备可用性 | 通过 | 本次涉及管理端；页面级不产生横向溢出，宽表滚动限制在表格容器内。 |

## 4. 问题标签

- `算不准`
- `追溯不足`
- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 生产总览重复声明 2280px 最小宽度，违反页面级宽度治理 | `视觉干扰` | 生产跟单、裁床主管 | 改为由列宽自然撑开并只在既有表格容器内部滚动，保留 12 列和冻结列 | 否 |
| PO14671 冻结 BOM 缺少面料样布图，裁片身份检查失败 | `追溯不足` | 裁床主管、仓库主管 | 按物料编码生成可区分的内联样布图，并同步技术包图片快照 | 否 |
| 8 个菲票循环场景全部带特殊工艺，普通菲票被消失 | `算不准` | 裁床主管、特殊工艺主管 | 扩为 9 个场景，保留 8 类既有工艺并恢复 1 个无特殊工艺场景 | 否 |
| 首次交出记录的“之前已交”为空数组 | `算不准` | 仓库主管、接收人员 | 按前片、后片、袖片补 0 数量快照，与本次和累计口径对齐 | 否 |
| 特殊工艺补充任务可能使用没有成衣 BOM 的生产单 | `追溯不足` | 特殊工艺主管 | 成衣任务候选只取存在适用成衣 BOM 的冻结技术包，并写入来源 BOM ID | 否 |
| 两项专项检查仍使用旧表头、旧分组和已删除子加工单口径 | `追溯不足` | 评审人员 | 同步到现行 2/2/2/6 分组、行级进度聚合和标准任务列表字段 | 否 |

## 6. 最终结论

结论：通过

说明：

- 本次修复不新增业务能力，只关闭全量交付门禁暴露的既有数据与检查契约缺口。
- 没有放宽裁床主链、放行、特殊工艺、列表治理或原型治理断言。
- 生产总览唯一保留的业务例外是 12 列宽表需要在表格容器内横向滚动；页面主体不得横向溢出。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/production-order-overview-view.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/special-craft-task-orders.ts`

### 页面路由

- `/fcs/craft/cutting/production-progress`
- `/fcs/craft/cutting/release-management`
- `/fcs/craft/cutting/fei-ticket-management`
- `/fcs/craft/cutting/handover-management`
- `/fcs/process-factory/special-craft/*/tasks`

### 验证命令

- `npm run check:cutting-clean-mainline`：通过
- `npm run check:cutting:all`：通过
- `npm run check:cutting-production-progress-columns`：通过
- `npm run check:special-craft-task-generation`：通过
- `npm run check:cut-piece-release-mock-records`：通过
- `npm run check:cut-piece-release-available-qty`：通过
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过（2269 个模块）
- Playwright CLI 生产预览验收：通过（1366×768、1280×720 页面无横向溢出，表格容器内部横向滚动，冻结列有效，控制台 0 错误）

### 例外

- 生产总览为 12 列只读业务宽表，必须在表格容器内部横向滚动；已保留冻结生产单和款式列，删除的仅是重复的固定最小撑宽。
