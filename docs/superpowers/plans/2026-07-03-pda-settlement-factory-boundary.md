# PDA 结算工厂端边界实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 PDA 结算改成工厂端可理解的入口页：收入、对账单、质检记录、结算资料，并去掉 PDA 上的平台内部结算对象。

**架构：** 不新建 PDA 结算模型。继续用 `src/pages/pda-settlement.ts` 消费现有对账单、结算资料和质检事实数据；质检事实复用桌面质检记录的 `fact-view`，保证 Web/PDA 口径一致。旧的“结算周期 / 正式流水 / 对账与预付款”Tab 删除，过时检查脚本统一收口到新的 PDA 边界检查。

**技术栈：** Vite、TypeScript、Vanilla TS 字符串模板、现有 Mock 数据、现有 `node --experimental-strip-types` 检查脚本。

---

## 文件结构

- 修改：`src/pages/pda-settlement.ts`
  - 保留 PDA 权限、对账单确认/申诉、结算资料抽屉。
  - 删除独立正式流水 Tab、预付款批次流程表达和付款申请表达。
  - 新增首页卡片、对账单列表、质检记录列表、质检详情抽屉。
- 修改：`scripts/check-factory-settlement-pda.ts`
  - 改成新的唯一 PDA 结算边界检查。
- 修改：`scripts/check-pda-settlement-ia.ts`
  - 删除旧 IA 断言，代理到新的 PDA 结算边界检查。
- 修改：`scripts/check-pda-settlement-ledger.ts`
  - 删除旧正式流水 Tab 断言，代理到新的 PDA 结算边界检查。
- 修改：`scripts/check-pda-settlement-profile.ts`
  - 删除旧预付款批次版本断言，代理到新的 PDA 结算边界检查。
- 修改：`scripts/check-pda-settlement-task-links.ts`
  - 删除旧飞书付款审批、打款回写、预付款批次动作断言，代理到新的 PDA 结算边界检查。

不修改 `package.json`。保留现有 npm script 名称，让旧命令继续可跑。

## 任务 1：先改 PDA 结算检查脚本

**文件：**
- 修改：`scripts/check-factory-settlement-pda.ts`
- 修改：`scripts/check-pda-settlement-ia.ts`
- 修改：`scripts/check-pda-settlement-ledger.ts`
- 修改：`scripts/check-pda-settlement-profile.ts`
- 修改：`scripts/check-pda-settlement-task-links.ts`

- [ ] **步骤 1：替换主检查脚本**

将 `scripts/check-factory-settlement-pda.ts` 替换为：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'

import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listSettlementStatementsByParty } from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { listQcFactRows } from '../src/pages/qc-records/fact-view.ts'

const pda = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')

function assertIncludes(source: string, token: string): void {
  assert.ok(source.includes(token), `PDA 结算缺少：${token}`)
}

function assertNotIncludes(source: string, token: string): void {
  assert.equal(source.includes(token), false, `PDA 结算不应出现：${token}`)
}

for (const token of [
  "type SettlementPageMode = 'home' | 'statement-list' | 'quality-list'",
  "type StatementFilterView = 'all' | 'pending-confirm' | 'disputing' | 'unpaid' | 'paid'",
  "type QualityRecordFilterView = 'all' | 'not-in-statement' | 'in-statement' | 'rework' | 'deducted'",
  'function buildSettlementHomeViewModel(',
  'function renderSettlementHomePage(',
  'function renderStatementListPage(',
  'function renderQualityRecordListPage(',
  'function renderQualityRecordDrawer(',
  '累计收入',
  '累计扣款',
  '已付款',
  '未付款',
  '未结算',
  '参考金额',
  '对账单',
  '质检记录',
  '结算资料',
  '结算明细',
  'data-pda-sett-action="open-statement-list"',
  'data-pda-sett-action="open-quality-list"',
  'data-pda-sett-action="open-settlement-profile"',
  'data-pda-sett-action="open-quality-record-detail"',
  'listQcFactRows',
  'hasPdaSettlementPermission',
  'SETTLEMENT_VIEW',
  'SETTLEMENT_CONFIRM',
  'SETTLEMENT_DISPUTE',
  'SETTLEMENT_CHANGE_REQUEST',
]) {
  assertIncludes(pda, token)
}

for (const token of [
  'type DetailTab =',
  'LedgerTypeView',
  'LedgerStatusView',
  'renderLedgersTab',
  'renderLedgerDrawer',
  '正式流水查看区',
  '对账与预付款',
  '预付款批次',
  '飞书付款审批编号',
  '申请付款',
  '打款回写',
  'data-batch-action=',
  'open-statement-payment',
]) {
  assertNotIncludes(pda, token)
}

