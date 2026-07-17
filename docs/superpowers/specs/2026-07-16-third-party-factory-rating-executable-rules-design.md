# 三方工厂评级可执行规则产品设计

## 1. 背景与目标

当前“三方工厂评级”页面已经集中展示派单策略、结算策略、首单上限和评级原因，但部分策略仍停留在文案层。车缝分配和对账单生成只落了黑名单/暂停合作的硬拦截，尚未把“试产单”“首单上限”“黄牌确认”“主管指定”“优先派单”等策略作为真实规则执行。

本设计目标是把评级策略从自由文本升级为可执行规则，让同一套规则同时作用于：

- 三方工厂评级页的策略展示。
- 车缝分配工作台的工厂候选、直接派单、发起竞价和域函数创建草稿。
- 对账单页面的新建/保存动作和域函数创建对账单。
- 专项对抗式检查脚本，防止只做页面按钮拦截。

## 2. 设计原则

- 文案不作为规则来源。页面文案必须由结构化策略生成。
- 页面和域函数共用同一套评估结果。任何页面层提示都不能替代域层拦截。
- 规则以业务对象为输入，而不是只看工厂状态。派单必须同时看工厂、单据类型、派单数量、派单方式和是否已确认风险。
- 结算只处理结算边界。派单黄牌、试产上限不影响历史账本查看；黑名单/暂停合作只阻断新发起结算。
- 保持原型实现轻量。不引入通用规则引擎、后端 API 或复杂配置系统。

## 3. 核心口径

### 3.1 考核中工厂

`考核中` 不等于禁止派单。正确规则为：

- 允许派单条件：单据类型为 `试产单`，且本次派给该工厂的总数量不超过该工厂 `firstTrialLimitQty`。
- 默认首单上限：小型工厂 300 件，大型工厂 1000 件，具体以评级快照中的 `firstTrialLimitQty` 为准。
- 不满足条件时阻断派单，并给出明确原因。
- 结算侧不因 `考核中` 做黑名单拦截。只要账本符合现有结算条件，可以生成对账单。

### 3.2 黑名单/暂停合作工厂

- 禁止直接派单。
- 禁止进入竞价候选。
- 禁止改派到该工厂。
- 禁止新发起结算或保存新对账草稿。
- 历史账本、历史对账单只读保留查看。

### 3.3 B 级黄牌工厂

- 可以派单，但需要显式风险确认。
- 如果派单任务是急单或本次派单数量超过小单阈值，需要显示黄牌原因并要求二次确认。
- 未带风险确认参数直接调用域函数时，域函数必须拒绝创建草稿。
- 结算侧不做拦截。

### 3.4 主管指定工厂

- 可以直接派单。
- 不参与竞价候选。
- 直接派单时页面展示“主管指定”提示；域函数记录该策略命中结果。
- 结算侧不做拦截。

### 3.5 S/A 级正常工厂

- S 级优先出现在候选列表前部，并标记“推荐”。
- A 级正常可选。
- 大型工厂首单上限 1000 件，小型工厂首单上限 300 件。
- 首单上限只对试产/首单阶段生效，不影响已转正常合作后的常规派单。

## 4. 策略数据模型

在 `FactoryRatingSnapshot` 中保留展示字段，但新增结构化策略字段。展示文案由结构化字段派生，避免文案和规则分叉。

```ts
type DispatchControl =
  | 'PRIORITY'
  | 'ALLOW'
  | 'WARN_CONFIRM'
  | 'TRIAL_ONLY'
  | 'SUPERVISOR_DIRECT_ONLY'
  | 'BLOCKED'

type SettlementControl =
  | 'ALLOW'
  | 'BLOCK_NEW_STATEMENT'

interface FactoryRatingSnapshot {
  firstTrialLimitQty: number | null
  dispatchControl: DispatchControl
  settlementControl: SettlementControl
  allowedDocumentTypes: Array<'试产单' | '常规单'>
  canJoinBidding: boolean
  requiresDispatchRiskConfirm: boolean
  smallOrderLimitQty?: number
}
```

字段含义：

- `dispatchControl`：派单主策略。
- `settlementControl`：结算主策略。
- `allowedDocumentTypes`：该工厂当前允许承接的单据类型。
- `canJoinBidding`：是否进入竞价候选。
- `requiresDispatchRiskConfirm`：是否需要风险确认。
- `smallOrderLimitQty`：B 级黄牌小单阈值，默认使用 `firstTrialLimitQty` 或 300 件。

## 5. 派单规则评估

新增统一评估函数：

```ts
evaluateThirdPartyFactoryDispatchPolicy(input): DispatchPolicyDecision
```

输入：

- `factoryId`
- `actionType`: `直接派单` 或 `发起竞价`
- `documentTypeLabel`: `试产单` 或 `常规单`
- `dispatchQty`
- `isUrgentOrder`
- `riskConfirmed`
- `isSupervisorAssigned`

输出：

```ts
interface DispatchPolicyDecision {
  allowed: boolean
  severity: 'ALLOW' | 'WARN' | 'BLOCK'
  reason: string
  displayBadges: string[]
  requiresConfirm: boolean
  sortPriority: number
}
```

规则顺序：

