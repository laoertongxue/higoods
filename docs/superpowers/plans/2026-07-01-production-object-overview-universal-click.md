# 生产对象总览跨系统编号点击实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让当前原型仓库中所有生产相关系统页面里的生产单、需求单、物料、仓储、加工、质检、交接等业务编号，都能点击打开统一的右侧生产对象总览。

**架构：** 复用现有 `生产对象总览` 浮层、全局搜索索引和编号按钮，不新增路由、不新增后端、不做源系统写回。数据层补齐跨系统对象索引、默认 Tab、高亮对象、未关联和多匹配状态；UI 层统一编号按钮、右侧抽屉、PDA 窄屏展示和代表页面接入。

**技术栈：** Vite，TypeScript，Vanilla 字符串模板渲染，Tailwind CSS，本地 mock 数据，tsx 检查脚本，Playwright 浏览器验收。

---

## 文件结构

**修改：**
- `scripts/check-production-object-overview.ts` — 扩展现有检查，覆盖跨系统入口、对象类型、默认 Tab、高亮、未关联、多匹配、PDA/低分辨率结构和代表页面编号按钮。
- `src/data/fcs/production-object-overview.ts` — 扩展生产对象类型、搜索索引字段、对象解析、默认 Tab、高亮 key、被点击对象摘要、未关联状态和多匹配状态。
- `src/data/fcs/production-order-identity.ts` — 扩展统一编号按钮，让更多对象类型能使用同一个 `data-production-object-action="open"` 入口。
- `src/components/production-object-overview.ts` — 扩展可显示路由、打开参数、被点击对象区、数量 Tab、未关联/多匹配 UI、PDA 窄屏 UI。
- `src/components/shell.ts` — 继续挂载统一浮层入口，行为由 `renderProductionObjectFloatingEntry()` 控制。
- `src/styles.css` — 调整右侧抽屉和窄屏/PDA 样式，保证 1366x768 和移动宽度可用。
- `src/pages/production/orders-domain.ts` — 生产单管理代表页面，确保生产单、需求单、SPU、相关单据编号统一可点击。
- `src/pages/production/demand-domain.ts` — 生产需求代表页面，确保需求号和已生成生产单号统一可点击。
- `src/pages/production-order-progress-tracking.ts` — 进度代表页面，确保生产单、物料需求、裁片、车缝、交接等编号统一可点击。
- `src/pages/fcs/material-prep/shared.ts` — FCS 配料代表页面，确保配料单、配料记录、领料记录、生产单、物料 SKU 可点击。
- `src/pages/process-factory/cutting/cut-orders.ts` — PFOS 裁片代表页面，确保裁片单、生产单、飞票、铺布相关编号可点击。
- `src/pages/process-factory/cutting/pickup-management.ts` — PFOS 领料代表页面，确保领料、配料、生产单、物料 SKU 可点击。
- `src/pages/process-factory/printing/work-orders.ts` — PFOS 印花代表页面，确保印花工单和生产单可点击。
- `src/pages/process-factory/dyeing/work-orders.ts` — PFOS 染色代表页面，确保染色工单和生产单可点击。
- `src/pages/process-factory/post-finishing/qc-orders.ts` — 后道质检代表页面，确保质检总单、质检单、复检、生产单可点击。
- `src/pages/pda-exec-detail.ts` — PDA 执行详情代表页面，确保生产相关编号可打开移动适配总览。
- `src/pages/pda-handover-detail.ts` — PDA 交接详情代表页面，确保交接、回货、生产单编号可打开移动适配总览。

**不修改：**
- 不新增真实 API、数据库、权限、跨系统写回。
- 不新增每个系统自己的详情抽屉。
- 不改打印模板的纸面内容；只保证打印来源页面的编号可点击。
- 不把完整台账复制到每个列表页。

---

### 任务 1：检查脚本先覆盖跨系统编号入口

**文件：**
- 修改：`scripts/check-production-object-overview.ts`

- [ ] **步骤 1：扩展必需文件列表**

在 `requiredFiles` 里追加代表页面：

```typescript
  'src/pages/fcs/material-prep/shared.ts',
  'src/pages/process-factory/cutting/pickup-management.ts',
  'src/pages/process-factory/post-finishing/qc-orders.ts',
  'src/pages/pda-exec-detail.ts',
  'src/pages/pda-handover-detail.ts',
```

- [ ] **步骤 2：加入跨系统对象字段断言**

放在 `assert.ok(Array.isArray(productionObjectSearchIndex), ...)` 后：

```typescript
const requiredUniversalFields = ['sourceDomain', 'defaultTab', 'highlightKey'] as const
const universalIndexedItems = productionObjectSearchIndex.filter((item) =>
  ['MATERIAL_PREP_ORDER', 'MATERIAL_PREP_RECORD', 'MATERIAL_PICKUP_RECORD', 'CUT_ORDER', 'PRINT_WORK_ORDER', 'DYE_WORK_ORDER', 'HANDOVER_ORDER', 'QC_ORDER', 'QC_MASTER_ORDER', 'RECHECK_ORDER'].includes(item.objectType),
)
assert.ok(universalIndexedItems.length >= 10, '生产对象索引必须覆盖跨系统代表单据')
for (const item of universalIndexedItems) {
  for (const field of requiredUniversalFields) {
    assert.ok(field in item, `${item.primaryNo} 必须带 ${field}`)
  }
  assert.ok(item.relatedProductionOrderNo, `${item.primaryNo} 必须能回溯生产单`)
}
```

