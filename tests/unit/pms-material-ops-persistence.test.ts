import assert from 'node:assert/strict'
import test from 'node:test'
import { listPmsKolStock, lockPmsKolStockBatch, releasePmsKolLock, generatePmsKolLinkCode } from '../../src/data/pms/kol-sample-stock.ts'
import { listPmsKolLinks } from '../../src/data/pms/kol-sample-link.ts'
import { listPmsKolApply } from '../../src/data/pms/kol-sample-apply.ts'
import { listPmsKolLockLog } from '../../src/data/pms/kol-sample-stock-lock-log.ts'
import { getPmsPaymentRequest, submitPmsPaymentRequest, addPmsPaymentAttachment } from '../../src/data/pms/payment-requests.ts'
import { listPmsMaterialPurchaseOrders, pushPmsMaterialRequirement, importPmsMaterialLogistics, listPmsMaterialLogisticsRecords } from '../../src/data/pms/material-purchase-orders.ts'
import { listPmsMaterialRequirements } from '../../src/data/pms/material-requirements.ts'
import { createPmsFirstLegBatch, listPmsFirstLegBatches, listPmsFirstLegCarriers, listPmsFirstLegChannels } from '../../src/data/pms/first-leg-logistics.ts'
import { listPmsLogs, PMS_BUYER_ACTOR } from '../../src/data/pms/runtime.ts'
import { spawnSync } from 'node:child_process'
import { buildPmsCsv } from '../../src/utils/pms-export.ts'

const unavailable = /IndexedDB|存储|数据库/

test('KOL 固定演示 SKU 使用现有商品档案的编号和对象图片', () => {
  const stock=listPmsKolStock()
  assert.equal(stock.length,20)
  assert.ok(stock.every(row=>row.sku && row.spu && row.imageUrl && row.lockedOccupied<=row.vkolManualLockedPool && row.vkolManualLockedPool<=row.kolStock))
  assert.equal(listPmsKolApply().length,6)
  assert.equal(listPmsKolLinks().length,6)
})

test('KOL 存储不可用时锁定、释放及生成链接都不发布内存或日志', async () => {
  const before=structuredClone(listPmsKolStock()),logs=structuredClone(listPmsKolLockLog()),links=structuredClone(listPmsKolLinks())
  await assert.rejects(lockPmsKolStockBatch([{sku:before[0].sku,qty:5}],'lock-save-failure'),unavailable)
  await assert.rejects(releasePmsKolLock([before[0].sku],'release-save-failure'),unavailable)
  await assert.rejects(generatePmsKolLinkCode([before[0].sku],{operationId:'link-save-failure'}),unavailable)
  assert.deepEqual(listPmsKolStock(),before);assert.deepEqual(listPmsKolLockLog(),logs);assert.deepEqual(listPmsKolLinks(),links)
})

test('请款失败保留原累计金额、状态、记录和附件', async () => {
  const request=getPmsPaymentRequest('PAY-M-2026-0004')!,before=structuredClone(request),logs=listPmsLogs('payment-request',request.requestNo).length
  await assert.rejects(submitPmsPaymentRequest(request.requestNo,200,PMS_BUYER_ACTOR,'首次请款','2026-10-13','payment-save-failure'),unavailable)
  await assert.rejects(addPmsPaymentAttachment(request.requestNo,new File(['receipt'],'付款回单.pdf',{type:'application/pdf'}),PMS_BUYER_ACTOR,'凭证','attachment-save-failure'),unavailable)
  assert.deepEqual(request,before);assert.equal(listPmsLogs('payment-request',request.requestNo).length,logs)
})

