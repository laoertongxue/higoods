# 新建铺布单步选择实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将“新建铺布”改为以上游业务对象搜索、按唛架方案分组、单选具体唛架编号并直接生成一张铺布单的单页流程。

**架构：** 保留现有铺布路由、铺布单模型、持久化入口和生成后导航；在 `marker-spreading-projection.ts` 中补齐单个唛架编号的尺码、图片和已有铺布单状态，在 `marker-spreading.ts` 中重写新建页子区域并使用局部 DOM 更新。使用一个聚焦检查脚本和一个 Playwright 用例覆盖投影、单步页面、重复防错、图片弹窗和多方案搜索。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Playwright、Node.js 聚焦检查脚本。

---

## 文件结构

- 修改 `src/pages/process-factory/cutting/marker-spreading-projection.ts`：让新建页投影保留已生成铺布单的唛架编号，并提供每层尺码件数、款式图片和已有铺布单摘要。
- 修改 `src/pages/process-factory/cutting/marker-spreading.ts`：移除两步状态，渲染业务搜索、唛架方案分组、单选行、图片弹窗和底部生成区；将创建动作收口为单个编号。
- 创建 `scripts/check-cutting-spreading-create-single-step.ts`：对投影字段、单步页面标记、旧步骤退场和单张创建规则做快速门禁。
- 修改 `package.json`：注册 `check:cutting-spreading-create-single-step`。
- 创建 `tests/cutting-spreading-create-single-step.spec.ts`：覆盖业务搜索、多方案分组、状态展示、单选生成和图片预览。
- 创建 `docs/prototype-review-records/2026-07-18-spreading-create-single-step.md`：记录印尼工厂产品设计自查和列表页例外判断。

### 任务 1：先建立单步新建页的聚焦门禁

**文件：**
- 创建：`scripts/check-cutting-spreading-create-single-step.ts`
- 修改：`package.json:143-149`

- [ ] **步骤 1：创建会失败的聚焦检查**

创建脚本，先锁定已批准规格中的结构性事实：

```typescript
#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageFile = 'src/pages/process-factory/cutting/marker-spreading.ts'
const projectionFile = 'src/pages/process-factory/cutting/marker-spreading-projection.ts'
const pageSource = readFileSync(pageFile, 'utf8')
const projectionSource = readFileSync(projectionFile, 'utf8')

for (const token of [
  'sizePiecePerLayer',
  'plannedLayerCount',
  'existingSpreadingOrder',
  'canCreate',
  'styleImageUrl',
  'businessSearchTerms',
]) {
  assert(projectionSource.includes(token), `${projectionFile} 缺少新建铺布投影字段：${token}`)
}

console.log('cutting spreading create projection check passed')
```

- [ ] **步骤 2：注册检查命令**

在 `package.json` 的裁床检查命令区加入：

```json
"check:cutting-spreading-create-single-step": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-spreading-create-single-step.ts"
```

- [ ] **步骤 3：运行检查并确认按预期失败**

运行：

```bash
npm run check:cutting-spreading-create-single-step
```

预期：FAIL，首个错误为 `marker-spreading-projection.ts 缺少新建铺布投影字段：sizePiecePerLayer`。

- [ ] **步骤 4：保留红灯，不提交失败状态**

确认工作区只新增检查脚本和 `package.json` 命令。任务 2 将在投影实现使检查通过后一起提交，避免把必然失败的门禁提交到分支。

### 任务 2：补齐唛架编号投影和已有铺布单状态

**文件：**
- 修改：`src/pages/process-factory/cutting/marker-spreading-projection.ts:37-65`
- 修改：`src/pages/process-factory/cutting/marker-spreading-projection.ts:323-379`
- 修改：`src/pages/process-factory/cutting/marker-spreading-projection.ts:572-633`

- [ ] **步骤 1：为单个编号定义已有铺布单摘要**

在 `SpreadingCreateSourceRow` 前增加以下接口：

```typescript
export interface SpreadingCreateExistingOrder {
  spreadingOrderId: string
  spreadingOrderNo: string
  status: SpreadingOrder['status']
  statusLabel: string
}

```

然后在现有 `SpreadingCreateSourceRow` 的 `plannedSpreadLengthFormula` 后插入以下属性：

```typescript
sizePiecePerLayer: Record<string, number>
pieceQtyPerLayer: number
plannedLayerCount: number
styleImageUrl: string
businessSearchTerms: string[]
existingSpreadingOrder: SpreadingCreateExistingOrder | null
canCreate: boolean
```

