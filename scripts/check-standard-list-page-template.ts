import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { chromium } from 'playwright'
import { createServer } from 'vite'

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

const mainSource = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const fcsHandlerSource = fs.readFileSync(new URL('../src/main-handlers/fcs-handlers.ts', import.meta.url), 'utf8')
const agentsSource = fs.readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')

function extractStandardListGovernanceSection(source: string): string {
  const headingMatch = /^### 7\.3 标准列表页模板治理\s*$/m.exec(source)
  assert(headingMatch, 'AGENTS.md 必须定义“### 7.3 标准列表页模板治理”章节')
  const sectionStart = headingMatch.index
  const contentStart = sectionStart + headingMatch[0].length
  const remainingSource = source.slice(contentStart)
  const nextHeadingOffset = remainingSource.search(/^#{1,3}\s+/m)
  const sectionEnd = nextHeadingOffset >= 0 ? contentStart + nextHeadingOffset : source.length
  return source.slice(sectionStart, sectionEnd).trim()
}

function assertStandardListGovernanceSection(section: string): void {
  assert.match(
    section,
    /^标准列表页模板以补料管理页面 `\/fcs\/craft\/cutting\/supplement-management` 为验收基准。核心公共组件为 `src\/components\/ui\/list-page\.ts`，表格渲染与列偏好模型分别位于 `src\/components\/ui\/list-table\.ts`、`src\/components\/ui\/list-table-model\.ts`。$/m,
    '标准列表治理章节必须在完整行写明模板路由和公共组件',
  )
  assert.match(
    section,
    /^- 后续所有新增列表页，以及被调整的既有列表页，都必须以该模板的样式、公共组件和交互为基准；调整既有列表页的结构、筛选、统计、表格或分页时同步向模板对齐。本任务不批量迁移其他既有页面。$/m,
    '标准列表治理章节必须要求新增和被调整的既有列表页对齐模板，并限定本任务迁移范围',
  )
  assert.match(
    section,
    /^- 必须优先复用公共组件，不得复制页面模板；公共骨架或表格能力不足时，先在 `src\/components\/ui\/` 内补充最小通用能力，再由业务页面组合使用。$/m,
    '标准列表治理章节必须优先复用公共组件且不得复制页面模板',
  )
  assert.match(
    section,
    /^- 所有数据列表必须分页；即使当前只有少量 Mock 数据，也必须展示分页控件，并明确当前页、每页条数和总数口径。$/m,
    '标准列表治理章节必须强制所有数据列表分页',
  )
  assert.match(
    section,
    /^- 当列总宽超过表格可视区、需要横向滚动时，必须支持显示列选择、列顺序拖拽调整、普通冻结列固定左侧和数据排序。$/m,
    '标准列表治理章节必须以横向滚动为触发条件要求完整列管理',
  )
  assert.match(
    section,
    /^- 必需列和业务防错列必须声明为不可隐藏的“必需列”（代码字段为 `required`）；操作列也必须保持可见。$/m,
    '标准列表治理章节必须要求必需列和业务防错列声明为不可隐藏的必需列',
  )
  assert.match(
    section,
    /^- 操作列必须固定在右侧且不随横向滚动，并始终保持可见和可操作。$/m,
    '标准列表治理章节必须要求操作列固定右侧且不随横向滚动',
  )
  assert.match(
    section,
    /^- 列显示、列顺序、冻结列和每页条数必须按路由持久化；当前页和数据排序不得持久化，刷新或重新进入页面时回到稳定默认状态。$/m,
    '标准列表治理章节必须限定持久化和不持久化状态',
  )
  assert.match(
    section,
    /^- 任一模块不得出现无业务逻辑的说明性文案；允许展示真实业务状态、风险、异常和空态，以及完成当前任务所必需的操作反馈。$/m,
    '标准列表治理章节必须禁止无业务逻辑说明文案并允许真实业务反馈',
  )
  assert.match(
    section,
    /^- 以 1366×768 为标准验收分辨率，1280×720 为最低可用分辨率；页面主体不得产生横向溢出，宽表必须在表格容器内部滚动。$/m,
    '标准列表治理章节必须明确分辨率和横向溢出边界',
  )
  assert.match(
    section,
    /^- 任何无法遵循上述规则的业务例外，都必须在对应的 prototype review record 写明理由、影响范围和替代防错措施。$/m,
    '标准列表治理章节必须要求例外写入审查记录',
  )
}

const standardListGovernanceSection = extractStandardListGovernanceSection(agentsSource)
assertStandardListGovernanceSection(standardListGovernanceSection)

const rejectedGovernanceVariants = [
  standardListGovernanceSection.replace('所有数据列表必须分页', '所有数据列表不必分页'),
  standardListGovernanceSection.replace(
    '必须支持显示列选择、列顺序拖拽调整、普通冻结列固定左侧和数据排序',
    '不必支持显示列选择、列顺序拖拽调整、普通冻结列固定左侧和数据排序',
  ),
  standardListGovernanceSection.replace('不得出现无业务逻辑的说明性文案', '不禁止无业务逻辑的说明性文案'),
  standardListGovernanceSection.replace('允许展示真实业务状态', '不允许展示真实业务状态'),
  standardListGovernanceSection.replace('必须优先复用公共组件', '无需优先复用公共组件'),
]
for (const [index, rejectedVariant] of rejectedGovernanceVariants.entries()) {
  assert.notEqual(rejectedVariant, standardListGovernanceSection, `治理否定变体 ${index + 1} 必须实际改变章节内容`)
  assert.throws(
    () => assertStandardListGovernanceSection(rejectedVariant),
    undefined,
    `治理否定变体 ${index + 1} 必须被拒绝`,
  )
}
assert.match(mainSource, /root\.addEventListener\('dragstart', dispatchListColumnDragEvent\)/, 'main.ts 必须委托列拖动开始事件')
assert.match(mainSource, /root\.addEventListener\('dragover', dispatchListColumnDragEvent\)/, 'main.ts 必须委托列拖动经过事件')
assert.match(mainSource, /root\.addEventListener\('drop', dispatchListColumnDragEvent\)/, 'main.ts 必须委托列拖动放置事件')
assert.match(mainSource, /root\.addEventListener\('dragend', dispatchListColumnDragEvent\)/, 'main.ts 必须委托列拖动结束事件并清理会话')
const dragDispatchStart = mainSource.indexOf('function dispatchListColumnDragEvent')
const dragDispatchEnd = mainSource.indexOf("root.addEventListener('dragstart'", dragDispatchStart)
assert(dragDispatchStart >= 0 && dragDispatchEnd > dragDispatchStart, 'main.ts 必须提供独立列拖动分发函数')
const dragDispatchSource = mainSource.slice(dragDispatchStart, dragDispatchEnd)
assert(!dragDispatchSource.startsWith('async '), '列拖动入口必须同步决定是否 preventDefault')
assert(dragDispatchSource.includes("'[data-standard-list-column-drag]'"), '列拖动委托只能处理标准列表列拖动节点')
assert(mainSource.includes('application/x-higood-list-column-key'), '列拖动必须使用 HiGood 专用 MIME')
assert(!dragDispatchSource.includes("setData('text/plain'"), '列拖动不得把 text/plain 作为可信列来源')
assert(
  dragDispatchSource.indexOf('event.preventDefault()') < dragDispatchSource.indexOf('dispatchPageEvent('),
  '合法 dragover 必须在异步页面分发前同步 preventDefault',
)
assert(!/\brender(?:WithFocusRestore|PageContentOnly)?\s*\(/.test(dragDispatchSource), '列拖动委托不得触发页面主体重绘')
assert.match(
  fcsHandlerSource,
  /const isSupplementManagementRoute = pathname\.startsWith\('\/fcs\/craft\/cutting\/supplement-management'\)/,
  'FCS 通用回退必须识别补料管理路由',
)
assert.match(
  fcsHandlerSource,
  /isSupplementManagementRoute\s*&&\s*target\.closest\('\[data-cutting-supplement-action\], \[data-standard-list-column-drag\]'\)[\s\S]{0,160}handleCraftCuttingSupplementManagementEvent\(target, event\)/,
  'FCS 补料事件直达路径必须限定 pathname 并传入原始 Event',
)
assert.match(
  fcsHandlerSource,
  /isSupplementManagementRoute && await handleCraftCuttingSupplementManagementEvent\(target, event\)/,
  'FCS 通用兜底链不得在其他标准列表路由调用补料处理器',
)
const supplementRouteDispatchIndex = mainSource.indexOf("pathname.startsWith('/fcs/craft/cutting/supplement-management')")
const fcsHandlerFallbackIndex = mainSource.indexOf("const handlerSystem = getCurrentHandlerSystem(pathname)")
assert(supplementRouteDispatchIndex >= 0, 'main.ts 必须为补料管理提供 route-specific 事件分支')
assert(
  supplementRouteDispatchIndex < fcsHandlerFallbackIndex,
  '补料管理 route-specific 分支必须位于 FCS handlers 全包回退之前',
)
const supplementRouteDispatchSource = mainSource.slice(supplementRouteDispatchIndex, fcsHandlerFallbackIndex)
assert(
  supplementRouteDispatchSource.includes("import('./pages/process-factory/cutting/supplement-management')"),
  '补料管理首次动作必须直接动态导入页面模块',
)
assert(
  supplementRouteDispatchSource.includes('handleCraftCuttingSupplementManagementEvent(eventTarget, event)'),
  '补料管理 route-specific 分支必须直接调用页面事件处理器',
)
assert(
  !supplementRouteDispatchSource.includes('getFcsHandlersModule'),
  '补料管理 route-specific 分支不得预取 FCS handlers 全包',
)

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
assert.match(statsHtml, /class="[^"]*\bh-12\b[^"]*\bitems-center\b[^"]*\bjustify-between\b[^"]*"/, '统计卡片必须固定 48px 且标签和值单行对齐')
assert.doesNotMatch(statsHtml, /mt-1 text-xl/, '统计卡片不得继续使用上下两段布局')

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

for (const invalidStoredPreferences of [
  null,
  [],
  {},
  { order: 'recordNo', visibleKeys: [], frozenKeys: [], pageSize: 10 },
  { order: [], visibleKeys: 'recordNo', frozenKeys: [], pageSize: 10 },
  { order: [], visibleKeys: [], frozenKeys: 'recordNo', pageSize: 10 },
  { order: [], visibleKeys: [], frozenKeys: [], pageSize: '10' },
]) {
  storage.setItem('standard-list-columns', JSON.stringify(invalidStoredPreferences))
  assert.deepEqual(
    loadListColumnPreferences(
      storage,
      'standard-list-columns',
      columnRules,
      invalidDefaultColumnPreferences,
      allowedPageSizes,
    ),
    normalizedDefaultColumnPreferences,
    `不完整或字段类型错误的 Storage 必须回退规范化默认值：${JSON.stringify(invalidStoredPreferences)}`,
  )
}

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
assert.match(
  standardListTableHtml,
  /data-standard-list-sort-icon="asc"[\s\S]*?<svg[^>]+aria-hidden="true"/,
  '升序表头必须输出稳定可见的内联 SVG 图标',
)
assert(!standardListTableHtml.includes('data-lucide="arrow-up"'), '排序图标不得依赖 Lucide hydration')
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

const middleFrozenColumns: StandardListColumn<DemoRow>[] = [
  standardListColumns[0],
  {
    key: 'target',
    title: '补料对象',
    width: 180,
    freezeable: true,
    render: () => '裁片单',
  },
  standardListColumns[1],
  standardListColumns[2],
]
const middleFrozenTableHtml = renderStandardListTable({
  columns: middleFrozenColumns,
  rows: [{ recordNo: 'BL-004', qty: 12 }],
  preferences: {
    order: ['recordNo', 'target', 'qty', 'actions'],
    visibleKeys: ['recordNo', 'target', 'qty', 'actions'],
    frozenKeys: ['qty'],
    pageSize: 10,
  },
  sort: null,
  eventPrefix: 'demo-list',
})
const middleFrozenHeaderKeys = [...middleFrozenTableHtml.matchAll(/<th[\s\S]*?data-column-key="([^"]+)"/g)]
  .map((match) => match[1])
assert.deepEqual(
  middleFrozenHeaderKeys,
  ['qty', 'recordNo', 'target', 'actions'],
  '冻结中间列必须立即进入表格最左侧固定区',
)
assert.match(
  middleFrozenTableHtml,
  /style="[^"]*left: 0px;[^"]*"[\s\S]*?data-column-key="qty"/,
  '首个冻结列必须显式固定在 left 0px',
)

const multipleMiddleFrozenTableHtml = renderStandardListTable({
  columns: middleFrozenColumns,
  rows: [{ recordNo: 'BL-005', qty: 15 }],
  preferences: {
    order: ['recordNo', 'target', 'qty', 'actions'],
    visibleKeys: ['recordNo', 'target', 'qty', 'actions'],
    frozenKeys: ['target', 'qty'],
    pageSize: 10,
  },
  sort: null,
  eventPrefix: 'demo-list',
})
const multipleFrozenHeaderKeys = [...multipleMiddleFrozenTableHtml.matchAll(/<th[\s\S]*?data-column-key="([^"]+)"/g)]
  .map((match) => match[1])
assert.deepEqual(
  multipleFrozenHeaderKeys,
  ['target', 'qty', 'recordNo', 'actions'],
  '多个冻结列必须按用户列顺序组成最左侧固定区',
)
assert.match(
  multipleMiddleFrozenTableHtml,
  /style="[^"]*left: 180px;[^"]*"[\s\S]*?data-column-key="qty"/,
  '第二个冻结列必须按前一个冻结列宽度累计 left 偏移',
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
assert.match(
  emptyTableHtml,
  /data-standard-list-sort-icon="none"[\s\S]*?<svg[^>]+aria-hidden="true"/,
  '未排序表头必须输出双向内联 SVG 图标',
)
assert(!emptyTableHtml.includes('data-lucide="arrow-up-down"'), '未排序图标不得依赖 Lucide hydration')

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

function supplementControlEvent(type: 'click' | 'input' | 'change'): Event {
  return { type } as Event
}

function supplementColumnDragTarget(columnKey: string): HTMLElement {
  const target = {
    dataset: {
      cuttingSupplementColumnKey: columnKey,
      dragSource: columnKey,
      dropTarget: columnKey,
    },
    closest(selector: string) {
      return selector === '[data-standard-list-column-drag]'
        || selector === '[data-skip-page-rerender="true"]'
        ? target
        : null
    },
  }
  return target as unknown as HTMLElement
}

function supplementDragEvent(type: 'dragstart' | 'dragover' | 'drop' | 'dragend', initialData = '', internal = true): {
  event: Event
  dataTransfer: { getData(format: string): string; setData(format: string, value: string): void }
  wasPrevented(): boolean
} {
  let transferred = initialData
  let prevented = false
  const dataTransfer = {
    effectAllowed: 'all',
    dropEffect: 'none',
    getData(format: string) {
      return format === 'application/x-higood-list-column-key' ? transferred : ''
    },
    setData(format: string, value: string) {
      if (format === 'application/x-higood-list-column-key') transferred = value
    },
  }
  return {
    event: {
      type,
      dataTransfer,
      higoodStandardListColumnDrag: internal || undefined,
      higoodStandardListColumnKey: internal ? initialData : undefined,
      preventDefault() {
        prevented = true
      },
    } as unknown as Event,
    dataTransfer,
    wasPrevented: () => prevented,
  }
}

function countRecordRows(html: string): number {
  return [...html.matchAll(/data-record-id="[^"]+"/g)].length
}

function tableHeader(html: string, columnKey: string): string {
  const markerIndex = html.indexOf(`data-column-key="${columnKey}"`)
  const start = html.lastIndexOf('<th', markerIndex)
  const end = html.indexOf('</th>', markerIndex)
  assert(start >= 0 && end > markerIndex, `缺少列表表头：${columnKey}`)
  return html.slice(start, end + 5)
}

function assertDefaultPageSize(html: string, message: string): void {
  assert.match(html, /<option value="10" selected>10 条\/页<\/option>/, message)
}

const supplementStorageKey = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const defaultSupplementStorage = createMemoryStorageWithSeed()
const supplementDom = installSupplementBrowser(defaultSupplementStorage)
const supplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-check')
assert.equal(
  typeof supplementPage.normalizeSupplementListPreferences,
  'function',
  '补料页面必须提供纯函数规范化页面列偏好',
)
assert.deepEqual(
  supplementPage.normalizeSupplementListPreferences({
    order: ['recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions'],
    visibleKeys: ['recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions'],
    frozenKeys: ['recordNo', 'target', 'supplementQty'],
    pageSize: 10,
  }).frozenKeys,
  ['recordNo', 'target'],
  '超宽冻结偏好必须按当前列顺序从后往前清退到 520px 内',
)
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

assert.equal(
  supplementPage.handleCraftCuttingSupplementManagementEvent(
    supplementField('pageSize', '20'),
    supplementControlEvent('input'),
  ),
  false,
  '每页条数 input 事件不得处理',
)
supplementPage.handleCraftCuttingSupplementManagementEvent(
  supplementField('pageSize', '20'),
  supplementControlEvent('change'),
)
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

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('open-column-settings'))
const preferencesBeforeDrag = defaultSupplementStorage.read(supplementStorageKey)
const dragStart = supplementDragEvent('dragstart')
assert.equal(
  supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('created'), dragStart.event),
  true,
  '合法列拖动开始必须被页面处理',
)
assert.equal(dragStart.dataTransfer.getData('application/x-higood-list-column-key'), 'created', '拖动开始必须写入专用 MIME 源列')
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeDrag, '拖动开始不得提前修改偏好')
const dragOver = supplementDragEvent('dragover', 'created')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('recordNo'), dragOver.event)
assert.equal(dragOver.wasPrevented(), true, '合法放置目标必须允许 drop')
const drop = supplementDragEvent('drop', dragStart.dataTransfer.getData('application/x-higood-list-column-key'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('recordNo'), drop.event)
assert.equal(drop.wasPrevented(), true, '合法放置必须阻止浏览器默认行为')
let draggedPreferences = JSON.parse(defaultSupplementStorage.read(supplementStorageKey) ?? '{}') as StandardListColumnPreferences
assert.deepEqual(
  draggedPreferences.order,
  ['created', 'recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'actions'],
  'drop 必须把源列移动到目标列之前并保持操作列最后',
)
assert(
  (supplementDom.regions.get('table')?.innerHTML.indexOf('data-column-key="created"') ?? -1)
    < (supplementDom.regions.get('table')?.innerHTML.indexOf('data-column-key="recordNo"') ?? -1),
  '列拖动后必须局部刷新表格顺序',
)
assert(
  (supplementDom.regions.get('overlay')?.innerHTML.indexOf('data-standard-list-column-key="created"') ?? -1)
    < (supplementDom.regions.get('overlay')?.innerHTML.indexOf('data-standard-list-column-key="recordNo"') ?? -1),
  '列拖动后必须局部刷新列设置顺序',
)

const preferencesBeforeInvalidDrag = defaultSupplementStorage.read(supplementStorageKey)
const invalidSourceStart = supplementDragEvent('dragstart')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('unknown'), invalidSourceStart.event)
const invalidSourceDrop = supplementDragEvent('drop', 'unknown')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('recordNo'), invalidSourceDrop.event)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeInvalidDrag, '未知源列不得修改偏好')
assert.equal(invalidSourceDrop.wasPrevented(), false, '未知源列不得允许 drop')

