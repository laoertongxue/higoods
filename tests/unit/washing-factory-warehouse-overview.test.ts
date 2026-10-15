import test from 'node:test'
import assert from 'node:assert/strict'
import {getFactoryMobileWarehouseOverview,getFactoryMobileTransferBagPackTasks,getFactoryMobileTransferBagReceiveTasks} from '../../src/data/fcs/factory-mobile-warehouse.ts'
import {listCuttingSewingDispatchOrders} from '../../src/data/fcs/cutting/sewing-dispatch.ts'
import {listFactoryWaitProcessStockItems,listFactoryWaitHandoverStockItems} from '../../src/data/fcs/factory-internal-warehouse.ts'

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
