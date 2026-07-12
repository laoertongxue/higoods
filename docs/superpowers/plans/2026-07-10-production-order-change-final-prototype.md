# 生产单变更最终原型实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `/fcs/production/changes` 改造成只覆盖“修改需求明细数量”和“替换物料”的生产单变更原型，使用两张独立表单、统一四步流程、克制的人工数据节点、同步原子执行和完整上下游留痕。

**架构：** 保留现有生产单变更路由和列表入口，新建聚焦两类场景的 `production-order-change-workflow.ts`，从旧的技术包变更大文件中隔离最终表单、处理方案和执行模拟。新增页的四步渲染拆到独立页面模块，`changes-domain.ts` 继续负责列表和详情外壳，`events.ts` 只维护局部表单状态和前台同步执行演示。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `src/components/ui/` 组件、Node assert 检查脚本、Playwright。

---

## 文件结构

- 创建：`src/data/fcs/production-order-change-workflow.ts`
  - 定义最终三种结果、两类表单数据、第三步自动处理项、必要判断项、执行步骤和锁定信息。
  - 从现有生产单关系、需求明细、当前事实和系统物料档案组装稳定 Mock。
  - 提供预览、判断校验、同步执行模拟、列表和详情查询函数。
- 创建：`src/pages/production/production-change-form.ts`
  - 渲染统一四步导航、生产单事实、数量变更表单、物料替换表单、第三步处理方案和第四步执行结果。
  - 使用现有 `steps.ts`、`button.ts`、`table.ts`、`form.ts`、`badge.ts`。
- 修改：`src/pages/production/context.ts`
  - 将 `ProductionChangeForm` 收敛为最终字段，增加必要判断和执行状态。
- 修改：`src/pages/production/changes-domain.ts`
  - 保留列表、详情和路由导出。
  - 删除旧新增页中的主管确认、负责人处理、生效口径、执行策略等表单内容。
  - 接入新的四步表单渲染和最终详情结构。
- 修改：`src/pages/production/events.ts`
  - 处理数量明细新增/取消/修改、物料选择、替换方式、后续生产单范围、建议数量和颜色尺码分配调整。
  - 处理第三步必要判断和第四步前台同步执行。
  - 所有输入采用局部状态更新，不在 `input` 事件中整页重绘。
- 修改：`scripts/check-production-order-changes.ts`
  - 以最终规格替换旧主管、负责人、适用颜色尺码、生效位置、审核等断言。
  - 增加结果矩阵、必要判断、同步执行、锁定和禁止文案断言。
- 创建：`tests/production-order-change-final.spec.ts`
  - 覆盖两张表单、四步流转、第三步必要判断、第四步成功与回滚展示和页面无溢出。
- 修改：`package.json`
  - 增加 `test:production-order-change-final:e2e`。
- 创建：`docs/prototype-review-records/2026-07-10-production-order-change-final.md`
  - 记录角色、端类型、文案、防错、异常、人工节点、性能和浏览器验收结论。

## 任务 1：用最终规格重写检查契约

**文件：**
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：替换旧角色和旧字段断言**

删除对以下内容的正向断言：

```typescript
const removedCopy = [
  '待主管确认',
  '相关负责人',
  '通知相关负责人处理',
  '适用颜色',
  '适用尺码',
  '从哪里开始用新物料',
  '提交审核',
]
```

改为负向断言：

```typescript
removedCopy.forEach((text) => {
  assert.ok(!newHtml.includes(text), `最终新增页不应出现旧口径：${text}`)
})
```

- [ ] **步骤 2：增加统一四步流程断言**

```typescript
;['选择生产单', '填写变更内容', '确认处理方案', '同步执行'].forEach((text) => {
  assert.ok(newHtml.includes(text), `新增页缺少步骤：${text}`)
})
assert.ok(newHtml.includes('跟单'), '页面角色必须统一为跟单')
```

- [ ] **步骤 3：增加数量变更最终断言**

```typescript
state.productionChangeForm.changeType = 'QUANTITY_CHANGE'
state.productionChangeFormStep = 'content'
const quantityFormHtml = renderProductionChangeNewPage()

;['商品编码', '颜色', '尺码', '原需求', '变更后数量', '变更原因'].forEach((text) => {
  assert.ok(quantityFormHtml.includes(text), `数量变更表单缺少：${text}`)
})
assert.ok(quantityFormHtml.includes('新增明细'), '数量变更必须支持新增明细')
assert.ok(quantityFormHtml.includes('已取消') || quantityFormHtml.includes('改为 0'), '数量变更必须表达明细取消')
assert.ok(!quantityFormHtml.includes('变更后总数'), '总数量不能成为输入字段')
```

- [ ] **步骤 4：增加物料替换最终断言**

```typescript
state.productionChangeForm.changeType = 'MATERIAL_REPLACEMENT'
state.productionChangeFormStep = 'content'
const materialFormHtml = renderProductionChangeNewPage()

;[
  '原面料',
  '新面料',
  '剩余数量替换',
  '全部数量替换',
  '只处理当前生产单',
  '后续生产单也替换',
  '建议替换生产数量',
].forEach((text) => {
  assert.ok(materialFormHtml.includes(text), `物料替换表单缺少：${text}`)
})
assert.ok(!materialFormHtml.includes('适用批次'), '物料替换不应出现批次字段')
assert.ok(!materialFormHtml.includes('适用颜色'), '替换对象不能被写成需求明细范围')
assert.ok(!materialFormHtml.includes('适用尺码'), '替换对象不能被写成需求明细范围')
```

- [ ] **步骤 5：增加第三步和第四步断言**