const actionSourceStart = supplementDragEvent('dragstart')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('actions'), actionSourceStart.event)
const actionSourceDrop = supplementDragEvent('drop', 'actions')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('recordNo'), actionSourceDrop.event)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeInvalidDrag, '操作列不得作为拖动源')
assert.equal(actionSourceDrop.wasPrevented(), false, '操作列不得进入合法放置流程')

const validSourceStart = supplementDragEvent('dragstart')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('created'), validSourceStart.event)
const actionTargetDrop = supplementDragEvent('drop', validSourceStart.dataTransfer.getData('application/x-higood-list-column-key'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('actions'), actionTargetDrop.event)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeInvalidDrag, '操作列不得作为放置目标且必须保持最后')
assert.equal(actionTargetDrop.wasPrevented(), false, '操作列目标不得允许 drop')

const unknownTargetStart = supplementDragEvent('dragstart')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('created'), unknownTargetStart.event)
const unknownTargetDrop = supplementDragEvent('drop', unknownTargetStart.dataTransfer.getData('application/x-higood-list-column-key'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('unknown'), unknownTargetDrop.event)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeInvalidDrag, '未知目标列不得修改偏好')
assert.equal(unknownTargetDrop.wasPrevented(), false, '未知目标列不得允许 drop')
draggedPreferences = JSON.parse(defaultSupplementStorage.read(supplementStorageKey) ?? '{}') as StandardListColumnPreferences
assert.equal(draggedPreferences.order.at(-1), 'actions', '任意拖动后操作列都必须保持最后')

