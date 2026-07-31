# PCS 生产工程专业任务与商品项目边界审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 审查范围 | 商品项目固定五步、工程专业任务、技术包与花型资产来源 |
| 相关页面 | 商品项目详情、改版任务、制版任务、花型任务、首版样衣、首单样衣、技术包 |
| 主要角色 | 买手、跟单、版师、花型团队、样衣制作团队 |
| 端类型 | 管理端 |
| 审查日期 | 2026-07-31 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

### 当前业务事实

- 商品项目按“项目与档案建立 → 样衣准备 → 测款前准备 → 市场测款 → 测款判断与收尾”固定五步逐步办理。
- 改版、制版、花型、首版样衣和首单样衣是独立的工程专业任务，不属于商品项目固定步骤。
- 专业任务的单一事实由“所属商品项目 + 真实来源对象”组成。来源对象可以是商品项目、改版任务、制版任务、花型任务、首版样衣或人工创建，具体范围由任务类型约束。
- 专业任务记录不保存商品项目步骤标识、步骤编码或步骤名称；商品项目详情通过项目级关系汇总并提供工程任务入口。
- 首单样衣只能读取同一商品项目中已经通过的真实首版样衣结果，不通过任务步骤编码推断来源。
- 花型成果进入花型资产时，来源任务类型明确记录为花型专业任务；技术包引用同一来源事实。
- 商品／款式档案在创建商品项目时同步建立，工程专业任务和技术资料继续关联同一档案事实。

## 3. 自查结论

| 审查项 | 结论 | 说明 |
|---|---|---|
| 角色与职责 | 通过 | 商品项目负责人办理固定步骤，各专业团队在独立任务中执行。 |
| 协作关系 | 通过 | 商品项目提供归属与汇总；专业任务保留真实上游和下游关系。 |
| 页面模式 | 通过 | 商品项目详情保留固定步骤导航和项目级工程任务摘要；专业任务在独立详情页办理。 |
| 信息结构 | 通过 | 页面仅展示完成当前业务所需的项目、款式、来源、任务状态和操作。 |
| 中文文案 | 通过 | 页面使用“商品项目”“关联工程任务”“来源类型”等中文业务表达。 |
| 防错 | 通过 | 固定步骤中不会出现专业任务；首单来源仅允许已通过的真实首版样衣。 |
| 列表与分页 | 通过 | 专业任务列表继续使用标准列表页、标准表格和分页能力。 |
| 交互响应 | 通过 | 详情与列表的轻交互保持局部更新，不新增整页重绘。 |

## 4. 本次查漏补缺

| 问题 | 修正 |
|---|---|
| 商品项目完成服务仍针对首版、首单分支生成专业任务完成文案 | 完成服务只处理商品项目固定步骤，使用当前步骤名称生成通用完成结果。 |
| 商品项目详情仍存在首版、首单专用工作区和字段读取分支 | 删除专用工作区与分支，保留项目级“关联工程任务”摘要和入口。 |
| 首单来源通过首版任务的步骤编码查找 | 改为读取同项目已通过首版样衣的真实任务关系。 |
| 花型资产来源类型由任务步骤编码写入 | 改为明确的花型专业任务来源类型，并在页面沉淀和技术包回写中保持一致。 |
| 首版样衣演示任务使用商品项目作为虚拟来源 | 根据真实上游任务类型归一化为制版任务、花型任务、改版任务或人工创建。 |
| 项目上下文仍要求专业任务提供步骤标识和步骤名称 | 项目上下文只接收商品项目、款式和真实来源字段。 |

## 5. 交付检查

### 受管文件

- `src/data/pcs-project-flow-service.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-projects.ts`

### 例外

- 无

### 影响范围

- 本次只调整 PCS 商品项目与工程专业任务的运行时边界、演示数据和相应验收。
- 固定五步自身仍使用步骤记录承接测款办理，不受专业任务边界调整影响。
- 未引入 React、状态管理、接口层或后端逻辑。
- 未调整列表页模板、分页模型和全局布局。
### 验证命令

- `node node_modules/tsx/dist/cli.mjs tests/pcs-professional-runtime-node-cleanup.spec.ts`：通过。
- `node node_modules/tsx/dist/cli.mjs tests/pcs-professional-runtime-source-resolution.spec.ts`：通过。
- `node node_modules/tsx/dist/cli.mjs tests/pcs-professional-task-model-semantic-closure.spec.ts`：通过。
- `node node_modules/tsx/dist/cli.mjs tests/pcs-task2-dead-project-node-compatibility.spec.ts`：通过。
- `node node_modules/tsx/dist/cli.mjs scripts/check-pcs-revision-remodel-acceptance.ts`：通过。
- `npm run check:pcs-sample-chain-refactor`：通过。
- `npm run check:pcs-plate-sample-readiness`：通过。
- `npm run check:pcs-pattern-task-refactor`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:prototype-design-governance -- --all`：通过。
- `npm run build`：通过。

## 6. 最终结论

结论：通过。商品项目固定五步与工程专业任务已经分离：商品项目负责测款步骤办理，专业任务负责工程执行；两者通过商品项目归属和真实来源对象关联，不再共享专业任务步骤语义。
