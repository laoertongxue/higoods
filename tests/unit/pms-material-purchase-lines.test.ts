import test from 'node:test'
import assert from 'node:assert/strict'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { PMS_STORES, pmsAll, pmsGet, pmsCommitRecords } from '../../src/data/pms/idb-storage.ts'
import { PMS_BUYER_ACTOR, listPmsLogs } from '../../src/data/pms/runtime.ts'
import { pmsBusinessNumber } from '../../src/utils/pms-business-number.ts'
import { listPurchaseMaterialReferences } from '../../src/data/pms/canonical-purchase-references.ts'
import {
  createPmsMaterialPurchaseOrder, getPmsMaterialPurchaseOrder, getPmsMaterialPurchaseOrderLines,
  pmsMaterialPurchaseOrderAmount, pmsMaterialPurchaseQuantityGroups, pmsMaterialPurchaseBarcodeLimit,
  updatePmsMaterialPurchaseOrder, updatePmsMaterialPurchaseLines, confirmPmsMaterialPurchasePrices,
  recordPmsMaterialPurchaseQuantities, markPmsMaterialPurchaseOrdersPlaced, rejectPmsMaterialPurchaseOrders,
  convertPmsMaterialPurchaseType, copyPmsMaterialPurchaseOrder, saveMpoDetailBarcodes,
  listPmsMaterialPurchaseInventoryPostings, publishPmsMaterialPurchaseOrders,
  batchAddPmsMaterialLogistics, deletePmsMaterialLogistics, inboundPmsMaterialPurchaseLogistics,
  getPmsMaterialLogisticsRecord, listPmsMaterialLogisticsRecords, batchConfirmPmsMaterialPurchasePrices,
  inspectPmsMaterialPurchaseOrder, disposePmsMaterialPurchaseDefects, addPmsMaterialPurchaseAttachments,
  addPmsMaterialPurchaseAttachment, removePmsMaterialPurchaseAttachment, updatePmsMaterialLogistics,
  type PmsLogisticsImportRow,
  hydratePmsMaterialPurchaseOrdersFromIdb, listPmsMaterialPurchaseOrders, resetPmsMaterialPurchaseRuntimeForTest,
  type PmsNewMaterialPurchaseInput, type PmsMaterialPurchaseOrder,
} from '../../src/data/pms/material-purchase-orders.ts'

const fabric=listPurchaseMaterialReferences().filter(row=>row.active&&row.category==='面料'&&row.imageUrl)
const input=():PmsNewMaterialPurchaseInput=>({kind:'面料',lines:fabric.slice(0,2).map((row,index)=>({materialCode:row.materialCode,quantity:index?20:10,plannedRolls:index?2:1,unitPrice:index?3:2})),currency:'IDR',supplierName:'本地核验供方',purchaseRegion:'印尼',warehouse:'本地核验仓',buyerName:'王采购',expectedArrivalDate:'',remark:'多SKU本地契约'})

test('显示采购单号可定位原持久身份，物流包装及SKU重量体积同事务保存',async()=>withStorage(async()=>{
 const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'MPO:display-import-metadata'),line=row.lines![0]
 assert.equal(getPmsMaterialPurchaseOrder(pmsBusinessNumber(row.purchaseOrderNo))?.purchaseOrderNo,row.purchaseOrderNo)
 const entered={...shipping(row,line.lineId,10),purchaseOrderNo:pmsBusinessNumber(row.purchaseOrderNo),actualPurchasedQty:10,unitWeightKg:0.25,unitVolumeM3:0.001,metersPerRoll:100,packagingUnit:'卷',freightChannel:'空运快线'}
 const [record]=await batchAddPmsMaterialLogistics([entered],'add',PMS_BUYER_ACTOR,'display-import-metadata')
 assert.equal(record.purchaseOrderNo,row.purchaseOrderNo);assert.equal(record.metersPerRoll,100);assert.equal(record.packagingUnit,'卷');assert.equal(record.freightChannel,'空运快线')
 const saved=(await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo))!
 assert.equal(saved.lines![0].weightKg,0.25);assert.equal(saved.lines![0].volumeM3,0.001)
 await assert.rejects(batchAddPmsMaterialLogistics([{...entered,trackingNo:'INVALID-WEIGHT',unitWeightKg:-1}],'add',PMS_BUYER_ACTOR,'invalid-unit-weight'),/重量|非负/)
 assert.equal((await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo))!.lines![0].weightKg,0.25)
}))
function shipping(order:PmsMaterialPurchaseOrder,lineId:string,qty:number,trackingNo='SAME-WAYBILL'):PmsLogisticsImportRow {return {purchaseOrderNo:order.purchaseOrderNo,purchaseLineId:lineId,materialCode:order.lines!.find(line=>line.lineId===lineId)!.materialCode,company:'本地快递',trackingNo,shipDate:'2026-10-14',estimatedArrival:'2026-10-15',boxCount:1,rolls:1,qty,fee:7,remark:''}}
async function withStorage(work:(memory:ReturnType<typeof installPmsMemoryIdb>)=>Promise<void>){const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{await work(memory)}finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}}

test('旧单读取映射一条明细且无落盘，不将已下单推断为实际采购数量',async()=>withStorage(async()=>{
  const order=getPmsMaterialPurchaseOrder('CGF-2026-0001')!,before=structuredClone(order)
  const [line]=getPmsMaterialPurchaseOrderLines(order)
  assert.equal(line.legacy,true);assert.equal(line.actualPurchasedQty,0);line.orderedQty=1
  assert.deepEqual(order,before);assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length,0)
}))

