# PCS 生产工程管理实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 在 PCS 原型中建立以工程主单为唯一任务编排事实源的生产工程模块，删除商品项目工作项／模板运行时，并串联专业任务、BOM 与价格、技术包审核及只读生产准备时效。

**架构：** 商品项目保留固定五步业务流程，但不再依赖可配置工作项和模板。生产工程采用独立的工程主单仓库保存主单、固定任务骨架、任务物料行和返工轮次；各专业任务页面读取同一仓库，技术包与生产准备时效分别作为正式成果线和只读投影线。继续使用现有 LocalStorage Mock 仓库、Vanilla TypeScript 字符串模板、标准列表页组件和既有技术包十模块审核，不引入后端或状态管理框架。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、LocalStorage Mock Repository、Node `assert` 检查脚本。

**设计规格：** `docs/superpowers/specs/2026-07-30-pcs-production-engineering-master-design.md`

---

## 一、目标文件结构

### 1. 商品项目固定流程与旧模块删除

- 修改 `src/data/pcs-project-domain-contract.ts`：成为商品项目固定五步流程的唯一业务定义。
- 修改 `src/data/pcs-project-node-factory.ts`：只根据固定业务定义生成项目步骤，不读取模板或工作项。
- 修改 `src/data/pcs-project-repository.ts`：创建项目时直接生成固定步骤并关联商品／款式档案。
- 修改 `src/pages/pcs-projects.ts`：继续逐步展示项目流程，但不读取工作项定义或模板。
- 删除 `src/pages/pcs-work-items.ts`、`src/pages/pcs-templates.ts`。
- 删除 `src/data/pcs-work-items.ts`、`src/data/pcs-templates.ts`、`src/data/pcs-work-item-runtime-carrier.ts`、`src/data/pcs-template-domain-view-model.ts`。
- 删除 `src/data/pcs-work-item-configs.ts` 及 `src/data/pcs-work-item-configs/`。
- 修改 `src/router/routes-pcs.ts`、`src/router/route-renderers.ts`、`src/main-handlers/pcs-handlers.ts`、`src/data/app-shell-config.ts`：移除入口、渲染器和事件处理器。
- 修改仍引用模板／工作项的项目数据服务与检查脚本，使其读取固定流程契约。

### 2. 工程主单事实源

- 创建 `src/data/pcs-engineering-master-types.ts`：工程主单、任务、任务物料行、返工轮次、前期成果复用和关闭校验类型。
- 创建 `src/data/pcs-engineering-master-repository.ts`：工程主单及任务骨架的 LocalStorage 仓库。
- 创建 `src/data/pcs-engineering-dependency-policy.ts`：10 类专业任务、11 个生产准备投影节点、固定依赖、责任团队和自动补齐规则。
- 创建 `src/data/pcs-engineering-first-production-policy.ts`：首次正式生产校验。
- 创建 `src/data/pcs-engineering-master-view-model.ts`：列表、泳道、任务卡和项目概览模型。

### 3. 页面与交互

- 创建 `src/pages/pcs-engineering-master-list.ts`：工程主单标准列表页。
- 创建 `src/pages/pcs-engineering-master-detail.ts`：全宽阶段泳道工作台和右侧任务抽屉。
- 拆分 `src/pages/pcs-engineering-tasks.ts`：保留统一事件入口，将制版、样衣、花型、调色、辅料和技术包确认渲染拆到 `src/pages/pcs-engineering-tasks/`。
- 创建 `src/pages/pcs-engineering-tasks/shared.ts`：专业任务列表公共筛选、状态徽章、分页和抽屉壳。
- 创建 `src/pages/pcs-engineering-tasks/pattern-task.ts`、`color-task.ts`、`purchase-task.ts`、`tech-pack-task.ts`：专业任务页面。

### 4. BOM、价格与物料

- 修改 `src/data/pcs-material-archive-types.ts`、`src/data/pcs-material-archive-repository.ts`：增加物料单位换算关系及标准单价有效性。
- 创建 `src/data/pcs-engineering-bom-types.ts`：工程 BOM 行、成本项、价格快照和审核差异类型。
- 创建 `src/data/pcs-engineering-bom-pricing.ts`：标准单价、单位换算、双币成本和快照计算。
- 创建 `src/data/pcs-exchange-rate-config.ts`：系统配置中的最新人民币兑印尼盾汇率。
- 修改 `src/pages/pcs-config-workspace.ts`：提供统一汇率配置入口。

### 5. 技术包、采购与时效

- 修改 `src/data/pcs-technical-data-version-types.ts`、`src/data/pcs-technical-data-version-repository.ts`：只允许工程主单／工程变更任务生成新版本，并保存 BOM 与价格快照。
- 修改 `src/data/pcs-tech-pack-task-generation.ts`、`src/data/pcs-tech-pack-review.ts`：移除手动生成，支持模块级审核失效和原任务返工。
- 创建 `src/data/pcs-engineering-purchase-linkage.ts`：多个采购单、辅料覆盖和最晚下单时间。
- 创建 `src/data/pcs-engineering-preparation-projection.ts`：工程事件到 11 个生产准备项的幂等投影。
- 修改 `src/data/fcs/production-preparation-timing-runtime.ts`、`src/pages/production/preparation-timing.ts`：工程主单来源记录完全只读。

### 6. 验证与治理

- 创建 `scripts/check-pcs-engineering-master.ts`：总门禁。
- 创建 `tests/pcs-engineering-*.spec.ts`：按业务边界拆分的 Node 断言测试。
- 修改 `package.json`：增加 `check:pcs-engineering-master`。
- 创建 `docs/prototype-review-records/2026-07-30-pcs-production-engineering-master.md`：产品设计治理审查记录。

---

## 二、实施任务

### 任务 1：用固定五步流程替换模板／工作项运行时

**文件：**

- 修改：`src/data/pcs-project-domain-contract.ts`
- 修改：`src/data/pcs-project-node-factory.ts`
- 修改：`src/data/pcs-project-repository.ts`
- 修改：`src/data/pcs-project-bootstrap.ts`
- 修改：`src/data/pcs-project-data-consistency.ts`
- 修改：`src/pages/pcs-projects.ts`
- 测试：`tests/pcs-project-fixed-step-flow.spec.ts`

