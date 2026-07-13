# 车缝分配工作台精简与 SKU 分工厂实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将独立车缝分配改为“每个 SKU 整量指定一家工厂”，把直接派单弹窗收敛为五类必要信息，展示具体履约日期，并补齐车缝到后道连续任务演示数据与 200 毫秒交互验收。

**架构：** 保持 Vanilla TypeScript 字符串模板和现有运行时任务体系。页面状态用“SKU 行 → 工厂”映射代替单工厂和数量输入，领域层按工厂汇总完整 SKU 后原子生成多个履约对象。主列表只渲染任务级摘要，详细齐套信息保留在抽屉；弹窗和字段变更只更新局部 DOM。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node 断言脚本、Playwright、CodeGraph。

---

## 实现前必读

- `docs/superpowers/specs/2026-07-13-sewing-dispatch-workbench-focus-design.md`
- `docs/product-design/含车缝任务交付与回货时效产品需求文档.md`
- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 文件结构与职责

### 修改

- `src/data/fcs/runtime-process-tasks.ts`：将独立车缝范围分区限制为 SKU 整量，并提供稳定的车缝到后道连续任务演示样例。
- `src/data/fcs/sewing-dispatch-workbench.ts`：接收 SKU 与工厂映射，按工厂汇总整量 SKU，原子写入任务、主工厂和履约快照。
- `src/pages/sewing-dispatch-workbench.ts`：精简主列表，拆分直接派单/竞价弹窗，实现 SKU 行选厂、批量设厂、唯一主工厂和具体时效日期。
- `src/pages/continuous-dispatch.ts`：保持连续任务整任务分配，让默认页签真实展示新增 Mock，去掉已由列表入口决定的弹窗内模式切换。
- `scripts/check-sewing-dispatch-workbench.ts`：将部分数量断言改为整 SKU 唯一工厂、多 SKU 多工厂和主工厂唯一性断言。
- `scripts/check-sewing-delivery-sla.ts`：替换真实 handler 中的部分数量回归，新增具体时间、局部更新和连续任务 Mock 断言。
- `scripts/check-sewing-delivery-sla-final-fixes.ts`：将旧 `qtyByRowId` 调用改为整 SKU 选厂调用。
- `package.json`：登记车缝工作台性能检查命令。

### 创建

- `scripts/check-sewing-dispatch-performance.ts`：验证首屏渲染量、弹窗局部更新和 200 毫秒交互预算。
- `docs/prototype-review-records/2026-07-13-sewing-dispatch-workbench-focus.md`：记录角色、信息分层、防错、中文文案、Mock 和性能自查。

## 任务 1：用失败回归锁定新业务契约

**文件：**
- 修改：`scripts/check-sewing-dispatch-workbench.ts`
- 修改：`scripts/check-sewing-delivery-sla.ts`
- 修改：`scripts/check-sewing-delivery-sla-final-fixes.ts`

- [ ] **步骤 1：先替换领域层回归用例**

在 `scripts/check-sewing-dispatch-workbench.ts` 中使用同一个独立车缝任务的两个 SKU，新增以下核心断言：

```typescript
const firstRow = workbenchTasks.flatMap((task) => task.skuRows).find((row) => row.remainingQty >= 2)!
const siblingRow = workbenchTasks
  .flatMap((task) => task.skuRows)
  .find((row) => row.taskId === firstRow.taskId && row.rowId !== firstRow.rowId && row.remainingQty > 0)!

const wholeSkuResult = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstRow.rowId, siblingRow.rowId],
  factoryIdByRowId: {
    [firstRow.rowId]: 'ID-F003',
    [siblingRow.rowId]: 'ID-F007',
  },
  businessAssignedAt: '2026-07-10 09:00:00',
  operatedAt: '2026-07-10 10:00:00',
  mainFactoryIdByProductionOrderId: {
    [firstRow.productionOrderId]: 'ID-F003',
  },
  by: '跟单A',
})

assert.equal(wholeSkuResult.ok, true, wholeSkuResult.message)
assert.equal(wholeSkuResult.draft?.factorySummaries.length, 2)
assert.equal(
  wholeSkuResult.draft?.factorySummaries.reduce((sum, item) => sum + item.qty, 0),
  firstRow.remainingQty + siblingRow.remainingQty,
)
```

- [ ] **步骤 2：锁定不允许数量拆分和重复 SKU**

```typescript
assert.throws(
  () => allocateRuntimeSewingTaskScope({
    taskId: firstRow.taskId,
    lines: [{ skuCode: firstRow.skuCode, qty: firstRow.remainingQty - 1 }],
    by: '跟单A',
  }),
  /SKU 必须按当前待分配数量整量分配/,
)

const duplicateRowResult = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstRow.rowId, firstRow.rowId],
  factoryIdByRowId: { [firstRow.rowId]: 'ID-F003' },
  by: '跟单A',
})
assert.equal(duplicateRowResult.ok, false)
assert.match(duplicateRowResult.message, /同一 SKU 不能重复分配/)
```

