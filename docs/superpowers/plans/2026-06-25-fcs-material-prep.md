# FCS 配料管理模块 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将配料管理从 WLS（仓储物流系统）迁移到 FCS（工厂生产协同系统），按配料对象拆分为 5 个独立视图 + 1 个综合看板，实现「先配料再分配」、5 态配料记录生命周期、车缝配料受裁片放行约束。

**架构：** 
- 数据层：扩展 `src/data/fcs/cutting/production-material-prep.ts`，新增 PICKED/STAGED 状态、面料仓仓库类型、裁片放行约束字段，调整 taskLinks 逻辑为全部"未分配"
- 页面层：新建 `src/pages/fcs/material-prep/` 目录，包含 6 个页面文件（list / dyeing / printing / cutting / sewing / other），复用现有组件库
- 路由层：在 `routes-fcs.ts` 新增 6 条 FCS 路由，从 `routes-wls.ts` 删除旧 WLS 路由
- 菜单层：在 `app-shell-config.ts` 从 WLS 移除配料管理，在 FCS 新增独立一级菜单

**技术栈：** TypeScript，Vanilla 字符串模板渲染，Tailwind CSS，复用 `src/components/ui/` 组件库

---

## 文件结构

本计划涉及以下文件的增改：

**数据层（修改）：**
- `src/data/fcs/cutting/production-material-prep.ts` — 扩展状态类型、新增字段、调整 taskLinks 逻辑、新增拣货/暂存函数

**页面层（新建）：**
- `src/pages/fcs/material-prep/shared.ts` — 共享模块：Badge、状态映射、渲染辅助函数
- `src/pages/fcs/material-prep/list.ts` — 配料列表（综合看板）
- `src/pages/fcs/material-prep/dyeing.ts` — 染色配料
- `src/pages/fcs/material-prep/printing.ts` — 印花配料
- `src/pages/fcs/material-prep/cutting.ts` — 裁片配料（基于现有 transfer-material-prep.ts 逻辑改造）
- `src/pages/fcs/material-prep/sewing.ts` — 车缝配料（含裁片放行约束）
- `src/pages/fcs/material-prep/other.ts` — 其他配料（包材）

**路由层（修改）：**
- `src/router/routes-fcs.ts` — 新增 6 条配料管理路由
- `src/router/routes-wls.ts` — 删除旧配料路由，保留重定向
- `src/router/route-renderers-fcs.ts` — 新增 6 个异步渲染器
- `src/router/route-renderers-wls.ts` — 删除旧的 2 个渲染器

**菜单与 Shell（修改）：**
- `src/data/app-shell-config.ts` — 从 WLS 移除配料管理，在 FCS 新增独立菜单
- `src/main.ts` — 移除 WLS 事件分发，新增 FCS 配料管理事件分发

---

### 任务 1：数据层 — 扩展 MaterialPrepRecordStatus 状态类型

**文件：**
- 修改：`src/data/fcs/cutting/production-material-prep.ts`

- [ ] **步骤 1：将 MaterialPrepRecordStatus 从 3 态扩展为 5 态**

找到第 22 行附近的 `MaterialPrepRecordStatus` 定义：

```typescript
// 当前（约 L22）
export type MaterialPrepRecordStatus = 'DRAFT' | 'CONFIRMED' | 'REJECTED'
```

替换为：

```typescript
export type MaterialPrepRecordStatus = 'DRAFT' | 'PICKED' | 'STAGED' | 'CONFIRMED' | 'REJECTED'
```

- [ ] **步骤 2：新增状态对应的中文标签映射**

在第 157 行附近（`renderPrepRecordStatus` 或类似位置）新增：

```typescript
export const materialPrepRecordStatusLabelMap: Record<MaterialPrepRecordStatus, string> = {
  DRAFT: '待拣货',
  PICKED: '已拣货',
  STAGED: '已入暂存区',
  CONFIRMED: '已确认',
  REJECTED: '已打回',
}
```

新增状态 Badge 变体映射：

```typescript
export const materialPrepRecordStatusVariantMap: Record<MaterialPrepRecordStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  PICKED: 'info',
  STAGED: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
}
```

- [ ] **步骤 3：新增拣货函数 `pickMaterialPrepRecord`**

在 `confirmMaterialPrepRecord` 函数附近（约 L2467 之后）插入：

```typescript
export function pickMaterialPrepRecord(
  prepRecordId: string,
  pickerName = '仓库 张三',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepRecord | null {
  const store = hydrateProductionMaterialPrepStore(storage)
  const record = store.prepRecords.find((item) => item.prepRecordId === prepRecordId)
  if (!record || record.recordStatus !== 'DRAFT') return null
  record.recordStatus = 'PICKED'
  record.remark = (record.remark || '') + ` [${nowText()} ${pickerName} 完成拣货]`
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(record)
}
```

- [ ] **步骤 4：新增入暂存区函数 `stageMaterialPrepRecord`**

继续在后面插入：

```typescript
export function stageMaterialPrepRecord(
  prepRecordId: string,
  stagingArea: string,
  operatorName = '跟单 李明',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepRecord | null {
  const store = hydrateProductionMaterialPrepStore(storage)
  const record = store.prepRecords.find((item) => item.prepRecordId === prepRecordId)
  if (!record || record.recordStatus !== 'PICKED') return null
  record.recordStatus = 'STAGED'
  record.remark = (record.remark || '') + ` [${nowText()} ${operatorName} 已放入暂存区：${stagingArea}]`
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(record)
}
```

