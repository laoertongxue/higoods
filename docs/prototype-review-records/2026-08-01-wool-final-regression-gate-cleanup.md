# 毛织最终回归门禁补齐原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | 毛织管理事实流 Task16：相对 main 的最终回归门禁补齐 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/craft/cutting/production-order-overview`、毛织相关页面最终回归 |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 生产跟单、裁床主管、毛织主管 |
| 主要任务 | 让最终回归门禁能基于真实页面和 Mock 数据闭环，不绕过裁床与原型治理兜底检查 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-wool-management-fact-workflow-design.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 仅补齐最终回归门禁暴露的生产单总览与 PO14671 冻结数据，不改变毛织业务角色 |
| 任务清晰度 | 通过 | 宽表继续在滚动容器内部查看；PO14671 物料身份补齐图片后可被裁片单和菲票链路追溯 |
| 信息架构与导航 | 通过 | 不新增入口，不改变页面导航 |
| 页面模式 | 通过 | 生产单总览表仍为内部宽表滚动，不使用禁止的外层撑宽写法 |
| 信息负荷 | 通过 | 不增加页面字段，仅修正布局类名与 Mock 身份数据 |
| 文案 | 通过 | 无新增用户文案 |
| 数量与状态 | 通过 | 不改数量、状态或流程口径 |
| 扫码与识别 | 不适用 | 本次无扫码交互 |
| 防错 | 通过 | 裁片单生成源的面料身份包含 SKU、名称、颜色、别名和图片，避免后续链路出现不可识别面料 |
| UI 样式 | 通过 | 固定宽表保留在滚动容器内部，不造成页面主体横向溢出 |
| 组件交互 | 通过 | 不新增交互；最终门禁复查标准列表和构建 |
| 协作关系 | 通过 | PO14671 生产单、技术包快照、裁片单和菲票链路保持同一物料身份 |
| 异常与追溯 | 通过 | 补齐 materialImageUrl，裁片单物料身份不再出现空图片 |
| 现场设备可用性 | 不适用 | 本次无现场设备操作 |

## 4. 问题标签

- `追溯不足`
- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| PO14671 放行补料物料缺少图片身份，裁片单生成源无法满足完整物料识别 | `追溯不足` | 裁床主管、仓管 | 在冻结技术包 BOM 与 imageSnapshot 中补稳定本地物料图片引用 | 否 |
| 生产单总览宽表使用被主线门禁禁止的 `min-w >= 1600px` 写法 | `视觉干扰` | 生产跟单 | 改为固定表格宽度并继续由滚动容器承接横向滚动 | 否 |

## 6. 最终结论

结论：通过。

本记录仅覆盖最终回归门禁补齐，不引入新的毛织业务规则。毛织事实流仍以正式设计文档和主审查记录为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/production-orders.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/pages/process-factory/cutting/production-order-overview-view.ts`
- `docs/prototype-review-records/2026-07-30-wool-management-fact-workflow.md`

### 页面路由

- `/fcs/craft/cutting/production-order-overview`

### 验证命令

- `npm run check:cutting:all`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run build`：通过。

### 例外

- 无
