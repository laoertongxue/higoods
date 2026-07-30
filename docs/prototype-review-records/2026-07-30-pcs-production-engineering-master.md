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
| 旧改版验收强制依赖商品项目 `REVISION_TASK` 节点 | `协作断裂` | 商品负责人、版师、打样人员 | 改从独立改版任务创建入口建立验收任务，状态按任务仓库核对；委托打样按样衣来源事实推导首版样衣，改版列表独立使用五状态筛选，不改变制版、花型等并列模块 | 否 |

## 6. 最终结论

结论：通过

说明：

- 固定五步保留逐步办理，不把删除模板运行时误解为取消业务步骤。
- 现有业务表单继续由固定步骤内的业务节点承接，未扩大到工作项／模板模块删除。
- “暂保留”仍作为当前测款判断，不新增下一轮测款流程。
- 商品测款不承接商品开发或改版打样；需要改款时由前期打样模块独立人工创建任务。

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
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-revision-remodel-acceptance.ts`：通过，独立改版任务创建、花型和首版样衣下游、确认、技术包前置、完成闭环及详情页验收全部实际执行
- `npm run check:prototype-design-governance -- --all`：通过

### 例外

- 无
