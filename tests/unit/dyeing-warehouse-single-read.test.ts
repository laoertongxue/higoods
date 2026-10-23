import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const pagePath = 'src/pages/process-factory/dyeing/warehouse.ts'
const current = readFileSync(new URL('../../' + pagePath, import.meta.url), 'utf8')
const before = current.replace(
  'const factories=view.factoryOptions.map(item=>[item.factoryId,dyeFactoryTabLabel(item.factoryId,item.factoryName)] as [string,string])',
  'const factories=new Map(getDyeingWarehouseView().waitProcessItems.concat(getDyeingWarehouseView().waitHandoverItems as never[]).map(r=>[r.factoryId,dyeFactoryTabLabel(r.factoryId,r.factoryName)]))',
)
assert.notEqual(before, current, 'reconstruct only the previous filter implementation')
function load(source: string, path: string, names: string[], dependencies: Record<string, unknown>) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  assert.equal(declarations.length, names.length)
  const code = ts.transpileModule(declarations.map(node => node.getText(ast).replace(/^export\s+/, '')).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('dependencies', `with (dependencies) { ${code};return {${names.join(',')}} }`)(dependencies)
}
const escape = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
function runtime() {
  const calls = { facts: 0, filters: [] as unknown[] }
  const rows = ['A', 'B'].map(id => ({ factoryId: id, factoryName: '工厂' + id, factoryKind: 'CENTRAL_DYE', stockItemId: 'WPS-FIN-PHYS-' + id + '-1', sourceRecordNo: 'SRC-' + id, sourceRecordId: 'DYE-' + id, taskId: 'TASK-' + id, taskNo: 'TASK-' + id, warehouseName: '待加工仓', receivedQty: 100, availableQty: 80, issuedQty: 20, unit: '米', itemKind: '面料', itemName: '面料' + id, fabricRollNo: 'ROLL-' + id, areaName: 'A区', shelfNo: '1', locationNo: '01', receiverName: '仓管', receivedAt: '2026-10-22 09:00:00', photoList: ['/fabric-' + id + '.jpg'], status: '已入待加工仓' }))
  const receipts = rows.map(row => ({ factoryId: row.factoryId, lines: [{ id: 'PHYS-' + row.factoryId, dyeOrderId: 'DYE-' + row.factoryId, material: { kind: 'FABRIC' } }] }))
  const facts = rows.map(row => ({ order: { dyeOrderId: 'DYE-' + row.factoryId, dyeOrderNo: 'DYE-' + row.factoryId, dyeFactoryId: row.factoryId, taskId: row.taskId, taskNo: row.taskNo, qtyUnit: '米', receiverName: '下游' }, factoryName: row.factoryName, kind: '面料', materialName: row.itemName, rawSku: 'RAW-' + row.factoryId, outputSku: 'OUT-' + row.factoryId, color: '本色', imageUrl: row.photoList[0], legacyReceived: 0, packed: 100, used: 100, availableOutput: 80, pendingReceiptQty: 0, hasActualDownstreamReceipt: false, hasPendingDownstreamReceipt: false, records: [], handfeelTransfers: [] }))
  const uses = rows.map(row => ({ dyeOrderId: 'DYE-' + row.factoryId, at: row.receivedAt, operatorName: '实际用料人', lines: [{ receiptLineId: 'PHYS-' + row.factoryId, barcode: row.fabricRollNo, qty: 20 }] }))
  const path = 'src/data/fcs/dyeing-warehouse-view.ts', source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
  const api = load(source, path, ['getDyeingWarehouseView'], {
    getDyeingQuantityFacts: () => { calls.facts++; return facts }, listFactoryInternalWarehouses: () => [], listFactoryReceipts: () => receipts,
    listFactoryWaitProcessStockItems: () => rows, listFactoryWarehouseInboundRecords: () => [], listFactoryMaterialUses: () => uses,
    listStenterHandfeelOutputStock: () => [{ ...rows[0], factoryId: 'GTG', factoryName: 'GTG', stockItemId: 'HF-OUTPUT', stenterHandfeelOrderId: 'HF-1', completedQty: 12.5, lossQty: 0, waitHandoverQty: 12.5 }],
    dyeFactoryTabLabel: (_id: string, name: string) => name, listFactoryWarehouseNodeRows: (id: string) => [{ factoryId: id, factoryName: '工厂' + id, warehouseName: '真实仓', areaName: 'A区', status: 'AVAILABLE' }], listFactoryWarehouseStocktakeOrders: () => [], DYE_DEMO_DETAILS: {},
  })
  return { calls, read: (filters?: unknown) => { calls.filters.push(filters); return api.getDyeingWarehouseView(filters) } }
}
const pageFunctions = ['renderFilters', 'formatQty', 'formatFactoryCell', 'materialCell', 'buildWaitProcessFlowLines', 'buildWaitHandoverFlowLines', 'renderWaitProcessRows', 'renderWaitHandoverRows', 'renderInboundRows', 'renderOutboundRows', 'renderNodeRows', 'renderUsageRows', 'renderProcessInboundRows', 'renderStocktakeRows', 'renderWarehouseTabs', 'renderMetricCard', 'renderDyeingWarehousePage']
function page(source: string, filters: unknown) {
  const view = runtime()
  const api = load(source, pagePath, pageFunctions, {
    warehouseMode: 'wait-process', warehouseFilters: filters, getDyeingWarehouseView: view.read, escapeHtml: escape,
    dyeFactoryTabLabel: (_id: string, name: string) => name,
    renderTable: (headers: string[], rows: string[][]) => `<table data-headers="${escape(JSON.stringify(headers))}">${rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('')}</table>`,
    renderStandardListStats: (metrics: unknown) => `<metrics>${JSON.stringify(metrics)}</metrics>`, renderBadge: (label: string) => `<badge>${escape(label)}</badge>`,
    renderWarehouseFlowButton: (label: string, lines: unknown) => `<flow>${escape(label)}${JSON.stringify(lines)}</flow>`, renderWarehouseLocationToolbar: (label: string) => `<toolbar>${label}</toolbar>`, renderWarehouseLocationActions: (label: string, position: string) => `<location>${label}${position}</location>`,
    buildDyeingWorkOrderDetailLink: (id: string) => '/dye/' + id, buildTaskDetailLink: (id: string) => '/task/' + id, buildHandoverOrderLink: (id: string) => '/handover/' + id, buildTaskDeliveryCardPrintLink: (id: string) => '/print/' + id, buildHandoverQrLabelPrintLink: (id: string) => '/qr/' + id,
  })
  return { ...view, render: (mode: string) => api.renderDyeingWarehousePage(mode) as string }
}