- [ ] **步骤 3：替换页面 handler 的部分数量断言**

在 `scripts/check-sewing-delivery-sla.ts` 的工作台 handler 用例中，删除 `dispatchQty` 输入和“快照分母等于 1”断言，改为：

```typescript
const factoryInput = new WorkbenchInput(
  'dispatchFactoryForRow',
  directFactory.id,
  true,
  directRow.rowId,
) as unknown as HTMLElement
assert.equal(handleSewingDispatchWorkbenchEvent(factoryInput, { type: 'change' } as Event), true)

const directSnapshot = getSewingDeliverySlaSnapshot(directDraft.runtimeTaskIds[0])
assert.equal(directSnapshot?.assignedQty, directRow.remainingQty)
assert.deepEqual(
  getRuntimeTaskById(directDraft.runtimeTaskIds[0])?.scopeSkuLines,
  [{
    skuCode: directRow.skuCode,
    color: directRow.colorName,
    size: directRow.sizeCode,
    qty: directRow.remainingQty,
  }],
)
```

- [ ] **步骤 4：把最终修复脚本改为新入参**

`scripts/check-sewing-delivery-sla-final-fixes.ts` 中的直接派单改为：

```typescript
const direct = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [row.rowId],
  factoryIdByRowId: { [row.rowId]: 'ID-F003' },
  businessAssignedAt: '2026-07-10 09:00:00',
  operatedAt: '2026-07-10 10:00:00',
  by: '跟单A',
})
```

- [ ] **步骤 5：运行回归并确认是新契约导致失败**

运行：

```bash
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla-final-fixes
npm run check:sewing-delivery-sla
```

预期：至少一项 `FAIL`，报错指向 `factoryIdByRowId` / `factorySummaries` 不存在，或旧逻辑仍接受 SKU 部分数量。

- [ ] **步骤 6：提交失败回归**

```bash
git add scripts/check-sewing-dispatch-workbench.ts scripts/check-sewing-delivery-sla.ts scripts/check-sewing-delivery-sla-final-fixes.ts
git commit -m "test: define whole SKU sewing factory allocation"
```

## 任务 2：实现整 SKU 多工厂原子分配

**文件：**
- 修改：`src/data/fcs/runtime-process-tasks.ts:2249-2330`
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts:179-192`
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts:1018-1149`
- 测试：`scripts/check-sewing-dispatch-workbench.ts`

- [ ] **步骤 1：将运行时 SKU 分区改为整量约束**

保留 `allocateRuntimeSewingTaskScope()` 的现有分区与回滚机制，只替换数量校验：

```typescript
const available = availableBySku.get(skuCode)
if (!available) throw new Error(`${skuCode} 不在当前待分配范围内`)
if (line.qty !== available.qty) {
  throw new Error(`${skuCode} SKU 必须按当前待分配数量整量分配`)
}
requestedBySku.set(skuCode, available.qty)
```

同时将函数注释改为“将选中的完整 SKU 范围分区为分配结果与剩余 SKU 范围”，不再描述部分数量。

- [ ] **步骤 2：修改工作台输入和记录结构**

```typescript
export interface SewingDispatchFactorySummary {
  factoryId: string
  factoryName: string
  rowIds: string[]
  skuSummary: string
  qty: number
  runtimeTaskIds: string[]
}

export interface SewingDispatchDraft {
  draftId: string
  createdAt: string
  createdBy: string
  actionType: '直接派单' | '发起竞价'
  rowIds: string[]
  skuSummary: string
  qty: number
  statusLabel: string
  runtimeTaskIds: string[]
  tenderIds: string[]
  factorySummaries: SewingDispatchFactorySummary[]
}

export interface SewingDispatchDraftInput {
  actionType: '直接派单' | '发起竞价'
  rowIds: string[]
  factoryIdByRowId?: Record<string, string>
  businessAssignedAt?: string
  operatedAt?: string
  mainFactoryIdByProductionOrderId?: Record<string, string>
  by: string
}
```

- [ ] **步骤 3：校验 SKU 唯一归属和工厂可用性**

```typescript
const uniqueRowIds = new Set(input.rowIds)
if (uniqueRowIds.size !== input.rowIds.length) {
  return { ok: false, message: '同一 SKU 不能重复分配。' }
}
const factoryById = new Map(listSewingFactoryOptions().map((factory) => [factory.id, factory] as const))
const assignments = rows.map((row) => {
  const factoryId = input.factoryIdByRowId?.[row.rowId]?.trim() ?? ''
  const factory = factoryById.get(factoryId)
  if (input.actionType === '直接派单' && !factory) {
    throw new Error(`${row.skuCode} 请选择承接工厂。`)
  }
  return { row, factory }
})
```

