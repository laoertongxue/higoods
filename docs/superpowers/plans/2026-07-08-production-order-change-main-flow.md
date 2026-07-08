# 生产单变更管理主流程实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `/fcs/production/changes/new` 从旧的 6 步占位表单改为正式规格中的 4 步主流程：选择生产单、填写变更内容、确认影响和单据处理、预览并提交。

**架构：** 继续使用当前 Vite + Vanilla TypeScript 字符串模板架构。领域层补一个只读预览 helper，页面层按 4 步渲染，事件层只维护业务输入和执行方式，不再让用户提前选择「系统反推结果」或「生产补丁」。

**技术栈：** Vite、TypeScript、Tailwind CSS、现有 `src/pages/production/*` 字符串模板、现有 `scripts/check-production-order-changes.ts` 断言脚本。

---

## 当前代码审查结论

已审查文件：

- `docs/superpowers/specs/2026-07-07-production-order-change-design.md`
- `src/pages/production/changes-domain.ts`
- `src/pages/production/context.ts`
- `src/pages/production/events.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `scripts/check-production-order-changes.ts`
- `docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`

关键问题：

1. `src/pages/production/changes-domain.ts` 里 `productionChangeFormSteps` 仍是 6 步：`order / content / impact / documents / cost-timing / submit`。
2. `renderProductionChangeFormBody()` 第 2 步仍展示 `系统反推结果` 和 `执行策略`，违反新规格。
3. `ProductionChangeForm` 仍把 `changeResult`、`executionStrategy` 当作表单输入字段。
4. `submitProductionChangeForm()` 直接提交用户选的 `changeResult` 和 `executionStrategy`。
5. 新增页 Step 3、Step 4 目前是说明文字，不展示生产单事实、影响范围、单据处理、料工费、时效预览。
6. 领域层已有 80 个业务场景、30+ 变更单、多次变更、多次补丁、版本关系 + 补丁、影响行、单据处理、料工费、时效数据；不需要新增大规模 mock 架构。
7. 当前工作区已有与本计划无关的改动：`src/pages/production/detail-domain.ts` 和 `docs/superpowers/plans/2026-07-08-process-craft-route-visual-order.md`。执行本计划时不要改它们，除非用户单独要求。

## 文件结构

修改：

- `src/data/fcs/production-tech-pack-change-domain.ts`
  - 增加只读预览输入类型。
  - 增加系统反推结果 helper。
  - 增加预览 helper，不写入 mock store。

- `src/pages/production/context.ts`
  - 将新增表单步骤收敛为 4 步。
  - 将表单字段改为业务输入 + 执行方式。

- `src/pages/production/events.ts`
  - 更新表单字段映射。
  - 提交前调用系统反推 helper。
  - 从生产单发起新增时进入第 1 步或第 2 步的规则与规格一致。

- `src/pages/production/changes-domain.ts`
  - 重写新增页 4 步渲染。
  - 增加生产单事实预览、影响与单据处理预览、处理结果预览。
  - 将详情页和列表页文案里的「执行策略」统一为「执行方式」。

- `scripts/check-production-order-changes.ts`
  - 先写失败断言，覆盖 4 步、新增第 2 步禁用字段、Step 3/4 预览内容、提交结果。

- `docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`
  - 更新审查记录，说明本轮主流程重写后的结论。

不修改：

- 路由文件。当前 `/fcs/production/changes/new`、详情、编辑路由已存在。
- 菜单配置。左侧菜单已经叫「生产单变更管理」。
- PDA 页面。主流程实现只做 FCS 管理端。
- 快捷路径。该能力本轮不实现、不留入口。

## 任务 1：先更新生产单变更检查脚本

**文件：**

- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：写失败断言**

将新增页步骤断言从 6 步改为 4 步，并加入禁用字段断言：

```ts
const newHtml = renderProductionChangeNewPage()
;['选择生产单', '填写变更内容', '确认影响和单据处理', '预览并提交'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少步骤「${text}」`)
})
;['系统计算影响', '料工费与时效', '提交审核'].forEach((text) => {
  assert.ok(!newHtml.includes(text), `新增页不应继续展示旧步骤「${text}」`)
})
assert.ok(newHtml.includes('生产单当前事实'), '第 1 步必须展示生产单当前事实预览')
assert.ok(!newHtml.includes('data-prod-field="productionChangeFormResult"'), '新增页不应让用户选择系统反推结果')
assert.ok(!newHtml.includes('data-prod-field="productionChangeFormExecutionStrategy"'), '新增页不应让用户提前选择执行方式')
```

增加第 2 步断言：

```ts
state.productionChangeFormStep = 'content'
const contentStepHtml = renderProductionChangeNewPage()
;['变更来源', '变更模块', '具体变更内容', '期望生效口径', '变更原因'].forEach((text) => {
  assert.ok(contentStepHtml.includes(text), `第 2 步缺少「${text}」`)
})
;['系统反推结果', '执行策略', '是否生产补丁', '是否版本关系变更'].forEach((text) => {
  assert.ok(!contentStepHtml.includes(text), `第 2 步不应展示「${text}」`)
})
```

增加第 3 步和第 4 步断言：

```ts
state.productionChangeForm = {
  productionOrderId: relation.productionOrderId,
  source: 'MATERIAL_SHORTAGE',
  modules: ['BOM'],
  changeContent: '主面料 FAB-A01 改 FAB-B02',
  reason: '主面料短缺，未领部分需要替代料。',
  effectiveMode: 'FROM_NEXT_PICKUP',
  executionMode: 'AFTER_APPROVAL',
}

state.productionChangeFormStep = 'handling'
const handlingStepHtml = renderProductionChangeNewPage()
;['生产影响', '单据处理建议', '可改做', '不可追回', '系统建议'].forEach((text) => {
  assert.ok(handlingStepHtml.includes(text), `第 3 步缺少「${text}」`)
})

state.productionChangeFormStep = 'preview'
const previewStepHtml = renderProductionChangeNewPage()
;['处理后结果预览', '系统反推结果', '预计料工费', '预计时效', '立即执行', '立即止损后提交审核', '审核通过后执行'].forEach((text) => {
  assert.ok(previewStepHtml.includes(text), `第 4 步缺少「${text}」`)
})
```

- [ ] **步骤 2：运行检查，确认失败**

运行：

```bash
npm run check:production-order-changes
```

预期：失败，报错包含新增 4 步、`changeContent` 或禁用字段相关断言。

- [ ] **步骤 3：Commit 失败断言**

```bash
git add scripts/check-production-order-changes.ts
git commit -m "test: specify production change main flow"
```

## 任务 2：调整新增变更表单状态

**文件：**

- 修改：`src/pages/production/context.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：修改表单类型**

在 `src/pages/production/context.ts` 中改为 4 步和业务输入字段：

```ts
type ProductionChangeFormStep = 'order' | 'content' | 'handling' | 'preview'

interface ProductionChangeForm {
  productionOrderId: string
  source: string
  modules: string[]
  changeContent: string
  reason: string
  effectiveMode: string
  executionMode: string
}
```

更新 `PRODUCTION_CHANGE_EMPTY_FORM`：

```ts
const PRODUCTION_CHANGE_EMPTY_FORM: ProductionChangeForm = {
  productionOrderId: '',
  source: 'TECH_PACK_NEW_VERSION',
  modules: ['BOM'],
  changeContent: '',
  reason: '',
  effectiveMode: 'FROM_NEXT_PREP',
  executionMode: 'AFTER_APPROVAL',
}
```

- [ ] **步骤 2：更新事件字段映射**

在 `src/pages/production/events.ts` 中将字段映射改为：

```ts
const productionChangeFormFieldMap: Partial<Record<string, keyof typeof state.productionChangeForm>> = {
  productionChangeFormProductionOrderId: 'productionOrderId',
  productionChangeFormSource: 'source',
  productionChangeFormEffectiveMode: 'effectiveMode',
  productionChangeFormChangeContent: 'changeContent',
  productionChangeFormReason: 'reason',
  productionChangeFormExecutionMode: 'executionMode',
}
```

移除 `productionChangeFormResult` 和 `productionChangeFormExecutionStrategy` 映射。

- [ ] **步骤 3：处理变更模块多选**

当前事件层没有数组型多选写入。先用复选框独立 action，避免引入表单库。

在 `handleProductionEvent()` 中加入：

```ts
if (action === 'toggle-production-change-module') {
  const module = actionNode.dataset.module as TechPackChangeModule | undefined
  if (!module) return true
  const modules = new Set(state.productionChangeForm.modules)
  if (modules.has(module)) {
    modules.delete(module)
  } else {
    modules.add(module)
  }
  state.productionChangeForm.modules = Array.from(modules)
  state.productionChangeFormError = ''
  return true
}
```

- [ ] **步骤 4：从生产单发起新增时从第 1 步开始**

将 `start-production-change-from-order` 的步骤从 `content` 改为 `order`，保留生产单预填：

```ts
state.productionChangeForm = { ...PRODUCTION_CHANGE_EMPTY_FORM, productionOrderId: orderId }
state.productionChangeFormStep = 'order'
```

- [ ] **步骤 5：运行检查，确认仍失败但类型错误减少**

运行：

```bash
npm run check:production-order-changes
```

预期：如果页面还未改，仍会失败；不应出现 `ProductionChangeForm` 字段不存在的 TypeScript 运行错误。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/production/context.ts src/pages/production/events.ts
git commit -m "refactor: align production change form state"
```

## 任务 3：增加系统反推和只读预览 helper

**文件：**

- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`

- [ ] **步骤 1：增加输入和预览类型**

在 `ProductionOrderChangeOrderUpdateInput` 附近增加：

```ts
export interface ProductionOrderChangePreviewInput {
  productionOrderId: string
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  reason: string
  changeContent: string
  expectedEffectiveMode: ChangeEffectiveMode
  executionMode: ProductionOrderChangeExecutionStrategy
  operatorName: string
}

export interface ProductionOrderChangePreview {
  order: ProductionOrderChangeOrder
  impactRows: ProductionOrderChangeImpactRow[]
  documentActions: ProductionOrderChangeDocumentAction[]
  costImpacts: ProductionOrderChangeCostImpact[]
  timingImpacts: ProductionOrderChangeTimingImpact[]
}
```

- [ ] **步骤 2：增加系统反推 helper**

在 `submitProductionOrderChangeOrder()` 前增加：

```ts
export function inferProductionOrderChangeResult(input: {
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  expectedEffectiveMode: ChangeEffectiveMode
}): ProductionOrderChangeResult {
  if (input.source === 'COST_EXCEPTION' || input.changeModules.every((module) => module === 'COST')) {
    return 'COST_ONLY'
  }
  if (input.expectedEffectiveMode === 'FROM_NEXT_PROCESS_ORDER') {
    return 'RECORD_ONLY'
  }
  if (input.source === 'TECH_PACK_NEW_VERSION') {
    return input.expectedEffectiveMode === 'IMMEDIATE_AFTER_APPROVAL' ? 'VERSION_RELATION' : 'VERSION_AND_PATCH'
  }
  return 'PRODUCTION_PATCH'
}
```

- [ ] **步骤 3：增加只读预览 helper**

继续放在同一文件中，复用现有 builder，不写入数组：

```ts
export function previewProductionOrderChangeOrder(input: ProductionOrderChangePreviewInput): ProductionOrderChangePreview {
  const relation = getRelationWithEvaluation(input.productionOrderId)
  if (!relation) throw new Error('未找到生产单技术包版本关系。')

  const changeResult = inferProductionOrderChangeResult({
    source: input.source,
    changeModules: input.changeModules,
    expectedEffectiveMode: input.expectedEffectiveMode,
  })
  const scenario =
    productionOrderChangeScenarioCatalog.find((item) => item.source === input.source && item.expectedResult === changeResult) ??
    productionOrderChangeScenarioCatalog.find((item) => item.expectedResult === changeResult) ??
    productionOrderChangeScenarioCatalog[0]
  const documents = scenario.mainAffectedDocuments.length
    ? scenario.mainAffectedDocuments
    : getScenarioDocuments(input.reason || input.changeContent, changeResult)
  const hasVersionRelationChange = changeResult === 'VERSION_RELATION' || changeResult === 'VERSION_AND_PATCH'
  const hasProductionPatch = changeResult === 'PRODUCTION_PATCH' || changeResult === 'VERSION_AND_PATCH'
  const createdAt = nowText()
  const costDeltaAmount = changeResult === 'COST_ONLY' ? 1200 : input.changeModules.includes('COST') ? 800 : 0
  const delayDays = input.executionMode === 'IMMEDIATE_STOP_LOSS' ? 2 : input.executionMode === 'AFTER_APPROVAL' ? 1 : 0
  const order: ProductionOrderChangeOrder = {
    id: `PREVIEW-${relation.productionOrderId}`,
    scenarioId: scenario.id,
    productionOrderId: relation.productionOrderId,
    demandOrderId: relation.productionOrderNo.replace('PO-', 'DO-'),
    spuCode: relation.spuCode,
    styleName: relation.styleName,
    buyerName: relation.buyerName,
    merchandiserName: relation.merchandiserName,
    source: input.source,
    changeModules: [...input.changeModules],
    reason: input.reason.trim() || input.changeContent.trim() || '待补充变更原因',
    expectedEffectiveMode: input.expectedEffectiveMode,
    effectiveDescription: effectiveModeLabels[input.expectedEffectiveMode] ?? '按表单选择口径生效',
    changeResult,
    executionStrategy: input.executionMode,
    lockStatus: input.executionMode === 'IMMEDIATE_STOP_LOSS' ? 'WHOLE_ORDER_PAUSED' : 'IMPACT_SCOPE_LOCKED',
    status: input.executionMode === 'IMMEDIATE_EXECUTION' ? 'EXECUTING' : 'SUBMITTED',
    hasVersionRelationChange,
    hasProductionPatch,
    affectedDocumentCount: documents.length,
    costDeltaAmount,
    delayDays,
    createdBy: input.operatorName,
    createdAt,
    reviewer: changeResult === 'COST_ONLY' ? '财务主管' : '生产主管',
    latestLog: `系统已按当前填写内容生成预览，${productionOrderChangeExecutionStrategyLabels[input.executionMode]}。`,
  }
  const impactRows = changeResult === 'COST_ONLY' || changeResult === 'RECORD_ONLY'
    ? []
    : [buildProductionOrderChangeImpactRow(order, 0, 0)]
  const documentActions = documents.map((documentType, index) =>
    buildProductionOrderChangeDocumentAction(order, documentType, index),
  )
  const costImpacts = costDeltaAmount === 0 && changeResult !== 'COST_ONLY'
    ? []
    : [{
      id: 'PREVIEW-COST-001',
      changeOrderId: order.id,
      costType: input.changeModules.includes('COST') ? 'FEE' : 'MATERIAL',
      itemName: input.changeModules.includes('COST') ? '结算补差费用' : '主面料替代差价',
      estimatedAmount: Math.abs(costDeltaAmount) + 600,
      actualAmount: Math.abs(costDeltaAmount) + 600,
      responsibleParty: input.changeModules.includes('COST') ? '财务结算 / 买手' : '物料计划 / 供应商',
      settlementHandling: '进入本次结算补差，需保留变更单和主管确认记录。',
    }]
  const timingNode = scenario.timingNodes[0] ?? 'MATERIAL_PREPARATION'
  const timingImpacts = changeResult === 'COST_ONLY' || changeResult === 'RECORD_ONLY'
    ? []
    : [{
      id: 'PREVIEW-TIME-001',
      changeOrderId: order.id,
      timingNode,
      originalTime: createdAt,
      newEstimatedTime: createdAt,
      delayDays,
      affectsProductionDelivery: delayDays > 0,
      affectsFulfillmentDelivery: timingNode === 'SHIPPING' || delayDays >= 2,
      responsibleParty: timingNode === 'SHIPPING' ? '履约计划' : '生产计划',
      recoveryAction: input.executionMode === 'IMMEDIATE_STOP_LOSS'
        ? '先锁定影响范围，追回未完成批次，主管确认后释放。'
        : '优先处理未开工范围，已完成部分保留追溯记录。',
    }]
  return clone({ order, impactRows, documentActions, costImpacts, timingImpacts })
}
```

- [ ] **步骤 4：更新提交逻辑使用反推结果**

在 `submitProductionOrderChangeOrder()` 调用方改完前，领域函数保持兼容，不删除 `changeResult` 和 `executionStrategy` 输入。此任务只增加 preview 和 infer helper。

- [ ] **步骤 5：运行领域检查**

运行：

```bash
npm run check:production-order-changes
```

预期：可能仍因页面未改而失败；不应出现 `previewProductionOrderChangeOrder` 编译错误。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/production-tech-pack-change-domain.ts
git commit -m "feat: add production change preview helper"
```

## 任务 4：重写新增页 4 步渲染

**文件：**

- 修改：`src/pages/production/changes-domain.ts`

- [ ] **步骤 1：更新导入**

从 `src/data/fcs/production-tech-pack-change-domain.ts` 引入：

```ts
  inferProductionOrderChangeResult,
  previewProductionOrderChangeOrder,
```

- [ ] **步骤 2：改成 4 步**

替换 `productionChangeFormSteps`：

```ts
const productionChangeFormSteps = [
  { key: 'order', label: '选择生产单' },
  { key: 'content', label: '填写变更内容' },
  { key: 'handling', label: '确认影响和单据处理' },
  { key: 'preview', label: '预览并提交' },
] as const
```

步骤容器改为 `md:grid-cols-4`。

- [ ] **步骤 3：增加预览读取函数**

在 `renderProductionChangeFormBody()` 前增加：

```ts
function getProductionChangeFormPreview() {
  const form = state.productionChangeForm
  if (!form.productionOrderId) return null
  try {
    return previewProductionOrderChangeOrder({
      productionOrderId: form.productionOrderId,
      source: form.source as ProductionOrderChangeSource,
      changeModules: form.modules as TechPackChangeModule[],
      changeContent: form.changeContent,
      reason: form.reason,
      expectedEffectiveMode: form.effectiveMode as ChangeEffectiveMode,
      executionMode: form.executionMode as ProductionOrderChangeExecutionStrategy,
      operatorName: currentUser.name,
    })
  } catch {
    return null
  }
}
```

- [ ] **步骤 4：第 1 步展示生产单当前事实**

替换 `order` 分支。必须包含这些标题文案：

```html
<h2 class="text-base font-semibold">生产单当前事实</h2>
<h3 class="text-sm font-semibold">基本信息</h3>
<h3 class="text-sm font-semibold">技术包关系</h3>
<h3 class="text-sm font-semibold">生产进度</h3>
<h3 class="text-sm font-semibold">已生成单据</h3>
<h3 class="text-sm font-semibold">历史变更</h3>
```

字段来源：

- 基本信息从 `relation.productionOrderNo`、`relation.spuCode`、`relation.styleName`、`relation.buyerName`、`relation.merchandiserName`、`relation.deliveryDate` 取。
- 技术包关系从 `currentTechPackVersionNo`、`latestPublishedTechPackVersionNo`、`frozenSnapshotId`、`hasNewerPublishedVersion` 取。
- 生产进度从 `relation.progressSummary` 取。
- 已生成单据从 `listProductionOrderChangeDocumentActions()` 对同生产单历史变更汇总。
- 历史变更从 `listProductionOrderChangeOrdersByProductionOrder(relation.productionOrderId)` 取前 3 条。

- [ ] **步骤 5：第 2 步只展示业务输入**

替换 `content` 分支，保留：

- `变更来源`
- `变更模块`
- `具体变更内容`
- `期望生效口径`
- `变更原因`

不要渲染：

- `productionChangeFormResult`
- `productionChangeFormExecutionStrategy`
- `系统反推结果`
- `执行策略`

变更模块用复选按钮：

```ts
${(Object.keys(techPackChangeModuleLabels) as TechPackChangeModule[]).map((module) => `
  <button
    class="rounded-md border px-3 py-2 text-sm ${form.modules.includes(module) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}"
    data-prod-action="toggle-production-change-module"
    data-module="${escapeHtml(module)}"
  >${escapeHtml(techPackChangeModuleLabels[module])}</button>
`).join('')}
```

- [ ] **步骤 6：第 3 步展示影响和单据处理**

`handling` 分支使用 `getProductionChangeFormPreview()`：

```ts
const preview = getProductionChangeFormPreview()
```

无生产单时展示：

```html
请先选择生产单。
```

有预览时展示：

- `生产影响`
- `单据处理建议`
- `可改做`
- `不可追回`
- `系统建议`

表格可复用已有：

```ts
renderProductionImpactTable(preview.impactRows)
renderDocumentActionTable(preview.documentActions)
```

- [ ] **步骤 7：第 4 步展示结果预览和执行方式**

`preview` 分支展示：

- `处理后结果预览`
- `系统反推结果`
- `预计料工费`
- `预计时效`
- `锁定范围`
- 三个执行方式按钮

执行方式按钮写入 `productionChangeFormExecutionMode`：

```html
<button data-prod-field="productionChangeFormExecutionMode" value="IMMEDIATE_EXECUTION">立即执行</button>
<button data-prod-field="productionChangeFormExecutionMode" value="IMMEDIATE_STOP_LOSS">立即止损后提交审核</button>
<button data-prod-field="productionChangeFormExecutionMode" value="AFTER_APPROVAL">审核通过后执行</button>
```

如果按钮不能作为字段节点处理，用 `data-prod-action="set-production-change-execution-mode"`，并在任务 5 增加事件处理。

- [ ] **步骤 8：调整页头动作**

新增页顶部保留「保存草稿」，主按钮改为根据步骤显示：

- 非 `preview` 步：`下一步`
- `preview` 步：`确认提交`

为了少改事件，可先保留 `提交审核` 按钮，但只在 `preview` 步显示；其他步骤显示 `下一步`，action 为 `set-production-change-form-step` 且带下一步 key。

- [ ] **步骤 9：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：新增页相关断言通过；提交相关断言可能在任务 5 前失败。

- [ ] **步骤 10：Commit**

```bash
git add src/pages/production/changes-domain.ts
git commit -m "feat: render production change four-step form"
```

## 任务 5：提交前反推结果和执行方式

**文件：**

- 修改：`src/pages/production/events.ts`
- 修改：`src/pages/production/changes-domain.ts`

- [ ] **步骤 1：在事件层导入反推 helper**

从 `src/data/fcs/production-tech-pack-change-domain.ts` 引入：

```ts
  inferProductionOrderChangeResult,
```

- [ ] **步骤 2：提交时反推 changeResult**

在 `submitProductionChangeForm()` 中替换 `changeResult` 和 `executionStrategy` 赋值：

```ts
const changeResult = inferProductionOrderChangeResult({
  source: form.source as ProductionOrderChangeSource,
  changeModules: form.modules as TechPackChangeModule[],
  expectedEffectiveMode: effectiveMode,
})
const executionStrategy = form.executionMode as ProductionOrderChangeExecutionStrategy
```

提交 input 改为：

```ts
changeResult,
executionStrategy,
```

不要再读取 `form.changeResult`。

- [ ] **步骤 3：增加执行方式按钮事件**

如果任务 4 使用 action，加入：

```ts
if (action === 'set-production-change-execution-mode') {
  const mode = actionNode.dataset.mode as ProductionOrderChangeExecutionStrategy | undefined
  if (!mode) return true
  state.productionChangeForm.executionMode = mode
  state.productionChangeFormError = ''
  return true
}
```

- [ ] **步骤 4：增加简单步骤流转**

加入：

```ts
if (action === 'go-production-change-next-step') {
  const order = ['order', 'content', 'handling', 'preview'] as const
  const index = order.indexOf(state.productionChangeFormStep)
  state.productionChangeFormStep = order[Math.min(index + 1, order.length - 1)]
  return true
}
```

如果 `index` 是 `-1`，设置为 `order`。

- [ ] **步骤 5：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：新增、编辑、提交、列表统计、数据闭环断言全部通过。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/production/events.ts src/pages/production/changes-domain.ts
git commit -m "fix: infer production change result on submit"
```

## 任务 6：对齐详情页和列表页文案

**文件：**

- 修改：`src/pages/production/changes-domain.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：更新检查脚本文案**

将断言中的 `执行策略` 改为 `执行方式`：

```ts
;[
  '生产单变更管理',
  '新增变更',
  '变更单列表',
  '待处理生产单',
  '搜索生产单号 / 变更单号 / 需求单号 / SPU / 款式 / 负责人',
  '变更单号',
  '生产单号',
  '系统反推结果',
  '执行方式',
  '锁定状态',
].forEach((text) => {
  assert.ok(listHtml.includes(text), `列表页缺少「${text}」`)
})
```

- [ ] **步骤 2：更新列表列名**

在 `renderProductionChangeOrderList()` 中将列名 `执行策略` 改为 `执行方式`。

- [ ] **步骤 3：更新详情审核执行文案**

在 `renderProductionChangeOrderDetailContent()` 的 approval 分支中：

- `立即止损` 改为 `立即止损后提交审核`。
- `当前策略` 改为 `当前方式`。
- 所有对外展示的 `执行策略` 改为 `执行方式`。

- [ ] **步骤 4：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：通过。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/production/changes-domain.ts scripts/check-production-order-changes.ts
git commit -m "chore: align production change execution wording"
```

## 任务 7：更新原型审查记录

**文件：**

- 修改：`docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`

- [ ] **步骤 1：更新基本信息**

将 `相关需求 / 任务` 改为：

```markdown
生产单变更管理主流程重写：新增页 4 步主流程、系统反推结果、生产影响和单据处理预览、料工费与时效预览。
```

- [ ] **步骤 2：更新自查结论**

把 `页面模式` 说明补充为：

```markdown
新增页按「选择生产单、填写变更内容、确认影响和单据处理、预览并提交」4 步展示；列表页只做检索和入口；详情页按 Tab 追溯完整闭环。
```

把 `任务清晰度` 说明补充为：

```markdown
第 2 步不暴露版本关系变更、生产补丁、执行方式等系统判断；业务只填写变更事实，系统在第 3、4 步给出建议和反推结果。
```

- [ ] **步骤 3：补充主要问题处理记录**

增加一行：

```markdown
| 新增页仍让用户先选系统反推结果和执行策略，且第 3 / 第 4 步缺少真实影响、单据、成本、时效预览。 | 状态抽象、字段过载、点错风险 | 跟单、生产计划、生产主管 | 重写新增页为 4 步主流程；第 2 步只收集业务事实；第 3 步展示系统计算影响和单据处理建议；第 4 步展示系统反推结果和执行方式。 | 否 |
```

- [ ] **步骤 4：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：如果相关 `src/` 文件已 staged，治理检查通过并识别到审查记录。

- [ ] **步骤 5：Commit**

```bash
git add docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md
git commit -m "docs: update production change prototype review"
```

## 任务 8：最终验证和本地效果检查

**文件：**

- 修改：无，除非验证发现缺陷。

- [ ] **步骤 1：运行专项检查**

```bash
npm run check:production-order-changes
```

预期：通过。

- [ ] **步骤 2：运行治理检查**

```bash
npm run check:prototype-design-governance
```

预期：通过。

- [ ] **步骤 3：运行构建**

```bash
npm run build
```

预期：通过。

- [ ] **步骤 4：同步 CodeGraph**

```bash
codegraph sync && codegraph status
```

预期：索引为 up to date。

- [ ] **步骤 5：本地启动**

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

预期：Vite 启动成功。如果 5173 被占用，使用 5174。

- [ ] **步骤 6：验证路由可达**

```bash
ipconfig getifaddr en0
curl -I http://$(ipconfig getifaddr en0):5173/fcs/production/changes
```

预期：`HTTP/1.1 200 OK`。

- [ ] **步骤 7：浏览器人工核查**

打开：

```text
http://<局域网IP>:5173/fcs/production/changes/new
```

人工核查：

- 第 1 步可搜索或选择生产单，并展示生产单当前事实。
- 第 2 步只展示业务输入，不展示系统反推结果、生产补丁、版本关系变更或执行方式。
- 第 3 步展示生产影响和单据处理建议。
- 第 4 步展示处理后结果预览、系统反推结果、预计料工费、预计时效和 3 种执行方式。
- 提交后进入变更单详情。
- 列表页仍只展示列表和入口，不内嵌详情。

- [ ] **步骤 8：最终 Commit**

如果验证阶段有修复：

```bash
git add <changed-files>
git commit -m "fix: polish production change main flow"
```

如果无修复，不创建空提交。

## 规格覆盖自检

| 规格要求 | 计划任务 |
| --- | --- |
| 左侧菜单继续叫「生产单变更管理」 | 不改菜单，任务 6 只对齐页面文案 |
| 新增变更 4 步 | 任务 1、2、4、5 |
| 第 1 步选择生产单并展示完整事实 | 任务 1、4 |
| 第 2 步只填写业务事实 | 任务 1、2、4、5 |
| 第 3 步系统计算影响和单据处理建议 | 任务 3、4 |
| 第 4 步预览单据、成本、时效和反推结果 | 任务 3、4 |
| 系统反推版本关系 / 补丁 / 组合 / 成本 / 记录 | 任务 3、5 |
| 不实现快捷路径 | 文件结构和任务范围均排除 |
| mock 数据覆盖多次变更、多次补丁、组合变更 | 现有脚本已覆盖，任务 1 保留相关断言 |
| 页面分层：列表、新增、详情、编辑 | 任务 4、6 |
| 原型治理 | 任务 7、8 |

## 执行注意事项

- 不要修改 `src/pages/production/detail-domain.ts`，它是当前工作区已有的无关改动。
- 不要修改 `docs/superpowers/plans/2026-07-08-process-craft-route-visual-order.md`，它是当前工作区已有的无关计划草稿。
- 不要引入 React、状态管理库、表单引擎或后端服务。
- 不要删除现有 80 个场景和多次变更 mock 数据。
- 不要把快捷路径写进页面或计划任务。
- 每个任务完成后运行该任务指定检查并单独 commit。