1. 无评级快照：允许，但显示“未评级，需人工确认”。本期不阻断，避免误伤已有 mock。
2. `BLOCKED`：阻断所有派单动作。
3. `TRIAL_ONLY`：
   - 非试产单：阻断。
   - 本次派单数量超过 `firstTrialLimitQty`：阻断。
   - 满足条件：允许，并显示“试产单额度内”。
4. `SUPERVISOR_DIRECT_ONLY`：
   - 发起竞价：阻断。
   - 直接派单但非主管指定：警示并要求确认。
   - 主管指定：允许。
5. `WARN_CONFIRM`：
   - 急单或数量超过小单阈值：要求风险确认。
   - 已确认：允许，并记录黄牌确认。
6. `PRIORITY`：允许，候选排序优先。
7. `ALLOW`：允许。

## 6. 车缝分配页面体现

### 6.1 工厂候选列表

工厂下拉和候选排序不再只拼接策略文案，而是读取评估结果：

- `BLOCK`：选项禁用，展示阻断原因。
- `WARN`：可选，展示黄牌/主管指定提示。
- `ALLOW`：正常可选。
- `PRIORITY`：排序靠前，展示“推荐”。

### 6.2 直接派单弹窗

选择工厂后，页面即时展示该工厂对当前所选 SKU 的评估结果：

- 考核中但满足试产额度：绿色提示“试产单额度内，可派单”。
- 考核中但常规单：红色阻断“考核中工厂只能接试产单”。
- 考核中但超量：红色阻断“本次派单 X 件，超过首单上限 Y 件”。
- B 级黄牌：黄色提示并显示确认勾选项。
- 主管指定：提示不参与竞价。

确认派单时，页面把 `riskConfirmed`、`isSupervisorAssigned` 等上下文传给域函数。

### 6.3 发起竞价

竞价候选生成时过滤：

- 黑名单/暂停合作不进入候选。
- `SUPERVISOR_DIRECT_ONLY` 不进入候选。
- 考核中工厂只有在试产单且数量合规时才可进入候选。

## 7. 派单域函数落地

`createSewingDispatchWorkbenchDraft()` 必须调用统一评估函数，不能只依赖页面预判。

域函数需要基于所选 SKU 汇总每个工厂的本次派单数量，并识别生产单单据类型。阻断结果直接返回 `ok: false`，风险确认缺失也返回失败。

需要扩展输入：

```ts
policyContextByFactoryId?: Record<string, {
  riskConfirmed?: boolean
  supervisorAssigned?: boolean
}>
```

域函数仍然保持原型轻量，不做真实审批流；确认信息只作为 mock 事实进入草稿结果和验证脚本。

## 8. 结算规则评估

新增统一评估函数：

```ts
evaluateThirdPartyFactorySettlementPolicy(factoryIdOrCode): SettlementPolicyDecision
```

输出：

```ts
interface SettlementPolicyDecision {
  allowedToCreateNewStatement: boolean
  historyReadable: boolean
  reason: string
}
```

规则：

- `BLOCK_NEW_STATEMENT`：不可新建对账单、不可保存新对账草稿，历史账本和历史对账单可查看。
- `ALLOW`：按现有账本和币种规则生成。
- 无评级快照：允许，但页面提示“未评级，按原结算规则处理”。

## 9. 对账单页面体现

对账单新建页选择工厂后展示统一评估结果：

- 黑名单/暂停合作：红色阻断条，生成按钮不可用。
- 历史对账单详情：不展示新建阻断按钮，只保留历史查看。
- 可结算工厂：不展示额外说明，只按现有账本规则展示。

`createStatementFromEligibleLedgers()` 和页面生成/保存入口都调用同一个结算评估函数。

## 10. 验收与对抗式检查

更新 `scripts/check-third-party-factory-rating.ts`，至少覆盖：

- 评级快照仍覆盖全部三方车缝工厂。
- 考核中工厂 + 试产单 + 数量小于等于上限：允许派单。
- 考核中工厂 + 常规单：阻断。
- 考核中工厂 + 试产单但超过上限：阻断。
- B 级黄牌 + 未确认：域函数阻断。
- B 级黄牌 + 已确认：允许派单。
- 主管指定工厂参与竞价：阻断或不进入候选。
- 黑名单/暂停合作工厂直接派单：阻断。
- 黑名单/暂停合作工厂直接调用结算域函数：阻断。
- 黑名单/暂停合作工厂历史账本和历史对账单仍可查看。
- 派单页源代码不再只检查 `dispatchPolicyLabel` 文案展示，而要检查统一评估函数被调用。

浏览器验收覆盖：

- 三方工厂评级页能看到结构化规则生成的策略展示。
- 车缝分配页选择考核中工厂时，试产单额度内可以继续确认。
- 超量、常规单、黑名单、黄牌未确认都能在页面给出明确反馈。
- 对账单新建页选择黑名单/暂停合作工厂时按钮不可用且提示清楚。

## 11. 不做范围

- 不做真实后端规则配置。
- 不做完整审批流。
- 不做真实权限校验。
- 不做历史评级计算任务。
- 不把当前原型改造成通用规则引擎。

## 12. 自检

- 无占位符、TODO 或未定口径。
- 已明确 `考核中` 工厂不是禁止派单，而是试产单和数量上限双条件允许。
- 已明确页面、派单域函数、结算域函数共用统一评估函数。
- 已明确结算只阻断新建，不阻断历史查看。
- 已明确验收必须覆盖绕过页面直接调用域函数的反例。
