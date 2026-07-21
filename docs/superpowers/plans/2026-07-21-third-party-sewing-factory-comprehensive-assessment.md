# 三方车缝厂综合评定实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在「工厂池管理」下交付独立的「三方车缝厂综合评定」展示原型，以五维分组标准列表呈现全部三方车缝厂，并允许维护品类能力、产能和综合评级。

**架构：** 新增一个独立数据模块，组合工厂主档身份、人工综合评定快照以及与现有时效／品控口径一致的 Mock 事实；页面只读取该模块，不调用或回写生产、交出、质检、派单、结算模块。页面复用标准列表页能力，并对公共标准表格增加最小的可选分组表头支持；编辑抽屉只局部更新当前行、统计和完成状态。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `src/components/ui/` 标准列表组件、Node.js 检查脚本。

---

## 文件结构

### 创建

- `src/data/fcs/third-party-factory-comprehensive-assessment.ts`：定义 5 维综合评定模型、11 项品类字典、人工快照存储、独立时效／质检 Mock 事实和聚合函数。
- `src/pages/third-party-factory-comprehensive-assessment.ts`：标准列表页、五维完成筛选、分组宽表、来源标识、编辑抽屉和局部交互。
- `scripts/check-third-party-factory-comprehensive-assessment.ts`：集中验证身份覆盖、计算公式、完成状态、页面结构、来源颜色、路由菜单和事件入口。
- `docs/prototype-review-records/2026-07-21-third-party-sewing-factory-comprehensive-assessment.md`：记录印尼工厂产品设计治理自查。

### 修改

- `src/components/ui/list-table.ts:10-236`：为标准列表表格增加可选的分组表头，不影响未传分组配置的现有列表页。
- `scripts/check-standard-list-page-template.ts`：补充分组表头公共组件回归断言。
- `src/router/route-renderers-fcs.ts:38-44`：新增异步页面 renderer。
- `src/router/routes-fcs.ts:200-207`：注册精确路由。
- `src/data/app-shell-config.ts:248-258`：在「三方工厂评级」之后新增菜单。
- `src/main-handlers/fcs-handlers.ts:1-40,282-300`：接入页面 submit 和事件分发。
- `package.json:scripts`：新增聚合检查命令。

## 任务 1：为标准列表增加可选分组表头

**文件：**

- 修改：`src/components/ui/list-table.ts:10-236`
- 修改：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：编写失败的公共组件检查**

在 `scripts/check-standard-list-page-template.ts` 中增加以下测试场景：

```ts
const groupedHtml = renderStandardListTable({
  columns: [
    { key: 'factory', title: '工厂', width: 160, render: (row: { factory: string }) => row.factory },
    { key: 'craft', title: '工艺能力', width: 120, render: () => '车缝' },
    { key: 'category', title: '品类能力', width: 120, render: () => '衬衫' },
    { key: 'actions', title: '操作', width: 90, actionColumn: true, render: () => '编辑' },
  ],
  rows: [{ factory: 'PT Sinar' }],
  preferences: {
    order: ['factory', 'craft', 'category', 'actions'],
    visibleKeys: ['factory', 'craft', 'category', 'actions'],
    frozenKeys: [],
    pageSize: 10,
  },
  sort: null,
  eventPrefix: 'grouped-list-test',
  headerGroups: [
    { key: 'factory', title: '工厂信息', columnKeys: ['factory'] },
    { key: 'ability', title: '能力', columnKeys: ['craft', 'category'], toneClass: 'bg-indigo-50 text-indigo-700' },
    { key: 'actions', title: '操作', columnKeys: ['actions'] },
  ],
})

assert.ok(groupedHtml.includes('data-standard-list-header-group="ability"'))
assert.ok(groupedHtml.includes('colspan="2"'))
assert.ok(groupedHtml.includes('能力'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:standard-list-page-template
```

预期：TypeScript 报错 `headerGroups` 不属于 `StandardListTableConfig`。

- [ ] **步骤 3：增加最小分组表头接口**

在 `src/components/ui/list-table.ts` 中增加：

