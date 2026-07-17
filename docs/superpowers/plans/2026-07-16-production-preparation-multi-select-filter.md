# 生产准备时效多选筛选与准备项联动实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为生产准备台账、月度统计和明细统计补齐多选筛选、准备项与责任团队双向联动、同一准备项匹配和标准列表页能力，并保证准备项进度严格由确认、依赖和有效凭证派生。

**架构：** 数据层集中提供多选过滤、固定准备项团队映射、有效完成凭证与派生进度；页面层只负责解析重复 URL 参数、渲染复选框下拉和组合标准列表组件；通用导航仅补充同名复选框的 `append` 行为。台账与统计页共用准备项团队映射，但只有台账使用派生进度，统计口径仍以实际完成时间为准。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、Tailwind CSS、Node/tsx 检查脚本、Playwright、CodeGraph。

---

## 实施前提

- 设计规格：`docs/superpowers/specs/2026-07-16-production-preparation-multi-select-filter-design.md`
- 页面路由：`/fcs/production/preparation-timing`、`/fcs/production/preparation-timing-statistics`
- 执行前先创建隔离 worktree，不在当前含其他改动的 `main` 工作区直接实现。
- 每个任务只提交该任务列出的文件；不得带入当前工作区其他改动。
- 每次修改页面、组件、Mock、路由或交互后，同步更新本任务的原型审查记录。

## 文件与职责

**修改：**

- `src/data/fcs/production-preparation-timing.ts`
  - 定义多选筛选模型、固定准备项团队映射、有效完成凭证、派生进度和同一准备项过滤。
  - 补齐最少必要 Mock 场景，不改变现有上传、下载、辅料下单和统计口径。
- `src/pages/production/preparation-timing.ts`
  - 解析重复 URL 参数，渲染多选筛选和双向联动。
  - 将准备台账、月度统计、明细统计接入标准列表页、标准表格、标准分页和列设置。
  - 处理三个列表的排序、分页和列偏好。
- `src/pages/production/events.ts`
  - 让生产准备台账与统计页都能接收筛选联动和标准列表事件。
- `src/main.ts`
  - 通用字段导航对同名已勾选复选框使用 `URLSearchParams.append`。
- `scripts/check-production-preparation-timing.ts`
  - 增加数据完整性、派生进度、同项匹配、筛选结构、标准列表契约和 Mock 反例检查。

**创建：**

- `tests/production-preparation-timing-filters.spec.ts`
  - 验证三个列表的多选、联动、分页、列治理、URL 保留、视口和 200ms 响应。
- `docs/prototype-review-records/2026-07-16-production-preparation-multi-select-filter.md`
  - 记录角色、现场能力、列表治理、交互性能、Mock 与例外自查结论。

## 固定业务口径

```typescript
export type PreparationItemProgress = '不满足开始条件' | '未开始' | '已完成'

export const preparationItemOwnerTeamMap: Readonly<Record<PreparationItemType, string>> = {
  梭织基码纸样: '版师团队',
  毛织基码纸样: '毛织团队',
  版衣制作: '车板团队',
  梭织齐码纸样: '版师团队',
  毛织齐码纸样: '毛织团队',
  '数码印/DTF/DTG花型': '花型团队',
  '确认染色要求（纱线）': '跟单角色',
  '染色调色（纱线）': '染色团队',
  '确认染色要求（面料）': '跟单角色',
  '染色调色（面料）': '染色团队',
  辅料下单: '采购团队',
}
```

同组多选按“或”，不同组按“且”。准备项、责任团队、准备项进度必须由同一个准备项同时满足。

---

### 任务 1：锁定多选过滤、完成凭证与派生进度

**文件：**

- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`src/data/fcs/production-preparation-timing.ts:255-269`
- 修改：`src/data/fcs/production-preparation-timing.ts:1385-1490`

- [ ] **步骤 1：在检查脚本中导入新口径并编写失败检查**

在动态导入类型中加入：

```typescript
derivePreparationItemProgress: typeof import('../src/data/fcs/production-preparation-timing.ts').derivePreparationItemProgress
hasValidPreparationCompletionEvidence: typeof import('../src/data/fcs/production-preparation-timing.ts').hasValidPreparationCompletionEvidence
preparationItemOwnerTeamMap: typeof import('../src/data/fcs/production-preparation-timing.ts').preparationItemOwnerTeamMap
```

在现有过滤检查附近增加三个最小反例：

