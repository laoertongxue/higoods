# 物料资源总览实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 `生产对象总览 / 生产全局搜索` 浮层中新增 `物料资源总览`，让点击物料编码进入物料全局资源视角，同时保留生产对象内的本单物料切片。

**架构：** 复用当前 `src/data/fcs/production-object-overview.ts` 和 `src/components/production-object-overview.ts`。数据层从现有 `ProductionMaterialLine`、生产单、配料/领料 mock 里派生物料资源视图；UI 层复用现有生产对象浮层，不新增路由、不新增后端、不引入依赖。

**技术栈：** Vite，TypeScript，Vanilla 字符串模板渲染，Tailwind CSS，本地 mock 数据。

---

## 文件结构

**修改：**
- `scripts/check-production-object-overview.ts` — 先补失败检查，覆盖物料资源数据、物料编码点击、搜索分组、中文文案和低分辨率结构。
- `src/data/fcs/production-object-overview.ts` — 新增 `MaterialResourceOverview` 数据结构、`getMaterialResourceOverview()`、`searchMaterialResources()`，从现有生产单物料行派生跨单占用。
- `src/data/fcs/production-order-identity.ts` — 让 `objectType: 'MATERIAL'` 的编码按钮打开物料资源总览，而不是生产对象总览。
- `src/components/production-object-overview.ts` — 新增物料资源总览渲染、物料资源 Tab、`open-material-resource` 事件、搜索结果中的 `物料资源` 分组。

**不修改：**
- 不新增路由文件；物料资源总览仍在现有浮层里打开。
- 不新增数据服务层；当前项目是原型，本地数据派生即可。
- 不提交 `.superpowers/` 视觉伴侣临时文件。

---

### 任务 1：检查脚本 — 先写失败验收

**文件：**
- 修改：`scripts/check-production-object-overview.ts`

- [ ] **步骤 1：扩展数据模块导出断言**

在现有解构处追加新导出：

```typescript
const {
  getMaterialResourceOverview,
  getProductionObjectOverview,
  queryProductionObjectIssues,
  searchMaterialResources,
  searchProductionObjects,
  productionObjectSearchIndex,
} = dataModule
```

- [ ] **步骤 2：增加物料资源数据断言**

放在现有 `const materialSearch = searchProductionObjects('FLSZ260617009')` 之后：

```typescript
assert.equal(typeof getMaterialResourceOverview, 'function', '必须导出物料资源总览查询函数')
assert.equal(typeof searchMaterialResources, 'function', '必须导出物料资源搜索函数')

const materialResource = getMaterialResourceOverview('FLSZ260617009', {
  sourceObjectType: 'PRODUCTION_ORDER',
  sourceObjectId: order.productionOrderNo,
  sourceLabel: '生产对象总览 / 面辅料与仓储',
})
assert.ok(materialResource, '物料编码必须能打开物料资源总览')
assert.equal(materialResource.materialSku, 'FLSZ260617009', '物料资源总览物料编码错误')
assert.equal(materialResource.sourceContext?.sourceObjectId, order.productionOrderNo, '来源生产单必须保留')
assert.ok(materialResource.businessAllocations.length >= 1, '物料资源总览必须展示业务占用')
assert.ok(materialResource.businessAllocations.some((item) => item.isSourceContext), '来源生产单占用必须置顶高亮')
assert.ok(materialResource.supplyDemandSummary.totalRequiredQty > 0, '物料资源总览必须展示总需求')
assert.ok(materialResource.materialExecutionLines.length > 0, '物料资源总览必须展示配料/领料/发料履约')
assert.ok(materialResource.masterData.materialSku === 'FLSZ260617009', '物料档案区必须保留静态主数据')

const materialResources = searchMaterialResources('FLSZ260617009')
assert.ok(materialResources.some((item) => item.materialSku === 'FLSZ260617009'), '搜索物料编码必须命中物料资源')
```

- [ ] **步骤 3：增加物料按钮断言**

放在 `renderProductionObjectCodeButton` 相关断言后：

```typescript
const materialCodeEntry = identityModule.renderProductionObjectCodeButton({
  objectType: 'MATERIAL',
  objectId: 'FLSZ260617009',
  label: 'FLSZ260617009',
})
assert.ok(materialCodeEntry.includes('data-production-object-action="open-material-resource"'), '物料编码必须打开物料资源总览')
assert.ok(materialCodeEntry.includes('data-material-sku="FLSZ260617009"'), '物料编码按钮必须带物料 SKU')
```

- [ ] **步骤 4：增加物料资源 UI 断言**

放在 `const surface = uiModule.renderProductionObjectOverviewSurface(...)` 之后：

```typescript
assert.equal(typeof uiModule.renderMaterialResourceOverviewSurface, 'function', '必须导出物料资源总览渲染函数')
const materialSurface = uiModule.renderMaterialResourceOverviewSurface('FLSZ260617009', {
  sourceObjectType: 'PRODUCTION_ORDER',
  sourceObjectId: order.productionOrderNo,
  sourceLabel: '生产对象总览 / 面辅料与仓储',
})
for (const text of [
  '物料资源总览',
  '供需总览',
  '业务占用',
  '库存与在途',
  '配料 / 领料 / 发料',
  '异常与档案',
  '当前判断',
  '来源',
  '总需求',
  '可用库存',
  '缺口',
  '影响范围',
  '当前来源',
]) {
  assert.ok(materialSurface.includes(text), `物料资源总览缺少 ${text}`)
}
assert.equal(countMatches(materialSurface, 'data-production-object-action="switch-material-tab"'), 5, '物料资源总览必须有 5 个一级 Tab')
assert.ok(materialSurface.includes('data-source-object-id'), '物料资源总览必须保留来源对象')
```

- [ ] **步骤 5：增加搜索分组断言**

扩展现有 `const searchPanel = uiModule.renderProductionObjectSearchPanel('FLSZ260617009')` 断言：

