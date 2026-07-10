# 含车缝任务交付与回货时效实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为独立车缝任务和含车缝连续工序任务建立按实际工厂分配结果考核的交付与回货时效闭环，并以接收方确认实收事实计算30%、70%和100%节点。

**架构：** 新增纯业务履约模块，负责任务分类、履约快照、满24小时节点和实收投影；现有运行时任务在直接派单或竞价接单时激活快照，现有交出域继续保存交出与实收事实。进度、PDA和接收页面读取同一投影；生产单主工厂保持唯一，全部车缝承接工厂另行记录。

**技术栈：** Vite、TypeScript、Vanilla TypeScript字符串模板、Tailwind CSS、Node/tsx检查脚本、CodeGraph。

---

## 执行约束与已知基线

- 在独立 worktree 中执行，基线至少包含规格提交 `6ea3e71a`。
- 不带入主工作区现有的生产准备时效未提交文件。
- 不引入React、状态管理、后端、通用规则引擎或新依赖。
- “第N天”统一实现为接单时间加 `N × 24小时`。
- 已知基线：`check:sewing-dispatch-workbench` 因连续任务混入车缝工作台而失败；另外两项连续任务检查通过。

执行前运行：

```bash
codegraph sync
codegraph status
npm run check:sewing-dispatch-workbench
npm run check:continuous-process-route-eligibility
npm run check:fcs-task-generation-rules
```

## 文件结构

### 新建

- `src/data/fcs/sewing-delivery-sla.ts`：分类、快照、节点计算和实收投影。
- `src/data/fcs/sewing-delivery-sla-view.ts`：组装运行时任务与PDA交出/实收事实。
- `scripts/check-sewing-delivery-sla.ts`：本需求主回归脚本。
- `docs/prototype-review-records/2026-07-10-sewing-delivery-return-sla.md`：设计治理记录。

### 主要修改

- `src/data/fcs/runtime-process-tasks.ts`、`process-tasks.ts`：分配时间、统一接单、快照激活、改派。
- `src/data/fcs/production-orders.ts`、`src/pages/production/context.ts`：唯一主工厂与车缝承接工厂分离。
- `src/pages/dispatch-board/*`、`src/pages/continuous-dispatch.ts`：真实派单/竞价和时间预览。
- `src/pages/pda-task-receive*.ts`、`src/pages/dispatch-tenders.ts`：竞价定标后工厂确认接单。
- `src/data/fcs/store-domain-progress.ts`、`src/pages/progress-board/task-domain.ts`：统一履约跟踪。
- `src/pages/pda-exec-detail.ts`、`src/pages/pda-handover-detail.ts`：员工端与接收确认表达。
- `src/pages/progress-exceptions/events.ts`：按独立/连续任务跳转正确改派入口。

## 任务1：建立纯履约规则、快照和投影

**文件：**
- 创建：`src/data/fcs/sewing-delivery-sla.ts`
- 创建：`scripts/check-sewing-delivery-sla.ts`
- 修改：`package.json`

- [ ] **步骤1：写失败测试**

```ts
import assert from 'node:assert/strict'
import {
  classifySewingDeliverySla,
  createSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
} from '../src/data/fcs/sewing-delivery-sla.ts'

assert.equal(classifySewingDeliverySla({
  taskUnitType: 'PROCESS_TASK', processCode: 'SEW', processBusinessCode: 'SEW', processNameZh: '车缝',
  coveredProcesses: [{ processCode: 'SEW', processName: '车缝', sourceArtifactIds: [] }],
}), 'INDEPENDENT_SEWING')

assert.equal(classifySewingDeliverySla({
  taskUnitType: 'COMBINED_PROCESS_TASK', processCode: 'POST', processNameZh: '车缝到后道',
  coveredProcesses: [
    { processCode: 'SEW', processName: '车缝', sourceArtifactIds: [] },
    { processCode: 'BUTTON', processName: '装扣', sourceArtifactIds: [] },
    { processCode: 'POST', processName: '包装', sourceArtifactIds: [] },
  ],
}), 'SEWING_TO_PACKAGING')

assert.equal(classifySewingDeliverySla({
  taskUnitType: 'COMBINED_PROCESS_TASK', processCode: 'POST', processNameZh: '裁片到后道',
  coveredProcesses: [
    { processCode: 'CUT', processName: '裁片', sourceArtifactIds: [] },
    { processCode: 'SEW', processName: '车缝', sourceArtifactIds: [] },
    { processCode: 'POST', processName: '后道', sourceArtifactIds: [] },
  ],
}), 'CUTTING_TO_PACKAGING')

const snapshot = createSewingDeliverySlaSnapshot({
  assignmentId: 'ASSIGN-1', runtimeTaskId: 'TASK-1', productionOrderId: 'PO-1',
  factoryId: 'F-1', factoryName: '万隆车缝厂', assignedQty: 101,
  acceptedAt: '2026-07-01 15:30:00', slaKind: 'INDEPENDENT_SEWING',
})
assert.deepEqual(snapshot.milestones.map((item) => item.deadlineAt), [
  '2026-07-05 15:30:00', '2026-07-09 15:30:00', '2026-07-10 15:30:00',
])
assert.deepEqual(snapshot.milestones.map((item) => item.targetQty), [31, 71, 101])
```

