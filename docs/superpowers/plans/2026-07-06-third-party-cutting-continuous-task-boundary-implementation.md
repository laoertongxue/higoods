# 三方裁片与连续任务边界实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按 `docs/superpowers/specs/2026-07-06-third-party-cutting-continuous-task-boundary-design.md` 补齐三方裁片、含裁片连续工序、整单任务、我方辅助/特种工艺加工单之间的生成与展示边界。

**架构：** 新增一个很小的任务边界判定模块，裁片单生成器和辅助/特种工艺生成器只消费这个模块，不在页面里重复写业务判断。页面只展示生成结果和状态解释，PDA 只补含裁片连续任务的裁片完成上报口径。检查脚本覆盖生成、页面展示、PDA 和项目治理。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、本地 mock 数据、现有 `npm run check:*` 脚本。

---

## 0. 文件结构

**创建：**

- `src/data/fcs/task-generation-boundaries.ts`：生产单任务类型边界判定。只暴露纯函数，不读 DOM，不写运行时状态。
- `scripts/check-third-party-cutting-task-boundaries.ts`：本次业务边界的最小可运行验收脚本。
- `docs/prototype-review-records/2026-07-06-third-party-cutting-continuous-task-boundary.md`：原型治理审查记录。

**修改：**

- `package.json`：增加 `check:third-party-cutting-task-boundaries`。
- `src/data/fcs/cutting/generated-cut-orders.ts`：裁片单按任务边界过滤，并标记来源、回流方式、我方加工单策略。
- `src/data/fcs/special-craft-task-generation.ts`：我方辅助/特种工艺加工单按任务边界跳过整单和三方连续任务。
- `src/data/fcs/special-craft-task-orders.ts`：如页面需要展示跳过原因，只读取生成器结果，不单独重新判断。
- `src/pages/task-breakdown.ts`：任务清单展示裁片单状态、唛架状态、可做成衣数、我方加工单策略。
- `src/pages/continuous-dispatch.ts`：连续工序任务分配区分含裁片和不含裁片；含裁片展示唛架与裁片完成上报口径。
- `src/pages/process-factory/cutting/cut-orders-model.ts`：裁片单列表展示来源类型和回流方式。
- `src/pages/process-factory/cutting/cut-orders.ts`：页面列和筛选承接模型字段。
- `src/pages/process-factory/cutting/marker-plan-model.ts`：唛架方案展示含裁片连续任务来源，不强行进入我方铺布流程。
- `src/pages/process-factory/cutting/marker-plan.ts`：页面文案区分“我方裁床执行”和“三方连续任务用唛架”。
- `src/pages/process-factory/cutting/special-processes-model.ts`：特殊工艺页排除三方连续任务内部工艺。
- `src/pages/process-factory/cutting/special-processes.ts`：空态和说明改成“只展示我方内部加工对象”。
- `src/data/fcs/cutting/pda-cutting-task-scenarios.ts`：含裁片连续任务的 PDA mock 补裁片完成上报状态。
- `src/data/fcs/pda-cutting-execution-source.ts`：PDA 投影补部位/颜色/数量/可做成衣数字段。
- `src/pages/pda-cutting-task-detail.ts`：任务详情展示当前任务是否“只上报裁片完成”，不展示我方铺布/入仓闭环。
- `src/pages/pda-cutting-spreading.ts`：只做裁片任务保留铺布/裁剪执行；含裁片连续任务走裁片完成上报入口。
- `src/pages/pda-exec.ts`：PDA 执行列表入口文案区分“裁片任务”和“连续任务裁片上报”。
- `scripts/check-fcs-upstream-cutting-chain.ts`：补裁片单生成边界断言。
- `scripts/check-special-craft-task-generation.ts`：补我方辅助/特种工艺加工单边界断言。
- `scripts/check-pda-cutting-task-spreading-orders.ts`：补含裁片连续任务 PDA 上报断言。

**不修改：**

- 不引入后端接口、数据库表、权限体系。
- 不改整单任务 PDA 内部执行流程。
- 不把三方工厂内部辅助/特种工艺拆成我方加工单。
- 不重构 React、状态管理或路由总结构。

---

## 任务 1：新增任务边界判定模块

**文件：**

- 创建：`src/data/fcs/task-generation-boundaries.ts`
- 创建：`scripts/check-third-party-cutting-task-boundaries.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的边界检查脚本**

创建 `scripts/check-third-party-cutting-task-boundaries.ts`：

```typescript
import assert from 'node:assert/strict'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateCutOrderForProductionOrder,
  shouldGenerateInternalCraftOrderForProductionOrder,
} from '../src/data/fcs/task-generation-boundaries.ts'

const wholeOrder = productionOrders.find((order) => order.taskBreakdownSummary.wholeOrderTaskCount > 0)
assert(wholeOrder, '必须存在整单任务生产单样本')
assert.equal(resolveProductionOrderTaskBoundary(wholeOrder).kind, 'WHOLE_ORDER')
assert.equal(shouldGenerateCutOrderForProductionOrder(wholeOrder), false, '整单任务不得生成裁片单')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(wholeOrder), false, '整单任务不得生成我方辅助/特种工艺加工单')

const continuousWithCutting = productionOrders.find((order) =>
  order.taskBreakdownSummary.combinedProcessTaskCount > 0
  && order.taskBreakdownSummary.coveredProcessNames.some((name) => name.includes('裁')),
)
assert(continuousWithCutting, '必须存在含裁片连续工序任务生产单样本')
assert.equal(resolveProductionOrderTaskBoundary(continuousWithCutting).kind, 'CONTINUOUS_WITH_CUTTING')
assert.equal(shouldGenerateCutOrderForProductionOrder(continuousWithCutting), true, '含裁片连续工序任务必须生成裁片单')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(continuousWithCutting), false, '含裁片连续工序任务不得生成我方加工单')

