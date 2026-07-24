# 特殊工艺域去掉子加工单层实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除特殊工艺域的"任务单 → 子加工单"两层模型，任务单直接承担执行（状态、数量、操作），列表页重写为标准列表页。

**架构：** 数据层删除 `SpecialCraftTaskWorkOrder` 及其相关类型和函数，任务单字段补齐（`businessType`、`scrapQty`、`damageQty`、`returnedQty` 等）。Web 端加工单详情页删除并重定向到任务详情页，任务详情页嵌入操作面板，列表页重写为标准列表页（`renderStandardListPage`）。PDA 端所有 workOrder 引用改为 taskOrder。

**技术栈：** TypeScript + Vite + Tailwind CSS，字符串模板渲染，`src/components/ui/` 组件库。

---

## 文件结构

### 数据层（核心重构文件）
| 文件 | 职责 |
|------|------|
| `src/data/fcs/special-craft-task-orders.ts` | 删除 WorkOrder/WorkOrderLine 类型和函数；任务单补充执行字段；修改 store |
| `src/data/fcs/special-craft-operations.ts` | 删除 `buildSpecialCraftWorkOrderDetailPath`；更新仓库路径 |
| `src/data/fcs/process-web-status-actions.ts` | `SPECIAL_CRAFT_WORK_ORDER` → `SPECIAL_CRAFT_TASK_ORDER` |
| `src/data/fcs/process-action-writeback-service.ts` | 状态写回目标从 workOrder 改为 taskOrder |
| `src/data/fcs/process-warehouse-domain.ts` | `sourceWorkOrderId` → `sourceTaskOrderId` |
| `src/data/fcs/process-warehouse-linkage-service.ts` | WorkOrder 查询改为 TaskOrder |
| `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts` | `workOrderId` → `taskOrderId` |
| `src/data/fcs/special-craft-pda-scope.ts` | `findTaskWorkOrder` 重写为 `findTaskOrder` |
| `src/data/fcs/special-craft-pda-warehouse-actions.ts` | 上下文 `workOrderId` → `taskOrderId` |
| `src/data/fcs/mobile-execution-task-index.ts` | `SPECIAL_CRAFT_WORK_ORDER` → `SPECIAL_CRAFT_TASK_ORDER` |
| `src/data/fcs/process-mobile-task-binding.ts` | `validateSpecialCraftMobileTaskBinding` 用 taskOrderId |
| `src/data/fcs/platform-process-result-view.ts` | 用 taskOrder 构建视图 |
| `src/data/fcs/progress-statistics-linkage.ts` | WorkOrder 引用全部改为 TaskOrder |
| `src/data/fcs/process-execution-writeback.ts` | WorkOrder 后备引用改为 TaskOrder |
| `src/data/fcs/factory-internal-warehouse.ts` | `sourceWorkOrderId` → `sourceTaskOrderId` |

### Web 页面
| 文件 | 职责 |
|------|------|
| `src/pages/process-factory/special-craft/task-orders.ts` | 重写为标准列表页（`@page-pattern: list`），加快捷操作 |
| `src/pages/process-factory/special-craft/task-detail.ts` | 嵌入操作面板，删除子加工单 Tab |
| `src/pages/process-factory/special-craft/work-order-detail.ts` | 删除（或改为重定向函数） |
| `src/pages/process-factory/special-craft/shared.ts` | 可能需要更新辅助函数 |
| `src/pages/process-factory/special-craft/warehouse.ts` | 链接改为任务详情 |
| `src/router/routes-fcs.ts` | Work-orders 路由改为重定向 |
| `src/router/route-renderers-fcs.ts` | 删除 work-order-detail 异步加载 |
| `src/main-handlers/fcs-handlers.ts` | 删除 `handleSpecialCraftWorkOrderDetailEvent` |