const preferencesBeforeExternalUnitDrop = defaultSupplementStorage.read(supplementStorageKey)
const externalDrop = supplementDragEvent('drop', 'status', false)
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('recordNo'), externalDrop.event)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeExternalUnitDrop, '无内部会话标记的拖入不得修改偏好')

const cancelledStart = supplementDragEvent('dragstart')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('status'), cancelledStart.event)
supplementPage.handleCraftCuttingSupplementManagementEvent(
  supplementColumnDragTarget('status'),
  supplementDragEvent('dragend', 'status').event,
)
const cancelledDrop = supplementDragEvent('drop', 'status')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementColumnDragTarget('recordNo'), cancelledDrop.event)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeExternalUnitDrop, 'dragend 后页面处理器必须拒绝后续 drop')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('close-column-settings'))

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('sort-column', { columnKey: 'supplementQty' }))
assert.equal(
  supplementPage.handleCraftCuttingSupplementManagementEvent(
    supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }),
    supplementControlEvent('click'),
  ),
  false,
  '列显示 click 事件不得处理',
)
supplementPage.handleCraftCuttingSupplementManagementEvent(
  supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }),
  supplementControlEvent('change'),
)
assert(!supplementDom.regions.get('table')?.innerHTML.includes('data-column-key="supplementQty"'), '列显隐必须局部刷新表格')
supplementPage.handleCraftCuttingSupplementManagementEvent(
  supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }),
  supplementControlEvent('change'),
)
assert(supplementDom.regions.get('table')?.innerHTML.includes('aria-sort="none"'), '隐藏当前排序列后必须取消排序')

