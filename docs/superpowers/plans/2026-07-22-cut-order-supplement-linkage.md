# 裁片单补料关联与完成闭环实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将补料单统一挂到裁片单下，在补料管理与裁片单列表中实现一单一标签、筛选、详情和单张完成闭环。

**架构：** 新建轻量补料生命周期注册表作为两个页面共享的 Mock 事实源；补料管理保留复杂补料明细，注册表负责归属、次数、状态和完成记录。裁片单列表迁移到现有标准列表组件后读取注册表，所有弹窗和状态更新采用局部 DOM 刷新。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node.js `node:test`、Playwright、项目标准列表页组件。

---

## 文件结构

- 创建 `src/data/fcs/cutting/supplement-order-registry.ts`：补料生命周期事实源。
- 创建 `tests/supplement-order-registry.test.ts`：注册表纯逻辑测试。
- 修改 `src/pages/process-factory/cutting/supplement-management.ts`：裁片单单一入口、两状态、详情完成。
- 修改 `src/pages/process-factory/cutting/cut-orders-model.ts`：补料筛选纯函数。
- 修改 `src/pages/process-factory/cutting/cut-orders.ts`：标准列表、标签、筛选和完成弹窗。
- 修改 `tests/supplement-management-list-template.spec.ts`：补料管理回归。
- 创建 `tests/cut-order-supplement-linkage.spec.ts`：裁片单补料端到端验收。
- 创建 `docs/prototype-review-records/2026-07-22-cut-order-supplement-linkage.md`：原型审查记录。

## 任务 1：建立共享补料生命周期注册表

**文件：**
- 创建：`src/data/fcs/cutting/supplement-order-registry.ts`
- 创建：`tests/supplement-order-registry.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { completeSupplementOrder, listSupplementOrdersByCutOrder, registerSupplementOrder, resetSupplementOrderRegistryForTesting } from '../src/data/fcs/cutting/supplement-order-registry.ts'

test.beforeEach(resetSupplementOrderRegistryForTesting)

const input = (id: string, recordNo: string) => ({
  id, recordNo, cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', productionOrderNo: 'PO14671',
  reason: '裁片破损', totalQty: 8, lineSummary: 'Black/M/面料B/8件',
  createdAt: '2026-07-22 10:00', createdBy: '补料员 林芳',
})

test('同一裁片单次数递增且默认未完成', () => {
  assert.equal(registerSupplementOrder(input('sup-1', 'BL001')).sequenceNo, 1)
  assert.equal(registerSupplementOrder(input('sup-2', 'BL002')).sequenceNo, 2)
  assert.deepEqual(listSupplementOrdersByCutOrder('cut-14671-b').map((item) => item.status), ['未完成', '未完成'])
})

test('只完成目标补料单并阻止重复完成', () => {
  registerSupplementOrder(input('sup-1', 'BL001'))
  const result = completeSupplementOrder({ id: 'sup-1', completedAt: '2026-07-22 14:00', completedBy: '裁床主管 王敏' })
  assert.equal(result.status, '已完成')
  assert.throws(() => completeSupplementOrder({ id: 'sup-1', completedAt: '2026-07-22 14:01', completedBy: '裁床主管 王敏' }), /已完成，无需重复操作/)
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node --test tests/supplement-order-registry.test.ts`

预期：FAIL，找不到 `supplement-order-registry.ts`。

- [ ] **步骤 3：实现注册表**

