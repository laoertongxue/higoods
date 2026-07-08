# 生产单变更管理页面分层与数据闭环实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `/fcs/production/changes` 从“生产单、变更单、详情、发起动作混铺页面”调整为清晰的生产单变更单管理：列表页只查变更单，新增/编辑页用分步骤流程，详情页用 Tab 展示变更内容、生产影响、单据处理、料工费、时效、审核执行和记录，mock 数据从新增/发起动作形成闭环，并覆盖多次变更、多次补丁场景。

**架构：** 继续使用现有 Vite + TypeScript + Tailwind + Vanilla TypeScript 字符串模板架构，不引入新框架。以 `ProductionOrderChangeOrder` 作为主对象，版本关系变更和生产单层补丁作为变更单的结果和子事实；生产单版本关系列表只作为“待处理生产单 / 版本影响评估池”，不再和变更单列表混在同一阅读层级。新增、编辑、详情路由都复用现有 `changes-domain.ts` 和 `events.ts` 模式，数据仍放在 `production-tech-pack-change-domain.ts` 的本地 mock 内。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `src/components/ui/` 样式模式、本地 mock 数据、`tsx` 检查脚本、CodeGraph。

---

## 审查过的当前代码

执行本计划前已经审查以下代码路径：

- `src/data/fcs/production-tech-pack-change-domain.ts`
  - `ProductionOrderChangeOrder` 已存在，但当前 `productionOrderChangeOrders` 是静态场景 mock。
  - `listProductionOrderChangeOrders()` 只返回静态数组。
  - `submitProductionOrderTechPackChange()` 会创建 `ProductionOrderTechPackChangeRequest`，但不会创建变更单。
  - `submitProductionOrderPatch()` 会创建 `ProductionOrderPatch`，但不会创建变更单。
- `src/pages/production/changes-domain.ts`
  - `renderProductionChangesPage()` 当前同时渲染变更单列表、选中变更单详情、生产单版本关系列表。
  - `renderProductionChangeOrderList()` 当前在变更单行上展示 `查看详情 / 变更版本 / 发起补丁 / 日志`。
  - `renderSelectedChangeOrderDetail()` 当前嵌在列表页下方。
  - `renderProductionChangeDetailPage(productionOrderId)` 当前是生产单版本关系详情，不是变更单详情。
- `src/pages/production/events.ts`
  - `save-production-patch-draft` 只显示提示，不保存草稿。
  - `submit-tech-pack-version-change` 和 `submit-production-patch` 与变更单列表没有数据连接。
- `src/router/routes-fcs.ts`
  - 当前只有 `/fcs/production/changes` 和 `/fcs/production/changes/:id`，后者按生产单 ID 渲染。
- `scripts/check-production-order-changes.ts`
  - 已有检查覆盖 80 个场景、搜索联动、当前旧版列表嵌详情行为。

## 本次不做

- 不做真实后端、真实数据库、真实审批引擎。
- 不引入 React 页面体系、状态管理库、表单引擎或新 UI 框架。
- 不拆全局菜单结构，左侧菜单继续叫 `生产单变更管理`。
- 不把 80 个业务场景铺到页面上展示；场景目录留在数据和文档里，用于 mock 覆盖和检查。

## 文件结构

本计划只修改或新增以下文件：

```text
src/data/fcs/production-tech-pack-change-domain.ts
src/pages/production/context.ts
src/pages/production/changes-domain.ts
src/pages/production/events.ts
src/pages/production/core.ts
src/pages/production/list.ts
src/pages/production.ts
src/router/route-renderers-fcs.ts
src/router/routes-fcs.ts
scripts/check-production-order-changes.ts
package.json
docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md
```

职责分配：

- `production-tech-pack-change-domain.ts`：统一变更单主数据、版本关系变更、生产补丁、生产影响、单据处理、料工费、时效影响的 mock 闭环。
- `context.ts`：只增加页面分层所需的轻量状态，不引入全局 store。
- `changes-domain.ts`：渲染列表页、新增页、编辑页、变更单详情页、生产单版本关系诊断页。
- `events.ts`：处理列表 Tab、分页、详情 Tab、步骤页、提交、保存草稿、继续处理、追加变更。
- `routes-fcs.ts` 与 `route-renderers-fcs.ts`：补齐新增、编辑、详情、生产单关系诊断路由。
- `scripts/check-production-order-changes.ts`：作为本次验收脚本，先失败，逐任务修到通过。
- `package.json`：增加 `check:production-order-changes`。
- `docs/prototype-review-records/...md`：记录本次原型治理审查。

## 业务规则

- 列表页主对象是 `生产单变更单`，不是生产单。
- 新增页从业务意图开始，不要求业务人员先选择“版本关系变更”或“生产补丁”。
- 系统根据变更内容、期望生效口径、生产现场事实和已生成单据反推结果：
  - `VERSION_RELATION`：版本关系变更。
  - `PRODUCTION_PATCH`：生产单层补丁。
  - `VERSION_AND_PATCH`：版本关系变更 + 生产单层补丁。
  - `COST_ONLY`：仅料工费或结算差异。
  - `RECORD_ONLY`：仅记录影响。
- 一张生产单允许多张历史变更单。
- 同一生产单同一时间只允许一个进行中的版本关系变更。
- 同一生产单允许多个生产补丁，但同一模块、同一影响范围、同一生效点不能有两个未关闭补丁。
- 审核中只锁定受影响范围的冲突操作；高风险或主管选择整单暂停时才整单暂停。
- `立即止损` 只锁范围和通知，不代表最终变更已经完成。
- `立即执行` 只用于低风险、可逆、权限内、不影响结算或发货的处理项。
- `审核通过后执行` 用于版本关系、补丁、结算、发货、返工、已消耗物料、已交出工序、责任归因。

## Mock 数据补缺目标

当前已有 mock 数据的主要缺口：

- 变更单列表数据不是由新增/发起动作生成。
- 提交版本关系变更和提交生产补丁不会形成 `ProductionOrderChangeOrder`。
- 没有稳定保证“同一生产单多次变更”的样本。
- 没有稳定保证“同一生产单多次补丁，且补丁影响范围不冲突”的样本。
- 变更单、版本关系请求、生产补丁、受影响单据、料工费、时效影响之间缺少统一主键闭环。

补缺后必须满足：

- 至少 30 张 `ProductionOrderChangeOrder`。
- 至少 1 张生产单有 3 张以上变更单，覆盖版本关系变更、生产单层补丁、成本差异。
- 至少 1 张生产单有 2 个以上生产单层补丁，且模块或生效点不同。
- 至少 1 张变更单是 `VERSION_AND_PATCH`，并同时有版本关系请求和生产补丁子事实。
- 所有非 `RECORD_ONLY` 变更单都有单据处理行。
- 所有有成本差异或 `COST_ONLY` 变更单都有料工费差异行。
- 所有影响生产或履约的变更单都有时效影响行。
- 新增/保存草稿/提交版本变更/提交补丁会在变更单列表里出现对应记录。

---

## 任务 1：先重写验收检查脚本，让当前实现明确失败

**文件：**

- 修改：`scripts/check-production-order-changes.ts`
- 修改：`package.json`

- [ ] **步骤 1：替换检查脚本的页面结构断言**

把 `scripts/check-production-order-changes.ts` 顶部导入改为以下内容，先引用本计划要补齐的导出函数：

```ts
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  renderProductionChangeEditPage,
  renderProductionChangeNewPage,
  renderProductionChangeOrderDetailPage,
  renderProductionChangesPage,
} from '../src/pages/production/changes-domain.ts'
import { state } from '../src/pages/production/context.ts'
import {
  getProductionOrderChangeOrder,
  listProductionOrderChangeCostImpacts,
  listProductionOrderChangeDocumentActions,
  listProductionOrderChangeImpactRows,
  listProductionOrderChangeOrders,
  listProductionOrderChangeScenarioCatalog,
  listProductionOrderChangeTimingImpacts,
  listProductionOrderTechPackRelations,
  submitProductionOrderChangeOrder,
} from '../src/data/fcs/production-tech-pack-change-domain.ts'
```

将列表页基础断言替换为：

```ts
state.productionChangeListTab = 'change-orders'
state.techPackChangeKeyword = ''
state.productionChangeOrderPage = 1

const listHtml = renderProductionChangesPage()

;[
  '生产单变更管理',
  '新增变更',
  '变更单列表',
  '待处理生产单',
  '搜索生产单号 / 变更单号 / 需求单号 / SPU / 款式 / 负责人',
  '变更单号',
  '生产单号',
  '系统反推结果',
  '执行策略',
  '锁定状态',
].forEach((text) => {
  assert.ok(listHtml.includes(text), `列表页缺少「${text}」`)
})

assert.ok(!listHtml.includes('当前展示变更单详情'), '列表页不应内嵌变更单详情')
assert.ok(!listHtml.includes('系统读取的现场事实'), '列表页不应内嵌详情事实区')
assert.ok(!listHtml.includes('data-prod-action="open-tech-pack-version-change"'), '变更单列表不应直接展示变更版本按钮')
assert.ok(!listHtml.includes('data-prod-action="open-production-patch"'), '变更单列表不应直接展示发起补丁按钮')
assert.ok(!listHtml.includes('场景覆盖面板'), '业务场景覆盖说明应留在文档中，不应展示在页面')
assert.ok(!listHtml.includes('80 个场景'), '80 个业务场景目录不应作为页面演示信息展示')
```

