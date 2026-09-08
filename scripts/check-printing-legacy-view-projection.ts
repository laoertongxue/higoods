import assert from 'node:assert/strict'
import {listPrintWorkOrders,listPrintingWorkOrders,getPrintingWorkOrderById,getPrintReviewRecordByOrderId,getPrintOrderHandoverRecords,listPrintExecutionNodeRecords,recordPrintingHistoricalInput,completePrintingWorkOrder} from '../src/data/fcs/printing-task-domain.ts'
import {renderCraftPrintingWorkOrderDetailPage} from '../src/pages/process-factory/printing/work-order-detail.ts'
// CLEAN-002 / EXEC-004：原12单全部进入当前读取；补录不伪造上游物理交接。
assert.deepEqual(listPrintingWorkOrders().map(x=>x.workOrderId).sort(),listPrintWorkOrders().map(x=>x.printOrderId).sort())
const expected=[['PWO-PRINT-007',468,468,462],['PWO-PRINT-009',620,0,0],['PWO-PRINT-010',742,742,708]] as const
for(const [id,completed,handed,received] of expected){const v=getPrintingWorkOrderById(id)!;assert.equal(v.output.completedQty,completed);assert.equal(v.handover.handedOverQty,handed);assert.equal(v.handover.receivedQty,received);assert.equal(v.historicalInputQuantityUnknown,true);assert.equal(v.processingStatus,'PROCESSING');assert.equal(v.manuallyCompletedAt,undefined);assert.equal(v.barcodes.length,0);assert(renderCraftPrintingWorkOrderDetailPage(id).includes('历史未记录'));}
const id='PWO-PRINT-007';const facts=()=>({nodes:listPrintExecutionNodeRecords(id),review:getPrintReviewRecordByOrderId(id),handovers:getPrintOrderHandoverRecords(id)});const original=facts();
assert.throws(()=>recordPrintingHistoricalInput(id,{receivedQty:500,receivedRollCount:5,reason:'',operatorName:'验收主管'}),/原因/)
assert.throws(()=>recordPrintingHistoricalInput(id,{receivedQty:481,receivedRollCount:5,reason:'核对旧纸单',operatorName:'验收主管'}),/不能小于/)
assert.throws(()=>completePrintingWorkOrder(id,{usedQty:482,usedRollCount:4,completedQty:468,completedRollCount:4,printerNo:'PR01',operatorName:'验收员'}),/历史投入/)
for (const historicalCompletedRollCount of [undefined,-1,0,1.5]) assert.throws(()=>recordPrintingHistoricalInput(id,{receivedQty:500,receivedRollCount:5,historicalCompletedRollCount,reason:'核对纸单',operatorName:'主管'}),/历史完成卷数/)
assert.deepEqual(facts(),original,'所有失败尝试不能改原节点与交接')
recordPrintingHistoricalInput(id,{receivedQty:500,receivedRollCount:5,historicalCompletedRollCount:4,reason:'主管核对原纸质收料单，累计500米',operatorName:'验收主管'})
const after=getPrintingWorkOrderById(id)!;assert.equal(after.output.completedRollCount,4);assert.equal(after.historicalRollQuantitiesUnknown,false);assert.equal(after.barcodes.length,0);assert.equal(after.actualInput.receivedQty,500);assert.equal(after.historicalInputQuantityUnknown,false);assert.equal(after.actualInput.receivedAt,undefined);assert.equal(after.output.completedQty,468);assert.equal(after.handover.receivedQty,462);assert(after.operationLogs[0].remark.includes('不代表当次上游实物交接'));assert.deepEqual(facts(),original,'历史补录不改原node/review/HO记录')
assert.throws(()=>recordPrintingHistoricalInput(id,{receivedQty:600,receivedRollCount:6,reason:'重复补录',operatorName:'验收主管'}),/无需补录/)
console.log('PASS: 12原域ID均可读；007 468/468/462，009 620/0/0，010 742/742/708保留；未知投入不伪造0，补录原因/下界/重复门禁与旧事实不变')
