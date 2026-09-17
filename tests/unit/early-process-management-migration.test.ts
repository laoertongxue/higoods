import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ensureProductionDemandEarlyProcessAcceptanceData } from '../../src/data/fcs/production-demand-early-process-work-orders.ts'
import { listPrepProcessOrders } from '../../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { listDyeWorkOrderOnlineRows } from '../../src/data/fcs/dye-work-order-online-view.ts'
import { listPrintingWorkOrders } from '../../src/data/fcs/printing-work-order-business.ts'
import { createDyeOrderDisplayColumns, createPrintingOrderDisplayColumns } from '../../src/pages/process-work-orders/order-list-columns.ts'
import { createEarlyProcessManagementState, renderEarlyProcessMatchTabs, renderEarlyProcessCreateDialog } from '../../src/pages/process-work-orders/early-process-management.ts'

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('MIG-001/002/006: management entry and handlers belong to FCS; PFOS keeps execution', () => {
  for (const [kind, craft, name] of [['dye', 'dyeing', '染色'], ['print', 'printing', '印花']]) {
    const management = source(`src/pages/process-${kind}-orders.ts`)
    const execution = source(`src/pages/process-factory/${craft}/work-orders.ts`)
    assert.match(management, new RegExp(`新增${name}加工单`))
    assert.match(management, /handleEarlyProcessManagementEvent/)
    assert.match(management, /按备货创建/)
    assert.doesNotMatch(execution, /open-create|submit-create|cancel-early|match-tab|listEarlyProcessCreateCandidates|createProductionDemandEarlyProcessWorkOrder|state\.matchStatus/)
    assert.match(execution, /renderActions/)
    assert.match(execution, /列设置/)
  }
})

test('MIG-003/007: prep and execution read the same early order identities, quantities and match status', () => {
  ensureProductionDemandEarlyProcessAcceptanceData()
  for (const code of ['DYE', 'PRINT'] as const) {
    const rows = listPrepProcessOrders(code, { includeExecutionDetails: false })
    const execution = code === 'DYE'
      ? listDyeWorkOrderOnlineRows().map(row => ({ id: row.dyeOrderId, qty: row.plannedQty, status: row.matchStatus }))
      : listPrintingWorkOrders().map(row => ({ id: row.workOrderId, qty: row.plannedInput.plannedQty, status: row.matchStatus }))
    const earlyRows = rows.filter(row => row.sourceType === 'PRODUCTION_DEMAND')
    assert.ok(earlyRows.length >= 5)
    for (const row of earlyRows) {
      const peer = execution.find(item => item.id === row.workOrderId)
      assert.ok(peer)
      assert.equal(row.plannedFeedQty, peer.qty)
      assert.equal(row.sourceSnapshot?.matchStatus, peer.status)
      assert.equal(row.createMode, '生产需求单提前创建')
      assert.ok(row.sourceSummary.includes(row.sourceSnapshot!.productionDemandId!))
    }
    const state = createEarlyProcessManagementState()
    state.matchStatus = 'WAIT_PRODUCTION_ORDER'
    const tabs = renderEarlyProcessMatchTabs(state, rows)
    assert.equal((tabs.match(/role="tab"/g) || []).length, 6)
    assert.match(tabs, new RegExp(`待匹配生产单 <span[^>]*>${earlyRows.filter(row => row.sourceSnapshot?.matchStatus === state.matchStatus).length}</span>`))
  }
})

test('MIG-004/009: migrated dialogs retain candidate fields, actual material image and task outputs', () => {
  for (const code of ['DYE', 'PRINT'] as const) {
    const state = createEarlyProcessManagementState(); state.createOpen = true
    const html = renderEarlyProcessCreateDialog(code, state, [{ id: 'F090', name: '全能力测试工厂' }])
    for (const field of ['demand-id', 'professional-task-id', 'input-sku', 'output-sku', 'unit-consumption', 'loss-rate', 'factory', 'finish']) assert.ok(html.includes(`create-${field}`), field)
    assert.match(html, /data-pda-image-preview-url/)
    assert.match(html, /data-early-planned-qty/)
    assert.match(html, /图片加载失败/)
    assert.match(html, /下游接收方：待匹配正式生产单后确认/)
    if (code === 'DYE') assert.match(html, /data-preserve-native-click="true" data-early-process-field="create-water-soluble"/)
    else assert.match(html, /download=/)
  }
})

test('MIG-011: management and execution use the same seven business display columns', () => {
  const expected = ['加工单／商品', '加工投入／上游', '加工要求', '处理进度', '加工产出／下游', '时间', '数量']
  assert.deepEqual(createDyeOrderDisplayColumns(() => '').map(column => column.title), expected)
  const printColumns = createPrintingOrderDisplayColumns(() => '')
  assert.deepEqual(printColumns.map(column => column.title), expected)
  const printRow = listPrintingWorkOrders()[0]
  const printHtml = printColumns.map(column => column.render(printRow)).join('')
  assert.match(printHtml, /data-pda-image-preview-url/)
  assert.doesNotMatch(printHtml, /data-printing-action="preview-image"/)
  for (const path of ['process-dye-orders.ts', 'process-print-orders.ts', 'process-factory/dyeing/work-orders.ts', 'process-factory/printing/work-orders.ts']) assert.match(source(`src/pages/${path}`), /create(?:Dye|Printing)OrderDisplayColumns/)
})