- [ ] **步骤 2：增加新增页、编辑页、详情页断言**

在脚本中增加：

```ts
const newHtml = renderProductionChangeNewPage()
;['选择生产单', '填写变更内容', '系统计算影响', '确认单据处理', '料工费与时效', '提交审核'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少步骤「${text}」`)
})
assert.ok(newHtml.includes('系统反推，不要求业务人员先选版本关系或补丁'), '新增页必须说明系统反推口径')

const firstOrder = listProductionOrderChangeOrders()[0]
assert.ok(firstOrder, '至少需要一张变更单')

const detailHtml = renderProductionChangeOrderDetailPage(firstOrder.id)
;['变更内容', '生产影响', '单据处理', '料工费', '时效影响', '审核执行', '处理记录'].forEach((text) => {
  assert.ok(detailHtml.includes(text), `详情页缺少 Tab「${text}」`)
})
assert.ok(detailHtml.includes(firstOrder.id), '详情页必须展示变更单号')
assert.ok(!detailHtml.includes('变更单列表'), '详情页不应混入列表')

const editHtml = renderProductionChangeEditPage(firstOrder.id)
assert.ok(editHtml.includes('编辑变更单'), '编辑页必须展示编辑标题')
assert.ok(editHtml.includes(firstOrder.id), '编辑页必须展示当前变更单号')
```

- [ ] **步骤 3：增加 mock 数据闭环断言**

在脚本中增加：

```ts
const orders = listProductionOrderChangeOrders()
const scenarios = listProductionOrderChangeScenarioCatalog()
const impacts = listProductionOrderChangeImpactRows()
const documentActions = listProductionOrderChangeDocumentActions()
const costImpacts = listProductionOrderChangeCostImpacts()
const timingImpacts = listProductionOrderChangeTimingImpacts()

assert.equal(scenarios.length, 80, '生产单变更场景目录必须正好 80 条')
assert.ok(orders.length >= 30, '变更单样例至少 30 条')

const ordersByProductionOrder = new Map<string, number>()
orders.forEach((order) => {
  ordersByProductionOrder.set(order.productionOrderId, (ordersByProductionOrder.get(order.productionOrderId) ?? 0) + 1)
})
assert.ok([...ordersByProductionOrder.values()].some((count) => count >= 3), '必须覆盖同一生产单多次变更')

const versionAndPatchOrder = orders.find((order) => order.changeResult === 'VERSION_AND_PATCH')
assert.ok(versionAndPatchOrder, '必须覆盖版本关系变更 + 生产单层补丁')
assert.ok(versionAndPatchOrder.hasVersionRelationChange, '组合变更单必须包含版本关系变更标识')
assert.ok(versionAndPatchOrder.hasProductionPatch, '组合变更单必须包含生产补丁标识')

const documentActionIds = new Set(documentActions.map((row) => row.changeOrderId))
orders
  .filter((order) => order.changeResult !== 'RECORD_ONLY')
  .forEach((order) => {
    assert.ok(documentActionIds.has(order.id), `${order.id} 缺少单据处理明细`)
  })

const costIds = new Set(costImpacts.map((row) => row.changeOrderId))
orders
  .filter((order) => order.changeResult === 'COST_ONLY' || order.costDeltaAmount !== 0)
  .forEach((order) => {
    assert.ok(costIds.has(order.id), `${order.id} 缺少料工费差异`)
  })

const timingIds = new Set(timingImpacts.map((row) => row.changeOrderId))
orders
  .filter((order) => order.changeResult !== 'COST_ONLY' && order.changeResult !== 'RECORD_ONLY')
  .forEach((order) => {
    assert.ok(timingIds.has(order.id), `${order.id} 缺少时效影响`)
  })
```

- [ ] **步骤 4：增加新增动作写入列表的断言**

在脚本末尾增加：

```ts
const beforeCount = listProductionOrderChangeOrders().length
const relation = listProductionOrderTechPackRelations()[0]
assert.ok(relation, '至少需要一张生产单版本关系样本')

const created = submitProductionOrderChangeOrder({
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  changeModules: ['BOM'],
  reason: '自动检查：主面料短缺，指定后续领料改用替代料。',
  expectedEffectiveMode: 'FROM_NEXT_PICKUP',
  effectiveDescription: '从下一次领料开始',
  changeResult: 'PRODUCTION_PATCH',
  executionStrategy: 'AFTER_APPROVAL',
  operatorName: '自动检查',
})

assert.equal(listProductionOrderChangeOrders().length, beforeCount + 1, '新增变更必须进入变更单列表')
assert.equal(getProductionOrderChangeOrder(created.id)?.id, created.id, '新增变更必须可按变更单号查询')
assert.ok(listProductionOrderChangeDocumentActions(created.id).length > 0, '新增变更必须生成单据处理建议')
```

- [ ] **步骤 5：增加治理记录和菜单断言**

在脚本末尾保留并更新：

```ts
const appShellConfig = fs.readFileSync(path.resolve(process.cwd(), 'src/data/app-shell-config.ts'), 'utf8')
assert.ok(appShellConfig.includes('生产单变更管理'), '菜单配置必须包含「生产单变更管理」')
assert.ok(!appShellConfig.includes('生产单变更影响台账'), '菜单配置不应包含「生产单变更影响台账」')

assert.ok(
  fs.existsSync(path.resolve(process.cwd(), 'docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md')),
  '缺少生产单变更管理 IA 重构原型审查记录',
)

console.log('production order changes check passed')
```

- [ ] **步骤 6：把检查脚本加入 package.json**

在 `package.json` 的 `scripts` 中加入：

```json
"check:production-order-changes": "tsx scripts/check-production-order-changes.ts"
```

- [ ] **步骤 7：运行检查，确认失败**

运行：

```bash
npm run check:production-order-changes
```

预期：FAIL，报错包含缺少 `renderProductionChangeNewPage`、`renderProductionChangeOrderDetailPage`、`submitProductionOrderChangeOrder` 中至少一个导出。

- [ ] **步骤 8：Commit**

```bash
git add scripts/check-production-order-changes.ts package.json
git commit -m "test: 收紧生产单变更页面分层验收"
```

## 任务 2：修正数据层，让变更单成为主对象

**文件：**

- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`

- [ ] **步骤 1：增加提交输入类型**

在 `ProductionOrderChangeOrder` 接口后增加：

```ts
export interface ProductionOrderChangeOrderSubmitInput {
  productionOrderId: string
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  reason: string
  expectedEffectiveMode: ChangeEffectiveMode
  effectiveDescription: string
  changeResult: ProductionOrderChangeResult
  executionStrategy: ProductionOrderChangeExecutionStrategy
  operatorName: string
  linkedVersionChangeRequestId?: string
  linkedPatchId?: string
}
```

- [ ] **步骤 2：把变更单和明细数组改为可追加**

只改声明关键字，不改右侧表达式。执行以下 5 个机械替换：

```text
const productionOrderChangeOrders: ProductionOrderChangeOrder[] =
let productionOrderChangeOrders: ProductionOrderChangeOrder[] =

const productionOrderChangeImpactRows: ProductionOrderChangeImpactRow[] =
let productionOrderChangeImpactRows: ProductionOrderChangeImpactRow[] =

const productionOrderChangeDocumentActions: ProductionOrderChangeDocumentAction[] =
let productionOrderChangeDocumentActions: ProductionOrderChangeDocumentAction[] =

const productionOrderChangeCostImpacts: ProductionOrderChangeCostImpact[] =
let productionOrderChangeCostImpacts: ProductionOrderChangeCostImpact[] =

const productionOrderChangeTimingImpacts: ProductionOrderChangeTimingImpact[] =
let productionOrderChangeTimingImpacts: ProductionOrderChangeTimingImpact[] =
```

- [ ] **步骤 3：补齐同一生产单多次变更和多次补丁 seed**

在 `productionOrderChangeOrderPlans` 中追加以下稳定样本：

