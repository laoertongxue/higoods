# 三方工厂评级可执行规则实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把“三方工厂评级”中的派单策略、首单上限、黄牌、主管指定和结算策略从文本说明升级为派单与结算域函数真正执行的规则。

**架构：** 在 `src/data/fcs/third-party-factory-rating.ts` 中沉淀结构化策略字段和统一评估函数；车缝分配页面、车缝分配域函数、对账单页面、对账单域函数都只消费评估结果。专项脚本覆盖页面可见性和绕过页面直接调用域函数的反例。

**技术栈：** Vite、TypeScript、Vanilla TS 字符串模板、现有 `scripts/check-third-party-factory-rating.ts`、现有原型治理脚本。

---

## 文件结构

- 修改：`src/data/fcs/third-party-factory-rating.ts`
  - 新增结构化策略类型。
  - 给 11 个评级快照补充可执行策略字段。
  - 新增 `evaluateThirdPartyFactoryDispatchPolicy()`、`evaluateThirdPartyFactorySettlementPolicy()`。
  - 保留 `isThirdPartyFactorySettlementBlocked()`，但改为调用结算评估函数。
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts`
  - 车缝分配域函数调用派单评估函数。
  - 汇总每个工厂本次派单数量。
  - 从生产单 `demandSnapshot.saleType` 派生 `试产单/常规单`，从 `demandSnapshot.priority` 派生急单。
  - 扩展 `createSewingDispatchWorkbenchDraft()` 输入，接收风险确认和主管指定上下文。
- 修改：`src/pages/sewing-dispatch-workbench.ts`
  - 工厂候选、直接派单弹窗、竞价弹窗读取评估结果。
  - 对考核中、黄牌、主管指定、黑名单展示真实规则结果。
  - 确认派单时把风险确认上下文传入域函数。
- 修改：`src/data/fcs/store-domain-settlement-seeds.ts`
  - 对账单创建/保存域函数调用结算评估函数，不再直接读布尔字段。
- 修改：`src/pages/statements.ts`
  - 对账单新建页使用结算评估结果控制阻断提示和按钮状态。
- 修改：`src/pages/third-party-factory-rating.ts`
  - 策略展示从结构化规则派生，避免自由文本与规则分叉。
- 修改：`scripts/check-third-party-factory-rating.ts`
  - 新增派单策略和结算策略对抗式断言。
  - 检查页面代码调用统一评估函数，而不是只展示 `dispatchPolicyLabel`。
- 修改：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`
  - 补充可执行规则落地、自查结论和剩余例外。

## 任务 1：建立结构化策略与评估器

**文件：**
- 修改：`src/data/fcs/third-party-factory-rating.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 的评级快照基础断言后加入：

```ts
const trialSnapshot = snapshots.find((item) => item.cooperationStatusLabel === '考核中')
assert.ok(trialSnapshot, '缺少考核中工厂样例')
assert.equal(trialSnapshot.dispatchControl, 'TRIAL_ONLY', '考核中工厂必须使用试产单派单规则')
assert.deepEqual(trialSnapshot.allowedDocumentTypes, ['试产单'], '考核中工厂只允许试产单')
assert.equal(trialSnapshot.canJoinBidding, true, '考核中工厂在试产额度内可以参与候选')

const trialAllowedDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: trialSnapshot.firstTrialLimitQty ?? 300,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(trialAllowedDecision.allowed, true, '考核中工厂在试产额度内必须允许派单')
assert.equal(trialAllowedDecision.severity, 'ALLOW', '试产额度内不能显示阻断')

const trialRegularDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '常规单',
  dispatchQty: 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(trialRegularDecision.allowed, false, '考核中工厂不能接常规单')
assert.ok(trialRegularDecision.reason.includes('只能接试产单'), '常规单阻断原因必须明确')

const trialOverLimitDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: trialSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: (trialSnapshot.firstTrialLimitQty ?? 300) + 1,
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(trialOverLimitDecision.allowed, false, '考核中工厂超出首单上限必须阻断')
assert.ok(trialOverLimitDecision.reason.includes('超过首单上限'), '超量阻断原因必须明确')
```

同时把 import 改为：

```ts
import {
  evaluateThirdPartyFactoryDispatchPolicy,
  evaluateThirdPartyFactorySettlementPolicy,
  getThirdPartyFactoryRatingSnapshot,
  isThirdPartyFactorySettlementBlocked,
  listThirdPartyFactoryPerformanceRecords,
  listThirdPartyFactoryRatingSnapshots,
} from '../src/data/fcs/third-party-factory-rating.ts'
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，错误包含 `evaluateThirdPartyFactoryDispatchPolicy` 未导出或 `dispatchControl` 不存在。

