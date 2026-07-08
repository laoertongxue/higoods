# 生产单变更管理实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 `/fcs/production/changes` 页面上实现“生产单变更管理”首版原型：以生产单和变更单为入口，展示变更内容、系统计算出的生产影响、受影响单据处理方式、料工费差异、生产时效影响、执行策略、审核和执行记录。左侧菜单继续使用“生产单变更管理”，不使用“生产单变更影响台账”。场景库必须覆盖 80 个生产单变更业务场景，详细 mock 必须覆盖版本关系变更、生产单层补丁、版本关系变更 + 生产单层补丁、仅记录影响、仅成本结算差异五类结果。

**架构：** 继续沿用现有 FCS 原型架构。数据层在 `src/data/fcs/production-tech-pack-change-domain.ts` 扩展 80 个场景目录、24 条详细变更单 mock、生产影响行、业务单据变更前后快照、料工费差异和时效影响；页面层在 `src/pages/production/changes-domain.ts` 基于现有生产单变更页面局部重构为“列表 + 选中变更单详情”的管理台；路由保持 `/fcs/production/changes` 不变；增加一个 assert 型检查脚本和一份原型治理审查记录。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `src/components/ui/` 组件、本地 mock 数据、`tsx` 检查脚本。

---

## 文件结构

本计划只修改和新增以下文件：

```text
src/data/fcs/production-tech-pack-change-domain.ts
src/pages/production/changes-domain.ts
src/data/app-shell-config.ts
scripts/check-production-order-changes.ts
docs/prototype-review-records/2026-07-07-production-order-change-management.md
```

不修改真实后端、权限体系、API 层、全局状态管理、数据库模型、Vercel 配置。

## 业务边界

生产单变更管理的首版边界如下：

- 变更入口按“业务人员提出变更内容和期望生效口径”建模，不要求业务人员先判断“切换技术包版本”还是“打生产补丁”。
- 系统根据冻结技术包版本、当前正式版本、最新正式版本、生产进度、已生成单据、已领料、已消耗、已结算事实，反推变更结果。
- 变更结果只允许落在五类：版本关系变更、生产补丁、版本关系变更 + 生产补丁、仅记录影响、仅成本结算差异。
- 生产补丁是生产单层补丁，只挂在单张生产单及其指定色码、批次、工序、数量、生效点上，不改冻结快照，不污染正式技术包版本。
- 审核中不默认冻结整张生产单，只锁定受影响范围的冲突操作。高风险场景可由系统建议或审核人选择整单暂停。
- “立即止损”只做风险范围锁定和通知，不代表最终变更已经生效。
- “立即执行”只允许低风险、可逆、权限内、不影响结算和发货的处理项。
- “审核通过后执行”用于影响正式版本关系、结算、发货、已消耗物料、已交出工序、返工和责任归因的处理项。

## 80 个业务场景目录

数据层必须维护 `productionOrderChangeScenarioCatalog`，用于表达设计覆盖面。它不是 80 条都铺满页面的明细数据，而是产品和测试共同使用的场景目录。页面展示其中的分类统计和典型场景，详细变更单 mock 从这里抽取 24 条做完整单据闭环。

