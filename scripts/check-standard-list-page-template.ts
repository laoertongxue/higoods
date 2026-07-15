import assert from 'node:assert/strict'

import {
  renderStandardListPage,
  renderStandardListStats,
} from '../src/components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
} from '../src/components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../src/components/ui/list-table.ts'

const slotMarkers = {
  title: 'UNIQUE_TITLE_SLOT',
  feedback: 'UNIQUE_FEEDBACK_SLOT',
  filters: 'UNIQUE_FILTERS_SLOT',
  stats: 'UNIQUE_STATS_SLOT',
  listTitle: 'UNIQUE_LIST_TITLE_SLOT',
  table: 'UNIQUE_TABLE_SLOT',
  pagination: 'UNIQUE_PAGINATION_SLOT',
  overlays: 'UNIQUE_OVERLAYS_SLOT',
} as const

const statsHtml = renderStandardListStats([{ label: slotMarkers.stats, value: 12 }])

const pageHtml = renderStandardListPage({
  title: slotMarkers.title,
  primaryActionsHtml: '<button>新建补料单</button>',
  feedbackHtml: `<div>${slotMarkers.feedback}</div>`,
  filtersHtml: `<form>${slotMarkers.filters}</form>`,
  statsHtml,
  listTitle: slotMarkers.listTitle,
  listActionsHtml: '<button>导出</button>',
  tableHtml: `<table><tbody><tr><td>${slotMarkers.table}</td></tr></tbody></table>`,
  paginationHtml: `<nav>${slotMarkers.pagination}</nav>`,
  overlaysHtml: `<div role="dialog">${slotMarkers.overlays}</div>`,
})

assert(pageHtml.includes('data-standard-list-page'), '缺少标准列表页根节点标记')
assert(pageHtml.includes('data-standard-list-filters'), '缺少标准列表筛选区标记')
assert(pageHtml.includes('data-standard-list-table-section'), '缺少标准列表表格区标记')

const orderedSlots = [
  slotMarkers.title,
  slotMarkers.feedback,
  slotMarkers.filters,
  slotMarkers.stats,
  slotMarkers.listTitle,
  slotMarkers.table,
  slotMarkers.pagination,
  slotMarkers.overlays,
]
const slotIndexes = orderedSlots.map((slot) => {
  assert.equal(pageHtml.indexOf(slot), pageHtml.lastIndexOf(slot), `插槽标记必须唯一：${slot}`)
  return pageHtml.indexOf(slot)
})
assert(slotIndexes.every((index) => index >= 0), '标准列表页存在未渲染的插槽')
assert(
  slotIndexes.every((index, position) => position === 0 || slotIndexes[position - 1] < index),
  '标准列表页插槽顺序必须为标题、反馈、筛选、统计、列表头、表格、分页、覆盖层',
)

assert(!statsHtml.includes('rounded-2xl'), '统计组不得使用 rounded-2xl')
assert(!statsHtml.includes('shadow'), '统计组不得使用阴影')

const rootClass = pageHtml.match(/class="([^"]*)"[^>]*data-standard-list-page/)?.[1] ?? ''
assert(rootClass.split(' ').includes('p-4'), '标准列表页必须使用 p-4')
assert(rootClass.split(' ').includes('space-y-3'), '标准列表页必须使用 space-y-3')

const headerClasses = [...pageHtml.matchAll(/<header class="([^"]*)">/g)].map((match) => match[1])
assert(headerClasses[0]?.split(' ').includes('flex-wrap'), '标题操作区必须支持 flex-wrap')
assert(headerClasses[1]?.split(' ').includes('flex-wrap'), '列表头操作区必须支持 flex-wrap')

const statsClass = statsHtml.match(/class="([^"]*)"[^>]*data-standard-list-stats/)?.[1] ?? ''
assert(statsClass.split(' ').includes('flex-wrap'), '统计组必须支持 flex-wrap')

const tableSectionClass = pageHtml.match(
  /class="([^"]*)"[^>]*data-standard-list-table-section/,
)?.[1] ?? ''
for (const className of ['overflow-hidden', 'rounded-lg', 'border']) {
  assert(tableSectionClass.split(' ').includes(className), `列表容器必须包含 ${className}`)
}
assert(
  pageHtml.indexOf(slotMarkers.table) < pageHtml.indexOf(slotMarkers.pagination),
  '分页必须位于表格之后',
)

