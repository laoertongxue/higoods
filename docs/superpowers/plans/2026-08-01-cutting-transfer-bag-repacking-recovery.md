# 裁床中转袋拆袋重装、交出、回收与报废实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 在现有 Vanilla TypeScript 原型中建立唯一的中转袋运行事实，完整支持直接整袋交出、拆袋重装、正常/强制回收和报废，并让 Web、PDA、主列表、详情、库位图和交出记录保持一致。

**架构：** 继续使用 `cuttingRuntimeEventLedger` 作为 Web/PDA 共同写入的事实账，新增一个纯业务运行模块负责当前袋票关系、重装守恒、交出资格、回收和报废命令；生命周期模块只从事实推导 3 个主状态和 4 个阶段。大型页面只做输入、局部渲染和调用共享命令，旧中转袋账仅保留主档及历史兼容读取，不再独立决定当前状态。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、浏览器 `localStorage` Mock 事实账、Node/tsx 专项检查、Playwright、CodeGraph。

---

## 1. 实施依据与完成口径

唯一业务规格：

- `docs/superpowers/specs/2026-08-01-cutting-transfer-bag-repacking-recovery-design.md`

本计划替代以下旧计划中的冲突步骤：

- `docs/superpowers/plans/2026-07-30-cutting-transfer-bag-three-status.md`

实施完成必须同时满足：

1. 主状态只有「空闲、使用中、已报废」。
2. 使用中阶段只有「菲票已装袋、入仓暂存中、待交出、已交出待回收」。
3. 一个当前袋只能包含一个生产单；一个袋允许关联多个指向同一工厂的车缝任务。
4. 拆袋重装支持多来源、多结果、来源袋复用、跨周期复用和数量守恒。
5. 重装与交出分别确认；重装后不重新入仓。
6. 交出解除当前袋票关系，但保留不可变交出快照。
7. 回收确认实物空袋；只有空闲袋才能最终报废。
8. Web/PDA 使用同一事实账和同一校验，不存在第二套当前状态。
9. PDA 6 个入口全部位于「待交出仓」卡片内。
10. 车缝工厂内部用袋、协作、分包和成衣装袋不进入实现范围。

## 2. 当前代码事实与改造策略

### 2.1 已核实的当前缺口

| 当前代码 | 核实结果 | 本计划处理 |
| --- | --- | --- |
| `transfer-bag-lifecycle.ts` | 只有 3 个阶段；`PACKED`、`INBOUND_STORED`、`HANDED_OVER_WAITING_RETURN` 都允许 `SCRAP` | 任务 1 增加 `READY_HANDOVER`，收紧动作矩阵 |
| `cutting-runtime-event-ledger.ts` | 有旧 `交出装袋确认`，没有多来源、多结果重装载荷；交出载荷没有多任务快照 | 任务 2 扩展事实合同，旧事件改为只读兼容 |
| `wait-handover-runtime.ts` | 当前袋内快照只找最近 `菲票装袋`；一个事件只能投影一只袋；回收/报废可各自关闭周期 | 任务 3、5、6 改为事件折叠的唯一当前投影 |
| `sewing-dispatch.ts` | 分配投影生成 `BAG-PICK-*` 模拟目标袋 | 任务 4 只保留菲票到任务/工厂归属，不预造结果袋 |
| `warehouse-hub.ts` | Web 只有 4 个动作；保留大量「交出装袋确认」渲染；直接交出要求恰好一个任务 | 任务 7 拆出动作模块并改为 6 个动作 |
| `transfer-bags-*` | 旧 Store、事件账和页面投影共同决定当前状态；回收含成衣数量、清洗、维修；使用中可直接报废 | 任务 8 统一当前投影并简化主列表/详情 |
| `pda-cutting-inbound.ts` | 装袋/入仓另有 `PdaCuttingInboundMockLedger`；已交出袋只能阻断 | 任务 10 改读写共享运行事实并支持强制回收 |
| `pda-cutting-handover.ts` | 交出要求扫描一个车缝任务并写单任务绑定 | 任务 12 按袋内全部任务的唯一接收工厂确认 |
| `pda-cutting-wait-handover-actions.ts` | 当前 5 个入口包含打编号和特殊工艺回仓，缺重装/回收/报废 | 任务 9 改为确认过的 6 个入口 |
| 现有专项检查 | 正向断言 3 阶段、使用中报废、5 个 PDA 入口和单任务绑定 | 任务 1、9、12、15 先改合同再实现 |

### 2.2 实施顺序

```text
生命周期合同
→ 事件合同
→ 当前关系与重装命令
→ 车缝分配和交出资格
→ 回收/报废/特殊工艺回仓
→ Web 六动作
→ 中转袋主列表和详情
→ PDA 六入口及各执行页
→ 历史兼容清理
→ 专项检查、浏览器验收、治理收据
```

任何页面任务都不得在共享事实任务通过前提前写入独立 Mock 状态。

## 3. 文件结构决策

### 3.1 新建文件

| 文件 | 单一职责 |
| --- | --- |
| `src/data/fcs/cutting/transfer-bag-operations.ts` | 折叠当前袋票关系；校验并提交重装、交出资格、回收、强制回收和报废事实 |
| `src/pages/process-factory/cutting/wait-handover-actions.ts` | Web 六个动作的表单状态、提交适配和局部刷新 |
| `src/pages/process-factory/cutting/wait-handover-dialogs.ts` | Web 六动作弹窗/重装工作区字符串模板 |
| `src/pages/pda-cutting-transfer-bag-repack.ts` | PDA 拆袋重装单一主动作页 |
| `src/pages/pda-cutting-transfer-bag-recovery.ts` | PDA 中转袋回收单一主动作页 |
| `src/pages/pda-cutting-transfer-bag-scrap.ts` | PDA 中转袋报废单一主动作页 |
| `scripts/check-transfer-bag-repack-recovery.ts` | 重装、当前关系、回收、强制回收和报废的纯业务门禁 |
| `tests/cutting-transfer-bag-repack-recovery.spec.ts` | Web 六动作和跨动作状态闭环 E2E |
| `tests/pda-cutting-transfer-bag-lifecycle.spec.ts` | PDA 六入口、重装、回收、报废 E2E |
| `docs/prototype-review-records/2026-08-01-cutting-transfer-bag-repacking-recovery.md` | 本次所有受管原型文件的设计治理审查记录 |

### 3.2 重点修改文件

| 文件 | 修改责任 |
| --- | --- |
| `src/data/fcs/cutting/transfer-bag-lifecycle.ts` | 四阶段、动作资格和关闭规则 |
| `src/data/fcs/cutting/cutting-runtime-event-ledger.ts` | 新事件、载荷、引用字段、序列化兼容和幂等标识 |
| `src/data/fcs/cutting/transfer-bag-runtime.ts` | 旧运行 Store 的多任务兼容字段和只读历史归一化 |
| `src/data/fcs/cutting/sewing-dispatch.ts` | 菲票分配归属与同工厂多任务交出资格 |
| `src/pages/process-factory/cutting/wait-handover-runtime.ts` | 页面运行适配、入仓/特殊工艺位置投影、旧事件兼容 |
| `src/pages/process-factory/cutting/warehouse-hub.ts` | Web 工作台入口、记录页签和新动作模块接入 |
| `src/pages/process-factory/cutting/transfer-bags-model.ts` | 主列表/详情读取统一生命周期和当前关系 |
| `src/pages/process-factory/cutting/transfer-bag-return-model.ts` | 删除清洗/维修/成衣数量口径，回收与报废分离 |
| `src/pages/process-factory/cutting/transfer-bags.ts` | 三状态四阶段筛选、资格化动作、标准列表 |
| `src/pages/process-factory/cutting/transfer-bags/handlers.ts` | 移除直接报废关闭，转到共享命令 |
| `src/pages/process-factory/cutting/transfer-bags/dialogs.ts` | 删除旧混装、袋况直接报废表单，改用统一资格提示 |
| `src/pages/process-factory/cutting/transfer-bags/detail.ts` | 当前关系、各事实和历史周期分页详情 |
| `src/pages/pda-cutting-wait-handover-actions.ts` | 待交出仓 6 个固定入口 |
| `src/pages/pda-warehouse-wait-handover.ts` | 渲染 6 个入口并维持现有卡片层级 |
| `src/pages/pda-cutting-inbound.ts` | 共享装袋/入仓事实、强制回收、特殊工艺带袋回仓 |
| `src/pages/pda-cutting-handover.ts` | 同工厂多任务整袋交出 |
| `src/pages/pda-transfer-bag-detail.ts` | 删除车缝接收动作，展示受管事实 |
| `src/router/routes-pda.ts` | 新增 3 个 PDA 执行路由 |
| `src/router/route-renderers.ts` | 新增 3 个异步渲染器 |
| `src/main-handlers/pda-handlers.ts` | 新增 3 个 PDA 事件处理器 |
| `src/main.ts` | 删除新旧 PDA 动作的重复直达分发，只保留统一分发路径 |
| `package.json` | 注册新专项检查并加入 `check:cutting:all` |

### 3.3 不改文件和边界

- 不修改车缝工厂内部页面、后道成衣生产页面和分包协作页面。
- 不新增后端、API、数据库、状态管理框架或 React 页面。
- 不改变中转袋二维码稳定身份格式。
- 不用修改列表页基线或治理脚本绕过门禁。
- 不迁移无关裁床页面。

## 4. 任务依赖

| 任务 | 依赖 | 可交付结果 |
| --- | --- | --- |
| 1 | 无 | 四阶段生命周期合同 |
| 2 | 1 | 新事件和载荷可持久化 |
| 3 | 2 | 当前袋票关系与原子重装 |
| 4 | 3 | 多任务同工厂直接交出 |
| 5 | 3 | 回收、强制回收、报废闭环 |
| 6 | 3、5 | 特殊工艺带袋回仓恢复当前关系 |
| 7 | 3—6 | Web 六动作工作台 |
| 8 | 3—6 | 中转袋主列表和详情统一 |
| 9 | 1、2 | PDA 六入口和路由骨架 |
| 10 | 3、5、6、9 | PDA 装袋与入仓 |
| 11 | 3、9 | PDA 拆袋重装 |
| 12 | 4、9 | PDA 整袋交出 |
| 13 | 5、8、9 | PDA 回收、报废和扫码详情 |
| 14 | 3—13 | 旧写入口和双事实源清理 |
| 15 | 1—14 | 专项静态/运行检查 |
| 16 | 7—15 | 浏览器验收和治理记录 |
| 17 | 1—16 | 全量验证、CodeGraph、任务收据 |

---

### 任务 1：先锁定四阶段生命周期合同

**规格条款：** 设计文档第 6、7、16.1 节。

**文件：**

- 修改：`scripts/check-transfer-bag-three-status.ts:80-310`
- 修改：`src/data/fcs/cutting/transfer-bag-lifecycle.ts:1-226`
- 修改：`tests/cutting-transfer-bag-simplified-statuses.spec.ts:1-70`

- [ ] **步骤 1：把专项检查改成新合同并确认失败**

将阶段和动作断言改为：

