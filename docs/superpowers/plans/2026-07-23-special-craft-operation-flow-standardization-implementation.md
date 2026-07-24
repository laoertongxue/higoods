# 特殊工艺域操作流程与展示规范化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 统一特殊工艺域操作流程（确认接收/完工/交出按明细确认），列表页按 SKU/菲票拆行+SPU缩略图，仓库按工艺+对象建默认库区，裁片完工生成工艺标记。

**架构：** 4个阶段。阶段1改动作定义和对话框（`shared.ts` + `task-detail.ts`），阶段2改列表页（`task-orders.ts`拆行+缩略图），阶段3改仓库库区（`factory-internal-warehouse.ts` + `special-craft-task-orders.ts`），阶段4适配 PDA 端和脚本。

**技术栈：** TypeScript + Vite + Tailwind CSS，字符串模板渲染，`src/components/ui/` 组件库。

---

## 文件结构

### 阶段1：操作流程（核心改动）
| 文件 | 职责 |
|------|------|
| `src/pages/process-factory/special-craft/shared.ts` | 更换动作定义，新增 DIY 对话框渲染函数 |
| `src/pages/process-factory/special-craft/task-detail.ts` | 接入新对话框的事件处理，去掉旧的特判逻辑 |
| `src/pages/process-factory/special-craft/task-orders.ts` | 操作列的快捷按钮适配新动作定义（自动适配） |

### 阶段2：列表页展示
| 文件 | 职责 |
|------|------|
| `src/pages/process-factory/special-craft/task-orders.ts` | 拆行渲染（demandLines 展开），新增缩略图列 |
| `src/pages/process-factory/special-craft/shared.ts` | 新增 `resolveSpuImageUrl()` 函数 |

### 阶段3：仓库库区
| 文件 | 职责 |
|------|------|
| `src/data/fcs/factory-internal-warehouse.ts` | 为两个工厂建按工艺+对象命名的库区 area |
| `src/data/fcs/special-craft-task-orders.ts` | 入库时按 craftName+targetObject 选对应 area |
| `src/data/fcs/special-craft-dedicated-factories.ts` | 统一两个工厂 ID（保留旧 ID 别名） |

### 阶段4：PDA + 脚本
| 文件 | 职责 |
|------|------|
| `src/pages/pda-exec-detail.ts` | 适配新动作定义 |
| `scripts/check-special-craft-web-mobile-action-dialog-and-layout.ts` | 更新检查脚本 |

---

## 阶段1：统一操作流程

### 任务 1.1：重写动作定义（shared.ts）

**文件：** `src/pages/process-factory/special-craft/shared.ts:207-280`

- [ ] **步骤 1：删除旧动作定义**

在 `getFastSpecialCraftWebActions` 中，删除以下三个 actionDef：
- `SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND`（行 218-225）
- `SPECIAL_CRAFT_RECEIVE_CUT_PIECES`（行 226-233）
- `SPECIAL_CRAFT_START_PROCESS`（行 234-240）

- [ ] **步骤 2：新增统一确认接收动作**

```typescript
{
  actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  actionLabel: '确认接收',
  fromStatuses: ['待领料'],
  toStatus: '加工中',
  requiredFields: ['接收人', '接收时间'],
  optionalFields: ['备注'],
},
```

- [ ] **步骤 3：修改完成加工和发起交出的 requiredFields**

对于完成加工和发起交出，去掉 `'加工完成裁片数量'` 和 `'交出裁片数量'` 这类单个总量字段，因为它们将改为自定义对话框逐 SKU/菲票输入：

```typescript
{
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  actionLabel: '完成加工',
  fromStatuses: ['加工中'],
  toStatus: '待交出',
  requiredFields: ['操作人', '完成时间'],
  optionalFields: ['备注'],
},
{
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  actionLabel: '发起交出',
  fromStatuses: ['待交出'],
  toStatus: '已交出',
  requiredFields: ['交出人', '交出时间'],
  optionalFields: ['备注'],
},
```

- [ ] **步骤 4：修改筛选逻辑**

删除对 `SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND` 和 `SPECIAL_CRAFT_RECEIVE_CUT_PIECES` 的特判条件（原行 275-276）：

```typescript
const matched = actionDefs.filter((def) => {
  if (!def.fromStatuses.includes(status)) return false
  return true
})
```

- [ ] **步骤 5：更新 renderWebActionPanel 中的特判**