test('SPU的多SKU以对应真实图片、计划卷数及价格共同保存，重复创建只返回原记录',async()=>withStorage(async()=>{
  assert.equal(fabric[0].materialSpu,fabric[1].materialSpu)
  const draft=input(),row=await createPmsMaterialPurchaseOrder(draft,PMS_BUYER_ACTOR,'multi-create')
  assert.equal(row.lines!.length,2);assert.equal(row.orderedQty,30);assert.equal(row.unitPrice,0)
  assert.equal(pmsMaterialPurchaseOrderAmount(row),80);assert.equal(pmsMaterialPurchaseOrderAmount(row,'actual'),0)
  assert.deepEqual(row.lines!.map(line=>line.imageUrl),fabric.slice(0,2).map(ref=>ref.imageUrl))
  assert.deepEqual(row.lines!.map(line=>line.plannedRolls),[1,2])
  await createPmsMaterialPurchaseOrder(draft,PMS_BUYER_ACTOR,'multi-create')
  assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length,1)
  assert.equal(listPmsLogs('material-purchase-order',row.purchaseOrderNo).filter(log=>log.action==='创建采购单').length,1)
  await assert.rejects(createPmsMaterialPurchaseOrder({...draft,remark:'不同输入'},PMS_BUYER_ACTOR,'multi-create'),/已保存其他内容/)
  const saved=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
  resetPmsMaterialPurchaseRuntimeForTest();await hydratePmsMaterialPurchaseOrdersFromIdb()
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),saved)
}))

test('不同单位保持按单位分组，不把Yard与M相加或通过主单反写多SKU',async()=>withStorage(async()=>{
  const draft=input();draft.lines=[draft.lines![0],{materialCode:fabric.find(ref=>ref.unit!==fabric[0].unit)!.materialCode,quantity:20,unitPrice:3}]
  const row=await createPmsMaterialPurchaseOrder(draft,PMS_BUYER_ACTOR,'multi-unit')
  assert.equal(row.unit,'多单位');assert.equal(row.orderedQty,0);assert.equal(pmsMaterialPurchaseOrderAmount(row),80)
  assert.deepEqual(pmsMaterialPurchaseQuantityGroups(row).map(group=>[group.unit,group.orderedQty]),[['Yard',10],['M',20]])
  await assert.rejects(updatePmsMaterialPurchaseOrder(row.purchaseOrderNo,{orderedQty:99},PMS_BUYER_ACTOR,'wrong-header-write'),/按明细/)
}))

test('实际价格确认逐行保存，部分确认不标全单；普通改单价清除确认',async()=>withStorage(async()=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'prices-create'),[a,b]=row.lines!
  await confirmPmsMaterialPurchasePrices(row.purchaseOrderNo,[{lineId:a.lineId,unitPrice:4}],PMS_BUYER_ACTOR,'confirm-first-price')
  assert.equal(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.priceConfirmed,false)
  await confirmPmsMaterialPurchasePrices(row.purchaseOrderNo,[{lineId:b.lineId,unitPrice:5}],PMS_BUYER_ACTOR,'confirm-second-price')
  assert.equal(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.priceConfirmed,true)
  await updatePmsMaterialPurchaseLines(row.purchaseOrderNo,[{lineId:a.lineId,unitPrice:6}],PMS_BUYER_ACTOR,'edit-confirmed-price')
  const saved=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
  assert.equal(saved!.priceConfirmed,false);assert.equal(saved!.lines![0].priceConfirmed,false);assert.equal(saved!.lines![1].priceConfirmed,true)
  assert.equal(pmsMaterialPurchaseOrderAmount(saved!),160)
}))

test('实采可超过计划，商家到货与入库不混同，累计事实不得减少',async()=>withStorage(async()=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'quantities-create'),lineId=row.lines![0].lineId
  await markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'place-order')
  await markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'place-order')
  await recordPmsMaterialPurchaseQuantities(row.purchaseOrderNo,'actualPurchased',[{lineId,quantity:12}],PMS_BUYER_ACTOR,'actual-over-plan')
  await recordPmsMaterialPurchaseQuantities(row.purchaseOrderNo,'sellerReceived',[{lineId,quantity:11}],PMS_BUYER_ACTOR,'seller-arrival')
  const saved=getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!,line=getPmsMaterialPurchaseOrderLines(saved)[0]
  assert.equal(line.orderedQty,10);assert.equal(line.actualPurchasedQty,12);assert.equal(line.sellerReceivedQty,11);assert.equal(line.inboundQty,0)
  assert.equal(saved.status,'部分到货');assert.equal(saved.inventoryPosting,undefined)
  assert.equal(pmsMaterialPurchaseOrderAmount(saved,'actual'),24);assert.equal(pmsMaterialPurchaseOrderAmount(saved),80)
  await assert.rejects(recordPmsMaterialPurchaseQuantities(row.purchaseOrderNo,'sellerReceived',[{lineId,quantity:10}],PMS_BUYER_ACTOR,'reduce-arrival'),/不能少于/)
  await assert.rejects(recordPmsMaterialPurchaseQuantities(row.purchaseOrderNo,'sellerReceived',[{lineId,quantity:13}],PMS_BUYER_ACTOR,'over-actual'),/实际采购量/)
}))

test('多SKU实际入库记录按SKU读取，同一记录的兼容引用不重复增加库存',async()=>withStorage(async()=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'stock-read-source'),[a,b]=row.lines!
  const posting=(line:typeof a,qty:number)=>({id:`STOCK:${line.lineId}`,purchaseLineId:line.lineId,sourcePurchaseOrderNo:row.purchaseOrderNo,materialCode:line.materialCode,materialName:line.materialName,imageUrl:line.imageUrl,warehouse:row.warehouse,qty,unit:line.unit,postedAt:'2026-10-14T12:00:00Z',operator:'本地核验仓管',sourceKind:'local-demo' as const})
  const aPosting=posting(a,2),bPosting=posting(b,3),saved={...structuredClone(row),inventoryPosting:aPosting,inventoryPostings:[aPosting,bPosting]}
  await pmsCommitRecords([{store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:saved}],{operationId:'seed-durable-stock-read'})
  publishPmsMaterialPurchaseOrders([saved])
  const actual=listPmsMaterialPurchaseInventoryPostings().filter(entry=>entry.sourcePurchaseOrderNo===row.purchaseOrderNo)
  assert.equal(actual.length,2);assert.deepEqual(actual.map(entry=>[entry.materialCode,entry.qty]),[[a.materialCode,2],[b.materialCode,3]])
}))

