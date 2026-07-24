# 特殊工艺加工单简化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除"上报差异""差异后重交"及所有差异/异常相关代码，加工单精简为 4 个操作（确认接收、加工填报、发起交出、完成加工单），状态从 11 个缩减为 3 个。

**架构：** 自底向上分层修改：数据模型 → 写回服务 → 仓库联动 → 状态映射 → 前端动作 → 页面视图 → PDA。

**技术栈：** TypeScript, Vanilla string template rendering, Tailwind CSS

**设计规格：** `docs/superpowers/specs/2026-07-24-special-craft-work-order-simplification-design.md`

---

## 防遗漏机制

1. **逐文件任务覆盖**：设计规格第五章列出 13 个文件，每个文件至少一个任务
2. **grep 验证**：每个删除操作后，用 `grep` 搜索被删除的 actionCode / 状态值 / 类型名，确保无残留引用
3. **TypeScript 编译**：每完成一组文件修改后运行 `npm run build` 确保无类型错误
4. **任务间引用检查**：每步完成后检查后续任务依赖的文件/类型是否已更新

---

## 任务 1：精简数据模型

**文件：** `src/data/fcs/special-craft-task-orders.ts`

### 步骤 1.1：删除 `SpecialCraftTaskAbnormalRecord` 接口

- [ ] 删除第 192-203 行整个接口定义

### 步骤 1.2：精简 `SpecialCraftTaskStatus` 类型

- [ ] 第 46-57 行，将 11 个状态值替换为 3 个：

```typescript
export type SpecialCraftTaskStatus =
  | '待领料'
  | '加工中'
  | '已完结'
```

### 步骤 1.3：精简 `SpecialCraftTaskExecutionStatus` 类型（如不需要则删除）

- [ ] 第 71-82 行，检查是否被外部引用。如仅内部使用则删除，否则精简为：

```typescript
export type SpecialCraftTaskExecutionStatus =
  | 'WAIT_PICKUP'
  | 'PROCESSING'
  | 'COMPLETED'
```

### 步骤 1.4：精简 `SpecialCraftTaskAbnormalStatus` 类型

- [ ] 第 59-67 行，删除所有异常值，仅保留占位：

```typescript
export type SpecialCraftTaskAbnormalStatus = '无异常'
```

### 步骤 1.5：更新 `SpecialCraftTaskOrder` 接口

- [ ] 在 `SpecialCraftTaskOrder` 中（第 205-281 行）：
  - 删除字段 `abnormalRecords`（第 279 行）
  - 删除字段 `openDifferenceReportCount`（第 267 行）
  - 删除字段 `openObjectionCount`（第 268 行）
  - 新增字段 `writebackQty: number`（在 `returnedQty` 之后）

### 步骤 1.6：更新 `SpecialCraftTaskWarehouseLink.status`

- [ ] 第 189 行，`status` 类型删除 `'差异' | '异议中'`：

```typescript
status: '已入库' | '待交出' | '已出库' | '已回写'
```

### 步骤 1.7：修复 Seed 数据中的旧状态引用

- [ ] 搜索 `special-craft-task-orders.ts` 中所有 `status: '` 赋值，更新为 3 个新状态值
- [ ] 搜索 `abnormalRecords:` 引用，删除或设为 `[]`

运行验证：
```bash
grep -n "差异\|异议\|异常\|已接收\|已入待加工仓\|已完成\|待交出\|已交出\|已回写" src/data/fcs/special-craft-task-orders.ts | grep -v "//\|import\|comment\|异常\|abnormalStatus"
```

预期：仅保留 `abnormalStatus` 字段本身的类型定义和 `无异常` 值，其余全部消失。

### 步骤 1.8：Commit

```bash
git add src/data/fcs/special-craft-task-orders.ts
git commit -m "refactor: 精简特殊工艺状态模型为3状态，删除差异/异常数据模型"
```

---

## 任务 2：清理写回服务

**文件：** `src/data/fcs/process-action-writeback-service.ts`