```typescript
const confirmedRecord = productionPreparationRecords.find((record) => record.workItemsConfirmedAt)
assert.ok(confirmedRecord, '测试数据必须存在已确认工作项记录')

const blockedItem = confirmedRecord.items.find((item) => item.dependsOnItemIds.length > 0)
assert.ok(blockedItem, '测试数据必须存在有前置依赖的准备项')
assert.equal(
  derivePreparationItemProgress(blockedItem, {
    ...confirmedRecord,
    items: confirmedRecord.items.map((item) =>
      blockedItem.dependsOnItemIds.includes(item.itemId)
        ? { ...item, status: '进行中', actualFinishAt: '', uploads: [] }
        : item),
  }),
  '不满足开始条件',
)

const accessoryWithoutOrder = {
  ...confirmedRecord.items.find((item) => item.itemType === '辅料下单')!,
  status: '已完成' as const,
  actualFinishAt: '2026-03-05T10:00',
  accessoryPurchaseOrderNos: [],
  accessoryPurchaseOrderedAts: [],
}
assert.equal(hasValidPreparationCompletionEvidence(accessoryWithoutOrder), false)
```

增加同一准备项匹配反例：一条记录内让 A 项满足 `itemTypes`，B 项满足 `ownerTeams`，断言记录不能命中。

```typescript
const sameItemCounterexample = {
  ...confirmedRecord,
  recordId: 'FILTER-SAME-ITEM-COUNTEREXAMPLE',
  items: [
    { ...confirmedRecord.items[0], itemType: '毛织基码纸样' as const, ownerTeam: '版师团队' },
    { ...confirmedRecord.items[1], itemType: '辅料下单' as const, ownerTeam: '采购团队' },
  ],
}
assert.deepEqual(
  filterProductionPreparationRecords(
    { itemTypes: ['毛织基码纸样'], ownerTeams: ['采购团队'] },
    [sameItemCounterexample],
  ),
  [],
)
```

- [ ] **步骤 2：运行检查并确认失败原因正确**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，TypeScript 或断言明确指出 `derivePreparationItemProgress`、`hasValidPreparationCompletionEvidence`、数组筛选字段尚不存在。

- [ ] **步骤 3：实现类型、固定映射和凭证判断**

将筛选接口改为数组模型；删除本次不再使用的单值筛选字段，但保留底层记录字段：

```typescript
export interface ProductionPreparationFilter {
  month?: string
  startDate?: string
  endDate?: string
  merchandiserNames?: string[]
  recordStatuses?: PreparationRecordStatus[]
  itemTypes?: PreparationItemType[]
  ownerTeams?: string[]
  itemProgresses?: PreparationItemProgress[]
  patternDesigner?: string
  keyword?: string
  quickFilter?: '我的花型任务' | '待上传完成图' | '待买手确认'
}
```

实现统一凭证判断：

```typescript
function hasValidUpload(upload: PreparationUploadRecord): boolean {
  return Boolean(upload.fileName && upload.uploadedBy && upload.uploadedAt)
}

export function hasValidPreparationCompletionEvidence(item: ProductionPreparationItem): boolean {
  if (item.status !== '已完成' || !item.actualFinishAt) return false
  if (item.itemType === '辅料下单') {
    return Boolean(
      item.accessoryPurchaseOrderNos?.length &&
      item.accessoryPurchaseOrderedAts?.length &&
      item.accessoryPurchaseOrderedAts.at(-1) === item.actualFinishAt,
    )
  }
  return Boolean(item.uploads?.some(hasValidUpload))
}
```

实现派生进度，前置项按有效凭证而不是只看状态：

```typescript
export function derivePreparationItemProgress(
  item: ProductionPreparationItem,
  record: ProductionPreparationRecord,
): PreparationItemProgress {
  if (!record.workItemsConfirmedBy || !record.workItemsConfirmedAt) return '不满足开始条件'
  const dependenciesCompleted = item.dependsOnItemIds.every((dependencyId) => {
    const dependency = record.items.find((candidate) => candidate.itemId === dependencyId)
    return Boolean(dependency && hasValidPreparationCompletionEvidence(dependency))
  })
  if (!dependenciesCompleted) return '不满足开始条件'
  return hasValidPreparationCompletionEvidence(item) ? '已完成' : '未开始'
}
```

- [ ] **步骤 4：改为同一准备项多条件匹配**

在记录级条件之后只做一次准备项 `.some()`：

