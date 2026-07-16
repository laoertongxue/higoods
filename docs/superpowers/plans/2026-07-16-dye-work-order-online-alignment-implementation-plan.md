# 单张染色加工单线上对齐实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 PFOS 单张染色加工单改造成与线上业务一致的标准列表、人工编辑、统一日志和中印双语流程卡，并让 PDA 的接单、开工、完工、交出和入库推进同一套七状态。

**架构：** 保留现有染色执行域作为内部执行事实，新建一个小型“线上业务视图域”集中维护七状态、人工编辑值和统一日志，避免继续扩张 `dyeing-task-domain.ts`。PFOS 列表、弹窗、导出和打印都读取该业务视图；PDA 在既有动作成功后调用同一状态推进函数。合并染色域保持不变。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `src/components/ui/` 标准列表组件、Node 静态检查、Playwright。

---

## 文件结构

### 新建文件

- `src/data/fcs/dye-work-order-online-domain.ts`：七状态、人工编辑值、PDA 动作映射、统一操作日志和高风险状态判断。
- `src/data/fcs/dye-work-order-online-view.ts`：把现有染色加工单、生产单快照和演示资料组合成线上列表行，提供筛选、汇总和导出数据。
- `src/pages/process-factory/dyeing/work-order-overlays.ts`：查看、编辑、日志弹窗和表单读取函数。
- `src/pages/print/templates/dye-work-order-flow-card-template.ts`：染整生产流程卡专用中印双语模板。
- `scripts/check-dye-work-order-online-alignment.ts`：领域、列表、弹窗、状态映射、导出和打印的专项静态/领域检查。
- `tests/dye-work-order-online-alignment.spec.ts`：PFOS 与 PDA 的真实浏览器验收。
- `docs/prototype-review-records/2026-07-16-dye-work-order-online-alignment.md`：本次原型治理审查记录。

### 修改文件

- `src/pages/process-factory/dyeing/work-orders.ts`：重做线上业务查询、汇总、标准列表、选择和局部刷新。
- `src/pages/process-factory/dyeing/events.ts`：保持统一事件入口，转发列表及弹窗事件。
- `src/pages/pda-task-receive.ts`：接单成功后记录“等待处理”状态动作。
- `src/pages/pda-exec-detail.ts`：开工、完工和交出成功后推进统一状态。
- `src/data/fcs/dyeing-task-domain.ts`：仅补充读取实际完成量和入库结果所需的小型导出，不改合并染色数据结构。
- `src/data/fcs/process-action-writeback-service.ts`：染色交出写回成功后推进“待审核”。
- `src/data/fcs/fcs-route-links.ts`：染色详情链接改成列表深链并打开只读弹窗。
- `src/router/routes-fcs.ts`：旧复杂详情路由重定向到列表深链。
- `src/router/route-renderers-fcs.ts`：移除不再使用的复杂详情异步渲染器。
- `src/pages/process-dye-orders.ts`：平台侧“打开工厂端详情”改为列表只读弹窗深链。
- `src/pages/print/templates/task-route-card-template.ts`：染色来源委托给专用流程卡构建器。
- `src/data/fcs/print-template-registry.ts`：注册染色流程卡专用打印文档。
- `scripts/check-dyeing-workflow.ts`：将旧“复杂详情/任务流转卡”断言替换成新弹窗/染整流程卡断言。
- `package.json`：增加专项检查和端到端脚本。

## 约束

- 不修改 `src/data/fcs/combined-dyeing-domain.ts`、`src/pages/process-factory/dyeing/combined-dyeing.ts` 或合并染色测试语义。
- PFOS、PDA、日志、打印只显示平台加工单号，不生成工厂加工单号。
- 列表必须保留 `// @page-pattern: list`，并使用 `renderStandardListPage`、`renderStandardListTable`、`renderTablePagination`。
- 页面输入事件只更新草稿，不触发整页重绘；弹窗开关和保存后只刷新列表工作区或覆盖层。
- 旧复杂详情路由只做兼容重定向，不保留新的入口或继续扩展旧详情页。

---

### 任务 1：建立单张染色加工单线上业务状态域

**文件：**
- 创建：`src/data/fcs/dye-work-order-online-domain.ts`
- 创建：`scripts/check-dye-work-order-online-alignment.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的状态域检查**

在检查脚本中先写出状态、人工编辑、PDA 映射和日志期望：

```ts
import assert from 'node:assert/strict'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  advanceDyeWorkOrderOnlineStatus,
  getDyeWorkOrderOnlineRecord,
  listDyeWorkOrderOnlineLogs,
  updateDyeWorkOrderFromPfos,
} from '../src/data/fcs/dye-work-order-online-domain.ts'