```ts
assert.deepEqual(TRANSFER_BAG_FLOW_STAGE_META, {
  PACKED: { label: '菲票已装袋' },
  INBOUND_STORED: { label: '入仓暂存中' },
  READY_HANDOVER: { label: '待交出' },
  HANDED_OVER_WAITING_RETURN: { label: '已交出待回收' },
})

assert.deepEqual(packed.allowedActions, ['INBOUND', 'REPACK'])
assert.deepEqual(inbound.allowedActions, ['REPACK', 'HANDOVER'])
assert.deepEqual(ready.allowedActions, ['REPACK', 'HANDOVER'])
assert.deepEqual(handedOver.allowedActions, [
  'SPECIAL_CRAFT_RETURN',
  'PHYSICAL_RETURN',
  'FORCE_RETURN',
])
assert.deepEqual(idle.allowedActions, ['BAGGING', 'REPACK_TARGET', 'SCRAP'])
assert.deepEqual(disabled.allowedActions, [])
```

运行：

```bash
npm run check:transfer-bag-three-status
```

预期：FAIL，至少提示缺少 `READY_HANDOVER`、`REPACK` 或仍暴露使用中 `SCRAP`。

- [ ] **步骤 2：扩展生命周期类型**

在 `transfer-bag-lifecycle.ts` 定义：

```ts
export type TransferBagFlowStageKey =
  | 'PACKED'
  | 'INBOUND_STORED'
  | 'READY_HANDOVER'
  | 'HANDED_OVER_WAITING_RETURN'

export type TransferBagLifecycleAction =
  | 'BAGGING'
  | 'INBOUND'
  | 'REPACK'
  | 'REPACK_TARGET'
  | 'HANDOVER'
  | 'SPECIAL_CRAFT_RETURN'
  | 'PHYSICAL_RETURN'
  | 'FORCE_RETURN'
  | 'SCRAP'

export type TransferBagLifecycleFactType =
  | 'BAGGING_CONFIRMED'
  | 'INBOUND_CONFIRMED'
  | 'REPACK_RESULT_CONFIRMED'
  | 'REPACK_SOURCE_EMPTIED'
  | 'HANDOVER_CONFIRMED'
  | 'SPECIAL_CRAFT_BAG_RETURNED'
  | 'PHYSICAL_BAG_RETURNED'
  | 'BAG_SCRAPPED'
```

保留旧下游接收事实仅作兼容读取，不让它们改变主状态或阶段。

- [ ] **步骤 3：实现阶段推导和动作矩阵**

实现必须等价于：

```ts
function stageFromFact(fact?: TransferBagLifecycleFact): TransferBagFlowStageKey | null {
  if (fact?.factType === 'BAGGING_CONFIRMED') return 'PACKED'
  if (fact?.factType === 'INBOUND_CONFIRMED' || fact?.factType === 'SPECIAL_CRAFT_BAG_RETURNED') return 'INBOUND_STORED'
  if (fact?.factType === 'REPACK_RESULT_CONFIRMED') return 'READY_HANDOVER'
  if (fact?.factType === 'HANDOVER_CONFIRMED') return 'HANDED_OVER_WAITING_RETURN'
  return null
}

function allowedActionsFor(status: TransferBagMainStatusKey, stage: TransferBagFlowStageKey | null) {
  if (status === 'DISABLED') return []
  if (status === 'IDLE') return ['BAGGING', 'REPACK_TARGET', 'SCRAP']
  if (stage === 'PACKED') return ['INBOUND', 'REPACK']
  if (stage === 'INBOUND_STORED') return ['REPACK', 'HANDOVER']
  if (stage === 'READY_HANDOVER') return ['REPACK', 'HANDOVER']
  if (stage === 'HANDED_OVER_WAITING_RETURN') return ['SPECIAL_CRAFT_RETURN', 'PHYSICAL_RETURN', 'FORCE_RETURN']
  return []
}
```

`REPACK_SOURCE_EMPTIED` 必须关闭该使用周期为 `REUSABLE`；`BAG_SCRAPPED` 只能在没有开放周期时把主状态推成 `DISABLED`。

- [ ] **步骤 4：补充页面可见状态断言**

在 Playwright 用例中断言主列表只显示 3 个主状态、4 个阶段，不出现：

```ts
for (const forbidden of ['待清洗', '待维修', '可用', '已回写', '收货差异']) {
  await expect(page.locator('body')).not.toContainText(forbidden)
}
await expect(page.locator('body')).toContainText('待交出')
```

- [ ] **步骤 5：运行任务 1 检查并提交**

运行：

```bash
npm run check:transfer-bag-three-status
npx playwright test tests/cutting-transfer-bag-simplified-statuses.spec.ts
```

预期：生命周期专项检查 PASS；Playwright 用例 PASS。

提交：

```bash
git add src/data/fcs/cutting/transfer-bag-lifecycle.ts scripts/check-transfer-bag-three-status.ts tests/cutting-transfer-bag-simplified-statuses.spec.ts
git commit -m "refactor(中转袋): 锁定三状态四阶段生命周期"
```

---

### 任务 2：扩展统一事件合同并保持旧数据可读

**规格条款：** 设计文档第 5、9、12.3、13 节。

**文件：**

- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts:14-52, 300-465, 590-810`
- 修改：`scripts/check-transfer-bag-three-status.ts`

- [ ] **步骤 1：先写序列化和旧数据兼容失败用例**

新增断言：

```ts
const restored = deserializeCuttingRuntimeEventLedgerStorage(JSON.stringify({
  events: [repackEvent, recoveryEvent, scrapEvent, legacyBaggingConfirmEvent],
}))
assert.equal(restored.events.length, 4)
assert.equal(restored.events.find((item) => item.eventType === '中转袋拆袋重装')?.payload.repackBatchId, 'REPACK-001')
assert.equal(restored.events.find((item) => item.eventType === '交出装袋确认')?.eventStatus, '已同步')
```

运行 `npm run check:transfer-bag-three-status`，预期 FAIL：`中转袋拆袋重装` 不是合法事件类型或载荷字段不存在。

- [ ] **步骤 2：增加事件类型、引用和快照类型**

在事件账中增加：

```ts
export type CuttingRuntimeEventType =
  // 保留当前联合类型中的全部已有成员
  | '中转袋拆袋重装'

export interface CuttingRuntimeRefs {
  // 保留现有字段
  repackBatchId?: string
  transferBagCodes?: string[]
  sewingTaskIds?: string[]
  sewingTaskNos?: string[]
}

export interface TransferBagTicketFactSnapshot {
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  sewingTaskId: string
  sewingTaskNo: string
  receiverFactoryId: string
  receiverFactoryName: string
}
```

实际修改时把新成员直接加入现有 `CuttingRuntimeEventType` 联合类型，不删除任何已有事件成员。

- [ ] **步骤 3：定义重装、回收和报废载荷**

```ts
export interface TransferBagRepackPayload {
  repackBatchId: string
  sourceBags: Array<{
    bagCode: string
    usageCycleId: string
    beforeTickets: TransferBagTicketFactSnapshot[]
  }>
  resultBags: Array<{
    bagCode: string
    usageCycleId: string
    reusedSourceBag: boolean
    tickets: TransferBagTicketFactSnapshot[]
  }>
  movedTickets: Array<{
    feiTicketId: string
    fromBagCode: string
    toBagCode: string
    pieceQty: number
  }>
  confirmedAt: string
  confirmedBy: string
}

export interface TransferBagRecoveryPayload {
  bagCode: string
  usageCycleId: string
  physicalBagReceived: true
  physicalBagEmpty: true
  recoveryMode: 'NORMAL' | 'FORCED'
  recoveryNode: string
  recoveryLocation: string
  reason: string
  recoveredAt: string
  recoveredBy: string
}

export interface TransferBagScrapPayload {
  bagCode: string
  idleConfirmed: true
  reason: string
  authorizedBy: string
  scrappedAt: string
  scrappedBy: string
}
```

`HandoverRecordSubmitPayload.transferBagUses[]` 增加 `sewingTaskIds`、`sewingTaskNos` 和不可变 `ticketSnapshot`，接收方仍只有一个。

- [ ] **步骤 4：更新标准化、事件编号和联合载荷**

必须同步更新：

- `normalizeRefs()` 对数组字段去空、去重。
- `isRuntimeEventType()` 接受 `中转袋拆袋重装`，继续接受旧 `交出装袋确认`。
- `eventTypeCode()` 为新事件返回 `BAG-REPACK`。
- `CuttingRuntimeEventPayload` 联合类型包含 3 个新载荷。
- `buildCuttingRuntimeEventId()` 把 `repackBatchId` 加入业务键。

旧 `交出装袋确认` 只能被反序列化和投影为历史，后续命令不得再提交该事件类型。

- [ ] **步骤 5：验证事件往返和幂等**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:web-cutting-transfer-bag-actions
```

预期：新事件 serialize/deserialize 往返不丢字段；同一 `idempotencyKey` 只保留一条事实；现有 Web 检查仍 PASS。

提交：

```bash
git add src/data/fcs/cutting/cutting-runtime-event-ledger.ts scripts/check-transfer-bag-three-status.ts
git commit -m "feat(中转袋): 增加重装回收报废事实合同"
```

---

### 任务 3：建立唯一当前袋票关系和原子拆袋重装命令

**规格条款：** 设计文档第 5.2—5.4、8.6、9.2、12.1—12.3 节。

**文件：**

- 创建：`src/data/fcs/cutting/transfer-bag-operations.ts`
- 创建：`scripts/check-transfer-bag-repack-recovery.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts:170-430, 679-1030`
- 修改：`package.json`

- [ ] **步骤 1：先写 5 个重装失败/成功场景**

`check-transfer-bag-repack-recovery.ts` 至少包含：

```ts
assertRepackFails('结果袋混入两个生产单', mixedProductionOrderInput)
assertRepackFails('同一菲票出现在两个结果袋', duplicatedTicketInput)
assertRepackFails('来源菲票在结果中丢失', missingTicketInput)
assertRepackFails('使用无关的使用中袋作为结果袋', unrelatedInUseTargetInput)

const result = submitTransferBagRepack(validManyToManyInput, memoryStorage)
assert.equal(result.event.payload.sourceBags.length, 2)
assert.equal(result.event.payload.resultBags.length, 2)
assert.equal(resolveTransferBagCurrentUse('BAG-A', memoryStorage).flowStage, 'READY_HANDOVER')
assert.equal(resolveTransferBagCurrentUse('BAG-B', memoryStorage).mainStatus, 'IDLE')
```

运行：

```bash
npx tsx scripts/check-transfer-bag-repack-recovery.ts
```

预期：FAIL，模块不存在。

- [ ] **步骤 2：定义当前关系投影和命令输入**

```ts
export interface TransferBagCurrentUse {
  bagCode: string
  usageCycleId: string | null
  productionOrderNo: string
  tickets: TransferBagTicketFactSnapshot[]
  mainStatus: TransferBagMainStatusKey
  flowStage: TransferBagFlowStageKey | null
  latestHandoverEventId: string
  compatibilityBlockedReason: string
}

export interface TransferBagRuntimeOperator {
  operatorId?: string
  operatorName: string
  operatorRole?: string
}

export interface SubmitTransferBagRepackInput {
  repackBatchId: string
  sourceBagCodes: string[]
  results: Array<{
    bagCode: string
    feiTicketIds: string[]
  }>
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}
```

- [ ] **步骤 3：实现逐事件折叠，而不是读取最近首次装袋**

