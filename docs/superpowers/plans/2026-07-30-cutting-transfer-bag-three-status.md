# 裁床中转袋三状态实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

> **实施要求：** 本计划必须在独立工作树中执行。每个任务先补充能失败的业务门禁，再做最小实现，再运行该任务相关检查。不得把临时 Mock 更新或页面成功提示当成业务事实写入成功。每项任务独立提交，提交前只暂存该任务列出的文件。

**目标：** 中转袋主状态只保留“空闲、使用中、已报废”，使用中只展示“菲票已装袋、入仓暂存中、已交出待回收”三个流转阶段；Web、PDA、扫码详情、主列表和上下游页面对同一只物理袋使用同一生命周期事实。

**架构：** 新增一个纯生命周期投影模块，以物理袋、使用周期、交出流转段及装袋/入仓/整袋交出/带袋回仓/物理回收/报废事实派生“主状态＋流转阶段”。Web 和 PDA 的成功动作必须写入统一运行时事实账；页面临时候选只作为视图状态。下游接收与回写保留自己的记录状态，但不得覆盖物理袋生命周期。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、Tailwind CSS、本地 Mock/LocalStorage、现有标准列表页组件、Node/tsx 专项检查、Playwright。

---

## 0. 已确认边界和实施前基线

### 0.1 不得改变的业务边界

- 中转袋主状态只有：`空闲`、`使用中`、`已报废`。
- 使用中的流转阶段只有：`菲票已装袋`、`入仓暂存中`、`已交出待回收`。
- 不增加其他主状态、中间状态或处理标签。
- 确认菲票装袋才创建使用周期；打开弹窗或扫码草稿不创建周期。
- 一个袋的当前装袋内容只能属于一个生产单。
- 中转袋入仓只输入袋号、库区、库位；袋内快照从已确认装袋事实读取。
- 一次交出确认只处理一只完整中转袋，不按菲票局部交出。
- 不再新增“交出装袋确认”业务记录；旧记录只允许历史兼容。
- 特殊工艺带袋回仓才改变袋阶段；无袋回仓不改变任何袋。
- 特殊工艺带袋回仓关闭当前交出流转段，不关闭整个使用周期。
- 下游接收、差异、回写不改变物理袋生命周期。
- 物理回收才关闭使用周期；回收后只进入空闲或已报废。
- 差异不等于报废；直接报废必须是有权限人员的明确实物处置。
- 物理标签只保存稳定身份，实时状态在扫码详情查询。

### 0.2 已核查的当前代码问题

实施者开始前应再次用 CodeGraph 确认下列实际调用关系未漂移：

1. `src/main-handlers/fcs-handlers.ts` 中 Web 临时候选处理器先于真实运行时事件处理器执行。
2. `warehouse-hub.ts` 的页头按钮使用临时候选动作属性，可能只更新模块内状态。
3. `submitWaitHandoverInbound()` 和 `appendWaitHandoverInboundEvent()` 仍接收菲票输入。
4. `transfer-bags/handlers.ts` 仍存在把装袋和入仓组合完成、直接写旧主状态的路径。
5. Web 交出会过滤已交菲票并提交剩余菲票；通用 PDA 交出仍以单张菲票为输入。
6. PDA 装袋、入仓和简化交出主要更新模块内 Mock 账，没有形成跨页面持久事实。
7. 裁床运行时事件缺少统一 `usageCycleId`，交出缺少 `handoverLegId`。
8. `pda-transfer-bag-detail.ts` 使用下游 `packStatus` 充当物理袋状态，并固定展示多种动作。
9. `sewing-dispatch.ts` 的接收/差异/回写状态会被多个下游页面消费，但它们不是物理袋状态。
10. 打印模板当前保持稳定身份是正确行为，移动闭环检查明确禁止打印易过期动态字段。
11. `closeTransferBagUsageCycle()` 可能因为存在差异提示而生成报废关闭结果。
12. 现有专项脚本仍把临时账、旧多状态或旧交出动作当成正确结果。

### 0.3 既有无关阻塞

当前 `npm run check:cutting:all` 存在本任务外基线失败：

```text
src/pages/process-factory/cutting/production-order-overview-view.ts: min-w >= 1600px
```

来源是该页面的 `min-w-[2280px]`。本计划不修改该无关页面。最终若只剩此失败，必须把任务状态报告为 `implemented`，不能宣称全量验证闭环。

### 0.4 开始实施前命令

```bash
codegraph sync
codegraph status
git status --short
```

若任务使用 Superpowers 执行技能，按仓库治理要求先记录技能调用和规格产物的阶段轨迹。

---

## 1. 文件范围和职责

### 1.1 创建

- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
  - 三主状态、三阶段、事实类型、生命周期纯派生、旧值集中归一化。
- `scripts/check-transfer-bag-three-status.ts`
  - 锁定状态词汇、事实优先级、周期隔离、交出流转段、差异不报废和旧值只读兼容。