```typescript
const itemFiltersActive = Boolean(
  filter.itemTypes?.length ||
  filter.ownerTeams?.length ||
  filter.itemProgresses?.length,
)

if (itemFiltersActive && !filterableItems.some((item) => {
  if (filter.itemTypes?.length && !filter.itemTypes.includes(item.itemType)) return false
  if (filter.ownerTeams?.length && !filter.ownerTeams.includes(item.ownerTeam)) return false
  if (
    filter.itemProgresses?.length &&
    !filter.itemProgresses.includes(derivePreparationItemProgress(item, record))
  ) return false
  return true
})) return false
```

记录级多选使用：

```typescript
if (filter.merchandiserNames?.length && !filter.merchandiserNames.includes(record.merchandiserName)) return false
if (filter.recordStatuses?.length && !filter.recordStatuses.includes(record.status)) return false
```

`matchesCompletionItemFilter` 同步使用 `itemTypes` 和 `ownerTeams`，不读取 `itemProgresses`，保证统计页只统计完成事实。

- [ ] **步骤 5：运行检查确认通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS，输出生产准备时效检查通过；同一准备项反例不命中，辅料无采购单号不能归为完成。

- [ ] **步骤 6：提交数据口径**

```bash
git add scripts/check-production-preparation-timing.ts src/data/fcs/production-preparation-timing.ts
git commit -m "feat: add production preparation multi-select semantics"
```

---

### 任务 2：补齐符合业务逻辑的 Mock 反例

**文件：**

- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`src/data/fcs/production-preparation-timing.ts:600-1323`

- [ ] **步骤 1：先写覆盖矩阵检查**

在检查脚本中为每条记录计算派生进度，并断言覆盖八类场景：

```typescript
const derivedRows = productionPreparationRecords.flatMap((record) =>
  record.items
    .filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
    .map((item) => ({ record, item, progress: derivePreparationItemProgress(item, record) })),
)

assert.ok(derivedRows.some(({ record, progress }) => !record.workItemsConfirmedAt && progress === '不满足开始条件'))
assert.ok(derivedRows.some(({ item, progress }) => item.dependsOnItemIds.length > 0 && progress === '不满足开始条件'))
assert.ok(derivedRows.some(({ item, progress }) => item.status === '待开始' && progress === '未开始'))
assert.ok(derivedRows.some(({ item, progress }) => ['进行中', '待确认', '已超时'].includes(item.status) && progress === '未开始'))
assert.ok(derivedRows.some(({ item, progress }) => item.itemType !== '辅料下单' && progress === '已完成' && item.uploads?.length))
assert.ok(derivedRows.some(({ item, progress }) => item.itemType === '辅料下单' && progress === '已完成' && (item.accessoryPurchaseOrderNos?.length ?? 0) > 1))
assert.ok(productionPreparationRecords.some((record) => new Set(record.items.map((item) => item.ownerTeam)).size >= 3))
```

对所有数据增加不变量检查：

```typescript
for (const { record, item, progress } of derivedRows) {
  if (progress === '已完成') {
    assert.equal(hasValidPreparationCompletionEvidence(item), true, `${record.recordNo}/${item.itemType} 完成但缺少凭证`)
  }
  if (!record.workItemsConfirmedAt) {
    assert.notEqual(progress, '已完成', `${record.recordNo} 未确认工作项却出现已完成准备项`)
  }
}
```

- [ ] **步骤 2：运行检查确认至少一个场景失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：如果现有 Mock 未覆盖某场景则 FAIL，并明确显示缺少的业务场景；若所有场景已覆盖，不改 Mock 数据，直接执行步骤 4。

- [ ] **步骤 3：只补缺失的最少 Mock 数据**

遵循以下约束修改现有记录或新增最少记录：

```typescript
{
  status: '未开始',
  workItemsConfirmedBy: '',
  workItemsConfirmedAt: '',
  items: items.map((item) => ({
    ...item,
    status: item.status === '无需' ? '无需' : '待判断',
    actualFinishAt: '',
    uploads: [],
    accessoryPurchaseOrderNos: [],
    accessoryPurchaseOrderedAts: [],
  })),
}
```

辅料多单号场景必须满足：

```typescript
{
  itemType: '辅料下单',
  status: '已完成',
  accessoryPurchaseOrderNos: ['FPO-MOCK-001', 'FPO-MOCK-002'],
  accessoryPurchaseOrderedAts: ['2026-03-08T10:00', '2026-03-10T14:30'],
  actualFinishAt: '2026-03-10T14:30',
  uploads: [],
}
```