const independentCutting = productionOrders.find((order) =>
  order.taskBreakdownSummary.wholeOrderTaskCount === 0
  && order.taskBreakdownSummary.combinedProcessTaskCount === 0
  && order.taskBreakdownSummary.coveredProcessNames.some((name) => name.includes('裁')),
)
assert(independentCutting, '必须存在独立裁片任务生产单样本')
assert.equal(resolveProductionOrderTaskBoundary(independentCutting).kind, 'INDEPENDENT_CUTTING')
assert.equal(shouldGenerateCutOrderForProductionOrder(independentCutting), true, '独立裁片任务必须生成裁片单')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(independentCutting), true, '独立裁片任务回我方链路时必须生成我方加工单')

console.log('check-third-party-cutting-task-boundaries PASS')
```

- [ ] **步骤 2：把检查命令加入 `package.json`**

在 `scripts` 中增加：

```json
"check:third-party-cutting-task-boundaries": "tsx scripts/check-third-party-cutting-task-boundaries.ts"
```

- [ ] **步骤 3：运行检查并确认失败**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
```

预期：FAIL，报错包含 `Cannot find module '../src/data/fcs/task-generation-boundaries.ts'`。

- [ ] **步骤 4：实现最小边界模块**

创建 `src/data/fcs/task-generation-boundaries.ts`：

```typescript
import type { ProductionOrder } from './production-orders.ts'

export type ProductionOrderTaskBoundaryKind =
  | 'WHOLE_ORDER'
  | 'CONTINUOUS_WITH_CUTTING'
  | 'CONTINUOUS_WITHOUT_CUTTING'
  | 'INDEPENDENT_CUTTING'
  | 'INDEPENDENT_NON_CUTTING'

export interface ProductionOrderTaskBoundary {
  kind: ProductionOrderTaskBoundaryKind
  label: string
  generateCutOrder: boolean
  generateInternalCraftOrder: boolean
  cutOrderSourceLabel: string
  cutReturnModeLabel: string
  internalCraftPolicyLabel: string
}

function hasCuttingName(names: string[]): boolean {
  return names.some((name) => ['裁片', '裁剪', '定位裁', '裁床'].some((token) => name.includes(token)))
}

export function resolveProductionOrderTaskBoundary(order: ProductionOrder): ProductionOrderTaskBoundary {
  const summary = order.taskBreakdownSummary
  const includesCutting = hasCuttingName(summary.coveredProcessNames ?? [])

  if (summary.wholeOrderTaskCount > 0) {
    return {
      kind: 'WHOLE_ORDER',
      label: '整单任务',
      generateCutOrder: false,
      generateInternalCraftOrder: false,
      cutOrderSourceLabel: '不生成裁片单',
      cutReturnModeLabel: '整单工厂内部处理',
      internalCraftPolicyLabel: '不生成我方加工单',
    }
  }

  if (summary.combinedProcessTaskCount > 0) {
    return {
      kind: includesCutting ? 'CONTINUOUS_WITH_CUTTING' : 'CONTINUOUS_WITHOUT_CUTTING',
      label: includesCutting ? '含裁片连续工序任务' : '不含裁片连续工序任务',
      generateCutOrder: includesCutting,
      generateInternalCraftOrder: false,
      cutOrderSourceLabel: includesCutting ? '含裁片连续任务' : '不生成裁片单',
      cutReturnModeLabel: includesCutting ? '三方上报裁片完成' : '不涉及裁片',
      internalCraftPolicyLabel: '不生成我方加工单',
    }
  }

  return {
    kind: includesCutting ? 'INDEPENDENT_CUTTING' : 'INDEPENDENT_NON_CUTTING',
    label: includesCutting ? '独立裁片任务' : '独立非裁片任务',
    generateCutOrder: includesCutting,
    generateInternalCraftOrder: includesCutting,
    cutOrderSourceLabel: includesCutting ? '独立裁片任务' : '不生成裁片单',
    cutReturnModeLabel: includesCutting ? '回我方裁床待交出仓' : '不涉及裁片',
    internalCraftPolicyLabel: includesCutting ? '回仓后生成我方加工单' : '按工序自身规则',
  }
}

export function shouldGenerateCutOrderForProductionOrder(order: ProductionOrder): boolean {
  return resolveProductionOrderTaskBoundary(order).generateCutOrder
}

export function shouldGenerateInternalCraftOrderForProductionOrder(order: ProductionOrder): boolean {
  return resolveProductionOrderTaskBoundary(order).generateInternalCraftOrder
}
```

- [ ] **步骤 5：运行检查确认通过**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
```

预期：PASS，输出 `check-third-party-cutting-task-boundaries PASS`。

- [ ] **步骤 6：Commit**

```bash
git add package.json scripts/check-third-party-cutting-task-boundaries.ts src/data/fcs/task-generation-boundaries.ts
git commit -m "feat: add production task boundary rules"
```

---

## 任务 2：裁片单生成按边界过滤并标记来源

**文件：**

- 修改：`src/data/fcs/cutting/generated-cut-orders.ts`
- 修改：`scripts/check-third-party-cutting-task-boundaries.ts`
- 修改：`scripts/check-fcs-upstream-cutting-chain.ts`

- [ ] **步骤 1：扩展失败断言**

在 `scripts/check-third-party-cutting-task-boundaries.ts` 追加：

```typescript
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'