```typescript
state.productionChangeFormStep = 'handling'
const handlingHtml = renderProductionChangeNewPage()
assert.ok(handlingHtml.includes('系统自动处理'), '第三步必须区分系统自动处理项')
assert.ok(handlingHtml.includes('待跟单判断'), '第三步必须集中展示必要判断项')
assert.ok(!handlingHtml.includes('逐项确认'), '第三步不能要求逐单确认')

state.productionChangeFormStep = 'execution'
const executionHtml = renderProductionChangeNewPage()
assert.ok(executionHtml.includes('全部成功才生效'), '第四步必须表达原子提交')
assert.ok(executionHtml.includes('生产单正在变更，请稍后再试'), '第四步必须展示统一锁定提示')
```

- [ ] **步骤 6：增加最终结果类型断言**

```typescript
assert.deepEqual(
  Object.keys(productionOrderChangeResultLabels).sort(),
  ['PRODUCTION_PATCH', 'VERSION_AND_PATCH', 'VERSION_RELATION'].sort(),
  '生产单变更最终结果只能有三种',
)
```

- [ ] **步骤 7：运行检查并确认失败**

运行：

```bash
npm run check:production-order-changes
```

预期：FAIL，至少命中新四步、物料替换字段或第三步必要判断断言。

- [ ] **步骤 8：提交检查契约**

```bash
git add scripts/check-production-order-changes.ts
git commit -m "test: lock final production change workflow"
```

## 任务 2：建立聚焦两类场景的工作流数据模型

**文件：**
- 创建：`src/data/fcs/production-order-change-workflow.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：在检查脚本增加纯领域断言**

从新文件导入：

```typescript
import {
  buildProductionChangePreview,
  inferProductionChangeResult,
  productionChangeResultLabels,
  validateProductionChangeDecisions,
  type ProductionChangeDraft,
} from '../src/data/fcs/production-order-change-workflow.ts'
```

加入结果矩阵：

```typescript
assert.equal(inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion: false }), 'PRODUCTION_PATCH')
assert.equal(inferProductionChangeResult({ changeType: 'QUANTITY_CHANGE', requiresNewFormalVersion: true }), 'VERSION_AND_PATCH')
assert.equal(inferProductionChangeResult({ changeType: 'MATERIAL_REPLACEMENT', replacementMode: 'REMAINING', scope: 'CURRENT_ONLY' }), 'PRODUCTION_PATCH')
assert.equal(inferProductionChangeResult({ changeType: 'MATERIAL_REPLACEMENT', replacementMode: 'REMAINING', scope: 'CURRENT_AND_FOLLOWING' }), 'VERSION_AND_PATCH')
assert.equal(inferProductionChangeResult({ changeType: 'MATERIAL_REPLACEMENT', replacementMode: 'FULL', scope: 'CURRENT_AND_FOLLOWING' }), 'VERSION_RELATION')
```

- [ ] **步骤 2：创建最终类型**

```typescript
export type ProductionChangeType = 'QUANTITY_CHANGE' | 'MATERIAL_REPLACEMENT'
export type ProductionChangeResult = 'PRODUCTION_PATCH' | 'VERSION_RELATION' | 'VERSION_AND_PATCH'
export type MaterialReplacementMode = 'REMAINING' | 'FULL'
export type MaterialReplacementScope = 'CURRENT_ONLY' | 'CURRENT_AND_FOLLOWING'
export type ProductionChangePlanItemKind = 'AUTO' | 'MERCHANDISER_DECISION'

export interface QuantityChangeLine {
  id: string
  skuCode: string
  color: string
  size: string
  originalQty: number
  currentQty: number
  targetQty: number
  unit: '件'
  isNew: boolean
  coveredByCurrentVersion: boolean
}

export interface MaterialReplacementAllocation {
  id: string
  skuCode: string
  color: string
  size: string
  demandQty: number
  oldMaterialFactQty: number
  suggestedReplacementQty: number
  confirmedReplacementQty: number
}

export interface MaterialReplacementDraft {
  originalMaterialId: string
  replacementMaterialId: string
  replacementMode: MaterialReplacementMode
  scope: MaterialReplacementScope
  suggestedProductionQty: number
  confirmedProductionQty: number
  allocations: MaterialReplacementAllocation[]
  followingOrders: Array<{
    productionOrderId: string
    progressText: string
    started: boolean
    suggestedMode: MaterialReplacementMode
    confirmedMode: MaterialReplacementMode
  }>
}

export interface ProductionChangeDraft {
  productionOrderId: string
  changeType: ProductionChangeType
  reason: string
  quantityLines: QuantityChangeLine[]
  materialReplacement: MaterialReplacementDraft
  decisionValues: Record<string, { value: string; reason: string }>
}

export const productionChangeResultLabels: Record<ProductionChangeResult, string> = {
  PRODUCTION_PATCH: '生产单打补丁',
  VERSION_RELATION: '正式版本绑定调整',
  VERSION_AND_PATCH: '生产单打补丁 + 正式版本绑定调整',
}
```

- [ ] **步骤 3：定义第三步和执行类型**

```typescript
export interface ProductionChangePlanItem {
  id: string
  kind: ProductionChangePlanItemKind
  group: '需求与物料' | '上下游单据' | '实物去向' | '成本与交期'
  title: string
  description: string
  affectedDocumentNo: string
  options: Array<{ value: string; label: string }>
  selectedValue: string
  reason: string
  reasonRequired: boolean
}

export interface ProductionChangeExecutionStep {
  id: string
  label: string
  status: 'WAITING' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
}