- [ ] **步骤 3：新增策略类型和快照字段**

在 `src/data/fcs/third-party-factory-rating.ts` 顶部增加：

```ts
export type DispatchControl =
  | 'PRIORITY'
  | 'ALLOW'
  | 'WARN_CONFIRM'
  | 'TRIAL_ONLY'
  | 'SUPERVISOR_DIRECT_ONLY'
  | 'BLOCKED'

export type SettlementControl = 'ALLOW' | 'BLOCK_NEW_STATEMENT'
export type FactoryRatingDocumentTypeLabel = '试产单' | '常规单'

export interface DispatchPolicyInput {
  factoryId: string
  actionType: '直接派单' | '发起竞价'
  documentTypeLabel: FactoryRatingDocumentTypeLabel
  dispatchQty: number
  isUrgentOrder: boolean
  riskConfirmed: boolean
  isSupervisorAssigned: boolean
}

export interface DispatchPolicyDecision {
  allowed: boolean
  severity: 'ALLOW' | 'WARN' | 'BLOCK'
  reason: string
  displayBadges: string[]
  requiresConfirm: boolean
  sortPriority: number
}

export interface SettlementPolicyDecision {
  allowedToCreateNewStatement: boolean
  historyReadable: boolean
  reason: string
}
```

扩展 `FactoryRatingSnapshot`：

```ts
  dispatchControl: DispatchControl
  settlementControl: SettlementControl
  allowedDocumentTypes: FactoryRatingDocumentTypeLabel[]
  canJoinBidding: boolean
  requiresDispatchRiskConfirm: boolean
  smallOrderLimitQty?: number
```

给每个快照补字段：

```ts
dispatchControl: 'PRIORITY',
settlementControl: 'ALLOW',
allowedDocumentTypes: ['试产单', '常规单'],
canJoinBidding: true,
requiresDispatchRiskConfirm: false,
```

具体映射：

- S 级正常合作：`PRIORITY`，`ALLOW`，可竞价，不需要确认。
- A 级正常合作：`ALLOW`，`ALLOW`，可竞价，不需要确认。
- 黑名单/暂停合作：`BLOCKED`，`BLOCK_NEW_STATEMENT`，不可竞价，不需要确认。
- 考核中：`TRIAL_ONLY`，`ALLOW`，可竞价，不需要确认，只允许 `['试产单']`。
- `KOL-GOTO-001` 主管指定：`SUPERVISOR_DIRECT_ONLY`，`ALLOW`，不可竞价，需要主管指定确认。
- B 级黄牌：`WARN_CONFIRM`，`ALLOW`，可竞价，需要确认，`smallOrderLimitQty: 300`。

- [ ] **步骤 4：实现评估函数**

在 `src/data/fcs/third-party-factory-rating.ts` 底部加入：