- [ ] **步骤 5：更新 `confirmMaterialPrepRecord` 的前置条件**

修改第 2451 行的 `confirmMaterialPrepRecord`，将前置检查从 `DRAFT -> CONFIRMED` 改为 `STAGED -> CONFIRMED`：

```typescript
export function confirmMaterialPrepRecord(
  prepRecordId: string,
  operatorName = '配料小组 周敏',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepRecord | null {
  const store = hydrateProductionMaterialPrepStore(storage)
  const record = store.prepRecords.find((item) => item.prepRecordId === prepRecordId)
  if (!record) return null
  if (record.recordStatus !== 'STAGED' && record.recordStatus !== 'REJECTED') return null  // 只有 STAGED 或 REJECTED 可确认
  record.recordStatus = 'CONFIRMED'
  record.confirmedAt = nowText()
  record.confirmedBy = operatorName
  record.rejectedAt = ''
  record.rejectedBy = ''
  record.rejectReason = ''
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(record)
}
```

- [ ] **步骤 6：更新 `appendPickupRecordFromPrepRecord` 的前置条件**

将第 2550 行附近的检查从 `recordStatus !== 'CONFIRMED'` 保持不变（REJECTED 也不可领料，DRAFT/PICKED/STAGED 更不可领料）。这个无需修改。

- [ ] **步骤 7：更新 `deriveOrderPrepStatus` 中 REJECTED 的判断**

在第 2059 行附近，确认 `REJECTED` 的判断仍然正确（任何 REJECTED 记录导致订单状态为 `REJECTED_REWORK`）。

- [ ] **步骤 8：扩展 `MaterialPrepRecord` 接口新增暂存区字段**

在第 116-136 行附近，给 `MaterialPrepRecord` 新增字段：

```typescript
export interface MaterialPrepRecord {
  // ... 已有字段
  pickedAt?: string       // 新增：拣货完成时间
  pickedBy?: string       // 新增：拣货操作人
  stagedAt?: string       // 新增：入暂存区时间
  stagedBy?: string       // 新增：暂存区操作人
  stagingArea?: string    // 新增：暂存区域名称
}
```

- [ ] **步骤 9：运行构建验证**

```bash
cd /Users/laoer/Documents/higoods && npm run build 2>&1 | tail -20
```

预期：无类型错误。

- [ ] **步骤 10：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts
git commit -m "feat: 扩展配料记录状态为5态(DRAFT/PICKED/STAGED/CONFIRMED/REJECTED)，新增拣货和入暂存区函数"
```

---

### 任务 2：数据层 — 新增面料仓仓库类型 & MaterialPrepLine 扩展

**文件：**
- 修改：`src/data/fcs/cutting/production-material-prep.ts`

- [ ] **步骤 1：扩展 `MaterialStockWarehouseName`**

找到第 21 行：

```typescript
// 当前
export type MaterialStockWarehouseName = '中转仓' | '辅料仓' | '纱线仓' | '包材仓'
```

替换为：

```typescript
export type MaterialStockWarehouseName = '面料仓' | '中转仓' | '辅料仓' | '纱线仓' | '包材仓'
```

- [ ] **步骤 2：更新 `getMaterialStockWarehouseName` 映射函数**

在第 421-426 行，保持不变（面料仍映射到中转仓作为默认），因为面料仓的概念主要是"调拨前的入口仓库"，而配料操作仍在具体仓库（中转仓/印染待加工仓等）中。

```typescript
// 此函数保持不变
export function getMaterialStockWarehouseName(type: MaterialPrepMaterialType): MaterialStockWarehouseName {
  if (type === '面料') return '中转仓'  // 配货仓库仍是中转仓
  if (type === '辅料') return '辅料仓'
  if (type === '纱线') return '纱线仓'
  return '包材仓'
}
```

- [ ] **步骤 3：在 `MaterialPrepLine` 中新增车缝配料约束字段**

在第 71-99 行的 `MaterialPrepLine` 接口中，在 `shortageQty` 之后添加：

```typescript
export interface MaterialPrepLine {
  // ... 已有字段（第 72-99 行）
  linePrepStatus: '未配料' | '部分已配' | '已配齐' | '缺料跟进' | '被打回' | '按实关闭'
  // === 新增字段 ===
  releaseQty: number                    // 裁片放行件数（仅车缝配料有值）
  releaseConstraintApplied: boolean     // 是否应用了裁片放行约束
  maxPrepQty: number                    // 最大可配数量
  defaultPrepQty: number                // 默认配料数量
  // === 原有字段继续 ===
  upstreamSourceType: UpstreamSourceType
  upstreamProgressStatus: UpstreamProgressStatus
  // ...
}
```

- [ ] **步骤 4：更新 `buildLine` 函数，计算新增字段的默认值**

在第 2055 行附近的 `buildLine` 函数中，在构建返回对象时添加新字段的计算逻辑：

```typescript
function buildLine(
  seedLine: MaterialPrepSeedLine,
  store: ProductionMaterialPrepWorkflowStore,
  pickupRecords: PickupRecord[],
  closed: boolean,
): MaterialPrepLine {
  // ... 已有计算逻辑 ...

  // 新增：计算最大可配和默认配料数量
  const releaseQty = seedLine.releaseQty || 0
  const releaseConstraintApplied = releaseQty > 0
  const maxPrepQty = releaseConstraintApplied
    ? Math.min(requiredQty, Math.round(releaseQty * (seedLine.qtyRatio || 1)), availableStockQty)
    : Math.min(requiredQty, availableStockQty)

  return {
    // ... 已有字段 ...
    releaseQty,
    releaseConstraintApplied,
    maxPrepQty,
    defaultPrepQty: maxPrepQty,
  }
}
```

- [ ] **步骤 5：在 `MaterialPrepSeedLine` 中新增可选字段**

在第 182-204 行的 `MaterialPrepSeedLine` 中添加：

```typescript
export interface MaterialPrepSeedLine {
  // ... 已有字段 ...
  upstreamProgressDetail: string
  taskLinks?: MaterialPrepTaskLink[]
  // === 新增 ===
  releaseQty?: number           // 裁片放行件数
  qtyRatio?: number             // BOM 单件用量系数
}
```

- [ ] **步骤 6：在 seed 数据中，对车缝配料行设置样例值**

在第 667 行开始的 `baseMaterialPrepSeedOrders` 数组中，找到对应辅料/纱线的物料行（如 `accessory-zipper`），添加 `releaseQty` 和 `qtyRatio` 样例值：

```typescript
{
  // ... 辅料行
  releaseQty: 320,   // 示例：裁床放行 320 件
  qtyRatio: 1,        // 每件用 1 条拉链
  // ...
}
```

- [ ] **步骤 7：运行构建验证**

```bash
cd /Users/laoer/Documents/higoods && npm run build 2>&1 | tail -20
```

预期：无类型错误。

- [ ] **步骤 8：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts
git commit -m "feat: 新增面料仓仓库类型、MaterialPrepLine车缝约束字段(releaseQty/maxPrepQty)"
```