test('SKU条码归属明确，实采未知不以计划限制，已明确实采按物理量校验',async()=>withStorage(async()=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'barcode-create'),[a,b]=row.lines!
  assert.equal(pmsMaterialPurchaseBarcodeLimit(row,a.lineId),undefined)
  const barcode={code:'MULTI-BAR-A',quantity:12,unit:a.unit,warehouse:'本地核验仓',status:'有效' as const,purchaseLineId:a.lineId,materialCode:a.materialCode}
  await saveMpoDetailBarcodes(row.purchaseOrderNo,[barcode],PMS_BUYER_ACTOR,'barcode-over-plan')
  await assert.rejects(saveMpoDetailBarcodes(row.purchaseOrderNo,[{...barcode,purchaseLineId:undefined,materialCode:undefined}],PMS_BUYER_ACTOR,'barcode-missing-sku'),/归属于/)
  await assert.rejects(saveMpoDetailBarcodes(row.purchaseOrderNo,[{...barcode,purchaseLineId:b.lineId,materialCode:b.materialCode}],PMS_BUYER_ACTOR,'barcode-change-sku'),/不能更换SKU/)
  await markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'barcode-place')
  await recordPmsMaterialPurchaseQuantities(row.purchaseOrderNo,'actualPurchased',[{lineId:a.lineId,quantity:12}],PMS_BUYER_ACTOR,'barcode-actual')
  await assert.rejects(saveMpoDetailBarcodes(row.purchaseOrderNo,[{...barcode,quantity:13}],PMS_BUYER_ACTOR,'barcode-over-actual'),/实际采购量/)
  assert.equal(getPmsMaterialPurchaseOrderLines(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!)[0].inboundQty,0)
}))

test('复制多SKU清除执行与确认事实，SKU计划、价格及复制来源保留',async()=>withStorage(async()=>{
  const source=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'copy-source'),a=source.lines![0]
  await confirmPmsMaterialPurchasePrices(source.purchaseOrderNo,source.lines!.map(line=>({lineId:line.lineId,unitPrice:line.unitPrice})),PMS_BUYER_ACTOR,'copy-source-price')
  await markPmsMaterialPurchaseOrdersPlaced([source.purchaseOrderNo],PMS_BUYER_ACTOR,'copy-source-placed')
  await recordPmsMaterialPurchaseQuantities(source.purchaseOrderNo,'actualPurchased',[{lineId:a.lineId,quantity:12}],PMS_BUYER_ACTOR,'copy-source-actual')
  await recordPmsMaterialPurchaseQuantities(source.purchaseOrderNo,'sellerReceived',[{lineId:a.lineId,quantity:11}],PMS_BUYER_ACTOR,'copy-source-arrival')
  const copy=await copyPmsMaterialPurchaseOrder(source.purchaseOrderNo,PMS_BUYER_ACTOR,'copy-new')
  assert.equal(copy.sourceCopyOrderNo,source.purchaseOrderNo);assert.equal(copy.status,'待采购');assert.equal(copy.orderPlacementStatus,'待下单');assert.equal(copy.priceConfirmed,false)
  assert.deepEqual(copy.lines!.map(line=>[line.orderedQty,line.unitPrice]),[[10,2],[20,3]])
  assert.ok(copy.lines!.every(line=>line.actualPurchasedQty===0&&line.sellerReceivedQty===0&&line.inboundQty===0&&!line.priceConfirmed))
  assert.ok(copy.lines!.every(line=>!source.lines!.some(old=>old.lineId===line.lineId)))
  assert.deepEqual(copy.detailBarcodes,[]);assert.deepEqual(copy.attachments,[]);assert.equal(copy.inspection,undefined)
  await copyPmsMaterialPurchaseOrder(source.purchaseOrderNo,PMS_BUYER_ACTOR,'copy-new')
  assert.equal(listPmsMaterialPurchaseOrders().filter(row=>row.purchaseOrderNo===copy.purchaseOrderNo).length,1)
}))

test('批量任一来源受限或保存中止均不发布半套数据，旧PCS/TMF限制仍在',async()=>withStorage(async(memory)=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'abort-source'),before=structuredClone(row),logs=listPmsLogs('material-purchase-order',row.purchaseOrderNo).length
  await assert.rejects(markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo,'不存在'],PMS_BUYER_ACTOR,'batch-invalid'),/不允许此操作/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before)
  memory.setFailWrites(true)
  await assert.rejects(updatePmsMaterialPurchaseLines(row.purchaseOrderNo,[{lineId:row.lines![0].lineId,orderedQty:15}],PMS_BUYER_ACTOR,'aborted-lines'))
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before);assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo),before)
  assert.equal(listPmsLogs('material-purchase-order',row.purchaseOrderNo).length,logs)
  memory.setFailWrites(false)
  const special={...structuredClone(before),purchaseOrderNo:'PCS-GUARDED',pcsSource:{source:'PCS_MATERIAL_SKU' as const,materialId:'source',materialSkuId:'sku',materialSkuCode:'code',returnPath:'/pcs/materials',mainUnit:'Yard',mainUnitVersion:1,purchaseUnit:'Yard',mainQtyPerPurchaseUnit:1,relationId:null,relationVersion:null,basis:'主单位',capturedAt:'2026-10-14'},_pmsBaseVersion:0}
  await pmsCommitRecords([{store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:special}],{operationId:'special-seed'})
  resetPmsMaterialPurchaseRuntimeForTest();await hydratePmsMaterialPurchaseOrdersFromIdb()
  await assert.rejects(updatePmsMaterialPurchaseLines(special.purchaseOrderNo,[{lineId:special.lines![0].lineId,unitPrice:9}],PMS_BUYER_ACTOR,'special-mutation'),/专项来源/)
}))