```ts
function allowDecision(reason: string, displayBadges: string[], sortPriority: number): DispatchPolicyDecision {
  return { allowed: true, severity: 'ALLOW', reason, displayBadges, requiresConfirm: false, sortPriority }
}

function blockDecision(reason: string, displayBadges: string[], sortPriority = 0): DispatchPolicyDecision {
  return { allowed: false, severity: 'BLOCK', reason, displayBadges, requiresConfirm: false, sortPriority }
}

function warnDecision(reason: string, displayBadges: string[], requiresConfirm: boolean, sortPriority: number): DispatchPolicyDecision {
  return { allowed: !requiresConfirm, severity: 'WARN', reason, displayBadges, requiresConfirm, sortPriority }
}

export function evaluateThirdPartyFactoryDispatchPolicy(input: DispatchPolicyInput): DispatchPolicyDecision {
  const snapshot = getThirdPartyFactoryRatingSnapshot(input.factoryId)
  if (!snapshot) return warnDecision('未评级，需人工确认。', ['未评级'], !input.riskConfirmed, 10)
  const badges = [`${snapshot.currentGrade}级`]
  if (snapshot.dispatchControl === 'BLOCKED') return blockDecision(snapshot.dispatchPolicyLabel, [...badges, '禁止派单'])
  if (snapshot.dispatchControl === 'TRIAL_ONLY') {
    const limit = snapshot.firstTrialLimitQty ?? 300
    if (!snapshot.allowedDocumentTypes.includes(input.documentTypeLabel)) {
      return blockDecision('考核中工厂只能接试产单。', [...badges, '只接试产单'])
    }
    if (input.dispatchQty > limit) {
      return blockDecision(`本次派单 ${input.dispatchQty} 件，超过首单上限 ${limit} 件。`, [...badges, `上限 ${limit} 件`])
    }
    return allowDecision(`试产单额度内，可派单。`, [...badges, `试产上限 ${limit} 件`], 70)
  }
  if (snapshot.dispatchControl === 'SUPERVISOR_DIRECT_ONLY') {
    if (input.actionType === '发起竞价') return blockDecision('该工厂只能主管指定派单，不参与竞价。', [...badges, '不参与竞价'])
    if (!input.isSupervisorAssigned) return warnDecision('该工厂需要主管指定后派单。', [...badges, '主管指定'], true, 50)
    return allowDecision('主管指定派单已确认。', [...badges, '主管指定'], 50)
  }
  if (snapshot.dispatchControl === 'WARN_CONFIRM') {
    const limit = snapshot.smallOrderLimitQty ?? snapshot.firstTrialLimitQty ?? 300
    const needsConfirm = input.isUrgentOrder || input.dispatchQty > limit
    if (needsConfirm && !input.riskConfirmed) {
      return warnDecision(`黄牌工厂建议只派小单和非急单；本次派单需确认风险。`, [...badges, '黄牌确认'], true, 40)
    }
    return allowDecision('黄牌风险已确认，可派单。', [...badges, '黄牌'], 40)
  }
  if (snapshot.dispatchControl === 'PRIORITY') return allowDecision(snapshot.dispatchPolicyLabel, [...badges, '推荐'], 100)
  return allowDecision(snapshot.dispatchPolicyLabel, badges, 60)
}

export function evaluateThirdPartyFactorySettlementPolicy(factoryIdOrCode: string): SettlementPolicyDecision {
  const snapshot = getThirdPartyFactoryRatingSnapshot(factoryIdOrCode)
  if (!snapshot) return { allowedToCreateNewStatement: true, historyReadable: true, reason: '未评级，按原结算规则处理。' }
  if (snapshot.settlementControl === 'BLOCK_NEW_STATEMENT') {
    return { allowedToCreateNewStatement: false, historyReadable: true, reason: '该工厂已拉黑或暂停合作，不能发起新结算。历史账本仍可查看。' }
  }
  return { allowedToCreateNewStatement: true, historyReadable: true, reason: snapshot.settlementPolicyLabel }
}
```

把 `isThirdPartyFactorySettlementBlocked()` 改为：

```ts
export function isThirdPartyFactorySettlementBlocked(factoryIdOrCode: string): boolean {
  return !evaluateThirdPartyFactorySettlementPolicy(factoryIdOrCode).allowedToCreateNewStatement
}
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：通过。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: add executable third-party rating policies"
```

## 任务 2：派单域函数执行真实规则

**文件：**
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 中 blocked 循环之前加入：

