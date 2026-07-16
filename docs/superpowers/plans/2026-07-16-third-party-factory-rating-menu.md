# 三方工厂评级独立菜单实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将三方车缝工厂评级从工厂档案详情移出，新增 FCS 工厂池管理菜单“三方工厂评级”，并保持车缝分配、对账结算读取同一评级口径。

**架构：** 新建一个标准列表页 `src/pages/third-party-factory-rating.ts`，直接读取现有 `src/data/fcs/third-party-factory-rating.ts` 快照，并用工厂主档做覆盖校验和名称兜底。菜单、路由和异步 renderer 按现有 FCS 页面模式接入。工厂档案删除评级面板渲染和相关 import；专项检查改为验证新页面可见、联动统计、详情抽屉、工厂档案移出和派单 / 结算闭环。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有标准列表页组件、现有 Node/TS 检查脚本。

---

## 文件结构

- 创建：`src/pages/third-party-factory-rating.ts`  
  三方工厂评级标准列表页。负责筛选、联动统计、分页、标准列表表格、详情抽屉。
- 修改：`src/router/route-renderers-fcs.ts`  
  增加 `renderThirdPartyFactoryRatingPage` 异步 renderer。
- 修改：`src/router/routes-fcs.ts`  
  注册 `/fcs/factories/third-party-rating` 精确路由。
- 修改：`src/data/app-shell-config.ts`  
  在 FCS “工厂池管理”菜单中，紧跟“工厂档案”新增“三方工厂评级”。
- 修改：`src/pages/factory-profile.ts`  
  移除 `renderFactoryRatingPanel`、评级相关 import 和详情抽屉中的评级面板调用。
- 修改：`scripts/check-third-party-factory-rating.ts`  
  更新对抗式核查：新页面存在且使用标准列表；统计在筛选之后；新页面包含评级详情入口；工厂档案不再包含完整评级面板；派单和结算闭环保持。
- 修改：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`  
  更新页面路径、菜单迁移、工厂档案移出、新页面联动统计和对抗式核查结论。

## 任务 1：先更新失败检查

**文件：**
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：把页面可见性断言改成新页面优先**

在脚本读取页面源的位置，增加新页面读取，并把原先“工厂档案必须包含评级面板”的断言改为“新页面必须包含、工厂档案必须不包含”。

```ts
const ratingPageSource = readFileSync(new URL('../src/pages/third-party-factory-rating.ts', import.meta.url), 'utf8')
assert.ok(ratingPageSource.includes('@page-pattern: list'), '三方工厂评级页必须声明标准列表页模式')
assert.ok(ratingPageSource.includes('renderStandardListPage'), '三方工厂评级页必须使用标准列表页外壳')
assert.ok(ratingPageSource.includes('renderStandardListTable'), '三方工厂评级页必须使用标准列表表格')
assert.ok(ratingPageSource.includes('renderTablePagination'), '三方工厂评级页必须使用标准分页')
assert.ok(ratingPageSource.includes('listThirdPartyFactoryRatingSnapshots'), '三方工厂评级页必须读取评级快照')
assert.ok(ratingPageSource.includes('联动统计'), '三方工厂评级页必须表达筛选后联动统计')
assert.ok(ratingPageSource.includes('查看评级'), '三方工厂评级页必须有详情入口')

const filterIndex = ratingPageSource.indexOf('data-third-party-rating-filters')
const statsIndex = ratingPageSource.indexOf('data-third-party-rating-stats')
assert.ok(filterIndex >= 0, '三方工厂评级页缺少筛选区标记')
assert.ok(statsIndex > filterIndex, '联动统计卡片必须位于筛选区下方')
```

- [ ] **步骤 2：增加菜单和路由断言**

在脚本尾部增加源文件检查。

```ts
const routeRendererSource = readFileSync(new URL('../src/router/route-renderers-fcs.ts', import.meta.url), 'utf8')
assert.ok(routeRendererSource.includes('renderThirdPartyFactoryRatingPage'), '缺少三方工厂评级页 renderer')

const routesSource = readFileSync(new URL('../src/router/routes-fcs.ts', import.meta.url), 'utf8')
assert.ok(routesSource.includes("'/fcs/factories/third-party-rating'"), '缺少三方工厂评级路由')
assert.ok(routesSource.includes('renderThirdPartyFactoryRatingPage'), '三方工厂评级路由未绑定页面 renderer')

