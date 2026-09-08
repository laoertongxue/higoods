import assert from 'node:assert/strict'
import * as w from '../src/data/fcs/water-soluble-task-domain.ts'
import * as d from '../src/data/fcs/dyeing-task-domain.ts'
import * as p from '../src/data/fcs/printing-task-domain.ts'
import * as ho from '../src/data/fcs/pda-handover-events.ts'
import * as pda from '../src/data/fcs/store-domain-pda.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { ensureProcessWorkOrders } from '../src/data/fcs/process-work-order-generation-service.ts'
import { getDyeMaterialReceiptOptions, receiveDyeMaterial } from '../src/data/fcs/dyeing-material-receipts.ts'
import { getPrintingMaterialReceiptOptions, receivePrintingMaterial } from '../src/data/fcs/printing-material-receipts.ts'
const templateOrder = productionOrders.find(order => order.techPackSnapshot?.processEntries.some(entry => entry.processCode === 'WATER_SOLUBLE'))!
assert(templateOrder, '缺少可用于正式接收链验收的水溶生产单模板')
const formalProductionOrderId = 'PO-E2E-PREP-RECEIPT-001'
const formalOrder = structuredClone(templateOrder)
formalOrder.productionOrderId = formalProductionOrderId
formalOrder.productionOrderNo = formalProductionOrderId
formalOrder.demandId = 'DEM-E2E-PREP-RECEIPT-001'
formalOrder.sourceDemandIds = [formalOrder.demandId]
formalOrder.processWorkOrderDefinitions = []
formalOrder.auditLogs = []
productionOrders.push(formalOrder)
w.resetWaterSolubleDomainForChecks()
const water = w.listWaterSolubleWorkOrders().find(o => o.productionOrderId === formalProductionOrderId && o.status === 'WAIT_FACTORY_ASSIGNMENT')!
assert(water, '正式生产单未生成水溶加工单')
const production = productionOrders.find(o => o.productionOrderId === water.productionOrderId)!
const snapshot = production.techPackSnapshot!
const waterEntry = snapshot.processEntries.find(e => e.processCode === 'WATER_SOLUBLE' && e.linkedBomItemIds?.includes(water.bomItemId))!
snapshot.processEntries = snapshot.processEntries.map(e => e.id === waterEntry.id ? {...e, predecessorEntryIds: []} : e)
snapshot.processEntries.push({...waterEntry, id:'CHAIN-DYE', processCode:'DYE', processName:'染色', predecessorEntryIds:[waterEntry.id]}, {...waterEntry, id:'CHAIN-PRINT', processCode:'PRINT', processName:'数码印花', predecessorEntryIds:['CHAIN-DYE']})
function generate(code: 'DYE'|'PRINT', id: string) { return ensureProcessWorkOrders({ source:{sourceType:'PRODUCTION_ORDER',productionOrderId:water.productionOrderId,productionOrderNo:water.productionOrderNo,techPackVersionId:water.techPackVersionId,techPackVersionLabel:'正式链验收',processEntryId:id,bomItemId:water.bomItemId,bomItemIds:[water.bomItemId]}, processCodes:[code], orderedAt:'2026-09-07 08:00:00', materialId:water.materialCode, materialName:water.materialName, targetColor:'白色',plannedQty:10,qtyUnit:water.qtyUnit,dyeProcessName:'染色',printProcessName:'数码印花',factoryId:'F090',factoryName:'全能力测试工厂',isFirstOrder:false,dyeSampleWaitType:'NONE' }) }
const dyeId = generate('DYE','CHAIN-DYE').dyeWorkOrderId!
const printId = generate('PRINT','CHAIN-PRINT').printWorkOrderId!
assert(dyeId && printId)
p.assignPrintingWorkOrder(printId, {factoryId:"F090",factoryName:"全能力测试工厂",operatorName:"验收计划员"})
w.assignWaterSolubleFactory(water.waterOrderId,'F090')
w.markWaterSolubleMaterialReady(water.waterOrderId,{qty:10,receiptId:'WATER-INPUT-10'})
const user = pda.listFactoryPdaUsers('F090').find(u => u.status==='ACTIVE' && u.roleId==='ROLE_ADMIN')!
const actor = pda.createPdaSessionFromUser(user);pda.setPdaSession(actor)
for(const [index,qty] of [4,6].entries()) {
  console.log('batch',index,'water output')
  w.completeWaterSoluble(water.waterOrderId,index===0?4:10)
  const head = ho.ensureHandoverOrderForStartedTask(water.taskId)
  const out = ho.createFactoryHandoverRecord({handoverOrderId:head.handoverOrderId,submittedQty:qty,qtyUnit:water.qtyUnit,factorySubmittedAt:'2026-09-06 08:00:00',factorySubmittedBy:'真实交接员',scanCode:water.materialCode,actor})
  assert(getDyeMaterialReceiptOptions(dyeId).options.some(o=>o.recordId===out.recordId),'真实水溶交出必须成为明确染色前置可收来源')
  receiveDyeMaterial(dyeId,{qty,receiptId:`DYE-IN-${index}`,upstreamRecordId:out.recordId,operatorName:'染色接收员'})
  assert.equal(ho.findPdaHandoverRecord(out.recordId)?.receiverWrittenQty,qty)
  d.startDyeing(dyeId,{dyeVatNo:'VAT-CHAIN',inputQty:qty})
  d.completeDyeing(dyeId,{inputQty:qty,outputQty:qty})
  for(const node of ['DEHYDRATE','DRY','SET','ROLL','PACK'] as const){d.startDyeNode(dyeId,node);d.completeDyeNode(dyeId,node,{outputQty:qty})}
  console.log('batch',index,'dye handover')
  d.submitDyeHandover(dyeId,{handoverQty:qty,handoverAt:'2026-09-06 08:01:00'})
  const dyeOut = d.getDyeOrderHandoverRecords(dyeId).find(record => !record.receiverWrittenAt)!
  assert(getPrintingMaterialReceiptOptions(printId).options.some(o=>o.recordId===dyeOut.recordId),'真实染色交出必须成为明确印花前置来源')
  const print = p.getPrintingWorkOrderById(printId)!
  const input = {actualSku:print.plannedInput.sku,receivedQty:qty,receivedRollCount:1,receiverName:'印花接收员',receiptId:`PRINT-IN-${index}`,upstreamRecordId:dyeOut.recordId}
  const before = JSON.stringify(ho.findPdaHandoverRecord(dyeOut.recordId)); const beforeQty=print.actualInput.receivedQty
  assert.throws(()=>receivePrintingMaterial(printId,{...input,actualSku:'WRONG-SKU'}),/SKU/)
  assert.throws(()=>receivePrintingMaterial(printId,{...input,receivedQty:qty+1}),/剩余可接收/)
  assert.throws(()=>receivePrintingMaterial(printId,{...input,receivedQty:0.001}),/两位小数/)
  assert.throws(()=>ho.receivePreparationHandoverForTask(dyeOut.recordId,{receiptId:'BAD-UNIT',targetTaskOrderId:printId,qty:1,qtyUnit:'公斤',receiverName:'验收',receivedAt:'2026-09-07 09:00:00'}),/单位/)
  const savedPrint = p.capturePrintProcessMutationState()
  p.cancelPrintingWorkOrder(printId,{operatorName:'验收主管',reason:'验证取消后不可收'})
  assert.throws(()=>receivePrintingMaterial(printId,input),/状态不能接收/)
  p.restorePrintProcessMutationState(savedPrint)
  assert.equal(JSON.stringify(ho.findPdaHandoverRecord(dyeOut.recordId)),before)
  assert.equal(p.getPrintingWorkOrderById(printId)?.actualInput.receivedQty,beforeQty)
  console.log('batch',index,'print receive')
  receivePrintingMaterial(printId,input);receivePrintingMaterial(printId,input)
  assert.equal(p.getPrintingWorkOrderById(printId)?.actualInput.receivedQty,index===0?4:10)
  assert.equal(ho.findPdaHandoverRecord(dyeOut.recordId)?.receiverWrittenQty,qty)
}
assert.equal(d.getDyeOrderHandoverSummary(dyeId).submittedQty,10)
assert.equal(w.getWaterSolubleWorkOrderById(water.waterOrderId)?.receivedQty,10)
console.log(JSON.stringify({water:water.waterOrderId,dye:dyeId,print:printId,receivedByPrinting:10,batches:2,source:'原PdaHandoverRecord',duplicate:'不重复累加',failedSku:'上游与下游均不变'}))
p.completePrintingWorkOrder(printId,{usedQty:10,usedRollCount:2,completedQty:10,completedRollCount:2,printerNo:'CHAIN-PRINTER',operatorName:'验收员'})
p.handoverPrintingOutput(printId,{qty:10,barcodeIds:p.getPrintingWorkOrderById(printId)!.barcodes.map(b=>b.id),operatorName:'交接员',receiverName:'接收员'})
p.receivePrintingHandover(printId,{receivedQty:10,receiverName:'接收员'})
p.completePrintWorkOrderDocument(printId,{operatorName:'主管'})
const closedInput = p.getPrintingWorkOrderById(printId)!.actualInput
const closedSource = d.getDyeOrderHandoverRecords(dyeId)[0]
const closedSourceBefore = JSON.stringify(ho.findPdaHandoverRecord(closedSource.recordId))
assert.throws(()=>receivePrintingMaterial(printId,{actualSku:p.getPrintingWorkOrderById(printId)!.plannedInput.sku,receivedQty:1,receivedRollCount:1,receiverName:'接收员',receiptId:'AFTER-CLOSE',upstreamRecordId:closedSource.recordId}),/状态不能接收/)
assert.deepEqual(p.getPrintingWorkOrderById(printId)!.actualInput,closedInput)
assert.equal(JSON.stringify(ho.findPdaHandoverRecord(closedSource.recordId)),closedSourceBefore)
console.log('取消、人工完单、超上游可收量、错单位、错SKU全部拒绝且原HO/下游实收不变')
