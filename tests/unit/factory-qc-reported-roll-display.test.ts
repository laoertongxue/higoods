import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { factoryQcRequirementText, qcProgress } from '../../src/data/fcs/factory-qc-model.ts'

function order(reported: number | undefined, registered = 1, checked = registered): any {
  return {
    id: 'QC-REAL-PACK', no: 'DQC-REAL-PACK', kind: 'DYEING', createdAt: '2026-10-22 10:00:00',
    source: { kind: 'DYEING', id: 'DYE-REAL-PACK', no: 'DYE-REAL-PACK', materialName: '实际面料', materialSku: 'FAB-1', imageUrl: '/fabric.jpg', factoryId: 'GTG', factoryName: 'GTG', target: { name: '中央仓' }, ...(reported === undefined ? {} : { reportedRollCount: reported }) },
    rolls: Array.from({ length: registered }, (_, index) => ({ id: 'R' + (index + 1), barcode: 'ACTUAL-CODE-' + (index + 1), batchId: 'PACK-REAL-1', qty: 20, unit: '米', photos: [], results: { color: '符合要求', handfeel: '实际偏硬', material: '符合要求' }, completedAt: index < checked ? '2026-10-22 11:00:00' : undefined })),
  }
}
function runtime(orders: any[]) {
  const path = 'src/pages/process-factory/shared/factory-qc.ts'
  const ast = ts.createSourceFile(path, readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
  const names = ['rollRegistrationText', 'columns', 'listRows', 'listContent', 'summary', 'rollRows']
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  assert.equal(declarations.length, names.length)
  const code = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const detail = { rollQuery: '', rollStatus: '', rollPage: 1, selectedRoll: '' }
  const list = { query: '', factory: '', status: '', page: 1, sort: null, preferences: { pageSize: 10 } }
  const captured = { stats: [] as Array<{ label: string; value: number }> }
  const e = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  const dependencies = {
    qcProgress, e, SOURCE_NAMES: { DYEING: '染色' }, resultNames: { color: '色差', handfeel: '实际手感', material: '面料种类' },
    listState: () => list, detailState: () => detail, listFactoryQcOrders: () => orders,
    link: (label: string, href: string) => `<a href="${href}">${e(label)}</a>`, image: (url: string) => `<img src="${url}">`, sourceRoute: () => '/source', detailRoute: (order: any) => '/qc/' + order.id,
    date: (value: string) => value || '—', name: () => '染厂QC单', route: () => '/qc',
    button: (label: string, _action: string, attrs = '') => `<button ${attrs}>${label}</button>`, inputClass: 'input', PAGE_SIZES: [10, 20, 50],
    sortStandardListRows: (rows: unknown[]) => rows, columnSettings: () => '',
    renderStandardListPage: (config: any) => config.statsHtml + config.tableHtml,
    renderStandardListStats: (stats: any) => { captured.stats = stats; return JSON.stringify(stats) },
    renderStandardListTable: (config: any) => config.rows.map((row: any) => config.columns.find((column: any) => column.key === 'progress').render(row)).join(''),
    renderTablePagination: () => '',
  }
  const api = new Function('dependencies', `with(dependencies){${code};return {${names.join(',')}}}`)(dependencies)
  return { api, detail, captured }
}

test('PACK reported16 with one completed registered roll displays1/16 and15 missing in list statistics, progress, summary and detail', () => {
  const qc = order(16), before = structuredClone(qc), h = runtime([qc])
  const list = h.api.listContent('DYEING'), summary = h.api.summary(qc), details = h.api.rollRows(qc)
  assert.equal(h.captured.stats.find(stat => stat.label === '应检卷数')?.value, 16)
  assert.equal(h.captured.stats.find(stat => stat.label === '已检卷数')?.value, 1)
  assert.match(list, /已检 1 \/ 应检 16 卷/); assert.match(list, /待补 15 卷明细/)
  assert.match(list, /href="\/qc\/QC-REAL-PACK"/)
  for (const html of [summary, details]) assert.match(html, /来源实报 16 卷，已登记 1 卷，待补 15 卷明细/)
  assert.equal((details.match(/data-roll-id=/g) || []).length, 1, 'display must not fabricate the missing15 rolls')
  assert.deepEqual(qc, before)
})

test('no reported count uses actual registered rolls and does not invent a source report', () => {
  const qc = order(undefined), h = runtime([qc])
  h.api.listContent('DYEING')
  assert.equal(h.captured.stats.find(stat => stat.label === '应检卷数')?.value, 1)
  assert.equal(h.api.summary(qc).includes('来源实报'), false)
  assert.equal(h.api.rollRows(qc).includes('来源实报'), false)
  assert.equal(h.api.rollRegistrationText(qc), '已登记 1 卷')
})

test('zero registered rolls remain explicitly waiting for detail, with and without a real reported count', () => {
  for (const reported of [undefined, 16]) {
    const qc = order(reported, 0), h = runtime([qc]), details = h.api.rollRows(qc)
    assert.match(details, /已登记 0 卷/); assert.match(details, /待补/)
    assert.equal((details.match(/data-roll-id=/g) || []).length, 0)
    if (reported === undefined) assert.equal(details.includes('来源实报'), false)
    else assert.match(details, /来源实报 16 卷，已登记 0 卷，待补 16 卷明细/)
  }
})

test('roll filtering keeps whole-order registration counts separate from the matching detail rows', () => {
  const qc = order(16), h = runtime([qc]); h.detail.rollQuery = 'NO-SUCH-ROLL'
  const details = h.api.rollRows(qc)
  assert.match(details, /来源实报 16 卷，已登记 1 卷，待补 15 卷明细/)
  assert.match(details, /卷质检详情 · 筛选结果 0 卷/)
  assert.equal((details.match(/data-roll-id=/g) || []).length, 0)
})

test('actual registered counts above the report stay visible without negative missing counts', () => {
  const qc = order(1, 2), h = runtime([qc])
  h.api.listContent('DYEING')
  assert.equal(h.captured.stats.find(stat => stat.label === '应检卷数')?.value, 2)
  assert.equal(h.api.rollRegistrationText(qc), '来源实报 1 卷，已登记 2 卷')
})


test('source requirement captions show the frozen color and real version, while keeping structured comparison signatures internal', () => {
  assert.equal(factoryQcRequirementText('["FAB-DYE-013","雾蓝",null]'), '颜色要求：雾蓝')
  assert.equal(factoryQcRequirementText('["FAB-DYE-013","雾蓝","TP-V3"]'), '颜色要求：雾蓝 · 技术包版本 TP-V3')
  assert.equal(factoryQcRequirementText('V2'), '要求版本 V2')
  assert.equal(factoryQcRequirementText('1'), '要求版本 1')
  for (const value of ['[broken', '{"internal":"comparison"}', '["another-signature","Soft"]']) assert.equal(factoryQcRequirementText(value), '按本卷来源要求核对')
  assert.equal(factoryQcRequirementText(''), '来源要求待补充')
})