```typescript
for (const group of ['物料资源', '相关生产对象', '相关采购与仓储', '异常线索']) {
  assert.ok(searchPanel.includes(group), `搜索物料编码时必须展示 ${group} 分组`)
}
assert.ok(searchPanel.includes('查看物料资源'), '物料搜索结果必须能打开物料资源总览')
assert.ok(uiModule.renderProductionObjectSearchPanel('缺料').includes('物料资源'), '缺料搜索必须命中物料资源')
```

- [ ] **步骤 6：运行检查并确认失败**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-object-overview.ts
```

预期：FAIL，错误包含 `必须导出物料资源总览查询函数` 或 `必须导出物料资源搜索函数`。

- [ ] **步骤 7：Commit**

```bash
git add scripts/check-production-object-overview.ts
git commit -m "test: add material resource overview checks"
```

---

### 任务 2：数据层 — 派生物料资源总览

**文件：**
- 修改：`src/data/fcs/production-object-overview.ts`

- [ ] **步骤 1：新增物料资源类型**

在 `ProductionMaterialLine` 后面新增：

```typescript
export interface MaterialResourceContext {
  sourceObjectType?: ProductionObjectType
  sourceObjectId?: string
  sourceLabel?: string
}

export interface MaterialSupplyDemandSummary {
  totalRequiredQty: number
  availableQty: number
  lockedQty: number
  inTransitQty: number
  pendingInspectionQty: number
  shortageQty: number
  unit: string
  earliestImpactDate: string
}

export interface MaterialBusinessAllocation {
  allocationId: string
  businessType: string
  businessNo: string
  spu: string
  colorSize: string
  requiredQty: number
  preparedQty: number
  pickedQty: number
  shortageQty: number
  deliveryDate: string
  priority: string
  status: string
  isSourceContext: boolean
}

export interface MaterialInventoryBatch {
  warehouseName: string
  batchNo: string
  totalQty: number
  availableQty: number
  lockedQty: number
  pendingInspectionQty: number
  frozenQty: number
  unit: string
}

export interface MaterialPurchaseTransit {
  purchaseOrderNo: string
  supplierName: string
  purchaseQty: number
  arrivedQty: number
  pendingArrivalQty: number
  estimatedArrivalAt: string
  statusText: string
}

export interface MaterialWarehouseReceipt {
  inboundNo: string
  sourceNo: string
  arrivedQty: number
  warehouseName: string
  arrivedAt: string
  qcStatusText: string
}

export interface MaterialExecutionLine {
  businessNo: string
  processName: string
  factoryName: string
  requiredQty: number
  preparedQty: number
  pendingPrepareQty: number
  pickedQty: number
  pendingPickQty: number
  issuedQty: number
  pendingIssueQty: number
  shortageQty: number
  unit: string
  nextActionText: string
  isSourceContext: boolean
}

export interface MaterialResourceIssue {
  issueType: string
  affectedBusinessNo: string
  affectedQty: number
  unit: string
  ownerRole: ProductionObjectOwnerRole
  occurredAt: string
  requiredDoneAt: string
  statusText: string
  suggestionText: string
}

export interface MaterialMasterData {
  materialSku: string
  materialName: string
  materialType: MaterialType
  spec: string
  color: string
  unit: string
  supplierName: string
  purchaseCycleText: string
  minPurchaseQtyText: string
  lossRateText: string
  substituteText: string
  applicableText: string
  statusText: string
}

export interface MaterialResourceOverview {
  materialSku: string
  materialName: string
  materialType: MaterialType
  spec: string
  color: string
  unit: string
  supplierName: string
  currentJudgement: string
  sourceContext?: MaterialResourceContext
  supplyDemandSummary: MaterialSupplyDemandSummary
  businessAllocations: MaterialBusinessAllocation[]
  inventoryBatches: MaterialInventoryBatch[]
  purchaseInTransit: MaterialPurchaseTransit[]
  warehouseReceipts: MaterialWarehouseReceipt[]
  materialExecutionLines: MaterialExecutionLine[]
  issues: MaterialResourceIssue[]
  masterData: MaterialMasterData
}
```

- [ ] **步骤 2：新增数量辅助函数**

放在 `formatQuantity` 附近：

```typescript
function normalizeMaterialSku(value: string | undefined | null): string {
  return (value || '').trim().toUpperCase()
}

function getPickedQty(line: ProductionMaterialLine): number {
  return Math.max(Number(line.issuedQty || 0), Number(line.factoryReceivedQty || 0))
}

function sumNumbers(values: number[]): number {
  return values.reduce((sum, value) => sum + Number(value || 0), 0)
}

function formatDateOrDash(value: string | null | undefined): string {
  return value || '-'
}
```

- [ ] **步骤 3：新增跨单物料行派生函数**

放在 `buildMaterialLines` 后面：

```typescript
function listMaterialResourceRows(materialSku: string, context: MaterialResourceContext = {}): Array<{
  order: ProductionOrder
  line: ProductionMaterialLine
  isSourceContext: boolean
}> {
  const targetSku = normalizeMaterialSku(materialSku)
  return productionOrders.flatMap((order) => {
    const isSourceContext = context.sourceObjectId
      ? matchesProductionOrder(order, [context.sourceObjectId])
      : false
    return buildMaterialLines(order)
      .filter((line) => normalizeMaterialSku(line.materialSku) === targetSku)
      .map((line) => ({ order, line, isSourceContext }))
  }).sort((a, b) => Number(b.isSourceContext) - Number(a.isSourceContext))
}
```

- [ ] **步骤 4：新增占用、履约、异常构造函数**

继续插入：

```typescript
function buildMaterialBusinessAllocations(rows: ReturnType<typeof listMaterialResourceRows>): MaterialBusinessAllocation[] {
  return rows.map(({ order, line, isSourceContext }) => ({
    allocationId: `${order.productionOrderNo}-${line.lineId}`,
    businessType: '生产单',
    businessNo: order.productionOrderNo,
    spu: order.demandSnapshot.spuCode,
    colorSize: getSkuSummary(order),
    requiredQty: line.requiredQty,
    preparedQty: Number(line.preparedQty || 0),
    pickedQty: getPickedQty(line),
    shortageQty: line.shortageQty,
    deliveryDate: formatDateOrDash(order.demandSnapshot.requiredDeliveryDate || order.planEndDate),
    priority: order.demandSnapshot.priority || '普通',
    status: getMaterialSearchStatus(line),
    isSourceContext,
  }))
}

