import assert from 'node:assert/strict'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../src/components/ui/list-table.ts'
import { renderTablePagination } from '../src/components/ui/pagination.ts'
import type { StandardListColumnPreferences } from '../src/components/ui/list-table-model.ts'

interface FixtureRow {
  id: string
  name: string
}

const columns: StandardListColumn<FixtureRow>[] = [
  {
    key: 'name',
    title: '名称',
    width: 180,
    sortable: true,
    freezeable: true,
    render: (row) => row.name,
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    required: true,
    actionColumn: true,
    render: () => '查看',
  },
]
const preferences: StandardListColumnPreferences = {
  order: ['name', 'actions'],
  visibleKeys: ['name', 'actions'],
  frozenKeys: [],
  pageSize: 10,
}

const defaultTable = renderStandardListTable({
  columns,
  rows: [{ id: 'ROW-1', name: '默认重绘页面' }],
  preferences,
  sort: null,
  eventPrefix: 'legacy-list',
})
assert(
  !defaultTable.includes('data-skip-page-rerender="true"'),
  '标准表格默认必须允许主入口重绘页面',
)

const defaultPagination = renderTablePagination({
  total: 20,
  from: 1,
  to: 10,
  currentPage: 1,
  totalPages: 2,
  pageSize: 10,
  actionPrefix: 'legacy-list',
})
assert(
  !defaultPagination.includes('data-skip-page-rerender="true"'),
  '标准分页默认必须允许主入口重绘页面',
)

const defaultColumnSettings = renderStandardListColumnSettings({
  title: '列设置',
  columns,
  preferences,
  eventPrefix: 'legacy-list',
  maxFrozenWidth: 520,
})
assert(
  !defaultColumnSettings.includes('data-skip-page-rerender="true"'),
  '标准列设置默认必须允许主入口重绘页面',
)

function tagFor(html: string, attribute: string): string {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.match(new RegExp(`<[^>]+${escaped}[^>]*>`))?.[0] ?? ''
}

const localTable = renderStandardListTable({
  columns,
  rows: [{ id: 'ROW-LOCAL', name: '局部更新页面' }],
  preferences,
  sort: null,
  eventPrefix: 'local-list',
  skipPageRerender: true,
})
assert(
  tagFor(localTable, 'data-local-list-action="sort-column"')
    .includes('data-skip-page-rerender="true"'),
  '显式局部管理的标准表格排序必须跳过主重绘',
)
const localPagination = renderTablePagination({
  total: 20,
  from: 1,
  to: 10,
  currentPage: 1,
  totalPages: 2,
  pageSize: 10,
  actionPrefix: 'local-list',
  skipPageRerender: true,
})
for (const attribute of [
  'data-local-list-action="prev-page"',
  'data-local-list-action="next-page"',
  'data-local-list-field="pageSize"',
]) {
  assert(
    tagFor(localPagination, attribute).includes('data-skip-page-rerender="true"'),
    `显式局部管理的标准分页 ${attribute} 必须跳过主重绘`,
  )
}
const localColumnSettings = renderStandardListColumnSettings({
  title: '列设置',
  columns,
  preferences,
  eventPrefix: 'local-list',
  maxFrozenWidth: 520,
  skipPageRerender: true,
})
for (const attribute of [
  'data-local-list-action="close-column-settings"',
  'data-local-list-action="restore-column-settings"',
  'data-local-list-action="toggle-column-visibility"',
  'data-local-list-action="toggle-column-freeze"',
  'data-standard-list-column-drag',
]) {
  assert(
    tagFor(localColumnSettings, attribute).includes('data-skip-page-rerender="true"'),
    `显式局部管理的列设置 ${attribute} 必须跳过主重绘`,
  )
}

console.log('PASS list local-event contract: default and explicit local-render controls remain separated')