const escapedStatsHtml = renderStandardListStats([
  { label: '统计<&"\'', value: '数量<&"\'' },
])
assert(escapedStatsHtml.includes('统计&lt;&amp;&quot;&#39;'), '统计 label 必须转义 HTML')
assert(escapedStatsHtml.includes('数量&lt;&amp;&quot;&#39;'), '统计 value 必须转义 HTML')

const escapedPageHtml = renderStandardListPage({
  title: '标题<&"\'',
  filtersHtml: '',
  listTitle: '列表<&"\'',
  tableHtml: '',
  paginationHtml: '',
  className: 'custom" data-injected="true',
})
assert(escapedPageHtml.includes('标题&lt;&amp;&quot;&#39;'), 'title 必须转义 HTML')
assert(escapedPageHtml.includes('列表&lt;&amp;&quot;&#39;'), 'listTitle 必须转义 HTML')
assert(
  escapedPageHtml.includes('custom&quot; data-injected=&quot;true'),
  'className 中的引号必须转义',
)
assert(!escapedPageHtml.includes('data-injected="true"'), 'className 不得注入新的 HTML 属性')

const columnRules: StandardListColumnRule[] = [
  { key: 'recordNo', required: true, freezeable: true },
  { key: 'qty', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]
const allowedPageSizes = [10, 20, 50]
const invalidDefaultColumnPreferences: StandardListColumnPreferences = {
  order: ['unknown', 'actions', 'qty'],
  visibleKeys: ['unknown', 'qty'],
  frozenKeys: ['unknown', 'actions', 'recordNo'],
  pageSize: 999,
}
const normalizedDefaultColumnPreferences: StandardListColumnPreferences = {
  order: ['qty', 'recordNo', 'actions'],
  visibleKeys: ['qty', 'recordNo', 'actions'],
  frozenKeys: ['recordNo'],
  pageSize: 10,
}

const normalizedPreferences = normalizeListColumnPreferences(
  columnRules,
  {
    order: ['unknown', 'qty'],
    visibleKeys: ['qty'],
    frozenKeys: ['unknown', 'qty', 'actions'],
    pageSize: 999,
  },
  allowedPageSizes,
)
assert.deepEqual(normalizedPreferences, {
  order: ['qty', 'recordNo', 'actions'],
  visibleKeys: ['qty', 'recordNo', 'actions'],
  frozenKeys: ['qty'],
  pageSize: 10,
})

const optionalActionPreferences = normalizeListColumnPreferences(
  [
    { key: 'recordNo', required: true, freezeable: true },
    { key: 'remark' },
    { key: 'actions', actionColumn: true },
  ],
  {
    order: ['actions', 'recordNo'],
    visibleKeys: ['recordNo'],
    frozenKeys: [],
    pageSize: 10,
  },
  allowedPageSizes,
)
assert.deepEqual(
  optionalActionPreferences.order,
  ['recordNo', 'remark', 'actions'],
  '操作列即使不是必需列也必须排在最后',
)
assert.deepEqual(
  optionalActionPreferences.visibleKeys,
  ['recordNo', 'actions'],
  '操作列即使不是必需列也必须自动可见',
)

const nonFreezeablePreferences = normalizeListColumnPreferences(
  [
    { key: 'recordNo', required: true, freezeable: true },
    { key: 'remark', required: false },
    { key: 'actions', actionColumn: true },
  ],
  {
    order: ['recordNo', 'remark', 'actions'],
    visibleKeys: ['recordNo', 'remark', 'actions'],
    frozenKeys: ['recordNo', 'remark'],
    pageSize: 10,
  },
  allowedPageSizes,
)
assert.deepEqual(
  nonFreezeablePreferences.frozenKeys,
  ['recordNo'],
  '未声明可冻结的普通列不得保留在冻结列中',
)

const rows = [
  { recordNo: 'B2', qty: 2 },
  { recordNo: 'A3', qty: 3 },
  { recordNo: 'C1', qty: 1 },
]
assert.deepEqual(
  sortStandardListRows(rows, { key: 'qty', direction: 'asc' }, (row, key) => row[key as keyof typeof row]),
  [rows[2], rows[0], rows[1]],
  '数字升序必须按数值排列',
)
assert.deepEqual(
  paginateStandardListRows(rows, 2, 2),
  {
    rows: [rows[2]],
    total: 3,
    currentPage: 2,
    totalPages: 2,
    pageSize: 2,
    from: 3,
    to: 3,
  },
  '分页必须返回收敛后的页码与区间',
)

const stringRows = [{ name: '张三' }, { name: '阿明' }, { name: '李四' }]
assert.deepEqual(
  sortStandardListRows(stringRows, { key: 'name', direction: 'asc' }, (row) => row.name),
  [...stringRows].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
  '字符串必须按 zh-CN 排序',
)

const numericRows = [{ qty: 10 }, { qty: 2 }, { qty: 1 }]
assert.deepEqual(
  sortStandardListRows(numericRows, { key: 'qty', direction: 'desc' }, (row) => row.qty),
  [numericRows[0], numericRows[1], numericRows[2]],
  '数字降序必须按数值排列',
)

const rowsWithEmptyValues = [{ qty: 2 }, { qty: null }, { qty: 1 }, { qty: undefined }]
for (const direction of ['asc', 'desc'] as const) {
  const sorted = sortStandardListRows(
    rowsWithEmptyValues,
    { key: 'qty', direction },
    (row) => row.qty,
  )
  assert.deepEqual(sorted.slice(-2), [rowsWithEmptyValues[1], rowsWithEmptyValues[3]], '空值必须始终排在最后')
}

const stableRows = [
  { id: 'first', qty: 1 },
  { id: 'second', qty: 1 },
]
assert.deepEqual(
  sortStandardListRows(stableRows, { key: 'qty', direction: 'asc' }, (row) => row.qty),
  stableRows,
  '相同值排序必须稳定',
)
const unsortedCopy = sortStandardListRows(stableRows, null, (row) => row.qty)
assert.deepEqual(unsortedCopy, stableRows)
assert.notEqual(unsortedCopy, stableRows, '无排序时必须返回副本')

assert.deepEqual(paginateStandardListRows(rows, 99, 0), {
  rows: [rows[2]],
  total: 3,
  currentPage: 3,
  totalPages: 3,
  pageSize: 1,
  from: 3,
  to: 3,
})
assert.deepEqual(paginateStandardListRows([], -5, Number.NaN), {
  rows: [],
  total: 0,
  currentPage: 1,
  totalPages: 1,
  pageSize: 1,
  from: 0,
  to: 0,
})

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

const storage = createMemoryStorage()
storage.setItem('standard-list-columns', '{broken json')
assert.deepEqual(
  loadListColumnPreferences(
    storage,
    'standard-list-columns',
    columnRules,
    invalidDefaultColumnPreferences,
    allowedPageSizes,
  ),
  normalizedDefaultColumnPreferences,
  '损坏 JSON 必须回退规范化默认值',
)

storage.setItem('standard-list-columns', JSON.stringify({
  order: ['qty'],
  visibleKeys: ['qty'],
  frozenKeys: ['recordNo'],
  pageSize: 20,
}))
assert.deepEqual(
  loadListColumnPreferences(
    storage,
    'standard-list-columns',
    columnRules,
    invalidDefaultColumnPreferences,
    allowedPageSizes,
  ),
  {
    order: ['qty', 'recordNo', 'actions'],
    visibleKeys: ['qty', 'recordNo', 'actions'],
    frozenKeys: ['recordNo'],
    pageSize: 20,
  },
  '有效存储 JSON 必须正常读取并规范化',
)

saveListColumnPreferences(storage, 'standard-list-columns', normalizedPreferences)
assert.deepEqual(
  JSON.parse(storage.getItem('standard-list-columns') ?? ''),
  normalizedPreferences,
  '列偏好必须保存到注入的存储',
)
clearListColumnPreferences(storage, 'standard-list-columns')
assert.equal(storage.getItem('standard-list-columns'), null, '列偏好必须可清除')

const failingStorage = {
  getItem: () => { throw new Error('storage unavailable') },
  setItem: () => { throw new Error('storage unavailable') },
  removeItem: () => { throw new Error('storage unavailable') },
}
assert.deepEqual(
  loadListColumnPreferences(
    failingStorage,
    'standard-list-columns',
    columnRules,
    invalidDefaultColumnPreferences,
    allowedPageSizes,
  ),
  normalizedDefaultColumnPreferences,
  'Storage 读取异常必须回退规范化默认值',
)
assert.doesNotThrow(() => saveListColumnPreferences(failingStorage, 'standard-list-columns', normalizedPreferences))
assert.doesNotThrow(() => clearListColumnPreferences(failingStorage, 'standard-list-columns'))

type DemoRow = {
  recordNo: string
  qty: number
}

const standardListColumns: StandardListColumn<DemoRow>[] = [
  {
    key: 'recordNo',
    title: '补料单号<&"\'',
    width: 150,
    required: true,
    freezeable: true,
    sortable: true,
    render: (row) => row.recordNo,
  },
  {
    key: 'qty',
    title: '数量',
    width: 120,
    freezeable: true,
    sortable: true,
    render: (row) => `${row.qty} 件`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    render: () => '<button type="button">查看</button>',
  },
]
const standardListPreferences: StandardListColumnPreferences = {
  order: ['recordNo', 'qty', 'actions'],
  visibleKeys: ['recordNo', 'qty', 'actions'],
  frozenKeys: ['recordNo'],
  pageSize: 10,
}
const columnsBeforeRender = JSON.stringify(standardListColumns.map(({ render, sortValue, ...column }) => column))
const preferencesBeforeRender = JSON.stringify(standardListPreferences)

const standardListTableHtml = renderStandardListTable({
  columns: standardListColumns,
  rows: [{ recordNo: 'BL<&"\'-001', qty: 8 }],
  preferences: standardListPreferences,
  sort: { key: 'qty', direction: 'asc' },
  eventPrefix: 'demo-list',
  emptyText: '暂无补料单',
})

assert(standardListTableHtml.includes('data-standard-list-scroll'), '表格自身必须提供横向滚动容器')
assert(standardListTableHtml.includes('overflow-x-auto'), '横向滚动必须限制在表格容器内')
assert(standardListTableHtml.includes('min-width: 370px'), '表格最小宽度必须按可见列宽求和')
assert.match(
  standardListTableHtml,
  /<th[^>]*class="[^"]*sticky[^"]*left-0[^"]*bg-[^"]*z-[^"]*"[^>]*data-column-key="recordNo"/,
  '冻结表头必须 sticky left-0，并有不透明背景与层级',
)
assert.match(
  standardListTableHtml,
  /<td[^>]*class="[^"]*sticky[^"]*left-0[^"]*bg-[^"]*z-[^"]*"/,
  '冻结单元格必须 sticky left-0，并有不透明背景与层级',
)
assert.match(
  standardListTableHtml,
  /<th[^>]*class="[^"]*sticky[^"]*right-0[^"]*bg-[^"]*border-l[^"]*z-[^"]*"[^>]*data-column-key="actions"/,
  '操作列表头必须固定在右侧并与数据列分隔',
)
assert.match(
  standardListTableHtml,
  /<td[^>]*class="[^"]*sticky[^"]*right-0[^"]*bg-[^"]*border-l[^"]*z-[^"]*"/,
  '操作列单元格必须固定在右侧并与数据列分隔',
)
assert(standardListTableHtml.includes('data-demo-list-action="sort-column"'), '排序表头必须输出事件动作')
assert(standardListTableHtml.includes('data-column-key="qty"'), '排序动作必须标记列 key')
assert(standardListTableHtml.includes('aria-sort="ascending"'), '当前升序列必须输出 aria-sort')
assert(standardListTableHtml.includes('aria-label="按数量降序排列"'), '排序按钮必须提供中文可访问名称')
assert(standardListTableHtml.includes('补料单号&lt;&amp;&quot;&#39;'), '表头纯文本必须转义 HTML')
assert(standardListTableHtml.includes('BL<&"\'-001'), '列 render 返回值必须视为可信 HTML')
assert(
  standardListTableHtml.indexOf('data-column-key="actions"') >
    standardListTableHtml.indexOf('data-column-key="qty"'),
  '操作列必须排在普通列最后',
)