### PDA
| 文件 | 职责 |
|------|------|
| `src/pages/pda-exec-detail.ts` | `resolveSpecialCraftWorkOrderInfo` → `resolveSpecialCraftTaskInfo` |
| `src/pages/pda-warehouse-wait-process.ts` | `data-work-order-id` → `data-task-order-id` |
| `src/pages/pda-warehouse-wait-handover.ts` | `data-work-order-id` → `data-task-order-id` |

### 脚本和测试
| 文件 | 职责 |
|------|------|
| `scripts/check-heat-transfer-and-print-dye-contract.ts` | 全部 workOrder 引用更新 |
| `scripts/check-special-craft-pda-warehouse-actions.ts` | 更新 |
| `scripts/check-process-mobile-task-binding.ts` | 更新 |
| `scripts/check-special-craft-task-and-fei-flow-deepening.ts` | 更新 |
| `scripts/check-special-craft-task-generation.ts` | 更新 |
| `scripts/check-process-warehouse-handover-linkage.ts` | 更新 |
| `scripts/check-mobile-list-direct-detail-consistency.ts` | 更新 |
| `scripts/check-special-craft-web-mobile-action-dialog-and-layout.ts` | 更新 |
| `scripts/check-process-factory-tabs-and-post-finishing.ts` | 更新 |
| `scripts/check-process-warehouse-unification.ts` | 更新 |
| `scripts/check-handover-writeback-difference-unification.ts` | 更新 |
| `scripts/check-process-factory-web-status-actions.ts` | 更新 |
| `scripts/check-process-quantity-labels.ts` | 更新 |
| `tests/process-warehouse-handover-linkage.spec.ts` | 更新 |
| `tests/heat-transfer-and-print-dye-flow.spec.ts` | 更新 |
| `tests/special-craft-web-mobile-action-dialog-and-layout.spec.ts` | 更新 |
| `tests/process-factory-tabs-and-post-finishing.spec.ts` | 更新 |
| `tests/handover-writeback-difference-unification.spec.ts` | 更新 |
| `tests/process-warehouse-unification.spec.ts` | 更新 |

---

## 阶段 1：数据层

### 任务 1.1：重写 `special-craft-task-orders.ts`（删除 WorkOrder 层）

**文件：** `src/data/fcs/special-craft-task-orders.ts`

- [ ] **步骤 1：删除 WorkOrder 相关类型定义**

删除以下类型（行 118-179）：`SpecialCraftTaskWorkOrderLine`、`SpecialCraftWorkOrderBusinessType`、`SpecialCraftTaskWorkOrder`。

- [ ] **步骤 2：SpecialCraftTaskOrder 补充执行字段**

在 `SpecialCraftTaskOrder` 接口（行 268）中新增强制字段：

```typescript
// 在 SpecialCraftTaskOrder 中新增（从 WorkOrder 迁入或补齐）
businessType: 'HEAT_TRANSFER' | 'DIRECT_PRINT' | 'OTHER_SPECIAL_CRAFT'  // 原来在 WorkOrder 上
openDifferenceReportCount: number  // 已有，确认类型
openObjectionCount: number  // 已有，确认类型
```

行 312 的 `lossQty` 重命名为 `scrapQty`（统一口径）。确认 `damageQty`、`currentQty`、`returnedQty` 已存在于 `SpecialCraftTaskOrder` 中（行 313-315 已有）。

- [ ] **步骤 3：删除 Store 中的 workOrders/workOrderLines**

行 438-444 `SpecialCraftTaskStore` 接口，删除 `workOrders` 和 `workOrderLines` 字段：

```typescript
interface SpecialCraftTaskStore {
  taskOrders: SpecialCraftTaskOrder[]
  generationBatches: SpecialCraftTaskGenerationBatch[]
  generationErrors: SpecialCraftTaskGenerationError[]
}
```

- [ ] **步骤 4：在 linked demo seed 中填充 businessType**

在 `buildLinkedDemoTaskSeed` 函数（行 631）中，给 seed 加上：

```typescript
businessType: getSpecialCraftWorkOrderBusinessType(operation.operationId),
```

