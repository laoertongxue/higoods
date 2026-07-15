# 裁床生产单总览实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将现有裁床「生产单总览」改造成一张生产单一行、跨下单 / 印染 / 中转仓 / 裁床的只读状态宽表。

**架构：** 保留现有路由和生产单详情；新增纯状态模型、跨模块只读投影和聚焦的宽表视图。生产单、技术包、印染加工单、中转仓配料与裁床执行仍是唯一事实来源，页面不反向写入业务状态。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node 原生断言、Playwright。

---

## 实施前提

- 规格：`docs/superpowers/specs/2026-07-15-cutting-production-order-overview-design.md`。
- 当前主工作区有大量其他改动。执行前必须用 `superpowers-zh:using-git-worktrees` 建立隔离 worktree。
- 开始和结束运行 `codegraph sync`、`codegraph status`。
- 不修改无关模块，不引入后端、状态管理或 React 页面。

## 文件结构

**创建：**

- `src/pages/process-factory/cutting/production-order-overview-model.ts`：中文状态类型与纯汇总函数。
- `src/pages/process-factory/cutting/production-order-overview-projection.ts`：跨模块只读数据组装。
- `src/pages/process-factory/cutting/production-order-overview-view.ts`：筛选、宽表、分页和事件。
- `scripts/check-cutting-production-order-overview-model.ts`：纯函数与投影回归检查。
- `tests/cutting-production-order-overview.spec.ts`：新页面主验收。
- `docs/prototype-review-records/2026-07-15-cutting-production-order-overview.md`：治理审查记录。

**修改：**

- `src/pages/process-factory/cutting/production-progress.ts`：列表委托给新视图，保留路由和详情。
- `src/pages/process-factory/cutting/layout.helpers.ts`：分页增加语义单位。
- `src/components/ui/filter-bar.ts`：增加通用复选框多选筛选器。
- `scripts/check-cutting-production-progress-columns.ts`：更新 12 列宽表契约。
- `tests/cutting-production-progress-column-alignment.spec.ts`
- `tests/cutting-production-progress-simplified-layout.spec.ts`
- `tests/cutting-production-progress-partial-scenarios.spec.ts`
- `tests/cutting-production-progress-detail-labels.spec.ts`

## 任务 1：建立纯状态模型

**文件：** 创建 `production-order-overview-model.ts`、`check-cutting-production-order-overview-model.ts`

- [ ] **步骤 1：先写失败检查**

```ts
import assert from 'node:assert/strict'
import { summarizeThreeStageStatus, summarizePrintStatus, summarizeDyeStatus, buildFactoryLines } from '../src/pages/process-factory/cutting/production-order-overview-model.ts'

assert.equal(summarizeThreeStageStatus([], false), '—')
assert.equal(summarizeThreeStageStatus(['NOT_STARTED', 'NOT_STARTED'], true), '未开始')
assert.equal(summarizeThreeStageStatus(['DONE', 'NOT_STARTED'], true), '进行中')
assert.equal(summarizeThreeStageStatus(['DONE', 'DONE'], true), '已完成')
assert.equal(summarizePrintStatus(false, []), '无需印花')
assert.equal(summarizePrintStatus(true, ['PRINTING']), '进行中')
assert.equal(summarizeDyeStatus(false, []), '无需染色')
assert.equal(summarizeDyeStatus(true, ['DYEING']), '进行中')
assert.deepEqual(buildFactoryLines([
  { factoryId: 'F1', factoryName: '泗水中央裁床厂', factoryTypeLabel: '中央工厂', accepted: true, requiredQty: 100, pickedQty: 40 },
]), [{ factoryId: 'F1', factoryName: '泗水中央裁床厂', factoryTypeLabel: '中央工厂', acceptanceLabel: '已接单', pickupLabel: '部分领取' }])
```