从 `marker-spreading-model.ts` 导入 `spreadingOrderStatusMeta`，状态标签只使用现有中文映射。

- [ ] **步骤 2：增加款式图片解析函数**

在投影文件内增加原型所需的最小映射，不引入新的图片基础设施：

```typescript
const SPREADING_CREATE_STYLE_IMAGE_BY_SPU: Record<string, string> = {
  'SPU-2024-009': '/tshirt-sample.jpg',
  'SPU-2024-014': '/lace-dress-sample.jpg',
}

function resolveSpreadingCreateStyleImageUrl(spuCode: string): string {
  return SPREADING_CREATE_STYLE_IMAGE_BY_SPU[spuCode] || '/tshirt-sample.jpg'
}
```

本任务固定使用上述原型图片映射，不复制商品中心图片仓库，也不扩展跨模块图片接口。

- [ ] **步骤 3：让投影保留已生成铺布单的编号**

将 `buildSpreadingCreateSourceRows` 改为同时接收 `SpreadingOrder[]`。方案床位筛选从“仅未锁定”调整为“可铺布或已被铺布占用”，并按 `markerNumberId/sourceBedId` 找已有铺布单：

```typescript
function buildSpreadingCreateSourceRows(
  planProjection: ReturnType<typeof buildMarkerPlanProjection>,
  spreadingOrders: SpreadingOrder[],
): SpreadingCreateSourceRow[] {
  return planProjection.viewModel.plans
    .filter((plan) => plan.readyForSpreading && plan.status !== 'CANCELED')
    .flatMap((plan) => {
      const context = findMarkerPlanContextForPlan(planProjection.viewModel.contexts, plan)
      return buildCreateSourceRowsFromPlan(plan, context, spreadingOrders)
    })
}
```

在单行映射中加入：

```typescript
const existingOrder = spreadingOrders.find((order) =>
  order.markerNumberId === bed.bedId ||
  (order.markerPlanId === plan.id && order.bedNo === bed.bedNo),
) || null

sizePiecePerLayer: { ...bed.sizePiecePerLayer },
pieceQtyPerLayer: Math.max(Number(bed.markerPieceQtyPerLayer || 0), 0),
plannedLayerCount: Math.max(Number(bed.plannedLayerCount || 0), 0),
styleImageUrl: resolveSpreadingCreateStyleImageUrl(plan.spuCode),
businessSearchTerms: Array.from(new Set([
  ...context.sourceCutOrderRows.flatMap((row) => row.keywordIndex),
  ...context.cutOrderNos,
  ...context.productionOrderNos,
  context.spuCode,
  context.styleCode,
].filter(Boolean))),
existingSpreadingOrder: existingOrder
  ? {
      spreadingOrderId: existingOrder.spreadingOrderId,
      spreadingOrderNo: existingOrder.spreadingOrderNo,
      status: existingOrder.status,
      statusLabel: spreadingOrderStatusMeta[existingOrder.status].label,
    }
  : null,
canCreate: !existingOrder && bed.readyForSpreading && !bed.lockedBySpreading,
```

- [ ] **步骤 4：避免重复构建铺布事实**

在 `buildMarkerSpreadingProjection` 中先保存 `spreadingArtifacts.spreadingOrders`，再用以下精确属性初始化替换当前对应的 4 个属性：

```typescript
const spreadingOrders = spreadingArtifacts.spreadingOrders
const createSources = options.includeCreateSources === false
  ? []
  : buildSpreadingCreateSourceRows(markerPlanProjection, spreadingOrders)
const spreadingOrdersByMarkerPlanId = groupSpreadingOrdersByMarkerPlanId(spreadingOrders)
const spreadingOrdersByProductionOrderId = groupSpreadingOrdersByProductionOrderId(spreadingOrders)
```

返回对象中分别写入 `createSources`、`spreadingOrders`、`spreadingOrdersByMarkerPlanId` 和 `spreadingOrdersByProductionOrderId`，其他现有属性不改名、不删除。

- [ ] **步骤 5：运行类型检查入口和聚焦检查**

运行：

```bash
npm run check:cutting-marker-spreading-actions
npm run check:cutting-spreading-create-single-step
```

预期：两个命令均 PASS。

- [ ] **步骤 6：提交投影变更**

```bash
git add scripts/check-cutting-spreading-create-single-step.ts package.json src/pages/process-factory/cutting/marker-spreading-projection.ts
git commit -m "feat: 补齐铺布新建编号状态投影"
```

### 任务 3：重写新建铺布单页结构

**文件：**
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts:295-343`
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts:518-556`
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts:5505-5756`
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts:6336-6470`