工厂黑名单、试产限制和接单时效配置必须逐个实际承接工厂校验，不得只校验第一家。

- [ ] **步骤 4：按任务和工厂顺序分区**

在外层 `runSewingDispatchWorkbenchTransaction()` 中执行以下算法，任何一家工厂失败都回滚所有任务、履约快照、主工厂和演示记录：

```typescript
type SewingFactoryOption = ReturnType<typeof listSewingFactoryOptions>[number]
type ResolvedAssignment = {
  row: SewingDispatchWorkbenchRow
  factory: SewingFactoryOption
}

const assignmentsByTaskAndFactory = new Map<string, ResolvedAssignment[]>()
for (const assignment of assignments as ResolvedAssignment[]) {
  const key = `${assignment.row.taskId}::${assignment.factory.id}`
  assignmentsByTaskAndFactory.set(key, [
    ...(assignmentsByTaskAndFactory.get(key) ?? []),
    assignment,
  ])
}

for (const factoryGroup of assignmentsByTaskAndFactory.values()) {
    const factory = factoryGroup[0].factory
    const currentRows = factoryGroup.map(({ row }) => {
      const current = listSewingDispatchWorkbenchRows().find((candidate) =>
        candidate.productionOrderId === row.productionOrderId
        && candidate.skuCode === row.skuCode
        && candidate.remainingQty === row.remainingQty,
      )
      if (!current) throw new Error(`${row.skuCode} 待分配范围已变化，请重新打开弹窗。`)
      return current
    })
    const currentTaskIds = new Set(currentRows.map((row) => row.taskId))
    if (currentTaskIds.size !== 1) throw new Error('所选 SKU 已不再属于同一待分配范围。')
    const allocated = allocateRuntimeSewingTaskScope({
      taskId: currentRows[0].taskId,
      lines: currentRows.map((row) => ({ skuCode: row.skuCode, qty: row.remainingQty })),
      by: input.by,
      operatedAt,
    })
    applyDirectDispatchForFactory(allocated, factory, businessAssignedAt, operatedAt, input.by)
}
```

派单私有函数完整定义如下，不新建通用抽象层：

```typescript
function applyDirectDispatchForFactory(
  allocated: RuntimeProcessTask,
  factory: SewingFactoryOption,
  businessAssignedAt: string,
  operatedAt: string,
  by: string,
): RuntimeProcessTask {
  const acceptanceSla = resolveDispatchAcceptanceSlaForTask(
    allocated,
    factory.id,
    factory.name,
    businessAssignedAt,
  )
  if (acceptanceSla.ruleSource === 'UNCONFIGURED') {
    throw new Error(acceptanceSla.missingReason ?? '当前车缝工序工艺未配置接单时效。')
  }
  const updated = applyRuntimeDirectDispatchMeta({
    taskId: allocated.taskId,
    factoryId: factory.id,
    factoryName: factory.name,
    acceptDeadline: buildDispatchAcceptanceDeadline(businessAssignedAt, acceptanceSla),
    taskDeadline: allocated.taskDeadline || addDays(businessAssignedAt, 9),
    remark: '车缝分配工作台按完整 SKU 直接派单',
    by,
    businessAssignedAt,
    operatedAt,
    dispatchedAt: operatedAt,
    autoAccept: true,
    acceptanceSla,
    dispatchPrice: allocated.dispatchPrice ?? allocated.standardPrice ?? 0,
    dispatchPriceCurrency: allocated.dispatchPriceCurrency ?? allocated.standardPriceCurrency ?? 'IDR',
    dispatchPriceUnit: allocated.dispatchPriceUnit ?? allocated.standardPriceUnit ?? '件',
    priceDiffReason: '',
    writeBackMainFactory: false,
  })
  if (!updated) throw new Error(`任务 ${allocated.taskId} 直接派单提交失败。`)
  return updated
}
```

- [ ] **步骤 5：按生产单汇总所有候选工厂后确认主工厂**

```typescript
const assignedFactories = assignments
  .filter(({ row }) => row.productionOrderId === productionOrderId)
  .map(({ factory }) => factory!)
const candidates = [...listProductionOrderSewingFactories(productionOrderId), ...assignedFactories]
  .filter((factory, index, list) => list.findIndex((item) => item.id === factory.id) === index)
```

保持现有规则：有效主工厂默认保留；仅一个候选自动确认；多候选且无有效主工厂时必须显式选择。

- [ ] **步骤 6：运行领域回归**

```bash
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla-final-fixes
```

预期：全部 `PASS`；两个 SKU 分别生成工厂 A/B 的完整数量履约对象，未生成任何同 SKU 剩余数量。

- [ ] **步骤 7：提交领域层实现**