const cumulativeFrozenTableHtml = renderStandardListTable({
  columns: standardListColumns,
  rows: [{ recordNo: 'BL-002', qty: 3 }],
  preferences: {
    ...standardListPreferences,
    order: ['qty', 'recordNo', 'actions'],
    frozenKeys: ['qty', 'recordNo'],
  },
  sort: null,
  eventPrefix: 'demo-list',
})
assert(
  cumulativeFrozenTableHtml.includes('left: 120px'),
  '多个左冻结列必须按前序列宽累计 left 偏移',
)

const forcedActionTableHtml = renderStandardListTable({
  columns: standardListColumns,
  rows: [{ recordNo: 'BL-003', qty: 1 }],
  preferences: {
    ...standardListPreferences,
    order: ['actions', 'recordNo'],
    visibleKeys: ['recordNo'],
  },
  sort: null,
  eventPrefix: 'demo-list',
})
assert(forcedActionTableHtml.includes('data-column-key="actions"'), '操作列即使不在 visibleKeys 中也必须显示')
assert(
  forcedActionTableHtml.indexOf('data-column-key="actions"') >
    forcedActionTableHtml.indexOf('data-column-key="recordNo"'),
  '操作列即使被提前排序也必须固定在最后',
)

const emptyTableHtml = renderStandardListTable({
  columns: standardListColumns,
  rows: [],
  preferences: standardListPreferences,
  sort: null,
  eventPrefix: 'demo-list',
  emptyText: '暂无补料单<&"\'',
})
assert(emptyTableHtml.includes('<thead'), '空数据时必须保留表头')
assert(emptyTableHtml.includes('暂无补料单&lt;&amp;&quot;&#39;'), '空状态纯文本必须转义 HTML')

