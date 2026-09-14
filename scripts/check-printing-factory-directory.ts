import assert from 'node:assert/strict'
import { PRINTING_FACTORIES, listPrintingFactoryOptions } from '../src/data/fcs/printing-factories.ts'
import { listPrintingWorkOrders, assignPrintingWorkOrder, getPrintingWorkOrderById } from '../src/data/fcs/printing-task-domain.ts'
import { printingReceivingFactoryOptions } from '../src/data/fcs/printing-material-receipts.ts'
import { ensureProcessWorkOrders } from '../src/data/fcs/process-work-order-generation-service.ts'
import { renderCraftPrintingWorkOrdersPage } from '../src/pages/process-factory/printing/work-orders.ts'
import { renderPrintingPendingHandoverPage, renderPrintingHandoverDocumentsPage } from '../src/pages/process-factory/printing/dispatch.ts'
import { renderCraftPrintingStatisticsPage } from '../src/pages/process-factory/printing/statistics.ts'
import { renderCraftPrintingDashboardsPage } from '../src/pages/process-factory/printing/dashboards.ts'
import { renderCraftPrintingWaitProcessWarehousePage, renderCraftPrintingWaitHandoverWarehousePage } from '../src/pages/process-factory/printing/warehouse.ts'
import { openPrintingDialog, renderPrintingDialog, closePrintingDialog } from '../src/pages/process-factory/printing/dialogs.ts'

const names = ['FLOWER','ANJANI','BAGUS','Clint','DANIS','Irijaya printing','MIDDAY 89','TEETWO KONVEKSI','goto_global','sipatax','测试专用工厂']
assert.deepEqual(PRINTING_FACTORIES.map(factory => factory.name), names)
assert.equal(new Set(PRINTING_FACTORIES.map(factory => factory.id)).size, names.length)
const before = listPrintingWorkOrders()
assert.equal(listPrintingFactoryOptions(before).filter(factory => factory.id === 'F090').length, 1, 'test factory alias uses one organization ID')
const receipts = printingReceivingFactoryOptions()
for (const factory of PRINTING_FACTORIES) assert.ok(receipts.some(option => option.factoryId === factory.id && option.label.startsWith(factory.name)))
for (const render of [renderCraftPrintingWorkOrdersPage,renderPrintingPendingHandoverPage,renderPrintingHandoverDocumentsPage,renderCraftPrintingStatisticsPage,renderCraftPrintingDashboardsPage,renderCraftPrintingWaitProcessWarehousePage,renderCraftPrintingWaitHandoverWarehousePage]) {
  const html = render()
  for (const name of names) assert.ok(html.includes(name), `${render.name}: ${name} remains available even without orders/stock`)
}
assert.deepEqual(listPrintingWorkOrders(), before, 'directory rendering must preserve all existing assignments and quantities')

const base = before[0]!
const generated = ensureProcessWorkOrders({ processCodes: ['PRINT'], orderedAt: '2026-09-14 08:00:00', source: {sourceType:'STOCK',stockMaterialId:'PRINT-DIRECTORY-CHECK',stockMaterialName:base.plannedInput.materialName},materialId:base.plannedInput.sku,materialName:base.plannedInput.materialName,materialItems:[{materialId:base.plannedInput.sku,materialName:base.plannedInput.materialName,materialType:'面料'}],targetColor:'本白',plannedQty:20,qtyUnit:'Yard',printProcessName:'数码印花',requiredDeliveryDate:'2026-09-30' })
const id = generated.printWorkOrderId!
assert.ok(id)
openPrintingDialog({ type:'assign',workOrderId:id })
const dialog = renderPrintingDialog()
for (const name of names) assert.ok(dialog.includes(name))
assert.ok(!dialog.includes('data-printing-dialog-field="factoryName"'), 'no independent editable factory name')
closePrintingDialog()
assert.throws(() => assignPrintingWorkOrder(id,{factoryId:'missing-factory',factoryName:'FLOWER',operatorName:'检查员'}), /请选择/)
assignPrintingWorkOrder(id,{factoryId:'FAC-FLOWER',factoryName:'错误输入名称',operatorName:'检查员'})
assert.equal(getPrintingWorkOrderById(id)!.printFactoryName, 'FLOWER', 'assignment resolves name by selected ID')
assert.equal(getPrintingWorkOrderById(id)!.actualInput.receivedQty, 0, 'factory assignment does not invent receipts')
assert.throws(() => assignPrintingWorkOrder(id,{factoryId:'PRINT-FACTORY-DANIS',factoryName:'DANIS',operatorName:'检查员'}), /不能重新分配/)
console.log('PASS printing factory directory: all 11 names across 8 surfaces, zero-data visibility, unique IDs, assignment validation and original facts preserved')
