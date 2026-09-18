import { PRINTING_FACTORIES } from './printing-factories.ts'
import {
  type PrintWorkOrder, getPrintingWorkOrderById, startPrintingProduction,
  recordPrintingProductionStage, completePrintingWorkOrder, updatePrintingRollBarcode,
  createPrintingDispatch, scanPrintingDispatchRoll, confirmPrintingDispatch, receivePrintingHandover,
  markPrintingRollBarcodesPrinted,
} from './printing-task-domain.ts'
import { getFactoryReceivingSource, registerFactoryReceivingSource, getDefaultFactoryReceiptPosition, listFactoryReceipts, prepareFactoryReceipt, savePreparedFactoryReceipt, listFactoryMaterialUses, recordFactoryMaterialUsage } from './factory-receiving.ts'
import { ensureHandoverOrderForStartedTask, getHandoverOrderById, getPdaHandoverRecordsByHead, createFactoryHandoverRecord, writeBackHandoverRecord } from './pda-handover-events.ts'

const scenarios = ['待接收', '已收待开工', '加工中', '待交出', '已交出'] as const

/** Fixed identities allow saved user actions to be restored before first-time scenario setup. */
export function buildPrintingFactoryDemoOrders(templates: PrintWorkOrder[]): PrintWorkOrder[] {
  return PRINTING_FACTORIES.filter(factory => factory.id !== 'F090').flatMap((factory, index) => scenarios.map((scenario, stage) => {
    const order = structuredClone(templates[index % templates.length])
    const code = `${String(index + 1).padStart(2, '0')}-${stage + 1}`
    const id = `PWO-PRINT-DEMO-${code}`, qty = 100 + index * 10
    Object.assign(order, {
      printOrderId:id, printOrderNo:`PH-DEMO-260914-${code}`, taskId:`TASK-PRINT-DEMO-${code}`, taskNo:`TK-PRINT-DEMO-${code}`,
      taskQrValue:`TASK:TASK-PRINT-DEMO-${code}`, sourceKey:`PRINT-FACTORY-DEMO-${code}`,
      printFactoryId:factory.id, printFactoryName:factory.name, plannedQty:qty, plannedRollCount:2,
      targetTransferWarehouseId:'WH-FABRIC-001', targetTransferWarehouseName:'面料中央仓(GKP)', receiverKind:'WAREHOUSE', receiverName:'面料中央仓(GKP)',
      handoverOrderId:undefined, handoverOrderNo:undefined, createdAt:'2026-09-14 08:00:00', updatedAt:'2026-09-14 08:00:00', plannedFinishAt:'2026-09-21 18:00:00',
      acceptanceStatus:'ACCEPTED', acceptedAt:'2026-09-14 08:05:00', acceptedBy:`${factory.name} 跟单员`,
      remark:`原型测试：${factory.name} / ${scenario}；按现有款式与物料资料模拟，可继续操作。`,
    })
    const view = order.businessView!
    view.plannedInput.plannedQty=qty; view.plannedInput.pendingPrintQty=qty; view.output.plannedQty=qty
    view.usage={...view.usage,demandBaseQty:qty,formulaLabel:`测试计划直接指定 ${qty} Yard`}
    view.actualInput={actualSku:view.plannedInput.sku,receivedQty:0,receivedRollCount:0,usedQty:0,usedRollCount:0,receiverName:'尚未接收',receipts:[]}
    view.handover={handedOverQty:0,receivedQty:0,diffQty:0,objectionQty:0,receiverName:'面料中央仓(GKP)'}
    view.dispatchDocuments=[];view.operationLogs=[];view.documentHistory=[];view.remark=order.remark!
    view.historicalInputQuantityUnknown=false;view.historicalRollQuantitiesUnknown=false
    view.printerNo=index%2===0?'原型转印机01':'原型数码机01'
    return order
  }))
}