const factoriesWithStatements = indonesiaFactories.filter((factory) => listSettlementStatementsByParty(factory.id).length > 0)
assert.ok(factoriesWithStatements.length > 0, '缺少 PDA 对账单样例')

const statements = factoriesWithStatements.flatMap((factory) => listSettlementStatementsByParty(factory.id))
assert.ok(statements.some((statement) => statement.factoryFeedbackStatus === 'WAIT_FACTORY_CONFIRM'), '缺少待确认对账单样例')
assert.ok(statements.some((statement) => statement.factoryFeedbackStatus === 'FACTORY_APPEALED'), '缺少异议中对账单样例')
assert.ok(statements.some((statement) => statement.prepaidAt || statement.paymentWritebackId || statement.status === 'PREPAID'), '缺少已付款对账单样例')
assert.ok(statements.some((statement) => !(statement.prepaidAt || statement.paymentWritebackId || statement.status === 'PREPAID')), '缺少未付款对账单样例')

const qcRows = listQcFactRows({ includeLegacy: false })
assert.ok(qcRows.some((row) => row.settlementTrace.statusLabel === '已进入对账' && row.settlementTrace.statementNo), '缺少已进对账质检记录样例')
assert.ok(qcRows.some((row) => row.settlementTrace.statusLabel !== '已进入对账'), '缺少未进对账质检记录样例')
assert.ok(qcRows.some((row) => row.reworkQty > 0), '缺少有返工质检记录样例')
assert.ok(qcRows.some((row) => row.reworkChargebackAmountText !== '—'), '缺少有扣款质检记录样例')

console.log('check:factory-settlement-pda passed')
```

- [ ] **步骤 2：让旧检查脚本代理到新检查**

将下面 4 个文件全部替换为同一行：

- `scripts/check-pda-settlement-ia.ts`
- `scripts/check-pda-settlement-ledger.ts`
- `scripts/check-pda-settlement-profile.ts`
- `scripts/check-pda-settlement-task-links.ts`

```typescript
import './check-factory-settlement-pda.ts'
```

- [ ] **步骤 3：运行检查并确认失败**

运行：

```bash
npm run check:factory-settlement-pda
```

预期：FAIL，至少报出 `PDA 结算缺少：type SettlementPageMode = 'home' | 'statement-list' | 'quality-list'`。

- [ ] **步骤 4：Commit**

```bash
git add scripts/check-factory-settlement-pda.ts scripts/check-pda-settlement-ia.ts scripts/check-pda-settlement-ledger.ts scripts/check-pda-settlement-profile.ts scripts/check-pda-settlement-task-links.ts
git commit -m "test: update pda settlement boundary checks"
```

## 任务 2：收口 PDA 结算状态和路由

**文件：**
- 修改：`src/pages/pda-settlement.ts`

- [ ] **步骤 1：替换页面状态类型**

在 `src/pages/pda-settlement.ts` 顶部替换旧类型：

```typescript
type SettlementPageMode = 'home' | 'statement-list' | 'quality-list'
type StatementFilterView = 'all' | 'pending-confirm' | 'disputing' | 'unpaid' | 'paid'
type QualityRecordFilterView = 'all' | 'not-in-statement' | 'in-statement' | 'rework' | 'deducted'
```

删除：

```typescript
type DetailTab = 'overview' | 'quality' | 'ledgers' | 'statements'
type QualityView = 'pending' | 'soon' | 'disputing' | 'processed' | 'history'
type LedgerTypeView = 'all' | 'task-earning' | 'quality-deduction'
type LedgerStatusView = 'all' | 'open' | 'in-statement' | 'in-prepayment-batch' | 'prepaid'
```

- [ ] **步骤 2：替换 `PdaSettlementState` 的旧字段**

把 `PdaSettlementState` 中的旧 Tab、ledger、cycle 字段替换为：

```typescript
interface PdaSettlementState {
  lastRouteSyncKey: string
  pageMode: SettlementPageMode
  statementFilterView: StatementFilterView
  qualityRecordFilterView: QualityRecordFilterView
  qualitySearch: string
  qualityDrawerId: string | null
  settlementRequestDrawerMode: 'create' | 'detail' | 'profile' | 'history' | 'versions' | null
  settlementRequestDetailId: string | null
  settlementRequestErrors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>>
  settlementRequestErrorText: string
  settlementRequestForm: SettlementEffectiveInfoSnapshot & { submitRemark: string }
  statementDrawerMode: 'detail' | 'appeal' | 'payment' | null
  statementDetailId: string | null
  statementErrorText: string
  statementAppealForm: StatementAppealForm
}
```

初始化改为：

```typescript
const state: PdaSettlementState = {
  lastRouteSyncKey: '',
  pageMode: 'home',
  statementFilterView: 'all',
  qualityRecordFilterView: 'all',
  qualitySearch: '',
  qualityDrawerId: null,
  settlementRequestDrawerMode: null,
  settlementRequestDetailId: null,
  settlementRequestErrors: {},
  settlementRequestErrorText: '',
  settlementRequestForm: {
    accountHolderName: '',
    idNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankBranch: '',
    submitRemark: '',
  },
  statementDrawerMode: null,
  statementDetailId: null,
  statementErrorText: '',
  statementAppealForm: {
    reason: '',
    description: '',
    evidenceSummary: '',
  },
}
```

- [ ] **步骤 3：新增路由 helper**

替换旧 `buildSettlementListHref` / `buildSettlementDetailHref` 相关 helper：

```typescript
function buildSettlementHomeHref(): string {
  return '/fcs/pda/settlement'
}

