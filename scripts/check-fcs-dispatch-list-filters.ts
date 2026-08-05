import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAssignableProductionExecutionTask } from '../src/data/fcs/merged-production-task.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'

const page = readFileSync('src/pages/unified-dispatch-workbench.ts', 'utf8')

const requiredColumns = [
  "title: '款式 / SPU'",
  "title: '生产单 / 任务'",
  "title: '阶段'",
  "title: '任务类型 / 工序 / 工艺'",
  "title: '数量 / 分配颗粒度'",
  "title: '生产准备'",
  "title: '跟单责任'",
  "title: '分配方式'",
  "title: '承接工厂'",
  "title: '价格'",
  "title: '任务状态'",
  "title: '操作'",
]
requiredColumns.forEach((column) => assert.ok(page.includes(column), `缺少任务分配列表字段：${column}`))

const requiredFilters = [
  '综合搜索', '分配进度', '分配方式', '阶段', '工序', '工艺', '承接工厂', '价格状态',
  '国内跟单', '印尼跟单', '派单日期（起）', '派单日期（止）', '更多筛选', '工厂接单状态',
  '自动分配资格', '自动分配配置', '自动分配结果', '车缝准备风险', '菲票装袋情况', '合并模式',
  '合同状态', '任务数量下限（件）', '任务数量上限（件）', 'SKU数下限', 'SKU数上限',
  '任务截止（起）', '任务截止（止）', '币种', '计价单位', '已选条件', '重置筛选',
]
requiredFilters.forEach((label) => assert.ok(page.includes(label), `缺少任务分配筛选条件或交互：${label}`))

assert.ok(page.includes("if (key === 'stage') { state.filters.process = 'ALL'; state.filters.craft = 'ALL' }"), '阶段变化必须重置下游工序和工艺')
assert.ok(page.includes("if (key === 'process') state.filters.craft = 'ALL'"), '工序变化必须重置下游工艺')
assert.ok(page.includes("state.filters = { ...DEFAULT_FILTERS }"), '必须支持重置全部筛选')
assert.ok(page.includes('data-unified-action="clear-filter"'), '必须支持逐项清除筛选条件')
assert.ok(page.includes("['PROD', '生产阶段'], ['POST', '后道阶段']"), '阶段筛选只能出现生产阶段和后道阶段')
assert.ok(!page.includes("['PREP', '准备阶段']"), '准备阶段不得进入任务分配筛选')
assert.ok(!page.includes("title: '工艺组'"), '列表不得沿用错误的“工艺组”字段名')
assert.ok(!page.includes("title: '后道任务'"), '列表不得使用“后道任务”口径')

const tasks = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
assert.ok(tasks.length > 0, '必须存在可验证的生产执行任务')
assert.equal(tasks.some((task) => String(task.stageCode || task.stage) === 'PREP'), false, '生产准备阶段对象不得进入任务分配数据源')
assert.equal(tasks.some((task) => ['质检', '复检', '后道质检'].includes(task.processNameZh)), false, '质检、复检流程节点不得成为任务分配工序')

console.log(`FCS 任务分配列表与筛选检查通过：${requiredColumns.length}个字段、${requiredFilters.length}个筛选事实、联动重置和生产准备边界全部通过；当前可分配生产任务${tasks.length}个。`)