test('需求下推和快递导入在存储不可用时不生成采购记录或改变来源', async () => {
  const requirements=structuredClone(listPmsMaterialRequirements()),orders=structuredClone(listPmsMaterialPurchaseOrders()),logistics=structuredClone(listPmsMaterialLogisticsRecords())
  await assert.rejects(pushPmsMaterialRequirement(requirements[0].requirementNo,[{lineNo:requirements[0].lines[0].lineNo,actualQty:1,unitPrice:1}],PMS_BUYER_ACTOR,'push-save-failure'),unavailable)
  await assert.rejects(importPmsMaterialLogistics([{purchaseOrderNo:'CGF-2026-0001',company:'顺丰',trackingNo:'SF-FAIL',shipDate:'2026-10-13',estimatedArrival:'2026-10-14',boxCount:1,rolls:1,qty:1,fee:1,remark:''}],PMS_BUYER_ACTOR,'import-save-failure'),unavailable)
  assert.deepEqual(listPmsMaterialRequirements(),requirements);assert.deepEqual(listPmsMaterialPurchaseOrders(),orders);assert.deepEqual(listPmsMaterialLogisticsRecords(),logistics)
})

test('新建空货运批次保存失败不产生主单、相邻物流或操作事实', async () => {
  const before=structuredClone(listPmsFirstLegBatches()),carrier=listPmsFirstLegCarriers()[0],channel=listPmsFirstLegChannels().find(row=>row.carrierId===carrier.carrierCode)!
  const logistics=structuredClone(listPmsMaterialLogisticsRecords()),logs=listPmsLogs('first-leg-batch').length
  await assert.rejects(createPmsFirstLegBatch({batchNo:'FL-FAIL',batchName:'失败检查',carrierId:carrier.carrierCode,channelId:channel.channelCode,transferCenter:'',destinationWarehouse:'',plannedShipDate:'2026-10-13',fee:0,remark:'',allocations:[]},PMS_BUYER_ACTOR,'first-leg-save-failure'),unavailable)
  assert.deepEqual(listPmsFirstLegBatches(),before);assert.deepEqual(listPmsMaterialLogisticsRecords(),logistics);assert.equal(listPmsLogs('first-leg-batch').length,logs)
})

// These contracts use a narrow transaction fixture. Browser save/readback remains a separate gate.
import {installPmsMemoryIdb} from '../helpers/pms-memory-idb.ts'
import {pmsGet,PMS_STORES} from '../../src/data/pms/idb-storage.ts'
import {resetPmsMaterialPurchaseRuntimeForTest,advancePmsMaterialPurchaseOrderStatus,registerPmsMaterialPurchaseArrival,inspectPmsMaterialPurchaseOrder,listPmsMaterialPurchaseInventoryPostings,getPmsMaterialPurchaseOrder,registerAndInboundPmsMaterialPurchases,saveMpoDetailBarcodes,createPmsMaterialPurchaseOrder,copyPmsMaterialPurchaseOrder,type PmsMaterialPurchaseOrder} from '../../src/data/pms/material-purchase-orders.ts'

test('修改状态不能把采购计划当实到；正常与瑕疵入库守恒并可持久回读',async()=>{
 const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{
  const order=getPmsMaterialPurchaseOrder('CGF-2026-0001')!,qty=order.orderedQty
  await assert.rejects(advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo,'已到货',PMS_BUYER_ACTOR,'no-arrival-fact'),/累计实到数量/)
  assert.equal(order.receivedQty,0)
  await registerPmsMaterialPurchaseArrival(order.purchaseOrderNo,qty,PMS_BUYER_ACTOR,'arrival-fact')
  await inspectPmsMaterialPurchaseOrder(order.purchaseOrderNo,{sampleQty:3,qualifiedQty:2,defectQty:1,reason:'已观察到破损',warehouse:'本地瑕疵仓',inspector:'本地质检员'},PMS_BUYER_ACTOR,'qc-fact')
  await advancePmsMaterialPurchaseOrderStatus(order.purchaseOrderNo,'已入库',PMS_BUYER_ACTOR,'inbound-fact')
  const saved=await pmsGet<any>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,order.purchaseOrderNo)
  assert.equal(getPmsRequirementMaterialBalance(order.materialCode,order.unit).stockQty,qty-1);assert.equal(saved.defectInventoryPosting.quality,'瑕疵');assert.equal(saved.status,'已入库');assert.equal(saved.inventoryPosting.qty,qty-1);assert.equal(saved.defectInventoryPosting.qty,1)
  assert.equal(listPmsMaterialPurchaseInventoryPostings().filter(row=>row.sourcePurchaseOrderNo===order.purchaseOrderNo).reduce((sum,row)=>sum+row.qty,0),qty)
 }finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}
})