```bash
git add src/data/fcs/runtime-process-tasks.ts src/data/fcs/sewing-dispatch-workbench.ts scripts/check-sewing-dispatch-workbench.ts scripts/check-sewing-delivery-sla-final-fixes.ts
git commit -m "feat: allocate sewing factories by whole SKU"
```

## 任务 3：收敛直接派单弹窗并分离竞价弹窗

**文件：**
- 修改：`src/pages/sewing-dispatch-workbench.ts:45-105`
- 修改：`src/pages/sewing-dispatch-workbench.ts:247-425`
- 修改：`src/pages/sewing-dispatch-workbench.ts:1060-1210`
- 修改：`src/pages/sewing-dispatch-workbench.ts:1272-1512`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤 1：替换弹窗状态**

删除 `dispatchFactoryId`、`dispatchRiskConfirmed`、`dispatchQtyByRowId`，增加：

```typescript
dispatchBatchFactoryId: string
dispatchFactoryIdByRowId: Record<string, string>
dispatchSelectedRowIds: Set<string>
```

`dispatchSelectedRowIds` 只用于“批量设置工厂”，不再表示排除某个 SKU 不参与本次分配。打开直接派单时，当前任务内符合主列表可分配判断的 SKU 全部进入弹窗。

保持现有齐套硬校验时，候选行改为只允许 SKU 整量：

```typescript
function getDispatchCandidateRows(
  tasks: SewingDispatchWorkbenchTask[] = listSewingDispatchWorkbenchTasks(),
): SewingDispatchWorkbenchRow[] {
  return tasks
    .filter((task) => state.selectedTaskIds.has(task.taskId))
    .flatMap((task) => task.skuRows)
    .filter((row) => row.remainingQty > 0 && row.completeKitQty >= row.remainingQty)
}
```

部分齐套的 SKU 仍在主列表显示为不可整量分配，不进入弹窗，避免以完整任务数量绕过现有齐套前置。

- [ ] **步骤 2：拆分两个弹窗渲染函数**

```typescript
function renderDirectDispatchDialog(tasks: SewingDispatchWorkbenchTask[]): string
function renderBiddingDialog(tasks: SewingDispatchWorkbenchTask[]): string

function renderDispatchDialog(tasks: SewingDispatchWorkbenchTask[]): string {
  if (!state.dispatchOpen) return ''
  return state.dispatchActionType === '直接派单'
    ? renderDirectDispatchDialog(tasks)
    : renderBiddingDialog(tasks)
}
```

两个函数中不得渲染“分配方式”切换控件。列表的“直接派单”和“发起竞价”动作决定打开哪个弹窗。

- [ ] **步骤 3：直接派单弹窗只渲染五类内容**

SKU 表格固定为：

```html
<thead>
  <tr>
    <th>选择</th>
    <th>SKU</th>
    <th>颜色 / 尺码</th>
    <th>任务数量</th>
    <th>承接工厂</th>
  </tr>
</thead>
```

弹窗内不得调用以下旧渲染函数：

```typescript
renderDispatchCutPieceReleaseNotice
renderSewingMaterialPrepPanel
renderDispatchFactoryRisk
renderDispatchAcceptanceSlaPreview
```

不展示完整齐套、待分配、风险摘要、配料表、实际操作时间和数量输入框。上游事实在打开后变化时，只显示一条短错误并阻止提交。

- [ ] **步骤 4：实现行选厂和批量设厂**

```typescript
if (field === 'dispatchFactoryForRow') {
  const rowId = node.dataset.rowId
  if (rowId) state.dispatchFactoryIdByRowId[rowId] = node.value
  state.dispatchError = ''
  refreshSewingDispatchDialog()
  return
}

if (action === 'apply-batch-factory') {
  for (const rowId of state.dispatchSelectedRowIds) {
    state.dispatchFactoryIdByRowId[rowId] = state.dispatchBatchFactoryId
  }
  state.dispatchError = ''
  refreshSewingDispatchDialog()
  return true
}
```

批量设置后保留逐行修改能力。选中黑名单、不具备车缝能力或当前不可派单工厂时，不展开档案详情，只在选项或行下方用短句说明。

- [ ] **步骤 5：按 SKU 工厂映射渲染唯一主工厂**

```typescript
function getSelectedFactoryCandidatesByProductionOrder(
  rows: SewingDispatchWorkbenchRow[],
): Map<string, Array<{ id: string; name: string }>>
```

每个生产单：

- 只有一家有效候选时显示“已自动确定”，不让用户重复选择。
- 已有有效主工厂时默认保留。
- 无有效主工厂且候选超过一家时，用单选或紧凑下拉显式确认。
- 不允许候选范围外的工厂成为主工厂。

- [ ] **步骤 6：展示具体交付和回货日期**

