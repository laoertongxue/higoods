# 生产准备时效实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `FCS -> 生产单管理 -> 生产准备时效` 新增一个可演示的原型页面，按生产准备记录跟进基码、版衣、齐码、花型、染色、辅料和毛织准备项，并按 `生产准备记录 + 准备项 = 1` 导出月度完成数量。

**架构：** 新增一个 FCS mock 数据域承载生产准备记录、准备项、筛选、KPI、月度统计和 CSV 数据；新增一个字符串模板页面承载 `准备台账` 和 `月度统计` 两个页签；接入现有 FCS 菜单、路由和 async renderer；新增一个 `tsx` 自检脚本覆盖菜单、路由、数据量、统计口径、花型师筛选和中文展示。

**技术栈：** Vite，TypeScript，Tailwind CSS，Vanilla TypeScript 字符串模板渲染，本地 mock 数据，`tsx` 检查脚本，Vite 构建验证，Playwright 或 curl 页面可达验证。

---

## 文件结构

**新增：**
- `src/data/fcs/production-preparation-timing.ts` — 生产准备记录和准备项 mock 数据、筛选、KPI、月度统计、CSV 行数据 helper。
- `src/pages/production/preparation-timing.ts` — 生产准备时效页面，包含准备台账、月度统计、花型师筛选、详情抽屉、分配和上传原型区域、导出链接。
- `scripts/check-production-preparation-timing.ts` — 自动验收菜单、路由、renderer、数据量、统计口径、页面文案和导出能力。

**修改：**
- `package.json` — 增加 `check:production-preparation-timing`。
- `src/data/app-shell-config.ts` — 在 `生产单管理` 分组中插入 `生产准备时效` 菜单。
- `src/router/route-renderers-fcs.ts` — 新增 FCS async renderer。
- `src/router/route-renderers.ts` — 补充同名 async renderer，保持全局 renderer 文件与 FCS renderer 文件一致。
- `src/router/routes-fcs.ts` — 新增 `/fcs/production/preparation-timing` 精确路由。

**不修改：**
- 不新增真实后端、接口层、数据库、权限或文件存储。
- 不重构 PCS 花型任务、FCS 生产单、技术包或生产单事件体系。
- 不把页面迁移到 React，不引入 shadcn/ui、图表库或 xlsx 依赖。
- 不把统计结果反写生产单、技术包或 PCS 任务状态。

---

## 关键约束

- 菜单必须位于 `FCS -> 生产单管理` 下，位置在 `生产单计划` 后、`交付仓配置` 前。
- 路由固定为 `/fcs/production/preparation-timing`。
- 页面标题固定为 `生产准备时效`。
- 月度完成统计固定按 `生产准备记录 + 准备项 = 1` 计数。
- `无需` 准备项、未完成准备项和 `已关闭` 记录不计入完成数量。
- 花型必须有花型团队、花型师、花型任务号、完成确认图片、花型文件、买手确认状态。
- 页面展示状态必须是中文，不展示英文状态码。
- Mock 数据不少于 12 条准备记录、70 条准备项、24 条已完成准备项、8 条超时准备项、6 条花型准备项、5 条染色调色准备项、3 条毛织纸样准备项。

---

### 任务 1：自检脚本先覆盖验收边界

**文件：**
- 新增：`scripts/check-production-preparation-timing.ts`
- 修改：`package.json`

- [ ] **步骤 1：新增检查命令**

在 `package.json` 的 `scripts` 中加入：

```json
"check:production-preparation-timing": "tsx scripts/check-production-preparation-timing.ts"
```

- [ ] **步骤 2：创建自检脚本骨架**

新增 `scripts/check-production-preparation-timing.ts`，使用 `node:assert/strict`、`node:fs` 读取源码，并动态导入目标数据和页面模块。

脚本结构：

```typescript
#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  assert.ok(existsSync(path), `${path} 不存在`)
  return readFileSync(path, 'utf8')
}

function assertIncludes(path: string, text: string, message: string): void {
  assert.ok(source(path).includes(text), message)
}
```