- [ ] **步骤 3：加入默认 Tab 与高亮断言**

放在现有 `p1SearchCases` 后：

```typescript
const defaultTabCases: Array<[string, string, string]> = [
  ['MPO-202603-0001', 'materials', '配料单默认打开物料 Tab'],
  ['PICK-202603-0001', 'materials', '领料记录默认打开物料 Tab'],
  ['CUT-260306-101-01', 'progress', '裁片单默认打开任务 Tab'],
  ['PRINT-WO-202603-0001', 'progress', '印花工单默认打开任务 Tab'],
  ['DYE-WO-202603-0001', 'progress', '染色工单默认打开任务 Tab'],
  ['HAND-202603-0001', 'quantity', '交接单默认打开数量 Tab'],
]

for (const [keyword, tab, message] of defaultTabCases) {
  const hit = searchProductionObjects(keyword)[0]
  assert.ok(hit, `${keyword} 必须可搜索`)
  assert.equal(hit.defaultTab, tab, message)
  assert.ok(hit.highlightKey, `${keyword} 必须带高亮对象 key`)
}
```

- [ ] **步骤 4：加入未关联和多匹配断言**

放在多生产单搜索断言后：

```typescript
assert.equal(typeof dataModule.resolveProductionObjectRequest, 'function', '必须导出统一编号解析函数')
const unresolved = dataModule.resolveProductionObjectRequest({
  objectType: 'WAREHOUSE_DOC',
  objectId: 'PICK-NO-PRODUCTION-001',
})
assert.equal(unresolved.status, 'UNLINKED', '找不到生产主线时必须返回未关联状态')
assert.ok(unresolved.message.includes('未找到关联生产单'), '未关联状态必须说明原因')

const multiMatched = dataModule.resolveProductionObjectRequest({
  objectType: 'MATERIAL',
  objectId: 'FLSZ260617009',
})
assert.ok(['READY', 'MULTIPLE_MATCHES'].includes(multiMatched.status), '物料多生产单场景必须可解析或要求选择')
if (multiMatched.status === 'MULTIPLE_MATCHES') {
  assert.ok(multiMatched.candidates.length >= 2, '多匹配状态必须列出候选生产单')
}
```

- [ ] **步骤 5：加入 UI 文案和路由断言**

放在 `const surface = uiModule.renderProductionObjectOverviewSurface(...)` 后：

```typescript
const linkedSurface = uiModule.renderProductionObjectOverviewSurface('MATERIAL_PICKUP_RECORD', 'PICK-202603-0001')
for (const text of ['当前查看', '来源系统', '关联生产单', '数量', '单据关系']) {
  assert.ok(linkedSurface.includes(text), `跨系统对象总览缺少 ${text}`)
}
assert.ok(linkedSurface.includes('data-production-object-highlight-key'), '总览必须保留高亮对象 key')

const unlinkedSurface = uiModule.renderProductionObjectOverviewSurface('WAREHOUSE_DOC', 'PICK-NO-PRODUCTION-001')
assert.ok(unlinkedSurface.includes('未找到关联生产单'), '未关联对象必须展示明确提示')
assert.ok(unlinkedSurface.includes('查看来源'), '未关联对象必须保留来源入口')

assert.ok(uiModule.renderProductionObjectFloatingEntry('/pcs/projects').includes('查生产'), 'PCS 页面必须能显示查生产入口')
assert.ok(uiModule.renderProductionObjectFloatingEntry('/pms/purchase-order').includes('查生产'), 'PMS 页面必须能显示查生产入口')
assert.ok(uiModule.renderProductionObjectFloatingEntry('/wls/inventory').includes('查生产'), 'WLS 页面必须能显示查生产入口')
assert.ok(uiModule.renderProductionObjectFloatingEntry('/fcs/craft/post-finishing/qc-orders').includes('查生产'), 'PFOS 页面必须能显示查生产入口')
assert.ok(uiModule.renderProductionObjectFloatingEntry('/fcs/pda/exec').includes('查生产'), 'PDA 页面必须能显示移动查生产入口')
assert.equal(uiModule.renderProductionObjectFloatingEntry('/fcs/print/post-finishing-qc').trim(), '', '打印页不显示查生产入口')
```

- [ ] **步骤 6：加入代表页面编号按钮断言**

放在文件级源码断言区域：

```typescript
for (const [path, expected] of [
  ['src/pages/fcs/material-prep/shared.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/process-factory/cutting/cut-orders.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/process-factory/cutting/pickup-management.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/process-factory/printing/work-orders.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/process-factory/dyeing/work-orders.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/process-factory/post-finishing/qc-orders.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/pda-exec-detail.ts', 'renderProductionObjectCodeButton'],
  ['src/pages/pda-handover-detail.ts', 'renderProductionObjectCodeButton'],
] as const) {
  assertIncludes(path, expected, `${path} 必须使用统一生产对象编号按钮`)
}
assertIncludes('src/components/production-object-overview.ts', "'quantity'", '总览必须有数量 Tab')
assertIncludes('src/components/production-object-overview.ts', 'renderClickedObjectSummary', '总览必须展示被点击对象摘要')
```

- [ ] **步骤 7：运行检查验证失败**

运行：

```bash
cd /Users/laoer/Documents/higoods
npm run check:production-object-overview
```