保留 `getSpecialCraftWorkOrderBusinessType` 工具函数（因为它只是 operationId → businessType 映射，仍然有用），但在 `buildTaskOrder` 中将 `businessType` 写入 `SpecialCraftTaskOrder`（行 1286 附近）。

- [ ] **步骤 5：删除 buildWorkOrdersFromTaskOrders 及相关函数**

删除以下函数：
- `normalizeWorkOrderPartName`（行 1756）
- `buildWorkOrderKey`（行 1760）
- `buildWorkOrderId`（行 1768）
- `buildWorkOrdersFromTaskOrders`（行 1780-1933）
- `buildSpecialCraftTaskWorkOrders`（行 2028）
- `listSpecialCraftTaskWorkOrders`（行 2039）
- `listSpecialCraftTaskWorkOrderLines`（行 2043）
- `getSpecialCraftTaskWorkOrdersByTaskOrderId`（行 2047）
- `getSpecialCraftTaskWorkOrderLinesByWorkOrderId`（行 2051）
- `getSpecialCraftTaskWorkOrderById`（行 2138）
- `getSpecialCraftTaskWorkOrderLineByDemandLineId`（行 2142）

- [ ] **步骤 6：重写状态变更函数为任务单级**

将 `updateSpecialCraftTaskWorkOrderWebStatus`（行 2173）重写为 `updateSpecialCraftTaskOrderWebStatus`，直接操作 `SpecialCraftTaskOrder`（不再聚合 work orders）。

将 `confirmSpecialCraftWorkOrderReceiptBySku`（行 2055）重写为 `confirmSpecialCraftTaskOrderReceiptBySku`，操作任务单行明细而非 work order 行。

将 `confirmSpecialCraftWorkOrderCompletionBySku`（行 2084）重写为 `confirmSpecialCraftTaskOrderCompletionBySku`。

删除 `syncSpecialCraftTaskOrderAggregatesFromWorkOrders`（行 2149，不再需要聚合）。

- [ ] **步骤 7：修改 ensureStore**

```typescript
function ensureStore(): SpecialCraftTaskStore {
  if (!specialCraftTaskStore) {
    const generatedResults = generateSpecialCraftTaskOrdersForAllProductionOrders([])
    const generatedTaskOrders = generatedResults
      .flatMap((item) => item.taskOrders)
      .map((taskOrder) => normalizeGeneratedTaskOrderForMobile(taskOrder))
    const generationBatches = generatedResults.map((item) => item.generationBatch)
    const generationErrors = generatedResults.flatMap((item) => item.errors)
    const supplementalTaskOrders = buildLinkedSupplementTaskOrders(generatedTaskOrders)
    const taskOrders = [...generatedTaskOrders, ...supplementalTaskOrders]
    ensureSpecialTypeUnifiedWarehouseArtifacts(taskOrders)

    specialCraftTaskStore = {
      taskOrders,
      generationBatches,
      generationErrors,
    }
  }
  return specialCraftTaskStore
}
```

- [ ] **步骤 8：批量重命名**

将文件中所有本地使用（非导出符号）的 work order 相关变量名改为 task order 上下文，确保 `businessType` 字段在任务单构造时被正确赋值。

```bash
npm run build
```

预期：构建失败（其他引用 work orders 的文件尚未更新），但数据层自身类型检查通过。先提交这一阶段作为 checkpoint。

### 任务 1.2：适配所有数据层引用文件

- [ ] **步骤 1：special-craft-operations.ts**

删除 `buildSpecialCraftWorkOrderDetailPath` 函数（行 454-459）。

修改 `buildSpecialCraftWaitProcessWarehousePath` 和 `buildSpecialCraftWaitHandoverWarehousePath` 中的 work-order 引用。如果仓库路径构造函数接收 `item.taskOrderId` 而非 `item.workOrderId`，需要更新参数。

- [ ] **步骤 2：process-web-status-actions.ts**

将联合类型中所有 `'SPECIAL_CRAFT_WORK_ORDER'` 替换为 `'SPECIAL_CRAFT'`（即直接在任务单上操作）。

