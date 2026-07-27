# 裁床中转袋整袋流转实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按已确认规格实现裁床中转袋整袋流转：Web 以输入录入、PDA 以扫码录入；裁床工厂 PDA「仓管 → 待交出仓」保留 5 个操作，并把装袋、入仓、交出收口为袋级事实和极简操作页。

**架构：** 保留现有 Vite、Vanilla TypeScript 字符串模板和运行时事件账，不引入后端或新状态框架。先建立“一个流转周期内一个袋只属于一个生产单”的袋级快照，再让装袋、入仓、交出分别写入独立事件；PDA 与 Web 只负责不同录入方式，共用同一校验和投影。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有本地 Mock 数据、Playwright、Node/tsx 治理脚本、CodeGraph。

---

## 计划边界

本计划实现：

- 菲票装袋。
- 中转袋入仓。
- 中转袋交出。
- 裁床工厂 PDA「仓管 → 待交出仓」5 个操作入口。
- Web 与 PDA 的袋级同账。
- 历史「交出装袋确认」只读兼容。
- 页面极简化、成功重置、失败保留和自动化验收。

本计划不改造：

- 特殊工艺回仓的业务步骤。
- 菲票打编号的业务步骤。
- 生产单合并。
- 真实后端、数据库和扫码硬件接口。
- 中转袋撤销、拆袋交出或部分交出。

本计划取代：

- `docs/superpowers/plans/2026-07-25-cutting-wait-handover-transfer-bag-flow-implementation.md` 中关于多生产单混装、交出前逐票分拣、交出装袋确认双阶段的实现安排。

## 文件结构

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `src/data/fcs/cutting/cutting-runtime-event-ledger.ts` | 修改 | 增加「中转袋交出」事件和袋流转周期字段，保留旧事件读取类型 |
| `src/pages/process-factory/cutting/wait-handover-runtime.ts` | 修改 | 建立袋级快照、袋状态校验、装袋/入仓/整袋交出写入函数 |
| `src/pages/pda-cutting-wait-handover-actions.ts` | 创建 | 统一待交出仓 5 个操作的名称、顺序和直达路由 |
| `src/pages/pda-warehouse.ts` | 修改 | 裁床工厂仓管 Tab 展示 5 个无副标题操作 |
| `src/pages/pda-warehouse-wait-handover.ts` | 修改 | 删除候选列表与中间页，保留 5 个直接操作入口和历史链接兼容 |
| `src/pages/pda-cutting-inbound.ts` | 修改 | 分离菲票装袋与中转袋入仓，删除冗余卡片，完成成功重置 |
| `src/pages/pda-cutting-handover.ts` | 修改 | 将拆袋式扫描改为扫袋、扫车缝任务、确认整袋交出 |
| `src/pages/pda-warehouse-shared.ts` | 修改 | Toast 增加成功色调，供装袋成功反馈使用 |
| `src/pages/process-factory/cutting/warehouse-hub.ts` | 修改 | Web 装袋、入仓、交出表单改为输入式袋级操作 |
| `scripts/check-cutting-wait-handover-transfer-bag-flow.ts` | 修改 | 新规格静态契约与旧口径禁用检查 |
| `scripts/check-cutting-warehouse-management-switch.ts` | 修改 | Web/PDA 新名称和入口断言 |
| `scripts/check-factory-mobile-app-redesign.ts` | 修改 | 仓管 Tab 的 5 个操作断言 |
| `scripts/check-cutting-clean-mainline.ts` | 修改 | 事件名称与整袋交出断言 |
| `tests/cutting-runtime-event-ledger-pda-web.spec.ts` | 修改 | Web/PDA 同账、成功刷新、失败保留、整袋交出 E2E |
| `package.json` | 修改 | 注册本功能专用检查命令 |
| `docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md` | 创建 | 原型设计治理审查记录 |

## 规格覆盖矩阵

| 规格内容 | 实现任务 |
| --- | --- |
| 一个袋只属于一个生产单 | 任务 1、任务 3 |
| 菲票只在装袋时录入 | 任务 1、任务 3、任务 5 |
| 入仓只绑定袋与库位 | 任务 1、任务 3、任务 5 |
| 交出只绑定完整袋与一个车缝任务 | 任务 1、任务 4、任务 5 |
| PDA 待交出仓 5 个操作 | 任务 2 |
| 3 个中转袋操作直接进入扫码页 | 任务 2 |
| 无待入仓菲票和冗余卡片 | 任务 2、任务 3、任务 4 |
| 装袋成功提示并刷新新界面 | 任务 3、任务 6 |
| 失败保留扫描数据 | 任务 3、任务 6 |
| Web 输入、PDA 扫码、同一袋级事实 | 任务 1、任务 5、任务 6 |
| 历史旧事件兼容 | 任务 1、任务 6 |
| 幂等、错袋、错任务、跨生产单阻断 | 任务 1、任务 3、任务 4、任务 6 |

### 任务 1：先收口袋级运行时事实

**文件：**

- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`package.json`

- [ ] **步骤 1：把专用检查改成新规格的失败契约**

