import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ensureSewingCutPieceResponsibilityOverviewDemos } from '../src/data/fcs/sewing-cut-piece-responsibility.ts'
import {
  classifyHandoverSituation,
  renderSewingCutPieceHandoverPage,
} from '../src/pages/sewing-outsourcing/cut-piece-handover.ts'

const page = readFileSync('src/pages/sewing-outsourcing/cut-piece-handover.ts', 'utf8')
const routes = readFileSync('src/router/routes-fcs.ts', 'utf8')
const renderers = readFileSync('src/router/route-renderers-fcs.ts', 'utf8')
const handlers = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')
const html = renderSewingCutPieceHandoverPage()

for (const text of [
  '交出与欠片',
  '未交出',
  '已交出不欠片',
  '已交出且欠片',
  '待裁床交出',
  '严格齐套',
  '有效齐套／责任',
  '部位排除版本',
  '只调整有效齐套，不清除欠片',
  '缺口未达一半，不允许人为排除',
  '缺一半及以上，达到排除核对阈值',
  '取消排除',
  '已冻结回货责任不回退',
]) assert.ok(page.includes(text), `PPIC交出与欠片页面缺少业务口径：${text}`)

const situations = ensureSewingCutPieceResponsibilityOverviewDemos().map(classifyHandoverSituation)
assert.deepEqual([...new Set(situations)].sort(), ['HANDED_NO_DEBT', 'HANDED_WITH_DEBT', 'UNHANDED'].sort())
for (const key of ['UNHANDED', 'HANDED_NO_DEBT', 'HANDED_WITH_DEBT']) {
  assert.ok(html.includes(`data-sewing-cut-piece-action="switch-tab:${key}"`), `缺少${key}状态Tab`)
}
assert.ok(html.includes('跟进裁床实际交出') && html.includes('交出前不判定欠片'), '未交出任务不得提前归类为已交出欠片')
assert.ok(page.includes('// @page-pattern: list'))
assert.ok(page.includes('renderStandardListPage({'))
assert.ok(page.includes('renderStandardListTable({'))
assert.ok(page.includes('renderTablePagination({'))
assert.ok(page.includes('statusTabsHtml: renderUiTabs({'))
assert.ok(page.includes('filtersHtml: renderStandardListFilters({'))
assert.ok(!page.includes('statsHtml:'), '专业页面不得重复展示统计卡片')
assert.ok(!page.includes('renderTaskChooser'), '标准任务列表不得继续使用卡片选择器并在页面下堆叠明细')
assert.ok(!page.includes('data-sewing-cut-piece-action="select-task"'), '列表操作必须统一进入操作列的详情')
assert.ok(page.includes('data-sewing-cut-piece-action="open-exclusion"'))
assert.ok(page.includes('data-sewing-cut-piece-action="open-cancel-exclusion"'))
assert.ok(page.includes('getSewingCutPiecePartExclusionEligibility'))
assert.ok(page.includes('data-sewing-cut-piece-action="preview-image"'))
assert.ok(page.includes('export function closeSewingCutPieceHandoverDialog'))
assert.ok(page.includes('formatOperationLocalWallClock()'))
assert.ok(!page.includes('new Date().toISOString()'))
assert.ok(!page.includes('新增交出记录'))
assert.ok(routes.includes("'/fcs/sewing-outsourcing/cut-piece-handover'"))
assert.ok(renderers.includes("import('../pages/sewing-outsourcing/cut-piece-handover')"))
assert.ok(handlers.includes("pathname.startsWith('/fcs/sewing-outsourcing/cut-piece-handover')"))
assert.ok(handlers.includes('isSewingCutPieceHandoverDialogOpen()'))
assert.ok(handlers.includes('closeSewingCutPieceHandoverDialog()'))

console.log('PPIC交出与欠片标准列表、三态Tab、详情、严格/有效齐套与部位排除页面契约检查通过')
