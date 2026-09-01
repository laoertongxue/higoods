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
  '严格齐套',
  '有效齐套／回货责任',
  '部位排除版本',
  '排除有效齐套计算',
  '补交不会重复增加责任',
]) assert.ok(page.includes(text), `PPIC交出与欠片页面缺少业务口径：${text}`)

const situations = ensureSewingCutPieceResponsibilityOverviewDemos().map(classifyHandoverSituation)
assert.deepEqual([...new Set(situations)].sort(), ['HANDED_NO_DEBT', 'HANDED_WITH_DEBT', 'UNHANDED'].sort())
for (const key of ['UNHANDED', 'HANDED_NO_DEBT', 'HANDED_WITH_DEBT']) {
  assert.ok(html.includes(`data-situation="${key}"`), `缺少${key}状态Tab`)
}
assert.ok(html.includes('等待裁床交出') && html.includes('交出前不判欠片'), '未交出任务不得提前归类为已交出欠片')
assert.ok(page.includes('data-sewing-cut-piece-action="open-exclusion"'))
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

console.log('PPIC交出与欠片三态Tab、任务选择、严格/有效齐套与部位排除页面契约检查通过')
