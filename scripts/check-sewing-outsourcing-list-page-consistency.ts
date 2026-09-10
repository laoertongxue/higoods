import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { renderSewingCutPieceHandoverPage } from '../src/pages/sewing-outsourcing/cut-piece-handover.ts'
import { renderSewingOutsourcingCutPieceReturnsPage } from '../src/pages/sewing-outsourcing/cut-piece-returns.ts'
import { renderSewingOutsourcingResponsibilityTransfersPage } from '../src/pages/sewing-outsourcing/responsibility-transfers.ts'
import { renderSewingOutsourcingReturnsPage } from '../src/pages/sewing-outsourcing/returns.ts'
import { renderSampleApprovalSuggestionsPage } from '../src/pages/sewing-outsourcing/sample-approval-suggestions.ts'
import { renderSewingOutsourcingSupplementsPage } from '../src/pages/sewing-outsourcing/supplements.ts'
import { renderSewingOutsourcingTasksPage } from '../src/pages/sewing-outsourcing/tasks.ts'
import { renderSewingProductionOrderDurationPage } from '../src/pages/sewing-outsourcing/production-order-duration.ts'

const pages = [
  { name: '车缝任务', file: 'src/pages/sewing-outsourcing/tasks.ts', html: renderSewingOutsourcingTasksPage(), hasTabs: true },
  { name: '交出与欠片', file: 'src/pages/sewing-outsourcing/cut-piece-handover.ts', html: renderSewingCutPieceHandoverPage(), hasTabs: true },
  { name: '批版建议', file: 'src/pages/sewing-outsourcing/sample-approval-suggestions.ts', html: renderSampleApprovalSuggestionsPage(), hasTabs: true },
  { name: '回货跟进', file: 'src/pages/sewing-outsourcing/returns.ts', html: renderSewingOutsourcingReturnsPage(), hasTabs: true },
  { name: '补料跟进', file: 'src/pages/sewing-outsourcing/supplements.ts', html: renderSewingOutsourcingSupplementsPage(), hasTabs: true },
  { name: '裁片退仓', file: 'src/pages/sewing-outsourcing/cut-piece-returns.ts', html: renderSewingOutsourcingCutPieceReturnsPage(), hasTabs: true },
  { name: '责任移交', file: 'src/pages/sewing-outsourcing/responsibility-transfers.ts', html: renderSewingOutsourcingResponsibilityTransfersPage(), hasTabs: true },
  { name: '生成单全流程耗时', file: 'src/pages/sewing-outsourcing/production-order-duration.ts', html: renderSewingProductionOrderDurationPage(), hasTabs: false },
] as const

for (const page of pages) {
  const source = readFileSync(page.file, 'utf8')
  const fieldsLine = source.split('\n').find((line) => line.includes('fieldsHtml:')) || ''
  assert.ok(source.includes('// @page-pattern: list'), `${page.name}必须声明标准列表页`)
  assert.ok(source.includes('renderStandardListPage({'), `${page.name}必须使用标准列表骨架`)
  assert.ok(source.includes('renderStandardListFilters({'), `${page.name}必须使用统一筛选操作区`)
  if (page.hasTabs) {
    assert.ok(source.includes('renderUiTabs({'), `${page.name}必须使用统一业务Tab`)
    assert.ok(source.includes("variant: 'pills'"), `${page.name}必须使用统一Pills Tab样式`)
    assert.ok(source.includes('fullWidth: true'), `${page.name}业务Tab必须统一等宽展示`)
  } else {
    assert.ok(!source.includes('renderUiTabs({'), `${page.name}没有业务分类，不得强加状态Tab`)
  }
  assert.ok(!source.includes('renderStandardListStats'), `${page.name}不得导入统计卡片`)
  assert.ok(!source.includes('statsHtml:'), `${page.name}不得渲染重复统计卡片`)
  assert.ok(
    source.includes('draftKeyword') || (source.includes('let draft') && source.includes('let applied')),
    `${page.name}搜索条件必须区分草稿值与已生效值`,
  )
  assert.ok(source.includes("action === 'query'"), `${page.name}缺少查询动作`)
  assert.ok(source.includes("action === 'reset'"), `${page.name}缺少重置动作`)
  assert.ok(!fieldsLine.includes('<a '), `${page.name}搜索字段区不得混入页面跳转动作`)
  assert.ok(!fieldsLine.includes('原型核查时点'), `${page.name}搜索字段区不得混入非筛选说明`)
  assert.equal((page.html.match(/data-standard-list-query/g) || []).length, 1, `${page.name}必须且只能有一个查询按钮`)
  assert.equal((page.html.match(/data-standard-list-reset/g) || []).length, 1, `${page.name}必须且只能有一个重置按钮`)
  if (page.hasTabs) {
    assert.ok(page.html.includes('data-standard-list-status-tabs'), `${page.name}缺少独立业务Tab区域`)
    assert.ok(page.html.includes('role="tablist"'), `${page.name}业务Tab缺少tablist语义`)
  } else {
    assert.ok(!page.html.includes('role="tablist"'), `${page.name}不得渲染空状态Tab`)
  }
  assert.ok(!page.html.includes('data-standard-list-stats'), `${page.name}运行时仍存在统计卡片`)
}

const workbench = readFileSync('src/pages/sewing-outsourcing/workbench.ts', 'utf8')
assert.ok(workbench.includes('我的工作台'), '我的工作台必须保留')
assert.ok(!workbench.includes('// @page-pattern: list'), '我的工作台是汇总入口，不得被改成标准任务列表')

const durationPage = readFileSync('src/pages/sewing-outsourcing/production-order-duration.ts', 'utf8')
assert.ok(!durationPage.includes('data-ppic-duration-feedback'), '导出后不得在页面底部追加成功提示')
assert.ok(!durationPage.includes('已导出 ${currentRows.length}'), '导出后不得保留成功提示文案')
for (const heading of ['单据号', '开始时间', '结束时间', '取用为节点开始', '取用为节点结束']) {
  assert.ok(durationPage.includes(heading), `来源明细必须突出${heading}`)
}
for (const removedHeading of ['执行任务／工厂', '状态／版本', '取用依据／未取用原因']) {
  assert.ok(!durationPage.includes(`title: '${removedHeading}'`), `来源明细不得继续展示${removedHeading}`)
}

console.log('车缝外发协同8个专业二级菜单的查询/重置、统计去重、共享Tab和标准页面骨架检查通过')