不得为满足检查伪造“已完成但无上传记录”的普通准备项。

- [ ] **步骤 4：验证 Mock 和统计口径**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS；2026-03 月度完成数只包含具备有效凭证且实际完成时间在该月的准备项。

- [ ] **步骤 5：提交 Mock 覆盖**

```bash
git add scripts/check-production-preparation-timing.ts src/data/fcs/production-preparation-timing.ts
git commit -m "test: cover production preparation filter scenarios"
```

---

### 任务 3：实现重复 URL 参数、多选筛选和双向联动

**文件：**

- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`src/main.ts:1324-1342`
- 修改：`src/pages/production/preparation-timing.ts:1-440`
- 修改：`src/pages/production/preparation-timing.ts:2306-2360`
- 修改：`src/pages/production/events.ts:107-115`

- [ ] **步骤 1：先写页面结构与 URL 失败检查**

在检查脚本中增加源码和渲染断言：

```typescript
assertIncludes('src/main.ts', "params.append(field.name, value)", '同名复选框必须使用 append 保留全部值')
assertIncludes('src/pages/production/preparation-timing.ts', 'renderMultiSelectFilter', '生产准备筛选必须复用多选组件')
assert.ok(!source('src/pages/production/preparation-timing.ts').includes("renderSelectField('买手'"))
assert.ok(!source('src/pages/production/preparation-timing.ts').includes("renderSelectField('责任人'"))
assert.ok(!source('src/pages/production/preparation-timing.ts').includes("'overdueOnly'"))

const ledgerHtml = renderProductionPreparationTimingPage(
  '/fcs/production/preparation-timing?merchandiserName=Maya&merchandiserName=Raka&itemType=毛织基码纸样&ownerTeam=毛织团队&itemProgress=未开始',
)
assertHtmlIncludes(ledgerHtml, '跟单（2）', '跟单多选数量未回显')
assertHtmlIncludes(ledgerHtml, '准备项进度（1）', '台账缺少准备项进度')

const statsHtml = renderProductionPreparationTimingStatisticsPage(
  '/fcs/production/preparation-timing-statistics?tab=monthly&merchandiserName=Maya&merchandiserName=Raka',
)
assertHtmlIncludes(statsHtml, '跟单（2）', '统计页跟单多选数量未回显')
assert.ok(!statsHtml.includes('准备项进度'), '统计页不得出现准备项进度')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，页面仍显示买手、责任人、是否超时，重复参数只读取第一个值。

- [ ] **步骤 3：修复通用导航的复选框收集**

只改变复选框分支，不改变普通输入：

```typescript
scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  'input[name], select[name], textarea[name]',
).forEach((field) => {
  if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
    if (!field.checked) return
    const value = field.value.trim()
    if (!value) return
    if (field.type === 'checkbox') params.append(field.name, value)
    else params.set(field.name, value)
    return
  }
  const value = field.value.trim()
  if (value) params.set(field.name, value)
})
```

- [ ] **步骤 4：解析重复参数并保留查询条件**

在页面模块增加：

```typescript
function valuesOf(params: URLSearchParams, key: string): string[] {
  return Array.from(new Set(params.getAll(key).map((value) => value.trim()).filter(Boolean)))
}

function appendValues(params: URLSearchParams, key: string, values: readonly string[]): void {
  values.forEach((value) => params.append(key, value))
}
```

`parseFilter` 使用 `valuesOf` 构造数组；`buildPathHref` 和台账动作链接接收 `URLSearchParams` 或 `Array<[string, string]>`，不得再通过 `Object.fromEntries(params)` 丢失重复键。

- [ ] **步骤 5：渲染五类台账多选和四类统计多选**

导入 `renderMultiSelectFilter`，台账按固定顺序渲染：

```typescript
${renderMultiSelectFilter({
  label: '跟单',
  field: 'merchandiserName',
  selectedValues: valuesOf(params, 'merchandiserName'),
  options: options.merchandiserNames,
  actionAttr: 'data-prep-filter-field',
  skipPageRerender: true,
})}
${renderMultiSelectFilter({
  label: '记录状态',
  field: 'recordStatus',
  selectedValues: valuesOf(params, 'recordStatus'),
  options: options.recordStatuses.filter((value) => value !== '全部'),
  actionAttr: 'data-prep-filter-field',
  skipPageRerender: true,
})}
```

依次加入准备项、准备项进度、责任团队；统计页不渲染准备项进度。删除责任人和是否超时控件，关键词占位符改为“商品 / 生产单 / 准备项 / 跟单”。

- [ ] **步骤 6：实现准备项与团队双向联动的局部 DOM 更新**

为两个下拉的选项增加映射数据：

```html
<input
  type="checkbox"
  data-prep-filter-field="itemType"
  data-related-owner-team="毛织团队"
  name="itemType"
  value="毛织基码纸样"