- [ ] **步骤 1：收口页面状态**

先扩展 `scripts/check-cutting-spreading-create-single-step.ts`，加入页面能力、旧步骤退场和单张创建断言：

```typescript
for (const token of [
  'data-testid="cutting-spreading-create-business-search"',
  'data-testid="cutting-spreading-create-scheme-group"',
  'data-testid="cutting-spreading-create-size-ratio"',
  'data-testid="cutting-spreading-create-action-bar"',
  'data-cutting-marker-action="open-spreading-style-image"',
  'data-cutting-marker-action="confirm-spreading-create"',
]) {
  assert(pageSource.includes(token), `${pageFile} 缺少单步新建能力：${token}`)
}

for (const token of [
  'renderSpreadingCreateStepBar',
  'renderSpreadingCreateConfirmStep',
  'getSelectedCreateSchemeSources',
  'next-spreading-create-step',
  'prev-spreading-create-step',
  "step: 'confirm'",
]) {
  assert(!pageSource.includes(token), `${pageFile} 仍保留两步新建逻辑：${token}`)
}

const buildBlock = pageSource.match(/function buildCreateSessionsFromSelection\(\)[\s\S]*?\n\}/)?.[0] || ''
assert(buildBlock.includes('return [draft]'), '新建铺布必须只返回一个铺布单草稿')
assert(!buildBlock.includes('for (let rowIndex'), '新建铺布不得遍历方案下全部唛架编号')
```

运行 `npm run check:cutting-spreading-create-single-step`，预期 FAIL，错误为缺少 `cutting-spreading-create-business-search`。

随后删除 `createStep`，保留 `selectedCreateMarkerId`，并增加图片预览和方案展开状态：

删除 `createStep`。在现有 `selectedCreateSourceSnapshot` 后插入以下状态属性：

```typescript
expandedCreateSchemeIds: string[]
createPage: number
createPageSize: number
createStyleImagePreview: {
  imageUrl: string
  label: string
} | null
```

初始化值：

```typescript
selectedCreateMarkerId: '',
selectedCreateSourceSnapshot: null,
expandedCreateSchemeIds: [],
createPage: 1,
createPageSize: 10,
createStyleImagePreview: null,
```

`syncStateFromPath()` 不再读取 `step=confirm`，但继续读取 `bedId` 或 `markerId` 以支持从唛架方案跳入时预选具体编号。

同时将选择解析收口到具体编号，并删除 `getSelectedCreateSchemeSources()`：

```typescript
function getSelectedCreateSource(rows = getSpreadingCreateSourceRows()): SpreadingCreateSourceRow | null {
  if (!state.selectedCreateMarkerId) return null
  return rows.find((row) =>
    row.markerId === state.selectedCreateMarkerId ||
    row.sourceBedId === state.selectedCreateMarkerId,
  ) || state.selectedCreateSourceSnapshot
}
```

- [ ] **步骤 2：将搜索区改成业务对象优先**

新增独立渲染函数：

```typescript
function renderSpreadingCreateBusinessSearch(): string {
  return `
    <section class="rounded-xl border bg-card p-4" data-testid="cutting-spreading-create-business-search">
      ${renderTextInput(
        '查找要铺布的业务对象',
        state.keyword,
        'data-cutting-spreading-list-field="keyword" data-skip-page-rerender="true"',
        '生产需求单 / 生产单 / SPU / 裁片单',
      )}
      <details class="mt-3">
        <summary class="cursor-pointer text-sm text-blue-700">更多筛选</summary>
        <div class="mt-3 grid gap-3 md:grid-cols-3">
          ${renderTextInput('唛架方案', state.markerPlanSourceFilter, 'data-cutting-spreading-list-field="marker-plan-source"')}
          ${renderTextInput('唛架编号', state.markerNoFilter, 'data-cutting-spreading-list-field="marker-no"')}
          ${renderTextInput('颜色', state.colorFilter, 'data-cutting-spreading-list-field="color"')}
        </div>
      </details>
    </section>
  `
}
```

同步调整 `matchesSpreadingCreateSource()`，主关键词使用 `businessSearchTerms`，从而覆盖需求单号来源、生产单号、SPU 和裁片单号；不要把唛架编号从辅助筛选中删除：

```typescript
if (!matchesKeyword(state.keyword, [
  ...source.businessSearchTerms,
  source.sourceSchemeNo,
  source.sourceBedNo,
])) return false
```

在搜索区下方增加识别摘要，类型按编号前缀识别：

