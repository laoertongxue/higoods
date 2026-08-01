# PCS 工程任务页面模块拆分与事实源收口审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | Task 5：工程专业任务统一事实源与提交语义；延续 task-727 页面模块拆分 |
| 涉及系统 | PCS |
| 涉及页面路径 | /pcs/patterns/plate-making、/pcs/patterns/artwork、/pcs/samples/first-sample（列表与详情）；其余既有工程任务页面沿用原路由 |
| 端类型 | 管理端 |
| 主要角色 | 工艺、版师、花型设计师、买手、跟单、样衣制作团队 |
| 主要任务 | 制版、花型、产前版样衣统一读取工程主单任务；收口提交门禁和产前版样衣成果语义 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 本次业务事实

- 改版、制版、花型、首版样衣、首单样衣五类工程专业任务的页面逻辑从单一巨型文件拆分为：
  - `src/pages/pcs-engineering-tasks/shared.ts`：类型、state、公共渲染、图片 / 文件上传处理、标准列表公共骨架与模块钩子分派。
  - `src/pages/pcs-engineering-tasks/pattern-task.ts`：花型模块的列表 / 详情渲染、创建弹窗、流程视图与列表分派注册，导出页面入口与跨文件所需的成员选项读取。
  - `src/pages/pcs-engineering-tasks.ts`：保留其余四类任务的页面级函数、输入与事件处理入口，并通过 re-export 保持 10 个页面导出契约不变。
- 新增三个工程专业任务只读页面（读取工程主单任务记录）：
  - `src/pages/pcs-engineering-tasks/master-task-common.ts`：公共读取（listEngineeringTasksByType / getEngineeringTaskDetail）与公共卡片渲染（概要、主单、物料、返工、依赖、日志）。
  - `src/pages/pcs-engineering-tasks/color-task.ts`：调色任务（纱线 / 面料，COLOR_YARN / COLOR_FABRIC）。
  - `src/pages/pcs-engineering-tasks/purchase-task.ts`：辅料下单任务（ACCESSORY_PURCHASE）。
  - `src/pages/pcs-engineering-tasks/tech-pack-task.ts`：技术包确认任务（TECH_PACK_CONFIRMATION）。
- 三个新页面复用 shared.ts 标准列表骨架与模块钩子分派（module: color / purchase / techPack），状态筛选口径与工程任务记录 8 档状态一致（未启用、待前置、待开始、进行中、待审核、返工中、已完成、因需求变更结束），统计口径为全部 / 进行中 / 待审核 / 返工中 / 已完成；页面只读展示，任务状态推进在工程主单详情完成；主按钮“查看工程主单”为导航动作（nav: 前缀，走全局 data-nav 处理）。
- 制版、花型、产前版样衣新增独立页面模块，列表与详情均从 `EngineeringMasterOrderRecord.tasks` 展开，不再读取各自旧任务仓储：
  - 制版提交成果后直接完成。
  - 花型提交成果后进入待审核；逐项成果审核留到后续任务实施。
  - 产前版样衣由制作团队提交成果图片、制作数量和提交人，提交即完成，不生成任务级验收、确认人或复用结论。
- `submitEngineeringTaskResult` 只允许已发布或进行中的工程主单写入成果；待开始任务直接提交时自动补齐开始时间。技术包审核中、待关闭、已关闭等收口状态均阻断提交。
- 拆分不改变路由（10 个动态导入仍指向同一入口文件）、不改变 main-handlers 的输入 / 事件 / 弹窗导出契约、不改变页面文案、状态口径、筛选、分页、列偏好持久化与详情交互。
- 本切片只收口制版、花型、产前版样衣，不改独立改版任务的业务逻辑；三个新页面只展示工程任务统一 8 档状态。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 五类工程任务的角色与操作入口在拆分前后完全一致；三个新页面按工程主单任务定义展示负责团队（染厂 / 采购人员 / 跟单）。 |
| 任务清晰度 | 通过 | 制版、花型、产前版样衣列表明确展示所属主单、款式、团队、依赖与提交时间；详情读取同一任务事实。 |
| 信息架构与导航 | 通过 | 路由注册与页面跳转保持不变，10 个页面导出由同一入口 re-export 兼容；新页面通过 data-nav 与工程主单详情互相可达，主按钮“查看工程主单”走全局 data-nav 处理。 |
| 页面模式 | 通过 | 列表页仍使用标准列表骨架（renderEngineeringStandardListPage）与标准表格、分页。 |
| 信息负荷 | 通过 | 未新增或删除任何字段展示。 |
| 文案 | 通过 | 全部中文业务文案与状态值原样保留，无英文状态码。 |
| 数量与状态 | 通过 | 三个页面使用工程任务记录 8 档状态；产前版样衣成果数量带“件”，图片数量带“张”，均由任务事实读取。 |
| 扫码与识别 | 通过 | 本次不涉及扫码场景。 |
| 防错 | 通过 | 必需列、操作列固定、完成前缺字段拦截等防错逻辑原样保留。 |
| UI 样式 | 通过 | 未调整任何样式与布局。 |
| 组件交互 | 通过 | 弹窗、抽屉、行操作、Tab 均为局部更新，不触发整页重绘。 |
| 协作关系 | 通过 | 专业团队处理任务，工程主单承载任务与固定依赖；产前版样衣记录制作团队的提交人和提交时间。 |
| 异常与追溯 | 通过 | 操作记录、超期统计、空态提示原样保留；新页面展示任务时间线日志（生成 / 开始 / 提交 / 完成），物料行为空时展示空态文案。 |
| 现场设备可用性 | 通过 | 管理端页面，不涉及现场 PDA。 |