```ts
const trialDispatchSnapshot = snapshots.find((item) => item.dispatchControl === 'TRIAL_ONLY')
assert.ok(trialDispatchSnapshot, '缺少试产规则工厂')
const bGradeDispatchSnapshot = snapshots.find((item) => item.dispatchControl === 'WARN_CONFIRM')
assert.ok(bGradeDispatchSnapshot, '缺少黄牌确认工厂')
const supervisorDispatchSnapshot = snapshots.find((item) => item.dispatchControl === 'SUPERVISOR_DIRECT_ONLY')
assert.ok(supervisorDispatchSnapshot, '缺少主管指定工厂')

const trialAllowedResult = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: trialDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '试产单', dispatchQty: Math.min(firstDispatchRow.remainingQty, trialDispatchSnapshot.firstTrialLimitQty ?? 300), isUrgentOrder: false } },
  by: '对抗式核查',
})
assert.equal(trialAllowedResult.ok, true, '考核中工厂试产单额度内必须允许派单')

const trialRegularResult = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: trialDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 1, isUrgentOrder: false } },
  by: '对抗式核查',
})
assert.equal(trialRegularResult.ok, false, '考核中工厂常规单必须阻断')

const bGradeWithoutConfirm = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: bGradeDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 301, isUrgentOrder: true } },
  by: '对抗式核查',
})
assert.equal(bGradeWithoutConfirm.ok, false, 'B 级黄牌未确认风险必须阻断')

const bGradeConfirmed = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [firstDispatchRow.rowId],
  factoryIdByRowId: { [firstDispatchRow.rowId]: bGradeDispatchSnapshot.factoryId },
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: 301, isUrgentOrder: true } },
  policyContextByFactoryId: { [bGradeDispatchSnapshot.factoryId]: { riskConfirmed: true } },
  by: '对抗式核查',
})
assert.equal(bGradeConfirmed.ok, true, 'B 级黄牌确认风险后必须允许派单')

const supervisorBidding = createSewingDispatchWorkbenchDraft({
  actionType: '发起竞价',
  rowIds: [firstDispatchRow.rowId],
  policyOverrideByRowId: { [firstDispatchRow.rowId]: { documentTypeLabel: '常规单', dispatchQty: firstDispatchRow.remainingQty, isUrgentOrder: false } },
  biddingFactoryIds: [supervisorDispatchSnapshot.factoryId],
  by: '对抗式核查',
})
assert.equal(supervisorBidding.ok, false, '主管指定工厂不能参与竞价')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，错误包含 `policyOverrideByRowId` 或 `policyContextByFactoryId` 不存在，或考核中工厂仍被阻断。

- [ ] **步骤 3：扩展域函数输入类型**

在 `src/data/fcs/sewing-dispatch-workbench.ts` import 中加入：

```ts
  evaluateThirdPartyFactoryDispatchPolicy,
  type FactoryRatingDocumentTypeLabel,
```

把 `createSewingDispatchWorkbenchDraft()` 输入扩展为：

```ts
  biddingFactoryIds?: string[]
  policyContextByFactoryId?: Record<string, {
    riskConfirmed?: boolean
    supervisorAssigned?: boolean
  }>
  policyOverrideByRowId?: Record<string, {
    documentTypeLabel?: FactoryRatingDocumentTypeLabel
    dispatchQty?: number
    isUrgentOrder?: boolean
  }>
```

- [ ] **步骤 4：新增派单上下文派生 helper**

在 `createSewingDispatchWorkbenchDraft()` 前加入：

```ts
function deriveDispatchDocumentType(order: ProductionOrder): FactoryRatingDocumentTypeLabel {
  const text = order.demandSnapshot.saleType
  return text.includes('样衣') || text.includes('样品') || text.includes('小单') ? '试产单' : '常规单'
}

function isUrgentProductionOrder(order: ProductionOrder): boolean {
  return order.demandSnapshot.priority === 'URGENT'
}

function getPolicyInputForRow(
  row: SewingDispatchWorkbenchRow,
  actionType: '直接派单' | '发起竞价',
  factoryId: string,
  input: {
    policyContextByFactoryId?: Record<string, { riskConfirmed?: boolean; supervisorAssigned?: boolean }>
    policyOverrideByRowId?: Record<string, { documentTypeLabel?: FactoryRatingDocumentTypeLabel; dispatchQty?: number; isUrgentOrder?: boolean }>
  },
) {
  const order = productionOrders.find((item) => item.productionOrderId === row.productionOrderId)
  if (!order) throw new Error(`生产单 ${row.productionOrderNo} 不存在`)
  const override = input.policyOverrideByRowId?.[row.rowId]
  const context = input.policyContextByFactoryId?.[factoryId]
  return {
    factoryId,
    actionType,
    documentTypeLabel: override?.documentTypeLabel ?? deriveDispatchDocumentType(order),
    dispatchQty: override?.dispatchQty ?? row.remainingQty,
    isUrgentOrder: override?.isUrgentOrder ?? isUrgentProductionOrder(order),
    riskConfirmed: context?.riskConfirmed === true,
    isSupervisorAssigned: context?.supervisorAssigned === true,
  }
}
```

- [ ] **步骤 5：替换硬编码拦截**

在 `createSewingDispatchWorkbenchDraft()` 中删除：

```ts
  for (const factory of new Map([...factoryByRowId.values()].map((item) => [item.id, item])).values()) {
    const rating = getThirdPartyFactoryRatingSnapshot(factory.id)
    if (rating?.cooperationStatusLabel === '黑名单') return { ok: false, message: '该工厂已拉黑，不能派单。请更换工厂。' }
    if (rating?.cooperationStatusLabel === '考核中') return { ok: false, message: '该工厂还在试用期，只能接试产单。' }
  }
