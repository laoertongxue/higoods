# 任务详情业务修订第一版

> 历史版本说明：本文记录 V1—V4 当时的需求、设计或验证，“当前／本轮／最新”均指当时版本。现行业务以 [V7 接入方案](v7-integration-design.md) 与用户确认口径为准，最新表达修正见 [文案歧义核查与修复清单](copy-clarity-audit-20261008.md)。实施和验收状态分别见 [V7 计划](v7-integration-plan.md)、[V7 矩阵](v7-integration-matrix.csv) 及本轮清单。本文与现行冲突的发货终点、需求维度、运输/审版/返工监控、规则编辑发布、旧性能门槛等不作为当前实施依据。原始规则、失败样本和证据保留，仅供追溯。


日期：2026-10-07。来源：本次业务核查及用户“先按照你的建议修复一版”。角色为跟单、计划及管理人员。目标路由为 `/dds/supply-chain/production-fulfillment/tasks/DEM-202603-0001`。

## 总体设计与边界

默认先展示任务识别、来源需求交期、计时起点、有效生产需求、已确认工作、关键待核实事项及跟进动作，再提供阶段概览、依赖图和甘特。来源未知须表达未知，不推定等待、停工、零完成或没有交期。相同工序保留独立分支，以已有物料标识识别；缺少对象资料时明确编号分支及待核实。需求要求交期不自动成为全程 SLA 或客户发货截止。

正常场景：存在执行任务、实际开始和前置进度时展示真实执行状态及对应责任；已确认阻断直接展示原因及后续影响。边界场景：只有正式技术包而无执行记录时展示执行进度待核实，前置关系仍保留，不能标成已确认等待；日期、数量、图片缺失均不得编造。

保留现有页面、路由、技术路线关系和管理端架构。无真实后端、数据库写入、外部消息或发布。跟进与负责人预计结束是本浏览器原型记录；新增保存覆盖两者的同一事务，旧跟进/预计键按显式迁移、读回校验及源键删除流程处理。其他 DDS 配置、来源关联、事项账旧存储不在本次迁移范围。实图缺失保留资料缺口，不以其他款图片替代。

## 实施计划

1. 判断规则：calculations、source-tasks、model → 区分未知前置与已确认等待，保留来源交期、对象和执行更新时间 → 专项契约。
2. 业务视图：task-overview、task-detail、dependency-graph、timeline、source-views.css → 默认概览、阶段范围、待核实责任与动作、对象识别、口径文案 → 1366×768、1280×720 实际页面及性能。
3. 跟进保存：followup-storage、index、task-detail、common → IndexedDB 单条记录、跟进与预计原子保存、幂等、失败保留输入、显式旧资料迁移 → 刷新、直达、隔离故障及迁移契约。
4. 验证与评审：专项检查、受影响类型检查、构建、命名页面/弹窗/打印及性能，保存截图并开放本地预览。产品确认由用户看效果后完成。

## 原子需求与证据

| 编号 | 来源 | 原子需求 | 工作包/位置 | 自动化 | 页面/性能 | 状态 | 证据 | 产品确认/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BIZ-001 | 核查1 | 前置未知不显示已确认等待，已有阻断不能因前置未知漏报 | 1/calculations, dependency-graph | 规则契约 | 依赖/摘要 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-002 | 核查2 | 多分支保留并显示可辨认对象，未知对象明确提示 | 1–2/source-tasks, work-labels | 分支契约 | 图/摘要/跟进 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-003 | 核查3 | 来源需求交期独立于 SLA 与发货期限显示 | 1–2/model, task-detail | 来源契约 | 首屏/打印 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-004 | 核查4 | 已用时间明确需求下达起点 | 2/task-detail | 浏览器 DOM/截图 | 首屏 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-005 | 核查5 | 有效生产需求与实发数量分开 | 2/task-detail | 数量契约 | 首屏/数量/打印 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-006 | 核查6 | 关键待核实事项展示协调人、来源与跟进入口 | 2/task-overview | 浏览器 DOM/截图 | 概览/跟进 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-007 | 核查7 | 未读取阶段明确待确认，不制造阶段工作 | 2/task-overview | 浏览器 DOM/阶段动作 | 阶段概览 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| BIZ-008 | 核查8 | 前置交付对象及整批/分批规则已知与未知分别表达 | 2/dependency-graph, task-detail | 依赖契约 | 图/摘要 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| PAGE-001 | 核查使用成本 | 首屏显示款号名称并默认业务概览，图字可读 | 2/task-detail, CSS | 浏览器 DOM/截图 | 两种尺寸截图 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| PAGE-002 | 核查时效新鲜度 | 来源、执行更新时间与读取时间分开 | 1–2/source-tasks, task-overview | 来源契约 | 首屏 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| STORE-001 | 核查保存机制 | 跟进及预计逐条、原子、幂等保存，失败保留输入 | 3/followup-storage, index | 浏览器保存/事务中止/冲突 | 保存刷新 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| STORE-002 | AGENTS 2.4.6 | 旧键显式迁移、读回验证、仅删除已验证旧键 | 3/followup-storage | 浏览器迁移/中断重试 | 迁移入口 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| PERF-001 | AGENTS 7.2 | 受影响加载与交互每项5次均≤1000ms | 4/浏览器检查 | 浏览器脚本 | 冷/刷新/站内/交互 | 已实现待验证 | output/playwright/dds-review-v1/verification.json；unit-tests.log及截图 | 用户待评审/v1 |
| IMAGE-001 | AGENTS 5.3 | 显示对应实图并可预览 | 2/沿用来源图片 | 图片状态 | 图片/大图 | 已阻塞 | SPU-2024-001 来源无对应实图 | 用户待补素材/v1 |

本版不把资料缺失标成正式完成；实现、验证及用户接受分别记录。

当前证据：133 项专项测试通过，范围内 TypeScript 0 错误，Vite 构建通过；命名浏览器检查 432 个原始样本、35 项事实断言全部通过，最慢 223.89999999990687ms，每个命名场景五次。实际截图含 1366×768 和 1280×720。CodeGraph 已同步且无待同步文件。证据详情见 `docs/prototype-review-records/2026-10-07-dds-task-business-review.md`。

矩阵暂不升级为正式已验证：真实图片门禁仍阻塞，且完整性能入口覆盖尚未闭环（全部既有来源关联保存、表格配置及跨模块来源页面不在本版命名检查中）。本版用于本地看效果，产品接受待用户评审。跟进卡片的负责人预计结束与后续跟进安排分别表达，不能把预计结束时间冒充反馈期限。

发布范围更新（2026-10-07）：用户在第一版本地预览后明确要求合并并推送 main。按此授权发布当前第一版，原子需求状态及素材/完整性能未闭环项保持如实记录，发布回执不替代全部业务验收。