修改 `getUnifiedOperationRecordsForProcessWorkOrder` 中对应的 sourceType 判断。

- [ ] **步骤 3：process-action-writeback-service.ts**

将 `executeSpecialCraftAction` 中所有 `getSpecialCraftTaskWorkOrderById(sourceId)` 改为 `getSpecialCraftTaskOrderById(sourceId)`。

删除 work order line 相关查询，改为直接从 task order 的 `demandLines` 中获取。

修改生成仓库/交接记录时的 `sourceWorkOrderId` → `sourceTaskOrderId`。

- [ ] **步骤 4：process-warehouse-domain.ts**

全局替换：所有 `sourceWorkOrderId` → `sourceTaskOrderId`。

修改 `getWarehouseRecordsByWorkOrderId` → `getWarehouseRecordsByTaskOrderId`，按 `sourceTaskOrderId` 过滤。

修改 `getHandoverRecordsByWorkOrderId` → `getHandoverRecordsByTaskOrderId`。

修改 `getDifferenceRecordsByWorkOrderId` → `getDifferenceRecordsByTaskOrderId`。

- [ ] **步骤 5：process-warehouse-linkage-service.ts**

将 `getSpecialCraftTaskWorkOrderById(sourceId)` 改为 `getSpecialCraftTaskOrderById(sourceId)`。

将 `getSpecialCraftTaskWorkOrderLinesByWorkOrderId` 改为直接从 task order `demandLines` 读取。

- [ ] **步骤 6：cutting/special-craft-fei-ticket-flow.ts**

将接口和函数中所有 `workOrderId`、`workOrderLineId` 字段改为 `taskOrderId`、`taskOrderLineId`。

修改 `getSpecialCraftFeiTicketFlowEventsByWorkOrderId` → `getSpecialCraftFeiTicketFlowEventsByTaskOrderId`。

- [ ] **步骤 7-10：其余数据文件**

逐文件替换（每个文件约 2-5 处引用）：

```
special-craft-pda-scope.ts:  workOrder → taskOrder
special-craft-pda-warehouse-actions.ts: workOrder → taskOrder
mobile-execution-task-index.ts: SPECIAL_CRAFT_WORK_ORDER → SPECIAL_CRAFT_TASK_ORDER
process-mobile-task-binding.ts: validateSpecialCraftMobileTaskBinding 改参数
platform-process-result-view.ts: buildSpecialCraftView 用 taskOrder
progress-statistics-linkage.ts: workOrderLine 缓存改为 demandLine
process-execution-writeback.ts: workOrder 后备引用改为 taskOrder
factory-internal-warehouse.ts: sourceWorkOrderId → sourceTaskOrderId
```

```bash
npm run build
```

预期：数据层引用全部更新完毕，构建通过。

---

## 阶段 2：Web 页面

### 任务 2.1：重写任务单列表页为标准列表页

**文件：** `src/pages/process-factory/special-craft/task-orders.ts`

- [ ] **步骤 1：顶部声明 + 导入**

文件顶部添加 `// @page-pattern: list`。

新增导入：
```typescript
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  renderStandardListTable,
  renderStandardListColumnSettings,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
```

新增快捷操作相关导入：
```typescript
import {
  executeProcessWebAction,
  getAvailableWebActionsForProcessWorkOrder,
  type ProcessWebAction,
} from '../../../data/fcs/process-web-status-actions.ts'
import {
  openProcessWebStatusActionDialog,
  handleProcessWebStatusActionDialogEvent,
} from '../shared/web-status-action-dialog.ts'
```

- [ ] **步骤 2：定义列**

