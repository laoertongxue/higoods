# PCS 商品项目固定五步流程原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-30 |
| 相关需求 / 任务 | 商品项目从模板／工作项运行时改为固定五步业务流程 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/projects`、`/pcs/projects/create`、`/pcs/projects/:projectId`、`/pcs/projects/:projectId/work-items/:projectNodeId` |
| 端类型 | 管理端 |
| 主要角色 | 商品企划、商品运营、项目负责人 |
| 主要任务 | 创建商品项目与商品／款式档案，并按五个固定步骤逐步完成测款业务 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

本次重点参考角色与端类型、管理端信息密度、任务与动作表达、中文状态、防错与异常追溯、低分辨率可用性等规范。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 页面保持 PCS 管理端定位，服务商品企划、运营与项目负责人。 |
| 任务清晰度 | 通过 | 创建页直接说明固定五步流程，项目详情按步骤展示当前节点和下一步。 |
| 信息架构与导航 | 通过 | 固定为“项目与档案建立、样衣准备、测款前准备、市场测款、测款判断与收尾”五步导航。 |
| 页面模式 | 通过 | 保留现有管理端详情、业务表单和节点办理入口。 |
| 信息负荷 | 通过 | 移除模板选择与模板统计，创建页只展示业务必填信息和五步预览。 |
| 文案 | 通过 | 页面使用中文业务名称，不展示步骤英文编码。 |
| 数量与状态 | 通过 | 数量和状态仍沿用现有业务表单口径，档案初始状态明确为“商品测款”。 |
| 扫码与识别 | 通过 | 本页面为管理端，不涉及现场扫码。 |
| 防错 | 通过 | 创建项目不再允许选择或拼装模板；历史快照迁移失败时保留原始数据并明确报错，不再静默覆盖为演示数据。 |
| UI 样式 | 通过 | 复用现有企业后台布局、卡片、步骤和表单样式。 |
| 组件交互 | 通过 | 保留现有局部表单、弹窗和节点操作方式，未引入新框架。 |
| 协作关系 | 通过 | 项目创建时同步关联商品／款式档案，项目与档案使用同一来源项目标识。 |
| 异常与追溯 | 通过 | 固定步骤契约、节点来源版本和档案来源项目节点均可追溯。 |
| 现场设备可用性 | 通过 | 本次未改变管理端既有响应式布局与交互范式。 |

## 4. 问题标签

- `点错风险`
- `协作断裂`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 模板选择会让同一测款业务产生不同节点组合 | `点错风险` | 商品企划、项目负责人 | 移除模板选择，统一由固定五步契约生成项目步骤和节点 | 否 |
| 项目创建后才生成商品／款式档案，资料归属不完整 | `协作断裂` | 商品企划、商品运营 | 创建项目时同步建立“商品测款”状态档案并回写关联 | 否 |
| 历史本地快照迁移异常会回退演示数据 | `协作断裂` | 商品企划、项目负责人 | 历史项目按固定五步幂等迁移并保留节点办理记录；读取或迁移失败保留原始快照并报错 | 否 |
| 历史已有档案仍指向已移除的旧档案节点 | `协作断裂` | 商品企划、商品运营 | 按项目读取迁移前真实 `STYLE_ARCHIVE_CREATE` 节点 ID 并精确改绑；仅兼容精确哨兵 `old-style-node`，空来源、技术包及其他来源保持原值，档案业务数据不变 | 否 |
| “暂保留”被解释为继续测款 | `点错风险` | 商品运营、项目负责人 | 暂保留只保留既有测款事实与判断入口，不创建或重新激活直播、短视频测款节点 | 否 |
| 测款前准备遗漏既有表单入口 | `协作断裂` | 商品企划、商品运营 | 在固定第三步恢复拍摄试穿、样衣确认、样衣核价、样衣定价及可行性、渠道准备入口 | 否 |
| 样衣退回默认去向依赖历史模板编号 | `点错风险` | 商品运营、样衣管理员 | 按样衣来源类型推导；外采退回供应商、委托打样退回版房，来源不足时明确默认库存留样 | 否 |
| 商品测款可行性判断自动进入改版任务 | `协作断裂` | 商品负责人、打样人员 | 测款项目内只保留进入测款、样衣退回；改款和重新打样由前期打样模块独立人工创建 | 否 |
| 旧改版验收强制依赖商品项目 `REVISION_TASK` 节点，并把 `TEST_CONCLUSION` 测款结论或历史花型／首版样衣节点误当成可写任务节点 | `协作断裂` | 商品负责人、版师、打样人员 | 改从独立改版任务创建入口建立验收任务，来源节点只由系统精确解析当前项目 `TEST_CONCLUSION`，忽略调用方旧节点参数且不再回退 `REVISION_TASK`；改版派生的花型和首版样衣始终只关联项目与来源任务，不绑定或写回任何项目节点 | 否 |
| 首版样衣返改来源被测款结论覆盖，专业任务演示数据又依赖已移除的项目节点 | `协作断裂` | 版师、花型人员、样衣人员 | 测款结论返改只解析 `TEST_CONCLUSION`；首版样衣返改精确校验并保留正式首版样衣任务。花型和首版样衣演示任务只关联来源项目，项目节点留空；独立首版样衣保存详情时只更新任务自身 | 否 |
| 旧决策验收仍使用历史项目编号和“淘汰”语义，一致性修复后的待补数据节点又会被演示状态重新标为已完成 | `协作断裂` | 商品负责人、样衣管理员、数据治理人员 | 验收改用当前真实项目，按“不通过／样衣退回”实际完成样衣处置和项目归档；一致性修复标记为“数据待补齐”的节点在仓储补齐演示状态时保持进行中，直到正式记录补齐 | 否 |
| 制版与首单样衣演示任务仍依赖已移除的专业项目节点，导致两个模块没有可演示数据 | `协作断裂` | 版师、样衣人员、商品负责人 | 制版与首单样衣种子改为只关联真实项目及真实来源任务，项目节点统一留空；五类专业任务均不再生成项目节点关系 | 否 |
| 独立首单样衣保存和独立制版生成技术包仍尝试写回专业项目节点 | `协作断裂` | 版师、样衣人员、技术包维护人员 | 独立首单样衣详情只保存任务本身；独立制版可生成技术包但不改写项目节点，技术包产出关系统一归属商品项目建立节点 | 否 |
| 一致性修复缺少“当前可执行”与“仍被前序阻塞”两类 hydrate 回归 | `点错风险` | 商品负责人、数据治理人员 | 新增两组正式数据缺失场景：当前可执行节点保持“数据待补齐”，被更早开放节点阻塞的后续节点保持“未开始／待前序完成”并清除旧结果 | 否 |
| 历史项目已保存 `linkedStyleId`，但档案来源项目字段缺失或错误时会重复建档 | `协作断裂` | 商品企划、商品运营、数据治理人员 | 水合时先按项目保存的款式档案 ID 查找，再按来源项目查找；修复档案来源项目编号、编码、名称但保留全部业务字段。若 seed 补回同项目旧主档，仅解除旧主档的项目来源关联；跨现存项目占用同一档案 ID 时明确拦截，仓储创建、更新和水合均保证档案 ID 唯一 | 否 |
| 历史五类专业任务和项目关系仍指向已移除的专业节点 | `协作断裂` | 版师、花型人员、样衣人员、数据治理人员 | 改版、制版、花型、首版样衣、首单样衣仓储水合时清空旧 `projectNodeId`，保留项目归属与来源业务对象；关系仓储移除五类旧专业节点关系，一致性检查不再忽略残留专业关系，初始化、固定五步、技术包合法关系保持不变 | 否 |

## 6. 最终结论

结论：通过

说明：

- 固定五步保留逐步办理，不把删除模板运行时误解为取消业务步骤。
- 现有业务表单继续由固定步骤内的业务节点承接，未扩大到工作项／模板模块删除。
- “暂保留”仍作为当前测款判断，不新增下一轮测款流程。
- 商品测款不承接商品开发或改版打样；需要改款时由前期打样模块独立人工创建任务。
- 独立改版可以读取系统精确解析的测款结论作为来源事实，但创建、花型／首版样衣下游生成、确认和完成均不得改写来源商品项目任何节点。
- 首版样衣返改必须保留其正式首版样衣来源；花型和首版样衣专业模块保留独立任务演示数据，不再依赖固定五步之外的项目节点。
- 当前决策验收必须以真实业务状态流转为准；数据一致性修复结果不得被演示种子覆盖。
- 制版、花型、首版样衣、首单样衣与改版均按独立专业任务保存；有工程主单归属时只记录真实项目标识，项目节点留空。独立改款／设计任务可以暂不关联项目，但必须关联合法款式／SPU及正式需求来源；确定做大货后再创建工程主单。
- 独立制版生成技术包只回写制版任务、技术包、商品项目与款式档案事实，不改写固定五步节点。
- 历史项目以 `linkedStyleId` 为主关联事实修复档案来源；历史专业任务只保留项目归属，不再恢复已删除的专业项目节点。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-node-factory.ts`
- `src/data/pcs-project-repository.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-project-sample-return-defaults.ts`
- `src/data/pcs-project-bootstrap.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-project-decision-flow-service.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-revision-task-repository.ts`
- `src/data/pcs-plate-making-repository.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-first-sample-repository.ts`
- `src/data/pcs-first-order-sample-repository.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-first-sample-project-writeback.ts`
- `src/data/pcs-first-order-sample-project-writeback.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-project-inline-node-record-repository.ts`
- `src/data/pcs-project-inline-node-record-types.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-engineering-tasks.ts`