- `docs/prototype-review-records/2026-07-30-cutting-transfer-bag-three-status.md`
  - 记录角色、端类型、业务边界、防错、跨端一致、性能、分辨率和基线例外。

### 1.2 生命周期、事实账和投影

- `src/data/fcs/cutting/transfer-bag-runtime.ts`
  - 使用周期字段、周期创建/关闭、序列化和旧数据迁移。
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
  - 统一事实的事件结构、幂等追加、按袋/周期读取。
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
  - Web/PDA 装袋、入仓、整袋交出、特殊工艺回仓事件写入。
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
  - 主档和使用周期读取，删除多状态决策分支。
- `src/pages/process-factory/cutting/transfer-bags-projection.ts`
  - 汇总运行时存储、事件账和历史兼容数据，输出统一生命周期视图。
- `src/pages/process-factory/cutting/transfer-bag-return-model.ts`
  - 回收与报废结论分离，差异只保留为独立记录。

### 1.3 Web 页面和处理器

- `src/pages/process-factory/cutting/transfer-bags/state.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- `src/pages/process-factory/cutting/transfer-bags/list.ts`
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
- `src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-web-actions.ts`
- `src/main-handlers/fcs-handlers.ts`

职责：

- 主列表、详情、筛选、回收/报废弹窗消费统一生命周期投影。
- 收口 Web 待交出仓为一个真实动作分发入口。
- 成功动作写事实账后局部刷新。
- 入仓不接收菲票，交出不做菲票选择或部分提交。

### 1.4 PDA、扫码详情和上下游

- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/pda-transfer-bag-detail.ts`
- `src/pages/pda-handover-detail.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/factory-mobile-warehouse.ts`
- `src/pages/print/templates/label-print-template.ts`

职责：

- PDA 动作写统一事实，不以模块内 Mock 账作为最终结果。
- 扫码详情从统一生命周期投影取状态，内容详情可继续读取袋内快照。
- 下游接收/回写字段保持记录状态，不覆盖物理袋状态。
- 标签模板继续只打印稳定身份；除非发现泄漏动态字段，否则不改模板。

### 1.5 检查和浏览器验收

重点修改或新增：

- `scripts/check-web-cutting-transfer-bag-actions.ts`
- `scripts/check-pda-cutting-inbound-workflow.ts`
- `scripts/check-pda-cutting-transfer-bag-handover.ts`
- `scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- `scripts/check-transfer-bag-mobile-closed-loop.ts`
- `scripts/check-cutting-special-craft-dispatch-return.ts`
- `scripts/check-cutting-sewing-dispatch.ts`
- `scripts/check-handover-writeback-difference-unification.ts`
- `tests/cutting-runtime-event-ledger-pda-web.spec.ts`
- `tests/cutting-wait-handover-web-modal.spec.ts`
- `tests/cutting-transfer-bag-confirm-local-refresh.spec.ts`
- `tests/cutting-transfer-bag-simplified-statuses.spec.ts`
- `tests/cutting-transfer-bag-detail-header.spec.ts`
- `tests/cutting-transfer-bag-detail-tabs.spec.ts`

只在真实业务门禁需要时修改检查，不得通过放宽断言、更新列表页历史基线或跳过失败绕过治理。

---

## 2. 统一数据契约

### 2.1 生命周期视图

```ts
export type TransferBagMainStatusKey =
  | 'IDLE'
  | 'IN_USE'
  | 'DISABLED'

export type TransferBagFlowStageKey =
  | 'PACKED'
  | 'INBOUND_STORED'
  | 'HANDED_OVER_WAITING_RETURN'