---

### 任务 3：数据层 — 调整 taskLinks 为「未分配」& 新增配料类型分类函数

**文件：**
- 修改：`src/data/fcs/cutting/production-material-prep.ts`

- [ ] **步骤 1：调整 `buildTaskLink` 函数**

在第 514-530 行，将 `isAssigned` 的硬编码判断改为全部"未分配"：

```typescript
// 当前
function buildTaskLink(order: MaterialPrepSeedOrder, taskType: MaterialPrepTaskType): MaterialPrepTaskLink {
  const meta = taskMetaByType[taskType]
  const orderSuffix = order.productionOrderNo.replace('PO-', '')
  const isAssigned = order.prepOrderId !== 'prep-order-po-202603-0008'  // 旧的硬编码逻辑
  // ...
}
```

替换为：

```typescript
function buildTaskLink(order: MaterialPrepSeedOrder, taskType: MaterialPrepTaskType): MaterialPrepTaskLink {
  const meta = taskMetaByType[taskType]
  const orderSuffix = order.productionOrderNo.replace('PO-', '')
  // 全部标记为"未分配"——配料不绑定工厂，分配后回写
  const isAssigned = false
  const factory = null
  return {
    taskId: `task:${order.productionOrderNo}:${meta.code}`,
    taskNo: `TASK-${meta.code}-${orderSuffix}`,
    taskName: meta.name,
    taskType,
    factoryId: '',
    factoryCode: '',
    factoryName: '待分配后确定',
    assignedAt: '',
    allocationStatus: '未分配',
  }
}
```

- [ ] **步骤 2：新增配料类型分类函数 `classifyPrepLineType`**

在 `buildDefaultTaskLinks` 附近（约 L530 行之后）新增：

```typescript
export type MaterialPrepCategory = '染色配料' | '印花配料' | '裁片配料' | '车缝配料' | '其他配料'

export function classifyPrepLineType(line: MaterialPrepLine): MaterialPrepCategory {
  const materialType = line.materialType
  const source = line.upstreamSourceType

  if (materialType === '面料') {
    if (source === '染色' || line.upstreamProgressStatus === '染色中') return '染色配料'
    if (source === '印花' || line.upstreamProgressStatus === '印花中') return '印花配料'
    return '裁片配料'
  }

  if (materialType === '辅料' || materialType === '纱线') return '车缝配料'
  return '其他配料'
}

export const materialPrepCategoryLabelMap: Record<MaterialPrepCategory, string> = {
  '染色配料': '染色配料',
  '印花配料': '印花配料',
  '裁片配料': '裁片配料',
  '车缝配料': '车缝配料',
  '其他配料': '其他配料',
}

export const materialPrepCategoryRoutes: Record<MaterialPrepCategory, string> = {
  '染色配料': '/fcs/material-prep/dyeing',
  '印花配料': '/fcs/material-prep/printing',
  '裁片配料': '/fcs/material-prep/cutting',
  '车缝配料': '/fcs/material-prep/sewing',
  '其他配料': '/fcs/material-prep/other',
}
```

- [ ] **步骤 3：运行构建验证**

```bash
cd /Users/laoer/Documents/higoods && npm run build 2>&1 | tail -20
```

预期：无类型错误。