`resolveTransferBagCurrentUse()` 按 `occurredAt + eventId` 正序折叠：

```ts
switch (event.eventType) {
  case '菲票装袋':
    current = fromBaggingSnapshot(event)
    break
  case '中转袋拆袋重装':
    current = fromMatchingRepackResultOrEmptySource(event, bagCode, current)
    break
  case '新增交出记录':
  case '特殊工艺交出':
    current = clearCurrentTicketsButKeepCycle(event, current)
    break
  case '特殊工艺回仓':
    current = restoreSpecialCraftSnapshot(event, current)
    break
  case '中转袋回收':
    current = closeAsIdle(event, current)
    break
  case '中转袋报废':
    current = closeAsDisabled(event, current)
    break
}
```

同时新增 `eventTouchesTransferBag(event, bagCode)`：除现有 `refs.transferBagCode` 外，还要识别 `refs.transferBagCodes`、重装 `sourceBags[].bagCode` 和 `resultBags[].bagCode`。所有生命周期、当前关系和详情查询都复用这个函数，避免多袋事件只被第一只袋看到。

旧 `交出装袋确认` 只在没有新重装事实且能够唯一恢复来源/结果时提供兼容快照；无法唯一判断时设置 `compatibilityBlockedReason`，不猜测当前关系。

- [ ] **步骤 4：实现重装守恒和资格校验**

提交前依次校验：

```ts
assertUnique(sourceBagCodes)
assertAllSourcesArePackedInboundOrReady(sourceViews)
assertEverySourceHasTickets(sourceViews)
assertEveryTicketAppearsExactlyOnce(sourceTicketIds, resultTicketIds)
assertEveryResultContainsOneProductionOrder(results)
assertEveryResultContainsOneReceiverFactory(results)
assertTargetIsIdleReusedSourceOrForcedRecovered(results, sourceViews)
assertPieceQtyUnchanged(sourceTickets, resultTickets)
```

一条 `中转袋拆袋重装` 事件同时保存全部来源前快照、结果后快照和逐票移动；不得循环写多条袋级事件。

- [ ] **步骤 5：明确使用周期处理**

实现规则：

```ts
function resolveResultUsageCycle(input: {
  targetBagCode: string
  sourceBefore?: TransferBagCurrentUse
  resultProductionOrderNo: string
  repackBatchId: string
}): string {
  if (input.sourceBefore?.productionOrderNo === input.resultProductionOrderNo) {
    return input.sourceBefore.usageCycleId!
  }
  return `usage:${input.targetBagCode}:${input.repackBatchId}`
}
```

- 来源袋清空且未复用：投影一个 `REPACK_SOURCE_EMPTIED` 虚拟生命周期事实，关闭旧周期为空闲。
- 来源袋同生产单复用：沿用旧周期，阶段改为待交出。
- 来源袋清空后装另一生产单：同一重装事件中关闭旧周期并创建新周期。
- 新空闲袋：创建新周期，阶段直接为待交出。

- [ ] **步骤 6：让现有运行适配读取统一当前关系**

在 `wait-handover-runtime.ts`：

- `resolveWaitHandoverBaggingSnapshot()` 改为调用 `resolveTransferBagCurrentUse()`。
- `listWaitHandoverLifecycleFacts()` 能为一条重装事件按袋生成结果/清空事实。
- `listWaitHandoverLifecycleCycles()` 同时识别装袋创建和重装创建的周期。
- `listWaitHandoverRuntimeEvents()` 加入重装、回收、报废事件。
- `buildWaitHandoverRuntimeProjection()` 的 `ticketCandidates` 只排除当前有效绑定，不排除历史绑定。
- `buildWaitHandoverLocationOccupancyStates()` 在重装确认后移除全部来源袋的原库位占用，不把 `READY_HANDOVER` 结果袋重新放回库位；页面用「待交出操作区」表达无库位阶段。

- [ ] **步骤 7：注册命令并验证原子性、幂等性**

在 `package.json` 新增：

```json
"check:transfer-bag-repack-recovery": "tsx scripts/check-transfer-bag-repack-recovery.ts"
```

运行：

```bash
npm run check:transfer-bag-repack-recovery
npm run check:transfer-bag-three-status
```

预期：多对多、来源袋复用、跨生产单新周期、空来源袋回空闲全部 PASS；相同 `repackBatchId` 重试不生成第二条事件。

提交：

```bash
git add src/data/fcs/cutting/transfer-bag-operations.ts src/pages/process-factory/cutting/wait-handover-runtime.ts scripts/check-transfer-bag-repack-recovery.ts package.json
git commit -m "feat(中转袋): 建立当前袋票关系和原子重装"
```

---

### 任务 4：按唯一接收工厂支持多车缝任务整袋交出

**规格条款：** 设计文档第 5.5、8.4、8.5、8.7、15.1—15.2 节。

**文件：**

- 修改：`src/data/fcs/cutting/sewing-dispatch.ts:430-550, 1700-1970`
- 修改：`src/data/fcs/cutting/transfer-bag-runtime.ts:102-150, 212-254, 300-330`
- 修改：`src/data/fcs/cutting/transfer-bag-operations.ts`
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- 修改：`scripts/check-cutting-sewing-dispatch.ts`
- 修改：`scripts/check-transfer-bag-repack-recovery.ts`

- [ ] **步骤 1：先把“同工厂多任务允许交出”写成失败测试**

```ts
const eligibility = resolveWholeBagHandoverEligibility({
  currentUse: bagWithTwelveTickets,
  assignments: [
    ...sevenTicketsToTask('SEW-01', 'FACTORY-A'),
    ...fiveTicketsToTask('SEW-02', 'FACTORY-A'),
  ],
})
assert.equal(eligibility.ok, true)
assert.deepEqual(eligibility.sewingTaskNos, ['SEW-01', 'SEW-02'])
assert.equal(eligibility.receiverFactoryId, 'FACTORY-A')

assert.equal(resolveWholeBagHandoverEligibility({
  currentUse: bagWithTwelveTickets,
  assignments: splitTicketsAcrossFactories,
}).reason, '袋内菲票分配给多个车缝工厂，请先拆袋重装。')
```

运行 `npm run check:cutting-sewing-dispatch`，预期 FAIL：当前仍按一袋一任务或预造目标袋。

- [ ] **步骤 2：让分配投影只表达菲票归属**

移除 `BAG-PICK-001/002/003` 等模拟结果袋生成逻辑。保留：

```ts
export interface FeiTicketSewingAssignment {
  feiTicketId: string
  feiTicketNo: string
  sewingTaskId: string
  sewingTaskNo: string
  receiverFactoryId: string
  receiverFactoryName: string
}
```

车缝分配不得自动修改当前袋票关系，也不得把任务号当成袋的唯一绑定。

旧 `TransferCarrierCycleRecord` 保留 `sewingTaskId/sewingTaskNo` 供历史数据读取，同时增加 `sewingTaskIds/sewingTaskNos` 数组；归一化时由数组优先、单值兜底。任何新事实写入只写数组，旧单值不得重新成为当前资格来源。

- [ ] **步骤 3：实现共享整袋交出资格函数**

```ts
export interface WholeBagHandoverEligibility {
  ok: boolean
  reason: string
  receiverFactoryId: string
  receiverFactoryName: string
  sewingTaskIds: string[]
  sewingTaskNos: string[]
  ticketSnapshot: TransferBagTicketFactSnapshot[]
}
```

校验顺序：阶段为 `INBOUND_STORED` 或 `READY_HANDOVER`；当前袋非空；一个生产单；每张票都有分配；所有分配只指向一个接收工厂；不存在未完成/重复交出；提交快照与当前关系完全一致。

`INBOUND_STORED` 交出记录沿用当前待交出仓库区/库位；`READY_HANDOVER` 没有重新入仓位置，交出载荷中的来源位置明确写「待交出操作区」，不得伪造原库位。

- [ ] **步骤 4：扩展交出事实并在确认后清空当前关系**

`HandoverRecordSubmitPayload.transferBagUses[0]` 保存：

```ts
{
  bagUseId,
  bagCode,
  containedFeiTicketIds,
  totalPieceQty,
  sewingTaskIds,
  sewingTaskNos,
  ticketSnapshot,
}
```

交出命令只接受一只物理袋，但允许 `sewingTaskIds.length > 1`；接收工厂只有一个。事件折叠后当前 `tickets=[]`，生命周期仍是 `IN_USE / HANDED_OVER_WAITING_RETURN`。

- [ ] **步骤 5：验证分配与交出资格**

运行：

```bash
npm run check:cutting-sewing-dispatch
npm run check:transfer-bag-repack-recovery
```

预期：同工厂两任务可交出；跨工厂、未分配、快照变化全部被阻断；分配投影不再出现 `BAG-PICK-*`。

提交：

```bash
git add src/data/fcs/cutting/sewing-dispatch.ts src/data/fcs/cutting/transfer-bag-runtime.ts src/data/fcs/cutting/transfer-bag-operations.ts src/data/fcs/cutting/cutting-runtime-event-ledger.ts scripts/check-cutting-sewing-dispatch.ts scripts/check-transfer-bag-repack-recovery.ts
git commit -m "feat(中转袋): 支持同工厂多任务整袋交出"
```

---

### 任务 5：实现正常回收、强制回收和只允许空闲报废

**规格条款：** 设计文档第 8.8—8.10、12、15.5—15.9 节。

**文件：**

- 修改：`src/data/fcs/cutting/transfer-bag-operations.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts:430-540`
- 修改：`scripts/check-transfer-bag-repack-recovery.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts:880-1180`

- [ ] **步骤 1：先写资格矩阵失败测试**

```ts
assertRecoveryFails(packedBag, '这个袋子还有有效菲票，请先拆袋重装。')
assertRecoveryFails(inboundBag, '这个袋子还有有效菲票，请先拆袋重装。')
assertRecoveryFails(readyBag, '这个袋子还有有效菲票，请先拆袋重装。')
assertRecoveryFails(disabledBag, '这个袋子已经报废，不能回收。')
assertScrapFails(handedOverBag, '请先确认实物空袋回收，再报废。')
assertScrapFails(packedBag, '这个袋子还有有效菲票，请先拆袋重装。')
```

运行 `npm run check:transfer-bag-repack-recovery`，预期 FAIL：现有运行函数仍允许使用中直接 `SCRAP`。

- [ ] **步骤 2：实现回收命令**

```ts
export interface RecoverTransferBagInput {
  bagCode: string
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  recoveryMode: 'NORMAL' | 'FORCED'
  recoveryNode: string
  recoveryLocation: string
  reason: string
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}

export function recoverTransferBag(
  input: RecoverTransferBagInput,
  storage?: BrowserStorageLike | null,
): CuttingRuntimeEvent
```

校验：仅 `HANDED_OVER_WAITING_RETURN`；实物收到和空袋必须为真；强制回收必须填写原因；已报废永久阻断。幂等键为 `${usageCycleId}:PHYSICAL_BAG_RETURNED`。

- [ ] **步骤 3：实现只允许空闲报废**

```ts
export interface ScrapTransferBagInput {
  bagCode: string
  reason: string
  authorizedBy: string
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}
```