```

替换为：

```ts
  if (input.actionType === '直接派单') {
    for (const [rowId, factory] of factoryByRowId.entries()) {
      const row = rows.find((item) => item.rowId === rowId)
      if (!row) continue
      const decision = evaluateThirdPartyFactoryDispatchPolicy(getPolicyInputForRow(row, input.actionType, factory.id, input))
      if (!decision.allowed) return { ok: false, message: decision.reason }
    }
  } else {
    const biddingFactoryIds = input.biddingFactoryIds ?? listSewingFactoryOptions().map((factory) => factory.id)
    for (const factoryId of biddingFactoryIds) {
      for (const row of rows) {
        const decision = evaluateThirdPartyFactoryDispatchPolicy(getPolicyInputForRow(row, input.actionType, factoryId, input))
        if (!decision.allowed && decision.reason.includes('不参与竞价')) return { ok: false, message: decision.reason }
      }
    }
  }
```

- [ ] **步骤 6：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：通过。

- [ ] **步骤 7：Commit**

```bash
git add src/data/fcs/sewing-dispatch-workbench.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: enforce rating policies in sewing dispatch"
```

## 任务 3：车缝分配页面展示和传递评估结果

**文件：**
- 修改：`src/pages/sewing-dispatch-workbench.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 的车缝分配页面源码断言处加入：

```ts
assert.ok(sewingDispatchSource.includes('evaluateThirdPartyFactoryDispatchPolicy'), '车缝分配页面必须使用统一派单规则评估')
assert.ok(sewingDispatchSource.includes('dispatchRiskConfirmedByFactoryId'), '车缝分配页面必须记录黄牌风险确认')
assert.ok(sewingDispatchSource.includes('dispatchSupervisorAssignedByFactoryId'), '车缝分配页面必须记录主管指定确认')
assert.ok(sewingDispatchSource.includes('data-sewing-dispatch-field=\"dispatchRiskConfirmed\"'), '直接派单弹窗必须提供黄牌风险确认入口')
assert.ok(sewingDispatchSource.includes('data-sewing-dispatch-field=\"dispatchSupervisorAssigned\"'), '直接派单弹窗必须提供主管指定确认入口')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，提示页面未使用统一评估函数或缺少确认字段。

- [ ] **步骤 3：扩展页面状态**

在 `SewingDispatchWorkbenchState` 增加：

```ts
  dispatchRiskConfirmedByFactoryId: Record<string, boolean>
  dispatchSupervisorAssignedByFactoryId: Record<string, boolean>
```

在 `state` 初始值增加：

```ts
  dispatchRiskConfirmedByFactoryId: {},
  dispatchSupervisorAssignedByFactoryId: {},
```

在 `openDispatchDialog()` 或打开派单弹窗的初始化逻辑中重置：

```ts
  state.dispatchRiskConfirmedByFactoryId = {}
  state.dispatchSupervisorAssignedByFactoryId = {}
```

- [ ] **步骤 4：新增页面评估 helper**

在 `src/pages/sewing-dispatch-workbench.ts` 中 import：

```ts
  evaluateThirdPartyFactoryDispatchPolicy,
  type FactoryRatingDocumentTypeLabel,
```

新增：

```ts
function derivePageDispatchDocumentType(row: SewingDispatchWorkbenchRow): FactoryRatingDocumentTypeLabel {
  const order = productionOrders.find((item) => item.productionOrderId === row.productionOrderId)
  const saleType = order?.demandSnapshot.saleType ?? ''
  return saleType.includes('样衣') || saleType.includes('样品') || saleType.includes('小单') ? '试产单' : '常规单'
}

function isPageDispatchUrgent(row: SewingDispatchWorkbenchRow): boolean {
  return productionOrders.find((item) => item.productionOrderId === row.productionOrderId)?.demandSnapshot.priority === 'URGENT'
}