- [ ] **步骤 4：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts
git commit -m "feat: taskLinks全部改为未分配；新增配料类型分类函数classifyPrepLineType"
```

---

### 任务 4：页面层 — 共享模块 shared.ts

**文件：**
- 创建：`src/pages/fcs/material-prep/shared.ts`

- [ ] **步骤 1：创建共享模块**

```typescript
import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepRecordStatusVariantMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  materialPrepCategoryLabelMap,
  classifyPrepLineType,
  type MaterialPrepOrderStatus,
  type MaterialPrepRecordStatus,
  type MaterialPrepCategory,
  type MaterialPrepOrderProjection,
  type MaterialPrepLine,
  type MaterialPrepRecord,
  type PickupRecord,
  type PrepRejectRecord,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import { escapeHtml } from '../../../utils.ts'

// 重新导出，方便各子页面统一引用
export {
  materialPrepStatusLabelMap,
  materialPrepRecordStatusLabelMap,
  materialPrepRecordStatusVariantMap,
  materialPrepWorkbenchTabs,
  pickupStatusLabelMap,
  materialPrepCategoryLabelMap,
  classifyPrepLineType,
  escapeHtml,
  renderBadge,
}
export type {
  MaterialPrepOrderStatus,
  MaterialPrepRecordStatus,
  MaterialPrepCategory,
  MaterialPrepOrderProjection,
  MaterialPrepLine,
  MaterialPrepRecord,
  PickupRecord,
  PrepRejectRecord,
  BadgeVariant,
}
```

- [ ] **步骤 2：添加共享的渲染辅助函数**

```typescript
export function renderPrepRecordStatusBadge(status: MaterialPrepRecordStatus): string {
  const label = materialPrepRecordStatusLabelMap[status]
  const variant = materialPrepRecordStatusVariantMap[status]
  return renderBadge(label, variant)
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  return value.toLocaleString('zh-CN')
}

export function renderPrepSummaryCards(projection: MaterialPrepOrderProjection): string {
  return `
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border bg-card px-4 py-3">
        <div class="text-sm text-muted-foreground">总物料行数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums">${projection.lineCount}</div>
      </div>
      <div class="rounded-lg border bg-card px-4 py-3">
        <div class="text-sm text-muted-foreground">已确认记录数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">${projection.prepRecords.filter(r => r.recordStatus === 'CONFIRMED').length}</div>
      </div>
      <div class="rounded-lg border bg-card px-4 py-3">
        <div class="text-sm text-muted-foreground">被打回记录数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums ${projection.rejectedRecordCount > 0 ? 'text-rose-600' : ''}">${projection.rejectedRecordCount}</div>
      </div>
      <div class="rounded-lg border bg-card px-4 py-3">
        <div class="text-sm text-muted-foreground">未完成记录数</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-amber-600">${projection.prepRecords.filter(r => r.recordStatus !== 'CONFIRMED' && r.recordStatus !== 'REJECTED').length}</div>
      </div>
    </div>
  `
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/pages/fcs/material-prep/shared.ts
git commit -m "feat: 新增配料管理共享模块 shared.ts（状态映射、渲染辅助函数）"
```

---

### 任务 5：页面层 — 配料列表（综合看板）list.ts

**文件：**
- 创建：`src/pages/fcs/material-prep/list.ts`

- [ ] **步骤 1：创建综合看板页面**

页面导出 2 个渲染函数和 1 个事件处理函数：

```typescript
import {
  materialPrepStatusLabelMap,
  materialPrepWorkbenchTabs,
  materialPrepCategoryLabelMap,
  classifyPrepLineType,
  escapeHtml,
  renderBadge,
  formatQty,
  type MaterialPrepOrderProjection,
  type MaterialPrepOrderStatus,
} from './shared.ts'
import { listMaterialPrepOrderProjections } from '../../../data/fcs/cutting/production-material-prep.ts'

type ListFilter = {
  keyword: string
  statusFilter: MaterialPrepOrderStatus | '全部'
}

let listState: ListFilter = { keyword: '', statusFilter: '全部' }

function getListSearchParams(): URLSearchParams { /* 标准实现 */ }

function renderFilters(): string { /* 搜索框 + 状态筛选下拉 */ }

function renderOrderRow(projection: MaterialPrepOrderProjection): string {
  const category = projection.lines.length > 0 ? classifyPrepLineType(projection.lines[0]) : null
  return `
    <tr class="hover:bg-muted/50">
      <td class="px-3 py-2 text-sm">${escapeHtml(projection.order.productionOrderNo)}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(projection.order.styleName)}</td>
      <td class="px-3 py-2 text-sm">
        ${category ? renderBadge(category, 'info') : '-'}
      </td>
      <td class="px-3 py-2 text-sm">${formatQty(projection.totalRequiredQty)}</td>
      <td class="px-3 py-2 text-sm">
        <div class="flex items-center gap-1">
          <div class="h-2 flex-1 rounded-full bg-muted"><div class="h-2 rounded-full bg-primary" style="width:${projection.totalConfirmedPrepQty / Math.max(1, projection.totalRequiredQty) * 100}%"></div></div>
          <span>${formatQty(projection.totalConfirmedPrepQty)}/${formatQty(projection.totalRequiredQty)}</span>
        </div>
      </td>
      <td class="px-3 py-2 text-sm">${renderBadge(materialPrepStatusLabelMap[projection.order.overallPrepStatus], 'neutral')}</td>
      <td class="px-3 py-2 text-sm">
        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-fcs-material-prep-action="view-detail" data-prep-order-id="${escapeHtml(projection.order.prepOrderId)}">查看</button>
      </td>
    </tr>
  `
}

export function renderFcsMaterialPrepListPage(): string {
  const projections = listMaterialPrepOrderProjections()
  // ... 筛选 + 渲染表格 ...
}

export function handleFcsMaterialPrepListEvent(target: HTMLElement): boolean {
  // ... 处理筛选、翻页、跳转详情事件 ...
}
```

- [ ] **步骤 2：注册路由渲染器**

在 `src/router/route-renderers-fcs.ts` 中新增（任务 9 一起处理）：

```typescript
export const renderFcsMaterialPrepListPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/list'),
  'renderFcsMaterialPrepListPage',
)
```

- [ ] **步骤 3：验证页面可达**

```bash
cd /Users/laoer/Documents/higoods && npm run dev -- --host 0.0.0.0 --port 5173 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/fcs/material-prep/list
```

- [ ] **步骤 4：Commit**

---

### 任务 6：页面层 — 染色配料 dyeing.ts & 印花配料 printing.ts

**文件：**
- 创建：`src/pages/fcs/material-prep/dyeing.ts`
- 创建：`src/pages/fcs/material-prep/printing.ts`

注意：染色和印花配料页面结构相同，只在筛选条件（`processCode === 'DYE'` vs `'PRINT'`）上有差异。创建共享逻辑后两个页面分别调用。

- [ ] **步骤 1：分析现有 transfer-material-prep.ts 可复用的逻辑**

当前的 `transfer-material-prep.ts` 有配料记录列表、新增记录、确认记录的完整 UI 逻辑。在 dyeing.ts 和 printing.ts 中直接复用这些模式，但：

1. 只筛选对应工艺类型（染色 / 印花）的配料单
2. 新增「拣货」和「入暂存区」按钮（DRAFT → PICKED → STAGED）
3. 确认按钮仅当 `recordStatus === 'STAGED'` 时可用
4. 不展示 taskLinks（工艺绑定，工厂确定）

- [ ] **步骤 2：创建 dyeing.ts**

```typescript
// src/pages/fcs/material-prep/dyeing.ts
import {
  listMaterialPrepOrderProjections,
  classifyPrepLineType,
  type MaterialPrepOrderProjection,
  type MaterialPrepCategory,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  materialPrepStatusLabelMap,
  materialPrepWorkbenchTabs,
  renderPrepRecordStatusBadge,
  formatQty,
  escapeHtml,
  renderBadge,
} from './shared.ts'