### 步骤 2.1：删除差异/重交 action 定义

- [ ] 删除 `SPECIAL_CRAFT_REPORT_DIFFERENCE` 定义（第 538-548 行）
- [ ] 删除 `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 定义（第 560-568 行）

### 步骤 2.2：修改现有 action 定义

- [ ] `SPECIAL_CRAFT_FINISH_PROCESS` → `SPECIAL_CRAFT_PROCESS_REPORT`：

```typescript
{
    actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
    actionLabel: '加工填报',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['加工中'],
    toStatus: '加工中',
    requiredFields: ['操作人', '填报时间'],
    writebackHandler: 'executeSpecialCraftAction.updateSpecialCraftTaskOrderWebStatus',
},
```

- [ ] `SPECIAL_CRAFT_SUBMIT_HANDOVER`：修改 `fromStatuses` 和 `toStatus`：

```typescript
{
    actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
    actionLabel: '发起交出',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['加工中'],
    toStatus: '加工中',
    requiredFields: ['交出人', '交出时间'],
    optionalFields: ['备注'],
    writebackHandler: 'executeSpecialCraftAction.createProcessHandoverRecord',
    affectsHandover: true,
},
```

### 步骤 2.3：新增 `SPECIAL_CRAFT_COMPLETE_ORDER` 定义

- [ ] 在 `SPECIAL_CRAFT_SUBMIT_HANDOVER` 之后插入：

```typescript
{
    actionCode: 'SPECIAL_CRAFT_COMPLETE_ORDER',
    actionLabel: '完成加工单',
    sourceType: 'SPECIAL_CRAFT',
    fromStatuses: ['加工中'],
    toStatus: '已完结',
    requiredFields: ['操作人', '完成时间'],
    writebackHandler: 'executeSpecialCraftAction.updateSpecialCraftTaskOrderWebStatus',
},
```

### 步骤 2.4：修改 `SPECIAL_CRAFT_CONFIRM_RECEIVE` 定义

- [ ] 确认接收的 `fromStatuses` 改为 `['待领料', '加工中']`，`toStatus` 改为 `'加工中'`

### 步骤 2.5：删除差异写回 handler 逻辑

- [ ] 第 1160-1260 行区间：删除 `SPECIAL_CRAFT_REPORT_DIFFERENCE` 相关的 handler 分支代码
- [ ] 删除 `createProcessHandoverDifferenceRecord` 调用（行 1247-1259）
- [ ] 删除 `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 相关的 handler 分支

运行验证：
```bash
grep -n "SPECIAL_CRAFT_REPORT_DIFFERENCE\|SPECIAL_CRAFT_REWORK_AFTER_REJECT\|SPECIAL_CRAFT_FINISH_PROCESS\|REPORT_SPECIAL_DIFFERENCE" src/data/fcs/process-action-writeback-service.ts
```

预期：`SPECIAL_CRAFT_FINISH_PROCESS` 已全部替换为 `SPECIAL_CRAFT_PROCESS_REPORT`，差异相关全部消失。

### 步骤 2.6：Commit

```bash
git add src/data/fcs/process-action-writeback-service.ts
git commit -m "refactor: 清理写回服务中差异/重交action，新增加工填报和完成加工单"
```

---

## 任务 3：清理仓库联动服务

**文件：** `src/data/fcs/process-warehouse-linkage-service.ts`

### 步骤 3.1：删除差异联动逻辑