```ts
export interface StandardListHeaderGroup {
  key: string
  title: string
  columnKeys: readonly string[]
  toneClass?: string
}

export interface StandardListTableConfig<T> {
  columns: readonly StandardListColumn<T>[]
  rows: readonly T[]
  preferences: StandardListColumnPreferences
  sort: StandardListSortState | null
  eventPrefix: string
  emptyText?: string
  headerGroups?: readonly StandardListHeaderGroup[]
}
```

新增仅根据当前可见列生成分组行的函数：

```ts
function renderHeaderGroups<T>(
  columns: readonly StandardListColumn<T>[],
  groups: readonly StandardListHeaderGroup[] | undefined,
): string {
  if (!groups?.length) return ''
  const visibleKeys = new Set(columns.map((column) => column.key))
  const cells = groups.flatMap((group) => {
    const keys = group.columnKeys.filter((key) => visibleKeys.has(key))
    if (!keys.length) return []
    return [`<th colspan="${keys.length}" class="h-9 border-b border-r px-3 text-center text-xs font-semibold ${group.toneClass ?? 'bg-muted/30 text-foreground'}" data-standard-list-header-group="${escapeHtml(group.key)}">${escapeHtml(group.title)}</th>`]
  }).join('')
  return cells ? `<tr>${cells}</tr>` : ''
}
```

在 `<thead>` 中把分组行放在原列标题行之前。未传 `headerGroups` 时输出必须与现有行为一致。

- [ ] **步骤 4：运行公共组件检查**

运行：

```bash
npm run check:standard-list-page-template
```

预期：PASS，现有标准列表检查和新增分组表头断言同时通过。

- [ ] **步骤 5：提交公共组件变更**

```bash
git add src/components/ui/list-table.ts scripts/check-standard-list-page-template.ts
git commit -m "feat(列表): 支持五维分组表头"
```

## 任务 2：建立独立综合评定数据与计算模型

**文件：**

- 创建：`src/data/fcs/third-party-factory-comprehensive-assessment.ts`
- 创建：`scripts/check-third-party-factory-comprehensive-assessment.ts`
- 修改：`package.json:scripts`

- [ ] **步骤 1：编写失败的数据模型检查**

创建 `scripts/check-third-party-factory-comprehensive-assessment.ts`，先写以下核心断言：

```ts
import assert from 'node:assert/strict'
import {
  WOMENSWEAR_CATEGORY_OPTIONS,
  calculateFactoryQualityMetrics,
  calculateFactoryTimelinessMetrics,
  getAssessmentCompletion,
  listThirdPartyFactoryComprehensiveAssessments,
} from '../src/data/fcs/third-party-factory-comprehensive-assessment.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

assert.deepEqual(WOMENSWEAR_CATEGORY_OPTIONS, [
  '衬衫', 'T 恤', '马甲', '背心', '连衣裙', '休闲连体裤',
  '西装连体裤', '休闲套装', '西装套装', '裤子', '半裙',
])

const thirdPartySewingIds = listFactoryMasterRecords()
  .filter((factory) => factory.factoryTier === 'THIRD_PARTY')
  .filter((factory) => factory.factoryType === 'THIRD_SEWING' || factory.processAbilities.some((ability) => ability.processCode === 'SEW'))
  .map((factory) => factory.id)

const rows = listThirdPartyFactoryComprehensiveAssessments()
assert.deepEqual(new Set(rows.map((row) => row.factoryId)), new Set(thirdPartySewingIds))

assert.deepEqual(calculateFactoryQualityMetrics([
  { inspectedQty: 100, reworkQty: 4, factoryLiabilityDefectQty: 2 },
  { inspectedQty: 100, reworkQty: 6, factoryLiabilityDefectQty: 8 },
]), { defectiveRate: 0.1, defectRate: 0.05, reworkRate: 0.05 })

assert.equal(calculateFactoryQualityMetrics([{ inspectedQty: 0, reworkQty: 0, factoryLiabilityDefectQty: 0 }]), null)

const timing = calculateFactoryTimelinessMetrics([
  {
    allocatedQty: 100,
    acceptedAt: '2026-07-01 08:00:00',
    taskKind: 'INDEPENDENT_SEWING',
    submittedQty: 100,
    submittedReachedAt: '2026-07-09 07:00:00',
    receiptMilestones: { 0.3: '2026-07-05 07:00:00', 0.7: '2026-07-09 07:00:00', 1: '2026-07-10 07:00:00' },
  },
], '2026-07-12 08:00:00')
assert.deepEqual(timing, { deliveryOnTimeRate: 1, return30OnTimeRate: 1, return70OnTimeRate: 1, return100OnTimeRate: 1 })

assert.deepEqual(getAssessmentCompletion({
  craftAbilities: ['车缝'], categoryAbilities: ['衬衫'], machineCount: 30,
  workerCount: 50, monthlyOutputValueTenThousandIdr: 600,
  timeliness: timing, quality: { defectiveRate: 0.02, defectRate: 0.01, reworkRate: 0.01 }, grade: 'A',
}), { ability: true, capacity: true, timeliness: true, quality: true, rating: true, incompleteCount: 0 })
```

