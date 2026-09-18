/** Preserve ledger isolation/transfer checks under the two-stage receipt model. */
import assert from 'node:assert/strict'
import {readWoolStore,replaceWoolStore} from '../src/data/fcs/wool-domain/store.ts'
import {adjustWoolWarehouseStock,transferWoolWarehouseStock,issueWoolYarn} from '../src/data/fcs/wool-domain/commands.ts'
import {getWoolWarehouseStock,getWoolOutputHandoverAvailableQty,listWoolFactoryWarehouseFlows,summarizeWoolQuantities,listWoolWarehouseStocksFromStore} from '../src/data/fcs/wool-domain/queries.ts'
import {getFactoryMobileWarehouseOverview} from '../src/data/fcs/factory-mobile-warehouse.ts'
import {woolWarehouseFlowSignedQty} from '../src/data/fcs/wool-domain/warehouse-ledger.ts'
import {listFactoryInternalWarehouses,resolveEnabledFactoryWarehouseLocation} from '../src/data/fcs/factory-internal-warehouse-locations.ts'
import {renderPdaWoolWarehouseFlows} from '../src/pages/pda-wool-warehouse-flows.ts'
const before=readWoolStore(),at='2026-09-18 17:00:00'
try {
 const order=before.workOrders['WOOL-STAGE-004:LINKING'],line=order.outputPlanLines[0]
 const key={woolOrderId:order.woolOrderId,objectSkuCode:line.outputSkuCode,defaultLocationId:'WOOL-WH-CUT-DEFAULT' as const}
 const qty=getWoolWarehouseStock(key),paired=JSON.stringify(before.workOrders[order.pairedWorkOrderId])
 const warehouses=listFactoryInternalWarehouses().filter(w=>w.isEnabled)
 const target=warehouses.flatMap(warehouse=>warehouse.areaList.flatMap(a=>a.shelfList.flatMap(s=>s.locationList.map(location=>({warehouse,location}))))).find(({warehouse,location})=>resolveEnabledFactoryWarehouseLocation(warehouse.warehouseId,location.locationId))!
 const out={...key,commandId:'STAGE-TRANSFER-OUT',qty:5,toWarehouseId:target.warehouse.warehouseId,toLocationId:target.location.locationId,reason:'调整存放位置',operatedAt:at,operatedBy:'仓管'}
 assert.throws(()=>transferWoolWarehouseStock({...out,commandId:'fractional',qty:.5}),/整数/)
 const outbound=transferWoolWarehouseStock(out);transferWoolWarehouseStock(out)
 assert.equal(getWoolWarehouseStock(key),qty-5)
 assert.equal(getWoolOutputHandoverAvailableQty(order.woolOrderId,line.outputSkuCode),qty-5)
 assert.throws(()=>transferWoolWarehouseStock({...out,qty:6}),/重复|不一致|载荷|幂等冲突/)
 assert.throws(()=>transferWoolWarehouseStock({...out,commandId:'bad-location',toWarehouseId:'NO-SUCH-WAREHOUSE'}),/公共仓库|启用/)
 transferWoolWarehouseStock({...out,commandId:'STAGE-TRANSFER-IN',fromWarehouseId:outbound.toWarehouseId,fromLocationId:outbound.toLocationId,toWarehouseId:'WOOL-WAIT-HANDOVER',toLocationId:key.defaultLocationId})
 assert.equal(getWoolWarehouseStock(key),qty)
 console.log('PASS 最终产物件数整数、移库扣减与转回守恒、同命令防重及未知库位阻断')
 const adjust={...key,commandId:'STAGE-ADJUST',afterQty:qty-1,reason:'盘点少一件',operatedAt:at,operatedBy:'仓管'}
 adjustWoolWarehouseStock(adjust);adjustWoolWarehouseStock(adjust)
 assert.equal(getWoolWarehouseStock(key),qty-1)
 assert.equal(JSON.stringify(readWoolStore().workOrders[order.pairedWorkOrderId]),paired)
 assert.equal(readWoolStore().processReports.filter(r=>r.woolOrderId===order.woolOrderId).reduce((sum,r)=>sum+r.reportedQty,0),qty)
 assert.throws(()=>adjustWoolWarehouseStock({...adjust,commandId:'negative',afterQty:-1}),/小于 0/)
 console.log('PASS 库存调整不伪改加工实绩与配对单，负数及重复调整受控')
 const yarnOrder=before.workOrders['WOOL-STAGE-002:KNITTING'],r=before.yarnReceipts.find(r=>r.woolOrderId===yarnOrder.woolOrderId)!,yarn=r.lines[0]
 const untouched=JSON.stringify(readWoolStore())
 assert.throws(()=>issueWoolYarn(yarnOrder.woolOrderId,{commandId:'wrong-batch',yarnSkuCode:yarn.yarnSkuCode,batchNo:'OTHER-BATCH',issuedQty:1,issuedAt:at,issuedBy:'仓管'}),/库存|余额/)
 assert.equal(JSON.stringify(readWoolStore()),untouched)
 console.log('PASS 错批次领纱零写，不挪用另一批实收')
 const store=readWoolStore(),flows=listWoolFactoryWarehouseFlows(store,order.factoryId)
 const overview=getFactoryMobileWarehouseOverview(order.factoryId,order.factoryName,new Date('2026-09-18T12:00:00Z'))
 assert.equal(overview.todayInboundCount,flows.filter(f=>f.operatedAt.startsWith('2026-09-18')&&woolWarehouseFlowSignedQty(f)>0).length)
 assert.equal(overview.todayOutboundCount,flows.filter(f=>f.operatedAt.startsWith('2026-09-18')&&woolWarehouseFlowSignedQty(f)<0).length)
 assert.match(overview.waitHandoverQtyText!,/件/);assert.match(overview.waitHandoverQtyText!,/片/)
 assert.equal(summarizeWoolQuantities([{qty:2,unit:'kg'},{qty:3,unit:'件'},{qty:4,unit:'片'}]),'2 kg / 3 件 / 4 片')
 assert.ok(listWoolWarehouseStocksFromStore(store).filter(r=>r.unit==='片').every(r=>r.objectSkuCode!==line.outputSkuCode))
 assert.deepEqual(listWoolFactoryWarehouseFlows(store,'NO-SUCH-FACTORY'),[])
 assert.match(renderPdaWoolWarehouseFlows(order.factoryId,order.factoryName,'IN')!,/按单位汇总|共 \d+ 条/)
 assert.equal(renderPdaWoolWarehouseFlows('OTHER','非毛织厂','IN'),null)
 console.log('PASS PDA与Web使用同一阶段仓储流水，片件kg分组，错厂不可见且不外发片不造物理片库存')
} finally {replaceWoolStore(before)}