function buildMaterialExecutionLines(rows: ReturnType<typeof listMaterialResourceRows>): MaterialExecutionLine[] {
  return rows.map(({ order, line, isSourceContext }) => {
    const preparedQty = Number(line.preparedQty || 0)
    const pickedQty = getPickedQty(line)
    const issuedQty = Number(line.issuedQty || 0)
    return {
      businessNo: order.productionOrderNo,
      processName: line.materialType === 'FABRIC' ? '裁片' : '生产用料',
      factoryName: order.mainFactorySnapshot.name || order.planFactoryName || '待确认',
      requiredQty: line.requiredQty,
      preparedQty,
      pendingPrepareQty: Math.max(0, line.requiredQty - preparedQty),
      pickedQty,
      pendingPickQty: Math.max(0, line.requiredQty - pickedQty),
      issuedQty,
      pendingIssueQty: Math.max(0, line.requiredQty - issuedQty),
      shortageQty: line.shortageQty,
      unit: line.unit,
      nextActionText: line.nextActionText,
      isSourceContext,
    }
  })
}

function buildMaterialResourceIssues(rows: ReturnType<typeof listMaterialResourceRows>): MaterialResourceIssue[] {
  return rows
    .filter(({ line }) => line.shortageQty > 0 || getMaterialSearchStatus(line).includes('待'))
    .map(({ order, line }) => ({
      issueType: line.shortageQty > 0 ? '缺料' : getMaterialSearchStatus(line),
      affectedBusinessNo: order.productionOrderNo,
      affectedQty: line.shortageQty || Math.max(0, line.requiredQty - getPickedQty(line)),
      unit: line.unit,
      ownerRole: line.ownerRole,
      occurredAt: order.updatedAt,
      requiredDoneAt: formatDateOrDash(order.demandSnapshot.requiredDeliveryDate || order.planEndDate),
      statusText: getMaterialSearchStatus(line),
      suggestionText: line.nextActionText,
    }))
}
```

- [ ] **步骤 5：新增供需和库存 mock 构造**

继续插入：

```typescript
function buildMaterialSupplyDemandSummary(rows: ReturnType<typeof listMaterialResourceRows>): MaterialSupplyDemandSummary {
  const unit = rows[0]?.line.unit || ''
  const totalRequiredQty = sumNumbers(rows.map(({ line }) => line.requiredQty))
  const totalPreparedQty = sumNumbers(rows.map(({ line }) => Number(line.preparedQty || 0)))
  const totalPickedQty = sumNumbers(rows.map(({ line }) => getPickedQty(line)))
  const shortageQty = sumNumbers(rows.map(({ line }) => line.shortageQty))
  const dates = rows
    .map(({ order }) => order.demandSnapshot.requiredDeliveryDate || order.planEndDate || '')
    .filter(Boolean)
    .sort()
  return {
    totalRequiredQty,
    availableQty: Math.max(0, totalPreparedQty - totalPickedQty),
    lockedQty: totalPreparedQty,
    inTransitQty: Math.max(0, sumNumbers(rows.map(({ line }) => Number(line.purchasedQty || 0))) - sumNumbers(rows.map(({ line }) => Number(line.arrivedWarehouseQty || 0)))),
    pendingInspectionQty: Math.max(0, shortageQty > 0 ? Math.round(shortageQty * 0.5) : 0),
    shortageQty,
    unit,
    earliestImpactDate: dates[0] || '-',
  }
}

function buildMaterialInventoryBatches(summary: MaterialSupplyDemandSummary): MaterialInventoryBatch[] {
  return [
    {
      warehouseName: '原料仓',
      batchNo: 'BATCH-CURRENT',
      totalQty: summary.availableQty + summary.lockedQty + summary.pendingInspectionQty,
      availableQty: summary.availableQty,
      lockedQty: summary.lockedQty,
      pendingInspectionQty: summary.pendingInspectionQty,
      frozenQty: 0,
      unit: summary.unit,
    },
  ]
}
```

- [ ] **步骤 6：新增主查询和搜索函数**

继续插入并导出：

```typescript
export function getMaterialResourceOverview(
  materialSku: string,
  context: MaterialResourceContext = {},
): MaterialResourceOverview | null {
  const rows = listMaterialResourceRows(materialSku, context)
  if (rows.length === 0) return null
  const firstLine = rows[0].line
  const summary = buildMaterialSupplyDemandSummary(rows)
  const allocations = buildMaterialBusinessAllocations(rows)
  const executionLines = buildMaterialExecutionLines(rows)
  const issues = buildMaterialResourceIssues(rows)
  const supplierName = firstLine.sourcePoNo ? '采购供应商' : '默认供应商'
  return {
    materialSku: firstLine.materialSku,
    materialName: firstLine.materialName,
    materialType: firstLine.materialType,
    spec: firstLine.spec || '-',
    color: firstLine.spec || '-',
    unit: firstLine.unit,
    supplierName,
    currentJudgement: summary.shortageQty > 0
      ? `缺口 ${formatQuantity(summary.shortageQty, summary.unit)}，影响 ${allocations.length} 张生产单`
      : `可用库存覆盖 ${allocations.length} 张生产单需求`,
    sourceContext: context.sourceObjectId ? context : undefined,
    supplyDemandSummary: summary,
    businessAllocations: allocations,
    inventoryBatches: buildMaterialInventoryBatches(summary),
    purchaseInTransit: rows
      .filter(({ line }) => Number(line.purchasedQty || 0) > Number(line.arrivedWarehouseQty || 0))
      .map(({ line }) => ({
        purchaseOrderNo: line.sourcePoNo || `${line.materialSku}-PUR`,
        supplierName,
        purchaseQty: Number(line.purchasedQty || 0),
        arrivedQty: Number(line.arrivedWarehouseQty || 0),
        pendingArrivalQty: Math.max(0, Number(line.purchasedQty || 0) - Number(line.arrivedWarehouseQty || 0)),
        estimatedArrivalAt: line.estimatedWarehouseArrivalAt || '-',
        statusText: purchaseArrivalStatusLabel[line.purchaseArrivalStatus],
      })),
    warehouseReceipts: rows
      .filter(({ line }) => line.sourceInboundNo)
      .map(({ line }) => ({
        inboundNo: line.sourceInboundNo || '-',
        sourceNo: line.sourcePoNo || line.sourceMaterialRequestNo || '-',
        arrivedQty: Number(line.arrivedWarehouseQty || 0),
        warehouseName: '原料仓',
        arrivedAt: line.estimatedWarehouseArrivalAt || '-',
        qcStatusText: '已释放',
      })),
    materialExecutionLines: executionLines,
    issues,
    masterData: {
      materialSku: firstLine.materialSku,
      materialName: firstLine.materialName,
      materialType: firstLine.materialType,
      spec: firstLine.spec || '-',
      color: firstLine.spec || '-',
      unit: firstLine.unit,
      supplierName,
      purchaseCycleText: '7 天',
      minPurchaseQtyText: `按 ${firstLine.unit} 起订`,
      lossRateText: '按工艺默认损耗',
      substituteText: '暂无替代料',
      applicableText: rows.map(({ order }) => order.demandSnapshot.spuCode).filter(Boolean).slice(0, 3).join('、') || '-',
      statusText: '启用',
    },
  }
}