/** Use the same receipt, production and dispatch commands as the prototype UI. */
export function initializePrintingFactoryDemoProgress(orders: PrintWorkOrder[]): void {
  for (const order of orders) {
    const id=order.printOrderId, code=id.replace('PWO-PRINT-DEMO-',''), stage=Number(code.split('-')[1])-1
    const sourceId=`DEMO-PRINT-IN-${code}`, qty=order.plannedQty, view=order.businessView!, m=view.plannedInput
    const savedSource=getFactoryReceivingSource(sourceId)
    if (savedSource && !savedSource.handedOutAt) registerFactoryReceivingSource({...savedSource,handedOutAt:'2026-09-14 08:20:00'})
    if (!savedSource) registerFactoryReceivingSource({
      id:sourceId,documentNo:`DB-PRINT-DEMO-${code}`,processCode:'PRINT',type:'TRANSFER',
      origin:{kind:'WAREHOUSE',id:'WH-FABRIC-001',name:'面料中央仓(GKP)',warehouseAttribute:'面料中央仓'},
      targetFactoryId:order.printFactoryId,targetFactoryName:order.printFactoryName,
      createdAt:'2026-09-14 08:10:00',createdBy:'原型测试仓库员',approvedAt:'2026-09-14 08:15:00',approvedBy:'原型测试审核员',handedOutAt:'2026-09-14 08:20:00',
      workOrderNo:order.printOrderNo,
      lines:[{id:`${sourceId}-L1`,material:{sku:m.sku,name:m.materialName,kind:'FABRIC',imageUrl:m.imageUrl,color:'本白',composition:m.composition||'100% 棉',specification:`幅宽 ${m.widthCm} cm / 克重 ${m.gsm} g/㎡`,batchNo:`TEST-${code}`},
        plannedQty:qty,sentQty:qty,unit:'Yard',label:`DEMO-RAW-${code}`,rolls:[{barcode:`DEMO-RAW-${code}-1`,yard:qty*.6},{barcode:`DEMO-RAW-${code}-2`,yard:qty*.4}],
        printingOrderId:id,taskNo:order.taskNo,productionOrderNo:order.sourceProductionOrderNo}],
    })
    if (stage >= 1 && !listFactoryReceipts(order.printFactoryId).some(receipt=>receipt.lines.some(line=>line.sourceId===sourceId))) {
      const position=getDefaultFactoryReceiptPosition(order.printFactoryId)
      const source=getFactoryReceivingSource(sourceId)!,line=source.lines[0]
      const receipt: Parameters<typeof prepareFactoryReceipt>[0] = {id:`DEMO-PRINT-RCV-${code}`,factoryId:order.printFactoryId,operatorId:`DEMO-RCV-${order.printFactoryId}`,operatorName:`${order.printFactoryName} 测试仓管`,receivedAt:'2026-09-14 08:30:00',remark:'原型测试实收：按两卷模拟入仓',lines:[{sourceId,sourceLineId:line.id,...position,rolls:line.rolls.map(roll=>({...roll,...position}))}]}
      // Seed fixed demo facts independently of the factory currently logged into PDA.
      savePreparedFactoryReceipt(prepareFactoryReceipt(receipt))
    }
    if (order.factoryDemoInitialized) {
      const start=view.operationLogs?.find(log=>log.action==='领料开工'&&log.remark.includes(`确认号 ${id}-START`))
      if(start && view.actualInput.usedQty===qty && !listFactoryMaterialUses().some(use=>use.printingOrderId===id))recordFactoryMaterialUsage({id:`${id}-START`,printingOrderId:id,factoryId:order.printFactoryId,operatorName:start.operatorName,at:start.operatedAt,qty,unit:view.plannedInput.qtyUnit,materialSku:m.sku,legacyAvailableQty:0})
      restoreDemoHandoverRecord(order)
      continue
    }
    if (stage >= 2) {
      for (const step of ['ARTWORK','SAMPLE'] as const) recordPrintingProductionStage(id,{id:`${id}-${step}`,stage:step,action:'FINISH',operatorName:'原型测试打样员'})
      startPrintingProduction(id,{id:`${id}-START`,qty,operatorName:`${order.printFactoryName} 测试领料员`})
      recordPrintingProductionStage(id,{id:`${id}-PRINT-START`,stage:'PRINT',action:'START',operatorName:'原型测试印制员'})
    }
    if (stage >= 3) {
      const finished=qty-2
      recordPrintingProductionStage(id,{id:`${id}-PRINT-END`,stage:'PRINT',action:'FINISH',qty,operatorName:'原型测试印制员'})
      if (view.requirement.type === '热转印') {
        recordPrintingProductionStage(id,{id:`${id}-TRANSFER-START`,stage:'TRANSFER',action:'START',operatorName:'原型测试转印员'})
        recordPrintingProductionStage(id,{id:`${id}-TRANSFER-END`,stage:'TRANSFER',action:'FINISH',qty:finished,operatorName:'原型测试转印员'})
      }
      completePrintingWorkOrder(id,{usedQty:qty,usedRollCount:2,completedQty:finished,completedRollCount:2,lossQty:2,printerNo:view.printerNo,operatorName:'原型测试完工员',batchId:`TEST-BATCH-${code}`,finishOrder:true})
      const rolls=getPrintingWorkOrderById(id)!.barcodes
      for (const [index,roll] of rolls.entries()) updatePrintingRollBarcode(id,roll.id,{lengthY:index===0?Math.floor(finished*.45):finished-Math.floor(finished*.45),gsm:m.gsm,widthCm:m.widthCm,vatNo:`TEST-${code}`,warehouseName:`${order.printFactoryName} · 待交出仓`,remark:'原型测试逐卷测量'})
      if (stage === 4) {
        markPrintingRollBarcodesPrinted(id, rolls.map((roll) => roll.id), '原型测试标签打印员')
        const doc=createPrintingDispatch([{workOrderId:id,barcodeIds:rolls.map(roll=>roll.id)}],'原型测试建单员')
        for (const roll of rolls) scanPrintingDispatchRoll(doc,roll.barcode,'原型测试交出员')
        confirmPrintingDispatch(doc,'原型测试交出员')
        const outcome=Number(code.split('-')[0])%3
        if (outcome !== 1) receivePrintingHandover(id,{receivedQty:outcome===2?finished-1:finished,receiverName:'中央仓测试收货员',differenceReason:outcome===2?'原型测试：复测少 1 Yard':''})
      }
    }
    order.factoryDemoInitialized=true
  }
}

