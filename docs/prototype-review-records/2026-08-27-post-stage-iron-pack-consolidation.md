# 原型审查记录：后道烫包工序唯一化

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 | 2026-08-27 |
| 分支 | `codex/post-process-heat-pack-20260827` |
| 需求编号 | MASTER-001、CLEAN-001、DATA-001、PAGE-001、PAGE-002、TASK-001、TECH-001、PDA-001、MOCK-001、SCOPE-001、DOC-001、VERIFY-001 |
| 受管范围 | `src/pages/`、`src/data/`、`src/domain/` |
| 用户可见影响 | 有：后道工序名、质检选项、Mock 任务、PDA 待办、技术包工序选项 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：后道工序名称、工序工艺字典作用对象、质检选项与联动、实际工序单、PDA 待办、技术包工序选项和 Mock 任务均由两项旧工序收口为唯一烫包事实。

本记录按 `AGENTS.md` 第 4 节现场产品设计基线、第 5 节 UI 与交互专项规则和第 7 节验证原则执行。

### 角色与主动作

| 端 | 角色 | 当前任务 | 主动作 |
| --- | --- | --- | --- |
| 管理端 | 生产计划、后道主管 | 查看后道任务和工序字典 | 确认工序及工厂能力口径 |
| 管理端 | 后道质检员 | 对回货 SKU 判定后道项目 | 完成质检 |
| PDA | 工厂操作员 | 接收、填报、交出烫包任务 | 扫码后执行当前动作 |

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 不改变现有角色和动作流程，只统一工序事实。 |
| 文案、状态、数量与单位 | 通过 | 文案统一为烫包，作用对象为成衣，数量继续按件。 |
| 扫码、真实图片与对象识别 | 通过 | PDA 使用精确 `IRON_PACK` 识别；本次不新增图片对象。 |
| 防错、危险确认与主管兜底 | 通过 | 选择开扣眼或装扣子后，烫包自动勾选并锁定。 |
| 交接、跨端事实与异常追溯 | 通过 | Web、PDA、生产确认和交接读取同一烫包事实。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 未改变网络流程；1440×900 命名页面专项通过。 |
| 命名路由、交互、图片大图与打印 | 通过 | 三个命名路由与生产确认专项通过；图片不适用。 |

### 命名页面与验收点

| 路由／场景 | 验收点 | 当前结论 |
| --- | --- | --- |
| `/fcs/production/craft-dict` | 后道三工序；烫包唯一工艺、唯一工艺码且作用对象为成衣 | 已通过专项 Playwright |
| `/fcs/craft/post-finishing/qc-orders` | 后道项目为开扣眼、装扣子、烫包；关联锁定正确 | 已通过专项 Playwright |
| `/fcs/craft/post-finishing/work-orders` | 实际工序单明细使用烫包 | 已通过专项 Playwright |
| PDA 执行与交接 | PDA 识别当前工序名和相关操作 | `check-pda-exec-task-detail`、`check-mobile-execution-writeback` 通过 |
| 生产确认单 | 独立烫包作为外部任务参与确认，用户可见名称不显示技术码 | `check-production-confirmation` 通过 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 字典初次验收发现烫包作用对象沿用裁片部位默认值 | 选不对 | 生产计划、后道主管 | 在工序字典唯一事实源将作用对象修正为成衣，并增加脚本与浏览器断言 | 否 |
| 反向审查发现独立烫包被生产确认误当成内部节点 | 协作断裂 | 生产计划 | 生产确认只过滤开扣眼、装扣子，独立烫包按外部任务进入确认 | 否 |

### 范围保护

- PCS 包材档案与出货信息不变。
- 染色加工单的成卷封装及其交出门禁不变。
- 未新增后端、数据库、离线队列或自动重试。

## 6. 最终结论

结论：通过

第一遍已完成字典、后道领域、任务、PDA、生产确认、构建与命名页面正向验收；第二遍已完成禁用词、文件名、相似“包装”语境、完整差异和 CodeGraph 反向审查，并补齐独立烫包“整任务分配、SKU 需求明细可见”的字典口径。仍保留的“包装”仅属于包材／出货证据、染色成卷封装或普通语言表达，不是后道工序。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/material-request-drafts.ts`
- `src/data/fcs/merged-production-task.ts`
- `src/data/fcs/milestone-configs.ts`
- `src/data/fcs/page-adapters/task-execution-adapter.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-mobile-mock.ts`
- `src/data/fcs/post-finishing-domain.ts`
- `src/data/fcs/post-stage-taxonomy.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-types.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/production-confirmation.ts`
- `src/data/fcs/production-contracts.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/settlement-linked-mock-factory.ts`
- `src/data/fcs/sewing-delivery-sla.ts`
- `src/data/fcs/store-domain-quality-seeds.ts`
- `src/data/fcs/third-party-factory-comprehensive-assessment.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/domain/pickup/mock.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-notify-due-soon.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`

### 页面路由

- `/fcs/production/craft-dict`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/qc-orders`

### 验证命令

- `npm run build`：通过。
- `node --import tsx scripts/check-process-craft-final-taxonomy.ts`：通过。
- `node --import tsx scripts/check-post-finishing-flow-correction.ts`：通过。
- `node --import tsx scripts/check-post-finishing-qc-result-buckets.ts`：通过。
- `node --import tsx scripts/check-production-confirmation.ts`：通过。
- `node --import tsx scripts/check-fcs-unified-assignment-foundation.ts`：通过。
- `node --import tsx scripts/check-pda-exec-task-detail.ts`：通过。
- `node --import tsx scripts/check-mobile-execution-writeback.ts`：通过。
- `node --import tsx scripts/check-dyeing-workflow.ts`：通过。
- `npx playwright test tests/post-stage-iron-pack-consolidation.spec.ts --workers=1 --reporter=line`：通过。

### 真实图片验证

- 不适用：本次不新增或替换款式、物料及其图片，只调整工序事实、文案和 Mock 名称。

### 例外

- 无。
