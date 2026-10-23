import test from 'node:test'
import assert from 'node:assert/strict'
import { centralWoolStockOperationRequest, centralWoolStockTargets, centralWoolPublicBalances, centralWoolTransferBackRequest } from '../../src/pages/central-pda/wool-stock-operation-model.ts'
import { centralWoolWarehouseFacts } from '../../src/pages/central-pda/wool-warehouse-model.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { centralWoolIncoming, centralWoolReceiptRequest } from '../../src/pages/central-pda/wool-model.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { adjustWoolWarehouseStock, transferWoolWarehouseStock } from '../../src/data/fcs/wool-domain/commands.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, getFactoryReceiptLocations } from '../../src/data/fcs/factory-receiving.ts'

const factory='OWN_WOOL_FACTORY', at='2026-10-22T09:00:00Z'
const actor=()=>readFactoryPdaExecutionUsers(factory).find(u=>u.roleId==='ROLE_ADMIN')!
const facts=()=>centralWoolWarehouseFacts(factory)
async function isolated(run:()=>void|Promise<void>){facts();const before=readWoolStore(),receiving=captureFactoryReceivingData();try{await run()}finally{restoreFactoryReceivingData(receiving);replaceWoolStore(before)}}
test('C02.06 default stock adjusts in original units, including zero, with original actor and reason',()=>isolated(()=>{
 const a=actor(),r=facts().stocks.find(r=>r.order&&!r.stock.physicalLocationId&&r.stock.unit==='件'&&r.stock.currentQty>1)!
 assert.ok(r)
 assert.throws(()=>centralWoolStockOperationRequest(r,'adjust',1.5,'counted',undefined,a,'fraction',at),/WOP_integer/)
 assert.throws(()=>centralWoolStockOperationRequest(r,'adjust',0,' ',undefined,a,'reason',at),/WOP_reason/)
 assert.throws(()=>centralWoolStockOperationRequest(r,'adjust',r.stock.currentQty,'counted',undefined,a,'same',at),/WOP_sameQuantity/)
 const request=centralWoolStockOperationRequest(r,'adjust',0,'Counted at location',undefined,a,'C02-ADJUST-ZERO',at)
 assert.equal(request.kind,'adjust');if(request.kind!=='adjust')throw Error('wrong kind')
 const saved=adjustWoolWarehouseStock(request.input)
 assert.equal(saved.qty,-r.stock.currentQty);assert.equal(saved.unit,'件');assert.equal(saved.operatedBy,a.name)
 assert.equal(facts().stocks.find(s=>s.stock.stockKey===r.stock.stockKey)?.stock.currentQty,0)
 assert.equal(adjustWoolWarehouseStock(request.input).flowId,saved.flowId)
}))
test('C02.06 public positions keep separate balances; partial return uses original endpoint and retry does not move again',()=>isolated(()=>{
 const a=actor(),r=facts().stocks.find(r=>r.order&&!r.stock.physicalLocationId&&r.stock.unit==='件'&&r.stock.currentQty>=4)!
 const targets=centralWoolStockTargets(r).slice(0,2);assert.equal(targets.length,2)
 for(const [i,p] of targets.entries()){
  const fresh=facts().stocks.find(s=>s.stock.stockKey===r.stock.stockKey)!
  const request=centralWoolStockOperationRequest(fresh,'transfer',i+1,'Move to rack',{warehouseId:p.warehouse.warehouseId,locationId:p.location.locationId},a,'C02-PUBLIC-'+i,at)
  assert.notEqual(request.kind,'adjust');if(request.kind==='adjust')throw Error('kind')
  transferWoolWarehouseStock(request.input)
 }
 const balances=centralWoolPublicBalances(facts()).filter(b=>b.row.stock.stockKey===r.stock.stockKey)
 assert.deepEqual(balances.map(b=>b.quantity),[1,2])
 assert.throws(()=>centralWoolTransferBackRequest(balances[0],2,'Return',a,'over',at),/WST_limit/)
 const back=centralWoolTransferBackRequest(balances[1],1,'Return from counted rack',a,'C02-PUBLIC-BACK',at)
 if(back.kind==='adjust')throw Error('kind')
 transferWoolWarehouseStock(back.input);transferWoolWarehouseStock(back.input)
 assert.deepEqual(centralWoolPublicBalances(facts()).filter(b=>b.row.stock.stockKey===r.stock.stockKey).map(b=>b.quantity),[1,1])
 assert.equal(facts().stocks.find(s=>s.stock.stockKey===r.stock.stockKey)?.stock.currentQty,r.stock.currentQty-2)
}))
test('C02.06 physical targets are enabled own receiving positions, no adjustment, no cross-factory or same-position transfer',()=>isolated(()=>{
 const a=actor(),p=getFactoryReceiptLocations(factory)[0],o=facts().orders.find(o=>o.woolOrderId==='WOOL-STAGE-001:KNITTING')!
 const incoming=centralWoolIncoming(factory).find(r=>r.line.woolOrderId===o.woolOrderId&&r.line.material.kind==='YARN')!
 const requestReceipt=centralWoolReceiptRequest(incoming,{kind:'YARN',grossKg:4.062,tubes:{PAPER:1,CONICAL:0,PAGODA:0},warehouseId:p.warehouse.warehouseId,locationId:p.location.locationId},a,'C02-PHYSICAL-FIXTURE',at)
 confirmFactoryMaterialReceipt(requestReceipt.input,a);readWoolStore()
 const batch=incoming.line.material.batchNo
 const r=facts().stocks.find(r=>r.stock.woolOrderId===o.woolOrderId&&r.stock.batchNo===batch&&r.stock.physicalLocationId===p.location.locationId)!
 assert.throws(()=>centralWoolStockOperationRequest(r,'adjust',1,'Count',undefined,a,'physical-adjust',at),/WOP_physicalAdjustment/)
 assert.throws(()=>centralWoolStockOperationRequest(r,'transfer',1,'Move',{warehouseId:p.warehouse.warehouseId,locationId:p.location.locationId},a,'same-pos',at),/WOP_target/)
 const target=centralWoolStockTargets(r)[0]
 assert.equal(target.warehouse.factoryId,factory);assert.notEqual(target.location.locationId,p.location.locationId)
 assert.throws(()=>centralWoolStockOperationRequest(r,'transfer',5,'Move',{warehouseId:target.warehouse.warehouseId,locationId:target.location.locationId},a,'over-pos',at),/WST_limit/)
 const request=centralWoolStockOperationRequest(r,'transfer',1.2345,'Rack changed',{warehouseId:target.warehouse.warehouseId,locationId:target.location.locationId},a,'C02-PHYSICAL-MOVE',at)
 if(request.kind==='adjust')throw Error('kind')
 transferWoolWarehouseStock(request.input)
 const rows=facts().stocks.filter(s=>s.stock.woolOrderId===o.woolOrderId&&s.stock.batchNo===batch)
 assert.equal(rows.reduce((n,r)=>n+r.stock.currentQty,0),4)
 assert.equal(rows.find(s=>s.stock.physicalLocationId===target.location.locationId)?.stock.currentQty,1.2345)
 const flows=facts().flows.filter(f=>f.physicalTransferId==='STOCK-TRANSFER-C02-PHYSICAL-MOVE')
 assert.equal(flows.length,2);assert.ok(flows.every(f=>f.operatedBy===a.name&&f.reason==='Rack changed'))
}))