export interface ProductionChangePreview {
  result: ProductionChangeResult
  resultReason: string
  affectedOrderIds: string[]
  autoItems: ProductionChangePlanItem[]
  decisionItems: ProductionChangePlanItem[]
  summary: {
    affectedOrderCount: number
    affectedDocumentCount: number
    materialDeltaText: string
    costDeltaText: string
    deliveryImpactText: string
  }
  lockObjectIds: string[]
}

export type ProductionChangeStatus = 'DRAFT' | 'READY' | 'EXECUTING' | 'DONE' | 'ROLLED_BACK'

export interface ProductionChangeRecord extends ProductionChangeDraft {
  id: string
  result: ProductionChangeResult
  resultReason: string
  status: ProductionChangeStatus
  preview: ProductionChangePreview
  execution: {
    status: 'IDLE' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
    message: string
    progress: number
    steps: ProductionChangeExecutionStep[]
  }
  createdBy: string
  createdAt: string
}
```

- [ ] **步骤 4：实现三种结果判断**

```typescript
export function inferProductionChangeResult(input: {
  changeType: ProductionChangeType
  requiresNewFormalVersion?: boolean
  replacementMode?: MaterialReplacementMode
  scope?: MaterialReplacementScope
}): ProductionChangeResult {
  if (input.changeType === 'QUANTITY_CHANGE') {
    return input.requiresNewFormalVersion ? 'VERSION_AND_PATCH' : 'PRODUCTION_PATCH'
  }
  if (input.scope === 'CURRENT_ONLY') return 'PRODUCTION_PATCH'
  return input.replacementMode === 'REMAINING' ? 'VERSION_AND_PATCH' : 'VERSION_RELATION'
}

export function quantityChangeRequiresNewFormalVersion(lines: QuantityChangeLine[]): boolean {
  return lines.some((line) => line.isNew && !line.coveredByCurrentVersion)
}
```

- [ ] **步骤 5：实现预览和必要判断校验**

`buildProductionChangePreview(draft)` 必须：

```typescript
const decisionItems = planItems
  .filter((item) => item.kind === 'MERCHANDISER_DECISION')
  .map((item) => ({
    ...item,
    selectedValue: draft.decisionValues[item.id]?.value || item.selectedValue,
    reason: draft.decisionValues[item.id]?.reason || item.reason,
  }))
const autoItems = planItems.filter((item) => item.kind === 'AUTO')

return {
  result,
  resultReason,
  affectedOrderIds,
  autoItems,
  decisionItems,
  summary,
  lockObjectIds: [draft.productionOrderId, ...documentNos],
}
```

校验函数：

```typescript
export function validateProductionChangeDecisions(preview: ProductionChangePreview): string[] {
  return preview.decisionItems
    .filter((item) => !item.selectedValue || (item.reasonRequired && !item.reason.trim()))
    .map((item) => item.id)
}
```

- [ ] **步骤 6：运行检查**

```bash
npm run check:production-order-changes
```

预期：领域矩阵和必要判断断言 PASS；页面断言仍可能 FAIL。

- [ ] **步骤 7：提交聚焦领域模型**

```bash
git add src/data/fcs/production-order-change-workflow.ts scripts/check-production-order-changes.ts
git commit -m "feat: add focused production change workflow"
```

## 任务 3：重构表单状态并准备稳定 Mock

**文件：**
- 修改：`src/pages/production/context.ts`
- 修改：`src/data/fcs/production-order-change-workflow.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：把表单步骤改为最终四步**

```typescript
export type ProductionChangeFormStep = 'order' | 'content' | 'handling' | 'execution'
```

- [ ] **步骤 2：替换 `ProductionChangeForm`**

```typescript
interface ProductionChangeForm {
  changeType: ProductionChangeType
  productionOrderId: string
  reason: string
  quantityLines: QuantityChangeLine[]
  materialReplacement: MaterialReplacementDraft
  decisionValues: Record<string, { value: string; reason: string }>
  advancedAllocationOpen: boolean
  execution: {
    status: 'IDLE' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'
    message: string
    progress: number
    steps: ProductionChangeExecutionStep[]
  }
}
```

删除旧字段：

```typescript
source
modules
changeContent
effectiveMode
executionMode
materialReplacement.colors
materialReplacement.sizes
materialReplacement.effectiveFromText
```

- [ ] **步骤 3：创建安全的空表单工厂**

不要继续使用浅拷贝常量。新增：

```typescript
export function createProductionChangeForm(): ProductionChangeForm {
  return {
    changeType: 'QUANTITY_CHANGE',
    productionOrderId: '',
    reason: '',
    quantityLines: [],
    materialReplacement: createEmptyMaterialReplacementDraft(),
    decisionValues: {},
    advancedAllocationOpen: false,
    execution: createIdleExecutionState(),
  }
}

export function createEmptyMaterialReplacementDraft(): MaterialReplacementDraft {
  return {
    originalMaterialId: '',
    replacementMaterialId: '',
    replacementMode: 'REMAINING',
    scope: 'CURRENT_ONLY',
    suggestedProductionQty: 0,
    confirmedProductionQty: 0,
    allocations: [],
    followingOrders: [],
  }
}

function createIdleExecutionState(): ProductionChangeForm['execution'] {
  return {
    status: 'IDLE',
    message: '',
    progress: 0,
    steps: [],
  }
}
```

- [ ] **步骤 4：按生产单初始化需求明细和物料 Mock**

在工作流文件中使用现有数据：

