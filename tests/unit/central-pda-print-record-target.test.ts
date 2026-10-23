import assert from 'node:assert/strict'
import test from 'node:test'
import { printingCommandOrders, isPrintingRecordTarget } from '../../src/data/fcs/printing-records.ts'
import { getPrintWorkOrderById, listPrintingWorkOrders, listPrintingDispatchDocuments } from '../../src/data/fcs/printing-task-domain.ts'
test('printing resolves actual orders, tasks and each existing dispatch participant',()=>{
 const orders=listPrintingWorkOrders(),o=orders.find(o=>o.workOrderId==='PWO-PRINT-001')!,raw=getPrintWorkOrderById(o.workOrderId)!
 assert.deepEqual(printingCommandOrders([o.workOrderId,{taskId:raw.taskId}]),[o.workOrderId])
 for(const d of listPrintingDispatchDocuments())assert.deepEqual(printingCommandOrders(d.id),[...new Set(d.lines.map(l=>l.workOrderId))].sort())
})
test('printing does not adopt factory, SKU, remark or a prefix without an actual order',()=>{
 for(const value of ['PWO-FOREIGN','PRINT-FOREIGN','SJ-FOREIGN','F090','FAB-P200-WHITE','DYE-DISPATCH-DEMO-3'])assert.equal(isPrintingRecordTarget({reference:value}),false,value)
})
