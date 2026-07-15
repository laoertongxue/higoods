# 补料管理标准列表页模板实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将补料管理建设为仓库内首个标准列表页模板，并把统一结构、强制分页、低分辨率适配、宽表列管理和固定操作列写入 Agent 治理规则。

**架构：** 使用轻量 `list-page` 骨架组合标题、筛选、统计、表格和分页；使用独立的 `list-table-model` 管理列偏好、排序和分页；使用 `list-table` 渲染冻结列与列设置。补料管理保留业务数据和业务事件，仅将列表展示状态接入公共组件，并通过局部 DOM 替换避免整页重绘。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node 断言检查、Playwright。

---

## 文件职责

### 新建

- `src/components/ui/list-page.ts`：标准列表页骨架、紧凑统计区和列表容器。
- `src/components/ui/list-table-model.ts`：列偏好校正、排序、分页、本地保存与恢复默认值。
- `src/components/ui/list-table.ts`：宽表渲染、冻结列、固定操作列和列设置抽屉。
- `scripts/check-standard-list-page-template.ts`：公共组件与补料管理的确定性检查。
- `tests/supplement-management-list-template.spec.ts`：低分辨率、分页、排序、列设置和固定操作列浏览器验收。
- `docs/prototype-review-records/2026-07-15-supplement-management-list-template.md`：印尼工厂原型审查记录。

### 修改

- `src/components/ui/index.ts`：导出新增公共组件。
- `src/pages/process-factory/cutting/supplement-management.ts`：接入模板和列表交互。
- `src/main-handlers/fcs-handlers.ts`：把拖动事件传入补料管理处理器。
- `src/main.ts`：增加列设置拖动事件委托，且不触发全页渲染。
- `AGENTS.md`：加入标准列表页强制规则和模板引用。
- `package.json`：加入模板检查和浏览器验收命令。

## 范围约束

- 不调整其他现有列表页。
- 不改变新增补料、确认补料和补料详情的业务规则。
- 不引入 React、状态管理框架、表格库或服务端偏好接口。
- 不提交工作区中与本计划无关的用户改动。

---

### 任务 1：建立标准列表页骨架

**文件：**
- 创建：`src/components/ui/list-page.ts`
- 创建：`scripts/check-standard-list-page-template.ts`
- 修改：`src/components/ui/index.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败检查**

在检查脚本中写入：

```ts
import assert from 'node:assert/strict'
import { renderStandardListPage, renderStandardListStats } from '../src/components/ui/list-page.ts'

const stats = renderStandardListStats([{ label: '补料单', value: 12 }, { label: '已确认', value: 12 }])
const html = renderStandardListPage({
  title: '补料管理',
  primaryActionsHtml: '<button>新增补料</button>',
  filtersHtml: '<form>筛选</form>',
  statsHtml: stats,
  listTitle: '补料单列表',
  tableHtml: '<table></table>',
  paginationHtml: '<footer>分页</footer>',
})

assert.match(html, /data-standard-list-page/)
assert.match(html, /data-standard-list-filters/)
assert.match(html, /data-standard-list-table-section/)
assert.ok(html.indexOf('筛选') < html.indexOf('补料单列表'))
assert.equal(stats.includes('rounded-2xl'), false)
assert.equal(stats.includes('shadow'), false)
console.log('standard list page template checks passed')
```

在 `package.json` 增加：

```json
"check:standard-list-page-template": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-standard-list-page-template.ts"
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npm run check:standard-list-page-template`

预期：FAIL，指出 `src/components/ui/list-page.ts` 不存在。

- [ ] **步骤 3：实现最小骨架**

`src/components/ui/list-page.ts` 使用以下接口；不提供 `description`、`subtitle`、`hint` 字段：

```ts
export interface StandardListPageConfig {
  title: string
  primaryActionsHtml?: string
  feedbackHtml?: string
  filtersHtml: string
  statsHtml?: string
  listTitle: string
  listActionsHtml?: string
  tableHtml: string
  paginationHtml: string
  overlaysHtml?: string
  className?: string
}

export function renderStandardListStats(
  items: Array<{ label: string; value: string | number }>,
): string

