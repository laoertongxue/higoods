# 工厂结算规则实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 HiGood FCS 原型中落地工厂结算新口径：自定义时间段、按流水/生产单两种结算对象、完整生产单门槛、质检事实与扣款确认分离、对账单确认后进入扣款分析和预付款批次。

**架构：** 新增一个小而专注的结算投影模块，负责把预结算流水、生产单、交出记录和后道质检事实整理成对账单可读的候选数据。对账单页面消费该投影并冻结快照；质检记录只展示来源事实；扣款分析改为消费对账单确认后的扣款行。PDA 结算只做查看、确认、申诉和收款结果展示。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `node --experimental-strip-types` / `tsx` 检查脚本。

---

## 文件结构

### 新增文件

- `src/data/fcs/factory-settlement-reconciliation.ts`
  - 结算投影核心。包含币种常量、车缝责任原因、时间段流水过滤、生产单完整性计算、后道返工数量口径、生产单反查投影。
- `scripts/check-factory-settlement-reconciliation.ts`
  - 覆盖生产单完整性、返工接收对象、责任原因、默认币种、反查结果全展示。
- `scripts/check-factory-settlement-statements.ts`
  - 覆盖对账单生成页的自定义时间段、结算对象、完整/未完整生产单展示、未完成不可纳入、金额分区。
- `scripts/check-factory-settlement-qc-boundary.ts`
  - 覆盖后道质检单、质检记录、扣款字段边界。
- `scripts/check-factory-settlement-deduction-analysis.ts`
  - 覆盖扣款分析来源为对账单确认数据。
- `scripts/check-factory-settlement-pda.ts`
  - 覆盖 PDA 结算只展示、确认、申诉，不提供核算编辑。

### 修改文件

- `package.json`
  - 增加本轮检查命令。
- `src/data/fcs/store-domain-settlement-types.ts`
  - 为对账单和对账明细补充自定义时间段、结算对象、生产单快照、扣款类型、币种字段。
- `src/data/fcs/pre-settlement-ledger-repository.ts`
  - 增加按发生时间、生产单、状态、类型过滤的查询能力；保留结算周期字段作为兼容展示。
- `src/data/fcs/store-domain-statement-source-adapter.ts`
  - 增加按时间段和结算对象构建候选项、生产单投影、对账单行和扣款分析行的适配能力。
- `src/data/fcs/store-domain-settlement-seeds.ts`
  - 对账单创建从“工厂 + 周期”扩展为“工厂 + 自定义时间段 + 结算对象”；生成时冻结快照。
- `src/pages/statements.ts`
  - 新建对账单改为三步：选范围、看反查结果、确认金额。
- `src/data/fcs/settlement-flow-boundaries.ts`
  - 更新文案和冻结规则，避免继续表达“一张对账单只能对应固定结算周期”。
- `src/data/fcs/post-finishing-domain.ts`
  - 保留后道质检事实与来源反扣事实，但停止把质检完成直接表达为正式扣款决策。
- `src/pages/process-factory/post-finishing/qc-orders.ts`
  - 后道质检单展示来源反扣，不再使用“本期扣加工费”作为质检结论。
- `src/pages/qc-records/detail-domain.ts`
  - 质检记录只展示事实和来源反扣，不提供扣款编辑入口。
- `src/pages/qc-records/list-domain.ts`
  - 列表扣款/结算标签调整为来源提示，不表达财务生效金额。
- `src/data/fcs/quality-deduction-analysis.ts`
  - 扣款分析基础行切换为对账单确认扣款行。
- `src/pages/deduction-analysis.ts`
  - 筛选项和明细文案从“质检扣款依据”调整为“对账单扣款”。
- `src/pages/pda-settlement.ts`
  - PDA 展示应付、扣款、净额、来源质检单、确认/申诉/收款状态；不展示核算编辑。

---

## 任务 0：开始前基线确认

**文件：**
- 读取：`docs/superpowers/specs/2026-07-01-factory-settlement-design.md`
- 读取：`package.json`
- 读取：`src/pages/statements.ts`
- 读取：`src/data/fcs/store-domain-statement-source-adapter.ts`

- [ ] **步骤 1：确认工作区干净**

运行：

```bash
git status --short
```

预期：没有输出，或只有与本计划执行者本轮相关的文件。

- [ ] **步骤 2：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：`Already up to date`，并显示已索引文件数。

- [ ] **步骤 3：运行当前结算相关基线检查**

运行：

```bash
npm run check:pre-settlement-ledger
npm run check:statements
npm run check:prepayment-batch
npm run check:pda-settlement-ia
npm run check:quality-deduction-analysis
npm run check:post-route-qc-recheck
```

预期：当前基线检查通过。若已有检查失败，先记录失败命令和错误文本，不要把无关失败混进本轮修改。

---

## 任务 1：新增结算投影核心与第一组检查

**文件：**
- 创建：`src/data/fcs/factory-settlement-reconciliation.ts`
- 创建：`scripts/check-factory-settlement-reconciliation.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败检查**

创建 `scripts/check-factory-settlement-reconciliation.ts`：

```typescript
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTLEMENT_CURRENCY,
  SETTLEMENT_CURRENCIES,
  SEWING_FACTORY_LIABILITY_REASONS,
  calculateProductionOrderSettlementSummary,
  isSewingFactoryLiabilityReason,
} from '../src/data/fcs/factory-settlement-reconciliation.ts'

const summary = calculateProductionOrderSettlementSummary({
  cuttingCompletedQty: 100,
  handoverLines: [
    { recordId: 'H-1', handedOverQty: 80, handedOverAt: '2026-07-01 10:00:00' },
  ],
  reworkLines: [
    { qcOrderId: 'QC-1', receiveObject: 'ORIGINAL_FACTORY', reworkQty: 10 },
    { qcOrderId: 'QC-2', receiveObject: 'POST_FACTORY', reworkQty: 20 },
  ],
  defectReasonLines: [
    { reasonName: '做工原因', qty: 3 },
    { reasonName: '布料原因', qty: 4 },
    { reasonName: '破洞', qty: 2 },
  ],
})

assert.equal(DEFAULT_SETTLEMENT_CURRENCY, 'IDR')
assert.deepEqual(SETTLEMENT_CURRENCIES, ['IDR', 'CNY', 'USD'])
assert(SEWING_FACTORY_LIABILITY_REASONS.includes('做工原因'))
assert(SEWING_FACTORY_LIABILITY_REASONS.includes('破洞'))
assert.equal(isSewingFactoryLiabilityReason('布料原因'), false)
assert.equal(summary.normalHandoverQty, 80)
assert.equal(summary.originalFactoryReworkQty, 10)
assert.equal(summary.postFactoryReworkQty, 20)
assert.equal(summary.settlementHandoverQty, 100)
assert.equal(summary.isComplete, true)
assert.equal(summary.shortageQty, 0)
assert.equal(summary.defectQty, 9)
assert.equal(summary.sewingFactoryLiabilityDefectQty, 5)