```typescript
const TASK_ORDER_LIST_PREFS_KEY = 'special-craft-task-orders-v1'

const TASK_ORDER_COLUMNS: StandardListColumn<SpecialCraftTaskOrder>[] = [
  {
    key: 'taskOrderNo',
    title: '加工单号',
    width: 180,
    sortable: true,
    render(row) {
      return `<div class="text-sm font-medium">${escapeHtml(row.taskOrderNo)}</div>
        <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(row.sourceTriggerLabel || '生产单生成')}</div>`
    },
    sortValue: (row) => row.taskOrderNo,
  },
  {
    key: 'productionOrder',
    title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
    width: 140,
    sortable: true,
    render(row) {
      return `${renderProductionOrderIdentityCell(row.productionOrderNo)}
        <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(row.operationName)}</div>`
    },
    sortValue: (row) => row.productionOrderNo,
  },
  {
    key: 'targetObject',
    title: '加工对象',
    width: 140,
    render(row) {
      const parts = [row.targetObject, row.partName, row.fabricColor, row.sizeCode].filter(Boolean)
      return `<div class="text-sm">${escapeHtml(parts.join(' / ') || '—')}</div>
        <div class="mt-0.5 text-xs text-muted-foreground">菲票 ${row.feiTicketNos?.length || 0} 张</div>`
    },
  },
  {
    key: 'factory',
    title: '承接工厂',
    width: 120,
    sortable: true,
    render(row) { return escapeHtml(formatSpecialCraftFactoryLabel(row.factoryName, row.factoryId)) },
    sortValue: (row) => row.factoryName,
  },
  {
    key: 'qtyProgress',
    title: '数量进度',
    width: 160,
    align: 'right',
    render(row) {
      return `<div class="text-sm tabular-nums">计划 ${formatQty(row.planQty)}${row.unit}</div>
        <div class="mt-0.5 text-xs text-muted-foreground tabular-nums">接收 ${formatQty(row.receivedQty)} / 完成 ${formatQty(row.completedQty)} / 待交出 ${formatQty(row.waitHandoverQty)}</div>`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render(row) {
      return `<div class="flex flex-wrap gap-1">${renderStatusBadge(row.status)}${renderStatusBadge(row.abnormalStatus)}</div>`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    actionColumn: true,
    required: true,
    render(row) {
      const detailHref = buildSpecialCraftTaskDetailPath(
        { operationId: row.operationId, operationName: row.operationName, managementDomain: row.managementDomain },
        row.taskOrderId,
      )
      const actions = getAvailableWebActionsForProcessWorkOrder('SPECIAL_CRAFT', row.taskOrderId)
        .filter((a) => !a.disabledReason)
      const quickActionButtons = actions.length
        ? actions.map((a) => `<button type="button" class="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100"
            data-special-craft-task-action="quick-action"
            data-task-id="${escapeHtml(row.taskOrderId)}"
            data-action-code="${escapeHtml(a.actionCode)}">${escapeHtml(a.actionLabel)}</button>`).join('')
        : ''
      return `<div class="flex items-center gap-1">
        ${quickActionButtons}
        <button type="button" class="rounded border px-1.5 py-0.5 text-[11px] hover:bg-slate-50" data-nav="${escapeHtml(detailHref)}">详情</button>
      </div>`
    },
  },
]
```

- [ ] **步骤 3：偏好管理函数**

```typescript
function loadPrefs(): StandardListColumnPreferences {
  const key = `${TASK_ORDER_LIST_PREFS_KEY}:${window.location.pathname}`
  return loadListColumnPreferences(key) as StandardListColumnPreferences
}

function savePrefs(prefs: StandardListColumnPreferences): void {
  const key = `${TASK_ORDER_LIST_PREFS_KEY}:${window.location.pathname}`
  saveListColumnPreferences(key, prefs)
}
```

- [ ] **步骤 4：筛选器渲染**

保留现有筛选器逻辑（行 314-367），适配为标准列表页格式。

- [ ] **步骤 5：主渲染函数改造**

```typescript
function renderStandardList(prefs: StandardListColumnPreferences, sort: StandardListSortState | null, slice: StandardListPageSlice): string {
  return renderStandardListPage({
    title: `${operation.operationName}加工单`,
    filtersHtml: renderFilters(state),
    statsHtml: renderStats(taskOrders),
    listTitle: '加工单列表',
    tableHtml: renderStandardListTable({
      columns: TASK_ORDER_COLUMNS,
      rows: slice.items,
      preferences: prefs,
      sort,
      eventPrefix: 'special-craft-task-list',
      emptyText: '暂无加工单',
    }),
    paginationHtml: renderTablePagination(slice),
    overlaysHtml: renderStandardListColumnSettings({
      title: '列显示设置',
      columns: TASK_ORDER_COLUMNS,
      preferences: prefs,
      eventPrefix: 'special-craft-task-list',
      maxFrozenWidth: 360,
    }),
  })
}
```