```ts
  {
    scenarioId: 'SCN-003',
    changeResult: 'VERSION_AND_PATCH',
    productionOrderId: 'PO-202603-0004',
    id: 'CHANGE-PO-202603-0004-002',
  },
  {
    scenarioId: 'SCN-021',
    changeResult: 'COST_ONLY',
    productionOrderId: 'PO-202603-0004',
    id: 'CHANGE-PO-202603-0004-003',
  },
  {
    scenarioId: 'SCN-017',
    changeResult: 'PRODUCTION_PATCH',
    productionOrderId: 'PO-202603-0013',
    id: 'CHANGE-PO-202603-0013-002',
  },
  {
    scenarioId: 'SCN-025',
    changeResult: 'PRODUCTION_PATCH',
    productionOrderId: 'PO-202603-0013',
    id: 'CHANGE-PO-202603-0013-003',
  },
  {
    scenarioId: 'SCN-080',
    changeResult: 'RECORD_ONLY',
    productionOrderId: 'PO-202603-0013',
    id: 'CHANGE-PO-202603-0013-004',
  },
```

- [ ] **步骤 4：增加变更单查询函数**

在 `listProductionOrderChangeOrders()` 后增加：

```ts
export function getProductionOrderChangeOrder(changeOrderId: string): ProductionOrderChangeOrder | null {
  const order = productionOrderChangeOrders.find((item) => item.id === changeOrderId)
  return order ? clone(order) : null
}

export function listProductionOrderChangeOrdersByProductionOrder(
  productionOrderId: string,
): ProductionOrderChangeOrder[] {
  return clone(productionOrderChangeOrders.filter((item) => item.productionOrderId === productionOrderId))
}
```

- [ ] **步骤 5：增加新增变更单的单据处理构造函数**

在 `buildProductionOrderChangeDocumentAction()` 后增加：

```ts
function buildSubmittedChangeOrderDocumentActions(
  order: ProductionOrderChangeOrder,
): ProductionOrderChangeDocumentAction[] {
  const scenario = productionOrderChangeScenarioCatalog.find((item) => item.id === order.scenarioId)
  const documents = scenario?.mainAffectedDocuments.length
    ? scenario.mainAffectedDocuments
    : getScenarioDocuments(order.reason, order.changeResult)

  return documents.map((documentType, index) =>
    buildProductionOrderChangeDocumentAction(
      order,
      documentType,
      productionOrderChangeDocumentActions.length + index,
    ),
  )
}
```

- [ ] **步骤 6：增加新增变更单的影响、成本、时效构造函数**

在成本和时效构造区前增加：

```ts
function appendSubmittedChangeOrderChildren(order: ProductionOrderChangeOrder): void {
  if (order.changeResult !== 'COST_ONLY' && order.changeResult !== 'RECORD_ONLY') {
    productionOrderChangeImpactRows = [
      buildProductionOrderChangeImpactRow(order, productionOrderChangeImpactRows.length, 0),
      ...productionOrderChangeImpactRows,
    ].map((row, index) => ({ ...row, id: `IMPACT-${String(index + 1).padStart(3, '0')}` }))
  }

  productionOrderChangeDocumentActions = [
    ...buildSubmittedChangeOrderDocumentActions(order),
    ...productionOrderChangeDocumentActions,
  ].map((row, index) => ({ ...row, id: `DOC-ACT-${String(index + 1).padStart(3, '0')}` }))

  if (order.changeResult === 'COST_ONLY' || order.costDeltaAmount !== 0) {
    productionOrderChangeCostImpacts = [
      {
        id: `COST-IMPACT-${String(productionOrderChangeCostImpacts.length + 1).padStart(3, '0')}`,
        changeOrderId: order.id,
        costType: order.changeResult === 'COST_ONLY' ? 'FEE' : 'MATERIAL',
        itemName: order.changeResult === 'COST_ONLY' ? '结算补差费用' : '主面料替代差价',
        estimatedAmount: Math.abs(order.costDeltaAmount || 800),
        actualAmount: Math.abs(order.costDeltaAmount || 800),
        responsibleParty: order.changeResult === 'COST_ONLY' ? '财务结算 / 买手' : '物料计划 / 供应商',
        settlementHandling: '进入本次结算差异，需保留变更单、主管确认和责任归因记录。',
      },
      ...productionOrderChangeCostImpacts,
    ]
  }

  if (order.changeResult !== 'COST_ONLY' && order.changeResult !== 'RECORD_ONLY') {
    productionOrderChangeTimingImpacts = [
      {
        id: `TIME-IMPACT-${String(productionOrderChangeTimingImpacts.length + 1).padStart(3, '0')}`,
        changeOrderId: order.id,
        timingNode: 'PICKING',
        originalTime: nowText(),
        newEstimatedTime: nowText(),
        delayDays: order.delayDays,
        affectsProductionDelivery: order.delayDays > 0,
        affectsFulfillmentDelivery: order.delayDays >= 3,
        responsibleParty: '生产计划',
        recoveryAction: order.executionStrategy === 'IMMEDIATE_STOP_LOSS'
          ? '先锁定影响范围，追回未完成批次，主管确认后释放。'
          : '优先处理未开工范围，已完成部分保留追溯记录。',
      },
      ...productionOrderChangeTimingImpacts,
    ]
  }
}
```

- [ ] **步骤 7：增加统一提交函数**

在查询函数后增加：

```ts
export function submitProductionOrderChangeOrder(
  input: ProductionOrderChangeOrderSubmitInput,
): ProductionOrderChangeOrder {
  const relation = ensureMutableRelationWithEvaluation(input.productionOrderId)
  if (!relation) throw new Error('未找到生产单技术包版本关系。')
  if (!input.reason.trim()) throw new Error('变更原因不能为空。')
  if (input.changeModules.length === 0) throw new Error('至少需要一个变更模块。')

  const activeSameOrderVersionChange = productionOrderChangeOrders.some((order) =>
    order.productionOrderId === input.productionOrderId &&
    order.hasVersionRelationChange &&
    ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'EXECUTING'].includes(order.status),
  )
  if (input.changeResult !== 'PRODUCTION_PATCH' && activeSameOrderVersionChange) {
    throw new Error('同一生产单已有进行中的版本关系变更。')
  }

  const createdAt = nowText()
  const sequence = productionOrderChangeOrders.filter((item) => item.productionOrderId === input.productionOrderId).length + 1
  const id = `CHANGE-${input.productionOrderId}-${String(sequence).padStart(3, '0')}`
  const scenario = productionOrderChangeScenarioCatalog.find((item) => item.expectedResult === input.changeResult)
  const hasVersionRelationChange = input.changeResult === 'VERSION_RELATION' || input.changeResult === 'VERSION_AND_PATCH'
  const hasProductionPatch = input.changeResult === 'PRODUCTION_PATCH' || input.changeResult === 'VERSION_AND_PATCH'
  const costDeltaAmount = input.changeResult === 'COST_ONLY' ? 1200 : input.changeModules.includes('COST') ? 800 : 0
  const delayDays = input.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 2 : input.executionStrategy === 'AFTER_APPROVAL' ? 1 : 0

  const order: ProductionOrderChangeOrder = {
    id,
    scenarioId: scenario?.id ?? 'SCN-080',
    productionOrderId: relation.productionOrderId,
    demandOrderId: relation.demandOrderNo,
    spuCode: relation.spuCode,
    styleName: relation.styleName,
    buyerName: relation.buyerName,
    merchandiserName: relation.merchandiserName,
    source: input.source,
    changeModules: [...input.changeModules],
    reason: input.reason,
    expectedEffectiveMode: input.expectedEffectiveMode,
    effectiveDescription: input.effectiveDescription,
    changeResult: input.changeResult,
    executionStrategy: input.executionStrategy,
    lockStatus: input.executionStrategy === 'IMMEDIATE_STOP_LOSS' ? 'WHOLE_ORDER_PAUSED' : 'IMPACT_SCOPE_LOCKED',
    status: input.executionStrategy === 'IMMEDIATE_EXECUTION' ? 'EXECUTING' : 'SUBMITTED',
    hasVersionRelationChange,
    hasProductionPatch,
    affectedDocumentCount: Math.max(1, getScenarioDocuments(input.reason, input.changeResult).length),
    costDeltaAmount,
    delayDays,
    createdBy: input.operatorName,
    createdAt,
    reviewer: input.changeResult === 'COST_ONLY' ? '财务主管' : '生产主管',
    latestLog: `${productionOrderChangeResultLabels[input.changeResult]}已生成处理清单，${productionOrderChangeExecutionStrategyLabels[input.executionStrategy]}。`,
  }

  productionOrderChangeOrders = [order, ...productionOrderChangeOrders]
  appendSubmittedChangeOrderChildren(order)
  return clone(order)
}
```

- [ ] **步骤 8：让版本关系提交同时创建变更单**

在 `submitProductionOrderTechPackChange()` 创建 request 后、return 前加入：

