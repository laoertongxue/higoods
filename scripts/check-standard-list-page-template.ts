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
const defaultColumnPreferences: StandardListColumnPreferences = {
  order: ['recordNo', 'qty', 'actions'],
  visibleKeys: ['recordNo', 'qty', 'actions'],
  frozenKeys: ['recordNo'],
  pageSize: 20,
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
    defaultColumnPreferences,
    allowedPageSizes,
  ),
  defaultColumnPreferences,
  '损坏 JSON 必须回退规范化默认值',
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
    defaultColumnPreferences,
    allowedPageSizes,
  ),
  defaultColumnPreferences,
  'Storage 读取异常必须回退规范化默认值',
)
assert.doesNotThrow(() => saveListColumnPreferences(failingStorage, 'standard-list-columns', normalizedPreferences))
assert.doesNotThrow(() => clearListColumnPreferences(failingStorage, 'standard-list-columns'))

console.log('standard list page template check passed')