```ts
export type SupplementOrderStatus = '未完成' | '已完成'
export interface SupplementOrderLifecycle {
  id: string; recordNo: string; cutOrderId: string; cutOrderNo: string; productionOrderNo: string
  sequenceNo: number; status: SupplementOrderStatus; reason: string; totalQty: number; lineSummary: string
  createdAt: string; createdBy: string; completedAt: string; completedBy: string
}
export type RegisterSupplementOrderInput = Omit<SupplementOrderLifecycle, 'sequenceNo' | 'status' | 'completedAt' | 'completedBy'>
const records: SupplementOrderLifecycle[] = []

export function listSupplementOrdersByCutOrder(cutOrderId: string): SupplementOrderLifecycle[] {
  return records.filter((item) => item.cutOrderId === cutOrderId).sort((a, b) => a.sequenceNo - b.sequenceNo)
}
export function getSupplementOrder(id: string): SupplementOrderLifecycle | undefined {
  return records.find((item) => item.id === id)
}
export function registerSupplementOrder(input: RegisterSupplementOrderInput): SupplementOrderLifecycle {
  const existing = getSupplementOrder(input.id)
  if (existing) return existing
  const record = { ...input, sequenceNo: listSupplementOrdersByCutOrder(input.cutOrderId).length + 1, status: '未完成' as const, completedAt: '', completedBy: '' }
  records.push(record)
  return record
}
export function completeSupplementOrder(input: { id: string; completedAt: string; completedBy: string }): SupplementOrderLifecycle {
  const record = getSupplementOrder(input.id)
  if (!record) throw new Error('未找到对应补料单，请刷新后重试。')
  if (record.status === '已完成') throw new Error('该补料单已完成，无需重复操作。')
  Object.assign(record, { status: '已完成', completedAt: input.completedAt, completedBy: input.completedBy })
  return record
}
export function resetSupplementOrderRegistryForTesting(): void { records.splice(0, records.length) }
```

- [ ] **步骤 4：验证并提交**

运行同一步骤 2，预期 2 个测试 PASS。

```bash
git add src/data/fcs/cutting/supplement-order-registry.ts tests/supplement-order-registry.test.ts
git commit -m "feat(补料): 建立裁片单补料生命周期注册表"
```

## 任务 2：将新增补料收口为裁片单入口

**文件：**
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`tests/supplement-management-list-template.spec.ts`

- [ ] **步骤 1：把双入口测试改为单一裁片单入口**

```ts
test('独立新增补料直接选择裁片单', async ({ page }) => {
  await page.goto(`${route}?mode=create`)
  await expect(page.getByRole('heading', { name: '选择裁片单' })).toBeVisible()
  await expect(page.getByText('裁片单搜索')).toBeVisible()
  await expect(page.getByRole('button', { name: /按生产单选择|按裁片单选择/ })).toHaveCount(0)
  await expect(page.getByText('按生产单或裁片单发起补料')).toHaveCount(0)
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx playwright test tests/supplement-management-list-template.spec.ts --grep "直接选择裁片单"`

预期：FAIL，旧页面仍展示双入口。

- [ ] **步骤 3：删除来源类型分支**

```ts
interface SupplementSourcePickerState { keyword: string; selectedCandidateId: string }
function buildCandidates(): SupplementCandidate[] { return buildCutOrderCandidates(cuttingOrderProgressRecords) }
function getSourcePickerCandidates(): SupplementCandidate[] {
  const keyword = state.sourcePicker.keyword.trim().toLowerCase()
  return buildCandidates().filter((candidate) => !keyword || [candidate.sourceNo, candidate.record.productionOrderNo, candidate.record.styleName, candidate.record.spuCode].some((value) => value.toLowerCase().includes(keyword)))
}
```

`renderSourcePickerPage()` 固定输出“选择裁片单”、裁片单搜索、候选表格和单选下一步；删除顶部说明区、生产单页签以及 `set-source-picker-type` 事件。保留关闭裁片单不可选提示。

- [ ] **步骤 4：验证并提交**

运行步骤 2，预期 PASS。

```bash
git add src/pages/process-factory/cutting/supplement-management.ts tests/supplement-management-list-template.spec.ts
git commit -m "feat(补料): 收口为裁片单新增入口"
```

## 任务 3：补料管理接入两状态和详情完成

**文件：**
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`tests/supplement-management-list-template.spec.ts`

- [ ] **步骤 1：编写详情完成失败测试**

```ts
test('补料详情可完成当前补料单', async ({ page }) => {
  await openList(page)
  await page.locator('[data-standard-list-table] tbody tr').first().getByRole('button', { name: '查看详情' }).click()
  await expect(page.getByText('未完成', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '完成该补料单' }).click()
  await expect(page.getByRole('heading', { name: '确认完成补料' })).toBeVisible()
  await page.getByRole('button', { name: '确认完成' }).click()
  await expect(page.getByText('已完成', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成该补料单' })).toHaveCount(0)
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx playwright test tests/supplement-management-list-template.spec.ts --grep "详情可完成"`