```typescript
import { resolveLinkedDemandForProductionOrder } from './production-upstream-chain.ts'
import { listMaterialArchives } from '../pcs-material-archive-repository.ts'
import { listProductionOrderTechPackRelations } from './production-tech-pack-change-domain.ts'

export function createQuantityLinesForOrder(productionOrderId: string): QuantityChangeLine[] {
  const demand = resolveLinkedDemandForProductionOrder(productionOrderId)
  return (demand?.skuLines ?? []).map((line, index) => ({
    id: `${productionOrderId}-QTY-${index + 1}`,
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    originalQty: line.qty,
    currentQty: line.qty,
    targetQty: line.qty,
    unit: '件',
    isNew: false,
    coveredByCurrentVersion: true,
  }))
}

export function listReplacementMaterialOptions() {
  return listMaterialArchives('fabric').map((item) => ({ value: item.materialId, label: `${item.materialCode} / ${item.materialName}` }))
}

export function createFollowingOrderPlans(productionOrderId: string): MaterialReplacementDraft['followingOrders'] {
  const relations = listProductionOrderTechPackRelations()
  const source = relations.find((item) => item.productionOrderId === productionOrderId)
  if (!source) return []
  return relations
    .filter((item) => item.spuId === source.spuId && item.productionOrderId !== productionOrderId)
    .filter((item) => !item.progressSummary.some((text) => text.includes('已完成') || text.includes('已结算')))
    .map((item) => {
      const started = item.progressSummary.some((text) => text.includes('已领') || text.includes('已裁') || text.includes('已加工'))
      return {
        productionOrderId: item.productionOrderId,
        progressText: item.progressSummary.join('；') || '尚未开始',
        started,
        suggestedMode: started ? 'REMAINING' : 'FULL',
        confirmedMode: started ? 'REMAINING' : 'FULL',
      }
    })
}

export function buildMaterialReplacementAllocations(
  productionOrderId: string,
  confirmedProductionQty: number,
): MaterialReplacementAllocation[] {
  const lines = createQuantityLinesForOrder(productionOrderId)
  const raw = lines.map((line) => {
    const oldMaterialFactQty = Math.floor(line.currentQty * 0.55)
    return {
      line,
      oldMaterialFactQty,
      suggestedReplacementQty: Math.max(line.currentQty - oldMaterialFactQty, 0),
    }
  })
  const suggestedTotal = raw.reduce((sum, item) => sum + item.suggestedReplacementQty, 0) || 1
  let allocated = 0
  return raw.map((item, index) => {
    const confirmed = index === raw.length - 1
      ? Math.max(confirmedProductionQty - allocated, 0)
      : Math.round((item.suggestedReplacementQty / suggestedTotal) * confirmedProductionQty)
    allocated += confirmed
    return {
      id: `${productionOrderId}-MAT-${index + 1}`,
      skuCode: item.line.skuCode,
      color: item.line.color,
      size: item.line.size,
      demandQty: item.line.currentQty,
      oldMaterialFactQty: item.oldMaterialFactQty,
      suggestedReplacementQty: item.suggestedReplacementQty,
      confirmedReplacementQty: confirmed,
    }
  })
}
```

- [ ] **步骤 5：增加样例覆盖断言**

```typescript
const quantityLines = createQuantityLinesForOrder(relation.productionOrderId)
assert.ok(quantityLines.length >= 2, '数量表单必须有多条颜色尺码需求明细')
assert.ok(listReplacementMaterialOptions().length >= 4, '物料替换必须提供系统物料候选')
```

- [ ] **步骤 6：运行检查并提交**

```bash
npm run check:production-order-changes
git add src/pages/production/context.ts src/data/fcs/production-order-change-workflow.ts scripts/check-production-order-changes.ts
git commit -m "refactor: align production change form state"
```

## 任务 4：实现第一步和两张独立表单