export function renderStandardListPage(config: StandardListPageConfig): string
```

输出结构固定为：紧凑标题区、筛选区、可选统计区、带边框列表容器、表格、分页、覆盖层。页面外边距使用 `p-4`，模块间距使用 `space-y-3`，统计项独立带边框但统计组无外框和阴影。

在 `src/components/ui/index.ts` 加入：

```ts
export * from './list-page.ts'
```

- [ ] **步骤 4：验证并提交**

运行：

```bash
npm run check:standard-list-page-template
npm run build
```

预期：检查打印通过信息，构建退出码 0。

```bash
git add src/components/ui/list-page.ts src/components/ui/index.ts scripts/check-standard-list-page-template.ts package.json
git commit -m "feat: add standard list page shell"
```

---

### 任务 2：实现列偏好、排序和分页纯函数

**文件：**
- 创建：`src/components/ui/list-table-model.ts`
- 修改：`src/components/ui/index.ts`
- 修改：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：补充失败检查**

```ts
import {
  normalizeListColumnPreferences,
  paginateStandardListRows,
  sortStandardListRows,
} from '../src/components/ui/list-table-model.ts'

const rules = [
  { key: 'recordNo', required: true, freezeable: true },
  { key: 'qty', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]
const normalized = normalizeListColumnPreferences(rules, {
  order: ['unknown', 'qty', 'recordNo', 'actions'],
  visibleKeys: ['qty'],
  frozenKeys: ['unknown', 'qty', 'actions'],
  pageSize: 999,
}, [10, 20, 50])

assert.deepEqual(normalized.order, ['qty', 'recordNo', 'actions'])
assert.deepEqual(normalized.visibleKeys, ['qty', 'recordNo', 'actions'])
assert.deepEqual(normalized.frozenKeys, ['qty'])
assert.equal(normalized.pageSize, 10)

const rows = [{ id: 'B', qty: 2 }, { id: 'A', qty: 3 }, { id: 'C', qty: 1 }]
const sorted = sortStandardListRows(rows, { key: 'qty', direction: 'asc' }, (row, key) => row[key as keyof typeof row])
assert.deepEqual(sorted.map((row) => row.id), ['C', 'B', 'A'])
assert.deepEqual(paginateStandardListRows(rows, 2, 2), {
  rows: [rows[2]], total: 3, currentPage: 2, totalPages: 2, pageSize: 2, from: 3, to: 3,
})
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npm run check:standard-list-page-template`

预期：FAIL，指出 `list-table-model.ts` 不存在。

- [ ] **步骤 3：实现模型**

定义并导出：

```ts
export type StandardListSortDirection = 'asc' | 'desc'
export interface StandardListSortState { key: string; direction: StandardListSortDirection }
export interface StandardListColumnRule { key: string; required?: boolean; freezeable?: boolean; actionColumn?: boolean }
export interface StandardListColumnPreferences { order: string[]; visibleKeys: string[]; frozenKeys: string[]; pageSize: number }
export interface StandardListPageSlice<T> {
  rows: T[]; total: number; currentPage: number; totalPages: number
  pageSize: number; from: number; to: number
}
```

实现：

```ts
normalizeListColumnPreferences(rules, raw, allowedPageSizes)
sortStandardListRows(rows, sort, getValue)
paginateStandardListRows(rows, currentPage, pageSize)
loadListColumnPreferences(storage, storageKey, rules, defaults, allowedPageSizes)
saveListColumnPreferences(storage, storageKey, preferences)
clearListColumnPreferences(storage, storageKey)
```

规则：未知列丢弃；必需列和操作列自动显示；操作列不能冻结；非法页大小回到默认值；损坏 JSON 返回默认值；字符串使用 `localeCompare('zh-CN')`；数字按数值比较；空值排在最后。

- [ ] **步骤 4：导出、验证并提交**

在 `src/components/ui/index.ts` 导出 `list-table-model.ts`。运行 `npm run check:standard-list-page-template`，预期 PASS。

```bash
git add src/components/ui/list-table-model.ts src/components/ui/index.ts scripts/check-standard-list-page-template.ts
git commit -m "feat: add standard list table model"
```

---

### 任务 3：实现宽表、冻结列和列设置

**文件：**
- 创建：`src/components/ui/list-table.ts`
- 修改：`src/components/ui/index.ts`
- 修改：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：增加失败检查**

```ts
import { renderStandardListColumnSettings, renderStandardListTable } from '../src/components/ui/list-table.ts'

const columns = [
  { key: 'recordNo', title: '补料单号', width: 150, required: true, freezeable: true, sortable: true, render: (row: { recordNo: string }) => row.recordNo },
  { key: 'qty', title: '补料数量', width: 120, sortable: true, render: (row: { qty: number }) => `${row.qty} 件` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: () => '<button>查看详情</button>' },
]
const table = renderStandardListTable({
  columns, rows: [{ recordNo: 'SUP-001', qty: 10 }],
  visibleKeys: ['recordNo', 'qty', 'actions'], orderedKeys: ['recordNo', 'qty', 'actions'],
  frozenKeys: ['recordNo'], sort: { key: 'qty', direction: 'asc' },
  eventPrefix: 'demo-list', emptyText: '暂无补料单',
})
assert.match(table, /data-standard-list-scroll/)
assert.match(table, /sticky left-0/)
assert.match(table, /sticky right-0/)
assert.match(table, /data-demo-list-action="sort-column"/)
assert.match(table, /aria-sort="ascending"/)

const settings = renderStandardListColumnSettings({
  title: '列设置', columns, preferences: normalized, eventPrefix: 'demo-list', maxFrozenWidth: 520,
})
assert.match(settings, /draggable="true"/)
assert.match(settings, /恢复默认设置/)
assert.equal(settings.includes('说明'), false)
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npm run check:standard-list-page-template`

预期：FAIL，指出 `list-table.ts` 不存在。

- [ ] **步骤 3：实现标准列定义和表格**

```ts
export interface StandardListColumn<T> {
  key: string
  title: string
  width: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  required?: boolean
  freezeable?: boolean
  sortable?: boolean
  actionColumn?: boolean
  render: (row: T, index: number) => string
  sortValue?: (row: T) => string | number | null | undefined
}
```

`renderStandardListTable()` 必须按显隐和顺序得到最终列，累计左侧冻结列的 `left` 偏移；操作列表头和单元格统一使用 `sticky right-0`、不透明背景、左边框和更高层级；中间区域使用自身 `overflow-x-auto`；可排序表头输出 `sort-column` 动作、列键和 `aria-sort`；空数据保留表头并显示业务空状态。

- [ ] **步骤 4：实现列设置抽屉**

`renderStandardListColumnSettings()` 使用现有抽屉组件，输出显示复选框、冻结复选框、可拖动排序项、恢复默认设置和完成按钮。必需列禁用隐藏；操作列不可隐藏、不可拖动、不可冻结；左侧冻结列总宽度达到 `maxFrozenWidth` 后禁用继续冻结并由页面显示中文业务反馈；不输出副标题或说明性文案。

排序项统一输出：

```html
data-standard-list-column-drag="true"
data-<prefix>-column-key="recordNo"
data-<prefix>-column-drag-source="recordNo"
data-<prefix>-column-drop-target="qty"
```

- [ ] **步骤 5：导出、验证并提交**

导出 `list-table.ts`，然后运行：

```bash
npm run check:standard-list-page-template
npm run build
```

预期：均通过。

```bash
git add src/components/ui/list-table.ts src/components/ui/index.ts scripts/check-standard-list-page-template.ts
git commit -m "feat: add configurable standard list table"
```

---

### 任务 4：把补料管理接入标准模板

**文件：**
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：增加页面失败检查**

```ts
import { renderCraftCuttingSupplementManagementPage } from '../src/pages/process-factory/cutting/supplement-management.ts'

const supplementHtml = renderCraftCuttingSupplementManagementPage()
assert.match(supplementHtml, /data-standard-list-page/)
assert.match(supplementHtml, /data-cutting-supplement-results-region/)
assert.match(supplementHtml, /data-standard-list-scroll/)
assert.match(supplementHtml, /10 条\/页/)
assert.match(supplementHtml, /data-cutting-supplement-action="open-column-settings"/)
assert.equal(supplementHtml.includes('工艺工厂运营系统 / 裁床厂管理 / 裁后处理 / 补料管理'), false)
assert.equal(supplementHtml.includes('列表对象是补料单；新增补料填写后会弹窗确认。'), false)
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npm run check:standard-list-page-template`

预期：FAIL，缺少标准模板或结果区域。

- [ ] **步骤 3：扩展列表状态和演示数据**

在 `SupplementManagementState` 增加：

```ts
page: number
sort: StandardListSortState | null
columnPreferences: StandardListColumnPreferences
columnSettingsOpen: boolean
draggedColumnKey: string
```

定义：

```ts
const SUPPLEMENT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const SUPPLEMENT_COLUMN_STORAGE_KEY = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const SUPPLEMENT_MAX_FROZEN_WIDTH = 520
```

把确定性补料记录扩充到至少 12 条，让默认 10 条分页可真实翻页。继续复用现有候选单和补料草稿构建记录，只变化编号、创建时间、创建人和补料数量。

- [ ] **步骤 4：定义列和数据管线**

列键固定为：

```ts
type SupplementListColumnKey =
  | 'recordNo' | 'target' | 'supplementQty' | 'materialDemand'
  | 'processDemand' | 'status' | 'created' | 'actions'
```

`recordNo`、`target` 为必需识别列；`recordNo`、`supplementQty`、`created` 支持排序；`recordNo`、`target`、`supplementQty`、`status`、`created` 可冻结；`actions` 必需且固定右侧。默认显示全部列、普通业务列不冻结、每页 10 条。

数据管线严格为：

```ts
const filteredRecords = getFilteredRecords()
const sortedRecords = sortStandardListRows(filteredRecords, state.sort, getSupplementSortValue)
const paging = paginateStandardListRows(sortedRecords, state.page, state.columnPreferences.pageSize)
```

统计使用 `filteredRecords`，表格只渲染 `paging.rows`。

`renderSupplementPagination()` 必须复用现有 `renderTablePagination()`，传入 `total`、`from`、`to`、`currentPage`、`totalPages`、`pageSize` 和 `[10, 20, 50]`，即使总数为 0 或只有一页也保留分页栏。

- [ ] **步骤 5：使用标准骨架组合页面**

列表模式改为：

```ts
return renderStandardListPage({
  title: '补料管理',
  primaryActionsHtml: renderSupplementPrimaryAction(),
  feedbackHtml: renderFeedback(),
  filtersHtml: renderFilters(),
  statsHtml: renderSupplementStats(filteredRecords),
  listTitle: '补料单列表',
  listActionsHtml: renderColumnSettingsButton(),
  tableHtml: renderSupplementTable(paging.rows),
  paginationHtml: renderSupplementPagination(paging),
  overlaysHtml: renderSupplementOverlayRegion(),
})
```

删除面包屑、列表说明和 KPI 组外框。筛选区只保留字段标签、占位提示、筛选和重置。

- [ ] **步骤 6：实现局部刷新和列表事件**

```ts
function refreshSupplementResultsRegion(): void {
  const node = document.querySelector<HTMLElement>('[data-cutting-supplement-results-region]')
  if (node) node.outerHTML = renderSupplementResultsRegion()
}

function refreshSupplementOverlayRegion(): void {
  const node = document.querySelector<HTMLElement>('[data-cutting-supplement-overlay-region]')
  if (node) node.outerHTML = renderSupplementOverlayRegion()
}
```

筛选、重置、上一页、下一页、每页条数、排序、显隐、冻结和恢复默认值均更新状态后局部刷新，并给控件加 `data-skip-page-rerender="true"`。筛选、重置、改变每页条数和创建新单后回到第 1 页。偏好变化调用 `saveListColumnPreferences()`；恢复默认调用 `clearListColumnPreferences()`；本地存储异常只降级为会话状态。

- [ ] **步骤 7：验证并提交**

运行：

```bash
npm run check:standard-list-page-template
npm run build
```

预期：均通过。

```bash
git add src/pages/process-factory/cutting/supplement-management.ts scripts/check-standard-list-page-template.ts
git commit -m "feat: make supplement management the list template"
```

---

### 任务 5：支持列拖动且不整页重绘

**文件：**
- 修改：`src/main.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：增加拖动委托失败检查**

```ts
import { readFileSync } from 'node:fs'
const mainSource = readFileSync('src/main.ts', 'utf8')
const fcsHandlerSource = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')
assert.match(mainSource, /root\.addEventListener\('dragstart'/)
assert.match(mainSource, /root\.addEventListener\('dragover'/)
assert.match(mainSource, /root\.addEventListener\('drop'/)
assert.match(fcsHandlerSource, /handleCraftCuttingSupplementManagementEvent\(target, event\)/)
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npm run check:standard-list-page-template`

预期：FAIL，缺少拖动监听。

- [ ] **步骤 3：增加拖动事件委托**

在 `src/main.ts` 增加：

```ts
async function dispatchListColumnDragEvent(event: DragEvent): Promise<void> {
  const target = resolveEventElementTarget(event.target)
  if (!target?.closest('[data-standard-list-column-drag]')) return
  const handled = await dispatchPageEvent(target, event)
  if (handled) event.preventDefault()
}

root.addEventListener('dragstart', dispatchListColumnDragEvent)
root.addEventListener('dragover', dispatchListColumnDragEvent)
root.addEventListener('drop', dispatchListColumnDragEvent)
```

该入口不得调用 `render()`、`renderWithFocusRestore()` 或页面主体重绘。

- [ ] **步骤 4：传递事件并实现列重排**

补料处理器签名改为：

```ts
export function handleCraftCuttingSupplementManagementEvent(target: HTMLElement, event?: Event): boolean
```

`fcs-handlers.ts` 调用时传入 `event`。`dragstart` 保存源列并写入 `dataTransfer`；`dragover` 对合法目标调用 `preventDefault()`；`drop` 将源列移动到目标列之前，强制操作列保持最后，然后保存偏好并局部刷新。无效源列或目标列不修改状态。

- [ ] **步骤 5：验证并提交**

运行：

```bash
npm run check:standard-list-page-template
npm run build
```

预期：均通过。

```bash
git add src/main.ts src/main-handlers/fcs-handlers.ts src/pages/process-factory/cutting/supplement-management.ts scripts/check-standard-list-page-template.ts
git commit -m "feat: support standard list column reordering"
```

---

### 任务 6：写入 Agent 规则和审查记录

**文件：**
- 修改：`AGENTS.md`
- 创建：`docs/prototype-review-records/2026-07-15-supplement-management-list-template.md`
- 修改：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：增加治理失败检查**

```ts
const agentsSource = readFileSync('AGENTS.md', 'utf8')
assert.match(agentsSource, /标准列表页模板/)
assert.match(agentsSource, /\/fcs\/craft\/cutting\/supplement-management/)
assert.match(agentsSource, /src\/components\/ui\/list-page\.ts/)
assert.match(agentsSource, /操作列.*固定在右侧/)
assert.match(agentsSource, /1366×768/)
assert.match(agentsSource, /1280×720/)
assert.match(agentsSource, /说明性文案/)
assert.match(agentsSource, /所有数据列表.*分页/)
```

- [ ] **步骤 2：运行检查确认失败**

运行：`npm run check:standard-list-page-template`

预期：FAIL，`AGENTS.md` 缺少标准列表页章节。

- [ ] **步骤 3：更新 `AGENTS.md`**

新增章节并明确：模板路由与代码文件；新增列表页必须使用公共骨架；调整既有列表页的结构、筛选、统计、表格或分页时必须向模板对齐；本次不批量迁移其他页面；禁止无业务逻辑说明文案；所有数据列表必须分页；操作列固定右侧；宽表支持列显隐、列顺序、左侧冻结和数据排序；主要验收 `1366×768`，最低可用 `1280×720`；业务例外必须写入审查记录。

- [ ] **步骤 4：填写审查记录**

记录系统 PFOS、页面补料管理、角色裁床主管/组长、端类型主管端/管理端、核心任务、筛选全集统计与排序后分页口径、两个低分辨率基准、必需列与固定操作列防错、本地偏好降级，以及“不迁移其他历史列表页”的例外。

- [ ] **步骤 5：验证并提交**

运行：

```bash
npm run check:standard-list-page-template
npm run check:prototype-design-governance -- --all
```

预期：均通过。

```bash
git add AGENTS.md docs/prototype-review-records/2026-07-15-supplement-management-list-template.md scripts/check-standard-list-page-template.ts
git commit -m "docs: govern standard list page design"
```

---

### 任务 7：增加低分辨率浏览器验收

**文件：**
- 创建：`tests/supplement-management-list-template.spec.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写视口验收**

```ts
import { expect, test } from '@playwright/test'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
  test(`补料管理模板在 ${viewport.width}×${viewport.height} 可用`, async ({ page }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize(viewport)
    await page.goto('/fcs/craft/cutting/supplement-management')
    await expect(page.locator('[data-standard-list-page]')).toBeVisible()
    await expect(page.getByText('工艺工厂运营系统 / 裁床厂管理 / 裁后处理 / 补料管理')).toHaveCount(0)
    await expect(page.getByText('列表对象是补料单；新增补料填写后会弹窗确认。')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '新增补料' })).toBeVisible()
    await expect(page.getByRole('button', { name: '列设置' })).toBeVisible()
    await expect(page.locator('[data-cutting-supplement-field="pageSize"]')).toHaveValue('10')
    const sizes = await page.locator('body').evaluate((body) => ({ scrollWidth: body.scrollWidth, clientWidth: body.clientWidth }))
    expect(sizes.scrollWidth).toBe(sizes.clientWidth)
    await expectNoPageErrors(errors)
  })
}
```

- [ ] **步骤 2：补齐交互验收**

增加独立用例验证：默认 10 条且能进入第 2 页；“补料数量”表头切换升序/降序/默认；隐藏“印染需求”后刷新仍隐藏；拖动“创建”列后刷新保持顺序；冻结“补料单号”后横向滚动前后左边界基本不变；操作列横向滚动前后右边界与列表容器一致；恢复默认后列显隐、顺序、冻结和页大小恢复；筛选、翻页和列设置后预先写入的 `main` 节点标识不变。

- [ ] **步骤 3：加入命令并运行**

在 `package.json` 增加：

```json
"test:supplement-management-list-template:e2e": "playwright test tests/supplement-management-list-template.spec.ts"
```

运行：`npm run test:supplement-management-list-template:e2e`

预期：全部通过，无控制台和页面错误。

- [ ] **步骤 4：提交浏览器验收**

```bash
git add tests/supplement-management-list-template.spec.ts package.json
git commit -m "test: cover supplement list page template"
```

---

### 任务 8：最终验证与现场尺寸复核

**文件：**
- 验证阶段原则上不修改文件；发现缺陷时回到对应任务文件修复并重跑该任务检查。

- [ ] **步骤 1：运行全部针对性检查**

```bash
npm run check:standard-list-page-template
npm run test:supplement-management-list-template:e2e
npm run check:prototype-design-governance -- --all
npm run build
```

预期：全部退出码为 0。

- [ ] **步骤 2：人工复核 `1366×768`**

打开 `/fcs/craft/cutting/supplement-management`，确认首屏可见标题、筛选、统计和列表主体；没有说明性文案；分页、列设置和操作按钮可见；横向滚动时操作列固定；新增补料和查看详情仍可进入原业务流程。

- [ ] **步骤 3：人工复核 `1280×720`**

确认页面本身无横向滚动；筛选按钮没有被挤出；表格内部可横向滚动；冻结列未遮住全部中间区域；列设置抽屉底部操作始终可见。

- [ ] **步骤 4：复核交互响应与局部刷新**

筛选、翻页、排序、列设置、显隐和冻结各执行至少 5 次。使用浏览器 Performance 面板或 `performance.now()` 记录点击到目标区域更新的耗时，每次应小于 200ms；`main` 节点、滚动位置和非目标区域不得被重建。

- [ ] **步骤 5：同步 CodeGraph 并检查变更范围**

```bash
codegraph sync
codegraph status
git status --short
```

预期：CodeGraph 无待同步文件；实现提交只包含本计划列出的公共组件、补料管理、事件入口、Agent 规则、检查、测试和审查记录，用户原有工作区改动保持原状。