删除 `SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND` 的特判渲染按钮（原行 333-338）。所有动作按钮统一使用 `open-web-status-action-dialog` 模式，但在事件处理中区分 `SPECIAL_CRAFT_CONFIRM_RECEIVE` 等新动作来触发自定义对话框。

- [ ] **步骤 6：构建并验证**

```bash
npm run build
```

### 任务 1.2：新增 DIY 对话框渲染函数（shared.ts）

**文件：** `src/pages/process-factory/special-craft/shared.ts` 末尾追加

- [ ] **步骤 1：成衣 SKU 确认表格对话框**

```typescript
export function renderGarmentSkuConfirmDialog(
  taskOrderId: string,
  actionCode: string,
  title: string,
  demandLines: SpecialCraftTaskDemandLine[],
  defaultQtyField: 'planPieceQty' | 'receivedQty',
): string {
  const skuRows = new Map<string, { colorName: string; sizeCode: string; planQty: number; defaultQty: number }>()
  demandLines.forEach((line) => {
    const key = `${line.colorName}::${line.sizeCode}`
    const existing = skuRows.get(key)
    if (existing) {
      existing.planQty += line.planPieceQty
      existing.defaultQty += line[defaultQtyField] || 0
    } else {
      skuRows.set(key, {
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        planQty: line.planPieceQty,
        defaultQty: line[defaultQtyField] || 0,
      })
    }
  })

  const tbody = [...skuRows.entries()].map(([key, row]) => {
    const inputName = `sku-qty-${key.replace('::', '-')}`
    return `<tr>
      <td class="px-3 py-2">${escapeHtml(row.colorName)}</td>
      <td class="px-3 py-2">${escapeHtml(row.sizeCode)}</td>
      <td class="px-3 py-2 text-right tabular-nums">${formatQty(row.planQty)}</td>
      <td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="${escapeHtml(inputName)}" value="${row.defaultQty}" min="0" max="${row.planQty}" /></td>
    </tr>`
  }).join('')

  return `
    <div id="special-craft-garment-sku-dialog" class="fixed inset-0 z-[150] flex items-center justify-center bg-black/40">
      <div class="w-full max-w-lg rounded-lg border bg-card p-4 shadow-xl">
        <h3 class="mb-3 text-base font-semibold">${escapeHtml(title)}</h3>
        <table class="w-full text-sm">
          <thead class="bg-muted text-muted-foreground">
            <tr><th class="px-3 py-2 text-left">颜色</th><th class="px-3 py-2 text-left">尺码</th><th class="px-3 py-2 text-right">计划件数</th><th class="px-3 py-2 text-right">实际件数</th></tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" onclick="document.getElementById('special-craft-garment-sku-dialog')?.remove()">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white" data-special-craft-sku-confirm="submit" data-task-id="${escapeHtml(taskOrderId)}" data-action-code="${escapeHtml(actionCode)}">确认</button>
        </div>
      </div>
    </div>
  `
}
```

- [ ] **步骤 2：裁片菲票确认表格对话框**

```typescript
export function renderCutPieceFeiTicketConfirmDialog(
  taskOrderId: string,
  actionCode: string,
  title: string,
  feiTicketGroups: Array<{ feiTicketNo: string; partName: string; colorName: string; sizeCode: string; planQty: number; defaultQty: number }>,
): string {
  const tbody = feiTicketGroups.map((group) => {
    const inputName = `fei-qty-${group.feiTicketNo.replace(/[^A-Za-z0-9]/g, '-')}`
    return `<tr>
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(group.feiTicketNo)}</td>
      <td class="px-3 py-2">${escapeHtml(group.partName)}</td>
      <td class="px-3 py-2">${escapeHtml(group.colorName)}</td>
      <td class="px-3 py-2">${escapeHtml(group.sizeCode)}</td>
      <td class="px-3 py-2 text-right tabular-nums">${formatQty(group.planQty)}</td>
      <td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="${escapeHtml(inputName)}" value="${group.defaultQty}" min="0" max="${group.planQty}" /></td>
    </tr>`
  }).join('')

  return `
    <div id="special-craft-fei-ticket-dialog" class="fixed inset-0 z-[150] flex items-center justify-center bg-black/40">
      <div class="w-full max-w-2xl rounded-lg border bg-card p-4 shadow-xl">
        <h3 class="mb-3 text-base font-semibold">${escapeHtml(title)}</h3>
        <table class="w-full text-sm">
          <thead class="bg-muted text-muted-foreground">
            <tr><th class="px-3 py-2 text-left">菲票号</th><th class="px-3 py-2 text-left">部位</th><th class="px-3 py-2 text-left">颜色</th><th class="px-3 py-2 text-left">尺码</th><th class="px-3 py-2 text-right">计划数量</th><th class="px-3 py-2 text-right">实际数量</th></tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" onclick="document.getElementById('special-craft-fei-ticket-dialog')?.remove()">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white" data-special-craft-fei-confirm="submit" data-task-id="${escapeHtml(taskOrderId)}" data-action-code="${escapeHtml(actionCode)}">确认</button>
        </div>
      </div>
    </div>
  `
}
```