>
```

页面事件中只更新选项可见性和摘要，不触发全页重绘：

```typescript
function syncPreparationFilterLinkage(input: HTMLInputElement): void {
  const scope = input.closest<HTMLElement>('[data-prep-filter-scope]')
  if (!scope) return
  const selectedItems = new Set(
    Array.from(scope.querySelectorAll<HTMLInputElement>('input[name="itemType"]:checked')).map((node) => node.value),
  )
  const selectedTeams = new Set(
    Array.from(scope.querySelectorAll<HTMLInputElement>('input[name="ownerTeam"]:checked')).map((node) => node.value),
  )
  scope.querySelectorAll<HTMLInputElement>('input[name="itemType"]').forEach((node) => {
    const team = node.dataset.relatedOwnerTeam || ''
    const visible = node.checked || selectedTeams.size === 0 || selectedTeams.has(team)
    node.closest<HTMLElement>('label')!.hidden = !visible
  })
  scope.querySelectorAll<HTMLInputElement>('input[name="ownerTeam"]').forEach((node) => {
    const relatedItems = (node.dataset.relatedItemTypes || '').split('|').filter(Boolean)
    const visible = node.checked || selectedItems.size === 0 || relatedItems.some((item) => selectedItems.has(item))
    node.closest<HTMLElement>('label')!.hidden = !visible
  })
}
```

`handleProductionPreparationTimingEvent` 识别 `[data-prep-filter-field]` 后调用该函数并返回 `false`。`isProductionPreparationTimingPath` 同时允许台账和统计路由：

```typescript
function isProductionPreparationTimingPath(): boolean {
  if (typeof window === 'undefined') return false
  return [
    '/fcs/production/preparation-timing',
    '/fcs/production/preparation-timing-statistics',
  ].includes(window.location.pathname)
}
```

- [ ] **步骤 7：运行检查确认通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS；台账与统计页显示正确多选数量，统计页没有进度筛选，重复 URL 参数未丢失。

- [ ] **步骤 8：提交筛选交互**

```bash
git add scripts/check-production-preparation-timing.ts src/main.ts src/pages/production/preparation-timing.ts src/pages/production/events.ts
git commit -m "feat: add production preparation multi-select filters"
```

---

### 任务 4：将准备台账接入标准列表页治理

**文件：**

- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`src/pages/production/preparation-timing.ts:1-929`

- [ ] **步骤 1：先写标准列表契约失败检查**

```typescript
const timingPageSource = source('src/pages/production/preparation-timing.ts')
assert.ok(timingPageSource.startsWith('// @page-pattern: list'), '生产准备时效页面必须声明标准列表页')
for (const contract of ['renderStandardListPage', 'renderStandardListTable', 'renderTablePagination']) {
  assert.ok(timingPageSource.includes(contract), `生产准备时效页面缺少 ${contract}`)
}

const ledgerHtml = renderProductionPreparationTimingPage('/fcs/production/preparation-timing?month=2026-03')
for (const marker of ['data-standard-list-page', 'data-standard-list-table-section', 'data-standard-list-scroll']) {
  assertHtmlIncludes(ledgerHtml, marker, `准备台账缺少 ${marker}`)
}
assertHtmlIncludes(ledgerHtml, 'data-column-key="actions"', '准备台账缺少固定操作列')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:production-preparation-timing
npm run check:list-page-governance
```

预期：FAIL，页面尚未声明或使用标准列表组件。

- [ ] **步骤 3：定义台账列、偏好和列表视图**

在文件首行加入 `// @page-pattern: list`，导入标准组件。定义：

```typescript
const listPageSizes = [5, 10, 20, 50]
const ledgerStorageKey = 'higood:list-page:/fcs/production/preparation-timing:ledger'
const ledgerColumnRules: StandardListColumnRule[] = [
  { key: 'product', required: true, freezeable: true },
  { key: 'people', freezeable: true },
  { key: 'timing', freezeable: true },
  { key: 'status', freezeable: true },
  { key: 'completion' },
  { key: 'outputs' },
  { key: 'actions', required: true, actionColumn: true },
]
```

