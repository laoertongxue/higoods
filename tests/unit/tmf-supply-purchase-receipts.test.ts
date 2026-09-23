import assert from 'node:assert/strict'
import test from 'node:test'
import { getPmsMaterialPurchaseOrder, listPmsMaterialPurchaseOrders, PMS_MATERIAL_PURCHASE_UPDATES_KEY, applyPmsSupplierConfirmation, advancePmsMaterialPurchaseOrderStatus, registerPmsMaterialPurchaseArrival, closePmsMaterialPurchaseOrder, resetPmsMaterialPurchaseRuntimeForTest } from '../../src/data/pms/material-purchase-orders.ts'
import { PMS_BUYER_ACTOR } from '../../src/data/pms/runtime.ts'
import { receiveTmfSupplyPurchase, getTmfPurchaseState, reloadTmfPurchaseRuntime, acceptTmfBaseOrder, dispatchTmfBaseMaterial, receiveTmfBaseMaterial, consumeTmfBaseMaterial, dispatchTmfBaseMaterialReturn, receiveTmfBaseMaterialReturn, getTmfBaseMaterialBalance } from '../../src/data/pms/tmf-material-purchases.ts'
import { ensureTmfConnectedMockData, TMF_DEMO_SUPERVISOR as factory } from '../../src/data/fcs/tmf-base-demo.ts'
const warehouse={id:'SUPPLY-WH',name:'原料仓管',role:'仓管' as const}

test('PMS采购实际仓库实收与原料库存一次保存；分批、刷新、原料使用和退回均不重复履约',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'window'),storage=new Map<string,string>();let fail=false
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw new Error('quota');storage.set(k,v)}}}})
 try{
  reloadTmfPurchaseRuntime();resetPmsMaterialPurchaseRuntimeForTest()
  const no='CGF-2026-0007',source=getPmsMaterialPurchaseOrder(no)!
  const input={receiptId:'SUPPLY-R1',purchaseOrderNo:no,purpose:'BASE_MATERIAL' as const,lotId:'SUPPLY-LOT1',scannedMaterialCode:source.materialCode,warehouse:source.warehouse,location:'Y-01',quantity:12}
  await assert.rejects(receiveTmfSupplyPurchase(input,warehouse,'supply-receive'),/已下达/)
  fail=true
  assert.throws(()=>advancePmsMaterialPurchaseOrderStatus(no,'已采购',PMS_BUYER_ACTOR),/未保存/)
  assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'待采购')
  fail=false
  advancePmsMaterialPurchaseOrderStatus(no,'已采购',PMS_BUYER_ACTOR)
  resetPmsMaterialPurchaseRuntimeForTest()
  assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'已采购')
  assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,0)
  const before=getTmfPurchaseState()
  await assert.rejects(receiveTmfSupplyPurchase({...input,scannedMaterialCode:'WRONG'},warehouse,'wrong-sku'),/编码/)
  await assert.rejects(receiveTmfSupplyPurchase({...input,warehouse:'WRONG'},warehouse,'wrong-wh'),/仓库/)
  fail=true;await assert.rejects(receiveTmfSupplyPurchase(input,warehouse,'supply-receive'),/未保存/)
  assert.deepEqual(getTmfPurchaseState(),before);assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,0)
  fail=false;await receiveTmfSupplyPurchase(input,warehouse,'supply-receive')
  const received=getTmfPurchaseState();await receiveTmfSupplyPurchase(input,warehouse,'supply-receive');assert.deepEqual(getTmfPurchaseState(),received)
  assert.equal(received.baseMaterialLots[0].receivedQty,12);assert.equal(received.baseMaterialLots[0].unit,'kg')
  assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,12)
  assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'部分到货')
  await assert.rejects(receiveTmfSupplyPurchase({...input,receiptId:'S-R2',lotId:'S-L2',purpose:'TIP_MATERIAL'},warehouse,'wrong-purpose'),/不能同时/)
  await assert.rejects(receiveTmfSupplyPurchase(input,warehouse,'different-operation'),/已登记/)
  assert.throws(()=>registerPmsMaterialPurchaseArrival(no,300,PMS_BUYER_ACTOR),/仓库实收/)
  assert.throws(()=>closePmsMaterialPurchaseOrder(no,'取消',PMS_BUYER_ACTOR),/仓库实收/)
  reloadTmfPurchaseRuntime();resetPmsMaterialPurchaseRuntimeForTest()
  assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,12)
  assert.equal(listPmsMaterialPurchaseOrders().filter(o=>o.purchaseOrderNo===no).length,1)
  await receiveTmfSupplyPurchase({...input,receiptId:'SUPPLY-R2',lotId:'SUPPLY-LOT2',quantity:288},warehouse,'supply-remainder')
  assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'已入库');assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,300)
  ensureTmfConnectedMockData()
  const base=getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo==='TMF-MOCK-PO-001')!
  acceptTmfBaseOrder(base.id,factory,'base-accept')
  dispatchTmfBaseMaterial({id:'SUPPLY-ISS',baseOrderId:base.id,lotId:'SUPPLY-LOT1',quantity:12},warehouse,'supply-issue')
  receiveTmfBaseMaterial({issueId:'SUPPLY-ISS',materialSkuId:source.materialCode,unit:'kg',quantity:12},factory,'factory-receive')
  consumeTmfBaseMaterial({issueId:'SUPPLY-ISS',consumedQty:10,scrapQty:0,reason:'实称10kg，非配方'},factory,'consume')
  dispatchTmfBaseMaterialReturn({id:'SUPPLY-RETURN',issueId:'SUPPLY-ISS',quantity:1,reason:'未用退回'},factory,'return')
  receiveTmfBaseMaterialReturn({returnId:'SUPPLY-RETURN',warehouseId:source.warehouse,materialSkuId:source.materialCode,unit:'kg',quantity:1},warehouse,'return-receive')
  assert.equal(getTmfBaseMaterialBalance('SUPPLY-ISS').availableQty,1)
  assert.equal(getTmfPurchaseState().baseMaterialLots.reduce((n,l)=>n+l.onHandQty,0),289)
  assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,300)
  await assert.rejects(receiveTmfSupplyPurchase({...input,receiptId:'SUPPLY-R3',lotId:'SUPPLY-LOT3',quantity:1},warehouse,'over-total'),/超过采购/)
 }finally{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');reloadTmfPurchaseRuntime();resetPmsMaterialPurchaseRuntimeForTest()}
})