for (const key of ['target', 'recordNo']) {
  supplementPage.handleCraftCuttingSupplementManagementEvent(
    supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: key }),
    supplementControlEvent('change'),
  )
}
const preferencesBeforeFrozenOverflow = defaultSupplementStorage.read(supplementStorageKey)
supplementPage.handleCraftCuttingSupplementManagementEvent(
  supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: 'supplementQty' }),
  supplementControlEvent('change'),
)
assert.equal(defaultSupplementStorage.read(supplementStorageKey), preferencesBeforeFrozenOverflow, '冻结宽度超过 520 时不得改变偏好')
assert(supplementDom.regions.get('feedback')?.innerHTML.includes('520'), '冻结宽度超过上限时必须提供业务反馈')

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('restore-column-settings'))
assert.equal(defaultSupplementStorage.read(supplementStorageKey), null, '恢复默认必须清除本地偏好')
assertDefaultPageSize(supplementDom.regions.get('pagination')?.innerHTML ?? '', '恢复默认必须回到 10 条/页')

supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: 'supplementQty' }), supplementControlEvent('change'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }), supplementControlEvent('change'))
let storedSupplementPreferences = JSON.parse(defaultSupplementStorage.read(supplementStorageKey) ?? '{}') as StandardListColumnPreferences
assert(!storedSupplementPreferences.frozenKeys.includes('supplementQty'), '隐藏冻结列时必须同时解除冻结')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }), supplementControlEvent('change'))

