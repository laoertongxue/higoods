import assert from 'node:assert/strict'

import {
  renderStandardListPage,
  renderStandardListStats,
} from '../src/components/ui/list-page.ts'

const statsHtml = renderStandardListStats([
  { label: '待处理', value: 12 },
  { label: '已完成', value: '8 单' },
])

const pageHtml = renderStandardListPage({
  title: '补料管理',
  primaryActionsHtml: '<button>新建补料单</button>',
  feedbackHtml: '<div>补料单已保存</div>',
  filtersHtml: '<form>补料单筛选</form>',
  statsHtml,
  listTitle: '补料单列表',
  listActionsHtml: '<button>导出</button>',
  tableHtml: '<table><tbody><tr><td>BL-001</td></tr></tbody></table>',
  paginationHtml: '<nav>第 1 页</nav>',
  overlaysHtml: '<div role="dialog">补料单详情</div>',
})

assert(pageHtml.includes('data-standard-list-page'), '缺少标准列表页根节点标记')
assert(pageHtml.includes('data-standard-list-filters'), '缺少标准列表筛选区标记')
assert(pageHtml.includes('data-standard-list-table-section'), '缺少标准列表表格区标记')

const filtersIndex = pageHtml.indexOf('补料单筛选')
const listIndex = pageHtml.indexOf('补料单列表')
assert(filtersIndex >= 0 && listIndex >= 0, '筛选区或列表标题未渲染')
assert(filtersIndex < listIndex, '筛选区必须位于补料单列表之前')

assert(!statsHtml.includes('rounded-2xl'), '统计组不得使用 rounded-2xl')
assert(!statsHtml.includes('shadow'), '统计组不得使用阴影')

console.log('standard list page template check passed')