export interface TransferBagLifecycleView {
  carrierId: string
  bagCode: string
  usageCycleId: string | null
  activeHandoverLegId: string | null
  mainStatus: TransferBagMainStatusKey
  mainStatusLabel: '空闲' | '使用中' | '已报废'
  flowStage: TransferBagFlowStageKey | null
  flowStageLabel: '菲票已装袋' | '入仓暂存中' | '已交出待回收' | '—'
  canStartBagging: boolean
  allowedActions: Array<
    | 'BAGGING'
    | 'INBOUND'
    | 'HANDOVER'
    | 'SPECIAL_CRAFT_RETURN'
    | 'PHYSICAL_RETURN'
    | 'SCRAP'
  >
  sourceFactIds: string[]
  compatibilityBlockedReason?: string
}
```

### 2.2 使用周期

```ts
export interface TransferBagUsageCycle {
  usageCycleId: string
  carrierId: string
  bagCode: string
  productionOrderNo: string
  startedAt: string
  startedBy: string
  closedAt?: string
  closeResult?: 'REUSABLE' | 'DISABLED'
  terminatedByScrapFactId?: string
}
```

装袋确认创建周期。`productionOrderNo` 由第一张菲票确定，后续菲票必须一致。

### 2.3 袋级事实

```ts
interface TransferBagFactBase {
  factId: string
  idempotencyKey: string
  carrierId: string
  bagCode: string
  usageCycleId: string
  occurredAt: string
  operatorId: string
  operatorName: string
}
```

业务事实至少包括：

- `BAGGING_CONFIRMED`
  - `productionOrderNo`
  - 不可变 `ticketNos`
- `INBOUND_CONFIRMED`
  - `warehouseArea`
  - `locationCode`
  - 由装袋事实复制的只读快照引用
- `HANDOVER_CONFIRMED`
  - `handoverLegId`
  - `handoverSequence`
  - `receiverTaskId`
  - `receiverFactoryId`
  - 完整袋内快照
- `SPECIAL_CRAFT_BAG_RETURNED`
  - `handoverLegId`
  - `sourceHandoverRecordId`
  - `craftType`
  - `sourceFactoryId`
  - `warehouseArea`
  - `locationCode`
- `PHYSICAL_BAG_RETURNED`
  - `reusableDecision`
  - 独立差异引用
- `BAG_SCRAPPED`
  - `scrapReason`
  - `authorizedBy`

无物理袋的特殊工艺回仓不创建袋级事实。

### 2.4 派生优先级

```text
明确报废事实
> 周期已关闭且可复用
> 未关闭周期最新整袋交出
> 未关闭周期最新普通入仓或带袋特殊工艺回仓
> 未关闭周期已确认装袋
> 无未关闭周期
```

任何页面草稿、PDA 临时账、接收状态、接收差异或回写状态都不参与派生。

### 2.5 历史兼容

- 旧事实有明确袋号、时间和关闭边界时，允许归入推断周期。
- 无法唯一归属时只显示历史，当前投影设置 `compatibilityBlockedReason` 并阻断新动作。
- 旧主状态只在一个集中归一化函数中读取。
- 新写入不得使用旧主状态或旧“交出装袋确认”事件。
- 同一物理袋新周期不得读取上一周期的阶段事实。

---

## 3. 任务 1：建立生命周期纯函数和红灯门禁

**文件：**

- 创建：`src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- 创建：`scripts/check-transfer-bag-three-status.ts`
- 修改：`package.json`

- [ ] **步骤 1：先写失败检查**

覆盖：

1. 三个主状态和三个阶段的中文映射。
2. 无周期、装袋、入仓、交出、带袋回仓、可复用回收和报废。
3. 下游接收、回写、差异不改变状态。
4. 同一袋两个周期时，只读取最新未关闭周期。
5. 同一周期多次交出时，按最新未关闭交出流转段派生。
6. 模糊旧事实被阻断，不生成第四种状态。

- [ ] **步骤 2：确认红灯**

```bash
npm run check:transfer-bag-three-status
```

预期：新模块尚不存在或旧状态断言失败。

- [ ] **步骤 3：实现纯派生模块**

要求：

- 不读取 DOM。
- 不修改运行时 store。
- 不依赖 Web/PDA 页面模块。
- 输入为事实集合，输出唯一生命周期视图。
- 动作资格从视图计算，不由页面重复判断。

- [ ] **步骤 4：运行绿灯**

```bash
npm run check:transfer-bag-three-status
```

预期：PASS，三主状态、三阶段和事实派生用例全部通过。

- [ ] **步骤 5：提交生命周期模块**

```bash
git add package.json src/data/fcs/cutting/transfer-bag-lifecycle.ts scripts/check-transfer-bag-three-status.ts
git commit -m "feat: 建立中转袋三状态生命周期投影"
```

---

## 4. 任务 2：补齐使用周期、交出流转段、幂等和历史迁移

**文件：**

- 修改：`src/data/fcs/cutting/transfer-bag-runtime.ts`
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-model.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-projection.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`

- [ ] **步骤 1：增加失败用例**

断言：

- 确认装袋创建 `usageCycleId`。
- 草稿不创建周期。
- 同一周期所有新事实都有同一个 `usageCycleId`。
- 每次交出生成新的 `handoverLegId` 和递增顺序。
- 当前交出流转段未关闭时不能再次交出。
- 带袋特殊工艺回仓只关闭当前交出流转段。
- 物理回收或直接报废才关闭周期。
- 同一幂等键重复追加只返回已有事实。
- 模糊旧事件不进入当前周期。

- [ ] **步骤 2：扩展运行时类型和序列化**

给新事实补齐周期与流转段字段。读取旧数据时集中迁移，不能在各页面各写一套推断。

- [ ] **步骤 3：实现统一事实查询**

提供按 `bagCode/carrierId` 读取：

- 当前使用周期。
- 当前交出流转段。
- 当前周期全部袋级事实。
- 历史周期。
- 是否存在兼容阻断。

查询入口固定为：

```ts
export function listTransferBagFacts(input: {
  carrierId?: string
  bagCode?: string
  usageCycleId?: string
}): TransferBagFact[]