for (const key of ['target', 'recordNo']) {
  supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: key }), supplementControlEvent('change'))
}
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }), supplementControlEvent('change'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: 'supplementQty' }), supplementControlEvent('change'))
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-visibility', { cuttingSupplementColumnKey: 'supplementQty' }), supplementControlEvent('change'))
storedSupplementPreferences = JSON.parse(defaultSupplementStorage.read(supplementStorageKey) ?? '{}') as StandardListColumnPreferences
assert.deepEqual(
  storedSupplementPreferences.frozenKeys,
  ['recordNo', 'target'],
  'hide-freeze-show 不得重新激活第三列形成 540px 冻结宽度',
)
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('restore-column-settings'))

for (const key of ['target', 'supplementQty', 'recordNo']) {
  supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('toggle-column-freeze', { cuttingSupplementColumnKey: key }), supplementControlEvent('change'))
}
storedSupplementPreferences = JSON.parse(defaultSupplementStorage.read(supplementStorageKey) ?? '{}') as StandardListColumnPreferences
assert.deepEqual(storedSupplementPreferences.frozenKeys, ['recordNo', 'target'], '新增前置冻结列时必须从尾部清退超限列')
assert.match(
  supplementDom.regions.get('feedback')?.innerHTML ?? '',
  /已自动取消后置冻结列/,
  '从尾部清退超限冻结列时必须显示中文反馈',
)
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('restore-column-settings'))

