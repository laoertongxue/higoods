# 三方车缝工厂试产考核评级规则实现规格与自检

日期：2026-07-17

## 1. 实现边界

本次实现基于《三方车缝工厂试产考核与评级规则规格》，把“三方工厂评级”从页面文案升级为可执行规则闭环：

- 独立试产考核记录保存每轮试产单、完成时效、质检事实、自动评级和人工结论。
- 评级快照读取最新试产记录和最新已生效结论。
- 派单、结算、列表、详情和检查脚本都消费结构化规则。
- 工厂责任瑕疵原因只允许使用现有质检责任原因清单。

## 2. 数据规则

### 2.1 试产考核记录

新增 `src/data/fcs/third-party-factory-trial-assessment.ts`，每条记录代表一个三方车缝工厂的一轮试产考核。

核心字段：

| 字段 | 说明 |
| --- | --- |
| `assessmentRound` | 试产轮次，每个工厂每轮只能有一个试产单 |
| `trialOrderNo` | 试产单号 |
| `productionOrderNo` | 关联生产单 |
| `dispatchQty` | 试产数量 |
| `plannedDeliveryAt` / `actualDeliveryAt` | 计划与实际交出 |
| `qcOrderNo` | 质检单号 |
| `inspectedQty` / `qualifiedQty` / `reworkQty` | 质检数量、合格数量、返工数量 |
| `factoryLiabilityDefectReasonItems` | 工厂责任瑕疵原因明细 |
| `defectiveQty` / `defectRate` | 结构化计算得到的不良数量和不良率 |
| `timelinessGrade` / `qualityGrade` / `autoRatingGrade` | 时效、质量和自动评级 |
| `manualDecision` / `effectiveDecision` | 人工结论与最终生效结论 |
| `status` | 试产考核状态 |

### 2.2 不良率口径

不良数量不允许手写。

```text
工厂责任瑕疵数量 = sum(factoryLiabilityDefectReasonItems.qty)
不良数量 = reworkQty + 工厂责任瑕疵数量
不良率 = 不良数量 / inspectedQty
```

允许计入的工厂责任瑕疵原因只来自 `SEWING_FACTORY_LIABILITY_REASONS`：

- 做工原因
- 脏污
- 抽纱
- 做错
- 做毁
- 破洞

### 2.3 未完成试产状态

mock 数据和检查脚本覆盖三类未完成状态：

| 状态 | 页面中文 |
| --- | --- |
| `WAIT_TRIAL_DISPATCH` | 待派出 |
| `TRIAL_DISPATCHED` | 已派出未交出 / 列表时效显示未交出 |
| `WAIT_QC` | 待质检 |

页面不得直接显示英文状态码。未完成试产不得显示为 `0.0%` 不良率，列表排序也不得把未质检记录当作真实 0% 质量结果。

## 3. 快照规则

`src/data/fcs/third-party-factory-rating.ts` 的评级快照同步逻辑读取：

- `getLatestThirdPartyFactoryTrialAssessmentRecord()`：最新一轮试产记录，用于列表和详情摘要。
- `getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord()`：最新已生效结论，用于当前评级和合作状态。
- `hasOpenThirdPartyFactoryTrialAssessment()`：是否存在未完成试产，用于派单重复试产拦截。

延长考核口径：

- 工厂保持 `考核中`。
- 派单控制保持 `TRIAL_ONLY`。
- 下一单允许单据仍为 `试产单`。
- 下一单上限沿用车位规模派生的试产上限。
- 结算控制保持 `ALLOW`，不做黑名单结算拦截。

## 4. 派单规则

派单判断统一走 `evaluateThirdPartyFactoryDispatchPolicy()`。

`TRIAL_ONLY` 工厂规则：

- 只允许 `试产单`。
- 试产数量不得超过 `nextTrialLimitQty ?? firstTrialLimitQty ?? 300`。
- 当前已有未完成试产时，阻断重复派试产单。
- 规则返回结构化 `allowed`、`severity`、`reason`、`badges` 和 `sortPriority`。

车缝分配工作台、定标入口和检查脚本必须消费统一评估结果，不得用合作状态文案硬编码。

## 5. 结算规则

结算判断统一走 `evaluateThirdPartyFactorySettlementPolicy()`。

| 场景 | 规则 |
| --- | --- |
| 黑名单 / `BLOCK_NEW_STATEMENT` | 禁止发起新结算，历史账本可查看 |
| 考核中 / `TRIAL_ONLY` | 不做黑名单结算拦截 |
| 正常合作 | 可按账本发起结算 |

对账单页面、生成动作、保存草稿动作、域函数 `createStatementFromEligibleLedgers()` 和 `syncStatementDraftFromBuild()` 均按 `allowedToCreateNewStatement` 判断。

专项检查包含两个反例：

- 黑名单工厂即使有候选流水，也不能绕过页面直接创建对账单。
- 临时挂接考核中评级的真实候选流水，可以直接创建对账单，并通过 `try/finally` 回滚临时草稿。

## 6. 页面展示

### 6.1 三方工厂评级列表

路径：`/fcs/factories/third-party-rating`

列表使用标准列表页组件，新增并默认展示：

- `试产单情况`
- `试产结论`

列表展示：

- 试产轮次
- 最新试产单号
- 关联生产单号
- 完成时效
- 不良率
- 系统建议
- 人工结论

### 6.2 评级详情抽屉

详情抽屉新增 `试产考核记录` 区块，读取独立试产考核记录，而不是只读快照摘要。

每轮展示：

- 轮次和试产单号
- 生产单号
- 中文状态
- 试产数量
- 完成时效
- 计划与实际交出
- 质检数量、不良数量、不良率
- 返工数量、工厂责任瑕疵数量
- 工厂责任瑕疵原因
- 时效评级、质量评级、自动评级
- 系统建议、人工结论和人工说明

## 7. 自检结果

已通过的自动检查：

```bash
npm run check:third-party-factory-rating
npm run check:list-page-governance:static
```

已覆盖的对抗式检查方向：

| 方向 | 结论 |
| --- | --- |
| 数据完整性 | 11 个三方车缝工厂均有评级快照和试产考核记录；责任瑕疵原因全部来自字典 |
| 页面可见性 | 列表展示试产摘要，详情展示全部试产轮次 |
| 交互可达性 | 评级详情入口、列设置、筛选和分页仍走标准列表页交互 |
| 业务闭环 | 派单执行试产限制；结算执行黑名单拦截并保留考核中可结算对照 |

## 8. 仍不纳入

- 不新增真实后端接口。
- 不新增规则配置页。
- 不做正式审批流。
- 不把 90 天履约记录作为试产评级来源。
- 不改非三方车缝工厂评级逻辑。