- [ ] **步骤2：运行并确认失败**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-sewing-delivery-sla.ts`

预期：FAIL，模块不存在。

- [ ] **步骤3：实现公开类型和分类规则**

```ts
export type SewingDeliverySlaKind = 'INDEPENDENT_SEWING' | 'SEWING_TO_PACKAGING' | 'CUTTING_TO_PACKAGING'
export interface SewingDeliveryMilestoneSnapshot {
  ratio: 0.3 | 0.7 | 1
  hoursAfterAcceptance: number
  targetQty: number
  deadlineAt: string
}
export interface SewingDeliverySlaSnapshot {
  snapshotId: string
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  assignedQty: number
  acceptedAt: string
  slaKind: SewingDeliverySlaKind
  milestones: SewingDeliveryMilestoneSnapshot[]
  active: boolean
  replacedByAssignmentId?: string
}
export interface SewingDeliveryReceiptFact {
  recordId: string
  submittedQty: number
  submittedAt: string
  receivedQty: number
  receivedAt: string
  voided?: boolean
  reversedQty?: number
}
export type SewingDeliveryMilestoneResult = 'UPCOMING' | 'ON_TIME' | 'OVERDUE_PENDING' | 'OVERDUE_REACHED'
export interface SewingDeliveryMilestoneProjection extends SewingDeliveryMilestoneSnapshot {
  result: SewingDeliveryMilestoneResult
  firstReachedAt?: string
  receiverDelayRecordIds: string[]
}
export interface SewingDeliverySlaProjection {
  snapshot: SewingDeliverySlaSnapshot
  confirmedReceivedQty: number
  progressRatio: number
  remainingQty: number
  completed: boolean
  completedAt?: string
  milestones: SewingDeliveryMilestoneProjection[]
}
export function createSewingDeliverySlaSnapshot(input: {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  assignedQty: number
  acceptedAt: string
  slaKind: SewingDeliverySlaKind
}): SewingDeliverySlaSnapshot
export function projectSewingDeliverySla(
  snapshot: SewingDeliverySlaSnapshot,
  receipts: SewingDeliveryReceiptFact[],
  nowAt: string,
): SewingDeliverySlaProjection
```

规则常量必须是：

```ts
const RULE_HOURS: Record<SewingDeliverySlaKind, [number, number, number]> = {
  INDEPENDENT_SEWING: [96, 192, 216],
  SEWING_TO_PACKAGING: [120, 216, 240],
  CUTTING_TO_PACKAGING: [144, 216, 288],
}
```

分类读取 `coveredProcesses` 的首尾工序；中间工序不影响车缝到包装或裁片到包装分类。

- [ ] **步骤4：实现投影并补齐边界测试**

`projectSewingDeliverySla(snapshot, receipts, nowAt)` 按 `receivedAt` 排序累计有效实收，保存每个节点首次达标时间；作废不计、冲销扣减、比例不封顶、剩余量最低为0。加入以下断言：

```ts
const projection = projectSewingDeliverySla(snapshot, [
  { recordId: 'R1', submittedQty: 31, submittedAt: '2026-07-05 14:00:00', receivedQty: 31, receivedAt: '2026-07-05 16:00:00' },
  { recordId: 'R2', submittedQty: 80, submittedAt: '2026-07-09 10:00:00', receivedQty: 80, receivedAt: '2026-07-09 11:00:00' },
], '2026-07-10 16:00:00')
assert.equal(projection.confirmedReceivedQty, 111)
assert.equal(projection.progressRatio, 111 / 101)
assert.equal(projection.completed, true)
assert.equal(projection.milestones[0]?.result, 'OVERDUE_REACHED')
assert.deepEqual(projection.milestones[0]?.receiverDelayRecordIds, ['R1'])
```

- [ ] **步骤5：注册命令并验证**

`package.json` 增加：

```json
"check:sewing-delivery-sla": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-sewing-delivery-sla.ts"
```

运行：`npm run check:sewing-delivery-sla`

预期：PASS。

- [ ] **步骤6：提交**

```bash
git add package.json scripts/check-sewing-delivery-sla.ts src/data/fcs/sewing-delivery-sla.ts
git commit -m "feat: add sewing delivery sla domain"
```

## 任务2：直接派单保存业务分配时间并自动接单

**文件：**
- 修改：`src/data/fcs/process-tasks.ts:95-220`
- 修改：`src/data/fcs/runtime-process-tasks.ts:58-154,2319-2403`
- 修改：`src/pages/dispatch-board/context.ts:544-631`
- 修改：`src/pages/dispatch-board/events.ts:200-470`
- 修改：`src/pages/dispatch-board/dispatch-domain.ts:470-1030`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写直接派单失败测试**

```ts
const direct = applyRuntimeDirectDispatchMeta({
  taskId: sewingTask.taskId,
  factoryId: 'ID-F003', factoryName: '万隆车缝厂',
  businessAssignedAt: '2026-07-01 08:00:00', operatedAt: '2026-07-01 10:00:00',
  acceptDeadline: '', taskDeadline: '', remark: '', by: '跟单A',
  dispatchPrice: 12000, dispatchPriceCurrency: 'IDR', dispatchPriceUnit: '件', priceDiffReason: '',
})
assert.equal(direct?.acceptanceStatus, 'ACCEPTED')
assert.equal(direct?.acceptedAt, '2026-07-01 08:00:00')
assert.equal(direct?.businessAssignedAt, '2026-07-01 08:00:00')
assert.equal(direct?.assignmentOperatedAt, '2026-07-01 10:00:00')
assert.equal(getSewingDeliverySlaSnapshot(direct?.taskId || '')?.milestones[2]?.deadlineAt, '2026-07-10 08:00:00')
```

再断言业务分配时间晚于操作时间时抛出 `业务分配时间不能晚于当前操作时间`。

- [ ] **步骤2：运行确认失败**

运行：`npm run check:sewing-delivery-sla`

预期：FAIL，新增参数和快照仓尚不存在。

- [ ] **步骤3：扩展任务字段和直接派单函数**

在基础任务和运行时覆盖中增加：

```ts
businessAssignedAt?: string
assignmentOperatedAt?: string
deliverySlaSnapshotId?: string
```

在纯领域模块增加按运行时任务ID保存/读取快照的轻量内存仓。扩展 `applyRuntimeDirectDispatchMeta`：

```ts
export function saveSewingDeliverySlaSnapshot(snapshot: SewingDeliverySlaSnapshot): SewingDeliverySlaSnapshot
export function getSewingDeliverySlaSnapshot(runtimeTaskId: string): SewingDeliverySlaSnapshot | null