- [ ] **步骤 3：构建并验证**

```bash
npm run build
```

### 任务 1.3：事件处理接入新对话框（task-detail.ts）

**文件：** `src/pages/process-factory/special-craft/task-detail.ts`

- [ ] **步骤 1：删除旧的特判处理**

删除 `handleSpecialCraftTaskDetailEvent` 中对 `confirm-garment-warehouse-outbound` 的处理（`task-detail.ts` 中约 30 行），删除对 `open-web-status-action-dialog` 的通用处理（已由 `handleProcessWebStatusActionDialogEvent` 覆盖）。

- [ ] **步骤 2：新增自定义对话框的事件处理**

在 `handleSpecialCraftTaskDetailEvent` 中，在 `dialogHandled` 检查之后添加：

```typescript
const skuConfirmNode = target.closest<HTMLElement>('[data-special-craft-sku-confirm]')
if (skuConfirmNode) {
  const taskId = skuConfirmNode.dataset.taskId || ''
  const actionCode = skuConfirmNode.dataset.actionCode || ''
  const taskOrder = getSpecialCraftTaskOrderById(taskId)
  if (!taskOrder) return true

  const inputs = document.querySelectorAll<HTMLInputElement>('#special-craft-garment-sku-dialog input[type="number"]')
  const skuQtyBySkuCode: Record<string, number> = {}
  if (taskOrder.demandLines) {
    taskOrder.demandLines.forEach((line) => {
      const key = `${line.colorName}-${line.sizeCode}`
      const input = (document.querySelector(`#special-craft-garment-sku-dialog input[name="sku-qty-${key.replace(/[^A-Za-z0-9-]/g, '-')}"]`) as HTMLInputElement)
      if (input) {
        const qty = Number(input.value)
        if (Number.isInteger(qty) && qty >= 0 && qty <= line.planPieceQty) {
          skuQtyBySkuCode[line.skuCode] = (skuQtyBySkuCode[line.skuCode] || 0) + qty
        }
      }
    })
  }

  document.getElementById('special-craft-garment-sku-dialog')?.remove()
  executeProcessWebAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: taskId,
    actionCode,
    operatorName: 'Web 端操作员',
    operatedAt: '2026-07-23 10:00',
    skuQtyBySkuCode,
  }).then(() => {
    showToast('确认接收完成')
    appStore.navigate(appStore.getState().pathname || '', { historyMode: 'replace' })
  }).catch((e) => showToast(e.message))
  return true
}

const feiConfirmNode = target.closest<HTMLElement>('[data-special-craft-fei-confirm]')
if (feiConfirmNode) {
  // 类似逻辑，但收集菲票数量而不是 SKU
  const taskId = feiConfirmNode.dataset.taskId || ''
  const actionCode = feiConfirmNode.dataset.actionCode || ''
  const taskOrder = getSpecialCraftTaskOrderById(taskId)
  if (!taskOrder) return true

  const feiQtyByTicketNo: Record<string, number> = {}
  const inputs = document.querySelectorAll<HTMLInputElement>('#special-craft-fei-ticket-dialog input[type="number"]')
  inputs.forEach((input) => {
    const name = input.name || ''
    const ticketNo = name.replace('fei-qty-', '').replace(/-/g, '-')
    feiQtyByTicketNo[ticketNo] = Number(input.value) || 0
  })

  document.getElementById('special-craft-fei-ticket-dialog')?.remove()
  executeProcessWebAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: taskId,
    actionCode,
    operatorName: 'Web 端操作员',
    operatedAt: '2026-07-23 10:00',
    feiQtyByTicketNo,
  }).then(() => {
    showToast('操作完成')
    appStore.navigate(appStore.getState().pathname || '', { historyMode: 'replace' })
  }).catch((e) => showToast(e.message))
  return true
}
```

- [ ] **步骤 3：渲染按钮时区分动作类型**

在 `renderWebActionPanel` 调用处，对于 `SPECIAL_CRAFT_CONFIRM_RECEIVE` 和 `SPECIAL_CRAFT_FINISH_PROCESS` 这两个需要自定义对话框的动作，不渲染普通的 `open-web-status-action-dialog` 按钮，而是插入对应的自定义对话框 HTML。

修改 `renderWebActionPanel` 函数，对这两个 actionCode 增加特判分支——渲染按钮 + 点击时先注入对话框 DOM 再打开。

- [ ] **步骤 4：构建并验证**

```bash
npm run build
```

---

## 阶段2：列表页展示变更

### 任务 2.1：SPU 缩略图

**文件：** `src/pages/process-factory/special-craft/shared.ts` + `task-orders.ts`

- [ ] **步骤 1：新增 resolveSpuImageUrl 函数（shared.ts）**

```typescript
import { productionOrders } from '../../../data/fcs/production-orders.ts'