const cutOrders = listGeneratedCutOrderSourceRecords()
assert(
  cutOrders.every((record) => record.productionOrderId !== wholeOrder.productionOrderId),
  '整单任务生产单不得出现在裁片单列表',
)
assert(
  cutOrders.some((record) =>
    record.productionOrderId === continuousWithCutting.productionOrderId
    && record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK'
    && record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY'
    && record.internalCraftOrderPolicy === 'DO_NOT_GENERATE',
  ),
  '含裁片连续任务裁片单必须标记为三方上报裁片完成，且不生成我方加工单',
)
assert(
  cutOrders.some((record) =>
    record.productionOrderId === independentCutting.productionOrderId
    && record.cutOrderSourceType === 'INDEPENDENT_CUTTING_TASK'
    && record.cutReturnMode === 'RETURN_TO_OWN_CUTTING_WAREHOUSE'
    && record.internalCraftOrderPolicy === 'GENERATE_AFTER_RETURN',
  ),
  '独立裁片任务裁片单必须标记为回我方裁床待交出仓，且回仓后生成我方加工单',
)
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
```

预期：FAIL，报错包含 `cutOrderSourceType` 或 `整单任务生产单不得出现在裁片单列表`。

- [ ] **步骤 3：扩展裁片单记录类型**

在 `GeneratedCutOrderSourceRecord` 增加字段：

```typescript
  cutOrderSourceType: 'INDEPENDENT_CUTTING_TASK' | 'CONTINUOUS_WITH_CUTTING_TASK'
  cutOrderSourceLabel: string
  cutReturnMode: 'RETURN_TO_OWN_CUTTING_WAREHOUSE' | 'THIRD_PARTY_REPORT_ONLY'
  cutReturnModeLabel: string
  internalCraftOrderPolicy: 'GENERATE_AFTER_RETURN' | 'DO_NOT_GENERATE'
  internalCraftOrderPolicyLabel: string
```

- [ ] **步骤 4：在生成器里消费边界模块**

在 `src/data/fcs/cutting/generated-cut-orders.ts` 顶部增加：

```typescript
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateCutOrderForProductionOrder,
} from '../task-generation-boundaries.ts'
```

在 `buildRecordsForOrder(order)` 开头加入：

```typescript
  const boundary = resolveProductionOrderTaskBoundary(order)
  if (!shouldGenerateCutOrderForProductionOrder(order)) return []
```

在返回记录时追加：

```typescript
      cutOrderSourceType:
        boundary.kind === 'CONTINUOUS_WITH_CUTTING'
          ? 'CONTINUOUS_WITH_CUTTING_TASK'
          : 'INDEPENDENT_CUTTING_TASK',
      cutOrderSourceLabel: boundary.cutOrderSourceLabel,
      cutReturnMode:
        boundary.kind === 'CONTINUOUS_WITH_CUTTING'
          ? 'THIRD_PARTY_REPORT_ONLY'
          : 'RETURN_TO_OWN_CUTTING_WAREHOUSE',
      cutReturnModeLabel: boundary.cutReturnModeLabel,
      internalCraftOrderPolicy:
        boundary.kind === 'CONTINUOUS_WITH_CUTTING'
          ? 'DO_NOT_GENERATE'
          : 'GENERATE_AFTER_RETURN',
      internalCraftOrderPolicyLabel: boundary.internalCraftPolicyLabel,
```

- [ ] **步骤 5：克隆与场景记录保留新字段**

在 `listGeneratedCutOrderSourceRecords()` 克隆返回中保持字段不变；在 `buildScenarioRecord()` 的 `return { ...seed }` 已继承字段，不要覆盖。

- [ ] **步骤 6：补上游裁片链检查**

在 `scripts/check-fcs-upstream-cutting-chain.ts` 的 `ensureGeneratedCutOrdersTraceable()` 中追加：

```typescript
    assert(record.cutOrderSourceLabel, `裁片单 ${record.cutOrderNo} 缺少来源类型`)
    assert(record.cutReturnModeLabel, `裁片单 ${record.cutOrderNo} 缺少回流方式`)
    assert(record.internalCraftOrderPolicyLabel, `裁片单 ${record.cutOrderNo} 缺少我方加工单策略`)
    assert(record.cutOrderSourceType !== 'CONTINUOUS_WITH_CUTTING_TASK' || record.internalCraftOrderPolicy === 'DO_NOT_GENERATE', `含裁片连续任务裁片单 ${record.cutOrderNo} 不得生成我方加工单`)
```

- [ ] **步骤 7：运行检查确认通过**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
npm run check:fcs-upstream-cutting-chain
```

预期：两个命令均 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/data/fcs/cutting/generated-cut-orders.ts scripts/check-third-party-cutting-task-boundaries.ts scripts/check-fcs-upstream-cutting-chain.ts
git commit -m "feat: apply task boundary to cut orders"
```

---

## 任务 3：我方辅助/特种工艺加工单按边界生成

**文件：**

- 修改：`src/data/fcs/special-craft-task-generation.ts`
- 修改：`scripts/check-special-craft-task-generation.ts`
- 修改：`scripts/check-third-party-cutting-task-boundaries.ts`

- [ ] **步骤 1：编写失败断言**

在 `scripts/check-third-party-cutting-task-boundaries.ts` 追加：

```typescript
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../src/data/fcs/special-craft-task-generation.ts'

function generateCraftOrderCount(order: typeof productionOrders[number]): number {
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    productionOrder: order,
    techPackSnapshot: getProductionOrderTechPackSnapshot(order.productionOrderId),
  }).taskOrders.length
}