businessAssignedAt: string
operatedAt?: string
```

含车缝任务必须校验时间、自动接单、令 `acceptedAt = businessAssignedAt`，并以 `scopeQty` 创建快照；100%节点截止时间写入 `taskDeadline`。非含车缝任务保留现有接单时效行为。

- [ ] **步骤4：修改直接派单弹窗**

`DirectDispatchForm` 增加 `businessAssignedAt`，打开弹窗时默认当前时间。含车缝任务展示可编辑分配时间及只读30%、70%、100%截止预览；时间字段使用 `change`，不在每个字符输入时整页重绘。

- [ ] **步骤5：验证并提交**

```bash
npm run check:sewing-delivery-sla
npm run check:fcs-task-generation-rules
git add src/data/fcs/process-tasks.ts src/data/fcs/runtime-process-tasks.ts src/pages/dispatch-board/context.ts src/pages/dispatch-board/events.ts src/pages/dispatch-board/dispatch-domain.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: start sewing sla on direct dispatch"
```

预期：两项通过；未来分配时间被阻断，直接派单自动接单。

## 任务3：竞价定标后由中标工厂确认接单

**文件：**
- 修改：`src/data/fcs/runtime-process-tasks.ts:2143-2190,2405-2450`
- 修改：`src/pages/dispatch-board/context.ts:160-205,544-631`
- 修改：`src/pages/dispatch-board/events.ts:200-470`
- 修改：`src/pages/dispatch-board/tender-domain.ts:900-1050`
- 修改：`src/pages/dispatch-tenders.ts:514-546`
- 修改：`src/pages/pda-task-receive.ts:281-335,930-1220`
- 修改：`src/pages/pda-task-receive-detail.ts:178-225,600-800`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写竞价接单失败测试**

```ts
const awarded = awardRuntimeTaskTender({
  taskId: sewingBidTask.taskId, factoryId: 'ID-F003', factoryName: '万隆车缝厂',
  businessAssignedAt: '2026-07-01 16:00:00', assignmentOperatedAt: '2026-07-01 17:00:00',
  awardedAt: '2026-07-02 09:00:00', awardedPrice: 11800, by: '运营A',
})
assert.equal(awarded?.assignmentStatus, 'AWARDED')
assert.equal(awarded?.acceptanceStatus, 'PENDING')
assert.equal(awarded?.businessAssignedAt, '2026-07-01 16:00:00')
assert.equal(getSewingDeliverySlaSnapshot(sewingBidTask.taskId), null)