- [ ] **步骤 1：编写固定五步业务契约失败测试**

```typescript
import assert from 'node:assert/strict'
import { listProjectStepContracts } from '../src/data/pcs-project-domain-contract.ts'
import { createProject } from '../src/data/pcs-project-repository.ts'

assert.deepEqual(
  listProjectStepContracts().map((item) => item.stepName),
  ['项目与档案建立', '样衣准备', '测款前准备', '市场测款', '测款判断与收尾'],
)

const project = createProject({ projectName: '固定流程测试款', ownerName: '赵云' })
assert.equal(project.nodes.length, 5)
assert.ok(project.linkedStyleId, '创建商品项目时必须同步关联商品／款式档案')
```

- [ ] **步骤 2：运行测试并确认旧实现失败**

运行：

```bash
npm test -- tests/pcs-project-fixed-step-flow.spec.ts
```

预期：FAIL；当前项目步骤由模板节点生成，且创建项目未必立即关联款式档案。

- [ ] **步骤 3：将固定五步写入业务契约**

在 `src/data/pcs-project-domain-contract.ts` 增加并导出：

```typescript
export type ProjectStepCode =
  | 'PROJECT_ARCHIVE'
  | 'SAMPLE_PREPARATION'
  | 'PRE_TEST_PREPARATION'
  | 'MARKET_TESTING'
  | 'TEST_DECISION_CLOSURE'

export interface ProjectStepContract {
  stepCode: ProjectStepCode
  stepName: string
  sequence: number
}

export const PROJECT_STEP_CONTRACTS: ProjectStepContract[] = [
  { stepCode: 'PROJECT_ARCHIVE', stepName: '项目与档案建立', sequence: 1 },
  { stepCode: 'SAMPLE_PREPARATION', stepName: '样衣准备', sequence: 2 },
  { stepCode: 'PRE_TEST_PREPARATION', stepName: '测款前准备', sequence: 3 },
  { stepCode: 'MARKET_TESTING', stepName: '市场测款', sequence: 4 },
  { stepCode: 'TEST_DECISION_CLOSURE', stepName: '测款判断与收尾', sequence: 5 },
]
```

- [ ] **步骤 4：改造项目工厂和仓库**

让 `buildProjectNodes()` 只遍历 `PROJECT_STEP_CONTRACTS`；`createProject()` 同一事务内创建商品项目与“商品测款”状态的商品／款式档案，不再接受模板 ID。

- [ ] **步骤 5：让商品项目页面读取固定步骤**

删除 `pcs-projects.ts` 中 `getPcsWorkItemDefinition()` 和模板读取逻辑；阶段导航仍逐步展示五个步骤，详情由 `ProjectStepCode` 分派到现有业务表单。

- [ ] **步骤 6：运行固定流程及关联回归**

```bash
npm test -- tests/pcs-project-fixed-step-flow.spec.ts
npm run check:pcs-product-testing-v1
npm run check:pcs-project-data-consistency
```

预期：全部 PASS，商品项目仍逐步操作，但不依赖可配置模板。

- [ ] **步骤 7：提交**

```bash
git add src/data/pcs-project-domain-contract.ts src/data/pcs-project-node-factory.ts src/data/pcs-project-repository.ts src/data/pcs-project-bootstrap.ts src/data/pcs-project-data-consistency.ts src/pages/pcs-projects.ts tests/pcs-project-fixed-step-flow.spec.ts
git commit -m "refactor(商品项目): 改为固定五步业务流程"
```

---

### 任务 2：彻底删除工作项、工作项模板及入口

**文件：**

- 删除：`src/pages/pcs-work-items.ts`
- 删除：`src/pages/pcs-templates.ts`
- 删除：`src/data/pcs-work-items.ts`
- 删除：`src/data/pcs-templates.ts`
- 删除：`src/data/pcs-work-item-runtime-carrier.ts`
- 删除：`src/data/pcs-template-domain-view-model.ts`
- 删除：`src/data/pcs-work-item-configs.ts`
- 删除：`src/data/pcs-work-item-configs/`
- 修改：`src/router/routes-pcs.ts`
- 修改：`src/router/route-renderers.ts`
- 修改：`src/main-handlers/pcs-handlers.ts`
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/data/pcs-project-instance-model.ts`
- 修改：`src/data/pcs-project-inline-node-record-repository.ts`
- 修改：`scripts/check-pcs-channel-listing-style-specs.ts`
- 修改：`scripts/check-pcs-product-testing-v1.ts`
- 删除：`tests/pcs-work-item-library.spec.ts`
- 删除：`tests/pcs-work-item-status-contract.spec.ts`
- 测试：`tests/pcs-work-item-module-removal.spec.ts`

- [ ] **步骤 1：编写模块删除失败测试**

```typescript
import assert from 'node:assert/strict'
import fs from 'node:fs'

for (const file of [
  'src/pages/pcs-work-items.ts',
  'src/pages/pcs-templates.ts',
  'src/data/pcs-work-items.ts',
  'src/data/pcs-templates.ts',
]) {
  assert.equal(fs.existsSync(file), false, `${file} 必须删除`)
}