- [ ] **步骤 3：加入文件、菜单、路由和 renderer 断言**

脚本断言内容：

```typescript
for (const file of [
  'src/data/fcs/production-preparation-timing.ts',
  'src/pages/production/preparation-timing.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
  'src/router/route-renderers-fcs.ts',
  'src/router/route-renderers.ts',
] as const) {
  assert.ok(existsSync(file), `${file} 不存在`)
}

const menuSource = source('src/data/app-shell-config.ts')
const productionMenuStart = menuSource.indexOf("key: 'fcs-platform-production'")
assert.ok(productionMenuStart >= 0, '菜单缺少生产单管理分组')
const productionMenu = menuSource.slice(productionMenuStart, menuSource.indexOf("key: 'fcs-platform-process'", productionMenuStart))
assert.ok(productionMenu.includes('production-preparation-timing'), '生产单管理菜单缺少生产准备时效')
assert.ok(productionMenu.includes('/fcs/production/preparation-timing'), '生产准备时效 href 不正确')
assert.ok(
  productionMenu.indexOf('production-plan') < productionMenu.indexOf('production-preparation-timing') &&
    productionMenu.indexOf('production-preparation-timing') < productionMenu.indexOf('production-delivery-warehouse'),
  '生产准备时效必须位于生产单计划之后、交付仓配置之前',
)

assertIncludes('src/router/routes-fcs.ts', '/fcs/production/preparation-timing', 'routes-fcs.ts 缺少生产准备时效路由')
assertIncludes('src/router/routes-fcs.ts', 'renderProductionPreparationTimingPage', 'routes-fcs.ts 缺少生产准备时效 renderer')
assertIncludes('src/router/route-renderers-fcs.ts', 'renderProductionPreparationTimingPage', 'route-renderers-fcs.ts 缺少生产准备时效 renderer')
assertIncludes('src/router/route-renderers.ts', 'renderProductionPreparationTimingPage', 'route-renderers.ts 缺少生产准备时效 renderer')
```

- [ ] **步骤 4：加入数据口径断言**

动态导入数据模块后断言：

```typescript
const dataModule = await import('../src/data/fcs/production-preparation-timing.ts')
const {
  productionPreparationRecords,
  flattenProductionPreparationItems,
  buildMonthlyPreparationStats,
  buildMonthlyPreparationCompletionDetails,
  filterProductionPreparationRecords,
} = dataModule

assert.ok(Array.isArray(productionPreparationRecords), '生产准备记录必须导出数组')
assert.ok(productionPreparationRecords.length >= 12, '生产准备记录不少于 12 条')

const allItems = flattenProductionPreparationItems(productionPreparationRecords)
assert.ok(allItems.length >= 70, '准备项不少于 70 条')
assert.ok(allItems.filter((item) => item.status === '已完成').length >= 24, '已完成准备项不少于 24 条')
assert.ok(allItems.filter((item) => item.status === '已超时' || item.overdueHours > 0).length >= 8, '超时准备项不少于 8 条')
assert.ok(allItems.filter((item) => item.itemType === '花型').length >= 6, '花型准备项不少于 6 条')
assert.ok(allItems.filter((item) => item.itemType === '染色调色').length >= 5, '染色调色准备项不少于 5 条')
assert.ok(allItems.filter((item) => item.itemType === '毛织纸样').length >= 3, '毛织纸样准备项不少于 3 条')

const marchStats = buildMonthlyPreparationStats('2026-03')
const marchDetails = buildMonthlyPreparationCompletionDetails('2026-03')
const marchCompletedCount = marchDetails.length
assert.equal(
  marchStats.reduce((sum, row) => sum + row.completedCount, 0),
  marchCompletedCount,
  '月度统计必须按生产准备记录 + 准备项计数',
)
assert.ok(marchStats.some((row) => row.itemType === '基码纸样' && row.completedCount > 0), '月度统计必须有基码纸样完成数量')
assert.ok(marchStats.some((row) => row.itemType === '齐码纸样' && row.completedCount > 0), '月度统计必须有齐码纸样完成数量')
assert.ok(marchStats.some((row) => row.itemType === '花型' && row.completedCount > 0), '月度统计必须有花型完成数量')
assert.ok(marchStats.some((row) => row.itemType === '染色调色' && row.completedCount > 0), '月度统计必须有染色完成数量')
assert.ok(marchDetails.every((row) => row.recordStatus !== '已关闭'), '已关闭记录不得计入完成明细')
assert.ok(marchDetails.every((row) => row.required), '无需项不得计入完成明细')

const designerRecords = filterProductionPreparationRecords({ itemType: '花型', patternDesigner: '林小美' })
assert.ok(designerRecords.length > 0, '花型师筛选必须能命中林小美的任务')
```

