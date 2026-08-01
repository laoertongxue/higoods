// @page-pattern: list
// 标准列表契约由 createMasterTaskPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 花型任务：任务骨架和可见状态统一读取工程主单；成果明细仍可由花型资产维护。
import { createMasterTaskPage } from './master-task-page.ts'
import { state } from './shared.ts'

const page = createMasterTaskPage({
  module: 'pattern', title: '花型任务', path: '/pcs/patterns/artwork',
  taskTypes: ['PATTERN_ARTWORK'], listState: state.patternList,
})
export const renderPcsPatternTaskPage = page.renderList
export const renderPcsPatternTaskDetailPage = page.renderDetail