export function searchMaterialResources(keyword: string): MaterialResourceOverview[] {
  const query = keyword.trim().toUpperCase()
  if (query.length < 2) return []
  const materialSkus = Array.from(new Set(
    productionObjectSearchIndex
      .filter((item) => item.objectType === 'MATERIAL')
      .filter((item) => `${item.primaryNo} ${item.displayTitle} ${item.keywords.join(' ')}`.toUpperCase().includes(query))
      .map((item) => item.primaryNo),
  ))
  return materialSkus
    .map((sku) => getMaterialResourceOverview(sku))
    .filter((item): item is MaterialResourceOverview => Boolean(item))
}
```

- [ ] **步骤 7：运行检查验证数据层**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-object-overview.ts
```

预期：FAIL，数据相关断言通过，失败点转移到 `必须导出物料资源总览渲染函数` 或 UI 文案缺失。

- [ ] **步骤 8：Commit**

```bash
git add src/data/fcs/production-object-overview.ts
git commit -m "feat: add material resource overview data"
```

---

### 任务 3：点击入口 — 物料编码打开物料资源总览

**文件：**
- 修改：`src/data/fcs/production-order-identity.ts`
- 修改：`src/components/production-object-overview.ts`

- [ ] **步骤 1：修改 `renderProductionObjectCodeButton` 的 MATERIAL 分支**

在 `renderProductionObjectCodeButton()` 内、`return` 之前加入：

```typescript
  if (objectType === 'MATERIAL') {
    return `
      <button
        type="button"
        class="${className}"
        data-production-object-action="open-material-resource"
        data-object-type="MATERIAL"
        data-object-id="${escapeHtml(targetId)}"
        data-material-sku="${escapeHtml(targetId)}"
        data-skip-page-rerender="true"
      >${escapeHtml(displayText)}</button>
    `
  }
```

保持非物料对象仍使用 `data-production-object-action="open"`。

- [ ] **步骤 2：在组件导入物料资源数据**

修改 `src/components/production-object-overview.ts` 顶部 import：

```typescript
import {
  getMaterialResourceOverview,
  getProductionObjectOverview,
  materialTypeLabel,
  productionObjectSearchIndex,
  purchaseArrivalStatusLabel,
  queryProductionObjectIssues,
  searchMaterialResources,
  searchProductionObjects,
  warehouseExecutionStatusLabel,
  type MaterialResourceContext,
  type MaterialResourceOverview,
  type ProductionMaterialLine,
  type ProductionObjectOverview,
  type ProductionObjectSearchIndex,
  type ProductionObjectType,
} from '../data/fcs/production-object-overview.ts'
```

- [ ] **步骤 3：扩展浮层模式和物料 Tab 状态**

在 `let activeTab` 附近新增：

```typescript
type MaterialResourceTab = 'supply-demand' | 'allocations' | 'inventory' | 'execution' | 'issues-master'

const MATERIAL_RESOURCE_TAB_ITEMS: Array<{ key: MaterialResourceTab; label: string }> = [
  { key: 'supply-demand', label: '供需总览' },
  { key: 'allocations', label: '业务占用' },
  { key: 'inventory', label: '库存与在途' },
  { key: 'execution', label: '配料 / 领料 / 发料' },
  { key: 'issues-master', label: '异常与档案' },
]

let activeMaterialResourceTab: MaterialResourceTab = 'supply-demand'
```

把 `setOverlay` 签名改为：

```typescript
function setOverlay(html: string, mode: 'search' | 'overview' | 'material-resource'): void {
```

- [ ] **步骤 4：增加打开物料资源的事件分支**

在 `handleProductionObjectOverviewEvent()` 的 `open` 分支之前加入：

```typescript
  if (action === 'open-material-resource') {
    activeMaterialResourceTab = 'supply-demand'
    const materialSku = actionNode.dataset.materialSku || actionNode.dataset.objectId
    const surface = actionNode.closest<HTMLElement>('[data-production-object-surface="overview"]')
    const sourceObjectType = (actionNode.dataset.sourceObjectType || surface?.dataset.objectType) as ProductionObjectType | undefined
    const sourceObjectId = actionNode.dataset.sourceObjectId || surface?.dataset.objectId
    if (!materialSku) return true
    setOverlay(renderMaterialResourceOverviewSurface(materialSku, {
      sourceObjectType,
      sourceObjectId,
      sourceLabel: sourceObjectId ? '生产对象总览 / 面辅料与仓储' : undefined,
    }, activeMaterialResourceTab), 'material-resource')
    return true
  }
```