test('C02.06 original default stock adjustment never subtracts the same batch physical-location stock',()=>isolated(()=>{
 const a=actor(),p=getFactoryReceiptLocations(factory)[0],order='WOOL-STAGE-001:KNITTING'
 const incoming=centralWoolIncoming(factory).find(r=>r.line.woolOrderId===order&&r.line.material.kind==='YARN')!
 const r=centralWoolReceiptRequest(incoming,{kind:'YARN',grossKg:4.062,tubes:{PAPER:1,CONICAL:0,PAGODA:0},warehouseId:p.warehouse.warehouseId,locationId:p.location.locationId},a,'C02-MIXED-RECEIPT',at)
 confirmFactoryMaterialReceipt(r.input,a);readWoolStore()
 adjustWoolWarehouseStock({commandId:'C02-DEFAULT-ONE',woolOrderId:order,objectSkuCode:incoming.line.material.sku,batchNo:incoming.line.material.batchNo,defaultLocationId:'WOOL-WP-YARN-DEFAULT',afterQty:1,reason:'Counted default position',operatedBy:a.name,operatedAt:at})
 const rows=facts().stocks.filter(s=>s.stock.woolOrderId===order&&s.stock.batchNo===incoming.line.material.batchNo)
 assert.equal(rows.find(s=>!s.stock.physicalLocationId)?.stock.currentQty,1)
 assert.equal(rows.find(s=>s.stock.physicalLocationId===p.location.locationId)?.stock.currentQty,4)
 assert.equal(rows.reduce((n,s)=>n+s.stock.currentQty,0),5)
}))
test('C02.06 original Web piece inventory supports the offered adjustment and transfer in pieces, without altering process reports',()=>isolated(()=>{
 const a=actor(),r=facts().stocks.find(r=>r.order&&!r.stock.physicalLocationId&&r.stock.unit==='片'&&r.stock.currentQty>=2)!
 assert.ok(r)
 const reports=JSON.stringify(facts().store.processReports)
 const adjustment=centralWoolStockOperationRequest(r,'adjust',r.stock.currentQty-1,'Counted one less',undefined,a,'C02-PIECE-ADJUST',at)
 if(adjustment.kind!=='adjust')throw Error('kind')
 adjustWoolWarehouseStock(adjustment.input)
 const fresh=facts().stocks.find(s=>s.stock.stockKey===r.stock.stockKey)!,p=centralWoolStockTargets(fresh)[0]
 const transfer=centralWoolStockOperationRequest(fresh,'transfer',1,'Move counted pieces',{warehouseId:p.warehouse.warehouseId,locationId:p.location.locationId},a,'C02-PIECE-MOVE',at)
 if(transfer.kind==='adjust')throw Error('kind')
 transferWoolWarehouseStock(transfer.input)
 assert.equal(facts().stocks.find(s=>s.stock.stockKey===r.stock.stockKey)?.stock.currentQty,r.stock.currentQty-2)
 assert.equal(JSON.stringify(facts().store.processReports),reports)
}))