const routes = fs.readFileSync('src/router/routes-pcs.ts', 'utf8')
const menu = fs.readFileSync('src/data/app-shell-config.ts', 'utf8')
assert.doesNotMatch(routes, /\\/pcs\\/(work-items|templates)/)
assert.doesNotMatch(menu, /工作项库|项目模板管理/)
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/pcs-work-item-module-removal.spec.ts
```

预期：FAIL，文件、路由和菜单仍存在。

- [ ] **步骤 3：替换剩余运行时引用**

将 `pcs-project-instance-model.ts`、`pcs-project-inline-node-record-repository.ts` 中的工作项载体改为固定 `ProjectStepCode`；将两个检查脚本改为读取项目固定流程契约。

- [ ] **步骤 4：删除模块并清理入口**

删除上述页面和数据文件，同时移除：

```typescript
'/pcs/templates'
'/pcs/templates/new'
'/pcs/work-items'
```

以及所有动态详情路由、异步渲染器和 `pcs-templates`／`pcs-work-items` 处理器配置。

- [ ] **步骤 5：运行引用扫描和路由检查**

```bash
rg -n "pcs-work-items|pcs-templates|getPcsWorkItemDefinition|pcs-work-item-configs|pcs-work-item-runtime-carrier" src scripts tests
npm test -- tests/pcs-work-item-module-removal.spec.ts
npm run check:menu-routes
```

预期：`rg` 无结果；两个命令 PASS。

- [ ] **步骤 6：提交**

```bash
git add -A
git commit -m "refactor(商品项目): 删除工作项与模板模块"
```

---

### 任务 3：建立工程主单、完整任务骨架和固定依赖

**文件：**

- 创建：`src/data/pcs-engineering-master-types.ts`
- 创建：`src/data/pcs-engineering-master-repository.ts`
- 创建：`src/data/pcs-engineering-dependency-policy.ts`
- 创建：`src/data/pcs-engineering-first-production-policy.ts`
- 测试：`tests/pcs-engineering-master-domain.spec.ts`
- 测试：`tests/pcs-engineering-dependency-policy.spec.ts`

- [ ] **步骤 1：编写主单唯一性和首单门禁失败测试**

```typescript
import assert from 'node:assert/strict'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
} from '../src/data/pcs-engineering-master-repository.ts'

const master = createEngineeringMasterOrder({
  styleId: 'STYLE-NEW-001',
  styleCode: 'SPU-NEW-001',
  merchandiserName: '跟单C',
})
assert.throws(() => createEngineeringMasterOrder({
  styleId: 'STYLE-NEW-001',
  styleCode: 'SPU-NEW-001',
  merchandiserName: '跟单C',
}), /未关闭的工程主单/)

const published = publishEngineeringMasterOrder(master.masterOrderId)
assert.equal(published.tasks.length, 10)
assert.equal(published.tasks.find((item) => item.taskType === 'PATTERN_ARTWORK')?.status, '未启用')
assert.equal(published.tasks.find((item) => item.taskType === 'TECH_PACK_CONFIRMATION')?.status, '待前置')
```

- [ ] **步骤 2：编写固定依赖失败测试**

```typescript
import assert from 'node:assert/strict'
import { listEngineeringTaskDefinitions } from '../src/data/pcs-engineering-dependency-policy.ts'

const definitions = listEngineeringTaskDefinitions()
assert.equal(definitions.length, 10)
assert.deepEqual(
  definitions.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')?.dependsOn,
  ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'],
)
assert.deepEqual(
  definitions.find((item) => item.taskType === 'COLOR_YARN')?.stages.map((item) => item.stageType),
  ['BOM_REQUIREMENT', 'COLOR_REQUIREMENT_CONFIRMATION', 'FACTORY_COLORING', 'BUYER_REVIEW'],
)
```

- [ ] **步骤 3：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-master-domain.spec.ts
npm test -- tests/pcs-engineering-dependency-policy.spec.ts
```

预期：FAIL，新类型与仓库尚不存在。

- [ ] **步骤 4：定义工程主单和任务类型**

```typescript
export type EngineeringMasterStatus =
  | '草稿'
  | '已发布'
  | '进行中'
  | '技术包审核中'
  | '待关闭'
  | '已关闭'
  | '已终止'

export type EngineeringTaskStatus =
  | '未启用'
  | '待前置'
  | '待开始'
  | '进行中'
  | '待审核'
  | '返工中'
  | '已完成'
  | '因需求变更结束'

export interface EngineeringTaskRecord {
  taskId: string
  masterOrderId: string
  taskType: EngineeringTaskType
  status: EngineeringTaskStatus
  dependsOnTaskIds: string[]
  ownerTeamName: string
  materialLines: EngineeringTaskMaterialLine[]
  reworkRounds: EngineeringTaskReworkRound[]
  firstCompletedAt: string
  effectiveCompletedAt: string
}
```

- [ ] **步骤 5：实现一次性骨架和前置自动补齐**

`publishEngineeringMasterOrder()` 一次性写入 10 张专业任务：梭织基码、毛织基码、产前版样衣、梭织齐码、毛织齐码、花型、纱线调色、面料调色、辅料下单、技术包确认。调色任务内部保留阶段节点，最终向生产准备时效投影 11 个准备项。条件任务初始为“未启用”，普通任务根据本款适用的前置任务为“待前置”或“待开始”。依赖数组和调色阶段顺序只从 `pcs-engineering-dependency-policy.ts` 复制，不提供更新接口。

- [ ] **步骤 6：实现首次正式生产校验**

`assertFirstFormalProduction(styleId)` 读取当前款式档案、已发布技术包与正式生产需求／生产单 Mock 数据；发现该 SPU 已有正式生产事实时抛出：

```text
该款式已经正式生产过，不属于首次工程准备，不能创建工程主单。
```

- [ ] **步骤 7：运行测试**

```bash
npm test -- tests/pcs-engineering-master-domain.spec.ts
npm test -- tests/pcs-engineering-dependency-policy.spec.ts
```

预期：PASS。

- [ ] **步骤 8：提交**

```bash
git add src/data/pcs-engineering-master-types.ts src/data/pcs-engineering-master-repository.ts src/data/pcs-engineering-dependency-policy.ts src/data/pcs-engineering-first-production-policy.ts tests/pcs-engineering-master-domain.spec.ts tests/pcs-engineering-dependency-policy.spec.ts
git commit -m "feat(生产工程): 建立工程主单与固定任务骨架"
```

---

### 任务 4：实现工程主单列表、泳道详情和任务局部交互

**文件：**

- 创建：`src/data/pcs-engineering-master-view-model.ts`
- 创建：`src/pages/pcs-engineering-master-list.ts`
- 创建：`src/pages/pcs-engineering-master-detail.ts`
- 修改：`src/router/routes-pcs.ts`
- 修改：`src/router/route-renderers.ts`
- 修改：`src/main-handlers/pcs-handlers.ts`
- 修改：`src/data/app-shell-config.ts`
- 测试：`tests/pcs-engineering-master-pages.spec.ts`
- 审查记录：`docs/prototype-review-records/2026-07-30-pcs-production-engineering-master.md`

- [ ] **步骤 1：编写页面结构失败测试**