`submitTransferBagScrap()` 必须读取最新生命周期并断言 `mainStatus === 'IDLE'`；不得通过传入旧 `usageCycleId` 绕过当前状态。幂等键为 `${bagCode}:BAG_SCRAPPED`。

- [ ] **步骤 4：实现“回收后报废”顺序命令**

```ts
export function recoverThenScrapTransferBag(input: {
  recovery: RecoverTransferBagInput
  scrap: Omit<ScrapTransferBagInput, 'bagCode' | 'source' | 'operator'>
}): { recoveryEvent: CuttingRuntimeEvent; scrapEvent: CuttingRuntimeEvent }
```

执行顺序固定为：先提交并重新读取空闲状态，再提交报废。第二步失败时保留已成功的回收事实，袋停留空闲，页面保留报废原因并允许重试；不得回滚或覆盖回收历史。

- [ ] **步骤 5：实现强制回收后继续使用的组合入口**

提供：

```ts
export function ensureTransferBagAvailableForUse(input: {
  bagCode: string
  forceRecovery?: Omit<RecoverTransferBagInput, 'bagCode' | 'recoveryMode'>
}): { recovered: boolean; current: TransferBagCurrentUse }
```

- 空闲：直接返回。
- 已交出待回收且给出完整强制回收确认：先写 `FORCED` 回收，再返回空闲。
- 菲票已装袋/入仓暂存中/待交出：提示先重装转移。
- 已报废：永久阻断。

- [ ] **步骤 6：删除旧运行函数的直接报废通道并验证两条事实**

`appendWaitHandoverScrapEvent()` 改为调用共享 `submitTransferBagScrap()`；`appendWaitHandoverPhysicalReturnEvent()` 改为调用共享回收命令。专项检查断言：

```ts
const outcome = recoverThenScrapTransferBag(recoverAndScrapInput)
assert.equal(outcome.recoveryEvent.eventType, '中转袋回收')
assert.equal(outcome.scrapEvent.eventType, '中转袋报废')
assert(outcome.recoveryEvent.occurredAt <= outcome.scrapEvent.occurredAt)
assert.equal(resolveTransferBagCurrentUse('BAG-A', storage).mainStatus, 'DISABLED')
```

运行：

```bash
npm run check:transfer-bag-repack-recovery
npm run check:transfer-bag-three-status
```

预期：所有资格、两事实顺序、强制回收和已报废永久阻断场景 PASS。

提交：

```bash
git add src/data/fcs/cutting/transfer-bag-operations.ts src/pages/process-factory/cutting/wait-handover-runtime.ts scripts/check-transfer-bag-repack-recovery.ts scripts/check-transfer-bag-three-status.ts
git commit -m "feat(中转袋): 闭环回收强制回收和报废"
```

---

### 任务 6：让特殊工艺带袋回仓恢复当前关系，空袋走回收

**规格条款：** 设计文档第 8.3、9.1、15.9 节。

**文件：**

- 修改：`src/data/fcs/cutting/transfer-bag-operations.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts:950-1010, 1260-1512`
- 修改：`scripts/check-transfer-bag-repack-recovery.ts`
- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`

- [ ] **步骤 1：写 4 个特殊工艺回仓合同场景**

```ts
assertSpecialReturnSucceeds('原袋原票完整回仓', completeBagReturn)
assertSpecialReturnFails('菲票已被其他当前袋占用', occupiedTicketReturn)
assertSpecialReturnFails('实物与原交出快照不一致', mismatchedSnapshotReturn)
assertSpecialReturnFails('物理袋为空', emptyBagReturn, '空袋请执行中转袋回收。')
```

运行新专项检查，预期至少后三个场景 FAIL。

- [ ] **步骤 2：按来源交出快照校验带袋回仓**

增加共享命令：

```ts
export function submitSpecialCraftBagReturn(input: {
  sourceHandoverRecordId: string
  bagCode: string
  returnedTicketIds: string[]
  locationRef: RuntimeWarehouseLocationRef
  operator: TransferBagRuntimeOperator
  source: CuttingRuntimeEventSource
  occurredAt?: string
}): CuttingRuntimeEvent
```

命令从不可变交出快照读取预期菲票；集合必须完全一致。任一菲票存在其他当前绑定、已经作废或缺失时阻断，不能覆盖当前关系。

- [ ] **步骤 3：区分三种回仓实物**

```text
物理袋 + 原交出菲票/裁片 → 特殊工艺带袋回仓，恢复当前关系，阶段入仓暂存中
只有菲票/裁片，没有物理袋 → 只形成特殊工艺无袋回仓记录，不改变袋状态
只有物理空袋，没有菲票/裁片 → 中转袋回收，袋变空闲
```

`buildWaitHandoverLocationOccupancyStates()` 只把第一种放入待交出仓库位；无袋回仓不生成虚拟袋码；空袋回收不占库位。

- [ ] **步骤 4：验证当前关系与位置同步**

运行：

```bash
npm run check:transfer-bag-repack-recovery
npm run check:cutting-wait-handover-transfer-bag-flow
```

预期：带袋回仓恢复原票且阶段为入仓暂存中；无袋/空袋分流正确；库位投影无重复占用。

提交：

```bash
git add src/data/fcs/cutting/transfer-bag-operations.ts src/pages/process-factory/cutting/wait-handover-runtime.ts scripts/check-transfer-bag-repack-recovery.ts scripts/check-cutting-wait-handover-transfer-bag-flow.ts
git commit -m "feat(中转袋): 闭环特殊工艺带袋回仓"
```

---

### 任务 7：把 Web 待交出仓改为六动作单页工作台

**规格条款：** 设计文档第 10、12.3、16.3 节。

**文件：**

- 创建：`src/pages/process-factory/cutting/wait-handover-actions.ts`
- 创建：`src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts:1870-3390, 4590-5677`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`
- 修改：`tests/cutting-wait-handover-web-modal.spec.ts`

- [ ] **步骤 1：先改 Web 静态合同为六动作**

专项检查要求以下动作各出现一次：

```ts
const expectedActions = [
  ['bagging', '菲票装袋'],
  ['inbound', '中转袋入仓'],
  ['repack', '拆袋重装'],
  ['handover', '中转袋交出'],
  ['recovery', '中转袋回收'],
  ['scrap', '中转袋报废'],
] as const
```

同时断言顶部不再出现独立「特殊工艺回仓」动作，交出记录区不出现「交出装袋确认」。运行 `npm run check:web-cutting-transfer-bag-actions`，预期 FAIL。

- [ ] **步骤 2：拆出动作状态和弹窗渲染**

`wait-handover-actions.ts` 负责：

```ts
export type WaitHandoverWebAction =
  | 'bagging'
  | 'inbound'
  | 'repack'
  | 'handover'
  | 'recovery'
  | 'scrap'

export function openWaitHandoverAction(action: WaitHandoverWebAction, bagCode?: string): void
export function handleWaitHandoverActionEvent(target: HTMLElement): boolean
```

`wait-handover-dialogs.ts` 只输出模板：

```ts
export function renderWaitHandoverActionDialog(input: {
  action: WaitHandoverWebAction
  bagCode: string
  model: WaitHandoverActionDialogModel
}): string

export interface WaitHandoverActionDialogModel {
  current: TransferBagCurrentUse | null
  ticketOptions: TransferBagTicketFactSnapshot[]
  repackSources: TransferBagCurrentUse[]
  handoverEligibility: WholeBagHandoverEligibility | null
  latestHandoverSummary: string
  recoveryNodeOptions: string[]
  feedback: string
}
```

不在新文件复制运行事实；提交函数调用任务 3—6 的共享命令。

- [ ] **步骤 3：实现六动作输入**

| 动作 | 必填输入 | 提交结果 |
| --- | --- | --- |
| 菲票装袋 | 袋码、同生产单菲票、操作人 | `IN_USE / PACKED` |
| 中转袋入仓 | 袋码、库区、库位、操作人 | `IN_USE / INBOUND_STORED` |
| 拆袋重装 | 来源袋、结果袋分组、操作人 | 所有非空结果袋 `READY_HANDOVER` |
| 中转袋交出 | 袋码、自动带出任务和唯一工厂、操作人 | `HANDED_OVER_WAITING_RETURN` |
| 中转袋回收 | 袋码、收到/空袋确认、节点、位置、原因 | `IDLE` |
| 中转袋报废 | 袋码、原因、授权人、操作人 | `DISABLED`，或先回收再报废 |

特殊工艺回仓作为「中转袋入仓」弹窗识别到未关闭特殊工艺交出记录后的分支，主按钮仍叫「确认中转袋入仓」。

- [ ] **步骤 4：实现 Web 重装宽工作区**

宽弹窗按四区展示：

```text
来源袋及当前菲票
→ 按接收车缝工厂分组
→ 结果袋和复用选择
→ 来源/结果数量汇总与确认
```

确认区逐袋显示生产单、工厂、菲票张数、裁片片数和清空后会变空闲的来源袋。提交前使用共享命令返回的校验结果，不在 DOM 中自行计算业务资格。

- [ ] **步骤 5：实现强制回收确认和回收后报废**

扫描已交出待回收袋时：

- 装袋/重装结果袋弹出「实物已收到」「实物为空」「强制原因」确认。
- 回收弹窗选择正常或强制，但两者都必须确认实物收到和为空。
- 报废弹窗扫描已交出袋时先展示最近交出记录，再确认回收和报废；成功结果展示两条记录号。
- 扫描 PACKED/INBOUND/READY 时展示当前生产单和菲票数，并提供进入重装的按钮，不显示可提交报废按钮。

- [ ] **步骤 6：保证局部渲染和输入不丢失**

所有业务按钮保留 `data-skip-page-rerender="true"`。输入、步骤切换、结果袋分组只替换弹窗内部对应区域；成功后只触发工作台数据区刷新。失败时不关闭弹窗、不清空输入。

E2E 增加：

```ts
await page.getByRole('button', { name: '拆袋重装' }).click()
await expect(page.locator('[data-wait-handover-modal="repack"]')).toBeVisible()
await expect(page.locator('#app')).toHaveJSProperty('scrollTop', initialScrollTop)
await page.getByRole('button', { name: '确认重装' }).dblclick()
await expect(page.getByText('重装成功，请继续交出。')).toBeVisible()
```

- [ ] **步骤 7：更新记录区和完成记录语义**

- 「中转袋交出」页签只投影 `新增交出记录`。
- 交出行展示记录号、袋码、生产单、全部车缝任务、唯一工厂、张数/片数、交出人/时间。
- `交出装袋确认` 只允许在历史详情中显示为「历史重装记录」，不进入当前待办、统计或顶部动作。
- 列表/明细保持分页。

- [ ] **步骤 8：运行 Web 检查并提交**

运行：

```bash
npm run check:web-cutting-transfer-bag-actions
npm run test:cutting-wait-handover-web-modal:e2e
```

预期：六动作、局部刷新、弹窗输入保留、交出完成记录和双击幂等全部 PASS。

提交：

```bash
git add src/pages/process-factory/cutting/wait-handover-actions.ts src/pages/process-factory/cutting/wait-handover-dialogs.ts src/pages/process-factory/cutting/warehouse-hub.ts scripts/check-web-cutting-transfer-bag-actions.ts tests/cutting-wait-handover-web-modal.spec.ts
git commit -m "feat(待交出仓): 接入中转袋六动作工作台"
```

