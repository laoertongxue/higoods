import assert from 'node:assert/strict'
import { resetPrintingWorkOrderBusinessStore, getPrintingWorkOrderById, createPrintingDispatch, listPrintingDispatchDocuments, confirmPrintingDispatch, voidPrintingDispatch, copyPrintingRollBarcode, deletePrintingRollBarcodes, importPrintingRollLengths, markPrintingRollBarcodesPrinted, handoverPrintingOutput } from '../src/data/fcs/printing-task-domain.ts'
resetPrintingWorkOrderBusinessStore()
const id='PWO-PRINT-005'
const order=()=>getPrintingWorkOrderById(id)!
const rolls=order().barcodes
const first=rolls[0],second=rolls[1]
const before=order().handover.handedOverQty
const doc=createPrintingDispatch([{workOrderId:id,barcodeIds:[first.id]}],'测试建单员')
assert.equal(order().handover.handedOverQty,before,'建草稿不产生交出事实')
assert.throws(()=>createPrintingDispatch([{workOrderId:id,barcodeIds:[first.id]}],'测试'),/重复/)
assert.throws(()=>deletePrintingRollBarcodes(id,[first.id]),/草稿/)
assert.throws(()=>createPrintingDispatch([{workOrderId:'PWO-PRINT-006',barcodeIds:[getPrintingWorkOrderById('PWO-PRINT-006')!.barcodes[0].id]}],'测试',doc),/同加工厂/)
assert.equal(listPrintingDispatchDocuments().find(d=>d.id===doc)!.lines[0].barcodeIds.length,1,'合单失败不部分写入')
createPrintingDispatch([{workOrderId:id,barcodeIds:[second.id]}],'测试',doc)
assert.equal(listPrintingDispatchDocuments().find(d=>d.id===doc)!.lines[0].barcodeIds.length,2)
confirmPrintingDispatch(doc,'测试交出员')
assert.equal(order().handover.handedOverQty,Number((first.lengthY+second.lengthY).toFixed(2)))
assert.equal(order().handover.receivedQty,0,'确认交出不能冒充下游接收')
assert.throws(()=>confirmPrintingDispatch(doc,'测试'),/草稿/)
assert.throws(()=>voidPrintingDispatch(doc,'测试'),/草稿/)
markPrintingRollBarcodesPrinted(id,[first.id],'测试补打')
assert.equal(order().barcodes.find(r=>r.id===first.id)!.status,'已交出','补打不得倒退交出状态')
assert.throws(()=>deletePrintingRollBarcodes(id,[first.id]),/已交出/)
const draft=copyPrintingRollBarcode(id,first.id)
assert.equal(draft.lengthY,0);assert.equal(draft.status,'草稿');assert.equal(draft.handoverRecordId,undefined)
assert.throws(()=>markPrintingRollBarcodesPrinted(id,[draft.id],'测试'),/草稿/)
const snapshot=JSON.stringify(order().barcodes)
assert.throws(()=>importPrintingRollLengths(id,`${draft.rollNo},1\n不存在,20`),/不存在/)
assert.equal(JSON.stringify(order().barcodes),snapshot)
assert.throws(()=>importPrintingRollLengths(id,`${draft.rollNo},99999`),/超过/)
deletePrintingRollBarcodes(id,[draft.id])
const replacement=copyPrintingRollBarcode(id,first.id)
assert.notEqual(replacement.id,draft.id,'删除卷号不复用')
assert.equal(importPrintingRollLengths(id,`${replacement.rollNo},0.02`),1)
assert.equal(order().barcodes.find(roll=>roll.id===replacement.id)!.lengthY,0.02)
const release=createPrintingDispatch([{workOrderId:id,barcodeIds:[rolls[2].id]}],'测试')
voidPrintingDispatch(release,'测试')
assert.equal(listPrintingDispatchDocuments().find(doc=>doc.id===release)!.lines[0].rolls![0].lengthY,rolls[2].lengthY,'作废单保留原卷快照')
const again=createPrintingDispatch([{workOrderId:id,barcodeIds:[rolls[2].id]}],'测试')
assert.notEqual(release,again)
console.log('PASS 草稿占用、合入、跨单位阻断、失败无写入、确认交出、接收独立、重复确认防错、已交出保护、补打不退状态、复制草稿、导入原子校验、卷号不复用、作废释放')

// 两张加工单、同厂同接收仓的独立测试夹具；不改页面 Mock。
const {capturePrintProcessMutationState,restorePrintProcessMutationState}=await import('../src/data/fcs/printing-task-domain.ts')
resetPrintingWorkOrderBusinessStore()
let state=capturePrintProcessMutationState()
const one=state.workOrders.find(([key])=>key==='PWO-PRINT-005')![1]
const two=state.workOrders.find(([key])=>key==='PWO-PRINT-004')![1]
two.receiverName=one.receiverName;two.targetTransferWarehouseId=one.targetTransferWarehouseId;two.targetTransferWarehouseName=one.targetTransferWarehouseName
const secondView=two.businessView!
secondView.historicalInputQuantityUnknown=false;secondView.historicalRollQuantitiesUnknown=false;secondView.actualInput.receivedQty=10;secondView.actualInput.usedQty=0;secondView.actualInput.usedRollCount=0;secondView.actualInput.receivedRollCount=1;secondView.output.completedQty=0;secondView.output.completedRollCount=0;secondView.barcodes=secondView.barcodes.slice(0,1);secondView.barcodes[0].lengthY=0
restorePrintProcessMutationState(state)
const {completePrintingWorkOrder}=await import('../src/data/fcs/printing-task-domain.ts')
completePrintingWorkOrder(two.printOrderId,{usedQty:10,usedRollCount:1,completedQty:10,completedRollCount:1,printerNo:'测试',operatorName:'测试'})
const batch=createPrintingDispatch([{workOrderId:one.printOrderId,barcodeIds:[one.businessView!.barcodes[0].id]},{workOrderId:two.printOrderId,barcodeIds:[getPrintingWorkOrderById(two.printOrderId)!.barcodes[0].id]}],'批量测试')
assert.equal(listPrintingDispatchDocuments().find(doc=>doc.id===batch)!.lines.length,2)
confirmPrintingDispatch(batch,'批量测试')
assert.equal(getPrintingWorkOrderById(two.printOrderId)!.handover.handedOverQty,10)
assert.equal(getPrintingWorkOrderById(one.printOrderId)!.handover.handedOverQty,one.businessView!.barcodes[0].lengthY)
console.log('PASS 多加工单合并与分别回写原交出事实')
