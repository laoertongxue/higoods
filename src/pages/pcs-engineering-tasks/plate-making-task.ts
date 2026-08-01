// @page-pattern: list
// 标准列表契约由 createMasterTaskPage 内部统一调用：renderStandardListPage、renderStandardListTable、renderTablePagination。
// 制版任务：梭织/毛织基码与齐码纸样统一读取工程主单任务事实。
import { createMasterTaskPage } from './master-task-page.ts'
import { state } from './shared.ts'

const page = createMasterTaskPage({
  module: 'plate', title: '制版任务', path: '/pcs/patterns/plate-making',
  taskTypes: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'],
  listState: state.plateList,
})
export const renderPcsPlateMakingTaskPage = page.renderList
export const renderPcsPlateMakingTaskDetailPage = page.renderDetail
