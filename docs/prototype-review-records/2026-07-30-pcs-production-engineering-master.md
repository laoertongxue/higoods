# PCS 商品项目固定五步流程原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-30 |
| 相关需求 / 任务 | 商品项目固定五步业务流程与生产工程专业任务收口 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/projects`、`/pcs/projects/create`、`/pcs/projects/:projectId` |
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
| 防错 | 通过 | 创建项目不允许选择或拼装模板；固定步骤、专业任务和商品项目关系均有明确边界。 |
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
| 首版样衣返改来源被测款结论覆盖，专业任务演示数据又依赖已移除的项目节点 | `协作断裂` | 版师、花型人员、样衣人员 | 测款结论返改只解析 `TEST_CONCLUSION`；首版样衣返改精确校验并保留正式首版样衣任务。花型和首版样衣演示任务只关联来源项目，项目节点留空；独立首版样衣保存详情时只更新任务自身 | 否 |
| 旧决策验收仍使用历史项目编号和“淘汰”语义，一致性修复后的待补数据节点又会被演示状态重新标为已完成 | `协作断裂` | 商品负责人、样衣管理员、数据治理人员 | 验收改用当前真实项目，按“不通过／样衣退回”实际完成样衣处置和项目归档；一致性修复标记为“数据待补齐”的节点在仓储补齐演示状态时保持进行中，直到正式记录补齐 | 否 |
| 制版与首单样衣演示任务仍依赖已移除的专业项目节点，导致两个模块没有可演示数据 | `协作断裂` | 版师、样衣人员、商品负责人 | 制版与首单样衣种子改为只关联真实项目及真实来源任务，项目节点统一留空；五类专业任务均不再生成项目节点关系 | 否 |
| 独立首单样衣保存和独立制版生成技术包仍尝试写回专业项目节点 | `协作断裂` | 版师、样衣人员、技术包维护人员 | 独立首单样衣详情只保存任务本身；独立制版可生成技术包但不改写项目节点，技术包产出关系统一归属商品项目建立节点 | 否 |
| 一致性修复缺少“当前可执行”与“仍被前序阻塞”两类 hydrate 回归 | `点错风险` | 商品负责人、数据治理人员 | 新增两组正式数据缺失场景：当前可执行节点保持“数据待补齐”，被更早开放节点阻塞的后续节点保持“未开始／待前序完成”并清除旧结果 | 否 |
| 历史项目已保存 `linkedStyleId`，但档案来源项目字段缺失或错误时会重复建档 | `协作断裂` | 商品企划、商品运营、数据治理人员 | 水合时先按项目保存的款式档案 ID 查找，再按来源项目查找；修复档案来源项目编号、编码、名称但保留全部业务字段。若 seed 补回同项目旧主档，仅解除旧主档的项目来源关联；跨现存项目占用同一档案 ID 时明确拦截，仓储创建、更新和水合均保证档案 ID 唯一 | 否 |
| 历史款式档案来源节点为空或指向任意失效节点时仍未归属当前项目建立节点 | `协作断裂` | 商品企划、商品运营、数据治理人员 | 不再只识别特定旧节点；档案只要归属当前项目，来源节点一律重绑该项目当前 `PROJECT_INIT`，并用空、旧、任意失效节点三类真实快照回归 | 否 |
| 档案水合按更新时间静默选择重复 ID，项目迁移又会边改边校验 | `协作断裂` | 商品企划、商品运营、数据治理人员 | 重复档案 ID 显式报冲突并保留原始存储；项目迁移先在内存完成全量冲突校验和迁移计划，任一项目冲突零写入，全部成功后一次性替换档案快照，重复执行不再写入 | 否 |
| 制版真实入口和首单创建入口仍要求已删除的专业项目节点 | `协作断裂` | 版师、样衣人员、商品负责人 | 制版到首版、首单创建统一使用独立专业任务路径，只保留商品项目、款式／SPU及上游制版／首版来源，项目节点留空且不生成专业节点关系；创建前后对固定项目节点做全量深比较 | 否 |

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
- 款式档案迁移必须先完成全量内存规划再一次写入；重复 ID 或多个旧主档冲突时保留原始字节并明确阻断水合。
- 制版到首版、首版到首单的真实创建入口均不得要求或改写固定五步之外的项目节点。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pcs-project-definition-normalizer.ts`（删除）
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-node-factory.ts`
- `src/data/pcs-project-phase-definitions.ts`
- `src/data/pcs-project-repository.ts`
- `src/data/pcs-project-style-archive-generation.ts`
- `src/data/pcs-template-domain-view-model.ts`（删除）
- `src/data/pcs-templates.ts`（删除）
- `src/data/pcs-work-item-configs.ts`（删除）
- `src/data/pcs-work-item-configs/core.ts`（删除）
- `src/data/pcs-work-item-configs/engineering-configs.ts`（删除）
- `src/data/pcs-work-item-configs/mappings.ts`（删除）
- `src/data/pcs-work-item-configs/market-configs.ts`（删除）
- `src/data/pcs-work-item-configs/project-configs.ts`（删除）
- `src/data/pcs-work-item-configs/sample-configs.ts`（删除）
- `src/data/pcs-work-item-configs/types.ts`（删除）
- `src/data/pcs-work-item-runtime-carrier.ts`（删除）
- `src/data/pcs-work-items.ts`（删除）
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-project-sample-return-defaults.ts`
- `src/data/pcs-project-bootstrap.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/pages/pcs-channel-products.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-project-closure-view-model.ts`
- `src/data/pcs-project-image-types.ts`
- `src/data/pcs-project-technical-data-writeback.ts`
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
- `src/data/pcs-task-source-normalizer.ts`
- `src/data/pcs-first-sample-project-writeback.ts`
- `src/data/pcs-first-order-sample-project-writeback.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-project-inline-node-record-repository.ts`
- `src/data/pcs-project-inline-node-record-types.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-projects-list.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-templates.ts`（删除）
- `src/pages/pcs-work-items.ts`（删除）
- `src/main.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`
- `tests/pcs-engineering-task-standard-list.spec.ts`
- `tests/pcs-projects-standard-list.spec.ts`
- `src/data/pcs-engineering-task-field-policy.ts`
- `src/data/pcs-first-order-sample-types.ts`
- `src/data/pcs-first-sample-types.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-plate-making-types.ts`
- `src/data/pcs-project-archive-bootstrap.ts`
- `src/data/pcs-project-archive-collector.ts`
- `src/data/pcs-project-archive-repository.ts`
- `src/data/pcs-project-archive-sync.ts`
- `src/data/pcs-project-archive-types.ts`
- `src/data/pcs-project-decision-migration.ts`
- `src/data/pcs-project-demo-seed-service.ts`
- `src/data/pcs-project-flow-service.ts`
- `src/data/pcs-project-image-view-model.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-list-store.ts`
- `src/data/pcs-project-node-factory.ts`
- `src/data/pcs-project-node-instance-registry.ts`
- `src/data/pcs-project-relation-bootstrap.ts`
- `src/data/pcs-project-relation-types.ts`
- `src/data/pcs-project-types.ts`
- `src/data/pcs-revision-task-types.ts`
- `src/data/pcs-sample-management.ts`
- `src/data/pcs-style-archive-image-selection.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/data/pcs-testing-relation-normalizer.ts`
- `src/pages/pcs-live-testing.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-video-testing.ts`