const columnSettingsHtml = renderStandardListColumnSettings({
  title: '列设置',
  columns: standardListColumns,
  preferences: standardListPreferences,
  eventPrefix: 'demo-list',
  maxFrozenWidth: 520,
})
assert(columnSettingsHtml.includes('draggable="true"'), '普通列设置项必须可拖动')
assert(columnSettingsHtml.includes('data-standard-list-column-drag'), '列设置必须提供拖动标记')
assert(columnSettingsHtml.includes('data-drag-source="recordNo"'), '列设置必须提供拖动源')
assert(columnSettingsHtml.includes('data-drop-target="qty"'), '列设置必须提供放置目标')
assert(columnSettingsHtml.includes('data-demo-list-action="toggle-column-visibility"'), '列设置必须提供显隐动作')
assert(columnSettingsHtml.includes('data-demo-list-action="toggle-column-freeze"'), '列设置必须提供冻结动作')
assert(columnSettingsHtml.includes('data-demo-list-action="restore-column-settings"'), '列设置必须提供恢复默认动作')
assert(columnSettingsHtml.includes('data-demo-list-action="close-column-settings"'), '列设置必须提供关闭动作')
assert(columnSettingsHtml.includes('data-demo-list-column-key="recordNo"'), '列设置动作必须标记列 key')
assert(columnSettingsHtml.includes('补料单号&lt;&amp;&quot;&#39;'), '列设置列名必须转义 HTML')
assert(!columnSettingsHtml.includes('<p class="text-sm text-muted-foreground">'), '列设置抽屉不得提供副标题')
assert(!columnSettingsHtml.includes('拖动调整'), '列设置不得加入说明性文案')