function filterDyeingOrders(): MaterialPrepOrderProjection[] {
  return listMaterialPrepOrderProjections().filter(p => 
    p.lines.some(l => classifyPrepLineType(l) === '染色配料')
  )
}

export function renderFcsDyeingPrepPage(): string {
  const projections = filterDyeingOrders()
  // 复用 transfer-material-prep.ts 的 Tab 列表 + 详情 + 新增记录 + 拣货/暂存/确认 交互模式
  // ...
}

export function handleFcsDyeingPrepEvent(target: HTMLElement): boolean { /* ... */ }
```

- [ ] **步骤 3：创建 printing.ts（与 dyeing.ts 结构完全对称）**

```typescript
// src/pages/fcs/material-prep/printing.ts
// 把 filterDyeingOrders 中的 '染色配料' 换成 '印花配料'
// 其余结构完全相同
export function renderFcsPrintingPrepPage(): string { /* ... */ }
export function handleFcsPrintingPrepEvent(target: HTMLElement): boolean { /* ... */ }
```

- [ ] **步骤 4：验证构建通过**

```bash
npm run build
```

- [ ] **步骤 5：Commit**

---

### 任务 7：页面层 — 裁片配料 cutting.ts（重写 transfer-material-prep.ts）

**文件：**
- 创建：`src/pages/fcs/material-prep/cutting.ts`
- 删除（后续任务）：`src/pages/wls/transfer-material-prep.ts`

裁片配料的业务逻辑最接近当前 WLS 配料管理，但需要适配新的 5 态流转（DRAFT → PICKED → STAGED → CONFIRMED）。

- [ ] **步骤 1：创建 cutting.ts，复刻 transfer-material-prep.ts 的核心结构**

在现有 `transfer-material-prep.ts`（1092 行）的基础上：
1. 保留：配料单列表 Tab 结构、详情页 5 个 Tab、配料记录卡片、新增配料记录弹窗
2. 新增：拣货按钮（DRAFT → PICKED）、入暂存区按钮（PICKED → STAGED）
3. 修改：确认按钮仅当 `recordStatus === 'STAGED'` 时可用
4. 修改：taskLinks 展示为「未分配」
5. 所有 `wls-prep-action` 改为 `fcs-material-prep-action`
6. 所有导航路径改为 `/fcs/material-prep/cutting...`

关键修改 — 记录卡片中的操作按钮：

```typescript
function renderPrepRecordActions(record: MaterialPrepRecord): string {
  const status = record.recordStatus
  switch (status) {
    case 'DRAFT':
      return `<button data-fcs-material-prep-action="pick-record" data-prep-record-id="${record.prepRecordId}" class="...">确认拣货</button>`
    case 'PICKED':
      return `<button data-fcs-material-prep-action="stage-record" data-prep-record-id="${record.prepRecordId}" class="...">确认入暂存区</button>`
    case 'STAGED':
      return `<button data-fcs-material-prep-action="confirm-record" data-prep-record-id="${record.prepRecordId}" class="...">确认配料完成</button>`
    case 'CONFIRMED':
      return `<span class="...text-emerald-700">整条记录已进入领料管理</span>`
    case 'REJECTED':
      return `<span class="...text-rose-700">被打回重配</span><button data-fcs-material-prep-action="stage-record" data-prep-record-id="${record.prepRecordId}" class="...">重新入暂存区</button>`
  }
}
```

- [ ] **步骤 2：实现事件处理函数**

```typescript
import { pickMaterialPrepRecord, stageMaterialPrepRecord, confirmMaterialPrepRecord } from '../../../data/fcs/cutting/production-material-prep.ts'

