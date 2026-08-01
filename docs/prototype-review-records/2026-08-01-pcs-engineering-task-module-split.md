# PCS 工程专业任务统一事实源审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-01 |
| 相关需求 / 任务 | Task 5：工程专业任务页面统一读取工程主单任务 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/patterns/plate-making`、`/pcs/patterns/artwork`、`/pcs/samples/first-sample` |
| 端类型 | 管理端 |
| 主要角色 | 版师、花型制作团队、样衣制作团队、买手、跟单 |
| 主要任务 | 查看和推进制版、花型、产前版样衣任务；按工程主单固定依赖展示任务状态 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 本次业务事实

- 工程主单是制版、花型、产前版样衣等工程专业任务的唯一事实源；列表和详情均由工程主单任务展开，不再维护第二套专业任务数据。
- 花型任务只保留 `src/pages/pcs-engineering-tasks/pattern-task.ts` 一个正式页面入口，不保留并行的第二页面。
- 工程专业任务统一展示 8 档状态：未启用、待前置、待开始、进行中、待审核、返工中、已完成、因需求变更结束。
- 每张真实任务独立显示，所属工程主单、款式、负责团队、前置依赖、开始时间、完成时间均读取同一条工程任务记录。
- 制版任务由制作团队提交成果后完成；花型任务提交成果后进入买手审核；产前版样衣任务填写成果图片、制作数量和提交人，制作团队提交后完成，不设置任务级验收。
- 产前版样衣成果校验失败时保留抽屉与已填内容，错误紧邻提交动作显示；只有提交成功才局部刷新泳道与抽屉。
- 页面使用标准列表页、标准表格和分页；列显示、顺序、冻结及每页条数按路由保存，操作列固定在右侧。
- `shared.ts` 只承担列表偏好、通用渲染和仍在使用的独立改版页面状态；不再保存制版、花型的创建 / 详情草稿，也不再处理其图片和文件草稿事件。
- 本切片不实施花型或调色成果逐项审核与返工，相关能力在后续任务完成。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 各专业团队处理自己的真实任务；买手承担花型成果审核，跟单从工程主单查看整体进度。 |
| 任务清晰度 | 通过 | 一张任务一行，主单、款式、团队、依赖和状态均可直接识别。 |
| 信息架构与导航 | 通过 | 制版、花型、产前版样衣沿用既有正式路由；列表可进入任务详情和工程主单。 |
| 页面模式 | 通过 | 三个列表页均使用标准列表页、标准表格和分页组件。 |
| 信息负荷 | 通过 | 页面仅保留执行、判断和追溯所需字段，无额外说明性文案。 |
| 文案 | 通过 | 页面状态与动作均为中文业务文案，不输出内部状态码。 |
| 数量与状态 | 通过 | 状态固定为 8 档；产前版样衣制作数量以“件”、成果图片以“张”展示。 |
| 防错 | 通过 | 固定依赖由工程主单控制；成果提交仍受主单状态和必填成果门禁约束。 |
| UI 样式 | 通过 | 复用现有 PCS 企业后台样式与标准列表页组件。 |
| 组件交互 | 通过 | 筛选、排序、列设置和分页均为列表局部交互。 |
| 协作关系 | 通过 | 工程主单承载任务和依赖，各专业页面只读取并推进对应任务。 |
| 现场设备可用性 | 通过 | 本次为管理端页面，不涉及 PDA。 |

## 4. 问题标签

- 无命中标签。

## 5. 主要问题与处理

| 问题 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- |
| 花型存在两个页面入口，事实和交互可能分叉 | 花型制作团队、买手、跟单 | 删除第二页面，正式路由和分派器统一使用 `pattern-task.ts` | 否 |
| 制版、花型仍保留页面私有草稿和旧数据依赖 | 版师、花型制作团队、维护人员 | 删除无引用草稿类型、状态、初始化器及事件分支，页面统一读取工程主单任务 | 否 |
| 旧检查仍以旧状态或旧分页结构作为通过条件 | 研发、验收人员 | 更新为真实工程主单数据、8 档状态和标准列表 / 分页行为 | 否 |
| 产前版样衣成果校验失败仍刷新抽屉，导致输入丢失且错误提示被遮挡 | 样衣制作团队 | 失败时不刷新泳道和抽屉，在抽屉按钮附近就地显示错误；成功后才局部刷新 | 否 |

## 6. 最终结论

结论：通过。

- 工程主单事实源、唯一花型页面、8 档状态、标准列表和产前版样衣提交语义已统一。
- 未实施 Task 6 的花型 / 调色成果逐项审核与返工。
- 无产品设计规范例外。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-engineering-tasks/shared.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/pattern-master-task.ts`（删除）
- `tests/pcs-engineering-professional-fact-source.spec.ts`
- `tests/pcs-engineering-task-standard-list.spec.ts`
- `scripts/check-pcs-pattern-task-refactor.ts`
- `scripts/check-pcs-plate-making-mock-data.ts`

### 验证命令

- `npx tsx tests/pcs-engineering-task-status.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-task-submit.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-tasks.spec.ts`：通过；以工程主单真实任务验证制版、花型、产前版样衣、首单静默别名和独立改款 / 设计打样边界。
- `npx tsx tests/pcs-engineering-pre-production-sample-submit.spec.ts`：通过。
- `npx playwright test tests/pcs-engineering-pre-production-sample-submit-dom.spec.ts --workers=1`：通过；真实 DOM 与点击事件验证失败输入保留、错误就地可见、成功后局部刷新。
- `npx tsx tests/pcs-first-sample-engineering-result.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-professional-fact-source.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-task-standard-list.spec.ts`：通过。
- `npx tsx tests/pcs-engineering-shared-state-boundary.spec.ts`：通过。
- `node --import tsx tests/pcs-engineering-thin-dispatcher.spec.ts`：通过。
- `npm run check:pcs-plate-making-refactor`：通过。
- `npm run check:pcs-pattern-task-refactor`：通过。
- `npm run check:pcs-sample-chain-refactor`：通过。
- `npm run check:pcs-plate-making-mock-data`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:menu-routes`：通过。
- `npm run build`：通过。

### 例外

- 无。