- [ ] **步骤 5：加入页面渲染断言**

动态导入页面模块并渲染两个页签：

```typescript
const pageModule = await import('../src/pages/production/preparation-timing.ts')
assert.equal(typeof pageModule.renderProductionPreparationTimingPage, 'function', '必须导出 renderProductionPreparationTimingPage')

const ledgerHtml = pageModule.renderProductionPreparationTimingPage('/fcs/production/preparation-timing?tab=ledger&patternDesigner=林小美')
for (const text of [
  '生产准备时效',
  '准备台账',
  '月度统计',
  '统计口径：生产准备记录 + 准备项 = 1',
  '花型师',
  '我的花型任务',
  '待上传完成图',
  '待买手确认',
  '分配花型师',
  '上传完成图片',
]) {
  assert.ok(ledgerHtml.includes(text), `准备台账缺少 ${text}`)
}

const statsHtml = pageModule.renderProductionPreparationTimingPage('/fcs/production/preparation-timing?tab=stats&month=2026-03')
for (const text of [
  '导出月度统计',
  '导出完成明细',
  '完成数量',
  '按时完成数量',
  '超时完成数量',
  '平均耗时小时',
  '生产准备时效月度统计-202603.csv',
  '生产准备时效完成明细-202603.csv',
]) {
  assert.ok(statsHtml.includes(text), `月度统计缺少 ${text}`)
}
assert.ok(statsHtml.includes('data:text/csv;charset=utf-8'), '月度统计必须提供 CSV 导出链接')
```

- [ ] **步骤 6：加入英文状态码防线**

对页面 HTML 做状态码防线：

```typescript
for (const forbidden of ['PENDING', 'DONE', 'IN_PROGRESS', 'CANCELLED', 'ON_HOLD']) {
  assert.ok(!ledgerHtml.includes(forbidden), `页面不得展示英文状态码 ${forbidden}`)
  assert.ok(!statsHtml.includes(forbidden), `统计页不得展示英文状态码 ${forbidden}`)
}
```

- [ ] **步骤 7：运行检查并确认失败**

```bash
cd /Users/laoer/Documents/higoods
npm run check:production-preparation-timing
```

预期：FAIL，错误包含 `src/data/fcs/production-preparation-timing.ts 不存在` 或 `src/pages/production/preparation-timing.ts 不存在`。

- [ ] **步骤 8：Commit**

```bash
git add package.json scripts/check-production-preparation-timing.ts
git commit -m "test: add production preparation timing checks"
```

---

### 任务 2：数据域和 mock 数据

**文件：**
- 新增：`src/data/fcs/production-preparation-timing.ts`

- [ ] **步骤 1：定义中文枚举和接口**

使用中文状态字面量，避免页面需要做英文状态码翻译。

核心类型：

```typescript
export type PreparationItemType =
  | '基码纸样'
  | '版衣制作'
  | '齐码纸样'
  | '花型'
  | '染色调色'
  | '辅料下单'
  | '毛织纸样'

export type PreparationRecordStatus = '未开始' | '进行中' | '部分超时' | '已完成' | '已关闭'

export type PreparationItemStatus =
  | '无需'
  | '待判断'
  | '待分配'
  | '待开始'
  | '进行中'
  | '待确认'
  | '已完成'
  | '已超时'
```

准备项接口包含：

