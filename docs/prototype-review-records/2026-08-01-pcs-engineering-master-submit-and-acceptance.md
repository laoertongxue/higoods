# PCS 工程主单提交语义与首版样衣验收收敛审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | task-727 任务 5：工程主单任务提交成果语义（制版 / 样衣提交即完成，花型 / 调色进入待审核）；删除首版样衣任务级验收动作 |
| 涉及系统 | PCS |
| 涉及页面路径 | /pcs/engineering/masters、/pcs/engineering/masters/:id（工程主单列表与详情）、/pcs/samples/first-sample、/pcs/samples/first-sample/:id（首版样衣列表与详情） |
| 端类型 | 管理端 |
| 主要角色 | 版师、花型设计师、跟单、样衣制作团队、买手 |
| 主要任务 | 明确 master 任务“提交成果”的完成语义与前置约束；首版样衣由制作团队提交成果即完成，删除任务级验收动作 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 本次业务事实

- master 任务提交语义（`resolveEngineeringTaskSubmitStatus` + `submitEngineeringTaskResult`）：
  - 制版（梭织 / 针织基码、齐码）、产前版样衣、辅料下单、技术包确认为 `reviewRequired = false`，提交成果后任务直接进入"已完成"，同时写入提交时间（submittedAt）与首次 / 生效完成时间（firstCompletedAt / effectiveCompletedAt，二者相等）。
  - 花型（PATTERN_ARTWORK）与调色（COLOR_YARN / COLOR_FABRIC）为 `reviewRequired = true`，提交成果后进入"待审核"，由买手逐项审核（任务 6 实现）。
  - 提交前置校验：仅已发布工程主单的任务可提交；待开始 / 进行中 / 待前置可提交；未启用、待审核、返工中、已完成、因需求变更结束拒绝；待前置任务要求所有依赖任务处于"已完成"或"因需求变更结束"。
  - UI：master-detail 任务抽屉 footer 新增"提交成果"按钮与按任务类型区分的提示文案（待审核提示"由买手逐项审核"，直接完成提示"无需人工确认"）；提交成功后泳道区域与抽屉局部刷新并展示反馈条，不整页重绘。
- 首版样衣验收收敛：
  - 删除任务级验收弹窗（填写验收结论、验收说明、确认人 / 确认时间）及其事件、输入、state、acceptance map 全部残留。
  - 制作团队提交首版样衣结果时直接写“已通过”状态、确认时间、版型与花型成果说明、生产准备说明，并按样衣用途（首单复用候选）写入“复用为首单依据”；不再生成“待确认”中间状态，也不再提供第二次“确认完成”动作。
  - 详情页“验收与结论”Tab 改为只读展示，结论一律从任务字段读取；“打样结果”与“验收与结论”Tab 的引导文案同步为“成果提交即完成”。
- 状态保留例外：首版样衣"待确认 / 已通过 / 需改版"状态值全部保留，仅删除任务级验收动作。"需改版"仍是改版任务演示链路的入口（需改版 → 创建改版任务）；Mock 中"已通过"任务携带 confirmedAt / confirmedBy 可只读展示确认结论。
- 既有类型缺陷修复：任务抽屉此前直接访问卡片模型上没有的 startedAt / materialLines / reworkRounds 等字段（TS2339 既有 bug），本次改为从 repository 读取原始任务记录（getEngineeringMasterOrderById），同时保持卡片模型派生字段（currentNodeName 等）从卡片模型取。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 提交成果动作归属任务负责人；待审核任务的审核角色（买手）在提示文案中前置说明，任务 6 接入审核服务。 |
| 任务清晰度 | 通过 | 抽屉内明确区分“提交后即完成”与“提交后进入待审核”两类语义；首版样衣只保留“开始打样 → 提交结果”两个执行动作。 |
| 信息架构与导航 | 通过 | master 泳道工作台与抽屉入口不变；删除验收弹窗后详情页 Tab 结构不变，仅改只读展示。 |
| 页面模式 | 通过 | 沿用既有抽屉 + 局部刷新模式，不新增页面范式。 |
| 信息负荷 | 通过 | 验收 Tab 不再引导补录完整字段，只读展示任务字段中的确认结论，负荷降低。 |
| 文案 | 通过 | 全部中文文案；提交提示、成果状态均按业务语义书写，无英文状态码。 |
| 数量与状态 | 有条件通过 | master 提交后状态分派（已完成 / 待审核）正确；花型 / 调色初始“未启用”在演示链路中无法提交（条件任务，计划任务 8 启用），分派逻辑以纯函数测试覆盖“待审核”分支；首版样衣成果提交直接形成“已通过”状态。 |
| 扫码与识别 | 通过 | 本次不涉及扫码场景。 |
| 防错 | 通过 | 提交前置校验（主单发布、任务状态、依赖完成）在 repository 层兜底，UI 只展示可提交状态的按钮；重复提交、未启用、返工中均拒绝并反馈。 |
| UI 样式 | 通过 | 按钮、反馈条、提示文案沿用既有卡片 / 徽章 / 按钮样式，无新增样式体系。 |
| 组件交互 | 通过 | 提交成果后仅刷新泳道区域与抽屉内容（refreshLanesRegion + 抽屉重渲染），不触发整页重绘。 |
| 协作关系 | 通过 | 提交基码 → 样衣待前置解锁 → 提交样衣 → 齐码解锁的演示链路可走通；样衣成果提交后确认事实仍同步商品项目关系。 |
| 异常与追溯 | 通过 | 提交失败（前置未完成、状态不允许）均有中文反馈；首版样衣成果提交写入运行时日志，日志链路保留。 |
| 现场设备可用性 | 通过 | 管理端页面，不涉及现场 PDA。 |