const accepted = acceptRuntimeTaskAssignment(sewingBidTask.taskId, {
  acceptedAt: '2026-07-02 11:30:00', acceptedBy: '万隆车缝厂',
})
assert.equal(accepted?.acceptanceStatus, 'ACCEPTED')
assert.equal(getSewingDeliverySlaSnapshot(sewingBidTask.taskId)?.acceptedAt, '2026-07-02 11:30:00')
```

- [ ] **步骤2：运行确认失败**

运行：`npm run check:sewing-delivery-sla`

预期：FAIL，统一定标/接单函数不存在。

- [ ] **步骤3：实现统一运行时函数**

```ts
export function awardRuntimeTaskTender(input: {
  taskId: string
  factoryId: string
  factoryName: string
  businessAssignedAt: string
  assignmentOperatedAt: string
  awardedAt: string
  awardedPrice: number
  by: string
}): RuntimeProcessTask | null

export function acceptRuntimeTaskAssignment(
  taskId: string,
  input: { acceptedAt: string; acceptedBy: string },
): RuntimeProcessTask | null
```

发起竞价时保存业务分配时间和实际操作时间，并阻断未来业务时间；定标只写中标工厂、价格、`AWARDED` 和 `PENDING`；接单函数写 `ACCEPTED`，并只在任务适用本设计时创建履约快照。竞价履约起点只取实际接单时间，不取业务分配时间。

- [ ] **步骤4：接通定标页和PDA**

竞价创建弹窗与直接派单一致提供业务分配时间，默认当前时间并使用 `change` 更新。`confirmAwardInView()` 调用定标函数。含车缝中标任务在PDA展示“确认接单”，删除“平台定标即视为任务归属确定，无需二次确认”。两个PDA接单页面删除直接修改任务字段的重复代码，调用统一接单函数；毛织、后道专用写回保持原边界。

- [ ] **步骤5：验证并提交**

```bash
npm run check:sewing-delivery-sla
npm run check:fcs-task-generation-rules
git add src/data/fcs/runtime-process-tasks.ts src/pages/dispatch-board/context.ts src/pages/dispatch-board/events.ts src/pages/dispatch-board/tender-domain.ts src/pages/dispatch-tenders.ts src/pages/pda-task-receive.ts src/pages/pda-task-receive-detail.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: start sewing sla after bid acceptance"
```

## 任务4：修正唯一主工厂和车缝工作台边界

**文件：**
- 修改：`src/data/fcs/production-orders.ts:193-220,307-315,605-658`
- 修改：`src/pages/production/context.ts:390-410`
- 修改：`src/data/fcs/runtime-process-tasks.ts:330-338,2143-2403`
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts:935-947`
- 修改：`src/pages/dispatch-board/dispatch-domain.ts:499-599,919-957`
- 修改：`scripts/check-sewing-dispatch-workbench.ts`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写失败测试并复现基线问题**

```ts
const workbenchIds = new Set(listSewingDispatchWorkbenchTasks().map((task) => task.taskId))
const continuousSewing = listRuntimeProcessTasks().find(
  (task) => task.taskUnitType === 'COMBINED_PROCESS_TASK' && isRuntimeSewingTask(task),
)
assert(continuousSewing)
assert.equal(workbenchIds.has(continuousSewing.taskId), false)
```

运行：`npm run check:sewing-dispatch-workbench`