function getPageDispatchPolicyDecision(row: SewingDispatchWorkbenchRow, factoryId: string) {
  return evaluateThirdPartyFactoryDispatchPolicy({
    factoryId,
    actionType: state.dispatchActionType,
    documentTypeLabel: derivePageDispatchDocumentType(row),
    dispatchQty: row.remainingQty,
    isUrgentOrder: isPageDispatchUrgent(row),
    riskConfirmed: state.dispatchRiskConfirmedByFactoryId[factoryId] === true,
    isSupervisorAssigned: state.dispatchSupervisorAssignedByFactoryId[factoryId] === true,
  })
}
```

- [ ] **步骤 5：让工厂选项按规则展示**

把 `renderDispatchFactoryOption()` 改为接收当前行：

```ts
function renderDispatchFactoryOption(factory: { id: string; name: string }, row?: SewingDispatchWorkbenchRow, selectedFactoryId = ''): string {
  const rating = getThirdPartyFactoryRatingSnapshot(factory.id)
  const decision = row ? getPageDispatchPolicyDecision(row, factory.id) : null
  const disabled = decision?.severity === 'BLOCK'
  const badges = decision?.displayBadges?.join(' · ') || (rating ? `${rating.currentGrade}级` : '')
  return `<option value="${escapeHtml(factory.id)}" ${selectedFactoryId === factory.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(`${factory.name}${badges ? ` · ${badges}` : ''}`)}</option>`
}
```

在 `renderDirectDispatchFactoryRows()` 中改为：

```ts
${factories.map((factory) => renderDispatchFactoryOption(factory, row, selectedFactoryId)).join('')}
```

批量选择下拉没有单行上下文，继续调用：

```ts
${factories.map((factory) => renderDispatchFactoryOption(factory, undefined, state.dispatchBatchFactoryId)).join('')}
```

- [ ] **步骤 6：渲染策略结果和确认项**

新增：

```ts
function renderDispatchPolicyFeedback(row: SewingDispatchWorkbenchRow, factoryId: string): string {
  if (!factoryId) return ''
  const decision = getPageDispatchPolicyDecision(row, factoryId)
  const tone = decision.severity === 'BLOCK'
    ? 'border-red-200 bg-red-50 text-red-700'
    : decision.severity === 'WARN'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  const riskConfirm = decision.requiresConfirm && decision.reason.includes('黄牌')
    ? `<label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" ${state.dispatchRiskConfirmedByFactoryId[factoryId] ? 'checked' : ''} data-sewing-dispatch-field="dispatchRiskConfirmed" data-factory-id="${escapeHtml(factoryId)}" data-skip-page-rerender="true" />已确认黄牌风险</label>`
    : ''
  const supervisorConfirm = decision.requiresConfirm && decision.reason.includes('主管指定')
    ? `<label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" ${state.dispatchSupervisorAssignedByFactoryId[factoryId] ? 'checked' : ''} data-sewing-dispatch-field="dispatchSupervisorAssigned" data-factory-id="${escapeHtml(factoryId)}" data-skip-page-rerender="true" />主管指定派单</label>`
    : ''
  return `<div class="mt-1 rounded-md border px-2 py-1 text-xs ${tone}">${escapeHtml(decision.reason)}${riskConfirm}${supervisorConfirm}</div>`
}
```

在 `renderDirectDispatchFactoryRows()` 工厂选择单元格中替换旧 `renderDispatchFactoryRisk(selectedFactoryId)`：

```ts
${renderDispatchPolicyFeedback(row, selectedFactoryId)}
```

- [ ] **步骤 7：处理确认字段变更**

在 `handleSewingDispatchFieldChange()` 的字段分支中加入：

```ts
  if (field === 'dispatchRiskConfirmed' && node instanceof HTMLInputElement) {
    const factoryId = node.dataset.factoryId
    if (factoryId) state.dispatchRiskConfirmedByFactoryId[factoryId] = node.checked
    refreshSewingDispatchFactoryRows()
    return true
  }
  if (field === 'dispatchSupervisorAssigned' && node instanceof HTMLInputElement) {
    const factoryId = node.dataset.factoryId
    if (factoryId) state.dispatchSupervisorAssignedByFactoryId[factoryId] = node.checked
    refreshSewingDispatchFactoryRows()
    return true
  }
```

- [ ] **步骤 8：提交时传递上下文**

在 `createSewingDispatchWorkbenchDraft()` 调用中加入：

```ts
        policyContextByFactoryId: Object.fromEntries(
          [...new Set(selectedRows.map((row) => state.dispatchFactoryIdByRowId[row.rowId]).filter(Boolean))]
            .map((factoryId) => [factoryId, {
              riskConfirmed: state.dispatchRiskConfirmedByFactoryId[factoryId] === true,
              supervisorAssigned: state.dispatchSupervisorAssignedByFactoryId[factoryId] === true,
            }]),
        ),
```

- [ ] **步骤 9：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:sewing-dispatch-workbench
```

预期：两个命令通过。

- [ ] **步骤 10：Commit**

```bash
git add src/pages/sewing-dispatch-workbench.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: surface rating policy decisions in dispatch"
```