```typescript
export interface ProductionPreparationItem {
  itemId: string
  recordId: string
  itemType: PreparationItemType
  required: boolean
  status: PreparationItemStatus
  ownerTeam: string
  ownerName: string
  plannedStartAt: string
  plannedFinishAt: string
  actualFinishAt: string
  evidenceType: string
  evidenceSummary: string
  sourceObjectType: string
  sourceObjectNo: string
  sourceHref: string
  overdueHours: number
  remark: string
  patternTaskNo?: string
  patternDesignerId?: string
  patternDesignerName?: string
  patternTeamName?: string
  assignedAt?: string
  completionImageIds?: string[]
  patternFileIds?: string[]
  buyerReviewStatus?: '未提交' | '待确认' | '已通过' | '需调整'
}
```

准备记录接口包含：

```typescript
export interface ProductionPreparationRecord {
  recordId: string
  recordNo: string
  spuCode: string
  spuName: string
  imageUrl: string
  buyerName: string
  merchandiserName: string
  sourceReason: '销量达标' | '人工加入' | '前置打板' | '新类目'
  reachedThresholdAt: string
  enteredAt: string
  productionDemandNo: string
  productionOrderNo: string
  productionOrderHref: string
  techPackVersionLabel: string
  techPackPublishedAt: string
  status: PreparationRecordStatus
  currentBlockerText: string
  expectedFinishAt: string
  closedReason: string
  items: ProductionPreparationItem[]
}
```

- [ ] **步骤 2：新增基础字典**

导出这些常量，供页面和检查脚本复用：

```typescript
export const preparationItemTypes: PreparationItemType[] = [...]
export const preparationRecordStatuses: PreparationRecordStatus[] = [...]
export const preparationItemStatuses: PreparationItemStatus[] = [...]
export const preparationOwnerTeams = ['版师团队', '车板团队', '花型团队', '染色团队', '采购团队', '毛织团队']
export const patternDesignerOptions = [
  { id: 'designer-bingbing', name: '冰冰', teamName: '中国花型组' },
  { id: 'designer-linxiaomei', name: '林小美', teamName: '中国花型组' },
  { id: 'designer-diah', name: 'Diah', teamName: 'Bandung 花型组' },
  { id: 'designer-sari', name: 'Sari', teamName: 'Jakarta 花型组' },
]
```

- [ ] **步骤 3：补齐 12 条准备记录**

创建 `productionPreparationRecords`，覆盖设计稿中的 12 个样本：

- `PREP-202603-001`：春季定位印花连衣裙，花型分配林小美，待买手确认。
- `PREP-202603-002`：毛织撞色短袖上衣，毛织纸样超时，辅料无需。
- `PREP-202603-003`：春季休闲印花短袖 T 恤，花型分配冰冰，已完成。
- `PREP-202603-004`：连帽拉链卫衣套装，无需花型，染色进行中，辅料已同步。
- `PREP-202603-005`：户外轻量夹克，基码未上传，版衣和齐码串行卡住。
- `PREP-202603-006`：商务修身长袖衬衫，所有必做项完成。
- `PREP-202603-007`：Sweater Rajut Wanita，毛织样和梭织样不同团队并行。
- `PREP-202603-008`：Celana Jogger Pria，记录已关闭，不计入统计。
- `PREP-202604-001`：Kemeja Linen Pria，基码、版衣、齐码均在 2026-04 完成。
- `PREP-202604-002`：Blus Wanita Satin，染色调色待上传潘通色卡照片。
- `PREP-202604-003`：Celana Pendek Pria，花型分配 Diah，未上传完成图。
- `PREP-202604-004`：春季休闲T恤，刚进入准备阶段。

- [ ] **步骤 4：确保准备项数据覆盖边界**

每条记录 5 到 7 个准备项，总数不少于 70。数据中必须包含：

- 必做链路：基码纸样、版衣制作、齐码纸样。
- 条件链路：花型、染色调色、辅料下单、毛织纸样。
- 状态差异：未开始、进行中、部分超时、已完成、已关闭；无需、待判断、待分配、待开始、进行中、待确认、已完成、已超时。
- 统计月份：`2026-03` 和 `2026-04`。
- 花型师：冰冰、林小美、Diah、Sari。
- 花型上传场景：已有完成图、缺完成图、缺花型文件、待买手确认、买手已通过。