const incomplete = calculateProductionOrderSettlementSummary({
  cuttingCompletedQty: 120,
  handoverLines: [{ recordId: 'H-2', handedOverQty: 90, handedOverAt: '2026-07-02 10:00:00' }],
  reworkLines: [{ qcOrderId: 'QC-3', receiveObject: 'ORIGINAL_FACTORY', reworkQty: 10 }],
  defectReasonLines: [],
})

assert.equal(incomplete.settlementHandoverQty, 90)
assert.equal(incomplete.isComplete, false)
assert.equal(incomplete.shortageQty, 30)

console.log('check:factory-settlement-reconciliation passed')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-settlement-reconciliation.ts
```

预期：FAIL，错误包含 `Cannot find module` 或 `factory-settlement-reconciliation`。

- [ ] **步骤 3：实现最小投影核心**

创建 `src/data/fcs/factory-settlement-reconciliation.ts`：

```typescript
export const SETTLEMENT_CURRENCIES = ['IDR', 'CNY', 'USD'] as const
export type SettlementCurrency = (typeof SETTLEMENT_CURRENCIES)[number]
export const DEFAULT_SETTLEMENT_CURRENCY: SettlementCurrency = 'IDR'

export const SEWING_FACTORY_LIABILITY_REASONS = [
  '做工原因',
  '脏污',
  '抽纱',
  '做错',
  '做毁',
  '破洞',
] as const

export type ReworkReceiveObject = 'ORIGINAL_FACTORY' | 'POST_FACTORY'

export interface SettlementHandoverLine {
  recordId: string
  handedOverQty: number
  handedOverAt: string
}

export interface SettlementReworkLine {
  qcOrderId: string
  receiveObject: ReworkReceiveObject
  reworkQty: number
}

export interface SettlementDefectReasonLine {
  reasonName: string
  qty: number
}

export interface ProductionOrderSettlementSummary {
  cuttingCompletedQty: number
  normalHandoverQty: number
  originalFactoryReworkQty: number
  postFactoryReworkQty: number
  settlementHandoverQty: number
  shortageQty: number
  isComplete: boolean
  defectQty: number
  sewingFactoryLiabilityDefectQty: number
  defectReasonQtyByName: Record<string, number>
}

function sumQty<T>(items: T[], getter: (item: T) => number): number {
  return items.reduce((sum, item) => sum + Math.max(0, getter(item) || 0), 0)
}

export function isSewingFactoryLiabilityReason(reasonName: string): boolean {
  return SEWING_FACTORY_LIABILITY_REASONS.includes(reasonName as (typeof SEWING_FACTORY_LIABILITY_REASONS)[number])
}

export function calculateProductionOrderSettlementSummary(input: {
  cuttingCompletedQty: number
  handoverLines: SettlementHandoverLine[]
  reworkLines: SettlementReworkLine[]
  defectReasonLines: SettlementDefectReasonLine[]
}): ProductionOrderSettlementSummary {
  const cuttingCompletedQty = Math.max(0, input.cuttingCompletedQty || 0)
  const normalHandoverQty = sumQty(input.handoverLines, (item) => item.handedOverQty)
  const originalFactoryReworkQty = sumQty(
    input.reworkLines.filter((item) => item.receiveObject === 'ORIGINAL_FACTORY'),
    (item) => item.reworkQty,
  )
  const postFactoryReworkQty = sumQty(
    input.reworkLines.filter((item) => item.receiveObject === 'POST_FACTORY'),
    (item) => item.reworkQty,
  )
  const settlementHandoverQty = normalHandoverQty + postFactoryReworkQty
  const defectReasonQtyByName = input.defectReasonLines.reduce<Record<string, number>>((map, item) => {
    map[item.reasonName] = (map[item.reasonName] ?? 0) + Math.max(0, item.qty || 0)
    return map
  }, {})
  const defectQty = Object.values(defectReasonQtyByName).reduce((sum, qty) => sum + qty, 0)
  const sewingFactoryLiabilityDefectQty = Object.entries(defectReasonQtyByName)
    .filter(([reason]) => isSewingFactoryLiabilityReason(reason))
    .reduce((sum, [, qty]) => sum + qty, 0)

  return {
    cuttingCompletedQty,
    normalHandoverQty,
    originalFactoryReworkQty,
    postFactoryReworkQty,
    settlementHandoverQty,
    shortageQty: Math.max(cuttingCompletedQty - settlementHandoverQty, 0),
    isComplete: settlementHandoverQty === cuttingCompletedQty,
    defectQty,
    sewingFactoryLiabilityDefectQty,
    defectReasonQtyByName,
  }
}
```

- [ ] **步骤 4：增加 npm 检查命令**

修改 `package.json` 的 `scripts`：

```json
"check:factory-settlement-reconciliation": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-settlement-reconciliation.ts"
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:factory-settlement-reconciliation
```

预期：PASS，输出 `check:factory-settlement-reconciliation passed`。

- [ ] **步骤 6：Commit**

```bash
git add package.json src/data/fcs/factory-settlement-reconciliation.ts scripts/check-factory-settlement-reconciliation.ts
git commit -m "feat: add factory settlement reconciliation projection"
```

---

## 任务 2：让预结算流水支持自定义时间段

**文件：**
- 修改：`src/data/fcs/pre-settlement-ledger-repository.ts`
- 修改：`src/data/fcs/store-domain-settlement-types.ts`
- 修改：`scripts/check-factory-settlement-reconciliation.ts`

- [ ] **步骤 1：扩展检查脚本，先验证失败**

在 `scripts/check-factory-settlement-reconciliation.ts` 增加：

```typescript
import { listPreSettlementLedgers, listStatementEligiblePreSettlementLedgersByRange } from '../src/data/fcs/pre-settlement-ledger-repository.ts'

const allLedgers = listPreSettlementLedgers()
const firstOpenLedger = allLedgers.find((item) => item.status === 'OPEN')
assert(firstOpenLedger, '需要至少一条 OPEN 预结算流水作为时间段检查样例')

const ranged = listStatementEligiblePreSettlementLedgersByRange({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
})

assert(ranged.some((item) => item.ledgerId === firstOpenLedger.ledgerId))
assert(ranged.every((item) => item.factoryId === firstOpenLedger.factoryId))
assert(ranged.every((item) => item.status === 'OPEN'))
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:factory-settlement-reconciliation
```

预期：FAIL，错误包含 `listStatementEligiblePreSettlementLedgersByRange` 未导出。

- [ ] **步骤 3：扩展查询参数并保持旧调用兼容**

在 `src/data/fcs/pre-settlement-ledger-repository.ts` 增加类型和日期判断：

```typescript
export interface PreSettlementLedgerQueryOptions {
  factoryId?: string
  settlementCycleId?: string
  occurredFrom?: string
  occurredTo?: string
  productionOrderNo?: string
  ledgerType?: PreSettlementLedger['ledgerType'] | '__ALL__'
  status?: PreSettlementLedgerStatus | '__ALL__'
  keyword?: string
}

function normalizeDateOnly(value?: string): string {
  return value ? value.slice(0, 10) : ''
}