export function buildTransferBagLifecycleByCode(
  bagCode: string,
): TransferBagLifecycleView
```

- [ ] **步骤 4：实现幂等追加**

幂等键建议：

```text
袋身份 + 使用周期 + 动作类型 + 交出流转段/顺序
```

事实已存在时返回已有记录。相互冲突的动作根据追加前最新投影阻断。

追加入口固定为：

```ts
export function appendTransferBagFact(
  fact: TransferBagFact,
): {
  fact: TransferBagFact
  appended: boolean
}
```

- [ ] **步骤 5：把投影改为唯一入口**

`buildTransferBagsProjection()` 和待交出仓运行时投影都调用统一生命周期模块。旧 `master.currentStatus` 如保留，仅作读取兼容或缓存，不再决定动作资格，也不在动作处理器中直接写成流程状态。

- [ ] **步骤 6：运行检查**

```bash
npm run check:transfer-bag-three-status
npm run check:transfer-bag-mobile-closed-loop
```

预期：均 PASS；同袋多周期、幂等追加和历史模糊数据用例通过。

- [ ] **步骤 7：提交周期与事实账**

```bash
git add src/data/fcs/cutting/transfer-bag-runtime.ts src/data/fcs/cutting/cutting-runtime-event-ledger.ts src/pages/process-factory/cutting/wait-handover-runtime.ts src/pages/process-factory/cutting/transfer-bags-model.ts src/pages/process-factory/cutting/transfer-bags-projection.ts scripts/check-transfer-bag-three-status.ts
git commit -m "refactor: 统一中转袋使用周期与事实账"
```

---

## 5. 任务 3：收口 Web 待交出仓为真实袋级事实路径

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-web-actions.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`
- 修改：`tests/cutting-wait-handover-web-modal.spec.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`

- [ ] **步骤 1：把检查改成真实闭环红灯**

检查必须验证：

- 点击页面实际按钮后，运行时事实数量增加。
- 页面重新渲染后仍显示成功结果。
- 主列表/详情投影同步变化。
- 仅改变 `runtimeCandidates/runtimeStates` 不算通过。
- 双击或回车加点击不新增第二条事实。

- [ ] **步骤 2：确认现有双处理器问题会失败**

```bash
npm run check:web-cutting-transfer-bag-actions
npx playwright test tests/cutting-wait-handover-web-modal.spec.ts
```

- [ ] **步骤 3：保留一个动作分发入口**

选择一个统一入口负责：

1. 解析页面动作。
2. 校验最新生命周期。
3. 追加事实。
4. 根据事实返回成功结果。
5. 局部刷新当前工作台。

另一个处理器删除，或收口为不修改业务状态的纯校验/适配函数。主处理器注册顺序不得再改变写入结果。

统一入口的返回契约固定为：

```ts
export interface WaitHandoverActionResult {
  handled: boolean
  success: boolean
  factId?: string
  message: string
  refreshTargets: Array<'summary' | 'bagging' | 'inbound' | 'handover'>
}
```

- [ ] **步骤 4：拆开装袋和入仓**

装袋：

- 接收袋号和菲票。
- 第一张菲票确定生产单。
- 确认后创建周期并写 `BAGGING_CONFIRMED`。

入仓：

- 只接收袋号、库区、库位。
- 从当前装袋事实读取袋内快照。
- `appendWaitHandoverInboundEvent()` 不再接受页面传入的菲票数组。
- 删除入仓弹窗中的菲票扫描/选择输入。

入仓命令只能是：

```ts
interface ConfirmTransferBagInboundCommand {
  bagCode: string
  warehouseArea: string
  locationCode: string
  operatorId: string
  operatorName: string
}
```

- [ ] **步骤 5：实现整袋交出**

- 一次命令只接收一只袋和一个接收任务/工厂。
- 系统读取完整装袋快照。
- 任一袋内菲票已存在本次交出时，整次阻断。
- 不过滤已交菲票后提交剩余菲票。
- 一只袋生成一条袋级交出记录。
- “中转袋交出”页签继续渲染已完成交出记录。
- 删除新写“交出装袋确认”的入口和事件。

交出命令只能是：

```ts
interface ConfirmWholeBagHandoverCommand {
  bagCode: string
  receiverTaskId: string
  receiverFactoryId: string
  operatorId: string
  operatorName: string
}
```

- [ ] **步骤 6：验证局部刷新和性能**

打开/关闭弹窗、提交、切页签不触发 `root.innerHTML` 级整页重绘；成功后只更新相关列表、摘要和弹窗区域，响应目标不高于 200ms。

- [ ] **步骤 7：运行检查**

```bash
npm run check:web-cutting-transfer-bag-actions
npx tsx scripts/check-cutting-wait-handover-transfer-bag-flow.ts
npx playwright test tests/cutting-wait-handover-web-modal.spec.ts
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts
```

预期：全部 PASS；页面重载后仍能看到事实，重复确认不会增加事实数。

- [ ] **步骤 8：提交 Web 真实动作闭环**