- [ ] **步骤 5：实现筛选 helper**

导出：

```typescript
export interface ProductionPreparationFilter {
  month?: string
  merchandiserName?: string
  buyerName?: string
  recordStatus?: PreparationRecordStatus | '全部'
  itemType?: PreparationItemType | '全部'
  ownerTeam?: string
  patternDesigner?: string
  overdueOnly?: boolean
  keyword?: string
  quickFilter?: '我的花型任务' | '待上传完成图' | '待买手确认'
}

export function filterProductionPreparationRecords(filter: ProductionPreparationFilter = {}): ProductionPreparationRecord[] { ... }
```

规则：

- 月份按 `enteredAt` 或完成项月份筛选，台账默认按 `enteredAt`。
- 准备项类型筛选命中任一准备项即可保留记录。
- 花型师筛选只看花型准备项的 `patternDesignerName`。
- `overdueOnly` 命中任一超时项即可保留记录。
- 关键词匹配 SPU、商品名、记录号、生产单号、技术包版本、准备项、责任人。
- `我的花型任务` 默认等同于花型师 `林小美`。
- `待上传完成图` 筛出花型准备项中完成图为空或花型文件为空的任务。
- `待买手确认` 筛出花型准备项买手确认状态为 `待确认` 的任务。

- [ ] **步骤 6：实现统计 helper**

导出：

```typescript
export function flattenProductionPreparationItems(records?: ProductionPreparationRecord[]): FlattenedPreparationItem[]
export function buildProductionPreparationKpis(records?: ProductionPreparationRecord[]): ProductionPreparationKpi[]
export function buildMonthlyPreparationStats(month: string, filter?: ProductionPreparationFilter): MonthlyPreparationStatRow[]
export function buildMonthlyPreparationCompletionDetails(month: string, filter?: ProductionPreparationFilter): MonthlyPreparationCompletionDetail[]
export function getProductionPreparationRecord(recordId: string): ProductionPreparationRecord | null
export function getProductionPreparationFilterOptions(): ProductionPreparationFilterOptions
```

完成明细规则：

- `record.status !== '已关闭'`
- `item.required === true`
- `item.status === '已完成'`
- `item.actualFinishAt` 以筛选月份开头

汇总规则：

- 按准备项类型聚合。
- `completedCount` 是完成明细行数。
- `onTimeCompletedCount` 是 `actualFinishAt <= plannedFinishAt` 的行数。
- `overdueCompletedCount` 是 `actualFinishAt > plannedFinishAt` 的行数。
- `averageDurationHours` 是 `actualFinishAt - plannedStartAt` 的平均小时数，保留 1 位小数。
- `latestFinishedAt` 是同项类型最大完成时间。

- [ ] **步骤 7：运行数据检查并确认脚本进入下一处失败**

```bash
cd /Users/laoer/Documents/higoods
npm run check:production-preparation-timing
```

预期：FAIL，数据量和统计口径断言通过，后续失败集中在页面、菜单或路由。