test('C02.06 physical piece move keeps piece identity, integer quantity and original handover warehouse mode',()=>isolated(()=>{
 const a=actor(),store=readWoolStore(),flow=store.warehouseFlows.find(f=>f.unit==='片'&&f.flowType==='INBOUND')!,p=getFactoryReceiptLocations(factory)[0]
 flow.physicalWarehouseId=p.warehouse.warehouseId;flow.physicalLocationId=p.location.locationId
 replaceWoolStore(store)
 const r=facts().stocks.find(r=>r.stock.woolOrderId===flow.woolOrderId&&r.stock.objectSkuCode===flow.objectSkuCode&&r.stock.physicalLocationId===p.location.locationId)!,to=centralWoolStockTargets(r)[0]
 const request=centralWoolStockOperationRequest(r,'transfer',1,'Move piece bin',{warehouseId:to.warehouse.warehouseId,locationId:to.location.locationId},a,'C02-PIECE-PHYSICAL-MOVE',at)
 if(request.kind==='adjust')throw Error('kind')
 transferWoolWarehouseStock(request.input)
 const moves=facts().flows.filter(f=>f.physicalTransferId==='STOCK-TRANSFER-C02-PIECE-PHYSICAL-MOVE')
 assert.equal(moves.length,2)
 assert.ok(moves.every(f=>f.unit==='片'&&f.defaultLocationType==='CUT_PIECE'&&f.defaultLocationId==='WOOL-WH-CUT-DEFAULT'&&f.warehouseMode==='WAIT_HANDOVER'&&f.objectSkuCode===flow.objectSkuCode))
}))