### 页面路由

- `/pcs/projects`
- `/pcs/projects/create`
- `/pcs/projects/:projectId`
- `/pcs/patterns/revision`
- `/pcs/patterns/revision/:revisionTaskId`
- `/pcs/patterns/plate-making`
- `/pcs/patterns/colors`
- `/pcs/samples/first-sample`
- `/pcs/samples/first-order`

### 验证命令

- `npm test -- tests/pcs-project-fixed-step-flow.spec.ts`：通过
- `npm test -- tests/pcs-project-temporary-hold.spec.ts`：通过，暂保留不创建或重启直播、短视频测款
- `npm test -- tests/pcs-project-sample-return-defaults.spec.ts`：通过，空退回去向按样衣来源事实推导且不依赖模板编号
- `npm test -- tests/pcs-project-feasibility-boundary.spec.ts`：通过，商品测款页面源码与实际可行性节点页面均不包含改版打样选项或按 `REVISION_TASK` 改写选项的条件
- `npm run check:pcs-product-testing-v1`：通过
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-project-decision-flow.ts`：通过
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-project-data-consistency.ts`：通过，共核对 26 个项目、364 个节点，未发现问题
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-revision-remodel-acceptance.ts`：通过，恶意旧节点参数不能覆盖系统解析的 `TEST_CONCLUSION`，独立改版任务创建、花型和首版样衣下游、确认、技术包前置、完成闭环及详情页验收全部实际执行，并用闭环前后全量节点快照确认来源商品项目节点未被改写
- `npm test -- tests/pcs-professional-task-bootstrap-independent.spec.ts`：通过，五类专业任务种子均不绑定项目节点且不生成项目节点关系；有项目归属的任务只关联真实项目，独立改款／设计任务只允许关联可解析的正式款式／SPU和需求来源
- `npm test -- tests/pcs-project-linked-style-archive-migration.spec.ts`：通过，真实 `localStorage` 中仅按 `linkedStyleId` 存在且来源项目字段缺失／错误的历史档案保持单一 ID，来源项目修复且备注、卖点、详情等业务字段不变；重复档案 ID 创建被明确拦截
- `npm test -- tests/pcs-style-archive-transactional-migration.spec.ts`：通过，重复档案 ID 显式阻断且原始字节不变；多旧主档冲突零写入；款式仓写入失败时项目／款式原始字节与内存快照均不变；款式写入成功而项目写入失败时两仓完整回滚且重读仍为原始数据；成功迁移两仓各写一次并保持幂等
- `npm run check:pcs-plate-sample-readiness`：通过，制版完成后可直接创建独立首版样衣任务，保留制版和技术包来源，项目节点创建前后全量不变
- `npm test -- tests/pcs-first-order-sample-independent-entry.spec.ts`：通过，首单真实入口保留商品项目和正式首版样衣来源，不生成专业节点关系且不改写项目固定节点
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-first-order-sample-node-writeback.ts`：通过，首单独立入口与详情保存均保持项目节点隔离
- `npm test -- tests/pcs-{revision,plate-making,pattern-task,first-sample,first-order-sample}*.spec.ts`：通过，五类专业模块共 32 个规格文件全量回归
- `npm test -- tests/pcs-project-data-consistency-repair-order.spec.ts`：通过，当前可执行的缺数据节点保持“数据待补齐”，仍受前序阻塞的后续节点保持“未开始／待前序完成”且清空旧结果
- `npm test -- tests/pcs-plate-making-*.spec.ts tests/pcs-tech-pack-plate-primary-generation.spec.ts`：通过，独立制版任务可完成资料、档案和技术包联动且不改写项目节点
- `npm test -- tests/pcs-first-order-sample-*.spec.ts`：通过，首单样衣多状态演示、独立详情保存、来源关系和旧节点入口边界均已验证
- `npm test -- tests/pcs-first-sample-*.spec.ts`：通过，首版样衣状态、独立详情保存、Mock 场景、节点边界和首版样衣返改来源均已验证
- `npm test -- tests/pcs-project-decision-eliminate-to-sample-return.spec.ts tests/pcs-project-decision-options.spec.ts tests/pcs-project-data-consistency.spec.ts`：通过，当前决策枚举、暂保留边界、不通过后的样衣退回闭环、固定五步和专业任务仓储一致性均已真实执行
- `npm run check:prototype-design-governance -- --all`：通过
- `npm test -- tests/pcs-engineering-task-standard-list.spec.ts`：通过，五类专业任务列表均使用标准列表页、标准宽表和标准分页，改版专用五状态筛选未混入其他专业状态
- `npm test -- tests/pcs-projects-standard-list.spec.ts`：通过，真实 `/pcs/projects` 路由渲染器与事件处理器共同使用 `pcs-projects-list.ts` 的标准列表实现；覆盖标准骨架、列设置、排序、分页、显示／冻结／拖拽、右侧固定操作和局部刷新，详情固定五步、创建页与工作项页面保持原业务入口，`pcs-projects.ts` 不再保留第二套列表实现
- `npm run check:list-page-governance`：通过，列表页静态治理、标准列表页 Chromium 拖拽检查和原型设计治理均已闭环
- `npm run build`：通过
- Task1 PCS 最终相关规格回归：39 个规格文件全部通过
- 五类专业任务列表已按 48px 单行统计、表格容器内横向滚动、右侧固定操作栏设计；筛选、排序、分页、列显示、列冻结、列顺序和每页条数均采用局部更新，不触发整页重绘
- 商品项目列表采用表格容器内横向滚动和右侧固定操作栏；筛选、排序、分页、列显示、列冻结、列顺序和每页条数均采用局部更新，不触发整页重绘
- Playwright 浏览器验收：改版、制版、花型、首版样衣和首单样衣五条真实路由均可达；改版列表在 1366×768 可局部打开／关闭列设置并切换任务编号排序，在 1280×720 仍保持标准表格、右侧固定操作和分页可用，首单样衣列表正常渲染，控制台无业务报错
- Playwright 商品项目真实路由验收：`/pcs/projects` 在 1366×768 下可打开／关闭列设置、切换项目名称排序并进入第 2／4 页；在 1280×720 下仍保持标准宽表、右侧固定操作和分页可用；控制台 0 error、0 warning。截图：`output/playwright/pcs-projects-1366x768-page2.png`、`output/playwright/pcs-projects-1280x720.png`
- 列显示、顺序、冻结和每页条数按五条列表路由分别保存；当前页和排序仅保留在当前进入期间，重新进入列表恢复默认