列定义复用现有单元格渲染函数，不复制业务模板：

```typescript
const ledgerColumns: StandardListColumn<ProductionPreparationRecord>[] = [
  {
    key: 'product',
    title: '商品',
    width: 300,
    minWidth: 280,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (record) => record.spuCode,
    render: (record) => renderLedgerProductCell(record),
  },
  // people、timing、status、completion、outputs 继续按同样契约定义
  {
    key: 'actions',
    title: '操作',
    width: 210,
    minWidth: 190,
    required: true,
    actionColumn: true,
    render: (record) => renderLedgerActions(record, hasConfirmedWorkItems(record), activeMonth, activeParams),
  },
]
```

将当前行模板拆为 `renderLedgerProductCell`、`renderLedgerPeopleCell`、`renderLedgerTimingCell`，避免把 `<tr>` 交给标准表格。

- [ ] **步骤 4：接入排序、分页、列设置和持久化**

使用 URL 中的 `page` 和内存中的排序；列偏好按路由存入 localStorage：

```typescript
const sorted = sortStandardListRows(records, listState.ledger.sort, (record, key) =>
  ledgerColumns.find((column) => column.key === key)?.sortValue?.(record),
)
const paging = paginateStandardListRows(sorted, page, preferences.pageSize)
```

分页必须由：

```typescript
renderTablePagination({
  total: paging.total,
  from: paging.from,
  to: paging.to,
  currentPage: paging.currentPage,
  totalPages: paging.totalPages,
  pageSize: paging.pageSize,
  actionPrefix: 'production-preparation-ledger',
  fieldPrefix: 'production-preparation-ledger',
  pageSizeOptions: listPageSizes,
})
```

列设置使用 `renderStandardListColumnSettings`。事件实现三态排序、上一页、下一页、每页条数、显示列、冻结列、拖拽顺序和恢复默认；轻交互只刷新 `[data-prep-list-region="table"]`、`pagination`、`overlay`。

- [ ] **步骤 5：用标准列表页组合台账**

```typescript
return renderStandardListPage({
  title: '生产准备时效',
  primaryActionsHtml: renderHeaderActions(params, month),
  filtersHtml: renderLedgerFilter(params, month),
  statsHtml: renderKpis(records, month, filter),
  listTitle: '准备台账',
  listActionsHtml: renderLedgerColumnSettingsButton(),
  tableHtml: `<div data-prep-list-region="table">${renderLedgerStandardTable(paging)}</div>`,
  paginationHtml: `<div data-prep-list-region="pagination">${renderLedgerStandardPagination(paging)}</div>`,
  overlaysHtml: `<div data-prep-list-region="overlay">${renderLedgerOverlays(/* existing dialogs and drawer */)}</div>`,
})
```

标题不放入卡片，删除旧台账头部中的说明性文案。操作列由 `actionColumn: true` 固定在右侧。

- [ ] **步骤 6：运行台账与列表门禁**

运行：

```bash
npm run check:production-preparation-timing
npm run check:list-page-governance
```

预期：PASS；台账分页、排序、列设置和固定操作列契约齐全。

- [ ] **步骤 7：提交台账标准化**

```bash
git add scripts/check-production-preparation-timing.ts src/pages/production/preparation-timing.ts
git commit -m "feat: standardize production preparation ledger"
```

---

### 任务 5：将月度统计和明细统计接入标准列表页

**文件：**

- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`src/pages/production/preparation-timing.ts:1640-1930`

- [ ] **步骤 1：先写两个统计列表的失败检查**

```typescript
const monthlyHtml = renderProductionPreparationTimingStatisticsPage(
  '/fcs/production/preparation-timing-statistics?tab=monthly&month=2026-03',
)
const detailHtml = renderProductionPreparationTimingStatisticsPage(
  '/fcs/production/preparation-timing-statistics?tab=detail&month=2026-03',
)
assertHtmlIncludes(monthlyHtml, 'data-prep-list-kind="monthly"', '月度统计缺少标准列表标识')
assertHtmlIncludes(detailHtml, 'data-prep-list-kind="detail"', '明细统计缺少标准列表标识')
assertHtmlIncludes(monthlyHtml, 'data-column-key="month"', '月份列必须可点击进入明细')
assertHtmlIncludes(detailHtml, 'data-column-key="recordNo"', '明细缺少准备记录编号列')
assertHtmlIncludes(monthlyHtml, '条/页', '月度统计缺少分页')
assertHtmlIncludes(detailHtml, '条/页', '明细统计缺少分页')
```

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：FAIL，统计表仍是手写表格和旧分页。