## 任务 4：结算统一使用可执行规则

**文件：**
- 修改：`src/data/fcs/store-domain-settlement-seeds.ts`
- 修改：`src/pages/statements.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 结算源码断言处加入：

```ts
assert.ok(statementsSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单页面必须使用统一结算规则评估')

const settlementSeedSource = readRequiredSource(
  new URL('../src/data/fcs/store-domain-settlement-seeds.ts', import.meta.url),
  '缺少对账单域数据文件',
)
assert.ok(settlementSeedSource.includes('evaluateThirdPartyFactorySettlementPolicy'), '对账单域函数必须使用统一结算规则评估')

const blockedSettlementDecision = evaluateThirdPartyFactorySettlementPolicy(blacklisted.factoryId)
assert.equal(blockedSettlementDecision.allowedToCreateNewStatement, false, '黑名单工厂必须阻断新结算')
assert.equal(blockedSettlementDecision.historyReadable, true, '黑名单历史账本必须可查看')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，提示页面或域函数未使用统一结算评估。

- [ ] **步骤 3：域函数改用评估结果**

在 `src/data/fcs/store-domain-settlement-seeds.ts` import 中加入：

```ts
import { evaluateThirdPartyFactorySettlementPolicy } from './third-party-factory-rating.ts'
```

把 `createStatementFromEligibleLedgers()` 中：

```ts
  if (isThirdPartyFactorySettlementBlocked(input.settlementPartyId)) {
    return { ok: false, message: '该工厂已拉黑，不能发起结算。请主管处理历史账款。' }
  }
```

替换为：

```ts
  const settlementPolicy = evaluateThirdPartyFactorySettlementPolicy(input.settlementPartyId)
  if (!settlementPolicy.allowedToCreateNewStatement) {
    return { ok: false, message: settlementPolicy.reason }
  }
```

在 `syncStatementDraftFromBuild()` 中找到相同的黑名单判断，替换为同样逻辑。

- [ ] **步骤 4：页面改用评估结果**

在 `src/pages/statements.ts` import 中加入：

```ts
import { evaluateThirdPartyFactorySettlementPolicy } from '../data/fcs/third-party-factory-rating'
```

把：

```ts
  const blacklistSettlementBlocked = isThirdPartyFactorySettlementBlocked(state.buildFactoryId)
```

替换为：

```ts
  const settlementPolicy = evaluateThirdPartyFactorySettlementPolicy(state.buildFactoryId)
  const blacklistSettlementBlocked = !settlementPolicy.allowedToCreateNewStatement
```

把红色提示替换为：

```ts
${blacklistSettlementBlocked ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(settlementPolicy.reason)}</div>` : ''}
```

把 `generate` 和 `save-build` 分支中的 `isThirdPartyFactorySettlementBlocked()` 判断改为：

```ts
    const settlementPolicy = evaluateThirdPartyFactorySettlementPolicy(state.buildFactoryId)
    if (!settlementPolicy.allowedToCreateNewStatement) {
      showStatementsToast(settlementPolicy.reason, 'error')
      return true
    }
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:statements
```

预期：两个命令通过。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/store-domain-settlement-seeds.ts src/pages/statements.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: enforce rating policies in settlement"
```

## 任务 5：评级页展示由结构化规则派生

**文件：**
- 修改：`src/data/fcs/third-party-factory-rating.ts`
- 修改：`src/pages/third-party-factory-rating.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 评级页源码断言处加入：

```ts
assert.ok(source.includes('getThirdPartyFactoryDispatchPolicyLabel'), '评级数据必须提供结构化派单策略文案生成函数')
assert.ok(source.includes('getThirdPartyFactorySettlementPolicyLabel'), '评级数据必须提供结构化结算策略文案生成函数')
assert.ok(ratingPageSource.includes('getThirdPartyFactoryDispatchPolicyLabel'), '评级页派单策略必须由结构化规则派生')
assert.ok(ratingPageSource.includes('getThirdPartyFactorySettlementPolicyLabel'), '评级页结算策略必须由结构化规则派生')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，提示缺少策略文案生成函数。

- [ ] **步骤 3：新增文案生成函数**

在 `src/data/fcs/third-party-factory-rating.ts` 底部加入：