---

### 任务 8：统一中转袋主列表、回收模型和追溯详情

**规格条款：** 设计文档第 9.2—9.4、10.3、13.1、16.2 节。

**文件：**

- 修改：`src/pages/process-factory/cutting/transfer-bags-model.ts:730-870, 2020-2260, 2700-2910`
- 修改：`src/pages/process-factory/cutting/transfer-bag-return-model.ts:1-427`
- 修改：`src/pages/process-factory/cutting/transfer-bags-projection.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags.ts:620-700, 1170-1450, 1900-2710`
- 修改：`src/pages/process-factory/cutting/transfer-bags/state.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/handlers.ts:600-1250`
- 修改：`src/pages/process-factory/cutting/transfer-bags/dialogs.ts:220-300`
- 修改：`src/pages/process-factory/cutting/transfer-bags/detail.ts:290-1631`
- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：`tests/cutting-transfer-bag-detail-tabs.spec.ts`

- [ ] **步骤 1：先写主列表和详情新合同**

专项检查增加：

```ts
assert.deepEqual(carrierStageOptions, [
  '菲票已装袋',
  '入仓暂存中',
  '待交出',
  '已交出待回收',
])
assert.equal(inUseRow.actions.includes('报废'), false)
assert.equal(idleRow.actions.includes('报废'), true)
assert.equal(detail.currentTickets.length, 0)
assert.equal(detail.handoverSnapshots[0].tickets.length, 12)
```

运行 `npm run check:transfer-bag-three-status`，预期 FAIL。

- [ ] **步骤 2：当前状态只从统一运行事实投影**

`TransferBagCarrierUseStage` 改为：

```ts
export type TransferBagCarrierUseStage =
  | '—'
  | '菲票已装袋'
  | '入仓暂存中'
  | '待交出'
  | '已交出待回收'
```

`buildTransferBagCarrierManagementProjection()` 对每个稳定袋码调用 `resolveTransferBagCurrentUse()`；旧 Store 的 `currentStatus`、`usageStatus`、`currentCycleId` 只作为历史兼容资料，不覆盖运行事实。

- [ ] **步骤 3：简化回收模型**

删除回收界面的业务输入和汇总：

- 成衣回收数量。
- 菲票回收数量。
- 清洁状态。
- 维修需求。
- 待清洗/待维修统计。
- 回收时直接 `SCRAP_CLOSED`。

保留/新增：袋码、实物收到、实物为空、正常/强制、回收节点、位置、原因、操作人、时间和是否继续报废。`closeTransferBagUsageCycle()` 不再根据袋况直接返回 `SCRAP_CLOSED`。

- [ ] **步骤 4：主列表动作严格按资格显示**

```ts
type CarrierAction =
  | '菲票装袋'
  | '中转袋入仓'
  | '拆袋重装'
  | '中转袋交出'
  | '中转袋回收'
  | '报废'
  | '查看详情'

function buildCarrierRowActions(current: TransferBagCurrentUse): CarrierAction[] {
  if (current.mainStatus === 'DISABLED') return ['查看详情']
  if (current.mainStatus === 'IDLE') return ['菲票装袋', '报废', '查看详情']
  if (current.flowStage === 'PACKED') return ['中转袋入仓', '拆袋重装', '查看详情']
  if (current.flowStage === 'INBOUND_STORED' || current.flowStage === 'READY_HANDOVER') return ['拆袋重装', '中转袋交出', '查看详情']
  return ['中转袋回收', '查看详情']
}
```

动作跳到 Web 待交出仓当前页弹窗并预填袋码，不在主列表复制第二套提交逻辑。

- [ ] **步骤 5：重构详情为当前与历史分层**

详情区固定顺序：

1. 稳定身份和二维码。
2. 当前主状态、阶段、持有节点和位置。
3. 当前使用周期和当前袋内菲票。
4. 装袋记录。
5. 入仓记录。
6. 拆袋重装来源/结果记录。
7. 袋级交出记录及不可变快照。
8. 特殊工艺带袋回仓记录。
9. 回收记录。
10. 报废记录。
11. 历史使用周期。

每个明细列表继续使用现有 `renderDetailPagination()`，每页条数和总数明确显示。

- [ ] **步骤 6：删除主列表/处理器的直接报废关闭路径**

移除把开放周期直接改成 `SCRAP_CLOSED`、同步修改 `master.currentStatus` 的页面处理器。所有回收和报废按钮都进入共享命令；旧闭环记录继续作为历史显示。

同步修改 `transfer-bags/dialogs.ts`：删除「一个中转袋支持混装」说明、袋况下拉和回收结果直接选择报废；回收弹窗只收集实物收到/为空、节点、位置和原因，报废继续使用独立弹窗。

- [ ] **步骤 7：验证标准列表治理和详情**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:list-page-governance
npx playwright test tests/cutting-transfer-bag-detail-tabs.spec.ts tests/cutting-transfer-bag-navigation.spec.ts tests/cutting-transfer-bag-confirm-local-refresh.spec.ts
```

预期：标准列表、分页、三状态四阶段、资格动作和当前/历史分层全部 PASS。

提交：

```bash
git add src/pages/process-factory/cutting/transfer-bags-model.ts src/pages/process-factory/cutting/transfer-bag-return-model.ts src/pages/process-factory/cutting/transfer-bags-projection.ts src/pages/process-factory/cutting/transfer-bags.ts src/pages/process-factory/cutting/transfer-bags/state.ts src/pages/process-factory/cutting/transfer-bags/handlers.ts src/pages/process-factory/cutting/transfer-bags/dialogs.ts src/pages/process-factory/cutting/transfer-bags/detail.ts scripts/check-transfer-bag-three-status.ts tests/cutting-transfer-bag-detail-tabs.spec.ts tests/cutting-transfer-bag-confirm-local-refresh.spec.ts
git commit -m "refactor(中转袋): 统一主列表回收和追溯事实"
```

---

### 任务 9：把 PDA 待交出仓固定为六入口并接通路由骨架

**规格条款：** 设计文档第 11.1、11.2、16.3 节。

**文件：**

- 修改：`src/pages/pda-cutting-wait-handover-actions.ts:1-58`
- 修改：`src/pages/pda-warehouse-wait-handover.ts:290-340`
- 创建：`src/pages/pda-cutting-transfer-bag-repack.ts`
- 创建：`src/pages/pda-cutting-transfer-bag-recovery.ts`
- 创建：`src/pages/pda-cutting-transfer-bag-scrap.ts`
- 修改：`src/router/routes-pda.ts:1-121`
- 修改：`src/router/route-renderers.ts:430-490`
- 修改：`src/main-handlers/pda-handlers.ts:1-68`
- 修改：`src/main.ts:1-15, 1450-1885, 1990-2010`
- 修改：`scripts/check-pda-cutting-wait-handover-entry-routing.ts`
- 修改：`scripts/check-pda-cutting-wait-handover-route-integration.ts`

- [ ] **步骤 1：先把入口检查改为精确六入口**

```ts
assert.deepEqual(getPdaCuttingWaitHandoverActions().map(({ key, title }) => ({ key, title })), [
  { key: 'fei-ticket-bagging', title: '菲票装袋' },
  { key: 'transfer-bag-inbound', title: '中转袋入仓' },
  { key: 'transfer-bag-repack', title: '拆袋重装' },
  { key: 'transfer-bag-handover', title: '中转袋交出' },
  { key: 'transfer-bag-recovery', title: '中转袋回收' },
  { key: 'transfer-bag-scrap', title: '中转袋报废' },
])
```

断言「菲票打编号」「特殊工艺回仓」不在卡片入口数组。运行入口检查，预期 FAIL。

- [ ] **步骤 2：更新入口类型和兼容深链**

`PdaCuttingWaitHandoverAction['key']` 改为上述 6 个键。旧深链映射：

```ts
case 'inbound': return baggingRoute
case 'inbound-location': return inboundRoute
case 'handover-bagging-confirm': return handoverRoute
case 'special-craft-return': return inboundRoute
case 'numbering': return '/fcs/pda/cutting/fei-ticket-numbering'
```

兼容路由只重定向，不继续渲染旧业务操作。

- [ ] **步骤 3：注册 3 个新 PDA 页面路由**

采用稳定、不依赖某个车缝任务的精确路由：

```text
/fcs/pda/cutting/transfer-bag/repack
/fcs/pda/cutting/transfer-bag/recovery
/fcs/pda/cutting/transfer-bag/scrap
```

在 `route-renderers.ts` 增加异步渲染器；在 `pda-handlers.ts` 增加事件处理器。任务 9 先创建可达的动作页骨架，任务 11、13 再补完整表单和共享命令。每个骨架必须使用 `renderPdaFrame()`，显示页面标题、第一步「扫中转袋」、返回待交出仓链接和唯一禁用主按钮，不能返回空字符串：

```ts
import { escapeHtml } from '../utils'
import { renderPdaFrame } from './pda-shell'

function renderTransferBagActionSkeleton(input: {
  title: string
  primaryAction: string
}): string {
  return `
    <main class="space-y-4 px-4 py-4">
      <a class="text-sm text-blue-700" data-nav="/fcs/pda/warehouse/wait-handover?scope=cutting">返回待交出仓</a>
      <section class="rounded-2xl border bg-card p-4">
        <h1 class="text-lg font-semibold">${escapeHtml(input.title)}</h1>
        <label class="mt-4 block space-y-2">
          <span class="text-sm font-medium">1 扫中转袋</span>
          <input class="h-12 w-full rounded-xl border px-3" placeholder="扫描或填写中转袋编号" />
        </label>
        <button class="mt-4 h-12 w-full rounded-xl bg-blue-600 text-white opacity-50" type="button" disabled>${escapeHtml(input.primaryAction)}</button>
      </section>
    </main>
  `
}

export function renderPdaCuttingTransferBagRepackPage(): string {
  return renderPdaFrame(renderTransferBagActionSkeleton({
    title: '拆袋重装',
    primaryAction: '确认重装',
  }), 'warehouse', { headerTitle: '拆袋重装', disableTodoAutoOpen: true })
}

export function handlePdaCuttingTransferBagRepackEvent(): boolean {
  return false
}
```

回收和报废页使用相同的页面壳，但分别导出自己的渲染器/处理器和「确认回收」「确认报废」主按钮；不得共享业务提交函数。

- [ ] **步骤 4：消除 `main.ts` 重复写入口**

当前 `main.ts` 既有专项直达判断，也会进入 `handlePdaPageEvent()`。新入口只允许通过 `main-handlers/pda-handlers.ts` 一条分发链；删除针对新页面的第二套 click/input/keydown 直达分支。

- [ ] **步骤 5：运行路由检查并提交**

运行：

```bash
npm run check:pda-cutting-wait-handover-entry-routing
npm run check:pda-cutting-wait-handover-route-integration
```

预期：卡片只显示 6 个入口；所有路由可达；历史参数跳到新入口；没有空白页或双分发。

提交：

```bash
git add src/pages/pda-cutting-wait-handover-actions.ts src/pages/pda-warehouse-wait-handover.ts src/pages/pda-cutting-transfer-bag-repack.ts src/pages/pda-cutting-transfer-bag-recovery.ts src/pages/pda-cutting-transfer-bag-scrap.ts src/router/routes-pda.ts src/router/route-renderers.ts src/main-handlers/pda-handlers.ts src/main.ts scripts/check-pda-cutting-wait-handover-entry-routing.ts scripts/check-pda-cutting-wait-handover-route-integration.ts
git commit -m "feat(PDA): 接通待交出仓中转袋六入口"
```

---

### 任务 10：让 PDA 菲票装袋和中转袋入仓使用共享事实

**规格条款：** 设计文档第 8.2、8.3、8.9、11.2、11.5 节。

**文件：**

- 修改：`src/pages/pda-cutting-inbound.ts:43-250, 260-560, 760-1350`
- 修改：`src/pages/pda-cutting-inbound-projection.ts`
- 修改：`src/pages/pda-cutting-handover.ts`（迁出特殊工艺回仓写逻辑）
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`