在 `package.json` 中先增加：

```json
"check:third-party-comprehensive-assessment": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-third-party-factory-comprehensive-assessment.ts"
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:third-party-comprehensive-assessment
```

预期：FAIL，报错找不到 `third-party-factory-comprehensive-assessment.ts`。

- [ ] **步骤 3：实现数据类型、品类字典和工厂范围**

创建数据文件并定义：

```ts
export const WOMENSWEAR_CATEGORY_OPTIONS = [
  '衬衫', 'T 恤', '马甲', '背心', '连衣裙', '休闲连体裤',
  '西装连体裤', '休闲套装', '西装套装', '裤子', '半裙',
] as const

export type WomenswearCategory = (typeof WOMENSWEAR_CATEGORY_OPTIONS)[number]
export type ComprehensiveGrade = 'S' | 'A' | 'B' | 'C'
export type CompletionFilter = 'ALL' | 'COMPLETE' | 'INCOMPLETE'

export interface FactoryManualAssessmentSnapshot {
  factoryId: string
  categoryAbilities: WomenswearCategory[]
  machineCount: number | null
  workerCount: number | null
  monthlyOutputValueTenThousandIdr: number | null
  grade: ComprehensiveGrade | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface FactoryQualityFact {
  inspectedQty: number
  reworkQty: number
  factoryLiabilityDefectQty: number
}

export interface FactoryTimelinessFact {
  allocatedQty: number
  acceptedAt: string
  taskKind: 'INDEPENDENT_SEWING' | 'SEWING_TO_PACKAGING' | 'CUTTING_TO_PACKAGING'
  submittedQty: number
  submittedReachedAt: string | null
  receiptMilestones: Partial<Record<0.3 | 0.7 | 1, string>>
}
```

从 `listFactoryMasterRecords()` 中筛选 `factoryTier === 'THIRD_PARTY'` 且具备车缝类型或 `SEW` 工序能力的工厂，使用工厂 `id` 作为唯一关联键。不得在本数据文件中另造工厂身份。

- [ ] **步骤 4：实现时效和品控聚合函数**

按规格实现：

```ts
const milestoneDaysByKind = {
  INDEPENDENT_SEWING: { 0.3: 4, 0.7: 8, 1: 9 },
  SEWING_TO_PACKAGING: { 0.3: 5, 0.7: 9, 1: 10 },
  CUTTING_TO_PACKAGING: { 0.3: 6, 0.7: 9, 1: 12 },
} as const

export function calculateFactoryQualityMetrics(facts: readonly FactoryQualityFact[]) {
  const totals = facts.reduce((sum, fact) => ({
    inspectedQty: sum.inspectedQty + Math.max(0, fact.inspectedQty),
    reworkQty: sum.reworkQty + Math.max(0, fact.reworkQty),
    defectQty: sum.defectQty + Math.max(0, fact.factoryLiabilityDefectQty),
  }), { inspectedQty: 0, reworkQty: 0, defectQty: 0 })
  if (totals.inspectedQty <= 0) return null
  return {
    defectiveRate: Number(((totals.reworkQty + totals.defectQty) / totals.inspectedQty).toFixed(4)),
    defectRate: Number((totals.defectQty / totals.inspectedQty).toFixed(4)),
    reworkRate: Number((totals.reworkQty / totals.inspectedQty).toFixed(4)),
  }
}
```