function columnSettingsItem(html: string, key: string, nextKey?: string): string {
  const start = html.indexOf(`data-standard-list-column-key="${key}"`)
  const end = nextKey ? html.indexOf(`data-standard-list-column-key="${nextKey}"`, start + 1) : html.length
  assert(start >= 0 && end > start, `缺少列设置项：${key}`)
  return html.slice(start, end)
}

const recordNoSettings = columnSettingsItem(columnSettingsHtml, 'recordNo', 'qty')
const actionSettings = columnSettingsItem(columnSettingsHtml, 'actions')
assert(recordNoSettings.includes('disabled'), 'required 列的隐藏控件必须禁用')
assert(actionSettings.includes('draggable="false"'), '操作列必须不可拖动')
assert(!actionSettings.includes('toggle-column-visibility'), '操作列必须不可隐藏')
assert(!actionSettings.includes('toggle-column-freeze'), '操作列必须不可冻结')

const wideColumns: StandardListColumn<DemoRow>[] = [
  standardListColumns[0],
  {
    key: 'wide',
    title: '宽列',
    width: 400,
    freezeable: true,
    render: () => '宽列',
  },
  standardListColumns[2],
]
const frozenLimitSettingsHtml = renderStandardListColumnSettings({
  title: '列设置',
  columns: wideColumns,
  preferences: {
    order: ['recordNo', 'wide', 'actions'],
    visibleKeys: ['recordNo', 'wide', 'actions'],
    frozenKeys: ['recordNo'],
    pageSize: 10,
  },
  eventPrefix: 'demo-list',
  maxFrozenWidth: 520,
})
const wideSettings = columnSettingsItem(frozenLimitSettingsHtml, 'wide', 'actions')
assert(wideSettings.includes('disabled'), '冻结总宽度超限时必须禁用未冻结列的冻结控件')