预期：FAIL，连续任务污染或陈旧固定样本断言失败。

- [ ] **步骤2：拆开两个判断**

```ts
export function isRuntimeIndependentSewingTask(
  task: RuntimeSewingTaskLike & { taskUnitType?: string; acceptanceMode?: string },
): boolean {
  return isRuntimeSewingTask(task)
    && task.taskUnitType !== 'COMBINED_PROCESS_TASK'
    && task.acceptanceMode !== 'CONTINUOUS_PROCESS'
}
```

车缝工作台使用窄口径；主工厂候选和履约分类继续使用宽口径。测试按 `processBusinessCode === 'SEW'` 动态选择独立样本，不依赖可能被合并覆盖的固定ID。

- [ ] **步骤3：拆开唯一主工厂与全部车缝承接工厂**

生产单多值字段改为 `sewingFactorySnapshots?: FactorySnapshot[]`，`mainFactoryId/mainFactorySnapshot` 只表示唯一主工厂。新增：

```ts
export function registerProductionOrderSewingFactory(input: {
  productionOrderId: string; factoryId: string; factoryName?: string; by: string; at: string
}): ProductionOrder | null
export function selectProductionOrderMainFactory(input: {
  productionOrderId: string; factoryId: string; by: string; at: string; reason: string
}): ProductionOrder | null
export function listProductionOrderSewingFactories(productionOrderId: string): FactorySnapshot[]
```

第一家自动成为主工厂；后续工厂只增加承接关系，不覆盖主工厂。主工厂必须来自有效车缝承接工厂。

- [ ] **步骤4：验证主工厂选择和分配校验**

按明细分给多家工厂时继续要求选择一个主工厂；已有有效主工厂时显示并允许有权限人员调整。断言任何时刻 `formatProductionOrderMainFactoryName` 只返回一家。

- [ ] **步骤5：运行并提交**

```bash
npm run check:sewing-dispatch-workbench
npm run check:sewing-delivery-sla
npm run check:fcs-task-generation-rules
git add src/data/fcs/production-orders.ts src/pages/production/context.ts src/data/fcs/runtime-process-tasks.ts src/data/fcs/sewing-dispatch-workbench.ts src/pages/dispatch-board/dispatch-domain.ts scripts/check-sewing-dispatch-workbench.ts scripts/check-sewing-delivery-sla.ts
git commit -m "fix: separate sewing scope from main factory"
```

## 任务5：补齐连续工序任务真实分配入口

**文件：**
- 修改：`src/pages/continuous-dispatch.ts:14-425`
- 修改：`src/data/fcs/runtime-process-tasks.ts:2107-2403`
- 修改：`scripts/check-fcs-task-generation-rules.ts:107-166,508-608`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写页面动作失败断言**

```ts
assertIncludes(continuousDispatchSource, '直接派单', '连续任务缺少直接派单入口')
assertIncludes(continuousDispatchSource, '发起竞价', '连续任务缺少发起竞价入口')
assertIncludes(continuousDispatchSource, '业务分配时间', '连续任务缺少可回填分配时间')
assertNotIncludes(continuousDispatchSource, '>整任务分配</button>', '分配粒度不应作为动作名称')
```

运行：`npm run check:fcs-task-generation-rules`

预期：FAIL，页面仍只有“整任务分配”和“暂不分配”。

- [ ] **步骤2：增加连续任务分配弹窗状态**

```ts
interface ContinuousDispatchDialogState {
  taskId: string
  assignmentMode: 'DIRECT' | 'BIDDING'
  factoryId: string
  factoryName: string
  businessAssignedAt: string
  biddingDeadline: string
  error: string
}
```

行操作改为“直接派单”“发起竞价”“暂不分配”。直接派单弹窗展示工厂、业务分配时间、分配数量、三个节点预览和主工厂；竞价弹窗展示竞价截止及“确认接单后启动时效”。

- [ ] **步骤3：接通运行时动作**

直接派单调用 `applyRuntimeDirectDispatchMeta`，连续任务固定使用 `scopeQty`，不出现按明细模式。发起竞价调用 `upsertRuntimeTaskTender`，但不得在创建竞价时写主工厂或履约快照。

- [ ] **步骤4：验证轻交互和页面边界**

弹窗打开/关闭、切换方式和修改时间不得丢失滚动位置；时间使用 `change` 事件；图标只水合局部容器。断言连续任务只有一个有效分配结果。

- [ ] **步骤5：运行并提交**

