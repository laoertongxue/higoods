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
- 历史项目以 `linkedStyleId` 为主关联事实修复档案来源；历史专业任务只保留项目归属，不再恢复已删除的专业项目节点。
- 款式档案迁移必须先完成全量内存规划再一次写入；重复 ID 或多个旧主档冲突时保留原始字节并明确阻断水合。
- 制版到首版、首版到首单的真实创建入口均不得要求或改写固定五步之外的项目节点。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pcs-project-definition-normalizer.ts`（删除）
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-node-factory.ts`
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

### 页面路由

- `/pcs/projects`
- `/pcs/projects/create`
- `/pcs/projects/:projectId`
- `/pcs/projects/:projectId/work-items/:projectNodeId`
- `/pcs/patterns/revision`
- `/pcs/patterns/revision/:revisionTaskId`
- `/pcs/patterns/plate-making`
- `/pcs/patterns/colors`
- `/pcs/samples/first-sample`
- `/pcs/samples/first-order`

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
- 商品／款式档案在创建商品项目时同步建立；正式建档直接基于项目关联档案，不再依赖“生成款式档案”工作项。

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

### 补充审查结论

- 通过。
- 无业务例外。