时效函数使用完整 24 小时计算截止时间；交付完成按 `submittedReachedAt` 与 100% 截止时间比较，回货按 `receiptMilestones` 比较。尚未到截止时间且尚未达标的任务不计入分母；没有有效分母时对应指标返回 `null`。

- [ ] **步骤 5：补足独立 Mock 场景和人工快照写入**

为当前主档中的三方车缝厂生成不少于 10 种差异场景：完整 S、完整 A、产能缺失、品类缺失、无时效数据、无质检数据、时效差品控好、品控差时效好、评级缺失、工艺能力缺失。

人工快照使用独立浏览器存储键：

```ts
const STORAGE_KEY = 'fcs_third_party_comprehensive_assessment_v1'
```

只导出 `listThirdPartyFactoryComprehensiveAssessments()`、`getThirdPartyFactoryComprehensiveAssessment()` 和 `updateThirdPartyFactoryManualAssessment()`；更新函数只接受品类、产能、评级、更新人和更新时间，不接受时效或品控字段。

- [ ] **步骤 6：运行数据模型检查**

运行：

```bash
npm run check:third-party-comprehensive-assessment
```

预期：PASS，输出「三方车缝厂综合评定检查通过」。

- [ ] **步骤 7：提交数据模型**

```bash
git add package.json src/data/fcs/third-party-factory-comprehensive-assessment.ts scripts/check-third-party-factory-comprehensive-assessment.ts
git commit -m "feat(工厂池): 建立三方车缝厂综合评定数据"
```

## 任务 3：实现五维标准列表与完成筛选

**文件：**

- 创建：`src/pages/third-party-factory-comprehensive-assessment.ts`
- 修改：`scripts/check-third-party-factory-comprehensive-assessment.ts`

- [ ] **步骤 1：增加失败的页面结构检查**

在聚合检查脚本中增加：

```ts
import { renderThirdPartyFactoryComprehensiveAssessmentPage } from '../src/pages/third-party-factory-comprehensive-assessment.ts'

const pageHtml = renderThirdPartyFactoryComprehensiveAssessmentPage()
for (const text of [
  '三方车缝厂综合评定', '能力', '产能', '时效', '品控', '评级',
  '工艺能力', '品类能力', '机器台数', '工人人数', '月产值',
  '交付完成', '30% 回货', '70% 回货', '100% 回货',
  '不良品率', '瑕疵率', '返工率', '编辑评定',
]) assert.ok(pageHtml.includes(text), `页面缺少：${text}`)

assert.ok(pageHtml.includes('@page-pattern: list') === false, '页面源码标记不应渲染到 HTML')
assert.ok(pageHtml.includes('data-standard-list-header-group="ability"'))
assert.ok(pageHtml.includes('系统获取'))
assert.ok(pageHtml.includes('人工填写'))
assert.ok(pageHtml.includes('data-completion-filter="ability"'))
assert.ok(pageHtml.includes('data-completion-filter="capacity"'))
assert.ok(pageHtml.includes('data-completion-filter="timeliness"'))
assert.ok(pageHtml.includes('data-completion-filter="quality"'))
assert.ok(pageHtml.includes('data-completion-filter="rating"'))
```