在 `scripts/check-cutting-wait-handover-transfer-bag-flow.ts` 中删除“多生产单混装”和“交出装袋确认双阶段”断言，加入以下核心断言：

```ts
const ledger = read('src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
const runtime = read('src/pages/process-factory/cutting/wait-handover-runtime.ts')
const pdaWarehouse = read('src/pages/pda-warehouse.ts')
const pdaWaitHandover = read('src/pages/pda-warehouse-wait-handover.ts')
const pdaInbound = read('src/pages/pda-cutting-inbound.ts')
const pdaHandover = read('src/pages/pda-cutting-handover.ts')

assertContains(ledger, "'中转袋交出'", '新事件必须使用中转袋交出')
assertContains(runtime, 'getActiveWaitHandoverTransferBag', '必须能够按袋号取得当前流转周期快照')
assertContains(runtime, 'appendWaitHandoverTransferBagHandoverEvent', '必须按整袋写入交出事件')
assertContains(runtime, '一个中转袋只能属于一个生产单', '必须在事实层阻断跨生产单装袋')
assertContains(pdaWarehouse, 'buildCuttingWaitHandoverActions', '仓管入口必须使用统一的 5 操作配置')
assertNotContains(pdaWaitHandover, '待入仓菲票', 'PDA 不得保留待入仓菲票列表')
assertNotContains(pdaInbound, '允许与不同生产单', 'PDA 不得继续允许跨生产单混装')
assertNotContains(pdaInbound, 'data-pda-cut-inbound-action="add-ticket"', '扫菲票后必须自动加入，不能再点加入按钮')
assertNotContains(pdaHandover, 'pickingFeiTicketScan', '中转袋交出不得逐票扫描')
```

在 `package.json` 注册：

```json
"check:cutting-transfer-bag-whole-flow": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts"
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:cutting-transfer-bag-whole-flow
```

预期：FAIL，至少报告缺少 `中转袋交出`、`getActiveWaitHandoverTransferBag` 和 `appendWaitHandoverTransferBagHandoverEvent`。

- [ ] **步骤 3：增加袋流转周期和新事件类型**

在 `cutting-runtime-event-ledger.ts` 中增加：

在既有 `CuttingRuntimeEventType` 联合类型中加入：

```ts
| '中转袋交出'
```

既有 `| '交出装袋确认'` 只用于读取历史数据，不删除。在既有 `CuttingRuntimeRefs` 中加入：

```ts
transferBagCycleId?: string
sewingTaskId?: string
sewingTaskNo?: string
receiverFactoryId?: string
receiverFactoryName?: string
```

新增完整 payload：

```ts

export interface TransferBagHandoverPayload {
  transferBagCycleId: string
  bagCode: string
  productionOrderId: string
  productionOrderNo: string
  sewingTaskId: string
  sewingTaskNo: string
  receiverFactoryId: string
  receiverFactoryName: string
  feiTicketItems: FeiTicketInboundPayload['feiTicketItems']
  totalPieceQty: number
  handedOverBy: string
  handedOverAt: string
}
```

同时完成四个类型闭环：

```ts
| TransferBagHandoverPayload
'中转袋交出',
中转袋交出: 'BAG-HANDOVER',
```

实际编辑时把新成员并入现有 `CuttingRuntimeEventPayload`、`isRuntimeEventType` 数组和 `eventTypeCode()` 的完整映射，不能另建第二套映射。`normalizeRefs()` 同步读取新增的周期、任务和工厂字段。旧字符串保留在联合类型和历史映射中，但所有新写入不得再使用 `交出装袋确认`。

- [ ] **步骤 4：建立袋级快照投影**

在 `wait-handover-runtime.ts` 中增加以下公开契约：

```ts
export type WaitHandoverTransferBagStatus =
  | '已装袋待入仓'
  | '已入待交出仓'
  | '已交出'

export interface WaitHandoverTransferBagSnapshot {
  transferBagCycleId: string
  bagCode: string
  productionOrderId: string
  productionOrderNo: string
  tickets: WaitHandoverRuntimeTicketInput[]
  totalPieceQty: number
  status: WaitHandoverTransferBagStatus
  warehouseArea?: string
  locationCode?: string
  sewingTaskId?: string
  sewingTaskNo?: string
  receiverFactoryId?: string
  receiverFactoryName?: string
}

export function listActiveWaitHandoverTransferBags(): WaitHandoverTransferBagSnapshot[]
export function getActiveWaitHandoverTransferBag(bagCode: string): WaitHandoverTransferBagSnapshot | null
```

投影规则：

- `菲票装袋` 创建流转周期和袋内快照。
- `中转袋入仓` 只补库区库位，不改变袋内菲票。
- `中转袋交出` 将当前周期整体改为已交出。
- 历史 `交出装袋确认` 只能映射成历史展示，不成为新活动袋状态。

- [ ] **步骤 5：把三个写入函数改成袋级硬校验**

保留 `appendWaitHandoverBaggingEvent`，但在写入前执行：

