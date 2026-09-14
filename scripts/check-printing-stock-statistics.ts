import assert from 'node:assert/strict'
// Reuse one complete business fixture; assert additional warehouse and date projections below.
await import('./check-printing-factory-alignment.ts')
import { getPrintingWarehouseView } from '../src/data/fcs/printing-warehouse-view.ts'
import { getPrintingWorkOrderById, listPrintingWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { summarizePrintingStatistics, printingBusinessDate, printingEventTimestamp, normalizePrintingUnit, printingCurrentAction, printingOrderIsOverdue, printingCompletionTrend, filterPrintingStatisticsOrders } from '../src/data/fcs/printing-statistics.ts'
import { renderCraftPrintingStatisticsPage } from '../src/pages/process-factory/printing/statistics.ts'
import { renderCraftPrintingDashboardsPage } from '../src/pages/process-factory/printing/dashboards.ts'
import { renderCraftPrintingWaitProcessWarehousePage, renderCraftPrintingWaitHandoverWarehousePage } from '../src/pages/process-factory/printing/warehouse.ts'
const view=getPrintingWarehouseView(),order=getPrintingWorkOrderById('PWO-PRINT-001')!
const stock=view.waitProcessItems.find(i=>i.receiptLineId==='CHECK-STOCK-L1')!
assert.equal(stock.originalReceivedQty,50)
assert.equal(stock.receivedQty,50,'备料不扣实物')
assert.equal(stock.preparedQty,20)
assert.equal(stock.freeQty,30)
assert.equal(view.inboundRecords.filter(i=>i.inboundRecordNo==='CHECK-STOCK').length,1,'关联不能复制入库明细')
assert.equal(view.waitProcessItems.filter(i=>i.workOrderIds.includes(order.workOrderId)).length,0,'实际用料100后原料在仓0')
assert.equal(view.usageRecords.filter(u=>u.workOrderId===order.workOrderId).reduce((n,u)=>n+u.qty,0),100)
assert.equal(view.waitHandoverItems.filter(i=>i.workOrderIds.includes(order.workOrderId)).reduce((n,i)=>n+i.waitHandoverQty,0),33,'实际交出65且下游实收64后本厂余33')
assert.equal(view.waitHandoverItems.filter(i=>i.workOrderIds.includes(order.workOrderId)).reduce((n,i)=>n+i.reservedQty,0),0,'作废释放占用')
assert.equal(view.outputInboundItems.filter(i=>i.workOrderIds.includes(order.workOrderId)).reduce((n,i)=>n+i.completedQty,0),98)
assert(view.usageRecords.every(r=>Boolean(r.at&&r.operatorName)))
assert(view.waitHandoverItems.every(i=>i.flows.every(f=>!f.operatedAt.startsWith('SJ-'))),'时间不能冒用单号')
assert.equal(normalizePrintingUnit('公斤'),'kg');assert.equal(normalizePrintingUnit('m'),'米');assert.equal(normalizePrintingUnit('yard'),'Yard')
assert.equal(printingBusinessDate(new Date('2026-09-13T16:59:59Z')),'2026-09-13')
assert.equal(printingBusinessDate(new Date('2026-09-13T17:00:00Z')),'2026-09-14')
assert.equal(printingEventTimestamp('2026-09-14 00:00:00'),Date.parse('2026-09-13T17:00:00Z'))
assert.equal(printingEventTimestamp('2026-02-30 00:00:00'),undefined)
const clone=structuredClone(order);clone.productionBatches=[{...order.productionBatches![0],id:'BEFORE',at:'2026-09-13T16:59:59Z',qty:3,lossQty:0},{...order.productionBatches![0],id:'TODAY',at:'2026-09-13T17:00:00Z',qty:4,lossQty:0}]
const summary=summarizePrintingStatistics([clone],new Date('2026-09-14T03:00:00Z'))
assert.equal(summary.byUnit.Yard.todayCompleted,4,'按业务日期汇总真实批次增量，不整单重算98')
assert.equal(summary.byUnit.Yard.completed,98,'印制100和转印98不能再累加')
assert.equal(summary.byUnit.Yard.localReceived,100)
assert.equal(summary.byUnit.Yard.downstreamReceived,64)
assert.equal(summary.byUnit.Yard.downstreamPending,1)
assert.equal(printingCompletionTrend([clone],new Date('2026-09-14T03:00:00Z')).length,2)
const unknown=structuredClone(order);unknown.historicalInputQuantityUnknown=true;unknown.productionBatches=[];unknown.plannedFinishAt=undefined
const unknownSummary=summarizePrintingStatistics([unknown])
assert.equal(unknownSummary.unknownReceiptCount,1);assert.equal(unknownSummary.unknownCompletionHistoryCount,1);assert.equal(unknownSummary.noDueDateCount,1)
assert.equal(printingOrderIsOverdue(unknown),false)
const legacyPending=listPrintingWorkOrders().find(o=>o.pendingWritebackQty>0&&o.workOrderId!==order.workOrderId)
if(legacyPending){const action=printingCurrentAction(legacyPending);assert.equal(action?.label,'核对历史交接');assert(action?.route.endsWith(legacyPending.workOrderId),'历史交接不导向空白新单据列表')}
const closed=structuredClone(order);closed.manuallyCompletedAt='2026-09-14 10:00:00';assert.equal(printingCurrentAction(closed),undefined)
assert.equal(filterPrintingStatisticsOrders(listPrintingWorkOrders(),{factoryId:order.printFactoryId}).every(o=>o.printFactoryId===order.printFactoryId),true)
for(const render of [renderCraftPrintingStatisticsPage,renderCraftPrintingWaitProcessWarehousePage,renderCraftPrintingWaitHandoverWarehousePage]){const html=render();assert(html.includes('data-standard-list-page'));assert(html.includes('列设置'));assert(!html.includes('按库存推演'))}
const dashboard=renderCraftPrintingDashboardsPage();assert(dashboard.includes('业务日期'));assert(dashboard.includes('data-printing-dashboard-action'))
console.log('PASS printing stock/statistics: receipt-line uniqueness, allocation vs physical, actual use100, output98/out65/remaining33, valid flows, zero vs missing, Jakarta midnight, batch increments, pending quantity, paginated surfaces')