同时读取页面源码，断言包含 `// @page-pattern: list`、`renderStandardListPage`、`renderStandardListTable` 和 `renderTablePagination`。

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:third-party-comprehensive-assessment
```

预期：FAIL，报错找不到页面文件。

- [ ] **步骤 3：实现查询、筛选、统计和分页**

页面顶部声明：

```ts
// @page-pattern: list
```

定义查询结构：

```ts
interface AssessmentQuery {
  keyword: string
  categories: string[]
  grade: 'ALL' | 'S' | 'A' | 'B' | 'C'
  ability: CompletionFilter
  capacity: CompletionFilter
  timeliness: CompletionFilter
  quality: CompletionFilter
  rating: CompletionFilter
  page: number
  pageSize: number
  sortKey: string
  sortDirection: StandardListSortDirection | ''
  editFactoryId: string
  columnSettings: boolean
}
```

筛选组之间使用 AND；品类能力组内使用 OR。统计卡按筛选结果计算「全部工厂、评定已完善、待完善、S／A／B／C 分布」，并位于筛选区之后、列表之前。

- [ ] **步骤 4：实现五维分组列**

列键固定为：

```ts
const columnKeys = [
  'factory', 'craftAbility', 'categoryAbility',
  'machineCount', 'workerCount', 'monthlyOutputValue',
  'deliveryCompleted', 'return30', 'return70', 'return100',
  'defectiveRate', 'defectRate', 'reworkRate', 'grade', 'actions',
] as const
```

分组配置：

```ts
const headerGroups = [
  { key: 'factory', title: '工厂信息', columnKeys: ['factory'] },
  { key: 'ability', title: '能力', columnKeys: ['craftAbility', 'categoryAbility'], toneClass: 'bg-indigo-50 text-indigo-700' },
  { key: 'capacity', title: '产能', columnKeys: ['machineCount', 'workerCount', 'monthlyOutputValue'], toneClass: 'bg-amber-50 text-amber-700' },
  { key: 'timeliness', title: '时效', columnKeys: ['deliveryCompleted', 'return30', 'return70', 'return100'], toneClass: 'bg-emerald-50 text-emerald-700' },
  { key: 'quality', title: '品控', columnKeys: ['defectiveRate', 'defectRate', 'reworkRate'], toneClass: 'bg-rose-50 text-rose-700' },
  { key: 'rating', title: '评级', columnKeys: ['grade'], toneClass: 'bg-violet-50 text-violet-700' },
  { key: 'actions', title: '操作', columnKeys: ['actions'] },
] as const
```

每个值单独渲染来源标签：绿色显示「工厂档案／时效业务数据／质检业务数据」，蓝色显示「人工填写」，空值显示灰色「待完善／暂无业务数据」。

- [ ] **步骤 5：实现列设置和分页**

沿用现有标准列表偏好模型，存储键固定为：

```ts
const COLUMN_STORAGE_KEY = 'fcs.third-party-comprehensive-assessment.columns.v1'
```

工厂、综合评级、操作列声明为 `required`；操作列声明为 `actionColumn`；默认每页 10 条，支持 10、20、50 条。

- [ ] **步骤 6：运行页面结构检查**

运行：

```bash
npm run check:third-party-comprehensive-assessment
npm run check:list-page-governance:static
```

预期：两个命令均 PASS。

- [ ] **步骤 7：提交列表页**

```bash
git add src/pages/third-party-factory-comprehensive-assessment.ts scripts/check-third-party-factory-comprehensive-assessment.ts
git commit -m "feat(工厂池): 展示五维综合评定列表"
```

## 任务 4：实现编辑抽屉和局部更新

**文件：**

- 修改：`src/pages/third-party-factory-comprehensive-assessment.ts`
- 修改：`scripts/check-third-party-factory-comprehensive-assessment.ts`

- [ ] **步骤 1：增加失败的编辑边界检查**

在检查脚本中断言：

```ts
assert.ok(pageHtml.includes('编辑综合评定'))
assert.ok(pageHtml.includes('保存评定'))
assert.ok(pageHtml.includes('工厂档案，只读'))
assert.ok(pageHtml.includes('时效业务数据，只读'))
assert.ok(pageHtml.includes('质检业务数据，只读'))