```ts
const productionOrderKeys = new Set(
  input.tickets
    .map((ticket) => ticket.productionOrderId || ticket.productionOrderNo)
    .filter(Boolean),
)
if (productionOrderKeys.size !== 1) {
  throw new Error('一个中转袋只能属于一个生产单。')
}
if (getActiveWaitHandoverTransferBag(input.bagCode)) {
  throw new Error('这个中转袋正在流转，不能重复装袋。')
}
```

将入仓函数输入收口为袋号和库位：

```ts
export function appendWaitHandoverInboundEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  warehouseArea: string
  locationCode: string
  occurredAt?: string
}) {
  const bag = requireTransferBagStatus(input.bagCode, '已装袋待入仓')
  const occurredAt = input.occurredAt || new Date().toISOString()
  return appendCuttingRuntimeEvent({
    eventType: '中转袋入仓',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '裁片仓入仓员',
    refs: {
      transferBagCycleId: bag.transferBagCycleId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      feiTicketIds: bag.tickets.map((ticket) => ticket.feiTicketId),
      feiTicketNos: bag.tickets.map((ticket) => ticket.feiTicketNo),
      transferBagCode: bag.bagCode,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'IN',
      qty: bag.totalPieceQty,
      unit: '片',
      toWarehouseArea: input.warehouseArea,
      toLocationCode: input.locationCode,
    },
    payload: {
      transferBagCycleId: bag.transferBagCycleId,
      bagCode: bag.bagCode,
      warehouseArea: input.warehouseArea,
      locationCode: input.locationCode,
      inboundBy: input.operator.operatorName,
      inboundAt: occurredAt,
      feiTicketItems: bag.tickets,
      totalPieceQty: bag.totalPieceQty,
    },
  })
}
```

新增整袋交出函数：

```ts
export function appendWaitHandoverTransferBagHandoverEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  sewingTask: {
    sewingTaskId: string
    sewingTaskNo: string
    productionOrderId: string
    productionOrderNo: string
    receiverFactoryId: string
    receiverFactoryName: string
  }
  occurredAt?: string
}) {
  const bag = requireTransferBagStatus(input.bagCode, '已入待交出仓')
  if (bag.productionOrderId !== input.sewingTask.productionOrderId) {
    throw new Error(`这个袋属于 ${bag.productionOrderNo}，请扫描该生产单下的车缝任务。`)
  }
  const occurredAt = input.occurredAt || new Date().toISOString()
  const payload: TransferBagHandoverPayload = {
    transferBagCycleId: bag.transferBagCycleId,
    bagCode: bag.bagCode,
    productionOrderId: bag.productionOrderId,
    productionOrderNo: bag.productionOrderNo,
    sewingTaskId: input.sewingTask.sewingTaskId,
    sewingTaskNo: input.sewingTask.sewingTaskNo,
    receiverFactoryId: input.sewingTask.receiverFactoryId,
    receiverFactoryName: input.sewingTask.receiverFactoryName,
    feiTicketItems: bag.tickets,
    totalPieceQty: bag.totalPieceQty,
    handedOverBy: input.operator.operatorName,
    handedOverAt: occurredAt,
  }
  return appendCuttingRuntimeEvent({
    eventType: '中转袋交出',
    eventSource: input.source,
    eventStatus: '已同步',
    occurredAt,
    operatorId: input.operator.operatorId,
    operatorName: input.operator.operatorName,
    operatorRole: input.operator.operatorRole || '裁片仓交出员',
    refs: {
      transferBagCycleId: bag.transferBagCycleId,
      productionOrderId: bag.productionOrderId,
      productionOrderNo: bag.productionOrderNo,
      feiTicketIds: bag.tickets.map((ticket) => ticket.feiTicketId),
      feiTicketNos: bag.tickets.map((ticket) => ticket.feiTicketNo),
      transferBagCode: bag.bagCode,
      sewingTaskId: input.sewingTask.sewingTaskId,
      sewingTaskNo: input.sewingTask.sewingTaskNo,
      receiverFactoryId: input.sewingTask.receiverFactoryId,
      receiverFactoryName: input.sewingTask.receiverFactoryName,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: bag.totalPieceQty,
      unit: '片',
      fromWarehouseArea: bag.warehouseArea,
      fromLocationCode: bag.locationCode,
    },
    payload,
  })
}
```

- [ ] **步骤 6：运行专用检查**

运行：

```bash
npm run check:cutting-transfer-bag-whole-flow
```

预期：数据契约相关断言 PASS；页面断言仍可能失败，留给后续任务转绿。

- [ ] **步骤 7：提交事实层**

```bash
git add package.json \
  scripts/check-cutting-wait-handover-transfer-bag-flow.ts \
  src/data/fcs/cutting/cutting-runtime-event-ledger.ts \
  src/pages/process-factory/cutting/wait-handover-runtime.ts
git commit -m "feat: 收口中转袋整袋流转事实"
```

### 任务 2：实现待交出仓 5 个直接入口

**文件：**

- 创建：`src/pages/pda-cutting-wait-handover-actions.ts`
- 修改：`src/pages/pda-warehouse.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- 修改：`scripts/check-factory-mobile-app-redesign.ts`
- 修改：`scripts/check-cutting-warehouse-management-switch.ts`

- [ ] **步骤 1：先写 5 个入口的失败检查**

在两个检查脚本中加入：

```ts
const expectedActions = [
  '菲票装袋',
  '中转袋入仓',
  '中转袋交出',
  '特殊工艺回仓',
  '菲票打编号',
]