- [ ] **步骤 6：事件处理**

添加 `handleTaskOrdersEvent` 函数，处理：
1. `data-special-craft-task-action="quick-action"` → 弹出 Web 状态操作对话框
2. 列偏好事件（`data-special-craft-task-list-*`）
3. 排序事件
4. 分页事件

```bash
npm run build
```

### 任务 2.2：改造任务详情页（嵌入操作面板）

**文件：** `src/pages/process-factory/special-craft/task-detail.ts`

- [ ] **步骤 1：修改 Tab 定义**

删除 `work-orders` Tab。Tab 列表改为：

```typescript
const specialCraftTaskDetailTabs: Array<{ key: SpecialCraftTaskDetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'demand', label: '任务明细' },
  { key: 'warehouse', label: '仓库流转' },
  { key: 'exceptions', label: '差异异常' },
  { key: 'events', label: '节点记录' },
]
```

类型改为：`type SpecialCraftTaskDetailTab = 'overview' | 'demand' | 'warehouse' | 'exceptions' | 'events'`

- [ ] **步骤 2：删除子加工单表格渲染**

移除 `workOrderRows` 变量（行 248-267）和 tabs 中的 `work-orders` 分支。

- [ ] **步骤 3：嵌入操作面板**

在 `renderSpecialCraftTaskDetailPage` 函数中，从 `work-order-detail.ts` 复制/导入操作面板相关代码：

1. 导入 `getFastSpecialCraftWebActions` 和 `renderWebActionPanel`（从 work-order-detail.ts 移入 shared.ts）
2. 在任务详情页右侧添加操作面板（`renderWebActionPanel`）

```typescript
// 在 task-detail.ts 的 aside 中替换为：
const webActions = getFastSpecialCraftWebActions(taskOrder.status, targetObject)
const taskOrderQty = taskOrder.currentQty || taskOrder.planQty || 1
const actionPanel = renderWebActionPanel(taskOrder.taskOrderId, taskOrder.status, webActions, taskOrderQty, {
  objectType: targetObject as '裁片' | '成衣' | '面料',
  objectLabel: targetObject === '成衣' ? '成衣' : '裁片',
  qtyUnit: taskOrder.unit,
  targetLabel: targetObject,
  feiTicketText: taskOrder.feiTicketNos?.[0] || '成衣无需菲票',
  qtyRule: targetObject === '成衣' ? '按 SKU 件数汇总' : '按裁片数量统计',
})
```

- [ ] **步骤 4：导入 work-order-detail 的实用函数到 shared.ts**

将以下函数从 `work-order-detail.ts` 移到 `shared.ts`：
- `getFastSpecialCraftWebActions`
- `renderWebActionPanel`
- `resolveWorkOrderObjectMeta` 改名为 `resolveTaskOrderObjectMeta`
- `localizeSpecialCraftActionText`
- `localizeSpecialCraftActionFields`
- `showSpecialCraftToast`

- [ ] **步骤 5：更新 imports**

```typescript
// task-detail.ts 新增
import {
  getFastSpecialCraftWebActions,
  renderWebActionPanel,
  resolveTaskOrderObjectMeta,
} from './shared.ts'
import { handleProcessWebStatusActionDialogEvent, openProcessWebStatusActionDialog } from '../shared/web-status-action-dialog.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
```

- [ ] **步骤 6：处理操作事件**

在 `handleSpecialCraftTaskDetailEvent` 函数中接入 Web 操作事件。

### 任务 2.3：删除加工单详情页 + 路由重定向