```typescript
import assert from 'node:assert/strict'
import { renderPcsEngineeringMasterListPage } from '../src/pages/pcs-engineering-master-list.ts'
import { renderPcsEngineeringMasterDetailPage } from '../src/pages/pcs-engineering-master-detail.ts'

const listHtml = renderPcsEngineeringMasterListPage()
assert.match(listHtml, /data-standard-list-page/)
assert.match(listHtml, /data-table-pagination/)

const detailHtml = renderPcsEngineeringMasterDetailPage('EM-001')
assert.match(detailHtml, /制版|产前版样衣|花型|调色|辅料下单|技术包确认/)
assert.match(detailHtml, /data-engineering-task-card/)
assert.doesNotMatch(detailHtml, /调整依赖|删除依赖/)
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-master-pages.spec.ts
```

预期：FAIL，页面和路由尚不存在。

- [ ] **步骤 3：实现标准列表页**

文件顶部声明：

```typescript
// @page-pattern: list
```

使用 `renderStandardListPage`、`renderStandardListTable` 和 `renderTablePagination`；必需列为主单号、款式、负责人、状态、当前阶段、进度和更新时间，操作列固定右侧。

- [ ] **步骤 4：实现全宽泳道详情**

按专业类型分泳道、按固定逻辑阶段排列任务卡；任务卡只显示名称、负责人、状态、当前节点、计划／实际时间和风险。点击卡片只局部插入右侧抽屉，不执行 `root.innerHTML` 整页重绘。

- [ ] **步骤 5：接入路由、菜单和事件处理器**

新增：

```text
/pcs/engineering/masters
/pcs/engineering/masters/:masterOrderId
```

菜单改为“生产工程管理”，包含工程主单、我的工程任务和专业任务入口。

- [ ] **步骤 6：填写原型审查记录**

记录管理后台角色、页面模式、列表分页、宽表滚动、局部交互、中文状态、无异常模块和样衣管理暂缓边界。

- [ ] **步骤 7：运行页面治理**

```bash
npm test -- tests/pcs-engineering-master-pages.spec.ts
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run check:menu-routes
```

预期：全部 PASS。

- [ ] **步骤 8：提交**

```bash
git add src/data/pcs-engineering-master-view-model.ts src/pages/pcs-engineering-master-list.ts src/pages/pcs-engineering-master-detail.ts src/router/routes-pcs.ts src/router/route-renderers.ts src/main-handlers/pcs-handlers.ts src/data/app-shell-config.ts tests/pcs-engineering-master-pages.spec.ts docs/prototype-review-records/2026-07-30-pcs-production-engineering-master.md
git commit -m "feat(生产工程): 增加工主单泳道工作台"
```

---

### 任务 5：统一专业任务状态并拆分巨型页面

**文件：**

- 创建：`src/pages/pcs-engineering-tasks/shared.ts`
- 创建：`src/pages/pcs-engineering-tasks/pattern-task.ts`
- 创建：`src/pages/pcs-engineering-tasks/color-task.ts`
- 创建：`src/pages/pcs-engineering-tasks/purchase-task.ts`
- 创建：`src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- 修改：`src/pages/pcs-engineering-tasks.ts`
- 修改：`src/data/pcs-plate-making-types.ts`
- 修改：`src/data/pcs-pattern-task-types.ts`
- 测试：`tests/pcs-engineering-task-status.spec.ts`

- [ ] **步骤 1：编写状态集合失败测试**

```typescript
import assert from 'node:assert/strict'
import { ENGINEERING_TASK_STATUSES } from '../src/data/pcs-engineering-master-types.ts'

assert.deepEqual(ENGINEERING_TASK_STATUSES, [
  '未启用', '待前置', '待开始', '进行中',
  '待审核', '返工中', '已完成', '因需求变更结束',
])
assert.ok(!ENGINEERING_TASK_STATUSES.includes('已取消' as never))
assert.ok(!ENGINEERING_TASK_STATUSES.includes('已暂停' as never))
```

- [ ] **步骤 2：运行测试确认现状不符**

```bash
npm test -- tests/pcs-engineering-task-status.spec.ts
```

预期：FAIL，现有任务仍含“已取消”等状态。

- [ ] **步骤 3：让各专业页面读取工程任务记录**

保留 `handlePcsEngineeringTaskEvent()` 和 `handlePcsEngineeringTaskInput()` 作为统一入口，但动作分派到小文件。制版与产前版样衣提交成果即完成；只有花型和调色进入“待审核”。

- [ ] **步骤 4：删除人工暂停、人工取消和任务级样衣验收**

移除相关按钮、状态和处理分支；产前版样衣只保留成果图片、制作数量和提交时间。

- [ ] **步骤 5：运行专业任务回归**

```bash
npm test -- tests/pcs-engineering-task-status.spec.ts
npm run check:pcs-plate-making-refactor
npm run check:pcs-pattern-task-refactor
npm run check:pcs-sample-chain-refactor
```

预期：全部 PASS，原检查中依赖旧状态的断言同步更新为新状态口径。

- [ ] **步骤 6：提交**

```bash
git add src/pages/pcs-engineering-tasks.ts src/pages/pcs-engineering-tasks src/data/pcs-plate-making-types.ts src/data/pcs-pattern-task-types.ts tests/pcs-engineering-task-status.spec.ts scripts/check-pcs-plate-making-refactor.ts scripts/check-pcs-pattern-task-refactor.ts scripts/check-pcs-sample-chain-refactor.ts
git commit -m "refactor(生产工程): 统一专业任务状态与页面边界"
```

---

### 任务 6：实现花型与调色的整单提交、逐项审核和返工

**文件：**

- 创建：`src/data/pcs-engineering-task-review.ts`
- 修改：`src/data/pcs-pattern-task-types.ts`
- 修改：`src/data/pcs-pattern-task-repository.ts`
- 修改：`src/data/pcs-pattern-library-archive-linkage.ts`
- 修改：`src/pages/pcs-engineering-tasks/pattern-task.ts`
- 修改：`src/pages/pcs-engineering-tasks/color-task.ts`
- 测试：`tests/pcs-engineering-material-review.spec.ts`

- [ ] **步骤 1：编写逐项审核失败测试**

```typescript
import assert from 'node:assert/strict'
import { reviewEngineeringMaterialResults } from '../src/data/pcs-engineering-task-review.ts'