- [ ] **步骤 8：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts
git commit -m "feat: add production preparation timing mock data"
```

---

### 任务 3：页面渲染和导出

**文件：**
- 新增：`src/pages/production/preparation-timing.ts`

- [ ] **步骤 1：新增页面入口函数**

导出：

```typescript
export function renderProductionPreparationTimingPage(pathname = '/fcs/production/preparation-timing'): string {
  const url = new URL(pathname, 'http://higoods.local')
  const params = url.searchParams
  const activeTab = params.get('tab') === 'stats' ? 'stats' : 'ledger'
  ...
}
```

要求：

- 默认页签是 `准备台账`。
- 默认月份是 `2026-03`。
- 支持 `tab=ledger` 和 `tab=stats`。
- 支持 `recordId` 打开详情抽屉。
- 支持 `action=assign` 和 `itemId` 展示花型师分配原型区域。
- 支持 `action=upload` 和 `itemId` 展示上传完成图片原型区域。

- [ ] **步骤 2：实现 CSV helper**

页面内实现轻量 CSV，不引入依赖：

```typescript
function csvDataUri(rows: string[][]): string {
  const lines = rows.map((row) => row.map(escapeCsvValue).join(','))
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${lines.join('\n')}`)}`
}
```

汇总导出文件名：

- `生产准备时效月度统计-202603.csv`
- `生产准备时效月度统计-202604.csv`

明细导出文件名：

- `生产准备时效完成明细-202603.csv`
- `生产准备时效完成明细-202604.csv`

- [ ] **步骤 3：实现顶部和页签**

页面顶部必须包含：

- 标题 `生产准备时效`
- 副标题 `按生产准备记录跟进基码、版衣、齐码、花型、染色、辅料等准备项完成情况。`
- 口径提示 `统计口径：生产准备记录 + 准备项 = 1。无需项和已关闭记录不计入完成数量。`
- 页签 `准备台账`、`月度统计`

页签切换使用 `data-nav`：

```html
<button data-nav="/fcs/production/preparation-timing?tab=ledger">准备台账</button>
<button data-nav="/fcs/production/preparation-timing?tab=stats&month=2026-03">月度统计</button>
```

- [ ] **步骤 4：实现准备台账筛选区**

筛选区使用 `<section data-prep-filter-scope>` 包裹，筛选按钮使用现有 `data-nav-from-fields`：

```html
<button
  data-nav-from-fields="[data-prep-filter-scope]"
  data-nav-base="/fcs/production/preparation-timing"
>
  查询
</button>
```

筛选字段：

- 月份
- 跟单
- 买手
- 记录状态
- 准备项类型
- 责任团队
- 花型师
- 是否超时
- 关键词

快捷筛选按钮：

- `我的花型任务` -> `/fcs/production/preparation-timing?tab=ledger&itemType=花型&patternDesigner=林小美&quickFilter=我的花型任务`
- `待上传完成图` -> `/fcs/production/preparation-timing?tab=ledger&itemType=花型&quickFilter=待上传完成图`
- `待买手确认` -> `/fcs/production/preparation-timing?tab=ledger&itemType=花型&quickFilter=待买手确认`

- [ ] **步骤 5：实现 KPI 区**

渲染 6 个 KPI：

- 准备记录总数
- 进行中
- 部分超时
- 今日应完成准备项
- 本月已完成准备项
- 待分配花型任务

KPI 只读展示，由 `buildProductionPreparationKpis()` 派生。

- [ ] **步骤 6：实现列表区**

列表列：

- 商品
- 买手/跟单
- 进入准备时间
- 关联生产单
- 正式技术包
- 整体状态
- 完成进度
- 当前卡点
- 最早超时项
- 预计完成时间
- 操作

操作：

- `查看详情`：`data-nav="/fcs/production/preparation-timing?tab=ledger&recordId=..."`
- `更新准备项`：打开同一详情抽屉并定位准备项区域。
- `查看生产单`：`data-nav="/fcs/production/orders?keyword=生产单号"`

空状态文案：

- `当前筛选条件下暂无生产准备记录`

- [ ] **步骤 7：实现详情抽屉**

当 URL 中存在 `recordId` 时渲染右侧固定抽屉。内容：

- 基础信息：记录号、SPU、商品、买手、跟单、来源、进入准备时间、生产单、技术包。
- 准备项时间线：基码、版衣、齐码、花型、染色、辅料、毛织。
- 准备项明细卡片：状态、责任团队、责任人、计划时间、实际完成时间、证据、来源对象、备注。
- 花型准备项附加字段：花型任务号、花型团队、花型师、分配时间、完成确认图片、花型文件、买手确认状态。
- 关联对象：生产需求单、生产单、技术包、采购单、PCS 花型任务。
- 操作记录：用 mock 文案展示上传、确认、系统同步。

关闭抽屉使用 `data-nav="/fcs/production/preparation-timing?tab=ledger"`。

- [ ] **步骤 8：实现花型师分配区域**

花型准备项卡片中必须有 `分配花型师` 入口：

```html
<button data-nav="/fcs/production/preparation-timing?tab=ledger&recordId=...&action=assign&itemId=...">
  分配花型师