const hiddenFrozenColumns: StandardListColumn<DemoRow>[] = [
  standardListColumns[0],
  {
    key: 'hiddenWide',
    title: '隐藏宽列',
    width: 400,
    freezeable: true,
    render: () => '隐藏宽列',
  },
  standardListColumns[1],
  standardListColumns[2],
]
const hiddenFrozenSettingsHtml = renderStandardListColumnSettings({
  title: '列设置',
  columns: hiddenFrozenColumns,
  preferences: {
    order: ['recordNo', 'hiddenWide', 'qty', 'actions'],
    visibleKeys: ['recordNo', 'qty', 'actions'],
    frozenKeys: ['recordNo', 'hiddenWide'],
    pageSize: 10,
  },
  eventPrefix: 'demo-list',
  maxFrozenWidth: 520,
})
const qtySettingsAfterHiddenFrozen = columnSettingsItem(hiddenFrozenSettingsHtml, 'qty', 'actions')
assert(
  !qtySettingsAfterHiddenFrozen.includes('disabled'),
  '隐藏冻结列不得占用冻结宽度上限',
)

const requiredFrozenColumns: StandardListColumn<DemoRow>[] = [
  {
    key: 'requiredWide',
    title: '必需宽列',
    width: 450,
    required: true,
    freezeable: true,
    render: () => '必需宽列',
  },
  standardListColumns[1],
  standardListColumns[2],
]
const requiredFrozenSettingsHtml = renderStandardListColumnSettings({
  title: '列设置',
  columns: requiredFrozenColumns,
  preferences: {
    order: ['requiredWide', 'qty', 'actions'],
    visibleKeys: ['qty', 'actions'],
    frozenKeys: ['requiredWide'],
    pageSize: 10,
  },
  eventPrefix: 'demo-list',
  maxFrozenWidth: 520,
})
const qtySettingsAfterRequiredFrozen = columnSettingsItem(requiredFrozenSettingsHtml, 'qty', 'actions')
assert(
  qtySettingsAfterRequiredFrozen.includes('disabled'),
  'required 冻结列即使不在 visibleKeys 中也必须占用冻结宽度上限',
)

const duplicateActionColumns: StandardListColumn<DemoRow>[] = [
  ...standardListColumns,
  {
    key: 'moreActions',
    title: '更多操作',
    width: 100,
    actionColumn: true,
    render: () => '<button type="button">更多</button>',
  },
]
assert.throws(
  () => renderStandardListTable({
    columns: duplicateActionColumns,
    rows: [],
    preferences: standardListPreferences,
    sort: null,
    eventPrefix: 'demo-list',
  }),
  /标准列表最多只能定义一个操作列/,
  '多个操作列必须抛出中文开发错误',
)
assert.throws(
  () => renderStandardListColumnSettings({
    title: '列设置',
    columns: duplicateActionColumns,
    preferences: standardListPreferences,
    eventPrefix: 'demo-list',
    maxFrozenWidth: 520,
  }),
  /标准列表最多只能定义一个操作列/,
  '列设置同样必须拒绝多个操作列',
)

assert.equal(
  JSON.stringify(standardListColumns.map(({ render, sortValue, ...column }) => column)),
  columnsBeforeRender,
  '渲染不得修改列定义输入',
)
assert.equal(JSON.stringify(standardListPreferences), preferencesBeforeRender, '渲染不得修改列偏好输入')

type MutableRegion = { innerHTML: string }

function createMemoryStorageWithSeed(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    read: (key: string) => values.get(key) ?? null,
  }
}

function installSupplementBrowser(storageValue: {
  getItem(key: string): string | null
  setItem(key: string, value: string): unknown
  removeItem(key: string): unknown
}) {
  const regions = new Map<string, MutableRegion>([
    ['feedback', { innerHTML: '' }],
    ['stats', { innerHTML: '' }],
    ['table', { innerHTML: '' }],
    ['pagination', { innerHTML: '' }],
    ['overlay', { innerHTML: '' }],
  ])
  const fields = new Map<string, { value: string }>([
    ['sourceType', { value: 'ALL' }],
    ['keyword', { value: '' }],
  ])
  const documentStub = {
    querySelector(selector: string) {
      const region = selector.match(/data-cutting-supplement-region="([^"]+)"/)?.[1]
      if (region) return regions.get(region) ?? null
      const field = selector.match(/data-cutting-supplement-field="([^"]+)"/)?.[1]
      if (field) return fields.get(field) ?? null
      return null
    },
  }
  const windowStub = {
    location: {
      pathname: '/fcs/craft/cutting/supplement-management',
      search: '',
    },
    localStorage: storageValue,
  }
  Object.assign(globalThis, {
    document: documentStub,
    window: windowStub,
    localStorage: storageValue,
  })
  return { regions, fields }
}

