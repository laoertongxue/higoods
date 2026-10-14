import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPmsMaterialPurchaseOrder, getPmsMaterialPurchaseOrderLines, listPmsMaterialLogisticsRecords,
  publishPmsMaterialPurchaseOrders, publishPmsMaterialLogisticsRecords, resetPmsMaterialPurchaseRuntimeForTest,
  type PmsMaterialPurchaseOrder, type PmsMaterialPurchaseOrderLine,
} from '../../src/data/pms/material-purchase-orders.ts'
import { getPmsRequirementMaterialBalance, getPmsMaterialRequirement, publishPmsMaterialRequirements, batchUpdatePmsMaterialRequirements, updatePmsMaterialRequirement } from '../../src/data/pms/material-requirements.ts'
import { listPmsMaterialInventory, listPmsMaterialInventoryBarcodes } from '../../src/data/pms/material-inventory.ts'
import { listPmsPaymentSourceOptions, preparePmsPaymentDraftFromSources } from '../../src/data/pms/payment-requests.ts'
import { pmsMaterialPurchaseActualSettlementAmount, listPmsLogisticsReconciliationPurchases } from '../../src/data/pms/reconciliations.ts'
import { hydratePmsSupplierConfirmationsFromIdb, listPmsSupplierConfirmations, synchronizePmsSupplierConfirmations, generatePmsConfirmationRolls, generatePmsConfirmationLabels, savePmsConfirmationShipment, resetPmsConfirmationRuntimeForTest, addPmsConfirmationBoxSpec } from '../../src/data/pms/supplier-confirmations.ts'
import { PMS_STORES, pmsCommitRecords, pmsGet } from '../../src/data/pms/idb-storage.ts'
import { PMS_BUYER_ACTOR } from '../../src/data/pms/runtime.ts'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'

function fixture(no='CGF-CONSUMERS-PARITY'):PmsMaterialPurchaseOrder {
  const order=structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!)
  const line:PmsMaterialPurchaseOrderLine={lineId:`${no}:L1`,materialCode:'CONSUMER-FABRIC',materialName:'蓝色棉布',materialSpu:'CONSUMER-FAB',imageUrl:'/materials/fabric-main.jpg',unit:'Yard',orderedQty:100,plannedRolls:2,unitPrice:3,actualPurchasedQty:120,sellerReceivedQty:20,inboundQty:0,priceConfirmed:false}
  return {...order,purchaseOrderNo:no,status:'部分到货',materialCode:line.materialCode,materialName:line.materialName,materialImageUrl:line.imageUrl,unit:'多单位',orderedQty:0,receivedQty:0,unitPrice:0,actualPurchasedQty:0,requirementNo:'',sourceRequirementLineNo:'',sourceProductPurchaseOrderNo:'',supplierConfirmed:false,supplierConfirmedAt:'',inventoryPosting:undefined,defectInventoryPosting:undefined,inventoryPostings:[],detailBarcodes:[],_pmsBaseVersion:0,lines:[line,{...line,lineId:`${no}:L2`,materialCode:'CONSUMER-YARN',materialName:'白色纱线',materialSpu:'CONSUMER-YARN',imageUrl:'/materials/process-orders/cotton-yarn-cone.jpg',unit:'kg',orderedQty:20,unitPrice:5,actualPurchasedQty:30,sellerReceivedQty:10}]}
}

async function saveFixture(order:PmsMaterialPurchaseOrder):Promise<void> {
  const result=await pmsCommitRecords([{store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:order}],{operationId:`seed-${order.purchaseOrderNo}`})
  publishPmsMaterialPurchaseOrders(result.values as PmsMaterialPurchaseOrder[])
}

test('供应确认读取失败不当空记录；存储恢复后可重新读取',async()=>{
  resetPmsMaterialPurchaseRuntimeForTest();resetPmsConfirmationRuntimeForTest()
  const before=structuredClone(listPmsSupplierConfirmations())
  await assert.rejects(hydratePmsSupplierConfirmationsFromIdb(),/IndexedDB|存储|数据库/)
  assert.deepEqual(listPmsSupplierConfirmations(),before)
  const memory=installPmsMemoryIdb()
  try { await assert.doesNotReject(hydratePmsSupplierConfirmationsFromIdb());assert.deepEqual(listPmsSupplierConfirmations().map(row=>row.confirmationNo),before.map(row=>row.confirmationNo)) }
  finally { memory.restore();resetPmsMaterialPurchaseRuntimeForTest();resetPmsConfirmationRuntimeForTest() }
})