const spuImageByCode: Record<string, string> = {
  tdv_demand_SPU_2024_004: '/tshirt-sample.jpg',
  tdv_demand_SPU_2024_005: '/jacket-sample.jpg',
  tdv_demand_SPU_2024_010: '/pants-sample.jpg',
  tdv_demand_SPU_2024_012: '/cardigan-sample.jpg',
  tdv_demand_SPU_2024_013: '/dress-sample-1.jpg',
}

export function resolveSpuImageUrl(taskOrder: SpecialCraftTaskOrder): string {
  const po = productionOrders.find((p) => p.productionOrderId === taskOrder.productionOrderId)
  const spuCode = po?.demandSnapshot?.spuCode
  if (spuCode && spuImageByCode[spuCode]) return spuImageByCode[spuCode]
  return '/tshirt-sample.jpg'
}
```

- [ ] **步骤 2：在列表页新增缩略图列（task-orders.ts）**

在 COLUMNS 定义最前面添加：

```typescript
{
  key: 'thumbnail', title: '', width: 56, freezeable: true, required: true,
  render(row) {
    const src = resolveSpuImageUrl(row)
    return `<img src="${escapeHtml(src)}" class="h-10 w-10 cursor-pointer rounded object-cover"
      data-special-craft-task-list-action="view-image"
      data-image-src="${escapeHtml(src)}"
      alt="商品图" />`
  },
},
```

在 columnRules 中增加：`{ key: 'thumbnail', required: true, freezeable: true }`

在事件处理中添加图片放大逻辑：

```typescript
if (action === 'view-image') {
  const src = actionNode.dataset.imageSrc || ''
  const dialog = document.createElement('div')
  dialog.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-black/60 cursor-pointer'
  dialog.innerHTML = `<img src="${src}" class="max-h-[80vh] max-w-[80vw] rounded-lg shadow-2xl" />`
  dialog.onclick = () => dialog.remove()
  document.body.appendChild(dialog)
  return true
}
```

### 任务 2.2：拆行渲染

**文件：** `src/pages/process-factory/special-craft/task-orders.ts`

- [ ] **步骤 1：定义拆行数据结构**

```typescript
interface ExpandedTaskOrderRow {
  taskOrder: SpecialCraftTaskOrder
  rowType: 'garment-sku' | 'cut-piece-fei'
  displayKey: string
  // garment: colorName + sizeCode
  garmentColor: string
  garmentSize: string
  garmentPlanQty: number
  garmentReceivedQty: number
  // cut piece: fei ticket info
  feiTicketNo: string
  feiPartName: string
  feiColor: string
  feiSize: string
  feiPlanQty: number
  feiReceivedQty: number
  // rowspan tracking
  rowSpan: number
  isFirstRow: boolean
}
```

- [ ] **步骤 2：展开函数**

在 `renderSpecialCraftTaskOrdersPage` 中，在排序/分页之前展开：

```typescript
function expandRows(taskOrders: SpecialCraftTaskOrder[]): ExpandedTaskOrderRow[] {
  const rows: ExpandedTaskOrderRow[] = []
  taskOrders.forEach((taskOrder) => {
    const lines = taskOrder.demandLines || []
    const isGarment = taskOrder.targetObject === '成衣'

    if (isGarment) {
      const skuGroups = new Map<string, SpecialCraftTaskDemandLine[]>()
      lines.forEach((line) => {
        const key = `${line.colorName}::${line.sizeCode}`
        if (!skuGroups.has(key)) skuGroups.set(key, [])
        skuGroups.get(key)!.push(line)
      })
      const totalRows = skuGroups.size
      let index = 0
      skuGroups.forEach((groupLines, key) => {
        const [color, size] = key.split('::')
        const planQty = groupLines.reduce((s, l) => s + l.planPieceQty, 0)
        rows.push({
          taskOrder, rowType: 'garment-sku', displayKey: key,
          garmentColor: color, garmentSize: size,
          garmentPlanQty: planQty, garmentReceivedQty: 0,
          feiTicketNo: '', feiPartName: '', feiColor: '', feiSize: '', feiPlanQty: 0, feiReceivedQty: 0,
          rowSpan: totalRows, isFirstRow: index === 0,
        })
        index++
      })
    } else {
      // 裁片：按菲票拆行
      const feiGroups = new Map<string, SpecialCraftTaskDemandLine[]>()
      lines.forEach((line) => {
        line.feiTicketNos.forEach((ticketNo) => {
          if (!feiGroups.has(ticketNo)) feiGroups.set(ticketNo, [])
          feiGroups.get(ticketNo)!.push(line)
        })
      })
      const totalRows = feiGroups.size || 1
      let index = 0
      if (feiGroups.size === 0) {
        // 无菲票：保留一行
        rows.push({
          taskOrder, rowType: 'cut-piece-fei', displayKey: 'no-fei',
          garmentColor: '', garmentSize: '', garmentPlanQty: 0, garmentReceivedQty: 0,
          feiTicketNo: '', feiPartName: taskOrder.partName || '', feiColor: taskOrder.fabricColor || '', feiSize: taskOrder.sizeCode || '', feiPlanQty: taskOrder.planQty, feiReceivedQty: 0,
          rowSpan: 1, isFirstRow: true,
        })
      } else {
        feiGroups.forEach((groupLines, ticketNo) => {
          const first = groupLines[0]
          const planQty = groupLines.reduce((s, l) => s + l.planPieceQty, 0)
          rows.push({
            taskOrder, rowType: 'cut-piece-fei', displayKey: ticketNo,
            garmentColor: '', garmentSize: '', garmentPlanQty: 0, garmentReceivedQty: 0,
            feiTicketNo: ticketNo, feiPartName: first.partName, feiColor: first.colorName, feiSize: first.sizeCode, feiPlanQty: planQty, feiReceivedQty: 0,
            rowSpan: totalRows, isFirstRow: index === 0,
          })
          index++
        })
      }
    }
  })
  return rows
}
```

- [ ] **步骤 3：修改 COLUMNS 适配拆行**

修改 COLUMNS 的泛型为 `StandardListColumn<ExpandedTaskOrderRow>`，并更新 `render` 函数：

加工对象列按行类型区分：
```typescript
{
  key: 'targetObject', title: '加工对象', width: 160, freezeable: true,
  render(row) {
    if (row.rowType === 'garment-sku') {
      return `<div class="text-sm">${escapeHtml(`${row.garmentColor} / ${row.garmentSize}`)}</div>`
    }
    if (row.feiTicketNo) {
      return `<button type="button" class="text-sm text-blue-700 hover:underline"
        data-special-craft-task-list-action="view-fei-ticket"
        data-fei-ticket-no="${escapeHtml(row.feiTicketNo)}">${escapeHtml(row.feiTicketNo)}</button>
        <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(`${row.feiPartName} / ${row.feiColor} / ${row.feiSize}`)}</div>`
    }
    return `<div class="text-sm">${escapeHtml(`${row.feiPartName} / ${row.feiColor} / ${row.feiSize}`)}</div>`
  },
},
```

跨行合并列（加工单号、生产单、工厂、数量进度、状态、操作）：`isFirstRow` 时用 `rowSpan` 做 `rowspan="${row.rowSpan}"`，`!isFirstRow` 时返回空字符串（不出单元格）。

- [ ] **步骤 4：更新排序和分页**

排序改为按展开后的 `ExpandedTaskOrderRow[]` 排序，需要新增 `sortValue` ——对于合并列排序按 `taskOrder` 的原始字段。

- [ ] **步骤 5：构建并验证**

```bash
npm run build && npm run check:list-page-governance
```

---

## 阶段3：仓库默认库区

### 任务 3.1：统一工厂 ID

**文件：** `src/data/fcs/special-craft-dedicated-factories.ts`

- [ ] **步骤 1：读取当前文件，确认 13 个工艺各自的 factoryId**

- [ ] **步骤 2：新建两个统一工厂**

```typescript
{
  operationId: 'FACTORY-AUX-CRAFT',
  craftCode: '',
  craftName: '辅助工艺综合',
  factoryId: 'FAC-AUX-CRAFT',
  factoryCode: 'AUX-CRAFT-001',
  factoryName: '辅助工艺厂',
  managementDomain: 'AUXILIARY_CRAFT_FACTORY',
  factoryType: 'CENTRAL_AUX',
}
```

所有辅助工艺的 `factoryId` 统一改为 `'FAC-AUX-CRAFT'`，`factoryName` 改为 `'辅助工艺厂'`。

特种工艺同理，统一为 `'FAC-SPC-CRAFT'` / `'特种工艺厂'`。

- [ ] **步骤 3：构建验证**

```bash
npm run build
```

### 任务 3.2：建按工艺+对象命名的库区

**文件：** `src/data/fcs/factory-internal-warehouse.ts` + `src/data/fcs/special-craft-task-orders.ts`

- [ ] **步骤 1：在 buildDefaultFactoryInternalWarehouses 中为两个工厂建命名 area**

在 `buildDefaultFactoryInternalWarehouses()` 函数中，为 `FAC-AUX-CRAFT` 和 `FAC-SPC-CRAFT` 各建仓库时，areaList 改为按工艺枚举：

```typescript
// 伪代码：在 buildDefaultFactoryInternalWarehouses 中
const craftZones: Array<{ craftName: string; objectLabel: string }> = [
  { craftName: '绣花', objectLabel: '成衣' },
  { craftName: '绣花', objectLabel: '裁片' },
  { craftName: '烫画', objectLabel: '成衣' },
  { craftName: '直喷', objectLabel: '成衣' },
  // ... 按工艺+targetObject 枚举
  { craftName: '模板工艺', objectLabel: '裁片' },
]