expectedActions.forEach((label) => {
  assertContains(pdaWarehouseSource, `title: '${label}'`, `待交出仓缺少 ${label}`)
})
assertNotContains(pdaWarehouseSource, "title: '交出装袋确认'", '入口必须更名为中转袋交出')
assertNotContains(pdaWarehouseSource, "title: '菲票装袋 / 中转袋入仓'", '装袋和入仓不得继续合并')
assertNotContains(pdaWaitHandoverSource, '待入仓菲票', '不得先展示菲票候选列表')
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:factory-mobile-app-redesign
npm run check:cutting-warehouse-management-switch
```

预期：FAIL，报告缺少 `中转袋交出` 或仍存在旧入口。

- [ ] **步骤 3：创建统一的 5 操作配置**

创建 `src/pages/pda-cutting-wait-handover-actions.ts`：

```ts
export type CuttingWaitHandoverActionKey =
  | 'bagging'
  | 'inbound'
  | 'handover'
  | 'special-craft-return'
  | 'numbering'

export interface CuttingWaitHandoverAction {
  key: CuttingWaitHandoverActionKey
  title: string
  route: string
}

export function buildCuttingWaitHandoverActions(firstTaskId: string): CuttingWaitHandoverAction[] {
  return [
    { key: 'bagging', title: '菲票装袋', route: `/fcs/pda/cutting/inbound/${firstTaskId}` },
    { key: 'inbound', title: '中转袋入仓', route: `/fcs/pda/cutting/inbound/${firstTaskId}?action=inbound-location` },
    { key: 'handover', title: '中转袋交出', route: `/fcs/pda/cutting/handover/${firstTaskId}?action=transfer-bag-handover` },
    { key: 'special-craft-return', title: '特殊工艺回仓', route: `/fcs/pda/cutting/handover/${firstTaskId}?action=special-craft-return` },
    { key: 'numbering', title: '菲票打编号', route: '/fcs/pda/cutting/fei-ticket-numbering' },
  ]
}
```

配置中禁止 `subtitle`、待办数量和说明字段。

- [ ] **步骤 4：仓管 Tab 直接使用 5 操作配置**

在 `pda-warehouse.ts` 的裁床分支中：

```ts
const firstTaskId = listPdaCuttingTaskSourceRecords()[0]?.taskId || 'CUTTING-DEMO'
waitHandoverActions = buildCuttingWaitHandoverActions(firstTaskId).map((item) => ({
  title: item.title,
  route: item.route,
}))
```

不要为这 5 个操作传入 `subtitle`、`pendingCount` 或 `tone`。

- [ ] **步骤 5：删除待交出仓中间页内容**

在 `pda-warehouse-wait-handover.ts`：

- 删除 `renderCuttingTicketCandidate`。
- 删除 `renderCuttingBaggingConfirmTaskList`。
- 删除 `renderCuttingWaitHandoverStarterCard`。
- 删除 `renderCuttingWaitHandoverActionPreview` 中的待入仓菲票、最近记录和任务列表。
- 根页面仅渲染同一套 5 个标题按钮。
- 历史查询参数 `action=handover-bagging-confirm` 映射到新的 `transfer-bag-handover` 路由，不再显示旧页面。

根页面核心模板：

```ts
const actions = buildCuttingWaitHandoverActions(firstTaskId)
return renderPdaFrame(`
  <div class="grid grid-cols-2 gap-3 px-4 pb-5 pt-4">
    ${actions.map((item) => `
      <button type="button"
        class="min-h-14 rounded-2xl border bg-card px-3 py-3 text-left text-sm font-semibold"
        data-nav="${escapeAttr(item.route)}">
        ${escapeHtml(item.title)}
      </button>
    `).join('')}
  </div>
`, 'warehouse', { headerTitle: '裁床待交出仓', disableTodoAutoOpen: true })
```

- [ ] **步骤 6：运行检查**

运行：

```bash
npm run check:factory-mobile-app-redesign
npm run check:cutting-warehouse-management-switch
npm run check:cutting-transfer-bag-whole-flow
```

预期：5 个入口、旧名称、待入仓菲票相关断言全部 PASS。

- [ ] **步骤 7：提交入口改造**

```bash
git add src/pages/pda-cutting-wait-handover-actions.ts \
  src/pages/pda-warehouse.ts \
  src/pages/pda-warehouse-wait-handover.ts \
  scripts/check-factory-mobile-app-redesign.ts \
  scripts/check-cutting-warehouse-management-switch.ts
git commit -m "feat: 简化待交出仓五个操作入口"
```

### 任务 3：实现 PDA 菲票装袋与中转袋入仓

**文件：**

- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-warehouse-shared.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`

- [ ] **步骤 1：先写装袋与入仓的失败 E2E**

在 `tests/cutting-runtime-event-ledger-pda-web.spec.ts` 新增测试：