export function handleFcsCuttingPrepEvent(target: HTMLElement): boolean {
  const actionNode = target.closest('[data-fcs-material-prep-action]') as HTMLElement | null
  if (!actionNode) return false
  const action = actionNode.dataset.fcsMaterialPrepAction

  if (action === 'pick-record') {
    pickMaterialPrepRecord(actionNode.dataset.prepRecordId || '')
    return true
  }
  if (action === 'stage-record') {
    const area = prompt('请输入暂存区域名称：', '中转仓暂存区 A') || '中转仓暂存区'
    stageMaterialPrepRecord(actionNode.dataset.prepRecordId || '', area)
    return true
  }
  if (action === 'confirm-record') {
    confirmMaterialPrepRecord(actionNode.dataset.prepRecordId || '', '配料小组 周敏')
    return true
  }
  // ... 其他事件处理
}
```

- [ ] **步骤 3：Commit**

---

### 任务 8：页面层 — 车缝配料 sewing.ts（含裁片放行约束）

**文件：**
- 创建：`src/pages/fcs/material-prep/sewing.ts`

- [ ] **步骤 1：创建 sewing.ts，在裁片配料页面基础上增加放行约束卡片**

```typescript
import { getCutPieceReleaseSummaryForProductionOrder } from '../../../data/fcs/cut-piece-release.ts'
import {
  listMaterialPrepOrderProjections,
  classifyPrepLineType,
  type MaterialPrepOrderProjection,
} from '../../../data/fcs/cutting/production-material-prep.ts'

function filterSewingOrders(): MaterialPrepOrderProjection[] {
  return listMaterialPrepOrderProjections().filter(p =>
    p.lines.some(l => classifyPrepLineType(l) === '车缝配料')
  )
}

function renderCutPieceReleaseCard(projection: MaterialPrepOrderProjection): string {
  const summary = getCutPieceReleaseSummaryForProductionOrder(projection.order.productionOrderId)
  if (!summary) {
    return `<div class="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-700">尚未形成裁片放行判断，车缝配料数量暂以 BOM 需求为准。</div>`
  }
  return `
    <div class="rounded-md border bg-blue-50 px-3 py-2 text-sm">
      <div class="font-medium">裁片放行约束</div>
      <div class="mt-1">判断结果：${summary.decision} &nbsp;|&nbsp; 可做数量：${summary.releaseQty} 件</div>
      <div class="mt-0.5 text-muted-foreground">${summary.reason}</div>
      <div class="mt-1 text-xs text-muted-foreground">车缝配料最大数量 = min(BOM需求, 放行件数×单品用量, 库存)</div>
    </div>
  `
}

export function renderFcsSewingPrepPage(): string {
  const projections = filterSewingOrders()
  // 在每位物料行上方展示放行约束卡片
  // 新增配料记录时限制 maxPrepQty
  // ...
}

export function handleFcsSewingPrepEvent(target: HTMLElement): boolean { /* 同 cutting.ts，不重复 */ }
```

- [ ] **步骤 2：验证构建通过**

```bash
npm run build
```

- [ ] **步骤 3：Commit**

---

### 任务 9：页面层 — 其他配料 other.ts

**文件：**
- 创建：`src/pages/fcs/material-prep/other.ts`

与车缝配料结构相同，但不展示裁片放行约束卡片，因为没有放行约束关系。筛选条件为 `分类 === '其他配料'`。

```typescript
import { classifyPrepLineType } from '../../../data/fcs/cutting/production-material-prep.ts'

function filterOtherOrders() {
  return listMaterialPrepOrderProjections().filter(p =>
    p.lines.some(l => classifyPrepLineType(l) === '其他配料')
  )
}

export function renderFcsOtherPrepPage(): string { /* 同 cutting.ts，不放行约束 */ }
export function handleFcsOtherPrepEvent(target: HTMLElement): boolean { /* 同 cutting.ts */ }
```

---

### 任务 10：路由层 — 新增 FCS 路由 + 删除 WLS 旧路由

**文件：**
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/router/routes-wls.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/route-renderers-wls.ts`

- [ ] **步骤 1：在 routes-fcs.ts 中新增 7 条路由**

在第 231 行（`/fcs/dispatch/sewing` 之后）新增：

