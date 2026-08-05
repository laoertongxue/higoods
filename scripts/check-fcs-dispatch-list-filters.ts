import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAssignableProductionExecutionTask } from '../src/data/fcs/merged-production-task.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'

const page = readFileSync('src/pages/unified-dispatch-workbench.ts', 'utf8')
const columnsSource = page.slice(page.indexOf('const columns:'), page.indexOf('const preferences:'))
const filtersSource = page.slice(page.indexOf('function renderTaskFilters'), page.indexOf('function renderTaskDetailDialog'))

const requiredColumns = ['任务对象', '任务内容', '数量', '跟单责任', '分配信息', '价格', '操作']
requiredColumns.forEach((title) => assert.ok(columnsSource.includes(`title: '${title}'`), `缺少任务分配列表字段：${title}`))
assert.equal((columnsSource.match(/title: '/g) || []).length, 7, '任务分配列表必须固定为七个业务列')
for (const forbidden of ['阶段', '生产准备', '分配颗粒度', '最小分配颗粒度', 'SKU（不可拆数量）', '整任务', '任务状态', '合同状态', '准备情况']) {
  assert.ok(!columnsSource.includes(forbidden), `列表不得保留旧字段或标签：${forbidden}`)
}
assert.ok(columnsSource.includes('生产单：'), '任务对象列必须组合生产单号')
assert.ok(columnsSource.includes('任务：'), '任务对象列必须组合任务号')
assert.ok(columnsSource.includes('图片加载失败'), '任务对象真实图片必须提供可见加载失败态')
assert.ok(columnsSource.includes('个SKU'), '数量列必须展示SKU数')
assert.ok(columnsSource.includes('人工直接派单') && columnsSource.includes('自动直接派单') && columnsSource.includes('竞价'), '分配信息列必须组合分配方式')
assert.ok(columnsSource.includes('data-unified-action="open-contract"'), '有效合同必须只有一个合同快捷入口')
assert.equal((columnsSource.match(/>合同<\/button>/g) || []).length, 1, '列表合同操作必须合并为单一入口')
assert.ok(columnsSource.includes('data-unified-action="open-log"'), '任务行必须保留日志入口')

const requiredFilters = [
  '综合搜索', '分配进度', '分配方式', '工序', '承接工厂', '派单日期（起）', '派单日期（止）',
  '更多筛选', '工艺', '国内跟单', '印尼跟单', '价格状态', '重置筛选',
]
requiredFilters.forEach((label) => assert.ok(filtersSource.includes(label), `缺少任务分配筛选条件或交互：${label}`))
const dispatchEndIndex = filtersSource.indexOf("filterDateInput('dispatchEnd', '派单日期（止）')")
const filterActionsIndex = filtersSource.indexOf('data-unified-filter-actions')
assert.ok(dispatchEndIndex >= 0 && filterActionsIndex > dispatchEndIndex, '更多筛选和重置筛选必须紧接派单日期筛选之后')
assert.ok(filtersSource.includes('data-unified-filter-actions') && filtersSource.includes('xl:col-span-2'), '筛选操作必须与派单日期处于同一筛选网格行')
for (const forbidden of [
  '阶段', '自动分配资格', '自动分配配置', '车缝准备风险', '菲票装袋情况', '合同状态',
  '工厂接单状态', '自动分配结果', '合并模式', '任务数量下限（件）', '任务数量上限（件）',
  'SKU数下限', 'SKU数上限', '任务截止（起）', '任务截止（止）', '币种', '计价单位',
]) {
  assert.ok(!filtersSource.includes(forbidden), `筛选区不得保留：${forbidden}`)
}
assert.ok(filtersSource.includes("state.filters.process !== 'ALL' ? filterSelect('craft', '工艺'"), '工艺筛选必须只在已选择具体工序后出现')

assert.ok(page.includes("if (key === 'process') state.filters.craft = 'ALL'"), '工序变化必须重置工艺')
assert.ok(!page.includes("if (key === 'stage')"), '不得保留阶段筛选联动')
assert.ok(page.includes('state.filters = { ...DEFAULT_FILTERS }'), '必须支持重置全部筛选')
assert.ok(page.includes('data-unified-action="clear-filter"'), '必须支持逐项清除筛选条件')
for (const removedKey of ['acceptanceStatus', 'autoResult', 'mergeMode', 'quantityMin', 'quantityMax', 'skuCountMin', 'skuCountMax', 'taskDeadlineStart', 'taskDeadlineEnd', 'currency', 'priceUnit']) {
  assert.ok(!page.slice(page.indexOf('type WorkbenchFilterKey'), page.indexOf('interface DispatchDialogState')).includes(`'${removedKey}'`), `筛选模型不得保留已删除字段：${removedKey}`)
}
assert.ok(!page.includes("['PREP', '准备阶段']"), '准备阶段不得进入任务分配筛选')
assert.ok(!page.includes("title: '工艺组'"), '列表不得沿用错误的工艺组字段名')
assert.ok(!page.includes("title: '后道任务'"), '列表不得使用后道任务口径')
assert.ok(!page.includes('data-unified-field="riskAcknowledged"'), '车缝准备事实不得形成强制风险知悉勾选')
assert.ok(!page.includes('请先确认已知悉生产准备风险'), '准备风险不得阻断派单或竞价')
assert.ok(page.includes('renderSewingPreparationOverview(task)') && page.includes('renderBaggingOverview(bagging)'), '车缝分配弹窗必须展示辅料、裁片和菲票装袋事实')
assert.match(page, /policy\.startsWithSewing \? `<p[^`]+\$\{renderSewingPreparationOverview\(task\)\}/, '车缝准备事实只能在车缝为首的分配弹窗展示')
assert.ok(page.includes('物料图加载失败') && page.includes('图片加载失败，请检查原图地址'), '款式、物料和高清预览必须提供可见失败态')
assert.ok(page.includes('Array.from(new Set(names.filter(Boolean)))'), '任务内容中的工序名称必须去重后展示')

const tasks = listRuntimeProcessTasks().filter(isAssignableProductionExecutionTask)
assert.ok(tasks.length > 0, '必须存在可验证的生产执行任务')
assert.equal(tasks.some((task) => String(task.stageCode || task.stage) === 'PREP'), false, '生产准备阶段对象不得进入任务分配数据源')
assert.equal(tasks.some((task) => ['质检', '复检', '后道质检'].includes(task.processNameZh)), false, '质检、复检流程节点不得成为任务分配工序')

console.log(`FCS 任务分配列表与筛选检查通过：7个业务列、精简筛选、工序去重、车缝提示边界和生产准备排除全部通过；当前可分配生产任务${tasks.length}个。`)