function isLedgerInOccurredRange(ledger: PreSettlementLedger, occurredFrom?: string, occurredTo?: string): boolean {
  const occurred = normalizeDateOnly(ledger.occurredAt)
  const from = normalizeDateOnly(occurredFrom)
  const to = normalizeDateOnly(occurredTo)
  if (from && occurred < from) return false
  if (to && occurred > to) return false
  return true
}
```

把 `listPreSettlementLedgers` 签名改成：

```typescript
export function listPreSettlementLedgers(options: PreSettlementLedgerQueryOptions = {}): PreSettlementLedger[] {
  const {
    factoryId,
    settlementCycleId,
    occurredFrom,
    occurredTo,
    productionOrderNo,
    ledgerType = '__ALL__',
    status = '__ALL__',
    keyword,
  } = options
  // 保留原有 all / keyword 逻辑
}
```

在 filter 中新增：

```typescript
if (!isLedgerInOccurredRange(ledger, occurredFrom, occurredTo)) return false
if (productionOrderNo && ledger.productionOrderNo !== productionOrderNo && ledger.productionOrderId !== productionOrderNo) return false
```

新增范围函数：

```typescript
export function listStatementEligiblePreSettlementLedgersByRange(options: {
  factoryId?: string
  occurredFrom?: string
  occurredTo?: string
  productionOrderNo?: string
  ledgerType?: PreSettlementLedger['ledgerType'] | '__ALL__'
}): PreSettlementLedger[] {
  return listPreSettlementLedgers({
    factoryId: options.factoryId,
    occurredFrom: options.occurredFrom,
    occurredTo: options.occurredTo,
    productionOrderNo: options.productionOrderNo,
    ledgerType: options.ledgerType ?? '__ALL__',
    status: 'OPEN',
  })
}
```

- [ ] **步骤 4：运行范围检查**

运行：

```bash
npm run check:factory-settlement-reconciliation
npm run check:pre-settlement-ledger
```

预期：两条命令 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/pre-settlement-ledger-repository.ts src/data/fcs/store-domain-settlement-types.ts scripts/check-factory-settlement-reconciliation.ts
git commit -m "feat: filter pre-settlement ledgers by custom range"
```

---

## 任务 3：补齐对账单自定义范围和生产单快照类型

**文件：**
- 修改：`src/data/fcs/store-domain-settlement-types.ts`
- 修改：`src/data/fcs/store-domain-settlement-seeds.ts`
- 修改：`scripts/check-factory-settlement-reconciliation.ts`

- [ ] **步骤 1：扩展检查脚本**

在 `scripts/check-factory-settlement-reconciliation.ts` 增加：

```typescript
import {
  createStatementFromEligibleLedgers,
  findOpenStatementByPartyAndRange,
  initialStatementDrafts,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

const statementId = 'ST-RANGE-CHECK-001'
const beforeCount = initialStatementDrafts.length
const createResult = createStatementFromEligibleLedgers({
  statementId,
  settlementPartyType: 'FACTORY',
  settlementPartyId: firstOpenLedger.factoryId,
  settlementPartyLabel: firstOpenLedger.factoryName,
  settlementRangeStartAt: firstOpenLedger.occurredAt.slice(0, 10),
  settlementRangeEndAt: firstOpenLedger.occurredAt.slice(0, 10),
  settlementObjectMode: 'LEDGER',
  settlementCurrency: 'IDR',
  itemSourceIds: [firstOpenLedger.ledgerId],
  itemBasisIds: [],
  items: [{
    sourceItemId: firstOpenLedger.ledgerId,
    sourceItemType: 'TASK_EARNING',
    basisId: firstOpenLedger.ledgerId,
    deductionQty: 0,
    deductionAmount: 0,
    currency: 'IDR',
    productionOrderNo: firstOpenLedger.productionOrderNo,
    returnInboundQty: firstOpenLedger.qty,
    earningAmount: firstOpenLedger.settlementAmount,
    qualityDeductionAmount: 0,
    netAmount: firstOpenLedger.settlementAmount,
    occurredAt: firstOpenLedger.occurredAt,
  }],
  productionOrderSettlementSnapshots: [],
  remark: 'range check',
  by: '检查脚本',
  at: '2026-07-01 18:00:00',
})

assert.equal(createResult.ok, true)
assert.equal(createResult.data?.settlementRangeStartAt, firstOpenLedger.occurredAt.slice(0, 10))
assert.equal(createResult.data?.settlementObjectMode, 'LEDGER')
assert.equal(createResult.data?.settlementCurrency, 'IDR')
assert(findOpenStatementByPartyAndRange(firstOpenLedger.factoryId, firstOpenLedger.occurredAt.slice(0, 10), firstOpenLedger.occurredAt.slice(0, 10), 'LEDGER'))
initialStatementDrafts.splice(beforeCount)
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:factory-settlement-reconciliation
```

预期：FAIL，错误包含 `settlementRangeStartAt` 或 `findOpenStatementByPartyAndRange` 不存在。

- [ ] **步骤 3：扩展结算类型**

在 `src/data/fcs/store-domain-settlement-types.ts` 增加：

```typescript
export type StatementSettlementObjectMode = 'LEDGER' | 'PRODUCTION_ORDER'
export type StatementDeductionLineType = 'QUALITY_DEFECT' | 'POST_FACTORY_REWORK_CHARGEBACK' | 'DELAY' | 'OTHER_ADJUSTMENT'

export interface StatementProductionOrderSnapshot {
  productionOrderNo: string
  cuttingCompletedQty: number
  normalHandoverQty: number
  settlementHandoverQty: number
  shortageQty: number
  isComplete: boolean
  originalFactoryReworkQty: number
  postFactoryReworkQty: number
  defectQty: number
  sewingFactoryLiabilityDefectQty: number
  defectReasonQtyByName: Record<string, number>
  includedInStatement: boolean
  excludedReason?: string
}
```

在 `StatementDraftItem` 增加：

```typescript
deductionLineType?: StatementDeductionLineType
settlementObjectMode?: StatementSettlementObjectMode
sourceConfirmedByStatement?: boolean
```

在 `StatementDraft` 增加：

```typescript
settlementRangeStartAt?: string
settlementRangeEndAt?: string
settlementObjectMode?: StatementSettlementObjectMode
productionOrderSettlementSnapshots?: StatementProductionOrderSnapshot[]
```

- [ ] **步骤 4：扩展创建函数**

在 `src/data/fcs/store-domain-settlement-seeds.ts` 增加范围查重函数：

```typescript
export function findOpenStatementByPartyAndRange(
  settlementPartyId: string,
  settlementRangeStartAt: string,
  settlementRangeEndAt: string,
  settlementObjectMode: StatementSettlementObjectMode,
): StatementDraft | null {
  return (
    initialStatementDrafts.find(
      (item) =>
        item.status !== 'CLOSED' &&
        item.settlementRangeStartAt === settlementRangeStartAt &&
        item.settlementRangeEndAt === settlementRangeEndAt &&
        item.settlementObjectMode === settlementObjectMode &&
        isSameSettlementPartyId(item.settlementPartyId, settlementPartyId),
    ) ?? null
  )
}
```

把 `createStatementFromEligibleLedgers` input 扩展为：