```bash
npm run check:fcs-task-generation-rules
npm run check:continuous-process-route-eligibility
npm run check:sewing-delivery-sla
git add src/pages/continuous-dispatch.ts src/data/fcs/runtime-process-tasks.ts scripts/check-fcs-task-generation-rules.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: dispatch continuous sewing tasks"
```

## 任务6：从接收方确认实收生成统一履约视图

**文件：**
- 创建：`src/data/fcs/sewing-delivery-sla-view.ts`
- 修改：`src/data/fcs/store-domain-progress.ts:800-1165`
- 修改：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写实收适配失败测试**

构造同一任务的一笔待确认交出和一笔已确认实收，断言只累计后者：

```ts
const view = getSewingDeliverySlaView(task.taskId, '2026-07-10 12:00:00')
assert.equal(view?.confirmedReceivedQty, 70)
assert.equal(view?.submittedQty, 100)
assert.equal(view?.projection.milestones[0]?.firstReachedAt, '2026-07-05 09:00:00')
```

运行：`npm run check:sewing-delivery-sla`

预期：FAIL，适配器不存在。

- [ ] **步骤2：实现只读适配器**

```ts
export interface SewingDeliverySlaView {
  runtimeTaskId: string
  submittedQty: number
  confirmedReceivedQty: number
  projection: SewingDeliverySlaProjection
}
export function getSewingDeliverySlaView(runtimeTaskId: string, nowAt?: string): SewingDeliverySlaView | null
export function listSewingDeliverySlaViews(nowAt?: string): SewingDeliverySlaView[]
```

实现步骤固定为：

1. `listHandoverOrdersByTaskId` 找任务交出单。
2. `listPdaHandoverRecordsByHeadId` 读取交出记录。
3. 有效 `submittedQty` 汇总为已交出。
4. 同时存在 `receiverWrittenQty` 与 `receiverWrittenAt` 才转成实收事实。
5. 作废不计、冲销扣减。
6. 调用任务1纯投影，不重复节点逻辑。

- [ ] **步骤3：挂入统一进度事实**

`ProgressFact` 增加：

```ts
sewingDeliverySla?: SewingDeliverySlaView
```

`listProgressFacts()` 只对适用任务读取履约视图。

- [ ] **步骤4：验证写回实时一致性**

测试调用现有 `writeBackHandoverRecord` 后重新读取视图，确认累计实收与节点立即变化，无需复制履约数量状态。

- [ ] **步骤5：提交**

```bash
npm run check:sewing-delivery-sla
git add src/data/fcs/sewing-delivery-sla-view.ts src/data/fcs/store-domain-progress.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: project sewing sla from receipts"
```

## 任务7：在FCS、PDA和接收确认页展示同一履约事实

**文件：**
- 修改：`src/pages/progress-board/task-domain.ts:664-1106`
- 修改：`src/pages/pda-exec-detail.ts:2690-3245`
- 修改：`src/pages/pda-handover-detail.ts:1490-1775,2240-2405`
- 修改：`src/data/fcs/sewing-delivery-sla.ts`
- 修改：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写页面失败断言**

```ts
assertIncludes(progressTaskSource, '累计已确认实收', '进度详情缺少实收履约口径')
assertIncludes(progressTaskSource, '接收方确认延迟', '进度详情缺少确认延迟异常')
assertIncludes(pdaExecSource, '下一个节点', 'PDA缺少下一履约节点')
assertIncludes(pdaExecSource, '还差', 'PDA缺少系统计算剩余量')
assertIncludes(pdaHandoverDetailSource, '确认后累计实收', '接收确认缺少节点影响预览')
```

- [ ] **步骤2：实现FCS进度展示**

列表增加紧凑“交付时效”列；详情展示分配量、累计交出、累计实收、真实比例，以及30%、70%、100%各自的目标、截止、首次达标和结果。接收延迟显示受影响记录数和入口；列表继续分页。

- [ ] **步骤3：实现PDA轻量展示**

员工端只显示分配量、已交、已实收、还差、下一节点和剩余时间，不显示快照ID、规则代码或完整责任日志。

- [ ] **步骤4：实现接收确认影响预览**

输入实收数量后，以“当前记录按输入数量在当前时间确认”构造临时事实，展示确认后的累计比例和节点影响。确认后继续调用 `writeBackHandoverRecord`，只局部刷新记录和履约摘要。

- [ ] **步骤5：实现接收延迟责任复核**