- [ ] 搜索并删除 `SPECIAL_CRAFT_REPORT_DIFFERENCE` 分支（行 852 附近）
- [ ] 搜索并删除 `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 分支
- [ ] 修改 `SPECIAL_CRAFT_FINISH_PROCESS` → `SPECIAL_CRAFT_PROCESS_REPORT`

运行验证：
```bash
grep -n "SPECIAL_CRAFT_REPORT_DIFFERENCE\|SPECIAL_CRAFT_REWORK_AFTER_REJECT\|SPECIAL_CRAFT_FINISH_PROCESS" src/data/fcs/process-warehouse-linkage-service.ts
```

预期：无匹配行。

### 步骤 3.2：Commit

```bash
git add src/data/fcs/process-warehouse-linkage-service.ts
git commit -m "refactor: 清理仓库联动服务中差异/重交逻辑"
```

---

## 任务 4：清理 Web 状态动作映射

**文件：** `src/data/fcs/process-web-status-actions.ts`

### 步骤 4.1：删除差异/重交映射

- [ ] 删除 `SPECIAL_CRAFT_REPORT_DIFFERENCE` 条目（第 493 行附近）
- [ ] 删除 `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 条目（第 515 行附近）
- [ ] 修改 `SPECIAL_CRAFT_FINISH_PROCESS` → `SPECIAL_CRAFT_PROCESS_REPORT`

运行验证：
```bash
grep -n "SPECIAL_CRAFT_REPORT_DIFFERENCE\|SPECIAL_CRAFT_REWORK_AFTER_REJECT\|SPECIAL_CRAFT_FINISH_PROCESS" src/data/fcs/process-web-status-actions.ts
```

预期：无匹配行（`SPECIAL_CRAFT_FINISH_PROCESS` 全部替换为 `SPECIAL_CRAFT_PROCESS_REPORT`）。

### 步骤 4.2：Commit

```bash
git add src/data/fcs/process-web-status-actions.ts
git commit -m "refactor: 清理Web状态动作映射中差异/重交条目"
```

---

## 任务 5：清理菲票流转服务

**文件：** `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`

### 步骤 5.1：删除差异同步逻辑

- [ ] 搜索 `SPECIAL_CRAFT_REPORT_DIFFERENCE` / `REWORK_AFTER_REJECT` / `差异` / `异常` 相关代码并删除

运行验证：
```bash
grep -n "差异\|exception\|abnormal\|REPORT_DIFFERENCE\|REWORK_AFTER_REJECT" src/data/fcs/cutting/special-craft-fei-ticket-flow.ts
```

预期：无匹配行（或仅保留注释说明）。

### 步骤 5.2：Commit

```bash
git add src/data/fcs/cutting/special-craft-fei-ticket-flow.ts
git commit -m "refactor: 清理菲票流转中差异同步逻辑"
```

---

## 任务 6：重写前端动作定义

**文件：** `src/pages/process-factory/special-craft/shared.ts`

### 步骤 6.1：重写 `getFastSpecialCraftWebActions` 函数

- [ ] 第 223-296 行，完整替换为 4 个动作定义：

```typescript
export function getFastSpecialCraftWebActions(taskOrder: SpecialCraftTaskOrder): ProcessWebAction[] {
  const status = taskOrder.status
  const actionDefs: Array<{
    actionCode: string
    actionLabel: string
    fromStatuses: string[]
    toStatus: string
    requiredFields: string[]
    optionalFields?: string[]
  }> = [
    {
      actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
      actionLabel: '确认接收',
      fromStatuses: ['待领料', '加工中'],
      toStatus: '加工中',
      requiredFields: ['接收人', '接收时间'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
      actionLabel: '加工填报',
      fromStatuses: ['加工中'],
      toStatus: '加工中',
      requiredFields: ['操作人', '填报时间'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      actionLabel: '发起交出',
      fromStatuses: ['加工中'],
      toStatus: '加工中',
      requiredFields: ['交出人', '交出时间'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_COMPLETE_ORDER',
      actionLabel: '完成加工单',
      fromStatuses: ['加工中'],
      toStatus: '已完结',
      requiredFields: ['操作人', '完成时间'],
    },
  ]

  const matched = actionDefs.filter((def) => def.fromStatuses.includes(status))

  return matched.map((def) => ({
    actionCode: def.actionCode,
    actionLabel: def.actionLabel as ProcessWebAction['actionLabel'],
    processType: 'SPECIAL_CRAFT' as const,
    fromStatus: status,
    toStatus: def.toStatus,
    requiredFields: def.requiredFields,
    optionalFields: def.optionalFields || [],
    confirmText: `确认${def.actionLabel}`,
    disabledReason: matched.length ? undefined : '当前状态暂无可执行动作',
    writebackHandler: '',
    affectsWarehouse: false,
    affectsHandover: false,
    affectsReview: false,
    affectsDifference: false,
    affectsPlatformStatus: false,
  }))
}
```

