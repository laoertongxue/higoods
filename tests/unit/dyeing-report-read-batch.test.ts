import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const path = 'src/pages/process-factory/dyeing/reports.ts'
const base = '8bd7d7f15219f2811c92cce9de8c684d0c5eb1ae'
const original = execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' })
const current = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const names = ['renderTopMetrics', 'renderNodeOverview', 'renderDurationTable', 'renderVatUtilization', 'renderCraftDyeingReportsPage']

// Execute actual parsed report functions. The domain readers are controlled
// fixtures; unchanged UI presenters and unrelated review/detail consumers are
// deterministic stubs shared by baseline and candidate. This is not browser QA.
function load(source: string, dependencies: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  assert.equal(declarations.length, names.length)
  const code = ts.transpileModule(declarations.map(node => node.getText(ast).replace(/^export /, '')).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function('dependencies', `with(dependencies){${code};return {${names.join(',')}}}`)(dependencies)
}

const escape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
function statistics(version = 1) {
  return {
    workOrderCount: 31 + version, statusCounts: { '待样衣': version, '待原料': 2, '打样中': 3, '待排缸': 4, '染色中': 5, '脱水中': 6, '烘干中': 7, '定型中': 8, '打卷中': 9, '包装中': 10, '待交出': 11, '全部交出': 12 },
    quantityGroups: ['米', '公斤', '件'].map((unit, index) => ({ unit, planned: 100.125 + index, availableInput: 20 + index, received: 30 + index, dyed: 40 + index, packed: 50 + index, availableOutput: 60 + index, handed: 70 + index, downstreamReceived: 80 + index, difference: -1.25 + index })),
    waitProcessRecordCount: 3, waitHandoverRecordCount: 4, waitWritebackHandoverCount: 5, writtenBackHandoverCount: 6, differenceHandoverCount: 7, differenceRecordCount: 8,
    waitReviewCount: 9 + version, reviewPassCount: 10, currentVatScheduleCount: 11, dyeAverageHours: 1.2, dehydrateAverageHours: 2.3, dryAverageHours: 3.4,
    setAverageHours: 4.5, packAverageHours: 5.6, handoverAverageWritebackHours: 6.7, overdueWritebackCount: 12,
  }
}

function fixture() {
  const ids = Array.from({ length: 31 }, (_, index) => index === 0 || index === 1 ? 'DUP' : index === 30 ? 'MISSING' : `DYE-${index}`)
  const reportRows = ids.map((dyeOrderId, index) => ({ dyeOrderId, dyeOrderNo: `DY<&-${index}`, taskNo: `TASK"-${index}`, currentNode: `节点${index % 3}`, waitingReason: index % 2 ? '等料<&' : '',
    startedAt: index % 3 ? '2026-10-19 08:00' : '', finishedAt: index % 4 ? '2026-10-19 10:00' : '', durationHours: index / 3, dyeVatNo: index % 2 ? 'VAT<&' : '', plannedQty: 100.25 + index, outputQty: 98.5 + index, objectionCount: index % 3 }))
  const schedules = ids.map((dyeOrderId, index) => ({ dyeOrderId, dyeVatNo: `VAT-${index}`, capacityQty: 200 + index, capacityUnit: ['米', '公斤', '件'][index % 3], supportedMaterialTypes: ['棉<&', '混纺'], plannedStartAt: '2026-10-19 08:00', actualEndAt: index % 2 ? '2026-10-19 10:00' : '', plannedEndAt: '2026-10-19 11:00', status: ['IN_USE', 'DONE', 'DELAYED', 'PLANNED'][index % 4] }))
  const regularOrders = ids.slice(2, 30).map((dyeOrderId, index) => ({ dyeOrderId, dyeOrderNo: `ORDER-${index}`, qtyUnit: ['米', '公斤', '件'][index % 3], dyeFactoryId: `FAC-${index}` }))
  const orders = [{ dyeOrderId: 'DUP', dyeOrderNo: 'FIRST-ORDER<&', qtyUnit: '米', dyeFactoryId: 'FIRST-FAC' }, ...regularOrders,
    { dyeOrderId: 'DUP', dyeOrderNo: 'LAST-ORDER', qtyUnit: '公斤', dyeFactoryId: 'LAST-FAC' }]
  const formulas: { dyeOrderId: string | undefined; colorNo: string }[] = [{ dyeOrderId: 'DUP', colorNo: 'FIRST-COLOR<&' }, ...regularOrders.map((order, index) => ({ dyeOrderId: order.dyeOrderId, colorNo: `COLOR-${index}` })), { dyeOrderId: 'DUP', colorNo: 'LAST-COLOR' }]
  const facts = orders.map((order, index) => ({ order, difference: index + 0.125 }))
  return { reportRows, schedules, orders, formulas, facts }
}

function harness(source = current, data = fixture()) {
  const state = { phase: 'public', statisticsVersion: 1, fail: '', trace: [] as string[], counts: {} as Record<string, number> }
  const record = (name: string) => { state.trace.push(name);state.counts[name] = (state.counts[name] || 0) + 1;if (state.fail === name) throw Error(`read failed: ${name}`) }
  const dependencies = {
    escapeHtml: escape, TEST_FACTORY_ID: 'TEST-FAC',
    getDyeingExecutionStatistics: () => { record('statistics');return statistics(state.statisticsVersion) },
    getDyeingQuantityFacts: () => { record('quantities');return data.facts },
    listDyeReportRows: () => { record('reports');state.phase = 'duration';return data.reportRows },
    listDyeVatSchedules: () => { record('schedules');state.phase = 'vat';return data.schedules },
    listDyeWorkOrders: () => {
      record(`orders:${state.phase}`)
      // The first public read is deliberately stale for table quantities and vat
      // lookup fields. Neither table may reuse it instead of its original lookup.
      return state.phase === 'public' ? [{ ...data.orders[0], qtyUnit: 'PUBLIC-OLD', dyeOrderNo: 'PUBLIC-OLD', dyeFactoryId: 'PUBLIC-OLD' }]
        : state.phase === 'vat' ? data.orders.map(order => ({ ...order, dyeOrderNo: `VAT-${order.dyeOrderNo}` })) : data.orders
    },
    listDyeFormulaRecords: () => { record('formulas');return data.formulas },
    formatDyeQty: (value: number, unit: string | undefined) => `${value.toFixed(3)} ${unit ?? 'DEFAULT'}`,
    renderSection: (title: string, html: string) => `<section data-title="${escape(title)}">${html}</section>`,
    renderMetricCard: (title: string, value: string, note: string) => `<article>${escape(title)}|${escape(value)}|${escape(note)}</article>`,
    renderPageHeader: (title: string, note: string) => { record('header');return `<header>${escape(title)}|${escape(note)}</header>` },
    renderActionButton: (options: unknown) => `<button>${escape(JSON.stringify(options))}</button>`,
    buildCapacityProfileLink: (id: string) => `/capacity/${id}`,
    getSelectedDyeOrderId: (id: string) => { record('selected');return id },
    renderReviewTable: (id: string) => `<review selected="${escape(id)}"/>`,
    renderSelectedDetail: (id: string) => `<detail selected="${escape(id)}"/>`,
  }
  return { state, data, api: load(source, dependencies) }
}

function compareTable(name: 'renderDurationTable' | 'renderVatUtilization') {
  const before = harness(original), after = harness()
  const left = before.api[name](), right = after.api[name]()
  assert.equal(right, left, 'complete actual function HTML equals the released baseline')
  assert.equal((right.match(/<tr class=/g) || []).length, 31)
  return { before, after, html: right as string }
}

test('duration keeps all31rows/mixed units/missing and duplicate IDs byte equal, with one later order read', () => {
  const { before, after, html } = compareTable('renderDurationTable')
  assert.equal(before.state.counts['orders:duration'], 31)
  assert.equal(after.state.counts['orders:duration'], 1)
  assert.deepEqual(after.state.trace.slice(0, 3), ['quantities', 'reports', 'orders:duration'])
  assert.ok(html.includes('100.250 米') && html.includes('130.250 DEFAULT'))
  assert.ok(html.includes(`${(after.data.facts.at(-1)!.difference).toFixed(3)} 米`), 'quantity Map keeps its existing last-value semantics while order find keeps first match')
})

test('vat keeps all31rows and original first order/formula match with one read of each after schedules', () => {
  const { before, after, html } = compareTable('renderVatUtilization')
  assert.equal(before.state.counts['orders:vat'], 31)
  assert.equal(before.state.counts.formulas, 31)
  assert.equal(after.state.counts['orders:vat'], 1)
  assert.equal(after.state.counts.formulas, 1)
  assert.deepEqual(after.state.trace, ['schedules', 'orders:vat', 'formulas'])
  assert.ok(html.includes('VAT-FIRST-ORDER&lt;&amp;') && html.includes('FIRST-COLOR&lt;&amp;') && html.includes('FIRST-FAC'))
  assert.ok(!html.includes('LAST-ORDER') && !html.includes('LAST-COLOR') && !html.includes('LAST-FAC'))
  assert.ok(html.includes('暂无数据') && html.includes('TEST-FAC'))
})

test('unassociated formulas preserve the original find semantics and all31 linked rows with duplicate IDs', () => {
  const data = fixture()
  data.formulas.unshift({ dyeOrderId: undefined, colorNo: 'UNASSOCIATED-FIRST' })
  data.formulas.splice(3, 0, { dyeOrderId: undefined, colorNo: 'UNASSOCIATED-SECOND' })
  const before = harness(original, data), after = harness(current, data)
  const baselineHtml = before.api.renderVatUtilization(), candidateHtml = after.api.renderVatUtilization()
  assert.equal(candidateHtml, baselineHtml, 'complete actual31row HTML matches the released find implementation')
  assert.equal((candidateHtml.match(/<tr class=/g) || []).length, 31)
  assert.ok(candidateHtml.includes('FIRST-COLOR&lt;&amp;'))
  assert.ok(!candidateHtml.includes('UNASSOCIATED') && !candidateHtml.includes('LAST-COLOR'))
  assert.equal(before.state.counts.formulas, 31)
  assert.equal(after.state.counts.formulas, 1)
})

test('the actual public report render shares one local statistics snapshot and keeps later table read boundaries', () => {
  const before = harness(original), after = harness()
  assert.equal(after.api.renderCraftDyeingReportsPage(), before.api.renderCraftDyeingReportsPage())
  assert.equal(before.state.counts.statistics, 2)
  assert.equal(after.state.counts.statistics, 1)
  assert.deepEqual(after.state.trace.slice(0, 4), ['orders:public', 'selected', 'header', 'statistics'])
  assert.equal(after.state.counts['orders:public'], 1)
  assert.equal(after.state.counts['orders:duration'], 1)
  assert.equal(after.state.counts['orders:vat'], 1)
  assert.equal(after.state.counts.formulas, 1)
})

test('empty duration and vat lists preserve complete baseline HTML and do not read orders or formulas', () => {
  for (const name of ['renderDurationTable', 'renderVatUtilization'] as const) {
    const data = fixture();data.reportRows = [];data.schedules = []
    const before = harness(original, data), after = harness(current, data)
    assert.equal(after.api[name](), before.api[name]())
    assert.deepEqual(after.state.trace, name === 'renderDurationTable' ? ['quantities', 'reports'] : ['schedules'])
  }
})

test('duration source failures keep quantities then reports then first lookup order and propagate without fallback', () => {
  for (const failure of ['quantities', 'reports', 'orders:duration']) {
    const before = harness(original), after = harness()
    before.state.fail = failure;after.state.fail = failure
    assert.throws(() => before.api.renderDurationTable(), new RegExp(`read failed: ${failure}`))
    assert.throws(() => after.api.renderDurationTable(), new RegExp(`read failed: ${failure}`))
    assert.deepEqual(after.state.trace, before.state.trace)
  }
  const retry = harness();retry.state.fail = 'orders:duration'
  assert.throws(() => retry.api.renderDurationTable(), /read failed: orders:duration/)
  retry.state.fail = '';retry.data.orders[0].qtyUnit = '新单位'
  assert.ok(retry.api.renderDurationTable().includes('100.250 新单位'))
})

test('vat source failures preserve schedules/orders/formulas order; later invocation reads changed sources', () => {
  for (const failure of ['schedules', 'orders:vat', 'formulas']) {
    const before = harness(original), after = harness()
    before.state.fail = failure;after.state.fail = failure
    assert.throws(() => before.api.renderVatUtilization(), new RegExp(`read failed: ${failure}`))
    assert.throws(() => after.api.renderVatUtilization(), new RegExp(`read failed: ${failure}`))
    assert.deepEqual(after.state.trace, before.state.trace)
  }
  const retry = harness();retry.state.fail = 'formulas'
  assert.throws(() => retry.api.renderVatUtilization(), /read failed: formulas/)
  retry.state.fail = '';retry.data.formulas[0].colorNo = '新色号'
  assert.ok(retry.api.renderVatUtilization().includes('新色号'))
})

test('a later actual public render reads a new statistics value; failed statistics propagate and retry fresh', () => {
  const run = harness()
  const first = run.api.renderCraftDyeingReportsPage()
  assert.equal(run.state.counts.statistics, 1)
  run.state.phase = 'public';run.state.statisticsVersion = 2
  const second = run.api.renderCraftDyeingReportsPage()
  assert.equal(run.state.counts.statistics, 2)
  assert.notEqual(second, first)
  assert.ok(first.includes('染色加工单总数|32|') && second.includes('染色加工单总数|33|'))
  run.state.phase = 'public';run.state.fail = 'statistics'
  assert.throws(() => run.api.renderCraftDyeingReportsPage(), /read failed: statistics/)
  run.state.phase = 'public';run.state.fail = '';run.state.statisticsVersion = 3
  assert.ok(run.api.renderCraftDyeingReportsPage().includes('染色加工单总数|34|'))
  assert.equal(run.state.counts.statistics, 4)
})

test('unrelated source functions, imports and module state stay identical to the released baseline', () => {
  function untouched(source: string) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    return ast.statements.filter(node => !ts.isFunctionDeclaration(node) || !names.includes(node.name?.text || '')).map(node => node.getText(ast))
  }
  assert.deepEqual(untouched(current), untouched(original))
})