预期：FAIL，错误包含 `必须覆盖跨系统代表单据`、`必须导出统一编号解析函数` 或 `必须显示查生产入口`。

- [ ] **步骤 8：Commit**

```bash
git add scripts/check-production-object-overview.ts
git commit -m "test: cover universal production object entry"
```

---

### 任务 2：数据层扩展生产对象类型和解析结果

**文件：**
- 修改：`src/data/fcs/production-object-overview.ts`

- [ ] **步骤 1：扩展对象类型和来源系统**

把 `ProductionObjectType` 和 `ProductionObjectSourceDomain` 扩展为：

```typescript
export type ProductionObjectType =
  | 'PRODUCTION_ORDER'
  | 'DEMAND'
  | 'MATERIAL'
  | 'WAREHOUSE_DOC'
  | 'PROCESS_DOC'
  | 'MATERIAL_PREP_ORDER'
  | 'MATERIAL_PREP_RECORD'
  | 'MATERIAL_PICKUP_RECORD'
  | 'CUT_ORDER'
  | 'FEI_TICKET'
  | 'SPREADING_ORDER'
  | 'PRINT_WORK_ORDER'
  | 'DYE_WORK_ORDER'
  | 'HANDOVER_ORDER'
  | 'QC_MASTER_ORDER'
  | 'QC_ORDER'
  | 'RECHECK_ORDER'
  | 'FINISHED_INBOUND_ORDER'
  | 'PURCHASE_ORDER'

export type ProductionObjectSourceDomain = 'FCS' | 'PFOS' | 'WMS' | 'PMS' | 'PCS' | 'PDA'
export type ProductionObjectRequestStatus = 'READY' | 'UNLINKED' | 'MULTIPLE_MATCHES'
export type ProductionObjectDefaultTab = 'overview' | 'materials' | 'progress' | 'quantity' | 'issues' | 'relationship'
```

- [ ] **步骤 2：扩展索引字段**

把 `ProductionObjectSearchIndex` 补成：

```typescript
export interface ProductionObjectSearchIndex {
  id: string
  objectType: ProductionObjectType
  primaryNo: string
  secondaryNo?: string
  displayTitle: string
  keywords: string[]
  matchedReason?: string
  relatedProductionOrderNo?: string
  relatedDemandNo?: string
  statusText?: string
  ownerRole?: ProductionObjectOwnerRole
  sourceDomain: ProductionObjectSourceDomain
  docGroup?: RelatedDocumentGroup
  routePath?: string
  quantityText?: string
  updatedAt?: string
  defaultTab?: ProductionObjectDefaultTab
  highlightKey?: string
}
```

- [ ] **步骤 3：新增解析结果类型**

放在 `ProductionObjectOverview` 后：

```typescript
export interface ProductionObjectClickedRef {
  objectType: ProductionObjectType
  objectId: string
  objectNo: string
  displayTitle: string
  sourceDomain: ProductionObjectSourceDomain
  statusText: string
  routePath?: string
  defaultTab: ProductionObjectDefaultTab
  highlightKey: string
}

export interface ProductionObjectUnlinkedResult {
  status: 'UNLINKED'
  request: Pick<ProductionObjectClickedRef, 'objectType' | 'objectId'>
  displayTitle: string
  sourceDomain: ProductionObjectSourceDomain
  message: string
  routePath?: string
}

export interface ProductionObjectMultipleMatchesResult {
  status: 'MULTIPLE_MATCHES'
  request: Pick<ProductionObjectClickedRef, 'objectType' | 'objectId'>
  candidates: ProductionObjectSearchIndex[]
}

export interface ProductionObjectReadyResult {
  status: 'READY'
  indexItem: ProductionObjectSearchIndex
  clickedRef: ProductionObjectClickedRef
}

export type ProductionObjectRequestResult =
  | ProductionObjectReadyResult
  | ProductionObjectUnlinkedResult
  | ProductionObjectMultipleMatchesResult
```

- [ ] **步骤 4：新增默认 Tab 工具函数**

放在 `findIndexItem()` 附近：

```typescript
function getDefaultTabForObjectType(objectType: ProductionObjectType): ProductionObjectDefaultTab {
  if (['MATERIAL', 'MATERIAL_PREP_ORDER', 'MATERIAL_PREP_RECORD', 'MATERIAL_PICKUP_RECORD', 'PURCHASE_ORDER', 'WAREHOUSE_DOC'].includes(objectType)) return 'materials'
  if (['CUT_ORDER', 'FEI_TICKET', 'SPREADING_ORDER', 'PRINT_WORK_ORDER', 'DYE_WORK_ORDER', 'PROCESS_DOC'].includes(objectType)) return 'progress'
  if (['HANDOVER_ORDER', 'QC_MASTER_ORDER', 'QC_ORDER', 'RECHECK_ORDER', 'FINISHED_INBOUND_ORDER'].includes(objectType)) return 'quantity'
  return 'overview'
}

function makeHighlightKey(objectType: ProductionObjectType, objectNo: string): string {
  return `${objectType}:${objectNo}`
}
```

- [ ] **步骤 5：新增统一编号解析函数**

放在 `resolveOrder()` 前：

