# 生产单变更两类场景实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `/fcs/production/changes` 从多场景混合工作台收敛为两类入口：修改生产单需求数量、替换物料；两类入口共用同一种生产单变更单、主管确认、相关负责人处理和相关单据留痕。

**架构：** 继续沿用现有 Vite + TypeScript + Tailwind + 字符串模板渲染。数据层在 `production-tech-pack-change-domain.ts` 保留现有导出函数，新增两类业务类型、处理事项和相关单据留痕字段；页面层在 `changes-domain.ts` 局部重写首页、新增页和详情页文案结构，不引入新框架。事件层复用 `handleProductionEvent`，只新增两类表单切换和提交字段处理。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 assert 型检查脚本。

---

## 文件结构

- 修改：`scripts/check-production-order-changes.ts`
  - 先把验收口径改成两类场景，删除“80 个场景目录”和抽象文案作为成功条件的旧断言。
  - 新增断言：两类入口、数量按颜色尺码、新物料无适用批次、主管确认处理事项、相关单据留痕、禁止抽象文案。
- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`
  - 新增或扩展生产单变更业务类型、当前阶段、处理事项、相关单据留痕 mock。
  - 保留 `listProductionOrderChangeOrders()`、`getProductionOrderChangeOrder()`、`submitProductionOrderChangeOrder()` 等现有导出，避免大范围调用方改动。
- 修改：`src/pages/production/context.ts`
  - 收敛 `productionChangeForm` 状态，增加 `changeType`、数量行、物料替换字段、主管确认原因等最少字段。
- 修改：`src/pages/production/changes-domain.ts`
  - 首页第一屏只显示两类入口。
  - 新增页根据入口显示两张不同表单。
  - 详情页共用结构：变更内容、当前事实、影响数量/影响物料、需要处理的事、处理记录、相关单据记录。
- 修改：`src/pages/production/events.ts`
  - 增加两类入口动作、数量行变更、物料字段变更、主管确认处理事项动作。
  - 提交时仍调用同一种生产单变更单创建函数。
- 创建：`docs/prototype-review-records/2026-07-09-production-order-change-two-scenarios.md`
  - 因为会修改 `src/pages/`、`src/data/`，必须新增原型审查记录。

## 任务 1：改检查脚本，锁定两类场景验收

**文件：**
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：替换旧场景数量断言**

把旧的“80 个场景目录”断言替换为两类业务类型断言。示例代码：

```typescript
const orders = listProductionOrderChangeOrders()
assert.ok(
  orders.some((order) => order.changeType === 'QUANTITY_CHANGE'),
  '生产单变更必须覆盖修改生产单需求数量',
)
assert.ok(
  orders.some((order) => order.changeType === 'MATERIAL_REPLACEMENT'),
  '生产单变更必须覆盖替换物料',
)
assert.ok(
  !renderProductionChangesPage().includes('80 个'),
  '生产单变更首页不应继续强调 80 个业务场景',
)
```

- [ ] **步骤 2：新增首页入口断言**

在 `listHtml` 相关断言后加入：

```typescript
assert.ok(listHtml.includes('修改生产单需求数量'), '首页必须有修改生产单需求数量入口')
assert.ok(listHtml.includes('替换物料'), '首页必须有替换物料入口')
assert.ok(listHtml.includes('待主管确认'), '首页进度必须使用业务话术')
assert.ok(listHtml.includes('已通知相关负责人') || listHtml.includes('处理中'), '首页必须展示处理进度业务话术')
assert.ok(!listHtml.includes('已分发委托'), '首页不应出现抽象文案：已分发委托')
assert.ok(!listHtml.includes('执行对象'), '首页不应出现抽象文案：执行对象')
assert.ok(!listHtml.includes('来源记录'), '首页不应出现抽象文案：来源记录')
assert.ok(!listHtml.includes('状态流转'), '首页不应出现抽象文案：状态流转')
assert.ok(!listHtml.includes('写回'), '首页不应出现抽象文案：写回')
assert.ok(!listHtml.includes('投影'), '首页不应出现抽象文案：投影')
```

- [ ] **步骤 3：新增数量变更表单断言**

将新增页切到数量变更入口，断言按颜色尺码填新数量：

```typescript
state.productionChangeForm.changeType = 'QUANTITY_CHANGE'
state.productionChangeFormStep = 'content'
const quantityFormHtml = renderProductionChangeNewPage()
assert.ok(quantityFormHtml.includes('颜色'), '数量变更表单必须按颜色填写')
assert.ok(quantityFormHtml.includes('尺码'), '数量变更表单必须按尺码填写')
assert.ok(quantityFormHtml.includes('当前数量'), '数量变更表单必须显示当前数量')
assert.ok(quantityFormHtml.includes('新数量'), '数量变更表单必须填写新数量')
assert.ok(quantityFormHtml.includes('多') || quantityFormHtml.includes('少'), '数量变更表单必须展示差异')
assert.ok(!quantityFormHtml.includes('只填总数'), '数量变更不允许只填总数后自动拆分')
```

- [ ] **步骤 4：新增替换物料表单断言**

```typescript
state.productionChangeForm.changeType = 'MATERIAL_REPLACEMENT'
state.productionChangeFormStep = 'content'
const materialFormHtml = renderProductionChangeNewPage()
assert.ok(materialFormHtml.includes('原物料'), '替换物料表单必须显示原物料')
assert.ok(materialFormHtml.includes('替代物料'), '替换物料表单必须显示替代物料')
assert.ok(materialFormHtml.includes('适用颜色'), '替换物料表单必须按颜色确认范围')
assert.ok(materialFormHtml.includes('适用尺码'), '替换物料表单必须按尺码确认范围')
assert.ok(materialFormHtml.includes('从哪里开始用新物料'), '替换物料表单必须确认开始使用节点')
assert.ok(!materialFormHtml.includes('适用批次'), '替换物料不应出现适用批次字段')
```

- [ ] **步骤 5：新增详情页和留痕断言**

```typescript
const quantityOrder = listProductionOrderChangeOrders().find((order) => order.changeType === 'QUANTITY_CHANGE')
assert.ok(quantityOrder, '需要一张数量变更样例')
const quantityDetailHtml = renderProductionChangeOrderDetailPage(quantityOrder.id)
assert.ok(quantityDetailHtml.includes('需要处理的事'), '详情页必须展示需要处理的事')
assert.ok(quantityDetailHtml.includes('相关单据记录'), '详情页必须展示相关单据记录')
assert.ok(quantityDetailHtml.includes('来自哪张变更单') || quantityDetailHtml.includes('本单已按变更单'), '被改单据必须能反查变更单')
assert.ok(quantityDetailHtml.includes('原数量'), '数量变更留痕必须展示原数量')
assert.ok(quantityDetailHtml.includes('新数量'), '数量变更留痕必须展示新数量')