```ts
test('中转袋整袋：PDA 装袋成功后提示并刷新新界面', async ({ page }) => {
  await seedCuttingPdaSession(page)
  const ticketNo = await getFirstPrintedFeiTicketNo(page)
  await gotoPda(page, '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307')

  await page.locator('[data-pda-cut-inbound-field="carrierCode"]').fill('BAG-PDA-WHOLE-001')
  await page.locator('[data-pda-cut-inbound-field="scanCode"]').fill(ticketNo)
  await expect(page.locator('[data-pda-cut-inbound-summary]')).toContainText('1 张')
  await page.locator('[data-pda-cut-inbound-action="confirm"]').click()

  await expect(page.getByText('装袋成功', { exact: true })).toBeVisible()
  await expect(page.locator('[data-pda-cut-inbound-field="carrierCode"]')).toHaveValue('')
  await expect(page.locator('[data-pda-cut-inbound-summary]')).toContainText('0 张')
  await expect(page).toHaveURL(/\/fcs\/pda\/cutting\/inbound\//)
})

test('中转袋整袋：PDA 入仓不出现菲票扫码', async ({ page }) => {
  await gotoPda(page, '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307?action=inbound-location')
  await expect(page.locator('[data-pda-cut-inbound-field="carrierCode"]')).toBeVisible()
  await expect(page.locator('[data-pda-cut-inbound-field="locationCode"]')).toBeVisible()
  await expect(page.locator('[data-pda-cut-inbound-field="scanCode"]')).toHaveCount(0)
  await expect(page.getByText('待入仓菲票')).toHaveCount(0)
})
```

再增加失败保留用例：模拟校验失败后，袋码与已扫菲票数量保持不变。

- [ ] **步骤 2：运行 E2E 并确认失败**

运行：

```bash
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "中转袋整袋：PDA"
```

预期：FAIL，当前页面仍有信息卡片、入仓仍要求菲票、成功后未清空袋码。

- [ ] **步骤 3：为 Toast 增加成功色调**

将 `showPdaWarehouseActionToast` 改为：

```ts
export function showPdaWarehouseActionToast(
  message: string,
  tone: 'success' | 'error' = 'error',
): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const rootId = 'pda-warehouse-action-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-4 top-20 z-[140] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }
  const toast = document.createElement('div')
  toast.className = tone === 'success'
    ? 'pointer-events-auto rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-md'
    : 'pointer-events-auto rounded-md border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-md'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
    if (root?.childElementCount === 0) root.remove()
  }, 3000)
}
```

默认值保持 `error`，避免改变既有错误调用者。

- [ ] **步骤 4：收口装袋页面**

在 `pda-cutting-inbound.ts` 中：

- 删除 `renderPdaCuttingExecutionHero`。
- 删除 `renderInboundStatus` 和 `renderInboundHistory`。
- 删除生产单、铺布单、面料、当前情况、当前阶段、最近记录卡片。
- 页面只渲染袋码、菲票码、已扫数量、最后扫描结果和一个确认按钮。
- 删除可见的「加入菲票」按钮；扫码输入停止后自动校验并加入。
- 扫描成功后只更新计数与最后扫描结果，扫码输入自动清空并继续等待下一张。
- `validateInboundScan` 增加同生产单校验。

为扫码输入增加跳过整页重绘标记：

```html
<input
  data-pda-cut-inbound-field="scanCode"
  data-skip-page-rerender="true"
  autocomplete="off"
/>
```

使用 150ms debounce 模拟扫码枪一次性提交，不在每个 `input` 字符后重绘：

```ts
function scheduleInboundTicketScan(taskId: string, form: InboundFormState): void {
  window.clearTimeout(form.scanTimerId)
  form.scanTimerId = window.setTimeout(() => {
    const validation = validateInboundScan(form, form.scanCode)
    if (!validation.ok || !validation.ticket) {
      form.feedbackMessage = validation.reason
    } else {
      form.scannedTicketNos.push(validation.ticket.ticketNo)
      form.lastScanMessage = `${validation.ticket.ticketNo} 已扫入`
      form.scanCode = ''
    }
    window.dispatchEvent(new CustomEvent('higood:request-render'))
  }, 150)
}
```

`InboundFormState` 增加 `scanTimerId?: number`，并在字段事件的 `field === 'scanCode'` 分支调用 `scheduleInboundTicketScan(taskId, form)`。

同生产单校验：

```ts
const firstTicket = form.scannedTicketNos.length
  ? resolveInboundScanTicket(form.scannedTicketNos[0])
  : null
if (
  firstTicket?.productionOrderId
  && ticket.productionOrderId
  && firstTicket.productionOrderId !== ticket.productionOrderId
) {
  return {
    ok: false,
    reason: `这张菲票属于 ${ticket.productionOrderNo}，当前袋属于 ${firstTicket.productionOrderNo}，不能装入同一袋。`,
    ticket,
  }
}
```

- [ ] **步骤 5：收口入仓页面**

`action=inbound-location` 模式只显示：

```html
<input data-pda-cut-inbound-field="carrierCode" />
<input data-pda-cut-inbound-field="locationCode" />
<button data-pda-cut-inbound-action="confirm">确认入仓</button>
```