function buildStatementListHref(view: StatementFilterView = 'all'): string {
  const params = new URLSearchParams()
  params.set('tab', 'statements')
  if (view !== 'all') params.set('view', view)
  return `/fcs/pda/settlement?${params.toString()}`
}

function buildQualityListHref(view: QualityRecordFilterView = 'all'): string {
  const params = new URLSearchParams()
  params.set('tab', 'quality')
  if (view !== 'all') params.set('view', view)
  return `/fcs/pda/settlement?${params.toString()}`
}
```

- [ ] **步骤 4：改 `syncSettlementStateFromRoute`**

路由同步只保留 3 个页面模式；旧入口兼容到新模式：

```typescript
function syncSettlementStateFromRoute(): void {
  const rawSearch = typeof window === 'undefined' ? '' : window.location.search
  if (state.lastRouteSyncKey === rawSearch) return
  state.lastRouteSyncKey = rawSearch

  const params = new URLSearchParams(rawSearch)
  const tab = params.get('tab')
  const view = params.get('view')

  if (tab === 'statements') {
    state.pageMode = 'statement-list'
    state.statementFilterView = isStatementFilterView(view) ? view : 'all'
    return
  }

  if (tab === 'quality') {
    state.pageMode = 'quality-list'
    state.qualityRecordFilterView = isQualityRecordFilterView(view) ? view : 'all'
    return
  }

  state.pageMode = 'home'
  state.statementFilterView = 'all'
  state.qualityRecordFilterView = 'all'
}
```

同时新增两个小 helper：

```typescript
function isStatementFilterView(value: string | null): value is StatementFilterView {
  return value === 'all' || value === 'pending-confirm' || value === 'disputing' || value === 'unpaid' || value === 'paid'
}

function isQualityRecordFilterView(value: string | null): value is QualityRecordFilterView {
  return value === 'all' || value === 'not-in-statement' || value === 'in-statement' || value === 'rework' || value === 'deducted'
}
```

- [ ] **步骤 5：删除旧周期详情 Tab 渲染和事件**

删除以下函数和相关事件分支：

```typescript
renderCycleDetail
renderOverviewTab
renderQualityTab
renderLedgersTab
renderLedgerCard
renderLedgerDrawer
getFilteredCycleLedgers
getLedgerDetailViewModel
getCycleQualityItems
```

删除事件分支：

```typescript
switch-detail-tab
back-to-cycles
set-quality-view
open-quality-workbench
set-ledger-type-view
set-ledger-status-view
open-ledger-detail
close-ledger-drawer
```

- [ ] **步骤 6：运行检查确认仍失败但错误前移**

运行：

```bash
npm run check:factory-settlement-pda
```

预期：仍 FAIL，但不再报 `type SettlementPageMode` 缺失，开始报 `buildSettlementHomeViewModel` 或首页 token 缺失。

## 任务 3：实现结算首页卡片

**文件：**
- 修改：`src/pages/pda-settlement.ts`

- [ ] **步骤 1：新增质检事实导入**

增加：

```typescript
import { getQcFactDetail, listQcFactRows, type QcFactRow } from './qc-records/fact-view'
```

- [ ] **步骤 2：新增首页 ViewModel**

在 `getSettlementCycleSummaries` 后新增：

```typescript
interface SettlementHomeViewModel {
  accumulatedIncome: number
  accumulatedDeduction: number
  paidAmount: number
  unpaidAmount: number
  unsettledReferenceAmount: number
  statements: Array<{ statement: StatementDraft; summary: SettlementCycleSummary }>
  qcRows: QcFactRow[]
}

function isStatementPaid(statement: StatementDraft): boolean {
  return Boolean(statement.prepaidAt || statement.paymentWritebackId || statement.status === 'PREPAID' || statement.status === 'CLOSED')
}

function getStatementNetAmount(statement: StatementDraft): number {
  return statement.netPayableAmount ?? statement.totalAmount ?? 0
}