```ts
  submitProductionOrderChangeOrder({
    productionOrderId: relation.productionOrderId,
    source: 'TECH_PACK_NEW_VERSION',
    changeModules: buildTechPackDiffItemsForRelation(relation).map((item) => item.module),
    reason: input.reason,
    expectedEffectiveMode: input.effectiveMode,
    effectiveDescription: effectiveModeLabels[input.effectiveMode],
    changeResult: 'VERSION_RELATION',
    executionStrategy: 'AFTER_APPROVAL',
    operatorName: input.operatorName,
    linkedVersionChangeRequestId: request.changeRequestId,
  })
```

- [ ] **步骤 9：让补丁提交同时创建变更单**

在 `submitProductionOrderPatch()` 创建 patch 后、return 前加入：

```ts
  submitProductionOrderChangeOrder({
    productionOrderId: relation.productionOrderId,
    source: 'MATERIAL_SHORTAGE',
    changeModules: [patch.affectedModule],
    reason: input.reason,
    expectedEffectiveMode: patch.effectivePoint === 'NEXT_PICKING' ? 'FROM_NEXT_PICKUP' : 'FROM_NEXT_PREP',
    effectiveDescription: patchEffectivePointLabels[patch.effectivePoint],
    changeResult: 'PRODUCTION_PATCH',
    executionStrategy: 'AFTER_APPROVAL',
    operatorName: input.operatorName,
    linkedPatchId: patch.patchId,
  })
```

- [ ] **步骤 10：运行检查，确认数据层相关断言前进**

运行：

```bash
npm run check:production-order-changes
```

预期：仍然 FAIL，失败点应转移到页面导出、路由或页面结构断言，不再是 `submitProductionOrderChangeOrder` 缺失。

- [ ] **步骤 11：Commit**

```bash
git add src/data/fcs/production-tech-pack-change-domain.ts
git commit -m "feat: 统一生产单变更单数据闭环"
```

## 任务 3：增加页面分层状态和路由

**文件：**

- 修改：`src/pages/production/context.ts`
- 修改：`src/pages/production/core.ts`
- 修改：`src/pages/production/list.ts`
- 修改：`src/pages/production.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/routes-fcs.ts`

- [ ] **步骤 1：在 context.ts 增加状态类型**

在已有 `TechPackChangeDetailTab` 附近增加：

```ts
type ProductionChangeListTab = 'change-orders' | 'candidate-orders'
type ProductionChangeDetailTab = 'content' | 'impact' | 'documents' | 'cost' | 'timing' | 'approval' | 'records'
type ProductionChangeFormStep = 'order' | 'content' | 'impact' | 'documents' | 'cost-timing' | 'submit'

interface ProductionChangeForm {
  productionOrderId: string
  source: string
  modules: string[]
  reason: string
  effectiveMode: string
  executionStrategy: string
  changeResult: string
}
```

在 `ProductionState` 中增加：

```ts
  productionChangeListTab: ProductionChangeListTab
  productionChangeDetailTab: ProductionChangeDetailTab
  productionChangeFormStep: ProductionChangeFormStep
  productionChangeForm: ProductionChangeForm
  productionChangeFormError: string
```

- [ ] **步骤 2：增加默认表单和初始 state**

在空表单常量区增加：

```ts
const PRODUCTION_CHANGE_EMPTY_FORM: ProductionChangeForm = {
  productionOrderId: '',
  source: 'TECH_PACK_NEW_VERSION',
  modules: ['BOM'],
  reason: '',
  effectiveMode: 'FROM_NEXT_PREP',
  executionStrategy: 'AFTER_APPROVAL',
  changeResult: 'PRODUCTION_PATCH',
}
```

在 `state` 初始值中增加：

```ts
  productionChangeListTab: 'change-orders',
  productionChangeDetailTab: 'content',
  productionChangeFormStep: 'order',
  productionChangeForm: { ...PRODUCTION_CHANGE_EMPTY_FORM },
  productionChangeFormError: '',
```

在导出区增加：

```ts
  PRODUCTION_CHANGE_EMPTY_FORM,
  ProductionChangeForm,
  ProductionChangeFormStep,
  ProductionChangeDetailTab,
  ProductionChangeListTab,
```

- [ ] **步骤 3：在页面导出文件增加新函数导出**

在 `src/pages/production/core.ts` 的 `changes-domain` 导出中改为：

```ts
export {
  renderProductionChangeEditPage,
  renderProductionChangeNewPage,
  renderProductionChangeOrderDetailPage,
  renderProductionChangeRelationDetailPage,
  renderProductionChangesPage,
} from './changes-domain'
```

在 `src/pages/production/list.ts` 和 `src/pages/production.ts` 做同样导出。

- [ ] **步骤 4：在 route-renderers-fcs.ts 增加异步渲染器**

加入：

```ts
export const renderProductionChangeNewPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeNewPage',
)
export const renderProductionChangeEditPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeEditPage',
)
export const renderProductionChangeOrderDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeOrderDetailPage',
)
export const renderProductionChangeRelationDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeRelationDetailPage',
)
```

- [ ] **步骤 5：在 routes-fcs.ts 增加路由，顺序必须在泛匹配前**

在静态路由中保留：

```ts
'/fcs/production/changes': () => renderProductionChangesPage(),
'/fcs/production/changes/new': () => renderProductionChangeNewPage(),
```

在动态路由中，将生产单变更相关 route 调整为：

```ts
    {
      pattern: /^\/fcs\/production\/changes\/orders\/([^/]+)$/,
      render: (match) => renderProductionChangeRelationDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/production\/changes\/([^/]+)\/edit$/,
      render: (match) => renderProductionChangeEditPage(match[1]),
    },
    {
      pattern: /^\/fcs\/production\/changes\/([^/]+)$/,
      render: (match) => renderProductionChangeOrderDetailPage(match[1]),
    },
```

- [ ] **步骤 6：运行检查确认路由导出错误减少**

运行：

```bash
npm run check:production-order-changes
```

预期：仍然 FAIL，失败点应是页面内容缺失。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/production/context.ts src/pages/production/core.ts src/pages/production/list.ts src/pages/production.ts src/router/route-renderers-fcs.ts src/router/routes-fcs.ts
git commit -m "feat: 增加生产单变更分层路由"
```

## 任务 4：重做列表页，只保留列表和待处理来源池

**文件：**

- 修改：`src/pages/production/changes-domain.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：在 changes-domain.ts 导入新增数据函数**

将数据导入补齐：

```ts
  getProductionOrderChangeOrder,
  listProductionOrderChangeOrdersByProductionOrder,
```

- [ ] **步骤 2：新增列表页 Tab 渲染**

在 `renderProductionChangeSearchBar()` 后增加：

```ts
function renderProductionChangeListTabs(): string {
  const tabs = [
    { key: 'change-orders', label: '变更单' },
    { key: 'candidate-orders', label: '待处理生产单' },
  ] as const
  return `
    <div class="inline-flex rounded-lg border bg-muted/30 p-1">
      ${tabs.map((tab) => `
        <button
          class="rounded-md px-3 py-1.5 text-sm ${state.productionChangeListTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          data-prod-action="switch-production-change-list-tab"
          data-tab="${tab.key}"
        >${escapeHtml(tab.label)}</button>
      `).join('')}
    </div>
  `
}
```

- [ ] **步骤 3：替换变更单列表行操作**

在 `renderProductionChangeOrderList()` 中将动作列替换为：

```ts
function renderProductionChangeOrderRowActions(order: ProductionOrderChangeOrderView): string {
  const canEdit = order.status === 'DRAFT' || order.status === 'RETURNED'
  const canWithdraw = order.status === 'SUBMITTED' || order.status === 'UNDER_REVIEW'
  return `
    <div class="flex min-w-[120px] flex-wrap gap-1.5">
      <button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="/fcs/production/changes/${escapeHtml(order.id)}">查看</button>
      ${canEdit ? `<button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="/fcs/production/changes/${escapeHtml(order.id)}/edit">继续处理</button>` : ''}
      ${canWithdraw ? `<button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="withdraw-production-change-order" data-change-order-id="${escapeHtml(order.id)}">撤回</button>` : ''}
      <button class="rounded-md px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="open-production-change-history" data-order-id="${escapeHtml(order.productionOrderId)}">日志</button>
    </div>
  `
}
```

并把动作列中的旧按钮替换为：

```ts
${renderProductionChangeOrderRowActions(order)}
```

- [ ] **步骤 4：新增待处理生产单列表**

在 `renderProductionChangeOrderList()` 后增加：