test('并发版本冲突不覆盖其他页面已保存的采购修改',async()=>withStorage(async()=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'version-source'),before=structuredClone(row)
  const another=structuredClone(row);another.remark='其他页面已经保存'
  await pmsCommitRecords([{store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:another}],{operationId:'other-tab'})
  await assert.rejects(updatePmsMaterialPurchaseLines(row.purchaseOrderNo,[{lineId:row.lines![0].lineId,orderedQty:15}],PMS_BUYER_ACTOR,'stale-version'),/其他页面修改/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before)
  assert.equal((await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo))!.remark,'其他页面已经保存')
}))

test('分类转换与驳回保存明确结果，物料采购没有冒充原料采购',async()=>withStorage(async()=>{
  const draft=input();draft.kind='物料'
  const row=await createPmsMaterialPurchaseOrder(draft,PMS_BUYER_ACTOR,'type-source')
  assert.equal(row.materialType,'物料')
  await convertPmsMaterialPurchaseType(row.purchaseOrderNo,'原料',PMS_BUYER_ACTOR,'to-raw')
  await convertPmsMaterialPurchaseType(row.purchaseOrderNo,'辅料',PMS_BUYER_ACTOR,'to-accessory')
  await rejectPmsMaterialPurchaseOrders([row.purchaseOrderNo],'供应商无法供货',PMS_BUYER_ACTOR,'reject-source')
  await rejectPmsMaterialPurchaseOrders([row.purchaseOrderNo],'供应商无法供货',PMS_BUYER_ACTOR,'reject-source')
  const saved=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
  assert.equal(saved!.materialType,'辅料');assert.equal(saved!.orderPlacementStatus,'驳回');assert.equal(saved!.rejectedReason,'供应商无法供货')
  await assert.rejects(markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'rejected-placed'),/未驳回/)
}))

test('主单与SKU编辑共同保存，任何失败均保留原元数据和明细',async()=>withStorage(async(memory)=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'combined-edit-source'),a=row.lines![0]
  await updatePmsMaterialPurchaseOrder(row.purchaseOrderNo,{warehouse:'新收货仓',remark:'同次保存',isStockProduction:true,usageType:'成衣做货',linePatches:[{lineId:a.lineId,orderedQty:15,plannedRolls:3,unitPrice:4,weightKg:0.2,volumeM3:0.001}],expectedVersion:row._pmsBaseVersion},PMS_BUYER_ACTOR,'combined-edit')
  const saved=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
  assert.equal(saved!.warehouse,'新收货仓');assert.equal(saved!.isStockProduction,true);assert.equal(saved!.lines![0].orderedQty,15);assert.equal(saved!.lines![0].weightKg,0.2);assert.equal((saved as any).linePatches,undefined)
  memory.setFailWrites(true)
  await assert.rejects(updatePmsMaterialPurchaseOrder(row.purchaseOrderNo,{warehouse:'不得部分保存',linePatches:[{lineId:a.lineId,orderedQty:25}]},PMS_BUYER_ACTOR,'combined-abort'))
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),saved)
  assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo),saved)
}))

test('批量逐单逐SKU确认价一次提交，任一行错误不确认前面的单据',async()=>withStorage(async()=>{
  const one=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'batch-price-a'),two=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'batch-price-b'),before=structuredClone(one)
  await assert.rejects(batchConfirmPmsMaterialPurchasePrices([{orderNo:one.purchaseOrderNo,prices:[{lineId:one.lines![0].lineId,unitPrice:4}]},{orderNo:two.purchaseOrderNo,prices:[{lineId:'不属于本单',unitPrice:5}]}],PMS_BUYER_ACTOR,'batch-price-invalid'),/SKU须属于/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(one.purchaseOrderNo),before)
  const entries=[one,two].map((order,index)=>({orderNo:order.purchaseOrderNo,prices:order.lines!.map(line=>({lineId:line.lineId,unitPrice:4+index}))}))
  await batchConfirmPmsMaterialPurchasePrices(entries,PMS_BUYER_ACTOR,'batch-price-valid')
  await batchConfirmPmsMaterialPurchasePrices(entries,PMS_BUYER_ACTOR,'batch-price-valid')
  assert.equal(getPmsMaterialPurchaseOrder(one.purchaseOrderNo)!.priceConfirmed,true);assert.equal(getPmsMaterialPurchaseOrder(two.purchaseOrderNo)!.lines![0].unitPrice,5)
}))

test('同运单多SKU按归属保存，补录可重复运单但重试去重，实采与装运量同事务',async()=>withStorage(async(memory)=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'shipping-source'),[a,b]=row.lines!
  const first={...shipping(row,a.lineId,10),actualPurchasedQty:12,actualPurchasedRolls:2,unitPrice:4,currency:'IDR' as const,quantityUnit:a.unit}
  const second={...shipping(row,b.lineId,15),actualPurchasedQty:20,unitPrice:5,currency:'IDR' as const,quantityUnit:b.unit}
  const records=await batchAddPmsMaterialLogistics([first,second],'add',PMS_BUYER_ACTOR,'shipping-add')
  assert.equal(records.length,2);assert.deepEqual(records.map(record=>record.materialCode),[a.materialCode,b.materialCode])
  assert.equal(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.lines![0].actualPurchasedQty,12);assert.equal(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.priceConfirmed,true)
  await assert.rejects(batchAddPmsMaterialLogistics([shipping(row,a.lineId,1)],'add',PMS_BUYER_ACTOR,'shipping-duplicate-add'),/已存在/)
  const supplement=await batchAddPmsMaterialLogistics([shipping(row,a.lineId,2)],'supplement',PMS_BUYER_ACTOR,'shipping-supplement')
  await batchAddPmsMaterialLogistics([shipping(row,a.lineId,2)],'supplement',PMS_BUYER_ACTOR,'shipping-supplement')
  assert.equal(supplement[0].kind,'supplement');assert.equal(listPmsMaterialLogisticsRecords().filter(record=>record.purchaseOrderNo===row.purchaseOrderNo).length,3)
  assert.equal(listPmsMaterialLogisticsRecords().filter(record=>record.purchaseOrderNo===row.purchaseOrderNo).reduce((sum,record)=>sum+record.fee,0),21)
  await assert.rejects(batchAddPmsMaterialLogistics([shipping(row,a.lineId,1)],'supplement',PMS_BUYER_ACTOR,'shipping-over-actual'),/累计物流数量/)
  await assert.rejects(batchAddPmsMaterialLogistics([{...shipping(row,b.lineId,1),currency:'USD'}],'supplement',PMS_BUYER_ACTOR,'shipping-currency'),/币种/)
  const before=structuredClone(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)),count=listPmsMaterialLogisticsRecords().length
  memory.setFailWrites(true)
  await assert.rejects(batchAddPmsMaterialLogistics([{...shipping(row,a.lineId,1,'NEW-WAYBILL'),actualPurchasedQty:13,unitPrice:6}],'add',PMS_BUYER_ACTOR,'shipping-atomic-abort'))
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before);assert.equal(listPmsMaterialLogisticsRecords().length,count)
}))