test('历史手工到货及不支持的单位不能直接变成投入料可用库存',async()=>{
 const before=getTmfPurchaseState()
 for(const no of ['CGF-2026-0002','CGF-2026-0005']){
  const source=getPmsMaterialPurchaseOrder(no)!
  await assert.rejects(receiveTmfSupplyPurchase({receiptId:no+'-R',purchaseOrderNo:no,purpose:'TIP_MATERIAL',lotId:no+'-L',scannedMaterialCode:source.materialCode,warehouse:source.warehouse,location:'A',quantity:1},warehouse,no+'-OP'),/历史手工到货/)
 }
 const source=getPmsMaterialPurchaseOrder('CGF-2026-0001')!
 await assert.rejects(receiveTmfSupplyPurchase({receiptId:'METER-R',purchaseOrderNo:source.purchaseOrderNo,purpose:'BASE_MATERIAL',lotId:'METER-L',scannedMaterialCode:source.materialCode,warehouse:source.warehouse,location:'A',quantity:1},warehouse,'meter-op'),/计量单位/)
 assert.deepEqual(getTmfPurchaseState(),before)
})


test('首次实收前供应商确认与关闭可刷新恢复，保存失败和损坏存储不会覆盖状态',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'window'),storage=new Map<string,string>();let fail=false
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw new Error('quota');storage.set(k,v)}}}})
 try{
  resetPmsMaterialPurchaseRuntimeForTest();reloadTmfPurchaseRuntime()
  const no='CGF-2026-0007'
  advancePmsMaterialPurchaseOrderStatus(no,'已采购',PMS_BUYER_ACTOR)
  applyPmsSupplierConfirmation(no,PMS_BUYER_ACTOR)
  resetPmsMaterialPurchaseRuntimeForTest()
  assert.equal(getPmsMaterialPurchaseOrder(no)!.supplierConfirmed,true)
  assert.equal(getPmsMaterialPurchaseOrder(no)!.receivedQty,0)
  const before=structuredClone(getPmsMaterialPurchaseOrder(no)),saved=storage.get(PMS_MATERIAL_PURCHASE_UPDATES_KEY)
  fail=true;assert.throws(()=>closePmsMaterialPurchaseOrder(no,'未发货取消',PMS_BUYER_ACTOR),/未保存/)
  assert.deepEqual(getPmsMaterialPurchaseOrder(no),before);assert.equal(storage.get(PMS_MATERIAL_PURCHASE_UPDATES_KEY),saved)
  fail=false;closePmsMaterialPurchaseOrder(no,'未发货取消',PMS_BUYER_ACTOR)
  resetPmsMaterialPurchaseRuntimeForTest();assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'已关闭')
  assert.equal(getPmsMaterialPurchaseOrder(no)!.remark,'未发货取消')
  const closed=storage.get(PMS_MATERIAL_PURCHASE_UPDATES_KEY)!
  storage.set(PMS_MATERIAL_PURCHASE_UPDATES_KEY,'broken')
  assert.throws(()=>getPmsMaterialPurchaseOrder(no),/无法读取/)
  assert.equal(storage.get(PMS_MATERIAL_PURCHASE_UPDATES_KEY),'broken')
  storage.set(PMS_MATERIAL_PURCHASE_UPDATES_KEY,closed)
  assert.equal(getPmsMaterialPurchaseOrder(no)!.status,'已关闭')
 }finally{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');reloadTmfPurchaseRuntime();resetPmsMaterialPurchaseRuntimeForTest()}
})