- [ ] **步骤 5：增加物料 Tab 切换事件**

放在 `switch-tab` 分支后：

```typescript
  if (action === 'switch-material-tab') {
    activeMaterialResourceTab = (actionNode.dataset.tab as MaterialResourceTab | undefined) || 'supply-demand'
    const surface = actionNode.closest<HTMLElement>('[data-production-object-surface="material-resource"]')
    const materialSku = surface?.dataset.materialSku
    const sourceObjectType = surface?.dataset.sourceObjectType as ProductionObjectType | undefined
    const sourceObjectId = surface?.dataset.sourceObjectId
    if (!materialSku) return true
    setOverlay(renderMaterialResourceOverviewSurface(materialSku, {
      sourceObjectType,
      sourceObjectId,
      sourceLabel: sourceObjectId ? '生产对象总览 / 面辅料与仓储' : undefined,
    }, activeMaterialResourceTab), 'material-resource')
    return true
  }
```

- [ ] **步骤 6：运行检查验证入口**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-object-overview.ts
```

预期：FAIL，物料按钮断言通过，失败点仍在物料资源 UI 内容。

- [ ] **步骤 7：Commit**

```bash
git add src/data/fcs/production-order-identity.ts src/components/production-object-overview.ts
git commit -m "feat: route material codes to resource overview"
```

---

### 任务 4：UI — 渲染物料资源总览

**文件：**
- 修改：`src/components/production-object-overview.ts`

- [ ] **步骤 1：增加物料资源卡片辅助函数**

放在 `renderMiniQty()` 后：

```typescript
function renderMaterialResourceMetric(label: string, value: string): string {
  return `
    <div class="rounded-lg border bg-card p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 break-words text-sm font-semibold text-foreground">${escapeHtml(value)}</div>
    </div>
  `
}

function formatMaterialResourceQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN')}${unit}`
}
```

- [ ] **步骤 2：渲染物料资源头部和 Tab**

在 `renderProductionObjectOverviewSurface()` 前新增：

```typescript
function renderMaterialResourceHeader(resource: MaterialResourceOverview): string {
  return `
    <header class="border-b bg-card px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            ${badge(materialTypeLabel[resource.materialType], 'border-blue-200 bg-blue-50 text-blue-700')}
            <span class="font-mono text-sm font-semibold">${escapeHtml(resource.materialSku)}</span>
          </div>
          <h2 class="mt-1 text-base font-semibold">物料资源总览｜${escapeHtml(resource.materialName)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(resource.spec)}｜${escapeHtml(resource.unit)}｜${escapeHtml(resource.supplierName)}</p>
        </div>
        <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
      </div>
    </header>
  `
}