```text
01 技术包发布新正式版，生产单未开始，整单切换新版本。
02 技术包发布新正式版，已生成配料单，未领料，配料单改配后切换。
03 技术包发布新正式版，已部分领料，未裁剪，未领部分切换，已领部分按旧或退料。
04 技术包发布新正式版，已铺布未裁剪，裁剪单需暂停确认。
05 技术包发布新正式版，已裁剪未印花，未加工工序切换，已裁部分保留。
06 技术包发布新正式版，印花工单已生成未开工，印花单取消重开。
07 技术包发布新正式版，印花加工中，当前印花单不改，下批生效。
08 技术包发布新正式版，染色工单已生成未开工，染色单取消重开。
09 技术包发布新正式版，染色加工中，追回未染批次，已染批次保留。
10 技术包发布新正式版，菲票已打印未交出，作废重打菲票。
11 技术包发布新正式版，车缝已交出部分，只记录影响并通知后道。
12 技术包发布新正式版，已产生结算草稿，审核通过后追加结算差异。
13 主面料短缺，未领料范围替代料，生产单层补丁。
14 主面料短缺，已领旧料未裁，退旧领新，生产单层补丁。
15 主面料短缺，已裁旧料，剩余色码替代料，生产单层补丁。
16 里布短缺，指定尺码替代料，生产单层补丁。
17 辅料短缺，纽扣替代，未车缝范围生效。
18 辅料短缺，拉链替代，已车缝部分不追回。
19 面料色差，指定缸号停用，未裁批次改领新缸号。
20 面料缩水异常，纸样不改，用料单增加损耗补丁。
21 供应商临时调价，只影响成本核算，不改生产。
22 面料克重不符，买手确认接受，记录影响并保留原单据。
23 面料克重不符，买手不接受，未加工批次换料。
24 面料门幅变化，排版耗用变化，配料单补料。
25 工艺路线新增洗水，未进入后道范围追加工序。
26 工艺路线取消压烫，未压烫范围取消工序并扣减工费。
27 工艺参数改线迹密度，车缝未开工范围按新工艺。
28 工艺参数改针距，已车缝部分不返工，未车缝部分改做。
29 工艺现场发现缝份不足，指定尺码返工。
30 工艺现场发现辅料位置错误，未车缝范围改工艺。
31 印花颜色调整，印花未开工，印花单改做。
32 印花颜色调整，印花已开工，当前单保留，下批改做。
33 印花位置调整，已制版未印，重开印花版费。
34 印花花型文件替换，印花需求单和加工单同步更新。
35 染色配方调整，染色未开工，染色单改做。
36 染色配方调整，部分已染，未染批次改做。
37 染色返修要求，已染批次追加返修费用。
38 洗水方式变更，后道未开始范围追加工序。
39 纸样调整，生产单未裁剪，裁剪单重算。
40 纸样调整，已裁部分保留，未裁部分重排版。
41 放码规则调整，指定尺码改纸样。
42 尺码表调整，只影响未裁尺码。
43 尺码唛信息错误，菲票和尺码唛补打。
44 颜色名称修正，只影响单据展示，不影响生产。
45 款色用料对应错误，指定颜色换用料。
46 款色用料对应新增颜色，新增配料和领料单。
47 花型确认晚于生产准备节点，印花未开工补丁生效。
48 花型确认后买手改图，印花单取消重开。
49 花型版权问题，指定颜色停止加工。
50 花型文件清晰度不足，暂缓印花并锁定影响范围。
51 核价漏计辅料，追加材料成本。
52 核价漏计印花费，追加加工成本。
53 核价漏计染色费，追加加工成本。
54 核价错误导致工价偏低，结算单补差。
55 核价错误导致工价偏高，结算单扣减。
56 版费归属变化，费用差异改责任归因。
57 加急空运要求，追加物流费用。
58 客户取消加急，取消加急费并调整交期。
59 交期提前，未开工工序加急并计算费用。
60 交期延后，生产不改，仅调整时效风险。
61 发货仓变化，交付仓配置和物流费用变化。
62 分批发货，指定批次优先生产。
63 部分取消订单，剩余数量继续生产。
64 补单追加数量，追加配料、裁剪和工序单据。
65 质量抽检发现面料瑕疵，未裁范围换料。
66 质量抽检发现印花偏位，已印批次返工。
67 质量抽检发现染色色差，染色返修。
68 质量抽检发现车缝错误，指定扎号返工。
69 质检扣款确认，只影响结算，不改生产。
70 工厂报废裁片，补裁并追加材料损耗。
71 仓库发错料，退错料并重新领料。
72 仓库少发料，补发并记录时效影响。
73 工厂误用旧工艺，追回未完成范围并记录责任。
74 工厂已按旧版本完成，买手接受，仅记录影响。
75 工厂已按旧版本完成，买手不接受，返工并重新核算。
76 平台录入错误，纠正单据展示并保留审计记录。
77 技术包版本发布错误，撤销版本关系变更申请。
78 补丁审核驳回，释放锁定并按原方案继续。
79 变更审核退回修改，业务改选单据处理方式。
80 变更执行完成后发现遗漏单据，追加处理记录和成本差异。
```

## Task 1: 写生产单变更闭环检查脚本

**目的：** 先用检查脚本固定首版验收口径，确保页面、数据、菜单和治理记录覆盖产品设计核心语义。

**文件：** `scripts/check-production-order-changes.ts`

**步骤：**

- [ ] 新建 `scripts/check-production-order-changes.ts`。
- [ ] 写入以下检查脚本：

```ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderProductionChangesPage } from '../src/pages/production/changes-domain.ts'
import {
  listProductionOrderChangeCostImpacts,
  listProductionOrderChangeDocumentActions,
  listProductionOrderChangeImpactRows,
  listProductionOrderChangeOrders,
  listProductionOrderChangeScenarioCatalog,
  listProductionOrderChangeTimingImpacts,
} from '../src/data/fcs/production-tech-pack-change-domain.ts'

function assertIncludes(haystack: string, needle: string) {
  assert.ok(haystack.includes(needle), `页面应包含：${needle}`)
}

function assertNotIncludes(haystack: string, needle: string) {
  assert.ok(!haystack.includes(needle), `页面不应包含：${needle}`)
}

const html = renderProductionChangesPage()

for (const text of [
  '生产单变更管理',
  '变更单',
  '生产影响',
  '单据处理',
  '料工费差异',
  '时效影响',
  '立即止损',
  '影响范围锁定',
  '80 个场景',
  '变更前',
  '变更后',
]) {
  assertIncludes(html, text)
}

assertNotIncludes(html, '生产单变更影响台账')

const scenarios = listProductionOrderChangeScenarioCatalog()
const orders = listProductionOrderChangeOrders()
const impacts = listProductionOrderChangeImpactRows()
const documentActions = listProductionOrderChangeDocumentActions()
const costImpacts = listProductionOrderChangeCostImpacts()
const timingImpacts = listProductionOrderChangeTimingImpacts()

assert.equal(scenarios.length, 80, '场景目录必须覆盖 80 个业务场景')
assert.ok(orders.length >= 24, '至少需要 24 条详细生产单变更单 mock 数据')
assert.ok(impacts.length >= 36, '生产影响行应覆盖不同色码、批次、工序和数量')
assert.ok(documentActions.length >= 72, '业务单据处理 mock 应覆盖变更前后差异')
assert.ok(costImpacts.length >= 18, '料工费差异应覆盖材料、人工、费用、责任归因')
assert.ok(timingImpacts.length >= 18, '时效影响应覆盖生产节点和履约发货节点')

assert.ok(
  orders.some((order) => order.executionStrategy === 'IMMEDIATE_STOP_LOSS'),
  '应覆盖立即止损场景',
)
assert.ok(
  orders.some((order) => order.executionStrategy === 'IMMEDIATE_EXECUTION'),
  '应覆盖立即执行场景',
)
assert.ok(
  orders.some((order) => order.executionStrategy === 'AFTER_APPROVAL'),
  '应覆盖审核通过后执行场景',
)
assert.ok(
  orders.some((order) => order.changeResult === 'VERSION_AND_PATCH'),
  '应覆盖版本关系变更 + 生产补丁场景',
)
assert.ok(
  orders.some((order) => order.changeResult === 'VERSION_RELATION'),
  '应覆盖版本关系变更场景',
)
assert.ok(
  orders.some((order) => order.changeResult === 'PRODUCTION_PATCH'),
  '应覆盖生产单层补丁场景',
)
assert.ok(
  orders.some((order) => order.changeResult === 'COST_ONLY'),
  '应覆盖仅成本结算差异场景',
)

assert.ok(
  impacts.some(
    (row) =>
      row.affectedColor &&
      row.affectedSize &&
      row.affectedBatch &&
      row.affectedProcess &&
      row.affectedQuantity > 0,
  ),
  '生产影响行必须包含色码、批次、工序和数量',
)
assert.ok(
  documentActions.some((row) => row.systemSuggestion && row.finalAction && row.actionStatus),
  '单据处理行必须包含系统建议、最终处理方式和处理状态',
)
assert.ok(
  documentActions.some((row) => row.beforeBusinessContent && row.afterBusinessContent),
  '单据处理行必须包含变更前和变更后业务内容',
)
assert.ok(
  costImpacts.some(
    (row) =>
      typeof row.estimatedAmount === 'number' &&
      typeof row.actualAmount === 'number' &&
      row.responsibleParty,
  ),
  '料工费差异必须包含预计金额、实际金额和责任归因',
)
assert.ok(
  timingImpacts.some(
    (row) =>
      row.originalTime &&
      row.newEstimatedTime &&
      typeof row.delayDays === 'number' &&
      row.responsibleParty,
  ),
  '时效影响必须包含原计划、新预计、影响天数和责任归因',
)

const menuFile = readFileSync(join(process.cwd(), 'src/data/app-shell-config.ts'), 'utf8')
assert.ok(menuFile.includes('生产单变更管理'), '左侧菜单应显示生产单变更管理')
assert.ok(!menuFile.includes('生产单变更影响台账'), '左侧菜单不应显示生产单变更影响台账')

const reviewRecord = join(
  process.cwd(),
  'docs/prototype-review-records/2026-07-07-production-order-change-management.md',
)
assert.ok(existsSync(reviewRecord), '必须补充原型治理审查记录')

console.log('production order changes check passed')
```