test('删除未执行物流保存标记并刷新不复活；运单入库必须有实际来源且双重限量',async()=>withStorage(async()=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'inbound-source'),[a,b]=row.lines!
  await markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'inbound-placed')
  const [unknown]=await batchAddPmsMaterialLogistics([shipping(row,a.lineId,12,'UNKNOWN')],'add',PMS_BUYER_ACTOR,'unknown-physical-source')
  await assert.rejects(inboundPmsMaterialPurchaseLogistics([{recordNo:unknown.recordNo,quantity:1,warehouse:'正常仓'}],PMS_BUYER_ACTOR,'inbound-without-physical'),/不能按计划量/)
  await deletePmsMaterialLogistics(unknown.recordNo,PMS_BUYER_ACTOR,'delete-unknown')
  await deletePmsMaterialLogistics(unknown.recordNo,PMS_BUYER_ACTOR,'delete-unknown')
  assert.equal(getPmsMaterialLogisticsRecord(unknown.recordNo),undefined)
  resetPmsMaterialPurchaseRuntimeForTest();await hydratePmsMaterialPurchaseOrdersFromIdb()
  assert.equal(getPmsMaterialLogisticsRecord(unknown.recordNo),undefined)
  const records=await batchAddPmsMaterialLogistics([{...shipping(row,a.lineId,12,'A'),actualPurchasedQty:12},{...shipping(row,b.lineId,20,'B'),actualPurchasedQty:20}],'add',PMS_BUYER_ACTOR,'known-physical-source')
  await assert.rejects(inboundPmsMaterialPurchaseLogistics([{recordNo:records[0].recordNo,quantity:13,warehouse:'正常仓'}],PMS_BUYER_ACTOR,'inbound-over'),/运单余量/)
  await inboundPmsMaterialPurchaseLogistics(records.map(record=>({recordNo:record.recordNo,quantity:record.qty,warehouse:'正常仓'})),PMS_BUYER_ACTOR,'inbound-two-skus')
  await inboundPmsMaterialPurchaseLogistics(records.map(record=>({recordNo:record.recordNo,quantity:record.qty,warehouse:'正常仓'})),PMS_BUYER_ACTOR,'inbound-two-skus')
  const saved=getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!,stock=listPmsMaterialPurchaseInventoryPostings().filter(posting=>posting.sourcePurchaseOrderNo===row.purchaseOrderNo)
  assert.equal(saved.status,'已入库');assert.deepEqual(saved.lines!.map(line=>line.inboundQty),[12,20]);assert.equal(stock.length,2)
  assert.ok(stock.every(posting=>posting.purchaseLineId&&posting.sourceLogisticsRecordNo));assert.equal(stock.reduce((sum,posting)=>sum+posting.qty,0),32)
  await assert.rejects(deletePmsMaterialLogistics(records[0].recordNo,PMS_BUYER_ACTOR,'delete-inbound'),/入库/)
}))

test('运单批量入库任一行错误或事务中止时，库存、单据和运单均不半套保存',async()=>withStorage(async(memory)=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'inbound-abort-source'),[a,b]=row.lines!
  await markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'inbound-abort-placed')
  const records=await batchAddPmsMaterialLogistics([{...shipping(row,a.lineId,10,'A'),actualPurchasedQty:10},{...shipping(row,b.lineId,20,'B'),actualPurchasedQty:20}],'add',PMS_BUYER_ACTOR,'inbound-abort-ship')
  const before=structuredClone(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)),logistics=structuredClone(records)
  await assert.rejects(inboundPmsMaterialPurchaseLogistics([{recordNo:records[0].recordNo,quantity:10,warehouse:'正常仓'},{recordNo:records[1].recordNo,quantity:21,warehouse:'正常仓'}],PMS_BUYER_ACTOR,'inbound-invalid-batch'),/运单余量/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before)
  memory.setFailWrites(true)
  await assert.rejects(inboundPmsMaterialPurchaseLogistics(records.map(record=>({recordNo:record.recordNo,quantity:record.qty,warehouse:'正常仓'})),PMS_BUYER_ACTOR,'inbound-aborted-batch'))
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before)
  assert.deepEqual(records.map(record=>getPmsMaterialLogisticsRecord(record.recordNo)),logistics)
  assert.equal(listPmsMaterialPurchaseInventoryPostings().filter(posting=>posting.sourcePurchaseOrderNo===row.purchaseOrderNo).length,0)
}))