- [ ] **步骤 1：先写共享事实和强制回收失败测试**

专项检查新增：

```ts
const bagged = confirmPdaBagging(validBaggingState, storage)
assert.equal(listCuttingRuntimeEvents(storage).filter((event) => event.eventType === '菲票装袋').length, 1)
assert.equal(resolveTransferBagCurrentUse(bagged.bagCode, storage).flowStage, 'PACKED')

const prompt = scanPdaBagForBagging(handedOverBagCode, storage)
assert.equal(prompt.kind, 'FORCE_RECOVERY_REQUIRED')
assert.equal(scanPdaBagForBagging(disabledBagCode, storage).kind, 'BLOCKED')
```

运行 `npm run check:pda-cutting-inbound-workflow`，预期 FAIL：仍依赖独立 `PdaCuttingInboundMockLedger`。

- [ ] **步骤 2：降级独立 Mock Ledger 为演示种子**

保留 `createPdaCuttingInboundMockLedger()` 仅用于测试输入和页面初始示例；装袋资格、当前绑定、阶段和提交结果全部调用共享运行模块。删除通过修改 `ledger.bags[bagCode].status` 决定最终状态的路径。

- [ ] **步骤 3：实现装袋扫描和强制回收确认**

扫描袋后返回：

```ts
type PdaBagAvailability =
  | { kind: 'AVAILABLE'; bagCode: string }
  | { kind: 'FORCE_RECOVERY_REQUIRED'; bagCode: string; lastHandoverSummary: string }
  | { kind: 'BLOCKED'; bagCode: string; message: string; currentTicketCount: number }
```

已交出待回收时显示实物收到、空袋确认和强制原因；确认后先调用 `ensureTransferBagAvailableForUse()`，再提交装袋。PACKED/INBOUND/READY 显示当前菲票数并引导重装；DISABLED 永久阻断。

- [ ] **步骤 4：装袋只允许一个生产单且只锁当前绑定**

- 第一张票确定生产单。
- 后续票生产单不同立即阻断。
- 历史装袋/交出事件不阻断；`resolveTransferBagCurrentUseByTicketId()` 发现当前绑定才阻断。
- 确认写一条 `菲票装袋` 事件，重复点击返回同一事实。

- [ ] **步骤 5：入仓只扫描袋和库位**

入仓页面不显示菲票扫描输入。只允许 `PACKED`；从当前关系自动读取袋内快照。库位检查继续复用现有仓库布局、占用和唯一编号校验；提交后阶段 `INBOUND_STORED`。

- [ ] **步骤 6：把特殊工艺带袋回仓并入入仓页**

扫描存在未关闭特殊工艺交出记录的袋时，页面显示来源工厂和原快照，要求核对袋内菲票并选择库位，主按钮仍为「确认入仓」。提交调用任务 6 命令。无袋回仓和空袋回收按任务 6 分流。

- [ ] **步骤 7：保留 PDA 局部输入性能**

继续使用 150ms debounce 和 Enter 立即触发；每次输入只更新当前工作区。移除整页 `higood:request-render` 触发，成功后重置表单，失败保留袋码、菲票和原因。

- [ ] **步骤 8：运行 PDA 装袋/入仓检查并提交**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:transfer-bag-repack-recovery
```

预期：扫码/手工输入、同生产单、当前绑定、强制回收、普通入仓和特殊工艺带袋回仓全部 PASS。

提交：

```bash
git add src/pages/pda-cutting-inbound.ts src/pages/pda-cutting-inbound-projection.ts src/pages/pda-cutting-handover.ts scripts/check-pda-cutting-inbound-workflow.ts
git commit -m "refactor(PDA): 统一中转袋装袋和入仓事实"
```

---

### 任务 11：实现 PDA 多来源、多结果拆袋重装

**规格条款：** 设计文档第 8.6、11.4、12.1 节。

**文件：**

- 修改：`src/pages/pda-cutting-transfer-bag-repack.ts`
- 修改：`scripts/check-transfer-bag-repack-recovery.ts`
- 修改：`tests/pda-cutting-transfer-bag-lifecycle.spec.ts`

- [ ] **步骤 1：写 PDA 重装状态机失败测试**

```ts
let state = createPdaTransferBagRepackState()
state = scanRepackSourceBag(state, 'BAG-A', storage)
state = scanRepackSourceBag(state, 'BAG-B', storage)
state = assignRepackTicket(state, 'FT-001', 'BAG-A')
state = assignRepackTicket(state, 'FT-002', 'BAG-C')
const summary = buildPdaRepackConfirmation(state, storage)
assert.equal(summary.sourceBags.length, 2)
assert.equal(summary.resultBags.length, 2)
```

运行 `npm run check:transfer-bag-repack-recovery`，预期 FAIL：PDA 模块不存在。

- [ ] **步骤 2：实现 5 步短流程状态**

```ts
export interface PdaTransferBagRepackState {
  step: 'SOURCE_BAGS' | 'TICKETS' | 'RESULT_BAGS' | 'CONFIRM' | 'DONE'
  sourceBagCodes: string[]
  ticketTargetById: Record<string, string>
  scannedResultBagCodes: string[]
  forceRecoveryByBagCode: Record<string, ForceRecoveryConfirmation>
  feedback: string
}

export interface ForceRecoveryConfirmation {
  physicalBagReceived: true
  physicalBagEmpty: true
  recoveryNode: string
  recoveryLocation: string
  reason: string
}
```

首屏只显示当前步骤、当前袋/票、数量和下一动作；历史和完整追溯放入折叠详情。

- [ ] **步骤 3：实现来源袋、菲票和结果袋扫描**

- 来源袋只接受 PACKED、INBOUND_STORED、READY_HANDOVER。
- 票只能来自已扫描来源袋。
- 结果袋可以是来源袋、空闲袋或完成强制回收的已交出袋。
- 无关使用中袋和已报废袋阻断。
- 手工填写调用与扫码相同函数。

- [ ] **步骤 4：确认前展示系统计算汇总**

每个来源袋：转出张数/片数、保留张数/片数、是否变空闲。每个结果袋：生产单、接收工厂、张数/片数。若集合或数量不守恒，隐藏主提交按钮并显示具体差异。

- [ ] **步骤 5：提交一条重装事实并局部显示结果**

主按钮只有「确认重装」。调用 `submitTransferBagRepack()`；成功显示「重装成功，请继续交出」，并列出所有待交出结果袋。重复点击返回同一批次结果。

- [ ] **步骤 6：运行小屏 E2E 并提交**

运行：

```bash
npm run check:transfer-bag-repack-recovery
npx playwright test tests/pda-cutting-transfer-bag-lifecycle.spec.ts --grep "拆袋重装"
```

预期：390×844 下多来源、多结果、来源袋复用、强制回收目标袋、Enter 扫码和手工输入全部 PASS。

提交：

```bash
git add src/pages/pda-cutting-transfer-bag-repack.ts scripts/check-transfer-bag-repack-recovery.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts
git commit -m "feat(PDA): 支持多来源多结果拆袋重装"
```

---

### 任务 12：把 PDA 中转袋交出改为多任务同工厂整袋确认

**规格条款：** 设计文档第 8.5、8.7、11.2、15.1—15.2 节。

**文件：**

- 修改：`src/pages/pda-cutting-handover.ts:120-560, 1160-1420`
- 修改：`src/pages/pda-cutting-handover-projection.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`
- 修改：`tests/pda-cutting-transfer-bag-lifecycle.spec.ts`

- [ ] **步骤 1：把现有单任务断言改成唯一接收工厂断言**

专项检查新增：

```ts
const scan = scanPdaTransferBagForHandover('BAG-MULTI-TASK', storage)
assert.equal(scan.ok, true)
assert.deepEqual(scan.summary.sewingTaskNos, ['SEW-01', 'SEW-02'])
assert.equal(scan.summary.receiverFactoryName, '车缝工厂甲')

assert.equal(
  scanPdaTransferBagForHandover('BAG-MULTI-FACTORY', storage).message,
  '袋内菲票要交给 2 个工厂，请先拆袋重装。',
)
```

运行 `npm run check:pda-cutting-transfer-bag-handover`，预期 FAIL：当前仍要求扫描一个车缝任务并校验唯一绑定。

- [ ] **步骤 2：简化 PDA 交出表单**

表单只要求：扫/填袋码、核对生产单、全部任务、唯一工厂、菲票张数/片数和操作人。删除必扫车缝任务字段、`boundSewingTaskNo` 冲突提示和单任务绑定写入。

- [ ] **步骤 3：允许两个入口阶段**

交出只接受：

```ts
['INBOUND_STORED', 'READY_HANDOVER'].includes(current.flowStage ?? '')
```

PACKED 提示先入仓；HANDED_OVER 提示已经交出；跨工厂或未分配提示先重装；DISABLED 永久阻断。

- [ ] **步骤 4：提交不可变整袋交出快照**

调用 `resolveWholeBagHandoverEligibility()` 生成载荷。确认时再次读取当前关系并比较票集合、片数、任务和工厂，避免扫描后分配变化。成功写一条 `新增交出记录`，解除当前绑定但保持 `HANDED_OVER_WAITING_RETURN`。

- [ ] **步骤 5：保持一页一个主动作和局部反馈**

页面只有「确认交出」一个主按钮。成功后显示记录号、袋码、工厂和「等待实物袋回收」；不显示车缝接收、拆票或重装按钮。

- [ ] **步骤 6：运行 PDA 交出检查并提交**

运行：

```bash
npm run check:pda-cutting-transfer-bag-handover
npx playwright test tests/pda-cutting-transfer-bag-lifecycle.spec.ts --grep "中转袋交出"
```

预期：同工厂多任务、跨工厂阻断、重装结果直接交出、重复提交幂等全部 PASS。

提交：

```bash
git add src/pages/pda-cutting-handover.ts src/pages/pda-cutting-handover-projection.ts scripts/check-pda-cutting-transfer-bag-handover.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts
git commit -m "feat(PDA): 支持同工厂多任务整袋交出"
```

---

### 任务 13：实现 PDA 独立回收、报废和只读扫码详情

**规格条款：** 设计文档第 8.8—8.10、9.3、11.2、15.5—15.9 节。

**文件：**

- 修改：`src/pages/pda-cutting-transfer-bag-recovery.ts`
- 修改：`src/pages/pda-cutting-transfer-bag-scrap.ts`
- 修改：`src/pages/pda-transfer-bag-detail.ts:1-188`
- 修改：`scripts/check-transfer-bag-mobile-closed-loop.ts`
- 修改：`tests/pda-cutting-transfer-bag-lifecycle.spec.ts`

- [ ] **步骤 1：先写回收和报废页面合同**

```ts
const recoveryHtml = renderPdaCuttingTransferBagRecoveryPage()
assert(recoveryHtml.includes('确认回收'))
assert(!recoveryHtml.includes('确认报废'))