```typescript
export function resolveProductionObjectRequest({
  objectType,
  objectId,
  relatedProductionOrderNo,
}: {
  objectType: ProductionObjectType
  objectId: string
  relatedProductionOrderNo?: string | null
}): ProductionObjectRequestResult {
  const exactMatches = productionObjectSearchIndex.filter((item) =>
    item.objectType === objectType && (item.id === objectId || item.primaryNo === objectId),
  )
  const contextMatches = relatedProductionOrderNo
    ? exactMatches.filter((item) => item.relatedProductionOrderNo === relatedProductionOrderNo)
    : exactMatches
  const matches = contextMatches.length > 0 ? contextMatches : exactMatches

  if (matches.length > 1 && !relatedProductionOrderNo) {
    const productionOrders = Array.from(new Set(matches.map((item) => item.relatedProductionOrderNo).filter(Boolean)))
    if (productionOrders.length > 1) return { status: 'MULTIPLE_MATCHES', request: { objectType, objectId }, candidates: matches }
  }

  const indexItem = matches[0] || findIndexItem(objectId)
  if (!indexItem || !indexItem.relatedProductionOrderNo) {
    return {
      status: 'UNLINKED',
      request: { objectType, objectId },
      displayTitle: objectId,
      sourceDomain: indexItem?.sourceDomain || 'FCS',
      message: `未找到关联生产单：${objectId}`,
      routePath: indexItem?.routePath,
    }
  }

  return {
    status: 'READY',
    indexItem,
    clickedRef: {
      objectType: indexItem.objectType,
      objectId,
      objectNo: indexItem.primaryNo,
      displayTitle: indexItem.displayTitle,
      sourceDomain: indexItem.sourceDomain,
      statusText: indexItem.statusText || '待确认',
      routePath: indexItem.routePath,
      defaultTab: indexItem.defaultTab || getDefaultTabForObjectType(indexItem.objectType),
      highlightKey: indexItem.highlightKey || makeHighlightKey(indexItem.objectType, indexItem.primaryNo),
    },
  }
}
```

- [ ] **步骤 6：给现有索引构建函数补字段**

在 `buildOrderIndex()`、`buildDemandIndex()`、`buildMaterialIndexes()`、`buildWarehouseIndexes()`、`buildProcessIndexes()`、`buildMaterialPrepIndexes()`、`buildPrintWorkOrderIndexes()`、`buildDyeWorkOrderIndexes()`、`buildP1DocumentIndexes()` 里补：

```typescript
relatedDemandNo: order.demandId,
defaultTab: getDefaultTabForObjectType('<当前对象类型>'),
highlightKey: makeHighlightKey('<当前对象类型>', '<当前主编号>'),
```

示例，配料单对象：

```typescript
defaultTab: 'materials',
highlightKey: makeHighlightKey('MATERIAL_PREP_ORDER', projection.order.prepOrderNo),
```

- [ ] **步骤 7：补充质检对象索引**

在 `buildSearchIndex()` 中追加一个 `buildPostFinishingQcIndexes()`，从后道质检 mock 数据派生 `QC_MASTER_ORDER`、`QC_ORDER`、`RECHECK_ORDER`。如果当前文件已有后道质检 domain 导入，复用现有函数；没有则从 `post-finishing-domain.ts` 导入列表查询函数，不新建 mock 数据。

索引项必须包含：

```typescript
{
  id: `QC_ORDER-${qcOrder.qcOrderNo}`,
  objectType: 'QC_ORDER',
  primaryNo: qcOrder.qcOrderNo,
  secondaryNo: qcOrder.productionOrderNo,
  displayTitle: '后道质检单',
  keywords: unique([qcOrder.qcOrderNo, qcOrder.productionOrderNo, qcOrder.postTaskId, qcOrder.masterQcNo]),
  relatedProductionOrderNo: qcOrder.productionOrderNo,
  relatedDemandNo: order?.demandId,
  statusText: qcOrder.statusLabel,
  ownerRole: '工厂',
  sourceDomain: 'PFOS',
  docGroup: '仓库',
  routePath: `/fcs/craft/post-finishing/qc-orders?qcOrderNo=${encodeURIComponent(qcOrder.qcOrderNo)}`,
  quantityText: `${qcOrder.inspectionQty} 件`,
  defaultTab: 'quantity',
  highlightKey: makeHighlightKey('QC_ORDER', qcOrder.qcOrderNo),
  updatedAt: qcOrder.updatedAt,
}
```

- [ ] **步骤 8：运行检查验证数据层进展**

运行：

```bash
npm run check:production-object-overview
```

预期：仍可能 FAIL，但不再报 `必须导出统一编号解析函数`、`必须覆盖跨系统代表单据`、`必须带 defaultTab`。

- [ ] **步骤 9：Commit**

```bash
git add src/data/fcs/production-object-overview.ts
git commit -m "feat: extend production object index"
```

---

### 任务 3：统一编号按钮支持更多对象类型和上下文

**文件：**
- 修改：`src/data/fcs/production-order-identity.ts`

- [ ] **步骤 1：扩展按钮对象类型**

把 `ProductionObjectCodeType` 改成直接复用数据层类型：

```typescript
import type { ProductionObjectDefaultTab, ProductionObjectType } from './production-object-overview.ts'

export type ProductionObjectCodeType = ProductionObjectType
```

- [ ] **步骤 2：扩展按钮参数**

把 `renderProductionObjectCodeButton()` 参数改成：

```typescript
export function renderProductionObjectCodeButton({
  objectType,
  objectId,
  label,
  className = 'font-mono text-blue-600 hover:underline',
  relatedProductionOrderNo,
  defaultTab,
  highlightKey,
}: {
  objectType: ProductionObjectCodeType
  objectId?: string | null
  label?: string | null
  className?: string
  relatedProductionOrderNo?: string | null
  defaultTab?: ProductionObjectDefaultTab
  highlightKey?: string | null
}): string {
```