## 4. 问题标签

- 未命中问题标签。
- 其余标签未命中。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| master 任务"提交成果"缺少统一完成语义，各任务类型无差异分派 | 无 | 版师、花型设计师、跟单 | 新增 resolveEngineeringTaskSubmitStatus 按 reviewRequired 分派（制版 / 样衣 / 辅料 / 技术包 → 已完成，花型 / 调色 → 待审核），repository 层提交函数统一落地 | 否 |
| 待前置任务可绕过依赖直接提交 | 无 | 跟单 | 提交前校验全部依赖处于已完成 / 因需求变更结束，否则拒绝并提示"前置任务未完成" | 否 |
| 首版样衣存在“提交结果 → 待确认 → 再次确认完成”的任务级验收链路 | 状态抽象 | 样衣制作团队、跟单 | 删除验收弹窗、事件、输入、state、map 和第二次确认分支；制作团队提交成果即写已通过及确认事实 | 否 |
| 任务抽屉访问卡片模型不存在的字段（既有类型 bug） | 无 | 维护者 | 抽屉从 repository 读取原始任务记录，卡片派生字段仍取卡片模型 | 否 |

## 6. 最终结论

结论：有条件通过

说明：

- master 提交语义（步骤 3）与首版样衣任务级验收删除（步骤 4）实现完整，测试覆盖提交分派、前置校验、重复提交拒绝，以及首版样衣提交即完成且无第二确认动作。
- 条件项见“例外”：花型 / 调色演示链路中的待审核提交（条件任务未启用，任务 8 启用）。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-dependency-policy.ts`（新增 resolveEngineeringTaskSubmitStatus）
- `src/data/pcs-engineering-master-repository.ts`（新增 submitEngineeringTaskResult）
- `src/pages/pcs-engineering-master-detail.ts`（提交成果按钮 + 事件 + 泳道 / 抽屉局部刷新 + rawTask 修复）
- `src/pages/pcs-engineering-tasks.ts`（删除验收弹窗、事件、输入、state 与第二次确认动作；提交首版样衣成果直接完成；文案更新）
- `src/pages/pcs-engineering-tasks/shared.ts`（删除 firstSampleAcceptance 系列 state 字段与 acceptance map）
- `tests/pcs-engineering-task-submit.spec.ts`（新增提交语义测试）
- `tests/pcs-engineering-task-standard-list.spec.ts`（存储键断言跟随重构：改从 shared.ts 常量读取）

### 页面路由

- `/pcs/engineering/masters`
- `/pcs/engineering/masters/:id`
- `/pcs/samples/first-sample`
- `/pcs/samples/first-sample/:id`

### 验证命令

- `npm test -- tests/pcs-engineering-task-submit.spec.ts`：通过
- `npm test -- tests/pcs-engineering-tasks.spec.ts`：通过
- `npm test -- tests/pcs-engineering-task-status.spec.ts`：通过
- `npm test -- tests/pcs-engineering-master-domain.spec.ts`：通过
- `npm test -- tests/pcs-engineering-dependency-policy.spec.ts`：通过
- `npm test -- tests/pcs-engineering-task-binding-mode.spec.ts`：通过
- `npm test -- tests/pcs-engineering-task-standard-list.spec.ts`：通过
- `npm test -- tests/pcs-engineering-master-pages.spec.ts`：通过
- `npm test -- tests/pcs-page-slimming-engineering-tasks.spec.ts`：通过
- `npm run check:pcs-plate-making-refactor`：通过
- `npm run check:pcs-pattern-task-refactor`：通过
- `npm run check:pcs-sample-chain-refactor`：通过
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:menu-routes`：通过
- `npm run build`：通过

### 例外

- 花型 / 调色任务在工程主单中初始为“未启用”（条件任务，计划任务 8 启用），演示链路中无法真实提交进入“待审核”；提交分派逻辑已用纯函数测试覆盖“待审核”分支，任务 6 实现审核服务时以单元测试覆盖完整链路。