```bash
git add src/pages/process-factory/cutting/warehouse-hub.ts src/pages/process-factory/cutting/wait-handover-web-actions.ts src/pages/process-factory/cutting/wait-handover-runtime.ts src/main-handlers/fcs-handlers.ts scripts/check-web-cutting-transfer-bag-actions.ts tests/cutting-wait-handover-web-modal.spec.ts tests/cutting-runtime-event-ledger-pda-web.spec.ts
git commit -m "fix: 打通中转袋Web袋级事实闭环"
```

---

## 6. 任务 4：让 PDA 装袋、入仓、交出写同一事实账

**文件：**

- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`src/main-handlers/pda-handlers.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`

- [ ] **步骤 1：反转旧 Mock-only 检查**

删除“不得写入运行时事件账”一类旧正向断言，改为：

- PDA 成功后存在统一事实。
- 重新创建页面状态仍能恢复结果。
- Web 重新渲染可见 PDA 事实。
- PDA 临时账只是由事实派生的展示缓存。

- [ ] **步骤 2：确认红灯**

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
```

- [ ] **步骤 3：PDA 装袋**

- 只接受“空闲 / —”。
- 逐张扫码但确认时一次写入完整袋内快照。
- 同生产单校验与 Web 相同。
- 事实写入成功后显示“菲票已装袋”。

- [ ] **步骤 4：PDA 入仓**

- 只接受“使用中 / 菲票已装袋”。
- 输入只包含袋号、库区、库位。
- 不要求菲票扫描。
- 事实写入成功后显示“入仓成功”。

- [ ] **步骤 5：PDA 整袋交出**

- 只接受“使用中 / 入仓暂存中”。
- 输入为袋号和接收任务/工厂。
- 不扫描单张菲票，不复用旧通用单票交出写入路径。
- 写入与 Web 相同的袋级 `HANDOVER_CONFIRMED`。
- 成功后显示“整袋交出成功”。
- 删除 PDA 新写“交出装袋确认”入口。

PDA 必须复用与 Web 相同的命令：

```ts
const result = confirmWholeBagHandover({
  bagCode,
  receiverTaskId,
  receiverFactoryId,
  operatorId,
  operatorName,
})
```

- [ ] **步骤 6：跨端和幂等检查**

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npx playwright test tests/cutting-runtime-event-ledger-pda-web.spec.ts
```

覆盖 PDA 重试、Web 重放和同袋冲突动作。

- [ ] **步骤 7：提交 PDA 事实闭环**

```bash
git add src/pages/pda-cutting-inbound.ts src/pages/pda-cutting-handover.ts src/main-handlers/pda-handlers.ts src/pages/process-factory/cutting/wait-handover-runtime.ts scripts/check-pda-cutting-inbound-workflow.ts scripts/check-pda-cutting-transfer-bag-handover.ts tests/cutting-runtime-event-ledger-pda-web.spec.ts
git commit -m "fix: 统一中转袋PDA与Web事实写入"
```

---

## 7. 任务 5：调整中转袋主列表、详情、回收和直接报废

**文件：**