**文件：**
- 创建：`src/pages/production/production-change-form.ts`
- 修改：`src/pages/production/changes-domain.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：创建统一步骤条**

使用现有 `renderSteps()`：

```typescript
const productionChangeSteps = [
  { key: 'order', title: '选择生产单', description: '系统获取当前事实' },
  { key: 'content', title: '填写变更内容', description: '唯一核心数据节点' },
  { key: 'handling', title: '确认处理方案', description: '只判断必要事项' },
  { key: 'execution', title: '同步执行', description: '全部提交或全部回滚' },
]
```

- [ ] **步骤 2：实现第一步生产单选择和事实摘要**

第一步只包含生产单选择器和只读事实，不提供进度输入：

```typescript
export function renderProductionChangeOrderStep(form: ProductionChangeForm): string {
  const facts = form.productionOrderId ? getProductionOrderChangeCurrentFacts(form.productionOrderId) : null
  return `${renderOrderSelect(form.productionOrderId)}${facts ? renderCurrentFactsSummary(facts) : renderEmptyFacts()}`
}
```

- [ ] **步骤 3：实现数量变更表单**

表格列固定为：

```typescript
['商品编码', '颜色', '尺码', '原需求', '当前需求', '变更后数量', '变化', '状态', '操作']
```

提供：

```html
<button data-prod-action="add-production-change-quantity-line">新增明细</button>
<input data-prod-field="productionChangeQuantityTargetQty" data-line-id="..." type="number" min="0">
```

当 `targetQty === 0` 时显示 `已取消`，但保留整行。

“新增明细”创建的新行必须使用：

```typescript
{
  id: `NEW-${crypto.randomUUID()}`,
  skuCode: '',
  color: '',
  size: '',
  originalQty: 0,
  currentQty: 0,
  targetQty: 0,
  unit: '件',
  isNew: true,
  coveredByCurrentVersion: false,
}
```

当新增明细选择到当前正式版本已经覆盖的商品组合时，将 `coveredByCurrentVersion` 更新为 `true`；结果判断使用 `quantityChangeRequiresNewFormalVersion()`。

- [ ] **步骤 4：实现物料替换表单**

表单只保留：

```typescript
renderLabeledSelect('原面料', { options: currentMaterialOptions, field: 'productionChangeOriginalMaterialId', ... })
renderLabeledSelect('新面料', { options: listReplacementMaterialOptions(), field: 'productionChangeReplacementMaterialId', ... })
```

替换方式和范围使用分段按钮：

```html
<button data-prod-action="set-production-change-replacement-mode" data-mode="REMAINING">剩余数量替换</button>
<button data-prod-action="set-production-change-replacement-mode" data-mode="FULL">全部数量替换</button>
<button data-prod-action="set-production-change-scope" data-scope="CURRENT_ONLY">只处理当前生产单</button>
<button data-prod-action="set-production-change-scope" data-scope="CURRENT_AND_FOLLOWING">后续生产单也替换</button>
```

- [ ] **步骤 5：实现建议数量和可展开分配**

默认显示系统建议和确认输入：

```html
<input data-prod-field="productionChangeConfirmedProductionQty" type="number" min="0" max="${totalDemandQty}">
<button data-prod-action="toggle-production-change-allocation">调整颜色尺码分配</button>
```

展开后每行使用：

```html
<input data-prod-field="productionChangeAllocationQty" data-allocation-id="${allocation.id}" type="number" min="0" max="${allocation.demandQty}">
```

- [ ] **步骤 6：在 `changes-domain.ts` 接入新渲染器**

`renderProductionChangeNewPage()` 保留路由外壳，主体改为：

```typescript
${renderProductionChangeFormSteps(state.productionChangeFormStep)}
${renderProductionChangeFormBody(state.productionChangeFormStep, state.productionChangeForm)}
```

删除旧新增页顶部的主管、负责人、审核说明。

- [ ] **步骤 7：运行检查并提交**

```bash
npm run check:production-order-changes
git add src/pages/production/production-change-form.ts src/pages/production/changes-domain.ts scripts/check-production-order-changes.ts
git commit -m "feat: build final production change forms"
```

预期：第一步、两张表单和禁止文案断言 PASS；第三、四步交互断言可能仍 FAIL。

## 任务 5：实现第三步系统处理和必要判断

**文件：**
- 修改：`src/data/fcs/production-order-change-workflow.ts`
- 修改：`src/pages/production/production-change-form.ts`
- 修改：`src/pages/production/events.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：增加第三步 Mock 处理清单**

数量场景至少包含：

```typescript
{
  id: 'AUTO-QTY-CUTTING',
  kind: 'AUTO',
  group: '上下游单据',
  title: '裁剪单未执行数量自动调整',
  description: '已执行数量保持不变，只调整剩余计划并写入变更留痕。',
  affectedDocumentNo: 'CUT-202603-004-01',
  options: [],
  selectedValue: '',
  reason: '',
  reasonRequired: false,
}
```

物料场景至少包含一个必要判断：

```typescript
{
  id: 'DECISION-MATERIAL-FINISHED-GOODS',
  kind: 'MERCHANDISER_DECISION',
  group: '实物去向',
  title: '旧面料成品退出当前需求后的去向',
  description: '全部数量替换后，20 件旧面料成品不再计入当前需求。',
  affectedDocumentNo: 'FG-202603-004-01',
  options: [
    { value: 'STOCK', label: '转库存' },
    { value: 'OTHER_ORDER', label: '转其他生产单' },
    { value: 'DISPOSE', label: '处置' },
  ],
  selectedValue: '',
  reason: '',
  reasonRequired: false,
}
```

当范围为 `CURRENT_AND_FOLLOWING` 时，为每张已开工后续生产单追加：

```typescript
const followingOrderDecisionItems = draft.materialReplacement.followingOrders
  .filter((order) => order.started)
  .map((order) => ({
    id: `DECISION-FOLLOWING-${order.productionOrderId}`,
    kind: 'MERCHANDISER_DECISION' as const,
    group: '上下游单据' as const,
    title: `${order.productionOrderId} 的替换方式`,
    description: `${order.progressText}；系统建议：${order.suggestedMode === 'REMAINING' ? '剩余数量替换' : '全部数量替换'}`,
    affectedDocumentNo: order.productionOrderId,
    options: [
      { value: 'REMAINING', label: '剩余数量替换' },
      { value: 'FULL', label: '全部数量替换' },
    ],
    selectedValue: '',
    reason: '',
    reasonRequired: false,
  }))
```

- [ ] **步骤 2：第三步先展示汇总**

固定四块汇总：

```typescript
['最终变更类型', '数量与物料', '上下游单据', '成本与交期']
```

自动项按模块折叠，只读展示；必要判断项集中放在“待跟单判断”区。

- [ ] **步骤 3：渲染必要判断控件**

```html
<select data-prod-field="productionChangeDecisionValue" data-decision-id="${item.id}">
  <option value="">请选择</option>
  ${item.options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
</select>
```

只有 `reasonRequired` 或用户选择偏离系统建议时显示原因输入：

```html
<textarea data-prod-field="productionChangeDecisionReason" data-decision-id="${item.id}"></textarea>
```

- [ ] **步骤 4：在事件层维护判断状态**

```typescript
if (field === 'productionChangeDecisionValue') {
  const decisionId = node.dataset.decisionId || ''
  state.productionChangeForm.decisionValues[decisionId] = {
    value,
    reason: state.productionChangeForm.decisionValues[decisionId]?.reason || '',
  }
  return
}
```

