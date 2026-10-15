import type { PrintWorkOrder } from './printing-task-domain.ts'
/** Read-only prototype physical scenarios. No touch decision/person is prefilled or persisted. */
export function buildWashingPrintDemoOrders(templates: PrintWorkOrder[]): PrintWorkOrder[] {
  const types = ['PRODUCTION','PRODUCTION_DEMAND','PURCHASE','STOCK','SUPPLEMENT','DESIGN_REVISION'] as const
  return types.flatMap((type, index) => [true, false].map(done => {
    const order = structuredClone(templates[index % templates.length]), id = `PWO-WASH-DEMO-${type}-${done ? 'DONE' : 'PAPER'}`
    const view = order.businessView!, batch = `BATCH-WASH-${type}`, at = '2026-10-14 15:00:00'
    const rootType = ({PRODUCTION:'PRODUCTION_ORDER',PRODUCTION_DEMAND:'PRODUCTION_DEMAND',PURCHASE:'STOCK',STOCK:'STOCK',SUPPLEMENT:'CUT_PIECE_SUPPLEMENT',DESIGN_REVISION:'DESIGN_REVISION'} as const)[type]
    const sourceNo = type==='PRODUCTION' ? 'PO-202603-0003' : `${type}-WASH-DEMO-01`
    Object.assign(order, { printOrderId:id,printOrderNo:`PH-WASH-${index+1}-${done?'A':'B'}`,sourceKey:id,taskId:`TASK-${id}`,taskNo:`TK-WASH-${index+1}-${done?'A':'B'}`,sourceType:rootType,
      sourceProductionOrderId:type==='PRODUCTION'?'PO-202603-0003':undefined,sourceProductionOrderNo:type==='PRODUCTION'?'PO-202603-0003':undefined,productionOrderIds:type==='PRODUCTION'?['PO-202603-0003']:[],
      printFactoryId:'F090',printFactoryName:'全能力测试工厂',plannedQty:300,plannedRollCount:6,qtyUnit:'Yard',status:done?'WAIT_HANDOVER':'PRINT_DONE',handoverOrderId:undefined,
      createdAt:at,updatedAt:at,receiverKind:'FACTORY',receiverName:'全能力测试工厂',targetTransferWarehouseId:'F090',targetTransferWarehouseName:'原需求接收位置',
      acceptanceStatus:'ACCEPTED',acceptedAt:at,acceptedBy:'原型演示跟单',factoryDemoInitialized:true,
      sourceSnapshot:{...order.sourceSnapshot,targetSpuImageUrl:view.product.imageUrl,sourceType:rootType,productionOrderId:type==='PRODUCTION'?'PO-202603-0003':undefined,productionOrderNo:type==='PRODUCTION'?'PO-202603-0003':undefined,
        productionDemandId:type==='PRODUCTION_DEMAND'?sourceNo:undefined,productionDemandNo:type==='PRODUCTION_DEMAND'?sourceNo:undefined,designRevisionTaskId:type==='DESIGN_REVISION'?sourceNo:undefined,
        supplementRecordId:type==='SUPPLEMENT'?sourceNo:undefined,supplementRecordNo:type==='SUPPLEMENT'?sourceNo:undefined,receivingTeamId:'F090',receivingTeamName:'全能力测试工厂',receivingLocationName:'原需求接收位置',receivingFactoryId:'F090',receivingFactoryName:'全能力测试工厂',receivingLocationId:'原需求接收位置',inputMaterialSkuCode:view.plannedInput.sku,outputMaterialSkuCode:view.output.sku},
      remark:`洗水原型演示 · ${type} · ${done?'面料真实转印完成，可实际操作':'仅打印纸完成，未转印面料'}` })
    view.creationMethod=({PRODUCTION:'生产单自动生成',PRODUCTION_DEMAND:'生产需求提前创建',PURCHASE:'采购备货创建',STOCK:'备货手动创建',SUPPLEMENT:'裁片补料生成',DESIGN_REVISION:'设计改款样衣创建'} as const)[type]
    view.demandSource={type,sourceNo,sourceLabel:sourceNo,...(type==='PRODUCTION'?{productionOrderNo:sourceNo}:{}),...(type==='PRODUCTION_DEMAND'?{demandNo:sourceNo}:{})}
    view.plannedInput.plannedQty=300;view.output.plannedQty=300
    view.actualInput={actualSku:view.plannedInput.sku,receivedQty:300,usedQty:300,receivedRollCount:6,usedRollCount:6,receiverName:'原型演示仓管'}
    view.handover={handedOverQty:0,receivedQty:0,diffQty:0,objectionQty:0,receiverName:'全能力测试工厂'}
    view.output.completedQty=done?300:0;view.output.completedRollCount=done?6:0
    view.productionBatches=done?[{id:batch,qty:300,lossQty:0,at,operatorName:'原型演示完工员',requirementVersion:1,requirement:structuredClone(view.requirement)}]:[]
    view.productionActions=[{id:id+'-PRINT',stage:'PRINT',action:'FINISH',qty:300,at,operatorName:'原型演示印花员',requirementVersion:1},...(done?[{id:id+'-TRANSFER',stage:'TRANSFER' as const,action:'FINISH' as const,qty:300,at,operatorName:'原型演示转印员',requirementVersion:1}]:[])]
    view.productionStartedAt=at;view.productionCompletedAt=done?at:undefined;view.completedAt=done?at:undefined;view.transferCompletedQty=done?300:0;view.requirementVersion=1
    view.barcodes=done?Array.from({length:6},(_,n)=>({id:`${id}-R${n+1}`,barcode:`WS-${index+1}-R${n+1}`,rollNo:String(n+1),printOrderNo:order.printOrderNo,sku:view.output.sku,status:'已打印' as const,lengthY:50,meters:45.72,weightKg:14.63,gsm:view.output.gsm,widthCm:view.output.widthCm,vatNo:batch,warehouseName:'全能力测试工厂 · 待交出仓',inboundStatus:'待上架' as const,quantityConfirmed:true,batchId:batch,requirementVersion:1,createdAt:at,printedAt:at,printedBy:'原型演示标签员'})):[]
    view.operationLogs=[];view.documentHistory=[];view.dispatchDocuments=[];view.remark=order.remark!;view.historicalInputQuantityUnknown=false;view.historicalRollQuantitiesUnknown=false
    if(type==='PURCHASE'||type==='STOCK'){order.receiverKind='WAREHOUSE';order.receiverName='面料中央仓(GKP)';order.targetTransferWarehouseId='WH-FABRIC-001';order.targetTransferWarehouseName='面料中央仓(GKP)'}
    if(type==='PRODUCTION_DEMAND'){order.receiverKind='WAREHOUSE';order.receiverName='大货提前加工待匹配仓';order.targetTransferWarehouseId='EARLY-PROCESS-WAIT-'+sourceNo;order.targetTransferWarehouseName='大货提前加工待匹配仓'}
    return order
  }))
}