- [ ] **步骤 3：定义月度统计和明细列**

分别定义两套规则与存储键：

```typescript
const monthlyStorageKey = 'higood:list-page:/fcs/production/preparation-timing-statistics:monthly'
const detailStorageKey = 'higood:list-page:/fcs/production/preparation-timing-statistics:detail'
```

月度统计列保留月份点击入口：

```typescript
{
  key: 'month',
  title: '统计月份',
  width: 120,
  required: true,
  freezeable: true,
  sortable: true,
  sortValue: () => month,
  render: () => `<button type="button" data-nav="${escapeHtml(buildDetailHref(params, month))}" class="text-blue-600 hover:underline">${escapeHtml(month)}</button>`,
}
```

构建明细链接时克隆原始参数并保留所有重复值，只覆盖 `tab=detail`、`detailPage=1`。

明细表保留现有 16 个业务字段；`recordNo`、`spuCode`、`productionOrderNo`、`itemType`、`ownerTeam`、`actualFinishAt` 声明可排序，关键标识列声明 `required`。

- [ ] **步骤 4：接入独立偏好、排序和分页**

月度统计使用 `monthlyPage`，明细统计使用 `detailPage`。每页条数分别从各自存储键加载；页码和排序不持久化。两个列表共用事件处理函数，但通过 `data-prep-list-kind` 区分状态。

统计页外层只调用一次 `renderStandardListPage`：

```typescript
return renderStandardListPage({
  title: '生产准备时效统计',
  primaryActionsHtml: renderStatsTabs(activeTab, month),
  feedbackHtml: renderStatsBasisNotice(),
  filtersHtml: renderStatsFilter(params, month, activeTab),
  statsHtml: activeTab === 'monthly' ? renderStatsSummary(details, stats) : '',
  listTitle: activeTab === 'monthly' ? '统计表' : '明细表',
  listActionsHtml: renderStatsListActions(activeTab, month, details, stats),
  tableHtml: renderActiveStatsTable(activeTab, params, month, details, stats),
  paginationHtml: renderActiveStatsPagination(activeTab, params, details, stats),
  overlaysHtml: renderStatsColumnSettings(activeTab),
})
```

- [ ] **步骤 5：验证统计口径与导出不回归**

运行：

```bash
npm run check:production-preparation-timing
npm run check:list-page-governance
```

预期：PASS；月度统计与明细统计都分页，月份仍可进入明细，CSV 导出数量与筛选后的统计数据一致。

- [ ] **步骤 6：提交统计页标准化**

```bash
git add scripts/check-production-preparation-timing.ts src/pages/production/preparation-timing.ts
git commit -m "feat: standardize production preparation statistics"
```

---

### 任务 6：浏览器、性能和设计治理验收

**文件：**

- 创建：`tests/production-preparation-timing-filters.spec.ts`
- 创建：`docs/prototype-review-records/2026-07-16-production-preparation-multi-select-filter.md`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：编写 Playwright 验收用例**

至少包含以下测试：

```typescript
import { expect, test, type Page } from '@playwright/test'

const ledgerRoute = '/fcs/production/preparation-timing?month=2026-03'
const statsRoute = '/fcs/production/preparation-timing-statistics?tab=monthly&month=2026-03'

test('台账多选、双向联动和重复 URL 参数保持', async ({ page }) => {
  await page.goto(ledgerRoute)
  await page.getByText('跟单', { exact: true }).click()
  await page.locator('input[name="merchandiserName"][value="Maya"]').check()
  await page.locator('input[name="merchandiserName"][value="Raka"]').check()
  await page.getByText('准备项', { exact: true }).click()
  await page.locator('input[name="itemType"][value="毛织基码纸样"]').check()
  await expect(page.locator('input[name="ownerTeam"][value="毛织团队"]')).toBeVisible()
  await expect(page.locator('input[name="ownerTeam"][value="采购团队"]')).toBeHidden()
  await page.getByRole('button', { name: '筛选' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.getAll('merchandiserName')).toEqual(['Maya', 'Raka'])
})

test('统计页没有进度筛选且月份可进入明细', async ({ page }) => {
  await page.goto(statsRoute)
  await expect(page.getByText('准备项进度', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '2026-03' }).first().click()
  await expect(page).toHaveURL(/tab=detail/)
  await expect(page.getByRole('heading', { name: '明细表' })).toBeVisible()
})
```