同理处理 `productionChangeDecisionReason`。

- [ ] **步骤 5：阻断未完成的必要判断**

进入第四步前：

```typescript
const missingDecisionIds = validateProductionChangeDecisions(preview)
if (missingDecisionIds.length > 0) {
  state.productionChangeFormError = `请先完成 ${missingDecisionIds.length} 项待跟单判断。`
  state.productionChangeFormStep = 'handling'
  return true
}
```

- [ ] **步骤 6：运行检查并提交**

```bash
npm run check:production-order-changes
git add src/data/fcs/production-order-change-workflow.ts src/pages/production/production-change-form.ts src/pages/production/events.ts scripts/check-production-order-changes.ts
git commit -m "feat: add focused handling decisions"
```

预期：第三步系统自动项、必要判断和完成校验断言 PASS。

## 任务 6：实现第四步同步执行、锁定和回滚展示

**文件：**
- 修改：`src/data/fcs/production-order-change-workflow.ts`
- 修改：`src/pages/production/production-change-form.ts`
- 修改：`src/pages/production/events.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：增加前台同步执行函数**

原型不创建后台任务，只返回同一次前台操作的执行结果：

```typescript
export function executeProductionChange(preview: ProductionChangePreview, shouldFail = false) {
  const steps: ProductionChangeExecutionStep[] = [
    { id: 'LOCK', label: '锁定处理范围', status: 'DONE' },
    { id: 'RECHECK', label: '最后核对当前事实', status: 'DONE' },
    { id: 'CHANGE', label: '执行全部处理动作', status: shouldFail ? 'ROLLED_BACK' : 'DONE' },
    { id: 'TRACE', label: '写入双向留痕', status: shouldFail ? 'ROLLED_BACK' : 'DONE' },
    { id: 'COMMIT', label: shouldFail ? '全部回滚' : '统一提交', status: 'DONE' },
  ]
  return {
    status: shouldFail ? 'ROLLED_BACK' as const : 'DONE' as const,
    message: shouldFail ? '执行失败，本次没有修改任何单据。' : '全部处理成功并已统一生效。',
    progress: 100,
    steps,
    lockObjectIds: preview.lockObjectIds,
  }
}
```

- [ ] **步骤 2：增加锁定查询**

```typescript
const activeLocks = new Set<string>()

export function isProductionChangeObjectLocked(objectId: string): boolean {
  return activeLocks.has(objectId)
}

export function getProductionChangeLockMessage(): string {
  return '生产单正在变更，请稍后再试'
}
```

执行函数使用 `try/finally` 清除 Mock 锁，失败结果必须是 `ROLLED_BACK`。

- [ ] **步骤 3：渲染执行进度和结果**

第四步固定显示：

```typescript
['锁定处理范围', '最后核对当前事实', '执行全部处理动作', '写入双向留痕', '统一提交']
```

执行前明确显示：

```text
当前进度尚未正式生效，请等待最终处理结果。
```

成功或回滚后显示最终结果和每个步骤状态。

- [ ] **步骤 4：增加一次确认动作**

```typescript
if (action === 'execute-production-change') {
  state.productionChangeForm.execution.status = 'RUNNING'
  const result = executeProductionChange(getProductionChangeFormPreview())
  state.productionChangeForm.execution = result
  return true
}
```

增加 `data-prod-action="simulate-production-change-failure"`，只用于原型演示回滚结果，不放在主操作区。

- [ ] **步骤 5：增加锁定断言**

```typescript
assert.equal(getProductionChangeLockMessage(), '生产单正在变更，请稍后再试')
const failed = executeProductionChange(preview, true)
assert.equal(failed.status, 'ROLLED_BACK')
assert.ok(failed.message.includes('没有修改任何单据'))
```

- [ ] **步骤 6：运行检查并提交**

```bash
npm run check:production-order-changes
git add src/data/fcs/production-order-change-workflow.ts src/pages/production/production-change-form.ts src/pages/production/events.ts scripts/check-production-order-changes.ts
git commit -m "feat: simulate atomic production change execution"
```

## 任务 7：收口列表、详情和留痕页面

**文件：**
- 修改：`src/pages/production/changes-domain.ts`
- 修改：`src/data/fcs/production-order-change-workflow.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：把列表状态收敛到最终状态**

列表只使用：

```typescript
export type ProductionChangeStatus = 'DRAFT' | 'READY' | 'EXECUTING' | 'DONE' | 'ROLLED_BACK'
```

中文展示：

```typescript
{
  DRAFT: '草稿',
  READY: '待确认执行',
  EXECUTING: '同步执行中',
  DONE: '已完成',
  ROLLED_BACK: '已回滚',
}
```

在工作流数据文件中提供页面唯一使用的查询入口：