const scrapHtml = renderPdaCuttingTransferBagScrapPage()
assert(scrapHtml.includes('确认报废'))
assert(!scrapHtml.includes('确认回收'))
```

扫码详情断言不得出现「车缝接收」「确认收货」「内部袋池」。运行相关检查，预期 FAIL：新页面不存在且详情仍有下游接收动作。

- [ ] **步骤 2：实现 PDA 回收页**

页面状态：

```ts
interface PdaTransferBagRecoveryState {
  bagCode: string
  physicalBagReceived: boolean
  physicalBagEmpty: boolean
  recoveryNode: string
  recoveryLocation: string
  recoveryMode: 'NORMAL' | 'FORCED'
  reason: string
  latestHandoverSummary: string
  feedback: string
}
```

只允许已交出待回收；不要求验证外部车缝流转路线；实物收到和为空必须勾选。成功后显示空闲和回收记录号。

- [ ] **步骤 3：实现 PDA 报废页**

- 空闲袋：原因、授权人、操作人、二次确认后报废。
- 已交出待回收：显示「先回收再报废」，同一页要求实物收到/为空，依次写两条事实。
- PACKED/INBOUND/READY：展示当前生产单、菲票数和「请先拆袋重装」，主提交禁用。
- DISABLED：只读提示，不允许再次操作。

- [ ] **步骤 4：扫码详情只显示受管事实**

详情显示稳定身份、当前状态/阶段、当前袋票、最近交出快照、回收/报废记录和历史入口。删除外部车缝工厂接收确认、内部使用或协作记录按钮。

- [ ] **步骤 5：验证跨端闭环和小屏操作**

E2E 顺序：PDA 交出 → PDA 回收 → Web 显示空闲；PDA 已交出袋报废 → 详情显示回收和报废两条事实；已报废袋在装袋/重装/回收/报废页全部阻断。

运行：

```bash
npm run check:transfer-bag-mobile-closed-loop
npx playwright test tests/pda-cutting-transfer-bag-lifecycle.spec.ts --grep "回收|报废|扫码详情"
```

预期：独立页面、单主动作、两事实顺序和外部边界全部 PASS。

提交：

```bash
git add src/pages/pda-cutting-transfer-bag-recovery.ts src/pages/pda-cutting-transfer-bag-scrap.ts src/pages/pda-transfer-bag-detail.ts scripts/check-transfer-bag-mobile-closed-loop.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts
git commit -m "feat(PDA): 增加中转袋回收和报废闭环"
```

---

### 任务 14：清理旧写入口、旧当前状态和历史误投影

**规格条款：** 设计文档第 4.2、9.2、9.4、13、14 节。

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-model.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags.ts`
- 修改：`src/data/fcs/cutting/sewing-dispatch.ts`
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`src/pages/pda-transfer-bag-detail.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`

- [ ] **步骤 1：建立禁止写入口扫描**

允许 `交出装袋确认` 只出现在：事件类型兼容声明、旧事件反序列化、历史标签映射和测试夹具。以下位置不得出现新写入：

```ts
assert(!newWriteSources.some((source) => source.includes("eventType: '交出装袋确认'")))
assert(!warehouseHubActiveRender.includes('去交出装袋确认'))
assert(!warehouseHubActiveRender.includes('生成交出装袋确认任务'))
```

- [ ] **步骤 2：删除 Web 活跃渲染中的旧操作**

删除/停用 `renderWaitHandoverBaggingTable()` 等旧待办渲染及其统计卡片；若历史数据需要展示，统一映射为「历史重装记录」，只在详情出现。

- [ ] **步骤 3：删除预造目标袋和单任务当前绑定**

`sewing-dispatch.ts` 不再生成 `targetTransferBagCode`；`transfer-bags-model.ts` 不再用 `sewingTaskId` 作为一个周期只能有一个任务的当前约束。历史字段可读，但不能驱动资格。

- [ ] **步骤 4：删除 PDA 最终状态的独立 Mock 写入**

所有 PDA 页面允许有表单状态和测试种子，但禁止通过修改 `PdaCuttingInboundMockLedger` 或 `PdaTransferBagHandoverCandidates` 作为最终状态。成功反馈必须来自共享事件命令返回值。

- [ ] **步骤 5：收紧历史兼容**

```ts
export interface LegacyRepackSnapshot {
  sourceBagCode: string
  targetBagCode: string
  usageCycleId: string
  tickets: TransferBagTicketFactSnapshot[]
  occurredAt: string
  operatorName: string
}

export function projectLegacyBaggingConfirm(event: CuttingRuntimeEvent): LegacyRepackSnapshot | null {
  if (event.eventType !== '交出装袋确认') return null
  if (!hasUniqueSourceBag(event) || !hasUniqueTargetBag(event) || !hasCompleteTicketSet(event)) return null
  return buildLegacyReadOnlySnapshot(event)
}
```

无法唯一恢复的历史袋：主状态仍只显示三种，`compatibilityBlockedReason` 阻断危险动作并显示主管核查；不得创建第四状态。

- [ ] **步骤 6：运行禁止项扫描并提交**

运行：

```bash
npm run check:transfer-bag-three-status
npm run check:web-cutting-transfer-bag-actions
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
rg -n "BAG-PICK-|去交出装袋确认|生成交出装袋确认任务|一个中转袋只能绑定一个车缝任务" src
```

预期：专项检查全部 PASS；`rg` 只命中有明确历史兼容注释的代码，不能命中活跃页面文案或新写入口。

提交：

```bash
git add src/pages/process-factory/cutting/warehouse-hub.ts src/pages/process-factory/cutting/wait-handover-runtime.ts src/pages/process-factory/cutting/transfer-bags-model.ts src/pages/process-factory/cutting/transfer-bags.ts src/data/fcs/cutting/sewing-dispatch.ts src/pages/pda-cutting-inbound.ts src/pages/pda-cutting-handover.ts src/pages/pda-transfer-bag-detail.ts scripts/check-transfer-bag-three-status.ts scripts/check-web-cutting-transfer-bag-actions.ts
git commit -m "refactor(中转袋): 清理旧重装和双状态写入口"
```

---

### 任务 15：把旧专项检查升级为完整业务门禁

**规格条款：** 设计文档第 15、16.1、16.2 节。

**文件：**

- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：`scripts/check-transfer-bag-repack-recovery.ts`
- 修改：`scripts/check-cutting-sewing-dispatch.ts`
- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- 修改：`scripts/check-pda-cutting-wait-handover-entry-routing.ts`
- 修改：`scripts/check-pda-cutting-wait-handover-route-integration.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`
- 修改：`scripts/check-transfer-bag-mobile-closed-loop.ts`
- 修改：`package.json`

- [ ] **步骤 1：建立规格场景到检查文件映射**

| 设计场景 | 自动门禁 |
| --- | --- |
| 同工厂多任务直接交出 | `check-cutting-sewing-dispatch`、PDA 交出检查 |
| 跨工厂必须重装 | `check-transfer-bag-repack-recovery` |
| 多来源合并和来源袋复用 | `check-transfer-bag-repack-recovery` |
| 一来源拆多结果 | `check-transfer-bag-repack-recovery` |
| 正常/强制回收 | 回收重装检查、PDA 闭环检查 |
| 当前有菲票不得回收/报废 | 三状态检查、回收重装检查 |
| 回收后报废两事实 | 回收重装检查、PDA 闭环检查 |
| 外部流转缺失不阻断 | 回收重装检查 |
| 跨端一致和幂等 | Web/PDA 检查和 E2E |

- [ ] **步骤 2：删除与新设计冲突的旧正向断言**

必须删除：

```text
PACKED 允许 SCRAP
INBOUND_STORED 允许 SCRAP
HANDED_OVER_WAITING_RETURN 直接允许 SCRAP
待交出仓恰好 5 个入口
一个中转袋只能绑定一个车缝任务
```

替换为任务 1—14 的新断言，不能简单删掉覆盖。

- [ ] **步骤 3：把新检查加入裁床总门禁**

`package.json`：

```json
"check:cutting:all": "... && npm run check:transfer-bag-three-status && npm run check:transfer-bag-repack-recovery && npm run check:transfer-bag-mobile-closed-loop"
```

保持已有裁床检查，不用新命令替换或跳过旧无关门禁。

- [ ] **步骤 4：运行全部中转袋专项检查**

```bash
npm run check:transfer-bag-three-status
npm run check:transfer-bag-repack-recovery
npm run check:cutting-sewing-dispatch
npm run check:cutting-wait-handover-transfer-bag-flow
npm run check:pda-cutting-wait-handover-entry-routing
npm run check:pda-cutting-wait-handover-route-integration
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:web-cutting-transfer-bag-actions
npm run check:transfer-bag-mobile-closed-loop
```

预期：全部退出码 0，输出对应 `PASS`/完成信息。

- [ ] **步骤 5：运行裁床总门禁并提交**

```bash
npm run check:cutting:all
```

预期：退出码 0；若出现与工作区其他任务相关的失败，保存原始错误并判断路径是否与本任务重叠，不能修改无关基线绕过。

提交：

```bash
git add scripts/check-transfer-bag-three-status.ts scripts/check-transfer-bag-repack-recovery.ts scripts/check-cutting-sewing-dispatch.ts scripts/check-cutting-wait-handover-transfer-bag-flow.ts scripts/check-pda-cutting-wait-handover-entry-routing.ts scripts/check-pda-cutting-wait-handover-route-integration.ts scripts/check-pda-cutting-inbound-workflow.ts scripts/check-pda-cutting-transfer-bag-handover.ts scripts/check-web-cutting-transfer-bag-actions.ts scripts/check-transfer-bag-mobile-closed-loop.ts package.json
git commit -m "test(中转袋): 建立重装回收报废完整门禁"
```

---

### 任务 16：完成 Web/PDA 浏览器验收和原型治理记录

**规格条款：** 设计文档第 10、11、15、16.3、17 节。

**文件：**

- 创建：`tests/cutting-transfer-bag-repack-recovery.spec.ts`
- 完成：`tests/pda-cutting-transfer-bag-lifecycle.spec.ts`
- 修改：`tests/cutting-wait-handover-web-modal.spec.ts`
- 修改：`tests/cutting-transfer-bag-simplified-statuses.spec.ts`
- 创建：`docs/prototype-review-records/2026-08-01-cutting-transfer-bag-repacking-recovery.md`

- [ ] **步骤 1：编写 Web 端到端主流程**

在测试文件开头定义动作助手，所有助手都通过页面控件操作，不直接写 `localStorage`：

```ts
async function openWaitHandoverAction(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.locator('[data-wait-handover-modal]')).toBeVisible()
}

async function bagTickets(page: Page, bagCode: string, ticketCodes: string[]) {
  await openWaitHandoverAction(page, '菲票装袋')
  await page.locator('[data-wait-handover-field="bagCode"]').fill(bagCode)
  await page.locator('[data-wait-handover-field="ticketScanInput"]').fill(ticketCodes.join('\n'))
  await page.getByRole('button', { name: '确认菲票装袋' }).click()
}

async function expectBagStage(page: Page, bagCode: string, stage: string) {
  const row = page.locator('tr', { hasText: bagCode })
  await expect(row).toContainText(stage)
}
```