### 例外

- 无

## 8. 商品项目工作项与模板模块删除补充审查

### 本次范围

- 删除“工作项库”“项目模板管理”菜单、路由、页面渲染器和事件处理入口。
- 删除工作项、项目模板、工作项配置、运行载体及模板视图模型代码。
- 商品项目统一使用“项目与档案建立 → 样衣准备 → 测款前准备 → 市场测款 → 测款判断与收尾”固定五步。
- 固定五步继续承载样衣获取、到样核对、拍摄试穿、样衣确认、核价、定价、商品上架、直播测款、短视频测款、测款判断和样衣退回等逐项任务。
- 商品／款式档案在创建商品项目时同步建立；正式建档直接基于项目关联档案，不再依赖“完善商品档案”工作项。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。删除的是可配置工作项／模板功能，不删除固定五步及其逐项办理任务。 |
| 页面与菜单 | 通过。已删除两类入口，不保留兼容路由、重定向入口或隐藏菜单。 |
| 中文业务口径 | 通过。页面继续使用步骤、任务、项目与档案等业务名称，不展示模板运行时概念。 |
| 状态与防错 | 通过。固定步骤顺序、前序门禁、测款判断和样衣退回闭环保持不变。 |
| 列表与分页 | 通过。本次删除列表页，没有新增不分页的数据列表；保留页面继续执行标准列表页治理。 |
| 交互性能 | 通过。本次未新增整页重绘或高频输入交互。 |
| Mock 数据 | 通过。删除仅服务旧模板／工作项页面的 Mock 和验收，保留固定步骤所需项目、档案和任务数据。 |

### 补充验证