assert.equal(generateCraftOrderCount(wholeOrder), 0, '整单任务不得生成我方辅助/特种工艺加工单')
assert.equal(generateCraftOrderCount(continuousWithCutting), 0, '含裁片连续工序任务不得生成我方辅助/特种工艺加工单')
assert(generateCraftOrderCount(independentCutting) > 0, '独立裁片任务存在技术包工艺标记时必须生成我方加工单')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
```

预期：FAIL，至少一个整单或连续任务仍生成了我方加工单。

- [ ] **步骤 3：在生成器里增加边界跳过**

在 `src/data/fcs/special-craft-task-generation.ts` 顶部增加：

```typescript
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateInternalCraftOrderForProductionOrder,
} from './task-generation-boundaries.ts'
```

在 `generateSpecialCraftTaskOrdersFromProductionOrder()` 计算 `generationBatchId` 后、读取技术包前加入：

```typescript
  const boundary = resolveProductionOrderTaskBoundary(productionOrder)
  if (!shouldGenerateInternalCraftOrderForProductionOrder(productionOrder)) {
    const generationBatch: SpecialCraftTaskGenerationBatch = {
      generationBatchId,
      productionOrderId: productionOrder.productionOrderId,
      productionOrderNo: resolveProductionOrderNo(productionOrder),
      productionOrderVersion,
      techPackSnapshotId: techPackSnapshot?.snapshotId || '',
      techPackVersion: techPackSnapshot?.sourceTechPackVersionLabel || techPackSnapshot?.versionLabel || '',
      generatedAt,
      generatedBy: '系统',
      generatedTaskOrderIds: [],
      generatedLineCount: 0,
      status: '已跳过',
      errorList: [],
      warningList: [`${boundary.label}不生成我方辅助/特种工艺加工单`],
    }
    return {
      taskOrders: [],
      generationBatch,
      errors: [],
      warnings: generationBatch.warningList,
      demandLines: [],
    }
  }