const materialOrder = listProductionOrderChangeOrders().find((order) => order.changeType === 'MATERIAL_REPLACEMENT')
assert.ok(materialOrder, '需要一张物料替换样例')
const materialDetailHtml = renderProductionChangeOrderDetailPage(materialOrder.id)
assert.ok(materialDetailHtml.includes('原物料'), '物料替换详情必须展示原物料')
assert.ok(materialDetailHtml.includes('替代物料'), '物料替换详情必须展示替代物料')
assert.ok(materialDetailHtml.includes('旧料') || materialDetailHtml.includes('新物料'), '物料替换详情必须展示处理事项')
assert.ok(!materialDetailHtml.includes('适用批次'), '物料替换详情不应出现适用批次')
```

- [ ] **步骤 6：运行检查，确认失败**

运行：

```bash
npm run check:production-order-changes
```

预期：FAIL。失败点应包含新断言中的入口、`changeType`、表单字段或留痕字段。

- [ ] **步骤 7：Commit**

```bash
git add scripts/check-production-order-changes.ts
git commit -m "test: define two production change scenarios"
```

## 任务 2：收敛数据模型和 mock 数据

**文件：**
- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`

- [ ] **步骤 1：新增两类业务类型和处理事项类型**

在现有 `ProductionOrderChangeResult` 附近新增：

```typescript
export type ProductionOrderChangeType =
  | 'QUANTITY_CHANGE'
  | 'MATERIAL_REPLACEMENT'

export type ProductionOrderChangeProgressStage =
  | 'NO_DOCUMENT'
  | 'DOCUMENT_NOT_STARTED'
  | 'STARTED_NOT_HANDOVER'
  | 'HANDOVER_NOT_SETTLED'
  | 'SETTLED'

export interface ProductionOrderChangeActionItem {
  id: string
  ownerRole: string
  ownerName: string
  actionText: string
  stage: ProductionOrderChangeProgressStage
  statusText: '待主管确认' | '已通知相关负责人' | '处理中' | '已处理完成' | '需要补充确认' | '转结算确认'
  adjustReason: string
}

export interface ProductionOrderChangeDocumentTrace {
  id: string
  documentType: ProductionOrderChangeDocumentType
  documentNo: string
  traceText: string
  beforeText: string
  afterText: string
  confirmedBy: string
  confirmedAt: string
  reason: string
}
```

- [ ] **步骤 2：扩展 `ProductionOrderChangeOrder`**

给接口增加字段：

```typescript
  changeType: ProductionOrderChangeType
  stage: ProductionOrderChangeProgressStage
  stageText: string
  workSummary: string
  actionItems: ProductionOrderChangeActionItem[]
  documentTraces: ProductionOrderChangeDocumentTrace[]
  quantityLines?: Array<{
    color: string
    size: string
    currentQty: number
    newQty: number
    unit: string
  }>
  materialReplacement?: {
    originalMaterial: string
    replacementMaterial: string
    colors: string[]
    sizes: string[]
    effectiveFromText: string
  }
```

- [ ] **步骤 3：补两张核心样例**