test('抽检照片与报告同事务，瑕疵只进入对应SKU且移动库存守恒',async()=>withStorage(async(memory)=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'qc-source'),[a,b]=row.lines!
  await markPmsMaterialPurchaseOrdersPlaced([row.purchaseOrderNo],PMS_BUYER_ACTOR,'qc-placed')
  const records=await batchAddPmsMaterialLogistics([{...shipping(row,a.lineId,10,'A'),actualPurchasedQty:10},{...shipping(row,b.lineId,20,'B'),actualPurchasedQty:20}],'add',PMS_BUYER_ACTOR,'qc-shipping')
  const qa={purchaseLineId:a.lineId,sampleQty:3,qualifiedQty:2,defectQty:1,reason:'实物破洞',warehouse:'瑕疵仓',inspector:'本地质检员',conclusion:'部分合格' as const,remark:'仅此SKU',photoFiles:[new File(['qa-bytes'],'抽检.png',{type:'image/png'})]}
  memory.setFailWrites(true);const before=structuredClone(getPmsMaterialPurchaseOrder(row.purchaseOrderNo))
  await assert.rejects(inspectPmsMaterialPurchaseOrder(row.purchaseOrderNo,qa,PMS_BUYER_ACTOR,'qc-photo-abort'))
  assert.deepEqual(getPmsMaterialPurchaseOrder(row.purchaseOrderNo),before);assert.equal((await pmsAll(PMS_STORES.pmsAttachments)).length,0)
  memory.setFailWrites(false)
  await inspectPmsMaterialPurchaseOrder(row.purchaseOrderNo,qa,PMS_BUYER_ACTOR,'qc-photo-success')
  const report=getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.inspections![0]
  assert.equal(report.conclusion,'部分合格');assert.equal(report.photoFileIds!.length,1);assert.equal((report as any).photoFiles,undefined)
  const file=await pmsGet<any>(PMS_STORES.pmsAttachments,report.photoFileIds![0]);assert.equal(await file.blob.text(),'qa-bytes')
  await inboundPmsMaterialPurchaseLogistics(records.map(record=>({recordNo:record.recordNo,quantity:record.qty,warehouse:'正常仓'})),PMS_BUYER_ACTOR,'qc-inbound')
  const stock=()=>listPmsMaterialPurchaseInventoryPostings().filter(posting=>posting.sourcePurchaseOrderNo===row.purchaseOrderNo)
  assert.equal(stock().filter(posting=>posting.quality==='瑕疵').reduce((sum,posting)=>sum+posting.qty,0),1)
  assert.equal(stock().find(posting=>posting.materialCode===b.materialCode)!.quality,'正常')
  await disposePmsMaterialPurchaseDefects(row.purchaseOrderNo,{purchaseLineId:b.lineId,defectQty:2,defectRolls:1,warehouseRolls:1,moveToDefectWarehouse:true,warehouse:'瑕疵仓',remark:'本次确认2件瑕疵'},PMS_BUYER_ACTOR,'defect-move')
  assert.equal(stock().reduce((sum,posting)=>sum+posting.qty,0),30);assert.equal(stock().filter(posting=>posting.materialCode===b.materialCode&&posting.quality==='瑕疵').reduce((sum,posting)=>sum+posting.qty,0),2)
}))

test('转运凭证多图片与单份日期费用共同保存，失败不留下附件或凭证事实',async()=>withStorage(async(memory)=>{
  const row=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'voucher-source'),files=[new File(['one'],'转运1.png',{type:'image/png'}),new File(['two'],'转运2.jpg',{type:'image/jpeg'})]
  memory.setFailWrites(true)
  await assert.rejects(addPmsMaterialPurchaseAttachments(row.purchaseOrderNo,files,'物流凭证',PMS_BUYER_ACTOR,'voucher-abort',{transferDate:'2026-10-14',transferFee:20}))
  assert.equal((await pmsAll(PMS_STORES.pmsAttachments)).length,0);assert.equal(getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.transferVouchers,undefined)
  memory.setFailWrites(false)
  await addPmsMaterialPurchaseAttachments(row.purchaseOrderNo,files,'物流凭证',PMS_BUYER_ACTOR,'voucher-success',{transferDate:'2026-10-14',transferFee:20})
  await addPmsMaterialPurchaseAttachments(row.purchaseOrderNo,files,'物流凭证',PMS_BUYER_ACTOR,'voucher-success',{transferDate:'2026-10-14',transferFee:20})
  const saved=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
  assert.equal(saved!.transferVouchers!.length,1);assert.equal(saved!.transferVouchers![0].transferFee,20);assert.equal(saved!.transferVouchers![0].fileIds.length,2)
  assert.equal((await pmsAll(PMS_STORES.pmsAttachments)).length,2);assert.equal(pmsMaterialPurchaseOrderAmount(saved!),80)
}))

test('实采下限包含本SKU全部装运及补录，不混入相邻SKU单位，删除后可按实际余量修改',async()=>withStorage(async()=>{
  const draft=input();draft.kind='原料';draft.lines=[{materialCode:fabric[0].materialCode,quantity:100,unitPrice:2},{materialCode:fabric.find(reference=>reference.unit!==fabric[0].unit)!.materialCode,quantity:300,unitPrice:3}]
  const order=await createPmsMaterialPurchaseOrder(draft,PMS_BUYER_ACTOR,'actual-shipping-floor'),[a,b]=order.lines!
  await markPmsMaterialPurchaseOrdersPlaced([order.purchaseOrderNo],PMS_BUYER_ACTOR,'actual-shipping-floor-placed')
  await batchAddPmsMaterialLogistics([{...shipping(order,a.lineId,80,'A'),actualPurchasedQty:100},{...shipping(order,b.lineId,200,'B'),actualPurchasedQty:300}],'add',PMS_BUYER_ACTOR,'actual-shipping-floor-add')
  const [supplement]=await batchAddPmsMaterialLogistics([shipping(order,a.lineId,20,'A')],'supplement',PMS_BUYER_ACTOR,'actual-shipping-floor-supplement')
  const before=structuredClone(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)),logs=structuredClone(listPmsLogs('material-purchase-order',order.purchaseOrderNo)),logistics=structuredClone(listPmsMaterialLogisticsRecords())
  await assert.rejects(recordPmsMaterialPurchaseQuantities(order.purchaseOrderNo,'actualPurchased',[{lineId:a.lineId,quantity:80}],PMS_BUYER_ACTOR,'actual-shipping-floor-reduce'),/装运/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo),before)
  assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo),before)
  assert.deepEqual(listPmsLogs('material-purchase-order',order.purchaseOrderNo),logs);assert.deepEqual(listPmsMaterialLogisticsRecords(),logistics)
  await recordPmsMaterialPurchaseQuantities(order.purchaseOrderNo,'actualPurchased',[{lineId:a.lineId,quantity:100},{lineId:b.lineId,quantity:200}],PMS_BUYER_ACTOR,'actual-shipping-floor-units')
  assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.lines!.map(line=>[line.unit,line.actualPurchasedQty]),[['Yard',100],['M',200]])
  await deletePmsMaterialLogistics(supplement.recordNo,PMS_BUYER_ACTOR,'actual-shipping-floor-delete')
  await recordPmsMaterialPurchaseQuantities(order.purchaseOrderNo,'actualPurchased',[{lineId:a.lineId,quantity:80}],PMS_BUYER_ACTOR,'actual-shipping-floor-after-delete')
  assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.lines![0].actualPurchasedQty,80)
}))