- [ ] 运行脚本，确认当前会失败：

```bash
npx tsx scripts/check-production-order-changes.ts
```

**预期失败原因：**

- `listProductionOrderChangeOrders` 等导出函数尚未存在。
- 页面还没有完整展示“生产影响 / 单据处理 / 料工费差异 / 时效影响”闭环。
- 菜单可能仍显示“生产单变更”。
- 治理审查记录尚未创建。

**提交：**

```bash
git add scripts/check-production-order-changes.ts
git commit -m "test: 增加生产单变更管理闭环检查"
```

## Task 2: 扩展生产单变更管理数据模型和 mock 数据

**目的：** 在现有技术包变更数据文件内补齐“变更单、影响行、单据处理、料工费、时效”的闭环数据，供页面和检查脚本读取。

**文件：** `src/data/fcs/production-tech-pack-change-domain.ts`

**步骤：**

- [ ] 在现有类型定义区新增生产单变更管理类型，放在 `ProductionPatchStatus` 附近，保持与现有英文内部状态 + 中文 label 的写法一致。

```ts
export type ProductionOrderChangeSource =
  | 'TECH_PACK_NEW_VERSION'
  | 'MATERIAL_SHORTAGE'
  | 'FACTORY_PROCESS_EXCEPTION'
  | 'PATTERN_SIZE_PRINT_CHANGE'
  | 'COST_EXCEPTION'
  | 'DELIVERY_REQUIREMENT_CHANGE'
  | 'QUALITY_REWORK'

export type ProductionOrderChangeResult =
  | 'VERSION_RELATION'
  | 'PRODUCTION_PATCH'
  | 'VERSION_AND_PATCH'
  | 'RECORD_ONLY'
  | 'COST_ONLY'

export type ProductionOrderChangeExecutionStrategy =
  | 'IMMEDIATE_STOP_LOSS'
  | 'IMMEDIATE_EXECUTION'
  | 'AFTER_APPROVAL'

export type ProductionOrderChangeLockStatus =
  | 'NONE'
  | 'IMPACT_SCOPE_LOCKED'
  | 'WHOLE_ORDER_PAUSED'
  | 'RELEASED'

export type ProductionOrderChangeOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'EXECUTING'
  | 'DONE'
  | 'REJECTED'
  | 'RETURNED'

export type ProductionOrderChangeDocumentType =
  | 'MATERIAL_PREPARATION'
  | 'PICKING'
  | 'CUTTING'
  | 'PRINTING'
  | 'DYEING'
  | 'BUNDLE_TICKET'
  | 'SEWING'
  | 'SETTLEMENT'

export type ProductionOrderChangeDocumentActionStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_CONFIRM'
  | 'PENDING_EXECUTION'
  | 'EXECUTING'
  | 'DONE'
  | 'BLOCKED'

export type ProductionOrderChangeCostType = 'MATERIAL' | 'LABOR' | 'FEE'

export type ProductionOrderChangeTimingNode =
  | 'MATERIAL_PREPARATION'
  | 'PICKING'
  | 'CUTTING'
  | 'PRINTING'
  | 'DYEING'
  | 'SEWING'
  | 'POST_FINISHING'
  | 'SHIPPING'
```

- [ ] 在同一文件新增六个接口：