在 `productionOrderChangeOrders` 初始化后追加或替换前两条样例，必须包含：

```typescript
const focusedProductionOrderChangeOrders: ProductionOrderChangeOrder[] = [
  {
    id: 'BG-PO-202603-0004-QTY-001',
    changeType: 'QUANTITY_CHANGE',
    scenarioId: 'QUANTITY-CHANGE-001',
    productionOrderId: 'PO-202603-0004',
    demandOrderId: 'DO-202603-0004',
    spuCode: 'SPU-2024-010',
    styleName: 'Celana Jogger Pria',
    buyerName: 'Dewi',
    merchandiserName: '陈静',
    source: 'DELIVERY_REQUIREMENT_CHANGE',
    changeModules: ['BOM', 'PROCESS'],
    reason: '客户确认黑色 M 码减少 30 件，藏青色 L 码减少 20 件。',
    expectedEffectiveMode: 'FROM_NEXT_PREP',
    effectiveDescription: '从下一次配料开始',
    changeResult: 'PRODUCTION_PATCH',
    executionStrategy: 'AFTER_APPROVAL',
    lockStatus: 'IMPACT_SCOPE_LOCKED',
    status: 'SUBMITTED',
    hasVersionRelationChange: false,
    hasProductionPatch: true,
    affectedDocumentCount: 3,
    costDeltaAmount: 0,
    delayDays: 0,
    createdBy: '陈静',
    createdAt: '2026-07-09 10:20',
    reviewer: '生产主管',
    latestLog: '待主管确认需要谁处理。',
    stage: 'DOCUMENT_NOT_STARTED',
    stageText: '已生成单据，还没开始做',
    workSummary: '配料数量要改，裁剪数量要改。',
    quantityLines: [
      { color: '黑色', size: 'M', currentQty: 120, newQty: 90, unit: '件' },
      { color: '藏青色', size: 'L', currentQty: 100, newQty: 80, unit: '件' },
    ],
    actionItems: [
      {
        id: 'ACT-BG-QTY-001-01',
        ownerRole: '配料负责人',
        ownerName: '王丽',
        actionText: '配料数量要改：黑色 M 少 30 件，藏青色 L 少 20 件。',
        stage: 'DOCUMENT_NOT_STARTED',
        statusText: '待主管确认',
        adjustReason: '',
      },
      {
        id: 'ACT-BG-QTY-001-02',
        ownerRole: '裁剪负责人',
        ownerName: 'Budi',
        actionText: '裁剪数量要改，未裁部分按新数量处理。',
        stage: 'DOCUMENT_NOT_STARTED',
        statusText: '待主管确认',
        adjustReason: '',
      },
    ],
    documentTraces: [
      {
        id: 'TRACE-BG-QTY-001-01',
        documentType: 'MATERIAL_PREPARATION',
        documentNo: 'MR-202603-010',
        traceText: '本单已按变更单 BG-PO-202603-0004-QTY-001 调整。',
        beforeText: '黑色 M：120 件；藏青色 L：100 件',
        afterText: '黑色 M：90 件；藏青色 L：80 件',
        confirmedBy: '生产主管',
        confirmedAt: '2026-07-09 10:40',
        reason: '客户确认减少数量。',
      },
    ],
  },
  {
    id: 'BG-PO-202603-0004-MAT-001',
    changeType: 'MATERIAL_REPLACEMENT',
    scenarioId: 'MATERIAL-REPLACEMENT-001',
    productionOrderId: 'PO-202603-0004',
    demandOrderId: 'DO-202603-0004',
    spuCode: 'SPU-2024-010',
    styleName: 'Celana Jogger Pria',
    buyerName: 'Dewi',
    merchandiserName: '陈静',
    source: 'MATERIAL_SHORTAGE',
    changeModules: ['BOM'],
    reason: '原黑色弹力斜纹布不再到货，客户确认改用炭灰色弹力斜纹布。',
    expectedEffectiveMode: 'FROM_NEXT_PICKUP',
    effectiveDescription: '从下一次领料开始',
    changeResult: 'PRODUCTION_PATCH',
    executionStrategy: 'AFTER_APPROVAL',
    lockStatus: 'IMPACT_SCOPE_LOCKED',
    status: 'EXECUTING',
    hasVersionRelationChange: false,
    hasProductionPatch: true,
    affectedDocumentCount: 2,
    costDeltaAmount: 600,
    delayDays: 1,
    createdBy: '陈静',
    createdAt: '2026-07-09 11:10',
    reviewer: '生产主管',
    latestLog: '旧料已领未用，需要仓库确认退料。',
    stage: 'STARTED_NOT_HANDOVER',
    stageText: '已领料，还没使用',
    workSummary: '先退回旧料，再领新料。',
    materialReplacement: {
      originalMaterial: 'FAB-A01 弹力斜纹布 / 黑色 / 280g',
      replacementMaterial: 'FAB-B02 弹力斜纹布 / 炭灰色 / 280g',
      colors: ['黑色'],
      sizes: ['M', 'L'],
      effectiveFromText: '从下一次领料开始',
    },
    actionItems: [
      {
        id: 'ACT-BG-MAT-001-01',
        ownerRole: '仓库负责人',
        ownerName: 'Sari',
        actionText: '旧料已领未用，需要确认退回 36 米。',
        stage: 'STARTED_NOT_HANDOVER',
        statusText: '处理中',
        adjustReason: '',
      },
      {
        id: 'ACT-BG-MAT-001-02',
        ownerRole: '领料负责人',
        ownerName: 'Agus',
        actionText: '新物料需要补领 36 米。',
        stage: 'STARTED_NOT_HANDOVER',
        statusText: '已通知相关负责人',
        adjustReason: '',
      },
    ],
    documentTraces: [
      {
        id: 'TRACE-BG-MAT-001-01',
        documentType: 'PICKING',
        documentNo: 'MI-202603-006',
        traceText: '本单已按变更单 BG-PO-202603-0004-MAT-001 改用新物料 FAB-B02。',
        beforeText: 'FAB-A01 弹力斜纹布 / 黑色 / 280g',
        afterText: 'FAB-B02 弹力斜纹布 / 炭灰色 / 280g',
        confirmedBy: '生产主管',
        confirmedAt: '2026-07-09 11:30',
        reason: '原物料不再到货。',
      },
    ],
  },
]
```