test('批量SKU实采修改任一行低于累计装运，前面已准备的修改也不写入',async()=>withStorage(async()=>{
  const order=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'actual-shipping-batch'),[a,b]=order.lines!
  await markPmsMaterialPurchaseOrdersPlaced([order.purchaseOrderNo],PMS_BUYER_ACTOR,'actual-shipping-batch-placed')
  await batchAddPmsMaterialLogistics([{...shipping(order,a.lineId,10,'A'),actualPurchasedQty:10},{...shipping(order,b.lineId,20,'B'),actualPurchasedQty:20}],'add',PMS_BUYER_ACTOR,'actual-shipping-batch-add')
  const before=structuredClone(getPmsMaterialPurchaseOrder(order.purchaseOrderNo))
  await assert.rejects(recordPmsMaterialPurchaseQuantities(order.purchaseOrderNo,'actualPurchased',[{lineId:a.lineId,quantity:12},{lineId:b.lineId,quantity:19}],PMS_BUYER_ACTOR,'actual-shipping-batch-invalid'),/装运/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo),before)
  assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo),before)
}))

test('新建SKU重量体积共同保存，非法值不生成采购单',async()=>withStorage(async()=>{
  const draft=input();draft.lines=draft.lines!.map((line,index)=>({...line,weightKg:index?0.35:0.2,volumeM3:index?0.002:0.001}))
  const row=await createPmsMaterialPurchaseOrder(draft,PMS_BUYER_ACTOR,'new-dimensions')
  const stored=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
  assert.deepEqual(stored!.lines!.map(line=>[line.weightKg,line.volumeM3]),[[0.2,0.001],[0.35,0.002]])
  for(const value of [-1,Number.POSITIVE_INFINITY,Number.NaN]){
    const invalid=input();invalid.lines![0].weightKg=value
    await assert.rejects(createPmsMaterialPurchaseOrder(invalid,PMS_BUYER_ACTOR,`invalid-weight-${String(value)}`),/重量和体积/)
    invalid.lines![0].weightKg=0.2;invalid.lines![1].volumeM3=value
    await assert.rejects(createPmsMaterialPurchaseOrder(invalid,PMS_BUYER_ACTOR,`invalid-volume-${String(value)}`),/重量和体积/)
  }
  assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length,1)
}))

test('PCS及TMF通用附件增删阻断，事务失败前不污染外部草稿或留下Blob',async()=>withStorage(async(memory)=>{
  const base=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'attachment-owner-source'),fileId='ATTACHMENT-OWNER-ORIGINAL',blob=new File(['source-bytes'],'原附件.png',{type:'image/png'})
  const originalAttachment={fileId,name:blob.name,type:blob.type,size:blob.size,category:'物流凭证' as const}
  const fixtures:PmsMaterialPurchaseOrder[]=[
    {...structuredClone(base),purchaseOrderNo:'PCS-ATTACHMENT-GUARD',status:'草稿',attachments:[originalAttachment],pcsSource:{source:'PCS_MATERIAL_SKU',materialId:'source',materialSkuId:'sku',materialSkuCode:'code',returnPath:'/pcs/materials',mainUnit:'Yard',mainUnitVersion:1,purchaseUnit:'Yard',mainQtyPerPurchaseUnit:1,relationId:null,relationVersion:null,basis:'主单位',capturedAt:'2026-10-14'},_pmsBaseVersion:0},
    {...structuredClone(base),purchaseOrderNo:'TMF-ATTACHMENT-GUARD',attachments:[originalAttachment],tmfTipSource:{demandId:'demand',materialBomItemId:'bom',productionOrderNo:'production',snapshotId:'snapshot',versionId:'version',operationId:'tmf-origin',signature:'origin'},_pmsBaseVersion:0},
  ]
  await pmsCommitRecords(fixtures.map(value=>({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value})),{operationId:'attachment-owner-fixtures',attachments:[{id:fileId,name:blob.name,type:blob.type,size:blob.size,blob}],attachmentReferences:fixtures.map(order=>({store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,key:order.purchaseOrderNo,fileIds:[fileId]}))})
  resetPmsMaterialPurchaseRuntimeForTest();await hydratePmsMaterialPurchaseOrdersFromIdb()
  memory.setFailWrites(true)
  const extra=new File(['must-not-store'],'新附件.png',{type:'image/png'})
  for(const fixture of fixtures){
    const before=structuredClone(getPmsMaterialPurchaseOrder(fixture.purchaseOrderNo))
    await assert.rejects(addPmsMaterialPurchaseAttachment(fixture.purchaseOrderNo,extra,'物流凭证',PMS_BUYER_ACTOR,`single-${fixture.purchaseOrderNo}`),/专项来源/)
    await assert.rejects(addPmsMaterialPurchaseAttachments(fixture.purchaseOrderNo,[extra,extra],'物流凭证',PMS_BUYER_ACTOR,`multi-${fixture.purchaseOrderNo}`,{transferDate:'2026-10-14',transferFee:5}),/专项来源/)
    await assert.rejects(removePmsMaterialPurchaseAttachment(fixture.purchaseOrderNo,fileId,PMS_BUYER_ACTOR,`remove-${fixture.purchaseOrderNo}`),/专项来源/)
    assert.deepEqual(getPmsMaterialPurchaseOrder(fixture.purchaseOrderNo),before)
    assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,fixture.purchaseOrderNo),before)
  }
  assert.equal((await pmsAll(PMS_STORES.pmsAttachments)).length,1);assert.equal(await (await pmsGet<any>(PMS_STORES.pmsAttachments,fileId)).blob.text(),'source-bytes')
  await assert.rejects(removePmsMaterialPurchaseAttachment(base.purchaseOrderNo,fileId,{...PMS_BUYER_ACTOR,id:''},'invalid-attachment-actor'),/当前角色/)
}))