增加三个列表的分页、三态排序、显示列、拖拽、冻结、操作列固定和刷新后页码/排序重置检查。

- [ ] **步骤 2：加入 200ms 和视口检查**

使用 MutationObserver 测量复选框联动和翻页从点击到目标区域 DOM 更新：

```typescript
const duration = await page.evaluate(() => new Promise<number>((resolve, reject) => {
  const checkbox = document.querySelector<HTMLInputElement>('input[name="itemType"][value="毛织基码纸样"]')
  const teamOption = document.querySelector<HTMLInputElement>('input[name="ownerTeam"][value="采购团队"]')?.closest('label')
  if (!checkbox || !teamOption) return reject(new Error('缺少联动性能验收元素'))
  const startedAt = performance.now()
  checkbox.click()
  requestAnimationFrame(() => resolve(performance.now() - startedAt))
}))
expect(duration).toBeLessThan(200)
```

分别在 1366×768、1280×720 断言：

```typescript
expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth)
expect(document.body.scrollWidth).toBe(document.body.clientWidth)
```

宽表必须只在 `[data-standard-list-scroll]` 内横向滚动。

- [ ] **步骤 3：运行 Playwright 并修正实际选择器**

运行：

```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/production-preparation-timing-filters.spec.ts
```

预期：首次运行若选择器或 DOM 标识尚未补齐则 FAIL；只补必要的稳定 `data-*` 标识，不通过增加隐藏文案绕过测试。

- [ ] **步骤 4：填写原型审查记录**

从 `docs/prototype-review-record-template.md` 创建审查记录，必须明确：

```markdown
| 涉及页面路径 | `/fcs/production/preparation-timing`、`/fcs/production/preparation-timing-statistics` |
| 主要角色 | 跟单、版师团队、毛织团队、车板团队、花型团队、染色团队、采购团队 |
| 端类型 | Web 管理后台 |
| 页面模式 | 标准列表页 + 下拉复选筛选 + 抽屉/弹窗 |
```

自查结论必须覆盖：同一准备项匹配、防止未确认数据推进、联动可达性、中文文案、分页、固定操作列、1280×720、200ms、无业务例外。

- [ ] **步骤 5：运行全部交付门禁**

运行：

```bash
npm run check:production-preparation-timing
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/production-preparation-timing-filters.spec.ts
npm run build
codegraph sync
codegraph status
git diff --check
```

预期：全部退出码为 0；CodeGraph 显示索引已同步且无 pending files。

- [ ] **步骤 6：对抗式复核四个方向**

逐项构造反例并记录结果：

1. 数据完整性：未确认工作项、无上传普通项、无采购单辅料项均不能显示已完成。
2. 页面可见性：所有已选值始终可见；无结果时显示标准空态。
3. 交互可达性：台账五类多选、统计四类多选、联动、分页、列设置均可鼠标操作。
4. 业务闭环：月份进入明细、筛选后的导出、准备项团队同项匹配均成立。

找到反例时回到对应任务补检查和最小实现，再重新执行步骤 5。

- [ ] **步骤 7：提交验收与治理记录**

```bash
git add tests/production-preparation-timing-filters.spec.ts scripts/check-production-preparation-timing.ts docs/prototype-review-records/2026-07-16-production-preparation-multi-select-filter.md
git commit -m "test: verify production preparation filter workflow"
```

---

## 最终交付检查

- [ ] `git status --short` 只显示执行前已有的无关改动，不显示本计划遗漏文件。
- [ ] `git log --oneline` 能看到六个独立、可审查的提交。
- [ ] 准备台账：跟单、记录状态、准备项、准备项进度、责任团队均为多选。
- [ ] 月度统计与明细统计：跟单、记录状态、准备项、责任团队均为多选，不出现准备项进度。
- [ ] 不出现责任人和是否超时筛选；筛选标签不再显示买手。
- [ ] 同一条件内按或，不同条件间按且，准备项/团队/进度必须同项匹配。
- [ ] 所有列表分页；列显示、列顺序、冻结、排序、固定操作列可用。
- [ ] 所有按钮与复选框可见响应小于 200ms。
- [ ] 1366×768 与 1280×720 无页面级横向溢出。
- [ ] CodeGraph 索引已同步。