然后让 `productionOrderChangeOrders` 以这两条作为前置样例：

```typescript
productionOrderChangeOrders = [
  ...focusedProductionOrderChangeOrders,
  ...productionOrderChangeOrders.filter(
    (order) => !focusedProductionOrderChangeOrders.some((focused) => focused.id === order.id),
  ),
]
```

- [ ] **步骤 4：更新提交函数默认值**

在 `submitProductionOrderChangeOrder()` 创建 order 时补默认字段：

```typescript
    changeType: input.changeType ?? (input.source === 'MATERIAL_SHORTAGE' ? 'MATERIAL_REPLACEMENT' : 'QUANTITY_CHANGE'),
    stage: 'DOCUMENT_NOT_STARTED',
    stageText: '已生成单据，还没开始做',
    workSummary: input.changeResult === 'COST_ONLY' ? '转结算确认' : '需要主管确认处理事项。',
    actionItems: [],
    documentTraces: [],
```

同时给 `ProductionOrderChangeOrderSubmitInput` 增加可选字段：

```typescript
  changeType?: ProductionOrderChangeType
  quantityLines?: ProductionOrderChangeOrder['quantityLines']
  materialReplacement?: ProductionOrderChangeOrder['materialReplacement']
```

- [ ] **步骤 5：运行检查，确认至少旧类型错误消失**

运行：

```bash
npm run check:production-order-changes
```