```typescript
function resolveSpreadingCreateSearchLabel(keyword: string): string {
  const normalized = keyword.trim().toUpperCase()
  if (normalized.startsWith('DEM-')) return '生产需求单'
  if (normalized.startsWith('PO-')) return '生产单'
  if (normalized.startsWith('SPU-')) return 'SPU'
  if (normalized.startsWith('CUT-')) return '裁片单'
  return '业务对象'
}
```

有结果时展示“已识别：生产单 PO-…；关联 N 个唛架方案”，无结果时展示“未找到与当前输入关联的唛架方案”。

- [ ] **步骤 3：按唛架方案建立分组视图模型**

新增小函数，排序时“仍有可新建编号”的方案优先：

```typescript
interface SpreadingCreateSchemeGroup {
  schemeId: string
  schemeNo: string
  rows: SpreadingCreateSourceRow[]
  creatableCount: number
  first: SpreadingCreateSourceRow
}

function groupSpreadingCreateSources(rows: SpreadingCreateSourceRow[]): SpreadingCreateSchemeGroup[] {
  return Array.from(rows.reduce<Map<string, SpreadingCreateSourceRow[]>>((groups, row) => {
    const key = row.sourceSchemeId || row.markerId
    groups.set(key, [...(groups.get(key) || []), row])
    return groups
  }, new Map()))
    .map(([schemeId, schemeRows]) => ({
      schemeId,
      schemeNo: schemeRows[0].sourceSchemeNo,
      rows: schemeRows.sort((left, right) => left.sourceBedNo.localeCompare(right.sourceBedNo, 'zh-CN', { numeric: true })),
      creatableCount: schemeRows.filter((row) => row.canCreate).length,
      first: schemeRows[0],
    }))
    .sort((left, right) => Number(right.creatableCount > 0) - Number(left.creatableCount > 0))
}
```

对分组结果做方案级分页，不对编号行单独分页：

```typescript
function paginateSpreadingCreateGroups(groups: SpreadingCreateSchemeGroup[]): SpreadingCreateSchemeGroup[] {
  const totalPages = Math.max(1, Math.ceil(groups.length / state.createPageSize))
  state.createPage = Math.min(Math.max(state.createPage, 1), totalPages)
  const start = (state.createPage - 1) * state.createPageSize
  return groups.slice(start, start + state.createPageSize)
}
```

结果区底部输出 `data-testid="cutting-spreading-create-pagination"`，明确“共 N 个唛架方案、第 X / Y 页、每页 10 个”，并提供上一页和下一页动作。

- [ ] **步骤 4：渲染方案头部、尺码表和已有铺布单**

尺码文本只取大于 0 的值：

```typescript
function formatCreateSizePiecePerLayer(row: SpreadingCreateSourceRow): string {
  return Object.entries(row.sizePiecePerLayer)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([size, qty]) => `${size} × ${formatQty(qty)}`)
    .join(' + ') || '待补尺码表'
}
```

每个分组输出 `data-testid="cutting-spreading-create-scheme-group"`。方案头部只展示一次缩略图；编号行输出：

```typescript
<span data-testid="cutting-spreading-create-size-ratio">
  ${escapeHtml(formatCreateSizePiecePerLayer(row))}
</span>
```

已有铺布单行使用 `row.existingSpreadingOrder` 输出中文状态和详情按钮；选择按钮必须满足：

```typescript
${row.canCreate
  ? `<button data-cutting-marker-action="select-spreading-create-marker" data-marker-id="${escapeHtml(row.markerId)}">选择</button>`
  : `<button disabled>已生成</button>`}
```

铺布单号详情入口使用现有 `open-spreading-detail` 动作和 `spreadingOrderId`，不新增路由。

- [ ] **步骤 5：渲染单页底部操作区**

删除步骤条、上一步、下一步和确认页表格，改为：

```typescript
function renderSpreadingCreateActionBar(selected: SpreadingCreateSourceRow | null): string {
  const canCreate = Boolean(selected?.canCreate)
  return `
    <section class="sticky bottom-0 rounded-xl border bg-card p-4 shadow-sm" data-testid="cutting-spreading-create-action-bar">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm">
          ${selected
            ? `将为 ${escapeHtml(selected.sourceSchemeNo)} / ${escapeHtml(selected.sourceBedNo)} 生成 1 张铺布单。`
            : '请选择一个尚未生成铺布单的唛架编号。'}
        </p>
        <button data-cutting-marker-action="confirm-spreading-create" ${canCreate ? '' : 'disabled'}>
          生成铺布单
        </button>
      </div>
    </section>
  `
}
```

- [ ] **步骤 6：让创建函数只构造一个草稿**