- `npx tsx tests/pcs-work-item-module-removal.spec.ts`：通过，删除文件、入口、禁止引用、固定五步和详细任务同时闭环。
- `npx tsx tests/pcs-project-fixed-step-flow.spec.ts`：通过。
- `npm run check:pcs-product-testing-v1`：通过。
- `npx tsx scripts/check-pcs-channel-listing-style-specs.ts`：通过。
- `npx tsx scripts/check-pcs-page-slimming.ts`：通过。
- 受模板模块删除影响并保留的 10 个项目、档案、图片和实例规格：全部通过。
- 删除 `pcs-sample-chain-work-item-contract.spec.ts`：该测试只断言一个在起始版本固定任务契约及旧配置中均不存在的 `PRE_PRODUCTION_SAMPLE` 工作项编码，不能作为恢复可配置工作项体系的依据。产前样衣的复用、双样、工厂参照等业务规格测试继续保留，不纳入本次模块删除。
- `pcs-plate-making-work-item-contract.spec.ts`、`pcs-pattern-task-work-item-contract-sync.spec.ts`：通过，制版任务和花型任务的真实固定任务契约仍完整保留。
- `npm run check:menu-routes`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。

### 本轮追加受管文件

- `src/data/pcs-project-phase-definitions.ts`
- `src/data/pcs-task-source-normalizer.ts`

### 补充审查结论

- 通过。
- 无业务例外。

## 16. 专业任务项目级关系模型收口

### 本次范围

- 改版、制版、花型、首版样衣和首单样衣五类专业任务只保存商品项目归属、真实来源对象和下游回写事实。
- 五类专业任务模型及仓储不保存商品项目节点、项目步骤编码、项目步骤名称或兼容引用字段。
- 商品项目详情按项目级正式业务对象读取专业任务，不提供按商品项目节点查询专业任务关系的接口。
- 直播测款和短视频测款页面保留内部数据编码，但所有用户可见内容统一显示为“带货”“测款”“复测”和“测款明细／测款条目”。
- 现行专业任务来源只接受当前业务来源，不包含任务迁移或兼容处理入口。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。商品项目固定步骤与工程专业任务分离；专业任务只在项目级关联。 |
| 来源可追溯 | 通过。每张专业任务保留真实商品项目、款式／SPU及上游业务对象。 |
| 信息结构 | 通过。页面继续按固定五步办理测款业务，工程专业任务由独立模块承接。 |
| 中文化 | 通过。直播与短视频测款页面不展示内部英文用途编码。 |
| 交互性能 | 通过。本次只调整事实读取与显示文案，未新增整页重绘或高频输入。 |
| 列表与分页 | 通过。既有标准列表页、分页、列设置和右侧固定操作保持不变。 |
| 例外 | 无。 |

### 本轮追加受管文件

- `src/data/pcs-first-order-sample-repository.ts`
- `src/data/pcs-first-order-sample-types.ts`
- `src/data/pcs-first-sample-repository.ts`
- `src/data/pcs-first-sample-types.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-plate-making-repository.ts`
- `src/data/pcs-plate-making-types.ts`
- `src/data/pcs-project-archive-collector.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-revision-task-repository.ts`
- `src/data/pcs-revision-task-types.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-task-source-normalizer.ts`
- `src/pages/pcs-live-testing.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-video-testing.ts`
- `tests/pcs-professional-task-bootstrap-independent.spec.ts`
- `tests/pcs-professional-task-fixed-step-source.spec.ts`
- `tests/pcs-professional-task-model-semantic-closure.spec.ts`
- `tests/pcs-professional-task-project-binding.spec.ts`
- `tests/pcs-remove-sample-retain-review-project-instances.spec.ts`

### 补充审查结论

- 通过。
- 无业务例外。

## 15. 测款详情真实路由与专业任务当前数据收口

### 本次范围

- 直播测款、短视频测款动态详情路由直接调用各自详情渲染器，详情页头、页签和当前测款记录均可通过真实路由访问。
- 专业任务初始化数据只保留当前商品项目与当前任务演示，并使用真实商品项目或真实上游任务作为来源。
- 首版样衣仓储只按当前状态字典归一化任务状态。
- 工程任务验收统一使用“技术包与下游”“技术包写入”和当前版次等现行业务口径。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 角色匹配 | 通过。页面仍为 PCS 管理端，服务买手、跟单和工程协作人员。 |
| 信息架构与导航 | 通过。列表详情入口与动态详情路由一致，不再把用户送回列表占位页。 |
| 页面模式 | 通过。详情保留页头和必要页签，未新增说明性文案或重复入口。 |
| 文案 | 通过。详情与测试口径统一为当前业务对象和动作。 |
| 协作关系 | 通过。专业任务只表达当前商品项目及真实专业任务关系。 |
| 交互性能 | 通过。仅修正路由渲染目标，未新增整页交互或高频输入。 |
| 列表与分页 | 通过。本轮未调整列表结构，既有标准列表、分页和列设置保持不变。 |

### 受管文件

- `src/router/routes-pcs.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-first-sample-repository.ts`

### 页面路由

- `/pcs/testing/live/:liveSessionId`
- `/pcs/testing/video/:videoRecordId`

### 验证命令

- `npm test -- tests/pcs-task2-final-detail-and-semantic-closure.spec.ts`
- `npm test -- tests/pcs-engineering-tasks.spec.ts`
- `npm test -- tests/pcs-work-item-module-removal.spec.ts`
- `npm test -- tests/pcs-task2-dead-project-node-compatibility.spec.ts`
- `npm test -- tests/pcs-first-sample-acceptance-status.spec.ts`
- `npm run check:list-page-governance`
- `npm run check:prototype-design-governance`
- `npm run build`

### 例外

- 无。