**文件：** `src/router/routes-fcs.ts`, `src/router/route-renderers-fcs.ts`, `src/main-handlers/fcs-handlers.ts`

- [ ] **步骤 1：删除 work-order-detail.ts 文件**

```bash
rm src/pages/process-factory/special-craft/work-order-detail.ts
```

- [ ] **步骤 2：路由改为重定向**

在 `routes-fcs.ts` 中，将 work-orders 详情路由改为重定向：

```typescript
// 原来（行 524-525）：
pattern: /^\/fcs\/process-factory\/special-craft\/([^/]+)\/work-orders\/([^/]+)$/,
render: (match) => renderSpecialCraftWorkOrderDetailPage(match[1], decodeURIComponent(match[2])),

// 改为：
pattern: /^\/fcs\/process-factory\/special-craft\/([^/]+)\/work-orders\/([^/]+)$/,
render: (match) => {
  const workOrderId = decodeURIComponent(match[2])
  // 通过 workOrderId 反查 taskOrderId，构造重定向 URL
  // 临时方案：取 workOrderId 中 taskOrderId 前缀部分（格式: {taskOrderId}-WO-{index}-{partName}）
  const taskOrderId = workOrderId.replace(/-WO-\d{3}-.*$/, '')
  const slug = match[1]
  return `<script>window.location.href = '/fcs/process-factory/special-craft/${encodeURIComponent(slug)}/tasks/${encodeURIComponent(taskOrderId)}'</script>`
},
```

或者更简单：在 store 中保留 `workOrderId → taskOrderId` 的映射表用于重定向，在 `ensureStore` 时构建。

- [ ] **步骤 3：删除 route-renderers 中的引用**

在 `route-renderers-fcs.ts` 中删除 `renderSpecialCraftWorkOrderDetailPage` 的导入和导出。

- [ ] **步骤 4：删除 fcs-handlers.ts 中的引用**

删除 `import { handleSpecialCraftWorkOrderDetailEvent }` 和对应的调用行（行 215、376）。

### 任务 2.4：更新 warehouse.ts

**文件：** `src/pages/process-factory/special-craft/warehouse.ts`

将仓库页中"查看加工单"按钮的跳转链接从 `buildSpecialCraftWorkOrderDetailPath` 改为 `buildSpecialCraftTaskDetailPath`。

### 任务 2.5：重编译验证

```bash
npm run build
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
```

预期：全部通过。

---

## 阶段 3：PDA 端

### 任务 3.1：适配 PDA 执行页面

**文件：** `src/pages/pda-exec-detail.ts`

- [ ] **步骤 1：重写 resolveSpecialCraftWorkOrderInfo**

将 `resolveSpecialCraftWorkOrderInfo` 重写为 `resolveSpecialCraftTaskInfo`，通过 taskOrderId 查询而非 workOrderId：

```typescript
function resolveSpecialCraftTaskInfo(input: { sourceType: string; sourceInfo: PdaSourceInfo }): {
  task: SpecialCraftTaskOrder | undefined
  taskId: string
} {
  const taskId = input.sourceInfo.sourceTaskOrderId || input.sourceInfo.sourceId
  const task = getSpecialCraftTaskOrderById(taskId)
  return { task, taskId }
}
```

- [ ] **步骤 2：全局替换**

搜索所有 `specialCraftWorkOrder`、`specialWorkOrder`、`workOrderId` 引用（在特殊工艺执行上下文中的），替换为 task order 对应物。关键的几处：

- 行 2485: `getSpecialCraftTaskWorkOrderLinesByWorkOrderId` → 用 `task.demandLines`
- 行 6438: `getSpecialCraftGarmentSkuDrafts(specialCraftWorkOrder.workOrderId)` → `getSpecialCraftGarmentSkuDrafts(specialCraftWorkOrder.taskOrderId)`
- 行 6269: `specialWorkOrder?.workOrderId` → `task?.taskOrderId`

- [ ] **步骤 3：sourceType 从 WORK_ORDER 改为 TASK_ORDER**