```typescript
function renderDirectDispatchDeadlines(rows: SewingDispatchWorkbenchRow[]): string {
  const acceptedAt = dateTimeLocalToOperationWallClock(state.dispatchBusinessAssignedAt)
  const sampleTask = getRuntimeTaskById(rows[0]?.taskId ?? '')
  const slaKind = sampleTask ? classifySewingDeliverySla(sampleTask) : null
  if (!sampleTask || !slaKind) return ''
  const snapshot = createSewingDeliverySlaSnapshot({
    assignmentId: 'SEWING-DISPATCH-PREVIEW',
    runtimeTaskId: sampleTask.taskId,
    productionOrderId: sampleTask.productionOrderId,
    factoryId: 'PREVIEW',
    factoryName: '预览',
    assignedQty: rows.reduce((sum, row) => sum + row.remainingQty, 0),
    acceptedAt,
    slaKind,
  })
  const [thirty, seventy, hundred] = snapshot.milestones
  const rowsToRender: Array<[string, string, string]> = [
    ['交付完成', hundred.deadlineAt, '前完成 100%'],
    ['30% 回货', thirty.deadlineAt, '前确认实收达到 30%'],
    ['70% 回货', seventy.deadlineAt, '前确认实收达到 70%'],
    ['100% 回货', hundred.deadlineAt, '前确认实收达到 100%'],
  ]
  return `<section data-sewing-dispatch-deadline-region class="space-y-2 rounded-md border p-3">
    <div class="text-sm font-medium">时效要求</div>
    ${rowsToRender.map(([label, deadlineAt, requirement]) => `
      <div class="grid gap-1 text-sm sm:grid-cols-[120px_1fr]">
        <span class="text-muted-foreground">${escapeHtml(label)}</span>
        <span class="font-medium">${escapeHtml(deadlineAt.slice(0, 16))} ${escapeHtml(requirement)}</span>
      </div>
    `).join('')}
  </section>`
}
```

展示到年、月、日、时、分；不以“第 4 天”或“96 小时”作为主文案。业务分配时间变更后只刷新时效区。

- [ ] **步骤 7：提交时传入 SKU 选厂映射**

```typescript
result = createSewingDispatchWorkbenchDraft({
  actionType: state.dispatchActionType,
  rowIds: candidateRows.map((row) => row.rowId),
  factoryIdByRowId: state.dispatchActionType === '直接派单'
    ? Object.fromEntries(candidateRows.map((row) => [row.rowId, state.dispatchFactoryIdByRowId[row.rowId] ?? '']))
    : undefined,
  businessAssignedAt,
  operatedAt,
  mainFactoryIdByProductionOrderId: state.dispatchMainFactoryIdByProductionOrderId,
  by: '跟单A',
})
```

直接派单成功文案展示工厂数、SKU 数和自动接单结果，例如“已将 4 个 SKU 派给 2 家工厂，工厂已自动接单”。

- [ ] **步骤 8：运行页面与履约回归**

```bash
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla
npm run check:sewing-delivery-sla-final-fixes
```

预期：全部 `PASS`；生成 HTML 不包含“本次分配数量”、“实际操作时间”、“风险摘要”、“配料前置校验”，并包含具体截止时间。

- [ ] **步骤 9：提交弹窗与交互改造**

```bash
git add src/pages/sewing-dispatch-workbench.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: focus sewing direct dispatch dialog"
```

## 任务 4：精简主列表并收紧局部渲染

**文件：**
- 修改：`src/pages/sewing-dispatch-workbench.ts:430-895`
- 修改：`src/pages/sewing-dispatch-workbench.ts:1197-1512`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤 1：先增加主列表信息层级断言**

```typescript
const sewingPageHtml = renderSewingDispatchWorkbenchPage()
assert.match(sewingPageHtml, /车缝任务 \/ 生产单/)
assert.match(sewingPageHtml, /SKU 数 \/ 任务数量/)
assert.match(sewingPageHtml, /可分配状态/)
assert.doesNotMatch(sewingPageHtml, /<th[^>]*>毛织片<\/th>/)
assert.doesNotMatch(sewingPageHtml, /<th[^>]*>特种工艺裁片<\/th>/)
assert.doesNotMatch(sewingPageHtml, /min-w-\[2260px\]/)
```

- [ ] **步骤 2：将主列表收敛为任务级摘要**

主列表保留七组信息：

1. 车缝任务 / 生产单。
2. SPU / 款式。
3. SKU 数 / 任务数量。
4. 可分配数量和状态。
5. 主要阻断原因。
6. 分配状态 / 承接工厂。
7. 查看详情、直接派单、发起竞价。

毛织片、特种工艺、裁片单闭环、辅料细项全部保留在 `renderDetailDrawer()`，不删除业务信息。表格最小宽度控制在 `1280px` 以内。

- [ ] **步骤 3：标记轻交互不触发全页重绘**

以下元素必须带 `data-skip-page-rerender="true"`：

- 打开/关闭直接派单弹窗。
- 打开/关闭竞价弹窗。
- SKU 行勾选。
- 单行工厂下拉。
- 批量工厂下拉与应用按钮。
- 业务分配时间。
- 主工厂选择。