预期：仍可能 FAIL，但不应再因为 `changeType` 字段缺失失败。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/production-tech-pack-change-domain.ts
git commit -m "feat: model focused production change scenarios"
```

## 任务 3：收敛页面结构和表单

**文件：**
- 修改：`src/pages/production/context.ts`
- 修改：`src/pages/production/changes-domain.ts`

- [ ] **步骤 1：扩展表单状态**

在 `src/pages/production/context.ts` 的生产单变更空表单中补字段：

```typescript
export const PRODUCTION_CHANGE_EMPTY_FORM = {
  changeType: 'QUANTITY_CHANGE',
  productionOrderId: '',
  source: 'DELIVERY_REQUIREMENT_CHANGE',
  modules: ['BOM'],
  changeContent: '',
  reason: '',
  effectiveMode: 'FROM_NEXT_PREP',
  executionMode: 'AFTER_APPROVAL',
  quantityLines: [
    { color: '黑色', size: 'M', currentQty: '120', newQty: '120' },
    { color: '藏青色', size: 'L', currentQty: '100', newQty: '100' },
  ],
  originalMaterial: '',
  replacementMaterial: '',
  materialColors: ['黑色'],
  materialSizes: ['M', 'L'],
}
```

如果现有类型通过 `as const` 或接口约束报错，按现有对象类型补齐字段，不新建状态管理层。

- [ ] **步骤 2：首页替换为两入口结构**

在 `renderProductionChangesPage()` header 后、统计卡前加入两张入口卡，文案使用：

```typescript
function renderProductionChangeEntryCards(): string {
  return `
    <section class="grid gap-3 md:grid-cols-2">
      <button class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left hover:bg-blue-100" data-prod-action="start-production-change-type" data-change-type="QUANTITY_CHANGE">
        <p class="text-sm text-blue-700">入口一</p>
        <h2 class="mt-1 text-lg font-semibold">修改生产单需求数量</h2>
        <p class="mt-2 text-sm text-muted-foreground">按颜色和尺码填写新数量，系统自动算多多少、少多少。</p>
      </button>
      <button class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-left hover:bg-emerald-100" data-prod-action="start-production-change-type" data-change-type="MATERIAL_REPLACEMENT">
        <p class="text-sm text-emerald-700">入口二</p>
        <h2 class="mt-1 text-lg font-semibold">替换物料</h2>
        <p class="mt-2 text-sm text-muted-foreground">填写原物料、新物料、适用颜色尺码和从哪里开始用新物料。</p>
      </button>
    </section>
  `
}
```

调用：

```typescript
${renderProductionChangeEntryCards()}
```

- [ ] **步骤 3：列表表头改业务话术**

把变更单列表列名改成：

```typescript
['变更单', '变更类型', '生产单', '当前做到哪了', '需要处理的事', '进度', '动作']
```

行内使用：

```typescript
<td class="px-3 py-3">${escapeHtml(order.changeType === 'QUANTITY_CHANGE' ? '修改生产单需求数量' : '替换物料')}</td>
<td class="px-3 py-3">${escapeHtml(order.stageText)}</td>
<td class="px-3 py-3">${escapeHtml(order.workSummary)}</td>
<td class="px-3 py-3">${escapeHtml(order.actionItems[0]?.statusText || productionOrderChangeOrderStatusLabels[order.status])}</td>
```

- [ ] **步骤 4：新增数量表单渲染函数**

在 `changes-domain.ts` 中新增：

```typescript
function renderQuantityChangeFields(form: typeof state.productionChangeForm): string {
  const rows = form.quantityLines || []
  return `
    <section class="space-y-3">
      <h2 class="text-base font-semibold">颜色尺码新数量</h2>
      ${renderChangeTable(
        ['颜色', '尺码', '当前数量', '新数量', '差异'],
        rows.map((line, index) => {
          const currentQty = Number(line.currentQty || 0)
          const newQty = Number(line.newQty || 0)
          const diff = newQty - currentQty
          const diffText = diff === 0 ? '不变' : diff > 0 ? `多 ${diff} 件` : `少 ${Math.abs(diff)} 件`
          return `
            <tr>
              <td class="px-3 py-3">${escapeHtml(line.color)}</td>
              <td class="px-3 py-3">${escapeHtml(line.size)}</td>
              <td class="px-3 py-3">${escapeHtml(`${currentQty} 件`)}</td>
              <td class="px-3 py-3">
                <input class="w-24 rounded-md border px-2 py-1 text-sm" data-prod-field="productionChangeQuantityNewQty" data-index="${index}" value="${escapeHtml(line.newQty)}" />
              </td>
              <td class="px-3 py-3">${escapeHtml(diffText)}</td>
            </tr>
          `
        }),
        '暂无颜色尺码数量',
        'min-w-[760px]',
      )}
    </section>
  `
}
```

- [ ] **步骤 5：新增替换物料表单渲染函数**

```typescript
function renderMaterialReplacementFields(form: typeof state.productionChangeForm): string {
  return `
    <section class="grid gap-4 md:grid-cols-2">
      <label class="space-y-1 text-sm">
        <span class="font-medium">原物料</span>
        <input data-prod-field="productionChangeOriginalMaterial" class="w-full rounded-md border px-3 py-2" value="${escapeHtml(form.originalMaterial)}" placeholder="选择或填写原物料" />
      </label>
      <label class="space-y-1 text-sm">
        <span class="font-medium">替代物料</span>
        <input data-prod-field="productionChangeReplacementMaterial" class="w-full rounded-md border px-3 py-2" value="${escapeHtml(form.replacementMaterial)}" placeholder="选择或填写替代物料" />
      </label>
      <label class="space-y-1 text-sm">
        <span class="font-medium">适用颜色</span>
        <input data-prod-field="productionChangeMaterialColors" class="w-full rounded-md border px-3 py-2" value="${escapeHtml((form.materialColors || []).join('、'))}" placeholder="例如：黑色" />
      </label>
      <label class="space-y-1 text-sm">
        <span class="font-medium">适用尺码</span>
        <input data-prod-field="productionChangeMaterialSizes" class="w-full rounded-md border px-3 py-2" value="${escapeHtml((form.materialSizes || []).join('、'))}" placeholder="例如：M、L" />
      </label>
      <label class="space-y-1 text-sm md:col-span-2">
        <span class="font-medium">从哪里开始用新物料</span>
        <select data-prod-field="productionChangeFormEffectiveMode" class="w-full rounded-md border px-3 py-2">
          ${renderSelectOption('FROM_NEXT_PREP', '从下一次配料开始', form.effectiveMode)}
          ${renderSelectOption('FROM_NEXT_PICKUP', '从下一次领料开始', form.effectiveMode)}
          ${renderSelectOption('FROM_NEXT_MARKER', '从下一次裁剪准备开始', form.effectiveMode)}
        </select>
      </label>
    </section>
  `
}
```

不要加入“适用批次”。

- [ ] **步骤 6：接入两张表单**

在 `renderProductionChangeContentStep()` 中，用 `form.changeType` 决定主体：

```typescript
const focusedFields = form.changeType === 'MATERIAL_REPLACEMENT'
  ? renderMaterialReplacementFields(form)
  : renderQuantityChangeFields(form)