const appShellSource = readFileSync(new URL('../src/data/app-shell-config.ts', import.meta.url), 'utf8')
const profileMenuIndex = appShellSource.indexOf("key: 'factories-profile'")
const ratingMenuIndex = appShellSource.indexOf("key: 'factories-third-party-rating'")
const capacityMenuIndex = appShellSource.indexOf("key: 'factories-capacity-profile'")
assert.ok(profileMenuIndex >= 0 && ratingMenuIndex > profileMenuIndex, '三方工厂评级菜单必须位于工厂档案之后')
assert.ok(capacityMenuIndex > ratingMenuIndex, '三方工厂评级菜单必须位于工厂产能档案之前')
assert.ok(appShellSource.includes("title: '三方工厂评级'"), '菜单标题必须是三方工厂评级')
```

- [ ] **步骤 3：改写工厂档案移出断言**

替换现有工厂档案正向断言。

```ts
const factoryProfileSource = readFileSync(new URL('../src/pages/factory-profile.ts', import.meta.url), 'utf8')
assert.ok(!factoryProfileSource.includes('renderFactoryRatingPanel'), '工厂档案不应再渲染完整评级面板')
assert.ok(!factoryProfileSource.includes('评级与派单风控'), '工厂档案不应再展示评级与派单风控大卡片')
assert.ok(!factoryProfileSource.includes('listThirdPartyFactoryPerformanceRecords'), '工厂档案不应再读取评级履约记录')
```

- [ ] **步骤 4：运行检查确认失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，报错指向 `src/pages/third-party-factory-rating.ts` 不存在或缺少 renderer / 路由 / 菜单。

- [ ] **步骤 5：Commit**

```bash
git add scripts/check-third-party-factory-rating.ts
git commit -m "test: update third-party factory rating menu checks"
```

## 任务 2：新增三方工厂评级标准列表页

**文件：**
- 创建：`src/pages/third-party-factory-rating.ts`

- [ ] **步骤 1：创建页面骨架和数据派生函数**

文件顶部必须声明标准列表页模式。

```ts
// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, renderColumnSettingsDrawer } from '../components/ui/list-table.ts'
import { createDefaultColumnPreferences, updateColumnPreferences, type StandardListColumnPreferences, type StandardListSortState } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { escapeHtml } from '../utils.ts'
import { listFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import {
  getThirdPartyFactoryTimingSummary,
  listThirdPartyFactoryPerformanceRecords,
  listThirdPartyFactoryRatingSnapshots,
  type FactoryRatingSnapshot,
} from '../data/fcs/third-party-factory-rating.ts'

const PAGE_PATH = '/fcs/factories/third-party-rating'
const EVENT_PREFIX = 'third-party-rating'

type DispatchFilter = 'ALL' | 'ALLOW' | 'LIMITED' | 'BLOCKED'
type SettlementFilter = 'ALL' | 'ALLOW' | 'BLOCKED'

interface RatingQuery {
  keyword: string
  grade: string
  cooperationStatus: string
  scale: string
  dispatch: DispatchFilter
  settlement: SettlementFilter
  page: number
  pageSize: number
  viewFactoryId: string
}
```

- [ ] **步骤 2：实现 query、筛选和联动统计**

核心逻辑必须让统计和列表共用同一个 `filteredRows`。

```ts
function readQuery(): RatingQuery {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  return {
    keyword: params.get('keyword')?.trim() ?? '',
    grade: params.get('grade') ?? 'ALL',
    cooperationStatus: params.get('cooperationStatus') ?? 'ALL',
    scale: params.get('scale') ?? 'ALL',
    dispatch: (params.get('dispatch') as DispatchFilter | null) ?? 'ALL',
    settlement: (params.get('settlement') as SettlementFilter | null) ?? 'ALL',
    page: Math.max(1, Number(params.get('page') ?? '1') || 1),
    pageSize: Math.max(1, Number(params.get('pageSize') ?? '10') || 10),
    viewFactoryId: params.get('viewFactoryId') ?? '',
  }
}

function isDispatchMatch(snapshot: FactoryRatingSnapshot, filter: DispatchFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'BLOCKED') return snapshot.cooperationStatusLabel === '黑名单'
  if (filter === 'LIMITED') return snapshot.cooperationStatusLabel === '考核中' || snapshot.currentGrade === 'B'
  return snapshot.cooperationStatusLabel === '正常合作' && snapshot.currentGrade !== 'B'
}