</button>
```

当 `action=assign` 时，在抽屉内渲染分配区域：

- 花型团队 select：中国花型组、Bandung 花型组、Jakarta 花型组。
- 花型师 select：冰冰、林小美、Diah、Sari。
- 分配说明 textarea。
- 按钮 `确认分配` 使用 `data-nav-from-fields` 形成演示导航。
- 成功态通过 query 中的 `mockAssignedDesigner` 渲染提示：`已模拟分配给 林小美`。

- [ ] **步骤 9：实现上传完成图片区域**

花型准备项卡片中必须有 `上传完成图片` 入口：

```html
<button data-nav="/fcs/production/preparation-timing?tab=ledger&recordId=...&action=upload&itemId=...">
  上传完成图片
</button>
```

当 `action=upload` 时，在抽屉内渲染上传区域：

- 完成确认图片：`<input type="file" accept="image/*" multiple>`
- 花型文件：`<input type="file" accept=".ai,.psd,.pdf,.png,.jpg,.jpeg" multiple>`
- 买手确认状态：未提交、待确认、已通过、需调整。
- 按钮 `提交完成资料` 使用 `data-prod-action="noop"`，避免真实存储。
- 如果当前 mock 中已有 `completionImageIds` 和 `patternFileIds`，展示缩略证据和文件数。

- [ ] **步骤 10：实现月度统计页签**

月度统计页包含：

- 顶部口径说明。
- 筛选区：统计月份、准备项类型、责任团队、跟单、是否超时。
- 汇总卡片：本月完成准备项、按时完成、超时完成、平均耗时、花型完成、染色完成。
- 统计表：统计月份、准备项、完成数量、按时完成数量、超时完成数量、平均耗时小时、责任团队、最近完成时间、口径说明。
- 明细表：统计月份、准备记录编号、SPU、商品名、生产单号、买手、跟单、准备项、责任团队、责任人、计划完成时间、实际完成时间、是否超时、证据摘要。
- CSV 链接：`导出月度统计`、`导出完成明细`。

- [ ] **步骤 11：运行页面检查并确认脚本进入菜单路由失败**

```bash
cd /Users/laoer/Documents/higoods
npm run check:production-preparation-timing
```

预期：FAIL，页面渲染断言通过，后续失败集中在菜单、路由或 renderer。

- [ ] **步骤 12：Commit**

```bash
git add src/pages/production/preparation-timing.ts
git commit -m "feat: add production preparation timing page"
```

---

### 任务 4：菜单、路由和 renderer 接入

**文件：**
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/route-renderers.ts`
- 修改：`src/router/routes-fcs.ts`

- [ ] **步骤 1：接入菜单**

在 `src/data/app-shell-config.ts` 的 `fcs-platform-production` children 中，在 `production-plan` 后插入：

```typescript
{ key: 'production-preparation-timing', title: '生产准备时效', icon: 'TimerReset', href: '/fcs/production/preparation-timing' },
```

- [ ] **步骤 2：接入 FCS renderer**

在 `src/router/route-renderers-fcs.ts` 的生产单 renderer 区域加入：

```typescript
export const renderProductionPreparationTimingPage = createAsyncRenderer(
  () => import('../pages/production/preparation-timing'),
  'renderProductionPreparationTimingPage',
)
```

- [ ] **步骤 3：接入全局 renderer 文件**

在 `src/router/route-renderers.ts` 同样加入：

```typescript
export const renderProductionPreparationTimingPage = createAsyncRenderer(
  () => import('../pages/production/preparation-timing'),
  'renderProductionPreparationTimingPage',
)
```

- [ ] **步骤 4：接入 FCS 路由**

在 `src/router/routes-fcs.ts` import 列表加入 `renderProductionPreparationTimingPage`。

在 exactRoutes 的生产单路由段加入：

```typescript
'/fcs/production/preparation-timing': () => renderProductionPreparationTimingPage(),
```