function getFactoryQcRows(context: FactoryContext): QcFactRow[] {
  return listQcFactRows({ includeLegacy: false }).filter((row) => row.sourceFactoryName === context.factoryName)
}

function buildSettlementHomeViewModel(context: FactoryContext): SettlementHomeViewModel {
  const summaries = getSettlementCycleSummaries(context)
  const statements = summaries.flatMap((summary) => summary.statements.map((statement) => ({ statement, summary })))
  const statementIds = new Set(statements.map(({ statement }) => statement.statementId))
  const allLedgers = summaries.flatMap((summary) => summary.ledgers)
  const openLedgers = allLedgers.filter((ledger) => !ledger.statementId || !statementIds.has(ledger.statementId))
  const qcRows = getFactoryQcRows(context)

  return {
    accumulatedIncome: statements.reduce((sum, item) => sum + (item.statement.totalEarningAmount ?? item.summary.taskEarningAmount), 0),
    accumulatedDeduction: statements.reduce((sum, item) => sum + (item.statement.totalDeductionAmount ?? item.summary.qualityDeductionAmount), 0),
    paidAmount: statements.filter((item) => isStatementPaid(item.statement)).reduce((sum, item) => sum + getStatementNetAmount(item.statement), 0),
    unpaidAmount: statements.filter((item) => !isStatementPaid(item.statement)).reduce((sum, item) => sum + getStatementNetAmount(item.statement), 0),
    unsettledReferenceAmount: openLedgers.reduce((sum, ledger) => sum + (ledger.direction === 'DEDUCTION' ? -ledger.settlementAmount : ledger.settlementAmount), 0),
    statements,
    qcRows,
  }
}
```

- [ ] **步骤 3：新增首页卡片渲染**

新增：

```typescript
function renderHomeMetricLink(label: string, value: string, href: string): string {
  return `
    <button class="rounded-lg border bg-background px-3 py-2 text-left" data-nav="${escapeHtml(href)}">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-bold text-foreground">${escapeHtml(value)}</div>
    </button>
  `
}

function renderSettlementHomePage(): string {
  const context = getCurrentFactoryContext()
  const vm = buildSettlementHomeViewModel(context)
  const pendingStatements = vm.statements.filter(({ statement }) => statement.factoryFeedbackStatus === 'WAIT_FACTORY_CONFIRM')
  const disputingStatements = vm.statements.filter(({ statement }) => statement.factoryFeedbackStatus === 'FACTORY_APPEALED')
  const paidStatements = vm.statements.filter(({ statement }) => isStatementPaid(statement))
  const unpaidStatements = vm.statements.filter(({ statement }) => !isStatementPaid(statement))
  const inStatementQcRows = vm.qcRows.filter((row) => row.settlementTrace.statusLabel === '已进入对账')
  const notInStatementQcRows = vm.qcRows.filter((row) => row.settlementTrace.statusLabel !== '已进入对账')
  const reworkQcRows = vm.qcRows.filter((row) => row.reworkQty > 0)
  const deductedQcRows = vm.qcRows.filter((row) => row.reworkChargebackAmountText !== '—')

  return `
    <div class="space-y-3 px-4 py-4">
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">结算</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">只看收入、对账单、质检记录和结算资料。付款只显示对账单是否已付款。</p>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">收入</h2>
        <p class="mt-1 text-[11px] text-muted-foreground">未结算为参考金额，不等同于应付款。</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${renderHomeMetricLink('累计收入', formatAmount(vm.accumulatedIncome, 'IDR'), buildStatementListHref('all'))}
          ${renderHomeMetricLink('累计扣款', formatAmount(vm.accumulatedDeduction, 'IDR'), buildStatementListHref('all'))}
          ${renderHomeMetricLink('已付款', formatAmount(vm.paidAmount, 'IDR'), buildStatementListHref('paid'))}
          ${renderHomeMetricLink('未付款', formatAmount(vm.unpaidAmount, 'IDR'), buildStatementListHref('unpaid'))}
          ${renderHomeMetricLink('未结算参考金额', formatAmount(vm.unsettledReferenceAmount, 'IDR'), buildStatementListHref('all'))}
        </div>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">对账单</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${renderHomeMetricLink('全部', String(vm.statements.length), buildStatementListHref('all'))}
          ${renderHomeMetricLink('待确认对账单', String(pendingStatements.length), buildStatementListHref('pending-confirm'))}
          ${renderHomeMetricLink('异议中对账单', String(disputingStatements.length), buildStatementListHref('disputing'))}
          ${renderHomeMetricLink('未付款对账单', String(unpaidStatements.length), buildStatementListHref('unpaid'))}
          ${renderHomeMetricLink('已付款对账单', String(paidStatements.length), buildStatementListHref('paid'))}
        </div>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">质检记录</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          ${renderHomeMetricLink('全部', String(vm.qcRows.length), buildQualityListHref('all'))}
          ${renderHomeMetricLink('未进对账', String(notInStatementQcRows.length), buildQualityListHref('not-in-statement'))}
          ${renderHomeMetricLink('已进对账', String(inStatementQcRows.length), buildQualityListHref('in-statement'))}
          ${renderHomeMetricLink('有返工', String(reworkQcRows.length), buildQualityListHref('rework'))}
          ${renderHomeMetricLink('有扣款', String(deductedQcRows.length), buildQualityListHref('deducted'))}
        </div>
      </section>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h2 class="text-sm font-semibold">结算资料</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="rounded-lg border bg-background px-3 py-2 text-left" data-pda-sett-action="open-settlement-profile">当前版本</button>
          <button class="rounded-lg border bg-background px-3 py-2 text-left" data-pda-sett-action="open-settlement-version-history">历史版本记录</button>
        </div>
      </section>
      ${renderSettlementRequestDrawer()}
    </div>
  `
}
```

- [ ] **步骤 4：让默认内容渲染首页**

替换 `renderSettlementContent`：

```typescript
function renderSettlementContent(): string {
  syncSettlementStateFromRoute()
  if (state.pageMode === 'statement-list') return renderStatementListPage()
  if (state.pageMode === 'quality-list') return renderQualityRecordListPage()
  return renderSettlementHomePage()
}
```

- [ ] **步骤 5：运行检查确认首页 token 通过**

```bash
npm run check:factory-settlement-pda
```

预期：仍 FAIL，但不再报首页卡片 token 缺失。

## 任务 4：实现对账单列表和详情口径

**文件：**
- 修改：`src/pages/pda-settlement.ts`

- [ ] **步骤 1：新增对账单过滤 helper**

```typescript
function getStatementFilterLabel(view: StatementFilterView): string {
  if (view === 'pending-confirm') return '待确认对账单'
  if (view === 'disputing') return '异议中对账单'
  if (view === 'unpaid') return '未付款对账单'
  if (view === 'paid') return '已付款对账单'
  return '全部对账单'
}

