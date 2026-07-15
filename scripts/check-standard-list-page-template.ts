import assert from 'node:assert/strict'

import {
  renderStandardListPage,
  renderStandardListStats,
} from '../src/components/ui/list-page.ts'

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

console.log('standard list page template check passed')