```typescript
settlementCycleId?: string
settlementCycleLabel?: string
settlementCycleStartAt?: string
settlementCycleEndAt?: string
settlementRangeStartAt?: string
settlementRangeEndAt?: string
settlementObjectMode?: StatementSettlementObjectMode
settlementCurrency?: string
productionOrderSettlementSnapshots?: StatementProductionOrderSnapshot[]
```

查重逻辑改为优先范围：

```typescript
const existed = input.settlementRangeStartAt && input.settlementRangeEndAt && input.settlementObjectMode
  ? findOpenStatementByPartyAndRange(
      input.settlementPartyId,
      input.settlementRangeStartAt,
      input.settlementRangeEndAt,
      input.settlementObjectMode,
    )
  : input.settlementCycleId
    ? findOpenStatementByPartyAndCycle(input.settlementPartyId, input.settlementCycleId)
    : null
```

创建 draft 时写入：

```typescript
settlementRangeStartAt: input.settlementRangeStartAt,
settlementRangeEndAt: input.settlementRangeEndAt,
settlementObjectMode: input.settlementObjectMode ?? 'LEDGER',
productionOrderSettlementSnapshots: input.productionOrderSettlementSnapshots ?? [],
settlementCurrency: input.settlementCurrency ?? snapshot.settlementConfigSnapshot.currency,
```

- [ ] **步骤 5：运行检查**

运行：

```bash
npm run check:factory-settlement-reconciliation
npm run check:statements
```

预期：两条命令 PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/store-domain-settlement-types.ts src/data/fcs/store-domain-settlement-seeds.ts scripts/check-factory-settlement-reconciliation.ts
git commit -m "feat: snapshot statement custom range"
```

---

## 任务 4：构建生产单反查投影和对账单来源适配

**文件：**
- 修改：`src/data/fcs/factory-settlement-reconciliation.ts`
- 修改：`src/data/fcs/store-domain-statement-source-adapter.ts`
- 修改：`scripts/check-factory-settlement-reconciliation.ts`

- [ ] **步骤 1：扩展检查脚本**

在 `scripts/check-factory-settlement-reconciliation.ts` 增加：

```typescript
import {
  buildProductionOrderSettlementProjections,
  buildStatementDraftLinesFromSettlementSelection,
} from '../src/data/fcs/store-domain-statement-source-adapter.ts'

const projections = buildProductionOrderSettlementProjections({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
})

assert(projections.length > 0, '按时间段反查必须展示生产单')
assert(projections.every((item) => item.productionOrderNo))
assert(projections.every((item) => typeof item.isComplete === 'boolean'))

const completedIds = projections.filter((item) => item.isComplete).map((item) => item.productionOrderNo)
const lines = buildStatementDraftLinesFromSettlementSelection({
  factoryId: firstOpenLedger.factoryId,
  occurredFrom: firstOpenLedger.occurredAt.slice(0, 10),
  occurredTo: firstOpenLedger.occurredAt.slice(0, 10),
  objectMode: 'PRODUCTION_ORDER',
  selectedProductionOrderNos: completedIds,
})

assert(lines.every((item) => completedIds.includes(item.productionOrderNo ?? '')))
assert(lines.every((item) => item.settlementObjectMode === 'PRODUCTION_ORDER'))
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:factory-settlement-reconciliation
```

预期：FAIL，错误包含新增函数未导出。

- [ ] **步骤 3：补充投影接口**

在 `src/data/fcs/factory-settlement-reconciliation.ts` 增加：

```typescript
export interface ProductionOrderSettlementProjection extends ProductionOrderSettlementSummary {
  productionOrderNo: string
  productionOrderId?: string
  includedInStatement: boolean
  excludedReason?: string
  handoverDetailLines: Array<{
    recordId: string
    handedOverAt: string
    handedOverQty: number
    qcOrderId?: string
    qualifiedQty?: number
    reworkQty?: number
    reworkReceiveObject?: ReworkReceiveObject
    defectQty?: number
    defectReasonQtyByName?: Record<string, number>
  }>
}

export function toStatementProductionOrderSnapshot(
  projection: ProductionOrderSettlementProjection,
): StatementProductionOrderSnapshot {
  return {
    productionOrderNo: projection.productionOrderNo,
    cuttingCompletedQty: projection.cuttingCompletedQty,
    normalHandoverQty: projection.normalHandoverQty,
    settlementHandoverQty: projection.settlementHandoverQty,
    shortageQty: projection.shortageQty,
    isComplete: projection.isComplete,
    originalFactoryReworkQty: projection.originalFactoryReworkQty,
    postFactoryReworkQty: projection.postFactoryReworkQty,
    defectQty: projection.defectQty,
    sewingFactoryLiabilityDefectQty: projection.sewingFactoryLiabilityDefectQty,
    defectReasonQtyByName: projection.defectReasonQtyByName,
    includedInStatement: projection.includedInStatement,
    excludedReason: projection.excludedReason,
  }
}
```

- [ ] **步骤 4：在 source adapter 中接入范围与生产单模式**

在 `src/data/fcs/store-domain-statement-source-adapter.ts` 增加：

```typescript
export function buildProductionOrderSettlementProjections(input: {
  factoryId: string
  occurredFrom: string
  occurredTo: string
}): ProductionOrderSettlementProjection[] {
  const ledgers = listStatementEligiblePreSettlementLedgersByRange({
    factoryId: input.factoryId,
    occurredFrom: input.occurredFrom,
    occurredTo: input.occurredTo,
  })
  const productionOrderNos = Array.from(new Set(ledgers.map((item) => item.productionOrderNo).filter(Boolean))) as string[]

  return productionOrderNos.map((productionOrderNo) => {
    const orderLedgers = ledgers.filter((item) => item.productionOrderNo === productionOrderNo)
    const normalHandoverQty = orderLedgers
      .filter((item) => item.ledgerType === 'TASK_EARNING')
      .reduce((sum, item) => sum + item.qty, 0)
    const cuttingCompletedQty = resolveCuttingCompletedQty(productionOrderNo, normalHandoverQty)
    const summary = calculateProductionOrderSettlementSummary({
      cuttingCompletedQty,
      handoverLines: orderLedgers.map((item) => ({
        recordId: item.returnInboundBatchNo ?? item.ledgerId,
        handedOverAt: item.occurredAt,
        handedOverQty: item.ledgerType === 'TASK_EARNING' ? item.qty : 0,
      })),
      reworkLines: resolvePostFinishingReworkLines(productionOrderNo),
      defectReasonLines: resolvePostFinishingDefectReasonLines(productionOrderNo),
    })

    return {
      productionOrderNo,
      ...summary,
      includedInStatement: summary.isComplete,
      excludedReason: summary.isComplete ? undefined : `差 ${summary.shortageQty} 件`,
      handoverDetailLines: orderLedgers.map((item) => ({
        recordId: item.returnInboundBatchNo ?? item.ledgerId,
        handedOverAt: item.occurredAt,
        handedOverQty: item.qty,
      })),
    }
  })
}
```

同文件新增按选择生成对账单行：

```typescript
export function buildStatementDraftLinesFromSettlementSelection(input: {
  factoryId: string
  occurredFrom: string
  occurredTo: string
  objectMode: StatementSettlementObjectMode
  selectedLedgerIds?: string[]
  selectedProductionOrderNos?: string[]
}): StatementDraftItem[] {
  const ledgers = listStatementEligiblePreSettlementLedgersByRange({
    factoryId: input.factoryId,
    occurredFrom: input.occurredFrom,
    occurredTo: input.occurredTo,
  })
  const selected = input.objectMode === 'LEDGER'
    ? ledgers.filter((item) => !input.selectedLedgerIds?.length || input.selectedLedgerIds.includes(item.ledgerId))
    : ledgers.filter((item) => input.selectedProductionOrderNos?.includes(item.productionOrderNo ?? ''))

  return selected.map((ledger) => ({
    ...toStatementDraftItemFromSource(mapLedgerToStatementSourceItem(ledger, getStatementBindingMap())),
    settlementObjectMode: input.objectMode,
    sourceConfirmedByStatement: true,
  }))
}
```

`resolveCuttingCompletedQty` 先用现有 `productionOrders` 数据能取到的裁片完成字段；取不到时用任务收入数量作为原型兜底，并在页面显示来源提示。不要新增真实后端。

- [ ] **步骤 5：运行检查**

运行：

```bash
npm run check:factory-settlement-reconciliation
npm run check:statements
```

预期：两条命令 PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/factory-settlement-reconciliation.ts src/data/fcs/store-domain-statement-source-adapter.ts scripts/check-factory-settlement-reconciliation.ts
git commit -m "feat: build production order settlement projections"
```