## 12. 测款详情与项目步骤语义最终收口

### 本次范围

- 直播测款、短视频测款详情路由直接渲染详情页头、详情页签和当前记录，不再回退到列表页。
- 两类测款详情统一使用“项目步骤字段”，读取商品项目与测款步骤事实，不再读取或展示已删除的工作项语义。
- 样衣管理统一展示“商品项目 / 来源步骤”；样衣、申请和台账的数据字段统一为来源步骤。
- 花型任务标准列表增加不可隐藏的“商品项目”列，可搜索既有项目关系并进入项目详情。
- 删除五类专业任务仓储中零调用的项目节点兼容查询；固定专业任务继续以商品项目或真实上游任务作为来源。
- 商品档案后续动作统一为“商品档案资料完善”，明确档案已经在商品项目创建时同步建立。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。商品项目保留固定步骤；专业任务保留独立执行对象，不恢复已删除的工作项和专业项目节点。 |
| 信息结构 | 通过。测款详情、样衣来源和花型项目归属均使用业务人员可直接识别的对象名称。 |
| 来源可追溯 | 通过。样衣记录保留商品项目与来源步骤；花型任务保留商品项目入口；专业任务来源使用真实项目或上游任务。 |
| 列表治理 | 通过。花型任务继续使用标准列表页，商品项目列为必需列，操作列固定在右侧，分页和列偏好不变。 |
| 防错 | 通过。详情路由必须命中真实记录；商品项目列不可隐藏；不存在项目节点查询兼容入口。 |
| 交互性能 | 通过。详情路由直接渲染目标页面；本次未增加整页高频刷新或输入触发整页重绘。 |
| 中文化 | 通过。页面统一使用“项目步骤字段”“商品项目”“来源步骤”“商品档案资料完善”。 |
| Mock 数据 | 通过。既有测款、样衣、花型和商品项目关系足以覆盖列表、详情和来源展示。 |

### 补充验证

- `npm test -- tests/pcs-task2-final-detail-and-semantic-closure.spec.ts`：通过。
- `npm test -- tests/pcs-channel-products-standard-list-route.spec.ts`：通过，统一 `tsx` 测试入口可正确加载路由依赖。
- `npm test -- tests/pcs-live-testing.spec.ts`：通过。
- `npm test -- tests/pcs-video-testing.spec.ts`：通过。
- `npm test -- tests/pcs-page-slimming-channel-testing.spec.ts`：通过。
- `npm test -- tests/pcs-professional-task-bootstrap-independent.spec.ts`：通过。
- `npm test -- tests/pcs-professional-task-fixed-step-source.spec.ts`：通过。
- `npm test -- tests/pcs-work-item-module-removal.spec.ts`：通过。
- `npm test -- tests/pcs-task2-dead-project-node-compatibility.spec.ts`：通过。
- `npm test -- tests/pcs-first-sample-acceptance-status.spec.ts`：通过。
- `npm test -- tests/pcs-engineering-task-standard-list.spec.ts`：通过。
- `npm run build`：通过。

### 本轮受管文件

- `src/pages/pcs-live-testing.ts`
- `src/pages/pcs-video-testing.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-projects.ts`
- `src/data/pcs-sample-management.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-closure-view-model.ts`
- `src/data/pcs-project-image-types.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-revision-task-repository.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-plate-making-repository.ts`
- `src/data/pcs-first-sample-repository.ts`
- `src/data/pcs-first-order-sample-repository.ts`

### 补充审查结论

- 通过。
- 无业务例外。

## 13. 直播与短视频测款标准列表补充审查

### 本次范围

- 直播测款和短视频测款列表迁移到统一列表骨架、统一表格和统一分页。
- 保留两页既有测款数据、搜索、新增、详情、项目跳转及事件入口。
- 增加三态排序、列显示、拖拽排序、冻结列、右侧固定操作列和按路由保存的列偏好。
- 搜索、翻页、列设置只更新筛选区、表格、分页或列设置区域；图标只扫描新插入区域。
- 删除无界面入口的旧筛选状态、旧统计卡片、旧页码和不可达事件分支。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 标准列表页 | 通过。页面声明列表模式并复用统一列表、表格和分页组件。 |
| 列表交互 | 通过。分页、三态排序、列显隐、拖序、冻结和右侧固定操作列均保留可操作入口。 |
| 偏好保存 | 通过。按直播、短视频测款路由分别保存列偏好与每页条数；当前页和排序不保存。 |
| 交互性能 | 通过。列表轻交互局部更新，并只对更新区域补充图标。 |
| 业务连续性 | 通过。两页测款数据、搜索、详情、路由、项目跳转和处理器入口未改变。 |
| 中文化 | 通过。页面状态和业务文案均使用中文展示。 |

### 验证

- `npm test -- tests/pcs-live-testing.spec.ts`：通过。
- `npm test -- tests/pcs-video-testing.spec.ts`：通过。
- `npm run check:list-page-governance`：实现与两阶段审查中通过；最终组合复跑在无关的补料管理 Chromium 基准冷启动超过 30 秒时超时，未修改该无关页面。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。

### 补充审查结论

- 通过。
- 无业务例外。
- 直播测款和短视频测款均已分别完成规格审查与代码质量审查；两页均无 P1/P2 遗留。

## 14. 专业任务项目级关系与项目入口收口