```ts
function renderProductionChangeCandidateOrders(relations: ProductionOrderTechPackRelation[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-background">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">待处理生产单</h2>
          <p class="mt-1 text-sm text-muted-foreground">用于发现哪些生产单需要发起变更，不是变更单列表。</p>
        </div>
      </div>
      ${renderChangeTable(
        ['生产单号', '款式 / SPU', '冻结版本', '最新正式版', '版本关系状态', '补丁', '操作'],
        relations.map((relation) => `
          <tr class="align-top hover:bg-muted/20">
            <td class="px-3 py-3 font-medium">${escapeHtml(relation.productionOrderNo)}</td>
            <td class="px-3 py-3"><p class="font-medium">${escapeHtml(relation.styleName)}</p><p class="text-xs text-muted-foreground">${escapeHtml(relation.spuCode)}</p></td>
            <td class="px-3 py-3">${escapeHtml(relation.currentTechPackVersionNo)}</td>
            <td class="px-3 py-3">${escapeHtml(relation.latestPublishedTechPackVersionNo)}</td>
            <td class="px-3 py-3">${escapeHtml(techPackRelationStatusLabels[relation.relationStatus])}</td>
            <td class="px-3 py-3">生效 ${relation.activePatchCount} / 待审 ${relation.pendingPatchCount}</td>
            <td class="px-3 py-3">
              <div class="flex min-w-[132px] flex-wrap gap-1.5">
                <button class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-prod-action="start-production-change-from-order" data-order-id="${escapeHtml(relation.productionOrderId)}">发起变更</button>
                <button class="rounded-md px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="/fcs/production/changes/orders/${escapeHtml(relation.productionOrderId)}">查看关系</button>
              </div>
            </td>
          </tr>
        `),
        '暂无待处理生产单',
        'min-w-[1200px]',
      )}
    </section>
  `
}
```

- [ ] **步骤 5：改写 renderProductionChangesPage**

把 `renderProductionChangesPage()` 主体调整为：

```ts
export function renderProductionChangesPage(): string {
  syncPublishGuideFromRoute()
  const relations = getFilteredRelations()
  const allRelations = listProductionOrderTechPackRelations()
  const keyword = state.techPackChangeKeyword.trim().toLowerCase()
  const changeOrders = listProductionOrderChangeOrders().filter((order) => matchesChangeOrderKeyword(order, keyword))
  const currentVersions = Array.from(new Set(allRelations.map((item) => item.currentTechPackVersionNo)))
  const owners = Array.from(new Set(allRelations.map((item) => item.merchandiserName)))

  return `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">生产单变更管理</h1>
          <p class="mt-1 text-sm text-muted-foreground">按变更单管理生产影响、单据处理、料工费差异、时效影响和审核执行闭环。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="/fcs/production/changes/new">新增变更</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack-publish-guide">查看发布待评估</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="export-tech-pack-change">导出</button>
        </div>
      </header>

      ${renderProductionChangeSearchBar()}
      ${renderProductionChangeStatCards({
        scenarios: listProductionOrderChangeScenarioCatalog(),
        orders: changeOrders,
        impacts: listProductionOrderChangeImpactRows(),
        documentActions: listProductionOrderChangeDocumentActions(),
        costImpacts: listProductionOrderChangeCostImpacts(),
        timingImpacts: listProductionOrderChangeTimingImpacts(),
      })}
      ${renderProductionChangeListTabs()}

      ${state.productionChangeListTab === 'change-orders'
        ? renderProductionChangeOrderList(changeOrders, '')
        : `
          ${renderProductionRelationFilters(currentVersions, owners)}
          ${renderProductionChangeCandidateOrders(relations)}
        `}

      ${renderPublishGuideDialog()}
      ${renderModuleLandingDialog()}
    </div>
  `
}
```

同时把原生产单筛选控件抽成：

```ts
function renderProductionRelationFilters(currentVersions: string[], owners: string[]): string {
  return `
    <section class="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-3 xl:grid-cols-7">
      <select data-prod-field="techPackChangeCurrentVersionFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '全部冻结版本', state.techPackChangeCurrentVersionFilter)}
        ${currentVersions.map((version) => renderSelectOption(version, version, state.techPackChangeCurrentVersionFilter)).join('')}
      </select>
      <select data-prod-field="techPackChangeNewVersionFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '是否存在新正式版', state.techPackChangeNewVersionFilter)}
        ${renderSelectOption('YES', '有新正式版', state.techPackChangeNewVersionFilter)}
        ${renderSelectOption('NO', '无新正式版', state.techPackChangeNewVersionFilter)}
      </select>
      <select data-prod-field="techPackChangePatchFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '是否存在补丁', state.techPackChangePatchFilter)}
        ${renderSelectOption('ACTIVE', '有生效补丁', state.techPackChangePatchFilter)}
        ${renderSelectOption('PENDING', '有待审核补丁', state.techPackChangePatchFilter)}
        ${renderSelectOption('NONE', '无补丁', state.techPackChangePatchFilter)}
      </select>
      <select data-prod-field="techPackChangeStatusFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '版本关系状态', state.techPackChangeStatusFilter)}
        ${(Object.keys(techPackRelationStatusLabels) as TechPackRelationStatus[]).map((status) => renderSelectOption(status, techPackRelationStatusLabels[status], state.techPackChangeStatusFilter)).join('')}
      </select>
      <select data-prod-field="techPackChangeModuleFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '影响模块', state.techPackChangeModuleFilter)}
        ${(Object.keys(techPackChangeModuleLabels) as TechPackChangeModule[]).map((module) => renderSelectOption(module, techPackChangeModuleLabels[module], state.techPackChangeModuleFilter)).join('')}
      </select>
      <select data-prod-field="techPackChangeProgressFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '生产进度', state.techPackChangeProgressFilter)}
        ${progressFilterOptions.map((item) => renderSelectOption(item, item, state.techPackChangeProgressFilter)).join('')}
      </select>
      <select data-prod-field="techPackChangeOwnerFilter" class="rounded-md border px-3 py-2 text-sm">
        ${renderSelectOption('ALL', '跟单负责人', state.techPackChangeOwnerFilter)}
        ${owners.map((owner) => renderSelectOption(owner, owner, state.techPackChangeOwnerFilter)).join('')}
      </select>
    </section>
  `
}
```

- [ ] **步骤 6：在 events.ts 增加列表 Tab 和从生产单发起变更**

在生产变更 action 区增加：

```ts
  if (action === 'switch-production-change-list-tab') {
    const tab = actionNode.dataset.tab as ProductionState['productionChangeListTab'] | undefined
    if (tab === 'change-orders' || tab === 'candidate-orders') {
      state.productionChangeListTab = tab
      state.productionChangeOrderPage = 1
    }
    return true
  }

  if (action === 'start-production-change-from-order') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.productionChangeForm = {
      ...PRODUCTION_CHANGE_EMPTY_FORM,
      productionOrderId: orderId,
    }
    state.productionChangeFormStep = 'content'
    state.productionChangeFormError = ''
    openAppRoute('/fcs/production/changes/new', 'production-change-new', '新增生产单变更')
    return true
  }
```

- [ ] **步骤 7：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：列表页断言通过；新增页和详情页仍可能失败。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/production/changes-domain.ts src/pages/production/events.ts
git commit -m "feat: 拆分生产单变更列表和待处理来源池"
```

## 任务 5：新增和编辑分步骤页面

**文件：**