function filterStatementRows(
  rows: Array<{ statement: StatementDraft; summary: SettlementCycleSummary }>,
  view: StatementFilterView,
): Array<{ statement: StatementDraft; summary: SettlementCycleSummary }> {
  if (view === 'pending-confirm') return rows.filter(({ statement }) => statement.factoryFeedbackStatus === 'WAIT_FACTORY_CONFIRM')
  if (view === 'disputing') return rows.filter(({ statement }) => statement.factoryFeedbackStatus === 'FACTORY_APPEALED')
  if (view === 'paid') return rows.filter(({ statement }) => isStatementPaid(statement))
  if (view === 'unpaid') return rows.filter(({ statement }) => !isStatementPaid(statement))
  return rows
}
```

- [ ] **步骤 2：新增对账单列表页**

```typescript
function renderStatementFilterTabs(): string {
  const tabs: Array<[StatementFilterView, string]> = [
    ['all', '全部'],
    ['pending-confirm', '待确认'],
    ['disputing', '异议中'],
    ['unpaid', '未付款'],
    ['paid', '已付款'],
  ]
  return `<div class="flex gap-2 overflow-x-auto pb-1">${tabs.map(([view, label]) => `
    <button class="shrink-0 rounded-full border px-3 py-1.5 text-xs ${state.statementFilterView === view ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}" data-nav="${escapeHtml(buildStatementListHref(view))}">${escapeHtml(label)}</button>
  `).join('')}</div>`
}