test('需求余额按非首 SKU 和独立单位计算，实际采购与计划量分开',()=>{
  resetPmsMaterialPurchaseRuntimeForTest()
  try {
    const order=fixture();publishPmsMaterialPurchaseOrders([order])
    assert.equal(getPmsRequirementMaterialBalance('CONSUMER-FABRIC','Yard').purchasingQty,100)
    assert.equal(getPmsRequirementMaterialBalance('CONSUMER-YARN','kg').purchasingQty,20)
    assert.equal(getPmsRequirementMaterialBalance('CONSUMER-YARN','Yard').purchasingQty,0)
    publishPmsMaterialPurchaseOrders([{...order,status:'已入库'}])
    assert.equal(getPmsRequirementMaterialBalance('CONSUMER-YARN','kg').purchasingQty,0)
  } finally { resetPmsMaterialPurchaseRuntimeForTest() }
})

test('多 SKU 入库与条码精确投影，重复 posting id 不重复加库存，下架不扣库存',()=>{
  resetPmsMaterialPurchaseRuntimeForTest()
  try {
    const order=fixture(),line=order.lines![1]
    const posting={id:'CONSUMER-INBOUND',sourcePurchaseOrderNo:order.purchaseOrderNo,purchaseLineId:line.lineId,materialCode:line.materialCode,materialName:line.materialName,imageUrl:line.imageUrl,warehouse:'纱线中央仓',qty:12,unit:line.unit,postedAt:'2026-10-14T07:00:00Z',operator:'测试人',sourceKind:'local-demo' as const}
    order.inventoryPostings=[posting,posting]
    order.detailBarcodes=[{purchaseLineId:line.lineId,materialCode:line.materialCode,code:'CONSUMER-BARCODE',quantity:12,unit:line.unit,warehouse:posting.warehouse,status:'已下架',targetArea:'待出库区',movedAt:'2026-10-14T07:10:00Z',movedBy:'测试人'}]
    publishPmsMaterialPurchaseOrders([order])
    const stock=listPmsMaterialInventory().find(row=>row.sku===line.materialCode)!
    assert.equal(stock.stockQty,12);assert.equal(stock.spu,line.materialSpu);assert.equal(stock.imageUrl,line.imageUrl)
    assert.equal(stock.localPostings?.length,1)
    assert.equal(listPmsMaterialInventoryBarcodes(line.materialCode,posting.warehouse,line.unit).length,1)
    assert.deepEqual(listPmsMaterialInventoryBarcodes(order.lines![0].materialCode),[])
    assert.deepEqual(listPmsMaterialInventoryBarcodes(line.materialCode,posting.warehouse,'Yard'),[])
    assert.equal(listPmsMaterialInventory().find(row=>row.sku===line.materialCode)!.stockQty,12)
  } finally { resetPmsMaterialPurchaseRuntimeForTest() }
})

test('直接请款保留计划预付，金额汇总全部 SKU，并明确计划依据',()=>{
  resetPmsMaterialPurchaseRuntimeForTest()
  try {
    const order=fixture('CGF-CONSUMERS-PAYMENT');order.lines!.forEach(line=>{line.actualPurchasedQty=0;line.priceConfirmed=false})
    publishPmsMaterialPurchaseOrders([order])
    const source=listPmsPaymentSourceOptions('material').find(row=>row.id===order.purchaseOrderNo)!
    assert.equal(source.amount,400);assert.match(source.label,/计划采购/);assert.match(source.label,/蓝色棉布.*白色纱线/)
    assert.equal(preparePmsPaymentDraftFromSources('material',[order.purchaseOrderNo]).totalAmount,400)
    assert.equal(pmsMaterialPurchaseActualSettlementAmount(order),null)
    order.lines!.forEach(line=>{line.priceConfirmed=true})
    assert.equal(pmsMaterialPurchaseActualSettlementAmount(order),null)
    order.lines![0].actualPurchasedQty=120;order.lines![1].actualPurchasedQty=30
    assert.equal(pmsMaterialPurchaseActualSettlementAmount(order),510)
    const legacy=structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0001')!);delete legacy.lines
    assert.equal(pmsMaterialPurchaseActualSettlementAmount(legacy),legacy.orderedQty*legacy.unitPrice)
    legacy.actualPurchasedQty=10;legacy.priceConfirmed=false
    assert.equal(pmsMaterialPurchaseActualSettlementAmount(legacy),null)
  } finally { resetPmsMaterialPurchaseRuntimeForTest() }
})