const firstRecordId = supplementHtml.match(/data-record-id="([^"]+)"/)?.[1]
assert(firstRecordId, '补料管理列表必须提供详情记录 ID')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('open-detail', { recordId: firstRecordId }))
assert(supplementDom.regions.get('overlay')?.innerHTML.includes('补料单详情'), '查看详情必须只刷新覆盖层')
supplementPage.handleCraftCuttingSupplementManagementEvent(supplementAction('close-detail'))
assert.equal(supplementDom.regions.get('overlay')?.innerHTML, '', '关闭详情必须清空覆盖层')

const validPreferences = {
  order: ['recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions'],
  visibleKeys: ['recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'created', 'actions'],
  frozenKeys: ['recordNo', 'target', 'supplementQty'],
  pageSize: 20,
}
installSupplementBrowser(createMemoryStorageWithSeed({
  [supplementStorageKey]: JSON.stringify(validPreferences),
}))
const storedSupplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-valid-storage')
const storedSupplementHtml = storedSupplementPage.renderCraftCuttingSupplementManagementPage()
assert.equal(countRecordRows(storedSupplementHtml), supplementTotal, '有效 localStorage 偏好必须加载 20 条/页')
assert.match(storedSupplementHtml, /<option value="20" selected>20 条\/页<\/option>/, '有效 localStorage 页大小必须生效')
assert(tableHeader(storedSupplementHtml, 'recordNo').includes('sticky'), '超宽 Storage 加载后必须保留前序可用冻结列')
assert(tableHeader(storedSupplementHtml, 'target').includes('sticky'), '超宽 Storage 加载后必须保留 520px 内的冻结列')
assert(!tableHeader(storedSupplementHtml, 'supplementQty').includes('sticky'), '超宽 Storage 加载后必须清退后置超限冻结列')

installSupplementBrowser(createMemoryStorageWithSeed({ [supplementStorageKey]: '{broken json' }))
const brokenSupplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-broken-storage')
assertDefaultPageSize(brokenSupplementPage.renderCraftCuttingSupplementManagementPage(), '损坏 localStorage 必须回退默认偏好')

installSupplementBrowser(failingStorage)
const failingSupplementPage = await import('../src/pages/process-factory/cutting/supplement-management.ts?standard-list-failing-storage')
assert.doesNotThrow(() => failingSupplementPage.renderCraftCuttingSupplementManagementPage(), 'Storage 异常不得阻断补料管理渲染')
assertDefaultPageSize(failingSupplementPage.renderCraftCuttingSupplementManagementPage(), 'Storage 异常必须回退默认偏好')

async function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer()
    probe.unref()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        probe.close()
        reject(new Error('无法取得 Chromium 检查的本地空闲端口'))
        return
      }
      probe.close((error) => {
        if (error) reject(error)
        else resolve(address.port)
      })
    })
  })
}