用单个 `source` 替换 `getSelectedCreateSchemeSources()` 和 `for` 循环，并执行以下完整的来源、件数和长度校验：

```typescript
function buildCreateSessionsFromSelection(): SpreadingSession[] | null {
  const source = getSelectedCreateSource()
  if (!source?.canCreate || !source.markerId) {
    state.feedback = { tone: 'warning', message: '创建铺布需先选择一个尚未生成铺布单的唛架编号。' }
    return null
  }

  if (!source.spreadingContext || !source.markerRecord) {
    state.feedback = { tone: 'warning', message: `唛架编号 ${source.sourceBedNo || source.markerNo} 未识别到上下文，无法创建铺布。` }
    return null
  }

  const identity = buildSpreadingSessionIdentityForMarkerBed(source, 0)
  const draft = createSpreadingDraftFromMarker(
    source.markerRecord,
    source.spreadingContext,
    new Date(),
    {
      baseSession: {
        spreadingSessionId: identity.spreadingSessionId,
        sessionNo: identity.sessionNo,
        note: state.createNote || '铺布单已创建，待铺布。',
        ownerAccountId: '',
        ownerName: '',
        isExceptionBackfill: false,
        exceptionReason: '',
      },
    },
  )
  const bedNo = source.sourceBedNo || source.markerNo || draft.sourceBedNo || draft.markerNo || ''
  const bedId = source.sourceBedId || source.markerId || draft.sourceBedId || draft.sourceMarkerId || ''

  Object.assign(draft, {
    status: 'DRAFT',
    cuttingStatus: undefined,
    ownerAccountId: '',
    ownerName: '',
    note: state.createNote || draft.note,
    cuttingTableId: '',
    cuttingTableNo: '',
    cuttingTableName: '',
    plannedStartAt: '',
    plannedEndAt: '',
    actualStartAt: '',
    actualEndAt: '',
    estimatedDurationMinutes: DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    tableScheduleStatus: '未排程',
    scheduleMode: 'BY_MARKER_NO',
    scheduleBatchId: `spreading-create-batch-${Date.now()}`,
    sequenceNoInScheme: 1,
    sourceSchemeId: source.sourceSchemeId || draft.sourceSchemeId,
    sourceSchemeNo: source.sourceSchemeNo || draft.sourceSchemeNo,
    sourceBedId: bedId,
    sourceBedNo: bedNo,
    markerNo: bedNo,
    sourceMarkerNo: bedNo,
  })

  draft.theoreticalSpreadTotalLength = draft.planUnits.reduce(
    (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
    0,
  )
  draft.theoreticalActualCutPieceQty = draft.planUnits.reduce(
    (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
    0,
  )
  if (!draft.sourceMarkerId || !draft.sourceSchemeId || !draft.sourceBedId) {
    state.feedback = { tone: 'warning', message: `唛架编号 ${bedNo || '待补'} 未绑定来源唛架方案。` }
    return null
  }
  if (draft.theoreticalActualCutPieceQty <= 0) {
    state.feedback = { tone: 'warning', message: `唛架编号 ${bedNo || '待补'} 的计划成衣件数必须大于 0。` }
    return null
  }
  if (draft.theoreticalSpreadTotalLength <= 0) {
    state.feedback = { tone: 'warning', message: `唛架编号 ${bedNo || '待补'} 的计划铺布总长度必须大于 0。` }
    return null
  }
  draft.operationLogs = buildSpreadingSessionOperationLogs(draft)
  return [draft]
}
```

- [ ] **步骤 7：运行聚焦检查**

运行：

```bash
npm run check:cutting-spreading-create-single-step
npm run check:cutting-marker-spreading-actions
```

预期：两个命令均 PASS。

- [ ] **步骤 8：提交单页结构**

```bash
git add scripts/check-cutting-spreading-create-single-step.ts src/pages/process-factory/cutting/marker-spreading.ts
git commit -m "feat: 将新建铺布收口为单页单选"
```

### 任务 4：补齐局部交互、图片弹窗和重复防错

**文件：**
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts:6792-6885`
- 修改：`src/pages/process-factory/cutting/marker-spreading.ts:7307-7370`

- [ ] **步骤 1：让编号选择只接受可新建行**

先增加结果区和弹窗的局部更新函数，后续动作统一调用这些函数：

```typescript
function updateSpreadingCreateResults(): void {
  const results = document.querySelector<HTMLElement>('[data-cutting-spreading-create-results]')
  if (results) results.outerHTML = renderSpreadingCreateResults(getSpreadingCreateSourceRows())
  const actionBar = document.querySelector<HTMLElement>('[data-testid="cutting-spreading-create-action-bar"]')
  if (actionBar) actionBar.outerHTML = renderSpreadingCreateActionBar(getSelectedCreateSource())
}