- [ ] **步骤 3：补充 data 属性**

在非物料按钮返回模板中加入：

```typescript
      ${relatedProductionOrderNo ? `data-related-production-order-no="${escapeHtml(relatedProductionOrderNo)}"` : ''}
      ${defaultTab ? `data-default-tab="${escapeHtml(defaultTab)}"` : ''}
      ${highlightKey ? `data-highlight-key="${escapeHtml(highlightKey)}"` : ''}
```

物料按钮也加同样属性，并保留：

```typescript
data-production-object-action="open-material-resource"
data-material-sku="..."
```

- [ ] **步骤 4：保证旧调用不坏**

保持 `renderProductionOrderIdentityCell()` 不改调用语义：

```typescript
function renderIdentityObjectButton(objectType: 'PRODUCTION_ORDER' | 'DEMAND', objectId: string, className: string): string {
  return renderProductionObjectCodeButton({ objectType, objectId, className })
}
```

- [ ] **步骤 5：运行检查**

运行：

```bash
npm run check:production-object-overview
npm run build
```

预期：TypeScript 构建通过；检查脚本仍可能因 UI 或页面接入缺失失败。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/production-order-identity.ts
git commit -m "feat: support universal production object codes"
```

---

### 任务 4：总览浮层支持默认 Tab、被点击对象、未关联和多匹配

**文件：**
- 修改：`src/components/production-object-overview.ts`
- 修改：`src/styles.css`

- [ ] **步骤 1：扩展 `OverviewTab`**

把 `OverviewTab` 增加 `quantity`：

```typescript
type OverviewTab =
  | 'overview'
  | 'materials'
  | 'progress'
  | 'quantity'
  | 'documents'
  | 'issues'
  | 'relationship'
  | 'timeline'
  | 'material-flow'
  | 'responsibility'
  | 'cross-query'
  | 'relationship-history'
```

在 `TAB_ITEMS` 中新增：

```typescript
{ key: 'quantity', label: '数量' },
```

- [ ] **步骤 2：放开生产相关系统入口**

把 `canShowProductionObjectEntry()` 改成：

```typescript
function canShowProductionObjectEntry(pathname: string): boolean {
  if (pathname.startsWith('/fcs/print/')) return false
  if (pathname.startsWith('/fcs/task-print/')) return false
  if (pathname.includes('confirmation-print')) return false
  return (
    pathname.startsWith('/fcs')
    || pathname.startsWith('/pcs')
    || pathname.startsWith('/pms')
    || pathname.startsWith('/wls')
  )
}
```

- [ ] **步骤 3：新增被点击对象摘要渲染**

在 `renderOverviewHeader()` 附近新增：

```typescript
function renderClickedObjectSummary(ref: ProductionObjectClickedRef | null): string {
  if (!ref) return ''
  return `
    <section class="border-b bg-blue-50/60 px-4 py-3 text-sm" data-production-object-clicked-ref="true">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium">当前查看</span>
        <span class="rounded border border-blue-200 bg-white px-2 py-0.5">${escapeHtml(OBJECT_TYPE_LABEL[ref.objectType] || ref.objectType)}</span>
        <span class="font-mono text-blue-700">${escapeHtml(ref.objectNo)}</span>
        <span class="text-muted-foreground">来源系统：${escapeHtml(ref.sourceDomain)}</span>
        <span class="text-muted-foreground">状态：${escapeHtml(ref.statusText)}</span>
      </div>
    </section>
  `
}
```

- [ ] **步骤 4：新增数量 Tab 渲染**

在 Tab body 渲染函数旁新增：

```typescript
function renderQuantityTab(overview: ProductionObjectOverview): string {
  const rows = overview.executionOverview.quantityQuality
  return `
    <div class="space-y-3">
      <h3 class="text-sm font-semibold">关键数量</h3>
      <div class="grid gap-2">
        ${rows.map((row) => `
          <article class="rounded-md border p-3 text-sm" data-production-object-highlight-key="${escapeHtml(makeHighlightKeyFromText(row.label))}">
            <div class="flex items-center justify-between gap-3">
              <span class="font-medium">${escapeHtml(row.label)}</span>
              <span class="font-mono">${escapeHtml(row.value)}</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.note)}</p>
          </article>
        `).join('')}
      </div>
    </div>
  `
}
```

如果 `QuantityQualityRow` 没有 `label/value/note` 字段，按现有字段名替换，但渲染必须展示“关键数量”和每行数量说明。

- [ ] **步骤 5：接入解析结果**

把 `renderProductionObjectOverviewSurface()` 开头改成使用 `resolveProductionObjectRequest()`：

```typescript
const resolved = resolveProductionObjectRequest({ objectType, objectId })
if (resolved.status === 'UNLINKED') return renderUnlinkedObjectSurface(resolved)
if (resolved.status === 'MULTIPLE_MATCHES') return renderMultipleMatchesSurface(resolved)