- 修改：`src/pages/process-factory/cutting/transfer-bags/state.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/list.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/detail.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bag-return-model.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：相关中转袋 Playwright 用例

- [ ] **步骤 1：增加渲染和动作红灯**

断言：

- 状态筛选只有三个主状态。
- 阶段筛选只有三个阶段。
- 两者分别渲染为必需列。
- 空闲和已报废阶段显示“—”。
- 回收差异不会输出报废。
- 直接报废必须填写原因并保存授权人。
- 动作处理器不直接把旧主状态写为流程状态。

- [ ] **步骤 2：拆分筛选、摘要和列**

继续使用：

- `renderStandardListPage`
- `renderStandardListTable`
- `renderTablePagination`

要求：

- 摘要按空闲、使用中、已报废统计。
- 状态列和阶段列均为必需列。
- 支持排序、显示、顺序和冻结。
- 操作列固定右侧。
- 宽表内部滚动。

- [ ] **步骤 3：详情分层**

头部显示袋号、主状态、阶段、当前位置/接收方和当前周期。

详情独立展示并分页：

- 袋内菲票。
- 入仓记录。
- 袋级交出记录。
- 特殊工艺回仓。
- 接收/回写。
- 回收。
- 报废。
- 差异。
- 历史周期。

- [ ] **步骤 4：回收结论与差异分离**

`closeTransferBagUsageCycle()`：

- 可复用 → 关闭周期并派生空闲。
- 不可复用 → 写报废事实并派生已报废。
- `warningMessages` 或差异记录不改变回收结论。

关闭结果固定为：

```ts
interface CloseTransferBagCycleResult {
  usageCycleId: string
  closeResult: 'REUSABLE' | 'DISABLED'
  discrepancyIds: string[]
  lifecycle: TransferBagLifecycleView
}
```

- [ ] **步骤 5：增加主管直接报废**

入口只对允许角色和非已报废袋展示。确认必须包含报废原因、操作者和时间。使用中直接报废要显式终止当前周期，不能静默覆盖未完成事实。

- [ ] **步骤 6：验证**

```bash
npm run check:transfer-bag-three-status
npm run check:list-page-governance
npx playwright test tests/cutting-transfer-bag-simplified-statuses.spec.ts
npx playwright test tests/cutting-transfer-bag-detail-header.spec.ts
npx playwright test tests/cutting-transfer-bag-detail-tabs.spec.ts
npx playwright test tests/cutting-transfer-bag-confirm-local-refresh.spec.ts
```

预期：全部 PASS；列表治理没有新增基线，差异和报废用例分离。

- [ ] **步骤 7：提交主列表、详情和回收报废**

```bash
git add src/pages/process-factory/cutting/transfer-bags/state.ts src/pages/process-factory/cutting/transfer-bags/handlers.ts src/pages/process-factory/cutting/transfer-bags/list.ts src/pages/process-factory/cutting/transfer-bags/detail.ts src/pages/process-factory/cutting/transfer-bags/dialogs.ts src/pages/process-factory/cutting/transfer-bag-return-model.ts scripts/check-transfer-bag-three-status.ts tests/cutting-transfer-bag-simplified-statuses.spec.ts tests/cutting-transfer-bag-detail-header.spec.ts tests/cutting-transfer-bag-detail-tabs.spec.ts tests/cutting-transfer-bag-confirm-local-refresh.spec.ts
git commit -m "feat: 分层展示中转袋状态与流转阶段"
```

---

## 8. 任务 6：特殊工艺、有袋/无袋回仓和多次交出

**文件：**

- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- 修改：`scripts/check-cutting-special-craft-dispatch-return.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`

- [ ] **步骤 1：先写两类回仓红灯**

带袋回仓：

- 必须有实际袋号和来源交出记录。
- 关闭当前交出流转段。
- 写袋级回仓事实。
- 阶段回到“入仓暂存中”。

无袋回仓：

- 只写菲票/裁片/库存/特殊工艺记录。
- 不生成袋级事实。
- 不改变任何袋状态。

- [ ] **步骤 2：实现当前交出流转段关闭**

特殊工艺带袋回仓后使用周期保持打开。再次交出时生成新的 `handoverLegId` 和顺序号，不复用旧交出记录。

带袋回仓命令固定为：

```ts
interface ConfirmSpecialCraftBagReturnCommand {
  bagCode: string
  sourceHandoverRecordId: string
  warehouseArea: string
  locationCode: string
  operatorId: string
  operatorName: string
}
```

- [ ] **步骤 3：保留差异**

内容差异独立保存。物理袋已回仓时，袋位置阶段可以回到入仓；如果内容归属不满足后续任务，则阻断再次交出并给出明确原因。

- [ ] **步骤 4：验证**

```bash
npm run check:cutting-special-craft-dispatch-return
npm run check:transfer-bag-three-status
npx tsx scripts/check-cutting-wait-handover-transfer-bag-flow.ts
```

预期：全部 PASS；有袋与无袋回仓、再次整袋交出分别通过。

- [ ] **步骤 5：提交特殊工艺回仓边界**

```bash
git add src/pages/process-factory/cutting/warehouse-hub.ts src/pages/process-factory/cutting/wait-handover-runtime.ts src/data/fcs/cutting/cutting-runtime-event-ledger.ts scripts/check-cutting-special-craft-dispatch-return.ts scripts/check-transfer-bag-three-status.ts
git commit -m "fix: 区分特殊工艺有袋与无袋回仓"
```

---

## 9. 任务 7：下游接收边界、扫码详情和稳定标签

**文件：**

- 修改：`src/data/fcs/cutting/sewing-dispatch.ts`
- 修改：`src/data/fcs/factory-mobile-warehouse.ts`
- 修改：`src/pages/pda-handover-detail.ts`
- 修改：`src/pages/pda-transfer-bag-detail.ts`
- 修改：`src/pages/print/templates/label-print-template.ts`（仅发现动态字段泄漏时）
- 修改：`scripts/check-cutting-sewing-dispatch.ts`
- 修改：`scripts/check-handover-writeback-difference-unification.ts`
- 修改：`scripts/check-pda-handover-detail-source.ts`
- 修改：`scripts/check-transfer-bag-mobile-closed-loop.ts`

- [ ] **步骤 1：增加下游不变式红灯**

对同一袋依次执行：

- 已扫码接收。
- 接收差异。
- 已回写。

每一步都断言物理袋仍为“使用中 / 已交出待回收”，直到物理回收事实发生。

- [ ] **步骤 2：区分记录状态和物理袋状态**

保留 `packStatus` 等历史字段承载交出/接收/回写记录状态，但：

- 页面标题和列名明确其记录含义。
- 中转袋状态从统一生命周期投影读取。
- 下游写回函数不修改物理袋主状态或阶段。

下游页面需要同时展示时，使用两个明确字段：

```ts
{
  transferBagLifecycle: buildTransferBagLifecycleByCode(bagCode),
  receiveWritebackStatus: dispatchBag.packStatus,
}
```

- [ ] **步骤 3：改扫码详情**

- 状态和阶段来自统一生命周期投影。
- 袋内内容可从派工/装袋快照读取。
- 操作按钮根据角色和当前阶段显示。
- 已交出后不再长期显示装袋、移除菲票、按菲票确认等不允许动作。
- Web/PDA 扫同一袋显示一致。

- [ ] **步骤 4：守住稳定标签**

检查打印模板和二维码数据：

- 只含袋号、稳定身份和必要固定归属。
- 不打印主状态、阶段、周期、库位、接收状态。
- 扫码后再查询实时状态。

- [ ] **步骤 5：验证**

```bash
npm run check:cutting-sewing-dispatch
npm run check:handover-writeback-difference-unification
npm run check:pda-handover-detail-source
npm run check:transfer-bag-mobile-closed-loop
```

预期：全部 PASS；标签仍为稳定身份，下游处理不会改变袋生命周期。

- [ ] **步骤 6：提交下游与扫码详情边界**

```bash
git add src/data/fcs/cutting/sewing-dispatch.ts src/data/fcs/factory-mobile-warehouse.ts src/pages/pda-handover-detail.ts src/pages/pda-transfer-bag-detail.ts src/pages/print/templates/label-print-template.ts scripts/check-cutting-sewing-dispatch.ts scripts/check-handover-writeback-difference-unification.ts scripts/check-pda-handover-detail-source.ts scripts/check-transfer-bag-mobile-closed-loop.ts
git commit -m "fix: 分离中转袋生命周期与接收回写状态"
```

---

## 10. 任务 8：清理旧写入口和重写完整流转门禁

**文件：**

- 修改：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`
- 修改：`scripts/check-web-cutting-transfer-bag-actions.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`
- 修改：`scripts/check-transfer-bag-three-status.ts`
- 修改：`scripts/check-cutting-clean-mainline.ts`（仅加入精确、可维护的新写入禁用规则）