```

- [ ] **步骤 4：扩展特殊工艺生成脚本**

在 `scripts/check-special-craft-task-generation.ts` 中导入边界模块：

```typescript
import { shouldGenerateInternalCraftOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
```

在 `const allStoreTasks = listSpecialCraftTaskOrders()` 后加入：

```typescript
assert(
  allStoreTasks.every((task) => {
    const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
    return Boolean(order && shouldGenerateInternalCraftOrderForProductionOrder(order))
  }),
  '特殊工艺加工单列表只能包含我方内部加工对象',
)
```

- [ ] **步骤 5：运行检查确认通过**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
npm run check:special-craft-task-generation
```

预期：两个命令均 PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/special-craft-task-generation.ts scripts/check-special-craft-task-generation.ts scripts/check-third-party-cutting-task-boundaries.ts
git commit -m "feat: apply task boundary to craft generation"
```

---

## 任务 4：补齐任务清单和连续工序分配展示

**文件：**

- 修改：`src/pages/task-breakdown.ts`
- 修改：`src/pages/continuous-dispatch.ts`
- 修改：`scripts/check-fcs-task-generation-rules.ts`
- 修改：`scripts/check-third-party-cutting-task-boundaries.ts`

- [ ] **步骤 1：编写页面源码断言**

在 `scripts/check-third-party-cutting-task-boundaries.ts` 增加源码检查：

```typescript
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const taskBreakdownSource = readFileSync(resolve('src/pages/task-breakdown.ts'), 'utf8')
const continuousDispatchSource = readFileSync(resolve('src/pages/continuous-dispatch.ts'), 'utf8')

;[
  '裁片单状态',
  '唛架状态',
  '可做成衣数',
  '我方加工单策略',
  'cutOrderSourceLabel',
  'internalCraftOrderPolicyLabel',
].forEach((token) => {
  assert(taskBreakdownSource.includes(token), `任务清单缺少 ${token}`)
})

;[
  '含裁片连续任务',
  '不含裁片连续任务',
  '三方上报裁片完成',
  '不生成我方加工单',
].forEach((token) => {
  assert(continuousDispatchSource.includes(token), `连续工序任务分配页缺少 ${token}`)
})
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
```

预期：FAIL，报错说明任务清单或连续分配页缺少上述文案/字段。

- [ ] **步骤 3：任务清单消费裁片单来源**

在 `src/pages/task-breakdown.ts` 导入：

```typescript
import { listGeneratedCutOrderSourceRecords } from '../data/fcs/cutting/generated-cut-orders.ts'
```

新增按生产单聚合的 helper：

```typescript
function getCutOrderBoundarySummary(productionOrderId: string): {
  cutOrderStatus: string
  markerPlanStatus: string
  garmentQtyText: string
  internalCraftPolicyText: string
} {
  const records = listGeneratedCutOrderSourceRecords().filter((record) => record.productionOrderId === productionOrderId)
  if (records.length === 0) {
    return {
      cutOrderStatus: '不生成裁片单',
      markerPlanStatus: '不涉及唛架',
      garmentQtyText: '—',
      internalCraftPolicyText: '不生成我方加工单',
    }
  }
  const qty = records.reduce((sum, record) => sum + record.skuScopeLines.reduce((lineSum, line) => lineSum + Number(line.plannedQty || 0), 0), 0)
  return {
    cutOrderStatus: `${records.length} 张裁片单`,
    markerPlanStatus: records.some((record) => record.markerPlanNo) ? '已有唛架' : '待排唛架',
    garmentQtyText: `${qty.toLocaleString()} 件`,
    internalCraftPolicyText: records[0]?.internalCraftOrderPolicyLabel || '—',
  }
}
```

在全部任务表的任务信息列或详情入口附近展示：

```typescript
const cutSummary = getCutOrderBoundarySummary(task.productionOrderId)
```

并渲染：

```typescript
<div class="mt-1 text-xs text-muted-foreground">裁片单状态：${escapeHtml(cutSummary.cutOrderStatus)}</div>
<div class="text-xs text-muted-foreground">唛架状态：${escapeHtml(cutSummary.markerPlanStatus)}</div>
<div class="text-xs text-muted-foreground">可做成衣数：${escapeHtml(cutSummary.garmentQtyText)}</div>
<div class="text-xs text-muted-foreground">我方加工单策略：${escapeHtml(cutSummary.internalCraftPolicyText)}</div>
```

- [ ] **步骤 4：连续分配页区分含裁片**

在 `src/pages/continuous-dispatch.ts` 增加：

```typescript
function isCuttingContinuousTask(task: RuntimeProcessTask): boolean {
  return getCoveredProcessNames(task).some((name) => name.includes('裁'))
}
```

扩展 tab：

```typescript
type ContinuousDispatchTab = 'SEWING_POST' | 'WITH_CUTTING' | 'OTHER'
```

筛选逻辑调整为：

```typescript
.filter((task) => {
  if (state.tab === 'SEWING_POST') return isSewingPostContinuousTask(task)
  if (state.tab === 'WITH_CUTTING') return isCuttingContinuousTask(task) && !isSewingPostContinuousTask(task)
  return !isSewingPostContinuousTask(task) && !isCuttingContinuousTask(task)
})
```

`renderReadiness(task)` 中对含裁片连续任务返回：

```typescript
if (isCuttingContinuousTask(task)) {
  return `
    <div class="space-y-1 text-xs">
      <div><span class="text-muted-foreground">裁片单：</span><span class="font-medium text-blue-700">由我方裁床排唛架</span></div>
      <div><span class="text-muted-foreground">裁片完成：</span><span class="font-medium text-emerald-700">三方上报裁片完成数量和可做成衣数</span></div>
      <div class="text-muted-foreground">不生成我方加工单，辅助/特种工艺作为验收关注点。</div>
    </div>
  `
}
```

- [ ] **步骤 5：同步现有任务规则检查**

在 `scripts/check-fcs-task-generation-rules.ts` 连续分配页断言中增加：

```typescript
assertIncludes(continuousDispatchSource, '含裁片连续任务', '连续工序任务分配页缺少含裁片 Tab')
assertIncludes(continuousDispatchSource, '三方上报裁片完成数量和可做成衣数', '含裁片连续任务必须展示裁片完成上报口径')
assertIncludes(continuousDispatchSource, '不生成我方加工单', '含裁片连续任务必须说明不生成我方加工单')
```

- [ ] **步骤 6：运行检查确认通过**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
npm run check:fcs-task-generation-rules
```

预期：两个命令均 PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/task-breakdown.ts src/pages/continuous-dispatch.ts scripts/check-fcs-task-generation-rules.ts scripts/check-third-party-cutting-task-boundaries.ts
git commit -m "feat: show cutting boundary on task pages"
```

---

## 任务 5：PFOS 裁片单、唛架、特殊工艺页面同步展示边界

**文件：**

- 修改：`src/pages/process-factory/cutting/cut-orders-model.ts`
- 修改：`src/pages/process-factory/cutting/cut-orders.ts`
- 修改：`src/pages/process-factory/cutting/marker-plan-model.ts`
- 修改：`src/pages/process-factory/cutting/marker-plan.ts`
- 修改：`src/pages/process-factory/cutting/special-processes-model.ts`
- 修改：`src/pages/process-factory/cutting/special-processes.ts`
- 修改：`scripts/check-third-party-cutting-task-boundaries.ts`

- [ ] **步骤 1：编写失败断言**

在 `scripts/check-third-party-cutting-task-boundaries.ts` 增加：

```typescript
const cutOrdersPageSource = readFileSync(resolve('src/pages/process-factory/cutting/cut-orders.ts'), 'utf8')
const markerPlanSource = readFileSync(resolve('src/pages/process-factory/cutting/marker-plan.ts'), 'utf8')
const specialProcessesSource = readFileSync(resolve('src/pages/process-factory/cutting/special-processes.ts'), 'utf8')

;[
  '裁片单来源',
  '回流方式',
  '我方加工单策略',
].forEach((token) => {
  assert(cutOrdersPageSource.includes(token), `裁片单页面缺少 ${token}`)
})

assert(markerPlanSource.includes('三方连续任务用唛架'), '唛架页面必须说明含裁片连续任务只使用我方唛架')
assert(specialProcessesSource.includes('只展示我方内部加工对象'), '特殊工艺页面必须说明不展示三方连续任务内部工艺')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
```

预期：FAIL，报错说明 PFOS 页面缺少边界文案。

- [ ] **步骤 3：裁片单模型透传字段**

在 `cut-orders-model.ts` 的列表行类型中追加：

```typescript
  cutOrderSourceLabel: record.cutOrderSourceLabel,
  cutReturnModeLabel: record.cutReturnModeLabel,
  internalCraftOrderPolicyLabel: record.internalCraftOrderPolicyLabel,
```

- [ ] **步骤 4：裁片单页面增加列**

在 `cut-orders.ts` 表头增加：

```typescript
<th class="px-3 py-2 text-left font-medium">裁片单来源</th>
<th class="px-3 py-2 text-left font-medium">回流方式</th>
<th class="px-3 py-2 text-left font-medium">我方加工单策略</th>
```

在行渲染增加：

```typescript
<td class="px-3 py-3 text-xs">${escapeHtml(row.cutOrderSourceLabel)}</td>
<td class="px-3 py-3 text-xs">${escapeHtml(row.cutReturnModeLabel)}</td>
<td class="px-3 py-3 text-xs">${escapeHtml(row.internalCraftOrderPolicyLabel)}</td>
```

- [ ] **步骤 5：唛架页面展示含裁片连续任务说明**

在 `marker-plan-model.ts` 透传 `cutOrderSourceLabel` 与 `cutReturnModeLabel`。

在 `marker-plan.ts` 的唛架来源区域增加：

```typescript
<div class="text-xs text-muted-foreground">三方连续任务用唛架：仅用于给三方工厂裁片依据，不进入我方铺布/入仓闭环。</div>
```

- [ ] **步骤 6：特殊工艺页面排除三方连续任务内部工艺**

在 `special-processes-model.ts` 读取特殊工艺任务时保持使用 `listSpecialCraftTaskOrders()` 结果，不新增从裁片单反推任务的逻辑。

在 `special-processes.ts` 页头增加：

```typescript
<p class="mt-1 text-sm text-muted-foreground">只展示我方内部加工对象；三方连续任务内部工艺不生成我方加工单。</p>
```

- [ ] **步骤 7：运行检查确认通过**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
npm run check:cutting-clean-mainline
npm run check:special-craft-task-generation
```

预期：三个命令均 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/process-factory/cutting/cut-orders-model.ts src/pages/process-factory/cutting/cut-orders.ts src/pages/process-factory/cutting/marker-plan-model.ts src/pages/process-factory/cutting/marker-plan.ts src/pages/process-factory/cutting/special-processes-model.ts src/pages/process-factory/cutting/special-processes.ts scripts/check-third-party-cutting-task-boundaries.ts
git commit -m "feat: show cutting boundary in pfos pages"
```

---

## 任务 6：PDA 区分独立裁片执行和连续任务裁片完成上报

**文件：**

- 修改：`src/data/fcs/cutting/pda-cutting-task-scenarios.ts`
- 修改：`src/data/fcs/pda-cutting-execution-source.ts`
- 修改：`src/pages/pda-cutting-task-detail.ts`
- 修改：`src/pages/pda-cutting-spreading.ts`
- 修改：`src/pages/pda-exec.ts`
- 修改：`scripts/check-pda-cutting-task-spreading-orders.ts`
- 修改：`scripts/check-third-party-cutting-task-boundaries.ts`

- [ ] **步骤 1：编写失败断言**

在 `scripts/check-pda-cutting-task-spreading-orders.ts` 追加：

```typescript
const continuousCuttingTask = listPdaCuttingTaskSourceRecords().find((item) =>
  item.taskNo.includes('连续') || item.taskId.includes('CONTINUOUS-CUTTING'),
)
assert.ok(continuousCuttingTask, '必须存在含裁片连续任务 PDA mock')

const continuousDetail = getPdaCuttingTaskSnapshot(continuousCuttingTask.taskId)
assert.ok(continuousDetail, '必须能读取含裁片连续任务 PDA 投影')
assert.equal(continuousDetail.cuttingReportMode, 'CONTINUOUS_TASK_CUTTING_COMPLETION', '含裁片连续任务必须走裁片完成上报模式')
assert.ok(continuousDetail.cutPieceOrders.every((line) => line.primaryExecutionRouteKey !== 'inbound'), '含裁片连续任务不得进入我方入仓闭环')

const continuousHtml = renderPdaCuttingTaskDetailPage(continuousCuttingTask.taskId)
assert.ok(continuousHtml.includes('裁片完成上报'), '含裁片连续任务详情必须显示裁片完成上报')
assert.ok(continuousHtml.includes('可做成衣数'), '含裁片连续任务详情必须显示可做成衣数')
assert.equal(continuousHtml.includes('入待交出仓'), false, '含裁片连续任务不得显示入我方待交出仓')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:pda-cutting-task-spreading-orders
```

预期：FAIL，报错包含 `必须存在含裁片连续任务 PDA mock` 或 `cuttingReportMode`。

- [ ] **步骤 3：PDA 场景补任务模式字段**

在 `PdaCuttingResolvedTaskScenario` 和相关 source record 增加：

```typescript
  cuttingReportMode: 'INDEPENDENT_CUTTING_EXECUTION' | 'CONTINUOUS_TASK_CUTTING_COMPLETION'
  cutCompletionPartRows?: Array<{
    partName: string
    colorName: string
    cutPieceQty: number
    garmentAvailableQty: number
  }>
```

在含裁片连续任务 mock 里增加一条稳定样本。裁片单号必须从已生成的含裁片连续任务裁片单动态取得，避免手写不存在的单号：

```typescript
const continuousCutOrder = listGeneratedCutOrderSourceRecords().find(
  (record) => record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK',
)

if (continuousCutOrder) {
  PDA_CUTTING_TASK_MOCK_MATRIX.push({
  taskId: 'TASK-CONTINUOUS-CUTTING-0001',
  taskNo: '含裁片连续任务-裁片上报',
  origin: 'PRODUCTION_TASK',
  cuttingReportMode: 'CONTINUOUS_TASK_CUTTING_COMPLETION',
  cutCompletionPartRows: [
    { partName: '前片', colorName: 'Black', cutPieceQty: 1200, garmentAvailableQty: 600 },
    { partName: '后片', colorName: 'Black', cutPieceQty: 1200, garmentAvailableQty: 600 },
  ],
  executions: [
    {
      executionOrderId: 'CPO-CONT-0001',
      executionOrderNo: '连续任务裁片完成上报',
      executionObjectType: 'SPREADING_ORDER',
      bindingState: 'BOUND',
      productionOrderNo: continuousCutOrder.productionOrderNo,
      cutOrderNo: continuousCutOrder.cutOrderNo,
      markerPlanId: continuousCutOrder.markerPlanId,
      markerPlanNo: continuousCutOrder.markerPlanNo,
      materialSku: continuousCutOrder.materialSku,
    },
  ],
  })
}
```

- [ ] **步骤 4：PDA 投影透传上报模式**

在 `PdaCuttingTaskDetailData` 增加：

```typescript
  cuttingReportMode: 'INDEPENDENT_CUTTING_EXECUTION' | 'CONTINUOUS_TASK_CUTTING_COMPLETION'
  cutCompletionPartRows: Array<{
    partName: string
    colorName: string
    cutPieceQty: number
    garmentAvailableQty: number
  }>
```

构建 snapshot 时：

```typescript
cuttingReportMode: scenario.cuttingReportMode || 'INDEPENDENT_CUTTING_EXECUTION',
cutCompletionPartRows: scenario.cutCompletionPartRows ?? [],
```

- [ ] **步骤 5：PDA 页面按模式显示**

在 `pda-cutting-task-detail.ts`：

```typescript
if (detail.cuttingReportMode === 'CONTINUOUS_TASK_CUTTING_COMPLETION') {
  return renderContinuousCuttingCompletionDetail(detail)
}
```

新增渲染函数：

```typescript
function renderContinuousCuttingCompletionDetail(detail: PdaCuttingTaskDetailData): string {
  return `
    <section class="space-y-3">
      <h1 class="text-lg font-semibold">裁片完成上报</h1>
      <div class="rounded-xl border bg-card p-3 text-sm">
        <div class="text-muted-foreground">当前任务为含裁片连续工序任务，只上报裁片完成数量和可做成衣数。</div>
      </div>
      <div class="space-y-2">
        ${detail.cutCompletionPartRows.map((row) => `
          <div class="rounded-xl border bg-card p-3">
            <div class="font-semibold">${escapeHtml(row.partName)} / ${escapeHtml(row.colorName)}</div>
            <div class="mt-1 text-sm">裁片数量：${row.cutPieceQty.toLocaleString()} 片</div>
            <div class="text-sm">可做成衣数：${row.garmentAvailableQty.toLocaleString()} 件</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}
```

在 `pda-cutting-spreading.ts` 中，如果 `detail.cuttingReportMode === 'CONTINUOUS_TASK_CUTTING_COMPLETION'`，不要渲染铺布、入仓、交出动作，只渲染上报表单和确认按钮。

- [ ] **步骤 6：PDA 执行列表入口文案**

在 `pda-exec.ts` 裁片任务入口摘要中增加：

```typescript
const actionText = task.cuttingReportMode === 'CONTINUOUS_TASK_CUTTING_COMPLETION'
  ? '上报裁片完成'
  : '进入裁片'
```

- [ ] **步骤 7：运行 PDA 检查确认通过**

运行：

```bash
npm run check:pda-cutting-task-spreading-orders
npm run check:third-party-cutting-task-boundaries
```

预期：两个命令均 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/data/fcs/cutting/pda-cutting-task-scenarios.ts src/data/fcs/pda-cutting-execution-source.ts src/pages/pda-cutting-task-detail.ts src/pages/pda-cutting-spreading.ts src/pages/pda-exec.ts scripts/check-pda-cutting-task-spreading-orders.ts scripts/check-third-party-cutting-task-boundaries.ts
git commit -m "feat: add continuous cutting PDA reporting"
```

---

## 任务 7：补齐页面可见验收和性能验证

**文件：**

- 修改：`scripts/check-third-party-cutting-task-boundaries.ts`
- 修改：`scripts/check-fcs-task-generation-rules.ts`

- [ ] **步骤 1：补 HTML 渲染断言**

在 `scripts/check-third-party-cutting-task-boundaries.ts` 导入页面渲染：

```typescript
import { renderTaskBreakdownPage } from '../src/pages/task-breakdown.ts'
import { renderContinuousDispatchPage } from '../src/pages/continuous-dispatch.ts'
import { renderCuttingOrdersPage } from '../src/pages/process-factory/cutting/cut-orders.ts'
```

增加：

```typescript
const taskBreakdownHtml = renderTaskBreakdownPage()
assert(taskBreakdownHtml.includes('裁片单状态'), '任务清单渲染结果必须包含裁片单状态')
assert(taskBreakdownHtml.includes('我方加工单策略'), '任务清单渲染结果必须包含我方加工单策略')

const continuousDispatchHtml = renderContinuousDispatchPage()
assert(continuousDispatchHtml.includes('含裁片连续任务'), '连续分配渲染结果必须包含含裁片连续任务')
assert(continuousDispatchHtml.includes('三方上报裁片完成'), '连续分配渲染结果必须包含三方上报裁片完成')

const cutOrdersHtml = renderCuttingOrdersPage()
assert(cutOrdersHtml.includes('裁片单来源'), '裁片单页面渲染结果必须包含裁片单来源')
assert(cutOrdersHtml.includes('回流方式'), '裁片单页面渲染结果必须包含回流方式')
```

- [ ] **步骤 2：补性能源码守卫**

在 `scripts/check-fcs-task-generation-rules.ts` 增加：

```typescript
assertIncludes(taskBreakdownSource, 'TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE', '任务清单必须保留分页，避免一次性渲染全部任务')
assertIncludes(taskBreakdownSource, 'data-fast-page-render="true"', '任务清单搜索/分页必须保留快速渲染标记')
assertIncludes(continuousDispatchSource, 'data-fast-page-render="true"', '连续任务分配搜索必须保留快速渲染标记')
assertNotIncludes(continuousDispatchSource, '按明细拆分', '连续任务分配不得出现按明细拆分')
```

- [ ] **步骤 3：运行检查确认通过**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
npm run check:fcs-task-generation-rules
npm run build
```

预期：全部 PASS，`npm run build` 完成，无 TypeScript/Vite 报错。

- [ ] **步骤 4：浏览器验证关键页面**

启动：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

浏览器检查：

- `/fcs/process/task-breakdown`：任务清单能看到裁片单状态、唛架状态、可做成衣数、我方加工单策略；搜索和分页点击响应不超过 200ms。
- `/fcs/dispatch/continuous`：能看到车缝+后道、含裁片连续任务、其他连续工序任务；含裁片任务显示三方上报裁片完成。
- `/pfos/cutting/cut-orders` 或当前裁片单路由：能看到裁片单来源、回流方式、我方加工单策略。
- PDA 裁片详情路由：独立裁片任务仍保留铺布/裁剪链路；含裁片连续任务只显示裁片完成上报和可做成衣数。

- [ ] **步骤 5：Commit**

```bash
git add scripts/check-third-party-cutting-task-boundaries.ts scripts/check-fcs-task-generation-rules.ts
git commit -m "test: cover cutting boundary page behavior"
```

---

## 任务 8：原型治理审查记录

**文件：**

- 创建：`docs/prototype-review-records/2026-07-06-third-party-cutting-continuous-task-boundary.md`

- [ ] **步骤 1：创建审查记录**

创建 `docs/prototype-review-records/2026-07-06-third-party-cutting-continuous-task-boundary.md`：

```markdown
# 三方裁片与连续任务边界原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-06 |
| 相关需求 / 任务 | 三方裁片、含裁片连续工序、整单任务与我方加工单边界 |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | /fcs/process/task-breakdown；/fcs/dispatch/continuous；PFOS 裁片单；PFOS 唛架方案；PFOS 特殊工艺；PDA 裁片任务 |
| 端类型 | 管理端 / 主管端 / 员工执行端 |
| 主要角色 | 生产计划、我方裁床、三方工厂、特殊工艺工厂、PDA 操作员 |
| 主要任务 | 解释任务类型边界，防止整单和连续任务误生成我方内部加工单 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | Web 页面给计划/主管解释边界，PDA 页面只保留当前动作 |
| 任务清晰度 | 通过 | 独立裁片、含裁片连续任务、整单任务分别展示 |
| 信息架构与导航 | 通过 | 保持现有菜单和路由 |
| 页面模式 | 通过 | 列表页不额外平铺完整链路 |
| 信息负荷 | 通过 | 任务清单仅补关键边界字段 |
| 文案 | 通过 | 使用裁片单、唛架、可做成衣数、我方加工单策略等业务语言 |
| 数量与状态 | 通过 | 裁片数量和可做成衣数带单位 |
| 扫码与识别 | 有条件通过 | 本次不新增扫码能力，保留既有 PDA 裁片入口 |
| 防错 | 通过 | 含裁片连续任务不展示入我方仓闭环 |
| UI 样式 | 通过 | 复用现有表格、标签和 PDA 卡片样式 |
| 组件交互 | 通过 | 搜索、分页、Tab 延续现有交互 |
| 协作关系 | 通过 | 明确三方上报与我方内部加工单边界 |
| 异常与追溯 | 通过 | 生成策略在列表和详情可追溯 |
| 现场设备可用性 | 通过 | PDA 只保留裁片完成上报动作 |

## 4. 问题标签

- `状态抽象`
- `字段过载`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 三方连续任务内部工艺容易被误生成我方加工单 | 协作断裂 | 生产计划 / 特殊工艺工厂 | 生成器按任务边界跳过，页面展示不生成策略 | 否 |
| 含裁片连续任务需要裁片感知但不走我方裁床闭环 | 状态抽象 | 三方工厂 / 我方裁床 | PDA 改为裁片完成上报，PFOS 唛架说明用途 | 否 |
| 整单任务可能误生成裁片单 | 追溯不足 | 生产计划 | 裁片单生成器排除整单任务 | 否 |

## 6. 最终结论

结论：通过

说明：

- 本轮只做原型和 mock 边界，不新增真实后端、权限或结算逻辑。
```

- [ ] **步骤 2：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 3：Commit**

```bash
git add docs/prototype-review-records/2026-07-06-third-party-cutting-continuous-task-boundary.md
git commit -m "docs: review cutting task boundary prototype"
```

---

## 任务 9：最终验收

**文件：**

- 不新增代码文件。

- [ ] **步骤 1：运行完整相关检查**

运行：

```bash
npm run check:third-party-cutting-task-boundaries
npm run check:fcs-task-generation-rules
npm run check:fcs-upstream-cutting-chain
npm run check:special-craft-task-generation
npm run check:pda-cutting-task-spreading-orders
npm run check:cutting-clean-mainline
npm run check:prototype-design-governance
npm run build
```

预期：全部 PASS。

- [ ] **步骤 2：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：`Already up to date`，状态正常。

- [ ] **步骤 3：本地浏览器验收**

启动：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

验收页面：

- `/fcs/process/task-breakdown`
- `/fcs/dispatch/continuous`
- PFOS 裁片单页面
- PFOS 唛架方案页面
- PFOS 特殊工艺页面
- PDA 独立裁片任务详情
- PDA 含裁片连续任务裁片完成上报页

验收标准：

- 整单任务不出现裁片单。
- 整单任务不出现在我方辅助/特种工艺加工单列表。
- 独立裁片任务有裁片单，策略为回我方裁床待交出仓。
- 独立裁片任务回我方链路后可生成我方辅助/特种工艺加工单。
- 含裁片连续任务有裁片单，有唛架状态，有裁片完成数量和可做成衣数。
- 含裁片连续任务不生成我方辅助/特种工艺加工单。
- 不含裁片连续任务不生成裁片单，也不生成我方辅助/特种工艺加工单。
- PDA 独立裁片任务保留铺布/裁剪/入仓链路。
- PDA 含裁片连续任务只展示裁片完成上报，不展示入我方待交出仓。
- 任务清单搜索、分页、Tab、行操作响应不超过 200ms。

- [ ] **步骤 4：最终提交检查**

```bash
git status --short
```

预期：工作区干净。

如果验收修复产生改动：

```bash
git add <changed-files>
git commit -m "fix: close cutting task boundary acceptance gaps"
```

---

## 覆盖矩阵

| 规格要求 | 覆盖任务 |
| --- | --- |
| 按任务类型判断边界 | 任务 1 |
| 独立裁片任务生成裁片单 | 任务 2 |
| 整单任务不生成裁片单 | 任务 2 |
| 含裁片连续任务生成裁片单 | 任务 2 |
| 不含裁片连续任务不生成裁片单 | 任务 1、任务 2 |
| 独立裁片回我方链路生成我方加工单 | 任务 3 |
| 含裁片连续任务不生成我方加工单 | 任务 3 |
| 整单任务不生成我方加工单 | 任务 3 |
| 任务清单展示裁片单、唛架、可做成衣数、加工单策略 | 任务 4 |
| 连续分配区分含裁片/不含裁片 | 任务 4 |
| PFOS 裁片单展示来源和回流方式 | 任务 5 |
| PFOS 唛架表达三方连续任务用途 | 任务 5 |
| PFOS 特殊工艺只展示我方内部加工对象 | 任务 5 |
| PDA 独立裁片任务保留现有闭环 | 任务 6 |
| PDA 含裁片连续任务只上报裁片完成 | 任务 6 |
| 页面性能与分页 | 任务 7、任务 9 |
| 原型治理记录 | 任务 8 |
| 全量相关验收 | 任务 9 |