```ts
export interface ProductionOrderChangeScenario {
  id: string
  source: ProductionOrderChangeSource
  title: string
  expectedResult: ProductionOrderChangeResult
  mainAffectedDocuments: ProductionOrderChangeDocumentType[]
  costImpact: ProductionOrderChangeCostType[]
  timingNodes: ProductionOrderChangeTimingNode[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface ProductionOrderChangeOrder {
  id: string
  scenarioId: string
  productionOrderId: string
  demandOrderId: string
  spuCode: string
  styleName: string
  buyerName: string
  merchandiserName: string
  source: ProductionOrderChangeSource
  changeModules: TechPackChangeModule[]
  reason: string
  expectedEffectiveMode: ChangeEffectiveMode
  effectiveDescription: string
  changeResult: ProductionOrderChangeResult
  executionStrategy: ProductionOrderChangeExecutionStrategy
  lockStatus: ProductionOrderChangeLockStatus
  status: ProductionOrderChangeOrderStatus
  hasVersionRelationChange: boolean
  hasProductionPatch: boolean
  affectedDocumentCount: number
  costDeltaAmount: number
  delayDays: number
  createdBy: string
  createdAt: string
  reviewer: string
  latestLog: string
}

export interface ProductionOrderChangeImpactRow {
  id: string
  changeOrderId: string
  affectedColor: string
  affectedSize: string
  affectedBatch: string
  affectedProcess: string
  affectedQuantity: number
  doneQuantity: number
  changeableQuantity: number
  irreversibleQuantity: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  impactSummary: string
}

export interface ProductionOrderChangeDocumentAction {
  id: string
  changeOrderId: string
  documentType: ProductionOrderChangeDocumentType
  documentNo: string
  currentStatus: string
  beforeBusinessContent: string
  afterBusinessContent: string
  systemSuggestion: string
  finalAction: string
  quantityDelta: number
  amountDelta: number
  actionStatus: ProductionOrderChangeDocumentActionStatus
  owner: string
  reasonWhenChanged: string
}

export interface ProductionOrderChangeCostImpact {
  id: string
  changeOrderId: string
  costType: ProductionOrderChangeCostType
  itemName: string
  estimatedAmount: number
  actualAmount: number
  responsibleParty: string
  settlementHandling: string
}

export interface ProductionOrderChangeTimingImpact {
  id: string
  changeOrderId: string
  timingNode: ProductionOrderChangeTimingNode
  originalTime: string
  newEstimatedTime: string
  delayDays: number
  affectsProductionDelivery: boolean
  affectsFulfillmentDelivery: boolean
  responsibleParty: string
  recoveryAction: string
}
```

- [ ] 新增 label 映射，页面只读取中文 label，不直接展示英文内部值。

```ts
export const productionOrderChangeSourceLabels: Record<ProductionOrderChangeSource, string> = {
  TECH_PACK_NEW_VERSION: '技术包发布新正式版',
  MATERIAL_SHORTAGE: '物料短缺 / 替代料',
  FACTORY_PROCESS_EXCEPTION: '工艺现场异常',
  PATTERN_SIZE_PRINT_CHANGE: '纸样 / 尺码 / 花型调整',
  COST_EXCEPTION: '核价 / 成本异常',
  DELIVERY_REQUIREMENT_CHANGE: '交期 / 发货要求变化',
  QUALITY_REWORK: '质量问题 / 返工要求',
}

export const productionOrderChangeResultLabels: Record<ProductionOrderChangeResult, string> = {
  VERSION_RELATION: '版本关系变更',
  PRODUCTION_PATCH: '生产单层补丁',
  VERSION_AND_PATCH: '版本关系变更 + 生产单层补丁',
  RECORD_ONLY: '仅记录影响',
  COST_ONLY: '仅成本结算差异',
}

export const productionOrderChangeExecutionStrategyLabels: Record<
  ProductionOrderChangeExecutionStrategy,
  string
> = {
  IMMEDIATE_STOP_LOSS: '立即止损',
  IMMEDIATE_EXECUTION: '立即执行',
  AFTER_APPROVAL: '审核通过后执行',
}
```

- [ ] 新增 mock 数组 `productionOrderChangeScenarioCatalog`，严格包含上文 80 个业务场景。每条场景都要有 `expectedResult`、`mainAffectedDocuments`、`costImpact`、`timingNodes`、`riskLevel`，用于证明产品设计覆盖面。
- [ ] 新增 mock 数组 `productionOrderChangeOrders`，至少包含 24 条详细变更单，并从 80 个场景目录中引用 `scenarioId`。24 条详细变更单按以下数量覆盖：

```text
版本关系变更：6 条
生产单层补丁：6 条
版本关系变更 + 生产单层补丁：6 条
仅记录影响：3 条
仅成本结算差异：3 条
```