function updateSpreadingCreateImageDialog(): void {
  const host = document.querySelector<HTMLElement>('[data-spreading-create-image-dialog-host]')
  if (host) host.innerHTML = renderSpreadingCreateImageDialog(state.createStyleImagePreview)
}
```

`renderSpreadingCreateResults()` 负责输出方案分组和分页；`renderSpreadingCreateImageDialog()` 负责输出带 `role="dialog"`、关闭按钮和遮罩的图片预览。

在现有新建页筛选输入处理分支中，关键词或辅助筛选变化时同步清理旧选择，避免提交已经被过滤隐藏的编号：

```typescript
state.createPage = 1
state.selectedCreateMarkerId = ''
state.selectedCreateSourceSnapshot = null
updateSpreadingCreateResults()
```

在 `select-spreading-create-marker` 动作中按具体 `markerId/sourceBedId` 查找，不再匹配 `sourceSchemeId`：

```typescript
const selectedSource = currentRows.find((row) =>
  row.markerId === markerId || row.sourceBedId === markerId,
) || null

if (!selectedSource?.canCreate) {
  state.feedback = { tone: 'warning', message: '该唛架编号已生成铺布单，不能重复创建。' }
  return true
}
```

只局部更新旧行、新行和底部操作区；不要调用页面级导航。

- [ ] **步骤 2：增加方案展开和收起动作**

```typescript
if (action === 'toggle-spreading-create-scheme') {
  const schemeId = actionNode.dataset.schemeId || ''
  state.expandedCreateSchemeIds = state.expandedCreateSchemeIds.includes(schemeId)
    ? state.expandedCreateSchemeIds.filter((id) => id !== schemeId)
    : [...state.expandedCreateSchemeIds, schemeId]
  updateSpreadingCreateResults()
  return true
}
```

默认展开所有有可新建编号的方案，全部已生成的方案默认收起。

同时增加方案级分页动作：

```typescript
if (action === 'spreading-create-page-prev' || action === 'spreading-create-page-next') {
  state.createPage += action === 'spreading-create-page-next' ? 1 : -1
  state.selectedCreateMarkerId = ''
  state.selectedCreateSourceSnapshot = null
  updateSpreadingCreateResults()
  return true
}
```

- [ ] **步骤 3：增加款式大图弹窗**

使用现有 Dialog 字符串组件或同等现有弹窗模式，增加动作：

```typescript
if (action === 'open-spreading-style-image') {
  state.createStyleImagePreview = {
    imageUrl: actionNode.dataset.imageUrl || '',
    label: actionNode.dataset.imageLabel || '款式图片',
  }
  updateSpreadingCreateImageDialog()
  return true
}

if (action === 'close-spreading-style-image') {
  state.createStyleImagePreview = null
  updateSpreadingCreateImageDialog()
  return true
}
```

弹窗支持关闭按钮、遮罩和 Esc；缺图时方案头部显示“暂无款式图”，不绑定打开动作。

缩略图按钮必须提供可访问名称：

```typescript
aria-label="查看 ${escapeHtml(row.spuCode || row.styleCode)} 款式大图"
```

- [ ] **步骤 4：提交前再次检查已有铺布单**

在 `confirmSpreadingCreate()` 构造草稿前重新读取投影：

```typescript
const latestSource = getSpreadingCreateSourceRows().find((row) =>
  row.markerId === state.selectedCreateMarkerId ||
  row.sourceBedId === state.selectedCreateMarkerId,
) || null