在FCS详情为“接收方确认延迟”增加主管复核入口，调用以下领域函数；复核只保存责任结论和说明，不修改交出时间、实收时间、节点结果或首次达标时间：

```ts
export interface SewingDeliveryResponsibilityReview {
  runtimeTaskId: string
  milestoneRatio: 0.3 | 0.7 | 1
  conclusion: 'FACTORY' | 'RECEIVER' | 'SHARED'
  remark: string
  reviewedBy: string
  reviewedAt: string
}
export function recordSewingDeliveryResponsibilityReview(input: {
  runtimeTaskId: string
  milestoneRatio: 0.3 | 0.7 | 1
  conclusion: 'FACTORY' | 'RECEIVER' | 'SHARED'
  remark: string
  reviewedBy: string
  reviewedAt: string
}): SewingDeliveryResponsibilityReview
```

- [ ] **步骤6：运行并提交**

```bash
npm run check:sewing-delivery-sla
npm run check:fcs-task-generation-rules
git add src/data/fcs/sewing-delivery-sla.ts src/pages/progress-board/task-domain.ts src/pages/pda-exec-detail.ts src/pages/pda-handover-detail.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: show sewing delivery progress"
```

## 任务8：实现改派后的快照保留和剩余数量重建

**文件：**
- 修改：`src/data/fcs/sewing-delivery-sla.ts`
- 修改：`src/data/fcs/runtime-process-tasks.ts`
- 修改：`src/pages/progress-exceptions/events.ts:240-260`
- 修改：`src/pages/dispatch-board/dispatch-domain.ts`
- 修改：`src/pages/continuous-dispatch.ts`
- 测试：`scripts/check-sewing-delivery-sla.ts`

- [ ] **步骤1：写改派失败测试**

```ts
const reassigned = reassignRuntimeSewingTask({
  sourceTaskId: originalTask.taskId,
  targetFactoryId: 'ID-F024', targetFactoryName: '三宝垄微型车缝厂',
  businessAssignedAt: '2026-07-08 09:00:00', operatedAt: '2026-07-08 10:00:00',
  reason: '原工厂产能异常', by: '跟单A',
})
assert.equal(reassigned.ok, true)
assert.equal(reassigned.assignedQty, originalSnapshot.assignedQty - originalProjection.confirmedReceivedQty)
assert.equal(getSewingDeliverySlaSnapshot(originalTask.taskId)?.active, false)
assert.equal(getSewingDeliverySlaSnapshot(originalTask.taskId)?.replacedByAssignmentId, reassigned.assignmentId)
assert.equal(getSewingDeliverySlaSnapshot(reassigned.taskId || '')?.acceptedAt, '2026-07-08 09:00:00')
```

- [ ] **步骤2：运行确认失败**

运行：`npm run check:sewing-delivery-sla`

预期：FAIL，改派函数不存在。

- [ ] **步骤3：实现改派函数**

```ts
export function reassignRuntimeSewingTask(input: {
  sourceTaskId: string
  targetFactoryId: string
  targetFactoryName: string
  businessAssignedAt: string
  operatedAt: string
  reason: string
  by: string
}): {
  ok: boolean
  message: string
  assignmentId?: string
  taskId?: string
  assignedQty?: number
}
```

原快照保留并失效；剩余量等于原分配量减累计有效实收量，最低为0；剩余量为0时阻断；新分配使用新ID和新接单时间。原工厂后续确认仍按原交出单任务ID进入原快照。

- [ ] **步骤4：修正异常页跳转**

```ts
const path = task?.taskUnitType === 'COMBINED_PROCESS_TASK'
  ? `/fcs/dispatch/continuous?taskId=${encodeURIComponent(taskId)}&po=${encodeURIComponent(orderId)}`
  : `/fcs/dispatch/sewing?taskId=${encodeURIComponent(taskId)}&po=${encodeURIComponent(orderId)}`
```

两个分配页读取查询参数后定位任务并打开改派弹窗。

- [ ] **步骤5：校验主工厂失效与重选**

原主工厂撤回全部有效车缝分配后：仅剩一家候选则自动切换；仍有多家则要求选择；没有候选则回到待确认状态。写入原工厂、新工厂、原因、操作人和时间。

- [ ] **步骤6：运行并提交**