### 本次范围

- 五类专业任务统一通过商品项目级关系承接来源与完成状态，不再依赖已删除的专业项目节点。
- 改版任务可按范围创建制版、花型、首版样衣和首单样衣下游；首单样衣不再要求商品项目存在同名步骤。
- 商品项目详情删除“从项目节点创建专业任务”的弹窗、表单和事件，仅保留进入工程任务模块的项目级入口。
- 专业任务原始演示数据不再保存专业项目步骤编码和步骤名称；直播与短视频测款统一显示“测款状态”。
- 款式档案图片检查以关联款式档案的主图、图集和图片来源为唯一事实，不再校验项目主记录兼容字段。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。专业任务属于工程模块，商品项目只提供项目级入口和关系，不恢复项目工作项。 |
| 信息结构 | 通过。项目详情不再出现专业节点创建表单；专业任务详情保留来源项目、下游任务和完成关系。 |
| 防错 | 通过。四类下游创建均写入真实项目关系；首单样衣不依赖已删除节点。 |
| 交互性能 | 通过。删除整套项目内创建弹窗与字段事件，没有新增整页重绘。 |
| 列表与分页 | 通过。本次未新增或调整数据列表结构。 |
| 中文化 | 通过。直播、短视频和工程页删除“工作项状态”“同步项目节点”等旧语义。 |

### 补充验证

- `npm test -- tests/pcs-professional-task-project-binding.spec.ts`：通过。
- `npm test -- tests/pcs-task2-dead-project-node-compatibility.spec.ts`：通过。
- `npm test -- scripts/check-pcs-revision-remodel-acceptance.ts`：通过。
- `npm test -- scripts/check-pcs-style-archive-images.ts`：通过。
- `npm test -- tests/pcs-style-archive-linked-image-priority.spec.ts`：通过。
- `npm test -- tests/pcs-style-archive-linked-image-writeback.spec.ts`：通过。
- `npm run build`：通过。

### 补充审查结论

- 通过。
- 无业务例外。

## 12. 专业任务项目级关系与测款显式映射补充审查

### 本次范围

- 改版、制版、花型、首版样衣、首单样衣均作为独立专业任务运行；关联工程主单时只保存商品项目关系，不再创建、读取或回写专业项目节点。
- 专业任务创建时立即形成商品项目关系；任务完成时统一回写项目关系完成状态。
- 项目资料归档中的专业任务、技术包、花型资产与人工资料均按项目级成果归档，不使用专业步骤或立项步骤兜底。
- 测款数据汇总与测款结论只统计已经明确映射到当前商品项目的渠道商品；没有有效映射时禁止提交。
- 上架规格使用旧式图片链接创建时，先转为正式项目图片资产并绑定规格图片，再执行创建与上传门禁。
- 同步修正专业任务、制版分页、上架图片和测款结论相关的失效检查口径。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。专业任务是独立执行对象，工程主单只作为项目归属和成果汇总对象。 |
| 来源可追溯 | 通过。所有专业任务关系均保留商品项目、真实任务编号及真实上游对象，不保存专业项目节点。 |
| 状态一致性 | 通过。创建即形成项目关系，完成统一回写关系完成状态。 |
| 测款防错 | 通过。汇总和结论只使用明确映射到当前项目的渠道商品，没有有效映射时禁止提交。 |
| 档案归档 | 通过。专业成果、技术资料和人工资料均按商品项目归档，不使用步骤兜底。 |
| 图片防错 | 通过。上架规格必须绑定正式图片资产；旧式链接先正式化后再通过门禁。 |
| 列表与分页 | 通过。制版任务继续使用标准列表组件、标准分页和局部翻页。 |
| 交互性能 | 通过。本次没有新增整页重绘；标准列表分页沿用局部刷新。 |
| 中文化 | 通过。页面和操作反馈继续使用中文业务表达。 |

### 参考规范

- 《HiGood 印尼工厂现场协同系统产品设计规范》：业务角色、协作边界、事实来源、状态与防错。
- 《HiGood 印尼工厂现场协同系统原型审查清单》：页面结构、关键动作、中文化、列表分页和交互响应。
- 标准列表页治理：制版任务列表继续复用标准列表页、标准宽表及分页组件。

### 补充审查结论

- 通过。
- 无业务例外。

## 8.1 项目级归档、唯一商品测款档案与渠道显式映射收口审查

### 本次范围

- 专业任务、技术包版本、花型资产和项目资料归档统一作为项目级成果归档，不再用已删除的专业步骤或 `PROJECT_INIT` 兜底。
- `PROJECT_INIT` 仅承接真实商品项目立项，并完整覆盖项目创建草稿；创建项目时同步建立唯一商品测款档案。
- 项目级专业任务来源改为真实商品项目或真实上游任务，不再保存项目步骤、`WI-*` 工作项编码或旧工作项引用。
- 测款汇总只接受渠道店铺商品上已经保存的直播明细或短视频记录显式映射；不按同渠道、同店铺或首条记录猜测归属。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。专业任务保持独立执行对象，项目档案只汇总其项目级成果。 |
| 档案唯一性 | 通过。商品项目创建即建立唯一商品测款档案，测款通过不再重复建档。 |
| 来源可追溯 | 通过。专业任务使用真实商品项目或真实上游任务，不保留工作项兼容来源。 |
| 渠道防串 | 通过。直播与短视频事实必须显式绑定渠道店铺商品；多店铺场景不会按渠道或首条记录串数据。 |
| 信息结构 | 通过。本次未增加页面说明文案，仅修正项目步骤、归档和汇总事实。 |
| 列表与分页 | 不适用。本次未新增或调整数据列表。 |
| 中文化 | 通过。业务状态和档案口径均使用中文表达。 |