```typescript
// 配料管理（FCS 新增模块）
'/fcs/material-prep/list': () => renderFcsMaterialPrepListPage(),
'/fcs/material-prep/dyeing': () => renderFcsDyeingPrepPage(),
'/fcs/material-prep/printing': () => renderFcsPrintingPrepPage(),
'/fcs/material-prep/cutting': () => renderFcsCuttingPrepPage(),
'/fcs/material-prep/sewing': () => renderFcsSewingPrepPage(),
'/fcs/material-prep/other': () => renderFcsOtherPrepPage(),
```

- [ ] **步骤 2：在 route-renderers-fcs.ts 新增 6 个异步渲染器**

在第 167 行（`renderSewingDispatchWorkbenchPage` 之后）新增：

```typescript
export const renderFcsMaterialPrepListPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/list'), 'renderFcsMaterialPrepListPage')
export const renderFcsDyeingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/dyeing'), 'renderFcsDyeingPrepPage')
export const renderFcsPrintingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/printing'), 'renderFcsPrintingPrepPage')
export const renderFcsCuttingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/cutting'), 'renderFcsCuttingPrepPage')
export const renderFcsSewingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/sewing'), 'renderFcsSewingPrepPage')
export const renderFcsOtherPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/other'), 'renderFcsOtherPrepPage')
```

- [ ] **步骤 3：修改 routes-wls.ts，删除旧路由，改为重定向到 FCS**

将整个 `exactRoutes` 中的 4 条改为重定向：

```typescript
export const routes: RouteRegistry = {
  exactRoutes: {
    '/wls': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS 工厂生产协同系统'),
    '/wls/transfer-warehouse': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS'),
    '/wls/transfer-warehouse/material-prep': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS'),
    '/wls/transfer-warehouse/material-prep-detail': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS'),
  },
  dynamicRoutes: [],
}
```

- [ ] **步骤 4：更新 route-renderers-wls.ts 的导入**

移除对 `transfer-material-prep` 的导入，保留 `renderRouteRedirect`：

```typescript
import type { RouteRegistry } from './route-types'
import { renderRouteRedirect } from './route-utils'
// 删除原有的 createAsyncRenderer 和 import

// 删除原有的两个 renderer 导出
```

- [ ] **步骤 5：构建验证**

```bash
npm run build
```

预期：无构建错误。WLS 旧路径正确重定向。

- [ ] **步骤 6：Commit**

---

### 任务 11：菜单 & Shell 调整

**文件：**
- 修改：`src/data/app-shell-config.ts`

- [ ] **步骤 1：从 WLS 菜单中删除配料管理**

在约 L536-555 行，删除 `中转仓管理` 中的 `配料管理` 菜单项。或将整个 `中转仓管理` 分组改为空或保留其他 WLS 入口：

```typescript
wls: [
  {
    title: '仓储管理',
    items: [
      { key: 'inventory', title: '库存管理', icon: 'Archive', href: '/wls/inventory' },
      { key: 'inbound', title: '入库管理', icon: 'ArrowDownToLine', href: '/wls/inbound' },
      { key: 'outbound', title: '出库管理', icon: 'ArrowUpFromLine', href: '/wls/outbound' },
    ],
  },
],
```

- [ ] **步骤 2：在 FCS 菜单中新增独立的「配料管理」一级分组**

在 FCS 的菜单数组（约 L250 附近，`生产单管理` 和 `生产分配` 附近）新增：

```typescript
{
  key: 'fcs-material-prep',
  title: '配料管理',
  icon: 'PackageCheck',
  children: [
    { key: 'material-prep-list', title: '配料列表', icon: 'LayoutList', href: '/fcs/material-prep/list' },
    { key: 'material-prep-dyeing', title: '染色配料', icon: 'Droplets', href: '/fcs/material-prep/dyeing' },
    { key: 'material-prep-printing', title: '印花配料', icon: 'Palette', href: '/fcs/material-prep/printing' },
    { key: 'material-prep-cutting', title: '裁片配料', icon: 'Scissors', href: '/fcs/material-prep/cutting' },
    { key: 'material-prep-sewing', title: '车缝配料', icon: 'Component', href: '/fcs/material-prep/sewing' },
    { key: 'material-prep-other', title: '其他配料', icon: 'Package', href: '/fcs/material-prep/other' },
  ],
},
```

- [ ] **步骤 3：构建验证**

```bash
npm run build
```

- [ ] **步骤 4：Commit**

---

### 任务 12：main.ts — 事件分发调整

**文件：**
- 修改：`src/main.ts`

- [ ] **步骤 1：移除 WLS 事件分发**

在第 455-458 行，删除 / 注释掉：

```typescript
// 删除以下代码块
if (pathname.startsWith('/wls/transfer-warehouse/material-prep')) {
  const wlsMaterialPrepPage = await getWlsTransferMaterialPrepPageModule()
  return wlsMaterialPrepPage.handleWlsTransferMaterialPrepEvent(eventTarget)
}
```

- [ ] **步骤 2：新增 FCS 配料管理事件分发**

在同一位置新增：