- 修改：`src/pages/production/changes-domain.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：在 changes-domain.ts 增加步骤定义**

加入：

```ts
const productionChangeFormSteps = [
  { key: 'order', label: '选择生产单' },
  { key: 'content', label: '填写变更内容' },
  { key: 'impact', label: '系统计算影响' },
  { key: 'documents', label: '确认单据处理' },
  { key: 'cost-timing', label: '料工费与时效' },
  { key: 'submit', label: '提交审核' },
] as const
```

- [ ] **步骤 2：增加步骤头**

加入：

```ts
function renderProductionChangeFormSteps(): string {
  const currentIndex = productionChangeFormSteps.findIndex((step) => step.key === state.productionChangeFormStep)
  return `
    <div class="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-6">
      ${productionChangeFormSteps.map((step, index) => `
        <button
          class="rounded-md px-3 py-2 text-left text-sm ${index === currentIndex ? 'bg-blue-50 text-blue-700' : index < currentIndex ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/40 text-muted-foreground'}"
          data-prod-action="set-production-change-form-step"
          data-step="${step.key}"
        >
          <span class="block text-xs">步骤 ${index + 1}</span>
          <span class="font-medium">${escapeHtml(step.label)}</span>
        </button>
      `).join('')}
    </div>
  `
}
```

- [ ] **步骤 3：增加表单主体**

加入：

```ts
function renderProductionChangeFormBody(): string {
  const form = state.productionChangeForm
  if (state.productionChangeFormStep === 'order') {
    const relations = listProductionOrderTechPackRelations()
    return `
      <section class="rounded-lg border bg-background p-4">
        <h2 class="text-base font-semibold">选择生产单</h2>
        <select class="mt-3 w-full rounded-md border px-3 py-2 text-sm" data-prod-field="productionChangeFormProductionOrderId">
          ${renderSelectOption('', '请选择生产单', form.productionOrderId)}
          ${relations.map((relation) => renderSelectOption(relation.productionOrderId, `${relation.productionOrderNo} / ${relation.styleName}`, form.productionOrderId)).join('')}
        </select>
        <p class="mt-3 rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">系统反推，不要求业务人员先选版本关系或补丁。</p>
      </section>
    `
  }

  if (state.productionChangeFormStep === 'content') {
    return `
      <section class="rounded-lg border bg-background p-4">
        <h2 class="text-base font-semibold">填写变更内容</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <select class="rounded-md border px-3 py-2 text-sm" data-prod-field="productionChangeFormSource">
            ${(Object.keys(productionOrderChangeSourceLabels) as Array<keyof typeof productionOrderChangeSourceLabels>).map((source) => renderSelectOption(source, productionOrderChangeSourceLabels[source], form.source)).join('')}
          </select>
          <select class="rounded-md border px-3 py-2 text-sm" data-prod-field="productionChangeFormResult">
            ${(Object.keys(productionOrderChangeResultLabels) as Array<keyof typeof productionOrderChangeResultLabels>).map((result) => renderSelectOption(result, productionOrderChangeResultLabels[result], form.changeResult)).join('')}
          </select>
          <select class="rounded-md border px-3 py-2 text-sm" data-prod-field="productionChangeFormEffectiveMode">
            ${(Object.keys(effectiveModeLabels) as Array<keyof typeof effectiveModeLabels>).map((mode) => renderSelectOption(mode, effectiveModeLabels[mode], form.effectiveMode)).join('')}
          </select>
          <select class="rounded-md border px-3 py-2 text-sm" data-prod-field="productionChangeFormExecutionStrategy">
            ${(Object.keys(productionOrderChangeExecutionStrategyLabels) as Array<keyof typeof productionOrderChangeExecutionStrategyLabels>).map((strategy) => renderSelectOption(strategy, productionOrderChangeExecutionStrategyLabels[strategy], form.executionStrategy)).join('')}
          </select>
        </div>
        <textarea class="mt-3 min-h-[112px] w-full rounded-md border px-3 py-2 text-sm" data-prod-field="productionChangeFormReason" placeholder="填写业务原因、期望生效范围和主管确认口径">${escapeHtml(form.reason)}</textarea>
      </section>
    `
  }

  if (state.productionChangeFormStep === 'impact') {
    return `
      <section class="rounded-lg border bg-background p-4">
        <h2 class="text-base font-semibold">系统计算影响</h2>
        <p class="mt-2 text-sm text-muted-foreground">系统按当前生产进度、已生成单据、已领料、已消耗和已结算事实生成影响范围。</p>
        ${renderProductionImpactTable([])}
      </section>
    `
  }

  if (state.productionChangeFormStep === 'documents') {
    return `
      <section class="rounded-lg border bg-background p-4">
        <h2 class="text-base font-semibold">确认单据处理</h2>
        <p class="mt-2 text-sm text-muted-foreground">业务可改选系统建议；改选后必须记录原因和责任人。</p>
        ${renderDocumentActionTable([])}
      </section>
    `
  }

  if (state.productionChangeFormStep === 'cost-timing') {
    return `
      <section class="grid gap-4 xl:grid-cols-2">
        ${renderChangeDetailSection('料工费差异', renderCostImpactTable([]))}
        ${renderChangeDetailSection('时效影响', renderTimingImpactTable([]))}
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-background p-4">
      <h2 class="text-base font-semibold">提交审核</h2>
      <div class="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div><p class="text-muted-foreground">生产单</p><p class="mt-1 font-medium">${escapeHtml(form.productionOrderId || '未选择')}</p></div>
        <div><p class="text-muted-foreground">系统反推结果</p><p class="mt-1 font-medium">${escapeHtml(productionOrderChangeResultLabels[form.changeResult as keyof typeof productionOrderChangeResultLabels])}</p></div>
        <div><p class="text-muted-foreground">执行策略</p><p class="mt-1 font-medium">${escapeHtml(productionOrderChangeExecutionStrategyLabels[form.executionStrategy as keyof typeof productionOrderChangeExecutionStrategyLabels])}</p></div>
        <div><p class="text-muted-foreground">生效口径</p><p class="mt-1 font-medium">${escapeHtml(effectiveModeLabels[form.effectiveMode as keyof typeof effectiveModeLabels])}</p></div>
      </div>
      ${state.productionChangeFormError ? `<p class="mt-3 text-sm text-red-600">${escapeHtml(state.productionChangeFormError)}</p>` : ''}
    </section>
  `
}
```

- [ ] **步骤 4：增加新增页导出**

加入：

```ts
export function renderProductionChangeNewPage(): string {
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/changes">返回列表</button>
          <h1 class="mt-3 text-2xl font-semibold">新增生产单变更</h1>
          <p class="mt-1 text-sm text-muted-foreground">先录入业务变更意图，再由系统反推版本关系变更、生产单层补丁或两者组合。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="save-production-change-draft">保存草稿</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="submit-production-change-order">提交审核</button>
        </div>
      </header>
      ${renderProductionChangeFormSteps()}
      ${renderProductionChangeFormBody()}
    </div>
  `
}
```

- [ ] **步骤 5：增加编辑页导出**

加入：

```ts
export function renderProductionChangeEditPage(changeOrderId: string): string {
  const order = getProductionOrderChangeOrder(changeOrderId)
  if (!order) {
    return `
      <div class="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>未找到变更单：${escapeHtml(changeOrderId)}</p>
        <button class="rounded-md border px-4 py-2 hover:bg-muted" data-nav="/fcs/production/changes">返回列表</button>
      </div>
    `
  }
  if (state.productionChangeForm.productionOrderId !== order.productionOrderId) {
    state.productionChangeForm = {
      productionOrderId: order.productionOrderId,
      source: order.source,
      modules: [...order.changeModules],
      reason: order.reason,
      effectiveMode: order.expectedEffectiveMode,
      executionStrategy: order.executionStrategy,
      changeResult: order.changeResult,
    }
  }
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/changes/${escapeHtml(order.id)}">返回详情</button>
          <h1 class="mt-3 text-2xl font-semibold">编辑变更单</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(order.id)} / ${escapeHtml(order.productionOrderId)}</p>
        </div>
        <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="submit-production-change-order">提交审核</button>
      </header>
      ${renderProductionChangeFormSteps()}
      ${renderProductionChangeFormBody()}
    </div>
  `
}
```

- [ ] **步骤 6：在 events.ts 增加表单字段处理**

在字段处理区增加：

```ts
  if (field === 'productionChangeFormProductionOrderId') {
    state.productionChangeForm.productionOrderId = value
    state.productionChangeFormError = ''
    return true
  }
  if (field === 'productionChangeFormSource') {
    state.productionChangeForm.source = value
    state.productionChangeFormError = ''
    return true
  }
  if (field === 'productionChangeFormResult') {
    state.productionChangeForm.changeResult = value
    state.productionChangeFormError = ''
    return true
  }
  if (field === 'productionChangeFormEffectiveMode') {
    state.productionChangeForm.effectiveMode = value
    state.productionChangeFormError = ''
    return true
  }
  if (field === 'productionChangeFormExecutionStrategy') {
    state.productionChangeForm.executionStrategy = value
    state.productionChangeFormError = ''
    return true
  }
  if (field === 'productionChangeFormReason') {
    state.productionChangeForm.reason = value
    state.productionChangeFormError = ''
    return true
  }
```

- [ ] **步骤 7：在 events.ts 增加步骤和提交动作**

在 action 区增加：

```ts
  if (action === 'set-production-change-form-step') {
    const step = actionNode.dataset.step as ProductionState['productionChangeFormStep'] | undefined
    if (step && ['order', 'content', 'impact', 'documents', 'cost-timing', 'submit'].includes(step)) {
      state.productionChangeFormStep = step
    }
    return true
  }

  if (action === 'save-production-change-draft') {
    state.productionChangeForm.changeResult = state.productionChangeForm.changeResult || 'PRODUCTION_PATCH'
    const order = submitProductionOrderChangeOrder({
      productionOrderId: state.productionChangeForm.productionOrderId,
      source: state.productionChangeForm.source as ProductionOrderChangeSource,
      changeModules: state.productionChangeForm.modules as TechPackChangeModule[],
      reason: state.productionChangeForm.reason || '草稿：待补充变更原因',
      expectedEffectiveMode: state.productionChangeForm.effectiveMode as ChangeEffectiveMode,
      effectiveDescription: effectiveModeLabels[state.productionChangeForm.effectiveMode as ChangeEffectiveMode],
      changeResult: state.productionChangeForm.changeResult as ProductionOrderChangeResult,
      executionStrategy: state.productionChangeForm.executionStrategy as ProductionOrderChangeExecutionStrategy,
      operatorName: currentUser.name,
    })
    showPlanMessage(`变更草稿已保存：${order.id}`)
    openAppRoute(`/fcs/production/changes/${order.id}`, `production-change-${order.id}`, `生产单变更 ${order.id}`)
    return true
  }

  if (action === 'submit-production-change-order') {
    try {
      const order = submitProductionOrderChangeOrder({
        productionOrderId: state.productionChangeForm.productionOrderId,
        source: state.productionChangeForm.source as ProductionOrderChangeSource,
        changeModules: state.productionChangeForm.modules as TechPackChangeModule[],
        reason: state.productionChangeForm.reason,
        expectedEffectiveMode: state.productionChangeForm.effectiveMode as ChangeEffectiveMode,
        effectiveDescription: effectiveModeLabels[state.productionChangeForm.effectiveMode as ChangeEffectiveMode],
        changeResult: state.productionChangeForm.changeResult as ProductionOrderChangeResult,
        executionStrategy: state.productionChangeForm.executionStrategy as ProductionOrderChangeExecutionStrategy,
        operatorName: currentUser.name,
      })
      state.productionChangeForm = { ...PRODUCTION_CHANGE_EMPTY_FORM }
      state.productionChangeFormStep = 'order'
      state.productionChangeFormError = ''
      openAppRoute(`/fcs/production/changes/${order.id}`, `production-change-${order.id}`, `生产单变更 ${order.id}`)
      showPlanMessage(`生产单变更已提交：${order.id}`)
    } catch (error) {
      state.productionChangeFormError = error instanceof Error ? error.message : '提交生产单变更失败'
    }
    return true
  }
```

- [ ] **步骤 8：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：新增页和编辑页断言通过；详情页 Tab 断言仍可能失败。

- [ ] **步骤 9：Commit**

```bash
git add src/pages/production/changes-domain.ts src/pages/production/events.ts
git commit -m "feat: 增加生产单变更分步骤表单"
```

## 任务 6：新增变更单详情页，生产单关系详情改为诊断页

**文件：**

- 修改：`src/pages/production/changes-domain.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：增加变更单详情 Tab 按钮**

加入：

```ts
function renderProductionChangeOrderDetailTabs(): string {
  const tabs = [
    { key: 'content', label: '变更内容' },
    { key: 'impact', label: '生产影响' },
    { key: 'documents', label: '单据处理' },
    { key: 'cost', label: '料工费' },
    { key: 'timing', label: '时效影响' },
    { key: 'approval', label: '审核执行' },
    { key: 'records', label: '处理记录' },
  ] as const
  return `
    <div class="inline-flex flex-wrap rounded-lg border bg-muted/30 p-1">
      ${tabs.map((tab) => `
        <button
          class="rounded px-3 py-1.5 text-sm ${state.productionChangeDetailTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          data-prod-action="switch-production-change-detail-tab"
          data-tab="${tab.key}"
        >${escapeHtml(tab.label)}</button>
      `).join('')}
    </div>
  `
}
```

- [ ] **步骤 2：增加变更单详情内容**

加入：

```ts
function renderProductionChangeOrderDetailContent(order: ProductionOrderChangeOrderView): string {
  const impacts = listProductionOrderChangeImpactRows(order.id)
  const documentActions = listProductionOrderChangeDocumentActions(order.id)
  const costImpacts = listProductionOrderChangeCostImpacts(order.id)
  const timingImpacts = listProductionOrderChangeTimingImpacts(order.id)
  const scenario = listProductionOrderChangeScenarioCatalog().find((item) => item.id === order.scenarioId)

  if (state.productionChangeDetailTab === 'content') {
    return renderChangeDetailSection('变更内容', `
      <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div><p class="text-muted-foreground">变更来源</p><p class="mt-1 font-medium">${escapeHtml(productionOrderChangeSourceLabels[order.source])}</p></div>
        <div><p class="text-muted-foreground">系统反推结果</p><p class="mt-1 font-medium">${escapeHtml(productionOrderChangeResultLabels[order.changeResult])}</p></div>
        <div><p class="text-muted-foreground">期望生效口径</p><p class="mt-1 font-medium">${escapeHtml(effectiveModeLabels[order.expectedEffectiveMode])}</p></div>
        <div><p class="text-muted-foreground">业务场景</p><p class="mt-1 font-medium">${escapeHtml(scenario?.title ?? order.reason)}</p></div>
      </div>
    `)
  }

  if (state.productionChangeDetailTab === 'impact') return renderChangeDetailSection('生产影响', renderProductionImpactTable(impacts))
  if (state.productionChangeDetailTab === 'documents') return renderChangeDetailSection('单据处理', renderDocumentActionTable(documentActions))
  if (state.productionChangeDetailTab === 'cost') return renderChangeDetailSection('料工费差异', renderCostImpactTable(costImpacts))
  if (state.productionChangeDetailTab === 'timing') return renderChangeDetailSection('时效影响', renderTimingImpactTable(timingImpacts))
  if (state.productionChangeDetailTab === 'approval') {
    return renderChangeDetailSection('审核执行', `
      <div class="grid gap-2 text-sm">
        <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">立即止损：先锁定受影响范围和通知责任人，不完成最终变更。</p>
        <p class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">立即执行：低风险、可逆、权限内、不影响结算或发货的单据处理可先执行并备案。</p>
        <p class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">审核通过后执行：影响版本关系、补丁、结算、发货、返工、已消耗物料的处理必须审核通过后执行。</p>
      </div>
    `)
  }
  return renderChangeDetailSection('处理记录', `
    <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
      <div><p class="text-muted-foreground">创建人</p><p class="mt-1 font-medium">${escapeHtml(order.createdBy)}</p></div>
      <div><p class="text-muted-foreground">创建时间</p><p class="mt-1 font-medium">${escapeHtml(order.createdAt)}</p></div>
      <div><p class="text-muted-foreground">审核人</p><p class="mt-1 font-medium">${escapeHtml(order.reviewer)}</p></div>
      <div><p class="text-muted-foreground">最后记录</p><p class="mt-1 font-medium">${escapeHtml(order.latestLog)}</p></div>
    </div>
  `)
}
```

- [ ] **步骤 3：增加变更单详情页导出**

加入：

```ts
export function renderProductionChangeOrderDetailPage(changeOrderId: string): string {
  const order = getProductionOrderChangeOrder(changeOrderId)
  if (!order) return renderProductionChangeRelationDetailPage(changeOrderId)

  const canEdit = order.status === 'DRAFT' || order.status === 'RETURNED'
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/changes">返回列表</button>
          <h1 class="mt-3 text-2xl font-semibold">${escapeHtml(order.id)}</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(order.productionOrderId)} / ${escapeHtml(order.styleName)} / ${escapeHtml(order.spuCode)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${canEdit ? `<button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/changes/${escapeHtml(order.id)}/edit">继续处理</button>` : ''}
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="start-production-change-from-order" data-order-id="${escapeHtml(order.productionOrderId)}">追加变更</button>
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-nav="/fcs/production/changes/orders/${escapeHtml(order.productionOrderId)}">查看生产单关系</button>
        </div>
      </header>
      <section class="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-4">
        <div><p class="text-xs text-muted-foreground">系统反推结果</p><p class="mt-1 font-semibold">${escapeHtml(productionOrderChangeResultLabels[order.changeResult])}</p></div>
        <div><p class="text-xs text-muted-foreground">执行策略</p><p class="mt-1 font-semibold">${escapeHtml(productionOrderChangeExecutionStrategyLabels[order.executionStrategy])}</p></div>
        <div><p class="text-xs text-muted-foreground">锁定状态</p><p class="mt-1 font-semibold">${escapeHtml(productionOrderChangeLockStatusLabels[order.lockStatus])}</p></div>
        <div><p class="text-xs text-muted-foreground">状态</p><p class="mt-1 font-semibold">${escapeHtml(productionOrderChangeOrderStatusLabels[order.status])}</p></div>
      </section>
      ${renderProductionChangeOrderDetailTabs()}
      ${renderProductionChangeOrderDetailContent(order)}
    </div>
  `
}
```

- [ ] **步骤 4：把原生产单关系详情导出改名**

将原 `export function renderProductionChangeDetailPage(productionOrderId: string): string` 改名为：

```ts
export function renderProductionChangeRelationDetailPage(productionOrderId: string): string {
```

同时将标题文案从 `生产单变更` 调整为 `生产单版本关系诊断`，将返回按钮保留到 `/fcs/production/changes`。

- [ ] **步骤 5：在 relation 详情页动作改为进入新增页**

把原 `变更版本` 和 `发起补丁` 按钮替换为：

```ts
<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="start-production-change-from-order" data-order-id="${escapeHtml(productionOrderId)}">发起变更</button>
```

- [ ] **步骤 6：在 events.ts 增加详情 Tab 切换**

加入：

```ts
  if (action === 'switch-production-change-detail-tab') {
    const tab = actionNode.dataset.tab as ProductionState['productionChangeDetailTab'] | undefined
    if (tab && ['content', 'impact', 'documents', 'cost', 'timing', 'approval', 'records'].includes(tab)) {
      state.productionChangeDetailTab = tab
    }
    return true
  }
```

- [ ] **步骤 7：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：页面结构、详情页、mock 数据闭环断言通过。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/production/changes-domain.ts src/pages/production/events.ts
git commit -m "feat: 增加生产单变更详情页"
```

## 任务 7：收口旧入口和补丁草稿行为

**文件：**

- 修改：`src/pages/production/changes-domain.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：移除列表页和变更单详情页的长弹窗渲染**

确认 `renderProductionChangesPage()` 和 `renderProductionChangeOrderDetailPage()` 不再渲染：

```ts
${renderVersionChangeDialog()}
${renderProductionPatchDialog()}
```

保留这两个弹窗函数给生产单关系诊断页兼容使用，避免一次性删除大量旧逻辑。

- [ ] **步骤 2：让旧弹窗提交后跳到新变更单详情**

在 `submit-tech-pack-version-change` 中，调用 `submitProductionOrderTechPackChange()` 后，找到该生产单最新变更单：

```ts
const createdChangeOrder = listProductionOrderChangeOrdersByProductionOrder(orderId)[0]
if (createdChangeOrder) {
  openAppRoute(`/fcs/production/changes/${createdChangeOrder.id}`, `production-change-${createdChangeOrder.id}`, `生产单变更 ${createdChangeOrder.id}`)
} else {
  openAppRoute(`/fcs/production/changes/orders/${orderId}`, `po-change-${orderId}`, `生产单版本关系 ${orderId}`)
}
```

在 `submit-production-patch` 中使用同样逻辑。

- [ ] **步骤 3：让保存补丁草稿形成草稿变更单**

将 `save-production-patch-draft` 改为：

```ts
  if (action === 'save-production-patch-draft') {
    const orderId = state.productionPatchDialogOrderId
    if (!orderId) return true
    const draft = submitProductionOrderChangeOrder({
      productionOrderId: orderId,
      source: 'MATERIAL_SHORTAGE',
      changeModules: [productionPatchTypeModuleMap[state.productionPatchForm.patchType as ProductionPatchType]],
      reason: state.productionPatchForm.reason || '补丁草稿：待补充业务原因',
      expectedEffectiveMode: 'FROM_NEXT_PREP',
      effectiveDescription: '从下一次配料开始',
      changeResult: 'PRODUCTION_PATCH',
      executionStrategy: 'AFTER_APPROVAL',
      operatorName: currentUser.name,
    })
    state.productionPatchDialogOrderId = null
    showPlanMessage(`补丁草稿已保存为变更单：${draft.id}`)
    openAppRoute(`/fcs/production/changes/${draft.id}`, `production-change-${draft.id}`, `生产单变更 ${draft.id}`)
    return true
  }
```

- [ ] **步骤 4：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/production/changes-domain.ts src/pages/production/events.ts
git commit -m "fix: 收口生产单变更旧入口闭环"
```

## 任务 8：更新原型审查记录并做最终验证

**文件：**

- 创建：`docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`

- [ ] **步骤 1：创建审查记录**

写入：

```markdown
# 生产单变更管理页面分层与数据闭环原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-08 |
| 相关需求 / 任务 | 生产单变更管理页面分层、变更单主对象、mock 数据闭环 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/production/changes`、`/fcs/production/changes/new`、`/fcs/production/changes/:changeOrderId`、`/fcs/production/changes/:changeOrderId/edit`、`/fcs/production/changes/orders/:productionOrderId` |
| 端类型 | 管理端 |
| 主要角色 | 跟单、生产计划、生产主管、财务、工艺负责人 |
| 主要任务 | 发起生产单变更、确认生产影响、确认单据处理、核算料工费、评估时效影响、审核执行、追溯记录 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 页面为 FCS 管理端，服务跟单、计划、主管、财务的全链路追溯。 |
| 任务清晰度 | 通过 | 列表查变更单，新增/编辑分步骤，详情按 Tab 阅读。 |
| 信息架构与导航 | 通过 | 变更单列表和待处理生产单来源池分层。 |
| 页面模式 | 通过 | 列表页、详情页、新增页、编辑页分离。 |
| 信息负荷 | 通过 | 列表页不再平铺详情。 |
| 文案 | 通过 | 保留生产单变更管理、生产单层补丁、影响范围锁定等业务口径。 |
| 数量与状态 | 通过 | 生产影响、单据处理、料工费、时效均保留数量和状态。 |
| 扫码与识别 | 有条件通过 | 本页面为管理端，不涉及现场扫码。 |
| 防错 | 通过 | 进行中版本关系变更、冲突补丁和审核锁定有页面表达和数据规则。 |
| UI 样式 | 通过 | 沿用现有企业后台样式。 |
| 组件交互 | 通过 | 分页、Tab、步骤、行操作均有明确入口。 |
| 协作关系 | 通过 | 变更单串联跟单、主管、工艺、仓管、财务。 |
| 异常与追溯 | 通过 | 详情页保留处理记录、责任归因和审核执行。 |
| 现场设备可用性 | 有条件通过 | 管理端优先桌面浏览器，未按 PDA 优化。 |

## 4. 问题标签

- `字段过载`
- `协作断裂`
- `追溯不足`
- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 列表页混入详情和生产单版本关系列表 | 字段过载 / 视觉干扰 | 跟单、主管 | 列表页只展示变更单，待处理生产单独立为来源池 | 否 |
| 新增/补丁动作不进入变更单列表 | 协作断裂 / 追溯不足 | 跟单、财务、主管 | 以 ProductionOrderChangeOrder 作为主对象统一写入 | 否 |
| mock 缺少同一生产单多次变更和多次补丁 | 追溯不足 | 产品、演示、测试 | 增加稳定样本并用脚本检查 | 否 |

## 6. 最终结论

结论：通过

说明：

- 本次改动符合 FCS 管理端高密度、可追溯、可审核的页面定位。
- 未把复杂新增流程塞回列表页弹窗。
- 生产补丁仍为生产单层补丁，不改冻结快照，不污染正式技术包版本。
```

- [ ] **步骤 2：运行专项检查**

运行：

```bash
npm run check:production-order-changes
```

预期：PASS，输出：

```text
production order changes check passed
```

- [ ] **步骤 3：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 4：运行构建**

运行：

```bash
npm run build
```

预期：PASS，Vite build 成功。

- [ ] **步骤 5：本地页面验证**

如果本地服务未运行，启动：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

验证：

```bash
curl -I http://192.168.0.10:5173/fcs/production/changes
```

预期：HTTP `200`。

人工浏览器检查：

- `/fcs/production/changes` 首屏只展示搜索、统计、Tab、变更单列表。
- 列表页没有内嵌详情。
- `新增变更` 进入分步骤页面。
- 待处理生产单 Tab 中的 `发起变更` 进入新增页。
- 变更单 `查看` 进入变更单详情页。
- 详情页 Tab 可以切换。
- 已完成或审核中变更单不展示无条件 `变更版本 / 发起补丁`。

- [ ] **步骤 6：同步 CodeGraph**

运行：

```bash
codegraph sync && codegraph status
```

预期：Index is up to date。

- [ ] **步骤 7：Commit**

```bash
git add docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md
git commit -m "docs: 更新生产单变更页面分层审查记录"
```

---

## 自检结果

规格覆盖度：

- 页面层级：任务 3、4、5、6 覆盖列表页、新增页、详情页、编辑页。
- 列表数据来源：任务 2、5、7 覆盖新增、版本关系变更、补丁提交写入变更单列表。
- 多次变更和多次补丁：任务 2 的 seed 和任务 1 的断言覆盖。
- mock 数据闭环：任务 1、2 覆盖变更单、生产影响、单据处理、料工费、时效影响。
- 审核中锁定口径：任务 2 和任务 6 覆盖影响范围锁定、整单暂停、执行策略展示。
- 印尼工厂原型治理：任务 8 覆盖审查记录和治理检查。

占位符扫描：

- 已完成红旗扫描，未命中禁止占位写法。
- 所有新增函数、状态、路由、检查脚本都有明确文件和代码片段。

类型一致性：

- 列表 Tab 使用 `productionChangeListTab`。
- 详情 Tab 使用 `productionChangeDetailTab`。
- 表单步骤使用 `productionChangeFormStep`。
- 主提交函数统一使用 `submitProductionOrderChangeOrder()`。
- 变更单详情查询统一使用 `getProductionOrderChangeOrder()`。
