import test from 'node:test'
import assert from 'node:assert/strict'
import {captureFactoryReceivingData,restoreFactoryReceivingData,registerFactoryReceivingSource,prepareFactoryReceipt,savePreparedFactoryReceipt,getDefaultFactoryReceiptPosition,getSourceActualReceipts,recordFactoryMaterialUsage,listFactoryMaterialUses,type FactoryReceivingSource} from '../../src/data/fcs/factory-receiving.ts'
import {getDyeFactoryReceiptProjection,buildFactoryReceiptInboundRecords} from '../../src/data/fcs/factory-receiving-warehouse.ts'
const source:FactoryReceivingSource={id:'TMF-LENGTH-SOURCE',documentNo:'TMF-LENGTH-ISSUE',type:'ISSUE',origin:{kind:'WAREHOUSE',id:'TMF-ACC',name:'辅料仓',warehouseAttribute:'辅料中央仓'},targetFactoryId:'ID-F003',targetFactoryName:'GTG',createdAt:'2026-09-20 08:00',createdBy:'仓管',approvedAt:'2026-09-20 08:01',approvedBy:'主管',lines:[{id:'TMF-LENGTH-LINE',measurementBasis:'CONTINUOUS_LENGTH',material:{sku:'TMF-WHITE',name:'白色织带',kind:'ACCESSORY',imageUrl:'/materials/tmf/webbing-real-roll.jpg',color:'白',composition:'测试材质',specification:'30mm测试规格',batchNo:'TMF-BATCH'},plannedQty:650,sentQty:650,unit:'米',rolls:[],label:'TMF-BATCH',dyeOrderId:'TMF-LENGTH-DYE'}]}
test('连续织带实际650米交出→648+2实收→染色可用650，仓库和用料保持米制且无公斤换算',()=>{
 const before=captureFactoryReceivingData()
 try{
  registerFactoryReceivingSource(source)
  assert.deepEqual(getSourceActualReceipts(source.id),[])
  const position=getDefaultFactoryReceiptPosition('ID-F003')
  const input=(id:string,qty:number)=>({id,factoryId:'ID-F003',operatorId:'REC',operatorName:'收货员',receivedAt:'2026-09-20 09:00',remark:'米制实测',lines:[{sourceId:source.id,sourceLineId:source.lines[0].id,...position,businessQty:qty,businessUnit:'米'}]})
  for(const bad of [651,-1,0.0001])assert.throws(()=>prepareFactoryReceipt(input('BAD',bad)))
  assert.throws(()=>prepareFactoryReceipt({...input('KG',1),lines:[{...input('KG',1).lines[0],weightKg:1}]}),/不混填/)
  const receipt=prepareFactoryReceipt(input('R648',648));savePreparedFactoryReceipt(receipt);savePreparedFactoryReceipt(receipt)
  assert.equal(getSourceActualReceipts(source.id).length,1)
  assert.throws(()=>prepareFactoryReceipt(input('OVER',3)),/超过/)
  assert.equal(getDyeFactoryReceiptProjection('TMF-LENGTH-DYE','米').reduce((n,r)=>n+r.qty,0),648)
  assert.throws(()=>registerFactoryReceivingSource({...source,lines:[{...source.lines[0],measurementBasis:undefined}]}),/不能覆盖/)
  savePreparedFactoryReceipt(prepareFactoryReceipt(input('R2',2)))
  assert.equal(getDyeFactoryReceiptProjection('TMF-LENGTH-DYE','米').reduce((n,r)=>n+r.qty,0),650)
  const inbound=buildFactoryReceiptInboundRecords().filter(r=>r.sourceRecordNo===source.documentNo)
  assert.equal(inbound.reduce((n,r)=>n+r.receivedQty,0),650)
  assert.ok(inbound.every(r=>r.unit==='米'))
  const usage={id:'USE',dyeOrderId:'TMF-LENGTH-DYE',factoryId:'ID-F003',operatorName:'染色员',at:'2026-09-20 10:00',qty:650,unit:'米',materialSku:'TMF-WHITE',legacyAvailableQty:0}
  assert.throws(()=>recordFactoryMaterialUsage({...usage,qty:651}),/超过/)
  recordFactoryMaterialUsage(usage)
  assert.equal(listFactoryMaterialUses('TMF-LENGTH-DYE').flatMap(u=>u.lines).reduce((n,l)=>n+l.qty,0),650)
  assert.ok(listFactoryMaterialUses('TMF-LENGTH-DYE').flatMap(u=>u.lines).every(l=>l.unit==='米'))
 }finally{restoreFactoryReceivingData(before)}
})
test('连续长度口径不可用于纱线/码制，普通辅料仍要求实际称重',()=>{
 const before=captureFactoryReceivingData()
 try{
  assert.throws(()=>registerFactoryReceivingSource({...source,lines:[{...source.lines[0],unit:'Yard'}]}),/按米/)
  assert.throws(()=>registerFactoryReceivingSource({...source,lines:[{...source.lines[0],material:{...source.lines[0].material,kind:'YARN'}}]}),/按米/)
  registerFactoryReceivingSource({...source,lines:[{...source.lines[0],measurementBasis:undefined}]})
  assert.throws(()=>prepareFactoryReceipt({id:'NO-KG',factoryId:'ID-F003',operatorId:'REC',operatorName:'收货员',receivedAt:'2026-09-20 09:00',remark:'',lines:[{sourceId:source.id,sourceLineId:source.lines[0].id,...getDefaultFactoryReceiptPosition('ID-F003'),businessQty:1,businessUnit:'米'}]}),/重量/)
 }finally{restoreFactoryReceivingData(before)}
})