- [ ] 24 条详细变更单必须覆盖以下核心组合：

```text
未开工整单切换
已生成配料单未领料
已部分领料未裁剪
已铺布未裁剪
已裁剪未印花
印花单已生成未开工
印花加工中
染色单已生成未开工
染色加工中
菲票已打印未交出
车缝已交出部分
已产生结算草稿
主面料短缺
辅料短缺
面料色差
门幅变化
工艺新增
工艺取消
纸样调整
尺码调整
花型替换
质量返工
核价补差
交期提前或延后
```

- [ ] 新增 mock 数组 `productionOrderChangeImpactRows`，至少 36 条。每个非 `COST_ONLY` 的详细变更单至少 1 条影响行；高风险场景至少 2 条影响行；其中 `CHANGE-PO-202603-0004-001` 需要包含 `affectedColor: '黑色'`、`affectedSize: 'M'`、`affectedBatch: '第 2 批'`、`affectedProcess: '裁剪前未领料范围'`。
- [ ] 新增 mock 数组 `productionOrderChangeDocumentActions`，至少 72 条，覆盖配料单、领料单、裁剪单、印花单、染色单、菲票、车缝、结算单。每条记录必须同时有 `beforeBusinessContent` 和 `afterBusinessContent`，例如 `变更前：主面料 A 120 米；变更后：替代面料 B 80 米，旧料退回 40 米`。
- [ ] 单据 mock 必须按变更结果覆盖：

```text
版本关系变更后：配料单、领料单、裁剪单、印花单、染色单、菲票、结算单至少各 2 条。
生产单层补丁后：配料单、领料单、裁剪单、印花单、染色单、菲票、车缝、结算单至少各 2 条。
版本关系变更 + 生产单层补丁后：配料单、领料单、裁剪单、印花单、染色单、菲票、车缝、结算单至少各 2 条。
仅记录影响：至少覆盖菲票、车缝、结算单各 1 条。
仅成本结算差异：至少覆盖结算单 3 条。
```

- [ ] 新增 mock 数组 `productionOrderChangeCostImpacts`，至少 18 条，覆盖材料差异、人工差异、费用差异，并写明责任归因。
- [ ] 新增 mock 数组 `productionOrderChangeTimingImpacts`，至少 18 条，覆盖生产节点延期、履约发货风险和追回动作。
- [ ] 在文件底部新增导出函数：

```ts
export function listProductionOrderChangeScenarioCatalog() {
  return productionOrderChangeScenarioCatalog
}

export function listProductionOrderChangeOrders() {
  return productionOrderChangeOrders
}

export function listProductionOrderChangeImpactRows(changeOrderId?: string) {
  return changeOrderId
    ? productionOrderChangeImpactRows.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeImpactRows
}

export function listProductionOrderChangeDocumentActions(changeOrderId?: string) {
  return changeOrderId
    ? productionOrderChangeDocumentActions.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeDocumentActions
}

export function listProductionOrderChangeCostImpacts(changeOrderId?: string) {
  return changeOrderId
    ? productionOrderChangeCostImpacts.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeCostImpacts
}

export function listProductionOrderChangeTimingImpacts(changeOrderId?: string) {
  return changeOrderId
    ? productionOrderChangeTimingImpacts.filter((row) => row.changeOrderId === changeOrderId)
    : productionOrderChangeTimingImpacts
}
```

- [ ] 运行检查脚本，确认失败范围收窄到页面和菜单：

```bash
npx tsx scripts/check-production-order-changes.ts
```

**提交：**

```bash
git add src/data/fcs/production-tech-pack-change-domain.ts
git commit -m "feat: 补齐生产单变更管理闭环数据"
```

## Task 3: 重构生产单变更管理页面信息结构

**目的：** 把当前页面从“版本关系和补丁入口列表”升级为“生产单变更管理闭环台”，让业务人员能按一张生产单、一张变更单看懂影响范围、单据处理、成本、时效和执行状态。

**文件：** `src/pages/production/changes-domain.ts`

**步骤：**

- [ ] 更新 imports，引入 Task 2 新增的类型、label 和 list 函数。
- [ ] 页面标题改为 `生产单变更管理`，副标题改为 `按生产单和变更单展示变更内容、生产影响、单据处理、料工费差异、时效影响和执行闭环。`
- [ ] 保留现有 `renderVersionChangeDialog`、生产补丁弹窗、日志弹窗等已有动作入口，避免扩大交互重写范围。
- [ ] 新增 `renderChangeManagementStats()`，统计并展示以下指标：

