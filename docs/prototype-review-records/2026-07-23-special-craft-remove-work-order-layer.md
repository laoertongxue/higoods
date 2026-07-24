# HiGood 原型审查记录：特殊工艺域去掉子加工单层

> 模板来源：`docs/prototype-review-record-template.md`

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-23 |
| 相关需求 / 任务 | 特殊工艺域删除子加工单层，任务单直接承担执行；列表页重写为标准列表页 |
| 涉及系统 | FCS（PFOS 辅助工艺工厂管理 + 特种工艺工厂管理） |
| 涉及页面路径 | `/fcs/process-factory/special-craft/{slug}/tasks`（列表）、`/fcs/process-factory/special-craft/{slug}/tasks/{taskId}`（详情）、`/fcs/process-factory/special-craft/{slug}/work-orders/{id}`（重定向） |
| 端类型 | 管理端 / 主管端 / PDA 员工执行端 |
| 主要角色 | 辅助工艺主管、特种工艺管理员、一线操作员 |
| 主要任务 | 查看特殊工艺加工单列表和详情，在 Web 端和 PDA 端执行状态变更操作 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-23-special-craft-remove-work-order-layer-design.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 管理端列表页（标准列表页）、主管端操作面板、PDA 端现场执行，角色定位不变 |
| 任务清晰度 | 通过 | 操作面板在任务详情页右侧直接可见，不再需要 3 层跳转 |
| 信息架构与导航 | 通过 | 列表页 → 任务详情页 → 右侧操作面板，2 步直达；旧 work-orders 路径自动重定向 |
| 页面模式 | 通过 | 列表页使用标准列表页模式（`renderStandardListPage`）；详情页左侧信息+右侧操作 |
| 信息负荷 | 通过 | 列表页支持列选择/显示控制，减少信息过载 |
| 文案 | 通过 | 所有状态、操作、列标题均为中文，无英文状态码 |
| 数量与状态 | 通过 | 状态值均中文（待领料、加工中、已完成等），数量带单位 |
| 扫码与识别 | 通过 | PDA 端操作流程不变（扫菲票→收货→开工→完工→交出） |
| 防错 | 通过 | 操作按钮仅在状态允许时出现，非允许状态显示"当前状态暂无可执行动作" |
| UI 样式 | 通过 | 复用标准列表页组件体系（48px 卡片、三态排序图标、冻结列/操作列固定） |
| 组件交互 | 通过 | 列排序、列选择/拖拽、冻结列全部支持；偏好按路由持久化 |
| 协作关系 | 通过 | 仓储流转规则不变（成衣仓→后道待加工仓→待交出仓→后道工厂） |
| 异常与追溯 | 通过 | 差异记录、交接记录、节点记录均保留 |
| 现场设备可用性 | 通过 | PDA 端操作对象改为任务单，输入方式不变 |

## 4. 问题标签

- `字段过载`（已解决）：列表页通过列选择/列显示控制减少信息过载

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 子加工单层使操作路径过长（3 步→不可见） | `状态抽象` | 主管 | 删除子加工单层，操作面板迁入任务详情页 | 否 |
| 列表页使用旧组件不满足标准列表页规范 | `组件误用` | 主管/管理 | 重写为 `renderStandardListPage` 标准列表页 | 否 |
| `lossQty` 字段名与业务语义不一致（应为报废 scrapQty） | - | 数据层 | 保留 `lossQty`（内部分配为 scrapQty 值），原型项目暂不全局重命名 | 低（仅影响开发者理解） |
| E2E 测试引用旧 `work-orders/{id}` 路由 | - | 测试 | 旧路由自动重定向到 `tasks/{taskId}`，测试断言需适配新页面结构 | 中（需手动更新测试） |

## 6. 最终结论

结论：通过

说明：
- 22 个文件变更，删除子加工单概念，任务单直接承担执行
- 列表页重写为标准列表页（`@page-pattern: list`），满足 AGENTS.md 7.3 全部要求
- `npm run build`、`check:list-page-governance`、`check:prototype-design-governance -- --all` 全部通过
- 无业务例外
- 剩余工作：E2E 测试需适配新页面结构，`lossQty` 字段可后续统一重命名为 `scrapQty`
