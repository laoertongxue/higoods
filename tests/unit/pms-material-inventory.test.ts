import assert from 'node:assert/strict'
import test from 'node:test'
import { getFabricDemandBoardRows } from '../../src/data/wls/fabric-demand-board.ts'
import { listPmsMaterialInventory,listPmsMaterialInventoryBarcodes,listPmsMaterialInventoryFlows,listPmsMaterialInventoryCounts } from '../../src/data/pms/material-inventory.ts'
import { getPmsMaterialPurchaseOrder,publishPmsMaterialPurchaseOrders } from '../../src/data/pms/material-purchase-orders.ts'

test('采购库存投影读取现有 WLS 数量和图片，不独立维护库存',()=>{
 const source=getFabricDemandBoardRows()
 const before=structuredClone(source)
 const rows=listPmsMaterialInventory()
 assert.equal(rows.length,12)
 assert.equal(new Set(rows.map(row=>row.sku)).size,6)
 assert.equal(rows.reduce((sum,row)=>sum+row.stockQty,0),source.flatMap(row=>row.warehouseStocks).reduce((sum,stock)=>sum+stock.qty,0))
 assert.ok(rows.every(row=>row.imageUrl&&row.largeImageUrl&&row.unit==='Yard'))
 assert.ok(rows.every(row=>row.lockedQty===null&&row.availableQty===null))
 assert.deepEqual(getFabricDemandBoardRows(),before)
})
test('没有身份匹配的条码、流水和盘点不制造明细',async()=>{
 const row=listPmsMaterialInventory()[0]
 assert.deepEqual(listPmsMaterialInventoryBarcodes(row.sku),[])
 assert.deepEqual(await listPmsMaterialInventoryFlows(row.sku,row.warehouse),[])
 assert.deepEqual(await listPmsMaterialInventoryCounts(row.sku),[])
})
test('已提交采购入库读投影保留独立单位、来源和采购照片，不修改 WLS 数量',()=>{
 const order=getPmsMaterialPurchaseOrder('CGF-2026-0007')!
 const before=structuredClone(order),wlsBefore=structuredClone(getFabricDemandBoardRows())
 // Test fixture publication only; successful persistent submission is verified in the browser.
 try{
  publishPmsMaterialPurchaseOrders([{...before,inventoryPosting:{id:'CHECK-POSTING',sourcePurchaseOrderNo:order.purchaseOrderNo,materialCode:order.materialCode,materialName:order.materialName,imageUrl:order.materialImageUrl,warehouse:order.warehouse,qty:50,unit:order.unit,postedAt:'2026-10-13T10:00:00+07:00',operator:'测试人',sourceKind:'local-demo'}}])
  const rows=listPmsMaterialInventory(),projection=rows.find(row=>row.localPostings?.some(posting=>posting.id==='CHECK-POSTING'))!
  assert.equal(rows.length,13)
  assert.equal(projection.stockQty,50)
  assert.equal(projection.unit,order.unit)
  assert.equal(projection.imageUrl,order.materialImageUrl)
  assert.equal(projection.localPostings?.[0].sourcePurchaseOrderNo,order.purchaseOrderNo)
  assert.equal(projection.availableQty,null)
  assert.deepEqual(getFabricDemandBoardRows(),wlsBefore)
 }finally{publishPmsMaterialPurchaseOrders([{...before,inventoryPosting:undefined}])}
})
test('本地采购条码只按 SKU、仓库、单位精确投影，下架区域不扣仓库数量',()=>{
 const order=getPmsMaterialPurchaseOrder('CGF-2026-0007')!,before=structuredClone(order),wlsBefore=structuredClone(getFabricDemandBoardRows())
 const beforeStock=listPmsMaterialInventory().map(row=>[row.id,row.stockQty])
 try{
  const detailBarcodes=structuredClone(before.detailBarcodes!)
  detailBarcodes[0]={...detailBarcodes[0],status:'已下架',targetArea:'待出库区',movedAt:'2026-10-13T12:00:00+07:00',movedBy:'条码验收人'}
  publishPmsMaterialPurchaseOrders([{...before,detailBarcodes}])
  const records=listPmsMaterialInventoryBarcodes(order.materialCode,detailBarcodes[0].warehouse,order.unit)
  assert.equal(records.length,6)
  assert.equal(records[0].sourceKind,'local-demo')
  assert.equal(records[0].targetArea,'待出库区')
  assert.equal(records[0].movedBy,'条码验收人')
  assert.equal(records[0].inboundNo,order.purchaseOrderNo)
  assert.equal(records[0].location,'')
  assert.deepEqual(listPmsMaterialInventoryBarcodes(order.materialCode,'不匹配仓库',order.unit),[])
  assert.deepEqual(listPmsMaterialInventoryBarcodes(order.materialCode,detailBarcodes[0].warehouse,'Yard'),[])
  assert.deepEqual(listPmsMaterialInventory().map(row=>[row.id,row.stockQty]),beforeStock)
  assert.deepEqual(getFabricDemandBoardRows(),wlsBefore)
 }finally{publishPmsMaterialPurchaseOrders([before])}
})