// Separate Node processes recreate the actual fresh-module condition: records exist in IDB,
// but neither the new parent nor a saved edit has been published into the product runtime.
function verifyFreshRequirementPush(parentKind:'new'|'edited', abort = false, batch = false): void {
 const moduleUrl=(path:string)=>new URL(path,import.meta.url).href
 const script=`
 import assert from 'node:assert/strict';
 const {installPmsMemoryIdb}=await import(${JSON.stringify(moduleUrl('../helpers/pms-memory-idb.ts'))});
 const {pmsCommitRecords,pmsGet,pmsAll,PMS_STORES}=await import(${JSON.stringify(moduleUrl('../../src/data/pms/idb-storage.ts'))});
 const {getPmsProductPurchaseOrder}=await import(${JSON.stringify(moduleUrl('../../src/data/pms/product-purchase-orders.ts'))});
 const {getPmsMaterialRequirement}=await import(${JSON.stringify(moduleUrl('../../src/data/pms/material-requirements.ts'))});
 const {pushPmsMaterialRequirement,batchPushPmsMaterialRequirements}=await import(${JSON.stringify(moduleUrl('../../src/data/pms/material-purchase-orders.ts'))});
 const {PMS_BUYER_ACTOR}=await import(${JSON.stringify(moduleUrl('../../src/data/pms/runtime.ts'))});
 const memory=installPmsMemoryIdb();
 try {
  const parentKind=${JSON.stringify(parentKind)},abort=${abort},batch=${batch};
  const parent=structuredClone(getPmsProductPurchaseOrder('CG-2026-0018'));
  parent.purchaseOrderNo=parentKind==='new'?'CG-LOCAL-FRESH-PARENT':'CG-2026-0018';
  parent.lines.forEach((line,index)=>{line.lineId=parent.purchaseOrderNo+'-L'+index;line.needBom=true;line.materialStatus='已生成'});
  parent.remark='持久父单第一版';parent._pmsBaseVersion=0;
  await pmsCommitRecords([{store:PMS_STORES.pmsProductPurchaseOrders,value:parent}],{operationId:'seed-parent'});
  if(parentKind==='edited'){
   const edited=structuredClone(parent);edited.remark='持久父单已修改，必须保留';edited.version+=1;
   await pmsCommitRecords([{store:PMS_STORES.pmsProductPurchaseOrders,value:edited}],{operationId:'seed-edited-parent'});
  }
  const durableParent=await pmsGet(PMS_STORES.pmsProductPurchaseOrders,parent.purchaseOrderNo);
  if(parentKind==='new')assert.equal(getPmsProductPurchaseOrder(parent.purchaseOrderNo),undefined);
  else assert.notEqual(getPmsProductPurchaseOrder(parent.purchaseOrderNo).remark,durableParent.remark);
  const requirement=structuredClone(getPmsMaterialRequirement('MREQ-0001'));
  requirement.requirementNo='MREQ-FRESH-'+parentKind;requirement.sourcePurchaseOrderNo=parent.purchaseOrderNo;
  requirement.lines.forEach((line,index)=>{line.lineNo=requirement.requirementNo+'-'+index;line.pushStatus='待下推';line.generatedPurchaseOrderNo=''});
  requirement._pmsBaseVersion=0;
  await pmsCommitRecords([{store:PMS_STORES.pmsMaterialRequirements,value:requirement}],{operationId:'seed-fresh-requirement'});
  const beforeRequirement=await pmsGet(PMS_STORES.pmsMaterialRequirements,requirement.requirementNo);
  const inputs=requirement.lines.filter(line=>line.suggestedQty>0).map(line=>({lineNo:line.lineNo,actualQty:1,unitPrice:2}));
  memory.setFailWrites(abort);
  const save=()=>batch?batchPushPmsMaterialRequirements([{requirementNo:requirement.requirementNo,lines:inputs}],PMS_BUYER_ACTOR,'fresh-push'):pushPmsMaterialRequirement(requirement.requirementNo,inputs,PMS_BUYER_ACTOR,'fresh-push');
  if(abort){
   await assert.rejects(save());
   assert.deepEqual(await pmsGet(PMS_STORES.pmsProductPurchaseOrders,parent.purchaseOrderNo),durableParent);
   assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialRequirements,requirement.requirementNo),beforeRequirement);
   assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length,0);
   assert.equal(getPmsProductPurchaseOrder(parent.purchaseOrderNo).lines.every(line=>line.materialStatus==='已生成'),true);
   console.log(JSON.stringify({parentKind,batch,abort,atomicUnchanged:true}));
  }else{
   const created=await save();
   const savedParent=await pmsGet(PMS_STORES.pmsProductPurchaseOrders,parent.purchaseOrderNo);
   assert.equal(savedParent.remark,durableParent.remark);assert.equal(savedParent.version,durableParent.version);
   assert.equal(savedParent._pmsBaseVersion,durableParent._pmsBaseVersion+1);
   assert.equal(savedParent.lines.every(line=>line.materialStatus==='已下推'),true);
   assert.equal(getPmsProductPurchaseOrder(parent.purchaseOrderNo).lines.every(line=>line.materialStatus==='已下推'),true);
   assert.equal((await pmsGet(PMS_STORES.pmsMaterialRequirements,requirement.requirementNo)).status,'已下推');
   assert.equal((await pmsAll(PMS_STORES.pmsMaterialPurchaseOrderDeltas)).length,inputs.length);
   assert.equal(created.every(row=>row.sourceProductPurchaseOrderNo===parent.purchaseOrderNo),true);
   console.log(JSON.stringify({parentKind,batch,abort,parentStoredVersion:savedParent._pmsBaseVersion,remarkPreserved:true,materialStatus:'已下推',created:created.length}));
  }
 }finally{memory.restore()}
 `
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-'],{input:script,encoding:'utf8'})
 assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`)
 console.log(result.stdout.trim())
}
test('fresh MRA 直达下推会读取仅存在IDB的新父单，并同事务更新其物料状态',()=>verifyFreshRequirementPush('new'))
test('批量下推读取IDB已编辑静态父单版本，保留修改并避免版本0冲突',()=>verifyFreshRequirementPush('edited',false,true))
test('已编辑父单关联提交中止时，父单、需求和新物料采购单均不半套发布',()=>verifyFreshRequirementPush('edited',true))

test('新增USD和IDR采购保留原币单价与金额，独立IDB读取及CSV值不变',async()=>{
 const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{
  const saved:PmsMaterialPurchaseOrder[]=[]
  for(const currency of ['USD','IDR'] as const){
   const row=await createPmsMaterialPurchaseOrder({kind:'辅料',materialCode:'FLSZ26041134-blue',quantity:3,unitPrice:12.5,currency,supplierName:'本地核验供应方',purchaseRegion:'国内',warehouse:'本地核验仓',buyerName:'王采购',expectedArrivalDate:'',remark:'原币保存契约'},PMS_BUYER_ACTOR,'new-currency-'+currency)
   const durable=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,row.purchaseOrderNo)
   assert.equal(durable!.currency,currency);assert.equal(durable!.orderedQty,3);assert.equal(durable!.unitPrice,12.5)
   assert.equal(durable!.orderedQty*durable!.unitPrice,37.5);saved.push(durable!)
  }
  resetPmsMaterialPurchaseRuntimeForTest();await import('../../src/data/pms/material-purchase-orders.ts').then(module=>module.hydratePmsMaterialPurchaseOrdersFromIdb())
  assert.deepEqual(saved.map(row=>getPmsMaterialPurchaseOrder(row.purchaseOrderNo)!.currency),['USD','IDR'])
  const csv=buildPmsCsv(['采购单号','币种','采购数量','单价','金额'],saved.map(row=>[row.purchaseOrderNo,row.currency,row.orderedQty,row.unitPrice,(row.orderedQty*row.unitPrice).toFixed(2)]))
  assert.match(csv,/,USD,3,12\.5,37\.50/);assert.match(csv,/,IDR,3,12\.5,37\.50/);assert.doesNotMatch(csv,/,RMB,/)
 }finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}
})

test('驳回采购单复制后清除旧执行事实，新单可推进且来源与复制日志保留',async()=>{
 const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{
  const source={...structuredClone(getPmsMaterialPurchaseOrder('CGF-2026-0007')!),rejectedReason:'供应方无法完成旧单',closedReason:'旧单关闭原因',purchasedAt:'2026-06-11T09:00:00Z',arrivedAt:'2026-06-12T09:00:00Z',receivedQty:2,status:'部分到货' as const}
  const {pmsCommitRecords}=await import('../../src/data/pms/idb-storage.ts')
  await pmsCommitRecords([{store:PMS_STORES.pmsMaterialPurchaseOrderDeltas,value:source}],{operationId:'seed-rejected-copy-source'})
  const before=await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,source.purchaseOrderNo)
  const copy=await copyPmsMaterialPurchaseOrder(source.purchaseOrderNo,PMS_BUYER_ACTOR,'copy-rejected-source')
  assert.equal(copy.status,'待采购');assert.equal(copy.rejectedReason,'');assert.equal((copy as typeof source).closedReason,'')
  assert.equal(copy.purchasedAt,undefined);assert.equal(copy.arrivedAt,undefined);assert.equal(copy.receivedQty,0)
  await advancePmsMaterialPurchaseOrderStatus(copy.purchaseOrderNo,'已采购',PMS_BUYER_ACTOR,'advance-copied-order')
  const durable=await pmsGet<PmsMaterialPurchaseOrder>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,copy.purchaseOrderNo)
  assert.equal(durable!.status,'已采购');assert.ok(durable!.purchasedAt)
  assert.deepEqual(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,source.purchaseOrderNo),before)
  assert.ok(listPmsLogs('material-purchase-order',copy.purchaseOrderNo).some(log=>log.action==='复制采购单'&&log.beforeValue===source.purchaseOrderNo))
 }finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}
})

test('部分入库保持到货余量；新增实到后才能继续入库',async()=>{
 const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{
  const no='CGF-2026-0001'
  await registerPmsMaterialPurchaseArrival(no,2,PMS_BUYER_ACTOR,'partial-arrival')
  await advancePmsMaterialPurchaseOrderStatus(no,'已入库',PMS_BUYER_ACTOR,'partial-inbound')
  assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'部分到货');assert.equal(getPmsMaterialPurchaseOrder(no)!.inventoryPosting!.qty,2)
  await assert.rejects(advancePmsMaterialPurchaseOrderStatus(no,'已入库',PMS_BUYER_ACTOR,'partial-inbound-repeat'),/已经登记入库/)
  await assert.rejects(registerPmsMaterialPurchaseArrival(no,1,PMS_BUYER_ACTOR,'reduce-arrival'),/不能少于/)
  await registerPmsMaterialPurchaseArrival(no,4,PMS_BUYER_ACTOR,'partial-arrival-more');await advancePmsMaterialPurchaseOrderStatus(no,'已入库',PMS_BUYER_ACTOR,'partial-inbound-more')
  assert.equal((await pmsGet<any>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,no)).inventoryPosting.qty,4)
 }finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}
})

test('入库文件任一行错 SKU 或事务中止时整批不发布',async()=>{
 const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{
  const before=structuredClone(listPmsMaterialPurchaseOrders())
  const rows=[{purchaseOrderNo:'CGF-2026-0001',materialCode:before.find(row=>row.purchaseOrderNo==='CGF-2026-0001')!.materialCode,quantity:1},{purchaseOrderNo:'CGF-2026-0004',materialCode:'错误SKU',quantity:1}]
  await assert.rejects(registerAndInboundPmsMaterialPurchases(rows,PMS_BUYER_ACTOR,'wrong-sku-batch'),/SKU/);assert.deepEqual(listPmsMaterialPurchaseOrders(),before)
  rows[1].materialCode=before.find(row=>row.purchaseOrderNo==='CGF-2026-0004')!.materialCode;memory.setFailWrites(true)
  await assert.rejects(registerAndInboundPmsMaterialPurchases(rows,PMS_BUYER_ACTOR,'aborted-batch'));assert.deepEqual(listPmsMaterialPurchaseOrders(),before)
  assert.equal(await pmsGet(PMS_STORES.pmsMaterialPurchaseOrderDeltas,'CGF-2026-0001'),undefined)
 }finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}
})

test('条码下架记录目标区域并阻断覆盖搬移或恢复有效',async()=>{
 const memory=installPmsMemoryIdb();resetPmsMaterialPurchaseRuntimeForTest();try{
  const no='CGF-2026-0007',rows=structuredClone(getPmsMaterialPurchaseOrder(no)!.detailBarcodes!)
  rows[0]={...rows[0],status:'已下架',targetArea:'待出库区',movedAt:'2026-10-13T08:00:00Z',movedBy:'本地仓管'}
  await saveMpoDetailBarcodes(no,rows,PMS_BUYER_ACTOR,'barcode-local-move')
  const saved=await pmsGet<any>(PMS_STORES.pmsMaterialPurchaseOrderDeltas,no);assert.equal(saved.detailBarcodes[0].targetArea,'待出库区')
  const invalid=structuredClone(rows);invalid[0].status='有效';await assert.rejects(saveMpoDetailBarcodes(no,invalid,PMS_BUYER_ACTOR,'barcode-invalid-restore'),/不能覆盖或恢复/)
  assert.equal(getPmsMaterialPurchaseOrder(no)!.detailBarcodes![0].status,'已下架')
 }finally{memory.restore();resetPmsMaterialPurchaseRuntimeForTest()}
})

import {getPmsRequirementMaterialBalance} from '../../src/data/pms/material-requirements.ts'

import {resetPmsFirstLegRuntimeForTest,savePmsFirstLegBox,movePmsFirstLegBoxItem,sealOrDeletePmsFirstLegBox,getPmsFirstLegBatch} from '../../src/data/pms/first-leg-logistics.ts'
test('货箱换箱保量并事务回读，超量或封箱后修改阻断',async()=>{
 const memory=installPmsMemoryIdb();resetPmsFirstLegRuntimeForTest();resetPmsMaterialPurchaseRuntimeForTest();try{
  const no='FL-DEMO-4',item={code:'MAT-YN-00000001-B01',name:'针织棉纱',imageUrl:'/materials/process-orders/cotton-yarn-cone.jpg',qty:3,unit:'KG'}
  const base={cargoType:'辅料货箱' as const,weightKg:3,lengthCm:10,widthCm:20,heightCm:30,remark:'本地事务契约',sealed:false}
  await savePmsFirstLegBox(no,{...base,boxNo:'BOX-A',items:[item]},'',PMS_BUYER_ACTOR,'box-a')
  await savePmsFirstLegBox(no,{...base,boxNo:'BOX-B',items:[]},'',PMS_BUYER_ACTOR,'box-b')
  await assert.rejects(movePmsFirstLegBoxItem(no,'BOX-A',item.code,'BOX-B',4,PMS_BUYER_ACTOR,'box-over'),/可换箱 3/)
  await movePmsFirstLegBoxItem(no,'BOX-A',item.code,'BOX-B',1,PMS_BUYER_ACTOR,'box-transfer')
  const saved=await pmsGet<any>(PMS_STORES.pmsFirstLegBatches,no);assert.equal(saved.boxes.flatMap((box:any)=>box.items).reduce((sum:number,row:any)=>sum+row.qty,0),3)
  assert.equal(saved.boxes[0].items[0].qty,2);assert.equal(saved.boxes[1].items[0].qty,1)
  await sealOrDeletePmsFirstLegBox(no,'BOX-A','seal',PMS_BUYER_ACTOR,'box-seal')
  await assert.rejects(savePmsFirstLegBox(no,{...base,boxNo:'BOX-A',items:[item]},'BOX-A',PMS_BUYER_ACTOR,'box-closed-edit'),/已封箱/)
  assert.equal(getPmsFirstLegBatch(no)!.boxes![0].sealed,true)
 }finally{memory.restore();resetPmsFirstLegRuntimeForTest();resetPmsMaterialPurchaseRuntimeForTest()}
})