test('物流对账关联采购逐 SKU 返回实际数量与待确认金额，不能只取头部',()=>{
  resetPmsMaterialPurchaseRuntimeForTest()
  try {
    const order=fixture('CGF-CONSUMERS-LOGISTICS');order.lines![0].priceConfirmed=true
    publishPmsMaterialPurchaseOrders([order])
    const template=structuredClone(listPmsMaterialLogisticsRecords()[0])
    publishPmsMaterialLogisticsRecords(order.lines!.map((line,index)=>({...template,recordNo:`CONSUMER-LOG-${index}`,purchaseOrderNo:order.purchaseOrderNo,purchaseLineId:line.lineId,materialCode:line.materialCode,unit:line.unit,headBatchNo:'FL-CONSUMER'})))
    const rows=listPmsLogisticsReconciliationPurchases('FL-CONSUMER')
    assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.unit),['Yard','kg'])
    assert.deepEqual(rows.map(row=>row.qty),[120,30]);assert.deepEqual(rows.map(row=>row.amount),[360,0])
    assert.deepEqual(rows.map(row=>row.amountConfirmed),[true,false])
  } finally { resetPmsMaterialPurchaseRuntimeForTest() }
})

test('需求关联识别非首 SKU，价格确认按对应行同事务保存，失败两边都不发布',async()=>{
  const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest()
  const original=structuredClone(getPmsMaterialRequirement('MREQ-0001')!)
  try {
    const requirement=structuredClone(original),target=requirement.lines[0],order=fixture('CGF-CONSUMERS-REQUIREMENT')
    order.lines![1]={...order.lines![1],materialCode:target.materialCode,materialName:target.materialName,unit:target.unit,imageUrl:target.imageUrl,orderedQty:70,sellerReceivedQty:0}
    requirement.lines.forEach(line=>{line.pushStatus='待下推';line.generatedPurchaseOrderNo=''})
    publishPmsMaterialRequirements([requirement]);await saveFixture(order)
    await updatePmsMaterialRequirement(requirement.requirementNo,{associatePurchaseOrderNo:order.purchaseOrderNo},'consumer-associate')
    const linked=getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!
    assert.equal(linked.lines![1].sourceRequirementLineNo,target.lineNo)
    assert.equal(getPmsMaterialRequirement(requirement.requirementNo)!.lines[0].actualQty,70)
    assert.equal(linked.sourceRequirementLineNo,'')
    const purchaseBefore=structuredClone(linked),requirementBefore=structuredClone(getPmsMaterialRequirement(requirement.requirementNo)!)
    memory.setFailWrites(true)
    await assert.rejects(batchUpdatePmsMaterialRequirements([requirement.requirementNo],'unitPrice','9','consumer-price-abort'))
    assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo),purchaseBefore)
    assert.deepEqual(getPmsMaterialRequirement(requirement.requirementNo),requirementBefore)
    memory.setFailWrites(false)
    await batchUpdatePmsMaterialRequirements([requirement.requirementNo],'unitPrice','9','consumer-price-save')
    const saved=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo)
    assert.equal(saved!.lines![0].unitPrice,3);assert.equal(saved!.lines![0].priceConfirmed,false)
    assert.equal(saved!.lines![1].unitPrice,9);assert.equal(saved!.lines![1].priceConfirmed,true)
    assert.equal(saved!.priceConfirmed,false)
    assert.equal(getPmsMaterialRequirement(requirement.requirementNo)!.lines[0].unitPrice,9)
  } finally { memory.restore();resetPmsMaterialPurchaseRuntimeForTest();publishPmsMaterialRequirements([original]) }
})