- [ ] **步骤 4：将弹窗刷新细分为局部区域**

```typescript
function replaceSewingDispatchRegion(selector: string, html: string): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>(selector)
  if (region) region.innerHTML = html
}

function refreshSewingDispatchFactoryRows(): void
function refreshSewingDispatchMainFactoryRegion(): void
function refreshSewingDispatchDeadlineRegion(): void
function refreshSewingDispatchErrorRegion(): void
```

打开和关闭仅替换 `[data-sewing-dispatch-dialog-host]`；行选厂只替换 SKU 表体、主工厂区和校验区；时间变更只替换时效区。更新后只对新区域执行图标初始化，不重新扫描整页。

- [ ] **步骤 5：运行页面回归**

```bash
npm run check:sewing-delivery-sla
npm run check:sewing-delivery-sla-adversarial-ui
```

预期：全部 `PASS`；主列表不再展开多组 SKU 齐套细节，弹窗字段操作不经过页面根节点重绘。

- [ ] **步骤 6：提交列表和局部渲染改造**

```bash
git add src/pages/sewing-dispatch-workbench.ts scripts/check-sewing-delivery-sla.ts
git commit -m "perf: reduce sewing workbench render scope"
```

## 任务 5：补齐车缝到后道连续任务 Mock

**文件：**
- 修改：`src/data/fcs/runtime-process-tasks.ts:1128-1210`
- 修改：`src/pages/continuous-dispatch.ts:196-275`
- 修改：`src/pages/continuous-dispatch.ts:277-623`
- 测试：`scripts/check-sewing-dispatch-workbench.ts`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤 1：先写连续任务 Mock 失败断言**

```typescript
const sewingPostTasks = listRuntimeProcessTasks().filter((task) =>
  task.taskUnitType === 'COMBINED_PROCESS_TASK'
  && task.acceptanceMode === 'CONTINUOUS_PROCESS'
  && task.coveredProcesses?.some((process) => process.processCode === 'SEW')
  && task.coveredProcesses?.some((process) => process.processName === '后道'),
)
assert(sewingPostTasks.some((task) => task.assignmentStatus === 'UNASSIGNED'))
assert(sewingPostTasks.some((task) => task.assignmentStatus === 'BIDDING'))
assert(sewingPostTasks.some((task) => task.assignmentStatus === 'ASSIGNED'))

const cuttingToPackagingTask = listRuntimeProcessTasks().find((task) =>
  task.taskId === 'CONT-CUT-PACK-UNASSIGNED'
  && task.coveredProcesses?.some((process) => process.processCode === 'CUT_PANEL')
  && task.coveredProcesses?.some((process) => process.processCode === 'SEW')
  && task.coveredProcesses?.some((process) => process.processCode === 'PACK'),
)
assert(cuttingToPackagingTask, '其他连续工序页签必须有裁片到包装样例')

const continuousHtml = renderContinuousDispatchPage()
assert.match(continuousHtml, /车缝\+后道/)
assert.match(continuousHtml, /待分配/)
assert.match(continuousHtml, /招标中/)
assert.match(continuousHtml, /已分配/)
```

- [ ] **步骤 2：用运行时任务演示构造器补三种状态**

在 `applyManualContinuousMergeDemo()` 附近新增局部构造器，不修改全局任务生成规则：

```typescript
function buildSewingPostContinuousDemo(
  source: RuntimeProcessTask,
  input: {
    taskId: string
    assignmentStatus: 'UNASSIGNED' | 'BIDDING' | 'ASSIGNED'
    factoryId?: string
    factoryName?: string
  },
): RuntimeProcessTask {
  return {
    ...structuredClone(source),
    taskId: input.taskId,
    taskNo: input.taskId,
    processCode: 'PROC_FINISHING',
    processNameZh: '车缝+后道组合任务',
    processBusinessCode: 'COMBINED_PROCESS_TASK',
    processBusinessName: '车缝+后道组合任务',
    taskUnitType: 'COMBINED_PROCESS_TASK',
    acceptanceMode: 'CONTINUOUS_PROCESS',
    assignmentGranularity: 'ORDER',
    scopeType: 'ORDER',
    scopeKey: 'ORDER',
    scopeLabel: '整任务',
    coveredProcesses: [
      { processCode: 'SEW', processName: '车缝', sourceArtifactIds: [input.taskId] },
      { processCode: 'POST_FINISHING', processName: '后道', sourceArtifactIds: [input.taskId] },
    ],
    mergeSourceTaskIds: [`${input.taskId}-SEW`, `${input.taskId}-POST`],
    mergeCreatedAt: '2026-07-13 09:00:00',
    mergeCreatedBy: '生产计划员',
    generationRuleName: '任务清单人工合并',
    assignmentMode: input.assignmentStatus === 'BIDDING' ? 'BIDDING' : 'DIRECT',
    assignmentStatus: input.assignmentStatus,
    assignedFactoryId: input.factoryId,
    assignedFactoryName: input.factoryName,
    tenderId: input.assignmentStatus === 'BIDDING' ? `TENDER-${input.taskId}` : undefined,
    biddingDeadline: input.assignmentStatus === 'BIDDING' ? '2026-07-15 18:00:00' : undefined,
    acceptanceStatus: input.assignmentStatus === 'ASSIGNED' ? 'ACCEPTED' : 'PENDING',
    businessAssignedAt: input.assignmentStatus === 'ASSIGNED' ? '2026-07-13 09:00:00' : undefined,
    assignmentOperatedAt: input.assignmentStatus === 'ASSIGNED' ? '2026-07-13 09:00:00' : undefined,
    acceptedAt: input.assignmentStatus === 'ASSIGNED' ? '2026-07-13 09:00:00' : undefined,
    acceptedBy: input.assignmentStatus === 'ASSIGNED' ? '系统自动接单' : undefined,
    executionEnabled: true,
  }
}
```