- [ ] **步骤 1：删除旧正向期望**

删除对以下行为的正向断言：

- 多个流程值作为中转袋主状态。
- Web 只修改临时候选即判成功。
- PDA 不写运行时事实账。
- 按菲票局部交出。
- 新增“交出装袋确认”。
- 标签打印动态生命周期字段。

- [ ] **步骤 2：增加精确禁用规则**

仅对中转袋新写路径检查：

- 旧主状态不得再写入。
- 新增“交出装袋确认”不得出现。
- 入仓命令不得接收菲票数组或菲票输入。
- 交出命令不得接收单张菲票或部分数量。
- 页面不得把接收/回写状态标为“中转袋状态”。

历史兼容读取必须使用精确文件/函数白名单，不能全局放宽。

- [ ] **步骤 3：运行专项检查矩阵**

```bash
npm run check:transfer-bag-three-status
npm run check:web-cutting-transfer-bag-actions
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:transfer-bag-mobile-closed-loop
npm run check:cutting-special-craft-dispatch-return
npm run check:cutting-sewing-dispatch
npm run check:handover-writeback-difference-unification
npx tsx scripts/check-cutting-wait-handover-transfer-bag-flow.ts
```

- [ ] **步骤 4：运行裁床全量检查**

```bash
npm run check:cutting:all
```

如果出现新失败，停止并修复。若只剩已知宽表基线失败，记录为本任务外阻塞。

- [ ] **步骤 5：提交旧口径治理门禁**

```bash
git add scripts/check-cutting-wait-handover-transfer-bag-flow.ts scripts/check-web-cutting-transfer-bag-actions.ts scripts/check-pda-cutting-inbound-workflow.ts scripts/check-pda-cutting-transfer-bag-handover.ts scripts/check-transfer-bag-three-status.ts scripts/check-cutting-clean-mainline.ts
git commit -m "test: 锁定中转袋三状态完整流转"
```

---

## 11. 任务 9：原型治理、浏览器验收和最终收据

**文件：**

- 创建：`docs/prototype-review-records/2026-07-30-cutting-transfer-bag-three-status.md`
- 修改：仅限前述任务在自查中发现的问题。

- [ ] **步骤 1：填写原型审查记录**

必须覆盖：

- Web/PDA/下游接收角色和端类型。
- 三主状态与三阶段分层。
- 使用周期和交出流转段。
- 装袋、入仓、整袋交出、特殊工艺有袋/无袋回仓、回收和报废。
- 下游接收/回写与物理袋状态边界。
- 稳定标签与实时扫码详情。
- 重复操作、幂等、失败反馈和历史模糊数据。
- 1366×768 和 1280×720。
- 分页、宽表内部滚动、弹窗局部刷新和 200ms 响应目标。
- 已知无关宽表基线例外。

- [ ] **步骤 2：运行治理检查**

```bash
npm run check:list-page-governance
npm run check:prototype-design-governance
```

- [ ] **步骤 3：启动局域网服务**

```bash
npm run dev -- --host 0.0.0.0 --port 61011
```

获取局域网 IP，并用该 IP 验证目标路由返回 200。

