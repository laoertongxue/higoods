import test from 'node:test'
import assert from 'node:assert/strict'
import {getFactoryMobileWarehouseOverview,getFactoryMobileTransferBagPackTasks,getFactoryMobileTransferBagReceiveTasks} from '../../src/data/fcs/factory-mobile-warehouse.ts'
import {listCuttingSewingDispatchOrders} from '../../src/data/fcs/cutting/sewing-dispatch.ts'
import {listFactoryWaitProcessStockItems,listFactoryWaitHandoverStockItems,getFactoryWarehouseSummary,createFactoryInternalWarehouseMutationSnapshot,restoreFactoryInternalWarehouseMutationSnapshot,upsertFactoryWaitProcessStockItem} from '../../src/data/fcs/factory-internal-warehouse.ts'
import {registerWashingOutputStock,washingOutputStock} from '../../src/data/fcs/fabric-washing-gates.ts'
import {listFactoryInternalWarehouses} from '../../src/data/fcs/factory-internal-warehouse-locations.ts'

test('WASH-267–269: washing warehouse totals follow unused input and actual pending output with the same filters',()=>{
  const snapshot=createFactoryInternalWarehouseMutationSnapshot(),originalOutput=washingOutputStock()
  const filters={factoryId:'ID-F003',timeRange:'7D' as const}
  const baseline=getFactoryWarehouseSummary(filters),other=getFactoryWarehouseSummary({factoryId:'F090'})
  const inputTemplate=listFactoryWaitProcessStockItems().find(row=>row.factoryId==='ID-F003')
  const outputTemplate=listFactoryWaitHandoverStockItems()[0]
  const outputWarehouse=listFactoryInternalWarehouses('ID-F003').find(row=>row.warehouseKind==='WAIT_HANDOVER')
  assert.ok(inputTemplate&&outputTemplate&&outputWarehouse)
  const input={...inputTemplate,stockItemId:'WASH-SUMMARY-INPUT',washingOrderId:'WASH-SUMMARY',processCode:'PROC_WASH',taskNo:'WS-SUMMARY',fabricRollNo:'WASH-SUMMARY-ROLL',receivedAt:new Date().toISOString(),expectedQty:53,receivedQty:53,issuedQty:0,availableQty:53,status:'已入待加工仓' as const}
  try{
    upsertFactoryWaitProcessStockItem(input)
    assert.equal(getFactoryWarehouseSummary(filters).waitProcessQty-baseline.waitProcessQty,53)
    assert.equal(getFactoryWarehouseSummary(filters).waitHandoverQty,baseline.waitHandoverQty)
    upsertFactoryWaitProcessStockItem({...input,issuedQty:53,availableQty:0})
    assert.equal(getFactoryWarehouseSummary(filters).waitProcessQty,baseline.waitProcessQty,'投入后不得继续把原实收量算作待加工量')
    const output={...outputTemplate,stockItemId:'WASH-SUMMARY-OUTPUT',washingOrderId:'WASH-SUMMARY',factoryId:'ID-F003',warehouseId:outputWarehouse.warehouseId,warehouseName:outputWarehouse.warehouseName,processCode:'PROC_WASH',taskNo:'WS-SUMMARY',fabricRollNo:'WASH-SUMMARY-ROLL',completedQty:52,waitHandoverQty:52,unit:'Yard',status:'待交出' as const}
    registerWashingOutputStock(()=>[...originalOutput,output])
    assert.equal(getFactoryWarehouseSummary(filters).waitHandoverQty-baseline.waitHandoverQty,52)
    assert.equal(getFactoryMobileWarehouseOverview('ID-F003','GTG').waitHandoverQty-baseline.waitHandoverQty,52)
    assert.equal(getFactoryWarehouseSummary({...filters,keyword:'WS-SUMMARY',warehouseKind:'WAIT_HANDOVER'}).waitHandoverQty,52)
    assert.equal(getFactoryWarehouseSummary({...filters,keyword:'OTHER'}).waitHandoverQty,0)
    assert.equal(getFactoryWarehouseSummary({...filters,processCode:'PROC_PRINT'}).waitHandoverQty,0)
    assert.equal(getFactoryWarehouseSummary({...filters,status:'已交出'}).waitHandoverQty,0)
    assert.deepEqual(getFactoryWarehouseSummary({factoryId:'F090'}),other)
    registerWashingOutputStock(()=>[...originalOutput,{...output,status:'已交出',waitHandoverQty:0}])
    assert.equal(getFactoryWarehouseSummary(filters).waitHandoverQty,baseline.waitHandoverQty)
    assert.equal(listFactoryWaitProcessStockItems().find(row=>row.stockItemId===input.stockItemId)?.receivedQty,53,'统计不得改写原实收事实')
  }finally{registerWashingOutputStock(()=>originalOutput);restoreFactoryInternalWarehouseMutationSnapshot(snapshot)}
})

test('GTG dye warehouse retains its fabric facts and has no unrelated cutting/sewing transfer-bag counts',()=>{
  const view=getFactoryMobileWarehouseOverview('ID-F003','GTG')
  assert.equal(view.waitProcessCount,listFactoryWaitProcessStockItems().filter(row=>row.factoryId==='ID-F003').length)
  assert.equal(view.waitHandoverCount,listFactoryWaitHandoverStockItems().filter(row=>row.factoryId==='ID-F003').length)
  assert.equal(view.transferBagPackTaskCount,0);assert.equal(view.pendingTransferBagReceiveCount,0)
  assert.equal(view.receivedTransferBagCount,0);assert.equal(view.feiTicketWritebackCount,0)
})
test('the dye warehouse shortcut preserves existing cutting and sewing transfer-bag facts',()=>{
  const orders=listCuttingSewingDispatchOrders();assert.ok(orders.length)
  const cut=orders[0].cuttingFactoryId,sew=orders[0].sewingFactoryId
  const cutting=getFactoryMobileWarehouseOverview(cut,'裁床'),sewing=getFactoryMobileWarehouseOverview(sew,'车缝')
  assert.equal(cutting.transferBagPackTaskCount,getFactoryMobileTransferBagPackTasks(cut).length)
  assert.equal(sewing.pendingTransferBagReceiveCount,getFactoryMobileTransferBagReceiveTasks(sew).filter(row=>row.packStatus==='已交出'||row.currentLocation==='下游工厂待接收').length)
})