插入位置在：

- `/fcs/production/plan`
- `/fcs/production/delivery-warehouse`

之间。

- [ ] **步骤 5：运行自检**

```bash
cd /Users/laoer/Documents/higoods
npm run check:production-preparation-timing
```

预期：PASS，输出包含 `production preparation timing checks passed`。

- [ ] **步骤 6：Commit**

```bash
git add src/data/app-shell-config.ts src/router/route-renderers-fcs.ts src/router/route-renderers.ts src/router/routes-fcs.ts
git commit -m "feat: wire production preparation timing route"
```

---

### 任务 5：收口验证和浏览器验收

**文件：**
- 可能修改：`src/pages/production/preparation-timing.ts`
- 可能修改：`src/data/fcs/production-preparation-timing.ts`
- 可能修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：运行专项检查**

```bash
cd /Users/laoer/Documents/higoods
npm run check:production-preparation-timing
```

预期输出：

```text
production preparation timing checks passed
```

- [ ] **步骤 2：运行构建**

```bash
cd /Users/laoer/Documents/higoods
npm run build
```

预期：Vite 构建成功，无 TypeScript 或 import 错误。

- [ ] **步骤 3：启动本地服务**

```bash
cd /Users/laoer/Documents/higoods
npm run dev -- --host 0.0.0.0 --port 5173
```

如果 5173 已占用，改用 5174 或下一个可用端口。

- [ ] **步骤 4：验证路由可达**

```bash
curl -I http://127.0.0.1:5173/fcs/production/preparation-timing
```

预期：HTTP 200。

- [ ] **步骤 5：浏览器验收**

用 Playwright 或手工浏览器检查：

- 菜单路径 `FCS -> 生产单管理 -> 生产准备时效` 可见。
- 进入页面后默认显示 `准备台账`。
- 切换 `月度统计` 页签可见。
- 花型师筛选 `林小美` 能收窄列表。
- 快捷筛选 `我的花型任务`、`待上传完成图`、`待买手确认` 可见并能导航。
- 打开详情抽屉可看到准备项时间线和花型任务字段。
- 点击 `分配花型师` 可看到分配区域。
- 点击 `上传完成图片` 可看到上传区域。
- `导出月度统计` 和 `导出完成明细` 链接含 CSV data URI 和正确文件名。
- 页面在 1366 x 768 下没有明显重叠。

- [ ] **步骤 6：中文和范围复核**

运行：

```bash
cd /Users/laoer/Documents/higoods
rg -n "PENDING|DONE|IN_PROGRESS|CANCELLED|ON_HOLD" src/pages/production/preparation-timing.ts src/data/fcs/production-preparation-timing.ts
rg -n "fetch\\(|axios|localStorage|zustand|createRoot|React" src/pages/production/preparation-timing.ts src/data/fcs/production-preparation-timing.ts
```

预期：无输出。

- [ ] **步骤 7：同步 CodeGraph**

```bash
cd /Users/laoer/Documents/higoods
codegraph sync
codegraph status
```

预期：`Already up to date` 或同步成功，`Files indexed` 正常显示。

- [ ] **步骤 8：最终 Commit**

如果任务 5 有收口修改：

```bash
git add src/pages/production/preparation-timing.ts src/data/fcs/production-preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "fix: polish production preparation timing prototype"
```

如果任务 5 没有文件修改，不创建空提交。

---

## 实施完成标准

- `npm run check:production-preparation-timing` 通过。
- `npm run build` 通过。
- `codegraph sync` 和 `codegraph status` 已运行。
- 菜单 `FCS -> 生产单管理 -> 生产准备时效` 可见。
- `/fcs/production/preparation-timing` 可访问。
- 页面含 `准备台账` 和 `月度统计` 两个页签。
- 准备记录不少于 12 条，准备项不少于 70 条。
- 月度统计导出按 `生产准备记录 + 准备项 = 1` 计数。
- 花型准备项能展示并筛选花型师，且有分配与上传原型区域。
- 页面不展示英文状态码。
- 未引入后端、权限、真实上传、React 迁移或新依赖。