```text
场景库 80 个
变更单数
立即止损
审核中
存在生产补丁
影响结算
影响交期
```

- [ ] 新增 `renderScenarioCoveragePanel()`，展示 80 个场景目录的分类统计：

```text
技术包新版本
物料短缺 / 替代料
工艺现场异常
纸样 / 尺码 / 花型调整
核价 / 成本异常
交期 / 发货要求变化
质量问题 / 返工要求
```

- [ ] 场景覆盖面板只展示分类计数和 6 个典型场景，不把 80 条全部铺在首屏。
- [ ] 新增 `renderChangeOrderSummaryList()`，按变更单展示以下字段：

```text
变更单号
生产单号
款式 / SPU
变更来源
变更模块
期望生效口径
系统反推结果
执行策略
锁定状态
状态
最后记录
```

- [ ] 新增 `renderChangeOrderDetail()`，默认选中第一条变更单，详情区按以下顺序展示：

```text
1. 变更内容
2. 系统读取的现场事实
3. 生产影响
4. 单据处理
5. 料工费差异
6. 时效影响
7. 执行与审核
8. 处理记录
```

- [ ] 新增 `renderProductionImpactSection()`，用表格展示影响行，列为：

```text
颜色
尺码
批次
受影响工序
影响数量
已完成
可改做
不可追回
风险
说明
```

- [ ] 新增 `renderDocumentActionSection()`，用表格展示单据处理，列为：

```text
单据类型
单据号
当前状态
变更前
变更后
系统建议
最终处理方式
处理状态
责任人
改选原因
```

- [ ] 新增 `renderCostImpactSection()`，用表格展示料工费差异，列为：

```text
类型
项目
预计差异
实际差异
责任归因
结算处理
```

- [ ] 新增 `renderTimingImpactSection()`，用表格展示时效影响，列为：

```text
节点
原计划
新预计
影响天数
影响生产交期
影响履约发货
责任归因
追回动作
```

- [ ] 新增 `renderExecutionReviewSection()`，清楚表达三种执行策略：

```text
立即止损：先锁定受影响范围和通知责任人，不完成最终变更。
立即执行：低风险、可逆、权限内、不影响结算或发货的单据处理可先执行并备案。
审核通过后执行：影响版本关系、补丁、结算、发货、返工、已消耗物料的处理必须审核通过后执行。
```

- [ ] 详情区必须明确展示：

```text
冻结快照不改
正式技术包版本不因单张生产单异常被污染
生产补丁挂在生产单层
审核中只锁定受影响范围的冲突操作
```

- [ ] 页面中所有状态值显示中文，不把新增英文内部状态值直接渲染出来。
- [ ] 保持按钮为现有风格，核心动作保留：

```text
查看详情
变更版本
发起补丁
日志
```

- [ ] 运行检查脚本：

```bash
npx tsx scripts/check-production-order-changes.ts
```

**提交：**

```bash
git add src/pages/production/changes-domain.ts
git commit -m "feat: 重构生产单变更管理页面闭环"
```

## Task 4: 更新左侧菜单名称

**目的：** 菜单继续叫“生产单变更管理”，路由保持原地址，避免用户入口改变。

**文件：** `src/data/app-shell-config.ts`

**步骤：**

- [ ] 将 FCS 左侧菜单中的 `生产单变更` 改为 `生产单变更管理`。
- [ ] 确认路由仍是 `/fcs/production/changes`。
- [ ] 确认没有出现 `生产单变更影响台账`：

```bash
rg "生产单变更影响台账" src docs scripts
```

该命令应无输出。

- [ ] 运行检查脚本：

```bash
npx tsx scripts/check-production-order-changes.ts
```

**提交：**

```bash
git add src/data/app-shell-config.ts
git commit -m "chore: 更新生产单变更管理菜单名称"
```

## Task 5: 补充原型治理审查记录

**目的：** 符合项目对印尼工厂现场协同原型的治理要求，说明本次页面如何照顾低培训成本、业务闭环、下游执行和防错。

**文件：** `docs/prototype-review-records/2026-07-07-production-order-change-management.md`

**步骤：**