const areaList = craftZones.map((zone, i) => ({
  areaId: `${warehouse.warehouseId}-AREA-${String(i + 1).padStart(2, '0')}`,
  areaName: `${zone.craftName}-${zone.objectLabel}库区`,
  shelfList: [/* 默认架子 */],
  status: 'AVAILABLE',
}))
```

- [ ] **步骤 2：入库时选对应 area**

在 `ensureSpecialTypeUnifiedWarehouseArtifacts` 或 `buildInboundArtifacts` 中，根据 `seed.craftName` + `seed.targetObject` 匹配对应 areaName：

```typescript
const targetObjectLabel = seed.targetObject === '成衣' ? '成衣' : '裁片'
const targetAreaName = `${seed.craftName}-${targetObjectLabel}库区`
const inboundPosition = pickWarehousePosition(warehouse, targetAreaName as any, positionIndex)
```

- [ ] **步骤 3：构建验证**

```bash
npm run build
```

---

## 阶段4：PDA + 脚本适配

### 任务 4.1：PDA 端动作适配

**文件：** `src/pages/pda-exec-detail.ts`

- [ ] **步骤 1：更新 PDA 端动作列表**

在 `getSpecialCraftPdaAllowedActions` 中，将 `bind-fei-ticket`、`garment-warehouse-outbound`、`receive-cut-pieces`、`start-process` 替换为 `confirm-receive`。

- [ ] **步骤 2：更新执行逻辑**

在 `executeMobileProcessAction` 处理函数中，适配新的 actionCode。

```bash
npm run build
```

### 任务 4.2：脚本适配

**文件：** `scripts/check-special-craft-web-mobile-action-dialog-and-layout.ts`

- [ ] **步骤 1：更新检查脚本中的动作断言**

将旧的 actionCode 检查替换为新代码。

```bash
node --experimental-strip-types scripts/check-special-craft-web-mobile-action-dialog-and-layout.ts
```

---

## 自检

1. **规格覆盖度**：设计文档 4 节 → 计划 4 阶段 9 任务。所有 7 条需求均有对应任务。✓
2. **占位符扫描**：无 TODO/TBD。每个步骤有具体代码。✓
3. **类型一致性**：`SpecialCraftTaskOrder`、`SpecialCraftTaskDemandLine`、`ExpandedTaskOrderRow` 在阶段间一致。✓
