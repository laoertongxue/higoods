import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { escapeHtml } from '../../src/utils'
import * as source from '../../src/data/production-timing/source'
import * as calendar from '../../src/data/fcs/sewing-return-calendar'
import { resolveTimingSourceDetail } from '../../src/pages/production-fulfillment/source-document-detail'

const managementCode = ts.transpileModule(readFileSync(new URL('../../src/pages/production-fulfillment/order-pages.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
interface CapturedTable { columns: { key: string; title: string; render: (row: any) => string }[]; rows: any[] }
function management(cases: source.TimingCase[]) {
  const tables = new Map<string, CapturedTable>(), module = { exports: {} }, downloads: Blob[] = []
  const common = {
    e: escapeHtml, fmt: (n: number | null | undefined) => n == null || !Number.isFinite(n) ? '待核实' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }),
    badge: (s: string) => `<span>${escapeHtml(s)}</span>`, anchor: (s: string, href: string) => `<a href="${escapeHtml(href)}">${escapeHtml(s)}</a>`,
    button: (s: string) => `<button>${escapeHtml(s)}</button>`, imageCell: (s: string) => escapeHtml(s),
    renderDataTable(id: string, title: string, columns: CapturedTable['columns'], rows: any[]) { tables.set(id, { columns, rows }); return `<table aria-label="${title}">${rows.map(row => `<tr>${columns.map(col => `<td>${col.render(row)}</td>`).join('')}</tr>`).join('')}</table>` },
    renderColumns: () => '', tableContexts: new Map(), resetTablePages: () => {}, saveTablePreferences: () => {}, activeTableId: '',
  }
  const context = vm.createContext({ module, exports: module.exports, Date, Intl, Math, Object, Set, Blob, setTimeout: () => {}, URL: { createObjectURL: (blob: Blob) => { downloads.push(blob); return 'blob:local'; }, revokeObjectURL: () => {} }, document: { querySelector: () => null, body: { append: () => {} }, createElement: () => ({ click() {}, remove() {} }) }, require(id: string) {
    if (id === '../../data/production-timing/source') return { ...source, listTimingCases: () => cases }
    if (id === '../../data/fcs/sewing-return-calendar') return calendar
    if (id === './common') return common
    if (id === './ui-state') return { ui: {} }
    if (id === './order-pages.css') return {}
    throw new Error(`Unexpected management dependency: ${id}`)
  } })
  vm.runInContext(managementCode, context)
  const api = module.exports as { renderOrderModulePage(section: string): string; handleOrderModuleClick(target: Element): boolean }
  const click = (action: string) => api.handleOrderModuleClick({ closest(selector: string) { if (selector === '#timing-module-root') return {}; if (selector === '[data-pf-action]') return { dataset: { pfAction: action }, closest: () => null }; return null } } as unknown as Element)
  return { render: api.renderOrderModulePage, tables, downloads, click }
}

function sourceDocument(scene: string, suffix: string) {
  const order = source.getTimingCaseByScene(scene), branch = source.getTimingBranch(order)!
  const document = Object.values(branch.docs).find(doc => doc.id.endsWith(suffix))!
  assert.ok(document, `${scene} lacks ${suffix}`)
  return { order, document, html: resolveTimingSourceDetail(source.timingDocumentHref(document.id))! }
}

test('completed late work and unfinished overdue work remain different in management and the actual source detail', () => {
  const { order, html: prep } = sourceDocument('late', 'prep-086')
  const unfinished = sourceDocument('late', 'aux-CUT-S-01-emb').html
  assert.match(prep, /2026-09-24 09:00/)
  assert.match(prep, /2026-09-25 09:00/)
  assert.match(prep, /已完成 · 晚1天/)
  assert.match(prep, /准备已完成（单据已关闭）/)
  assert.match(prep, /准备完成 \/ 单据关闭/)
  assert.doesNotMatch(prep, /当前逾期/)
  assert.match(unfinished, /未完成 · 已超时1天/)
  const h = management([order]); h.render('work-items')
  const rows = h.tables.get('timing-work-items')!.rows
  assert.equal(rows.find(row => row.documentId?.endsWith('prep-086')).state, '已完成 · 晚1天')
  assert.equal(rows.find(row => row.documentId?.endsWith('aux-CUT-S-01-emb')).state, '未完成 · 已超时1天')
})

test('a late reached contract is a ended node, and future unreached targets are not current debt', () => {
  const order = source.getTimingCaseByScene('reachedLate'), h = management([order]); h.render('teams')
  const bTask = h.tables.get('timing-factories')!.rows.find(row => row.factory === 'B厂')
  const first = bTask.nodes.find((node: any) => node.title.endsWith('30%回货'))
  const next = bTask.nodes.find((node: any) => node.title.endsWith('70%回货'))
  assert.equal(first.state, '已达标 · 晚12小时')
  assert.ok(first.endedAt)
  assert.match(first.quantity, /本节点已达标/)
  assert.doesNotMatch(first.quantity, /当前欠|仍差/)
  assert.match(next.state, /未达标 · 截止未到/)
  assert.match(next.quantity, /距本节点目标还差/)
  assert.doesNotMatch(next.quantity, /当前欠/)
})

test('missing allocation date or factory actual pickup keeps unknown distinct from an on-time contract', () => {
  const original = source.getTimingCaseByScene('live'), copy = structuredClone(original)
  copy.tasks[0].assigned = null; copy.tasks[0].held = null
  const h = management([copy]); const html = h.render('teams')
  const rows = h.tables.get('timing-factories')!.rows.find(row => row.id === copy.tasks[0].id).nodes
  assert.equal(rows.length, 3)
  for (const row of rows) {
    assert.match(row.state, /业务分配日期缺失；工厂实领量缺失 · 合同节点无法判定/)
    assert.equal(row.deadline, null); assert.equal(row.endedAt, null); assert.equal(row.gap, null)
    assert.doesNotMatch(row.state, /按期|截止未到|已达标/)
    assert.match(row.quantity, /节点目标量无法计算/)
  }
  assert.doesNotMatch(html, /NaN|undefined/)
})

test('source contract deadline uses allocation day as day 1 even when business date contains a clock time', () => {
  const { order, document } = sourceDocument('reachedLate', 'taskdoc-SWT-B-01-0096')
  const task = order.tasks.find(task => task.id === 'SWT-B-01-0096')!, before = task.assigned
  try {
    task.assigned = '2026-10-01 09:00'
    const html = resolveTimingSourceDetail(source.timingDocumentHref(document.id))!
    assert.match(html, /2026-10-04 23:59/)
    assert.match(html, /已达标 · 晚12小时/)
    assert.doesNotMatch(html, /2026-10-05 08:59/)
    const h = management([order]); h.render('teams')
    const node = h.tables.get('timing-factories')!.rows.find(row => row.id === task.id).nodes[0]
    assert.equal(new Date(node.deadline).toISOString(), '2026-10-04T15:59:59.999Z')
  } finally { task.assigned = before }
})

test('full warehouse quantities without last receipt time never imply an on-time result or enter the rate denominator', () => {
  const unknown = source.getTimingCaseByScene('completeUnknown'), completed = source.getTimingCaseByScene('complete'), h = management([unknown, completed])
  const html = h.render('inbound-analysis'), rows = h.tables.get('timing-inbound')!.rows
  const row = rows.find(row => row.production.key === 'completeUnknown')
  assert.equal(row.facts.complete, true)
  assert.equal(row.health, '全部已入成衣仓 · 是否按期待核实')
  assert.match(html, /按期1单 \/ 全量入仓且有最后入库时间1单/)
  assert.match(html, /数量已完成，但是否按期无法判定；排除按期率分母/)
})

test('purchase association unknown never asserts that production has not been created or begun', () => {
  const h = management([source.getTimingCaseByScene('unknown')]), html = h.render('pending-purchases')
  assert.match(html, /不表示尚未生产或未建单/)
  assert.match(html, /不计入生产单数量或完成率/)
  const sourcePage = sourceDocument('unknown', '240776').html
  assert.match(sourcePage, /关联尚未取得，是否已建单待核实/)
  assert.doesNotMatch(sourcePage, /生产单 待建单/)
})

test('sample timing is by actual handout date and remains separate from approval result', () => {
  const pending = sourceDocument('samplePending', 'factory-sample-SWT-B-01-0100').html
  assert.match(pending, /未交出 · 已过要求日期/)
  assert.match(pending, /样衣审核结果/)
  assert.match(pending, /不生成精确超时小时数/)
  assert.match(pending, /样衣是否通过不改变合同回货进度判断与要求/)
  const h = management([source.getTimingCaseByScene('sampleLate')]); h.render('work-items')
  const lateSample = h.tables.get('timing-work-items')!.rows.find(row => row.kind === '产前样衣交出' && row.state.includes('晚于要求日期'))
  assert.ok(lateSample.endedAt); assert.equal(lateSample.gap, null)
  assert.equal(lateSample.state, '已交出 · 晚于要求日期')
})

test('completed whole-order elapsed time stops at final warehouse receipt; export names quantities and states precisely', async () => {
  const c = source.getTimingCaseByScene('complete'), h = management([c]); h.render('orders')
  const table = h.tables.get('timing-orders')!, row = table.rows[0]
  assert.match(table.columns.find(col => col.key === 'firstAt')!.render(row), /下单至全量入仓/)
  assert.doesNotMatch(table.columns.find(col => col.key === 'firstAt')!.render(row), /下单至查看时点/)
  h.click('order-export')
  const csv = await h.downloads[0].text()
  assert.match(csv, /成衣仓入库量（件）/)
  assert.match(csv, /未完成超时工作数（项）/)
  assert.match(csv, /已结束但晚的计时项数（含合同节点）/)
})


test('zero actual pickup is a known zero awaiting a contract denominator, not a missing value or automatic achievement', () => {
  const copy = structuredClone(source.getTimingCaseByScene('live')); copy.tasks[0].held = 0
  const h = management([copy]); h.render('teams')
  const task = h.tables.get('timing-factories')!.rows.find(row => row.id === copy.tasks[0].id)
  for (const node of task.nodes) {
    assert.match(node.state, /工厂实领为0，节点目标尚不能计算/)
    assert.doesNotMatch(node.state, /实领量缺失|已达标/)
    assert.equal(node.endedAt, null)
  }
})


test('missing execution evidence does not imply that material has not arrived or that work is confirmed overdue', () => {
  const order = source.getTimingCaseByScene('positioning'), h = management([order]); h.render('work-items')
  const purchase = h.tables.get('timing-work-items')!.rows.find(row => row.documentId?.endsWith('mp-F01'))
  assert.equal(purchase.executionState, '执行结果待取得')
  assert.equal(purchase.state, '完成事实待取得 · 截止未到')
  assert.equal(purchase.gap, null)
  assert.match(purchase.elapsedLabel, /实际完成耗时待核实/)
  const page = sourceDocument('positioning', 'mp-F01').html
  assert.match(page, /完成事实待取得 · 截止未到/)
  assert.doesNotMatch(page, /未完成 · 截止未到/)
})