function renderMaterialResourceTabs(resource: MaterialResourceOverview, tab: MaterialResourceTab): string {
  return `
    <div class="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-4" role="tablist">
      ${MATERIAL_RESOURCE_TAB_ITEMS.map((item) => `
        <button
          type="button"
          class="whitespace-nowrap border-b-2 px-3 py-2 text-sm ${item.key === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-muted-foreground hover:text-foreground'}"
          data-production-object-action="switch-material-tab"
          data-tab="${item.key}"
          data-material-sku="${escapeHtml(resource.materialSku)}"
          data-skip-page-rerender="true"
        >${escapeHtml(item.label)}</button>
      `).join('')}
    </div>
  `
}
```

- [ ] **步骤 3：渲染首屏供需总览**

继续新增：

```typescript
function renderMaterialSupplyDemandTab(resource: MaterialResourceOverview): string {
  const summary = resource.supplyDemandSummary
  const source = resource.sourceContext
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">当前判断</h3>
        <p class="mt-2 text-sm text-foreground">${escapeHtml(resource.currentJudgement)}</p>
        ${source?.sourceObjectId ? `<p class="mt-2 text-xs text-muted-foreground">来源：${escapeHtml(source.sourceLabel || '生产对象总览')}｜${renderOverviewCode(source.sourceObjectType || 'PRODUCTION_ORDER', source.sourceObjectId, source.sourceObjectId)}</p>` : ''}
      </section>
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        ${renderMaterialResourceMetric('总需求', formatMaterialResourceQty(summary.totalRequiredQty, summary.unit))}
        ${renderMaterialResourceMetric('可用库存', formatMaterialResourceQty(summary.availableQty, summary.unit))}
        ${renderMaterialResourceMetric('已锁定', formatMaterialResourceQty(summary.lockedQty, summary.unit))}
        ${renderMaterialResourceMetric('缺口', formatMaterialResourceQty(summary.shortageQty, summary.unit))}
        ${renderMaterialResourceMetric('在途采购', formatMaterialResourceQty(summary.inTransitQty, summary.unit))}
        ${renderMaterialResourceMetric('待检', formatMaterialResourceQty(summary.pendingInspectionQty, summary.unit))}
        ${renderMaterialResourceMetric('影响范围', `${resource.businessAllocations.length} 张生产单`)}
        ${renderMaterialResourceMetric('最早影响交期', summary.earliestImpactDate)}
      </section>
    </div>
  `
}
```

- [ ] **步骤 4：渲染业务占用和库存 Tab**

继续新增：

```typescript
function renderMaterialAllocationsTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-3">
      ${resource.businessAllocations.map((item) => `
        <article class="rounded-lg border ${item.isSourceContext ? 'border-blue-300 bg-blue-50/60' : 'bg-card'} p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="font-mono text-sm font-semibold">${renderOverviewCode('PRODUCTION_ORDER', item.businessNo, item.businessNo)}</div>
            <div class="flex flex-wrap items-center gap-2">
              ${item.isSourceContext ? badge('当前来源', 'border-blue-200 bg-blue-100 text-blue-700') : ''}
              ${badge(item.status)}
            </div>
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div><span class="text-foreground">SPU：</span>${escapeHtml(item.spu)}</div>
            <div><span class="text-foreground">颜色尺码：</span>${escapeHtml(item.colorSize)}</div>
            <div><span class="text-foreground">交期：</span>${escapeHtml(item.deliveryDate)}</div>
            <div><span class="text-foreground">优先级：</span>${escapeHtml(item.priority)}</div>
            <div><span class="text-foreground">需求：</span>${formatMaterialResourceQty(item.requiredQty, resource.unit)}</div>
            <div><span class="text-foreground">已配料：</span>${formatMaterialResourceQty(item.preparedQty, resource.unit)}</div>
            <div><span class="text-foreground">已领料：</span>${formatMaterialResourceQty(item.pickedQty, resource.unit)}</div>
            <div><span class="text-foreground">缺口：</span>${formatMaterialResourceQty(item.shortageQty, resource.unit)}</div>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderMaterialInventoryTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-4">
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">库存批次</h3>
        ${resource.inventoryBatches.map((item) => `
          <div class="rounded-lg border bg-card p-3 text-xs">
            <div class="font-medium">${escapeHtml(item.warehouseName)}｜${escapeHtml(item.batchNo)}</div>
            <div class="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-5">
              <div>总库存：${formatMaterialResourceQty(item.totalQty, item.unit)}</div>
              <div>可用：${formatMaterialResourceQty(item.availableQty, item.unit)}</div>
              <div>锁定：${formatMaterialResourceQty(item.lockedQty, item.unit)}</div>
              <div>待检：${formatMaterialResourceQty(item.pendingInspectionQty, item.unit)}</div>
              <div>冻结：${formatMaterialResourceQty(item.frozenQty, item.unit)}</div>
            </div>
          </div>
        `).join('')}
      </section>
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">采购在途</h3>
        ${resource.purchaseInTransit.map((item) => `
          <div class="rounded-lg border bg-card p-3 text-xs">
            <div class="font-mono font-medium">${escapeHtml(item.purchaseOrderNo)}</div>
            <div class="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-4">
              <div>供应商：${escapeHtml(item.supplierName)}</div>
              <div>采购：${formatMaterialResourceQty(item.purchaseQty, resource.unit)}</div>
              <div>未到仓：${formatMaterialResourceQty(item.pendingArrivalQty, resource.unit)}</div>
              <div>预计到仓：${escapeHtml(item.estimatedArrivalAt)}</div>
            </div>
          </div>
        `).join('') || '<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">暂无采购在途</div>'}
      </section>
    </div>
  `
}
```

- [ ] **步骤 5：渲染配领发和异常档案 Tab**

继续新增：

```typescript
function renderMaterialExecutionTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-3">
      ${resource.materialExecutionLines.map((item) => `
        <article class="rounded-lg border ${item.isSourceContext ? 'border-blue-300 bg-blue-50/60' : 'bg-card'} p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold">${renderOverviewCode('PRODUCTION_ORDER', item.businessNo, item.businessNo)}｜${escapeHtml(item.processName)} / ${escapeHtml(item.factoryName)}</div>
            ${item.isSourceContext ? badge('当前来源', 'border-blue-200 bg-blue-100 text-blue-700') : ''}
          </div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
            <div>需求：${formatMaterialResourceQty(item.requiredQty, item.unit)}</div>
            <div>已配料：${formatMaterialResourceQty(item.preparedQty, item.unit)}</div>
            <div>待配料：${formatMaterialResourceQty(item.pendingPrepareQty, item.unit)}</div>
            <div>已领料：${formatMaterialResourceQty(item.pickedQty, item.unit)}</div>
            <div>待领料：${formatMaterialResourceQty(item.pendingPickQty, item.unit)}</div>
            <div>已发料：${formatMaterialResourceQty(item.issuedQty, item.unit)}</div>
            <div>待发料：${formatMaterialResourceQty(item.pendingIssueQty, item.unit)}</div>
            <div>缺口：${formatMaterialResourceQty(item.shortageQty, item.unit)}</div>
            <div class="sm:col-span-2">下一动作：${escapeHtml(item.nextActionText)}</div>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderMaterialIssuesMasterTab(resource: MaterialResourceOverview): string {
  return `
    <div class="space-y-4">
      <section class="space-y-2">
        <h3 class="text-sm font-semibold">异常与风险</h3>
        ${resource.issues.map((item) => `
          <article class="rounded-lg border bg-card p-3 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium">${escapeHtml(item.issueType)}｜${renderOverviewCode('PRODUCTION_ORDER', item.affectedBusinessNo, item.affectedBusinessNo)}</div>
              ${badge(item.statusText)}
            </div>
            <div class="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-4">
              <div>影响数量：${formatMaterialResourceQty(item.affectedQty, item.unit)}</div>
              <div>责任方：${escapeHtml(item.ownerRole)}</div>
              <div>发生时间：${escapeHtml(item.occurredAt)}</div>
              <div>要求完成：${escapeHtml(item.requiredDoneAt)}</div>
              <div class="sm:col-span-4">建议处理：${escapeHtml(item.suggestionText)}</div>
            </div>
          </article>
        `).join('') || '<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">暂无异常</div>'}
      </section>
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">物料档案</h3>
        <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div>物料编码：${escapeHtml(resource.masterData.materialSku)}</div>
          <div>名称：${escapeHtml(resource.masterData.materialName)}</div>
          <div>类型：${escapeHtml(materialTypeLabel[resource.masterData.materialType])}</div>
          <div>规格：${escapeHtml(resource.masterData.spec)}</div>
          <div>单位：${escapeHtml(resource.masterData.unit)}</div>
          <div>默认供应商：${escapeHtml(resource.masterData.supplierName)}</div>
          <div>采购周期：${escapeHtml(resource.masterData.purchaseCycleText)}</div>
          <div>最小采购量：${escapeHtml(resource.masterData.minPurchaseQtyText)}</div>
          <div>默认损耗率：${escapeHtml(resource.masterData.lossRateText)}</div>
          <div>替代料：${escapeHtml(resource.masterData.substituteText)}</div>
          <div>适用品类 / SPU：${escapeHtml(resource.masterData.applicableText)}</div>
          <div>主数据状态：${escapeHtml(resource.masterData.statusText)}</div>
        </div>
      </section>
    </div>
  `
}
```

- [ ] **步骤 6：新增物料资源 Surface**

继续新增：

```typescript
function renderMaterialResourceTabBody(resource: MaterialResourceOverview, tab: MaterialResourceTab): string {
  if (tab === 'allocations') return renderMaterialAllocationsTab(resource)
  if (tab === 'inventory') return renderMaterialInventoryTab(resource)
  if (tab === 'execution') return renderMaterialExecutionTab(resource)
  if (tab === 'issues-master') return renderMaterialIssuesMasterTab(resource)
  return renderMaterialSupplyDemandTab(resource)
}

export function renderMaterialResourceOverviewSurface(
  materialSku: string,
  context: MaterialResourceContext = {},
  tab: MaterialResourceTab = activeMaterialResourceTab,
): string {
  const resource = getMaterialResourceOverview(materialSku, context)
  if (!resource) {
    return `
      <div class="production-object-overview" data-production-object-surface="material-resource">
        <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
        <section class="production-object-overview__panel">
          <header class="flex items-center justify-between border-b px-4 py-3">
            <h2 class="text-base font-semibold">物料资源总览</h2>
            <button class="h-8 w-8 rounded-md text-lg text-muted-foreground hover:bg-muted" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭">×</button>
          </header>
          <div class="p-6 text-sm text-muted-foreground">暂无物料资源数据</div>
        </section>
      </div>
    `
  }
  return `
    <div
      class="production-object-overview"
      data-production-object-surface="material-resource"
      data-material-sku="${escapeHtml(resource.materialSku)}"
      data-source-object-type="${escapeHtml(context.sourceObjectType || '')}"
      data-source-object-id="${escapeHtml(context.sourceObjectId || '')}"
    >
      <button class="absolute inset-0 bg-slate-950/30" data-production-object-action="close" data-skip-page-rerender="true" aria-label="关闭"></button>
      <section class="production-object-overview__panel">
        ${renderMaterialResourceHeader(resource)}
        ${renderMaterialResourceTabs(resource, tab)}
        <div class="production-object-overview__body">
          ${renderMaterialResourceTabBody(resource, tab)}
        </div>
        <footer class="production-object-overview__footer">
          <div class="text-xs text-muted-foreground">物料资源总览只做供需、库存、配领发和异常判断，不在这里修改库存或采购数据。</div>
        </footer>
      </section>
    </div>
  `
}
```

- [ ] **步骤 7：运行检查验证 UI**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-object-overview.ts
```

预期：FAIL，物料资源 UI 断言通过，失败点转移到搜索分组。

- [ ] **步骤 8：Commit**

```bash
git add src/components/production-object-overview.ts
git commit -m "feat: render material resource overview"
```

---

### 任务 5：全局搜索 — 物料资源分组

**文件：**
- 修改：`src/components/production-object-overview.ts`

- [ ] **步骤 1：新增物料资源搜索卡片**

放在 `renderSearchResultCard()` 前：

```typescript
function renderMaterialSearchResultCard(resource: MaterialResourceOverview): string {
  const summary = resource.supplyDemandSummary
  return `
    <article class="rounded-lg border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${badge('物料资源', 'border-blue-200 bg-blue-50 text-blue-700')}
            ${badge(materialTypeLabel[resource.materialType], 'border-slate-200 bg-slate-50 text-slate-700')}
          </div>
          <div class="mt-2 font-mono text-sm font-semibold text-foreground">${escapeHtml(resource.materialSku)}</div>
          <div class="mt-1 truncate text-sm text-foreground">${escapeHtml(resource.materialName)}</div>
          <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div><span class="text-foreground">当前判断：</span>${escapeHtml(resource.currentJudgement)}</div>
            <div><span class="text-foreground">总需求：</span>${formatMaterialResourceQty(summary.totalRequiredQty, summary.unit)}</div>
            <div><span class="text-foreground">可用库存：</span>${formatMaterialResourceQty(summary.availableQty, summary.unit)}</div>
            <div><span class="text-foreground">在途采购：</span>${formatMaterialResourceQty(summary.inTransitQty, summary.unit)}</div>
            <div><span class="text-foreground">缺口：</span>${formatMaterialResourceQty(summary.shortageQty, summary.unit)}</div>
            <div><span class="text-foreground">影响范围：</span>${resource.businessAllocations.length} 张生产单</div>
          </div>
        </div>
        <div class="flex shrink-0 flex-col gap-2 text-right">
          <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700" data-production-object-action="open-material-resource" data-material-sku="${escapeHtml(resource.materialSku)}" data-skip-page-rerender="true">查看物料资源</button>
          <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-production-object-action="copy-no" data-copy-text="${escapeHtml(resource.materialSku)}" data-skip-page-rerender="true">复制编码</button>
        </div>
      </div>
    </article>
  `
}
```

- [ ] **步骤 2：新增物料搜索分组渲染**

放在 `renderSearchResults()` 前：

```typescript
function renderMaterialGroupedSearchResults(keyword: string, materialResources: MaterialResourceOverview[], rows: ProductionObjectSearchIndex[]): string {
  const relatedMain = rows.filter((item) => item.objectType === 'PRODUCTION_ORDER' || item.objectType === 'DEMAND').slice(0, 6)
  const warehouse = rows.filter((item) => item.objectType === 'WAREHOUSE_DOC' || item.objectType === 'MATERIAL_PREP_ORDER' || item.objectType === 'MATERIAL_PREP_RECORD' || item.objectType === 'MATERIAL_PICKUP_RECORD').slice(0, 6)
  const risks = rows.filter(isSearchRiskItem).slice(0, 6)
  const groups = [
    { title: '物料资源', rowsHtml: materialResources.map(renderMaterialSearchResultCard).join(''), count: materialResources.length },
    { title: '相关生产对象', rowsHtml: relatedMain.map(renderSearchResultCard).join(''), count: relatedMain.length },
    { title: '相关采购与仓储', rowsHtml: warehouse.map(renderSearchResultCard).join(''), count: warehouse.length },
    { title: '异常线索', rowsHtml: risks.map(renderSearchResultCard).join(''), count: risks.length },
  ].filter((group) => group.count > 0)

  if (groups.length === 0) return renderSearchEmpty(keyword)
  return `
    <div class="space-y-4">
      ${groups.map((group) => `
        <section class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(group.title)}</h3>
            <span class="text-xs text-muted-foreground">${group.count} 个对象</span>
          </div>
          ${group.rowsHtml}
        </section>
      `).join('')}
    </div>
  `
}
```

- [ ] **步骤 3：修改 `renderSearchResults()`**

替换函数开头：

```typescript
function renderSearchResults(keyword: string): string {
  const rows = withRelatedMainlineRows(searchProductionObjects(keyword))
  const materialResources = searchMaterialResources(keyword)
  if (materialResources.length > 0) return renderMaterialGroupedSearchResults(keyword, materialResources, rows)
  if (rows.length === 0) return renderSearchEmpty(keyword)
  const groups = groupSearchResults(rows)
  return `
```

保留后续原有 `最佳匹配 / 当前卡点 / 生产主线 / 关联执行` 渲染，确保业务单据号搜索不回退。

- [ ] **步骤 4：让异常关键词命中物料资源**

如果 `searchMaterialResources('缺料')`、`searchMaterialResources('待领料')`、`searchMaterialResources('未到仓')` 返回为空，在数据层 `searchMaterialResources()` 里追加异常关键词分支：

```typescript
  if (['缺料', '待领料', '未到仓'].some((word) => keyword.includes(word))) {
    return Array.from(new Set(
      productionObjectSearchIndex
        .filter((item) => item.objectType === 'MATERIAL')
        .map((item) => item.primaryNo),
    ))
      .map((sku) => getMaterialResourceOverview(sku))
      .filter((item): item is MaterialResourceOverview => Boolean(item))
      .filter((item) => item.currentJudgement.includes(keyword) || item.issues.some((issue) => issue.issueType.includes(keyword) || issue.statusText.includes(keyword)))
  }
```

- [ ] **步骤 5：运行检查验证搜索**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-object-overview.ts
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/components/production-object-overview.ts src/data/fcs/production-object-overview.ts
git commit -m "feat: group material resources in production search"
```

---

### 任务 6：整体验证 — 构建和浏览器检查

**文件：**
- 不修改业务文件

- [ ] **步骤 1：运行核心检查**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-object-overview.ts
```

预期输出：

```text
[check-production-object-overview] PASS
```

- [ ] **步骤 2：运行生产单台账回归检查**

```bash
cd /Users/laoer/Documents/higoods
npx tsx scripts/check-production-order-ledger-row.ts
```

预期输出：

```text
production order ledger row check passed
```

- [ ] **步骤 3：运行构建**

```bash
cd /Users/laoer/Documents/higoods
npm run build
```

预期：Vite build 成功，结尾包含 `built in`。

- [ ] **步骤 4：启动本地服务**

```bash
cd /Users/laoer/Documents/higoods
npm run dev -- --host 127.0.0.1 --port 5174
```

预期：服务监听 `http://127.0.0.1:5174/`。

- [ ] **步骤 5：浏览器验证物料编码入口**

使用 Playwright 或浏览器人工验证：

```bash
node --input-type=module <<'JS'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5174/fcs/production/orders')
await page.getByText('查生产').click()
await page.locator('[data-production-object-action="search"]').fill('FLSZ260617009')
await page.getByText('查看物料资源').first().click()
for (const text of ['物料资源总览', '供需总览', '业务占用', '库存与在途', '配料 / 领料 / 发料', '异常与档案']) {
  if (!(await page.getByText(text).first().isVisible())) throw new Error(`missing ${text}`)
}
const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
if (overflowX > 0) throw new Error(`horizontal overflow ${overflowX}`)
await browser.close()
JS
```

预期：命令无异常退出。

- [ ] **步骤 6：浏览器验证低分辨率**

```bash
node --input-type=module <<'JS'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5174/fcs/production/orders')
await page.getByText('查生产').click()
await page.locator('[data-production-object-action="search"]').fill('缺料')
await page.getByText('查看物料资源').first().click()
if (!(await page.getByText('物料资源总览').first().isVisible())) throw new Error('material overview not visible')
const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
if (overflowX > 0) throw new Error(`mobile horizontal overflow ${overflowX}`)
await browser.close()
JS
```

预期：命令无异常退出。

- [ ] **步骤 7：同步 CodeGraph**

```bash
cd /Users/laoer/Documents/higoods
codegraph sync
codegraph status
```

预期：索引成功，`Pending sync` 为空。

- [ ] **步骤 8：最终 Commit**

如果步骤 6 发现只需要调整 CSS 或文案，单独提交：

```bash
git add src/components/production-object-overview.ts src/data/fcs/production-object-overview.ts src/data/fcs/production-order-identity.ts scripts/check-production-object-overview.ts src/styles.css
git commit -m "fix: polish material resource overview responsive behavior"
```

如果没有额外改动，不需要提交。

---

## 实施顺序

1. 任务 1 先让检查失败。
2. 任务 2 让数据断言通过。
3. 任务 3 让物料编码点击语义正确。
4. 任务 4 让物料资源总览可见。
5. 任务 5 让搜索结果按物料资源分组。
6. 任务 6 做构建和浏览器验证。

每个任务完成后提交一次。提交时不要加入 `.superpowers/`。