确认时调用：

```ts
appendWaitHandoverInboundEvent({
  source: 'PDA',
  operator,
  bagCode: form.carrierCode.trim(),
  warehouseArea: resolveWarehouseArea(form.locationCode),
  locationCode: form.locationCode.trim(),
})
```

不得从页面读取或提交 `scannedTicketNos`。

- [ ] **步骤 6：实现成功提示、刷新与失败保留**

增加状态初始化与重置 helper：

```ts
function createInboundFormState(): InboundFormState {
  return {
    operatorName: '仓务操作员',
    carrierCode: '',
    scanCode: '',
    locationCode: '',
    scannedTicketNos: [],
    lastScanMessage: '',
    feedbackMessage: '',
    syncStatus: '',
    submitting: false,
    scanTimerId: undefined,
    backHrefOverride: '',
  }
}

function resetInboundForm(stateKey: string): void {
  getInboundStateStore().set(stateKey, createInboundFormState())
}
```

装袋成功后严格按以下顺序：

```ts
showPdaWarehouseActionToast('装袋成功', 'success')
resetInboundForm(stateKey)
window.dispatchEvent(new CustomEvent('higood:request-render'))
```

失败分支不得调用 `resetInboundForm`；只更新 `feedbackMessage`。点击确认后立即设置按钮禁用，写入完成后恢复，防止重复提交。

- [ ] **步骤 7：运行 E2E**

运行：

```bash
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "中转袋整袋：PDA"
```

预期：PASS。

- [ ] **步骤 8：提交 PDA 装袋与入仓**

```bash
git add src/pages/pda-cutting-inbound.ts \
  src/pages/pda-warehouse-shared.ts \
  tests/cutting-runtime-event-ledger-pda-web.spec.ts
git commit -m "feat: 简化 PDA 中转袋装袋入仓"
```

### 任务 4：实现 PDA 中转袋整袋交出

**文件：**

- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`scripts/check-cutting-clean-mainline.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`

- [ ] **步骤 1：先写整袋交出的失败 E2E**

新增：

```ts
test('中转袋整袋：PDA 交出只扫袋和车缝任务', async ({ page }) => {
  await seedBaggingAndInboundFacts(page, {
    bagCode: 'BAG-PDA-WHOLE-002',
    productionOrderNo: 'PO000123',
  })
  const sewingTask = await getMatchingSewingTask(page, 'PO000123')

  await gotoPda(page, '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307?action=transfer-bag-handover')
  await expect(page.locator('[data-pda-cut-handover-field="transferBagScan"]')).toBeVisible()
  await expect(page.locator('[data-pda-cut-handover-field="sewingTaskScan"]')).toBeVisible()
  await expect(page.locator('[data-pda-cut-handover-field="pickingFeiTicketScan"]')).toHaveCount(0)

  await page.locator('[data-pda-cut-handover-field="transferBagScan"]').fill('BAG-PDA-WHOLE-002')
  await page.locator('[data-pda-cut-handover-field="sewingTaskScan"]').fill(sewingTask.sewingTaskNo)
  await page.locator('[data-pda-cut-handover-action="confirm-transfer-bag-handover"]').click()

  await expectRuntimeEvent(page, '中转袋交出', (event) =>
    event.refs?.transferBagCode === 'BAG-PDA-WHOLE-002'
    && event.refs?.sewingTaskNo === sewingTask.sewingTaskNo,
  )
})
```

另加两个阻断用例：

- 袋未入仓，不能交出。
- 袋与车缝任务生产单不一致，不能交出且不写事件。

- [ ] **步骤 2：运行并确认失败**

运行：

```bash
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "中转袋整袋：PDA 交出"
```

预期：FAIL，当前页面仍要求任务、来源袋、菲票和目标袋。

- [ ] **步骤 3：新增交出模式的最小状态**

在 `HandoverFormState` 中增加：

```ts
transferBagScan: string
sewingTaskScan: string
handoverFeedbackMessage: string
handoverSubmitting: boolean
```

删除新交出模式对以下旧字段的使用：

```ts
pickingTaskScan
sourceBagScan
pickingFeiTicketScan
targetBagScan
handoverFeiTicketScan
```

特殊工艺回仓字段和流程保持不变。

- [ ] **步骤 4：实现车缝任务识别和整袋确认**

从 `buildPdaHandoverPickingProjection()` 中按 `sewingTaskId` 或 `sewingTaskNo` 解析任务：

```ts
function buildPdaSewingTaskAllocationProjection() {
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel)
  return buildSewingTaskAllocationProjectionFromInventory(
    buildInboundTempBagInventoryRecords(inboundTempBags),
  )
}

function resolveScannedSewingTask(scanCode: string) {
  const normalized = scanCode.trim().toUpperCase()
  return buildPdaSewingTaskAllocationProjection().allocations.find((allocation) =>
    [allocation.sewingTaskId, allocation.sewingTaskNo].some(
      (value) => String(value || '').toUpperCase() === normalized,
    ),
  ) || null
}
```

确认动作：