const result = reviewEngineeringMaterialResults({
  taskId: 'TASK-PATTERN-1',
  reviewerName: '买手A',
  decisions: [
    { materialLineId: 'LINE-1', decision: '通过', reason: '' },
    { materialLineId: 'LINE-2', decision: '未通过', reason: '颜色偏暗' },
  ],
})

assert.equal(result.taskStatus, '返工中')
assert.equal(result.lockedPassedLineIds[0], 'LINE-1')
assert.deepEqual(result.reworkLineIds, ['LINE-2'])
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-material-review.spec.ts
```

预期：FAIL，当前审核以任务整体状态为主。

- [ ] **步骤 3：实现统一审核服务**

要求：

```typescript
export type MaterialReviewDecision = '通过' | '未通过'

export interface MaterialReviewResultLine {
  materialLineId: string
  decision: MaterialReviewDecision
  reason: string
  reviewedBy: string
  reviewedAt: string
}
```

整单一次提交；任一行未通过则任务进入“返工中”，已通过行锁定，下一轮仅允许修改未通过行。

- [ ] **步骤 4：实现花型资产逐行生成**

每个通过物料行分别创建花型资产，保存成果文件、效果图、物料 SKU、商品颜色、印花工艺和来源任务；不能用一条任务生成一条合并资产。

- [ ] **步骤 5：实现调色三阶段**

阶段一读取 BOM 染色物料；阶段二由跟单维护潘通号、颜色名和染色色号；阶段三由染厂提交成果、买手逐项审核。阶段二完成和最终审核通过分别回写两个准备项时间。

- [ ] **步骤 6：运行测试**

```bash
npm test -- tests/pcs-engineering-material-review.spec.ts
npm run check:pcs-pattern-task-refactor
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/data/pcs-engineering-task-review.ts src/data/pcs-pattern-task-types.ts src/data/pcs-pattern-task-repository.ts src/data/pcs-pattern-library-archive-linkage.ts src/pages/pcs-engineering-tasks/pattern-task.ts src/pages/pcs-engineering-tasks/color-task.ts tests/pcs-engineering-material-review.spec.ts
git commit -m "feat(生产工程): 增加花型调色逐项审核"
```

---

### 任务 7：实现 BOM、标准单价、单位换算与双币综合成本

**文件：**

- 修改：`src/data/pcs-material-archive-types.ts`
- 修改：`src/data/pcs-material-archive-repository.ts`
- 修改：`src/pages/pcs-material-archives.ts`
- 创建：`src/data/pcs-engineering-bom-types.ts`
- 创建：`src/data/pcs-engineering-bom-pricing.ts`
- 创建：`src/data/pcs-exchange-rate-config.ts`
- 修改：`src/pages/pcs-config-workspace.ts`
- 修改：`src/data/pcs-technical-data-version-types.ts`
- 测试：`tests/pcs-engineering-bom-pricing.spec.ts`

- [ ] **步骤 1：编写价格和换算失败测试**

```typescript
import assert from 'node:assert/strict'
import { calculateEngineeringBomCost } from '../src/data/pcs-engineering-bom-pricing.ts'

const result = calculateEngineeringBomCost({
  exchangeRateIdrPerCny: 2200,
  materialLines: [{
    materialSkuId: 'MAT-1',
    usage: 1.25,
    usageUnit: '米',
    pricingUnit: '码',
    conversionToPricingUnit: 1.0936,
    lossRate: 0.05,
    standardUnitPriceCny: 12.3456,
  }],
  customCosts: [{ title: '车位费', amountIdr: 44000 }],
})

assert.equal(result.materialCostCny, 17.72)
assert.equal(result.customCostIdr, 44000)
assert.equal(result.comprehensiveCostCny, 37.72)
assert.equal(result.comprehensiveCostIdr, 82985)
```

- [ ] **步骤 2：编写无标准单价／无换算关系失败测试**

```typescript
assert.throws(() => calculateEngineeringBomCost({
  exchangeRateIdrPerCny: 2200,
  materialLines: [{
    materialSkuId: 'MAT-NO-PRICE',
    usage: 1,
    usageUnit: '米',
    pricingUnit: '码',
    conversionToPricingUnit: null,
    lossRate: 0,
    standardUnitPriceCny: null,
  }],
  customCosts: [],
}), /标准单价|单位换算/)
```

- [ ] **步骤 3：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-bom-pricing.spec.ts
```

预期：FAIL，新定价模型尚不存在。

- [ ] **步骤 4：扩展物料档案**

```typescript
export interface MaterialUnitConversion {
  fromUnit: string
  toUnit: string
  factor: number
}

export interface MaterialSkuRecord {
  // 保留现有字段
  costPrice: number
  pricingUnit: string
  unitConversions: MaterialUnitConversion[]
}
```

标准单价只取 `costPrice`，不使用 `freightCost`；无价格或缺少所需换算关系时禁止加入 BOM。

- [ ] **步骤 5：实现双币计算**

计算规则：

```typescript
const comprehensiveCostCny = materialCostCny + customCostIdr / exchangeRateIdrPerCny
const comprehensiveCostIdr = materialCostCny * exchangeRateIdrPerCny + customCostIdr
```

标准单价保留 4 位小数，人民币小计／汇总 2 位小数，印尼盾整数展示。汇率页面只读使用系统最新值；只有系统配置页面可以修改。

- [ ] **步骤 6：保留技术包十模块字段**

扩充 `TechnicalBomItem` 的价格快照字段，但保留 BOM、COST、PATTERN、MATERIAL_PATTERN_LINK、COLOR_MATERIAL_MAPPING、PROCESS、SIZE、DESIGN、ATTACHMENT、QUALITY 十模块。

- [ ] **步骤 7：运行验证**

```bash
npm test -- tests/pcs-engineering-bom-pricing.spec.ts
npm run check:pcs-material-archive-units
npm run check:tech-pack-bom-unit-guard
```

预期：全部 PASS。

- [ ] **步骤 8：提交**