```

保留 `变更原因`，去掉让用户选择大量模块的首屏强曝光。模块可以隐藏或由提交时自动计算。

- [ ] **步骤 7：更新详情页 Tab 文案**

`renderProductionChangeOrderDetailTabs()` 使用：

```typescript
const tabs = [
  { key: 'content', label: '变更内容' },
  { key: 'impact', label: '当前事实' },
  { key: 'documents', label: '需要处理的事' },
  { key: 'records', label: '处理记录' },
]
```

如果保留成本和时效 Tab，放到详情下方折叠区，避免首页和主流程继续显得复杂。

- [ ] **步骤 8：运行检查，确认页面断言推进**

运行：

```bash
npm run check:production-order-changes
```

预期：入口和表单断言 PASS；事件提交相关断言可能仍 FAIL。

- [ ] **步骤 9：Commit**

```bash
git add src/pages/production/context.ts src/pages/production/changes-domain.ts
git commit -m "feat: simplify production change entry forms"
```

## 任务 4：接线事件提交和主管确认

**文件：**
- 修改：`src/pages/production/events.ts`
- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`

- [ ] **步骤 1：新增入口动作**

在 `handleProductionEvent()` 中加入：

```typescript
if (action === 'start-production-change-type') {
  const changeType = actionNode.dataset.changeType === 'MATERIAL_REPLACEMENT'
    ? 'MATERIAL_REPLACEMENT'
    : 'QUANTITY_CHANGE'
  state.productionChangeSelectedOrderId = ''
  state.productionChangeForm = {
    ...PRODUCTION_CHANGE_EMPTY_FORM,
    changeType,
    source: changeType === 'MATERIAL_REPLACEMENT' ? 'MATERIAL_SHORTAGE' : 'DELIVERY_REQUIREMENT_CHANGE',
    modules: changeType === 'MATERIAL_REPLACEMENT' ? ['BOM'] : ['BOM', 'PROCESS'],
  }
  state.productionChangeFormStep = 'order'
  state.productionChangeFormError = ''
  openAppRoute('/fcs/production/changes/new', 'production-change-new', changeType === 'MATERIAL_REPLACEMENT' ? '替换物料' : '修改生产单需求数量')
  return true
}
```

- [ ] **步骤 2：处理数量行输入**

在字段更新逻辑里加入：

```typescript
if (field === 'productionChangeQuantityNewQty') {
  const index = Number((target as HTMLElement).dataset.index || '0')
  const value = getInputValue(target)
  const lines = [...(state.productionChangeForm.quantityLines || [])]
  if (lines[index]) lines[index] = { ...lines[index], newQty: value }
  state.productionChangeForm.quantityLines = lines
  state.productionChangeFormError = ''
  return true
}
```

如果现有字段处理函数不是 `getInputValue()`，按当前文件已有方式读取 `HTMLInputElement.value`。

- [ ] **步骤 3：处理物料字段输入**

加入字段映射：

```typescript
const materialFieldMap: Record<string, keyof typeof state.productionChangeForm> = {
  productionChangeOriginalMaterial: 'originalMaterial',
  productionChangeReplacementMaterial: 'replacementMaterial',
  productionChangeMaterialColors: 'materialColors',
  productionChangeMaterialSizes: 'materialSizes',
}
```

对颜色尺码输入按 `、` 或 `,` 拆分：

```typescript
const parseList = (value: string): string[] =>
  value.split(/[、,]/).map((item) => item.trim()).filter(Boolean)
```

- [ ] **步骤 4：提交时传入业务类型和明细**

在 `submitProductionChangeForm()` 构造 input 时加入：

```typescript
changeType: form.changeType,
quantityLines: form.changeType === 'QUANTITY_CHANGE'
  ? form.quantityLines.map((line) => ({
      color: line.color,
      size: line.size,
      currentQty: Number(line.currentQty || 0),
      newQty: Number(line.newQty || 0),
      unit: '件',
    }))
  : undefined,
materialReplacement: form.changeType === 'MATERIAL_REPLACEMENT'
  ? {
      originalMaterial: form.originalMaterial,
      replacementMaterial: form.replacementMaterial,
      colors: form.materialColors,
      sizes: form.materialSizes,
      effectiveFromText: effectiveModeLabels[effectiveMode] ?? '按选择节点开始',
    }
  : undefined,
```

- [ ] **步骤 5：增加最少校验**

在 `submitProductionChangeForm()` 前面加入：

```typescript
if (form.changeType === 'QUANTITY_CHANGE') {
  const hasChangedLine = form.quantityLines.some((line) => Number(line.currentQty) !== Number(line.newQty))
  if (!hasChangedLine) {
    state.productionChangeFormError = '至少要有一个颜色尺码的新数量发生变化。'
    return null
  }
}

if (form.changeType === 'MATERIAL_REPLACEMENT') {
  if (!form.originalMaterial.trim() || !form.replacementMaterial.trim()) {
    state.productionChangeFormError = '请填写原物料和替代物料。'
    return null
  }
}
```