## 4. 问题标签

- 无命中标签（结构性拆分，不改页面语义）

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 巨型单文件（7624 行）难以维护，公共函数与页面逻辑混杂 | 无 | 工程专业任务维护者 | 按共享骨架 / 页面业务拆分，公共部分移入 shared.ts，页面函数保留在入口文件 | 否 |
| 列表公共读取散落在页面文件中 | 无 | 工程专业任务维护者 | 新增 registerEngineeringListModule 钩子注册，五个模块统一注册列 / 行 / 状态 / 统计 | 否 |

## 6. 最终结论

结论：通过

说明：

- 本次为纯结构性拆分：路由、事件入口、数据格式、页面文案与交互行为均保持兼容。
- 拆分后 `npm run check:list-page-governance`、`npm run check:prototype-design-governance -- --all` 与构建验证均通过。
- 全项目既有类型错误（如 TS2367 tab 比较、capacity-calendar 等）与本次拆分无关，已在验证中确认非本次引入。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-first-order-sample-project-writeback.ts`
- `src/data/pcs-first-order-sample-repository.ts`
- `src/data/pcs-first-order-sample-types.ts`
- `src/data/pcs-first-sample-project-writeback.ts`
- `src/data/pcs-first-sample-types.ts`
- `src/data/pcs-project-archive-sync.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-project-relation-bootstrap.ts`（已删除）
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-project-relation-types.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/data/pcs-testing-relation-bootstrap.ts`（已删除）
- `src/data/pcs-testing-relation-normalizer.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-tasks/shared.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/master-task-page.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/pattern-master-task.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/purchase-task.ts`
- `src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- `src/router/routes-pcs.ts`
- `src/router/route-renderers.ts`
- `src/data/app-shell-config.ts`

### 页面路由

- `/pcs/engineering/revision`、`/pcs/engineering/revision/:id`
- `/pcs/engineering/plate`、`/pcs/engineering/plate/:id`
- `/pcs/engineering/pattern`、`/pcs/engineering/pattern/:id`
- `/pcs/engineering/first-sample`、`/pcs/engineering/first-sample/:id`
- `/pcs/engineering/first-order-sample`、`/pcs/engineering/first-order-sample/:id`
- `/pcs/engineering/color`、`/pcs/engineering/color/:id`
- `/pcs/engineering/purchase`、`/pcs/engineering/purchase/:id`
- `/pcs/engineering/tech-pack`、`/pcs/engineering/tech-pack/:id`
- `/pcs/patterns/plate-making`、`/pcs/patterns/plate-making/:id`
- `/pcs/patterns/artwork`、`/pcs/patterns/artwork/:id`
- `/pcs/samples/first-sample`、`/pcs/samples/first-sample/:id`

### 验证命令

- `npx tsx tests/pcs-engineering-task-submit.spec.ts`：通过（真实调用提交门禁、开始时间与局部刷新行为）
- `npx tsx tests/pcs-engineering-professional-fact-source.spec.ts`：通过（制版、花型、产前版样衣读取工程主单任务）
- `npx tsx tests/pcs-first-sample-engineering-result.spec.ts`：通过（真实提交成果并验证持久化、校验与无任务级验收文案）
- `npx tsx tests/pcs-engineering-task-status.spec.ts`、`pcs-engineering-master-domain.spec.ts`、`pcs-engineering-dependency-policy.spec.ts`：通过
- `npm run check:list-page-governance:static`：通过

- `npm test -- tests/pcs-engineering-task-status.spec.ts`：通过（状态集合 8 档断言）
- `npm run check:pcs-plate-making-refactor`：通过
- `npm run check:pcs-pattern-task-refactor`：通过（已同步扫描 pattern-task.ts）
- `npm run check:pcs-sample-chain-refactor`：通过
- `npm run check:pcs-revision-task-refactor`、`check:pcs-revision-remodel-acceptance`、`check:pcs-plate-making-mock-data`、`check:pcs-first-sample-node-writeback`、`check:pcs-plate-sample-readiness`、`check:pcs-closure-unification`：通过（逐一运行确认）
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:menu-routes`：通过
- `npx tsc --noEmit --allowImportingTsExtensions`：通过（本次改动文件无新增类型错误；全项目既有错误非本次引入）
- `npm run build`：通过

### 例外

- 无