function renderStatementListPage(): string {
  const context = getCurrentFactoryContext()
  const vm = buildSettlementHomeViewModel(context)
  const rows = filterStatementRows(vm.statements, state.statementFilterView)
  return `
    <div class="space-y-3 px-4 py-4">
      <button class="text-xs text-muted-foreground" data-nav="${escapeHtml(buildSettlementHomeHref())}">返回结算首页</button>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">${escapeHtml(getStatementFilterLabel(state.statementFilterView))}</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">付款状态只说明对账单是否付款，不提供付款申请或打款回写操作。</p>
        <div class="mt-3">${renderStatementFilterTabs()}</div>
      </section>
      ${rows.length > 0 ? rows.map(({ statement, summary }) => renderStatementCard(statement, summary)).join('') : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选下没有对账单</div>'}
      ${renderStatementDrawer()}
    </div>
  `
}
```

- [ ] **步骤 3：调整 `renderStatementCard`**

保留确认、申诉、查看详情按钮。把付款展示改为只读字段：

```typescript
${renderRow('付款状态', isStatementPaid(statement) ? '已付款' : '未付款', { green: isStatementPaid(statement) })}
${isStatementPaid(statement) ? renderRow('付款金额', formatAmount(getStatementNetAmount(statement), statement.settlementCurrency ?? 'IDR'), { bold: true }) : ''}
${statement.prepaidAt ? renderRow('付款时间', formatDateTime(statement.prepaidAt)) : ''}
```

删除卡片或 drawer 中的：

```typescript
飞书付款审批编号
银行回执
银行流水号
预付款批次
工厂端不能在这里创建预付款批次、申请付款或创建打款回写
```

- [ ] **步骤 4：把详情里的正式流水改成结算明细**

在 `renderStatementDrawer` 中：

- 标题用 `结算明细`。
- 明细分组只显示 `任务收入 / 返工扣款 / 瑕疵扣款 / 延误扣款`。
- 每条明细展示 `生产单 / SKU / 质检记录 / 金额 / 说明`。
- 不出现 `正式流水`、`预结算流水`、`预付款批次`。

替换 section 标题示例：

```typescript
${renderStatementDetailSection(
  '结算明细',
  statement.items.map((item) => `
    <div class="rounded-md border bg-muted/20 px-3 py-2">
      <div class="flex items-center justify-between gap-3">
        <div class="text-xs font-medium">${escapeHtml(item.sourceReason ?? item.processLabel ?? '结算明细')}</div>
        <div class="text-xs font-semibold">${escapeHtml(formatAmount(item.netAmount ?? item.settlementAmount ?? 0, statement.settlementCurrency ?? 'IDR'))}</div>
      </div>
      <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
        生产单：${escapeHtml(item.productionOrderNo ?? '—')} · SKU：${escapeHtml(item.skuCode ?? '—')} · 质检记录：${escapeHtml(item.qcRecordId ?? '—')}
      </div>
    </div>
  `).join(''),
)}
```

- [ ] **步骤 5：运行对账单检查**

```bash
npm run check:factory-settlement-pda
```

预期：仍 FAIL，但不再报 `结算明细` 缺失；如果报 `预付款批次`，继续删除 PDA 页面上的该词。

## 任务 5：实现质检记录列表和详情

**文件：**
- 修改：`src/pages/pda-settlement.ts`

- [ ] **步骤 1：新增质检过滤 helper**

```typescript
function getQualityRecordFilterLabel(view: QualityRecordFilterView): string {
  if (view === 'not-in-statement') return '未进对账'
  if (view === 'in-statement') return '已进对账'
  if (view === 'rework') return '有返工'
  if (view === 'deducted') return '有扣款'
  return '全部质检记录'
}

function filterQualityRows(rows: QcFactRow[], view: QualityRecordFilterView): QcFactRow[] {
  if (view === 'not-in-statement') return rows.filter((row) => row.settlementTrace.statusLabel !== '已进入对账')
  if (view === 'in-statement') return rows.filter((row) => row.settlementTrace.statusLabel === '已进入对账')
  if (view === 'rework') return rows.filter((row) => row.reworkQty > 0)
  if (view === 'deducted') return rows.filter((row) => row.reworkChargebackAmountText !== '—')
  return rows
}

function matchesQualityRecordKeyword(row: QcFactRow, keyword: string): boolean {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return [
    row.displayNo,
    row.productionOrderNo,
    row.skuSummary,
    row.sourceFactoryName,
    row.reworkReceivers,
    row.settlementTrace.statementNo,
  ].some((value) => String(value ?? '').toLowerCase().includes(text))
}
```

- [ ] **步骤 2：新增质检列表卡片**

```typescript
function renderQualityRecordCard(row: QcFactRow): string {
  return `
    <button class="w-full rounded-lg border bg-card px-4 py-3 text-left" data-pda-sett-action="open-quality-record-detail" data-qc-id="${escapeHtml(row.id)}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">${escapeHtml(row.displayNo)}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.skuSummary)}</div>
        </div>
        ${renderStatusBadge(row.settlementTrace.statusLabel, row.settlementTrace.statusLabel === '已进入对账' ? 'green' : 'gray')}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        ${renderRow('质检数量', `${row.inspectedQty} 件`)}
        ${renderRow('合格数量', `${row.qualifiedQty} 件`)}
        ${renderRow('返工数量', `${row.reworkQty} 件`, { orange: row.reworkQty > 0 })}
        ${renderRow('瑕疵数量', `${row.defectQty} 件`, { orange: row.defectQty > 0 })}
      </div>
      <div class="mt-2 text-[11px] leading-5 text-muted-foreground">
        对账单：${escapeHtml(row.settlementTrace.statementNo ?? '未进入对账')} · 返工接收：${escapeHtml(row.reworkReceivers)}
      </div>
    </button>
  `
}
```

- [ ] **步骤 3：新增质检记录列表页**

```typescript
function renderQualityRecordFilterTabs(): string {
  const tabs: Array<[QualityRecordFilterView, string]> = [
    ['all', '全部'],
    ['not-in-statement', '未进对账'],
    ['in-statement', '已进对账'],
    ['rework', '有返工'],
    ['deducted', '有扣款'],
  ]
  return `<div class="flex gap-2 overflow-x-auto pb-1">${tabs.map(([view, label]) => `
    <button class="shrink-0 rounded-full border px-3 py-1.5 text-xs ${state.qualityRecordFilterView === view ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}" data-nav="${escapeHtml(buildQualityListHref(view))}">${escapeHtml(label)}</button>
  `).join('')}</div>`
}