/** Recover the single initial demo dispatch from its saved rolls and document.
 * Never replay stock movements or infer multiple missing handovers. */
function restoreDemoHandoverRecord(order: PrintWorkOrder): void {
  const view=order.businessView!,docs=(view.dispatchDocuments||[]).filter(doc=>doc.status==='已交出')
  const rolls=view.barcodes.filter(roll=>roll.handoverRecordId)
  const ids=[...new Set(rolls.map(roll=>roll.handoverRecordId!))]
  if(docs.length!==1 || ids.length!==1 || !view.handover.handedOverAt || Math.abs(rolls.reduce((n,roll)=>n+roll.lengthY,0)-view.handover.handedOverQty)>.001)return
  const ensured=ensureHandoverOrderForStartedTask(order.taskId, { includeWool: false })
  const head=getHandoverOrderById(ensured.handoverOrderId)
  if(!head || head.handoverId!==order.handoverOrderId || getPdaHandoverRecordsByHead(head.handoverId).length)return
  const record=createFactoryHandoverRecord({handoverOrderId:head.handoverId,submittedQty:view.handover.handedOverQty,qtyUnit:view.output.qtyUnit,
    factorySubmittedAt:view.handover.handedOverAt,factorySubmittedBy:docs[0].handedOverBy||docs[0].createdBy,
    factoryRemark:'从已保存的原型测试交出单恢复关联',objectType:'FABRIC',handoutObjectType:'FABRIC',materialCode:view.output.sku,materialName:view.output.materialName,skuCode:view.output.sku})
  if((record.handoverRecordId||record.recordId)!==ids[0])throw new Error('原型测试交出记录编号不一致，未覆盖原记录。')
  if(view.handover.receivedAt)writeBackHandoverRecord({handoverRecordId:ids[0],receiverWrittenQty:view.handover.receivedQty,receiverWrittenAt:view.handover.receivedAt,receiverWrittenBy:view.handover.receivedBy||'中央仓测试收货员',diffReason:view.handover.differenceReason})
}