- [ ] **步骤 4：浏览器验收**

在 1366×768 和 1280×720 验证：

1. 中转袋主列表
   - 状态和阶段分列、分筛选。
   - 空闲/已报废阶段显示“—”。
   - 分页、列设置、冻结和固定操作列可用。
2. Web 待交出仓
   - 装袋后重载仍为“使用中 / 菲票已装袋”。
   - 入仓弹窗没有菲票输入。
   - 整袋交出后“中转袋交出”页签新增袋级完成记录。
   - 双击不产生重复事实。
3. PDA
   - 每页一个主动作。
   - 装袋、入仓、整袋交出后 Web 可见同一结果。
4. 特殊工艺
   - 带袋回仓改变袋阶段。
   - 无袋回仓不改变袋。
   - 同周期可再次整袋交出。
5. 下游接收
   - 接收、差异、回写不关闭袋周期。
6. 回收与报废
   - 可复用回收变空闲。
   - 明确不可复用或主管报废才变已报废。
   - 内容差异不会自动报废。
7. 扫码详情
   - Web/PDA 状态一致。
   - 标签为稳定身份，详情为实时状态。
   - 动作随角色和阶段变化。

- [ ] **步骤 5：提交原型审查记录**

```bash
git add docs/prototype-review-records/2026-07-30-cutting-transfer-bag-three-status.md
git commit -m "docs: 记录中转袋三状态原型审查"
```

- [ ] **步骤 6：构建和 CodeGraph 最终同步**

```bash
npm run build
codegraph sync
codegraph status
```

最后一次实质改动后必须重新运行，CodeGraph 不得有待同步文件。

- [ ] **步骤 7：记录最终阶段轨迹**

如果本次实现使用了 Superpowers 技能，记录：

- 触发原因。
- 实际技能调用证据。
- 规格和计划产物。
- 各任务实现提交。
- 规格审查结论。
- 代码质量审查结论。
- 最终验证结果。

- [ ] **步骤 8：生成机器可读收据**

```bash
receipt_dir=$(mktemp -d /tmp/higoods-transfer-bag-three-status-XXXXXX)
npm run workflow:verify -- \
  --output "$receipt_dir/task-receipt.json" \
  --task-boundary "统一中转袋三主状态与三流转阶段，打通Web、PDA、特殊工艺、下游接收、物理回收、二维码详情及历史周期事实"
```

收据必须绑定最终 Git HEAD、工作区差异指纹、相关检查结果和 CodeGraph 同步状态。最后一次实质改动后旧收据失效。

---

## 12. 规格覆盖矩阵

| 规格要求 | 实现任务 |
| --- | --- |
| 主状态只保留空闲、使用中、已报废 | 任务 1、2、5、8 |
| 三个阶段独立表达 | 任务 1、2、5 |
| 状态由事实纯派生 | 任务 1、2 |
| 同袋多使用周期隔离 | 任务 1、2 |
| 特殊工艺周期内多次交出 | 任务 2、6 |
| 装袋确认创建周期且同生产单 | 任务 2、3、4 |
| 入仓只输入袋号、库区、库位 | 任务 3、4、8 |
| 整袋交出且一次一袋 | 任务 3、4、8 |
| 取消新增“交出装袋确认” | 任务 3、4、8 |
| Web 真实事实写入和单分发入口 | 任务 3 |
| PDA 真实事实写入和跨端一致 | 任务 4 |
| 回收、差异、直接报废分离 | 任务 5 |
| 特殊工艺有袋/无袋分离 | 任务 6 |
| 下游接收/差异/回写不改变袋状态 | 任务 7 |
| 稳定标签和实时扫码详情 | 任务 7 |
| 幂等、双击和跨端重放 | 任务 2、3、4、8 |
| 历史模糊事实阻断 | 任务 2、5 |
| 列表分页和标准列表治理 | 任务 5、9 |
| 浏览器、构建、CodeGraph 和收据 | 任务 9 |

## 13. 计划自检结论

- 代码核查覆盖：已覆盖真实 Web 路由与处理器顺序、运行时事件账、主档/周期投影、PDA Mock 与主处理器、特殊工艺、下游接收回写、扫码详情、打印模板和相关检查。
- 业务覆盖：已覆盖物理袋身份、使用周期、交出流转段、三主状态、三阶段、装袋、入仓、整袋交出、特殊工艺有袋/无袋回仓、回收、报废、差异、接收回写和历史兼容。
- 实施可执行性：每个任务都列出文件、红灯、实现约束、验证命令和提交边界。
- 防止假闭环：明确要求事实账写入、页面重新渲染和 Web/PDA 跨端验证，不接受只修改临时账或只检查成功文案。
- 标签边界：保留稳定物理标签，不把实时状态打印到可复用标签。
- 范围控制：不修改无关菜单、全局布局、技术栈、部署配置或已知无关宽表页面。
- 已知例外：裁床全量检查的既有宽表失败必须单独报告，不得掩盖或扩大本次需求。