test('原生连续辅料染色650→640：实际工厂实收及用料驱动加工，使用对象对应蓝色织带参考图',async()=>{
 const dye=await import('../../src/data/fcs/dyeing-task-domain.ts')
 const before=captureFactoryReceivingData(),dyeBefore=dye.captureDyeProcessMutationState()
 const id='TMF-NATIVE-DYE',order=dye.registerFormalProductionOrderDyeWorkOrder({workOrderId:id,workOrderNo:id,sourceKey:id,processName:'染色',sourceSnapshot:{sourceType:'PRODUCTION_ORDER',productionOrderId:'TMF-NATIVE-PROD',productionOrderNo:'TMF-NATIVE-PROD',techPackVersionId:'TMF-NATIVE-V1',techPackVersionLabel:'V1',processEntryId:'DYE',routeObjectKey:'BOM:WB',bomItemId:'WB'},productionOrderId:'TMF-NATIVE-PROD',productionOrderNo:'TMF-NATIVE-PROD',techPackVersionId:'TMF-NATIVE-V1',techPackVersionLabel:'V1',processEntryId:'DYE',routeObjectKey:'BOM:WB',orderedAt:'2026-09-20 08:00:00',factoryId:'F090',factoryName:'全能力测试工厂',materialId:'TMF-WHITE',materialName:'Mock白色织带',materialItems:[{sourceBomItemId:'WB',materialId:'TMF-WHITE',materialName:'Mock白色织带',materialType:'辅料'}],inputMaterialSkuId:'TMF-WHITE',inputMaterialSkuCode:'TMF-WHITE',inputMaterialImageUrl:'/materials/tmf/webbing-real-roll.jpg',outputMaterialSkuId:'TMF-BLUE',outputMaterialSkuCode:'TMF-BLUE',outputMaterialName:'Mock蓝色织带',targetColor:'蓝',plannedQty:650,qtyUnit:'米',processCodes:['DYE'],spuCode:'TEST',spuName:'测试款式',requiredDeliveryDate:'2026-09-25'})
 assert.equal(order.outputMaterial!.sku,'TMF-BLUE')
 assert.equal(order.outputMaterial!.imageUrl,'/materials/tmf/webbing-dyed-blue.jpg','产出使用对象对应的蓝色织带参考图，不沿用白坯投入图')
 try{
  const actualSource={...structuredClone(source),id:id+'-SOURCE',documentNo:id+'-ISSUE',targetFactoryId:'F090',targetFactoryName:'全能力测试工厂',lines:[{...structuredClone(source.lines[0]),id:id+'-LINE',dyeOrderId:id}]}
  registerFactoryReceivingSource(actualSource)
  savePreparedFactoryReceipt(prepareFactoryReceipt({id:id+'-RECEIPT',factoryId:'F090',operatorId:'REC',operatorName:'收货员',receivedAt:'2026-09-20 09:00',remark:'650米连续白料实际实收',lines:[{sourceId:actualSource.id,sourceLineId:actualSource.lines[0].id,...getDefaultFactoryReceiptPosition('F090'),businessQty:650,businessUnit:'米'}]}))
  assert.equal(getDyeFactoryReceiptProjection(id,'米').reduce((n,r)=>n+r.qty,0),650)
  dye.planDyeVat(id,{dyeVatNo:'MOCK-VAT',operatorName:'染色主管'})
  dye.startDyeing(id,{dyeVatNo:'MOCK-VAT',inputQty:650,materialSku:'TMF-WHITE',operatorName:'染色员'})
  dye.completeDyeing(id,{inputQty:650,outputQty:640,operatorName:'染色员'})
  for(const node of ['DEHYDRATE','DRY','SET','ROLL','PACK'] as const){dye.startDyeNode(id,node,'染色员');dye.completeDyeNode(id,node,{outputQty:640,operatorName:'染色员'})}
  assert.equal(dye.getDyeDispatchAvailableQty(id),640)
  assert.equal(listFactoryMaterialUses(id).flatMap(u=>u.lines).reduce((n,l)=>n+l.qty,0),650)
  assert.equal(dye.getDyeDispatchMaterial(id).imageUrl,'/materials/tmf/webbing-dyed-blue.jpg')
  assert.equal(dye.getDyeExecutionNodeRecord(id,'DYE')!.inputQty,650)
  assert.equal(dye.getDyeExecutionNodeRecord(id,'DYE')!.outputQty,640)
  const rolls=dye.saveDyeOutputRolls(id,[{qty:640,vatNo:'MOCK-VAT'}])
  dye.markDyeOutputRolls(id,[rolls[0].id],'print')
  const dispatched=dye.createDyeDispatchDocument([{orderId:id,rollIds:[rolls[0].id]}],'染色主管')
  assert.equal(dispatched.lines[0].sku,'TMF-BLUE')
  assert.equal(dye.getDyeDispatchMaterial(id).imageUrl,'/materials/tmf/webbing-dyed-blue.jpg')
 }finally{dye.restoreDyeProcessMutationState(dyeBefore);restoreFactoryReceivingData(before)}
})