const overview = getProductionObjectOverview(resolved.indexItem.objectType, resolved.indexItem.id)
const activeBodyTab = tab === activeTab ? resolved.clickedRef.defaultTab : tab
```

并在返回模板中放入：

```typescript
${renderClickedObjectSummary(resolved.clickedRef)}
```

- [ ] **步骤 6：新增未关联 UI**

新增函数：

```typescript
function renderUnlinkedObjectSurface(result: ProductionObjectUnlinkedResult): string {
  return `
    <div class="production-object-overview" data-production-object-surface="overview">
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="text-base font-semibold">生产对象总览</h2>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </header>
        <div class="space-y-3 p-4 text-sm">
          <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">${escapeHtml(result.message)}</div>
          <div>当前编号：<span class="font-mono">${escapeHtml(result.request.objectId)}</span></div>
          <div>来源系统：${escapeHtml(result.sourceDomain)}</div>
          ${result.routePath ? `<button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="go-source" data-route-path="${escapeHtml(result.routePath)}" data-skip-page-rerender="true">查看来源</button>` : ''}
        </div>
      </section>
    </div>
  `
}
```

- [ ] **步骤 7：新增多匹配 UI**

新增函数：

```typescript
function renderMultipleMatchesSurface(result: ProductionObjectMultipleMatchesResult): string {
  return `
    <div class="production-object-overview" data-production-object-surface="overview">
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="text-base font-semibold">选择关联生产单</h2>
          <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
        </header>
        <div class="space-y-2 p-4">
          ${result.candidates.map((item) => `
            <button class="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
              data-production-object-action="open"
              data-object-type="${item.objectType}"
              data-object-id="${escapeHtml(item.id)}"
              data-related-production-order-no="${escapeHtml(item.relatedProductionOrderNo || '')}"
              data-skip-page-rerender="true">
              <div class="font-mono text-blue-700">${escapeHtml(item.primaryNo)}</div>
              <div class="text-xs text-muted-foreground">关联生产单：${escapeHtml(item.relatedProductionOrderNo || '未关联')}</div>
            </button>
          `).join('')}
        </div>
      </section>
    </div>
  `
}
```

- [ ] **步骤 8：事件处理读取默认 Tab 和高亮**

在 `handleProductionObjectAction()` 的 `open` 分支读取：

```typescript
const defaultTab = actionNode.dataset.defaultTab as OverviewTab | undefined
const highlightKey = actionNode.dataset.highlightKey
const relatedProductionOrderNo = actionNode.dataset.relatedProductionOrderNo
```

打开时把 `defaultTab` 传给 `renderProductionObjectOverviewSurface()`。`highlightKey` 用于滚动或加高亮 class；首期只需要在 DOM 中输出 `data-production-object-active-highlight="${highlightKey}"`，检查脚本可验证，不做复杂动画。

- [ ] **步骤 9：补充窄屏样式**

在 `src/styles.css` 的生产对象总览样式附近加入：

```css
@media (max-width: 640px) {
  .production-object-overview__panel {
    width: 100vw;
    max-width: 100vw;
    border-radius: 0;
  }

  .production-object-overview__body {
    padding: 12px;
  }
}
```

- [ ] **步骤 10：运行检查和构建**

运行：

```bash
npm run check:production-object-overview
npm run build
```

预期：检查脚本中 UI 相关断言通过；页面接入断言可能继续失败。

- [ ] **步骤 11：Commit**

```bash
git add src/components/production-object-overview.ts src/styles.css
git commit -m "feat: render universal production object drawer"
```

---

### 任务 5：接入 FCS 和 WMS 代表页面编号

**文件：**
- 修改：`src/pages/production/orders-domain.ts`
- 修改：`src/pages/production/demand-domain.ts`
- 修改：`src/pages/production-order-progress-tracking.ts`
- 修改：`src/pages/fcs/material-prep/shared.ts`

- [ ] **步骤 1：生产单管理补上下游编号按钮**

在 `src/pages/production/orders-domain.ts` 中，所有展示生产单号、需求单号、SPU、物料 SKU、采购/仓储来源单据的位置，使用：

```typescript
renderProductionObjectCodeButton({
  objectType: 'PRODUCTION_ORDER',
  objectId: order.productionOrderNo,
  relatedProductionOrderNo: order.productionOrderNo,
})
```

物料 SKU 使用已有物料资源入口：

```typescript
renderProductionObjectCodeButton({
  objectType: 'MATERIAL',
  objectId: line.materialSku,
  label: line.materialSku,
  relatedProductionOrderNo: order.productionOrderNo,
  defaultTab: 'materials',
})
```

- [ ] **步骤 2：生产需求页面保留需求和生产单入口**

在 `src/pages/production/demand-domain.ts` 中，需求单号使用：

```typescript
renderProductionObjectCodeButton({
  objectType: 'DEMAND',
  objectId: demand.demandId,
  relatedProductionOrderNo: demand.productionOrderId,
})
```

已生成生产单的位置继续用 `renderProductionOrderIdentityCell()`。

- [ ] **步骤 3：生产进度页面替换 plain 编号**

在 `src/pages/production-order-progress-tracking.ts` 中，对以下字段调用统一按钮：

```typescript
renderProductionObjectCodeButton({ objectType: 'PRODUCTION_ORDER', objectId: order.no })
renderProductionObjectCodeButton({ objectType: 'DEMAND', objectId: order.demandNo, relatedProductionOrderNo: order.no })
renderProductionObjectCodeButton({ objectType: 'CUT_ORDER', objectId: order.cutOrderNo, relatedProductionOrderNo: order.no, defaultTab: 'progress' })
renderProductionObjectCodeButton({ objectType: 'MATERIAL_PREP_ORDER', objectId: order.materialRequestNo, relatedProductionOrderNo: order.no, defaultTab: 'materials' })
```

- [ ] **步骤 4：FCS 配料共享页面替换配料/领料编号**

在 `src/pages/fcs/material-prep/shared.ts` 中导入统一按钮：

```typescript
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
```

配料单：

```typescript
renderProductionObjectCodeButton({
  objectType: 'MATERIAL_PREP_ORDER',
  objectId: projection.order.prepOrderNo,
  relatedProductionOrderNo: projection.order.productionOrderNo,
  defaultTab: 'materials',
  highlightKey: `MATERIAL_PREP_ORDER:${projection.order.prepOrderNo}`,
})
```

领料记录：

```typescript
renderProductionObjectCodeButton({
  objectType: 'MATERIAL_PICKUP_RECORD',
  objectId: pickup.pickupRecordId,
  relatedProductionOrderNo: projection.order.productionOrderNo,
  defaultTab: 'materials',
  highlightKey: `MATERIAL_PICKUP_RECORD:${pickup.pickupRecordId}`,
})
```

- [ ] **步骤 5：运行检查**

运行：

```bash
npm run check:production-object-overview
npm run build
```

预期：FCS 和 WMS 代表页面断言通过。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/production/orders-domain.ts src/pages/production/demand-domain.ts src/pages/production-order-progress-tracking.ts src/pages/fcs/material-prep/shared.ts
git commit -m "feat: link fcs production object codes"
```