test('普通采购已入库后仅专用价格可修改，不改变数量、库存或履约状态',async()=>withStorage(async()=>{
  const order=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'inbound-price-source'),[a,b]=order.lines!
  await markPmsMaterialPurchaseOrdersPlaced([order.purchaseOrderNo],PMS_BUYER_ACTOR,'inbound-price-placed')
  const records=await batchAddPmsMaterialLogistics([{...shipping(order,a.lineId,10,'A'),actualPurchasedQty:10},{...shipping(order,b.lineId,20,'B'),actualPurchasedQty:20}],'add',PMS_BUYER_ACTOR,'inbound-price-logistics')
  await inboundPmsMaterialPurchaseLogistics(records.map(record=>({recordNo:record.recordNo,quantity:record.qty,warehouse:'正常仓'})),PMS_BUYER_ACTOR,'inbound-price-receipt')
  const before=structuredClone(getPmsMaterialPurchaseOrder(order.purchaseOrderNo))!,postings=structuredClone(listPmsMaterialPurchaseInventoryPostings()),logistics=structuredClone(listPmsMaterialLogisticsRecords())
  await confirmPmsMaterialPurchasePrices(order.purchaseOrderNo,[{lineId:a.lineId,unitPrice:4}],PMS_BUYER_ACTOR,'inbound-price-single')
  await batchConfirmPmsMaterialPurchasePrices([{orderNo:order.purchaseOrderNo,prices:[{lineId:b.lineId,unitPrice:5}]}],PMS_BUYER_ACTOR,'inbound-price-batch')
  const after=getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!
  assert.equal(after.status,'已入库');assert.equal(after.priceConfirmed,true)
  assert.deepEqual(after.lines!.map(line=>[line.orderedQty,line.actualPurchasedQty,line.sellerReceivedQty,line.inboundQty]),before.lines!.map(line=>[line.orderedQty,line.actualPurchasedQty,line.sellerReceivedQty,line.inboundQty]))
  assert.deepEqual(listPmsMaterialPurchaseInventoryPostings(),postings);assert.deepEqual(listPmsMaterialLogisticsRecords(),logistics)
  assert.equal(pmsMaterialPurchaseOrderAmount(after,'actual'),140)
  await assert.rejects(updatePmsMaterialPurchaseLines(order.purchaseOrderNo,[{lineId:a.lineId,orderedQty:11}],PMS_BUYER_ACTOR,'inbound-price-do-not-unlock-quantity'),/不允许此操作/)
}))

test('物流编辑同次提高实采与装运先用候选实采校验，非法合计不半套修改',async()=>withStorage(async()=>{
  const order=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'logistics-edit-source'),a=order.lines![0]
  const [record]=await batchAddPmsMaterialLogistics([{...shipping(order,a.lineId,10,'EDIT'),actualPurchasedQty:10}],'add',PMS_BUYER_ACTOR,'logistics-edit-add')
  await updatePmsMaterialLogistics(record.recordNo,{...shipping(order,a.lineId,12,'EDIT'),actualPurchasedQty:12},PMS_BUYER_ACTOR,'logistics-edit-grow')
  assert.equal(getPmsMaterialLogisticsRecord(record.recordNo)!.qty,12);assert.equal(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)!.lines![0].actualPurchasedQty,12)
  await batchAddPmsMaterialLogistics([{...shipping(order,a.lineId,2,'SUP'),actualPurchasedQty:14}],'supplement',PMS_BUYER_ACTOR,'logistics-edit-supplement')
  const before=structuredClone(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)),logistics=structuredClone(listPmsMaterialLogisticsRecords())
  await assert.rejects(updatePmsMaterialLogistics(record.recordNo,{...shipping(order,a.lineId,15,'EDIT'),actualPurchasedQty:15},PMS_BUYER_ACTOR,'logistics-edit-bad-total'),/累计物流数量/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo),before);assert.deepEqual(listPmsMaterialLogisticsRecords(),logistics)
}))

test('抽检结论与选中SKU合格瑕疵数量矛盾时不保存报告',async()=>withStorage(async()=>{
  const order=await createPmsMaterialPurchaseOrder(input(),PMS_BUYER_ACTOR,'qc-conclusion-source'),a=order.lines![0]
  await markPmsMaterialPurchaseOrdersPlaced([order.purchaseOrderNo],PMS_BUYER_ACTOR,'qc-conclusion-place')
  await batchAddPmsMaterialLogistics([{...shipping(order,a.lineId,10,'QC'),actualPurchasedQty:10}],'add',PMS_BUYER_ACTOR,'qc-conclusion-source-log')
  const before=structuredClone(getPmsMaterialPurchaseOrder(order.purchaseOrderNo)),base={purchaseLineId:a.lineId,sampleQty:3,qualifiedQty:2,defectQty:1,reason:'实物差异',warehouse:'瑕疵仓',inspector:'质检员'}
  await assert.rejects(inspectPmsMaterialPurchaseOrder(order.purchaseOrderNo,{...base,conclusion:'合格'},PMS_BUYER_ACTOR,'qc-wrong-pass'),/结论与/)
  await assert.rejects(inspectPmsMaterialPurchaseOrder(order.purchaseOrderNo,{...base,conclusion:'不合格'},PMS_BUYER_ACTOR,'qc-wrong-fail'),/结论与/)
  await assert.rejects(inspectPmsMaterialPurchaseOrder(order.purchaseOrderNo,{...base,qualifiedQty:3,defectQty:0,conclusion:'部分合格'},PMS_BUYER_ACTOR,'qc-wrong-partial'),/结论与/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(order.purchaseOrderNo),before)
}))