`inboundBag()`、`repackBag()` 和 `handoverBag()` 按相同方式分别操作 `data-wait-handover-field`、重装结果分组控件和「确认交出」按钮；每个助手完成后都断言成功反馈和弹窗关闭，不能调用运行模块函数代替 UI。

用例必须按真实动作执行：

```ts
test('装袋入仓后按分配结果重装并分别交出', async ({ page }) => {
  await bagTickets(page, 'BAG-A', ['FT-001', 'FT-002'])
  await inboundBag(page, 'BAG-A', 'A-01-01')
  await repackBag(page, {
    sources: ['BAG-A'],
    results: { 'BAG-A': ['FT-001'], 'BAG-B': ['FT-002'] },
  })
  await expectBagStage(page, 'BAG-A', '待交出')
  await expectBagStage(page, 'BAG-B', '待交出')
  await handoverBag(page, 'BAG-A')
  await handoverBag(page, 'BAG-B')
})
```

另写：同工厂多任务直接交出、来源袋清空变空闲、强制回收后装袋、回收后报废两事实、已报废永久阻断。

- [ ] **步骤 2：编写 PDA 端到端主流程**

从「待交出仓」卡片点击 6 个入口，分别确认页面标题和唯一主按钮。执行多来源重装、交出、回收、报废；测试扫码 Enter 和手工输入共用校验。

- [ ] **步骤 3：验证跨端即时一致**

同一浏览器存储上下文中：Web 重装 → PDA 待交出；PDA 交出 → Web 完成交出记录；Web 回收 → PDA 空闲；PDA 报废 → Web 已报废。任何步骤不得手工刷新 localStorage 或调用测试专用状态写入。

- [ ] **步骤 4：验证响应、局部刷新和分辨率**

使用 `performance.now()` 记录按钮点击到反馈 DOM 更新，目标 `< 200ms`。检查：

- Web：1366×768 标准，1280×720 最低；主体无横向溢出，宽表内部滚动。
- PDA：390×844；主按钮首屏可见或一步滚动可达。
- 输入不触发 `#app` 替换；弹窗打开关闭不丢页面滚动位置。
- 新插入区域单独 hydrate 图标，不重新扫描整页。

- [ ] **步骤 5：填写原型审查记录**

审查记录必须列出所有本次修改的 `src/pages/`、`src/data/`、`src/router/`、`src/main-handlers/` 受管文件，并逐项记录：角色、端类型、设备假设、中文文案、扫码兜底、错误阻断、局部刷新、列表分页、分辨率、异常边界和外部车缝不受管范围。

- [ ] **步骤 6：运行浏览器和治理检查**

```bash
npx playwright test tests/cutting-transfer-bag-repack-recovery.spec.ts tests/cutting-wait-handover-web-modal.spec.ts tests/cutting-transfer-bag-simplified-statuses.spec.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts
npm run check:prototype-design-governance
npm run check:list-page-governance
```

预期：全部 PASS；治理记录覆盖所有受管文件；不存在基线绕过。

提交：

```bash
git add tests/cutting-transfer-bag-repack-recovery.spec.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts tests/cutting-wait-handover-web-modal.spec.ts tests/cutting-transfer-bag-simplified-statuses.spec.ts docs/prototype-review-records/2026-08-01-cutting-transfer-bag-repacking-recovery.md
git commit -m "test(中转袋): 补齐跨端浏览器验收和设计审查"
```

---

### 任务 17：执行最终核查、CodeGraph 同步和任务收据

**规格条款：** 设计文档第 16.4 节；项目 `AGENTS.md` 第 11、12 节。

**文件：**

- 不修改业务文件；最后一次实质改动后只生成临时验证产物。

- [ ] **步骤 1：逐条核对设计与实现任务**

使用本计划末尾「规格覆盖矩阵」逐项确认每一条都有：代码文件、专项检查和浏览器证据。任何一项缺失都回到对应任务补齐，不能在收据中写解释代替实现。

- [ ] **步骤 2：运行格式和禁止项检查**

```bash
git diff --check
rg -n "待清洗|待维修|BAG-PICK-|一个中转袋只能绑定一个车缝任务|去交出装袋确认|生成交出装袋确认任务" src scripts tests
```

预期：`git diff --check` 退出码 0；`rg` 只允许命中明确标注为历史兼容或禁止项断言的代码。

- [ ] **步骤 3：运行最终专项、总门禁和构建**

```bash
npm run check:transfer-bag-three-status
npm run check:transfer-bag-repack-recovery
npm run check:cutting:all
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run build
```

预期：全部退出码 0。

- [ ] **步骤 4：运行完整浏览器验收**

```bash
npx playwright test tests/cutting-transfer-bag-repack-recovery.spec.ts tests/cutting-wait-handover-web-modal.spec.ts tests/cutting-transfer-bag-simplified-statuses.spec.ts tests/cutting-transfer-bag-detail-tabs.spec.ts tests/cutting-transfer-bag-navigation.spec.ts tests/pda-cutting-transfer-bag-lifecycle.spec.ts
```

预期：全部 PASS，并保存 Web 1366×768、Web 1280×720、PDA 390×844 的关键截图。

- [ ] **步骤 5：同步并检查 CodeGraph**

运行项目配置的：

```bash
codegraph sync
codegraph status
```

预期：没有 pending sync；新建模块、路由和处理器都进入索引。若本机通过 MCP 执行，则使用等价的 CodeGraph sync/status 工具调用并保存输出。

- [ ] **步骤 6：生成最后一次改动对应的机器收据**

```bash
receipt_dir="$(mktemp -d)"
npm run workflow:verify -- \
  --output "$receipt_dir/task-receipt.json" \
  --task-boundary "裁床中转袋拆袋重装、直接交出、回收、强制回收、报废及 Web/PDA/追溯闭环"
```

预期：收据状态至少为 `verified`，绑定当前 Git HEAD、工作区差异指纹、全部相关检查结果和 CodeGraph 状态。最后一次实质改动后必须重新生成，旧收据失效。

- [ ] **步骤 7：提交最终验证收口**

仅当任务 17 未修改业务代码、只补审查记录或检查配置时提交：

```bash
git add docs/prototype-review-records/2026-08-01-cutting-transfer-bag-repacking-recovery.md package.json
git commit -m "chore(中转袋): 收口完整链路验证门禁"
```

如果没有可提交变更，不创建空提交。没有 GitHub API 的分支指向回执时只能报告 `verified`，不得报告 `delivered`；没有授权接受人的精确 SHA 接受记录时不得报告 `accepted`。

---

## 5. 规格覆盖矩阵

| 设计章节 | 实施任务 | 自动证据 | 浏览器证据 |
| --- | --- | --- | --- |
| 4 系统管理边界 | 4、5、6、13、14 | 回收重装检查、移动闭环检查 | 外部流转缺失仍可回收；详情无车缝内部动作 |
| 5 对象和关系 | 2、3、4、8 | 事件往返、当前关系、交出资格检查 | 当前票与历史快照分层 |
| 6 三状态四阶段 | 1、8 | 三状态检查 | 主列表和详情状态 |
| 7 动作资格 | 1、5、8、10—13 | 三状态、回收重装检查 | 各页面按钮资格 |
| 8.2 菲票装袋 | 3、7、10 | PDA 入仓、Web 动作检查 | Web/PDA 装袋 |
| 8.3 中转袋入仓 | 3、6、7、10 | 待交出仓流、PDA 入仓检查 | 普通/特殊工艺入仓 |
| 8.5 直接整袋交出 | 4、7、12 | 分配、PDA 交出检查 | 同工厂多任务直接交出 |
| 8.6 拆袋重装 | 3、7、11 | 回收重装检查 | Web/PDA 多来源多结果 |
| 8.7 中转袋交出 | 4、7、12 | Web/PDA 交出检查 | 独立确认和完成记录 |
| 8.8 中转袋回收 | 5、7、13 | 回收重装、移动闭环检查 | 正常/强制回收 |
| 8.9 强制回收 | 5、7、10、11 | 回收重装、PDA 入仓检查 | 装袋/重装目标袋触发 |
| 8.10 中转袋报废 | 5、7、8、13 | 三状态、回收重装检查 | 空闲报废和回收后报废 |
| 9 追溯 | 2、3、8、14 | 当前/历史投影断言 | 详情分页、交出快照 |
| 10 Web | 7、8 | Web 动作、列表治理 | 六动作、局部刷新、低分辨率 |
| 11 PDA | 9—13 | 入口、路由、各动作检查 | 六入口、小屏、扫码 Enter |
| 12 防错和幂等 | 2—7、10—13 | 事件幂等和资格检查 | 双击、弱网重试、输入保留 |
| 13 历史兼容 | 2、3、14 | 旧事件反序列化和阻断断言 | 历史只读、主管核查提示 |
| 15 验收场景 | 15、16 | 全部专项检查 | 两个新 E2E 文件 |
| 16 验收门禁 | 15—17 | 总门禁、构建、任务收据 | 全量指定 Playwright |
| 17 原型治理 | 7—13、16 | 治理检查 | 人工审查记录和截图 |

## 6. 计划自检结论

### 6.1 规格覆盖度

- 设计文档第 1—3 节作为背景和目标，由本计划第 1、2 节承接。
- 第 4—13 节分别映射到任务 1—14，没有只写页面而未写事实的条款。
- 第 14 节列出的当前代码文件均出现在任务文件清单中。
- 第 15 节 10 个验收场景全部映射到任务 15、16。
- 第 16、17 节由任务 15—17 建立自动、浏览器、治理和收据门禁。
- 没有把车缝工厂内部用袋、协作、分包或成衣装袋扩大进实现。

### 6.2 类型和命名一致性

- 阶段统一使用 `PACKED / INBOUND_STORED / READY_HANDOVER / HANDED_OVER_WAITING_RETURN`。
- 当前关系统一使用 `TransferBagCurrentUse`。
- 重装命令统一使用 `submitTransferBagRepack()`。
- 交出资格统一使用 `resolveWholeBagHandoverEligibility()`。
- 回收、报废统一使用 `recoverTransferBag()`、`submitTransferBagScrap()` 和 `recoverThenScrapTransferBag()`。
- Web/PDA 只做适配，不再定义第二套最终状态。

### 6.3 风险控制

- 先改测试合同再实现，避免旧绿灯掩盖旧规则。
- 重装用一条批次事实保证本地原型中的原子保存。
- 回收后报废明确写两条事实，第二步失败时安全停留空闲。
- 历史数据无法唯一恢复时阻断危险动作，不猜测、不增加状态。
- 大型 `warehouse-hub.ts` 只拆直接相关的动作模板/处理器，不重构无关仓库页面。
- 所有受管原型文件纳入审查记录和治理检查。

### 6.4 占位符和完成声明

本计划所有代码任务均给出具体文件、类型或函数、失败测试、运行命令、预期结果和提交边界。执行时不得把尚未运行的检查标记为通过，也不得用构建成功替代业务场景和浏览器验收。