---

### 任务 6：接入 PFOS 裁片、印花、染色、后道质检编号

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-orders.ts`
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
- 修改：`src/pages/process-factory/printing/work-orders.ts`
- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`src/pages/process-factory/post-finishing/qc-orders.ts`

- [ ] **步骤 1：裁片单页面接入**

在 `cut-orders.ts` 导入：

```typescript
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
```

裁片单号使用：

```typescript
renderProductionObjectCodeButton({
  objectType: 'CUT_ORDER',
  objectId: order.cutOrderNo,
  relatedProductionOrderNo: order.productionOrderNo,
  defaultTab: 'progress',
  highlightKey: `CUT_ORDER:${order.cutOrderNo}`,
})
```

- [ ] **步骤 2：裁片领料页面接入**

在 `pickup-management.ts` 中，领料记录、配料单、生产单和物料 SKU 使用统一按钮。领料记录示例：

```typescript
renderProductionObjectCodeButton({
  objectType: 'MATERIAL_PICKUP_RECORD',
  objectId: record.pickupRecordId,
  relatedProductionOrderNo: record.productionOrderNo,
  defaultTab: 'materials',
  highlightKey: `MATERIAL_PICKUP_RECORD:${record.pickupRecordId}`,
})
```

- [ ] **步骤 3：印花工单页面接入**

在 `printing/work-orders.ts` 导入统一按钮。印花工单号使用：

```typescript
renderProductionObjectCodeButton({
  objectType: 'PRINT_WORK_ORDER',
  objectId: order.printOrderNo,
  relatedProductionOrderNo: order.productionOrderNo,
  defaultTab: 'progress',
  highlightKey: `PRINT_WORK_ORDER:${order.printOrderNo}`,
})
```

- [ ] **步骤 4：染色工单页面接入**

在 `dyeing/work-orders.ts` 中染色工单号使用：

```typescript
renderProductionObjectCodeButton({
  objectType: 'DYE_WORK_ORDER',
  objectId: order.dyeOrderNo,
  relatedProductionOrderNo: order.productionOrderNo,
  defaultTab: 'progress',
  highlightKey: `DYE_WORK_ORDER:${order.dyeOrderNo}`,
})
```

- [ ] **步骤 5：后道质检页面接入**

在 `post-finishing/qc-orders.ts` 中，生产单质检总单、质检单、复检单、生产单号使用统一按钮。质检单示例：

```typescript
renderProductionObjectCodeButton({
  objectType: 'QC_ORDER',
  objectId: qcOrder.qcOrderNo,
  relatedProductionOrderNo: qcOrder.productionOrderNo,
  defaultTab: 'quantity',
  highlightKey: `QC_ORDER:${qcOrder.qcOrderNo}`,
})
```

生产单质检总单示例：

```typescript
renderProductionObjectCodeButton({
  objectType: 'QC_MASTER_ORDER',
  objectId: master.masterQcNo,
  relatedProductionOrderNo: master.productionOrderNo,
  defaultTab: 'quantity',
  highlightKey: `QC_MASTER_ORDER:${master.masterQcNo}`,
})
```

- [ ] **步骤 6：运行检查**

运行：

```bash
npm run check:production-object-overview
npm run build
```

预期：PFOS 代表页面断言通过。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/process-factory/cutting/cut-orders.ts src/pages/process-factory/cutting/pickup-management.ts src/pages/process-factory/printing/work-orders.ts src/pages/process-factory/dyeing/work-orders.ts src/pages/process-factory/post-finishing/qc-orders.ts
git commit -m "feat: link pfos production object codes"
```

---

### 任务 7：接入 PDA 代表页面并验证窄屏

**文件：**
- 修改：`src/pages/pda-exec-detail.ts`
- 修改：`src/pages/pda-handover-detail.ts`
- 修改：`src/components/production-object-overview.ts`
- 修改：`src/styles.css`

- [ ] **步骤 1：PDA 执行详情接入编号按钮**