---

## 任务 5：改造对账单生成页

**文件：**
- 修改：`src/pages/statements.ts`
- 创建：`scripts/check-factory-settlement-statements.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写页面检查脚本**

创建 `scripts/check-factory-settlement-statements.ts`：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderStatementsPage } from '../src/pages/statements.ts'

const source = readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
const html = renderStatementsPage()

for (const token of [
  'data-stm-build-field="start-date"',
  'data-stm-build-field="end-date"',
  'data-stm-build-field="object-mode"',
  'data-stm-build-field="currency"',
  '按预结算流水',
  '按生产单',
  '反查生产单',
  '未完成，不纳入本期对账',
  '差 ',
  '裁片完成数量',
  '结算口径累计交出',
  '后道返工反扣',
  '本期应付净额',
]) {
  assert(source.includes(token) || html.includes(token), `缺少对账单生成口径：${token}`)
}

assert(!source.includes('必须先选工厂和结算周期，再自动加载该范围内的回货批次明细行'))
assert(source.includes('buildStatementDraftLinesFromSettlementSelection'))
assert(source.includes('buildProductionOrderSettlementProjections'))

console.log('check:factory-settlement-statements passed')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-settlement-statements.ts
```

预期：FAIL，错误指出缺少 `start-date` 或 `按生产单`。

- [ ] **步骤 3：扩展页面状态**

在 `src/pages/statements.ts` 的 `StatementsState` 增加：

```typescript
buildStartDate: string
buildEndDate: string
buildObjectMode: StatementSettlementObjectMode
buildCurrency: SettlementCurrency
selectedLedgerIds: string[]
selectedProductionOrderNos: string[]
```

在 `state` 初始值中写：

```typescript
buildStartDate: '',
buildEndDate: '',
buildObjectMode: 'PRODUCTION_ORDER',
buildCurrency: 'IDR',
selectedLedgerIds: [],
selectedProductionOrderNos: [],
```

- [ ] **步骤 4：替换“选周期”为“选范围”**

在 `renderBuildView` 中把原“步骤 1：选择工厂与结算周期”替换为：

