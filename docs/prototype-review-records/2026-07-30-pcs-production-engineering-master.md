# PCS 生产工程专业任务、商品项目边界与工程主单工作台审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 审查范围 | 商品项目固定五步、工程专业任务、首单真实首版来源、当前项目关系初始化与技术包关系写入；任务 4：工程主单列表与泳道工作台 |
| 相关页面 | 商品项目详情、改版任务、制版任务、花型任务、首版样衣、首单样衣、技术包、工程主单列表、工程主单泳道工作台 |
| 主要角色 | 买手、跟单、版师、花型团队、样衣制作团队、工程管理（工艺、版师、花型、调色、辅料、技术包） |
| 端类型 | 管理端 |
| 审查日期 | 2026-07-31（任务 4 增补：2026-08-01） |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 当前业务事实

- 商品项目按“项目与档案建立 → 样衣准备 → 测款前准备 → 市场测款 → 测款判断与收尾”固定五步逐步办理。
- 改版、制版、花型、首版样衣和首单样衣是独立的工程专业任务，不属于商品项目固定步骤。
- 专业任务的单一事实由“所属商品项目 + 真实来源对象”组成。首单样衣的来源只能是同一商品项目内状态为“已通过”的首版样衣任务。
- 专业任务记录不保存商品项目步骤标识、步骤编码或步骤名称；商品项目详情通过项目级关系汇总并提供工程任务入口。
- 首单样衣只能读取同一商品项目中已经通过的真实首版样衣结果，不通过任务步骤编码推断来源。
- 花型成果进入花型资产时，来源任务类型明确记录为花型专业任务；技术包引用同一来源事实。
- 商品／款式档案在创建商品项目时同步建立，工程专业任务和技术资料继续关联同一档案事实。

### 任务 4 业务事实（工程主单泳道工作台）

- 工程主单是工程专业任务的归集单，按款式创建并发布后进入执行；演示种子在仓库为空时创建 2 张主单，首张发布为 EM-001。
- 泳道工作台按专业任务类型（制版、产前版样衣、花型、调色、辅料下单、技术包确认）组织任务卡，卡片只显示名称、负责人、状态、当前节点、计划与实际时间、风险。
- 依赖关系只读展示：前置依赖与下游任务以高亮表达，不提供人工调整依赖或删除依赖入口。
- 任务卡点击打开右侧抽屉，展示来源款式、当前阶段与依赖、时效节点、物料明细与返工记录；空数据以“暂无”占位。

### 任务 6 切片 A 业务事实（逐项审核服务）

- 花型与调色任务按工程主单内的有效物料行整单审核；审核服务不读取旧花型任务仓库，也不生成花型资产。
- 每轮必须覆盖全部当前待审核行；重复、遗漏、非当前有效行和未填写原因的未通过行均整体拒绝，不产生部分写入。
- 任一物料行未通过时任务进入“返工中”，已通过行锁定；下一轮只能修改、重提和审核上一轮未通过行。
- 全部有效物料行通过后任务进入“已完成”，保留每轮审核、返工轮次、首次完成时间和当前有效完成时间。
- 本切片不改页面，不实现花型资产生成、调色角色阶段和生产准备时效回写。

### 任务 6 切片 B 业务事实（花型资产逐物料生成）

- 花型任务某物料行首次审核通过时，系统按“工程主单 + 花型任务 + 物料行”确定性创建或返回一条花型库资产；一条通过行对应一条资产，不合并不同物料行。
- 资产沿用现有花型库类型与仓储，保存来源工程主单、来源任务、来源物料行、物料 SKU、商品颜色、印花工艺、成果文件、效果图及买手审核人和审核时间。
- 未通过行不生成资产；上一轮已通过并锁定的行不重复生成，原失败行在后续轮次通过时只新增该行资产。
- 资产写入发生在工程任务审核状态改写之前；字段缺失或资产写入失败时不改写任务审核状态。若部分资产已写入后发生重试，确定性键保证已有行不重复创建。
- 本切片不改页面，不实现调色三阶段、调色资产或 Task 7 成本能力。

## 3. 自查结论

| 审查项 | 结论 | 说明 |
|---|---|---|
| 角色与职责 | 通过 | 商品项目负责人办理固定步骤，各专业团队在独立任务中执行。 |
| 协作关系 | 通过 | 商品项目提供归属与汇总；专业任务保留真实上游和下游关系。 |
| 页面模式 | 通过 | 商品项目详情保留固定步骤导航和项目级工程任务摘要；专业任务在独立详情页办理。 |
| 信息结构 | 通过 | 首单创建页明确选择来源首版样衣，来源候选只展示当前项目已通过任务。 |
| 中文文案 | 通过 | 页面使用“商品项目”“关联工程任务”“来源首版样衣”等中文业务表达。 |
| 防错 | 通过 | 页面先限候选，创建服务再读取真实首版记录并校验项目、状态和结果编号。 |
| 列表与分页 | 通过 | 本次未改变专业任务列表、标准表格和分页能力；工程主单列表按标准列表页模板提供分页、列设置、冻结与排序。 |
| 交互响应 | 通过 | 本次新增来源下拉与局部表单状态；工程主单筛选、分页、列设置与任务抽屉均为局部区域更新，不触发整页重绘。 |
| 泳道布局 | 通过 | 详情为全宽泳道工作台，横向按逻辑阶段、纵向按专业任务类型分泳道，宽表在表格容器内滚动，无页面横向溢出。 |
| 依赖只读 | 通过 | 依赖关系只读展示，无“调整依赖／删除依赖”入口，前置与下游通过卡片高亮表达。 |
| 卡片与抽屉 | 通过 | 任务卡点击打开右侧抽屉（局部更新），展示来源、阶段与依赖、时效节点、物料与返工记录，空数据以“暂无”占位。 |
| 花型资产追溯 | 通过 | 每条资产可追溯到工程主单、花型任务、物料行、成果与买手审核事实；不同物料行不会合并。 |
| 重试防错 | 通过 | 资产按稳定来源键幂等写入，未通过行不写入，审核任务状态在资产写入成功后才更新。 |