```typescript
// PDA 执行动作中的 sourceType 全部改为：
sourceType: 'SPECIAL_CRAFT_TASK_ORDER'
// 或直接使用 'SPECIAL_CRAFT'（与 Web 端统一）
```

### 任务 3.2：适配 PDA 仓库页面

**文件：** `src/pages/pda-warehouse-wait-process.ts`、`src/pages/pda-warehouse-wait-handover.ts`

- [ ] **步骤 1：data-work-order-id → data-task-order-id**

全局替换 `data-work-order-id` 为 `data-task-order-id`。

- [ ] **步骤 2：对应的事件处理函数修改**

在对应的事件处理器中，将 `action.dataset.workOrderId` 改为 `action.dataset.taskOrderId`。

### 任务 3.3：适配移动端任务绑定

**文件：** `src/data/fcs/process-mobile-task-binding.ts`

- [ ] **步骤 1：validateSpecialCraftMobileTaskBinding**

参数从 `workOrderId: string` 改为 `taskOrderId: string`，内部调用 `getSpecialCraftTaskOrderById(taskOrderId)` 获取任务单。

- [ ] **步骤 2：mobile-execution-task-index.ts**

将 `sourceType` 从 `'SPECIAL_CRAFT_WORK_ORDER'` 改为 `'SPECIAL_CRAFT'`。

```bash
npm run build
```

---

## 阶段 4：脚本和测试

### 任务 4.1：更新所有脚本文件

**涉及文件：** 见文件结构表（13 个脚本文件）

每个脚本的修改模式相同：
1. 将 `import { getSpecialCraftTaskWorkOrderById, listSpecialCraftTaskWorkOrders, ... }` 的导入改为 `import { getSpecialCraftTaskOrderById, getSpecialCraftTaskOrders, ... }`
2. 将 `const workOrder = getSpecialCraftTaskWorkOrderById(id)` 改为 `const taskOrder = getSpecialCraftTaskOrderById(id)`
3. 将 `work-orders/{workOrderId}` 路由引用改为 `tasks/{taskOrderId}`
4. 将 `'SPECIAL_CRAFT_WORK_ORDER'` 字符串改为 `'SPECIAL_CRAFT'`

逐个脚本执行，每修复一个就运行该脚本确认不报错。

```bash
# 逐个运行，修复后再运行下一个
node --experimental-strip-types scripts/check-heat-transfer-and-print-dye-contract.ts
node --experimental-strip-types scripts/check-special-craft-pda-warehouse-actions.ts
...
```

### 任务 4.2：更新所有测试文件

**涉及文件：** 见文件结构表（6 个测试文件）

修改模式：
1. 将硬编码的 workOrderId 改为 taskOrderId
2. 将 `work-orders/{id}` 路由导航改为 `tasks/{id}`
3. 将 `getSpecialCraftTaskWorkOrderById` 调用改为 `getSpecialCraftTaskOrderById`

```bash
npm run build
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
```

### 任务 4.3：更新文档

**文件：** 
- `docs/superpowers/plans/2026-07-22-heat-transfer-and-print-dye-cleanup-implementation.md`
- `docs/fcs-process-mobile-task-binding.md`
- `docs/prototype-review-records/2026-07-22-heat-transfer-and-print-dye-cleanup.md`

更新所有对 work-orders 路由和 work-order-detail.ts 的引用。

### 任务 4.4：删除标准列表页基线中的旧哈希

运行 `npm run check:list-page-governance`，如果原 `task-orders.ts` 在基线中，移除其基线条目（因为页面已重写为标准列表页）。

```bash
npm run check:list-page-governance
```

---

## 自检

1. **规格覆盖度**：设计文档中所有 4 个阶段均有对应任务。✓
2. **占位符扫描**：无 TODO/TBD。所有步骤均有具体代码或操作指令。✓
3. **类型一致性**：`SpecialCraftTaskOrder` 在数据层修改后，所有引用点（页面、PDA、脚本）均使用新字段名（如 `scrapQty` 替代了原来的 `lossQty`）。✓