三条样例使用稳定任务号：

- `CONT-SEW-POST-UNASSIGNED`：待分配，可打开直接派单和竞价弹窗。
- `CONT-SEW-POST-BIDDING`：招标中，不再展示重复分配动作。
- `CONT-SEW-POST-ASSIGNED`：已直接派单并自动接单，展示承接工厂。
- `CONT-CUT-PACK-UNASSIGNED`：覆盖裁片、车缝、后道、包装，进入“其他连续工序任务”页签。

`CONT-CUT-PACK-UNASSIGNED` 使用同一构造器，仅将 `processNameZh` 改为“裁片+车缝+后道+包装组合任务”，并将 `coveredProcesses` 明确设为：

```typescript
[
  { processCode: 'CUT_PANEL', processName: '裁片', sourceArtifactIds: ['CONT-CUT-PACK-UNASSIGNED'] },
  { processCode: 'SEW', processName: '车缝', sourceArtifactIds: ['CONT-CUT-PACK-UNASSIGNED'] },
  { processCode: 'POST_FINISHING', processName: '后道', sourceArtifactIds: ['CONT-CUT-PACK-UNASSIGNED'] },
  { processCode: 'PACK', processName: '包装', sourceArtifactIds: ['CONT-CUT-PACK-UNASSIGNED'] },
]
```

- [ ] **步骤 3：保证连续任务弹窗不再切换模式**

列表的 `open-direct` / `open-bidding` 仍分别设置 `dialog.mode`，但 `renderDispatchDialog()` 删除 `switch-dialog-mode` 按钮组。直接派单弹窗只展示工厂和直接派单必需字段，竞价弹窗只展示竞价截止时间和确认提示。

- [ ] **步骤 4：运行连续任务回归**

```bash
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla
npm run check:fcs-task-generation-rules
```

预期：全部 `PASS`；默认“车缝+后道连续任务”页签同时有待分配、招标中和已分配数据，而且不混入独立车缝工作台。

- [ ] **步骤 5：提交连续任务 Mock**

```bash
git add src/data/fcs/runtime-process-tasks.ts src/pages/continuous-dispatch.ts scripts/check-sewing-dispatch-workbench.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: add sewing post continuous dispatch demos"
```

## 任务 6：建立 200 毫秒性能回归

**文件：**
- 创建：`scripts/check-sewing-dispatch-performance.ts`
- 修改：`package.json`
- 修改：`src/pages/sewing-dispatch-workbench.ts`

- [ ] **步骤 1：创建 Playwright 性能检查**

```typescript
#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.HIGOOD_BASE_URL || 'http://127.0.0.1:5173'
const budgetMs = Number(process.env.HIGOOD_INTERACTION_THRESHOLD_MS || 200)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

try {
  await page.goto(`${baseUrl}/fcs/dispatch/sewing`, { waitUntil: 'networkidle' })
  await page.locator('[data-sewing-dispatch-action="open-dispatch"][data-dispatch-type="直接派单"]').first().click()
  await page.locator('[data-sewing-dispatch-dialog-host] [role="dialog"]').waitFor()

  const startedAt = await page.evaluate(() => performance.now())
  await page.locator('[data-sewing-dispatch-field="dispatchFactoryForRow"]').first().selectOption({ index: 1 })
  await page.locator('[data-sewing-dispatch-deadline-region]').waitFor()
  const duration = await page.evaluate((start) => performance.now() - start, startedAt)
  assert(duration <= budgetMs, `SKU 选厂响应 ${duration.toFixed(2)}ms，超过 ${budgetMs}ms`)

  assert.equal(await page.locator('[data-sewing-dispatch-page]').count(), 1)
  assert.equal(await page.locator('[data-sewing-dispatch-dialog-host] [role="dialog"]').count(), 1)
} finally {
  await browser.close()
}
```