test('both actual warehouse page modes keep the complete HTML and tabs while reducing fact construction from three reads to one', () => {
  for (const mode of ['wait-process', 'wait-handover']) for (const filters of [{ timeRange: 'ALL' }, { timeRange: 'ALL', factoryId: 'A' }, { timeRange: 'ALL', keyword: 'NO-MATCH' }]) {
    const old = page(before, filters), next = page(current, filters)
    assert.equal(next.render(mode), old.render(mode), `${mode}: ${JSON.stringify(filters)}`)
    assert.equal(old.calls.facts, 3); assert.equal(next.calls.facts, 1)
    assert.deepEqual(next.calls.filters, [filters])
  }
})

test('the single filtered view carries full factory options even when all visible inventory is filtered out', () => {
  const h = runtime(), filtered = h.read({ factoryId: 'NONE', keyword: 'NO-MATCH', timeRange: 'ALL' })
  assert.deepEqual(filtered.waitProcessItems, []); assert.deepEqual(filtered.waitHandoverItems, [])
  assert.deepEqual(filtered.factoryOptions, [{ factoryId: 'A', factoryName: '工厂A' }, { factoryId: 'B', factoryName: '工厂B' }, { factoryId: 'GTG', factoryName: 'GTG' }])
  assert.equal(h.calls.facts, 1)
  const rendered = page(current, { factoryId: 'A', timeRange: 'ALL' }).render('wait-process')
  assert.ok(rendered.includes('value="A" selected')); assert.ok(rendered.includes('value="B"')); assert.ok(rendered.includes('value="GTG"'))
  assert.ok(rendered.includes('TASK-A')); assert.equal(rendered.includes('TASK-B'), false)
})