function supplementAction(
  action: string,
  extra: Record<string, string> = {},
): HTMLElement {
  const target = {
    dataset: {
      cuttingSupplementAction: action,
      ...extra,
    },
    closest(selector: string) {
      return selector === '[data-cutting-supplement-action]' || selector === '[data-skip-page-rerender="true"]'
        ? target
        : null
    },
  }
  return target as unknown as HTMLElement
}

function supplementField(field: string, value: string): HTMLElement {
  const target = {
    value,
    dataset: {
      cuttingSupplementField: field,
    },
    closest(selector: string) {
      return selector === '[data-cutting-supplement-field]'
        || selector === '[data-skip-page-rerender="true"]'
        ? target
        : null
    },
  }
  return target as unknown as HTMLElement
}

function countRecordRows(html: string): number {
  return [...html.matchAll(/data-record-id="[^"]+"/g)].length
}

function assertDefaultPageSize(html: string, message: string): void {
  assert.match(html, /<option value="10" selected>10 条\/页<\/option>/, message)
}

const supplementStorageKey = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const defaultSupplementStorage = createMemoryStorageWithSeed()
const supplementDom = installSupplementBrowser(defaultSupplementStorage)
const supplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-check')
let supplementHtml = supplementPage.renderCraftCuttingSupplementManagementPage()

for (const marker of [
  'data-standard-list-page',
  'data-standard-list-scroll',
  'data-cutting-supplement-region="stats"',
  'data-cutting-supplement-region="table"',
  'data-cutting-supplement-region="pagination"',
  'data-cutting-supplement-region="overlay"',
]) {
  assert(supplementHtml.includes(marker), `补料管理列表缺少标准局部区域：${marker}`)
}
assert(supplementHtml.includes('列设置'), '补料管理列表必须提供列设置按钮')
assert(!supplementHtml.includes('工艺工厂运营系统 / 裁床厂管理 / 裁后处理 / 补料管理'), '补料管理列表不得保留面包屑')
assert(!supplementHtml.includes('列表对象是补料单；新增补料填写后会弹窗确认。'), '补料管理列表不得保留列表说明')
const supplementStatsClass = supplementHtml.match(/class="([^"]*)"[^>]*data-standard-list-stats/)?.[1] ?? ''
assert(!supplementStatsClass.split(' ').includes('border'), '补料管理统计组不得有外框')
assert.match(
  supplementHtml,
  /<th[^>]*class="[^"]*sticky[^"]*right-0[^"]*"[^>]*data-column-key="actions"/,
  '补料管理操作列必须 sticky right',
)
assert.equal(countRecordRows(supplementHtml), 10, '默认当前页必须只渲染 10 条补料记录')
const supplementTotal = Number(supplementHtml.match(/共 (\d+) 条/)?.[1] ?? 0)
assert(supplementTotal >= 12, '补料管理必须提供至少 12 条确定性记录')
assert(supplementHtml.includes('PR-SUP-') && supplementHtml.includes('DY-SUP-'), '补料列表必须保留印花与染色需求演示记录')
assert(supplementHtml.includes('1 / 2'), '默认 10 条/页时必须可进入第 2 页')
assertDefaultPageSize(supplementHtml, '补料管理默认必须为 10 条/页')
assert(supplementHtml.includes('data-skip-page-rerender="true"'), '局部交互控件必须跳过整页重渲染')