function isSettlementMatch(snapshot: FactoryRatingSnapshot, filter: SettlementFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'BLOCKED') return snapshot.settlementBlocked
  return !snapshot.settlementBlocked
}

function filterSnapshots(rows: FactoryRatingSnapshot[], query: RatingQuery): FactoryRatingSnapshot[] {
  const keyword = query.keyword.toLowerCase()
  return rows.filter((snapshot) => {
    const keywordMatched =
      !keyword ||
      snapshot.factoryName.toLowerCase().includes(keyword) ||
      snapshot.factoryCode.toLowerCase().includes(keyword) ||
      snapshot.factoryId.toLowerCase().includes(keyword)
    return (
      keywordMatched &&
      (query.grade === 'ALL' || snapshot.currentGrade === query.grade) &&
      (query.cooperationStatus === 'ALL' || snapshot.cooperationStatusLabel === query.cooperationStatus) &&
      (query.scale === 'ALL' || snapshot.scaleLabel === query.scale) &&
      isDispatchMatch(snapshot, query.dispatch) &&
      isSettlementMatch(snapshot, query.settlement)
    )
  })
}
```

- [ ] **步骤 3：实现筛选区和联动统计标记**

筛选区必须在统计之前，且保留检查脚本使用的数据标记。

```ts
function renderFilters(query: RatingQuery): string {
  return `
    <form class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-6" data-third-party-rating-filters>
      <input name="keyword" value="${escapeHtml(query.keyword)}" class="h-9 rounded-md border px-3 text-sm md:col-span-2" placeholder="工厂名称 / 编码" />
      ${renderSelect('grade', query.grade, [['ALL', '全部评级'], ['S', 'S'], ['A', 'A'], ['B', 'B'], ['C', 'C']])}
      ${renderSelect('cooperationStatus', query.cooperationStatus, [['ALL', '全部状态'], ['正常合作', '正常合作'], ['考核中', '考核中'], ['黑名单', '黑名单']])}
      ${renderSelect('scale', query.scale, [['ALL', '全部规模'], ['大型工厂', '大型工厂'], ['小型工厂', '小型工厂']])}
      ${renderSelect('dispatch', query.dispatch, [['ALL', '全部派单'], ['ALLOW', '允许派单'], ['LIMITED', '限制派单'], ['BLOCKED', '禁止派单']])}
      ${renderSelect('settlement', query.settlement, [['ALL', '全部结算'], ['ALLOW', '允许结算'], ['BLOCKED', '禁止新结算']])}
      <div class="flex gap-2 md:col-span-6">
        <button type="submit" class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">筛选</button>
        <button type="button" class="h-9 rounded-md border px-4 text-sm" data-nav="${PAGE_PATH}">重置</button>
      </div>
    </form>
  `
}