- [ ] **步骤 6：主管确认动作只改处理事项**

新增动作：

```typescript
if (action === 'confirm-production-change-actions') {
  const changeOrderId = actionNode.dataset.changeOrderId
  if (!changeOrderId) return true
  showPlanMessage('已通知相关负责人处理')
  return true
}
```

本轮先只完成原型展示，不新建真实审批状态机。

- [ ] **步骤 7：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：提交相关断言 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/production/events.ts src/data/fcs/production-tech-pack-change-domain.ts
git commit -m "feat: wire focused production change submissions"
```

## 任务 5：补详情页留痕展示和文案清理

**文件：**
- 修改：`src/pages/production/changes-domain.ts`
- 修改：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：详情页展示数量差异**

新增函数：

```typescript
function renderQuantityChangeDetail(order: ProductionOrderChangeOrderView): string {
  const rows = order.quantityLines || []
  return renderChangeTable(
    ['颜色', '尺码', '原数量', '新数量', '差异'],
    rows.map((line) => {
      const diff = line.newQty - line.currentQty
      const diffText = diff === 0 ? '不变' : diff > 0 ? `多 ${diff} ${line.unit}` : `少 ${Math.abs(diff)} ${line.unit}`
      return `
        <tr>
          <td class="px-3 py-3">${escapeHtml(line.color)}</td>
          <td class="px-3 py-3">${escapeHtml(line.size)}</td>
          <td class="px-3 py-3">${escapeHtml(`${line.currentQty} ${line.unit}`)}</td>
          <td class="px-3 py-3">${escapeHtml(`${line.newQty} ${line.unit}`)}</td>
          <td class="px-3 py-3">${escapeHtml(diffText)}</td>
        </tr>
      `
    }),
    '暂无数量差异',
    'min-w-[760px]',
  )
}
```

- [ ] **步骤 2：详情页展示物料替换**

```typescript
function renderMaterialReplacementDetail(order: ProductionOrderChangeOrderView): string {
  const item = order.materialReplacement
  if (!item) return '<div class="rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">暂无物料替换内容。</div>'
  return renderInfoTiles([
    ['原物料', item.originalMaterial],
    ['替代物料', item.replacementMaterial],
    ['适用颜色', item.colors.join('、')],
    ['适用尺码', item.sizes.join('、')],
    ['从哪里开始用新物料', item.effectiveFromText],
  ])
}
```

不要展示“适用批次”。

- [ ] **步骤 3：详情页展示需要处理的事**

```typescript
function renderProductionChangeActionItems(order: ProductionOrderChangeOrderView): string {
  return renderChangeTable(
    ['需要谁处理', '要做什么', '当前做到哪了', '进度', '调整原因'],
    order.actionItems.map((item) => `
      <tr>
        <td class="px-3 py-3">${escapeHtml(`${item.ownerRole} / ${item.ownerName}`)}</td>
        <td class="px-3 py-3">${escapeHtml(item.actionText)}</td>
        <td class="px-3 py-3">${escapeHtml(order.stageText)}</td>
        <td class="px-3 py-3">${escapeHtml(item.statusText)}</td>
        <td class="px-3 py-3">${escapeHtml(item.adjustReason || '未调整')}</td>
      </tr>
    `),
    '暂无需要处理的事',
    'min-w-[1120px]',
  )
}
```

- [ ] **步骤 4：详情页展示相关单据记录**

```typescript
function renderProductionChangeDocumentTraces(order: ProductionOrderChangeOrderView): string {
  return renderChangeTable(
    ['相关单据', '来自哪张变更单', '原来', '现在', '谁确认', '确认时间', '原因'],
    order.documentTraces.map((trace) => `
      <tr>
        <td class="px-3 py-3">${escapeHtml(`${productionOrderChangeDocumentTypeLabels[trace.documentType]} ${trace.documentNo}`)}</td>
        <td class="px-3 py-3">${escapeHtml(trace.traceText)}</td>
        <td class="px-3 py-3">${escapeHtml(trace.beforeText)}</td>
        <td class="px-3 py-3">${escapeHtml(trace.afterText)}</td>
        <td class="px-3 py-3">${escapeHtml(trace.confirmedBy)}</td>
        <td class="px-3 py-3">${escapeHtml(trace.confirmedAt)}</td>
        <td class="px-3 py-3">${escapeHtml(trace.reason)}</td>
      </tr>
    `),
    '暂无相关单据记录',
    'min-w-[1360px]',
  )
}
```

- [ ] **步骤 5：接入详情内容**

在 `renderProductionChangeOrderDetailContent()` 中：

```typescript
if (tab === 'content') {
  return renderChangeDetailSection(
    '变更内容',
    order.changeType === 'MATERIAL_REPLACEMENT'
      ? renderMaterialReplacementDetail(order)
      : renderQuantityChangeDetail(order),
  )
}
if (tab === 'documents') return renderChangeDetailSection('需要处理的事', renderProductionChangeActionItems(order))
if (tab === 'records') return renderChangeDetailSection('相关单据记录', renderProductionChangeDocumentTraces(order))
```

- [ ] **步骤 6：全文件禁止抽象文案**

运行：

```bash
rg -n "已分发委托|执行对象|来源记录|状态流转|写回|投影|适用批次" src/pages/production/changes-domain.ts src/pages/production/events.ts src/data/fcs/production-tech-pack-change-domain.ts
```

预期：无输出。若命中，用业务话术替换。

- [ ] **步骤 7：运行检查**

运行：

```bash
npm run check:production-order-changes
```

预期：PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/production/changes-domain.ts scripts/check-production-order-changes.ts
git commit -m "feat: show production change traces"
```