预期：FAIL，详情没有完成按钮。

- [ ] **步骤 3：创建和种子数据注册生命周期**

每次 `buildSupplementRecord()` 后调用：

```ts
registerSupplementOrder({
  id: record.id, recordNo: record.recordNo,
  cutOrderId: candidate.materialLines.map((line) => line.cutOrderId).find(Boolean) || candidate.id,
  cutOrderNo: candidate.sourceNo,
  productionOrderNo: record.draft.productionOrderNo, reason: record.draft.reason,
  totalQty: record.draft.lines.reduce((sum, line) => sum + line.supplementQty, 0),
  lineSummary: record.draft.lines.slice(0, 2).map((line) => `${line.color}/${line.size}/${line.supplementQty}件`).join('；'),
  createdAt: record.createdAt, createdBy: record.createdBy,
})
```

列表和详情状态统一读取 `getSupplementOrder(record.id)?.status ?? '未完成'`；统计改为未完成/已完成。Mock 初始化为 `CUT14671-B` 注册 3 张补料单后，调用 `completeSupplementOrder()` 完成第 1 张，保留第 2、3 张未完成，作为一单一标签和单选完成的稳定场景。

- [ ] **步骤 4：实现详情确认与局部更新**

状态增加 `pendingCompleteRecordId: string`。未完成详情显示 `data-cutting-supplement-action="request-complete-record"`；确认事件调用：

```ts
completeSupplementOrder({ id: state.pendingCompleteRecordId, completedAt: '2026-07-22 14:30', completedBy: '裁床主管 王敏' })
state.pendingCompleteRecordId = ''
refreshListRegions()
setSupplementRegion('overlay', renderListOverlay())
```

确认弹窗展示补料单号、第几次、裁片单号和总补料数量。

- [ ] **步骤 5：验证并提交**

运行：`npm run test:supplement-management-list-template:e2e`，预期 PASS。

```bash
git add src/pages/process-factory/cutting/supplement-management.ts tests/supplement-management-list-template.spec.ts
git commit -m "feat(补料): 支持详情完成单张补料单"
```