test('供应确认按 SKU 拆记录、包装数量和单位；全行完成才确认主单，重开清除主单确认',async()=>{
  const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();resetPmsConfirmationRuntimeForTest()
  try {
    const order=fixture('CGF-CONSUMERS-CONFIRM');await saveFixture(order)
    await synchronizePmsSupplierConfirmations(PMS_BUYER_ACTOR,'consumer-sync')
    const confirmations=listPmsSupplierConfirmations().filter(row=>row.purchaseOrderNo===order.purchaseOrderNo)
    assert.equal(confirmations.length,2);assert.deepEqual(confirmations.map(row=>row.unit),['Yard','kg'])
    assert.deepEqual(new Set(confirmations.map(row=>row.purchaseLineId)),new Set(order.lines!.map(line=>line.lineId)))
    const identities=confirmations.map(row=>row.confirmationNo)
    await synchronizePmsSupplierConfirmations(PMS_BUYER_ACTOR,'consumer-sync-again')
    assert.deepEqual(listPmsSupplierConfirmations().filter(row=>row.purchaseOrderNo===order.purchaseOrderNo).map(row=>row.confirmationNo),identities)
    for(const [index,confirmation] of confirmations.entries()) {
      const quantity=order.lines![index].actualPurchasedQty
      await generatePmsConfirmationRolls(confirmation.confirmationNo,{rollCount:2,qtyPerPackage:quantity/2,packageUnit:index?'包':'卷',boxCount:1,rollNoPrefix:`CONSUMER-${index}`,metersPerRoll:quantity/2,startSequence:1},PMS_BUYER_ACTOR,`consumer-rolls-${index}`)
      assert.equal(confirmation.rolls.reduce((sum,row)=>sum+row.qty,0),quantity)
      await generatePmsConfirmationLabels(confirmation.confirmationNo,confirmation.rolls.map(row=>row.rollNo),PMS_BUYER_ACTOR,`consumer-labels-${index}`)
      assert.ok(confirmation.rolls.every(row=>row.qrContent.includes(`SKU：${order.lines![index].materialCode}`)&&row.qrContent.includes(`基础单位：${order.lines![index].unit}`)))
      const patch={actualShipmentQty:quantity,packageCount:2,totalBoxCount:1,totalWeight:0,totalVolume:0,shipmentDate:'2026-10-14',shipmentRemark:'',purchaseRemark:'',internalRemark:'',rolls:confirmation.rolls.map(({rollNo,qty,weight,boxNo,remark})=>({rollNo,qty,weight,boxNo,remark}))}
      if(index===1){
        const beforeConfirmation=structuredClone(confirmation),beforeOrder=structuredClone(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!)
        memory.setFailWrites(true)
        await assert.rejects(savePmsConfirmationShipment(confirmation.confirmationNo,patch,PMS_BUYER_ACTOR,true,'consumer-confirm-abort'))
        assert.deepEqual(confirmation,beforeConfirmation)
        assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo),beforeOrder)
        assert.equal((await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo))!.supplierConfirmed,false)
        memory.setFailWrites(false)
      }
      await savePmsConfirmationShipment(confirmation.confirmationNo,patch,PMS_BUYER_ACTOR,true,`consumer-confirm-${index}`)
      assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.supplierConfirmed,index===1)
    }
    const stored=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo)
    assert.equal(stored!.supplierConfirmed,true)
    await addPmsConfirmationBoxSpec(confirmations[0].confirmationNo,{boxNo:'NEW-BOX',length:1,width:1,height:1},PMS_BUYER_ACTOR,'consumer-reopen')
    assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.supplierConfirmed,false)
    assert.equal((await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo))!.supplierConfirmed,false)
  } finally { memory.restore();resetPmsMaterialPurchaseRuntimeForTest();resetPmsConfirmationRuntimeForTest() }
})