```bash
npm run check:sewing-delivery-sla
npm run check:sewing-dispatch-workbench
npm run check:fcs-task-generation-rules
git add src/data/fcs/sewing-delivery-sla.ts src/data/fcs/runtime-process-tasks.ts src/pages/progress-exceptions/events.ts src/pages/dispatch-board/dispatch-domain.ts src/pages/continuous-dispatch.ts scripts/check-sewing-delivery-sla.ts
git commit -m "feat: preserve sewing sla across reassignment"
```

## 任务9：补齐Mock、治理和端到端验收

**文件：**
- 修改：`scripts/check-sewing-delivery-sla.ts`
- 修改：`scripts/check-fcs-task-generation-rules.ts`
- 创建：`docs/prototype-review-records/2026-07-10-sewing-delivery-return-sla.md`

- [ ] **步骤1：补齐Mock矩阵**

必须覆盖：

1. 独立车缝三个节点全部按时。
2. 车缝到包装30%逾期、70%追上、最终按时。
3. 裁片到包装30%按时、70%逾期、最终逾期完成。
4. 最终截止后仍未完成。
5. 到期前交出、到期后确认，形成接收方确认延迟。
6. 101件任务的30%和70%向上取整。
7. 实收超过100%并正常完成。
8. 部分实收后改派，新旧快照独立。
9. 单一车缝工厂自动主工厂，多家显式选择。

- [ ] **步骤2：运行最小完整检查集**

```bash
npm run check:sewing-delivery-sla
npm run check:sewing-dispatch-workbench
npm run check:continuous-process-route-eligibility
npm run check:fcs-task-generation-rules
npm run check:prototype-design-governance
npm run build
```

预期：全部PASS。

- [ ] **步骤3：浏览器验证FCS**

启动：

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

验证：

- `/fcs/dispatch/sewing`：独立车缝可回填过去时间，未来时间阻断，连续任务不存在。
- `/fcs/dispatch/continuous`：直接派单、发起竞价、暂不分配均可达，没有“整任务分配”。
- `/fcs/progress/board`：展示超过100%的比例、三个独立节点和接收方确认延迟。
- 直接派单立即接单；竞价定标后仍等待中标工厂确认。
- 多家车缝承接工厂时主工厂始终只有一家。

- [ ] **步骤4：浏览器验证PDA和接收确认**

- `/fcs/pda/task-receive`：含车缝中标任务确认后才启动履约。
- `/fcs/pda/exec`：只展示分配量、已交、已实收、还差、下一节点和剩余时间。
- `/fcs/pda/handover`：交出后比例不增加，确认实收后立即增加。
- 弹窗展示确认后的比例和节点影响。
- 轻交互无整页闪烁、滚动位置不丢失，按钮响应低于200ms。

- [ ] **步骤5：填写治理记录**

记录角色边界、数量自动计算、交出/接收责任分离、主工厂防错、未来时间阻断、改派和确认延迟兜底；无例外时明确写“无”。

- [ ] **步骤6：同步索引并提交验收**

```bash
codegraph sync
codegraph status
git diff --check
npm run check:prototype-design-governance
git add scripts/check-sewing-delivery-sla.ts scripts/check-fcs-task-generation-rules.ts docs/prototype-review-records/2026-07-10-sewing-delivery-return-sla.md
git commit -m "test: cover sewing delivery sla flow"
```

## 规格覆盖自检

| 规格要求 | 对应任务 |
| --- | --- |
| 三类9/10/12天规则、满24小时滚动 | 任务1 |
| 直接派单自动接单并使用回填时间 | 任务2 |
| 竞价在工厂确认后起算 | 任务3 |
| 唯一主工厂和页面分流 | 任务4、任务5 |
| 连续任务真实直接派单/竞价 | 任务5 |
| 接收方确认实收才累计 | 任务6 |
| 超过100%正常完成并真实展示 | 任务1、任务7 |
| FCS、PDA、接收页一致 | 任务6、任务7 |
| 改派保留旧快照并重建剩余量 | 任务8 |
| 接收方确认延迟 | 任务1、任务6、任务7 |
| Mock、治理、构建和浏览器验收 | 任务9 |

## 完成标准

- 全部规则、分配、实收、超量、改派和主工厂检查通过。
- 修复车缝工作台已知回归，不通过删除断言绕过。
- 工厂交出不提前增加比例，接收方确认后才增加。
- 列表保持分页，输入不触发整页重绘，关键按钮低于200ms。
- FCS、PDA和交接页面浏览器验证通过。
- `check:prototype-design-governance`、`npm run build` 通过。
- CodeGraph同步且最新，审查记录说明规范覆盖和例外结论。