## 任务 4：迁移裁片单到标准列表组件

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-orders.ts`
- 创建：`tests/cut-order-supplement-linkage.spec.ts`

- [ ] **步骤 1：编写标准列表失败测试**

```ts
import { expect, test } from '@playwright/test'
const route = '/fcs/craft/cutting/cut-orders'
test('裁片单使用标准列表并固定操作栏', async ({ page }) => {
  await page.goto(route)
  await expect(page.locator('[data-standard-list-page]')).toBeVisible()
  await expect(page.locator('[data-standard-list-table]')).toBeVisible()
  await expect(page.locator('[data-standard-list-action-column]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '列设置' })).toBeVisible()
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx playwright test tests/cut-order-supplement-linkage.spec.ts --grep "标准列表"`

预期：FAIL，旧页面没有标准列表根节点。

- [ ] **步骤 3：声明并配置标准列表**

首行添加 `// @page-pattern: list`。状态增加 `sort`、`columnPreferences`、`columnSettingsOpen`、`draggedColumnKey`，使用存储键 `higood:list-page:/fcs/craft/cutting/cut-orders` 和页容量 `[10, 20, 50]`。

列定义必须包含 `cutOrder`、`boundary`、`product`、`material`、`pattern`、`quantity`、`date`、`status`、`risk`、`actions`；`cutOrder` 和 `product` 为 `required`，`actions` 为 `required` 且 `actionColumn`。

```ts
return renderStandardListPage({
  title: '裁片单', feedbackHtml: renderFeedback(), filtersHtml: renderFilters(),
  statsHtml: renderStandardListStats(buildCutOrderStatItems(rows)), listTitle: '裁片单列表',
  listActionsHtml: renderColumnSettingsButton(),
  tableHtml: renderStandardListTable({ columns: cutOrderColumns, rows: paging.rows, preferences: state.columnPreferences, sort: state.sort, eventPrefix: 'cutting-piece', emptyText: '当前条件下暂无裁片单' }),
  paginationHtml: renderTablePagination({ currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, total: paging.total, eventPrefix: 'cutting-piece' }),
  overlaysHtml: renderCutOrderOverlays(),
})
```

- [ ] **步骤 4：接入列与分页事件**

按补料管理现有模式处理 `sort-column`、`page-change`、`page-size-change`、`open-column-settings`、`toggle-column`、`toggle-freeze-column`、`reset-column-settings` 和列拖拽。只持久化列显示、顺序、冻结列和每页条数。

- [ ] **步骤 5：验证并提交**

运行：

```bash
npx playwright test tests/cut-order-supplement-linkage.spec.ts --grep "标准列表"
npm run check:list-page-governance
```

预期全部 PASS。

```bash
git add src/pages/process-factory/cutting/cut-orders.ts tests/cut-order-supplement-linkage.spec.ts
git commit -m "refactor(裁片): 接入标准列表页组件"
```

## 任务 5：接入裁片单标签、筛选和双完成入口

**文件：**
- 修改：`src/pages/process-factory/cutting/cut-orders-model.ts`
- 修改：`src/pages/process-factory/cutting/cut-orders.ts`
- 修改：`tests/cut-order-supplement-linkage.spec.ts`

- [ ] **步骤 1：编写失败验收**

```ts
test('一单一标签并一次只完成一张', async ({ page }) => {
  await page.goto(route)
  const row = page.getByText('CUT14671-B', { exact: true }).locator('xpath=ancestor::tr')
  await expect(row.getByRole('button', { name: '补 · 第 1 次 · 已完成' })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 未完成' })).toBeVisible()
  await row.getByRole('button', { name: '补 · 第 2 次 · 未完成' }).click()
  await expect(page.getByRole('heading', { name: '补料单详情' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成该补料单' })).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()
  await page.locator('[data-cutting-piece-field="hasSupplement"]').selectOption('YES')
  await page.locator('[data-cutting-piece-field="supplementCompletion"]').selectOption('HAS_INCOMPLETE')
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '完成补料' }).click()
  const dialog = page.getByRole('dialog', { name: '完成补料' })
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await dialog.getByRole('radio').first().check()
  await dialog.getByRole('button', { name: '确认完成' }).click()
  await expect(row.getByRole('button', { name: '补 · 第 2 次 · 已完成' })).toBeVisible()
  await expect(row.getByRole('button', { name: '补 · 第 3 次 · 未完成' })).toBeVisible()
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx playwright test tests/cut-order-supplement-linkage.spec.ts --grep "一单一标签"`

预期：FAIL，标签和完成弹窗尚不存在。

- [ ] **步骤 3：扩展筛选模型**

`CutOrderFilters` 增加 `hasSupplement: 'ALL' | 'YES' | 'NO'` 和 `supplementCompletion: 'ALL' | 'HAS_INCOMPLETE' | 'ALL_COMPLETED'`。

```ts
export function matchesSupplementFilters(statuses: SupplementOrderStatus[], filters: Pick<CutOrderFilters, 'hasSupplement' | 'supplementCompletion'>): boolean {
  const has = statuses.length > 0
  if (filters.hasSupplement === 'YES' && !has) return false
  if (filters.hasSupplement === 'NO' && has) return false
  if (filters.supplementCompletion === 'HAS_INCOMPLETE' && !statuses.includes('未完成')) return false
  if (filters.supplementCompletion === 'ALL_COMPLETED' && (!has || statuses.some((status) => status !== '已完成'))) return false
  return true
}
```

- [ ] **步骤 4：渲染一单一标签**

```ts
function renderSupplementTags(row: CutOrderRow): string {
  return `<div class="mt-2 flex flex-wrap gap-1.5">${listSupplementOrdersByCutOrder(row.cutOrderId).map((record) => `<button type="button" class="rounded-full border px-2 py-1 text-xs ${record.status === '未完成' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}" data-cutting-piece-action="open-supplement-detail" data-supplement-id="${escapeHtml(record.id)}">补 · 第 ${record.sequenceNo} 次 · ${record.status}</button>`).join('')}</div>`
}
```

把标签拼入 `renderProductionStyleCell(row)`，不增加补料列。

- [ ] **步骤 5：实现筛选、详情与完成选择弹窗**

在 `renderFilters()` 增加“是否有补料”（全部/有补料/无补料）和“补料是否完成”（全部/有未完成/全部已完成），字段属性分别为 `hasSupplement`、`supplementCompletion`。

页面状态增加 `activeSupplementId`、`pendingCompleteCutOrderId`、`selectedIncompleteSupplementId`。详情展示补料单号、裁片单、生产单、次数、状态、原因、摘要、数量和创建/完成信息；未完成详情可直接完成。操作栏弹窗只列未完成单并使用 radio 单选。两个入口都调用：

```ts
completeSupplementOrder({ id: targetSupplementId, completedAt: '2026-07-22 14:30', completedBy: '裁床主管 王敏' })
```

成功后只更新表格、统计和 overlay 区域；不得整页重绘。

- [ ] **步骤 6：验证并提交**

运行：`npx playwright test tests/cut-order-supplement-linkage.spec.ts`，预期全部 PASS。

```bash
git add src/pages/process-factory/cutting/cut-orders-model.ts src/pages/process-factory/cutting/cut-orders.ts tests/cut-order-supplement-linkage.spec.ts
git commit -m "feat(裁片): 展示并完成关联补料单"
```

## 任务 6：治理、性能和最终验收

**文件：**
- 修改：`tests/cut-order-supplement-linkage.spec.ts`
- 创建：`docs/prototype-review-records/2026-07-22-cut-order-supplement-linkage.md`

- [ ] **步骤 1：增加 200ms、滚动稳定和 1280×720 验收**

```ts
test('完成补料局部更新且低分辨率可用', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(route)
  const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(width.scroll).toBeLessThanOrEqual(width.client)
  await expect(page.locator('[data-standard-list-action-column]').first()).toBeVisible()
  await page.getByRole('button', { name: '完成补料' }).first().click()
  await page.getByRole('radio').first().check()
  const result = await page.evaluate(() => new Promise<{ elapsed: number; scrollBefore: number; scrollAfter: number }>((resolve) => {
    const scrollBefore = window.scrollY
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      if (![...document.querySelectorAll('button')].some((item) => item.textContent?.includes('已完成'))) return
      observer.disconnect()
      resolve({ elapsed: performance.now() - startedAt, scrollBefore, scrollAfter: window.scrollY })
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    document.querySelector<HTMLButtonElement>('[data-cutting-piece-action="confirm-complete-supplement"]')?.click()
  }))
  expect(result.elapsed).toBeLessThan(200)
  expect(result.scrollAfter).toBe(result.scrollBefore)
})
```

- [ ] **步骤 2：填写原型审查记录**

记录角色、Web 管理/主管端、两条页面路径、一单一标签、单选完成、防重复完成、固定操作栏、1280×720 结果。所有自动检查和浏览器验收通过后，最终结论填写“通过”，例外填写“无”。

- [ ] **步骤 3：运行完整验证**

```bash
node --experimental-strip-types --experimental-specifier-resolution=node --test tests/supplement-order-registry.test.ts
npm run test:supplement-management-list-template:e2e
npx playwright test tests/cut-order-supplement-linkage.spec.ts
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run build
codegraph sync
codegraph status
```

预期：全部退出码为 0，CodeGraph 显示 `Index is up to date`，无 Pending sync。

- [ ] **步骤 4：提交验收结果**

```bash
git add tests/cut-order-supplement-linkage.spec.ts docs/prototype-review-records/2026-07-22-cut-order-supplement-linkage.md
git commit -m "test(裁片): 收口补料关联原型验收"
```

- [ ] **步骤 5：确认范围与提交历史**

```bash
git status --short
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

预期：不包含用户已有的两份 `docs/product-design/` 未跟踪文档，不包含其他无关模块；设计、计划和每个实现阶段均有独立提交。