```ts
export function getThirdPartyFactoryDispatchPolicyLabel(snapshot: FactoryRatingSnapshot): string {
  if (snapshot.dispatchControl === 'BLOCKED') return '禁止派单，不允许在车缝分配中选择。'
  if (snapshot.dispatchControl === 'TRIAL_ONLY') return `仅允许试产单，首单最多 ${snapshot.firstTrialLimitQty ?? 300} 件，完成交出后再判断转正。`
  if (snapshot.dispatchControl === 'SUPERVISOR_DIRECT_ONLY') return '可主管指定派单，不参与竞价。'
  if (snapshot.dispatchControl === 'WARN_CONFIRM') return '黄牌提示：可选，但建议只派小单和非急单。'
  if (snapshot.dispatchControl === 'PRIORITY') return '优先派单，可承接大货和赶单。'
  return '正常可选，适合常规单。'
}

export function getThirdPartyFactorySettlementPolicyLabel(snapshot: FactoryRatingSnapshot): string {
  if (snapshot.settlementControl === 'BLOCK_NEW_STATEMENT') return '禁止发起新结算，历史账本仅保留查看。'
  if (snapshot.dispatchControl === 'TRIAL_ONLY') return '不做黑名单结算拦截。'
  return '可按账本发起结算。'
}
```

- [ ] **步骤 4：评级页改用生成函数**

在 `src/pages/third-party-factory-rating.ts` import 中加入：

```ts
  getThirdPartyFactoryDispatchPolicyLabel,
  getThirdPartyFactorySettlementPolicyLabel,
```

把所有展示 `row.dispatchPolicyLabel` 的位置替换为：

```ts
getThirdPartyFactoryDispatchPolicyLabel(row)
```

把所有展示 `row.settlementPolicyLabel` 的位置替换为：

```ts
getThirdPartyFactorySettlementPolicyLabel(row)
```

保留原字段用于兼容数据阅读，但页面不再直接消费自由文本。

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:list-page-governance
```

预期：两个命令通过。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/third-party-factory-rating.ts src/pages/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts
git commit -m "fix: derive rating policy labels from rules"
```

## 任务 6：原型审查记录与完整验证

**文件：**
- 修改：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`

- [ ] **步骤 1：更新审查记录**

在自查结论中加入：

```md
- 可执行规则落地：派单策略和结算策略已从自由文本升级为结构化规则；车缝分配页面、派单域函数、对账单页面和对账单域函数共用统一评估函数。
- 考核中口径明确：考核中工厂允许试产单额度内派单，常规单和超过首单上限会阻断。
- 黄牌和主管指定可达：B 级黄牌需要风险确认；主管指定工厂不参与竞价，只允许直接派单确认。
- 对抗式补充：专项检查覆盖试产额度放行、常规单阻断、超量阻断、黄牌未确认阻断、黄牌确认放行、主管指定竞价阻断和黑名单结算阻断。
```

- [ ] **步骤 2：运行完整验证**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:prototype-design-governance
npm run check:list-page-governance
npm run build
```

预期：全部 exit 0。

- [ ] **步骤 3：浏览器验收**

保持本地服务运行，访问：

```text
http://localhost:5174/fcs/factories/third-party-rating
http://localhost:5174/fcs/dispatch/sewing
http://localhost:5174/fcs/settlement/statements
```

用 Playwright 或浏览器确认：

- 评级页策略展示仍正常。
- 车缝分配页直接派单弹窗能看到策略结果。
- 黄牌工厂出现风险确认。
- 黑名单/暂停合作工厂不可派单。
- 对账单新建页黑名单/暂停合作工厂显示新结算阻断。

- [ ] **步骤 4：CodeGraph 同步**

运行：

```bash
codegraph sync && codegraph status
```

预期：命令 exit 0。当前 worktree 可能继续提示索引归属主工作树；最终说明中如实报告。

- [ ] **步骤 5：Commit**

```bash
git add docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md
git commit -m "docs: review executable rating rules"
```

## 自检

- 规格覆盖：本计划覆盖结构化策略、考核中放行、黑名单阻断、B 级黄牌、主管指定、S/A 候选、结算新建阻断、历史查看、页面展示和对抗式验证。
- 类型一致：计划中使用的 `DispatchControl`、`SettlementControl`、`FactoryRatingDocumentTypeLabel`、`DispatchPolicyInput`、`DispatchPolicyDecision`、`SettlementPolicyDecision` 均在任务 1 定义。
- 范围控制：不引入后端、真实审批、权限系统、通用规则引擎或 API 层。
- 验证路径：每个代码任务都有先失败后通过的 `npm run check:third-party-factory-rating`，最后有原型治理、列表页治理和构建验证。