- [ ] **步骤 2：确认失败**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-production-order-overview-model.ts`

预期：FAIL，模块或导出不存在。

- [ ] **步骤 3：实现最少模型**

```ts
export type ThreeStageFact = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
export interface FactoryProgressFact { factoryId: string; factoryName: string; factoryTypeLabel: '中央工厂' | '第三方工厂' | '—'; accepted: boolean; requiredQty: number; pickedQty: number }
export interface ProductionOrderOverviewFactoryLine { factoryId: string; factoryName: string; factoryTypeLabel: FactoryProgressFact['factoryTypeLabel']; acceptanceLabel: '未接单' | '已接单'; pickupLabel: '未领取' | '部分领取' | '领取完成' }

const PRINT_DONE = new Set(['PRINT_DONE', 'TRANSFER_DONE', 'WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'HANDOVER_DIFFERENCE'])
const PRINT_ACTIVE = new Set(['PRINTING', 'TRANSFERRING'])
const DYE_DONE = new Set(['WAIT_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'WAIT_REVIEW', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'HANDOVER_DIFFERENCE'])
const DYE_ACTIVE = new Set(['SAMPLE_TESTING', 'WATER_SOLUBLE_IN_PROGRESS', 'PRODUCTION_PAUSED', 'DYEING', 'DEHYDRATING', 'DRYING', 'SETTING', 'ROLLING', 'PACKING'])

export function summarizeThreeStageStatus(facts: ThreeStageFact[], known: boolean): string {
  if (!known) return '—'
  if (!facts.length || facts.every((fact) => fact === 'NOT_STARTED')) return '未开始'
  if (facts.every((fact) => fact === 'DONE')) return '已完成'
  return '进行中'
}
export function summarizePrintStatus(required: boolean, statuses: string[]): string {
  if (!required) return '无需印花'
  return summarizeThreeStageStatus(statuses.map((s) => PRINT_DONE.has(s) ? 'DONE' : PRINT_ACTIVE.has(s) ? 'IN_PROGRESS' : 'NOT_STARTED'), true)
}
export function summarizeDyeStatus(required: boolean, statuses: string[]): string {
  if (!required) return '无需染色'
  return summarizeThreeStageStatus(statuses.map((s) => DYE_DONE.has(s) ? 'DONE' : DYE_ACTIVE.has(s) ? 'IN_PROGRESS' : 'NOT_STARTED'), true)
}
export function buildFactoryLines(facts: FactoryProgressFact[]): ProductionOrderOverviewFactoryLine[] {
  return facts.map((fact) => ({ ...fact, acceptanceLabel: fact.accepted ? '已接单' : '未接单', pickupLabel: fact.pickedQty <= 0 ? '未领取' : fact.pickedQty >= fact.requiredQty ? '领取完成' : '部分领取' }))
    .map(({ accepted: _a, requiredQty: _r, pickedQty: _p, ...line }) => line)
}
```

- [ ] **步骤 4：运行步骤 2 命令，预期 PASS**
- [ ] **步骤 5：提交**

```bash
git add src/pages/process-factory/cutting/production-order-overview-model.ts scripts/check-cutting-production-order-overview-model.ts
git commit -m "feat: add cutting production overview status model"
```

## 任务 2：组装跨模块只读投影

**文件：** 创建 `production-order-overview-projection.ts`；修改纯检查脚本

- [ ] **步骤 1：新增失败场景**

通过可注入来源调用 `buildProductionOrderOverviewRows()`，断言一张生产单一行、时间与款式字段正确、印染与配料汇总正确、多工厂逐行对齐，并断言行模型中不存在 `riskTags`、`blocker`、`exceptionFacts`。

```ts
import { buildProductionOrderOverviewRows, type ProductionOrderOverviewSources } from '../src/pages/process-factory/cutting/production-order-overview-projection.ts'

const fixtureSources: ProductionOrderOverviewSources = {
  productionOrders: [{ productionOrderId: 'PO-002', productionOrderNo: 'PO-002', demandId: 'DEM-002', createdAt: '2026-07-15 10:00:00', taskBreakdownSummary: { isBrokenDown: true }, demandSnapshot: { demandId: 'DEM-002', spuCode: 'SPU-02', spuName: '测试连衣裙', buyerName: '陈佳', merchandiserName: '林晓雯' }, techPackSnapshot: { styleCode: 'ST-02', styleName: '测试连衣裙', imageSnapshot: { styleImages: ['/dress-sample-1.jpg'] }, processEntries: [{ processCode: 'PRINT' }] } }],
  productionDemands: [{ demandId: 'DEM-002', createdAt: '2026-07-14 16:00:00' }],
  printingOrders: [{ productionOrderIds: ['PO-002'], status: 'PRINTING' }],
  dyeingOrders: [],
  materialPrepRows: [{ productionOrderId: 'PO-002', totalRequiredQty: 100, totalConfirmedPrepQty: 50, pickupRecords: [{ receiverName: '泗水中央裁床厂', pickedQty: 40 }] }],
  cuttingProgressRows: [{ productionOrderId: 'PO-002', markerStatus: '未完成', spreadingStatus: '未开始', cuttingStatus: '裁剪未完成', inboundStatus: '未入仓', shippingStatus: '未发货', receiverFactoryNames: ['土豆工厂'] }],
  factoryFacts: [{ productionOrderId: 'PO-002', factoryId: 'F1', factoryName: '泗水中央裁床厂', factoryTypeLabel: '中央工厂', accepted: true, requiredQty: 100, pickedQty: 40 }],
}
const rows = buildProductionOrderOverviewRows(fixtureSources)
assert.equal(rows.length, 1)
assert.equal(rows[0].productionOrderNo, 'PO-002')
assert.equal(rows[0].demandCreatedAt, '2026-07-14 16:00:00')
assert.equal(rows[0].styleImageUrl, '/dress-sample-1.jpg')
assert.equal(rows[0].buyerName, '陈佳')
assert.equal(rows[0].merchandiserName, '林晓雯')
assert.equal(rows[0].printingStatus, '进行中')
assert.equal(rows[0].dyeingStatus, '无需染色')
assert.equal(rows[0].materialPrepStatus, '部分配料')
assert.equal(rows[0].factoryLines[0].pickupLabel, '部分领取')
assert.equal('riskTags' in rows[0], false)
assert.equal('blocker' in rows[0], false)
```

- [ ] **步骤 2：运行纯检查，预期因投影不存在而 FAIL**
- [ ] **步骤 3：实现行模型与默认来源**

```ts
export interface ProductionOrderOverviewRow {
  id: string; productionOrderId: string; productionOrderNo: string; productionOrderCreatedAt: string
  demandId: string; demandCreatedAt: string
  styleCode: string; styleName: string; styleImageUrl: string; buyerName: string; merchandiserName: string
  printingStatus: string; dyeingStatus: string; breakdownStatus: string; materialPrepStatus: string
  factoryLines: ProductionOrderOverviewFactoryLine[]
  markerStatus: string; spreadingStatus: string; cuttingStatus: string; inboundStatus: string
  shippingStatus: string; receiverFactoryNames: string[]; keywordIndex: string[]
}
export interface ProductionOrderOverviewSources {
  productionOrders: Array<{ productionOrderId: string; productionOrderNo: string; demandId: string; createdAt: string; taskBreakdownSummary: { isBrokenDown: boolean }; demandSnapshot: { demandId: string; spuCode: string; spuName: string; buyerName: string; merchandiserName: string }; techPackSnapshot: null | { styleCode: string; styleName: string; imageSnapshot: { styleImages: string[] }; processEntries: Array<{ processCode: string }> } }>
  productionDemands: Array<{ demandId: string; createdAt: string }>
  printingOrders: Array<{ productionOrderIds: string[]; status: string }>
  dyeingOrders: Array<{ productionOrderIds?: string[]; status: string }>
  materialPrepRows: Array<{ productionOrderId: string; totalRequiredQty: number; totalConfirmedPrepQty: number; pickupRecords: Array<{ receiverName: string; pickedQty: number }> }>
  cuttingProgressRows: Array<{ productionOrderId: string; markerStatus: string; spreadingStatus: string; cuttingStatus: string; inboundStatus: string; shippingStatus: string; receiverFactoryNames: string[] }>
  factoryFacts: Array<FactoryProgressFact & { productionOrderId: string }>
}
export function buildProductionOrderOverviewRows(sources = buildDefaultProductionOrderOverviewSources()): ProductionOrderOverviewRow[] {
  return sources.productionOrders.filter((order) => hasCuttingRequirement(order, sources)).map((order) => buildRow(order, sources))
    .sort((a, b) => b.productionOrderCreatedAt.localeCompare(a.productionOrderCreatedAt, 'zh-CN'))
}
```

默认来源必须复用：`productionOrders`、`productionDemands`（按 `demandId` / `sourceDemandIds` 关联创建时间）、`techPackSnapshot.processEntries`、`listPrintWorkOrders()`、`listDyeWorkOrders()`、`listMaterialPrepOrderProjections()`、`listGeneratedCutOrderSourceRecords()`、`processTasks`、`PickupRecord.receiverName`、`buildProductionProgressProjection()`。

`hasCuttingRequirement()` 只在技术包 `processEntries` 含 `CUT_PANEL` / `CUTTING`，或已有 `GeneratedCutOrderSourceRecord` 时返回真；不得用「已派单」作为是否有裁床需求的条件，否则会漏掉未派单生产单。`buildRow()` 逐字段调用任务 1 的汇总函数，并以 `productionOrderId` 关联所有来源。

配料只按数量映射：0＝未配料，小于需求＝部分配料，达到需求＝配料完成。无法确认来源事实返回「—」，不生成异常或阻塞判断。

- [ ] **步骤 4：运行纯检查，预期 PASS**
- [ ] **步骤 5：提交**

```bash
git add src/pages/process-factory/cutting/production-order-overview-projection.ts scripts/check-cutting-production-order-overview-model.ts
git commit -m "feat: project cutting production overview facts"
```

## 任务 3：扩展多选筛选与语义分页

**文件：** 修改 `filter-bar.ts`、`layout.helpers.ts`、纯检查脚本

- [ ] **步骤 1：先断言 `renderMultiSelectFilter()` 输出复选框和已选数量，并断言分页输出 `共 86 张生产单`**
- [ ] **步骤 2：运行纯检查，预期 FAIL**
- [ ] **步骤 3：实现组件**

```ts
export function renderMultiSelectFilter(config: { label: string; field: string; selectedValues: string[]; options: string[]; actionAttr: string }): string {
  const selected = new Set(config.selectedValues)
  return `<details class="relative"><summary class="list-none rounded-md border bg-background px-3 py-2 text-sm cursor-pointer">${escapeHtml(config.label)}${selected.size ? `（${selected.size}）` : ''}</summary><div class="absolute z-40 mt-1 min-w-44 space-y-1 rounded-md border bg-popover p-2 shadow-md">${config.options.map((option) => `<label class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><input type="checkbox" ${config.actionAttr}="${escapeHtml(config.field)}" value="${escapeHtml(option)}" ${selected.has(option) ? 'checked' : ''}><span>${escapeHtml(option)}</span></label>`).join('')}</div></details>`
}
```

给 `renderWorkbenchPagination()` 增加 `itemUnit?: string`，默认仍为「条」，本页传「张生产单」。

- [ ] **步骤 4：运行纯检查，预期 PASS**
- [ ] **步骤 5：提交**

```bash
git add src/components/ui/filter-bar.ts src/pages/process-factory/cutting/layout.helpers.ts scripts/check-cutting-production-order-overview-model.ts
git commit -m "feat: add overview multiselect filters"
```

## 任务 4：实现 12 列只读宽表

**文件：** 创建 `production-order-overview-view.ts`；修改 `production-progress.ts` 和两个布局 Playwright 测试

- [ ] **步骤 1：先把表头期望改为**

```ts
['生产单', '款式', '印花', '染色', '拆解', '配料', '派单工厂 / 接单 / 领取', '唛架', '铺布', '裁剪', '入仓', '发货 / 接收工厂']
```

同时断言两层分组表头、12 个 `td`、两个固定列、无「当前阻塞 / 风险提示 / 异常事实」、无 `[data-cutting-overview-mutate]`。

- [ ] **步骤 2：运行** `npx playwright test tests/cutting-production-progress-column-alignment.spec.ts tests/cutting-production-progress-simplified-layout.spec.ts`，预期 FAIL。
- [ ] **步骤 3：实现视图边界**

```ts
export interface ProductionOrderOverviewPageState { filters: ProductionOrderOverviewFilters; page: number; pageSize: number }
export function renderProductionOrderOverview(rows: ProductionOrderOverviewRow[], state: ProductionOrderOverviewPageState): string
export function handleProductionOrderOverviewEvent(target: Element, state: ProductionOrderOverviewPageState): boolean
```

要求：

- 使用 `renderStickyFilterShell`、`renderStickyTableScroller`、`renderWorkbenchPagination`。
- 两层表头 `colspan` 为下单 2、印染 2、中转仓 3、裁床厂 5。
- 生产单列 `left-0`，款式列按生产单列宽度固定偏移。
- 款式图片失败只切换中性占位图。
- 多工厂单元格用内部网格逐行展示「工厂名｜类型｜接单｜领取」。
- 不渲染统计卡、风险、异常、阻塞、建议和行内改状态按钮。

`renderCraftCuttingProductionProgressPage()` 只渲染页面头和 `renderProductionOrderOverview(buildProductionOrderOverviewRows(), overviewState)`；原详情导出保持。

- [ ] **步骤 4：实现筛选**：多选数组为空代表全部；关键词覆盖生产单、需求单、款式、跟单、买手、工厂；默认每页 20 张；输入不得每次 `input` 整页重绘。
- [ ] **步骤 5：运行步骤 2 命令，预期 PASS**
- [ ] **步骤 6：提交**

```bash
git add src/pages/process-factory/cutting/production-order-overview-view.ts src/pages/process-factory/cutting/production-progress.ts tests/cutting-production-progress-column-alignment.spec.ts tests/cutting-production-progress-simplified-layout.spec.ts
git commit -m "feat: rebuild cutting production overview table"
```

## 任务 5：状态点击定位详情

**文件：** 修改新视图、`production-progress.ts`、两个详情测试

- [ ] **步骤 1：改写测试**：混合子单显示进行中 / 部分完成；多工厂行数大于 0；点击配料进入 `?tab=material-flow`；详情无风险、异常、阻塞判断。
- [ ] **步骤 2：运行** `npx playwright test tests/cutting-production-progress-partial-scenarios.spec.ts tests/cutting-production-progress-detail-labels.spec.ts`，预期 FAIL。
- [ ] **步骤 3：实现固定映射**

```ts
const STATUS_DETAIL_TAB = {
  printing: 'material-flow', dyeing: 'material-flow', breakdown: 'cut-orders', materialPrep: 'material-flow', factory: 'material-flow',
  marker: 'marker-spreading', spreading: 'marker-spreading', cutting: 'fei-tickets', inbound: 'warehouse-bags', shipping: 'handover',
} as const
```

详情停止渲染 `renderRiskPromptSection`、风险摘要和系统判断；来源单据、数量、工厂、操作人、操作时间保留。

- [ ] **步骤 4：运行步骤 2 命令，预期 PASS**
- [ ] **步骤 5：提交**

```bash
git add src/pages/process-factory/cutting/production-order-overview-view.ts src/pages/process-factory/cutting/production-progress.ts tests/cutting-production-progress-partial-scenarios.spec.ts tests/cutting-production-progress-detail-labels.spec.ts
git commit -m "feat: align cutting overview detail navigation"
```

## 任务 6：更新静态契约检查

**文件：** 修改 `check-cutting-production-progress-columns.ts` 和纯检查脚本

- [ ] **步骤 1：把生产单表头改为新 12 列，并新增固定列、无阻塞 / 异常 / 风险、委托新视图的源码断言**
- [ ] **步骤 2：运行** `npm run check:cutting-production-progress-columns`，预期 FAIL。
- [ ] **步骤 3：对齐导出常量和检查文件；保留捆条加工、裁片单来源等现有详情链路检查**
- [ ] **步骤 4：运行以下命令，预期 PASS**

```bash
npm run check:cutting-production-progress-columns
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-production-order-overview-model.ts
```

- [ ] **步骤 5：提交**

```bash
git add scripts/check-cutting-production-progress-columns.ts scripts/check-cutting-production-order-overview-model.ts src/pages/process-factory/cutting/production-order-overview-view.ts
git commit -m "test: cover cutting production overview contract"
```

## 任务 7：治理记录和真实验收

**文件：** 创建审查记录和 `tests/cutting-production-order-overview.spec.ts`

- [ ] **步骤 1：新增 Playwright 主验收**：覆盖真实款式信息、无需印染、混合状态、多工厂对齐、状态多选、清空、分页、默认时间倒序、状态详情跳转和无写状态入口。至少包含以下断言：

```ts
test('裁床生产单总览只读展示完整业务状态', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/production-progress')
  const table = page.getByTestId('cutting-production-progress-main-table')
  await expect(table).toBeVisible()
  await expect(table.locator('tbody img').first()).toHaveAttribute('src', /\.(jpg|jpeg|png|webp)|data:image/)
  await expect(table).toContainText(/无需印花|未开始|进行中|已完成/)
  await expect(table.locator('[data-overview-factory-line]').first()).toBeVisible()
  await expect(page.getByText('当前阻塞', { exact: true })).toHaveCount(0)
  await expect(page.getByText('异常事实', { exact: true })).toHaveCount(0)
  await expect(page.getByText('风险提示', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-cutting-overview-mutate]')).toHaveCount(0)
  await expect(page.getByText(/共 \d+ 张生产单/)).toBeVisible()
})
```
- [ ] **步骤 2：按模板填写审查记录**，明确 PFOS 管理 / 主管端、只读、不推断异常阻塞、固定列、多工厂对齐、每页 20 张生产单。
- [ ] **步骤 3：运行目标检查**

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-production-order-overview-model.ts
npm run check:cutting-production-progress-columns
npx playwright test tests/cutting-production-order-overview.spec.ts tests/cutting-production-progress-column-alignment.spec.ts tests/cutting-production-progress-simplified-layout.spec.ts tests/cutting-production-progress-partial-scenarios.spec.ts tests/cutting-production-progress-detail-labels.spec.ts
npm run check:prototype-design-governance
npm run build
```

预期：全部 PASS，无页面错误和构建错误。

- [ ] **步骤 4：真实浏览器验收**

运行：`npm run dev -- --host 0.0.0.0 --port 4173`

检查路由 `/fcs/craft/cutting/production-progress`：固定列、横向滚动、真实款式图片、12 列、多工厂对齐、多选筛选、20 张分页、默认时间倒序、详情定位、无阻塞 / 异常 / 风险 / 建议、无整页闪烁，轻交互不超过 200ms。

- [ ] **步骤 5：最终同步与范围检查**

```bash
codegraph sync
codegraph status
git status --short
git diff --check
```

预期：CodeGraph 无待同步文件，差异只包含计划内文件。

- [ ] **步骤 6：提交**

```bash
git add tests/cutting-production-order-overview.spec.ts docs/prototype-review-records/2026-07-15-cutting-production-order-overview.md
git commit -m "docs: review cutting production overview prototype"
```

## 最终完成条件

- 设计规格的 14 条验收标准都有自动检查或真实浏览器证据。
- 一张生产单一行，多工厂在单元格内逐行对齐。
- 页面和详情不输出异常、阻塞、风险、责任归因或处理建议。
- 页面不写入生产单、加工单、仓储或裁床执行状态。
- 原路由、生产单详情和既有来源单据链路保持可达。
- 目标检查、Playwright、治理、构建、CodeGraph 和浏览器验收全部通过。