### 步骤 6.2：清理 `renderStatusBadge` 中的差异/异常 tone

- [ ] 第 45-57 行，删除差异/异议/异常的 red tone 分支：

```typescript
export function renderStatusBadge(label: string): string {
  const tone =
    label.includes('差异') || label.includes('异议') || label.includes('异常')
      ? 'red'
      : label.includes('待领料')
        ? 'amber'
        : label.includes('加工中')
          ? 'blue'
          : label.includes('已完结')
            ? 'green'
            : 'slate'
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(tone)}">${escapeHtml(label)}</span>`
}
```

### 步骤 6.3：扩展 `renderGarmentSkuConfirmDialog` 支持多操作类型

- [ ] 第 353-406 行，重写参数和表头以支持不同操作：

```typescript
export function renderGarmentSkuConfirmDialog(
  taskOrderId: string,
  actionCode: string,
  title: string,
  confirmLabel: string,
  demandLines: Array<{ colorName: string; sizeCode: string; planPieceQty: number; skuCode: string }>,
  options: {
    showReceived?: boolean       // 确认接收
    showCompleted?: boolean      // 加工填报
    showHandover?: boolean       // 发起交出
    showWriteback?: boolean      // 完成加工单（裁片）
    readonly?: boolean           // 完成加工单
    receivedQtyBySku?: Record<string, number>
    completedQtyBySku?: Record<string, number>
    handedOverQtyBySku?: Record<string, number>
    writebackQtyBySku?: Record<string, number>
  },
): string {
  const skuRows = new Map<string, {
    colorName: string; sizeCode: string; planQty: number
    receivedQty: number; completedQty: number; handedOverQty: number; writebackQty: number
  }>()
  demandLines.forEach((line) => {
    const key = `${line.colorName}::${line.sizeCode}`
    const existing = skuRows.get(key)
    if (existing) {
      existing.planQty += line.planPieceQty
    } else {
      const skuCode = line.skuCode
      skuRows.set(key, {
        colorName: line.colorName, sizeCode: line.sizeCode, planQty: line.planPieceQty,
        receivedQty: options.receivedQtyBySku?.[skuCode] ?? line.planPieceQty,
        completedQty: options.completedQtyBySku?.[skuCode] ?? (options.receivedQtyBySku?.[skuCode] ?? line.planPieceQty),
        handedOverQty: options.handedOverQtyBySku?.[skuCode] ?? (options.completedQtyBySku?.[skuCode] ?? options.receivedQtyBySku?.[skuCode] ?? line.planPieceQty),
        writebackQty: options.writebackQtyBySku?.[skuCode] ?? 0,
      })
    }
  })

  const readonlyAttr = options.readonly ? 'disabled' : ''

  const headerCells = ['颜色', '尺码', '计划件数']
  if (options.showReceived) headerCells.push('实收件数')
  if (options.showCompleted) headerCells.push('完工件数')
  if (options.showHandover) headerCells.push('交出件数')
  if (options.showWriteback) headerCells.push('回写件数')

  const tbody = [...skuRows.entries()].map(([key, row]) => {
    const safeKey = key.replace(/[^A-Za-z0-9]/g, '-')
    let cells = `<td class="px-3 py-2 text-sm">${escapeHtml(row.colorName)}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(row.sizeCode)}</td>
      <td class="px-3 py-2 text-right text-sm tabular-nums">${formatQty(row.planQty)}</td>`
    if (options.showReceived) cells += `<td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="sku-qty-${safeKey}" value="${row.receivedQty}" min="0" max="${row.planQty}" ${readonlyAttr} /></td>`
    if (options.showCompleted) cells += `<td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="sku-completed-${safeKey}" value="${row.completedQty}" min="0" max="${row.receivedQty}" ${readonlyAttr} /></td>`
    if (options.showHandover) cells += `<td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="sku-handover-${safeKey}" value="${row.handedOverQty}" min="0" max="${row.completedQty}" ${readonlyAttr} /></td>`
    if (options.showWriteback) cells += `<td class="px-3 py-2 text-right text-sm tabular-nums">${formatQty(row.writebackQty)}</td>`
    return `<tr>${cells}</tr>`
  }).join('')

  return `
    <div id="special-craft-garment-sku-dialog" class="fixed inset-0 z-[150] flex items-center justify-center bg-black/40">
      <div class="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl">
        <h3 class="mb-4 text-base font-semibold">${escapeHtml(title)}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted-foreground">
              <tr>${headerCells.map((h) => `<th class="px-3 py-2 text-${h === '颜色' || h === '尺码' ? 'left' : 'right'} text-xs font-medium">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" onclick="document.getElementById('special-craft-garment-sku-dialog')?.remove()">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-special-craft-sku-confirm="submit" data-task-id="${escapeHtml(taskOrderId)}" data-action-code="${escapeHtml(actionCode)}">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    </div>
  `
}
```

### 步骤 6.4：扩展 `renderCutPieceFeiTicketConfirmDialog` 支持多操作类型

- [ ] 第 408-445 行，类似步骤 6.3，增加 `options` 参数支持多列

### 步骤 6.5：Commit

```bash
git add src/pages/process-factory/special-craft/shared.ts
git commit -m "feat: 重写特殊工艺前端动作为4操作，扩展弹窗支持多操作类型"
```

---

## 任务 7：重写详情页

**文件：** `src/pages/process-factory/special-craft/task-detail.ts`

### 步骤 7.1：删除 Tabs 中的"差异异常"

- [ ] 第 36-42 行，`specialCraftTaskDetailTabs` 数组删除 `{ key: 'exceptions', label: '差异异常' }`
- [ ] `SpecialCraftTaskDetailTab` 类型（第 34 行）删除 `'exceptions'`：

```typescript
type SpecialCraftTaskDetailTab = 'overview' | 'demand' | 'warehouse' | 'events'
```

### 步骤 7.2：删除异常相关表格渲染

- [ ] 删除 `abnormalRows` 变量（第 215-229 行）
- [ ] 删除 `differenceRows` 变量（第 264-277 行）
- [ ] 删除 `sections['exceptions']` 块（第 345-360 行）

### 步骤 7.3：清理基本信息中的异常字段显示

- [ ] 第 148 行：删除或替换 `{ label: '异常状态', value: renderStatusBadge(taskOrder.abnormalStatus) }`

### 步骤 7.4：更新右侧操作面板摘要

- [ ] 第 399-404 行：更新数量摘要卡片，删除"已交出"行，增加"已完结"标识：

```typescript
${renderWebActionPanel(taskOrder.taskOrderId, taskOrder.status, webActions, taskOrderQty, objectMeta)}
<div class="grid gap-2 border-t pt-3 text-sm">
  <div class="flex justify-between gap-3"><span class="text-muted-foreground">计划数量</span><span class="font-medium">${formatQty(taskOrder.planQty)} ${escapeHtml(taskOrder.unit)}</span></div>
  <div class="flex justify-between gap-3"><span class="text-muted-foreground">已接收</span><span class="font-medium">${formatQty(taskOrder.receivedQty)} ${escapeHtml(taskOrder.unit)}</span></div>
  <div class="flex justify-between gap-3"><span class="text-muted-foreground">已完工</span><span class="font-medium">${formatQty(taskOrder.completedQty)} ${escapeHtml(taskOrder.unit)}</span></div>
  <div class="flex justify-between gap-3"><span class="text-muted-foreground">已交出</span><span class="font-medium">${formatQty(taskOrder.returnedQty || 0)} ${escapeHtml(taskOrder.unit)}</span></div>
</div>
```

### 步骤 7.5：重写操作弹窗调度逻辑

- [ ] 第 462-510 行：重写 `handleSpecialCraftTaskDetailEvent` 中的弹窗调度：

```typescript
const isCustomDialog = actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE'
  || actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT'
  || actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER'
  || actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER'

if (isCustomDialog) {
  const isGarment = taskOrder.targetObject === '成衣'
  const lines = taskOrder.demandLines || []

  if (isGarment) {
    const titleMap: Record<string, string> = {
      'SPECIAL_CRAFT_CONFIRM_RECEIVE': '确认接收 - 逐 SKU 确认实收件数',
      'SPECIAL_CRAFT_PROCESS_REPORT': '加工填报 - 逐 SKU 确认完工件数',
      'SPECIAL_CRAFT_SUBMIT_HANDOVER': '发起交出 - 逐 SKU 确认交出件数',
      'SPECIAL_CRAFT_COMPLETE_ORDER': '完成加工单 - 确认汇总数',
    }
    const readonly = actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER'
    const dialogHtml = renderGarmentSkuConfirmDialog(sourceId, actionCode,
      titleMap[actionCode] || '', actionCode === 'SPECIAL_CRAFT_COMPLETE_ORDER' ? '确认完成' : '确认',
      lines, {
        showReceived: actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
        showCompleted: actionCode === 'SPECIAL_CRAFT_PROCESS_REPORT' || readonly,
        showHandover: actionCode === 'SPECIAL_CRAFT_SUBMIT_HANDOVER' || readonly,
        readonly,
      })
    document.body.insertAdjacentHTML('beforeend', dialogHtml)
  } else {
    // 裁片菲票：类似逻辑，使用 renderCutPieceFeiTicketConfirmDialog
    const titleMap: Record<string, string> = {
      'SPECIAL_CRAFT_CONFIRM_RECEIVE': '确认接收 - 逐菲票确认实收数量',
      'SPECIAL_CRAFT_PROCESS_REPORT': '加工填报 - 逐菲票确认完工数量',
      'SPECIAL_CRAFT_SUBMIT_HANDOVER': '发起交出 - 逐菲票确认交出数量',
      'SPECIAL_CRAFT_COMPLETE_ORDER': '完成加工单 - 确认汇总数',
    }
    // ... 菲票分组逻辑（复用现有） + renderCutPieceFeiTicketConfirmDialog
  }
  return true
}

// 删除通用对话框 fallback 路径（原 507-509 行的差异/重交通用对话框）
```

### 步骤 7.6：更新仓库流转 Tab 表头

- [ ] 第 327-341 行：删除"差异 / 异议"列（第 337 行）

### 步骤 7.7：Commit

```bash
git add src/pages/process-factory/special-craft/task-detail.ts
git commit -m "feat: 重写特殊工艺详情页为4操作，删除差异异常Tab"
```

---

## 任务 8：更新列表页

**文件：** `src/pages/process-factory/special-craft/task-orders.ts`

### 步骤 8.1：更新状态筛选选项

- [ ] 第 66-74 行，替换 `TASK_STATUS_OPTIONS`：

```typescript
const TASK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '全部', label: '全部任务' },
  { value: '待领料', label: '待领料' },
  { value: '加工中', label: '加工中' },
  { value: '已完结', label: '已完结' },
]
```

### 步骤 8.2：更新统计卡片

- [ ] 第 338-346 行，`renderStats` 函数替换：

```typescript
function renderStats(taskOrders: SpecialCraftTaskOrder[]): string {
  return renderStandardListStats([
    { label: '加工单数', value: String(taskOrders.length) },
    { label: '待领料', value: String(taskOrders.filter((t) => t.status === '待领料').length) },
    { label: '加工中', value: String(taskOrders.filter((t) => t.status === '加工中').length) },
    { label: '已完结', value: String(taskOrders.filter((t) => t.status === '已完结').length) },
  ])
}
```

### 步骤 8.3：清理异常状态徽章

- [ ] 第 157-159 行：删除 `abnormalStatus` 的判断逻辑，仅显示主状态

### 步骤 8.4：Commit

```bash
git add src/pages/process-factory/special-craft/task-orders.ts
git commit -m "feat: 更新特殊工艺列表页状态筛选和统计卡片"
```

---

## 任务 9：清理 PDA 端文件

### 步骤 9.1：`src/pages/pda-exec-detail.ts`

- [ ] 搜索 `SPECIAL_CRAFT_REPORT_DIFFERENCE` / `SPECIAL_CRAFT_REWORK_AFTER_REJECT` / `差异` 相关代码并删除
- [ ] 更新 actionCode 映射为 4 操作

### 步骤 9.2：`src/data/fcs/special-craft-pda-warehouse-actions.ts`

- [ ] 删除差异相关动作定义

### 步骤 9.3：`src/data/fcs/special-craft-pda-scope.ts`

- [ ] 更新操作范围定义

### 步骤 9.4：Commit

```bash
git add src/pages/pda-exec-detail.ts src/data/fcs/special-craft-pda-warehouse-actions.ts src/data/fcs/special-craft-pda-scope.ts
git commit -m "refactor: 清理PDA端差异/重交操作"
```

---

## 任务 10：全局 grep 验证 + 构建

### 步骤 10.1：全局搜索残留引用

```bash
grep -rn "SPECIAL_CRAFT_REPORT_DIFFERENCE\|SPECIAL_CRAFT_REWORK_AFTER_REJECT\|SPECIAL_CRAFT_FINISH_PROCESS" src/ --include="*.ts" | grep -v "node_modules"
```

预期：无匹配行（`SPECIAL_CRAFT_FINISH_PROCESS` 全部替换为 `SPECIAL_CRAFT_PROCESS_REPORT`）

### 步骤 10.2：搜索旧状态值残留

```bash
grep -rn "成衣仓已出库待收货\|已入待加工仓\|已完成\|待交出\|已交出\|已回写\|差异\|异议中\|异常" src/ --include="*.ts" | grep -v "node_modules\|special-craft-task-orders.ts\|abnormal\|无异常\|工艺\|异常记录\|差异异常"
```

预期：仅保留类型定义和其他无关模块的匹配。

### 步骤 10.3：构建验证

```bash
npm run build
```

预期：构建成功，无类型错误。

### 步骤 10.4：原型审查

```bash
npm run check:prototype-design-governance
```

### 步骤 10.5：最终 Commit

```bash
git add -A
git commit -m "chore: 全局验证差异/重交代码已全部清理"
```

---

## 任务 11：创建 PR + 合并

### 步骤 11.1

```bash
git push origin feature/remove-special-craft-work-order-layer
gh pr create --base main --head feature/remove-special-craft-work-order-layer --title "feat: 特殊工艺加工单精简为4操作" --body "..."
```

### 步骤 11.2

检验通过后合并 PR。

---

## 最终验证清单

- [ ] `SpecialCraftTaskStatus` 仅 3 个值
- [ ] `grep "SPECIAL_CRAFT_REPORT_DIFFERENCE"` src/ 无结果
- [ ] `grep "SPECIAL_CRAFT_REWORK_AFTER_REJECT"` src/ 无结果
- [ ] `grep "SPECIAL_CRAFT_FINISH_PROCESS"` src/ 无结果（已替换为 `SPECIAL_CRAFT_PROCESS_REPORT`）
- [ ] `grep "差异"` `special-craft-task-orders.ts` 无结果（除了 `abnormalStatus` 占位）
- [ ] `grep "SpecialCraftTaskAbnormalRecord"` src/ 无结果
- [ ] 详情页 Tabs 无"差异异常"
- [ ] 列表页状态筛选仅 4 选项
- [ ] `npm run build` 通过
- [ ] 原型审查通过
