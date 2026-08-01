# PCS 调色任务三阶段审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | 生产工程任务：调色任务三阶段事实与门禁 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/engineering/color/:taskId` |
| 端类型 | 管理端 |
| 主要角色 | 跟单、染厂、买手 |
| 主要任务 | 读取 BOM 染色物料、跟单整批确认染色要求、染厂整批提交调色成果、买手逐项审核 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 本次业务事实

- 工程主单任务及其物料行是唯一事实源，不建立第二套调色任务仓储。
- 调色任务只读取当前任务内 `染色 + 正常` 的 BOM 物料行，印花、辅料和已结束行不得参与。
- 跟单必须一次确认全部当前染色物料行的潘通色卡色号、颜色名称和染色色号；任一行错误时整批不写入。
- 跟单确认完成后，染厂才能为全部当前物料行提交成果文件或效果图。
- 买手整张任务审核；有未通过行时逐项保留结论和原因，已通过行锁定，下一轮仅允许失败行重提。
- 跟单确认时间和买手最终通过时间由工程主单任务记录，并提供给生产准备投影读取，不新增生产准备状态。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 跟单确认颜色要求、染厂提交成果、买手最终审核，职责边界明确。 |
| 任务清晰度 | 通过 | 三阶段动作与前后门禁固定。 |
| 信息架构与导航 | 通过 | 保留既有调色任务列表与详情路由，详情按三个业务阶段顺序操作。 |
| 页面模式 | 通过 | 管理 / 协作端使用步骤块与逐项表单，不采用三栏布局。 |
| 信息负荷 | 通过 | 只维护完成调色必需的字段和成果。 |
| 文案 | 通过 | 校验反馈使用中文业务语言并指出具体物料行。 |
| 数量与状态 | 通过 | 当前有效染色物料行集合由主单实时派生。 |
| 扫码与识别 | 通过 | 本次不涉及扫码。 |
| 防错 | 通过 | 缺行、重复行、错任务、非染色行、缺字段和越阶段操作均阻断。 |
| UI 样式 | 通过 | 企业后台高密度但分阶段清晰，状态色仅用于完成、错误与主动作。 |
| 组件交互 | 通过 | 输入不整页重绘，成功局部刷新，失败就地反馈；物料行保留分页。 |
| 协作关系 | 通过 | 确认人、提交人、审核人及对应时间均留痕。 |
| 异常与追溯 | 通过 | 按用户当前范围不设计异常流程；正常审核和返工轮次可追溯。 |
| 现场设备可用性 | 通过 | 本次不涉及现场设备页面。 |

## 4. 问题标签

- `选不对`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 非染色或已结束物料可能误入调色任务 | 选不对 | 跟单、染厂、买手 | 所有阶段统一从工程主单派生当前有效染色行 | 否 |
| 染厂可能在跟单未确认颜色要求前提交成果 | 协作断裂 | 跟单、染厂 | 阶段三以前置确认时间作为强门禁 | 否 |
| 混合审核后已通过成果可能被再次修改 | 追溯不足 | 染厂、买手 | 已通过行锁定，返工只接受未通过行 | 否 |

## 6. 最终结论

结论：通过

说明：

- 数据边界、角色边界、阶段门禁、逐项审核和生产准备投影均由真实测试覆盖。
- 按当前范围不包含异常流程、历史任务迁移和实际大货染色。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-color-task-service.ts`
- `src/data/pcs-engineering-task-review.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/material-review-task-ui.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/main.ts`

### 页面路由

- 保留 `/pcs/engineering/color` 与 `/pcs/engineering/color/:taskId`，补齐同一路由下的输入 / 点击事件接线。

### 验证命令

- `npm run test -- tests/pcs-engineering-color-stages.spec.ts`：通过
- `npm run test -- tests/pcs-engineering-material-review.spec.ts`：通过
- `npm run test -- tests/pcs-engineering-pattern-assets.spec.ts`：通过
- `npm run test -- tests/pcs-engineering-master-domain.spec.ts`：通过
- `npm run test -- tests/pcs-engineering-dependency-policy.spec.ts`：通过
- `npm run test -- tests/pcs-engineering-professional-fact-source.spec.ts`：通过
- `npm run check:prototype-design-governance`：通过
- `npm run build`：通过
- `npx playwright test tests/pcs-engineering-task-review-ui.spec.ts`：通过

### 例外

- 无。