function renderLinkedStats(rows: FactoryRatingSnapshot[]): string {
  const countBy = (predicate: (row: FactoryRatingSnapshot) => boolean) => rows.filter(predicate).length
  return `<div data-third-party-rating-stats data-note="联动统计">${renderStandardListStats([
    { label: '当前结果总数', value: rows.length },
    { label: '正常合作', value: countBy((row) => row.cooperationStatusLabel === '正常合作') },
    { label: '考核中', value: countBy((row) => row.cooperationStatusLabel === '考核中') },
    { label: '黑名单', value: countBy((row) => row.cooperationStatusLabel === '黑名单') },
    { label: 'S 级', value: countBy((row) => row.currentGrade === 'S') },
    { label: 'A 级', value: countBy((row) => row.currentGrade === 'A') },
    { label: 'B 级', value: countBy((row) => row.currentGrade === 'B') },
    { label: 'C 级', value: countBy((row) => row.currentGrade === 'C') },
  ])}</div>`
}
```

- [ ] **步骤 4：实现标准列表和详情抽屉**

列定义要包含固定右侧操作列，行操作打开 `viewFactoryId` 查询参数。

```ts
const columns = [
  {
    key: 'factory',
    title: '工厂',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    render: (row: FactoryRatingSnapshot) => `<div class="space-y-1"><div class="font-medium">${escapeHtml(row.factoryName)}</div><div class="font-mono text-xs text-muted-foreground">${escapeHtml(row.factoryCode)}</div></div>`,
    sortValue: (row: FactoryRatingSnapshot) => row.factoryName,
  },
  {
    key: 'rating',
    title: '评级',
    width: 120,
    required: true,
    sortable: true,
    render: (row: FactoryRatingSnapshot) => renderRatingBadge(row),
    sortValue: (row: FactoryRatingSnapshot) => row.totalScore,
  },
  {
    key: 'actions',
    title: '操作',
    width: 110,
    required: true,
    actionColumn: true,
    render: (row: FactoryRatingSnapshot) => `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildHref({ viewFactoryId: row.factoryId }))}">查看评级</button>`,
  },
] as const
```

详情抽屉可复用原工厂档案评级面板的信息结构，但标题用“评级详情”。

```ts
function renderRatingDrawer(snapshot: FactoryRatingSnapshot | undefined): string {
  if (!snapshot) return ''
  const records = listThirdPartyFactoryPerformanceRecords(snapshot.factoryId).slice(0, 5)
  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/40" data-nav="${escapeHtml(buildHref({ viewFactoryId: undefined }))}" aria-label="关闭评级详情"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-background p-5 shadow-xl">
        <header class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">评级详情</h2>
            <p class="text-sm text-muted-foreground">${escapeHtml(snapshot.factoryName)} / ${escapeHtml(snapshot.factoryCode)}</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-nav="${escapeHtml(buildHref({ viewFactoryId: undefined }))}">关闭</button>
        </header>
        ${renderRatingDetail(snapshot, records)}
      </aside>
    </div>
  `
}
```

- [ ] **步骤 5：导出页面渲染函数**

页面主体必须先渲染筛选，再渲染联动统计，再渲染列表。

```ts
export function renderThirdPartyFactoryRatingPage(): string {
  const query = readQuery()
  const allRows = listThirdPartyFactoryRatingSnapshots()
  const filteredRows = filterSnapshots(allRows, query)
  const pageRows = filteredRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)

  return renderStandardListPage({
    title: '三方工厂评级',
    filtersHtml: renderFilters(query),
    statsHtml: renderLinkedStats(filteredRows),
    listTitle: '评级快照',
    tableHtml: renderStandardListTable({
      columns,
      rows: pageRows,
      preferences: getColumnPreferences(),
      sort: getSortState(),
      eventPrefix: EVENT_PREFIX,
      emptyText: '暂无符合条件的三方车缝工厂',
    }),
    paginationHtml: renderTablePagination({
      page: query.page,
      pageSize: query.pageSize,
      total: filteredRows.length,
      buildHref: (page, pageSize) => buildHref({ page, pageSize }),
    }),
    overlaysHtml: renderRatingDrawer(allRows.find((row) => row.factoryId === query.viewFactoryId)),
  })
}
```

- [ ] **步骤 6：运行检查确认仍失败在路由 / 菜单**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：页面相关断言通过，renderer / 路由 / 菜单断言仍失败。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/third-party-factory-rating.ts
git commit -m "feat: add third-party factory rating page"
```

## 任务 3：接入菜单和路由

**文件：**
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/data/app-shell-config.ts`

- [ ] **步骤 1：增加异步 renderer**

在 `src/router/route-renderers-fcs.ts` 的工厂页面 renderer 附近加入：

```ts
export const renderThirdPartyFactoryRatingPage = createAsyncRenderer(
  () => import('../pages/third-party-factory-rating'),
  'renderThirdPartyFactoryRatingPage',
)
```

- [ ] **步骤 2：注册 FCS 路由**

在 `src/router/routes-fcs.ts` import 列表中加入 `renderThirdPartyFactoryRatingPage`，并在工厂路由附近加入：

```ts
'/fcs/factories/third-party-rating': () => renderThirdPartyFactoryRatingPage(),
```

实际代码中不要保留前导 `+`，它只表示新增行。

- [ ] **步骤 3：新增菜单项**

在 `src/data/app-shell-config.ts` 中紧跟工厂档案菜单项之后加入：

```ts
{ key: 'factories-third-party-rating', title: '三方工厂评级', icon: 'ShieldCheck', href: '/fcs/factories/third-party-rating' },
```

- [ ] **步骤 4：运行专项检查**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：若工厂档案尚未移除评级面板，失败在工厂档案移出断言。

- [ ] **步骤 5：Commit**

```bash
git add src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/data/app-shell-config.ts
git commit -m "feat: route third-party factory rating page"
```

## 任务 4：从工厂档案移除评级面板

**文件：**
- 修改：`src/pages/factory-profile.ts`

- [ ] **步骤 1：移除评级相关 import**

删除来自 `../data/fcs/third-party-factory-rating` 的 import，包括：

```ts
getThirdPartyFactoryRatingSnapshot
getThirdPartyFactoryTimingSummary
listThirdPartyFactoryPerformanceRecords
type FactoryRatingSnapshot
```

- [ ] **步骤 2：删除局部评级渲染函数**

删除以下函数：

```ts
function getRatingTone(snapshot: FactoryRatingSnapshot): string
function getDelayDays(plannedAt: string, actualAt: string): number
function renderFactoryRatingPanel(factory: Factory): string
```

保留工厂档案其他函数不变。

- [ ] **步骤 3：删除详情抽屉里的评级面板调用**

删除工厂档案表单中的这一行：

```ts
${editingFactory ? renderFactoryRatingPanel(editingFactory) : ''}
```

- [ ] **步骤 4：运行专项检查**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：工厂档案移出断言通过；若页面 list 契约或分页参数有问题，失败指向新页面。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/factory-profile.ts scripts/check-third-party-factory-rating.ts
git commit -m "fix: move rating panel out of factory profile"
```

## 任务 5：补原型审查记录

**文件：**
- 修改：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`

- [ ] **步骤 1：更新页面基本信息**

把页面名称和路径改为覆盖新页面、车缝分配、对账单生成，并说明工厂档案只作为上游主档。

```md
| 页面名称 | 三方工厂评级、车缝分配工作台、对账单生成 |
| 页面路径 | `/fcs/factories/third-party-rating`、`/fcs/dispatch/sewing`、对账单生成页 |
| 上游来源 | 工厂档案主档、车缝派单、后道质检、履约记录 |
```

- [ ] **步骤 2：补充本次迁移结论**

在自查结论中加入：

```md
- 菜单迁移：评级详情已从工厂档案移出，新增 FCS 工厂池管理菜单“三方工厂评级”，位置紧跟“工厂档案”。
- 首屏顺序：新页面按标题、筛选、联动统计、标准列表组织；统计卡片基于当前筛选结果计算。
- 工厂档案边界：工厂档案保留主数据职责，不再展示完整“评级与派单风控”面板。
```

- [ ] **步骤 3：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：通过；如果提示审查记录缺失或不匹配，按提示补充本文件中的页面路径和审查说明。

- [ ] **步骤 4：Commit**

```bash
git add docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md
git commit -m "docs: update third-party factory rating review"
```

## 任务 6：全量验证和收口

**文件：**
- 验证：`scripts/check-third-party-factory-rating.ts`
- 验证：`src/pages/third-party-factory-rating.ts`
- 验证：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`

- [ ] **步骤 1：运行专项对抗式检查**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：

```text
check:third-party-factory-rating passed
```

- [ ] **步骤 2：运行列表页治理**

运行：

```bash
npm run check:list-page-governance
```

预期：通过，不允许通过新增 baseline 绕过。

- [ ] **步骤 3：运行原型设计治理**

运行：

```bash
npm run check:prototype-design-governance
```

预期：通过。

- [ ] **步骤 4：运行构建**

运行：

```bash
npm run build
```

预期：通过。如果失败在既有无关检查，记录完整失败命令和错误，不修改无关模块。

- [ ] **步骤 5：同步 CodeGraph**

运行：

```bash
codegraph sync && codegraph status
```

预期：索引最新，无 pending sync。

- [ ] **步骤 6：最终 Commit**

如果任务 1-5 已经分别 commit，且这里只产生验证记录或小修正，则提交小修正：

```bash
git add src/pages/third-party-factory-rating.ts src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/data/app-shell-config.ts src/pages/factory-profile.ts scripts/check-third-party-factory-rating.ts docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md
git commit -m "chore: verify third-party factory rating menu"
```

如果没有新增文件改动，跳过提交并在最终汇报中列出验证命令和结果。

## 自检

- 规格覆盖：菜单位置、路由、页面首屏顺序、筛选联动统计、标准列表、详情抽屉、工厂档案移出、派单闭环、结算闭环、对抗式核查、原型审查均有对应任务。
- 红旗词扫描：计划不含未决项。
- 类型一致性：页面导出函数统一为 `renderThirdPartyFactoryRatingPage`；路由统一为 `/fcs/factories/third-party-rating`；菜单 key 统一为 `factories-third-party-rating`。
- 范围控制：不新增后端、权限、评分编辑、真实评分任务或大型通用组件。