```typescript
<h3 class="text-sm font-semibold">步骤 1：选择工厂、时间段和结算对象</h3>
<div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
  <label class="grid gap-1 text-sm">
    <span class="text-muted-foreground">工厂</span>
    <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="factory" ${editingDraft ? 'disabled' : ''}>
      <option value="">请选择工厂</option>
      ${factoryOptions.map((item) => `<option value="${escapeHtml(item.value)}" ${state.buildFactoryId === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
    </select>
  </label>
  <label class="grid gap-1 text-sm">
    <span class="text-muted-foreground">开始日期</span>
    <input type="date" class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="start-date" value="${escapeHtml(state.buildStartDate)}" />
  </label>
  <label class="grid gap-1 text-sm">
    <span class="text-muted-foreground">结束日期</span>
    <input type="date" class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="end-date" value="${escapeHtml(state.buildEndDate)}" />
  </label>
  <label class="grid gap-1 text-sm">
    <span class="text-muted-foreground">结算对象</span>
    <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="object-mode">
      <option value="PRODUCTION_ORDER" ${state.buildObjectMode === 'PRODUCTION_ORDER' ? 'selected' : ''}>按生产单</option>
      <option value="LEDGER" ${state.buildObjectMode === 'LEDGER' ? 'selected' : ''}>按预结算流水</option>
    </select>
  </label>
  <label class="grid gap-1 text-sm">
    <span class="text-muted-foreground">币种</span>
    <select class="h-9 rounded-md border bg-background px-3 text-sm" data-stm-build-field="currency">
      ${SETTLEMENT_CURRENCIES.map((currency) => `<option value="${currency}" ${state.buildCurrency === currency ? 'selected' : ''}>${currency}</option>`).join('')}
    </select>
  </label>
</div>
```

- [ ] **步骤 5：增加反查生产单区块**

新增渲染函数：

```typescript
function renderProductionOrderProjectionPanel(projections: ProductionOrderSettlementProjection[]): string {
  if (state.buildObjectMode !== 'PRODUCTION_ORDER') return ''
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">步骤 2：反查生产单</h3>
          <p class="mt-1 text-xs text-muted-foreground">全部展示反查结果；未完成生产单不进入本期对账。</p>
        </div>
        <div class="text-xs text-muted-foreground">已完成 ${projections.filter((item) => item.isComplete).length} 张 / 未完成 ${projections.filter((item) => !item.isComplete).length} 张</div>
      </div>
      <div class="mt-3 space-y-2">
        ${projections.map((item) => renderProductionOrderProjectionRow(item)).join('')}
      </div>
    </section>
  `
}
```

`renderProductionOrderProjectionRow` 必须展示：裁片完成数量、结算口径累计交出、原工厂返工、后道工厂返工、瑕疵总数、车缝责任瑕疵、差额。

- [ ] **步骤 6：更新事件处理**

在 `handleStatementsEvent` 的 build field 分支新增：

```typescript
if (field === 'start-date' && buildFieldNode instanceof HTMLInputElement) {
  state.buildStartDate = buildFieldNode.value
  state.selectedLedgerIds = []
  state.selectedProductionOrderNos = []
  return true
}
if (field === 'end-date' && buildFieldNode instanceof HTMLInputElement) {
  state.buildEndDate = buildFieldNode.value
  state.selectedLedgerIds = []
  state.selectedProductionOrderNos = []
  return true
}
if (field === 'object-mode' && buildFieldNode instanceof HTMLSelectElement) {
  state.buildObjectMode = buildFieldNode.value as StatementSettlementObjectMode
  state.selectedLedgerIds = []
  state.selectedProductionOrderNos = []
  return true
}
if (field === 'currency' && buildFieldNode instanceof HTMLSelectElement) {
  state.buildCurrency = buildFieldNode.value as SettlementCurrency
  return true
}
```

- [ ] **步骤 7：更新生成逻辑**

`generate` action 使用 `buildStatementDraftLinesFromSettlementSelection`，并传入：

```typescript
const lines = buildStatementDraftLinesFromSettlementSelection({
  factoryId: state.buildFactoryId,
  occurredFrom: state.buildStartDate,
  occurredTo: state.buildEndDate,
  objectMode: state.buildObjectMode,
  selectedLedgerIds: state.selectedLedgerIds,
  selectedProductionOrderNos: state.selectedProductionOrderNos,
})
```

按生产单时，如果 `selectedProductionOrderNos` 为空，默认选择 `projections.filter((item) => item.isComplete)`。

- [ ] **步骤 8：运行页面检查**

运行：

```bash
npm run check:factory-settlement-statements
npm run check:statements
```

预期：两条命令 PASS。

- [ ] **步骤 9：Commit**

```bash
git add package.json src/pages/statements.ts scripts/check-factory-settlement-statements.ts
git commit -m "feat: show custom range statement builder"
```

---

## 任务 6：拆清后道质检单和质检记录的扣款边界

**文件：**
- 修改：`src/data/fcs/post-finishing-domain.ts`
- 修改：`src/pages/process-factory/post-finishing/qc-orders.ts`
- 修改：`src/pages/qc-records/detail-domain.ts`
- 修改：`src/pages/qc-records/list-domain.ts`
- 创建：`scripts/check-factory-settlement-qc-boundary.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写边界检查脚本**

创建 `scripts/check-factory-settlement-qc-boundary.ts`：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const postDomain = readFileSync(new URL('../src/data/fcs/post-finishing-domain.ts', import.meta.url), 'utf8')
const postQcPage = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-orders.ts', import.meta.url), 'utf8')
const qcDetail = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')

assert(postQcPage.includes('来源反扣'))
assert(postQcPage.includes('对账单确认后生效'))
assert(!postQcPage.includes('本期扣加工费数量'))
assert(!postQcPage.includes('请填写每件扣款金额'))

assert(!qcDetail.includes('data-qcd-field="deductionDecision"'))
assert(!qcDetail.includes('data-qcd-field="deductionAmount"'))
assert(!qcDetail.includes('扣款金额（元）'))
assert(qcDetail.includes('来源反扣'))
assert(qcDetail.includes('质检事实'))

assert(!postDomain.includes("deductionDecision = hasDefect ? input.deductionDecision || qc.deductionDecision || '建议扣款'"))
assert(postDomain.includes('sourceChargeback'))

console.log('check:factory-settlement-qc-boundary passed')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-settlement-qc-boundary.ts
```

预期：FAIL，错误指出仍存在旧扣款字段或缺少 `来源反扣`。

- [ ] **步骤 3：后道质检单保留来源反扣事实**

在 `src/data/fcs/post-finishing-domain.ts` 增加来源反扣命名，不急着删除旧字段，避免大范围破坏 mock：

```typescript
export interface PostFinishingQcSourceChargeback {
  currency: 'IDR'
  unitAmount: number
  amount: number
  reason: '后道工厂接收返工'
}
```

在 `PostFinishingQcSkuResult` 增加：

```typescript
sourceChargeback?: PostFinishingQcSourceChargeback
```

在 normalize 逻辑中保留原计算，但写入 `sourceChargeback`：

```typescript
const sourceChargeback = reworkDeductionAmountIdr > 0
  ? {
      currency: 'IDR' as const,
      unitAmount: reworkDeductionUnitAmountIdr,
      amount: reworkDeductionAmountIdr,
      reason: '后道工厂接收返工' as const,
    }
  : undefined
```

在 `completePostFinishingQcOrder` 中把扣款决策写回改为事实说明：

```typescript
qc.deductionDecision = ''
qc.deductionDecisionRemark = hasDefect ? '质检记录只展示事实；扣款由对账单确认。' : ''
```

- [ ] **步骤 4：调整后道质检页面文案**

在 `src/pages/process-factory/post-finishing/qc-orders.ts`：

- 将 `每件扣款金额（印尼盾）` 改为 `来源反扣单价（IDR）`。
- 将 `返工扣款金额` 改为 `来源反扣金额`。
- 将 `本期扣加工费数量` 改为 `后道接收返工数量`。
- 删除“返工接收工厂不是原工厂必须填写每件扣款金额”的硬校验。

关键替换片段：

```typescript
<span class="text-xs text-muted-foreground">来源反扣单价（IDR）</span>
```

说明文案：

```typescript
<p class="text-xs text-muted-foreground">来源反扣仅作为质检事实展示，对账单确认后才影响本期应付。</p>
```

- [ ] **步骤 5：调整质检记录详情页**

在 `src/pages/qc-records/detail-domain.ts`：

- 删除或隐藏“责任判定与扣款决定（结构化）”编辑表单。
- 删除 `data-qcd-field="deductionDecision"` 和 `data-qcd-field="deductionAmount"`。
- 概览卡从 `扣款与结算概况` 改为 `质检事实与来源反扣`。
- 保留来源质检单、来源反扣金额、来源反扣说明。

新增展示片段：

```typescript
${renderOverviewCard(
  '质检事实与来源反扣',
  [
    { label: '质检数量', value: String(qcRecord.inspectedQty) },
    { label: '合格 / 不合格', value: `${qcRecord.qualifiedQty} / ${qcRecord.unqualifiedQty}` },
    { label: '来源反扣', value: formatMoney(settlementImpact.effectiveQualityDeductionAmount) },
    { label: '财务生效', value: '以对账单确认为准' },
  ],
  '质检记录不编辑扣款金额，仅展示来源事实。',
)}
```

- [ ] **步骤 6：运行检查**

运行：

```bash
npm run check:factory-settlement-qc-boundary
npm run check:post-route-qc-recheck
npm run check:quality-deduction-domain
```

预期：三条命令 PASS。

- [ ] **步骤 7：Commit**

```bash
git add package.json src/data/fcs/post-finishing-domain.ts src/pages/process-factory/post-finishing/qc-orders.ts src/pages/qc-records/detail-domain.ts src/pages/qc-records/list-domain.ts scripts/check-factory-settlement-qc-boundary.ts
git commit -m "feat: separate qc facts from settlement deductions"
```

---

## 任务 7：扣款分析改为对账单确认口径

**文件：**
- 修改：`src/data/fcs/store-domain-statement-source-adapter.ts`
- 修改：`src/data/fcs/quality-deduction-analysis.ts`
- 修改：`src/pages/deduction-analysis.ts`
- 创建：`scripts/check-factory-settlement-deduction-analysis.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写检查脚本**

创建 `scripts/check-factory-settlement-deduction-analysis.ts`：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildQualityDeductionDetails,
  createDefaultQualityDeductionAnalysisQuery,
} from '../src/data/fcs/quality-deduction-analysis.ts'

const source = readFileSync(new URL('../src/data/fcs/quality-deduction-analysis.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/deduction-analysis.ts', import.meta.url), 'utf8')
const rows = buildQualityDeductionDetails(createDefaultQualityDeductionAnalysisQuery())

assert(source.includes('listStatementConfirmedDeductionRows'))
assert(page.includes('对账单扣款'))
assert(page.includes('扣款类型'))
assert(rows.every((row) => row.includedSettlementStatementId), '扣款分析明细必须来自对账单确认行')
assert(rows.every((row) => row.effectiveQualityDeductionAmount >= 0))

console.log('check:factory-settlement-deduction-analysis passed')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-settlement-deduction-analysis.ts
```

预期：FAIL，错误包含缺少 `listStatementConfirmedDeductionRows` 或 `对账单扣款`。

- [ ] **步骤 3：输出对账单确认扣款行**

在 `src/data/fcs/store-domain-statement-source-adapter.ts` 增加：

```typescript
export interface StatementConfirmedDeductionRow {
  statementId: string
  statementNo: string
  factoryId: string
  factoryName: string
  productionOrderNo?: string
  deductionLineType: StatementDeductionLineType
  deductionLineTypeLabel: string
  reasonName?: string
  qty: number
  amount: number
  currency: string
  occurredAt: string
  sourceQcRecordId?: string
  sourceRefLabel?: string
  includedPrepaymentBatchId?: string
}

const DEDUCTION_LINE_TYPE_LABEL: Record<StatementDeductionLineType, string> = {
  QUALITY_DEFECT: '质量扣款',
  POST_FACTORY_REWORK_CHARGEBACK: '后道返工反扣',
  DELAY: '延误扣款',
  OTHER_ADJUSTMENT: '其他调整',
}

export function listStatementConfirmedDeductionRows(): StatementConfirmedDeductionRow[] {
  return initialStatementDrafts.flatMap((statement) =>
    statement.items
      .filter((item) => (item.qualityDeductionAmount ?? 0) > 0 || item.deductionLineType)
      .map((item) => {
        const type = item.deductionLineType ?? 'QUALITY_DEFECT'
        return {
          statementId: statement.statementId,
          statementNo: statement.statementNo ?? statement.statementId,
          factoryId: statement.settlementPartyId,
          factoryName: statement.factoryName ?? buildPartyLabel(statement.settlementPartyType, statement.settlementPartyId),
          productionOrderNo: item.productionOrderNo,
          deductionLineType: type,
          deductionLineTypeLabel: DEDUCTION_LINE_TYPE_LABEL[type],
          reasonName: item.remark,
          qty: item.deductionQty ?? item.returnInboundQty ?? 0,
          amount: Math.abs(item.qualityDeductionAmount ?? item.deductionAmount ?? item.netAmount ?? 0),
          currency: item.currency ?? statement.settlementCurrency ?? statement.settlementProfileSnapshot.settlementConfigSnapshot.currency,
          occurredAt: item.occurredAt ?? statement.createdAt,
          sourceQcRecordId: item.qcRecordId,
          sourceRefLabel: item.sourceRefLabel,
          includedPrepaymentBatchId: statement.prepaymentBatchId,
        }
      }),
  )
}
```

- [ ] **步骤 4：重定向扣款分析基础行**

在 `src/data/fcs/quality-deduction-analysis.ts`：

- 引入 `listStatementConfirmedDeductionRows`。
- `createBaseRows` 改为从对账单确认扣款行生成。
- 字段名可沿用 `QualityDeductionAnalysisDetailRow`，但 `detailSummary` 要表达对账单来源。

核心片段：

```typescript
function createBaseRows(query: QualityDeductionAnalysisQuery): AnalysisRowBase[] {
  return listStatementConfirmedDeductionRows().map((row) => ({
    qcId: row.sourceQcRecordId ?? row.statementId,
    qcNo: row.sourceRefLabel ?? row.statementNo,
    basisId: row.statementId,
    productionOrderNo: row.productionOrderNo ?? '—',
    returnInboundBatchNo: row.sourceRefLabel ?? '—',
    factoryId: row.factoryId,
    factoryName: row.factoryName,
    warehouseId: '',
    warehouseName: '—',
    processType: row.deductionLineType,
    processLabel: row.deductionLineTypeLabel,
    qcResult: 'PARTIAL_UNQUALIFIED',
    qcResultLabel: row.deductionLineTypeLabel,
    liabilityStatus: 'FACTORY_LIABILITY',
    liabilityStatusLabel: '对账单确认',
    factoryResponseStatus: 'CONFIRMED',
    factoryResponseStatusLabel: '对账单确认',
    disputeStatus: 'NONE',
    disputeStatusLabel: '无异议',
    settlementImpactStatus: 'INCLUDED_IN_STATEMENT',
    settlementImpactStatusLabel: '已进入对账单',
    inspectedQty: row.qty,
    qualifiedQty: 0,
    unqualifiedQty: row.qty,
    factoryLiabilityQty: row.qty,
    blockedProcessingFeeAmount: 0,
    effectiveQualityDeductionAmount: row.amount,
    totalFinancialImpactAmount: row.amount,
    hasAdjustment: false,
    adjustmentAmount: 0,
    adjustmentAmountSigned: 0,
    includedSettlementStatementId: row.statementId,
    includedSettlementBatchId: row.includedPrepaymentBatchId,
    financialEffectiveAt: row.occurredAt,
    settlementCycleAt: row.occurredAt,
    settlementCycleLabel: row.statementNo,
    displayTimeLabel: row.occurredAt.slice(0, 10),
    detailSummary: `${row.deductionLineTypeLabel} · ${row.amount} ${row.currency}`,
    qcHref: row.sourceQcRecordId ? `/fcs/quality/qc-records/${encodeURIComponent(row.sourceQcRecordId)}` : '/fcs/settlement/statements',
    deductionHref: `/fcs/settlement/statements?statement=${encodeURIComponent(row.statementId)}`,
    timeBucketKey: row.occurredAt.slice(0, 10),
  }))
}
```

- [ ] **步骤 5：调整页面文案**

在 `src/pages/deduction-analysis.ts`：

- 标题下说明改为 `用于分析对账单中业务已确认的扣款、反扣、延误和其他调整。`
- 明细按钮从 `查看扣款依据` 改为 `查看对账单`。
- 筛选标签中增加或复用 `扣款类型` 文案。

- [ ] **步骤 6：运行检查**

运行：

```bash
npm run check:factory-settlement-deduction-analysis
npm run check:quality-deduction-analysis
```

预期：两条命令 PASS。

- [ ] **步骤 7：Commit**

```bash
git add package.json src/data/fcs/store-domain-statement-source-adapter.ts src/data/fcs/quality-deduction-analysis.ts src/pages/deduction-analysis.ts scripts/check-factory-settlement-deduction-analysis.ts
git commit -m "feat: analyze deductions from confirmed statements"
```

---

## 任务 8：同步预付款批次和工厂端 PDA 结算

**文件：**
- 修改：`src/pages/batches.ts`
- 修改：`src/pages/pda-settlement.ts`
- 创建：`scripts/check-factory-settlement-pda.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写 PDA 与批次检查**

创建 `scripts/check-factory-settlement-pda.ts`：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pda = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
const batches = readFileSync(new URL('../src/pages/batches.ts', import.meta.url), 'utf8')

for (const token of ['应付', '扣款', '本期净额', '来源质检单', '确认对账单', '发起申诉', '打款结果']) {
  assert(pda.includes(token), `PDA 结算缺少：${token}`)
}

for (const forbidden of ['data-pda-sett-field="deduction-amount"', 'data-pda-sett-field="currency"', '修改扣款金额']) {
  assert(!pda.includes(forbidden), `PDA 不允许核算编辑：${forbidden}`)
}

assert(batches.includes('只消费已确认可付款对账单') || batches.includes('已确认可付款对账单'))
assert(batches.includes('锁账') || batches.includes('金额锁定'))

console.log('check:factory-settlement-pda passed')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-settlement-pda.ts
```

预期：FAIL，错误指出缺少新文案。

- [ ] **步骤 3：调整预付款批次说明**

在 `src/pages/batches.ts` 的批次列表或详情说明区增加短文案：

```typescript
<p class="mt-1 text-xs text-muted-foreground">预付款批次只消费已确认可付款对账单；入批后金额锁定，差异通过后续调整处理。</p>
```

- [ ] **步骤 4：调整 PDA 结算卡片**

在 `src/pages/pda-settlement.ts`：

- 总览卡优先显示应付、扣款、本期净额。
- 对账单明细展示来源质检单和扣款原因。
- 操作只保留确认对账单、发起申诉、查看打款结果。

卡片片段：

```typescript
${renderCard(
  '本期金额',
  `
    ${renderRow('应付', formatAmount(summary.taskEarningAmount), { bold: true })}
    ${renderRow('扣款', summary.qualityDeductionAmount > 0 ? formatAmount(summary.qualityDeductionAmount) : '—', { red: summary.qualityDeductionAmount > 0 })}
    ${renderRow('本期净额', formatAmount(summary.netPayableAmount), { bold: true })}
  `,
)}
```

动作按钮必须用文字：

```typescript
<button class="inline-flex h-10 items-center rounded-md border px-3 text-xs" data-pda-sett-action="confirm-statement">确认对账单</button>
<button class="inline-flex h-10 items-center rounded-md border px-3 text-xs" data-pda-sett-action="open-statement-appeal">发起申诉</button>
<button class="inline-flex h-10 items-center rounded-md border px-3 text-xs" data-pda-sett-action="open-payment-result">打款结果</button>
```

- [ ] **步骤 5：运行检查**

运行：

```bash
npm run check:factory-settlement-pda
npm run check:pda-settlement-ia
npm run check:pda-settlement-ledger
npm run check:prepayment-batch
```

预期：四条命令 PASS。

- [ ] **步骤 6：Commit**

```bash
git add package.json src/pages/batches.ts src/pages/pda-settlement.ts scripts/check-factory-settlement-pda.ts
git commit -m "feat: align pda settlement with statement confirmation"
```

---

## 任务 9：更新结算边界文案和综合验收

**文件：**
- 修改：`src/data/fcs/settlement-flow-boundaries.ts`
- 修改：`package.json`

- [ ] **步骤 1：增加总检查命令**

在 `package.json` 增加：

```json
"check:factory-settlement": "npm run check:factory-settlement-reconciliation && npm run check:factory-settlement-statements && npm run check:factory-settlement-qc-boundary && npm run check:factory-settlement-deduction-analysis && npm run check:factory-settlement-pda"
```

- [ ] **步骤 2：更新边界文案**

在 `src/data/fcs/settlement-flow-boundaries.ts`：

- 对账单定义改为 `一个工厂在自定义时间段内的正式对账对象`。
- 预结算流水定义改为 `对账单候选来源`。
- 冻结规则 `statementBoundary` 改为：

```typescript
statementBoundary: '一张对账单对应一个工厂、一个自定义结算时间段和一个结算对象；按生产单结算时，未完整生产单整张不进入本期对账。',
```

- Canonical chain 保持主链，但把 `结算周期` 表达改成 `自定义时间段`。

- [ ] **步骤 3：运行本轮总检查**

运行：

```bash
npm run check:factory-settlement
```

预期：PASS，最后输出每个子检查的 passed 文案。

- [ ] **步骤 4：运行回归检查**

运行：

```bash
npm run check:pre-settlement-ledger
npm run check:statements
npm run check:prepayment-batch
npm run check:pda-settlement-ia
npm run check:pda-settlement-ledger
npm run check:quality-deduction-analysis
npm run check:post-route-qc-recheck
npm run build
```

预期：全部 PASS，`npm run build` 成功生成 Vite 构建。

- [ ] **步骤 5：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：`Already up to date`，状态正常。

- [ ] **步骤 6：Commit**

```bash
git add package.json src/data/fcs/settlement-flow-boundaries.ts
git commit -m "chore: add factory settlement acceptance checks"
```

---

## 任务 10：浏览器验收

**文件：**
- 读取：`src/pages/statements.ts`
- 读取：`src/pages/deduction-analysis.ts`
- 读取：`src/pages/pda-settlement.ts`

- [ ] **步骤 1：启动本地服务**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

预期：Vite 服务启动，终端显示 `Local` 和 `Network` 地址。

- [ ] **步骤 2：验证路由可达**

运行：

```bash
curl -I http://127.0.0.1:5173/fcs/settlement/statements
curl -I http://127.0.0.1:5173/fcs/quality/deduction-analysis
curl -I http://127.0.0.1:5173/fcs/pda/settlement
```

预期：每条返回 `HTTP/1.1 200 OK` 或 Vite SPA 的 200 响应。

- [ ] **步骤 3：浏览器人工核查对账单生成页**

打开：

```text
http://127.0.0.1:5173/fcs/settlement/statements
```

验收：

- 新建对账单能看到工厂、开始日期、结束日期、结算对象、币种。
- 结算对象能在按生产单和按预结算流水间切换。
- 按生产单时能看到反查生产单列表。
- 未完成生产单显示“不纳入本期对账”和差额。
- 金额分区显示应付加工费、质量扣款、后道返工反扣、延误扣款、其他调整、本期应付净额。

- [ ] **步骤 4：浏览器人工核查扣款分析**

打开：

```text
http://127.0.0.1:5173/fcs/quality/deduction-analysis
```

验收：

- 页面文案说明来源是对账单扣款。
- 明细行能跳转或指向对账单。
- 未确认质检事实不作为财务扣款金额展示。

- [ ] **步骤 5：浏览器人工核查 PDA 结算**

打开：

```text
http://127.0.0.1:5173/fcs/pda/settlement
```

验收：

- 首屏优先展示应付、扣款、本期净额。
- 操作按钮为明确文字。
- 看不到扣款金额或币种编辑入口。

- [ ] **步骤 6：最终状态确认**

运行：

```bash
git status --short
```

预期：没有未提交的实现文件。