## 任务 6：补原型治理审查记录和最终验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-09-production-order-change-two-scenarios.md`

- [ ] **步骤 1：创建审查记录**

写入：

```markdown
# 生产单变更两类场景收敛原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-09 |
| 相关需求 / 任务 | 生产单变更只保留修改生产单需求数量和替换物料两类业务场景 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/production/changes`、`/fcs/production/changes/new`、`/fcs/production/changes/:changeOrderId` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 跟单、生产主管、配料负责人、仓库负责人、裁剪负责人、质检、结算人员 |
| 主要任务 | 发起两类生产单变更，主管确认需要处理的事，相关负责人处理并保留相关单据记录 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 管理端发起和追溯，主管端确认处理事项，相关负责人处理具体事项。 |
| 任务清晰度 | 通过 | 首页只保留修改生产单需求数量和替换物料两个入口。 |
| 信息架构与导航 | 通过 | 两类入口共用同一种生产单变更单，详情结构一致。 |
| 页面模式 | 通过 | 管理端保留列表和详情，主管确认页突出需要谁处理什么。 |
| 信息负荷 | 通过 | 删除多场景入口，不再展示 80 个场景。 |
| 文案 | 通过 | 避免已分发委托、执行对象、来源记录、状态流转、链路、写回、投影等抽象词。 |
| 数量与状态 | 通过 | 数量带单位，差异直接展示多多少或少多少。 |
| 扫码与识别 | 有条件通过 | 本页为管理端和主管端，不直接处理一线扫码。 |
| 防错 | 通过 | 数量无变化、物料缺失、已结算改单据等场景阻断或转主管确认。 |
| UI 样式 | 通过 | 保持企业后台克制风格，入口卡片突出两类任务。 |
| 组件交互 | 通过 | 沿用现有字符串模板和表格，无新增复杂组件。 |
| 协作关系 | 通过 | 明确主管确认和相关负责人处理，相关单据保留记录。 |
| 异常与追溯 | 通过 | 被调整单据可反查生产单变更单。 |
| 现场设备可用性 | 有条件通过 | 本轮不扩展 PDA，后续员工执行端需另行审查。 |

## 4. 问题标签

- `缺扫码识别`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 本轮只覆盖管理端和主管端，未设计一线扫码处理页。 | `缺扫码识别` | 仓库、一线工序员工 | 相关负责人处理事项先以管理端/主管端记录表达，一线 PDA 后续单独设计。 | 是 |

## 6. 最终结论

结论：有条件通过

说明：

- 本轮收敛生产单变更主流程，解决入口过多、文案抽象、单据留痕不明确的问题。
- 一线员工执行端不在本轮范围内，需要在后续 PDA 或 PFOS/WLS 页面中单独补扫码和现场操作设计。
```

- [ ] **步骤 2：运行专项检查**

```bash
npm run check:production-order-changes
```

预期：PASS。

- [ ] **步骤 3：运行治理检查**

```bash
npm run check:prototype-design-governance
```

预期：PASS，且提示发现审查记录。

- [ ] **步骤 4：构建**

```bash
npm run build
```

预期：PASS。

- [ ] **步骤 5：同步 CodeGraph**

```bash
codegraph sync && codegraph status
```

预期：索引健康，显示 `Index is up to date`。

- [ ] **步骤 6：Commit**

```bash
git add docs/prototype-review-records/2026-07-09-production-order-change-two-scenarios.md
git commit -m "docs: review focused production change prototype"
```

## 自检

- 规格第 5 节首页结构由任务 3 覆盖。
- 规格第 6 节数量变更由任务 2、3、4、5 覆盖。
- 规格第 7 节替换物料由任务 2、3、4、5 覆盖；计划明确不出现“适用批次”。
- 规格第 8 节主管确认由任务 4 覆盖。
- 规格第 9 节单据留痕由任务 2、5 覆盖。
- 规格第 10 节文案规则由任务 1、5 覆盖。
- 规格第 11 节异常与兜底由任务 4、6 覆盖。
- 原型治理记录由任务 6 覆盖。