### 补充验证

- `tests/pcs-project-init-contract.spec.ts`：通过。
- `tests/pcs-project-domain-unique-style-archive-fact.spec.ts`：通过。
- `tests/pcs-project-archive-pattern-task-files.spec.ts`：通过。
- `tests/pcs-tech-pack-plate-primary-generation.spec.ts`：通过。
- `tests/pcs-professional-task-bootstrap-independent.spec.ts`：通过。
- `tests/pcs-project-relation-bootstrap-project-level.spec.ts`：通过。
- `tests/pcs-task2-dead-project-node-compatibility.spec.ts`：通过。
- `tests/pcs-test-data-summary-structure.spec.ts`：通过。

### 补充审查结论

- 通过。
- 无业务例外。

## 12. 最终对抗审查整改补充记录

### 整改范围

- 制版与花型任务关联商品项目时，只关联真实商品项目和“商品项目”来源，不再查找、更新或保存已删除的专业项目节点。
- 从改版任务派生制版下游任务时同样只保留商品项目归属与改版来源，不再以已删除的制版项目节点作为创建门禁。
- 制版、花型任务与商品项目之间保存合法的项目级关系：关系实体必须存在，但项目节点和步骤编码均为空，不伪造任何测款固定步骤。
- 页面创建专业任务时，来源对象直接记录为商品项目及真实项目编号，不再把商品项目伪装成某个具体项目步骤。
- 改版与花型任务写入技术包时只校验真实商品项目和款式档案，不再以已删除的专业任务节点作为门禁或技术包来源节点。
- “关联商品项目”创建方式强制来源为“商品项目”；“独立任务”创建方式强制来源为“人工创建”。页面选择、事件处理和提交参数三处采用同一门禁。
- 项目模式来源对象使用真实 `projectId`、`projectCode`；不读取已删除的项目模板字段。
- 渠道商品历史演示种子通过显式项目编码映射迁移，不再按项目数组位置兜底。渠道商品 ID、编号、标题及正式 SPU 均由映射后的真实项目生成。
- “已生效”摘要同时统计“已生效待更新”和“已生效已更新”。
- 公开页面与任务数据清除“项目工作项”“工作项状态”旧语义。

### 自查结论

| 核查项 | 结论 |
|---|---|
| 业务事实源 | 通过。专业任务只保存真实项目归属；渠道商品标题、项目、SPU 和编号保持同一事实源。 |
| 来源门禁 | 通过。项目任务与独立任务不能再生成来源类型、来源对象互相矛盾的记录。 |
| 交互响应 | 通过。渠道列表排序、分页和筛选仍由局部区域更新承载。 |
| 中文化 | 通过。公开语义统一为“商品项目”“项目步骤”“任务状态”。 |
| 下游任务 | 通过。改版任务可按业务范围派生制版任务，缺少已删除的专业项目节点不会阻断。 |
| 关系持久化 | 通过。普通制版、花型及改版下游制版均持久化真实项目关系，不恢复专业节点或专业步骤编码。 |
| 例外 | 无。 |

## 9. 固定步骤来源语义与历史字段收口补充审查

### 本次范围

- 制版任务、花型任务由商品商品项目产生时，来源统一显示并保存为“商品项目”，来源模块为“商品项目”，来源对象为“项目步骤”。
- 页面和演示数据不再使用项目模板、模板阶段或工作项节点表达；独立改款、设计、制版、花型任务仍可按既有独立来源创建。
- 商品项目仓储改为业务字段白名单，旧模板字段、旧工作项字段、页面运行时字段及其他未知历史字段只在读取时被丢弃，不再进入运行时对象或重新写入本地存储。
- 商品项目阶段只保留固定五步契约；删除冲突的旧阶段契约和公开历史步骤映射。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。固定步骤仅表达项目内逐步办理，专业任务保持独立业务对象。 |
| 来源可追溯 | 通过。专业任务保存商品项目、项目步骤及项目编码，不保存已删除的模板和工作项节点语义。 |
| 历史数据防扩散 | 通过。仓储白名单保留项目业务字段，未知历史字段不会被透明传播或二次持久化。 |
| 阶段一致性 | 通过。项目阶段定义、节点工厂和页面统一读取同一套固定五步。 |
| 中文化 | 通过。页面只展示“商品项目”“项目步骤”等当前业务语言。 |
| 列表与分页 | 通过。本轮未新增或调整列表结构，既有标准列表页分页和固定操作列保持不变。 |

### 补充验证

- `node --import tsx tests/pcs-professional-task-fixed-step-source.spec.ts`：通过。
- `node --import tsx tests/pcs-work-item-module-removal.spec.ts`：通过。
- `node --import tsx tests/pcs-project-fixed-step-flow.spec.ts`：通过。
- `npm run build`：通过。

### 补充审查结论

- 通过。
- 无业务例外。

## 10. 渠道店铺商品标准列表页补充审查

### 本次范围