```ts
appendWaitHandoverTransferBagHandoverEvent({
  source: 'PDA',
  operator,
  bagCode: form.transferBagScan.trim(),
  sewingTask: {
    sewingTaskId: allocation.sewingTaskId,
    sewingTaskNo: allocation.sewingTaskNo,
    productionOrderId: allocation.productionOrderIds[0],
    productionOrderNo: allocation.allocatedItems[0]?.productionOrderNo || '',
    receiverFactoryId: allocation.receiverFactoryId,
    receiverFactoryName: allocation.receiverFactoryName,
  },
})
```

页面只显示袋号、车缝任务、系统带出的接收工厂、必要核对数量和「确认交出」按钮。

- [ ] **步骤 5：处理旧链接和旧名称**

- `action=handover-bagging-confirm` 映射到 `transfer-bag-handover`。
- 页面标题、按钮、新反馈统一使用「中转袋交出」。
- 历史 `交出装袋确认` 只在记录映射函数中显示为「中转袋交出（历史）」。
- 新交出流程不得调用 `appendWaitHandoverBaggingConfirmEvent` 或逐票 `appendRuntimeBaggingConfirmEvent`。

- [ ] **步骤 6：运行检查和 E2E**

运行：

```bash
npm run check:cutting-clean-mainline
npm run check:cutting-transfer-bag-whole-flow
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "中转袋整袋：PDA 交出"
```

预期：全部 PASS。

- [ ] **步骤 7：提交整袋交出**

```bash
git add src/pages/pda-cutting-handover.ts \
  scripts/check-cutting-clean-mainline.ts \
  tests/cutting-runtime-event-ledger-pda-web.spec.ts
git commit -m "feat: 实现 PDA 中转袋整袋交出"
```

### 任务 5：将 Web 操作收口到同一袋级事实

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`scripts/check-cutting-warehouse-management-switch.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`

- [ ] **步骤 1：先写 Web 输入式操作失败检查**

静态检查增加：

```ts
assertContains(hubSource, "type WaitHandoverWebAction = 'bagging' | 'inbound' | 'handover'", 'Web 必须保留三个袋级动作')
assertNotContains(hubSource, "'handover-bagging-confirm'", 'Web 不得继续提供交出装袋确认新动作')
assertNotContains(hubSource, '扫码中转袋二维码', 'Web 操作不得以扫码为主要文案')
assertNotContains(hubSource, '扫码菲票', 'Web 操作不得以扫码为主要文案')
assertContains(hubSource, '输入中转袋编号', 'Web 必须使用袋号输入')
assertContains(hubSource, '输入或选择车缝任务', 'Web 交出必须输入或选择车缝任务')
```

E2E 增加 Web 装袋、入仓和交出写入同一事件账的用例。

- [ ] **步骤 2：运行并确认失败**

运行：

```bash
npm run check:cutting-warehouse-management-switch
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "中转袋整袋：Web"
```

预期：FAIL，当前 Web 仍展示扫码步骤和交出装袋确认。

- [ ] **步骤 3：局部重写 Web 三个操作弹窗**

只重写 `warehouse-hub.ts` 内以下当前模块函数，不改其他仓库页面：

- `renderWaitHandoverWebActionDialog`
- `submitWaitHandoverBagging`
- `submitWaitHandoverInbound`
- `submitWaitHandoverRecord`
- 相关 action map、tab label 和事件展示映射

三个表单字段固定为：

```ts
const fieldsByAction = {
  bagging: ['中转袋编号', '菲票编号'],
  inbound: ['中转袋编号', '库区库位'],
  handover: ['中转袋编号', '车缝任务'],
}
```

行为：

- 装袋：输入袋号，可连续输入菲票号，确认后调用 `appendWaitHandoverBaggingEvent`。
- 入仓：输入袋号和库区库位，不输入菲票，调用 `appendWaitHandoverInboundEvent`。
- 交出：输入袋号和车缝任务，接收工厂自动带出，调用 `appendWaitHandoverTransferBagHandoverEvent`。
- 页面不出现菲票勾选、交出数量或部分交出。

- [ ] **步骤 4：统一事件展示和历史兼容**

事件展示映射：

```ts
function getWaitHandoverEventTypeLabel(eventType: CuttingRuntimeEventType): string {
  if (eventType === '交出装袋确认') return '中转袋交出（历史）'
  if (eventType === '中转袋交出') return '中转袋交出'
  return eventType
}
```

新筛选项使用 `中转袋交出`；历史查询同时读取两种事件，但新提交只写新事件。

- [ ] **步骤 5：运行 Web 检查与 E2E**

运行：

```bash
npm run check:cutting-warehouse-management-switch
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "中转袋整袋：Web"
```

预期：PASS。

- [ ] **步骤 6：提交 Web 同账改造**

```bash
git add src/pages/process-factory/cutting/warehouse-hub.ts \
  scripts/check-cutting-warehouse-management-switch.ts \
  tests/cutting-runtime-event-ledger-pda-web.spec.ts
git commit -m "feat: 收口 Web 中转袋整袋操作"
```

### 任务 6：补齐回归、治理记录和浏览器验收

**文件：**

