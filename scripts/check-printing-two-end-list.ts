import { printingInputIdentity, printingMaterialCode, renderPrintingRelations } from '../src/pages/process-factory/printing/relations.ts'
import assert from 'node:assert/strict'
import { getPrintingWorkOrderSummary, listPrintingWorkOrders } from '../src/data/fcs/printing-work-order-business.ts'
import { renderCraftPrintingWorkOrdersPage } from '../src/pages/process-factory/printing/work-orders.ts'
import { renderCraftPrintingWorkOrderDetailPage } from '../src/pages/process-factory/printing/work-order-detail.ts'
const rows = listPrintingWorkOrders()
const html = renderCraftPrintingWorkOrdersPage()
const headers = [...html.matchAll(/<th\b[\s\S]*?<\/th>/g)].map(x=>x[0])
assert.equal(headers.length, 8)
for (const label of ['加工单／商品','加工投入／上游','加工要求','处理进度','加工产出／下游','工厂／交期','操作']) assert(headers.some(x=>x.includes(label)),label)
assert(!headers.some(x=>x.includes('数量进度')))
assert(html.includes('全选本页') && html.includes('全选筛选结果'))
assert(html.includes('data-process-filter-toggle'))
assert(!html.includes('更多筛选 · 0 项'))
assert(headers[0].includes('全选本页') && headers[0].includes('全选筛选结果'))
assert(!html.includes('SPU：'))
const unknown=rows.filter(x=>x.historicalInputQuantityUnknown)
assert.equal(getPrintingWorkOrderSummary(rows).unknownInputCount,unknown.length)
const mixed=structuredClone(rows[0]);mixed.plannedInput.qtyUnit='米';mixed.output.qtyUnit='公斤';mixed.actualInput.receivedQty=123;mixed.historicalInputQuantityUnknown=false;mixed.output.completedQty=45
const sum=getPrintingWorkOrderSummary([mixed]);assert.equal(sum.byUnit.find(x=>x.qtyUnit==='米')?.receivedInputQty,123);assert.equal(sum.byUnit.find(x=>x.qtyUnit==='公斤')?.completedOutputQty,45);assert.equal(sum.byUnit.find(x=>x.qtyUnit==='米')?.completedOutputQty,0)
for (const row of rows.filter(x=>x.output.completedQty>0 && x.actualInput.receivedQty<x.plannedInput.plannedQty && !x.manuallyCompletedAt)) assert.equal(row.processingStatus,'PROCESSING','部分批次不能冒充整单加工完成')
const detail=renderCraftPrintingWorkOrderDetailPage(rows[0].workOrderId)
assert(detail.includes('交接记录') && detail.includes('加工投入／上游') && detail.includes('加工产出／下游'))
console.log('PASS 印花七个业务列及选择列、选择范围、更多筛选、两端单位、历史未知数量、部分批次、详情交接')

assert.equal(printingMaterialCode('主面料 / Navy 主面料'),'物料编码待完善')
const changed = structuredClone(rows[0]);changed.actualInput.actualSku='ACTUAL-UNKNOWN';changed.actualInput.receivedQty=10
assert.equal(printingInputIdentity(changed).imageUrl,'','实际SKU不同且无关联资料不能借计划图')
assert(printingInputIdentity(changed).materialName.includes('ACTUAL-UNKNOWN'))
const terminal=renderPrintingRelations(rows[0],'downstream')
assert(!terminal.includes('去向：入库'),'接收仓不能推导终端入库')
assert(html.includes('计划备货物料') && html.includes('FAB-PRINT-045'),'备货首列显示已知物料，不伪造商品')
console.log('PASS 下道不猜测、实际物料图按精确身份、中文描述不冒充编码、备货身份')
assert(!html.includes('data-image-url="/dress-sample-1.jpg" data-image-alt="TDV-DEMAND-SPU_DRESS_083 正面花型图"'), '连衣裙样衣不能冒充正式花型')
assert(detail.includes('实际加工投入') && detail.includes('计划加工投入'), '详情区分实际投入与计划投入')