- [ ] 读取模板：

```bash
sed -n '1,220p' docs/prototype-review-record-template.md
```

- [ ] 新建审查记录，内容必须包含：

```text
页面 / 路由：/fcs/production/changes
模块：FCS 生产单变更管理
端类型：管理端，兼顾工厂主管和下游执行端感知
角色：跟单、买手、工艺、仓管、裁剪、印花、染色、车缝、结算、计划履约
本次结论：通过
重点说明：业务人员不先判断变更类型，系统根据现场事实反推版本关系变更、生产单层补丁和成本 / 时效影响
防错说明：审核中默认只锁定受影响范围，高风险才整单暂停
现场说明：下游执行端只看与自己有关的单据处理和新旧口径，不要求理解完整技术包版本模型
```

- [ ] 审查记录必须说明本次参考：

```text
docs/higood-indonesia-factory-product-design-guidelines.md
docs/higood-indonesia-factory-prototype-review-checklist.md
```

- [ ] 运行治理检查：

```bash
npm run check:prototype-design-governance -- --all
```

**提交：**

```bash
git add docs/prototype-review-records/2026-07-07-production-order-change-management.md
git commit -m "docs: 增加生产单变更管理原型审查记录"
```

## Task 6: 页面和构建验证

**目的：** 验证页面可运行、检查脚本通过、设计治理通过、构建通过、CodeGraph 索引同步。

**步骤：**

- [ ] 运行专项检查：

```bash
npx tsx scripts/check-production-order-changes.ts
```

预期输出：

```text
production order changes check passed
```

- [ ] 运行原型治理检查：

```bash
npm run check:prototype-design-governance -- --all
```

预期输出包含：

```text
prototype design governance passed
```

- [ ] 运行构建检查：

```bash
npm run build
```

- [ ] 运行 diff 空白检查：

```bash
git diff --check
```

- [ ] 同步 CodeGraph：

```bash
codegraph sync && codegraph status
```

预期状态：

```text
Index status: up to date
```

**提交：**

```bash
git add scripts/check-production-order-changes.ts src/data/fcs/production-tech-pack-change-domain.ts src/pages/production/changes-domain.ts src/data/app-shell-config.ts docs/prototype-review-records/2026-07-07-production-order-change-management.md
git commit -m "feat: 完成生产单变更管理首版原型"
```

## Task 7: 浏览器验收

**目的：** 从真实页面视角确认信息结构、中文文案、表格密度、入口和状态表达可读。

**步骤：**

- [ ] 启动本地服务，端口被占用时改用下一个可用端口：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

- [ ] 获取局域网 IP：

```bash
ipconfig getifaddr en0
```

- [ ] 验证路由可达。将 `<局域网IP>` 替换为上一步输出：

```bash
curl -I http://<局域网IP>:5173/fcs/production/changes
```

预期响应包含：

```text
HTTP/1.1 200 OK
```

- [ ] 在浏览器打开：

```text
http://<局域网IP>:5173/fcs/production/changes
```

- [ ] 在 1440px 宽度确认：

```text
左侧菜单显示生产单变更管理
页面标题显示生产单变更管理
统计卡片可读
变更单列表可读
详情区按变更内容、生产影响、单据处理、料工费差异、时效影响展示
按钮没有遮挡
表格没有明显溢出
没有英文状态码直接展示
```

- [ ] 在 1024px 宽度确认：

```text
列表和详情仍可扫描
关键标签和按钮不重叠
长文本不挤出容器
```

## Task 8: 最终交付说明

**目的：** 用短说明告诉用户改了什么、验证了什么、还保留什么边界。

**步骤：**

- [ ] 最终回复包含：

```text
已将左侧菜单保持为生产单变更管理。
已把页面表达从先选变更类型调整为先录变更内容和期望生效口径，再由系统反推版本关系变更、生产单层补丁、单据处理、料工费差异和时效影响。
已补充生产影响、单据处理、料工费差异、时效影响、执行策略和审核锁定口径。
已运行专项检查、原型治理检查、构建检查、diff 检查和 CodeGraph 同步。
```

- [ ] 如果浏览器服务保持运行，提供访问地址：

```text
http://<局域网IP>:5173/fcs/production/changes
```

- [ ] 明确首版边界：

```text
本次仍是产品原型，不接真实后端，不实现真实审批流和真实成本核算引擎。
```