```typescript
function buildProductionChangeRecord(
  id: string,
  draft: ProductionChangeDraft,
  status: ProductionChangeStatus,
  createdAt: string,
): ProductionChangeRecord {
  const preview = buildProductionChangePreview(draft)
  return {
    ...structuredClone(draft),
    id,
    result: preview.result,
    resultReason: preview.resultReason,
    status,
    preview,
    execution: {
      status: status === 'DONE' ? 'DONE' : status === 'ROLLED_BACK' ? 'ROLLED_BACK' : 'IDLE',
      message: status === 'DONE' ? '全部处理成功并已统一生效。' : status === 'ROLLED_BACK' ? '执行失败，本次没有修改任何单据。' : '',
      progress: status === 'DONE' || status === 'ROLLED_BACK' ? 100 : 0,
      steps: [],
    },
    createdBy: '陈静',
    createdAt,
  }
}

function buildProductionChangeSeedRecords(): ProductionChangeRecord[] {
  const productionOrderId = listProductionOrderTechPackRelations()[0]?.productionOrderId || 'PO-202603-0004'
  const quantityLines = createQuantityLinesForOrder(productionOrderId)
  if (quantityLines[0]) quantityLines[0].targetQty += 20
  const quantityDraft: ProductionChangeDraft = {
    productionOrderId,
    changeType: 'QUANTITY_CHANGE',
    reason: '追加黑色小码需求数量。',
    quantityLines,
    materialReplacement: createEmptyMaterialReplacementDraft(),
    decisionValues: {},
  }
  const materialOptions = listReplacementMaterialOptions()
  const materialDraft: ProductionChangeDraft = {
    productionOrderId,
    changeType: 'MATERIAL_REPLACEMENT',
    reason: '原面料不足，剩余数量改用新面料。',
    quantityLines: createQuantityLinesForOrder(productionOrderId),
    materialReplacement: {
      ...createEmptyMaterialReplacementDraft(),
      originalMaterialId: materialOptions[0]?.value || '',
      replacementMaterialId: materialOptions[1]?.value || materialOptions[0]?.value || '',
      replacementMode: 'REMAINING',
      scope: 'CURRENT_AND_FOLLOWING',
      suggestedProductionQty: 220,
      confirmedProductionQty: 220,
      allocations: buildMaterialReplacementAllocations(productionOrderId, 220),
      followingOrders: createFollowingOrderPlans(productionOrderId),
    },
    decisionValues: {},
  }
  return [
    buildProductionChangeRecord('BG-20260710-001', quantityDraft, 'DONE', '2026-07-10 09:20'),
    buildProductionChangeRecord('BG-20260710-002', materialDraft, 'READY', '2026-07-10 10:15'),
  ]
}

let productionChangeRecords: ProductionChangeRecord[] = buildProductionChangeSeedRecords()

export function listProductionChangeRecords(): ProductionChangeRecord[] {
  return structuredClone(productionChangeRecords)
}

export function getProductionChangeRecord(id: string): ProductionChangeRecord | null {
  const record = productionChangeRecords.find((item) => item.id === id)
  return record ? structuredClone(record) : null
}

export function saveProductionChangeRecord(record: ProductionChangeRecord): void {
  productionChangeRecords = [
    record,
    ...productionChangeRecords.filter((item) => item.id !== record.id),
  ]
}
```

`changes-domain.ts` 的生产单变更列表和详情只从这些新入口读取，不再使用旧 `listProductionOrderChangeOrders()` 和 `getProductionOrderChangeOrder()`。

- [ ] **步骤 2：列表字段改为业务结果**

保留分页，列为：

```typescript
['变更单号', '生产单', '变更场景', '最终结果', '待判断事项', '处理状态', '执行结果', '发起时间', '操作']
```

- [ ] **步骤 3：详情页改为最终结构**

详情页固定模块：

```typescript
['变更内容', '当前事实', '处理方案', '执行结果', '相关单据留痕']
```

删除旧“审核”“负责人”“通知”内容。

- [ ] **步骤 4：补双向留痕 Mock**

```typescript
export interface ProductionChangeDocumentTrace {
  changeOrderId: string
  documentNo: string
  documentTypeLabel: string
  beforeText: string
  afterText: string
  handlingText: string
  executedAt: string
}
```

详情页同时显示：

- 变更单到关联单据的链接。
- 关联单据“来自哪张生产单变更单”的提示。
- 变更前后数量或物料。
- 系统自动处理或跟单判断结果。

- [ ] **步骤 5：运行检查并提交**

```bash
npm run check:production-order-changes
git add src/pages/production/changes-domain.ts src/data/fcs/production-order-change-workflow.ts scripts/check-production-order-changes.ts
git commit -m "feat: finalize production change list and traces"
```

预期：`npm run check:production-order-changes` 全部 PASS。

## 任务 8：增加浏览器端完整流程验收

**文件：**
- 创建：`tests/production-order-change-final.spec.ts`
- 修改：`package.json`

- [ ] **步骤 1：增加数量变更流程测试**

```typescript
import { expect, test, type Page } from '@playwright/test'

async function openMaterialContent(page: Page): Promise<void> {
  await page.goto('/fcs/production/changes/new')
  await page.getByRole('button', { name: '替换物料' }).click()
  await page.getByLabel('选择生产单').selectOption({ index: 1 })
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByLabel('原面料').selectOption({ index: 1 })
  await page.getByLabel('新面料').selectOption({ index: 2 })
  await page.getByRole('button', { name: '剩余数量替换' }).click()
  await page.getByRole('button', { name: '后续生产单也替换' }).click()
  await page.getByLabel('变更原因').fill('原面料不足，剩余数量改用系统中的新面料。')
}

async function openMaterialHandling(page: Page): Promise<void> {
  await openMaterialContent(page)
  await page.getByRole('button', { name: '全部数量替换' }).click()
  await page.getByRole('button', { name: '只处理当前生产单' }).click()
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByRole('heading', { name: '确认处理方案' })).toBeVisible()
}

test('数量变更按需求明细填写', async ({ page }) => {
  await page.goto('/fcs/production/changes/new')
  await page.getByRole('button', { name: '修改需求明细数量' }).click()
  await page.getByLabel('选择生产单').selectOption({ index: 1 })
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.getByRole('heading', { name: '修改需求明细数量' })).toBeVisible()
  await expect(page.getByText('汇总需求数量')).toBeVisible()
  await expect(page.getByRole('button', { name: '新增明细' })).toBeVisible()
})
```