```bash
git add src/data/pcs-material-archive-types.ts src/data/pcs-material-archive-repository.ts src/pages/pcs-material-archives.ts src/data/pcs-engineering-bom-types.ts src/data/pcs-engineering-bom-pricing.ts src/data/pcs-exchange-rate-config.ts src/pages/pcs-config-workspace.ts src/data/pcs-technical-data-version-types.ts tests/pcs-engineering-bom-pricing.spec.ts
git commit -m "feat(生产工程): 增加BOM双币成本与单位换算"
```

---

### 任务 8：让 BOM 只启用花型／调色任务并处理需求变更轮次

**文件：**

- 修改：`src/pages/tech-pack/bom-process-linkage.ts`
- 修改：`src/data/pcs-engineering-master-repository.ts`
- 修改：`src/data/pcs-engineering-bom-types.ts`
- 测试：`tests/pcs-engineering-bom-task-linkage.spec.ts`

- [ ] **步骤 1：编写 BOM 联动失败测试**

```typescript
import assert from 'node:assert/strict'
import { applyBomRequirementsToEngineeringTasks } from '../src/data/pcs-engineering-master-repository.ts'

const changed = applyBomRequirementsToEngineeringTasks('EM-001', [{
  bomItemId: 'BOM-1',
  printRequirement: '是',
  dyeRequirement: '是',
  shrinkRequirement: '是',
  washRequirement: '是',
  waterSolubleRequirement: '是',
}])

assert.equal(changed.tasks.filter((item) => item.taskType === 'PATTERN_ARTWORK').length, 1)
assert.equal(changed.tasks.filter((item) => item.taskType === 'COLOR_FABRIC').length, 1)
assert.equal(changed.createdTaskCount, 0, '只能启用既有任务骨架')
assert.deepEqual(changed.techPackOnlyProcesses.sort(), ['洗水', '水溶', '缩水'])
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-bom-task-linkage.spec.ts
```

预期：FAIL；当前 `bom-process-linkage.ts` 会把多种工艺都自动生成准备工序，并支持自动移除。

- [ ] **步骤 3：调整联动边界**

只有印花和染色启用专业任务；缩水、洗水、水溶继续写入技术包工艺资料，不创建工程任务或生产准备项。

- [ ] **步骤 4：实现新增和删除物料行规则**

新增印花／染色要求时加入既有任务；已完成任务增加返工轮次。移除要求时按物料行标记“因需求变更结束”，不提供人工取消。

- [ ] **步骤 5：运行测试**

```bash
npm test -- tests/pcs-engineering-bom-task-linkage.spec.ts
npm run check:tech-pack-process-route
npm run check:water-soluble-process
```

预期：全部 PASS。

- [ ] **步骤 6：提交**

```bash
git add src/pages/tech-pack/bom-process-linkage.ts src/data/pcs-engineering-master-repository.ts src/data/pcs-engineering-bom-types.ts tests/pcs-engineering-bom-task-linkage.spec.ts
git commit -m "feat(生产工程): 串联BOM与条件专业任务"
```

---

### 任务 9：实现多个辅料采购单绑定和覆盖门禁

**文件：**

- 创建：`src/data/pcs-engineering-purchase-linkage.ts`
- 修改：`src/pages/pcs-engineering-tasks/purchase-task.ts`
- 修改：`src/data/pcs-engineering-master-repository.ts`
- 测试：`tests/pcs-engineering-purchase-linkage.spec.ts`

- [ ] **步骤 1：编写多采购单失败测试**

```typescript
import assert from 'node:assert/strict'
import { evaluateAccessoryPurchaseCompletion } from '../src/data/pcs-engineering-purchase-linkage.ts'

const result = evaluateAccessoryPurchaseCompletion({
  requiredMaterialSkuIds: ['ACC-1', 'ACC-2'],
  purchaseOrders: [
    { orderNo: 'PO-A', materialSkuIds: ['ACC-1'], orderedAt: '2026-07-30 09:10' },
    { orderNo: 'PO-B', materialSkuIds: ['ACC-2'], orderedAt: '2026-07-30 11:20' },
  ],
})

assert.equal(result.completed, true)
assert.equal(result.completedAt, '2026-07-30 11:20')
```

- [ ] **步骤 2：补充缺失覆盖门禁测试**

```typescript
const blocked = evaluateAccessoryPurchaseCompletion({
  requiredMaterialSkuIds: ['ACC-1', 'ACC-2'],
  purchaseOrders: [{ orderNo: 'PO-A', materialSkuIds: ['ACC-1'], orderedAt: '' }],
})
assert.equal(blocked.completed, false)
assert.deepEqual(blocked.uncoveredMaterialSkuIds, ['ACC-2'])
assert.match(blocked.blockReason, /实际下单时间|未覆盖/)
```

- [ ] **步骤 3：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-purchase-linkage.spec.ts
```

预期：FAIL，新采购联动服务尚不存在。

- [ ] **步骤 4：实现采购联动和页面**

采购人员只输入采购单号；系统展示供应商、物料、数量、状态和实际下单时间。一张任务允许多个采购单，完成时间取有效采购单的最晚实际下单时间。

- [ ] **步骤 5：运行测试**

```bash
npm test -- tests/pcs-engineering-purchase-linkage.spec.ts
```

预期：PASS。

- [ ] **步骤 6：提交**

```bash
git add src/data/pcs-engineering-purchase-linkage.ts src/pages/pcs-engineering-tasks/purchase-task.ts src/data/pcs-engineering-master-repository.ts tests/pcs-engineering-purchase-linkage.spec.ts
git commit -m "feat(生产工程): 增加多采购单覆盖门禁"
```

---

### 任务 10：收紧技术包来源、审核失效、返工和正式快照

**文件：**

- 修改：`src/data/pcs-technical-data-version-types.ts`
- 修改：`src/data/pcs-technical-data-version-repository.ts`
- 修改：`src/data/pcs-tech-pack-task-generation.ts`
- 修改：`src/data/pcs-tech-pack-version-log-types.ts`
- 修改：`src/data/pcs-tech-pack-version-log-repository.ts`
- 修改：`src/data/pcs-tech-pack-review.ts`
- 修改：`src/data/pcs-tech-pack-review-diff.ts`
- 修改：`src/data/pcs-tech-pack-version-activation.ts`
- 修改：`src/pages/tech-pack/index.ts`
- 修改：`src/pages/tech-pack/events.ts`
- 修改：`src/data/pcs-engineering-master-repository.ts`
- 测试：`tests/pcs-engineering-tech-pack-linkage.spec.ts`

- [ ] **步骤 1：编写技术包来源失败测试**

```typescript
import assert from 'node:assert/strict'
import { createTechnicalDataVersion } from '../src/data/pcs-technical-data-version-repository.ts'