if (!latestSource?.canCreate || latestSource.existingSpreadingOrder) {
  state.selectedCreateMarkerId = ''
  state.feedback = { tone: 'warning', message: '该唛架编号已生成铺布单，请查看已有铺布单。' }
  updateSpreadingCreateResults()
  return true
}
```

点击主按钮后立即设置 `disabled` 和 `aria-busy="true"`；成功导航前不允许第二次提交。捆条确认取消时恢复按钮并保留选择。

- [ ] **步骤 5：运行聚焦检查和构建**

运行：

```bash
npm run check:cutting-spreading-create-single-step
npm run build
```

预期：聚焦检查 PASS；构建成功且无 TypeScript/Vite 错误。

- [ ] **步骤 6：提交交互变更**

```bash
git add src/pages/process-factory/cutting/marker-spreading.ts
git commit -m "feat: 补齐铺布单选防错和款式预览"
```

### 任务 5：增加浏览器验收覆盖

**文件：**
- 创建：`tests/cutting-spreading-create-single-step.spec.ts`
- 修改：`scripts/check-cutting-marker-spreading-actions.ts:16-34`

- [ ] **步骤 1：编写失败的 Playwright 用例**

创建用例并复用 `collectPageErrors`：

```typescript
import { expect, test } from '@playwright/test'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('新建铺布按业务对象搜索并只为一个唛架编号生成一张铺布单', async ({ page }) => {
  const errors = collectPageErrors(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/fcs/craft/cutting/spreading-create')

  await expect(page.getByTestId('cutting-spreading-create-steps')).toHaveCount(0)
  const search = page.getByTestId('cutting-spreading-create-business-search').getByRole('textbox').first()
  await search.fill('PO-202603-0003')
  await search.press('Enter')

  const groups = page.getByTestId('cutting-spreading-create-scheme-group')
  expect(await groups.count()).toBeGreaterThan(1)
  await expect(groups.first().getByTestId('cutting-spreading-create-size-ratio').first()).toContainText('×')

  const existingRow = groups.locator('tr').filter({ hasText: /待铺布|铺布中|已完成/ }).first()
  await expect(existingRow.getByRole('button', { name: '已生成' })).toBeDisabled()
  await expect(existingRow.getByRole('button', { name: /SP-/ })).toBeVisible()

  const creatableRow = groups.locator('tr').filter({ has: page.getByRole('button', { name: '选择', exact: true }) }).first()
  await creatableRow.getByRole('button', { name: '选择', exact: true }).click()
  await expect(page.getByTestId('cutting-spreading-create-action-bar')).toContainText('生成 1 张铺布单')

  await page.getByRole('button', { name: '生成铺布单' }).click()
  await expect(page).toHaveURL(/\/fcs\/craft\/cutting\/spreading-edit/)
  await expectNoPageErrors(errors)
})

test('新建铺布支持款式缩略图放大并适配最低分辨率', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/fcs/craft/cutting/spreading-create')

  await page.getByRole('button', { name: /查看.*大图/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(bodyOverflow).toBeLessThanOrEqual(1)
})
```

选择可创建行时使用行内 locator，避免 `page.getByRole()` 跨分组误匹配；如当前 Mock 编号不同，只替换搜索词和断言中的业务编号，不降低状态覆盖。

- [ ] **步骤 2：把新测试加入现有完整性检查**

在 `check-cutting-marker-spreading-actions.ts` 中增加：

```typescript
const spreadingCreateSingleStepTest = 'tests/cutting-spreading-create-single-step.spec.ts'
assertFileExists(spreadingCreateSingleStepTest)
```

- [ ] **步骤 3：运行用例并确认失败位置**

运行：

```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/cutting-spreading-create-single-step.spec.ts
```

如果任务 2 至任务 4 已正确完成，预期直接 PASS；若失败，只修复与具体断言对应的页面问题，不放宽“多方案、已有状态、单张生成、图片弹窗”断言。

- [ ] **步骤 4：运行铺布相关回归**

运行：

```bash
npm run check:cutting-marker-spreading-actions
PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test \
  tests/cutting-spreading-create-single-step.spec.ts \
  tests/cutting-marker-spreading-list.spec.ts \
  tests/cutting-marker-plan-action-completeness.spec.ts
```

预期：聚焦检查 PASS；Playwright 3 个文件全部 PASS。

- [ ] **步骤 5：提交浏览器测试**

```bash
git add tests/cutting-spreading-create-single-step.spec.ts scripts/check-cutting-marker-spreading-actions.ts
git commit -m "test: 覆盖新建铺布单步选择"
```

### 任务 6：完成原型审查记录和交付门禁

**文件：**
- 创建：`docs/prototype-review-records/2026-07-18-spreading-create-single-step.md`

- [ ] **步骤 1：填写原型审查记录**

按模板记录：

```markdown
# 新建铺布单步选择原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-18 |
| 相关需求 / 任务 | 新建铺布由两步改为一步 |
| 涉及系统 | PFOS |
| 涉及页面路径 | `/fcs/craft/cutting/spreading-create` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 裁床计划员、裁床主管 |
| 主要任务 | 通过上游业务对象找到唛架方案，选择一个未生成编号并创建一张铺布单 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 页面服务裁床计划员和主管 |
| 任务清晰度 | 通过 | 单页只有“生成铺布单”一个主动作 |
| 信息架构与导航 | 通过 | 上游对象搜索后按唛架方案分组 |
| 页面模式 | 通过 | 管理端使用方案分组明细表 |
| 信息负荷 | 通过 | 款式图在方案头部只展示一次 |
| 文案 | 通过 | 使用中文业务对象和动作文案 |
| 数量与状态 | 通过 | 展示每层尺码件数、层数、总件数和铺布状态 |
| 扫码与识别 | 有条件通过 | 管理端以单号搜索为主，款式图片辅助识别 |
| 防错 | 通过 | 已生成编号禁选，提交前再次检查重复 |
| UI 样式 | 通过 | 方案分组稳定，宽表只在结果容器内滚动 |
| 组件交互 | 通过 | 搜索、选择、展开和弹窗使用局部更新 |
| 协作关系 | 通过 | 保留上游单据和已有铺布单入口 |
| 异常与追溯 | 通过 | 空态、重复生成和捆条确认均有反馈 |
| 现场设备可用性 | 通过 | 覆盖 1366 × 768 和 1280 × 720 |

## 6. 最终结论

结论：通过

说明：本页是管理端 / 主管端业务选择页，使用方案分组明细表；不属于标准业务列表维护页，不声明 `@page-pattern: list`。页面仍保留方案级分页、内部横向滚动和固定生成动作，作为信息密度与防错措施。
```

补全模板中的所有检查项，不保留空行、空单元格或未处理标签。

- [ ] **步骤 2：运行设计与列表治理检查**

运行：

```bash
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
```

预期：两个命令均 PASS。若列表治理认为该页属于列表页，不修改基线或检查脚本；改为使用标准列表页契约，或在审查记录中按检查器允许的正式例外机制说明。

- [ ] **步骤 3：运行最终自动验证**

运行：

```bash
npm run check:cutting-spreading-create-single-step
npm run check:cutting-marker-spreading-actions
npm run check:prototype-design-governance -- --all
npm run build
PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test \
  tests/cutting-spreading-create-single-step.spec.ts \
  tests/cutting-marker-spreading-list.spec.ts \
  tests/cutting-marker-plan-action-completeness.spec.ts
```

预期：所有检查和构建 PASS；Playwright 3 个文件全部 PASS。

- [ ] **步骤 4：进行本地浏览器人工验收**

使用浏览器访问 `/fcs/craft/cutting/spreading-create`，分别检查：

- 用生产需求单、生产单、SPU 和裁片单查询。
- 命中多个唛架方案时分组正确。
- 未生成、待铺布、铺布中、已完成同时可辨认。
- 已生成编号禁选且铺布单号可进入详情。
- 选择一个编号后只显示生成 1 张。
- 缩略图打开大图，Esc 和关闭按钮均可关闭。
- 1366 × 768 与 1280 × 720 下页面主体无横向溢出。
- 选择、展开和弹窗没有整页闪烁或滚动位置丢失。

- [ ] **步骤 5：同步 CodeGraph 并确认无待同步文件**

```bash
codegraph sync
codegraph status
```

预期：状态显示 `Index is up to date`，没有 `Pending sync` 文件。

- [ ] **步骤 6：提交审查记录和最终收口**

```bash
git add docs/prototype-review-records/2026-07-18-spreading-create-single-step.md
git commit -m "docs: 记录新建铺布单步原型审查"
```

### 任务 7：独立复核与交付决策

**文件：**
- 复核：`docs/superpowers/specs/2026-07-18-spreading-create-single-step-design.md`
- 复核：`docs/superpowers/plans/2026-07-18-spreading-create-single-step.md`
- 复核：任务 1 至任务 6 的全部改动

- [ ] **步骤 1：逐条对照规格验收标准**

建立 12 项规格验收清单，逐项附上对应的检查命令、Playwright 断言或浏览器证据；任何一项缺证据都回到对应任务补齐。

- [ ] **步骤 2：检查提交范围**

```bash
git status --short
git diff --stat origin/main...HEAD
git log -7 --oneline
```

预期：仅包含计划列出的页面、投影、检查、测试和审查记录；没有无关模块、依赖或配置改动。

- [ ] **步骤 3：复跑最终门禁**

```bash
npm run check:cutting-spreading-create-single-step
npm run check:cutting-marker-spreading-actions
npm run check:prototype-design-governance -- --all
npm run build
PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/cutting-spreading-create-single-step.spec.ts
```

预期：全部 PASS。

- [ ] **步骤 4：根据仓库保护规则选择集成方式**

若当前不在受保护 `main`，保留当前功能分支并创建 PR；若当前分支包含其他主题提交，先在独立 `codex/` 分支或 worktree 中只提取本计划提交，再创建 PR。不要把无关提交一起推送。