- 修改：`scripts/check-factory-mobile-app-redesign.ts`
- 修改：`scripts/check-cutting-clean-mainline.ts`
- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`
- 创建：`docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md`

- [ ] **步骤 1：更新所有旧口径断言**

运行：

```bash
rg -n "交出装袋确认|待入仓菲票|菲票装袋 / 中转袋入仓" scripts tests
```

逐项分类：

- 新页面、新动作、新事件断言改为 `中转袋交出`。
- 历史兼容测试保留 `交出装袋确认`，并明确断言其只读映射。
- 删除“来源袋→菲票→目标袋”的 E2E。
- 特殊工艺回仓、菲票打编号测试保持原流程。

- [ ] **步骤 2：补齐行为回归**

在 `tests/cutting-runtime-event-ledger-pda-web.spec.ts` 至少覆盖：

```ts
test.describe('裁床中转袋整袋流转', () => {
  test('待交出仓只显示确认的 5 个操作')
  test('菲票装袋拒绝跨生产单菲票')
  test('装袋成功提示后刷新为新界面')
  test('装袋失败保留当前袋号和已扫数量')
  test('入仓只扫袋和库位')
  test('未装袋的袋不能入仓')
  test('交出只扫袋和车缝任务')
  test('未入仓的袋不能交出')
  test('袋与车缝任务生产单不一致时阻断')
  test('同一袋重复交出不产生第二条事实')
  test('Web 与 PDA 读取同一袋级事实')
})
```

- [ ] **步骤 3：填写原型审查记录**

从 `docs/prototype-review-record-template.md` 创建审查记录，至少写明：

- 系统：FCS/PFOS。
- 页面：裁床工厂 PDA 仓管 Tab、PDA 装袋/入仓/交出、Web 待交出仓。
- 角色：裁床仓管、装袋人员、交出人员、主管。
- 端类型：员工执行端 + 管理端。
- 重点结论：少读、少选、少填；扫码自动推进；一页一个主动作；错误保留现场数据；历史旧事件只读。
- 例外：无。

- [ ] **步骤 4：运行全部定向检查**

运行：

```bash
npm run check:cutting-transfer-bag-whole-flow
npm run check:cutting-warehouse-management-switch
npm run check:factory-mobile-app-redesign
npm run check:cutting-clean-mainline
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts --grep "裁床中转袋整袋流转"
```

预期：全部 PASS。

- [ ] **步骤 5：运行治理和构建**

运行：

```bash
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run check:prototype-design-governance -- --all
npm run build
```

预期：全部 PASS，无新增治理例外。

- [ ] **步骤 6：浏览器验收**

使用 1366×768 和 1280×720 两个视口验证：

```text
/fcs/pda/warehouse
/fcs/pda/warehouse/wait-handover?scope=cutting
/fcs/pda/cutting/inbound/<有效裁床任务ID>
/fcs/pda/cutting/inbound/<有效裁床任务ID>?action=inbound-location
/fcs/pda/cutting/handover/<有效裁床任务ID>?action=transfer-bag-handover
/fcs/craft/cutting/warehouse-management/wait-handover
```

逐项确认：

- 仓管 Tab 的待交出仓区域正好 5 个操作，名称和顺序正确。
- 操作按钮没有副标题和说明卡片。
- 菲票装袋无生产单、铺布单、面料、当前情况、当前阶段、最近记录卡片。
- 中转袋入仓无菲票扫码。
- 中转袋交出无菲票扫码、交出数量和部分交出。
- 装袋成功 Toast 可见，随后页面为空白新装袋状态。
- 所有轻交互无整页闪烁，响应时间不超过 200ms。
- 页面主体在两个视口均无横向溢出。

- [ ] **步骤 7：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：索引为 up to date，无 pending files。

- [ ] **步骤 8：提交治理收口**

```bash
git add scripts/check-factory-mobile-app-redesign.ts \
  scripts/check-cutting-clean-mainline.ts \
  scripts/check-cutting-wait-handover-transfer-bag-flow.ts \
  tests/cutting-runtime-event-ledger-pda-web.spec.ts \
  docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md
git commit -m "test: 验证裁床中转袋整袋流转"
```

## 计划自检

- [x] 已覆盖待交出仓 5 个操作，未误删特殊工艺回仓和菲票打编号。
- [x] 已覆盖 3 个中转袋操作直接进入操作页。
- [x] 已覆盖菲票装袋的扫袋、扫菲票、确认装袋 3 步。
- [x] 已覆盖装袋成功提示、清空、刷新和失败保留。
- [x] 已覆盖入仓不扫菲票。
- [x] 已覆盖交出不扫菲票、不输入数量、不拆袋。
- [x] 已覆盖袋与车缝任务生产单一致性。
- [x] 已覆盖一个袋只绑定一个车缝任务。
- [x] 已覆盖 Web 输入与 PDA 扫码同账。
- [x] 已覆盖历史旧事件兼容和新事件禁写旧名称。
- [x] 已覆盖原型审查记录、定向检查、E2E、构建和浏览器验收。
- [x] 未包含待定项、占位实现或与本需求无关的架构重构。