## 4. 本次查漏补缺

| 问题 | 修正 |
|---|---|
| 商品项目完成服务仍针对首版、首单分支生成专业任务完成文案 | 完成服务只处理商品项目固定步骤，使用当前步骤名称生成通用完成结果。 |
| 商品项目详情仍存在首版、首单专用工作区和字段读取分支 | 删除专用工作区与分支，保留项目级“关联工程任务”摘要和入口。 |
| 首单来源通过首版任务的步骤编码查找 | 改为读取同项目已通过首版样衣的真实任务关系。 |
| 花型资产来源类型由任务步骤编码写入 | 改为明确的花型专业任务来源类型，并在页面沉淀和技术包回写中保持一致。 |
| 首版样衣演示任务使用商品项目作为虚拟来源 | 根据真实上游任务类型归一化为制版任务、花型任务、改版任务或人工创建。 |
| 项目上下文仍要求专业任务提供步骤标识和步骤名称 | 项目上下文只接收商品项目、款式和真实来源字段。 |
| 创建首单时可提交伪造的首版任务编码和结果编号 | 创建服务只接收来源任务标识，并重新读取同项目已通过的真实首版任务；持久化字段全部取真实记录。 |
| 专业任务创建、保存、完成使用不同关系角色，可能形成多条记录 | 创建、详情保存和完成统一写入“执行记录”，关系仓储按同一业务唯一键原位更新。 |
| 项目关系初始化复制旧测款记录 | 删除旧测款关系回放入口；初始化只读取当前专业任务、当前渠道商品及其明确关联的直播／短视频记录。 |
| 普通关系写入空的项目节点、步骤和旧引用字段 | 款式、技术包、上游同步、归档和专业任务关系不写空字段；商品上架、直播测款和短视频测款仍保存固定五步中的真实节点。 |

## 5. 交付检查

### 受管文件

- `src/data/pcs-project-flow-service.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-testing-relation-normalizer.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-first-sample-project-writeback.ts`
- `src/data/pcs-first-sample-types.ts`
- `src/data/pcs-first-order-sample-project-writeback.ts`
- `src/data/pcs-first-order-sample-repository.ts`
- `src/data/pcs-first-order-sample-types.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/data/pcs-project-archive-sync.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-project-relation-bootstrap.ts`（已删除）
- `src/data/pcs-project-relation-types.ts`
- `src/data/pcs-testing-relation-bootstrap.ts`（已删除）
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-projects.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/pages/pcs-engineering-master-list.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/router/routes-pcs.ts`
- `src/router/route-renderers.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/data/app-shell-config.ts`
- `src/data/pcs-engineering-master-types.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-task-review.ts`
- `src/data/pcs-pattern-library-archive-linkage.ts`
- `src/data/pcs-pattern-library-types.ts`

### 例外

- 无

### 影响范围

- 本次只调整 PCS 商品项目与工程专业任务的运行时边界、首单来源选择、项目关系生命周期、当前关系初始化和相应验收。
- 固定五步自身仍使用步骤记录承接测款办理，不受专业任务边界调整影响。
- 未引入 React、状态管理、接口层或后端逻辑。
- 未调整列表页模板、分页模型和全局布局。
- 任务 4：新增工程主单列表页与泳道工作台详情页、2 条路由与 2 个页面处理器、菜单“生产工程管理”分组；未引入 React、状态管理、接口层或后端逻辑。
### 验证命令

- `npx tsx tests/pcs-first-order-sample-source-validation.spec.ts`：通过。
- `npx tsx tests/pcs-professional-task-relation-lifecycle-idempotency.spec.ts`：通过。
- `npx tsx tests/pcs-task2-dead-project-node-compatibility.spec.ts`：通过，并核对当前渠道商品与固定五步真实节点关系。
- `npx tsx tests/pcs-professional-task-bootstrap-independent.spec.ts`：通过。
- `npx tsx tests/pcs-professional-task-project-binding.spec.ts`：通过。
- `npx tsx tests/pcs-testing-summary-explicit-mapping-gate.spec.ts`：通过。
- `npx tsx tests/pcs-test-data-summary-structure.spec.ts`：通过。
- `npm test -- tests/pcs-engineering-master-pages.spec.ts`：通过（任务 4）。
- `npm run check:list-page-governance`：通过（任务 4，含标准列表页模板与原型治理全量检查）。
- `npm run check:menu-routes`：通过（任务 4）。
- `npm run build`：通过（任务 4）。
- `npx tsx tests/pcs-engineering-material-review.spec.ts`：通过（任务 6 切片 A）。
- `npm run build`：通过（任务 6 切片 A）。
- `npx tsx tests/pcs-engineering-pattern-assets.spec.ts`：通过（任务 6 切片 B：逐行生成、字段完整、未通过不生成、重试幂等与第二轮生成）。

### 待交付前验证

- PCS 专项检查、列表页治理、原型治理、构建、CodeGraph 同步和任务收据将在本任务最后一次实质改动后统一执行。

## 6. 最终结论

结论：通过。本轮业务边界与页面表达符合当前确认口径，工程主单列表与泳道工作台符合泳道工作台设计规范；最终交付结论以本任务最后一次改动后的专项检查、治理检查、构建、CodeGraph 和任务收据为准。