async function checkSupplementColumnDragInChromium(): Promise<void> {
  const browserPort = await findFreeLoopbackPort()
  assert(browserPort > 0, '真实 Chromium 检查必须预先分配可用端口，禁止把 port: 0 交给 Vite')
  const server = await createServer({
    logLevel: 'error',
    server: { host: '127.0.0.1', port: browserPort, strictPort: true },
  })
  await server.listen()
  assert.equal(server.config.server.strictPort, true, '真实 Chromium 检查必须使用 strictPort，禁止 Vite 自动换端口')
  const localUrl = server.resolvedUrls?.local[0]
  assert(localUrl, '真实 Chromium 检查必须取得 Vite 实际监听地址')
  assert.equal(Number(new URL(localUrl).port), browserPort, 'Vite 实际监听端口必须等于预先分配端口')
  const pageUrl = new URL('/fcs/craft/cutting/supplement-management', localUrl).toString()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  try {
    await page.goto(pageUrl)
    await page.evaluate((key) => localStorage.removeItem(key), supplementStorageKey)
    await page.reload()
    await page.getByRole('button', { name: '列设置' }).click()
    await page.locator('main').evaluate((main) => { main.dataset.columnDragBrowserMarker = 'kept' })
    await page.evaluate(() => {
      const main = document.querySelector('main')
      const stats = document.querySelector('[data-cutting-supplement-region="stats"]')
      const pagination = document.querySelector('[data-cutting-supplement-region="pagination"]')
      if (!main || !stats || !pagination) throw new Error('缺少列拖拽稳定性检查所需 DOM 区域')
      const testWindow = window as typeof window & {
        __standardListDropCount?: number
        __standardListStableDom?: {
          main: Element
          stats: Element
          pagination: Element
          statsMutations: number
          paginationMutations: number
        }
      }
      testWindow.__standardListDropCount = 0
      testWindow.__standardListStableDom = {
        main,
        stats,
        pagination,
        statsMutations: 0,
        paginationMutations: 0,
      }
      new MutationObserver((records) => {
        if (testWindow.__standardListStableDom) {
          testWindow.__standardListStableDom.statsMutations += records.length
        }
      }).observe(stats, { attributes: true, characterData: true, childList: true, subtree: true })
      new MutationObserver((records) => {
        if (testWindow.__standardListStableDom) {
          testWindow.__standardListStableDom.paginationMutations += records.length
        }
      }).observe(pagination, { attributes: true, characterData: true, childList: true, subtree: true })
      document.addEventListener('drop', () => {
        testWindow.__standardListDropCount = (testWindow.__standardListDropCount ?? 0) + 1
      })
    })

    const createdColumn = page.locator('[data-standard-list-column-key="created"]')
    const recordNoColumn = page.locator('[data-standard-list-column-key="recordNo"]')
    await createdColumn.dragTo(recordNoColumn)

    assert.equal(
      await page.evaluate(() => (window as typeof window & { __standardListDropCount?: number }).__standardListDropCount ?? 0),
      1,
      '真实 Chromium 拖动必须派发 drop',
    )
    assert.equal(
      await page.locator('main').getAttribute('data-column-drag-browser-marker'),
      'kept',
      '真实拖动不得替换 main 页面主体',
    )
    const browserHeaderOrder = await page.locator('[data-standard-list-table-section] thead th[data-column-key]').evaluateAll(
      (headers) => headers.map((header) => header.getAttribute('data-column-key')),
    )
    assert.deepEqual(
      browserHeaderOrder,
      ['created', 'recordNo', 'target', 'supplementQty', 'materialDemand', 'processDemand', 'status', 'actions'],
      '真实 Chromium drop 必须局部更新列顺序并保持操作列最后',
    )
    const browserPreferences = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}') as StandardListColumnPreferences,
      supplementStorageKey,
    )
    assert.deepEqual(browserPreferences.order, browserHeaderOrder, '真实 Chromium drop 必须持久化列顺序')

    const preferencesBeforeExternalDrop = JSON.stringify(browserPreferences)
    await page.evaluate(({ storageKey }) => {
      const target = document.querySelector<HTMLElement>('[data-standard-list-column-key="recordNo"]')
      const transfer = new DataTransfer()
      transfer.setData('text/plain', 'status')
      target?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      target?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      return localStorage.getItem(storageKey)
    }, { storageKey: supplementStorageKey })
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), supplementStorageKey),
      preferencesBeforeExternalDrop,
      '外部 text/plain 拖入不得修改列偏好',
    )

    await page.evaluate(() => {
      const source = document.querySelector<HTMLElement>('[data-standard-list-column-key="status"]')
      const target = document.querySelector<HTMLElement>('[data-standard-list-column-key="recordNo"]')
      const transfer = new DataTransfer()
      transfer.setData('application/x-higood-list-column-key', 'status')
      source?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: false, dataTransfer: transfer }))
      target?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      target?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
    })
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), supplementStorageKey),
      preferencesBeforeExternalDrop,
      'dragend 取消拖拽后不得继续接受 drop',
    )
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))
    const stableDomResult = await page.evaluate(() => {
      const state = (window as typeof window & {
        __standardListStableDom?: {
          main: Element
          stats: Element
          pagination: Element
          statsMutations: number
          paginationMutations: number
        }
      }).__standardListStableDom
      if (!state) throw new Error('缺少列拖拽稳定性检查状态')
      return {
        mainSame: document.querySelector('main') === state.main,
        statsSame: document.querySelector('[data-cutting-supplement-region="stats"]') === state.stats,
        paginationSame: document.querySelector('[data-cutting-supplement-region="pagination"]') === state.pagination,
        statsMutations: state.statsMutations,
        paginationMutations: state.paginationMutations,
      }
    })
    assert.deepEqual(stableDomResult, {
      mainSame: true,
      statsSame: true,
      paginationSame: true,
      statsMutations: 0,
      paginationMutations: 0,
    }, '真实 Chromium 列拖拽不得替换页面主体、统计或分页 DOM，也不得修改统计和分页内容')
    assert.deepEqual(pageErrors, [], '真实 Chromium 拖拽不得产生页面错误')
    console.log(`Chromium column drag passed on allocated port ${browserPort}: drop=1, DOM regions stable, order/storage updated, external text and cancelled drag ignored`)
  } finally {
    await browser.close()
    await server.close()
  }
}

await checkSupplementColumnDragInChromium()

console.log('standard list page template check passed')