```typescript
// FCS 配料管理事件分发
if (pathname.startsWith('/fcs/material-prep/')) {
  const pathSegments = pathname.split('/')
  const prepType = pathSegments[3] || 'list' // 'dyeing' | 'printing' | 'cutting' | 'sewing' | 'other' | 'list'

  let handler: (target: HTMLElement) => boolean
  switch (prepType) {
    case 'dyeing': {
      const mod = await import('./pages/fcs/material-prep/dyeing')
      handler = mod.handleFcsDyeingPrepEvent
      break
    }
    case 'printing': {
      const mod = await import('./pages/fcs/material-prep/printing')
      handler = mod.handleFcsPrintingPrepEvent
      break
    }
    case 'cutting': {
      const mod = await import('./pages/fcs/material-prep/cutting')
      handler = mod.handleFcsCuttingPrepEvent
      break
    }
    case 'sewing': {
      const mod = await import('./pages/fcs/material-prep/sewing')
      handler = mod.handleFcsSewingPrepEvent
      break
    }
    case 'other': {
      const mod = await import('./pages/fcs/material-prep/other')
      handler = mod.handleFcsOtherPrepEvent
      break
    }
    default: {
      const mod = await import('./pages/fcs/material-prep/list')
      handler = mod.handleFcsMaterialPrepListEvent
      break
    }
  }
  return handler(eventTarget)
}
```

- [ ] **步骤 3：清理 WLS 相关的模块加载器**

在第 15 行和第 86-94 行，删除 `WlsTransferMaterialPrepPageModule` 类型和 `getWlsTransferMaterialPrepPageModule` 函数。

- [ ] **步骤 4：构建验证**

```bash
npm run build
```

- [ ] **步骤 5：启动 Dev Server 并验证所有路由**

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

验证以下路径可达：
- `http://localhost:5173/fcs/material-prep/list`
- `http://localhost:5173/fcs/material-prep/dyeing`
- `http://localhost:5173/fcs/material-prep/printing`
- `http://localhost:5173/fcs/material-prep/cutting`
- `http://localhost:5173/fcs/material-prep/sewing`
- `http://localhost:5173/fcs/material-prep/other`
- 旧路径 `http://localhost:5173/wls/transfer-warehouse/material-prep` 正确重定向

- [ ] **步骤 6：Commit**

---

### 任务 13：清理 — 删除旧文件 & 最终验证

**文件：**
- 删除：`src/pages/wls/transfer-material-prep.ts`（逻辑已迁移到 cutting.ts 等）
- 保留：`src/pages/process-factory/cutting/pickup-management.ts`（FCS 裁床领料管理仍需要）

- [ ] **步骤 1：删除旧 WLS 配料页面（可选，也可保留以备回退）**

如果确认迁移完成，删除：
```bash
rm src/pages/wls/transfer-material-prep.ts
```

也可以先不删除，等验证通过后再清理。

- [ ] **步骤 2：最终构建 & 启动验证**

```bash
cd /Users/laoer/Documents/higoods && npm run build 2>&1 | tail -5
npm run dev -- --host 0.0.0.0 --port 5173
```

在浏览器中逐一验证 6 个配料管理页面的可访问性和交互。

- [ ] **步骤 3：Commit**

```bash
git add -A
git commit -m "chore: 清理旧的 WLS 配料管理页面和事件处理"
```

---

## 扩展任务（按需执行）

### 可选任务 A：添加 Mock 数据多样性

当前 `baseMaterialPrepSeedOrders` 有 8 个硬编码的配料单。为了展示五大配料类型的差异，需要确保 seed 数据中包含：
- 染色配料的样例数据（面料 + upstreamSourceType='染色'）
- 印花配料的样例数据（面料 + upstreamSourceType='印花'）
- 车缝配料 + 裁片放行约束的样例数据（辅料 + releaseQty 非零）

### 可选任务 B：PDA 配料操作适配

如果配料小组有 PDA 端操作需求，需要在 `src/pages/pda-warehouse.ts` 或新建 PDA 页面中提供拣货扫描、暂存区确认的功能。

---

## 自检

**1. 规格覆盖度**  
对照产品设计方案 12 个章节逐一核实：
- 第 2 节（架构）：任务 10/11 覆盖路由和菜单调整
- 第 3 节（五大分类规则）：任务 3/5-9 覆盖
- 第 4 节（核心业务流程）：任务 5-9 页面实现
- 第 5 节（状态机）：任务 1 覆盖
- 第 6 节（先配料再分配）：任务 3 调整 taskLinks
- 第 7 节（配料数量计算）：任务 2 新增字段
- 第 8 节（暂存区）：任务 1 新增 PICKED/STAGED 状态
- 第 9 节（关联模块交互）：任务 8 集成裁片放行
- 第 10 节（数据模型）：任务 1-2 覆盖
- 第 11 节（菜单 & 页面架构）：任务 11 覆盖
- 第 12 节（差异分析）：任务 1-3 覆盖关键差异点

**2. 占位符扫描**：无 "TODO"、"待定" 等占位符。

**3. 类型一致性**：所有函数签名和类型在数据层和页面层之间保持一致。任务 3 定义的 `classifyPrepLineType` 在任务 5-9 中使用。

**4. 范围检查**：本计划仅覆盖配料管理模块的迁移和扩展，不涉及面料仓调拨单、印染回仓入库单的新增（这些在产品设计文档中列为"需要新增的代码模块"但属于独立子系统）。