function renderQualityRecordListPage(): string {
  const context = getCurrentFactoryContext()
  const rows = filterQualityRows(getFactoryQcRows(context), state.qualityRecordFilterView)
    .filter((row) => matchesQualityRecordKeyword(row, state.qualitySearch))
  return `
    <div class="space-y-3 px-4 py-4">
      <button class="text-xs text-muted-foreground" data-nav="${escapeHtml(buildSettlementHomeHref())}">返回结算首页</button>
      <section class="rounded-lg border bg-card px-4 py-4">
        <h1 class="text-base font-bold">${escapeHtml(getQualityRecordFilterLabel(state.qualityRecordFilterView))}</h1>
        <p class="mt-1 text-[11px] leading-5 text-muted-foreground">只看质检事实和对账单引用，扣款信息弱展示。</p>
        <div class="mt-3">${renderQualityRecordFilterTabs()}</div>
        <input class="mt-3 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="质检单 / 生产单 / SKU / 对账单" value="${escapeHtml(state.qualitySearch)}" data-pda-sett-field="quality-search" data-skip-page-rerender="true" />
      </section>
      ${rows.length > 0 ? rows.map(renderQualityRecordCard).join('') : '<div class="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前筛选下没有质检记录</div>'}
      ${renderQualityRecordDrawer()}
    </div>
  `
}
```

- [ ] **步骤 4：新增质检详情抽屉**

```typescript
function renderQualityRecordDrawer(): string {
  if (!state.qualityDrawerId) return ''
  const detail = getQcFactDetail(state.qualityDrawerId)
  if (!detail) return ''
  return renderDrawer(
    `质检记录 · ${detail.displayNo}`,
    `
      ${renderStatementDetailSection('质检事实', `
        ${renderRow('生产单', detail.productionOrderNo)}
        ${renderRow('SKU', detail.skuSummary)}
        ${renderRow('质检数量', `${detail.inspectedQty} 件`)}
        ${renderRow('合格数量', `${detail.qualifiedQty} 件`)}
        ${renderRow('返工数量', `${detail.reworkQty} 件`, { orange: detail.reworkQty > 0 })}
        ${renderRow('瑕疵数量', `${detail.defectQty} 件`, { orange: detail.defectQty > 0 })}
        ${renderRow('返工接收对象', detail.reworkReceivers)}
      `)}
      ${renderStatementDetailSection('SKU 明细', detail.skuResults.map((item) => `
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <div class="text-xs font-semibold">${escapeHtml(item.skuCode)}</div>
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
            质检 ${item.inspectedQty} 件 · 合格 ${item.qualifiedQty} 件 · 返工 ${item.reworkQty} 件 · 瑕疵 ${item.defectQty} 件
          </div>
          <div class="mt-1 text-[11px] leading-5 text-muted-foreground">
            返工接收：${escapeHtml(item.reworkReceiveFactoryName)} · 瑕疵原因：${escapeHtml(item.defectReasonSummary)}
          </div>
        </div>
      `).join(''))}
      ${renderStatementDetailSection('对账引用', `
        ${renderRow('是否进入对账', detail.settlementTrace.statusLabel)}
        ${renderRow('对账单', detail.settlementTrace.statementNo ?? '未进入对账')}
        ${renderRow('扣款明细', detail.settlementTrace.deductionLineNo ?? '—')}
        ${detail.reworkChargebackAmountText !== '—' ? renderRow('返工扣款金额', detail.reworkChargebackAmountText, { red: true }) : ''}
      `)}
    `,
    'close-quality-record-drawer',
  )
}
```

- [ ] **步骤 5：接入输入和抽屉事件**

在 `handlePdaSettlementEvent` 的 field 分支加入：

```typescript
if (field === 'quality-search') {
  state.qualitySearch = fieldNode.value
  return true
}
```

在 action 分支加入：

```typescript
if (action === 'open-quality-record-detail') {
  const qcId = actionNode.dataset.qcId
  if (!qcId) return true
  state.qualityDrawerId = qcId
  appStore.patch({})
  return true
}