- [ ] **步骤 2：增加物料替换流程测试**

```typescript
test('物料替换支持两种方式和后续生产单范围', async ({ page }) => {
  await openMaterialContent(page)
  await expect(page.getByText('建议替换生产数量')).toBeVisible()
  await expect(page.getByRole('button', { name: '调整颜色尺码分配' })).toBeVisible()
})
```

- [ ] **步骤 3：增加第三步必要判断测试**

```typescript
test('第三步只要求处理必要判断项', async ({ page }) => {
  await openMaterialHandling(page)
  await expect(page.getByText('系统自动处理')).toBeVisible()
  await expect(page.getByText('待跟单判断')).toBeVisible()
  await expect(page.getByText('逐项确认')).toHaveCount(0)
  await page.getByLabel('旧面料成品退出当前需求后的去向').selectOption('STOCK')
  await expect(page.getByRole('button', { name: '确认处理方案' })).toBeEnabled()
})
```

- [ ] **步骤 4：增加第四步执行与回滚测试**

```typescript
test('第四步展示同步执行、锁定和原子结果', async ({ page }) => {
  await openMaterialHandling(page)
  await page.getByLabel('旧面料成品退出当前需求后的去向').selectOption('STOCK')
  await page.getByRole('button', { name: '确认处理方案' }).click()
  await expect(page.getByText('生产单正在变更，请稍后再试')).toBeVisible()
  await expect(page.getByText('全部成功才生效')).toBeVisible()
  await page.getByRole('button', { name: '确认执行' }).click()
  await expect(page.getByText('全部处理成功并已统一生效')).toBeVisible()
})
```

- [ ] **步骤 5：增加视口和文案检查**

```typescript
test('生产单变更页面无横向溢出和旧文案', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/fcs/production/changes/new')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)

  for (const text of ['已分发委托', '主管确认', '相关负责人', '适用批次']) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0)
  }
})
```

- [ ] **步骤 6：增加脚本并运行**

`package.json`：

```json
"test:production-order-change-final:e2e": "playwright test tests/production-order-change-final.spec.ts"
```

运行：

```bash
npm run test:production-order-change-final:e2e
```

预期：全部 PASS。

- [ ] **步骤 7：提交浏览器验收**

```bash
git add tests/production-order-change-final.spec.ts package.json
git commit -m "test: cover final production change flow"
```

## 任务 9：原型治理、视觉验收和最终验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-10-production-order-change-final.md`

- [ ] **步骤 1：创建原型审查记录**

按 `docs/prototype-review-record-template.md` 填写并明确：

```markdown
- 角色：跟单独立完成全流程
- 端类型：管理端 Web
- 人工数据节点：第二步核心填写；第三步只保留必要判断
- 两类表单：修改需求明细数量、替换物料
- 第四步：同步执行、全部提交或全部回滚
- 锁定提示：生产单正在变更，请稍后再试
- 例外：无主管确认、无负责人接单、无物料批次字段
```

- [ ] **步骤 2：运行静态和构建检查**

```bash
npm run check:production-order-changes
npm run check:prototype-design-governance
npm run build
```

预期：三条命令全部成功。

- [ ] **步骤 3：运行浏览器验收**

```bash
npm run test:production-order-change-final:e2e
```

预期：全部 PASS，无横向溢出、空白页或控制台错误。

- [ ] **步骤 4：同步 CodeGraph**

```bash
codegraph sync
codegraph status
```

预期：索引为最新状态，无待同步文件。

- [ ] **步骤 5：人工浏览器复核**

使用内置浏览器依次复核：

1. `/fcs/production/changes`
2. `/fcs/production/changes/new` 的数量变更四步流程
3. `/fcs/production/changes/new` 的物料替换四步流程
4. 一张已完成变更详情
5. 一张已回滚变更详情

检查 1024×768 和 1440×900 两个视口，确认：

- 页面无横向溢出。
- 表格字段不重叠。
- 输入时无整页闪烁或滚动位置丢失。
- 第三步自动项和必要判断项层级清楚。
- 第四步锁定、成功和回滚结果可见。

- [ ] **步骤 6：提交治理记录和最终收口**

```bash
git add docs/prototype-review-records/2026-07-10-production-order-change-final.md
git commit -m "docs: record production change prototype review"
```

## 计划自检

### 规格覆盖度

- 两张独立表单：任务 4。
- 需求明细数量变更、新增和取消：任务 2、3、4。
- 任意系统物料、两种替换方式、后续生产单和可调整分配：任务 2、3、4。
- 三种最终结果：任务 1、2。
- 第三步系统处理与必要判断：任务 5。
- 第四步同步执行、锁定和回滚：任务 6。
- 列表、详情和双向留痕：任务 7。
- 浏览器验收和原型治理：任务 8、9。

### 类型一致性

全计划统一使用：

- `ProductionChangeFormStep = 'order' | 'content' | 'handling' | 'execution'`
- `ProductionChangeResult = 'PRODUCTION_PATCH' | 'VERSION_RELATION' | 'VERSION_AND_PATCH'`
- `MaterialReplacementMode = 'REMAINING' | 'FULL'`
- `MaterialReplacementScope = 'CURRENT_ONLY' | 'CURRENT_AND_FOLLOWING'`
- `ProductionChangePlanItemKind = 'AUTO' | 'MERCHANDISER_DECISION'`
- 执行结果：`'IDLE' | 'RUNNING' | 'DONE' | 'ROLLED_BACK'`

### 禁止占位符扫描

计划已完成占位表达扫描。所有任务均指定文件、类型、函数、命令和预期结果。