- 渠道店铺商品列表迁移到标准列表页组件，保留渠道、店铺、SPU 聚合口径和原详情路由。
- 增加关键词、渠道、业务状态筛选，以及分页、三态排序、列显示、列顺序、冻结列和右侧固定操作列。
- 列偏好与每页条数按路由保存；页码和排序不保存，重新进入列表恢复默认状态。
- 搜索、筛选、排序、分页和列设置均局部刷新，不触发整页重绘。
- 渠道商品详情中的来源字段统一显示为“来源项目步骤”。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 信息结构 | 通过。列表保留商品、渠道店铺、规格库存、价格、状态、链路和更新时间等必要事实。 |
| 列表治理 | 通过。使用标准列表页、标准表格、标准分页和列设置组件。 |
| 防错 | 通过。SPU、业务状态与操作列为必需列，操作列固定在右侧。 |
| 交互性能 | 通过。输入、筛选、排序、分页和列设置仅更新列表相关区域。 |
| 中文化 | 通过。列名、状态、筛选和空态均使用中文业务文案。 |
| 业务边界 | 通过。仅调整列表展示与交互，不改变渠道商品仓储和详情业务。 |

### 补充验证

- `npx tsx tests/pcs-channel-products-standard-list-route.spec.ts`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。

### 补充审查结论

- 通过。
- 无业务例外。

## 11. 固定步骤运行时与关联档案图片补充审查

### 本次范围

- 商品项目运行时只保留固定阶段与固定步骤；项目、步骤实例和页面不再保存或展示项目模板、工作项类型及其版本。
- 项目运行时记录统一使用当前步骤编码与步骤名称。
- 删除项目内“完善商品档案”节点、操作区、事件和生成接口；项目创建时已关联的商品／款式档案继续作为唯一档案事实。
- 保留项目关联档案的图片正式化：主图按“渠道上架图 → 样衣拍摄图 → 项目参考图”选择，主图同时进入图集；明确选择参考图时回写图片状态、用途、图集及来源。

### 规范自查

| 检查项 | 结论 |
| --- | --- |
| 业务边界 | 通过。删除可配置工作项运行时和重复建档动作，不删除固定步骤中的逐步办理。 |
| 信息结构 | 通过。页面统一使用“阶段与步骤”“步骤字段”等必要中文业务表达。 |
| 档案唯一性 | 通过。只更新项目创建时已关联的档案，不提供绕过项目另建档案的入口。 |
| 图片防错 | 通过。自动主图遵循固定来源优先级，明确人工选择优先；主图与图集、状态和用途同步写回。 |
| 交互性能 | 通过。删除旧图片工作台及整套生成交互，没有新增整页重绘或高频输入。 |
| 列表与分页 | 通过。本次没有新增列表；既有商品项目列表继续复用标准列表页实现。 |
| 中文化 | 通过。项目运行时不展示英文状态码、模板或工作项配置概念。 |

### 补充验证

- `npx tsx tests/pcs-work-item-module-removal.spec.ts`：通过。
- `npx tsx tests/pcs-project-fixed-step-flow.spec.ts`：通过。
- `npx tsx tests/pcs-projects.spec.ts`：通过。
- `npx tsx tests/pcs-project-archive-style-images.spec.ts`：通过。
- `npx tsx tests/pcs-project-linked-style-archive-migration.spec.ts`：通过。
- `npx tsx tests/pcs-style-archive-linked-image-priority.spec.ts`：通过。
- `npx tsx tests/pcs-style-archive-linked-image-writeback.spec.ts`：通过。
- `npm run check:pcs-product-testing-v1`：通过。
- `npm run check:pcs-closure-unification`：通过。

### 本轮追加受管文件

- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-engineering-task-field-policy.ts`
- `src/data/pcs-first-order-sample-project-writeback.ts`
- `src/data/pcs-first-order-sample-types.ts`
- `src/data/pcs-first-sample-project-writeback.ts`
- `src/data/pcs-first-sample-types.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-plate-making-types.ts`
- `src/data/pcs-project-archive-bootstrap.ts`
- `src/data/pcs-project-archive-collector.ts`
- `src/data/pcs-project-archive-repository.ts`
- `src/data/pcs-project-archive-sync.ts`
- `src/data/pcs-project-archive-types.ts`
- `src/data/pcs-project-bootstrap.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-project-decision-flow-service.ts`
- `src/data/pcs-project-decision-migration.ts`
- `src/data/pcs-project-demo-seed-service.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-flow-service.ts`
- `src/data/pcs-project-image-view-model.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-inline-node-record-repository.ts`
- `src/data/pcs-project-inline-node-record-types.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-list-store.ts`
- `src/data/pcs-project-node-factory.ts`
- `src/data/pcs-project-node-instance-registry.ts`
- `src/data/pcs-project-relation-bootstrap.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-project-relation-types.ts`
- `src/data/pcs-project-repository.ts`
- `src/data/pcs-project-style-archive-generation.ts`
- `src/data/pcs-project-types.ts`
- `src/data/pcs-revision-task-types.ts`
- `src/data/pcs-sample-management.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-style-archive-image-selection.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/data/pcs-testing-relation-normalizer.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-live-testing.ts`
- `src/pages/pcs-projects-list.ts`
- `src/pages/pcs-projects.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-video-testing.ts`

### 补充审查结论

- 通过。
- 无业务例外。