const order = listDyeWorkOrders().find((item) => item.sourceType === 'PRODUCTION_ORDER')!
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '接单', operatorName: '染厂操作员', operatedAt: '2026-07-16 08:00:00', source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '开工', operatorName: '染厂操作员', operatedAt: '2026-07-16 08:10:00', source: 'PDA',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '染色中')

advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
  action: '完工', operatorName: '染厂操作员', operatedAt: '2026-07-16 12:00:00', source: 'PDA',
  completedQty: 80, lossQty: 3,
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '染色完成')

updateDyeWorkOrderFromPfos(order.dyeOrderId, {
  expectedVersion: getDyeWorkOrderOnlineRecord(order.dyeOrderId).version,
  operatorName: '染厂主管', operatedAt: '2026-07-16 12:10:00',
  status: '等待处理', plannedFinishAt: '2026-07-20 18:00:00', factoryId: order.dyeFactoryId,
  factoryName: order.dyeFactoryName, receiverName: order.receiverName, shade: '深色', temperature: 205,
  rawMaterialQty: 83, rawMaterialRollCount: 2, completedQty: 80, lossQty: 3, remark: '主管回退复核',
})
assert.equal(getDyeWorkOrderOnlineRecord(order.dyeOrderId).status, '等待处理')
assert(listDyeWorkOrderOnlineLogs(order.dyeOrderId).some((log) => log.action === 'PFOS人工编辑'))
assert(listDyeWorkOrderOnlineLogs(order.dyeOrderId).some((log) => log.action === '开工'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-dye-work-order-online-alignment.ts
```

预期：FAIL，报错无法找到 `dye-work-order-online-domain.ts`。

- [ ] **步骤 3：实现七状态、编辑值和统一日志**

实现明确类型和入口：

```ts
export const DYE_WORK_ORDER_ONLINE_STATUSES = [
  '等待处理', '取消', '染色中', '染色完成', '待审核', '部分入库', '已完成',
] as const

export type DyeWorkOrderOnlineStatus = typeof DYE_WORK_ORDER_ONLINE_STATUSES[number]
export type DyeWorkOrderOnlineAction = '接单' | '开工' | '完工' | '交出' | '部分入库' | '全部入库' | '主管取消'

export interface DyeWorkOrderOnlineRecord {
  dyeOrderId: string
  status: DyeWorkOrderOnlineStatus
  version: number
  plannedFinishAt: string
  factoryId: string
  factoryName: string
  receiverName: string
  shade: '' | '浅色' | '深色'
  temperature: 190 | 200 | 205 | null
  rawMaterialQty: number
  rawMaterialRollCount: number
  completedQty: number
  lossQty: number
  remark: string
}

const PDA_NEXT_STATUS: Record<DyeWorkOrderOnlineAction, DyeWorkOrderOnlineStatus> = {
  接单: '等待处理', 开工: '染色中', 完工: '染色完成', 交出: '待审核',
  部分入库: '部分入库', 全部入库: '已完成', 主管取消: '取消',
}
```

`advanceDyeWorkOrderOnlineStatus` 必须校验 PDA 顺序；`updateDyeWorkOrderFromPfos` 允许选择任意七状态，但使用 `expectedVersion` 阻止覆盖已发生的 PDA 更新。日志记录操作端、操作人、时间、前后状态和字段差异。提供 `isDyeWorkOrderHighRiskStatusChange` 给 UI 判断取消或回退。

在 `package.json` 的 `scripts` 中增加：

```json
"check:dye-work-order-online-alignment": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-dye-work-order-online-alignment.ts"
```

- [ ] **步骤 4：运行专项检查并确认通过**

运行：

```bash
npm run check:dye-work-order-online-alignment
```

预期：输出 `dye work order online alignment check passed`。

- [ ] **步骤 5：提交状态域**

```bash
git add src/data/fcs/dye-work-order-online-domain.ts scripts/check-dye-work-order-online-alignment.ts package.json
git commit -m "feat: add dye work order online status domain"
```

---

### 任务 2：建立线上列表视图、筛选、汇总和导出模型

**文件：**
- 创建：`src/data/fcs/dye-work-order-online-view.ts`
- 修改：`scripts/check-dye-work-order-online-alignment.ts`

- [ ] **步骤 1：增加失败的视图模型检查**

```ts
import {
  buildDyeWorkOrderCsv,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
} from '../src/data/fcs/dye-work-order-online-view.ts'

const rows = listDyeWorkOrderOnlineRows()
assert(rows.length >= 8)
assert(rows.every((row) => row.workOrderNo === row.platformWorkOrderNo))
assert(rows.some((row) => row.productImageUrl && row.materialImageUrl))
assert(rows.some((row) => row.status === '部分入库' && row.pendingInboundQty > 0))
assert(rows.some((row) => row.isOverdue && !['取消', '已完成'].includes(row.status)))

const filtered = filterDyeWorkOrderOnlineRows(rows, { status: ['染色中'], keywordField: 'workOrderNo', keyword: '' })
assert(filtered.every((row) => row.status === '染色中'))
const summary = getDyeWorkOrderOnlineSummary(rows)
assert(summary.plannedQtyByUnit.some((item) => item.unit === 'Yard'))
assert(buildDyeWorkOrderCsv(rows, '备料').startsWith('\uFEFF'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：`npm run check:dye-work-order-online-alignment`

预期：FAIL，报错无法找到 `dye-work-order-online-view.ts`。

- [ ] **步骤 3：实现线上列表行和演示资料适配器**

定义单一列表行：

```ts
export interface DyeWorkOrderOnlineRow {
  dyeOrderId: string
  workOrderNo: string
  platformWorkOrderNo: string
  taskNo: string
  productionOrderNo: string
  demandNo: string
  productCode: string
  productImageUrl: string
  purchaseOrderNo: string
  purchaseType: string
  materialName: string
  materialImageUrl: string
  rawMaterialSku: string
  colorSku: string
  colorNo: string
  composition: string
  width: string
  weightGsm: number | null
  processName: string
  factoryName: string
  receiverName: string
  status: DyeWorkOrderOnlineStatus
  plannedQty: number
  qtyUnit: string
  rawMaterialQty: number
  rawMaterialRollCount: number
  preparedQty: number
  preparedWeightKg: number
  completedQty: number
  lossQty: number
  pendingWritebackQty: number
  differenceQty: number
  objectionQty: number
  pendingInboundQty: number
  orderedAt: string
  plannedFinishAt: string
  completedAt: string
  deliveredAt: string
  isOverdue: boolean
  sourceType: 'PRODUCTION_ORDER' | 'STOCK'
  remark: string
}
```

优先从正式生产单快照和现有交出/收货事实取值；当前原型没有的商品图片、采购库存、色卡和备料要求使用按加工单号固定的演示资料表，不使用随机值。汇总按单位分组。CSV 提供“全部、备料、超期未完结”三种字段集合。

- [ ] **步骤 4：运行检查并确认通过**

运行：`npm run check:dye-work-order-online-alignment`

预期：PASS，且所有列表行的平台加工单号唯一。

- [ ] **步骤 5：提交视图模型**

```bash
git add src/data/fcs/dye-work-order-online-view.ts scripts/check-dye-work-order-online-alignment.ts
git commit -m "feat: add dye work order online list view"
```

---

### 任务 3：重做 PFOS 标准列表、筛选和批量选择

**文件：**
- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`scripts/check-dye-work-order-online-alignment.ts`
- 修改：`scripts/check-dyeing-workflow.ts`

- [ ] **步骤 1：增加失败的页面契约检查**

```ts
import { renderCraftDyeingWorkOrdersPage } from '../src/pages/process-factory/dyeing/work-orders.ts'

const html = renderCraftDyeingWorkOrdersPage()
for (const text of [
  '查询项', '状态', '销售类型', '生产工厂', '染色工艺', '面料接收人',
  '是否纱线', '是否补料', 'GTG仓是否有库存', '物料类型', '染色色号',
  '成分', '幅宽', '克重', '导出备料数据', '导出超期未完结', '批量打印染整生产流程卡',
  '商品信息', '采购单信息', '原料/面料', '属性信息', '时间/加工厂', '附加信息',
]) assert(html.includes(text), `染色加工单列表缺少：${text}`)

for (const removed of ['查看配方', '查看统计', '合并染色</div>']) {
  assert(!html.includes(removed), `单张染色加工单列表不应包含：${removed}`)
}
assert(html.includes('data-standard-list-table'))
```

同时把 `scripts/check-dyeing-workflow.ts` 中“打印任务流转卡”和复杂详情入口断言改为“打印流程卡”“查看”“编辑”“日志”。

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:dye-work-order-online-alignment
npm run check:dyeing-workflow
```

预期：专项检查因线上字段缺失而 FAIL；既有染色检查因旧打印文案断言变更而 FAIL。

- [ ] **步骤 3：实现标准列表结构**

保留 `// @page-pattern: list`，将页面状态扩展为：

```ts
interface DyeWorkOrderListState {
  currentPage: number
  filters: DyeWorkOrderOnlineFilters
  draftFilters: DyeWorkOrderOnlineFilters
  sort: StandardListSortState | null
  selectedIds: Set<string>
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  overlay: null | { type: 'view' | 'edit' | 'logs'; dyeOrderId: string }
}
```

列表默认可见列按线上业务分组，平台加工单号为必需冻结列，操作为必需右侧固定列。统计卡保持 48px 单行结构。查询区允许换行但不增加说明性文案。复选框选择只局部更新当前行和批量操作状态，不整页重绘。

行操作只输出：

```ts
const actions = [
  { label: '查看', action: 'open-view' },
  { label: '编辑', action: 'open-edit' },
  { label: '日志', action: 'open-logs' },
  { label: '打印流程卡', action: 'print-one' },
]
```

- [ ] **步骤 4：运行列表和染色检查**

运行：

```bash
npm run check:dye-work-order-online-alignment
npm run check:dyeing-workflow
npm run check:list-page-governance
```

预期：三项全部 PASS；标准列表基线文件不发生变化。

- [ ] **步骤 5：提交列表重做**

```bash
git add src/pages/process-factory/dyeing/work-orders.ts scripts/check-dye-work-order-online-alignment.ts scripts/check-dyeing-workflow.ts
git commit -m "feat: align dye work order list with online business"
```

---

### 任务 4：实现查看、编辑、日志弹窗和列表深链

**文件：**
- 创建：`src/pages/process-factory/dyeing/work-order-overlays.ts`
- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`src/pages/process-factory/dyeing/events.ts`
- 修改：`src/data/fcs/fcs-route-links.ts`
- 修改：`src/pages/process-dye-orders.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`scripts/check-dye-work-order-online-alignment.ts`

- [ ] **步骤 1：增加失败的弹窗和路由检查**

```ts
import { buildDyeingWorkOrderDetailLink } from '../src/data/fcs/fcs-route-links.ts'
import { renderDyeWorkOrderOverlay } from '../src/pages/process-factory/dyeing/work-order-overlays.ts'

assert.equal(
  buildDyeingWorkOrderDetailLink('DYE-001'),
  '/fcs/craft/dyeing/work-orders?dyeOrderId=DYE-001',
)
const editHtml = renderDyeWorkOrderOverlay({ type: 'edit', dyeOrderId: order.dyeOrderId })
for (const text of ['预计完成时间', '生产工厂', '面料接收人', '深浅', '温度', '计划数量', '原料数量', '原料卷数', '完成数量', '损耗数量', '备注']) {
  assert(editHtml.includes(text), `编辑弹窗缺少：${text}`)
}
assert(editHtml.includes('readonly'))
assert(!editHtml.includes('染缸执行'))
assert(!editHtml.includes('移动端执行任务引用'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：`npm run check:dye-work-order-online-alignment`

预期：FAIL，报错弹窗模块不存在或旧详情链接仍指向独立详情页。

- [ ] **步骤 3：实现三个弹窗和编辑保存**

弹窗模块导出：

```ts
export type DyeWorkOrderOverlayState = null | {
  type: 'view' | 'edit' | 'logs'
  dyeOrderId: string
  confirmHighRisk?: boolean
  error?: string
}

export function renderDyeWorkOrderOverlay(state: NonNullable<DyeWorkOrderOverlayState>): string
export function readDyeWorkOrderEditInput(root: ParentNode): DyeWorkOrderPfosEditInput
```

查看弹窗只读；编辑弹窗的输入均标记 `data-skip-page-rerender="true"`，计划数量和平台加工单号只读。保存时先做数量和版本校验；取消或回退状态先打开二次确认层，确认后调用 `updateDyeWorkOrderFromPfos`。日志弹窗按时间倒序展示操作端、操作人、前后状态和字段差异。

列表首次进入时读取 `dyeOrderId` 查询参数并打开查看弹窗。关闭弹窗时移除查询参数，不重置列表列偏好。旧 `/fcs/craft/dyeing/work-orders/:id` 路由重定向到列表深链；删除 `renderCraftDyeingWorkOrderDetailPage` 路由引用，不删除旧页面文件，避免扩大到无关历史消费者。

- [ ] **步骤 4：运行专项、路由和构建检查**

运行：

```bash
npm run check:dye-work-order-online-alignment
npm run check:dyeing-workflow
npm run build
```

预期：全部 PASS，平台侧打开工厂端详情进入列表只读弹窗。

- [ ] **步骤 5：提交弹窗和深链**

```bash
git add src/pages/process-factory/dyeing/work-order-overlays.ts src/pages/process-factory/dyeing/work-orders.ts src/pages/process-factory/dyeing/events.ts src/data/fcs/fcs-route-links.ts src/pages/process-dye-orders.ts src/router/routes-fcs.ts src/router/route-renderers-fcs.ts scripts/check-dye-work-order-online-alignment.ts
git commit -m "feat: add dye work order online dialogs"
```

---

### 任务 5：接通导出与染整生产流程卡

**文件：**
- 创建：`src/pages/print/templates/dye-work-order-flow-card-template.ts`
- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`src/pages/print/templates/task-route-card-template.ts`
- 修改：`src/data/fcs/print-template-registry.ts`
- 修改：`scripts/check-dye-work-order-online-alignment.ts`

- [ ] **步骤 1：增加失败的导出和流程卡检查**

```ts
import { buildDyeWorkOrderFlowCardPrintDocument } from '../src/pages/print/templates/dye-work-order-flow-card-template.ts'

const doc = buildDyeWorkOrderFlowCardPrintDocument(order.dyeOrderId)
assert.equal(doc.sourceId, order.dyeOrderId)
const cardText = JSON.stringify(doc)
for (const text of [
  '染整生产流程卡', 'Kartu Alur Produksi Pencelupan dan Penyempurnaan',
  order.dyeOrderNo, '下单日期', '是否加急', '生产单号', '色样备注',
  'No. Warna', 'Bahan baku', 'Kuantitas', 'Formula pencelupan',
  'Pencelupan', 'Penghilangan air', 'Pengeringan', 'Finishing', 'Kemasan',
]) assert(cardText.includes(text), `染整生产流程卡缺少：${text}`)
assert(!cardText.includes('工厂加工单号'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：`npm run check:dye-work-order-online-alignment`

预期：FAIL，报错专用流程卡构建器不存在。

- [ ] **步骤 3：实现下载和专用打印模板**

列表中的三个导出按钮调用 `buildDyeWorkOrderCsv`，使用带 UTF-8 BOM 的 `Blob` 下载。批量打印要求 `selectedIds.size > 0`，生成：

```ts
const href = `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=${encodeURIComponent(ids.join(','))}`
window.open(href, '_blank', 'noopener,noreferrer')
```

打印构建器识别逗号分隔 ID，按勾选顺序生成多张文档，每张设置独立分页。单张卡片包含二维码、日期、生产单/需求来源、色样、色卡、SPU、供应商、原料、颜色、数量、成分、幅宽、克重、备料要求和八个现场签认工序。备货来源明确显示“备货创建”。

`buildDyeingWorkOrderRouteCardPrintDocument` 委托给专用构建器，其他工艺的通用任务流转卡不改变。

- [ ] **步骤 4：运行专项和打印回归检查**

运行：

```bash
npm run check:dye-work-order-online-alignment
npm run check:dyeing-workflow
npm run test:print-service-post-route-card:e2e
```

预期：全部 PASS；单张和多张流程卡均包含平台加工单号。

- [ ] **步骤 5：提交导出和流程卡**

```bash
git add src/pages/print/templates/dye-work-order-flow-card-template.ts src/pages/process-factory/dyeing/work-orders.ts src/pages/print/templates/task-route-card-template.ts src/data/fcs/print-template-registry.ts scripts/check-dye-work-order-online-alignment.ts
git commit -m "feat: add dye work order exports and flow card"
```

---

### 任务 6：让 PDA 动作推进 PFOS 同一状态

**文件：**
- 修改：`src/pages/pda-task-receive.ts`
- 修改：`src/pages/pda-exec-detail.ts`
- 修改：`src/data/fcs/process-action-writeback-service.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`scripts/check-dye-work-order-online-alignment.ts`

- [ ] **步骤 1：增加失败的 PDA 映射和顺序检查**

```ts
const pdaOrder = listDyeWorkOrders().find((item) => item.dyeOrderId !== order.dyeOrderId)!
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
    action: '开工', operatorName: '操作员', operatedAt: '2026-07-16 08:00:00', source: 'PDA',
  }),
  /请先接单/,
)
advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
  action: '接单', operatorName: '操作员', operatedAt: '2026-07-16 08:01:00', source: 'PDA',
})
advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
  action: '开工', operatorName: '操作员', operatedAt: '2026-07-16 08:02:00', source: 'PDA',
})
assert.throws(
  () => advanceDyeWorkOrderOnlineStatus(pdaOrder.dyeOrderId, {
    action: '交出', operatorName: '操作员', operatedAt: '2026-07-16 08:03:00', source: 'PDA',
  }),
  /请先完工/,
)
```

- [ ] **步骤 2：运行检查并确认失败**

运行：`npm run check:dye-work-order-online-alignment`

预期：FAIL，因为当前 PDA 动作尚未写入线上状态域或顺序校验尚未启用。

- [ ] **步骤 3：在既有动作成功点写入统一状态**

接入规则：

```ts
// pda-task-receive.ts：确认接单成功后
recordDyeWorkOrderPdaAcceptance(taskId, by, acceptedAt)

// pda-exec-detail.ts：startDyeing 成功后
advanceDyeWorkOrderOnlineStatus(dyeOrder.dyeOrderId, {
  action: '开工', operatorName: session.displayName, operatedAt: nowTimestamp(), source: 'PDA',
})

// completeDyeing 成功后
advanceDyeWorkOrderOnlineStatus(dyeOrder.dyeOrderId, {
  action: '完工', operatorName: session.displayName, operatedAt: nowTimestamp(), source: 'PDA',
  completedQty: outputQty, lossQty: Math.max(0, inputQty - outputQty),
})
```

`DYE_SUBMIT_HANDOVER` 写回成功后推进“待审核”。收货确认根据累计实收数量，小于应收数量推进“部分入库”，达到应收数量推进“已完成”。所有调用必须发生在既有业务动作成功之后，失败动作不能留下状态日志。

PDA 页面展示 `getDyeWorkOrderOnlineRecord(...).status`，但主按钮仍由当前允许动作决定；接单状态仍显示“等待处理”，下一动作明确为“开工”。

- [ ] **步骤 4：运行 PDA、染色和专项检查**

运行：

```bash
npm run check:dye-work-order-online-alignment
npm run check:dyeing-workflow
npm run check:pda-exec-task-detail
```

预期：全部 PASS，PFOS 与 PDA 显示同一七状态。

- [ ] **步骤 5：提交 PDA 状态接通**

```bash
git add src/pages/pda-task-receive.ts src/pages/pda-exec-detail.ts src/data/fcs/process-action-writeback-service.ts src/data/fcs/dyeing-task-domain.ts scripts/check-dye-work-order-online-alignment.ts
git commit -m "feat: sync dye PDA actions to online status"
```

---

### 任务 7：补齐真实浏览器验收和原型治理记录

**文件：**
- 创建：`tests/dye-work-order-online-alignment.spec.ts`
- 创建：`docs/prototype-review-records/2026-07-16-dye-work-order-online-alignment.md`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的 Playwright 验收**

```ts
import { expect, test } from '@playwright/test'

test('染色加工单线上列表、人工编辑、日志、打印与 PDA 状态一致', async ({ page, context }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

  await page.goto('/fcs/craft/dyeing/work-orders')
  await expect(page.getByRole('heading', { name: '染色加工单' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导出备料数据' })).toBeVisible()
  await expect(page.getByRole('button', { name: '批量打印染整生产流程卡' })).toBeVisible()

  const firstRow = page.locator('tbody tr').filter({ hasText: '生产单' }).first()
  const workOrderNo = (await firstRow.locator('[data-work-order-no]').textContent())!.trim()
  await firstRow.getByRole('button', { name: '编辑' }).click()
  await expect(page.getByRole('heading', { name: `编辑染色加工单 · ${workOrderNo}` })).toBeVisible()
  await expect(page.getByLabel('计划数量')).toBeDisabled()
  await page.getByLabel('状态').selectOption({ label: '染色中' })
  await page.getByLabel('原料数量').fill('83')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(firstRow).toContainText('染色中')

  await firstRow.getByRole('button', { name: '日志' }).click()
  await expect(page.getByText('PFOS人工编辑')).toBeVisible()
  await expect(page.getByText('等待处理 → 染色中')).toBeVisible()
  await page.getByRole('button', { name: '关闭日志' }).click()

  const popupPromise = context.waitForEvent('page')
  await firstRow.getByRole('button', { name: '打印流程卡' }).click()
  const printPage = await popupPromise
  await expect(printPage.getByText('染整生产流程卡')).toBeVisible()
  await expect(printPage.getByText(workOrderNo)).toBeVisible()
  expect(errors).toEqual([])
})
```

第二个用例从 PDA 待接单进入同一任务，依次完成接单和开工，再返回 PFOS 验证状态为“染色中”；继续完成染色和交出后验证状态为“待审核”。测试中所有按钮响应时间必须小于 200ms，忽略 Vite 首次异步模块冷编译时间并先执行一次可观察预热。

- [ ] **步骤 2：运行端到端测试并确认失败**

运行：`npm run test:dye-work-order-online-alignment:e2e`

预期：FAIL，直到页面、弹窗、打印和 PDA 数据测试标识全部接通。

- [ ] **步骤 3：补齐测试标识、治理记录和演示数据**

只为稳定定位增加业务语义明确的 `data-testid` 或 `data-work-order-no`。审查记录填写：角色匹配、信息负荷、数量与状态、扫码与识别、防错、协作关系、追溯和低分辨率结论。明确 PFOS 为主管/业务端，PDA 为员工执行端；记录没有列表治理例外。

在 `package.json` 的 `scripts` 中增加：

```json
"test:dye-work-order-online-alignment:e2e": "playwright test tests/dye-work-order-online-alignment.spec.ts"
```

- [ ] **步骤 4：运行端到端和治理检查**

运行：

```bash
npm run test:dye-work-order-online-alignment:e2e
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
```

预期：全部 PASS；Chromium 中没有控制台错误，弹窗操作不引起整页闪烁或滚动位置丢失。

- [ ] **步骤 5：提交端到端验收和治理记录**

```bash
git add tests/dye-work-order-online-alignment.spec.ts docs/prototype-review-records/2026-07-16-dye-work-order-online-alignment.md package.json src/pages/process-factory/dyeing/work-orders.ts src/pages/process-factory/dyeing/work-order-overlays.ts
git commit -m "test: verify dye work order online alignment"
```

---

### 任务 8：完整回归、视觉验收和收口

**文件：**
- 修改：仅限回归发现的本功能相关文件
- 审查：`docs/prototype-review-records/2026-07-16-dye-work-order-online-alignment.md`

- [x] **步骤 1：运行完整相关检查**

```bash
npm run check:production-process-work-order-generation
npm run check:production-order-changes
npm run check:dyeing-workflow
npm run check:combined-dyeing
npm run check:dye-work-order-online-alignment
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
npm run build
npm run test:dye-work-order-online-alignment:e2e
npm run test:combined-dyeing:e2e
```

预期：全部 PASS。合并染色专项和端到端结果必须保持不变。

- [x] **步骤 2：在 1366×768 验收 PFOS 页面**

检查：

- 页面主体无横向溢出。
- 表格容器内部可横向滚动。
- 平台加工单号固定左侧，操作栏固定右侧。
- 查看、编辑、日志弹窗按钮始终可见。
- 输入、弹窗开关和行操作不整页闪烁。
- 列显示、列顺序、冻结和每页条数持久化；当前页和排序重新进入后恢复默认。

- [x] **步骤 3：在 1280×720 验收最低分辨率**

检查编辑弹窗可滚动且“保存修改”可达；高风险二次确认不被遮挡；流程卡打印预览不截断二维码、加工单号和工序签认区。

- [x] **步骤 4：同步 CodeGraph 并确认工作树**

```bash
codegraph sync
codegraph status
git status --short
```

预期：CodeGraph 显示 `Index is up to date`；工作树仅包含本轮确认要提交的文件，或在最终修复提交后为空。

- [x] **步骤 5：提交最终收口修复**

如果视觉或回归发现本功能问题：

```bash
git add src tests scripts docs/prototype-review-records/2026-07-16-dye-work-order-online-alignment.md package.json
git commit -m "fix: finish dye work order online alignment"
```

如果没有产生新修改，不创建空提交，并在交付说明中列出所有已通过的命令。

---

## 规格覆盖自检

| 规格要求 | 对应任务 |
| --- | --- |
| 标准列表、查询、汇总、线上字段 | 任务 2、3 |
| 四个批量操作 | 任务 3、5 |
| 查看、编辑、日志弹窗 | 任务 1、4 |
| PFOS 人工选择七状态 | 任务 1、4 |
| PDA 接单、开工、完工、交出、入库映射 | 任务 1、6 |
| 平台加工单号唯一 | 任务 2、3、5、7 |
| 中印双语单张/批量流程卡 | 任务 5、7 |
| 取消复杂详情入口 | 任务 4 |
| 合并染色不变 | 任务 8 回归 |
| 原型治理、列表治理、低分辨率和 200ms | 任务 7、8 |

计划范围只包含已确认的原型字段和动作，不包含未来扩展、后端接口、权限或数据库建设。

---

### 任务 9：对抗式审查修复与验收缺口收口

**文件：**
- 修改：`scripts/check-dye-work-order-online-alignment.ts`
- 修改：`scripts/check-process-work-order-unification.ts`
- 修改：`tests/dye-work-order-online-alignment.spec.ts`
- 修改：`tests/process-work-order-unification.spec.ts`
- 修改：`src/data/fcs/dye-work-order-online-domain.ts`
- 修改：`src/data/fcs/dye-work-order-online-view.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`src/data/fcs/process-action-writeback-service.ts`
- 修改：`src/pages/pda-exec-detail.ts`
- 修改：`src/pages/process-factory/dyeing/work-order-overlays.ts`
- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`src/pages/print/templates/dye-work-order-flow-card-template.ts`
- 修改：`src/pages/print/print-styles.ts`
- 修改：`docs/prototype-review-records/2026-07-16-dye-work-order-online-alignment.md`

- [x] **步骤 1：先补红灯测试**

在静态专项检查中增加以下断言并运行，确认因当前缺陷失败：

```bash
npm run check:dye-work-order-online-alignment
npm run check:process-work-order-unification
```

断言覆盖：取消或回退后 PDA 动作阻断；工厂归属同步真实加工单与 PDA 任务；实际数量为 0 不回退；正式生产单快照不按数组序号伪造；超过 10 条日志可翻页；流程卡输出图片、卡序号、布料样品 SPU 和批号；高风险确认明确说明目标状态及 PDA 影响；统一加工单不再依赖复杂详情页。

- [x] **步骤 2：统一 PFOS、PDA 和真实加工单状态/归属**

在 `dye-work-order-online-domain.ts` 提供 PDA 动作预校验，由 `process-action-writeback-service.ts` 在修改底层任务前调用；PDA 按钮读取同一允许动作结果。PFOS 保存工厂时由 `dyeing-task-domain.ts` 同步 `DyeWorkOrder.dyeFactoryId/dyeFactoryName` 及同 ID PDA 任务的分配字段，再更新线上记录和永久日志。

- [x] **步骤 3：修复列表事实、数量和日志分页**

数值只在 `null/undefined` 时回退，明确的 `0` 原样展示。商品、物料、颜色和生产来源优先读取 `formalProductionOrderSnapshot` 与加工单字段；缺少事实显示 `—`，不再按数组序号拼接编号或属性。日志弹窗按每页 10 条真实分页，显示总数并支持上一页、下一页。

- [x] **步骤 4：补齐流程卡和列表治理验收**

流程卡头部使用“色样/基础信息/二维码”三列并真正输出图片块；增加卡序号、布料样品 SPU、批号。页面级 E2E 验证列顺序、冻结和每页条数持久化，横向滚动时平台加工单号固定左侧、操作栏固定右侧。

- [x] **步骤 5：迁移统一加工单旧验收并全量验证**

将旧“查看详情/审核记录/染色配方/移动端详情入口”验收迁移为当前确认的列表内查看、编辑、日志、打印和同一平台加工单号跨 PFOS/PDA 一致性。运行：

```bash
npm run check:dye-work-order-online-alignment
npm run check:process-work-order-unification
npm run check:production-process-work-order-generation
npm run check:production-order-changes
npm run check:dyeing-workflow
npm run check:combined-dyeing
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
npm run build
npm run test:dye-work-order-online-alignment:e2e
npm run test:process-work-order-unification:e2e
npm run test:combined-dyeing:e2e
```

预期：全部 PASS；如仓库既有非本功能基线仍失败，必须提供可复现证据并确认本轮没有扩大失败范围。