assert.equal(
  supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('next-page')),
  true,
  '下一页动作必须被页面处理',
)
assert(supplementDom.regions.get('pagination')?.innerHTML.includes('2 / 2'), '下一页必须局部刷新到第 2 页')
assert((supplementDom.regions.get('table')?.innerHTML.match(/data-record-id=/g) ?? []).length >= 2, '第 2 页必须渲染剩余记录')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('prev-page'))
assert(supplementDom.regions.get('pagination')?.innerHTML.includes('1 / 2'), '上一页必须局部刷新回第 1 页')

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('next-page'))
supplementDom.fields.get('keyword')!.value = 'SUP-'
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('apply-filters'))
assert(supplementDom.regions.get('pagination')?.innerHTML.includes('1 / 2'), '筛选后必须回到第 1 页')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('next-page'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('reset-filters'))
assert(supplementDom.regions.get('pagination')?.innerHTML.includes('1 / 2'), '重置筛选后必须回到第 1 页')

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementField('pageSize', '20'))
assert(supplementDom.regions.get('pagination')?.innerHTML.includes('1 / 1'), '切换每页条数后必须回到第 1 页')
assert.equal((supplementDom.regions.get('table')?.innerHTML.match(/data-record-id=/g) ?? []).length, supplementTotal, '20 条/页必须展示全部补料记录')

for (const expected of ['ascending', 'descending', 'none']) {
  supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('sort-column', { columnKey: 'recordNo' }))
  assert(
    supplementDom.regions.get('table')?.innerHTML.includes(`aria-sort="${expected}"`),
    `排序三态必须依次进入 ${expected}`,
  )
}

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('open-column-settings'))
assert(supplementDom.regions.get('overlay')?.innerHTML.includes('列设置'), '必须局部打开列设置')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('close-column-settings'))
assert.equal(supplementDom.regions.get('overlay')?.innerHTML, '', '必须局部关闭列设置')

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('sort-column', { columnKey: 'supplementQty' }))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }))
assert(!supplementDom.regions.get('table')?.innerHTML.includes('data-column-key="supplementQty"'), '列显隐必须局部刷新表格')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }))
assert(supplementDom.regions.get('table')?.innerHTML.includes('aria-sort="none"'), '隐藏当前排序列后必须取消排序')

for (const key of ['target', 'recordNo']) {
  supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: key }))
}
const preferencesBeforeFrozenOverflow = defaultSupplementStorage.read(supplementStorageKey)
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: 'supplementQty' }))
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeFrozenOverflow, '冻结宽度超过 520 时不得改变偏好')
assert(supplementDom.regions.get('feedback')?.innerHTML.includes('520'), '冻结宽度超过上限时必须提供业务反馈')

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('restore-column-settings'))
assert.equal(defaultSupplementStorage.read(supplementStorageKey), null, '恢复默认必须清除本地偏好')
assertDefaultPageSize(supplementDom.regions.get('pagination')?.innerHTML ?? '', '恢复默认必须回到 10 条/页')

const firstRecordId = supplementHtml.match(/data-record-id="([^"]+)"/)?.[1]
assert(firstRecordId, '补料管理列表必须提供详情记录 ID')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('open-detail', { recordId: firstRecordId }))
assert(supplementDom.regions.get('overlay')?.innerHTML.includes('补料单详情'), '查看详情必须只刷新覆盖层')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('close-detail'))
assert.equal(supplementDom.regions.get('overlay')?.innerHTML, '', '关闭详情必须清空覆盖层')

const validPreferences = {
  order: ['recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions'],
  visibleKeys: ['recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions'],
  frozenKeys: ['recordNo'],
  pageSize: 20,
}
installSupplementBrowser(createMemoryStorageWithSeed({
  [supplementStorageKey]: JSON.stringify(validPreferences),
}))
const storedSupplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-valid-storage')
const storedSupplementHtml = storedSupplementPage.renderCraftCuttingSupplementManagementPage()
assert.equal(countRecordRows(storedSupplementHtml), supplementTotal, '有效 localStorage 偏好必须加载 20 条/页')
assert.match(storedSupplementHtml, /<option value="20" selected>20 条\/页<\/option>/, '有效 localStorage 页大小必须生效')

installSupplementBrowser(createMemoryStorageWithSeed({ [supplementStorageKey]: '{broken json' }))
const brokenSupplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-broken-storage')
assertDefaultPageSize(brokenSupplementPage.renderCraftCuttingSupplementManagementPage(), '损坏 localStorage 必须回退默认偏好')

installSupplementBrowser(failingStorage)
const failingSupplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-failing-storage')
assert.doesNotThrow(() => failingSupplementPage.renderCraftCuttingSupplementManagementPage(), 'Storage 异常不得阻断补料管理渲染')
assertDefaultPageSize(failingSupplementPage.renderCraftCuttingSupplementManagementPage(), 'Storage 异常必须回退默认偏好')

console.log('standard list page template check passed')