assert.throws(() => createTechnicalDataVersion({
  styleId: 'STYLE-1',
  createdFromTaskType: 'MANUAL' as never,
}), /工程主单|工程变更任务/)
```

- [ ] **步骤 2：编写价格变化审核失效测试**

```typescript
const next = invalidateReviewForBomPriceChange(versionId, {
  changedBomItemIds: ['BOM-1'],
  beforePriceCny: 12.34,
  afterPriceCny: 13.21,
})
assert.equal(next.buyerReview?.status, '待审核')
assert.equal(next.patternMakerReview?.status, '审核-已通过')
```

- [ ] **步骤 3：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-tech-pack-linkage.spec.ts
```

预期：FAIL；当前类型仍含 `MANUAL`／“手动新增”，审核失效未按模块控制。

- [ ] **步骤 4：删除手动来源并保留既有查询**

将新版本来源改为：

```typescript
export type TechPackSourceTaskType = 'ENGINEERING_MASTER' | 'ENGINEERING_CHANGE'
```

技术包列表不显示直接新增按钮；已经发布的记录仍可查询和查看，不提供导入、转换或人工绑定。

- [ ] **步骤 5：实现模块级审核失效和原任务返工**

价格变化只解锁 BOM、COST，并重置买手审核；纸样、花型或调色退回时，重新打开来源专业任务并增加返工轮次。返工完成后回到原技术包版本继续审核。

- [ ] **步骤 6：发布时形成正式快照**

正式发布时固化：

```typescript
{
  bomItems,
  materialPriceSnapshots,
  customCostsIdr,
  exchangeRateIdrPerCny,
  materialCostCny,
  comprehensiveCostCny,
  comprehensiveCostIdr,
  linkedPartTemplateVersions,
}
```

发布后锁定 BOM 与价格。

- [ ] **步骤 7：实现工程主单关闭门禁**

关闭只要求有效专业任务完成、固定依赖满足、正式技术包生效和快照有效。生产需求单、生产单、印花／染色加工单不是关闭门禁。

- [ ] **步骤 8：运行技术包检查**

```bash
npm test -- tests/pcs-engineering-tech-pack-linkage.spec.ts
npm run check:pcs-tech-pack-generation-entry
npm run check:pcs-tech-pack-generation-rules
npm run check:tech-pack-pcs-cutover
npm run check:tech-pack-garment-bom
```

预期：全部 PASS。

- [ ] **步骤 9：提交**

```bash
git add src/data/pcs-technical-data-version-types.ts src/data/pcs-technical-data-version-repository.ts src/data/pcs-tech-pack-task-generation.ts src/data/pcs-tech-pack-version-log-types.ts src/data/pcs-tech-pack-version-log-repository.ts src/data/pcs-tech-pack-review.ts src/data/pcs-tech-pack-review-diff.ts src/data/pcs-tech-pack-version-activation.ts src/pages/tech-pack/index.ts src/pages/tech-pack/events.ts src/data/pcs-engineering-master-repository.ts tests/pcs-engineering-tech-pack-linkage.spec.ts
git commit -m "feat(生产工程): 收紧技术包来源与关闭门禁"
```

---

### 任务 11：把生产准备时效改为工程事件的只读幂等投影

**文件：**

- 创建：`src/data/pcs-engineering-preparation-projection.ts`
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`
- 修改：`src/pages/production/preparation-timing.ts`
- 测试：`tests/pcs-engineering-preparation-projection.spec.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写 11 项投影失败测试**

```typescript
import assert from 'node:assert/strict'
import { projectEngineeringMasterToPreparation } from '../src/data/pcs-engineering-preparation-projection.ts'

const first = projectEngineeringMasterToPreparation(masterOrder)
const second = projectEngineeringMasterToPreparation(masterOrder)
assert.equal(first.items.length, 11)
assert.deepEqual(second, first, '重复投影必须幂等')
```

- [ ] **步骤 2：编写复用成果和返工时间测试**

```typescript
const item = first.items.find((row) => row.itemType === '梭织齐码纸样')!
assert.equal(item.reusedPriorResult, true)
assert.equal(item.actualStartAt, '')
assert.equal(item.actualFinishAt, '')
assert.equal(item.includedInDurationStats, false)

const reworked = projectEngineeringMasterToPreparation(masterWithRework)
assert.equal(reworked.items[0].firstFinishedAt, '2026-07-30 10:00')
assert.equal(reworked.items[0].effectiveFinishedAt, '2026-07-30 14:30')
```

- [ ] **步骤 3：运行测试确认失败**

```bash
npm test -- tests/pcs-engineering-preparation-projection.spec.ts
```

预期：FAIL，当前时效运行态仍允许确认准备项、上传成果和修改染色要求。

- [ ] **步骤 4：实现只读投影**

工程来源记录只由 `projectEngineeringMasterToPreparation()` 生成。准备项结构、责任团队、适用性、开始时间、首次完成时间和当前有效完成时间均取工程事件；重复事件按 `masterOrderId + taskId + roundNo` 去重。

- [ ] **步骤 5：删除工程来源记录的编辑动作**

在页面中隐藏并阻断确认准备项、修改准备项、上传专业成果、维护染色要求和审核动作；保留查看工程主单、专业任务、采购单和正式技术包链接。

- [ ] **步骤 6：运行时效验证**

```bash
npm test -- tests/pcs-engineering-preparation-projection.spec.ts
npm run check:production-preparation-timing
```

预期：PASS；工程来源记录完全只读。

- [ ] **步骤 7：提交**