在 `pda-exec-detail.ts` 导入统一按钮。生产单、任务单、质检单、交接单使用统一按钮，按钮 class 保持 PDA 紧凑：

```typescript
renderProductionObjectCodeButton({
  objectType: 'PRODUCTION_ORDER',
  objectId: task.productionOrderNo,
  className: 'font-mono text-blue-700 underline-offset-2 hover:underline',
})
```

任务单示例：

```typescript
renderProductionObjectCodeButton({
  objectType: 'PROCESS_DOC',
  objectId: task.taskNo,
  relatedProductionOrderNo: task.productionOrderNo,
  defaultTab: 'progress',
  className: 'font-mono text-blue-700 underline-offset-2 hover:underline',
})
```

- [ ] **步骤 2：PDA 交接详情接入编号按钮**

在 `pda-handover-detail.ts` 中，交接单号、回货单号、生产单号使用：

```typescript
renderProductionObjectCodeButton({
  objectType: 'HANDOVER_ORDER',
  objectId: handover.handoverNo,
  relatedProductionOrderNo: handover.productionOrderNo,
  defaultTab: 'quantity',
  highlightKey: `HANDOVER_ORDER:${handover.handoverNo}`,
  className: 'font-mono text-blue-700 underline-offset-2 hover:underline',
})
```

- [ ] **步骤 3：PDA 打开时使用移动布局标记**

在 `renderProductionObjectOverviewSurface()` 的根节点增加路径或 viewport 独立标记：

```typescript
data-production-object-mobile-ready="true"
```

PDA 不需要新业务逻辑，样式通过 CSS 在窄屏占满宽度。

- [ ] **步骤 4：运行检查**

运行：

```bash
npm run check:production-object-overview
npm run build
```

预期：PDA 代表页面断言通过，构建通过。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/pda-exec-detail.ts src/pages/pda-handover-detail.ts src/components/production-object-overview.ts src/styles.css
git commit -m "feat: link pda production object codes"
```

---

### 任务 8：浏览器验收和收口

**文件：**
- 修改：`scripts/check-production-object-overview.ts`
- 可选修改：前面任务中发现的页面或样式文件

- [ ] **步骤 1：运行静态检查**

运行：

```bash
npm run check:production-object-overview
npm run build
```

预期：

```text
check:production-object-overview 通过
vite build 成功
```

- [ ] **步骤 2：启动本地服务**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

预期：Vite 输出本地地址和局域网地址。

- [ ] **步骤 3：Playwright 验证桌面 FCS 页面**

打开：

```text
http://localhost:5173/fcs/production/orders
```

操作：

```typescript
await page.getByText('查生产').click()
await page.getByPlaceholder(/输入生产单/).fill('MPO-202603-0001')
await page.getByText('查看总览').first().click()
await expect(page.getByText('当前查看')).toBeVisible()
await expect(page.getByText('关联生产单')).toBeVisible()
await expect(page.getByText('物料')).toBeVisible()
```

- [ ] **步骤 4：Playwright 验证 PFOS 质检页面**

打开：

```text
http://localhost:5173/fcs/craft/post-finishing/qc-orders
```

操作：

```typescript
await page.getByText(/QC|质检单/).first().click()
await expect(page.getByText('当前查看')).toBeVisible()
await expect(page.getByText('数量')).toBeVisible()
await expect(page.getByText(/质检未闭环|关键数量|质检数量/)).toBeVisible()
```

- [ ] **步骤 5：Playwright 验证低分辨率**

设置：

```typescript
await page.setViewportSize({ width: 1366, height: 768 })
```

断言：

```typescript
const panel = page.locator('.production-object-overview__panel')
await expect(panel).toBeVisible()
const box = await panel.boundingBox()
expect(box?.width).toBeLessThanOrEqual(1366)
await expect(page.locator('.production-object-overview__body')).toBeVisible()
```

- [ ] **步骤 6：Playwright 验证 PDA 窄屏**

设置：

```typescript
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://localhost:5173/fcs/pda/exec')
await page.getByText('查生产').click()
await page.getByPlaceholder(/输入生产单/).fill('143852')
await page.getByText('查看总览').first().click()
await expect(page.locator('.production-object-overview__panel')).toBeVisible()
await expect(page.getByText('当前判断')).toBeVisible()
```

- [ ] **步骤 7：CodeGraph 同步**

运行：

```bash
codegraph sync
codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 8：最终状态检查**

运行：

```bash
git status --short
```

预期：没有未提交改动。

- [ ] **步骤 9：Commit 验收修正**

只有步骤 3-6 中发现并修复了问题时执行：

```bash
git add scripts/check-production-object-overview.ts src/components/production-object-overview.ts src/styles.css src/pages
git commit -m "fix: verify universal production object drawer"
```

如果没有修正，不创建空 commit。

---

## 自检结果

- 规格覆盖：已覆盖跨系统编号入口、默认 Tab、高亮、未关联、多匹配、数据冲突提示、质检数量闭环、PDA/低分辨率和代表页面接入。
- 范围控制：首期只覆盖当前原型仓库已有页面和 mock 数据，不接真实后端，不新增独立详情体系。
- 类型一致性：计划中对象类型、`defaultTab`、`highlightKey`、`sourceDomain` 均落在任务 2 定义的类型内。
- 验证闭环：每个实现任务都有 `npm run check:production-object-overview` 和 `npm run build`，最终加浏览器验收和 CodeGraph 同步。