- [ ] **步骤 2：登记检查命令**

`package.json` 的 `scripts` 中新增：

```json
"check:sewing-dispatch-performance": "tsx scripts/check-sewing-dispatch-performance.ts"
```

- [ ] **步骤 3：启动服务并运行性能检查**

终端 A：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

终端 B：

```bash
HIGOOD_BASE_URL=http://127.0.0.1:5173 npm run check:sewing-dispatch-performance
```

预期：`PASS`，SKU 选厂到时效区更新不超过 `200ms`，页面根节点未重建。

- [ ] **步骤 4：提交性能回归**

```bash
git add scripts/check-sewing-dispatch-performance.ts package.json src/pages/sewing-dispatch-workbench.ts
git commit -m "test: guard sewing dispatch interaction performance"
```

## 任务 7：完成设计治理、全量验证和本地演示

**文件：**
- 创建：`docs/prototype-review-records/2026-07-13-sewing-dispatch-workbench-focus.md`
- 检查：本计划所有修改文件

- [ ] **步骤 1：按模板创建原型审查记录**

从 `docs/prototype-review-record-template.md` 复制结构，至少明确记录：

```markdown
# 车缝分配工作台精简与 SKU 分工厂原型审查记录

- 主要角色：跟单、生产计划员
- 端类型：管理端
- 核心动作：为每个 SKU 指定唯一承接工厂
- 信息分层：主列表判断能否分配，弹窗只完成选厂与时效确认
- 防错：未选厂、未选唯一主工厂、未来业务时间全部阻断
- Mock：车缝+后道覆盖待分配、招标中、已分配
- 性能：弹窗和字段变更局部更新，可见反馈不超过 200 毫秒
- 例外：无
```

- [ ] **步骤 2：运行目标回归和构建**

```bash
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla-final-fixes
npm run check:sewing-delivery-sla
npm run check:sewing-delivery-sla-adversarial-ui
npm run check:fcs-task-generation-rules
npm run check:prototype-design-governance
npm run build
```

预期：所有命令退出码为 `0`。如其他人的并行工作使非本需求检查失败，必须记录精确失败命令和与本改动的关系，不得修改无关模块规避失败。

- [ ] **步骤 3：同步 CodeGraph**

```bash
codegraph sync
codegraph status
```

预期：索引已最新，不存在本次修改文件的 pending sync。

- [ ] **步骤 4：以局域网方式启动本地项目**

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

获取局域网 IP：

```bash
ipconfig getifaddr en0 || ipconfig getifaddr en1
```

- [ ] **步骤 5：运行真实浏览器验收**

使用 Playwright 依次验收：

1. `/fcs/dispatch/sewing` 主列表不再默认展开毛织片、特种工艺和辅料细节。
2. 直接派单弹窗不包含分配方式切换、数量输入、当前齐套、风险摘要和配料表。
3. 不同 SKU 可选不同工厂，批量设厂后可逐行修改。
4. 多工厂时只能确认一家主工厂。
5. 业务分配时间修改后，交付、30%、70%、100% 全部显示到具体年月日时分。
6. 直接派单成功后各工厂自动接单，各自履约分母等于承接 SKU 数量之和。
7. `/fcs/dispatch/continuous` 默认页签展示车缝+后道待分配、招标中和已分配样例。
8. 弹窗开关、SKU 选厂和时间变更无整页闪烁、无滚动位置丢失，可见反馈在 200 毫秒内。

- [ ] **步骤 6：验证局域网地址**

```bash
curl -I http://<局域网IP>:5173/fcs/dispatch/sewing
curl -I http://<局域网IP>:5173/fcs/dispatch/continuous
```

预期：两个地址均返回 `HTTP 200`。

- [ ] **步骤 7：提交审查记录与最终收口**

```bash
git add docs/prototype-review-records/2026-07-13-sewing-dispatch-workbench-focus.md
git commit -m "docs: review focused sewing dispatch prototype"
```

## 最终完成标准

- 独立车缝的同一 SKU 不存在数量输入、部分分配或多工厂归属。
- 一个生产单的不同 SKU 可在一次直接派单中分给不同工厂。
- 每家工厂以其承接的完整 SKU 数量之和形成独立履约对象。
- 一个生产单任何时点只有一家主工厂。
- 直接派单弹窗只展示业务分配时间、SKU 与工厂、主工厂、交付时效、按比例回货时效。
- 所有履约节点展示具体年月日时分，并随业务分配时间局部刷新。
- 车缝+后道连续任务有可直接演示的多状态 Mock，且仍为整任务分配。
- 功能按钮和字段变更 200 毫秒内出现可见反馈，无不必要的整页重绘。
- 目标回归、构建、设计治理、CodeGraph 同步、真实浏览器和局域网验证全部有可复查结果。