```bash
git add src/data/pcs-engineering-preparation-projection.ts src/data/fcs/production-preparation-timing.ts src/data/fcs/production-preparation-timing-runtime.ts src/pages/production/preparation-timing.ts tests/pcs-engineering-preparation-projection.spec.ts scripts/check-production-preparation-timing.ts
git commit -m "feat(生产工程): 将准备时效收口为只读投影"
```

---

### 任务 12：总门禁、浏览器验收和任务收据

**文件：**

- 创建：`scripts/check-pcs-engineering-master.ts`
- 修改：`package.json`
- 更新：`docs/prototype-review-records/2026-07-30-pcs-production-engineering-master.md`

- [ ] **步骤 1：编写总门禁脚本**

总门禁依次执行：

```typescript
const checks = [
  'tests/pcs-work-item-module-removal.spec.ts',
  'tests/pcs-engineering-master-domain.spec.ts',
  'tests/pcs-engineering-dependency-policy.spec.ts',
  'tests/pcs-engineering-master-pages.spec.ts',
  'tests/pcs-engineering-task-status.spec.ts',
  'tests/pcs-engineering-material-review.spec.ts',
  'tests/pcs-engineering-bom-pricing.spec.ts',
  'tests/pcs-engineering-bom-task-linkage.spec.ts',
  'tests/pcs-engineering-purchase-linkage.spec.ts',
  'tests/pcs-engineering-tech-pack-linkage.spec.ts',
  'tests/pcs-engineering-preparation-projection.spec.ts',
]
```

任一检查失败时以非零状态退出。

- [ ] **步骤 2：增加 npm 命令**

```json
"check:pcs-engineering-master": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-pcs-engineering-master.ts"
```

- [ ] **步骤 3：运行全部目标门禁**

```bash
npm run check:pcs-engineering-master
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run check:menu-routes
npm run build
```

预期：全部退出码为 0。

- [ ] **步骤 4：CodeGraph 同步**

```bash
codegraph sync
codegraph status
```

预期：索引最新、无待同步文件；如工作树索引不匹配，先为当前实现 worktree 初始化独立索引再重新同步。

- [ ] **步骤 5：本地启动并完成浏览器验收**

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

至少验证：

1. 工程主单列表、创建、首次生产阻断。
2. 主单详情完整任务骨架、固定依赖和任务抽屉。
3. 花型／调色整单提交、逐项未通过、只返工未通过行。
4. BOM 无标准单价、无单位换算的阻断。
5. 人民币／印尼盾成本与汇率展示。
6. 多采购单覆盖和最晚下单时间。
7. 技术包审核退回原任务、正式发布和人工关闭主单。
8. 生产准备时效工程来源记录只读。
9. 1366×768 和 1280×720 下页面主体不横向溢出。
10. 弹窗、抽屉、分页和输入交互无整页闪烁，响应低于 200ms。

- [ ] **步骤 6：生成最终任务收据**

最后一次实质修改后执行：

```bash
npm run workflow:verify -- \
  --output /tmp/pcs-engineering-master-task-receipt.json \
  --task-boundary "PCS生产工程管理：工作项删除、工程主单、专业任务、BOM与价格、技术包、准备时效只读投影" \
  --stage-trace /tmp/pcs-engineering-master-stage-trace.json \
  --required-skills "superpowers-zh:subagent-driven-development,superpowers-zh:test-driven-development,superpowers-zh:verification-before-completion" \
  --require-two-stage-review
```

预期：收据状态为 `verified`，无阻断项。

- [ ] **步骤 7：提交最终收口**

```bash
git add scripts/check-pcs-engineering-master.ts package.json docs/prototype-review-records/2026-07-30-pcs-production-engineering-master.md
git commit -m "test(生产工程): 增加完整业务门禁"
```

---

## 三、分阶段审查点

### 审查点 A：任务 1–3

- 商品项目仍是逐步操作，不再依赖工作项或模板。
- 工作项、模板的页面、路由、数据和运行时均已删除。
- 工程主单唯一性、首次正式生产门禁、10 类专业任务完整骨架、11 个生产准备投影节点和固定依赖已成立。

### 审查点 B：任务 4–6

- 工程主单列表和泳道详情可演示。
- 专业任务统一状态生效，无暂停、取消和异常模块。
- 花型、调色按物料行审核，已通过行锁定，未通过行返工。

### 审查点 C：任务 7–9

- BOM 只读取物料档案标准单价，缺价格或换算关系时阻断。
- 人民币物料成本、印尼盾自定义费用及综合成本计算正确。
- 印花／染色只启用既有任务骨架。
- 多采购单覆盖和完成时间计算正确。

### 审查点 D：任务 10–12

- 技术包新版本不能手动新增。
- 十模块审核、局部失效、原任务返工和正式快照闭环。
- 工程主单人工关闭门禁正确。
- 生产准备时效只读、幂等、首次／当前有效完成时间正确。
- 全量门禁、浏览器验收、CodeGraph 和任务收据完成。

---

## 四、规格覆盖自检

| 规格范围 | 对应任务 |
| --- | --- |
| 删除工作项、工作项库和工作项模板 | 任务 1、2 |
| 商品项目保留固定五步逐步操作 | 任务 1 |
| 工程主单唯一性和首次正式生产 | 任务 3 |
| 10 类专业任务骨架、11 个生产准备投影节点、固定依赖和自动补齐 | 任务 3、11 |
| 工程主单列表、泳道工作台和分页治理 | 任务 4 |
| 专业任务统一状态、无暂停取消异常 | 任务 5 |
| 制版／样衣提交即完成 | 任务 5 |
| 花型／调色整单提交、逐项审核和返工 | 任务 6 |
| 花型成果逐物料生成资产 | 任务 6 |
| BOM 工艺字段、标准单价和单位换算 | 任务 7、8 |
| 人民币／印尼盾、汇率和正式快照 | 任务 7、10 |
| 多辅料采购单和最晚下单时间 | 任务 9 |
| 技术包十模块、现有审核流和返工 | 任务 10 |
| 正式技术包作为关闭依据 | 任务 10 |
| 生产需求／生产单不作为关闭门禁 | 任务 10 |
| 生产准备时效只读幂等投影 | 任务 11 |
| 前期成果复用不计时 | 任务 3、11 |
| 样衣管理暂缓 | 任务 5、12 的验收边界 |