### 页面路由

- `/pcs/projects`
- `/pcs/projects/create`
- `/pcs/projects/:projectId`
- `/pcs/projects/:projectId/work-items/:projectNodeId`
- `/pcs/patterns/revision`
- `/pcs/patterns/revision/:revisionTaskId`

### 验证命令

- `npm test -- tests/pcs-project-fixed-step-flow.spec.ts`：通过
- `npm test -- tests/pcs-project-historical-migration.spec.ts`：通过，真实旧档案节点精确改绑，空来源和技术包来源保持原值，三组历史档案业务字段均保留
- `npm test -- tests/pcs-project-temporary-hold.spec.ts`：通过，暂保留不创建或重启直播、短视频测款
- `npm test -- tests/pcs-project-sample-return-defaults.spec.ts`：通过，空退回去向按样衣来源事实推导且不依赖模板编号
- `npm test -- tests/pcs-project-feasibility-boundary.spec.ts`：通过，商品测款页面源码与实际可行性节点页面均不包含改版打样选项或按 `REVISION_TASK` 改写选项的条件
- `npm run check:pcs-product-testing-v1`：通过
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-project-decision-flow.ts`：通过
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-project-data-consistency.ts`：通过，共核对 26 个项目、364 个节点，未发现问题
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-revision-remodel-acceptance.ts`：通过，恶意旧节点参数不能覆盖系统解析的 `TEST_CONCLUSION`，独立改版任务创建、花型和首版样衣下游、确认、技术包前置、完成闭环及详情页验收全部实际执行，并用闭环前后全量节点快照确认来源商品项目节点未被改写
- `npm test -- tests/pcs-professional-task-bootstrap-independent.spec.ts`：通过，五类专业任务种子均不绑定项目节点且不生成项目节点关系；有项目归属的任务只关联真实项目，独立改款／设计任务只允许关联可解析的正式款式／SPU和需求来源
- `npm test -- tests/pcs-project-linked-style-archive-migration.spec.ts`：通过，真实 `localStorage` 中仅按 `linkedStyleId` 存在且来源项目字段缺失／错误的历史档案保持单一 ID，来源项目修复且备注、卖点、详情等业务字段不变；重复档案 ID 创建被明确拦截
- `npm test -- tests/pcs-professional-task-node-migration.spec.ts`：通过，真实 `localStorage` 中五类历史专业任务均保留项目和来源对象、清空旧节点绑定，五类旧节点关系全部移除，项目固定节点快照不变且无专业悬空关系一致性问题
- `npm test -- tests/pcs-{revision,plate-making,pattern-task,first-sample,first-order-sample}*.spec.ts`：通过，五类专业模块共 31 个规格文件全量回归
- `npm test -- tests/pcs-project-data-consistency-repair-order.spec.ts`：通过，当前可执行的缺数据节点保持“数据待补齐”，仍受前序阻塞的后续节点保持“未开始／待前序完成”且清空旧结果
- `npm test -- tests/pcs-plate-making-*.spec.ts tests/pcs-tech-pack-plate-primary-generation.spec.ts`：通过，独立制版任务可完成资料、档案和技术包联动且不改写项目节点
- `npm test -- tests/pcs-first-order-sample-*.spec.ts`：通过，首单样衣多状态演示、独立详情保存、来源关系和旧节点入口边界均已验证
- `npm test -- tests/pcs-first-sample-*.spec.ts`：通过，首版样衣状态、独立详情保存、Mock 场景、节点边界和首版样衣返改来源均已验证
- `npm test -- tests/pcs-project-decision-eliminate-to-sample-return.spec.ts tests/pcs-project-decision-options.spec.ts tests/pcs-project-data-consistency.spec.ts`：通过，当前决策枚举、暂保留边界、不通过后的样衣退回闭环、固定五步和专业任务仓储一致性均已真实执行
- `npm run check:prototype-design-governance -- --all`：通过

### 例外

- 无