if (action === 'close-quality-record-drawer') {
  state.qualityDrawerId = null
  appStore.patch({})
  return true
}
```

- [ ] **步骤 6：运行检查**

```bash
npm run check:factory-settlement-pda
```

预期：PASS。

## 任务 6：清理 PDA 结算资料和付款边界文案

**文件：**
- 修改：`src/pages/pda-settlement.ts`

- [ ] **步骤 1：清理结算资料里的平台内部词**

在 `renderSettlementProfileDiffCard` 和 `renderSettlementRequestDrawer` 中：

- 删除 `预付款批次使用版本`。
- 删除 `预付款批次` 字样。
- 保留 `当前生效版本`、`对账单使用版本`。

替换成：

```typescript
${renderRow('当前生效版本', effectiveVersionNo ?? '—')}
${renderRow('对账单使用版本', statementSnapshotVersionNo ?? '—')}
```

- [ ] **步骤 2：清理付款 drawer 文案**

`state.statementDrawerMode === 'payment'` 时，只展示：

```typescript
${renderRow('付款状态', isStatementPaid(statement) ? '已付款' : '未付款')}
${renderRow('付款金额', isStatementPaid(statement) ? formatAmount(getStatementNetAmount(statement), statement.settlementCurrency ?? 'IDR') : '—')}
${renderRow('付款时间', statement.prepaidAt ? formatDateTime(statement.prepaidAt) : '—')}
```

不展示飞书审批、批次、银行回写流水号。

- [ ] **步骤 3：运行旧命令确认都已收口**

```bash
npm run check:factory-settlement-pda
npm run check:pda-settlement-ia
npm run check:pda-settlement-ledger
npm run check:pda-settlement-profile
npm run check:pda-settlement-task-links
```

预期：全部 PASS，输出 `check:factory-settlement-pda passed`。

- [ ] **步骤 4：Commit**

```bash
git add src/pages/pda-settlement.ts scripts/check-factory-settlement-pda.ts scripts/check-pda-settlement-ia.ts scripts/check-pda-settlement-ledger.ts scripts/check-pda-settlement-profile.ts scripts/check-pda-settlement-task-links.ts
git commit -m "feat: redesign pda settlement factory boundary"
```

## 任务 7：本地和构建验证

**文件：**
- 不修改文件。

- [ ] **步骤 1：跑最小结算验证**

```bash
npm run check:factory-settlement-pda
npm run check:factory-settlement
```

预期：全部 PASS。

- [ ] **步骤 2：跑构建**

```bash
npm run build
```

预期：构建成功，无 TypeScript 或 Vite 错误。

- [ ] **步骤 3：本地启动给手机预览**

```bash
npm run dev -- --host 0.0.0.0 --port 5178
```

另开终端：

```bash
ipconfig getifaddr en0
curl -I http://$(ipconfig getifaddr en0):5178/fcs/pda/settlement
```

预期：`curl` 返回 `200`。如果 `en0` 为空，用 `ipconfig getifaddr en1`。

- [ ] **步骤 4：浏览器手工核查**

打开：

```text
http://<局域网IP>:5178/fcs/pda/settlement
```

核查：

- 首页首屏是 `收入 / 对账单 / 质检记录 / 结算资料` 四类卡片。
- 点击 `未付款对账单` 进入对账单列表并只看未付款。
- 点击 `有返工` 进入质检记录列表并只看有返工。
- 对账单详情显示 `结算明细`，不显示 `正式流水` 或 `预结算流水`。
- 质检详情优先显示 SKU、质检数量、合格数量、返工数量、瑕疵原因。
- 页面不出现 `预付款批次`、`飞书付款审批编号`、`打款回写`、`申请付款`。

- [ ] **步骤 5：同步 CodeGraph**

```bash
codegraph sync
codegraph status
```

预期：`Index is up to date`。

## 自检

- 规格覆盖：
  - 收入卡片：任务 3。
  - 对账单入口、列表、付款状态、详情结算明细：任务 3、4。
  - 质检记录全部展示、筛选、对账标记、详情事实优先：任务 3、5。
  - 结算资料当前版本和历史版本：任务 3、6。
  - 不暴露预结算流水、预付款批次、飞书付款、打款回写：任务 1、4、6、7。
- 占位符扫描：无 `TODO`、无 `待定`、无“后续实现”。
- 类型一致性：
  - `StatementFilterView` 只在 `all / pending-confirm / disputing / unpaid / paid` 中取值。
  - `QualityRecordFilterView` 只在 `all / not-in-statement / in-statement / rework / deducted` 中取值。
  - 旧 `DetailTab`、`LedgerTypeView`、`LedgerStatusView` 必须删除。