const pageSource = readFileSync('src/pages/third-party-factory-comprehensive-assessment.ts', 'utf8')
assert.ok(pageSource.includes('updateThirdPartyFactoryManualAssessment'))
assert.ok(pageSource.includes('refreshAssessmentRow'))
assert.ok(pageSource.includes('refreshAssessmentStats'))
assert.ok(!pageSource.includes('root.innerHTML'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:third-party-comprehensive-assessment
```

预期：FAIL，提示缺少编辑抽屉或局部刷新函数。

- [ ] **步骤 3：实现编辑抽屉**

抽屉只提供以下表单字段：

```ts
interface ManualAssessmentFormValue {
  categoryAbilities: WomenswearCategory[]
  machineCount: number
  workerCount: number
  monthlyOutputValueTenThousandIdr: number
  grade: ComprehensiveGrade
}
```

校验规则：品类至少 1 项；机器台数、工人人数为正整数；月产值大于 0；评级只能为 S、A、B、C。抽屉同时只读展示工艺能力、时效和品控及绿色来源标签。

- [ ] **步骤 4：实现事件和局部刷新**

导出：

```ts
export function handleThirdPartyFactoryComprehensiveAssessmentSubmit(form: HTMLFormElement): boolean
export function handleThirdPartyFactoryComprehensiveAssessmentEvent(target: HTMLElement, event?: Event): boolean
```

保存成功后调用：

```ts
refreshAssessmentRow(factoryId)
refreshAssessmentStats()
refreshAssessmentCompletionSummary()
```

上述函数只替换带有明确 `data-assessment-*` 标记的当前行、统计容器和完成摘要；不得调用 `root.innerHTML`。图标 hydration 仅作用于被替换节点。

- [ ] **步骤 5：运行交互边界检查**

运行：

```bash
npm run check:third-party-comprehensive-assessment
```

预期：PASS。

- [ ] **步骤 6：提交编辑交互**

```bash
git add src/pages/third-party-factory-comprehensive-assessment.ts scripts/check-third-party-factory-comprehensive-assessment.ts
git commit -m "feat(工厂池): 支持维护综合评定"
```

## 任务 5：接入菜单、路由和 FCS 事件分发

**文件：**

- 修改：`src/router/route-renderers-fcs.ts:38-44`
- 修改：`src/router/routes-fcs.ts:200-207`
- 修改：`src/data/app-shell-config.ts:248-258`
- 修改：`src/main-handlers/fcs-handlers.ts:1-40,282-300`
- 修改：`scripts/check-third-party-factory-comprehensive-assessment.ts`

- [ ] **步骤 1：增加失败的接入检查**

```ts
const routeRendererSource = readFileSync('src/router/route-renderers-fcs.ts', 'utf8')
const routesSource = readFileSync('src/router/routes-fcs.ts', 'utf8')
const shellSource = readFileSync('src/data/app-shell-config.ts', 'utf8')
const handlerSource = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')

assert.ok(routeRendererSource.includes('renderThirdPartyFactoryComprehensiveAssessmentPage'))
assert.ok(routesSource.includes("'/fcs/factories/third-party-comprehensive-assessment'"))
assert.ok(shellSource.includes("title: '三方车缝厂综合评定'"))
assert.ok(handlerSource.includes('handleThirdPartyFactoryComprehensiveAssessmentEvent'))
assert.ok(handlerSource.includes('handleThirdPartyFactoryComprehensiveAssessmentSubmit'))
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
npm run check:third-party-comprehensive-assessment
```

预期：FAIL，提示缺少 renderer、路由、菜单和事件入口。

- [ ] **步骤 3：接入 renderer 和精确路由**

在 `route-renderers-fcs.ts` 增加：

```ts
export const renderThirdPartyFactoryComprehensiveAssessmentPage = createAsyncRenderer(
  () => import('../pages/third-party-factory-comprehensive-assessment'),
  'renderThirdPartyFactoryComprehensiveAssessmentPage',
)
```

在 `routes-fcs.ts` 的三方工厂评级路由之后增加：

```ts
'/fcs/factories/third-party-comprehensive-assessment': () => renderThirdPartyFactoryComprehensiveAssessmentPage(),
```

- [ ] **步骤 4：增加二级菜单**

在「三方工厂评级」之后、「工厂产能档案」之前增加：

```ts
{
  key: 'factories-third-party-comprehensive-assessment',
  title: '三方车缝厂综合评定',
  icon: 'ChartNoAxesCombined',
  href: '/fcs/factories/third-party-comprehensive-assessment',
},
```

- [ ] **步骤 5：接入 submit 和事件分发**

在 `fcs-handlers.ts` 导入两个 handler，并在工厂档案分支之前增加当前路径分发。只接收：

```ts
[
  '[data-third-party-comprehensive-assessment-action]',
  '[data-third-party-comprehensive-assessment-field]',
  '[data-standard-list-column-drag]',
].join(', ')
```

submit 分发只匹配综合评定筛选表单和编辑表单。

- [ ] **步骤 6：运行接入检查**

运行：

```bash
npm run check:third-party-comprehensive-assessment
npm run check:menu-routes
```

预期：两个命令均 PASS。

- [ ] **步骤 7：提交页面接入**

```bash
git add src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/data/app-shell-config.ts src/main-handlers/fcs-handlers.ts scripts/check-third-party-factory-comprehensive-assessment.ts
git commit -m "feat(工厂池): 接入综合评定菜单"
```

## 任务 6：完成治理记录和浏览器验收

**文件：**

- 创建：`docs/prototype-review-records/2026-07-21-third-party-sewing-factory-comprehensive-assessment.md`
- 修改：`scripts/check-third-party-factory-comprehensive-assessment.ts`

- [ ] **步骤 1：创建原型审查记录**

按 `docs/prototype-review-record-template.md` 填写：

- 系统：FCS。
- 页面：三方车缝厂综合评定。
- 端类型：管理端。
- 主要角色：工厂运营、业务人员、管理人员。
- 主要任务：横向比较、筛选未完善维度、维护人工评定字段。
- 重点结论：系统来源与人工来源区分；时效和品控只读；宽表在容器内部滚动；操作列固定；无真实跨模块串联。
- 最终结论：通过；无业务例外。

- [ ] **步骤 2：运行静态、治理和构建检查**

运行：

```bash
npm run check:third-party-comprehensive-assessment
npm run check:standard-list-page-template
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run build
```

预期：全部 PASS。

- [ ] **步骤 3：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：索引为最新状态，无 pending 文件。

- [ ] **步骤 4：启动局域网可访问的原型**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

若 5173 被占用，使用第一个可用端口并记录实际地址。

- [ ] **步骤 5：浏览器验收**

在 1366 × 768 和 1280 × 720 下验证：

1. 菜单位于「三方工厂评级」之后。
2. 页面覆盖全部三方车缝厂。
3. 筛选、统计、五维分组表头、分页顺序正确。
4. 5 个维度均可按已完成／未完成筛选。
5. 宽表只在表格容器内横向滚动。
6. 工厂列固定左侧，操作列固定右侧。
7. 绿色系统来源、蓝色人工来源、灰色空值可明确区分。
8. 编辑抽屉只能修改品类、产能和评级。
9. 保存后无整页闪烁，当前行和统计立即更新。
10. 与三方工厂评级、生产、交出、质检、派单、结算页面不存在跳转或回写。

- [ ] **步骤 6：验证局域网地址**

获取本机局域网 IP，并运行：

```bash
curl -I http://<局域网IP>:<实际端口>/fcs/factories/third-party-comprehensive-assessment
```

预期：HTTP 200。

- [ ] **步骤 7：提交治理记录和最终检查增强**

```bash
git add docs/prototype-review-records/2026-07-21-third-party-sewing-factory-comprehensive-assessment.md scripts/check-third-party-factory-comprehensive-assessment.ts
git commit -m "test(工厂池): 验收综合评定原型"
```

## 最终交付检查

- [ ] 设计规格中的每个范围均有对应任务。
- [ ] 没有真实跨模块读取、跳转、回写或评分联动。
- [ ] 没有英文状态码直接展示在页面。
- [ ] 没有将时效、品控字段开放为人工编辑。
- [ ] 没有将现有三方工厂初评结果复用为综合评级。
- [ ] 未改动无关模块和用户未提交文件。
- [ ] CodeGraph 已同步，治理检查、构建和浏览器验收均通过。
